// Ladder L8 / CF-T in Transcribe: the stage order and marks (pinned to the grader's), sections worked one at a
// time, what is given (never the form), the draft skeleton written from a passed map, one section's chart in that
// code, splitting a repeat that ends differently, and the verdicts. Through the real grader, headless: the skeleton
// runs, its bass fails section 1 naming bars and passes once written, and a section that comes back passes from the
// same const.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { GradeResult, SongDef } from "@oak/content-kit";
import {
  gradeStandardLadder,
  lintOak,
  lintStrict,
  STANDARD_LADDER_PASS,
  STANDARD_LADDER_STAGES,
  sectionsFromAst,
} from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import toolbox from "../../../content/toolbox.ts";
import { emptyFormMap, type FormMap, setLabel, toggleCut } from "./form-map.ts";
import { checkLines, keyMismatchText } from "./ladder.ts";
import type { SongGiven } from "./song.ts";
import {
  changesOfSection,
  currentStandardStage,
  EMPTY_STANDARD_MARKS,
  formMapOfPhrases,
  hasSkeleton,
  isBareDraft,
  isStandardLevel,
  markSection,
  mergeStandardStages,
  passMarkText,
  STANDARD_PASS,
  STANDARD_STAGES,
  sectionConst,
  sectionSuffix,
  skeletonOfForm,
  songProgress,
  splitSection,
  standardGivenChips,
  standardGraded,
  standardStageStates,
  standardStarter,
  standardTargetText,
  standardVerdict,
  withSectionChanges,
  workSections,
} from "./standard.ts";

setDefaultTimeout(90_000);

const map = (bars: number, cuts: number[], labels: string[]): FormMap =>
  labels.reduce(
    (m, l, i) => setLabel(m, i, l),
    cuts.reduce((m, b) => toggleCut(m, b), emptyFormMap(bars)),
  );
const AABA = map(32, [9, 17, 25], ["A", "A", "B", "A"]);

const G: SongGiven = {
  songId: "song.test-standard",
  title: "Test Standard",
  year: 1925,
  bpm: 120,
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  pickupBeats: null,
  bars: 32,
  phrases: [
    [1, 8],
    [9, 16],
    [17, 24],
    [25, 32],
  ],
  swing: true,
  form: null,
};

const result = (over: Partial<GradeResult>): GradeResult =>
  ({
    exerciseId: "ladder",
    exerciseVersion: 1,
    attemptNo: 1,
    firstAttempt: true,
    mode: "capstone",
    status: "fail",
    score: 0,
    adjustedScore: 0,
    dims: {},
    constraints: [],
    diagnostics: [],
    messages: [],
    assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
    ...over,
  }) as GradeResult;

describe("stages", () => {
  test("the order and the marks are the grader's", () => {
    expect([...STANDARD_STAGES]).toEqual([...STANDARD_LADDER_STAGES]);
    expect({ ...STANDARD_PASS }).toEqual({ ...STANDARD_LADDER_PASS });
    expect(isStandardLevel(8)).toBe(true);
    expect(isStandardLevel(6)).toBe(false);
    expect(passMarkText("form")).toBe("every section right");
    expect(passMarkText("bass")).toBe("≥ 90%");
  });
  test("each stage opens after the one before passed or was shown", () => {
    expect(standardStageStates({}).map((s) => s.status)).toEqual(["open", "locked", "locked", "locked"]);
    expect(standardStageStates({ form: "passed", bass: "revealed" }).map((s) => s.status)).toEqual([
      "passed",
      "revealed",
      "open",
      "locked",
    ]);
    expect(
      currentStandardStage({ form: "passed", bass: "passed", changes: "passed", melody: "passed" }),
    ).toBeNull();
  });
  test("the server's passed stages win over nothing local; L6's stage names are read, unknown ones ignored", () => {
    expect(mergeStandardStages(["form", "bass"], {})).toEqual({ form: "passed", bass: "passed" });
    expect(mergeStandardStages(["quality"], { form: "revealed" })).toEqual({ form: "revealed" });
  });
  test("a code stage is done when every section passed or was shown; a shown one marks the stage shown", () => {
    let m = markSection(EMPTY_STANDARD_MARKS, "bass", 1, "passed", 4);
    expect(m.stages.bass).toBeUndefined();
    for (const n of [2, 3, 4]) m = markSection(m, "bass", n, "passed", 4);
    expect(m.stages.bass).toBe("passed");
    expect(m.sections.bass.passed).toEqual([1, 2, 3, 4]);
    let c = m;
    for (const n of [1, 2, 3]) c = markSection(c, "changes", n, "passed", 4);
    c = markSection(c, "changes", 4, "revealed", 4);
    expect(c.stages.changes).toBe("revealed");
    expect(standardGraded({ ...c.stages, form: "passed", melody: "passed" })).toBe(false);
    expect(standardGraded({ form: "passed", bass: "passed", changes: "passed", melody: "passed" })).toBe(
      true,
    );
    // A section first shown, then passed on a later try, counts as passed.
    const again = markSection(
      markSection(EMPTY_STANDARD_MARKS, "bass", 1, "revealed", 1),
      "bass",
      1,
      "passed",
      1,
    );
    expect(again.sections.bass).toEqual({ passed: [1], revealed: [] });
  });
  test("the sections worked: the learner's own map; else the song's phrases; else eight-bar blocks", () => {
    expect(workSections(AABA, null, 32).map((s) => [s.label, s.from, s.to])).toEqual([
      ["A", 1, 8],
      ["A", 9, 16],
      ["B", 17, 24],
      ["A", 25, 32],
    ]);
    expect(workSections(null, G.phrases, 32).map((s) => [s.label, s.from, s.to])[2]).toEqual(["", 17, 24]);
    expect(workSections(null, null, 20).map((s) => [s.from, s.to])).toEqual([
      [1, 8],
      [9, 16],
      [17, 20],
    ]);
  });
});

