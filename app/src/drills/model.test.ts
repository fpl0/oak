import { describe, expect, test } from "bun:test";
import { type Answer, type DrillSession, DrillTrialRecordSchema, type FamilyDef, type Trial } from "@oak/api";
import { createRegistry, DEFAULT_PROFILE, gradeTrial } from "@oak/drills";
import { EAR_STAGES, families } from "../../../content/families.ts";
import type { AnswerSpec } from "../answers/types.ts";
import {
  answerOf,
  expectedText,
  expectedValueOf,
  familyStatus,
  groupByStage,
  isResting,
  lessonPhrase,
  levelChangeText,
  nextDueText,
  optionLabel,
  pendingText,
  planDrillSet,
  setWord,
  summarize,
  summaryView,
  surfaceOf,
  type TrialOutcome,
  tapReport,
  trialAnswerOf,
  trialRecord,
  unitPhrase,
  wrongMarks,
} from "./model.ts";

const registry = createRegistry(families, []);
const def = (id: string) => families.find((f) => f.id === id) as FamilyDef;

function session(familyId: string, level = 1, trials?: number): DrillSession {
  const d = def(familyId);
  return {
    id: "drl_1",
    sessionId: null,
    purpose: "srs",
    familyIds: [familyId as never],
    setId: `set-${familyId}`,
    levels: { [familyId]: level },
    openCategories: { [familyId]: d.levels[level - 1]?.categories ?? [] },
    focus: {},
    trialsPlanned: trials ?? d.trialsPerSet,
    startedAt: "2026-11-11T10:00:00.000Z",
    finishedAt: null,
  };
}

function trialsOf(familyId: string, level = 1, trials?: number): Trial[] {
  return planDrillSet(
    registry.family(familyId as never),
    session(familyId, level, trials),
    null,
    DEFAULT_PROFILE,
  ).trials.map((t) => t.trial);
}

const grade = (t: Trial, answer: Answer | null) =>
  gradeTrial(
    registry.family(t.family),
    t,
    { ...(answer ? { answer } : {}), rtMs: 900, replays: 0 },
    DEFAULT_PROFILE,
  );

