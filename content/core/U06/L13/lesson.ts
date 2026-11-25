// U06.L13 Parallel Chords (Oak 2.0 W2; DeSantis, *Making Music*, "Parallel Harmony"). Every chord so far lived in
// the key: a stack of degrees moved with `.add(n(…))` changes its shape as it moves (major on 1, minor on 6). Here
// one shape is moved by half steps instead, so every chord keeps its colour and the loop slides out of the key on
// purpose: the sound of deep house (minor chords with one more 3rd, sliding as a block) and of post-dubstep pads.
// What the learner has: note names with accidentals (U02.L03), `.transpose()` by half steps (U02.L05), stacks
// (U04.L03), the diatonic triads (U06.L01) and `.struct()` (U06.L12). Not yet: seventh-chord names (U12), so the
// four-note shape is "a minor chord with one more 3rd on top" and is always written as notes.
//
// Grading (contracts §6.7 rule 8, the written exception of 2.2): the shape is read from the sounding notes by the
// custom rule `same-shape` (the half-step gaps inside every chord of `chords` are equal, and the chord sits at
// `minShifts` different heights or more). `.voicing()` is refused there: it moves each chord's notes to the nearest
// place, so the shape changes. S4 also matches the target's pitch classes per bar (`pcset`), so the right chords in
// changing inversions (voice-led) keep the notes and miss the point: they fail `same-shape`.
//
// Evaluated: `note("[c3,eb3,g3,bb3]").transpose("<0 -2 3 5>")` plays C Eb G Bb | Bb Db F Ab | Eb Gb Bb Db |
// F Ab C Eb, gaps 3 4 3 half steps in every bar. The hook's `<0 5 3 -2>` plays the same shape on C, F, Eb and Bb.
// Fidelity pins (book-miss, book-other-way): content/validate/pins/U06.L13.ts.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 122;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The lesson's shape: a minor chord on C with one more 3rd on top (C Eb G Bb), gaps 3 4 3. */
const SHAPE = "[c3,eb3,g3,bb3]";
/** A `chords:` line: notes, then anything between them and the sound (a move, a rhythm), then the sound. */
const chords = (notes: string, chain = "", sound = "piano", tail = "") =>
  `chords: note("${notes}")${chain}.s("${sound}")${tail}`;
const bass = (notes: string, chain = "") => `bass: note("${notes}")${chain}.s("ebass").lpf(600)`;

/**
 * The hook: the shape on C, F, Eb and Bb, struck on every "and" over the Band's drums, a bass on each chord's
 * lowest note. Deep house, one colour sliding.
 */
const HOOK = code(
  bass("<c2 f2 eb2 bb1>", '.struct("x ~ ~ x ~ ~ x ~")'),
  chords(SHAPE, '.transpose("<0 5 3 -2>").struct("[~ x]*4")', "rhodes", ".gain(.7)"),
);

/** S2: the hook's four chords, voice-led (each note to the nearest note of the next chord), and parallel. */
const VOICE_LED = code(
  chords("<[c3,eb3,g3,bb3] [c3,eb3,f3,ab3] [db3,eb3,gb3,bb3] [db3,f3,ab3,bb3]>", "", "rhodes"),
);
const PARALLEL = code(chords(SHAPE, '.transpose("<0 5 3 -2>")', "rhodes"));
const SHAPE_ONCE = code(chords(SHAPE, "", "rhodes"));

/** S4: one shape, four chords: on C, two half steps down, three up, five up. */
const MOVES = "<0 -2 3 5>";
const S4_REFERENCE = code(chords(SHAPE, `.transpose("${MOVES}")`));
const S4_STARTER = code(chords(SHAPE));
const s4 = (chain: string, notes = SHAPE, tail = "") => code(chords(notes, chain, "piano", tail));
/** The S4 target written out bar by bar: C Eb G Bb, Bb Db F Ab, Eb Gb Bb Db, F Ab C Eb. */
const BY_HAND = "<[c3,eb3,g3,bb3] [bb2,db3,f3,ab3] [eb3,gb3,bb3,db4] [f3,ab3,c4,eb4]>";

/** S5: parallel minor triads on C, A, F, G, and the key's own triads on the same roots (C Am F G). */
const PARALLEL_TRIADS = code(chords("[c3,eb3,g3]", '.transpose("<0 -3 5 7>")'));
const KEY_TRIADS = code('chords: n("[0,2,4]").add(n("<0 5 3 4>")).scale("C3:major").s("piano")');
const C_MINOR = code(chords("[c3,eb3,g3]"));

/** The Make: the shape struck on every "and", standing still. */
const MAKE_STARTER = code(chords(SHAPE, '.struct("[~ x]*4")', "rhodes"));

