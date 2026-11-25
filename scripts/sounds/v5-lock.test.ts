// Sound pack v5 keeps every v4 sound (Oak 2.0 W2, Task 6): every file v4 shipped is in v5 at the same path with
// the same bytes, every v4 `n` index plays the file it played in v4, and every file v5 adds carries a licence on
// the allow-list. A changed v4 sound would move every song, Band and loudness budget at once.
//
// The v4 lock is read from git (the W2 cut point, 0447c2d); set OAK_V4_LOCK to a file to check a build made
// outside the repository. The map checks need the built pack on disk (sounds/pack/v5/, as check.ts does).

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Source } from "./library.ts";
import { SOURCES_V5 } from "./library-v5.ts";
import { LICENCE_ALLOW_LIST, type PackLock, type PackManifest } from "./pack.config.ts";

const ROOT = join(import.meta.dirname, "../..");
const V4_COMMIT = "0447c2d";

function v4Lock(): PackLock {
  const file = process.env.OAK_V4_LOCK;
  if (file) return JSON.parse(readFileSync(file, "utf8")) as PackLock;
  const p = Bun.spawnSync({ cmd: ["git", "show", `${V4_COMMIT}:sounds/pack.lock.json`], cwd: ROOT });
  if (p.exitCode !== 0) throw new Error(`git show ${V4_COMMIT}:sounds/pack.lock.json failed`);
  return JSON.parse(new TextDecoder().decode(p.stdout)) as PackLock;
}

const v4 = v4Lock();
const v5 = JSON.parse(readFileSync(join(ROOT, "sounds/pack.lock.json"), "utf8")) as PackLock;
const rel = (path: string) => path.slice(path.indexOf("/") + 1);
/** Files whose bytes name the pack version (`_base`, the publicRoot, the credits heading): checked by content. */
const versioned = (path: string) => /\.json$/.test(path) || /(^|\/)CREDITS\.md$/.test(path);
const AUDIO = /\.(mp3|flac|wav)$/;

test("the lock is pack v5", () => {
  expect(v4.packVersion).toBe("v4");
  expect(v5.packVersion).toBe("v5");
  expect(v5.publicRoot).toBe("/sounds/v5");
});

test("every v4 file is in v5 at the same path with the same bytes", () => {
  const now = new Map(v5.files.map((f) => [rel(f.path), f]));
  const changed: string[] = [];
  for (const f of v4.files) {
    if (versioned(f.path)) continue;
    const g = now.get(rel(f.path));
    if (!g || g.sha256 !== f.sha256 || g.bytes !== f.bytes) changed.push(rel(f.path));
  }
  expect(changed).toEqual([]);
});

test("every upstream file v4 was built from is unchanged", () => {
  const now = new Map((v5.sources ?? []).map((s) => [s.url, s.sha256]));
  const moved = (v4.sources ?? []).filter((s) => now.has(s.url) && now.get(s.url) !== s.sha256);
  expect(moved.map((s) => s.url)).toEqual([]);
});

test("every v5 source is pinned and on the licence allow-list; CC BY ones carry their attribution", () => {
  for (const [id, s] of Object.entries(SOURCES_V5) as [string, Source][]) {
    if (s.kind === "github") expect([id, /^[0-9a-f]{40}$/.test(s.commit)]).toEqual([id, true]);
    else expect([id, /^[0-9a-f]{64}$/.test(s.sha256)]).toEqual([id, true]);
    expect([id, LICENCE_ALLOW_LIST.includes(s.credit.licence)]).toEqual([id, true]);
    if (s.credit.licence.startsWith("CC-BY")) expect([id, !!s.credit.attribution]).toEqual([id, true]);
  }
});

test("every file v5 adds has a credit whose licence is allowed (CC BY with its attribution)", () => {
  const old = new Set(v4.files.map((f) => rel(f.path)));
  const bad: string[] = [];
  for (const f of v5.files) {
    if (old.has(rel(f.path)) || !AUDIO.test(f.path)) continue;
    const c = f.credit ? v5.credits?.[f.credit] : undefined;
    if (!c) bad.push(`${f.path}: no credit`);
    else if (!LICENCE_ALLOW_LIST.includes(c.licence)) bad.push(`${f.path}: ${c.licence}`);
    else if (c.licence.startsWith("CC-BY") && !c.attribution) bad.push(`${f.path}: no attribution`);
  }
  expect(bad).toEqual([]);
});

const PACK = join(ROOT, "sounds/pack/v5");
describe.if(v5.packVersion === "v5" && existsSync(PACK))("the v5 maps keep every v4 index", () => {
  const map = (file: string) =>
    JSON.parse(readFileSync(join(PACK, file), "utf8")) as Record<string, string[] | string>;

  test("a kit role's v4 variant `n`, layer `l` is the same file (index n * layers + l)", () => {
    const wrong: string[] = [];
    for (const f of v4.files) {
      const m = /^v4\/kits\/([a-z0-9]+)\/([a-z]+)_(\d+)_(\d+)\.flac$/.exec(f.path);
      if (!m) continue;
      const [, kit, role, n, l] = m as unknown as [string, string, string, string, string];
      const key = `${kit}_${role}`;
      const list = map(`oak-kit-${kit}.json`)[key] as string[];
      const layers = (map("manifest.json") as unknown as PackManifest).kitLayers?.[key]?.layers ?? 1;
      const file = rel(f.path);
      // a one-layer variant in a two-layer role is listed twice (its file plays both layers)
      const at = Number(n) * layers + Number(l);
      if (list?.[at] !== file) wrong.push(`${key}[${at}] is ${list?.[at]}, v4 had ${file}`);
    }
    expect(wrong).toEqual([]);
  });

  test("a one-shot's v4 index is the same file", () => {
    const perc = map("oak-perc.json");
    const wrong: string[] = [];
    for (const f of v4.files) {
      const m = /^v4\/perc\/([a-z]+)_(\d+)\.flac$/.exec(f.path);
      if (!m) continue;
      const [, name, i] = m as unknown as [string, string, string];
      const list = perc[name] as string[];
      if (list?.[Number(i)] !== rel(f.path)) wrong.push(`${name}[${i}] is ${list?.[Number(i)]}`);
    }
    expect(wrong).toEqual([]);
  });

  test("every other v4 sound is still listed in its map", () => {
    const MAPS: [string, string][] = [
      ["src/", "oak-src.json"],
      ["breaks/", "oak-breaks.json"],
      ["wavetables/", "oak-wavetables.json"],
      ["piano/", "piano.json"],
      ["uzu-drumkit/", "uzu-drumkit.json"],
    ];
    const missing: string[] = [];
    for (const f of v4.files) {
      const p = rel(f.path);
      const entry = MAPS.find(([dir]) => p.startsWith(dir));
      if (!entry || !AUDIO.test(p)) continue;
      const [dir, file] = entry;
      // the CDN maps list paths below their own directory; Oak's maps list them from the pack root
      const listed = dir === "piano/" || dir === "uzu-drumkit/" ? p.slice(dir.length) : p;
      if (!JSON.stringify(map(file)).includes(JSON.stringify(listed))) missing.push(`${file}: ${listed}`);
    }
    expect(missing).toEqual([]);
  });
});
