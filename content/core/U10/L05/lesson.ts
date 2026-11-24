// U10.L05 The Aeolian Loop. i–VI–III–VII (Am F C G) is minor's four-chord song. Its four chords are the
// same as vi–IV–I–V in C major (U06.L07's axis loop started on vi): whether it sounds minor or major depends
// on where the loop starts and where the tune comes to rest. Start on Am and land the tune on A, and A is
// home. What the learner has: the chords of a minor key and their numerals (U10.L04), natural minor in code
// (U10.L01), the relative key (U10.L02), the axis loop and its rotations (U06.L06–L07), chord names and
// `.voicing()` (U05.L08), the driving bass (U08). Not yet: the major V and the pull home it gives (U10.L06).
// Spec: content/specs/U10.md.
//
// How it is graded: the modify step writes the loop in degrees over `.scale("A2:minor")` and is graded as
// chords (`pcset` per onset), so VI and VII from below pass; the compare step is four A/B pairs of the same
// four chords, graded as one check; the Make's one required rule is `progression` with
// `schema: "schema.aeolian"` read in A minor, rotation not allowed, because starting on home is the point.
import { defineLesson, type HintLadder, type IdentifyEx } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Chord names on a Rhodes in a room (U05.L08's `.voicing()`). */
const names = (symbols: string) => `chords: chord("${symbols}").voicing().s("rhodes").room(.4)`;
/** A fingerbass driving eighths on each root, with an octave pop at the end of the bar. */
const bass = (roots: string) =>
  `bass: n("[0 0 0 0 0 0 0 7]").add(n("${roots}")).scale("A1:minor").s("fingerbass").lpf(900)`;
const mel = (tune: string) => `mel: n("${tune}").scale("A3:minor").s("piano")`;
/** Triads stacked in degrees (U06.L01), for the modify step. */
const stacks = (roots: string) =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("A2:minor").s("rhodes").room(.4)`;

/** i VI III VII: Am F C G, and its roots as `n` over A minor. */
const AEOLIAN = "<Am F C G>";
const AEOLIAN_ROOTS = "<0 5 2 6>";
/** The same four chords started on C: C G Am F (I V vi IV in C). */
const FROM_C = "<C G Am F>";
const FROM_C_ROOTS = "<2 6 0 5>";

/** Tunes that come to rest on A, home in A minor. */
const HOME_A = "<[7 ~ 6 4] [5 ~ 7 ~] [2 ~ 4 6] [8 ~ 6 ~]>";
const HOME_A2 = "<[4 ~ 2 0] [0 ~ 2 ~] [4 ~ 2 4] [3 ~ 1 ~]>";
const HOME_A3 = "<[0 ~ ~ 2] [0 ~ ~ ~] [4 ~ 2 4] [1 ~ ~ ~]>";
const HOME_A4 = "<[11 ~ 9 7] [9 ~ 7 ~] [4 ~ 6 4] [3 ~ 1 ~]>";
/** Tunes over the same chords that keep coming to rest on C. */
const HOME_C = "<[2 ~ 4 2] [2 ~ 0 2] [6 ~ 4 2] [1 ~ 3 ~]>";
const HOME_C2 = "<[4 ~ 2 ~] [7 ~ 9 ~] [9 ~ ~ ~] [8 ~ 10 ~]>";
/** Over C G Am F, resting on C. */
const FROM_C_TUNE = "<[2 ~ 4 6] [3 ~ 1 ~] [2 ~ 0 ~] [0 ~ 2 ~]>";
const FROM_C_TUNE2 = "<[9 ~ 6 4] [6 ~ 8 ~] [7 ~ 4 ~] [7 ~ 9 ~]>";

const loop = (tune: string) => code(names(AEOLIAN), bass(AEOLIAN_ROOTS), mel(tune));
const loopFromC = (tune: string) => code(names(FROM_C), bass(FROM_C_ROOTS), mel(tune));
const HOOK = loop(HOME_A);
const ON_C = loop(HOME_C);

/** i iv v i in degrees; the four numbers are the learner's. */
const MODIFY_STARTER = code(stacks("<⟪0 3 4 0⟫>"));
const MODIFY_SOLUTION = code(stacks(AEOLIAN_ROOTS));

/** Sung: the loop's roots, do le me te, over the chords. Le and te sit below home. */
const SING = code(`${names(AEOLIAN)}.gain(.5)`, 'mel: n("<0 -2 2 -1>").scale("A3:minor").s("piano")');

/** The Make starts with a groove that only rocks between i and iv. */
const MAKE_STARTER = code(names("<Am Dm Am Dm>"), bass("<0 3 0 3>"), mel("<[4 ~ 2 0] [5 ~ 3 ~]>"));

/** Drums from the Band; the chords, the bass and the tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "A", mode: "minor" } as const;

const CARDS = [
  { id: "a", label: "Card A" },
  { id: "b", label: "Card B" },
] as const;
const WHERE_WRONG = {
  "id.wrong":
    "Listen to each card again for the note the tune comes to rest on, and the chord the loop starts from: A, or C?",
};
/** One pair of the compare step: two cards of the same four chords; `home` is the card that is home on A. */
const pair = (n: number, a: string, b: string, home: "a" | "b"): IdentifyEx => ({
  kind: "identify",
  id: `pair-${n}`,
  version: 1,
  role: "check",
  prompt: `Pair ${n}. Pick the card that is home on A.`,
  skills: [{ skill: "H08", w: 1 }],
  hints: ladder(
    "Hum the note each tune comes to rest on, and decide whether it is A or C.",
    "Listen for the chord each card starts on, and where the tune lands at the end of bar 1 and of bar 3.",
    "A tune that keeps landing on C over the C chord makes C home. Which card does that?",
  ),
  stimulus: { src: "code", code: a, bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: {
    ui: "choice",
    layout: "audio-cards",
    options: [
      { ...CARDS[0], audio: a },
      { ...CARDS[1], audio: b },
    ],
  },
  correct: { choice: [home] },
  feedbackText: WHERE_WRONG,
  tests: [
    { name: "home on A", response: { answer: { choice: [home] } }, expect: "pass" },
    {
      name: "home on C",
      response: { answer: { choice: [home === "a" ? "b" : "a"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

export default defineLesson({
  id: "U10.L05",
  version: 4,
  title: "The Aeolian Loop",
  objective: "I can write the Aeolian loop i–VI–III–VII and tell it from vi–IV–I–V by where it comes home.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["H08"],
  practises: [],
  terms: [{ id: "term.aeolian", step: "S3" }],
  canDo: ["cd.compose.aeolian"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.fingerbass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same chords, two homes",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "same-chords-two-homes",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two clips: the same four chords, each with a different tune. Listen for the note each tune keeps coming back to, and for how settled the loop feels under it.",
        skills: [{ skill: "H08", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Tune 1. Hum the note it keeps returning to.", bars: 4 },
          { code: ON_C, caption: "Tune 2, over the same chords. Does it rest on the same note?", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which one is minor?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "which-one-is-minor",
        version: 1,
        role: "practice",
        prompt:
          "Predict which loop sounds like it is in a minor key. Both play Am F C G; one tune keeps landing on A, the other on C. Pick an answer, then hear it.",
        skills: [{ skill: "H08", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "lands-on-a", label: "The tune that lands on A" },
          { id: "lands-on-c", label: "The tune that lands on C" },
          { id: "same", label: "Both the same: the chords decide" },
        ],
        correct: ["lands-on-a"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Number the loop",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "in-a-minor", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "number-the-aeolian-loop",
        version: 1,
        role: "practice",
        prompt:
          "Run the first loop and follow the numerals in the chord band, which reads it in A minor, home on A. Then answer both questions.",
        skills: [{ skill: "H08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the chord band again: it counts from A, so C, a major chord on ♭3, is III.",
        },
        hints: ladder(
          "Find home, Am, in the loop first. Then count each other root up from A.",
          "Count each root from A: F is ♭6 and G is ♭7. Major chords take upper case.",
          "Bar 1 is i and bar 2 is VI. The chord on ♭3 comes next.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which numerals does the loop play, in order?",
            options: [
              { id: "aeolian", label: "i VI III VII" },
              { id: "axis-vi", label: "vi IV I V" },
              { id: "minor-v", label: "i iv III v" },
            ],
            correct: ["aeolian"],
          },
          { q: "number", prompt: "In which bar is the major chord on ♭3?", correct: 3 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["aeolian"], number: 3 } }, expect: "pass" },
          {
            name: "counted from C",
            response: { answer: { choice: ["axis-vi"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the n value for the bar",
            response: { answer: { choice: ["aeolian"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Write the loop",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "write-the-aeolian-loop",
        version: 1,
        role: "check",
        prompt:
          "These stacks play i iv v i in A minor. Change the four numbers in `.add()` so they play i VI III VII, one chord per bar. Each number is the chord's degree minus one, counted from A.",
        skills: [{ skill: "H08", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Count each root from A, then subtract one: `n` counts from 0.",
        },
        hints: ladder(
          "Find the degree of A minor that each of i, VI, III and VII is built on.",
          "The numbers in `.add()` are those degrees minus one, counted from A: `n` counts from 0.",
          "i is 0 and VI, on ♭6, is 5. Two numbers to go.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "VI and VII from below",
            response: { code: code(stacks("<0 -2 2 -1>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(stacks("<0 3 4 0>")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "C major's numbers for vi IV I V over A minor",
            response: { code: code(stacks("<5 3 0 4>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right chords in the axis order",
            response: { code: code(stacks("<0 2 6 5>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the scale moved to C major instead",
            response: {
              code: code('chords: n("[0,2,4]").add(n("<5 3 0 4>")).scale("C3:major").s("rhodes").room(.4)'),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      // An `ear` step, not `compare`: four A/B pairs are one graded `all`, and a compare step takes one identify.
      kind: "ear",
      title: "Where is home?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "where-is-home",
        version: 1,
        role: "check",
        prompt:
          "In each of the four pairs, pick the card that is home on A. Both cards of a pair use Am, F, C and G; on the other card, home is C.",
        skills: [{ skill: "H08", w: 1 }],
        hints: ladder(
          "Hum the note each tune comes to rest on, and decide whether it is A or C.",
          "Listen for the chord each card starts on, and where the tune lands at the end of each phrase.",
          "A loop that starts on Am with a tune that lands on A is home on A. Check the start of each card first.",
        ),
        srs: [{ family: "fam.har.progression", mode: "review-if-due" }],
        tests: [],
        parts: [
          pair(1, HOOK, ON_C, "a"),
          pair(2, loopFromC(FROM_C_TUNE), loop(HOME_A2), "b"),
          pair(3, loop(HOME_A3), loop(HOME_C2), "a"),
          pair(4, loopFromC(FROM_C_TUNE2), loop(HOME_A4), "b"),
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the roots",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-aeolian-roots",
        version: 1,
        role: "practice",
        prompt:
          "Listen, then sing the loop's four roots, one per bar: do, down to le, up to me, down to te. Sing in your own range.",
        skills: [
          { skill: "V02", w: 0.6 },
          { skill: "H08", w: 0.4 },
        ],
        hints: [
          { text: "Hum do, A, before you start: it is where the loop begins." },
          { text: "Le is a major 3rd below do. Me is a minor 3rd above do; te is a step below do." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["1", "b6", "b3", "b7"], octaves: [0, -1, 0, -1] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your Aeolian loop",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-aeolian-loop",
        version: 1,
        role: "practice",
        prompt:
          "Change the chords to the Aeolian loop, i VI III VII, one chord per bar, starting on i. Give the bass the same roots. Done when the `chords:` line plays i VI III VII in that order. Then arrange it for your song's first two choruses: a sound for the chords, a tune that comes home on A.",
        skills: [{ skill: "H08", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-aeolian-loop",
            label: "The `chords:` line plays i VI III VII in that order, starting on i",
            required: true,
            skills: ["H08"],
            rule: "progression",
            schema: "schema.aeolian",
            allowRotation: false,
            track: "chords",
          },
          {
            id: "comes-home",
            label: "The tune's last note is 1 (A)",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "@melody",
          },
          {
            id: "a-bass-on-the-roots",
            label: "A `bass:` line plays the chord's root on at least 3 of every 4 chord changes",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
          {
            id: "three-parts",
            label: "Three or more parts, such as chords, bass and tune",
            required: false,
            skills: ["H08"],
            rule: "tracks",
            min: 3,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start from home: i is Am. Count up from A to find the roots of VI, III and VII.",
          "Count from A: VI sits on ♭6, III on ♭3, VII on ♭7. Write them as chord names, and give the bass the same roots.",
          'The chords start `chord("<Am F …>")`, and the bass numbers start `<0 5 …>`. Two to go in each.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the chords and the bass moved",
            response: {
              code: code(names(AEOLIAN), bass(AEOLIAN_ROOTS), mel("<[4 ~ 2 0] [5 ~ 3 ~]>")),
            },
            expect: "pass",
          },
          { name: "the hook", response: { code: HOOK }, expect: "pass" },
          {
            name: "beyond the brief: stacks, eight bars, a tune home on A",
            response: {
              code: code(
                stacks("<0 5 2 6>"),
                'bass: n("[0 ~ 0 0 ~ 0 7 ~]").add(n("<0 5 2 6>")).scale("A1:minor").s("fingerbass").lpf(900)',
                mel("<[7 ~ 6 4] [5 ~ 7 ~] [2 ~ 4 6] [8 ~ 6 ~] [4 ~ 2 0] [0 ~ 2 ~] [4 ~ 2 4] [1 ~ 0 ~]>"),
                'vox: n("<~ [~ ~ 9 8] ~ [~ ~ 8 7]>").scale("A3:minor").s("piano").gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the loop started on VI: F C G Am",
            response: { code: code(names("<F C G Am>"), bass("<5 2 6 0>"), mel(HOME_A2)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
