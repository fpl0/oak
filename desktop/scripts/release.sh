#!/usr/bin/env bash
# One-command release of the desktop app: build a release commit in a clean worktree, package it, write
# SHA256SUMS, publish the GitHub release, point the blog post at it, install it in /Applications, and clean up.
#
#   desktop/scripts/release.sh <version> [--sha <commit>] [--notes-file <file>] [--sounds-from <checkout>]
#                              [--dry-run] [--yes] [--no-publish] [--no-install] [--no-blog] [--keep-worktree]
#
# The version is the one in desktop/package.json at the release commit (bump it there, commit, push first).
# Every outward step (the GitHub release, the blog edit, replacing /Applications/Oak.app) asks y/N first unless
# --yes. The blog step only edits the file and shows `git diff`; it never commits or pushes. --dry-run prints every
# command and runs only read-only checks: it creates no worktree and writes nothing.
set -euo pipefail

REPO_SLUG="fpl0/oak"
BLOG_DIR="${OAK_BLOG_DIR:-$HOME/Code/heyfilipelima}"
BLOG_POST="src/content/posts/oak.mdx"
APP_DEST="/Applications/Oak.app"
ASSETS=(Oak-macos-arm64.dmg Oak-macos-arm64.zip SHA256SUMS)
FOOTER="Apple Silicon, macOS 13 or later. This build is ad hoc signed and not notarized: right-click Oak and choose Open the first time."

usage() {
  sed -n '5,6p' "$0" | sed 's/^# *//'
  exit "${1:-2}"
}
die() {
  echo "release: $*" >&2
  exit 1
}
say() { printf '\n== %s\n' "$*"; }

# --- arguments ------------------------------------------------------------------------------------------------
VERSION=""
SHA=""
NOTES_FILE=""
SOUNDS_FROM=""
DRY=0
YES=0
PUBLISH=1
INSTALL=1
BLOG=1
KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --sha) SHA="${2:?--sha needs a commit}"; shift 2 ;;
    --notes-file) NOTES_FILE="${2:?--notes-file needs a file}"; shift 2 ;;
    --sounds-from) SOUNDS_FROM="${2:?--sounds-from needs a checkout}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --yes | -y) YES=1; shift ;;
    --no-publish) PUBLISH=0; shift ;;
    --no-install) INSTALL=0; shift ;;
    --no-blog) BLOG=0; shift ;;
    --keep-worktree) KEEP=1; shift ;;
    -h | --help) usage 0 ;;
    -*) echo "release: unknown option $1" >&2; usage ;;
    *) [ -z "$VERSION" ] || { echo "release: one version only" >&2; usage; }; VERSION="${1#v}"; shift ;;
  esac
done
[ -n "$VERSION" ] || usage
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "'$VERSION' is not a version like 1.3.3"

REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SHA="$(git -C "$REPO" rev-parse --verify --quiet "${SHA:-HEAD}^{commit}")" || die "no such commit: ${SHA:-HEAD}"
SOUNDS_FROM="$(cd "${SOUNDS_FROM:-$REPO}" && pwd)"
WT="${OAK_RELEASE_DIR:-${TMPDIR:-/tmp}}"
WT="${WT%/}/oak-release-$VERSION"
TAG="v$VERSION"

# --- running commands -----------------------------------------------------------------------------------------
# `run` prints a command and runs it (or only prints it in a dry run). `in_dir` does the same inside a directory.
show() {
  printf '  $'
  printf ' %q' "$@"
  printf '\n'
}
run() {
  show "$@"
  [ "$DRY" = 1 ] || "$@"
}
in_dir() {
  local dir="$1"
  shift
  printf '  (cd %q)' "$dir"
  show "$@"
  [ "$DRY" = 1 ] || (cd "$dir" && "$@")
}
# y/N, unless --yes. A dry run never asks (it runs nothing).
confirm() {
  [ "$DRY" = 1 ] && return 0
  [ "$YES" = 1 ] && return 0
  local answer
  read -r -p "$1 [y/N] " answer </dev/tty || answer=""
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}

# --- preflight (read-only) ------------------------------------------------------------------------------------
PROBLEMS=()
problem() { PROBLEMS+=("$*"); }

say "Preflight for Oak $VERSION at ${SHA:0:12}"

# Newest v* tag, local or on origin (ls-remote reads; nothing is fetched).
REMOTE_TAGS="$(git -C "$REPO" ls-remote --tags --refs origin 'v*' 2>/dev/null | sed 's#.*refs/tags/##' || true)"
[ -n "$REMOTE_TAGS" ] || echo "  (could not list origin's tags; using local tags only)"
PREV_TAG="$({ git -C "$REPO" tag --list 'v*'; printf '%s\n' "$REMOTE_TAGS"; } | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -uV | tail -1 || true)"
if [ -n "$PREV_TAG" ]; then
  NEWEST="$(printf '%s\n%s\n' "${PREV_TAG#v}" "$VERSION" | sort -V | tail -1)"
  if [ "$VERSION" = "${PREV_TAG#v}" ] || [ "$NEWEST" != "$VERSION" ]; then
    problem "$VERSION is not newer than the latest release tag $PREV_TAG"
  fi
  echo "  latest tag: $PREV_TAG"
else
  echo "  latest tag: none"
fi

PKG_VERSION="$(git -C "$REPO" show "$SHA:desktop/package.json" 2>/dev/null |
  sed -n 's/^  "version": *"\([^"]*\)".*/\1/p' | head -1)"
