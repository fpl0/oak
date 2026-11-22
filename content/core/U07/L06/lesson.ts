// U07.L06 Question & Answer. Phrases ask and answer: a four-bar phrase that stops open, on a note other than
// home over V, is a question (antecedent); the same opening that closes on home over I is the answer
// (consequent). Together they make an eight-bar unit, the shape of most song sections. What the learner
// has: an eight-bar tune that pauses half-way and comes home over `band.phrase-8bar` (U03.L11), the half
// and the authentic cadence (U06.L04), a motif that comes back (U07.L02), chord tones on beats 1 and 3
// (U07.L03). Not yet: the question and the answer in two different parts (U07.L07), pickups (U07.L08).
// Spec: content/specs/U07.md.
//
// How it grades: the modify step is a `rubric` matcher with two required rules, the tune ends on 1 and the
// notes on beats 1 and 3 are chord tones. The grader is not given the Band's code (see U06.L05 and
// U07.L04), so `harmony: "band.chords"` would read no chords: the step writes the phrase's chords as a
// `chords:` line in the code (I IV I V | I IV V I, the Band's harmony) and the Band plays drums and bass.
// The spec asks for a chord-tone ratio of 0.75; over eight bars one wrong strong-beat note is 13 of 14, so
// 0.75 cannot catch the mistake the step is about (bar 7 landing off V). The ratio is 1: the hook has chord
// tones on every strong beat, and so must the rewrite. `.lastOf(8, …)` (unlocked here) answers a
// written-once question in code. The Make's one required rule is `ends-on-degree` 1, over the whole Band;
// its chord-tone suggestion is left out for the same reason (it could only ever say "not yet").
import { CADENCE_OPTIONS, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A tune in degrees of C, one bracket a bar. */
const tune = (bars: readonly string[], extra = "") =>
  `mel: n("<${bars.join(" ")}>").scale("C4:major").s("piano")${extra}`;
const mel = (bars: readonly string[], extra = "") => code(tune(bars, extra));
/** The phrase's chords, I IV I V | I IV V I, stacked on the roots an octave under the tune. */
const CHORDS = 'chords: n("[0,2,4]").add(n("<0 3 0 4 0 3 4 0>")).scale("C3:major").s("piano").gain(.5)';

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook over I IV I V | I IV V I. The question stops on 2 (D) over V; the answer starts the same way and
 * lands on 1 (C) over I. Beats 1 and 3 are chord tones in every bar: C G | A F | E E | D || C G | A F | G D | C.
 */
const QUESTION = ["[0 2 4 5]", "[5 ~ 3 ~]", "[2 4 2 0]", "[1 ~ ~ ~]"] as const;
const ANSWER = ["[0 2 4 5]", "[5 ~ 3 ~]", "[4 3 1 ~]", "[0 ~ ~ ~]"] as const;
const HOOK = mel([...QUESTION, ...ANSWER]);
const QUESTION_ONLY = mel(QUESTION);

/** S4: bars 5–8 copy the question, so the tune stops open twice. Bars 7–8 are the learner's. */
const S4 = (bars78: string) => code(CHORDS, tune([...QUESTION, QUESTION[0], QUESTION[1], bars78]));
const S4_STARTER = S4(`⟪${QUESTION[2]} ${QUESTION[3]}⟫`);
const S4_PLAIN = S4(`${QUESTION[2]} ${QUESTION[3]}`);
const S4_REF = S4(`${ANSWER[2]} ${ANSWER[3]}`);
const S4_RULES: Matcher = {
  m: "rubric",
  rules: [
    {
      id: "home",
      label: "The last note of the tune is degree 1 (C)",
      required: true,
      skills: ["M06"],
      rule: "ends-on-degree",
      track: "@melody",
      degrees: ["1"],
    },
    {
      id: "on-the-chords",
      label: "Every note on beats 1 and 3, in all eight bars, is a chord tone of the `chords:` line",
      required: true,
      skills: ["M03"],
      rule: "chord-tones-strong",
      minRatio: 1,
      melody: "@melody",
      harmony: "chords",
      strength: "strong",
    },
  ],
};

/** S5: the question written once; `.lastOf(8, …)` moves the last bar of every eight down one degree. */
const LAST_OF = `${TEMPO}mel: n("<${QUESTION.join(" ")}>").lastOf(8, x => x.add(n(-1))).scale("C4:major").s("piano")`;

/**
 * The Make's question, over I IV I V: G E G | A F A | G E | D (beats 1 and 3: G E, A F, G E, D). Played twice
 * it stops open both times; its bars 3–4 also sit without a rub over V and I, where the copy puts them.
 */
const MAKE_Q = ["[4 ~ 2 4]", "[5 ~ 3 5]", "[4 ~ 2 ~]", "[1 ~ ~ ~]"] as const;
const MAKE_STARTER = mel([...MAKE_Q, ...MAKE_Q]);
const MAKE_MINIMAL = mel([...MAKE_Q, MAKE_Q[0], MAKE_Q[1], "[4 ~ 1 ~]", "[0 ~ ~ ~]"]);
/** Beyond the brief: a new question, answered by `.lastOf`, legato and room, hats on top. */
const MAKE_BEYOND = `${TEMPO}hats: s("hh*8").gain(.3)\nmel: n("<[2 ~ 4 ~] [5 4 3 ~] [4 2 4 ~] [1@4]>").lastOf(8, x => x.add(n(-1))).scale("C4:major").legato(.9).s("piano").room(.3)`;
const MAKE_ON_3 = mel([...MAKE_Q, MAKE_Q[0], MAKE_Q[1], "[4 ~ 1 ~]", "[2 ~ ~ ~]"]);

/** The Band's eight-bar phrase: I IV I V | I IV V I. */
const BAND = { band: "band.phrase-8bar" } as const;
/** S4: drums and bass only; the chords are the code's own line. */
const BAND_BASS = { band: "band.phrase-8bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** Level 2 of `fam.har.cadence` plays PAC, HC and IAC endings: the words of this lesson, the ids of U06.L04. */
const ENDINGS = CADENCE_OPTIONS.filter((o) => ["PAC", "IAC", "HC"].includes(o.id)).map((o) => ({
  id: o.id,
  label:
    o.id === "HC"
      ? "Stops open: it waits on V"
      : o.id === "PAC"
        ? "Comes home: V to I, the tune on 1"
        : "Comes home, but the tune ends on 3 or 5",
}));

export default defineLesson({
  id: "U07.L06",
  version: 3,
  title: "Question & Answer",
  objective:
    "I can write a four-bar question that stops open and a four-bar answer that starts the same way and comes home.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M06", "F01"],
  practises: [],
  terms: [
    { id: "term.antecedent", step: "S3" },
    { id: "term.consequent", step: "S3" },
  ],
  canDo: ["cd.compose.question-answer"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Ask, then answer",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "ask-then-answer",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the last note of bar 4 and the last note of bar 8. One sounds like the end of the song; the other makes you wait for more. Notice which is which.",
        skills: [{ skill: "M06", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Eight bars. Listen at bar 4, then at bar 8.", bars: 8 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Stop or end?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "first-four", code: QUESTION_ONLY, bars: 4 },
      exercise: {
        kind: "predict",
        id: "stop-or-end",
        version: 1,
        role: "practice",
        prompt:
          "Predict how these four bars end. The last bar, `[1 ~ ~ ~]`, holds degree 2, one note above home. Pick whether the tune will sound finished there or stop and wait for more, then run it.",
        skills: [{ skill: "M06", w: 1 }],
        hints: null,
        tests: [],
        code: QUESTION_ONLY,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "stops", label: "It stops and waits for more" },
          { id: "ends", label: "It ends: the tune is over" },
        ],
        correct: ["stops"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two endings",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "two-endings", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "two-endings",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read the degree labels in the roll. Bars 1–4 and bars 5–8 start alike. Find the degree of the last note in bar 4 and of the last note in bar 8, and answer both questions below.",
        skills: [
          { skill: "M06", w: 0.6 },
          { skill: "F01", w: 0.4 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play it again and read the degree label, not the `n`, of the last note in bar 4, then in bar 8.",
        },
        hints: ladder(
          "Look only at the last note of bar 4 and of bar 8. Which of the two sounds like the end of the song?",
          "Bar 4 plays one note and rests; so does bar 8. Read the degree label of each, not the `n`.",
          "Bar 8's note is `n` 0. Bar 4's is one above it.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "On which degree does bar 4 end?", correct: 2 },
          {
            q: "choice",
            prompt: "And bar 8?",
            options: [
              { id: "home", label: "On 1, home, over the home chord" },
              { id: "two", label: "On 2 again, like bar 4" },
              { id: "five", label: "On 5" },
            ],
            correct: ["home"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 2, choice: ["home"] } }, expect: "pass" },
          {
            name: "the n read as the degree",
            response: { answer: { number: 1, choice: ["home"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "bar 8 heard as the same ending",
            response: { answer: { number: 2, choice: ["two"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Answer the question",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND_BASS },
      exercise: {
        kind: "code-modify",
        id: "answer-the-question",
        version: 1,
        role: "check",
        prompt:
          "Bars 5–8 copy bars 1–4, so the tune never comes home. Rewrite bars 7–8, the highlighted part. Done when the last note is degree 1 and every note on beats 1 and 3 is a chord tone of the `chords:` line: V (G B D) in bar 7, I (C E G) in bar 8.",
        skills: [
          { skill: "M06", w: 0.7 },
          { skill: "M03", w: 0.3 },
        ],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_REF], bars: 8 },
        matcher: S4_RULES,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        // The catalog detail for chord tones counts notes over the whole tune; the label says where to look.
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. In bar 7, put degree 5, 7 or 2 (G B D) on beats 1 and 3. End bar 8 on degree 1 (C).",
        },
        hints: ladder(
          "Only bars 7 and 8 change. Read the `chords:` line: which chord plays under bar 7, and which under bar 8?",
          "Bar 7 is V: its notes are degrees 5, 7 and 2 (G B D). Bar 8 is I, home. Strong beats go on those notes.",
          "Bar 8 can be one note, degree 1, on beat 1, the same shape as bar 4's `[1 ~ ~ ~]`. Bar 7 puts a note of V on beats 1 and 3 and steps down towards bar 8.",
        ),
        tests: [
          { name: "reference", response: { code: S4_REF }, expect: "pass" },
          {
            name: "G and D over V, home held",
            response: { code: S4("[4 ~ 1 ~] [0@4]") },
            expect: "pass",
          },
          { name: "unchanged", response: { code: S4_PLAIN }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "ends on 3: closed-sounding, not home",
            response: { code: S4("[4 3 1 ~] [2 ~ ~ ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bar 7 lands on F over V",
            response: { code: S4("[3 ~ 1 ~] [0 ~ ~ ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bar 4 rewritten too",
            response: {
              code: code(
                CHORDS,
                tune([...QUESTION.slice(0, 3), "[0 ~ ~ ~]", QUESTION[0], QUESTION[1], ANSWER[2], ANSWER[3]]),
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "investigate",
      title: "An answer in code",
      minutes: 1,
      // No Band: bar 7 of this code is the question's bar 3 (notes of I) where the phrase has V.
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "last-of", code: LAST_OF, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "an-answer-in-code",
        version: 1,
        role: "practice",
        prompt:
          "Run it for eight bars and watch the roll. The four bars are written once; `.lastOf(8, x => x.add(n(-1)))` moves every note of the last bar of each eight down one degree. Find which bar changed and what its last note became, then pick it below.",
        skills: [{ skill: "M06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch the roll at the end of the first time through, then the second.",
        },
        hints: ladder(
          "The pattern is four bars long. How many times does it play in eight bars?",
          "`.lastOf(8, …)` counts eight bars and changes only the last one. Which of the eight is that?",
          "Bar 4 still ends on 2. Look at the bar where the second time through ends.",
        ),
        code: { starter: LAST_OF },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which bar changed, and to what?",
            options: [
              { id: "bar-8", label: "Bar 8: its 2 became 1, home" },
              { id: "bar-4", label: "Bar 4: its 2 became 1, home" },
              { id: "both", label: "Bars 4 and 8 both" },
            ],
            correct: ["bar-8"],
          },
        ],
        tests: [
          { name: "bar 8", response: { answer: { choice: ["bar-8"] } }, expect: "pass" },
          {
            name: "bar 4",
            response: { answer: { choice: ["bar-4"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Open or home?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "open-or-home",
        version: 1,
        role: "check",
        prompt:
          "Listen to four chords and a tune, in any key. Pick how the phrase ends: it stops open on V, it comes home with the tune on 1, or it comes home with the tune on 3 or 5.",
        skills: [
          { skill: "H03", w: 0.5 },
          { skill: "M06", w: 0.5 },
        ],
        hints: [
          { text: "After the last chord, do you want the phrase to go on?" },
          {
            text: "A phrase that stops on V waits for an answer. V to I comes home; then listen to the tune's last note.",
          },
          {
            text: "Hear it again, slower, and hum 1 after the last chord: is the tune's last note already there?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.har.cadence", level: 2 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "choice", options: ENDINGS },
        correct: {},
        srs: [{ family: "fam.har.cadence", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Ask and answer",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "ask-and-answer",
        version: 1,
        role: "practice",
        prompt:
          "Turn bars 5–8 into an answer. Keep the question in bars 1–4 or write your own. Start bars 5–8 the way bars 1–4 start, and change the ending. Done when the last note of the tune is degree 1.",
        skills: [
          { skill: "M06", w: 0.7 },
          { skill: "F01", w: 0.3 },
        ],
        // The suggestion's own detail counts units of two bars; the label says it in the lesson's words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [8, 16],
        saveAs: "sketch",
        rubric: [
          {
            id: "comes-home",
            label: "The last note of the tune is degree 1 (C)",
            required: true,
            skills: ["M06"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "starts-alike",
            label:
              "At least one two-bar group repeats the shape of an earlier one, as bars 5–6 can repeat bars 1–2",
            required: false,
            skills: ["M06", "M02"],
            rule: "motif-reuse",
            track: "@melody",
            minRatio: 0.25,
            unitBars: 2,
          },
        ],
        hints: ladder(
          "Only the ending of bars 5–8 has to change. Play it: where does the tune stop the second time, and on which degree?",
          "Bars 1–6 can stay. Bar 7 sits on V and bar 8 on I: the answer's last note decides how it ends.",
          "Bar 7 can stay on notes of G (degrees 5, 7, 2) and lead down to bar 8.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: bars 7–8 come home", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: a new question answered with lastOf, legato, room, hats",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "the answer ends on 3",
            response: { code: MAKE_ON_3 },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
