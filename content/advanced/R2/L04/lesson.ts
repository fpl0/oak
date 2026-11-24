// R2.L04 Polyrhythm 3:2, 4:3 (spec: content/specs/R2.md). Two even pulses at once in the same span: three against
// two puts three even notes in the time of two, and the two meet only on the downbeat; four against three does
// the same with four and three. Heard alone each pulse is simple; together they make a rhythm neither plays.
//
// Written for the learner at the gate (AUTHORING §20.1): R2 opens after U13.CP and may be taken before R1 and with
// U14–U17 unfinished, so the lesson uses what U13.CP guarantees (triplets from U13.L05) and R2's own words (odd
// meter, grouping, hemiola). R1's words (metric weight, interlock, displacement) and R3's (clave, tresillo,
// Euclid) are not used. Felt, then coded, then read: the learner taps the three over the two (S2) before reading
// the two pulses on the roll (S3).
//
// The two-hand tap of the spec (`tap.lanes`) is graded by the grader but no lesson host renders it yet
// (`GRADER_READY`), so S2 is the spec's fallback: one lane, the three only, over the two. The spec's say-it guide
// "pass the bread and butter" has six syllables, the six places of FOUR against three; the guide for three against
// two is "nice cup of tea": nice (both), cup (the three), of (the two), tea (the three), at 0, 1/3, 1/2 and 2/3 of
// the bar (evaluated: the hook's kick at 0 and 1/2, its cowbell at 0, 1/3 and 2/3).
//
// No Band (contracts §6.6 for R2.L04): both pulses are the learner's, because the rule reads both.
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: the cowbell's three in EVERY bar and on no place of the kick's two
//   or of a four (`onsets` with `contains`, `excludes` and `perBar`), the kick's two kept; the Make's `polyrhythm`
//   with `minBars` asks for both pulses evenly spaced and audible in the SAME bars (normalize drops a part more
//   than 24 dB under the loudest);
// - each graded step pins a WRONG answer that uses the right function: `<cb*3 ~>` (three in alternate bars),
//   `cb*6` (six against two), `cb*4` (four against two), the three at `.gain(0)`; in the Make the pre-flight's A6
//   (`<cb*3 ~>` against `<~ bd*2>`, the pulses taking turns) and the three 30 dB under the kick; in the ear step,
//   the mirror image (2:3 for 3:2);
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type Rat, type RubricRule } from "@oak/content-kit";

const BPM = 80;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the groove: the two on the kick and the bass, the three on the cowbell and the Rhodes ------------------------

const KICK = 'kick: s("bd bd")';
const PERC = 'perc: s("cb cb cb").gain(.6)';
/** C minor: i7 then iv7, one chord a bar; the bass on the root (degree 1, then degree 4: `n` 0 and 3). */
const bass = (rhythm: string) => `bass: n("<0 3>").struct("${rhythm}").scale("C2:minor").s("fingerbass")`;
const chords = (rhythm: string) =>
  `chords: chord("<Cm7 Fm7>").voicing().struct("${rhythm}").s("rhodes").gain(.5)`;
const BASS_TWO = bass("x x");
const CHORDS_THREE = chords("x x x");

/** The hook: the two (kick, bass) and the three (cowbell, Rhodes) at once. */
const HOOK = code(KICK, PERC, BASS_TWO, CHORDS_THREE);
const TWO_ALONE = code(KICK, BASS_TWO);
const THREE_ALONE = code(PERC, CHORDS_THREE);

// --- S2: the two and the three tapped with two hands (`tap.lanes`) ---------------------------------------------

const TAP_BPM = 66;
const TAP_STIMULUS = `setcpm(${TAP_BPM}/4)\n\n${[KICK, PERC, BASS_TWO].join("\n")}`;
/** One bar of 4/4 at 66 BPM, in seconds. */
const TAP_BAR = (4 * 60) / TAP_BPM;
/** Seconds from the start of the tap stimulus: the given fractions of each of four bars. */
const at = (places: number[]) =>
  [0, 1, 2, 3].flatMap((bar) => places.map((p) => Math.round((bar + p) * TAP_BAR * 1000) / 1000));

// --- S4: write the three -----------------------------------------------------------------------------------------

/** Held chords, one a bar, so only the cowbell and the kick make the rhythm. */
const HELD_CHORDS = 'chords: chord("<Cm7 Fm7>").voicing().s("rhodes").gain(.5)';
const S4_STARTER = code(KICK, 'perc: ⟪s("cb cb").gain(.6)⟫', BASS_TWO, HELD_CHORDS);
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const s4 = (percLine: string) => code(KICK, percLine, BASS_TWO, HELD_CHORDS);
const S4_SOLUTION = s4('perc: s("cb*3").gain(.6)');

