// U06.L05 Hear the Bass First. The bass is the easiest line to pick out of a loop, and under a loop of
// triads in root position it spells the chords: its notes are their roots. Hear it first, sing it, write it
// down in degrees, and the progression follows (a root bass of 1 5 6 4 is I V vi IV). What the learner has:
// the seven triads of a key and `.add(n(…))` (U06.L01), Roman numerals (U06.L02), what the chords do
// (U06.L03) and endings (U06.L04); the bass clef and the grand staff (U05.L06); sung degrees on syllables
// (U03.L08); by-ear transcription with A/B (U03.L10). Not yet: loops with a name (schema, U06.L06), whole
// loops in stages (U06.L09). Spec: content/specs/U06.md.
//
// Shapes: the sung roots are a `sing` step in `mode: "degree"` that never gates and falls back to naming the
// degrees in Quiet mode (`fallback: "identify"`, contracts §7.6, §8); the ear step seeds `fam.har.bass`; the
// by-ear bass is graded octave-free on the `bass` track only (`accepts: "any-octave"`), so the chords of the
// source are heard but never written; the Make's required rule reads the chords under the bass
// (`chord-tones-strong` on the starter's `chords:` line; see MAKE_STARTER for why not the Band's).
import { type AnswerUi, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A bass line in degrees of C, from C2. */
const bassN = (pattern: string, sound = "ebass", extra = "") =>
  `bass: n("${pattern}").scale("C2:major").s("${sound}").lpf(800)${extra}`;
/** One triad on each root of `roots` (n values, one a bar), stacked with U06.L01's `.add()`. */
const triads = (roots: string, scale = "C3:major") =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("${scale}").s("piano").gain(.5)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** I V vi IV: roots on degrees 1, 5, 6 and 4 (n 0, 4, 5, 3), one chord a bar. */
const AXIS = "<0 4 5 3>";
/**
 * The hook's pick bass: each chord's root on beat 1 and on the "and" of beats 1, 2 and 3, then one note on
 * beat 4 that leads on: G under C, D under G, E under Am (the chord's 5th), and G under F, back toward C.
 * C2 C2 C2 C2 G2 | G2 G2 G2 G2 D2 | A2 A2 A2 A2 E2 | F2 F2 F2 F2 G2.
 */
const DRIVE = "<[0 0 ~ 0 ~ 0 4 ~] [4 4 ~ 4 ~ 4 1 ~] [5 5 ~ 5 ~ 5 2 ~] [3 3 ~ 3 ~ 3 4 ~]>";
const HOOK = code(bassN(DRIVE), triads(AXIS));
const BASS_ALONE = code(bassN(DRIVE));
/** S2: what the learner sings, played first: the roots, one a bar, under the chords. */
const ROOTS = code(bassN(AXIS), triads(AXIS));

/** S4, by ear: a new loop, I vi IV V (C Am F G), the bass on the roots, one a bar. */
const HEARD = "<0 5 3 4>";
const HEARD_SOURCE = code(bassN(HEARD), triads(HEARD));
const HEARD_STARTER = code(bassN("<⟪0 0 0 0⟫>"));
const HEARD_STARTER_PLAIN = code(bassN("<0 0 0 0>"));
/** Degrees and rhythm of the bass track decide; any octave passes. The chords are not compared. */
const BY_EAR_MATCHER: Matcher = {
  m: "melody",
  pitch: "octave-free",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 16],
  track: "bass",
};
/** S5: the same loop on the page: chords on the treble staff (from C4), the bass on the bass staff. */
const ON_THE_PAGE = code(bassN(HEARD), triads(HEARD, "C4:major"));

/**
 * The Make: the four-chord loop as a `chords:` line, and C under every bar. C is a note of C, Am and F, but
 * not of G, so bar 2 misses. The chords are the learner's code, not the Band's: the grader is not given the
 * Band's code (neither content:check nor the app passes `ctx.band`), so `harmony: "band.chords"` reads no
 * chords at all; the rule reads this line instead, and the Band plays drums only.
 */
const MAKE_CHORDS = 'chords: chord("<C G Am F>").voicing().s("piano").gain(.5)';
const make = (bass: string) => code(bass, MAKE_CHORDS);
const MAKE_STARTER = make(bassN("[0 ~ ~ 0 ~ ~ 0 ~]"));

