// The dev seeder's snapshots (dev-seed-cache.ts): a repeated `POST /api/dev/seed` restores the build it was taken
// from, table by table and file by file; one test's writes never reach the next seed; another option set, another
// day, an hour later or new content never restores a snapshot; and the /dev/listen verdicts stay as the build keeps
// them. A snapshot restored 59 minutes after its build is the learner a fresh build makes at that later instant, for
// a point in every unit, every point with its own path through the seeder and every option the browser suite passes
// (AGED). The real course, so the points carry sketches, album recordings and an own-audio file.
import { Database } from "bun:sqlite";
import { afterAll, afterEach, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { DevSeedRequest, DevSeedResult, SessionPlan } from "@oak/api";
import { loadContent } from "../content/loader.ts";
import type { ContentSource } from "../content/types.ts";
import { tableNames } from "../db/index.ts";
import { CONTENT_DIR } from "../testing/course.ts";
import { type Harness, harness } from "../testing/harness.ts";
import { withCft } from "../testing/wave6.ts";
import { buildSeed, SEED_POINTS } from "./dev-seed.ts";
import {
  codeHash,
  SeedCache,
  SNAPSHOT_MAX_AGE_MS,
  seedCacheEnabled,
  seedCacheOf,
  shiftInstants,
  snapshotKey,
} from "./dev-seed-cache.ts";

setDefaultTimeout(120_000);

let real: ContentSource;
beforeAll(async () => {
  // Wave 6: with CF-T's standards as test renditions until the repertoire author writes them, so the points about
  // CF-T and ladder L8 build (on the real content alone they answer 400).
  real = withCft(await loadContent({ contentDir: CONTENT_DIR }));
});

const NOW = "2026-11-13T12:00:00.000Z";
let h: Harness | null = null;
afterEach(async () => {
  await h?.close();
  h = null;
});

async function server(): Promise<Harness> {
  h = await harness({ dev: true, content: real, now: NOW });
  return h;
}

async function seed(x: Harness, body: Record<string, unknown>): Promise<DevSeedResult> {
  const r = await x.json<DevSeedResult>("POST", "/api/dev/seed", body);
  if (r.status !== 200)
    throw new Error(`seed ${JSON.stringify(body)} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

/** Every row of every table (sorted, so the order rows were written in does not count), and every audio file. */
function learner(x: Harness, opts: { listen?: boolean } = {}): Record<string, unknown> {
  const db = x.server.deps.db;
  const out: Record<string, unknown> = {};
  for (const t of tableNames(db)) {
    if (t === "listen_marks" && opts.listen !== true) continue;
    out[t] = (db.query(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[])
      .map((r) => JSON.stringify(r, (_k, v) => (v instanceof Uint8Array ? [...v] : v)))
      .sort();
  }
  const { audioDir, albumDir } = x.server.deps.config;
  out["files:audio"] = files(audioDir);
  out["files:album"] = files(albumDir);
  return out;
}

function files(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out[relative(dir, abs)] = createHash("sha256").update(readFileSync(abs)).digest("hex");
    }
  };
  walk(dir);
  return out;
}

function backups(x: Harness): string[] {
  const dir = x.server.deps.config.backupsDir;
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith("pre-reset")) : [];
}

const cache = (x: Harness) => {
  const c = seedCacheOf(x.server.deps);
  if (c === null) throw new Error("the seed cache is off");
  return c;
};

describe("dev seed snapshots", () => {
  test("a repeated seed restores the build it was taken from, table by table and file by file", async () => {
    const x = await server();
    // A point with an own-audio recording (audio/) and one with released album tracks and their recordings (album/).
    for (const point of ["own-audio project", "C2 released"]) {
      const built = await seed(x, { point });
      const atBuild = learner(x);
      expect(
        Object.keys(atBuild["files:audio"] as object).length +
          Object.keys(atBuild["files:album"] as object).length,
      ).toBeGreaterThan(0);
      const plan = (await x.json<SessionPlan>("GET", "/api/session/today")).body;
      await seed(x, { point: "after U03.L02" });
      expect(learner(x)).not.toEqual(atBuild);
      const before = { ...cache(x).stats };
      const backupsBefore = backups(x).length;
      const restored = await seed(x, { point });
      expect(cache(x).stats.restored).toBe(before.restored + 1);
      expect(cache(x).stats.built).toBe(before.built);
      expect(learner(x)).toEqual(atBuild);
      expect(restored).toEqual(built);
      expect((await x.json<SessionPlan>("GET", "/api/session/today")).body).toEqual(plan);
      // A restore makes no pre-reset safety copy (a build does).
      expect(backups(x).length).toBe(backupsBefore);
    }
  });

  test("one test's writes never reach the next seed; the /dev/listen verdicts stay", async () => {
    const x = await server();
    await seed(x, { point: "own-audio project" });
    const atBuild = learner(x);
    // What a test does after its seed: a sketch, a profile change, an uploaded recording, a whole lesson session.
    expect(
      (
        await x.json("POST", "/api/sketches", {
          title: "A test's sketch",
          originKind: "free",
          originId: null,
          code: 'drums: s("bd")',
          bpm: 100,
          meter: "4/4",
          key: { tonic: "C", mode: "major" },
          analysis: null,
          note: null,
          tutorAssisted: false,
          band: null,
          flags: { lockedTools: [], previewTools: [] },
          ranOk: true,
          sessionId: null,
        })
      ).status,
    ).toBe(200);
    expect((await x.json("PUT", "/api/profile", { targetMinutes: 25, quiet: true })).status).toBe(200);
    const plan = (await x.json<SessionPlan>("GET", "/api/session/today")).body;
    expect(
      (
        await x.json("POST", "/api/session/start", {
          kind: plan.kind,
          mapItemId: plan.mapItemId,
          targetMinutes: 20,
        })
      ).status,
    ).toBe(200);
    expect(
      (await x.json("PUT", "/api/listen/tb.example%2F1", { verdict: "ok", hash: "h1", note: "" })).status,
    ).toBe(200);
    const marks = learner(x, { listen: true }).listen_marks;
    expect(learner(x)).not.toEqual(atBuild);

    await seed(x, { point: "own-audio project" });
    expect(cache(x).stats.restored).toBe(1);
    expect(learner(x)).toEqual(atBuild);
    // The QA verdict made after the build is kept, as a build keeps it.
    expect(learner(x, { listen: true }).listen_marks).toEqual(marks);
    expect((marks as string[]).length).toBe(1);
  });

  test("another option set, a new day, an hour later or a clock moved back builds again", async () => {
    const x = await server();
    await seed(x, { point: "after U03.L02" });
    await seed(x, { point: "after U03.L02", mic: false });
    await seed(x, { point: "after U03.L02", gapDays: 4 });
    await seed(x, { point: "after U03.L02", targetMinutes: 25 });
    await seed(x, { point: "after U03.L02", practice: false });
    expect(cache(x).stats).toEqual({ built: 5, restored: 0, expired: 0 });
    const quiet = (await x.json<{ inputKind: string }>("GET", "/api/profile")).body;
    // The same options in another spelling are the same request.
    await seed(x, { point: "  After  U03.L02 ", practice: false });
    expect(cache(x).stats.restored).toBe(1);
    expect(quiet.inputKind).toBe("builtin");

    // Within the hour: restored. Past the hour: built again.
    x.clock.advance(SNAPSHOT_MAX_AGE_MS - 60_000);
    await seed(x, { point: "after U03.L02" });
    expect(cache(x).stats.restored).toBe(2);
    x.clock.advance(120_000);
    await seed(x, { point: "after U03.L02" });
    expect(cache(x).stats).toMatchObject({ built: 6, restored: 2, expired: 1 });
    // The dev clock moved back past the build: built again.
    await x.json("PUT", "/api/dev/clock", { advanceMs: -600_000 });
    await seed(x, { point: "after U03.L02" });
    expect(cache(x).stats).toMatchObject({ built: 7, expired: 2 });
    // A new learner day (the 04:00 rollover passed): built again, and the learner's yesterday is the new one.
    await x.json("PUT", "/api/dev/clock", { reset: true });
    await seed(x, { point: "after U03.L02" });
    x.clock.set("2026-11-14T12:00:00.000Z");
    const next = await seed(x, { point: "after U03.L02" });
    expect(cache(x).stats).toMatchObject({ expired: 3 });
    expect(next.lastActiveDay).not.toBe(null);
    expect(next.day > (next.lastActiveDay as string)).toBe(true);
  });

  test("the key holds every option, the content version and the schema version", async () => {
    const x = await server();
    const d = x.server.deps;
    const base = snapshotKey(d, { point: "after U03.L02" });
    expect(snapshotKey(d, { point: "AFTER u03.l02" })).toBe(base);
    for (const body of [
      { point: "after U03.L03" },
      { point: "after U03.L02", mic: false },
      { point: "after U03.L02", gapDays: 0 },
      { point: "after U03.L02", targetMinutes: 20 as const },
      { point: "after U03.L02", practice: false },
      { point: "after U03.L02", recordings: false },
    ])
      expect(snapshotKey(d, body)).not.toBe(base);
    expect(base).toContain(JSON.stringify(d.content.contentVersion));
    expect(
      snapshotKey(
        { ...d, content: { ...d.content, contentVersion: "other" } as never },
        { point: "after U03.L02" },
      ),
    ).not.toBe(base);
  });

  test("an unknown point answers 400 and leaves the learner as it was", async () => {
    const x = await server();
    await seed(x, { point: "after U03.L02" });
    const atBuild = learner(x);
    const r = await x.json("POST", "/api/dev/seed", { point: "after U99.L99" });
    expect(r.status).toBe(400);
    expect(learner(x)).toEqual(atBuild);
  });

  test("snapshots live under the data dir and are capped; OAK_SEED_CACHE=0 turns them off", async () => {
    const x = await server();
    await seed(x, { point: "after U01.L03" });
    const root = join(x.server.deps.config.dataDir, "dev-seed-cache");
    expect(readdirSync(root).length).toBe(1);
    expect(statSync(join(root, readdirSync(root)[0] as string, "oak.db")).size).toBeGreaterThan(0);
    expect(seedCacheEnabled()).toBe(true);
    const saved = process.env.OAK_SEED_CACHE;
    process.env.OAK_SEED_CACHE = "0";
    try {
      expect(seedCacheEnabled()).toBe(false);
      expect(seedCacheOf(x.server.deps)).toBeNull();
    } finally {
      if (saved === undefined) delete process.env.OAK_SEED_CACHE;
      else process.env.OAK_SEED_CACHE = saved;
    }
  });

  test("a production server (no OAK_DEV) has no seed and no snapshots", async () => {
    const p = await harness({ content: real, now: NOW });
    try {
      expect(seedCacheOf(p.server.deps)).toBeNull();
      const r = await p.json("POST", "/api/dev/seed", { point: "after U03.L02" });
      expect(r.status).not.toBe(200);
      expect(existsSync(join(p.server.deps.config.dataDir, "dev-seed-cache"))).toBe(false);
    } finally {
      await p.close();
    }
  });

  test("a shared folder (OAK_SEED_CACHE_DIR): one server's build is another's restore, for the same code only", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oak-seed-shared-"));
    const a = await harness({ dev: true, content: real, now: NOW });
    const b = await harness({ dev: true, content: real, now: NOW });
    try {
      const body = { point: "own-audio project" };
      const ca = new SeedCache(a.server.deps, dir, "code-1");
      const built = await ca.seed(body, () => buildSeed(a.server.deps, body));
      const atBuild = learner(a);
      // The second server, the same code: restored, the same learner table by table and file by file.
      const cb = new SeedCache(b.server.deps, dir, "code-1");
      const restored = await cb.seed(body, () => buildSeed(b.server.deps, body));
      expect(cb.stats).toEqual({ built: 0, restored: 1, expired: 0 });
      expect(learner(b)).toEqual(atBuild);
      expect(restored).toEqual(built);
      // Other code: never another server's build.
      const other = new SeedCache(b.server.deps, dir, "code-2");
      await other.seed(body, () => buildSeed(b.server.deps, body));
      expect(other.stats).toEqual({ built: 1, restored: 0, expired: 0 });
      // Entries are folders renamed into place (no temporary folder left), one per code.
      const entries = readdirSync(dir);
      expect(entries.some((f) => f.includes(".tmp"))).toBe(false);
      expect(entries.length).toBe(2);
      // A shared folder is kept when a server starts using it; entries written long ago are removed.
      const old = new Date(Date.now() - 4 * SNAPSHOT_MAX_AGE_MS);
      utimesSync(join(dir, entries[0] as string), old, old);
      new SeedCache(a.server.deps, dir, "code-1");
      expect(readdirSync(dir).length).toBe(1);
    } finally {
      await a.close();
      await b.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the code hash of a checkout is stable", () => {
    const h1 = codeHash();
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
    expect(codeHash()).toBe(h1);
  });
});

// What a test can see of a seeded learner: Today's plan and day, the due cards in their order, the Oak's leaves (level,
// recall, strength, freshness, drying), the streak, and every other list the app reads.
const OBSERVED = [
  "/api/session/today",
  "/api/session/day",
  "/api/srs/due",
  "/api/skills/map",
  "/api/skills/revive",
  "/api/streak",
  "/api/progress",
  "/api/bootstrap",
  "/api/unlocks",
  "/api/unlocks/next",
  "/api/lessons/progress",
  "/api/drills/families",
  "/api/album",
  "/api/sketches",
  "/api/transcriptions",
  "/api/gym",
  "/api/ladder",
  "/api/side-lessons",
  "/api/voice",
  "/api/profile",
  "/api/onboarding",
];
const MUST_ANSWER = ["/api/session/today", "/api/srs/due", "/api/skills/map", "/api/streak"];
const INSTANT = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g;

/**
 * JSON with what no two builds share made comparable: a random ID (`ses_…`, `sk_…`, `trk_…`) becomes its order of
 * first appearance, a track's cover seed (a hash of its random ID) a constant. Instants and numbers stay as they are.
 */
function comparable(value: unknown): unknown {
  const ids = new Map<string, string>();
  const text = JSON.stringify(value)
    .replace(/\b([a-z]{2,4})_[0-9a-f]{20}\b/g, (id, prefix: string) => {
      const known = ids.get(id);
      if (known !== undefined) return known;
      const name = `${prefix}#${ids.size + 1}`;
      ids.set(id, name);
      return name;
    })
    .replace(/"coverSeed":"[0-9a-f]{16}"/g, '"coverSeed":"of its id"');
  return JSON.parse(text);
}

