import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  contract,
  ENDPOINT_NAMES,
  WAVE2_ENDPOINTS,
  WAVE3_ENDPOINTS,
  WAVE4_ENDPOINTS,
  WAVE5_ENDPOINTS,
  WAVE6_ENDPOINTS,
  WAVE7_ENDPOINTS,
} from "@oak/api";
import { gradeResult, type Harness, harness } from "../testing/harness.ts";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

const sketchBody = (over: Record<string, unknown> = {}) => ({
  title: "Groove",
  originKind: "free",
  originId: null,
  sessionId: null,
  code: 'setcpm(96/4)\n\ndrums: s("bd ~ sd hh")',
  bpm: 96,
  meter: "4/4",
  key: null,
  analysis: null,
  note: null,
  tutorAssisted: false,
  band: null,
  flags: { lockedTools: [], previewTools: [] },
  ranOk: true,
  ...over,
});

describe("meta", () => {
  test("health reports versions and no tutor when it is not wired", async () => {
    const r = await h.json<{
      ok: boolean;
      schemaVersion: number;
      contentVersion: string;
      tutor: string;
      dev: boolean;
    }>("GET", "/api/health");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.schemaVersion).toBe(10);
    expect(r.body.contentVersion).toBe("fixture-1");
    expect(r.body.tutor).toBe("unreachable");
    expect(r.body.dev).toBe(false);
  });

  test("bootstrap has the profile, settings, day and streak", async () => {
    const r = await h.json<{
      day: string;
      settings: { theme: string };
      profile: { targetMinutes: number };
      openSession: null;
    }>("GET", "/api/bootstrap");
    expect(r.status).toBe(200);
    expect(r.body.settings.theme).toBe("paper");
    expect(r.body.profile.targetMinutes).toBe(20);
    expect(r.body.openSession).toBeNull();
  });

  test("settings.put validates the value against its key", async () => {
    expect((await h.json("PUT", "/api/settings/volume", { value: 2 })).status).toBe(400);
    const ok = await h.json<{ volume: number }>("PUT", "/api/settings/volume", { value: 0.5 });
    expect(ok.status).toBe(200);
    expect(ok.body.volume).toBe(0.5);
    expect((await h.json("PUT", "/api/settings/nope", { value: 1 })).status).toBe(400);
  });

  test("profile put rejects an unknown time zone and keeps the rest", async () => {
    expect((await h.json("PUT", "/api/profile", { timezone: "Mars/Olympus" })).status).toBe(400);
    const r = await h.json<{ weeklyGoal: number; quiet: boolean }>("PUT", "/api/profile", {
      weeklyGoal: 4,
      quiet: true,
    });
    expect(r.body.weeklyGoal).toBe(4);
    expect(r.body.quiet).toBe(true);
    expect((await h.json("PUT", "/api/profile", { weeklyGoal: 9 })).status).toBe(400);
  });

  test("calibration stores the run and patches the profile", async () => {
    const r = await h.json<{ tapLatencyMs: number }>("POST", "/api/profile/calibration", {
      kind: "tap-latency",
      result: { offsets: [30, 34, 31] },
      patch: { tapLatencyMs: 32 },
    });
    expect(r.body.tapLatencyMs).toBe(32);
    expect(h.server.deps.repos.profile.calibrations()).toHaveLength(1);
  });

  test("an unknown /api path is a JSON 404", async () => {
    const r = await h.json<{ error: { code: string } }>("GET", "/api/nope");
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("not_found");
  });
});

describe("API key", () => {
  test("a pasted key is stored 0600, never returned, and can be removed with a nonce", async () => {
    const key = `sk-ant-test-${"x".repeat(30)}`;
    const r = await h.json<Record<string, unknown>>("POST", "/api/settings/anthropic-key", { key });
    expect(r.body).toEqual({ status: "ready", source: "pasted" });
    expect(JSON.stringify(r.body)).not.toContain(key);
    const { statSync } = await import("node:fs");
    const st = statSync(`${h.server.deps.config.secretsDir}/anthropic.key`);
    expect(st.mode & 0o777).toBe(0o600);
    expect(h.server.deps.secrets.anthropicKey()).toBe(key);
    expect((await h.req("DELETE", "/api/settings/anthropic-key")).status).toBe(428);
    const del = await h.destructive("DELETE", "/api/settings/anthropic-key", "anthropic-key.delete", "*");
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ status: "missing_key", source: "none" });
  });

  test("a refused key is not stored", async () => {
    const r = await h.json<{ status: string }>("POST", "/api/settings/anthropic-key", {
      key: `bad-${"x".repeat(30)}`,
    });
    expect(r.body.status).toBe("invalid_key");
    expect(h.server.deps.secrets.source()).toBe("none");
  });
});

