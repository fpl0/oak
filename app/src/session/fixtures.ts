// Fixture plans, sessions, streaks and summaries for the session area's unit tests (not shipped: only *.test.ts
// files import this module).
import type {
  Bootstrap,
  Session,
  SessionPlan,
  SessionSummary,
  StreakDay,
  StreakSummary,
  WarmupItem,
} from "@oak/api";

export const DAY = "2026-11-11";

export const warmItem = (id: string, over: Partial<WarmupItem> = {}): WarmupItem => ({
  id,
  kind: "family-set",
  familyId: null,
  members: [],
  cardIds: [],
  level: 1,
  trials: 6,
  estSec: 90,
  mic: false,
  rated: true,
  ...over,
});

const noWarmup = { budgetSec: 300, plannedSec: 0, items: [], label: "No review today", moreAvailable: false };

export function fixturePlan(over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    day: DAY,
    targetMinutes: 20,
    kind: "lesson",
    mapItemId: "U01.L01",
    title: "Heartbeat",
    note: null,
    warmup: {
      budgetSec: 300,
      plannedSec: 210,
      items: [warmItem("w1", { kind: "anchor" }), warmItem("w2"), warmItem("w3", { kind: "fact-set" })],
      label: "Today's review ≈ 4 min",
      moreAvailable: false,
    },
    main: { resumeStep: null, splitPart: null, light: null, estMinutes: 13 },
    returning: null,
    alternatives: [],
    tutorNote: null,
    ...over,
  };
}

/** Every plan shape Today can receive, by name. */
export const PLANS = {
  lesson: fixturePlan(),
  noWarmup: fixturePlan({ warmup: noWarmup }),
  resume: fixturePlan({ main: { resumeStep: "S4", splitPart: null, light: null, estMinutes: 13 } }),
  splitA: fixturePlan({
    targetMinutes: 15,
    main: { resumeStep: null, splitPart: "A", light: null, estMinutes: 8.5 },
  }),
  splitB: fixturePlan({
    targetMinutes: 15,
    main: { resumeStep: "S5", splitPart: "B", light: null, estMinutes: 9.5 },
  }),
  checkpoint: fixturePlan({
    kind: "checkpoint",
    mapItemId: "U01.CP",
    title: "Checkpoint U01",
    note: null,
    main: { resumeStep: null, splitPart: null, light: null, estMinutes: 16 },
  }),
  checkpoint15: fixturePlan({
    kind: "checkpoint",
    targetMinutes: 15,
    mapItemId: "U01.CP",
    title: "Checkpoint U01",
    note: "Checkpoint day: about 20 minutes",
    main: { resumeStep: null, splitPart: null, light: null, estMinutes: 16 },
  }),
  capstone: fixturePlan({
    kind: "capstone",
    mapItemId: "C0.S1",
    title: "Intro",
    main: { resumeStep: null, splitPart: null, light: null, estMinutes: 15 },
  }),
  gym: fixturePlan({
    kind: "gym",
    mapItemId: "GYM.01",
    title: "Transcription Gym: ladder",
    main: { resumeStep: null, splitPart: null, light: null, estMinutes: 14 },
  }),
  review: fixturePlan({ kind: "review", mapItemId: null, title: "Review", main: null }),
  welcomeBack: fixturePlan({
    returning: { recap: { canDoId: "cd.code.loop", sketchId: "sk_last" }, offerLoosen: false },
  }),
  light: fixturePlan({
    kind: "light",
    mapItemId: null,
    title: "A light session",
    main: {
      resumeStep: null,
      splitPart: null,
      light: { lessonId: "U01.L01", constraint: "Halve the tempo and fill the space." },
      estMinutes: 4,
    },
    returning: { recap: { canDoId: null, sketchId: "sk_last" }, offerLoosen: false },
  }),
  lightLoosen: fixturePlan({
    kind: "light",
    mapItemId: null,
    title: "A light session",
    main: {
      resumeStep: null,
      splitPart: null,
      light: { lessonId: "U01.L01", constraint: "Halve the tempo and fill the space." },
      estMinutes: 4,
    },
    returning: { recap: { canDoId: null, sketchId: null }, offerLoosen: true },
  }),
} satisfies Record<string, SessionPlan>;