echo "  desktop/package.json at ${SHA:0:12}: ${PKG_VERSION:-missing}"
if [ "$PKG_VERSION" != "$VERSION" ]; then
  problem "desktop/package.json at ${SHA:0:12} says ${PKG_VERSION:-nothing}, not $VERSION. Bump it: set \"version\": \"$VERSION\" in desktop/package.json, commit it as 'Desktop: version $VERSION', push, and run this again."
fi

# The release commit must be on origin: some remote branch's tip has it as an ancestor.
ON_ORIGIN=0
while read -r head_sha _; do
  [ -n "$head_sha" ] || continue
  if git -C "$REPO" cat-file -e "$head_sha^{commit}" 2>/dev/null &&
    git -C "$REPO" merge-base --is-ancestor "$SHA" "$head_sha" 2>/dev/null; then
    ON_ORIGIN=1
    break
  fi
done < <(git -C "$REPO" ls-remote --heads origin 2>/dev/null || true)
if [ "$ON_ORIGIN" = 1 ]; then
  echo "  pushed: yes"
else
  problem "commit ${SHA:0:12} is not on origin: push it first (or 'git fetch' if it was pushed from elsewhere)"
fi

if [ "$PUBLISH" = 1 ]; then
  if gh auth status --hostname github.com >/dev/null 2>&1; then
    echo "  gh: signed in"
  else
    problem "gh is not signed in: run 'gh auth login'"
  fi
  if printf '%s\n' "$REMOTE_TAGS" | grep -qx "$TAG"; then problem "tag $TAG already exists on origin"; fi
fi

PACK_VERSION="$(git -C "$REPO" show "$SHA:sounds/pack.lock.json" 2>/dev/null |
  sed -n 's/^  "packVersion": *"\([^"]*\)".*/\1/p' | head -1)"
if [ -z "$PACK_VERSION" ]; then
  problem "sounds/pack.lock.json at ${SHA:0:12} names no packVersion"
elif [ ! -d "$SOUNDS_FROM/sounds/pack/$PACK_VERSION" ]; then
  problem "the sound pack $SOUNDS_FROM/sounds/pack/$PACK_VERSION is missing: run 'bun run sounds:mirror' there, or pass --sounds-from <checkout that has it>"
else
  echo "  sound pack: $SOUNDS_FROM/sounds/pack/$PACK_VERSION"
fi

for tool in bun npm shasum; do
  command -v "$tool" >/dev/null 2>&1 || problem "$tool is not on PATH"
done
[ ! -e "$WT" ] || problem "$WT already exists: remove it (git worktree remove --force $WT) or set OAK_RELEASE_DIR"
[ -z "$NOTES_FILE" ] || [ -f "$NOTES_FILE" ] || problem "no notes file at $NOTES_FILE"
if [ "$BLOG" = 1 ] && [ ! -f "$BLOG_DIR/$BLOG_POST" ]; then
  problem "no blog post at $BLOG_DIR/$BLOG_POST (pass --no-blog, or set OAK_BLOG_DIR)"
fi

