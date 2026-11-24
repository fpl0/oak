// Builds the curated Oak sound pack into sounds/pack/<packVersion>/ and writes sounds/pack.lock.json.
//
//   bun scripts/sounds/mirror.ts            # lock present: reproduce it exactly (frozen); else resolve
//   bun scripts/sounds/mirror.ts --update   # re-resolve from the sources + pack.config.ts, rewrite the lock
//   bun scripts/sounds/mirror.ts --rebuild  # (with or without --update) recompute every derived file even
//                                           # when the lock's recipe matches (a determinism check when frozen)
//   add --offline to any of them: nothing is fetched; upstream files come from the source cache
//   (sounds/pack/.sources/) or the previous version's directory, and a file that would need a download is an
//   error.
//
// Two kinds of file:
// - copied: byte-for-byte from the hosts the strudel.cc REPL prebake uses (the Salamander piano, the
//   uzu-drumkit, the General MIDI presets), from pinned GitHub commits (AKWF single cycles) and from the
//   licence publishers (LICENSES/). The lock pins each sha256.
// - derived: computed here from pinned upstream files (library.ts) or from nothing at all (Oak's drum
//   machines, breaks, tables, tape). Each records a `recipe` (the hash of its inputs, its settings and the
//   build code), so a frozen run reuses a file whose recipe and bytes match, and `--rebuild` checks that the
//   build still produces the locked bytes. The lock is the source of truth for these files (docs/spikes.md).
//
// Every JSON `_base` is rewritten to `/sounds/<packVersion>/<dir>/` so nothing in the pack points at a
// third-party host.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import gm from "@strudel/soundfonts/gm.mjs";
import {
  decodeAudio,
  fromDb,
  measureCents,
  midiToHz,
  mix,
  mono,
  mp3,
  onset,
  type Pcm,
  peak,
  RATE,
  retune,
  rms,
  scale,
  stereo,
  toolVersion,
  toRate,
  trim,
  wav16,
} from "./audio.ts";
import { BREAKS, type BreakMeta, type KitHits, renderBreak } from "./breaks.ts";
import { BRK_DIR, BRK_FILE, BRK_JSON, BRK_LICENCE, renderBreakWav } from "./brk.ts";
import { buildCredits, creditsMarkdown, LICENSE_FILES } from "./credits.ts";
import { renderSynthKit, SYNTH_KITS } from "./drummachine.ts";
import { biquad, lofi, tapeBed } from "./dsp.ts";
import { encodeFlac } from "./flac.ts";
import {
  AKWF_TABLES,
  type DrumRole,
  type Mixdown,
  ONE_SHOTS,
  PITCHED,
  type PitchedSpec,
  RECORDED_KITS,
  type RecordedKitSpec,
  ROLE_LEVEL_DB,
  SOURCES,
  type SrcRef,
} from "./library.ts";
import {
  BUDGET_BYTES,
  type CreditEntry,
  DRUM_ROLES,
  GM_VARIANTS,
  isSampleAlias,
  KIT_ALIASES,
  kitJson,
  type LockFile,
  type LockSource,
  OAK_ALIASES,
  OAK_KITS,
  type OakKit,
  PACK_VERSION,
  type PackLock,
  type PackManifest,
  PUBLIC_ROOT,
  SAMPLE_CDN,
  SAMPLE_MAPS,
  SOFT_BELOW,
  SOUNDFONT_CDN,
  srcKey,
} from "./pack.config.ts";
import { insideRoot, isSafeSamplePath } from "./paths.ts";
import { OAK_TABLES, renderTable } from "./wavetables.ts";

const SOUNDS_DIR = join(import.meta.dirname, "../../sounds");
const PACK_DIR = join(SOUNDS_DIR, "pack");
const CACHE_DIR = join(PACK_DIR, ".sources");
const LOCK_PATH = join(SOUNDS_DIR, "pack.lock.json");
const CONCURRENCY = 6;
const RETRIES = 4;

const args = new Set(process.argv.slice(2));
const update = args.has("--update");
const offline = args.has("--offline");
const rebuild = args.has("--rebuild");

const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const json = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;

/** encodeURI but also escape "#" (superdough's loadBuffer does the same before fetching). */
const encodePath = (p: string) => encodeURI(p).replace(/#/g, "%23");

async function fetchRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 408 && res.status !== 429) {
        throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      }
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if ((err as { fatal?: boolean }).fatal) throw err;
      lastError = err;
    }
  }
  throw new Error(`giving up on ${url} after ${RETRIES + 1} attempts: ${String(lastError)}`);
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return out;
}

/** Cheap content sniffing so an HTML error page can never land in the pack. */
function validate(path: string, body: Uint8Array) {
  if (body.byteLength === 0) throw new Error(`${path}: empty body`);
  const head = new TextDecoder("latin1").decode(body.subarray(0, 64));
  if (/^\s*<(!doctype|html)/i.test(head)) throw new Error(`${path}: got an HTML page, not the file`);
  if (/\.wav$/i.test(path) && !head.startsWith("RIFF")) throw new Error(`${path}: not a RIFF/WAVE file`);
  if (/\.flac$/i.test(path) && !head.startsWith("fLaC")) throw new Error(`${path}: not a FLAC file`);
  if (
    /\.mp3$/i.test(path) &&
    !(head.startsWith("ID3") || (body[0] === 0xff && ((body[1] ?? 0) & 0xe0) === 0xe0))
  )
    throw new Error(`${path}: not an MP3 file`);
  if (/_file\.js$/.test(path)) {
    const text = new TextDecoder().decode(body);
    if (!text.includes("={") || !text.includes("zones"))
      throw new Error(`${path}: not a WebAudioFont preset`);
  }
}

