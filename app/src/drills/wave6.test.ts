// Wave 6 in the runner's pure core and machine (stages E–F and the rhythm part of H): seventh-chord quality (the two
// notes that tell it, the chord against its near miss), chromatic degrees (one pad key per pitch, the lean to the
// nearest note of the key instead of the walk home, chromatic syllables, the sung lean through the machine and in
// Quiet mode), the chord from outside the key (which bar, what it is, where it leans, the key's own chord in its
// place), modes (the one changed note; the tune in the scale it is compared with, checked against headless
// Strudel), key changes (where home moved, which way and how far; the lift undone), rhythm II (the push on the
// grid, the hats divided another way, triplets on the staff, the count of a compound bar), the second question for
// the ear, the d16 seam for lesson ear steps, and the Practice hub (stages F and H, composites as progress).
import { describe, expect, test } from "bun:test";
import type { Answer, Degree, DrillSession, FamilyDef, FamilyState, Trial } from "@oak/api";
import { createRegistry, DEFAULT_PROFILE, generateTrial, gradeTrial } from "@oak/drills";
import { midisOf } from "@oak/grader/testing";
import { chromaticDegree, degreeSemitones, readChord } from "@oak/theory";
import { createActor, fromCallback, fromPromise, waitFor } from "xstate";
import { EAR_STAGES, families } from "../../../content/families.ts";
import { promptOf } from "./copy.ts";
import { chordSlotsOf, tonicPc } from "./harmony.ts";
import { aloneLabel, auditionPlan, earAfterAnswer } from "./listen.ts";
import { type DrillDeps, type DrillInput, drillMachine, type TrialSource } from "./machine.ts";
import {
  categoryLabel,
  compositesProgress,
  expectedText,
  expectedValueOf,
  gradeDrillTrial,
  groupByStage,
  levelNews,
  optionLabel,
  surfaceOf,
  trialAnswerOf,
} from "./model.ts";
import { resolutionOf, resolutionPath } from "./plans.ts";
import { asAsked } from "./sources.ts";
import { expectedStaffValue, hasTriplets, staffAnswer, staffSpecOf } from "./staff.ts";
import {
  categoryDegree,
  cellCount,
  chromaticPadSet,
  clickCellsOf,
  clickCellText,
  countMarks,
  followUpOf,
  guideTonePlan,
  keyAtBar,
  keyChangeLabels,
  keyChangeLine,
  keyChangeOf,
  leanLabels,
  leanPath,
  leanText,
  meterLine,
  modeLine,
  nearMissOf,
  nearQualityOf,
  neighbourResolution,
  outsideChordOf,
  outsideLine,
  padAnswer,
  pushLine,
  seventhFactsOf,
  seventhLine,
  stageFCategoryLabel,
  stageFOptionLabel,
  wave6Alone,
} from "./wave6.ts";

const registry = createRegistry(families, []);
const def = (id: string) => families.find((f) => f.id === id) as FamilyDef;
const PROFILE = { ...DEFAULT_PROFILE, comfLow: 50, comfHigh: 65 };
const SEEDS = Array.from({ length: 12 }, (_, i) => 700 + i * 37);

function trialAt(familyId: string, level: number, seed: number, category?: string): Trial {
  const d = def(familyId);
  const own = d.levels[level - 1]?.categories ?? [];
  const all = d.categories.map((c) => c.id);
  return generateTrial(
    registry.family(familyId as never),
    {
      index: 0,
      family: familyId as never,
      level,
      category: category ?? (own[seed % Math.max(1, own.length)] as string),
      seed,
    },
    PROFILE,
    all,
  ) as Trial;
}
const grade = (t: Trial, answer: Answer | null) =>
  gradeDrillTrial(registry.family(t.family), t, { answer: answer ?? {}, rtMs: 1500, replays: 0 }, PROFILE);
const notesAt = (plan: { events: { at: number; value: { note?: unknown } }[] }, at: number): number[] =>
  plan.events
    .filter((e) => Math.abs(e.at - at) < 1e-6)
    .map((e) => e.value.note as number)
    .sort((a, b) => a - b);
const pcs = (midis: readonly number[]): number[] =>
  [...new Set(midis.map((m) => ((m % 12) + 12) % 12))].sort((a, b) => a - b);

// --- seventh-chord quality ---------------------------------------------------------------------------

describe("seventh-chord quality: the two notes that tell it, and the near miss", () => {
  const SIZES: Record<string, [string, string]> = {
    maj7: ["M3", "M7"],
    "7": ["M3", "m7"],
    m7: ["m3", "m7"],
    m7b5: ["m3", "m7"],
    dim7: ["m3", "d7"],
  };

  test("every quality of the core is read from the notes with its 3rd and 7th", () => {
    for (const [q, [third, seventh]] of Object.entries(SIZES))
      for (const seed of SEEDS.slice(0, 4)) {
        const t = trialAt("fam.chd.quality-7th", 4, seed, q);
        const facts = seventhFactsOf(t);
        expect(facts?.quality as string).toBe(q);
        expect(facts?.third?.interval).toBe(third);
        expect(facts?.seventh?.interval).toBe(seventh);
      }
  });

  test("the line names the pair in interval words; note names only with their lens", () => {
    const t = trialAt("fam.chd.quality-7th", 1, SEEDS[0] as number, "7");
    const facts = seventhFactsOf(t) as NonNullable<ReturnType<typeof seventhFactsOf>>;
    expect(seventhLine(facts)).toBe("A major 3rd under a minor 7th: that pair makes it a dominant seventh.");
    const named = seventhLine(facts, { noteNames: true });
    expect(named).toContain(`(${facts.third?.name})`);
    expect(named).toContain(`(${facts.seventh?.name})`);
    const half = seventhFactsOf(trialAt("fam.chd.quality-7th", 3, SEEDS[1] as number, "m7b5"));
    expect(seventhLine(half as never)).toBe(
      "A minor 3rd under a minor 7th, over a lowered 5th: that pair makes it a half-diminished seventh.",
    );
  });

  test("the near miss is the learner's wrong pick, else the family's contrast; it is voiced on the same notes", () => {
    const d = def("fam.chd.quality-7th");
    const t = trialAt("fam.chd.quality-7th", 2, SEEDS[2] as number, "maj7");
    expect(nearQualityOf(t, d, null)).toBe("7");
    expect(nearQualityOf(t, d, { qualities: ["m7"] })).toBe("m7");
    expect(nearQualityOf(t, d, { qualities: ["maj7"] })).toBe("7");
    const near = nearMissOf(t, d, null);
    expect(near?.label).toBe("Against a dominant 7th");
    const first = notesAt(near?.plan as never, 0);
    const then = notesAt(near?.plan as never, 1.9);
    expect(then).toEqual([...(t.params.midis as number[])].sort((a, b) => a - b));
    expect(readChord(first, first[0] as number)?.quality).toBe("7");
    // One note differs, by a half step: the 7th.
    expect(first.filter((m, i) => m !== then[i]).length).toBe(1);
  });

  test("alone is the 3rd and the 7th by themselves, then the chord", () => {
    const t = trialAt("fam.chd.quality-7th", 1, SEEDS[3] as number, "7");
    const facts = seventhFactsOf(t) as NonNullable<ReturnType<typeof seventhFactsOf>>;
    const plan = guideTonePlan(t);
    const pair = notesAt(plan as never, 0);
    expect(pair.length).toBe(2);
    const root = t.params.rootPc as number;
    expect(pcs(pair.map((m) => m - root))).toEqual([4, 10]);
    expect(notesAt(plan as never, 1.8).length).toBe((t.params.midis as number[]).length);
    expect(wave6Alone(t)?.label).toBe("The 3rd and 7th alone");
    expect(aloneLabel(t)).toBe("The 3rd and 7th alone");
    expect(facts.name).toBe("dominant seventh");
  });

  test("qualities read as words wherever a level or a confusion is named", () => {
    expect(optionLabel("7", "chord-quality")).toBe("Dominant 7th");
    expect(optionLabel("m7b5", "chord-quality")).toBe("Half-diminished 7th");
    expect(optionLabel("maj", "chord-quality")).toBe("Major");
    expect(categoryLabel("dim7", "chord-quality")).toBe("Diminished 7th");
    expect(levelNews(def("fam.chd.quality-7th"), 3)).toBe("half-diminished 7th joins in");
  });
});