describe("course", () => {
  test("lesson progress follows the legal order", async () => {
    const r = await h.json<{ lessons: { lessonId: string; status: string }[]; next: string }>(
      "GET",
      "/api/lessons/progress",
    );
    const status = Object.fromEntries(r.body.lessons.map((l) => [l.lessonId, l.status]));
    expect(status["U01.L01"]).toBe("available");
    expect(status["U01.L02"]).toBe("locked");
    expect(r.body.next).toBe("U01.L01");
  });

  test("a step attempt stores the attempt, evidence and state; the rung is the server's", async () => {
    const hint = await h.json<{ rung: number }>("POST", "/api/lessons/U01.L02/steps/S2/hints", {
      reveal: false,
    });
    expect(hint.status).toBe(409); // U01.L02 is locked: hints are a step write
    // Complete U01.L01 first (its Make needs a sketch).
    const saved = await h.json<{ sketch: { id: string } }>(
      "POST",
      "/api/sketches",
      sketchBody({ originKind: "lesson-make", originId: "U01.L01" }),
    );
    const done = await h.json<{
      progress: { status: string };
      unlocks: { itemId: string }[];
      terms: { termId: string }[];
    }>("POST", "/api/lessons/U01.L01/complete", {
      sessionId: null,
      sketchId: saved.body.sketch.id,
      lessonVersion: 1,
      contentHash: "h1",
      splitPart: null,
    });
    expect(done.status).toBe(200);
    expect(done.body.progress.status).toBe("completed");
    expect(done.body.unlocks.map((u) => u.itemId).sort()).toEqual(["snd.piano", "tb.mini.rest"]);
    expect(done.body.terms.map((t) => t.termId)).toEqual(["term.pulse"]);

    const h1 = await h.json<{ rung: number }>("POST", "/api/lessons/U01.L02/steps/S2/hints", {
      reveal: false,
    });
    expect(h1.body.rung).toBe(1);
    const attempt = await h.json<{
      attempt: { attemptNo: number; hintRung: number; adjusted: number; passed: boolean };
      state: { attempts: number; passed: boolean };
      evidence: { skillId: string; weight: number; score: number }[];
      reviews: unknown[];
    }>("POST", "/api/lessons/U01.L02/steps/S2/attempts", {
      sessionId: null,
      exerciseId: "rest-on-three",
      exerciseVersion: 1,
      seriesNo: 0,
      params: null,
      response: { code: 'setcpm(96/4)\n\ndrums: s("bd bd ~ bd")' },
      result: gradeResult({
        exerciseId: "U01.L02/rest-on-three",
        score: 1,
        assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
      }),
      extraReplays: 0,
      activeMs: 30_000,
      tutorAssisted: false,
    });
    expect(attempt.status).toBe(200);
    expect(attempt.body.attempt.hintRung).toBe(1);
    expect(attempt.body.attempt.attemptNo).toBe(1);
    // Rung 1 multiplier (nudge) applies to the adjusted score, whatever the client claimed.
    expect(attempt.body.attempt.adjusted).toBeLessThan(1);
    expect(attempt.body.state).toMatchObject({ attempts: 1, passed: true });
    expect(attempt.body.evidence).toEqual([expect.objectContaining({ skillId: "R06", weight: 1 })]);
    expect(attempt.body.reviews).toEqual([]);
  });

  test("a hint without reveal stops at rung 3; reveal needs two graded attempts", async () => {
    await h.server.deps.repos.lessons.saveProgress({
      lessonId: "U01.L01" as never,
      status: "completed",
      currentStep: null,
      splitPart: null,
      startedAt: null,
      completedAt: "2026-11-10T10:00:00.000Z",
      bestScore: 1,
      completedVersion: 1,
      contentHash: null,
      updatedAt: "2026-11-10T10:00:00.000Z",
    });
    for (let i = 0; i < 5; i++)
      await h.json("POST", "/api/lessons/U01.L02/steps/S2/hints", { reveal: false });
    const s = await h.json<{ rung: number; revealAvailable: boolean }>(
      "GET",
      "/api/lessons/U01.L02/steps/S2",
    );
    expect(s.body).toMatchObject({ rung: 3, revealAvailable: false });
    expect((await h.json("POST", "/api/lessons/U01.L02/steps/S2/hints", { reveal: true })).status).toBe(409);
    const ns = await h.json<{ rung: number; seriesNo: number }>(
      "POST",
      "/api/lessons/U01.L02/steps/S2/series",
    );
    expect(ns.body).toMatchObject({ rung: 0, seriesNo: 1 });
  });

  test("unknown lesson, step and exercise are 404", async () => {
    expect((await h.json("GET", "/api/lessons/U09.L01/steps/S1")).status).toBe(404);
    expect((await h.json("GET", "/api/lessons/U01.L01/steps/S7")).status).toBe(404);
  });

  test("checkpoint start is refused before its lessons are done", async () => {
    const r = await h.json<{ error: { code: string } }>("POST", "/api/checkpoints/U01/start");
    expect(r.status).toBe(409);
  });

  test("capstones are locked until their gate opens", async () => {
    const r = await h.json<{ status: string; lockedReason: string }>("GET", "/api/capstones/C0");
    expect(r.body.status).toBe("locked");
    expect(r.body.lockedReason).toContain("Pulse and rests");
  });

  test("gym sessions number themselves", async () => {
    const a = await h.json<{ gymId: string; ladderLevel: number }>("POST", "/api/gym/sessions", {
      sessionId: null,
      kind: "ladder",
      transcriptionId: null,
    });
    const b = await h.json<{ gymId: string }>("POST", "/api/gym/sessions", {
      sessionId: null,
      kind: "own-audio",
      transcriptionId: null,
    });
    expect(a.body).toMatchObject({ gymId: "GYM.01", ladderLevel: 1 });
    expect(b.body.gymId).toBe("GYM.02");
  });

  test("sessions start, beat and end with a Coda summary", async () => {
    const s = await h.json<{ id: string; phase: string }>("POST", "/api/session/start", {
      kind: "lesson",
      mapItemId: "U01.L01",
      targetMinutes: 20,
    });
    expect(s.status).toBe(200);
    expect(
      (
        await h.json("POST", `/api/session/${s.body.id}/heartbeat`, {
          phase: "main",
          activeMs: 60_000,
          stepId: "S1",
        })
      ).status,
    ).toBe(200);
    const boot = await h.json<{ openSession: { id: string } }>("GET", "/api/bootstrap");
    expect(boot.body.openSession.id).toBe(s.body.id);
    const end = await h.json<{ session: { phase: string; activeMinutes: number }; listeningNote: string }>(
      "POST",
      `/api/session/${s.body.id}/end`,
      { wrappedEarly: false, phaseMs: { warmup: 60_000, main: 600_000, make: 240_000, coda: 30_000 } },
    );
    expect(end.body.session.phase).toBe("done");
    expect(end.body.listeningNote).toBe("off"); // Claude's listening notes are gone (owner, 2026-11-22)
    expect(end.body.session.activeMinutes).toBeCloseTo(15.5, 5);
    expect(
      (
        await h.json("POST", "/api/session/start", {
          kind: "lesson",
          mapItemId: "U01.L03",
          targetMinutes: 20,
        })
      ).status,
    ).toBe(409);
  });

  test("session.today and the SRS endpoints answer 503 when the SRS service is not wired", async () => {
    const bare = await harness({ srsWiring: false });
    try {
      expect((await bare.json("GET", "/api/session/today")).status).toBe(503);
      expect((await bare.json("GET", "/api/srs/due")).status).toBe(503);
      expect((await bare.json("GET", "/api/drills/families")).status).toBe(503);
    } finally {
      await bare.close();
    }
  });
});

