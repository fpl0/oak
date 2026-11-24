// define* helpers: validate at definition time (schema + the structural rules that need no other file),
// then freeze. A failure throws `ContentDefinitionError` listing every issue with its path.
// Rules that need the registries (unknown IDs, unlock-before-use, budgets, tests) are content CI's job;
// `checkLessonAuthoring` below holds the ones CI can run on a lesson alone.
import { prettifyError, type z } from "zod";
import { AUTHORING_CAPS, lessonBudget } from "./budget.ts";
import { parseLessonId } from "./ids.ts";
import { collectParamRefs, StarterMarkerError, stripMarkers } from "./params.ts";
import type {
  BandDef,
  ByEarSpec,
  CanDoDef,
  CapstoneDef,
  CheckpointDef,
  Exercise,
  FactDeck,
  FamilyDef,
  FlavourKit,
  KeySpec,
  LessonDef,
  LevelParams,
  Matcher,
  MilestoneDef,
  PitchMode,
  RubricRule,
  SkillDef,
  SongDef,
  StepDef,
  TermEntry,
  ToolEntry,
  UnitDef,
  UnitSongDef,
} from "./schema/index.ts";
import {
  CODE_KINDS,
  FORM_SECTION_NAMES,
  formLetters,
  HINTLESS_KINDS,
  METER_GROUPINGS,
  MINOR_THIRD_MODES,
  MODE_DEGREES,
  STEP_EXERCISE_KINDS,
  trackCustomParamIssues,
  unitSongSchema,
} from "./schema/index.ts";
import {
  BandDefSchema,
  CanDoDefSchema,
  CapstoneDefSchema,
  CheckpointDefSchema,
  FactDeckSchema,
  FamilyDefSchema,
  FlavourKitSchema,
  LessonDefSchema,
  MilestoneDefSchema,
  SkillDefSchema,
  SongDefSchema,
  TermEntrySchema,
  ToolEntrySchema,
  UnitDefSchema,
} from "./zod.ts";

export interface ContentIssue {
  /** Dotted path into the definition: `steps[3].exercise.hints`. */
  path: string;
  message: string;
  /** Stable rule name, for tests and tooling: `schema`, `lesson.last-step-make`, ... */
  rule: string;
}

export class ContentDefinitionError extends Error {
  readonly what: string;
  readonly issues: ContentIssue[];
  constructor(what: string, issues: ContentIssue[]) {
    super(
      `${what} is not valid:\n${issues.map((i) => `  ${i.path || "(root)"}: ${i.message} [${i.rule}]`).join("\n")}`,
    );
    this.name = "ContentDefinitionError";
    this.what = what;
    this.issues = issues;
  }
}

function formatPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const key of path)
    out += typeof key === "number" ? `[${key}]` : out === "" ? String(key) : `.${String(key)}`;
  return out;
}