// --- chromatic degrees ---------------------------------------------------------------------------------

describe("chromatic degrees: one key per pitch, and the lean to the note beside it", () => {
  const CHROMATIC: Degree[] = ["#4", "b7", "b3", "b6", "b2", "#5", "#1"];

  test("category ids are degrees (deg.s4 is ♯4) and read as such", () => {
    expect(categoryDegree("deg.s4")).toBe("#4");
    expect(categoryDegree("deg.b7")).toBe("b7");
    expect(categoryDegree("deg.5")).toBe("5");
    expect(categoryDegree("anticipation")).toBeNull();
    expect(optionLabel("deg.s4")).toBe("Degree ♯4");
  });

  test("the pad offers each pitch once and never shows which spelling was asked", () => {
    expect(chromaticPadSet(["1", "4", "#4", "5", "6", "b7", "7"])).toEqual([
      "1",
      "4",
      "#4",
      "5",
      "6",
      "b7",
      "7",
    ]);
    // ♯5 and ♭6, ♯1 and ♭2 are one pitch each: one key, under the key's usual label.
    expect(chromaticPadSet(["1", "#1", "b2", "2", "5", "#5", "b6", "6"])).toEqual([
      "1",
      "b2",
      "2",
      "5",
      "b6",
      "6",
    ]);
    const d = def("fam.deg.fet-chromatic");
    for (const level of [1, 2, 3, 4])
      for (const seed of SEEDS) {
        const t = trialAt("fam.deg.fet-chromatic", level, seed);
        const s = surfaceOf(t, d);
        if (s.kind !== "widget" || s.spec.ui !== "degree-pad") throw new Error("expected a degree pad");
        const semis = s.spec.set.map((k) => ((degreeSemitones(k) % 12) + 12) % 12);
        expect(new Set(semis).size).toBe(semis.length);
        // The same pad whatever was asked at this level: the pad cannot leak the answer.
        const other = surfaceOf(trialAt("fam.deg.fet-chromatic", level, seed + 1), d);
        if (other.kind === "widget" && other.spec.ui === "degree-pad" && level < 4)
          expect(other.spec.set).toEqual(s.spec.set);
      }
  });

  test("a pick on the pitch's key is read as the asked spelling, and graded right by the family", () => {
    expect(padAnswer(["b6"], ["#5"])).toEqual(["#5"]);
    expect(padAnswer(["b6"], ["b6"])).toEqual(["b6"]);
    expect(padAnswer(["5"], ["#5"])).toEqual(["5"]);
    const d = def("fam.deg.fet-chromatic");
    for (const cat of ["deg.s5", "deg.s1", "deg.s4", "deg.b7"]) {
      const t = trialAt("fam.deg.fet-chromatic", 3, SEEDS[4] as number, cat);
      const want = (t.expected as Answer).degrees as Degree[];
      const s = surfaceOf(t, d);
      if (s.kind !== "widget" || s.spec.ui !== "degree-pad") throw new Error("expected a degree pad");
      const key = expectedValueOf(s.spec, t.expected as Answer) as Degree[];
      expect(s.spec.set).toContain(key[0] as Degree);
      const answer = trialAnswerOf(t, s.spec, key);
      expect(answer).toEqual({ degrees: want });
      expect(grade(t, answer).correct).toBe(true);
      // A neighbour is still wrong.
      const wrong = s.spec.set.find((k) => k !== key[0]) as Degree;
      expect(grade(t, trialAnswerOf(t, s.spec, [wrong])).correct).toBe(false);
    }
    expect(expectedText(null, { degrees: ["#5"] }, true)).toBe("♯5 · si");
  });

  test("the way home of a chromatic degree is its lean: two notes, to the note of the key it resolves to", () => {
    for (const d of CHROMATIC) {
      const info = chromaticDegree(d) as NonNullable<ReturnType<typeof chromaticDegree>>;
      const cat = `deg.${d.replace("#", "s")}`;
      const raw = trialAt("fam.deg.fet-chromatic", 3, SEEDS[5] as number, cat);
      expect((raw.expected as Answer).degrees).toEqual([d]);
      const t = neighbourResolution(raw);
      const targets = t.params.resolutionTargets as { midi: number; on: number; off: number }[];
      expect(targets.length).toBe(2);
      const step = (targets[1]?.midi as number) - (targets[0]?.midi as number);
      expect(step).toBe(info.raised ? 1 : -1);
      // A half step to the note it resolves to (theory's table): ♯4 → 5, ♭7 → 6, ♭3 → 2, ♯5 → 6 …
      expect(degreeSemitones(info.resolvesTo) - degreeSemitones(d)).toBe(step);
      expect((targets[1]?.on as number) >= (targets[0]?.off as number) - 1e-9).toBe(true);
      // What is heard is what is sung: two notes, the same two pitch classes, the same step.
      const heard = (resolutionOf(t).plan?.events ?? []).map((e) => e.value.note as number);
      expect(heard.length).toBe(2);
      expect((heard[1] as number) - (heard[0] as number)).toBe(step);
      expect(pcs(heard)).toEqual(pcs(targets.map((x) => x.midi)));
      expect(leanPath(t)).toEqual([d, info.resolvesTo]);
      expect(resolutionPath(t)).toEqual([d, info.resolvesTo]);
      // Applied twice it is the same trial; the generated trial is left as it was.
      expect(neighbourResolution(t)).toBe(t);
      expect((raw.params.resolutionTargets as unknown[]).length).toBeGreaterThan(0);
    }
  });

  test("a degree of the key keeps its walk home, and so does every other family", () => {
    const t = trialAt("fam.deg.fet-chromatic", 1, SEEDS[0] as number, "deg.5");
    expect(neighbourResolution(t)).toBe(t);
    const minor = trialAt("fam.deg.fet-minor", 2, SEEDS[0] as number);
    expect(neighbourResolution(minor)).toBe(minor);
    const major = trialAt("fam.deg.fet-major", 3, SEEDS[1] as number);
    expect(neighbourResolution(major)).toBe(major);
    expect(leanText(major, true)).toBeNull();
  });

  test("the lean in words, with the chromatic syllables when they are shown", () => {
    const fi = neighbourResolution(trialAt("fam.deg.fet-chromatic", 1, SEEDS[1] as number, "deg.s4"));
    expect(leanText(fi, false)).toBe("♯4 leans up to 5");
    expect(leanText(fi, true)).toBe("♯4 leans up to 5 · fi sol");
    expect(leanLabels(fi, true)).toEqual(["♯4 · fi", "5 · sol"]);
    const te = neighbourResolution(trialAt("fam.deg.fet-chromatic", 1, SEEDS[2] as number, "deg.b7"));
    expect(leanText(te, true)).toBe("♭7 leans down to 6 · te la");
    const si = neighbourResolution(trialAt("fam.deg.fet-chromatic", 3, SEEDS[3] as number, "deg.s5"));
    expect(leanLabels(si, true)).toEqual(["♯5 · si", "6 · la"]);
    expect(leanLabels(si, false)).toEqual(["♯5", "6"]);
  });

  test("against its near miss: the note of the key beside it, then the chromatic note", () => {
    const t = trialAt("fam.deg.fet-chromatic", 1, SEEDS[1] as number, "deg.s4");
    const near = nearMissOf(t, def("fam.deg.fet-chromatic"), null);
    expect(near?.label).toBe("Against 4");
    const [a, b] = near?.plan.events.map((e) => e.value.note as number) ?? [];
    expect((b as number) - (a as number)).toBe(1);
    const flat = nearMissOf(trialAt("fam.deg.fet-chromatic", 1, SEEDS[1] as number, "deg.b7"), null, null);
    expect(flat?.label).toBe("Against 7");
    const [c, e] = flat?.plan.events.map((x) => x.value.note as number) ?? [];
    expect((e as number) - (c as number)).toBe(-1);
    expect(promptOf(t, def("fam.deg.fet-chromatic"))).toBe(
      "After the cadence: which degree was the last note? Some come from outside the key.",
    );
  });

  test("every source asks a chromatic degree with its lean (a reload asks the same)", () => {
    const raw = { ...trialAt("fam.deg.fet-chromatic", 1, SEEDS[1] as number, "deg.s4") };
    const base: TrialSource = { total: 1, at: () => ({ spec: {} as never, trial: raw }) };
    const asked = asAsked(base).at(0, []).trial;
    expect((asked.params.resolutionTargets as unknown[]).length).toBe(2);
    expect(asAsked(base).at(0, []).trial.params.resolutionTargets).toEqual(asked.params.resolutionTargets);
    const diatonic = trialAt("fam.deg.fet-major", 2, SEEDS[0] as number);
    const same: TrialSource = { total: 1, at: () => ({ spec: {} as never, trial: diatonic }) };
    expect(asAsked(same).at(0, []).trial).toBe(diatonic);
  });
});

