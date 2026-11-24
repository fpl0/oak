// Unit songs on the server (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.4, §5.6a; plan Task 5):
// songs.start/get/list, takes, the backfill from lesson-make sketches, frozen release snapshots, the style change,
// SessionPlan.song, and what a backup import does to songs. Real content (the U01 song and its lessons), an
// in-memory-like temp database with the real migrations, the HTTP API as the app calls it.
import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { SessionPlan, UnitSongDetail, UnitSongSnapshot, UnitSongSummary } from "@oak/api";
import { claimsOf, type TakeStep, type UnitSongDef } from "@oak/content-kit";
import { startupTasks } from "../app.ts";
import type { ContentSource } from "../content/types.ts";
import { readZip, writeZip } from "../lib/zip.ts";
import { realCourse } from "../testing/course.ts";
import { type Harness, harness } from "../testing/harness.ts";

let course: ContentSource;
let U01: UnitSongDef;
const open: Harness[] = [];

beforeAll(async () => {
  course = await realCourse();
  const def = course.unitSongs?.find((s) => s.unit === "U01");
  if (def === undefined) throw new Error("the real content has no U01 song");
  U01 = def;
});

afterEach(async () => {
  for (const h of open.splice(0)) await h.close();
});

async function server(): Promise<Harness> {
  const h = await harness({ content: course, now: "2026-11-20T10:00:00.000Z" });
  open.push(h);
  return h;
}

const takeStep = (lessonId: string): TakeStep => {
  const step = U01.plan.find((s) => s.lesson === lessonId);
  if (step === undefined || step.kind !== "take") throw new Error(`${lessonId} is not a take step of U01`);
  return step;
};
/** The cells a take of `lessonId` claims when it plays exactly its declared parts. */
const declared = (lessonId: string): string[] =>
  claimsOf(U01, takeStep(lessonId), { parts: new Set(), playsChords: false });

/** A Make sketch of a lesson, saved as the app saves it (one minute later on the server's clock). */
async function makeSketch(h: Harness, lessonId: string, code = 'kick: s("bd ~ bd ~")') {
  h.clock.advance(60_000);
  const r = await h.json<{ sketch: { id: string; currentVersion: number } }>("POST", "/api/sketches", {
    title: `${lessonId} Make`,
    originKind: "lesson-make",
    originId: lessonId,
    sessionId: null,
    code,
    bpm: 100,
    meter: "4/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: true,
  });
  expect(r.status).toBe(200);
  return { sketchId: r.body.sketch.id, sketchVersion: r.body.sketch.currentVersion };
}

/** The lesson as completed (the course service's own row), without walking its steps. */
function complete(h: Harness, lessonId: string): void {
  const at = h.clock.now().toISOString();
  h.server.deps.repos.lessons.saveProgress({
    lessonId: lessonId as never,
    status: "completed",
    currentStep: null,
    splitPart: null,
    startedAt: at,
    completedAt: at,
    bestScore: 1,
    completedVersion: 1,
    contentHash: "h",
    updatedAt: at,
  });
}

function passCheckpoint(h: Harness, cpId: string): void {
  const at = h.clock.now().toISOString();
  const cps = h.server.deps.repos.checkpoints;
  cps.start(cpId, 1, at, []);
  cps.finish(cpId, 1, {
    finishedAt: at,
    score: 0.9,
    passed: true,
    softPass: false,
    perSkill: [],
    detail: null,
  });
}

async function start(h: Harness, flavour = "flavour.funk", key?: string) {
  return h.json<UnitSongDetail>("POST", "/api/songs/U01/start", {
    flavour,
    ...(key === undefined ? {} : { idempotencyKey: key }),
  });
}

async function take(
  h: Harness,
  lessonId: string,
  over: Record<string, unknown> = {},
): Promise<{ status: number; body: UnitSongDetail }> {
  const sk = await makeSketch(h, lessonId);
  return h.json<UnitSongDetail>("POST", "/api/songs/U01/takes", {
    lessonId,
    ...sk,
    cells: "cells" in over ? over.cells : declared(lessonId),
    labels: { kick: "kick", snare: "snare" },
    bpm: 104,
    ...over,
  });
}

const song = async (h: Harness) => (await h.json<UnitSongDetail>("GET", "/api/songs/U01")).body;