/** Schema issues of `value`, flattened (the deepest issues of a failed union are reported, not "invalid union"). */
export function schemaIssues(schema: z.ZodType, value: unknown): ContentIssue[] {
  const result = schema.safeParse(value);
  if (result.success) return [];
  const out: ContentIssue[] = [];
  const visit = (issues: readonly z.core.$ZodIssue[], base: readonly PropertyKey[]): void => {
    for (const issue of issues) {
      const path = [...base, ...issue.path];
      if (issue.code === "invalid_union" && issue.errors.length > 0) {
        // Report the branch that got furthest: fewest issues, then deepest path.
        const best = [...issue.errors].sort(
          (a, b) => a.length - b.length || depth(b) - depth(a),
        )[0] as z.core.$ZodIssue[];
        visit(best, path);
      } else out.push({ path: formatPath(path), message: issue.message, rule: "schema" });
    }
  };
  const depth = (issues: readonly z.core.$ZodIssue[]): number =>
    Math.max(0, ...issues.map((i) => i.path.length));
  visit(result.error.issues, []);
  return out;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function define<T>(what: string, schema: z.ZodType<T>, def: T, extra?: (def: T) => ContentIssue[]): T {
  const issues = schemaIssues(schema, def);
  // Structural rules read the definition's shape, so they only run on schema-valid input.
  if (issues.length === 0 && extra) issues.push(...extra(def));
  if (issues.length > 0) throw new ContentDefinitionError(what, issues);
  return deepFreeze(def);
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

// --- exercises ----------------------------------------------------------------------------------

/** Every exercise inside `ex`, itself first, then the parts of an `AllEx`. */
export function flattenExercise(ex: Exercise): Exercise[] {
  return ex.kind === "all" ? [ex, ...ex.parts] : [ex];
}

/** Starters and other strings that carry ⟪⟫ / ⟦⟧ markers. */
function starterOf(ex: Exercise): string | null {
  return "code" in ex && typeof ex.code === "object" ? ex.code.starter : null;
}

/** Structural rules of one exercise that need no registry (contracts §5.3, §5.5, §6.5, §8.5). */
export function checkExercise(
  ex: Exercise,
  path: string,
  where: "lesson" | "capstone" | "checkpoint" = "lesson",
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const hintless = (HINTLESS_KINDS as readonly string[]).includes(ex.kind) || ex.role === "checkpoint";
  if (ex.hints === null && !hintless) {
    issues.push({
      path: `${path}.hints`,
      rule: "exercise.hints-required",
      message:
        "hints may be null only for predict, listen and role 'checkpoint'; write the 4-rung ladder [nudge, pointer, partial, reveal]",
    });
  }
  if (ex.kind === "sing" && ex.fallback === undefined) {
    issues.push({
      path: `${path}.fallback`,
      rule: "exercise.sing-fallback",
      message: "every sing exercise declares a fallback ('identify' or 'skip') for Quiet mode",
    });
  }
  if (ex.kind === "code-make" && where === "lesson") {
    const required = ex.rubric.filter((r) => r.required).length;
    if (required !== 1)
      issues.push({
        path: `${path}.rubric`,
        rule: "make.one-required-rule",
        message: `a lesson Make has exactly one required rule (found ${required})`,
      });
  }
  if (ex.kind === "code-make" || ex.kind === "compose-brief") {
    for (const id of duplicates(ex.rubric.map((r) => r.id)))
      issues.push({
        path: `${path}.rubric`,
        rule: "rubric.duplicate-rule",
        message: `rule id "${id}" is used twice`,
      });
  }
  if (ex.kind === "all") {
    if (ex.weights && ex.weights.length !== ex.parts.length)
      issues.push({
        path: `${path}.weights`,
        rule: "all.weights-length",
        message: "weights must have one entry per part",
      });
    ex.parts.forEach((part, i) => {
      issues.push(...checkExercise(part, `${path}.parts[${i}]`, where));
    });
  }
  if (
    ex.kind === "dictation" &&
    ex.stages &&
    ex.stageWeights &&
    ex.stages.length !== ex.stageWeights.length
  ) {
    issues.push({
      path: `${path}.stageWeights`,
      rule: "dictation.stage-weights",
      message: "stageWeights must have one entry per stage",
    });
  }
  issues.push(...checkWave3(ex, path));
  issues.push(...checkWave4(ex, path, where));
  issues.push(...checkWave5(ex, path));
  issues.push(...checkWave6(ex, path, where));
  issues.push(...checkWave7(ex, path));
  if (ex.kind === "predict" && ex.mode !== "hum" && ex.correct === undefined) {
    issues.push({
      path: `${path}.correct`,
      rule: "predict.correct",
      message: `predict mode '${ex.mode}' needs 'correct'`,
    });
  }
  const starter = starterOf(ex);
  if (starter !== null) {
    try {
      const clean = stripMarkers(starter);
      if (ex.kind === "code-fill") {
        const declared = ex.blanks
          .map((b) => b.id)
          .sort()
          .join(",");
        const marked = clean.blanks
          .map((b) => b.id)
          .sort()
          .join(",");
        if (declared !== marked)
          issues.push({
            path: `${path}.blanks`,
            rule: "fill.blanks-match",
            message: `blanks [${declared}] do not match the ⟦⟧ markers [${marked}] in the starter`,
          });
      }
    } catch (e) {
      if (!(e instanceof StarterMarkerError)) throw e;
      issues.push({ path: `${path}.code.starter`, rule: "starter.markers", message: e.message });
    }
  }
  // Params: every {{param:x}} / { param: 'x' } must be declared, and every declared param must be used.
  const declared = new Set(Object.keys(ex.params ?? {}));
  const used = collectParamRefs(ex.kind === "all" ? { ...ex, parts: [] } : ex);
  for (const name of used)
    if (!declared.has(name))
      issues.push({
        path: `${path}.params`,
        rule: "params.undeclared",
        message: `param "${name}" is used but not declared`,
      });
  for (const name of declared)
    if (!used.has(name))
      issues.push({
        path: `${path}.params.${name}`,
        rule: "params.unused",
        message: `param "${name}" is declared but never used`,
      });
  for (const [i, test] of ex.tests.entries()) {
    for (const name of Object.keys(test.params ?? {})) {
      if (!declared.has(name))
        issues.push({
          path: `${path}.tests[${i}].params`,
          rule: "params.undeclared",
          message: `test pins unknown param "${name}"`,
        });
    }
  }
  for (const name of duplicates(ex.tests.map((t) => t.name)))
    issues.push({
      path: `${path}.tests`,
      rule: "tests.duplicate-name",
      message: `test name "${name}" is used twice`,
    });
  return issues;
}

/** The matcher pitch mode each by-ear transposition rule stands for (`ByEarSpec.accepts`). */
export const BY_EAR_PITCH = {
  exact: ["absolute"],
  "any-octave": ["octave-free"],
  "any-key": ["transposition-invariant"],
} as const satisfies Record<ByEarSpec["accepts"], readonly PitchMode[]>;

type EventsMatcherDef = Extract<Matcher, { m: "events" }>;
/** Every `events` matcher anywhere in an exercise (matchers, staff expectations, rubric `matches` rules). */
function eventsMatchersIn(value: unknown, path: string): { m: EventsMatcherDef; path: string }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => eventsMatchersIn(v, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  const o = value as Record<string, unknown>;
  const here = o.m === "events" ? [{ m: o as unknown as EventsMatcherDef, path }] : [];
  return [
    ...here,
    ...Object.entries(o).flatMap(([k, v]) => (k === "parts" ? [] : eventsMatchersIn(v, `${path}.${k}`))),
  ];
}

/** The pitch mode of a matcher (the first pitched member of an `all`), if it has one. */
function matcherPitch(m: Matcher): PitchMode | null {
  if (m.m === "events" || m.m === "melody") return m.pitch;
  if (m.m === "all") for (const sub of m.of) if (matcherPitch(sub)) return matcherPitch(sub);
  return null;
}

/** Structural rules of the Wave 3 additions (staff writing, key signatures, singing, by-ear, listening). */
function checkWave3(ex: Exercise, path: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (p: string, rule: string, message: string) =>
    issues.push({ path: `${path}${p}`, rule, message });
  if (ex.kind === "staff-write") {
    const keySig = ex.expect.e === "key-signature";
    if (keySig !== (ex.answer.mode === "key-signature"))
      add(
        ".answer.mode",
        "staff.key-signature-mode",
        "a key-signature answer uses staff-input with mode 'key-signature', and only it does",
      );
  }
  if (ex.kind === "sing") {
    if (ex.tol.lenient && ex.mode !== "pitch")
      add(".tol.lenient", "sing.lenient-mode", "the lenient first sing is a single 'pitch' target");
    const t = ex.target;
    if (t.from === "degrees" && t.octaves && t.octaves.length !== t.degrees.length)
      add(".target.octaves", "sing.octaves-length", "octaves has one entry per degree");
  }
  if (ex.kind === "dictation" && ex.byEar) {
    if (ex.answer.ui !== "code")
      add(".answer", "by-ear.code-answer", "a by-ear transcription step is answered in code (ui 'code')");
    const pitch = matcherPitch(ex.matcher);
    const allowed: readonly string[] = BY_EAR_PITCH[ex.byEar.accepts];
    if (!pitch || !allowed.includes(pitch))
      add(
        ".byEar.accepts",
        "by-ear.accepts-matcher",
        `accepts '${ex.byEar.accepts}' needs a matcher with pitch ${allowed.join(" or ")} (found ${pitch ?? "none"})`,
      );
    if (ex.byEar.rates[0] !== 1)
      add(".byEar.rates", "by-ear.rates", "rates start with 1 (full speed), then slower ones");
  }
  // `rhythm: "exact"` always compares lengths; `durations: false` beside it would say the opposite.
  for (const at of eventsMatchersIn(ex, ""))
    if (at.m.rhythm === "exact" && !at.m.durations)
      add(
        at.path,
        "matcher.rhythm-exact-durations",
        "rhythm 'exact' compares lengths too: write rhythm 'onsets' (starts only) or 'onsets+durations' (starts and lengths)",
      );
  if (ex.kind === "code-modify" && ex.target.revealRollAfter !== undefined && ex.target.showRoll)
    add(
      ".target.revealRollAfter",
      "modify.reveal-roll",
      "revealRollAfter is for a target whose roll starts hidden (showRoll false)",
    );
  return issues;
}

/** True when a matcher (or a member of an `all`) reads harmony: `harmony` or `pcset`. */
function readsHarmony(m: Matcher): boolean {
  if (m.m === "harmony" || m.m === "pcset") return true;
  return m.m === "all" && m.of.some(readsHarmony);
}
/** True when a matcher grades a bass line: a `harmony` matcher at level `bass`, or any matcher on a bass track. */
function gradesBass(track: string, m: Matcher): boolean {
  if (track === "bass" || track === "@bass") return true;
  if (m.m === "harmony") return m.level === "bass";
  return m.m === "all" && m.of.some((x) => gradesBass(track, x));
}
const STAGE_ORDER = ["bass", "quality", "rn"] as const;
/** Stages listed in bass → quality → rn order, each at most once. */
function stagesInOrder(stages: readonly string[]): boolean {
  const at = stages.map((x) => STAGE_ORDER.indexOf(x as (typeof STAGE_ORDER)[number]));
  return at.every((v, i) => v >= 0 && (i === 0 || v > (at[i - 1] as number)));
}

/**
 * Structural rules of the Wave 4 additions (slot choices, chords on the staff, staged chord dictation,
 * by-ear transcription in parts, staged transcription, the new rubric fields).
 */
function checkWave4(ex: Exercise, path: string, where: "lesson" | "capstone" | "checkpoint"): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (p: string, rule: string, message: string) =>
    issues.push({ path: `${path}${p}`, rule, message });
  if ("answer" in ex && ex.answer.ui === "slot-choice") {
    const ui = ex.answer;
    if (ui.labels && ui.labels.length !== ui.slots)
      add(".answer.labels", "slot-choice.labels", "labels has one entry per slot");
    if ((ex.kind === "identify" || ex.kind === "fact") && ex.correct.choice) {
      const ids = new Set(ui.options.map((o) => o.id));
      if (ex.correct.choice.length !== ui.slots)
        add(".correct.choice", "slot-choice.correct", `one answer per slot (${ui.slots})`);
      for (const c of ex.correct.choice)
        if (!ids.has(c)) add(".correct.choice", "slot-choice.correct", `"${c}" is not one of the options`);
    }
  }
  if (ex.kind === "staff-write" && ex.expect.e === "chords" && !ex.answer.palette.chords)
    add(
      ".answer.palette.chords",
      "staff.chords-palette",
      "chords on the staff need palette.chords: true (notes at one position stack)",
    );
  if (ex.kind === "dictation") {
    const keys = Object.keys(ex.stageAnswers ?? {});
    if (ex.stageAnswers) {
      if (!ex.stages)
        add(".stageAnswers", "dictation.stage-answers", "stageAnswers needs the stages it answers");
      else {
        for (const k of keys)
          if (!(ex.stages as readonly string[]).includes(k))
            add(".stageAnswers", "dictation.stage-answers", `stage "${k}" is not in stages`);
        for (const st of ex.stages)
          if (!keys.includes(st))
            add(".stageAnswers", "dictation.stage-answers", `stage "${st}" has no answer widget`);
      }
    } else if (ex.stageFlow !== undefined || ex.stagePass !== undefined)
      add(".stageFlow", "dictation.stage-answers", "stageFlow and stagePass go with stageAnswers");
    const harmonyStages = (ex.stages ?? []).filter((x) => (STAGE_ORDER as readonly string[]).includes(x));
    if (ex.stageAnswers && harmonyStages.length > 1 && !stagesInOrder(harmonyStages))
      add(".stages", "dictation.stage-order", "chord stages run bass → quality → rn");
    const parts = ex.byEar?.parts ?? [];
    const tracks = parts.map((p) => p.track);
    if (new Set(tracks).size !== tracks.length)
      add(".byEar.parts", "by-ear.parts-tracks", "each part transcribes its own track");
    parts.forEach((p, i) => {
      if (readsHarmony(p.matcher) && !parts.slice(0, i).some((q) => gradesBass(q.track, q.matcher)))
        add(
          `.byEar.parts[${i}]`,
          "by-ear.bass-first",
          "chords by ear come after the bass: put a bass part before this one",
        );
    });
  }
  if (ex.kind === "transcribe-step" && ex.grading.mode === "auto" && ex.grading.stages) {
    if (!stagesInOrder(ex.grading.stages.map((x) => x.stage)))
      add(".grading.stages", "transcribe.stage-order", "chord stages run bass → quality → rn, once each");
  }
  if (ex.kind === "transcribe-step" && ex.stimulus.src === "capstone-song" && where !== "capstone")
    add(".stimulus", "stimulus.capstone-song", "the capstone's song exists only inside a capstone");
  const rules =
    ex.kind === "code-make" || ex.kind === "compose-brief"
      ? ex.rubric
      : "matcher" in ex && ex.matcher?.m === "rubric"
        ? ex.matcher.rules
        : [];
  for (const [i, r] of rules.entries()) {
    if (r.rule === "progression" && r.bars && r.bars[0] > r.bars[1])
      add(`.rubric[${i}].bars`, "rubric.bars-window", "bars is [from, to] with from ≤ to");
    if (r.rule === "chord-qualities" && !r.contains && !r.anyOf && !r.subsetOf && r.min === undefined)
      add(`.rubric[${i}]`, "rubric.chord-qualities", "say what is asked: contains, anyOf, subsetOf or min");
  }
  return issues;
}

/** Every rubric rule an exercise carries: a Make's or brief's rubric, a rubric matcher (inside `all` too). */
/**
 * Structural rules of the Wave 7 additions (the advanced tracks): the planned custom rules' params, the voicing
 * expectation, two-lane taps, the grouping and Euclid answers, clave coverage, the top voice.
 */
export function checkWave7(ex: Exercise, path: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (p: string, rule: string, message: string) =>
    issues.push({ path: `${path}${p}`, rule, message });
  for (const { rule: r, path: p } of rubricRulesOf(ex)) issues.push(...checkWave7Rule(r, `${path}${p}`));
  if (ex.kind === "keyboard" && ex.expect.voicing) {
    if (ex.answer.mode !== "chord")
      add(".answer.mode", "keyboard.voicing", 'a voicing is built as one chord: `mode: "chord"`');
    if (ex.pitchMode !== "absolute")
      add(".pitchMode", "keyboard.voicing", 'a voicing shape lives in its octaves: `pitchMode: "absolute"`');
  }
  if (ex.kind === "tap" && ex.lanes) {
    const [a, b] = ex.lanes;
    if (a && b && (a.track === b.track || a.label === b.label))
      add(".lanes", "tap.lanes", "the two lanes follow two tracks, with two labels");
  }
  const correct =
    "correct" in ex && typeof ex.correct === "object" && !Array.isArray(ex.correct) ? ex.correct : undefined;
  if ("answer" in ex && ex.answer.ui === "grouping") {
    const allowed = METER_GROUPINGS[ex.answer.meter];
    if (!allowed) add(".answer.meter", "grouping.meter", `${ex.answer.meter} has no odd-meter grouping`);
    const g = correct?.grouping;
    if (correct && (!g || !allowed?.some((x) => x.length === g.length && x.every((v, i) => v === g[i]))))
      add(".correct.grouping", "grouping.correct", `one of ${ex.answer.meter}'s groupings (METER_GROUPINGS)`);
  }
  if ("answer" in ex && ex.answer.ui === "euclid") {
    const e = correct?.euclid;
    const [k, n, r] = e ?? [];
    if (correct && (k === undefined || n === undefined || k > n || n > ex.answer.maxSteps || k < 1))
      add(".correct.euclid", "euclid.correct", `[k, n(, r)] with 1 ≤ k ≤ n ≤ ${ex.answer.maxSteps}`);
    if (r !== undefined && (!ex.answer.rotation || (n !== undefined && r >= n)))
      add(
        ".correct.euclid",
        "euclid.correct",
        "a rotation needs `rotation: true` and is smaller than the step count",
      );
  }
  return issues;
}
function checkWave7Rule(r: RubricRule, path: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (p: string, rule: string, message: string) =>
    issues.push({ path: `${path}${p}`, rule, message });
  if (r.rule === "custom")
    for (const m of trackCustomParamIssues(r.fn, r.params ?? {})) add(".params", "rubric.custom-params", m);
  if (r.rule === "clave" && r.minBars !== undefined && (r.minBars < 2 || r.minBars % 2 !== 0))
    add(".minBars", "rubric.clave", "the clave is two bars long: `minBars` is an even number, at least 2");
  if (r.rule === "polyrhythm" && (r.ratio[0] === r.ratio[1] || r.ratio.some((x) => x < 2)))
    add(".ratio", "rubric.polyrhythm", "two different pulses, each of at least 2 attacks (3:2, 4:3)");
  if (r.rule === "voice-leading" && r.minRatio !== undefined && r.voice !== "top" && r.minRatio < 1)
    add(".minRatio", "voice-leading.top", 'a share of changes is read on the top voice: `voice: "top"`');
  return issues;
}

function rubricRulesOf(ex: Exercise): { rule: RubricRule; path: string }[] {
  const out: { rule: RubricRule; path: string }[] = [];
  const fromMatcher = (m: Matcher, p: string): void => {
    if (m.m === "rubric")
      for (const [i, r] of m.rules.entries()) out.push({ rule: r, path: `${p}.rules[${i}]` });
    if (m.m === "all") for (const [i, x] of m.of.entries()) fromMatcher(x, `${p}.of[${i}]`);
  };
  if (ex.kind === "code-make" || ex.kind === "compose-brief")
    for (const [i, r] of ex.rubric.entries()) out.push({ rule: r, path: `.rubric[${i}]` });
  if ("matcher" in ex && ex.matcher) fromMatcher(ex.matcher, ".matcher");
  if (ex.kind === "parsons")
    for (const [i, r] of (ex.accept.rubric ?? []).entries())
      out.push({ rule: r, path: `.accept.rubric[${i}]` });
  return out;
}
function controlsMatchersIn(
  m: Matcher | undefined,
  p: string,
): { m: Extract<Matcher, { m: "controls" }>; path: string }[] {
  if (!m) return [];
  if (m.m === "controls") return [{ m, path: p }];
  if (m.m === "all") return m.of.flatMap((x, i) => controlsMatchersIn(x, `${p}.of[${i}]`));
  return [];
}

/**
 * Structural rules of the Wave 5 additions (form answers, the bar grid, the scale builder, the controls
 * matcher, the bass-line rule, section references on rules).
 */
function checkWave5(ex: Exercise, path: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (p: string, rule: string, message: string) =>
    issues.push({ path: `${path}${p}`, rule, message });
  if ("answer" in ex && (ex.kind === "identify" || ex.kind === "fact" || ex.kind === "dictation")) {
    const ui = ex.answer;
    const correct = "correct" in ex ? ex.correct : undefined;
    if (ui.ui === "form") {
      const got = correct?.sections;
      if (!got || got.length !== ui.sections)
        add(".correct.sections", "form.correct", `one section label per section (${ui.sections})`);
      if (ui.sectionBars && ui.sectionBars.length !== ui.sections)
        add(".answer.sectionBars", "form.section-bars", "sectionBars has one entry per section");
      for (const x of got ?? []) {
        const ok =
          ui.vocabulary === "letters"
            ? /^[A-Z]$/.test(x)
            : (ui.vocabulary as readonly string[]).includes(x.replace(/\d+$/, ""));
        if (!ok) add(".correct.sections", "form.vocabulary", `"${x}" is not in the answer's vocabulary`);
      }
      if (ui.vocabulary === "letters" && got && got.join("") !== formLetters(got))
        add(".correct.sections", "form.letters", "letters go by first appearance: A first, then B, …");
      if (ui.vocabulary !== "letters")
        for (const v of ui.vocabulary)
          if (!(FORM_SECTION_NAMES as readonly string[]).includes(v))
            add(".answer.vocabulary", "form.vocabulary", `"${v}" is not a section name`);
    }
    if (ui.ui === "bar-grid") {
      const entries = ui.entry === "rn" ? correct?.rn : correct?.text;
      if (!entries || entries.length !== ui.bars)
        add(
          `.correct.${ui.entry === "rn" ? "rn" : "text"}`,
          "bar-grid.correct",
          `one ${ui.entry === "rn" ? "numeral" : "chord symbol"} per bar (${ui.bars})`,
        );
      for (const b of ui.given ?? [])
        if (b > ui.bars) add(".answer.given", "bar-grid.given", `bar ${b} is outside the chart`);
    }
    if (ui.ui === "scale-builder") {
      const d = correct?.degrees ?? [];
      if (d.length < 2 || !d.includes("1"))
        add(".correct.degrees", "scale-builder.correct", "a scale has home (1) and at least one more degree");
      if (duplicates(d).length) add(".correct.degrees", "scale-builder.correct", "each degree once");
      if (ui.input === "degrees" && ui.palette)
        for (const x of d)
          if (!ui.palette.includes(x))
            add(".answer.palette", "scale-builder.palette", `degree ${x} is an answer but not on the pad`);
    }
  }
  const controls = [
    ...("matcher" in ex ? controlsMatchersIn(ex.matcher, ".matcher") : []),
    ...(ex.kind === "staff-write" && ex.expect.e === "events"
      ? controlsMatchersIn(ex.expect.matcher, ".expect.matcher")
      : []),
  ];
  for (const { m, path: p } of controls) {
    for (const id of duplicates(m.controls.map((c) => c.control)))
      add(`${p}.controls`, "controls.unique", `control "${id}" is listed twice`);
    if (!["code-modify", "code-fill", "error-hunt", "dictation"].includes(ex.kind))
      add(
        p,
        "controls.kind",
        "a controls matcher grades code: code-modify, code-fill, error-hunt or a by-ear dictation",
      );
  }
  for (const { rule: r, path: p } of rubricRulesOf(ex)) {
    if (r.section && (r.rule === "contrast" || r.rule === "key-change"))
      add(`${p}.section`, "rubric.section", `${r.rule} names its sections itself (a, b / at)`);
    if (r.section && typeof r.section === "object" && "bars" in r.section) {
      const [a, b] = r.section.bars;
      if (a < 1 || a > b) add(`${p}.section`, "rubric.section", "bars is [from, to], 1-based, from ≤ to");
    }
    if (r.rule === "bass-line" && !r.roots && !r.members && !r.approach)
      add(p, "rubric.bass-line", "say what the bass is held to: roots, members or approach");
    if (r.rule === "degree-set" && !r.subsetOf && !r.contains && !r.anyOf)
      add(p, "rubric.degree-set", "say what is asked: subsetOf, contains or anyOf");
  }
  return issues;
}

/** A note-list duration token (packages/notation `notelist.ts`): a value, up to two dots, an optional `t`. */
const DURATION_TOKEN = /^(?:1|2|4|8|16|32)\.{0,2}t?$/;
function harmonyMatchersIn(
  m: Matcher | undefined,
  p: string,
): { m: Extract<Matcher, { m: "harmony" }>; path: string }[] {
  if (!m) return [];
  if (m.m === "harmony") return [{ m, path: p }];
  if (m.m === "all") return m.of.flatMap((x, i) => harmonyMatchersIn(x, `${p}.of[${i}]`));
  if (m.m === "rubric")
    return m.rules.flatMap((r, i) =>
      r.rule === "matches" ? harmonyMatchersIn(r.matcher, `${p}.rules[${i}].matcher`) : [],
    );
  return [];
}
/** Structural rules of one Wave 6 rubric rule; `where` says whether `@song` may be used. */
export function checkWave6Rule(r: RubricRule, path: string, songForm: boolean): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (p: string, rule: string, message: string) =>
    issues.push({ path: `${path}${p}`, rule, message });
  if (r.rule === "contains-rn") {
    if (r.rn.length === 0 && !r.kind)
      add("", "rubric.contains-rn", "say which chords: numerals in `rn`, or a `kind`");
    if (r.inOrder && (r.rn.length < 2 || r.kind))
      add(".inOrder", "rubric.contains-rn", "inOrder asks for a run of two or more numerals, without `kind`");
  }
  if (r.rule === "form") {
    for (const x of r.contains ?? [])
      if (!/^[A-Z]$/.test(x) && !(FORM_SECTION_NAMES as readonly string[]).includes(x))
        add(".contains", "rubric.form-contains", `"${x}" is not a section name or a letter`);
    if (r.pattern === "@song" && !songForm)
      add(
        ".pattern",
        "rubric.form-song",
        "`@song` is the picked song's form: only in a session rubric of a transcribe capstone",
      );
    if (r.extra && r.pattern !== "@song")
      add(".extra", "rubric.form-song", "`extra` names sections that may surround the song's own (`@song`)");
    for (const x of r.extra ?? [])
      if (!(FORM_SECTION_NAMES as readonly string[]).includes(x))
        add(".extra", "rubric.form-song", `"${x}" is not a section name`);
  }
  if (r.rule === "mode" && r.anyOf && !r.anyOf.includes(r.mode))
    add(".anyOf", "rubric.mode-any-of", "`mode` is one of `anyOf` (the one the brief shows first)");
  if (r.rule === "device-count" && r.min > r.devices.length)
    add(".min", "rubric.device-count", `min ${r.min} of ${r.devices.length} devices can never be met`);
  if (r.rule === "matches")
    for (const { m, path: p } of harmonyMatchersIn(r.matcher, ".matcher"))
      if (m.wrongQuality === "none" && (m.level === "bass" || m.level === "root"))
        add(p, "harmony.wrong-quality", "wrongQuality needs a level that reads quality: quality, rn or full");
  return issues;
}

