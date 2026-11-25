// Oak 2.0 W4 F6 (docs/oak2/PLAN.md §6, "Fail Better"): the Shelf. A finished piece can be kept off the album: a
// B-side created shelved, a track patched onto the Shelf and back (`album.patchTrack`, served by `libraryRoutes`
// through a side app until the W4 integrator lists it as built), and a capstone released to the Shelf. A shelved
// piece counts as finished (it stays released, its side still counts it), `album.get` lists it under `shelf` only,
// its sketch's lines stay scraps, and a backup keeps it. Nothing the learner made is lost (contracts §13.4 rule 3).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Album, AlbumTrackDetail, CapstoneReleaseResult, Scrap } from "@oak/api";
import { Hono } from "hono";
import { ApiError, errorResponse } from "../errors.ts";
import { createMounter } from "../routes/define.ts";
import { libraryRoutes } from "../routes/library.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, gradeResult, type Harness, harness } from "../testing/harness.ts";

/** The library routes on their own app, over the harness server's services, security and confirm store. */
function sideApp(h: Harness) {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  libraryRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    h.server.deps,
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

const SKETCH = {
  originKind: "free",
  originId: null,
  sessionId: null,
  title: "Half a song",
  code: 'setcpm(96/4)\ndrums: s("bd ~ sd ~")\nbass: note("c2 ~ g1 ~").s("ebass")',
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

let h: Harness;
beforeEach(async () => {
  h = await harness({ dev: true, now: "2026-11-25T12:00:00.000Z" });
  h.server.deps.repos.profile.patch({ timezone: "UTC" });
});
afterEach(async () => {
  await h.close();
});

async function sketch(over: Record<string, unknown> = {}): Promise<string> {
  const r = await h.json<{ sketch: { id: string } }>("POST", "/api/sketches", { ...SKETCH, ...over });
  expect(r.status).toBe(200);
  return r.body.sketch.id;
}

const bside = (sketchId: string, over: Record<string, unknown> = {}) => ({
  capstoneId: null,
  side: "Bside",
  title: "Finished anyway",
  flavour: null,
  sketchId,
  sketchVersion: 1,
  linerNotesMd: "",
  theoryTags: [],
  attribution: null,
  ...over,
});

const ids = (xs: readonly { id: string }[] | undefined) => (xs ?? []).map((t) => t.id);

describe("the Shelf on the album", () => {
  test("a B-side created shelved never appears in tracks", async () => {
    const api = sideApp(h);
    const made = await api<AlbumTrackDetail>(
      "POST",
      "/api/album/tracks",
      bside(await sketch(), { shelved: true }),
    );
    expect(made.status).toBe(200);
    expect(made.body.shelved).toBe(true);
    const album = await api<Album>("GET", "/api/album");
    expect(album.status).toBe(200);
    expect(ids(album.body.tracks)).not.toContain(made.body.id);
    expect(ids(album.body.shelf)).toEqual([made.body.id]);
  });

  test("patch puts a track on the Shelf and back", async () => {
    const api = sideApp(h);
    const made = await api<AlbumTrackDetail>("POST", "/api/album/tracks", bside(await sketch()));
    expect(made.body.shelved).toBe(false);
    const id = made.body.id;
    const on = await api<AlbumTrackDetail>("PATCH", `/api/album/tracks/${id}`, { shelved: true });
    expect([on.status, on.body.shelved]).toEqual([200, true]);
    expect(ids((await api<Album>("GET", "/api/album")).body.shelf)).toEqual([id]);
    const off = await api<AlbumTrackDetail>("PATCH", `/api/album/tracks/${id}`, { shelved: false });
    expect([off.status, off.body.shelved]).toEqual([200, false]);
    const album = await api<Album>("GET", "/api/album");
    expect(ids(album.body.tracks)).toContain(id);
    expect(album.body.shelf).toEqual([]);
    // `{}` changes nothing; every version is still there.
    const same = await api<AlbumTrackDetail>("PATCH", `/api/album/tracks/${id}`, {});
    expect([same.status, same.body.shelved, same.body.versions.length]).toEqual([200, false, 1]);
    expect((await api("PATCH", "/api/album/tracks/trk_nope", { shelved: true })).status).toBe(404);
    expect((await api("PATCH", `/api/album/tracks/${id}`, { shelved: "yes" })).status).toBe(400);
    const foreign = await api(
      "PATCH",
      `/api/album/tracks/${id}`,
      { shelved: true },
      { host: "evil.example:8787" },
    );
    expect(foreign.status).toBe(403);
    expect((await api<AlbumTrackDetail>("GET", `/api/album/tracks/${id}`)).body.shelved).toBe(false);
  });

  test("every track row says shelved", async () => {
    const api = sideApp(h);
    const made = await api<AlbumTrackDetail>("POST", "/api/album/tracks", bside(await sketch()));
    const got = await h.json<AlbumTrackDetail>("GET", `/api/album/tracks/${made.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.shelved).toBe(false);
    const album = await h.json<Album>("GET", "/api/album");
    for (const t of album.body.tracks) expect(typeof t.shelved).toBe("boolean");
    expect(album.body.shelf).toEqual([]);
  });

  test("the sketch's lines are still listed by scraps.list", async () => {
    const sk = await sketch();
    const api = sideApp(h);
    expect((await api("POST", "/api/album/tracks", bside(sk, { shelved: true }))).status).toBe(200);
    const scraps = await h.json<{ items: Scrap[] }>("GET", "/api/scraps?origin=index");
    expect(scraps.status).toBe(200);
    const labels = scraps.body.items.filter((s) => s.id.startsWith(`idx_${sk}_`)).map((s) => s.label);
    expect(labels.sort()).toEqual(["bass", "drums"]);
  });

  test("backup round-trip keeps shelved", async () => {
    const b = await harness();
    try {
      const api = sideApp(h);
      const made = await api<AlbumTrackDetail>(
        "POST",
        "/api/album/tracks",
        bside(await sketch(), { shelved: true }),
      );
      const res = await h.req("GET", "/api/backup/export?audio=0");
      expect(res.status).toBe(200);
      const imported = await b.destructive(
        "POST",
        "/api/backup/import",
        "backup.import",
        "*",
        new Uint8Array(await res.arrayBuffer()),
      );
      expect(imported.status).toBe(200);
      const album = await b.json<Album>("GET", "/api/album");
      expect(ids(album.body.shelf)).toEqual([made.body.id]);
      expect(ids(album.body.tracks)).not.toContain(made.body.id);
    } finally {
      await b.close();
    }
  });
});

// --- a capstone released to the Shelf ------------------------------------------------------------------------

async function complete(lessonId: string) {
  const r = await h.json("POST", `/api/lessons/${lessonId}/complete`, {
    sessionId: null,
    sketchId: await sketch({ originKind: "lesson-make", originId: lessonId, title: "Make" }),
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
/** C0 open, its first session done, a draft checked at `score` (passing at 0.95): only the release is left. */
async function c0Ready(score = 0.95): Promise<string> {
  for (const l of ["U01.L01", "U01.L02", "U01.L03", "U02.L01"]) await complete(l);
  await passCheckpoint("U01.CP");
  await h.json("POST", "/api/session/start", { kind: "capstone", mapItemId: "C0.S1", targetMinutes: 20 });
  const sk = await sketch({ originKind: "capstone", originId: "C0", title: "Intro (draft)" });
  await h.json("POST", "/api/capstones/C0/checks", {
    sessionId: null,
    sketchId: sk,
    sketchVersion: 1,
    result: gradeResult({ exerciseId: "C0/brief", score, mode: "capstone" }),
  });
  await h.json("POST", "/api/capstones/C0/sessions", {
    sessionId: null,
    capstoneSessionId: "C0.S1",
    sketchId: sk,
    flavour: null,
  });
  return sk;
}
const releaseBody = (sketchId: string, over: Record<string, unknown> = {}) => ({
  sessionId: null,
  sketchId,
  sketchVersion: 1,
  title: "Intro",
  flavour: null,
  linerNotesMd: "A first beat.",
  theoryTags: ["backbeat"],
  includeReviewNote: false,
  ...over,
});

describe("a capstone released to the Shelf", () => {
  test("a capstone released to the Shelf stays released and its side still counts it", async () => {
    const sk = await c0Ready();
    const rel = await h.json<CapstoneReleaseResult>(
      "POST",
      "/api/capstones/C0/release",
      releaseBody(sk, { shelved: true }),
    );
    expect(rel.status).toBe(200);
    expect(rel.body.state.status).toBe("released");
    expect(rel.body.track.shelved).toBe(true);
    const album = await h.json<Album>("GET", "/api/album");
    expect(ids(album.body.shelf)).toEqual([rel.body.track.id]);
    expect(ids(album.body.tracks)).not.toContain(rel.body.track.id);
    expect(album.body.sides?.find((s) => s.side === "A")?.released).toBe(1);
    expect((await h.json<{ status: string }>("GET", "/api/capstones/C0")).body.status).toBe("released");
    // A revision with `shelved` absent keeps it on the Shelf…
    const v2 = await h.json<{ sketch: { currentVersion: number } }>("POST", `/api/sketches/${sk}/versions`, {
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
    });
    const kept = await h.json<CapstoneReleaseResult>(
      "POST",
      "/api/capstones/C0/release",
      releaseBody(sk, { sketchVersion: v2.body.sketch.currentVersion, linerNotesMd: "Busier hats." }),
    );
    expect(kept.status).toBe(200);
    expect([kept.body.track.currentVersion, kept.body.track.shelved]).toEqual([2, true]);
    // …and `shelved: false` puts it on the album.
    const back = await h.json<CapstoneReleaseResult>(
      "POST",
      "/api/capstones/C0/release",
      releaseBody(sk, {
        sketchVersion: v2.body.sketch.currentVersion,
        linerNotesMd: "Busier hats, on the album.",
        shelved: false,
      }),
    );
    expect(back.status).toBe(200);
    expect(back.body.track.shelved).toBe(false);
    const after = await h.json<Album>("GET", "/api/album");
    expect(ids(after.body.tracks)).toContain(rel.body.track.id);
    expect(after.body.shelf).toEqual([]);
    expect(after.body.sides?.find((s) => s.side === "A")?.released).toBe(1);
    // The same release sent again with only `shelved` changed moves the track and makes no new version.
    const again = await h.json<CapstoneReleaseResult>(
      "POST",
      "/api/capstones/C0/release",
      releaseBody(sk, {
        sketchVersion: v2.body.sketch.currentVersion,
        linerNotesMd: "Busier hats, on the album.",
        shelved: true,
      }),
    );
    expect([again.status, again.body.track.currentVersion, again.body.track.shelved]).toEqual([200, 3, true]);
  });

  test("a release still needs its required rules", async () => {
    const sk = await c0Ready(0.5);
    const r = await h.json<{ error: { message: string } }>(
      "POST",
      "/api/capstones/C0/release",
      releaseBody(sk, { shelved: true }),
    );
    expect(r.status).toBe(409);
    expect(r.body.error.message).toContain("required rule");
    expect((await h.json<Album>("GET", "/api/album")).body.shelf).toEqual([]);
  });
});
