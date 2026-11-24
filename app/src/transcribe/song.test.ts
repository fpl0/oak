// Song items (L5 per phrase, L6 staged): the givens, the phrase map and stage strip, the timeline's marks, "bass
// only" listening, the starter code, the chord chart in the code, and — through the real grader, headless — that a
// starter fails a phrase with a message naming its bars while the tune as heard passes, and that an L6 strain passes
// its bass and its changes when the chart is written into the code the way the page writes it.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { GradeResult, SongDef } from "@oak/content-kit";
import { gradeSongLadder } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import redRiver from "../../../content/repertoire/red-river-valley/song.ts";
import { checkLines, lineText } from "./ladder.ts";
import {
  barMarks,
  changesOfCode,
  chorusSpans,
  currentPhrase,
  currentSongStage,
  keyText,
  layerOfTrack,
  lineSpans,
  listenAllowed,
  listenMutes,
  mergeStageMarks,
  phraseStates,
  pickupChip,
  pickupFromEvents,
  pickupText,
  rememberedItem,
  rememberItem,
  type SongGiven,
  songGivenChips,
  songGivenOf,
  songStageStates,
  songStarter,
  songVerdict,
  spanAt,
  spanLoop,
  stageListenMode,
  timelineMarks,
  withChanges,
} from "./song.ts";

setDefaultTimeout(90_000);

const ev = (track: string, onset: [number, number]) => ({ track, onset });

const RRV_GIVEN: SongGiven = {
  songId: "song.red-river-valley",
  title: "Red River Valley",
  year: "trad",
  bpm: 104,
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  pickupBeats: 2,
  bars: 16,
  phrases: [
    [1, 4],
    [5, 8],
    [9, 12],
    [13, 16],
  ],
  swing: false,
  form: null,
};

describe("givens", () => {
  test("the pickup is read from the reference: the tune enters after rests while bass and chords wait", () => {
    expect(pickupFromEvents([ev("mel", [1, 2]), ev("mel", [3, 4]), ev("bass", [1, 1])], "4/4")).toBe(2);
    expect(pickupFromEvents([ev("mel", [3, 4]), ev("drums", [0, 1])], "4/4")).toBe(1);
    // A full first bar: the bass plays on beat 1.
    expect(pickupFromEvents([ev("mel", [1, 2]), ev("bass", [0, 1])], "4/4")).toBeNull();
    expect(pickupFromEvents([ev("mel", [0, 1])], "4/4")).toBeNull();
    expect(pickupFromEvents([ev("mel", [2, 3])], "3/4")).toBe(1);
  });

  test("songGivenOf: the item first, then the project and the song list, then the reference", () => {
    const project = {
      id: "tr1",
      title: "Red River Valley",
      songId: "song.red-river-valley",
      key: { tonic: "C", mode: "major" } as const,
      bpm: 104,
      meter: "4/4",
      ladderLevel: 5,
      stimulus: { events: [ev("mel", [1, 2]), ev("bass", [1, 1])], bars: 17, cps: 0.43 },
    };
    const song = {
      songId: "song.red-river-valley",
      title: "Red River Valley",
      year: "trad" as const,
      phrases: RRV_GIVEN.phrases,
    };
    const g = songGivenOf(project, null, song);
    expect(g.pickupBeats).toBe(2);
    expect(g.bars).toBe(16);
    expect(g.phrases).toEqual(RRV_GIVEN.phrases);
    expect(g.swing).toBe(false);
    expect(g.form).toBeNull();
    // The item's own givens win: no pickup said is no pickup.
    const item = {
      given: {
        bpm: 100,
        meter: "4/4" as const,
        key: { tonic: "G", mode: "major" as const },
        pickup: null,
        bars: 12,
      },
      song: { songId: "song.st-louis-blues", title: "St. Louis Blues", year: 1914 },
      phrases: [[1, 12]] as [number, number][],
    };
    const blues = songGivenOf({ ...project, ladderLevel: 6, stimulus: null }, item, null);
    expect(blues.pickupBeats).toBeNull();
    expect(blues.swing).toBe(true);
    expect(blues.form).toBe("one 12-bar strain");
    expect(blues.phrases).toEqual([
      [1, 4],
      [5, 8],
      [9, 12],
    ]);
    expect(blues.key?.tonic).toBe("G");
    // A server that states the feel on the project is believed.
    expect(songGivenOf({ ...project, ladderLevel: 6, given: { swing: null } }, item, null).swing).toBe(false);
  });

  test("the givens read as a learner needs them", () => {
    expect(pickupText(RRV_GIVEN)).toBe("Starts on beat 3 of the pickup bar (2 beats before bar 1)");
    expect(pickupText({ pickupBeats: null, meter: "4/4" })).toBe("Starts on beat 1 of bar 1");
    expect(pickupChip(RRV_GIVEN)).toBe("Pickup: 2 beats, from beat 3");
    expect(keyText({ tonic: "F#", mode: "major" })).toBe("F♯ major, home is F♯");
    expect(
      songGivenChips({ ...RRV_GIVEN, swing: true, form: "one 12-bar strain", pickupBeats: null }),
    ).toEqual([
      "104 BPM",
      "4/4",
      "C major, home is C",
      "No pickup",
      "one 12-bar strain",
      "Swing 8ths",
      "One chord a bar",
    ]);
  });
});

