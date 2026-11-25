import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  type AnalysisSummary,
  type Habits,
  HabitsSchema,
  SKETCH_ORIGINS,
  type SketchCreate,
  type SketchSaved,
  type SketchVersionCreate,
} from "@oak/api";
import { SCHEMAS } from "@oak/theory";
import { Hono } from "hono";
import { all } from "../db/index.ts";
import { ApiError, errorResponse } from "../errors.ts";
import { createMounter } from "../routes/define.ts";
import { habitsRoutes } from "../routes/habits.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, type Harness, harness } from "../testing/harness.ts";
import { HabitsService } from "./habits.ts";

const CODE = 'setcpm(96/4)\nbass: note("a1 ~ e2 ~").s("ebass")';
function versionBody(code = CODE): SketchVersionCreate {
  return {
    sessionId: null,
    code,
    bpm: 96,
    meter: "4/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
  };
}
async function sketch(h: Harness, extra: Partial<SketchCreate> = {}) {
  const result = await h.json<SketchSaved>("POST", "/api/sketches", {
    ...versionBody(),
    title: "Groove",
    originKind: "free",
    originId: null,
    ...extra,
  });
  expect(result.status).toBe(200);
  return result.body.sketch;
}
function sideApp(h: Harness): Hono {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  habitsRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    new HabitsService(h.server.deps.services.ctx),
  );
  return app;
}
async function get(app: Hono): Promise<Habits> {
  const response = await app.request("http://127.0.0.1:8787/api/habits", { headers: BROWSER });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(HabitsSchema.safeParse(body).success).toBe(true);
  return HabitsSchema.parse(body);
}
async function three(h: Harness) {
  for (let i = 0; i < 3; i++) await sketch(h);
}

describe("habits side app", () => {
  let h: Harness;
  let app: Hono;
  beforeEach(async () => {
    h = await harness();
    app = sideApp(h);
  });
  afterEach(async () => {
    await h.close();
  });

  test("AC8/AC10: empty database returns a valid empty mirror", async () => {
    expect(await get(app)).toEqual({ sketches: 0, habits: [] });
  });

  test("AC8/AC10: current versions replace old sounds without writing", async () => {
    await three(h);
    const before = await get(app);
    expect(before.sketches).toBe(3);
    expect(before.habits).toContainEqual({
      id: "sound.bass.ebass",
      text: "3 of your 3 sketches give the bass the sound ebass.",
    });
    const fourth = await sketch(h);
    expect((await get(app)).habits).toContainEqual({
      id: "sound.bass.ebass",
      text: "4 of your 4 sketches give the bass the sound ebass.",
    });
    const saved = await h.json(
      "POST",
      `/api/sketches/${fourth.id}/versions`,
      versionBody(CODE.replace("ebass", "sawtooth")),
    );
    expect(saved.status).toBe(200);
    const changes = h.server.deps.db.query("SELECT total_changes() AS n").get();
    const versions = all(h.server.deps.db, "SELECT * FROM sketch_versions");
    const after = await get(app);
    expect(after.sketches).toBe(4);
    expect(after.habits).toContainEqual({
      id: "sound.bass.ebass",
      text: "3 of your 4 sketches give the bass the sound ebass.",
    });
    expect(all(h.server.deps.db, "SELECT * FROM sketch_versions")).toEqual(versions);
    expect(h.server.deps.db.query("SELECT total_changes() AS n").get()).toEqual(changes);
  });

  test("AC8/AC10: saved analysis supplies schemas and estimated keys", async () => {
    const analysis: AnalysisSummary = {
      key: [{ key: { tonic: "A", mode: "minor" }, r: 0.9 }],
      bpm: 96,
      bars: 4,
      durationSec: 10,
      roles: { bass: "bass" },
      slots: [],
      schemas: [{ schema: "schema.aeolian", bars: [1, 4] }],
      cadences: [],
      form: "loop",
      energy: [],
      devices: [],
    };
    for (let i = 0; i < 3; i++) await sketch(h, { analysis });
    const result = await get(app);
    expect(result.sketches).toBe(3);
    expect(result.habits).toContainEqual({
      id: "schema.aeolian",
      text: `3 of your 3 sketches use the ${SCHEMAS.find((s) => s.id === "schema.aeolian")?.title} schema.`,
    });
    expect(result.habits).toContainEqual({ id: "key.A-minor", text: "3 of your 3 sketches are in A minor." });
  });

  test("AC9/AC10: Oak copies, archives and other origins are not read; scraps are", async () => {
    await three(h);
    const baseline = await get(app);
    expect(baseline.sketches).toBe(3);
    const kit = await sketch(h, { note: "From the learning kit Four-chord pop" });
    expect(await get(app)).toEqual(baseline);
    await sketch(h, { note: "From the toolbox: .rev()" });
    expect(await get(app)).toEqual(baseline);
    const archived = await sketch(h);
    const patched = await h.json("PATCH", `/api/sketches/${archived.id}`, { archived: true });
    expect(patched.status).toBe(200);
    expect(await get(app)).toEqual(baseline);
    await sketch(h, { originKind: "lesson-make", originId: "U00.L01" });
    expect(await get(app)).toEqual(baseline);
    for (const originKind of SKETCH_ORIGINS) {
      if (originKind === "free" || originKind === "lesson-make") continue;
      await sketch(h, { originKind });
      expect(await get(app)).toEqual(baseline);
    }
    const revised = await h.json("POST", `/api/sketches/${kit.id}/versions`, {
      ...versionBody(),
      note: "From scraps",
    });
    expect(revised.status).toBe(200);
    expect(await get(app)).toEqual(baseline);
    await sketch(h, { note: "From scraps" });
    const control = await get(app);
    expect(control.sketches).toBe(4);
    expect(control.habits).toContainEqual({
      id: "sound.bass.ebass",
      text: "4 of your 4 sketches give the bass the sound ebass.",
    });
  });

  test("AC10: foreign Host receives 403", async () => {
    const response = await app.request("http://127.0.0.1:8787/api/habits", {
      headers: { ...BROWSER, host: "evil.example:8787" },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
  });
});