/**
 * Structural rules of the Wave 6 additions (key plans, the pivot palette, staff duration tokens, the form
 * map, the scale builder's starting scale, the new rule fields).
 */
function checkWave6(ex: Exercise, path: string, where: "lesson" | "capstone" | "checkpoint"): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (p: string, rule: string, message: string) =>
    issues.push({ path: `${path}${p}`, rule, message });
  if (ex.keyPlan) {
    const first = ex.keyPlan[0];
    if (!ex.key)
      add(".keyPlan", "key-plan.first", "an exercise with a key plan declares `key`, its first key");
    else if (first && (first.bar > 1 || first.key.tonic !== ex.key.tonic || first.key.mode !== ex.key.mode))
      add(
        ".keyPlan[0]",
        "key-plan.first",
        "the plan starts at bar 1 (0 with a pickup) in the exercise's `key`",
      );
    ex.keyPlan.forEach((e, i) => {
      const prev = ex.keyPlan?.[i - 1];
      if (prev && e.bar <= prev.bar) add(`.keyPlan[${i}]`, "key-plan.order", "entries are in bar order");
      if (prev && e.key.tonic === prev.key.tonic && e.key.mode === prev.key.mode)
        add(`.keyPlan[${i}]`, "key-plan.order", "an entry changes the key; the same key twice is one entry");
    });
  }
  const uis: { ui: Extract<Exercise, { kind: "identify" }>["answer"]; p: string }[] = [];
  if ("answer" in ex) uis.push({ ui: ex.answer, p: ".answer" });
  if (ex.kind === "dictation")
    for (const [st, ui] of Object.entries(ex.stageAnswers ?? {}))
      if (ui) uis.push({ ui, p: `.stageAnswers.${st}` });
  const correct =
    "correct" in ex && typeof ex.correct === "object" && !Array.isArray(ex.correct) ? ex.correct : undefined;
  for (const { ui, p } of uis) {
    if (ui.ui === "rn-palette") {
      if (ui.labels && ui.labels.length !== ui.slots)
        add(`${p}.labels`, "rn-palette.labels", `one label per slot (${ui.slots})`);
      if (ui.slotKeys && ui.slotKeys.length !== ui.slots)
        add(`${p}.slotKeys`, "rn-palette.slot-keys", `one key per slot (${ui.slots})`);
    }
    if (ui.ui === "staff-input")
      for (const d of ui.palette.durations)
        if (!DURATION_TOKEN.test(d))
          add(
            `${p}.palette.durations`,
            "staff.duration-token",
            `"${d}" is not a duration token: 1 2 4 8 16, "4." dotted, "8t" a triplet eighth`,
          );
    if (ui.ui === "form" && ui.input === "map") {
      if (ui.bars === undefined)
        add(`${p}.bars`, "form.map-bars", "a form map says how many bars the tune has");
      else if (ui.sectionBars && ui.sectionBars.reduce((a, b) => a + b, 0) !== ui.bars)
        add(`${p}.sectionBars`, "form.map-bars", `the sections add up to the tune's ${ui.bars} bars`);
      const starts = correct?.bars;
      if (correct && (!starts || starts.length !== ui.sections || starts[0] !== 1))
        add(
          ".correct.bars",
          "form.map-correct",
          `the first bar of each section (${ui.sections}), starting at 1`,
        );
      else if (starts) {
        if (starts.some((b, i) => i > 0 && b <= (starts[i - 1] as number)))
          add(".correct.bars", "form.map-correct", "section starts are in order");
        const total = ui.bars;
        if (total !== undefined && starts.some((b) => b > total))
          add(".correct.bars", "form.map-correct", "a section starts inside the tune");
      }
    }
    if (ui.ui === "form" && ui.input !== "map" && ui.bars !== undefined)
      add(`${p}.bars`, "form.map-bars", '`bars` belongs to a form map (input: "map")');
    if (ui.ui === "scale-builder" && ui.from) {
      const start = MODE_DEGREES[ui.from];
      const want = correct?.degrees ?? [];
      if (want.length === start.length && want.every((d) => start.includes(d)))
        add(`${p}.from`, "scale-builder.from", "the answer is the starting scale: nothing to raise or lower");
      if (ui.input === "degrees" && ui.palette)
        for (const d of start)
          if (!ui.palette.includes(d))
            add(`${p}.palette`, "scale-builder.from", `degree ${d} of the starting scale is not on the pad`);
    }
  }
  for (const { m, path: p } of [
    ...("matcher" in ex ? harmonyMatchersIn(ex.matcher, ".matcher") : []),
    ...(ex.kind === "dictation"
      ? (ex.byEar?.parts ?? []).flatMap((x, i) => harmonyMatchersIn(x.matcher, `.byEar.parts[${i}].matcher`))
      : []),
    ...(ex.kind === "transcribe-step" && ex.grading.mode === "auto"
      ? [
          ...harmonyMatchersIn(ex.grading.matcher, ".grading.matcher"),
          ...(ex.grading.stages ?? []).flatMap((st, i) =>
            harmonyMatchersIn(st.matcher, `.grading.stages[${i}].matcher`),
          ),
        ]
      : []),
  ])
    if (m.wrongQuality === "none" && (m.level === "bass" || m.level === "root"))
      add(p, "harmony.wrong-quality", "wrongQuality needs a level that reads quality: quality, rn or full");
  for (const { rule: r, path: p } of rubricRulesOf(ex))
    issues.push(...checkWave6Rule(r, `${path}${p}`, false));
  if (ex.kind === "sing" && ex.mode === "guide-tones" && ex.target.from === "stimulus" && !ex.target.track)
    add(
      ".target",
      "sing.guide-tones-target",
      "name the guide-tone line: a `track` of the stimulus, a reference track, or degrees",
    );
  if (ex.kind === "code-make" && ex.fromSketch && where !== "lesson")
    add(".fromSketch", "make.from-sketch", "fromSketch belongs to a lesson's Make");
  return issues;
}

