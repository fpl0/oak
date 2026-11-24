// Jazz song 4, "Back to the top" (docs/design/songs/makes-core-c.md §4.1, the J4 row: "the jazz blues in F: L01
// turnaround into bars 11–12 → L02 the blues changes + mutetpt head"; AUTHORING §23). F major, 4/4, 132 BPM, swung,
// 64 bars (1:56): a jazz blues as a small band plays it on a record. An intro on the turnaround, the tune twice, a
// solo chorus, a bridge that drops a whole step to E♭, the tune once more and a tag ending.
//
//   intro 4                 | head1 12, head2 12 (the tune on the muted trumpet)          | solo 12 (vibes)
//   [Am7 D7] [Gm7 C7] ×2    | F7 B♭7 F7 [Cm7 F7] B♭7 B°7 F7 D7 Gm7 C7 [Am7 D7] [Gm7 C7]   | the same twelve bars
//   bridge 8 (E♭ major)                       | head3 12        | outro 4
//   Fm7 B♭7 E♭maj7 E♭maj7 Gm7 C7 Fm7 B♭7       | the tune again  | [Am7 D7] [Gm7 C7] F7 (held two bars)
//
// The unit's two ideas are in Oak's own parts before the learner writes them:
// - The turnaround (J4.L01): iii–VI–ii–V. In F it is Am7 D7 Gm7 C7: the intro is that turn twice, two chords a bar;
//   bars 11 and 12 of every time through the blues turn back to the top with it; the outro tags it once more before
//   the last chord. The bridge is J4.L01's own Make in E♭, eight bars whose last four turn around through iii–VI–ii–V
//   (Gm7 C7 Fm7 B♭7). It follows the solo's last C7 into Fm7 (the band drops a whole step) and its last B♭7 falls
//   back into F7, the blues' own IV to I.
// - The jazz blues (J4.L02): a ii–V into bar 5 (Cm7 F7), a diminished chord climbing from B♭7 to F7 in bar 6 (B°7),
//   D7 into Gm7 C7 from bar 8, and the turnaround in bars 11–12. The tune on the muted trumpet is a riff: a climb
//   with the blue note (A C E♭ up to F), answered by a fall (D C A♭); the riff moves up to B♭7 in bar 5, the answer
//   to B°7 in bar 6; bars 9–12 come down the chain of chords to the top.
//
// Sections and keys (`sections[].key`): a take's Make must be in the key of every section it plays in. J4.L01's Make
// is in E♭, so the bridge is in E♭ major; J4.L02's is in F, the song's key, and takes the three times the band plays
// the tune. J4.L03 (rhythm changes, B♭, 32 bars) and J4.L04 (a tune read from the page, B♭) stay sketches of their own.
// Every line is written in note names, so there is no key plan.
//
// Every flavour plays the same notes: the tune, the chords (the same voicings in every kit), the bass line (the root
// on every downbeat). A flavour changes sounds, drums and the comping rhythm. The jazz forms swing in every kit
// (content/bands/index.ts `jazzForm`), and so does this song: `.swingBy(1/3, 4)` on every track, the swing of both
// J4 Makes. Seventh chords in every kit: they are the jazz blues' harmony, not a kit's colour (as U12, U15 and J2).
// Wherever a chord is struck, the bass sounds its root, 5th or 7th (a minor seventh over its 3rd would read as a
// sixth chord; a diminished seventh is struck only over its root), and no chord is struck on the "and" of 4 or held
// into beat 4 in a walking section, so a walking bass's beat 4 (a half step from the next root) never sounds against
// it. The tune and the bass hold no note a half step above a sounding chord tone (AUTHORING §13). Gains copy J2's
// (U17's levelled kits); songs.pw.ts levels them (budget sound-songs.json), so the learner's line sits on top. Every
// claim here is read off the evaluated events (content/validate/unit-songs.ts, and the scratch audit of the report).
import { defineUnitSong, FLAVOUR_IDS, type FlavourId, type UnitSongSection } from "@oak/content-kit";

