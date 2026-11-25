import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SCRAP_ROLES, type Scrap, type ScrapCreate, type SketchSaved } from "@oak/api";
import { STUDIO_ROLES } from "@oak/content-kit";
import { Hono } from "hono";
import { all, run } from "../db/index.ts";
import { ScrapsRepo } from "../db/repos/scraps.ts";
import { ApiError, errorResponse } from "../errors.ts";
import { createMounter } from "../routes/define.ts";
import { scrapsRoutes } from "../routes/scraps.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, type Harness, harness } from "../testing/harness.ts";
import { indexScrapId, ScrapsService } from "./scraps.ts";

const CODE = `setcpm(96/4)

const changes = "<C Am F G>"
drums: s("bd ~ sd ~")
bass: note("c2 ~ g1 ~").s("ebass")
chords: chord(changes).voicing().s("piano")
mel: n("0 2 4").scale("C4:major").s("piano")`;
const CODE_V2 = CODE.replace('mel: n("0 2 4").scale("C4:major").s("piano")', 'hats: s("hh*8")');
const LESSON: ScrapCreate = {
  role: "bass",
  label: "bass",
  code: 'bass: note("c2 ~").s("ebass")',
  bpm: 90,
  meter: "4/4",
  key: null,
  sourceKind: "lesson",
  sourceRef: "U03.L02/S4",
};

function versionBody(code = CODE) {
  return {
    sessionId: null,
    code,
    bpm: 96,
    meter: "4/4",
    key: { tonic: "C", mode: "major" },
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
  };
}

async function sketch(h: Harness, code = CODE) {
  const res = await h.json<SketchSaved>("POST", "/api/sketches", {
    ...versionBody(code),
    title: "Groove",
    originKind: "free",
    originId: null,
  });
  expect(res.status).toBe(200);
  return res.body.sketch;
}

function sideApp(h: Harness): Hono {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  scrapsRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    new ScrapsService(h.server.deps.services.ctx),
  );
  return app;
}

