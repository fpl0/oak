// Song 4, "Side by side" (docs/design/songs/makes-core-a.md §8, U04 "harmony vocals"; AUTHORING §23). C major, 4/4,
// 92 BPM. U04 is the second voice: every Make writes a line, or pairs of notes, against a tune, so Oak's song is a
// tune that keeps finding partners. Every U04 Make was written over the two-chord vamp (C, then F) and a learner's
// loop restarts at the start of each section it plays in, so every section the learner takes is one chord a bar,
// C then F: the loop's bar 1 always lands on C and its bar 2 on F. The only other chords are the one-bar stop on G
// (its B and F, the tritone, pull to the C and E of the last loud part) and the last bar on C.
//
// The form, 54 bars (2:21 at 92 BPM):
//
//   intro 4 · verse1 8 · chorus1 8 · verse2 8 · bridge 8 · stop 1 · chorus2 8 · outro 8 · end 1
//   (C F)×2   (C F)×4   (C F)×4     (C F)×4   (C F)×4   G        (C F)×4     (C F)×4   C
//
// - The opening: a riff, C E G E over C, answered a 4th higher, F A C A over F (U04.L04's idea), over held chords;
//   drums and bass come in at bar 3, a snare pickup in bar 4.
// - The first quiet part: Oak's tune alone, low (C4–C5), the tune U04.L01's Make starts from (C E G E, F E D).
// - The loud parts: a high tune, F4–E5, in a 3+3+2 rhythm (C G C, A G F, C D E, D C A…), with a second voice a
//   perfect 5th above every note (U04.L02's idea: one named distance), crash, clap, busier bass and comp.
// - The second quiet part: the first quiet part's tune with a second voice a 3rd above it in the key (U04.L01's idea).
// - The quiet part before the last loud part (the bridge): no tune and no chords, only pairs of notes played
//   together over the bass and a half-time groove (U04.L03's idea). Twice it leans on the tritone (B with F over the F
//   bar, then F with B) and lets go to C with E on the next downbeat; bars 7–8 build.
// - The stop: the band hits G on beat 1 (bass G2, chords, and the pair B3 F4, the tritone inside G7), the tune picks
//   up G A B into the last loud part.
// - The ending: the opening riff and its answer, now with a second voice a 3rd above, half time, then the last bar
//   on C with both voices holding C5 and E5.
//
// Clashes (AUTHORING §13, spec §5.1), read from the evaluated events: every tune and second-voice note held a beat
// or more sits on a chord tone, or a 2nd, 6th or 7th above one, never a half step above a chord tone (no F over the
// C bar, no B flat or F sharp over F); every bass note is a root, a fifth or an octave (jazz-soul's walking notes
// are chord tones). Chords are close and low, never above C4 (D4 in jazz-soul's F6 and G7), so the tune (from C4)
// and the second voice sit above them: C (C3 E3 G3, loud parts E3 G3 C4), F (C3 F3 A3, loud parts F3 A3 C4), G (D3
// G3 B3). Jazz-soul colours I and IV as the U03-on Bands do, with sixths, never major sevenths (C6 C3 E3 G3 A3, F6
// F3 A3 C4 D4, G7 F3 G3 B3 D4), and swings. Funk stays in triads with a sixteenth feel and electronic in triads,
// straight (contracts §5.10 at U04).
//
// One builder writes all five flavours (AUTHORING §23.2), so the roots, the bass downbeats and the tune cannot drift.
// Gains stay at or under the kit's Bands (content/bands/index.ts KITS) and at or under U01/U02.
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
  // One bar on G: the band hits once, the tune picks up into the last loud part.
  { id: "stop", type: "break", bars: 1 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 8 },
  // The last bar: both voices and the band land on C together.
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
 * (`melVerse`; `melOutro2` for a second ending that plays something else), `silence` where it rests, and one
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

