// Curated Oak sound pack definition. Shared by mirror.ts and check.ts.
// Bump PACK_VERSION whenever the file list or a derived file (manifest, maps) changes: the pack is served at
// /sounds/<PACK_VERSION>/ with `immutable` and cached CacheFirst by the Service Worker, so a path must never
// change content.
//
// v2 (Wave 3): `acgtr` alias; per-alias gain/release (loudness-matched, no click at note ends); the Oak
// jazz kit (`.bank("jazzkit")`, brushes and ride from the Roland MC-303 bank of tidal-drum-machines).
// v3 (Wave 4): `brk`, Oak's own one-bar break (scripts/sounds/brk.ts, CC0), in the `oak-rendered` map.
// v4 (unit songs): a CC0/CC-BY library (docs/design/samples/proposal.md). Sample-backed aliases behind the
// existing names (rhodes, upright, ebass, fingerbass, organ, cleangtr, jazzgtr, strings, trumpet, mutetpt,
// tenor, vibes) and new ones (marimba, kalimba, glockenspiel); kits jazzkit (rebuilt from Virtuosity and
// Swirly), rockkit, lofikit, oak909 and oak808 (synthesised by Oak); six rendered breaks; hand percussion,
// textures and foley; wavetables; credits.json, CREDITS.md and LICENSES/. The tidal-drum-machines banks and
// the MC-303 jazz kit are retired: their names play the closest CC0 kit (KIT_ALIASES).
// v5 (Oak 2.0 W2/W5): every v4 file kept byte for byte at its path and index (scripts/sounds/v5-lock.test.ts), plus
// (library-v5.ts) matched hat pairs and soft snare strokes appended to the recorded kits, new one-shots `speech`
// (Kenney's CC0 voice lines), `brush`, `guiro`, `fall`, and `impact:2`, `swoosh:2`; and Oak's synthesised additions
// (synth-v5.ts): the plain sounds `plainbass`, `plainkeys`, `plainlead`, the 909's and 808's hat pairs and soft
// strokes, the 909's `sh` and `tb`.

import { BREAKS } from "./breaks.ts";
import {
  AKWF_TABLES,
  type Credit,
  type DrumRole,
  type Licence,
  ONE_SHOTS,
  PITCHED,
  RECORDED_KITS,
  SOURCES,
} from "./library.ts";
import { OAK_TABLES } from "./wavetables.ts";

export const PACK_VERSION = "v5";

/** Public URL prefix the app serves the pack from. Every rewritten `_base` starts with this. */
export const PUBLIC_ROOT = `/sounds/${PACK_VERSION}`;

/** Hosts the strudel.cc REPL prebake uses (website/src/repl/prebake.mjs: baseCDN). */
export const SAMPLE_CDN = "https://strudel.b-cdn.net";
/** Default soundfontUrl in @strudel/soundfonts/fontloader.mjs. */
export const SOUNDFONT_CDN = "https://felixroos.github.io/webaudiofontdata/sound";

/**
 * The pack's hard size limit, enforced by check.ts (a failure, not a warning). Owner decision for v4:
 * quality first, up to about 80 MiB; the limit is the pack's size plus 10%, rounded up to a MiB. v4's limit was
 * 57 MiB; v5 is 57.18 MiB (59,960,662 B), plus 10% 62.9 MiB, so the limit is 63 MiB.
 */
export const BUDGET_BYTES = 63 * 1024 * 1024;

/**
 * The one dated exception (2026-11-24): the General MIDI WebAudioFont presets the pack already shipped
 * (felixroos/webaudiofontdata, MIT for the conversion) whose source SoundFont's own licence could not be
 * verified (JCLive, Aspirin, LK_AcousticSteel, GeneralUser GS). Kept so `gm_*` names and the GM-backed aliases
 * (acgtr, clav, pad, choir) keep playing; no new file may use it. Retire each when a CC0 replacement lands.
 */
