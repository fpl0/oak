// U05.L03 Diminished & Augmented. Two 3rds of the same size make the unstable triads: two minor 3rds are a
// diminished triad (in a major key, the stack on degree 7: B D F in C), two major 3rds an augmented one
// (C E G♯). Their outer 5th is a half step smaller (six half steps: the tritone of U04.L03) or larger (eight)
// than the seven of major and minor, and both sound as if they must move on: B° leans into C, and C+ climbs
// on to F as G♯ rises to A. What the learner has: triads stacked by hand (U05.L01), major and minor triads by
// their bottom 3rd (U05.L02), the tritone (U04.L03), note names with sharps (U02.L03). Not yet: chord names
// on paper (U05.L04), `chord()` (U05.L08), and `Caug` voiced by a dictionary (wrong in `triads`, STYLE §5.2).
// Spec: content/specs/U05.md.
//
// C augmented is not a chord of C major, so it is written as a note list (chromatic `n` steps wait for
// U15.L01); the stack on degree 7 is `n("[6,8,10]")`. Chords are graded as chords (`pcset` with the bass).
// The Make's one required rule is `chord-qualities` with `anyOf: ["dim", "aug"]`: at least one stack whose
// triad core is diminished or augmented, so a cluster on 7 (B C D) does not pass.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A chord line in note names. */
const chordNotes = (pattern: string, extra = "") => `chords: note("${pattern}").s("piano")${extra}`;
/** A chord line written as stacked degrees in C. */
const chords = (pattern: string, extra = "") =>
  `chords: n("${pattern}").scale("C3:major").s("piano")${extra}`;
