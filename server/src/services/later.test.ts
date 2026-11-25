// Oak 2.0 W1 Later list (PLAN S7): `later.list`, `later.create`, `later.patch`, served through a side app (the W1
// integrator mounts `laterRoutes` in app.ts), with the real API security, contract validation and backup.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { LaterItem } from "@oak/api";
import { Hono } from "hono";
import { ApiError, errorResponse } from "../errors.ts";
import { createMounter } from "../routes/define.ts";
import { laterRoutes } from "../routes/later.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, type Harness, harness } from "../testing/harness.ts";
import { LaterService } from "./later.ts";

/** The Later routes on their own app, over the harness server's services, security and confirm store. */
function sideApp(h: Harness) {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  laterRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    new LaterService(h.server.deps.services.ctx),
  );
  return async <T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: T }> => {
    const init: RequestInit = { method, headers: { ...BROWSER, ...headers } };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)["content-type"] = "application/json";
    }
    const res = await app.request(`http://127.0.0.1:8787${path}`, init);
    const text = await res.text();
    return { status: res.status, body: (text === "" ? null : JSON.parse(text)) as T };
  };
}

let h: Harness;
beforeEach(async () => {
  h = await harness({ now: "2026-11-25T09:00:00.000Z" });
});
afterEach(async () => {
  await h.close();
});

describe("the Later list", () => {
  test("create keeps the text and source, with doneAt null; blank text is refused", async () => {
    const api = sideApp(h);
    const res = await api<LaterItem>("POST", "/api/later", {
      text: "  what a tritone sub is ",
      source: "tutor",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      text: "what a tritone sub is",
      source: "tutor",
      doneAt: null,
      createdAt: "2026-11-25T09:00:00.000Z",
    });
    expect(res.body.id).toMatch(/^lat_/);
    expect((await api("POST", "/api/later", { text: "x", source: null })).body).toMatchObject({
      source: null,
    });
    expect((await api("POST", "/api/later", { text: "  ", source: "learner" })).status).toBe(400);
    expect((await api("POST", "/api/later", { text: "x".repeat(501), source: "learner" })).status).toBe(400);
    expect((await api("POST", "/api/later", { text: "x", source: "band" })).status).toBe(400);
  });

  test("list: open items oldest first, then done ones; ?done=1 only done, ?done=0 only open", async () => {
    const api = sideApp(h);
    const make = async (text: string) => {
      const r = await api<LaterItem>("POST", "/api/later", { text, source: "learner" });
      h.clock.advance(60_000);
      return r.body;
    };
    const a = await make("first");
    const b = await make("second");
    const c = await make("third");
    expect((await api("PATCH", `/api/later/${b.id}`, { done: true })).status).toBe(200);
    const texts = (r: { body: { items: LaterItem[] } }) => r.body.items.map((i) => i.text);
    expect(texts(await api("GET", "/api/later"))).toEqual(["first", "third", "second"]);
    expect(texts(await api("GET", "/api/later?done=0"))).toEqual(["first", "third"]);
    expect(texts(await api("GET", "/api/later?done=1"))).toEqual(["second"]);
    expect([a.text, c.text]).toEqual(["first", "third"]);
  });

  test("patch: done sets doneAt to the clock, undone clears it, text renames; unknown id is 404", async () => {
    const api = sideApp(h);
    const { body: item } = await api<LaterItem>("POST", "/api/later", { text: "modes", source: "learner" });
    h.clock.set("2026-11-26T18:30:00.000Z");
    const done = await api<LaterItem>("PATCH", `/api/later/${item.id}`, { done: true });
    expect(done.status).toBe(200);
    expect(done.body.doneAt).toBe("2026-11-26T18:30:00.000Z");
    const undone = await api<LaterItem>("PATCH", `/api/later/${item.id}`, { done: false });
    expect(undone.body.doneAt).toBeNull();
    const renamed = await api<LaterItem>("PATCH", `/api/later/${item.id}`, { text: "Dorian mode" });
    expect(renamed.body).toMatchObject({ text: "Dorian mode", doneAt: null, source: "learner" });
    expect((await api("PATCH", `/api/later/${item.id}`, { text: " " })).status).toBe(400);
    expect((await api("PATCH", "/api/later/lat_nope", { done: true })).status).toBe(404);
  });

  test("a foreign Host is refused on all three", async () => {
    const api = sideApp(h);
    const { body: item } = await api<LaterItem>("POST", "/api/later", { text: "x", source: null });
    const evil = { host: "evil.example:8787" };
    expect((await api("GET", "/api/later", undefined, evil)).status).toBe(403);
    expect((await api("POST", "/api/later", { text: "y", source: null }, evil)).status).toBe(403);
    expect((await api("PATCH", `/api/later/${item.id}`, { done: true }, evil)).status).toBe(403);
  });

  test("a backup export → import keeps the items", async () => {
    const b = await harness({ now: "2026-11-25T09:00:00.000Z" });
    try {
      const api = sideApp(h);
      await api("POST", "/api/later", { text: "voice leading", source: "tutor" });
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
      const onB = sideApp(b); // built after the import
      const list = await onB<{ items: LaterItem[] }>("GET", "/api/later");
      expect(list.body.items.map((i) => [i.text, i.source])).toEqual([["voice leading", "tutor"]]);
    } finally {
      await b.close();
    }
  });
});
