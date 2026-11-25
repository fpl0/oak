import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { SketchCreate, SketchSaved, UserTemplate, UserTemplateCreate } from "@oak/api";
import { evalHeadless } from "@oak/grader/testing";
import { Hono } from "hono";
import { all } from "../db/index.ts";
import { ApiError, errorResponse } from "../errors.ts";
import { createMounter } from "../routes/define.ts";
import { templatesRoutes } from "../routes/templates.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, type Harness, harness, ORIGIN } from "../testing/harness.ts";
import { templateOfCode } from "./template-code.ts";
import { UserTemplatesService } from "./user-templates.ts";

const SKETCH_CODE =
  'setcpm(96/3)\n\ndrums: s("bd ~ sd").bank("oak909")\nbass: note("c2 ~ g1").s("ebass").lpf(600)';
const TEMPLATE_CODE = 'setcpm(96/3)\n\ndrums: s("~").bank("oak909")\nbass: note("~").s("ebass").lpf(600)\n';
const DIRECT_CODE = 'setcpm(80/4)\n\nmel: n("~").s("piano")\n';
const NOW = "2026-11-25T20:00:00.000Z";

function templateBody(over: Partial<UserTemplateCreate> = {}): UserTemplateCreate {
  return {
    name: "Piano",
    isBlank: false,
    fromSketch: null,
    code: DIRECT_CODE,
    bpm: 80,
    meter: "4/4",
    ...over,
  };
}

async function sketch(h: Harness, extra: Partial<SketchCreate> = {}): Promise<string> {
  const body: SketchCreate = {
    title: "Groove",
    originKind: "free",
    originId: null,
    sessionId: null,
    code: SKETCH_CODE,
    bpm: 96,
    meter: "3/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
    ...extra,
  };
  const saved = await h.json<SketchSaved>("POST", "/api/sketches", body);
  expect(saved.status).toBe(200);
  return saved.body.sketch.id;
}

