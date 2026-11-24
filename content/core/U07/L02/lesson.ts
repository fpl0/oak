// U07.L02 Motif & Variation. A tune is built from a motif, a short idea that comes back: the same, moved to
// start on another degree (a sequence), or played backwards (retrograde). `.scaleTranspose(n)` after
// `.scale()` moves a line by `n` degrees of the scale; `.rev()` plays each cycle backwards. What the learner
// has: contour and one high point (U07.L01), degrees in `n` (U03), the four-chord loop I V vi IV and
// `.add(n(…))` moving a chord onto another root (U05–U06). Not yet: where a motif should land against the
// chords (chord tones, U07.L03). Spec: content/specs/U07.md.
//
// Evaluated: the hook plays C E G E | G B D B | A C E C | F A C A, the motif 1 3 5 3 started on the root of
// each chord of I V vi IV, so every note is a chord tone. `n("0 2 4 7").scale("C4:major").rev()` plays
// C5 G4 E4 C4. The Make's required rule is `motif-reuse` with `shape: "either"`, so a motif moved by degrees
// counts even when its 3rds change size (C E G against A C E).
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A tune in degrees of C, with anything that goes between `.scale()` and the sound. */
const mel = (pattern: string, chain = "") => `mel: n("${pattern}").scale("C4:major")${chain}.s("piano")`;
/** The four-chord loop as stacks, an octave under the tune (for the audio cards, which play without the Band). */
const LOOP = 'chords: n("<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>").scale("C3:major").s("piano").gain(.5)';
/** One C chord under the two-bar answer of S5. */
const HOME_CHORD = 'chords: n("[0,2,4]").scale("C3:major").s("piano").gain(.5)';

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const HOOK = code(mel("0 2 4 2", '.scaleTranspose("<0 4 5 3>")'));
const REV = code(mel("0 2 4 7", ".rev()"));

/** S4: the motif in place, then climbing a degree a bar. */
const CLIMB = code(mel("0 2 4 2", '.scaleTranspose("<0 1 2 3>")'));
const CLIMB_STARTER = code(mel("0 2 4 2"));
const BY_PITCH: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  tracks: ["mel"],
};

/** S5: a two-bar phrase whose second bar is the first played backwards. */
const ANSWER = (bar2: string, bar1 = "[0 2 4 7]") => code(HOME_CHORD, mel(`<${bar1} ${bar2}>`));
const ANSWER_STARTER = code(HOME_CHORD, mel("<[0 2 4 7] ⟪[0 2 4 7]⟫>"));

/** S6: the motif four times as it is, then repeated, moved and turned round over the same chords. */
const SAME = code(LOOP, mel("0 2 4 2"));
const VARIED = code(LOOP, mel("<[0 2 4 2] [4 6 8 6] [7 9 7 5] [5 7 5 3]>"));

/** The Make's starter: four bars that fit their chords and share no shape. */
const MAKE_STARTER = code(mel("<[4 ~ 2 0] [1 2 4 ~] [5 ~ ~ 2] [3 5 ~ 0]>"));

