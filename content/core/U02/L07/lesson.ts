// U02.L07 Sing It Back. Match one note, hear up from down, echo short phrases, then write one down.
// Singing is never graded as a check: the sing steps have fallbacks, and the two graded checks are an ear
// set and a code step. Notes are names with octaves; `n()` and `.scale()` wait for U03.L02, numbers sung
// aloud are not used yet either: the learner sings on any vowel. Spec: content/specs/U02.md.
import { defineLesson, type HintLadder, type SingTolerance } from "@oak/content-kit";

const BPM = 80;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band carries drums, bass and chords; the learner's line sits on top. */
const BAND = { band: "band.two-chord-vamp" } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

/** The hook: a two-note call, then a bar of room for the answer. */
const HOOK = mel("<[c4 e4 ~ ~] [~ ~ ~ ~]>");
/** The phrases to echo: the hook's call, then three notes that step down to c4. */
const CALL_TWO = mel("c4 e4 ~ ~");
const CALL_THREE = mel("e4 d4 c4 ~");

/** Contracts §8.1: per-note folding for single notes, one best octave shift for phrases. */
const SING_TOL = (octave: SingTolerance["octave"]): SingTolerance => ({
  cents: "learner",
  octave,
  driftCompCents: 20,
  minCoverage: 0.6,
  passHitRate: 0.8,
});
const SING_HINTS = ladder(
  "Match the piano's note itself, not one near it. Hum it first with your mouth closed: does the hum feel like the same note?",
  "Watch the trace: above the lane means ease down, below means lift a little.",
  "Hear it again more slowly and hum along while it plays.",
);

/** Before U03.L02 the grader's melody feedback speaks in degrees; say it in places and letters instead. */
const LETTER_FEEDBACK = {
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than the target. Check the octave number.",
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: a different note from the one you heard. Up or down from the one before?",
  "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here.",
} as const;

const MAKE_STARTER = mel("<[c4 d4 e4 ~] [~ ~ ~ ~]>");

/** The catalog's drift text names a syllable ("re-anchor on do"); syllables wait for U03.L08. */
const DRIFT_FEEDBACK = {
  "sing.drift": "You drifted {cents}¢ {dir} over the call. Hear its first note again and start from there.",
} as const;

