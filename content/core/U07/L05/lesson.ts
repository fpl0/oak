// U07.L05 Leaning & Holding. A note outside the chord can land on the strong beat, rub, and then fall a step
// into the chord. Held over from the chord before, where it belonged, it is a suspension (C over IV held into
// V: the 4th above G, falling to B, its 3rd: a 4–3). Reached by a leap, it is an appoggiatura (D over the last
// I, leapt to from B, falling to C: a 9–8). The lean is the feeling; the step down is the release. What the
// learner has: chord tones on the strong beats (U07.L03), passing and neighbour tones on the weak ones
// (U07.L04), `.slow()` (U01.L09). Not yet: ties (U13), so a note held over the bar line is written as one long
// note in a slowed sequence, `n("[… 7@4 …]").slow(4)`. Spec: content/specs/U07.md.
//
// The chords are a `chords:` line in the code (I IV V I, a bar each); the Band plays drums only, so the V bar
// is a plain G triad under the suspension in every flavour. The Make's required rule is `non-chord-tones` with
// the roles appoggiatura and suspension (Wave 4 Build): it proves a lean is there, which the spec's stand-in
// (`chord-tones-strong`) could not; the spec asks for the switch once the rule lands.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 76;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** Triads stacked in degrees, an octave under the tune. */
const chords = (pattern: string) => `chords: n("${pattern}").scale("C3:major").s("piano").gain(.6)`;
/** A tune written as one slowed sequence over `bars` bars, so one note can last across a bar line. */
const line = (pattern: string, bars = 4) =>
  `mel: n("[${pattern}]").scale("C4:major").slow(${bars}).s("piano")`;
/** A tune written bar by bar. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** I IV V I, a bar each: C E G, F A C, G B D, C E G. */
const CADENCE = "<[0,2,4] [3,5,7] [4,6,8] [0,2,4]>";
/**
 * The hook, in quarter-note units over four bars: G (bar 1) | A, then C on beat 3 | the C held through beats
 * 1–2 of bar 3 over G, falling to B on beat 3 | D on beat 1 of bar 4, leapt to from B, falling to C.
 * Beats 1 and 3: G G (I), A C (IV: both chord tones, so the C is prepared), C B (V: C rubs, B is its 3rd),
 * D C (I: D rubs, C is home).
 */
const HOOK_TUNE = "4@4 5@2 7@4 6@2 8@2 7@2";
const HOOK = code(chords(CADENCE), line(HOOK_TUNE));

/** S2: bars 2–3 only (IV, V), the C held into the V bar, or B on its beat 1 at once. */
const PAIR = "<[3,5,7] [4,6,8]>";
const HELD = code(chords(PAIR), line("5@2 7@4 6@2", 2));
const STRAIGHT = code(chords(PAIR), line("5@2 7@2 6@4", 2));

/**
 * S4: E G | A C | (C) B | C. The starter's V bar plays B on beat 1; held over, the C rubs for two beats and
 * falls to B on beat 3, which then steps up to the last C.
 */
const STEP = (pattern: string) => code(chords(CADENCE), line(pattern));
const STEP_REF_TUNE = "2@2 4@2 5@2 7@4 6@2 7@4";
const STEP_STARTER = STEP("⟪2@2 4@2 5@2 7@2 6@4 7@4⟫");
const STEP_REF = STEP(STEP_REF_TUNE);

/**
 * The Make: a plain tune in half notes, every note a chord tone (G E | F A | G B | C), no lean anywhere. A note
 * leapt to on a strong beat that falls a step, or a note held into a chord it does not belong to and then
 * falling, meets the rule.
 */
const MAKE_WITH = (b4: string, b3 = "[4@2 6@2]") =>
  code(chords(CADENCE), mel(`<[4@2 2@2] [3@2 5@2] ${b3} ${b4}>`));
const MAKE_STARTER = MAKE_WITH("[7@4]");
/**
 * Beyond the brief: G E | F G A, then C held into bar 3 (a suspension over G, falling to B) | D leapt to on
 * beat 1 of bar 4, falling home (an appoggiatura); the chords pulse in half notes, room.
 */
const MAKE_BEYOND = `${TEMPO}${chords("<[[0,2,4] [0,2,4]] [[3,5,7] [3,5,7]] [[4,6,8] [4,6,8]] [0,2,4]>")}\n${line("4@2 2@2 3 4 5 7@3 6@2 8@2 7@2")}.room(.3)`;

