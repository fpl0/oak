// Which track version a release's take belongs to (pure; engine.ts `releaseTrack`).
import type { AlbumTrackDetail } from "@oak/api";
/** The track version that holds this draft (the newest such), else the track's current version. */
export function releasedVersionOf(
  track: Pick<AlbumTrackDetail, "currentVersion" | "versions">,
  sketchId: string,
  sketchVersion: number,
): number {
  return (
    track.versions.findLast((v) => v.sketchId === sketchId && v.sketchVersion === sketchVersion)?.version ??
    track.currentVersion
  );
}

/**
 * The draft version this editor's latest release was made from: the newest track version holding this draft
 * (AC1 puts both of its versions on one track, each from its own draft), else the track's current version. Null
 * with no track yet. A reload reads the release from here, not from the code the page opened with.
 */
export function releasedDraftOf(
  track: Pick<AlbumTrackDetail, "currentVersion" | "versions"> | null | undefined,
  draftSketchId: string | null,
): { sketchId: string; sketchVersion: number } | null {
  if (!track) return null;
  const v =
    (draftSketchId === null ? undefined : track.versions.findLast((x) => x.sketchId === draftSketchId)) ??
    track.versions.find((x) => x.version === track.currentVersion) ??
    track.versions.at(-1);
  return v ? { sketchId: v.sketchId, sketchVersion: v.sketchVersion } : null;
}

/**
 * A released piece is "Released · revising" exactly when the draft on screen differs from the code of its current
 * release, so the header chip and the "On the album" body stay true after an edit, an undo back to the release,
 * and a reload. While the released code is not known yet (it is loading), the piece reads as released: the page
 * never claims a revision it cannot show.
 */
export function releaseStandingOf(
  released: boolean,
  code: string,
  releasedCode: string | null,
): "draft" | "released" | "revising" {
  if (!released) return "draft";
  return releasedCode !== null && code !== releasedCode ? "revising" : "released";
}