// --- upstream files (cached) -----------------------------------------------------------------------------

const lockSources = new Map<string, LockSource>();
let previousLock: PackLock | undefined;

/** The URL of an upstream file (an archive member is `<archive url>#<member>`). */
function sourceUrl(r: SrcRef): string {
  const s = SOURCES[r.src];
  if (!isSafeSamplePath(r.path)) throw new Error(`library: unsafe path ${r.path}`);
  return s.kind === "github"
    ? `https://raw.githubusercontent.com/${s.repo}/${s.commit}/${encodePath(r.path)}`
    : `${s.url}#${r.path}`;
}

const inflight = new Map<string, Promise<Uint8Array>>();

async function cached(url: string, fetcher: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const file = join(CACHE_DIR, sha256(url));
  if (existsSync(file)) return new Uint8Array(await readFile(file));
  if (offline) throw new Error(`--offline: ${url} is not in the source cache`);
  const body = await fetcher();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(`${file}.part`, body);
  await rename(`${file}.part`, file);
  return body;
}

/** An upstream file's bytes, from the cache or the network; its sha256 is checked against the lock. */
function getSource(r: SrcRef): Promise<Uint8Array> {
  const url = sourceUrl(r);
  let p = inflight.get(url);
  if (!p) {
    p = (async () => {
      const s = SOURCES[r.src];
      let body: Uint8Array;
      if (s.kind === "github") {
        body = await cached(url, async () => new Uint8Array(await (await fetchRetry(url)).arrayBuffer()));
      } else {
        const archive = await cached(s.url, async () => {
          const b = new Uint8Array(await (await fetchRetry(s.url)).arrayBuffer());
          if (sha256(b) !== s.sha256)
            throw new Error(`archive ${s.url}: sha256 ${sha256(b)} != pinned ${s.sha256}`);
          return b;
        });
        if (sha256(archive) !== s.sha256)
          throw new Error(`archive ${s.url}: cached copy does not match its pin`);
        body = await cached(url, async () => {
          const p = Bun.spawnSync({
            cmd: ["tar", "-xOf", join(CACHE_DIR, sha256(s.url)), r.path],
            stdout: "pipe",
            stderr: "pipe",
          });
          if (p.exitCode !== 0) throw new Error(`tar: ${r.path}: ${new TextDecoder().decode(p.stderr)}`);
          return new Uint8Array(p.stdout);
        });
      }
      validate(r.path, body);
      const hash = sha256(body);
      const want = previousLock?.sources?.find((x) => x.url === url);
      if (want && want.sha256 !== hash && !update)
        throw new Error(`frozen: upstream ${url} changed\n  lock ${want.sha256}\n  got  ${hash}`);
      lockSources.set(url, { url, bytes: body.byteLength, sha256: hash });
      return body;
    })();
    inflight.set(url, p);
  }
  return p;
}

const decoded = new Map<string, Promise<Pcm>>();
/** An upstream file decoded, at 44.1 kHz. */
function getPcm(r: SrcRef, keepRate = false): Promise<Pcm> {
  const key = `${sourceUrl(r)}|${keepRate}`;
  let p = decoded.get(key);
  if (!p) {
    p = getSource(r).then((b) => {
      const pcm = decodeAudio(b, r.path);
      return keepRate ? pcm : toRate(pcm, RATE);
    });
    decoded.set(key, p);
  }
  return p;
}

/** A mixdown of several microphones (mono). */
async function mixdown(m: Mixdown): Promise<Pcm> {
  const parts = await Promise.all(
    m.mics.map(async ({ ref, gain }) => ({ pcm: mono(await getPcm(ref)), gain })),
  );
  return mix(parts);
}

// --- the plan --------------------------------------------------------------------------------------------

interface Planned {
  /** path below sounds/pack/ */
  path: string;
  sourceUrl: string;
  group: string;
  credit?: string;
  /** derived: the bytes (or how to compute them) */
  content?: string | Uint8Array;
  recipe?: string;
  render?: () => Promise<Uint8Array>;
}

type SampleMap = Record<string, string | string[] | Record<string, string | string[]>>;

/** Hash of the build code a derived file depends on. */
async function codeHash(files: string[]): Promise<string> {
  const h = createHash("sha256");
  for (const f of files) h.update(await readFile(join(import.meta.dirname, f)));
  return h.digest("hex").slice(0, 16);
}

const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (m: number) => `${NOTE[m % 12]}${Math.floor(m / 12) - 1}`;

/** The pack on disk the lock describes (offline source of the copied maps). */
async function lockedFile(lock: PackLock | undefined, rel: string): Promise<Uint8Array | null> {
  for (const v of [lock?.packVersion, PACK_VERSION, "v3"]) {
    if (!v) continue;
    const abs = insideRoot(PACK_DIR, `${v}/${rel}`);
    if (existsSync(abs)) return new Uint8Array(await readFile(abs));
  }
  return null;
}

const report: Record<string, unknown> = {};

