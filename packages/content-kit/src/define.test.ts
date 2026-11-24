import { describe, expect, test } from "bun:test";
import { lessonBudget } from "./budget.ts";
import {
  ContentDefinitionError,
  checkLessonAuthoring,
  countTerms,
  defineBand,
  defineCapstone,
  defineFamily,
  defineFlavour,
  defineLesson,
  defineSkill,
  defineSkills,
  defineSong,
  defineTool,
  defineToolbox,
  defineUnit,
  schemaIssues,
} from "./define.ts";
import { ladder, lessonU01L02, mutable, ui } from "./fixtures.test-data.ts";
import { IMPLEMENTED, unimplementedInLesson } from "./implemented.ts";
import type {
  CodeModifyEx,
  Exercise,
  FamilyDef,
  LessonDef,
  SkillDef,
  SongDef,
  ToolEntry,
} from "./schema/index.ts";
import { EXERCISE_KINDS, RUBRIC_RULE_NAMES } from "./schema/index.ts";
import { ExerciseSchema, GradeResultSchema, MatcherSchema, RatSchema, RubricRuleSchema } from "./zod.ts";

function exAt<T extends Exercise = Exercise>(def: LessonDef, i: number): T {
  const ex = def.steps[i]?.exercise;
  if (!ex) throw new Error(`fixture: step ${i} has no exercise`);
  return ex as T;
}

function rulesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ContentDefinitionError) return e.issues.map((i) => i.rule);
    throw e;
  }
  return [];
}
function issuesOf(fn: () => unknown): { path: string; rule: string }[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ContentDefinitionError) return e.issues.map(({ path, rule }) => ({ path, rule }));
    throw e;
  }
  return [];
}

