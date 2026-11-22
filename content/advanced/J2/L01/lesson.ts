// J2.L01 All Twelve Keys (an exemplar of the jazz track; spec: content/specs/J2.md). A ii–V–I in a new key is
// the same shape moved: every note of the trio goes up the same distance. Move it up a 4th (five half steps) and
// you are in the next key round the cycle of fourths (C, F, B♭, E♭ …); twelve moves visit every key and bring
// you home. In code the move is one number pattern, `.transpose(tour)`, on every line of the trio.
//
// Written for the learner at the gate (AUTHORING §20.1): the jazz track opens after U13.CP, so this lesson uses
// only what U13.CP guarantees plus the J1 unlocks (the jazz kit, the vibraphone, hand-written shells). The trio
// is written by hand in note names (J1.L05's shells, J1.L03's two-feel bass, a vibes lick), so `.transpose()`
// moves it as one shape; chords by name are read in S5, where the chart is written out key by key.
//
// Twelve-key practice is spread, never a drill wall (pre-flight B1): the lesson tours all twelve keys once by ear
// (S1, S3), the graded steps move one key further each (S4: B♭ by moving, S5: A♭ by name), and the Make asks for
// three keys; `deck.jzz.ii-v` keeps the twelve alive one card a day once the drills engine writes it.
//
// The corrections-pass standard (AUTHORING §20.2) on every graded step:
// - each required check reads what is HEARD: the chords' and the bass's pitch classes at every onset (`pcset`
//   with the bass), and in the Make the comping really coming back a 4th higher (`transposed-copy` with `semis`);
// - each graded step pins a WRONG answer that uses the right function (a tour that moves the trio to G, the
//   tour on the vibes alone, the right chord names on a silent line) and three other right answers.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 152;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** J1.L01's swing pocket: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';

/** The ii–V–I in C, four bars: J1.L05's shells (root, 3rd, 7th) on the Charleston. */
const SHELLS = "<[d3,f3,c4] [g2,f3,b3] [c3,e3,b3] [c3,e3,b3]>";
/** J1.L03's bass in two: root and 5th. */
const TWO_FEEL = "<[d2 a1] [g1 d2] [c2 g1] [c2 e2]>";
/**
 * A vibes lick over Dm7 G7 Cmaj7: every note on a beat is a chord tone (evaluated: D A A D | F B G B | E G |
 * C G E), and the 7th of G7 (F) falls to the 3rd of Cmaj7 (E) across the bar line.
 */
const LICK =
  "<[[d4 f4] [a4 c5] [a4 f4] [d4 e4]] [[f4 d4] [b3 d4] g4 [b4 f4]] [e4 ~ [g4 b4] ~] [[c5 b4] g4 e4 ~]>";

/** The trio's three pitched lines, each moved by `move` (a `.transpose(…)` call, or nothing). */
const chordsLine = (move = "") =>
  `chords: note("${SHELLS}")${move}.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.7)`;
const bassLine = (move = "") => `bass: note("${TWO_FEEL}")${move}.s("upright")`;
const lickLine = (move = "", lick = LICK) => `mel: note("${lick}")${move}.swingBy(1/3, 4).s("vibes")`;
const trio = (move = "") => [chordsLine(move), bassLine(move), lickLine(move)];
const TOUR_CALL = ".transpose(tour)";
const tourConst = (pattern: string) => `const tour = "${pattern}"`;

/** All twelve keys, four bars each: up 5 half steps every time, 12 taken off when it would climb past 8 (the bass stays between E1 and C3). */
const TWELVE = "<0!4 5!4 -2!4 3!4 8!4 1!4 6!4 -1!4 4!4 -3!4 2!4 7!4>";
const FOUR = "<0!4 5!4 -2!4 3!4>";

const IN_C = code(RIDE, HATS, ...trio());
const TOUR_FOUR = code(tourConst(FOUR), "", RIDE, HATS, ...trio(TOUR_CALL));
const TOUR_TWELVE = code(tourConst(TWELVE), "", RIDE, HATS, ...trio(TOUR_CALL));
const UP_FIVE = code(RIDE, HATS, ...trio(".transpose(5)"));

/** S4: the trio plays C, then F; the learner takes it one key further round the cycle. */
const tourAnswer = (pattern: string, lines = trio(TOUR_CALL)) =>
  code(tourConst(pattern), "", RIDE, HATS, ...lines);