describe("songs.start and songs.get", () => {
  test("start is idempotent and stores the flavour", async () => {
    const h = await server();
    const before = await song(h);
    expect(before).toMatchObject({ unitId: "U01", songId: "usong.U01", status: "new", takes: [] });
    expect(before.flavour).toBe("flavour.pop"); // the profile's, until the learner picks one

    const first = await start(h, "flavour.funk", "start-key-0001");
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      unitId: "U01",
      songId: "usong.U01",
      songVersion: U01.version,
      contentVersion: U01.version,
      flavour: "flavour.funk",
      title: U01.title,
      status: "open",
      changedSinceRelease: false,
      releasable: false,
      backfilled: false,
      styleSeen: true,
      takes: [],
      takesCount: 0,
      releases: [],
    });
    // The same key answers the stored response; another start (another tab) keeps the song as it is.
    expect((await start(h, "flavour.funk", "start-key-0001")).body).toEqual(first.body);
    const again = await start(h, "flavour.indie");
    expect(again.status).toBe(200);
    expect(again.body.flavour).toBe("flavour.funk");
    expect(await song(h)).toEqual(first.body);
    const list = await h.json<{ items: UnitSongSummary[] }>("GET", "/api/songs");
    expect(list.body.items.map((s) => [s.unitId, s.flavour, s.takesCount])).toEqual([
      ["U01", "flavour.funk", 0],
    ]);
    expect(list.body.items[0]).not.toHaveProperty("takes");
    // A unit with no song, and a unit id that is not one.
    expect((await h.json("POST", "/api/songs/U00/start", { flavour: "flavour.pop" })).status).toBe(404);
    expect((await h.json("GET", "/api/songs/X9")).status).toBe(400);
  });

  test("rename and the one-time style card", async () => {
    const h = await server();
    await start(h);
    expect((await h.json("POST", "/api/songs/U01/title", { title: "" })).status).toBe(400);
    expect((await h.json("POST", "/api/songs/U01/title", { title: "x".repeat(61) })).status).toBe(400);
    const named = await h.json<UnitSongDetail>("POST", "/api/songs/U01/title", { title: "  Night bus  " });
    expect(named.body.title).toBe("Night bus");
    const seen = await h.json<UnitSongDetail>("POST", "/api/songs/U01/style-seen");
    expect(seen.body.styleSeen).toBe(true);
    // Writes to a song that has not started are refused.
    expect((await h.json("POST", "/api/songs/U02/title", { title: "Riff" })).status).toBe(409);
  });
});

describe("songs.recordTake", () => {
  test("recordTake refuses a lesson outside the song and a side step", async () => {
    const h = await server();
    await start(h);
    // U02.L01 belongs to U02's song.
    expect((await take(h, "U02.L01", { cells: ["kick@verse"] })).status).toBe(400);
    // U01.L08 is a side step (3/4): its Make stays a sketch of its own.
    expect((await take(h, "U01.L08", { cells: [] })).status).toBe(400);
    // A cell outside the step's sections, a part the song does not have, a sketch of another lesson.
    expect((await take(h, "U01.L01", { cells: ["kick@chorus1"] })).status).toBe(400);
    expect((await take(h, "U01.L01", { cells: ["tuba@verse"] })).status).toBe(400);
    expect((await take(h, "U01.L01", { labels: { kick: "tuba" } })).status).toBe(400);
    const other = await makeSketch(h, "U01.L02");
    expect(
      (
        await h.json("POST", "/api/songs/U01/takes", {
          lessonId: "U01.L01",
          ...other,
          cells: declared("U01.L01"),
          labels: {},
          bpm: 100,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await h.json("POST", "/api/songs/U01/takes", {
          lessonId: "U01.L01",
          sketchId: "sk_missing",
          sketchVersion: 1,
          cells: declared("U01.L01"),
          labels: {},
          bpm: 100,
        })
      ).status,
    ).toBe(404);
    expect((await song(h)).takes).toEqual([]);
    // The take Make itself is recorded, with its code from the sketch version.
    const ok = await take(h, "U01.L01");
    expect(ok.status).toBe(200);
    expect(ok.body.takes.map((t) => [t.lessonId, t.cells, t.bpm, t.backfilled, t.code])).toEqual([
      ["U01.L01", declared("U01.L01"), 104, false, 'kick: s("bd ~ bd ~")'],
    ]);
  });

  test("recordTake with the same idempotency key stores one take", async () => {
    const h = await server();
    await start(h);
    const sk = await makeSketch(h, "U01.L01");
    const body = {
      lessonId: "U01.L01",
      ...sk,
      cells: declared("U01.L01"),
      labels: { kick: "kick" },
      bpm: 100,
      idempotencyKey: "take-U01-L01-0001",
    };
    const a = await h.json<UnitSongDetail>("POST", "/api/songs/U01/takes", body);
    const b = await h.json<UnitSongDetail>("POST", "/api/songs/U01/takes", body);
    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(a.body.takes.length).toBe(1);
    // The same key with another body is a conflict.
    expect((await h.json("POST", "/api/songs/U01/takes", { ...body, bpm: 90 })).status).toBe(409);
    // Another key for the same saved version (a second tab) refines that take instead of adding one.
    const refined = await h.json<UnitSongDetail>("POST", "/api/songs/U01/takes", {
      ...body,
      cells: ["kick@verse"],
      idempotencyKey: "take-U01-L01-0002",
    });
    const expected: unknown[] = [[a.body.takes[0]?.id, ["kick@verse"]]];
    expect(refined.body.takes.map((t): unknown => [t.id, t.cells])).toEqual(expected);
  });

  test("a take of a song that has not started starts it in the profile's style", async () => {
    const h = await server();
    const r = await take(h, "U01.L01");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "open", flavour: "flavour.pop", styleSeen: false, takesCount: 1 });
  });
});

