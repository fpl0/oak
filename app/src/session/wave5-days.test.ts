// Wave 5 days, as pure models: the optional side lessons on Today and in the Coda (never in place of the core,
// never a debt, counted in track A), three-session capstones (C3) and X2's staged checks, gym days on ladder L5
// and L6, the gym Coda from the session summary (c10: the ladder card, the realism change, the level-up, the
// own-audio card), the album's next track after C3/C4/C5/X2, the evidence behind each new milestone and can-do,
// and the end of the written course moved to after X2 / U12.L01 — with U11.CP offered while U12.L01 is unwritten.
import { describe, expect, test } from "bun:test";
import type {
  CapstoneSessions,
  CourseProgress,
  GymPlan,
  LadderSong,
  SideLessons,
  SyllabusDef,
} from "@oak/api";
import { milestoneById, milestones } from "../../../content/milestones.ts";
import { syllabus } from "../../../content/syllabus.ts";
import { type CapstoneDefLike, capstoneDay, stagedChecksLine } from "./capstone-day.ts";
import { albumCountLine, albumNext } from "./coda-model.ts";
import { courseEdge, edgeLead, mapNextId } from "./edge.ts";
import { DAY, fixtureBootstrap, fixturePlan } from "./fixtures.ts";
import {
  currentSong,
  extraGym,
  gymDay,
  LADDER_LEVELS,
  levelName,
  ownAudioCoda,
  songLine,
  summaryLadderCoda,
} from "./gym-day.ts";
import { evidenceLine, ladderRungs, milestoneEvidence } from "./progress-model.ts";
import { isSideLesson, offerLine, sideLessonPlan, sideLessonsLine, sideOffer } from "./side-lessons.ts";
import { itemTitle } from "./titles.ts";
import { todayView } from "./today-model.ts";

const boot = () => fixtureBootstrap({ day: DAY });
const titles = new Map<string, string>([
  ...syllabus.units.flatMap((u) => u.lessons.map((l) => [l.id as string, l.title] as const)),
  ...syllabus.capstones.map((c) => [c.id as string, c.title] as const),
  ...syllabus.checkpoints.map((c) => [c.id as string, c.title] as const),
]);
const titleOf = (id: string) => itemTitle(id, titles);
const objectiveOf = (id: string) =>
  syllabus.units.flatMap((u) => u.lessons).find((l) => l.id === id)?.objective ?? null;

const sideList = (over: Partial<SideLessons> = {}, statuses: string[] = ["done", "open", "open", "open"]) =>
  ({
    open: true,
    next: "A1.L02",
    items: ["A1.L01", "A1.L02", "A1.L03", "A1.L04"].map((id, i) => ({
      lessonId: id,
      title: titles.get(id) ?? id,
      status: statuses[i],
      estMinutes: 12,
      completedAt: null,
    })),
    ...over,
  }) as SideLessons;

const offered = (placement: "alternative" | "after-core" = "alternative") =>
  ({
    lessonId: "A1.L02",
    title: "Filters & Filter Envelopes",
    estMinutes: 12,
    placement,
    note: "Optional: how a filter shapes a sound (about 12 minutes)",
  }) as NonNullable<Parameters<typeof fixturePlan>[0]>["sideLesson"];

