// Wave 5 dev-seed material (docs/design/wave5.md §6): the course code a seeded learner saved for a lesson that is not
// written yet (a stand-in Make), for a checkpoint Make, and for the C3–C5 capstone drafts. Every piece is real course
// code: it lints clean under the unlocks the learner has at that point (`seed-wave5.test.ts` proves it with the
// toolbox-aware lint and evaluates it headlessly) and says something true about the unit: a root–fifth bass under its
// chords (U08), verse and chorus sections with one arrange() per labelled track (U09), the Aeolian loop and the major V
// (U10), the minor pentatonic, the blues scale over dominant sevenths and the shuffle (U11), and the sound of A1.
import type { DevSeedPoint } from "@oak/api";
import type { ToolEntry } from "@oak/content-kit";
import { toolsUsed } from "@oak/grader";

/** A stand-in Make: the unit it belongs to and its code. The seeder picks the latest one the learner can run. */
export interface StandInCode {
  id: string;
  /** `U08`…`U11`, `A1`: the unit (or track) whose ideas the code shows. */
  unit: string;
  code: string;
}

/** Root on beat 1, the fifth on beat 4, under I–V–vi–IV (C G Am F): C–G, G–D, A–E, F–C. */
export const ROOT_FIFTH_BASS = `setcpm(92/4)

drums: s("bd ~ sd ~, hh*8")
chords: n("[0,2,4]").add(n("<0 4 5 3>")).scale("C3:major").s("piano")
bass: n("<[0 ~ 0 4] [4 ~ 4 1] [5 ~ 5 2] [3 ~ 3 0]>").scale("C2:major").s("ebass").lpf(600)`;

/** U08.L04 on: the changes in a const; the bass plays its roots with the kick (beats 1 and 3). */
export const CONST_BASS = `setcpm(96/4)

const changes = n("<0 4 5 3>")

drums: s("bd ~ bd ~, ~ sd ~ sd, hh*8")
chords: n("[0,2,4]").add(changes).scale("C3:major").s("piano")
bass: n("<[0 ~ 0 ~] [4 ~ 4 ~] [5 ~ 5 ~] [3 ~ 3 ~]>").scale("C2:major").s("ebass").lpf(600)`;

/** U09.L02 on: verse and chorus, one arrange() per labelled track; the chorus sits higher and denser. */
export const VERSE_CHORUS = `setcpm(100/4)

const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G C C>").voicing()
const bassVerse = n("<[0 ~ 0 ~] [5 ~ 5 ~] [3 ~ 3 ~] [4 ~ 4 ~]>").scale("C2:major")
const bassChorus = n("<[3 ~ 3 3] [4 ~ 4 4] [0 ~ 0 0] [0 ~ 0 0]>").scale("C2:major")
const melVerse = n("<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major")
const melChorus = n("<[7 7 9 7] [8 ~ 6 4] [7 9 11 9] [7 ~ ~ ~]>").scale("C4:major")

drums: s("bd ~ bd ~, ~ sd ~ sd, hh*8")
chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus]).s("piano")
bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus]).s("ebass").lpf(600)
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus]).s("piano")`;

/** U10.L01 on: the Aeolian loop i–VI–III–VII in A minor (Am F C G), chord tones on the beat. */
export const AEOLIAN_LOOP = `setcpm(84/4)

drums: s("bd ~ sd ~, hh*8")
chords: n("[0,2,4]").add(n("<0 5 2 6>")).scale("A3:minor").s("piano")
bass: n("<[0 ~ 0 ~] [5 ~ 5 ~] [2 ~ 2 ~] [6 ~ 6 ~]>").scale("A1:minor").s("ebass").lpf(600)
mel: n("<[4 ~ 2 4] [5 ~ 4 ~] [2 ~ 4 2] [1 ~ 0 ~]>").scale("A4:minor").s("piano")`;