describe("defineLesson", () => {
  test("accepts the AUTHORING §8 skeleton and freezes it", () => {
    const lesson = defineLesson(lessonU01L02());
    expect(lesson.id).toBe("U01.L02");
    expect(Object.isFrozen(lesson)).toBe(true);
    expect(Object.isFrozen(lesson.steps[0]?.ui.panels)).toBe(true);
  });

  test("an unknown key is an error with its path (strict objects catch typos)", () => {
    const def = mutable(lessonU01L02()) as LessonDef & { steps: { titel?: string }[] };
    (def.steps[0] as { titel?: string }).titel = "typo";
    const issues = issuesOf(() => defineLesson(def));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({ path: "steps[0]", rule: "schema" });
  });

  test("reports the deepest issue of a failed exercise union, not 'invalid union'", () => {
    const def = mutable(lessonU01L02());
    (exAt<CodeModifyEx>(def, 3).matcher as { tol: unknown }).tol = [2, 4];
    const err = (() => {
      try {
        defineLesson(def);
      } catch (e) {
        return e as ContentDefinitionError;
      }
    })();
    expect(err?.issues).toHaveLength(1);
    expect(err?.issues[0]?.path).toBe("steps[3].exercise.matcher.tol");
    expect(err?.issues[0]?.message).toContain("reduced");
  });

  test("bad IDs are rejected by grammar", () => {
    const def = mutable(lessonU01L02());
    (def as { id: string }).id = "u01.02";
    (def.introduces as string[])[0] = "rhy.rests";
    (def.canDo as string[])[0] = "cando.count";
    expect(issuesOf(() => defineLesson(def)).map((i) => i.path)).toEqual(["id", "introduces[0]", "canDo[0]"]);
  });

  test("the last step is a Make; wrapAt is a real earlier step", () => {
    const noMake = mutable(lessonU01L02());
    noMake.steps.pop();
    expect(rulesOf(() => defineLesson(noMake))).toContain("lesson.last-step-make");

    const badWrap = mutable(lessonU01L02());
    badWrap.wrapAt = "S9";
    expect(rulesOf(() => defineLesson(badWrap))).toEqual(["lesson.wrap-at"]);

    const wrapOnMake = mutable(lessonU01L02());
    wrapOnMake.wrapAt = "S7";
    expect(rulesOf(() => defineLesson(wrapOnMake))).toEqual(["lesson.wrap-at"]);
  });

  test("a lesson Make has exactly one required rule (contracts §6.5)", () => {
    for (const required of [0, 2]) {
      const def = mutable(lessonU01L02());
      const make = def.steps[4]?.exercise;
      if (make?.kind !== "code-make") throw new Error("fixture");
      make.rubric.forEach((r, i) => {
        r.required = i < required;
      });
      expect(rulesOf(() => defineLesson(def))).toEqual(["make.one-required-rule"]);
    }
  });

  test("hints may be null only for predict, listen and checkpoint items", () => {
    const def = mutable(lessonU01L02());
    exAt(def, 3).hints = null;
    expect(issuesOf(() => defineLesson(def))).toEqual([
      { path: "steps[3].exercise.hints", rule: "exercise.hints-required" },
    ]);
  });

  test("the ladder is a 4-tuple: three hints and a reveal", () => {
    const def = mutable(lessonU01L02());
    (exAt(def, 3) as { hints: unknown }).hints = [{ text: "one" }, { text: "two" }, "auto"];
    expect(issuesOf(() => defineLesson(def))[0]?.path).toStartWith("steps[3].exercise.hints");
  });

  test("step kind and exercise kind must agree (contracts §5.8)", () => {
    const def = mutable(lessonU01L02());
    (def.steps[3] as { kind: string }).kind = "ear";
    expect(rulesOf(() => defineLesson(def))).toEqual(["step.exercise-kind"]);

    const noEx = mutable(lessonU01L02());
    delete noEx.steps[0]?.exercise;
    expect(rulesOf(() => defineLesson(noEx))).toEqual(["step.exercise-required"]);

    const extra = mutable(lessonU01L02());
    (extra.steps[2] as { exercise?: Exercise }).exercise = mutable(exAt(extra, 0));
    expect(rulesOf(() => defineLesson(extra))).toContain("step.no-exercise");
  });

  test("a sing exercise must declare a fallback (contracts §8.5)", () => {
    const def = mutable(lessonU01L02());
    const sing: Exercise = {
      kind: "sing",
      id: "sing-one",
      version: 1,
      role: "practice",
      prompt: "Sing one.",
      skills: [{ skill: "V01", w: 1 }],
      hints: ladder,
      tests: [],
      mode: "degree",
      stimulus: { src: "generator", family: "fam.deg.sing", level: 1 },
      cue: { context: "cadence", countInBars: 1, click: false, replays: 2 },
      target: { from: "degrees", degrees: ["1"] },
      tol: { cents: "learner", octave: "per-note", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
      showTrace: "after",
    };
    def.steps.splice(4, 0, { id: "S5", kind: "sing", title: "Sing home", minutes: 1.5, ui, exercise: sing });
    expect(rulesOf(() => defineLesson(def))).toEqual(["exercise.sing-fallback"]);
    (sing as { fallback?: string }).fallback = "identify";
    expect(rulesOf(() => defineLesson(def))).toEqual([]);
  });

  test("params must be declared and used (contracts §5.5)", () => {
    const def = mutable(lessonU01L02());
    const ex = exAt<CodeModifyEx>(def, 3);
    ex.constraints = [{ c: "tempo", bpm: { param: "target" }, tol: 4 }];
    expect(rulesOf(() => defineLesson(def))).toEqual(["params.undeclared"]);
    ex.params = {
      target: { gen: "int", min: 70, max: 140, awayFrom: { value: 100, by: 15 } },
      unused: { gen: "choice", of: [1, 2] },
    };
    expect(rulesOf(() => defineLesson(def))).toEqual(["params.unused"]);
    delete ex.params.unused;
    (ex.hints as unknown as { text: string }[])[2] = { text: "setcpm({{param:target}}/4)" };
    expect(rulesOf(() => defineLesson(def))).toEqual([]);
  });

  test("in U00 to U04 a step shows at most two of roll, staff, keyboard", () => {
    const def = mutable(lessonU01L02());
    (def.steps[0] as { ui: unknown }).ui = { panels: { roll: true, staff: "perc", keyboard: true } };
    expect(rulesOf(() => defineLesson(def))).toEqual(["step.early-panels"]);
    (def as { id: string }).id = "U05.L02";
    expect(rulesOf(() => defineLesson(def))).toEqual([]);
  });

  test("duplicate step and exercise IDs, graded cap, starter markers", () => {
    const dup = mutable(lessonU01L02());
    (dup.steps[1] as { id: string }).id = "S1";
    expect(rulesOf(() => defineLesson(dup))).toContain("lesson.duplicate-step");

    const markers = mutable(lessonU01L02());
    exAt<CodeModifyEx>(markers, 3).code.starter = 's("⟪bd bd")';
    expect(rulesOf(() => defineLesson(markers))).toEqual(["starter.markers"]);

    const graded = mutable(lessonU01L02());
    (graded.steps[4] as { graded?: boolean }).graded = true;
    expect(rulesOf(() => defineLesson(graded))).toEqual(["step.graded-kind"]);
  });
});

describe("budgets and authoring rules (content CI)", () => {
  test("lessonBudget applies the 1.4 factor and the wrapAt split", () => {
    const b = lessonBudget(lessonU01L02());
    expect(b.expertMinutes).toBe(6);
    expect(b.scaledMinutes).toBeCloseTo(8.4, 10);
    expect(b.partAScaled).toBeCloseTo(4.9, 10);
    expect(b.partBScaled).toBeCloseTo(3.5, 10);
    expect(b.splitsAt15).toBe(false);
    expect(b.gradedChecks).toBe(1);
  });

  test("9.25 expert minutes is the most that fits 13 scaled minutes", () => {
    const def = mutable(lessonU01L02());
    (def.steps[2] as { minutes: number }).minutes = 4.25; // 9.25 in total
    expect(lessonBudget(def).expertMinutes).toBe(9.25);
    expect(checkLessonAuthoring(def).map((i) => i.rule)).not.toContain("budget.lesson");
    (def.steps[2] as { minutes: number }).minutes = 4.5; // 9.5 × 1.4 = 13.3
    expect(checkLessonAuthoring(def).map((i) => i.rule)).toContain("budget.lesson");
  });

  test("the skeleton meets the test requirements of AUTHORING §8", () => {
    expect(checkLessonAuthoring(lessonU01L02())).toEqual([]);
    const def = mutable(lessonU01L02());
    exAt<CodeModifyEx>(def, 3).tests.splice(3, 2);
    expect(checkLessonAuthoring(def).map((i) => i.rule)).toEqual(["tests.code-fail"]);
  });

  test("an antonym pair introduced together counts as one term", () => {
    const terms = lessonU01L02().terms;
    expect(countTerms(terms, [])).toBe(2);
    expect(countTerms(terms, [{ id: "term.downbeat", pairedWith: "term.rest" }])).toBe(1);
  });

  test("the skeleton uses only what Wave 1 implements", () => {
    expect(unimplementedInLesson(lessonU01L02())).toEqual([]);
    expect(
      unimplementedInLesson(lessonU01L02(), { ...IMPLEMENTED, rubricRules: ["uses"], constraints: [] }).map(
        (u) => `${u.what}:${u.name}`,
      ),
    ).toEqual(["constraint:must-use", "constraint:edit-only-regions", "rubric-rule:onsets"]);
  });
});

describe("schemas", () => {
  test("Rat is reduced with a positive denominator", () => {
    expect(RatSchema.safeParse([1, 2]).success).toBe(true);
    expect(RatSchema.safeParse([0, 1]).success).toBe(true);
    expect(RatSchema.safeParse([2, 4]).success).toBe(false);
    expect(RatSchema.safeParse([1, 0]).success).toBe(false);
    expect(RatSchema.safeParse([0.5, 1]).success).toBe(false);
  });

  test("an explicit undefined is not accepted for an optional field (exactOptionalPropertyTypes)", () => {
    expect(MatcherSchema.safeParse({ m: "pcset", perOnset: true, bass: true }).success).toBe(true);
    expect(
      MatcherSchema.safeParse({ m: "pcset", perOnset: true, bass: true, tracks: undefined }).success,
    ).toBe(false);
  });

  test("matchers and rubric rules nest in both directions", () => {
    const rule = {
      id: "same-tune",
      label: "Melody identical to the reference",
      required: true,
      skills: ["M02"],
      rule: "matches",
      min: 1,
    };
    const nested = {
      m: "all",
      of: [
        { m: "events", pitch: "octave-free", rhythm: "exact", durations: false },
        {
          m: "rubric",
          rules: [
            {
              ...rule,
              reference: { solutions: ['n("0 2 4")'], bars: 1 },
              matcher: { m: "melody", pitch: "key-relative", wPitch: 0.7, wRhythm: 0.3, rhythmTol: [0, 1] },
            },
          ],
        },
      ],
    };
    expect(schemaIssues(MatcherSchema, nested)).toEqual([]);
    expect(
      schemaIssues(MatcherSchema, {
        m: "all",
        of: [{ m: "rubric", rules: [{ ...rule, matcher: { m: "nope" } }] }],
      }).length,
    ).toBeGreaterThan(0);
  });

  test("every rubric rule name of contracts §5.6 has a schema branch", () => {
    const base = { id: "r", label: "x", required: false, skills: [] };
    for (const name of RUBRIC_RULE_NAMES) {
      const issues = schemaIssues(RubricRuleSchema, { ...base, rule: name });
      // A bare rule is missing its own fields, but its discriminator is known.
      expect([name, issues.some((i) => i.path === "rule")]).toEqual([name, false]);
    }
    expect(
      schemaIssues(RubricRuleSchema, { ...base, rule: "motif-repetition" }).some((i) => i.path === "rule"),
    ).toBe(true);
    expect(
      schemaIssues(RubricRuleSchema, { ...base, rule: "section-contrast" }).some((i) => i.path === "rule"),
    ).toBe(true);
  });

  test("the amended swing rule takes a track list, a drum filter and a subdivision (contracts §6.6)", () => {
    const c5 = {
      id: "swing",
      label: "Swing the hats",
      required: true,
      skills: ["R13"],
      rule: "swing",
      track: ["hats", "@drums"],
      drums: ["hatClosed", "hatOpen", "ride"],
      subdivision: 8,
      ratio: [1.6, 2.4],
    };
    expect(schemaIssues(RubricRuleSchema, c5)).toEqual([]);
    expect(schemaIssues(RubricRuleSchema, { ...c5, subdivision: 4 })).not.toEqual([]);
  });

  test("every exercise kind is a known discriminator", () => {
    for (const kind of EXERCISE_KINDS) {
      const issues = schemaIssues(ExerciseSchema, { kind });
      expect([kind, issues.some((i) => i.path === "kind")]).toEqual([kind, false]);
    }
    expect(schemaIssues(ExerciseSchema, { kind: "write-code" }).length).toBeGreaterThan(0);
  });

  test("removed fields are rejected: ExBase.unlocks, Hint.level, TutorPolicy.effort", () => {
    const ex = mutable(exAt(lessonU01L02(), 3)) as unknown as Record<string, unknown>;
    expect(schemaIssues(ExerciseSchema, ex)).toEqual([]);
    expect(schemaIssues(ExerciseSchema, { ...ex, unlocks: ["tb.scale"] })).not.toEqual([]);
    expect(schemaIssues(ExerciseSchema, { ...ex, tutor: { enabled: true, effort: "low" } })).not.toEqual([]);
    expect(
      schemaIssues(ExerciseSchema, {
        ...ex,
        hints: [{ text: "a", level: "concept" }, { text: "b" }, { text: "c" }, "auto"],
      }),
    ).not.toEqual([]);
    expect(
      schemaIssues(ExerciseSchema, { ...ex, constraints: [{ c: "must-call", fn: "scale" }] }),
    ).not.toEqual([]);
  });

  test("GradeResult round-trips", () => {
    const result = {
      exerciseId: "U01.L02/rest-on-three",
      exerciseVersion: 1,
      attemptNo: 1,
      firstAttempt: true,
      mode: "lesson",
      status: "fail",
      score: 0.75,
      adjustedScore: 0.75,
      dims: { rhythm: { score: 0.75, weight: 1, n: 4 } },
      constraints: [
        {
          id: "must-use",
          ok: false,
          diag: { id: "code.must-use", severity: "error", params: { tool: "~" } },
        },
      ],
      diagnostics: [
        {
          id: "rhythm.extra",
          severity: "error",
          dim: "rhythm",
          where: { bar: 1, beat: 3, beatLabel: "3", track: "drums", code: [{ from: 22, to: 24 }] },
          params: {},
        },
      ],
      messages: [{ id: "rhythm.extra", text: "Bar 1, 3: extra hit.", where: { bar: 1, beat: 3 } }],
      assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
    };
    expect(schemaIssues(GradeResultSchema, result)).toEqual([]);
    expect(schemaIssues(GradeResultSchema, { ...result, assist: { ...result.assist, rung: 5 } })).not.toEqual(
      [],
    );
    expect(
      schemaIssues(GradeResultSchema, {
        ...result,
        diagnostics: [{ id: "pitch.wrong", severity: "error", params: {} }],
      }),
    ).not.toEqual([]);
  });
});

describe("registries", () => {
  const voicing: ToolEntry = {
    id: "tb.voicing",
    kind: "tool",
    code: ".voicing()",
    unlock: {
      at: "U05.L08",
      when: "complete",
      condition: { exercise: "U05.L07/hand-voiced-cadence", minScore: 0.9, unrevealed: true },
    },
    concept: "voicings",
    catalog: {
      signature: ".voicing()",
      meaning: "Turns chord symbols into notes.",
      demo: 'chord("<C Am F G>").voicing()',
    },
  };

  test("defineTool: kinds follow the ID prefix; alternative sites and START rows", () => {
    expect(defineTool(voicing).id).toBe("tb.voicing");
    expect(rulesOf(() => defineTool({ ...voicing, kind: "sound" }))).toEqual(["tool.kind"]);
    expect(rulesOf(() => defineTool({ ...voicing, id: "tb.feature.album", kind: "tool" }))).toEqual([
      "tool.kind",
    ]);
    const ebass = defineTool({
      ...voicing,
      id: "snd.ebass",
      kind: "sound",
      code: 's("ebass")',
      unlock: { at: "C1.S1", when: "start", fallbackAt: "U03.L03" },
    });
    expect(ebass.unlock.fallbackAt).toBe("U03.L03");
    expect(
      rulesOf(() =>
        defineTool({ ...voicing, unlock: { at: "U05.L08", when: "complete", fallbackAt: "U03.L03" } }),
      ),
    ).toEqual(["tool.fallback"]);
    expect(
      defineTool({ ...voicing, id: "tb.arp", unlock: { at: ["U10.L09", "A1.L04"], when: "complete" } }).unlock
        .at,
    ).toEqual(["U10.L09", "A1.L04"]);
    expect(
      rulesOf(() => defineTool({ ...voicing, unlock: { at: "U05" as "U05.L08", when: "complete" } })),
    ).toEqual(["schema"]);
  });

  test("defineToolbox: each ID has exactly one row", () => {
    expect(defineToolbox([voicing, { ...voicing, id: "tb.chord" }])).toHaveLength(2);
    expect(rulesOf(() => defineToolbox([voicing, voicing]))).toEqual(["toolbox.duplicate"]);
  });

  test("defineSkills: unknown prerequisites and cycles are errors", () => {
    const r01: SkillDef = {
      id: "R01",
      name: "Pulse & beat",
      region: "groove",
      category: "rhythm",
      kind: "production",
      prerequisites: [],
      introducedBy: "U01.L01",
    };
    const r02: SkillDef = { ...r01, id: "R02", name: "Tempo / BPM", kind: "concept", prerequisites: ["R01"] };
    expect(defineSkills([r01, r02])).toHaveLength(2);
    expect(rulesOf(() => defineSkills([r02]))).toEqual(["skills.unknown-prerequisite"]);
    expect(rulesOf(() => defineSkills([{ ...r01, prerequisites: ["R02"] }, r02]))).toEqual(["skills.cycle"]);
    expect(rulesOf(() => defineSkill({ ...r01, prerequisites: ["R01"] }))).toEqual([
      "skill.self-prerequisite",
    ]);
    expect(rulesOf(() => defineSkill({ ...r01, kind: "skill" as "fact" }))).toEqual(["schema"]);
  });

  const fet: FamilyDef = {
    id: "fam.deg.fet-major",
    title: "Degrees by ear (major)",
    kind: "perceptual",
    domain: "degree",
    skills: [
      { skill: "E04", w: 1 },
      { skill: "E05", w: 1 },
    ],
    unlock: { lesson: "U03.L02", levelGates: { 2: "U03.L03" } },
    categories: [
      { id: "deg.1", unlockAt: "U03.L02" },
      { id: "deg.5", unlockAt: "U03.L02" },
      { id: "deg.3", unlockAt: "U03.L02", contrastOf: ["deg.1", "deg.5"] },
    ],
    levels: [
      {
        categories: ["deg.1", "deg.5"],
        replays: 2,
        instruments: ["snd.piano"],
        keys: "C",
        tempo: [80, 100],
        context: "cadence",
      },
      {
        categories: ["deg.1", "deg.3", "deg.5"],
        replays: 2,
        instruments: ["snd.piano"],
        keys: "≤2acc",
        tempo: [80, 100],
        context: "cadence",
        leapMax: 7,
      },
    ],
    masteryLevel: 2,
    trialsPerSet: 6,
    fastRtMs: 2500,
    estTrialSec: 9,
    retention: 0.85,
    mix: "pitch",
    answer: "degree-pad",
    generator: "degree-id",
  };

  test("defineFamily: levels use declared categories; retention follows the kind (contracts §7.1)", () => {
    expect(defineFamily(fet).levels[1]?.leapMax).toBe(7);
    const unknown = mutable(fet);
    unknown.levels[0]?.categories.push("deg.6");
    expect(rulesOf(() => defineFamily(unknown))).toEqual(["family.unknown-category"]);
    expect(rulesOf(() => defineFamily({ ...fet, retention: 0.9 }))).toEqual(["family.retention"]);
    expect(rulesOf(() => defineFamily({ ...fet, kind: "concept", mix: "pitch", retention: 0.9 }))).toEqual([
      "family.concept-mix",
    ]);
    expect(rulesOf(() => defineFamily({ ...fet, masteryLevel: 3 }))).toEqual(["family.mastery-level"]);
    expect(
      rulesOf(() => defineFamily({ ...fet, unlock: { lesson: "U03.L02", levelGates: { 5: "U10.L01" } } })),
    ).toEqual(["family.level-gate"]);
  });

  const auraLee: SongDef = {
    id: "song.aura-lee",
    title: "Aura Lee",
    year: 1861,
    status: "US-PD",
    provenance: { source: "Aura Lea, sheet music, John Church Jr., Cincinnati", year: 1861 },
    verifiedBy: "pending",
    key: { tonic: "G", mode: "major" },
    meter: "4/4",
    bpm: 84,
    form: "AABA",
    answerKey: {
      bars: 16,
      code: 'setcpm(84/4)\n\nmel: n("<[4 7 6 7] [8 5 8 ~]>").scale("G4:major").s("piano")',
      layers: { melody: 'n("<[4 7 6 7] [8 5 8 ~]>").scale("G4:major")' },
    },
  };

  test("defineSong: provenance no later than 1930, no slash chords in code spelling", () => {
    expect(defineSong(auraLee).year).toBe(1861);
    expect(rulesOf(() => defineSong({ ...auraLee, year: 1964 }))).toEqual(["schema"]);
    expect(
      rulesOf(() => defineSong({ ...auraLee, provenance: { source: "a 1964 arrangement", year: 1964 } })),
    ).toEqual(["schema"]);
    const { verifiedBy: _v, ...unverified } = auraLee;
    expect(rulesOf(() => defineSong(unverified as SongDef))).toEqual(["schema"]);
    expect(
      rulesOf(() =>
        defineSong({
          ...auraLee,
          answerKey: { ...auraLee.answerKey, chords: [{ bar: 1, beat: 1, symbol: "C/E" }] },
        }),
      ),
    ).toEqual(["song.slash-chord"]);
  });

  test("defineUnit: lessons belong to the unit", () => {
    const meta = {
      title: "Count to Four",
      objective: "Count a bar.",
      introduces: ["R06" as const],
      practises: [],
    };
    expect(
      defineUnit({
        id: "U01",
        title: "Pulse & Rhythm I",
        track: "core",
        lessons: [{ id: "U01.L02", ...meta }],
        checkpoint: "U01.CP",
      }).id,
    ).toBe("U01");
    expect(
      rulesOf(() =>
        defineUnit({ id: "U01", title: "x", track: "core", lessons: [{ id: "U02.L01", ...meta }] }),
      ),
    ).toEqual(["unit.lesson-unit"]);
    expect(
      rulesOf(() =>
        defineUnit({ id: "J1", title: "x", track: "core", lessons: [{ id: "J1.L01", ...meta }] }),
      ),
    ).toEqual(["unit.track"]);
  });

  test("defineBand and defineFlavour (contracts §5.10)", () => {
    const code = 'setcpm({{bpm}}/4)\n\ndrums: s("bd*2")\nbass: n("0").scale("{{key}}").s("ebass")';
    const band = {
      id: "band.two-chord-vamp" as const,
      title: "Two-chord vamp",
      bars: 2,
      roles: ["drums" as const, "bass" as const],
      params: { key: true, bpm: true },
    };
    const all = {
      "flavour.pop": code,
      "flavour.indie": code,
      "flavour.jazz-soul": code,
      "flavour.funk": code,
      "flavour.electronic": code,
    };
    expect(defineBand({ ...band, code: all }).bars).toBe(2);
    expect(rulesOf(() => defineBand({ ...band, roles: ["drums", "bass", "chords"], code: all }))).toEqual(
      Array(5).fill("band.role-track"),
    );
    const { "flavour.funk": _f, ...three } = all;
    expect(rulesOf(() => defineBand({ ...band, code: three as typeof all }))).toEqual(["schema"]);
    expect(
      defineFlavour({
        id: "flavour.jazz-soul",
        title: "Jazz & soul",
        drums: "snd.jazzkit",
        bass: "snd.upright",
        chords: "snd.rhodes",
        lead: "snd.vibes",
        chordDepth: "seventh",
        swing: { subdivision: 8, amount: 1 / 3 },
        production: { room: 0.3, bassLpf: 800, humanizeVelocity: 0.08, pan: { chords: 0.4, lead: 0.6 } },
      }).chordDepth,
    ).toBe("seventh");
  });

  test("defineCapstone: sessions are numbered, focus rules exist in the rubric", () => {
    const brief: Exercise = {
      kind: "compose-brief",
      id: "intro",
      version: 1,
      role: "capstone",
      prompt: "A 4 to 8 bar drum intro.",
      brief: "Backbeat, hats, a fill.",
      skills: [{ skill: "R04", w: 1 }],
      hints: ladder,
      tests: [],
      code: { starter: "setcpm(100/4)\n\n" },
      rubric: [
        { id: "length", label: "4 to 8 bars", required: true, skills: ["R03"], rule: "bars", min: 4, max: 8 },
        {
          id: "tempo",
          label: "70 to 140 BPM",
          required: true,
          skills: ["R02"],
          rule: "tempo-bpm",
          min: 70,
          max: 140,
        },
      ],
      review: { tutor: "offer" },
    };
    if (brief.kind !== "compose-brief") throw new Error("fixture");
    const c0 = {
      id: "C0" as const,
      title: "Intro",
      objective: "A 4 to 8 bar drum intro: backbeat, 8th or 16th hats, a fill; first album track.",
      sessions: 1,
      opensAfter: { checkpoints: ["U01.CP" as const] },
      kind: "compose" as const,
      version: 1,
      meter: "4/4" as const,
      brief,
      sessionDefs: [
        {
          id: "C0.S1" as const,
          title: "Intro",
          goal: "Write and release the intro.",
          focusRules: ["length"],
        },
      ],
      reviewRevisions: 1 as const,
      canDo: ["cd.compose.intro" as const],
    };
    expect(defineCapstone(c0).id).toBe("C0");
    expect(rulesOf(() => defineCapstone({ ...c0, sessions: 2 }))).toEqual(["capstone.sessions"]);
    expect(
      rulesOf(() =>
        defineCapstone({
          ...c0,
          sessionDefs: [
            { ...c0.sessionDefs[0], id: "C0.S2" as const, title: "x", goal: "y", focusRules: ["fill"] },
          ],
        }),
      ),
    ).toEqual(["capstone.session-id", "capstone.focus-rule"]);
  });
});