describe("library", () => {
  test("sketch create, version, patch, list and delete with a nonce", async () => {
    const created = await h.json<{
      sketch: { id: string; currentVersion: number };
      streak: { todayQualified: boolean };
    }>("POST", "/api/sketches", sketchBody());
    expect(created.body.sketch.currentVersion).toBe(1);
    expect(created.body.streak.todayQualified).toBe(true);
    const id = created.body.sketch.id;
    const v2 = await h.json<{ sketch: { currentVersion: number; versions: unknown[] } }>(
      "POST",
      `/api/sketches/${id}/versions`,
      {
        ...sketchBody(),
        title: "not a version field",
      },
    );
    expect(v2.status).toBe(400); // strict body: create fields are not version fields
    const { title: _t, originKind: _o, originId: _i, ...version } = sketchBody({ code: 's("bd")' });
    const v3 = await h.json<{ sketch: { currentVersion: number; versions: unknown[] } }>(
      "POST",
      `/api/sketches/${id}/versions`,
      version,
    );
    expect(v3.body.sketch.currentVersion).toBe(2);
    expect(v3.body.sketch.versions).toHaveLength(2);
    const p = await h.json<{ title: string; tags: string[] }>("PATCH", `/api/sketches/${id}`, {
      title: "Renamed",
      tags: ["a"],
    });
    expect(p.body).toMatchObject({ title: "Renamed", tags: ["a"] });
    expect((await h.json<{ items: unknown[] }>("GET", "/api/sketches")).body.items).toHaveLength(1);
    expect((await h.req("DELETE", `/api/sketches/${id}`)).status).toBe(428);
    // A nonce for another target does not work, and it is spent by the attempt.
    expect((await h.destructive("DELETE", `/api/sketches/${id}`, "sketch.delete", "other")).status).toBe(428);
    expect((await h.destructive("DELETE", `/api/sketches/${id}`, "sketch.delete", id)).status).toBe(200);
    expect((await h.json("GET", `/api/sketches/${id}`)).status).toBe(404);
  });

  test("own audio: upload by hash, Range reads, peaks, delete", async () => {
    const wav = makeWav(8000, 0.25);
    const up = await h.json<{ id: string; bytes: number; durationS: number; sampleRate: number }>(
      "POST",
      "/api/audio?name=take.wav",
      wav,
      { "content-type": "audio/wav" },
    );
    expect(up.status).toBe(200);
    expect(up.body.bytes).toBe(wav.length);
    expect(up.body.sampleRate).toBe(8000);
    expect(up.body.durationS).toBeCloseTo(0.25, 5);
    const again = await h.json<{ id: string }>("POST", "/api/audio?name=copy.wav", wav, {
      "content-type": "audio/wav",
    });
    expect(again.body.id).toBe(up.body.id);

    const media = { host: "127.0.0.1:8787", "sec-fetch-site": "same-origin" };
    const full = await h.server.app.request(`http://127.0.0.1:8787/api/audio/${up.body.id}`, {
      headers: media,
    });
    expect(full.status).toBe(200);
    expect([...new Uint8Array(await full.arrayBuffer())]).toEqual([...wav]);
    const part = await h.server.app.request(`http://127.0.0.1:8787/api/audio/${up.body.id}`, {
      headers: { ...media, range: "bytes=4-11" },
    });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 4-11/${wav.length}`);
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([...wav.subarray(4, 12)]);
    const bad = await h.server.app.request(`http://127.0.0.1:8787/api/audio/${up.body.id}`, {
      headers: { ...media, range: "bytes=999999-" },
    });
    expect(bad.status).toBe(416);

    expect((await h.req("PUT", `/api/audio/${up.body.id}/peaks`, new Uint8Array([1, 2, 3]))).status).toBe(
      200,
    );
    const peaks = await h.server.app.request(`http://127.0.0.1:8787/api/audio/${up.body.id}/peaks`, {
      headers: media,
    });
    expect(new Uint8Array(await peaks.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(
      (await h.destructive("DELETE", `/api/audio/${up.body.id}`, "audio.delete", up.body.id)).status,
    ).toBe(200);
    expect(
      (await h.server.app.request(`http://127.0.0.1:8787/api/audio/${up.body.id}`, { headers: media }))
        .status,
    ).toBe(404);
  });

  test("a non-audio upload is refused", async () => {
    const r = await h.json(
      "POST",
      "/api/audio?name=x.wav",
      new TextEncoder().encode("<html>hello world</html>"),
    );
    expect(r.status).toBe(400);
  });

  test("album: a B-side track, versions, recorded audio, delete", async () => {
    const s = await h.json<{ sketch: { id: string } }>("POST", "/api/sketches", sketchBody());
    const t = await h.json<{
      id: string;
      side: string;
      trackNo: number;
      versions: { version: number; hasAudio: boolean }[];
    }>("POST", "/api/album/tracks", {
      capstoneId: null,
      side: "Bside",
      title: "B1",
      flavour: null,
      sketchId: s.body.sketch.id,
      sketchVersion: 1,
      linerNotesMd: "A groove.",
      theoryTags: ["rest"],
      attribution: null,
    });
    expect(t.status).toBe(200);
    expect(t.body).toMatchObject({ side: "Bside", trackNo: 1 });
    const wav = makeWav(8000, 0.1);
    const put = await h.json<{ hasAudio: boolean; durationS: number }>(
      "PUT",
      `/api/album/tracks/${t.body.id}/versions/1/audio?durationS=0.1`,
      wav,
      {
        "content-type": "audio/wav",
      },
    );
    expect(put.body).toMatchObject({ hasAudio: true, durationS: 0.1 });
    const media = { host: "127.0.0.1:8787", "sec-fetch-site": "same-origin" };
    const audio = await h.server.app.request(
      `http://127.0.0.1:8787/api/album/tracks/${t.body.id}/versions/1/audio`,
      { headers: media },
    );
    expect(audio.status).toBe(200);
    expect(audio.headers.get("content-type")).toBe("audio/wav");
    const v2 = await h.json<{ currentVersion: number }>("POST", `/api/album/tracks/${t.body.id}/versions`, {
      sketchId: s.body.sketch.id,
      sketchVersion: 1,
      linerNotesMd: "Again.",
      theoryTags: [],
      attribution: "Revision suggested by Claude (bars 5–8)",
    });
    expect(v2.body.currentVersion).toBe(2);
    expect((await h.json<{ tracks: unknown[] }>("GET", "/api/album")).body.tracks).toHaveLength(1);
    expect(
      (await h.destructive("DELETE", `/api/album/tracks/${t.body.id}`, "track.delete", t.body.id)).status,
    ).toBe(200);
    expect((await h.json("GET", `/api/album/tracks/${t.body.id}`)).status).toBe(404);
  });

  test("transcriptions of own audio: create, patch, versions; hidden code never leaves", async () => {
    const up = await h.json<{ id: string }>("POST", "/api/audio?name=song.wav", makeWav(8000, 0.1), {
      "content-type": "audio/wav",
    });
    const t = await h.json<{ id: string; player: string; versions: unknown[]; stimulus: null }>(
      "POST",
      "/api/transcriptions",
      {
        sourceKind: "own-audio",
        audioId: up.body.id,
        songId: null,
        title: "My song",
        artist: null,
        ladderLevel: null,
        templateId: null,
      },
    );
    expect(t.body).toMatchObject({ player: "audio", versions: [], stimulus: null });
    const p = await h.json<{ fineTuneCents: number; status: string }>(
      "PATCH",
      `/api/transcriptions/${t.body.id}`,
      { fineTuneCents: -12, status: "done" },
    );
    expect(p.body).toMatchObject({ fineTuneCents: -12, status: "done" });
    const v = await h.json<{ currentVersion: number; versions: { code: string }[] }>(
      "POST",
      `/api/transcriptions/${t.body.id}/versions`,
      {
        sessionId: null,
        code: 'mel: note("c d e")',
        result: null,
        ranOk: true,
      },
    );
    expect(v.body.currentVersion).toBe(1);
    const raw = JSON.stringify((await h.json("GET", `/api/transcriptions/${t.body.id}`)).body);
    expect(raw).not.toContain("hiddenCode");
    expect(
      (await h.destructive("DELETE", `/api/transcriptions/${t.body.id}`, "transcription.delete", t.body.id))
        .status,
    ).toBe(200);
  });

  test("a generated ladder transcription is 503 while the ladder generator is unfinished", async () => {
    const r = await h.json<{ error: { code: string } }>("POST", "/api/transcriptions", {
      sourceKind: "generated",
      audioId: null,
      songId: null,
      title: "Ladder 1",
      artist: null,
      ladderLevel: 1,
      templateId: null,
    });
    expect([200, 503]).toContain(r.status);
  });
});