/** U10.L06 on: the loop lands on the major V (E, with the raised 7 G♯) before i; the melody climbs to A. */
export const HARMONIC_MINOR = `setcpm(80/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<Am F C G Am F E Am>").voicing().s("piano")
bass: note("<a1 f1 c2 g1 a1 f1 e1 a1>").s("ebass").lpf(600)
mel: n("<[4 ~ 2 4] [5 ~ 4 ~] [2 ~ 4 2] [1 ~ 0 ~] [4 ~ 2 4] [5 ~ 4 ~] [6 ~ 4 ~] [7 ~ ~ ~]>").scale("A4:harmonic:minor").s("piano")`;

/** U11.L02 on: a minor-pentatonic riff in A over Am C G Am. */
export const PENTATONIC_RIFF = `setcpm(96/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<Am C G Am>").voicing().s("piano")
riff: n("<[0 2 3 2] [4 ~ 3 ~] [2 3 4 3] [0 ~ ~ ~]>").scale("A3:minor:pentatonic").s("piano")`;

/** U11.L05 on: the 12-bar blues in C on dominant sevenths, a root bass, a blues-scale riff. */
export const TWELVE_BAR = `setcpm(100/4)

const changes = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>"

drums: s("bd ~ sd ~, hh*8")
chords: chord(changes).voicing().s("piano")
bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)
riff: n("<[0 1 2 4] [3 2 0 ~]>").scale("C3:blues").s("piano")`;

/** U11.L07 on: the same 12 bars with a shuffle: swung hats and a swung riff. */
export const SHUFFLE = `setcpm(112/4)

const changes = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>"

hats: s("hh*8").swingBy(1/3, 4).gain(.5)
drums: s("bd ~ sd ~")
chords: chord(changes).voicing().s("piano")
bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)
riff: n("<[0 1 2 4] [3 2 0 ~]>").scale("C3:blues").swingBy(1/3, 4).s("piano")`;

/** A1.L02: a high-passed hat, a filtered sawtooth bass with resonance. */
export const A1_FILTERS = `setcpm(100/4)

kick: s("bd ~ bd ~")
snare: s("~ sd ~ sd")
hats: s("hh*8").hpf(6000).gain(.5)
bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).lpq(8)
mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>").scale("C4:major").s("sine")`;

/** A1.L03: a plucked bass (short decay, no sustain) and a riff that swells in. */
export const A1_ENVELOPES = `setcpm(100/4)

kick: s("bd ~ bd ~")
snare: s("~ sd ~ sd")
hats: s("hh*8").hpf(6000).gain(.5)
bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).decay(.2).sustain(0)
mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>").scale("C4:major").s("triangle").attack(.05).release(.3)`;

/** A1.L04: the snare in a room, the riff echoing in time (a dotted eighth at 100 BPM is 0.45 s; 0.375 s is close). */
export const A1_SPACE = `setcpm(100/4)

kick: s("bd ~ bd ~")
snare: s("~ sd ~ sd").room(.4).roomsize(4)
hats: s("hh*8").hpf(6000).gain(.5)
bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500)
mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>").scale("C4:major").s("triangle").delay(.3).delaytime(.375).delayfeedback(.4)`;

/** Stand-in Makes in course order (the seeder walks back from the end to the first the learner can run). */
export const STAND_INS: readonly StandInCode[] = [
  { id: "root-fifth", unit: "U08", code: ROOT_FIFTH_BASS },
  { id: "const-bass", unit: "U08", code: CONST_BASS },
  { id: "verse-chorus", unit: "U09", code: VERSE_CHORUS },
  { id: "aeolian", unit: "U10", code: AEOLIAN_LOOP },
  { id: "harmonic-minor", unit: "U10", code: HARMONIC_MINOR },
  { id: "pentatonic", unit: "U11", code: PENTATONIC_RIFF },
  { id: "twelve-bar", unit: "U11", code: TWELVE_BAR },
  { id: "shuffle", unit: "U11", code: SHUFFLE },
  { id: "filters", unit: "A1", code: A1_FILTERS },
  { id: "envelopes", unit: "A1", code: A1_ENVELOPES },
  { id: "space", unit: "A1", code: A1_SPACE },
];

/**
 * The stand-in for a session of `unit` (a lesson or checkpoint): the last candidate of that unit or an earlier core
 * unit (A1: its own first, then the core) whose every tool the learner can use there. `null`: none fits (the
 * seeder's Wave 3 fallbacks take over).
 */
