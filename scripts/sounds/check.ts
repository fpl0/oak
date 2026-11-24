// Verifies sounds/pack/ against sounds/pack.lock.json (offline; no network).
//
//   bun scripts/sounds/check.ts
//
// Fails (exit 1) when: a locked file is missing, its size or sha256 differs, an unlocked file exists in the
// pack version directory, a sample map still points at a remote host / a `_base` does not end in "/", a
// sample map references a file that is not in the pack, the manifest references an unmirrored font, an alias's
// gain/release/range is out of bounds, or an Oak kit's gains do not match its map. Since v4 also when: the
// pack is over BUDGET_BYTES; a sound file has no credit, or its credit's licence is not on the allow-list
// (CC-BY credits must carry their attribution; the legacy GM exception covers GM presets only); credits.json
// does not match the lock's credits; a sample alias, kit, kit alias, layer table, break or wavetable points
// at something the pack does not have; a retired source (tidal-drum-machines) is back.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { BREAKS } from "./breaks.ts";
import { LICENSE_FILES } from "./credits.ts";
import {
  BUDGET_BYTES,
  KIT_ALIASES,
  LEGACY_GM,
  LICENCE_ALLOW_LIST,
  OAK_ALIASES,
  OAK_KITS,
  PACK_VERSION,
  type PackLock,
  type PackManifest,
  PUBLIC_ROOT,
} from "./pack.config.ts";

const SOUNDS_DIR = join(import.meta.dirname, "../../sounds");
const PACK_DIR = join(SOUNDS_DIR, "pack");
const LOCK_PATH = join(SOUNDS_DIR, "pack.lock.json");

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

async function walk(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(join(dir, e.name), rel)));
    else out.push(rel);
  }
  return out;
}

if (!existsSync(LOCK_PATH)) {
  console.error("[check] sounds/pack.lock.json is missing: run `bun scripts/sounds/mirror.ts --update`");
  process.exit(1);
}
const lock = JSON.parse(await readFile(LOCK_PATH, "utf8")) as PackLock;
if (lock.packVersion !== PACK_VERSION)
  fail(`lock is ${lock.packVersion}, pack.config.ts says ${PACK_VERSION}`);
if (!existsSync(join(PACK_DIR, lock.packVersion))) {
  console.error(`[check] sounds/pack/${lock.packVersion}/ is missing: run \`bun scripts/sounds/mirror.ts\``);
  process.exit(1);
}

