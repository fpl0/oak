// U06.L03 Home, Away, Tension. Chords have jobs: I is home (and vi can stand in for it); IV and ii lead
// away; V (and vii°) is tension that wants to go home. A phrase usually travels home, away, tension, home:
// T, PD, D, T. What the learner has: the seven triads of a key stacked with `.add(n(…))` and the word
// "diatonic" (U06.L01), Roman numerals (U06.L02), 7 leaning to 1 (U03.L04), a phrase that pauses and comes
// home (U03.L11). Not yet: the names of endings (cadence, U06.L04), the bass heard first (U06.L05), loops
// with a name (schema, U06.L06). Spec: content/specs/U06.md.
//
// How it uses the Wave 4 kinds (AUTHORING §17): S3 opens the function bands under the roll
// (`initialPanels: ["function"]`, needs `tb.lens.function`, unlocked here); a chord sent "away" is graded
// as a chord (`pcset` with the bass) against two reference solutions, IV or ii; the jobs of a four-bar loop
// are a `slot-choice` strip with the standard FUNCTION_OPTIONS (their labels name the three jobs, so they
// appear only after S3 introduces them); the Make's one required rule is `contains-rn` with
// `mustResolve`: a V that goes to I.
import { defineLesson, FUNCTION_OPTIONS, type HintLadder } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One triad on each root of `roots` (n values, one a bar), stacked "+2, +2" and moved with `.add()`. */
const triads = (roots: string, extra = "", sound = "piano") =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("${sound}")${extra}`;
/** A melody line in degrees. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
/** A bass line on the roots. */
const bass = (roots: string) => `bass: n("${roots}").scale("C2:major").s("ebass").lpf(600)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook: I IV V I, and a tune that climbs a step a bar to land on 1 as the last chord arrives. Every
 * note it plays is a note of the chord under it (G E | A F | B G | C).
 */
const HOME_AWAY = "<0 3 4 0>";
const HOOK_TUNE = "<[4 ~ 2 ~] [5 ~ 3 ~] [6 ~ 4 ~] [7 ~ ~ ~]>";
const HOOK = code(triads(HOME_AWAY), mel(HOOK_TUNE));
/** The seven triads of C, one a bar, and home again. */
const SEVEN = code(triads("<0 1 2 3 4 5 6 0>"));

/**
 * The modify step's tune: bar 2 plays F and A, notes of both IV (F A C) and ii (D F A), and rubs against
 * the starter's C chord. Bar 3 is V (B G D), bar 4 lands on 3.
 */
const AWAY_TUNE = "<[4 2 0 2] [3 ~ 5 ~] [6 4 1 ~] [2 ~ ~ ~]>";
const MODIFY_STARTER = code(triads("<0 ⟪0⟫ 4 0>"), mel(AWAY_TUNE));
const AWAY_IV = code(triads(HOME_AWAY), mel(AWAY_TUNE));
const AWAY_II = code(triads("<0 1 4 0>"), mel(AWAY_TUNE));
/** The strip's loop: I ii V I. */
const STRIP = code(triads("<0 1 4 0>"));
const MAKE_STARTER = code(triads("<0 3 0 3>"));

