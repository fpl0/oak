// Oak 2.0 W3 (PLAN §4 S5, S6): pieces played one after another — a sketch's siblings, a chain of generations, the
// tempo try's three tempos. Pure timing: how long one bar of a piece lasts (from its own tempo line) and where each
// item starts and ends when they follow each other with no gap. `BackToBack.tsx` plays them.
import type { MeterId } from "@oak/api";
import { labelledLines, OAK_DEFAULTS, tempoLineOf } from "@oak/content-kit";
import { barSeconds as barSecondsAt } from "@oak/theory";

/** The player's words (`BackToBack.tsx`; checked with `isDescriptive` in sequence.test.ts). */
export const BACK_TO_BACK_WORDS = {
  stop: "Stop",
  playing: (label: string, index: number, count: number) => `Playing ${label} (${index + 1} of ${count})`,
  didNotRun: (label: string) => `${label} did not run, so the player stopped there.`,
  empty: "Nothing to play yet.",
} as const;

export interface SequenceItem {
  id: string;
  /** What the player shows while this item sounds ("Parent", "Sibling 2: rhythm", "A"). */
  label: string;
  code: string;
  bars: number;
  meter: MeterId;
}

/** `92/4`, `30`, `0.5`, `2 * 15`: the number a tempo line's argument writes, or `null` for anything else. */
function numberOf(text: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:([/*])\s*(\d+(?:\.\d+)?)\s*)?$/.exec(text);
  if (!m) return null;
  const a = Number(m[1]);
  if (m[2] === undefined) return a;
  const b = Number(m[3]);
  if (m[2] === "*") return a * b;
  return b === 0 ? null : a / b;
}

/** Cycles per second of the code's tempo line (`setcpm(N/d)`, `setcps(x)`), or `null` when it has none Oak can read. */
function cpsOfCode(code: string): number | null {
  const line = tempoLineOf(code);
  if (line === null) return null;
  const m = /^(setcpm|setCpm|setcps|setCps)\s*\(([^()]*)\)/.exec(line);
  if (!m) return null;
  const value = numberOf(m[2] as string);
  if (value === null || !(value > 0)) return null;
  return m[1]?.toLowerCase() === "setcpm" ? value / 60 : value;
}

/**
 * Seconds of one bar from the code's tempo line (`setcpm(N/d)` → cps = N/d/60, one bar = one cycle);
 * OAK_DEFAULTS.bpm in `meter` when there is none (or the line names a const).
 */
export function barSeconds(code: string, meter: MeterId): number {
  const cps = cpsOfCode(code);
  return cps === null ? barSecondsAt(OAK_DEFAULTS.bpm, meter) : 1 / cps;
}

/** Where each item starts and ends, in seconds from the first one's start, played one after another. */
export function sequenceTimes(
  items: readonly Pick<SequenceItem, "code" | "bars" | "meter">[],
): { startSec: number; endSec: number }[] {
  const out: { startSec: number; endSec: number }[] = [];
  let at = 0;
  for (const item of items) {
    const end = at + Math.max(0, item.bars) * barSeconds(item.code, item.meter);
    out.push({ startSec: at, endSec: end });
    at = end;
  }
  return out;
}

/**
 * The code with every unmuted labelled line played at `gain` times its loudness (`.mul(velocity(g))`: superdough
 * multiplies a note's gain by its velocity). `gain` 1 returns the code untouched. The seam W4's matched-loudness
 * siblings fill (`BackToBack`'s `gainOf`); the player is read-only, so the learner's sketch never changes.
 */
export function withGain(code: string, gain: number): string {
  if (gain === 1 || !Number.isFinite(gain) || gain < 0) return code;
  let out = code;
  for (const line of [...labelledLines(code)].reverse()) {
    if (line.muted) continue;
    const at = line.text.endsWith(";") ? line.to - 1 : line.to;
    out = `${out.slice(0, at)}.mul(velocity(${gain}))${out.slice(at)}`;
  }
  return out;
}