describe("telemetry, QA, dev", () => {
  test("telemetry steps are stored; dev routes are 404 without OAK_DEV", async () => {
    const r = await h.json("POST", "/api/telemetry/steps", {
      steps: [
        {
          sessionId: "ses_1",
          lessonId: "U01.L01",
          lessonVersion: 1,
          stepId: "S1",
          stepKind: "predict",
          targetMinutes: 20,
          authoredMinutes: 0.5,
          scaledMinutes: 0.7,
          startedAt: "2026-11-11T12:00:00.000Z",
          endedAt: "2026-11-11T12:01:00.000Z",
          activeMs: 42_000,
          attempts: 1,
          maxHintRung: 0,
          tutorMessages: 0,
          passed: true,
          skipped: false,
          testedOut: false,
          splitPart: null,
        },
      ],
    });
    expect(r.status).toBe(200);
    expect(h.server.deps.repos.ops.stepTelemetry()).toHaveLength(1);
    expect((await h.json("GET", "/api/dev/telemetry")).status).toBe(404);
  });

  test("a QA report is stored with versions", async () => {
    const r = await h.json<{ id: number; status: string; appVersion: string; contentVersion: string }>(
      "POST",
      "/api/qa/reports",
      {
        kind: "drill-trial",
        lessonId: null,
        stepId: null,
        exerciseId: null,
        exerciseVersion: null,
        familyId: "fam.rhy.read",
        trialSeed: 42,
        params: { level: 1 },
        response: { answer: { choice: "a" } },
        gradeResult: null,
        hintRung: 0,
        note: "the key was wrong",
        attemptId: null,
      },
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "open", contentVersion: "fixture-1" });
  });
});