describe("a form that was shown, or passed elsewhere", () => {
  test("the server's phrases are the sections; the form as letters names them when it fits", () => {
    expect(formMapOfPhrases(G.phrases, 32, "AABA")).toEqual({
      bars: 32,
      cuts: [1, 9, 17, 25],
      labels: ["A", "A", "B", "A"],
    });
    // Words, or letters that do not fit the phrases, name nothing: the sections are numbered.
    expect(formMapOfPhrases(G.phrases, 32, "32-bar song form")?.labels).toEqual(["", "", "", ""]);
    expect(formMapOfPhrases(G.phrases, 32, "ABA")?.labels).toEqual(["", "", "", ""]);
    expect(formMapOfPhrases(null, 32, "AABA")).toBeNull();
    // Unnamed sections get numbered consts in the skeleton.
    const m = formMapOfPhrases(G.phrases, 32, null);
    expect(m && skeletonOfForm(G, m)).toContain(
      "bass: arrange([8, bassS1], [8, bassS2], [8, bassS3], [8, bassS4])",
    );
  });
});

describe("the pool", () => {
  test("a song's progress: phrases at L5, three stages at L6, four at L8 with the one that is next", () => {
    const song = (level: number, passedStages: string[], passedPhrases: number[] = []) => ({
      level,
      passedStages,
      passedPhrases,
      phrases: [1, 2, 3, 4],
    });
    expect(songProgress(song(5, [], [1, 2]))).toBe("2 of 4 phrases");
    expect(songProgress(song(6, ["bass"]))).toBe("1 of 3 stages");
    expect(songProgress(song(8, []))).toBe("0 of 4 stages");
    expect(songProgress(song(8, ["form", "bass"]))).toBe("2 of 4 stages · next: the changes");
    expect(songProgress(song(8, ["form", "bass", "changes", "melody"]))).toBe("4 of 4 stages");
  });
});

describe("what is given", () => {
  test("tempo, meter, key and home, pickup, feel and length; never the form", () => {
    const chips = standardGivenChips({ ...G, form: "AABA" });
    expect(chips).toEqual([
      "120 BPM",
      "4/4",
      "C major, home is C",
      "No pickup",
      "Swing 8ths",
      "One chorus, 32 bars",
    ]);
    expect(chips.join(" ")).not.toContain("AABA");
    expect(standardStarter(G)).toContain("First the form");
    expect(standardStarter({ ...G, form: "AABA" })).not.toContain("AABA");
  });
});

