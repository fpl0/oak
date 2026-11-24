// The Wave 2 endpoints (docs/design/wave2.md §4) and the dev tools (seed, clock, listen) over HTTP, on the
// fixture course. The multi-day learner loop on the real course is in ../scenario.test.ts.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type {
  CapstoneReleaseResult,
  DevClock,
  DevSeedResult,
  DueBatch,
  LessonProgress,
  LessonSteps,
  ListenMark,
  NextUnlock,
  OnboardingState,
  SessionSummary,
} from "@oak/api";
import { gradeResult, type Harness, harness } from "../testing/harness.ts";

let h: Harness;
beforeEach(async () => {
  h = await harness({ dev: true, now: "2026-11-11T12:00:00.000Z" });
  h.server.deps.repos.profile.patch({ timezone: "UTC" });
});
afterEach(async () => {
  await h.close();
});

const SKETCH = {
  originKind: "lesson-make",
  sessionId: null,
  code: 's("bd ~ sd hh")',
  bpm: 96,
  meter: "4/4",
  key: null,
  analysis: null,
  note: null,
  tutorAssisted: false,
  band: null,
  flags: { lockedTools: [], previewTools: [] },
  ranOk: true,
};

async function sketch(originId: string, originKind = "lesson-make"): Promise<string> {
  const r = await h.json<{ sketch: { id: string } }>("POST", "/api/sketches", {
    ...SKETCH,
    title: "Make",
    originKind,
    originId,
  });
  expect(r.status).toBe(200);
  return r.body.sketch.id;
}

async function attempt(lessonId: string, stepId: string, exerciseId: string, score = 0.95) {
  const r = await h.json<{ state: { passed: boolean } }>(
    "POST",
    `/api/lessons/${lessonId}/steps/${stepId}/attempts`,
    {
      sessionId: null,
      exerciseId,
      exerciseVersion: 1,
      seriesNo: 0,
      params: null,
      response: { code: "x" },
      result: gradeResult({ exerciseId: `${lessonId}/${exerciseId}`, score }),
      extraReplays: 0,
      activeMs: 1000,
      tutorAssisted: false,
    },
  );
  expect(r.status).toBe(200);
  return r.body;
}

async function complete(lessonId: string) {
  const r = await h.json("POST", `/api/lessons/${lessonId}/complete`, {
    sessionId: null,
    sketchId: await sketch(lessonId),
    lessonVersion: 1,
    contentHash: "h",
    splitPart: null,
  });
  expect(r.status).toBe(200);
}

async function passCheckpoint(cpId: string) {
  const start = await h.json<{ attemptNo: number; items: { idx: number }[] }>(
    "POST",
    `/api/checkpoints/${cpId}/start`,
  );
  expect(start.status).toBe(200);
  const r = await h.json<{ passed: boolean }>("POST", `/api/checkpoints/${cpId}/attempts`, {
    sessionId: null,
    attemptNo: start.body.attemptNo,
    items: start.body.items.map((i) => ({
      idx: i.idx,
      score: 1,
      skipped: false,
      response: { code: "" },
      result: null,
    })),
    makeSketchId: null,
    acceptSoftPass: false,
  });
  expect(r.body.passed).toBe(true);
}

describe("onboarding", () => {
  test("starts at welcome, merges steps, and finishing sets onboardedAt", async () => {
    const fresh = await h.json<OnboardingState>("GET", "/api/onboarding");
    expect(fresh.body).toEqual({
      step: "welcome",
      completed: [],
      skipped: [],
      firstEdit: null,
      sketchId: null,
      startedAt: null,
      finishedAt: null,
    });
    const a = await h.json<OnboardingState>("PUT", "/api/onboarding", {
      step: "edit",
      completed: ["welcome", "loop"],
    });
    expect(a.body).toMatchObject({
      step: "edit",
      completed: ["welcome", "loop"],
      startedAt: expect.any(String),
    });
    // Lists merge (a completed step stays completed); a skipped step that is later done leaves `skipped`.
    const b = await h.json<OnboardingState>("PUT", "/api/onboarding", {
      step: "mic",
      completed: ["edit"],
      skipped: ["headphones", "edit"],
      firstEdit: 4,
    });
    expect(b.body).toMatchObject({
      step: "mic",
      completed: ["welcome", "loop", "edit"],
      skipped: ["headphones"],
      firstEdit: 4,
    });
    expect((await h.json("PUT", "/api/onboarding", { sketchId: "sk_nope" })).status).toBe(404);
    expect((await h.json("PUT", "/api/onboarding", { step: "nope" })).status).toBe(400);
    const sk = await sketch("U00.L01");
    const done = await h.json<OnboardingState>("PUT", "/api/onboarding", {
      step: "coda",
      sketchId: sk,
      finished: true,
    });
    expect(done.body.finishedAt).toBe("2026-11-11T12:00:00.000Z");
    const profile = await h.json<{ onboardedAt: string | null }>("GET", "/api/profile");
    expect(profile.body.onboardedAt).toBe("2026-11-11T12:00:00.000Z");
    // A reload resumes at the stored step.
    expect((await h.json<OnboardingState>("GET", "/api/onboarding")).body.step).toBe("coda");
  });
});

