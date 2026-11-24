// U03.L10 By-Ear Transcription I. A short tune you hear can be written down by degrees: find home, find the
// first note, then follow each step up or down. What the learner has: degrees in `n` (U03.L02), `n` past 7
// and below 0 (U03.L03), `..` (U03.L04), keys as one word (U03.L05), syllables (U03.L08), tunes written
// from given degrees, leaps and `.legato()` (U03.L09). New here: the tune is only heard (AUTHORING §16.4).
// Spec: content/specs/U03.md.
//
// Repertoire (contracts §2.8), each the spec's fragment in a plain-rhythm setting, no pickup, no dot or tie:
// Auld Lang Syne (song.auld-lang-syne), Swing Low (song.swing-low), Michael, Row the Boat Ashore
// (song.michael-row). Degrees in C; the sources are in F, F and C. Answer keys still `verified: false`.
import { type ByEarSpec, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line written in degrees: `n` over a major scale. */
const deg = (pattern: string, key = "C4:major", extra = "") =>
  `${TEMPO}mel: n("${pattern}").scale("${key}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * Auld Lang Syne, the first phrase from the first full bar (the pickup "should" left out), each dotted
 * quarter and eighth as two quarters: 1 1 1 3 | 2 1 2 3 | 1 1 3 5 | 6. In F (the source): F F F A | G F G A
 * | F F A C | D. Over the vamp the held 6 (A) sits on the IV chord (F A C).
 */
const AULD = "<[0 0 0 2] [1 0 1 2] [0 0 2 4] [5@4]>";
/**
 * Swing Low, the opening of the chorus: "Swing low" on half notes (3, 1), "sweet" held two beats (3),
 * "char-i-" on quarters (1, then 6 below home), "-ot" on a held 5 below home; bar 4 rests. In F: A F | A F D
 * | C.
 */
const SWING = "<[2@2 0@2] [2@2 0 -2] [-3@4] ~>";
/** "Hallelujah" from Michael, Row the Boat Ashore: 3 5 6 on beats 2–4, then 5 held (E G A | G in C). */
const HALLELUJAH = "<[~ 2 4 5] [4@4]>";
/** The Make's phrase: the first two bars of Auld Lang Syne, then two empty bars to answer it. */
const PHRASE = "<[0 0 0 2] [1 0 1 2] ~ ~>";

/** The Band takes the key of the learner's `.scale()`. */
const BAND = { band: "band.two-chord-vamp", followsLearnerKey: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** By ear, in any key: the transposition rule shown before the learner starts (`any-key`). */
const BY_EAR: ByEarSpec = { ab: true, rates: [1, 0.75, 0.5], accepts: "any-key" };
/** Degrees and rhythm decide; the key and the octave do not (`transposition-invariant`). */
const BY_EAR_MATCHER: Matcher = {
  m: "melody",
  pitch: "transposition-invariant",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 16],
};
/**
 * Under `any-key` the learner's line is lined up with the source by its first note, so a slip reads as a
 * chromatic degree ("you have b2 (ra)") the learner has not met. Say where, and send them back to listen.
 */
const BY_EAR_TEXT = {
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: this note is not the tune's. Play both from this bar and sing the two notes: higher or lower?",
  // Heard, not typed: a whole tune one degree off started on the wrong note, so the fix is the first note.
  "melody.index-shift":
    "Every note is one degree {dir}: the shape is there, the start is not. Hum home, then the tune's first note, and count again.",
} as const;
const STARTER = `${TEMPO}mel: n("⟪0 ~ ~ ~⟫").scale("C4:major").s("piano")`;
const STARTER_PLAIN = `${TEMPO}mel: n("0 ~ ~ ~").scale("C4:major").s("piano")`;

export default defineLesson({
  id: "U03.L10",
  version: 5,
  title: "By-Ear Transcription I",
  objective: "I can hear a short tune, find home and its first note, and write the rest down in degrees.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["E07"],
  practises: [],
  terms: [],
  canDo: ["cd.transcribe.melody"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Know this tune?",
      minutes: 0.5,
      // Code and roll hidden: the tune is only heard, as in every step of this lesson.
      ui: { panels: NONE, band: BAND },
      exercise: {
        kind: "listen",
        id: "know-this-tune",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the four bars. Hum the tune's first note, then hum home, the note the tune keeps coming back to. Listen for whether they are the same note.",
        skills: [{ skill: "E07", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: deg(AULD), caption: "Four bars on the piano, nothing to read.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "Three or four notes",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "dictation",
        id: "three-or-four-notes",
        version: 1,
        role: "check",
        prompt:
          "Listen to the chords that set home, then to three or four notes, each one step from the one before. Tap their degrees on the pad in order, one tap per note.",
        skills: [{ skill: "E07", w: 1 }],
        hints: [
          {
            text: "Find the first note's degree first. Sing the notes back on syllables: is the first one home, or above it?",
          },
          {
            text: "Find the first note by singing down to do. Then each note moves one degree up or down: follow them.",
          },
          { text: "Hear it again, slower, and sing each note as it plays.", replay: { rate: 0.75 } },
          "auto",
        ],
        domain: "melody",
        // A drill trial (level 2: stepwise, degrees 1 to 5); its own notes become the reference when it plays.
        stimulus: { src: "generator", family: "fam.mel.dictation", level: 2 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 3 },
        answer: { ui: "degree-pad", set: ["1", "2", "3", "4", "5"], syllables: true },
        reference: { solutions: [deg("0 1 2 1")], bars: 1 },
        matcher: {
          m: "melody",
          pitch: "key-relative",
          wPitch: 1,
          wRhythm: 0,
          rhythmTol: [1, 16],
          track: "mel",
        },
        given: { rhythm: true },
        srs: [{ family: "fam.mel.dictation", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S3",
      kind: "dictate",
      title: "Swing low",
      minutes: 1.75,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree+solfege" },
      exercise: {
        kind: "dictation",
        id: "swing-low-by-ear",
        version: 1,
        role: "check",
        prompt:
          "Write the hidden tune in `n`: four bars inside `< >`, the fourth bar a silent `~`. Compare yours with the tune bar by bar, slower if you need. Any key passes, as long as every degree and its timing are right.",
        skills: [
          { skill: "E07", w: 0.8 },
          { skill: "S02", w: 0.2 },
        ],
        hints: ladder(
          "Start with the first note: hum it, then hum home. Is the first note above home or below it?",
          "It starts on degree 3 and drops to home, then goes below home. `n` counts from 0, so degree 3 is `n` 2, and the notes below home are negative.",
          "Bar 1 is `[2@2 0@2]`: degree 3, then home, two beats each. Bar 2 starts the same way and keeps falling, a quarter at a time.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: deg(SWING), bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: STARTER },
        reference: { solutions: [deg(SWING)], bars: 4 },
        matcher: BY_EAR_MATCHER,
        byEar: BY_EAR,
        feedbackText: BY_EAR_TEXT,
        srs: [{ family: "fam.mel.dictation", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: deg(SWING) }, expect: "pass" },
          { name: "in F, the source's key", response: { code: deg(SWING, "F4:major") }, expect: "pass" },
          {
            name: "the held notes written as rests",
            response: { code: deg("<[2 ~ 0 ~] [2 ~ 0 -2] [-3 ~ ~ ~] ~>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: STARTER_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the degrees typed as n",
            response: { code: deg("<[3@2 1@2] [3@2 1 -1] [-2@4] ~>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "right steps, but started on 2",
            response: { code: deg("<[1@2 -1@2] [1@2 -1 -3] [-4@4] ~>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "char-i-ot without the i",
            response: { code: deg("<[2@2 0@2] [2@2 0@2] [-3@4] ~>") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "sing",
      title: "Echo the hallelujah",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "echo-hallelujah",
        version: 1,
        role: "practice",
        prompt:
          "After the chord sets home, the piano plays four notes from another old tune. Sing those four notes straight back, on syllables or on any vowel.",
        skills: [
          { skill: "V03", w: 0.7 },
          { skill: "E07", w: 0.3 },
        ],
        hints: [
          { text: "Start from home: hum the note of the chord. Is the tune's first note above it?" },
          {
            text: "The first note is mi, a little above home. Then it climbs twice and steps back down once.",
          },
          { text: "Hear it again, slower, and sing along the second time.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        mode: "echo",
        stimulus: { src: "code", code: deg(HALLELUJAH), bars: 2, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        target: { from: "stimulus", track: "mel" },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "after",
        srs: [{ family: "fam.mel.echo", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "dictate",
      title: "Auld lang syne",
      minutes: 1.75,
      ui: { panels: ROLL, rollLabels: "degree+solfege" },
      exercise: {
        kind: "dictation",
        id: "auld-lang-syne-by-ear",
        version: 1,
        role: "practice",
        prompt:
          "Write the tune from the start of the lesson in `n`: four bars inside `< >`, the last note held through bar 4. Compare yours with the tune bar by bar, slower if you need. Any key passes, as long as every degree and its timing are right.",
        skills: [
          { skill: "E07", w: 0.8 },
          { skill: "S02", w: 0.2 },
        ],
        hints: ladder(
          "Find home first: hum the note the chords keep coming back to. Is the tune's first note the same?",
          "It starts on home and stays there for three beats. `n` counts from 0, so home is `n` 0.",
          "Bar 1 is `[0 0 0 2]`. Bar 2 moves between degree 2 and home: `n` 1, then 0, then 1, then up a step.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: deg(AULD), bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: STARTER },
        reference: { solutions: [deg(AULD)], bars: 4 },
        matcher: BY_EAR_MATCHER,
        byEar: BY_EAR,
        feedbackText: BY_EAR_TEXT,
        srs: [{ family: "fam.mel.dictation", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: deg(AULD) }, expect: "pass" },
          { name: "in G", response: { code: deg(AULD, "G4:major") }, expect: "pass" },
          {
            name: "the repeated home written with !",
            response: { code: deg("<[0!3 2] [1 0 1 2] [0!2 2 4] [5@4]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: STARTER_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            // One note of thirteen: transcription passes at 0.85 (contracts §6.12), and the learner reads which.
            name: "the last note one step low: close enough to pass",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [0 0 2 4] [4@4]>") },
            expect: "pass",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the degrees typed as n",
            response: { code: deg("<[1 1 1 3] [2 1 2 3] [1 1 3 5] [6@4]>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "bar 2 left out",
            response: { code: deg("<[0 0 0 2] ~ [0 0 2 4] [5@4]>") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Answer the phrase",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      exercise: {
        kind: "code-make",
        id: "answer-the-phrase",
        version: 1,
        role: "practice",
        prompt:
          "Write bars 3 and 4 as a copy of bars 1 and 2 at another height: add the same number to every `n`. Start bar 3 on degree 6, `n` 5, and the answer ends on home. Your four bars end your song. Done when bars 3 and 4 are bars 1 and 2 moved by one amount.",
        skills: [
          { skill: "E07", w: 0.5 },
          { skill: "M01", w: 0.5 },
        ],
        code: { starter: deg(PHRASE) },
        // Exactly the four bars of the brief: the reuse ratio below depends on the loop's length.
        bars: [4, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "same-shape",
            label: "Bars 3 and 4 copy bars 1 and 2, every note moved up or down by the same amount",
            required: true,
            // The phrase came in by ear; the answer is heard against it.
            skills: ["E07", "M01"],
            // Corrections pass: one move for the whole two-bar answer, counted in degrees (a tonal sequence, the
            // way tunes answer themselves: U03 moves lines by degrees, and half-step sizes of 3rds wait for
            // U04.L02). `motif-reuse` compared each bar with any earlier one, so `[5 5 5 7] [1 0 1 2]` (bar 3
            // moved, bar 4 a plain copy of bar 2) passed. Only moves by degrees can come home: the phrase ends on
            // 3, so the answer from 6 (`n` 5 or -2) ends on 1. `steps: "either"` keeps `motif-reuse`'s `shape:
            // "either"`: an exact move in half steps, out of the key, also keeps the shape.
            rule: "custom",
            fn: "transposed-copy",
            params: { track: "@melody", unitBars: 2, steps: "either", pairs: [[1, 3]] },
          },
          {
            id: "ends-home",
            label: "The line's last note is degree 1, home",
            required: false,
            skills: ["E04"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "joined",
            label: "Uses `.legato()` to join the notes",
            required: false,
            skills: ["M01"],
            rule: "uses",
            tool: "tb.legato",
          },
        ],
        hints: ladder(
          "Bars 3 and 4 copy the shape of bars 1 and 2 at another height. Sing bars 1 and 2: which notes repeat, and where does the line step up?",
          "Bars 3 and 4 copy bars 1 and 2 with every number moved by the same amount. The phrase ends on 3; to end the answer on home, move it so that its last note becomes 1.",
          "Bar 3 is `[5 5 5 7]`: bar 1 with 5 added to each number, so its 3 becomes the 1 above home. Do the same to bar 2.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: deg(PHRASE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the phrase again from 6, ending on home",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [5 5 5 7] [6 5 6 7]>") },
            expect: "pass",
          },
          {
            name: "from 6 below home: the same answer an octave down",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [-2 -2 -2 0] [-1 -2 -1 0]>") },
            expect: "pass",
          },
          {
            name: "from 5: every half step kept, ending open on 7",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [4 4 4 6] [5 4 5 6]>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: hats, legato, the answer below home",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: n("<[0 0 0 2] [1 0 1 2] [-3 -3 -3 -1] [-2 -3 -2 -1]>").scale("C4:major").legato(.9).s("piano")`,
            },
            expect: "pass",
          },
          {
            // Long notes have no steps to compare, so nothing in bars 3–4 reuses the phrase.
            name: "an answer of two held notes",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [4@4] [0@4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            // Passed at `minRatio: 0.5`, where the loop's own repeats made up the ratio.
            name: "an answer with no link to the phrase",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [4 2 0 -3] [0 4 2 0]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            // From 2 the 3rd shrinks (D–F is three half steps, C–E four), but in degrees the shape holds: a
            // tonal sequence, which is how tunes answer themselves in a key.
            name: "moved by degrees from 2: the same shape in the key",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [1 1 1 3] [2 1 2 3]>") },
            expect: "pass",
          },
          {
            // Only bar 3 answers; bar 4 goes its own way: 1 of 4 bars.
            name: "bar 3 answers, bar 4 does not",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [5 5 5 7] [7@4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            // The outside review's counterexample: bar 3 moved, bar 4 a plain copy of bar 2.
            name: "bar 3 moved, bar 4 left at the height of bar 2",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [5 5 5 7] [1 0 1 2]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bars 1 and 2 again at the same height",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [0 0 0 2] [1 0 1 2]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "two steps up, written as note names",
            response: {
              code: `${TEMPO}mel: note("<[c4 c4 c4 e4] [d4 c4 d4 e4] [e4 e4 e4 g4] [f4 e4 f4 g4]>").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "a step down, with legato",
            response: {
              code: deg("<[0 0 0 2] [1 0 1 2] [-1 -1 -1 1] [0 -1 0 1]>", "C4:major", ".legato(.9)"),
            },
            expect: "pass",
          },
          {
            name: "from 4 as well: F up to A is the same 3rd as C up to E",
            response: { code: deg("<[0 0 0 2] [1 0 1 2] [3 3 3 5] [4 3 4 5]>") },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
