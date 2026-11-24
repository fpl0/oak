// Wave 7 in the runner's pure core and machine: stage G (the ii–V–I as one gesture and the key it lands in, guide
// tones, extensions, substitutions, voicings), the rest of stage H (swing ratio and eighths against sixteenths, clave
// and its direction, odd groupings, polyrhythm and the two-lane tap) and the sound families (which control changed,
// who plays which role). Every musical sentence the runner prints is checked against @oak/theory or the trial's own
// notes; every "alone" and "near miss" is checked to play something that is not the stimulus; the machine takes a
// two-lane take hand by hand and a sung trial in Quiet mode without the mic.
import { describe, expect, test } from "bun:test";
import type { Answer, DrillSession, FamilyDef, Trial } from "@oak/api";
import { CLAVE_GRIDS, SWING_FEELS } from "@oak/content-kit";
import { type AudioPlan, createRegistry, DEFAULT_PROFILE, generateTrial, tapLanesOfTrial } from "@oak/drills";
import { chordOf, chordPcs, claveOf, guideTones, readChord, tritoneSub } from "@oak/theory";
import { createActor, fromCallback, fromPromise, waitFor } from "xstate";
import { EAR_STAGES, families } from "../../../content/families.ts";
import { promptOf } from "./copy.ts";
import { chordSlotsOf } from "./harmony.ts";
import { aloneLabel, alonePlan, auditionPlan, earAfterAnswer } from "./listen.ts";
import { type DrillDeps, type DrillInput, drillMachine } from "./machine.ts";
import {
  categoryLabel,
  choiceOptionsOf,
  gradeDrillTrial,
  groupByStage,
  levelLine,
  optionLabel,
  surfaceOf,
} from "./model.ts";
import {
  _test,
  claveLine,
  claveStepsOf,
  eighthCount,
  familiesByTrack,
  groupingLine,
  iiVFollowUp,
  isWave7Listen,
  landingKeyOf,
  lanesAnswerPlan,
  lanesComparePlan,
  lanesReport,
  laneTaps,
  lessonWithTrack,
  polyLine,
  quietPracticeOf,
  rhythmLanesOf,
  soundChangeLine,
  stageGFact,
  stageGPrompt,
  swingLine,
  swingOf,
  tapLanesOf,
  trackLockedText,
  trackOfFamily,
  trackOfLesson,
  wave7Alone,
  wave7Context,
  wave7FollowUp,
  wave7Near,
} from "./wave7.ts";

const registry = createRegistry(families, []);
const def = (id: string) => families.find((f) => f.id === id) as FamilyDef;
const PROFILE = { ...DEFAULT_PROFILE, comfLow: 50, comfHigh: 65 };
const SEEDS = Array.from({ length: 10 }, (_, i) => 900 + i * 41);
const ALL_SHOWN = { chordSymbols: true, romanNumerals: true, noteNames: true };
const NONE_SHOWN = { chordSymbols: false, romanNumerals: false, noteNames: false };

function trialAt(familyId: string, level: number, seed: number, category: string): Trial {
  const d = def(familyId);
  return generateTrial(
    registry.family(familyId as never),
    { index: 0, family: familyId as never, level, category, seed },
    PROFILE,
    d.categories.map((c) => c.id),
  ) as Trial;
}
/** A plan's notes and drums as a comparable list (time, sound, pitch). */
const shape = (p: AudioPlan | null | undefined): string[] =>
  (p?.events ?? []).map((e) => `${e.at.toFixed(3)}|${e.value.s}|${e.value.note ?? ""}`).sort();
const stimulus = (t: Trial) => auditionPlan(t, "answer", { taps: null, answer: null }, PROFILE);
/** The same trial with no question of its own (the runner's words are asked then). */
const unprompted = (t: Trial): Trial => {
  const { prompt: _p, ...params } = t.params;
  return { ...t, params } as Trial;
};
/** The first draw of a family whose test holds (the generators pick at random inside a category). */
function drawWhere(familyId: string, level: number, category: string, ok: (t: Trial) => boolean): Trial {
  // The level asked first, then any level that plays the category (a ladder may move a category between levels).
  const levels = [
    level,
    ...def(familyId)
      .levels.map((_, i) => i + 1)
      .filter((l) => l !== level),
  ];
  for (const l of levels)
    for (let seed = 1; seed < 200; seed++) {
      const t = trialAt(familyId, l, seed * 13, category);
      if (t.category === category && ok(t)) return t;
    }
  throw new Error(`no ${familyId} ${category} draw matched`);
}

// --- the tracks ---------------------------------------------------------------------------------------------------

describe("the tracks: which families each opens, and honest words for what is closed", () => {
  test("track lessons are read by their id; A1.L01–L04 belong to Arrangement & Sound", () => {
    expect(trackOfLesson("J1.L03")).toBe("J");
    expect(trackOfLesson("R2.L04")).toBe("R");
    expect(trackOfLesson("A1.L02")).toBe("A");
    expect(trackOfLesson("A2.L01")).toBe("A");
    expect(trackOfLesson("J.CP1")).toBe("J");
    expect(trackOfLesson("U13.L05")).toBeNull();
    expect(lessonWithTrack("R1.L02")).toBe("R1.L02 (Advanced Rhythm)");
    expect(lessonWithTrack("U14.L03")).toBe("U14.L03");
  });

  test("every stage G family is Jazz Harmony's; clave, odd groupings and polyrhythm Advanced Rhythm's", () => {
    const split = familiesByTrack(families);
    const ids = (k: "J" | "R" | "A") => split.tracks[k].map((d) => d.id);
    for (const id of EAR_STAGES.G) expect(ids("J")).toContain(id);
    for (const id of ["fam.rhy.clave", "fam.rhy.odd-grouping", "fam.rhy.polyrhythm"])
      expect(ids("R")).toContain(id);
    for (const id of ["fam.snd.params", "fam.snd.roles"]) expect(ids("A")).toContain(id);
    // The core keeps its own families, swing included (it opens at U11.L07; its level 4 waits for R1.L02).
    expect(split.core.map((d) => d.id)).toContain("fam.rhy.swing");
    expect(split.core.map((d) => d.id)).toContain("fam.rhy.syncopation");
    expect(trackOfFamily(def("fam.rhy.swing"))).toBeNull();
    // The core's stage groups no longer list a track family.
    const stageIds = groupByStage(split.core, EAR_STAGES).flatMap((g) => g.families.map((d) => d.id));
    expect(stageIds).not.toContain("fam.rhy.clave");
    expect(stageIds).not.toContain("fam.jzz.ii-v");
  });

  test("a closed track says its own line; an open one names the lesson that opens the family", () => {
    const clave = def("fam.rhy.clave");
    expect(trackLockedText(clave, { status: "locked", note: "Opens with the unit 13 checkpoint." })).toBe(
      "Opens with the unit 13 checkpoint.",
    );
    const titles = new Map([["R3.L01", "Clave Direction"]]);
    expect(trackLockedText(clave, { status: "open", note: "Next: R1.L01 Metric Weight." }, titles)).toBe(
      "Opens with the lesson “Clave Direction”",
    );
    // Without the title the line still never shows the lesson's ID alone.
    expect(trackLockedText(clave, null)).toBe("Opens with a later lesson of its track");
  });

  test("a core family whose next level waits for a track lesson names the track", () => {
    const swing = def("fam.rhy.swing");
    const st = {
      familyId: swing.id,
      level: 3,
      maxOpenLevel: 3,
      categoryStats: {},
      graduatedAt: null,
    } as unknown as Parameters<typeof levelLine>[1];
    expect(levelLine(swing, st)).toBe("Level 3 of 4 · level 4 opens with R1.L02 (Advanced Rhythm)");
  });

  test("Quiet mode: guide tones keep their listening half; a family that is only sung waits", () => {
    expect(quietPracticeOf(def("fam.jzz.guide"), true)).toBe("listening");
    expect(quietPracticeOf(def("fam.deg.sing"), true)).toBe("waits");
    expect(quietPracticeOf(def("fam.jzz.guide"), false)).toBeNull();
    expect(quietPracticeOf(def("fam.rhy.clave"), true)).toBeNull();
  });
});

