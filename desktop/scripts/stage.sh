#!/usr/bin/env bash
# Stages what the desktop app runs: the server and packages as source (Bun runs TypeScript and imports the
# course content at runtime), the built app, the sound pack, production node_modules, and the Bun binary.
# Run from anywhere; needs a finished `bun run build` and a mirrored sound pack in the repository.
set -euo pipefail
DESKTOP="$(cd "$(dirname "$0")/.." && pwd)"
# OAK_SRC: a checkout to stage from instead of this one (for example a clean worktree of a release commit).
ROOT="$(cd "${OAK_SRC:-$DESKTOP/..}" && pwd)"
STAGE="$DESKTOP/stage"
OAK="$STAGE/oak"

[ -f "$ROOT/dist/index.html" ] || { echo "dist/ is missing: run 'bun run build' first" >&2; exit 1; }
[ -f "$ROOT/sounds/pack.lock.json" ] || { echo "sound pack missing: run 'bun run sounds:mirror' first" >&2; exit 1; }

rm -rf "$STAGE"
mkdir -p "$OAK/app" "$OAK/sounds" "$STAGE/bin"

cp "$ROOT/package.json" "$ROOT/bun.lock" "$OAK/"
cp "$ROOT"/tsconfig*.json "$OAK/" 2>/dev/null || true
cp "$ROOT/app/package.json" "$OAK/app/"
EXCLUDES=(--exclude node_modules --exclude '*.test.ts' --exclude '*.pw.ts' --exclude e2e --exclude .DS_Store)
rsync -a "${EXCLUDES[@]}" "$ROOT/server" "$ROOT/packages" "$ROOT/patches" "$OAK/"
rsync -a --exclude .DS_Store "$ROOT/content" "$ROOT/dist" "$OAK/"
# Only the pack version the lock names: the server serves no other, and older versions (and the mirror's source
# cache, sounds/pack/.sources) would only make the download bigger.
V="$(bun -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).packVersion)' "$ROOT/sounds/pack.lock.json")"
[ -d "$ROOT/sounds/pack/$V" ] || { echo "sounds/pack/$V is missing: run 'bun run sounds:mirror' first" >&2; exit 1; }
mkdir -p "$OAK/sounds/pack"
rsync -a "$ROOT/sounds/pack/$V" "$OAK/sounds/pack/"
cp "$ROOT/sounds/pack.lock.json" "$OAK/sounds/"

(cd "$OAK" && bun install --production --frozen-lockfile --ignore-scripts)

cp "$(readlink -f "$(command -v bun)")" "$STAGE/bin/bun"
chmod 755 "$STAGE/bin/bun"
echo "staged $(du -sh "$STAGE" | cut -f1) in $STAGE"