const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: true, staff: false, keyboard: true } as const;

/** The rule this lesson is about, on the `chords` line. */
const sameShape = (minShifts: number) =>
  ({
    rule: "custom",
    fn: "same-shape",
    params: { track: "chords", minShifts },
  }) as const;

export default defineLesson({
  id: "U06.L13",
  version: 1,
  title: "Parallel Chords",
  objective:
    "I can move one chord shape by half steps, so every chord keeps its colour and the loop leaves the key.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H01", "H06"],
  terms: [{ id: "term.parallel-chords", step: "S4" }],
  canDo: ["cd.compose.parallel-chords"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One colour, four places",
      minutes: 0.5,
      ui: { panels: ROLL, band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-colour-four-places",
        version: 1,
        role: "practice",
        prompt:
          "Every chord you have written so far changed colour as it moved: major on 1, minor on 6. Listen for the colour of these four chords: does it change from bar to bar, or does one colour slide to new heights?",
        skills: [{ skill: "H01", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four bars of chords on every off-beat, over the drums.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Close or as a block",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "close-or-as-a-block",
        version: 1,
        role: "practice",
        prompt:
          "The shape plays once, then two cards play the same four chords two ways. Pick the card whose chords move as one block, every note sliding the same way at once.",
        skills: [{ skill: "H01", w: 1 }],
        hints: ladder(
          "Follow the top note of each card from bar to bar. Does it jump with the others, or stay close?",
          "In one card the notes stay near the notes before them; in the other the whole stack lifts and drops together.",
          "Listen to bar 2 of each card: in one, every note jumps up together; in the other, two notes stay where they were.",
        ),
        stimulus: { src: "code", code: SHAPE_ONCE, bars: 1, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "close", label: "Card A", audio: VOICE_LED },
            { id: "block", label: "Card B", audio: PARALLEL },
          ],
        },
        correct: { choice: ["block"] },
        feedbackText: {
          "id.wrong":
            "Card A keeps its notes close: from bar 1 to bar 2 the C and the Eb stay put. Card B lifts all four notes together. Play both again.",
        },
        tests: [
          { name: "card B", response: { answer: { choice: ["block"] } }, expect: "pass" },
          {
            name: "card A",
            response: { answer: { choice: ["close"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "How far it slides",
      minutes: 1,
      ui: { panels: KEYS, band: DRUMS },
      example: { id: "how-far", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "how-far-it-slides",
        version: 1,
        role: "practice",
        prompt:
          "Run the hook and watch the chords on the keyboard. Then answer both questions: how many half steps above bar 1's chord bar 3's chord sits, and which of its notes moved.",
        skills: [{ skill: "H01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the number for bar 3 in `.transpose()`, then compare bar 1 and bar 3 on the keyboard, note by note.",
        },
        hints: ladder(
          "`.transpose()` holds one number per bar, inside `< >`. Which one belongs to bar 3?",
          "`.transpose()` moves every note of the line by that many half steps: up for a plus, down for a minus.",
          "Bar 2's number is 5: its chord starts on F, five half steps above C. Count bar 3 the same way.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many half steps above bar 1's chord does bar 3's chord sit?",
            correct: 3,
          },
          {
            q: "choice",
            prompt: "Which notes of the chord moved up by that amount?",
            options: [
              { id: "lowest", label: "Only the lowest note" },
              { id: "outer", label: "The lowest and the highest note" },
              { id: "every", label: "Every note" },
            ],
            correct: ["every"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["every"] } }, expect: "pass" },
          {
            name: "the bass's note read as the move",
            response: { answer: { number: 3, choice: ["lowest"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "bar 2's number for bar 3",
            response: { answer: { number: 5, choice: ["every"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Slide the shape",
      minutes: 1.25,
      graded: true,
      ui: { panels: KEYS, band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "slide-the-shape",
        version: 1,
        role: "check",
        prompt:
          "Add `.transpose()` after `note()`, with four numbers inside `< >`, so the one shape plays four chords: bar 1 where it is, bar 2 two half steps down, bar 3 three up, bar 4 five up. Done when every bar plays the same shape at the target's height.",
        skills: [{ skill: "H01", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_REFERENCE], bars: 4 },
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
            {
              m: "rubric",
              rules: [
                {
                  id: "one-shape",
                  label: "Every bar plays the same shape, at three heights or more",
                  required: true,
                  skills: ["H01"],
                  ...sameShape(3),
                },
              ],
            },
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Count the half steps from the first chord to that bar's chord, and mind which way it moves.",
          "rubric.unmet": "{label}: not yet. {detail}.",
        },
        hints: ladder(
          "The shape stays the same in every bar; only its height changes. How far from bar 1 does each bar sit in the target?",
          "`.transpose()` takes one number of half steps per bar inside `< >`: a minus moves down, a plus up, and bar 1 does not move.",
          "Bar 1 is `0` and bar 2 is two half steps down, `-2`. Bars 3 and 4 move up.",
        ),
        tests: [
          { name: "reference", response: { code: S4_REFERENCE }, expect: "pass" },
          {
            name: "the four chords written out by hand",
            response: { code: code(chords(BY_HAND)) },
            expect: "pass",
          },
          { name: "moved with .add()", response: { code: s4(`.add(note("${MOVES}"))`) }, expect: "pass" },
          {
            name: "an octave higher, quieter",
            response: { code: s4(`.transpose("${MOVES}")`, "[c4,eb4,g4,bb4]", ".gain(.6)") },
            expect: "pass",
          },
          { name: "unchanged", response: { code: S4_STARTER }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "the right call, never moving",
            response: { code: s4('.transpose("<0 0 0 0>")') },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the signs flipped",
            response: { code: s4('.transpose("<0 2 -3 -5>")') },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the four moves in one bar",
            response: { code: s4(`.transpose("0 -2 3 5")`) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right chords, each in the inversion nearest the last",
            response: {
              code: code(chords("<[c3,eb3,g3,bb3] [bb2,db3,f3,ab3] [bb2,db3,eb3,gb3] [c3,eb3,f3,ab3]>")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Which one slides?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-slides",
        version: 1,
        role: "check",
        prompt:
          "A minor chord plays once, then two cards play four chords on the same four roots. Pick the card built from parallel chords.",
        skills: [{ skill: "H01", w: 1 }],
        hints: ladder(
          "Listen to the colour of each chord in a card: is it the same in all four, or does it change?",
          "Parallel chords keep one shape, so one colour. The key's own chords mix major and minor.",
          "In one card bar 1 is a major chord. Listen to bar 1 of each card again.",
        ),
        stimulus: { src: "code", code: C_MINOR, bars: 1, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "parallel", label: "Card A", audio: PARALLEL_TRIADS },
            { id: "in-key", label: "Card B", audio: KEY_TRIADS },
          ],
        },
        correct: { choice: ["parallel"] },
        feedbackText: {
          "id.wrong":
            "Card B moves major and minor chords inside the key: its colour changes as it goes. Card A keeps one minor shape on every root. Play both again.",
        },
        tests: [
          { name: "card A", response: { answer: { choice: ["parallel"] } }, expect: "pass" },
          {
            name: "card B",
            response: { answer: { choice: ["in-key"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your sliding loop",
      minutes: 2.75,
      ui: { panels: KEYS, band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-sliding-loop",
        version: 1,
        role: "practice",
        prompt:
          "Write a loop of up to four bars from one chord shape: this one or a shape of your own. Move it to at least two heights by half steps, with `.transpose()` or by hand. Done when every chord has the same shape and it sits at two heights or more.",
        skills: [{ skill: "H01", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "one-shape-moves",
            label: "Every chord on `chords` has the same shape, and it sits at two heights or more",
            required: true,
            skills: ["H01"],
            ...sameShape(2),
          },
          {
            id: "a-bass",
            label: "A bass on its own line, such as `bass`",
            required: false,
            skills: ["H06"],
            rule: "tracks",
            min: 1,
            roles: ["bass"],
          },
        ],
        hints: ladder(
          "The starter's shape never moves. Where could it go in bar 2?",
          "`.transpose()` after `note()` moves every note by the same number of half steps; one number per bar inside `< >` moves it bar by bar.",
          "Try `-2` and `5` for two of the bars, and listen: the colour stays, the key goes.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: two heights",
            response: { code: code(chords(SHAPE, '.transpose("<0 5>").struct("[~ x]*4")', "rhodes")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the hook with its bass, a second rhythm",
            response: {
              code: code(
                bass("<c2 f2 eb2 bb1>", '.struct("x ~ ~ x ~ ~ x ~")'),
                chords(SHAPE, '.transpose("<0 5 3 -2>").struct("[~ x]*4")', "rhodes", ".gain(.7).room(.3)"),
              ),
            },
            expect: "pass",
          },
          {
            name: "a major shape moved by hand",
            response: { code: code(chords("<[c3,e3,g3] [eb3,g3,bb3] [f3,a3,c4] [eb3,g3,bb3]>")) },
            expect: "pass",
          },
          {
            name: "the S4 loop, held chords",
            response: { code: S4_REFERENCE },
            expect: "pass",
          },
          {
            name: "the key's own chords: the shape changes",
            response: {
              code: code('chords: n("[0,2,4,6]").add(n("<0 3 4 5>")).scale("C3:major").s("piano")'),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