/**
 * Wave 5. In a key whose 3rd is ♭3 (the minors, the minor pentatonic, the blues; `MINOR_THIRD_MODES`), a
 * degree pad offers the key's own degrees: ♭3, never 3, and every degree of the right answer is on it; a sung
 * degree target is spelled the same way (do-based minor: me, le, te). `key` is the exercise's or the lesson's.
 */
export function checkMinorDegrees(ex: Exercise, key: KeySpec, path: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!MINOR_THIRD_MODES.includes(key.mode)) return issues;
  const own = MODE_DEGREES[key.mode];
  for (const e of flattenExercise(ex)) {
    const k = e.key ?? key;
    if (!MINOR_THIRD_MODES.includes(k.mode)) continue;
    const pads: { ui: Extract<Exercise, { kind: "identify" }>["answer"]; p: string }[] = [];
    if ("answer" in e && e.answer.ui === "degree-pad") pads.push({ ui: e.answer, p: ".answer" });
    if (e.kind === "dictation")
      for (const [st, ui] of Object.entries(e.stageAnswers ?? {}))
        if (ui?.ui === "degree-pad") pads.push({ ui, p: `.stageAnswers.${st}` });
    for (const { ui, p } of pads) {
      if (ui.ui !== "degree-pad") continue;
      if (ui.set.includes("3") || !ui.set.includes("b3"))
        issues.push({
          path: `${path}${p}.set`,
          rule: "minor.degree-pad",
          message: `in ${k.tonic} ${k.mode} the pad offers ♭3 (b3), not 3`,
        });
      const correct = e.kind === "identify" || e.kind === "fact" ? e.correct.degrees : undefined;
      for (const d of correct ?? [])
        if (!ui.set.includes(d))
          issues.push({
            path: `${path}${p}.set`,
            rule: "minor.degree-pad",
            message: `degree ${d} is in the answer but not on the pad`,
          });
    }
    if (e.kind === "sing" && e.target.from === "degrees")
      for (const d of e.target.degrees)
        if (d === "3" && !own.includes("3"))
          issues.push({
            path: `${path}.target.degrees`,
            rule: "minor.sung-degree",
            message: `in ${k.tonic} ${k.mode} the 3rd is ♭3 (b3, sung "me")`,
          });
  }
  return issues;
}