// --- the machine: the sung lean, and Quiet mode -----------------------------------------------------------

function sessionOf(familyId: string, trials: number, level: number): DrillSession {
  return {
    id: `drl_${familyId}`,
    sessionId: null,
    purpose: "practice",
    familyIds: [familyId as DrillSession["familyIds"][number]],
    setId: `w6_${familyId}`,
    levels: { [familyId]: level },
    openCategories: { [familyId]: def(familyId).levels[level - 1]?.categories ?? [] },
    focus: {},
    trialsPlanned: trials,
    startedAt: "2026-11-13T10:00:00.000Z",
    finishedAt: null,
  };
}
function runMachine(trials: Trial[], deps: DrillDeps, opts: { quiet?: boolean; seen?: unknown[] } = {}) {
  const s = sessionOf(trials[0]?.family as string, trials.length, trials[0]?.level ?? 1);
  const source = asAsked({
    total: trials.length,
    at: (i) => ({
      spec: {
        index: i,
        family: trials[i]?.family as never,
        level: trials[i]?.level ?? 1,
        category: "",
        seed: 0,
      },
      trial: trials[i] as Trial,
    }),
  });
  const machine = drillMachine.provide({
    actors: {
      start: fromPromise(async () => ({ session: s, source })),
      present: fromCallback(() => () => {}),
      audition: fromCallback(({ input, sendBack }) => {
        opts.seen?.push((input as { what: string }).what);
        sendBack({ type: "AUDITION_DONE" });
        return () => {};
      }),
      resolve: fromCallback(() => () => {}),
      singPart: fromCallback(() => () => {}),
      finish: fromPromise(async () => null),
    },
    actions: { persist: () => {}, send: () => {}, done: () => {} },
  });
  const input: DrillInput = {
    purpose: "practice",
    familyIds: s.familyIds,
    warmupItemId: null,
    sessionId: null,
    quiet: opts.quiet ?? false,
    tolCents: 50,
    resume: null,
    deps,
  };
  const actor = createActor(machine, { input });
  actor.start();
  return { actor };
}

