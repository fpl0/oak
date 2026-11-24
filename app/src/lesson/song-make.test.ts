// The Make inside the song (spec 2026-11-24 §5.3, contracts §5.11 rules 14–15): where the editor starts, the tempo
// line, what a saved take claims, and that a reopened Make neither records a take nor passes unchanged. The grading
// half runs the real grader realm, as grading.test.ts does.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { Exercise, SessionId, TakeStep } from "@oak/api";
import { evaluateForGrading, gradeExercise, initRealm } from "@oak/grader";
import { courseGraph } from "../../../content/index.ts";
import { unlockedAt } from "../../../content/lib/course.ts";
import { toolbox } from "../../../content/toolbox.ts";
import { TEST_SONG, testDetail, testTake } from "../song/test-song.ts";
import { type GradeEnv, type GraderDeps, gradeStep, NEUTRAL_PROFILE } from "./grading.ts";
import {
  newSongGateOf,
  openingCode,
  openingsOf,
  playedPartsOf,
  recordSongTake,
  refineBackfilledTakes,
  shiftRanges,
  songChipLabel,
  songMakeOf,
  songSideOf,
  takeIdempotencyKey,
  tempoRangeOf,
  todayLoopOf,
  withSongTempo,
} from "./song-make.ts";

setDefaultTimeout(60_000);

const L01_STEP = TEST_SONG.plan[0] as TakeStep;
const L02_STEP = TEST_SONG.plan[1] as TakeStep;
const STARTER = 'setcpm(⟪80⟫/4)\n\ndrums: s("bd")'.replace(/[⟪⟫]/g, "");
const L01_CODE = 'setcpm(96/4)\n\ndrums: s("bd sd bd sd")';

/** A Make like U01.L01's: a sound on each of the four beats is the one that counts. */
const MAKE = {
  kind: "code-make",
  id: "test-make",
  version: 1,
  role: "practice",
  prompt: "Write a one-bar drum beat. Done when a sound starts on every beat.",
  skills: [{ skill: "R01", w: 1 }],
  code: { starter: 'setcpm(100/4)\n\ndrums: s("bd")' },
  bars: [1, 2],
  saveAs: "sketch",
  rubric: [
    {
      id: "every-beat",
      label: "A drum sound starts on each of the four beats",
      required: true,
      skills: ["R01"],
      rule: "onsets",
      track: "@drums",
      contains: [
        [0, 1],
        [1, 4],
        [1, 2],
        [3, 4],
      ],
      perBar: true,
    },
    {
      id: "tempo",
      label: "A tempo between 70 and 140",
      required: false,
      skills: ["R02"],
      rule: "tempo-bpm",
      min: 70,
      max: 140,
    },
  ],
  hints: [{ text: "a" }, { text: "b" }, { text: "c" }, "auto"],
  tests: [],
} as unknown as Exercise;

const deps: GraderDeps = {
  grade: (req) => gradeExercise(req),
  evaluate: (code, bars, meter) => evaluateForGrading(code, { mode: "lesson", bars, lint: null, meter }),
};
const env: GradeEnv = {
  ownerId: "U01.L02",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: 100,
  unlocked: unlockedAt(courseGraph(), toolbox, "U01.L02" as SessionId),
  allowPreview: false,
  profile: NEUTRAL_PROFILE,
};
const grade = (code: string, unchangedFrom?: readonly string[]) =>
  gradeStep(
    deps,
    env,
    MAKE,
    { code },
    {
      params: {},
      attemptNo: 1,
      rung: 0,
      extraReplays: 0,
      ...(unchangedFrom ? { unchangedFrom } : {}),
    },
  );

beforeAll(async () => {
  await initRealm({ toolbox: [...toolbox], lockdown: false });
});

