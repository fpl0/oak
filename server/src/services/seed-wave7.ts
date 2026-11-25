// Wave 7 dev-seed material (docs/design/wave7.md §6): the walks of the 27 Wave 7 points, the course code a seeded
// learner saved for a track lesson that is not written yet (a stand-in Make of its unit's idea) and the drafts of
// the eight track capstones session by session. Every piece is real course code: `seed-wave7.test.ts` lints it
// with the toolbox-aware lint under the unlocks the learner has at that point and evaluates it headlessly, and the
// musical claims below are checked there by running them (the shells are the chords' 3rds and 7ths, the guide-tone
// line lands on 3rds and 7ths, the clave is 3-2 son on the two-bar eighth grid, the tritone sub's bass falls by a
// semitone, the jazz blues is in F). Each says something true about its unit.
import type { DevSeedPoint } from "@oak/api";
import type { StandInCode } from "./seed-wave5.ts";

// --- stand-in Makes of the track units ------------------------------------------------------------------------

/** J1: the major ii–V–I in C, swung, shells by hand (3rd and 7th: F–C, F–B, E–B) over the ride. */
export const J1_SHELLS = `setcpm(120/4)

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
chords: note("<[f3,c4] [f3,b3] [e3,b3] [e3,b3]>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")
bass: note("<d2 g1 c2 c2>").s("upright")`;

/** J2: the minor ii–V–i in D minor, shells by hand (Em7♭5: G–D, A7: G–C♯, Dm7: F–C). */
export const J2_MINOR = `setcpm(112/4)

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
chords: note("<[g3,d4] [g3,c#4] [f3,c4] [f3,c4]>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")
bass: note("<e2 a1 d2 d2>").s("upright")`;

/** J3: ii–V–I in F, rootless voicings by hand and a walking bass, four to the bar with an approach into each bar. */
export const J3_WALK = `setcpm(126/4)

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
chords: note("<[bb3,d4,f4,a4] [bb3,d4,e4,a4] [a3,c4,e4,g4] [a3,c4,e4,g4]>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")
bass: note("<[g2 a2 bb2 b2] [c3 bb2 a2 g#2] [f2 g2 a2 c3] [f2 e2 eb2 f#2]>").s("upright")`;

/** J4: the I–vi–ii–V turnaround in F from one chord pattern: left-hand voicings and the roots under them. */
export const J4_TURNAROUND = `setcpm(132/4)

const changes = "<F^7 D7 Gm7 C7>"

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")
bass: chord(changes).rootNotes(2).s("upright")`;

/** J5: the tritone sub: D♭7 for G7 before C; the bass falls by half steps, D–D♭–C. */
export const J5_TRITONE = `setcpm(120/4)

const changes = "<Dm7 Db7 C^7 C^7>"

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")
bass: note("<d2 db2 c2 c2>").s("upright")`;

/** R1: a 16th funk pocket in E minor: the kick on the one, ghosted hats, a syncopated bass. */
export const R1_POCKET = `setcpm(96/4)

kick: s("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")
snare: s("~ sd ~ sd")
hats: s("hh*16").velocity(".9 .4 .6 .4").gain(.6)
bass: n("<0 0 3 4>").struct("x ~ ~ x ~ ~ x ~ x ~ ~ ~ ~ ~ ~ ~").scale("E2:minor").s("fingerbass")`;

/** R2: three against two: three even cowbells across the bar over two kicks, the snare on 2 and 4. */
export const R2_THREE_TWO = `setcpm(90/4)

kick: s("bd*2")
snare: s("~ sd ~ sd")
perc: s("cb*3").gain(.6)
bass: note("<a1 a1 d2 e2>").s("fingerbass")`;

/** R3: son clave 3-2 on the two-bar eighth grid (bar 1: 1, the and of 2, 4; bar 2: 2 and 3) over a tresillo bass. */
export const R3_CLAVE = `setcpm(100/4)

clave: s("<[cb ~ ~ cb ~ ~ cb ~] [~ ~ cb ~ cb ~ ~ ~]>")
bass: note("<c2 g1>(3,8)").s("fingerbass")
kick: s("bd ~ ~ ~ bd ~ ~ ~")`;

/** A1 (A1.L05 on): grit on the bass line: saturation that is heard, the melody clean beside it. */
export const A1_GRIT = `setcpm(100/4)

kick: s("bd ~ bd ~")
snare: s("~ sd ~ sd")
hats: s("hh*8").gain(.5)
bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(600).distort(.5)
mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>").scale("C4:major").s("square").lpf(2000).gain(.7)`;

