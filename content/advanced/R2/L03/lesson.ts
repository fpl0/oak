// R2.L03 Hemiola (spec: content/specs/R2.md). Six pulses can be heard as two groups of three or as three groups of
// two. In 6/8 the bar is 3+3; when the chords and the bass regroup one bar into 2+2+2 while the drums keep 3+3, the
// music seems to tip into 3/4 and back without changing speed. That regrouping of the same six pulses, one bar
// after another, is a hemiola. (Two streams at once, threes against twos in the same bar, is R2.L04's polyrhythm.)
//
// Written for the learner at the gate (AUTHORING §20.1): R2 opens after U13.CP and may be taken before R1 and with
// U14–U17 unfinished, so the lesson uses what U13.CP guarantees: 6/8 and its dotted-quarter tempo line (U13.L04),
// seventh chords by name (U12), `< >` for one item per bar. R1's words (metric weight, displacement) and R3's are
// not used. Felt, then read, then coded: the learner taps the chords (S2) before reading the roll (S3).
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: S5 reads the chords' onsets across both bars (`perBar: false`):
//   bar 1 on the two big beats and on no other eighth, bar 2 on three even places and on no other eighth; the
//   Make's `regrouped` reads, per line, which bars are grouped 3+3 and which 2+2+2 (normalize drops a silent line
//   and a line more than 24 dB under the loudest);
// - each graded step pins a WRONG answer that uses the right function: both bars regrouped (that is 3/4 throughout,
//   no hemiola), five steps in bar 2, the regrouped bar at `.gain(0)`; in the Make, 2+2+2 throughout, the
//   regrouped bar silenced by a gain pattern, the regrouped line masked 30 dB under the bass;
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type Rat, type RubricRule } from "@oak/content-kit";