// --- stage G: the ii–V–I --------------------------------------------------------------------------------------------

describe("the ii–V–I as one gesture: major against minor, and the key it lands in", () => {
  test("options and levels read as the learner's words, never as ids", () => {
    const d = def("fam.jzz.ii-v");
    expect(optionLabel("ii-V-I", d.generator)).toBe("ii–V–I");
    expect(optionLabel("I-IV-V", d.generator)).toBe("I–IV–V–I");
    expect(optionLabel("minor-ii-V", d.generator)).toBe("Minor: iiø7–V7–i");
    expect(categoryLabel("locate", d.generator)).toBe("Where a ii–V–I begins in eight bars");
    // The generator's own question wins; where it writes none, the runner asks its own.
    const t = trialAt(d.id, 2, SEEDS[0] as number, "minor-ii-V");
    if (typeof t.params.prompt === "string") expect(promptOf(t, d)).toBe(t.params.prompt);
    expect(stageGPrompt(unprompted(t), d)).toBe("A ii–V–I in major, or in minor?");
    expect(promptOf(unprompted(trialAt(d.id, 1, SEEDS[0] as number, "ii-V-I")), d)).toBe(
      "Which progression: a ii–V–I, or I–IV–V–I?",
    );
  });

  test("the fact names the key and the chords as the lenses allow, read from the notes", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const major = trialAt("fam.jzz.ii-v", 2, seed, "major-ii-V");
      const k = major.params.key as { tonic: string };
      const fact = stageGFact(major, ALL_SHOWN) as string;
      // A chord held over two bars is named once.
      expect(fact).toMatch(/^In .+ major: .+m7 \(ii7\), .+7 \(V7\), .+maj7 \(Imaj7\)\.$/);
      expect(stageGFact(major, NONE_SHOWN)).toMatch(/^In .+ major\.$/);
      expect(landingKeyOf(major)?.tonic.replace("b", "")).toBe(k.tonic.replace("b", ""));
      const minor = trialAt("fam.jzz.ii-v", 2, seed, "minor-ii-V");
      // The minor ii–V–i reads from its notes, an altered dominant included (iiø7, V7♭9, i).
      expect(stageGFact(minor, { ...NONE_SHOWN, romanNumerals: true })).toMatch(
        /^In .+ minor: (i7?, )?iiø7, V7[^,]*, i7?\.$/,
      );
    }
  });

  test("which key did it land in: the last chord's tonic, against the ii, the V and a fourth up", () => {
    const t = trialAt("fam.jzz.ii-v", 2, SEEDS[1] as number, "major-ii-V");
    const f = iiVFollowUp(t);
    expect(f).not.toBeNull();
    const land = landingKeyOf(t) as { tonic: string };
    expect(f?.correct).toBe(land.tonic);
    expect(new Set(f?.options.map((o) => o.id)).size).toBe(4);
    expect(f?.options.some((o) => o.id === land.tonic)).toBe(true);
    expect(f?.answer).toContain("Home is the last chord, not the first.");
    // Asked only after a ii–V; never after I–IV–V–I, a chain or a locate trial.
    expect(iiVFollowUp(trialAt("fam.jzz.ii-v", 1, SEEDS[1] as number, "I-IV-V"))).toBeNull();
    expect(wave7FollowUp(trialAt("fam.jzz.ii-v", 4, SEEDS[1] as number, "chain"))).toBeNull();
  });

  test("alone: the 3rds and 7ths as the voicing plays them; near: the other mode, else the learner's pick", () => {
    const t = trialAt("fam.jzz.ii-v", 2, SEEDS[2] as number, "major-ii-V");
    const alone = wave7Alone(t);
    expect(alone?.label).toBe("The 3rds and 7ths alone");
    // Every note of "alone" is a 3rd or a 7th of its slot's chord.
    for (const slot of chordSlotsOf(t)) {
      const c = slot.reading?.chord;
      if (!c) continue;
      const g = guideTones(c);
      const want = [g.third?.pc, g.seventh?.pc];
      const at = slot.at / t.cps;
      for (const e of alone?.plan.events.filter((x) => Math.abs(x.at - at) < 1e-6) ?? [])
        expect(want).toContain(((e.value.note as number) % 12) as never);
    }
    const near = wave7Near(t, def("fam.jzz.ii-v"), null);
    expect(near?.label).toBe("Against the minor ii–V–i");
    // The near miss is a minor ii–V–i on the same tonic: its first chord reads half-diminished.
    const first = near?.plan.events.filter((e) => e.at === 0).map((e) => e.value.note as number) ?? [];
    expect(readChord(first, Math.min(...first))?.quality).toBe("m7b5");
    const yours = wave7Near(t, def("fam.jzz.ii-v"), { choice: ["minor-ii-V"] });
    expect(yours?.label).toBe("Yours: the minor ii–V–i");
    expect(shape(near?.plan)).not.toEqual(shape(stimulus(t)));
  });
});