export default defineLesson({
  id: "U02.L07",
  version: 5,
  title: "Sing It Back",
  objective:
    "I can match a note with my voice, hear whether a note goes up or down, and sing back a short phrase.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["V01", "E02"],
  terms: [],
  canDo: ["cd.sing.echo"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Call and room",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "call-and-room",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the two-note call in bar 1, then hum it back in the empty bar 2. Listen for which way the call moves: up or down.",
        skills: [{ skill: "V01", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Bar 1 is the call. Bar 2 is room for you.", bars: 2 }],
      },
    },
    {
      id: "S2",
      kind: "sing",
      title: "Match one note",
      minutes: 1.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "sing",
        id: "match-one-note",
        version: 1,
        role: "practice",
        prompt:
          'Listen to one piano note. When it stops, sing the same note back on any vowel, such as "ah", and hold it steady.',
        skills: [{ skill: "V01", w: 1 }],
        hints: SING_HINTS,
        // Quiet mode or no microphone: the same notes as a listening choice (contracts §8.5).
        fallback: "identify",
        mode: "pitch",
        stimulus: { src: "generator", family: "fam.pit.match", level: 2 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        target: { from: "stimulus" },
        tol: SING_TOL("per-note"),
        showTrace: "after",
        srs: [{ family: "fam.pit.match", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S3",
      kind: "ear",
      title: "Up or down?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "up-or-down",
        version: 1,
        role: "check",
        prompt:
          "Listen to two notes, one after the other. Pick whether the second note goes up, goes down, or stays on the same note. Six pairs in all.",
        skills: [{ skill: "E02", w: 1 }],
        hints: [
          { text: "Sing the first note, then slide your voice to the second. Which way did it move?" },
          {
            text: "Neighbouring notes can pass for the same one. Hum both: did your voice have to move at all?",
          },
          { text: "Hear it again more slowly, and hum along.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.pit.compare", level: 2 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "higher", label: "Up" },
            { id: "lower", label: "Down" },
            { id: "same", label: "Same note" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.pit.compare", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S4",
      kind: "sing",
      title: "Echo the call",
      minutes: 1.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "echo-the-call",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two calls on the piano, one at a time. After each call, sing it straight back in the gap that follows, on any vowel.",
        skills: [
          { skill: "V01", w: 0.5 },
          { skill: "E02", w: 0.5 },
        ],
        hints: SING_HINTS,
        fallback: "identify",
        tests: [],
        parts: [
          {
            kind: "sing",
            id: "echo-two",
            version: 1,
            role: "practice",
            prompt:
              "Sing back the two-note call in the gap after it. The second note is higher than the first.",
            skills: [
              { skill: "V01", w: 0.5 },
              { skill: "E02", w: 0.5 },
            ],
            hints: SING_HINTS,
            fallback: "identify",
            mode: "echo",
            stimulus: { src: "code", code: CALL_TWO, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            target: { from: "stimulus", track: "mel" },
            tol: SING_TOL("global"),
            showTrace: "after",
            feedbackText: DRIFT_FEEDBACK,
            tests: [],
          },
          {
            kind: "sing",
            id: "echo-three",
            version: 1,
            role: "practice",
            prompt:
              "Sing back the three-note call in the gap after it. Each note is a little lower than the one before.",
            skills: [
              { skill: "V01", w: 0.5 },
              { skill: "E02", w: 0.5 },
            ],
            hints: SING_HINTS,
            fallback: "identify",
            mode: "echo",
            stimulus: { src: "code", code: CALL_THREE, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            target: { from: "stimulus", track: "mel" },
            tol: SING_TOL("global"),
            showTrace: "after",
            feedbackText: DRIFT_FEEDBACK,
            tests: [],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Write it down",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "write-the-echo",
        version: 1,
        role: "check",
        prompt:
          "Write the three-note call you just sang: put its second and third notes in place of the two `~` after `e4`. Each note is the next white key down from the one before. Keep the last `~`, so beat 4 stays silent.",
        skills: [
          { skill: "E02", w: 0.5 },
          { skill: "P02", w: 0.5 },
        ],
        code: { starter: mel("e4 ⟪~ ~⟫ ~") },
        reference: { solutions: [mel("e4 d4 c4 ~")], bars: 1 },
        // The notes where they start, and the rest the brief asks to keep: `c4@2` rings through beat 4.
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
            {
              m: "rubric",
              rules: [
                {
                  id: "rest-at-the-end",
                  label: "The rest at the end",
                  required: true,
                  skills: [],
                  rule: "custom",
                  fn: "silent-beat",
                  params: { tracks: ["mel"], at: "end" },
                },
              ],
            },
          ],
        },
        // The roll of the target appears after the first failed check: by ear first, then a picture to compare.
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: LETTER_FEEDBACK,
        hints: ladder(
          "Two notes are missing after `e4`, and each one is lower than the note before it. Sing the call again and feel each step down.",
          "Down to the next white key each time: find `e4` on the keys and walk left.",
          "The second note is `d4`. One more step down for the third.",
        ),
        srs: [{ family: "fam.pit.compare", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: mel("e4 d4 c4 ~") }, expect: "pass" },
          {
            name: "last note held through the rest",
            response: { code: mel("e4 d4 c4@2") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "last note held with `_`",
            response: { code: mel("e4 d4 c4 _") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "short notes, the rest still at the end",
            response: { code: mel("e4 d4 [c4 ~] ~") },
            expect: "pass",
          },
          {
            name: "on a triangle wave",
            response: { code: `${mel("e4 d4 c4 ~")}.gain(.5)`.replace('"piano"', '"triangle"') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: mel("e4 ~ ~ ~") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "an octave up",
            response: { code: mel("e4 d5 c5 ~") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "second note went up",
            response: { code: mel("e4 f4 c4 ~") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "lost a note",
            response: { code: mel("e4 d4 ~ ~") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "A call you can sing",
      minutes: 2.5,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "a-call-you-can-sing",
        version: 1,
        role: "practice",
        prompt:
          "Write a short call on the `mel:` line for the quiet part of your song, with every note inside your voice's range, the lowest to highest notes Oak measured when you set up the mic. Leave a bar of `~` after it, then sing the call back in that gap. Done when no note is out of your range.",
        skills: [
          { skill: "V01", w: 0.5 },
          { skill: "P02", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "fits-your-voice",
            label: "Every note inside your voice's range, as Oak measured it",
            required: true,
            skills: ["V01"],
            rule: "range",
            track: "@melody",
            within: "learner-voice",
          },
          {
            id: "few-notes",
            label: "Lowest to highest note at most 7 half steps apart, so you can echo it",
            required: false,
            skills: ["E02"],
            rule: "range",
            track: "@melody",
            maxSpan: 7,
          },
          {
            id: "gap",
            label: "At least one `~` (a rest), leaving a gap for your echo",
            required: false,
            skills: ["R06"],
            rule: "uses",
            tool: "tb.mini.rest",
          },
        ],
        hints: ladder(
          "Every note must sit where your voice is comfortable. Sing the starter: which of its notes strain?",
          "Oak measured your range when you set up the mic. If a note feels high, write the same letter with a smaller number: `c3` for `c4`.",
          "Keep the call in the first bar and the gap in the second: `<[… ~] [~ ~ ~ ~]>`.",
        ),
        tests: [
          {
            name: "the starter as it came",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["make.unchanged"],
          },
          {
            name: "minimal",
            response: { code: mel("<[e4 g4 ~ ~] [~ ~ ~ ~]>") },
            expect: "pass",
          },
          {
            name: "beyond the brief",
            response: {
              code: `${TEMPO}mel: note("<[c4 e4 g4 ~] [~ ~ ~ ~] [g4 e4 d4 ~] [~ ~ ~ ~]>").s("piano")\nvox: note("<[~ ~ ~ ~] [c4 e4 g4 ~] [~ ~ ~ ~] [g4 e4 d4 ~]>").s("triangle").gain(.4)`,
            },
            expect: "pass",
          },
          {
            name: "too high to sing",
            response: { code: mel("<[e5 g5 c6 ~] [~ ~ ~ ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
