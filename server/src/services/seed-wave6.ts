// Wave 6 dev-seed material (docs/design/wave6.md §6): the course code a seeded learner saved for a U12–U17 lesson
// that is not written yet (a stand-in Make), and the drafts of C6, C7 and CF-A session by session. Every piece is real
// course code: `seed-wave6.test.ts` lints it with the toolbox-aware lint under the unlocks the learner has at that
// point, evaluates it headlessly and grades the capstone pieces with the real rubric of their briefs. Each says
// something true about its unit: seventh chords (U12), a pushed chord (U13), a Mixolydian vamp (U14), a secondary
// dominant with its chromatic note (U15), the borrowed iv (U16), a last chorus a whole step up (U17).
import type { DevSeedPoint } from "@oak/api";
import type { StandInCode } from "./seed-wave5.ts";

/** U12.L01 on: Imaj7 vi7 ii7 V7 in C on the Rhodes, the tune on chord tones. */
export const SEVENTHS = `setcpm(84/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<C^7 Am7 Dm7 G7>").voicing().s("rhodes")
bass: note("<c2 a1 d2 g1>").s("ebass").lpf(600)
mel: n("<[4 ~ 6 4] [2 ~ 4 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major").s("piano")`;

/** U13.L01 on: the chords arrive an eighth early (a push) over a bass that stays on the beat. */
export const PUSHED = `setcpm(96/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<Dm7 G7 C^7 Am7>").voicing().early(1/8).s("rhodes")
bass: note("<[d2 ~ d2 ~] [g1 ~ g1 ~] [c2 ~ c2 ~] [a1 ~ a1 ~]>").s("ebass").lpf(600)`;

/** U14.L01 on: a G Mixolydian vamp, I–♭VII, the ♭7 (F) on beat 1 of the tune. */
export const MIXOLYDIAN_VAMP = `setcpm(100/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<G G F G>").voicing().s("piano")
bass: note("<g1 g1 f1 g1>").s("ebass").lpf(600)
mel: n("<[6 ~ 4 2] [0 ~ 2 4] [6 ~ 5 4] [0 ~ ~ ~]>").scale("G4:mixolydian").s("piano")`;

/** U15.L01 on: V7/ii (A7) before Dm; the tune leans on ♯1 (C♯, written 0#) over it. */
export const SECONDARY_DOMINANT = `setcpm(92/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<C A7 Dm G7>").voicing().s("piano")
bass: note("<c2 a1 d2 g1>").s("ebass").lpf(600)
mel: n("<[4 ~ 2 0] [0# ~ 2 4] [3 ~ 1 3] [4 ~ ~ ~]>").scale("C4:major").s("piano")`;

/** U16.L01 on: IV then the borrowed iv (Fm) before home; the tune takes ♭6 (A♭, written 5b) over it. */
export const BORROWED_FOUR = `setcpm(84/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<C F Fm C>").voicing().s("piano")
bass: note("<c2 f1 f1 c2>").s("ebass").lpf(600)
mel: n("<[4 ~ 2 4] [5 ~ 3 5] [5b ~ 3 ~] [4 ~ ~ ~]>").scale("C4:major").s("piano")`;

/** U17.L02 on: the chorus, then the chorus a whole step up: a key plan after the tune, the chord names moved. */
export const LIFTED_CHORUS = `setcpm(100/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<C G Am F D A Bm G>").voicing().s("piano")
bass: n("<0 4 5 3>").scale("<C2:major!4 D2:major!4>").s("ebass").lpf(600)
mel: n("<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>").scale("<C4:major!4 D4:major!4>").s("piano")`;

/** Stand-in Makes of Wave 6 in course order (after the Wave 5 ones; the seeder picks the latest that fits). */
export const WAVE6_STAND_INS: readonly StandInCode[] = [
  { id: "sevenths", unit: "U12", code: SEVENTHS },
  { id: "pushed", unit: "U13", code: PUSHED },
  { id: "mixolydian", unit: "U14", code: MIXOLYDIAN_VAMP },
  { id: "secondary", unit: "U15", code: SECONDARY_DOMINANT },
  { id: "borrowed", unit: "U16", code: BORROWED_FOUR },
  { id: "lifted", unit: "U17", code: LIFTED_CHORUS },
];

