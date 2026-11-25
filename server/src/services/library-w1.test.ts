// Oak 2.0 W1 (S3 takes, S7 commit sounds): the library stores a version's take state and lineage fields, keeps or
// cuts a take (never deleting it), and stores a sketch's committed lines and drawn cards.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Sketch, SketchDetail, SketchSaved, SketchVersion } from "@oak/api";
import { type Harness, harness } from "../testing/harness.ts";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

const versionBody = (over: Record<string, unknown> = {}) => ({
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
const sketchBody = (over: Record<string, unknown> = {}) => ({
  title: "Jam",
  originKind: "free",
  originId: null,
  ...versionBody(over),
});

async function newSketch(over: Record<string, unknown> = {}): Promise<string> {
  const r = await h.json<SketchSaved>("POST", "/api/sketches", sketchBody(over));
  expect(r.status).toBe(200);
  return r.body.sketch.id;
}

async function versionsOf(id: string): Promise<SketchVersion[]> {
  const r = await h.json<SketchDetail>("GET", `/api/sketches/${id}`);
  expect(r.status).toBe(200);
  return r.body.versions;
}

describe("takes: stored take state and lineage fields", () => {
  test("a version added with takeState open reads back open, with null lineage", async () => {
    const id = await newSketch();
    const r = await h.json<SketchSaved>(
      "POST",
      `/api/sketches/${id}/versions`,
      versionBody({ code: 'drums: s("bd*4")', takeState: "open" }),
    );
    expect(r.status).toBe(200);
    const v2 = r.body.sketch.versions.find((v) => v.version === 2);
    expect(v2).toMatchObject({ takeState: "open", parentVersion: null, generation: null, dimension: null });
    expect((await versionsOf(id)).find((v) => v.version === 2)?.takeState).toBe("open");
  });

  test("a version without the field reads back takeState null; every row carries all four fields", async () => {
    const id = await newSketch();
    await h.json("POST", `/api/sketches/${id}/versions`, versionBody({ code: 'drums: s("bd")' }));
    for (const v of await versionsOf(id)) {
      expect(v.takeState).toBeNull();
      expect(v.parentVersion).toBeNull();
      expect(v.generation).toBeNull();
      expect(v.dimension).toBeNull();
    }
  });

  test("lineage fields round-trip when given", async () => {
    const id = await newSketch();
    const r = await h.json<SketchSaved>(
      "POST",
      `/api/sketches/${id}/versions`,
      versionBody({ code: 'drums: s("bd sd")', parentVersion: 1, generation: 1, dimension: "rhythm" }),
    );
    expect(r.body.sketch.versions.at(-1)).toMatchObject({
      takeState: null,
      parentVersion: 1,
      generation: 1,
      dimension: "rhythm",
    });
  });

  test("a new sketch's first version is not a take (sketches.create has no takeState)", async () => {
    const id = await newSketch();
    expect((await versionsOf(id))[0]).toMatchObject({ takeState: null, parentVersion: null });
    const r = await h.json("POST", "/api/sketches", sketchBody({ takeState: "open" }));
    expect(r.status).toBe(400);
  });
});

describe("sketches.patchVersion", () => {
  test("cut hides nothing on the server: the version is still listed", async () => {
    const id = await newSketch();
    await h.json(
      "POST",
      `/api/sketches/${id}/versions`,
      versionBody({ code: 'drums: s("bd")', takeState: "open" }),
    );
    const r = await h.json<SketchVersion>("PATCH", `/api/sketches/${id}/versions/2`, { takeState: "cut" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sketchId: id, version: 2, takeState: "cut", code: 'drums: s("bd")' });
    const versions = await versionsOf(id);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[1]?.takeState).toBe("cut");
  });

  test("kept and null round-trip", async () => {
    const id = await newSketch();
    await h.json(
      "POST",
      `/api/sketches/${id}/versions`,
      versionBody({ code: 'drums: s("bd")', takeState: "open" }),
    );
    const kept = await h.json<SketchVersion>("PATCH", `/api/sketches/${id}/versions/2`, {
      takeState: "kept",
    });
    expect(kept.body.takeState).toBe("kept");
    expect((await versionsOf(id))[1]?.takeState).toBe("kept");
    const cleared = await h.json<SketchVersion>("PATCH", `/api/sketches/${id}/versions/2`, {
      takeState: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.takeState).toBeNull();
    expect((await versionsOf(id))[1]?.takeState).toBeNull();
  });

  test("an unknown take state is a 400", async () => {
    const id = await newSketch();
    const r = await h.json("PATCH", `/api/sketches/${id}/versions/1`, { takeState: "gone" });
    expect(r.status).toBe(400);
  });

  test("an unknown sketch or version is a 404", async () => {
    const id = await newSketch();
    expect((await h.json("PATCH", "/api/sketches/sk_nope/versions/1", { takeState: "cut" })).status).toBe(
      404,
    );
    expect((await h.json("PATCH", `/api/sketches/${id}/versions/9`, { takeState: "cut" })).status).toBe(404);
    expect((await h.json("PATCH", `/api/sketches/${id}/versions/0`, { takeState: "cut" })).status).toBe(400);
  });

  test("a request from another host is refused", async () => {
    const id = await newSketch();
    const r = await h.json(
      "PATCH",
      `/api/sketches/${id}/versions/1`,
      { takeState: "cut" },
      { host: "evil.example:8787" },
    );
    expect(r.status).toBe(403);
    expect((await versionsOf(id))[0]?.takeState).toBeNull();
  });
});

describe("sketch: committed lines and drawn cards", () => {
  test("a sketch never patched returns committed [] and cards []", async () => {
    const id = await newSketch();
    const r = await h.json<SketchDetail>("GET", `/api/sketches/${id}`);
    expect(r.body.committed).toEqual([]);
    expect(r.body.cards).toEqual([]);
    const list = await h.json<{ items: Sketch[] }>("GET", "/api/sketches");
    expect(list.body.items[0]).toMatchObject({ committed: [], cards: [] });
  });

  test("committed and cards are stored by PATCH and read back on GET", async () => {
    const id = await newSketch();
    const committed = [{ label: "bass", version: 1, at: "2026-11-25T10:00:00.000Z" }];
    const cards = [{ cardId: "one-part-only", drawnAt: "2026-11-25T10:05:00.000Z" }];
    const p = await h.json<Sketch>("PATCH", `/api/sketches/${id}`, { committed });
    expect(p.status).toBe(200);
    expect(p.body.committed).toEqual(committed);
    expect(p.body.cards).toEqual([]);
    await h.json("PATCH", `/api/sketches/${id}`, { cards });
    const r = await h.json<SketchDetail>("GET", `/api/sketches/${id}`);
    expect(r.body.committed).toEqual(committed);
    expect(r.body.cards).toEqual(cards);
    // The whole list replaces it.
    await h.json("PATCH", `/api/sketches/${id}`, { committed: [] });
    expect((await h.json<SketchDetail>("GET", `/api/sketches/${id}`)).body.committed).toEqual([]);
  });

  test("a PATCH from another host is refused", async () => {
    const id = await newSketch();
    const r = await h.json(
      "PATCH",
      `/api/sketches/${id}`,
      { committed: [{ label: "bass", version: 1, at: "2026-11-25T10:00:00.000Z" }] },
      { host: "evil.example:8787" },
    );
    expect(r.status).toBe(403);
    expect((await h.json<SketchDetail>("GET", `/api/sketches/${id}`)).body.committed).toEqual([]);
  });
});

describe("streak", () => {
  test("a saved take with ranOk qualifies the day, as a sketch does", async () => {
    const id = await newSketch({ ranOk: false });
    const before = await h.json<{ summary: { todayQualified: boolean } }>("GET", "/api/streak");
    expect(before.body.summary.todayQualified).toBe(false);
    const r = await h.json<SketchSaved>(
      "POST",
      `/api/sketches/${id}/versions`,
      versionBody({ code: 'drums: s("bd*2")', takeState: "open", ranOk: true }),
    );
    expect(r.body.streak.todayQualified).toBe(true);
  });
});