describe("side lessons on Today (wave5.md §5.1, contracts §9.6)", () => {
  test("offered in one calm line beside the core lesson; the primary action stays the core session", () => {
    const plan = fixturePlan({
      mapItemId: "U08.L03" as never,
      title: "Walking Up to It",
      sideLesson: offered(),
    });
    const v = todayView({ plan, boot: boot(), lastEnded: null, titleOf, objectiveOf });
    expect(v.state).toBe("normal");
    expect(v.primary).toEqual({ action: "start", label: "Start session" });
    expect(v.rows.find((r) => r.key === "new")?.detail).toBe("Walking Up to It");
    expect(v.side).toMatchObject({
      lessonId: "A1.L02",
      placement: "alternative",
      name: "Filters",
      resume: false,
    });
    expect(v.side?.line).toBe("Optional: make your loop sound better — Filters, about 12 minutes");
    // Never a debt: no "required", no count of what is left, no "due".
    expect(v.side?.line).not.toMatch(/required|left|due|behind|\d+ of \d+/i);
  });

  test("the server decides: `sideLesson: null` means no offer even when the list has a next lesson", () => {
    const plan = fixturePlan({ sideLesson: null });
    expect(sideOffer(plan, sideList())).toBeNull();
  });

  test("an older server (no field): the same rules over GET /side-lessons", () => {
    const plain = fixturePlan();
    expect(sideOffer(plain, sideList())).toMatchObject({ lessonId: "A1.L02", placement: "alternative" });
    // Before the gate, or with all four taken: nothing.
    expect(sideOffer(plain, sideList({ open: false, next: null }))).toBeNull();
    expect(sideOffer(plain, sideList({ next: null }, ["done", "done", "done", "done"]))).toBeNull();
    // Never on a checkpoint, capstone or light day, never during a return warm-up.
    for (const kind of ["checkpoint", "capstone", "light"] as const)
      expect(sideOffer(fixturePlan({ kind }), sideList())).toBeNull();
    const back = fixturePlan({ returning: { recap: null, offerLoosen: false } });
    expect(sideOffer(back, sideList())).toBeNull();
    // Today's own item is a side lesson: no second offer of one.
    expect(sideOffer(fixturePlan({ mapItemId: "A1.L02" as never }), sideList())).toBeNull();
  });

  test("what it does for the loop is the server's own offer line when the list carries it (one source)", () => {
    const list = sideList();
    const withOffer = {
      ...list,
      items: list.items.map((i) => (i.lessonId === "A1.L02" ? { ...i, offer: "Tame a raw synth bass." } : i)),
    };
    expect(sideOffer(fixturePlan({ sideLesson: offered() }), withOffer)?.detail).toBe(
      "Tame a raw synth bass.",
    );
    expect(sideOffer(fixturePlan(), withOffer)?.detail).toBe("Tame a raw synth bass.");
    // Without it (an older server), the A1 spec's line kept here.
    expect(sideOffer(fixturePlan(), list)?.detail).toBe(
      "Tame a raw synth bass with a filter and give your riff the pluck of a record.",
    );
  });

  test("a side lesson started and left resumes like any lesson, and says so", () => {
    const o = sideOffer(fixturePlan(), sideList({}, ["done", "in_progress", "open", "open"]));
    expect(o?.resume).toBe(true);
    expect(o?.line).toBe("Optional: pick Filters up where you left it, about 12 minutes");
  });

  test("on a checkpoint or capstone day the server's null is kept, and no offer shows", () => {
    const cp = fixturePlan({ kind: "checkpoint", mapItemId: "U09.CP" as never, sideLesson: null });
    const v = todayView({ plan: cp, boot: boot(), lastEnded: null, titleOf, sideLessons: sideList() });
    expect(v.state).toBe("checkpoint");
    expect(v.side).toBeNull();
  });

  test("once today's session is done it reads as one more, after the core", () => {
    const plan = fixturePlan({ mapItemId: "U08.L04" as never, sideLesson: offered("alternative") });
    const v = todayView({
      plan,
      boot: boot(),
      lastEnded: { sessionId: "s1", day: DAY },
      titleOf,
    });
    expect(v.state).toBe("done");
    expect(v.primary).toBeNull();
    expect(v.side?.placement).toBe("after-core");
    // While a session is open, nothing is offered.
    const open = todayView({
      plan,
      boot: boot(),
      lastEnded: null,
      titleOf,
      server: { day: DAY, open: { id: "s2" } as never, doneForToday: false },
    });
    expect(open.state).toBe("in-session");
    expect(open.side).toBeNull();
  });

  test("starting it: a normal lesson session on the A1 item; after the core it has no second warm-up", () => {
    const plan = fixturePlan({ sideLesson: offered() });
    const o = sideOffer(plan, null);
    if (!o) throw new Error("no offer");
    const p = sideLessonPlan(plan, o);
    expect(p).toMatchObject({ kind: "lesson", mapItemId: "A1.L02", title: "Filters", sideLesson: null });
    expect(p.warmup.items.length).toBe(plan.warmup.items.length);
    const after = sideLessonPlan(plan, { ...o, placement: "after-core" });
    expect(after.warmup.items).toEqual([]);
    expect(isSideLesson("A1.L03")).toBe(true);
    expect(isSideLesson("A1.L05")).toBe(false);
    expect(isSideLesson("U08.L01")).toBe(false);
  });

  test("Progress counts it in track A, never as what is left", () => {
    expect(sideLessonsLine({ done: 0, total: 4 }, false)).toBeNull();
    expect(sideLessonsLine({ done: 0, total: 4 }, true)).toBe(
      "Sound side lessons are open: optional, whenever you like.",
    );
    expect(sideLessonsLine({ done: 2, total: 4 }, true)).toBe(
      "Sound side lessons: 2 taken. The others stay optional.",
    );
    expect(sideLessonsLine({ done: 4, total: 4 }, true)).toBe("Sound side lessons: all 4 taken.");
    expect(sideLessonsLine(null, true)).toBeNull();
    // An unknown side lesson falls back to the server's own note.
    expect(offerLine("A2.L01", "Spectra", 14, { serverNote: "Optional: spectra (about 14 minutes)" })).toBe(
      "Optional: spectra (about 14 minutes)",
    );
  });

  test("the edge is never a dead end: a review day still offers the side lesson", () => {
    const plan = fixturePlan({ kind: "review", mapItemId: null, main: null, sideLesson: offered() });
    const edge = { nextId: "U12.L01", nextUnit: { id: "U12", title: "Seventh Chords" }, doneUnit: null };
    const v = todayView({ plan, boot: boot(), lastEnded: null, titleOf, edge, gymOpen: true });
    expect(v.state).toBe("edge");
    expect(v.side?.lessonId).toBe("A1.L02");
  });

  test("Today's New row says what the lesson is for (its objective), so tomorrow looks worth opening", () => {
    const plan = fixturePlan({ mapItemId: "U08.L04" as never, title: "Lock with the Kick" });
    const v = todayView({ plan, boot: boot(), lastEnded: null, titleOf, objectiveOf });
    expect(v.rows.find((r) => r.key === "new")?.sub).toBe(
      "Shared rhythm and syncopated bass; `const` pattern variables.",
    );
  });
});