// --- lessons ------------------------------------------------------------------------------------

function checkStep(step: StepDef, i: number, def: LessonDef): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const path = `steps[${i}]`;
  const allowed = STEP_EXERCISE_KINDS[step.kind];
  if (allowed.length === 0 && step.exercise) {
    issues.push({
      path: `${path}.exercise`,
      rule: "step.no-exercise",
      message: `a '${step.kind}' step has no exercise`,
    });
  } else if (allowed.length > 0 && !step.exercise) {
    issues.push({
      path: `${path}.exercise`,
      rule: "step.exercise-required",
      message: `a '${step.kind}' step needs an exercise of kind ${allowed.join(" | ")}`,
    });
  } else if (step.exercise && !allowed.includes(step.exercise.kind)) {
    issues.push({
      path: `${path}.exercise.kind`,
      rule: "step.exercise-kind",
      message: `a '${step.kind}' step takes ${allowed.join(" | ")}, not '${step.exercise.kind}'`,
    });
  }
  if (
    step.kind === "run" &&
    step.exercise?.kind === "run-investigate" &&
    step.exercise.questions.length > 0
  ) {
    issues.push({
      path: `${path}.exercise.questions`,
      rule: "step.run-no-questions",
      message: "a 'run' step has no questions; use kind 'investigate'",
    });
  }
  if (step.exercise) issues.push(...checkExercise(step.exercise, `${path}.exercise`, "lesson"));
  if (step.exercise) issues.push(...checkMinorDegrees(step.exercise, def.key, `${path}.exercise`));
  if (step.ui.leadSheet && step.ui.panels.staff !== "lead")
    issues.push({
      path: `${path}.ui.leadSheet`,
      rule: "lead-sheet.staff-panel",
      message: 'a lead sheet is shown in the staff panel: set panels.staff to "lead"',
    });
  if (step.gateCheck && (i !== 0 || !step.graded || !step.exercise))
    issues.push({
      path: `${path}.gateCheck`,
      rule: "step.gate-check",
      message: "the gate's second chance is the lesson's first step, graded, with an exercise",
    });
  for (const id of duplicates(step.ui.initialPanels ?? []))
    issues.push({
      path: `${path}.ui.initialPanels`,
      rule: "step.initial-panels",
      message: `panel "${id}" is listed twice`,
    });
  if (
    step.graded &&
    (!step.exercise || ["make", "predict", "listen", "run", "see", "concept", "reflect"].includes(step.kind))
  ) {
    issues.push({
      path: `${path}.graded`,
      rule: "step.graded-kind",
      message: `a '${step.kind}' step is never one of the lesson's graded checks`,
    });
  }
  if (step.testOut) {
    if (step.kind !== "modify")
      issues.push({
        path: `${path}.testOut`,
        rule: "step.test-out-kind",
        message: "test-out is only for 'modify' steps that exercise code mechanics",
      });
    for (const id of step.testOut.skips) {
      const j = def.steps.findIndex((s) => s.id === id);
      if (j < 0)
        issues.push({
          path: `${path}.testOut.skips`,
          rule: "step.test-out-skips",
          message: `step "${id}" does not exist`,
        });
      else if (j >= i)
        issues.push({
          path: `${path}.testOut.skips`,
          rule: "step.test-out-skips",
          message: `"${id}" is not an earlier scaffold step`,
        });
    }
  }
  const unit = parseLessonId(def.id)?.unit;
  if (unit && (AUTHORING_CAPS.earlyPanelUnits as readonly string[]).includes(unit)) {
    const on = [step.ui.panels.roll, step.ui.panels.staff !== false, step.ui.panels.keyboard].filter(
      Boolean,
    ).length;
    if (on > AUTHORING_CAPS.earlyPanels)
      issues.push({
        path: `${path}.ui.panels`,
        rule: "step.early-panels",
        message: "in U00 to U04 a step enables at most 2 of roll, staff and keyboard",
      });
  }
  return issues;
}

