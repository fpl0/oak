// R3.L03 Euclidean Rhythms & Rotation (spec: content/specs/R3.md). Every `(k,n)` spreads k hits as evenly as n
// steps allow: `(4,16)` is four plain quarters, `(3,8)` the tresillo, `(5,16)` five hits three sixteenths apart
// with one longer gap of four. A third number starts the same spacing r steps later, wrapping round the bar:
// `(5,16,10)` puts the long gap after the third hit, 3+3+4+3+3, and that is the bossa nova rim. `.euclid()` and
// `.euclidRot()` say the same as methods, and their numbers can be patterns that change bar by bar.
//
// Written for the learner at the gate (AUTHORING §20.1): R3 always follows R1, R2 and R3.L01–L02, but U14–U17 may
// be unfinished. The lesson unlocks `(k,n,r)`, `.euclid()` and `.euclidRot()` (contracts §3.2) and uses them from
// its first step; everything else is R3.L01's `(k,n)` and what U13.CP guarantees.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step and the Make:
// - every required rule checks what is HEARD: S5 is the bell's onsets in EVERY bar (`onsets` `equals`, so a
//   silent line, a line stretched over two bars or a wrong rotation fail), then the notation; S6 grades the
//   numbers by the onsets they make; S7 is a `rhythm` match over four bars; the Make is the `euclid` rule, read
//   from the onsets heard in every bar;
// - each graded step pins a WRONG answer that uses the right function: `rim(5,16,3)` (a rotation, the wrong
//   one), `[3, 8]` and `[5, 8]` in the quiz, `.euclid("<5 3>", 8)` (the right call, the bars in the wrong
//   order), `rim(5,8)` and the bell at `.gain(0)` in the Make; and at least three OTHER right answers each.
// Feedback below rung 4 never names the answer.
import {
  defineLesson,
  type HintLadder,
  type IdentifyEx,
  IMPLEMENTED,
  type Rat,
  type RubricRule,
} from "@oak/content-kit";

const BPM = 128;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The bossa groove: kick on 1, the "and" of 2, 3 and the "and" of 4; bass on C then D; Rhodes on Cmaj7, Dm7. */
const KICK = 'kick: s("bd ~ ~ bd bd ~ ~ bd").gain(.6)';
const HATS = 'hats: s("hh*8").gain(.25)';
const BASS = 'bass: note("<[c2 ~ ~ g1 g1 ~ ~ c2] [d2 ~ ~ a1 a1 ~ ~ d2]>").s("upright")';
const CHORDS = 'chords: chord("<C^7 Dm7>").voicing().struct("x ~ ~ x ~ x ~ ~").s("rhodes").gain(.5)';
const rim = (pattern: string, extra = "") => `perc: s("${pattern}").gain(.7)${extra}`;
const groove = (percLine: string) => code(percLine, KICK, HATS, BASS, CHORDS);
const BOSSA = groove(rim("rim(5,16,10)"));
const PLAIN = groove(rim("rim(5,16)"));

/** S3: three cowbell lines over the hats, to be heard one at a time. */
const THREE_LINES = code(
  'hats: s("hh*8").gain(.25)',
  'perc: s("cb(4,16)").gain(.6)',
  'perc2: s("cb(3,8)").gain(.6)',
  'perc3: s("cb(5,16)").gain(.6)',
);

/** S4: bar 1 plays (3,8), bar 2 the same with a third number. */
const ROTATED = code('hats: s("hh*8").gain(.25)', 'perc: s("<cb(3,8) cb(3,8,2)>").gain(.6)');