const bars = (...b: string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- The tune and the second voice (every flavour) ----------------------------------------------------------
//
// The opening riff climbs the C chord and comes back, then answers itself a perfect 4th higher on F, every note
// moved by five half steps (U04.L04's Make, as its minimal answer writes it).
const RIFF_C = "c4 e4 g4 e4";
const RIFF_F = "f4 a4 c5 a4";
/** The riff with a second voice a 3rd above in the key (two degrees up): E G B G, A C E C. */
const RIFF_C_3RD = "e4 g4 b4 g4";
const RIFF_F_3RD = "a4 c5 e5 c5";

// The quiet parts' tune, low (C4–C5). Bars 1–2 are U04.L01's starter (degrees 1 3 5 3 | 4 3 2), so its Make opens
// with Oak's own tune. The second voice of the second quiet part is every note two degrees up, a 3rd above in C.
const VERSE = bars(
  "c4 e4 g4 e4",
  "f4 e4 d4 ~",
  "e4 g4 [c5 b4] g4",
  "a4 g4 f4 ~",
  "c4 e4 g4 e4",
  "f4 e4 d4 ~",
  "g4 e4 c4 [d4 e4]",
  "f4@3 ~",
);
const VERSE_3RD = bars(
  "e4 g4 b4 g4",
  "a4 g4 f4 ~",
  "g4 b4 [e5 d5] b4",
  "c5 b4 a4 ~",
  "e4 g4 b4 g4",
  "a4 g4 f4 ~",
  "b4 g4 e4 [f4 g4]",
  "a4@3 ~",
);

// The loud parts' tune, F4–E5, three notes a bar in a 3+3+2 rhythm (dotted quarter, dotted quarter, quarter). It uses
// no B, so the second voice, every note a perfect 5th higher (`.transpose(7)`, seven half steps: U04.L02's starter),
// stays in C major: G D G, E D C, G A B, A G E…
const CHORUS = bars(
  "c5@3 g4@3 c5@2",
  "a4@3 g4@3 f4@2",
  "c5@3 d5@3 e5@2",
  "d5@3 c5@3 a4@2",
  "c5@3 g4@3 c5@2",
  "a4@3 g4@3 f4@2",
  "g4@3 e5@3 d5@2",
  "c5@6 ~@2",
);

const MEL: BySection = {
  intro: `note("${bars(RIFF_C, RIFF_F, RIFF_C, RIFF_F)}")`,
  verse1: `note("${VERSE}")`,
  chorus1: `note("${CHORUS}")`,
  verse2: `note("${VERSE}")`,
  bridge: null,
  stop: `note("~ ~ ~ ~ ~ g4 a4 b4")`,
  chorus2: `note("${CHORUS}")`,
  outro: `note("${bars(RIFF_C, RIFF_F, RIFF_C, RIFF_F, RIFF_C, RIFF_F, RIFF_C, "f4 a4 c5@2")}").room(.4)`,
  end: `note("c5")`,
};
const VOX: BySection = {
  intro: null,
  verse1: null,
  chorus1: `note("${CHORUS}").transpose(7)`,
  verse2: `note("${VERSE_3RD}")`,
  bridge: null,
  stop: null,
  chorus2: `note("${CHORUS}").transpose(7)`,
  outro: `note("${bars(RIFF_C_3RD, RIFF_F_3RD, RIFF_C_3RD, RIFF_F_3RD, RIFF_C_3RD, RIFF_F_3RD, RIFF_C_3RD, "a4 c5 e5@2")}").room(.4)`,
  end: `note("e5")`,
};

// ---- Pairs of notes played together (the bridge) ------------------------------------------------------------
//
// U04.L03's idea, eight bars: pairs at rest (C–E, C–G, E–C, C–A, F–A) and, at the end of every F bar, the tritone, B
// with F or F with B, which lets go on the next downbeat (B→C, F→E). The last bar holds B–F into the stop, where it is
// the middle of G7 and pulls into the last loud part.
const KEYS_BRIDGE = bars(
  "[c4,e4]@3 [c4,e4]@3 [c4,g4]@2",
  "[c4,a4]@3 [c4,a4]@3 [b3,f4]@2",
  "[c4,e4]@3 [e4,g4]@3 [e4,c5]@2",
  "[f4,a4]@3 [f4,a4]@3 [f4,b4]@2",
  "[e4,c5]@3 [e4,c5]@3 [c4,g4]@2",
  "[c4,a4]@3 [c4,a4]@3 [b3,f4]@2",
  "[c4,e4]@3 [e4,g4]@3 [e4,c5]@2",
  "[c4,a4]@3 [b3,f4]@5",
);
const KEYS: BySection = {
  intro: null,
  verse1: null,
  chorus1: null,
  verse2: null,
  bridge: `note("${KEYS_BRIDGE}")`,
  stop: `note("[b3,f4]@2 ~ ~")`,
  chorus2: null,
  outro: null,
  end: null,
};

// ---- Chords (every flavour: the same roots; the rhythm is the kit's) ----------------------------------------
//
// C then F, close and low: C E G to C F A (C stays, E and G step up), and in the loud parts E G C to F A C (C stays
// on top). G on the stop. No chord note sits above C4 (D4 in jazz-soul's F6 and G7). Jazz-soul colours I and IV
// with the 6th, as its Bands do from U03 (content/bands/index.ts TWO_SIXTHS): C6 and F6, never a major 7th under the tune.
interface ChordSet {
  low: string;
  high: string;
  stop: string;
  last: string;
}
const TRIADS: ChordSet = {
  low: "<[c3,e3,g3] [c3,f3,a3]>",
  high: "<[e3,g3,c4] [f3,a3,c4]>",
  stop: "[d3,g3,b3]",
  last: "[c3,e3,g3,c4]",
};
const SIXTHS: ChordSet = {
  low: "<[c3,e3,g3,a3] [f3,a3,c4,d4]>",
  high: "<[e3,g3,a3,c4] [f3,a3,c4,d4]>",
  stop: "[f3,g3,b3,d4]",
  last: "[c3,e3,g3,a3,c4]",
};
const chordNotes = (set: ChordSet): BySection => ({
  intro: set.low,
  verse1: set.low,
  chorus1: set.high,
  verse2: set.low,
  bridge: null,
  stop: set.stop,
  chorus2: set.high,
  outro: set.low,
  end: set.last,
});

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
  /** A different machine in some sections (electronic: the lo-fi kit in the quiet parts). */
  banks?: Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; lead: string; vox: string; keys: string };
  /** At or under the kit's Bands: drums .7 (jazz-soul .65, electronic .6), bass .9 (electronic .55), chords .4–.45. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    vox: number;
    keys: number;
  };
  /** content/flavours.ts production: the room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  /** Sixth chords on I and IV (jazz-soul from U03); triads otherwise. */
  chords: ChordSet;
  /** The kit's feel from its staging (jazz-soul swings its eighths from U03): drums, chords, tune, voice, pairs. */
  swing?: string;
  kick: BySection;
  snare: BySection;
  hats: BySection;
  perc: BySection;
  /** Bass notes; the downbeat of every bar is the chord's root (C2, F2, G2) in every kit. */
  bass: BySection;
  /** The chords' rhythm (`struct`) in each section; `chordSound` changes their sound in a section. */
  comp: Readonly<Record<SectionId, string>>;
  chordSound?: Partial<Record<SectionId, string>>;
  /**
   * Synth controls by section (electronic): the bass's sound and filter (then the bass's sound is named in each
   * section, not on the track), the chords' filter and pump, and the envelopes and echo of the three upper lines.
   */
  synth?: {
    bassSound: Readonly<Record<SectionId, string>>;
    bass: Readonly<Record<SectionId, string>>;
    chords: Readonly<Record<SectionId, string>>;
    lead: string;
    vox: string;
    keys: string;
  };
}

