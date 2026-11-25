// Oak 2.0 W4 (W1 gap 1; PLAN S7 Rendering as Commitment: "a capstone can commit after its sound session"): after a
// completed session of a multi-session capstone, the learner may commit the sounds of every part, so the next
// sessions arrange and mix. No session is tagged as the sound session, so the offer follows any completed session
// before the last (Oak's call, "Calls to check" 11). It never blocks a Run, a check or a release; a later edit to a
// committed sound is noticed and asked about with W1's words (`soundChanges`, `restoreSound`). Pure.
import type { Sketch } from "@oak/api";
import { COMMIT_LINKS, labelledLines, soundSettingsOf } from "@oak/content-kit";

/** One committed line of a sketch (`Sketch.committed`, `sketches.patch`). */
export type SketchCommitted = NonNullable<Sketch["committed"]>[number];

/**
 * The unmuted labelled lines that have a sound to commit (a non-empty `soundSettingsOf` over `COMMIT_LINKS`: a drum
 * line's `s("bd")` is its rhythm, not a sound setting, and `gain`/`pan` are the mix, left open) and no committed entry
 * yet, in source order, each label once.
 */
export function uncommittedLabels(
  code: string,
  committed: readonly { label: string; version: number }[],
): string[] {
  const done = new Set(committed.map((c) => c.label));
  const out: string[] = [];
  for (const line of labelledLines(code)) {
    if (line.muted || done.has(line.label) || out.includes(line.label)) continue;
    if (soundSettingsOf(line.text, COMMIT_LINKS) !== "") out.push(line.label);
  }
  return out;
}

/** Every part's sound committed as it is in `version`: the existing entries kept, the new ones after them. */
export function commitAll(
  code: string,
  version: number,
  at: string,
  committed: readonly SketchCommitted[],
): SketchCommitted[] {
  return [...committed, ...uncommittedLabels(code, committed).map((label) => ({ label, version, at }))];
}

/**
 * "Commit the sounds" commits the code the learner hears, not the last autosave (W5 F2): when the live code is ahead
 * of the saved version, the pending save is flushed first (`saveNow`) and the commit names the version it returns,
 * so a sound changed a moment before the click is committed as heard and is not at once read back as changed.
 * `null` before the draft's first save: the card asks for a Run instead.
 */
export async function commitHeard(o: {
  liveCode: string;
  savedVersion: number | null;
  savedCode: string | null;
  saveNow: (code: string) => Promise<number>;
  at: string;
  committed: readonly SketchCommitted[];
}): Promise<SketchCommitted[] | null> {
  if (o.savedVersion === null) return null;
  const version = o.savedCode === o.liveCode ? o.savedVersion : await o.saveNow(o.liveCode);
  return commitAll(o.liveCode, version, o.at, o.committed);
}

/** After a completed session, before the last, while the piece is not released and a part has a sound to commit. */
export function showCommitOffer(o: {
  sessionsDone: number;
  total: number;
  released: boolean;
  uncommitted: number;
}): boolean {
  return o.sessionsDone >= 1 && o.sessionsDone < o.total && !o.released && o.uncommitted > 0;
}

export const COMMIT_SESSION_COPY = {
  offer: "Happy with how the parts sound? Commit them, so the next sessions arrange and mix.",
  commit: "Commit the sounds",
  committed: "The sounds are committed. Changing one asks first.",
  needsSave: "Run the draft once so it is saved, then commit its sounds.",
  failed: "The sounds could not be committed. Try again.",
} as const;