/** S5: the rim on plain (5,16) under the bossa; the learner starts it from another step. */
const S5_STARTER = groove('perc: s("⟪rim(5,16)⟫").gain(.7)');
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const S5_SOLUTION = BOSSA;
/** The bossa rim: 3+3+4+3+3 sixteenths from beat 1 (evaluated: `rim(5,16,10)`). */
const BOSSA_ONSETS: Rat[] = [
  [0, 1],
  [3, 16],
  [3, 8],
  [5, 8],
  [13, 16],
];
const BOSSA_RIM: RubricRule = {
  id: "bossa-rim",
  label: "The rim plays sixteenths 1, 4, 7, 11 and 14 of every bar: gaps of 3+3+4+3+3 from beat 1",
  required: true,
  skills: ["R18"],
  rule: "onsets",
  track: "perc",
  equals: BOSSA_ONSETS,
  perBar: true,
};
const WITH_ROTATION: RubricRule = {
  id: "with-rotation",
  label: "The rim is written with a third number in its brackets, or with `.euclidRot()`",
  required: true,
  skills: ["R18"],
  rule: "uses",
  tool: ["tb.mini.euclid-rot", "tb.euclidRot"],
  min: 1,
};

/** S6: two cowbell rhythms over the hats; the learner names their numbers. */
const quizCode = (pattern: string) => code('hats: s("hh*8").gain(.25)', `perc: s("${pattern}").gain(.7)`);
const quizHints = (): HintLadder =>
  ladder(
    "Count the cowbell hits in one bar first.",
    "Count the hats, 1 to 8, then decide: do the hits land only on eighths, or also between them? That sets the steps, 8 or 16.",
    "With the hits and the steps set, listen for the first hit: if it is not on beat 1, a third number says how many steps later the rhythm starts.",
  );
type Euclid = [number, number] | [number, number, number];
type Wrong = { name: string; euclid: Euclid; code: "id.euclid-wrong" | "id.euclid-rotation" };
const spell = (e: Euclid) => `(${e.join(",")})`;
/**
 * The Euclid answer (`{ ui: "euclid" }`: hits, steps, rotation) is graded by the grader and drawn by the answers
 * widget, but content-kit still lists it as planned. Until it moves into `IMPLEMENTED`, the same item is a choice
 * among the answer and its pinned wrong numbers, each written as the code says it; the switch is automatic, and
 * both shapes pass this lesson's checks (the widget's tests were run with it enabled).
 */
const EUCLID_WIDGET = IMPLEMENTED.answerUis.includes("euclid");
const quizPart = (
  id: string,
  prompt: string,
  pattern: string,
  answer: Euclid,
  also: { name: string; euclid: Euclid }[],
  wrong: Wrong[],
): IdentifyEx => {
  const base: Omit<IdentifyEx, "answer" | "correct" | "tests" | "feedbackText"> = {
    kind: "identify",
    id,
    version: 1,
    role: "check",
    prompt,
    skills: [{ skill: "R18", w: 1 }],
    hints: quizHints(),
    stimulus: { src: "code", code: quizCode(pattern), bars: 2, showCode: false },
    cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  };
  if (EUCLID_WIDGET)
    return {
      ...base,
      answer: { ui: "euclid", maxSteps: 16, rotation: true },
      correct: { euclid: answer },
      tests: [
        { name: spell(answer), response: { answer: { euclid: answer } }, expect: "pass" },
        ...also.map((a) => ({
          name: a.name,
          response: { answer: { euclid: a.euclid } },
          expect: "pass" as const,
        })),
        ...wrong.map((w) => ({
          name: w.name,
          response: { answer: { euclid: w.euclid } },
          expect: "fail" as const,
          feedback: [w.code],
        })),
      ],
    };
  const options = [answer, ...wrong.map((w) => w.euclid)]
    .map((e) => ({ id: e.join("-"), label: spell(e) }))
    .sort((x, y) => x.id.localeCompare(y.id));
  return {
    ...base,
    answer: { ui: "choice", options },
    correct: { choice: [answer.join("-")] },
    feedbackText: {
      "id.wrong":
        "Not that one. Count the hits in one bar, then whether they sit only on eighths, then where the first one lands.",
    },
    tests: [
      { name: spell(answer), response: { answer: { choice: [answer.join("-")] } }, expect: "pass" },
      ...wrong.map((w) => ({
        name: w.name,
        response: { answer: { choice: [w.euclid.join("-")] } },
        expect: "fail" as const,
        feedback: ["id.wrong" as const],
      })),
    ],
  };
};
// Rhythm 1 is (3,16): hits on 0, 5/16, 5/8 (5+5+6). Rhythm 2 is the cinquillo started one step later: 1/8, 3/8,
// 1/2, 3/4, 7/8 (evaluated). Each pins the right function with the wrong result.
const QUIZ_ONE = quizPart(
  "rhythm-one",
  "Rhythm 1: hits, steps and, if it needs one, a third number.",
  "cb(3,16)",
  [3, 16],
  [{ name: "with a third number of 0", euclid: [3, 16, 0] }],
  [
    { name: "the right hits on eight steps: the tresillo", euclid: [3, 8], code: "id.euclid-wrong" },
    { name: "the right hits and steps, started later", euclid: [3, 16, 2], code: "id.euclid-rotation" },
  ],
);
const QUIZ_TWO = quizPart(
  "rhythm-two",
  "Rhythm 2: hits, steps and, if it needs one, a third number.",
  "cb(5,8,1)",
  [5, 8, 1],
  [],
  [
    { name: "the right hits and steps, no third number", euclid: [5, 8], code: "id.euclid-rotation" },
    { name: "a step too far", euclid: [5, 8, 2], code: "id.euclid-rotation" },
    { name: "five over sixteen", euclid: [5, 16, 1], code: "id.euclid-wrong" },
  ],
);

