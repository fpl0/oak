// Jazz song 3, "Four rooms" (docs/design/songs/makes-core-c.md §4.1, the J3 row: "a ii–V–I trio … rootless comping →
// drop-2 under the tune → comping rhythm → walking bass"; AUTHORING §23). 4/4, 132 BPM, swung, 60 bars (1:49). A trio
// with vibes plays a seventeen-bar tune made of four ii–V–Is, one in each key of the J3 lessons, in their order: F, C,
// B♭, G, with a one-bar break before the G. Each key is four bars, so every J3 Make (a four-bar ii–V–I loop in its own
// key) has a room of the song to live in, and the tune walks through all four rooms three times: the tune, a vibes
// solo, the tune again.
//
//   intro 4 (F) | the tune 17                                                          | solo 17 (the same changes)
//   Gm7 C7 F^7 F^7 | Gm7 C7 F^7 F^7 · Dm7 G7 C^7 C^7 · Cm7 F7 Bb^7 Bb^7 · break · Am7 D7 G^7 G^7 | F · C · B♭ · break · G
//   the tune again 17 (F · C · B♭ · break · G) | outro 4 (F): Gm7 C7 | Am7 D7 | Gm7 C7 | Gm7 C7 | end 1: Fmaj9
//
// Why the breaks (review, as U13's one-bar stop): J3.L03 teaches the push, `.early(1/8)`, and a learner's loop restarts
// in every section, so its last eighth is always its first chord, Cm7, struck on the "and" of 4 and ringing a bar (the
// composer keeps the hap's whole). Straight into the G room it would sit a bar on Am7 (B♭ against B, E♭ against E, B♭
// a ninth over the bass's A). In the break the bass and the chords rest and the vibes alone play a line of F major
// pentatonic notes (tones of Cm7, B♭maj7 and Am7 alike), so a pushed Cm7 rings over it as a chord of its own.
//
// The doors between the rooms are a chord's worth of common tones: Fmaj7 to Dm7 keeps F A C, Cmaj7 to Cm7 keeps C and
// G and lowers E and B, B♭maj7 to Am7 (across the break) keeps A, Gmaj7 to Gm7 lowers B and F♯. The tune's long
// notes are one thread (the guide tones, U12.L05): the 7th of each ii, the 3rd of its V and the 7th of its I,
// F E E | C B B | B♭ A A | G F♯ F♯, then the I's 3rd (A, E, D, B) and a pickup into the next room. Its C room is
// J3.L02's tune, C B B E.
//
// Each room plays its lesson's idea in Oak's own parts before the learner takes it:
// - F (J3.L01): rootless voicings A B A from the left-hand dictionary anchored at A4, B♭3 D4 F4 A4 | B♭3 D4 E4 A4 |
//   A3 C4 E4 G4, exactly the Make's reference, on the Charleston.
// - C (J3.L02): drop-2 voicings under the tune's long notes, A3 D4 F4 C5 | G3 D4 F4 B4 | G3 C4 E4 B4 | C4 G4 B4 E5,
//   the Make's reference: the tune's note is each chord's top note.
// - B♭ (J3.L03): rootless B A B anchored at A4, B♭3 D4 E♭4 G4 | A3 D4 E♭4 G4 | A3 C4 D4 F4, comped on the Charleston
//   in the tune and in rhythms that change bar by bar in the solo.
// - G (J3.L04): rootless B A B anchored at E4, G3 B3 C4 E4 | F♯3 B3 C4 E4 | F♯3 A3 B3 D4 (J3.L04's Band) over a bass
//   that walks in the solo and the last time through: root, its octave, a chord tone on 3, and on 4 a step or a half
//   step into the next bar. The first time through, the bass plays two to the bar, as a trio plays the tune.
//
// Keys (`sections[].key`): a take's Make must be in the key of every section it plays in, and the validator compares
// the Make's declared key (content/validate/unit-songs.ts `checkSongStep`). The F rooms, the opening and the ending
// keep the song's key; the C, B♭ and G rooms carry theirs. Every line is written in note names, so there is no key
// plan.
//
// Every flavour plays the same notes: the tune, the chords (the same voicings in every kit: rootless and drop-2 shapes
// are this unit's harmony, not a kit's colour, as U12's sevenths are), the bass's root on every downbeat. A flavour
// changes sounds, drums, the comping rhythm and the bass's rhythm between the downbeats. The jazz forms swing in every
// kit (content/bands/index.ts `jazzForm`), and so does this song: `.swingBy(1/3, 4)` on every track, the swing of every
// J3 Make, whose takes are swung. Wherever a chord is struck, the bass is sounding its root or its octave (a rootless
// chord is named by the bass under it). No chord is struck after beat 3, and every one has stopped before beat 4, so
// nothing swung rings over a bar line or over the bass's approach note on beat 4. The tune and the bass hold no note a
// half step above a sounding chord tone (AUTHORING §13): the tune never holds B♭ over Gm7 or C7 (A4 is in both
// voicings), F over Fmaj7, E♭ over Cm7, B♭ over B♭maj7 or G over Gmaj7, and the bass plays its approach notes on beat
// 4, where Oak's chords are silent. The same holds against every right answer of J3.L01–L03, whose chords are held or
// pushed over beat 4. Gains copy U12's levelled kits (packages/strudel/e2e/songs.pw.ts, budget sound-songs.json), so
// the learner's line sits on top.
// Every claim here is read off the evaluated events (content/validate/unit-songs.ts, and the task report's audit).
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const C_MAJOR = { tonic: "C", mode: "major" } as const;
const BB_MAJOR = { tonic: "Bb", mode: "major" } as const;
const G_MAJOR = { tonic: "G", mode: "major" } as const;