/** Structural rules of a lesson that `defineLesson` enforces (contracts §5.8, §9.2 rules 2, 3 and 4). */
export function checkLessonStructure(def: LessonDef): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const steps = def.steps;
  steps.forEach((s, i) => {
    if (s.exercise?.kind === "code-make" && s.exercise.fromSketch === def.id)
      issues.push({
        path: `steps[${i}].exercise.fromSketch`,
        rule: "make.from-sketch",
        message: "fromSketch names an earlier lesson, not this one",
      });
  });
  for (const id of duplicates(steps.map((s) => s.id)))
    issues.push({ path: "steps", rule: "lesson.duplicate-step", message: `step id "${id}" is used twice` });
  if (steps.length > AUTHORING_CAPS.maxSteps)
    issues.push({
      path: "steps",
      rule: "lesson.max-steps",
      message: `a lesson has at most ${AUTHORING_CAPS.maxSteps} steps (found ${steps.length})`,
    });
  const last = steps[steps.length - 1];
  if (last && (last.kind !== "make" || last.optional))
    issues.push({
      path: `steps[${steps.length - 1}].kind`,
      rule: "lesson.last-step-make",
      message: "the last step is a non-optional 'make'",
    });
  const wrap = steps.findIndex((s) => s.id === def.wrapAt);
  if (wrap < 0)
    issues.push({
      path: "wrapAt",
      rule: "lesson.wrap-at",
      message: `wrapAt "${def.wrapAt}" is not a step of this lesson`,
    });
  else if (wrap === steps.length - 1 || steps[wrap]?.optional)
    issues.push({
      path: "wrapAt",
      rule: "lesson.wrap-at",
      message: "wrapAt is a non-optional step before the Make",
    });
  const graded = steps.filter((s) => s.graded).length;
  if (graded > AUTHORING_CAPS.maxGradedChecks)
    issues.push({
      path: "steps",
      rule: "lesson.max-graded",
      message: `at most ${AUTHORING_CAPS.maxGradedChecks} graded checks (found ${graded})`,
    });
  steps.forEach((step, i) => {
    issues.push(...checkStep(step, i, def));
  });
  const slugs = steps.flatMap((s) => (s.exercise ? flattenExercise(s.exercise).map((e) => e.id) : []));
  for (const id of duplicates(slugs))
    issues.push({
      path: "steps",
      rule: "lesson.duplicate-exercise",
      message: `exercise id "${id}" is used twice in this lesson`,
    });
  for (const id of duplicates(steps.flatMap((s) => (s.example ? [s.example.id] : []))))
    issues.push({
      path: "steps",
      rule: "lesson.duplicate-example",
      message: `example id "${id}" is used twice`,
    });
  for (const [i, term] of def.terms.entries()) {
    if (!steps.some((s) => s.id === term.step))
      issues.push({
        path: `terms[${i}].step`,
        rule: "lesson.term-step",
        message: `step "${term.step}" does not exist`,
      });
  }
  for (const id of duplicates(def.terms.map((t) => t.id)))
    issues.push({ path: "terms", rule: "lesson.duplicate-term", message: `term "${id}" is declared twice` });
  // An antonym pair introduced together counts as one term, so six entries is the hard ceiling here;
  // content CI applies the real limit of 3 with the glossary's `pairedWith` (countTerms).
  if (def.terms.length > AUTHORING_CAPS.maxTerms * 2)
    issues.push({
      path: "terms",
      rule: "lesson.max-terms",
      message: `at most ${AUTHORING_CAPS.maxTerms} new terms per lesson`,
    });
  for (const id of duplicates([...def.introduces, ...def.practises]))
    issues.push({
      path: "introduces",
      rule: "lesson.skill-twice",
      message: `skill "${id}" is listed twice across introduces and practises`,
    });
  return issues;
}

/** New terms of a lesson, counting an antonym pair introduced together as one (contracts §9.2 rule 5). */
export function countTerms(
  terms: LessonDef["terms"],
  glossary: readonly Pick<TermEntry, "id" | "pairedWith">[],
): number {
  const ids = new Set(terms.map((t) => t.id));
  let n = 0;
  const counted = new Set<string>();
  for (const id of ids) {
    if (counted.has(id)) continue;
    counted.add(id);
    const pair = glossary.find((g) => g.id === id)?.pairedWith;
    if (pair && ids.has(pair)) counted.add(pair);
    n++;
  }
  return n;
}

/**
 * The lesson-local rules of content CI that are too strict for a definition-time throw: budgets
 * (contracts §9.2, §9.4) and the test requirements of AUTHORING §8.
 */
export function checkLessonAuthoring(
  def: LessonDef,
  glossary: readonly Pick<TermEntry, "id" | "pairedWith">[] = [],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const b = lessonBudget(def);
  const round = (x: number): string => x.toFixed(2);
  if (b.scaledMinutes > AUTHORING_CAPS.lessonScaledMinutes + 1e-9) {
    issues.push({
      path: "steps",
      rule: "budget.lesson",
      message: `scaled content is ${round(b.scaledMinutes)} min (expert ${round(b.expertMinutes)} × 1.4); the cap is ${AUTHORING_CAPS.lessonScaledMinutes}`,
    });
  }
  if (b.optionalScaledMinutes > AUTHORING_CAPS.optionalScaledMinutes + 1e-9) {
    issues.push({
      path: "steps",
      rule: "budget.optional",
      message: `optional steps add ${round(b.optionalScaledMinutes)} scaled min; the cap is ${AUTHORING_CAPS.optionalScaledMinutes}`,
    });
  }
  if (b.splitsAt15 && b.partAScaled > AUTHORING_CAPS.splitPartAScaled + 1e-9) {
    issues.push({
      path: "wrapAt",
      rule: "budget.split-a",
      message: `part A (up to ${def.wrapAt}) is ${round(b.partAScaled)} scaled min; the cap is ${AUTHORING_CAPS.splitPartAScaled}`,
    });
  }
  if (b.splitsAt15 && b.partBScaled > AUTHORING_CAPS.splitPartBScaled + 1e-9) {
    issues.push({
      path: "wrapAt",
      rule: "budget.split-b",
      message: `part B (after ${def.wrapAt}) is ${round(b.partBScaled)} scaled min; the cap is ${AUTHORING_CAPS.splitPartBScaled}`,
    });
  }
  const terms = countTerms(def.terms, glossary);
  if (terms > AUTHORING_CAPS.maxTerms)
    issues.push({
      path: "terms",
      rule: "lesson.max-terms",
      message: `at most ${AUTHORING_CAPS.maxTerms} new terms per lesson (found ${terms})`,
    });
  def.steps.forEach((step, i) => {
    if (!step.exercise) return;
    for (const ex of flattenExercise(step.exercise)) {
      const path = `steps[${i}].exercise(${ex.id})`;
      if (ex.kind === "code-make") {
        const pass = ex.tests.filter((t) => t.expect === "pass").length;
        const fail = ex.tests.filter((t) => t.expect === "fail").length;
        if (pass < 2 || fail < 1)
          issues.push({
            path: `${path}.tests`,
            rule: "tests.make",
            message: "a Make needs a minimal passing sketch, a richer passing sketch and one failing sketch",
          });
      } else if ((CODE_KINDS as readonly string[]).includes(ex.kind) && ex.kind !== "compose-brief") {
        const pass = ex.tests.filter((t) => t.expect === "pass").length;
        const failCodes = new Set(
          ex.tests.filter((t) => t.expect === "fail").flatMap((t) => t.feedback ?? []),
        );
        const fails = ex.tests.filter((t) => t.expect === "fail").length;
        if (pass < 1)
          issues.push({
            path: `${path}.tests`,
            rule: "tests.code-pass",
            message: "a code exercise needs at least one passing test",
          });
        if (fails < 2 || failCodes.size < 2)
          issues.push({
            path: `${path}.tests`,
            rule: "tests.code-fail",
            message: "a code exercise needs at least two failing tests with distinct feedback codes",
          });
      }
    }
  });
  return issues;
}

/** Validates and freezes a lesson. Throws `ContentDefinitionError`. */
export function defineLesson(def: LessonDef): LessonDef {
  return define(
    `lesson ${String((def as { id?: unknown })?.id ?? "?")}`,
    LessonDefSchema,
    def,
    checkLessonStructure,
  );
}

// --- everything else ----------------------------------------------------------------------------

export function defineUnit(def: UnitDef): UnitDef {
  return define(`unit ${def?.id}`, UnitDefSchema, def, (u) => {
    const issues: ContentIssue[] = [];
    for (const id of duplicates(u.lessons.map((l) => l.id)))
      issues.push({
        path: "lessons",
        rule: "unit.duplicate-lesson",
        message: `lesson "${id}" is listed twice`,
      });
    u.lessons.forEach((l, i) => {
      if (parseLessonId(l.id)?.unit !== u.id)
        issues.push({
          path: `lessons[${i}].id`,
          rule: "unit.lesson-unit",
          message: `lesson "${l.id}" does not belong to unit ${u.id}`,
        });
    });
    if ((u.id.startsWith("U") ? "core" : u.id[0]) !== u.track)
      issues.push({
        path: "track",
        rule: "unit.track",
        message: `unit ${u.id} is not in track "${u.track}"`,
      });
    u.lessons.forEach((l, i) => {
      if (l.side && (u.track === "core" || !l.optional))
        issues.push({
          path: `lessons[${i}].side`,
          rule: "unit.side-lesson",
          message: "a side lesson is an optional lesson of a track (optional: true, outside the core)",
        });
    });
    u.lessons.forEach((l, i) => {
      if (!l.splitFrom) return;
      const at = u.lessons.findIndex((x) => x.id === l.splitFrom);
      if (at < 0 || at >= i)
        issues.push({
          path: `lessons[${i}].splitFrom`,
          rule: "unit.split-from",
          message: `"${l.splitFrom}" is a lesson of ${u.id} that comes before ${l.id} in the unit's order`,
        });
    });
    if (u.checkpoint && u.track === "core" && !u.checkpoint.startsWith(u.id))
      issues.push({
        path: "checkpoint",
        rule: "unit.checkpoint",
        message: `checkpoint "${u.checkpoint}" does not close unit ${u.id}`,
      });
    return issues;
  });
}

