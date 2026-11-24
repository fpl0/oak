// Prebake from the self-hosted sound pack (architecture §6.2, promoted from spikes/s3-sounds/src/oak-audio.ts).
// Local only: every URL comes from `<soundsRoot>/manifest.json`, which `scripts/sounds/mirror.ts` writes.
//
// Gotchas kept (docs/spikes.md, s3):
// - `samples(url, base)` registers a junk `_base` sound: fetch the JSON ourselves, delete `_base`, call
//   `samples(object, base)`.
// - `registerSoundfonts()` registers all 125 gm_* names: keep only the mirrored ones and pin `n` onto the
//   mirrored upstream indices, otherwise `s("gm_violin")` would ask for a file the pack does not have.
// - `soundAlias` cannot pin a variant and does not lower-case: curated aliases use `registerSound` with
//   a variant-pinning wrapper, lower-case keys.
// - `aliasBank` copies entries that exist at call time: it runs after the sample maps.
// - v4: a sample-backed alias (`rhodes` -> map key `src_rhodes`) is a registered sample sound under the alias
//   name, so the preloader and `packFileUrls` treat it like any sample; its velocity picks the layer.
// - v4: retired bank names (`RolandTR909`...) are bank aliases of Oak's CC0 kits (`manifest.kitAliases`),
//   made after the kits are complete and trimmed, so they copy the finished entries and play exactly as the kits do.
// - v4: a soft velocity layer of a kit or of a short-sounding instrument is trimmed to its top layer's level
//   (`layerGains`, layer-trims.ts), so velocity alone sets the level and the layer only the timbre. Sounds whose soft
//   layer swells in (strings, brass) are left as recorded: no fixed window measures them fairly.
import * as core from "@strudel/core";
import * as draw from "@strudel/draw";
import * as mini from "@strudel/mini";
import * as soundfonts from "@strudel/soundfonts";
import * as tonal from "@strudel/tonal";
import * as webaudio from "@strudel/webaudio";
import { LAYER_TRIMS } from "./layer-trims.ts";

export interface PackManifest {
  packVersion: string;
  publicRoot: string;
  sampleMaps: { json: string; base: string; tag?: string }[];
  /** v1–v3: the tidal-drum-machines bank alias file. */
  bankAliases?: string;
  soundfontUrl: string;
  soundfonts: Record<string, { upstreamIndex: number; font: string }[]>;
  aliases: Record<string, AliasEntry>;
  /** `<kit>_<role>` -> linear gain (Oak kits, `.bank("jazzkit")`). Absent in v1 packs. */
  kitGains?: Record<string, number | number[]>;
  /** v4: `<kit>_<role>` -> velocity layers per variant (the map lists files variant-major) and their split. */
  kitLayers?: Record<string, { layers: number; split: number[] }>;
  /** v4: Oak's kits (each completed with the default kit's roles). */
  kits?: string[];
  /** v4: retired bank name -> the Oak kit it plays. */
  kitAliases?: Record<string, string>;
  /** v4: sample-backed instruments. */
  sampleAliases?: Record<string, SampleAliasEntry>;
  /** v4: the pack's credits (rendered by the About page) and the breaks' slice tables. */
  credits?: string;
  breaks?: string;
}

/** A sample-backed alias in the manifest (`scripts/sounds/pack.config.ts`, kind "sample"). */
export interface SampleAliasEntry {
  /** The pitched sample map key behind it (`src_<alias>`). */
  sample: string;
  /** Velocity layers per pitch (the map lists them softest first). */
  layers: number;
  /** Velocity thresholds between layers. */
  split?: number[];
  gain?: number;
  /** Release (s) when the code sets none: the note stops at the end of its event, like the GM aliases. */
  release: number;
  range: [number, number];
}

/** A curated alias in the manifest (`scripts/sounds/pack.config.ts` `OAK_ALIASES`). */
export interface AliasEntry {
  gm: string;
  upstreamIndex: number;
  font: string;
  /** Linear output gain (loudness match). */
  gain?: number;
  /** Release (s) used when the code sets none. */
  release?: number;
  /** MIDI range a by-name preload warms. */
  range?: [number, number];
}