const TOUR_STARTER = code('const tour = "⟪<0!4 5!4>⟫"', "", RIDE, HATS, ...trio(TOUR_CALL));
const TOUR_SOLUTION = tourAnswer("<0!4 5!4 -2!4>");
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S5: a chart written out key by key; the fifth key's four bars are the learner's. */
const CHART = "Dm7 G7 C^7 C^7 Gm7 C7 F^7 F^7 Cm7 F7 Bb^7 Bb^7 Fm7 Bb7 Eb^7 Eb^7";
/** The chart's comping and bass, both read from `changes`; `chords` appends to the comping (a `.gain(0)` pin). */
const chartLines = (chords = "") => [
  `chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")${chords}`,
  'bass: chord(changes).rootNotes(2).s("upright")',
];
const chart = (last: string, chords = "") =>
  code(`const changes = "<${CHART} ${last}>"`, "", RIDE, HATS, ...chartLines(chords));
const CHART_STARTER = code(
  `const changes = "<${CHART} ⟪Fm7 Bb7 Eb^7 Eb^7⟫>"`,
  "",
  RIDE,
  HATS,
  ...chartLines(),
);
const CHART_SOLUTION = chart("Bbm7 Eb7 Ab^7 Ab^7");

/** S6: the Band plays the drums; the learner's trio starts in C, in one key. */
const MAKE_STARTER = code(tourConst("<0>"), "", ...trio(TOUR_CALL));
const makeAnswer = (pattern: string, lines = trio(TOUR_CALL), bpm = BPM) =>
  code(tourConst(pattern), "", ...lines).replace(`setcpm(${BPM}/4)`, `setcpm(${bpm}/4)`);

/**
 * The Make's one required rule: the comping comes back, four bars later, the same shape a 4th higher (or the
 * same key a 5th lower), at least twice: three keys round the cycle of fourths. Heard: every note of the chords
 * moved by the same distance, in the same rhythm.
 */
