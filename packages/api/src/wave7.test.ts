// The Wave 7 additions to the contract (docs/design/wave7.md §5): additive, so every Wave 6 body still parses, and
// each new shape accepts the example wave7.md gives and refuses the obvious mistakes.
import { describe, expect, test } from "bun:test";
import { contract, WAVE6_ENDPOINTS, WAVE7_ENDPOINTS } from "./contract.ts";
import {
  ALBUM_SIDES,
  AlbumSchema,
  AlbumSourceSchema,
  AttemptResponseSchema,
  CAPSTONE_SESSION_SOUNDS,
  CapstoneGateSchema,
  CheckpointSubmitSchema,
  COURSE_SESSIONS,
  NextSessionSchema,
  SessionPlanSchema,
  SessionSummarySchema,
  SkillStateSchema,
  TRACK_CAPSTONE_GATES,
  TRACK_CHECKPOINTS,
  TrackFocusSetSchema,
  TrackStateSchema,
  WAVE6_SEED_POINTS,
  WAVE7_SEED_POINTS,
  WholeCourseSchema,
} from "./dto.ts";

const AT = "2026-11-14T10:00:00.000Z";
const next = {
  kind: "lesson",
  mapItemId: "J1.L03",
  title: "The Major ii–V–I",
  goal: "ii7–V7–Imaj7 as one gesture.",
  estMinutes: 20,
  trackId: "J",
  slot: null,
  day: "tomorrow",
} as const;