describe("answer surfaces of generated trials", () => {
  test("Stage A: pulse, echo and reading are tapped; pitch match is sung", () => {
    for (const id of ["fam.rhy.pulse", "fam.rhy.echo", "fam.rhy.read"])
      expect(surfaceOf(trialsOf(id)[0] as Trial, def(id)).kind).toBe("tap");
    expect(surfaceOf(trialsOf("fam.pit.match")[0] as Trial, def("fam.pit.match")).kind).toBe("sing");
  });

  test("generator labels, multi-pick and the Roman-numeral palette reach the widget spec", () => {
    const base = trialsOf("fam.pit.compare")[0] as Trial;
    const labelled = {
      ...base,
      params: {
        ...base.params,
        options: ["a", "b"],
        optionLabels: { a: "`bd*2`", b: "Two hits" },
        multi: true,
      },
    } as Trial;
    const s = surfaceOf(labelled, def("fam.pit.compare")) as { spec: AnswerSpec };
    expect(s.spec).toMatchObject({
      ui: "choice",
      multi: true,
      options: [
        { id: "a", label: "`bd*2`" },
        { id: "b", label: "Two hits" },
      ],
    });
    const rn = {
      ...base,
      params: { ...base.params, ui: "rn-palette", rnAllow: ["triads", "sevenths", "nonsense"] },
      expected: { rn: ["I", "V7"] },
    } as unknown as Trial;
    expect((surfaceOf(rn, def("fam.pit.compare")) as { spec: AnswerSpec }).spec).toEqual({
      ui: "rn-palette",
      slots: 2,
      allow: ["triads", "sevenths"],
    });
  });

  test("higher/lower is a three-way choice in the family's own words", () => {
    const s = surfaceOf(trialsOf("fam.pit.compare")[0] as Trial, def("fam.pit.compare"));
    expect(s.kind).toBe("widget");
    const spec = (s as { spec: AnswerSpec }).spec;
    expect(spec.ui).toBe("choice");
    expect((spec as { options: { id: string; label: string }[] }).options.map((o) => o.label)).toEqual([
      "Higher",
      "Lower",
      "Same",
    ]);
  });

  test("find the tonic offers its candidate notes with audition audio", () => {
    const t = trialsOf("fam.deg.tonic")[0] as Trial;
    const spec = (surfaceOf(t, def("fam.deg.tonic")) as { spec: AnswerSpec }).spec as Extract<
      AnswerSpec,
      { ui: "choice" }
    >;
    expect(spec.layout).toBe("audio-cards");
    expect(spec.options.every((o) => typeof o.audio === "string")).toBe(true);
    expect(spec.options.map((o) => o.id)).toContain((t.expected as Answer).choice?.[0] as string);
  });

  test("FET pads show the level's contrast set; in-key intervals take two slots over the diatonic set", () => {
    const fet = (
      surfaceOf(trialsOf("fam.deg.fet-major")[0] as Trial, def("fam.deg.fet-major")) as { spec: AnswerSpec }
    ).spec as Extract<AnswerSpec, { ui: "degree-pad" }>;
    expect(fet.set).toEqual(["1", "3", "5"]);
    expect(fet.sequenceLen).toBeUndefined();
    const iv = (
      surfaceOf(trialsOf("fam.int.in-key")[0] as Trial, def("fam.int.in-key")) as { spec: AnswerSpec }
    ).spec as Extract<AnswerSpec, { ui: "degree-pad" }>;
    expect(iv.set).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(iv.sequenceLen).toBe(2);
  });

  test("the others: code, text, number, grid, quality pad and Roman numerals", () => {
    const ui = (id: string) =>
      ((surfaceOf(trialsOf(id)[0] as Trial, def(id)) as { spec: AnswerSpec }).spec as AnswerSpec).ui;
    expect(ui("fam.not.read")).toBe("code");
    expect(ui("fam.pit.keyboard")).toBe("text");
    expect(ui("fam.deg.index")).toBe("number");
    expect(ui("fam.rhy.dictation")).toBe("grid");
    expect(ui("fam.chd.quality-triad")).toBe("quality-pad");
    expect(ui("fam.har.rn")).toBe("rn-palette");
    // Wave 6: "find the push" is marked on the rhythm grid (wave6.test.ts), not clicked among thirty-two buttons.
    expect(ui("fam.rhy.syncopation")).toBe("grid");
  });
});

describe("widget values reach the grader in the shape it reads", () => {
  // The expected answer, as a widget value, sent back through answerOf, must grade as right — for every
  // identification family the generators implement.
  const ids = families
    .filter((f) => !f.generator.startsWith("pending:") && !f.generator.startsWith("mix."))
    .map((f) => f.id);
  for (const id of ids)
    test(id, () => {
      for (const t of trialsOf(id, 1, 4)) {
        const s = surfaceOf(t, def(id));
        if (s.kind !== "widget" || s.spec.ui === "code") continue;
        const value = expectedValueOf(s.spec, t.expected as Answer);
        expect(value).not.toBeNull();
        const r = grade(t, trialAnswerOf(t, s.spec, value as never));
        expect(r.correct).toBe(true);
      }
    });

  test("a code answer is graded from its text (note reading)", () => {
    const t = trialsOf("fam.not.read")[0] as Trial;
    const line = t.code
      .split("\n")
      .find((l) => l.startsWith("mel:"))
      ?.replace(/^mel:\s*/, "") as string;
    expect(grade(t, answerOf({ ui: "code", starter: "" }, line)).correct).toBe(true);
    expect(grade(t, answerOf({ ui: "code", starter: "" }, 'note("c4")')).correct).toBe(false);
  });

  test("a wrong pick is graded wrong with its confusion pair", () => {
    const t = trialsOf("fam.pit.compare")[0] as Trial;
    const right = (t.expected as Answer).choice?.[0] as string;
    const wrong = ["higher", "lower", "same"].find((x) => x !== right) as string;
    const r = grade(t, { choice: [wrong] });
    expect(r.correct).toBe(false);
    expect(r.confusion).toEqual([right, wrong]);
  });
});