describe("where a take Make starts", () => {
  test("openingCode starts from the named earlier take, else the starter", () => {
    const l01 = testTake(1, "U01.L01", L01_CODE, ["kick@verse", "snare@verse"], { bpm: 96 });
    const replayed = testTake(2, "U01.L01", 'setcpm(90/4)\n\ndrums: s("bd cp bd cp")', ["kick@verse"], {
      bpm: 90,
    });
    // `startFrom: 'U01.L01'`: the learner's newest take of that lesson, at the song's tempo.
    expect(openingCode(L02_STEP, testDetail([l01, replayed]), STARTER, 100)).toEqual({
      code: 'setcpm(100/4)\n\ndrums: s("bd cp bd cp")',
      source: "U01.L01",
    });
    // No take of that lesson (skipped, or the song is new): the authored starter, at the song's tempo.
    expect(openingCode(L02_STEP, testDetail([]), STARTER, 96)).toEqual({
      code: 'setcpm(96/4)\n\ndrums: s("bd")',
      source: "oak",
    });
    expect(openingCode(L02_STEP, null, STARTER, 100).source).toBe("oak");
    // `startFrom: 'oak'`: the starter, whatever the song holds.
    expect(openingCode(L01_STEP, testDetail([l01]), STARTER, 96)).toEqual({
      code: 'setcpm(96/4)\n\ndrums: s("bd")',
      source: "oak",
    });
    // A tempo the Make does not accept leaves the line as written.
    expect(openingCode(L01_STEP, null, STARTER, 160, [70, 140]).code).toBe(STARTER);
  });

  test("withSongTempo rewrites only the tempo line and respects the allowed range", () => {
    const code = 'setcpm(80/4)\n\n// setcpm(80/4) is the tempo\ndrums: s("bd").fast(setcpm(1)/1)';
    expect(withSongTempo(code, 104)).toBe(code.replace("setcpm(80/4)", "setcpm(104/4)"));
    expect(withSongTempo('setcpm( 80 / 4 )\nx: s("bd")', 92.5)).toBe('setcpm( 92.5 / 4 )\nx: s("bd")');
    expect(withSongTempo("setcpm(90/3)\n", 120)).toBe("setcpm(120/3)\n");
    // Not the plain `setcpm(<n>/<beats>)` form, or no tempo line: unchanged.
    expect(withSongTempo("setcpm(30)\n", 100)).toBe("setcpm(30)\n");
    expect(withSongTempo('drums: s("bd")', 100)).toBe('drums: s("bd")');
    // The allowed range, from the Make's own tempo rule.
    expect(tempoRangeOf(MAKE)).toEqual([70, 140]);
    expect(withSongTempo("setcpm(80/4)", 150, [70, 140])).toBe("setcpm(80/4)");
    expect(withSongTempo("setcpm(80/4)", 140, [70, 140])).toBe("setcpm(140/4)");
    // A starter's marked regions move with the text after the rewritten number.
    const before = 'setcpm(80/4)\nd: s("bd")';
    const after = withSongTempo(before, 104);
    expect(
      shiftRanges(
        [
          { from: 15, to: 17 },
          { from: 7, to: 9 },
        ],
        before,
        after,
      ),
    ).toEqual([
      { from: 16, to: 18 },
      { from: 7, to: 10 },
    ]);
  });

  test("songMakeOf finds a take step and songSideOf a side step of the registered songs", () => {
    const anyTake = songMakeOf("U01.L01");
    expect(anyTake?.step.kind).toBe("take");
    expect(anyTake?.def.unit).toBe("U01");
    expect(songMakeOf("U03.L01")).toBeNull();
    expect(songSideOf("U03.L01")).toBeNull();
    expect(newSongGateOf(L01_STEP, testDetail([], { status: "new" }))).toBe(true);
    expect(newSongGateOf(L01_STEP, testDetail([]))).toBe(false);
    expect(newSongGateOf(null, testDetail([], { status: "new" }))).toBe(false);
    expect(newSongGateOf(L01_STEP, null)).toBe(false);
  });

  test("today's loop is the first run of today's sections; a whole-song step loops nothing", () => {
    expect(todayLoopOf(TEST_SONG, L01_STEP)).toEqual({ from: 4, bars: 8 });
    // The two choruses sit side by side: one run of 16 bars.
    expect(todayLoopOf(TEST_SONG, L02_STEP)).toEqual({ from: 13, bars: 16 });
    expect(todayLoopOf(TEST_SONG, { ...L01_STEP, sections: ["intro", "chorus2"] })).toEqual({
      from: 0,
      bars: 4,
    });
    expect(todayLoopOf(TEST_SONG, { ...L01_STEP, sections: ["verse", "stop", "chorus2"] })).toEqual({
      from: 4,
      bars: 9,
    });
    expect(todayLoopOf(TEST_SONG, { ...L01_STEP, sections: "all" })).toBeNull();
  });
});

