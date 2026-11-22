// J3.L04 Walking Bass (spec: content/specs/J3.md). A walking bass plays a note on every beat: the chord's root on
// beat 1, a chord tone on beat 3, and on beat 4 a note a step or a half step from where the next bar starts, so
// every bar line is approached and the line walks into each new chord. The approach note is U08.L03's; what is new
// is the four-to-the-bar line that carries it into every change.
//
// Key G (the J3 key rotation: F, C, B♭, G), Am7 D7 Gmaj7 Gmaj7 at 132 BPM. The upright plays quarter notes, which
// do not swing; the ride and the comping swing (`swing` is declared for them). The comping is the left-hand
// dictionary anchored at E4, which in G plays B A B (evaluated: Am7 G3 B3 C4 E4 | D7 F♯3 B3 C4 E4 | Gmaj7 F♯3 A3
// B3 D4), so the hand hardly moves while the bass walks.
//
// Evaluated (headless Strudel): the hook's walk A C E E♭ | D F♯ A A♭ | G D B F♯ | G A B B♭ has the root on every
// beat 1, a chord tone on every beat 3 (E, A, B, B), and every beat 4 a half step from the next bar's first note
// (E♭→D, A♭→G, F♯→G, B♭→A on the loop).
//
// Written for the learner at the gate (AUTHORING §20.1): J3 opens after U13.CP, so nothing here assumes U14–U17.
// The approach notes are note names (a chromatic `n` step waits for U15.L01).
//
// Grading (the corrections-pass standard, AUTHORING §20.2). S3 starts from a walk that climbs each chord and then
// leaps to the next bar (G2→D2, C3→G2, D2→G1, F♯2→A1: no beat 4 is within two half steps of what follows), so the
// starter counts no approach. It is graded on what is heard, over two passes of the loop (8 bars, so the last
// bar's way back into bar 1 counts): `walking-bass` against the changes with the root on every beat 1 and every
// bar line approached (a step or a half step, not the same note), plus `onsets` equal to the four beats in every
// bar (still walking, nothing crowded in). The spec named `bass-line` (approach) for this step, written while
// `walking-bass` was planned; over four bars `bass-line` hears only two of the four bar lines (it counts chord
// changes, and Gmaj7 is held across bars 3 and 4), so the step uses the rule that hears all of them. It pins the
// wrong answers that use the right idea: the approach note moved onto beat 1 (every root a beat late), a half step
// under the chord the bar is already on, three bar lines leaned into and the fourth still jumping, an approach a
// 3rd away, four notes crowded into beat 4, and the walk at gain 0. The Make requires `walking-bass` against the
// changes (`changes`, so the Band's chords need not be in the learner's code), read on the quarter positions.
import { defineLesson, type HintLadder, type IdentifyEx, type RubricRule } from "@oak/content-kit";

const BPM = 132;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;

/** The ii–V–I in G, one chord a bar, Gmaj7 held for two. */
const CHANGES = "<Am7 D7 G^7 G^7>";
const CHANGE_LIST = ["Am7", "D7", "G^7", "G^7"];

/** The rhythm section: the jazz kit's ride and hats, the comping on the Charleston, B A B from the dictionary. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
const COMP = `chords: chord("${CHANGES}").dict("lefthand").anchor("e4").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)`;
/** S2: the same chords held a bar each, so the roll shows the chord band under the walk. */
const COMP_HELD = `chords: chord("${CHANGES}").dict("lefthand").anchor("e4").voicing().s("rhodes").gain(.5)`;
const bass = (bars: string) => `bass: note("<${bars}>").s("upright")`;

/** In two: the root and the 5th, a half note each. */
const TWO_FEEL = "[a1 e2] [d2 a1] [g1 d2] [g1 d2]";
/** The walk: root on 1, a chord tone on 3, beat 4 a half step from the next bar's first note. */
const WALK = "[a1 c2 e2 eb2] [d2 f#2 a2 ab2] [g2 d2 b1 f#1] [g1 a1 b1 bb1]";
/** Up each chord and a leap to the next bar: every beat but no approach (G→D, C→G, D→G, F♯→A). */
const CLIMB = "[a1 c2 e2 g2] [d2 f#2 a2 c3] [g2 d2 b1 d2] [g1 b1 d2 f#2]";
/** Another walk with every bar line approached by a half step, from below and from above. */
const WALK_TWO = "[a1 b1 c2 c#2] [d2 c2 a1 ab1] [g1 b1 d2 f#2] [g2 e2 b1 bb1]";