describe("the machine: a chromatic degree's lean, sung and in Quiet mode", () => {
  const sung = (familyId: string, level: number, cat: string): Trial => {
    const t = trialAt(familyId, level, SEEDS[6] as number, cat);
    return { ...t, params: { ...t.params, sungResolution: true } };
  };
  const depsWith = (graded: { calls: Trial[] }): DrillDeps => ({
    grade: (trial, response) => gradeTrial(registry.family(trial.family), trial, response, PROFILE),
    gradeResolution: (trial) => {
      graded.calls.push(trial);
      const targets = trial.params.resolutionTargets as { midi: number }[];
      return {
        credit: 1,
        passed: true,
        sung: targets.map((t) => ({ midi: t.midi, cents: 0, credit: 1 })),
      };
    },
    sungOf: () => [],
    now: () => 1000,
    iso: () => "2026-11-13T10:00:00.000Z",
  });

  test("sung: two notes are asked, graded and recorded as ♯4 5; the identification credit is untouched", async () => {
    const graded = { calls: [] as Trial[] };
    const seen: unknown[] = [];
    const { actor } = runMachine([sung("fam.deg.fet-chromatic", 1, "deg.s4")], depsWith(graded), { seen });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    const asked = actor.getSnapshot().context.current?.trial as Trial;
    expect((asked.params.resolutionTargets as unknown[]).length).toBe(2);
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "SUBMIT", answer: { degrees: ["#4"] } });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    // The near miss is one of the things to hear before moving on.
    actor.send({ type: "AUDITION", what: "near" });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    expect(seen).toEqual(["near"]);
    actor.send({ type: "NEXT" });
    await waitFor(actor, (st) => st.matches({ resolution: "running" }));
    actor.send({ type: "CAPTURED", frames: [] });
    await waitFor(actor, (st) => st.matches({ resolution: "done" }));
    const ctx = actor.getSnapshot().context;
    expect(graded.calls.length).toBe(1);
    expect(((graded.calls[0]?.params.resolutionTargets ?? []) as unknown[]).length).toBe(2);
    const rec = ctx.records[0];
    expect(rec?.correct).toBe(true);
    expect(rec?.credit).toBe(1);
    expect(rec?.sungResolution?.path).toEqual(["#4", "5"]);
    expect(rec?.sungResolution?.notes.length).toBe(2);
    expect(rec?.sungResolution?.quiet).toBe(false);
    expect(rec?.response.sung?.length).toBe(2);
  });

  test("Quiet mode: the lean is heard, then heard in the head; nothing is graded and no voice is recorded", async () => {
    const graded = { calls: [] as Trial[] };
    const { actor } = runMachine([sung("fam.deg.fet-chromatic", 1, "deg.b7")], depsWith(graded), {
      quiet: true,
    });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "SUBMIT", answer: { degrees: ["b7"] } });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    actor.send({ type: "NEXT" });
    await waitFor(actor, (st) => st.matches({ resolution: "running" }));
    actor.send({ type: "PRESENTED" });
    await waitFor(actor, (st) => st.matches({ resolution: "imagining" }));
    actor.send({ type: "HEARD" });
    await waitFor(actor, (st) => st.matches({ resolution: "done" }));
    const rec = actor.getSnapshot().context.records[0];
    expect(graded.calls.length).toBe(0);
    expect(rec?.correct).toBe(true);
    expect(rec?.modality).toBe("quiet");
    expect(rec?.sungResolution?.quiet).toBe(true);
    expect(rec?.sungResolution?.notes).toEqual([]);
    expect(rec?.sungResolution?.path).toEqual(["b7", "6"]);
    expect(rec?.response.sung ?? null).toBeNull();
  });
});

// --- the chord from outside the key ---------------------------------------------------------------------

