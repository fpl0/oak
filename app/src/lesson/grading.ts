// Grading one step in the browser (contracts §6.1: deterministic graders alone decide; the server stores the
// browser's result): the wire response an attempt stores (`AttemptResponse`) becomes the grader's
// `ExerciseResponse` (staff text → events, taps and sung notes → a measured performance), the context carries
// the lesson's key, meter and tempo, the series' params and the learner's unlocked tools (locked tools are
// errors in graded steps), and a generator stimulus is drawn as a drill trial whose expected answer is the
// step's correct one. The host functions are injected, so the same code runs in `bun test` with the real
// grader realm and in the app with the browser GraderHost.

import { decks } from "@content/families.ts";
import {
  type AttemptResponse,
  type Exercise,
  type GradeResult,
  type HintRung,
  type KeySpec,
  type LearnerProfile,
  type LintContext,
  type MeterId,
  type ParamValues,
  type PickupSpec,
  type SingEx,
  type SwingSpec,
  stripMarkers,
  type TapEx,
  type Trial,
  type UnlockableId,
} from "@oak/api";
import {
  createRegistry,
  type DrillRegistry,
  FAMILIES,
  generateTrial,
  padMode,
  stepTrialSpec,
} from "@oak/drills";
import type { EvalResult, ExerciseResponse, GradeRequest, MatchResult } from "@oak/grader";
import { normalize, singTargets, tapLaneTargets, tapTargets } from "@oak/grader";
import { parseNoteList } from "@oak/notation";
import {
  type ClaveTapResult,
  gradeClaveTaps,
  gradeLaneTaps,
  gradeRhythmTaps,
  gradeTaps,
  type LaneTapResult,
  type RhythmTapResult,
} from "@oak/pitch";
import { type ClaveDirection, type ClaveType, claveOf, METERS } from "@oak/theory";
import type { SungSummary } from "../answers/types.ts";
import { globalExerciseId, withParams } from "./model.ts";

/** The two host calls grading needs: the browser GraderHost in the app, the realm itself in tests. */
export interface GraderDeps {
  grade(req: GradeRequest): Promise<GradeResult>;
  /** Evaluates authored code (a tap stimulus) without a lint: `{ mode: 'lesson', bars, lint: null, meter }`. */
  evaluate(code: string, bars: number, meter: MeterId): Promise<EvalResult>;
}

/** Where an exercise is graded: its owner (lesson or checkpoint), defaults and the learner. */
export interface GradeEnv {
  ownerId: string;
  key: KeySpec;
  meter: MeterId;
  bpm: number;
  swing?: SwingSpec;
  pickup?: PickupSpec;
  unlocked: ReadonlySet<UnlockableId>;
  /** U00.L01/L02 run on the onboarding loop, a preview context (contracts §3.1 rule 5a). */
  allowPreview: boolean;
  profile: LearnerProfile;
}

export const NEUTRAL_PROFILE: LearnerProfile = {
  rangeLow: 48,
  rangeHigh: 72,
  comfLow: 52,
  comfHigh: 67,
  tapLatencyMs: 0,
  tapJitterMs: 15,
  singLatencyMs: 0,
  singTolCents: 50,
  singTolMode: "auto",
  noiseFloorDb: -60,
  outputKind: "wired",
  inputKind: "builtin",
  quiet: false,
};

/** The lint every graded editor and check uses: locked tools are errors (contracts §3.3). */
export function gradedLint(env: Pick<GradeEnv, "unlocked" | "allowPreview" | "meter" | "key">): LintContext {
  return {
    profile: "graded",
    unlocked: env.unlocked,
    allowPreview: env.allowPreview,
    meter: env.meter,
    key: env.key,
  };
}

// --- generator stimuli ------------------------------------------------------------------------------

let registry: DrillRegistry | null = null;
function drills(): DrillRegistry {
  registry ??= createRegistry(FAMILIES, decks);
  return registry;
}

/** Categories of a family the learner has met by `lessonId` (`before` = lessons guaranteed done earlier). */
export function openCategories(
  familyId: string,
  lessonId: string,
  before: (lessonId: string) => boolean,
): string[] {
  const fam = drills().family(familyId as never);
  const open = fam.def.categories
    .filter((c) => c.unlockAt === lessonId || before(c.unlockAt))
    .map((c) => c.id);
  return open.length > 0 ? open : fam.def.categories.slice(0, 1).map((c) => c.id);
}

