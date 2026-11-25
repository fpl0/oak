// Oak 2.0 W4 F5 (Getting Feedback): every A/B the learner makes plays at matched loudness. Louder often sounds
// better, so each side is turned down to the quietest one and none is ever turned up (no clipping, and a silent or
// unmeasurable side stays as it is). Only what is heard changes: the code's `.gain()` values are never read or
// written. The F2 nudge plays the same compare blind, its sides named "1" and "2" until the learner has chosen.
// The subpath, not the `@oak/audio` index: the index pulls in a worklet URL import that only Vite resolves.
import { loudness } from "@oak/audio/loudness";
import { blindOrder } from "../capstone/nudge.ts";

/** A side within this many dB of the quietest is left at gain 1 (a difference no one hears). */
const SAME_LEVEL_DB = 0.1;

/**
 * The gain of each side: every side turned down to the quietest measurable one, never up. A side within 0.1 dB of
 * the quietest, or with a non-finite level (silence, nothing measured), gets 1.
 */
export function matchedSideGains(levelsDb: readonly number[]): number[] {
  const finite = levelsDb.filter((l) => Number.isFinite(l));
  if (finite.length === 0) return levelsDb.map(() => 1);
  const quietest = Math.min(...finite);
  return levelsDb.map((l) =>
    Number.isFinite(l) && l - quietest >= SAME_LEVEL_DB ? 10 ** ((quietest - l) / 20) : 1,
  );
}

/**
 * The level a render is matched by: BS.1770 integrated loudness in LUFS (X19's `loudness`, both channels weighted
 * 1), which follows what the ear hears better than RMS does. Silence, or a render too short or too quiet to pass the
 * gates, reads `-Infinity`, and `matchedSideGains` then leaves that side at gain 1.
 */
export function levelDbOf(piece: { left: Float32Array; right: Float32Array; sampleRate: number }): number {
  return loudness({ left: piece.left, right: piece.right }, piece.sampleRate);
}

/**
 * What each side's button is called, in the order the buttons stand. Blind and not yet revealed: "1" and "2" in
 * `blindOrder(seed)`'s order, where `sides[0]` is the earlier draft and `sides[1]` the current one, and no label
 * text. Blind and revealed: the labels, in the same order (the buttons do not move). Not blind: the labels in the
 * given order.
 */
export function sideLabels(
  sides: readonly { id: string; label: string }[],
  o: { blind: boolean; revealed: boolean; seed: string },
): { id: string; shown: string }[] {
  if (!o.blind) return sides.map((s) => ({ id: s.id, shown: s.label }));
  const [earlier, current] = sides;
  if (!earlier || !current) return sides.map((s) => ({ id: s.id, shown: s.label }));
  const order = blindOrder(o.seed).map((w) => (w === "earlier" ? earlier : current));
  return order.map((s, i) => ({ id: s.id, shown: o.revealed ? s.label : String(i + 1) }));
}

/** The line under the Studio's matched version compare. */
export const MATCHED_COMPARE_LINE =
  "Both play at the same loudness: louder often sounds better, so Oak takes that out of the comparison.";