/** A melody line in note names. */
const melNotes = (pattern: string) => `mel: note("${pattern}").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** C, C augmented, F, B diminished: the top note climbs G, G♯, A; B° leans back into C at the loop. */
const HOOK_CHORDS = "<[c4,e4,g4] [c4,e4,g#4] [c4,f4,a4] [b3,d4,f4]>";
/** The tune follows the top of each chord, then steps down inside it. */
const HOOK_TUNE = "<[g4 ~ e4 ~] [g#4 ~ e4 ~] [a4 ~ f4 ~] [f4 ~ d4 ~]>";
const HOOK = code(chordNotes(HOOK_CHORDS, ".gain(.7)"), melNotes(HOOK_TUNE));
const HOOK_CHORDS_ONLY = code(chordNotes(HOOK_CHORDS));

/** The stack on degree 7 (B D F), then the stack on 1 an octave up (C E G): where it leans. */
const SEVEN_HOME = code(chords("<[6,8,10] [7,9,11]>"));

/**
 * The modify step: C major, then F, under a tune that sings G♯ and then A. Raising the 5th of C (G to G♯)
 * makes the augmented triad, and its G♯ rises to the A of F.
 */
const RISE_TUNE = "<[g#4 ~ e4 ~] [a4 ~ f4 ~]>";
const rise = (bar1: string) => code(chordNotes(`<${bar1} [c4,f4,a4]>`), melNotes(RISE_TUNE));
const RISE_STARTER = rise("⟪[c4,e4,g4]⟫");
const RISE = rise("[c4,e4,g#4]");

/** The Make starter: the loop of Stacking Thirds, C G Am F, four major and minor triads. */
const LOOP = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
const MAKE_STARTER = code(chords(LOOP));

/** Drums only from the Band: the learner's chords set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "U05.L03",
  version: 3,
  title: "Diminished & Augmented",
  objective:
    "I can build and hear the two restless triads: two minor 3rds (diminished) and two major 3rds (augmented).",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C03"],
  practises: ["E08", "I03"],
  terms: [
    { id: "term.diminished-triad", step: "S3" },
    { id: "term.augmented-triad", step: "S3" },
  ],
  canDo: ["cd.hear.triads", "cd.write.chord-qualities"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Climbing, then leaning",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "climbing-then-leaning",
        version: 1,
        role: "practice",
        prompt:
          "Follow the top note of the chords through bars 1 to 3. Then listen for whether bar 4 sounds finished or leans back towards bar 1.",
        skills: [{ skill: "C03", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Four chords and a tune. Follow the top of each chord.",
            bars: 4,
          },
          { code: HOOK_CHORDS_ONLY, caption: "The four chords alone.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Which one moves on",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-moves-on",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both cards, each one chord on its own. Pick the chord that sounds restless, as if it has to move on to another chord.",
        skills: [{ skill: "C03", w: 1 }],
        hints: ladder(
          "Imagine each card as the last chord of a song. Pick the one that could not end it.",
          "One of them has a tritone between its outer notes: six half steps, the tense distance from Together Now.",
          "Play card 1, then bar 1 of the hook. They are the same chord: is that one restless?",
        ),
        stimulus: { src: "code", code: code(chordNotes("[b3,d4,f4]")), bars: 1, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "c-e-g", label: "C, E and G", audio: code(chordNotes("[c4,e4,g4]")) },
            { id: "b-d-f", label: "B, D and F", audio: code(chordNotes("[b3,d4,f4]")) },
          ],
        },
        correct: { choice: ["b-d-f"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong": "The restless one is B, D and F. Play both cards again: C, E and G could end a song.",
        },
        tests: [
          { name: "B D F", response: { answer: { choice: ["b-d-f"] } }, expect: "pass" },
          {
            name: "C E G",
            response: { answer: { choice: ["c-e-g"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two equal 3rds",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "degree" },
      example: { id: "seven-then-home", code: SEVEN_HOME, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "two-equal-thirds",
        version: 1,
        role: "practice",
        prompt:
          "Run it: bar 1 is the stack on degree 7, bar 2 the stack on 1 an octave up. Find bar 1's three notes on the keyboard and count the half steps from each note up to the next. Then answer both questions below.",
        skills: [
          { skill: "C03", w: 1 },
          { skill: "I03", w: 0.5 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count keys on the keyboard, black ones too, from each note of bar 1 up to the next.",
        },
        hints: ladder(
          "Bar 1 is `n` 6, 8 and 10. Name those three notes of C major first: each degree is its `n` plus one.",
          "`n` 6 is degree 7, B; then D and F. A minor 3rd is three half steps, a major 3rd four.",
          "B up to D: C is one key, C♯ two, D three. Now count from D to F the same way.",
        ),
        code: { starter: SEVEN_HOME },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "Bar 1: how many half steps from D up to F?",
            correct: 3,
          },
          {
            q: "choice",
            prompt: "B up to D is three half steps too. What is the stack on degree 7 made of?",
            options: [
              { id: "two-minor", label: "Two minor 3rds" },
              { id: "minor-major", label: "A minor 3rd under a major 3rd, like a minor triad" },
              { id: "major-minor", label: "A major 3rd under a minor 3rd, like a major triad" },
            ],
            correct: ["two-minor"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["two-minor"] } }, expect: "pass" },
          {
            name: "heard as a minor triad",
            response: { answer: { number: 3, choice: ["minor-major"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "D to F counted as a major 3rd",
            response: { answer: { number: 4, choice: ["two-minor"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Make it rise",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "make-it-rise",
        version: 1,
        role: "check",
        prompt:
          "The tune climbs G♯ to A, but bar 1's chord is plain C major, C E G, and its top note rubs against the tune. Move one note of bar 1's chord a half step to make it augmented: two major 3rds. Done when bar 1 is C augmented, C still at the bottom.",
        skills: [{ skill: "C03", w: 1 }],
        code: { starter: RISE_STARTER },
        reference: { solutions: [RISE], bars: 2 },
        // A chord is its notes, not its spelling: `ab4` is the same key as `g#4`, though G♯ is its name here
        // (a raised 5th keeps the letter G).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}. Keep C at the bottom and E in the middle: the change is at the top.",
          "harmony.bass":
            "Bar {bar}: C is no longer the lowest note. Keep C at the bottom; the change is at the top.",
        },
        hints: ladder(
          "C up to E is already a major 3rd, four half steps. Check the size of the other 3rd, from E up to the top note.",
          "E up to G is three half steps, a minor 3rd. Two major 3rds need four there, so the top note goes up.",
          "Up a half step is one key to the right. The new key is a black one, and the note keeps its letter.",
        ),
        tests: [
          { name: "reference", response: { code: RISE }, expect: "pass" },
          {
            name: "the same key spelled as a flat",
            response: { code: rise("[c4,e4,ab4]") },
            expect: "pass",
          },
          {
            name: "the same notes listed top down",
            response: { code: rise("[g#4,e4,c4]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: rise("[c4,e4,g4]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the root raised instead",
            response: { code: rise("[c#4,e4,g4]") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right notes with C moved to the top",
            response: { code: rise("[e4,g#4,c5]") },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "bar 2 changed as well",
            response: { code: code(chordNotes("<[c4,e4,g#4] [c4,a4,f4]>"), melNotes(RISE_TUNE)) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Four colours",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "four-colours",
        version: 1,
        role: "check",
        prompt:
          "Oak plays one chord at a time, each on a new note. Pick its kind: major, minor, diminished or augmented.",
        skills: [{ skill: "E08", w: 1 }],
        hints: [
          { text: "First decide settled or restless: major and minor can end a song, the other two cannot." },
          {
            text: "If it is settled, is it bright (major) or darker (minor)? If restless, does it sound squeezed and dark (diminished) or stretched and bright (augmented)?",
          },
          { text: "Hear it again, slower, and hum the lowest and the highest note.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.chd.quality-triad", level: 4 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "quality-pad", set: ["maj", "min", "dim", "aug"] },
        correct: {},
        srs: [{ family: "fam.chd.quality-triad", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Spell all four",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "spell-all-four",
        version: 1,
        role: "check",
        prompt:
          "Oak names a triad by its root and a sign: nothing for major, m for minor, ° for diminished, + for augmented. Type its three notes from the root up, with any sharps or flats.",
        skills: [
          { skill: "C03", w: 1 },
          { skill: "I03", w: 0.5 },
        ],
        hints: ladder(
          "Start with the letters: from the root, skip one letter, then skip one more.",
          "Letters first, then the 3rds in half steps: major 4 then 3, minor 3 then 4, diminished 3 and 3, augmented 4 and 4.",
          "E♭ augmented: the letters are E♭, G, B. E♭ up to G is four half steps, and G up to B is four too, so B stays natural.",
        ),
        stimulus: { src: "generator", family: "fam.chd.spell", level: 2 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "text", normalize: "note" },
        correct: {},
        srs: [
          { family: "fam.chd.spell", mode: "review-if-due" },
          { family: "fam.int.spell", mode: "evidence-only" },
        ],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Tension and answer",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "tension-and-answer",
        version: 1,
        role: "practice",
        prompt:
          "Put one restless triad, diminished or augmented, into the four-bar loop, and let the next chord answer it: B° to C, or C+ (C, E, G♯) to F. A tune on top can climb with the chords. Done when the loop has at least one diminished or augmented triad.",
        skills: [{ skill: "C03", w: 1 }],
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-restless-triad",
            label: "At least one diminished or augmented triad",
            required: true,
            skills: ["C03"],
            rule: "chord-qualities",
            anyOf: ["dim", "aug"],
            min: 1,
          },
          {
            id: "a-tune",
            label: "A tune on its own line, such as `mel`",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
        ],
        hints: ladder(
          "Start with the diminished triad: one degree of C major carries a stack of two minor 3rds.",
          "The stack on degree 7 is diminished, and in code degree 7 is `n` 6. An augmented triad is not in the key: write its notes by letter in `note()`, as in Make it rise.",
          "Put the stack on degree 7 in bar 3, and let bar 4 be the stack on 1 an octave up, where it leans.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: C F B° C",
            response: { code: code(chords("<[0,2,4] [3,5,7] [6,8,10] [7,9,11]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the augmented climb, a bass and a tune",
            response: {
              code: code(
                'bass: note("<c2 c2 f2 b1>").s("ebass").lpf(700)',
                chordNotes(
                  "<[[c4,e4,g4] ~ [c4,e4,g4] ~] [[c4,e4,g#4] ~ [c4,e4,g#4] ~] [c4,f4,a4] [b3,d4,f4]>",
                  ".gain(.7)",
                ),
                melNotes(HOOK_TUNE),
              ),
            },
            expect: "pass",
          },
          {
            name: "four major and minor triads in another order",
            response: { code: code(chords("<[0,2,4] [5,7,9] [3,5,7] [4,6,8]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a cluster on 7 is not a triad",
            response: { code: code(chords("<[0,2,4] [3,5,7] [6,7,8] [7,9,11]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
