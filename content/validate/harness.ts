// The thin adapter between content CI and the packages that do the real work (architecture §3.7 as
// amended by contracts): `lintOak`, `gradeExercise`, `evaluateForGrading` and `normalize` from
// @oak/grader, `notate` from @oak/notation, `gradeTaps` from @oak/pitch and `evalHeadless` from
// @oak/grader/testing. There is no stand-in: a test the real packages cannot decide (a sung response
// without a recorded fixture) is reported as pending, never counted as a pass.

import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Exercise,
  KeySpec,
  LessonDef,
  LintContext,
  LintResult,
  MeterId,
  SessionId,
  SongDef,
  SwingSpec,
  TapEx,
  TestCase,
  TestResponse,
  UnlockableId,
} from "@oak/content-kit";
import { R } from "@oak/content-kit";
import * as grader from "@oak/grader";
import { evalHeadless, type HeadlessEvent } from "@oak/grader/testing";
import * as notation from "@oak/notation";
import { gradeLaneTaps, gradeTaps } from "@oak/pitch";
import { METERS } from "@oak/theory";
import { courseGraph } from "../index.ts";
import { unlockedAt } from "../lib/course.ts";
import { toolbox } from "../toolbox.ts";

/** The Wave 1 gate sample is checked as if it were taught at this session. */
export const SAMPLE_CONTEXT: SessionId = "U03.L05";

/**
 * The onboarding lessons run on the onboarding loop, one of the four preview contexts (contracts §3.1
 * rule 5a): its code may use locked tools, in examples, starters and graded steps alike. U00.L02 brings
 * the same loop back for its Make (its own tools, the tuner and the setup screens, carry no code).
 */
export const ONBOARDING_PREVIEW: ReadonlySet<string> = new Set(["U00.L01", "U00.L02"]);

type Backend = "package";
const used = { lint: new Set<Backend>(), grade: new Set<Backend>(), notation: new Set<Backend>() };
export function backends(): Record<keyof typeof used, Backend[]> {
  return { lint: [...used.lint], grade: [...used.grade], notation: [...used.notation] };
}

/** The grader realm, initialised once per process with the course toolbox (tool IDs for `uses`/`must-use`). */
let realm: Promise<unknown> | null = null;
const ensureRealm = () => {
  realm ??= grader.initRealm({ toolbox: [...toolbox], lockdown: false });
  return realm;
};

// --- lint ---------------------------------------------------------------------------------------

const unlockedCache = new Map<string, Set<UnlockableId>>();
export function unlockedFor(session: SessionId): Set<UnlockableId> {
  let set = unlockedCache.get(session);
  if (!set) {
    set = unlockedAt(courseGraph(), toolbox, session);
    unlockedCache.set(session, set);
  }
  return set;
}

export interface LintOptions {
  session: SessionId;
  meter: MeterId;
  key?: KeySpec | null;
  allowPreview?: boolean;
  profile?: LintContext["profile"];
}
export function lint(code: string, o: LintOptions): LintResult {
  const ctx: LintContext = {
    profile: o.profile ?? "content",
    unlocked: unlockedFor(o.session),
    allowPreview: o.allowPreview ?? false,
    meter: o.meter,
    key: o.key ?? null,
  };
  used.lint.add("package");
  return grader.lintOak(code, ctx, toolbox);
}

// --- evaluation ---------------------------------------------------------------------------------

/** `.scope()` and `.fscope()` are identity in the grader realm (contracts §3.1 rule 9); the test realm lacks them. */
const forTestRealm = (code: string) => code.replace(/\.f?scope\(\s*\)/g, "");

export interface EvalOutcome {
  ok: boolean;
  error?: string;
  events: HeadlessEvent[];
  logs: string[];
  cpsSet: boolean;
  cps: number;
  tracks: string[];
}
export async function evaluate(code: string, bars = 1): Promise<EvalOutcome> {
  try {
    const r = await evalHeadless(forTestRealm(code), bars);
    return { ok: true, events: r.events, logs: r.logs, cpsSet: r.cpsSet, cps: r.cps, tracks: r.tracks };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      events: [],
      logs: [],
      cpsSet: false,
      cps: 0,
      tracks: [],
    };
  }
}
/** Strudel log lines that mean the code is wrong even though it ran (architecture §3.7 item 3). */
export const BAD_LOG = /\[(mini|tonal|voicing|query|eval)\]|error|unknown chord/i;

// --- grading ------------------------------------------------------------------------------------

export interface GradeOutcome {
  /** False when the packages cannot decide this test (the caller reports it, never counts it as a pass). */
  decided: boolean;
  passed: boolean;
  score: number;
  feedback: string[];
  backend: Backend;
  note?: string;
  /** What the learner would read (the grader's rendered feedback), for `content:check --verbose`. */
  messages?: string[];
  /** Each rubric rule and whether the code met it (a Make's rules), when the grader got that far. */
  rubric?: { ruleId: string; required: boolean; ok: boolean }[];
}