export function defineFamily<L extends LevelParams = LevelParams>(def: FamilyDef<L>): FamilyDef<L> {
  return define(`family ${def?.id}`, FamilyDefSchema as unknown as z.ZodType<FamilyDef<L>>, def, (f) => {
    const issues: ContentIssue[] = [];
    const cats = new Set(f.categories.map((c) => c.id));
    for (const id of duplicates(f.categories.map((c) => c.id)))
      issues.push({
        path: "categories",
        rule: "family.duplicate-category",
        message: `category "${id}" is declared twice`,
      });
    f.levels.forEach((level, i) => {
      for (const c of level.categories)
        if (!cats.has(c))
          issues.push({
            path: `levels[${i}].categories`,
            rule: "family.unknown-category",
            message: `category "${c}" is not declared in categories`,
          });
      if (level.tempo[0] > level.tempo[1])
        issues.push({
          path: `levels[${i}].tempo`,
          rule: "family.tempo-range",
          message: "tempo is [min, max]",
        });
    });
    if (f.masteryLevel > f.levels.length)
      issues.push({
        path: "masteryLevel",
        rule: "family.mastery-level",
        message: `masteryLevel ${f.masteryLevel} is above the ${f.levels.length} levels defined`,
      });
    for (const level of Object.keys(f.unlock.levelGates ?? {})) {
      if (Number(level) > f.levels.length)
        issues.push({
          path: "unlock.levelGates",
          rule: "family.level-gate",
          message: `level ${level} does not exist`,
        });
    }
    const composite = f.id.startsWith("fam.mix.");
    if (!composite && f.kind === "concept" && f.mix !== null)
      issues.push({
        path: "mix",
        rule: "family.concept-mix",
        message: "a concept family joins no composite",
      });
    if (!composite && f.kind !== "concept" && f.retention !== 0.85)
      issues.push({
        path: "retention",
        rule: "family.retention",
        message: "perceptual and production families use desired retention 0.85",
      });
    if (f.kind === "concept" && f.retention !== 0.9)
      issues.push({
        path: "retention",
        rule: "family.retention",
        message: "concept families use desired retention 0.90",
      });
    for (const c of f.categories)
      for (const n of c.contrastOf ?? [])
        if (!cats.has(n))
          issues.push({
            path: "categories",
            rule: "family.unknown-category",
            message: `contrast neighbour "${n}" of "${c.id}" is not a category`,
          });
    return issues;
  });
}

export function defineDeck(def: FactDeck): FactDeck {
  return define(`deck ${def?.id}`, FactDeckSchema, def, (d) =>
    duplicates(d.cards.map((c) => c.id)).map((id) => ({
      path: "cards",
      rule: "deck.duplicate-card",
      message: `card "${id}" is declared twice`,
    })),
  );
}

export function defineTool(def: ToolEntry): ToolEntry {
  return define(`tool ${def?.id}`, ToolEntrySchema, def, (t) => {
    const issues: ContentIssue[] = [];
    const prefix = t.id.split(".")[0];
    const expected: Record<string, string[]> = {
      tb: ["tool", "feature", "template", "lens"],
      snd: ["sound"],
      scale: ["scale"],
      chord: ["chord"],
    };
    if (!expected[prefix as string]?.includes(t.kind))
      issues.push({ path: "kind", rule: "tool.kind", message: `"${t.id}" cannot have kind '${t.kind}'` });
    const sub = t.id.split(".")[1];
    for (const k of ["feature", "template", "lens"] as const) {
      if (prefix === "tb" && (sub === k) !== (t.kind === k))
        issues.push({
          path: "kind",
          rule: "tool.kind",
          message: `tb.${k}.* IDs and kind '${k}' go together`,
        });
    }
    if (t.unlock.fallbackAt && t.unlock.when !== "start")
      issues.push({
        path: "unlock.fallbackAt",
        rule: "tool.fallback",
        message: "only START rows have a fallback site (contracts §3.1 rule 12)",
      });
    return issues;
  });
}

/** The whole unlock table: every entry valid and each ID with exactly one row (contracts §3.1 rule 10). */
export function defineToolbox(entries: readonly ToolEntry[]): readonly ToolEntry[] {
  const defined = entries.map(defineTool);
  const dup = duplicates(defined.map((e) => e.id));
  if (dup.length > 0)
    throw new ContentDefinitionError(
      "toolbox",
      dup.map((id) => ({ path: id, rule: "toolbox.duplicate", message: `"${id}" has more than one row` })),
    );
  return Object.freeze(defined);
}

export function defineSkill(def: SkillDef): SkillDef {
  return define(`skill ${def?.id}`, SkillDefSchema, def, (s) => {
    const issues: ContentIssue[] = [];
    if (s.prerequisites.includes(s.id))
      issues.push({
        path: "prerequisites",
        rule: "skill.self-prerequisite",
        message: "a skill is not its own prerequisite",
      });
    for (const id of duplicates(s.prerequisites))
      issues.push({
        path: "prerequisites",
        rule: "skill.duplicate-prerequisite",
        message: `"${id}" is listed twice`,
      });
    return issues;
  });
}

/** The skill graph: every node valid, no duplicate, every prerequisite a known node, no cycle. */
export function defineSkills(defs: readonly SkillDef[]): readonly SkillDef[] {
  const defined = defs.map(defineSkill);
  const issues: ContentIssue[] = duplicates(defined.map((d) => d.id)).map((id) => ({
    path: id,
    rule: "skills.duplicate",
    message: `"${id}" is defined twice`,
  }));
  const byId = new Map(defined.map((d) => [d.id as string, d]));
  for (const d of defined)
    for (const p of d.prerequisites)
      if (!byId.has(p))
        issues.push({
          path: `${d.id}.prerequisites`,
          rule: "skills.unknown-prerequisite",
          message: `"${p}" is not a skill node`,
        });
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, trail: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      issues.push({
        path: id,
        rule: "skills.cycle",
        message: `prerequisite cycle: ${[...trail.slice(trail.indexOf(id)), id].join(" → ")}`,
      });
      return;
    }
    state.set(id, 1);
    for (const p of byId.get(id)?.prerequisites ?? []) if (byId.has(p)) visit(p, [...trail, id]);
    state.set(id, 2);
  };
  for (const d of defined) visit(d.id, []);
  if (issues.length > 0) throw new ContentDefinitionError("skill graph", issues);
  return Object.freeze(defined);
}

export function defineSong(def: SongDef): SongDef {
  return define(`song ${def?.id}`, SongDefSchema, def, (s) => {
    const issues: ContentIssue[] = [];
    if (s.status === "trad" && s.year !== "trad" && s.year > 1930)
      issues.push({
        path: "year",
        rule: "song.public-domain",
        message: "nothing first published after 1930 ships",
      });
    for (const [i, c] of (s.answerKey.chords ?? []).entries()) {
      if (c.symbol.includes("/"))
        issues.push({
          path: `answerKey.chords[${i}].symbol`,
          rule: "song.slash-chord",
          message: "slash chords are never written in code spelling; the bass track sets the inversion",
        });
      if (c.bar < 0 || c.bar > s.answerKey.bars)
        issues.push({
          path: `answerKey.chords[${i}].bar`,
          rule: "song.chord-bar",
          message: `bar ${c.bar} is outside the tune`,
        });
    }
    const sections = s.answerKey.sections;
    if (sections) {
      let next = 1;
      sections.forEach((x, i) => {
        if (x.bars[0] !== next || x.bars[1] < x.bars[0])
          issues.push({
            path: `answerKey.sections[${i}].bars`,
            rule: "song.sections",
            message: `sections follow one another without gaps: this one starts at bar ${next}`,
          });
        next = x.bars[1] + 1;
      });
      if (next - 1 !== s.answerKey.bars)
        issues.push({
          path: "answerKey.sections",
          rule: "song.sections",
          message: `the sections end at bar ${next - 1}; the tune has ${s.answerKey.bars}`,
        });
    }
    if (s.keyPlan) {
      const first = s.keyPlan[0];
      if (first && (first.bar > 1 || first.key.tonic !== s.key.tonic || first.key.mode !== s.key.mode))
        issues.push({
          path: "keyPlan[0]",
          rule: "song.key-plan",
          message: "the plan starts at bar 1 (0 with a pickup) in the song's `key`",
        });
      s.keyPlan.forEach((e, i) => {
        const prev = s.keyPlan?.[i - 1];
        if (prev && e.bar <= prev.bar)
          issues.push({ path: `keyPlan[${i}]`, rule: "song.key-plan", message: "entries are in bar order" });
        if (e.bar > s.answerKey.bars)
          issues.push({
            path: `keyPlan[${i}]`,
            rule: "song.key-plan",
            message: `bar ${e.bar} is outside the tune`,
          });
      });
    }
    return issues;
  });
}

