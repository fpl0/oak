import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { SketchDetail, SketchLineage, SketchSaved, SketchVersionCreate } from "@oak/api";
import { Hono } from "hono";
import { all, run } from "../db/index.ts";
import { ApiError, errorResponse } from "../errors.ts";
import { createMounter } from "../routes/define.ts";
import { lineageRoutes } from "../routes/lineage.ts";
import { apiSecurity } from "../security.ts";
import { BROWSER, type Harness, harness } from "../testing/harness.ts";
import { checkLineage, type LineageBody, LineageService, undoesGrandparent } from "./lineage.ts";

const GP = 'setcpm(90/4)\n\ndrums: s("bd ~ sd ~")\nbass: note("c2 ~ g1 ~").s("ebass")';
const V2 = GP.replace('s("bd ~ sd ~")', 's("bd*2 ~ sd ~")');
const V3 = V2.replace('.s("ebass")', '.s("sawtooth")');
const V4 = `${V3}\nhats: s("hh*8")`;
const V5 = V3.replace('.s("sawtooth")', '.s("ebass")');
const vs3 = [
  { version: 1, generation: null },
  { version: 2, generation: 1 },
  { version: 3, generation: 2 },
];

const validationCases: { id: string; body: LineageBody; ok: boolean; empty?: boolean }[] = [
  { id: "a", body: {}, ok: true },
  { id: "b", body: { parentVersion: null, generation: null, dimension: null }, ok: true },
  { id: "c", body: { generation: 1 }, ok: false },
  { id: "d", body: { parentVersion: 1 }, ok: false },
  { id: "e", body: { parentVersion: 1, generation: 1 }, ok: false },
  { id: "f", body: { parentVersion: 1, generation: 1, dimension: null }, ok: false },
  { id: "g", body: { parentVersion: 1, dimension: "rhythm" }, ok: false },
  { id: "h", body: { dimension: "rhythm" }, ok: false },
  { id: "i", body: { generation: 1, dimension: "rhythm" }, ok: false },
  { id: "j", body: { parentVersion: 9, generation: 1, dimension: "rhythm" }, ok: false },
  { id: "k", body: { parentVersion: 4, generation: 1, dimension: "rhythm" }, ok: false },
  { id: "l", body: { parentVersion: 1, generation: 2, dimension: "rhythm" }, ok: false },
  { id: "m", body: { parentVersion: 1, generation: 1, dimension: "rhythm" }, ok: true },
  { id: "n", body: { parentVersion: 3, generation: 3, dimension: "sound" }, ok: true },
  { id: "o", body: { parentVersion: 3, generation: 1, dimension: "sound" }, ok: false },
  { id: "p", body: { parentVersion: 2, generation: 2, dimension: "notes" }, ok: true },
  { id: "q", body: { parentVersion: 1, generation: 1, dimension: "form" }, ok: false, empty: true },
];

describe("checkLineage", () => {
  for (const c of validationCases) {
    test(`AC1 ${c.id}: ${c.ok ? "accepted" : "400 bad_request"}`, async () => {
      const check = () => checkLineage(c.empty ? [] : vs3, c.body);
      if (c.ok) {
        expect(check).not.toThrow();
      } else {
        expect(check).toThrow(ApiError);
        try {
          check();
        } catch (e) {
          expect(e).toBeInstanceOf(ApiError);
          expect((e as ApiError).code).toBe("bad_request");
          await failure(errorResponse(e as ApiError), 400, "bad_request");
        }
      }
    });
  }
});