// --- stage G: guide tones ----------------------------------------------------------------------------------------

describe("guide tones: which voice moves; sing the 3rd, then the 7th", () => {
  test("which voice moves: the fact says what the notes do, and the 7th falls to the 3rd", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const t = trialAt("fam.jzz.guide", 1, seed, "v7-i-voice");
      const fact = stageGFact(t, NONE_SHOWN) as string;
      const answer = (t.expected as Answer).choice?.[0];
      expect(fact.startsWith(`The ${answer} voice moves a half step down`)).toBe(true);
      expect(wave7Alone(t)?.label).toBe("Each voice alone");
    }
  });

  test("the sung line: what the line is (checked against @oak/theory), the line alone, over the chords, and the other line", () => {
    const t = trialAt("fam.jzz.guide", 2, SEEDS[0] as number, "sing-3-7");
    expect(t.params.mode).toBe("sing");
    const fact = stageGFact(t, ALL_SHOWN) as string;
    // Dm7–G7–Cmaj7 from the 3rd: F (3rd of ii), F (7th of V), E (3rd of I): it holds, then falls a half step.
    expect(fact).toMatch(
      /^The line: the 3rd of .+m7 \(.+\), the 7th of .+7 \(.+\) and the 3rd of .+maj7 \(.+\)\./,
    );
    expect(fact).toContain("It holds and moves a half step down.");
    const alone = wave7Alone(t);
    expect(alone?.label).toBe("The line alone");
    const targets = (t.params.singTargets as { midi: number }[]).map((x) => x.midi);
    expect(alone?.plan.events.map((e) => e.value.note)).toEqual(targets);
    const ctx = wave7Context(t);
    expect(ctx?.label).toBe("The line over the chords");
    expect(ctx?.plan.events.length).toBeGreaterThan(targets.length);
    const near = wave7Near(t, def("fam.jzz.guide"), null);
    expect(near?.label).toBe("The line from the 7th");
    expect(near?.plan.events.map((e) => e.value.note)).not.toEqual(targets);
  });
});

// --- stage G: extensions, substitutions, voicings -----------------------------------------------------------------

describe("extensions: is there a 9; 9 against 13; altered against natural", () => {
  test("the fact names the colour note on top, checked against the chord's own notes", () => {
    const cases: [string, string, string][] = [
      ["7-9-13", "9", "9th"],
      ["7-9-13", "13", "13th"],
      ["9-b9-s9", "7#9", "♯9"],
      ["maj7-s11-69", "maj7#11", "♯11"],
      ["alt-13-b13", "7alt", "♭13"],
    ];
    for (const [cat, q, colour] of cases) {
      const t = drawWhere("fam.jzz.extension", 1, cat, (x) => (x.expected as Answer).choice?.[0] === q);
      expect(stageGFact(t, NONE_SHOWN)).toContain(`the top note is the ${colour}`);
      // The sentence is about the chord's own top note: its size above the root is that colour.
      const midis = t.params.midis as number[];
      const semis = (((Math.max(...midis) - (t.params.rootPc as number)) % 12) + 12) % 12;
      expect(({ "9th": 2, "13th": 9, "♯9": 3, "♯11": 6, "♭13": 8 } as Record<string, number>)[colour]).toBe(
        semis,
      );
    }
  });

  test("near: the learner's pick on the same root, else another chord of the set; never the stimulus", () => {
    const t = trialAt("fam.jzz.extension", 1, SEEDS[3] as number, "7-9-13");
    const asked = (t.expected as Answer).choice?.[0] as string;
    const other = ["7", "9", "13"].find((q) => q !== asked) as string;
    const near = wave7Near(t, def("fam.jzz.extension"), { choice: [other] });
    expect(near?.label.startsWith("Yours")).toBe(true);
    const notes = near?.plan.events.map((e) => e.value.note as number) ?? [];
    const root = t.params.rootPc as number;
    const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    // Every note is a tone of the picked chord on the trial's root (the bass is that root).
    const want = new Set<number>(chordPcs(chordOf(names[root] as string, other as never)));
    for (const n of notes) expect(want.has(n % 12)).toBe(true);
    expect(Math.min(...notes) % 12).toBe(root);
    expect(shape(near?.plan)).not.toEqual(shape(stimulus(t)));
    expect(wave7Alone(t)?.label).toBe("The top note, then the chord");
  });
});

describe("substitutions: V7 against its tritone substitute; the backdoor", () => {
  test("the tritone substitute shares the dominant's 3rd and 7th (the sentence the fact says)", () => {
    for (const root of ["G", "D", "Bb", "E"]) {
      const v = chordOf(root, "7");
      const sub = tritoneSub(v);
      const a = guideTones(v);
      const b = guideTones(sub);
      expect(new Set([a.third?.pc, a.seventh?.pc])).toEqual(new Set([b.third?.pc, b.seventh?.pc]));
    }
  });

  test("the facts say what each way in does, read from the trial's bass", () => {
    const t = trialAt("fam.jzz.subs", 1, SEEDS[0] as number, "tritone");
    const asked = (t.expected as Answer).choice?.[0];
    const slots = chordSlotsOf(t);
    const fall = ((((slots[1]?.bass ?? 0) - (slots[2]?.bass ?? 0)) % 12) + 12) % 12;
    const fact = stageGFact(t, ALL_SHOWN) as string;
    if (asked === "bII7-I") {
      expect(fall).toBe(1);
      expect(fact).toContain("the tritone substitute. The bass slides down a half step home.");
    } else expect(fact).toContain("the plain dominant");
    // The backdoor's ♭VII7 is a whole step below home.
    const back = trialAt("fam.jzz.subs", 2, SEEDS[1] as number, "backdoor");
    if ((back.expected as Answer).choice?.[0] === "backdoor") {
      const s = chordSlotsOf(back);
      expect(((((s[2]?.bass ?? 0) - (s[1]?.bass ?? 0)) % 12) + 12) % 12).toBe(2);
      expect(stageGFact(back, NONE_SHOWN)).toContain(
        "the backdoor. Home is reached from a whole step below.",
      );
    }
  });

  test("near: the cadence with the other way in; in eight bars, the bar with its V7 back", () => {
    const t = trialAt("fam.jzz.subs", 1, SEEDS[2] as number, "tritone");
    const near = wave7Near(t, def("fam.jzz.subs"), null);
    expect(near).not.toBeNull();
    expect(shape(near?.plan)).not.toEqual(shape(stimulus(t)));
    const std = trialAt("fam.jzz.subs", 3, SEEDS[2] as number, "in-standard");
    const bar = Number((std.expected as Answer).choice?.[0]);
    const n = wave7Near(std, def("fam.jzz.subs"), null);
    expect(n?.label).toBe(`Bar ${bar} with its V7 back`);
    expect(stageGFact(std, NONE_SHOWN)).toContain(`Bar ${bar}:`);
    expect(wave7Alone(std)?.label).toBe("The bass line alone");
  });
});

