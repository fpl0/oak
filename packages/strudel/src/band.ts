// Band-layer code preparation (contracts §5.10). The Band is evaluated separately from the learner's code
// and its tracks are collected as `band.<label>`. This file holds the pure text part, and the one choice every
// playback path makes the same way (`prepareBandFor`): a unit song plays as composed by song-compose.ts, never
// through `bandCodeFor` (it keeps its own key, form and register, spec §5.2), and a plain Band as `bandCodeFor`
// prepares it.
import type { KeySpec } from "@oak/content-kit";
import { arrangeCalls, followLearnerForm } from "./band-form.ts";
import type { SongBand } from "./song-compose.ts";
import { stringArgsOf, stripComments } from "./sounds-in.ts";
import type { BandSetup } from "./types.ts";

/** "harmonic minor" → "harmonic:minor": the form Strudel's `.scale()` takes (STYLE §3). */
export const strudelMode = (mode: string): string => mode.trim().replace(/\s+/g, ":");

/** `"C4:major"`, `"F#3:harmonic:minor"`. */
export function scaleName(key: KeySpec, octave: number): string {
  return `${key.tonic}${octave}:${strudelMode(key.mode)}`;
}

const SCALE_NAME = /^([A-G][#b]?)(-?\d)?:([a-z:]+)$/;

/** Tonic and mode of the first literal `.scale("…")` in the code (the first alternative of a patterned one). */
export function firstScaleOf(code: string): { tonic: string; octave: number | null; mode: string } | null {
  for (const arg of stringArgsOf(stripComments(code), ["scale"])) {
    for (const token of arg.split(/[\s<>[\],!*@/|]+/)) {
      const m = SCALE_NAME.exec(token);
      if (m)
        return {
          tonic: m[1] as string,
          octave: m[2] === undefined ? null : Number(m[2]),
          mode: m[3] as string,
        };
    }
  }
  return null;
}

/** The BPM of the code's own `setcpm(bpm/units)` line, or null. */
export function tempoOf(code: string): { bpm: number; unitsPerBar: number } | null {
  const m = /(?:^|[^A-Za-z0-9_$.])setcpm\(\s*([0-9.]+)\s*(?:\/\s*([0-9.]+)\s*)?\)/i.exec(stripComments(code));
  if (!m) return null;
  const bpm = Number(m[1]);
  const units = m[2] === undefined ? 1 : Number(m[2]);
  return Number.isFinite(bpm) && Number.isFinite(units) && units > 0 ? { bpm, unitsPerBar: units } : null;
}

export interface BandContext {
  /** The step's key (`LessonCtx.key`). */
  key: KeySpec | null;
  defaultBpm: number;
  /** The learner's code of this evaluation. */
  learnerCode: string;
}

const LETTER_SEMIS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Half steps from C up to a tonic in the same octave number: `F#` 6, `Cb` −1, `B#` 12. */
export function tonicOffset(tonic: string): number {
  const letter = LETTER_SEMIS[tonic.charAt(0).toUpperCase()] ?? 0;
  let acc = 0;
  for (const ch of tonic.slice(1)) acc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return letter + acc;
}

/**
 * The octave number that puts `tonic` in the register a Band was written for at `octave` (contracts §5.10).
 * Band code is written in C: its `{{key}}` is filled as `<tonic>4:<mode>` and its parts are degrees below
 * that tonic. Read literally, F♯4 to B4 would lift the whole Band up to a fifth above C4, so the octave is
 * folded: the tonic lands within a tritone below to a fourth above the C of that octave (F♯ to B go down
 * one, C to F stay). `bandOctave("G", 4)` is 3; `bandOctave("F", 4)` is 4; `bandOctave("Cb", 4)` is 4.
 */
export function bandOctave(tonic: string, octave: number): number {
  return octave - Math.floor((tonicOffset(tonic) + 6) / 12);
}

/** A scale name with an octave (`G4:major`, `F#3:harmonic:minor`), wherever it sits in a mini-notation string. */
const SCALE_TOKEN = /(^|[^A-Za-z0-9#])([A-G](?:#|b)*)(-?\d+)(:[a-z]+(?::[a-z]+)*)/g;
/** A `.scale("…")` call's string argument. */
const SCALE_CALL = /(\.scale\(\s*)(["'`])([^"'`]*)\2/g;

/** Every scale name in the Band's `.scale()` strings, moved to the octave of its register (`bandOctave`). */
export function foldBandRegister(code: string): string {
  return code.replace(
    SCALE_CALL,
    (_all, open: string, quote: string, arg: string) =>
      `${open}${quote}${arg.replace(
        SCALE_TOKEN,
        (_t, lead: string, tonic: string, oct: string, rest: string) =>
          `${lead}${tonic}${bandOctave(tonic, Number(oct))}${rest}`,
      )}${quote}`,
  );
}

/** The distinct keys (`C:major`) a `.scale()` argument names. */
function keysOf(arg: string): Set<string> {
  const names = new Set<string>();
  for (const token of arg.split(/[\s<>[\],!*@/|]+/)) {
    const m = SCALE_NAME.exec(token);
    if (m) names.add(`${m[1]}:${m[3]}`);
  }
  return names;
}

/** The text of `const <ident> = …`, up to the next statement at the start of a line. */
function constBodyOf(text: string, ident: string): string | null {
  const m = new RegExp(`(?:^|\\n)\\s*(?:const|let|var)\\s+${escapeRe(ident)}\\s*=`).exec(text);
  if (!m) return null;
  const from = m.index + m[0].length;
  const next = /\n\s*(?:(?:const|let|var)\s|[A-Za-z_$][\w$]*\s*:|setcp[ms]\s*\()/.exec(text.slice(from));
  return text.slice(from, next ? from + next.index : undefined);
}

/**
 * The learner's key plan as one `.scale()` argument, or null when the code stays in one key (or names none).
 *
 * Contracts §6.8 item 4 gives a key change two forms, and the Band follows both:
 *  - the plan after `arrange()`: `.scale("<C4:major!16 D4:major!8>")`. The first `.scale()` argument that names
 *    more than one key is the plan, on whichever track it stands (a bass in one key above it does not hide it);
 *  - a lifted section const: `const melChorus2 = n("…").scale("D4:major")` beside sections in C. The plan is read
 *    from the first arranged track whose sections carry their own single key, a section without one (a rest, or a
 *    const with no `.scale()`) staying in the key before it.
 */
export function learnerKeyPlanOf(code: string): string | null {
  const text = stripComments(code);
  for (const arg of stringArgsOf(text, ["scale"])) if (keysOf(arg).size > 1) return arg;
  for (const call of arrangeCalls(text)) {
    if (!call.sections) continue;
    const keys = call.sections.map((s) => {
      const body = s.ident === "silence" ? null : constBodyOf(text, s.ident);
      if (!body) return null;
      for (const arg of stringArgsOf(body, ["scale"])) {
        const m = SCALE_NAME.exec(arg.trim());
        if (m) return `${m[1]}${m[2] ?? "4"}:${m[3]}`;
      }
      return null;
    });
    const first = keys.find((k) => k !== null);
    if (
      !first ||
      new Set(keys.filter((k) => k !== null).map((k) => (k as string).replace(/-?\d+:/, ":"))).size < 2
    )
      continue;
    // Runs of bars in one key, in order.
    const runs: { key: string; bars: number }[] = [];
    let current = first;
    call.sections.forEach((s, i) => {
      current = keys[i] ?? current;
      const last = runs[runs.length - 1];
      if (last && last.key === current) last.bars += s.bars;
      else runs.push({ key: current, bars: s.bars });
    });
    if (runs.some((r) => !Number.isInteger(r.bars))) continue;
    return `<${runs.map((r) => `${r.key}!${r.bars}`).join(" ")}>`;
  }
  return null;
}

/** MIDI pitch of a tonic at an octave number (`C4` is 60). */
const tonicPitch = (tonic: string, octave: number): number => 12 * (octave + 1) + tonicOffset(tonic);

/** The widest move (half steps) that counts as a lift: a key a half or a whole step from the one before. */
export const LIFT_STEP = 2;

/**
 * The learner's key plan for a Band line written at `octave`. Every key takes the Band's register (`bandOctave`:
 * the tonic within a tritone below to a fourth above C), except a key one step from the key before it (a half or
 * a whole step, the lift of U17.L02): that one takes the octave nearest the last tonic, so a lift is a lift. F to
 * G rises a whole step instead of falling a seventh into the fold, and F to F♯ a half step instead of falling a
 * major seventh. Any wider move goes back to the register, so a plan that walks through many keys never drifts.
 */
export function keyPlanAt(arg: string, octave: number): string {
  let prev: number | null = null;
  return arg.replace(
    /(^|[^A-Za-z0-9#])([A-G](?:#|b)*)(-?\d+)?(:[a-z]+(?::[a-z]+)*)/g,
    (_t, lead: string, tonic: string, _o: string | undefined, rest: string) => {
      let oct = bandOctave(tonic, octave);
      if (prev !== null) {
        const from = prev;
        const near = [oct - 1, oct, oct + 1].sort(
          (a, b) => Math.abs(tonicPitch(tonic, a) - from) - Math.abs(tonicPitch(tonic, b) - from),
        )[0] as number;
        const move = Math.abs(tonicPitch(tonic, near) - from);
        if (move > 0 && move <= LIFT_STEP) oct = near;
      }
      prev = tonicPitch(tonic, oct);
      return `${lead}${tonic}${oct}${rest}`;
    },
  );
}

/**
 * The Band code to evaluate next to the learner's code.
 *
 * - Leftover `{{key}}` and `{{bpm}}` placeholders are filled (the step's key at octave 4, the learner's
 *   tempo or the lesson default).
 * - With `followsLearnerKey`, every scale name in the Band that carries the step's tonic and mode is
 *   re-written to the tonic and mode of the learner's first `.scale()`, keeping the Band's octaves. When
 *   the learner's code has a key plan (`learnerKeyPlanOf`: a patterned `.scale("<C4:major!16 D4:major!8>")` on any
 *   track, or a lifted section const), a Band line in one key takes the whole plan, so the Band changes key with
 *   the tune; a key a step above the last is played a step higher, never a seventh lower (`keyPlanAt`).
 * - A Band written in sections (one `arrange()` per labelled track) follows the learner's sections: their order
 *   and bar counts, each played by the Band's section of the same type (`followLearnerForm`, band-form.ts).
 * - Last, the register is folded (`foldBandRegister`): in G, A or B the Band sits below C, not a fifth above.
 */
export function bandCodeFor(band: BandSetup, ctx: BandContext): string {
  const learner = band.followsLearnerKey ? firstScaleOf(ctx.learnerCode) : null;
  const pattern = band.followsLearnerKey ? learnerKeyPlanOf(ctx.learnerCode) : null;
  const stepKey = ctx.key ? { tonic: ctx.key.tonic, mode: strudelMode(ctx.key.mode) } : null;
  const target = learner ? { tonic: learner.tonic, mode: learner.mode } : stepKey;
  let code = band.code;
  if (code.includes("{{key}}")) {
    const key = target ?? { tonic: "C", mode: "major" };
    code = code.replaceAll("{{key}}", `${key.tonic}4:${key.mode}`);
  }
  if (code.includes("{{bpm}}")) {
    const tempo = tempoOf(ctx.learnerCode);
    code = code.replaceAll("{{bpm}}", String(tempo?.bpm ?? ctx.defaultBpm));
  }
  const planned: number[] = [];
  if (pattern) {
    // A Band line in one key (`.scale("C4:major")`) takes the learner's whole key plan at its own octave. The plan
    // is put in after the register fold, which would otherwise fold each of its keys on its own.
    code = code.replace(SCALE_CALL, (all, open: string, quote: string, arg: string) => {
      const m = SCALE_NAME.exec(arg.trim());
      if (!m || m[2] === undefined) return all;
      planned.push(Number(m[2]));
      return `${open}${quote}${PLAN_MARK}${planned.length - 1}${PLAN_MARK}${quote}`;
    });
  } else if (learner && stepKey && (learner.tonic !== stepKey.tonic || learner.mode !== stepKey.mode)) {
    const from = new RegExp(
      `(^|[^A-Za-z#])${escapeRe(stepKey.tonic)}(-?\\d):${escapeRe(stepKey.mode)}(?![a-z:])`,
      "g",
    );
    code = code.replace(
      from,
      (_all, lead: string, octave: string) => `${lead}${learner.tonic}${octave}:${learner.mode}`,
    );
  }
  code = foldBandRegister(followLearnerForm(code, ctx.learnerCode));
  if (!pattern) return code;
  return code.replace(new RegExp(`${PLAN_MARK}(\\d+)${PLAN_MARK}`, "g"), (_all, i: string) =>
    keyPlanAt(pattern, planned[Number(i)] as number),
  );
}

/** Stands in a Band line's `.scale()` for the learner's key plan until the register fold has run. */
const PLAN_MARK = "\u0001";

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** What an evaluation plays for a Band setup: Band code and the labels it keeps, or a unit song. */
export type PreparedBand =
  | { kind: "code"; code: string; roles: string[] }
  | {
      kind: "song";
      song: SongBand;
      /** The evaluation's own code: the live Make when the song has one. */
      liveCode: string;
    };

/**
 * The one preparation every playback path uses (editor, pattern player, offline export, Workbench analysis): a setup
 * with a `song` plays the song (composed around the evaluation's own code), any other setup the Band code as
 * `bandCodeFor` prepares it, keeping only `tracks` (all labels when `tracks` is empty). The caller lints Band code
 * with the Band profile; a song checks its own codes when it is evaluated (`evaluateSongBand`).
 */
export function prepareBandFor(band: BandSetup, ctx: BandContext): PreparedBand {
  if (band.song) return { kind: "song", song: band.song, liveCode: ctx.learnerCode };
  return { kind: "code", code: bandCodeFor(band, ctx), roles: [...band.tracks] };
}

/** The Band tracks an evaluation keeps: only the roles the step asked for. */
export function bandTrackName(label: string): string {
  return `band.${label}`;
}