describe("contract coverage", () => {
  test("every endpoint of the contract is served (not a 404 from the router)", async () => {
    const full = await harness({ dev: true, tutor: { idleTimeout: "best-effort" } });
    try {
      for (const name of ENDPOINT_NAMES) {
        const def = contract[name] as { method: string; path: string };
        const path = `/api${def.path.replace(/:([A-Za-z]+)/g, "x")}`;
        const res = await full.req(def.method, path, def.method === "GET" ? undefined : {});
        const text = await res.text();
        const routerMiss = res.status === 404 && text.includes("no such endpoint");
        expect({ name, routerMiss }).toEqual({ name, routerMiss: false });
      }
    } finally {
      await full.close();
    }
  });
});

/**
 * The Wave 3 endpoints still answering their typed 501 stub (docs/design/wave3.md §5). The server engineer
 * removes a name here as its handler lands; the second test then checks it no longer answers 501.
 */
const WAVE3_PENDING: readonly (typeof WAVE3_ENDPOINTS)[number][] = [];
const WAVE3_BODIES: Partial<Record<(typeof WAVE3_ENDPOINTS)[number], unknown>> = {
  "voice.quiet": { quiet: true, scope: "today" },
  "voice.ladder": { mode: "auto" },
};

describe("Wave 3 endpoints", () => {
  test("a pending endpoint answers the typed 501 stub; a built one never does", async () => {
    const full = await harness({ dev: true });
    try {
      for (const name of WAVE3_ENDPOINTS) {
        const def = contract[name] as { method: string; path: string };
        const path = `/api${def.path.replace(/:([A-Za-z]+)/g, "x")}`;
        const r = await full.json<{ error?: { code: string } }>(def.method, path, WAVE3_BODIES[name]);
        if (WAVE3_PENDING.includes(name))
          expect({ name, status: r.status, code: r.body?.error?.code }).toEqual({
            name,
            status: 501,
            code: "not_implemented",
          });
        else expect({ name, status: r.status }).not.toEqual({ name, status: 501 });
      }
    } finally {
      await full.close();
    }
  });
});