type SoundHandle = { node?: AudioNode; [k: string]: unknown } | undefined;

export type HapValue = Record<string, unknown> & {
  s?: unknown;
  n?: unknown;
  bank?: unknown;
  note?: unknown;
  freq?: unknown;
};
type OnTrigger = (t: number, value: HapValue, onended: () => void, cps?: number) => unknown;
export interface SoundEntry {
  onTrigger: OnTrigger;
  data?: {
    type?: string;
    samples?: unknown;
    fonts?: string[];
    prebake?: boolean;
    tag?: string;
    baseUrl?: string;
    /** Oak aliases: the MIDI range a by-name preload warms. */
    range?: [number, number];
    /** Wavetables (`wt_*` map keys): the table files. */
    tables?: string[];
    /** v4 velocity layers (sample aliases: per pitch; kit roles: per variant, files variant-major). */
    layers?: number;
    split?: number[];
  };
}

/**
 * Visual methods Oak never lets draw on Strudel's canvas (contracts §3.1 rule 9). `scope` and `fscope`
 * are routed to Oak's own panel by the adapter; every other one is identity.
 */
export const VISUAL_METHODS = [
  "pianoroll",
  "punchcard",
  "spiral",
  "pitchwheel",
  "wordfall",
  "scope",
  "tscope",
  "fscope",
  "spectrum",
  "markcss",
] as const;

/** `.scope()` and `.fscope()` call this during an evaluation; the adapter reads it in `afterEval`. */
export const scopeRequests = new Set<"scope" | "fscope">();

/** Replaces the visual methods (and their `_x` inline variants) on `Pattern.prototype`. */
export function stubVisualMethods(Pattern: { prototype: Record<string, unknown> }): void {
  for (const name of VISUAL_METHODS) {
    const panel =
      name === "scope" || name === "tscope"
        ? "scope"
        : name === "fscope" || name === "spectrum"
          ? "fscope"
          : null;
    const stub = panel
      ? function (this: unknown) {
          scopeRequests.add(panel);
          return this;
        }
      : function (this: unknown) {
          return this;
        };
    Pattern.prototype[name] = stub;
    Pattern.prototype[`_${name}`] = stub;
  }
}

/** The unmodified gm_* entries `registerSoundfonts()` created (their closures index the FULL upstream list). */
const upstream = new Map<string, SoundEntry>();

/**
 * Wrap an upstream gm_* trigger so that `n` selects among `indices` (upstream variant numbers) only.
 * `defaults` fills controls the code did not set (an alias's release).
 */
export function pinVariant(
  entry: SoundEntry,
  indices: readonly number[],
  defaults: Record<string, unknown> = {},
): OnTrigger {
  return (t, value, onended, cps) => {
    const v: HapValue = { ...value, n: indices[core.getSoundIndex(value.n, indices.length)] };
    for (const [k, d] of Object.entries(defaults)) if (v[k] === undefined) v[k] = d;
    return entry.onTrigger(t, v, onended, cps);
  };
}

/** The velocity layer a hap plays: the first layer whose threshold its velocity is below, else the top one. */
export function layerOf(velocity: unknown, split: readonly number[]): number {
  const v = typeof velocity === "number" ? velocity : 1;
  const i = split.findIndex((t) => v < t);
  return i < 0 ? split.length : i;
}

/**
 * A sample alias's trigger: `n` becomes the velocity layer, and the alias's release fills in when the code
 * sets none (so the note stops at the end of its event).
 */
export function sampleAliasTrigger(entry: SoundEntry, a: SampleAliasEntry): OnTrigger {
  const split = a.layers > 1 ? (a.split ?? []) : [];
  return (t, value, onended, cps) => {
    const v: HapValue = { ...value, n: a.layers > 1 ? layerOf(value.velocity, split) : 0 };
    if (v.release === undefined) v.release = a.release;
    return entry.onTrigger(t, v, onended, cps);
  };
}