const BPM = 60;
const TEMPO = `setcpm(${BPM}/2)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One bar of 6/8 at 60 dotted quarters a minute: two seconds. */
const BAR_SEC = (2 * 60) / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the groove -------------------------------------------------------------------------------------------

const DRUMS = 'drums: s("bd ~ ~ sd ~ ~")';
const HATS = 'hats: s("hh*6").gain(.4)';
/** Six eighths as two groups of three: the two big beats. */
const THREES = "x ~ ~ x ~ ~";
/** The same six eighths as three groups of two. */
const TWOS = "x ~ x ~ x ~";
/** Bar 1 in threes, bar 2 in twos: the hemiola every other bar. */
const HEMIOLA = `<[${THREES}] [${TWOS}]>`;
/** A minor: i7 then iv7, one chord a bar (degree 1, then degree 4: `n` 0 and 3 on the bass). */
const chords = (rhythm: string, tail = "") =>
  `chords: chord("<Am7 Dm7>").voicing().struct("${rhythm}").s("rhodes").gain(.6)${tail}`;
const bass = (rhythm: string, tail = "") =>
  `bass: n("<0 3>").struct("${rhythm}").scale("A1:minor").s("fingerbass").lpf(800)${tail}`;

const GROOVE_THREES = code(DRUMS, HATS, chords(THREES), bass(THREES));
const HOOK = code(DRUMS, HATS, chords(HEMIOLA), bass(HEMIOLA));

/** Seconds from the start of a tap stimulus, for places given in bars (0-based, fractions of a bar). */
const at = (places: number[]) => places.map((p) => Math.round(p * BAR_SEC * 1000) / 1000);
/** The chords of the hook over four bars: two, three, two, three. */
const HOOK_TAPS = at([0, 1 / 2, 1, 4 / 3, 5 / 3, 2, 5 / 2, 3, 10 / 3, 11 / 3]);

// --- S4: threes or twos ------------------------------------------------------------------------------------

const THREE_ID = "threes";
const TWO_ID = "twos";
const GROUP_OPTIONS = [
  { id: THREE_ID, label: "In threes: two chords a bar" },
  { id: TWO_ID, label: "In twos: three chords a bar" },
];
const earHints = (): HintLadder =>
  ladder(
    "Listen to the Rhodes alone and notice whether it lands with the kick and the snare or slips between them.",
    "The drums mark two big beats in every bar. Count the Rhodes chords from one kick to the next.",
    "Tap your foot with the kick and the snare and count the chords out loud from one kick to the next.",
  );
const earItem = (
  id: string,
  prompt: string,
  changes: string,
  rhythm: string,
  answer: string,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "R17", w: 1 }],
  hints: earHints(),
  stimulus: {
    src: "code",
    code: code(DRUMS, HATS, `chords: chord("${changes}").voicing().struct("${rhythm}").s("rhodes").gain(.6)`),
    bars: 2,
    showCode: false,
  },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: { ui: "choice", options: GROUP_OPTIONS },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      "Not this time. Play it again and count the Rhodes chords from one kick to the next, while the drums keep their two big beats.",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: "the other grouping",
      response: { answer: { choice: [answer === THREE_ID ? TWO_ID : THREE_ID] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

// --- S5: regroup bar 2 ------------------------------------------------------------------------------------

const MODIFY_STARTER = code(
  DRUMS,
  HATS,
  'chords: chord("<Am7 Dm7>").voicing().struct("⟪x ~ ~ x ~ ~⟫").s("rhodes").gain(.6)',
);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const modifyAnswer = (rhythm: string, tail = "", extra: string[] = []) =>
  code(DRUMS, HATS, chords(rhythm, tail), ...extra);
const MODIFY_SOLUTION = modifyAnswer(HEMIOLA);

/** Bar 1 on its two big beats; bar 2 on three even places (in bars from the start of bar 1). */
const REGROUP_PLACES: Rat[] = [
  [0, 1],
  [1, 2],
  [1, 1],
  [4, 3],
  [5, 3],
];
/** Every other eighth of the two bars: bar 1's 2nd, 3rd, 5th and 6th, bar 2's 2nd, 4th and 6th. */
const OTHER_EIGHTHS: Rat[] = [
  [1, 6],
  [1, 3],
  [2, 3],
  [5, 6],
  [7, 6],
  [3, 2],
  [11, 6],
];
const REGROUP_RULE: RubricRule = {
  id: "bar-two-regrouped",
  label:
    "Bar 1 plays chords on eighths 1 and 4 (two groups of three); bar 2 on eighths 1, 3 and 5 (three groups of two)",
  required: true,
  skills: ["R17"],
  rule: "onsets",
  track: "chords",
  contains: REGROUP_PLACES,
  excludes: OTHER_EIGHTHS,
  perBar: false,
};

// --- S6: the Make -----------------------------------------------------------------------------------------

/** A minor over four bars: i7, iv7, VImaj7, v7; the bass on each chord's root (degrees 1, 4, 6, 5). */
const makeChords = (rhythm: string, tail = "") =>
  `chords: chord("<Am7 Dm7 F^7 Em7>").voicing().struct("${rhythm}").s("rhodes").gain(.6)${tail}`;
const makeBass = (rhythm: string, tail = "") =>
  `bass: n("<0 3 5 4>").struct("${rhythm}").scale("A1:minor").s("fingerbass").lpf(800)${tail}`;
const MAKE_STARTER = code(makeChords(THREES), makeBass(THREES));
const make = (...lines: string[]) => code(...lines);
/** The hemiola as a cadence: three bars in threes, the fourth in twos. */
const CADENCE = `<[${THREES}]!3 [${TWOS}]>`;

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R2.L03",
  version: 3,
  title: "Hemiola",
  objective: "I can hear six pulses regroup from two threes into three twos, and write it into a groove.",
  key: { tonic: "A", mode: "minor" },
  meter: "6/8",
  bpm: BPM,
  introduces: ["R17"],
  practises: [],
  terms: [{ id: "term.hemiola", step: "S3" }],
  canDo: ["cd.hear.hemiola"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Threes, then twos",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "threes-then-twos",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the Rhodes and the bass against the drums in both loops; the drums do not change. Notice which bars of the second loop stop swaying with the drums, and what they do instead.",
        skills: [{ skill: "R17", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: GROOVE_THREES,
            caption: "The Rhodes and the bass land with the drums' two big beats.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The same chords over the same drums. Follow the Rhodes in bars 2 and 4.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap with the Rhodes",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-chords",
        version: 1,
        role: "practice",
        prompt:
          "Tap with every Rhodes chord, the soft keyboard chords, and ignore the drums. Bars 1 and 3 have two chords; bars 2 and 4 have three. Four bars, ten taps in all. Done when each tap lands with a chord.",
        skills: [{ skill: "R17", w: 1 }],
        hints: ladder(
          "Follow the Rhodes, not the drums: in some bars it plays one more chord than in others.",
          "Bars 1 and 3 follow the kick and the snare. In bars 2 and 4 the chords stop following them.",
          "Count the six quick hi-hat hits of each bar under your breath, and tap only where a chord sounds.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "chords" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        tests: [
          { name: "with the chords: 2, 3, 2, 3", response: { taps: HOOK_TAPS }, expect: "pass" },
          {
            name: "two every bar, with the drums",
            response: { taps: at([0, 1 / 2, 1, 3 / 2, 2, 5 / 2, 3, 7 / 2]) },
            expect: "fail",
          },
          {
            name: "three every bar",
            response: {
              taps: at([0, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3, 2, 7 / 3, 8 / 3, 3, 10 / 3, 11 / 3]),
            },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "The same six",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-same-six", code: HOOK, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "the-same-six",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read two bars on the roll: the hi-hat marks every eighth note, and the Rhodes and the bass sit on some of them. Then answer: how many eighths the hi-hat plays in bar 2, and how the chords group them.",
        skills: [{ skill: "R17", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the hi-hat hits in bar 2, then look at which of them the chords land on, and how many hits apart they are.",
        },
        hints: ladder(
          "Count the hi-hat hits in bar 1, then in bar 2.",
          "The hi-hat plays the same number of hits in every bar. In each bar, count how many hits lie from one chord to the next.",
          "In bar 1 the chords are three hits apart. Count the gap in bar 2 the same way.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many eighth notes does the hi-hat play in bar 2?",
            correct: 6,
          },
          {
            q: "choice",
            prompt: "How do the chords group those eighths in bar 2?",
            options: [
              { id: "2+2+2", label: "2+2+2: 1-2 1-2 1-2" },
              { id: "3+3", label: "3+3: 1-2-3 1-2-3" },
              { id: "3+2+1", label: "3+2+1: 1-2-3 1-2 1" },
            ],
            correct: ["2+2+2"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 6, choice: ["2+2+2"] } }, expect: "pass" },
          {
            name: "four: the bar read as shorter",
            response: { answer: { number: 4, choice: ["2+2+2"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "3+3: the drums' grouping",
            response: { answer: { number: 6, choice: ["3+3"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Threes or twos?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "threes-or-twos",
        version: 1,
        role: "check",
        prompt:
          "Four short grooves in 6/8. The drums keep their two big beats every time. For each, pick whether the Rhodes is grouped in threes, with the drums, or in twos, against them.",
        skills: [{ skill: "R17", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.meter", mode: "review-if-due" }],
        tests: [],
        parts: [
          earItem("groove-one", "Groove 1.", "<Am7 Dm7>", TWOS, TWO_ID),
          earItem("groove-two", "Groove 2.", "<F^7 Em7>", THREES, THREE_ID),
          earItem("groove-three", "Groove 3.", "<Dm7 Am7>", "x@3 x@3", THREE_ID),
          earItem("groove-four", "Groove 4.", "<Em7 F^7>", "x@2 x@2 x@2", TWO_ID),
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Regroup bar 2",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "regroup-bar-two",
        version: 1,
        role: "check",
        prompt:
          "Give each bar its own rhythm in the chords' `.struct()`. Keep bar 1 as two groups of three, with the drums. Make bar 2 three groups of two: three chords, evenly spaced over the same six eighths. Keep the tempo. Done when the bars alternate like the target.",
        skills: [{ skill: "R17", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 2 },
        // Read across both bars: bar 1 on its two big beats only, bar 2 on three even places only. Both bars in
        // twos, five steps in bar 2, an extra chord in either bar and a silent line all fail.
        matcher: { m: "rubric", rules: [REGROUP_RULE] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the target: bar 1 sways with the drums, and bar 2 has its own number of chords, evenly spaced across the bar.",
        },
        hints: ladder(
          "Count the chords in bar 2 of the target and the hi-hat hits between them.",
          "The rhythm string is the same for every bar. `< >` gives each bar its own item, and each item can be six steps in `[ ]`.",
          "Put bar 1's six steps in the first `[ ]` of a `< >`, unchanged. Then place bar 2's chords in a second `[ ]` of six steps, an equal distance apart.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "written with weights: x@3 x@3, then x@2 x@2 x@2",
            response: { code: modifyAnswer("<[x@3 x@3] [x@2 x@2 x@2]>") },
            expect: "pass",
          },
          {
            name: "three equal steps in bar 2: the same places",
            response: { code: modifyAnswer(`<[${THREES}] [x x x]>`) },
            expect: "pass",
          },
          {
            name: "the bass regrouped with the chords, the chords softer",
            response: {
              code: code(DRUMS, HATS, chords(HEMIOLA).replace("gain(.6)", "gain(.45)"), bass(HEMIOLA)),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(MODIFY_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right regrouping in both bars: 3/4 throughout, no hemiola",
            response: { code: modifyAnswer(TWOS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the bars swapped: twos first, threes second",
            response: { code: modifyAnswer(`<[${TWOS}] [${THREES}]>`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "five steps in bar 2: not on the eighths",
            response: { code: modifyAnswer(`<[${THREES}] [x ~ x ~ x]>`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "an extra chord at the end of bar 2",
            response: { code: modifyAnswer(`<[${THREES}] [x ~ x ~ x x]>`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bar 2 right, bar 1 not kept: an extra chord on its third eighth",
            response: { code: modifyAnswer(`<[x ~ x x ~ ~] [${TWOS}]>`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: modifyAnswer(HEMIOLA, ".gain(0)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your hemiola",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.soul-68", tracks: ["drums"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-hemiola",
        version: 1,
        role: "practice",
        title: "Hemiola",
        prompt:
          "Make your chords and bass regroup; the band's drums keep two big beats a bar. Required: some bars of the chords fall in threes, with the drums, and others in three groups of two. Also on the checklist: the bass regroups too and plays beat 1 of every bar. Regroup every other bar, or only the last of the phrase.",
        skills: [{ skill: "R17", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "regrouped",
            label: "Some bars of the chords fall in two groups of three, others in three groups of two",
            required: true,
            skills: ["R17"],
            rule: "custom",
            fn: "regrouped",
            params: {},
          },
          {
            id: "bass-regrouped",
            label: "The bass also has bars in threes and bars in twos",
            required: false,
            skills: ["R17"],
            rule: "custom",
            fn: "regrouped",
            params: { track: "bass" },
          },
          {
            id: "bass-on-one",
            label: "The bass plays on beat 1 of every bar",
            required: false,
            skills: ["R17"],
            rule: "onsets",
            track: "bass",
            contains: [[0, 1]],
            perBar: true,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Pick which bars stay with the drums and which regroup into twos.",
          "A bar of six eighths can be two groups of three or three groups of two. Give the bars their own rhythms with `< >`.",
          "Keep three bars of the rhythm string as they are, in a `< >`, and give the fourth its own six steps with three chords in it.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the chords regroup in the last bar of four",
            response: { code: make(makeChords(CADENCE), makeBass(THREES)) },
            expect: "pass",
          },
          {
            name: "the hook's way: both lines regroup every other bar",
            response: { code: make(makeChords(HEMIOLA), makeBass(HEMIOLA)) },
            expect: "pass",
          },
          {
            name: "the bass alone regroups, written with weights",
            response: {
              code: make(makeChords(THREES), makeBass("<[x@3 x@3] [x@3 x@3] [x@3 x@3] [x@2 x@2 x@2]>")),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars, a cadence every four, the bass moving between chord tones",
            response: {
              code: make(
                'chords: chord("<Am7 Dm7 F^7 Em7 Am7 Dm7 F^7 E7>").voicing()\n  .struct("<[x ~ ~ x ~ ~]!3 [x ~ x ~ x ~]>").s("rhodes").gain(.6)',
                'bass: n("<[0 ~ ~ 4 ~ ~] [3 ~ ~ 0 ~ ~] [5 ~ ~ 2 ~ ~] [4 ~ 4 ~ 1 ~]>").scale("A1:minor").s("fingerbass").lpf(800)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the right regrouping everywhere: 2+2+2 throughout is 3/4, no hemiola",
            response: { code: make(makeChords(TWOS), makeBass(TWOS)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the regrouped bar written, then silenced by a gain pattern",
            response: {
              code: make(
                makeChords(CADENCE).replace("gain(.6)", 'gain("<.6 .6 .6 0>")'),
                makeBass(CADENCE, '.gain("<1 1 1 0>")'),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chords regroup 30 dB under the bass: not heard",
            response: {
              code: make(makeChords(CADENCE).replace("gain(.6)", "gain(.03)"), makeBass(THREES)),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "five chords in the last bar: not twos",
            response: { code: make(makeChords(`<[${THREES}]!3 [x ~ x ~ x]>`), makeBass(THREES)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