describe("trial records", () => {
  test("match the server's schema, with skipped and revealed trials", () => {
    const t = trialsOf("fam.pit.compare")[0] as Trial;
    const r = grade(t, t.expected as Answer);
    const rec = trialRecord(
      t,
      0,
      { result: r, answer: t.expected as Answer },
      { at: "2026-11-11T10:00:00.000Z" },
    );
    expect(DrillTrialRecordSchema.safeParse(rec).success).toBe(true);
    expect(rec).toMatchObject({
      idx: 0,
      seed: t.seed,
      level: 1,
      category: t.category,
      credit: 1,
      correct: true,
    });
    const tap = trialsOf("fam.rhy.pulse")[0] as Trial;
    const skipped = trialRecord(
      tap,
      1,
      {
        result: { credit: 0, correct: false, rtMs: 0, replays: 0, diagnostics: [], skipped: true },
        answer: null,
      },
      { taps: [], at: "2026-11-11T10:00:00.000Z" },
    );
    expect(DrillTrialRecordSchema.safeParse(skipped).success).toBe(true);
    expect(skipped.response.skipped).toBe(true);
  });
});

describe("set planning", () => {
  test("the same session regenerates the same trials; a new key, register or instrument each trial", () => {
    const a = trialsOf("fam.pit.compare", 2);
    const b = trialsOf("fam.pit.compare", 2);
    expect(a.map((t) => t.seed)).toEqual(b.map((t) => t.seed));
    expect(a.map((t) => t.code)).toEqual(b.map((t) => t.code));
    // Ten trials do not all start on the same note.
    const firsts = new Set(a.map((t) => t.events[0]?.midi));
    expect(firsts.size).toBeGreaterThan(3);
  });

  test("easyFirst opens the set with a trial one level down", () => {
    const fam = registry.family("fam.pit.compare" as never);
    const { trials } = planDrillSet(fam, session("fam.pit.compare", 2), null, DEFAULT_PROFILE, {
      easyFirst: true,
    });
    expect(trials[0]?.trial.level).toBe(1);
    expect(trials.filter((t) => t.trial.level === 1).length).toBeGreaterThan(0);
    expect(trials.filter((t) => t.trial.level === 2).length).toBeGreaterThan(trials.length / 2);
  });

  test("FET sets ask a sung resolution on 2–3 trials, never all, none in Quiet mode", () => {
    const fam = registry.family("fam.deg.fet-major" as never);
    const s = session("fam.deg.fet-major", 1);
    const sung = (p: typeof DEFAULT_PROFILE, n: number) =>
      planDrillSet(fam, s, null, p, { sungResolutions: n }).trials.filter(
        (t) => t.trial.params.sungResolution === true,
      ).length;
    expect(sung(DEFAULT_PROFILE, 3)).toBe(3);
    expect(sung(DEFAULT_PROFILE, 2)).toBe(2);
    // Quiet mode keeps them: they are heard, not sung (contracts §8.5; the runner records them as quiet).
    expect(sung({ ...DEFAULT_PROFILE, quiet: true }, 3)).toBe(3);
  });
});

function outcomes(trials: Trial[], right: boolean[], extra: Partial<TrialOutcome> = {}): TrialOutcome[] {
  return trials.map((t, i) => ({
    index: i,
    familyId: t.family,
    result: grade(t, right[i] ? (t.expected as Answer) : { choice: ["nothing"] }),
    revealed: false,
    sung: null,
    resolutionCredit: null,
    ...extra,
  }));
}

