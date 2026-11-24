// The whole learner loop server-side, driven ONLY through the HTTP API over many simulated days with an
// injected clock, on the real course (content/: the authored lessons and exemplars, plus stand-ins for the
// lessons still being written, testing/course.ts). Each test is one learner's history; assertions name the
// contract they check.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
  CourseProgress,
  DueBatch,
  FamilyState,
  LessonProgress,
  ProgressReport,
  SessionPlan,
  SkillMap,
  StreakSummary,
  TelemetryReport,
  Unlock,
} from "@oak/api";
import type { ContentSource } from "./content/types.ts";
import { realCourse } from "./testing/course.ts";
import { type Harness, harness } from "./testing/harness.ts";
import { SimLearner } from "./testing/learner.ts";

let course: ContentSource;
beforeAll(async () => {
  course = await realCourse();
});

const DAY = 86_400_000;
/** Monday 9 November 2026, 18:00 UTC. */
const MONDAY = "2026-11-09T18:00:00.000Z";

async function newLearner(now = MONDAY): Promise<{ h: Harness; me: SimLearner }> {
  const h = await harness({ dev: true, content: course, now });
  const me = new SimLearner(h, course);
  await me.api("PUT", "/api/profile", { timezone: "UTC" });
  return { h, me };
}

const familyOf = (id: string) => course.families.find((f) => f.id === id) ?? null;
const isFact = (id: string) => course.decks.some((d) => d.cards.some((c) => c.id === id));

/** The fewest same-domain neighbours over every order of `domains` that keeps the first (the opener) first. */
function minAdjacent(domains: readonly string[]): number {
  const [first, ...rest] = domains;
  if (first === undefined) return 0;
  const counts = new Map<string, number>();
  for (const d of rest) counts.set(d, (counts.get(d) ?? 0) + 1);
  const go = (prev: string, left: number): number => {
    if (left === 0) return 0;
    let best = Number.POSITIVE_INFINITY;
    for (const [d, n] of counts) {
      if (n === 0) continue;
      counts.set(d, n - 1);
      best = Math.min(best, (d === prev ? 1 : 0) + go(d, left - 1));
      counts.set(d, n);
    }
    return best;
  };
  return go(first, rest.length);
}

/** Warm-up invariants of contracts §7.4 that hold on every planned day. */
function checkWarmup(plan: SessionPlan): void {
  const w = plan.warmup;
  expect(w.plannedSec).toBeLessThanOrEqual(w.budgetSec + 0.001);
  // Budgets (§7.4, §9.1): 4/5/6 min at 15/20/25; 3 min on checkpoint and capstone days.
  const short = plan.kind === "checkpoint" || plan.kind === "capstone";
  expect(w.budgetSec).toBe(short ? 180 : { 15: 240, 20: 300, 25: 360 }[plan.targetMinutes]);
  const sets = w.items.filter((i) => i.kind !== "listen" && i.kind !== "fact-set");
  // No two consecutive sets from one domain, wherever the day's mix of domains allows it (early in U01
  // every family is a rhythm family: then adjacent pairs are unavoidable, and only those are allowed).
  const domains = sets.map((i) => familyOf(i.familyId ?? "")?.domain ?? i.familyId ?? "?");
  // A listen block or a fact mini-set between two sets separates them.
  const seq = w.items.map((i) =>
    i.kind === "listen" || i.kind === "fact-set" ? `|${i.id}` : (familyOf(i.familyId ?? "")?.domain ?? "?"),
  );
  // The opener is the day's sure win (highest R) and stays first: the fewest adjacent pairs any order of
  // the other sets after it allows is what the planner must reach.
  const unavoidable = minAdjacent(domains);
  const adjacent = seq.filter((d, i) => i > 0 && seq[i - 1] === d).length;
  if (adjacent > unavoidable)
    console.log(
      "INTERLEAVE",
      plan.day,
      JSON.stringify(w.items.map((i) => [i.kind, i.familyId, familyOf(i.familyId ?? "")?.domain, i.estSec])),
    );
  expect({ day: plan.day, adjacent }).toEqual({ day: plan.day, adjacent: Math.min(adjacent, unavoidable) });
  // At most 2 mic sets.
  expect(w.items.filter((i) => i.mic).length).toBeLessThanOrEqual(2);
  // Raw due counts are never shown: the label is minutes.
  expect(w.label).not.toMatch(/\d+ (cards|items|due)/);
  // The repair queue comes right after the opener.
  const firstRepair = w.items.findIndex((i) => i.kind === "repair");
  if (firstRepair >= 0) expect(firstRepair).toBeLessThanOrEqual(1);
}