export function pickStandIn(
  unit: string,
  usable: ReadonlySet<string>,
  toolbox: readonly ToolEntry[],
  /** The candidates, in course order (Wave 6 passes its own after these, seed-wave6.ts). */
  candidates: readonly StandInCode[] = STAND_INS,
): StandInCode | null {
  const fits = (c: StandInCode) => toolsUsed(c.code, toolbox).every((u) => usable.has(u.id));
  const core = candidates.filter(
    (c) => /^U\d{2}$/.test(c.unit) && (!/^U\d{2}$/.test(unit) || c.unit <= unit),
  );
  // Wave 7: a track unit (J1–J5, R1–R3, A1, A2) shows its own idea first.
  const own = /^[JRA]\d$/.test(unit) ? candidates.filter((c) => c.unit === unit) : [];
  for (const c of [...own].reverse()) if (fits(c)) return c;
  for (const c of [...core].reverse()) if (fits(c)) return c;
  return null;
}

// --- capstone drafts (C3–C5) ---------------------------------------------------------------------------------

/** C3.S1: groove and changes for verse and chorus (no melody yet), bass on the kick. */
export const C3_GROOVE = `setcpm(80/4)

const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G C C>").voicing()
const bassVerse = n("<[0 ~ 0 ~] [5 ~ 5 ~] [3 ~ 3 ~] [4 ~ 4 ~]>").scale("C2:major")
const bassChorus = n("<[3 ~ 3 ~] [4 ~ 4 ~] [0 ~ 0 ~] [0 ~ 0 ~]>").scale("C2:major")

kick: s("bd ~ bd ~")
snare: s("~ sd ~ sd")
hats: s("hh*8").gain(.5)
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus]).s("piano")
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus]).s("ebass").lpf(600)`;

/**
 * C3.S2–S3: verse, chorus, verse, chorus (8 bars each at 80 BPM: 96 seconds), the chorus melody a sixth higher and
 * its hats twice as dense, the bass on the kick (beats 1 and 3). Graded with the real rubric: form, contrast (3
 * axes), duration 96 s and groove lock 1.0 pass; the lead-sheet rule is the capstones author's.
 */
export const C3_SONG = `setcpm(80/4)

const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G C C>").voicing()
const bassVerse = n("<[0 ~ 0 ~] [5 ~ 5 ~] [3 ~ 3 ~] [4 ~ 4 ~]>").scale("C2:major")
const bassChorus = n("<[3 ~ 3 ~] [4 ~ 4 ~] [0 ~ 0 ~] [0 ~ 0 ~]>").scale("C2:major")
const melVerse = n("<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major")
const melChorus = n("<[7 7 9 7] [8 ~ 6 4] [7 9 11 9] [7 ~ ~ ~]>").scale("C4:major")
const hatsVerse = s("hh*4")
const hatsChorus = s("hh*8")

kick: s("bd ~ bd ~")
snare: s("~ sd ~ sd")
hats: arrange([8, hatsVerse], [8, hatsChorus], [8, hatsVerse], [8, hatsChorus]).gain(.5)
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus]).s("piano")
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus]).s("ebass").lpf(600)
mel: arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus]).s("piano")`;

/** C4.S1: the Aeolian verse i–VI–III–VII in A minor; the melody has ♭3 (C) and ♭6 (F). */
export const C4_VERSE = `setcpm(76/4)

drums: s("bd ~ sd ~, hh*4")
chords: chord("<Am F C G>").voicing().s("piano")
bass: note("<a1 f1 c2 g1>").s("ebass").lpf(600)
mel: n("<[4 ~ 2 0] [5 ~ 4 ~] [2 ~ 4 2] [1 ~ ~ ~]>").scale("A4:minor").s("piano")`;

/**
 * C4.S2: verse and chorus; the chorus cadence F G E Am uses the major V (E, raised 7) before i, and the melody ends
 * on 1 over i. Graded with the real rubric in A minor: every rule passes (1.00).
 */