const C3: CapstoneDefLike = {
  id: "C3",
  title: "C3 Verse–Chorus Demo",
  kind: "compose",
  sessionDefs: [
    { id: "C3.S1", title: "Groove & changes" },
    { id: "C3.S2", title: "Melodies" },
    { id: "C3.S3", title: "Arrange", release: true, review: true },
  ],
};
const X2: CapstoneDefLike = {
  id: "X2",
  title: "X2 Blues Transcription",
  kind: "transcribe",
  sessionDefs: [
    { id: "X2.S1", title: "Bass & changes" },
    { id: "X2.S2", title: "Melody", release: true, review: true },
  ],
};
const at = "2026-11-10T18:00:00.000Z";
type Sess = CapstoneSessions["sessions"][number];
type Check = Sess["checks"][number];
function capSessions(id: string, n: number, over: (i: number) => Partial<Sess>): CapstoneSessions {
  return {
    capstoneId: id,
    current: `${id}.S${n}`,
    sessions: Array.from({ length: n }, (_, i) => ({
      capstoneSessionId: `${id}.S${i + 1}`,
      status: "open" as const,
      sessionId: null,
      draft: null,
      checks: [],
      startedAt: null,
      completedAt: null,
      ...over(i),
    })),
  } as CapstoneSessions;
}
const check = (over: Partial<Check>): Check => ({
  checkId: "bass",
  phrase: [1, 3],
  layer: "bass",
  stage: null,
  open: true,
  score: null,
  passed: false,
  revealed: false,
  attempts: 0,
  lastAt: null,
  after: [],
  ...over,
});
const capPlan = (id: string, title: string) =>
  fixturePlan({ kind: "capstone", mapItemId: id as never, title });