describe("undoesGrandparent", () => {
  const gp = 'drums: s("bd ~ sd ~")\nbass: note("c2 ~ g1 ~").s("ebass")';
  const pD = gp.replace('s("bd ~ sd ~")', 's("bd*4")');
  const sound = (code: string) => code.replace('.s("ebass")', '.s("sawtooth")');
  const anonymous = '$: s("bd")\n$: s("hh*8")';
  const cases: [string, string, string, string, boolean][] = [
    ["a", gp, pD, gp, true],
    ["b", gp, pD, sound(pD), false],
    ["c", gp, pD, sound(gp), true],
    ["d", gp, gp, gp, false],
    ["e", gp, gp, pD, false],
    ["f", `setcpm(90/4)\n${gp}`, `setcpm(100/4)\n${gp}`, `setcpm(90/4)\n${gp}`, true],
    [
      "g",
      `const groove = "x ~ x ~"\n${gp}`,
      `const groove = "x x ~ x"\n${gp}`,
      `const groove = "x ~ x ~"\n${gp}`,
      true,
    ],
    ["h", gp, sound(pD), pD, false],
    ["i", gp, sound(pD), gp, true],
    ["j", gp, `${gp}\nhats: s("hh*8")`, gp, true],
    ["k", gp, `${gp}\nhats: s("hh*8")`, `${gp}\nhats: s("hh*4")`, false],
    ["l", gp, gp.replace("bass:", "_bass:"), gp, true],
    ["m", anonymous, anonymous.replace("hh*8", "hh*4"), anonymous, true],
    ["n", gp, pD, `${gp}\n// a comment`, true],
    ["o", "", "", "", false],
  ];
  for (const [id, grandparent, parent, child, expected] of cases) {
    test(`AC4 ${id}: ${expected}`, () => {
      expect(undoesGrandparent(grandparent, parent, child)).toBe(expected);
      if (id === "o") expect(typeof undoesGrandparent("(((", "drums: s(", "x")).toBe("boolean");
    });
  }

  test("repeated consts and third labels retain separate statements", () => {
    const code = 'const groove = "a"\nconst groove = "b"\n$: s("bd")\n$: s("sd")\n$: s("hh")';
    const parent = code.replace('"b"', '"c"').replace('"hh"', '"hh*2"');
    expect(undoesGrandparent(code, parent, code)).toBe(true);
    expect(undoesGrandparent(code, parent, code.replace('"b"', '"c"'))).toBe(false);
  });

  test("removed statements must return; unrelated text and outer whitespace are ignored", () => {
    const parent = 'drums: s("bd ~ sd ~")';
    expect(undoesGrandparent(gp, parent, gp)).toBe(true);
    expect(undoesGrandparent(gp, parent, parent)).toBe(false);
    expect(undoesGrandparent(gp, pD, `\n  ${gp}\n\n// note\nplaySomething()`)).toBe(true);
    expect(undoesGrandparent(gp, `${gp}\nplaySomething()`, gp)).toBe(false);
  });
});