const SECTIONS = [
  { id: "intro", type: "intro", bars: 4 },
  { id: "head1", type: "head", bars: 12 },
  { id: "head2", type: "head", bars: 12 },
  { id: "solo", type: "solo", bars: 12 },
  // J4.L01's Make is in E♭: eight bars that end on iii–VI–ii–V.
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "Eb", mode: "major" } },
  { id: "head3", type: "head", bars: 12 },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const mapSections = (f: (id: SectionId) => string | null): BySection =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, string | null>;

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melHead`; `melHead3` for the third), `silence` where it rests, and one `arrange()` over every section.
 */
function track(label: string, by: BySection, tail: string): { consts: string[]; line: string } {
  const named = new Map<string, string>(); // type + pattern → const name
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

/**
 * A section's bars as a mini-notation sequence, one bar a cycle. Every section but the outro is `<[…] […] …>`. The
 * outro's last chord rings for its last two bars, so the outro is one four-bar sequence slowed to four cycles:
 * `[[bar 1] [bar 2] [bars 3–4]@2]` and `.slow(4)` after it (`OUTRO_SLOW`).
 */
const bars = (b: readonly string[]): string => `<${b.map((x) => `[${x}]`).join(" ")}>`;
const outroBars = (b1: string, b2: string, last: string): string => `[[${b1}] [${b2}] [${last}]@2]`;
const OUTRO_SLOW = ".slow(4)";

// ---- Harmony (every flavour) ---------------------------------------------------------------------------------
//
// One or two chords a bar. Every chord is voiced as its four tones, close, between D3 and F4, each change moving its
// voices by a step or two (F7 E♭ A C F → B♭7 D A♭ B♭ F → …), so the tune has the register above to itself. The
// voicings hold no two notes a half step apart but E♭maj7's D and E♭, so a tune or bass on a chord tone never rubs.

type ChordName = "F7" | "Bb7" | "Cm7" | "Bo7" | "D7" | "Gm7" | "C7" | "Am7" | "Fm7" | "Eb^7";
const VOICING: Readonly<Record<ChordName, string>> = {
  F7: "eb3,a3,c4,f4",
  Bb7: "d3,ab3,bb3,f4",
  Cm7: "eb3,g3,bb3,c4",
  Bo7: "d3,ab3,b3,f4",
  D7: "f#3,a3,c4,d4",
  Gm7: "f3,g3,bb3,d4",
  C7: "e3,g3,bb3,c4",
  Am7: "e3,g3,a3,c4",
  Fm7: "eb3,ab3,c4,f4",
  "Eb^7": "d3,g3,bb3,eb4",
};
type Bar = readonly [ChordName] | readonly [ChordName, ChordName];
const TURN: readonly Bar[] = [
  ["Am7", "D7"],
  ["Gm7", "C7"],
];
/** A jazz blues in F, J4.L02's chart, with the turnaround of J4.L01 (Am7 D7, iii–VI) in bar 11. */
const BLUES: readonly Bar[] = [
  ["F7"],
  ["Bb7"],
  ["F7"],
  ["Cm7", "F7"],
  ["Bb7"],
  ["Bo7"],
  ["F7"],
  ["D7"],
  ["Gm7"],
  ["C7"],
  ["Am7", "D7"],
  ["Gm7", "C7"],
];
/** J4.L01's Make in E♭: a ii–V–I, then iii–VI–ii–V back to the top. */
const BRIDGE: readonly Bar[] = [["Fm7"], ["Bb7"], ["Eb^7"], ["Eb^7"], ["Gm7"], ["C7"], ["Fm7"], ["Bb7"]];
/** The outro: the turnaround once more, then F7 held for its last two bars. */
const OUTRO: readonly Bar[] = [...TURN, ["F7"], ["F7"]];
const PROGRESSION: Readonly<Record<SectionId, readonly Bar[]>> = {
  intro: [...TURN, ...TURN],
  head1: BLUES,
  head2: BLUES,
  solo: BLUES,
  bridge: BRIDGE,
  head3: BLUES,
  outro: OUTRO,
};

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eight swung eighths to a bar (`@` holds). Every note held a beat or longer is a tone of its chord (or, once, E♭'s
// sixth, C), and none starts on an "and" and runs to a chord change (swing would drag it over the change). The head: the riff in bars 1, 3 and
// 7 (a rest, then A C E♭ climbing to F; bar 3 bends into it from A♭, the blue note), the answer in bar 2 (D C A♭);
// bar 5 is the riff on B♭7 (D F A♭ to B♭), bar 6 the answer on B°7 (A♭ F D); bar 8 sings D7's F♯ and C; bars 9–12
// come down the chain (G, E, F♯, E) and pick up E F G into the top. The solo runs in eighths, mostly chord tones on
// the beats, with the blue note and a few passing tones. The bridge sings long notes, G over E♭maj7 (never E♭ over its D). The outro tags the riff's shape on the
// turnaround and ends on F over F7, held two bars.

const HEAD_TUNE = [
  "~ a4 c5 eb5 f5@2 ~ c5",
  "d5@2 c5 ab4@3 ~ ~",
  "~ ab4 a4 c5 eb5@2 ~ c5",
  "eb5@2 d5 c5 a4@2 ~ ~",
  "~ d5 f5 ab5 bb5@2 ~ f5",
  "ab5@2 f5 d5@3 ~ ~",
  "~ a4 c5 eb5 f5@2 eb5 d5",
  "f#5@2 e5 c5@3 ~ ~",
  "~ bb4 d5 f5 g5@3 d5",
  "e5@2 d5 c5 bb4@2 g4 ~",
  "a4@2 c5 e5 f#5@2 ~ e5",
  "d5@2 bb4 g4 e4@2 f4 g4",
];
/** The last time through: the same tune, its last bar left open for the outro. */
const HEAD3_TUNE = [...HEAD_TUNE.slice(0, 11), "d5@2 bb4 g4 e4@2 ~ ~"];
const SOLO_TUNE = [
  "c5 a4 f4 a4 c5 eb5 d5 c5",
  "ab4@2 f4 ab4 bb4 d5 c5 d5",
  "eb5 c5 a4 f4 ab4 a4 c5 eb5",
  "g5@2 f5 eb5 c5@2 a4 c5",
  "d5 f5 ab5 f5 d5 bb4 ab4 f4",
  "ab4 b4 d5 f5 ab5@2 f5 d5",
  "c5@2 a4 c5 f5@3 d5",
  "c5 a4 f#4 a4 d5 c5 bb4 a4",
  "g4 bb4 d5 f5 a5 f5 d5 bb4",
  "c5@2 e5 g5 bb5@2 g5 e5",
  "c5 e5 g5 e5 f#5 d5 c5 a4",
  "bb4 d5 f5 d5 e5@2 c5 bb4",
];
const BRIDGE_TUNE = [
  "c5@4 ab4@2 f4@2",
  "d5@6 c5 bb4",
  "g4@8",
  "~@2 bb4@2 c5@2 d5@2",
  "d5@4 bb4@2 g4@2",
  "e5@6 d5 c5",
  "ab4@4 c5@2 eb5@2",
  "d5@4 ab4@2 f4@2",
];
/** The intro is the rhythm section's: the tune only picks up into the top, E F G, in the last bar. */
const INTRO_TUNE = ["~", "~", "~", "~ ~ ~ ~ ~ e4 f4 g4"];
const OUTRO_TUNE = { b1: "~ a4 c5 e5 f#5@2 ~ ~", b2: "~ g4 bb4 d5 e5@2 ~ ~", last: "~ a4 c5 eb5 f5@12" };

const TUNE: Readonly<Record<Exclude<SectionId, "outro">, readonly string[]>> = {
  intro: INTRO_TUNE,
  head1: HEAD_TUNE,
  head2: HEAD_TUNE,
  solo: SOLO_TUNE,
  bridge: BRIDGE_TUNE,
  head3: HEAD3_TUNE,
};

// ---- The bass (every flavour) -------------------------------------------------------------------------------
//
// In two (half notes, root then 5th; the root of each chord in a bar of two; B°7's root held a whole bar) in the
// intro, the first time through the tune and the bridge; walking in quarter notes the second and third times, under
// the solo and into the end. A walking bar: the root on 1, a tone of the chord on 2 and 3 (a minor seventh's root, 5th
// or 7th, never its 3rd), and on 4 a note that leads into the next bar's root: a half step away where the tune allows,
// else a step or a leap from a note that agrees with the tune's notes on beat 4. B°7's bar walks its arpeggio.

const TWO: Readonly<Record<"intro" | "head" | "bridge", readonly string[]>> = {
  intro: ["a1@4 d2@4", "g2@4 c2@4", "a1@4 d2@4", "g2@4 c2@4"],
  head: [
    "f2@4 c2@4",
    "bb1@4 f2@4",
    "f2@4 c2@4",
    "c2@4 f2@4",
    "bb1@4 f2@4",
    "b1@8",
    "f2@4 c2@4",
    "d2@4 a1@4",
    "g2@4 d2@4",
    "c2@4 g1@4",
    "a1@4 d2@4",
    "g2@4 c2@4",
  ],
  bridge: [
    "f2@4 c2@4",
    "bb1@4 f2@4",
    "eb2@4 bb1@4",
    "eb2@4 bb1@4",
    "g2@4 d2@4",
    "c2@4 g1@4",
    "f2@4 c2@4",
    "bb1@4 d2@4",
  ],
};
/** Walking under the tune, the second and third times (the third turns into the outro's Am7 from above, B♭). */
const HEAD_WALK = [
  "f2 a2 c3 a2",
  "bb2 ab2 f2 e2",
  "f2 c3 eb3 d3",
  "c3 g2 f2 a2",
  "bb2 d3 f3 c3",
  "b2 ab2 f2 e2",
  "f2 a2 c3 bb2",
  "d3 c3 a2 ab2",
  "g2 f2 d2 bb1",
  "c2 e2 g2 bb2",
  "a2 e2 d2 f#2",
  "g2 d2 c2 g2",
];
const HEAD3_WALK = [...HEAD_WALK.slice(0, 11), "g2 d2 c2 bb1"];
/** Walking under the solo: another line on the same changes, lower. */
const SOLO_WALK = [
  "f2 eb2 c2 a1",
  "bb1 d2 f2 e2",
  "f2 a2 c2 g1",
  "c2 bb1 f2 a2",
  "bb2 ab2 f2 c2",
  "b1 d2 f2 ab2",
  "f2 a2 c3 a2",
  "d3 c3 a2 f#2",
  "g2 d2 f2 d2",
  "c2 bb1 g1 bb1",
  "a1 e2 d2 f#2",
  "g2 d2 c2 e2",
];
const OUTRO_BASS = { b1: "a1 e2 d2 f#2", b2: "g2 d2 c2 e2", last: "f2" };

// ---- The comping (rhythm per kit, notes shared) -------------------------------------------------------------
//
// A kit's comping is written per bar shape, eight swung eighths: `A` is the bar's (first) chord, `B` its second, `~`
// a rest. A bar of two chords strikes B on beat 3 (or, as a sixteenth, on the "and" of 3). B°7 is struck only on
// beat 1 or its "and", over the bass's B. In the walking sections no chord rings into beat 4. In a bar of two
// chords, A struck on the "and" of 2 is a sixteenth: swung, an eighth there would ring a sixth of a beat into B
// (Am7's G against D7's F♯, Gm7's F against C7's E, Cm7's B♭ against F7's A).
interface Comp {
  one: string;
  two: string;
  dim: string;
}

/** A section's chords: one bar per chord shape, the kit's rhythm with the voicings put in. */
function compBar(bar: Bar, c: Comp): string {
  const [a, b] = bar;
  const template = b !== undefined ? c.two : a === "Bo7" ? c.dim : c.one;
  return template.replace(/[AB]/g, (t) => `[${VOICING[t === "A" ? a : (b as ChordName)]}]`);
}

// ---- The kits -----------------------------------------------------------------------------------------------

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), its weight on 2 and 4. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
const RIDE_V = ".8 .8 1 .7 .8 .8 1 .7";
const V8 = "[1 .86 .94 .86]*2";
const V4 = "1 .86 .92 .86";
/** A drum line: a mini pattern, and its velocities when it has some. */
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;
/** The outro's drum line: bars 1 and 2, then bars 3–4 as one (the last hit and its ring). */
const vOutro = (b1: string, b2: string, last: string, velocity?: string): string =>
  `s("${outroBars(b1, b2, last)}")${OUTRO_SLOW}${velocity ? `.velocity("${velocity}")` : ""}`;

type Slot = SectionId;
type Drums = Readonly<Record<Slot, string | null>>;
/** Two-feel sections and walking sections. */
const WALKING = new Set<SectionId>(["head2", "solo", "head3", "outro"]);

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the quiet ones). */
  banks?: Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string };
  /** The lead's sound in each section (the tune, the solo, the bridge's line). */
  lead: Readonly<Record<SectionId, string>>;
  /** Levels per part, copied from J2 (U17's levelled kits); songs.pw.ts levels them against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    ride: number;
    bass: number;
    chords: number;
    lead: number;
  };
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: Drums;
  snare: Drums;
  hats: Drums;
  ride: Drums;
  /** The comping rhythm in the two-feel sections and in the walking ones. */
  comp: { light: Comp; walk: Comp };
  /** Synth controls (electronic): the bass's sound and filter, the chords' sound and filter, the lead's by section. */
  synth?: {
    bassSound: { light: string; walk: string };
    bass: { light: string; walk: string };
    chordsSound: { light: string; walk: string };
    chords: { light: string; walk: string };
    lead: Readonly<Record<SectionId, string>>;
  };
}

/** The 4-note voicings struck as the jazz forms comp them: the Charleston, and a push on the "and" of 1. */
const CHARLESTON: Comp = { one: "A ~ ~ A ~ ~ ~ ~", two: "A ~ ~ [A ~] B ~ ~ ~", dim: "A@2 ~ ~ ~ ~ ~ ~" };
const PUSH: Comp = { one: "~ A ~ ~ A ~ ~ ~", two: "~ A ~ ~ B ~ ~ ~", dim: "~ A ~ ~ ~ ~ ~ ~" };

/** The jazz kit's brushes: a stir (`n(2)`) every half bar under taps on 2 and 4. */
const BRUSHES = 'stack(s("sd*2").n(2), s("~ ~ sd ~ ~ ~ sd ~"))';

/**
 * Jazz-soul: Oak's jazz kit (brushes in the intro and the bridge, sticks on the ride elsewhere), Rhodes, upright
 * bass. The tune on the muted trumpet, the solo on vibes, the bridge's line on the tenor.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes" },
  lead: {
    intro: "mutetpt",
    head1: "mutetpt",
    head2: "mutetpt",
    solo: "vibes",
    bridge: "tenor",
    head3: "mutetpt",
    outro: "mutetpt",
  },
  gain: { kick: 0.24, snare: 0.32, hats: 0.2, ride: 0.2, bass: 0.66, chords: 0.39, lead: 0.52 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<[bd ~ ~ ~ ~ ~ ~ ~]!3 [bd ~ ~ ~ ~ ~ ~ bd]>", ".5"),
    head1: v("bd ~ ~ ~ bd ~ ~ ~", ".45"),
    head2: v("<[bd ~ ~ ~ ~ ~ ~ ~]!3 [bd ~ ~ ~ ~ ~ ~ bd]>", ".6"),
    solo: v("<[bd ~ ~ ~ ~ ~ ~ ~] [~ ~ ~ bd ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ bd]>", ".7"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~", ".45"),
    head3: v(
      "<[bd ~ ~ ~ ~ ~ ~ ~]!3 [bd ~ ~ ~ ~ ~ ~ bd] [bd ~ ~ ~ ~ ~ ~ ~]!3 [bd ~ ~ ~ ~ ~ ~ bd] [bd ~ ~ ~ ~ ~ ~ ~]!3 [bd ~ ~ bd ~ ~ bd ~]>",
      ".7",
    ),
    outro: vOutro("bd ~ ~ ~ ~ ~ ~ ~", "bd ~ ~ ~ ~ ~ ~ bd", "bd", ".8"),
  },
  // Brushes (the stir, the snare's third sample, and taps on 2 and 4) in the intro and the bridge; a cross-stick on 4
  // the first time;
  // then the snare answers the tune on the "and"s.
  snare: {
    intro: BRUSHES,
    head1: v("~ ~ ~ ~ ~ ~ rim ~"),
    head2: v("<~ [~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ sd] [~ ~ ~ sd ~ ~ ~ sd]>", ".55"),
    solo: v("<[~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ ~ ~ sd ~ sd] [~ sd ~ ~ ~ ~ ~ sd] [~ ~ ~ sd ~ sd ~ sd]>", ".6"),
    bridge: BRUSHES,
    head3: v(
      "<[~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ sd] [~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ sd ~ ~ ~ sd] [~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ sd] [~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ sd ~ ~ ~ sd] [~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ sd] [~ ~ ~ sd ~ ~ ~ ~] [sd*8]>",
      ".6",
    ),
    outro: vOutro("~ ~ ~ sd ~ ~ ~ ~", "~ ~ ~ ~ sd sd sd sd", "~", ".6"),
  },
  // The hi-hat's foot on 2 and 4, all through.
  hats: {
    intro: v("~ ~ hh ~ ~ ~ hh ~"),
    head1: v("~ ~ hh ~ ~ ~ hh ~"),
    head2: v("~ ~ hh ~ ~ ~ hh ~"),
    solo: v("~ ~ hh ~ ~ ~ hh ~"),
    bridge: v("~ ~ hh ~ ~ ~ hh ~"),
    head3: v("~ ~ hh ~ ~ ~ hh ~"),
    outro: vOutro("~ ~ hh ~ ~ ~ hh ~", "~ ~ hh ~ ~ ~ hh ~", "~"),
  },
  ride: {
    intro: null,
    head1: v(`<[cr, ${RIDE}] [${RIDE}]!11>`, RIDE_V),
    head2: v(`<[cr, ${RIDE}] [${RIDE}]!11>`, RIDE_V),
    solo: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!3>`, RIDE_V),
    bridge: null,
    head3: v(`<[cr, ${RIDE}] [${RIDE}]!7 [cr, ${RIDE}] [${RIDE}]!3>`, RIDE_V),
    outro: vOutro(RIDE, RIDE, "cr", RIDE_V),
  },
  comp: { light: CHARLESTON, walk: PUSH },
};