/**
 * The Wave 4 endpoints still answering their typed 501 stub (docs/design/wave4.md §5). The server engineer
 * removes a name here as its handler lands; the test then checks it no longer answers 501.
 */
const WAVE4_PENDING: readonly (typeof WAVE4_ENDPOINTS)[number][] = [];
/** A valid body (and query) per endpoint, so a pending one reaches its handler (a 400 would hide the 501). */
const WAVE4_REQUESTS: Partial<Record<(typeof WAVE4_ENDPOINTS)[number], { body?: unknown; query?: string }>> =
  {
    "capstones.saveDraft": {
      body: { capstoneSessionId: "C2.S1", sessionId: null, sketchId: "x", sketchVersion: 1 },
    },
    "capstones.recordCheck": {
      body: {
        capstoneSessionId: "X1.S1",
        stage: null,
        sketchId: "x",
        sketchVersion: 1,
        result: gradeResult({ exerciseId: "X1/phrase-1" }),
      },
    },
    "album.patchVersion": { body: { includeReviewNote: true } },
    "album.attachReview": {
      body: {
        conversationId: "x",
        includeReviewNote: false,
        review: { strengths: [], revisions: [], listeningQuestion: "?", linerNote: "." },
      },
    },
    "tutor.reviews": { query: "?subjectKind=capstone&subjectId=C2" },
    "transcriptions.putSettings": { body: { rate: 0.75 } },
    "ladder.setLevel": { body: { level: 2 } },
    "ladder.next": { body: { sessionId: null, gymId: null } },
    "ladder.submit": { body: { sessionId: null, code: 's("bd")', rung: 0 } },
  };