describe("the backfill (spec §5.6a)", () => {
  test("backfills a started unit from lesson-make sketches", async () => {
    const h = await server();
    // A learner whose U01 Makes predate songs: four completed lessons, each with its Make sketch.
    const lessons = ["U01.L01", "U01.L02", "U01.L03", "U01.L04"];
    const saved: { sketchId: string; sketchVersion: number }[] = [];
    for (const l of lessons) {
      saved.push(await makeSketch(h, l, `// ${l}\nkick: s("bd*4")`));
      complete(h, l);
    }
    expect((await song(h)).status).toBe("new");
    startupTasks(h.server.deps);
    const s = await song(h);
    expect(s).toMatchObject({ status: "open", flavour: "flavour.pop", backfilled: true, styleSeen: false });
    const expected: unknown[] = lessons.map((l, i) => [
      l,
      saved[i]?.sketchId,
      saved[i]?.sketchVersion,
      declared(l),
      true,
    ]);
    expect(
      s.takes.map((t): unknown => [t.lessonId, t.sketchId, t.sketchVersion, t.cells, t.backfilled]),
    ).toEqual(expected);
    expect(s.takes.map((t) => t.code)).toEqual(lessons.map((l) => `// ${l}\nkick: s("bd*4")`));
    // Idempotent: the next start-up adds nothing.
    startupTasks(h.server.deps);
    expect((await song(h)).takes.map((t) => t.id)).toEqual(s.takes.map((t) => t.id));
    // The app refines a backfilled take when it saves that version again with the cells it computed.
    const first = s.takes[0];
    if (first === undefined) throw new Error("no take");
    const refined = await h.json<UnitSongDetail>("POST", "/api/songs/U01/takes", {
      lessonId: first.lessonId,
      sketchId: first.sketchId,
      sketchVersion: first.sketchVersion,
      cells: ["kick@verse"],
      labels: { kick: "kick" },
      bpm: 100,
    });
    expect(refined.body.takes.map((t) => [t.id, t.backfilled])).toEqual(
      s.takes.map((t, i) => [t.id, i !== 0]),
    );
    expect(refined.body.takes[0]?.cells).toEqual(["kick@verse"]);
  });

  test("songs.start runs the unit's backfill and keeps the learner's style choice", async () => {
    const h = await server();
    await makeSketch(h, "U01.L01");
    complete(h, "U01.L01");
    const r = await start(h, "flavour.jazz-soul");
    expect(r.body).toMatchObject({ flavour: "flavour.jazz-soul", backfilled: true, styleSeen: true });
    expect(r.body.takes.map((t) => t.lessonId)).toEqual(["U01.L01"]);
  });
});

