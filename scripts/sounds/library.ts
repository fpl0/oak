// The curated sound library of pack v4 (docs/design/samples/proposal.md): which upstream files Oak takes,
// pinned to a commit, and how each becomes an Oak sound. Read by pack.config.ts (types, aliases, kits) and
// rendered by mirror.ts. Every licence below was read at its pinned URL on 2026-11-24 (docs/spikes.md).
//
// Paths are the upstream repository paths, decoded (spaces and commas as they are); mirror.ts encodes them
// once for the fetch. Note names in a path are the upstream's own spelling; `octave` says how far that
// spelling sits from the sounding pitch (measured: VSCO and VCSL name middle C "C3", Sneakybass names the
// written double-bass pitch, an octave above the sound).

export type Licence = "CC0-1.0" | "Unlicense" | "MIT" | "CC-BY-3.0" | "CC-BY-4.0";

/** Who made a source and under what terms; written into credits.json and CREDITS.md. */
export interface Credit {
  title: string;
  author: string;
  url: string;
  licence: Licence;
  licenceUrl: string;
  /** Required wording for CC-BY works (the author's requested form where they gave one). */
  attribution?: string;
}

/** A GitHub repository pinned to a commit: files come from raw.githubusercontent.com/<repo>/<commit>/<path>. */
export interface RepoSource {
  kind: "github";
  repo: string;
  commit: string;
  credit: Credit;
}

/** A release archive (tar, any compression bsdtar reads) pinned by its sha256. */
export interface ArchiveSource {
  kind: "archive";
  url: string;
  sha256: string;
  credit: Credit;
}

export type Source = RepoSource | ArchiveSource;

const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