const COMPING_TOURS: RubricRule = {
  id: "comping-tours",
  label: "The comping's four bars come back a 4th higher (5 half steps up, or 7 down), at least twice",
  required: true,
  skills: ["J05"],
  rule: "custom",
  fn: "transposed-copy",
  params: { track: "chords", unitBars: 4, semis: [5, -7], min: 2 },
};
const LICK_TOURS: RubricRule = {
  ...COMPING_TOURS,
  id: "lick-tours",
  label: "The vibes' four bars come back a 4th higher with the comping, at least twice",
  required: false,
  params: { track: "mel", unitBars: 4, semis: [5, -7], min: 2 },
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J2.L01",
  version: 3,
  title: "All Twelve Keys",
  objective: "I can move a ii–V–I round the cycle of fourths and play it in any key.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J05"],
  practises: [],
  terms: [{ id: "term.cycle-of-fourths", step: "S3" }],
  canDo: ["cd.code.ii-v-any-key"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One lick, four homes",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "tour-four", code: TOUR_FOUR, bars: 16 },
      exercise: {
        kind: "listen",
        id: "one-lick-four-homes",
        version: 1,
        role: "practice",
        prompt:
          "Listen for home, the chord each four bars land on. Notice whether it is the same chord each time or whether home keeps moving.",
        skills: [{ skill: "J05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: IN_C, caption: "The ii–V–I in C, with the lick on top.", bars: 4 },
          {
            code: TOUR_FOUR,
            caption: "The same four bars, four times over. Listen to each landing.",
            bars: 16,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Five half steps up",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "five-up",
        version: 1,
        role: "practice",
        prompt:
          "The trio of the first example, in C, with `.transpose(5)` added to every line: chords, bass and lick all move up five half steps. Predict where home is now, and pick it.",
        skills: [{ skill: "J05", w: 1 }],
        hints: null,
        tests: [],
        code: UP_FIVE,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "f", label: "F: the chords become Gm7, C7, Fmaj7" },
          { id: "g", label: "G: the chords become Am7, D7, Gmaj7" },
          { id: "c", label: "Still C: only the notes inside the chords change" },
        ],
        correct: ["f"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Twelve moves home",
      minutes: 1.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords", "circle"] },
      example: { id: "tour-twelve", code: TOUR_TWELVE, bars: 48 },
      exercise: {
        kind: "run-investigate",
        id: "twelve-moves",
        version: 1,
        role: "practice",
        prompt:
          "Run the tour and read the chord band as it goes, with the circle of fifths beside it. Each number in `tour` moves the whole trio. Then answer: which key comes straight after B♭, and how many keys the tour visits before C comes back.",
        skills: [{ skill: "J05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the chord band at bars 9 and 13, and find both keys on the circle: which way round does the tour walk?",
        },
        hints: ladder(
          "Find C and F on the circle, then the next key the chord band shows. Each move goes the same way round.",
          "Each number is the one before plus five; five half steps up from a key is the key a 4th above it.",
          "From C the tour goes to F, then to the key a 4th above F. Count the keys until home comes back.",
        ),
        code: { starter: TOUR_TWELVE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which key comes straight after B♭?",
            options: [
              { id: "eb", label: "E♭" },
              { id: "f", label: "F" },
              { id: "ab", label: "A♭" },
            ],
            correct: ["eb"],
          },
          { q: "number", prompt: "How many keys does the tour visit before C comes back?", correct: 12 },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 12, choice: ["eb"] } }, expect: "pass" },
          {
            name: "F: walked the circle the other way",
            response: { answer: { number: 12, choice: ["f"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "seven: the white keys only",
            response: { answer: { number: 7, choice: ["eb"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The next key round",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "one-key-further",
        version: 1,
        role: "check",
        prompt:
          "The trio plays its ii–V–I in C, then in F: `tour` moves every line. Add one more number to `tour` so the trio plays four more bars in the next key round the cycle. Done when bars 9 to 12 match the target.",
        skills: [{ skill: "J05", w: 1 }],
        swing: SWUNG,
        code: { starter: TOUR_STARTER },
        reference: { solutions: [TOUR_SOLUTION], bars: 12 },
        // What is heard: the chords' pitch classes and the lowest note at every onset, against the trio in C, F
        // and B♭. A tour to G, or a key that lasts one bar instead of four, fails though it uses the same call.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions" }],
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Not yet: from bar 9 the chords are not the ones of the next key round the cycle. Listen to bars 5 to 8, then to the target's bars 9 to 12: how far up does home move each time?",
        },
        hints: ladder(
          "Look at the two numbers already in `tour`: they say how far the trio moved from C to F. The next key moves the same distance again.",
          "Five half steps up each time. The third key is five half steps above F, and it lasts four bars like the others.",
          "Add one more number to `tour`: F's number plus five, written with `!4`. Taking 12 off keeps the trio low.",
        ),
        tests: [
          { name: "reference", response: { code: TOUR_SOLUTION }, expect: "pass" },
          {
            name: "B♭ an octave higher: 10",
            response: { code: tourAnswer("<0!4 5!4 10!4>") },
            expect: "pass",
          },
          {
            name: "every bar spelled out",
            response: { code: tourAnswer("<0 0 0 0 5 5 5 5 -2 -2 -2 -2>") },
            expect: "pass",
          },
          {
            name: "the interval names: 1P, 4P, 7m",
            response: { code: tourAnswer("<1P!4 4P!4 7m!4>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(TOUR_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right call, the wrong key: up a 5th from C, to G",
            response: { code: tourAnswer("<0!4 5!4 7!4>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right number for one bar only: no !4",
            response: { code: tourAnswer("<0!4 5!4 -2>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "A♭ by name",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "a-flat-by-name",
        version: 1,
        role: "check",
        prompt:
          "This chart tours C, F, B♭ and E♭, then repeats E♭ where the fifth key should be. Rewrite bars 17 to 20 of `changes` by name as the ii–V–I of the fifth key, the key a 4th above E♭. Done when those four bars match the target.",
        skills: [{ skill: "J05", w: 1 }],
        swing: SWUNG,
        code: { starter: CHART_STARTER },
        reference: { solutions: [CHART_SOLUTION], bars: 20 },
        // The chords by name are heard as their pitch classes, with the bass, at every onset (contracts §6.7).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Not yet: bars 17 to 20 do not sound like the key a 4th above E♭. Compare each chord with the same chord four bars earlier: every one moves the same distance.",
        },
        hints: ladder(
          "Count a 4th up from E♭ to find the fifth key's home. Every key in the tour is a 4th above the one before.",
          "Each chord of the new key is a 4th above the same chord of the last one: the ii, the V and the home chord all move.",
          "The home chord is A♭ major seventh. Its ii is a minor seventh a step above A♭, its V the dominant seventh a 5th above it.",
        ),
        tests: [
          { name: "reference", response: { code: CHART_SOLUTION }, expect: "pass" },
          {
            name: "sharps for flats: A♯m7 D♯7 G♯maj7",
            response: { code: chart("A#m7 D#7 G#^7 G#^7") },
            expect: "pass",
          },
          {
            name: "the home chord repeated with !2",
            response: { code: chart("Bbm7 Eb7 Ab^7!2") },
            expect: "pass",
          },
          {
            name: "the default dictionary named, the comping softer",
            response: {
              code: code(
                `const changes = "<${CHART} Bbm7 Eb7 Ab^7 Ab^7>"`,
                "",
                RIDE,
                HATS,
                'chords: chord(changes).dict("ireal").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)',
                'bass: chord(changes).rootNotes(2).s("upright")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(CHART_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "home a dominant seventh: Ab7",
            response: { code: chart("Bbm7 Eb7 Ab7 Ab7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the key before E♭, not after: Cm7 F7 B♭maj7",
            response: { code: chart("Cm7 F7 Bb^7 Bb^7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right names on a silent chords line",
            response: { code: chart("Bbm7 Eb7 Ab^7 Ab^7", ".gain(0)") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Abmaj7 is not a code spelling",
            response: { code: chart("Bbm7 Eb7 Abmaj7 Abmaj7") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your tour",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-tour",
        version: 1,
        role: "practice",
        title: "ii–V–I tour",
        prompt:
          "Take your trio on tour with `tour`. Required: start in any key, and every four bars move the comping a 4th higher, through at least three keys. Also on the checklist: the vibes lick moves with the trio, and a tempo between 120 and 200. For more, give the vibes a lick of your own.",
        skills: [{ skill: "J05", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [12, 48],
        saveAs: "sketch",
        rubric: [
          COMPING_TOURS,
          LICK_TOURS,
          {
            id: "tour-tempo",
            label: "`setcpm` sets a tempo between 120 and 200 beats a minute",
            required: false,
            skills: ["J05"],
            rule: "tempo-bpm",
            min: 120,
            max: 200,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Look for the one call that ends every line of the trio: one number pattern feeds it.",
          "Every line ends with the same move; give `tour` one number for each key, each one five half steps above the last.",
          "Three keys from C: 0, then 5, then 5 more (or 12 fewer); each lasts four bars with `!4`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: C, F, B♭", response: { code: makeAnswer("<0!4 5!4 -2!4>") }, expect: "pass" },
          { name: "all twelve keys", response: { code: makeAnswer(TWELVE) }, expect: "pass" },
          {
            name: "four keys from G: G, C, F, B♭",
            response: { code: makeAnswer("<7!4 0!4 5!4 -2!4>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: from E♭, five keys, a lick of its own, faster",
            response: {
              code: makeAnswer(
                "<3!4 8!4 1!4 6!4 -1!4>",
                [
                  chordsLine(TOUR_CALL),
                  bassLine(TOUR_CALL),
                  lickLine(TOUR_CALL, "<[a4 c5 a4 f4] [b4 ~ g4 f4] [e4 g4 b4 c5] [b4 ~ ~ ~]>"),
                ],
                184,
              ),
            },
            expect: "pass",
          },
          {
            name: "the right call down whole steps: C, B♭, A♭ (not the cycle)",
            response: { code: makeAnswer("<0!4 -2!4 -4!4>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the cycle walked the other way: C, G, D",
            response: { code: makeAnswer("<0!4 7!4 2!4>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "two keys only",
            response: { code: makeAnswer("<0!4 5!4>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the comping toured but more than 24 dB under the vibes: not heard",
            response: {
              code: makeAnswer("<0!4 5!4 -2!4>").replace('s("rhodes").gain(.7)', 's("rhodes").gain(.04)'),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the tour on the vibes alone: the comping stays in C",
            response: {
              code: makeAnswer("<0!4 5!4 -2!4>", [chordsLine(), bassLine(), lickLine(TOUR_CALL)]),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
