// R1.L01 Metric Weight (the rhythm track's exemplar; spec: content/specs/R1.md). Every place in a 4/4 bar has a
// weight: the downbeat strongest, then beat 3, then beats 2 and 4, then the "ands", then the sixteenths between
// them ("e" and "a"). A note that sits on a light place while the heavier place after it stays empty pulls
// against the beat: that is syncopation, and how hard it pulls depends on the two places. The hardest push is
// the last sixteenth of a bar into an empty downbeat; a note on an off-beat followed by a note on the beat does
// not pull at all. The measure is the grader's own (Longuet-Higgins and Lee: `syncopation` in
// packages/grader/src/analyze/meter.ts, weights 0, −1, −2, −3, −4 for the five levels).
//
// Written for the learner at the gate (AUTHORING §20.1): the rhythm track opens after U13.CP and may be taken with
// U14–U17 unfinished, so this lesson uses only what U13.CP guarantees. Pushes (`.early()`, U13.L01), ghost notes
// and `.velocity()` (U13.L02) and the word syncopation are known; what is new is the hierarchy under them. Felt,
// then coded, then read: the learner taps the two heaviest places (S2) before reading the five levels (S3).
//
// The corrections-pass standard (AUTHORING §20.2) on both graded steps:
// - every required rule checks what is HEARD: the push sits on the sixteenth before beat 3 AND beat 3 stays
//   empty in every bar (`onsets` with `contains` and `excludes`, `perBar`); the Make's bass must really pull
//   against the beat (`syncopation`, which counts a note only when the heavier place after it is silent);
// - each graded step pins a WRONG answer that uses the right function: `.early(1/16)` on the whole line (the push
//   is there, but beat 1 moves with it); the push written with beat 3 still played; the push at `.gain(0)`;
//   in the Make, notes on the off-beats with every beat after them played (no pull at all);
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type RubricRule } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Seconds per bar at the lesson's tempo. */
const BAR_SEC = 240 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The five levels of a 4/4 bar on the hats: 1, then 3, then 2 and 4, then the "ands", then the "e"s and "a"s. */
const WEIGHTS = "1 .3 .5 .3 .7 .3 .5 .3 .9 .3 .5 .3 .7 .3 .5 .3";
const HATS = `hats: s("hh*16").velocity("${WEIGHTS}").gain(.6)`;
const HATS_FLAT = 'hats: s("hh*16").velocity(.6).gain(.6)';
const KICK_13 = 'kick: s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~")';
const KICK_1 = 'kick: s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
/** Rhodes on 2 and 4 over i7 VI^7 III^7 VII7 in E minor. */
const CHORDS = 'chords: chord("<Em7 C^7 G^7 D7>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)';
/** The bass on the chord's root, its rhythm written as sixteen steps with `.struct()`. */
const bass = (rhythm: string, tail = "") =>
  `bass: n("<0 5 2 6>").struct("${rhythm}").scale("E2:minor").s("fingerbass")${tail}`;
const ON_ONE_AND_THREE = "x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~";
/** The bass's second note a sixteenth before beat 3, and beat 3 left empty. */
const PUSH_INTO_THREE = "x ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~";

const GROOVE_FLAT = code(KICK_13, SNARE, HATS_FLAT, bass(ON_ONE_AND_THREE), CHORDS);
const GROOVE = code(KICK_13, SNARE, HATS, bass(ON_ONE_AND_THREE), CHORDS);
const GROOVE_PUSHED = code(KICK_1, SNARE, HATS, bass(PUSH_INTO_THREE), CHORDS);
const HATS_ALONE = code(KICK_13, HATS);

/** S5: the groove with the bass on 1 and 3; the learner moves the second note. */
const PUSH_STARTER = code(
  KICK_1,
  SNARE,
  HATS,
  `bass: n("<0 5 2 6>").struct("⟪${ON_ONE_AND_THREE}⟫").scale("E2:minor").s("fingerbass")`,
  CHORDS,
);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const pushAnswer = (line: string) => code(KICK_1, SNARE, HATS, line, CHORDS);
const PUSH_SOLUTION = pushAnswer(bass(PUSH_INTO_THREE));

/** Beat 1 sounds, the sixteenth before beat 3 sounds, and beat 3 itself is silent, in every bar. */
const PUSH_RULE: RubricRule = {
  id: "push-into-three",
  label: "In every bar the bass plays beat 1 and the sixteenth just before beat 3, and nothing on beat 3",
  required: true,
  skills: ["R10"],
  rule: "onsets",
  track: "bass",
  contains: [
    [0, 1],
    [7, 16],
  ],
  excludes: [[1, 2]],
  perBar: true,
};