/** Pop: the default kit, piano comping, picked bass; a trumpet on the tune, the piano's own solo, strings in the bridge. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano" },
  lead: {
    intro: "trumpet",
    head1: "trumpet",
    head2: "trumpet",
    solo: "piano",
    bridge: "strings",
    head3: "trumpet",
    outro: "trumpet",
  },
  gain: { kick: 0.21, snare: 0.17, hats: 0.11, ride: 0.1, bass: 0.56, chords: 0.24, lead: 0.58 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head1: v("bd ~ ~ ~ bd ~ ~ ~"),
    head2: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head3: v("<[bd ~ ~ ~ bd ~ ~ ~]!11 [bd ~ ~ bd bd ~ bd ~]>"),
    outro: vOutro("bd ~ ~ ~ bd ~ ~ ~", "bd ~ ~ ~ bd ~ bd ~", "bd"),
  },
  snare: {
    intro: v("~ ~ ~ ~ ~ ~ rim ~"),
    head1: v("~ ~ rim ~ ~ ~ rim ~"),
    head2: v("~ ~ sd ~ ~ ~ sd ~"),
    solo: v("<[~ ~ sd ~ ~ ~ sd ~]!3 [~ ~ sd ~ ~ ~ sd sd]>"),
    bridge: v("~ ~ ~ ~ rim ~ ~ ~"),
    head3: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    outro: vOutro("~ ~ sd ~ ~ ~ sd ~", "~ ~ sd ~ sd sd sd sd", "~"),
  },
  hats: {
    intro: v("hh*8", V8),
    head1: v("hh*8", V8),
    head2: v("hh*8", V8),
    solo: v("~ ~ hh ~ ~ ~ hh ~"),
    bridge: v("hh ~ hh ~ hh ~ hh ~"),
    head3: v("[hh hh hh oh]*2", V8),
    outro: vOutro("hh*8", "hh*8", "~", V8),
  },
  ride: {
    intro: null,
    head1: v("<cr ~!11>"),
    head2: v("<cr ~!11>"),
    solo: v("<[cr, rd*8] [rd*8]!11>", V8),
    bridge: null,
    head3: v("<cr ~!7 cr ~!3>"),
    outro: vOutro("~", "~", "cr"),
  },
  // The piano on 2 and 3 in two, on 1, 2 and 3 when the bass walks.
  comp: {
    light: { one: "~ ~ A ~ A ~ ~ ~", two: "~ ~ A ~ B ~ ~ ~", dim: "A ~ ~ ~ ~ ~ ~ ~" },
    walk: { one: "A ~ A ~ A ~ ~ ~", two: "A ~ A ~ B ~ ~ ~", dim: "A ~ ~ ~ ~ ~ ~ ~" },
  },
};

/**
 * Indie: the rock kit (the floor tom keeps the ride's rhythm the first time), clean guitar, picked bass; the tune on
 * an acoustic guitar, the solo on a jazz guitar, the bridge's line on the muted trumpet.
 */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr" },
  lead: {
    intro: "acgtr",
    head1: "acgtr",
    head2: "acgtr",
    solo: "jazzgtr",
    bridge: "mutetpt",
    head3: "acgtr",
    outro: "acgtr",
  },
  gain: { kick: 0.38, snare: 0.34, hats: 0.22, ride: 0.19, bass: 0.47, chords: 0.38, lead: 0.74 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head1: v("bd ~ ~ bd ~ ~ ~ ~"),
    head2: v("bd ~ ~ bd bd ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head3: v("<[bd ~ bd ~ bd ~ bd ~]!11 [bd ~ bd ~ bd bd bd bd]>"),
    outro: vOutro("bd ~ bd ~ bd ~ bd ~", "bd ~ bd ~ bd bd bd bd", "bd"),
  },
  snare: {
    intro: v("~ ~ ~ ~ ~ ~ rim ~"),
    head1: v("~ ~ rim ~ ~ ~ rim ~"),
    head2: v("~ ~ sd ~ ~ ~ sd ~"),
    solo: v("~ ~ sd ~ ~ ~ sd ~"),
    bridge: v("~ ~ ~ ~ rim ~ ~ ~"),
    head3: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    outro: vOutro("~ ~ sd ~ ~ ~ sd ~", "~ ~ sd ~ sd sd sd sd", "~"),
  },
  hats: {
    intro: v("~ ~ hh ~ ~ ~ hh ~"),
    head1: v("~ ~ hh ~ ~ ~ hh ~"),
    head2: v("hh*8", V8),
    solo: v("~ ~ hh ~ ~ ~ hh ~"),
    bridge: v("~ ~ hh ~ ~ ~ hh ~"),
    head3: v("[hh oh]*4", V8),
    outro: vOutro("[hh oh]*4", "[hh oh]*4", "~", V8),
  },
  ride: {
    intro: null,
    head1: v("<[cr, [lt ~ lt lt lt ~ lt lt]] [lt ~ lt lt lt ~ lt lt]!11>", RIDE_V),
    head2: v("<cr ~!11>"),
    solo: v(`<[cr, ${RIDE}] [${RIDE}]!11>`, RIDE_V),
    bridge: null,
    head3: v("<cr ~!7 cr ~!3>"),
    outro: vOutro("~", "~", "cr"),
  },
  // Long strums on 1 (and 3 for a second chord) in two; 1, the "and" of 2 and 3 when the bass walks.
  comp: {
    light: { one: "A@3 ~ A ~ ~ ~", two: "A@3 ~ B ~ ~ ~", dim: "A@2 ~ ~ ~ ~ ~ ~" },
    walk: { one: "A ~ ~ A A ~ ~ ~", two: "A ~ ~ [A ~] B ~ ~ ~", dim: "A ~ ~ ~ ~ ~ ~ ~" },
  },
};