/**
 * The trial a generator stimulus plays for one attempt series: seeded by the exercise and the series, so a
 * retry hears the same question and "Try a new one" a new one.
 */
export function stimulusTrial(
  ex: Exercise,
  ownerId: string,
  seriesNo: number,
  profile: LearnerProfile,
  categories: readonly string[],
): Trial | null {
  if (!("stimulus" in ex) || !ex.stimulus || ex.stimulus.src !== "generator") return null;
  const st = ex.stimulus;
  const fam = drills().family(st.family);
  const seed = st.seed ?? hash(`${globalExerciseId(ownerId, ex)}#${seriesNo}`);
  // d8: a step whose degree pad is minor (or major) draws trials in a key of that mode only; an identification
  // step (major or minor?) keeps both, so the step's own key mode is never passed blindly.
  const answer =
    "answer" in ex ? (ex.answer as { ui?: string; set?: readonly string[] } | undefined) : undefined;
  const mode = answer?.ui === "degree-pad" && answer.set ? padMode(answer.set) : undefined;
  const draw = (s: number) =>
    generateTrial(
      fam,
      stepTrialSpec(fam, {
        level: st.level,
        seed: s,
        openCategories: categories,
        profile,
        ...(mode ? { mode } : {}),
      }),
      profile,
      categories,
    );
  // A family draws every category the learner has met, but a step's answer can be narrower than the family (U13.L02
  // offers only the sixteenths between the eighths, U12.L04's palette only sevenths, a bar-buttons step only the
  // trials that ask "which bar"): the series draws on until a trial its own answer can take. Seeded, so a retry
  // hears the same question; a step whose answer takes every trial draws exactly as before.
  for (let k = 0; k < 40; k++) {
    const t = draw((seed + k * 7919) >>> 0);
    if (answerTakes(ex, t)) return t;
  }
  return draw(seed);
}

/** Bar options of a drawn trial ("1", "4", "none"): the "which bar" question a bar timeline can take. */
function barOptions(trial: Trial): string[] | null {
  const own = trial.params.options;
  if (!Array.isArray(own) || own.length === 0) return null;
  return own.every((o) => typeof o === "string" && (/^\d+$/.test(o) || o === "none"))
    ? (own as string[])
    : null;
}

/**
 * Whether the step's own answer can take this drawn trial's expected answer: its choice among the options shown
 * (the trial's own when it brings them), its qualities on the pad, its numerals on the palette the step allows, a
 * bar on the bar timeline. Other answers (degree pads, taps, text) take every trial.
 */
export function answerTakes(ex: Exercise, trial: Trial): boolean {
  const spec = "answer" in ex ? (ex.answer as Record<string, unknown> | undefined) : undefined;
  const exp = trial.expected as { choice?: string[]; qualities?: string[]; rn?: string[] };
  const ui = spec?.ui;
  if (ui === "choice") {
    const own = trial.params.options;
    const ids = Array.isArray(own)
      ? (own as string[])
      : ((spec?.options as { id: string }[] | undefined) ?? []).map((o) => o.id);
    return (exp.choice ?? []).every((c) => ids.includes(c));
  }
  if (ui === "bar-buttons") {
    const bars = barOptions(trial);
    return (
      bars !== null && (exp.choice ?? []).length > 0 && (exp.choice ?? []).every((c) => bars.includes(c))
    );
  }
  if (ui === "quality-pad" && Array.isArray(spec?.set))
    return (exp.qualities ?? []).every((q) => (spec.set as string[]).includes(q));
  if (ui === "rn-palette" && Array.isArray(spec?.allow)) {
    const allow = spec.allow as string[];
    const rns = exp.rn ?? [];
    if (typeof spec.slots === "number" && rns.length !== spec.slots) return false;
    const seventhsOnly = allow.includes("sevenths") && !allow.includes("triads");
    if (seventhsOnly && !rns.every((r) => /7|ø/.test(r))) return false;
    if (!allow.includes("secondary") && rns.some((r) => r.includes("/"))) return false;
    if (!allow.includes("inversions") && rns.some((r) => /(?:64|6|65|43|42|2)$/.test(r.replace(/7$/, ""))))
      return false;
    return true;
  }
  return true;
}

/** A checkpoint family item: one trial of `familyId` at `level` from the server's seed. */
export function familyTrial(
  familyId: string,
  level: number,
  category: string | null,
  seed: number,
  profile: LearnerProfile,
): Trial {
  const fam = drills().family(familyId as never);
  const cats = fam.def.categories.map((c) => c.id);
  const cat = category ?? cats[seed % Math.max(1, cats.length)] ?? "";
  return generateTrial(fam, { index: 0, family: fam.def.id, level, category: cat, seed }, profile, cats);
}