describe("bars, phrases and lines", () => {
  test("a phrase's loop takes the bar before it in a song with a pickup (its pickup notes are there)", () => {
    expect(spanLoop([1, 4], true)).toEqual({ fromBar: 0, bars: 5 });
    expect(spanLoop([5, 8], true)).toEqual({ fromBar: 4, bars: 5 });
    expect(spanLoop([5, 8], false)).toEqual({ fromBar: 4, bars: 4 });
    expect(spanLoop([5, 8], true, false)).toEqual({ fromBar: 5, bars: 4 });
    expect(spanAt(RRV_GIVEN.phrases, 0)).toBe(0);
    expect(spanAt(RRV_GIVEN.phrases, 7)).toBe(1);
  });

  test("lines and choruses of a strain", () => {
    expect(lineSpans(12)).toEqual([
      [1, 4],
      [5, 8],
      [9, 12],
    ]);
    expect(lineSpans(10)).toEqual([
      [1, 4],
      [5, 8],
      [9, 10],
    ]);
    expect(chorusSpans(24)).toEqual([
      [1, 12],
      [13, 24],
    ]);
    expect(chorusSpans(16)).toEqual([[1, 16]]);
  });

  test("timeline marks count from the first full bar after a pickup (c4)", () => {
    expect(timelineMarks(5, RRV_GIVEN).map((m) => [m.cycle, m.text])).toEqual([
      [1, "Phrase 1"],
      [5, "Phrase 2"],
      [9, "Phrase 3"],
      [13, "Phrase 4"],
    ]);
    const strain = { phrases: lineSpans(24), bars: 24, pickupBeats: null };
    expect(timelineMarks(6, strain).map((m) => `${m.cycle}:${m.text}:${m.kind}`)).toEqual([
      "0:Chorus 1:section",
      "4:Line 2:line",
      "8:Line 3:line",
      "12:Chorus 2:section",
      "16:Line 5:line",
      "20:Line 6:line",
    ]);
    expect(timelineMarks(6, { phrases: lineSpans(12), bars: 12, pickupBeats: 1 })[0]).toEqual({
      cycle: 1,
      text: "12-bar strain",
      kind: "section",
    });
  });

  test("phrases open in order; stages open after the one before", () => {
    expect(phraseStates(4, [1], []).map((s) => s.status)).toEqual(["passed", "open", "locked", "locked"]);
    expect(phraseStates(3, [1], [2]).map((s) => s.status)).toEqual(["passed", "revealed", "open"]);
    expect(currentPhrase(2, [1, 2])).toBeNull();
    expect(songStageStates({}).map((s) => s.status)).toEqual(["open", "locked", "locked"]);
    const marks = mergeStageMarks(["bass"], { changes: "revealed" });
    expect(songStageStates(marks).map((s) => s.status)).toEqual(["passed", "revealed", "open"]);
    expect(currentSongStage(marks)).toBe("melody");
  });
});