/**
 * The 808 kick (`oak808`) rings for seconds with no choke: hits a beat apart pile up, by up to 7 dB
 * (packages/strudel/e2e/songs.pw.ts). A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";

/**
 * Funk: soul jazz on Oak's 808. Clavinet, finger bass, swung eighths; the tune on a trumpet, the solo on the organ,
 * the bridge's line on the tenor. Cowbell on 2 and 4 the first time, the cowbell on the ride's rhythm under the solo,
 * shaker eighths in the other walking sections.
 */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav" },
  lead: {
    intro: "trumpet",
    head1: "trumpet",
    head2: "trumpet",
    solo: "organ",
    bridge: "tenor",
    head3: "trumpet",
    outro: "trumpet",
  },
  gain: { kick: 0.36, snare: 0.25, hats: 0.15, ride: 0.13, bass: 0.73, chords: 0.7, lead: 0.7 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("bd ~ ~ bd ~ ~ ~ ~"),
    head1: v("bd ~ ~ ~ bd ~ ~ bd"),
    head2: v("bd ~ ~ bd bd ~ ~ bd"),
    solo: v("bd ~ ~ bd bd ~ ~ bd"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head3: v("<[bd ~ ~ bd bd ~ ~ bd]!11 [bd ~ ~ bd bd bd bd bd]>"),
    outro: vOutro("bd ~ ~ bd bd ~ ~ bd", "bd ~ ~ bd bd bd bd bd", "bd"),
  },
  snare: {
    intro: v("~ ~ cp ~ ~ ~ cp ~", ".6"),
    head1: v("~ ~ cp ~ ~ ~ cp ~"),
    head2: v("~ ~ sd ~ ~ ~ sd ~"),
    solo: v("<[~ ~ sd ~ ~ ~ sd ~]!3 [~ ~ sd ~ ~ sd sd sd]>"),
    bridge: v("~ ~ ~ ~ sd ~ ~ ~"),
    head3: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    outro: vOutro("~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~", "~ ~ sd ~ sd sd sd sd", "~"),
  },
  hats: {
    intro: v("hh*8", V8),
    head1: v("hh*8", V8),
    head2: v("[hh hh hh oh]*2", V8),
    solo: v("hh*8", V8),
    bridge: v("hh ~ hh ~ hh ~ hh ~"),
    head3: v("[hh hh hh oh]*2", V8),
    outro: vOutro("[hh hh hh oh]*2", "[hh hh hh oh]*2", "~", V8),
  },
  ride: {
    intro: null,
    head1: v("<[cr, [~ ~ cb ~ ~ ~ cb ~]] [~ ~ cb ~ ~ ~ cb ~]!11>"),
    head2: v("<[cr, sh*8] [sh*8]!11>", V8),
    solo: v("<[cr, [cb ~ cb cb cb ~ cb cb]] [cb ~ cb cb cb ~ cb cb]!11>", RIDE_V),
    bridge: null,
    head3: v("<[cr, sh*8] [sh*8]!7 [cr, sh*8] [sh*8]!3>", V8),
    outro: vOutro("sh*8", "sh*8", "cr", V8),
  },
  // Clav stabs on the "and" of 1, the "and" of 2 and on 3; a sixteenth on the "and" of 3 when the bass walks.
  comp: {
    light: { one: "~ A ~ A A ~ ~ ~", two: "~ A ~ [A ~] B ~ ~ ~", dim: "~ A ~ ~ ~ ~ ~ ~" },
    walk: { one: "~ A ~ A A [A ~] ~ ~", two: "~ A ~ [A ~] B [B ~] ~ ~", dim: "~ A ~ ~ ~ ~ ~ ~" },
  },
};