describe("the chord from outside the key: which bar, what it is, where it leans", () => {
  const d = def("fam.har.chromatic");
  const TARGET: Record<string, string> = { "V/V": "V", "V/vi": "vi", "V/ii": "ii", "V/IV": "IV" };
  const TWIN: Record<string, string> = {
    "V/V": "ii7",
    "V/vi": "iii7",
    "V/ii": "vi7",
    "V/IV": "Imaj7",
    iv: "IV",
    bVI: "vi",
    bVII: "vii°",
  };

  test("every secondary dominant and borrowed chord is read from the notes in its bar", () => {
    for (const cat of Object.keys(TWIN))
      for (const seed of SEEDS.slice(0, 6)) {
        const t = trialAt("fam.har.chromatic", 4, seed, cat);
        const o = outsideChordOf(t) as NonNullable<ReturnType<typeof outsideChordOf>>;
        expect(o.bar).toBe(t.params.chromaticBar as number);
        if (cat in TARGET) {
          expect(o.kind).toBe("secondary");
          expect(o.rn).toBe(`V7/${TARGET[cat]}`);
          expect(o.target?.rn).toBe(TARGET[cat] as string);
        } else {
          expect(o.kind).toBe("borrowed");
          expect(o.rn).toBe(cat.replace("b", "♭"));
          expect(o.target).toBeNull();
        }
        expect(o.twin?.rn).toBe(TWIN[cat] as string);
        expect(o.notes.length).toBeGreaterThan(0);
      }
  });

  test("the outside notes are named by the chord: ♯4 fi under V7/V, ♭6 le under iv", () => {
    const vv = outsideChordOf(trialAt("fam.har.chromatic", 1, SEEDS[0] as number, "V/V"));
    expect(vv?.notes.map((n) => `${n.degree} ${n.syllable}`)).toEqual(["♯4 fi"]);
    const vvi = outsideChordOf(trialAt("fam.har.chromatic", 2, SEEDS[0] as number, "V/vi"));
    expect(vvi?.notes.map((n) => `${n.degree} ${n.syllable}`)).toEqual(["♯5 si"]);
    const iv = outsideChordOf(trialAt("fam.har.chromatic", 3, SEEDS[0] as number, "iv"));
    expect(iv?.notes.map((n) => `${n.degree} ${n.syllable}`)).toEqual(["♭6 le"]);
    const t = trialAt("fam.har.chromatic", 1, SEEDS[0] as number, "V/V");
    const o = outsideChordOf(t) as NonNullable<ReturnType<typeof outsideChordOf>>;
    const key = t.params.key as { tonic: string; mode: "major" };
    expect(outsideLine(o, key)).toBe(
      `Bar ${o.bar} is V7/V: the dominant of V, and it leans to V. Its ♯4 is the note from outside the key.`,
    );
    expect(outsideLine(o, key, { chordSymbols: true, syllables: true })).toContain(`V7/V (${o.symbol})`);
    expect(outsideLine(o, key, { syllables: true })).toContain("♯4 (fi)");
    const b = trialAt("fam.har.chromatic", 3, SEEDS[2] as number, "bVI");
    const bo = outsideChordOf(b) as NonNullable<ReturnType<typeof outsideChordOf>>;
    expect(outsideLine(bo, b.params.key as never)).toContain("borrowed from");
    expect(outsideLine(bo, b.params.key as never)).toContain("where the key's own chord is vi");
  });

  test("the near miss puts the key's own chord in that bar: every note of the passage is then in the key", () => {
    for (const cat of Object.keys(TWIN)) {
      const t = trialAt("fam.har.chromatic", 4, SEEDS[3] as number, cat);
      const near = nearMissOf(t, d, null) as NonNullable<ReturnType<typeof nearMissOf>>;
      expect(near.label).toBe(`With ${TWIN[cat]}, the key's own chord`);
      const tonic = tonicPc(t.params.key as never);
      const scale = [0, 2, 4, 5, 7, 9, 11].map((s) => (s + tonic) % 12);
      for (const e of near.plan.events) expect(scale).toContain((e.value.note as number) % 12);
      // The same number of notes, at the same times: only that bar's pitches moved.
      expect(near.plan.events.length).toBe(t.events.filter((e) => e.midi !== null).length);
    }
  });

  test("alone is the chord, then where it goes; the options read as chords with their targets", () => {
    const t = trialAt("fam.har.chromatic", 1, SEEDS[0] as number, "V/V");
    const alone = wave6Alone(t);
    expect(alone?.label).toBe("The chord, then where it goes");
    const slots = chordSlotsOf(t);
    const o = outsideChordOf(t) as NonNullable<ReturnType<typeof outsideChordOf>>;
    expect(notesAt(alone?.plan as never, 0)).toEqual(slots[o.index]?.midis as number[]);
    expect(notesAt(alone?.plan as never, 1.8)).toEqual(slots[o.index + 1]?.midis as number[]);
    expect(stageFOptionLabel("harmony-chromatic", "V/V")).toBe("V7/V · leans to V");
    expect(stageFOptionLabel("harmony-chromatic", "V/vi")).toBe("V7/vi · leans to vi");
    expect(stageFOptionLabel("harmony-chromatic", "bVI")).toBe("♭VI · borrowed");
    expect(stageFCategoryLabel("harmony-chromatic", "V/IV")).toBe("V7/IV");
    expect(levelNews(d, 3)).toBe("iv, ♭VI, ♭VII join in");
  });

  test("after 'which bar', one more for the ear: which chord it was (never recorded)", () => {
    const bar = SEEDS.map((s) => trialAt("fam.har.chromatic", 2, s, "V/vi")).find(
      (t) => t.params.ui === "bar-buttons",
    ) as Trial;
    const f = followUpOf(bar, d) as NonNullable<ReturnType<typeof followUpOf>>;
    expect(f.correct).toBe("V/vi");
    expect(f.options.map((o) => o.id)).toEqual(["V/V", "V/vi", "V/ii", "V/IV"]);
    expect(f.options.find((o) => o.id === "V/vi")?.label).toBe("V7/vi · leans to vi");
    expect(f.answer).toBe("V7/vi: it leans to vi.");
    // Level 1 has one chord to name: nothing to ask. A "which chord" trial has asked it already.
    expect(followUpOf(trialAt("fam.har.chromatic", 1, SEEDS[0] as number, "V/V"), d)).toBeNull();
    const named = SEEDS.map((s) => trialAt("fam.har.chromatic", 2, s, "V/ii")).find(
      (t) => t.params.ui !== "bar-buttons",
    );
    if (named) expect(followUpOf(named, d)).toBeNull();
  });
});

// --- modes -------------------------------------------------------------------------------------------------

describe("modes: the one changed note, and the tune in the scale it is compared with", () => {
  const d = def("fam.key.mode");

  test("the line names the family scale and the note that moved", () => {
    const line = (mode: string) => modeLine(trialAt("fam.key.mode", 5, SEEDS[0] as number, mode));
    expect(line("dorian")).toBe("Dorian: natural minor with a raised 6 (1 2 ♭3 4 5 6 ♭7).");
    expect(line("mixolydian")).toBe("Mixolydian: major with a lowered 7 (1 2 3 4 5 6 ♭7).");
    expect(line("lydian")).toBe("Lydian: major with a raised 4 (1 2 3 ♯4 5 6 7).");
    expect(line("phrygian")).toBe("Phrygian: natural minor with a lowered 2 (1 ♭2 ♭3 4 5 ♭6 ♭7).");
    expect(line("major")).toBeNull();
  });

  test("the near miss is the tune in the other scale, as headless Strudel plays it", async () => {
    for (const [mode, other, label] of [
      ["dorian", "minor", "The tune in natural minor"],
      ["mixolydian", "major", "The tune in major"],
      ["lydian", "major", "The tune in major"],
      ["phrygian", "minor", "The tune in natural minor"],
    ] as const) {
      const t = SEEDS.map((s) => trialAt("fam.key.mode", 5, s, mode)).find(
        (x) => nearMissOf(x, d, null) !== null,
      ) as Trial;
      const near = nearMissOf(t, d, null) as NonNullable<ReturnType<typeof nearMissOf>>;
      expect(near.label).toBe(label);
      const mel = (t.code.split("\n").find((l) => l.startsWith("mel:")) ?? "").replace(/^mel:\s*/, "");
      const bars = Number(t.params.bars);
      const strudel = (await midisOf(mel.replace(`:${mode}"`, `:${other}"`), bars)).filter(
        (m): m is number => m !== null,
      );
      expect(near.plan.events.map((e) => e.value.note as number)).toEqual(strudel);
    }
  });

  test("a wrong pick is the scale the tune is played back in", () => {
    const t = SEEDS.map((s) => trialAt("fam.key.mode", 5, s, "dorian")).find(
      (x) => nearMissOf(x, d, { choice: ["phrygian"] }) !== null,
    ) as Trial;
    expect(nearMissOf(t, d, { choice: ["phrygian"] })?.label).toBe("The tune in Phrygian");
    expect(aloneLabel(t)).toBe("The tune alone");
  });
});

// --- key changes -------------------------------------------------------------------------------------------

