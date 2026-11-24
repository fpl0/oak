// U10.L04 Minor-Key Chords. Stack a triad on every degree of a minor key and the qualities shift against
// major: i, iv and v are minor, III, VI and VII are major, ii° is diminished. The major chord on ♭7, a whole
// step below home, is the subtonic (VII), and the key's three major chords are where minor songs get their
// lift. What the learner has: triads on every degree of a major key and their numerals (U06.L01–L02), roots
// first when the roots move inside a bar (U06.L08), the root–5th bass (U08.L02), natural minor and its
// `.scale("A2:minor")` (U10.L01), the relative key (U10.L02) and minor degrees by ear (U10.L03). Not yet:
// the major V of harmonic minor (U10.L06) and the minor loops by name (U10.L05). Spec: content/specs/U10.md.
//
// How it is graded: chords written as stacks are graded as chords (`pcset` per onset, AUTHORING §17.1), so
// VII from below (`-1`) passes; numerals are an `rn-palette` answer read in A minor, by degree and quality
// (`VII` against `vii` is `harmony.rn-case`); the Make's one required rule is `contains-rn` with III, VI and
// VII, read by degree and quality in the lesson's key, so stacks, `.add()` and chord names all pass and a C
// minor chord on ♭3 does not count.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 90;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Triads stacked on the roots of `roots` (n values, one a bar), on a Rhodes with a little room. */
const chords = (roots: string) =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("A2:minor").s("rhodes").room(.3)`;
/** A fingerbass on root, root, 5th (U08.L02's shape), on the same roots. */
const bass = (roots: string) =>
  `bass: n("[0 ~ 0 4]").add(n("${roots}")).scale("A1:minor").s("fingerbass").lpf(800)`;
const mel = (tune: string) => `mel: n("${tune}").scale("A3:minor").s("piano")`;

/** i–iv–VII–III (Am Dm G C): the hook. */
const LIFT = "<0 3 6 2>";
/** A tune on chord notes on beat 1 of every bar: E C A | F D | G E B | E C (E over G on beat 3 is its 6th, a colour). */
const TUNE = "<[4 ~ 2 0] [5 ~ 3 ~] [6 ~ 4 1] [4 ~ 2 ~]>";
const HOOK = code(chords(LIFT), bass(LIFT), mel(TUNE));
/**
 * The seven triads of A minor up the scale and home, one a beat for two bars. The roots come first: `.add()`
 * keeps the rhythm of the pattern on its left (U06.L08), so a held stack on the left would play only i.
 */
const SEVEN = code(
  'chords: n("<[0 1 2 3] [4 5 6 7]>").add(n("[0,2,4]")).scale("A2:minor").s("rhodes").room(.3)',
);

/** i–iv–v–i: every chord minor. Bars 3 and 4 are the learner's. */
const MODIFY_STARTER = code(chords("<0 3 ⟪4 0⟫>"));
const MODIFY_SOLUTION = code(chords(LIFT));

/** The loop the quiz names, in chord symbols: i VI VII i. */
const NAMED = code('chords: chord("<Am F G Am>").voicing().s("rhodes").room(.3)');

/** The Make starts all minor: i–iv–v–i, no bass. */
const MAKE_STARTER = code(chords("<0 3 4 0>"));

/** Drums from the Band; the chords, the bass and the tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "A", mode: "minor" } as const;

export default defineLesson({
  id: "U10.L04",
  version: 4,
  title: "Minor-Key Chords",
  objective:
    "I can name the seven chords of a minor key, i ii° III iv v VI VII, and use its three major chords to lift a minor loop.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["H07"],
  practises: [],
  terms: [{ id: "term.subtonic", step: "S3" }],
  canDo: ["cd.read.minor-roman"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.fingerbass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Seven chords, then a groove",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "seven-chords-then-a-groove",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two clips: a chord on every note of A minor, from home to home, then a groove made from four of them. Listen for the bars where the groove sounds brighter, though the key stays minor.",
        skills: [{ skill: "H07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: SEVEN,
            caption: "A triad on each degree of A minor, one a beat, then home. Not all of them are dark.",
            bars: 2,
          },
          { code: HOOK, caption: "The groove: four of those chords, a fingerbass and a tune.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "The chord on ♭3",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "the-chord-on-flat-3",
        version: 1,
        role: "practice",
        prompt:
          "Predict what kind of chord sits on degree ♭3 of A minor. Degree ♭3 is C; a triad on it skips a note twice: C, E, G. Pick an answer, then hear it.",
        skills: [{ skill: "H07", w: 1 }],
        hints: null,
        tests: [],
        code: SEVEN,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "major", label: "Major: bright" },
          { id: "minor", label: "Minor: dark" },
          { id: "diminished", label: "Diminished: tense" },
        ],
        correct: ["major"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Bright and dark",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      example: { id: "the-seven", code: SEVEN, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "bright-and-dark",
        version: 1,
        role: "practice",
        prompt:
          "Run the code: the seven triads of A minor, then home. Read each numeral in the chord band as it plays, and listen for the chords that sound bright. Then answer both questions.",
        skills: [{ skill: "H07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the chord band again: upper-case numerals are major, lower-case ones minor, and ° marks the diminished one.",
        },
        hints: ladder(
          "Listen for the chords that sound bright, then find the degree each one is built on.",
          "The chord band writes major chords in upper case and minor ones in lower case. Count each kind.",
          "The chord on ♭3, C E G, is major: III. Two more upper-case numerals follow it.",
        ),
        code: { starter: SEVEN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "On which degrees are the major chords?",
            options: [
              { id: "b3-b6-b7", label: "♭3, ♭6 and ♭7" },
              { id: "1-4-5", label: "1, 4 and 5" },
              { id: "2-5-b7", label: "2, 5 and ♭7" },
            ],
            correct: ["b3-b6-b7"],
          },
          { q: "number", prompt: "How many minor chords does the key have?", correct: 3 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["b3-b6-b7"], number: 3 } }, expect: "pass" },
          {
            name: "the major key's pattern",
            response: { answer: { choice: ["1-4-5"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the diminished chord counted as minor",
            response: { answer: { choice: ["b3-b6-b7"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Lift the second half",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "lift-the-second-half",
        version: 1,
        role: "check",
        prompt:
          "This loop plays i iv v i, every chord minor. Change the last two numbers in `.add()` so bar 3 plays VII and bar 4 plays III. Keep bars 1 and 2 as they are.",
        skills: [{ skill: "H07", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. A numeral is a degree, and `n` counts from 0: subtract one.",
        },
        hints: ladder(
          "VII and III are built on two of minor's lowered degrees. Find which two.",
          "A numeral's degree minus one is its number in `.add()`: `n` counts from 0, so degree 4 is `n` 3, as in bar 2.",
          "VII is built on ♭7, so bar 3's number is 6. Now III.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "VII from below",
            response: { code: code(chords("<0 3 -1 2>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(chords("<0 3 4 0>")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the numerals typed as numbers: 7 and 3",
            response: { code: code(chords("<0 3 7 3>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "bar 2 changed as well",
            response: { code: code(chords("<0 5 6 2>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Number the loop",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "number-the-minor-loop",
        version: 1,
        role: "check",
        key: MINOR,
        prompt:
          "Write the numeral of each chord in this A minor loop, Am F G Am, one per bar. Count each root from A. Use upper case for a major chord and lower case for a minor one.",
        skills: [
          { skill: "H07", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        hints: ladder(
          "Count each chord's root up from A, home: that gives its degree.",
          "A is 1, so F is ♭6 and G is ♭7. Then decide each chord's case by its quality.",
          "Bar 1 is i: A minor is home, and minor. F is a major chord on ♭6.",
        ),
        stimulus: { src: "code", code: NAMED, bars: 4, showCode: true },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads"] },
        correct: { rn: ["i", "VI", "VII", "i"] },
        spelling: "enharmonic",
        order: "sequence",
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        // The catalog names the learner's numeral as a chord of the key ("vi … (Fm)") and the degrees without
        // their flats; in minor the lesson's own image is to count the root from A.
        feedbackText: {
          "harmony.rn-degree":
            "Chord {slot}: {expChord} is {exp} in A minor, not {got}. Count its root from A, the home note.",
        },
        tests: [
          { name: "i VI VII i", response: { answer: { rn: ["i", "VI", "VII", "i"] } }, expect: "pass" },
          {
            name: "VII in lower case",
            response: { answer: { rn: ["i", "VI", "vii", "i"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
          {
            name: "counted from C",
            response: { answer: { rn: ["vi", "IV", "V", "vi"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Hear the minor bass",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "hear-the-minor-bass",
        version: 1,
        role: "check",
        prompt:
          "Enter the bass note of each of the four bars as a degree, in order. Each loop is in a new key, and many are minor.",
        skills: [{ skill: "H07", w: 1 }],
        hints: [
          {
            text: "Hum the lowest note of each bar, then hum home, the note the music rests on. Compare each bass note with home.",
          },
          {
            text: "Sing down from each bass note to do and count the steps. In minor the steps pass me, le and te.",
          },
          {
            text: "Hear it again, slower, and sing each bass note as it arrives.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.har.bass", level: 5 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "degree-pad",
          set: ["1", "2", "b3", "4", "5", "b6", "b7"],
          sequenceLen: 4,
          syllables: true,
        },
        correct: {},
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A minor loop that lifts",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "a-minor-loop-that-lifts",
        version: 1,
        role: "practice",
        prompt:
          "Rewrite the loop, now i iv v i, so at least two chords in bars 1–4 are the key's major chords: III, VI or VII. Those four bars play just before each chorus of your song, so choose where the lift comes. Then add a `bass:` line on the chord roots.",
        skills: [{ skill: "H07", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-major-chords",
            label: "At least two chords in bars 1–4 are III, VI or VII",
            required: true,
            skills: ["H07"],
            rule: "contains-rn",
            rn: ["III", "VI", "VII"],
            min: 2,
            // A four-bar loop is heard twice in an eight-bar Make: one major chord would count twice.
            section: { bars: [1, 4] },
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
            id: "a-tune-on-the-chords",
            label: "A tune whose notes on beats 1 and 3 are mostly notes of the chord under them",
            required: false,
            skills: ["M01"],
            rule: "chord-tones-strong",
            melody: "@melody",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.6,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Find the three upper-case numerals of A minor, the major chords, and the degree each sits on.",
          "III, VI and VII sit on ♭3, ♭6 and ♭7. In `.add()` a chord's number is its degree minus one.",
          "VII is the number 6: `<0 3 6 0>` lifts bar 3. One more major chord to go.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: i iv VII III",
            response: { code: code(chords(LIFT)) },
            expect: "pass",
          },
          {
            name: "i VI VII i with a bass",
            response: { code: code(chords("<0 5 6 0>"), bass("<0 5 6 0>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: chord names, eight bars, a bass and a tune",
            response: {
              code: code(
                'chords: chord("<Am Dm G C Am F G G>").voicing().s("rhodes").room(.3)',
                'bass: chord("<Am Dm G C Am F G G>").rootNotes(1).struct("x ~ x x").s("fingerbass").lpf(800)',
                mel("<[4 ~ 2 0] [5 ~ 3 ~] [6 ~ 4 1] [4 ~ 2 ~] [4 ~ 2 0] [5 ~ 7 ~] [8 ~ 6 4] [6 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "one major chord only: i iv v VI",
            response: { code: code(chords("<0 3 4 5>"), bass("<0 3 4 5>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