export const C4_SONG = `setcpm(76/4)

const chordsVerse = chord("<Am F C G>").voicing()
const chordsChorus = chord("<F G E Am>").voicing()
const bassVerse = note("<a1 f1 c2 g1>")
const bassChorus = note("<f1 g1 e1 a1>")
const melVerse = n("<[4 ~ 2 0] [5 ~ 4 ~] [2 ~ 4 2] [1 ~ ~ ~]>").scale("A4:minor")
const melChorus = n("<[5 ~ 7 5] [6 ~ 1 ~] [4 ~ 1 ~] [7 ~ ~ ~]>").scale("A4:minor")

drums: s("bd ~ sd ~, hh*4")
chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus]).s("piano")
bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus]).s("ebass").lpf(600)
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus]).s("piano")`;

/** C5.S1: one 12-bar chorus of dominant sevenths with swung hats and a blues-scale riff. */
export const C5_CHORUS = SHUFFLE;

/**
 * C5.S2: two choruses (the riff answered in the second), the turnaround G7 in bar 12, swung hats (ratio 2), the riff
 * coming back (motif reuse 0.81).
 */
export const C5_SONG = `setcpm(112/4)

const changes = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>"
const melChorus = n("<[0 1 2 4] [3 2 0 ~]>").scale("C4:blues")
const melChorus2 = n("<[0 1 2 4] [5 4 3 ~]>").scale("C4:blues")

hats: s("hh*8").swingBy(1/3, 4).gain(.5)
drums: s("bd ~ sd ~")
chords: chord(changes).voicing().s("piano")
bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)
mel: arrange([12, melChorus], [12, melChorus2]).swingBy(1/3, 4).s("piano")`;

/** The seeded draft of a compose capstone session, by index (the last one is the release). */
export const CAPSTONE_DRAFTS: Readonly<Record<string, readonly string[]>> = {
  C3: [C3_GROOVE, C3_SONG, C3_SONG],
  C4: [C4_VERSE, C4_SONG],
  C5: [C5_CHORUS, C5_SONG],
};
/** The key each seeded draft is in (sketch versions carry it; C3 and C5 in C, C4 in A minor). */
export const CAPSTONE_KEYS: Readonly<Record<string, { tonic: string; mode: "major" | "minor" }>> = {
  C4: { tonic: "A", mode: "minor" },
};