describe("three-session capstones and X2's stages as consecutive New blocks", () => {
  test("C3.S1 → S2 → S3: each its own day, resuming by playing the draft from the top, S3 releases", () => {
    const s1 = capstoneDay(
      capPlan("C3.S1", C3.title),
      C3,
      capSessions("C3", 3, () => ({})),
      null,
    );
    expect(s1).toMatchObject({ index: 1, total: 3, resume: false, releases: false });
    expect(s1?.detail).toBe("C3 Verse–Chorus Demo · session 1 of 3: Groove & changes");
    expect(s1?.lead).toContain("The first of 3 sessions on one piece for your album");
    const draft = { sketchId: "sk_c3", sketchVersion: 4, savedAt: at };
    const s2 = capstoneDay(
      capPlan("C3.S2", C3.title),
      C3,
      capSessions("C3", 3, (i) => (i === 0 ? { status: "completed", draft } : {})),
      null,
    );
    expect(s2).toMatchObject({ index: 2, resume: true, releases: false, draft: { sketchVersion: 4 } });
    expect(s2?.lead).toContain("Your draft plays from the top first");
    expect(s2?.lead).toContain("carries on from where the draft stands");
    const s3 = capstoneDay(
      capPlan("C3.S3", C3.title),
      C3,
      capSessions("C3", 3, (i) =>
        i < 2 ? { status: "completed", draft: { ...draft, sketchVersion: 4 + i * 3 } } : {},
      ),
      null,
    );
    expect(s3).toMatchObject({
      index: 3,
      total: 3,
      resume: true,
      releases: true,
      draft: { sketchVersion: 7 },
    });
    expect(s3?.detail).toBe("C3 Verse–Chorus Demo · session 3 of 3: Arrange");
    expect(s3?.lead).toContain("The last session: finish the piece, then release it to your album.");
    const v = todayView({
      plan: capPlan("C3.S3", C3.title),
      boot: boot(),
      lastEnded: null,
      titleOf,
      capstone: s3,
    });
    expect(v.state).toBe("capstone");
    expect(v.rows.map((r) => r.key)).toEqual(["warmup", "new", "coda"]);
    expect(v.rows[1]?.detail).toBe("C3 Verse–Chorus Demo · session 3 of 3: Arrange · the draft is the Make");
  });

  test("X2: the bass at 0.90, then the changes, then the melody — the staged line says where it stands", () => {
    const bass = check({ checkId: "bass", layer: "bass", passAt: 0.9 });
    const changes = check({
      checkId: "changes",
      layer: "chords",
      after: ["bass"],
      passAt: 0.85,
      open: false,
    });
    const melody = (n: number) =>
      check({
        checkId: `melody-${n}`,
        layer: "melody",
        phrase: n,
        after: ["changes"],
        passAt: 0.85,
        open: false,
      });
    const none = capSessions("X2", 2, (i) => ({
      checks: i === 0 ? [bass, changes] : [melody(1), melody(2)],
    }));
    expect(stagedChecksLine(none, 1)).toBeNull();
    const bassDone = capSessions("X2", 2, (i) => ({
      status: i === 0 ? "in_progress" : "open",
      checks:
        i === 0
          ? [
              { ...bass, passed: true, score: 0.92 },
              { ...changes, open: true },
            ]
          : [melody(1)],
    }));
    expect(stagedChecksLine(bassDone, 1)).toBe("The bass passed at 92%; next, the changes");
    const s1Done = capSessions("X2", 2, (i) => ({
      status: i === 0 ? "completed" : "open",
      draft: i === 0 ? { sketchId: "sk_x2", sketchVersion: 3, savedAt: at } : null,
      checks:
        i === 0
          ? [
              { ...bass, passed: true, score: 0.92 },
              { ...changes, passed: true, score: 0.88 },
            ]
          : [melody(1), melody(2)],
    }));
    const day = capstoneDay(capPlan("X2.S2", X2.title), X2, s1Done, null);
    expect(day).toMatchObject({ index: 2, total: 2, resume: true, releases: true });
    expect(day?.checksLine).toBe(
      "The bass passed at 92%, the changes passed at 88%; next, the melody line by line",
    );
    expect(day?.lead).toContain("Your transcription plays from the top first");
    // A revealed stage earns no evidence and says so.
    const revealed = capSessions("X2", 1, () => ({
      checks: [
        { ...bass, revealed: true },
        { ...changes, open: true },
      ],
    }));
    expect(stagedChecksLine(revealed, 1)).toBe("The bass revealed (no evidence); next, the changes");
  });
});

const song = (over: Partial<LadderSong>): LadderSong => ({
  songId: "shenandoah",
  title: "Shenandoah",
  year: "trad",
  level: 5,
  phrases: [
    [1, 4],
    [5, 8],
    [9, 12],
    [13, 16],
  ],
  status: "open",
  lockedReason: null,
  passedPhrases: [],
  passedStages: [],
  ...over,
});
const gymPlan = (next: GymPlan["next"]): GymPlan => ({
  active: true,
  sinceLast: 4,
  slotDue: true,
  next,
  history: [],
  x1: null,
});