const NEUTRAL_PROFILE = {
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
} as const;

type Lesson = Pick<LessonDef, "id" | "key" | "meter" | "bpm" | "swing" | "pickup">;

/** Taps are graded by @oak/pitch against the targets the grader reads off the evaluated stimulus. */
async function tapPerformance(ex: TapEx, taps: number[], lesson: Lesson): Promise<grader.MatchResult> {
  await ensureRealm();
  const meter = ex.meter ?? lesson.meter;
  const code = ex.stimulus.src === "code" ? ex.stimulus.code : null;
  if (code === null) throw new Error(`${ex.id}: tap tests need a code stimulus`);
  const res = await grader.evaluateForGrading(code, { mode: "lesson", bars: ex.bars, lint: null, meter });
  if (!res.ok) throw new Error(`${ex.id}: the stimulus does not evaluate: ${res.error.message}`);
  const n = grader.normalize(res, { meter, key: ex.key ?? lesson.key });
  const targets = grader.tapTargets(ex.target, n, ex.bars, meter);
  return gradeTaps(taps, targets, ex.tol, NEUTRAL_PROFILE) as unknown as grader.MatchResult;
}

/**
 * Two-lane taps (`tap.lanes`) are graded as the lesson host grades them (app/src/lesson/grading.ts
 * `lanePerformance`): both hands at once by @oak/pitch `gradeLaneTaps` against each lane's targets
 * (`tapLaneTargets`), so a hand that leans against the other is heard.
 */
async function lanePerformance(
  ex: TapEx,
  lanes: readonly (readonly number[])[],
  lesson: Lesson,
): Promise<grader.MatchResult> {
  await ensureRealm();
  const spec = ex.lanes ?? [];
  if (spec.length !== 2) throw new Error(`${ex.id}: lane tests need a tap with two lanes`);
  const meter = ex.meter ?? lesson.meter;
  const code = ex.stimulus.src === "code" ? ex.stimulus.code : null;
  if (code === null) throw new Error(`${ex.id}: tap tests need a code stimulus`);
  const res = await grader.evaluateForGrading(code, { mode: "lesson", bars: ex.bars, lint: null, meter });
  if (!res.ok) throw new Error(`${ex.id}: the stimulus does not evaluate: ${res.error.message}`);
  const n = grader.normalize(res, { meter, key: ex.key ?? lesson.key });
  const targets = grader.tapLaneTargets(spec, n, ex.bars, meter);
  return gradeLaneTaps(
    [lanes[0] ?? [], lanes[1] ?? []],
    spec.map((l, k) => ({
      label: l.label,
      key: (l.key ?? (k === 0 ? "f" : "j")).toUpperCase(),
      targets: targets[k] ?? [],
    })),
    ex.tol,
    NEUTRAL_PROFILE,
  ) as unknown as grader.MatchResult;
}

async function toExerciseResponse(
  ex: Exercise,
  r: TestResponse,
  lesson: Lesson,
): Promise<grader.ExerciseResponse | null> {
  if ("staff" in r)
    return { staff: notation.parseNoteList(r.staff, { meter: METERS[ex.meter ?? lesson.meter] }) };
  if ("taps" in r)
    return ex.kind === "tap" ? { performance: await tapPerformance(ex, r.taps, lesson) } : null;
  if ("lanes" in r)
    return ex.kind === "tap" ? { performance: await lanePerformance(ex, r.lanes, lesson) } : null;
  if ("pitchFixture" in r) return null;
  return r as grader.ExerciseResponse;
}

/**
 * Every grade in this process, per exercise object and test: content:check grades each test once for its own
 * check and the corrections standard (./standard.ts) reads the same outcome.
 */
const gradeMemo = new WeakMap<Exercise, Map<string, Promise<GradeOutcome>>>();

/**
 * What a capstone host passes beside the code (wave7.md §3.2): the picked song's melody from its answer key
 * (`song-melody-kept`, `contrafact`) and the learner's other version (`two-versions-differ`).
 */
export interface GradeExtra {
  songMelody?: readonly grader.SongMelodyNote[];
  otherVersion?: { id: "a" | "b"; code: string };
  /**
   * The picked song's sections with its chart (`songFormOf`), for a brief that counts reharmonisation devices
   * (JC4's `device-count`): the song's own devices are not the learner's (W7 gate, as the app's host passes it).
   */
  songForm?: NonNullable<ReturnType<typeof grader.songFormOf>>;
}