// Electronic: the lo-fi kit in the intro, the first time through and the bridge, Oak's 909 in the walking sections
// (four on the floor, a clap on 2 and 4, the jazz ride on the 909's cymbal). A sine sub plays the two-feel, a sawtooth
// under the acid filter walks; a supersaw pad holds the chords in two, sawtooth stabs a sixteenth long comp the walk.
// The tune is a square pluck with a dotted-eighth echo (.34 s at 132), the solo a filtered sawtooth, the bridge a
// triangle with a slow attack.
/** The acid walk: every quarter note opens the ladder filter, accented on 2 and 4. */
const ACID = '.lpq(10).ftype("ladder").lpenv("[2 3]*2").lpd(.16).lps(0).decay(.25).sustain(.5)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** A supersaw pad with a slow attack, its filter drifting; lowered as the songs' pads are (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
const PLUCK = ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.34).delayfeedback(.35)";
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", head1: "lofikit", bridge: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth" },
  lead: {
    intro: "square",
    head1: "square",
    head2: "square",
    solo: "sawtooth",
    bridge: "triangle",
    head3: "square",
    outro: "square",
  },
  gain: { kick: 0.25, snare: 0.22, hats: 0.15, ride: 0.13, bass: 0.68, chords: 0.4, lead: 0.44 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("bd ~ ~ ~ ~ bd ~ ~"),
    head1: v("bd ~ ~ ~ ~ bd ~ ~"),
    head2: v("bd ~ bd ~ bd ~ bd ~"),
    solo: v("bd ~ bd ~ bd ~ bd ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head3: v("bd ~ bd ~ bd ~ bd ~"),
    outro: vOutro("bd ~ bd ~ bd ~ bd ~", "bd ~ bd ~ bd ~ bd ~", "bd"),
  },
  snare: {
    intro: v("~ ~ sd ~ ~ ~ sd ~"),
    head1: v("~ ~ sd ~ ~ ~ sd ~"),
    head2: v("~ ~ cp ~ ~ ~ cp ~"),
    solo: v("~ ~ cp ~ ~ ~ cp ~"),
    bridge: v("~ ~ ~ ~ sd ~ ~ ~"),
    head3: v("<[~ ~ cp ~ ~ ~ cp ~]!11 [~ ~ cp ~ cp cp cp cp]>"),
    outro: vOutro("~ ~ cp ~ ~ ~ cp ~", "~ ~ cp ~ cp cp cp cp", "~"),
  },
  hats: {
    intro: v("hh*8", V8),
    head1: v("hh*8", V8),
    head2: v("~ hh ~ hh ~ hh ~ hh"),
    solo: v("hh*8", V8),
    bridge: v("~ hh ~ hh ~ hh ~ hh"),
    head3: v("[hh oh]*4", V8),
    outro: vOutro("[hh oh]*4", "[hh oh]*4", "~", V8),
  },
  ride: {
    intro: null,
    head1: v("<cr ~!11>"),
    head2: v(`<[cr, ${RIDE}] [${RIDE}]!11>`, RIDE_V),
    solo: v("<[cr, rd*8] [rd*8]!11>", V8),
    bridge: null,
    head3: v(`<[cr, ${RIDE}] [${RIDE}]!7 [cr, ${RIDE}] [${RIDE}]!3>`, RIDE_V),
    outro: vOutro(RIDE, RIDE, "cr", RIDE_V),
  },
  // The pad in two (held a half bar, B°7 a whole one); sixteenth stabs on the "and"s of 1, 2 and 3 when the bass walks.
  comp: {
    light: { one: "A@4 A@4", two: "A@4 B@4", dim: "A@8" },
    walk: {
      one: "~ [A ~] ~ [A ~] ~ [A ~] ~ ~",
      two: "~ [A ~] ~ [A ~] ~ [B ~] ~ ~",
      dim: "~ [A ~] ~ ~ ~ ~ ~ ~",
    },
  },
  synth: {
    bassSound: { light: "sine", walk: "sawtooth" },
    bass: { light: SUB, walk: ACID },
    chordsSound: { light: "supersaw", walk: "sawtooth" },
    chords: { light: PAD, walk: STAB },
    lead: {
      intro: PLUCK,
      head1: PLUCK,
      head2: PLUCK,
      solo: ".lpf(2200).decay(.2).sustain(.5)",
      bridge: ".attack(.03).decay(.6).sustain(.6).lpf(3000)",
      head3: PLUCK,
      outro: PLUCK,
    },
  },
};