describe("gym days on ladder L5 and L6", () => {
  test("the rungs a learner sets are named in plain words (Wave 6 adds L8, standards; L7 is own audio, never a rung)", () => {
    expect(levelName(5)).toBe("folk songs");
    expect(levelName(6)).toBe("blues");
    expect(levelName(7)).toBe("your own audio");
    expect(levelName(8)).toBe("standards");
    expect(levelName(9)).toBe("standards");
    expect(levelName(0)).toBe("drum loops");
    expect(Object.keys(LADDER_LEVELS)).toEqual(["1", "2", "3", "4", "5", "6", "8"]);
  });

  test("L5: the song under way and the next phrase; graded per phrase at 85%", () => {
    const songs = [
      song({ songId: "aura-lee", title: "Aura Lee" }),
      song({ passedPhrases: [1] }),
      song({ songId: "st-louis", title: "St. Louis Blues", level: 6 }),
    ];
    expect(currentSong(songs, 5)?.title).toBe("Shenandoah");
    expect(currentSong(songs, 4)).toBeNull();
    const plan = fixturePlan({
      kind: "gym",
      mapItemId: "GYM.07" as never,
      title: "Transcription Gym: ladder",
    });
    const g = gymDay(
      plan,
      gymPlan({
        gymId: "GYM.07",
        kind: "ladder",
        ladderLevel: 5,
        realism: 0,
        ownAudioFallback: false,
        transcriptionId: null,
      }),
      null,
      null,
      songs,
    );
    expect(g?.detail).toBe("GYM.07 · Ladder, level 5: folk songs · Shenandoah: phrase 2 of 4 next · R0");
    expect(g?.explain.join(" ")).toContain("Each phrase is graded on its own: 85% or better passes it");
    expect(g?.explain.join(" ")).toContain("a public-domain folk song");
    expect(g?.lead).toContain("a public-domain folk song, written down in code a phrase at a time");
    expect(g?.lead).not.toContain("generated");
  });

  test("L6: three stages in order, the bass at 90%; R2 is the swung feel", () => {
    const blues = song({ songId: "st-louis", title: "St. Louis Blues", level: 6, passedStages: ["bass"] });
    expect(songLine(blues)).toBe("St. Louis Blues: the changes next");
    expect(songLine({ ...blues, passedStages: [] })).toBe("St. Louis Blues, the bass first");
    expect(songLine({ ...blues, passedStages: ["bass", "changes", "melody"] })).toBe(
      "St. Louis Blues: every stage passed",
    );
    const plan = fixturePlan({
      kind: "gym",
      mapItemId: "GYM.13" as never,
      title: "Transcription Gym: ladder",
    });
    const g = gymDay(plan, null, { level: 6, realism: 2 }, null, [blues]);
    expect(g?.detail).toBe("GYM.13 · Ladder, level 6: blues · St. Louis Blues: the changes next · R2");
    expect(g?.explain.join(" ")).toContain("the bass passes at 90%, the changes and the melody at 85%");
    expect(g?.explain.join(" ")).toContain("a swung or shuffled feel");
    // A gym day without the song list (501) still reads plainly.
    expect(gymDay(plan, null, { level: 6, realism: 1 }, null, null)?.detail).toBe(
      "GYM.13 · Ladder, level 6: blues · R1",
    );
  });
});

type SummaryGym = NonNullable<Parameters<typeof summaryLadderCoda>[0]>;
const ladderGym = (over: Partial<NonNullable<SummaryGym["ladder"]>> = {}): SummaryGym => ({
  gymId: "GYM.05",
  kind: "ladder",
  transcriptionId: "tr_1",
  title: "Bass line in E minor",
  ladder: {
    level: 4,
    realism: 2,
    bestScore: 0.91,
    gradedPass: true,
    realismChange: null,
    levelUp: null,
    ...over,
  },
  ownAudio: null,
});