const THREE: Rat[] = [
  [0, 1],
  [1, 3],
  [2, 3],
];
/** The places of the two and of a four that are not the downbeat: a three plays none of them. */
const NOT_THREE: Rat[] = [
  [1, 4],
  [1, 2],
  [3, 4],
];
const PERC_THREE: RubricRule = {
  id: "cowbell-three",
  label: "The cowbell plays three even notes in every bar, none on beats 2, 3 or 4",
  required: true,
  skills: ["R17"],
  rule: "onsets",
  track: "perc",
  contains: THREE,
  excludes: NOT_THREE,
  perBar: true,
};
const KICK_TWO: RubricRule = {
  id: "kick-two",
  label: "The kick still plays twice a bar, on beats 1 and 3",
  required: true,
  skills: ["R17"],
  rule: "onsets",
  track: "kick",
  contains: [
    [0, 1],
    [1, 2],
  ],
  perBar: true,
};

// --- S5: which pulses, by ear --------------------------------------------------------------------------------------

const EAR_OPTIONS = [
  { id: "3:2", label: "Cowbell three, kick two" },
  { id: "2:3", label: "Cowbell two, kick three" },
  { id: "straight", label: "Straight: cowbell four, kick two" },
  { id: "4:3", label: "Cowbell four, kick three" },
] as const;
type EarAnswer = (typeof EAR_OPTIONS)[number]["id"];
/** The answer a learner who confuses the two layers, or the two counts, gives. */
const CONFUSED: Record<EarAnswer, EarAnswer> = {
  "3:2": "2:3",
  "2:3": "3:2",
  straight: "4:3",
  "4:3": "straight",
};
const earCode = (high: number, low: number) => code(`kick: s("bd*${low}")`, `perc: s("cb*${high}").gain(.7)`);
const earHints = (): HintLadder =>
  ladder(
    "Listen to one sound at a time and count its notes in one bar, starting at the downbeat.",
    "Count the kicks first, against the downbeat where everything meets. Then count the cowbell in the same bar.",
    "Two pulses that divide the bar into halves and quarters always land together on the halves; two that do not meet only on the downbeat.",
  );
