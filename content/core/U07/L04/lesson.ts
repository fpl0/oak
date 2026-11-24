// U07.L04 Passing & Neighbour Tones. Between the chord tones on beats 1 and 3, a tune may step through a
// note that is not in the chord (a passing tone, C D E over C) or step off a chord tone and straight back to
// it (a neighbour tone, A B A over F). Both sit on a weak beat and move by step, so the ear hears motion,
// not a wrong note. What the learner has: degrees in `n` (U03), triads stacked in `n` (U05), chords per bar
// and their numerals (U06), chord tones on the strong beats and the chord-tone lens (U07.L03). Not yet: a
// note outside the chord on the strong beat, leaning (U07.L05). Spec: content/specs/U07.md.
//
// The chords are a `chords:` line in the code (I IV, a bar each, the vamp's harmony), and the Band plays its
// drums and bass under them. The grader reads chords from the learner's code only (it is not given the
// Band's code, see U06.L05), so a rule that names `band.chords` would find no chords; the code's own line is
// what the lens shows and what the rules read, and it sounds the same in every flavour.
//
// Grading: S4 and the Make use the `non-chord-tones` rule (Wave 4 Build), which names each melody note by
// how it is approached and left (passing: step in, step on; neighbour: step in, step back). The spec's
// stand-ins (`step-ratio`) are replaced by it, as the spec asks once the rule lands.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A tune in degrees of C. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
/** Triads stacked in degrees, an octave under the tune. */
const chords = (pattern: string) => `chords: n("${pattern}").scale("C3:major").s("piano").gain(.6)`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** I and IV, a bar each (C E G, F A C): the vamp's two chords. */
const VAMP = "<[0,2,4] [3,5,7]>";
/**
 * The hook over I IV I IV. Beats 1 and 3 are chord tones (C E | A A | G E | F F); beat 2 is the note between:
 * D passing up, B stepping off A and back, F passing down, E stepping under F and back.
 */
const HOOK_TUNE = "<[0 1 2 ~] [5 6 5 ~] [4 3 2 ~] [3 2 3 ~]>";
/** The same tune with only its chord tones: the beat-2 notes left out. */
const SKELETON = "<[0 ~ 2 ~] [5 ~ 5 ~] [4 ~ 2 ~] [3 ~ 3 ~]>";
const HOOK = code(chords(VAMP), mel(HOOK_TUNE));
const PLAIN = code(chords(VAMP), mel(SKELETON));

/**
 * S4: a new tune over the same chords, chord tones on beats 1 and 3 and a gap on each beat 2:
 * E ? G | C ? A | G ? G | A ? F. Each gap takes a note a step from both sides: F (passing up), B (passing
 * down), A or F (stepping off G and back), G (passing down).
 */
const GAPS = (b1: string, b2: string, b3: string, b4: string) =>
  `<[2 ${b1} 4 ~] [7 ${b2} 5 ~] [4 ${b3} 4 ~] [5 ${b4} 3 ~]>`;
const STEP = (b1: string, b2: string, b3: string, b4: string) =>
  code(chords(VAMP), mel(GAPS(b1, b2, b3, b4)));
const STEP_STARTER = STEP("⟪~⟫", "⟪~⟫", "⟪~⟫", "⟪~⟫");
const STEP_REF = STEP("3", "6", "5", "4");

/**
 * The Make: a tune of chord tones only over I IV I IV (C E | A F | C G | C A), leaping a 3rd or more at almost
 * every move. Nothing between them yet.
 */
const MAKE_TUNE = (b1: string, b2: string, b3: string, b4: string) => `<${b1} ${b2} ${b3} ${b4}>`;
const MAKE_WITH = (b1: string, b2: string, b3: string, b4: string) =>
  code(chords(VAMP), mel(MAKE_TUNE(b1, b2, b3, b4)));
const MAKE_STARTER = MAKE_WITH("[0 ~ 2 ~]", "[5 ~ 3 ~]", "[0 ~ 4 ~]", "[7 ~ 5 ~]");
/**
 * Beyond the brief: eighth notes, a passing tone and a neighbour in most bars (D passing, B neighbour, F
 * passing down to E, G passing down to F then home), the chords struck again on beat 3, room. (A chord line
 * with rests between its hits leaves the beats between them without a chord for the rule to read.)
 */