describe("voicings: the right voicing heard, and yours", () => {
  test("note names are parsed to the notes they spell", () => {
    expect(_test.noteMidi("C4")).toBe(60);
    expect(_test.noteMidi("F#3")).toBe(54);
    expect(_test.noteMidi("Bb2")).toBe(46);
    const t = trialAt("fam.jzz.voicing", 1, SEEDS[0] as number, "shell");
    const right = (t.expected as Answer).choice?.[0] as string;
    expect(wave7Alone(t)?.plan.events.length).toBe(right.split(" ").length);
    const wrong = (t.params.options as string[]).find((o) => o !== right) as string;
    expect(wave7Near(t, def("fam.jzz.voicing"), { choice: [wrong] })?.label).toBe("Yours");
    expect(wave7Near(t, def("fam.jzz.voicing"), { choice: [right] })).toBeNull();
  });
});

// --- stage H: clave -----------------------------------------------------------------------------------------------

describe("clave: son or rumba, 3-2 or 2-3", () => {
  test("the strokes read back as the clave asked (content-kit's CLAVE_GRIDS through @oak/theory)", () => {
    for (const [cat, type, dir] of [
      ["son-3-2", "son", "3-2"],
      ["son-2-3", "son", "2-3"],
      ["rumba-3-2", "rumba", "3-2"],
      ["rumba-2-3", "rumba", "2-3"],
    ] as const) {
      const t = trialAt("fam.rhy.clave", 3, SEEDS[0] as number, cat);
      const steps = claveStepsOf(t)?.steps ?? [];
      expect(claveOf(steps)).toEqual({ type, direction: dir });
      // The same onsets content-kit's fixture writes (bar A then bar B, eighths).
      const [a, b] = CLAVE_GRIDS[type][dir];
      const fixture = [...a.map(([n, d]) => (n * 8) / d), ...b.map(([n, d]) => 8 + (n * 8) / d)];
      expect(steps).toEqual(fixture);
      expect(optionLabel(cat, "rhythm-clave")).toBe(`${type === "son" ? "Son" : "Rumba"} clave, ${dir}`);
    }
  });

  test("the sentence counts each stroke in eighths and names the direction", () => {
    expect(eighthCount(0)).toBe("1");
    expect(eighthCount(3)).toBe("the & of 2");
    expect(eighthCount(7)).toBe("the & of 4");
    expect(eighthCount(12)).toBe("3");
    const son = trialAt("fam.rhy.clave", 2, SEEDS[1] as number, "son-3-2");
    expect(claveLine(son)).toBe(
      "Bar 1 has three strokes (1, the & of 2 and 4), bar 2 two strokes (2 and 3). Three first, so 3-2.",
    );
    const rumba = trialAt("fam.rhy.clave", 3, SEEDS[1] as number, "rumba-2-3");
    expect(claveLine(rumba)).toBe(
      "Bar 1 has two strokes (2 and 3), bar 2 three strokes (1, the & of 2 and the & of 4). Two first, so 2-3. The rumba's last stroke of the three waits for the & of 4, where the son's falls on 4.",
    );
    const tres = trialAt("fam.rhy.clave", 1, SEEDS[1] as number, "tresillo");
    expect(claveLine(tres)).toBe(
      "Tresillo: three hits in a bar of eight eighths, spaced 3 + 3 + 2. As a Euclidean rhythm it is (3,8).",
    );
    const cinq = trialAt("fam.rhy.clave", 1, SEEDS[1] as number, "cinquillo");
    expect(claveLine(cinq)).toBe(
      "Cinquillo: five hits in a bar of eight eighths, spaced 2 + 1 + 2 + 1 + 2. As a Euclidean rhythm it is (5,8).",
    );
  });

  test("near: the other way round (the learner's pick first); context: with the beat; the lanes name each side", () => {
    const t = trialAt("fam.rhy.clave", 2, SEEDS[2] as number, "son-3-2");
    const near = wave7Near(t, def("fam.rhy.clave"), null);
    expect(near?.label).toBe("Against Son clave, 2-3");
    const steps = (near?.plan.events ?? []).map((e) => Math.round(e.at * t.cps * 8));
    expect(claveOf(steps)).toEqual({ type: "son", direction: "2-3" });
    expect(wave7Near(t, def("fam.rhy.clave"), { choice: ["rumba-3-2"] })?.label).toBe(
      "Yours: Rumba clave, 3-2",
    );
    // A clave with its groove under it is heard alone; a bare one is heard with the beat under it.
    if (t.events.some((e) => e.track !== "perc")) {
      expect(wave7Alone(t)?.label).toBe("The clave alone");
      expect(wave7Context(t)).toBeNull();
    } else expect(wave7Context(t)?.label).toBe("With the beat under it");
    const lanes = rhythmLanesOf(t);
    expect(lanes?.barLabels).toEqual(["3-side", "2-side"]);
    expect(lanes?.lanes[0]?.hits.length).toBe(5);
    expect(promptOf(unprompted(t), def("fam.rhy.clave"))).toBe(
      "Which clave, and which way round: three first, or two first?",
    );
  });
});

// --- stage H: odd groupings -----------------------------------------------------------------------------------------

