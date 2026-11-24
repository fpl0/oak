// Fixtures of the Wave 7 sound spec (wave7.pw.ts): the pitches the track lessons play their new sounds at, the
// jazz voicings the comping sounds must keep clear, the stabs and percussion of the rhythm track, and the longest
// capstone piece (JC4's ballad at JC4's tempo, 32 bars) for the CPU measure. Musical facts are checked headless in
// wave7-fixtures.test.ts.
import { drop2, rootlessVoicing } from "@oak/theory";
import { type ChartBar, swingBacking } from "../src/swing-backing.ts";

/** The pitches each sound a track unlocks is played at in its lessons (content/specs J1, J4, R1, A2 and AC2). */
export const W7_TUNING: Readonly<Record<string, readonly number[]>> = {
  // J1.L01's vibes lick, A♭3 to A♭5 (spec J2: the tour's range)
  vibes: [56, 63, 68, 80],
  // J4.L02's jazz-blues head in F, around the staff
  mutetpt: [60, 65, 69, 72],
  // R1.L03's clav stabs and comping, E3 to G4
  clav: [52, 58, 62, 67],
  // AC2's choir pad, the alto's middle
  choir: [55, 60, 64, 67],
  // A2.L06's idiomatic timbres (sound pack v4), around the treble staff; the glockenspiel two octaves up
  marimba: [60, 64, 67, 72],
  kalimba: [61, 64, 68, 71],
  glockenspiel: [84, 88, 91, 96],
};

/**
 * A zone measured out of tune where a lesson plays it, pinned so it cannot drift further unseen. Pack v3's muted
 * trumpet (0590_JCLive, zone F4–A♭4, 10.2 c sharp) was the one entry; pack v4 replaced it with a recorded harmon
 * mute (VSCO 2 CE), in tune within ±2 c, so nothing is pinned.
 */
export const W7_KNOWN_TUNING: Readonly<Record<string, Readonly<Record<number, number>>>> = {};

/** The comping sounds of the jazz track. */
export const COMP_SOUNDS = ["piano", "rhodes"] as const;

/**
 * The voicing shapes J1–J3 teach, of the ii–V–I in C: shells (J1.L04), rootless A and B (J3.L01) and drop-2 from a
 * close Cmaj7 (J3.L02). Each list is one voicing as MIDI, lowest first.
 */
export const JAZZ_VOICINGS: readonly {
  id: string;
  chord: string;
  midis: readonly number[];
  /** The voice that doubles the Band's bass (a shell's root): measured, not required, on the Rhodes. */
  doubled?: number;
}[] = [
  // J1.L05's shells as its spec writes them (content/specs/J1.ts): [d3,f3,c4] [g2,f3,b3] [c3,e3,b3].
  { id: "shell Dm7", chord: "Dm7", midis: [50, 53, 60], doubled: 0 },
  { id: "shell G7", chord: "G7", midis: [43, 53, 59], doubled: 0 },
  { id: "shell C^7", chord: "C^7", midis: [48, 52, 59], doubled: 0 },
  { id: "rootless A Dm7", chord: "Dm7", midis: rootlessVoicing("Dm7", "A") },
  { id: "rootless B G7", chord: "G7", midis: rootlessVoicing("G7", "B") },
  { id: "rootless A C^7", chord: "C^7", midis: rootlessVoicing("C^7", "A") },
  { id: "rootless B Dm7", chord: "Dm7", midis: rootlessVoicing("Dm7", "B") },
  { id: "drop-2 C^7", chord: "C^7", midis: drop2([60, 64, 67, 71]) },
  { id: "drop-2 Dm7", chord: "Dm7", midis: drop2([62, 65, 69, 72]) },
];

/** RC1's horn stabs and the funk Band's other comping sounds, on the off-beats (contracts §3.2: horns at RC1.S2). */
export const FUNK_STABS: readonly { id: string; code: string }[] = [
  { id: "horns", code: 'note("[~ [e4,bb4,d5]] ~ [~ [e4,bb4,d5]] ~").s("horns").clip(.5)' },
  { id: "clav", code: 'note("[~ [e3,bb3,d4]]*4").s("clav").clip(.3)' },
  { id: "muted guitar", code: 'note("[~ [e3,bb3,d4]]*4").s("cleangtr").clip(.3)' },
];

/**
 * JC4 "Reharmonize a Standard": a ballad chorus, 32 bars, at 60 BPM (128 s): the longest piece a capstone asks
 * for. A practice chart of ii–V–Is through four keys (not a standard's changes: those are the repertoire's), with
 * brushes, a two-feel bass, rootless comping and a melody on the vibes, as a learner's JC4 piece plays.
 */
const BALLAD: readonly ChartBar[] = [
  ["Ebm7", "Ab7"],
  ["Db^7"],
  ["Ebm7", "Ab7"],
  ["Db^7", "Bbm7"],
  ["Ebm7", "Ab7"],
  ["F7"],
  ["Bbm7", "Eb7"],
  ["Ebm7", "Ab7"],
];
export const JC4_BARS = 32;
export const JC4_BPM = 60;
export function jc4Ballad(): string {
  const chart = [...BALLAD, ...BALLAD, ...BALLAD, ...BALLAD];
  const b = swingBacking(chart, { drums: "brushes", feel: "two", bank: "jazzkit" });
  const melody =
    'n("<[4 ~ 2 3] [4@3 ~] [5 ~ 4 2] [1@2 0 ~] [4 ~ 2 3] [2@3 ~] [5 4 3 2] [1@3 ~]>").scale("Db5:major").s("vibes").gain(.5)';
  return [
    `setcpm(${JC4_BPM}/4)`,
    `drums: ${b.drums}`,
    `bass: ${b.bass}`,
    `chords: ${b.chords}`,
    `mel: ${melody}`,
  ].join("\n");
}
