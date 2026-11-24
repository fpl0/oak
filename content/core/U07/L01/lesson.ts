// U07.L01 Shape. A melody has a shape: it moves mostly by step with a leap or two, reaches its high point
// once, late, and comes home. The learner already has steps and leaps (U03.L09, M01), degrees in `n` with
// notes above the octave (U03), and chords under every bar (U05–U06). Here the shape gets a name (contour)
// and the high point a place (climax). Spec: content/specs/U07.md.
//
// The hook keeps its notes on chord tones of the Band's phrase (I IV I V | I IV V I) on beats 1 and 3:
// C E | F A | G E | D | E G | F C | B G | E C. It moves by step on 15 of its 20 moves, leaps up a 6th
// from A4 to its one high point, F5 (degree 4 an octave up) on beat 1 of bar 6, and steps back down.
// From C4 to F5 is 17 half steps: an octave and a 4th.
//
// Grading: the modify step is a `rubric` matcher (`step-ratio` and `range` on the melody), so any line that
// moves mostly by step and stays inside an octave and a 3rd passes; the Make requires `step-ratio` only.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A tune in degrees of C. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook, bar by bar. Bars 2 and 6 both sit over IV (F), so they can trade places (S5). */
const BARS = [
  "[0 1 2 ~]",
  "[3 4 5 ~]",
  "[4 ~ 2 ~]",
  "[1@3 ~]",
  "[2 ~ 4 5]",
  "[10 9 7 ~]",
  "[6 5 4 ~]",
  "[2 1 0@2]",
] as const;
const tune = (bars: readonly string[]) => `<${bars.join(" ")}>`;
const HOOK = code(mel(tune(BARS)));
/** The same eight bars with bars 2 and 6 swapped: the high point comes in bar 2 and the rest falls away. */
const EARLY = code(mel(tune([BARS[0], BARS[5], BARS[2], BARS[3], BARS[4], BARS[1], BARS[6], BARS[7]])));

/** S2: a line read as code before it is heard. It climbs to C5 in bar 2 and walks back to home. */
const PREDICT = code(mel("<[0 1 2 4] [5 7 ~ 6] [5 4 2 1] [0@3 ~]>"));

/**
 * S4: a four-bar line whose bars 2 and 3 leap across two octaves (G3 to G5). Its chord tones are right
 * (F5 A3 over IV, G5 G3 over I); its shape is not.
 */
const TAME = (bar2: string, bar3: string, bar1 = "[0 1 2 ~]") =>
  code(mel(`<${bar1} ${bar2} ${bar3} [1@3 ~]>`));
const TAME_STARTER = code(mel("<[0 1 2 ~] ⟪[10 ~ -2 ~] [11 ~ -3 ~]⟫ [1@3 ~]>"));

/** S6: four two-bar tunes, one shape each. */
const SHAPES = [
  { id: "climbs", label: "Climbs: low to high" },
  { id: "falls", label: "Falls: high to low" },
  { id: "arch", label: "Arch: up, then down" },
  { id: "valley", label: "Valley: down, then up" },
];
const SHAPE_WRONG = {
  "id.wrong":
    "Not that shape. Hum it back and draw it in the air with one hand: where is the highest note, and where is the lowest?",
} as const;

/** The Make's starter: every bar an arpeggio of its chord, so every move is a leap. */
const ARPEGGIOS = "<[0 2 4 7] [3 5 7 10] [0 2 4 7] [4 6 8 11] [0 2 4 7] [3 5 7 10] [4 6 8 11] [7 ~ ~ ~]>";
const MAKE_STARTER = code(mel(ARPEGGIOS));