const trio = (bars: string) => code(RIDE, HATS, bass(bars), COMP);
const HOOK = trio(WALK);
const IN_TWO = trio(TWO_FEEL);
const WALK_HELD = code(bass(WALK), COMP_HELD);

/** S3: the climbing walk; the learner gives each bar line an approach note on beat 4. */
const walkOf = (b1: string, b2: string, b3: string, b4: string) =>
  code(RIDE, bass(`[${b1}] [${b2}] [${b3}] [${b4}]`), COMP);
const APPROACH_STARTER = walkOf("a1 c2 e2 ⟪g2⟫", "d2 f#2 a2 ⟪c3⟫", "g2 d2 b1 ⟪d2⟫", "g1 b1 d2 ⟪f#2⟫");
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const APPROACH_SOLUTION = walkOf("a1 c2 e2 eb2", "d2 f#2 a2 ab2", "g2 d2 b1 f#1", "g1 b1 d2 bb1");

/**
 * Every bar line approached from beat 4 (into D, into G, down to the low G, and back into A), the roots still on
 * beat 1, read against the changes. Graded over two passes of the loop, so the last bar's way back into bar 1 is
 * heard too.
 */
const APPROACHES: RubricRule = {
  id: "approaches",
  label:
    "In every bar the root is on beat 1, and beat 4 is one or two half steps from the next bar's first note",
  required: true,
  skills: ["B05"],
  rule: "custom",
  fn: "walking-bass",
  params: { bass: "bass", changes: CHANGE_LIST, rootOnOne: 1, approachOnFour: 1, maxSemis: 2 },
};
/** Still four to the bar: a note on every beat and nothing between them. */
const FOUR_TO_THE_BAR: RubricRule = {
  id: "four-to-the-bar",
  label: "Four bass notes a bar, one on each beat, nothing between",
  required: true,
  skills: ["B05"],
  rule: "onsets",
  track: "bass",
  equals: [
    [0, 1],
    [1, 4],
    [1, 2],
    [3, 4],
  ],
  perBar: true,
};

/** S4: four fixed items over the same ride and comping. */
const BASS_OPTIONS = [
  { id: "two", label: "In two: a long note on beats 1 and 3" },
  { id: "climb", label: "Walking, but jumping into each new bar" },
  { id: "approach", label: "Walking, every beat 4 a half step from the next bar" },
];
const earHints = (): HintLadder =>
  ladder(
    "Count the bass notes in one bar first: two or four.",
    "If there are four, listen to the bar lines only: the last note of a bar and the first note of the next.",
    "Hum those two notes. Do they almost touch, or does the line jump between them?",
  );
const ear = (id: string, prompt: string, bars: string, answer: string): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "B05", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: trio(bars), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: BASS_OPTIONS },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      "Not this one. Count the bass notes in one bar first, then listen only to the bar lines: how far does the line move from beat 4 to the next beat 1?",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    ...BASS_OPTIONS.filter((o) => o.id !== answer).map((o) => ({
      name: `heard as ${o.id}`,
      response: { answer: { choice: [o.id] } },
      expect: "fail" as const,
      feedback: ["id.wrong" as const],
    })),
  ],
});

