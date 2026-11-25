// Oak 2.0 W3 (PLAN §4 S6, "Choosing a Tempo"): tempo try. The learner's loop plays at its own tempo, 8 BPM slower and
// 8 BPM faster (PLAN S6's −8 / 0 / +8), as A, B and C in a shuffled order with the BPM hidden; the learner picks one by
// feel, and only then does Oak name its BPM ("B was 104 BPM."). "Use it" writes that tempo line (one undoable change);
// "Keep mine" changes nothing. Never a recommendation. Pure: tested in tempo-try.test.ts.
import { tempoLineOf } from "@oak/api";
import type { MeterId } from "@oak/content-kit";
import { cpmToBpm, tempoLine } from "@oak/theory";
import { OAK_DEFAULTS } from "./model.ts";

/** PLAN S6's step: the loop is also played this many BPM slower and faster. */
export const TEMPO_TRY_STEP = 8;
/** The tempos the New sketch dialog offers (its tempo field): a variant outside them is left out. */
export const TEMPO_TRY_MIN = 40;
export const TEMPO_TRY_MAX = 240;
/** Bars each option plays. Oak's call: long enough to feel the groove, short enough to compare three. */
export const TEMPO_TRY_BARS = 2;

export type TempoOffset = -8 | 0 | 8;
export const TEMPO_OFFSETS: readonly TempoOffset[] = [-TEMPO_TRY_STEP, 0, TEMPO_TRY_STEP] as TempoOffset[];
export type TempoOptionName = "A" | "B" | "C";
export interface TempoOption {
  name: TempoOptionName;
  bpm: number;
  code: string;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** The BPM of the code's first tempo statement (`setcpm(96/4)` in 4/4 is 96; `setcps(…)` too), or `null`. */
export function tempoOfCode(code: string, meter: MeterId): number | null {
  const line = tempoLineOf(code);
  if (line === null) return null;
  const m = /^set(cpm|cps)\s*\(\s*([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/i.exec(line);
  if (!m) return null;
  const a = Number(m[2]);
  const b = m[3] === undefined ? 1 : Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0 || a <= 0) return null;
  const cpm = m[1]?.toLowerCase() === "cps" ? (a / b) * 60 : a / b;
  return round1(cpmToBpm(cpm, meter));
}

/** The BPM the code plays at: its tempo line's, else Oak's default tempo. */
export function bpmOfCode(code: string, meter: MeterId): number {
  return tempoOfCode(code, meter) ?? OAK_DEFAULTS.bpm;
}

/** Where the first tempo statement starts: at the start of a line (after indent), outside a `//` comment. */
function tempoStart(code: string, statement: string): number {
  let from = 0;
  for (;;) {
    const i = code.indexOf(statement, from);
    if (i < 0) return -1;
    const lineStart = code.lastIndexOf("\n", i - 1) + 1;
    if (code.slice(lineStart, i).trim() === "") return i;
    from = i + 1;
  }
}

/**
 * The code at `bpm`: its first tempo statement replaced by `tempoLine(bpm, meter)`, every other byte unchanged; with
 * no tempo statement the tempo line and a blank line go first.
 */
export function withTempo(code: string, bpm: number, meter: MeterId): string {
  const line = tempoLine(bpm, meter);
  const statement = tempoLineOf(code);
  const at = statement === null ? -1 : tempoStart(code, statement);
  if (statement === null || at < 0) return `${line}\n\n${code}`;
  return code.slice(0, at) + line + code.slice(at + statement.length);
}

/**
 * The options in `order` (offsets from the code's tempo), named A, B, C in that order. A variant below
 * TEMPO_TRY_MIN or above TEMPO_TRY_MAX is left out (the names stay consecutive).
 */
export function tempoTryOptions(code: string, meter: MeterId, order: readonly TempoOffset[]): TempoOption[] {
  const own = tempoOfCode(code, meter);
  const base = own ?? OAK_DEFAULTS.bpm;
  const names: TempoOptionName[] = ["A", "B", "C"];
  const out: TempoOption[] = [];
  for (const offset of order) {
    const bpm = round1(base + offset);
    if (bpm < TEMPO_TRY_MIN || bpm > TEMPO_TRY_MAX) continue;
    const name = names[out.length];
    if (name === undefined) break;
    // The learner's own tempo plays their code as it is.
    out.push({ name, bpm, code: offset === 0 && own !== null ? code : withTempo(code, bpm, meter) });
  }
  return out;
}

/** A shuffled order of the three offsets (Fisher–Yates over `rng`, `Math.random` in the app). */
export function shuffledOffsets(rng: () => number): TempoOffset[] {
  const a = [...TEMPO_OFFSETS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const t = a[i] as TempoOffset;
    a[i] = a[j] as TempoOffset;
    a[j] = t;
  }
  return a;
}

/** Every string of the tempo try (descriptive: tempo-try.test.ts). No option label names a tempo before the pick. */
export const TEMPO_TRY_WORDS = {
  button: "Tempo try",
  intro:
    "Your loop at three tempos, in a shuffled order, with the BPM hidden. Pick the one that feels right.",
  play: "Play A, B and C",
  option: (name: TempoOptionName) => `Option ${name}`,
  pick: (name: TempoOptionName) => `I pick ${name}`,
  reveal: (name: TempoOptionName, bpm: number) => `${name} was ${bpm} BPM.`,
  yours: (bpm: number) => `Your loop is at ${bpm} BPM.`,
  use: "Use it",
  keep: "Keep mine",
  again: "Try again",
  close: "Close",
  nothingToPlay: "Write a line and Run it first; tempo try plays your loop.",
} as const;
