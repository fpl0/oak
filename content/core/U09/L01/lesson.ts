// U09.L01 Phrases Make Sections. Bars group the way beats do: four bars make a phrase, and the first bar of
// each four feels strong, like beat 1 of a bar (hypermeter). Two phrases that belong together, a question
// and its answer, make an eight-bar section. A crash on bar 1 of each phrase, `s("<cr ~ ~ ~>")`, marks the
// grouping: `< >` with four steps takes four bars to come round. What the learner has: counting four beats
// in a bar (U01.L02), `< >` one step a bar (U01.L07), the question and the answer over `band.phrase-8bar`
// (U07.L06), C2's eight bars that loop and land, chord stacks in degrees (U05.L01). Not yet: two sections
// that contrast, `arrange()` and the names verse and chorus (U09.L02), the bridge and other forms (U09.L03).
// Spec: content/specs/U09.md.
//
// How it grades: the crash step is an `events` match on the `perc` track by drum role over the eight bars
// (one-shots: onsets only). The ear step is a fixed sixteen-bar stimulus, written without `arrange()` (it
// unlocks next lesson), answered with the bar buttons. The Make's one required rule is `motif-reuse` on the
// tune, two-bar units, `shape: "either"`: bars 5–6 repeat bars 1–2 (or move them by step), which is "the
// answer starts like the question" as U07.CP measures it. The Band plays the eight-bar phrase on every
// track; the tune and the crash are the learner's.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Tap times in seconds from the start of the stimulus: one every `every` beats. */
const beatTimes = (n: number, every = 1, offset = 0) =>
  Array.from({ length: n }, (_, i) => Number(((i * every + offset) * (60 / BPM)).toFixed(3)));

/** The phrase's chords, I IV I V | I IV V I (the Band's harmony), stacked an octave under the tune. */
const CHORDS =
  'chords: n("<[0,2,4] [3,5,7] [0,2,4] [4,6,8] [0,2,4] [3,5,7] [4,6,8] [0,2,4]>").scale("C3:major").s("rhodes")';
/** A tune in degrees of C, one bracket a bar. */
const mel = (bars: readonly string[], sound = "piano") =>
  `mel: n("<${bars.join(" ")}>").scale("C4:major").s("${sound}")`;
/**
 * The question stops open on 2 over V (C E G E | F A F | E G E C | D); the answer starts the same way and
 * comes home (… | D F D B | C). Beats 1 and 3 are chord tones in every bar.
 */
const QUESTION = ["[0 2 4 2]", "[3 5 3 ~]", "[2 4 2 0]", "[1 ~ ~ ~]"] as const;
const ANSWER = ["[0 2 4 2]", "[3 5 3 ~]", "[1 3 1 -1]", "[0 ~ ~ ~]"] as const;
const TUNE = mel([...QUESTION, ...ANSWER]);
/** A crash on bar 1 of each four-bar phrase. */
const CRASH = 'perc: s("<cr ~ ~ ~>")';
const PLAIN = code(CHORDS, TUNE);
const HOOK = code(CHORDS, TUNE, CRASH);

/** S4: a kick on beat 1 of every bar, the beat the learner taps, under quiet hats. No Band: its kick plays more. */
const TAP_STIMULUS = code('kick: s("bd ~ ~ ~")', 'hats: s("hh*8").gain(.3)', CHORDS, TUNE);

/** S5: the crash on every bar; the learner marks the phrases. */
const crash = (pattern: string) => code(CHORDS, TUNE, `perc: s("${pattern}")`);
const CRASH_STARTER = crash("⟪cr⟫");
const CRASH_SOLUTION = crash("<cr ~ ~ ~>");
const CRASH_MATCH: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  sound: "drum-role",
  tracks: ["perc"],
};

/**
 * S6: sixteen bars in two eight-bar sections, each two four-bar phrases, no crash. The first section is the
 * hook; the second moves to IV V I I and its tune sits higher (A C5 | B G | C5 E5 C5 | C5, then
 * A C5 | B D5 | E5 C5 G | C5), every note on beats 1 and 3 a chord tone. It starts at bar 9.
 */
const SECOND = [
  "[5 ~ 7 5]",
  "[6 ~ 4 ~]",
  "[7 ~ 9 7]",
  "[7 ~ ~ ~]",
  "[5 ~ 7 5]",
  "[6 ~ 8 ~]",
  "[9 ~ 7 4]",
  "[7 ~ ~ ~]",
];
const SONG = code(
  'kick: s("bd ~ bd ~")',
  'snare: s("~ sd ~ sd")',
  'hats: s("hh*8").gain(.4)',
  'bass: n("<0 3 0 4 0 3 4 0 3 4 0 0 3 4 0 0>").scale("C2:major").s("ebass").lpf(600)',
  'chords: n("[0,2,4]").add(n("<0 3 0 4 0 3 4 0 3 4 0 0 3 4 0 0>")).scale("C3:major").s("piano").gain(.6)',
  mel([...QUESTION, ...ANSWER, ...SECOND]),
);

