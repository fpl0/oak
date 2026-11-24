// U08.L02 Root–Five–Octave. Most bass lines are made of three notes per chord: the root, the 5th above it and
// the root an octave up. In code a bass shape is a cell moved onto every root with `.add()`, exactly as a chord
// stack is (U06.L01): `n("[0 ~ 4 ~]").add(n("<0 4 5 3>"))` is root–5th under the whole loop, and +7 is the
// octave. What the learner has: root bass lines in degrees and from names (U08.L01), intervals in a key (U04: the
// 5th is four steps up, the octave seven), `.add()` and the cell-on-the-left rule (U06.L01, U06.L08), the bass
// clef (U05.L06), `ebass` and the bass preset `.lpf(600)` (C1). Not yet: approach notes (U08.L03), the kick lock
// and `const` (U08.L04). Spec: content/specs/U08.md.
//
// Grading: S4 and S5 compare the bass with `events` at `pitch: "absolute"` (the octave is the point, so an
// octave written below or as 8 must fail). The Make's required rule is `bass-line` with `members`: the share of
// bass notes that are the root, 5th or octave of the chord sounding with them. The chords sit in the learner's
// code (the Band plays drums only), because the grader is not given the Band.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Triads stacked on `roots` (n values, one a bar), as in U06.L01. */
const chords = (roots: string) => `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("piano")`;
/** A bass cell moved onto each root with `.add()`, an octave below the chords, with the C1 bass preset. */
const bass = (cell: string, roots = AXIS) =>
  `bass: n("${cell}").add(n("${roots}")).scale("C2:major").s("ebass").lpf(600)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The four-chord loop: I V vi IV (C G Am F), one chord a bar. */
const AXIS = "<0 4 5 3>";
const LOOP = chords(AXIS);
/** Three basses under the same chords: roots (U08.L01), root–5th on beats 1 and 3, the octave bounce. */
const ROOTS = code(LOOP, `bass: n("${AXIS}").scale("C2:major").s("ebass").lpf(600)`);
const ROOT_FIFTH = code(LOOP, bass("[0 ~ 4 ~]"));
const BOUNCE = code(LOOP, bass("[0 7]*4"));
/** S3: root, 5th, the root an octave up, 5th: C G C' G | G D' G' D' | A E' A' E' | F C' F' C'. */
const UP_AND_BACK = code(LOOP, bass("[0 4 7 4]"));

/** S4: the octave bounce with the octave left out (the root on every eighth). */
const BOUNCE_WITH = (cell: string) => code(LOOP, bass(cell));
const BOUNCE_STARTER = BOUNCE_WITH("⟪[0 0]*4⟫");

/**
 * S5, Play from the page: two bars under C then G, root and 5th in half notes: C2 G2 | G2 D3. The page shows
 * the bass alone; the code holds the chords and a bass whose cell and `.add()` the learner writes.
 */
const PAGE_ROOTS = "<0 4>";
const PAGE_CHORDS = chords(PAGE_ROOTS);
const PAGE_WITH = (bassExpr: string) =>
  code(PAGE_CHORDS, `bass: ${bassExpr}.scale("C2:major").s("ebass").lpf(600)`);
const PAGE_STARTER = PAGE_WITH(`⟪n("[0 0]").add(n("${PAGE_ROOTS}"))⟫`);
const PAGE_SOLUTION = PAGE_WITH(`n("[0 4]").add(n("${PAGE_ROOTS}"))`);
/** What the staff shows: the bass line alone. */
const PAGE_SHOWN = code(`bass: n("[0 4]").add(n("${PAGE_ROOTS}")).scale("C2:major").s("ebass").lpf(600)`);

/** S6: two cards under the same chords. */
const FIFTH_CARD = code(LOOP, bass("[0 ~ 4 ~]"));
const OCTAVE_CARD = code(LOOP, bass("[0 ~ 7 ~]"));

/** The Make starts with a bass that walks from the root to the 3rd in every bar. */
const MAKE_STARTER = code(LOOP, bass("[0 ~ 2 ~]"));
const TUNE = 'mel: n("<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>").scale("C4:major").s("piano")';

/** Drums from the Band; the chords and the bass are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** "Play from the page": the bass staff alone, no code view of the target, no roll, no keys. */
const BASS_STAFF = { roll: false, staff: "bass", keyboard: false } as const;

export default defineLesson({
  id: "U08.L02",
  version: 4,
  title: "Root–Five–Octave",
  objective:
    "I can write a bass line from each chord's root, its 5th and its octave, as one cell moved onto every root.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["B02"],
  practises: [],
  terms: [],
  canDo: ["cd.write.bass-line"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three grooves",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: BOUNCE, bars: 4 },
      exercise: {
        kind: "listen",
        id: "three-grooves",
        version: 1,
        role: "practice",
        prompt:
          "Listen to three basses under the same loop. Listen for how the number of bass notes in a bar changes the feel, from bass 1 to bass 3.",
        skills: [{ skill: "B02", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: ROOTS, caption: "Bass 1: one note a bar.", bars: 4 },
          { code: ROOT_FIFTH, caption: "Bass 2: two notes a bar.", bars: 4 },
          { code: BOUNCE, caption: "Bass 3: a note on every eighth.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "What the 4 adds",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "what-the-4-adds",
        version: 1,
        role: "practice",
        prompt:
          'Predict what the 4 in the cell plays on beat 3, then pick it. The bass is `n("[0 ~ 4 ~]").add(n("<0 4 5 3>"))`: the cell `[0 ~ 4 ~]` moved onto each chord\'s number, so beat 1 plays the root.',
        skills: [{ skill: "B02", w: 1 }],
        hints: null,
        tests: [],
        code: ROOT_FIFTH,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "fifth", label: "The 5th of each chord, four steps above its root" },
          { id: "fourth", label: "The 4th above each root" },
          { id: "tune", label: "A note of the tune" },
        ],
        correct: ["fifth"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Up and back",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "up-and-back", code: UP_AND_BACK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "up-and-back",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop and follow the bass, the lowest line on the roll: the cell `[0 4 7 4]` moved onto every root. Answer both questions below: which number plays the root an octave up, and which degree of C the 5th of G is.",
        skills: [{ skill: "B02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop on bar 2 and read the degree labels of the bass: the root, then each number of the cell added to it.",
        },
        hints: ladder(
          "Find the note in each bar that sounds like the first one, only higher. Which number of the cell plays it?",
          "`n` counts scale steps from the root: four steps up is the 5th, seven steps up the same letter again. Bar 2's root is G, `n` 4.",
          "In bar 1 the cell plays C, G, the next C up, G. In bar 2 add each number of the cell to 4 and read the letter.",
        ),
        code: { starter: UP_AND_BACK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which number of the cell plays the root an octave up?",
            options: [
              { id: "seven", label: "7" },
              { id: "eight", label: "8: an octave spans eight notes" },
              { id: "four", label: "4" },
            ],
            correct: ["seven"],
          },
          {
            q: "number",
            prompt: "Bar 2's chord is G. Its 5th, on beat 2, is which degree of C (1 to 7)?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["seven"], number: 2 } }, expect: "pass" },
          {
            name: "the octave as 8",
            response: { answer: { choice: ["eight"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the degree above the octave counted on",
            response: { answer: { choice: ["seven"], number: 9 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The octave bounce",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "the-octave-bounce",
        version: 1,
        role: "check",
        prompt:
          "The highlighted cell `[0 0]*4` plays the root on every eighth. Change the second 0 so every second eighth plays the root an octave up. Done when each bar goes root, octave, root, octave, four times.",
        skills: [{ skill: "B02", w: 1 }],
        code: { starter: BOUNCE_STARTER },
        reference: { solutions: [BOUNCE], bars: 4 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["bass"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the bass plays {got}, the target is {exp}. Count the steps from the root: 7 lands on the same letter, 8 goes one past it.",
          "melody.octave":
            "Bar {bar}, {beatLabel}: the right letter, but {dir} than the target. The bounce jumps up from the root, so its number is above 0.",
        },
        hints: ladder(
          "Find the number that, added to a root, lands on the same letter one octave higher.",
          "In S3, `n` counted seven steps from the root to reach the root again. The cell's second number is the one that jumps.",
          "Keep the first number of the pair at 0 and keep the `*4`. Only the second number changes.",
        ),
        tests: [
          { name: "reference", response: { code: BOUNCE }, expect: "pass" },
          {
            name: "all eight eighths written out",
            response: { code: BOUNCE_WITH("[0 7 0 7 0 7 0 7]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: BOUNCE_WITH("[0 0]*4") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the octave as 8",
            response: { code: BOUNCE_WITH("[0 8]*4") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the octave below",
            response: { code: BOUNCE_WITH("[0 -7]*4") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      // U08's "Play from the page" (AUTHORING §4): the target is on the bass staff only. No degree labels: in C
      // they would name the notes for the learner.
      ui: { panels: BASS_STAFF, staffLabels: "none", band: DRUMS },
      example: { id: "the-page", code: PAGE_SHOWN, bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "root-five-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "Write the bass on the bass clef in the highlighted part: two bars, under C then G, two notes a bar. Use one two-number cell moved onto the two roots with `.add()`. Done when the bass plays the notes on the page.",
        skills: [
          { skill: "B02", w: 0.7 },
          { skill: "N04", w: 0.3 },
        ],
        code: { starter: PAGE_STARTER },
        reference: { solutions: [PAGE_SOLUTION], bars: 2 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["bass"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: a different note from the one on the page. Read each bar's second note against its first: how many steps up is it?",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: the page has a note here. The cell goes on the left of `.add()`, so its two notes reach every bar.",
        },
        hints: ladder(
          "Each bar starts on its chord's root. Count how many steps above the root the second note is.",
          "Bar 1 starts on `c2`, two short lines below the staff, and moves up to the bottom line, `g2`. Count the letters from C, C as 1; the same count holds in bar 2, from G.",
          'The cell is `[0 ?]`, and `.add(n("<0 4>"))` stays after it. The second number is the same in both bars.',
        ),
        tests: [
          { name: "reference", response: { code: PAGE_SOLUTION }, expect: "pass" },
          {
            name: "the degrees written bar by bar",
            response: { code: PAGE_WITH('n("<[0 4] [4 8]>")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: PAGE_WITH(`n("[0 0]").add(n("${PAGE_ROOTS}"))`) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the 5th written as 5",
            response: { code: PAGE_WITH(`n("[0 5]").add(n("${PAGE_ROOTS}"))`) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the cell on the right of .add()",
            response: { code: PAGE_WITH(`n("${PAGE_ROOTS}").add(n("[0 4]"))`) },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "compare",
      title: "Which one jumps?",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-jumps",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both cards. Each bass moves on beat 3: one to the chord's 5th, the other to its root an octave up. Pick the card that jumps to the octave.",
        skills: [
          { skill: "B02", w: 0.6 },
          { skill: "I02", w: 0.4 },
        ],
        hints: ladder(
          "Compare beat 1 and beat 3 in each card. In which card does beat 3 sound like the same note, only higher?",
          "The octave keeps the letter: the two notes blend into one. The 5th is a different note that sits between them.",
          "Play card 1, then hum its beat 1 and beat 3. Do you hum one note at two heights, or two notes?",
        ),
        stimulus: { src: "code", code: OCTAVE_CARD, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "fifth", label: "Root, then 5th", audio: FIFTH_CARD },
            { id: "octave", label: "Root, then the octave", audio: OCTAVE_CARD },
          ],
        },
        correct: { choice: ["octave"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "The octave is in the second card: its beat 3 is the root again, so the two notes blend. The first card's beat 3 is a different note, the 5th.",
        },
        srs: [{ family: "fam.int.in-key", mode: "review-if-due" }],
        tests: [
          { name: "octave", response: { answer: { choice: ["octave"] } }, expect: "pass" },
          {
            name: "fifth",
            response: { answer: { choice: ["fifth"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your bass groove",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-bass-groove",
        version: 1,
        role: "practice",
        prompt:
          "Write the bass for the three loud parts of your song. The cell `[0 ~ 2 ~]` plays each root, then its 3rd: replace the 2 with the 5th (4) or the octave (7). Then build your own cell from 0, 4 and 7, in any rhythm and order. Keep the chords as they are.",
        skills: [{ skill: "B02", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "three-notes",
            label: "At least 9 in 10 bass notes are a root, 5th or octave of the chord above",
            required: true,
            skills: ["B02"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            members: { allowed: ["root", "fifth", "octave"], minRatio: 0.9 },
          },
          {
            id: "more-than-roots",
            label: "At least a quarter of the bass notes are 5ths or octaves",
            required: false,
            skills: ["B02"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            members: { allowed: ["fifth", "octave"], minRatio: 0.25 },
          },
          {
            id: "a-tune",
            label: "A melody line on top of the chords",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The cell counts from each root. Find the number in it that plays the 3rd.",
          "The 5th is four steps above the root and the octave seven. The cell's numbers count from each root.",
          "Change the 2 in the cell to a 4 for root–5th. Then try a 7 somewhere, or more notes in the cell.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: root and 5th",
            response: { code: code(LOOP, bass("[0 ~ 4 ~]")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a busier cell, the 5th below, a tune",
            response: { code: code(LOOP, bass("[0 ~ 0 7 ~ 4 -3 ~]"), TUNE) },
            expect: "pass",
          },
          {
            name: "the octave bounce",
            response: { code: BOUNCE },
            expect: "pass",
          },
          {
            name: "a cell of thirds",
            response: { code: code(LOOP, bass("[0 2 4 2]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
