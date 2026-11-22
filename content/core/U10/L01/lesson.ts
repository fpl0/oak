// U10.L01 The Dark Twin (exemplar of U10). Natural minor is the major scale's dark twin: the same home, the
// same numbers, with degrees 3, 6 and 7 a half step lower (♭3 ♭6 ♭7), sung do re me fa sol le te (do-based
// minor: 1 is still do). In code it is one word, `.scale("C4:minor")` for `.scale("C4:major")` (unlocked here),
// and every line written in degrees turns dark at once. What the learner has: degrees and `n` (U03), the
// patterned `.scale()` (U03.L05), note names with sharps and flats (U03.L06–L07), chord stacks moved with
// `.add()` (U06.L01), the root bass (U08.L01), `arrange()` and sections (U09). Not yet: the names of the two
// twin keys, relative and parallel (U10.L02), minor chords by numeral (U10.L04), the raised 7 (U10.L06).
// Spec: content/specs/U10.md.
//
// How it is graded (AUTHORING §18.3): the key is C minor, `{ tonic: "C", mode: "minor" }`, and every degree is
// spelled against major on the same home (E♭ is ♭3, never 3 of E♭ major). The modify step is a tune in note
// names (`events`, absolute): the learner flattens the three letters minor lowers, which a one-word `.scale()`
// swap cannot do for them. The Make's required rule is `degree-set` with `contains: ["b3", "b6"]`, judged in the
// lesson's key, on the melody: me and le, the two notes that make minor sound minor.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The four-chord loop as stacks (U06.L01), on a Rhodes with a little room: indie and soul both use it. */
const chords = (key: string) =>
  `chords: n("[0,2,4]").add(n("<0 4 5 3>")).scale("${key}").s("rhodes").room(.3)`;
/** The root bass of U08.L01, an octave below the chords. */
const bass = (key: string) => `bass: n("<0 4 5 3>").scale("${key}").s("ebass").lpf(600)`;
/** The U05.L01 tune: chord notes on every beat it plays, so it stays on the chords in either key. */
const TUNE = "<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>";
const mel = (key: string, tune = TUNE) => `mel: n("${tune}").scale("${key}").s("piano")`;

/** Four bars in C major, then the same four with one word changed: minor. */
const TWINS = code(
  chords("<C3:major!4 C3:minor!4>"),
  bass("<C2:major!4 C2:minor!4>"),
  mel("<C4:major!4 C4:minor!4>"),
);
const DARK = [chords("C3:minor"), bass("C2:minor")] as const;
/** The two scales from home to home, major then minor, over a held C. */
const RUN = code(
  'mel: n("0 .. 7").scale("<C4:major C4:minor>").s("piano")',
  'bass: n("0").scale("C2:minor").s("ebass").lpf(600)',
);
/** The tune in note names: major letters (the starter), minor letters (the answer). */
const notes = (tune: string) => `mel: note("${tune}").s("piano")`;
const MAJOR_LETTERS = "<[g4 ~ e4 g4] [b4 ~ g4 ~] [a4 ~ c5 a4] [a4 ~ f4 ~]>";
const MINOR_LETTERS = "<[g4 ~ eb4 g4] [bb4 ~ g4 ~] [ab4 ~ c5 ab4] [ab4 ~ f4 ~]>";
const MODIFY_STARTER = code(...DARK, `mel: note("⟪${MAJOR_LETTERS}⟫").s("piano")`);
const MODIFY_SOLUTION = code(...DARK, notes(MINOR_LETTERS));
/** Sung: do re me fa sol le sol, the minor scale's lower half and its sigh, le to sol. */
const SING = code(
  'mel: n("<[0 1 2 3] [4 5 4 ~]>").scale("C4:minor").s("piano")',
  'bass: n("0").scale("C2:minor").s("ebass").lpf(600)',
);
/** The Make starts with the dark loop and a tune that only says home. */
const MAKE_STARTER = code(...DARK, mel("C4:minor", "0 ~ 0 ~"));