describe("odd groupings: where are the threes", () => {
  test("the options are groupings of the trial's meter, the right one once (never a category id)", () => {
    const d = def("fam.rhy.odd-grouping");
    for (const cat of ["7/8:2+2+3", "7/8:2+3+2", "7/8:3+2+2"]) {
      const t = trialAt(d.id, 2, SEEDS[0] as number, cat);
      const opts = choiceOptionsOf(t, d);
      expect(opts.sort()).toEqual(["2+2+3", "2+3+2", "3+2+2"]);
      const spec = surfaceOf(t, d);
      if (spec.kind !== "widget" || spec.spec.ui !== "choice") throw new Error("a choice");
      expect(spec.spec.options.map((o) => o.label).sort()).toEqual(["2 + 2 + 3", "2 + 3 + 2", "3 + 2 + 2"]);
      // The right answer is one of the buttons and grades as right.
      const right = (t.expected as Answer).choice?.[0] as string;
      expect(opts).toContain(right);
      const graded = gradeDrillTrial(
        registry.family(d.id),
        t,
        { answer: { choice: [right] }, rtMs: 900, replays: 0 },
        PROFILE,
      );
      expect(graded.correct).toBe(true);
    }
    // A 5/8 trial offers only 5/8's groupings, even with the generator's own options taken away.
    const five = trialAt(d.id, 1, SEEDS[1] as number, "5/8:3+2");
    expect(choiceOptionsOf(five, d).sort()).toEqual(["2+3", "3+2"]);
    const { options: _o, optionLabels: _l, ...bare } = five.params;
    expect(choiceOptionsOf({ ...five, params: bare } as Trial, d).sort()).toEqual(["2+3", "3+2"]);
  });

  test("the count, where the three is, the accents alone, and the bar grouped another way", () => {
    const t = trialAt("fam.rhy.odd-grouping", 2, SEEDS[2] as number, "7/8:2+2+3");
    expect(groupingLine(t)).toBe("7/8 as 2 + 2 + 3: counted 1 2 | 1 2 | 1 2 3. The three comes last.");
    expect(groupingLine(trialAt("fam.rhy.odd-grouping", 2, SEEDS[2] as number, "7/8:3+2+2"))).toBe(
      "7/8 as 3 + 2 + 2: counted 1 2 3 | 1 2 | 1 2. The three comes first.",
    );
    expect(promptOf(unprompted(t), def("fam.rhy.odd-grouping"))).toBe(
      "A bar of 7 eighths: how is it grouped? Listen for the three.",
    );
    expect(wave7Alone(t)?.label).toBe("The accents alone");
    const near = wave7Near(t, def("fam.rhy.odd-grouping"), null);
    expect(near?.label).toBe("Grouped 2 + 3 + 2");
    expect(shape(near?.plan)).not.toEqual(shape(stimulus(t)));
    const lanes = rhythmLanesOf(t);
    expect(lanes?.groups).toEqual([
      { start: 0, length: 2 },
      { start: 2, length: 2 },
      { start: 4, length: 3 },
    ]);
  });
});

// --- stage H: polyrhythm and the two-lane tap -------------------------------------------------------------------------

describe("polyrhythm: 3:2 against 4:3, and two hands on two pulses", () => {
  test("the sentence says how many against how many and where they meet (checked with @oak/theory)", () => {
    const t = trialAt("fam.rhy.polyrhythm", 2, SEEDS[0] as number, "4:3");
    expect(polyLine(t)).toBe(
      "4 against 3: four even high beats in the time of three low ones. They meet only on the one.",
    );
    const straight = trialAt("fam.rhy.polyrhythm", 1, SEEDS[0] as number, "straight");
    expect(polyLine(straight)).toBe(
      "4 against 2: four even high beats in the time of two low ones. They meet 2 times a bar.",
    );
    const near = wave7Near(t, def("fam.rhy.polyrhythm"), null);
    expect(near?.label).toBe("Against 3 high against 4 low");
    expect(wave7Near(t, def("fam.rhy.polyrhythm"), { choice: ["3:2"] })?.label).toBe(
      "Yours: 3 high against 2 low",
    );
    expect(rhythmLanesOf(t)?.lanes.map((l) => l.hits.length)).toEqual([4, 3]);
  });

  test("tap 3 against 2 is two lanes, as the generator writes them: F the 2 with the kick, J the 3", () => {
    const t = trialAt("fam.rhy.polyrhythm", 3, SEEDS[1] as number, "tap-3-over-2");
    const lanes = tapLanesOf(t);
    expect(lanes?.map((l) => l.key)).toEqual(["F", "J"]);
    expect(lanes?.[1]?.targets).toEqual(t.params.tapTargets as number[]);
    // Three bars of the 2 (bars 2–4), from the same response window.
    expect(lanes?.[0]?.targets.length).toBe(6);
    expect(Number(lanes?.[0]?.targets[0]).toFixed(6)).toBe(
      ((t.params.tapTargets as number[])[0] as number).toFixed(6),
    );
    // The same lanes, in the same order, as the engine grades.
    expect(lanes?.map((l) => [l.key, l.targets])).toEqual(
      tapLanesOfTrial(t as never)?.map((l) => [l.key, l.targets]) ?? [],
    );
    const s = surfaceOf(t, def("fam.rhy.polyrhythm"));
    expect(s).toEqual({ kind: "tap", twoVoices: true });
    // Without the generator's lanes there is no second hand to invent.
    const bare = { ...t, params: { ...t.params, tapLanes: undefined } } as Trial;
    expect(tapLanesOf(bare)).toBeNull();
  });

  test("both hands graded together: both must pass, wrong hands do not count, a leaning hand is not forgiven", () => {
    const t = trialAt("fam.rhy.polyrhythm", 3, SEEDS[2] as number, "tap-3-over-2");
    const lanes = tapLanesOf(t) as NonNullable<ReturnType<typeof tapLanesOf>>;
    const fam = registry.family(t.family);
    const take = (two: readonly number[], three: readonly number[]) => ({
      taps: [...two, ...three],
      tapVoices: [...two.map(() => 0 as const), ...three.map(() => 1 as const)],
      rtMs: 0,
      replays: 0,
    });
    const [two, three] = [lanes[0]?.targets ?? [], lanes[1]?.targets ?? []];
    const good = gradeDrillTrial(fam, t, take(two, three), PROFILE);
    expect(good.correct).toBe(true);
    expect(good.credit).toBeGreaterThan(0.9);
    // The right times on the wrong hands: neither lane matches its pulse.
    const crossed = gradeDrillTrial(fam, t, take(three, two), PROFILE);
    expect(crossed.correct).toBe(false);
    // Only the 3 tapped (the old one-lane take): the left hand is silent, so the take does not pass.
    const oneHand = gradeDrillTrial(fam, t, take([], three), PROFILE);
    expect(oneHand.correct).toBe(false);
    expect(oneHand.diagnostics.map((d) => d.id)).toContain("tap.lane-silent");
    // The 3 rushing 60 ms against a steady 2: every tap is near a target, but the hands disagree, and that is
    // named rather than forgiven (each lane graded alone would read two steady lanes).
    const rushing = gradeDrillTrial(
      fam,
      t,
      take(
        two,
        three.map((x) => (two.some((y) => Math.abs(y - x) < 1e-6) ? x : x - 0.06)),
      ),
      PROFILE,
    );
    expect(rushing.diagnostics.map((d) => d.id)).toContain("tap.lane-rushing");
    expect(lanesReport(lanes, take(two, three).taps, take(two, three).tapVoices)).toBe(
      "F: 6 of 6 matched · J: 9 of 9 matched",
    );
    expect(laneTaps([0.1, 0.2, 0.3], [0, 1, 0], 0)).toEqual([0.1, 0.3]);
  });
});