/** S7: the method form; the cowbell plays the tresillo every bar and the learner patterns k. */
const S7_STARTER = code(KICK, HATS, BASS, CHORDS, 'perc: s("cb").euclid(⟪3⟫, 8).gain(.6)');
const s7 = (percLine: string) => code(KICK, HATS, BASS, CHORDS, percLine);
const S7_SOLUTION = s7('perc: s("cb").euclid("<3 5>", 8).gain(.6)');
const WITH_METHOD: RubricRule = {
  id: "with-method",
  label: "The cowbell is written with the `.euclid()` method",
  required: true,
  skills: ["R18"],
  rule: "uses",
  tool: ["tb.euclid", "tb.euclidRot"],
  min: 1,
};

/**
 * S8: the Band plays bass and chords, the son groove's I–V7 (C, then G7: band.son-montuno, a tumbao and offbeat
 * keys, straight in every flavour); the percussion is the learner's. Not band.two-chord-vamp: its jazz-soul flavour
 * swings its comping, which flams against straight sixteenth-step bells.
 */
const MAKE_STARTER = code(
  'perc: s("rim*4").gain(.7)',
  'kick: s("bd ~ bd ~").gain(.7)',
  'perc2: s("sh*8").gain(.3)',
);
const make = (...lines: string[]) => code(...lines);
const FIVE_OVER_SIXTEEN: RubricRule = {
  id: "bell-five-sixteen",
  label: "The bell line plays five hits spread over sixteen steps, started on any step",
  required: true,
  skills: ["R18"],
  rule: "euclid",
  track: "perc",
  k: 5,
  n: 16,
  rotationFree: true,
};

