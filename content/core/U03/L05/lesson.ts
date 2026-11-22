// U03.L05 Same Song, Any Key. Degrees describe a tune in every key: the same numbers over another
// `.scale()` are the same tune with a new home, and a patterned `.scale("<…>")` changes the key bar by bar.
// What the learner has from U03.L01–L04: the major scale, degrees 1 to 7 as `n` 0 to 6, `n` below 0 and
// from 7 up, `..`, one-word key changes (U03.L02 S5). Not yet: key signatures (U03.L06), syllables
// (U03.L08). Spec: content/specs/U03.md.
//
// The hook and the investigate step play without the Band: it sits in one key, the tune moves. The Make's
// Band follows the learner's whole `.scale()` argument, a pattern included (`followsLearnerKey`).
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line written in degrees over a (possibly patterned) major scale. */
const deg = (pattern: string, key = "C4:major", extra = "") =>
  `${TEMPO}mel: n("${pattern}").scale("${key}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The tune of the lesson: 1 3 5 3, then 4 2 1, rest. Two bars, home at the end. */
const TUNE = "<[0 2 4 2] [3 1 0 ~]>";
/** The hook: the tune in C, then in G a little lower (G3), one word deciding. */
const HOOK = deg(TUNE, "<C4:major!2 G3:major!2>");
/** S3: the same numbers in C, D and F, the whole tune in each. */
const THREE_KEYS = deg(TUNE, "<C4:major!2 D4:major!2 F4:major!2>");
/** S4: the whole tune in C, then the whole tune in G above middle C. */
const C_THEN_G = "<C4:major!2 G4:major!2>";

const BAND = { band: "band.two-chord-vamp", followsLearnerKey: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** The catalog's `melody.wrong-degree` names syllables, which wait for U03.L08: numbers only. */
const NUMBERS = {
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: you have degree {got} where the tune has degree {exp}. Check which key `.scale()` plays in this bar: C in bars 1 and 2, G in bars 3 and 4.",
} as const;

export default defineLesson({
  id: "U03.L05",
  version: 4,
  title: "Same Song, Any Key",
  objective:
    "I can play the same tune in any major key by changing one word, and change key bar by bar with a pattern in .scale().",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S03"],
  practises: [],
  terms: [],
  canDo: ["cd.code.any-key"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One tune, two homes",
      minutes: 0.5,
      // No Band: it would stay in C while the tune moves to G.
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-tune-two-homes",
        version: 1,
        role: "practice",
        prompt:
          "Bars 1 and 2 play the tune in C; bars 3 and 4 play it again from a new home. Listen for whether it still sounds finished at the end of bar 4, and watch whether the numbers on the roll change.",
        skills: [{ skill: "S03", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "The same two bars in C, then in G, a little lower.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "New home, same tune?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "in-f", code: deg(TUNE, "F4:major"), bars: 2 },
      exercise: {
        kind: "predict",
        id: "new-home-same-tune",
        version: 1,
        role: "practice",
        key: { tonic: "F", mode: "major" },
        prompt:
          'The numbers in `n` stay as they are, and `.scale("C4:major")` becomes `.scale("F4:major")`. Predict what you will hear, and pick your answer below.',
        skills: [{ skill: "S03", w: 1 }],
        hints: null,
        tests: [],
        code: deg(TUNE, "F4:major"),
        bars: 2,
        mode: "choose",
        choices: [
          { id: "same-tune", label: "The same tune, with F as home" },
          { id: "other-tune", label: "A different tune: the numbers now pick other notes" },
          { id: "same-notes", label: "The same notes as in C: `.scale()` only names the key" },
        ],
        correct: ["same-tune"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Three keys",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      example: { id: "three-keys", code: THREE_KEYS, bars: 6 },
      exercise: {
        kind: "run-investigate",
        id: "three-keys",
        version: 1,
        role: "practice",
        prompt:
          "Run the tune in C, then in D, then in F, two bars each. Watch the numbers on the roll and how high the notes sit. Then answer both questions below.",
        skills: [{ skill: "S03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. Compare the first note in C with the first note in D: its label on the roll, and how many half steps up it moved.",
        },
        hints: ladder(
          "Compare the C bars with the D bars on the roll. When the key changes, what changes, and what stays put?",
          "The labels are degrees: they say what each note does in its key. The heights are the notes themselves.",
          "From `c4` to `d4` is one whole step. Every note of the tune moves by the same amount.",
        ),
        code: { starter: THREE_KEYS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick what stays the same in all three keys.",
            options: [
              { id: "numbers", label: "The numbers in `n`, and the labels on the roll" },
              { id: "letters", label: "The letters of the notes" },
              { id: "lowest", label: "The lowest note" },
            ],
            correct: ["numbers"],
          },
          {
            q: "number",
            prompt: "Type how many half steps every note moved from C to D.",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["numbers"], number: 2 } }, expect: "pass" },
          {
            name: "the letters stay",
            response: { answer: { choice: ["letters"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one step of the scale",
            response: { answer: { choice: ["numbers"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Visit G",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      exercise: {
        kind: "code-modify",
        id: "visit-g",
        version: 1,
        role: "check",
        prompt:
          "Change only what is inside `.scale()`: the whole two-bar tune in C, then the whole tune again with G above middle C as home. Use `< >` for one key per bar and `!2` to hold a key for two bars. Done when four bars play, two in each key.",
        skills: [{ skill: "S03", w: 1 }],
        code: { starter: `${TEMPO}mel: n("${TUNE}").scale("⟪C4:major⟫").s("piano")` },
        reference: { solutions: [deg(TUNE, C_THEN_G)], bars: 4 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          ...NUMBERS,
          "melody.octave":
            "Bar {bar}, {beatLabel}: right note, an octave {dir}. G above middle C is `G4`: check the number after the G.",
        },
        hints: ladder(
          "Each key must play the whole tune, and the tune is two bars long. For how many bars should each key last?",
          "Inside `.scale()`, `< >` plays one key per bar, and `!2` repeats a key for two bars, as in the hook.",
          "The first key is `C4:major!2`. The second is G, with the octave number of middle C.",
        ),
        srs: [{ family: "fam.code.functions", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: deg(TUNE, C_THEN_G) }, expect: "pass" },
          {
            name: "the four bars written out",
            response: { code: deg(TUNE, "<C4:major C4:major G4:major G4:major>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: deg(TUNE) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a new key every bar",
            response: { code: deg(TUNE, "<C4:major G4:major>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the G below middle C",
            response: { code: deg(TUNE, "<C4:major!2 G3:major!2>") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "changed a number as well",
            response: { code: deg("<[0 2 4 2] [3 1 0 0]>", C_THEN_G) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "n 2 in D",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "n-two-in-d",
        version: 1,
        role: "check",
        key: { tonic: "D", mode: "major" },
        prompt:
          'Name the note that `n("2")` plays over `.scale("D4:major")`. Type its letter, with a sharp if it has one.',
        skills: [
          { skill: "S03", w: 0.6 },
          { skill: "S02", w: 0.4 },
        ],
        feedbackText: {
          "spell.wrong":
            "Not {got}. Spell D major from D, whole, whole, half: which letter is third, and does it need a sharp?",
        },
        hints: ladder(
          "Find the degree first, then its note in D major. Which degree is `n` 2?",
          "`n` counts from 0, so `n` 2 is degree 3. Spell D major up to its third note.",
          "D major starts D, E, … The step from E to the next note is a whole step.",
        ),
        answer: { ui: "text", normalize: "note" },
        correct: { text: ["F#"] },
        spelling: "strict",
        order: "sequence",
        srs: [{ family: "fam.deg.index", mode: "review-if-due" }],
        tests: [
          { name: "F#", response: { answer: { text: ["F#"] } }, expect: "pass" },
          { name: "lower case", response: { answer: { text: ["f#"] } }, expect: "pass" },
          {
            name: "F without its sharp",
            response: { answer: { text: ["F"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "counted n from 1",
            response: { answer: { text: ["E"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "the same sound, spelled G flat",
            response: { answer: { text: ["Gb"] } },
            expect: "fail",
            feedback: ["spell.enharmonic"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "1 to 5, any key",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "one-to-five-any-key",
        version: 1,
        role: "check",
        prompt:
          "Listen to the chords that set home (home may change from one note to the next), then to one note. Pick its degree, from 1 to 5.",
        skills: [{ skill: "E05", w: 1 }],
        hints: [
          { text: "Find home first: hum the note the chords end on. Is the note home, or above it?" },
          { text: "Sing up from home on numbers, one, two, three, until you reach the note." },
          { text: "Hear it again, slower, and sing from 1 up to it.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.deg.fet-major", level: 2 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "degree-pad", set: ["1", "2", "3", "4", "5"], syllables: false },
        correct: {},
        srs: [{ family: "fam.deg.fet-major", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "sing",
      title: "Sing it in A",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-it-in-a",
        version: 1,
        role: "practice",
        // The chords set A as home: the numbers sung are the ones sung in C.
        key: { tonic: "A", mode: "major" },
        prompt:
          "After the chords set home on A, sing one, two, three, two, one: five notes, one to a beat, on any vowel or on the numbers. One is A, the note the chords end on.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "S03", w: 0.4 },
        ],
        hints: [
          {
            text: "Start from home: hum the note the chords end on, then step up from it, one note of the scale at a time.",
          },
          { text: "Each number is the next note of the scale: one step up, one more, then back down." },
          { text: "Hear the pattern on the piano once, then sing it back.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        mode: "degree",
        stimulus: { src: "code", code: deg("<[0 1 2 1] 0>", "A3:major"), bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["1", "2", "3", "2", "1"] },
        labels: "numbers",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        feedbackText: {
          "sing.drift":
            "You drifted {cents}¢ {dir}. Hum home again, the note the chords end on, and step up from it.",
        },
        tests: [],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your tune, two keys",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "your-tune-two-keys",
        version: 1,
        role: "practice",
        prompt:
          'Put a pattern in `.scale("< >")` so the tune plays in a second key, for example two bars in one key, then two in another. Change the numbers in `n` too if you like. Done when the melody plays in two different keys.',
        skills: [{ skill: "S03", w: 1 }],
        code: { starter: deg("<[0 2 1 4] [3 2 0 ~]>") },
        bars: [1, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-keys",
            // The effect, not the pattern: `<C4:major!2 C4:major!2>` names one key twice.
            label: 'The tune plays in at least two different keys, set by a pattern in `.scale("< >")`',
            required: true,
            skills: ["S03"],
            rule: "custom",
            fn: "distinct-keys",
            // Corrections gate (AS-06): the tune visits the key, not a bass line under it.
            params: { track: "@melody", alsoUses: ["tb.scale.patterned"] },
          },
          {
            id: "four-bars",
            label: "The piece is at least four bars long, so each key gets the whole tune",
            required: false,
            skills: ["S03"],
            rule: "bars",
            min: 4,
          },
        ],
        hints: ladder(
          "The tune must play in two different keys. Where in the line does the key live?",
          "Put a pattern inside `.scale()`: `< >` with one key per bar, and `!2` to hold a key for two bars.",
          "Inside `.scale()`, write `< >` around two different keys, each followed by `!2`: two bars in the first key, then two in the second.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: deg("<[0 2 1 4] [3 2 0 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: C then F",
            response: { code: deg("<[0 2 1 4] [3 2 0 ~]>", "<C4:major!2 F4:major!2>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: four keys, hats, a held ending",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: n("<[0 2 4 2] [4 [5 4] 2 1] [0 2 4 7] [4 2 0@2]>").scale("<C4:major!4 D4:major!4 F4:major!4 G3:major!4>").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "a pattern that names one key twice",
            response: { code: deg("<[0 2 1 4] [3 2 0 ~]>", "<C4:major!2 C4:major!2>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the same key an octave lower is still one key",
            response: { code: deg("<[0 2 1 4] [3 2 0 ~]>", "<C4:major!2 C3:major!2>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "C, then G below it",
            response: { code: deg("<[0 2 1 4] [3 2 0 ~]>", "<C4:major!2 G3:major!2>") },
            expect: "pass",
          },
          {
            name: "a new key every bar",
            response: { code: deg("<[0 2 4 2] [4 2 0 ~]>", "<D4:major E4:major>") },
            expect: "pass",
          },
          {
            name: "a new tune, still one key",
            response: { code: deg("<[0 2 4 2] [4 2 0 ~]>", "D4:major") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