const BAND = { band: "band.phrase-8bar", tracks: ["drums", "bass", "chords"] } as const;
const DRUMS = { band: "band.phrase-8bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const STAFF = { roll: false, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U07.L01",
  version: 4,
  title: "Shape",
  objective: "I can shape a melody: mostly steps, a leap or two, and one high point placed on purpose.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["M01"],
  terms: [
    { id: "term.contour", step: "S3" },
    { id: "term.climax", step: "S5" },
  ],
  canDo: ["cd.compose.contour"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A line going somewhere",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND, initialPanels: ["range"] },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "a-line-that-goes-somewhere",
        version: 1,
        role: "practice",
        prompt:
          "Follow the line on the roll as it plays. Listen for how the tune gets from each note to the next: mostly small moves, or big jumps?",
        skills: [{ skill: "M01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Eight bars. Watch the gap between each note and the next.", bars: 8 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Read the shape",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "read-the-shape", code: PREDICT, bars: 4 },
      exercise: {
        kind: "predict",
        id: "read-the-shape",
        version: 1,
        role: "practice",
        prompt:
          "Read the numbers in `n` before you play it: a bigger number is a higher note. Predict the shape the four bars draw, and pick it below.",
        skills: [{ skill: "M01", w: 1 }],
        hints: null,
        tests: [],
        code: PREDICT,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "up-and-back", label: "It climbs to one high note, then walks back down to home" },
          { id: "up-and-stop", label: "It climbs all the way and stops at the top" },
          { id: "zigzag", label: "It zigzags up and down around the same few notes" },
        ],
        correct: ["up-and-back"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Find the top",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND, initialPanels: ["range"] },
      example: { id: "find-the-top", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "find-the-top",
        version: 1,
        role: "practice",
        prompt:
          "Run the tune and find its highest note on the roll. Then answer both questions: which bar that note is in, and how many half steps it sits above home, C4.",
        skills: [{ skill: "M01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. The biggest number in `n` is the highest note: find its bar. Then count the half steps from C4 up to it: 12 take you to C5.",
        },
        hints: ladder(
          "Find the note that sits highest on the roll and read which bar it is in. Then measure from home, C4, up to it.",
          "The biggest number in `n` is the highest note. To measure, count half steps from home, C4, up to it.",
          "The highest note is `n` 10: degree 4 an octave up, F5. An octave is 12 half steps; from C5 up to F5 is a 4th.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "In which bar is the highest note?", correct: 6 },
          {
            q: "choice",
            prompt: "From home, C4, up to that note: how far does the tune reach?",
            options: [
              { id: "octave", label: "An octave: 12 half steps" },
              { id: "octave-fourth", label: "An octave and a 4th: 17 half steps" },
              { id: "two-octaves", label: "Two octaves: 24 half steps" },
            ],
            correct: ["octave-fourth"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 6, choice: ["octave-fourth"] } },
            expect: "pass",
          },
          {
            name: "the bar where the climb starts",
            response: { answer: { number: 5, choice: ["octave-fourth"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "an octave only",
            response: { answer: { number: 6, choice: ["octave"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Tame the line",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "tame-the-line",
        version: 1,
        role: "check",
        prompt:
          "Rewrite bars 2 and 3 so the line moves mostly by step, to the next degree up or down. Keep bars 1 and 4 as they are. Done when at least 6 in 10 moves are steps and the line spans at most 16 half steps, an octave and a 3rd, from its lowest note to its highest.",
        skills: [{ skill: "M01", w: 1 }],
        code: { starter: TAME_STARTER },
        reference: { solutions: [TAME("[3 4 5 ~]", "[4 ~ 2 ~]")], bars: 4 },
        // Any line with mostly steps inside the span passes; the target is one of many.
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "steps",
              label:
                "At least 6 in 10 moves go to the next degree up or down (a repeated note is not a move)",
              required: true,
              skills: ["M01"],
              rule: "step-ratio",
              track: "mel",
              min: 0.6,
            },
            {
              id: "span",
              label: "At most 16 half steps, an octave and a 3rd, from the lowest note to the highest",
              required: true,
              skills: ["M01"],
              rule: "range",
              track: "mel",
              maxSpan: 16,
            },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        // The rules' own details count in "semitones", a word the course does not use: the labels carry the
        // numbers instead.
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. On the roll, find the big jumps in bars 2 and 3 and replace them with moves to the next degree. If the span is too wide, bring the highest or lowest note of bars 2 and 3 closer to the rest.",
        },
        hints: ladder(
          "The jumps are in bars 2 and 3. Read their numbers in `n`: how far is each number from the one before it?",
          "A step moves to the next degree: `n` up or down by 1. In bars 2 and 3, make each new number 1 more or 1 less than the one before it, most of the time.",
          "Bar 1 ends on `n` 2, degree 3 (E). Start bar 2 one step above it and keep climbing by step; then bring bar 3 back down by step towards bar 4's `n` 1.",
        ),
        tests: [
          { name: "reference", response: { code: TAME("[3 4 5 ~]", "[4 ~ 2 ~]") }, expect: "pass" },
          {
            name: "another stepwise answer",
            response: { code: TAME("[3 ~ 4 3]", "[2 1 2 ~]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: TAME("[10 ~ -2 ~]", "[11 ~ -3 ~]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "all steps, but climbing past the span",
            response: { code: TAME("[3 4 5 6]", "[7 8 9 10]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "inside the span, still leaping",
            response: { code: TAME("[5 ~ 0 ~]", "[4 ~ 0 ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bar 1 changed as well",
            response: { code: TAME("[3 4 5 ~]", "[4 ~ 2 ~]", "[0 2 4 ~]") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Where is the top?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "where-is-the-top",
        version: 1,
        role: "practice",
        prompt:
          "Play both cards: the same eight bars in two orders. Card A reaches its highest note in bar 2, card B in bar 6. Pick the card whose second half still sounds as if it is going somewhere.",
        skills: [{ skill: "M01", w: 1 }],
        hints: ladder(
          "Listen to what each card does after its highest note. Is there anything left to build towards?",
          "Listen to the second half of each card. Does it build, or wind down?",
          "Card A peaks in bar 2. Play bars 5 to 8 of it: is there anything still to come?",
        ),
        stimulus: { src: "code", code: HOOK, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "early", label: "Card A: the top in bar 2", audio: EARLY },
            { id: "late", label: "Card B: the top in bar 6", audio: HOOK },
          ],
        },
        correct: { choice: ["late"] },
        feedbackText: {
          "id.wrong":
            "Listen to card A again from bar 3: after its high note in bar 2 there is nowhere left to go. Card B saves it for bar 6.",
        },
        tests: [
          { name: "late", response: { answer: { choice: ["late"] } }, expect: "pass" },
          {
            name: "early",
            response: { answer: { choice: ["early"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Hear the shape",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "hear-the-shape",
        version: 1,
        role: "check",
        prompt:
          "Listen to four two-bar tunes, one at a time. For each one, pick the shape it draws: climbs, falls, arch or valley.",
        skills: [
          { skill: "M01", w: 0.6 },
          { skill: "E07", w: 0.4 },
        ],
        hints: ladder(
          "Hum each tune back. Does your voice end higher or lower than it started?",
          "Listen for the highest note: at the start, the end, or the middle? Then for the lowest.",
          "An arch has its highest note in the middle; a valley has its lowest note there.",
        ),
        srs: [{ family: "fam.mel.dictation", mode: "review-if-due" }],
        tests: [],
        parts: [
          {
            kind: "identify",
            id: "shape-arch",
            version: 1,
            role: "check",
            prompt: "Tune 1. Which shape?",
            skills: [{ skill: "M01", w: 1 }],
            hints: ladder(
              "Where is the highest note: start, middle or end?",
              "Compare the first note and the last. Then find the top.",
              "It starts and ends on home. What happens between?",
            ),
            stimulus: { src: "code", code: code(mel("<[0 2 4 5] [4 2 0@2]>")), bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SHAPES },
            correct: { choice: ["arch"] },
            feedbackText: SHAPE_WRONG,
            tests: [
              { name: "arch", response: { answer: { choice: ["arch"] } }, expect: "pass" },
              {
                name: "climbs",
                response: { answer: { choice: ["climbs"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "shape-falls",
            version: 1,
            role: "check",
            prompt: "Tune 2. Which shape?",
            skills: [{ skill: "M01", w: 1 }],
            hints: ladder(
              "Where is the highest note: start, middle or end?",
              "Compare the first note and the last. Which is higher?",
              "Does it ever turn round, or keep going one way?",
            ),
            stimulus: { src: "code", code: code(mel("<[7 6 5 4] [2 1 0@2]>")), bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SHAPES },
            correct: { choice: ["falls"] },
            feedbackText: SHAPE_WRONG,
            tests: [
              { name: "falls", response: { answer: { choice: ["falls"] } }, expect: "pass" },
              {
                name: "valley",
                response: { answer: { choice: ["valley"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "shape-valley",
            version: 1,
            role: "check",
            prompt: "Tune 3. Which shape?",
            skills: [{ skill: "M01", w: 1 }],
            hints: ladder(
              "Where is the lowest note: start, middle or end?",
              "Compare the first note and the last. Then find the bottom.",
              "It starts and ends on the high home. What happens between?",
            ),
            stimulus: { src: "code", code: code(mel("<[7 5 4 2] [4 5 7@2]>")), bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SHAPES },
            correct: { choice: ["valley"] },
            feedbackText: SHAPE_WRONG,
            tests: [
              { name: "valley", response: { answer: { choice: ["valley"] } }, expect: "pass" },
              {
                name: "arch",
                response: { answer: { choice: ["arch"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "shape-climbs",
            version: 1,
            role: "check",
            prompt: "Tune 4. Which shape?",
            skills: [{ skill: "M01", w: 1 }],
            hints: ladder(
              "Where is the highest note: start, middle or end?",
              "Compare the first note and the last. Which is higher?",
              "Does it ever turn round, or keep going one way?",
            ),
            stimulus: { src: "code", code: code(mel("<[0 1 2 4] [5 6 7@2]>")), bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SHAPES },
            correct: { choice: ["climbs"] },
            feedbackText: SHAPE_WRONG,
            tests: [
              { name: "climbs", response: { answer: { choice: ["climbs"] } }, expect: "pass" },
              {
                name: "falls",
                response: { answer: { choice: ["falls"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "see",
      title: "On the page",
      minutes: 0.5,
      ui: { panels: STAFF, staffLabels: "degree" },
      example: { id: "on-the-page", code: HOOK, bars: 8 },
    },
    {
      id: "S8",
      kind: "make",
      title: "One high point",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "one-high-point",
        version: 1,
        role: "practice",
        prompt:
          "Rewrite the eight bars of your song's second part so the tune moves mostly by step, reaches its highest note once, in bars 5 to 8, and ends on home. Done when at least 6 in 10 moves go to the next degree up or down.",
        skills: [{ skill: "M01", w: 1 }],
        // As in S4: the labels carry the numbers, so the rules' "semitones" details stay out of sight.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "mostly-steps",
            label: "At least 6 in 10 moves go to the next degree up or down (a repeated note is not a move)",
            required: true,
            skills: ["M01"],
            rule: "step-ratio",
            track: "@melody",
            min: 0.6,
          },
          {
            id: "span",
            // The hook itself spans C4 to F5, an octave and a 4th: the suggestion allows what the hook does.
            label: "At most 17 half steps, an octave and a 4th, from the lowest note to the highest",
            required: false,
            skills: ["M01"],
            rule: "range",
            track: "@melody",
            maxSpan: 17,
          },
          {
            id: "home",
            label: "The last note is home, degree 1",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
        ],
        hints: ladder(
          "Look at bar 1, `[0 2 4 7]`: every number is two or more away from the one before. Those are the leaps to replace with steps.",
          "A step changes `n` by 1. Fill the gaps between a chord's notes with the degrees between them.",
          "Bar 1 `[0 2 4 7]` can walk `[0 1 2 ~]`: still on chord notes for beats 1 and 3, a step at a time.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the arpeggios walked by step",
            response: {
              code: code(
                mel("<[0 1 2 ~] [3 4 5 ~] [4 ~ 2 ~] [1 ~ ~ ~] [2 ~ 4 5] [7 6 5 ~] [4 ~ 1 ~] [0 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: the hook, decorated, with room",
            response: {
              code: code(
                `${mel("<[0 1 2 ~] [3 4 5 [4 3]] [4 ~ 2 ~] [1@3 ~] [2 ~ 4 5] [10 9 7 [8 7]] [6 5 4 ~] [2 1 0@2]>")}.room(.3)`,
              ),
            },
            expect: "pass",
          },
          {
            name: "a high point in the second half, but leaps all the way",
            response: {
              code: code(
                mel("<[0 4 2 ~] [5 3 7 ~] [4 0 4 ~] [1 5 ~ ~] [4 0 7 ~] [10 5 7 ~] [4 8 4 ~] [0 ~ ~ ~]>"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
