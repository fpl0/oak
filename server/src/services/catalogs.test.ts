// Oak 2.0 W3 catalog of attributes (PLAN §4 S6): `catalogs.list` and `catalogs.create`, served through a side app
// (the W3 integrator mounts `catalogsRoutes` in app.ts in stage B), with the real API security, contract validation
// and backup. The reference must exist (a unit song of the content, a transcription, an audio file); an "Outside your
// lane" reference is the learner's own words.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Catalog, SketchSaved } from "@oak/api";
import { Hono } from "hono";
import { unitSongs } from "../../../content/unit-songs/index.ts";
import { fixtureContent } from "../content/fixture.ts";
import type { ContentSource } from "../content/types.ts";
import { ApiError, errorResponse } from "../errors.ts";
import { catalogsRoutes } from "../routes/catalogs.ts";
import { createMounter } from "../routes/define.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, type Harness, harness } from "../testing/harness.ts";
import { CatalogsService } from "./catalogs.ts";

const SONG_ID = unitSongs[0]?.id ?? "usong.U01";
/** The fixture content plus the real first unit song, so a `song` reference resolves. */
const content = (): ContentSource => ({ ...fixtureContent(), unitSongs: unitSongs.slice(0, 1) });

/** The catalogs routes on their own app, over the harness server's services, security and confirm store. */
function sideApp(h: Harness) {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  catalogsRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    new CatalogsService(h.server.deps.services.ctx),
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

const LINES = {
  tempo: "slow, about 70",
  sound: "a warm piano and soft drums",
  harmony: "two chords back and forth",
  melody: "a high tune that falls",
  rhythm: "the kick on every beat",
  form: "one loop, then a quieter part",
};

const body = (over: Record<string, unknown> = {}) => ({
  refKind: "song",
  refId: SONG_ID,
  lines: LINES,
  sketchId: null,
  ...over,
});

async function newSketch(h: Harness): Promise<string> {
  const r = await h.json<SketchSaved>("POST", "/api/sketches", {
    title: "From my catalog",
    originKind: "free",
    originId: null,
    sessionId: null,
    code: "setcpm(72/4)\n// Written from my catalog",
    bpm: 72,
    meter: "4/4",
    key: null,
    analysis: null,
    note: "From my catalog",
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
  });
  expect(r.status).toBe(200);
  return r.body.sketch.id;
}

let h: Harness;
beforeEach(async () => {
  h = await harness({ content: content(), now: "2026-11-25T09:00:00.000Z" });
});
afterEach(async () => {
  await h.close();
});

describe("catalogs.create", () => {
  test("a unit song reference with six lines → 200 with createdAt and the lines", async () => {
    const api = sideApp(h);
    const res = await api<Catalog>("POST", "/api/catalogs", body());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      refKind: "song",
      refId: SONG_ID,
      lines: LINES,
      sketchId: null,
      createdAt: "2026-11-25T09:00:00.000Z",
    });
    expect(res.body.id).toMatch(/^cat_/);
  });

  test("empty lines are kept as empty", async () => {
    const api = sideApp(h);
    const lines = { ...LINES, sound: "", rhythm: "" };
    const res = await api<Catalog>("POST", "/api/catalogs", body({ lines }));
    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual(lines);
  });

  test("an unknown song, transcription or audio id → 400", async () => {
    const api = sideApp(h);
    expect((await api("POST", "/api/catalogs", body({ refId: "usong.U99" }))).status).toBe(400);
    expect(
      (await api("POST", "/api/catalogs", body({ refKind: "transcription", refId: "tr_nope" }))).status,
    ).toBe(400);
    expect((await api("POST", "/api/catalogs", body({ refKind: "audio", refId: "au_nope" }))).status).toBe(
      400,
    );
  });

  test("an outside reference is the learner's own words → 200", async () => {
    const api = sideApp(h);
    const res = await api<Catalog>(
      "POST",
      "/api/catalogs",
      body({ refKind: "outside", refId: "Reggaeton — a track" }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refKind: "outside", refId: "Reggaeton — a track" });
  });

  test("a sketchId of an existing sketch is kept; an unknown one → 400", async () => {
    const api = sideApp(h);
    const id = await newSketch(h);
    const res = await api<Catalog>("POST", "/api/catalogs", body({ sketchId: id }));
    expect(res.status).toBe(200);
    expect(res.body.sketchId).toBe(id);
    expect((await api("POST", "/api/catalogs", body({ sketchId: "sk_gone" }))).status).toBe(400);
  });

  test("refKind film, a line of 401 characters, a missing line → 400", async () => {
    const api = sideApp(h);
    expect((await api("POST", "/api/catalogs", body({ refKind: "film" }))).status).toBe(400);
    expect(
      (await api("POST", "/api/catalogs", body({ lines: { ...LINES, form: "x".repeat(401) } }))).status,
    ).toBe(400);
    expect(
      (await api("POST", "/api/catalogs", body({ lines: { ...LINES, form: "x".repeat(400) } }))).status,
    ).toBe(200);
    const { form: _form, ...five } = LINES;
    expect((await api("POST", "/api/catalogs", body({ lines: five }))).status).toBe(400);
  });
});