/** The Band's drums only: the hook brings its own bass and chords. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const GRAND = { roll: false, staff: "grand", keyboard: false } as const;
/** Bass degrees, entered in order, on syllables. */
const PAD: AnswerUi = {
  ui: "degree-pad",
  set: ["1", "2", "3", "4", "5", "6", "7"],
  sequenceLen: 4,
  syllables: true,
};

export default defineLesson({
  id: "U06.L05",
  version: 4,
  title: "Hear the Bass First",
  objective:
    "I can pick the bass out of a chord loop, sing its roots and write them down in degrees: a root bass of 1 5 6 4 spells I V vi IV.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["E09", "V05"],
  practises: [],
  terms: [],
  canDo: ["cd.hear.bass", "cd.sing.bass"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Under the chords",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "under-the-chords",
        version: 1,
        role: "practice",
        prompt:
          "A pick bass drives eighths under the four-chord loop. Listen for the note it keeps returning to in each bar. Then the bass alone: follow it with your voice, under your breath.",
        skills: [{ skill: "E09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "The four-chord loop, a pick bass under it.",
            bars: 4,
          },
          { code: BASS_ALONE, caption: "The bass alone, with the drums. Hum along.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "sing",
      title: "Sing the roots",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-roots",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the loop with its roots, one a bar. Then sing four notes, one a bar, one syllable each: do, sol, la, fa. Sing in your own range: your voice does not need to reach the bass.",
        skills: [
          { skill: "V05", w: 0.7 },
          { skill: "E09", w: 0.3 },
        ],
        hints: [
          { text: "Hum do first, the note the loop starts on. Hold it before you move." },
          {
            text: "Sol is a 5th above do. La sits one step above sol, and fa one step below it.",
          },
          { text: "Hear the roots again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the four degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: ROOTS, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["1", "5", "6", "4"] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S3",
      kind: "ear",
      title: "Which degrees?",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-degrees",
        version: 1,
        role: "check",
        prompt:
          "A loop of four chords plays with its bass, not always in C. Enter the bass note of each of the four bars as a degree, in order.",
        skills: [{ skill: "E09", w: 1 }],
        hints: [
          { text: "Hum the lowest note of each bar, and find home first: the note the loop rests on." },
          {
            text: "Sing down from each bass note to do and count the steps, both ends included: that is its degree.",
          },
          {
            text: "Hear it again, slower, and sing each bass note as it arrives.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.har.bass", level: 1 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: PAD,
        correct: {},
        srs: [{ family: "fam.har.bass", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S4",
      kind: "dictate",
      title: "Take down the bass",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "take-down-the-bass",
        version: 1,
        role: "check",
        prompt:
          "A new loop plays, one chord a bar, its bass on the roots. Replace the four 0s with the bass line in `n`, one note a bar. Leave the chords out of your code. Done when your four notes match the bass, in any octave.",
        skills: [
          { skill: "E09", w: 0.7 },
          { skill: "H01", w: 0.3 },
        ],
        hints: ladder(
          "Hum the lowest note of each bar and notice whether it goes up or down from the bar before.",
          "Sing down from each bass note to do and count: that is its degree. `n` counts from 0, so write the degree minus one.",
          "Bar 1 is home, `n` 0, and bar 2 sits on la, degree 6. Two bars to go.",
        ),
        domain: "bass",
        stimulus: { src: "code", code: HEARD_SOURCE, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: HEARD_STARTER },
        reference: { solutions: [code(bassN(HEARD))], bars: 4 },
        matcher: BY_EAR_MATCHER,
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "any-octave" },
        srs: [{ family: "fam.har.bass", mode: "evidence-only" }],
        // The catalog says "the melody has"; here the line is the bass. A whole line one degree high is the
        // degrees typed as `n`: it sounds like the same line in D, and the catalog would say "move every
        // note 2 semitones down", which is true of the sound and no help with the code.
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: you have {got} ({gotSyl}); the bass has {exp} ({expSyl}). Sing both down to do and count again.",
          "melody.wrong-key":
            "Every note is one degree high: the shape is right. You wrote the degrees; `n` counts from 0, so write each degree minus one.",
        },
        tests: [
          { name: "reference", response: { code: code(bassN(HEARD)) }, expect: "pass" },
          {
            name: "the roots an octave higher, on an upright",
            response: { code: `${TEMPO}bass: n("${HEARD}").scale("C3:major").s("upright").lpf(800)` },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: HEARD_STARTER_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "bar 2 a degree off: 5 for 6",
            response: { code: code(bassN("<0 4 3 4>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the degrees written as n: 1 6 4 5",
            response: { code: code(bassN("<1 6 4 5>")) },
            expect: "fail",
            feedback: ["melody.wrong-key"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "see",
      title: "On the page",
      minutes: 0.5,
      ui: { panels: GRAND, staffLabels: "degree" },
      example: { id: "on-the-page", code: ON_THE_PAGE, bars: 4 },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your own bass line",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-own-bass-line",
        version: 1,
        role: "practice",
        prompt:
          "Your loop plays the part after your song's first loud part. The `chords` line plays I V vi IV, and the `bass` line plays only C. Change the bass so that on beat 1 of every bar it plays a note of that bar's chord; between, anything you like. Done when every beat 1 has a note of its chord.",
        skills: [
          { skill: "E09", w: 0.5 },
          { skill: "H01", w: 0.5 },
        ],
        // The catalog's detail counts "chord tones" (U07.L03's term) in percent; the same text serves the
        // suggestions, so it says only "not yet" and the label carries the point.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "chord-note-on-one",
            label: "On beat 1 of every bar, `bass` plays a note of that bar's chord",
            required: true,
            skills: ["E09", "H01"],
            rule: "chord-tones-strong",
            melody: "bass",
            harmony: "chords",
            strength: "downbeat",
            minRatio: 1,
            // Every beat 1 needs a note (review finding theory-d 2: a bass only in bar 1 passed, the empty
            // downbeats never counted).
            cover: true,
          },
          {
            id: "low",
            label: "Every note of `bass` between `c1` and `c3`",
            required: false,
            skills: ["E09"],
            rule: "range",
            track: "bass",
            within: ["c1", "c3"],
          },
          {
            id: "four-notes",
            label: "At least four different notes in `bass`",
            required: false,
            skills: ["E09"],
            rule: "distinct-pitches",
            track: "bass",
            min: 4,
          },
        ],
        hints: ladder(
          "Find the chord in each bar first: the `chords` line names them, one a bar.",
          "The chords go I V vi IV, so their roots are degrees 1, 5, 6 and 4. `n` counts from 0.",
          "Bar 1 can stay on C. Bar 2's chord is G: put `n` 4 on its first beat.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the roots, one a bar",
            response: { code: make(bassN(AXIS)) },
            expect: "pass",
          },
          {
            name: "a 5th on every beat 1 instead",
            response: { code: make(bassN("<4 1 2 0>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the hook's drive with steps into each change, on an upright",
            response: {
              code: code(
                bassN("<[0 0 ~ 0 ~ 2 3 ~] [4 4 ~ 4 ~ 4 6 ~] [5 5 ~ 5 ~ 5 4 ~] [3 3 ~ 3 ~ 3 2 1]>", "upright"),
                'chords: chord("<C G Am F>").voicing().s("rhodes").gain(.5)',
                'mel: n("<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>").scale("C4:major").s("piano")',
              ),
            },
            expect: "pass",
          },
          {
            // Review finding (theory-d 2): the root in bar 1, then nothing on beat 1 of bars 2 to 4.
            name: "one note in bar 1, the other bars empty",
            response: { code: make(bassN("<0 ~ ~ ~>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the 3rd on beat 1, then a walk to the next chord",
            response: { code: make(bassN("<[2 ~ 1 0] [6 ~ 5 4] [0 ~ 6 5] [5 ~ 4 3]>")) },
            expect: "pass",
          },
          {
            name: "a rest after each beat-1 root",
            response: { code: make(bassN("<[0 ~ ~ 4] [4 ~ ~ 1] [5 ~ ~ 2] [3 ~ ~ 0]>")) },
            expect: "pass",
          },
          {
            name: "the roots of another loop, I vi IV V",
            response: { code: make(bassN(HEARD)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
