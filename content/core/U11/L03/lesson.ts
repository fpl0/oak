// U11.L03 Blue Notes. Blue notes are ♭3, ♭5 and ♭7 played against a major sound: a minor-sounding note over a
// major chord, a rub that is the blues. The blues scale gathers them: the minor pentatonic with ♭5 added between
// 4 and 5, 1 ♭3 4 ♭5 5 ♭7 (do me fa se sol te). In code `.scale("C3:blues")` (unlocked here, with `crunch` and
// `.distort()`), where `n` counts the six notes; a single blue note is a note name, `note("eb4")`, the way U08.L03
// wrote chromatic approach notes. The chromatic step strings (`n("2b")`) are only shown, read-only: they are
// U15.L01's. What the learner has: the major and minor pentatonics (U11.L01–L02), note names with flats (U02.L03),
// `chord()` with `.voicing()` and `.rootNotes()` (U05.L08, U08.L01). Not yet: the dominant seventh (U11.L04), the
// 12-bar form (U11.L05), swing (U11.L07). Spec: content/specs/U11.md.
//
// The key is C blues, so the roll labels read ♭3 ♭5 ♭7 against C. The vamp is C and F by chord name, so no
// code string mixes two scales (check 13). S4 bends into the 3rd from E♭ and is graded with `events`, absolute.
// S5 is four fixed licks over a C chord: major pentatonic, minor pentatonic or blues (no drill family generates
// scale colour yet). The Make's required rule is `degree-set` with `anyOf` ♭3 ♭5 ♭7, `minCount: 1` (the feature
// `degree-set.any-of` the spec waited for): the starter on the major pentatonic has none and fails; the riff on
// `C3:blues`, or one bent note `eb3`, passes.
import { defineLesson, type HintLadder, SCALE_COLOUR_OPTIONS } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The C–F vamp on the organ, one chord a bar, and its root bass (U08.L01). */
const VAMP = [
  'chords: chord("<C F>").voicing().s("organ").gain(.5)',
  'bass: chord("<C F>").rootNotes(2).s("ebass").lpf(600)',
] as const;
/** The hook's riff: C E♭ F G♭ | G ~ G♭ F, the blues scale through the crunch guitar. */
const RIFF = "<[0 1 2 3] [4 ~ 3 2]>";
const HOOK = code(...VAMP, `gtr: n("${RIFF}").scale("C3:blues").s("crunch").distort(.8)`);
/** The same rhythm on the major pentatonic, in note names: C D E G | A ~ G E. Sweet, no bite. */
const SWEET = code(...VAMP, 'gtr: note("<[c3 d3 e3 g3] [a3 ~ g3 e3]>").s("acgtr")');
/** S2: the first six notes of the scale from home. */
const SIX = code(
  'gtr: n("0 1 2 3 4 5").scale("C3:blues").s("crunch")',
  'bass: note("c2").s("ebass").lpf(600)',
);
/** S3: the scale up to the octave and back, over the vamp. */
const UP_AND_DOWN = code(
  ...VAMP,
  'gtr: n("<[0 1 2 3 4 5 6 ~] [6 5 4 3 2 1 0 ~]>").scale("C3:blues").s("crunch")',
);

/** S4: a two-bar lick over a held C; the learner bends into the 3rd from the blue note below it. */
const C_CHORD = 'chords: chord("C").voicing().s("organ").gain(.5)';
const lick = (bar1: string) => code(C_CHORD, `mel: note("<${bar1} [g4 ~ e4 ~]>").s("crunch")`);
const BEND_STARTER = lick("[⟪~ e4⟫ c4 ~]");
const BEND_SOLUTION = lick("[eb4 e4 c4 ~]");

/** S5: four licks over a C chord, one scale each. */
const colour = (line: string, scale: string) =>
  code(C_CHORD, `mel: n("${line}").scale("C4:${scale}").s("crunch")`);