describe("a reopened Make", () => {
  test("reopening a take Make does not record a take and unchanged code fails", async () => {
    const l01 = testTake(1, "U01.L01", L01_CODE, ["kick@verse", "snare@verse"], { bpm: 96 });
    const detail = testDetail([l01]);
    const posted: unknown[] = [];
    const io = {
      evaluate: deps.evaluate,
      post: async (_unit: string, body: unknown) => {
        posted.push(body);
      },
    };
    // Opened, abandoned, opened again: the opening code is recomputed from the song, the same both times, and
    // opening never posts a take.
    const first = openingCode(L02_STEP, detail, STARTER, 96);
    const again = openingCode(L02_STEP, detail, STARTER, 96);
    expect(again).toEqual(first);
    expect(first).toEqual({ code: L01_CODE, source: "U01.L01" });
    expect(posted).toEqual([]);
    expect(detail.takes).toHaveLength(1);

    // The earlier loop already meets today's rule, but it is what the editor opened with: it does not pass.
    const openings = openingsOf(L02_STEP, detail, STARTER, 96);
    expect(openings).toContain(L01_CODE);
    const unchanged = await grade(first.code, openings);
    expect(unchanged.status).toBe("fail");
    expect(unchanged.diagnostics.map((d) => d.id)).toContain("make.unchanged");
    // Oak's copy at the song's tempo ("Start from Oak's copy") counts as unchanged too.
    expect(openings).toContain('setcpm(96/4)\n\ndrums: s("bd")');
    expect((await grade('setcpm(96/4)\n\ndrums: s("bd")', openings)).status).toBe("fail");
    // Without the song's openings the grader compares with the authored starter only, as before.
    expect((await grade(first.code)).status).toBe("pass");
    // A change is today's work.
    const changed = await grade(`${L01_CODE}\nhats: s("hh*8")`, openings);
    expect(changed.status).toBe("pass");

    // Saving records one take; saving the same version again (a retried Save) sends the same key.
    const saved = {
      def: TEST_SONG,
      step: L02_STEP,
      unitId: "U01",
      lessonId: "U01.L02",
      meter: "4/4",
      bars: 2,
      songBpm: 96,
    } as const;
    await recordSongTake(io, {
      ...saved,
      code: `${L01_CODE}\nhats: s("hh*8")`,
      sketchId: "sk_9",
      sketchVersion: 1,
    });
    await recordSongTake(io, {
      ...saved,
      code: `${L01_CODE}\nhats: s("hh*8")`,
      sketchId: "sk_9",
      sketchVersion: 1,
    });
    expect(posted).toHaveLength(2);
    const [a, b] = posted as { idempotencyKey: string }[];
    expect(a?.idempotencyKey).toBe(b?.idempotencyKey as string);
    expect(a?.idempotencyKey).toBe(takeIdempotencyKey("U01.L02", "sk_9", 1));
    expect(a?.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});

describe("what a saved take claims", () => {
  test("playedPartsOf maps drum sounds and a chords track", () => {
    const drums = playedPartsOf(TEST_SONG, [
      { label: "drums", role: "drums", sounds: ["bd", "sd:2", "hh"], chords: false },
    ]);
    expect([...drums.parts].sort()).toEqual(["hats", "kick", "snare"]);
    expect(drums.playsChords).toBe(false);
    // An exact drum label stands for its part even with a sound no part lists.
    expect([
      ...playedPartsOf(TEST_SONG, [{ label: "kick", role: "drums", sounds: ["tom"], chords: false }]).parts,
    ]).toEqual(["kick"]);
    // A pitched track by label, else by role; a chords track plays chords.
    const pitched = playedPartsOf(TEST_SONG, [
      { label: "mel", role: "melody", sounds: ["piano"], chords: false },
      { label: "keys", role: "chords", sounds: ["piano"], chords: true },
      { label: "low", role: "bass", sounds: ["ebass"], chords: false },
    ]);
    expect([...pitched.parts].sort()).toEqual(["bass", "lead"]);
    expect(pitched.playsChords).toBe(true);
  });

  test("the take's cells, labels and tempo come from the evaluated saved code", async () => {
    const posted: { unitId: string; body: Record<string, unknown> }[] = [];
    await recordSongTake(
      {
        evaluate: deps.evaluate,
        post: async (unitId, body) => {
          posted.push({ unitId, body: body as Record<string, unknown> });
        },
      },
      {
        def: TEST_SONG,
        step: L01_STEP,
        unitId: "U01",
        lessonId: "U01.L01",
        meter: "4/4",
        bars: 2,
        songBpm: 100,
        // Past the brief: hats too. They take the hats of the verse, and only there.
        code: 'setcpm(92/4)\n\ndrums: s("bd sd bd sd")\nhats: s("hh*8")',
        sketchId: "sk_1",
        sketchVersion: 1,
      },
    );
    expect(posted).toHaveLength(1);
    expect(posted[0]?.unitId).toBe("U01");
    expect(posted[0]?.body).toMatchObject({
      lessonId: "U01.L01",
      sketchId: "sk_1",
      sketchVersion: 1,
      cells: ["kick@verse", "snare@verse", "hats@verse"],
      labels: { drums: null, hats: "hats" },
      bpm: 92,
    });
    // Code that does not run still records the step's own cells, at the song's tempo.
    posted.length = 0;
    await recordSongTake(
      {
        evaluate: deps.evaluate,
        post: async (unitId, body) => void posted.push({ unitId, body: body as never }),
      },
      {
        def: TEST_SONG,
        step: L01_STEP,
        unitId: "U01",
        lessonId: "U01.L01",
        meter: "4/4",
        bars: 2,
        songBpm: 100,
        code: "drums: s(",
        sketchId: "sk_2",
        sketchVersion: 1,
      },
    );
    expect(posted[0]?.body).toMatchObject({ cells: ["kick@verse", "snare@verse"], labels: {}, bpm: 100 });
  });

  test("a saved take refines the takes Oak backfilled from earlier sketches", async () => {
    const posted: Record<string, unknown>[] = [];
    const io = {
      evaluate: deps.evaluate,
      post: async (_unit: string, body: unknown) => void posted.push(body as Record<string, unknown>),
    };
    const backfilled = testTake(
      4,
      "U01.L01",
      'setcpm(90/4)\n\ndrums: s("bd hh bd hh")',
      ["kick@verse", "snare@verse"],
      {
        backfilled: true,
        sketchId: "sk_old",
      },
    );
    const mine = testTake(5, "U01.L02", L01_CODE, ["kick@chorus1"]);
    const n = await refineBackfilledTakes(io, {
      def: TEST_SONG,
      unitId: "U01",
      meter: "4/4",
      songBpm: 100,
      takes: [backfilled, mine],
    });
    expect(n).toBe(1);
    // Posted again with its own lesson, sketch and version: the server refines it in place.
    expect(posted[0]).toMatchObject({
      lessonId: "U01.L01",
      sketchId: "sk_old",
      sketchVersion: 1,
      cells: ["kick@verse", "snare@verse", "hats@verse"],
      bpm: 90,
    });
  });

  test("chips tell today's code, yours and Oak's apart", () => {
    const o = {
      partName: (label: string) => (label === "mel" ? "Tune" : label === "kick" ? "Kick" : null),
      lessonTitle: (id: string) => (id === "U01.L01" ? "Heartbeat" : null),
    };
    expect(songChipLabel("band.oak.kick", o)).toBe("Kick (Oak)");
    expect(songChipLabel("band.oak.mel", o)).toBe("Tune (Oak)");
    expect(songChipLabel("band.take.U01.L01.drums", o)).toBe("drums (yours, from Heartbeat)");
    expect(songChipLabel("band.take.U01.L04.hats", o)).toBe("hats (yours, from U01.L04)");
    expect(songChipLabel("drums", o)).toBe("drums (today's code)");
    expect(songChipLabel("band.drums", o)).toBe("drums (band)");
  });
});