/** The Band's drums only: none of this lesson's loops is the Band's I V vi IV. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U06.L03",
  version: 4,
  title: "Home, Away, Tension",
  objective:
    "I can hear whether a chord sounds like home, away or tension, and write a phrase that goes away and comes home through tension.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H02"],
  practises: [],
  terms: [
    { id: "term.harmonic-function", step: "S3" },
    { id: "term.dominant", step: "S3" },
    { id: "term.predominant", step: "S3" },
  ],
  canDo: ["cd.hear.function"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "There and back",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "there-and-back",
        version: 1,
        role: "practice",
        prompt:
          "Four chords and a tune that climbs a step each bar. Listen for the bar where the loop leaves home and the bar where it arrives back.",
        skills: [{ skill: "H02", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "I, IV, V, I, and a tune that climbs a step a bar.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Where would you wait?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "hook-again", code: HOOK, bars: 4 },
      exercise: {
        kind: "predict",
        id: "where-would-you-wait",
        version: 1,
        role: "practice",
        prompt:
          "Picture the loop stopping after one of its bars and holding that chord. Predict after which bar you would most want to hear the next chord, and pick it.",
        skills: [{ skill: "H02", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "bar-1", label: "After bar 1, on I" },
          { id: "bar-2", label: "After bar 2, on IV" },
          { id: "bar-3", label: "After bar 3, on V" },
          { id: "bar-4", label: "After bar 4, on I again" },
        ],
        correct: ["bar-3"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Three jobs",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["function"] },
      example: { id: "the-seven", code: SEVEN, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "three-jobs",
        version: 1,
        role: "practice",
        prompt:
          "Run the seven triads of C, then home. The coloured band under the roll sorts them into three groups: home, away and tension. Listen to each chord against its group, then answer both questions below.",
        skills: [{ skill: "H02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play it again and stop on each bar: home chords could end the loop, tension chords pull towards the next bar.",
        },
        hints: ladder(
          "Besides I, one more chord could end the loop and still sound finished. Listen for it.",
          "A home chord shares notes with I. Count how many notes each minor chord shares with C E G.",
          "vi is A C E: two of its three notes are in I. Now count the chords that pull hardest towards home.",
        ),
        code: { starter: SEVEN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which chord shares the home group with I?",
            options: [
              { id: "vi", label: "vi" },
              { id: "IV", label: "IV" },
              { id: "V", label: "V" },
            ],
            correct: ["vi"],
          },
          {
            q: "number",
            prompt: "How many of the seven chords sit in the tension group?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["vi"], number: 2 } }, expect: "pass" },
          {
            name: "IV as home",
            response: { answer: { choice: ["IV"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "only V counted",
            response: { answer: { choice: ["vi"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Name the job",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "name-the-job",
        version: 1,
        role: "check",
        prompt: "Oak shows a numeral in a major key. Pick its chord's job: home, away or tension.",
        skills: [{ skill: "H02", w: 1 }],
        hints: ladder(
          "Decide first whether the chord could end a song or leads somewhere.",
          "Home: I and vi. Away: IV and ii. Tension: V and vii°.",
          "Tension chords sit on degrees 5 and 7. Is this chord's root one of them?",
        ),
        stimulus: { src: "generator", family: "fam.har.function", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "choice", options: [...FUNCTION_OPTIONS] },
        correct: {},
        srs: [{ family: "fam.har.function", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Send it away",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "send-it-away",
        version: 1,
        role: "check",
        prompt:
          "Bar 2 stays at home on I, and the tune rubs against it there. Change bar 2's number in `.add()` so it plays an away chord: IV or ii, either works. Change only bar 2.",
        skills: [{ skill: "H02", w: 1 }],
        code: { starter: MODIFY_STARTER },
        // IV or ii: both lead away, and both hold the tune's F and A.
        reference: { solutions: [AWAY_IV, AWAY_II], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        // Two answers are right, so there is no single target to play: the ear and the job decide.
        target: { audible: false, showRoll: false },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}. Bar 2 needs an away chord, IV or ii; `n` counts from 0, so subtract one from the degree.",
        },
        hints: ladder(
          "Bar 2 needs one of the two chords from the away group in Three jobs.",
          "IV and ii lead away. The number in `.add()` is the degree minus one.",
          "Bar 3 shows the idea: V is degree 5, and it adds 4. Do the same for IV or ii.",
        ),
        tests: [
          { name: "IV", response: { code: AWAY_IV }, expect: "pass" },
          { name: "ii", response: { code: AWAY_II }, expect: "pass" },
          {
            name: "IV an octave lower",
            response: { code: code(triads("<0 -4 4 0>"), mel(AWAY_TUNE)) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: MODIFY_STARTER.replace(/[⟪⟫]/g, "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "V: tension too early",
            response: { code: code(triads("<0 4 4 0>"), mel(AWAY_TUNE)) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "vi: still home",
            response: { code: code(triads("<0 5 4 0>"), mel(AWAY_TUNE)) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "bar 4 changed as well",
            response: { code: code(triads("<0 3 4 3>"), mel(AWAY_TUNE)) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Mark the jobs",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "mark-the-jobs",
        version: 1,
        role: "check",
        prompt:
          "A new loop, one chord a bar. Listen, read the code, and mark each bar's job: home, away or tension.",
        skills: [{ skill: "H02", w: 1 }],
        hints: ladder(
          "Start with the home bars: the first and the last.",
          "Read each number in `.add()` and add one to get the degree of the root.",
          "Bars 1 and 4 are I, home. Bar 3 adds 4: which chord is that, and what does it do?",
        ),
        stimulus: { src: "code", code: STRIP, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "slot-choice",
          slots: 4,
          options: [...FUNCTION_OPTIONS],
          labels: ["Bar 1", "Bar 2", "Bar 3", "Bar 4"],
        },
        correct: { choice: ["T", "PD", "D", "T"] },
        feedbackText: {
          "id.wrong":
            "Bar {slot}: not {got}. Find the degree of that bar's root, then its job: home on 1 and 6, away on 4 and 2, tension on 5 and 7.",
        },
        tests: [
          { name: "T PD D T", response: { answer: { choice: ["T", "PD", "D", "T"] } }, expect: "pass" },
          {
            name: "V marked away",
            response: { answer: { choice: ["T", "PD", "PD", "T"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "ii marked home",
            response: { answer: { choice: ["T", "T", "D", "T"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Away and home",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "away-and-home",
        version: 1,
        role: "practice",
        prompt:
          "Change the starter into the ending of your song: a phrase that starts at home, goes away, builds tension on V, then comes home on I. The home and away chords are your choice. Done when V is followed straight away by I, with an away chord (IV or ii) somewhere before it.",
        skills: [{ skill: "H02", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "tension-goes-home",
            label: "V followed straight away by I",
            required: true,
            skills: ["H02"],
            rule: "contains-rn",
            rn: ["V"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "away-first",
            label: "At least one away chord: IV or ii",
            required: false,
            skills: ["H02"],
            rule: "contains-rn",
            rn: ["ii", "IV"],
            min: 1,
          },
          {
            id: "tune-home",
            label: "A `mel` line whose last note is 1",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "mel",
          },
        ],
        hints: ladder(
          "The starter goes home, away, home, away: it never builds tension. That job belongs to V.",
          "Tension is V, degree 5: the number 4 in `.add()`. Put it just before a bar that adds 0.",
          "Bar 3 is the place: home, away, then tension, then home in bar 4. One number changes, maybe two.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: I IV V I", response: { code: code(triads(HOME_AWAY)) }, expect: "pass" },
          {
            name: "beyond the brief: eight bars on a Rhodes, a bass, a tune home",
            response: {
              code: code(
                triads("<0 5 1 4 0 3 4 0>", ".gain(.7)", "rhodes"),
                bass("<0 5 1 4 0 3 4 0>"),
                mel("<[4 ~ 2 ~] [5 ~ 7 ~] [5 ~ 3 ~] [4 ~ 6 ~] [7 ~ 4 ~] [5 ~ 3 ~] [1 ~ 6 ~] [7 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "ii as the away chord: I ii V I",
            response: { code: code(triads("<0 1 4 0>")) },
            expect: "pass",
          },
          {
            name: "V that swerves to vi",
            response: { code: code(triads("<0 3 4 5>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
