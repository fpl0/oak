// Measures the level of each velocity layer of the locked pack against its top layer and writes the runtime's
// level trims (packages/strudel/src/layer-trims.ts). Read-only on the pack: nothing is rendered or re-encoded.
//
// Why: v4 levels a role's or a note's velocity layers to the same RMS over their first 100 ms (library.ts
// ROLE_LEVEL_DB), so that "the layer changes the timbre, `velocity` the level". Over a whole hit they still differ
// by up to ~2 dB (a soft snare rings shorter, a soft kick longer), so `.velocity(.4)` was not one mapping on every
// kit and comping sound: rockkit's snare at .4 sat 6.75 dB under its accent, jazzkit's 8.68, the default kit's
// 7.96 (packages/strudel/e2e/wave6.pw.ts, U13 ghost notes). The runtime multiplies each lower layer by its trim, so
// a layer plays as much energy as the top layer and velocity alone sets the level.
//
// What is measured (energy: the sum of squares of both channels, as the U13 check reads it):
//   - a kit role's layers (`manifest.kitLayers`): the whole hit, up to 3 s (a one-shot plays to its end);
//   - a sample alias's layers (`manifest.sampleAliases`, struck and plucked instruments): the first 0.6 s, a
//     quarter note at 100 BPM, as a comping note sounds. The bowed and blown ones (strings, trumpet, mute) swell
//     in, slower when soft, so a fixed window reads their attack, not their level (strings' soft layer measures
//     12 dB under the top one at 0.6 s and 8 dB over it at 3 s): they keep the pack's levelling.
//
//   bun scripts/sounds/layer-trims.ts            # writes packages/strudel/src/layer-trims.ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { decodeAudio, decodeWav, type Pcm } from "./audio.ts";
import { PACK_VERSION } from "./pack.config.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const PACK = join(ROOT, "sounds/pack", PACK_VERSION);
const OUT = join(ROOT, "packages/strudel/src/layer-trims.ts");

/** Seconds measured: a whole one-shot (capped), a comping note. */
const KIT_SECONDS = 3;
const NOTE_SECONDS = 0.6;
/** Sample aliases whose notes decay (struck, plucked): the ones a fixed window measures fairly. */
const DECAYING = new Set(["rhodes", "upright", "cleangtr", "jazzgtr", "vibes"]);
/** Trims under this (dB) are left out. */
const MIN_DB = 0.05;

function decode(path: string): Pcm {
  const bytes = new Uint8Array(readFileSync(path));
  if (!path.endsWith(".mp3")) return decodeAudio(bytes, path);
  // MP3: LAME (the pack's own pinned encoder) decodes it; the encoder delay is the same in every layer.
  const dir = mkdtempSync(join(tmpdir(), "oak-layer-"));
  try {
    const wav = join(dir, "x.wav");
    const p = Bun.spawnSync({ cmd: ["lame", "--quiet", "--decode", path, wav], stderr: "pipe" });
    if (p.exitCode !== 0) throw new Error(`lame --decode ${path}: ${new TextDecoder().decode(p.stderr)}`);
    return decodeWav(new Uint8Array(readFileSync(wav)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function energy(path: string, seconds: number): number {
  const p = decode(path);
  const n = Math.min(p.channels[0]?.length ?? 0, Math.round(seconds * p.sampleRate));
  // A mono file plays on both channels.
  const chans = p.channels.length === 1 ? [p.channels[0], p.channels[0]] : p.channels;
  let e = 0;
  for (const c of chans) for (let i = 0; i < n; i++) e += (c?.[i] ?? 0) ** 2;
  return e;
}

const json = (file: string) => JSON.parse(readFileSync(join(PACK, file), "utf8"));
const manifest = json("manifest.json");
const trims: Record<string, number> = {};
/** Each lower layer of `files` (soft first, the top one last) against the top one. */
function measure(files: string[], seconds: number): void {
  const top = files[files.length - 1] as string;
  const eTop = energy(join(PACK, top), seconds);
  for (const f of files.slice(0, -1)) {
    if (f === top) continue;
    const db = Math.round(10 * Math.log10(eTop / energy(join(PACK, f), seconds)) * 100) / 100;
    if (Math.abs(db) >= MIN_DB) trims[f] = db;
  }
}

const kitMaps: Record<string, string[]> = {};
for (const kit of manifest.kits as string[]) Object.assign(kitMaps, json(`oak-kit-${kit}.json`));
for (const [key, l] of Object.entries(manifest.kitLayers as Record<string, { layers: number }>)) {
  const files = kitMaps[key] ?? [];
  for (let v = 0; v + l.layers <= files.length; v += l.layers)
    measure(files.slice(v, v + l.layers), KIT_SECONDS);
}
const src = json("oak-src.json") as Record<string, Record<string, string[]>>;
for (const [alias, a] of Object.entries(
  manifest.sampleAliases as Record<string, { sample: string; layers: number }>,
)) {
  if (a.layers < 2 || !DECAYING.has(alias)) continue;
  for (const [note, files] of Object.entries(src[a.sample] ?? {}))
    if (note !== "_base") measure(files, NOTE_SECONDS);
}

const body = Object.entries(trims)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([f, db]) => `    "${f}": ${db},`)
  .join("\n");
writeFileSync(
  OUT,
  `// Generated by scripts/sounds/layer-trims.ts from the ${PACK_VERSION} pack: do not edit by hand.
// Each lower velocity layer's level trim (dB) against its top layer, by pack path: a kit role's whole hit, a struck or
// plucked instrument's first ${NOTE_SECONDS} s (the script says why). The runtime applies them for this pack only.
export const LAYER_TRIMS: { packVersion: string; db: Record<string, number> } = {
  packVersion: "${PACK_VERSION}",
  db: {
${body}
  },
};
`,
);
console.log(`${Object.keys(trims).length} layer trims -> ${OUT}`);