describe("set summary", () => {
  const fam = registry.family("fam.pit.compare" as never);
  const { plan, trials } = planDrillSet(fam, session("fam.pit.compare", 1, 10), null, DEFAULT_PROFILE);
  const ts = trials.map((t) => t.trial);

  test("words, accuracy, next due and the grade map (revealed → Again)", () => {
    const outs = outcomes(
      ts,
      ts.map(() => true),
    );
    const s = summarize(plan, ts, outs);
    const v = summaryView({
      def: def("fam.pit.compare"),
      summary: s,
      outcomes: outs,
      finish: null,
      purpose: "practice",
      cardLevel: 1,
      before: null,
      profile: DEFAULT_PROFILE,
    });
    expect(v.accuracy).toBe("10 of 10");
    expect(v.word).toBe("strong");
    expect(v.next).toContain("schedule stays");
    expect(["Good", "Easy"]).toContain(v.rating as string);
    const revealed = outs.map((o, i) => (i === 0 ? { ...o, revealed: true } : o));
    const r = summaryView({
      def: def("fam.pit.compare"),
      summary: summarize(plan, ts, revealed),
      outcomes: revealed,
      finish: null,
      purpose: "srs",
      cardLevel: 1,
      before: null,
      profile: DEFAULT_PROFILE,
    });
    expect(r.rating).toBe("Again");
  });

  test("what moved: the level change and the confusion worth a listen; the server's due date", () => {
    const outs = outcomes(
      ts,
      ts.map((_, i) => i % 3 !== 0),
    );
    const s = summarize(plan, ts, outs);
    const v = summaryView({
      def: def("fam.pit.compare"),
      summary: s,
      outcomes: outs,
      finish: {
        session: session("fam.pit.compare"),
        meanCredit: s.meanCredit,
        medianRtMs: 900,
        evidence: [],
        streak: {} as never,
        reviews: [
          {
            cardId: "fam.pit.compare",
            rating: "Hard",
            dueAt: "2026-11-14T10:00:00.000Z",
            scheduledDays: 3,
            status: "active",
            familyState: { level: 2 } as never,
            levelChange: "promoted",
            graduated: false,
          },
        ],
      },
      purpose: "srs",
      cardLevel: 1,
      before: null,
      profile: DEFAULT_PROFILE,
      now: new Date("2026-11-11T10:00:00.000Z"),
    });
    expect(v.moved[0]).toBe("Level 2 of 3 opens next time: a little more to tell apart.");
    expect(v.moved.some((m) => /when it was/.test(m))).toBe(true);
    expect(v.next).toBe("Comes back in about 3 days");
    expect(v.rating).toBe("Hard");
  });

  test("calm copy", () => {
    expect(setWord(0.95)).toBe("strong");
    expect(setWord(0.5)).toBe("worth another listen");
    expect(levelChangeText("demoted", 1, 3)).toContain("settles faster");
    expect(levelChangeText(null, 1, 3)).toBeNull();
    const now = new Date("2026-11-11T10:00:00.000Z");
    expect(nextDueText("2026-11-11T18:00:00.000Z", now)).toBe("Comes back later today");
    expect(nextDueText("2026-11-12T10:00:00.000Z", now)).toBe("Comes back tomorrow");
    expect(nextDueText("2026-12-02T10:00:00.000Z", now)).toBe("Comes back in about 3 weeks");
    expect(expectedText(null, { degrees: ["b3"] }, true)).toBe("♭3 · me");
  });

  test("tap report: matches within 150 ms, mean offset and extra taps", () => {
    const r = tapReport([0.02, 0.52, 1.08, 1.3], [0, 0.5, 1]);
    expect(r.matched).toBe(3);
    expect(Math.round(r.meanOffsetMs as number)).toBe(40);
    expect(r.text).toBe("3 of 3 hits matched, about 40 ms late on average, 1 extra tap.");
    expect(tapReport([], [0, 1]).text).toBe("No taps reached the pad.");
  });
});