export function fixtureSession(over: Partial<Session> = {}): Session {
  return {
    id: "ses_1",
    day: DAY,
    kind: "lesson",
    targetMinutes: 20,
    mapItemId: "U01.L01",
    contentVersion: null,
    startedAt: `${DAY}T09:00:00.000Z`,
    endedAt: null,
    activeMinutes: 0,
    phase: "idle",
    ...over,
  };
}

const dayOf = (day: string, over: Partial<StreakDay> = {}): StreakDay => ({
  day,
  qualified: false,
  source: "rest",
  kinds: [],
  minutes: 0,
  reviewSets: 0,
  sketchSaved: false,
  ...over,
});

/** A week Monday 2026-11-09 … with `qualified` days (0-based weekday indexes up to today, Wednesday). */
export function fixtureStreak(
  over: Partial<StreakSummary> = {},
  qualified: number[] = [0, 1],
): StreakSummary {
  const days = ["2026-11-09", "2026-11-10", "2026-11-11"].map((d, i) =>
    qualified.includes(i)
      ? dayOf(d, { qualified: true, source: "sketch", kinds: ["sketch"], minutes: 18, sketchSaved: true })
      : dayOf(d),
  );
  return {
    weeks: 3,
    longestWeeks: 5,
    weeklyGoal: 5,
    thisWeek: {
      weekStart: "2026-11-09",
      goal: 5,
      qualifyingDays: qualified.length,
      bankedUsed: 0,
      repairedDays: 0,
      status: "open",
      days,
    },
    bankedRests: 1,
    repair: null,
    totalDays: 23,
    currentRunDays: 2,
    todayQualified: qualified.includes(2),
    ...over,
  };
}

export function fixtureBootstrap(over: Partial<Bootstrap> = {}): Bootstrap {
  return {
    health: {
      ok: true,
      appVersion: "0.0.0",
      contractsVersion: "1.9",
      schemaVersion: 1,
      contentVersion: null,
      tutor: "ready",
      tutorBackend: "claude-cli",
      dev: true,
    },
    profile: {
      displayName: null,
      timezone: "Europe/Dublin",
      rolloverHour: 4,
      targetMinutes: 20,
      weeklyGoal: 5,
      flavour: "flavour.pop",
      vocalLowMidi: null,
      vocalHighMidi: null,
      comfortLowMidi: null,
      comfortHighMidi: null,
      singToleranceCents: 50,
      singTolMode: "auto",
      outputLatencyMs: null,
      inputLatencyMs: null,
      singLatencyMs: null,
      tapLatencyMs: null,
      tapJitterMs: null,
      visualOffsetMs: 0,
      outputKind: "wired",
      inputKind: "builtin",
      inputDeviceId: null,
      noiseFloorDb: null,
      quiet: false,
      solfege: "numbers",
      onboardedAt: "2026-10-20T10:00:00.000Z",
      createdAt: "2026-10-20T10:00:00.000Z",
    },
    settings: {
      theme: "paper",
      volume: 0.8,
      clickVolume: 0.6,
      rollLabels: "auto",
      editorFontSize: 15,
      pausedWeeks: [],
      teaserOptIn: false,
      linerNotesInAlbum: true,
      tutor: { backend: "auto", softMonthlyUsd: 25, softWarnedMonth: null },
      backupWithAudio: true,
      lenses: { degrees: true, solfege: true, noteNames: false },
    },
    unlocks: [],
    streak: fixtureStreak(),
    terms: [],
    day: DAY,
    openSession: null,
    ...over,
  };
}

export function fixtureSummary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    session: fixtureSession({ endedAt: `${DAY}T09:21:00.000Z`, phase: "done", activeMinutes: 19 }),
    streak: fixtureStreak({}, [0, 1, 2]),
    sketchesSaved: ["sk_1"],
    canDo: [],
    unlocks: [],
    toleranceChange: null,
    listeningNote: "offer",
    teaser: null,
    ...over,
  };
}