// 1. every locked file exists with the locked size and hash
let bytes = 0;
const lockedPaths = new Set<string>();
for (const f of lock.files) {
  lockedPaths.add(f.path);
  const abs = join(PACK_DIR, f.path);
  if (!existsSync(abs)) {
    fail(`missing: ${f.path}`);
    continue;
  }
  const body = await readFile(abs);
  bytes += body.byteLength;
  if (body.byteLength !== f.bytes) fail(`size: ${f.path} is ${body.byteLength} B, lock says ${f.bytes} B`);
  const hash = createHash("sha256").update(body).digest("hex");
  if (hash !== f.sha256) fail(`sha256: ${f.path}\n    lock ${f.sha256}\n    disk ${hash}`);
  if (!f.derived && !/^https:\/\//.test(f.sourceUrl)) fail(`sourceUrl: ${f.path} has no https source`);
}
if (lock.fileCount !== lock.files.length)
  fail(`fileCount ${lock.fileCount} != files.length ${lock.files.length}`);
const lockTotal = lock.files.reduce((a, f) => a + f.bytes, 0);
if (lock.totalBytes !== lockTotal) fail(`totalBytes ${lock.totalBytes} != sum of files ${lockTotal}`);

// 2. nothing unlocked on disk
for (const rel of await walk(join(PACK_DIR, lock.packVersion))) {
  const path = `${lock.packVersion}/${rel}`;
  if (!lockedPaths.has(path)) fail(`unlocked file on disk: ${path}`);
}

// 3. sample maps are fully local and resolvable
const readJson = async <T>(rel: string) =>
  JSON.parse(await readFile(join(PACK_DIR, lock.packVersion, rel), "utf8")) as T;
const toPackPath = (url: string) => `${lock.packVersion}${url.slice(PUBLIC_ROOT.length)}`;
let manifest: PackManifest | undefined;
try {
  manifest = await readJson<PackManifest>("manifest.json");
} catch (err) {
  fail(`manifest.json unreadable: ${String(err)}`);
}
let sampleRefs = 0;
if (manifest) {
  for (const map of manifest.sampleMaps) {
    const rel = map.json.slice(PUBLIC_ROOT.length + 1);
    const json = await readJson<Record<string, unknown>>(rel);
    const base = json._base;
    if (typeof base !== "string" || !base.startsWith(`${PUBLIC_ROOT}/`) || !base.endsWith("/"))
      fail(
        `${rel}: _base must be a local path under ${PUBLIC_ROOT}/ ending in "/", got ${JSON.stringify(base)}`,
      );
    if (base !== map.base) fail(`${rel}: _base ${String(base)} differs from manifest base ${map.base}`);
    const text = JSON.stringify(json);
    if (/https?:\/\/|github:|bubo:|shabda/.test(text)) fail(`${rel}: still contains a remote reference`);
    for (const [key, value] of Object.entries(json)) {
      if (key.startsWith("_")) continue;
      const refs = (
        Array.isArray(value) ? value : Object.values(value as Record<string, string | string[]>)
      ).flat();
      for (const ref of refs as string[]) {
        sampleRefs++;
        if (!lockedPaths.has(toPackPath(`${base}${ref}`)))
          fail(`${rel}: ${key} -> ${ref} is not in the pack`);
      }
    }
  }
  for (const [name, fonts] of Object.entries(manifest.soundfonts)) {
    for (const { font } of fonts) {
      if (!font.endsWith("_file")) fail(`manifest: ${name} lists broken font ${font}`);
      if (!lockedPaths.has(toPackPath(`${manifest.soundfontUrl}/${font}.js`)))
        fail(`manifest: ${name} font ${font} not in pack`);
    }
  }
  for (const [alias, a] of Object.entries(manifest.aliases)) {
    if (!manifest.soundfonts[a.gm]?.some((f) => f.font === a.font))
      fail(`manifest: alias ${alias} -> ${a.font} not mirrored`);
    if (a.gain !== undefined && !(a.gain > 0 && a.gain <= 4)) fail(`manifest: alias ${alias} gain ${a.gain}`);
    if (a.release !== undefined && !(a.release >= 0.01 && a.release <= 2))
      fail(`manifest: alias ${alias} release ${a.release}`);
    if (a.range && !(a.range[0] >= 0 && a.range[0] < a.range[1] && a.range[1] <= 127))
      fail(`manifest: alias ${alias} range ${JSON.stringify(a.range)}`);
  }
  // Oak kits: every gain key is a key of an oak-kit map, every gain list matches its role's file count.
  const kitKeys = new Map<string, number>();
  for (const map of manifest.sampleMaps.filter((m) => m.tag === "oak-kit")) {
    const json = await readJson<Record<string, unknown>>(map.json.slice(PUBLIC_ROOT.length + 1));
    for (const [key, value] of Object.entries(json))
      if (!key.startsWith("_")) kitKeys.set(key, Array.isArray(value) ? value.length : 1);
  }
  for (const [key, gain] of Object.entries(manifest.kitGains ?? {})) {
    const files = kitKeys.get(key);
    if (files === undefined) fail(`manifest: kit gain ${key} has no sample map entry`);
    const gains = Array.isArray(gain) ? gain : [gain];
    if (Array.isArray(gain) && gain.length !== files)
      fail(`manifest: kit gain ${key} lists ${gain.length} gains for ${files} files`);
    if (gains.some((g) => !(g > 0 && g <= 4))) fail(`manifest: kit gain ${key} out of range`);
  }
  for (const key of kitKeys.keys())
    if (manifest.kitGains?.[key] === undefined) fail(`manifest: kit sound ${key} has no gain`);
}

// 4. budget (a failure since v4)
if (lock.totalBytes > BUDGET_BYTES)
  fail(
    `budget: the pack is ${lock.totalBytes} B, over the ${BUDGET_BYTES} B limit (pack.config.ts BUDGET_BYTES)`,
  );

// 5. licences: every sound file is credited, every credit is on the allow-list, credits.json agrees
const credits = lock.credits ?? {};
const SOUND_FILE = /\.(wav|mp3|flac|ogg|js)$/;
for (const [id, c] of Object.entries(credits)) {
  if (!LICENCE_ALLOW_LIST.includes(c.licence)) fail(`licence: ${id} is ${c.licence}, not on the allow-list`);
  if (c.licence.startsWith("CC-BY") && !c.attribution?.trim())
    fail(`licence: ${id} is ${c.licence} but has no attribution`);
  if (!c.licenceUrl || !c.url) fail(`licence: ${id} has no licence or source URL`);
  if (!c.modified) fail(`licence: ${id} does not say what Oak changed`);
}
for (const f of lock.files) {
  if (!SOUND_FILE.test(f.path)) continue;
  if (!f.credit) {
    fail(`licence: ${f.path} has no credit`);
    continue;
  }
  const c = credits[f.credit];
  if (!c) fail(`licence: ${f.path} names credit ${f.credit}, which the lock does not list`);
  else if (c.licence === LEGACY_GM && !f.path.includes("/webaudiofontdata/"))
    fail(`licence: ${f.path} uses the legacy GM exception, which covers GM presets only`);
  if (/tidal-drum-machines|eddyflux|dirt-samples|clean-breaks/i.test(`${f.path} ${f.sourceUrl}`))
    fail(`licence: ${f.path} comes from a retired or refused source`);
}
for (const file of Object.keys(LICENSE_FILES))
  if (!lockedPaths.has(`${lock.packVersion}/LICENSES/${file}`))
    fail(`licence: LICENSES/${file} is not in the pack`);
// MIT asks for its notice with every copy: the GM preset files are the webaudiofontdata conversion's
if (
  lock.files.some((f) => f.path.includes("/webaudiofontdata/")) &&
  !lockedPaths.has(`${lock.packVersion}/LICENSES/webaudiofontdata-MIT.txt`)
)
  fail("licence: the pack ships webaudiofontdata presets without LICENSES/webaudiofontdata-MIT.txt");
try {
  const shipped = await readJson<{ credits: { id: string; entry: { licence: string } }[] }>("credits.json");
  const ids = shipped.credits.map((c) => c.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(Object.keys(credits).sort()))
    fail(`credits.json lists ${ids.join(", ")}; the lock lists ${Object.keys(credits).sort().join(", ")}`);
  for (const c of shipped.credits)
    if (credits[c.id]?.licence !== c.entry.licence)
      fail(`credits.json: ${c.id} licence differs from the lock`);
} catch (err) {
  fail(`credits.json unreadable: ${String(err)}`);
}

// 6. v4 runtime tables: sample aliases, kits, kit aliases, layers, breaks, wavetables
if (manifest) {
  const maps = new Map<string, unknown>();
  for (const map of manifest.sampleMaps) {
    const j = await readJson<Record<string, unknown>>(map.json.slice(PUBLIC_ROOT.length + 1));
    for (const [k, v] of Object.entries(j)) if (!k.startsWith("_")) maps.set(k, v);
  }
  for (const [alias, a] of Object.entries(manifest.sampleAliases ?? {})) {
    const spec = OAK_ALIASES[alias];
    if (spec?.kind !== "sample")
      fail(`manifest: sample alias ${alias} is not a sample alias in pack.config.ts`);
    const map = maps.get(a.sample) as Record<string, string[]> | undefined;
    if (!map || Array.isArray(map))
      fail(`manifest: sample alias ${alias} -> ${a.sample} is not a pitched map`);
    else
      for (const [note, files] of Object.entries(map))
        if (!Array.isArray(files) || files.length !== a.layers)
          fail(
            `manifest: ${a.sample} ${note} has ${Array.isArray(files) ? files.length : 0} files for ${a.layers} layers`,
          );
    if ((a.split?.length ?? 0) !== a.layers - 1)
      fail(`manifest: sample alias ${alias} split does not match its layers`);
    if (a.gain !== undefined && !(a.gain > 0 && a.gain <= 4))
      fail(`manifest: sample alias ${alias} gain ${a.gain}`);
    if (!(a.release >= 0.01 && a.release <= 2)) fail(`manifest: sample alias ${alias} release ${a.release}`);
    if (!(a.range[0] >= 0 && a.range[0] < a.range[1] && a.range[1] <= 127))
      fail(`manifest: sample alias ${alias} range ${JSON.stringify(a.range)}`);
  }
  for (const alias of Object.keys(OAK_ALIASES))
    if (!manifest.aliases[alias] && !manifest.sampleAliases?.[alias])
      fail(`manifest: alias ${alias} is missing`);
  for (const kit of Object.keys(OAK_KITS)) {
    if (!manifest.kits?.includes(kit)) fail(`manifest: kit ${kit} is not listed`);
    for (const role of ["bd", "sd", "hh"])
      if (!maps.has(`${kit}_${role}`)) fail(`manifest: kit ${kit} has no ${role}`);
  }
  for (const [old, kit] of Object.entries(manifest.kitAliases ?? {}))
    if (KIT_ALIASES[old] !== kit || !(kit in OAK_KITS))
      fail(`manifest: kit alias ${old} -> ${kit} is not a kit`);
  for (const [key, l] of Object.entries(manifest.kitLayers ?? {})) {
    const files = maps.get(key);
    if (!Array.isArray(files) || files.length % l.layers !== 0)
      fail(
        `manifest: ${key} lists ${Array.isArray(files) ? files.length : 0} files for ${l.layers} layers per variant`,
      );
    if (l.split.length !== l.layers - 1) fail(`manifest: ${key} split does not match its layers`);
  }
  try {
    const breaks =
      await readJson<Record<string, { bpm: number; frames: number; hits: unknown[] }>>("breaks.json");
    for (const name of Object.keys(BREAKS)) {
      const b = breaks[name];
      if (!b || !(b.bpm > 0 && b.frames > 0 && b.hits.length > 0))
        fail(`breaks.json: ${name} has no slice table`);
      if (!maps.has(name)) fail(`breaks: ${name} is not in a sample map`);
    }
  } catch (err) {
    fail(`breaks.json unreadable: ${String(err)}`);
  }
  for (const key of maps.keys())
    if (key.startsWith("wt_") && !Array.isArray(maps.get(key))) fail(`wavetable ${key} is not a file list`);
}

if (errors.length) {
  console.error(`[check] FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `[check] ok: ${lock.files.length} files, ${bytes} bytes (${(bytes / 1024 / 1024).toFixed(2)} MiB), ` +
    `${sampleRefs} sample refs resolved, ${Object.keys(manifest?.soundfonts ?? {}).length} gm instruments, ` +
    `${Object.keys(credits).length} credits, budget ${(BUDGET_BYTES / 1024 / 1024).toFixed(0)} MiB, pack ${lock.packVersion}`,
);