/** A kit role with velocity layers: `n` picks the variant, the velocity its layer (files variant-major). */
export function layeredIndex(
  n: unknown,
  velocity: unknown,
  files: number,
  layers: number,
  split: readonly number[],
): number {
  const variants = Math.max(1, Math.floor(files / layers));
  return core.getSoundIndex(n, variants) * layers + layerOf(velocity, split);
}

/** The file a sample sound plays for a hap: superdough's own choice (`getSampleInfo`), so the two never drift. */
export function sampleUrlOf(samples: unknown, value: HapValue): string | undefined {
  if (!samples || typeof samples !== "object") return undefined;
  const url = (webaudio.getSampleInfo(value, samples) as { url?: unknown } | undefined)?.url;
  return typeof url === "string" ? url : undefined;
}

/**
 * Velocity layer trims (packages/strudel/src/layer-trims.ts) as linear gains by sample URL, for a pack whose version
 * they were measured on; none for any other pack.
 */
export function layerGains(manifest: Pick<PackManifest, "packVersion" | "publicRoot">): Map<string, number> {
  const out = new Map<string, number>();
  if (manifest.packVersion !== LAYER_TRIMS.packVersion) return out;
  const root = manifest.publicRoot.replace(/\/+$/, "");
  for (const [path, db] of Object.entries(LAYER_TRIMS.db)) out.set(`${root}/${path}`, 10 ** (db / 20));
  return out;
}

/** A sample sound's trigger with each file's layer trim, when any of its files has one. */
export function withLayerTrims(
  trigger: OnTrigger,
  samples: unknown,
  gains: ReadonlyMap<string, number>,
): OnTrigger {
  const files = Array.isArray(samples)
    ? samples
    : samples && typeof samples === "object"
      ? Object.values(samples as Record<string, unknown>).flat()
      : [];
  if (!files.some((f) => typeof f === "string" && gains.has(f))) return trigger;
  return withOutputGain(trigger, (v) => gains.get(sampleUrlOf(samples, v) ?? "") ?? 1);
}

/**
 * A trigger whose output passes through a fixed gain (an alias's or a kit role's level trim). The handle's
 * `node` becomes the gain node, so superdough's chain (velocity, gain, effects) follows the trim.
 */
export function withOutputGain(trigger: OnTrigger, gain: number | ((value: HapValue) => number)): OnTrigger {
  if (gain === 1) return trigger;
  return async (t, value, onended, cps) => {
    const handle = (await trigger(t, value, onended, cps)) as SoundHandle;
    const node = handle?.node;
    if (!handle || !node) return handle;
    const trim = node.context.createGain();
    trim.gain.value = typeof gain === "number" ? gain : gain(value);
    node.connect(trim);
    return { ...handle, node: trim };
  };
}

