// J1.L03 The Major ii–V–I (spec: content/specs/J1.md). Dm7, G7, Cmaj7: the minor seventh on 2, the dominant seventh
// on 5, home on 1. Each root falls a 5th (or climbs a 4th, the same letter), each chord pulls into the next, and the
// three together are one gesture, the ii–V–I, the sentence most jazz tunes are made of.
//
// Written for the learner at the gate (AUTHORING §20.1): J1 may be taken with U14–U17 unfinished, so the lesson uses
// only what U13.CP guarantees plus J1's unlocks (the jazz kit, the vibraphone). No secondary dominants by name: the
// second key of the Make is reached by writing its ii–V–I, never by naming the chord that leads there.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S5 reads what is HEARD: the comping's pitch classes and lowest note at every onset (`pcset`), so a dominant
//   where home should be a major seventh, the gesture moved to the wrong key, or the right names on a silent line
//   all fail;
// - the Make's one required rule is the gesture itself in order (`contains-rn` `inOrder`, read at seventh depth for
//   numerals written with a 7): a ii–V that lands on vi, the right letters as plain triads, or the three chords in
//   the wrong order fail;
// - each graded step pins a wrong answer that uses the right function and three other right answers.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 132;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const C_MAJOR = { tonic: "C", mode: "major" } as const;
const B_FLAT_MAJOR = { tonic: "Bb", mode: "major" } as const;
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** J1.L01's swing pocket: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';

/** The trio of J1.L01 in C: a bass in two (root and 5th), Rhodes comping on the Charleston, a vibes line. */
const BASS_C = 'bass: note("<[d2 a1] [g1 d2] [c2 g1] [c2 e2]>").s("upright")';
const COMP_C =
  'chords: chord("<Dm7 G7 C^7 C^7>").dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)';
/** F A C | D F | E G B G | E: every note on a beat is in its chord (evaluated in J1.L01). */
const VIBES_C =
  'mel: n("<[3 ~ 5 0] [1 ~ 3 ~] [2 4 6 4] [2 ~ ~ ~]>").scale("C4:major").swingBy(1/3, 4).s("vibes")';
const TRIO_C = code(RIDE, HATS, BASS_C, COMP_C, VIBES_C);
/** The vibes line a 4th higher, in note names (the lesson's key is C): B♭ D F | G B♭ | A C E C | A. */
const VIBES_F = "<[bb4 ~ d5 f4] [g4 ~ bb4 ~] [a4 c5 e5 c5] [a4 ~ ~ ~]>";
/** The same trio in F: the vibes a 4th higher, the bass a 5th lower (evaluated: B♭ D F | G B♭ | A C E C | A, chord tones on the beats). */
const TRIO_F = code(
  RIDE,
  HATS,
  'bass: note("<[g1 d2] [c2 g1] [f1 c2] [f1 a1]>").s("upright")',
  'chords: chord("<Gm7 C7 F^7 F^7>").dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)',
  `mel: note("${VIBES_F}").swingBy(1/3, 4).s("vibes")`,
);

/** Lines that read one chord string: the bass on each root on 1 and 3, the comping on the Charleston. */
const changesConst = (bars: string) => `const changes = "<${bars}>"`;
const BASS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")';
const comp = (extra = "") =>
  `chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")${extra}`;

/** S4: the ii–V–I in B♭, by name, for the learner to number. */
const IN_B_FLAT = code(changesConst("Cm7 F7 Bb^7 Bb^7"), "", RIDE, HATS, BASS, comp());

/** S5: the gesture in C; the learner moves it to F. */
const MOVE_STARTER = code(`const changes = "<⟪Dm7 G7 C^7 C^7⟫>"`, "", RIDE, HATS, BASS, comp());
const moved = (bars: string, extra = "") => code(changesConst(bars), "", RIDE, HATS, BASS, comp(extra));
const MOVE_SOLUTION = moved("Gm7 C7 F^7 F^7");
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S7: the Band plays the drums; the learner's trio starts on a loop that never makes the gesture. */
const makeTrio = (bars: string, ...more: string[]) => code(changesConst(bars), "", BASS, comp(), ...more);
const MAKE_STARTER = makeTrio("C^7 Am7 F^7 G7");
/** The vibes line of S1 over eight bars: in C for the first four, a 4th higher in F for the next. */
const VIBES_TWO_KEYS = `mel: note("<[f4 ~ a4 c4] [d4 ~ f4 ~] [e4 g4 b4 g4] [e4 ~ ~ ~] ${VIBES_F.slice(1, -1)}>").swingBy(1/3, 4).s("vibes")`;