// --- stage H: swing ratio --------------------------------------------------------------------------------------------

describe("swing ratio: straight, light, hard; eighths against sixteenths", () => {
  test("the ratio is measured from the hats and named against content-kit's SWING_FEELS", () => {
    const hard = trialAt("fam.rhy.swing", 2, SEEDS[0] as number, "hard");
    expect(swingOf(hard)?.ratio).toBeCloseTo(3, 6);
    expect(swingLine(hard)).toBe(
      "Hard swing on the eighths: the long note is much longer than the short one, about 3:1.",
    );
    const swung = trialAt("fam.rhy.swing", 1, SEEDS[0] as number, "swung");
    expect(swingOf(swung)?.ratio).toBeCloseTo(2, 6);
    expect(swingLine(swung)).toBe(
      "Swung (the triplet feel) on the eighths: the long note is twice as long as the short one, about 2:1.",
    );
    const straight = trialAt("fam.rhy.swing", 1, SEEDS[0] as number, "straight");
    expect(swingLine(straight)).toBe("Straight eighths: each pair splits its beat evenly (1:1).");
    // The fixture's own feels: 3:2 is light, 2:1 triplet, 3:1 hard.
    expect(SWING_FEELS.map((f) => f.ratio)).toEqual([1, 1.5, 2, 3]);
    expect(_test.ratioWords(1.4)).toBe("7:5");
  });

  test("near: the next feel at level 2; sixteenth swing against the same swing on the eighths", () => {
    const hard = trialAt("fam.rhy.swing", 2, SEEDS[1] as number, "hard");
    expect(wave7Near(hard, def("fam.rhy.swing"), null)?.label).toBe("Against triplet swing");
    const six = drawWhere("fam.rhy.swing", 4, "swung", (x) => swingOf(x)?.per === 8);
    expect(swingOf(six)?.ratio).toBeCloseTo(2, 6);
    expect(swingLine(six)).toContain("on the sixteenths");
    const near = wave7Near(six, def("fam.rhy.swing"), null);
    expect(near?.label).toBe("The same swing on the eighths");
    expect(shape(near?.plan)).not.toEqual(shape(stimulus(six)));
    // Level 1 keeps Wave 5's "the other feel" and has no near miss of its own.
    expect(
      wave7Near(trialAt("fam.rhy.swing", 1, SEEDS[1] as number, "swung"), def("fam.rhy.swing"), null),
    ).toBeNull();
  });
});

// --- sound ---------------------------------------------------------------------------------------------------------