async function resolvePlan(lock: PackLock | undefined) {
  const plan: Planned[] = [];
  const v = PACK_VERSION;
  const R = PUBLIC_ROOT;
  const manifest: PackManifest = {
    packVersion: v,
    publicRoot: R,
    sampleMaps: [],
    kitAliases: { ...KIT_ALIASES },
    kits: Object.keys(OAK_KITS),
    soundfontUrl: `${R}/webaudiofontdata/sound`,
    soundfonts: {},
    aliases: {},
    sampleAliases: {},
    kitGains: {},
    kitLayers: {},
    credits: `${R}/credits.json`,
    breaks: `${R}/breaks.json`,
  };
  const sounds = new Map<string, Set<string>>(); // credit id -> Oak sounds
  const credit = (id: string, sound: string) => {
    const s = sounds.get(id) ?? new Set<string>();
    s.add(sound);
    sounds.set(id, s);
  };
  const addMap = (file: string, dir: string, map: SampleMap, group: string, tag: string) => {
    plan.push({
      path: `${v}/${file}`,
      sourceUrl: "generated:scripts/sounds/mirror.ts",
      group,
      content: json({ _base: `${R}/${dir}`, ...map }),
    });
    manifest.sampleMaps.push({ json: `${R}/${file}`, base: `${R}/${dir}`, tag });
  };

  const CODE = {
    pitched: await codeHash(["audio.ts", "library.ts"]),
    kit: await codeHash(["audio.ts", "dsp.ts", "flac.ts", "library.ts", "drummachine.ts"]),
    brk: await codeHash(["audio.ts", "dsp.ts", "flac.ts", "breaks.ts"]),
    table: await codeHash(["audio.ts", "wavetables.ts"]),
  };
  const inputs = async (refs: SrcRef[]) => (await Promise.all(refs.map(getSource))).map(sha256);

  // 1. Maps copied from the Strudel CDN (piano, uzu-drumkit), unchanged since v1.
  const upstreamCache = new Map<string, Promise<SampleMap>>();
  const upstreamMap = (file: string): Promise<SampleMap> => {
    let p = upstreamCache.get(file);
    if (!p) {
      p = offline
        ? lockedFile(lock, file).then((b) => {
            if (!b) throw new Error(`--offline: ${file} is not in a locked pack`);
            const m = JSON.parse(new TextDecoder().decode(b)) as SampleMap;
            delete m._base;
            return m;
          })
        : fetchRetry(`${SAMPLE_CDN}/${file}`).then((r) => r.json() as Promise<SampleMap>);
      upstreamCache.set(file, p);
    }
    return p;
  };
  for (const spec of SAMPLE_MAPS) {
    const upstream = await upstreamMap(spec.json);
    const base = `${R}/${spec.dir}`;
    const out: SampleMap = { _base: base };
    const group = spec.json.replace(/\.json$/, "");
    const add = (file: string) => {
      if (!isSafeSamplePath(file))
        throw new Error(`upstream ${spec.json} lists an unsafe path: ${JSON.stringify(file)}`);
      plan.push({
        path: `${v}/${spec.dir}${file}`,
        sourceUrl: `${SAMPLE_CDN}/${spec.dir}${encodePath(file)}`,
        group,
        credit: group,
      });
      return file;
    };
    for (const [key, value] of Object.entries(upstream)) {
      if (key.startsWith("_")) continue;
      const n = spec.keep(key);
      if (n <= 0) continue;
      credit(group, key);
      if (typeof value === "string") out[key] = [add(value)];
      else if (Array.isArray(value)) out[key] = value.slice(0, n).map(add);
      else
        out[key] = Object.fromEntries(
          Object.entries(value).map(([note, files]) => [
            note,
            typeof files === "string" ? add(files) : files.slice(0, n).map(add),
          ]),
        );
    }
    plan.push({
      path: `${v}/${spec.json}`,
      sourceUrl: `${SAMPLE_CDN}/${spec.json}`,
      group,
      content: json(out),
    });
    manifest.sampleMaps.push({ json: `${R}/${spec.json}`, base });
  }

  // 2. Pitched instruments behind the sample aliases.
  const srcMap: SampleMap = {};
  const tuning: Record<string, Record<string, string>> = {};
  for (const [alias, spec] of Object.entries(PITCHED) as [string, PitchedSpec][]) {
    const a = OAK_ALIASES[alias];
    if (!a || !isSampleAlias(a)) throw new Error(`pack.config: ${alias} must be a sample alias`);
    const layers = Math.max(...spec.notes.map((n) => n.layers.length));
    const byNote: Record<string, string[]> = {};
    tuning[alias] = {};
    const srcIds = new Set(spec.notes.flatMap((n) => n.layers.map((l) => l.src)));
    for (const id of srcIds) credit(id, alias);
    for (const note of spec.notes) {
      const files: string[] = [];
      for (let li = 0; li < layers; li++) {
        const ref = note.layers[Math.min(li, note.layers.length - 1)] as SrcRef;
        const file = `src/${alias}/${alias}_${note.midi}_${li}.mp3`;
        files.push(file);
        if (plan.some((p) => p.path === `${v}/${file}`)) continue;
        const recipe = sha256(
          JSON.stringify({
            code: CODE.pitched,
            ref,
            spec: { ...spec, notes: undefined },
            midi: note.midi,
            input: await inputs([ref]),
          }),
        );
        plan.push({
          path: `${v}/${file}`,
          sourceUrl: `generated:scripts/sounds/mirror.ts#pitched(${sourceUrl(ref)})`,
          group: `inst-${alias}`,
          credit: ref.src,
          recipe,
          render: async () => {
            const { bytes, cents } = await renderNote(spec, ref, note.midi);
            (tuning[alias] as Record<string, string>)[`${note.midi}.${li}`] = cents;
            return bytes;
          },
        });
      }
      byNote[noteName(note.midi)] = files;
    }
    srcMap[srcKey(alias)] = byNote;
    manifest.sampleAliases = {
      ...manifest.sampleAliases,
      [alias]: {
        sample: srcKey(alias),
        layers,
        ...(layers > 1 ? { split: a.split ?? [SOFT_BELOW] } : {}),
        ...(a.gain !== undefined ? { gain: a.gain } : {}),
        release: a.release,
        range: a.range,
      },
    };
  }
  addMap("oak-src.json", "", srcMap, "maps", "oak-src");
  report.tuning = tuning;

  // 3. Kits: recorded (mixdowns of upstream microphones) and synthesised.
  const kitPcm = new Map<string, KitHits>(); // filled lazily for the breaks
  const kitFiles = new Map<string, Partial<Record<DrumRole, string[][]>>>();
  for (const kit of Object.keys(OAK_KITS) as OakKit[]) {
    const out: SampleMap = {};
    const files: Partial<Record<DrumRole, string[][]>> = {};
    if (OAK_KITS[kit].kind === "recorded") {
      const spec = RECORDED_KITS[kit as keyof typeof RECORDED_KITS] as RecordedKitSpec;
      for (const [role, def] of Object.entries(spec.roles) as [
        DrumRole,
        NonNullable<RecordedKitSpec["roles"][DrumRole]>,
      ][]) {
        const layers = Math.max(...def.variants.map((x) => x.length));
        const list: string[] = [];
        const grid: string[][] = [];
        for (const [vi, variant] of def.variants.entries()) {
          const row: string[] = [];
          for (let li = 0; li < layers; li++) {
            const hit = variant[Math.min(li, variant.length - 1)] as Mixdown;
            const file = `kits/${kit}/${role}_${vi}_${Math.min(li, variant.length - 1)}.flac`;
            row.push(file);
            list.push(file);
            if (plan.some((p) => p.path === `${v}/${file}`)) continue;
            const refs = hit.mics.map((m) => m.ref);
            for (const r of refs) credit(r.src, kit);
            const level = Array.isArray(def.levelDb)
              ? (def.levelDb[vi] ?? ROLE_LEVEL_DB[role])
              : (def.levelDb ?? ROLE_LEVEL_DB[role]);
            const recipe = sha256(
              JSON.stringify({
                code: CODE.kit,
                hit,
                role,
                maxSec: def.maxSec,
                lofi: !!spec.lofi,
                level,
                input: await inputs(refs),
              }),
            );
            plan.push({
              path: `${v}/${file}`,
              sourceUrl: `generated:scripts/sounds/mirror.ts#kit(${refs.map(sourceUrl).join(" + ")})`,
              group: `kit-${kit}`,
              credit: refs[0]?.src as string,
              recipe,
              render: async () => encodeFlac(await renderHit(hit, role, def.maxSec, !!spec.lofi, level)),
            });
          }
          grid.push(row);
        }
        files[role] = grid;
        out[`${kit}_${role}`] = list;
        manifest.kitGains = { ...manifest.kitGains, [`${kit}_${role}`]: 1 };
        if (layers > 1)
          manifest.kitLayers = { ...manifest.kitLayers, [`${kit}_${role}`]: { layers, split: [SOFT_BELOW] } };
      }
    } else {
      credit(`oak-${kit}`, kit);
      const voices = renderSynthKitLazy(kit as "oak909" | "oak808");
      for (const role of DRUM_ROLES) {
        const count = voices.count[role];
        if (!count) continue;
        const list: string[] = [];
        for (let vi = 0; vi < count; vi++) {
          const file = `kits/${kit}/${role}_${vi}_0.flac`;
          list.push(file);
          plan.push({
            path: `${v}/${file}`,
            sourceUrl: `generated:scripts/sounds/drummachine.ts#${kit} (CC0 1.0, synthesised by Oak)`,
            group: `kit-${kit}`,
            credit: `oak-${kit}`,
            recipe: sha256(JSON.stringify({ code: CODE.kit, kit, role, vi })),
            render: async () =>
              encodeFlac(levelled((voices.get()[role] as Pcm[])[vi] as Pcm, ROLE_LEVEL_DB[role])),
          });
        }
        files[role] = list.map((f) => [f]);
        out[`${kit}_${role}`] = list;
        manifest.kitGains = { ...manifest.kitGains, [`${kit}_${role}`]: 1 };
      }
    }
    kitFiles.set(kit, files);
    addMap(kitJson(kit), "", out, `kit-${kit}`, "oak-kit");
  }
  /** A kit's one-shots as PCM (decoded from the pack files, so a reused file and a fresh one agree). */
  const kitHits = async (kit: string): Promise<KitHits> => {
    const have = kitPcm.get(kit);
    if (have) return have;
    const files = kitFiles.get(kit) ?? {};
    const out: KitHits = {};
    for (const [role, grid] of Object.entries(files) as [DrumRole, string[][]][])
      out[role] = await Promise.all(
        grid.map((row) => Promise.all(row.map(async (f) => decodeAudio(await derivedBytes(`${v}/${f}`), f)))),
      );
    kitPcm.set(kit, out);
    return out;
  };

  // 4. One-shots: hand percussion, textures, foley; and Oak's tape bed.
  const perc: SampleMap = {};
  for (const [name, spec] of Object.entries(ONE_SHOTS)) {
    const list: string[] = [];
    for (const [i, hit] of spec.hits.entries()) {
      const file = `perc/${name}_${i}.flac`;
      list.push(file);
      const refs = hit.mics.map((m) => m.ref);
      for (const r of refs) credit(r.src, name);
      plan.push({
        path: `${v}/${file}`,
        sourceUrl: `generated:scripts/sounds/mirror.ts#oneshot(${refs.map(sourceUrl).join(" + ")})`,
        group: name === "conga" || name === "bongo" || name === "clave" ? "perc" : "textures",
        credit: refs[0]?.src as string,
        recipe: sha256(
          JSON.stringify({
            code: CODE.kit,
            hit,
            spec: { ...spec, hits: undefined },
            input: await inputs(refs),
          }),
        ),
        render: async () => encodeFlac(await renderOneShot(hit, spec)),
      });
    }
    perc[name] = list;
  }
  credit("oak-tape", "tape");
  plan.push({
    path: `${v}/perc/tape_0.flac`,
    sourceUrl: "generated:scripts/sounds/dsp.ts#tapeBed (CC0 1.0, synthesised by Oak)",
    group: "textures",
    credit: "oak-tape",
    recipe: sha256(JSON.stringify({ code: CODE.kit, tape: 8 })),
    render: async () => encodeFlac(levelled(tapeBed(8), -32, 1000)),
  });
  perc.tape = ["perc/tape_0.flac"];
  addMap("oak-perc.json", "", perc, "maps", "oak-perc");

  // 5. Breaks: the old `brk` (byte-identical, brk.ts) and the six rendered styles.
  const uzu = SAMPLE_MAPS.find((m) => m.json === "uzu-drumkit.json");
  if (!uzu) throw new Error("pack.config: the break needs the uzu-drumkit map");
  credit("oak-breaks", "brk");
  plan.push({
    path: `${v}/${BRK_DIR}${BRK_FILE}`,
    sourceUrl: `generated:scripts/sounds/brk.ts (${BRK_LICENCE})`,
    group: "oak-rendered",
    credit: "oak-breaks",
    content: await renderBreakWav(async (file) => {
      const local = await lockedFile(lock, `${uzu.dir}${file}`);
      if (local) return local;
      if (offline) throw new Error(`--offline: ${uzu.dir}${file} is not in a locked pack`);
      return new Uint8Array(
        await (await fetchRetry(`${SAMPLE_CDN}/${uzu.dir}${encodePath(file)}`)).arrayBuffer(),
      );
    }),
  });
  plan.push({
    path: `${v}/${BRK_JSON}`,
    sourceUrl: "generated:scripts/sounds/brk.ts",
    group: "oak-rendered",
    content: json({ _base: `${R}/${BRK_DIR}`, brk: [BRK_FILE] }),
  });
  manifest.sampleMaps.push({ json: `${R}/${BRK_JSON}`, base: `${R}/${BRK_DIR}`, tag: "oak-rendered" });

  const breakMeta: Record<string, BreakMeta> = {};
  const breakMap: SampleMap = {};
  for (const [name, spec] of Object.entries(BREAKS)) {
    const file = `breaks/${name}.flac`;
    breakMap[name] = [file];
    credit("oak-breaks", name);
    const kitsUsed = [...new Set(spec.tracks.map((t) => t.voice.kit))];
    const kitRecipe = plan
      .filter((p) => kitsUsed.some((k) => p.path.startsWith(`${v}/kits/${k}/`)))
      .map((p) => p.recipe);
    plan.push({
      path: `${v}/${file}`,
      sourceUrl: `generated:scripts/sounds/breaks.ts#${name} (CC0 1.0, rendered by Oak from ${kitsUsed.join(", ")})`,
      group: "breaks",
      credit: "oak-breaks",
      recipe: sha256(
        JSON.stringify({ code: CODE.brk, spec, kits: kitRecipe, vinyl: spec.vinylDb !== undefined }),
      ),
      render: async () => {
        const kits: Record<string, KitHits> = {};
        for (const k of kitsUsed) kits[k] = await kitHits(k);
        const vinyl =
          spec.vinylDb !== undefined ? decodeAudio(await derivedBytes(`${v}/perc/vinyl_0.flac`)) : undefined;
        const { pcm, meta } = renderBreak(spec, kits, vinyl);
        breakMeta[name] = meta;
        return encodeFlac(pcm);
      },
    });
  }
  addMap("oak-breaks.json", "", breakMap, "breaks", "oak-breaks");

  // 6. Wavetables: AKWF single cycles (copied) and Oak's morph tables.
  const wt: SampleMap = {};
  credit("akwf", "wavetables");
  for (const [name, list] of Object.entries(AKWF_TABLES)) {
    wt[name] = list.map((p) => {
      const ref: SrcRef = { src: "akwf", path: `AKWF/${p}.wav` };
      const file = `wavetables/akwf/${p.split("/")[1]}.wav`;
      plan.push({ path: `${v}/${file}`, sourceUrl: sourceUrl(ref), group: "wavetables", credit: "akwf" });
      return file;
    });
  }
  credit("oak-tables", "wavetables");
  for (const name of Object.keys(OAK_TABLES)) {
    const file = `wavetables/oak/${name}.wav`;
    wt[name] = [file];
    plan.push({
      path: `${v}/${file}`,
      sourceUrl: `generated:scripts/sounds/wavetables.ts#${name} (CC0 1.0, computed by Oak)`,
      group: "wavetables",
      credit: "oak-tables",
      recipe: sha256(JSON.stringify({ code: CODE.table, name })),
      render: async () => wav16(renderTable(name)),
    });
  }
  addMap("oak-wavetables.json", "", wt, "wavetables", "oak-wavetables");

  // 7. General MIDI presets (the aliases still on GM, and index 0 of every name the pack always had).
  const seen = new Set<string>();
  const gmMap = gm as Record<string, string[]>;
  for (const [name, indices] of Object.entries(GM_VARIANTS)) {
    const fonts = gmMap[name];
    if (!fonts) throw new Error(`pack.config: unknown gm instrument ${name}`);
    manifest.soundfonts[name] = indices.map((upstreamIndex) => {
      const font = fonts[upstreamIndex];
      if (!font) throw new Error(`pack.config: ${name} has no variant ${upstreamIndex}`);
      if (!font.endsWith("_file"))
        throw new Error(`pack.config: ${name}:${upstreamIndex} is the broken "${font}"`);
      if (!seen.has(font)) {
        seen.add(font);
        const id = /FluidR3/.test(font) ? "gm-fluidr3" : "gm-legacy";
        credit(id, name);
        plan.push({
          path: `${v}/webaudiofontdata/sound/${font}.js`,
          sourceUrl: `${SOUNDFONT_CDN}/${font}.js`,
          group: "soundfonts",
          credit: id,
        });
      }
      return { upstreamIndex, font };
    });
  }
  for (const [alias, spec] of Object.entries(OAK_ALIASES)) {
    if (isSampleAlias(spec)) continue;
    const entry = manifest.soundfonts[spec.gm]?.find((f) => f.upstreamIndex === spec.variant);
    if (!entry) throw new Error(`pack.config: alias ${alias} -> ${spec.gm}:${spec.variant} is not mirrored`);
    credit(/FluidR3/.test(entry.font) ? "gm-fluidr3" : "gm-legacy", alias);
    manifest.aliases[alias] = {
      gm: spec.gm,
      upstreamIndex: spec.variant,
      font: entry.font,
      ...(spec.gain !== undefined ? { gain: spec.gain } : {}),
      ...(spec.release !== undefined ? { release: spec.release } : {}),
      ...(spec.range !== undefined ? { range: spec.range } : {}),
    };
  }

  // 8. Licence texts (copied from their publishers).
  for (const [file, url] of Object.entries(LICENSE_FILES))
    plan.push({ path: `${v}/LICENSES/${file}`, sourceUrl: url, group: "credits" });

  // 9. Late JSON: breaks.json (after the breaks render), credits, manifest.
  const credits = () => buildCredits(sounds);
  return { plan, manifest, breakMeta, credits };
}

