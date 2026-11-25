// What sound pack v5 adds to the v4 library (library.ts): new upstream sources, new variants appended to the
// recorded kits, and new one-shots. Read by mirror.ts and credits.ts only.
//
// Why a separate file: library.ts is part of the pitched and kit recipes (recipe.ts hashes it), so any edit
// there, even one new source, would change the recipe of every v4 instrument and kit file and re-render all of
// them. The v4 sounds must stay byte-identical in v5 (scripts/sounds/v5-lock.test.ts). Everything that shapes a
// v5 file's audio is still in its recipe: the data below (hit, level, length) goes into the recipe JSON, and
// the render code (render.ts and what it imports) into its code hash, exactly as for a v4 file.
//
// Indices are appended, never inserted: a v4 index plays what it played in v4. An index at or past a role's v4
// variant count used to wrap (superdough's getSoundIndex) and now plays the new variant: for the hats that is the
// round-robin twin of variant 0 (what the index wrapped to before), for the snares a soft stroke where it used to
// wrap to variant 0's full stroke (no song, Band or lesson asks a kit for those indices: grep, 2026-11-25).
//
// Matched pairs and soft strokes (the indices lessons and songs may rely on; "matched" = the same stroke,
// microphones and velocity layers, another take: for alternating hands):
//   jazzkit  hh:0 / hh:2   closed hats, Virtuosity rr1 / rr2   (hh:1 is the pedal hat: NOT a pair with hh:0)
//   rockkit  hh:0 / hh:2   tip-closed hats, Big Rusty rr1 / rr2 (hh:1 is the foot "chik": NOT a pair)
//   lofikit  hh:0 / hh:1   closed hats, Virtuosity lo-fi mic rr1 / rr2
//   jazzkit  sd:3          a soft brush tap (Swirly velocity 1/2 of 12)
//   rockkit  sd:2          a soft stick stroke (Big Rusty centre, velocity 1/2 of 10)
//   lofikit  sd:1          a soft stick stroke (Virtuosity lo-fi mic, centre, velocity 4/8 of 36)
// Measured on the v4 files (2026-11-25): no v4 kit has a matched hat pair. jazzkit hh:0 (closed) and hh:1
// (pedal) differ by 2-6 kHz in spectral centroid and 150-260 ms in decay; rockkit hh:0 (tip) and hh:1 (chik)
// by 1-1.7 kHz; oak909/oak808 hh:1 is a longer hat than hh:0. The synthesised kits' pairs and soft strokes come
// from synth-v5.ts (X13) when it lands.
//
// The soft strokes' levels (8-11 dB under the loud stroke of the same role) are Oak's call, not a rule of
// drumming: a ghost note is a stroke played softly, so it is darker and shorter as well as quieter. Every level
// and length in this file is "listen first" (docs/decisions.md): set by measurement, never heard.

import type { DrumRole, OneShotSpec, Source, SourceId } from "./library.ts";

const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

/**
 * Sources new in v5. Each licence was read on 2026-11-25 (scratchpad hand-back w2-task6.md has the evidence):
 * - kenney: kenney.nl/assets/voiceover-pack lists the pack's licence as "Creative Commons CC0"; kenney.nl/support
 *   says "all game assets on the asset pages are public domain licensed (CC0)" and "Attribution is not
 *   required". Kenney's own download is behind a page script, so the files come from a Godot port that ships
 *   the same 92 lines (Kenney's page says 90 files) under the CC0 1.0 legal code (its LICENSE file at the
 *   pinned commit). Could not verify that the port's files are byte-identical to Kenney's own zip.
 */
export const SOURCES_V5 = {
  kenney: {
    kind: "github",
    repo: "Boyquotes/kenney-voiceover-fighter-for-godot",
    commit: "08f93f0697459505e83f351f0e532115ca0550da",
    credit: {
      title: "Voiceover Pack (Kenney), as ported to Godot by Loppansson",
      author: "Kenney (www.kenney.nl)",
      url: "https://kenney.nl/assets/voiceover-pack",
      licence: "CC0-1.0",
      licenceUrl: CC0,
    },
  },
} as const satisfies Record<string, Source>;

export type SourceIdV5 = SourceId | keyof typeof SOURCES_V5;

/** One upstream file, from a v4 source or a v5 one. */
export interface SrcRefV5 {
  src: SourceIdV5;
  path: string;
}