// --- capstone drafts (C6, C7, CF-A) --------------------------------------------------------------------------

/** C6.S1: the vamp and its colour note: I–♭VII in G Mixolydian with the ♭7 on beat 1 of a two-bar idea. */
export const C6_VAMP = `setcpm(100/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<G G F G>").voicing().s("piano")
bass: note("<g1 g1 f1 g1>").s("ebass").lpf(600)
mel: n("<[6 ~ 4 2] [0 ~ ~ ~]>").scale("G4:mixolydian").s("piano")`;

/**
 * C6.S2 and the release: sixteen bars of G Mixolydian. The ♭7 (F, index 6) sits on beat 1 of nine bars, the tune
 * never plays the leading tone (F♯ is not in the scale) and the home chord G is under twelve of the sixteen bars.
 */
export const C6_SONG = `setcpm(100/4)

drums: s("bd ~ sd ~, hh*8")
chords: chord("<G G F G>").voicing().s("piano")
bass: note("<g1 g1 f1 g1>").s("ebass").lpf(600)
mel: n("<[6 ~ 4 2] [0 ~ 2 4] [6 ~ 5 4] [0 ~ ~ ~] [6 ~ 4 2] [0 ~ 2 4] [3 ~ 6 4] [0 ~ ~ ~] [6 ~ 7 6] [4 ~ 2 0] [6 ~ 5 4] [0 ~ ~ ~] [6 ~ 4 2] [0 ~ 2 4] [6 ~ 4 2] [0 ~ ~ ~]>").scale("G4:mixolydian").s("piano")`;

const C7_CONSTS = `const changesVerse = "<C Am F G C A7 Dm G>"
const changesChorus = "<F G C Am F Ab Bb C>"
const chordsVerse = chord(changesVerse).voicing()
const chordsChorus = chord(changesChorus).voicing()
const bassVerse = chord(changesVerse).rootNotes(2)
const bassChorus = chord(changesChorus).rootNotes(2)`;

/** C7.S1: the colour chords in sections: V7/ii (A7) into Dm in the verse, ♭VI–♭VII–I (Ab Bb C) in the chorus. */
export const C7_COLOURS = `setcpm(100/4)

${C7_CONSTS}

drums: s("bd ~ sd ~, hh*8")
chords: arrange([8, chordsVerse], [8, chordsChorus]).s("piano")
bass: arrange([8, bassVerse], [8, bassChorus]).s("ebass").lpf(600)`;

const C7_TUNES = `const melVerse = n("<[2 ~ 2 1] [0 ~ ~ ~] [3 ~ 3 2] [1 ~ ~ ~] [2 ~ 2 1] [0# ~ ~ ~] [3 ~ 3 2] [1 ~ ~ ~]>")
const melChorus = n("<[5 ~ 5 7] [6 ~ 4 ~] [7 ~ 7 9] [7 ~ 5 ~] [5 ~ 5 7] [7 ~ ~ ~] [8 ~ ~ ~] [9 ~ ~ ~]>")`;

/**
 * C7.S2: verse, chorus, verse, chorus (32 bars) with the tunes; the secondary dominant resolves (A7 to Dm) and the
 * chorus ends ♭VI–♭VII–I. Everything is in C: no key lift yet (that is C7.S3's work).
 */
export const C7_SECTIONS = `setcpm(100/4)

${C7_CONSTS}
${C7_TUNES}

drums: s("bd ~ sd ~, hh*8")
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus]).s("piano")
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus]).s("ebass").lpf(600)
mel: arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus]).scale("C4:major").s("piano")`;

/**
 * C7.S3 and the release: the same song with a fifth section, the last chorus a whole step up for eight bars (40 bars).
 * The chord names move in a variant of the chorus (`…Chorus2`, STYLE §10: every arranged track lists the same
 * sections); the tune keeps its degrees and takes a key plan after `arrange()`. content/specs/U17.md pins this piece.
 */