async function observed(x: Harness): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const path of OBSERVED) {
    const r = await x.json("GET", path);
    if (MUST_ANSWER.includes(path)) expect(r.status, path).toBe(200);
    out[path] = comparable({ status: r.status, body: r.body });
  }
  return out;
}

/** Every instant stored anywhere in the learner (a column, or inside its JSON), per table, sorted. */
function instants(x: Harness): Record<string, string[]> {
  const db = x.server.deps.db;
  const out: Record<string, string[]> = {};
  for (const t of tableNames(db)) {
    if (t === "listen_marks") continue;
    const found: string[] = [];
    for (const row of db.query(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[])
      for (const v of Object.values(row)) if (typeof v === "string") found.push(...(v.match(INSTANT) ?? []));
    out[t] = found.sort();
  }
  return out;
}

// A representative set: one point in each unit U00–U17, every point whose build takes its own path through the
// seeder (each `extra` kind of `planSeed`, each request pattern, the family levels, the Wave 6 checkpoint rule, the
// CF-T walk), and every option set the browser specs pass (gapDays, targetMinutes, recordings, mic) plus
// `practice: false`. A point left out is a plain walk of the default order up to an item (or a capstone state) whose
// rows a kept point on the same path writes too: the restore moves every instant of every table and column alike
// (`shiftInstants`), so a point adds to this proof only the kinds of rows its build writes. "core complete" walks
// every session of the core (each capstone released, each transcription session, CF-A), so every table a dropped
// point fills is in it. The list of named points is checked below, so a new point is either here or named as left out.
const AGED: DevSeedRequest[] = [
  // U00 and the start of the walk.
  { point: "fresh" },
  { point: "onboarding at react (edit 5)" },
  { point: "onboarded" },
  // U01: `after <SessionId>` with targetMinutes, `<CP> due`, one and two failed checkpoints, the return policy's
  // three gap ranges (contracts §7.9).
  { point: "after U01.L03", targetMinutes: 15 },
  { point: "U01.CP due" },
  { point: "U01.CP failed" },
  { point: "U01.CP failed twice" },
  { point: "4-day gap" },
  { point: "12-day gap" },
  { point: "21-day gap" },
  // C0: an unreleased draft, and a release without a recording.
  { point: "C0 in progress" },
  { point: "C0 released", recordings: false },
  // U02 with gapDays; U03 with practice off; a side lesson; a gym session as `after <SessionId>`.
  { point: "after U02.L05", gapDays: 6 },
  { point: "after U03.L02", practice: false },
  { point: "A1.L02 done" },
  { point: "after GYM.04" },
  // U04–U07; the U05.L07 gate; ladder L3; own audio recorded and imported.
  { point: "U04.CP due" },
  { point: "U05.L07 gate open" },
  { point: "after U06.L05" },
  { point: "after U07.L03 (gym due)" },
  { point: "ladder L3" },
  { point: "own-audio project" },
  { point: "imported own-audio (c2)" },
  // C2 open with the mic off; C2 released (family levels, a release with its recording); X1 half done.
  { point: "C2 open", mic: false },
  { point: "C2 released" },
  { point: "X1.S2 done" },
  // U08–U11: the ladder's level-up and realism-up, C3.S3 open in its session, two takes, a ladder song (L5).
  { point: "after U08.L04" },
  { point: "ladder level-up due" },
  { point: "ladder realism-up due" },
  { point: "C3.S3 in progress (d13)" },
  { point: "two takes (d20)" },
  { point: "ladder L5" },
  { point: "after U11.L06" },
  // U12–U17: a second tab's open session, the Wave 6 `<CP> due` rule, CF-T (its standards), ladder L8, the end.
  { point: "second tab (d21)" },
  { point: "after U12.L05" },
  { point: "U13.CP due" },
  { point: "after U14.L03" },
  { point: "CF-T open (U15.L01 done)" },
  { point: "after U16.L03" },
  { point: "ladder L8" },
  { point: "core complete" },
  // Wave 7: a track walk beside the core with the focus set; a reviews-only day, a checkpoint and the horns taken
  // away; a two-version capstone's drafts.
  { point: "J2.L04 locked (U14.CP not passed)" },
  { point: "RC1 open", practice: false },
  { point: "AC1.S2 done", practice: false },
];
/**
 * Named points left out of the aged proof, each a plain walk up to an item or a capstone state on a path a kept point
 * takes (see AGED). Each is still built and checked where it is used: the wave seed and course tests, the browser specs.
 */
const AGED_LEFT_OUT = [
  // Wave 7: the other track walks are the same walk builder over other lists (seed-wave7.ts WAVE7_WALKS).
  "core complete, tracks untouched",
  "J1.L03 next",
  "J.CP1 due",
  "JC1 open",
  "JC1 released",
  "J3.L02 next",
  "J4.L03 next",
  "JC2 open",
  "J.CP2 due",
  "JC3 open",
  "JC4 open",
  "JC4.S2 done",
  "R1.L03 next",
  "R2.L04 next",
  "R3.L02 next",
  "R.CP due",
  "RC2 open",
  "A1.L05 next",
  "A2.L04 next",
  "A.CP due",
  "AC1 open",
  "AC2 open",
  "two tracks in progress",
  "whole course complete",
  // Plain walks and capstone states of U01–U07, C0–C2, X1: the same builder code as the kept points of those units.
  "C0 ready",
  "U02.CP due",
  "C1 ready",
  "C1 in progress",
  "C1 released",
  "after U02.CP",
  "U03.CP due",
  "after U03.CP",
  "after U04.CP",
  "after U05.L04",
  "after U05.L08",
  "U05.CP due",
  "U06.CP due",
  "after U07.L07",
  "U07.CP due",
  "C2.S1 done",
  "X1 open",
  "X1 released",
  "side lesson offered",
  // Wave 5: plain walks and capstone states (C3–C5, X2), a second ladder song level.
  "after X1 (U08.L02 next)",
  "after U09.L01",
  "after U09.L04",
  "U09.CP due",
  "C3 open",
  "C3.S2 done",
  "C3 released",
  "after U10.L02",
  "after U10.L05",
  "after U10.L08",
  "U10.CP due",
  "C4 open",
  "C4 released",
  "after U11.L03",
  "U11.CP due",
  "C5 open",
  "C5.S1 done",
  "C5 released",
  "X2 open",
  "X2.S1 done",
  "X2 released",
  "ladder L6",
  // Wave 6: plain walks and capstone states (C6, C7, CF-T, CF-A, C3.S3); all inside "core complete"'s walk.
  "after X2 (U12.L02 next)",
  "after U13.L03",
  "tracks open (after U13.CP)",
  "U14.CP due",
  "C6 open",
  "C6 released",
  "CF-T.S2 done",
  "after U15.L05",
  "after U17.L02",
  "U17.CP due",
  "C7 open",
  "C7.S2 done",
  "C7 released",
  "CF-A open",
  "CF-A.S3 done",
  "C3.S3 done",
];

test("every named seed point is in the aged proof or named as left out", () => {
  const named = SEED_POINTS.map((p) => p.point).filter((p) => !p.includes("<"));
  const aged = new Set(AGED.map((b) => b.point));
  expect(named.filter((p) => !aged.has(p) && !AGED_LEFT_OUT.includes(p))).toEqual([]);
  expect(AGED_LEFT_OUT.filter((p) => !named.includes(p) || aged.has(p))).toEqual([]);
});
const AGE_MS = SNAPSHOT_MAX_AGE_MS - 60_000;

describe("a snapshot restored 59 minutes after its build is a fresh build at that instant", () => {
  let x: Harness;
  beforeAll(async () => {
    x = await harness({ dev: true, content: real, now: NOW });
  });
  afterAll(async () => {
    await x.close();
  });

  for (const body of AGED) {
    const { point, ...options } = body;
    const name = Object.keys(options).length > 0 ? `${point} ${JSON.stringify(options)}` : point;
    test(name, async () => {
      x.clock.set(NOW);
      const before = { ...cache(x).stats };
      await seed(x, body);
      expect(cache(x).stats.built).toBe(before.built + 1);
      // Another learner in between, then the same request 59 minutes later: restored, not built.
      await seed(x, { point: "fresh" });
      x.clock.advance(AGE_MS);
      const built = cache(x).stats.built;
      const restoredResult = await seed(x, body);
      expect(cache(x).stats.built).toBe(built);
      expect(cache(x).stats.restored).toBeGreaterThan(before.restored);
      const restored = { seen: await observed(x), instants: instants(x), files: fileHashes(x) };
      // The same request built from nothing at this instant, past the cache.
      const freshResult = await buildSeed(x.server.deps, body);
      const fresh = { seen: await observed(x), instants: instants(x), files: fileHashes(x) };
      expect(restored.seen).toEqual(fresh.seen);
      expect(restored.instants).toEqual(fresh.instants);
      expect(restored.files).toEqual(fresh.files);
      expect(comparable(restoredResult)).toEqual(comparable(freshResult));
    });
  }
});

/** The audio and album files by content (their names hold random IDs), sorted. */
function fileHashes(x: Harness): string[] {
  const { audioDir, albumDir } = x.server.deps.config;
  return [...Object.values(files(audioDir)), ...Object.values(files(albumDir))].sort();
}

describe("moving a restored learner's instants", () => {
  const later = { ms: 59 * 60_000, timeZone: "UTC", rolloverHour: 4 };
  const table = (rows: (string | null)[]) => {
    const db = new Database(":memory:");
    db.run("CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER, at TEXT, doc TEXT)");
    rows.forEach((at, i) => {
      db.run("INSERT INTO t (n, at, doc) VALUES (?, ?, ?)", [
        i,
        at,
        JSON.stringify({ at, day: "2026-11-12" }),
      ]);
    });
    return db;
  };
  const read = (db: Database) => db.query("SELECT n, at, doc FROM t ORDER BY id").all();

  test("an event moves by the time passed, in a column and inside JSON; a due date on a day's first instant stays", () => {
    const db = table(["2026-11-12T12:00:00.000Z", "2026-11-20T04:00:00.000Z", null]);
    shiftInstants(db, ["t"], later);
    expect(read(db)).toEqual([
      { n: 0, at: "2026-11-12T12:59:00.000Z", doc: '{"at":"2026-11-12T12:59:00.000Z","day":"2026-11-12"}' },
      { n: 1, at: "2026-11-20T04:00:00.000Z", doc: '{"at":"2026-11-20T04:00:00.000Z","day":"2026-11-12"}' },
      { n: 2, at: null, doc: '{"at":null,"day":"2026-11-12"}' },
    ]);
  });

  test("an event that would move to another learner day refuses the restore", () => {
    const db = table(["2026-11-12T03:30:00.000Z"]);
    expect(() => shiftInstants(db, ["t"], later)).toThrow("another learner day");
  });

  test("a build made on a day's first instant is never restored later: built again", async () => {
    const x = await harness({ dev: true, content: real, now: NOW });
    try {
      const { timezone, rolloverHour } = x.server.deps.repos.profile.get();
      expect({ timezone, rolloverHour }).toEqual({ timezone: "UTC", rolloverHour: 4 });
      x.clock.set("2026-11-13T04:00:00.000Z");
      await seed(x, { point: "after U01.L03" });
      await seed(x, { point: "after U01.L03" });
      expect(cache(x).stats).toEqual({ built: 1, restored: 1, expired: 0 });
      x.clock.advance(60_000);
      await seed(x, { point: "after U01.L03" });
      expect(cache(x).stats).toEqual({ built: 2, restored: 1, expired: 1 });
    } finally {
      await x.close();
    }
  });
});