/**
 * The Make: the question the learner kept in U07.L06's Make, G E G | A F A | G E | D, on its own. Over the
 * Band's eight bars it asks twice and never answers; its bars 3–4 sit without a rub over V and I, where the
 * replay puts them (the hook's question would put C against B in bar 7). Written as four bars and not as the
 * question plus four bars of rest: the motif check reads a line with trailing rests over a longer window than
 * its period and finds the question's replay as reuse, so a starter with rests would pass the required rule
 * unchanged.
 */
const MAKE_Q = ["[4 ~ 2 4]", "[5 ~ 3 5]", "[4 ~ 2 ~]", "[1 ~ ~ ~]"] as const;
const MAKE_STARTER = code(mel(MAKE_Q));
/** Wrong: the question written out twice. One pass of the line is four bars, and nothing in it repeats. */
const MAKE_TWICE = code(mel([...MAKE_Q, ...MAKE_Q]));
/** The answer starts like the question (bars 5–6) and lands home: G D over V, then C. */
const MAKE_MINIMAL = code(mel([...MAKE_Q, MAKE_Q[0], MAKE_Q[1], "[4 ~ 1 ~]", "[0 ~ ~ ~]"]));
/** Beyond the brief: a new question and its answer (the hook's), the crash on each phrase, hats on top. */
const MAKE_BEYOND = code('hats: s("hh*8").gain(.3)', CRASH, mel([...QUESTION, ...ANSWER]));
/** Wrong: the second phrase has nothing in common with the first. */
const MAKE_UNRELATED = code(mel([...MAKE_Q, "[4 ~ 4 ~]", "[5 ~ ~ 5]", "[4 ~ 1 ~]", "[0 ~ ~ ~]"]));