describe("Wave 4 endpoints", () => {
  test("a pending endpoint answers the typed 501 stub; a built one never does", async () => {
    const full = await harness({ dev: true });
    try {
      for (const name of WAVE4_ENDPOINTS) {
        const def = contract[name] as { method: string; path: string };
        const req = WAVE4_REQUESTS[name] ?? {};
        const path = `/api${def.path.replace(/:([A-Za-z]+)/g, "x")}${req.query ?? ""}`;
        const r = await full.json<{ error?: { code: string } }>(def.method, path, req.body);
        if (WAVE4_PENDING.includes(name))
          expect({ name, status: r.status, code: r.body?.error?.code }).toEqual({
            name,
            status: 501,
            code: "not_implemented",
          });
        else expect({ name, status: r.status }).not.toEqual({ name, status: 501 });
      }
    } finally {
      await full.close();
    }
  });
});

/**
 * The Wave 5 endpoints still answering their typed 501 stub (docs/design/wave5.md §5). The server engineer removes
 * a name here as its handler lands; the test then checks it no longer answers 501.
 */
const WAVE5_PENDING: readonly (typeof WAVE5_ENDPOINTS)[number][] = [];
const WAVE5_BODIES: Partial<Record<(typeof WAVE5_ENDPOINTS)[number], unknown>> = {
  "transcriptions.confirmVersion": { strictLintPassed: true },
};

describe("Wave 5 endpoints", () => {
  test("a pending endpoint answers the typed 501 stub; a built one never does", async () => {
    const full = await harness({ dev: true });
    try {
      for (const name of WAVE5_ENDPOINTS) {
        const def = contract[name] as { method: string; path: string };
        const path = `/api${def.path.replace(/:([A-Za-z]+)/g, "1")}`;
        const r = await full.json<{ error?: { code: string } }>(def.method, path, WAVE5_BODIES[name]);
        if (WAVE5_PENDING.includes(name))
          expect({ name, status: r.status, code: r.body?.error?.code }).toEqual({
            name,
            status: 501,
            code: "not_implemented",
          });
        else expect({ name, status: r.status }).not.toEqual({ name, status: 501 });
      }
    } finally {
      await full.close();
    }
  });
  test("ladder levels 5 and 6 are built: a higher level is refused until offered, never a 501", async () => {
    const full = await harness({ dev: true });
    try {
      const r = await full.json<{ error?: { code: string } }>("POST", "/api/ladder/items", {
        sessionId: null,
        gymId: null,
        level: 5,
      });
      expect({ status: r.status, code: r.body?.error?.code }).toEqual({ status: 409, code: "conflict" });
      const up = await full.json<{ error?: { code: string } }>("PUT", "/api/ladder", { level: 6 });
      expect(up.status).toBe(409);
      const songs = await full.json<{ items: unknown[] }>("GET", "/api/ladder/songs");
      expect(songs.status).toBe(200);
    } finally {
      await full.close();
    }
  });
});

/**
 * The Wave 6 endpoints still answering their typed 501 stub (docs/design/wave6.md §5). The server engineer removes
 * a name here as its handler lands; the test then checks it no longer answers 501.
 */
const WAVE6_PENDING: readonly (typeof WAVE6_ENDPOINTS)[number][] = [];
const WAVE6_BODIES: Partial<Record<(typeof WAVE6_ENDPOINTS)[number], unknown>> = {
  "album.chooseTake": { take: 1 },
};