describe("the gym Coda from the session summary (c10)", () => {
  test("the ladder card: today's best, a graded pass, the level-up to L5 with what it holds", () => {
    const c = summaryLadderCoda(
      ladderGym({ levelUp: { to: 5, reason: "Two graded L4 passes at R2 on two days." } }),
    );
    expect(c?.today).toMatchObject({ level: 4, realism: 2, passed: true });
    expect(c?.today?.line).toBe(
      "Level 4, short melodies, at R2: 91% on Bass line in E minor, a graded pass.",
    );
    expect(c?.levelUp).toMatchObject({ from: 4, to: 5, title: "Level 5 is open: folk songs" });
    expect(c?.levelUp?.body).toContain("Two graded L4 passes at R2 on two days.");
    expect(c?.levelUp?.body).toContain("On level 5 you hear a public-domain folk song");
    expect(c?.levelUp?.body).toContain("starts clean, at R0");
    expect(c?.realism).toBeNull();
  });

  test("a realism change is announced once, up or down; the grading never changes", () => {
    const up = summaryLadderCoda(ladderGym({ level: 2, realism: 2, realismChange: { from: 1, to: 2 } }));
    expect(up?.realism).toMatchObject({ from: 1, to: 2 });
    expect(up?.realism?.line).toContain("now plays at R2");
    expect(up?.realism?.line).toContain("The grading stays the same.");
    const down = summaryLadderCoda(
      ladderGym({
        level: 2,
        realism: 0,
        bestScore: 0.5,
        gradedPass: false,
        realismChange: { from: 1, to: 0 },
      }),
    );
    expect(down?.realism?.line).toContain("steps back to R0");
    expect(down?.today?.line).toBe(
      "Level 2, bass lines, at R0: 50% so far on Bass line in E minor. A pass is 85% or better; it waits in Transcribe.",
    );
    const l6 = summaryLadderCoda(ladderGym({ level: 6, bestScore: 0.8, gradedPass: false }));
    expect(l6?.today?.line).toContain("A stage passes at 85% or better, the bass at 90%");
    const nothing = summaryLadderCoda(ladderGym({ bestScore: null, gradedPass: false }));
    expect(nothing?.today?.line).toContain("nothing checked yet");
    expect(summaryLadderCoda(null)).toBeNull();
    expect(summaryLadderCoda({ ...ladderGym(), kind: "own-audio", ladder: null })).toBeNull();
  });

  test("the own-audio card: versions, bars, the checklist as the learner scored it", () => {
    const g: SummaryGym = {
      gymId: "GYM.06",
      kind: "own-audio",
      transcriptionId: "tr_own",
      title: "Kitchen demo",
      ladder: null,
      ownAudio: { checklist: { contour: 2, rhythm: 1, bass: 2 }, versionsToday: 2, regions: 3 },
    };
    const c = ownAudioCoda(g);
    expect(c).toMatchObject({
      title: "Kitchen demo",
      transcriptionId: "tr_own",
      line: "2 versions saved · 3 bars worked on",
    });
    expect(c?.rows.map((r) => [r.id, r.word])).toEqual([
      ["contour", "yes"],
      ["rhythm", "partly"],
      ["bass", "yes"],
    ]);
    expect(c?.verdict).toBe("2 of 5 rows answered yes. It is your own judgement, and it counts.");
    expect(ownAudioCoda({ ...g, ownAudio: { checklist: {}, versionsToday: 0, regions: 0 } })).toMatchObject({
      line: "No version saved today",
      rows: [],
      verdict: null,
    });
    expect(ownAudioCoda(ladderGym())).toBeNull();
  });
});

describe("a capstone release grows the album and names the next track", () => {
  const order = syllabus.defaultOrder as readonly string[];
  const metas = syllabus.capstones;
  const status =
    (released: string[], open: string[] = []) =>
    (id: string) =>
      released.includes(id)
        ? ("released" as const)
        : open.includes(id)
          ? ("open" as const)
          : ("locked" as const);
  const named = (id: string) => (/\.CP\d?$/.test(id) ? `the ${titleOf(id)}` : titleOf(id));

  test("C3 → C4, which opens after the minor checkpoint", () => {
    const n = albumNext("C3", metas, order, status(["C0", "C1", "C2", "X1", "C3"]), named);
    expect(n).toMatchObject({ capstoneId: "C4", open: false, title: "C4 Minor Indie Ballad" });
    expect(n?.line).toBe(
      "An Aeolian verse i–VI–III–VII and a chorus cadence with the major V. It opens after the Minor checkpoint.",
    );
  });

  test("C4 → C5 after the blues checkpoint; C5 → X2, open now", () => {
    expect(albumNext("C4", metas, order, status(["C3", "C4"]), named)?.line).toContain(
      "It opens after the Blues checkpoint.",
    );
    const x2 = albumNext("C5", metas, order, status(["C5"], ["X2"]), named);
    expect(x2).toMatchObject({ capstoneId: "X2", open: true });
    expect(x2?.line).toContain("It is open now.");
    expect(x2?.line).toContain("Today plans it next.");
  });

  test("X2 → the next album track ahead, never an unreleased gap behind", () => {
    const n = albumNext("X2", metas, order, status(["C0", "C1", "C2", "X1", "C3", "C4", "C5", "X2"]), named);
    expect(n?.capstoneId).toMatch(/^C\d+$/);
    expect(n?.capstoneId).not.toBe("C3");
    expect(albumNext("ZZ", metas, order, status([]), named)).toBeNull();
    expect(albumCountLine(8)).toBe("Your album now holds 8 tracks.");
    expect(albumCountLine(1)).toBe("Your album now holds its first track.");
    expect(albumCountLine(0)).toBeNull();
  });
});

const course = (over: Partial<CourseProgress> = {}): CourseProgress => ({
  lessons: [],
  checkpoints: [],
  capstones: [],
  gym: [],
  next: null,
  mapDone: 0,
  mapTotal: 183,
  ...over,
});