function request(
  app: Hono,
  method: string,
  path = "/api/scraps",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return app.request(`http://127.0.0.1:8787${path}`, {
    method,
    headers: { ...BROWSER, "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function list(app: Hono, query = ""): Promise<Scrap[]> {
  const res = await request(app, "GET", `/api/scraps${query}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as { items: Scrap[] }).items;
}

async function save(app: Hono, body: ScrapCreate = LESSON): Promise<Scrap> {
  const res = await request(app, "POST", "/api/scraps", body);
  expect(res.status).toBe(200);
  return (await res.json()) as Scrap;
}

async function nonce(h: Harness, id: string): Promise<Record<string, string>> {
  const res = await h.req("POST", "/api/confirm", { action: "scrap.delete", target: id });
  expect(res.status).toBe(200);
  return { "x-oak-confirm": ((await res.json()) as { nonce: string }).nonce };
}

async function failure(res: Response, status: number, code: string, message?: string) {
  expect(res.status).toBe(status);
  const body = (await res.json()) as { error: { code: string; message: string } };
  expect(body.error.code).toBe(code);
  if (message !== undefined) expect(body.error.message).toBe(message);
}

describe("scraps side app", () => {
  let h: Harness;
  let app: Hono;
  beforeEach(async () => {
    h = await harness();
    app = sideApp(h);
  });
  afterEach(async () => {
    await h.close();
  });

  test("AC1: current sketch lines are stable index scraps with consts and metadata", async () => {
    const s = await sketch(h);
    const before = all(h.server.deps.db, "SELECT * FROM sketch_versions");
    const items = await list(app);
    expect(items).toHaveLength(4);
    expect(items.map((x) => x.label)).toEqual(["drums", "bass", "chords", "mel"]);
    expect(items.map((x) => x.role)).toEqual(["drums", "bass", "chords", "tune"]);
    for (const [position, item] of items.entries()) {
      expect(item).toMatchObject({
        id: `idx_${s.id}_v1_${position}`,
        origin: "index",
        bpm: 96,
        meter: "4/4",
        key: { tonic: "C", mode: "major" },
        sketchId: s.id,
        sketchVersion: 1,
        sourceKind: "sketch",
        sourceRef: null,
        createdAt: s.versions[0]?.createdAt,
      });
      expect(item).not.toHaveProperty("reviewBeforeRun");
    }
    expect(items[2]?.code).toBe('const changes = "<C Am F G>"\nchords: chord(changes).voicing().s("piano")');
    expect(await list(app)).toEqual(items);
    expect(new ScrapsRepo(h.server.deps.db).list()).toEqual([]);
    expect(all(h.server.deps.db, "SELECT * FROM sketch_versions")).toEqual(before);
  });

  test("AC2: a new version replaces the index on the next list", async () => {
    const s = await sketch(h);
    expect(await list(app)).toHaveLength(4);
    h.clock.advance(1000);
    const edited = await h.json("POST", `/api/sketches/${s.id}/versions`, versionBody(CODE_V2));
    expect(edited.status).toBe(200);
    const items = await list(app);
    expect(items.map((x) => x.label)).toEqual(["drums", "bass", "chords", "hats"]);
    expect(items.map((x) => x.sketchVersion)).toEqual([2, 2, 2, 2]);
    expect(items.map((x) => x.id)).toEqual([0, 1, 2, 3].map((i) => `idx_${s.id}_v2_${i}`));
    expect(items.every((x) => x.createdAt === h.clock.now().toISOString())).toBe(true);
  });

  test("AC3: deleting a sketch removes its index and preserves a saved copy", async () => {
    const s = await sketch(h);
    const saved = await save(app, { ...LESSON, sourceKind: "sketch", sourceRef: `${s.id}@1` });
    const deleted = await h.destructive("DELETE", `/api/sketches/${s.id}`, "sketch.delete", s.id);
    expect(deleted.status).toBe(200);
    expect(await list(app)).toEqual([saved]);
    expect(saved).toMatchObject({ sketchId: s.id, sketchVersion: 1 });
    expect(h.server.deps.repos.sketches.version(s.id, 1)).toBeNull();
  });

  test("AC4: archiving hides index scraps and unarchiving restores them", async () => {
    const s = await sketch(h);
    const original = await list(app);
    expect(original).toHaveLength(4);
    expect((await h.json("PATCH", `/api/sketches/${s.id}`, { archived: true })).status).toBe(200);
    expect(await list(app)).toEqual([]);
    expect((await h.json("PATCH", `/api/sketches/${s.id}`, { archived: false })).status).toBe(200);
    expect(await list(app)).toEqual(original);
  });

  test("AC5: role and origin filters combine; an unknown role fails with 400", async () => {
    const s = await sketch(h);
    const saved = await save(app);
    const bass = await list(app, "?role=bass");
    expect(bass).toHaveLength(2);
    expect(bass.every((x) => x.role === "bass")).toBe(true);
    expect(bass.map((x) => x.origin).sort()).toEqual(["index", "saved"]);
    expect(await list(app, "?origin=saved")).toEqual([saved]);
    const drums = await list(app, "?origin=index&role=drums");
    expect(drums).toHaveLength(1);
    expect(drums[0]).toMatchObject({ id: `idx_${s.id}_v1_0`, role: "drums", origin: "index" });
    await failure(await request(app, "GET", "/api/scraps?role=nope"), 400, "bad_request");
  });

  test("AC6: a saved lesson scrap uses the service clock and has no review flag", async () => {
    const saved = await save(app);
    expect(saved.id).toMatch(/^scr_/);
    expect(saved).toEqual({
      ...LESSON,
      id: saved.id,
      origin: "saved",
      createdAt: h.clock.now().toISOString(),
      sketchId: null,
      sketchVersion: null,
    });
    expect(saved).not.toHaveProperty("reviewBeforeRun");
    expect(await list(app)).toEqual([saved]);
    expect(new ScrapsRepo(h.server.deps.db).get(saved.id)?.review_before_run).toBe(0);
  });

  test("AC7: sketch references require valid syntax and an existing version", async () => {
    const s = await sketch(h);
    await failure(
      await request(app, "POST", "/api/scraps", { ...LESSON, sourceKind: "sketch", sourceRef: "nope" }),
      400,
      "bad_request",
      "a line saved from a sketch names it as <sketch id>@<version>",
    );
    await failure(
      await request(app, "POST", "/api/scraps", { ...LESSON, sourceKind: "sketch", sourceRef: `${s.id}@9` }),
      404,
      "not_found",
      `sketch ${s.id} version 9 not found`,
    );
    expect(await list(app, "?origin=saved")).toEqual([]);
    const saved = await save(app, { ...LESSON, sourceKind: "sketch", sourceRef: `${s.id}@1` });
    expect(saved).toMatchObject({ sketchId: s.id, sketchVersion: 1 });
  });

  test("AC8: delete requires a nonce, refuses index scraps, and reports missing ids", async () => {
    const s = await sketch(h);
    const saved = await save(app);
    const path = `/api/scraps/${saved.id}`;
    await failure(await request(app, "DELETE", path), 428, "confirm_required");
    expect(await list(app, "?origin=saved")).toEqual([saved]);
    const deleted = await request(app, "DELETE", path, undefined, await nonce(h, saved.id));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true });
    expect(await list(app, "?origin=saved")).toEqual([]);
    const indexId = indexScrapId(s.id, 1, 0);
    await failure(
      await request(app, "DELETE", `/api/scraps/${indexId}`, undefined, await nonce(h, indexId)),
      409,
      "conflict",
      "a line of a sketch goes with that line: change it in the sketch",
    );
    await failure(
      await request(app, "DELETE", "/api/scraps/scr_unknown", undefined, await nonce(h, "scr_unknown")),
      404,
      "not_found",
      "scrap scr_unknown not found",
    );
    expect(await list(app, "?origin=index")).toHaveLength(4);
  });

  test("AC11: a foreign Host receives 403 on all three routes and changes nothing", async () => {
    await sketch(h);
    const saved = await save(app);
    const before = await list(app);
    const foreign = { host: "evil.example:8787" };
    await failure(await request(app, "GET", "/api/scraps", undefined, foreign), 403, "forbidden");
    await failure(await request(app, "POST", "/api/scraps", LESSON, foreign), 403, "forbidden");
    await failure(
      await request(app, "DELETE", `/api/scraps/${saved.id}`, undefined, {
        ...(await nonce(h, saved.id)),
        ...foreign,
      }),
      403,
      "forbidden",
    );
    expect(await list(app)).toEqual(before);
    expect(new ScrapsRepo(h.server.deps.db).list()).toHaveLength(1);
  });

  test("AC12: muted lines and repeated anonymous labels keep their own statements", async () => {
    const code = '_hats: s("hh*8")\n$: s("bd*4")\n$: note("c4").s("piano")\nbass_: note("c2")';
    const s = await sketch(h, code);
    const items = await list(app);
    expect(items.map((x) => x.label)).toEqual(["_hats", "$", "$", "bass_"]);
    expect(items.map((x) => x.role)).toEqual(["drums", "other", "other", "bass"]);
    expect(items.map((x) => x.code)).toEqual(code.split("\n"));
    expect(items.map((x) => x.id)).toEqual([0, 1, 2, 3].map((i) => `idx_${s.id}_v1_${i}`));
  });

  test("AC13: unlabelled sketches add nothing; saved and index scraps interleave newest first", async () => {
    await sketch(h, 'setcpm(96/4)\nconst changes = "<C Am>"');
    expect(await list(app)).toEqual([]);
    const old = await save(app);
    h.clock.advance(1000);
    const s = await sketch(h);
    h.clock.advance(1000);
    const recent = await save(app);
    expect((await list(app)).map((x) => x.id)).toEqual([
      recent.id,
      ...[0, 1, 2, 3].map((i) => `idx_${s.id}_v1_${i}`),
      old.id,
    ]);
    const tied = await save(app);
    expect((await list(app)).slice(0, 2).map((x) => x.id)).toEqual([recent.id, tied.id].sort());
    const repo = new ScrapsRepo(h.server.deps.db);
    expect(repo.list().map((x) => x.id)).toEqual([[recent.id, tied.id].sort(), old.id].flat());
  });

  test("AC14: API scrap roles equal the shared studio roles", () => {
    expect(SCRAP_ROLES).toEqual(STUDIO_ROLES);
  });

  test("edited backup enums fall back or are skipped without deleting saved data", async () => {
    const unknownRole = await save(app);
    const unknownSource = await save(app);
    const nullable = await save(app, { ...LESSON, role: null, label: null, sourceRef: null });
    run(h.server.deps.db, "UPDATE scraps SET role = ? WHERE id = ?", "future-role", unknownRole.id);
    run(
      h.server.deps.db,
      "UPDATE scraps SET source_kind = ? WHERE id = ?",
      "future-source",
      unknownSource.id,
    );
    const items = await list(app);
    expect(items).toHaveLength(2);
    expect(items.find((x) => x.id === unknownRole.id)).toEqual({ ...unknownRole, role: "other" });
    expect(items.find((x) => x.id === nullable.id)).toEqual(nullable);
    expect(new ScrapsRepo(h.server.deps.db).list()).toHaveLength(3);
  });
});

describe("scraps backup round-trip", () => {
  let a: Harness;
  let b: Harness;
  beforeEach(async () => {
    a = await harness();
    b = await harness();
  });
  afterEach(async () => {
    await a.close();
    await b.close();
  });

  async function importBackup(): Promise<Hono> {
    const exported = await a.req("GET", "/api/backup/export?audio=0");
    expect(exported.status).toBe(200);
    const bytes = new Uint8Array(await exported.arrayBuffer());
    const imported = await b.destructive("POST", "/api/backup/import", "backup.import", "*", bytes);
    expect(imported.status).toBe(200);
    // Built after import as W1's Global Constraints ask, so the side app reads only the imported rows.
    return sideApp(b);
  }

  test("AC9: index scraps of an imported version carry reviewBeforeRun", async () => {
    const s = await sketch(a);
    const original = await list(sideApp(a));
    expect(original).toHaveLength(4);
    for (const item of original) expect(item).not.toHaveProperty("reviewBeforeRun");
    const app = await importBackup();
    expect(await list(app)).toEqual(original.map((x) => ({ ...x, reviewBeforeRun: true })));
    expect(b.server.deps.repos.sketches.version(s.id, 1)?.flags.reviewBeforeRun).toBe(true);
  });

  test("AC10: backup keeps every saved scrap field and marks its code for review", async () => {
    const saved = await save(sideApp(a));
    const app = await importBackup();
    expect(await list(app)).toEqual([{ ...saved, reviewBeforeRun: true }]);
    expect(new ScrapsRepo(b.server.deps.db).get(saved.id)?.review_before_run).toBe(1);
  });

  test("backup marks both historical and current sketch versions for review", async () => {
    const s = await sketch(a);
    expect((await a.json("POST", `/api/sketches/${s.id}/versions`, versionBody(CODE_V2))).status).toBe(200);
    const app = await importBackup();
    const versions = b.server.deps.repos.sketches.versions(s.id);
    expect(versions).toHaveLength(2);
    expect(versions.map((x) => x.flags.reviewBeforeRun)).toEqual([true, true]);
    const items = await list(app);
    expect(items).toHaveLength(4);
    expect(items.every((x) => x.sketchVersion === 2 && x.reviewBeforeRun === true)).toBe(true);
  });
});