describe("sound: which control changed; brighter or darker; who plays what", () => {
  test("the change is said in the code's own names, with brighter or darker for the filter", () => {
    const t = trialAt("fam.snd.params", 1, SEEDS[0] as number, "cutoff");
    const bars = t.params.controlsByBar as { cutoff: number }[];
    const opened = (bars[1]?.cutoff as number) > (bars[0]?.cutoff as number);
    expect(soundChangeLine(t)).toBe(
      `In bar 2, lpf went from ${bars[0]?.cutoff} Hz to ${bars[1]?.cutoff} Hz. The filter ${
        opened ? "opened, so bar 2 is brighter" : "closed, so bar 2 is darker"
      }.`,
    );
    expect((t.expected as Answer).choice?.[0]).toBe(opened ? "brighter" : "darker");
    const near = wave7Near(t, def("fam.snd.params"), null);
    expect(near?.label).toBe("The change the other way");
    // The change the other way: bar 1 now carries bar 2's cutoff.
    const firstBar = near?.plan.events.filter((e) => e.at < 1 / t.cps - 1e-6) ?? [];
    expect(firstBar.every((e) => e.value.cutoff === bars[1]?.cutoff)).toBe(true);
    expect(wave7Alone(t)?.label).toBe("Bar 1, then bar 2, alone");
  });

  test("roles: which part dropped out; masking: which part sits in the bass's range, or neither", () => {
    const roles = trialAt("fam.snd.roles", 1, SEEDS[0] as number, "roles");
    const dropped = (roles.expected as Answer).choice?.[0] as string;
    expect(stageGFact(roles, NONE_SHOWN)).toMatch(/drops out in bars 3 and 4; the other two keep playing\.$/);
    expect(wave7Alone(roles)?.label).toMatch(/^The (bass|pad|lead) alone$/);
    const wrong = ["bass", "pad", "lead"].find((r) => r !== dropped) as string;
    expect(wave7Near(roles, def("fam.snd.roles"), { choice: [wrong] })?.label).toBe(
      `Yours: without the ${wrong}, then without the ${dropped}`,
    );
    // No wrong pick: another part dropped from the same bars, then the one that did drop out.
    expect(wave7Near(roles, def("fam.snd.roles"), { choice: [dropped] })?.label).toMatch(
      new RegExp(`^Without the (bass|pad|lead), then without the ${dropped}$`),
    );
    for (const muddy of ["pad", "lead", "none"]) {
      const mud = drawWhere(
        "fam.snd.roles",
        2,
        "masking",
        (x) => (x.expected as Answer).choice?.[0] === muddy,
      );
      const bass = mud.events.filter((e) => e.track === "bass").map((e) => e.midi as number);
      const fact = stageGFact(mud, NONE_SHOWN) as string;
      const near = wave7Near(mud, def("fam.snd.roles"), null);
      if (muddy === "none") {
        expect(fact).toMatch(
          /^Neither: the chords stay at .+ and above, the tune at .+ and above, clear of the bass/,
        );
        expect(near?.label).toBe("With the chords down in the bass's range");
        continue;
      }
      expect(fact).toMatch(/inside the bass's range \(.+ to .+\)\.$/);
      expect(near?.label).toBe("With that part lifted out of the bass");
      const track = muddy === "lead" ? "mel" : "pad";
      const sound = mud.events.find((x) => x.track === track)?.s;
      const low = Math.min(...mud.events.filter((e) => e.track === track).map((e) => e.midi as number));
      // The sentence is true of the notes: the part reaches into the bass's range.
      expect(low).toBeLessThanOrEqual(Math.max(...bass));
      const lifted = Math.min(
        ...(near?.plan.events ?? []).filter((e) => e.value.s === sound).map((e) => e.value.note as number),
      );
      expect(lifted).toBeGreaterThan(Math.max(...bass));
    }
  });
});

// --- every Wave 7 family is heard after its answer -----------------------------------------------------------------

describe("after every answer: alone, in context, against its near miss", () => {
  const CASES: [string, number, string][] = [
    ["fam.jzz.ii-v", 1, "ii-V-I"],
    ["fam.jzz.ii-v", 2, "minor-ii-V"],
    ["fam.jzz.guide", 1, "v7-i-voice"],
    ["fam.jzz.guide", 2, "sing-3-7"],
    ["fam.jzz.extension", 2, "9-b9-s9"],
    ["fam.jzz.subs", 1, "tritone"],
    ["fam.rhy.clave", 2, "son-2-3"],
    ["fam.rhy.odd-grouping", 1, "5/8:2+3"],
    ["fam.rhy.polyrhythm", 1, "3:2"],
    ["fam.snd.params", 3, "attack-release"],
    ["fam.snd.roles", 1, "roles"],
  ];
  test("each plays something by itself, and the listen seam the lessons use offers alone and context", () => {
    for (const [id, level, cat] of CASES) {
      const t = trialAt(id, level, SEEDS[4] as number, cat);
      expect(isWave7Listen(t), id).toBe(true);
      const alone = alonePlan(t);
      expect(alone?.events.length ?? 0, `${id} alone`).toBeGreaterThan(0);
      expect(aloneLabel(t)).not.toBe("Alone");
      const ear = earAfterAnswer(t, PROFILE);
      expect(ear.alone, id).not.toBeNull();
      expect(ear.context, id).not.toBeNull();
      const near = auditionPlan(t, "near", { taps: null, answer: null }, PROFILE, null, def(id));
      expect(near?.events.length ?? 0, `${id} near`).toBeGreaterThan(0);
      expect(stageGFact(t, ALL_SHOWN), `${id} fact`).not.toBeNull();
    }
  });

  test("no sentence or label below the answer names an id or an internal control", () => {
    for (const [id, level, cat] of CASES) {
      const t = trialAt(id, level, SEEDS[5] as number, cat);
      for (const text of [
        stageGFact(t, NONE_SHOWN),
        wave7Alone(t)?.label,
        wave7Near(t, def(id), null)?.label,
      ]) {
        if (!text) continue;
        expect(text, id).not.toMatch(/cutoff|resonance\b|fam\.|-ii-V|\d\/\d+:|undefined|NaN/);
      }
    }
  });

  test("prompts: the generator's own question wins; the runner asks where it has none", () => {
    const own = trialAt("fam.rhy.polyrhythm", 1, SEEDS[0] as number, "3:2");
    expect(stageGPrompt(own, def("fam.rhy.polyrhythm"))).toBeNull();
    expect(promptOf(own, def("fam.rhy.polyrhythm"))).toBe(own.params.prompt as string);
    const locate = unprompted(trialAt("fam.jzz.ii-v", 3, SEEDS[0] as number, "locate"));
    expect(promptOf(locate, def("fam.jzz.ii-v"))).toMatch(
      /^Mark (every bar|the bar) where a ii–V–I begins\.$/,
    );
  });
});

// --- the machine: two hands, and a sung trial in Quiet mode -----------------------------------------------------------

function sessionOf(familyId: string, trials: number, level: number): DrillSession {
  return {
    id: `drl_${familyId}`,
    sessionId: null,
    purpose: "practice",
    familyIds: [familyId as DrillSession["familyIds"][number]],
    setId: `w7_${familyId}`,
    levels: { [familyId]: level },
    openCategories: { [familyId]: def(familyId).levels[level - 1]?.categories ?? [] },
    focus: {},
    trialsPlanned: trials,
    startedAt: "2026-11-15T10:00:00.000Z",
    finishedAt: null,
  };
}
function runMachine(trials: Trial[], deps: DrillDeps, opts: { quiet?: boolean; presented?: unknown[] } = {}) {
  const s = sessionOf(trials[0]?.family as string, trials.length, trials[0]?.level ?? 1);
  const machine = drillMachine.provide({
    actors: {
      start: fromPromise(async () => ({
        session: s,
        source: {
          total: trials.length,
          at: (i: number) => ({
            spec: {
              index: i,
              family: trials[i]?.family as never,
              level: trials[i]?.level ?? 1,
              category: "",
              seed: 0,
            },
            trial: trials[i] as Trial,
          }),
        },
      })),
      present: fromCallback(({ input }) => {
        opts.presented?.push(input);
        return () => {};
      }),
      audition: fromCallback(({ sendBack }) => {
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
  return actor;
}
const deps = (sungOf: DrillDeps["sungOf"] = () => []): DrillDeps => ({
  grade: (trial, response) => gradeDrillTrial(registry.family(trial.family), trial, response, PROFILE),
  gradeResolution: () => ({ credit: 0, passed: false, sung: [] }),
  sungOf,
  now: () => 1000,
  iso: () => "2026-11-15T10:00:00.000Z",
});

describe("a two-lane take heard back: both pulses through, and your two hands on their own sounds", () => {
  test("the answer plays the 3 on, after the first bar stops it; compare plays each hand on its lane's sound", () => {
    const t = trialAt("fam.rhy.polyrhythm", 3, SEEDS[5] as number, "tap-3-over-2");
    const lanes = tapLanesOf(t) as NonNullable<ReturnType<typeof tapLanesOf>>;
    const high = t.events.find((e) => e.track === "high")?.s;
    const low = t.events.find((e) => e.track === "low")?.s;
    const answer = lanesAnswerPlan(t);
    // Every J target sounds on the high pulse's sound, every F target on the low one's.
    for (const at of lanes[1]?.targets ?? [])
      expect(answer?.events.some((e) => Math.abs(e.at - at) < 1e-6 && e.value.s === high)).toBe(true);
    for (const at of lanes[0]?.targets ?? [])
      expect(answer?.events.some((e) => Math.abs(e.at - at) < 1e-6 && e.value.s === low)).toBe(true);
    const taps = [lanes[0]?.targets[0] as number, lanes[1]?.targets[0] as number];
    const cmp = lanesComparePlan(t, taps, [0, 1]);
    expect(cmp?.events.slice(0, 2).map((e) => e.value.s)).toEqual([low, high]);
    expect(lanesComparePlan(t, [], [])).toBeNull();
    expect(auditionPlan(t, "answer", { taps: null, answer: null }, PROFILE)?.events.length).toBe(
      answer?.events.length,
    );
  });

  test("a steady lean is named per hand, as the one-lane pad names it", () => {
    const t = trialAt("fam.rhy.polyrhythm", 3, SEEDS[5] as number, "tap-3-over-2");
    const lanes = tapLanesOf(t) as NonNullable<ReturnType<typeof tapLanesOf>>;
    const f = (lanes[0]?.targets ?? []).map((x) => x - 0.03);
    const j = lanes[1]?.targets ?? [];
    expect(lanesReport(lanes, [...f, ...j], [...f.map(() => 0 as const), ...j.map(() => 1 as const)])).toBe(
      "F: 6 of 6 matched, about 30 ms early · J: 9 of 9 matched",
    );
  });
});

describe("the machine: a two-lane take, hand by hand", () => {
  test("CAPTURED carries each tap's hand; the grade reads both lanes; the taps are recorded", async () => {
    const t = trialAt("fam.rhy.polyrhythm", 3, SEEDS[3] as number, "tap-3-over-2");
    const lanes = tapLanesOf(t) as NonNullable<ReturnType<typeof tapLanesOf>>;
    const actor = runMachine([t], deps());
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    const taps = [...(lanes[0]?.targets ?? []), ...(lanes[1]?.targets ?? [])];
    const voices = [
      ...(lanes[0]?.targets ?? []).map(() => 0 as const),
      ...(lanes[1]?.targets ?? []).map(() => 1 as const),
    ];
    actor.send({ type: "CAPTURED", taps, voices });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    const ctx = actor.getSnapshot().context;
    expect(ctx.captured.voices).toEqual(voices);
    expect(ctx.records[0]?.correct).toBe(true);
    expect(ctx.records[0]?.response.taps?.length).toBe(taps.length);
    expect(ctx.records[0]?.modality).toBe("normal");
  });

  test("the right number of taps with one hand only does not pass", async () => {
    const t = trialAt("fam.rhy.polyrhythm", 3, SEEDS[3] as number, "tap-3-over-2");
    const lanes = tapLanesOf(t) as NonNullable<ReturnType<typeof tapLanesOf>>;
    const actor = runMachine([t], deps());
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    const taps = [...(lanes[0]?.targets ?? []), ...(lanes[1]?.targets ?? [])].sort((a, b) => a - b);
    actor.send({ type: "CAPTURED", taps, voices: taps.map(() => 1 as const) });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    expect(actor.getSnapshot().context.records[0]?.correct).toBe(false);
  });
});

describe("the machine: a sung guide-tone line in Quiet mode", () => {
  const guide = () => trialAt("fam.jzz.guide", 2, SEEDS[4] as number, "sing-3-7");

  test("heard in the head: Space moves on, nothing is graded or sung, the record says quiet", async () => {
    let graded = 0;
    const d = deps(() => {
      graded++;
      return [];
    });
    const presented: unknown[] = [];
    const actor = runMachine([guide()], d, { quiet: true, presented });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    // The present actor is told it is Quiet mode (it plays the chords and never opens the mic).
    expect((presented[0] as { quiet: boolean }).quiet).toBe(true);
    actor.send({ type: "PRESENTED" });
    await waitFor(actor, (st) => st.matches({ trial: "answering" }));
    actor.send({ type: "HEARD" });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    const rec = actor.getSnapshot().context.records[0];
    expect(graded).toBe(0);
    expect(rec?.modality).toBe("quiet");
    expect(rec?.response.skipped).toBe(true);
    expect(rec?.response.sung).toBeNull();
    expect(rec?.credit).toBe(0);
  });

  test("HEARD does nothing outside Quiet mode; with the mic, the take is graded from its frames", async () => {
    let graded = 0;
    const actor = runMachine(
      [guide()],
      deps(() => {
        graded++;
        return [{ midi: 65, cents: 0, credit: 1 }];
      }),
    );
    await waitFor(actor, (st) => st.matches({ trial: "ready" }));
    actor.send({ type: "START" });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "HEARD" });
    expect(actor.getSnapshot().matches({ trial: "presenting" })).toBe(true);
    actor.send({ type: "CAPTURED", frames: [] });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    expect(graded).toBe(1);
    expect(actor.getSnapshot().context.records[0]?.modality).toBe("normal");
  });

  test("Quiet mode switched on while the line is sung closes the mic at once and offers the head", async () => {
    const actor = runMachine([guide()], deps());
    await waitFor(actor, (st) => st.matches({ trial: "ready" }));
    actor.send({ type: "START" });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "QUIET", quiet: true });
    await waitFor(actor, (st) => st.matches({ trial: "answering" }));
    expect(actor.getSnapshot().context.input.quiet).toBe(true);
    actor.send({ type: "HEARD" });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    expect(actor.getSnapshot().context.records[0]?.modality).toBe("quiet");
  });

  test("a choice trial ignores HEARD in Quiet mode (it is answered as usual)", async () => {
    const t = trialAt("fam.jzz.guide", 1, SEEDS[4] as number, "v7-i-voice");
    const actor = runMachine([t], deps(), { quiet: true });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "HEARD" });
    expect(actor.getSnapshot().matches({ trial: "answering" })).toBe(true);
    actor.send({ type: "SUBMIT", answer: { choice: [(t.expected as Answer).choice?.[0] as string] } });
    await waitFor(actor, (st) => st.matches({ feedback: "idle" }));
    expect(actor.getSnapshot().context.records[0]?.correct).toBe(true);
  });
});