describe("listening", () => {
  const tracks = ["ref_drums", "ref_bass", "ref_chords", "ref_mel", "ref_mel_1"];
  test("tracks are read as layers by their labels", () => {
    expect(tracks.map(layerOfTrack)).toEqual(["drums", "bass", "chords", "melody", "melody"]);
    expect(layerOfTrack("ref_kick")).toBe("drums");
    expect(layerOfTrack("ref_x")).toBe("other");
  });
  test("bass only mutes everything else; without melody mutes the tune", () => {
    expect(listenMutes("full", tracks)).toEqual([]);
    expect(listenMutes("bass", tracks)).toEqual(["ref_drums", "ref_chords", "ref_mel", "ref_mel_1"]);
    expect(listenMutes("no-melody", tracks)).toEqual(["ref_mel", "ref_mel_1"]);
    expect(stageListenMode("bass")).toBe("bass");
    expect(stageListenMode("changes")).toBe("no-melody");
    expect(stageListenMode("melody")).toBe("full");
  });
  test("a layer alone only while the realism keeps the parts clear (R0–R2)", () => {
    expect([0, 1, 2, 3, 4].map(listenAllowed)).toEqual([true, true, true, false, false]);
  });
});

describe("the chord chart in the code", () => {
  test("written and read back, with the pickup bar resting", () => {
    const code = songStarter(6, {
      ...RRV_GIVEN,
      bars: 4,
      pickupBeats: 1,
      swing: true,
      form: "a 4-bar verse",
    });
    expect(changesOfCode(code, 4, true)).toEqual(["", "", "", ""]);
    const next = withChanges(code, ["G7", "C7", "", "D7"], true);
    expect(next).toContain('chords: chord("<~ G7 C7 ~ D7>").voicing().s("piano").gain(.6)');
    expect(changesOfCode(next, 4, true)).toEqual(["G7", "C7", "", "D7"]);
    expect(withChanges(next, ["", "", "", ""], true)).toContain('chords: note("<~ ~ ~ ~ ~>")');
  });
  test("a chords line the learner wrote another way is left alone by the chart", () => {
    expect(changesOfCode('chords: chord("<[G7 C7] D7>").voicing()', 2, false)).toBeNull();
    expect(changesOfCode('chords: n("0 2 4").scale("C3:major")', 2, false)).toBeNull();
    expect(withChanges('bass: n("0")', ["C7"], false)).toBe(
      'bass: n("0")\nchords: chord("<C7>").voicing().s("piano").gain(.6)',
    );
  });
  test("the line plays the chords it names (headless Strudel)", async () => {
    const code = withChanges('setcpm(90/4)\nbass: note("g2")', ["G7", "C7"], false);
    const r = await evalHeadless(code, 2);
    expect(r.logs.filter((l) => /unknown chord|error/i.test(l))).toEqual([]);
    const chordsAt = (cycle: number) =>
      [
        ...new Set(
          r.events
            .filter((e) => e.track === "chords" && Math.floor(e.onset) === cycle)
            .map((e) => (e.midi ?? 0) % 12),
        ),
      ].sort((a, b) => a - b);
    // G7 = G B D F; C7 = C E G B♭.
    expect(chordsAt(0)).toEqual([2, 5, 7, 11]);
    expect(chordsAt(1)).toEqual([0, 4, 7, 10]);
  });
});