/** Peak-safe level to an RMS target over the first `ms` after the onset. */
function levelled(p: Pcm, targetDb: number, ms = 100): Pcm {
  const o = onset(p);
  const r = rms(p, o, Math.round((ms / 1000) * p.sampleRate));
  let g = r > 0 ? fromDb(targetDb) / r : 1;
  const pk = peak(p) * g;
  if (pk > fromDb(-0.5)) g *= fromDb(-0.5) / pk;
  return scale(p, g);
}

/** The piano's loudness: RMS of the first 400 ms of its middle notes (measured, dBFS). */
const PIANO_RMS400_DB = -21;

async function renderNote(
  spec: PitchedSpec,
  ref: SrcRef,
  midi: number,
): Promise<{ bytes: Uint8Array; cents: string }> {
  let p = await getPcm(ref, true);
  p = spec.stereo ? stereo(p) : mono(p);
  let cents = "kept";
  if (spec.retune !== false) {
    const c = measureCents(p, midi + 12 * Math.log2(spec.partial ?? 1));
    if (c === null) cents = "unmeasured";
    else if (Math.abs(c) > 2) {
      p = retune(p, -c);
      cents = `${c.toFixed(1)} -> 0`;
    } else cents = c.toFixed(1);
  }
  // rumble, handling noise and hum below the note (a high-pass an octave under it, 24 dB/octave)
  const cut = midiToHz(midi) * 0.5;
  p = {
    sampleRate: p.sampleRate,
    channels: p.channels.map((c) =>
      biquad(biquad(c, "hp", cut, 0.54, 0, p.sampleRate), "hp", cut, 1.31, 0, p.sampleRate),
    ),
  };
  p = trim(p, { maxSec: spec.tailSec, fadeMs: 150, preMs: 2, floorDb: -55 });
  p = levelled(p, PIANO_RMS400_DB + (spec.levelDb ?? 0), 400);
  return { bytes: mp3(p), cents };
}

