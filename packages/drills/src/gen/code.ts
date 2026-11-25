// Code families (contracts §7.3): `fam.code.mini`, mini-notation, and `fam.code.functions`, "which code
// made this?". Both are concept families: the learner hears a short pattern and either writes it as
// mini-notation or picks, among near-miss candidates, the code that plays it. Every candidate is a real
// piece of code the learner could have typed with the tools of the open categories, and no two candidates
// sound the same (they are compared on the onsets and pitches they play, which is what the ear gets).
import type { Answer, KeySpec, Md, Trial } from "@oak/content-kit";
import { buildPiece } from "../build.ts";
import { type DrillTrialResult, gradeAnswer } from "../grade.ts";
import { keysFor, parsePc, spellMidi, stepToMidi } from "../kernel.ts";
import { parseMini, parseMiniCode } from "../mini.ts";
import { atom, type Node, print, query, rest, seq, stack } from "../pat.ts";
import type { Rng, TrialResponse } from "../types.ts";
import {
  cueOf,
  type GenCtx,
  type Generator,
  jitter,
  pickKey,
  pickKit,
  pickSound,
  pickTempo,
  trialOf,
} from "./common.ts";

// --- shared -------------------------------------------------------------------------------------

/** What the ear gets from a candidate: its onsets with their sound or pitch, sorted. */
type Signature = string;
const signatureOf = (events: readonly { t: number; v: string | number }[]): Signature =>
  events
    .map((e) => `${Math.round(e.t * 960)}|${e.v}`)
    .sort()
    .join(" ");

/**
 * A "which code" trial: the correct candidate plus up to `count − 1` distractors, each distinct by ear from
 * the correct one and from each other. Near misses come first (`near`), then siblings (`far`).
 */
export function pickCandidates<T extends { code: string; sig: Signature }>(
  rng: Rng,
  correct: T,
  near: readonly T[],
  far: readonly T[],
  count: number,
): T[] {
  const out: T[] = [correct];
  const seen = new Set([correct.sig]);
  const codes = new Set([correct.code]);
  for (const pool of [rng.shuffle(near), rng.shuffle(far)])
    for (const c of pool) {
      if (out.length >= count) break;
      if (seen.has(c.sig) || codes.has(c.code)) continue;
      seen.add(c.sig);
      codes.add(c.code);
      out.push(c);
    }
  return out;
}

const PROMPT_WRITE: Md = "Write this rhythm in mini-notation.";
const PROMPT_PICK_RHYTHM: Md = "Which code plays this rhythm?";
const PROMPT_PICK_CODE: Md = "Which code made this?";

// --- fam.code.mini ------------------------------------------------------------------------------

/** The mini-notation operators of the family, one category each (contracts §7.3, the unlock table §3). */
export const MINI_OPS = [
  "seq",
  "repeat",
  "rest",
  "sub",
  "elongate",
  "hold",
  "replicate",
  "alt",
  "stack",
  "euclid",
  "polymeter",
] as const;
export type MiniOp = (typeof MINI_OPS)[number];