/** Several microphones of one hit, summed at fixed gains (the v5 twin of library.ts `Mixdown`). */
export interface MixdownV5 {
  mics: { ref: SrcRefV5; gain: number }[];
}

const ref = (src: SourceIdV5, path: string): SrcRefV5 => ({ src, path });
const one = (src: SourceIdV5, path: string): MixdownV5 => ({ mics: [{ ref: ref(src, path), gain: 1 }] });

// The microphone mixes are the ones library.ts uses for the same kit and stroke (kept equal on purpose, so a
// twin sounds like its partner; library.ts's helpers are not exported, and importing a value from it here would
// tie this file into the v4 recipes' code hash).
const VD_MICS: Record<string, Record<string, number>> = {
  snare: { snaremic: 1, oh: 0.55, room: 0.35 },
  hh: { oh: 1, snaremic: 0.25, room: 0.3 },
};
function vd(group: string, name: string, only?: string): MixdownV5 {
  const mics = only ? { [only]: 1 } : (VD_MICS[group] as Record<string, number>);
  return {
    mics: Object.entries(mics).map(([mic, gain]) => ({
      ref: ref("virtuosity", `Samples/${mic}/${group}/${mic}_${group}_${name}.flac`),
      gain,
    })),
  };
}
const swirly = (dir: string, name: string): MixdownV5 => ({
  mics: [
    { ref: ref("swirly", `Samples/${dir}/${name}_top.wav`), gain: 1 },
    { ref: ref("swirly", `Samples/${dir}/${name}_btm.wav`), gain: 0.45 },
  ],
});
const BR_MICS: Record<string, Record<string, number>> = {
  snare: { top: 1, btm: 0.45, oh: 0.55 },
  cym: { cl: 0.7, oh: 1 },
};
function br(dir: string, file: string, mics: keyof typeof BR_MICS): MixdownV5 {
  return {
    mics: Object.entries(BR_MICS[mics] as Record<string, number>).map(([mic, gain]) => ({
      ref: ref("bigrusty", `Samples/${dir}/${mic}/${file}`),
      gain,
    })),
  };
}

/** Variants appended to one role of a recorded kit (same shape as library.ts `KitRoleSpec`). */
export interface KitAddition {
  /** New variants, in `n` order after the v4 ones; each with its velocity layers, soft first. */
  variants: MixdownV5[][];
  maxSec: number;
  /** Level of each new variant (RMS of the first 100 ms, dBFS), as library.ts `levelDb`. */
  levelDb: number[];
}

/** Recorded-kit additions: `kit -> role -> appended variants`. */
export const KIT_ADDITIONS: Record<string, Partial<Record<DrumRole, KitAddition>>> = {
  jazzkit: {
    // hh:2, the twin of hh:0 (closed, Virtuosity velocity 2 and 4, round-robin 2); the role's v4 level
    hh: { variants: [[vd("hh", "closed_vl2_rr2"), vd("hh", "closed_vl4_rr2")]], maxSec: 1, levelDb: [-35] },
    // sd:3, a soft brush tap: Swirly velocity 1 and 2 (of 12), 10 dB under sd:0's -8
    sd: {
      variants: [[swirly("snare_main", "snare_hit_vl1_rr1"), swirly("snare_main", "snare_hit_vl2_rr1")]],
      maxSec: 1,
      levelDb: [-18],
    },
  },
  rockkit: {
    // hh:2, the twin of hh:0 (tip-closed, velocity 3 and 7, round-robin 2); ROLE_LEVEL_DB.hh
    hh: {
      variants: [
        [br("hihat_14/tc", "ht_tc_vl3_rr2.flac", "cym"), br("hihat_14/tc", "ht_tc_vl7_rr2.flac", "cym")],
      ],
      maxSec: 1,
      levelDb: [-23],
    },
    // sd:2, a soft centre stroke: velocity 1 and 2 (of 10), 10 dB under ROLE_LEVEL_DB.sd
    sd: {
      variants: [
        [
          br("snare_14/center", "sn_center_vl1_rr1.flac", "snare"),
          br("snare_14/center", "sn_center_vl2_rr1.flac", "snare"),
        ],
      ],
      maxSec: 0.8,
      levelDb: [-19.5],
    },
  },
  lofikit: {
    // hh:1, the twin of hh:0 (closed, lo-fi microphone, velocity 2 and 4, round-robin 2)
    hh: {
      variants: [[vd("hh", "closed_vl2_rr2", "lofi"), vd("hh", "closed_vl4_rr2", "lofi")]],
      maxSec: 0.6,
      levelDb: [-23],
    },
    // sd:1, a soft centre stroke: velocity 4 and 8 (of 36), 10 dB under ROLE_LEVEL_DB.sd
    sd: {
      variants: [[vd("snare", "center_vl4", "lofi"), vd("snare", "center_vl8", "lofi")]],
      maxSec: 0.6,
      levelDb: [-19.5],
    },
  },
};