export const LEGACY_GM = "LicenseRef-legacy-webaudiofont-unverified";

/** Licences a pack file may carry (check.ts); CC-BY entries must also carry their attribution. */
export const LICENCE_ALLOW_LIST: readonly string[] = [
  "CC0-1.0",
  "Unlicense",
  "MIT",
  "CC-BY-3.0",
  "CC-BY-4.0",
  LEGACY_GM,
];

/** Drum roles Oak teaches (PLAN.md 12: "The drum set includes sh, cb and tb"). */
export const DRUM_ROLES = [
  "bd",
  "sd",
  "hh",
  "oh",
  "cp",
  "rim",
  "cr",
  "rd",
  "lt",
  "mt",
  "ht",
  "sh",
  "cb",
  "tb",
] as const satisfies readonly DrumRole[];

export interface SampleMapSpec {
  /** file name of the map, both upstream (`${SAMPLE_CDN}/${json}`) and in the pack */
  json: string;
  /** directory below SAMPLE_CDN the REPL prebake passes as baseUrl; reused as the pack directory */
  dir: string;
  /** which keys to keep, and how many variations of each */
  keep: (key: string) => number;
  credit: Credit;
}

const drumRoles = new Set<string>(DRUM_ROLES);

/** Maps copied byte-for-byte from the Strudel CDN (unchanged since v1). */
export const SAMPLE_MAPS: SampleMapSpec[] = [
  // Salamander Grand Piano V3 (CC-BY 3.0, Alexander Holm) - one velocity layer, 29 pitches
  {
    json: "piano.json",
    dir: "piano/",
    keep: () => Number.POSITIVE_INFINITY,
    credit: {
      title: "Salamander Grand Piano V3",
      author: "Alexander Holm",
      url: "https://github.com/sfzinstruments/SalamanderGrandPiano",
      licence: "CC-BY-3.0",
      licenceUrl: "https://creativecommons.org/licenses/by/3.0/",
      attribution:
        "Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/); one velocity layer, selected and re-encoded (MP3) as served by the Strudel project.",
    },
  },
  // uzu-drumkit (Unlicense): default bd/sd/hh... kit. Its "brk" (a recording of the Amen break, whose
  // licence is not Oak's to give) and "misc" are pruned; Oak's `brk` is rendered (scripts/sounds/brk.ts).
  {
    json: "uzu-drumkit.json",
    dir: "uzu-drumkit/",
    keep: (key) => (drumRoles.has(key) ? Number.POSITIVE_INFINITY : 0),
    credit: {
      title: "uzu-drumkit",
      author: "TidalCycles contributors",
      url: "https://github.com/tidalcycles/uzu-drumkit",
      licence: "Unlicense",
      licenceUrl: "https://unlicense.org/",
    },
  },
];

/**
 * gm_* instruments and the variant indices (positions in @strudel/soundfonts/gm.mjs) that are mirrored.
 * Index 0 is kept for every name the pack has always had, so `s("gm_xxx")` keeps playing. Other indices are
 * kept where a GM-backed alias pins one, and where v3 mirrored a FluidR3 (MIT) variant: v3's toolbox printed
 * names such as `gm_vibraphone:3` and `gm_drawbar_organ:3`, and an unmirrored `n` wraps onto index 0, a
 * different preset (organ an octave low, vibraphone two octaves high). v3's legacy variants (gm_trumpet:1,
 * gm_tenor_sax:3, gm_electric_bass_finger:3) are not restored: no new file may use the legacy exception.
 * gm_electric_bass_finger index 1 is the upstream typo ("0330_FluidR3_GM_sf2_fible", HTTP 404) and must never
 * be listed.
 */