describe("Wave 7 contract", () => {
  test("the course counts add up to 270 (contracts §2.7, changelog 2.2)", () => {
    expect(COURSE_SESSIONS.core + COURSE_SESSIONS.J + COURSE_SESSIONS.R + COURSE_SESSIONS.A).toBe(
      COURSE_SESSIONS.total,
    );
    expect(COURSE_SESSIONS.total).toBe(270);
  });
  test("track capstone sessions: J 10, R 4, A 6 (contracts §2.7)", () => {
    const by = (t: string) =>
      TRACK_CAPSTONE_GATES.filter((g) => g.trackId === t).reduce((s, g) => s + g.sessions, 0);
    expect([by("J"), by("R"), by("A")]).toEqual([10, 4, 6]);
  });
  test("every track capstone is gated by its track checkpoint or §4.3's lesson; AC2 is three-way", () => {
    const gated = new Set(TRACK_CHECKPOINTS.flatMap((c) => [...c.gates]));
    for (const g of TRACK_CAPSTONE_GATES)
      if (g.capstoneId !== "JC2") expect(gated.has(g.capstoneId)).toBe(true);
    expect(TRACK_CAPSTONE_GATES.find((g) => g.capstoneId === "JC2")?.requires).toEqual(["J4.L04"]);
    expect(TRACK_CAPSTONE_GATES.find((g) => g.capstoneId === "AC2")?.requires).toEqual([
      "A.CP",
      "J3.L04",
      "R1.L05",
    ]);
  });
  test("the album has twenty capstone tracks: twelve on Side A, eight on Side B", () => {
    expect(ALBUM_SIDES.map((s) => s.capstones.length)).toEqual([12, 8]);
    expect(new Set(ALBUM_SIDES[1].capstones)).toEqual(new Set(TRACK_CAPSTONE_GATES.map((g) => g.capstoneId)));
    expect(
      AlbumSchema.safeParse({ tracks: [], sides: [{ side: "B", title: "Side B", released: 0, total: 8 }] })
        .success,
    ).toBe(true);
    expect(AlbumSchema.safeParse({ tracks: [] }).success).toBe(true);
  });
  test("sounds at a capstone session: horns at RC1.S2, choir at AC2.S1", () => {
    expect(CAPSTONE_SESSION_SOUNDS.map((x) => [x.capstoneSessionId, x.sound])).toEqual([
      ["RC1.S2", "snd.horns"],
      ["AC2.S1", "snd.choir"],
    ]);
  });
  test("the focus is the core or one track", () => {
    expect(TrackFocusSetSchema.safeParse({ focus: "R" }).success).toBe(true);
    expect(TrackFocusSetSchema.safeParse({ focus: "core" }).success).toBe(true);
    expect(TrackFocusSetSchema.safeParse({ focus: "X" }).success).toBe(false);
    expect(TrackFocusSetSchema.safeParse({}).success).toBe(false);
  });
  test("the next session (f6) and the plan's track fields parse; older bodies still do", () => {
    expect(NextSessionSchema.safeParse(next).success).toBe(true);
    expect(NextSessionSchema.safeParse({ ...next, day: "next week" }).success).toBe(false);
    const plan = {
      day: "2026-11-14",
      targetMinutes: 20,
      kind: "lesson",
      mapItemId: "J1.L03",
      title: "The Major ii–V–I",
      note: null,
      warmup: { budgetSec: 300, plannedSec: 0, items: [], label: "No review today", moreAvailable: false },
      main: null,
      returning: null,
      alternatives: [],
      tutorNote: null,
    };
    expect(SessionPlanSchema.safeParse(plan).success).toBe(true);
    expect(
      SessionPlanSchema.safeParse({
        ...plan,
        track: { trackId: "J", sessionIndex: 3, sessionsTotal: 34 },
        trackOffers: [
          {
            trackId: "R",
            title: "Advanced Rhythm",
            next: { ...next, trackId: "R", mapItemId: "R1.L01" },
            sessionsDone: 0,
            sessionsTotal: 20,
            note: "Advanced Rhythm · next: R1.L01",
          },
        ],
        focus: "J",
        course: "in-progress",
      }).success,
    ).toBe(true);
  });
  test("a skill's introduction time is optional and nullable (f1)", () => {
    const skill = {
      skillId: "J04",
      P: 0.5,
      R: null,
      D: 0,
      M: 0.25,
      level: "learning",
      debt: false,
      debtReason: null,
      provisional: false,
      paused: false,
      freshness: 1,
      drying: false,
      updatedAt: AT,
    };
    expect(SkillStateSchema.safeParse(skill).success).toBe(true);
    expect(SkillStateSchema.safeParse({ ...skill, introducedAt: AT }).success).toBe(true);
    expect(SkillStateSchema.safeParse({ ...skill, introducedAt: null }).success).toBe(true);
    expect(SkillStateSchema.safeParse({ ...skill, introducedAt: "yesterday" }).success).toBe(false);
  });
  test("a track's next session and its checkpoints and capstones", () => {
    const track = {
      trackId: "J",
      title: "Jazz Harmony",
      status: "open",
      openedAt: AT,
      gates: [],
      sessionsDone: 5,
      sessionsTotal: 34,
      next: null,
      note: "Next: J.CP1.",
      nextSession: { kind: "checkpoint", mapItemId: "J.CP1", title: "Jazz checkpoint 1", estMinutes: 20 },
      focus: true,
      checkpoints: [{ cpId: "J.CP1", status: "open" }],
      capstones: [{ capstoneId: "JC1", status: "locked", lockedReason: "Opens with the J checkpoint 1." }],
    };
    expect(TrackStateSchema.safeParse(track).success).toBe(true);
  });
  test("AC1's tunes open separately; other gates have no tunes", () => {
    const gate = {
      capstoneId: "AC1",
      open: true,
      conditions: [],
      gymSetsToOpen: null,
      message: null,
      tunes: [
        { songId: "song.st-louis-blues", title: "St. Louis Blues", open: true, reason: null },
        {
          songId: "song.sweet-georgia-brown",
          title: "Sweet Georgia Brown",
          open: false,
          reason: "Opens after U15.L05",
        },
      ],
    };
    expect(CapstoneGateSchema.safeParse(gate).success).toBe(true);
  });
  test("the album source for Export (f2)", () => {
    expect(
      AlbumSourceSchema.safeParse({
        trackId: "t1",
        version: 2,
        title: "First Light",
        code: 'mel: n("0 2 4").scale("C4:major").s("piano")',
        band: null,
        key: { tonic: "C", mode: "major" },
        mutes: {},
        fileName: "oak-side-a-03-first-light-v2",
      }).success,
    ).toBe(true);
  });
  test("the whole course and the summary that carries it", () => {
    const whole = {
      stage: "complete",
      completedAt: AT,
      sessionId: "s1",
      sessionsDone: 270,
      sessionsTotal: 270,
      core: "complete",
      tracks: [],
      album: { released: 20, total: 20, latestTrackId: "t20" },
      stats: {
        firstDay: "2026-04-02",
        days: 210,
        sessions: 270,
        activeMinutes: 4800,
        lessons: 175,
        tracksReleased: 20,
        transcriptions: 6,
        sketches: 90,
      },
      canDo: [],
      open: [
        {
          kind: "gym",
          id: null,
          title: "Transcription Gym",
          note: "Ladder L8 on another standard.",
          available: true,
        },
      ],
    };
    expect(WholeCourseSchema.safeParse(whole).success).toBe(true);
    expect(SessionSummarySchema.shape.courseComplete.safeParse(whole).success).toBe(true);
    expect(SessionSummarySchema.shape.next.safeParse(next).success).toBe(true);
    expect(SessionSummarySchema.shape.next.safeParse(undefined).success).toBe(true);
  });
  test("the Wave 7 endpoints are in the contract and new; the seed names are new and unique", () => {
    for (const n of WAVE7_ENDPOINTS) expect(contract[n]).toBeDefined();
    for (const n of WAVE7_ENDPOINTS) expect((WAVE6_ENDPOINTS as readonly string[]).includes(n)).toBe(false);
    expect(new Set(WAVE7_SEED_POINTS).size).toBe(WAVE7_SEED_POINTS.length);
    for (const p of WAVE7_SEED_POINTS)
      expect((WAVE6_SEED_POINTS as readonly string[]).includes(p)).toBe(false);
  });
  test("a two-lane tap answer (R2.L04, R.CP) is a step and checkpoint response; one lane is not", () => {
    const lanes = {
      lanes: [
        [0, 0.5, 1, 1.5],
        [0, 0.333, 0.667, 1, 1.333, 1.667],
      ],
    };
    expect(AttemptResponseSchema.safeParse(lanes).success).toBe(true);
    expect(AttemptResponseSchema.safeParse({ lanes: [[0, 0.5]] }).success).toBe(false);
    expect(AttemptResponseSchema.safeParse({ lanes: [[0], ["x"]] }).success).toBe(false);
    expect(AttemptResponseSchema.safeParse({ lanes: lanes.lanes, taps: [0] }).success).toBe(false);
    const item = { idx: 0, score: 1, skipped: false, response: lanes, result: null };
    const submit = {
      sessionId: null,
      attemptNo: 1,
      items: [item],
      makeSketchId: null,
      acceptSoftPass: false,
    };
    expect(CheckpointSubmitSchema.safeParse(submit).success).toBe(true);
    // Every older response still parses.
    expect(AttemptResponseSchema.safeParse({ taps: [0, 0.5] }).success).toBe(true);
  });
});