export function grade(
  ex: Exercise,
  test: TestCase,
  lesson: Lesson,
  session: SessionId,
  mode: "lesson" | "capstone" = "lesson",
  extra: GradeExtra = {},
): Promise<GradeOutcome> {
  let byTest = gradeMemo.get(ex);
  if (!byTest) {
    byTest = new Map();
    gradeMemo.set(ex, byTest);
  }
  const key = JSON.stringify([
    test.response,
    test.params ?? null,
    test.expect,
    lesson.id,
    lesson.key,
    lesson.meter,
    lesson.bpm,
    session,
    mode,
    extra.songMelody?.length ?? 0,
    extra.songForm?.length ?? 0,
    extra.otherVersion?.code ?? null,
    test.context ?? null,
  ]);
  let p = byTest.get(key);
  if (!p) {
    p = withTestContext(test, extra).then((x) => gradeOnce(ex, test, lesson, session, mode, x));
    byTest.set(key, p);
  }
  return p;
}

/** A test that names its song or the other version (`TestCase.context`) is graded beside those, not the defaults. */
async function withTestContext(test: TestCase, extra: GradeExtra): Promise<GradeExtra> {
  const c = test.context;
  if (!c) return extra;
  const out: GradeExtra = { ...extra };
  if (c.song) {
    const melody = await songMelodyOf(c.song);
    if (!melody) throw new Error(`${test.name}: ${c.song} has no answer key to grade against`);
    out.songMelody = melody;
    if (extra.songForm) {
      const form = await songFormOfId(c.song);
      if (form) out.songForm = form;
      else delete out.songForm;
    }
  }
  if (c.otherVersion !== undefined) out.otherVersion = { id: "b", code: c.otherVersion };
  return out;
}