export const GM_VARIANTS: Record<string, number[]> = {
  gm_piano: [0],
  gm_epiano1: [0, 1], // 0040_FluidR3_GM (v3's rhodes)
  gm_drawbar_organ: [0, 3], // 0160_FluidR3_GM (v3's organ)
  gm_acoustic_bass: [0, 1], // 0320_FluidR3_GM (v3's upright)
  gm_electric_bass_finger: [0],
  gm_electric_bass_pick: [0, 1], // 0340_FluidR3_GM
  gm_electric_guitar_jazz: [0, 3], // 0260_FluidR3_GM
  gm_electric_guitar_clean: [0],
  gm_overdriven_guitar: [0], // 0290_FluidR3_GM (crunch)
  gm_acoustic_guitar_steel: [0, 5], // 0250_LK_AcousticSteel (acgtr)
  gm_string_ensemble_1: [0],
  gm_brass_section: [0, 3], // 0610_FluidR3_GM (horns)
  gm_tenor_sax: [0],
  gm_trumpet: [0],
  gm_choir_aahs: [0, 2], // 0520_Aspirin (choir), 0520_FluidR3_GM
  gm_clavinet: [0], // 0070_JCLive (clav)
  gm_pad_warm: [0], // 0890_JCLive (pad)
  gm_muted_trumpet: [0],
  gm_vibraphone: [0, 3], // 0110_FluidR3_GM (v3's vibes)
  gm_flute: [0, 2], // 0730_FluidR3_GM
};

/** The FluidR3 fonts (Frank Wen, MIT); every other mirrored font is the legacy exception. */
export const FLUIDR3_FONT = /_FluidR3_GM_sf2_file$/;

/** A General MIDI alias: the gm font it pins and how it is played. */
export interface GmAliasSpec {
  kind?: "gm";
  gm: string;
  /** Upstream variant index in gm.mjs (must be mirrored in GM_VARIANTS). */
  variant: number;
  /** Linear output gain: loudness-matched to the piano (sound-quality.json, ±1.5 LU). Default 1. */
  gain?: number;
  /** Release (s) when the code sets none: the soundfont default (10 ms) clicks on plucked and low notes. */
  release?: number;
  /** MIDI range a by-name preload warms, every semitone (default 36–84). */
  range?: [number, number];
}

/**
 * A sample-backed alias: a pitched sample map (key `src_<alias>`, never taught) played through the alias name,
 * with a fixed gain, a default release (so a note stops at the end of its event, like the GM aliases did) and
 * velocity layers (the map lists each pitch's layers softest first; `split` holds the velocity thresholds).
 */
export interface SampleAliasSpec {
  kind: "sample";
  gain?: number;
  release: number;
  range: [number, number];
  /** Velocity thresholds between layers (one fewer than the layers). */
  split?: number[];
}

export type AliasSpec = GmAliasSpec | SampleAliasSpec;

/** Velocity below this plays the soft layer of a two-layer sound (kits and instruments alike). */
export const SOFT_BELOW = 0.6;

/** A sample alias; `layered` is true for two layers (split at SOFT_BELOW) or the thresholds of more. */
const sample = (
  release: number,
  range: [number, number],
  layered: boolean | number[] = false,
  gain?: number,
): SampleAliasSpec => ({
  kind: "sample",
  release,
  range,
  ...(layered === true ? { split: [SOFT_BELOW] } : Array.isArray(layered) ? { split: layered } : {}),
  ...(gain !== undefined ? { gain } : {}),
});

/**
 * Curated Oak instrument names. The GM ones keep the variants, gains and releases the sound-quality harness
 * measured (`packages/strudel/e2e/quality.pw.ts`, `packages/strudel/sound-quality.json`). The sample ones are
 * levelled at build time to the piano's loudness (mirror.ts), retuned to equal temperament, and stop at the
 * end of their event with the release given here.
 */