describe("/progress: the new milestones and can-dos, each backed by graded evidence", () => {
  const ctx = (c: CourseProgress, passes: Record<string, number> = {}) => ({
    course: c,
    gradedPasses: passes,
    titleOf,
  });

  test("ms.10–ms.14 exist in course order with a condition each", () => {
    const ids = milestones.map((m) => m.id);
    for (const id of ["ms.10", "ms.11", "ms.12", "ms.13", "ms.14"]) expect(ids).toContain(id);
  });

  test("ms.10 a bass line: U08.L05 completed", () => {
    const when = milestoneById.get("ms.10")?.when ?? {};
    const done = milestoneEvidence(
      when,
      ctx(course({ lessons: [{ lessonId: "U08.L05", status: "completed" } as never] })),
    );
    expect(done).toEqual([
      {
        id: "U08.L05",
        kind: "lesson",
        label: "U08.L05 Bass Dictation & Tone",
        met: true,
        detail: "completed",
      },
    ]);
    expect(milestoneEvidence(when, ctx(course()))[0]?.met).toBe(false);
  });

  test("ms.11 C3 and ms.14 X2: released to the album, every check passed", () => {
    const c = course({
      capstones: [
        { capstoneId: "C3", status: "released", sessionsDone: 3, sessionsTotal: 3 } as never,
        { capstoneId: "X2", status: "in_progress", sessionsDone: 1, sessionsTotal: 2 } as never,
      ],
    });
    expect(milestoneEvidence(milestoneById.get("ms.11")?.when ?? {}, ctx(c))[0]).toMatchObject({
      label: "C3 Verse–Chorus Demo",
      met: true,
      detail: "released to your album: every check passed",
    });
    expect(milestoneEvidence(milestoneById.get("ms.14")?.when ?? {}, ctx(c))[0]).toMatchObject({
      met: false,
      detail: "in progress, 1 of 2 sessions",
    });
  });

  test("ms.12 the minor checkpoint passed; ms.05 also needs a graded ladder pass at 5 or higher", () => {
    const c = course({ checkpoints: [{ cpId: "U10.CP", status: "passed" } as never] });
    expect(milestoneEvidence(milestoneById.get("ms.12")?.when ?? {}, ctx(c))[0]).toMatchObject({
      label: "Minor checkpoint",
      met: true,
      detail: "passed, graded without hints",
    });
    const ms05 = milestoneById.get("ms.05")?.when ?? {};
    const without = milestoneEvidence(ms05, ctx(c, { "4": 3 }));
    expect(without.map((e) => e.met)).toEqual([true, false]);
    expect(without[1]?.detail).toBe("a graded pass still to come: 85% or better, nothing revealed");
    const withPass = milestoneEvidence(ms05, ctx(c, { "5": 1, "6": 1 }));
    expect(withPass[1]).toMatchObject({
      met: true,
      detail: "2 graded passes: 85% or better, nothing revealed",
    });
  });

  test("anyOf: the branch that holds is the one listed", () => {
    const when = { anyOf: [{ capstones: ["CF-A"] }, { capstones: ["CF-T"] }] };
    const c = course({
      capstones: [{ capstoneId: "CF-T", status: "released", sessionsDone: 3, sessionsTotal: 3 } as never],
    });
    expect(milestoneEvidence(when, ctx(c)).map((e) => e.id)).toEqual(["CF-T"]);
  });

  test("the ladder rungs grow to L5 and L6 as the learner reaches them", () => {
    expect(ladderRungs({ level: 3, gradedPasses: {} }).length).toBe(4);
    const at4 = ladderRungs({ level: 4, gradedPasses: { "4": 1 } });
    expect(at4.map((r) => r.level)).toEqual([1, 2, 3, 4, 5]);
    expect(at4[4]).toMatchObject({ name: "Folk songs", reached: false });
    // A released X1 counts as an L5 pass (progressReport): the rung and every rung below it are reached.
    const x1 = ladderRungs({ level: 4, gradedPasses: { "5": 1 } });
    expect(x1.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(x1.slice(0, 5).every((r) => r.reached)).toBe(true);
    expect(x1[5]).toMatchObject({
      claim: "You can transcribe a blues: its bass, its changes and its melody.",
      reached: false,
    });
  });

  test("a can-do names where its evidence came from", () => {
    expect(evidenceLine({ evidenceKind: "lesson", evidenceId: "U08.L03" }, titleOf)).toBe(
      "graded work in U08.L03 Walking Up to It",
    );
    expect(evidenceLine({ evidenceKind: "checkpoint", evidenceId: "U10.CP" }, titleOf)).toBe(
      "the Minor checkpoint",
    );
    expect(evidenceLine({ evidenceKind: "track", evidenceId: "C5" }, titleOf)).toBe(
      "your album track C5 12-Bar Shuffle",
    );
    expect(evidenceLine({ evidenceKind: "set", evidenceId: "ds_1" }, titleOf)).toBe("a review set");
  });
});

describe("the end of the written course moves to after X2 / U12.L01", () => {
  const syl = syllabus as unknown as SyllabusDef;
  const order = syllabus.defaultOrder as readonly string[];
  // Written: everything through U11 (the lessons this wave authors), and nothing of U12.
  const authored = new Set(
    syllabus.units
      .filter((u) => /^U(0\d|1[01])$/.test(u.id))
      .flatMap((u) => u.lessons.map((l) => l.id as string)),
  );

  test("the default order puts U12.L01 before GYM.12 and U11.CP", () => {
    const i = order.indexOf("U12.L01");
    expect(i).toBeGreaterThan(order.indexOf("U11.L08"));
    expect(i).toBeLessThan(order.indexOf("U11.CP"));
  });

  test("while U12.L01 is unwritten, U11.CP is offered, not the edge", () => {
    const plan = fixturePlan({ kind: "checkpoint", mapItemId: "U11.CP" as never, title: "Blues checkpoint" });
    expect(courseEdge({ next: "U12.L01" as never }, syl, authored, plan)).toBeNull();
    expect(mapNextId("U12.L01", "U11.CP", authored, order)).toBe("U11.CP");
    const v = todayView({ plan, boot: boot(), lastEnded: null, titleOf });
    expect(v.state).toBe("checkpoint");
    expect(v.primary?.action).toBe("start");
    // GYM.12 in between is a slot, not the map's next item (GYM.11 before Oak 2.0 W2's five core lessons).
    expect(mapNextId("GYM.12", "U11.CP", authored, order)).toBe("U11.CP");
  });

  test("C5 and X2 are planned past the unwritten U12.L01: capstone days, not the edge", () => {
    for (const id of ["C5.S1", "C5.S2", "X2.S1", "X2.S2"]) {
      const plan = capPlan(id, titleOf(id));
      expect(courseEdge({ next: "U12.L01" as never }, syl, authored, plan)).toBeNull();
    }
  });

  test("past X2: a review day with Studio and the gym, and an honest note — never an error or a dead end", () => {
    const plan = fixturePlan({
      kind: "review",
      mapItemId: null,
      title: "Review",
      note: "The next lessons are still being written. Today: a review, then Studio.",
      main: null,
      alternatives: [
        { kind: "studio", mapItemId: null, title: "Studio" },
        { kind: "gym", mapItemId: "GYM.12" as never, title: "Transcription Gym" },
      ],
    });
    const edge = courseEdge({ next: "U12.L01" as never }, syl, authored, plan);
    expect(edge).toMatchObject({ nextId: "U12.L01", nextUnit: { id: "U12", title: "Seventh Chords" } });
    expect(edge?.doneUnit).toMatchObject({ id: "U11", title: "Pentatonic & Blues" });
    // The server may count U12.L01 past (it was skipped while unwritten): the rest of the unit.
    const later = courseEdge({ next: "U12.L02" as never }, syl, authored, plan);
    expect(later?.partial).toBe(true);
    const v = todayView({ plan, boot: boot(), lastEnded: null, titleOf, edge, gymOpen: true });
    expect(v.state).toBe("edge");
    expect(v.primary).toEqual({ action: "start", label: "Start session" });
    expect(v.lead).toContain("through Pentatonic & Blues");
    expect(v.lead).toContain("Seventh Chords, the next unit, is still being written");
    expect(v.lead).toContain("Studio and the Transcription Gym are yours");
    expect(extraGym(plan)).toEqual({ mapItemId: "GYM.12", title: "An extra gym session" });
    if (edge) expect(edgeLead(edge, { gym: true })).not.toMatch(/error|sorry|fail/i);
  });
});

describe("a release names the code it uses by shape, never by the catalog's example", () => {
  test("arguments are dropped and repeats folded", async () => {
    const { codeShape, usedOnRelease } = await import("./coda-model.ts");
    expect(codeShape('.scale("C4:major")')).toBe(".scale()");
    expect(codeShape('n("-1 0 7")')).toBe("n()");
    expect(codeShape('chord("<C Am F G>").voicing()')).toBe("chord().voicing()");
    expect(codeShape(".voicing()")).toBe(".voicing()");
    const used = usedOnRelease(
      ["Natural minor"],
      [
        { id: "tb.n", label: codeShape('n("0 2 4")'), mono: true },
        { id: "tb.n.negative", label: codeShape('n("-1 0 7")'), mono: true },
        { id: "tb.scale", label: codeShape('.scale("C4:major")'), mono: true },
      ],
    );
    expect(used.tools.map((t) => t.label)).toEqual(["n()", ".scale()"]);
  });
});