const BLUES_UP = colour("0 1 2 3 4 3 2 0", "blues");
const MAJOR_PENTA = colour("0 1 2 3 4 3 2 0", "major:pentatonic");
const MINOR_PENTA = colour("4 3 2 1 0 ~ 1 0", "minor:pentatonic");
const BLUES_DOWN = colour("5 4 3 2 1 0 ~ ~", "blues");
const COLOUR_WRONG = {
  "id.wrong":
    "Not this one. Listen to the 3rd above C first: 3 means the major pentatonic. If it is ♭3, listen between 4 and 5 for a note squeezed in.",
};

/** S6, read-only: the blue notes as altered degrees of C major, C E♭ E G♭ G B♭ (tb.n.chromatic is U15.L01's). */
const ALTERED = code(
  'mel: n("0 2b 2 4b 4 6b").scale("C4:major").s("piano")',
  'bass: note("c2").s("ebass").lpf(600)',
);

/** The Make starts with the vamp and the sweet riff on the major pentatonic. */
const MAKE_STARTER = code(...VAMP, `gtr: n("${RIFF}").scale("C3:major:pentatonic").s("acgtr")`);

/** Drums from the Band; the vamp and the riff are the learner's. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const COLOURS = [...SCALE_COLOUR_OPTIONS];

export default defineLesson({
  id: "U11.L03",
  version: 4,
  title: "Blue Notes",
  objective: "I can give a line its bite with ♭3, ♭5 and ♭7, the notes of the blues scale.",
  key: { tonic: "C", mode: "blues" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S11"],
  practises: [],
  terms: [
    { id: "term.blues-scale", step: "S3" },
    { id: "term.blue-note", step: "S3" },
  ],
  canDo: ["cd.compose.blue-notes"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.organ": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Sweet, then bite",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "sweet-then-bite",
        version: 1,
        role: "practice",
        prompt:
          "Listen to riff 1, then riff 2, both over an organ vamp on C and F. Riff 2 keeps the rhythm but changes the notes and the guitar. Listen past the distortion to the notes: where does riff 2 rub against the organ's chords?",
        skills: [{ skill: "S11", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: SWEET, caption: "Riff 1, on the major pentatonic: C D E G, A G E.", bars: 4 },
          {
            code: HOOK,
            caption: "Riff 2: the same rhythm, other notes, through a distorted guitar.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "One note more",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "one-note-more",
        version: 1,
        role: "practice",
        prompt:
          'C minor pentatonic is C E♭ F G B♭, and the scale `"C3:blues"` has one note more. Predict which note is new when `n("0 1 2 3 4 5")` plays on it. Pick one answer, then listen to check it.',
        skills: [{ skill: "S11", w: 1 }],
        hints: null,
        tests: [],
        code: SIX,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "gb", label: "G♭, between F and G" },
          { id: "d", label: "D, between C and E♭" },
          { id: "b", label: "B, between B♭ and C" },
        ],
        correct: ["gb"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Three flat notes",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "six-notes", code: UP_AND_DOWN, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "three-flat-notes",
        version: 1,
        role: "practice",
        prompt:
          "Run the scale up and down over the vamp and read the degree label on each note in the roll. Then answer two questions: which three degrees carry a flat, and how many half steps lie from ♭5 up to 5.",
        skills: [{ skill: "S11", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the six labels on the roll from the bottom: 1, then ♭3, 4, ♭5, 5 itself and ♭7. ♭5 and 5 sit side by side on the keyboard.",
        },
        hints: ladder(
          "Read the six labels on the roll from home upward. Which of them have a ♭ in front?",
          "Read the labels from home upward. Three of the six carry a flat; one of them sits just under 5.",
          "♭5 is G♭ and 5 is G. Count the keys from one to the other, black ones included.",
        ),
        code: { starter: UP_AND_DOWN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which three degrees carry a flat?",
            options: [
              { id: "b3-b5-b7", label: "♭3, ♭5 and ♭7" },
              { id: "b3-b6-b7", label: "♭3, ♭6 and ♭7" },
              { id: "b2-b3-b5", label: "♭2, ♭3 and ♭5" },
            ],
            correct: ["b3-b5-b7"],
          },
          { q: "number", prompt: "How many half steps from ♭5 up to 5?", correct: 1 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["b3-b5-b7"], number: 1 } }, expect: "pass" },
          {
            name: "natural minor's flats",
            response: { answer: { choice: ["b3-b6-b7"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step",
            response: { answer: { choice: ["b3-b5-b7"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Bend into the 3rd",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "bend-into-the-3rd",
        version: 1,
        role: "check",
        prompt:
          "Bar 1 of this lick starts with a rest, then E. Replace the rest with the blue note a half step below E, in the same octave, so it slides straight into the E. Keep every other note as it is.",
        skills: [{ skill: "S11", w: 1 }],
        code: { starter: BEND_STARTER },
        reference: { solutions: [BEND_SOLUTION], bars: 2 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the lick plays {got}, the target has {exp}. The bend rises: the blue 3rd first, then E, degree 3.",
        },
        hints: ladder(
          "The new note goes where the rest is, right before the E. Which blue note sits just below degree 3?",
          "Degree 3 of C is E. The blue note under it is ♭3, a half step lower, written with a `b` after the letter.",
          "The rest on beat 1 becomes that note, in the same octave as the E after it.",
        ),
        tests: [
          { name: "reference", response: { code: BEND_SOLUTION }, expect: "pass" },
          {
            name: "the same sound spelled with a sharp",
            response: { code: lick("[d#4 e4 c4 ~]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: lick("[~ e4 c4 ~]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a fall instead of a bend: E, then E♭",
            response: { code: lick("[e4 eb4 c4 ~]") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "a whole step below: D",
            response: { code: lick("[d4 e4 c4 ~]") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the C on beat 3 bent as well",
            response: { code: lick("[eb4 e4 b3 ~]") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Which five, which six?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "which-scale",
        version: 1,
        role: "check",
        prompt:
          "Listen to four short licks over a C chord. For each lick, pick major pentatonic, minor pentatonic or blues scale. First listen for 3 or ♭3, then for a note squeezed between 4 and 5.",
        skills: [{ skill: "S11", w: 1 }],
        hints: ladder(
          "Start with the 3rd above C. Does the lick sound sweet against the chord, or does it bite?",
          "Sweet means 3, the major pentatonic. With ♭3, listen between 4 and 5: the blues scale squeezes ♭5 in there.",
          "Hum C, then F and G. Does the lick pass through a note between them?",
        ),
        srs: [{ family: "fam.key.scale-spell", mode: "review-if-due" }],
        tests: [],
        parts: [
          {
            kind: "identify",
            id: "lick-1",
            version: 1,
            role: "check",
            prompt: "Lick 1. Which scale?",
            skills: [{ skill: "S11", w: 1 }],
            hints: ladder(
              "Sweet or biting against the C chord?",
              "It bites: ♭3 is there. Now listen as it climbs from F to G.",
              "Hum along slowly between F and G: one step, or two small ones?",
            ),
            stimulus: { src: "code", code: BLUES_UP, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["blues"] },
            feedbackText: COLOUR_WRONG,
            tests: [
              { name: "blues", response: { answer: { choice: ["blues"] } }, expect: "pass" },
              {
                name: "minor pentatonic",
                response: { answer: { choice: ["minor pentatonic"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "lick-2",
            version: 1,
            role: "check",
            key: { tonic: "C", mode: "major pentatonic" },
            prompt: "Lick 2. Which scale?",
            skills: [{ skill: "S11", w: 1 }],
            hints: ladder(
              "Sweet or biting against the C chord?",
              "Listen to the third note of the lick: is it the chord's own 3rd?",
              "Hum C, then the lick's third note. Do re mi, or do me?",
            ),
            stimulus: { src: "code", code: MAJOR_PENTA, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["major pentatonic"] },
            feedbackText: COLOUR_WRONG,
            tests: [
              {
                name: "major pentatonic",
                response: { answer: { choice: ["major pentatonic"] } },
                expect: "pass",
              },
              {
                name: "blues",
                response: { answer: { choice: ["blues"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "lick-3",
            version: 1,
            role: "check",
            key: { tonic: "C", mode: "minor pentatonic" },
            prompt: "Lick 3. Which scale?",
            skills: [{ skill: "S11", w: 1 }],
            hints: ladder(
              "Sweet or biting against the C chord?",
              "It bites. The lick walks down from ♭7 to home: does it take any half steps on the way?",
              "Hum along slowly from G down to F: one step, or two small ones?",
            ),
            stimulus: { src: "code", code: MINOR_PENTA, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["minor pentatonic"] },
            feedbackText: COLOUR_WRONG,
            tests: [
              {
                name: "minor pentatonic",
                response: { answer: { choice: ["minor pentatonic"] } },
                expect: "pass",
              },
              {
                name: "blues",
                response: { answer: { choice: ["blues"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "lick-4",
            version: 1,
            role: "check",
            prompt: "Lick 4. Which scale?",
            skills: [{ skill: "S11", w: 1 }],
            hints: ladder(
              "Sweet or biting against the C chord?",
              "It bites, and it comes down fast. Listen from G down to F.",
              "Hear it again and hum just the stretch from G to F: is a note squeezed between them?",
            ),
            stimulus: { src: "code", code: BLUES_DOWN, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["blues"] },
            feedbackText: {
              "id.wrong": "Listen between 4 and 5: is there a note squeezed in?",
            },
            tests: [
              { name: "blues", response: { answer: { choice: ["blues"] } }, expect: "pass" },
              {
                name: "heard as minor pentatonic: ♭5 passes quickly",
                response: { answer: { choice: ["minor pentatonic"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "see",
      title: "Flats on the steps",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "altered-degrees", code: ALTERED, bars: 1, preview: true },
    },
    {
      id: "S7",
      kind: "make",
      title: "A riff with bite",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "a-riff-with-bite",
        version: 1,
        role: "practice",
        // The starter sits on the major pentatonic of C; the rules read degrees against C either way.
        key: { tonic: "C", mode: "major pentatonic" },
        prompt:
          "Write the riff for the four bars after your song's opening, over the C–F vamp. Give it at least one blue note, ♭3, ♭5 or ♭7: change its scale to the blues scale, or write it in note names with a flat note such as `eb3`. Then try the crunch guitar and a small `.distort()`.",
        skills: [{ skill: "S11", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-blue-note",
            label: "The gtr line plays at least one blue note: ♭3, ♭5 or ♭7",
            required: true,
            skills: ["S11"],
            rule: "degree-set",
            track: "gtr",
            anyOf: ["b3", "b5", "b7"],
            minCount: 1,
          },
          {
            id: "crunch",
            label: "Some line plays the crunch guitar, `crunch`",
            required: false,
            skills: ["S11"],
            rule: "sounds",
            contains: ["snd.crunch"],
          },
          {
            id: "resolves",
            label: "The gtr line plays both ♭3 (E♭) and 3 (E)",
            required: false,
            skills: ["S11"],
            rule: "degree-set",
            track: "gtr",
            contains: ["b3", "3"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The riff needs one note that rubs against the major chords. Which three degrees do that?",
          "Change the scale word to the six-note scale, or write one note by name with a flat, such as the one a half step under E.",
          'Try `.scale("C3:blues")` on the riff and listen. Then try `.s("crunch")`, and `.distort()` with a small number.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the riff on the blues scale",
            response: { code: code(...VAMP, `gtr: n("${RIFF}").scale("C3:blues").s("acgtr")`) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a bent riff in note names, crunch and distortion",
            response: {
              code: code(
                ...VAMP,
                'gtr: note("<[c3 [eb3 e3] g3 ~] [bb3 ~ g3 [gb3 f3]] [c3 [eb3 e3] g3 a3] [g3 ~ eb3 c3]>").s("crunch").distort(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "crunch and distortion, but still the major pentatonic",
            response: {
              code: code(
                ...VAMP,
                'gtr: n("<[0 2 3 4] [3 ~ 2 0]>").scale("C3:major:pentatonic").s("crunch").distort(.8)',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