/** S6: four pairs of two bars each over a quiet beat; only the bass changes. */
const PULSE = 'hats: s("hh*4").gain(.4)';
const pairCode = (first: string, second: string) =>
  code(PULSE, `bass: note("<${first} ${second}>").s("fingerbass")`);
const FIRST = "first";
const SECOND = "second";
const PAIR_OPTIONS = [
  { id: FIRST, label: "Bars 1 and 2" },
  { id: SECOND, label: "Bars 3 and 4" },
];
const earHints = (): HintLadder =>
  ladder(
    "Count 1 e & a 2 e & a with the quiet beat, and notice which heavy place each version of the bass leaves empty.",
    "A note pulls hardest when it sits on a light place and the next heavy place stays silent. A note on an off-beat that is followed by a note on the beat does not pull at all.",
    "Find the empty place after each bass note. An empty beat 1 or beat 3 pulls harder than an empty “and”.",
  );
const pair = (
  id: string,
  prompt: string,
  first: string,
  second: string,
  answer: string,
  why: string,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "R10", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: pairCode(first, second), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: { ui: "choice", options: PAIR_OPTIONS },
  correct: { choice: [answer] },
  feedbackText: { "id.wrong": why },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: "the other pair",
      response: { answer: { choice: [answer === FIRST ? SECOND : FIRST] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/** S7: the Band plays the chords; the drums (flat hats) and the bass (on 1 and 3) are the learner's. */
const DRUMS = [KICK_1, SNARE, HATS_FLAT];
const MAKE_STARTER = code(...DRUMS, bass(ON_ONE_AND_THREE));
const make = (...lines: string[]) => code(...DRUMS, ...lines);

/** Seconds from the start of a tap stimulus: the beats `beats` (0-based, across bars). */
const at = (beats: number[]) => beats.map((b) => Math.round((b * BAR_SEC * 1000) / 4) / 1000);
const ONE_AND_THREE_TAPS = at([0, 2, 4, 6, 8, 10, 12, 14]);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R1.L01",
  version: 3,
  title: "Metric Weight",
  objective:
    "I can hear which places in a bar are strong, and make a line pull against them by leaving a strong place empty.",
  key: { tonic: "E", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R10"],
  terms: [{ id: "term.metric-weight", step: "S3" }],
  canDo: ["cd.hear.metric-weight"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Flat, then shaped",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "shaped", code: GROOVE, bars: 4 },
      exercise: {
        kind: "listen",
        id: "flat-then-shaped",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the hi-hat in both loops; nothing else changes. Notice which loop sounds like a drummer and which like a machine, and where in the bar the louder hi-hat hits of the second loop fall.",
        skills: [{ skill: "R10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: GROOVE_FLAT,
            caption: "Sixteen hi-hat hits a bar, every one at the same strength.",
            bars: 4,
          },
          {
            code: GROOVE,
            caption: "The same sixteen hits. Which of them come forward?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the two heaviest",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-one-and-three",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the kick, the low thud under the hi-hat, and nothing else. It lands twice a bar, on the two heaviest places. The groove plays four bars: eight taps in all. Done when each tap lands with a kick.",
        skills: [{ skill: "R10", w: 1 }],
        hints: ladder(
          "Listen for the kick, the lowest drum: it plays twice in every bar, where the hi-hat also sounds strongest.",
          "The two strongest are half a bar apart, and the kick plays on both of them.",
          "Count 1, 2, 3, 4 and tap on the first word and the third.",
        ),
        mode: "along",
        stimulus: { src: "code", code: GROOVE, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "kick" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        tests: [
          { name: "on 1 and 3", response: { taps: ONE_AND_THREE_TAPS }, expect: "pass" },
          { name: "on 2 and 4", response: { taps: at([1, 3, 5, 7, 9, 11, 13, 15]) }, expect: "fail" },
          {
            name: "on every beat",
            response: {
              taps: at(Array.from({ length: 16 }, (_, i) => i)),
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
      title: "Five levels",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-levels", code: HATS_ALONE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "five-levels",
        version: 1,
        role: "practice",
        prompt:
          "Run the hi-hat with the kick and read one bar: the `.velocity()` string gives each of the sixteen hits its strength, in order. Then answer two questions: how many different strengths the bar holds, and which is stronger, beat 2 or the “and” after beat 1.",
        skills: [{ skill: "R10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the velocity string four numbers at a time, one beat each: the first number of each group is its beat, the third is its “and”.",
        },
        hints: ladder(
          "Read the velocity string from left to right and write down each number the first time it appears.",
          "Each beat is four sixteenths: 1 e & a. Compare the first number of beat 2 with the third number of beat 1.",
          "Write the different numbers down once each, from loudest to quietest, and count them.",
        ),
        code: { starter: HATS_ALONE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many different strengths do the hi-hat's hits have in one bar?",
            correct: 5,
          },
          {
            q: "choice",
            prompt: "Which is stronger?",
            options: [
              { id: "beat-2", label: "Beat 2" },
              { id: "and-of-1", label: "The “and” between beats 1 and 2" },
              { id: "same", label: "They are the same" },
            ],
            correct: ["beat-2"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 5, choice: ["beat-2"] } }, expect: "pass" },
          {
            name: "two: loud and quiet only",
            response: { answer: { number: 2, choice: ["beat-2"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the and read as stronger",
            response: { answer: { number: 5, choice: ["and-of-1"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "predict",
      title: "Leave beat 3 empty",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "leave-three-empty",
        version: 1,
        role: "practice",
        prompt:
          "The bass plays on beats 1 and 3. Its second note moves one sixteenth earlier, and beat 3 is left empty (the kick stays on beat 1 only). Predict what you will hear, and pick it.",
        skills: [{ skill: "R10", w: 1 }],
        hints: null,
        tests: [],
        code: GROOVE_PUSHED,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "leans", label: "The bass leans into the middle of the bar: the groove pulls forward" },
          { id: "nothing", label: "Nothing much: the notes are the same, one is only a little early" },
          { id: "slower", label: "The groove slows down" },
        ],
        correct: ["leans"],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Pull against beat 3",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "pull-against-three",
        version: 1,
        role: "check",
        prompt:
          "Change the bass's `.struct()` string. Keep the `x` on beat 1. Move the second `x` from beat 3 to the sixteenth just before beat 3, and leave beat 3 empty. Done when every bar plays beat 1 and the sixteenth before beat 3, and nothing on beat 3.",
        skills: [{ skill: "R10", w: 1 }],
        code: { starter: PUSH_STARTER },
        reference: { solutions: [PUSH_SOLUTION], bars: 4 },
        // Heard on beat 1 and on the "a" of 2 in every bar, and silent on beat 3: moving the whole line with
        // `.early(1/16)` (beat 1 goes too), keeping beat 3 as well, or a silent line all fail.
        matcher: { m: "rubric", rules: [PUSH_RULE] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the middle of the bar in the target: one bass note just before it, then nothing where beat 3 falls. Beat 1 stays where it was.",
        },
        hints: ladder(
          "Find beat 3 in the bass's `.struct()` string, then the step just before it.",
          "The rhythm string has sixteen steps, four per beat. Beat 3 is the ninth step; the lightest place before it is the step just ahead of it.",
          "Only one `x` moves, by one step, and the ninth step becomes a rest.",
        ),
        tests: [
          { name: "reference", response: { code: PUSH_SOLUTION }, expect: "pass" },
          {
            name: "written with weights: x@7 x@9",
            response: { code: pushAnswer(bass("x@7 x@9")) },
            expect: "pass",
          },
          {
            name: "two half bars",
            response: { code: pushAnswer(bass("[x ~ ~ ~ ~ ~ ~ x] [~ ~ ~ ~ ~ ~ ~ ~]")) },
            expect: "pass",
          },
          {
            name: "softer, and the pushed note shorter",
            response: { code: pushAnswer(bass(PUSH_INTO_THREE, ".velocity(.8).clip(.5)")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(PUSH_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function on the whole line: .early(1/16) moves beat 1 too",
            response: { code: pushAnswer(bass(ON_ONE_AND_THREE, ".early(1/16)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the push with beat 3 still played: nothing pulls",
            response: { code: pushAnswer(bass("x ~ ~ ~ ~ ~ ~ x x ~ ~ ~ ~ ~ ~ ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "an eighth early: the and of 2",
            response: { code: pushAnswer(bass("x ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: pushAnswer(bass(PUSH_INTO_THREE, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Which pulls harder?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "which-pulls-harder",
        version: 1,
        role: "check",
        prompt:
          "Four pairs. In each, the bass plays two bars one way, then two bars another, over a quiet beat. For each pair, pick the two bars that pull harder against the beat.",
        skills: [{ skill: "R10", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.syncopation", mode: "review-if-due" }],
        tests: [],
        parts: [
          pair(
            "pair-one",
            "Pair 1.",
            "[e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ e2] [~ ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~]",
            "[e2 ~ e2 ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~]!2",
            FIRST,
            "Bars 1 and 2: the last sixteenth of bar 1 leans into a downbeat that never comes. In bars 3 and 4 the extra note sits on the “and” before beat 2, and beat 2, the place it leaves empty, is far lighter than a downbeat.",
          ),
          pair(
            "pair-two",
            "Pair 2.",
            "[e2 ~ ~ ~ ~ ~ ~ e2 e2 ~ ~ ~ ~ ~ ~ ~]!2",
            "[e2 ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~ ~]!2",
            SECOND,
            "Bars 3 and 4: the note before beat 3 has nothing after it, so it pulls. In bars 1 and 2 beat 3 is played too, and the early note only leads into it.",
          ),
          pair(
            "pair-three",
            "Pair 3.",
            "[e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~]!2",
            "[e2 ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~ ~ ~]!2",
            SECOND,
            "Bars 3 and 4: the second note comes on the “and” of 2 and beat 3 stays empty. Bars 1 and 2 sit square on 1 and 3.",
          ),
          pair(
            "pair-four",
            "Pair 4.",
            "[e2 ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ ~ ~]!2",
            "[e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ e2 ~ ~ ~ ~ ~]!2",
            FIRST,
            "Bars 1 and 2: the note just before beat 3 leaves the second heaviest place empty. In bars 3 and 4 the extra note is on the “and” of 3 and leaves only beat 4 empty.",
          ),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your bass pulls",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.aeolian-4bar", tracks: ["chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-bass-pulls",
        version: 1,
        role: "practice",
        title: "Bass that pulls",
        prompt:
          "Make the bass pull against the beat; the band plays the chords. Required: at least four bass notes on light places, each with the heavier place after it silent. Also on the checklist: the bass still plays beat 1, and the hi-hat's “e”s and “a”s whisper. Try other notes of the chord too.",
        skills: [{ skill: "R10", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "bass-pulls",
            label:
              "At least 4 bass notes pull: each on a light place, with the heavier place after it silent",
            required: true,
            skills: ["R10"],
            rule: "syncopation",
            track: "bass",
            min: 4,
          },
          {
            id: "hats-shaped",
            label: "At least 8 hi-hat hits on the “e”s and “a”s are quiet, with louder hits around them",
            required: false,
            skills: ["R10"],
            rule: "velocity-ghosts",
            track: "hats",
            min: 8,
            on: "16th-offbeat",
            accents: 4,
          },
          {
            id: "bass-on-one",
            label: "The bass plays on beat 1 of every bar",
            required: false,
            skills: ["R10"],
            rule: "onsets",
            track: "bass",
            contains: [[0, 1]],
            perBar: true,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start from the bass's `.struct()` string: pick a heavy place to leave empty, and put a note on the light place just before it.",
          "A bass note pulls when it sits on a light place and the heavier place after it stays silent.",
          "The bass's rhythm is the sixteen-step string in `.struct()`. One `x` moved one step earlier, with a rest where it was, is a pull.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the push into beat 3",
            response: { code: make(bass(PUSH_INTO_THREE)) },
            expect: "pass",
          },
          {
            name: "a push into beat 3 and into the next downbeat",
            response: { code: make(bass("x ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x")) },
            expect: "pass",
          },
          {
            name: "the pull into the downbeat: the last sixteenth of every other bar",
            response: {
              code: make(
                'bass: note("<[e2 ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ ~ c2] [~ ~ ~ ~ ~ ~ ~ ~ c2 ~ ~ ~ ~ ~ ~ ~] [g1 ~ ~ ~ ~ ~ ~ ~ g1 ~ ~ ~ ~ ~ ~ d2] [~ ~ ~ ~ ~ ~ ~ ~ d2 ~ ~ ~ ~ ~ ~ ~]>").s("fingerbass")',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: three pulls a bar, ghosted notes, a faster tempo",
            response: {
              code: make(bass("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~", '.velocity("1 .5 .8 .9").clip(.6)')).replace(
                `setcpm(${BPM}/4)`,
                "setcpm(104/4)",
              ),
            },
            expect: "pass",
          },
          {
            name: "the right idea on every off-beat, but each beat after it played: no pull",
            response: { code: make(bass("x ~ ~ x x ~ ~ x x ~ ~ x x ~ ~ x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "straight eighths: an off-beat note between every two beats, none pulls",
            response: { code: make(bass("x ~ x ~ x ~ x ~ x ~ x ~ x ~ x ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the push written, the bass silent: .gain(0)",
            response: { code: make(bass(PUSH_INTO_THREE, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