export const C7_SONG = `setcpm(100/4)

${C7_CONSTS}
const changesChorus2 = "<G A D Bm G Bb C D>"
const chordsChorus2 = chord(changesChorus2).voicing()
const bassChorus2 = chord(changesChorus2).rootNotes(2)
${C7_TUNES}

drums: s("bd ~ sd ~, hh*8")
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus], [8, chordsChorus2]).s("piano")
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus], [8, bassChorus2]).s("ebass").lpf(600)
mel: arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus], [8, melChorus]).scale("<C4:major!32 D4:major!8>").s("piano")`;

const CFA_CONSTS = `const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G E7 Am F G C C>").voicing()
const chordsBridge = chord("<Fm Fm C C Ab Bb G G>").voicing()
const chordsChorus2 = chord("<G A F#7 Bm G A D D>").voicing()
const bassVerse = n("<0 5 3 4>").struct("x ~ ~ x ~ x ~ ~")
const bassChorus = n("<3 4 2 5 3 4 0 0>").struct("x ~ ~ x ~ x ~ ~")
const bassBridge = n("<3 3 0 0 5b 6b 4 4>").struct("x ~ x ~")`;
const CFA_TUNES = `const melVerse = n("<[4 ~ 4 2] [0 ~ ~ ~] [3 4 5 7] [7@2 6@2]>")
const melChorus = n("<[7 ~ 7 5] [8 ~ 8 ~] [9 8 6 4#] [5 ~ ~ ~] [7 ~ 7 5] [8 ~ 8 9] [7 ~ ~ ~] ~>")
const melBridge = n("<[5b ~ 4 3] [5b ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5b 4] [8 ~ 6b 3] [8 ~ ~ ~] [6 ~ ~ ~]>")`;
const CFA_KIT = `kick: s("bd ~ bd ~").gain(.8)
snare: s("~ sd ~ sd").gain(.8)
hats: s("hh*8").gain(.4)`;

/** CF-A.S1: the plan and the groove: verse, chorus and bridge on diatonic chords, the bass between the beats. */
export const CFA_PLAN = `setcpm(100/4)

const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G Em Am F G C C>").voicing()
const chordsBridge = chord("<Dm Dm C C F G G G>").voicing()
const bassVerse = n("<0 5 3 4>").struct("x ~ ~ x ~ x ~ ~")
const bassChorus = n("<3 4 2 5 3 4 0 0>").struct("x ~ ~ x ~ x ~ ~")
const bassBridge = n("<1 1 0 0 3 4 4 4>").struct("x ~ x ~")

${CFA_KIT}
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsBridge], [8, chordsChorus]).s("piano").gain(.5)
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassBridge], [8, bassChorus]).scale("C2:major").s("ebass").lpf(700)`;

/**
 * CF-A.S2: the harmony with its devices and no tune yet: V7/vi into vi in the chorus, the borrowed iv and ♭VI–♭VII in
 * the bridge, the last chorus a whole step up (the `…Chorus2` names and a key plan on the bass).
 */
export const CFA_HARMONY = `setcpm(100/4)

${CFA_CONSTS}

${CFA_KIT}
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsBridge], [8, chordsChorus], [8, chordsChorus2]).s("piano").gain(.5)
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassBridge], [8, bassChorus], [8, bassChorus]).scale("<C2:major!32 D2:major!8>").s("ebass").lpf(700)`;

/**
 * CF-A.S3: the tunes and the bridge: verse, chorus, bridge, chorus and the lifted chorus, 40 bars at 100 BPM (96
 * seconds: shorter than the two minutes the brief asks for, which is CF-A.S4's work) with the four devices in place.
 */
export const CFA_TUNES_DRAFT = `setcpm(100/4)

${CFA_CONSTS}
${CFA_TUNES}

${CFA_KIT}
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsBridge], [8, chordsChorus], [8, chordsChorus2]).s("piano").gain(.5).room(.3)
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassBridge], [8, bassChorus], [8, bassChorus]).scale("<C2:major!32 D2:major!8>").s("ebass").lpf(700)
mel: arrange([8, melVerse], [8, melChorus], [8, melBridge], [8, melChorus], [8, melChorus]).scale("<C4:major!32 D4:major!8>").s("piano").room(.25)`;