describe("Practice hub", () => {
  test("groups families by ear-training stage; composites stay out", () => {
    const groups = groupByStage(families, EAR_STAGES);
    expect(groups[0]?.key).toBe("A");
    expect(groups[0]?.families.map((f) => f.id)).toEqual(EAR_STAGES.A);
    expect(groups.at(-1)?.key).toBe("concepts");
    const all = groups.flatMap((g) => g.families.map((f) => f.id));
    expect(all.some((id) => id.startsWith("fam.mix."))).toBe(false);
    expect(all).toContain("fam.rhy.read");
    expect(all).toContain("fam.not.read");
  });

  test("locked, open, mastered and pending", () => {
    const none = new Set<string>();
    expect(familyStatus(def("fam.pit.compare"), undefined, none)).toBe("locked");
    expect(familyStatus(def("fam.pit.compare"), undefined, new Set(["U02.L01"]))).toBe("unlocked");
    const st = { level: 3, graduatedAt: null } as never;
    expect(familyStatus(def("fam.pit.compare"), st, none)).toBe("mastered");
    // Every catalog generator is built now; a family still marked `pending:` keeps its honest status.
    const pending = { ...def("fam.jzz.subs"), generator: "pending:jazz-subs" } as FamilyDef;
    expect(familyStatus(def("fam.jzz.subs"), undefined, none)).toBe("locked");
    expect(familyStatus(pending, undefined, none)).toBe("pending");
    expect(pendingText(pending, none)).toBe("Arrives with J5");
  });

  test("a family resting in its composite reads as resting, never mastered (decision 27)", () => {
    const d = def("fam.deg.fet-major");
    const none = new Set<string>();
    const resting = {
      level: Math.max(1, d.masteryLevel - 2),
      graduatedAt: "2026-11-01T10:00:00.000Z",
      compositeId: "fam.mix.pitch",
    } as never;
    expect(isResting(d, resting)).toBe(true);
    expect(familyStatus(d, resting, none)).toBe("resting");
    // Back on its own card (no longer graduated): open again, at the level it left off.
    const back = {
      level: Math.max(1, d.masteryLevel - 2),
      graduatedAt: null,
      compositeId: "fam.mix.pitch",
    } as never;
    expect(familyStatus(d, back, none)).toBe("unlocked");
    // Graduated at its mastery level: mastered.
    const done = {
      level: d.masteryLevel,
      graduatedAt: "2026-11-01T10:00:00.000Z",
      compositeId: "fam.mix.pitch",
    } as never;
    expect(isResting(d, done)).toBe(false);
    expect(familyStatus(d, done, none)).toBe("mastered");
  });

  test("the server's restingSince decides when it is sent", () => {
    const d = def("fam.deg.fet-major");
    const shaped = { level: 1, graduatedAt: "2026-11-01T10:00:00.000Z", compositeId: "fam.mix.pitch" };
    expect(isResting(d, { ...shaped, restingSince: "2026-11-01" } as never)).toBe(true);
    // Graduated early below mastery but not resting: the server says so.
    expect(isResting(d, { ...shaped, restingSince: null } as never)).toBe(false);
    expect(isResting(d, { ...shaped, graduatedAt: null, restingSince: "2026-11-01" } as never)).toBe(true);
  });
});

describe("Wave 3 review: words, not IDs; a wrong pick is marked", () => {
  test("degree categories read as degrees", () => {
    expect(optionLabel("deg.5")).toBe("Degree 5");
    expect(optionLabel("deg.b6")).toBe("Degree ♭6");
    expect(optionLabel("higher")).toBe("Higher");
  });
  test("units and lessons are named in words, never by ID", () => {
    const units = new Map([["U04", "Intervals"]]);
    expect(unitPhrase("U04", units)).toBe("unit 4, Intervals");
    expect(unitPhrase("U09", units)).toBe("unit 9");
    expect(unitPhrase("J1", units)).toBe("this unit");
    expect(lessonPhrase("U03.L02", new Map([["U03.L02", "Degrees in Code"]]))).toBe("“Degrees in Code”");
  });
  test("a note name stays a note name; function words only in the function family", () => {
    // "Find home" in D major offers the note D: it must not read as "Dominant" (UX review P1).
    expect(optionLabel("D", "degree-tonic", ["D", "G", "C"])).toBe("D");
    expect(optionLabel("D")).toBe("D");
    expect(optionLabel("Bb", "degree-tonic")).toBe("B♭");
    expect(optionLabel("F#")).toBe("F♯");
    expect(optionLabel("D", "harmony-function")).toBe("Dominant");
    expect(optionLabel("PD", "harmony-function")).toBe("Predominant");
    // The spoken answer under a function trial with no choice spec names the function too, not its letters.
    expect(expectedText(null, { choice: ["T", "PD", "D"] }, false, "harmony-function")).toBe(
      "Tonic, Predominant, Dominant",
    );
  });
  test("a wrong degree is marked on the pick; a choice on its option", () => {
    const pad = { ui: "degree-pad", set: ["1", "3", "5"] } as unknown as AnswerSpec;
    expect(wrongMarks(pad, ["3"], ["5"])).toEqual([{ part: 0, ok: false }]);
    expect(wrongMarks(pad, ["1", "3"], ["1", "5"])).toEqual([
      { part: 0, ok: true },
      { part: 1, ok: false },
    ]);
    const choice = { ui: "choice", options: [] } as unknown as AnswerSpec;
    expect(wrongMarks(choice, ["higher"], ["lower"])).toEqual([{ part: "higher", ok: false }]);
    expect(wrongMarks({ ui: "text" } as unknown as AnswerSpec, "C D", "C E")).toEqual([]);
  });
});
