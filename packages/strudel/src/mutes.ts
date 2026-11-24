// UI mute and solo (contracts §6.2 rule 3): a live predicate, never a code rewrite.
import type { MuteMap } from "./types.ts";

export const NO_MUTES: MuteMap = Object.freeze({ muted: new Set<string>(), solo: null });

/** Solo wins: with a solo set, every other track is silent, Band tracks included. */
export function isMuted(track: string, mutes: MuteMap): boolean {
  if (mutes.solo !== null) return track !== mutes.solo;
  return mutes.muted.has(track);
}

/** A private copy, so a caller mutating its own Set or Map later cannot change what plays. */
export function copyMutes(mutes: MuteMap): MuteMap {
  return {
    muted: new Set(mutes.muted),
    solo: mutes.solo,
    ...(mutes.hits && mutes.hits.size > 0 && { hits: new Map(mutes.hits) }),
  };
}

/** Whether one hap of a Band track is muted: the whole track (`isMuted`), or this hit by its sound (`hits`). */
export function isBandHapMuted(track: string, value: unknown, mutes: MuteMap): boolean {
  if (isMuted(track, mutes)) return true;
  const hit = mutes.hits?.get(track);
  if (!hit) return false;
  const s = value && typeof value === "object" ? (value as Record<string, unknown>).s : undefined;
  return typeof s === "string" && hit(s);
}

/**
 * How `repl.mjs` 1.2.6 names a labelled pattern: `x_` and `_x` are muted in code (never registered), a
 * label containing `$` gets the running anonymous index appended (`$:` → `$0`, `$1`, …).
 */
export function trackNameOf(
  label: string,
  anonymousIndex: number,
): { track: string | null; anonymous: boolean } {
  if (label.startsWith("_") || label.endsWith("_")) return { track: null, anonymous: false };
  if (label.includes("$")) return { track: `${label}${anonymousIndex}`, anonymous: true };
  return { track: label, anonymous: false };
}