export function familyAnswerKind(familyId: string): string {
  return drills().family(familyId as never).def.answer;
}

/** FNV-1a: a stable seed from a string (a passive block's examples, a generator stimulus's series). */
export function hashSeed(s: string): number {
  return hash(s);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The key a drawn trial plays in (`params.key`), when it says. */
function trialKey(trial: Trial): KeySpec | null {
  const k = trial.params.key as { tonic?: unknown; mode?: unknown } | undefined;
  return k && typeof k.tonic === "string" && typeof k.mode === "string" ? (k as KeySpec) : null;
}

/** Every part of an `all` step against its own drawn trial (`trials[i]`, `null` for parts without one). */
export function withTrials<E extends Exercise>(ex: E, trials: readonly (Trial | null)[]): E {
  if (ex.kind !== "all") return withTrial(ex, trials[0] ?? null);
  return { ...ex, parts: ex.parts.map((p, i) => withTrial(p, trials[i] ?? null)) } as E;
}

/** The exercise as graded against a drawn trial: the trial's expected answer is the correct one. */
/**
 * The tap targets of a drawn tap trial (an echo: hear the figure, tap it back), in seconds from the start of the
 * stimulus the tap pad plays: the trial's own targets after its response point. Kept beside the exercise
 * `withTrial` returns, for `tapPerformance`.
 */
const DRAWN_TAPS = new WeakMap<object, readonly number[]>();

/** The tap targets of a drawn trial, in seconds from the stimulus start (`null`: not a tap trial). */
export function drawnTapTargets(trial: Trial): number[] | null {
  const targets = trial.params.tapTargets;
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const at = typeof trial.params.responseAt === "number" ? trial.params.responseAt : 0;
  return (targets as number[]).map((t) => t + at);
}

export function withTrial<E extends Exercise>(ex: E, trial: Trial | null): E {
  if (!trial) return ex;
  if (ex.kind === "tap") {
    const targets = drawnTapTargets(trial);
    if (!targets) return ex;
    const out = { ...ex } as E;
    DRAWN_TAPS.set(out, targets);
    return out;
  }
  if (ex.kind === "identify") return { ...ex, correct: trial.expected } as E;
  if (ex.kind === "dictation" && ex.answer.ui === "degree-pad" && trial.expected.degrees) {
    // A drawn melody written on the degree pad is checked against the trial's own answer, as the drills check
    // it: reading the degrees back from the trial's code took the chords that set home for the tune (U03.L10
    // S2 always failed). The step keeps its prompt, hints, feedback and the trial's key.
    const key = trialKey(trial);
    return {
      ...ex,
      kind: "identify",
      correct: trial.expected,
      ...(key ? { key } : {}),
    } as unknown as E;
  }
  if (ex.kind === "dictation") {
    // The drawn tune is in the trial's own key (a dictation trial moves round the keys the learner has met):
    // its degrees are read in that key, not the lesson's (U03.L10 S2 heard in G was read in C).
    const key = trialKey(trial);
    return {
      ...ex,
      ...(key ? { key } : {}),
      reference: { ...ex.reference, solutions: [trial.code] },
    } as E;
  }
  return ex;
}

// --- performances ------------------------------------------------------------------------------------

/** Cents between a sung note and its target; octave-free unless `exact`. */
function centsOff(sung: SungSummary, target: number, octave: SingEx["tol"]["octave"]): number | null {
  if (sung.midi === null) return null;
  let d = (sung.midi - target) * 100 + (sung.cents ?? 0);
  if (octave !== "exact") {
    d = ((((d + 600) % 1200) + 1200) % 1200) - 600;
  }
  return d;
}

/**
 * Sung notes (the mic widget's summaries) against the step's targets: full credit within the tolerance,
 * half within twice it. Nothing voiced at all is `sing.no-voice`, which grades as an error (not an attempt).
 * Each note carries what the grader reads from @oak/pitch's per-note result (the target, the folded sung
 * pitch, the signed error), so a lenient first sing and a sung degree pattern are judged as the grader does.
 */
export function sungPerformance(
  sung: readonly SungSummary[],
  targets: readonly number[],
  tolCents: number,
  octave: SingEx["tol"]["octave"],
): MatchResult & {
  notes: {
    credit: number;
    feedback: string | null;
    index: number;
    targetMidi: number;
    sungMidi: number | null;
    cents: number | null;
    coverage: number;
  }[];
} {
  if (sung.length === 0 || sung.every((s) => s.midi === null))
    return {
      score: 0,
      dims: {},
      diagnostics: [{ id: "sing.no-voice", severity: "error", params: { db: -60 } } as never],
      notes: [],
    };
  const notes = targets.map((t, i) => {
    const s = sung[i];
    const off = s ? centsOff(s, t, octave) : null;
    if (off === null)
      return {
        credit: 0,
        feedback: "sing.missed",
        index: i,
        targetMidi: t,
        sungMidi: null,
        cents: null,
        coverage: 0,
      };
    const a = Math.abs(off);
    return {
      credit: a <= tolCents ? 1 : a <= 2 * tolCents ? 0.5 : 0,
      feedback: null,
      index: i,
      targetMidi: t,
      sungMidi: t + off / 100,
      cents: off,
      coverage: 1,
    };
  });
  const score = notes.length ? notes.reduce((a, n) => a + n.credit, 0) / notes.length : 0;
  return { score, dims: { pitch: { score, weight: 1, n: notes.length } }, diagnostics: [], notes };
}

async function tapPerformance(
  deps: GraderDeps,
  env: GradeEnv,
  ex: TapEx,
  taps: number[],
): Promise<MatchResult> {
  const drawn = DRAWN_TAPS.get(ex);
  if (drawn) return gradeTaps(taps, drawn, ex.tol, env.profile) as unknown as MatchResult;
  const meter = ex.meter ?? env.meter;
  if (ex.stimulus.src !== "code") return { score: 0, dims: {}, diagnostics: [] };
  const res = await deps.evaluate(ex.stimulus.code, ex.bars, meter);
  if (!res.ok) return { score: 0, dims: {}, diagnostics: [] };
  const n = normalize(res, { meter, key: ex.key ?? env.key });
  const targets = tapTargets(ex.target, n, ex.bars, meter);
  if (targets.length === 0 || !(n.cps > 0))
    return gradeTaps(taps, targets, ex.tol, env.profile) as unknown as MatchResult;
  // The same grade (`gradeRhythmTaps` grades with `gradeTaps`, unchanged), read as a rhythm: a push tapped on the
  // beat it comes before, a triplet tapped as two-plus-one, a 6/8 bar tapped in quarters are named for what they
  // are (U13), first, instead of only "a chord came in without a tap" and "a tap was one too many".
  const r = gradeRhythmTaps(
    taps,
    {
      downbeat: 0,
      bpm: n.cps * 60 * METERS[meter].unitsPerBar,
      meter,
      onsets: targets.map((t) => t * n.cps),
      bars: ex.bars,
    },
    ex.tol,
    env.profile,
  );
  const bpm = n.cps * 60 * METERS[meter].unitsPerBar;
  const clave = r.pass ? null : claveAsked(targets, bpm, meter, ex.bars);
  if (clave) {
    const named = gradeClaveTaps(
      taps,
      { downbeat: 0, bpm, type: clave.type, direction: clave.direction, bars: ex.bars },
      ex.tol,
      env.profile,
    );
    if (named.clave.heard) return { ...r, diagnostics: claveFirst(r, named) } as unknown as MatchResult;
  }
  return { ...r, diagnostics: rhythmFirst(r) } as unknown as MatchResult;
}

/**
 * The clave a tap step's targets are (review:journey, Wave 7): every two-bar cycle of a 4/4 stimulus holds
 * exactly one clave of `claveSteps` on the eighth grid (R3.L02 S2: the rimshot's son 3-2). `null` for anything
 * else, so only a clave step is read as one.
 */
export function claveAsked(
  targets: readonly number[],
  bpm: number,
  meter: MeterId,
  bars: number,
): { type: ClaveType; direction: ClaveDirection } | null {
  if (meter !== "4/4" || bars < 2 || bars % 2 !== 0 || !(bpm > 0) || targets.length === 0) return null;
  const eighth = 30 / bpm;
  const steps: number[] = [];
  for (const t of targets) {
    const s = t / eighth;
    if (Math.abs(s - Math.round(s)) > 0.05) return null;
    steps.push(Math.round(s));
  }
  let found: { type: ClaveType; direction: ClaveDirection } | null = null;
  for (let c = 0; c < bars / 2; c++) {
    const cycle = steps.filter((s) => s >= c * 16 && s < (c + 1) * 16).map((s) => s - c * 16);
    const k = claveOf(cycle);
    if (!k || (found && (found.type !== k.type || found.direction !== k.direction))) return null;
    found = k;
  }
  return found;
}

/**
 * A clave tapped from its other side (2-3 for 3-2) or as the other clave is said as that, first and alone
 * (`tap.clave-direction`, `tap.clave-type` of @oak/pitch `gradeClaveTaps`): read as single taps it was "a
 * rimshot without a tap" eight times, "a tap where it is quiet" eight times and, falsely, "your pushes landed on
 * the beat" (review:journey: a 2-3 tapped for 3-2 five times running never heard which way round it was). The
 * per-tap lines and the push reading are what the swapped clave explains, so they go; nothing changes `pass`.
 */
export function claveFirst(r: RhythmTapResult, named: ClaveTapResult): RhythmTapResult["diagnostics"] {
  const lead = named.diagnostics.filter((d) => d.id === "tap.clave-direction" || d.id === "tap.clave-type");
  if (lead.length === 0) return rhythmFirst(r);
  const rest = r.diagnostics.filter(
    (d) => !RHYTHM_NAMED.has(d.id as string) && d.id !== "tap.missed" && d.id !== "tap.extra",
  );
  return [...lead.map((d) => ({ ...d, severity: "error" as const })), ...rest];
}

/**
 * Wave 7 (`tap.lanes`, R2.L04's 3 against 2; contracts §8.4): both hands graded at once by @oak/pitch
 * `gradeLaneTaps` against each lane's targets read off the evaluated stimulus (`tapLaneTargets`, the lanes' own
 * tracks), passed as the step's performance (content-kit `IMPLEMENTED` note on `tap.lanes`): it forgives only the
 * offset both hands share, names a hand that rushes against the other, swapped hands and a flam, and passes when
 * both lanes do. Grading each lane alone would forgive each lane's own lean.
 */
async function lanePerformance(
  deps: GraderDeps,
  env: GradeEnv,
  ex: TapEx,
  lanes: readonly (readonly number[])[],
): Promise<MatchResult> {
  const spec = ex.lanes ?? [];
  const meter = ex.meter ?? env.meter;
  if (spec.length !== 2 || ex.stimulus.src !== "code") return { score: 0, dims: {}, diagnostics: [] };
  const res = await deps.evaluate(ex.stimulus.code, ex.bars, meter);
  if (!res.ok) return { score: 0, dims: {}, diagnostics: [] };
  const n = normalize(res, { meter, key: ex.key ?? env.key });
  const targets = tapLaneTargets(spec, n, ex.bars, meter);
  const r = gradeLaneTaps(
    [lanes[0] ?? [], lanes[1] ?? []],
    spec.map((l, k) => ({
      label: l.label,
      name: laneName(l.label),
      key: (l.key ?? (k === 0 ? "f" : "j")).toUpperCase(),
      targets: targets[k] ?? [],
    })),
    ex.tol,
    env.profile,
  );
  return { ...r, diagnostics: laneFirst(r) } as unknown as MatchResult;
}

/**
 * The pulse a lane taps, in a sentence: "Left hand: the two, with the kick" → "two" (review:journey: the whole
 * label read "that hand plays the three, with the cowbell while the other plays the two, with the kick").
 */
export function laneName(label: string): string {
  const m = /\bthe\s+([^,;:()]+)/i.exec(label);
  return (m?.[1] ?? label).trim().toLowerCase();
}

/**
 * A hand left silent is said once (`tap.lane-silent`): its every target also read "No tap for note n of the
 * rhythm" (twelve lines under the one that says why), and taps of that pulse played by the other hand read as
 * that hand's "one too many" (review:journey: a polyrhythm tapped one lane at a time). Those lines go; the rest
 * stay, in the grader's order. Nothing changes `pass`.
 */
export function laneFirst(r: LaneTapResult): LaneTapResult["diagnostics"] {
  const silent = r.diagnostics.filter((d) => d.id === "tap.lane-silent").map((d) => String(d.params.lane));
  if (silent.length === 0) return r.diagnostics;
  const quietTargets = r.diagnostics.flatMap((d) =>
    d.id === "tap.missed" && silent.includes(String(d.params.lane)) && typeof d.where?.tSec === "number"
      ? [d.where.tSec]
      : [],
  );
  const near = (t: unknown) =>
    typeof t === "number" && quietTargets.some((q) => Math.abs(q - t) * 1000 <= Math.max(r.windowMs, 60));
  return r.diagnostics.filter((d) => {
    const lane = d.params.lane;
    if (d.id === "tap.missed" && typeof lane === "string" && silent.includes(lane)) return false;
    if (d.id === "tap.extra" && typeof lane === "string" && !silent.includes(lane) && near(d.where?.tSec))
      return false;
    return true;
  });
}

/**
 * A take that did not pass says its named rhythm mistake first, as the verdict's lead line (the grader lists
 * errors before warnings and shows three): without this, four pushes tapped on the beat read as "a chord came in
 * without a tap" three times and "6 more", and the line that says why sat unseen behind them. The per-tap lines
 * a push on the beat explains (its missing tap, the tap on the beat after it) are left out; the rest stay.
 */
export function rhythmFirst(r: RhythmTapResult): RhythmTapResult["diagnostics"] {
  const named = (id: string) => RHYTHM_NAMED.has(id);
  if (r.pass) return r.diagnostics;
  const onBeat = r.onsets.filter((o) => o.verdict === "on-the-beat");
  const explainedSlots = new Set(onBeat.map((o) => o.index));
  const beats = onBeat.flatMap((o) => (o.push ? [o.push.beatAt] : []));
  const near = (t: number | undefined) =>
    t !== undefined && beats.some((b) => Math.abs(t - b) * 1000 <= Math.max(r.windowMs, 60));
  const rest = r.diagnostics.filter((d) => {
    if (named(d.id as string)) return false;
    if (d.id === "tap.missed" && d.where?.slot !== undefined && explainedSlots.has(d.where.slot))
      return false;
    if (d.id === "tap.extra" && near(d.where?.tSec)) return false;
    return true;
  });
  const lead = r.diagnostics
    .filter((d) => named(d.id as string))
    .map((d) => (d.severity === "warn" ? { ...d, severity: "error" as const } : d));
  return [...lead, ...rest];
}

/** The rhythm mistakes `gradeRhythmTaps` names (@oak/pitch rhythm-taps.ts): said before the per-tap lines. */
const RHYTHM_NAMED: ReadonlySet<string> = new Set([
  "tap.push-on-beat",
  "tap.push-late",
  "tap.push-early",
  "tap.triplet-uneven",
  "tap.grouping",
]);

async function singPerformance(
  deps: GraderDeps,
  env: GradeEnv,
  ex: SingEx,
  sung: SungSummary[],
): Promise<MatchResult> {
  const meter = ex.meter ?? env.meter;
  const key = ex.key ?? env.key;
  let n = null;
  let cps = env.bpm / 60 / METERS[meter].unitsPerBar;
  const src =
    ex.target.from === "reference"
      ? (ex.target.reference.solutions[0] ?? null)
      : ex.stimulus.src === "code"
        ? ex.stimulus.code
        : null;
  if (ex.target.from !== "degrees" && src) {
    // The stimulus loops: read only its own bars, or a one-bar call would ask for its note four times.
    const bars =
      ex.target.from === "reference"
        ? ex.target.reference.bars
        : ex.stimulus.src === "code"
          ? (ex.stimulus.bars ?? 4)
          : 4;
    const res = await deps.evaluate(src, bars, meter);
    if (res.ok) {
      n = normalize(res, { meter, key });
      cps = n.cps;
    }
  }
  const targets = singTargets(ex.target, n, key, meter, cps).map((t) => t.midi);
  // The lenient first sing (contracts §8.1 item 8): ±100¢ after per-note folding, whatever the ladder says.
  if (ex.tol.lenient) return sungPerformance(sung, targets, 100, "per-note");
  const tol = ex.tol.cents === "learner" ? env.profile.singTolCents : ex.tol.cents;
  return sungPerformance(sung, targets, tol, ex.tol.octave);
}

// --- responses -----------------------------------------------------------------------------------------

/** The grader's reading of a stored response. */
export async function toGraderResponse(
  deps: GraderDeps,
  env: GradeEnv,
  ex: Exercise,
  r: AttemptResponse,
  takeOf?: TakeLookup,
): Promise<ExerciseResponse> {
  if ("parts" in r) {
    const parts = ex.kind === "all" ? ex.parts : null;
    if (!parts) {
      // run-investigate: one response per question, each already in its wire shape.
      return { parts: r.parts as ExerciseResponse[] };
    }
    const out: ExerciseResponse[] = [];
    for (const [i, part] of parts.entries()) {
      const pr = (r.parts[i] ?? { skipped: true }) as AttemptResponse;
      out.push(await toGraderResponse(deps, env, part, pr, takeOf));
    }
    return { parts: out };
  }
  if ("staff" in r) return { staff: parseNoteList(r.staff, { meter: METERS[ex.meter ?? env.meter] }) };
  if ("taps" in r) {
    if (ex.kind !== "tap") return { skipped: true };
    return { performance: await tapPerformance(deps, env, ex, r.taps) };
  }
  // Wave 7 (`tap.lanes`): a two-hand take, one list of seconds per lane from bar 1 of the stimulus.
  const lanes = (r as { lanes?: unknown }).lanes;
  if (Array.isArray(lanes) && lanes.every((l) => Array.isArray(l))) {
    if (ex.kind !== "tap" || !ex.lanes || ex.lanes.length !== 2) return { skipped: true };
    return { performance: await lanePerformance(deps, env, ex, lanes as number[][]) };
  }
  if ("sung" in r) {
    if (ex.kind === "predict") return { answer: {} };
    if (ex.kind !== "sing") return { skipped: true };
    // The take the widget just measured, when this response is its summary: @oak/pitch's whole result (per-note
    // targets, folded pitch, why nothing was heard, clipping), which the grader reads the pattern from.
    const take = takeOf?.(ex.id, r.sung);
    if (take) return { performance: take };
    return { performance: await singPerformance(deps, env, ex, r.sung) };
  }
  if ("answer" in r) return { ...r, answer: splitTypedParts(ex, r.answer) } as ExerciseResponse;
  // A bar picked on the bar buttons and stored as a click (before the host sent `answer.number`): a question
  // reads it as the bar's number; only the error hunt reads clicks.
  if ("click" in r && typeof r.click === "string" && ex.kind !== "error-hunt" && /^\d+$/.test(r.click))
    return { answer: { number: Number(r.click) } };
  return r as ExerciseResponse;
}

/**
 * A text field sends what was typed as one string. When the answer has several parts (a scale spelled
 * `D E F# G A B C#`, a key signature typed `F# C#`), the string is split on spaces and commas into those parts
 * before grading, as the drills do; a one-part answer is left whole (U03.L01 S7, wave3 integration).
 */
export function splitTypedParts<A extends { text?: string[] | undefined }>(ex: Exercise, answer: A): A {
  const typed = answer.text;
  if (typed?.length !== 1) return answer;
  const correct = "correct" in ex && ex.correct && typeof ex.correct === "object" ? ex.correct : null;
  const want = correct && "text" in correct && Array.isArray(correct.text) ? correct.text.length : 1;
  if (want <= 1) return answer;
  const parts = (typed[0] ?? "").split(/[\s,]+/).filter((s) => s !== "");
  return parts.length > 1 ? { ...answer, text: parts } : answer;
}

/** The measured take behind a sung response (`{ performance }`), or null to re-read the summary. */
export type TakeLookup = (exerciseId: string, sung: readonly SungSummary[]) => MatchResult | null;

export interface GradeOptions {
  params: ParamValues;
  attemptNo: number;
  rung: HintRung;
  extraReplays: number;
  tutorHints?: number;
  trial?: Trial | null;
  /** One trial per part of an `all` step. */
  trials?: readonly (Trial | null)[];
  /** The exercise's own global ID when it differs from `${ownerId}/${id}`. */
  globalId?: string;
  /** The widget's measured takes (`lessonTakes` in inputs.tsx). */
  takeOf?: TakeLookup;
  /**
   * Unit songs (spec §5.3): a Make inside a song opens with the learner's earlier take or Oak's copy at the song's
   * tempo. Code equal to one of these is unchanged (`make.unchanged`), as the authored starter is (`openingsOf`).
   */
  unchangedFrom?: readonly string[];
}

const sameCode = (a: string, b: string) => {
  const norm = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n")
      .trim();
  return norm(stripMarkers(a).code) === norm(b);
};

/**
 * A Make's exercise with the code it opened with as its starter when the learner's code is exactly that opening
 * (spec §5.3: `make.unchanged` compares with the code the Make opened with, not only the authored starter). Nothing
 * else of the exercise changes: the starter is read by `make.unchanged` alone, so the rubric grades as before.
 */
export function withOpeningStarter(
  ex: Exercise,
  code: string,
  openings: readonly string[] | undefined,
): Exercise {
  if (ex.kind !== "code-make" || !openings || openings.length === 0) return ex;
  if (sameCode(ex.code.starter, code)) return ex;
  const opening = openings.find((o) => o.trim() !== "" && sameCode(o, code));
  return opening === undefined ? ex : { ...ex, code: { ...ex.code, starter: opening } };
}

/** Grades one response to one exercise. Failures in the learner's code come back as `status: 'error'`. */
export async function gradeStep(
  deps: GraderDeps,
  env: GradeEnv,
  exercise: Exercise,
  response: AttemptResponse,
  o: GradeOptions,
): Promise<GradeResult> {
  const base = withParams(exercise, o.params);
  const drawn = o.trials ? withTrials(base, o.trials) : withTrial(base, o.trial ?? null);
  const ex =
    "code" in response && typeof response.code === "string"
      ? withOpeningStarter(drawn, response.code, o.unchangedFrom)
      : drawn;
  const graderResponse = await toGraderResponse(deps, env, ex, response, o.takeOf);
  const key = ex.key ?? env.key;
  const meter = ex.meter ?? env.meter;
  const ctxOf = (part: Exercise, globalId: string): GradeRequest["ctx"] => ({
    exerciseGlobalId: globalId,
    mode: "lesson",
    key: part.key ?? key,
    meter: part.meter ?? meter,
    bpm: typeof part.bpm === "number" ? part.bpm : typeof ex.bpm === "number" ? ex.bpm : env.bpm,
    ...((ex.swing ?? env.swing) ? { swing: (ex.swing ?? env.swing) as SwingSpec } : {}),
    ...((ex.pickup ?? env.pickup) ? { pickup: (ex.pickup ?? env.pickup) as PickupSpec } : {}),
    params: o.params,
    attemptNo: o.attemptNo,
    firstAttempt: o.attemptNo === 1,
    rung: o.rung,
    tutorHints: o.tutorHints ?? 0,
    extraReplays: o.extraReplays,
    lint: gradedLint({ ...env, meter: part.meter ?? meter, key: part.key ?? key }),
    profile: env.profile,
  });
  const globalId = o.globalId ?? globalExerciseId(env.ownerId, ex);
  const result = await deps.grade({ exercise: ex, response: graderResponse, ctx: ctxOf(ex, globalId) });
  // Several answers checked together (four chords by ear, U12.L01 S6): the verdict names the part that is off.
  if (ex.kind === "all" && result.status === "fail" && isAnswerAll(ex) && "parts" in graderResponse) {
    const responses = graderResponse.parts as ExerciseResponse[];
    const alone = await Promise.all(
      ex.parts.map((part, i) =>
        deps
          .grade({
            exercise: part,
            response: responses[i] ?? { skipped: true },
            ctx: ctxOf(part, `${globalId}#${i + 1}`),
          })
          .catch(() => null),
      ),
    );
    return withPartSlots(result, alone);
  }
  return result;
}

/** The answer kinds an `all` step can check together and name by part (never code, a take or taps). */
const ANSWER_PART_KINDS: ReadonlySet<Exercise["kind"]> = new Set<Exercise["kind"]>([
  "identify",
  "fact",
  "staff-read",
  "keyboard",
]);

/** An `all` whose every part is an answer picked or typed (U12.L01 S6: four chords, one quality each). */
export function isAnswerAll(ex: Exercise): boolean {
  return ex.kind === "all" && ex.parts.length > 1 && ex.parts.every((p) => ANSWER_PART_KINDS.has(p.kind));
}

/**
 * The step's result with each finding placed on its part (`where.slot` = the part's number, 1-based), from the
 * parts graded one by one. The verdict itself (status, score, dims) stays the whole step's. When the parts'
 * findings are not the step's own (another count, another code), nothing is changed: a wrong place is worse than
 * none.
 */
export function withPartSlots(whole: GradeResult, parts: readonly (GradeResult | null)[]): GradeResult {
  const counted = (ds: GradeResult["diagnostics"]) =>
    ds
      .filter((d) => d.severity === "error" || d.severity === "warn")
      .map((d) => d.id as string)
      .sort()
      .join("|");
  if (parts.some((p) => p === null)) return whole;
  const placed = parts.flatMap((p, i) =>
    (p as GradeResult).diagnostics
      .filter((d) => d.severity === "error" || d.severity === "warn")
      .map((d) => ({ ...d, where: { slot: i + 1 } })),
  );
  if (placed.length === 0 || counted(placed) !== counted(whole.diagnostics)) return whole;
  const rest = whole.diagnostics.filter((d) => d.severity !== "error" && d.severity !== "warn");
  return { ...whole, diagnostics: [...placed, ...rest] };
}