describe("catalogs.list", () => {
  test("newest first; ?refKind and ?refKind&refId filter", async () => {
    const api = sideApp(h);
    const a = await api<Catalog>("POST", "/api/catalogs", body());
    h.clock.advance(60_000);
    const b = await api<Catalog>(
      "POST",
      "/api/catalogs",
      body({ refKind: "outside", refId: "Reggaeton — a track" }),
    );
    h.clock.advance(60_000);
    const c = await api<Catalog>("POST", "/api/catalogs", body({ lines: { ...LINES, tempo: "fast" } }));
    const ids = (r: { body: { items: Catalog[] } }) => r.body.items.map((i) => i.id);
    const listed = await api<{ items: Catalog[] }>("GET", "/api/catalogs");
    expect(listed.status).toBe(200);
    expect(ids(listed)).toEqual([c.body.id, b.body.id, a.body.id]);
    expect(ids(await api<{ items: Catalog[] }>("GET", "/api/catalogs?refKind=outside"))).toEqual([b.body.id]);
    expect(
      ids(
        await api<{ items: Catalog[] }>(
          "GET",
          `/api/catalogs?refKind=song&refId=${encodeURIComponent(SONG_ID)}`,
        ),
      ),
    ).toEqual([c.body.id, a.body.id]);
    expect(ids(await api<{ items: Catalog[] }>("GET", "/api/catalogs?refKind=audio"))).toEqual([]);
  });

  test("two catalogs made in the same instant list newest first (rowid)", async () => {
    const api = sideApp(h);
    const a = await api<Catalog>("POST", "/api/catalogs", body());
    const b = await api<Catalog>("POST", "/api/catalogs", body());
    const listed = await api<{ items: Catalog[] }>("GET", "/api/catalogs");
    expect(listed.body.items.map((i) => i.id)).toEqual([b.body.id, a.body.id]);
  });
});

describe("security and backup", () => {
  test("a foreign Host is refused on both", async () => {
    const api = sideApp(h);
    const evil = { host: "evil.example:8787" };
    expect((await api("GET", "/api/catalogs", undefined, evil)).status).toBe(403);
    expect((await api("POST", "/api/catalogs", body(), evil)).status).toBe(403);
  });

  test("a backup export → import keeps the catalogs", async () => {
    const b = await harness({ content: content(), now: "2026-11-25T09:00:00.000Z" });
    try {
      const api = sideApp(h);
      await api("POST", "/api/catalogs", body());
      await api("POST", "/api/catalogs", body({ refKind: "outside", refId: "Cumbia — a track" }));
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
      const list = await onB<{ items: Catalog[] }>("GET", "/api/catalogs");
      expect(list.body.items.map((i) => [i.refKind, i.refId, i.lines])).toEqual([
        ["outside", "Cumbia — a track", LINES],
        ["song", SONG_ID, LINES],
      ]);
    } finally {
      await b.close();
    }
  });
});
