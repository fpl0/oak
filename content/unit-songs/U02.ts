// Song 2, "The riff song" (docs/design/songs/makes-core-a.md §8, U02; AUTHORING §23). C major, 4/4, 96 BPM, one
// chord a bar, C then F, in every section: every U02 Make was written over the two-chord vamp, and a learner's loop
// restarts at the start of each section it plays in, so its first bar always lands on C and its second on F.
// The sections differ by arrangement, not by chords: an opening where the riff plays over the chords and the drums
// and bass come in at bar 3; a riff part with a light groove and a comp that leaves beat 4 empty; a loud part with
// the tune up on the staff and doubled, a crash, a busier groove, bass and comp; the riff part again with one bent
// note and a hand percussion part; a quiet part that drops to whole notes and call and echo, then builds back up;
// the loud part again, its double an octave down; an ending in half-time that brings the opening riff back; and one
// last bar on C (F to C) so the record stops at home.
//
// Oak's tune models each lesson before the learner takes it over (so the song is already the lesson's sound):
// c alone at three heights in the opening (U02.L01), four white keys in the riff part (L02), one black key, B flat,
// in the second riff part (L03), a tune on the staff, F4 to F5, in the loud parts (L04), a copy moved an octave
// down (L05) and a double on another sound (L06), call and echo in the quiet part (L07), a tune in a room at the
// end (L08). The learner writes only the tune in this unit, so the plan hands over the tune section by section.
//
// Every flavour plays the same notes (tune, bass roots, chords); a flavour changes sounds, drum grooves, comp and
// bass rhythms only. U01–U02 stay straight with triads in every flavour (content/flavours.ts FLAVOUR_RULES). Gains
// are levelled by packages/strudel/e2e/songs.pw.ts (budget sound-songs.json), so the learner's line sits on top. Held notes avoid a half step against the chords
// (AUTHORING §13), and the comps leave beat 4 of the riff parts and beats 3–4 of the ending empty, so the lessons'
// own answers (a B flat on beat 4, Ode to Joy's F on beat 3) never rub against a sounding chord tone.
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const SECTIONS = [
  { id: "intro", type: "intro", bars: 4 },
  { id: "verse1", type: "verse", bars: 8 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "bridge", type: "bridge", bars: 8 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 8 },
  // The last bar: the band lands on C together and lets it ring.
  { id: "end", type: "outro", bars: 1 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melVerse`; `melVerse2` for a second verse that plays something else), `silence` where it rests, and one
 * `arrange()` over every section of the song.
 */
function track(label: string, by: BySection, tail: string): { consts: string[]; line: string } {
  const named = new Map<string, string>(); // pattern → const name
  const taken = new Set<string>();
  const consts: string[] = [];
  const entries = SECTIONS.map((section, i) => {
    const pattern = by[section.id];
    if (pattern === null) return `[${section.bars}, silence]`;
    const key = `${section.type}\u0000${pattern}`;
    let name = named.get(key);
    if (name === undefined) {
      const base = `${label}${cap(section.type)}`;
      const nth = SECTIONS.slice(0, i + 1).filter((s) => s.type === section.type).length;
      name = taken.has(base) ? `${base}${nth}` : base;
      taken.add(name);
      named.set(key, name);
      consts.push(`const ${name} = ${pattern}`);
    }
    return `[${section.bars}, ${name}]`;
  });
  return { consts, line: `${label}: arrange(${entries.join(", ")})${tail}` };
}

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Note names, eighth notes to a bar. The riff climbs the chord and steps one higher, then comes back: C E G A G over
// C, F A C D C over F. The opening plays its rhythm on c alone, at c4, c5 and c6. The loud part's tune sits on the
// staff (F4 to F5), leans on the "and" of 2 and of 3, and every note it holds longer than a beat is a chord tone
// (the one-beat D over C passes from E to C). The quiet part
// calls in one bar and echoes it in the next; every call uses only C, D, G and A, which fit both chords.

const C_RIFF = "c4 ~ c5 c5 ~ c6 c5 ~";
const C_RIFF_CUT = "c4 ~ c5 c5 ~ c6 ~ ~";
const RIFF_ON_C = "c4 ~ e4 g4 ~ a4 g4 ~";
const RIFF_ON_C_BENT = "c4 ~ e4 g4 ~ bb4 g4 ~";
const RIFF_ON_F = "f4 ~ a4 c5 ~ d5 c5 ~";
const RIFF_ON_F_CUT = "f4 ~ a4 c5 ~ ~ ~ ~";
const bars = (...b: string[]): string => `<${b.map((x) => `[${x}]`).join(" ")}>`;
const riff = (onC: string): string =>
  bars(onC, RIFF_ON_F, onC, RIFF_ON_F, onC, RIFF_ON_F, onC, RIFF_ON_F_CUT);
const TUNE = bars(
  "e5@3 d5@2 c5@3",
  "a4@3 c5@2 a4@3",
  "g4@3 c5@2 e5@3",
  "f4@3 a4@2 c5@3",
  "e5@3 d5@2 c5@3",
  "a4@3 c5@2 f5@3",
  "e5@3 d5@2 c5@3",
  "a4@6 ~@2",
);
const CALLS = ["c5 a4 g4 ~", "g4 a4 c5 ~", "d5 c5 a4 ~", "g4 a4 c5 d5"];

const MEL: BySection = {
  intro: `note("${bars(C_RIFF, C_RIFF, C_RIFF, C_RIFF_CUT)}").room(.3)`,
  verse1: `note("${riff(RIFF_ON_C)}").room(.25)`,
  chorus1: `note("${TUNE}").room(.3)`,
  verse2: `note("${riff(RIFF_ON_C_BENT)}").room(.25)`,
  bridge: `note("${bars(...CALLS.flatMap((c) => [c, "~"]))}").room(.4)`.replace(/\[~\]/g, "~"),
  chorus2: `note("${TUNE}").room(.3)`,
  outro: `note("${bars(C_RIFF, C_RIFF, C_RIFF, C_RIFF_CUT, C_RIFF, "c4 ~ c5 ~ ~ ~ ~ ~", "c4 ~ c5 ~ ~ ~ ~ ~", "c5")}").room(.5)`,
  end: null,
};
/** The second line: the tune doubled on another sound, an octave down in the last loud part, the quiet part's echo. */
const VOX: BySection = {
  intro: null,
  verse1: null,
  chorus1: `note("${TUNE}")`,
  verse2: null,
  bridge: `note("${bars(...CALLS.flatMap((c) => ["~", c]))}")`.replace(/\[~\]/g, "~"),
  chorus2: `note("${TUNE}").transpose(-12)`,
  outro: null,
  end: null,
};

// ---- Chords (every flavour: the same notes, the rhythm is the kit's) ------------------------------------------
//
// C then F, close and low: C E G to C F A (C stays, E and G step up), and in the loud parts E G C to F A C (C stays
// on top). No chord note sits above C4, so the tune, from C4 up, has the register above the chords to itself.

const LOW = "<[c3,e3,g3] [c3,f3,a3]>";
const HIGH = "<[e3,g3,c4] [f3,a3,c4]>";
const LAST = "[c3,e3,g3,c4]";
const CHORD_NOTES: Readonly<Record<SectionId, string>> = {
  intro: LOW,
  verse1: LOW,
  chorus1: HIGH,
  verse2: LOW,
  bridge: LOW,
  chorus2: HIGH,
  outro: LOW,
  end: LAST,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the riff parts and the ending). */
  banks?: Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; lead: string; vox: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    vox: number;
  };
  /** content/flavours.ts production: the chords' room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: BySection;
  snare: BySection;
  hats: BySection;
  perc: BySection;
  /** Bass notes; the downbeat of every bar is the chord's root, C2 or F2, in every kit. */
  bass: BySection;
  /** The chords' rhythm (`struct`) in each section; `chordSound` changes their sound in a section. */
  comp: Readonly<Record<SectionId, string>>;
  chordSound?: Partial<Record<SectionId, string>>;
  /**
   * Synth controls by section (electronic): the bass's sound and filter (then the bass's sound is named in each
   * section, not on the track), the chords' filter and pump, and the two melody lines' envelope and echo.
   */
  synth?: {
    bassSound: Readonly<Record<SectionId, string>>;
    bass: Readonly<Record<SectionId, string>>;
    chords: Readonly<Record<SectionId, string>>;
    lead: string;
    vox: string;
  };
}

// Grooves shared by the kits: the opening's pickup, the quiet part's build, the ending's half time.
const SNARE_PICKUP = "<~ ~ ~ [~ ~ ~ ~ ~ ~ sd sd]>";
const SNARE_BUILD = "<~!4 [~ ~ sd ~]!2 [sd*8] [sd*16]>";
const HATS_BUILD = "<[hh*4]!4 [hh*8]!2 [hh*16]!2>";
const BASS_BUILD = (four: string, eight: string): string => `<c2 f2 c2 f2 ${four} ${eight}>`;
const COMP_BUILD = "<x!4 [x x x x]!2 [x*8]!2>";
const OUTRO_BASS = "<[c2@3 ~] [f2@3 ~]>";

/** Pop: the default kit, piano, picked bass. The riff parts pump the piano on 1, 2 and 3; the loud parts in eighths. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", vox: "strings" },
  gain: { kick: 0.15, snare: 0.13, hats: 0.08, perc: 0.07, bass: 0.42, chords: 0.19, lead: 0.5, vox: 0.25 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<~ ~ [bd ~ bd ~] [bd ~ bd ~]>"),
    verse1: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    verse2: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("<bd!4 [bd ~ bd ~]!2 [bd bd bd bd]!2>"),
    chorus2: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd ~ ~ bd ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(SNARE_BUILD),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh hh oh]*2", V8),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BUILD),
    chorus2: v("[hh hh hh oh]*2", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    bridge: v("<cr ~!3 [sh*8]!4>"),
    chorus2: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: "<~ ~ [c2 c2] [f2 f2]>",
    verse1: "<[c2@3 c2 c2@3 e2] [f2@3 f2 f2@3 g2]>",
    chorus1: "<[c2 c2 c2 c2 c2 c2 c2 e2] [f2 f2 f2 f2 f2 f2 f2 g2]>",
    verse2: "<[c2@3 c2 c2@3 e2] [f2@3 f2 f2@3 g2]>",
    bridge: BASS_BUILD("[c2*8] [f2*8]", "[c2*8] [f2*8]"),
    chorus2: "<[c2 c2 c2 c2 c2 c2 c2 e2] [f2 f2 f2 f2 f2 f2 f2 g2]>",
    outro: OUTRO_BASS,
    end: "c2",
  },
  comp: {
    intro: "x x",
    verse1: "x x x ~",
    chorus1: "x*8",
    verse2: "x x x ~",
    bridge: COMP_BUILD,
    chorus2: "x*8",
    outro: "x ~",
    end: "x",
  },
};

/** Indie: LinnDrum, clean guitar, acoustic lead. The riff parts sit back (snare on 3); the loud parts go four on the floor. */
const INDIE: Kit = {
  bank: "LinnDrum",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "triangle" },
  gain: { kick: 0.32, snare: 0.28, hats: 0.18, perc: 0.17, bass: 0.44, chords: 0.36, lead: 1, vox: 0.42 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<~ ~ [bd ~ bd ~] [bd ~ bd ~]>"),
    verse1: v("bd ~ ~ ~ ~ bd ~ ~"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ bd ~ ~"),
    bridge: v("<bd!4 [bd ~ ~ ~ ~ bd ~ ~]!2 [bd*4]!2>"),
    chorus2: v("bd*4"),
    outro: v("bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    bridge: v(SNARE_BUILD),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh oh]*4", V8),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BUILD),
    chorus2: v("[hh oh]*4", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    bridge: v("<cr ~!3 [sh*8]!4>"),
    chorus2: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: "<~ ~ [c2 c2] [f2 f2]>",
    verse1: "<[c2@5 c2@3] [f2@5 f2@3]>",
    chorus1: "<[c2 c3]*4 [f2 f3]*4>",
    verse2: "<[c2@5 c2@3] [f2@5 f2@3]>",
    bridge: BASS_BUILD("[c2*8] [f2*8]", "[c2 c3]*4 [f2 f3]*4"),
    chorus2: "<[c2 c3]*4 [f2 f3]*4>",
    outro: OUTRO_BASS,
    end: "c2",
  },
  comp: {
    intro: "x ~ ~ ~ x ~ ~ ~",
    verse1: "x ~ x ~ x x ~ ~",
    chorus1: "x*8",
    verse2: "x ~ x ~ x x ~ ~",
    bridge: COMP_BUILD,
    chorus2: "x*8",
    outro: "x ~ x ~ ~ ~ ~ ~",
    end: "x",
  },
};

/**
 * Jazz-soul: Oak's brushes kit, Rhodes, upright bass, vibes. Straight and in triads until U03 (FLAVOUR_RULES). The riff
 * parts on cross-stick and hats, the loud parts on the snare and the ride; the bass walks root and fifth.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "jazzgtr" },
  gain: { kick: 0.19, snare: 0.33, hats: 0.21, perc: 0.21, bass: 0.63, chords: 0.4, lead: 0.61, vox: 0.63 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd ~ bd ~] [bd ~ bd ~]>"),
    verse1: v("bd ~ ~ bd ~ ~ ~ ~"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    verse2: v("bd ~ ~ bd ~ ~ ~ ~"),
    bridge: v("<bd!4 [bd ~ ~ bd ~ ~ ~ ~]!2 [bd ~ ~ bd bd ~ ~ ~]!2>"),
    chorus2: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd ~ ~ bd ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    bridge: v("<~!4 [~ ~ rim ~]!2 [~ sd ~ sd] [sd*8]>"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ rim ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("~ hh ~ hh"),
    verse2: v("hh*8", V8),
    bridge: v("<[~ hh ~ hh]!4 [hh*8]!4>"),
    chorus2: v("~ hh ~ hh"),
    outro: v("~ hh ~ hh"),
    end: null,
  },
  // The kit has no crash: the ride marks the downbeats and carries the loud parts.
  perc: {
    intro: null,
    verse1: v("<rd ~!7>"),
    chorus1: v("rd*8", V8),
    verse2: v("<[rd, [~ sh ~ sh]] [~ sh ~ sh]!7>"),
    bridge: v("<rd ~!3 [sh*8]!4>"),
    chorus2: v("[rd*8, [~ sh]*4]"),
    outro: v("<rd ~!7>"),
    end: v("rd"),
  },
  bass: {
    intro: "<~ ~ [c2 g2] [f2 c3]>",
    verse1: "<[c2@3 c2 g2@3 ~] [f2@3 f2 c3@3 ~]>",
    chorus1: "<[c2@3 c2 e2@2 g2@2] [f2@3 f2 a2@2 c3@2]>",
    verse2: "<[c2@3 c2 g2@3 ~] [f2@3 f2 c3@3 ~]>",
    bridge: BASS_BUILD("[c2@3 c2 g2@3 ~] [f2@3 f2 c3@3 ~]", "[c2@3 c2 e2@2 g2@2] [f2@3 f2 a2@2 c3@2]"),
    chorus2: "<[c2@3 c2 e2@2 g2@2] [f2@3 f2 a2@2 c3@2]>",
    outro: OUTRO_BASS,
    end: "c2",
  },
  comp: {
    intro: "x x",
    verse1: "x@3 x@3 ~@2",
    chorus1: "x@3 x@3 x@2",
    verse2: "x@3 x@3 ~@2",
    bridge: "<x!4 [x@3 x@3 ~@2]!2 [x@3 x@3 x@2]!2>",
    chorus2: "x@3 x@3 x@2",
    outro: "x@3 x ~@4",
    end: "x",
  },
};

const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FUNK_BASS_C = "c2 ~ ~ c2 ~ ~ c3 ~ ~ ~ c2 ~ ~ ~ ~ ~";
const FUNK_BASS_F = "f2 ~ ~ f2 ~ ~ f3 ~ ~ ~ f2 ~ ~ ~ ~ ~";
const FUNK_PUSH_C = "c2 ~ c3 c2 ~ ~ c3 ~ c2 ~ c2 ~ c3 ~ ~ ~";
const FUNK_PUSH_F = "f2 ~ f3 f2 ~ ~ f3 ~ f2 ~ f2 ~ f3 ~ ~ ~";
const FUNK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FUNK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";

/**
 * Funk: the 808, clavinet, finger bass, organ lead, horns on the second line. Sixteenths, straight; the kick and the
 * octave-popping bass lock on 1, the "a" of 1, the "and" of 2 and the "and" of 3. In the quiet part strings hold the
 * chords before the clavinet comes back for the build.
 */
const FUNK: Kit = {
  bank: "RolandTR808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "horns" },
  gain: { kick: 0.31, snare: 0.11, hats: 0.07, perc: 0.05, bass: 0.55, chords: 0.3, lead: 0.9, vox: 0.57 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<~ ~ [${FUNK_KICK}]!2>`),
    verse1: v(FUNK_KICK),
    chorus1: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    verse2: v(FUNK_KICK),
    bridge: v(`<bd!4 [${FUNK_KICK}]!2 [bd ~ bd ~ bd ~ bd ~]!2>`),
    chorus2: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    outro: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>"),
    verse1: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus1: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    verse2: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    bridge: v(SNARE_BUILD),
    chorus2: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*16] [hh*16]>", V16),
    verse1: v("hh*16", V16),
    chorus1: v("[hh hh hh hh hh hh oh hh]*2", V16),
    verse2: v("hh*16", V16),
    bridge: v(HATS_BUILD),
    chorus2: v("[hh hh hh hh hh hh oh hh]*2", V16),
    outro: v("hh*8", V8),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    verse2: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!7>"),
    bridge: v("<cr ~!3 [sh*8]!4>"),
    chorus2: v("<[cr, [~ cb]*4] [[~ cb]*4]!3 [cr, [~ cb]*4] [[~ cb]*4]!3>"),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: `<~ ~ [${FUNK_BASS_C}] [${FUNK_BASS_F}]>`,
    verse1: `<[${FUNK_BASS_C}] [${FUNK_BASS_F}]>`,
    chorus1: `<[${FUNK_PUSH_C}] [${FUNK_PUSH_F}]>`,
    verse2: `<[${FUNK_BASS_C}] [${FUNK_BASS_F}]>`,
    bridge: BASS_BUILD(`[${FUNK_BASS_C}] [${FUNK_BASS_F}]`, `[${FUNK_PUSH_C}] [${FUNK_PUSH_F}]`),
    chorus2: `<[${FUNK_PUSH_C}] [${FUNK_PUSH_F}]>`,
    outro: OUTRO_BASS,
    end: "c2",
  },
  comp: {
    intro: "~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~",
    verse1: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    chorus1: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    verse2: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    bridge: "<x!4 [x x x x]!2 [x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~]!2>",
    chorus2: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    outro: "x ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",
    end: "x",
  },
  chordSound: { bridge: "<strings!4 clav!4>" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. The octave jumps fall between the beats; every
// downbeat is the chord's root, C2 or F2, as in every kit.
const ACID_C = "c2 ~ c2 c3 c2 ~ c2 ~ c2 ~ c3 c2 c2 ~ ~ c2";
const ACID_F = "f2 ~ f2 f3 f2 ~ f2 ~ f2 ~ f3 f2 f2 ~ ~ f2";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/**
 * The 808 kick (funk's `RolandTR808`, the electronic `oak808`) rings for seconds with no choke: hits a beat apart pile
 * up, by up to 7 dB and by the tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9
 * at 96). A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** A supersaw pad struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: Oak's 909-style machine and the lo-fi kit. The riff parts sit on the lo-fi kit, a broken boom-bap beat
 * over a sine sub and off-beat stabs that leave beat 4 empty; the loud parts go four on the floor on the 909 with the
 * acid line and pumping stabs; the quiet part swells on a supersaw pad and builds into the acid; the ending is half
 * time on the lo-fi kit over the sub. A square pluck with a dotted-eighth echo plays the tune, a supersaw lead the
 * second line. Straight and in triads, like every kit in U02.
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", outro: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", vox: "supersaw" },
  gain: { kick: 0.24, snare: 0.08, hats: 0.05, perc: 0.05, bass: 0.39, chords: 0.16, lead: 0.48, vox: 0.35 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd*4] [bd*4]>"),
    verse1: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v("<bd!4 [bd ~ bd ~]!2 [bd*4]!2>"),
    chorus2: v("bd*4"),
    outro: v("bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(SNARE_BUILD),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh hh oh hh]*4 [hh hh oh hh]*4>", V16),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh oh hh]*4", V16),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BUILD),
    chorus2: v("[hh hh oh hh]*4", V16),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    chorus1: v("<cr ~!3 cr ~!3>"),
    verse2: v("<[cr, [~ sh ~ sh]] [~ sh ~ sh]!7>"),
    bridge: v("<cr ~!5 [~ ~ [lt lt] [ht ht]] [~ ~ [lt lt] [ht ht]]>"),
    chorus2: v("<cr ~!3 cr ~!3>"),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: "<~ ~ [c2@2 c2@2] [f2@2 f2@2]>",
    verse1: "<[c2@6 c2@2] [f2@6 f2@2]>",
    chorus1: `<[${ACID_C}] [${ACID_F}]>`,
    verse2: "<[c2@6 c2@2] [f2@6 f2@2]>",
    bridge: BASS_BUILD("[c2*8] [f2*8]", `[${ACID_C}] [${ACID_F}]`),
    chorus2: `<[${ACID_C}] [${ACID_F}]>`,
    outro: OUTRO_BASS,
    end: "c2",
  },
  comp: {
    intro: "x*4",
    verse1: "~ x ~ x ~ x ~ ~",
    chorus1: "x*8",
    verse2: "~ x ~ x ~ x ~ ~",
    bridge: COMP_BUILD,
    chorus2: "x*8",
    outro: "~ x ~ x ~ ~ ~ ~",
    end: "x",
  },
  chordSound: { intro: "supersaw", bridge: "<supersaw!4 sawtooth!4>" },
  synth: {
    bassSound: {
      intro: "sine",
      verse1: "sine",
      chorus1: "sawtooth",
      verse2: "sine",
      bridge: "<sine!4 sawtooth!4>",
      chorus2: "sawtooth",
      outro: "sine",
      end: "sine",
    },
    bass: {
      intro: SUB,
      verse1: SUB,
      chorus1: ACID,
      verse2: SUB,
      // The whole notes on the sub, then the build on the acid line.
      bridge:
        '.lpq(12).ftype("ladder").lpenv("<0!4 3!4>").lpd(.14).lps(0).decay("<1.2!4 .2!4>").sustain("<.7!4 .4!4>")',
      chorus2: ACID,
      outro: SUB,
      end: SUB,
    },
    chords: {
      intro: PAD,
      verse1: STAB,
      chorus1: `${STAB}${PUMP}`,
      verse2: STAB,
      bridge: '.attack("<.12!4 0!4>").lpf(1800).lpenv(2).lpd(.12).decay(.4).sustain(.5)',
      chorus2: `${STAB}${PUMP}`,
      outro: STAB,
      end: ".lpf(1800).decay(1.5).sustain(.5)",
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.47).delayfeedback(.35)",
    vox: ".unison(5).detune(.2).lpf(3000).decay(.3).sustain(.5)",
  },
};

const KITS: Readonly<Record<FlavourId, Kit>> = {
  "flavour.pop": POP,
  "flavour.indie": INDIE,
  "flavour.jazz-soul": JAZZ,
  "flavour.funk": FUNK,
  "flavour.electronic": ELECTRONIC,
};

const mapSections = (f: (id: SectionId) => string | null): BySection =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, string | null>;

/** One flavour's song: the tune first, then the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${CHORD_NOTES[id]}").struct("${k.comp[id]}").s("${sound}")${syn?.chords[id] ?? ""}`;
  });
  const bass = mapSections((id) => {
    const line = k.bass[id];
    if (line === null) return null;
    return syn ? `note("${line}").s("${syn.bassSound[id]}")${syn.bass[id]}` : `note("${line}")`;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: BySection): BySection =>
    k.banks
      ? mapSections((id) => (by[id] === null ? null : `${by[id]}.bank("${k.banks?.[id] ?? k.bank}")`))
      : by;
  const tracks = [
    track(
      "mel",
      MEL,
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)})`,
    ),
    track(
      "vox",
      VOX,
      `.s("${k.sounds.vox}")${syn?.vox ?? ""}.gain(${num(k.gain.vox)}).pan(.45).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track("bass", bass, `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`),
    track(
      "kick",
      drums(k.kick),
      `${bank}${/^(RolandTR808|oak808)$/.test(k.bank) ? KICK_808 : ""}.gain(${num(k.gain.kick)})`,
    ),
    track("snare", drums(k.snare), `${bank}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc), `${bank}.gain(${num(k.gain.perc)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: SectionId[],
  parts: SongPartId[],
  startFrom: TakeStep["startFrom"],
  today: string,
): TakeStep => ({ lesson, kind: "take", sections, parts, startFrom, today });

export const U02_SONG = defineUnitSong({
  id: "usong.U02",
  unit: "U02",
  version: 1,
  title: "The riff song",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 96,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "vox", label: "vox", role: "melody", name: "Second line", plainName: "Second line" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
    { id: "kick", label: "kick", role: "drums", sounds: ["bd"], name: "Kick", plainName: "Kick" },
    {
      id: "snare",
      label: "snare",
      role: "drums",
      sounds: ["sd", "rim", "cp"],
      name: "Snare",
      plainName: "Snare",
    },
    { id: "hats", label: "hats", role: "drums", sounds: ["hh", "oh"], name: "Hi-hats", plainName: "Hi-hats" },
    {
      id: "perc",
      label: "perc",
      role: "drums",
      sounds: ["cr", "rd", "lt", "mt", "ht", "sh", "cb", "tb"],
      name: "Cymbals and percussion",
      plainName: "Cymbals and percussion",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // By part (AUTHORING §23.6): the learner writes the tune, so each step hands over the tune of one or two sections,
  // and the second line wherever Oak's double or echo would sound against the learner's own tune.
  plan: [
    take(
      "U02.L01",
      ["intro"],
      ["lead"],
      "oak",
      "Your riff on c opens the song, in place of Oak's tune in the first four bars.",
    ),
    take(
      "U02.L02",
      ["verse1"],
      ["lead"],
      "oak",
      "Your white-key riff takes over the tune in the second part of the song.",
    ),
    take(
      "U02.L03",
      ["verse2"],
      ["lead"],
      "U02.L02",
      "Your riff from The White Keys comes back in the fourth part, with one black key in it.",
    ),
    take(
      "U02.L04",
      ["chorus1"],
      ["lead", "vox"],
      "oak",
      "Your own tune, higher than the riffs, takes over the first loud part of the song.",
    ),
    take(
      "U02.L05",
      ["chorus2"],
      ["lead", "vox"],
      "U02.L04",
      "Your tune from The Treble Staff plays the last loud part too, with a moved copy beside it.",
    ),
    take(
      "U02.L06",
      ["chorus1"],
      ["lead", "vox"],
      "U02.L04",
      "Your tune in the first loud part gets a second line: the same notes on another sound.",
    ),
    take(
      "U02.L07",
      ["bridge"],
      ["lead", "vox"],
      "oak",
      "Your short call fills the quiet part before the last loud part, with gaps for you to sing back.",
    ),
    take(
      "U02.L08",
      ["outro"],
      ["lead"],
      "oak",
      "A tune you read off the page, placed in a room, ends your song.",
    ),
  ],
  releaseAfter: "U02.CP",
});

export default U02_SONG;