/** A2: roles and registers: bass low, chords in the middle, the tune an octave above them on its own sound. */
export const A2_REGISTERS = `setcpm(90/4)

kick: s("bd ~ ~ ~ bd ~ ~ ~")
snare: s("~ ~ sd ~")
bass: note("<a1 f1 c2 g1>").s("fingerbass")
chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("rhodes").gain(.6)
mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("A4:minor").s("square").lpf(2400).gain(.5)`;

/** Stand-in Makes of the track units, in each track's order (the seeder picks the latest of the unit that fits). */
export const WAVE7_STAND_INS: readonly StandInCode[] = [
  { id: "shells", unit: "J1", code: J1_SHELLS },
  { id: "minor-two-five", unit: "J2", code: J2_MINOR },
  { id: "walk", unit: "J3", code: J3_WALK },
  { id: "turnaround", unit: "J4", code: J4_TURNAROUND },
  { id: "tritone", unit: "J5", code: J5_TRITONE },
  { id: "pocket", unit: "R1", code: R1_POCKET },
  { id: "three-two", unit: "R2", code: R2_THREE_TWO },
  { id: "clave", unit: "R3", code: R3_CLAVE },
  { id: "grit", unit: "A1", code: A1_GRIT },
  { id: "registers", unit: "A2", code: A2_REGISTERS },
];

/** The unit whose idea a track checkpoint's Make shows. */
export const TRACK_CHECKPOINT_UNIT: Readonly<Record<string, string>> = {
  "J.CP1": "J2",
  "J.CP2": "J5",
  "R.CP": "R3",
  "A.CP": "A2",
};

// --- capstone drafts (JC1–AC2) --------------------------------------------------------------------------------

const JC1_CHANGES = `const changes = "<Dm7 G7 C^7 C^7 Fm7 Bb7 Eb^7 Eb^7 Bm7b5 E7 Am7 Am7 Dm7 G7 C^7 C^7>"`;
const JC1_KIT = `drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
hats: s("~ hh ~ hh").bank("jazzkit")`;

/** JC1.S1: sixteen bars of chained ii–Vs into C, E♭ and A minor (and home), chords and bass, no melody yet. */
export const JC1_CHANGES_DRAFT = `setcpm(72/4)

${JC1_CHANGES}

${JC1_KIT}
chords: chord(changes).dict("lefthand").voicing().s("rhodes").gain(.6)
bass: chord(changes).rootNotes(2).s("upright")`;

/**
 * JC1.S2 and the release: the same sixteen bars with a guide-tone melody, the 3rd or 7th of each chord held a bar:
 * F (3rd of Dm7) to F (7th of G7) to E (3rd of C^7), A♭ to A♭ to G in E♭, D to D to C in A minor, then home.
 */
export const JC1_BALLAD = `setcpm(72/4)

${JC1_CHANGES}

${JC1_KIT}
chords: chord(changes).dict("lefthand").voicing().s("rhodes").gain(.5)
bass: chord(changes).rootNotes(2).s("upright")
mel: note("<f4 f4 e4 e4 ab4 ab4 g4 g4 d4 d4 c4 c4 f4 f4 e4 e4>").s("vibes")`;

const JC2_CHANGES = `const changes = "<F7 Bb7 F7 [Cm7 F7] Bb7 Bb7 F7 D7 Gm7 C7 F7 C7>"`;

/** JC2.S1: the jazz blues in F from one chord pattern: shell comping and the roots under them, swung. */
export const JC2_CHANGES_DRAFT = `setcpm(132/4)

${JC2_CHANGES}

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)
bass: chord(changes).rootNotes(2).s("upright")`;

/** JC2.S2 and the release: the blues with an original head on the muted trumpet, played twice (two choruses). */
export const JC2_BLUES = `setcpm(132/4)

${JC2_CHANGES}

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")
chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.5)
bass: chord(changes).rootNotes(2).s("upright")
mel: note("<[c5 ~ a4 f4] [ab4 ~ f4 ~] [c5 ~ a4 f4] [eb5 ~ c5 ~] [d5 ~ bb4 ~] [ab4 ~ f4 ~] [c5 ~ a4 f4] [f#4 ~ a4 ~] [bb4 ~ g4 ~] [e4 ~ g4 ~] [f4 ~ ~ ~] ~>").swingBy(1/3, 4).s("mutetpt")`;