function versionBody(code = GP): SketchVersionCreate {
  return {
    sessionId: null,
    code,
    bpm: 90,
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

async function sketch(h: Harness): Promise<SketchDetail> {
  const res = await h.json<SketchSaved>("POST", "/api/sketches", {
    ...versionBody(),
    title: "Groove",
    originKind: "free",
    originId: null,
  });
  expect(res.status).toBe(200);
  return res.body.sketch;
}

async function add(h: Harness, id: string, code: string, fields: LineageBody = {}) {
  h.clock.advance(1000);
  const res = await h.json<SketchSaved>("POST", `/api/sketches/${id}/versions`, {
    ...versionBody(code),
    ...fields,
  });
  expect(res.status).toBe(200);
  return res.body.sketch;
}

async function threeVersions(h: Harness): Promise<SketchDetail> {
  const s = await sketch(h);
  await add(h, s.id, V2, { parentVersion: 1, generation: 1, dimension: "rhythm" });
  return add(h, s.id, V3, { parentVersion: 2, generation: 2, dimension: "sound" });
}

async function fiveVersions(h: Harness): Promise<SketchDetail> {
  const s = await threeVersions(h);
  await add(h, s.id, V4);
  return add(h, s.id, V5, { parentVersion: 3, generation: 3, dimension: "sound" });
}

async function getSketch(h: Harness, id: string): Promise<SketchDetail> {
  const res = await h.json<SketchDetail>("GET", `/api/sketches/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

function sideApp(h: Harness): Hono {
  const app = new Hono();
  app.onError((e) => errorResponse(e instanceof ApiError ? e : new ApiError("internal", String(e))));
  const cfg = h.server.deps.config;
  app.use("/api/*", apiSecurity({ port: cfg.port, devPorts: cfg.devPorts, dev: cfg.dev }));
  lineageRoutes(
    createMounter(app, { confirm: h.server.deps.confirm, validateResponses: true }),
    new LineageService(h.server.deps.services.ctx),
  );
  return app;
}

function request(app: Hono, id: string, query = "", headers: Record<string, string> = {}) {
  return app.request(`http://127.0.0.1:8787/api/sketches/${id}/lineage${query}`, {
    method: "GET",
    headers: { ...BROWSER, ...headers },
  });
}

async function read(app: Hono, id: string, version?: number): Promise<SketchLineage> {
  const res = await request(app, id, version === undefined ? "" : `?version=${version}`);
  expect(res.status).toBe(200);
  return (await res.json()) as SketchLineage;
}

async function failure(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(((await res.json()) as { error: { code: string } }).error.code).toBe(code);
}

describe("lineage saves and side app", () => {
  let h: Harness;
  let app: Hono;
  beforeEach(async () => {
    h = await harness();
    app = sideApp(h);
  });
  afterEach(async () => {
    await h.close();
  });

  test("AC2: eight refused saves store nothing, then version 4 succeeds", async () => {
    const s = await threeVersions(h);
    for (const id of ["c", "d", "e", "g", "h", "j", "l", "o"]) {
      const c = validationCases.find((c) => c.id === id);
      expect(c).toBeDefined();
      await failure(
        await h.req("POST", `/api/sketches/${s.id}/versions`, { ...versionBody(V4), ...c?.body }),
        400,
        "bad_request",
      );
      expect(await getSketch(h, s.id)).toEqual(s);
    }
    const unchanged = await getSketch(h, s.id);
    expect(unchanged.currentVersion).toBe(3);
    expect(unchanged.versions).toHaveLength(3);
    const saved = await add(h, s.id, V4, { parentVersion: 1, generation: 1, dimension: "rhythm" });
    expect(saved.currentVersion).toBe(4);
    expect(saved.versions.at(-1)?.version).toBe(4);
  });

  test("refused successful Runs do not touch the streak; unknown sketch stays 404", async () => {
    const s = await threeVersions(h);
    const before = all(h.server.deps.db, "SELECT * FROM streak_days");
    expect(before).toEqual([]);
    await failure(
      await h.req("POST", `/api/sketches/${s.id}/versions`, {
        ...versionBody(V4),
        generation: 1,
        ranOk: true,
      }),
      400,
      "bad_request",
    );
    expect(all(h.server.deps.db, "SELECT * FROM streak_days")).toEqual(before);
    expect(await getSketch(h, s.id)).toEqual(s);
    await failure(
      await h.req("POST", "/api/sketches/sk_nope/versions", { ...versionBody(V4), generation: 1 }),
      404,
      "not_found",
    );
  });

  test("AC3: ordinary Runs never create generations", async () => {
    const s = await threeVersions(h);
    const saved = await add(h, s.id, V4);
    const ordinary = { version: 4, parentVersion: null, generation: null, dimension: null };
    expect(saved.versions.at(-1)).toMatchObject(ordinary);
    expect((await getSketch(h, s.id)).versions.at(-1)).toMatchObject(ordinary);
    const next = await add(h, s.id, V5, { parentVersion: 3, generation: 3, dimension: "sound" });
    expect(next.versions.at(-1)).toMatchObject({ version: 5, parentVersion: 3, generation: 3 });
  });

  test("AC5: chain first to last across ordinary Runs, exact metadata, no writes", async () => {
    const s = await fiveVersions(h);
    const stored = await getSketch(h, s.id);
    const before = all(h.server.deps.db, "SELECT total_changes() AS changes");
    const chain = await read(app, s.id, 5);
    expect(chain.sketchId).toBe(s.id);
    expect(chain.versions.map((v) => v.version)).toEqual([1, 2, 3, 5]);
    expect(chain.versions.map((v) => v.generation)).toEqual([null, 1, 2, 3]);
    expect(chain.versions.map((v) => v.dimension)).toEqual([null, "rhythm", "sound", "sound"]);
    expect(chain.versions.map((v) => v.parentVersion)).toEqual([null, 1, 2, 3]);
    expect(chain.versions.map((v) => v.undoesGrandparent)).toEqual([false, false, false, true]);
    expect(chain.versions.map((v) => v.takeState)).toEqual([null, null, null, null]);
    for (const v of chain.versions) {
      const match = stored.versions.find((x) => x.version === v.version);
      expect(match).toBeDefined();
      expect(v.createdAt).toBe(match?.createdAt as string);
      expect(Object.keys(v).sort()).toEqual([
        "createdAt",
        "dimension",
        "generation",
        "parentVersion",
        "takeState",
        "undoesGrandparent",
        "version",
      ]);
    }
    const third = await read(app, s.id, 3);
    expect(third.versions.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(third.versions.map((v) => v.undoesGrandparent)).toEqual([false, false, false]);
    expect((await read(app, s.id, 4)).versions.map((v) => v.version)).toEqual([4]);
    expect(all(h.server.deps.db, "SELECT total_changes() AS changes")).toEqual(before);
    expect(await getSketch(h, s.id)).toEqual(stored);
  });

  test("AC6: default version is the current ordinary Run", async () => {
    const s = await fiveVersions(h);
    await add(h, s.id, V4);
    const chain = await read(app, s.id);
    expect(chain.versions.map((v) => v.version)).toEqual([6]);
    expect(chain.versions.map((v) => v.undoesGrandparent)).toEqual([false]);
  });

  test("AC7: siblings share a parent without entering each other's chains", async () => {
    const s = await fiveVersions(h);
    await add(h, s.id, V4);
    await add(h, s.id, V4.replace("c2", "d2"), { parentVersion: 6, generation: 1, dimension: "notes" });
    await add(h, s.id, V4.replace("g1", "a1"), { parentVersion: 6, generation: 1, dimension: "harmony" });
    const eighth = await read(app, s.id, 8);
    expect(eighth.versions.map((v) => v.version)).toEqual([6, 8]);
    expect(eighth.versions.map((v) => v.generation)).toEqual([null, 1]);
    expect((await read(app, s.id, 7)).versions.map((v) => v.version)).toEqual([6, 7]);
    expect(await read(app, s.id)).toEqual(eighth);
  });

  test("AC8: unknown sketches and versions fail 404; invalid queries fail 400", async () => {
    const s = await fiveVersions(h);
    await failure(await request(app, "sk_nope"), 404, "not_found");
    await failure(await request(app, s.id, "?version=99"), 404, "not_found");
    for (const version of ["0", "abc", "-1"])
      await failure(await request(app, s.id, `?version=${version}`), 400, "bad_request");
  });

  test("AC9: foreign Host fails 403", async () => {
    const s = await fiveVersions(h);
    await failure(await request(app, s.id, "", { host: "evil.example:8787" }), 403, "forbidden");
    expect(await getSketch(h, s.id)).toEqual(s);
  });

  test("AC10: edited self-parent and missing parent end the chain", async () => {
    const s = await threeVersions(h);
    const db = h.server.deps.services.ctx.repos.db;
    run(db, "UPDATE sketch_versions SET parent_version = 2 WHERE sketch_id = ? AND version IN (2, 3)", s.id);
    const broken = await read(app, s.id, 3);
    expect(broken.versions.map((v) => v.version)).toEqual([2, 3]);
    expect(broken.versions.map((v) => v.undoesGrandparent)).toEqual([false, false]);
    run(db, "UPDATE sketch_versions SET parent_version = 99 WHERE sketch_id = ? AND version = 3", s.id);
    expect((await read(app, s.id, 3)).versions.map((v) => v.version)).toEqual([3]);
    // A lower missing version exercises the missing-row guard independently of the ordering guard.
    run(db, "UPDATE sketch_versions SET parent_version = 3 WHERE sketch_id = ? AND version = 2", s.id);
    expect((await read(app, s.id, 2)).versions.map((v) => v.version)).toEqual([2]);
    run(
      db,
      "UPDATE sketch_versions SET version = 4, parent_version = 3 WHERE sketch_id = ? AND version = 3",
      s.id,
    );
    expect((await read(app, s.id, 4)).versions.map((v) => v.version)).toEqual([4]);
  });

  test("take states are read on every request, including cut ancestors", async () => {
    const s = await threeVersions(h);
    for (const [version, takeState] of [
      [1, "cut"],
      [2, "kept"],
      [3, "open"],
    ] as const) {
      expect((await h.req("PATCH", `/api/sketches/${s.id}/versions/${version}`, { takeState })).status).toBe(
        200,
      );
    }
    expect((await read(app, s.id)).versions.map((v) => v.takeState)).toEqual(["cut", "kept", "open"]);
  });
});

describe("lineage backup round-trip", () => {
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

  test("AC9: backup preserves lineage and every saved version", async () => {
    const s = await fiveVersions(a);
    const original = await read(sideApp(a), s.id, 5);
    const exported = await a.req("GET", "/api/backup/export?audio=0");
    expect(exported.status).toBe(200);
    const bytes = new Uint8Array(await exported.arrayBuffer());
    const imported = await b.destructive("POST", "/api/backup/import", "backup.import", "*", bytes);
    expect(imported.status).toBe(200);
    // Build after import so every read uses the imported database, as the wave's side-app seam requires.
    expect(await read(sideApp(b), s.id, 5)).toEqual(original);
    const restored = await getSketch(b, s.id);
    expect(restored.currentVersion).toBe(5);
    expect(restored.versions).toEqual(
      s.versions.map((v) => ({
        ...v,
        flags: { ...v.flags, reviewBeforeRun: true },
      })),
    );
    for (const version of [2, 3, 5]) {
      const source = s.versions.find((v) => v.version === version);
      expect(restored.versions.find((v) => v.version === version)).toMatchObject({
        parentVersion: source?.parentVersion,
        generation: source?.generation,
        dimension: source?.dimension,
      });
    }
  });
});