describe("the draft skeleton", () => {
  test("names follow STYLE §10: a letter keeps its capital, a word is capitalised", () => {
    expect(sectionSuffix("A", 0)).toBe("A");
    expect(sectionSuffix("a2", 1)).toBe("A2");
    expect(sectionSuffix("bridge", 2)).toBe("Bridge");
    expect(sectionSuffix("chorus2", 2)).toBe("Chorus2");
    expect(sectionSuffix("?!", 2)).toBe("S3");
    expect(sectionConst("changes", "B", 2)).toBe("chordsB");
    expect(sectionConst("melody", "A", 0)).toBe("melA");
  });

  test("one const per distinct section and track, one arrange() per track, the sections in order", async () => {
    const code = skeletonOfForm(G, AABA);
    expect(code).toContain("// Form: A (bars 1–8) · A (9–16) · B (17–24) · A (25–32)");
    expect(code.match(/^const bass[AB] = /gm)).toHaveLength(2);
    expect(code).toContain("bass: arrange([8, bassA], [8, bassA], [8, bassB], [8, bassA])");
    expect(code).toContain("chords: arrange([8, chordsA], [8, chordsA], [8, chordsB], [8, chordsA])");
    expect(code).toContain("mel: arrange([8, melA], [8, melA], [8, melB], [8, melA])");
    expect(hasSkeleton(code, AABA)).toBe(true);
    expect(hasSkeleton(standardStarter(G), AABA)).toBe(false);
    // The starter is a bare draft whatever its header says (the year arrives with the song list); the skeleton
    // and anything the learner wrote are not.
    expect(isBareDraft(standardStarter(G))).toBe(true);
    expect(isBareDraft(standardStarter({ ...G, year: null, swing: false }))).toBe(true);
    expect(isBareDraft(code)).toBe(false);
    expect(isBareDraft(`${standardStarter(G)}\nbass: n("0")`)).toBe(false);
    // It runs as written, is safe under the strict lint, and reads back as four sections of eight bars.
    const r = await evalHeadless(code, 32);
    expect(new Set(r.events.map((e) => e.track))).toEqual(new Set(["bass"]));
    expect(r.events.filter((e) => e.track === "bass")).toHaveLength(32);
    expect(lintStrict(code).filter((d) => d.severity === "error")).toEqual([]);
    // Oak's own lines raise nothing in the learner's editor: the labels are STYLE's (bass, chords, mel).
    const all = new Set(toolbox.map((t) => t.id));
    const lint = lintOak(
      code,
      { profile: "studio", unlocked: all as never, allowPreview: false, meter: "4/4", key: G.key },
      toolbox as never,
    );
    expect(lint.diagnostics.map((d) => d.message)).toEqual([]);
    const form = sectionsFromAst(code);
    expect(form?.sections.map((s) => s.bars)).toEqual([8, 8, 8, 8]);
  });

  test("named sections and unequal lengths", () => {
    const m = map(24, [9, 17], ["verse", "chorus", "verse"]);
    const code = skeletonOfForm({ ...G, bars: 24 }, m);
    expect(code).toContain("bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse])");
    const odd = skeletonOfForm({ ...G, bars: 20 }, map(20, [13], ["A", "B"]));
    expect(odd).toContain("mel: arrange([12, melA], [8, melB])");
  });

  test("a pickup bar is its own one-bar section before bar 1", async () => {
    const code = skeletonOfForm({ ...G, pickupBeats: 1 }, AABA);
    expect(code).toContain('const melPickup = n("[~ ~ ~ 0]")');
    expect(code).toContain("bass: arrange([1, silence], [8, bassA]");
    expect(code).toContain("mel: arrange([1, melPickup], [8, melA]");
    const r = await evalHeadless(code, 33);
    // The bass rests through the pickup bar and starts on bar 1 (cycle 1).
    expect(Math.min(...r.events.filter((e) => e.track === "bass").map((e) => e.onset))).toBe(1);
  });
});

describe("one section's chart in the code", () => {
  const code = skeletonOfForm(G, AABA);
  test("the skeleton's empty line is an empty chart; a filled one reads back; two chords share a bar", () => {
    expect(changesOfSection(code, "chordsA", 8)).toEqual(Array(8).fill(""));
    const chart = ["C", "E7", "A7", "A7", "D7", "G7", "C", "Dm7 G7"];
    const written = withSectionChanges(code, "chordsA", chart);
    expect(written).toContain('const chordsA = chord("<C E7 A7 A7 D7 G7 C [Dm7 G7]>").voicing()');
    expect(changesOfSection(written, "chordsA", 8)).toEqual(chart);
    // Only that const changed.
    expect(changesOfSection(written, "chordsB", 8)).toEqual(Array(8).fill(""));
    expect(written.match(/^chords: arrange/gm)).toHaveLength(1);
  });
  test("a line written another way is the learner's own: the chart does not read it", () => {
    const own = code.replace(/^const chordsA = .*$/m, 'const chordsA = n("[0,2,4]").scale("C3:major")');
    expect(changesOfSection(own, "chordsA", 8)).toBeNull();
    expect(changesOfSection(code, "chordsZ", 8)).toBeNull();
  });
  test("clearing a chart goes back to rests", () => {
    const written = withSectionChanges(code, "chordsA", ["C", "", "", "", "", "", "", ""]);
    expect(withSectionChanges(written, "chordsA", Array(8).fill(""))).toContain(
      'const chordsA = note("<~ ~ ~ ~ ~ ~ ~ ~>")',
    );
  });
});