// The A section of rhythm changes as JC3's brief reads it (I vi ii V I vi ii V I I7 IV iv I V I): bars 3 and 7 keep
// the tonic on beat 1 (a iii–VI there reads as other changes and fails the brief's `a-changes` and `original`).
const JC3_A = `const changesA = "<[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 F7] Bb^7>"`;
const JC3_B = `const changesB = "<D7 D7 G7 G7 C7 C7 F7 F7>"`;
const JC3_KIT = `drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")`;
// A chord tone on beats 1 and 3 of every bar: the 3rd of B♭ and of Gm7, the root of Cm7 and the 3rd of F7, G♭ (the
// 3rd of E♭m7) in bar 6, D and C (the 3rd of B♭, the 5th of F7) in bar 7.
const JC3_MEL_A = `const melA = note("<[d5 ~ bb4 g4] [c5 ~ a4 f4] [d5 f5 d5 bb4] [c5 ~ ~ ~] [d5 ~ bb4 g4] [eb5 ~ gb4 bb4] [d5 ~ c5 a4] [f4 ~ ~ ~]>")`;
const JC3_MEL_B = `const melB = note("<[f#4 a4 c5 d5] ~ [f4 g4 b4 d5] ~ [e4 g4 bb4 c5] ~ [eb4 f4 a4 c5] ~>")`;

/** JC3.S1: the A section of rhythm changes in B♭, chords and bass, with the new tune of the A. */
export const JC3_A_DRAFT = `setcpm(160/4)

${JC3_A}
${JC3_MEL_A}

${JC3_KIT}
chords: chord(changesA).dict("lefthand").voicing().s("rhodes").gain(.5)
bass: chord(changesA).rootNotes(2).s("upright")
mel: melA.swingBy(1/3, 4).s("vibes")`;

/** JC3.S2: the A and the bridge, D7 G7 C7 F7 two bars each, an arpeggio up each dominant. */
export const JC3_BRIDGE_DRAFT = `setcpm(160/4)

${JC3_A}
${JC3_B}
${JC3_MEL_A}
${JC3_MEL_B}

${JC3_KIT}
chords: arrange([8, chord(changesA).dict("lefthand").voicing()], [8, chord(changesB).dict("lefthand").voicing()]).s("rhodes").gain(.5)
bass: arrange([8, chord(changesA).rootNotes(2)], [8, chord(changesB).rootNotes(2)]).s("upright")
mel: arrange([8, melA], [8, melB]).swingBy(1/3, 4).s("vibes")`;

/** JC3.S3 and the release: the contrafact arranged A A B A, 32 bars. */
export const JC3_CONTRAFACT = `setcpm(160/4)

${JC3_A}
${JC3_B}
${JC3_MEL_A}
${JC3_MEL_B}

${JC3_KIT}
chords: arrange([8, chord(changesA).dict("lefthand").voicing()], [8, chord(changesA).dict("lefthand").voicing()], [8, chord(changesB).dict("lefthand").voicing()], [8, chord(changesA).dict("lefthand").voicing()]).s("rhodes").gain(.5)
bass: arrange([8, chord(changesA).rootNotes(2)], [8, chord(changesA).rootNotes(2)], [8, chord(changesB).rootNotes(2)], [8, chord(changesA).rootNotes(2)]).s("upright")
mel: arrange([8, melA], [8, melA], [8, melB], [8, melA]).swingBy(1/3, 4).s("vibes")`;

/** RC1.S1: drums and bass in the pocket on an Em7 vamp: ghosted hats, the kick and the bass together on the one. */
export const RC1_POCKET = `setcpm(100/4)

kick: s("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")
snare: s("~ sd ~ sd")
hats: s("hh*16").velocity(".9 .3 .6 .3").gain(.6)
bass: n("<[0 ~ ~ 0 ~ ~ 3 ~ 4 ~ ~ ~ 0 ~ ~ ~]>").scale("E2:minor:pentatonic").s("fingerbass")`;

/** RC1.S2 and the release: the pocket with clav comping and horn stabs on the off-beats. */
export const RC1_FUNK = `setcpm(100/4)

kick: s("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")
snare: s("~ sd ~ sd")
hats: s("hh*16").velocity(".9 .3 .6 .3").gain(.6)
bass: n("<[0 ~ ~ 0 ~ ~ 3 ~ 4 ~ ~ ~ 0 ~ ~ ~]>").scale("E2:minor:pentatonic").s("fingerbass")
keys: note("[e3,g3,b3,d4]").struct("~ x ~ x ~ x ~ x").s("clav").gain(.6)
horns: note("[d4,g4,b4]").struct("~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~").s("horns").gain(.7)`;

const RC2_CLAVE = `clave: s("<[cb ~ ~ cb ~ ~ cb ~] [~ ~ cb ~ cb ~ ~ ~]>")`;

/** RC2.S1: son clave 3-2 on the two-bar eighth grid over a tresillo bass in C. */
export const RC2_CLAVE_DRAFT = `setcpm(104/4)

${RC2_CLAVE}
bass: note("<c2 g1>(3,8)").s("fingerbass")
kick: s("bd ~ ~ ~ bd ~ ~ ~")`;