/** Wave 5 points (wave5.md §6) with what each holds; `GET /api/dev/seed` lists them. */
export const WAVE5_SEED_DESCRIPTIONS: readonly DevSeedPoint[] = [
  {
    point: "after X1 (U08.L02 next)",
    description:
      "X1 released (C2 and X1 on the album, recordings, liner notes), U08.L01 done after GYM.03: today is U08.L02.",
  },
  {
    point: "after U08.L04",
    description:
      "Through U08.L04 (tb.const unlocked, fam.rhy.groove-lock seeded), the last yesterday: today is U08.L06.",
  },
  {
    point: "after U09.L01",
    description:
      "U08.L06, GYM.04 (a ladder session), U08.L05 and U09.L01 done: today is U09.L02 (arrange(), the form lens).",
  },
  {
    point: "after U09.L04",
    description:
      "GYM.05 (a ladder session, odd slot; own audio needs a project) and U09.L04 done (tb.signal, tb.range, tb.segment): today is U09.L05.",
  },
  { point: "U09.CP due", description: "U09.L05–L07, GYM.06 and U10.L01 done: today's New block is U09.CP." },
  { point: "C3 open", description: "U09.CP passed yesterday: C3 is open and today is C3.S1." },
  {
    point: "C3.S2 done",
    description:
      "C3.S1 (groove and changes) and C3.S2 completed; the saved draft is V C V C (8 bars each, 96 s) with verse and chorus melodies and the bass on the kick. Today is C3.S3.",
  },
  {
    point: "C3 released",
    description: "C3 released (v1, a recording, deterministic liner notes, no review): today is GYM.07.",
  },
  {
    point: "after U10.L02",
    description: "GYM.07 and U10.L02 (relative and parallel minor) done: today is U10.L03.",
  },
  {
    point: "after U10.L05",
    description: "U10.L03–L05 done (minor chords, the Aeolian loop): today is GYM.08.",
  },
  {
    point: "after U10.L08",
    description: "GYM.08 and U10.L06–L08 done (harmonic and melodic minor): today is U10.L09.",
  },
  { point: "U10.CP due", description: "U10.L09, GYM.09 and U11.L01 done: today's New block is U10.CP." },
  { point: "C4 open", description: "U10.CP passed yesterday: C4 is open and today is C4.S1." },
  {
    point: "C4 released",
    description:
      "C4.S1 (the Aeolian verse) and C4.S2 (the chorus with the major V) done, released: today is GYM.10.",
  },
  {
    point: "after U11.L03",
    description:
      "GYM.10, U11.L02 and U11.L03 done (the blues scale; snd.crunch, tb.distort): today is U11.L04.",
  },
  {
    point: "after U11.L06",
    description: "U11.L04–L05, GYM.11 and U11.L06 done: today is U11.L07 (swing).",
  },
  {
    point: "U11.CP due",
    description:
      "U11.L07–L08 and GYM.12 done (U12.L01 too once it is written; until then it is left out): today's New block is U11.CP.",
  },
  { point: "C5 open", description: "U11.CP passed yesterday: C5 is open and today is C5.S1." },
  {
    point: "C5.S1 done",
    description:
      "C5.S1 completed: the draft is one 12-bar chorus of dominant sevenths with swung hats and a blues-scale riff. Today is C5.S2.",
  },
  {
    point: "C5 released",
    description: "C5 released (two choruses, turnaround, a recording): X2 is open, today is X2.S1.",
  },
  { point: "X2 open", description: "The same as “C5 released”: X2 is open and today is X2.S1." },
  {
    point: "X2.S1 done",
    description:
      "X2.S1 completed on its first song: the bass check passed (≥ 0.90), then the changes. Today is X2.S2. Needs X2's song and checks written.",
  },
  {
    point: "X2 released",
    description:
      "X2 released: today is U12.L02 once it is written, else a review day (“The next lessons are still being written”).",
  },
  {
    point: "ladder L5",
    description:
      "Through U10.L05 with the ladder at L5, realism R0, one L5 song started yesterday (phrase 1 passed): today is GYM.08, a ladder L5 session.",
  },
  {
    point: "ladder L6",
    description:
      "Through C5 released with the ladder at L6, R1, one L6 song with its bass stage passed: today is X2.S1 (the gym is an alternative). Needs an L6 song written.",
  },
  {
    point: "ladder level-up due",
    description:
      "Through U09.L03 with the ladder at L4 and two graded L4 passes at R2 on the last two days: L5 is offered (`ladder.levelUp`, taken in Transcribe’s ladder panel); today is GYM.05. The Coda announces a level-up only in the session whose pass earned it, so this offer is not in today’s Coda: the c10 browser test earns it from the day before GYM.05 (U09.L03 since Oak 2.0 W2).",
  },
  {
    point: "ladder realism-up due",
    description:
      "Through U09.L03 with the ladder at L2, R1, and one session ≥ 0.9 at R1 yesterday: today's GYM.05 at ≥ 0.9 raises realism to R2 (c10).",
  },
  {
    point: "side lesson offered",
    description:
      "Through U03.L02 (the side-lesson gate), no side lesson done: today is U03.L03 with A1.L01 offered beside it.",
  },
  {
    point: "A1.L02 done",
    description:
      "Through U03.L02, then A1.L01 and A1.L02 on the next two days (tb.scope, tb.partials, tb.hpf, tb.bpf, tb.lpq, tb.lpenv): today is U03.L03 with A1.L03 offered.",
  },
  {
    point: "imported own-audio (c2)",
    description:
      "The 'own-audio project' point as if it came back through a backup import (carry-over c2): its code version is marked reviewBeforeRun (Transcribe shows it as text and lints it strictly until transcriptions.confirmVersion), every sketch version is flagged for review and every typed lesson attempt is marked imported. Today is GYM.02 (own audio).",
  },
];