/** S5: the Band plays the drums and the comping; the learner's bass starts in two. */
const MAKE_STARTER = code(bass(TWO_FEEL));
const make = (...lines: string[]) => code(...lines);
const WALKS: RubricRule = {
  id: "walks",
  label:
    "A bass note on every beat; the root on beat 1 in most bars, and beat 4 a step or less from the next bar's first note in at least half",
  required: true,
  skills: ["B05"],
  rule: "custom",
  fn: "walking-bass",
  params: {
    bass: "bass",
    changes: CHANGE_LIST,
    rootOnOne: 0.75,
    chordToneOnThree: 0.5,
    approachOnFour: 0.5,
    maxSemis: 2,
  },
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "J3.L04",
  version: 3,
  title: "Walking Bass",
  objective:
    "I can walk a bass line through a set of changes: the root on beat 1, a chord tone on beat 3, and beat 4 leaning into the next bar.",
  key: { tonic: "G", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["B05"],
  practises: [],
  terms: [{ id: "term.walking-bass", step: "S2" }],
  canDo: ["cd.code.walking-bass"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two, then four",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "walking-trio", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-then-four",
        version: 1,
        role: "practice",
        prompt:
          "The ride and the Rhodes are the same both times. Listen to the bass at each bar line in both takes. Notice in which take the music rolls forward into the next bar.",
        skills: [{ skill: "B05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: IN_TWO,
            caption: "The bass in two, as you have heard it so far.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The same chords. Count the bass notes in a bar.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Read the walk",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      example: { id: "walk-held", code: WALK_HELD, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-walk",
        version: 1,
        role: "practice",
        prompt:
          "Run it: the chords are held a bar each over the bass. Answer two questions: what the bass plays on beat 1 of every bar, and how many half steps lie between the last note of bar 1 and the first note of bar 2.",
        skills: [{ skill: "B05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare each bar's first note with the chord's name above it, then count the keys from the last note of bar 1 to the first of bar 2, black keys included.",
        },
        hints: ladder(
          "The chords are Am7, D7, Gmaj7, Gmaj7. Compare each bar's first bass note with the letter its chord is named after.",
          "Bar 1 starts on A under Am7, bar 2 on D under D7. For the second question, a half step is one key to the very next one.",
          "Bar 1 ends on E♭ and bar 2 starts on D. Is there a key between them?",
        ),
        code: { starter: WALK_HELD },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What does the bass play on beat 1 of every bar?",
            options: [
              { id: "root", label: "The chord's root" },
              { id: "third", label: "The chord's 3rd" },
              { id: "outside", label: "A note from outside the chord" },
            ],
            correct: ["root"],
          },
          {
            q: "number",
            prompt: "How many half steps from the last note of bar 1 to the first note of bar 2?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["root"], number: 1 } }, expect: "pass" },
          {
            name: "the 3rd: read beat 2 for beat 1",
            response: { answer: { choice: ["third"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two: a whole step",
            response: { answer: { choice: ["root"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Lean into each bar",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      exercise: {
        kind: "code-modify",
        id: "lean-into-each-bar",
        version: 1,
        role: "check",
        prompt:
          "This bass plays every beat, but it runs through each chord and then jumps to the next bar. Change the last note of each bar, beat 4, to a note one or two half steps from the next bar's first note, above or below. Bar 4 leads back to bar 1. Keep beats 1 to 3.",
        skills: [{ skill: "B05", w: 1 }],
        swing: SWUNG,
        code: { starter: APPROACH_STARTER },
        reference: { solutions: [APPROACH_SOLUTION], bars: 8 },
        // Heard: the roots on every beat 1, approach notes a step or a half step from the next root into the
        // changes (Am7→D7, D7→G, G→Am7), and exactly four notes a bar on the beats.
        matcher: { m: "rubric", rules: [APPROACHES, FOUR_TO_THE_BAR] },
        // "Keep beats 1 to 3": only each bar's beat 4 is editable (review: a changed beat 2 passed).
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to beat 4 of each bar and to the note that comes after it.",
        },
        hints: ladder(
          "Work one bar line at a time: find the first note of the next bar, then pick a beat 4 right beside it.",
          "Beat 4 is the note just before the bar line. Move it next to the next bar's first note: one or two half steps away, above or below.",
          "Bar 1 is heading for D, so its last note can sit right beside D. Bar 3 is heading for the low G that starts bar 4.",
        ),
        tests: [
          { name: "reference", response: { code: APPROACH_SOLUTION }, expect: "pass" },
          {
            name: "every approach from the half step below",
            response: { code: walkOf("a1 c2 e2 c#2", "d2 f#2 a2 f#2", "g2 d2 b1 f#1", "g1 b1 d2 g#1") },
            expect: "pass",
          },
          {
            name: "every approach from the step above",
            response: { code: walkOf("a1 c2 e2 e2", "d2 f#2 a2 a2", "g2 d2 b1 a1", "g1 b1 d2 b1") },
            expect: "pass",
          },
          {
            name: "approaches mixed: from below into D, a step above G, below the low G, above A",
            response: { code: walkOf("a1 c2 e2 c#2", "d2 f#2 a2 a2", "g2 d2 b1 f#1", "g1 b1 d2 bb1") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(APPROACH_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the approach notes on beat 1: every root a beat late",
            response: { code: walkOf("a1 a1 c2 e2", "eb2 d2 f#2 a2", "ab2 g2 d2 b1", "f#1 g1 b1 d2") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "a half step under the chord the bar is already on",
            response: { code: walkOf("a1 c2 e2 g#1", "d2 f#2 a2 c#2", "g2 d2 b1 f#1", "g1 b1 d2 f#1") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "three bar lines leaned into, the last bar still jumping back to A",
            response: { code: walkOf("a1 c2 e2 eb2", "d2 f#2 a2 ab2", "g2 d2 b1 f#1", "g1 b1 d2 f#2") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "into D from a 3rd away",
            response: { code: walkOf("a1 c2 e2 f#2", "d2 f#2 a2 ab2", "g2 d2 b1 f#1", "g1 b1 d2 bb1") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "four notes crowded into beat 4",
            response: {
              code: walkOf("a1 c2 e2 [e2 eb2 d2 db2]", "d2 f#2 a2 ab2", "g2 d2 b1 f#1", "g1 b1 d2 bb1"),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the reference, the bass silent at gain 0",
            response: { code: APPROACH_SOLUTION.replace('.s("upright")', '.s("upright").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Two, climbing or walking",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "how-the-bass-moves",
        version: 1,
        role: "check",
        prompt:
          "Four short examples, four bars each, over the same ride and Rhodes. For each, pick how the bass moves: in two, walking but jumping into each bar, or walking with every beat 4 a half step from the next bar.",
        skills: [{ skill: "B05", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        tests: [],
        parts: [
          ear("bass-one", "Example 1. How does the bass move?", TWO_FEEL, "two"),
          ear("bass-two", "Example 2. How does the bass move?", WALK_TWO, "approach"),
          ear("bass-three", "Example 3. How does the bass move?", CLIMB, "climb"),
          ear("bass-four", "Example 4. How does the bass move?", WALK, "approach"),
        ],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "Your walking bass",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "note",
        band: { band: "band.two-five-one", tracks: ["drums", "chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-walking-bass",
        version: 1,
        role: "practice",
        title: "Walking in G",
        prompt:
          "Walk the bass. Required: a note on every beat, the root on beat 1, and beat 4 a step or a half step from the next bar's first note. Also on the checklist: a chord tone on beat 3 in every bar, and a tempo of 120 to 200. Approach some bars from above, some from below.",
        skills: [{ skill: "B05", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          WALKS,
          {
            id: "three-in-the-chord",
            label: "Beat 3 is a note of the chord in every bar",
            required: false,
            skills: ["B05"],
            rule: "custom",
            fn: "walking-bass",
            params: { bass: "bass", changes: CHANGE_LIST, chordToneOnThree: 1 },
          },
          {
            id: "swing-tempo",
            label: "`setcpm` sets a tempo between 120 and 200 beats a minute",
            required: false,
            skills: ["R13"],
            rule: "tempo-bpm",
            min: 120,
            max: 200,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The starter plays two notes a bar; a walk plays four, one on each beat.",
          "A note on every beat: the chord's root on 1, another note of the chord on 3, and on 4 a note right beside the next bar's first note.",
          "Bar 1 can climb from A through the notes of Am7 and end next to D. Do the same into G, and from the last bar back into A.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the hook's walk", response: { code: make(bass(WALK)) }, expect: "pass" },
          {
            name: "another walk, half steps from below and above",
            response: { code: make(bass(WALK_TWO)) },
            expect: "pass",
          },
          {
            name: "walking down into three of the changes",
            response: { code: make(bass("[a2 g2 e2 e2] [d2 c2 a1 a1] [g1 b1 d2 f#2] [g2 f#2 d2 b1]")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars, faster, with a vibes line",
            response: {
              code: make(
                bass(
                  "[a1 c2 e2 eb2] [d2 f#2 a2 ab2] [g2 d2 b1 f#1] [g1 a1 b1 bb1] [a1 b1 c2 c#2] [d2 c2 a1 ab1] [g1 b1 d2 f#2] [g2 e2 b1 bb1]",
                ),
                'mel: note("<[e5 ~ c5 ~] [c5 ~ a4 ~] [b4 ~ ~ ~] [~ ~ ~ ~]>").swingBy(1/3, 4).s("vibes").gain(.7)',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(168/4)"),
            },
            expect: "pass",
          },
          {
            name: "four roots a bar: no bar line approached",
            response: { code: make(bass("[a1 a1 a1 a1] [d2 d2 d2 d2] [g1 g1 g1 g1] [g1 g1 g1 g1]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "four notes crowded into beat 1",
            response: {
              code: make(
                bass(
                  "[[a1 c2 e2 eb2] ~ ~ ~] [[d2 f#2 a2 ab2] ~ ~ ~] [[g2 d2 b1 f#1] ~ ~ ~] [[g1 a1 b1 bb1] ~ ~ ~]",
                ),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the walk a beat late: every root on beat 2",
            response: { code: make(`${bass(WALK)}.late(1/4)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the walk at gain 0: nothing heard",
            response: { code: make(`${bass(WALK)}.gain(0)`) },
            expect: "fail",
            feedback: ["make.silent"],
          },
        ],
      },
    },
  ],
});
