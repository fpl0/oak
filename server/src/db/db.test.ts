import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { all, openDb, schemaVersion, tableNames } from "./index.ts";
import { latestVersion, loadMigrations, migrate } from "./migrate.ts";
import { createRepos } from "./repos/index.ts";

const repos = () => {
  const db = openDb(":memory:");
  return createRepos(db, { timezone: "UTC", now: () => new Date("2026-11-11T12:00:00.000Z") });
};

describe("schema", () => {
  test("0001 to 0012 create every table of interfaces.md §7 plus Waves 2 to 7, unit songs and Oak 2.0, and set user_version", () => {
    const db = openDb(":memory:");
    expect(schemaVersion(db)).toBe(12);
    expect(latestVersion()).toBe(12);
    const expected = [
      "settings",
      "learner_profile",
      "calibration_runs",
      "sessions",
      "lesson_progress",
      "step_state",
      "step_attempts",
      "exercise_results",
      "checkpoint_attempts",
      "repair_queue",
      "capstone_state",
      "evidence",
      "skill_state",
      "srs_cards",
      "srs_revlog",
      "family_state",
      "drill_sessions",
      "drill_trials",
      "streak_days",
      "streak_weeks",
      "rests",
      "unlocks",
      "cando_ledger",
      "terms_introduced",
      "sketches",
      "sketch_versions",
      "album_tracks",
      "album_track_versions",
      "audio_files",
      "transcriptions",
      "transcription_versions",
      "gym_sessions",
      "tutor_conversations",
      "tutor_messages",
      "tutor_backend_records",
      "tutor_usage",
      "tutor_cards",
      "tutor_notes",
      "qa_reports",
      "step_telemetry",
      "session_telemetry",
      "onboarding_state",
      "listen_marks",
      "idempotency_keys",
      "voice_state",
      "sung_notes",
      "capstone_sessions",
      "capstone_checks",
      "ladder_state",
      "ladder_sessions",
      "transcription_review_versions",
      // Wave 6 (0007): the recorded track gates, the end of the core, every take of an album version (d20).
      "track_gates",
      "core_state",
      "album_takes",
      // Wave 7 (0008): the learner's focus between the tracks, the end of the whole course, AC1's two versions.
      "track_focus",
      "course_state",
      "capstone_versions",
      // Unit songs (0011): each unit's song, the takes that fill it, its frozen releases.
      "unit_songs",
      "unit_song_takes",
      "unit_song_releases",
      // Oak 2.0 (0012, migrations.oak2.test.ts): scraps, the learner's templates, capstone check history, Later, catalogs.
      "scraps",
      "user_templates",
      "capstone_check_history",
      "later_items",
      "catalogs",
    ];
    expect(tableNames(db).sort()).toEqual([...expected].sort());
    expect(all<{ foreign_keys: number }>(db, "PRAGMA foreign_keys")[0]?.foreign_keys).toBe(1);
  });

  test("0011 only adds tables and columns: the album rows gain their unit and release", () => {
    const db = openDb(":memory:");
    const cols = (t: string) => all<{ name: string }>(db, `PRAGMA table_info(${t})`).map((c) => c.name);
    expect(cols("album_tracks")).toContain("unit_id");
    expect(cols("album_track_versions")).toContain("song_release_id");
    expect(cols("unit_songs")).toEqual([
      "unit_id",
      "song_id",
      "song_version",
      "flavour",
      "title",
      "status",
      "backfilled",
      "style_seen",
      "created_at",
      "released_at",
    ]);
    expect(cols("unit_song_takes")).toEqual(
      expect.arrayContaining([
        "unit_id",
        "lesson_id",
        "sketch_id",
        "sketch_version",
        "cells_json",
        "labels_json",
      ]),
    );
    expect(cols("unit_song_releases")).toEqual(
      expect.arrayContaining(["album_track_id", "album_version", "oak_code", "def_json", "takes_json"]),
    );
    // A database at 0010 with a learner's sketches and album keeps every row through 0011.
    const old = openDb(":memory:", { migrate: false });
    const migs = loadMigrations();
    migrate(old, migs.slice(0, 10));
    old.run(
      "INSERT INTO sketches (id, title, origin_kind, origin_id, created_at, updated_at) VALUES ('sk_1', 'm', 'lesson-make', 'U01.L01', 't', 't')",
    );
    old.run(
      "INSERT INTO sketch_versions (sketch_id, version, code, created_at) VALUES ('sk_1', 1, 's(\"bd\")', 't')",
    );
    old.run(
      "INSERT INTO album_tracks (id, side, track_no, title, cover_seed, created_at) VALUES ('trk_1', 'Bside', 1, 'B', 'c', 't')",
    );
    old.run(
      "INSERT INTO album_track_versions (track_id, version, sketch_id, sketch_version, created_at) VALUES ('trk_1', 1, 'sk_1', 1, 't')",
    );
    expect(migrate(old, migs.slice(0, 11))).toEqual([11]);
    for (const t of ["sketches", "sketch_versions", "album_tracks", "album_track_versions"])
      expect([t, all<{ n: number }>(old, `SELECT COUNT(*) AS n FROM ${t}`)[0]?.n]).toEqual([t, 1]);
  });

  test("the contracts §11.11 amendments are in place", () => {
    const db = openDb(":memory:");
    const cols = (t: string) =>
      all<{ name: string; notnull: number }>(db, `PRAGMA table_info(${t})`).map((c) => c.name);
    expect(cols("album_tracks")).toEqual(expect.arrayContaining(["capstone_id", "side", "sketch_id"]));
    expect(cols("album_track_versions")).toEqual(
      expect.arrayContaining(["tutor_assisted", "attribution", "band_json", "flags_json"]),
    );
    expect(cols("tutor_notes")).toEqual(
      expect.arrayContaining(["subject_kind", "subject_id", "source", "retracted_at", "skill_id"]),
    );
    expect(cols("tutor_conversations")).toEqual(expect.arrayContaining(["thread_kind", "day", "effort"]));
    expect(cols("tutor_conversations")).not.toContain("current_effort");
    expect(cols("step_attempts")).toEqual(
      expect.arrayContaining([
        "exercise_version",
        "hint_rung",
        "params_json",
        "series_no",
        "disputed",
        "modality",
        "adjusted",
      ]),
    );
    expect(cols("srs_cards")).toEqual(expect.arrayContaining(["status", "released_at"]));
    expect(cols("learner_profile")).toEqual(
      expect.arrayContaining([
        "sing_latency_ms",
        "tap_jitter_ms",
        "output_kind",
        "quiet",
        "weekly_goal",
        "flavour",
      ]),
    );
    // CHECKs: sing tolerance and session kinds.
    expect(() =>
      db.run(
        "INSERT INTO learner_profile (id, timezone, flavour, created_at, sing_tolerance_cents) VALUES (1, 'UTC', 'x', 'now', 60)",
      ),
    ).toThrow();
    expect(() =>
      db.run(
        "INSERT INTO sessions (id, day, kind, target_minutes, started_at) VALUES ('s', 'd', 'nap', 20, 'now')",
      ),
    ).toThrow();
  });

  test("a database newer than the code is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "oak-db-"));
    try {
      const path = join(dir, "oak.db");
      const db = openDb(path);
      db.run("PRAGMA user_version = 13");
      db.close();
      expect(() => openDb(path)).toThrow(/newer than this build/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("migrations apply in order and only once", () => {
    const dir = mkdtempSync(join(tmpdir(), "oak-mig-"));
    try {
      writeFileSync(join(dir, "0001_a.sql"), "CREATE TABLE a (x INTEGER);");
      writeFileSync(join(dir, "0002_b.sql"), "CREATE TABLE b (y INTEGER);");
      writeFileSync(join(dir, "README.md"), "ignored");
      const db = openDb(":memory:", { migrate: false });
      const migs = loadMigrations(dir);
      expect(migrate(db, migs)).toEqual([1, 2]);
      expect(migrate(db, migs)).toEqual([]);
      expect(schemaVersion(db)).toBe(2);
      writeFileSync(join(dir, "0004_gap.sql"), "SELECT 1;");
      expect(() => loadMigrations(dir)).toThrow(/expected version 3/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("append-only and never-deleted rows", () => {
  test("tutor messages and backend records refuse UPDATE and DELETE", () => {
    const r = repos();
    r.tutor.createConversation({
      id: "c1",
      key: { subjectKind: "general", subjectId: "oak", day: "2026-11-11", lane: "chat" },
      effort: "medium",
      prefixVersion: "p",
      model: "m",
      at: "2026-11-11T12:00:00.000Z",
    });
    r.tutor.append(
      "c1",
      {
        role: "user",
        kind: "chat",
        text: "hi",
        learnerCode: null,
        cardIds: [],
        review: null,
        stepId: null,
        rung: null,
        summary: null,
        backend: null,
        excluded: false,
        errorKind: null,
      },
      new Date(),
    );
    r.tutor.appendBackendRecords(
      "c1",
      "anthropic-api",
      [{ role: "user" }],
      false,
      "2026-11-11T12:00:00.000Z",
    );
    expect(() => r.db.run("UPDATE tutor_messages SET text = 'x'")).toThrow(/append-only/);
    expect(() => r.db.run("DELETE FROM tutor_messages")).toThrow(/append-only/);
    expect(() => r.db.run("UPDATE tutor_backend_records SET excluded = 1")).toThrow(/append-only/);
    expect(() => r.db.run("DELETE FROM tutor_backend_records")).toThrow(/append-only/);
  });

  test("the rest bank holds at most 2 unspent rests", () => {
    const r = repos();
    r.streak.earnRest("2026-11-02");
    r.streak.earnRest("2026-11-09");
    expect(() => r.streak.earnRest("2026-11-16")).toThrow(/at most 2/);
    expect(r.streak.spendRests("2026-11-16", 1)).toBe(1);
    r.streak.earnRest("2026-11-23");
    expect(r.streak.unspentRests()).toBe(2);
  });

  test("unlocks are inserted once and never deleted", () => {
    const r = repos();
    const u = {
      itemId: "tb.mini.rest",
      kind: "tool" as const,
      sourceKind: "session-complete" as const,
      sourceId: "U01.L01",
      unlockedAt: "2026-11-11T12:00:00.000Z",
      seen: false,
    };
    expect(r.unlocks.grant(u)).toEqual(u);
    expect(r.unlocks.grant({ ...u, sourceId: "other" })).toBeNull();
    expect(r.unlocks.get("tb.mini.rest")?.sourceId).toBe("U01.L01");
    expect(() => r.db.run("DELETE FROM unlocks")).toThrow(/never deleted/);
  });
});

describe("repositories", () => {
  test("the profile row is created with defaults and patched by field", () => {
    const r = repos();
    const p = r.profile.get();
    expect(p).toMatchObject({
      timezone: "UTC",
      rolloverHour: 4,
      targetMinutes: 20,
      weeklyGoal: 5,
      singToleranceCents: 70,
      quiet: false,
    });
    expect(r.profile.patch({ targetMinutes: 15, quiet: true })).toMatchObject({
      targetMinutes: 15,
      quiet: true,
    });
  });

  test("settings fall back to defaults when a stored value no longer validates", () => {
    const r = repos();
    r.db.run("INSERT INTO settings (key, value_json, updated_at) VALUES ('volume', '\"loud\"', 'x')");
    expect(r.settings.get("volume")).toBe(0.8);
    r.settings.put("volume", 0.3, "x");
    expect(r.settings.get("volume")).toBe(0.3);
  });

  test("a stored tutor setting from before the hard cap was removed keeps its values", () => {
    const r = repos();
    const old = { backend: "off", softMonthlyUsd: 40, hardMonthlyUsd: 60, softWarnedMonth: "2026-10" };
    r.db.run("INSERT INTO settings (key, value_json, updated_at) VALUES ('tutor', ?, 'x')", [
      JSON.stringify(old),
    ]);
    expect(r.settings.get("tutor")).toEqual({
      backend: "off",
      softMonthlyUsd: 40,
      softWarnedMonth: "2026-10",
    });
    expect(r.settings.all().tutor).not.toHaveProperty("hardMonthlyUsd");
  });

  test("tutor timeline merges conversations of a subject in time order; cards and notes round-trip", () => {
    const r = repos();
    const mk = (lane: "chat" | "hint", id: string) =>
      r.tutor.createConversation({
        id,
        key: { subjectKind: "lesson", subjectId: "U01.L02", day: "2026-11-11", lane },
        effort: "low",
        prefixVersion: "p",
        model: "m",
        at: "t",
      });
    mk("chat", "a");
    mk("hint", "b");
    const entry = (text: string) => ({
      role: "user" as const,
      kind: "chat" as const,
      text,
      learnerCode: null,
      cardIds: [],
      review: null,
      stepId: null,
      rung: null,
      summary: null,
      backend: null,
      excluded: false,
      errorKind: null,
    });
    const t = new Date("2026-11-11T12:00:00.000Z");
    r.tutor.append("a", entry("one"), t);
    r.tutor.append("b", entry("two"), t);
    r.tutor.append("a", entry("three"), t);
    expect(
      r.tutor.subjectEntries("lesson", "U01.L02", { includeExcluded: true }).map((e) => [e.text, e.seq]),
    ).toEqual([
      ["one", 1],
      ["two", 1],
      ["three", 2],
    ]);
    const card = r.tutor.saveCard({
      cardId: "card1",
      conversationId: "a",
      toolUseId: "tu1",
      kind: "fix",
      title: "Try this",
      code: 's("bd ~")',
      explanation: "a rest",
      bars: 1,
      apply: "preview_only",
      applyAllowed: false,
      lockedTools: ["tb.fast"],
      createdAt: "t",
    });
    expect(card).toMatchObject({ apply: "preview_only", applied: false, lockedTools: ["tb.fast"] });
    expect(r.tutor.markApplied("card1", "t", null)).toBe(false); // preview-only is never applied
    const note = r.tutor.addNote({
      id: "n1",
      day: "2026-11-11",
      subjectKind: "lesson",
      subjectId: "U01.L02",
      source: "listening",
      text: "Nice.",
      skillId: null,
      conversationId: null,
      at: "t",
    });
    expect(r.tutor.notes({ subjectKind: "lesson", subjectId: "U01.L02" })).toEqual([note]);
    r.tutor.retractNote("n1", "t2");
    expect(r.tutor.notes({ subjectKind: "lesson", subjectId: "U01.L02" })).toEqual([]);
  });
});
