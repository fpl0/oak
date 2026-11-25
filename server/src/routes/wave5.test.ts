// Wave 5 server behaviour over HTTP (docs/design/wave5.md §5): side lessons (offer, start, complete, accounting,
// unlocks), the song ladder L5/L6 (pool, order of phrases and stages, levels only when offered), X2's check order and
// pass marks, c1 (`checkedVersion`, `draftChangedSinceCheck`), c2 (imported transcription versions run after a strict
// lint and the learner's confirmation), c10 (a gym day's Coda card), c11 (re-recording asks first; own-audio
// checklist evidence once a day), and the tutor ports for the new content.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
  AlbumTrackDetail,
  CapstoneSessions,
  CapstoneState,
  CourseProgress,
  LadderItem,
  LadderSong,
  LadderState,
  SessionPlan,
  SessionSummary,
  SideLessons,
  TranscriptionDetail,
  Unlock,
} from "@oak/api";
import { loadContent } from "../content/loader.ts";
import type { ContentSource } from "../content/types.ts";
import { CONTENT_DIR } from "../testing/course.ts";
import { gradeResult, type Harness, harness } from "../testing/harness.ts";
import { SimLearner } from "../testing/learner.ts";
import { dropSharedSeeds, sharedSeed } from "../testing/seed-cache.ts";
import { withX2 } from "../testing/wave5.ts";
import { referenceAnswers } from "../tutor-adapters/lessons.ts";

let real: ContentSource;
beforeAll(async () => {
  real = withX2(await loadContent({ contentDir: CONTENT_DIR }));
});

const NOW = "2026-11-13T12:00:00.000Z";
afterAll(dropSharedSeeds);
const DAY = 86_400_000;