/** Seconds from the start of a tap stimulus of the sixteenth-note positions (0 = beat 1 of bar 1) at `BPM`. */
const at = (sixteenths: number[]) => sixteenths.map((e) => Math.round((e * 15000) / BPM) / 1000);
const bars4 = (perBar: number[]) => [0, 16, 32, 48].flatMap((b) => perBar.map((e) => b + e));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R3.L03",
  version: 3,
  title: "Euclidean Rhythms & Rotation",
  objective:
    "I can write a rhythm from two numbers, start it from another step, and hear which numbers made it.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R18"],
  terms: [
    { id: "term.euclidean-rhythm", step: "S3" },
    { id: "term.rotation", step: "S5" },
  ],
  canDo: ["cd.code.euclidean"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same hits, other start",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "bossa", code: BOSSA, bars: 4 },
      exercise: {
        kind: "listen",
        id: "same-hits-other-start",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the rimshot in both loops; nothing else changes. Notice which loop sways like bossa nova and which just ticks along, and where the longest gap between rimshots falls in the bar.",
        skills: [{ skill: "R18", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: BOSSA,
            caption: "Five rimshots a bar. Where is the longest gap?",
            bars: 4,
          },
          {
            code: PLAIN,
            caption: "Five rimshots again. Where is the longest gap now?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the rimshot",
      minutes: 1.25,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-rim",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the rimshot, the dry click, and ignore the kick and the bass. It plays five times a bar, with one gap longer than the others. Four bars, twenty taps in all. Done when each tap lands with a rimshot.",
        skills: [{ skill: "R18", w: 1 }],
        hints: ladder(
          "Listen for the rimshot's dry click: four of its gaps are short, one is longer.",
          "Three short gaps, one long one, and a short one to the bar line. The long gap comes after the third hit.",
          "Say three quick counts between hits, but four after the third: 1-2-3, 1-2-3, 1-2-3-4, 1-2-3, 1-2-3.",
        ),
        mode: "along",
        stimulus: { src: "code", code: BOSSA, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "perc" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A rimshot went by without a tap. Five in every bar, one long gap among them.",
          "tap.extra":
            "A tap landed where the rimshot is quiet. It plays five times a bar, not on every beat.",
        },
        tests: [
          {
            name: "with the rim: 3+3+4+3+3",
            response: { taps: at(bars4([0, 3, 6, 10, 13])) },
            expect: "pass",
          },
          { name: "on every beat", response: { taps: at(bars4([0, 4, 8, 12])) }, expect: "fail" },
          {
            name: "on every eighth",
            response: { taps: at(bars4([0, 2, 4, 6, 8, 10, 12, 14])) },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two numbers, three rhythms",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "three-lines", code: THREE_LINES, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "two-numbers-three-rhythms",
        version: 1,
        role: "practice",
        prompt:
          "Three cowbell lines, each from two numbers. Run them one at a time, muting the other two, and read each on the roll. Then answer: which line plays plain quarter notes, and how many sixteenths apart most hits of (5,16) are.",
        skills: [{ skill: "R18", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Hear each line alone, and count sixteenths between its hits: four of them make a beat.",
        },
        hints: ladder(
          "Play each line alone and listen for the one that sounds like a plain count of four.",
          "The second number is the steps: 16 is sixteenths, four to a beat. Read the gaps of the five-hit line on the roll in sixteenths.",
          "Four of the five gaps in the five-hit line have the same size; one is a step longer.",
        ),
        code: { starter: THREE_LINES },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which line plays plain quarter notes?",
            options: [
              { id: "4-16", label: "(4,16)" },
              { id: "3-8", label: "(3,8)" },
              { id: "5-16", label: "(5,16)" },
            ],
            correct: ["4-16"],
          },
          {
            q: "number",
            prompt: "In (5,16), how many sixteenths apart are most of the hits?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["4-16"], number: 3 } }, expect: "pass" },
          {
            name: "the tresillo read as quarters",
            response: { answer: { choice: ["3-8"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the long gap counted",
            response: { answer: { choice: ["4-16"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "predict",
      title: "A third number",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "a-third-number",
        version: 1,
        role: "practice",
        prompt:
          "Bar 1 plays `cb(3,8)`, the tresillo, 3+3+2. Bar 2 plays `cb(3,8,2)`: a third number, 2. Predict what bar 2 will sound like, and pick it.",
        skills: [{ skill: "R18", w: 1 }],
        hints: null,
        tests: [],
        code: ROTATED,
        bars: 2,
        mode: "choose",
        choices: [
          {
            id: "later",
            label: "The same gaps started two steps later and wrapped round the bar, so it reads 2+3+3",
          },
          { id: "closer", label: "The three hits closer together" },
          { id: "earlier", label: "Every hit two steps earlier" },
        ],
        correct: ["later"],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Find the bossa",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "find-the-bossa",
        version: 1,
        role: "check",
        prompt:
          "Add a third number to the rimshot's `(5,16)` so the same rhythm starts from another step and matches the target: a hit on beat 1, and the long gap after the third hit. Now the long gap ends the bar. Done when the rim plays the target's rhythm.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 4 },
        // Heard: the five hits in their bossa places in every bar and nothing else. Then the notation the lesson
        // teaches: the same rhythm written out slot by slot sounds right and is told to use the third number.
        matcher: { m: "rubric", rules: [BOSSA_RIM, WITH_ROTATION] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // The override serves both rules (the rhythm heard and the notation), so it stays neutral; the hints carry
        // the listening advice.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        srs: [{ family: "fam.code.mini", mode: "review-if-due" }],
        hints: ladder(
          "Find the long gap in the target and in yours: in yours it ends the bar.",
          "A third number starts the rhythm that many sixteenth steps later and wraps the end round to the start. Count steps on the roll.",
          "Your long gap has to move from the end of the bar to just after the third hit, and a hit has to stay on beat 1.",
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          {
            name: "the method: .euclidRot(5,16,10)",
            response: { code: groove('perc: s("rim").euclidRot(5,16,10).gain(.7)') },
            expect: "pass",
          },
          { name: "on the cowbell", response: { code: groove(rim("cb(5,16,10)")) }, expect: "pass" },
          {
            name: "inside an alternation",
            response: { code: groove(rim("<rim(5,16,10)>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S5_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right call, the wrong start: rim(5,16,3)",
            response: { code: groove(rim("rim(5,16,3)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right rhythm, silent: .gain(0)",
            response: { code: groove('perc: s("rim(5,16,10)").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right rhythm, stretched over two bars",
            response: { code: groove(rim("rim(5,16,10)", ".slow(2)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the target written slot by slot, without a third number",
            response: { code: groove(rim("rim ~ ~ rim ~ ~ rim ~ ~ ~ rim ~ ~ rim ~ ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Name the numbers",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "name-the-numbers",
        version: 1,
        role: "check",
        prompt:
          "For each of the two cowbell rhythms over the hats, give its numbers: the hits, the steps (8 or 16), and a third number if it does not start on beat 1.",
        skills: [{ skill: "R18", w: 1 }],
        hints: quizHints(),
        srs: [
          {
            deck: "deck.rhy.euclid",
            cards: ["fact.rhy.euclid.3-8-2", "fact.rhy.euclid.5-16-10"],
            mode: "seed",
          },
        ],
        tests: [],
        parts: [QUIZ_ONE, QUIZ_TWO],
      },
    },
    {
      id: "S7",
      kind: "modify",
      title: "Numbers that change",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "numbers-that-change",
        version: 1,
        role: "check",
        prompt:
          "`.euclid(3, 8)` is `(3,8)` written as a method, and its numbers may be patterns. Change the hits number inside `.euclid()` so bar 1 keeps the tresillo and bar 2 plays the cinquillo. Keep the 8. Done when the bars alternate like the target.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: S7_STARTER },
        reference: { solutions: [S7_SOLUTION], bars: 4 },
        // Heard: the cowbell's rhythm over four bars (tresillo, cinquillo, tresillo, cinquillo); then the method,
        // so the same rhythm written in mini-notation is told to use it.
        matcher: {
          m: "all",
          of: [
            {
              m: "rhythm",
              tol: [1, 16],
              durations: false,
              perRole: false,
              displacementCredit: 0.5,
              tracks: ["perc"],
            },
            { m: "rubric", rules: [WITH_METHOD] },
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // The catalog's rhythm texts name the beat where the target plays a hit, which here is the cinquillo's
        // answer: these say which bar to listen to, and leave the places to the ear.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}: the target's cowbell has a hit yours does not play yet. Count its hits in that bar.",
          "rhythm.extra":
            "Bar {bar}: your cowbell plays a hit the target's does not. Count its hits in that bar.",
        },
        hints: ladder(
          "Find which of the two numbers counts the hits: that one changes from bar to bar.",
          "A number inside the method can be a pattern in quotes, like any mini-notation: `< >` plays one value per bar.",
          "The steps stay 8 in both bars; only the hits change, three in one bar and five in the next.",
        ),
        tests: [
          { name: "reference", response: { code: S7_SOLUTION }, expect: "pass" },
          {
            name: "with euclidRot and no turn",
            response: { code: s7('perc: s("cb").euclidRot("<3 5>", 8, 0).gain(.6)') },
            expect: "pass",
          },
          {
            name: "on the rimshot",
            response: { code: s7('perc: s("rim").euclid("<3 5>", 8).gain(.6)') },
            expect: "pass",
          },
          {
            name: "louder",
            response: { code: s7('perc: s("cb").euclid("<3 5>", 8).gain(.8)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S7_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right call, the bars in the wrong order",
            response: { code: s7('perc: s("cb").euclid("<5 3>", 8).gain(.6)') },
            expect: "fail",
            feedback: ["rhythm.displaced"],
          },
          {
            name: "both inside one bar: [3 5]",
            response: { code: s7('perc: s("cb").euclid("[3 5]", 8).gain(.6)') },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
          {
            name: "the right rhythm in mini-notation, without the method",
            response: { code: s7('perc: s("<cb(3,8) cb(5,8)>").gain(.6)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your bell section",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.son-montuno", tracks: ["bass", "chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-bell-section",
        version: 1,
        role: "practice",
        title: "Bell section",
        prompt:
          "Build your bell section; the band plays bass and C then G7. Required: the bell line, `perc`, plays five hits over sixteen steps, started on any step. Also on the checklist: a second line, `perc2`, that skips beat 1, and the bossa rim on the bell. For more, a kick or a shaker with its own numbers.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          FIVE_OVER_SIXTEEN,
          {
            id: "layer-off-one",
            label: "The `perc2` line never plays on beat 1",
            required: false,
            skills: ["R18"],
            rule: "onsets",
            track: "perc2",
            excludes: [[0, 1]],
            perBar: true,
          },
          {
            ...BOSSA_RIM,
            id: "bossa-rim",
            label: "The bell line plays the bossa rim: sixteenths 1, 4, 7, 11 and 14",
            required: false,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with the bell line: give it five hits over sixteen steps, with two numbers in brackets.",
          "Two numbers in brackets after the sound give the hits and the steps; a third starts the rhythm later.",
          "Try each third number from 0 upwards on the bell and keep the one you like over the band.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the bell on (5,16)",
            response: {
              code: make(
                'perc: s("rim(5,16)").gain(.7)',
                'kick: s("bd ~ bd ~").gain(.7)',
                'perc2: s("sh*8").gain(.3)',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: the bossa rim, a turned shaker, a second bell, faster",
            response: {
              code: make(
                'perc: s("rim(5,16,10)").gain(.7)',
                'kick: s("bd(3,8)").gain(.7)',
                'perc2: s("sh(7,16,1)").gain(.3)',
                'perc3: s("cb(3,8,2)").gain(.4)',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(136/4)"),
            },
            expect: "pass",
          },
          {
            name: "the method, started three steps later",
            response: {
              code: make('perc: s("cb").euclidRot(5,16,3).gain(.6)', 'kick: s("bd ~ bd ~").gain(.7)'),
            },
            expect: "pass",
          },
          {
            name: "written slot by slot",
            response: {
              code: make(
                'perc: s("rim ~ ~ rim ~ ~ rim ~ ~ rim ~ ~ rim ~ ~ ~").gain(.7)',
                'kick: s("bd ~ bd ~").gain(.7)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the method with no turn: .euclid(5,16)",
            response: {
              code: make('perc: s("cb").euclid(5, 16).gain(.6)', 'perc2: s("sh(3,8,1)").gain(.3)'),
            },
            expect: "pass",
          },
          {
            name: "the right call on eight steps: rim(5,8)",
            response: { code: make('perc: s("rim(5,8)").gain(.7)', 'kick: s("bd ~ bd ~").gain(.7)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the bossa rim, silent: .gain(0)",
            response: { code: make('perc: s("rim(5,16,10)").gain(0)', 'kick: s("bd ~ bd ~").gain(.7)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the method, stretched over two bars",
            response: {
              code: make(
                'perc: s("rim").euclidRot(5,16,10).slow(2).gain(.7)',
                'kick: s("bd ~ bd ~").gain(.7)',
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