describe("key changes: where home moved, which way and how far", () => {
  const d = def("fam.har.modulation");

  test("a lift is read from the two keys: the bar, the direction and the size", () => {
    for (const seed of SEEDS) {
      const t = trialAt("fam.har.modulation", 1, seed, "truck-driver");
      const k = keyChangeOf(t) as NonNullable<ReturnType<typeof keyChangeOf>>;
      expect(k.bar).toBe(Number((t.expected as Answer).choice?.[0]));
      expect([1, 2]).toContain(k.semitones);
      expect(k.move).toBe(k.semitones === 1 ? "up a half step" : "up a whole step");
      expect(k.spans.map((s) => [s.fromBar, s.toBar])).toEqual([
        [1, (k.bar as number) - 1],
        [k.bar as number, 8],
      ]);
      expect(keyChangeLine(k)).toBe(
        `Home moves at bar ${k.bar}: ${k.spans[0]?.label} to ${k.spans[1]?.label}, ${k.move}.`,
      );
    }
  });

  test("after the change every chord is read in the key in force at its bar", () => {
    const t = trialAt("fam.har.modulation", 1, SEEDS[3] as number, "truck-driver");
    const k = keyChangeOf(t) as NonNullable<ReturnType<typeof keyChangeOf>>;
    const labels = keyChangeLabels(t, { chordSymbols: true, romanNumerals: true });
    expect(labels.length).toBe(8);
    // The lifted phrase starts again on its home chord: I over 1 in the new key, never ♭II of the old one.
    const first = labels.find((l) => l.bar === k.bar);
    expect(first?.rn).toBe("I");
    expect(first?.degree).toBe("1");
    expect(labels[0]?.rn).toBe("I");
    for (const l of labels) expect(l.rn).toMatch(/^(I|ii|iii|IV|V|vi|vii°)$/);
    expect(keyAtBar(k, (k.bar as number) - 1)).toEqual(k.from);
    expect(keyAtBar(k, k.bar as number)).toEqual(k.to as never);
    // A move to the relative minor reads its new bars in minor: i, iv and the major V.
    const rel = keyChangeLabels(trialAt("fam.har.modulation", 2, SEEDS[1] as number, "relative"), {
      chordSymbols: false,
      romanNumerals: true,
    });
    expect(rel.at(-1)?.rn).toMatch(/^(i|iv|V)$/);
    expect(rel.every((l) => l.symbol === null)).toBe(true);
  });

  test("no change, the relative minor and the dominant say what they are", () => {
    const none = keyChangeOf(trialAt("fam.har.modulation", 1, SEEDS[0] as number, "none"));
    expect(none?.to).toBeNull();
    expect(none?.spans.length).toBe(1);
    expect(keyChangeLine(none as never)).toMatch(/^Home never moved: [A-G][♭♯]? major all the way\.$/);
    const rel = keyChangeOf(trialAt("fam.har.modulation", 2, SEEDS[1] as number, "relative"));
    expect(rel?.relation).toBe("relative");
    expect(rel?.move).toBe("to the relative minor, a minor third below");
    const dom = keyChangeOf(trialAt("fam.har.modulation", 3, SEEDS[2] as number, "dominant-pivot"));
    expect(dom?.relation).toBe("dominant");
    expect(dom?.move).toBe("up a fifth, to the dominant");
  });

  test("the near miss is the lift undone: from the change on, the phrase stays in the old key", () => {
    const t = trialAt("fam.har.modulation", 1, SEEDS[3] as number, "truck-driver");
    const k = keyChangeOf(t) as NonNullable<ReturnType<typeof keyChangeOf>>;
    const near = nearMissOf(t, d, null) as NonNullable<ReturnType<typeof nearMissOf>>;
    expect(near.label).toBe("Without the lift");
    const tonic = tonicPc(t.params.key as never);
    const scale = [0, 2, 4, 5, 7, 9, 11].map((s) => (s + tonic) % 12);
    for (const e of near.plan.events) expect(scale).toContain((((e.value.note as number) % 12) + 12) % 12);
    // A move through a pivot has no such near miss; neither has a passage that never moved.
    expect(nearMissOf(trialAt("fam.har.modulation", 2, SEEDS[1] as number, "relative"), d, null)).toBeNull();
    expect(nearMissOf(trialAt("fam.har.modulation", 1, SEEDS[0] as number, "none"), d, null)).toBeNull();
    expect(k.to).not.toBeNull();
  });

  test("alone is the two homes; one more for the ear asks which way and how far", () => {
    const t = trialAt("fam.har.modulation", 1, SEEDS[4] as number, "truck-driver");
    const k = keyChangeOf(t) as NonNullable<ReturnType<typeof keyChangeOf>>;
    const alone = wave6Alone(t);
    expect(alone?.label).toBe("The two homes");
    const first = notesAt(alone?.plan as never, 0);
    const second = notesAt(alone?.plan as never, 1.9);
    expect(second.map((m, i) => (((m - (first[i] as number)) % 12) + 12) % 12)).toEqual(
      first.map(() => k.semitones),
    );
    expect(wave6Alone(trialAt("fam.har.modulation", 1, SEEDS[0] as number, "none"))?.label).toBe("Home");
    const f = followUpOf(t, d) as NonNullable<ReturnType<typeof followUpOf>>;
    expect(f.prompt).toBe("Which way did home move, and how far?");
    expect(f.options.map((o) => o.id)).toEqual(["up-half", "up-step"]);
    expect(f.correct).toBe(k.relation);
    const l3 = followUpOf(trialAt("fam.har.modulation", 3, SEEDS[2] as number, "dominant-pivot"), d);
    expect(l3?.options.map((o) => o.id)).toEqual(["up-half", "up-step", "relative", "dominant"]);
    expect(l3?.correct).toBe("dominant");
    expect(followUpOf(trialAt("fam.har.modulation", 1, SEEDS[0] as number, "none"), d)).toBeNull();
    expect(stageFCategoryLabel("harmony-modulation", "truck-driver")).toBe(
      "a lift by a half or a whole step",
    );
  });
});

// --- rhythm II ---------------------------------------------------------------------------------------------