/**
 * The Make's one required rule: a minor seventh, then the dominant seventh a 4th above it, then the chord a 5th
 * below that dominant, all read on the comping line itself (`harmony: "chords"`): a ii–V that lands on vi, the
 * three in the wrong order, plain triads, or the right names on a silent line fail. The bass reads `changes` too,
 * so a rule that read every track would hear the gesture in the bass's roots alone.
 */
const TWO_FIVE_ONE: RubricRule = {
  id: "two-five-one",
  label: "A ii–V–I: a minor seventh, the dominant a 4th above it, then home",
  required: true,
  skills: ["J04"],
  rule: "custom",
  fn: "ii-v-chain",
  params: { harmony: "chords", minKeys: 1, minPairs: 1, resolved: 0.5 },
};
/** A suggestion: the second key of the brief, a second ii–V–I aimed at another home. */
const TWO_KEYS: RubricRule = {
  id: "two-keys",
  label: "A second ii–V–I, into another key",
  required: false,
  skills: ["J04"],
  rule: "custom",
  fn: "ii-v-chain",
  params: { harmony: "chords", minKeys: 2, minPairs: 2, resolved: 0.5 },
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the bass are the learner's, so the rule reads them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J1.L03",
  version: 4,
  title: "The Major ii–V–I",
  objective: "I can hear a ii–V–I as one gesture and write one in a major key.",
  key: C_MAJOR,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J04"],
  practises: [],
  terms: [{ id: "term.ii-v-i", step: "S3" }],
  canDo: ["cd.hear.ii-v-i"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three chords, one pull",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "trio-in-c", code: TRIO_C, bars: 4 },
      exercise: {
        kind: "listen",
        id: "three-chords-one-pull",
        version: 1,
        role: "practice",
        prompt:
          "Listen for the bar where each take comes to rest. Then notice how the two bars before it feel: settled, or on their way somewhere.",
        skills: [{ skill: "J04", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: TRIO_C,
            caption: "The trio in C.",
            bars: 4,
          },
          {
            code: TRIO_F,
            caption: "The same four bars, with F as home.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Where does it land?",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "where-does-it-land",
        version: 1,
        role: "practice",
        prompt:
          "The trio plays Dm7 for a bar, then G7. Hum where the next chord should go, then pick the chord your ear expects. Run it to check.",
        skills: [{ skill: "J04", w: 1 }],
        hints: null,
        tests: [],
        code: TRIO_C,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "cmaj7", label: "Cmaj7: home" },
          { id: "am7", label: "Am7" },
          { id: "fmaj7", label: "Fmaj7" },
        ],
        correct: ["cmaj7"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Numbers and roots",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "the-gesture", code: TRIO_C, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "numbers-and-roots",
        version: 1,
        role: "practice",
        prompt:
          "Run the trio and answer two questions. First, read the numerals the chord band shows for bars 1 to 3, in C major. Second, count the half steps the bass falls from its first note in bar 1 to its first note in bar 2.",
        skills: [{ skill: "J04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the numerals under bars 1 to 3 one more time, then count the half steps from the bass's first note in bar 1 down to its first note in bar 2.",
        },
        hints: ladder(
          "Find the degree of C major each chord stands on, and which kind of seventh it is. The numeral shows both.",
          "D is degree 2, G is 5, C is 1. A minor seventh is lower case with a 7, a dominant seventh capital with a 7, a major seventh capital with maj7.",
          "The bass starts bar 1 on D and bar 2 on the G below it. Count the half steps down, D to C♯ is one.",
        ),
        code: { starter: TRIO_C },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which numerals does the chord band show for bars 1, 2 and 3?",
            options: [
              { id: "two-five-one", label: "ii7, V7, Imaj7" },
              { id: "three-six-four", label: "iii7, vi7, IVmaj7" },
              { id: "six-two-five", label: "vi7, ii7, V7" },
            ],
            correct: ["two-five-one"],
          },
          {
            q: "number",
            prompt: "The bass falls from D in bar 1 to G in bar 2. How many half steps down?",
            correct: 7,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 7, choice: ["two-five-one"] } },
            expect: "pass",
          },
          {
            name: "five: counted up from D to G",
            response: { answer: { number: 5, choice: ["two-five-one"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "read from the wrong home: vi7 ii7 V7",
            response: { answer: { number: 7, choice: ["six-two-five"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Number it in B♭",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "number-it-in-b-flat",
        version: 1,
        role: "check",
        key: B_FLAT_MAJOR,
        prompt:
          "The trio plays the gesture in B♭ major: Cm7, F7, then B♭maj7 for two bars. Write the numeral of each of the first three chords in B♭ major, with its seventh: the case shows the kind of chord, and the ending shows the seventh.",
        skills: [{ skill: "J04", w: 1 }],
        hints: ladder(
          "Find the degree of B♭ major each chord stands on: count up the scale from B♭.",
          "Count up B♭ major from B♭: B♭ is 1, C is 2, D is 3, and so on. The case and the ending follow the kind of seventh.",
          "Cm7 stands on 2 and is a minor seventh: lower case with a 7. Do the same for the next two.",
        ),
        stimulus: { src: "code", code: IN_B_FLAT, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 3, allow: ["sevenths"], labels: ["Bar 1", "Bar 2", "Bar 3"] },
        correct: { rn: ["ii7", "V7", "Imaj7"] },
        // The catalog texts name the right numeral; these name the place and what to listen for instead.
        feedbackText: {
          "harmony.rn-degree":
            "Chord {slot}: {got} is built on degree {gotDeg} ({gotChord}). Count up B♭ major from B♭ to find where this chord stands.",
          "harmony.rn-quality":
            "Chord {slot}: the right degree, but it is not a {gotQ} chord. Read its symbol again: which kind of seventh chord is it?",
        },
        tests: [
          { name: "ii7 V7 Imaj7", response: { answer: { rn: ["ii7", "V7", "Imaj7"] } }, expect: "pass" },
          {
            name: "ii V I: the sevenths left off",
            response: { answer: { rn: ["ii", "V", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "IImaj7: the first chord read as major",
            response: { answer: { rn: ["IImaj7", "V7", "Imaj7"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "I7 for Imaj7: home read as a dominant",
            response: { answer: { rn: ["ii7", "V7", "I7"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "numbered in C: vi7 for ii7",
            response: { answer: { rn: ["vi7", "V7", "Imaj7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Home on F",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "home-on-f",
        version: 1,
        role: "check",
        prompt:
          "The trio plays the ii–V–I in C. Rewrite `changes` so home is F: the same three kinds of chord, built on degrees 2, 5 and 1 of F major. The bass reads `changes` too, so change only that string. Done when the four bars match the target.",
        skills: [{ skill: "J04", w: 1 }],
        swing: SWUNG,
        code: { starter: MOVE_STARTER },
        reference: { solutions: [MOVE_SOLUTION], bars: 4 },
        // A chord is its notes: the comping's pitch classes and lowest note at every onset (contracts §6.7). Home
        // as a dominant, the gesture moved a 5th up instead of a 4th, or the right names on a silent line all fail.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: not the chord the target plays there. Count F major up from F to find degrees 2 and 5, and check which kind of seventh each degree takes.",
        },
        hints: ladder(
          "Count F major up from F to find the letters on degrees 2, 5 and 1. Each becomes the root of one chord.",
          "F major counts F, G, A, B♭, C, D, E. The chord on 2 is a minor seventh, the one on 5 a dominant seventh, home a major seventh.",
          "Bar 1 becomes `Gm7`; bars 3 and 4 are home, written with `^7`.",
        ),
        tests: [
          { name: "reference", response: { code: MOVE_SOLUTION }, expect: "pass" },
          { name: "home repeated with !2", response: { code: moved("Gm7 C7 F^7!2") }, expect: "pass" },
          { name: "bar 4 as an alternation", response: { code: moved("Gm7 C7 F^7 <F^7>") }, expect: "pass" },
          {
            name: "each bar in brackets",
            response: { code: moved("[Gm7] [C7] [F^7] [F^7]") },
            expect: "pass",
          },
          { name: "F spelled E♯", response: { code: moved("Gm7 C7 E#^7 E#^7") }, expect: "pass" },
          {
            name: "unchanged: still in C",
            response: { code: plain(MOVE_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "home a dominant seventh: F7",
            response: { code: moved("Gm7 C7 F7 F7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the gesture moved a 5th up, home on G",
            response: { code: moved("Am7 D7 G^7 G^7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right names on a silent comping line",
            response: { code: moved("Gm7 C7 F^7 F^7", ".gain(0)") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Fmaj7 is not a code spelling",
            response: { code: moved("Gm7 C7 Fmaj7 Fmaj7") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Does it land?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "does-it-land",
        version: 1,
        role: "check",
        prompt:
          "Four-bar phrases in different keys, one at a time. Each starts at home. For each, pick whether it ends with a ii–V–I or with something close to one.",
        skills: [{ skill: "J04", w: 1 }],
        hints: [
          {
            text: "Listen to the last three chords. Check that the phrase comes home, and which chord comes just before the V.",
          },
          {
            text: "A ii–V–I ends on the chord of bar 1. The near misses either land somewhere else after the V, or reach home from another chord than ii.",
          },
          {
            text: "Hear it again, slower, and hum the bass of the last three chords: in a ii–V–I it moves down a 5th (or up a 4th), then the same again, onto home.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        // Level 1: the phrase ends with a ii–V–I, or with ii–V–vi or IV–V–I, in a key with up to two accidentals.
        stimulus: { src: "generator", family: "fam.jzz.ii-v", level: 1 },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "ii-V-I", label: "It ends with a ii–V–I" },
            { id: "other", label: "It ends some other way" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.jzz.ii-v", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Land it twice",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "land-it-twice",
        version: 1,
        role: "practice",
        title: "Two landings",
        prompt:
          "Rewrite `changes` as the eight bars of your song's solo section. Required: at least one ii–V–I, a minor seventh, then the dominant seventh a 4th above it, then home. Also on the checklist: a second ii–V–I into another key (F is close). For more, a sixth chord as home, or a vibes line to solo over your chords.",
        skills: [{ skill: "J04", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 16],
        saveAs: "sketch",
        rubric: [TWO_FIVE_ONE, TWO_KEYS],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with the gesture into C: three chords, each in its own bar or longer.",
          "A minor seventh on degree 2, a dominant seventh on 5, then home as a major seventh, each in its own bar or longer.",
          "The first four bars could be the S1 trio's chords; the next four the same gesture with F as home, as in S5.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one ii–V–I into C",
            response: { code: makeTrio("Dm7 G7 C^7 C^7") },
            expect: "pass",
          },
          {
            name: "into C, then into F",
            response: { code: makeTrio("Dm7 G7 C^7 C^7 Gm7 C7 F^7 F^7") },
            expect: "pass",
          },
          {
            name: "beyond the brief: into C and F with the vibes line, faster",
            response: {
              code: makeTrio("Dm7 G7 C^7 C^7 Gm7 C7 F^7 F^7", VIBES_TWO_KEYS).replace(
                `setcpm(${BPM}/4)`,
                "setcpm(168/4)",
              ),
            },
            expect: "pass",
          },
          {
            name: "two bars each for ii and V, then into B♭",
            response: { code: makeTrio("Dm7 Dm7 G7 G7 C^7 C^7 Cm7 F7 Bb^7 Bb^7") },
            expect: "pass",
          },
          {
            name: "a ii–V that lands on vi",
            response: { code: makeTrio("Dm7 G7 Am7 Am7") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right letters as plain triads",
            response: { code: makeTrio("Dm G C C").replace('dict("lefthand").', "") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "home as a sixth chord, the way the band's chords end",
            response: { code: makeTrio("Dm7 G7 C6 C6").replace('dict("lefthand").', "") },
            expect: "pass",
          },
          {
            name: "I vi ii V looped: G7 lands on bar 1's Cmaj7 each time round",
            response: { code: makeTrio("C^7 Am7 Dm7 G7") },
            expect: "pass",
          },
          {
            name: "the right names on a silent comping line: only the bass's roots are heard",
            response: { code: makeTrio("Dm7 G7 C^7 C^7").replace('s("rhodes")', 's("rhodes").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the comping more than 24 dB under the bass: not heard",
            response: { code: makeTrio("Dm7 G7 C^7 C^7").replace('s("rhodes")', 's("rhodes").gain(.04)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the three chords in the wrong order",
            response: { code: makeTrio("G7 Dm7 C^7 C^7") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
