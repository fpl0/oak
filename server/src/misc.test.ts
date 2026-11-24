import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NamedToolEntry } from "@oak/grader";
import * as srs from "@oak/srs";
import { appVersionOf, loadConfig } from "./config.ts";
import { ConfirmStore, NONCE_TTL_MS } from "./confirm.ts";
import { ContentIndex } from "./content/index.ts";
import { loadContent } from "./content/loader.ts";
import { addDays, dayStartInstant, learnerDay, weekStart } from "./lib/days.ts";
import { namedToolbox } from "./seams.ts";
import { Secrets } from "./secrets.ts";
import { extFor, sniffAudio } from "./services/audio-store.ts";
import { packVersion, safeFile } from "./static.ts";

describe("config", () => {
  test("OAK_DATA_DIR, OAK_DEV and --serve-dist", () => {
    const c = loadConfig({ env: { OAK_DATA_DIR: "/tmp/oak-x", OAK_DEV: "1" }, argv: ["--serve-dist"] });
    expect(c).toMatchObject({
      hostname: "127.0.0.1",
      port: 8787,
      dev: true,
      serveDist: true,
      dataDir: "/tmp/oak-x",
      dbPath: "/tmp/oak-x/oak.db",
    });
    expect(c.devPorts).toEqual([5173]);
    expect(c.tutorFake).toBe(false);
    const d = loadConfig({ env: {}, argv: [] });
    expect(d.dataDir.endsWith("/.oak")).toBe(true);
    expect(d.devPorts).toEqual([]);
    // Wave 2 stacks: own ports by environment; the fake tutor only together with OAK_DEV=1.
    const w = loadConfig({
      env: { OAK_DEV: "1", OAK_PORT: "8801", OAK_VITE_PORT: "5201", OAK_TUTOR_FAKE: "1" },
      argv: [],
    });
    expect(w).toMatchObject({ port: 8801, devPorts: [5173, 5201], tutorFake: true });
    const p = loadConfig({ env: { OAK_PORT: "8801", OAK_VITE_PORT: "5201", OAK_TUTOR_FAKE: "1" }, argv: [] });
    expect(p).toMatchObject({ port: 8801, devPorts: [], tutorFake: false });
  });

  test("the app version: the desktop app's, else desktop/package.json's, with -dev on a dev server", () => {
    const root = mkdtempSync(join(tmpdir(), "oak-version-"));
    try {
      // The staged desktop app has no desktop/ folder: Electron passes the version.
      expect(appVersionOf({ OAK_APP_VERSION: "1.3.0" }, root, false)).toBe("1.3.0");
      expect(appVersionOf({}, root, false)).toBe("0.0.0");
      mkdirSync(join(root, "desktop"));
      writeFileSync(join(root, "desktop", "package.json"), JSON.stringify({ version: "1.4.2" }));
      expect(appVersionOf({}, root, false)).toBe("1.4.2");
      expect(appVersionOf({}, root, true)).toBe("1.4.2-dev");
      expect(appVersionOf({ OAK_APP_VERSION: " 1.5.0 " }, root, false)).toBe("1.5.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    // This checkout reads its own desktop/package.json.
    const own = JSON.parse(
      readFileSync(join(import.meta.dir, "..", "..", "desktop", "package.json"), "utf8"),
    );
    expect(loadConfig({ env: {}, argv: [] }).appVersion).toBe(own.version);
  });
});

describe("confirm nonces", () => {
  test("single use, bound to action and target, 60 s", () => {
    let now = 0;
    const s = new ConfirmStore(() => new Date(now));
    const a = s.issue("sketch.delete", "sk1");
    expect(a.nonce.length).toBeGreaterThanOrEqual(16);
    expect(s.consume(a.nonce, "sketch.delete", "sk2")).toBe(false);
    expect(s.consume(a.nonce, "sketch.delete", "sk1")).toBe(false); // spent by the mismatch
    const b = s.issue("sketch.delete", "sk1");
    expect(s.consume(b.nonce, "sketch.delete", "sk1")).toBe(true);
    expect(s.consume(b.nonce, "sketch.delete", "sk1")).toBe(false);
    const c = s.issue("data.reset", "*");
    now += NONCE_TTL_MS;
    expect(s.consume(c.nonce, "data.reset", "*")).toBe(false);
    expect(s.consume(null, "data.reset", "*")).toBe(false);
  });
});

describe("secrets", () => {
  test("the environment key is read once and deleted; a pasted key wins and is 0600 in a 0700 dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "oak-sec-"));
    try {
      const env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: "sk-env" };
      const s = new Secrets(join(dir, "secrets"), { env });
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect([s.anthropicKey(), s.source()]).toEqual(["sk-env", "env"]);
      s.savePasted("sk-pasted");
      expect([s.anthropicKey(), s.source()]).toEqual(["sk-pasted", "pasted"]);
      expect(statSync(join(dir, "secrets")).mode & 0o777).toBe(0o700);
      expect(statSync(join(dir, "secrets", "anthropic.key")).mode & 0o777).toBe(0o600);
      s.deletePasted();
      expect(s.source()).toBe("env");
      writeFileSync(join(dir, ".env.local"), 'OTHER=1\nANTHROPIC_API_KEY="sk-local"\n');
      expect(new Secrets(join(dir, "s2"), { env: {}, rootDir: dir }).anthropicKey()).toBe("sk-local");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("learner days agree with @oak/srs", () => {
  test.each([
    ["2026-11-11T03:59:00Z", "UTC"],
    ["2026-11-11T04:00:00Z", "UTC"],
    ["2026-03-29T02:30:00Z", "Europe/Lisbon"],
    ["2026-11-01T08:30:00Z", "America/New_York"],
    ["2026-07-01T18:00:00Z", "Asia/Tokyo"],
  ])("%s in %s", (iso, tz) => {
    const at = new Date(iso);
    expect(learnerDay(at, tz)).toBe(srs.learnerDay(at, tz));
    const day = learnerDay(at, tz);
    expect(weekStart(day)).toBe(srs.weekStart(day));
    expect(dayStartInstant(day, tz).getTime()).toBe(srs.dayStartInstant(day, tz).getTime());
    expect(addDays(day, 3)).toBe(srs.addDays(day, 3));
  });
});

describe("files", () => {
  test("audio sniffing and extensions", () => {
    expect(sniffAudio(new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt "))).toBe("audio/wav");
    expect(sniffAudio(new TextEncoder().encode("fLaC\0\0\0\0\0\0\0\0"))).toBe("audio/flac");
    expect(sniffAudio(new TextEncoder().encode("ID3\u0004\0\0\0\0\0\0\0\0"))).toBe("audio/mpeg");
    expect(sniffAudio(new TextEncoder().encode("<!doctype html>"))).toBeNull();
    expect(extFor("audio/mpeg", "x")).toBe("mp3");
    expect(extFor("application/octet-stream", "song.FLAC")).toBe("flac");
  });

  test("static paths cannot escape their root; the pack version comes from the lock file", () => {
    const dir = mkdtempSync(join(tmpdir(), "oak-st-"));
    try {
      mkdirSync(join(dir, "pack", "v2", "a b"), { recursive: true });
      writeFileSync(join(dir, "pack", "v2", "a b", "x.wav"), "x");
      writeFileSync(join(dir, "secret.txt"), "no");
      expect(safeFile(join(dir, "pack"), "v2/a%20b/x.wav")).not.toBeNull();
      expect(safeFile(join(dir, "pack"), "../secret.txt")).toBeNull();
      expect(safeFile(join(dir, "pack"), "%2e%2e/secret.txt")).toBeNull();
      expect(safeFile(join(dir, "pack"), "v2")).toBeNull();
      expect(packVersion(join(dir, "pack"))).toBe("v2");
      writeFileSync(join(dir, "pack.lock.json"), JSON.stringify({ packVersion: "v1" }));
      expect(packVersion(join(dir, "pack"))).toBe("v1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("content loader", () => {
  test("a missing content directory is a problem, not a crash", async () => {
    const c = await loadContent({ contentDir: "/nonexistent/oak-content" });
    expect(c.problems).toHaveLength(1);
    expect(c.lessons).toEqual([]);
  });

  test("the real content/ loads its registries and reports what is missing", async () => {
    const c = await loadContent({ contentDir: join(import.meta.dir, "..", "..", "content") });
    expect(c.syllabus.units.length).toBeGreaterThan(0);
    expect(c.skills.length).toBeGreaterThan(0);
    expect(Array.isArray(c.problems)).toBe(true);
  });

  test("the graders' toolbox names every unlock site in the learner's words, never by a bare ID", async () => {
    const c = await loadContent({ contentDir: join(import.meta.dir, "..", "..", "content") });
    const index = new ContentIndex(c);
    const rows = namedToolbox(index) as readonly NamedToolEntry[];
    expect(rows.length).toBe(index.toolbox().length);
    const unnamed = rows.filter((r) => r.unlockNames === undefined).map((r) => r.id);
    expect(unnamed).toEqual([]);
    for (const r of rows)
      for (const n of r.unlockNames ?? []) expect(n.title).not.toMatch(/^[A-Z]+\d+(\.|$)/);
  });
});