async function renderHit(
  hit: Mixdown,
  role: DrumRole,
  maxSec: number,
  lofiChain: boolean,
  levelDb: number,
): Promise<Pcm> {
  let p = await mixdown(hit);
  p = trim(p, { maxSec, fadeMs: role === "sd" || role === "bd" ? 40 : 80, preMs: 1, floorDb: -58 });
  if (lofiChain) p = lofi(p);
  return levelled(p, levelDb);
}

async function renderOneShot(hit: Mixdown, spec: (typeof ONE_SHOTS)[keyof typeof ONE_SHOTS]): Promise<Pcm> {
  let p: Pcm;
  if (hit.mics.length === 1 && "stereo" in spec && spec.stereo)
    p = stereo(await getPcm((hit.mics[0] as Mixdown["mics"][number]).ref));
  else p = await mixdown(hit);
  p = trim(p, { maxSec: spec.maxSec, fadeMs: 60, preMs: 1, floorDb: -60 });
  return levelled(p, spec.levelDb, 400);
}

/** The synthesised kits, computed once and only when a file needs them. */
function renderSynthKitLazy(kit: "oak909" | "oak808") {
  let cache: ReturnType<typeof renderSynthKit> | null = null;
  const count: Partial<Record<DrumRole, number>> = {};
  // the variant counts are static: read them from the voice table without rendering
  const probe = renderSynthKitCounts(kit);
  Object.assign(count, probe);
  return {
    count,
    get: () => {
      cache ??= renderSynthKit(kit);
      return cache;
    },
  };
}
const renderSynthKitCounts = (kit: "oak909" | "oak808") =>
  Object.fromEntries(Object.entries(SYNTH_KITS[kit]).map(([r, vs]) => [r, vs?.length ?? 0])) as Partial<
    Record<DrumRole, number>
  >;