export const SOURCES = {
  jrhodes: {
    kind: "github",
    repo: "sfzinstruments/jlearman.jRhodes3d",
    commit: "4508215a0ec6613a2af19d6f4dc7b329e0e7bba0",
    credit: {
      title: "jRhodes3d (1977 Rhodes Mark I Stage 73)",
      author: "Jeff Learman",
      url: "https://github.com/sfzinstruments/jlearman.jRhodes3d",
      licence: "CC-BY-4.0",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution:
        "Rhodes samples are from (based on) jRhodes3d - https://github.com/sfzinstruments/jlearman.jRhodes3d, by Jeff Learman, CC BY 4.0. Oak selected notes and velocity layers, trimmed, levelled, retuned and re-encoded them (MP3).",
    },
  },
  sneakybass: {
    kind: "github",
    repo: "sfzinstruments/karoryfer.sneakybass",
    commit: "cc1a67e5c913678b85eaad1a3b5cb180d3be3e2d",
    credit: {
      title: "Sneakybass (1958 double bass, pizzicato)",
      author: "Karoryfer Samples (D. Smolken)",
      url: "https://github.com/sfzinstruments/karoryfer.sneakybass",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  smolken: {
    kind: "github",
    repo: "sfzinstruments/dsmolken.double-bass",
    commit: "c2985eb647109d2a8f30a70071e3e163339d7396",
    credit: {
      title: "1958 Otto Rubner double bass, pizzicato",
      author: "D. Smolken",
      url: "https://github.com/sfzinstruments/dsmolken.double-bass",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  shinyguitar: {
    kind: "github",
    repo: "sfzinstruments/karoryfer.shinyguitar",
    commit: "57243cca85277dbcc120ce17c6178032f93c80f3",
    credit: {
      title: "Shinyguitar (archtop guitar, pickup)",
      author: "Karoryfer Samples (D. Smolken)",
      url: "https://github.com/sfzinstruments/karoryfer.shinyguitar",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  virtuosity: {
    kind: "github",
    repo: "sfzinstruments/virtuosity_drums",
    commit: "9f04cf9a734527edfbb0a4eee1f674e45bbf71bc",
    credit: {
      title: "Virtuosity Drums",
      author: "Versilian Studios and Karoryfer Samples",
      url: "https://github.com/sfzinstruments/virtuosity_drums",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  swirly: {
    kind: "github",
    repo: "sfzinstruments/karoryfer.swirly-drums",
    commit: "c40dafe0011cb2e54c0c220ff0fa308a11fc60f5",
    credit: {
      title: "Swirly Drums (brushes)",
      author: "Karoryfer Samples",
      url: "https://github.com/sfzinstruments/karoryfer.swirly-drums",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  bigrusty: {
    kind: "github",
    repo: "sfzinstruments/karoryfer.big-rusty-drums",
    commit: "f07ce00df34a46b6b08375be56fe116cf15782bc",
    credit: {
      title: "Big Rusty Drums",
      author: "Karoryfer Samples",
      url: "https://github.com/sfzinstruments/karoryfer.big-rusty-drums",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  vcsl: {
    kind: "github",
    repo: "sgossner/VCSL",
    commit: "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e",
    credit: {
      title: "VCSL (Versilian Community Sample Library)",
      author: "Versilian Studios (Sam Gossner)",
      url: "https://github.com/sgossner/VCSL",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  vsco: {
    kind: "github",
    repo: "sgossner/VSCO-2-CE",
    commit: "440300901dfe9275fd84e0b7763af1f8443ae62e",
    credit: {
      title: "VSCO 2 Community Edition",
      author: "Versilian Studios (Sam Gossner, Simon Dalzell)",
      url: "https://github.com/sgossner/VSCO-2-CE",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  bassyr: {
    kind: "github",
    repo: "freepats/electric-bass-YR",
    commit: "8dcb7ea9116f417273ef8c030d15e7b3aa654301",
    credit: {
      title: "Bass Guitar YR (FreePats clean electric bass)",
      author: "Andrea Biasior for FreePats",
      url: "https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  fsbsclean: {
    kind: "github",
    repo: "freepats/electric-guitar-FSBS-clean",
    commit: "192cf0d9bf2c4ba6ead8e3524ba3f78818e4fe91",
    credit: {
      title: "FSBS Electric Guitar Clean (FreePats)",
      author: "FreePats",
      url: "https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  organ: {
    kind: "archive",
    url: "https://freepats.zenvoid.org/Organ/DrawbarOrganEmulation/DrawbarOrganEmulation-SFZ-20190712.tar.xz",
    sha256: "e2da18b0a4d13be7020037e18e4a719387433357e7603d0773990e794dcf5d0f",
    credit: {
      title: "Drawbar Organ Emulation (setBfree renders)",
      author: "Roberto for FreePats",
      url: "https://freepats.zenvoid.org/Organ/electric-organ.html",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  sonicpi: {
    kind: "github",
    repo: "sonic-pi-net/sonic-pi",
    commit: "26cdb2cf05ada193b11bb6f4353ae4c7cdffd79c",
    credit: {
      title: "Sonic Pi bundled samples (etc/samples)",
      author: "Sonic Pi project and the freesound.org uploaders listed per file",
      url: "https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/samples/README.md",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
  akwf: {
    kind: "github",
    repo: "KristofferKarlAxelEkstrand/AKWF-FREE",
    commit: "8de90bf94376670947369e69de0af6b9fbd19286",
    credit: {
      title: "AKWF-FREE single-cycle waveforms",
      author: "Kristoffer Ekstrand (Adventure Kid)",
      url: "https://github.com/KristofferKarlAxelEkstrand/AKWF-FREE",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

/** One upstream file. */
export interface SrcRef {
  src: SourceId;
  path: string;
}

/** Several microphones of one hit, summed at fixed gains into one mono one-shot. */
export interface Mixdown {
  mics: { ref: SrcRef; gain: number }[];
}

// --- pitched instruments ---------------------------------------------------------------------------------

/** One sampled pitch: its velocity layers, softest first (one file per layer, or a mixdown). */
export interface PitchedNote {
  /** The sounding pitch (MIDI), after the source's octave convention is applied. */
  midi: number;
  layers: SrcRef[];
}

/**
 * A pitched Oak instrument built from samples (an `OAK_ALIASES` entry of kind "sample"). Every note is
 * trimmed, levelled to the same loudness as its neighbours, retuned to equal temperament when the
 * measured partial is off by more than 2 cents, and encoded as MP3 (mono unless `stereo`).
 */
export interface PitchedSpec {
  notes: PitchedNote[];
  /** Longest kept tail, seconds (a note played longer than this fades with the sample). */
  tailSec: number;
  stereo?: boolean;
  /** Retune measured pitch (off for the organ: its 16' drawbar is a sub-octave, the 8' is the pitch). */
  retune?: boolean;
  /** Measure the pitch on this harmonic number's partial (2 for low basses: the fundamental is too low). */
  partial?: number;
  /** Loudness target relative to the piano's (dB); basses sit a little hotter, as in the GM fonts. */
  levelDb?: number;
}

const noteNum: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
/** "C#3", "Bb2", "gb4" -> MIDI (C4 = 60), plus an octave convention. */
export function midiOf(name: string, octave = 0): number {
  const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`library: bad note name ${name}`);
  const pc = noteNum[(m[1] as string).toLowerCase()] as number;
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + pc + acc + octave;
}

const ref = (src: SourceId, path: string): SrcRef => ({ src, path });

/** Notes from a list of upstream note names and a path builder per layer. */
function notes(
  src: SourceId,
  names: string,
  octave: number,
  layers: ((name: string) => string)[],
): PitchedNote[] {
  return names
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => ({ midi: midiOf(name, octave), layers: layers.map((f) => ref(src, f(name))) }));
}

const JR = [29, 35, 40, 45, 50, 55, 59, 62, 65, 71, 76, 81, 86, 91, 96];
const JR_NAME: Record<number, string> = {
  29: "F1",
  35: "B1",
  40: "E2",
  45: "A2",
  50: "D3",
  55: "G3",
  59: "B3",
  62: "D4",
  65: "F4",
  71: "B4",
  76: "E5",
  81: "A5",
  86: "D6",
  91: "G6",
  96: "C7",
};
const jr = (m: number, layer: number) =>
  `jRhodes3d-mono/A_${String(m).padStart(3, "0")}__${JR_NAME[m]}_${layer}.flac`;

const GLOCK_TAKE: Record<string, string> = { G4: "01", C5: "02", G5: "01", C6: "01", G6: "01", C7: "03" };

const VCSL_VIBES_H = "Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_";
const VCSL_VIBES_S = "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_";
const STRINGS = "Strings";

export const PITCHED = {
  // jRhodes3d mono, layers 2 (soft) and 4 (medium): the bark of layer 5 is left out (velocity 1 is the
  // everyday level in Oak's code, and it must sound like the classic soul Rhodes).
  rhodes: {
    notes: JR.map((m) => ({ midi: m, layers: [ref("jrhodes", jr(m, 2)), ref("jrhodes", jr(m, 4))] })),
    tailSec: 8,
  },
  // D. Smolken's 1958 Rubner double bass, pizzicato, fifths tuning: every sampled pitch C1–A3 with its three
  // dynamics (p, m, f) as velocity layers. (Sneakybass, the same bass played very quietly, was tried first: its
  // upper notes are too soft against their finger noise to hold a steady pitch past 0.3 s.)
  upright: {
    notes: notes("smolken", "c1 eb1 g1 bb1 d2 f2 a2 c3 e3 g3 a3", 0, [
      (n) => `pizz/pizz_${n}_pa.wav`,
      (n) => `pizz/pizz_${n}_ma.wav`,
      (n) => `pizz/pizz_${n}_fa.wav`,
    ]),
    tailSec: 4,
    partial: 2,
    levelDb: 2,
  },
  // FreePats Bass Guitar YR, pick and finger: chromatic E1–E2 (the SFZ's keys).
  ebass: {
    notes: [
      ...["E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#"].map((pc, i) => ({
        midi: 28 + i,
        layers: [ref("bassyr", `samples/pick/${pc}.flac`)],
      })),
      { midi: 40, layers: [ref("bassyr", "samples/pick/E2.flac")] },
    ],
    tailSec: 4,
    partial: 2,
    levelDb: 2,
  },
  fingerbass: {
    notes: ["E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#"].map((pc, i) => ({
      midi: 28 + i,
      layers: [ref("bassyr", `samples/finger/${pc}.flac`)],
    })),
    tailSec: 4,
    partial: 2,
    levelDb: 2,
  },
  // FreePats drawbar organ (setBfree), every major third. From C3 up the registration's 16' drawbar is the
  // strongest partial (measured), so each file sounds an octave below its name and is keyed there; the three
  // lowest files fold the 16' back (no sub-octave) and are left out so the timbre is even.
  organ: {
    notes: "C3 E3 G#3 C4 E4 G#4 C5 E5 G#5 C6 E6 G#6 C7".split(" ").map((n) => ({
      midi: midiOf(n, -12),
      layers: [ref("organ", `DrawbarOrganEmulation-SFZ-20190712/samples/${n}.wav`)],
    })),
    tailSec: 5,
    retune: false,
  },
  // FSBS Clean #1, bridge pickup: soft and normal layers (the soft layer doubles the normal one where the
  // set has none).
  cleangtr: {
    notes: "C2 E2 F2 A2 C3 D3 E3 G3 B3 C#4 E4 G4 B4 C5 D5 F5 G#5 A#5 C#6".split(" ").map((n) => {
      const s = (string: number) => `samples/bridge/${n}_s${string}_`;
      const str = { C2: 1, E2: 1, F2: 1, A2: 2, C3: 2, D3: 3, E3: 3, G3: 4, B3: 5, "C#4": 5 }[n] ?? 6;
      const soft = ["C2", "E2", "F2", "A2", "C3", "D3", "E3", "G3", "B3", "C#4", "E4", "C5", "D5"].includes(
        n,
      );
      return {
        midi: midiOf(n),
        layers: [
          ref("fsbsclean", `${s(str)}${soft ? "soft_" : ""}01.flac`),
          ref("fsbsclean", `${s(str)}01.flac`),
        ],
      };
    }),
    tailSec: 5,
  },
  // Shinyguitar archtop on its pickup, velocity layers 2 and 4, every minor third C#2–C6.
  jazzgtr: {
    notes: notes("shinyguitar", "db2 e2 gb2 a2 c3 eb3 gb3 a3 c4 eb4 gb4 a4 c5 eb5 gb5 a5 c6", 0, [
      (n) => `Samples/electric/${n}_vl2_rr1_2.wav`,
      (n) => `Samples/electric/${n}_vl4_rr1_2.wav`,
    ]),
    tailSec: 5,
  },
  // VSCO 2 CE string sections, sustain with vibrato, stereo: cello below G3, viola to F4, violins above.
  strings: {
    notes: [
      ...notes("vsco", "C1 E1 G1 B1 D2 F2", 12, [
        (n) => `${STRINGS}/Cello Section/susvib/susvib_${n}_v1_1.wav`,
        (n) => `${STRINGS}/Cello Section/susvib/susvib_${n}_v3_1.wav`,
      ]),
      ...notes("vsco", "G2 B2 D3 F3", 12, [
        (n) => `${STRINGS}/Viola Section/susvib/ViolaEns_susvib_${n}_v1_1.wav`,
        (n) => `${STRINGS}/Viola Section/susvib/ViolaEns_susvib_${n}_v2_1.wav`,
      ]),
      ...notes("vsco", "A3 C4 E4 G4 B4 D5", 12, [
        (n) => `${STRINGS}/Violin Section/susVib/VlnEns_susVib_${n}_v1.wav`,
        (n) => `${STRINGS}/Violin Section/susVib/VlnEns_susVib_${n}_v2.wav`,
      ]),
    ],
    tailSec: 7,
    stereo: true,
  },
  trumpet: {
    notes: notes("vsco", "F2 A2 C3 D#3 G3 A#3 D4 F4 A4 C5", 12, [
      (n) => `Brass/Trumpet/sus/Sum_SHTrumpet_sus_${n}_v1_rr1.wav`,
      (n) => `Brass/Trumpet/sus/Sum_SHTrumpet_sus_${n}_v3_rr1.wav`,
    ]),
    tailSec: 5,
  },
  mutetpt: {
    notes: notes("vsco", "A#2 C3 D#3 G#3 A#3 D4 F4 A4", 12, [
      (n) => `Brass/Trumpet/harmonM-sus/Sum_SHTrumpet_harmonM-sus_${n}_v1_rr1.wav`,
      (n) => `Brass/Trumpet/harmonM-sus/Sum_SHTrumpet_harmonM-sus_${n}_v3_rr1.wav`,
    ]),
    tailSec: 5,
  },
  // VCSL tenor sax (Brett), non-vibrato, every whole tone.
  tenor: {
    notes: notes(
      "vcsl",
      "G#1 A#1 C2 D2 E2 F#2 G#2 A#2 C3 D3 E3 F#3 G#3 A#3 C4 D4 E4 F#4 G#4 A#4 C5 D5 E5",
      12,
      [(n) => `Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/BrettTenor_NV_Main_${n}_vl3_rr1.wav`],
    ),
    tailSec: 5,
  },
  // VCSL vibraphone: soft mallets for quiet notes, hard mallets otherwise; stereo.
  vibes: {
    notes: notes("vcsl", "F2 A2 C3 E3 G3 B3 D4 F4 A4 C5 E5", 12, [
      (n) => `${VCSL_VIBES_S}${n}_v2_rr1_Main.wav`,
      (n) => `${VCSL_VIBES_H}${n}_v3_rr1_Main.wav`,
    ]),
    tailSec: 6,
    stereo: true,
  },
  marimba: {
    notes: notes("vcsl", "F1 C2 G2 B2 F3 C4 G4 B4 F5 C6", 12, [
      (n) => `Idiophones/Struck Idiophones/Marimba/Marimba_hit_Outrigger_${n}_soft_01.wav`,
    ]),
    tailSec: 3,
  },
  kalimba: {
    notes: [
      ["B2", 8],
      ["C#3", 7],
      ["D#3", 9],
      ["F#3", 5],
      ["G#3", 4],
      ["B3", 3],
      ["C#4", 2],
      ["D#4", 13],
      ["F#4", 14],
      ["A4", 1],
      ["B4", 15],
    ].map(([n, k]) => ({
      midi: midiOf(n as string, 12),
      layers: [
        ref(
          "vcsl",
          `Idiophones/Plucked Idiophones/Kalimba, Kenya/Mbira6_Normal_MainSpirit_${n}_k${k}_vl3_rr2.wav`,
        ),
      ],
    })),
    tailSec: 3,
  },
  glockenspiel: {
    notes: notes("vcsl", "G4 C5 G5 C6 G6 C7", 12, [
      (n) => `Idiophones/Struck Idiophones/Glockenspiel/glock_soft_${n}_${GLOCK_TAKE[n]}.wav`,
    ]),
    tailSec: 3,
  },
} as const satisfies Record<string, PitchedSpec>;

// --- drum kits -------------------------------------------------------------------------------------------

export type DrumRole =
  | "bd"
  | "sd"
  | "hh"
  | "oh"
  | "cp"
  | "rim"
  | "cr"
  | "rd"
  | "lt"
  | "mt"
  | "ht"
  | "sh"
  | "cb"
  | "tb";

/** One role of a recorded kit: its variants (in `n` order), each with its velocity layers (soft first). */
export interface KitRoleSpec {
  variants: Mixdown[][];
  /** Longest kept tail, seconds. */
  maxSec: number;
  /** Loudness of this role in this kit (RMS of the first 100 ms, dBFS), one per variant or one for all;
   * default ROLE_LEVEL_DB. */
  levelDb?: number | number[];
}

export interface RecordedKitSpec {
  /** Sources credited for the kit (each file's own source is credited too). */
  roles: Partial<Record<DrumRole, KitRoleSpec>>;
  /** Oak's deterministic lo-fi chain (saturation, 12-bit, 26 kHz hold, low-pass) and a 22.05 kHz output. */
  lofi?: boolean;
}

const VD_MICS: Record<string, Record<string, number>> = {
  kick: { kickmic: 1, oh: 0.45, room: 0.35 },
  snare: { snaremic: 1, oh: 0.55, room: 0.35 },
  hh: { oh: 1, snaremic: 0.25, room: 0.3 },
  ride: { oh: 1, room: 0.35 },
  crash: { oh: 1, room: 0.35 },
  ltom: { oh: 1, mid: 0.6, room: 0.35 },
  htom: { oh: 1, mid: 0.6, room: 0.35 },
};
/** A Virtuosity hit, mixed from its microphones (or one microphone, the `lofi` one). */
function vd(group: string, name: string, only?: string): Mixdown {
  const mics = only ? { [only]: 1 } : (VD_MICS[group] as Record<string, number>);
  return {
    mics: Object.entries(mics).map(([mic, gain]) => ({
      ref: ref("virtuosity", `Samples/${mic}/${group}/${mic}_${group}_${name}.flac`),
      gain,
    })),
  };
}
const vdPerc = (dir: string, file: string): Mixdown => ({
  mics: [
    { ref: ref("virtuosity", `Samples/perc/close/${dir}/${file}_Close.wav`), gain: 1 },
    { ref: ref("virtuosity", `Samples/perc/mid/${dir}/${file}_Mid.wav`), gain: 0.6 },
  ],
});
const swirly = (dir: string, name: string): Mixdown => ({
  mics: [
    { ref: ref("swirly", `Samples/${dir}/${name}_top.wav`), gain: 1 },
    { ref: ref("swirly", `Samples/${dir}/${name}_btm.wav`), gain: 0.45 },
  ],
});
const one = (src: SourceId, path: string): Mixdown => ({ mics: [{ ref: ref(src, path), gain: 1 }] });
const BR_MICS: Record<string, Record<string, number>> = {
  kick: { kick: 1, oh: 0.45, sn: 0.2 },
  snare: { top: 1, btm: 0.45, oh: 0.55 },
  side: { top: 1, oh: 0.5 },
  cym: { cl: 0.7, oh: 1 },
  tom: { cl: 1, oh: 0.5, sn: 0.2 },
};
/** A Big Rusty hit: `dir` holds one folder per microphone. */
function br(dir: string, file: string, mics: keyof typeof BR_MICS): Mixdown {
  return {
    mics: Object.entries(BR_MICS[mics] as Record<string, number>).map(([mic, gain]) => ({
      ref: ref("bigrusty", `Samples/${dir}/${mic}/${file}`),
      gain,
    })),
  };
}

const VCSL_CLAP = one("vcsl", "Idiophones/Struck Idiophones/Claps/Clap_rr1.wav");
const VCSL_CLAP2 = one("vcsl", "Idiophones/Struck Idiophones/Claps/Clap_rr3.wav");
const PERC = {
  sh: {
    variants: [[vdPerc("shaker", "LShaker_Shake1D_rr1")], [vdPerc("shaker", "LShaker_Shake1U_rr1")]],
    maxSec: 1,
  },
  tb: { variants: [[vdPerc("tambourine", "Tamb1_Shake_rr1")]], maxSec: 1.5 },
  cb: {
    variants: [[vdPerc("cowbell", "Cowbell1_Normal_v1_rr1"), vdPerc("cowbell", "Cowbell1_Normal_v3_rr1")]],
    maxSec: 1.5,
  },
  cp: { variants: [[VCSL_CLAP], [VCSL_CLAP2]], maxSec: 1 },
} satisfies Partial<Record<DrumRole, KitRoleSpec>>;

export const RECORDED_KITS = {
  // Virtuosity Drums played with sticks, and Swirly Drums brushes on the snare (n 0 tap, 1 slap, 2 stir).
  jazzkit: {
    roles: {
      // a jazz kit plays under the band: a feathered kick, quiet hats, the ride carrying the time
      bd: {
        variants: [[vd("kick", "snoff_vl2_rr1"), vd("kick", "snoff_vl4_rr1")]],
        maxSec: 1.5,
        levelDb: -10,
      },
      sd: {
        variants: [
          [swirly("snare_main", "snare_hit_vl4_rr1"), swirly("snare_main", "snare_hit_vl10_rr1")],
          [swirly("snare_edge", "snare_edge_vl3_rr1"), swirly("snare_edge", "snare_edge_vl9_rr1")],
          [one("swirly", "Samples/snare_stir/stir_dl1_rr1.wav")],
        ],
        maxSec: 1.2,
        // the stir is a continuous swish, not a hit: far below the taps
        levelDb: [-8, -9.5, -27],
      },
      rim: { variants: [[vd("snare", "crossstick_vl6"), vd("snare", "crossstick_vl14")]], maxSec: 0.8 },
      hh: {
        variants: [
          [vd("hh", "closed_vl2_rr1"), vd("hh", "closed_vl4_rr1")],
          [vd("hh", "pedal_vl2_rr1"), vd("hh", "pedal_vl3_rr1")],
        ],
        maxSec: 1,
        levelDb: -35,
      },
      oh: { variants: [[vd("hh", "open_vl2_rr1"), vd("hh", "open_vl4_rr1")]], maxSec: 2.5, levelDb: -25 },
      rd: {
        variants: [
          [vd("ride", "ride_vl1_rr1"), vd("ride", "ride_vl3_rr1")],
          [vd("ride", "bell_vl2_rr1"), vd("ride", "bell_vl3_rr1")],
        ],
        maxSec: 4,
        // the ride below its peak ceiling, so the bell and a kick on the same beat do not clip
        levelDb: [-26, -22],
      },
      cr: { variants: [[vd("crash", "crash_vl2_rr1"), vd("crash", "crash_vl3_rr1")]], maxSec: 4 },
      lt: { variants: [[vd("ltom", "center_vl6"), vd("ltom", "center_vl14")]], maxSec: 2 },
      mt: { variants: [[vd("htom", "offcenter_vl6"), vd("htom", "offcenter_vl14")]], maxSec: 2 },
      ht: { variants: [[vd("htom", "center_vl6"), vd("htom", "center_vl14")]], maxSec: 2 },
      ...PERC,
    },
  },
  // Big Rusty Drums: the big 24" kick, 14" snare (n 1: rimshot), hats, 22" ride (n 1: bell), toms.
  rockkit: {
    roles: {
      bd: {
        variants: [
          [br("kick_24/kick", "k_vl6_rr1.flac", "kick"), br("kick_24/kick", "k_vl12_rr1.flac", "kick")],
        ],
        maxSec: 1.5,
      },
      sd: {
        variants: [
          [
            br("snare_14/center", "sn_center_vl4_rr1.flac", "snare"),
            br("snare_14/center", "sn_center_vl9_rr1.flac", "snare"),
          ],
          [
            br("snare_14/rimshot", "sn_rims_vl3_rr1.flac", "snare"),
            br("snare_14/rimshot", "sn_rims_vl6_rr1.flac", "snare"),
          ],
        ],
        maxSec: 1.2,
      },
      rim: {
        variants: [
          [
            br("snare_14/sidestick", "sn_ss_vl2_rr1.flac", "side"),
            br("snare_14/sidestick", "sn_ss_vl4_rr1.flac", "side"),
          ],
        ],
        maxSec: 0.8,
      },
      hh: {
        variants: [
          [br("hihat_14/tc", "ht_tc_vl3_rr1.flac", "cym"), br("hihat_14/tc", "ht_tc_vl7_rr1.flac", "cym")],
          [
            br("hihat_14/chik", "ht_chik_vl2_rr1.flac", "cym"),
            br("hihat_14/chik", "ht_chik_vl4_rr1.flac", "cym"),
          ],
        ],
        maxSec: 1,
      },
      oh: {
        variants: [
          [
            br("hihat_14/open", "ht_open_vl3_rr1.flac", "cym"),
            br("hihat_14/open", "ht_open_vl6_rr1.flac", "cym"),
          ],
        ],
        maxSec: 2.5,
      },
      rd: {
        variants: [
          [br("ride_22/rd", "rd_vl4_rr1.flac", "cym"), br("ride_22/rd", "rd_vl9_rr1.flac", "cym")],
          [br("ride_22/bl", "rd_bl_vl2_rr1.flac", "cym"), br("ride_22/bl", "rd_bl_vl4_rr1.flac", "cym")],
        ],
        maxSec: 4,
      },
      cr: {
        variants: [
          [br("crash_17/cr", "cr_vl2_rr1.flac", "cym"), br("crash_17/cr", "cr_vl4_rr1.flac", "cym")],
        ],
        maxSec: 4,
      },
      ht: {
        variants: [
          [br("tom_14/center", "t14_vl3_rr1.flac", "tom"), br("tom_14/center", "t14_vl6_rr1.flac", "tom")],
        ],
        maxSec: 2,
      },
      mt: {
        variants: [
          [br("tom_15/center", "t15_vl3_rr1.flac", "tom"), br("tom_15/center", "t15_vl7_rr1.flac", "tom")],
        ],
        maxSec: 2,
      },
      lt: {
        variants: [
          [br("tom_18/center", "t18_vl4_rr1.flac", "tom"), br("tom_18/center", "t18_vl8_rr1.flac", "tom")],
        ],
        maxSec: 2.5,
      },
      ...PERC,
    },
  },
  // Virtuosity's own "lofi" microphone, then Oak's lo-fi chain: the coastline-style crate kit, made from
  // licensed recordings (and named so nobody mistakes it for eddyflux's crate).
  lofikit: {
    lofi: true,
    roles: {
      bd: {
        variants: [[vd("kick", "snoff_vl2_rr1", "lofi"), vd("kick", "snoff_vl4_rr1", "lofi")]],
        maxSec: 1,
      },
      sd: {
        variants: [[vd("snare", "center_vl14", "lofi"), vd("snare", "center_vl30", "lofi")]],
        maxSec: 0.8,
      },
      rim: { variants: [[vd("snare", "crossstick_vl10", "lofi")]], maxSec: 0.6 },
      hh: {
        variants: [[vd("hh", "closed_vl2_rr1", "lofi"), vd("hh", "closed_vl4_rr1", "lofi")]],
        maxSec: 0.6,
      },
      oh: { variants: [[vd("hh", "open_vl3_rr1", "lofi")]], maxSec: 1.5 },
      rd: { variants: [[vd("ride", "ride_vl2_rr1", "lofi")]], maxSec: 2.5 },
      cr: { variants: [[vd("crash", "crash_vl2_rr1", "lofi")]], maxSec: 2.5 },
      lt: { variants: [[vd("ltom", "center_vl10", "lofi")]], maxSec: 1.5 },
      ht: { variants: [[vd("htom", "center_vl10", "lofi")]], maxSec: 1.5 },
      ...PERC,
    },
  },
} as const satisfies Record<string, RecordedKitSpec>;

/**
 * Loudness of each role's one-shots (RMS of the first 100 ms, dBFS), the same for every velocity layer:
 * the layer changes the timbre, `velocity` the level. Set against the default kit (uzu-drumkit).
 */
export const ROLE_LEVEL_DB: Record<DrumRole, number> = {
  bd: -8,
  sd: -9.5,
  hh: -23,
  oh: -21,
  cp: -12,
  rim: -16,
  cr: -27,
  rd: -24,
  lt: -12,
  mt: -12,
  ht: -12,
  sh: -24,
  cb: -18,
  tb: -21,
};

// --- hand percussion, textures and foley (one-shot maps of `oak-perc.json`) ----------------------------

export interface OneShotSpec {
  /** Files in `n` order. */
  hits: Mixdown[];
  maxSec: number;
  /** RMS of the first 100 ms (dBFS); null keeps the file's own level (scaled to the group). */
  levelDb: number;
  /** Keep stereo (beds and sweeps). */
  stereo?: boolean;
  /** Freesound pages behind Sonic Pi files (credited per file). */
  origin?: string[];
}

const vcslPerc = (dir: string, files: string[]): Mixdown[] => files.map((f) => one("vcsl", `${dir}/${f}`));
const SP = "etc/samples/";
const sp = (name: string): Mixdown => one("sonicpi", `${SP}${name}.flac`);

export const ONE_SHOTS = {
  conga: {
    hits: vcslPerc("Membranophones/Struck Membranophones/Conga", [
      "Conga_HitN_v2_rr1_Sum.wav",
      "Conga_HitN_v3_rr1_Sum.wav",
      "Conga_HitFM_v2_rr1_Sum.wav",
      "Quinto_HitN_v2_rr1_Sum.wav",
      "Quinto_HitN_v3_rr1_Sum.wav",
      "Quinto_HitFM1_v2_rr1_Sum.wav",
      "Tumba_HitN_v3_rr1_Sum.wav",
      "Tumba_HitFM_v3_rr1_Sum.wav",
    ]),
    maxSec: 1.5,
    levelDb: -14,
  },
  bongo: {
    hits: vcslPerc("Membranophones/Struck Membranophones/Bongos", [
      "BongoH_Hit1_v2_rr1_Mid.wav",
      "BongoH_Hit1_v3_rr1_Mid.wav",
      "BongoH_HitMuted1_v2_rr1_Mid.wav",
      "BongoL_Hit1_v2_rr1_Mid.wav",
      "BongoL_Hit1_v3_rr1_Mid.wav",
      "BongoL_HitMuted2_v2_rr1_Mid.wav",
    ]),
    maxSec: 1,
    levelDb: -14,
  },
  clave: {
    hits: vcslPerc("Idiophones/Struck Idiophones/Claves", [
      "Claves1_Hit_v2_rr1_Mid.wav",
      "Claves1_Hit_v3_rr1_Mid.wav",
      "Claves2_Hit_v2_rr1_Mid.wav",
    ]),
    maxSec: 0.6,
    levelDb: -16,
  },
  // Sonic Pi's CC0 samples (each from freesound.org; the uploader's page is credited).
  vinyl: {
    hits: [sp("vinyl_hiss")],
    maxSec: 12,
    levelDb: -30,
    stereo: true,
    origin: ["https://freesound.org/people/veezay/sounds/130393/"],
  },
  scratch: {
    hits: [sp("vinyl_scratch"), sp("vinyl_rewind")],
    maxSec: 3,
    levelDb: -16,
    origin: [
      "https://freesound.org/people/hello_flowers/sounds/28681/",
      "https://freesound.org/people/TasmanianPower/sounds/162493/",
    ],
  },
  snap: {
    hits: [sp("perc_snap"), sp("perc_snap2")],
    maxSec: 1,
    levelDb: -14,
    origin: [
      "https://freesound.org/people/SoundCollectah/sounds/109400/",
      "https://freesound.org/people/Peram/sounds/158615/",
    ],
  },
  impact: {
    hits: [sp("perc_impact1"), sp("perc_impact2")],
    maxSec: 3,
    levelDb: -12,
    origin: [
      "https://freesound.org/people/hullum/sounds/415578/",
      "https://freesound.org/people/hullum/sounds/415581/",
    ],
  },
  swoosh: {
    hits: [sp("perc_swoosh"), sp("ambi_dark_woosh")],
    maxSec: 4,
    levelDb: -18,
    stereo: true,
    origin: [
      "https://freesound.org/people/hullum/sounds/415580/",
      "https://freesound.org/people/EcoDTR/sounds/27281/",
    ],
  },
  drone: {
    hits: [sp("ambi_drone"), sp("ambi_glass_hum")],
    maxSec: 8,
    levelDb: -22,
    stereo: true,
    origin: [
      "https://freesound.org/people/Autistic%20Lucario/sounds/195341/",
      "https://freesound.org/people/kaligari/sounds/35391/",
    ],
  },
  // perc_till is left out: its freesound page is CC0, but it is built from a CC BY 4.0 recording (UncleSigmund
  // 36328) whose attribution the uploader cannot waive.
  foley: {
    hits: [
      sp("perc_door"),
      sp("perc_swash"),
      sp("glitch_perc1"),
      sp("glitch_perc2"),
      sp("glitch_perc3"),
      sp("glitch_perc4"),
      sp("glitch_perc5"),
      sp("elec_wood"),
      sp("elec_pop"),
      sp("elec_twip"),
      sp("tbd_perc_tap_1"),
    ],
    maxSec: 2,
    levelDb: -14,
    origin: [
      "https://freesound.org/people/hullum/sounds/415579/",
      "https://freesound.org/people/qubodup/sounds/60009/",
      "https://freesound.org/people/hullum/sounds/415548/",
      "https://freesound.org/people/hullum/sounds/415555/",
      "https://freesound.org/people/hullum/sounds/415554/",
      "https://freesound.org/people/hullum/sounds/415553/",
      "https://freesound.org/people/hullum/sounds/415552/",
      "https://freesound.org/people/looppool/sounds/13135/",
      "https://freesound.org/people/looppool/sounds/13134/",
      "https://freesound.org/people/looppool/sounds/13094/",
      "Donated to Sonic Pi by The Black Dog under CC0",
    ],
  },
} as const satisfies Record<string, OneShotSpec>;

// --- wavetables ------------------------------------------------------------------------------------------

/** AKWF single cycles (600 samples each), shipped as they are: `wt_<name>`, `n` picks the file. */
export const AKWF_TABLES: Record<string, string[]> = {
  wt_basic: [
    "AKWF_bw_sin/AKWF_sin_0001",
    "AKWF_bw_tri/AKWF_tri_0001",
    "AKWF_bw_saw/AKWF_saw_0001",
    "AKWF_bw_squ/AKWF_squ_0001",
  ],
  wt_organ: [
    "AKWF_eorgan/AKWF_eorgan_0001",
    "AKWF_eorgan/AKWF_eorgan_0010",
    "AKWF_eorgan/AKWF_eorgan_0025",
    "AKWF_eorgan/AKWF_eorgan_0050",
  ],
  wt_epiano: [
    "AKWF_epiano/AKWF_epiano_0001",
    "AKWF_epiano/AKWF_epiano_0005",
    "AKWF_epiano/AKWF_epiano_0010",
    "AKWF_epiano/AKWF_epiano_0020",
  ],
  wt_bass: ["AKWF_ebass/AKWF_ebass_0001", "AKWF_ebass/AKWF_ebass_0010", "AKWF_ebass/AKWF_ebass_0030"],
  wt_fm: [
    "AKWF_fmsynth/AKWF_fmsynth_0001",
    "AKWF_fmsynth/AKWF_fmsynth_0010",
    "AKWF_fmsynth/AKWF_fmsynth_0030",
  ],
  wt_chip: [
    "AKWF_vgame/AKWF_vgame_0001",
    "AKWF_vgame/AKWF_vgame_0005",
    "AKWF_vgame/AKWF_vgame_0010",
    "AKWF_oscchip/AKWF_oscchip_0001",
    "AKWF_oscchip/AKWF_oscchip_0010",
    "AKWF_oscchip/AKWF_oscchip_0050",
  ],
  wt_voice: ["AKWF_hvoice/AKWF_hvoice_0001", "AKWF_hvoice/AKWF_hvoice_0010", "AKWF_hvoice/AKWF_hvoice_0030"],
  wt_clav: [
    "AKWF_clavinet/AKWF_clavinet_0001",
    "AKWF_clavinet/AKWF_clavinet_0005",
    "AKWF_clavinet/AKWF_clavinet_0010",
  ],
};