if [ ${#PROBLEMS[@]} -gt 0 ]; then
  echo
  for p in "${PROBLEMS[@]}"; do echo "  refused: $p" >&2; done
  [ "$DRY" = 1 ] || die "nothing was done"
  echo "  (dry run: a real run stops here; the plan follows anyway)"
fi

# --- release notes --------------------------------------------------------------------------------------------
if [ -n "$NOTES_FILE" ]; then
  NOTES="$(cat "$NOTES_FILE")"
else
  RANGE="$SHA"
  [ -z "$PREV_TAG" ] || ! git -C "$REPO" rev-parse --verify --quiet "$PREV_TAG^{commit}" >/dev/null || RANGE="$PREV_TAG..$SHA"
  SUBJECTS="$(git -C "$REPO" log --no-merges --format='- %s' "$RANGE" | grep -v '^- Desktop: version ' || true)"
  NOTES="$(printf 'Oak %s.\n\n%s\n\n%s\n' "$VERSION" "${SUBJECTS:-- Small fixes.}" "$FOOTER")"
fi

# --- 1. build in a clean worktree -----------------------------------------------------------------------------
say "1. Build ${SHA:0:12} in $WT"
run git -C "$REPO" worktree add --detach "$WT" "$SHA"
in_dir "$WT" bun install --frozen-lockfile
run mkdir -p "$WT/sounds/pack"
run cp -R "$SOUNDS_FROM/sounds/pack/$PACK_VERSION" "$WT/sounds/pack/"
in_dir "$WT" bun run build

# --- 2. package -----------------------------------------------------------------------------------------------
say "2. Package the desktop app"
in_dir "$WT/desktop" npm ci
in_dir "$WT/desktop" env OAK_SRC="$WT" npm run dist
REL="$WT/desktop/release"
APP="$REL/mac-arm64/Oak.app"
if [ "$DRY" = 0 ]; then
  for f in Oak-macos-arm64.dmg Oak-macos-arm64.zip; do [ -f "$REL/$f" ] || die "the build made no $REL/$f"; done
  BUILT="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
  [ "$BUILT" = "$VERSION" ] || die "the built app says version $BUILT, not $VERSION"
fi

# --- 3. checksums ---------------------------------------------------------------------------------------------
say "3. Write SHA256SUMS"
show shasum -a 256 Oak-macos-arm64.dmg Oak-macos-arm64.zip '>' SHA256SUMS
[ "$DRY" = 1 ] || (cd "$REL" && shasum -a 256 Oak-macos-arm64.dmg Oak-macos-arm64.zip >SHA256SUMS && cat SHA256SUMS)

# --- 4. publish -----------------------------------------------------------------------------------------------
say "4. Publish $TAG on github.com/$REPO_SLUG"
PUBLISHED=0
if [ "$PUBLISH" = 0 ]; then
  echo "  skipped (--no-publish)"
else
  echo "  title:  Oak $VERSION"
  echo "  target: $SHA"
  echo "  assets: ${ASSETS[*]}"
  echo "  notes:"
  printf '%s\n' "$NOTES" | sed 's/^/    | /'
  if confirm "Create the public release $TAG on $REPO_SLUG with these notes and assets?"; then
    in_dir "$REL" gh release create "$TAG" --repo "$REPO_SLUG" --target "$SHA" \
      --title "Oak $VERSION" --notes "$NOTES" "${ASSETS[@]}"
    PUBLISHED=1
  else
    echo "  not published"
  fi
fi

# --- 5. blog post ---------------------------------------------------------------------------------------------
say "5. Point the blog post at $TAG"
if [ "$BLOG" = 0 ]; then
  echo "  skipped (--no-blog)"
else
  POST="$BLOG_DIR/$BLOG_POST"
  # Every versioned link to a release (download and notes) and the "Download Oak X.Y.Z" text.
  EDIT=(perl -pi -e "s#(github\\.com/fpl0/oak/releases/(?:download|tag)/)v[0-9]+\\.[0-9]+\\.[0-9]+#\${1}$TAG#gi; s#(Download Oak )[0-9]+\\.[0-9]+\\.[0-9]+#\${1}$VERSION#g" "$POST")
  echo "  lines that change in $POST:"
  grep -nE 'fpl0/oak/releases/(download|tag)/v[0-9]|Download Oak [0-9]' "$POST" | sed 's/^/    /' || echo "    (none found)"
  [ "$PUBLISHED" = 1 ] || [ "$DRY" = 1 ] || echo "  note: $TAG was not published in this run; the links would point at a release that may not exist"
  if confirm "Edit $POST to link $TAG? (It is not committed or pushed.)"; then
    run "${EDIT[@]}"
    run git -C "$BLOG_DIR" --no-pager diff -- "$BLOG_POST"
    echo "  Review it, then commit and push the blog yourself (pushing deploys it)."
  else
    echo "  blog not edited"
  fi
fi

# --- 6. install -----------------------------------------------------------------------------------------------
say "6. Install in $APP_DEST"
if [ "$INSTALL" = 0 ]; then
  echo "  skipped (--no-install)"
else
  OLD="none"
  if [ -d "$APP_DEST" ]; then
    OLD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_DEST/Contents/Info.plist" 2>/dev/null || echo old)"
  fi
  TRASHED="$HOME/.Trash/Oak-$OLD.app"
  [ ! -e "$TRASHED" ] || TRASHED="$HOME/.Trash/Oak-$OLD-$(date +%Y%m%d%H%M%S).app"
  if [ "$DRY" = 0 ] && pgrep -xq Oak; then
    echo "  Oak is running: quit it first, then install by hand:"
    echo "    mv $APP_DEST $TRASHED && ditto $APP $APP_DEST"
    KEEP=1
  elif confirm "Replace $APP_DEST ($OLD) with $VERSION? The old app goes to the Trash."; then
    [ "$OLD" = "none" ] || run mv "$APP_DEST" "$TRASHED"
    run ditto "$APP" "$APP_DEST"
  else
    echo "  not installed"
    KEEP=1
  fi
fi

# --- 7. clean up ----------------------------------------------------------------------------------------------
say "7. Remove the build worktree"
if [ "$KEEP" = 1 ]; then
  echo "  kept: $WT (the built app and assets are in $REL)"
  echo "  remove it later with: git -C $REPO worktree remove --force $WT"
else
  run git -C "$REPO" worktree remove --force "$WT"
fi

say "Done"
if [ "$DRY" = 1 ]; then
  echo "  dry run: nothing was run or written"
  [ ${#PROBLEMS[@]} -eq 0 ] || exit 1
fi
