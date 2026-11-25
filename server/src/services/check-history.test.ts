// Oak 2.0 W4 (PLAN F2): `capstone_check_history`. Checks go through the full harness's `POST /api/capstones/:id/checks`
// (`CourseService.capstoneCheck` writes one row per accepted check); the history is read through a side app (the W4
// integrator mounts `checkHistoryRoutes` in app.ts), with the real API security, contract validation and backup.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { CapstoneCheckHistoryEntry } from "@oak/api";
import { Hono } from "hono";
import { ApiError, errorResponse } from "../errors.ts";
import { checkHistoryRoutes } from "../routes/check-history.ts";
import { createMounter } from "../routes/define.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, gradeResult, type Harness, harness } from "../testing/harness.ts";
import { CheckHistoryService } from "./check-history.ts";

/** The check-history route on its own app, over the harness server's services, security and confirm store. */
function sideApp(h: Harness) {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  checkHistoryRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    new CheckHistoryService(h.server.deps.services.ctx),
  );
  return async <T = unknown>(
    method: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: T }> => {
    const res = await app.request(`http://127.0.0.1:8787${path}`, {
      method,
      headers: { ...BROWSER, ...headers },
    });
    const text = await res.text();
    return { status: res.status, body: (text === "" ? null : JSON.parse(text)) as T };
  };
}

const NOW = "2026-11-25T09:00:00.000Z";
let h: Harness;
beforeEach(async () => {
  h = await harness({ dev: true, now: NOW });
  h.server.deps.repos.profile.patch({ timezone: "UTC" });
});
afterEach(async () => {
  await h.close();
});