describe("verdicts and bar marks", () => {
  const result = (score: number, bars: number[]): GradeResult =>
    ({
      status: score >= 0.85 ? "pass" : "fail",
      score,
      parts: [],
      messages: bars.map((b) => ({
        code: "pitch.wrong",
        text: `Bar ${b}, 2: wrong note.`,
        where: { bar: b, beatLabel: "2" },
      })),
      assist: { revealed: false },
    }) as unknown as GradeResult;
  test("names what was checked, the mark and the bars", () => {
    expect(
      songVerdict({ passed: false, result: result(0.6, [6, 7]) }, { level: 5, span: 2, stage: null }),
    ).toBe("Phrase 2: not yet, 60% right; 85% passes. Bars 6 and 7 differ. Loop it and listen again.");
    expect(
      songVerdict({ passed: false, result: result(0.8, [3]) }, { level: 6, span: null, stage: "bass" }),
    ).toBe("The bass: not yet, 80% right; 90% passes. Bar 3 differs. Loop it and listen again.");
    expect(
      songVerdict({ passed: true, result: result(0.95, []) }, { level: 6, span: 2, stage: "melody" }),
    ).toBe("Melody, line 2: that's it (95%).");
  });
  test("d12: from L5 a tune written in another key fails, and the verdict says both keys first", () => {
    const transposed = {
      ...result(0, []),
      messages: [
        { id: "melody.wrong-key", text: "Right tune, but in D major, not G major." },
        { id: "melody.wrong-degree", text: "Bar 2, 1: 2 where the song has 5.", where: { bar: 2 } },
      ],
    } as unknown as GradeResult;
    expect(songVerdict({ passed: false, result: transposed }, { level: 5, span: 1, stage: null })).toBe(
      "Phrase 1: not yet. Right tune, but in D major, not G major. Write it in the recording's key.",
    );
    const chords = {
      ...result(0.2, [1]),
      messages: [
        { id: "harmony.key-mismatch", text: "These chords are in F major; the recording is in C major." },
      ],
    } as unknown as GradeResult;
    expect(songVerdict({ passed: false, result: chords }, { level: 6, span: null, stage: "changes" })).toBe(
      "The changes: not yet. These chords are in F major; the recording is in C major. Write it in the recording's key.",
    );
  });
  test("per-bar marks on the timeline, in cycles", () => {
    const m = barMarks(result(0.6, [6]), [5, 8], true);
    expect([...m.entries()]).toEqual([
      [5, "ok"],
      [6, "issue"],
      [7, "ok"],
      [8, "ok"],
    ]);
  });
  test("the item ladder.next returned is kept for the page", () => {
    rememberItem({
      itemId: "tr9",
      level: 5,
      realism: 0,
      seed: 1,
      stages: null,
      given: { bpm: 90, meter: "4/4", key: { tonic: "C", mode: "major" }, pickup: null, bars: 16 },
      project: {} as never,
      song: { songId: "song.aura-lee", title: "Aura Lee", year: 1861 },
      phrases: [[1, 4]],
    });
    expect(rememberedItem("tr9")?.song?.title).toBe("Aura Lee");
    expect(rememberedItem("nope")).toBeNull();
  });
});

// --- through the real grader -------------------------------------------------------------------------------

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

describe("L5 through the real grader (Red River Valley, a two-beat pickup)", () => {
  const song = redRiver as SongDef;
  test("the starter fails phrase 1 with lines that name its bars; the tune as heard passes", async () => {
    const g = songGivenOf(
      {
        id: "tr",
        title: song.title,
        songId: song.id,
        key: song.key,
        bpm: song.bpm,
        meter: song.meter,
        ladderLevel: 5,
        stimulus: null,
      },
      {
        given: { bpm: song.bpm, meter: song.meter, key: song.key, pickup: song.pickup ?? null, bars: 16 },
        song: { songId: song.id, title: song.title, year: song.year },
        phrases: song.answerKey.phrases ?? [],
      },
      null,
    );
    expect(g.pickupBeats).toBe(2);
    const starter = songStarter(5, g);
    expect(starter).toContain('melody: n("<[~ ~ 0 0] 0 0');
    const item = { itemId: "lad.5.rrv.1", level: 5 as const, phrase: 1 };
    const fail = await gradeSongLadder({ item, song, code: starter, ctx });
    expect(fail.status).toBe("fail");
    const lines = checkLines(fail).map(lineText);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => /^Bar [1-4]\b/.test(l) || /pickup/i.test(l))).toBe(true);
    expect(songVerdict({ passed: false, result: fail }, { level: 5, span: 1, stage: null })).toMatch(
      /^Phrase 1: not yet, \d+% right; 85% passes\./,
    );
    // The learner writes the tune they heard on the melody line.
    const heard = `${starter.split("\n\n")[0]}\n\nmelody: ${song.answerKey.layers.melody}\n`;
    const pass = await gradeSongLadder({ item, song, code: heard, ctx });
    expect(pass.status).toBe("pass");
    expect(pass.score).toBeGreaterThanOrEqual(0.85);
  });
});