/** RC2.S2 and the release: three rims against the two kicks, and a Euclidean shaker (5,8) on top. */
export const RC2_POLY = `setcpm(104/4)

${RC2_CLAVE}
bass: note("<c2 g1>(3,8)").s("fingerbass")
kick: s("bd*2")
rims: s("rim*3").gain(.6)
shaker: s("sh(5,8)").gain(.5)
chords: note("<[e3,g3,c4] [d3,f3,b3]>").struct("~ x ~ x").s("piano").gain(.5)`;

/** AC2 (D major, 72 BPM): maj9 and m11 colours voiced by hand on the Rhodes, the root in the bass. */
const AC2_CHORDS = `chords: note("<[f#3,a3,c#4,e4] [g3,a3,d4,f#4] [a3,c#4,e4,g#4] [a3,c#4,d4,f#4]>").s("rhodes").gain(.6)
bass: note("<d2 e2 f#2 b1>").s("fingerbass")`;

/** AC2.S1: the changes Dmaj9 Em11 F♯m7 Bm9 by hand, a choir pad on the same voicings. */
export const AC2_CHANGES_DRAFT = `setcpm(72/4)

${AC2_CHORDS}
pad: note("<[f#3,a3,c#4,e4] [g3,a3,d4,f#4] [a3,c#4,e4,g#4] [a3,c#4,d4,f#4]>").s("choir").gain(.3)`;

/** AC2.S2: the swung-16th groove with the snare laid back, and the melody. */
export const AC2_GROOVE_DRAFT = `setcpm(72/4)

${AC2_CHORDS}
pad: note("<[f#3,a3,c#4,e4] [g3,a3,d4,f#4] [a3,c#4,e4,g#4] [a3,c#4,d4,f#4]>").s("choir").gain(.3)
kick: s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")
snare: s("~ sd ~ sd").late(.02)
hats: s("hh*16").swingBy(1/3, 8).gain(.4)
mel: note("<[e5 ~ d5 ~] [d5 ~ a4 ~] [e5 ~ c#5 b4] [d5 ~ ~ ~]>").s("vibes").gain(.7)`;

/** AC2.S3 and the release: the same song mixed: the pad lower, a little room on the keys and the tune. */
export const AC2_BALLAD = `setcpm(72/4)

chords: note("<[f#3,a3,c#4,e4] [g3,a3,d4,f#4] [a3,c#4,e4,g#4] [a3,c#4,d4,f#4]>").s("rhodes").gain(.55).room(.3)
bass: note("<d2 e2 f#2 b1>").s("fingerbass")
pad: note("<[f#3,a3,c#4,e4] [g3,a3,d4,f#4] [a3,c#4,e4,g#4] [a3,c#4,d4,f#4]>").s("choir").gain(.2)
kick: s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")
snare: s("~ sd ~ sd").late(.02)
hats: s("hh*16").swingBy(1/3, 8).gain(.35)
mel: note("<[e5 ~ d5 ~] [d5 ~ a4 ~] [e5 ~ c#5 b4] [d5 ~ ~ ~]>").s("vibes").gain(.7).room(.25)`;

/** The seeded draft of a track capstone session, by index (the last one is the release). JC4 and AC1: below. */
export const WAVE7_CAPSTONE_DRAFTS: Readonly<Record<string, readonly string[]>> = {
  JC1: [JC1_CHANGES_DRAFT, JC1_BALLAD],
  JC2: [JC2_CHANGES_DRAFT, JC2_BLUES],
  JC3: [JC3_A_DRAFT, JC3_BRIDGE_DRAFT, JC3_CONTRAFACT],
  RC1: [RC1_POCKET, RC1_FUNK],
  RC2: [RC2_CLAVE_DRAFT, RC2_POLY],
  AC2: [AC2_CHANGES_DRAFT, AC2_GROOVE_DRAFT, AC2_BALLAD],
};
/** The key of each seeded track capstone draft. */
export const WAVE7_CAPSTONE_KEYS: Readonly<Record<string, { tonic: string; mode: string }>> = {
  JC1: { tonic: "C", mode: "major" },
  JC2: { tonic: "F", mode: "major" },
  JC3: { tonic: "Bb", mode: "major" },
  RC1: { tonic: "E", mode: "minor" },
  RC2: { tonic: "C", mode: "major" },
  AC2: { tonic: "D", mode: "major" },
};

/**
 * AC1 ("One Tune, Two Genres"): version one is the song's own setting (its answer key: melody and changes); version
 * two keeps the melody and the changes and moves the piece 30 BPM faster on other instruments.
 */