const SKETCH = {
  sessionId: null,
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

async function ok<T>(hh: Harness, method: string, path: string, body?: unknown): Promise<T> {
  const r = await hh.json<T>(method, path, body);
  if (r.status < 200 || r.status >= 300)
    throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

async function sketch(hh: Harness, originId: string, originKind = "lesson-make", code = 's("bd ~ sd hh")') {
  const r = await ok<{ sketch: { id: string } }>(hh, "POST", "/api/sketches", {
    ...SKETCH,
    code,
    title: "Draft",
    originKind,
    originId,
  });
  return r.sketch.id;
}

/** C0 opens after U01's checkpoint (the fixture course), as `routes/wave2.test.ts` opens it. */
async function openC0(hh: Harness): Promise<string> {
  for (const lessonId of ["U01.L01", "U01.L02", "U01.L03", "U02.L01"])
    await ok(hh, "POST", `/api/lessons/${lessonId}/complete`, {
      sessionId: null,
      sketchId: await sketch(hh, lessonId),
      lessonVersion: 1,
      contentHash: "h",
      splitPart: null,
    });
  const start = await ok<{ attemptNo: number; items: { idx: number }[] }>(
    hh,
    "POST",
    "/api/checkpoints/U01.CP/start",
  );
  const cp = await ok<{ passed: boolean }>(hh, "POST", "/api/checkpoints/U01.CP/attempts", {
    sessionId: null,
    attemptNo: start.attemptNo,
    items: start.items.map((i) => ({
      idx: i.idx,
      score: 1,
      skipped: false,
      response: { code: "" },
      result: null,
    })),
    makeSketchId: null,
    acceptSoftPass: false,
  });
  expect(cp.passed).toBe(true);
  const ses = await ok<{ id: string }>(hh, "POST", "/api/session/start", {
    kind: "capstone",
    mapItemId: "C0.S1",
    targetMinutes: 20,
  });
  return ses.id;
}

/** A second version of the sketch (the draft saved again). */
const save = (hh: Harness, sketchId: string, code: string) =>
  ok(hh, "POST", `/api/sketches/${sketchId}/versions`, { ...SKETCH, code });

const check = (
  hh: Harness,
  capstoneId: string,
  b: { sessionId: string | null; sketchId: string; sketchVersion: number; score?: number; status?: "error" },
) =>
  hh.json("POST", `/api/capstones/${capstoneId}/checks`, {
    sessionId: b.sessionId,
    sketchId: b.sketchId,
    sketchVersion: b.sketchVersion,
    result: {
      ...gradeResult({ exerciseId: `${capstoneId}/brief`, score: b.score ?? 0.95, mode: "capstone" }),
      ...(b.status ? { status: b.status } : {}),
    },
  });

const history = async (api: ReturnType<typeof sideApp>, id = "C0") => {
  const r = await api<{ items: CapstoneCheckHistoryEntry[] }>("GET", `/api/capstones/${id}/check-history`);
  expect(r.status).toBe(200);
  return r.body.items;
};

describe("capstone check history", () => {
  test("a failing then a passing check give two rows, oldest first", async () => {
    const sessionId = await openC0(h);
    const sk = await sketch(h, "C0", "capstone");
    await save(h, sk, 's("bd sd bd sd")');
    const t1 = h.clock.now().toISOString();
    expect((await check(h, "C0", { sessionId, sketchId: sk, sketchVersion: 1, score: 0.5 })).status).toBe(
      200,
    );
    h.clock.advance(60_000);
    const t2 = h.clock.now().toISOString();
    expect((await check(h, "C0", { sessionId, sketchId: sk, sketchVersion: 2 })).status).toBe(200);
    const items = await history(sideApp(h));
    expect(items).toEqual([
      {
        id: expect.any(Number),
        capstoneId: "C0",
        sessionId,
        sketchId: sk,
        sketchVersion: 1,
        passed: false,
        at: t1,
      },
      {
        id: expect.any(Number),
        capstoneId: "C0",
        sessionId,
        sketchId: sk,
        sketchVersion: 2,
        passed: true,
        at: t2,
      },
    ]);
    expect((items[0] as CapstoneCheckHistoryEntry).id).toBeLessThan(
      (items[1] as CapstoneCheckHistoryEntry).id,
    );
  });

  test("a re-check of the same version adds a row", async () => {
    await openC0(h);
    const sk = await sketch(h, "C0", "capstone");
    await check(h, "C0", { sessionId: null, sketchId: sk, sketchVersion: 1 });
    await check(h, "C0", { sessionId: null, sketchId: sk, sketchVersion: 1 });
    const items = await history(sideApp(h));
    expect(items.map((i) => [i.sketchVersion, i.passed, i.sessionId])).toEqual([
      [1, true, null],
      [1, true, null],
    ]);
  });

  test("an error result is passed: false", async () => {
    await openC0(h);
    const sk = await sketch(h, "C0", "capstone");
    expect(
      (await check(h, "C0", { sessionId: null, sketchId: sk, sketchVersion: 1, status: "error" })).status,
    ).toBe(200);
    expect((await history(sideApp(h))).map((i) => i.passed)).toEqual([false]);
  });

  test("a refused check writes no row", async () => {
    const api = sideApp(h);
    const sk = await sketch(h, "C0", "capstone");
    // C0 is locked before U01's checkpoint: 409, nothing written.
    expect((await check(h, "C0", { sessionId: null, sketchId: sk, sketchVersion: 1 })).status).toBe(409);
    expect(await history(api)).toEqual([]);
    // C1 waits for C0: still locked.
    expect((await check(h, "C1", { sessionId: null, sketchId: sk, sketchVersion: 1 })).status).toBe(409);
    expect(await history(api, "C1")).toEqual([]);
    await openC0(h);
    // An unknown sketch version: 404, nothing written.
    expect((await check(h, "C0", { sessionId: null, sketchId: sk, sketchVersion: 7 })).status).toBe(404);
    expect((await check(h, "C0", { sessionId: null, sketchId: "sk_nope", sketchVersion: 1 })).status).toBe(
      404,
    );
    expect(await history(api)).toEqual([]);
  });

  test("an unknown capstone is 404", async () => {
    const r = await sideApp(h)<{ error: { code: string } }>("GET", "/api/capstones/C99/check-history");
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("not_found");
  });

  test("a foreign Host is refused", async () => {
    const r = await sideApp(h)("GET", "/api/capstones/C0/check-history", { host: "evil.example:8787" });
    expect(r.status).toBe(403);
  });

  test("a backup export → import keeps the rows", async () => {
    const b = await harness({ dev: true, now: NOW });
    try {
      await openC0(h);
      const sk = await sketch(h, "C0", "capstone");
      await check(h, "C0", { sessionId: null, sketchId: sk, sketchVersion: 1, score: 0.4 });
      h.clock.advance(1000);
      await check(h, "C0", { sessionId: null, sketchId: sk, sketchVersion: 1 });
      const before = await history(sideApp(h));
      const exported = await h.req("GET", "/api/backup/export?audio=0");
      expect(exported.status).toBe(200);
      const imported = await b.destructive(
        "POST",
        "/api/backup/import",
        "backup.import",
        "*",
        new Uint8Array(await exported.arrayBuffer()),
      );
      expect(imported.status).toBe(200);
      const after = await history(sideApp(b)); // built after the import
      expect(after).toEqual(before);
      expect(after.map((i) => i.passed)).toEqual([false, true]);
    } finally {
      await b.close();
    }
  });
});