const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass", "chords"] } as const;
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U07.L02",
  version: 4,
  title: "Motif & Variation",
  objective:
    "I can build a tune from one short idea: repeat it, move it to another degree, and play it backwards.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M02"],
  practises: [],
  terms: [
    { id: "term.motif", step: "S3" },
    { id: "term.sequence", step: "S4" },
    { id: "term.retrograde", step: "S5" },
  ],
  canDo: ["cd.compose.motif"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Four notes, four bars",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "four-notes-four-bars",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the four bars. Does each one sound like a new idea, or the same idea in a new place?",
        skills: [{ skill: "M02", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four notes in the code, four bars over I V vi IV.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Backwards",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "backwards", code: REV, bars: 1 },
      exercise: {
        kind: "predict",
        id: "backwards",
        version: 1,
        role: "practice",
        prompt:
          "`.rev()` plays a pattern backwards. Read the four numbers in `n`, predict the order the notes will play in, and pick it below.",
        skills: [{ skill: "M02", w: 1 }],
        hints: null,
        tests: [],
        code: REV,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "backwards", label: "High home first, then 5, 3 and home" },
          { id: "forwards", label: "Home, 3, 5, then high home, as written" },
          { id: "swapped", label: "Only the first and last swap: high home, 3, 5, home" },
        ],
        correct: ["backwards"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "One idea, moved",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "one-idea-moved", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "one-idea-moved",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read each bar's four notes on the roll, in degrees. Then answer both questions: how many different shapes the four bars play, and how many degrees bar 2 has moved up from bar 1.",
        skills: [{ skill: "M02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read bar 1 and bar 2 on the roll in degrees: 1 3 5 3, then 5 7 2 7. Count the steps from the first note of one to the first note of the other.",
        },
        hints: ladder(
          "Sing bar 1, then bar 2. Do they go up and down the same way?",
          "Each bar skips a degree, skips another, and drops back one skip. Where does each bar start?",
          "Bar 1 starts on degree 1 and bar 2 on degree 5. Count the steps between them: 1 to 2 is one step.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "Counting in degrees, how many different shapes do the four bars play?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "Bar 2 plays bar 1's shape, higher. By how many degrees has it moved up?",
            options: [
              { id: "one", label: "1 degree" },
              { id: "four", label: "4 degrees" },
              { id: "five", label: "5 degrees" },
            ],
            correct: ["four"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 1, choice: ["four"] } }, expect: "pass" },
          {
            name: "every bar counted as its own shape",
            response: { answer: { number: 4, choice: ["four"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the degree it starts on, not the distance",
            response: { answer: { number: 1, choice: ["five"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Make it climb",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "climb-a-step",
        version: 1,
        role: "check",
        prompt:
          "Add `.scaleTranspose()` right after `.scale()`, with one value per bar inside `< >`, so the motif climbs one degree each bar. `.scaleTranspose(n)` moves a line up `n` degrees. Bar 1 stays where it is. Done when the four bars start on degrees 1, 2, 3 and 4.",
        skills: [{ skill: "M02", w: 1 }],
        code: { starter: CLIMB_STARTER },
        reference: { solutions: [CLIMB], bars: 4 },
        matcher: BY_PITCH,
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: {got} where the target has {exp}. Each bar starts one degree above the bar before.",
          // The catalog's text is about `n` counting from 0, which is not the slip here.
          "melody.index-shift": "Every note is one degree {dir}. Bar 1 stays where it is: its value is 0.",
        },
        hints: ladder(
          "In the target, bar 1 stays put and each bar starts one degree above the bar before. How many degrees up is bar 2 from bar 1? Bar 4?",
          'One value per bar, in `< >`, the way `.add(n("<0 4 5 3>"))` moved a chord bar by bar. Bar 1 does not move.',
          "The first two values are `0` and `1`. Two more to go.",
        ),
        tests: [
          { name: "reference", response: { code: CLIMB }, expect: "pass" },
          {
            name: "the four bars written out by hand",
            response: { code: code(mel("<[0 2 4 2] [1 3 5 3] [2 4 6 4] [3 5 7 5]>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: CLIMB_STARTER },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "climbing by 3rds",
            response: { code: code(mel("0 2 4 2", '.scaleTranspose("<0 2 4 6>")')) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: ".scaleTranspose() before .scale()",
            response: {
              code: code('mel: n("0 2 4 2").scaleTranspose("<0 1 2 3>").scale("C4:major").s("piano")'),
            },
            expect: "fail",
            // Strudel refuses it: "can only use scaleTranspose after .scale".
            feedback: ["eval.query"],
          },
          {
            name: "starting a degree up",
            response: { code: code(mel("0 2 4 2", '.scaleTranspose("<1 2 3 4>")')) },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Turn it round",
      minutes: 1.25,
      graded: true,
      // No Band: its bar 2 is V (G), and the answer's high C on beat 1 would sit a half step above the B.
      // The phrase sits over one C chord instead.
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "turn-it-round",
        version: 1,
        role: "check",
        prompt:
          "Rewrite bar 2 so it plays bar 1's four notes backwards: last note first, first note last, one note a beat. Bar 1 climbs 1 3 5 and up to the high home; leave it as it is.",
        skills: [{ skill: "M02", w: 1 }],
        code: { starter: ANSWER_STARTER },
        reference: { solutions: [ANSWER("[7 4 2 0]")], bars: 2 },
        matcher: BY_PITCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: {got} where the target has {exp}. Read bar 1 from right to left and write what you read.",
        },
        hints: ladder(
          "Which note of bar 1 comes last? That is where bar 2 starts.",
          "Read bar 1's four numbers from right to left. The rhythm stays the same: four notes, one a beat.",
          "Bar 2 starts on `7`, the high home, and ends on `0`.",
        ),
        tests: [
          { name: "reference", response: { code: ANSWER("[7 4 2 0]") }, expect: "pass" },
          { name: "in two halves", response: { code: ANSWER("[[7 4] [2 0]]") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: ANSWER("[0 2 4 7]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the middle notes left in order",
            response: { code: ANSWER("[7 2 4 0]") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "bar 1 changed as well",
            response: { code: ANSWER("[7 4 2 0]", "[0 2 4 5]") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "compare",
      title: "Which one keeps you?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-keeps-you",
        version: 1,
        role: "practice",
        prompt:
          "Play both cards: two four-bar tunes over the same chords, both built from the motif 1 3 5 3. Pick the one that still holds your attention in bars 3 and 4.",
        skills: [{ skill: "M02", w: 1 }],
        hints: ladder(
          "By bar 3 of each card, do you know what comes next?",
          "One card repeats the motif exactly; the other moves it and turns it round. Which one surprises you?",
          "Card A plays 1 3 5 3 four times. Play bar 3 of card B: is it the same?",
        ),
        stimulus: { src: "code", code: VARIED, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "same", label: "Card A: the motif four times", audio: SAME },
            { id: "varied", label: "Card B: the motif moved and turned round", audio: VARIED },
          ],
        },
        correct: { choice: ["varied"] },
        feedbackText: {
          "id.wrong":
            "Card A is the motif four times as it is: by bar 3 nothing is left to hear. Card B keeps the idea and changes where it goes.",
        },
        tests: [
          { name: "varied", response: { answer: { choice: ["varied"] } }, expect: "pass" },
          {
            name: "same",
            response: { answer: { choice: ["same"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "One idea, four bars",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "one-idea-four-bars",
        version: 1,
        role: "practice",
        prompt:
          "Write the first loud part of your song from one motif: the starter bar you like best, as bar 1. Build bars 2 to 4 from it: repeat it, move it with `.scaleTranspose()`, or turn it round with `.rev()`. Done when at least two bars repeat an earlier bar's shape, the same or moved, and not all four are identical.",
        skills: [{ skill: "M02", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        // The spec's suggestion "lands on chord tones" against `band.chords` is left out: the grader is not
        // given the Band's code (see U06.L05), so it would read no chords and stay unmet for every sketch.
        rubric: [
          {
            id: "motif-comes-back",
            label:
              "At least half the bars repeat the shape of an earlier bar, the same or moved to other degrees; four identical bars do not count",
            required: true,
            skills: ["M02"],
            rule: "motif-reuse",
            track: "@melody",
            // Two of the four bars bring an earlier bar back (0.25 lets four unrelated bars through on contour
            // alone). Four bars all the same are read as a one-bar loop, which brings nothing back; the brief
            // says both (corrections pass: it used to say "at least two bars", which this never checked).
            minRatio: 0.5,
            shape: "either",
          },
          {
            id: "moved-or-turned",
            label: "Uses `.scaleTranspose()` or `.rev()` at least once",
            required: false,
            skills: ["M02"],
            rule: "uses",
            tool: ["tb.scaleTranspose", "tb.rev"],
            min: 1,
          },
        ],
        hints: ladder(
          "Choose one bar as your motif and put it first. Could bar 2 play that same shape, starting on another degree?",
          "Keep bar 1, then write the other bars as copies of it: moved up or down by the same number of degrees, or backwards.",
          "Bar 1 is `[4 ~ 2 0]`. Bar 2 could be the same shape on the G chord: start it on `n` 8 and step down by skips.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: bar 1 moved onto each chord by hand",
            response: { code: code(mel("<[4 ~ 2 0] [8 ~ 6 4] [9 ~ 7 5] [7 ~ 5 3]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: moved in code, turned round in bar 4, with room",
            response: {
              code: code(
                `${mel("<[0 2 4 2] [0 2 4 2] [0 2 4 2] [2 4 2 0]>", '.scaleTranspose("<0 4 5 3>")')}.gain(.8).room(.3)`,
              ),
            },
            expect: "pass",
          },
          {
            name: "four new ideas again",
            response: { code: code(mel("<[0 ~ 4 2] [4 ~ ~ 1] [2 0 5 ~] [3 ~ 0 ~]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the motif four times, all the same: a one-bar loop",
            response: { code: code(mel("<[4 ~ 2 0] [4 ~ 2 0] [4 ~ 2 0] [4 ~ 2 0]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the motif back in bar 2 only",
            response: { code: code(mel("<[4 ~ 2 0] [4 ~ 2 0] [3 5 ~ 0] [1 2 4 ~]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the motif, the same in bar 3, moved in bar 4",
            response: { code: code(mel("<[4 ~ 2 0] [1 2 4 ~] [4 ~ 2 0] [7 ~ 5 3]>")) },
            expect: "pass",
          },
          {
            name: "repeated, moved, turned round",
            response: { code: code(mel("<[4 ~ 2 0] [4 ~ 2 0] [5 ~ 3 1] [0 2 4 ~]>")) },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
