// U03.L08 Solfège. Movable do: a singing name for every degree (do re mi fa sol la ti = 1 2 3 4 5 6 7),
// with do on home in every key. The roll and the staff label degrees and syllables from here
// (`degree+solfege`, tb.feature.solfege unlocks in this lesson), sing steps sing on syllables
// (`labels: "syllables"`; the numbers stay on screen and stay accepted, contracts §8.3), and the grader's
// syllable-worded feedback no longer needs overriding. What the learner has: degrees in `n()` (U03.L02),
// `n` below 0 and from 7 up (U03.L03), the leading tone (U03.L04), any major key (U03.L05–L07).
// Not yet: "leap" and "legato" (U03.L09), "interval" (U04.L01). Spec: content/specs/U03.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 80;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line written in degrees: `n` over a major scale. */
const deg = (pattern: string, key = "C4:major", extra = "") =>
  `${TEMPO}mel: n("${pattern}").scale("${key}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook: do re mi fa-mi | sol mi do, rest. Degree 4 (fa) passes on an eighth over the vamp's C chord,
 * never held for a beat (unit convention); bar 2 sits on the F chord with G, E and C.
 */
const HOOK_TUNE = "<[0 1 2 [3 2]] [4 2 0 ~]>";
const HOOK = deg(HOOK_TUNE);
/** Do up to do: the eight notes from home to the octave above, then a rest. */
const DO_TO_DO = deg("[0 1 2 3 4 5 6 7] ~");
/**
 * The sung pattern, played by Oak on "Hear it": do mi sol mi | do ti do re | do (held). Ti sits just below
 * home (`n` -1), so ti–do is the half step up into home.
 */
const SING_PATTERN = deg("<[0 2 4 2] [0 -1 0 1] [0@4]>");
/** do re mi re | do, held for the bar. */
const DO_RE_MI = "<[0 1 2 1] [0@4]>";

/** The Band takes the key of the learner's `.scale()`, so a line moved to another key keeps its backing. */
const BAND = { band: "band.two-chord-vamp", followsLearnerKey: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;
/** From this lesson the roll and the staff show the syllable under each degree number. */
const LABELS = { rollLabels: "degree+solfege", staffLabels: "degree+solfege" } as const;

const MAKE_STARTER = deg("<[0 4 7 9] [7 4 2 0]>");

export default defineLesson({
  id: "U03.L08",
  version: 3,
  title: "Solfège",
  objective: "I can sing degrees on syllables, do for home in any key, and write a line I can sing.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["V03"],
  terms: [{ id: "term.solfege", step: "S2" }],
  canDo: ["cd.sing.degrees"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Names to sing",
      minutes: 0.5,
      ui: { panels: ROLL_STAFF, ...LABELS, band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "names-to-sing",
        version: 1,
        role: "practice",
        prompt:
          "Say or sing the word under each number as the line plays. Listen for the word the line ends on, at the end of bar 2.",
        skills: [{ skill: "V03", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Two bars, each degree with its word underneath.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Do follows home",
      minutes: 1,
      ui: { panels: ROLL_STAFF, ...LABELS },
      example: { id: "hook-in-c", code: HOOK, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "do-follows-home",
        version: 1,
        role: "practice",
        prompt:
          "Run the line in C and read the word under each number. Then change `C4:major` to `A3:major`, run it again, and watch which word sits on home, the note labelled 1. Answer both questions below.",
        skills: [{ skill: "V03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. Look at the note labelled 1 in each key and read the word under it. Then find the note labelled 5 and read its word.",
        },
        hints: ladder(
          "Compare the word under 1 in C with the word under 1 in A. Did the words move with home, or stay on the same letters?",
          "Home is the note labelled 1. Read the word under it in C, then in A.",
          "In C the word under 1 sits on `c4`; in A it sits on `a3`. Now read the word under 5.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the word that sits on home, degree 1, in both keys.",
            options: [
              { id: "do", label: "do, in both keys" },
              { id: "la", label: "do in C, la in A: the words stay on their letters" },
              { id: "sol", label: "sol, in both keys" },
            ],
            correct: ["do"],
          },
          { q: "number", prompt: "Type the degree that sol sits on.", correct: 5 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["do"], number: 5 } }, expect: "pass" },
          {
            name: "the words stay on their letters",
            response: { answer: { choice: ["la"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "sol counted as n",
            response: { answer: { choice: ["do"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "concept",
      title: "Seven syllables",
      minutes: 0.75,
      ui: { panels: ROLL_STAFF, ...LABELS },
      example: { id: "do-to-do", code: DO_TO_DO, bars: 2 },
    },
    {
      id: "S4",
      kind: "sing",
      title: "Sing on syllables",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-on-syllables",
        version: 1,
        role: "practice",
        prompt:
          "After the chords set home, sing do mi sol mi, do ti do re, do: one syllable to a beat, the last do held. Do is home, the note the chords end on; ti is the note just below do. Numbers work too.",
        skills: [
          { skill: "V03", w: 0.7 },
          { skill: "E05", w: 0.3 },
        ],
        hints: [
          {
            text: "Start on do: hum home, the note the chords end on. That note is do, and the pattern starts there.",
          },
          {
            text: "Mi and sol are the 3 and the 5 you sang before. Ti is the note just under do, and leans up into it.",
          },
          { text: "Hear the pattern on the piano once, then sing it back.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        mode: "degree",
        // What Oak plays on "Hear it" and after the attempt; the targets are the degrees below.
        stimulus: { src: "code", code: SING_PATTERN, bars: 3, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // do mi sol mi | do ti do re | do. Ti below home (octave −1), so ti–do is the half step up into do.
        // The spec's `octaves: [0, 1]` for ti do' is the same half step; the engine folds the whole pattern
        // into the learner's range, so only the octaves relative to each other matter.
        target: {
          from: "degrees",
          degrees: ["1", "3", "5", "3", "1", "7", "1", "2", "1"],
          octaves: [0, 0, 0, 0, 0, -1, 0, 0, 0],
        },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        srs: [{ family: "fam.deg.sing", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "All seven by ear",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "all-seven-by-ear",
        version: 1,
        role: "check",
        prompt:
          "Listen to the chords that set home, then to one note. Pick its degree on the pad, where each syllable sits under its number.",
        skills: [{ skill: "E05", w: 1 }],
        hints: [
          {
            text: "Find the note's place above do. Hum it, then sing down or up to do: which syllables did you pass?",
          },
          {
            text: "Do, mi and sol sound at rest. Re, fa, la and ti lean: ti up to do, fa down to mi, re down to do.",
          },
          {
            text: "Hear it again, slower, and sing the scale from do until you meet it.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.deg.fet-major", level: 3 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "degree-pad", set: ["1", "2", "3", "4", "5", "6", "7"], syllables: true },
        correct: {},
        srs: [
          { family: "fam.deg.fet-major", mode: "review-if-due" },
          { family: "fam.deg.resolve", mode: "evidence-only" },
        ],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Write what you sing",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL_STAFF, ...LABELS },
      exercise: {
        kind: "code-modify",
        id: "write-what-you-sing",
        version: 1,
        role: "check",
        prompt:
          "Write the target's first bar, do re mi re, in `n`, in place of the four zeros. Bar 2, do held for the whole bar, is already written. `n` counts from 0, so do is `n` 0.",
        skills: [
          { skill: "V03", w: 0.5 },
          { skill: "S02", w: 0.5 },
        ],
        code: { starter: `${TEMPO}mel: n("<[⟪0 0 0 0⟫] [0@4]>").scale("C4:major").s("piano")` },
        reference: { solutions: [deg(DO_RE_MI)], bars: 2 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        constraints: [{ c: "must-use", tool: "tb.n", feedback: "code.must-use" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // The catalog's syllables stay; the bridge from degree to `n` is added.
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: you have {got} ({gotSyl}); the line has {exp} ({expSyl}). In `n`, every degree is one less.",
        },
        hints: ladder(
          "Bar 1 must play do re mi re. Which degree numbers do do, re and mi stand for?",
          "Do is degree 1, re 2, mi 3. `n` counts from 0, so each one is a number less.",
          "Do is `n` 0 and re is `n` 1. Mi follows the same rule.",
        ),
        srs: [{ family: "fam.deg.index", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: deg(DO_RE_MI) }, expect: "pass" },
          {
            name: "the held do written with _",
            response: { code: deg("<[0 1 2 1] [0 _ _ _]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: deg("<[0 0 0 0] [0@4]>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the degree numbers written as n",
            response: { code: deg("<[1 2 3 2] [1@4]>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "an octave up",
            response: { code: deg(DO_RE_MI, "C5:major") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "note names instead of n",
            response: { code: `${TEMPO}mel: note("<[c4 d4 e4 d4] [c4@4]>").s("piano")` },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A line to sing",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      exercise: {
        kind: "code-make",
        id: "a-line-to-sing",
        version: 1,
        role: "practice",
        prompt:
          "Change the starter so the whole line spans no more than do up to la, 9 half steps from its lowest note to its highest; the starter climbs past the high do. Then sing your line on syllables. Done when the span fits.",
        skills: [{ skill: "V03", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [1, 4],
        saveAs: "sketch",
        // The catalog's range detail reads "span 16 semitones; at most 9": the course says half steps, and the
        // label already names the limit.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        rubric: [
          {
            id: "within-a-sixth",
            // Not "a sixth": interval names arrive in U04.L01.
            label: "From its lowest note to its highest, the line spans at most 9 half steps: do up to la",
            required: true,
            skills: ["V03"],
            rule: "range",
            track: "@melody",
            maxSpan: 9,
          },
          {
            id: "ends-on-do",
            label: "The line's last note is do, home",
            required: false,
            skills: ["E05"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "mostly-steps",
            label: "Most moves to a new note, 6 in 10 or more, go to the next note of the scale",
            required: false,
            skills: ["V03"],
            rule: "step-ratio",
            track: "@melody",
            min: 0.6,
          },
        ],
        hints: ladder(
          "The whole line must fit between a do and the la above it. Sing the starter: which notes are too high for one comfortable breath?",
          "The span is from the lowest note to the highest. The starter climbs from do to the mi above the next do.",
          "Keep every `n` between 0 and 5, or between -1 and 4: then no two notes are further apart than do and la.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: deg("<[0 2 4 5] [4 2 1 0]>") }, expect: "pass" },
          {
            name: "beyond the brief: hats, ti below home, ending on do",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: n("<[0 1 2 [3 2]] [4 [3 2] 1 [-1 0]]>").scale("C4:major").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "still reaches the high do",
            response: { code: deg("<[0 2 4 7] [4 2 1 0]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