/**
 * CF-A.S4 and the release: the single arranged to length — verse chorus verse chorus bridge chorus and the last
 * chorus a whole step up, 56 bars at 100 BPM (134.4 seconds). The pop reference of content/specs/CF.md, which
 * content/specs/finale.test.ts grades with the real grader.
 */
export const CFA_SINGLE = `setcpm(100/4)

${CFA_CONSTS}
${CFA_TUNES}

${CFA_KIT}
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus], [8, chordsBridge], [8, chordsChorus], [8, chordsChorus2]).s("piano").gain(.5).room(.3)
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus], [8, bassBridge], [8, bassChorus], [8, bassChorus]).scale("<C2:major!48 D2:major!8>").s("ebass").lpf(700)
mel: arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus], [8, melBridge], [8, melChorus], [8, melChorus]).scale("<C4:major!48 D4:major!8>").s("piano").room(.25)`;

/** The seeded draft of a Wave 6 compose capstone session, by index (the last one is the release). */
export const WAVE6_CAPSTONE_DRAFTS: Readonly<Record<string, readonly string[]>> = {
  C6: [C6_VAMP, C6_SONG],
  C7: [C7_COLOURS, C7_SECTIONS, C7_SONG],
  "CF-A": [CFA_PLAN, CFA_HARMONY, CFA_TUNES_DRAFT, CFA_SINGLE],
};
/** The key of each seeded draft (C6 in G Mixolydian; C7 and CF-A start in C). */
export const WAVE6_CAPSTONE_KEYS: Readonly<Record<string, { tonic: string; mode: string }>> = {
  C6: { tonic: "G", mode: "mixolydian" },
};

/** The tab another browser left a session open from in the point `second tab (d21)`. */
export const SECOND_TAB_ID = "tab_00000000000000aa";

