// U03.L07 Flat Keys & the Circle. Flat keys collect flats in the order B E A D G C F, the mirror of the
// sharps; arranged so that each key's home is degree 5 of the key before it, every major key sits on one
// circle. What the learner has from U03.L06: the order of sharps, key signatures written and read, G and D
// major. Not yet: syllables (U03.L08), the word for the distance between notes (U04.L01). Spec:
// content/specs/U03.md.
//
// The circle itself has no lesson panel: the hook walks it by ear (one key per bar, no Band, since the Band
// sits in one key) and the prose lays it out. Wave 3 shape: a flat key signature written in order.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line written in degrees over a (possibly patterned) major scale. */
const deg = (pattern: string, key: string, extra = "") =>
  `${TEMPO}mel: n("${pattern}").scale("${key}").s("piano")${extra}`;
/** A line in note names. */
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: 1 3 5 3 in C, F, B♭ and E♭, a step round the circle every bar (anticlockwise). */
const HOOK = deg("0 2 4 2", "<C4:major F4:major Bb3:major Eb4:major>");
/** S2: F major from home to home: B♭ is its one flat (degree 4). */
const F_SCALE = deg("0 .. 7", "F4:major");
/** S3: the other way round, clockwise from C: G, D, A, each a sharp more. */
const CLOCKWISE = deg("0 2 4 2", "<C4:major G4:major D4:major A4:major>");
/** S5: E♭ major, each letter once. */
const EB_SCALE = "eb4 f4 g4 ab4 bb4 c5 d5 eb5";
/**
 * The Make's starter: F major in note names with one B left natural, an eighth passing down to A over the
 * F chord (fixed, the B♭ passes through on an eighth, as the unit's conventions ask).
 */
const MAKE_START = mel("<[f4 a4 c5 [b4 a4]] [g4 a4 f4 ~]>");