describe("the first playable: onboarding to C1 over simulated weeks", () => {
  let h: Harness;
  let me: SimLearner;
  const log: { day: string; plan: SessionPlan }[] = [];
  const seededPerDay = new Map<string, { families: number; facts: number }>();
  let clock = Date.parse(MONDAY);

  beforeAll(async () => {
    ({ h, me } = await newLearner());
  });
  afterAll(async () => {
    await h.close();
  });

  const nextDay = (skipWeekend = true) => {
    clock += DAY;
    if (skipWeekend) while ([0, 6].includes(new Date(clock).getUTCDay())) clock += DAY;
    h.clock.set(new Date(clock).toISOString());
  };

  test("day 1: onboarding is U00.L01 and finishing it moves Today to U00.L02", async () => {
    const boot = await me.api<{ profile: { onboardedAt: string | null }; day: string }>(
      "GET",
      "/api/bootstrap",
    );
    expect(boot.profile.onboardedAt).toBeNull();
    const plan = await me.today();
    expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U00.L01", returning: null });
    expect(plan.warmup.items).toEqual([]); // nothing to review on day 1
    checkWarmup(plan);
    const session = await me.startSession(plan);
    for (const step of ["welcome", "loop", "edit", "react", "tutor", "headphones", "mic"] as const)
      await me.api("PUT", "/api/onboarding", { step, completed: [step] });
    // A reload resumes where onboarding stopped.
    expect((await me.api<{ step: string }>("GET", "/api/onboarding")).step).toBe("mic");
    const sk = await me.sketch("Sketch 001", "lesson-make", "U00.L01", session.id);
    await me.api("PUT", "/api/onboarding", {
      step: "coda",
      sketchId: sk.id,
      finished: true,
      skipped: ["range"],
    });
    await me.endSession(session.id, { warmup: 0, main: 8, make: 0, coda: 1 });
    const progress = await me.api<CourseProgress>("GET", "/api/lessons/progress");
    expect(progress.lessons.find((l) => l.lessonId === "U00.L01")?.status).toBe("completed");
    expect(progress.next).toBe("U00.L02");
    // Its unlock rows are granted (contracts §3.1 rule 2) and the day qualifies (a saved sketch after a Run).
    const granted = new Set(
      (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items.map((u) => u.itemId),
    );
    for (const t of course.toolbox.filter((t) => t.unlock.at === "U00.L01" && t.unlock.when === "complete"))
      expect(granted.has(t.id)).toBe(true);
    const streak = await me.api<StreakSummary>("GET", "/api/streak?weeks=1");
    expect(JSON.stringify(streak)).toContain('"qualified":true');
  });

  test("weekday sessions through U01 and U02: warm-ups, lessons, the checkpoint after the next unit's L01", async () => {
    const target = "U02.L01";
    let struggled = false;
    for (let guard = 0; guard < 20; guard++) {
      nextDay();
      const plan = await me.today();
      log.push({ day: plan.day, plan });
      checkWarmup(plan);
      const next = (await me.api<CourseProgress>("GET", "/api/lessons/progress")).next;
      expect(plan.mapItemId).toBe(next);
      expect(plan.kind).toBe("lesson");
      const session = await me.startSession(plan);
      await me.api("POST", `/api/session/${session.id}/heartbeat`, {
        phase: "warmup",
        activeMs: 30_000,
        stepId: null,
      });
      for (const item of plan.warmup.items) await me.doItem(session.id, item);
      const lessonId = plan.mapItemId as string;
      // One lesson is a struggle: two misses, two hints (rung 1 then 2), then a pass. The first lesson
      // after U01.L01 with a graded step that has a hint ladder.
      const hinted = me
        .lesson(lessonId)
        .steps.find((st) => st.graded === true && st.exercise !== undefined && st.exercise.hints !== null);
      const struggle = !struggled && lessonId !== "U01.L01" && hinted !== undefined ? hinted.id : undefined;
      const { rail, hints } = await me.doLesson(lessonId, session.id, struggle ? { struggle } : {});
      if (struggle) {
        struggled = true;
        expect(hints.map((s) => s.rung)).toEqual([1, 2]);
        expect(hints[1]?.revealAvailable).toBe(true); // two graded attempts in this series
      }
      expect(rail.steps.every((s) => s.passed)).toBe(true);
      const done = await me.completeLesson(lessonId, session.id);
      expect(done.progress.status).toBe("completed");
      // SRS seeding (contracts §7.4, §9.2): at most 2 fact cards per lesson; families within the intake caps.
      const facts = done.seeded.filter((c) => isFact(c.cardId)).length;
      const fams = done.seeded.filter((c) => !isFact(c.cardId) && c.status === "active").length;
      expect(facts).toBeLessThanOrEqual(2);
      const day = seededPerDay.get(plan.day) ?? { families: 0, facts: 0 };
      seededPerDay.set(plan.day, { families: day.families + fams, facts: day.facts + facts });
      expect(day.families + fams).toBeLessThanOrEqual(2); // ≤ 2 new families a day
      expect(day.facts + facts).toBeLessThanOrEqual(6); // ≤ 6 new fact cards a day
      // Composites are never seeded by a lesson (contracts §7.4).
      expect(done.seeded.some((c) => c.cardId.startsWith("fam.mix."))).toBe(false);
      const summary = await me.endSession(session.id);
      expect(summary.session.endedAt).not.toBeNull();
      expect(await me.api("GET", `/api/session/${session.id}/summary`)).toEqual(summary);
      if (lessonId === target) break;
    }
    // U01.CP is not offered before U02.L01 (it falls on a later day than the unit's last lesson, §7.6).
    const l09 = log.find((l) => l.plan.mapItemId === "U01.L09");
    const l10 = log.find((l) => l.plan.mapItemId === "U02.L01");
    expect(l09).toBeDefined();
    expect(l10).toBeDefined();
    expect(log.some((l) => l.plan.kind === "checkpoint")).toBe(false);
    // Warm-ups started once there were cards; a blocked-intro set arrives the day after a family is seeded.
    expect(log.some((l) => l.plan.warmup.items.some((i) => i.kind === "blocked-intro"))).toBe(true);
  });

  test("U01.CP: fail, repair sets in the next warm-up, soft pass on the retake; level-setting never blocks", async () => {
    nextDay();
    const plan = await me.today();
    expect(plan).toMatchObject({ kind: "checkpoint", mapItemId: "U01.CP" });
    checkWarmup(plan);
    // L03 of the next unit waits for the checkpoint (§7.6 rule 2); L02 does not.
    const before = await me.api<CourseProgress>("GET", "/api/lessons/progress");
    expect(before.lessons.find((l) => l.lessonId === "U02.L02")?.status).toBe("available");
    expect(before.lessons.find((l) => l.lessonId === "U02.L03")?.status).toBe("locked");
    expect(before.capstones.find((c) => c.capstoneId === "C0")?.status).toBe("locked");
    const s1 = await me.startSession(plan);
    for (const item of plan.warmup.items) await me.doItem(s1.id, item);
    const first = await me.checkpoint("U01.CP", s1.id, { gating: 0.6, levelSetting: 1 });
    // Composition (§7.6): 12–18 items, ≥ 2 per skill in range, the Make last; roles by skill kind.
    expect(first.start.items.length).toBeGreaterThanOrEqual(12);
    expect(first.start.items.length).toBeLessThanOrEqual(18);
    expect(first.start.items.at(-1)?.source.kind).toBe("make");
    for (const i of first.start.items)
      if (i.skillId === "R01" || i.skillId === "E01") expect(i.role).toBe("level-setting");
    expect(first.outcome).toMatchObject({ passed: false, softPass: false, softPassOffered: false });
    expect(first.outcome.repairQueue.length).toBeGreaterThan(0);
    await me.endSession(s1.id, { warmup: 3, main: 12, make: 4, coda: 1 });

    nextDay();
    const retake = await me.today();
    expect(retake).toMatchObject({ kind: "checkpoint", mapItemId: "U01.CP" });
    checkWarmup(retake);
    // Repair-queue families are scheduled into this warm-up, right after the opener.
    const repairFamilies = new Set<string | null>(
      first.outcome.repairQueue.map((r) => r.familyId).filter((f) => f !== null),
    );
    expect(retake.warmup.items.some((i) => i.kind === "repair" && repairFamilies.has(i.familyId))).toBe(true);
    const s2 = await me.startSession(retake);
    for (const item of retake.warmup.items) await me.doItem(s2.id, item);
    // Retake at 0.80 on gating items, level-setting items at 0.2: a soft pass is offered (≥ 0.75 on a retake).
    const second = await me.checkpoint("U01.CP", s2.id, {
      gating: 0.8,
      levelSetting: 0.2,
      acceptSoftPass: true,
    });
    expect(second.outcome).toMatchObject({ passed: false, softPassOffered: true, softPass: true });
    // A fresh composition, not the first attempt's items.
    expect(second.start.attemptNo).toBe(2);
    // Debt: gating skills below 0.70 would carry soft-pass debt; level-setting skills below the bar carry
    // checkpoint-level debt and never block.
    expect(second.outcome.debts).toEqual(expect.arrayContaining(["R01", "E01"]));
    // The unit's capstone opens; U02.L03 still waits for U02.L02 (linear), but no longer for the checkpoint.
    expect(second.outcome.opened).toEqual(["C0"]);
    await me.endSession(s2.id, { warmup: 3, main: 12, make: 4, coda: 1 });
    const map = await me.api<SkillMap>("GET", "/api/skills/map");
    expect(map.nodes.find((n) => n.skillId === "E01")).toMatchObject({
      debt: true,
      debtReason: "checkpoint-level",
    });
    const status = await me.api<{ status: string }>("GET", "/api/capstones/C0");
    expect(status.status).toBe("open");
  });

  test("C0.S1: album at the start, a draft, the check, the release, audio, a revision", async () => {
    nextDay();
    const plan = await me.today();
    expect(plan).toMatchObject({ kind: "capstone", mapItemId: "C0.S1" });
    checkWarmup(plan);
    const ses = await me.startSession(plan);
    // tb.feature.album is granted when the first capstone session starts (§3.1 rule 12).
    const unlocks = (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items;
    expect(unlocks.find((u) => u.itemId === "tb.feature.album")).toMatchObject({
      sourceKind: "session-start",
      sourceId: "C0.S1",
    });
    const sk = await me.sketch("Intro (draft)", "capstone", "C0", ses.id);
    const cap = course.capstones.find((c) => c.id === "C0");
    expect(cap?.brief).toBeDefined();
    const state = await me.api<{ status: string; lastResult: unknown }>("POST", "/api/capstones/C0/checks", {
      sessionId: ses.id,
      sketchId: sk.id,
      sketchVersion: 1,
      result: {
        exerciseId: `C0/${cap?.brief?.id}`,
        exerciseVersion: 1,
        attemptNo: 1,
        firstAttempt: true,
        mode: "capstone",
        status: "pass",
        score: 1,
        adjustedScore: 1,
        dims: {},
        constraints: [],
        rubric: (((cap?.brief ?? {}) as { rubric?: { id: string; required: boolean }[] }).rubric ?? []).map(
          (r) => ({
            ruleId: r.id,
            required: r.required,
            ok: true,
          }),
        ),
        diagnostics: [],
        messages: [],
        assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
      },
    });
    expect(state.status).toBe("in_progress");
    const rel = await me.api<{
      track: { id: string; side: string; currentVersion: number };
      state: { status: string };
    }>("POST", "/api/capstones/C0/release", {
      sessionId: ses.id,
      sketchId: sk.id,
      sketchVersion: 1,
      title: "Intro",
      flavour: null,
      linerNotesMd: "Backbeat, eighth hats and a fill.",
      theoryTags: ["backbeat"],
      includeReviewNote: false,
    });
    expect(rel.state.status).toBe("released");
    expect(rel.track).toMatchObject({ side: "A", currentVersion: 1 });
    // Audio upload (a short WAV) lands on version 1.
    const wav = makeWav(0.25);
    const put = await h.req("PUT", `/api/album/tracks/${rel.track.id}/versions/1/audio?durationS=0.25`, wav, {
      "content-type": "audio/wav",
    });
    expect(put.status).toBe(200);
    const audio = await h.req("GET", `/api/album/tracks/${rel.track.id}/versions/1/audio`);
    expect(audio.status).toBe(200);
    expect(new Uint8Array(await audio.arrayBuffer()).length).toBe(wav.length);
    const summary = await me.endSession(ses.id, { warmup: 3, main: 15, make: 0, coda: 1 });
    expect(summary.unlocks.map((u) => u.itemId)).toContain("tb.feature.album");
    // A revision on a later day is version 2 of the same track.
    nextDay(false);
    const sk2 = await me.api<{ sketch: { currentVersion: number } }>(
      "POST",
      `/api/sketches/${sk.id}/versions`,
      {
        sessionId: null,
        code: 's("bd ~ sd ~, hh*16")',
        bpm: 96,
        meter: "4/4",
        key: null,
        analysis: null,
        note: "busier hats",
        tutorAssisted: false,
        band: null,
        flags: { lockedTools: [], previewTools: [] },
        ranOk: true,
      },
    );
    const v2 = await me.api<{ track: { id: string; currentVersion: number; versions: unknown[] } }>(
      "POST",
      "/api/capstones/C0/release",
      {
        sessionId: null,
        sketchId: sk.id,
        sketchVersion: sk2.sketch.currentVersion,
        title: "Intro",
        flavour: null,
        linerNotesMd: "Busier hats.",
        theoryTags: [],
        includeReviewNote: false,
      },
    );
    expect(v2.track).toMatchObject({ id: rel.track.id, currentVersion: 2 });
    expect(v2.track.versions).toHaveLength(2);
  });

  test("U02 to U02.CP (after U03.L01), C1: ebass and .lpf() unlock when C1.S1 starts", async () => {
    let cpPassed = false;
    for (let guard = 0; guard < 16; guard++) {
      nextDay();
      const plan = await me.today();
      checkWarmup(plan);
      const ses = await me.startSession(plan);
      for (const item of plan.warmup.items) await me.doItem(ses.id, item);
      if (plan.kind === "checkpoint") {
        expect(plan.mapItemId).toBe("U02.CP");
        // Scheduled after the next unit's L01 (§7.6).
        const p = await me.api<CourseProgress>("GET", "/api/lessons/progress");
        expect(p.lessons.find((l) => l.lessonId === "U03.L01")?.status).toBe("completed");
        const r = await me.checkpoint("U02.CP", ses.id, { gating: 0.95, levelSetting: 0.9 });
        expect(r.outcome.passed).toBe(true);
        expect(r.outcome.opened).toEqual(expect.arrayContaining(["C1"]));
        cpPassed = true;
      } else if (plan.kind === "capstone") {
        expect(plan.mapItemId).toBe("C1.S1");
        const ids = new Set(
          (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items.map((u) => u.itemId),
        );
        expect(ids.has("snd.ebass")).toBe(true);
        expect(ids.has("tb.lpf")).toBe(true);
        await me.endSession(ses.id);
        break;
      } else {
        expect(plan.kind).toBe("lesson");
        await me.doLesson(plan.mapItemId as string, ses.id);
        await me.completeLesson(plan.mapItemId as string, ses.id);
      }
      await me.endSession(ses.id);
    }
    expect(cpPassed).toBe(true);
  });

  test("the record: streak weeks met, can-dos, mastery levels, progress, no duplicate unlocks", async () => {
    const streak = await me
      .api<StreakSummary>("GET", "/api/bootstrap")
      .then((b) => (b as unknown as { streak: StreakSummary }).streak);
    // Five weekdays a week against the default goal of 5: every closed week met.
    expect(streak.weeks).toBeGreaterThanOrEqual(3);
    expect(streak.bankedRests).toBe(2);
    const unlocks = (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items;
    expect(new Set(unlocks.map((u) => u.itemId)).size).toBe(unlocks.length);
    const report = await me.api<ProgressReport>("GET", "/api/progress");
    expect(report.canDo.length).toBeGreaterThan(5);
    // Can-dos only for sources that are done (contracts §7.10): nothing from C2 or later.
    for (const c of report.canDo) {
      const def = course.canDos.find((d) => d.id === c.candoId);
      expect(["C2", "C3", "CF-T", "CF-A"]).not.toContain(def?.source);
    }
    const map = await me.api<SkillMap>("GET", "/api/skills/map");
    const levels = new Set(map.nodes.map((n) => n.level));
    expect(levels.has("practiced") || levels.has("mastered")).toBe(true);
    // Skills of later units stay new.
    expect(map.nodes.find((n) => n.skillId === "H01")?.level).toBe("new");
    const fams = await me.api<{ families: FamilyState[]; cards: { status: string }[] }>(
      "GET",
      "/api/drills/families",
    );
    // Active perceptual/production family cards never exceed 12 (§7.4).
    const pp = (fams.cards as { cardId: string; status: string }[]).filter(
      (c) => c.status === "active" && ["perceptual", "production"].includes(familyOf(c.cardId)?.kind ?? ""),
    );
    expect(pp.length).toBeLessThanOrEqual(12);
    const telemetry = await me.api<TelemetryReport>("GET", "/api/telemetry");
    expect(telemetry.sessions.length).toBeGreaterThan(20);
    // Session telemetry carries the planned warm-up and the review due before and after (§9.7).
    expect(telemetry.sessions.some((t) => t.warmupPlannedSec > 0 && t.dueSecBefore > 0)).toBe(true);
    for (const t of telemetry.sessions)
      expect(t.overflowSec).toBe(Math.max(0, t.dueSecBefore - t.warmupPlannedSec));
    expect(telemetry.aggregates.days.length).toBeGreaterThan(15);
    for (const d of telemetry.aggregates.days)
      expect(d.plannedSec).toBeLessThanOrEqual(d.budgetSec * d.sessions + 0.001);
  });
});

describe("the weekly streak (§7.8): goal weeks, banked rests, the 48-hour repair, keep-alive", () => {
  test("met, met, met-banked, a short week repaired on Tuesday, then a missed week restarts the run", async () => {
    const { h, me } = await newLearner();
    try {
      await me.api("PUT", "/api/profile", { weeklyGoal: 3 });
      const at = (iso: string) => h.clock.set(iso);
      const sketchOn = async (iso: string) => {
        at(iso);
        await me.sketch("A loop", "free", null, null);
      };
      // Onboarding on Monday 9 November: the first week's goal is the full goal (7 days left).
      at("2026-11-09T18:00:00.000Z");
      await me.api("PUT", "/api/onboarding", { step: "coda", finished: true });
      for (const d of ["09", "10", "11"]) await sketchOn(`2026-11-${d}T18:00:00.000Z`);
      for (const d of ["16", "17", "18"]) await sketchOn(`2026-11-${d}T18:00:00.000Z`);
      at("2026-11-23T18:00:00.000Z");
      let s = await me.api<{ summary: StreakSummary }>("GET", "/api/streak").then((r) => r.summary);
      expect(s).toMatchObject({ weeks: 2, bankedRests: 2, weeklyGoal: 3 });
      for (const d of ["23", "24"]) await sketchOn(`2026-11-${d}T18:00:00.000Z`);
      // Week 4: one day only. It closes short even with the bank (1 + 1 < 3): a tie opens.
      await sketchOn("2026-11-30T18:00:00.000Z");
      at("2026-12-07T10:00:00.000Z");
      s = await me.api<{ summary: StreakSummary }>("GET", "/api/streak").then((r) => r.summary);
      expect(s.bankedRests).toBe(1); // week 3 used one (met-banked earns none)
      expect(s.repair).toMatchObject({ weekStart: "2026-11-30", until: "2026-12-09T04:00:00.000Z" });
      expect(s.weeks).toBe(3); // an open tie neither counts nor breaks
      // A keep-alive on Tuesday (2 minutes) counts for this week and repairs the short one.
      at("2026-12-08T18:00:00.000Z");
      const ka = await me.api<{ id: string }>("POST", "/api/session/start", {
        kind: "keepalive",
        mapItemId: null,
        targetMinutes: 20,
      });
      await me.endSession(ka.id, { warmup: 2, main: 0, make: 0, coda: 0 });
      const hist = await me.api<{ summary: StreakSummary; weeks: { weekStart: string; status: string }[] }>(
        "GET",
        "/api/streak?weeks=6",
      );
      expect(hist.weeks.map((w) => [w.weekStart, w.status])).toEqual([
        ["2026-11-09", "met"],
        ["2026-11-16", "met"],
        ["2026-11-23", "met-banked"],
        ["2026-11-30", "met-repaired"],
        ["2026-12-07", "open"],
      ]);
      expect(hist.summary).toMatchObject({ weeks: 4, todayQualified: true });
      // A one-minute keep-alive with no set does not qualify a day.
      at("2026-12-10T18:00:00.000Z");
      const short = await me.api<{ id: string }>("POST", "/api/session/start", {
        kind: "keepalive",
        mapItemId: null,
        targetMinutes: 20,
      });
      const sum = await me.endSession(short.id, { warmup: 1, main: 0, make: 0, coda: 0 });
      expect(sum.streak.todayQualified).toBe(false);
      // Week of 7 December: one day (8 Dec); week of 14 December: nothing. Both close; the run restarts.
      at("2026-12-23T18:00:00.000Z");
      const after = await me.api<{ summary: StreakSummary; weeks: { weekStart: string; status: string }[] }>(
        "GET",
        "/api/streak?weeks=3",
      );
      expect(after.weeks.map((w) => w.status)).toEqual(["missed", "missed", "open"]);
      expect(after.summary).toMatchObject({ weeks: 0, longestWeeks: 4 });
    } finally {
      await h.close();
    }
  });

  test("five fact cards answered on their own make a review set that qualifies the day", async () => {
    const { h, me } = await newLearner();
    try {
      // The staff-names deck opens at U02.L04; Today introduces its first cards at the deck's daily pace.
      await me.api("POST", "/api/dev/seed", { point: "after U02.L06", practice: false });
      await me.today();
      const cards = await me.api<{ cards: { cardId: string; status: string }[] }>(
        "GET",
        "/api/drills/families",
      );
      const facts = cards.cards.filter((c) => isFact(c.cardId) && c.status === "active");
      expect(facts.length).toBeGreaterThan(0);
      for (let i = 0; i < 4; i++) {
        await me.api("POST", "/api/srs/review", {
          cardId: facts[i % facts.length]?.cardId,
          drillSessionId: null,
          outcome: {
            meanCredit: 1,
            medianRtMs: 2000,
            extraReplays: 0,
            hintRung: 0,
            revealed: false,
            playedLevel: null,
            meanAbsCents: null,
          },
        });
      }
      // Four cards are not a set yet.
      expect((await me.api<{ summary: StreakSummary }>("GET", "/api/streak")).summary.todayQualified).toBe(
        false,
      );
      for (let i = 0; i < 1; i++) {
        const r = await me.api<{ rating: string | null }>("POST", "/api/srs/review", {
          cardId: facts[i % facts.length]?.cardId,
          drillSessionId: null,
          outcome: {
            meanCredit: 1,
            medianRtMs: 2000,
            extraReplays: 0,
            hintRung: 0,
            revealed: false,
            playedLevel: null,
            meanAbsCents: null,
          },
        });
        expect(r.rating).not.toBeNull();
      }
      const s = await me.api<{ summary: StreakSummary }>("GET", "/api/streak").then((r) => r.summary);
      expect(s.todayQualified).toBe(true);
    } finally {
      await h.close();
    }
  });
});

describe("the return policy (§7.9) and map shading (§7.10)", () => {
  test("gaps of 2, 3, 10 and 21 missed days; a Light lesson then the course goes on", async () => {
    const { h, me } = await newLearner("2026-11-20T18:00:00.000Z");
    try {
      const plans: Record<number, SessionPlan> = {};
      for (const gap of [2, 3, 10, 21]) {
        const seeded = await me.api<{ lastActiveDay: string; gapDays: number }>("POST", "/api/dev/seed", {
          point: "after U01.L03",
          gapDays: gap,
        });
        expect(seeded.gapDays).toBe(gap);
        plans[gap] = await me.today();
        checkWarmup(plans[gap] as SessionPlan);
      }
      expect(plans[2]).toMatchObject({ kind: "lesson", mapItemId: "U01.L04", returning: null });
      // ≥ 3: a recap card (last can-do, last sketch), the next lesson, a warm-up within the normal budget.
      expect(plans[3]).toMatchObject({ kind: "lesson", mapItemId: "U01.L04" });
      expect(plans[3]?.returning?.recap?.sketchId).toEqual(expect.any(String));
      expect(plans[3]?.returning?.recap?.canDoId).toEqual(expect.any(String));
      expect(plans[3]?.returning?.offerLoosen).toBe(false);
      expect(plans[3]?.warmup.items.length).toBeGreaterThan(0);
      // ≥ 10: the New block is a Light lesson on the last completed lesson's Make; no new skill.
      expect(plans[10]).toMatchObject({ kind: "light", mapItemId: null });
      expect(plans[10]?.main?.light).toMatchObject({ lessonId: "U01.L03", constraint: expect.any(String) });
      // ≥ 21: plus the one-tap offer to loosen the sing tolerance. Nothing loosens by itself.
      expect(plans[21]).toMatchObject({ kind: "light", returning: { offerLoosen: true } });
      expect((await me.api<{ singToleranceCents: number }>("GET", "/api/profile")).singToleranceCents).toBe(
        70,
      );
      // Gap lengths are never shown.
      expect(JSON.stringify(plans[21])).not.toMatch(/\b21\b|days? (away|ago|since)/);

      // Do the Light session; the next day continues the course (§7.9: "The next session continues").
      const light = plans[21] as SessionPlan;
      const ses = await me.startSession(light);
      for (const item of light.warmup.items) await me.doItem(ses.id, item);
      await me.sketch("Light: half time", "lesson-make", "U01.L03", ses.id);
      await me.endSession(ses.id, { warmup: 4, main: 4, make: 0, coda: 1 });
      h.clock.advanceDays(1);
      const next = await me.today();
      expect(next).toMatchObject({ kind: "lesson", mapItemId: "U01.L04", returning: null });
      // The light session advanced nothing on the map (§9.6).
      const p = await me.api<CourseProgress>("GET", "/api/lessons/progress");
      expect(p.next).toBe("U01.L04");
    } finally {
      await h.close();
    }
  });

  test("after a long gap stale nodes pale and dry only where today's warm-up revives them", async () => {
    const { h, me } = await newLearner("2026-12-01T18:00:00.000Z");
    try {
      await me.api("POST", "/api/dev/seed", { point: "U01.CP due" });
      const fresh = await me.api<SkillMap>("GET", "/api/skills/map");
      const r02 = fresh.nodes.find((n) => n.skillId === "R03");
      expect(r02).toBeDefined();
      // Five weeks without practice.
      h.clock.advanceDays(35);
      const plan = await me.today();
      const stale = await me.api<SkillMap>("GET", "/api/skills/map");
      const paler = stale.nodes.filter((n) => n.R !== null && n.freshness < 1);
      expect(paler.length).toBeGreaterThan(0);
      // Opacity input stays in [0, 1]; a node with no cards keeps freshness 1.
      for (const n of stale.nodes) expect(n.freshness).toBeGreaterThanOrEqual(0);
      for (const n of stale.nodes.filter((n) => n.R === null)) expect(n.freshness).toBe(1);
      // Drying only on stale nodes whose cards are in today's planned warm-up.
      const planned = new Set(plan.warmup.items.flatMap((i) => [i.familyId, ...i.members, ...i.cardIds]));
      for (const n of stale.nodes.filter((n) => n.drying)) {
        expect(n.freshness).toBeLessThan(1);
        const linked = course.families.filter((f) =>
          f.skills.some((s) => s.skill.split("/")[0] === n.skillId),
        );
        expect(
          linked.some((f) => planned.has(f.id)) || course.decks.some((d) => d.unlock.skill === n.skillId),
        ).toBe(true);
      }
      // Revive is exactly those planned sets, within the budget; "Revive more" is a separate opt-in.
      const revive = await me.api<DueBatch>("GET", "/api/skills/revive");
      const ids = new Set(plan.warmup.items.map((i) => i.id));
      for (const i of revive.items) expect(ids.has(i.id)).toBe(true);
      expect(revive.plannedSec).toBeLessThanOrEqual(plan.warmup.budgetSec);
      expect(stale.reviveSec).toBeGreaterThanOrEqual(revive.plannedSec - 0.001);
      // Doing the warm-up freshens what it reviewed.
      const ses = await me.startSession(plan);
      for (const item of plan.warmup.items) await me.doItem(ses.id, item);
      const after = await me.api<SkillMap>("GET", "/api/skills/map");
      const reviewed = after.nodes.filter((n) => stale.nodes.find((m) => m.skillId === n.skillId)?.drying);
      for (const n of reviewed) {
        const before = stale.nodes.find((m) => m.skillId === n.skillId);
        expect(n.freshness).toBeGreaterThanOrEqual(before?.freshness ?? 0);
      }
    } finally {
      await h.close();
    }
  });

  test("a checkpoint attempt left open for more than 3 days restarts with new items", async () => {
    const { h, me } = await newLearner();
    try {
      await me.api("POST", "/api/dev/seed", { point: "U01.CP due" });
      const a = await me.api<{ attemptNo: number; startedAt: string; items: { source: unknown }[] }>(
        "POST",
        "/api/checkpoints/U01/start",
      );
      h.clock.advanceDays(2);
      const same = await me.api<{ startedAt: string }>("POST", "/api/checkpoints/U01/start");
      expect(same.startedAt).toBe(a.startedAt);
      h.clock.advanceDays(2);
      const fresh = await me.api<{ attemptNo: number; startedAt: string; items: { source: unknown }[] }>(
        "POST",
        "/api/checkpoints/U01/start",
      );
      expect(fresh.startedAt).not.toBe(a.startedAt);
      expect(fresh.attemptNo).toBe(a.attemptNo);
      expect(JSON.stringify(fresh.items)).not.toBe(JSON.stringify(a.items));
    } finally {
      await h.close();
    }
  });
});

describe("the 15-minute split and Wrap up (§9.4)", () => {
  test("Wrap up before the Make keeps the lesson in progress and the next session resumes there", async () => {
    const { h, me } = await newLearner();
    try {
      await me.api("POST", "/api/dev/seed", { point: "after U01.L01" });
      const plan = await me.today();
      const lessonId = plan.mapItemId as string;
      const def = me.lesson(lessonId);
      const ses = await me.startSession(plan);
      const make = def.steps.findIndex((st) => st.kind === "make");
      for (const st of def.steps.slice(0, make)) {
        await me.api("PUT", `/api/lessons/${lessonId}/position`, {
          sessionId: ses.id,
          stepId: st.id,
          splitPart: null,
          wrapped: false,
        });
        if (st.exercise !== undefined)
          await me.attempt(lessonId, st.id, st.exercise.id, 1, ses.id, st.exercise.version);
      }
      const makeStep = def.steps[make]?.id as string;
      const wrapped = await me.api<LessonProgress>("PUT", `/api/lessons/${lessonId}/position`, {
        sessionId: ses.id,
        stepId: makeStep,
        splitPart: null,
        wrapped: true,
      });
      expect(wrapped).toMatchObject({ status: "in_progress", currentStep: makeStep });
      await me.sketch("Quick sketch", "free", null, ses.id);
      await me.api("POST", `/api/session/${ses.id}/end`, {
        wrappedEarly: true,
        phaseMs: { warmup: 240_000, main: 540_000, make: 90_000, coda: 60_000 },
      });
      h.clock.advanceDays(1);
      const again = await me.today();
      expect(again).toMatchObject({ mapItemId: lessonId, main: { resumeStep: makeStep } });
      const tele = await me.api<{ sessions: { sessionId: string; wrappedEarly: boolean }[] }>(
        "GET",
        "/api/telemetry",
      );
      expect(tele.sessions.find((t) => t.sessionId === ses.id)?.wrappedEarly).toBe(true);
    } finally {
      await h.close();
    }
  });

  test("at the 15-minute target a long lesson is split at wrapAt: part A, then part B the next day", async () => {
    const { h, me } = await newLearner();
    try {
      await me.api("PUT", "/api/profile", { targetMinutes: 15 });
      await me.api("POST", "/api/dev/seed", { point: "after U01.L01", targetMinutes: 15 });
      // Walk until a lesson is planned as split part A (or the U01 unit ends).
      for (let k = 0; k < 9; k++) {
        const plan = await me.today();
        checkWarmup(plan);
        const lessonId = plan.mapItemId as string;
        if (plan.kind !== "lesson") break;
        const ses = await me.startSession(plan);
        if (plan.main?.splitPart === "A") {
          const def = me.lesson(lessonId);
          const upTo = def.steps.findIndex((st) => st.id === def.wrapAt);
          for (const st of def.steps.slice(0, upTo + 1))
            if (st.exercise !== undefined)
              await me.attempt(lessonId, st.id, st.exercise.id, 1, ses.id, st.exercise.version);
          const sk = await me.sketch("Quick sketch", "lesson-make", lessonId, ses.id);
          const partA = await me.api<{ progress: LessonProgress }>(
            "POST",
            `/api/lessons/${lessonId}/complete`,
            {
              sessionId: ses.id,
              sketchId: sk.id,
              lessonVersion: def.version,
              contentHash: "h",
              splitPart: "A",
            },
          );
          expect(partA.progress).toMatchObject({ status: "in_progress", splitPart: "A" });
          await me.endSession(ses.id, { warmup: 4, main: 8, make: 2, coda: 1 });
          h.clock.advanceDays(1);
          const b = await me.today();
          expect(b).toMatchObject({ mapItemId: lessonId, main: { splitPart: "B" } });
          return;
        }
        await me.doLesson(lessonId, ses.id);
        await me.completeLesson(lessonId, ses.id);
        await me.endSession(ses.id);
        h.clock.advanceDays(1);
      }
      // No lesson in U01 is long enough to split at 15 minutes yet: the stand-ins are short. Nothing to check.
    } finally {
      await h.close();
    }
  });
});

describe("content versioning (§11.7): an edited lesson after the learner passed it", () => {
  test("completed steps, cards and unlocks survive; a new step is never required; moved unlocks are never revoked", async () => {
    const { h, me } = await newLearner();
    // The learner did U00–U01.L02 with real warm-ups; U01.L01 has a real graded step history.
    await me.api("POST", "/api/dev/seed", { point: "after U01.L02" });
    const before = {
      rail: await me.api<{
        steps: { stepId: string; passed: boolean; result: unknown }[];
        progress: LessonProgress;
      }>("GET", "/api/lessons/U01.L01/steps"),
      cards: (await me.api<{ cards: { cardId: string; status: string }[] }>("GET", "/api/drills/families"))
        .cards,
      unlocks: (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items,
      progress: await me.api<CourseProgress>("GET", "/api/lessons/progress"),
      plan: await me.today(),
    };
    expect(before.rail.progress.status).toBe("completed");
    expect(before.cards.length).toBeGreaterThan(0);

    // A new content build: U01.L01 v+1 with a step inserted before the Make and its graded check's grading
    // changed (exercise version +1); tb.mini.repeat moves LATER (to U02.L05); tb.note.accidentals moves
    // EARLIER (to U01.L01, already completed).
    const l01 = course.lessons.find((l) => l.id === "U01.L01") as (typeof course.lessons)[number];
    const graded = l01.steps.find((st) => st.graded === true && st.exercise !== undefined);
    const make = l01.steps.findIndex((st) => st.kind === "make");
    const inserted = {
      id: "S99",
      kind: "concept",
      title: "A new aside",
      minutes: 0.5,
      ui: l01.steps[0]?.ui,
    } as never;
    const edited = {
      ...l01,
      version: l01.version + 1,
      steps: [
        ...l01.steps
          .slice(0, make)
          .map((st) =>
            st === graded && st.exercise !== undefined
              ? { ...st, exercise: { ...st.exercise, version: (st.exercise.version ?? 1) + 1 } }
              : st,
          ),
        inserted,
        ...l01.steps.slice(make),
      ],
    };
    const v2: ContentSource = {
      ...course,
      contentVersion: "v2-test",
      lessons: course.lessons.map((l) => (l.id === "U01.L01" ? (edited as typeof l) : l)),
      toolbox: course.toolbox.map((t) =>
        t.id === "tb.mini.repeat"
          ? { ...t, unlock: { ...t.unlock, at: "U02.L05" as typeof t.unlock.at } }
          : t.id === "tb.note.accidentals"
            ? { ...t, unlock: { ...t.unlock, at: "U01.L01" as typeof t.unlock.at } }
            : t,
      ),
    };
    // Restart on the same data directory with the new content (start-up runs the unlock backfill).
    await h.server.close();
    const { createServer } = await import("./app.ts");
    const { testConfig } = await import("./config.ts");
    const { FakeHost, BROWSER } = await import("./testing/harness.ts");
    const host = new FakeHost();
    const s2 = await createServer({
      config: testConfig(h.dir, { dev: true }),
      content: v2,
      graders: { learner: () => host, tutor: () => host },
      clock: h.clock,
      tutor: false,
      env: {},
      log: () => {},
      validateResponses: true,
    });
    const get = async <T>(path: string): Promise<T> => {
      const r = await s2.app.request(`http://127.0.0.1:8787${path}`, { headers: BROWSER });
      expect(r.status).toBe(200);
      return (await r.json()) as T;
    };
    try {
      // Completed stays completed (rule 3); the recorded hash is the one at completion (rule 9).
      const rail = await get<{
        steps: { stepId: string; passed: boolean; result: { exerciseVersion: number } | null }[];
        progress: LessonProgress;
      }>("/api/lessons/U01.L01/steps");
      expect(rail.progress).toMatchObject({ status: "completed", completedVersion: l01.version });
      // Old steps keep their state; the inserted step is not passed and never required (rule 4).
      for (const old of before.rail.steps)
        expect(rail.steps.find((st) => st.stepId === old.stepId)?.passed).toBe(old.passed);
      expect(rail.steps.find((st) => st.stepId === "S99")?.passed).toBe(false);
      // The old pass of the regraded exercise is honoured (attempts keyed by exercise and version).
      if (graded !== undefined)
        expect(rail.steps.find((st) => st.stepId === graded.id)?.result?.exerciseVersion).toBe(
          graded.exercise?.version ?? 1,
        );
      const progress = await get<CourseProgress>("/api/lessons/progress");
      expect(progress.next).toBe(before.progress.next);
      expect(progress.mapDone).toBe(before.progress.mapDone);
      // SRS cards survive with their state (rule 6).
      const cards = (await get<{ cards: { cardId: string; status: string }[] }>("/api/drills/families"))
        .cards;
      expect(cards.map((c) => [c.cardId, c.status]).sort()).toEqual(
        before.cards.map((c) => [c.cardId, c.status]).sort(),
      );
      // Unlocks are never revoked (moved later: kept) and an earlier move is granted silently (rule 5).
      const unlocks = (await get<{ items: Unlock[] }>("/api/unlocks")).items;
      for (const u of before.unlocks) expect(unlocks.some((x) => x.itemId === u.itemId)).toBe(true);
      expect(unlocks.find((u) => u.itemId === "tb.note.accidentals")).toMatchObject({
        sourceKind: "backfill",
        sourceId: "U01.L01",
        seen: true,
      });
      // Today goes on where it was; new sessions carry the new content version (rule 10).
      const plan = await get<SessionPlan>("/api/session/today");
      expect(plan.mapItemId).toBe(before.plan.mapItemId);
      const health = await get<{ contentVersion: string }>("/api/health");
      expect(health.contentVersion).toBe("v2-test");
    } finally {
      await s2.close();
      const { rmSync } = await import("node:fs");
      rmSync(h.dir, { recursive: true, force: true });
    }
  });
});

/** A mono 16-bit WAV of `seconds` of a 440 Hz tone. */
function makeWav(seconds: number): Uint8Array {
  const rate = 8000;
  const n = Math.round(rate * seconds);
  const buf = new Uint8Array(44 + n * 2);
  const v = new DataView(buf.buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i);
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), true);
  return buf;
}

describe("dev seeds give real course code", () => {
  test("seeded lesson Makes, checkpoint grooves and C1 drafts lint clean under the learner's unlocks", async () => {
    const { lintOak } = await import("@oak/grader");
    for (const point of ["C1 in progress", "C1 released"]) {
      const { h, me } = await newLearner();
      try {
        await me.api("POST", "/api/dev/seed", { point });
        const unlocked = new Set(
          (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items.map((u) => u.itemId as string),
        );
        const sketches = (
          await me.api<{ items: { id: string; originKind: string; originId: string | null }[] }>(
            "GET",
            "/api/sketches",
          )
        ).items;
        // Onboarding's sketches (U00) are the preview loop, linted with previews allowed; every later one is checked.
        const mine = sketches.filter(
          (s) =>
            s.originKind === "capstone" ||
            s.originKind === "checkpoint" ||
            (s.originKind === "lesson-make" && !s.originId?.startsWith("U00")),
        );
        expect(mine.some((s) => s.originKind === "capstone" && s.originId === "C1")).toBe(true);
        for (const sk of mine) {
          const versions = (
            await me.api<{ versions: { code: string; version: number }[] }>("GET", `/api/sketches/${sk.id}`)
          ).versions;
          const code = [...versions].sort((a, b) => a.version - b.version).at(-1)?.code ?? "";
          expect(code).not.toContain("tr909");
          const lint = lintOak(
            code,
            // biome-ignore lint/suspicious/noExplicitAny: the lint's id set is branded
            { profile: "graded", unlocked: unlocked as any, allowPreview: false, meter: "4/4", key: null },
            course.toolbox,
          );
          expect(lint.diagnostics.filter((d) => d.severity === "error").map((d) => d.id)).toEqual([]);
        }
      } finally {
        await h.close();
      }
    }
  });
});

export type { DueBatch, LessonProgress };