/** Wave 6 points (wave6.md §6) with what each holds; `GET /api/dev/seed` lists them. */
export const WAVE6_SEED_DESCRIPTIONS: readonly DevSeedPoint[] = [
  {
    point: "after X2 (U12.L02 next)",
    description:
      "The Wave 5 point “X2 released” under its Wave 6 name: C5 and X2 on the album, U12.L01 done (it precedes GYM.12), chord.seventh unlocked. Today is U12.L02.",
  },
  {
    point: "after U12.L05",
    description:
      "U12.L02–L05 done (chord.seventh-dim, the diatonic sevenths, fam.chd.quality-7th seeded), the last yesterday. Today is GYM.13, a gym slot.",
  },
  {
    point: "after U13.L03",
    description:
      "GYM.13, U12.L06 (tb.dict.lefthand, jazzgtr) and U13.L01–L03 (tb.early, tb.late, tb.velocity, cleangtr) done. Today is GYM.14.",
  },
  {
    point: "U13.CP due",
    description:
      "GYM.14, U13.L04–L06 (tb.meter.compound, tb.ply), U14.L01 and GYM.15 done. Today's New block is U13.CP.",
  },
  {
    point: "tracks open (after U13.CP)",
    description:
      "U13.CP passed yesterday: the gates J.main and R.main are recorded and yesterday's summary carries them (gatesOpened). Today is U14.L02 with plan.tracks = { open: [J, R], lessonsAuthored: false }; tracks.list shows both open with no next lesson.",
  },
  {
    point: "after U14.L03",
    description: "U14.L02–L03 done (scale.mixolydian, scale.dorian). Today is U14.L04.",
  },
  {
    point: "U14.CP due",
    description:
      "U14.L04, GYM.16, U14.L05–L06 and U15.L01 (tb.n.chromatic; CF-T's gate met) done. Today's New block is U14.CP.",
  },
  {
    point: "CF-T open (U15.L01 done)",
    description:
      "U14.CP passed yesterday (gate J.chord-scales recorded); CF-T is open and not started. Today is CF-T.S1 in the transcription slot (plan.kind capstone, slot.fills cf-t; gym.plan.cfT.takesSlot). Needs a CF-T standard with an answer key.",
  },
  {
    point: "C6 open",
    description:
      "CF-T.S1 completed on its first standard (the form map and the bass passed) once a standard has an answer key; until then the slot CF-T.S1 would take is a gym session, as Today has it. Today is C6.S1.",
  },
  {
    point: "C6 released",
    description:
      "C6.S1–S2 done and released: sixteen bars of G Mixolydian with the ♭7 on strong beats, a recording, liner notes. Today is U15.L02.",
  },
  {
    point: "CF-T.S2 done",
    description:
      "U15.L02–L03 done and CF-T.S2 completed (the changes passed); the draft is tagged with its song and kept in the song's key. Today is U15.L04. Needs a CF-T standard with an answer key.",
  },
  {
    point: "after U15.L05",
    description: "U15.L04–L05 done (snd.horns, snd.trumpet). Today is U15.L06.",
  },
  {
    point: "after U16.L03",
    description:
      "U15.L06 (gate J.forms recorded), U16.L01, CF-T.S3 (the melody passed) and U16.L02–L03 done. Today is U16.L04.",
  },
  {
    point: "after U17.L02",
    description: "U16.L04–L05 (snd.tenor), CF-T.S4 (CF-T released) and U17.L01–L02 done. Today is U17.L03.",
  },
  { point: "U17.CP due", description: "U17.L03–L04 and GYM.17 done. Today's New block is U17.CP." },
  {
    point: "C7 open",
    description: "U17.CP passed yesterday (gate J.reharmonization recorded): C7 is open and today is C7.S1.",
  },
  {
    point: "C7.S2 done",
    description:
      "C7.S1–S2 completed with a saved draft: verse and chorus sections (32 bars), A7 resolving to Dm, ♭VI–♭VII–I, a melody; everything in C, no key lift yet. Today is C7.S3.",
  },
  {
    point: "C7 released",
    description:
      "C7 released: 40 bars, the last chorus a whole step up for eight bars (a key plan on the tune, the chord names moved in chordsChorus2). Today is GYM.18.",
  },
  { point: "CF-A open", description: "GYM.18 done: CF-A is open and today is CF-A.S1." },
  {
    point: "CF-A.S3 done",
    description:
      "CF-A.S1–S3 completed with a saved draft: verse, chorus and bridge with four devices (V7/vi, the borrowed iv, ♭VI–♭VII, the lifted last chorus), 40 bars, 96 seconds: shorter than 2:00. Today is CF-A.S4 and plan.core is lessons-done.",
  },
  {
    point: "core complete",
    description:
      "Everything through CF-A.S4 (session 191): all twelve Side A tracks released with recordings; yesterday's summary carries coreComplete. Today is a review day (or the gym slot's day) with plan.core complete and plan.tracks set; course.completion.stage is complete. Needs a CF-T standard with an answer key.",
  },
  {
    point: "ladder L8",
    description:
      "Through “after U17.L02” (CF-T released) with the ladder at L8, realism R1, and one L8 standard that is not CF-T's song with its form map and its bass passed. Today is U17.L03; Transcribe opens the item at its changes stage. Needs two standards with answer keys.",
  },
  {
    point: "C3.S3 in progress (d13)",
    description:
      "U09.CP passed, C3.S1–S2 completed and C3.S3 started as the three-session C3 had it: a draft with the arranged sections (V C V C, 96 s) and its rubric check passed, no take. Today C3.S3 resumes with nothing lost; C3.S4 (the take and the release) follows.",
  },
  {
    point: "C3.S3 done",
    description:
      "C3.S1–S3 completed (the arranged song, the lead-sheet check passed). Today is C3.S4: the take, the review and the release.",
  },
  {
    point: "two takes (d20)",
    description:
      "“C3 released” with a second take recorded on version 1: takes of 2, currentTake 2 (take 1 is still served with ?take=1). Today is GYM.07.",
  },
  {
    point: "second tab (d21)",
    description:
      "“after X2 (U12.L02 next)” with a lesson session already open today from another tab (tabId tab_00000000000000aa, phase main, U12.L02). A spec's own tab starts its own session.",
  },
];