// Grooves shared by the kits: the opening's pickup, the bridge's half time and build, the stop's pickup.
const SNARE_PICKUP = "<~ ~ ~ [~ ~ ~ ~ ~ ~ sd sd]>";
const SNARE_BRIDGE = "<[~ ~ rim ~]!6 [sd*8] [sd*16]>";
const HATS_BRIDGE = "<~!2 [[~ hh]*4]!4 [hh*8] [hh*16]>";
const STOP_SNARE = "~ ~ ~ [sd sd]";
const BASS_BRIDGE = (seven: string, eight: string): string => `<c2 f2 c2 f2 c2 f2 ${seven} ${eight}>`;
/** The loud parts' crash on bars 1 and 5, over a hand-percussion pattern. */
const crashes = (under: string): string => `<[cr, ${under}] [${under}]!3 [cr, ${under}] [${under}]!3>`;

/** Pop: the default kit, piano, picked bass, piano tune, a choir on the second voice, a Rhodes on the pairs. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", vox: "choir", keys: "rhodes" },
  gain: {
    kick: 0.7,
    snare: 0.6,
    hats: 0.4,
    perc: 0.35,
    bass: 0.85,
    chords: 0.4,
    lead: 0.5,
    vox: 0.3,
    keys: 0.45,
  },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  chords: TRIADS,
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd bd ~ ~ ~]!2>"),
    verse1: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus1: v("bd ~ ~ bd bd ~ bd ~"),
    verse2: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("<bd!6 [bd ~ bd ~ bd ~ bd ~] [bd*8]>"),
    stop: v("bd ~ ~ ~"),
    chorus2: v("bd ~ ~ bd bd ~ bd ~"),
    outro: v("bd ~ ~ bd ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(SNARE_BRIDGE),
    stop: v(STOP_SNARE),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8]!2>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh hh oh]*2", V8),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BRIDGE),
    stop: null,
    chorus2: v("[hh hh hh oh]*2", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v(crashes("~ tb ~ tb")),
    verse2: v("<[cr, [~ sh]*4] [[~ sh]*4]!7>"),
    bridge: v("<cr ~!7>"),
    stop: v("cr"),
    chorus2: v(crashes("tb*8")),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: "<~ ~ [c2@3 c2 c2@4] [f2@3 f2 f2@4]>",
    verse1: "<[c2@3 c2 c2@3 g2] [f2@3 f2 f2@3 c3]>",
    chorus1: "<[c2@3 c2 c2@2 c2 g2] [f2@3 f2 f2@2 f2 c3]>",
    verse2: "<[c2@3 c2 c2@3 g2] [f2@3 f2 f2@3 c3]>",
    bridge: BASS_BRIDGE("[c2*8]", "[f2*8]"),
    stop: "g2 ~ ~ ~",
    chorus2: "<[c2@3 c2 c2@2 c2 g2] [f2@3 f2 f2@2 f2 c3]>",
    outro: "<[c2@3 c2@5] [f2@3 f2@5]>",
    end: "c2",
  },
  comp: {
    intro: "<x!2 [x x x ~]!2>",
    verse1: "x x x ~",
    chorus1: "x*8",
    verse2: "x x x ~",
    bridge: "x",
    stop: "x ~ ~ ~",
    chorus2: "x*8",
    outro: "x@2 x@2",
    end: "x",
  },
};

/**
 * Indie: the rock kit, clean guitar, picked bass, acoustic guitar on the tune, strings on the second voice, the clean
 * guitar's double stops on the pairs. The quiet parts strum 3+3+2 with the kick and bass; the loud parts go four on the
 * floor with offbeat open hats and octave bass.
 */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "strings", keys: "cleangtr" },
  gain: {
    kick: 0.7,
    snare: 0.6,
    hats: 0.4,
    perc: 0.35,
    bass: 0.85,
    chords: 0.4,
    lead: 0.5,
    vox: 0.25,
    keys: 0.45,
  },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  chords: TRIADS,
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd ~ ~ bd ~]!2>"),
    verse1: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ bd ~ ~ bd ~"),
    bridge: v("<bd!6 [bd*4] [bd*8]>"),
    stop: v("bd ~ ~ ~"),
    chorus2: v("bd*4"),
    outro: v("bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    bridge: v(SNARE_BRIDGE),
    stop: v(STOP_SNARE),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8]!2>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh oh]*4", V8),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BRIDGE),
    stop: null,
    chorus2: v("[hh oh]*4", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v(crashes("~ tb ~ tb")),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    bridge: v("<cr ~!7>"),
    stop: v("cr"),
    chorus2: v(crashes("tb*8")),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: "<~ ~ [c2@3 c2@3 c2@2] [f2@3 f2@3 f2@2]>",
    verse1: "<[c2@3 c2@3 c2@2] [f2@3 f2@3 f2@2]>",
    chorus1: "<[c2 c3]*4 [f2 f3]*4>",
    verse2: "<[c2@3 c2@3 c2@2] [f2@3 f2@3 f2@2]>",
    bridge: BASS_BRIDGE("[c2*8]", "[f2 f3]*4"),
    stop: "g2 ~ ~ ~",
    chorus2: "<[c2 c3]*4 [f2 f3]*4>",
    outro: "<[c2@4 c2@4] [f2@4 f2@4]>",
    end: "c2",
  },
  comp: {
    intro: "<x!2 [x@3 x@3 x@2]!2>",
    verse1: "x@3 x@3 x@2",
    chorus1: "x*8",
    verse2: "x@3 x@3 x@2",
    bridge: "x",
    stop: "x ~ ~ ~",
    chorus2: "x*8",
    outro: "x ~ ~ ~ x ~ ~ ~",
    end: "x",
  },
};