describe("Wave 6 endpoints", () => {
  test("a pending endpoint answers the typed 501 stub; a built one never does", async () => {
    const full = await harness({ dev: true });
    try {
      for (const name of WAVE6_ENDPOINTS) {
        const def = contract[name] as { method: string; path: string; body?: unknown };
        // `U11.L05` satisfies the lesson-id path; `1` the numeric ones.
        const path = `/api${def.path.replace("/lessons/:id", "/lessons/U11.L05").replace(/:([A-Za-z]+)/g, "1")}`;
        const r = await full.json<{ error?: { code: string } }>(
          def.method,
          path,
          def.body === "binary" ? new Uint8Array([1, 2, 3]) : WAVE6_BODIES[name],
          def.body === "binary" ? { "content-type": "audio/wav" } : undefined,
        );
        if (WAVE6_PENDING.includes(name))
          expect({ name, status: r.status, code: r.body?.error?.code }).toEqual({
            name,
            status: 501,
            code: "not_implemented",
          });
        else expect({ name, status: r.status }).not.toEqual({ name, status: 501 });
      }
    } finally {
      await full.close();
    }
  });
  test("ladder L8 is built: refused until offered (409 with the reason), never an L6 item, never a 501", async () => {
    const full = await harness({ dev: true });
    try {
      const next = await full.json<{ error?: { code: string; message: string } }>(
        "POST",
        "/api/ladder/items",
        {
          sessionId: null,
          gymId: null,
          level: 8,
        },
      );
      expect(next.status).toBe(409);
      const up = await full.json<{ error?: { code: string } }>("PUT", "/api/ladder", { level: 8 });
      expect(up.status).toBe(409);
      // L7 is own audio: the schema refuses it as an item level.
      const seven = await full.json("PUT", "/api/ladder", { level: 7 });
      expect(seven.status).toBe(400);
      const state = await full.json<{ level: number }>("GET", "/api/ladder");
      expect(state.body.level).toBe(1);
    } finally {
      await full.close();
    }
  });
  test("the additive request fields are accepted by today's handlers (ignored until built)", async () => {
    const full = await harness({ dev: true });
    try {
      // d21: the tab id on the day read and on the start. The server engineer gives each tab its own session.
      const day = await full.json<{ day: string }>("GET", "/api/session/day?tab=tab_12345678");
      expect(day.status).toBe(200);
      const bad = await full.json<{ error?: { code: string } }>("GET", "/api/session/day?tab=x");
      expect(bad.status).toBe(400);
    } finally {
      await full.close();
    }
  });
});

function makeWav(sampleRate: number, seconds: number): Uint8Array {
  const n = Math.round(sampleRate * seconds);
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
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), true);
  return buf;
}

describe("Wave 2 endpoints", () => {
  test("no Wave 2 endpoint answers the 501 stub any more", async () => {
    const full = await harness({ dev: true });
    try {
      for (const name of WAVE2_ENDPOINTS) {
        const def = contract[name] as { method: string; path: string };
        const path = `/api${def.path.replace(/:([A-Za-z]+)/g, "x")}`;
        const body =
          name === "lessons.position"
            ? { sessionId: null, stepId: "S1", splitPart: null, wrapped: false }
            : name === "capstones.release"
              ? {
                  sessionId: null,
                  sketchId: "sk",
                  sketchVersion: 1,
                  title: "t",
                  flavour: null,
                  linerNotesMd: "",
                  theoryTags: [],
                  includeReviewNote: false,
                }
              : name === "dev.listenMark"
                ? { hash: "h", verdict: "ok", note: "" }
                : name === "onboarding.put"
                  ? { step: "loop" }
                  : undefined;
        const r = await full.json<{ error?: { code: string } }>(def.method, path, body);
        expect({ name, status: r.status }).not.toEqual({ name, status: 501 });
        expect({ name, code: r.body?.error?.code }).not.toEqual({ name, code: "not_implemented" });
      }
    } finally {
      await full.close();
    }
  });
});

/**
 * The Wave 7 endpoints still answering their typed 501 stub (docs/design/wave7.md §5). The server engineer removes
 * a name here as its handler lands; the test then checks it no longer answers 501.
 */
const WAVE7_PENDING: readonly (typeof WAVE7_ENDPOINTS)[number][] = [];
const WAVE7_BODIES: Partial<Record<(typeof WAVE7_ENDPOINTS)[number], unknown>> = {
  "tracks.setFocus": { focus: "J" },
};

describe("Wave 7 endpoints", () => {
  test("a pending endpoint answers the typed 501 stub; a built one never does", async () => {
    const full = await harness({ dev: true });
    try {
      for (const name of WAVE7_ENDPOINTS) {
        const def = contract[name] as { method: string; path: string };
        const path = `/api${def.path.replace(/:([A-Za-z]+)/g, "1")}`;
        const r = await full.json<{ error?: { code: string } }>(def.method, path, WAVE7_BODIES[name]);
        if (WAVE7_PENDING.includes(name))
          expect({ name, status: r.status, code: r.body?.error?.code }).toEqual({
            name,
            status: 501,
            code: "not_implemented",
          });
        else expect({ name, status: r.status }).not.toEqual({ name, status: 501 });
      }
    } finally {
      await full.close();
    }
  });
});