/** The Band plays in the lesson's key, F major. */
const BAND = { band: "band.two-chord-vamp" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const STAFF_KEYS = { roll: false, staff: "treble", keyboard: true } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U03.L07",
  version: 4,
  title: "Flat Keys & the Circle",
  objective:
    "I can write the flats of F, B♭ and E♭ major in order, and find any major key's sharps or flats on the circle of fifths.",
  key: { tonic: "F", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["S04", "N03"],
  terms: [{ id: "term.circle-of-fifths", step: "S3" }],
  canDo: ["cd.read.circle"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Home keeps moving",
      minutes: 0.5,
      // No Band: it would stay in one key while home moves every bar.
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "home-keeps-moving",
        version: 1,
        role: "practice",
        prompt:
          "The same four notes play from a new home each bar: C, F, B♭, E♭. At each change, listen for whether it sounds like a small shift or a big jump.",
        skills: [{ skill: "S04", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "The same four notes, 1 3 5 3, from a new home each bar.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which note is flat?",
      minutes: 0.5,
      ui: { panels: ROLL_KEYS, rollLabels: "degree" },
      example: { id: "f-major", code: F_SCALE, bars: 1 },
      exercise: {
        kind: "predict",
        id: "which-note-is-flat",
        version: 1,
        role: "practice",
        prompt:
          "Spell F major from F in your head: whole, whole, half, whole, whole, whole, half. Predict which one note needs a flat, and pick it below.",
        skills: [{ skill: "S04", w: 1 }],
        hints: null,
        tests: [],
        code: F_SCALE,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "b-flat", label: "B, which becomes B♭" },
          { id: "e-flat", label: "E, which becomes E♭" },
          { id: "a-flat", label: "A, which becomes A♭" },
        ],
        correct: ["b-flat"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Round the circle",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      example: { id: "clockwise", code: CLOCKWISE, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "round-the-circle",
        version: 1,
        role: "practice",
        prompt:
          "Run the plan C, G, D, A: each new home is degree 5 of the one before, and each key adds a sharp. Then answer both questions below about the hook's way, C, F, B♭, E♭. To hear a far key, make the plan `<C4:major G4:major C4:major F#4:major>` and run it again.",
        skills: [{ skill: "S04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. The hook went C, F, B♭, E♭: each step from C adds one flat. Count the steps to the key in the question.",
        },
        hints: ladder(
          "Both answers are about the hook's way, C, F, B♭, E♭. Going from C to G added a sharp: what did each step the other way add?",
          "One step the other way from C is the key whose degree 5 is C. Each step that way adds a flat.",
          "F major has one flat, B♭ major two. Keep counting along the hook.",
        ),
        code: { starter: CLOCKWISE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the key one step from C the other way: the one with one flat.",
            options: [
              { id: "f", label: "F" },
              { id: "d", label: "D" },
              { id: "b-flat", label: "B♭" },
            ],
            correct: ["f"],
          },
          { q: "number", prompt: "Type how many flats E♭ major has.", correct: 3 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["f"], number: 3 } }, expect: "pass" },
          {
            name: "two steps the other way",
            response: { answer: { choice: ["b-flat"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted E flat as the second step",
            response: { answer: { choice: ["f"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "notate",
      title: "Write B♭ major's flats",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "staff-write",
        id: "b-flat-major-flats",
        version: 1,
        role: "check",
        key: { tonic: "Bb", mode: "major" },
        prompt:
          "Write the key signature of B♭ major: its flats at the start of the staff, from the left, in the order flats are always written, B E A D G C F. Write only the flats B♭ major needs.",
        skills: [
          { skill: "N03", w: 0.6 },
          { skill: "S04", w: 0.4 },
        ],
        feedbackText: {
          "keysig.wrong":
            "Not yet: you wrote {got}. Flats come in the order B E A D G C F, as many as the key needs. How many steps round the circle is B♭ from C?",
          // The catalog's count and type texts print the whole signature; on a first try the hints do that.
          "keysig.count":
            "You wrote {count}. Count the steps from C to B♭ round the circle: each one adds a flat.",
          "keysig.type": "B♭ major is a flat key: its signature has flats only.",
        },
        hints: ladder(
          "Write only B♭ major's flats, in order. How many steps from C is B♭ on the circle, and what does each step add?",
          "Flats are written in the order B E A D G C F, the order of sharps backwards, as many as the key needs.",
          "The first flat of every flat key is B♭, F major's only one. B♭ major needs one more.",
        ),
        answer: {
          ui: "staff-input",
          mode: "key-signature",
          clef: "treble",
          bars: 1,
          palette: { durations: [], accidentals: true, ties: false, rests: false },
        },
        expect: { e: "key-signature", key: { tonic: "Bb", mode: "major" }, order: "sequence" },
        srs: [
          {
            deck: "deck.key.signature",
            cards: ["fact.keysig.F-major", "fact.keysig.Bb-major"],
            mode: "seed",
          },
        ],
        tests: [
          { name: "Bb then Eb", response: { answer: { text: ["Bb", "Eb"] } }, expect: "pass" },
          {
            name: "Eb first",
            response: { answer: { text: ["Eb", "Bb"] } },
            expect: "fail",
            feedback: ["keysig.order"],
          },
          {
            name: "only Bb",
            response: { answer: { text: ["Bb"] } },
            expect: "fail",
            feedback: ["keysig.count"],
          },
          {
            name: "the sharps order, flattened",
            response: { answer: { text: ["Fb", "Cb"] } },
            expect: "fail",
            feedback: ["keysig.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Spell E♭ major",
      minutes: 1.25,
      graded: true,
      ui: { panels: STAFF_KEYS, staffLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "spell-e-flat-major",
        version: 1,
        role: "check",
        key: { tonic: "Eb", mode: "major" },
        prompt:
          "Turn the starter into E♭ major, from `eb4` to `eb5`: add `b` to every letter the key makes flat. Keep the letters and octaves as they are, each letter once. Done when the line plays the E♭ major scale.",
        skills: [{ skill: "S04", w: 1 }],
        code: { starter: mel("⟪e4 f4 g4 a4 b4 c5 d5 e5⟫") },
        reference: { solutions: [mel(EB_SCALE)], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        // Sharps sound right but spell a letter twice (d#4 and eb4 are one key): flats only.
        constraints: [
          { c: "arg-matches", fn: "note", argIndex: 0, pattern: "^[^#]*$", feedback: "spell.enharmonic" },
        ],
        target: { audible: true },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: that note is not in E♭ major. E♭ major has three flats: which letters carry them?",
          "spell.enharmonic":
            "It sounds right, but a sharp here spells a letter twice. E♭ major uses each letter once, with flats only.",
        },
        hints: ladder(
          "Add a `b` to every letter E♭ major makes flat. How many flats does it have, and which letters are they?",
          "Flats come in the order B E A D G C F. E♭ major is three steps from C: the first three.",
          "B and E are flat, so the first and last notes are `eb4` and `eb5`, and the B is `bb4`. One more letter needs a `b`.",
        ),
        srs: [{ family: "fam.key.scale-spell", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: mel(EB_SCALE) }, expect: "pass" },
          {
            name: "the same scale, a little softer",
            response: { code: mel(EB_SCALE, ".gain(.8)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: mel("e4 f4 g4 a4 b4 c5 d5 e5") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "spelled with sharps",
            response: { code: mel("d#4 f4 g4 g#4 a#4 c5 d5 d#5") },
            expect: "fail",
            feedback: ["spell.enharmonic"],
          },
          {
            name: "the A left natural",
            response: { code: mel("eb4 f4 g4 a4 bb4 c5 d5 eb5") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "One step round",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "one-step-round",
        version: 1,
        role: "check",
        prompt:
          "Type the major key one step round the circle from the key named, in the direction named. Write its letter, with a sharp or a flat if it has one.",
        skills: [{ skill: "S04", w: 1 }],
        hints: [
          {
            text: "Find the key one step round from the one named. Which way is the step: towards more sharps, or towards more flats?",
          },
          { text: "Clockwise, the new home is degree 5 of the old key. Anticlockwise, it is degree 4." },
          { text: "From C: clockwise is G, anticlockwise is F. Do the same from the key named." },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.key.circle", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "text", normalize: "note" },
        correct: {},
        srs: [{ family: "fam.key.circle", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Every B flat",
      minutes: 2.5,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "every-b-flat",
        version: 1,
        role: "practice",
        prompt:
          "Fix the one B in the starter that is missing its flat: in F major every `b` is `bb`. Then change the notes and rhythm until the line is yours, still in note names. It plays the quiet eight bars of your song in F. Done when every note is in F major.",
        skills: [
          { skill: "S04", w: 0.6 },
          { skill: "N03", w: 0.4 },
        ],
        code: { starter: MAKE_START },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "in-f",
            label: "Every note of the line is in F major: every B is `bb`, and no other sharps or flats",
            required: true,
            skills: ["S04"],
            rule: "in-key",
            key: { tonic: "F", mode: "major" },
            minRatio: 1,
            tracks: ["@melody"],
          },
          {
            id: "ends-home",
            label: "The line's last note is an `f`, home",
            required: false,
            skills: ["S02"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "in-range",
            label: "Every note of the line is between `c4` and `c6`",
            required: false,
            skills: ["N03"],
            rule: "range",
            track: "@melody",
            within: ["c4", "c6"],
          },
        ],
        hints: ladder(
          "Every note must be in F major. Which letter carries the flat in F major's key signature?",
          "Every B in F major is B♭: in code, `bb4` or `bb5`. Look for a B without its flat.",
          "Look inside the brackets at the end of bar 1: one note there needs the key's flat.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_START },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: mel("<[f4 a4 c5 [bb4 a4]] [g4 a4 f4 ~]>") }, expect: "pass" },
          {
            name: "beyond the brief: hats, a climb to the high f, a held ending",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: note("<[f4 a4 c5 [d5 e5]] [f5 c5 a4 ~] [g4 a4 c5 d5] [a4 g4 f4@2]>").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "an E flat that F major does not have",
            response: { code: mel("<[f4 a4 c5 [bb4 a4]] [g4 eb4 f4 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