/** The ride's swung pattern (ding, ding-a, ding, ding-a); in the loud parts a tambourine joins it on 2 and 4. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
const RIDE_TB = `${RIDE}, [~ tb ~ tb]`;

/**
 * Jazz-soul: Oak's jazz kit (brushes, ride), Rhodes, upright bass, vibes on the tune, a muted trumpet on the second
 * voice, the Rhodes on the pairs. From U03 its Bands play sixth chords and swing their eighths (FLAVOUR_RULES), and so
 * does this song. The quiet parts on cross-stick (a brushed snare in the second), the hi-hat on 2 and 4 and the
 * ride, the bass in two; the loud parts on the snare, the ride and a tambourine, with a walking bass. Every chord is
 * struck while the bass plays its root, so C6 and F6 never sound over their 6th (where they would read as Am7, Dm7).
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "mutetpt", keys: "rhodes" },
  gain: {
    kick: 0.6,
    snare: 0.55,
    hats: 0.35,
    perc: 0.35,
    bass: 0.85,
    chords: 0.45,
    lead: 0.55,
    vox: 0.3,
    keys: 0.5,
  },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  chords: SIXTHS,
  swing: ".swingBy(1/3, 4)",
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ bd ~ ~ ~]!2>"),
    verse1: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus1: v("bd ~ ~ bd ~ ~ ~ ~"),
    verse2: v("bd ~ ~ ~ bd ~ ~ ~"),
    bridge: v("<bd!6 [bd ~ bd ~ bd ~ bd ~]!2>"),
    stop: v("bd ~ ~ ~"),
    chorus2: v("bd ~ ~ bd ~ ~ ~ ~"),
    outro: v("bd ~ ~ ~ bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ ~ ~ ~ ~ sd sd]>"),
    verse1: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!6 [~ sd ~ sd] [sd*8]>"),
    stop: v("~ ~ ~ [sd sd]"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ rim ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [~ hh ~ hh]!2>"),
    verse1: v("~ hh ~ hh"),
    chorus1: v("~ hh ~ hh"),
    verse2: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    stop: null,
    chorus2: v("~ hh ~ hh"),
    outro: v("~ hh ~ hh"),
    end: null,
  },
  perc: {
    intro: v(`<~ ~ [cr, ${RIDE}] [${RIDE}]>`, V8),
    verse1: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    chorus1: v(crashes(RIDE_TB), V8),
    verse2: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    bridge: v("<cr [sh*8]!7>", V8),
    stop: v("cr"),
    chorus2: v(crashes(RIDE_TB), V8),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    end: v("cr"),
  },
  bass: {
    intro: "<~ ~ [c2@4 g2@4] [f2@4 c3@4]>",
    verse1: "<[c2@4 g2@4] [f2@4 c3@4]>",
    chorus1: "<[c2 c3 g2 e2] [f2 f3 c3 a2]>",
    verse2: "<[c2@4 g2@4] [f2@4 c3@4]>",
    bridge: BASS_BRIDGE("[c2 c3 g2 e2]", "[f2 f3 c3 a2]"),
    stop: "g2 ~ ~ ~",
    chorus2: "<[c2 c3 g2 e2] [f2 f3 c3 a2]>",
    outro: "<[c2@4 g2@4] [f2@4 c3@4]>",
    end: "c2",
  },
  // Every swung push ends before the bar line, so no C6 rings over the F bar.
  comp: {
    intro: "<x!2 [x@3 x@4 ~]!2>",
    verse1: "x@3 x@4 ~",
    chorus1: "x@3 x@3 ~@2",
    verse2: "x@3 x@4 ~",
    bridge: "x",
    stop: "x ~ ~ ~",
    chorus2: "x@3 x@3 ~@2",
    outro: "x@3 x@4 ~",
    end: "x",
  },
};

const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FUNK_BASS_C = "c2 ~ ~ c2 ~ ~ c3 ~ ~ ~ c2 ~ ~ ~ ~ ~";
const FUNK_BASS_F = "f2 ~ ~ f2 ~ ~ f3 ~ ~ ~ f2 ~ ~ ~ ~ ~";
const FUNK_PUSH_KICK = "bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~";
const FUNK_PUSH_C = "c2 ~ ~ c2 ~ ~ c3 ~ c2 ~ c2 ~ c3 ~ ~ ~";
const FUNK_PUSH_F = "f2 ~ ~ f2 ~ ~ f3 ~ f2 ~ f2 ~ f3 ~ ~ ~";
const FUNK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FUNK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";

/**
 * Funk: Oak's 808-style machine, clavinet, finger bass, organ on the tune, horns on the second voice, the clavinet's
 * double stops on the pairs. Sixteenths, straight, triads until U06 (FLAVOUR_RULES); the kick and the octave-popping
 * bass lock on 1, the "a" of 1, the "and" of 2 and the "and" of 3. Strings hold the chords where the clavinet would be
 * too short (the opening's first two bars, the last bar).
 */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "horns", keys: "clav" },
  gain: {
    kick: 0.7,
    snare: 0.6,
    hats: 0.35,
    perc: 0.3,
    bass: 0.85,
    chords: 0.4,
    lead: 0.4,
    vox: 0.3,
    keys: 0.4,
  },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  chords: TRIADS,
  kick: {
    intro: v(`<~ ~ [${FUNK_KICK}]!2>`),
    verse1: v(FUNK_KICK),
    chorus1: v(FUNK_PUSH_KICK),
    verse2: v(FUNK_KICK),
    bridge: v(`<bd!6 [${FUNK_KICK}]!2>`),
    stop: v("bd ~ ~ ~"),
    chorus2: v(FUNK_PUSH_KICK),
    outro: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>"),
    verse1: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus1: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    verse2: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    bridge: v(SNARE_BRIDGE),
    stop: v(STOP_SNARE),
    chorus2: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*16]!2>", V16),
    verse1: v("hh*16", V16),
    chorus1: v("[hh hh hh hh hh hh oh hh]*2", V16),
    verse2: v("hh*16", V16),
    bridge: v(HATS_BRIDGE),
    stop: null,
    chorus2: v("[hh hh hh hh hh hh oh hh]*2", V16),
    outro: v("hh*8", V8),
    end: null,
  },
  // The 808 machine has a cowbell and a shaker, no tambourine.
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v(crashes("~ cb ~ cb")),
    verse2: v("<[cr, sh*16] [sh*16]!7>", V16),
    bridge: v("<cr ~!7>"),
    stop: v("cr"),
    chorus2: v(crashes("[~ cb]*4")),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: `<~ ~ [${FUNK_BASS_C}] [${FUNK_BASS_F}]>`,
    verse1: `<[${FUNK_BASS_C}] [${FUNK_BASS_F}]>`,
    chorus1: `<[${FUNK_PUSH_C}] [${FUNK_PUSH_F}]>`,
    verse2: `<[${FUNK_BASS_C}] [${FUNK_BASS_F}]>`,
    bridge: BASS_BRIDGE(`[${FUNK_BASS_C}]`, `[${FUNK_BASS_F}]`),
    stop: "g2 ~ ~ ~",
    chorus2: `<[${FUNK_PUSH_C}] [${FUNK_PUSH_F}]>`,
    outro: "<[c2@6 c2@10] [f2@6 f2@10]>",
    end: "c2",
  },
  comp: {
    intro: "<x!2 [~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~]!2>",
    verse1: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    chorus1: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    verse2: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    bridge: "x",
    stop: "x ~ ~ ~",
    chorus2: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    outro: "x ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",
    end: "x",
  },
  chordSound: { intro: "<strings!2 clav!2>", end: "strings" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. The octave jumps fall between the beats; every
// downbeat is the chord's root, as in every kit.
const ACID_C = "c2 ~ c2 c3 c2 ~ c2 ~ c2 ~ c3 c2 c2 ~ ~ c2";
const ACID_F = "f2 ~ f2 f3 f2 ~ f2 ~ f2 ~ f3 f2 f2 ~ ~ f2";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
const SUB = ".decay(1.2).sustain(.7)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/** A supersaw pad struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8))";

/**
 * Electronic: Oak's 909-style machine and the lo-fi kit. The quiet parts sit on the lo-fi kit, a broken beat over a
 * sine sub and off-beat stabs; the loud parts go four on the floor on the 909 with the acid line and pumping stabs;
 * the bridge is half time on the lo-fi kit, the pairs on a triangle pluck with an echo over the sub, and builds into
 * the acid; the stop and the last bar hit on the 909. A square pluck with a dotted-eighth echo plays the tune, a
 * supersaw the second voice. Straight and in triads, as electronic is until U06.L10.
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", verse1: "lofikit", verse2: "lofikit", bridge: "lofikit", outro: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", vox: "supersaw", keys: "triangle" },
  gain: {
    kick: 0.6,
    snare: 0.5,
    hats: 0.35,
    perc: 0.3,
    bass: 0.5,
    chords: 0.28,
    lead: 0.4,
    vox: 0.2,
    keys: 0.35,
  },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  chords: TRIADS,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~]!2>"),
    verse1: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v("<bd!6 [bd*4]!2>"),
    stop: v("bd ~ ~ ~"),
    chorus2: v("bd*4"),
    outro: v("bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(SNARE_BRIDGE),
    stop: v(STOP_SNARE),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8]!2>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh oh hh]*4", V16),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BRIDGE),
    stop: null,
    chorus2: v("[hh hh oh hh]*4", V16),
    outro: v("hh*4", V4),
    end: null,
  },
  // The 909 has crash and ride but no shaker: the shaker plays only on the lo-fi kit.
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v("<cr ~!3 cr ~!3>"),
    verse2: v("<[cr, [~ sh ~ sh]] [~ sh ~ sh]!7>"),
    bridge: v("<cr [[~ sh]*4]!7>"),
    stop: v("cr"),
    chorus2: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    outro: v("<cr ~!7>"),
    end: v("cr"),
  },
  bass: {
    intro: "<~ ~ [c2@3 c2@2 c2@3] [f2@3 f2@2 f2@3]>",
    verse1: "<[c2@3 c2@2 c2@3] [f2@3 f2@2 f2@3]>",
    chorus1: `<[${ACID_C}] [${ACID_F}]>`,
    verse2: "<[c2@3 c2@2 c2@3] [f2@3 f2@2 f2@3]>",
    bridge: BASS_BRIDGE(`[${ACID_C}]`, `[${ACID_F}]`),
    stop: "g2 ~ ~ ~",
    chorus2: `<[${ACID_C}] [${ACID_F}]>`,
    outro: "<[c2@3 c2@5] [f2@3 f2@5]>",
    end: "c2",
  },
  comp: {
    intro: "x*4",
    verse1: "~ x ~ x ~ x ~ ~",
    chorus1: "x*8",
    verse2: "~ x ~ x ~ x ~ ~",
    bridge: "x",
    stop: "x ~ ~ ~",
    chorus2: "x*8",
    outro: "x*4",
    end: "x",
  },
  chordSound: { intro: "supersaw", outro: "supersaw" },
  synth: {
    bassSound: {
      intro: "sine",
      verse1: "sine",
      chorus1: "sawtooth",
      verse2: "sine",
      bridge: "<sine!6 sawtooth!2>",
      stop: "sawtooth",
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
        '.lpq(12).ftype("ladder").lpenv("<0!6 3!2>").lpd(.14).lps(0).decay("<1.2!6 .2!2>").sustain("<.7!6 .4!2>")',
      stop: '.lpq(12).ftype("ladder").lpenv(4).lpd(.3).lps(0).decay(.5).sustain(.3)',
      chorus2: ACID,
      outro: SUB,
      end: SUB,
    },
    chords: {
      intro: PAD,
      verse1: STAB,
      chorus1: `${STAB}${PUMP}`,
      verse2: STAB,
      bridge: "",
      stop: ".lpf(1800).lpenv(2).lpd(.3).lps(0).decay(.6).sustain(.3)",
      chorus2: `${STAB}${PUMP}`,
      outro: PAD,
      end: ".lpf(1800).decay(1.5).sustain(.5)",
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.49).delayfeedback(.35)",
    vox: ".unison(5).detune(.2).lpf(3000).decay(.3).sustain(.5)",
    keys: ".decay(.4).sustain(.25).lpf(2600).delay(.25).delaytime(.33).delayfeedback(.3)",
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

/** One flavour's song: the tune and the second voice first, then the pairs, the chords, the bass and the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const swing = k.swing ?? "";
  const syn = k.synth;
  const notes = chordNotes(k.chords);
  const chords = mapSections((id) => {
    const n = notes[id];
    if (n === null) return null;
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${n}").struct("${k.comp[id]}").s("${sound}")${syn?.chords[id] ?? ""}`;
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
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}${swing}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)})`,
    ),
    track(
      "vox",
      VOX,
      `.s("${k.sounds.vox}")${syn?.vox ?? ""}${swing}.gain(${num(k.gain.vox)}).pan(.45).room(${num(k.room)})`,
    ),
    track(
      "keys",
      KEYS,
      `.s("${k.sounds.keys}")${syn?.keys ?? ""}${swing}.velocity("${V4}").gain(${num(k.gain.keys)}).pan(.5).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${swing}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track("bass", bass, `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`),
    track("kick", drums(k.kick), `${bank}${swing}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${bank}${swing}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}${swing}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc), `${bank}${swing}.gain(${num(k.gain.perc)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: SectionId[],
  parts: SongPartId[],
  startFrom: TakeStep["startFrom"],
  today: string,
  oakKeeps?: SongPartId[],
): TakeStep => ({
  lesson,
  kind: "take",
  sections,
  parts,
  ...(oakKeeps ? { oakKeeps } : {}),
  startFrom,
  today,
});

export const U04_SONG = defineUnitSong({
  id: "usong.U04",
  unit: "U04",
  version: 1,
  title: "Side by side",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 92,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "vox", label: "vox", role: "melody", name: "Second voice", plainName: "Second voice" },
    { id: "keys", label: "keys", role: "chords", name: "Pairs of notes", plainName: "Pairs of notes" },
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
  // By part (AUTHORING §23.6): every U04 Make writes the tune and its second voice, or pairs of notes, so each step
  // hands over the tune and the second voice of one or two sections (both, because each Make's code plays both lines,
  // or plays one where Oak's second voice would sound against it), and U04.L03 the pairs of the bridge, over Oak's bass.
  plan: [
    take(
      "U04.L01",
      ["verse1", "verse2"],
      ["lead", "vox"],
      "oak",
      "You give Oak's tune a second line above it, and both lines play the second and fourth parts.",
    ),
    take(
      "U04.L02",
      ["chorus1", "chorus2"],
      ["lead", "vox"],
      "oak",
      "Your riff and a line that follows it a named interval away play both loud parts of the song.",
    ),
    take(
      "U04.L03",
      ["bridge"],
      ["keys"],
      "oak",
      "Your pairs of notes played together fill the fifth part, the quiet one before the last loud part.",
      ["bass"],
    ),
    take(
      "U04.L04",
      ["intro", "outro"],
      ["lead", "vox"],
      "oak",
      "Your riff and its answer, moved by one interval, open the song and end it.",
    ),
  ],
  releaseAfter: "U04.CP",
});

export default U04_SONG;