function sideApp(h: Harness) {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  templatesRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    new UserTemplatesService(h.server.deps.services.ctx),
  );
  const req = async (
    method: string,
    path = "/api/templates",
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    app.request(`${ORIGIN}${path}`, {
      method,
      headers: {
        ...BROWSER,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return {
    req,
    async create(body: UserTemplateCreate): Promise<UserTemplate> {
      const res = await req("POST", "/api/templates", body);
      expect(res.status).toBe(200);
      return res.json() as Promise<UserTemplate>;
    },
    async list(): Promise<UserTemplate[]> {
      const res = await req("GET");
      expect(res.status).toBe(200);
      return ((await res.json()) as { items: UserTemplate[] }).items;
    },
    async patch(id: string, body: unknown): Promise<UserTemplate> {
      const res = await req("PATCH", `/api/templates/${id}`, body);
      expect(res.status).toBe(200);
      return res.json() as Promise<UserTemplate>;
    },
  };
}

async function nonce(h: Harness, target: string): Promise<Record<string, string>> {
  const res = await h.json<{ nonce: string }>("POST", "/api/confirm", { action: "template.delete", target });
  expect(res.status).toBe(200);
  expect(typeof res.body.nonce).toBe("string");
  return { "x-oak-confirm": res.body.nonce };
}

async function makeBlank(h: Harness, app: ReturnType<typeof sideApp>): Promise<UserTemplate> {
  const id = await sketch(h);
  return app.create(
    templateBody({
      name: "My Blank",
      isBlank: true,
      fromSketch: { sketchId: id, version: 1 },
      code: "ignored",
      bpm: 1,
      meter: "4/4",
    }),
  );
}

describe("UserTemplatesService through the secured contract side app", () => {
  let h: Harness;
  let app: ReturnType<typeof sideApp>;
  beforeEach(async () => {
    h = await harness({ now: NOW });
    app = sideApp(h);
  });
  afterEach(async () => {
    await h.close();
  });

  test("AC1 Make this my Blank keeps setup and version metadata", async () => {
    const saved = await makeBlank(h, app);
    expect(saved).toEqual({
      id: expect.stringMatching(/^tpl_/),
      name: "My Blank",
      code: TEMPLATE_CODE,
      bpm: 96,
      meter: "3/4",
      isBlank: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(saved.code).toBe(templateOfCode(SKETCH_CODE).code);
    expect(Object.hasOwn(saved, "reviewBeforeRun")).toBe(false);
    expect(await app.list()).toEqual([saved]);
  });

  test("AC2 unknown sketch and missing version return 404 without changes", async () => {
    const blank = await makeBlank(h, app);
    const id = await sketch(h);
    for (const fromSketch of [
      { sketchId: "sk_missing", version: 1 },
      { sketchId: id, version: 7 },
    ]) {
      const res = await app.req("POST", "/api/templates", templateBody({ isBlank: true, fromSketch }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: {
          code: "not_found",
          message: `sketch ${fromSketch.sketchId} version ${fromSketch.version} not found`,
        },
      });
    }
    expect(await app.list()).toEqual([blank]);
  });

  test("AC3 null code returns 400 and direct code is stored verbatim", async () => {
    const res = await app.req("POST", "/api/templates", templateBody({ code: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "bad_request", message: "a template needs code, or a sketch to start from" },
    });
    expect(await app.list()).toEqual([]);
    const saved = await app.create(templateBody());
    expect(saved).toEqual({
      id: expect.stringMatching(/^tpl_/),
      name: "Piano",
      code: DIRECT_CODE,
      bpm: 80,
      meter: "4/4",
      isBlank: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  test("AC4 creating another Blank clears the previous Blank atomically", async () => {
    const a = await app.create(templateBody({ name: "A", isBlank: true }));
    h.clock.advance(60_000);
    const b = await app.create(templateBody({ name: "B", isBlank: true }));
    const items = await app.list();
    expect(items).toEqual([b, { ...a, isBlank: false, updatedAt: h.clock.now().toISOString() }]);
    expect(items.filter((t) => t.isBlank)).toHaveLength(1);
  });

  test("AC5 patch switches the Blank and can leave no Blank", async () => {
    const a = await app.create(templateBody({ name: "A", isBlank: true }));
    const b = await app.create(templateBody({ name: "B", isBlank: true }));
    h.clock.advance(60_000);
    const selected = await app.patch(a.id, { isBlank: true });
    expect(selected).toEqual({ ...a, updatedAt: h.clock.now().toISOString() });
    expect(await app.list()).toEqual([selected, { ...b, isBlank: false, updatedAt: selected.updatedAt }]);
    expect((await app.list()).filter((t) => t.isBlank)).toHaveLength(1);
    expect((await app.patch(a.id, { isBlank: false })).isBlank).toBe(false);
    expect((await app.list()).filter((t) => t.isBlank)).toHaveLength(0);
  });

  test("AC6 list puts the Blank first then sorts names and ids", async () => {
    await app.create(templateBody({ name: "Bright" }));
    await app.create(templateBody({ name: "Ambient" }));
    await app.create(templateBody({ name: "My Blank", isBlank: true }));
    expect((await app.list()).map((t) => t.name)).toEqual(["My Blank", "Ambient", "Bright"]);
    const twin = await app.create(templateBody({ name: "Ambient" }));
    const names = (await app.list()).filter((t) => t.name === twin.name).map((t) => t.id);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("AC7 rename advances updatedAt and an empty patch changes nothing", async () => {
    const saved = await app.create(templateBody());
    h.clock.advance(60_000);
    const renamed = await app.patch(saved.id, { name: "Night set-up" });
    expect(renamed).toEqual({ ...saved, name: "Night set-up", updatedAt: h.clock.now().toISOString() });
    h.clock.advance(60_000);
    expect(await app.patch(saved.id, {})).toEqual(renamed);
    expect(await app.list()).toEqual([renamed]);
  });

  test("AC8 delete requires its nonce, returns 404 for unknown ids, and can remove the Blank", async () => {
    const saved = await app.create(templateBody({ isBlank: true }));
    const path = `/api/templates/${saved.id}`;
    expect((await app.req("DELETE", path)).status).toBe(428);
    expect(await app.list()).toEqual([saved]);
    const res = await app.req("DELETE", path, undefined, await nonce(h, saved.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await app.list()).toEqual([]);
    expect((await app.list()).filter((t) => t.isBlank)).toHaveLength(0);
    const missing = await app.req(
      "DELETE",
      "/api/templates/tpl_missing",
      undefined,
      await nonce(h, "tpl_missing"),
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: { code: "not_found", message: "template tpl_missing not found" },
    });
  });

  test("AC9 unknown patch returns 404 and an empty name returns 400", async () => {
    const saved = await app.create(templateBody());
    const missing = await app.req("PATCH", "/api/templates/tpl_missing", { name: "New" });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: { code: "not_found", message: "template tpl_missing not found" },
    });
    expect((await app.req("PATCH", `/api/templates/${saved.id}`, { name: "" })).status).toBe(400);
    expect(await app.list()).toEqual([saved]);
  });

  test("AC10 the stored Blank plays no note", async () => {
    const saved = await makeBlank(h, app);
    const stored = (await app.list()).find((t) => t.id === saved.id);
    expect(stored).toBeDefined();
    expect((await evalHeadless(stored?.code ?? "", 2)).events).toEqual([]);
  });

  test("AC11 backup round-trip preserves both templates and flags their code for review", async () => {
    await makeBlank(h, app);
    await app.create(templateBody());
    const before = await app.list();
    const exported = await h.req("GET", "/api/backup/export?audio=0");
    expect(exported.status).toBe(200);
    const bytes = new Uint8Array(await exported.arrayBuffer());
    const b = await harness({ now: NOW });
    try {
      const imported = await b.destructive("POST", "/api/backup/import", "backup.import", "*", bytes);
      expect(imported.status).toBe(200);
      // Import replaces the database connection, so construct the service only after it finishes.
      const restored = sideApp(b);
      const items = await restored.list();
      expect(items).toEqual(before.map((t) => ({ ...t, reviewBeforeRun: true })));
      expect(items.filter((t) => t.isBlank)).toHaveLength(1);
      const blank = items.find((t) => t.isBlank);
      expect(blank).toBeDefined();
      const renamed = await restored.patch(blank?.id ?? "", { name: "Restored", isBlank: true });
      expect(renamed.reviewBeforeRun).toBe(true);
      expect((await restored.list()).every((t) => t.reviewBeforeRun === true)).toBe(true);
    } finally {
      await b.close();
    }
  });

  test("AC12 foreign Host is refused for every route and changes nothing", async () => {
    const saved = await app.create(templateBody({ isBlank: true }));
    const path = `/api/templates/${saved.id}`;
    const validNonce = await nonce(h, saved.id);
    const headers = { ...BROWSER, host: "evil.example:8787", ...validNonce };
    for (const [method, target, body] of [
      ["GET", "/api/templates", undefined],
      ["POST", "/api/templates", templateBody({ isBlank: true })],
      ["PATCH", path, { name: "Changed", isBlank: false }],
      ["DELETE", path, undefined],
    ] as const) {
      const res = await app.req(method, target, body, headers);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: { code: "forbidden", message: "request refused (host)" } });
      expect(await app.list()).toEqual([saved]);
    }
    expect(h.server.deps.confirm.consume(validNonce["x-oak-confirm"], "template.delete", saved.id)).toBe(
      true,
    );
  });

  test("a template from an imported sketch retains reviewBeforeRun", async () => {
    const id = await sketch(h, { flags: { lockedTools: [], previewTools: [], reviewBeforeRun: true } });
    const saved = await app.create(templateBody({ fromSketch: { sketchId: id, version: 1 } }));
    expect(saved.reviewBeforeRun).toBe(true);
    expect(await app.list()).toEqual([saved]);
    expect(h.learner.calls).toEqual([]);
  });

  test("a failed insert or patch rolls back clearing the previous Blank", async () => {
    const a = await app.create(templateBody({ name: "A", isBlank: true }));
    const b = await app.create(templateBody({ name: "B" }));
    const db = h.server.deps.db;
    db.run(
      "CREATE TEMP TRIGGER refuse_template_insert BEFORE INSERT ON user_templates BEGIN SELECT RAISE(ABORT, 'test insert failure'); END",
    );
    expect((await app.req("POST", "/api/templates", templateBody({ isBlank: true }))).status).toBe(500);
    expect(await app.list()).toEqual([a, b]);
    db.run("DROP TRIGGER refuse_template_insert");
    db.run(
      "CREATE TEMP TRIGGER refuse_template_blank BEFORE UPDATE OF is_blank ON user_templates WHEN NEW.is_blank = 1 BEGIN SELECT RAISE(ABORT, 'test patch failure'); END",
    );
    expect((await app.req("PATCH", `/api/templates/${b.id}`, { isBlank: true })).status).toBe(500);
    expect(await app.list()).toEqual([a, b]);
    expect(
      all<{ count: number }>(db, "SELECT COUNT(*) AS count FROM user_templates WHERE is_blank = 1"),
    ).toEqual([{ count: 1 }]);
  });

  test("delete nonce is bound to its target and consumed only once", async () => {
    const a = await app.create(templateBody({ name: "A" }));
    const b = await app.create(templateBody({ name: "B" }));
    const headers = await nonce(h, a.id);
    expect((await app.req("DELETE", `/api/templates/${b.id}`, undefined, headers)).status).toBe(428);
    expect(await app.list()).toEqual([a, b]);
    const valid = await nonce(h, a.id);
    expect((await app.req("DELETE", `/api/templates/${a.id}`, undefined, valid)).status).toBe(200);
    expect((await app.req("DELETE", `/api/templates/${a.id}`, undefined, valid)).status).toBe(428);
    expect(await app.list()).toEqual([b]);
  });
});