export const OAK_ALIASES: Record<string, AliasSpec> = {
  // gains: the phrase's loudness against the piano's (sound-quality.json, ±1.5 LU), measured on the v4 pack
  rhodes: sample(0.35, [29, 96], true, 0.87),
  upright: sample(0.12, [24, 67], [0.45, 0.85], 0.79),
  ebass: sample(0.1, [24, 67], false, 0.82),
  fingerbass: sample(0.1, [24, 67], false, 0.84),
  organ: sample(0.08, [36, 96], false, 0.84),
  acgtr: { gm: "gm_acoustic_guitar_steel", variant: 5, gain: 1.95, range: [40, 88] },
  jazzgtr: sample(0.25, [37, 88], true, 0.86),
  cleangtr: sample(0.25, [36, 88], true, 0.69),
  crunch: { gm: "gm_overdriven_guitar", variant: 0, gain: 0.58, range: [40, 88] },
  strings: sample(0.45, [36, 96], true, 0.69),
  horns: { gm: "gm_brass_section", variant: 3, range: [48, 84] },
  trumpet: sample(0.15, [52, 88], true, 0.68),
  tenor: sample(0.15, [44, 88], false, 0.79),
  vibes: sample(0.9, [53, 89], true, 0.77),
  mutetpt: sample(0.15, [52, 84], true, 0.61),
  clav: { gm: "gm_clavinet", variant: 0, gain: 0.72 },
  pad: { gm: "gm_pad_warm", variant: 0 },
  choir: { gm: "gm_choir_aahs", variant: 0 },
  marimba: sample(0.3, [41, 96], false, 0.93),
  kalimba: sample(0.5, [59, 96]),
  glockenspiel: sample(0.6, [79, 108], false, 0.68),
  // v5: Oak's plain sounds (synth-v5.ts), levelled to the piano at build time; ranges are synth-v5.ts PLAIN_RANGES.
  // Releases are Oak's call, as the closest v4 sound of the role (ebass, rhodes, tenor). Gains as above, measured on
  // the v5 pack at gain 1: plainbass −0.1 LU (none), plainkeys +0.7 LU, plainlead +1.4 LU.
  plainbass: sample(0.1, [28, 55]),
  plainkeys: sample(0.35, [48, 84], false, 0.92),
  plainlead: sample(0.15, [55, 91], false, 0.85),
};

export const isSampleAlias = (a: AliasSpec): a is SampleAliasSpec => a.kind === "sample";

/** The sample map key behind a sample alias. */
export const srcKey = (alias: string): string => `src_${alias}`;

/** Oak's kits, `.bank("<name>")`: recorded (library.ts) or synthesised (drummachine.ts). */
export const OAK_KITS = {
  jazzkit: { kind: "recorded", label: "Virtuosity Drums (sticks) and Swirly Drums (brushes)" },
  rockkit: { kind: "recorded", label: "Big Rusty Drums" },
  lofikit: { kind: "recorded", label: "Virtuosity Drums' lo-fi microphone through Oak's lo-fi chain" },
  oak909: { kind: "synth", label: "Oak's synthesised 909-style drum machine" },
  oak808: { kind: "synth", label: "Oak's synthesised 808-style drum machine" },
} as const satisfies Record<string, { kind: "recorded" | "synth"; label: string }>;

export type OakKit = keyof typeof OAK_KITS;

/**
 * Retired bank names and the CC0 kit each now plays (owner decision, v4): saved code and every lesson that
 * names them keeps sounding. Case does not matter (superdough lower-cases sound names), so `tr909` and `TR909`
 * are the same alias.
 */
export const KIT_ALIASES: Record<string, OakKit> = {
  RolandTR909: "oak909",
  TR909: "oak909",
  RolandTR808: "oak808",
  TR808: "oak808",
  RolandTR707: "oak909",
  TR707: "oak909",
  LinnDrum: "rockkit",
  AkaiLinn: "lofikit",
  Linn: "lofikit",
};

/** The derived sample map of an Oak kit (keys `<kit>_<role>`), at the pack root. */
export const kitJson = (kit: string): string => `oak-kit-${kit}.json`;