describe("a repeat that ends differently", () => {
  test("the section gets its own copy of every track and its own name; the others keep theirs", async () => {
    const code = withSectionChanges(skeletonOfForm(G, AABA), "chordsA", [
      "C",
      "E7",
      "A7",
      "A7",
      "D7",
      "G7",
      "C",
      "G7",
    ]);
    const out = splitSection(code, AABA, 3);
    expect(out.map.labels).toEqual(["A", "A", "B", "A2"]);
    expect(out.code).toContain("bass: arrange([8, bassA], [8, bassA], [8, bassB], [8, bassA2])");
    expect(out.code).toContain("mel: arrange([8, melA], [8, melA], [8, melB], [8, melA2])");
    expect(out.code).toContain('const chordsA2 = chord("<C E7 A7 A7 D7 G7 C G7>")');
    const r = await evalHeadless(out.code, 32);
    expect(r.events.filter((e) => e.track === "chords" && e.onset >= 24).length).toBeGreaterThan(0);
    // Splitting the second A next takes the next free digit.
    expect(splitSection(out.code, out.map, 1).map.labels).toEqual(["A", "A3", "B", "A2"]);
    // A section that is the only one of its name stays as it is.
    expect(splitSection(code, AABA, 2)).toEqual({ code, map: AABA });
  });
});

describe("verdicts", () => {
  test("what was checked, the score against its mark, where it differs", () => {
    expect(standardTargetText({ stage: "form", section: null, label: null })).toBe("The form");
    expect(standardTargetText({ stage: "bass", section: 2, label: "A" })).toBe("Bass, section 2 (A)");
    const pass = standardVerdict(
      { passed: true, result: result({ status: "pass", score: 0.94 }) },
      { stage: "melody", section: 3, label: "B" },
    );
    expect(pass).toBe("Melody, section 3 (B): that's it (94%).");
    const fail = standardVerdict(
      {
        passed: false,
        result: result({
          score: 0.75,
          messages: [
            {
              id: "harmony.rn-quality",
              text: "Bar 19: A minor where the song has a dominant chord.",
              where: { bar: 19 },
            },
            { id: "harmony.rn-degree", text: "Bar 22: IV, the song has V7.", where: { bar: 22 } },
          ],
        }),
      },
      { stage: "changes", section: 3, label: "B" },
    );
    expect(fail).toBe(
      "Changes, section 3 (B): not yet, 75% right; 85% passes. Bars 19 and 22 differ. Loop the section and listen again.",
    );
  });
  test("d12: an answer in another key says both keys before anything else", () => {
    const r = result({
      score: 0,
      messages: [{ id: "melody.wrong-key", text: "Right tune, but in D major, not C major." }],
    });
    expect(keyMismatchText(r)).toBe("Right tune, but in D major, not C major.");
    expect(standardVerdict({ passed: false, result: r }, { stage: "melody", section: 1, label: "A" })).toBe(
      "Melody, section 1 (A): not yet. Right tune, but in D major, not C major. Write it in the recording's key.",
    );
    expect(keyMismatchText(result({ messages: [{ id: "melody.wrong-degree", text: "x" }] }))).toBeNull();
    // The chords' form of it, and a numbered copy of the id.
    expect(
      keyMismatchText(
        result({
          messages: [{ id: "harmony.key-mismatch.n1", text: "Your chords are in F; the recording is in C." }],
        }),
      ),
    ).toBe("Your chords are in F; the recording is in C.");
  });
});

// --- through the real grader -------------------------------------------------------------------------------