const SECTIONS = [
  { id: "intro", type: "intro", bars: 4 },
  // The tune: four rooms of four bars, one ii–V–I each, in the keys of J3.L01–L04.
  { id: "head1-f", type: "head", bars: 4 },
  { id: "head1-c", type: "head", bars: 4, key: C_MAJOR },
  { id: "head1-bb", type: "head", bars: 4, key: BB_MAJOR },
  // A one-bar break after each B♭ room: drums and vibes only (above, "Why the breaks").
  { id: "break1", type: "break", bars: 1, key: BB_MAJOR },
  { id: "head1-g", type: "head", bars: 4, key: G_MAJOR },
  // The vibes solo over the same changes.
  { id: "solo-f", type: "solo", bars: 4 },
  { id: "solo-c", type: "solo", bars: 4, key: C_MAJOR },
  { id: "solo-bb", type: "solo", bars: 4, key: BB_MAJOR },
  { id: "break2", type: "break", bars: 1, key: BB_MAJOR },
  { id: "solo-g", type: "solo", bars: 4, key: G_MAJOR },
  // The tune again, over a walking bass.
  { id: "head2-f", type: "head", bars: 4 },
  { id: "head2-c", type: "head", bars: 4, key: C_MAJOR },
  { id: "head2-bb", type: "head", bars: 4, key: BB_MAJOR },
  { id: "break3", type: "break", bars: 1, key: BB_MAJOR },
  { id: "head2-g", type: "head", bars: 4, key: G_MAJOR },
  // The tag (two chords a bar) and one bar of Fmaj9: the record lands home.
  { id: "outro", type: "outro", bars: 4 },
  { id: "end", type: "outro", bars: 1 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

/**
 * Where a section sits in the form: the arrangement changes by group, the music by room. A break (`stop`) keeps its
 * time through's drums and rests the bass and the chords.
 */
type Group = "intro" | "head1" | "solo" | "head2" | "outro" | "end";
type Room = "F" | "C" | "Bb" | "G";
const PLACE: Readonly<Record<SectionId, { group: Group; room?: Room; stop?: true }>> = {
  intro: { group: "intro", room: "F" },
  "head1-f": { group: "head1", room: "F" },
  "head1-c": { group: "head1", room: "C" },
  "head1-bb": { group: "head1", room: "Bb" },
  break1: { group: "head1", stop: true },
  "head1-g": { group: "head1", room: "G" },
  "solo-f": { group: "solo", room: "F" },
  "solo-c": { group: "solo", room: "C" },
  "solo-bb": { group: "solo", room: "Bb" },
  break2: { group: "solo", stop: true },
  "solo-g": { group: "solo", room: "G" },
  "head2-f": { group: "head2", room: "F" },
  "head2-c": { group: "head2", room: "C" },
  "head2-bb": { group: "head2", room: "Bb" },
  break3: { group: "head2", stop: true },
  "head2-g": { group: "head2", room: "G" },
  outro: { group: "outro" },
  end: { group: "end" },
};

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melHead`; `melHead3` for the third distinct head pattern), `silence` where it rests, and one `arrange()` over every
 * section of the song.
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

/** Bars as one `<…>` cycle of the section, a bar per slot (`~` a bar of rest). */
const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- Harmony (every flavour) --------------------------------------------------------------------------------
//
// One chord a bar in the rooms, two in the tag. The voicings are the J3 Makes' own (above), the same in every kit and
// every pass; the C room's drop-2 shapes keep the tune's long notes on top (C5, B4, B4, E5). The tag borrows the G
// room's D7 (F♯3 B3 C4 E4) and voices Am7 G3 C4 D4 E4 (no B, which would sit a half step over the tune's B♭-free
// line); the end is Fmaj7's A voicing over a low F, Fmaj9.

const VOICE: Readonly<Record<Room, readonly string[]>> = {
  F: ["bb3,d4,f4,a4", "bb3,d4,e4,a4", "a3,c4,e4,g4", "a3,c4,e4,g4"],
  C: ["a3,d4,f4,c5", "g3,d4,f4,b4", "g3,c4,e4,b4", "c4,g4,b4,e5"],
  Bb: ["bb3,d4,eb4,g4", "a3,d4,eb4,g4", "a3,c4,d4,f4", "a3,c4,d4,f4"],
  G: ["g3,b3,c4,e4", "f#3,b3,c4,e4", "f#3,a3,b3,d4", "f#3,a3,b3,d4"],
};
const GM7 = "bb3,d4,f4,a4";
const C7 = "bb3,d4,e4,a4";
const AM7 = "g3,c4,d4,e4";
const D7 = "f#3,b3,c4,e4";
/** The tag, two chords a bar. */
const TAG: readonly [string, string][] = [
  [GM7, C7],
  [AM7, D7],
  [GM7, C7],
  [GM7, C7],
];
const END_CHORD = "a3,c4,e4,g4";

/** Each bar's root, low and an octave up (the funk and electronic basses play only these). */
const ROOTS: Readonly<Record<Room, readonly [string, string][]>> = {
  F: [
    ["g1", "g2"],
    ["c2", "c3"],
    ["f1", "f2"],
    ["f1", "f2"],
  ],
  C: [
    ["d2", "d3"],
    ["g1", "g2"],
    ["c2", "c3"],
    ["c2", "c3"],
  ],
  Bb: [
    ["c2", "c3"],
    ["f1", "f2"],
    ["bb1", "bb2"],
    ["bb1", "bb2"],
  ],
  G: [
    ["a1", "a2"],
    ["d2", "d3"],
    ["g1", "g2"],
    ["g1", "g2"],
  ],
};
const TAG_ROOTS: readonly [[string, string], [string, string]][] = [
  [
    ["g1", "g2"],
    ["c2", "c3"],
  ],
  [
    ["a1", "a2"],
    ["d2", "d3"],
  ],
  [
    ["g1", "g2"],
    ["c2", "c3"],
  ],
  [
    ["g1", "g2"],
    ["c2", "c3"],
  ],
];

// ---- The upright's lines (pop, indie, jazz-soul) -----------------------------------------------------------
//
// Eight eighths to a bar (`@4` a half note). Two to the bar in the opening and the first time through: the root, then
// the 5th, and in a room's last bar an approach note on beat 4 into the next room's root (C♯ into D, D♭ into C, F♯
// into G; A into the tune's first G); the B♭ room ends on its root, B♭, before the break, where the bass rests. The
// walk (the solo, the tune again): the root on 1, its octave on 2 (so a chord struck on the "and" of 2 still has its
// root under it), a chord tone on 3, and on 4 a step or a half step into the next bar (the B♭ room's last bar again
// ends on B♭). No approach note sits a half step under a note of the chords any take holds over it: J3.L02's
// held drop-2 chords rule out G♯ under Dm7, C♯ under G7 and B under Cmaj7; a held or pushed Gm7, Fmaj7 or B♭maj7 from
// J3.L01 or J3.L03 rules out D♭ into C, F♯ into G and G♯ into A, so those come from the other side.

const TWO: Readonly<Record<Room, readonly string[]>> = {
  F: ["g2@4 d2@4", "c2@4 g1@4", "f1@4 c2@4", "f2@4 c2@2 c#2@2"],
  C: ["d2@4 a1@4", "g1@4 d2@4", "c2@4 g1@4", "c2@4 g1@2 db2@2"],
  Bb: ["c2@4 g1@4", "f1@4 c2@4", "bb1@4 f2@4", "bb1@4 d2@2 bb1@2"],
  // Into the solo's walk, which starts on the low G.
  G: ["a1@4 e2@4", "d2@4 a1@4", "g1@4 d2@4", "g1@4 d2@2 f#1@2"],
};
/** The opening: two to the bar, then A, a step above the tune's first G (an F♯ would rub against G in a held Fmaj7). */
const TWO_INTRO = ["g2@4 d2@4", "c2@4 g1@4", "f1@4 c2@4", "f2@4 c2@2 a2@2"];
const WALK: Readonly<Record<Room, readonly string[]>> = {
  F: ["g1 g2 d2 b1", "c2 c3 g2 e2", "f2 f1 c2 e2", "f2 f1 a1 c#2"],
  C: ["d2 d3 a2 f#2", "g2 g1 d2 b1", "c2 c3 g2 d2", "c2 c3 e2 db2"],
  Bb: ["c2 c3 g2 e2", "f2 f1 c2 a1", "bb1 bb2 f2 a1", "bb2 bb1 d2 bb1"],
  // J3.L04's walk in its first three bars (A C E E♭ is the Make's; this one turns at the octave), into G.
  G: ["a1 a2 e2 eb2", "d2 d3 a2 ab2", "g2 g1 d2 f#1", "g1 g2 b1 f#1"],
};
/** The tag in two: each chord's root for two beats. */
const TAG_TWO = ["g1@4 c2@4", "a1@4 d2@4", "g1@4 c2@4", "g1@4 c2@4"];

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eight swung eighths to a bar. Each room's four bars share one rhythm: a long note and three answers, a long note and
// three answers, a held note and a run up, a held note and a pickup into the next room. The long notes are the guide-
// tone thread (above). Every note held a beat or more is a tone of its chord's voicing or a step clear of it, and
// every held note starts on a beat, so swing never pushes one over a bar line. The F and B♭ rooms answer downward, the
// C room upward (its drop-2 chords sit high), the G room starts from the top. The pickups step into the next room
// on the "and" of 4 by notes that also sit with the chords of a learner who holds or pushes them (no B♭ over B♭maj7,
// no C♯ over a held Fmaj7, no A♭ under a pushed Cm7).

const HEAD: Readonly<Record<Room, readonly string[]>> = {
  F: ["f5@3 d5 c5@2 a4@2", "e5@3 d5 c5@2 g4@2", "e5@4 ~ c5 d5 e5", "a5@4 g5 e5 d5 b4"],
  C: ["c5@3 d5 f5@2 a5@2", "b4@3 d5 f5@2 g5@2", "b4@4 ~ g4 a4 b4", "e5@4 g5 a5 c6 b5"],
  Bb: ["bb5@3 g5 f5@2 d5@2", "a5@3 g5 f5@2 c5@2", "a5@4 ~ f5 g5 a5", "d6@4 c6 a5 f5 a5"],
  // Over D7 the answer ends on E, not A: the Make's walk plays A♭ on beat 4 there.
  G: ["g5@3 e5 d5@2 b4@2", "f#5@3 e5 d5@2 e5@2", "f#5@4 ~ d5 e5 f#5", "b5@4 a5 g5 f#5 e5"],
};
/** The solo: lines of eighths, chord tones on the beats, a chromatic step now and then. */
const SOLO: Readonly<Record<Room, readonly string[]>> = {
  F: ["~ d5 f5 a5 g5 f5 d5 c5", "a4 c5 e5 g5 a5 g5 e5 c5", "g5 e5 c5 a4 g4 a4 c5 e5", "g5@2 e5 c5 a4@2 ~ b4"],
  C: ["d5 f5 a5 c6 b5 a5 f5 d5", "b4@2 d5 f5 a5 g5 f5 d5", "e5 g5 b5 d6 b5 a5 g5 e5", "e5@2 d5 b4 a4@2 ~ ~"],
  Bb: ["~ g4 bb4 d5 f5 g5 f5 c5", "d5 c5 a4 f4 g4 a4 c5 f5", "d5@2 f5 a5 c6@2 a5 f5", "g5@2 f5 d5 c5@2 ~ ~"],
  // Beat 4 of each bar keeps clear of the walk's approach notes (E♭, A♭, F♯, B♭ in J3.L04's walk).
  G: [
    "~ a4 c5 e5 g5 b5 a5 g5",
    "f#5 e5 d5 c5 a4 f#4 e5 d5",
    "b4@2 d5 f#5 a5@2 f#5 d5",
    "a5@2 ~ b4 d5 e5 g5 e5",
  ],
};
/**
 * The breaks: the vibes alone over the drums, in F major pentatonic (tones of a pushed Cm7, of B♭maj7 and of the Am7
 * after it), the held notes G and C. In the tune it falls and then reaches up to A, a step over the G room's first G;
 * in the solo it runs down to G, a step under the solo's A.
 */
const BREAK_TUNE = "g5@2 f5 d5 c5@2 f5 a5";
const BREAK_SOLO = "c6 a5 g5 f5 d5 c5 a4 g4";
/** The opening waits three bars, then the pickup into the tune's first F. */
const INTRO_TUNE = ["~", "~", "~", "~@4 c5 d5 e5 g5"];
/** The tag sings the tune's first cell three times and climbs to A, the 3rd of the last chord. */
const TAG_TUNE = ["f5@3 d5 e5@2 c5@2", "e5@3 c5 f#5@2 d5@2", "f5@3 d5 e5@2 c5@2", "f5@2 g5@2 e5@2 g5@2"];

const MEL: BySection = {
  intro: `note("${bars(INTRO_TUNE)}")`,
  "head1-f": `note("${bars(HEAD.F)}")`,
  "head1-c": `note("${bars(HEAD.C)}")`,
  "head1-bb": `note("${bars(HEAD.Bb)}")`,
  break1: `note("${bars([BREAK_TUNE])}")`,
  "head1-g": `note("${bars(HEAD.G)}")`,
  "solo-f": `note("${bars(SOLO.F)}")`,
  "solo-c": `note("${bars(SOLO.C)}")`,
  "solo-bb": `note("${bars(SOLO.Bb)}")`,
  break2: `note("${bars([BREAK_SOLO])}")`,
  "solo-g": `note("${bars(SOLO.G)}")`,
  "head2-f": `note("${bars(HEAD.F)}")`,
  "head2-c": `note("${bars(HEAD.C)}")`,
  "head2-bb": `note("${bars(HEAD.Bb)}")`,
  break3: `note("${bars([BREAK_TUNE])}")`,
  "head2-g": `note("${bars(HEAD.G)}")`,
  outro: `note("${bars(TAG_TUNE)}")`,
  end: `note("${bars(["a5@8"])}")`,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;
/** The swing of every J3 Make, on every track of every kit. */
const SWING = ".swingBy(1/3, 4)";

/**
 * A drum pattern per group; `last` replaces it in a G room (the fill into the next time through), `stop` in a break
 * (where the group's pattern changes bar by bar, a one-bar break would cut it off).
 */
type Drums = Readonly<Record<Group, string | null>> & {
  readonly last?: Partial<Record<Group, string>>;
  readonly first?: Partial<Record<Group, string>>;
  readonly stop?: Partial<Record<Group, string>>;
};
/** How the bass plays: the upright's two-feel and walk, the funk ostinato, or the electronic sub and acid. */
type BassStyle = "upright" | "funk" | "electronic";

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some groups (electronic: the lo-fi kit in the soft parts). */
  banks?: Partial<Record<Group, string>>;
  sounds: { bass: string; chords: string; lead: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
  };
  /** content/flavours.ts production: the chords' room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: Drums;
  snare: Drums;
  hats: Drums;
  /** Ride, crash and percussion: `first` replaces it in an F room (the crash that opens each time through). */
  perc: Drums;
  bass: BassStyle;
  /**
   * The chords' rhythm (`struct`) per group. Every strike lands while the bass sounds the chord's root (the upright's
   * first two beats, any beat of the funk and electronic basses, each half of a tag bar) and ends before beat 4.
   */
  comp: Readonly<Record<Group, string>>;
  /** Synth controls by group (electronic): the bass's sound and filter, the chords' sound and filter, the lead's fx. */
  synth?: {
    bassSound: Readonly<Record<Group, string>>;
    bass: Readonly<Record<Group, string>>;
    chordSound: Readonly<Record<Group, string>>;
    chords: Readonly<Record<Group, string>>;
    lead: string;
  };
}

/** The jazz ride: ding, ding-a, ding, ding-a, swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** The Charleston: beat 1 and the "and" of 2. */
const CHARLESTON = "x ~ ~ x ~ ~ ~ ~";
/** The solo's comping, a different figure each bar, every strike in the first half of the bar. */
const SOLO_COMP = "<[x ~ ~ x ~ ~ ~ ~] [~ x ~ x ~ ~ ~ ~] [x ~ ~ x ~ ~ ~ ~] [~ ~ x x ~ ~ ~ ~]>";
/** The tag: each chord struck with its root, on 1, the "and" of 2 and 3. */
const TAG_COMP = "x ~ ~ x x ~ ~ ~";
/** The snare's fill in the last bar of a time through. */
const FILL = "~ ~ sd ~ sd sd sd sd";
const lastBar = (bar: string, fill: string): string => `<[${bar}]!3 [${fill}]>`;
const crashFirst = (bar: string): string => `<[cr, ${bar}] [${bar}]!3>`;

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright, vibes: the trio of every J3 Make. Brushes stir the opening; the ride and
 * the hi-hat on 2 and 4 keep time from the tune on, the snare talks back in the solo, and a fill closes each time
 * through. Two to the bar in the tune, walking in the solo and the tune again; the Rhodes comps the Charleston.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes" },
  gain: { kick: 0.19, snare: 0.3, hats: 0.19, perc: 0.19, bass: 0.61, chords: 0.35, lead: 0.45 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head1: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ ~ bd ~ ~ ~"),
    head2: v("bd ~ ~ ~ bd ~ ~ ~"),
    outro: v("bd ~ ~ ~ bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    // The brushes: a stir on 1 and 3 (the kit's third snare, `n(2)`), and taps into the tune.
    intro: `${v(lastBar("sd ~ ~ ~ sd ~ ~ ~", "sd ~ ~ ~ sd ~ sd sd"))}.n(2)`,
    head1: v("~ ~ ~ ~ ~ ~ rim ~"),
    // Comping on the snare, a different hit each bar.
    solo: v("<[~ ~ ~ ~ ~ sd ~ ~] [~ ~ ~ sd ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ sd] [~ ~ ~ sd ~ ~ sd ~]>"),
    head2: v("~ ~ rim ~ ~ ~ rim ~"),
    outro: v(lastBar("~ ~ rim ~ ~ ~ rim ~", "~ ~ rim ~ sd sd sd sd")),
    end: null,
    last: {
      head1: lastBar("~ ~ ~ ~ ~ ~ rim ~", FILL),
      solo: lastBar("~ ~ ~ ~ ~ sd ~ ~", FILL),
      head2: lastBar("~ ~ rim ~ ~ ~ rim ~", FILL),
    },
    stop: { solo: "~ ~ ~ ~ ~ sd ~ sd" },
  },
  hats: {
    intro: v("~ ~ hh ~ ~ ~ hh ~"),
    head1: v("~ ~ hh ~ ~ ~ hh ~"),
    solo: v("~ ~ hh ~ ~ ~ hh ~"),
    head2: v("~ ~ hh ~ ~ ~ hh ~"),
    outro: v("~ ~ hh ~ ~ ~ hh ~"),
    end: null,
  },
  perc: {
    intro: null,
    head1: v(RIDE, V8),
    solo: v(RIDE, V8),
    head2: v(RIDE, V8),
    outro: v(RIDE, V8),
    end: v("cr"),
    first: { head1: v(crashFirst(RIDE), V8), solo: v(crashFirst(RIDE), V8), head2: v(crashFirst(RIDE), V8) },
  },
  bass: "upright",
  comp: {
    intro: CHARLESTON,
    head1: CHARLESTON,
    solo: SOLO_COMP,
    head2: CHARLESTON,
    outro: TAG_COMP,
    end: "x",
  },
};

/**
 * Pop: the default kit, piano, picked bass, piano tune. A swing-pop trio: kick on 1 and 3 (and the "and" of 2 later),
 * the snare on 2 and 4, swung hi-hats; the piano holds its chords through the first two beats and a half in the tune,
 * then comps short in the solo and the tune again.
 */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano" },
  gain: { kick: 0.27, snare: 0.14, hats: 0.09, perc: 0.08, bass: 0.49, chords: 0.2, lead: 0.48 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head1: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ ~ ~"),
    head2: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd ~ ~ ~ bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(lastBar("~ ~ rim ~ ~ ~ rim ~", "~ ~ rim ~ sd ~ sd sd")),
    head1: v("~ ~ sd ~ ~ ~ sd ~"),
    solo: v("~ ~ sd ~ ~ ~ sd ~"),
    head2: v("~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~"),
    outro: v(lastBar("~ ~ sd ~ ~ ~ sd ~", FILL)),
    end: null,
    last: {
      head1: lastBar("~ ~ sd ~ ~ ~ sd ~", FILL),
      solo: lastBar("~ ~ sd ~ ~ ~ sd ~", FILL),
      head2: lastBar("~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~", FILL),
    },
  },
  hats: {
    intro: v("~ ~ hh ~ ~ ~ hh ~"),
    head1: v("hh*8", V8),
    solo: v("hh hh hh oh hh hh hh oh", V8),
    head2: v("hh hh hh oh hh hh hh oh", V8),
    outro: v("hh*8", V8),
    end: null,
  },
  perc: {
    intro: v("sh*8", V8),
    head1: null,
    solo: v("rd*4"),
    head2: v("[~ tb]*4"),
    outro: null,
    end: v("cr"),
    first: { head1: v("<cr ~ ~ ~>"), solo: v(crashFirst("rd*4")), head2: v(crashFirst("[~ tb]*4")) },
  },
  bass: "upright",
  comp: {
    intro: "x@3 x@2 ~@3",
    head1: "x@3 x@2 ~@3",
    solo: CHARLESTON,
    head2: CHARLESTON,
    outro: "x@3 x x@2 ~@2",
    end: "x",
  },
};

/**
 * Indie: the rock kit, clean guitar, picked bass, acoustic guitar tune. Rim clicks and a closed hi-hat under the tune;
 * the snare and a ride in the solo, four on the floor the last time through. The guitar strikes the Charleston, then
 * adds beat 2.
 */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr" },
  gain: { kick: 0.39, snare: 0.36, hats: 0.24, perc: 0.2, bass: 0.52, chords: 0.37, lead: 0.76 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head1: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ bd ~ ~ bd ~"),
    head2: v("bd ~ bd ~ bd ~ bd ~"),
    outro: v("bd ~ ~ ~ bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(lastBar("~ ~ rim ~ ~ ~ rim ~", "~ ~ rim ~ sd ~ sd sd")),
    head1: v("~ ~ rim ~ ~ ~ rim ~"),
    solo: v("~ ~ sd ~ ~ ~ sd ~"),
    head2: v("~ ~ sd ~ ~ ~ sd ~"),
    outro: v(lastBar("~ ~ rim ~ ~ ~ rim ~", FILL)),
    end: null,
    last: {
      head1: lastBar("~ ~ rim ~ ~ ~ rim ~", FILL),
      solo: lastBar("~ ~ sd ~ ~ ~ sd ~", FILL),
      head2: lastBar("~ ~ sd ~ ~ ~ sd ~", FILL),
    },
  },
  hats: {
    intro: null,
    head1: v("hh*8", V8),
    solo: v("hh hh hh oh hh hh hh oh", V8),
    head2: v("hh*8", V8),
    outro: v("hh*8", V8),
    end: null,
  },
  perc: {
    intro: v("lt ~ ~ ~ lt ~ ~ ~"),
    head1: null,
    solo: v(RIDE, V8),
    head2: v("[~ tb]*4"),
    outro: null,
    end: v("cr"),
    first: { head1: v("<cr ~ ~ ~>"), solo: v(crashFirst(RIDE), V8), head2: v(crashFirst("[~ tb]*4")) },
  },
  bass: "upright",
  comp: {
    intro: CHARLESTON,
    head1: CHARLESTON,
    solo: "x ~ x x ~ ~ ~ ~",
    head2: "x ~ x x ~ ~ ~ ~",
    outro: TAG_COMP,
    end: "x",
  },
};

/**
 * Funk: Oak's 808, clavinet, finger bass, organ tune: a soul-jazz boogaloo on swung eighths. The bass locks with the
 * kick on 1, the "and" of 2 and 3, on the root and its octave only, so the clavinet can stab anywhere it stands; the
 * cowbell and the tambourine join in the solo and the tune again.
 */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ" },
  gain: { kick: 0.33, snare: 0.24, hats: 0.14, perc: 0.12, bass: 0.69, chords: 0.66, lead: 0.63 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    head1: v("bd ~ ~ bd bd ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ ~ ~"),
    head2: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd ~ ~ bd bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(lastBar("~ ~ rim ~ ~ ~ rim ~", "~ ~ rim ~ sd ~ sd sd")),
    head1: v("~ ~ sd ~ ~ ~ sd ~"),
    solo: v("~ ~ sd ~ ~ ~ sd ~"),
    head2: v("~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~"),
    outro: v(lastBar("~ ~ sd ~ ~ ~ sd ~", FILL)),
    end: null,
    last: {
      head1: lastBar("~ ~ sd ~ ~ ~ sd ~", FILL),
      solo: lastBar("~ ~ sd ~ ~ ~ sd ~", FILL),
      head2: lastBar("~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~", FILL),
    },
  },
  hats: {
    intro: v("~ hh ~ hh ~ hh ~ hh"),
    head1: v("hh*8", V8),
    solo: v("hh hh hh oh hh hh hh oh", V8),
    head2: v("hh hh hh oh hh hh hh oh", V8),
    outro: v("hh*8", V8),
    end: null,
  },
  perc: {
    intro: null,
    head1: null,
    solo: v("[~ cb]*4"),
    head2: v("sh*8", V8),
    outro: null,
    end: v("cr"),
    first: { head1: v("<cr ~ ~ ~>"), solo: v(crashFirst("[~ cb]*4")), head2: v(crashFirst("sh*8"), V8) },
  },
  bass: "funk",
  comp: {
    intro: CHARLESTON,
    head1: "x ~ ~ x ~ ~ ~ ~",
    solo: "~ x ~ x x ~ ~ ~",
    head2: "x ~ x x x ~ ~ ~",
    outro: TAG_COMP,
    end: "x",
  },
};

// Electronic: the TB-303 recipe for the bass in the solo and the tune again (a sawtooth under a resonant ladder
// filter whose envelope opens on an accent pattern), a sine sub in the soft parts, sawtooth stabs and a supersaw.
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** A supersaw chord with a slow attack and a closed filter: the soft parts' comping. */
const SOFT_SAW = ".unison(5).detune(.2).attack(.05).decay(.5).sustain(.5).lpf(1400).postgain(.6)";

/**
 * Electronic: the lo-fi kit, a sine sub and a soft supersaw under the tune (boom-bap on swung eighths); Oak's 909 four
 * on the floor, the acid line and sawtooth stabs in the solo and the tune again; the 909's ride over the solo. The
 * bass sounds only roots, so the chords keep their names. A square pluck with an echo plays the tune.
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", head1: "lofikit", outro: "lofikit", end: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square" },
  gain: { kick: 0.33, snare: 0.16, hats: 0.11, perc: 0.1, bass: 0.65, chords: 0.3, lead: 0.43 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("bd ~ ~ bd ~ ~ ~ ~"),
    head1: v("bd ~ ~ bd ~ ~ ~ ~"),
    solo: v("bd ~ bd ~ bd ~ bd ~"),
    head2: v("bd ~ bd ~ bd ~ bd ~"),
    outro: v("bd ~ ~ bd ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("~ ~ sd ~ ~ ~ sd ~"),
    head1: v("~ ~ sd ~ ~ ~ sd ~"),
    solo: v("~ ~ cp ~ ~ ~ cp ~"),
    head2: v("~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~"),
    outro: v(lastBar("~ ~ sd ~ ~ ~ sd ~", FILL)),
    end: null,
    last: {
      head1: lastBar("~ ~ sd ~ ~ ~ sd ~", FILL),
      solo: lastBar("~ ~ cp ~ ~ ~ cp ~", "~ ~ cp ~ cp cp cp cp"),
      head2: lastBar("~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~", FILL),
    },
  },
  hats: {
    intro: v("hh*8", V8),
    head1: v("hh*8", V8),
    solo: v("~ hh ~ oh ~ hh ~ oh", V8),
    head2: v("hh hh hh oh hh hh hh oh", V8),
    outro: v("hh*8", V8),
    end: null,
  },
  perc: {
    intro: null,
    head1: null,
    solo: v("rd*8", V8),
    head2: null,
    outro: null,
    end: v("cr"),
    first: { head1: v("<cr ~ ~ ~>"), solo: v(crashFirst("rd*8"), V8), head2: v("<cr ~ ~ ~>") },
  },
  bass: "electronic",
  comp: {
    intro: CHARLESTON,
    head1: CHARLESTON,
    solo: "~ x ~ x x ~ ~ ~",
    head2: "~ x ~ x x ~ ~ ~",
    outro: TAG_COMP,
    end: "x",
  },
  synth: {
    bassSound: {
      intro: "sine",
      head1: "sine",
      solo: "sawtooth",
      head2: "sawtooth",
      outro: "sine",
      end: "sine",
    },
    bass: { intro: SUB, head1: SUB, solo: ACID, head2: ACID, outro: SUB, end: SUB },
    chordSound: {
      intro: "supersaw",
      head1: "supersaw",
      solo: "sawtooth",
      head2: "sawtooth",
      outro: "supersaw",
      end: "supersaw",
    },
    chords: {
      intro: SOFT_SAW,
      head1: SOFT_SAW,
      solo: STAB,
      head2: STAB,
      outro: SOFT_SAW,
      end: ".unison(5).detune(.2).attack(.05).decay(2).sustain(.5).lpf(1600).postgain(.6)",
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.34).delayfeedback(.35)",
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

/** A section's chords: one voicing a bar (two in the tag). */
function voicings(id: SectionId): string {
  const { group, room } = PLACE[id];
  if (group === "end") return bars([END_CHORD]);
  if (group === "outro") return bars(TAG.map(([a, b]) => `[${a}] [${b}]`));
  return bars(VOICE[room as Room]);
}

/** A section's bass line in the kit's style. */
function bassLine(id: SectionId, style: BassStyle): string {
  const { group, room } = PLACE[id];
  if (group === "end") return bars(["f1@8"]);
  if (group === "outro") {
    if (style === "upright") return bars(TAG_TWO);
    if (style === "funk") return bars(TAG_ROOTS.map(([[r, o], [r2, o2]]) => `${r}@3 ${o} ${r2}@2 ${o2}@2`));
    return bars(TAG_ROOTS.map(([[r], [r2]]) => `${r}@4 ${r2}@4`));
  }
  const rm = room as Room;
  if (style === "upright") {
    if (group === "intro") return bars(TWO_INTRO);
    return bars(group === "head1" ? TWO[rm] : WALK[rm]);
  }
  const roots = ROOTS[rm];
  if (style === "funk") return bars(roots.map(([r, o]) => `${r}@3 ${o} ${r}@2 ${o}@2`));
  // Electronic: the sub holds the root in the soft parts; the acid line repeats it in the loud ones, sounding under
  // every stab, its last eighth silent so nothing swung rings into the next downbeat.
  const loud = group === "solo" || group === "head2";
  return bars(roots.map(([r, o]) => (loud ? `${r} ${r} ${r} ${o} ${r} ~ ${r} ~` : `${r}@8`)));
}

/** A drum part's pattern in a section: the group's, the fill in a G room, the crash in an F room, `stop` in a break. */
function drumsIn(d: Drums, id: SectionId): string | null {
  const { group, room, stop } = PLACE[id];
  if (stop && d.stop?.[group] !== undefined) return d.stop[group] as string;
  if (room === "G" && d.last?.[group] !== undefined) return d.last[group] as string;
  if (room === "F" && d.first?.[group] !== undefined) return d.first[group] as string;
  return d[group];
}

/** One flavour's song: the tune first, then the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    if (PLACE[id].stop) return null;
    const g = PLACE[id].group;
    const sound = syn ? syn.chordSound[g] : k.sounds.chords;
    return `note("${voicings(id)}").struct("${k.comp[g]}").s("${sound}")${syn ? syn.chords[g] : ""}`;
  });
  const bass = mapSections((id) => {
    if (PLACE[id].stop) return null;
    const line = `note("${bassLine(id, k.bass)}")`;
    const g = PLACE[id].group;
    return syn ? `${line}.s("${syn.bassSound[g]}")${syn.bass[g]}` : line;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (d: Drums): BySection =>
    mapSections((id) => {
      const raw = drumsIn(d, id);
      if (raw === null) return null;
      // A fill or crash variant is a bare mini-notation string; wrap it as the group's pattern is.
      const p = raw.startsWith("s(") ? raw : `s("${raw}")`;
      if (!k.banks) return p;
      return `${p}.bank("${k.banks[PLACE[id].group] ?? k.bank}")`;
    });
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: BySection): BySection =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(k.banks?.[PLACE[id].group] ?? k.bank) ? `${p}${KICK_808}` : p;
    });
  const tracks = [
    track(
      "mel",
      MEL,
      `${SWING}.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
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
    track("perc", drums(k.perc), `${bank}${SWING}.gain(${num(k.gain.perc)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

/**
 * The 808 kick (funk's `oak808`) rings for seconds with no choke: hits a beat apart pile up, by up to 7 dB and by the
 * tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at 96). A 0.35 s decay keeps
 * its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";

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

export const J3_SONG = defineUnitSong({
  id: "usong.J3",
  unit: "J3",
  version: 1,
  title: "Four rooms",
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
    {
      id: "perc",
      label: "perc",
      role: "drums",
      sounds: ["rd", "cr", "lt", "mt", "ht", "sh", "cb", "tb"],
      name: "Ride and percussion",
      plainName: "Ride and percussion",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // Each J3 Make is a four-bar ii–V–I loop in its own key, so each takes the rooms of its key (and the F lesson the
  // opening too, whose changes are the F room's). The chord takes keep Oak's bass and tune (`oakKeeps`): their roots
  // are the Makes' own, and the clash scan reads the references against them. Every step starts from its own starter:
  // an earlier take is in another key, so it could not open today's Make in today's rooms.
  plan: [
    take(
      "J3.L01",
      ["intro", "head1-f", "solo-f", "head2-f"],
      ["chords"],
      "oak",
      "Your rootless chords play the opening and the first four bars of each time through, all in F.",
      ["bass", "lead"],
    ),
    // J3.L05's loop is all minor 11th chords (stacks of 4ths over their lowest notes), and every room is a ii–V–I:
    // only its ii is a minor chord, so the loop fits no room. A side step; the song's notes are unchanged.
    {
      lesson: "J3.L05",
      kind: "side",
      reason:
        "Every room of the song is a ii–V–I, and this loop stays on minor 11th chords, so it stays a sketch of its own.",
    },
    take(
      "J3.L02",
      ["head1-c", "head2-c"],
      ["chords", "lead"],
      "oak",
      "Your Rhodes chords and vibes tune play the four bars in C, the first and the last time through.",
      ["bass"],
    ),
    take(
      "J3.L03",
      ["head1-bb", "solo-bb", "head2-bb"],
      ["chords"],
      "oak",
      "Your comping rhythm plays the four bars in B♭ each time through, under Oak's tune.",
      ["bass", "lead"],
    ),
    take(
      "J3.L04",
      ["head1-g", "solo-g", "head2-g"],
      ["bass"],
      "oak",
      "Your bass line plays the four bars in G each time through, under Oak's tune and comping.",
    ),
  ],
  // J3 has no checkpoint of its own (J.CP2 comes after J5) and no capstone: the song is released after its last
  // lesson, as U08's and U12's are (AUTHORING §23.6).
  releaseAfter: "J3.L04",
});

export default J3_SONG;