const KITS: Readonly<Record<FlavourId, Kit>> = {
  "flavour.pop": POP,
  "flavour.indie": INDIE,
  "flavour.jazz-soul": JAZZ,
  "flavour.funk": FUNK,
  "flavour.electronic": ELECTRONIC,
};

const SWING = ".swingBy(1/3, 4)";

/** A section's comping: one bar per chord shape; the outro's last chord rings two bars. */
function chordsOf(id: SectionId, c: Comp): string {
  const prog = PROGRESSION[id];
  if (id !== "outro") return `note("${bars(prog.map((b) => compBar(b, c)))}")`;
  const [b1, b2] = prog as readonly Bar[];
  return `note("${outroBars(compBar(b1 as Bar, c), compBar(b2 as Bar, c), `[${VOICING.F7}]`)}")${OUTRO_SLOW}`;
}
/** A section's bass line, shared by every kit. */
function bassOf(id: SectionId): string {
  switch (id) {
    case "intro":
      return `note("${bars(TWO.intro)}")`;
    case "head1":
      return `note("${bars(TWO.head)}")`;
    case "bridge":
      return `note("${bars(TWO.bridge)}")`;
    case "head2":
      return `note("${bars(HEAD_WALK)}")`;
    case "solo":
      return `note("${bars(SOLO_WALK)}")`;
    case "head3":
      return `note("${bars(HEAD3_WALK)}")`;
    case "outro":
      return `note("${outroBars(OUTRO_BASS.b1, OUTRO_BASS.b2, OUTRO_BASS.last)}")${OUTRO_SLOW}`;
  }
}
/** A section's tune, shared by every kit. */
const tuneOf = (id: SectionId): string =>
  id === "outro"
    ? `note("${outroBars(OUTRO_TUNE.b1, OUTRO_TUNE.b2, OUTRO_TUNE.last)}")${OUTRO_SLOW}`
    : `note("${bars(TUNE[id])}")`;