describe("rhythm II: the push on the grid, the hats' division, triplets and the beat in three", () => {
  test("find the push is one bar of cells on the rhythm grid, answered as the family's own cells", () => {
    const d = def("fam.rhy.syncopation");
    for (const level of [1, 2, 3, 4])
      for (const seed of SEEDS.slice(0, 6)) {
        const t = trialAt("fam.rhy.syncopation", level, seed);
        const s = surfaceOf(t, d);
        if (s.kind !== "widget" || s.spec.ui !== "grid") throw new Error("expected the grid");
        expect(s.spec).toEqual({ ui: "grid", rows: ["hit"], stepsPerBar: 16, bars: 1 });
        const want = expectedValueOf(s.spec, t.expected as Answer) as boolean[][];
        expect(want[0]?.filter(Boolean).length).toBe(((t.expected as Answer).choice ?? []).length);
        const answer = trialAnswerOf(t, s.spec, want);
        expect(answer).toEqual({ choice: (t.expected as Answer).choice as string[] });
        expect(grade(t, answer).correct).toBe(true);
        const off = want.map((row) => row.map((on, i) => (i === 0 ? !on : on)));
        expect(grade(t, trialAnswerOf(t, s.spec, off)).correct).toBe(false);
      }
    const two = trialAt("fam.rhy.syncopation", 4, SEEDS[0] as number, "two-per-bar");
    expect(promptOf(two, d)).toBe("Mark the two kicks that land off the beat.");
    expect(promptOf(trialAt("fam.rhy.syncopation", 1, SEEDS[0] as number), d)).toBe(
      "Mark the kick that lands off the beat.",
    );
  });

  test("where the push sits is said in counts", () => {
    expect(cellCount(14)).toBe("the & of 4");
    expect(cellCount(0)).toBe("beat 1");
    expect(cellCount(9)).toBe("the e of 3");
    const t = SEEDS.map((s) => trialAt("fam.rhy.syncopation", 1, s, "anticipation")).find(
      (x) => clickCellsOf(x)?.expected[0] === "14",
    );
    if (t) expect(pushLine(t)).toBe("The pushed kick is on the & of 4, an eighth ahead of beat 1.");
    const any = trialAt("fam.rhy.syncopation", 3, SEEDS[1] as number, "offbeat-16th");
    expect(pushLine(any)).toMatch(
      /^The pushed kick is on the [e&a] of [1-4], (a sixteenth|an eighth|three sixteenths) ahead of beat [1-4]\.$/,
    );
  });

  test('the feedback names the pushed cell in counts, never by the grid\'s id ("c6")', () => {
    for (const seed of SEEDS) {
      const t = trialAt("fam.rhy.syncopation", 1, seed, "anticipation");
      const text = clickCellText(t);
      expect(text).toMatch(
        /^(bar \d+, )?(the [e&a] of [1-4]|beat [1-4])(; (bar \d+, )?(the [e&a] of [1-4]|beat [1-4]))*$/,
      );
      expect(text).not.toMatch(/\bc\d+/);
    }
    const t = SEEDS.map((s) => trialAt("fam.rhy.syncopation", 1, s, "anticipation")).find(
      (x) => clickCellsOf(x)?.expected[0] === "14",
    );
    if (t) expect(clickCellText(t)).toBe("the & of 4");
    expect(clickCellText(trialAt("fam.chd.quality-7th", 1, SEEDS[0] as number))).toBeNull();
  });

  test("the near miss of a push is the same groove with that kick on the beat", () => {
    const d = def("fam.rhy.syncopation");
    const t = trialAt("fam.rhy.syncopation", 1, SEEDS[2] as number, "anticipation");
    const near = nearMissOf(t, d, null) as NonNullable<ReturnType<typeof nearMissOf>>;
    expect(near.label).toBe("With the kick on the beat");
    const beatSec = 1 / t.cps / 4;
    const kicks = near.plan.events.filter((e) => e.value.s === "bd" || /bd/.test(String(e.value.s)));
    expect(kicks.length).toBeGreaterThan(0);
    for (const k of kicks) expect(Math.abs(k.at / beatSec - Math.round(k.at / beatSec))).toBeLessThan(1e-6);
    expect(wave6Alone(t)?.label).toBe("Kick alone");
  });

  test("the hats divided another way: the learner's pick, else the contrast", () => {
    const d = def("fam.rhy.subdivision");
    const t = trialAt("fam.rhy.subdivision", 1, SEEDS[0] as number, "triplets");
    const near = nearMissOf(t, d, null) as NonNullable<ReturnType<typeof nearMissOf>>;
    expect(near.label).toBe("With eighths instead");
    const hats = (p: { events: { value: { s?: unknown } }[] }) =>
      p.events.filter((e) => /hh/.test(String(e.value.s))).length;
    const again = auditionPlan(t, "again", { taps: null, answer: null }, PROFILE);
    // Three to the beat became two: two thirds as many hats.
    expect(hats(near.plan) * 3).toBe(hats(again as never) * 2);
    expect(nearMissOf(t, d, { choice: ["sixteenths"] })?.label).toBe("With sixteenths instead");
    expect(optionLabel("triplets", "rhythm-subdivision")).toBe("Triplets: three to the beat");
    expect(wave6Alone(t)?.label).toBe("Hats alone");
  });

  test("a tapped triplet bar shows its count; a bar in 6/8 counts 1 la li 2 la li", () => {
    const trip = trialAt("fam.rhy.echo", 6, SEEDS[0] as number, "triplets");
    const marks = countMarks(trip, 2 / trip.cps);
    expect(marks.slice(0, 6).map((m) => m.label)).toEqual(["1", "trip", "let", "2", "trip", "let"]);
    expect(marks.filter((m) => m.beat).length).toBe(8);
    const six = trialAt("fam.rhy.echo", 7, SEEDS[0] as number, "compound");
    expect(six.params.meter).toBe("6/8");
    const count = countMarks(six, 2 / six.cps);
    expect(count.slice(0, 6).map((m) => m.label)).toEqual(["1", "la", "li", "2", "la", "li"]);
    // Two beats to the bar: the dotted quarter.
    expect(count.filter((m) => m.beat).length).toBe(4);
    expect(meterLine(six)).toBe("6/8: two beats to the bar, each in three (1 la li 2 la li).");
    expect(promptOf(six, def("fam.rhy.echo"))).toBe(
      "Listen to the bar, then tap it back over the click: two beats, each in three.",
    );
    // Plain duple rhythm keeps its beat lines and no count.
    const plain = trialAt("fam.rhy.echo", 2, SEEDS[0] as number);
    expect(countMarks(plain, 2 / plain.cps)).toEqual([]);
    expect(meterLine(plain)).toBeNull();
  });

  test("a triplet rhythm is written on the staff with triplet values, and graded right as written", () => {
    const d = def("fam.rhy.dictation");
    const t = SEEDS.map((s) => trialAt("fam.rhy.dictation", 7, s, "triplets")).find(hasTriplets) as Trial;
    expect(t).toBeDefined();
    const spec = staffSpecOf(t);
    expect(spec.palette.durations).toContain("8t");
    const value = expectedStaffValue(t) as string;
    expect(value).toMatch(/:8t/);
    const answer = staffAnswer(t, value);
    expect(answer).not.toBeNull();
    expect(grade(t, answer).correct).toBe(true);
    // A level without triplets offers none.
    const plain = trialAt("fam.rhy.dictation", 5, SEEDS[0] as number, "dotted");
    expect(staffSpecOf(plain).palette.durations).not.toContain("8t");
    expect(surfaceOf(t, d).kind).toBe("widget");
  });

  test("grids of 6 and 24 steps reach the widget as asked", () => {
    const base = trialAt("fam.rhy.dictation", 1, SEEDS[0] as number);
    const d = def("fam.rhy.dictation");
    for (const steps of [6, 12, 24]) {
      const t = { ...base, params: { ...base.params, ui: "grid", stepsPerBar: steps } };
      const s = surfaceOf(t, d);
      if (s.kind !== "widget" || s.spec.ui !== "grid") throw new Error("expected the grid");
      expect(s.spec.stepsPerBar).toBe(steps as 6);
    }
  });
});