/** Oak's rendered breaks (breaks.ts), beside `brk`. */
export const BREAK_NAMES = Object.keys(BREAKS);
/** One-shot maps (hand percussion, textures, foley) and the tape bed Oak renders. */
export const ONE_SHOT_NAMES = [...Object.keys(ONE_SHOTS), "tape"];
/** Wavetables: AKWF single cycles and Oak's morph tables. */
export const WAVETABLE_NAMES = [...Object.keys(AKWF_TABLES), ...Object.keys(OAK_TABLES)];
/** Every pitched sample instrument (keys of library.ts PITCHED). */
export const PITCHED_NAMES = Object.keys(PITCHED);
export const RECORDED_KIT_NAMES = Object.keys(RECORDED_KITS);
export { SOURCES };

export interface LockFile {
  path: string;
  sourceUrl: string;
  bytes: number;
  sha256: string;
  /** true when the file is generated/rewritten by mirror.ts instead of copied byte-for-byte */
  derived?: true;
  /** derived files: hash of everything the file is computed from (inputs, settings, build code) */
  recipe?: string;
  /** the credit (credits.json id) every derived or copied audio file is covered by */
  credit?: string;
}

/** An upstream file a derived file is computed from (not shipped; cached in sounds/pack/.sources/). */
export interface LockSource {
  url: string;
  bytes: number;
  sha256: string;
}

export interface PackLock {
  packVersion: string;
  publicRoot: string;
  totalBytes: number;
  fileCount: number;
  /** encoder versions the derived audio was built with (the lock is the source of truth, docs/spikes.md) */
  encoders?: Record<string, string>;
  groups: Record<string, { files: number; bytes: number }>;
  /** licence metadata per source (the same entries as credits.json) */
  credits?: Record<string, CreditEntry>;
  sources?: LockSource[];
  files: LockFile[];
}

/** One credits.json entry. */
export interface CreditEntry extends Omit<Credit, "licence"> {
  licence: Licence | typeof LEGACY_GM;
  /** Commit or archive hash the files were taken from. */
  pinned?: string;
  /** What Oak did to the files. */
  modified: string;
  /** Oak sounds built from it. */
  sounds: string[];
  /** Per-file origins (freesound pages behind Sonic Pi samples). */
  origins?: string[];
}

export interface PackManifest {
  packVersion: string;
  publicRoot: string;
  /** sample maps to pass to superdough `samples(json, base)` */
  sampleMaps: { json: string; base: string; tag?: string }[];
  /** argument for superdough `aliasBank(url)` (absent from v4: KIT_ALIASES are in `kitAliases`) */
  bankAliases?: string;
  /** retired bank name -> the Oak kit it plays (v4) */
  kitAliases?: Record<string, string>;
  /** Oak kits the runtime completes with the default kit's roles (v4) */
  kits?: string[];
  /** argument for `setSoundfontUrl` (no trailing slash; loader appends `/${font}.js`) */
  soundfontUrl: string;
  /** gm name -> mirrored fonts, in upstream order */
  soundfonts: Record<string, { upstreamIndex: number; font: string }[]>;
  /** curated GM alias -> pinned font, and how it is played */
  aliases: Record<
    string,
    {
      gm: string;
      upstreamIndex: number;
      font: string;
      gain?: number;
      release?: number;
      range?: [number, number];
    }
  >;
  /** curated sample alias -> its sample map key and how it is played (v4) */
  sampleAliases?: Record<
    string,
    {
      sample: string;
      layers: number;
      split?: number[];
      gain?: number;
      release: number;
      range: [number, number];
    }
  >;
  /** `<kit>_<role>` -> linear gain of an Oak kit's role (the kit's map is one of `sampleMaps`) */
  kitGains?: Record<string, number | number[]>;
  /** `<kit>_<role>` -> velocity layers per variant and their split (v4; the map lists files variant-major) */
  kitLayers?: Record<string, { layers: number; split: number[] }>;
  /** credits.json and breaks.json (v4) */
  credits?: string;
  breaks?: string;
}