/** An Oak-made 12-bar blues in G (not a real song): a root bass and dominant sevenths, swung. */
const BLUES_CHART = ["G7", "C7", "G7", "G7", "C7", "C7", "G7", "G7", "D7", "C7", "G7", "D7"];
const BLUES_ROOTS = [0, 3, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4];
const BLUES: SongDef = {
  id: "song.test-blues" as SongDef["id"],
  title: "Test Blues",
  year: "trad",
  status: "trad",
  provenance: { source: "test", year: 1900 },
  verifiedBy: "test",
  key: { tonic: "G", mode: "major" },
  meter: "4/4",
  bpm: 96,
  swing: { subdivision: 8, amount: 1 / 3 },
  form: "12-bar blues",
  answerKey: {
    bars: 12,
    code: "",
    layers: {
      bass: `n("<${BLUES_ROOTS.join(" ")}>").scale("G2:major").s("ebass")`,
      chords: `chord("<${BLUES_CHART.join(" ")}>").voicing().s("piano")`,
      melody:
        'n("<[4 4 2 0] 2 [4 4 2 0] 0 [3 3 1 0] 1 [4 4 2 0] 0 [4 4 3 1] 3 [2 1 0 ~] ~>").scale("G4:major").s("piano")',
    },
    phrases: [[1, 12]],
  },
};
BLUES.answerKey.code = `setcpm(96/4)\n\nbass: ${BLUES.answerKey.layers.bass}\nchords: ${BLUES.answerKey.layers.chords}\nmel: ${BLUES.answerKey.layers.melody}`;

describe("L6 through the real grader (a 12-bar strain)", () => {
  const g: SongGiven = {
    songId: BLUES.id,
    title: BLUES.title,
    year: "trad",
    bpm: 96,
    meter: "4/4",
    key: BLUES.key,
    pickupBeats: null,
    bars: 12,
    phrases: lineSpans(12),
    swing: true,
    form: "one 12-bar strain",
  };
  const item = (stage: "bass" | "changes") => ({
    itemId: "lad.6.test-blues",
    level: 6 as const,
    phrase: 1,
    stage,
  });

  test("the starter's bass fails with bar lines; the roots as heard pass at 0.90", async () => {
    const starter = songStarter(6, g);
    const fail = await gradeSongLadder({ item: item("bass"), song: BLUES, code: starter, ctx });
    expect(fail.status).toBe("fail");
    expect(checkLines(fail).some((l) => l.bar !== null)).toBe(true);
    const code = starter.replace(
      /^bass: .*$/m,
      `bass: n("<${BLUES_ROOTS.join(" ")}>").scale("G2:major").s("ebass")`,
    );
    const pass = await gradeSongLadder({ item: item("bass"), song: BLUES, code, ctx });
    expect(pass.score).toBeGreaterThanOrEqual(0.9);
    expect(pass.status).toBe("pass");
  });

  test("the chart written into the code passes the changes; a wrong bar is named", async () => {
    const withBass = songStarter(6, g).replace(
      /^bass: .*$/m,
      `bass: n("<${BLUES_ROOTS.join(" ")}>").scale("G2:major").s("ebass")`,
    );
    const right = withChanges(withBass, BLUES_CHART, false);
    const pass = await gradeSongLadder({ item: item("changes"), song: BLUES, code: right, ctx });
    expect(pass.status).toBe("pass");
    const wrongChart = [...BLUES_CHART];
    wrongChart[1] = "G7";
    wrongChart[9] = "D7";
    const wrong = withChanges(withBass, wrongChart, false);
    const fail = await gradeSongLadder({ item: item("changes"), song: BLUES, code: wrong, ctx });
    expect(fail.score).toBeLessThan(pass.score);
    const named = checkLines(fail).flatMap((l) => (l.bar === null ? [] : [l.bar]));
    expect(named).toContain(2);
  });

  test("the reference's events read back as the layers the page mutes", async () => {
    const r = await evalHeadless(BLUES.answerKey.code, 12);
    const tracks = [...new Set(r.events.map((e) => e.track))];
    expect(tracks.map(layerOfTrack).sort()).toEqual(["bass", "chords", "melody"]);
  });
});