// --- d16: the same two buttons in a lesson's ear step ---------------------------------------------------------

describe("after any ear trial: the thing alone, and the thing in context (d16)", () => {
  test("a degree: the note alone, and the note in context (the cadence, then the note)", () => {
    const t = trialAt("fam.deg.fet-major", 2, SEEDS[0] as number);
    const { alone, context } = earAfterAnswer(t, PROFILE);
    expect(alone?.label).toBe("The note alone");
    expect(alone?.plan.events.length).toBe(1);
    expect(context?.label).toBe("The note in context");
    expect((context?.plan.events.length ?? 0) > 1).toBe(true);
    expect(context?.plan).toEqual(auditionPlan(t, "again", { taps: null, answer: null }, PROFILE) as never);
  });

  test("a chord: its own alone and its key; a tune: the tune and the passage", () => {
    const seventh = earAfterAnswer(trialAt("fam.chd.quality-7th", 1, SEEDS[0] as number, "7"), PROFILE);
    expect(seventh.alone?.label).toBe("The 3rd and 7th alone");
    expect(seventh.context?.label).toBe("In its key");
    const mode = earAfterAnswer(trialAt("fam.key.mode", 1, SEEDS[0] as number), PROFILE);
    expect(mode.alone?.label).toBe("The tune alone");
    expect(mode.context?.label).toBe("In context");
    const bass = earAfterAnswer(trialAt("fam.har.bass", 1, SEEDS[0] as number), PROFILE);
    expect(bass.alone?.label).toBe("The bass alone");
  });

  test("every Wave 6 ear family offers both, on every level", () => {
    for (const id of [
      "fam.chd.quality-7th",
      "fam.deg.fet-chromatic",
      "fam.har.chromatic",
      "fam.har.modulation",
      "fam.key.mode",
      "fam.rhy.syncopation",
      "fam.rhy.subdivision",
    ])
      def(id).levels.forEach((_, i) => {
        const t = trialAt(id, i + 1, SEEDS[i] as number);
        const { alone, context } = earAfterAnswer(t, PROFILE);
        expect(alone, `${id} L${i + 1} alone`).not.toBeNull();
        expect(context, `${id} L${i + 1} context`).not.toBeNull();
      });
  });
});

// --- the Practice hub --------------------------------------------------------------------------------------

describe("the Practice hub: stages F and H, and mixed practice as progress", () => {
  test("the new families sit with their stages", () => {
    const groups = groupByStage(families, EAR_STAGES);
    const ids = (k: string) => groups.find((g) => g.key === k)?.families.map((f) => f.id) ?? [];
    expect(ids("F")).toEqual(["fam.deg.fet-chromatic", "fam.har.chromatic", "fam.har.modulation"]);
    expect(ids("H")).toContain("fam.rhy.syncopation");
    expect(ids("H")).toContain("fam.rhy.subdivision");
    expect(ids("E")).toContain("fam.int.isolated");
    expect(groups.find((g) => g.key === "F")?.sub).toBe(
      "Notes and chords from outside the key, and the moment home itself moves.",
    );
  });

  test("levels are named in plain words", () => {
    expect(categoryLabel("truck-driver", "harmony-modulation")).toBe("A lift by a half or a whole step");
    expect(categoryLabel("anticipation", "rhythm-syncopation")).toBe("A kick pushed ahead of the beat");
    expect(categoryLabel("V/V", "harmony-chromatic")).toBe("V7/V");
    expect(categoryLabel("compound", "rhythm-echo")).toBe("6/8: two beats, each in three");
    expect(levelNews(def("fam.har.modulation"), 2)).toBe("a move to the relative minor joins in");
    expect(levelNews(def("fam.rhy.syncopation"), 2)).toBe("off-beat eighths joins in");
  });

  test("a composite reads as what it has gathered, never as families that went away", () => {
    const st = (id: string, compositeId: string | null, graduated: boolean): [string, FamilyState] => [
      id,
      {
        familyId: id,
        level: 4,
        compositeId,
        graduatedAt: graduated ? "2026-11-01T10:00:00.000Z" : null,
      } as never,
    ];
    const harmony = families.find((f) => f.title === "Mixed harmony") as FamilyDef;
    const pitch = families.find((f) => f.title === "Mixed pitch") as FamilyDef;
    const states = new Map<string, FamilyState>([
      st("fam.chd.quality-triad", harmony.id, true),
      st("fam.chd.quality-7th", harmony.id, true),
      st("fam.har.cadence", harmony.id, false),
      st("fam.deg.fet-major", pitch.id, true),
    ]);
    const out = compositesProgress(families, states);
    expect(out.map((c) => c.title).sort()).toEqual(["Mixed harmony", "Mixed pitch"]);
    const h = out.find((c) => c.id === harmony.id);
    expect(h?.members).toEqual([def("fam.chd.quality-triad").title, def("fam.chd.quality-7th").title]);
    expect(h?.line).toBe(
      `2 families live here now: ${def("fam.chd.quality-triad").title} and ${def("fam.chd.quality-7th").title}. Each comes up two trials at a time, at the level you reached.`,
    );
    expect(out.find((c) => c.id === pitch.id)?.line).toMatch(/^One family lives here now: /);
    expect(compositesProgress(families, new Map())).toEqual([]);
    // A title that ends in "?" ends the sentence: never "Higher or lower?." (UX review P15).
    const asked = compositesProgress(families, new Map([st("fam.pit.compare", pitch.id, true)]));
    expect(asked[0]?.line).toBe(
      "One family lives here now: Higher or lower? Each comes up two trials at a time, at the level you reached.",
    );
  });
});