export function defineCapstone(def: CapstoneDef): CapstoneDef {
  return define(`capstone ${def?.id}`, CapstoneDefSchema, def, (c) => {
    const issues: ContentIssue[] = [];
    if (c.sessionDefs.length !== c.sessions)
      issues.push({
        path: "sessionDefs",
        rule: "capstone.sessions",
        message: `${c.sessions} sessions declared, ${c.sessionDefs.length} defined`,
      });
    c.sessionDefs.forEach((s, i) => {
      if (s.id !== `${c.id}.S${i + 1}`)
        issues.push({
          path: `sessionDefs[${i}].id`,
          rule: "capstone.session-id",
          message: `expected "${c.id}.S${i + 1}"`,
        });
    });
    if (c.kind === "compose" && !c.brief)
      issues.push({ path: "brief", rule: "capstone.brief", message: "a compose capstone has a brief" });
    if (c.versions) {
      const ids = new Set(c.sessionDefs.map((s) => s.id as string));
      const [a, b] = c.versions;
      if (c.kind !== "compose")
        issues.push({
          path: "versions",
          rule: "capstone.versions",
          message: "only a compose capstone has versions",
        });
      for (const [i, v] of c.versions.entries())
        if (!ids.has(v.startsIn))
          issues.push({
            path: `versions[${i}].startsIn`,
            rule: "capstone.versions",
            message: `${v.startsIn} is not a session of ${c.id}`,
          });
      if (a && b && a.startsIn >= b.startsIn)
        issues.push({
          path: "versions",
          rule: "capstone.versions",
          message: "version a starts in an earlier session than version b",
        });
    }
    if (c.kind === "transcribe" && (!c.song || c.song.length === 0))
      issues.push({
        path: "song",
        rule: "capstone.song",
        message: "a transcription capstone names its song pool",
      });
    const releases = c.sessionDefs.flatMap((s, i) => (s.release ? [i] : []));
    if (releases.length > 1 || (releases.length === 1 && releases[0] !== c.sessionDefs.length - 1))
      issues.push({
        path: "sessionDefs",
        rule: "capstone.release-last",
        message: "only the last session releases the piece",
      });
    const checkIds = c.sessionDefs.flatMap((s) => [
      ...(s.formMap ? [s.formMap.id] : []),
      ...(s.checks ?? []).map((x) => x.id),
    ]);
    for (const id of duplicates(checkIds))
      issues.push({ path: "sessionDefs", rule: "capstone.check-id", message: `check "${id}" is used twice` });
    c.sessionDefs.forEach((s, i) => {
      if (s.checks && c.kind !== "transcribe")
        issues.push({
          path: `sessionDefs[${i}].checks`,
          rule: "capstone.checks-transcribe",
          message: "phrase checks belong to a transcribe capstone",
        });
      for (const [j, x] of (s.checks ?? []).entries()) {
        const p = `sessionDefs[${i}].checks[${j}]`;
        if (x.stages && x.layer !== "chords")
          issues.push({
            path: `${p}.stages`,
            rule: "capstone.check-stages",
            message: "stages are for chords",
          });
        if (x.stages && !stagesInOrder(x.stages))
          issues.push({
            path: `${p}.stages`,
            rule: "capstone.check-stages",
            message: "chord stages run bass → quality → rn, once each",
          });
        const earlier = c.sessionDefs
          .slice(0, i + 1)
          .flatMap((t, k) => [
            ...(t.formMap ? [t.formMap.id] : []),
            ...(t.checks ?? []).slice(0, k === i ? j : undefined).map((y) => y.id),
          ]);
        for (const a of x.after ?? [])
          if (!earlier.includes(a))
            issues.push({
              path: `${p}.after`,
              rule: "capstone.check-after",
              message: `"${a}" is not a check defined before this one`,
            });
        if (Array.isArray(x.phrase) && x.phrase[0] > x.phrase[1])
          issues.push({
            path: `${p}.phrase`,
            rule: "capstone.check-phrase",
            message: "phrase [from, to], from ≤ to",
          });
      }
      if (s.formMap && c.kind !== "transcribe")
        issues.push({
          path: `sessionDefs[${i}].formMap`,
          rule: "capstone.form-map",
          message: "a form map belongs to a transcribe capstone",
        });
      if (s.rubric && c.kind !== "transcribe")
        issues.push({
          path: `sessionDefs[${i}].rubric`,
          rule: "capstone.session-rubric",
          message:
            "a compose capstone keeps its rules in the brief; a session rubric is for a transcribe capstone",
        });
      for (const id of duplicates((s.rubric ?? []).map((r) => r.id)))
        issues.push({
          path: `sessionDefs[${i}].rubric`,
          rule: "rubric.duplicate-rule",
          message: `rule id "${id}" is used twice`,
        });
      for (const [j, r] of (s.rubric ?? []).entries())
        issues.push(...checkWave6Rule(r, `sessionDefs[${i}].rubric[${j}]`, true));
      for (const [j, st] of (s.stages ?? []).entries())
        issues.push(...checkExercise(st, `sessionDefs[${i}].stages[${j}]`, "capstone"));
    });
    if (c.brief) {
      issues.push(...checkExercise(c.brief, "brief", "capstone"));
      if (!c.brief.rubric.some((r) => r.required))
        issues.push({
          path: "brief.rubric",
          rule: "capstone.required-rules",
          message: "a capstone rubric has required rules",
        });
      const ruleIds = new Set(c.brief.rubric.map((r) => r.id));
      c.sessionDefs.forEach((s, i) => {
        for (const id of s.focusRules ?? [])
          if (!ruleIds.has(id))
            issues.push({
              path: `sessionDefs[${i}].focusRules`,
              rule: "capstone.focus-rule",
              message: `rule "${id}" is not in the rubric`,
            });
      });
    }
    return issues;
  });
}

export function defineCheckpoint(def: CheckpointDef): CheckpointDef {
  return define(`checkpoint ${def?.id}`, CheckpointDefSchema, def, (c) => {
    const issues: ContentIssue[] = [];
    c.authored.forEach((ex, i) => {
      for (const e of flattenExercise(ex)) {
        if (e.role !== "checkpoint")
          issues.push({
            path: `authored[${i}].role`,
            rule: "checkpoint.role",
            message: "checkpoint items have role 'checkpoint'",
          });
        if (e.hints !== null)
          issues.push({
            path: `authored[${i}].hints`,
            rule: "checkpoint.no-hints",
            message: "hints and the tutor are off in a checkpoint",
          });
      }
      issues.push(...checkExercise(ex, `authored[${i}]`, "checkpoint"));
    });
    issues.push(...checkExercise(c.make, "make", "lesson"));
    if (c.recipe.items[0] > c.recipe.items[1])
      issues.push({ path: "recipe.items", rule: "checkpoint.items", message: "items is [min, max]" });
    for (const id of duplicates([...c.gated, ...c.levelSetting]))
      issues.push({
        path: "gated",
        rule: "checkpoint.skill-twice",
        message: `skill "${id}" is both gated and level-setting`,
      });
    return issues;
  });
}

export function defineBand(def: BandDef): BandDef {
  return define(`band ${def?.id}`, BandDefSchema, def, (b) => {
    const issues: ContentIssue[] = [];
    for (const [flavour, code] of Object.entries(b.code)) {
      for (const role of b.roles)
        if (!new RegExp(`^${role}:`, "m").test(code))
          issues.push({ path: `code.${flavour}`, rule: "band.role-track", message: `no "${role}:" track` });
      if (b.params.bpm && !code.includes("{{bpm}}"))
        issues.push({
          path: `code.${flavour}`,
          rule: "band.bpm-param",
          message: "params.bpm is set but the code has no {{bpm}}",
        });
      if (b.params.key && !code.includes("{{key}}"))
        issues.push({
          path: `code.${flavour}`,
          rule: "band.key-param",
          message: "params.key is set but the code has no {{key}}",
        });
    }
    return issues;
  });
}

/**
 * A unit's song (spec 2026-11-24 §5.1): the schema and its cross-field rules, then frozen. Unlike the other
 * define* helpers it throws the `ZodError` itself: `issues` carry their paths (`plan.3.sections.0`), and the
 * message lists them readably ("✖ … → at plan[3].sections[0]") for content:check and the server's load report.
 */
export function defineUnitSong(def: UnitSongDef): UnitSongDef {
  const result = unitSongSchema.safeParse(def);
  if (!result.success) {
    const message = `unit song ${def?.id} is not valid:\n${prettifyError(result.error)}`;
    Object.defineProperty(result.error, "message", { value: message, configurable: true, writable: true });
    throw result.error;
  }
  return deepFreeze(def);
}

export const defineFlavour = (def: FlavourKit): FlavourKit =>
  define(`flavour ${def?.id}`, FlavourKitSchema, def);
export const defineTerm = (def: TermEntry): TermEntry => define(`term ${def?.id}`, TermEntrySchema, def);
export const defineCanDo = (def: CanDoDef): CanDoDef => define(`can-do ${def?.id}`, CanDoDefSchema, def);
export const defineMilestone = (def: MilestoneDef): MilestoneDef =>
  define(`milestone ${def?.id}`, MilestoneDefSchema, def);