async function gradeOnce(
  ex: Exercise,
  test: TestCase,
  lesson: Lesson,
  session: SessionId,
  mode: "lesson" | "capstone",
  extra: GradeExtra,
): Promise<GradeOutcome> {
  await ensureRealm();
  const response = await toExerciseResponse(ex, test.response, lesson);
  if (!response)
    return {
      decided: false,
      passed: false,
      score: 0,
      feedback: [],
      backend: "package",
      note: `no recorded fixture can drive a ${Object.keys(test.response)[0]} response to ${ex.kind}`,
    };
  const result = await grader.gradeExercise({
    exercise: ex,
    response,
    ctx: {
      exerciseGlobalId: `${lesson.id}/${ex.id}`,
      mode,
      key: ex.key ?? lesson.key,
      meter: ex.meter ?? lesson.meter,
      bpm: lesson.bpm,
      ...(lesson.swing ? { swing: lesson.swing } : {}),
      // The exercise's own pickup first, as the app grades (app/src/lesson/grading.ts).
      ...((ex.pickup ?? lesson.pickup) ? { pickup: ex.pickup ?? lesson.pickup } : {}),
      ...(extra.songMelody ? { songMelody: extra.songMelody } : {}),
      ...(extra.songForm ? { songForm: extra.songForm } : {}),
      ...(extra.otherVersion ? { otherVersion: extra.otherVersion } : {}),
      params: test.params ?? {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0,
      tutorHints: 0,
      extraReplays: 0,
      lint: {
        profile: "graded",
        unlocked: unlockedFor(session),
        allowPreview: ONBOARDING_PREVIEW.has(lesson.id),
        // An item in its own meter (a 3/4 dictation inside a 4/4 checkpoint) is linted in that meter.
        meter: ex.meter ?? lesson.meter,
        key: ex.key ?? lesson.key,
      },
      profile: NEUTRAL_PROFILE,
    },
  });
  used.grade.add("package");
  return {
    decided: true,
    passed: result.status === "pass",
    score: result.score,
    feedback: result.diagnostics.map((d) => d.id),
    messages: result.messages.map((m) => m.text),
    ...(result.rubric
      ? { rubric: result.rubric.map((r) => ({ ruleId: r.ruleId, required: r.required, ok: r.ok })) }
      : {}),
    backend: "package",
    ...(result.status === "error" && test.expect !== "error"
      ? { note: result.messages.map((m) => m.text).join(" / ") || "evaluation error" }
      : {}),
  };
}

// --- reading code as the grader reads it -------------------------------------------------------

/**
 * Evaluates code in the grader realm (no lint) and normalizes it: each event with its track, drum role and MIDI
 * number, and the roles of contracts §6.2 (`roles.chords` names the track that plays chords). The unit-song checks
 * read a Make's reference code this way, as the app reads a take (content/validate/unit-songs.ts).
 */
export async function normalizedCode(
  code: string,
  o: { meter: MeterId; key?: KeySpec | null; bars: number },
): Promise<{ ok: true; n: grader.Normalized } | { ok: false; error: string }> {
  await ensureRealm();
  const res = await grader.evaluateForGrading(code, {
    mode: "lesson",
    bars: o.bars,
    lint: null,
    meter: o.meter,
  });
  if (!res.ok) return { ok: false, error: res.error.message };
  return { ok: true, n: grader.normalize(res, o.key ? { meter: o.meter, key: o.key } : { meter: o.meter }) };
}

// --- notation -----------------------------------------------------------------------------------

export interface NotationOutcome {
  available: boolean;
  approximate?: boolean;
  warnings?: number;
  abc?: string;
  error?: string;
}
/** Evaluates code in the grader realm, normalizes it and engraves its pitched events on one staff. */
export async function notateCode(
  code: string,
  meter: MeterId,
  key: KeySpec | null,
  bars: number,
  staff: "treble" | "bass" | "grand" | "perc" | "lead" = "treble",
  opts: {
    /** A lead sheet engraves its melody track only (the chords are symbols above it, the bass is not shown). */
    melody?: string;
    /** A declared swing (contracts §6.10): the staff writes straight eighths under "Swing 8ths". */
    swing?: SwingSpec;
  } = {},
): Promise<NotationOutcome> {
  await ensureRealm();
  const res = await grader.evaluateForGrading(code, { mode: "lesson", bars, lint: null, meter });
  if (!res.ok) return { available: true, error: res.error.message };
  const n = grader.normalize(res, key ? { meter, key } : { meter });
  // The percussion staff engraves the drums; every other staff the pitched events.
  const pitched = n.all.filter((e) => e.midi !== null && !e.drum);
  const events =
    staff === "perc"
      ? n.all.filter((e) => !!e.drum)
      : staff === "lead" && opts.melody
        ? pitched.filter((e) => e.track === opts.melody)
        : pitched;
  if (events.length === 0)
    return {
      available: true,
      error: `nothing to engrave on the ${staff} staff (no ${staff === "perc" ? "drum" : "pitched"} events)`,
    };
  // As the lesson host does (`staffHostInput` with the code): a chromatic step is drawn as the code writes it
  // (`n("3#")` a ♯4, `n("4b")` a ♭5), not by the direction it moves in.
  const input = notation.staffHostInput(
    {
      events,
      meter: METERS[meter],
      key,
      bars,
      staff: staff === "perc" ? "percussion" : staff,
      ...(opts.swing ? { swing: opts.swing } : {}),
    },
    { code },
  );
  const { score, abc } = notation.notate(input);
  used.notation.add("package");
  return { available: true, approximate: score.approximate, warnings: score.warnings.length, abc: abc.abc };
}

/** Kept for callers that only have headless events: the event list is re-evaluated through the grader. */
export type { HeadlessEvent };

// --- a capstone's song -------------------------------------------------------------------------------------------

/**
 * A song's melody as the capstone host passes it (app/src/capstone/song-melody.ts, mirrored): the answer key's
 * melody layer evaluated once, note by note, bars counted from the first full bar (a pickup's notes negative).
 * `null` while the song has no answer key (content/repertoire/<slug>/song.ts).
 */
/** A song's sections with its chart (`songFormOf`), as the host passes it beside a device-counting brief. */
export async function songFormOfId(
  songId: string,
): Promise<NonNullable<ReturnType<typeof grader.songFormOf>> | null> {
  const file = join(import.meta.dir, "..", "repertoire", songId.replace(/^song\./, ""), "song.ts");
  if (!existsSync(file)) return null;
  const song = ((await import(file)) as { default: SongDef }).default;
  return grader.songFormOf(song);
}

export async function songMelodyOf(songId: string): Promise<grader.SongMelodyNote[] | null> {
  const file = join(import.meta.dir, "..", "repertoire", songId.replace(/^song\./, ""), "song.ts");
  if (!existsSync(file)) return null;
  const song = ((await import(file)) as { default: SongDef }).default;
  const layer = song.answerKey.layers.melody?.trim();
  if (!layer) return null;
  await ensureRealm();
  const shift = song.pickup ? 1 : 0;
  const bars = song.answerKey.bars + shift;
  const meter = song.meter as MeterId;
  const ev = await grader.evaluateForGrading(`melody: ${layer.replace(/^[A-Za-z_$][\w$]*\s*:\s*/, "")}`, {
    mode: "capstone",
    bars,
    lint: null,
    meter,
  });
  if (!ev.ok) return null;
  const n = grader.normalize(ev, { meter });
  return (n.byTrack.melody ?? [])
    .filter((e) => e.midi !== null && R.toNum(e.onset) < bars - 1e-9)
    .sort((a, b) => R.cmp(a.onset, b.onset) || (a.midi as number) - (b.midi as number))
    .map((e) => ({ onset: R.sub(e.onset, [shift, 1]), dur: e.dur, midi: e.midi as number }));
}