/** The Band's drums only: the chords are in the code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U07.L05",
  version: 4,
  title: "Leaning & Holding",
  objective:
    "I can make a tune lean: a note outside the chord on the strong beat, held over or leapt to, that falls a step into the chord.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M05"],
  practises: [],
  terms: [
    { id: "term.suspension", step: "S3" },
    { id: "term.appoggiatura", step: "S5" },
  ],
  canDo: ["cd.compose.suspensions"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A slow lean",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-slow-lean",
        version: 1,
        role: "practice",
        prompt:
          "Listen to beat 1 of bars 3 and 4, where the chord changes. Does the tune's note there rest on the new chord or rub against it, and what happens when the tune moves on?",
        skills: [{ skill: "M05", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four bars over I, IV, V and I, a chord a bar.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Which one leans?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-leans",
        version: 1,
        role: "practice",
        prompt:
          "Play both cards: two bars, IV then V. Over V, one tune goes to B at once; the other holds the C into the new bar before it falls to B. Pick the card that makes the G chord wait.",
        skills: [{ skill: "M05", w: 1 }],
        hints: ladder(
          "In which card does the second chord sound settled the moment it arrives?",
          "B is a note of the G chord; C is not. Listen to beat 1 of the second bar in each card.",
          "Play card 2 and hum along with the tune: does the C still sound when the chord changes?",
        ),
        stimulus: { src: "code", code: HELD, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "straight", label: "B at once", audio: STRAIGHT },
            { id: "held", label: "C held, then B", audio: HELD },
          ],
        },
        correct: { choice: ["held"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "The lean is in the second card: the C stays while the chord changes to G, rubs, then falls to B. Play both again.",
        },
        tests: [
          { name: "held", response: { answer: { choice: ["held"] } }, expect: "pass" },
          {
            name: "straight",
            response: { answer: { choice: ["straight"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Held over",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chord-tones"] },
      example: { id: "held-over", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "held-over",
        version: 1,
        role: "practice",
        prompt:
          "Run it with the chord-tone lens on and watch bars 2 and 3. The chord changes from IV (F) to V (G) on beat 1 of bar 3. Then answer both questions: which note sounds there, and on which beat the tune steps down to B.",
        skills: [{ skill: "M05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Follow the long note on the roll from bar 2 into bar 3: where does it start, and where does the next note come?",
        },
        hints: ladder(
          "Does a new tune note start where bar 3 starts?",
          "The tune is one slowed sequence: `7@4` lasts four beats, starting on beat 3 of bar 2. Count where it ends.",
          "The C covers beats 3 and 4 of bar 2 and two more beats after the bar line. The next note, `n` 6, comes after it.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which tune note sounds on beat 1 of bar 3, against the G chord?",
            options: [
              { id: "held-c", label: "C, held over from bar 2: not in the G chord" },
              { id: "b", label: "B, the 3rd of the G chord" },
              { id: "g", label: "G, the root of the G chord" },
            ],
            correct: ["held-c"],
          },
          {
            q: "number",
            prompt: "On which beat of bar 3 does the tune step down to B?",
            correct: 3,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["held-c"], number: 3 } },
            expect: "pass",
          },
          {
            name: "B heard on beat 1",
            response: { answer: { choice: ["b"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted from bar 2",
            response: { answer: { choice: ["held-c"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Make it lean",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "make-it-lean",
        version: 1,
        role: "check",
        prompt:
          "Change only the `@` lengths, not the notes. Make the C that starts on beat 3 of bar 2 last into bar 3, so B arrives on beat 3 of bar 3, as in the target. The last C still starts bar 4.",
        skills: [{ skill: "M05", w: 1 }],
        code: { starter: STEP_STARTER },
        reference: { solutions: [STEP_REF], bars: 4 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets+durations",
          durations: true,
          tracks: ["mel"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: note {exp} missing. After the long C, the tune still falls to B on beat 3 of bar 3.",
          "melody.extra-note":
            "Bar {bar}, {beatLabel}: extra note {got}. Hold the C as one long note, `7@4`, instead of playing it again.",
        },
        hints: ladder(
          "Two `@` numbers change: the C in bar 2 and the B after it. Which one needs to last longer, and which one shorter?",
          "Each `@` number is a length in beats. The C, `7@2`, starts on beat 3 of bar 2; to reach beat 3 of bar 3 it needs two beats more.",
          "The C becomes `7@4`. The bar still has four beats, so the B after it gives two of its own back.",
        ),
        tests: [
          { name: "reference", response: { code: STEP_REF }, expect: "pass" },
          {
            name: "every length doubled",
            response: { code: STEP("2@4 4@4 5@4 7@8 6@4 7@8") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: STEP("2@2 4@2 5@2 7@2 6@4 7@4") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "held, never falls",
            response: { code: STEP("2@2 4@2 5@2 7@6 7@4") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "falls up to D instead",
            response: { code: STEP("2@2 4@2 5@2 7@4 8@2 7@4") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the C struck again on beat 1",
            response: { code: STEP("2@2 4@2 5@2 7@2 7@2 6@2 7@4") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "investigate",
      title: "Leapt to",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chord-tones"] },
      example: { id: "leapt-to", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "leapt-to",
        version: 1,
        role: "practice",
        prompt:
          "Run it and look at bar 4: over the last C chord the tune plays D on beat 1, then falls to C. D is not in the chord. Find the note just before the D, and pick how the tune reaches it.",
        skills: [{ skill: "M05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Look at the note just before the D, at the end of bar 3: is it a D too?",
        },
        hints: ladder(
          "What is the last note of bar 3?",
          "Bar 3 ends on B, `n` 6. Count the degrees from B up to D.",
          "From B to D the tune skips C. Is that a step, or more than one?",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "How does the tune reach the D?",
            options: [
              { id: "leap", label: "By a leap, up from B" },
              { id: "held", label: "Held over from bar 3" },
              { id: "step", label: "By a step, from C" },
            ],
            correct: ["leap"],
          },
        ],
        tests: [
          { name: "leap", response: { answer: { choice: ["leap"] } }, expect: "pass" },
          {
            name: "taken for a held note",
            response: { answer: { choice: ["held"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Name the note",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "name-the-note",
        version: 1,
        role: "check",
        prompt:
          "Listen to a one-bar tune over two chords. One note, marked on the staff, is not in its chord. Pick its kind from how the tune reaches it and leaves it: passing tone, neighbour tone, appoggiatura or suspension.",
        skills: [
          { skill: "M05", w: 0.7 },
          { skill: "M04", w: 0.3 },
        ],
        hints: [
          {
            text: "Does the marked note fall on a beat, or between beats? Is it there before its chord starts?",
          },
          {
            text: "Held over from the chord before, then down a step: suspension. Leapt to on the beat, then a step: appoggiatura. A step in and a step out: passing or neighbour.",
          },
          {
            text: "Hear it again, slower, and hum the note before the marked one. Is it the same note, a step away, or further?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.mel.nct", level: 2 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "passing", label: "Passing tone" },
            { id: "neighbour", label: "Neighbour tone" },
            { id: "appoggiatura", label: "Appoggiatura" },
            { id: "suspension", label: "Suspension" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.mel.nct", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Lean and land",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "lean-and-land",
        version: 1,
        role: "practice",
        prompt:
          "Make the tune that ends your song lean at least once. Either hold a note from one bar into the next chord, where it is not a chord tone, or leap to a note outside the chord on beat 1. Then move that note one step down into the chord.",
        skills: [{ skill: "M05", w: 1 }],
        // The rule's own detail ends "step into a note outside the chord and step on", which describes a
        // passing tone, not a lean; the same text serves the suggestions, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-lean",
            label:
              "At least 1 note outside the chord, held over from the chord before or leapt to on a beat, that then moves one step",
            required: true,
            skills: ["M05"],
            rule: "non-chord-tones",
            track: "@melody",
            harmony: "chords",
            roles: ["appoggiatura", "suspension"],
            min: 1,
          },
          {
            id: "strong-beats",
            label: "At least 6 in 10 notes on beats 1 and 3 are notes of the chord under them",
            required: false,
            skills: ["M03"],
            rule: "chord-tones-strong",
            minRatio: 0.6,
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
          "Which chord change would you like to stretch: IV to V, or V to I?",
          "A lean is a note outside the new chord on its beat 1 that then falls one step to a note inside it. Leap up to it, or keep the note from the bar before.",
          "Bar 4's chord is C. Its beat 1 can be D, `n` 8, a 3rd up from the B before it, falling to C on beat 3.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: D leapt to in bar 4, falling to C",
            response: { code: MAKE_WITH("[8@2 7@2]") },
            expect: "pass",
          },
          {
            name: "beyond the brief: a suspension and an appoggiatura, chords in half notes, room",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "a suspension only: the C held into the V bar, falling to B",
            response: { code: STEP_REF },
            expect: "pass",
          },
          {
            name: "the D never falls",
            response: { code: MAKE_WITH("[8@4]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