async function seeded(point: string, content: ContentSource = real, dev = true): Promise<Harness> {
  const h = await harness({ dev, content, now: NOW });
  await h.json("PUT", "/api/profile", { timezone: "UTC" });
  if (point !== "") {
    // A point several tests start from is built once and restored for the others (testing/seed-cache.ts).
    const r = await sharedSeed(h, content, { point });
    if (r.status !== 200) throw new Error(`seed ${point}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return h;
}
async function ok<T>(h: Harness, method: string, path: string, body?: unknown): Promise<T> {
  const r = await h.json<T>(method, path, body);
  if (r.status < 200 || r.status >= 300)
    throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
const nextDay = (h: Harness) => h.clock.set(new Date(h.clock.now().getTime() + DAY).toISOString());

describe("side lessons (contracts §2.6, §9.6; wave5.md §5.1)", () => {
  test("a side lesson picked up part-way offers only the minutes still ahead (wave 5 gate)", async () => {
    const h = await seeded("side lesson offered");
    try {
      const ses = await ok<{ id: string }>(h, "POST", "/api/session/start", {
        kind: "lesson",
        mapItemId: "A1.L01",
        targetMinutes: 20,
      });
      const full = (await ok<SideLessons>(h, "GET", "/api/side-lessons")).items[0]?.estMinutes ?? 0;
      const def = real.lessons.find((l) => l.id === "A1.L01");
      const last = def?.steps.filter((x) => !x.optional).at(-1)?.id ?? "S1";
      await ok(h, "PUT", "/api/lessons/A1.L01/position", {
        sessionId: ses.id,
        stepId: last,
        splitPart: null,
        wrapped: false,
      });
      const item = (await ok<SideLessons>(h, "GET", "/api/side-lessons")).items[0];
      expect(item?.status).toBe("in_progress");
      expect(item?.estMinutes ?? 99).toBeLessThan(full);
    } finally {
      await h.close();
    }
  }, 60_000);

  test("closed before U03.L02; offered beside the core lesson, never as it; one a day; counted in track A", async () => {
    const before = await seeded("C1 released");
    try {
      const side = await ok<SideLessons>(before, "GET", "/api/side-lessons");
      expect(side.open).toBe(false);
      expect(side.items.map((i) => i.status)).toEqual(["locked", "locked", "locked", "locked"]);
      expect((await ok<SessionPlan>(before, "GET", "/api/session/today")).sideLesson).toBeNull();
    } finally {
      await before.close();
    }
    const h = await seeded("side lesson offered");
    try {
      const me = new SimLearner(h, real, 7);
      const plan = await me.today();
      expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U03.L03" });
      expect(plan.sideLesson).toMatchObject({ lessonId: "A1.L01", placement: "alternative", estMinutes: 15 });
      expect(plan.sideLesson?.note).toStartWith("Optional side lesson, about 15 minutes: Waves & Harmonics.");
      const list = await ok<SideLessons>(h, "GET", "/api/side-lessons");
      expect(list).toMatchObject({ open: true, next: "A1.L01" });
      const progress0 = await ok<CourseProgress>(h, "GET", "/api/lessons/progress");
      // The learner takes the chip instead of today's lesson.
      const ses = await ok<{ id: string }>(h, "POST", "/api/session/start", {
        kind: "lesson",
        mapItemId: "A1.L01",
        targetMinutes: 20,
      });
      await me.doLesson("A1.L01", ses.id);
      const done = await me.completeLesson("A1.L01", ses.id);
      expect(done.unlocks.map((u) => u.itemId)).toEqual(expect.arrayContaining(["tb.scope", "tb.partials"]));
      await me.endSession(ses.id);
      const again = await me.today();
      expect(again).toMatchObject({ kind: "lesson", mapItemId: "U03.L03", sideLesson: null });
      expect(again.alternatives.some((a) => a.mapItemId === "A1.L01")).toBe(false);
      const progress1 = await ok<CourseProgress>(h, "GET", "/api/lessons/progress");
      // Wave 7: the map counts track A's side lessons once a track lesson is written (contracts §9.6: 1 in track A).
      // 270: the whole course since Oak 2.0 W2 (content/syllabus.ts SESSION_COUNTS.total; it was 259).
      expect(progress1.mapDone).toBe(progress0.mapDone + (progress0.mapTotal === 270 ? 1 : 0));
      expect(progress1.mapTotal).toBe(progress0.mapTotal);
      expect(progress1.sideLessons).toEqual({ done: 1, total: 4 });
      expect(progress1.next).toBe("U03.L03");
      expect((await ok<{ weeks: unknown }>(h, "GET", "/api/streak")) !== null).toBe(true);
      // Tomorrow: the core lesson, and the next side lesson only once it is written.
      nextDay(h);
      const tomorrow = await me.today();
      expect(tomorrow.mapItemId).toBe("U03.L03");
      const a2 = real.lessons.some((l) => l.id === "A1.L02");
      expect(tomorrow.sideLesson?.lessonId ?? null).toBe(a2 ? "A1.L02" : null);
      // After the day's session ended, the offer becomes "one more".
      if (a2) {
        const core = await me.startSession(tomorrow);
        await me.endSession(core.id);
        expect((await me.today()).sideLesson?.placement).toBe("after-core");
      }
    } finally {
      await h.close();
    }
  }, 120_000);

  test("none on a checkpoint day, none during a return warm-up", async () => {
    const cp = await seeded("U03.CP due");
    try {
      const plan = await ok<SessionPlan>(cp, "GET", "/api/session/today");
      expect(plan.kind).toBe("checkpoint");
      expect(plan.sideLesson).toBeNull();
    } finally {
      await cp.close();
    }
    const h = await seeded("side lesson offered");
    try {
      h.clock.set(new Date(h.clock.now().getTime() + 6 * DAY).toISOString());
      const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
      expect(plan.returning).not.toBeNull();
      expect(plan.sideLesson).toBeNull();
    } finally {
      await h.close();
    }
  }, 120_000);
});

describe("the song ladder L5 and L6 (wave5.md §5.3)", () => {
  test("the pool, phrases in order, a graded pass per song; L6 stages in order; levels only when offered", async () => {
    const h = await seeded("");
    try {
      const songs = (await ok<{ items: LadderSong[] }>(h, "GET", "/api/ladder/songs")).items;
      const l5 = songs.filter((s) => s.level === 5);
      expect(l5.map((s) => s.songId)).toEqual(
        expect.arrayContaining(["song.aura-lee", "song.red-river-valley"]),
      );
      // Dev (OAK_DEV=1) opens keys still being checked, for e2e.
      // A song that waits for a later lesson (Wave 6: Drunken Sailor from U14.L03) stays locked with that reason.
      const later = (id: string) =>
        (real.repertoire ?? []).find((m) => m.id === id)?.availableFrom !== undefined;
      expect(
        l5.filter((s) => !later(s.songId)).every((s) => s.status === "open" && s.lockedReason === null),
      ).toBe(true);
      // L6: the repertoire's blues (Careless Love, St. Louis Blues) once written, else the test rendition.
      const blues = songs.find((s) => s.level === 6 && s.status === "open") as LadderSong;
      expect(blues).toBeDefined();
      expect(blues.phrases.length).toBeGreaterThanOrEqual(3);
      for (const [a, b] of blues.phrases) expect(b - a + 1).toBe(4);
      // L5 is not open at L1.
      expect(
        (await h.json("POST", "/api/ladder/items", { sessionId: null, gymId: null, level: 5 })).status,
      ).toBe(409);
      expect((await h.json("PUT", "/api/ladder", { level: 5 })).status).toBe(409);
      h.server.deps.repos.ladder.saveState(5, 0, h.clock.now().toISOString());
      const item = await ok<LadderItem>(h, "POST", "/api/ladder/items", {
        sessionId: null,
        gymId: null,
        songId: "song.aura-lee",
      });
      expect(item).toMatchObject({
        level: 5,
        stages: null,
        song: { songId: "song.aura-lee", title: "Aura Lee" },
      });
      expect(item.project).not.toHaveProperty("hiddenCode");
      expect(JSON.stringify(item)).not.toContain("answerKey");
      const phrases = item.phrases ?? [];
      expect(phrases.length).toBeGreaterThan(1);
      const sub = (body: Record<string, unknown>) =>
        h.json<{ passed: boolean; gradedPass: boolean }>(
          "POST",
          `/api/ladder/items/${item.itemId}/submissions`,
          {
            sessionId: null,
            code: 'mel: n("0 2 4").scale("C4:major").s("piano")',
            rung: 0,
            ...body,
          },
        );
      expect((await sub({})).status).toBe(400);
      expect((await sub({ phrase: 2 })).status).toBe(409);
      expect((await sub({ stage: "bass", phrase: 1 })).status).toBe(400);
      for (let k = 1; k <= phrases.length; k++) {
        const r = await sub({ phrase: k });
        expect(r.status).toBe(200);
        expect(r.body.gradedPass).toBe(k === phrases.length);
      }
      // Resumed, never duplicated, while unfinished; a finished song is done.
      const after = (await ok<{ items: LadderSong[] }>(h, "GET", "/api/ladder/songs")).items.find(
        (s) => s.songId === "song.aura-lee",
      );
      expect(after).toMatchObject({ status: "done", passedPhrases: phrases.map((_, i) => i + 1) });
      const st = await ok<LadderState>(h, "GET", "/api/ladder");
      expect(st.gradedPasses["5"]).toBe(1);
      expect(st.levelUp).toBeNull();

      // L6: bass, then changes, then the melody line by line.
      h.server.deps.repos.ladder.saveState(6, 0, h.clock.now().toISOString());
      const six = await ok<LadderItem>(h, "POST", "/api/ladder/items", {
        sessionId: null,
        gymId: null,
        songId: blues.songId,
      });
      expect(six).toMatchObject({ level: 6, stages: ["bass", "changes", "melody"], phrases: blues.phrases });
      const sub6 = (body: Record<string, unknown>) =>
        h.json("POST", `/api/ladder/items/${six.itemId}/submissions`, {
          sessionId: null,
          code: 'bass: n("0").scale("G1:major")',
          rung: 0,
          ...body,
        });
      expect((await sub6({ stage: "changes" })).status).toBe(409);
      expect((await sub6({ phrase: 1 })).status).toBe(400);
      expect((await sub6({ stage: "bass" })).status).toBe(200);
      expect((await sub6({ stage: "melody", phrase: 1 })).status).toBe(409);
      expect((await sub6({ stage: "changes" })).status).toBe(200);
      for (let k = 1; k <= blues.phrases.length; k++)
        expect((await sub6({ stage: "melody", phrase: k })).status).toBe(200);
      const done6 = (await ok<{ items: LadderSong[] }>(h, "GET", "/api/ladder/songs")).items.find(
        (s) => s.songId === blues.songId,
      );
      expect(done6).toMatchObject({ status: "done", passedStages: ["bass", "changes", "melody"] });
      // The grader ran each submission as a song-ladder request: L5 lesson mode, L6 capstone mode.
      const modes = h.learner.calls
        .filter((c) => c.op === "grade")
        .map((c) => (c.arg as { ctx: { mode: string; exerciseGlobalId: string } }).ctx);
      expect(
        modes.some((c) => c.mode === "lesson" && c.exerciseGlobalId.startsWith("ladder/lad.5.aura-lee.")),
      ).toBe(true);
      expect(modes.some((c) => c.mode === "capstone" && c.exerciseGlobalId.startsWith("ladder/lad.6."))).toBe(
        true,
      );
    } finally {
      await h.close();
    }
  }, 60_000);

  test("in production a key no human has checked is “Being checked” and cannot be started", async () => {
    const h = await seeded("", real, false);
    try {
      const songs = (await ok<{ items: LadderSong[] }>(h, "GET", "/api/ladder/songs")).items;
      const aura = songs.find((s) => s.songId === "song.aura-lee");
      expect(aura).toMatchObject({ status: "locked", lockedReason: "Being checked" });
      h.server.deps.repos.ladder.saveState(5, 0, h.clock.now().toISOString());
      const r = await h.json("POST", "/api/ladder/items", {
        sessionId: null,
        gymId: null,
        songId: "song.aura-lee",
      });
      expect(r.status).toBe(409);
    } finally {
      await h.close();
    }
  });
});

describe("X2's order and c1 (wave5.md §5.2)", () => {
  test("changes open after the bass passes at 0.90, the melody after the changes; passAt and after are reported", async () => {
    const h = await seeded("X2 open");
    try {
      const me = new SimLearner(h, real, 3);
      const plan = await me.today();
      expect(plan.mapItemId).toBe("X2.S1");
      const ses = await me.startSession(plan);
      const sk = await me.sketch("X2 draft", "capstone", "X2", ses.id);
      let ss = await ok<CapstoneSessions>(h, "POST", "/api/capstones/X2/drafts", {
        capstoneSessionId: "X2.S1",
        sessionId: ses.id,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
      });
      const checks = ss.sessions[0]?.checks ?? [];
      expect(checks.map((c) => [c.checkId, c.open, c.passAt, c.after ?? null])).toEqual([
        ["bass", true, 0.9, null],
        ["changes", false, 0.85, ["bass"]],
      ]);
      const rec = (checkId: string, score: number) =>
        h.json<CapstoneSessions>("POST", `/api/capstones/X2/checks/${checkId}`, {
          capstoneSessionId: "X2.S1",
          stage: null,
          sketchId: sk.id,
          sketchVersion: sk.currentVersion,
          result: gradeResult({ exerciseId: `X2/${checkId}`, score, mode: "capstone" }),
        });
      expect((await rec("changes", 0.95)).status).toBe(409);
      // 0.88 passes the default 0.85 but not the bass's 0.90: the changes stay closed.
      ss = (await rec("bass", 0.88)).body;
      expect(ss.sessions[0]?.checks.map((c) => [c.checkId, c.passed, c.open])).toEqual([
        ["bass", false, true],
        ["changes", false, false],
      ]);
      ss = (await rec("bass", 0.91)).body;
      expect(ss.sessions[0]?.checks[1]).toMatchObject({ checkId: "changes", open: true });
      expect((await rec("changes", 0.86)).status).toBe(200);
      // c1: no rubric check on a transcription; the fields are present and quiet.
      const st = await ok<CapstoneState>(h, "GET", "/api/capstones/X2");
      expect(st).toMatchObject({ checkedVersion: null, draftChangedSinceCheck: false });
    } finally {
      await h.close();
    }
  }, 120_000);

  test.each([
    ["C3", "C3.S2 done"],
    ["C4", "after C4.S1"],
    ["C5", "C5.S1 done"],
  ])(
    "c1 %s: a checked draft edited afterwards says so; release answers 409 until checked again",
    async (cap, point) => {
      const h = await seeded(point);
      try {
        const st0 = await ok<CapstoneState>(h, "GET", `/api/capstones/${cap}`);
        const me = new SimLearner(h, real, 4);
        const plan = await me.today();
        // The release session of the capstone (C3.S3, C4.S2, C5.S2): today's plan.
        expect(plan.mapItemId as string | null).toBe(`${cap}.S${cap === "C3" ? 3 : 2}`);
        const ses = await me.startSession(plan);
        const sketchId = st0.sketchId as string;
        const sk = await ok<{ currentVersion: number; versions: { code: string }[] }>(
          h,
          "GET",
          `/api/sketches/${sketchId}`,
        );
        await ok(h, "POST", `/api/capstones/${cap}/checks`, {
          sessionId: ses.id,
          sketchId,
          sketchVersion: sk.currentVersion,
          result: gradeResult({ exerciseId: `${cap}/brief`, score: 0.95, mode: "capstone" }),
        });
        let st = await ok<CapstoneState>(h, "GET", `/api/capstones/${cap}`);
        expect(st).toMatchObject({
          checkedVersion: { sketchId, sketchVersion: sk.currentVersion },
          draftChangedSinceCheck: false,
        });
        const edited = `${sk.versions.at(-1)?.code}\nperc: s("~ cp ~ cp")`;
        const v = await ok<{ sketch: { currentVersion: number } }>(
          h,
          "POST",
          `/api/sketches/${sketchId}/versions`,
          {
            sessionId: ses.id,
            code: edited,
            bpm: 112,
            meter: "4/4",
            key: null,
            analysis: null,
            note: null,
            tutorAssisted: false,
            band: null,
            flags: { lockedTools: [], previewTools: [] },
            ranOk: true,
          },
        );
        st = await ok<CapstoneState>(h, "GET", `/api/capstones/${cap}`);
        expect(st.draftChangedSinceCheck).toBe(true);
        const rel = await h.json("POST", `/api/capstones/${cap}/release`, {
          sessionId: ses.id,
          sketchId,
          sketchVersion: v.sketch.currentVersion,
          title: "Shuffle",
          flavour: null,
          linerNotesMd: "",
          theoryTags: [],
          includeReviewNote: false,
        });
        expect(rel.status).toBe(409);
      } finally {
        await h.close();
      }
    },
    120_000,
  );
});

describe("carry-overs c2, c10, c11", () => {
  test("c2: an imported transcription version is flagged; confirm lints strictly, refuses the unflagged", async () => {
    const h = await seeded("own-audio project");
    const fresh = await harness({ dev: true, content: real, now: h.clock.now().toISOString() });
    try {
      const own = (
        await ok<{ items: { id: string; sourceKind: string }[] }>(h, "GET", "/api/transcriptions")
      ).items.find((t) => t.sourceKind === "own-audio") as { id: string };
      await ok(h, "POST", `/api/transcriptions/${own.id}/versions`, {
        sessionId: null,
        code: 'melody: n("0 2").scale("G4:major").s("piano")\nfetch("http://example.com")',
        result: null,
        ranOk: true,
      });
      const exp = await h.req("GET", "/api/backup/export");
      const archive = new Uint8Array(await exp.arrayBuffer());
      expect(
        (await fresh.destructive("POST", "/api/backup/import", "backup.import", "*", archive)).status,
      ).toBe(200);
      const t = await ok<TranscriptionDetail>(fresh, "GET", `/api/transcriptions/${own.id}`);
      expect(t.versions.map((v) => v.reviewBeforeRun ?? false)).toEqual([true, true]);
      const confirm = (v: number) =>
        fresh.json<{ error?: { code: string } }>(
          "POST",
          `/api/transcriptions/${own.id}/versions/${v}/confirm`,
          {
            strictLintPassed: true,
          },
        );
      expect((await confirm(2)).status).toBe(400);
      expect((await confirm(1)).status).toBe(200);
      expect((await confirm(1)).status).toBe(409);
      expect((await confirm(9)).status).toBe(404);
      const after = await ok<TranscriptionDetail>(fresh, "GET", `/api/transcriptions/${own.id}`);
      expect(after.versions.map((v) => v.reviewBeforeRun ?? false)).toEqual([false, true]);
      // A version saved after the import is the learner's own typing: no flag.
      const saved = await ok<TranscriptionDetail>(fresh, "POST", `/api/transcriptions/${own.id}/versions`, {
        sessionId: null,
        code: 'melody: n("0 2 4").scale("G4:major").s("piano")',
        result: null,
        ranOk: true,
      });
      expect(saved.versions.at(-1)?.reviewBeforeRun).toBeUndefined();
    } finally {
      await h.close();
      await fresh.close();
    }
  }, 120_000);

  test("c10: a gym day's Coda carries its card (ladder: level, realism, graded pass)", async () => {
    // U09.L03: the day before GYM.05 since Oak 2.0 W2 moved the slots (decision 103; it was U09.L04).
    const h = await seeded("after U09.L03");
    try {
      const me = new SimLearner(h, real, 9);
      const plan = await me.today();
      expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.05" });
      const ses = await me.startSession(plan);
      await me.gymDay(ses.id);
      const summary = await me.endSession(ses.id);
      expect(summary.gym).toMatchObject({ gymId: "GYM.05", kind: "ladder", ownAudio: null });
      expect(summary.gym?.ladder).toMatchObject({ gradedPass: expect.any(Boolean) });
      expect(summary.gym?.ladder?.level).toBeGreaterThanOrEqual(1);
      const again = await ok<SessionSummary>(h, "GET", `/api/session/${ses.id}/summary`);
      expect(again.gym).toEqual(summary.gym);
    } finally {
      await h.close();
    }
  }, 120_000);

  test("c10: the own-audio Coda card; c11: checklist evidence at most once a project a day", async () => {
    const h = await seeded("own-audio project");
    try {
      const me = new SimLearner(h, real, 11);
      const plan = await me.today();
      expect(plan.mapItemId).toBe("GYM.02");
      const own = (
        await ok<{ items: { id: string; sourceKind: string }[] }>(h, "GET", "/api/transcriptions")
      ).items.find((t) => t.sourceKind === "own-audio") as { id: string };
      const ses = await me.startSession(plan);
      await ok(h, "POST", "/api/gym/sessions", {
        sessionId: ses.id,
        kind: "own-audio",
        transcriptionId: own.id,
      });
      const evidence = () =>
        h.server.deps.repos.mastery.allEvidence().filter((e) => e.sourceKind === "self-transcription").length;
      const e0 = evidence();
      await ok(h, "PATCH", `/api/transcriptions/${own.id}`, {
        checklist: { contour: 2, rhythm: 2, landing: 1 },
      });
      const e1 = evidence();
      expect(e1).toBeGreaterThan(e0);
      await ok(h, "PATCH", `/api/transcriptions/${own.id}`, {
        checklist: { contour: 2, rhythm: 2, landing: 2 },
      });
      expect(evidence()).toBe(e1);
      await ok(h, "POST", `/api/transcriptions/${own.id}/versions`, {
        sessionId: ses.id,
        code: 'melody: n("4 4 2 0").scale("G4:major").s("piano")',
        result: null,
        ranOk: true,
      });
      const summary = await me.endSession(ses.id);
      expect(summary.gym).toMatchObject({
        gymId: "GYM.02",
        kind: "own-audio",
        transcriptionId: own.id,
        ladder: null,
        ownAudio: { checklist: { contour: 2, rhythm: 2, landing: 2 }, versionsToday: 1, regions: 2 },
      });
      nextDay(h);
      await ok(h, "PATCH", `/api/transcriptions/${own.id}`, {
        checklist: { contour: 1, rhythm: 2, landing: 2 },
      });
      expect(evidence()).toBeGreaterThan(e1);
    } finally {
      await h.close();
    }
  }, 120_000);

  test("c11 → d20: re-recording an album version adds a take; no nonce is needed and none can delete one", async () => {
    const h = await seeded("C2 released", real);
    try {
      const st = await ok<CapstoneState>(h, "GET", "/api/capstones/C2");
      const track = await ok<AlbumTrackDetail>(h, "GET", `/api/album/tracks/${st.trackId}`);
      expect(track.versions[0]?.hasAudio).toBe(true);
      const bytes = makeWav();
      const path = `/api/album/tracks/${st.trackId}/versions/1/audio`;
      const first = new Uint8Array(await (await h.req("GET", path)).arrayBuffer());
      // d20 (the learner's decision of 2026-11-13): a re-recording is another take, with or without the old nonce.
      const r1 = await h.req("PUT", path, bytes, { "content-type": "audio/wav" });
      expect(r1.status).toBe(200);
      const res = await h.req("POST", "/api/confirm", {
        action: "album.audio.replace",
        target: `${st.trackId}/v1`,
      });
      const { nonce } = (await res.json()) as { nonce: string };
      // A second re-recording (other samples: the same bytes again are a retry of the first, review:robustness).
      const again = makeWav();
      again[again.length - 1] = (again[again.length - 1] ?? 0) ^ 1;
      expect(
        (await h.req("PUT", path, again, { "content-type": "audio/wav", "x-oak-confirm": nonce })).status,
      ).toBe(200);
      const after = await ok<AlbumTrackDetail>(h, "GET", `/api/album/tracks/${st.trackId}`);
      expect(after.versions[0]?.takes?.length).toBe(3);
      expect(after.versions[0]?.currentTake).toBe(3);
      const kept = new Uint8Array(await (await h.req("GET", `${path}?take=1`)).arrayBuffer());
      expect(Buffer.from(kept).equals(Buffer.from(first))).toBe(true);
    } finally {
      await h.close();
    }
  }, 120_000);
});

describe("U08–U11 server-side: checkpoints, capstones, advanced gates (contracts §2.4, §2.6, §7.6)", () => {
  test("U09.CP opens C3 and the A1 track's L05–L07 (unwritten, recorded honestly); A2 and AC1 stay locked", async () => {
    const due = await seeded("U09.CP due");
    try {
      const p = await ok<CourseProgress>(due, "GET", "/api/lessons/progress");
      const status = (id: string) => p.lessons.find((l) => l.lessonId === id)?.status;
      expect(status("A1.L05")).toBe("locked");
      expect(p.capstones.find((c) => c.capstoneId === "C3")?.status).toBe("locked");
      expect(p.capstones.find((c) => c.capstoneId === "C3")?.lockedReason).toBe(
        "Opens after the Bass & form checkpoint.",
      );
    } finally {
      await due.close();
    }
    const open = await seeded("C3 open");
    try {
      const p = await ok<CourseProgress>(open, "GET", "/api/lessons/progress");
      const status = (id: string) => p.lessons.find((l) => l.lessonId === id)?.status;
      // A1.L05 follows the optional side lessons, which can be passed over (contracts §7.6 rule 5).
      expect(status("A1.L05")).toBe("available");
      expect(status("A1.L06")).toBe("locked");
      expect(status("A2.L01")).toBe("locked");
      expect(p.capstones.find((c) => c.capstoneId === "C3")?.status).toBe("open");
      expect(p.capstones.find((c) => c.capstoneId === "AC1")?.status).toBe("locked");
      // The core plan is unchanged: C3.S1 is today's New block, never a track lesson.
      expect((await ok<SessionPlan>(open, "GET", "/api/session/today")).mapItemId).toBe("C3.S1");
      expect(p.next).toBe("C3.S1");
    } finally {
      await open.close();
    }
  }, 120_000);
});

describe("tutor ports for the new content", () => {
  test("a minor lesson's step is in its minor key", async () => {
    const h = await seeded("");
    try {
      const { LessonContextAdapter } = await import("../tutor-adapters/lessons.ts");
      const port = new LessonContextAdapter(h.server.deps.content, h.server.deps.repos);
      const step = await port.step("U10.L01", "S2");
      expect(step?.key).toBe("C minor");
      expect((await port.lesson("U10.L01"))?.key).toBe("C minor");
    } finally {
      await h.close();
    }
  });

  test("the form widget's sections are an answer the guard holds back", () => {
    const ex = {
      kind: "identify",
      id: "form-of-it",
      answer: { ui: "form", sections: 4, vocabulary: "letters", input: "label" },
      correct: { sections: ["A", "B", "A", "B"] },
    };
    expect(referenceAnswers(ex as never)).toEqual(["A B A B"]);
  });

  test("unlocks granted by a side lesson come from the table (tb.lpf's alternative site A1.L02 starts it)", async () => {
    const h = await seeded("side lesson offered");
    try {
      const ids = (await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks")).items.map((u) => u.itemId);
      // C1.S1 started tb.lpf already: A1.L02 teaches it without a ceremony (contracts §3.1 rule 11).
      expect(ids).toContain("tb.lpf");
      expect(ids).not.toContain("tb.scope");
    } finally {
      await h.close();
    }
  }, 60_000);
});

function makeWav(): Uint8Array {
  const n = 8000;
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
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 220 * i) / 8000) * 3000), true);
  return buf;
}