/** Drums from the Band; the chords, the bass and the tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "C", mode: "minor" } as const;

export default defineLesson({
  id: "U10.L01",
  version: 3,
  title: "The Dark Twin",
  objective:
    "I can turn a tune minor by lowering degrees 3, 6 and 7, and sing the minor scale as do re me fa sol le te.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["S05"],
  practises: [],
  terms: [{ id: "term.natural-minor", step: "S3" }],
  canDo: ["cd.write.minor-scale"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One word darker",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: TWINS, bars: 8 },
      exercise: {
        kind: "listen",
        id: "one-word-darker",
        version: 1,
        role: "practice",
        prompt:
          "Listen to all eight bars. Bars 5–8 repeat bars 1–4 with one word changed in every line. Listen for the bar where the mood turns, and for whether the tune sounds brighter or darker after it.",
        skills: [{ skill: "S05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: TWINS,
            caption: "Bars 1–4 as you know them; bars 5–8 with one word changed in every line.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "What changed?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "what-changed",
        version: 1,
        role: "practice",
        prompt:
          "Predict what happens to the notes at bar 5, where each line's scale word changes from `major` to `minor` and the numbers in `n()` stay the same. Pick one answer, then hear it.",
        skills: [{ skill: "S05", w: 1 }],
        hints: null,
        tests: [],
        code: TWINS,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "three-lower", label: "Home stays on C; a few notes of the scale move down a half step" },
          { id: "all-lower", label: "Every note moves down a half step" },
          { id: "new-home", label: "Home moves to another note, and the tune follows it" },
        ],
        correct: ["three-lower"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Three notes lower",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "two-scales", code: RUN, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "three-notes-lower",
        version: 1,
        role: "practice",
        prompt:
          "Run the code: bar 1 climbs home to home in C major, bar 2 does the same in C minor. Compare the two bars on the roll, degree by degree. Then answer both questions: which degrees sit lower in bar 2, and by how many half steps.",
        skills: [{ skill: "S05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Put bar 1 and bar 2 side by side on the roll: three of the eight notes sit lower in bar 2, each by the smallest step on the keyboard.",
        },
        hints: ladder(
          "Find the notes that sit lower in bar 2 than in bar 1. Which degrees are they?",
          "Read the degree labels in bar 2. Where a number has a ♭ in front of it, the note moved.",
          "Degree 3 is E in bar 1 and E♭ in bar 2. Count the keys from E down to E♭.",
        ),
        code: { starter: RUN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which degrees are lower in the second bar?",
            options: [
              { id: "3-6-7", label: "3, 6 and 7" },
              { id: "2-5-6", label: "2, 5 and 6" },
              { id: "all", label: "Every degree but 1" },
            ],
            correct: ["3-6-7"],
          },
          { q: "number", prompt: "How many half steps lower is degree 3 in the second bar?", correct: 1 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["3-6-7"], number: 1 } }, expect: "pass" },
          {
            name: "every degree",
            response: { answer: { choice: ["all"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step",
            response: { answer: { choice: ["3-6-7"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Darken it by hand",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "darken-it-by-hand",
        version: 1,
        role: "check",
        prompt:
          "The chords and bass are in C minor, but the `mel:` line still uses C major's letters. Lower degrees 3, 6 and 7 of C by a half step everywhere they appear: write each as a flat, letter then `b`. Keep the rhythm and the octave numbers. Done when the tune uses only C minor's notes.",
        skills: [{ skill: "S05", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["mel"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: the tune plays {got}, the minor tune has {exp}. Minor lowers degrees 3, 6 and 7 of C: E, A and B.",
          "melody.octave":
            "Bar {bar}: the right letter in the wrong octave. Keep the number after each letter as it was.",
        },
        hints: ladder(
          "Minor lowers degrees 3, 6 and 7. Count up from C to find the letter of each one.",
          "From C, degree 3 is E, degree 6 is A and degree 7 is B. Each one takes a `b` after its letter.",
          "Bar 1 becomes `[g4 ~ eb4 g4]`. Find the B in bar 2 and the A's in bars 3 and 4.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "the same notes spelled with sharps",
            response: {
              code: code(...DARK, notes("<[g4 ~ d#4 g4] [a#4 ~ g4 ~] [g#4 ~ c5 g#4] [g#4 ~ f4 ~]>")),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(...DARK, notes(MAJOR_LETTERS)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "only the 3rd lowered",
            response: { code: code(...DARK, notes("<[g4 ~ eb4 g4] [b4 ~ g4 ~] [a4 ~ c5 a4] [a4 ~ f4 ~]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the flat an octave up",
            response: {
              code: code(...DARK, notes("<[g4 ~ eb5 g4] [bb4 ~ g4 ~] [ab4 ~ c5 ab4] [ab4 ~ f4 ~]>")),
            },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "the chords put back in major",
            response: { code: code(chords("C3:major"), bass("C2:minor"), notes(MINOR_LETTERS)) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Major or minor?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "major-or-minor",
        version: 1,
        role: "check",
        prompt:
          "Name each short tune as major or minor; each one is in a new key. Listen to the note the tune comes home to: bright means major, dark means minor.",
        // S05, not E10: the node E10 (minor degrees by ear) is introduced in U10.L03; `fam.key.mode` gives the
        // drill's own evidence from tomorrow's warm-up on.
        skills: [{ skill: "S05", w: 1 }],
        hints: [
          {
            text: "Hum the note the tune comes home to, then listen to the notes just above it. Bright or dark?",
          },
          { text: "Listen for degree 3, a few steps above home: in minor it sits a half step lower." },
          {
            text: "Hear it again, slower, and sing home, then two steps up: do re mi, or do re me?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.key.mode", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "major", label: "Major" },
            { id: "minor", label: "Minor" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.key.mode", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the dark scale",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-dark-scale",
        version: 1,
        role: "practice",
        prompt:
          "Listen, then sing seven notes: do re me fa sol le sol. Climb from do up to le, then fall a half step back to sol. Sing in your own range.",
        skills: [
          { skill: "V02", w: 0.6 },
          { skill: "S05", w: 0.4 },
        ],
        hints: [
          { text: "Hum do, the held note underneath, before you start." },
          {
            text: "Me is a half step lower than the mi you know; le sits a half step above sol and falls back to it.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["1", "2", "b3", "4", "5", "b6", "5"] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A dark tune",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "a-dark-tune",
        version: 1,
        role: "practice",
        prompt:
          "Rewrite the `mel:` line, which now plays only home, as a tune of your own that sings me and le, degrees ♭3 and ♭6. Keep the chords and bass as they are. Done when the tune plays both ♭3 and ♭6.",
        skills: [{ skill: "S05", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "me-and-le",
            label: "The tune plays both ♭3 (me) and ♭6 (le)",
            required: true,
            skills: ["S05"],
            rule: "degree-set",
            track: "@melody",
            contains: ["b3", "b6"],
          },
          {
            id: "comes-home",
            label: "The tune's last note is 1 (do)",
            required: false,
            skills: ["S05"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "@melody",
          },
          {
            id: "singable",
            label: "The tune's lowest and highest notes are an octave apart or less",
            required: false,
            skills: ["M01"],
            rule: "range",
            track: "@melody",
            maxSpan: 12,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The tune needs two of the lowered notes: ♭3 and ♭6. Where in the `mel:` line could they go?",
          'In `n()` over `"C4:minor"`, degree ♭3 is `n` 2 and degree ♭6 is `n` 5: the same numbers as in major.',
          'Try `n("<[4 ~ 2 4] [5 ~ 4 ~]>")`: sol, me, sol, then le falling to sol.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the hook's tune in minor",
            response: { code: code(...DARK, mel("C4:minor")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: two bars of answer, letters, a longer form",
            response: {
              code: code(
                ...DARK,
                mel(
                  "C4:minor",
                  "<[4 ~ 2 4] [5 ~ 4 ~] [2 ~ 1 2] [1 ~ 0 ~] [4 ~ 2 4] [5 ~ 4 ~] [6 ~ 5 4] [0 ~ ~ ~]>",
                ),
                'vox: note("<~ [~ ~ eb5 d5] ~ [~ ~ c5 ~]>").s("piano").gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "a tune on 1 and 5 only",
            response: { code: code(...DARK, mel("C4:minor", "<[0 ~ 4 ~] [4 ~ 0 ~]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