export function ac1Versions(answerKeyCode: string): { a: string; b: string } {
  const bpm = Number(/setcpm\((\d+(?:\.\d+)?)\s*\/\s*4\)/.exec(answerKeyCode)?.[1] ?? 100);
  // AC1's `sound` line in each version: one A1 control set far enough to hear (content/capstones.ts AC1, the same
  // settings as content/advanced/capstones/AC1/pieces.ts): vibrato on the tune in version one, a filter envelope on
  // the bass in version two.
  const tune = (code: string, add: string) => code.replace(/^((?:mel|melody):[^\n]*)$/m, `$1${add}`);
  const a = tune(answerKeyCode, ".vib(4).vibmod(.15)");
  const b = answerKeyCode
    .replace(/setcpm\((\d+(?:\.\d+)?)\s*\/\s*4\)/, `setcpm(${Math.round(bpm + 30)}/4)`)
    .replace(/\.s\("piano"\)/g, '.s("rhodes")')
    .replace(/\.s\("ebass"\)/g, '.s("fingerbass")')
    .replace(/^(bass:[^\n]*?)(?:\.lpf\([^)]*\))?$/m, "$1.lpf(300).lpenv(3).lpd(.15)");
  return { a, b };
}

const PCS: Readonly<Record<string, number>> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const nameOf = (pc: number): string => NAMES[((pc % 12) + 12) % 12] as string;

/**
 * JC4.S2–S3 on a standard: the song's own code with three devices in its changes and the melody untouched — a
 * secondary ii–V before the first dominant that resolves down a fifth (G7 → [Dm7 G7]), the tritone sub of the next
 * one (G7 → D♭7), and the backdoor iv7–♭VII7 in the bar before the last return home. Only the `chord("<…>")` changes
 * string moves; every other line is the song's.
 */