describe("profile calibrations", () => {
  test("newest first, filtered by kind", async () => {
    const run = (kind: string, n: number) =>
      h.json("POST", "/api/profile/calibration", { kind, result: { n }, patch: {} });
    await run("tap-latency", 1);
    h.clock.advance(1000);
    await run("noise", 2);
    h.clock.advance(1000);
    await run("tap-latency", 3);
    const all = await h.json<{ items: { kind: string; result: { n: number } }[] }>(
      "GET",
      "/api/profile/calibrations",
    );
    expect(all.body.items.map((c) => c.result.n)).toEqual([3, 2, 1]);
    const taps = await h.json<{ items: { result: { n: number } }[] }>(
      "GET",
      "/api/profile/calibrations?kind=tap-latency",
    );
    expect(taps.body.items.map((c) => c.result.n)).toEqual([3, 1]);
    expect((await h.json("GET", "/api/profile/calibrations?kind=nope")).status).toBe(400);
  });
});

describe("lesson steps and position", () => {
  test("the step rail: null progress before a visit, then per-step state in lesson order", async () => {
    const before = await h.json<LessonSteps>("GET", "/api/lessons/U01.L01/steps");
    expect(before.body.progress).toBeNull();
    expect(before.body.steps.map((s) => s.stepId)).toEqual(["S1", "S2", "S9"]);
    await attempt("U01.L01", "S2", "rest-on-three");
    const after = await h.json<LessonSteps>("GET", "/api/lessons/U01.L01/steps");
    expect(after.body.progress?.status).toBe("in_progress");
    expect(after.body.steps.find((s) => s.stepId === "S2")).toMatchObject({ passed: true, attempts: 1 });
    expect((await h.json("GET", "/api/lessons/U09.L09/steps")).status).toBe(404);
  });

  test("exercise results are per lesson even when two lessons share a slug", async () => {
    // Every fixture lesson's S1 is `count-hits`: U01.L01's result must not show in U01.L02.
    await attempt("U01.L01", "S1", "count-hits", 0.4);
    await complete("U01.L01");
    const l1 = await h.json<{ result: { lessonId: string; bestScore: number } | null }>(
      "GET",
      "/api/lessons/U01.L01/steps/S1",
    );
    expect(l1.body.result).toMatchObject({ lessonId: "U01.L01", bestScore: 0.4 });
    const l2 = await h.json<{ result: unknown }>("GET", "/api/lessons/U01.L02/steps/S1");
    expect(l2.body.result).toBeNull();
    await attempt("U01.L02", "S1", "count-hits", 1);
    const again = await h.json<{ result: { exerciseId: string; bestScore: number } }>(
      "GET",
      "/api/lessons/U01.L01/steps/S1",
    );
    expect(again.body.result).toMatchObject({ exerciseId: "count-hits", bestScore: 0.4 });
  });

  test("'Wrap up' on an ungraded step resumes at that step, not after it", async () => {
    const w = await h.json<LessonProgress>("PUT", "/api/lessons/U01.L01/position", {
      sessionId: null,
      stepId: "S1",
      splitPart: null,
      wrapped: true,
    });
    expect(w.body).toMatchObject({ status: "in_progress", currentStep: "S1" });
    const rail = await h.json<LessonSteps>("GET", "/api/lessons/U01.L01/steps");
    expect(rail.body.steps[0]?.passed).toBe(false);
  });

  test("position records the step; 'Wrap up' resumes at the first unfinished step", async () => {
    const p = await h.json<LessonProgress>("PUT", "/api/lessons/U01.L01/position", {
      sessionId: null,
      stepId: "S2",
      splitPart: null,
      wrapped: false,
    });
    expect(p.body).toMatchObject({ status: "in_progress", currentStep: "S2" });
    // S1 (a predict step, not graded) was passed by visiting it.
    const rail = await h.json<LessonSteps>("GET", "/api/lessons/U01.L01/steps");
    expect(rail.body.steps.map((s) => s.passed)).toEqual([true, false, false]);
    // Wrap up on the graded S2 before passing it: next time resumes at S2.
    const w = await h.json<LessonProgress>("PUT", "/api/lessons/U01.L01/position", {
      sessionId: null,
      stepId: "S2",
      splitPart: null,
      wrapped: true,
    });
    expect(w.body.currentStep).toBe("S2");
    await attempt("U01.L01", "S2", "rest-on-three");
    const w2 = await h.json<LessonProgress>("PUT", "/api/lessons/U01.L01/position", {
      sessionId: null,
      stepId: "S2",
      splitPart: "A",
      wrapped: true,
    });
    expect(w2.body).toMatchObject({ currentStep: "S9", splitPart: "A", status: "in_progress" });
    // A locked lesson has no position; an unknown step is 404.
    expect(
      (
        await h.json("PUT", "/api/lessons/U01.L02/position", {
          sessionId: null,
          stepId: "S1",
          splitPart: null,
          wrapped: false,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await h.json("PUT", "/api/lessons/U01.L01/position", {
          sessionId: null,
          stepId: "S7",
          splitPart: null,
          wrapped: false,
        })
      ).status,
    ).toBe(404);
  });
});

describe("session summary", () => {
  test("409 while the session runs, then the summary end returned", async () => {
    const ses = await h.json<{ id: string }>("POST", "/api/session/start", {
      kind: "lesson",
      mapItemId: "U01.L01",
      targetMinutes: 20,
    });
    expect((await h.json("GET", `/api/session/${ses.body.id}/summary`)).status).toBe(409);
    const end = await h.json<SessionSummary>("POST", `/api/session/${ses.body.id}/end`, {
      wrappedEarly: false,
      phaseMs: { warmup: 60_000, main: 300_000, make: 120_000, coda: 30_000 },
    });
    const again = await h.json<SessionSummary>("GET", `/api/session/${ses.body.id}/summary`);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(end.body);
    expect((await h.json("GET", "/api/session/ses_nope/summary")).status).toBe(404);
  });
});

describe("next unlocks", () => {
  test("nearest first, counting map sessions to the granting session in the default order", async () => {
    const r = await h.json<{ items: NextUnlock[] }>("GET", "/api/unlocks/next");
    expect(r.body.items).toEqual([
      { itemId: "snd.piano", kind: "sound", grantedBy: "U01.L01", remaining: 1, remainingKind: "lesson" },
      { itemId: "tb.mini.rest", kind: "tool", grantedBy: "U01.L01", remaining: 1, remainingKind: "lesson" },
      { itemId: "tb.note", kind: "tool", grantedBy: "U01.L02", remaining: 2, remainingKind: "lesson" },
    ]);
    await complete("U01.L01");
    await complete("U01.L02");
    const next = await h.json<{ items: NextUnlock[] }>("GET", "/api/unlocks/next");
    // tb.lpf is a START row at C0.S1 with its silent fallback at U01.L03 (one lesson away).
    expect(next.body.items[0]).toEqual({
      itemId: "tb.lpf",
      kind: "tool",
      grantedBy: "U01.L03",
      remaining: 1,
      remainingKind: "lesson",
    });
    expect(next.body.items.map((i) => i.itemId)).not.toContain("tb.note");
    expect(next.body.items.some((i) => i.remainingKind === "session")).toBe(true);
  });
});

describe("revive", () => {
  test("an unknown skill is 404; the batch is a subset of today's plan within its budget", async () => {
    expect((await h.json("GET", "/api/skills/revive?skillId=R99")).status).toBe(404);
    const r = await h.json<DueBatch>("GET", "/api/skills/revive");
    expect(r.status).toBe(200);
    const due = await h.json<DueBatch>("GET", "/api/srs/due");
    const ids = new Set(due.body.items.map((i) => i.id));
    for (const i of r.body.items) expect(ids.has(i.id)).toBe(true);
    expect(r.body.plannedSec).toBeLessThanOrEqual(r.body.budgetSec);
    const one = await h.json<DueBatch>("GET", "/api/skills/revive?skillId=R03&more=1");
    expect(one.status).toBe(200);
  });
});

describe("capstone release", () => {
  async function openC0() {
    for (const l of ["U01.L01", "U01.L02", "U01.L03", "U02.L01"]) await complete(l);
    await passCheckpoint("U01.CP");
  }
  const releaseBody = (sketchId: string, title = "Intro") => ({
    sessionId: null,
    sketchId,
    sketchVersion: 1,
    title,
    flavour: null,
    linerNotesMd: "A first beat.",
    theoryTags: ["backbeat"],
    includeReviewNote: true,
  });

  test("locked, unchecked and unfinished capstones are refused; a release makes a track; a revision is v2", async () => {
    const early = await h.json("POST", "/api/capstones/C0/release", releaseBody("sk_x"));
    expect(early.status).toBe(409);
    await openC0();
    const start = await h.json("POST", "/api/session/start", {
      kind: "capstone",
      mapItemId: "C0.S1",
      targetMinutes: 20,
    });
    expect(start.status).toBe(200);
    const sk = await sketch("C0", "capstone");
    // No check yet.
    const noCheck = await h.json<{ error: { message: string } }>(
      "POST",
      "/api/capstones/C0/release",
      releaseBody(sk),
    );
    expect(noCheck.status).toBe(409);
    expect(noCheck.body.error.message).toContain("required rule");
    const check = (score: number) =>
      h.json("POST", "/api/capstones/C0/checks", {
        sessionId: null,
        sketchId: sk,
        sketchVersion: 1,
        result: gradeResult({ exerciseId: "C0/brief", score, mode: "capstone" }),
      });
    await check(0.5);
    expect((await h.json("POST", "/api/capstones/C0/release", releaseBody(sk))).status).toBe(409);
    await check(0.95);
    // C0 has two sessions: with neither done, the release (the last session's work) is refused…
    const tooEarly = await h.json<{ error: { message: string } }>(
      "POST",
      "/api/capstones/C0/release",
      releaseBody(sk),
    );
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.error.message).toContain("C0.S1");
    // …and allowed once only the last session is left; the release completes it.
    await h.json("POST", "/api/capstones/C0/sessions", {
      sessionId: null,
      capstoneSessionId: "C0.S1",
      sketchId: sk,
      flavour: null,
    });
    expect((await h.json("POST", "/api/capstones/C0/release", releaseBody(sk))).status).toBe(200);
    const state = await h.json<{ status: string; sessions: string[]; trackId: string | null }>(
      "GET",
      "/api/capstones/C0",
    );
    expect(state.body.status).toBe("released");
    expect(state.body.sessions).toEqual(["C0.S1", "C0.S2"]);
    expect(state.body.trackId).not.toBeNull();
  });

  test("the release returns the track, unlocks and can-dos; a second release is version 2", async () => {
    await openC0();
    await h.json("POST", "/api/session/start", { kind: "capstone", mapItemId: "C0.S1", targetMinutes: 20 });
    const sk = await sketch("C0", "capstone");
    await h.json("POST", "/api/capstones/C0/checks", {
      sessionId: null,
      sketchId: sk,
      sketchVersion: 1,
      result: gradeResult({ exerciseId: "C0/brief", score: 0.95, mode: "capstone" }),
    });
    await h.json("POST", "/api/capstones/C0/sessions", {
      sessionId: null,
      capstoneSessionId: "C0.S1",
      sketchId: sk,
      flavour: null,
    });
    // Finishing a session does not release.
    expect((await h.json<{ status: string }>("GET", "/api/capstones/C0")).body.status).toBe("in_progress");
    const r = await h.json<CapstoneReleaseResult>("POST", "/api/capstones/C0/release", releaseBody(sk));
    expect(r.status).toBe(200);
    expect(r.body.state).toMatchObject({ status: "released", sessionsDone: 2, trackId: r.body.track.id });
    expect(r.body.track).toMatchObject({
      capstoneId: "C0",
      side: "A",
      trackNo: 1,
      title: "Intro",
      currentVersion: 1,
    });
    expect(r.body.track.versions[0]).toMatchObject({
      linerNotesMd: "A first beat.",
      theoryTags: ["backbeat"],
    });
    expect(r.body.canDo.map((c) => c.candoId)).toContain("cd.compose.first-loop");
    // C1 opens after releasing C0 and U02.L01.
    expect((await h.json<{ status: string }>("GET", "/api/capstones/C1")).body.status).toBe("open");
    // The same release again (a retried request, a second tab) is not a revision: still version 1.
    const again = await h.json<CapstoneReleaseResult>("POST", "/api/capstones/C0/release", releaseBody(sk));
    expect(again.status).toBe(200);
    expect(again.body.track.currentVersion).toBe(1);
    expect(again.body.track.versions).toHaveLength(1);
    expect(again.body.unlocks).toEqual([]);
    // A new version of the draft released is the revision: version 2.
    const { sessionId: _s, originKind: _o, ...versionBody } = SKETCH;
    const sv = await h.json("POST", `/api/sketches/${sk}/versions`, {
      ...versionBody,
      sessionId: null,
      code: 's("bd ~ sd hh, hh*8")',
    });
    expect(sv.status).toBe(200);
    const v2 = await h.json<CapstoneReleaseResult>("POST", "/api/capstones/C0/release", {
      ...releaseBody(sk, "Intro"),
      sketchVersion: 2,
    });
    expect(v2.body.track.currentVersion).toBe(2);
    expect(v2.body.track.id).toBe(r.body.track.id);
    expect(v2.body.canDo).toEqual([]);
    const album = await h.json<{ tracks: { id: string }[] }>("GET", "/api/album");
    expect(album.body.tracks).toHaveLength(1);
  });
});

describe("the grading-problem queue (§11.8)", () => {
  test("a report marks the attempt disputed, removes its evidence, and lands in Settings › Grading reports", async () => {
    const r = await h.json<{ attempt: { id: number }; evidence: { skillId: string }[] }>(
      "POST",
      "/api/lessons/U01.L01/steps/S2/attempts",
      {
        sessionId: null,
        exerciseId: "rest-on-three",
        exerciseVersion: 1,
        seriesNo: 0,
        params: null,
        response: { code: 'drums: s("bd bd ~ bd")' },
        result: gradeResult({ exerciseId: "U01.L01/rest-on-three", score: 0.2 }),
        extraReplays: 0,
        activeMs: 1000,
        tutorAssisted: false,
      },
    );
    expect(r.body.evidence.length).toBeGreaterThan(0);
    const before = h.server.deps.repos.mastery.evidenceOf("R03").length;
    const qa = await h.json<{ id: number; status: string; contentVersion: string | null }>(
      "POST",
      "/api/qa/reports",
      {
        kind: "lesson-step",
        lessonId: "U01.L01",
        stepId: "S2",
        exerciseId: "rest-on-three",
        exerciseVersion: 1,
        familyId: null,
        trialSeed: null,
        params: null,
        response: { code: 'drums: s("bd bd ~ bd")' },
        gradeResult: gradeResult({ exerciseId: "U01.L01/rest-on-three", score: 0.2 }),
        hintRung: 0,
        note: "this is right",
        attemptId: r.body.attempt.id,
      },
    );
    expect(qa.status).toBe(200);
    expect(qa.body.status).toBe("open");
    expect(h.server.deps.repos.lessons.attempt(r.body.attempt.id)?.disputed).toBe(true);
    expect(h.server.deps.repos.mastery.evidenceOf("R03").length).toBe(before - 1);
    const list = await h.json<{ items: { id: number; note: string }[] }>("GET", "/api/qa/reports");
    expect(list.body.items.map((x) => x.note)).toEqual(["this is right"]);
    const triaged = await h.json<{ status: string }>("PATCH", `/api/qa/reports/${qa.body.id}`, {
      status: "fixed",
    });
    expect(triaged.body.status).toBe("fixed");
  });
});

describe("dev tools", () => {
  test("listen verdicts are stored per example and replaced by a newer one", async () => {
    const put = (verdict: string, note: string) =>
      h.json("PUT", "/api/listen/U01.L01@loop-full", { hash: "abc", verdict, note });
    expect((await put("weak", "thin bass")).status).toBe(200);
    h.clock.advance(1000);
    await put("ok", "");
    const list = await h.json<{ items: ListenMark[] }>("GET", "/api/listen");
    expect(list.body.items).toEqual([
      { ref: "U01.L01@loop-full", hash: "abc", verdict: "ok", note: "", at: "2026-11-11T12:00:01.000Z" },
    ]);
    expect((await put("loud", "")).status).toBe(400);
  });

  test("the dev clock moves, freezes and resets; the learner day follows", async () => {
    const c0 = await h.json<DevClock>("GET", "/api/dev/clock");
    expect(c0.body).toMatchObject({
      now: "2026-11-11T12:00:00.000Z",
      day: "2026-11-11",
      offsetMs: 0,
      frozen: false,
    });
    const c1 = await h.json<DevClock>("PUT", "/api/dev/clock", { advanceDays: 2 });
    expect(c1.body).toMatchObject({ day: "2026-11-13", offsetMs: 2 * 86_400_000 });
    const boot = await h.json<{ day: string }>("GET", "/api/bootstrap");
    expect(boot.body.day).toBe("2026-11-13");
    const f = await h.json<DevClock>("PUT", "/api/dev/clock", {
      at: "2026-12-01T09:00:00.000Z",
      freeze: true,
    });
    expect(f.body).toMatchObject({ now: "2026-12-01T09:00:00.000Z", frozen: true });
    h.clock.advance(60_000); // the real clock moves on; a frozen dev clock does not
    expect((await h.json<DevClock>("GET", "/api/dev/clock")).body.now).toBe("2026-12-01T09:00:00.000Z");
    const r = await h.json<DevClock>("PUT", "/api/dev/clock", { reset: true });
    expect(r.body).toMatchObject({ now: "2026-11-11T12:01:00.000Z", offsetMs: 0, frozen: false });
  });

  test("the seeder fast-forwards along the default order, one day per session, ending yesterday", async () => {
    const pts = await h.json<{ items: { point: string }[] }>("GET", "/api/dev/seed");
    expect(pts.body.items.map((p) => p.point)).toContain("C0 ready");
    const r = await h.json<DevSeedResult>("POST", "/api/dev/seed", { point: "after U02.L01" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      done: ["U01.L01", "U01.L02", "U01.L03", "U02.L01"],
      next: "U01.CP",
      day: "2026-11-11",
      lastActiveDay: "2026-11-10",
      gapDays: 0,
    });
    const days = h.server.deps.db.query("SELECT day FROM sessions ORDER BY started_at").all() as {
      day: string;
    }[];
    expect(days.map((d) => d.day)).toEqual(["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"]);
    // The clock is back at the real time.
    expect((await h.json<DevClock>("GET", "/api/dev/clock")).body.now).toBe("2026-11-11T12:00:00.000Z");
    // A second seed starts from scratch.
    const again = await h.json<DevSeedResult>("POST", "/api/dev/seed", { point: "C0 ready" });
    expect(again.body.next).toBe("C0.S1");
    expect((await h.json<{ status: string }>("GET", "/api/capstones/C0")).body.status).toBe("open");
    const gap = await h.json<DevSeedResult>("POST", "/api/dev/seed", { point: "after U01.L02", gapDays: 4 });
    expect(gap.body).toMatchObject({ lastActiveDay: "2026-11-06", gapDays: 4 });
    const fresh = await h.json<DevSeedResult>("POST", "/api/dev/seed", { point: "fresh" });
    expect(fresh.body.done).toEqual([]);
    expect((await h.json<{ onboardedAt: string | null }>("GET", "/api/profile")).body.onboardedAt).toBeNull();
    expect((await h.json("POST", "/api/dev/seed", { point: "after U99.L01" })).status).toBe(400);
    expect((await h.json("POST", "/api/dev/seed", { point: "somewhere" })).status).toBe(400);
  });

  test("dev endpoints do not exist without OAK_DEV; the listening pass, sessions and grading reports do", async () => {
    const prod = await harness();
    try {
      for (const [m, p] of [
        ["GET", "/api/dev/listen"],
        ["GET", "/api/dev/qa"],
        ["GET", "/api/dev/telemetry"],
        ["GET", "/api/dev/clock"],
        ["POST", "/api/dev/seed"],
      ] as const)
        expect((await prod.json(m, p, m === "POST" ? { point: "fresh" } : undefined)).status).toBe(404);
      for (const p of ["/api/listen", "/api/qa/reports", "/api/telemetry"])
        expect([p, (await prod.json("GET", p)).status]).toEqual([p, 200]);
      expect(
        (await prod.json("PUT", "/api/listen/U01.L01@loop-full", { hash: "abc", verdict: "ok", note: "" }))
          .status,
      ).toBe(200);
    } finally {
      await prod.close();
    }
  });
});