/** The Band's eight-bar phrase, I IV I V | I IV V I. */
const BAND = { band: "band.phrase-8bar" } as const;
/** The chords are in the code: the Band adds drums and its bass on the same roots. */
const BAND_DRUMS_BASS = { band: "band.phrase-8bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U09.L01",
  version: 4,
  title: "Phrases Make Sections",
  objective: "I can hear where a section starts and count a song in four- and eight-bar phrases.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["F01"],
  terms: [{ id: "term.hypermeter", step: "S3" }],
  canDo: ["cd.hear.sections"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Where it breathes",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND_DRUMS_BASS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "where-it-breathes",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops for the bar where the music takes a breath. In loop 2, notice which bars the crash falls on.",
        skills: [{ skill: "F01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, caption: "Eight bars: a question and its answer.", bars: 8 },
          { code: HOOK, caption: "The same eight bars with a crash cymbal added.", bars: 8 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Read the crash",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "read-the-crash",
        version: 1,
        role: "practice",
        prompt:
          'Predict how often the crash plays, then pick it. The crash line is `perc: s("<cr ~ ~ ~>")`, and `< >` plays one of its steps in each bar.',
        skills: [{ skill: "F01", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "every-four", label: "Once every four bars" },
          { id: "every-bar", label: "Once in every bar" },
          { id: "four-a-bar", label: "Four times in every bar" },
        ],
        correct: ["every-four"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Count the phrases",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND_DRUMS_BASS },
      example: { id: "count-the-phrases", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "count-the-phrases",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop and watch the roll each time the crash hits. Answer both questions below: how the second four-bar half begins compared with the first, and how many bars play before the whole loop starts over.",
        skills: [{ skill: "F01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play it again: compare bar 1 with bar 5 on the roll, then count the bars from the first crash until the whole thing repeats.",
        },
        hints: ladder(
          "The crash comes back in bar 5. Compare what the tune does there with bar 1.",
          "Read the degree labels of bar 1 and bar 5, then of bar 2 and bar 6.",
          "Bars 1–2 and 5–6 carry the same labels. Now count: two halves of four bars each.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "How does the second half begin?",
            options: [
              { id: "same", label: "Like the first half: the same opening, a new ending" },
              { id: "new", label: "With a new tune from its first note" },
              { id: "end", label: "Like the end of the first half" },
            ],
            correct: ["same"],
          },
          { q: "number", prompt: "How many bars before the whole thing starts over?", correct: 8 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["same"], number: 8 } }, expect: "pass" },
          {
            name: "heard as a new tune",
            response: { answer: { choice: ["new"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one phrase's length",
            response: { answer: { choice: ["same"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "tap",
      title: "Count in bars",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "tap",
        id: "tap-the-bars",
        version: 1,
        role: "practice",
        prompt:
          "Tap once on beat 1 of every bar, with the kick, for eight bars: eight taps in all. Count the bars aloud as you tap: one, two, three, four, one, two, three, four.",
        skills: [{ skill: "F01", w: 1 }],
        hints: ladder(
          "The kick plays once a bar, on beat 1. Tap only with it.",
          "One tap a bar, on the kick. Say the bar's number as you tap: four numbers, then start again.",
          "Count four beats in your head and tap only on each 1. The tune starts over at your second 'one'.",
        ),
        mode: "along",
        stimulus: { src: "code", code: TAP_STIMULUS, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 8,
        target: { drum: ["kick"] },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A beat 1 went by without a tap. Keep counting the bars through it.",
          "tap.extra": "A tap landed between the kicks. One tap a bar, on beat 1.",
        },
        tests: [
          { name: "on every beat 1", response: { taps: beatTimes(8, 4) }, expect: "pass" },
          { name: "on every beat", response: { taps: beatTimes(32) }, expect: "fail" },
          { name: "only on bars 1 and 5", response: { taps: beatTimes(2, 16) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Mark the phrases",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND_DRUMS_BASS },
      exercise: {
        kind: "code-modify",
        id: "mark-the-phrases",
        version: 1,
        role: "check",
        prompt:
          "The crash plays on every bar, so no bar sounds stronger than the next. Change the highlighted `cr` so the crash plays only on the first bar of each four-bar phrase. Done when it plays in bars 1 and 5 and nowhere else.",
        skills: [{ skill: "F01", w: 1 }],
        code: { starter: CRASH_STARTER },
        reference: { solutions: [CRASH_SOLUTION], bars: 8 },
        matcher: CRASH_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rhythm.missing": "Bar {bar}: no crash here, but a phrase starts on this bar.",
          "rhythm.extra": "Bar {bar}: a crash where no phrase starts. Phrases start on bars 1 and 5.",
        },
        hints: ladder(
          "Eight bars hold two four-bar phrases. Find the bar each one starts on.",
          "`< >` plays one of its steps in each bar, so a list of four steps takes four bars to come round.",
          "`<bd ~>` would play a kick in bars 1, 3, 5 and 7. Your crash needs a longer list.",
        ),
        tests: [
          { name: "reference", response: { code: CRASH_SOLUTION }, expect: "pass" },
          { name: "the rests written with @", response: { code: crash("<cr ~@3>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: crash("cr") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the crash on the last bar of each phrase",
            response: { code: crash("<~ ~ ~ cr>") },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
          {
            name: "groups of three bars",
            response: { code: crash("<cr ~ ~>") },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
          {
            name: "once every eight bars",
            response: { code: crash("<cr ~ ~ ~ ~ ~ ~ ~>") },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Where it moves on",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "where-it-moves-on",
        version: 1,
        role: "check",
        prompt:
          "Listen to sixteen bars with no crash: two sections of eight bars, each made of two four-bar phrases. Pick the bar where the second section starts.",
        skills: [{ skill: "F01", w: 1 }],
        hints: [
          {
            text: "Count the bars in fours. Find the group of four that sounds new, and the bar it starts on.",
          },
          {
            text: "Phrases start on bars 1, 5, 9 and 13. In one of them the chords and the tune leave what you heard before.",
          },
          {
            text: "Hear it again, slower. Bar 5 starts like bar 1. Listen for the first phrase that starts higher.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "code", code: SONG, bars: 16, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "bar-buttons", bars: 16 },
        correct: { number: 9 },
        feedbackText: {
          "id.wrong":
            "Bar {got} is not it. Count the bars in fours and listen for the first bar where the chords and the tune move somewhere new.",
        },
        srs: [{ family: "fam.har.cadence", mode: "review-if-due" }],
        tests: [
          { name: "bar 9", response: { answer: { number: 9 } }, expect: "pass" },
          {
            name: "bar 5, the second phrase of the first section",
            response: { answer: { number: 5 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "bar 13, the second phrase of the second section",
            response: { answer: { number: 13 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Make it a section",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "make-it-a-section",
        version: 1,
        role: "practice",
        prompt:
          "After the four-bar question, add a four-bar answer inside the same `< >`: these eight bars end your song. Start the answer with the question's first two bars, the same or a step higher or lower. End it home on 1. Then add a crash on bars 1 and 5.",
        skills: [{ skill: "F01", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [8, 16],
        saveAs: "sketch",
        rubric: [
          {
            id: "starts-alike",
            label: "A two-bar piece of the tune comes back later, the same or moved by a step",
            required: true,
            skills: ["F01"],
            rule: "motif-reuse",
            track: "@melody",
            minRatio: 0.25,
            unitBars: 2,
            shape: "either",
          },
          {
            id: "crash-on-phrases",
            label: "A crash on bars 1 and 5, where the phrases start",
            required: false,
            skills: ["F01"],
            rule: "onsets",
            track: "perc",
            drum: "crash",
            contains: [
              [0, 1],
              [4, 1],
            ],
            perBar: false,
          },
          {
            id: "comes-home",
            label: "The tune's last note is degree 1",
            required: false,
            skills: ["F01"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Play it and listen to the end of bar 4: the question stops open, and nothing answers it.",
          "The answer is four more bars inside the same `< >`. Its first two bars can be the question's first two.",
          "Bars 5 and 6 can copy bars 1 and 2. Bar 7 sits on V: degrees 5, 7 and 2 lead down to 1 in bar 8.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the question answered", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "the question written out twice",
            response: { code: MAKE_TWICE },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "beyond the brief: a new question, its answer, a crash and hats",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "an answer with nothing in common with the question",
            response: { code: MAKE_UNRELATED },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