describe("releases (spec §5.4)", () => {
  async function songWithTakes(h: Harness) {
    await start(h, "flavour.funk");
    for (const l of ["U01.L01", "U01.L02"]) {
      expect((await take(h, l)).status).toBe(200);
      complete(h, l);
    }
  }

  test("release is refused before releaseAfter, then writes the snapshot with Oak's code", async () => {
    const h = await server();
    await songWithTakes(h);
    const early = await h.json("POST", "/api/songs/U01/release", { title: "First groove" });
    expect(early.status).toBe(409);
    expect((await song(h)).releasable).toBe(false);
    passCheckpoint(h, U01.releaseAfter);
    expect((await song(h)).releasable).toBe(true);
    const r = await h.json<{ albumTrackId: string; albumVersion: number; releaseId: number }>(
      "POST",
      "/api/songs/U01/release",
      { title: "First groove" },
    );
    expect(r.status).toBe(200);
    expect(r.body.albumVersion).toBe(1);
    const s = await song(h);
    expect(s).toMatchObject({ status: "released", title: "First groove", changedSinceRelease: false });
    expect(s.releases).toEqual([
      {
        id: r.body.releaseId,
        albumTrackId: r.body.albumTrackId,
        albumVersion: 1,
        flavour: "flavour.funk",
        title: "First groove",
        createdAt: expect.any(String),
      },
    ]);
    const snap = await h.json<UnitSongSnapshot>("GET", `/api/songs/U01/releases/${r.body.releaseId}`);
    expect(snap.status).toBe(200);
    expect(snap.body).toMatchObject({
      unitId: "U01",
      albumTrackId: r.body.albumTrackId,
      albumVersion: 1,
      songId: "usong.U01",
      songVersion: U01.version,
      flavour: "flavour.funk",
      title: "First groove",
      bpm: 104,
      oakCode: U01.code["flavour.funk"],
      reviewBeforeRun: false,
    });
    expect(snap.body.def.sections).toEqual(U01.sections);
    expect(snap.body.def.parts).toEqual(U01.parts);
    expect(snap.body.takes.map((t) => [t.lessonId, t.cells, t.code])).toEqual(
      s.takes.map((t) => [t.lessonId, t.cells, t.code]),
    );
    // The album row: a track with no capstone, its unit, a version pointing at the newest take and the snapshot.
    const db = h.server.deps.db;
    const track = db.query("SELECT * FROM album_tracks WHERE id = ?").get(r.body.albumTrackId) as Record<
      string,
      unknown
    >;
    expect(track).toMatchObject({
      capstone_id: null,
      unit_id: "U01",
      title: "First groove",
      flavour: "flavour.funk",
    });
    const version = db
      .query("SELECT * FROM album_track_versions WHERE track_id = ? AND version = 1")
      .get(r.body.albumTrackId) as Record<string, unknown>;
    const newest = s.takes.at(-1);
    expect(version).toMatchObject({
      sketch_id: newest?.sketchId,
      sketch_version: newest?.sketchVersion,
      song_release_id: r.body.releaseId,
    });
    // A retried release with nothing changed adds no album version.
    const again = await h.json<{ albumTrackId: string; albumVersion: number }>(
      "POST",
      "/api/songs/U01/release",
      {
        title: "First groove",
      },
    );
    expect(again.body).toMatchObject({ albumTrackId: r.body.albumTrackId, albumVersion: 1 });
    expect((await song(h)).releases.length).toBe(1);
  });

  test("a take after release leaves the snapshot and marks the song changed", async () => {
    const h = await server();
    await songWithTakes(h);
    passCheckpoint(h, U01.releaseAfter);
    const r = await h.json<{ albumTrackId: string; releaseId: number }>("POST", "/api/songs/U01/release", {
      title: "First groove",
    });
    const path = `/api/songs/U01/releases/${r.body.releaseId}`;
    const before = (await h.json<UnitSongSnapshot>("GET", path)).body;
    // The learner replays U01.L01 after the release.
    expect((await take(h, "U01.L01", { bpm: 92 })).status).toBe(200);
    const s = await song(h);
    expect(s).toMatchObject({ status: "released", changedSinceRelease: true, takesCount: 3 });
    expect((await h.json<UnitSongSnapshot>("GET", path)).body).toEqual(before);
    // "Release again" adds an album version with a new snapshot.
    const again = await h.json<{ albumTrackId: string; albumVersion: number; releaseId: number }>(
      "POST",
      "/api/songs/U01/release",
      { title: "First groove" },
    );
    expect(again.body).toMatchObject({ albumTrackId: r.body.albumTrackId, albumVersion: 2 });
    expect(again.body.releaseId).not.toBe(r.body.releaseId);
    expect((await song(h)).changedSinceRelease).toBe(false);
    const snap2 = (await h.json<UnitSongSnapshot>("GET", `/api/songs/U01/releases/${again.body.releaseId}`))
      .body;
    expect(snap2.bpm).toBe(92);
    expect(snap2.takes.length).toBe(3);
    expect((await h.json<UnitSongSnapshot>("GET", path)).body).toEqual(before);
  });

  test("setFlavour keeps takes and never touches a release snapshot", async () => {
    const h = await server();
    await songWithTakes(h);
    passCheckpoint(h, U01.releaseAfter);
    const r = await h.json<{ releaseId: number }>("POST", "/api/songs/U01/release", {
      title: "First groove",
    });
    const path = `/api/songs/U01/releases/${r.body.releaseId}`;
    const before = (await h.json<UnitSongSnapshot>("GET", path)).body;
    const takes = (await song(h)).takes;
    const changed = await h.json<UnitSongDetail>("POST", "/api/songs/U01/flavour", {
      flavour: "flavour.indie",
    });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      flavour: "flavour.indie",
      changedSinceRelease: true,
      styleSeen: true,
    });
    expect(changed.body.takes).toEqual(takes);
    const after = (await h.json<UnitSongSnapshot>("GET", path)).body;
    expect(after).toEqual(before);
    expect(after.flavour).toBe("flavour.funk");
    expect(after.oakCode).toBe(U01.code["flavour.funk"]);
    expect(changed.body.releases[0]?.flavour).toBe("flavour.funk");
  });
});