const MAKE_BEYOND = `${TEMPO}${chords("<[[0,2,4] [0,2,4]] [[3,5,7] [3,5,7]]>")}\n${mel("<[0 [1 2] 4 ~] [5 [6 5] 3 ~] [4 [3 2] 0 ~] [5 [4 3] 7@2]>")}.room(.3)`;

/** The Band's drums and bass (C, then F, a bar each); the chords are the learner's code. */
const BAND = { band: "band.two-chord-vamp", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const STAFF = { roll: false, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U07.L04",
  version: 4,
  title: "Passing & Neighbour Tones",
  objective:
    "I can decorate a tune with notes outside the chord that move by step: passing tones between chord tones, neighbour tones around one.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M04"],
  practises: [],
  terms: [
    { id: "term.non-chord-tone", step: "S3" },
    { id: "term.passing-tone", step: "S3" },
    { id: "term.neighbour-tone", step: "S4" },
  ],
  canDo: ["cd.compose.passing-tones"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Fill the gaps",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "fill-the-gaps",
        version: 1,
        role: "practice",
        prompt:
          "Play both loops. Listen to beat 2 of loop 2, where each bar gains one note: do the added notes rub like wrong notes, or join the line up?",
        skills: [{ skill: "M04", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, caption: "Only the notes of each chord, on beats 1 and 3.", bars: 4 },
          { code: HOOK, caption: "The same tune with one more note in each bar. Listen to beat 2.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "On the way",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "on-the-way", code: code(chords("[0,2,4]"), mel("0 1 2 ~")), bars: 1 },
      exercise: {
        kind: "predict",
        id: "on-the-way",
        version: 1,
        role: "practice",
        prompt:
          "Over the C chord the tune goes from home, C, up to degree 3 (E), with one note between them. Read `n` and predict which note fills the gap, then pick it below.",
        skills: [{ skill: "M04", w: 1 }],
        hints: null,
        tests: [],
        code: code(chords("[0,2,4]"), mel("0 1 2 ~")),
        bars: 1,
        mode: "choose",
        choices: [
          { id: "d", label: "Degree 2 (D): a step above C and a step below E" },
          { id: "f", label: "Degree 4 (F): a step above E" },
          { id: "b", label: "Degree 7 (B): a step below C" },
        ],
        correct: ["d"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Outside the chord",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND, initialPanels: ["chord-tones"] },
      example: { id: "outside-the-chord", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "outside-the-chord",
        version: 1,
        role: "practice",
        prompt:
          "Run it with the chord-tone lens on: it marks every tune note that belongs to the chord under it. Look at the notes it leaves unmarked, then answer both questions.",
        skills: [{ skill: "M04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play bar 1 alone and read the labels: 1 and 3 are in the C chord; what about the note between them?",
        },
        hints: ladder(
          "Which beat do the unmarked notes fall on, bar after bar?",
          "The chords are C E G in bars 1 and 3, F A C in bars 2 and 4. Check each beat-2 note against the chord of its bar.",
          "Bar 1's D is not in C E G, and neither is bar 2's B in F A C. Two more bars to go.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Bar 1 plays C, D, E over the C chord. D is not in the chord. What does it do?",
            options: [
              { id: "steps-through", label: "It steps from one chord tone up to the next" },
              { id: "leaps", label: "It leaps away from the chord and stays there" },
              { id: "lands", label: "It lands on beat 1, where the chord changes" },
            ],
            correct: ["steps-through"],
          },
          {
            q: "number",
            prompt: "In the four bars, how many tune notes are not in the chord under them?",
            correct: 4,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["steps-through"], number: 4 } },
            expect: "pass",
          },
          {
            name: "D heard as a leap",
            response: { answer: { choice: ["leaps"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "only the notes that step through counted",
            response: { answer: { choice: ["steps-through"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Connect the notes",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "connect-the-notes",
        version: 1,
        role: "check",
        prompt:
          "Replace each of the four `~` on beat 2 with one note. Each new note must be one step, one number in `n`, from the note before it and from the note after it, and not in that bar's chord. Keep beats 1 and 3 as they are.",
        skills: [{ skill: "M04", w: 1 }],
        code: { starter: STEP_STARTER },
        reference: { solutions: [STEP_REF], bars: 4 },
        // Any step-wise note outside the chord passes: bar 3's gap may step above G (A) or below it (F).
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "strong-beats",
              label: "Every note on beats 1 and 3 is a note of the chord under it",
              required: true,
              skills: ["M03"],
              rule: "chord-tones-strong",
              minRatio: 1,
              melody: "mel",
              harmony: "chords",
              strength: "strong",
            },
            {
              id: "four-steps",
              label: "At least 4 notes outside the chord, each a step from the notes on both sides",
              required: true,
              skills: ["M04"],
              rule: "non-chord-tones",
              track: "mel",
              harmony: "chords",
              roles: ["passing", "neighbour"],
              min: 4,
            },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Compare each gap with the notes on both sides of it: one step up or down from each.",
        },
        hints: ladder(
          "Start with bar 1: E on beat 1, the gap on beat 2, G on beat 3. Which degree lies between E and G?",
          "A step is the next degree up or down: one number in `n`. Where the notes on both sides are the same, step off it and come back.",
          "Bar 1's gap is `n` 3, F, between E and G. Bar 3 has G on both sides: one number above or below 4.",
        ),
        tests: [
          { name: "reference", response: { code: STEP_REF }, expect: "pass" },
          {
            name: "bar 3 steps below G instead",
            response: { code: STEP("3", "6", "3", "4") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: STEP("~", "~", "~", "~") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "bar 1's gap filled with a leap",
            response: { code: STEP("0", "6", "5", "4") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a chord tone repeated in a gap",
            response: { code: STEP("3", "7", "5", "4") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the step put on beat 1 instead",
            response: { code: code(chords(VAMP), mel("<[3 2 4 ~] [7 6 5 ~] [4 5 4 ~] [5 4 3 ~]>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Through or around",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "through-or-around",
        version: 1,
        role: "check",
        prompt:
          "Listen to a one-bar tune over two chords. One note, marked on the staff, is not in its chord. Pick passing tone if the tune steps through it and keeps going the same way, or neighbour tone if it steps off a note and comes back to it.",
        skills: [{ skill: "M04", w: 1 }],
        hints: [
          { text: "Follow the tune into the marked note and out of it. Does it keep going the same way?" },
          {
            text: "A passing tone goes on in the direction it came: up, up. A neighbour tone turns round and goes back to the note before it.",
          },
          {
            text: "Hear it again, slower, and hum the note before the marked one and the note after it: are they the same?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.mel.nct", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "passing", label: "Passing tone: steps through" },
            { id: "neighbour", label: "Neighbour tone: steps off and back" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.mel.nct", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "see",
      title: "On the page",
      minutes: 0.5,
      ui: { panels: STAFF, staffLabels: "degree" },
      example: { id: "on-the-page", code: code(mel(HOOK_TUNE)), bars: 4 },
    },
    {
      id: "S7",
      kind: "make",
      title: "Decorate the tune",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "decorate-the-tune",
        version: 1,
        role: "practice",
        prompt:
          "Add at least two notes outside the chord on the empty beats of the tune that opens your song: a passing tone that steps between two notes a 3rd apart, or a neighbour tone that steps off a note and straight back to it. Keep the notes on beats 1 and 3 as they are.",
        skills: [{ skill: "M04", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "decorated",
            label:
              "At least 2 notes outside the chord that step through (passing) or step off and back (neighbour)",
            required: true,
            skills: ["M04"],
            rule: "non-chord-tones",
            track: "@melody",
            harmony: "chords",
            roles: ["passing", "neighbour"],
            min: 2,
          },
          {
            id: "strong-beats",
            label: "At least 3 in 4 notes on beats 1 and 3 are notes of the chord under them",
            required: false,
            skills: ["M03"],
            rule: "chord-tones-strong",
            minRatio: 0.75,
            melody: "@melody",
            harmony: "chords",
            strength: "strong",
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
          "Bar 1 jumps from C on beat 1 to E on beat 3, and beat 2 is empty. Which note could walk between them?",
          "Put a note on a beat that is empty now, one step from the note before and one step from the note after. Keep beats 1 and 3 as they are.",
          "Bar 1 can become `[0 1 2 ~]`. Find a second bar where a step fits between two notes, or around one.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: two passing tones",
            response: { code: MAKE_WITH("[0 1 2 ~]", "[5 4 3 ~]", "[0 ~ 4 ~]", "[7 ~ 5 ~]") },
            expect: "pass",
          },
          {
            name: "beyond the brief: eighths, chords on 1 and 3, room",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "only one note between",
            response: { code: MAKE_WITH("[0 1 2 ~]", "[5 ~ 3 ~]", "[0 ~ 4 ~]", "[7 ~ 5 ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