const A_BASS = [0, 2, 5, 1, 4, 0, 3, 4];
const B_BASS = [3, 3, 0, 0, 1, 1, 4, 4];
const A_MEL = "[4 ~ 2 ~] [4 ~ 2 0] [5 ~ ~ 4] [3 2 1 ~] [1 ~ 3 ~] [2 ~ 0 ~] [3 2 1 0] [1 ~ ~ ~]";
const B_MEL = "[5 5 3 ~] [5 5 3 ~] [4 4 2 ~] [4 ~ ~ ~] [3 3 1 ~] [3 ~ 1 ~] [4 3 2 1] [1 ~ ~ ~]";
const SONG = {
  id: "song.test-standard",
  title: "Test Standard",
  year: 1925,
  status: "US-PD",
  provenance: { source: "test", year: 1925 },
  verifiedBy: "test",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: 120,
  form: "AABA",
  answerKey: {
    bars: 32,
    code: "",
    layers: {
      bass: `n("<${[...A_BASS, ...A_BASS, ...B_BASS, ...A_BASS].join(" ")}>").scale("C2:major").s("ebass")`,
      melody: `n("<${[A_MEL, A_MEL, B_MEL, A_MEL].join(" ")}>").scale("C4:major").s("piano")`,
    },
    phrases: [
      [1, 8],
      [9, 16],
      [17, 24],
      [25, 32],
    ],
    sections: [
      { label: "A", bars: [1, 8] },
      { label: "A", bars: [9, 16] },
      { label: "B", bars: [17, 24] },
      { label: "A", bars: [25, 32] },
    ],
  },
} as unknown as SongDef;
SONG.answerKey.code = `setcpm(120/4)\n\nbass: ${SONG.answerKey.layers.bass}\nmel: ${SONG.answerKey.layers.melody}`;

const ctx = {
  params: {},
  attemptNo: 1,
  firstAttempt: true,
  rung: 0 as const,
  tutorHints: 0,
  extraReplays: 0,
  lint: {
    profile: "graded" as const,
    unlocked: new Set<never>(),
    allowPreview: false,
    meter: "4/4" as const,
    key: null,
  },
};
const item = (stage: "bass" | "melody", phrase: number) => ({
  itemId: "lad.8.test-standard",
  level: 8 as const,
  stage,
  phrase,
});
const setConst = (code: string, name: string, body: string) =>
  code.replace(new RegExp(`^const ${name} = .*$`, "m"), `const ${name} = ${body}`);

describe("L8 through the real grader (a 32-bar AABA tune, one section at a time)", () => {
  const skeleton = skeletonOfForm(G, AABA);
  const bassA = `n("<${A_BASS.join(" ")}>").scale("C2:major").s("ebass")`;
  const bassB = `n("<${B_BASS.join(" ")}>").scale("C2:major").s("ebass")`;

  test("the skeleton's bass fails section 1 naming its bars; the section as heard passes at 0.90", async () => {
    const fail = await gradeStandardLadder({ item: item("bass", 1), song: SONG, code: skeleton, ctx });
    expect(fail.status).toBe("fail");
    const bars = checkLines(fail).flatMap((l) => (l.bar === null ? [] : [l.bar]));
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.every((b) => b >= 1 && b <= 8)).toBe(true);
    const written = setConst(skeleton, "bassA", bassA);
    const pass = await gradeStandardLadder({ item: item("bass", 1), song: SONG, code: written, ctx });
    expect(pass.status).toBe("pass");
    expect(pass.score).toBeGreaterThanOrEqual(STANDARD_PASS.bass);
  });

  test("a section that comes back passes from the same const; the bridge is still to write", async () => {
    const written = setConst(skeleton, "bassA", bassA);
    for (const n of [2, 4]) {
      const r = await gradeStandardLadder({ item: item("bass", n), song: SONG, code: written, ctx });
      expect([n, r.status]).toEqual([n, "pass"]);
    }
    const bridge = await gradeStandardLadder({ item: item("bass", 3), song: SONG, code: written, ctx });
    expect(bridge.status).toBe("fail");
    const bars = checkLines(bridge).flatMap((l) => (l.bar === null ? [] : [l.bar]));
    expect(bars.every((b) => b >= 17 && b <= 24)).toBe(true);
    const done = setConst(written, "bassB", bassB);
    expect((await gradeStandardLadder({ item: item("bass", 3), song: SONG, code: done, ctx })).status).toBe(
      "pass",
    );
  });

  test("the melody of a section, written into its const, passes at 0.90", async () => {
    const code = setConst(skeleton, "melB", `n("<${B_MEL}>").scale("C4:major").s("piano")`);
    const r = await gradeStandardLadder({ item: item("melody", 3), song: SONG, code, ctx });
    expect(r.status).toBe("pass");
    expect(r.score).toBeGreaterThanOrEqual(STANDARD_PASS.melody);
    const empty = await gradeStandardLadder({ item: item("melody", 1), song: SONG, code, ctx });
    expect(empty.status).toBe("fail");
  });
});