/** The operators a mini-notation string uses (a bracket with a comma inside is a stack, not a subdivision). */
export function miniOpsOf(text: string): Set<MiniOp> {
  const ops = new Set<MiniOp>(["seq"]);
  if (/\*/.test(text)) ops.add("repeat");
  if (/~/.test(text)) ops.add("rest");
  if (/@/.test(text)) ops.add("elongate");
  if (/(^|\s)_(\s|$)/.test(text)) ops.add("hold");
  if (/!/.test(text)) ops.add("replicate");
  if (/</.test(text)) ops.add("alt");
  if (/\{/.test(text)) ops.add("polymeter");
  if (/\(/.test(text)) ops.add("euclid");
  // Brackets: a top-level comma is a stack; a bracket group with a comma is a stack, else a subdivision.
  let depth = 0;
  const groupComma: boolean[] = [];
  for (const ch of text) {
    if (ch === "[" || ch === "<" || ch === "{") {
      depth++;
      if (ch === "[") groupComma.push(false);
      else groupComma.push(true);
    } else if (ch === "]" || ch === ">" || ch === "}") {
      const had = groupComma.pop();
      if (ch === "]") ops.add(had ? "stack" : "sub");
      depth--;
    } else if (ch === ",") {
      if (depth === 0) ops.add("stack");
      else if (groupComma.length > 0) groupComma[groupComma.length - 1] = true;
    }
  }
  return ops;
}

interface MiniCand {
  code: string;
  sig: Signature;
  ops: Set<MiniOp>;
}
/** Cycles a pattern needs before it repeats (alternation and polymeter span several bars). */
function cyclesOf(node: Node): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
  switch (node.t) {
    case "atom":
    case "rest":
      return 1;
    case "seq":
    case "stack":
      return node.items.reduce((m, i) => lcm(m, cyclesOf(i)), 1);
    case "alt":
      return node.items.reduce((m, i) => lcm(m, cyclesOf(i)), 1) * node.items.length;
  }
}
function miniCand(code: string, bars: number): MiniCand | null {
  try {
    const node = parseMini(code);
    const ev = query(node, bars).map((e) => ({ t: e.onset[0] / e.onset[1], v: e.v }));
    if (ev.length === 0) return null;
    return { code, sig: signatureOf(ev), ops: miniOpsOf(code) };
  } catch {
    return null;
  }
}

/** Drum words by role: kick, backbeat and timekeeper (all unlocked at U01.L01–L02). */
interface Kit {
  k: string;
  s: string;
  h: string;
  x: string;
}
function pickWords(rng: Rng): Kit {
  const s = rng.pick(["sd", "cp", "rim"]);
  const h = rng.pick(["hh", "hh", "oh"]);
  const x = rng.pick(["sd", "cp", "rim", "hh"].filter((w) => w !== s && w !== h));
  return { k: "bd", s, h, x };
}

type Template = (rng: Rng, w: Kit, allow: (op: MiniOp) => boolean) => string;
/** One generator per operator: a short, idiomatic pattern that needs that operator. */
const MINI_TEMPLATES: Readonly<Record<MiniOp, Template>> = {
  seq: (rng, w) =>
    rng.pick([
      `${w.k} ${w.s}`,
      `${w.k} ${w.s} ${w.k} ${w.s}`,
      `${w.k} ${w.h} ${w.s} ${w.h}`,
      `${w.k} ${w.k} ${w.s}`,
      `${w.h} ${w.s} ${w.k}`,
    ]),
  repeat: (rng, w) => {
    const n = rng.pick([2, 3, 4]);
    return rng.pick([
      `${w.k}*${n} ${w.s}`,
      `${w.k} ${w.s}*${n}`,
      `${w.h}*${2 * n}`,
      `${w.k} ${w.h}*${n} ${w.s}`,
    ]);
  },
  rest: (rng, w) =>
    rng.pick([
      `${w.k} ~ ${w.s} ~`,
      `${w.k} ~ ~ ${w.s}`,
      `~ ${w.s} ~ ${w.s}`,
      `${w.k} ${w.k} ~ ${w.s}`,
      `${w.k} ~ ${w.s}`,
    ]),
  sub: (rng, w, allow) =>
    rng.pick([
      `${w.k} [${w.s} ${w.s}]`,
      `[${w.k} ${w.k}] ${w.s}`,
      `${w.k} ${w.s} [${w.k} ${w.k}] ${w.s}`,
      allow("rest") ? `${w.k} [~ ${w.k}] ${w.s} ~` : `${w.k} [${w.h} ${w.k}] ${w.s} ${w.h}`,
      `${w.k} [${w.s} ${w.h} ${w.h}]`,
    ]),
  elongate: (rng, w) => {
    const n = rng.pick([2, 3]);
    return rng.pick([
      `${w.k}@${n} ${w.s}`,
      `${w.k} ${w.s}@${n}`,
      `${w.k}@2 ${w.s} ${w.h}`,
      `${w.k} ${w.h}@${n} ${w.s}`,
    ]);
  },
  hold: (rng, w) =>
    rng.pick([`${w.k} _ ${w.s}`, `${w.k} _ _ ${w.s}`, `${w.k} ${w.s} _ ${w.h}`, `${w.k} _ ${w.s} ${w.s}`]),
  replicate: (rng, w) => {
    const n = rng.pick([2, 3]);
    return rng.pick([
      `${w.k}!${n} ${w.s}`,
      `${w.k} ${w.s}!${n}`,
      `${w.k}!2 ${w.s}!2`,
      `${w.k} ${w.h}!${n} ${w.s}`,
    ]);
  },
  alt: (rng, w, allow) =>
    rng.pick([
      `${w.k} <${w.s} ${w.x}>`,
      `${w.k} ${w.s} <${w.k} ${w.h}> ${w.s}`,
      allow("repeat") ? `<${w.k} ${w.k}*2> ${w.s}` : `<${w.k} ${w.h}> ${w.s}`,
      `${w.k} <${w.s} ${w.s} ${w.x}>`,
    ]),
  stack: (rng, w, allow) => {
    const forms = [`${w.k} ${w.s}, ${w.h} ${w.h} ${w.h} ${w.h}`, `${w.k}, ${w.h} ${w.h}`];
    if (allow("repeat")) forms.push(`${w.k}*2, ${w.h}*4`, `${w.k} ${w.s}, ${w.h}*8`);
    if (allow("sub")) forms.push(`[${w.k},${w.h}] ${w.s}`);
    return rng.pick(forms);
  },
  euclid: (rng, w, allow) => {
    const forms = [`${w.k}(3,8)`, `${w.k}(5,8)`, `${w.k}(3,8,${rng.pick([1, 2])})`, `${w.k}(3,8) ${w.s}`];
    if (allow("stack") && allow("repeat")) forms.push(`${w.k}(3,8), ${w.h}*8`);
    return rng.pick(forms);
  },
  polymeter: (rng, w) =>
    rng.pick([`{${w.k} ${w.s} ${w.h}}%4`, `{${w.k} ${w.h} ${w.h}}%4`, `{${w.k} ${w.s} ${w.s} ${w.h}}%3`]),
};

/** Near misses of a mini string: one number off by one, one operator swapped for a look-alike, two steps swapped. */
export function miniMutations(code: string): string[] {
  const out = new Set<string>();
  // One number off by one (repeat, elongate, replicate, Euclid, polymeter step counts).
  const nums = [...code.matchAll(/\d+/g)];
  for (const m of nums) {
    const n = Number(m[0]);
    for (const d of [-1, 1]) {
      if (n + d < 1) continue;
      out.add(code.slice(0, m.index) + String(n + d) + code.slice((m.index as number) + m[0].length));
    }
  }
  // Look-alike operators: x!n, x*n and x@n are the classic confusion; < > against [ ]; a stack against a sequence.
  for (const [a, b] of [
    ["!", "*"],
    ["!", "@"],
    ["*", "!"],
    ["*", "@"],
    ["@", "!"],
    ["@", "*"],
  ] as const)
    if (code.includes(a)) out.add(code.replace(a, b));
  if (code.includes("<")) out.add(code.replace("<", "[").replace(">", "]"));
  if (/\[[^\],]*\]/.test(code)) out.add(code.replace(/\[([^\],]*)\]/, "$1"));
  if (code.includes(", ")) out.add(code.replace(", ", " "));
  if (/\{.*\}%\d+/.test(code)) out.add(code.replace(/\{(.*)\}%\d+/, "[$1]"));
  if (/\(\d+,\d+,\d+\)/.test(code)) out.add(code.replace(/\((\d+),(\d+),\d+\)/, "($1,$2)"));
  // Two neighbouring steps of the top level swapped.
  const steps = code.split(" ");
  if (!/[[<{(,]/.test(code))
    for (let i = 0; i + 1 < steps.length; i++) {
      const s = [...steps];
      [s[i], s[i + 1]] = [s[i + 1] as string, s[i] as string];
      out.add(s.join(" "));
    }
  // A rest moved or removed.
  if (code.includes("~")) out.add(code.replace(/ ~|~ /, ""));
  out.delete(code);
  return [...out];
}

const MINI_PREFERENCE: readonly MiniOp[] = MINI_OPS;

/** Grades a written answer on onsets and drum words (which drum plays matters here). */
function gradeMiniWrite(trial: Trial<Answer>, response: TrialResponse): DrillTrialResult {
  const base = { rtMs: response.rtMs, replays: response.replays };
  if (response.skipped) return { ...base, credit: 0, correct: false, diagnostics: [], skipped: true };
  const bars = Number(trial.params.answerBars ?? 1);
  const text = response.answer?.text?.[0];
  if (text === undefined || text.trim() === "")
    return {
      ...base,
      credit: 0,
      correct: false,
      diagnostics: [{ id: "rhythm.missing", severity: "error", params: { n: trial.events.length } }],
    };
  const parsed = parseMiniCode(text, bars);
  if (!parsed.ok)
    return {
      ...base,
      credit: 0,
      correct: false,
      diagnostics: [{ id: "eval.mini-parse", severity: "error", params: { line: 1, detail: parsed.error } }],
    };
  const want = new Map<string, number>();
  for (const e of trial.events) {
    const k = `${Math.round((e.onset[0] / e.onset[1]) * 960)}|${e.s}`;
    want.set(k, (want.get(k) ?? 0) + 1);
  }
  let hits = 0;
  for (const e of parsed.events) {
    const k = `${Math.round(e.t * 960)}|${e.v}`;
    const n = want.get(k) ?? 0;
    if (n > 0) {
      hits++;
      want.set(k, n - 1);
    }
  }
  const total = trial.events.length + parsed.events.length;
  const f1 = total === 0 ? 1 : (2 * hits) / total;
  const diagnostics: DrillTrialResult["diagnostics"] = [];
  if (hits < trial.events.length)
    diagnostics.push({ id: "rhythm.missing", severity: "error", params: { n: trial.events.length - hits } });
  if (hits < parsed.events.length)
    diagnostics.push({ id: "rhythm.extra", severity: "error", params: { n: parsed.events.length - hits } });
  return { ...base, credit: f1, correct: f1 >= 0.999, diagnostics };
}

export const codeMini: Generator = {
  name: "code-mini",
  generate(ctx) {
    const op = ctx.category as MiniOp;
    // Only operators the learner has been taught: the level's categories that are open, and this one.
    const open = new Set<MiniOp>(
      MINI_OPS.filter(
        (o) =>
          o === "seq" || o === op || (ctx.openCategories.includes(o) && ctx.level.categories.includes(o)),
      ),
    );
    const allow = (o: MiniOp): boolean => open.has(o);
    const words = pickWords(ctx.rng);
    const template = MINI_TEMPLATES[op] ?? MINI_TEMPLATES.seq;
    let code = template(ctx.rng, words, allow);
    for (let i = 0; i < 12 && ![...miniOpsOf(code)].every(allow); i++) code = template(ctx.rng, words, allow);
    const node = parseMini(code);
    const period = cyclesOf(node);
    const bars = period === 1 ? 2 : period;
    const bank = pickKit(ctx);
    const piece = buildPiece({
      bpm: pickTempo(ctx),
      bars,
      tracks: [{ label: "drums", src: "s", pat: node, gain: jitter(ctx, 0.8), ...(bank ? { bank } : {}) }],
    });
    const writeShare = ctx.levelNo <= 1 ? 0.25 : ctx.levelNo <= 2 ? 0.35 : 0.5;
    if (ctx.rng.next() < writeShare) {
      return trialOf(piece, { text: [code] }, cueOf(ctx), {
        mode: "code",
        ui: "code",
        starter: 's("")',
        answerTrack: "drums",
        answerBars: bars,
        prompt: PROMPT_WRITE,
        op,
      });
    }
    const correct = miniCand(code, bars) as MiniCand;
    const near = miniMutations(code)
      .map((c) => miniCand(c, bars))
      .filter((c): c is MiniCand => c !== null && [...c.ops].every(allow));
    const far: MiniCand[] = [];
    for (const o of MINI_PREFERENCE) {
      if (!allow(o) || o === "seq") continue;
      for (let i = 0; i < 3; i++) {
        const c = miniCand((MINI_TEMPLATES[o] as Template)(ctx.rng, words, allow), bars);
        if (c && [...c.ops].every(allow)) far.push(c);
      }
    }
    const cands = pickCandidates(ctx.rng, correct, near, far, 4);
    const options = ctx.rng.shuffle(cands.map((c) => c.code));
    return trialOf(piece, { choice: [code] }, cueOf(ctx), {
      mode: "choice",
      options,
      optionLabels: Object.fromEntries(options.map((o) => [o, `\`${o}\``])),
      prompt: PROMPT_PICK_RHYTHM,
      op,
    });
  },
  grade(trial, response) {
    if (trial.params.mode === "code") return gradeMiniWrite(trial, response);
    return gradeAnswer(trial, response);
  },
};

// --- fam.code.functions -------------------------------------------------------------------------

/** One candidate line of code and what it plays: onsets (in cycles) and MIDI notes. */
interface FnCand {
  code: string;
  notes: { t: number; midi: number }[];
  sig: Signature;
}
const fnCand = (code: string, notes: { t: number; midi: number }[]): FnCand => ({
  code,
  notes,
  sig: signatureOf(notes.map((n) => ({ t: n.t, v: n.midi }))),
});
/** Steps in even slots of each cycle, `cycles` times. */
function stepNotes(
  stepsPerCycle: readonly (readonly number[])[],
  toMidi: (step: number, cycle: number) => number[],
) {
  const out: { t: number; midi: number }[] = [];
  stepsPerCycle.forEach((steps, c) => {
    steps.forEach((s, i) => {
      for (const midi of toMidi(s, c)) out.push({ t: c + i / steps.length, midi });
    });
  });
  return out;
}
const scaleStr = (key: KeySpec, octave: number): string => `${key.tonic}${octave}:${key.mode}`;

const INTERVALS: readonly { name: string; semis: number }[] = [
  { name: "2M", semis: 2 },
  { name: "3m", semis: 3 },
  { name: "3M", semis: 4 },
  { name: "4P", semis: 5 },
  { name: "5P", semis: 7 },
];
const ARPS = ["0 1 2 1", "0 2 1 2", "2 1 0 1", "0 1 2 2", "2 0 1 0"];

/** A random contour of `n` scale steps in 0…7 that does not stand still. */
function randomSteps(rng: Rng, n: number): number[] {
  for (;;) {
    const s = Array.from({ length: n }, () => rng.int(0, 7));
    if (new Set(s).size >= Math.min(3, n)) return s;
  }
}

interface FnCase {
  correct: FnCand;
  near: FnCand[];
  bars: number;
  played?: Node;
  motif?: string;
}
type FnBuilder = (ctx: GenCtx, key: KeySpec) => FnCase;

const nScale = (steps: readonly number[], key: KeySpec, octave: number, cycles = 2) =>
  stepNotes(
    Array.from({ length: cycles }, () => steps),
    (s) => [stepToMidi(s, key, octave)],
  );

/** An uneven motif keeps changing pitches in place distinct from moving the whole rhythm. */
export function transformRhythmOk(events: readonly { t: number; dur: number }[]): boolean {
  const first = events.filter((e) => e.t >= 0 && e.t < 1).sort((a, b) => a.t - b.t);
  if (first.length < 3) return false;
  const lengths = first.map((e) => e.dur);
  const restGap = first.some(
    (e, i) =>
      (first[(i + 1) % first.length]?.t as number) + (i === first.length - 1 ? 1 : 0) > e.t + e.dur + 1e-9,
  );
  return restGap && Math.max(...lengths) > Math.min(...lengths) + 1e-9;
}

function transformCase(ctx: GenCtx, key: KeySpec, kind: "inversion" | "rotation" | "time-shift"): FnCase {
  const degrees = ctx.rng.shuffle([0, 1, 2, 4, 6]).slice(0, 3);
  const octave = ctx.rng.pick([3, 4]);
  const rhythm = (ds: readonly number[]) =>
    seq([atom(ds[0] as number), atom(ds[1] as number), rest, atom(ds[2] as number), rest], [2, 1, 1, 1, 1]);
  const original = rhythm(degrees);
  const rotated = rhythm([degrees[2] as number, degrees[0] as number, degrees[1] as number]);
  // Move the final written rest to the start: all note onsets move one sixth of a bar later, modulo one bar.
  const shifted = seq(
    [rest, atom(degrees[0] as number), atom(degrees[1] as number), rest, atom(degrees[2] as number)],
    [1, 2, 1, 1, 1],
  );
  const centreTwice = Math.min(...degrees) + Math.max(...degrees);
  const inverted = rhythm(degrees.map((d) => centreTwice - d));
  const reversed = seq(
    [rest, atom(degrees[2] as number), rest, atom(degrees[1] as number), atom(degrees[0] as number)],
    [1, 1, 1, 1, 2],
  );
  const lineOf = (node: Node) => `n("${print(node).text}").scale("${scaleStr(key, octave)}")`;
  const mk = (node: Node, code = lineOf(node)) =>
    fnCand(
      code,
      query(node, 2).map((e) => ({
        t: e.onset[0] / e.onset[1],
        midi: stepToMidi(Number(e.v), key, octave),
      })),
    );
  const checked = query(original, 1).map((e) => ({ t: e.onset[0] / e.onset[1], dur: e.dur[0] / e.dur[1] }));
  if (!transformRhythmOk(checked))
    throw new Error("transform motif must have a rest and unequal note lengths");
  const correctNode = kind === "inversion" ? inverted : kind === "rotation" ? rotated : shifted;
  const correct = mk(correctNode);
  // Keep rests and durations in the stimulus; the older builders retain their original even-slot path.
  const toNotes = (node: Node): Node =>
    node.t === "atom"
      ? atom(spellMidi(stepToMidi(Number(node.v), key, octave), key).code)
      : node.t === "rest"
        ? rest
        : { ...node, items: node.items.map(toNotes) };
  // A second plain degree line prevents recognizing inversion by the absence of a transform call.
  const degreeShift = kind === "inversion" ? ctx.rng.pick([1, 2]) : 0;
  const near =
    kind === "inversion"
      ? [mk(reversed, `${lineOf(original)}.rev()`), mk(rhythm(degrees.map((degree) => degree + degreeShift)))]
      : kind === "rotation"
        ? [mk(reversed, `${lineOf(original)}.rev()`), mk(shifted)]
        : [mk(rotated), mk(original)];
  if (new Set([correct.sig, ...near.map((c) => c.sig)]).size !== 3)
    throw new Error("ambiguous transform candidates");
  return { correct, near, bars: 2, played: toNotes(correctNode), motif: lineOf(original) };
}

const FN_BUILDERS: Readonly<Record<string, FnBuilder>> = {
  inversion: (ctx, key) => transformCase(ctx, key, "inversion"),
  rotation: (ctx, key) => transformCase(ctx, key, "rotation"),
  "time-shift": (ctx, key) => transformCase(ctx, key, "time-shift"),
  scale(ctx, key) {
    const oct = ctx.rng.pick([3, 4]);
    const steps = randomSteps(ctx.rng, 4);
    const mk = (st: readonly number[], k: KeySpec, o: number) =>
      fnCand(`n("${st.join(" ")}").scale("${scaleStr(k, o)}")`, nScale(st, k, o));
    const near: FnCand[] = [];
    const i = ctx.rng.int(0, 3);
    for (const d of [-1, 1]) {
      const s2 = [...steps];
      s2[i] = Math.max(0, Math.min(7, (s2[i] as number) + d));
      near.push(mk(s2, key, oct));
    }
    near.push(mk([...steps].reverse(), key, oct));
    near.push(mk(steps, key, oct === 3 ? 4 : 3));
    return { correct: mk(steps, key, oct), near, bars: 2 };
  },
  "scale-patterned"(ctx, key) {
    const oct = 4;
    const steps = randomSteps(ctx.rng, 4);
    const other = keysFor("≤2acc", "major").filter((k) => parsePc(k.tonic).pc !== parsePc(key.tonic).pc);
    const k2 = ctx.rng.pick(other);
    const notesOf = (ks: KeySpec[]) =>
      stepNotes(
        ks.map(() => steps),
        (s, c) => [stepToMidi(s, ks[c] as KeySpec, oct)],
      );
    const pat = (ks: KeySpec[]) =>
      ks.length === 1 ? scaleStr(ks[0] as KeySpec, oct) : `<${ks.map((k) => scaleStr(k, oct)).join(" ")}>`;
    const mk = (ks: KeySpec[]) =>
      fnCand(
        `n("${steps.join(" ")}").scale("${pat(ks)}")`,
        notesOf(ks.length === 1 ? [ks[0] as KeySpec, ks[0] as KeySpec] : ks),
      );
    const k3 = ctx.rng.pick(other.filter((k) => k.tonic !== k2.tonic));
    return {
      correct: mk([key, k2]),
      near: [mk([k2, key]), mk([key]), mk([key, k3])],
      bars: 2,
    };
  },
  transpose(ctx, key) {
    const base = [0, 2, 4, 2].map((s) => stepToMidi(s, key, 4));
    const names = base.map((m) => spellMidi(m, key).code).join(" ");
    const iv = ctx.rng.pick(INTERVALS);
    const mk = (v: { name: string; semis: number }) =>
      fnCand(
        `note("${names}").transpose("${v.name}")`,
        stepNotes([base, base], (m) => [m + v.semis]),
      );
    const i = INTERVALS.indexOf(iv);
    const near = [INTERVALS[i - 1], INTERVALS[i + 1], INTERVALS[i + 2], INTERVALS[i - 2]]
      .filter((v): v is { name: string; semis: number } => v !== undefined)
      .map(mk);
    return { correct: mk(iv), near, bars: 2 };
  },
  arp(ctx, key) {
    // Two triads a bar each (I and vi, or I and IV), in close position from the key's octave 3.
    const second = ctx.rng.pick([6, 4]);
    const triad = (deg: number) => [deg - 1, deg + 1, deg + 3].map((s) => stepToMidi(s, key, 3));
    const chords = [triad(1), triad(second)];
    const chordText = `<${chords.map((c) => `[${c.map((m) => spellMidi(m, key).code).join(",")}]`).join(" ")}>`;
    const mk = (arp: string) => {
      const idx = arp.split(" ").map(Number);
      return fnCand(
        `note("${chordText}").arp("${arp}")`,
        stepNotes([idx, idx], (i, c) => [(chords[c] as number[])[i] as number]),
      );
    };
    const pick = ctx.rng.pick(ARPS);
    return { correct: mk(pick), near: ARPS.filter((a) => a !== pick).map(mk), bars: 2 };
  },
  add(ctx, key) {
    const roots = ctx.rng.pick([
      [0, 3, 4],
      [0, 5, 3, 4],
      [0, 4, 5, 3],
      [5, 3, 0, 4],
    ]);
    const mk = (offsets: readonly number[], base: readonly number[]) =>
      fnCand(
        `n("${base.join(" ")}").add(n("[${offsets.join(",")}]")).scale("${scaleStr(key, 3)}")`,
        stepNotes([base, base], (s) => offsets.map((o) => stepToMidi(s + o, key, 3))),
      );
    return {
      correct: mk([0, 2, 4], roots),
      near: [mk([0, 2], roots), mk([0, 4], roots), mk([0, 2, 4], [...roots].reverse()), mk([0, 3, 4], roots)],
      bars: 2,
    };
  },
  rev(ctx, key) {
    const steps = randomSteps(ctx.rng, 4);
    const fwd = nScale(steps, key, 4);
    const back = nScale([...steps].reverse(), key, 4);
    const base = `n("${steps.join(" ")}").scale("${scaleStr(key, 4)}")`;
    const rotated = [...steps.slice(1), steps[0] as number];
    return {
      correct: fnCand(`${base}.rev()`, back),
      near: [
        fnCand(base, fwd),
        fnCand(
          `n("${rotated.join(" ")}").scale("${scaleStr(key, 4)}").rev()`,
          nScale([...rotated].reverse(), key, 4),
        ),
      ],
      bars: 2,
    };
  },
  "scale-transpose"(ctx, key) {
    const steps = ctx.rng.pick([
      [0, 2, 4],
      [0, 1, 2],
      [0, 2, 1, 0],
      [4, 2, 0],
    ]);
    const k = ctx.rng.int(1, 4);
    const mk = (by: number) =>
      fnCand(
        `n("${steps.join(" ")}").scale("${scaleStr(key, 4)}").scaleTranspose(${by})`,
        nScale(
          steps.map((s) => s + by),
          key,
          4,
        ),
      );
    return { correct: mk(k), near: [k - 1, k + 1, k + 2].filter((x) => x >= 0 && x !== k).map(mk), bars: 2 };
  },
  "root-notes"(ctx, key) {
    const degs = ctx.rng.pick([
      [1, 6, 4, 5],
      [1, 5, 6, 4],
      [6, 4, 1, 5],
      [1, 4, 5, 1],
    ]);
    const symbolOf = (deg: number): { sym: string; rootPc: number } => {
      const rootMidi = stepToMidi(deg - 1, key, 3);
      const minor = [2, 3, 6].includes(deg);
      return {
        sym: `${spellMidi(rootMidi, key).pc}${minor ? "m" : ""}`,
        rootPc: ((rootMidi % 12) + 12) % 12,
      };
    };
    const mk = (order: readonly number[], octave: number) => {
      const chords = order.map(symbolOf);
      return fnCand(
        `chord("<${chords.map((c) => c.sym).join(" ")}>").rootNotes(${octave})`,
        chords.map((c, i) => ({ t: i, midi: 12 * (octave + 1) + c.rootPc })),
      );
    };
    const swapped = [degs[0], degs[2], degs[1], degs[3]] as number[];
    return { correct: mk(degs, 2), near: [mk(degs, 3), mk(swapped, 2)], bars: 4 };
  },
};
/** The function each category of `fam.code.functions` asks about (the toolbox row it needs). */
export const FN_CATEGORIES = Object.keys(FN_BUILDERS);

export const codeFunctions: Generator = {
  name: "code-functions",
  generate(ctx) {
    const build = FN_BUILDERS[ctx.category] ?? (FN_BUILDERS.scale as FnBuilder);
    const key = pickKey(ctx, "major");
    const { correct, near, bars, played, motif } = build(ctx, key);
    const cands = pickCandidates(ctx.rng, correct, near, [], 3);
    const sound = ctx.category === "root-notes" ? ctx.rng.pick(["ebass", "upright"]) : pickSound(ctx);
    // The played code is the plain note list (the learner never sees it): what the candidates must match.
    const byCycle = Array.from({ length: bars }, (_, c) =>
      correct.notes.filter((n) => Math.floor(n.t + 1e-9) === c),
    );
    const pat: Node = {
      t: "alt",
      items: byCycle.map((ns) => {
        const times = [...new Set(ns.map((n) => n.t))].sort((a, b) => a - b);
        const slots = times.map((t) => {
          const at = ns.filter((n) => n.t === t).map((n) => spellMidi(n.midi, key).code);
          return at.length === 1 ? atom(at[0] as string) : stack(at.map((a) => atom(a)));
        });
        return seq(slots);
      }),
    };
    const piece = buildPiece({
      bpm: pickTempo(ctx),
      bars,
      tracks: [
        {
          label: "mel",
          src: "note",
          pat: played ?? (byCycle.length === 1 ? ((pat as { items: Node[] }).items[0] as Node) : pat),
          s: sound,
          gain: jitter(ctx, 0.75),
        },
      ],
    });
    const options = ctx.rng.shuffle(cands.map((c) => c.code));
    return trialOf(piece, { choice: [correct.code] }, cueOf(ctx), {
      mode: "choice",
      key,
      options,
      optionLabels: Object.fromEntries(options.map((o) => [o, `\`${o}\``])),
      prompt: PROMPT_PICK_CODE,
      fn: ctx.category,
      ...(motif ? { motif } : {}),
    });
  },
};
