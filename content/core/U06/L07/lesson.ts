// U06.L07 Doo-Wop & Three-Chord Rock. Two more loops from the records: doo-wop, I vi IV V, the fifties
// ballad played as broken chords in threes; and three-chord rock, I IV V, the loop of a garage band. IV going
// home to I at the end of a phrase is the soft "amen" ending: a plagal cadence. What the learner has: the
// seven triads of a key and `.add(n(…))` (U06.L01), Roman numerals (U06.L02), the three jobs (U06.L03), V–I
// and the half cadence (U06.L04), the four-chord loop named as a schema, its rotations and the deceptive V–vi
// (U06.L06), broken chords with `.arp()` (U05.L04). Not yet: how often the chords change (harmonic rhythm,
// U06.L08), whole loops taken down in stages (U06.L09). Spec: content/specs/U06.md.
//
// Shapes: the doo-wop feel in 4/4 comes from `.arp("[0 1 2]*4")`, twelve notes a bar, three to a beat
// ("in threes"; swing as a term waits for U11). Three-chord rock is faster than the lesson's 76 and brings
// its own drums, so its steps play without the Band. The two ear steps reuse drill generators at the levels
// this lesson opens (`fam.har.schema` 2, `fam.har.cadence` 3). The ending is graded as chords (`pcset` with
// the bass), so IV an octave lower passes. The Make's one required rule is `progression` with the doo-wop
// schema in any rotation, read in C.
import { CADENCE_OPTIONS, type Choice, defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 76;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One triad on each root of `roots` (n values, one a bar), broken into notes by `arp` when given. */
const triads = (roots: string, arp = "", sound = "piano", extra = "") =>
  `chords: n("[0,2,4]").add(n("${roots}"))${arp ? `.arp("${arp}")` : ""}.scale("C3:major").s("${sound}")${extra}`;
/** A bass on the roots, one note a bar. */
const bass = (roots: string) => `bass: n("${roots}").scale("C2:major").s("ebass").lpf(600)`;
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Three notes to a beat, root 3rd 5th, four times a bar: C E G C E G … */
const THREES = "[0 1 2]*4";
/** Doo-wop: I vi IV V (C Am F G), one chord a bar. */
const DOO_WOP = "<0 5 3 4>";
/** The four-chord loop of U06.L06: I V vi IV. */
const AXIS = "<0 4 5 3>";
/** A slow backbeat, the hats in threes. */
const SLOW_DRUMS = ['drums: s("bd ~ sd ~")', 'hats: s("[hh hh hh]*4").gain(.5)'];
const HOOK = code(...SLOW_DRUMS, bass(DOO_WOP), triads(DOO_WOP, THREES));
/** The two cards of S2: the same broken chords on the piano, alone. */
const CARD_DOO_WOP = code(triads(DOO_WOP, THREES));
const CARD_AXIS = code(triads(AXIS, THREES));

/** Three-chord rock: faster, its own drums, the chords and the bass in straight eighths. */
const ROCK_TEMPO = "setcpm(126/4)\n\n";
const rockCode = (...lines: string[]) => `${ROCK_TEMPO}${lines.join("\n")}`;
const ROCK_DRUMS = ['drums: s("bd ~ sd ~ bd bd sd ~")', 'hats: s("hh*8").gain(.5)'];
const rockChords = (roots: string) =>
  `chords: n("[0,2,4]*8").add(n("${roots}")).scale("C3:major").s("piano").gain(.7)`;
const rockBass = (roots: string) => `bass: n("0*8").add(n("${roots}")).scale("C2:major").s("ebass").lpf(600)`;
/** I IV V IV (C F G F). */
const ROCK = "<0 3 4 3>";
const ROCK_LOOP = rockCode(...ROCK_DRUMS, rockBass(ROCK), rockChords(ROCK));

/** S5: the rock phrase stalls on V; bars 3 and 4 are the learner's. The target is I V IV I. */
const AMEN = "<0 4 3 0>";
const AMEN_STARTER = rockCode(...ROCK_DRUMS, rockChords("<0 4 ⟪4 4⟫>"));
const amen = (roots: string) => rockCode(...ROCK_DRUMS, rockChords(roots));

/**
 * The Make: the four-chord loop of U06.L06 in chord names. Broken chords are written `.voicing().arp(…)`:
 * the grader reads a chord from its symbol, while an arpeggiated `n` stack sounds one note at a time and
 * is not read as a chord today (reported).
 */
const symbols = (changes: string, extra = "", sound = "piano") =>
  `chords: chord("${changes}").voicing()${extra}.s("${sound}")`;
const MAKE_STARTER = code(symbols("<C G Am F>"));

/** The schema options of `fam.har.schema` levels 1 and 2 (the generator's category ids). */
const LOOPS: Choice[] = [
  { id: "axis", label: "I V vi IV: the four-chord loop" },
  { id: "axis-vi", label: "vi IV I V: the four-chord loop from vi" },
  { id: "doo-wop", label: "I vi IV V: doo-wop" },
  { id: "three-chord", label: "I IV V: three-chord rock" },
];

/** The Band's drums only: none of this lesson's loops is the Band's I V vi IV. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U06.L07",
  version: 4,
  title: "Doo-Wop & Three-Chord Rock",
  objective:
    "I can hear and play doo-wop (I vi IV V) and three-chord rock (I IV V), and end a phrase with IV going home to I.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H05"],
  practises: ["H03"],
  terms: [{ id: "term.plagal-cadence", step: "S5" }],
  canDo: ["cd.hear.schemas"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two more loops",
      minutes: 0.5,
      // The hook and the rock loop bring their own drums.
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-more-loops",
        version: 1,
        role: "practice",
        prompt:
          "A fifties ballad, then a garage band. In each loop, listen for whether a minor chord ever darkens it, and in which bar.",
        skills: [{ skill: "H05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Doo-wop: a slow ballad, each chord broken into notes, three to a beat.",
            bars: 4,
          },
          { code: ROCK_LOOP, caption: "Three-chord rock: chords and bass in eighths.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Which loop is it?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-loop-is-it",
        version: 1,
        role: "practice",
        prompt:
          "First the doo-wop hook plays, then two cards with the same broken chords on the piano: one is doo-wop, the other the four-chord loop. Pick the doo-wop card.",
        skills: [{ skill: "H05", w: 1 }],
        hints: ladder(
          "Both cards start on I. Listen to where each one goes next, in bar 2.",
          "Listen to bar 2: does it move to the bright V, or to the darker vi?",
          "Doo-wop goes from I to the minor chord first. Which card's bar 2 sounds minor?",
        ),
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "four-chord", label: "Card A", audio: CARD_AXIS },
            { id: "doo-wop", label: "Card B", audio: CARD_DOO_WOP },
          ],
        },
        correct: { choice: ["doo-wop"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "Card B is doo-wop: I, then the minor vi, then IV and V. Card A goes I to V first: the four-chord loop.",
        },
        tests: [
          { name: "card B", response: { answer: { choice: ["doo-wop"] } }, expect: "pass" },
          {
            name: "card A",
            response: { answer: { choice: ["four-chord"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Count the chords",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "rock-loop", code: ROCK_LOOP, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "count-the-chords",
        version: 1,
        role: "practice",
        prompt:
          "Run the rock loop and read the numerals under the roll as it plays. Then answer both questions below.",
        skills: [{ skill: "H05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the numbers in `.add()`: each one is a chord's root, and some come back.",
        },
        hints: ladder(
          "Four bars, but not four different chords: watch for a numeral that comes back.",
          "The numbers in `.add()` are the roots, and `n` counts from 0: add one to get the degree.",
          "Bars 2 and 4 hold the same number. Which degree is it, and which is bar 3?",
        ),
        code: { starter: ROCK_LOOP },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many different chords does the loop use?",
            correct: 3,
          },
          {
            q: "choice",
            prompt: "Which ones?",
            options: [
              { id: "one-four-five", label: "I, IV and V" },
              { id: "one-five-six", label: "I, V and vi" },
              { id: "one-two-five", label: "I, ii and V" },
            ],
            correct: ["one-four-five"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 3, choice: ["one-four-five"] } },
            expect: "pass",
          },
          {
            name: "one chord a bar counted",
            response: { answer: { number: 4, choice: ["one-four-five"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the n values read as degrees",
            response: { answer: { number: 3, choice: ["one-two-five"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Name the loop",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "name-the-loop",
        version: 1,
        role: "check",
        prompt: "A loop plays, in a new key each time. Pick which of the four loops it is.",
        skills: [
          { skill: "H05", w: 0.6 },
          { skill: "H04", w: 0.4 },
        ],
        hints: ladder(
          "Start with the first chord: home, or the darker minor one. Then listen to the second.",
          "Listen to the second chord: V sounds bright and tense, vi dark, IV open. Three-chord rock never has a minor chord.",
          "Doo-wop goes from I straight to the minor vi. The four-chord loop goes I to V first.",
        ),
        stimulus: { src: "generator", family: "fam.har.schema", level: 2 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "choice", options: LOOPS },
        correct: {},
        srs: [{ family: "fam.har.schema", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "The amen ending",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "the-amen-ending",
        version: 1,
        role: "check",
        prompt:
          "The rock phrase gets stuck on V. Change the last two numbers in `.add()` so bar 3 drops to IV and bar 4 settles home on I, as in the target.",
        skills: [
          { skill: "H03", w: 0.6 },
          { skill: "H05", w: 0.4 },
        ],
        code: { starter: AMEN_STARTER },
        reference: { solutions: [amen(AMEN)], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. `n` counts from 0, so a numeral's number is its degree minus one.",
        },
        hints: ladder(
          "Bar 3 needs IV and bar 4 needs I. Turn each numeral into its number in `.add()`.",
          "IV is the triad on degree 4 and I the one on degree 1. In `.add()`, each number is the degree minus one.",
          "Bar 4 is home, the same number as bar 1. Now bar 3.",
        ),
        tests: [
          { name: "reference", response: { code: amen(AMEN) }, expect: "pass" },
          { name: "IV an octave lower", response: { code: amen("<0 4 -4 0>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: amen("<0 4 4 4>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "V then I: the closing ending of Endings",
            response: { code: amen("<0 4 4 0>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the numerals written as numbers: 4 then 1",
            response: { code: amen("<0 4 4 1>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Which ending?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-ending",
        version: 1,
        role: "check",
        prompt:
          "A short phrase plays, in a new key each time. Pick how it ends, judging by its last two chords.",
        skills: [{ skill: "H03", w: 1 }],
        hints: ladder(
          "Start with the last chord: home, the bright V, or a darker chord.",
          "If it ends home, listen to the chord before: the tension of V, or the softer IV?",
          "IV to I is the amen. V to vi is the swerve. V to I closes; with the tune on 1 it closes completely.",
        ),
        stimulus: { src: "generator", family: "fam.har.cadence", level: 3 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "choice", options: [...CADENCE_OPTIONS] },
        correct: {},
        srs: [{ family: "fam.har.cadence", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your doo-wop loop",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-doo-wop-loop",
        version: 1,
        role: "practice",
        prompt:
          "Reorder the starter's four chord names into doo-wop, I vi IV V, starting on any of the four, for the four bars before your song's last loud part. Then add `.arp()` after `.voicing()` to break the chords into a rhythm of your own. Done when the chords go I vi IV V in order, from any start.",
        skills: [{ skill: "H05", w: 1 }],
        // A default voicing often puts the 3rd lowest, and the rule's detail then prints inversion figures
        // ("I6"), which wait for U06.L11. The same text serves the suggestions, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "doo-wop",
            label: "`chords` plays I vi IV V in order, started on any of its four chords",
            required: true,
            skills: ["H05"],
            rule: "progression",
            schema: "schema.doo-wop",
            allowRotation: true,
            track: "chords",
          },
          {
            id: "broken",
            label: "`.arp()` used to break the chords",
            required: false,
            skills: ["H05"],
            rule: "uses",
            tool: "tb.arp",
          },
          {
            id: "home-ending",
            label: "The last two chords go home: IV to I, or V to I",
            required: false,
            skills: ["H03"],
            rule: "cadence",
            types: ["PC", "PAC", "IAC"],
            at: "last",
          },
        ],
        hints: ladder(
          "Doo-wop and the four-chord loop share their first chord, I. In doo-wop the minor chord comes second.",
          "Doo-wop is I vi IV V. In C, vi is the minor chord on degree 6, IV the chord on F, V the one on G.",
          "I then vi is C then Am. Two chords to go.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the chord names reordered",
            response: { code: code(symbols("<C Am F G>")) },
            expect: "pass",
          },
          {
            name: "stacks with .add() instead of names",
            response: { code: code(triads(DOO_WOP)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: rotated to end V I, broken chords on the organ, a bass and a tune",
            response: {
              code: code(
                bass("<5 3 4 0>"),
                symbols("<Am F G C>", '.arp("[0 1 2 1 2 1]*2")', "organ"),
                mel("<[2 ~ 0 ~] [3 ~ 5 ~] [4 ~ 1 ~] [0 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "three-chord rock instead",
            response: { code: code(symbols("<C F G F>", `.arp("${THREES}")`)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