export function jc4Reharm(song: { key: { tonic: string }; answerKey: { code: string } }): string {
  const code = song.answerKey.code;
  const m = /chord\("<([^>"]+)>"\)/.exec(code);
  if (m === null) return code;
  const bars = (m[1] as string).trim().split(/\s+(?![^[]*\])/);
  const parse = (t: string) => /^([A-G][b#]?)(.*)$/.exec(t);
  const dominants: number[] = [];
  bars.forEach((t, i) => {
    const p = parse(t);
    const next = parse(bars[(i + 1) % bars.length] ?? "");
    if (p === null || p[2] !== "7" || next === null) return;
    const root = PCS[p[1] as string] ?? 0;
    if ((root - (PCS[next[1] as string] ?? 0) + 12) % 12 === 7) dominants.push(i);
  });
  const out = [...bars];
  const first = dominants[0];
  const second = dominants[1];
  if (first !== undefined) {
    const root = PCS[parse(bars[first] as string)?.[1] as string] ?? 0;
    out[first] = `[${nameOf(root + 7)}m7 ${bars[first]}]`;
  }
  if (second !== undefined) {
    const root = PCS[parse(bars[second] as string)?.[1] as string] ?? 0;
    out[second] = `${nameOf(root + 6)}7`;
  }
  const tonic = PCS[song.key.tonic] ?? 0;
  const home = out.findLastIndex((t, i) => i > 0 && (PCS[parse(t)?.[1] ?? ""] ?? -1) === tonic);
  if (home > 0 && home - 1 !== first && home - 1 !== second)
    out[home - 1] = `[${nameOf(tonic + 5)}m7 ${nameOf(tonic + 10)}7]`;
  return code.replace(m[0], `chord("<${out.join(" ")}>")`);
}

// --- the walks of the points ----------------------------------------------------------------------------------

/** A reviews-only session on its own day: the "one session after" a track checkpoint's last lesson. */
export const REVIEW_DAY = "REVIEW";

const J = {
  firstTwo: ["J1.L01", "J1.L02"],
  toCp1: ["J1.L03", "J1.L04", "J1.L05", "J2.L01", "J2.L02", "J2.L03"],
  jc1: ["JC1.S1", "JC1.S2"],
  toJ3L02: ["J2.L04", "J3.L01", "J3.L05"],
  toJ4L03: ["J3.L02", "J3.L03", "J3.L04", "J4.L01", "J4.L02"],
  toJc2: ["J4.L03", "J4.L04"],
  jc2: ["JC2.S1", "JC2.S2"],
  j5: ["J5.L01", "J5.L02", "J5.L03", "J5.L04"],
  jc3: ["JC3.S1", "JC3.S2", "JC3.S3"],
  jc4: ["JC4.S1", "JC4.S2", "JC4.S3"],
};
const R = {
  firstTwo: ["R1.L01", "R1.L02"],
  toR2L04: ["R1.L03", "R1.L04", "R1.L06", "R1.L05", "R2.L01", "R2.L02", "R2.L03"],
  toR3L02: ["R2.L04", "R2.L05", "R3.L01"],
  toCp: ["R3.L02", "R3.L03", "R3.L04", "R3.L05"],
  rc1: ["RC1.S1", "RC1.S2"],
  rc2: ["RC2.S1", "RC2.S2"],
};
const A = {
  side: ["A1.L01", "A1.L02", "A1.L03", "A1.L04"],
  // Oak 2.0 W2: the track order puts A2.L08 and A2.L09 after A2.L02, and A2.L07 after A2.L03.
  toA2L04: ["A1.L05", "A1.L06", "A1.L07", "A2.L01", "A2.L02", "A2.L08", "A2.L09", "A2.L03", "A2.L07"],
  toCp: ["A2.L04", "A2.L05", "A2.L06"],
  ac1: ["AC1.S1", "AC1.S2"],
  ac1Release: ["AC1.S3"],
  ac2: ["AC2.S1", "AC2.S2", "AC2.S3"],
};

const JAZZ_ALL = [
  ...J.firstTwo,
  ...J.toCp1,
  "J2.L04",
  "J.CP1",
  ...J.jc1,
  "J3.L01",
  "J3.L05",
  ...J.toJ4L03,
  ...J.toJc2,
  ...J.jc2,
  ...J.j5,
  "J5.L05",
  "J.CP2",
  ...J.jc3,
  ...J.jc4,
];
const RHYTHM_ALL = [...R.firstTwo, ...R.toR2L04, ...R.toR3L02, ...R.toCp, "R.CP", ...R.rc1, ...R.rc2];
const SOUND_ALL = [...A.side, ...A.toA2L04, ...A.toCp, "A.CP", ...A.ac1, ...A.ac1Release, ...A.ac2];

/** A Wave 7 point: where the core walk stops, what is walked after it, and what the point sets. */
export interface Wave7Walk {
  /** The last default-order item of the core walk (`CF-A.S4`: the core complete). */
  coreTo: string;
  /** Track sessions (and `REVIEW` days) after it, one a day, in this order. */
  walk: readonly string[];
  focus: "J" | "R" | "A" | null;
  /** `RC1 open`: the horns the core's U15.L05 granted are taken away, so RC1.S2's own grant is seen. */
  removeHorns?: boolean;
}

const CORE_END = "CF-A.S4";
const DONE_J = [...J.firstTwo, ...J.toCp1, "J.CP1", ...J.jc1, ...J.toJ3L02, ...J.toJ4L03, ...J.toJc2];

/** The walks of `WAVE7_SEED_POINTS` (wave7.md §6), by point. */
export const WAVE7_WALKS: Readonly<Record<string, Wave7Walk>> = {
  "core complete, tracks untouched": { coreTo: CORE_END, walk: [], focus: null },
  "J1.L03 next": { coreTo: CORE_END, walk: J.firstTwo, focus: "J" },
  "J.CP1 due": { coreTo: CORE_END, walk: [...J.firstTwo, ...J.toCp1, REVIEW_DAY], focus: "J" },
  "JC1 open": { coreTo: CORE_END, walk: [...J.firstTwo, ...J.toCp1, REVIEW_DAY, "J.CP1"], focus: "J" },
  "JC1 released": {
    coreTo: CORE_END,
    walk: [...J.firstTwo, ...J.toCp1, REVIEW_DAY, "J.CP1", ...J.jc1],
    focus: "J",
  },
  "J2.L04 locked (U14.CP not passed)": {
    coreTo: "U13.CP",
    walk: [...J.firstTwo, ...J.toCp1],
    focus: "J",
  },
  "J3.L02 next": {
    coreTo: CORE_END,
    walk: [...J.firstTwo, ...J.toCp1, "J.CP1", ...J.jc1, ...J.toJ3L02],
    focus: "J",
  },
  "J4.L03 next": {
    coreTo: CORE_END,
    walk: [...J.firstTwo, ...J.toCp1, "J.CP1", ...J.jc1, ...J.toJ3L02, ...J.toJ4L03],
    focus: "J",
  },
  "JC2 open": { coreTo: CORE_END, walk: DONE_J, focus: "J" },
  "J.CP2 due": { coreTo: CORE_END, walk: [...DONE_J, ...J.jc2, ...J.j5, REVIEW_DAY], focus: "J" },
  "JC3 open": {
    coreTo: CORE_END,
    walk: [...DONE_J, ...J.jc2, ...J.j5, REVIEW_DAY, "J.CP2", "J5.L05"],
    focus: "J",
  },
  "JC4 open": {
    coreTo: CORE_END,
    walk: [...DONE_J, ...J.jc2, ...J.j5, REVIEW_DAY, "J.CP2", "J5.L05", ...J.jc3],
    focus: "J",
  },
  "JC4.S2 done": {
    coreTo: CORE_END,
    walk: [...DONE_J, ...J.jc2, ...J.j5, REVIEW_DAY, "J.CP2", "J5.L05", ...J.jc3, "JC4.S1", "JC4.S2"],
    focus: "J",
  },
  "R1.L03 next": { coreTo: CORE_END, walk: R.firstTwo, focus: "R" },
  "R2.L04 next": { coreTo: CORE_END, walk: [...R.firstTwo, ...R.toR2L04], focus: "R" },
  "R3.L02 next": { coreTo: CORE_END, walk: [...R.firstTwo, ...R.toR2L04, ...R.toR3L02], focus: "R" },
  "R.CP due": {
    coreTo: CORE_END,
    walk: [...R.firstTwo, ...R.toR2L04, ...R.toR3L02, ...R.toCp, REVIEW_DAY],
    focus: "R",
  },
  "RC1 open": {
    coreTo: CORE_END,
    walk: [...R.firstTwo, ...R.toR2L04, ...R.toR3L02, ...R.toCp, REVIEW_DAY, "R.CP"],
    focus: "R",
    removeHorns: true,
  },
  "RC2 open": {
    coreTo: CORE_END,
    walk: [...R.firstTwo, ...R.toR2L04, ...R.toR3L02, ...R.toCp, REVIEW_DAY, "R.CP", ...R.rc1],
    focus: "R",
  },
  "A1.L05 next": { coreTo: CORE_END, walk: A.side, focus: "A" },
  "A2.L04 next": { coreTo: CORE_END, walk: [...A.side, ...A.toA2L04], focus: "A" },
  "A.CP due": { coreTo: CORE_END, walk: [...A.side, ...A.toA2L04, ...A.toCp, REVIEW_DAY], focus: "A" },
  "AC1 open": {
    coreTo: CORE_END,
    walk: [...A.side, ...A.toA2L04, ...A.toCp, REVIEW_DAY, "A.CP"],
    focus: "A",
  },
  "AC1.S2 done": {
    coreTo: CORE_END,
    walk: [...A.side, ...A.toA2L04, ...A.toCp, REVIEW_DAY, "A.CP", ...A.ac1],
    focus: "A",
  },
  "AC2 open": {
    coreTo: CORE_END,
    walk: [
      ...J.firstTwo,
      ...J.toCp1,
      ...J.toJ3L02,
      "J3.L02",
      "J3.L03",
      "J3.L04",
      ...R.firstTwo,
      "R1.L03",
      "R1.L04",
      "R1.L06",
      "R1.L05",
      ...A.side,
      ...A.toA2L04,
      ...A.toCp,
      REVIEW_DAY,
      "A.CP",
      ...A.ac1,
      ...A.ac1Release,
    ],
    focus: "A",
  },
  "two tracks in progress": {
    coreTo: CORE_END,
    walk: [...J.firstTwo, "J1.L03", ...R.firstTwo],
    focus: "J",
  },
  "whole course complete": {
    coreTo: CORE_END,
    walk: [...JAZZ_ALL, ...RHYTHM_ALL, ...SOUND_ALL],
    focus: null,
  },
};

/** Every track session in the order "whole course complete" walks them: J, then R, then A. */
export const TRACK_WALK_ORDER: readonly string[] = [...JAZZ_ALL, ...RHYTHM_ALL, ...SOUND_ALL];

/**
 * The generic `after <track session>` point (the lesson engineer's request): the core complete, then the tracks in
 * the order J, R, A one session a day up to and including that session, the focus on its track. Null for an id that
 * is not a track session.
 */
export function afterTrackWalk(id: string): Wave7Walk | null {
  const i = TRACK_WALK_ORDER.indexOf(id);
  if (i < 0) return null;
  const track = id.startsWith("JC") || id.startsWith("J") ? "J" : id.startsWith("R") ? "R" : "A";
  return { coreTo: CORE_END, walk: TRACK_WALK_ORDER.slice(0, i + 1), focus: track };
}

/** Wave 7 points (wave7.md §6) with what each holds; `GET /api/dev/seed` lists them. */
export const WAVE7_SEED_DESCRIPTIONS: readonly DevSeedPoint[] = [
  {
    point: "core complete, tracks untouched",
    description:
      "Wave 6's “core complete” (session 191; J and R open; A1.L01–L04 not done), the focus never chosen. Today is a review day with trackOffers J1.L01, R1.L01 and A1.L01 (each as soon as it is written).",
  },
  {
    point: "J1.L03 next",
    description:
      "Core complete, J1.L01–L02 done (tb.feature.jazz-glyphs, chord.sixth-sus), focus J. Today: J1.L03, track J 3/34.",
  },
  {
    point: "J.CP1 due",
    description:
      "J1.L01–L05 and J2.L01–L03 done (chord.alt, chord.ext), then a reviews-only day. Today's New block is J.CP1.",
  },
  { point: "JC1 open", description: "J.CP1 passed yesterday. Today is JC1.S1." },
  {
    point: "JC1 released",
    description:
      "JC1.S1–S2 done (the S2 draft: sixteen bars of ii–Vs into C, E♭ and A minor) and released (Side B track 1) as the brief's own passing piece: ii–Vs into C, F, B♭ and E♭ with a guide-tone melody, a recording. Today is J2.L04 (U14.CP passed in the core).",
  },
  {
    point: "J2.L04 locked (U14.CP not passed)",
    description:
      "The core through U13.CP, then J1.L01–L05 and J2.L01–L03 (U14.CP NOT passed), focus J. Today's New block is J.CP1; J2.L04 is passed over (TrackState names it waiting for U14.CP).",
  },
  {
    point: "J3.L02 next",
    description: "Through JC1 released, J2.L04, J3.L01 and J3.L05 (tb.mode.duck, tb.offset). Today: J3.L02.",
  },
  { point: "J4.L03 next", description: "J3.L02–L04 and J4.L01–L02 (snd.mutetpt) done. Today: J4.L03." },
  { point: "JC2 open", description: "J4.L03–L04 done. Today: JC2.S1." },
  {
    point: "J.CP2 due",
    description:
      "JC2 released (the jazz blues in F, two choruses), J5.L01–L04 done (J5.L05 not), then a reviews-only day. Today's New block is J.CP2.",
  },
  {
    point: "JC3 open",
    description:
      "J.CP2 passed and J5.L05 done (JC1 and JC2 released). Today: JC3.S1; JC4 is open too once a standard is written.",
  },
  {
    point: "JC4 open",
    description:
      "JC3 released (a rhythm-changes contrafact in B♭, 32 bars AABA; its `original` line cannot run until I Got Rhythm has an answer key, every other required line passes). Today: JC4.S1 on Georgia on My Mind.",
  },
  {
    point: "JC4.S2 done",
    description:
      "JC4.S1–S2 done on Georgia on My Mind: S1 the standard as written, S2 the brief's own passing reharmonisation (a tritone sub in bar 6, a backdoor into bar 31, a passing diminished chord in bar 31; the tune untouched). Today: JC4.S3.",
  },
  {
    point: "R1.L03 next",
    description: "Core complete, R1.L01–L02 done (tb.swing.patterned), focus R. Today: R1.L03.",
  },
  {
    point: "R2.L04 next",
    description: "R1.L03–L06 (snd.clav) and R2.L01–L03 (tb.meter.odd) done. Today: R2.L04.",
  },
  {
    point: "R3.L02 next",
    description: "R2.L04–L05 (tb.mini.polymeter) and R3.L01 (tb.mini.euclid) done. Today: R3.L02.",
  },
  { point: "R.CP due", description: "R3.L02–L05 done, then a reviews-only day. Today's New block is R.CP." },
  {
    point: "RC1 open",
    description:
      "R.CP passed yesterday; snd.horns taken away (the core's U15.L05 had granted it) so RC1.S2's grant at its start is seen. Today: RC1.S1.",
  },
  {
    point: "RC2 open",
    description:
      "RC1 released (16th-note funk with clav and horn stabs; horns granted at RC1.S2's start). Today: RC2.S1.",
  },
  { point: "A1.L05 next", description: "Core complete, A1.L01–L04 done, focus A. Today: A1.L05." },
  {
    point: "A2.L04 next",
    description:
      "A1.L05–L07 (tb.crush, tb.vib, tb.fm …) and A2.L01–L03 and A2.L07–L09 (tb.fscope) done. Today: A2.L04.",
  },
  {
    point: "A.CP due",
    description:
      "A2.L04 (snd.brk, tb.chop) – A2.L06 done, then a reviews-only day. Today's New block is A.CP.",
  },
  {
    point: "AC1 open",
    description:
      "A.CP passed (U11.CP passed and U15.L05 done in the core: St. Louis Blues and Sweet Georgia Brown are both open). Today: AC1.S1.",
  },
  {
    point: "AC1.S2 done",
    description:
      "AC1.S1–S2 done on St. Louis Blues (Sweet Georgia Brown when it is the only tune with an answer key): version one (the song's setting, vibrato on the tune) and version two (30 BPM faster, Rhodes and fingerbass, a filter envelope on the bass) saved. Today: AC1.S3.",
  },
  {
    point: "AC2 open",
    description:
      "AC1 released (one track, both versions); J1.L01–J3.L04 and R1.L01–L05 done (the three-way gate met); snd.choir not granted. Today: AC2.S1 (choir granted at its start).",
  },
  {
    point: "two tracks in progress",
    description:
      "Core complete, J1.L01–L03 and R1.L01–L02 done, focus J. Today: J1.L04; trackOffers J first, then R1.L03, then A1.L01.",
  },
  {
    point: "whole course complete",
    description:
      "All 270 sessions: the core, then J, R and A in order, all twenty capstones released with recordings; yesterday's summary carries courseComplete. Today is a review day with plan.course complete. JC4 is on Georgia on My Mind.",
  },
];