/** One flavour's song: the tune first, then the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const feel = (id: SectionId): "light" | "walk" => (WALKING.has(id) ? "walk" : "light");
  const mel = mapSections((id) => `${tuneOf(id)}.s("${k.lead[id]}")${syn ? syn.lead[id] : ""}`);
  const chords = mapSections((id) => {
    const f = feel(id);
    const sound = syn ? syn.chordsSound[f] : k.sounds.chords;
    return `${chordsOf(id, k.comp[f])}.s("${sound}")${syn ? syn.chords[f] : ""}`;
  });
  const bass = mapSections((id) => {
    const f = feel(id);
    return syn ? `${bassOf(id)}.s("${syn.bassSound[f]}")${syn.bass[f]}` : bassOf(id);
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const machine = (id: SectionId): string => k.banks?.[id] ?? k.bank;
  const drums = (by: Drums): BySection =>
    mapSections((id) => {
      const p = by[id];
      if (p === null || !k.banks) return p;
      return `${p}.bank("${machine(id)}")`;
    });
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: BySection): BySection =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(machine(id)) ? `${p}${KICK_808}` : p;
    });
  const tracks = [
    track("mel", mel, `${SWING}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`),
    track(
      "chords",
      chords,
      `${SWING}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${SWING}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    track("kick", kick808(drums(k.kick)), `${bank}${SWING}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${bank}${SWING}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}${SWING}.gain(${num(k.gain.hats)})`),
    track("drums", drums(k.ride), `${bank}${SWING}.gain(${num(k.gain.ride)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

export const J4_SONG = defineUnitSong({
  id: "usong.J4",
  unit: "J4",
  version: 1,
  title: "Back to the top",
  meter: "4/4",
  key: { tonic: "F", mode: "major" },
  bpm: 132,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
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
    // J4.L02's starter plays the ride on a line labelled `drums:`; its hits are this part's by sound.
    {
      id: "ride",
      label: "drums",
      role: "drums",
      sounds: ["rd", "cr", "lt", "mt", "ht", "sh", "cb", "tb"],
      name: "Ride and cymbals",
      plainName: "Ride and cymbals",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // By section (AUTHORING §23.6): both J4 takes write chords and a bass from one `const changes`, so each hands over
  // whole sections and Oak keeps the drums there (J4.L02's starter also plays the ride and the hi-hat, which it takes).
  // J4.L01's eight bars in E♭ are the bridge; J4.L02's twelve bars are the three times through the tune. Both open on
  // their own starters: J4.L01's code is in another key and form than J4.L02's. J4.L03 and J4.L04 are side sketches.
  // No checkpoint follows J4 (J.CP2 comes after J5): the song is released after J4's last lesson.
  plan: [
    {
      lesson: "J4.L01",
      kind: "take",
      sections: ["bridge"],
      parts: ["lead", "chords", "bass"],
      startFrom: "oak",
      today:
        "Your eight bars in E♭, with their brighter turnaround, play the song's bridge before the tune comes back.",
    },
    {
      lesson: "J4.L02",
      kind: "take",
      sections: ["head1", "head2", "head3"],
      parts: ["lead", "chords", "bass", "ride", "hats"],
      startFrom: "oak",
      today:
        "Your twelve bars of blues with jazz chords play the song's first, second and last twelve-bar sections.",
    },
    {
      lesson: "J4.L03",
      kind: "side",
      reason: "This form is 32 bars in B♭ and faster than the song, so its Make stays a sketch of its own.",
    },
    {
      lesson: "J4.L04",
      kind: "side",
      reason: "This tune is read from the page in B♭, note for note, so its Make stays a sketch of its own.",
    },
  ],
  releaseAfter: "J4.L04",
});

export default J4_SONG;