describe("SessionPlan.song", () => {
  test("SessionPlan.song names today's line for a planned take lesson", async () => {
    const h = await server();
    for (const l of ["U00.L01", "U00.L02"]) complete(h, l);
    const plan = (await h.json<SessionPlan>("GET", "/api/session/today")).body;
    expect(plan.mapItemId).toBe("U01.L01");
    expect(plan.song).toEqual({
      unitId: "U01",
      songId: "usong.U01",
      title: U01.title,
      flavour: "flavour.pop",
      status: "new",
      takesCount: 0,
      lessonIndex: 1,
      lessonsInSong: U01.plan.length,
      today: takeStep("U01.L01").today,
      side: false,
    });
    // With the song started and two takes in it, Today plans U01.L03 inside it.
    await start(h, "flavour.indie");
    for (const l of ["U01.L01", "U01.L02"]) {
      await take(h, l);
      complete(h, l);
    }
    const next = (await h.json<SessionPlan>("GET", "/api/session/today")).body;
    expect(next.mapItemId).toBe("U01.L03");
    expect(next.song).toMatchObject({
      flavour: "flavour.indie",
      status: "open",
      takesCount: 2,
      lessonIndex: 3,
      today: takeStep("U01.L03").today,
    });
  });
});

describe("backups (spec §5.4, §5.6a)", () => {
  /** The archive with its manifest rewritten by `edit`. */
  function rewrite(archive: Uint8Array, edit: (m: Record<string, unknown>) => void): Uint8Array {
    const files = readZip(archive);
    const manifest = JSON.parse(new TextDecoder().decode(files.get("backup.json"))) as Record<
      string,
      unknown
    >;
    edit(manifest);
    return writeZip([
      { name: "backup.json", data: new TextEncoder().encode(JSON.stringify(manifest)) },
      ...[...files].filter(([n]) => n !== "backup.json").map(([name, data]) => ({ name, data })),
    ]);
  }

  test("imported takes and releases are flagged for review", async () => {
    const h = await server();
    await start(h);
    await take(h, "U01.L01");
    complete(h, "U01.L01");
    passCheckpoint(h, U01.releaseAfter);
    const r = await h.json<{ releaseId: number }>("POST", "/api/songs/U01/release", { title: "Groove" });
    const archive = new Uint8Array(await (await h.req("GET", "/api/backup/export?audio=0")).arrayBuffer());
    const imported = await h.destructive("POST", "/api/backup/import", "backup.import", "*", archive);
    expect(imported.status).toBe(200);
    expect((await song(h)).takes.map((t) => t.reviewBeforeRun)).toEqual([true]);
    const snap = await h.json<UnitSongSnapshot>("GET", `/api/songs/U01/releases/${r.body.releaseId}`);
    expect(snap.body.reviewBeforeRun).toBe(true);
  });

  test("an import of a backup from before songs backfills them; a current one is restored as it was", async () => {
    const h = await server();
    for (const l of ["U01.L01", "U01.L02"]) {
      await makeSketch(h, l);
      complete(h, l);
    }
    const archive = new Uint8Array(await (await h.req("GET", "/api/backup/export?audio=0")).arrayBuffer());
    // Same schema: the learner's songs are exactly the backup's (none here).
    expect((await h.destructive("POST", "/api/backup/import", "backup.import", "*", archive)).status).toBe(
      200,
    );
    expect((await song(h)).status).toBe("new");
    // A backup made before migration 0011: the import migrates it forward and the songs are backfilled.
    const older = rewrite(archive, (m) => {
      m.schemaVersion = 10;
      const tables = m.tables as Record<string, unknown>;
      for (const t of ["unit_songs", "unit_song_takes", "unit_song_releases"]) delete tables[t];
    });
    const res = await h.destructive("POST", "/api/backup/import", "backup.import", "*", older);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { migratedFrom: number | null }).migratedFrom).toBe(10);
    const s = await song(h);
    expect(s).toMatchObject({ status: "open", backfilled: true, styleSeen: false });
    expect(s.takes.map((t) => t.lessonId)).toEqual(["U01.L01", "U01.L02"]);
  });
});