/** A v5 one-shot: library.ts `OneShotSpec` with v5 refs. */
export interface OneShotSpecV5 extends Omit<OneShotSpec, "hits"> {
  hits: MixdownV5[];
  /** The pack group it is reported under (mirror.ts). */
  group: "perc" | "textures" | "voice";
}

const KENNEY = "addons/kenney voiceover pack/voice type 1/";
const kenney = (line: string): MixdownV5 => one("kenney", `${KENNEY}${line}.ogg`);
const VCSL_GUIRO = "Idiophones/Struck Idiophones/Guiro/";

/** New one-shot names (each a new `oak-perc.json` key, after the v4 ones). */
export const ONE_SHOTS_V5: Record<string, OneShotSpecV5> = {
  // Spoken words (A2.L04 "Speed changes the rhythm" / "Tap the words"): a count-in, then short lines whose
  // syllables make a rhythm. One voice ("voice type 1") throughout. The pack's "war_*" lines are left out.
  speech: {
    hits: [
      "1",
      "2",
      "3",
      "4",
      "ready",
      "set",
      "go",
      "level_up",
      "hurry_up",
      "congratulations",
      "mission_completed",
      "objective_achieved",
      "new_highscore",
    ].map(kenney),
    maxSec: 2.5,
    levelDb: -16,
    group: "voice",
  },
  // Brushes on their own: brush:0 a sweep (a stir, round-robin 2: jazzkit sd:2 is round-robin 1), brush:1 a
  // soft tap, brush:2 a firm tap (Swirly velocity 4 and 10, round-robin 2; jazzkit sd:0 is round-robin 1).
  brush: {
    hits: [
      one("swirly", "Samples/snare_stir/stir_dl1_rr2.wav"),
      swirly("snare_main", "snare_hit_vl4_rr2"),
      swirly("snare_main", "snare_hit_vl10_rr2"),
    ],
    maxSec: 4,
    levelDb: -22,
    group: "perc",
  },
  // VCSL güiro: two short scrapes (two takes), a fast one, a slow one.
  guiro: {
    hits: [
      one("vcsl", `${VCSL_GUIRO}Guiro_Hit_rr1_Mid.wav`),
      one("vcsl", `${VCSL_GUIRO}Guiro_Hit_rr2_Mid.wav`),
      one("vcsl", `${VCSL_GUIRO}Guiro_Fast_rr1_Mid.wav`),
      one("vcsl", `${VCSL_GUIRO}Guiro_Slow_rr2_Mid.wav`),
    ],
    maxSec: 2,
    levelDb: -16,
    group: "perc",
  },
  // VSCO 2 CE old trombone falls (a brass fall: the note drops away at the end of a phrase), on B flat 2 and F 2.
  fall: {
    hits: [
      one("vsco", "Brass/OldTrombone/Fall/Trombone_Fall_A#2_1.wav"),
      one("vsco", "Brass/OldTrombone/Fall/Trombone_Fall_F2_1.wav"),
    ],
    maxSec: 2.5,
    levelDb: -16,
    group: "perc",
  },
};

/** Hits appended to v4 one-shot names (new indices after the v4 ones; the v4 spec's level and length). */
export const ONE_SHOT_APPENDS: Record<string, MixdownV5[]> = {
  // impact:2, an acoustic impact: VCSL concert bass drum, loudest dynamic
  impact: [one("vcsl", "Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v7_rr1_Sum.wav")],
  // swoosh:2, a natural "reverse cymbal": a suspended cymbal rolled from nothing to loud in 2 s (VCSL). Could
  // not verify where its peak falls against the 4 s trim of `swoosh` (listen first).
  swoosh: [one("vcsl", "Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_cresc_2s.wav")],
};

/** What Oak did to the new sources' files (credits.ts). */
export const MODIFIED_V5: Record<keyof typeof SOURCES_V5, string> = {
  kenney: "selected lines; decoded from Ogg Vorbis; trimmed; levelled; FLAC",
};