const earPart = (id: string, prompt: string, high: number, low: number, answer: EarAnswer): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "R17", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: earCode(high, low), bars: 2, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...EAR_OPTIONS] },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      "Not that one. Count the kicks of one bar, then the cowbell notes of the same bar, and listen for whether they meet anywhere but the downbeat.",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: `heard as ${CONFUSED[answer]}`,
      response: { answer: { choice: [CONFUSED[answer]] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

// --- S6: the Make --------------------------------------------------------------------------------------------------

const MAKE_STARTER = code(KICK, 'perc: s("cb cb").gain(.6)', BASS_TWO, chords("x x"));
const make = (...lines: string[]) => code(...lines);
/** The Make's one rule: three against two, evenly spaced and heard, in the same bars, four bars or more. */
const THREE_AGAINST_TWO: RubricRule = {
  id: "three-against-two",
  label: "For 4 bars or more, the cowbell plays three even notes a bar while the kick plays two",
  required: true,
  skills: ["R17"],
  rule: "polyrhythm",
  a: "perc",
  b: "kick",
  ratio: [3, 2],
  // Four bars, as the spec asks: the rule counts a loop as repeating up to `minBars`, so a two-bar loop of 3 against
  // 2 in every bar passes and two parts that take turns still never meet.
  minBars: 4,
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R2.L04",
  version: 4,
  title: "Polyrhythm 3:2, 4:3",
  objective: "I can play three even notes against two in the same bar, and hear four against three.",
  key: { tonic: "C", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R17"],
  terms: [{ id: "term.polyrhythm", step: "S3" }],
  canDo: ["cd.code.polyrhythm"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two, three, both",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "both", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-three-both",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the two, the three, then both at once, at one tempo. In the last loop, notice whether the bar marches or rolls, and the one place where the two pulses land together.",
        skills: [{ skill: "R17", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: TWO_ALONE, caption: "The kick and the bass: two even notes a bar.", bars: 2 },
          { code: THREE_ALONE, caption: "The cowbell and the Rhodes: three even notes a bar.", bars: 2 },
          {
            code: HOOK,
            caption: "Both at once. Where do they land together?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Two hands, two pulses",
      minutes: 1.25,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-three",
        version: 1,
        role: "practice",
        bpm: TAP_BPM,
        prompt:
          "Tap two pulses at once, one hand per lane, for four bars. Left lane: tap with the kick, the low thud, twice a bar. Right lane: tap with the cowbell, the high clank, three times a bar. Both hands tap together on beat 1. Say “nice cup of tea”: both on nice, right on cup and tea, left on of.",
        skills: [{ skill: "R17", w: 1 }],
        hints: ladder(
          "Find the one place in the bar where the kick and the cowbell land together: both hands tap there.",
          "The left hand splits the bar in half; the right hand splits it in three. They meet only on the first beat.",
          "Say the words with the loop: nice is both hands, cup the right, of the left, tea the right.",
        ),
        mode: "along",
        stimulus: { src: "code", code: TAP_STIMULUS, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        // One lane per hand (contracts §8.4, `tap.lanes`): the two with the kick on F, the three with the cowbell on J.
        target: { track: "perc" },
        lanes: [
          { label: "Left hand: the two, with the kick", track: "kick", key: "f" },
          { label: "Right hand: the three, with the cowbell", track: "perc", key: "j" },
        ],
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        tests: [
          {
            name: "both hands, each on its pulse",
            response: { lanes: [at([0, 1 / 2]), at([0, 1 / 3, 2 / 3])] },
            expect: "pass",
          },
          {
            name: "both hands a little late together",
            response: {
              lanes: [at([0, 1 / 2]).map((t) => t + 0.03), at([0, 1 / 3, 2 / 3]).map((t) => t + 0.03)],
            },
            expect: "pass",
          },
          {
            name: "the hands swapped: the three on F, the two on J",
            response: { lanes: [at([0, 1 / 3, 2 / 3]), at([0, 1 / 2])] },
            expect: "fail",
            feedback: ["tap.lanes-swapped"],
          },
          { name: "only the left hand", response: { lanes: [at([0, 1 / 2]), []] }, expect: "fail" },
          {
            name: "both hands on every place of either pulse",
            response: { lanes: [at([0, 1 / 3, 1 / 2, 2 / 3]), at([0, 1 / 3, 1 / 2, 2 / 3])] },
            expect: "fail",
          },
          {
            name: "the right hand tapping four, not three",
            response: { lanes: [at([0, 1 / 2]), at([0, 1 / 4, 1 / 2, 3 / 4])] },
            expect: "fail",
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where they meet",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "both-read", code: HOOK, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "where-they-meet",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop and read one bar on the roll: the kick's two notes and the cowbell's three. Then answer: where they land together, and on how many places in the bar either one plays.",
        skills: [{ skill: "R17", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Put a finger on each kick in the roll, then on each cowbell note, and count the places, counting a shared one once.",
        },
        hints: ladder(
          "Look for notes of the kick and the cowbell in the same column of the roll.",
          "The kick splits the bar in half; the cowbell splits it in three. Only the start of the bar is a place both share.",
          "Count the cowbell's three places, then add every kick that does not share one.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Where do the kick and the cowbell play together?",
            options: [
              { id: "one", label: "Only on the first beat of the bar" },
              { id: "every-beat", label: "On every beat" },
              { id: "never", label: "Never" },
            ],
            correct: ["one"],
          },
          { q: "number", prompt: "On how many places in one bar does either of them play?", correct: 4 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["one"], number: 4 } }, expect: "pass" },
          {
            name: "five: the shared downbeat counted twice",
            response: { answer: { choice: ["one"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "heard as meeting on every beat",
            response: { answer: { choice: ["every-beat"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Write the three",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "write-the-three",
        version: 1,
        role: "check",
        prompt:
          "Change only the cowbell's string so it plays three even notes in every bar, against the kick's two. It now doubles the kick. Keep the kick, the bass and the chords. Done when every bar has three evenly spaced cowbell notes.",
        skills: [{ skill: "R17", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        // Heard, in every bar: the cowbell's three and none of the places of a two or a four, with the kick's two
        // still there. A three in alternate bars, six or four even notes, and a silent cowbell all fail.
        matcher: { m: "rubric", rules: [PERC_THREE, KICK_TWO] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the target and count the cowbell notes of one bar against the kick's two.",
        },
        hints: ladder(
          "Count the target's cowbell notes in one bar, and listen for whether they are evenly spaced.",
          "The cowbell's string divides the bar into equal steps, one for each word in it. Every bar needs the same number.",
          "The kick's string has two words, so each takes half the bar. Give the cowbell's string as many words as the notes you want.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "written out: cb cb cb",
            response: { code: s4('perc: s("cb cb cb").gain(.6)') },
            expect: "pass",
          },
          {
            name: "inside brackets with weights: [cb@1 cb@1 cb@1]",
            response: { code: s4('perc: s("[cb@1 cb@1 cb@1]").gain(.6)') },
            expect: "pass",
          },
          {
            name: "on the rimshot, softer",
            response: { code: s4('perc: s("rim*3").gain(.4)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right three in alternate bars: <cb*3 ~>",
            response: { code: s4('perc: s("<cb*3 ~>").gain(.6)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "six against two: cb*6",
            response: { code: s4('perc: s("cb*6").gain(.6)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "four against two: cb*4",
            response: { code: s4('perc: s("cb*4").gain(.6)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right three, silent: .gain(0)",
            response: { code: s4('perc: s("cb*3").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kick changed too: an edit outside the cowbell",
            response: { code: S4_SOLUTION.replace('kick: s("bd bd")', 'kick: s("bd*3")') },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Which against which",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "which-against-which",
        version: 1,
        role: "check",
        prompt:
          "Four loops, two bars each, a kick under a cowbell. For each, count the cowbell notes and the kicks in one bar, and pick the ratio. One loop has four against three: one more note in each layer.",
        skills: [{ skill: "R17", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.polyrhythm", mode: "seed" }],
        tests: [],
        parts: [
          earPart("loop-one", "Loop 1.", 3, 2, "3:2"),
          earPart("loop-two", "Loop 2.", 2, 3, "2:3"),
          earPart("loop-three", "Loop 3.", 4, 3, "4:3"),
          earPart("loop-four", "Loop 4.", 4, 2, "straight"),
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your three against two",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-make",
        id: "your-three-against-two",
        version: 1,
        role: "practice",
        title: "Three against two",
        prompt:
          "Change the cowbell's string (`perc:`) so it plays three even notes a bar against the kick's two; every part of the starter plays the two. Keep the kick as it is. Done when the three and the two sound in the same bars for four bars or more. Your loop then plays both verses of your song.",
        skills: [{ skill: "R17", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          THREE_AGAINST_TWO,
          {
            id: "four-against-three",
            label: "The hi-hat plays four even notes a bar against the cowbell's three, for 2 bars or more",
            required: false,
            skills: ["R17"],
            rule: "polyrhythm",
            a: "hats",
            b: "perc",
            ratio: [4, 3],
            minBars: 2,
          },
          {
            id: "bass-with-the-two",
            label: "The bass plays on beats 1 and 3 of every bar, with the kick",
            required: false,
            skills: ["R17"],
            rule: "onsets",
            track: "bass",
            contains: [
              [0, 1],
              [1, 2],
            ],
            perBar: true,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with the cowbell's string: it plays two notes a bar now, like the kick.",
          "The cowbell's string divides the bar into equal steps; it needs a number of them that the kick's two does not share, in every bar.",
          "You wrote the same thing in step 4: the kick's line stays as it is, and only the cowbell's string changes.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the cowbell on three",
            response: { code: make(KICK, 'perc: s("cb*3").gain(.6)', BASS_TWO, chords("x x")) },
            expect: "pass",
          },
          { name: "the hook", response: { code: HOOK }, expect: "pass" },
          {
            name: "the kick written with rests: bd ~ bd ~, the cowbell cb cb cb",
            response: {
              code: make('kick: s("bd ~ bd ~")', 'perc: s("cb cb cb").gain(.6)', BASS_TWO, chords("x x x")),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: four against three on the hats, a snare, a tune on the three, faster",
            response: {
              code: make(
                KICK,
                'snare: s("~ sd").gain(.7)',
                'hats: s("hh*4").gain(.35)',
                'perc: s("cb*3").gain(.6)',
                bass("x x"),
                CHORDS_THREE,
                'mel: n("<[4 3 2] [3 2 0]>").scale("C4:minor").s("piano")',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(92/4)"),
            },
            expect: "pass",
          },
          {
            name: "the pulses taking turns: <cb*3 ~> against <~ bd*2>",
            response: {
              code: make('kick: s("<~ bd*2>")', 'perc: s("<cb*3 ~>").gain(.6)', BASS_TWO, chords("x x")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right three in alternate bars over a steady two: <cb*3 ~>",
            response: { code: make(KICK, 'perc: s("<cb*3 ~>").gain(.6)', BASS_TWO, chords("x x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "four against two: cb*4",
            response: { code: make(KICK, 'perc: s("cb*4").gain(.6)', BASS_TWO, chords("x x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the three, silent: .gain(0)",
            response: { code: make(KICK, 'perc: s("cb*3").gain(0)', BASS_TWO, chords("x x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the three 30 dB under the kick: masked",
            response: { code: make(KICK, 'perc: s("cb*3").gain(.03)', BASS_TWO, chords("x x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