// --- running the plan ------------------------------------------------------------------------------------

const derivedOut = new Map<string, Uint8Array>();
/** The bytes a derived file ended up with (rendered this run, or reused from disk). */
async function derivedBytes(path: string): Promise<Uint8Array> {
  const have = derivedOut.get(path);
  if (have) return have;
  const abs = insideRoot(PACK_DIR, path);
  if (existsSync(abs)) return new Uint8Array(await readFile(abs));
  throw new Error(`${path} is needed before it was built`);
}

async function readLock(): Promise<PackLock | undefined> {
  if (!existsSync(LOCK_PATH)) return undefined;
  return JSON.parse(await readFile(LOCK_PATH, "utf8")) as PackLock;
}

async function writeAtomic(path: string, data: Uint8Array | string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.part`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

async function walk(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  const lock = await readLock();
  previousLock = lock;
  const frozen = !!lock && !update;
  if (lock && lock.packVersion !== PACK_VERSION && !update)
    throw new Error(
      `pack.lock.json is ${lock.packVersion} but pack.config.ts says ${PACK_VERSION}: run with --update`,
    );
  console.log(
    `[mirror] pack ${PACK_VERSION} -> ${relative(process.cwd(), PACK_DIR)} (${frozen ? "frozen" : "resolve"})`,
  );
  const encoders = { lame: toolVersion("lame"), flac: toolVersion("flac") };
  if (frozen && lock?.encoders && JSON.stringify(lock.encoders) !== JSON.stringify(encoders))
    console.warn(
      `[mirror] encoders differ from the lock (${JSON.stringify(lock.encoders)} vs ${JSON.stringify(encoders)}): re-encoded MP3s may not match; the lock is the source of truth (docs/spikes.md)`,
    );

  const { plan, manifest, breakMeta, credits } = await resolvePlan(lock);
  const dupes = plan.map((p) => p.path).filter((p, i, a) => a.indexOf(p) !== i);
  if (dupes.length) throw new Error(`duplicate paths in plan: ${dupes.join(", ")}`);
  const locked = new Map((lock?.files ?? []).map((f) => [f.path, f]));
  const previous =
    lock && lock.packVersion !== PACK_VERSION
      ? new Map(lock.files.filter((f) => !f.derived).map((f) => [f.sourceUrl, f]))
      : new Map<string, LockFile>();
  const stats = { downloaded: 0, reused: 0, copied: 0, rendered: 0, kept: 0 };

  const finish = async (
    p: Planned,
    body: Uint8Array,
    derived: boolean,
  ): Promise<LockFile & { group: string }> => {
    const hash = sha256(body);
    const want = locked.get(p.path);
    if (frozen) {
      if (!want) throw new Error(`frozen: ${p.path} is not in pack.lock.json (config changed? run --update)`);
      if (want.sha256 !== hash)
        throw new Error(
          `frozen: sha256 mismatch for ${p.path}\n  lock ${want.sha256}\n  got  ${hash}\n  (${p.sourceUrl})`,
        );
    }
    await writeAtomic(insideRoot(PACK_DIR, p.path), body);
    if (derived) derivedOut.set(p.path, body);
    return {
      path: p.path,
      sourceUrl: p.sourceUrl,
      bytes: body.byteLength,
      sha256: hash,
      group: p.group,
      ...(derived ? { derived: true as const } : {}),
      ...(p.recipe ? { recipe: p.recipe } : {}),
      ...(p.credit ? { credit: p.credit } : {}),
    };
  };

  const build = async (p: Planned): Promise<LockFile & { group: string }> => {
    const dest = insideRoot(PACK_DIR, p.path);
    const want = locked.get(p.path);
    if (p.content !== undefined)
      return finish(p, typeof p.content === "string" ? new TextEncoder().encode(p.content) : p.content, true);
    if (p.render) {
      if (!rebuild && want && want.recipe === p.recipe && existsSync(dest)) {
        const body = new Uint8Array(await readFile(dest));
        if (sha256(body) === want.sha256) {
          stats.kept++;
          derivedOut.set(p.path, body);
          return { ...want, group: p.group };
        }
      }
      if (frozen && want && want.recipe !== p.recipe)
        throw new Error(`frozen: ${p.path} has a new recipe (config or build code changed? run --update)`);
      const body = await p.render();
      validate(p.path, body);
      stats.rendered++;
      if (stats.rendered % 50 === 0) console.log(`[mirror]   ...${stats.rendered} rendered`);
      return finish(p, body, true);
    }
    if (want && existsSync(dest) && sha256(await readFile(dest)) === want.sha256) {
      stats.reused++;
      return {
        path: p.path,
        sourceUrl: p.sourceUrl,
        bytes: want.bytes,
        sha256: want.sha256,
        group: p.group,
        ...(p.credit ? { credit: p.credit } : {}),
      };
    }
    const prev = previous.get(p.sourceUrl);
    if (
      prev &&
      existsSync(insideRoot(PACK_DIR, prev.path)) &&
      sha256(await readFile(insideRoot(PACK_DIR, prev.path))) === prev.sha256
    ) {
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(insideRoot(PACK_DIR, prev.path), dest);
      stats.copied++;
      return {
        path: p.path,
        sourceUrl: p.sourceUrl,
        bytes: prev.bytes,
        sha256: prev.sha256,
        group: p.group,
        ...(p.credit ? { credit: p.credit } : {}),
      };
    }
    if (offline) throw new Error(`--offline: ${p.path} would need a download from ${p.sourceUrl}`);
    const body = new Uint8Array(await (await fetchRetry(p.sourceUrl)).arrayBuffer());
    validate(p.path, body);
    stats.downloaded++;
    return finish(p, body, false);
  };

  // Copied files in parallel; derived ones in plan order (breaks read the kits, kits read nothing derived).
  const copiedPlan = plan.filter((p) => p.content === undefined && !p.render);
  const derivedPlan = plan.filter((p) => p.content !== undefined || p.render);
  const files: (LockFile & { group: string })[] = [];
  files.push(...(await pool(copiedPlan, CONCURRENCY, build)));
  const order = (p: Planned) => (p.path.includes("/breaks/") ? 1 : 0);
  for (const p of [...derivedPlan].sort((a, b) => order(a) - order(b))) files.push(await build(p));

  // breaks.json: from this run's renders, or the previous lock's file when every break was reused
  const v = PACK_VERSION;
  const priorBytes = await lockedFile(lock, "breaks.json");
  const prior = priorBytes
    ? (JSON.parse(new TextDecoder().decode(priorBytes)) as Record<string, BreakMeta>)
    : {};
  const metas = Object.fromEntries(
    Object.keys(BREAKS).map((name) => {
      const m = breakMeta[name] ?? prior[name];
      if (!m) throw new Error(`breaks.json: no slice table for ${name}: run with --rebuild`);
      return [name, m];
    }),
  );
  const breaksJson = json({
    _note: "Oak's rendered breaks: tempo, bars and every onset (frames at sampleRate).",
    ...metas,
  });
  const creditList = credits();
  const late: Planned[] = [
    {
      path: `${v}/breaks.json`,
      sourceUrl: "generated:scripts/sounds/breaks.ts",
      group: "breaks",
      content: breaksJson,
    },
    {
      path: `${v}/credits.json`,
      sourceUrl: "generated:scripts/sounds/credits.ts",
      group: "credits",
      content: json({ packVersion: v, credits: creditList }),
    },
    {
      path: `${v}/CREDITS.md`,
      sourceUrl: "generated:scripts/sounds/credits.ts",
      group: "credits",
      content: creditsMarkdown(v, creditList),
    },
    {
      path: `${v}/manifest.json`,
      sourceUrl: "generated:scripts/sounds/pack.config.ts",
      group: "manifest",
      content: json(manifest),
    },
  ];
  for (const p of late) files.push(await build(p));
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  if (frozen) {
    const missing = [...locked.keys()].filter((path) => !files.some((f) => f.path === path));
    if (missing.length)
      throw new Error(`frozen: lock lists files the config no longer produces: ${missing.join(", ")}`);
  }

  // remove anything in this pack version that is not part of the plan
  const keep = new Set(files.map((f) => join(PACK_DIR, f.path)));
  let removed = 0;
  for (const f of await walk(join(PACK_DIR, PACK_VERSION)))
    if (!keep.has(f)) {
      await rm(f);
      removed++;
    }

  const groups: PackLock["groups"] = {};
  for (const f of files) {
    const g = groups[f.group] ?? { files: 0, bytes: 0 };
    g.files++;
    g.bytes += f.bytes;
    groups[f.group] = g;
  }
  const totalBytes = files.reduce((a, f) => a + f.bytes, 0);
  const newLock: PackLock = {
    packVersion: PACK_VERSION,
    publicRoot: PUBLIC_ROOT,
    totalBytes,
    fileCount: files.length,
    encoders,
    groups,
    credits: Object.fromEntries(creditList.map((c) => [c.id, c.entry])) as Record<string, CreditEntry>,
    sources: [...lockSources.values()].sort((a, b) => (a.url < b.url ? -1 : 1)),
    files: files.map(({ group: _group, ...f }) => f),
  };
  if (!frozen) await writeAtomic(LOCK_PATH, json(newLock));
  if (report.tuning && stats.rendered)
    await writeAtomic(join(CACHE_DIR, "tuning-report.json"), json(report.tuning));

  printReport(files);
  console.log(
    `[mirror] ${stats.downloaded} downloaded, ${stats.reused} reused, ${stats.copied} copied from the previous version, ${stats.rendered} rendered, ${stats.kept} derived kept (recipe unchanged), ${removed} stale removed; lock ${frozen ? "verified" : "written"}`,
  );
  if (totalBytes > BUDGET_BYTES) {
    console.error(
      `[mirror] the pack is ${mb(totalBytes)}, over the ${mb(BUDGET_BYTES)} limit (check.ts fails)`,
    );
    process.exitCode = 2;
  }
}

function printReport(files: { group: string; bytes: number }[]) {
  const groups = new Map<string, { files: number; bytes: number }>();
  for (const f of files) {
    const g = groups.get(f.group) ?? { files: 0, bytes: 0 };
    g.files++;
    g.bytes += f.bytes;
    groups.set(f.group, g);
  }
  for (const [name, g] of [...groups].sort())
    console.log(
      `[mirror]   ${name.padEnd(22)} ${String(g.files).padStart(4)} files  ${mb(g.bytes).padStart(9)}`,
    );
  const total = files.reduce((a, f) => a + f.bytes, 0);
  console.log(
    `[mirror]   ${"TOTAL".padEnd(22)} ${String(files.length).padStart(4)} files  ${mb(total).padStart(9)}`,
  );
}

await main();