function curateSoundfonts(manifest: PackManifest): void {
  const all = webaudio.soundMap.get() as Record<string, SoundEntry>;
  const next: Record<string, SoundEntry> = {};
  for (const [key, entry] of Object.entries(all)) {
    if (entry.data?.type !== "soundfont") {
      next[key] = entry;
      continue;
    }
    const mirrored = manifest.soundfonts[key];
    if (!mirrored) continue; // not in the pack: unregistered, so it fails loudly ("sound gm_x not found")
    upstream.set(key, entry);
    next[key] = {
      onTrigger: pinVariant(
        entry,
        mirrored.map((m) => m.upstreamIndex),
      ),
      // `data.fonts` lists exactly the mirrored fonts, in `n` order (the preloader relies on this).
      data: { ...entry.data, fonts: mirrored.map((m) => m.font) },
    };
  }
  webaudio.soundMap.set(next);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`@oak/strudel: ${url} answered HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** A URL must stay on this origin: the pack never points at a third-party host (contracts §11.2). */
export function assertLocal(url: string): void {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith(`${globalThis.location?.origin ?? "\u0000"}/`)) {
    throw new Error(`@oak/strudel: refusing remote sound URL ${url}`);
  }
}

/**
 * Prebake: evalScope, visual stubs, synths, soundfonts restricted to the mirrored instruments, sample
 * maps, bank aliases, curated aliases. Call once per realm (the adapter memoizes it).
 */
export async function prebake(soundsRoot: string): Promise<PackManifest> {
  const root = soundsRoot.replace(/\/+$/, "");
  await core.evalScope(core, mini, tonal, draw, webaudio, soundfonts);
  stubVisualMethods(core.Pattern);
  const manifest = await fetchJson<PackManifest>(`${root}/manifest.json`);
  for (const map of manifest.sampleMaps) {
    assertLocal(map.json);
    assertLocal(map.base);
  }
  assertLocal(manifest.soundfontUrl);

  webaudio.registerSynthSounds();
  webaudio.registerZZFXSounds();
  soundfonts.setSoundfontUrl(manifest.soundfontUrl);
  soundfonts.registerSoundfonts();
  curateSoundfonts(manifest);

  await Promise.all(
    manifest.sampleMaps.map(async ({ json, base, tag }) => {
      const map = await fetchJson<Record<string, unknown>>(json);
      delete map._base;
      await webaudio.samples(map, base, tag ? { prebake: true, tag } : { prebake: true });
    }),
  );
  if (manifest.bankAliases) await webaudio.aliasBank(manifest.bankAliases);
  const kits = manifest.kits ?? [...OAK_KITS];
  registerOakKits(kits);
  const layered = layerGains(manifest);
  trimKits(manifest.kitGains ?? {}, manifest.kitLayers ?? {}, layered);
  registerKitAliases(manifest.kitAliases ?? {});

  for (const [alias, a] of Object.entries(manifest.sampleAliases ?? {})) {
    const entry = webaudio.getSound(a.sample) as SoundEntry | undefined;
    if (!entry) throw new Error(`@oak/strudel: sample alias ${alias}: ${a.sample} is not in the pack`);
    const trimmed = { ...entry, onTrigger: withLayerTrims(entry.onTrigger, entry.data?.samples, layered) };
    webaudio.registerSound(alias.toLowerCase(), withOutputGain(sampleAliasTrigger(trimmed, a), a.gain ?? 1), {
      ...entry.data,
      type: "sample",
      prebake: true,
      tag: "oak",
      range: a.range,
      layers: a.layers,
      split: a.split ?? [],
    });
  }

  for (const [alias, a] of Object.entries(manifest.aliases)) {
    const original = upstream.get(a.gm);
    if (!original) throw new Error(`@oak/strudel: alias ${alias}: ${a.gm} is not in the pack`);
    const defaults = a.release !== undefined ? { release: a.release } : {};
    webaudio.registerSound(
      alias.toLowerCase(),
      withOutputGain(pinVariant(original, [a.upstreamIndex], defaults), a.gain ?? 1),
      {
        type: "soundfont",
        prebake: true,
        fonts: [a.font],
        tag: "oak",
        ...(a.range ? { range: a.range } : {}),
      },
    );
  }
  return manifest;
}

/** Every registered sound name, sorted. */
export function soundNames(): string[] {
  return Object.keys(webaudio.soundMap.get() as Record<string, unknown>).sort();
}

/**
 * Every file of the pack: manifest, maps, bank aliases, every sample of every registered sample sound
 * and every mirrored font. Bytes come from a HEAD request (local, served with `content-length`).
 */
export async function packFileUrls(soundsRoot: string, manifest: PackManifest): Promise<string[]> {
  const root = soundsRoot.replace(/\/+$/, "");
  const urls = new Set<string>([`${root}/manifest.json`]);
  for (const u of [manifest.bankAliases, manifest.credits, manifest.breaks]) if (u) urls.add(u);
  for (const map of manifest.sampleMaps) urls.add(map.json);
  const add = (u: unknown): void => {
    if (typeof u === "string") urls.add(encodeSoundPath(u));
  };
  for (const entry of Object.values(webaudio.soundMap.get() as Record<string, SoundEntry>)) {
    const data = entry.data;
    if (data?.type === "wavetable") {
      for (const u of data.tables ?? []) add(u);
      continue;
    }
    if (data?.type !== "sample") continue;
    const samples = data.samples;
    if (Array.isArray(samples)) samples.forEach(add);
    else if (samples && typeof samples === "object")
      for (const list of Object.values(samples)) (list as unknown[]).forEach(add);
  }
  for (const fonts of Object.values(manifest.soundfonts)) {
    for (const f of fonts) urls.add(`${manifest.soundfontUrl}/${f.font}.js`);
  }
  return [...urls].filter((u) => u.startsWith(`${root}/`)).sort();
}

/** superdough's own escaping before it fetches: `encodeURI`-like, plus `#`. */
export function encodeSoundPath(path: string): string {
  return encodeURI(decodeURI(path)).replace(/#/g, "%23");
}

/** The drum roles an Oak kit maps (contracts §3.2 `snd.drum.*`). */
const KIT_ROLES = [
  "bd",
  "sd",
  "hh",
  "oh",
  "rd",
  "cr",
  "cp",
  "rim",
  "lt",
  "mt",
  "ht",
  "sh",
  "cb",
  "tb",
] as const;

/**
 * Oak's kits (`.bank("<kit>")`); their samples come from the pack's `oak-kit-<kit>.json` maps. The manifest's
 * `kits` list wins; this is the v4 set (and what older packs are completed with).
 */
export const OAK_KITS = ["jazzkit", "rockkit", "lofikit", "oak909", "oak808"] as const;

/**
 * Every role an Oak kit's map does not define falls back to the default kit (uzu-drumkit), so a kit never goes
 * silent on a role (a v1 pack has no kit map at all).
 */
export function registerOakKits(kits: readonly string[] = OAK_KITS): void {
  const map = webaudio.soundMap.get() as Record<string, unknown>;
  for (const kit of kits)
    for (const role of KIT_ROLES)
      if (map[role] && !map[`${kit}_${role}`]) webaudio.soundAlias(role, `${kit}_${role}`);
}

/**
 * Retired bank names play Oak's CC0 kits (`.bank("RolandTR909")` -> oak909, v4). Runs after the kits are
 * complete and trimmed: superdough's `aliasBank` copies the entries that exist when it is called.
 */
export function registerKitAliases(aliases: Record<string, string>): void {
  const byKit: Record<string, string[]> = {};
  for (const [old, kit] of Object.entries(aliases)) byKit[kit] = [...(byKit[kit] ?? []), old];
  if (Object.keys(byKit).length) void webaudio.aliasBank(byKit);
}

/** The trim of one hit: a role's single gain, or the gain of the variant `n` selects (wrapping like superdough). */
export function kitGainOf(gain: number | readonly number[], n: unknown): number {
  if (typeof gain === "number") return gain;
  if (gain.length === 0) return 1;
  return gain[core.getSoundIndex(n, gain.length)] ?? 1;
}

/**
 * Applies the manifest's per-role level trims, and the velocity layers of v4 kits with their layer trims
 * (`layerGains`), to the kit sounds (data kept: the preloader reads it).
 */
export function trimKits(
  gains: Record<string, number | number[]>,
  layers: Record<string, { layers: number; split: number[] }> = {},
  layerTrims: ReadonlyMap<string, number> = new Map(),
): void {
  for (const key of new Set([...Object.keys(gains), ...Object.keys(layers)])) {
    const entry = webaudio.getSound(key) as SoundEntry | undefined;
    if (!entry) continue;
    const gain = gains[key] ?? 1;
    const l = layers[key];
    const files = Array.isArray(entry.data?.samples) ? entry.data.samples.length : 1;
    let trigger = entry.onTrigger;
    if (l && l.layers > 1) {
      const inner = withLayerTrims(trigger, entry.data?.samples, layerTrims);
      trigger = (t, value, onended, cps) =>
        inner(
          t,
          { ...value, n: layeredIndex(value.n, value.velocity, files, l.layers, l.split) },
          onended,
          cps,
        );
    }
    if (gain !== 1) trigger = withOutputGain(trigger, (v) => kitGainOf(gain, v.n));
    if (trigger !== entry.onTrigger)
      webaudio.registerSound(
        key,
        trigger,
        l && l.layers > 1 ? { ...entry.data, layers: l.layers, split: l.split } : (entry.data ?? {}),
      );
  }
}
