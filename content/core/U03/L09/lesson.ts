// U03.L09 Tunes by Number. Two public-domain tunes written as degrees (Ode to Joy, When the Saints),
// steps against leaps, notes joined with `.legato()` (tb.legato unlocks here; Strudel's other name for
// U02.L08's `.clip()`), and the first sight-singing from the staff, on syllables. What the learner has:
// degrees in `n()` (U03.L02), `n` below 0 and from 7 up (U03.L03), syllables (U03.L08), `.clip()` (U02.L08).
// Not yet: "interval" (U04.L01), "contour" (U07.L01), "pickup" (U07.L08).
// Tunes (content/repertoire, contracts §2.8), both in C as in U02.L08:
//   - song.ode-to-joy, bars 1–4 in a plain rhythm: bar 4's dotted quarter and eighth become two quarters,
//     the last 2 held for two beats (no dots before U13.L03).
//   - song.when-the-saints, "Oh when the saints | go marching in": the same four-note figure twice, from
//     the first full bar; each three-note pickup sits on beats 2–4 after a rest on beat 1 (no pickups
//     before U07.L08).
// Spec: content/specs/U03.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
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

/** Ode to Joy, bars 1–4, as degrees: 3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 3 2 2 (held). */
const ODE = "<[2 2 3 4] [4 3 2 1] [0 0 1 2] [2 1 1@2]>";
/** Ode to Joy, bars 1–2: 3 3 4 5 | 5 4 3 2. */
const ODE_1_2 = "<[2 2 3 4] [4 3 2 1]>";
/** When the Saints, as degrees: rest 1 3 4 | 5 (whole bar), twice ("oh when the saints | go marching in"). */
const SAINTS = "<[~ 0 2 3] [4@4] [~ 0 2 3] [4@4]>";
/** Both tunes, one after the other: the Ode in bars 1–4, the Saints in bars 5–8. */
const BOTH = "<[2 2 3 4] [4 3 2 1] [0 0 1 2] [2 1 1@2] [~ 0 2 3] [4@4] [~ 0 2 3] [4@4]>";

const HOOK = deg(ODE, "C4:major", ".legato(.9)");

/** The Band takes the key of the learner's `.scale()`, so a tune moved to another key keeps its backing. */
const BAND = { band: "band.two-chord-vamp", followsLearnerKey: true } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const STAFF = { roll: false, staff: "treble", keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;
/** Degree numbers and syllables on the roll and the staff (from U03.L08). */
const LABELS = { rollLabels: "degree+solfege", staffLabels: "degree+solfege" } as const;

/** The catalog's syllables stay; the bridge from degree to `n` is added. */
const BRIDGE = {
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: you have {got} ({gotSyl}); the tune has {exp} ({expSyl}). In `n`, every degree is one less.",
  // Dropping the rest (or the `< >`) moves every note off its beat, and the catalog's "extra note 1" / "note 1
  // missing" lines, at beats such as "1+4/7", do not say why.
  "melody.extra-note":
    "Bar {bar}: a note where the tune has none. Each bar is four beats: bar 1 is a rest, then 1 3 4; bar 2 holds 5 for the whole bar.",
  "melody.missing-note":
    "Bar {bar}: a note of the tune is missing here. Each bar is four beats: bar 1 is a rest, then 1 3 4; bar 2 holds 5 for the whole bar.",
} as const;

/** An arpeggio: every move skips at least one degree. */
const MAKE_STARTER = deg("<[0 2 4 7] [5 3 5 7] [4 2 0 2] [5 3 5 ~]>");

export default defineLesson({
  id: "U03.L09",
  version: 5,
  title: "Tunes by Number",
  objective:
    "I can write a known tune as degrees, tell its steps from its leaps, join its notes with .legato(), and sing it from the staff.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M01", "V04"],
  practises: [],
  terms: [
    { id: "term.leap", step: "S3" },
    { id: "term.legato", step: "S4" },
  ],
  canDo: ["cd.sing.sight"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "An old tune, new spelling",
      minutes: 0.5,
      // No Band: the tune alone, each note running into the next, is what the step is about.
      ui: { panels: STAFF, staffLabels: "degree+solfege", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "old-tune-new-spelling",
        version: 1,
        role: "practice",
        prompt:
          "Follow the staff and read the syllables as they sound. Listen for how the tune moves from note to note: smoothly to the next note, or in jumps?",
        skills: [{ skill: "M01", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Ode to Joy again, now in degrees and syllables.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "modify",
      title: "The Saints by number",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree+solfege" },
      exercise: {
        kind: "code-modify",
        id: "saints-by-number",
        version: 1,
        role: "check",
        prompt:
          "Write When the Saints in `n`, in place of the zeros. Bar 1: a rest, then degrees 1 3 4. Bar 2: degree 5, held for the whole bar. Bars 3 and 4 repeat bars 1 and 2. `n` counts from 0, so each number is the degree minus one.",
        skills: [
          { skill: "M01", w: 0.6 },
          { skill: "S02", w: 0.4 },
        ],
        code: {
          starter: `${TEMPO}mel: n("⟪<[~ 0 0 0] [0@4] [~ 0 0 0] [0@4]>⟫").scale("C4:major").s("piano")`,
        },
        reference: { solutions: [deg(SAINTS)], bars: 4 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: true },
        constraints: [{ c: "must-use", tool: "tb.n", feedback: "code.must-use" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          ...BRIDGE,
          "rhythm.duration":
            "Bar {bar}, {beatLabel}: the note lasts {got}; it should last {expected}. Hold it with `@`, as the starter's `0@4` does.",
        },
        hints: ladder(
          "Bar 1 is a rest, then degrees 1 3 4; bar 2 holds degree 5. What is each of those degrees in `n`?",
          "`n` counts from 0, so every degree is one less: degree 3 is `n` 2. The rest keeps its `~`.",
          "Bar 1 is `[~ 0 2 3]`. Bar 2 holds one note for the whole bar, written like the `0@4` in the starter.",
        ),
        srs: [{ family: "fam.deg.index", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: deg(SAINTS) }, expect: "pass" },
          {
            name: "the held 5 written with _",
            response: { code: deg("<[~ 0 2 3] [4 _ _ _] [~ 0 2 3] [4 _ _ _]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: deg("<[~ 0 0 0] [0@4] [~ 0 0 0] [0@4]>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the degree numbers written as n",
            response: { code: deg("<[~ 1 3 4] [5@4] [~ 1 3 4] [5@4]>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "the rest dropped",
            response: { code: deg("<[0 2 3] [4@4] [0 2 3] [4@4]>") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "the 5 played short",
            response: { code: deg("<[~ 0 2 3] [4 ~ ~ ~] [~ 0 2 3] [4 ~ ~ ~]>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Next door or further",
      minutes: 1,
      ui: { panels: ROLL_STAFF, ...LABELS },
      example: { id: "both-tunes", code: deg(BOTH), bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "next-door-or-further",
        version: 1,
        role: "practice",
        prompt:
          "Run both tunes: Ode to Joy in bars 1 to 4, the Saints in bars 5 to 8. Follow the numbers from note to note and check whether each move goes to the next degree or jumps past one. Then answer both questions below.",
        skills: [{ skill: "M01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. Read the numbers one pair at a time: 3 to 4 is next door, 1 to 3 jumps over 2. Count only the jumps that go up.",
        },
        hints: ladder(
          "Find the moves that skip a degree instead of going to its neighbour. Where does each tune jump?",
          "Read each pair of neighbouring numbers. A difference of 1 goes next door and 0 stays put; 2 or more jumps over a degree.",
          "In the Saints, the first two notes are 1 and 3: that move jumps over 2. Look for the same move again.",
        ),
        code: { starter: deg(BOTH) },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the tune that never jumps past a degree.",
            options: [
              { id: "ode", label: "Ode to Joy, bars 1 to 4" },
              { id: "saints", label: "The Saints, bars 5 to 8" },
              { id: "neither", label: "Neither: both jump" },
            ],
            correct: ["ode"],
          },
          {
            q: "number",
            prompt: "Type how many times the Saints, in bars 5 to 8, jumps upward past a degree.",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["ode"], number: 2 } }, expect: "pass" },
          {
            name: "the Saints moves by neighbours",
            response: { answer: { choice: ["saints"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted every move up",
            response: { answer: { choice: ["ode"], number: 6 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Join the notes",
      minutes: 0.75,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree+solfege" },
      exercise: {
        kind: "code-modify",
        id: "join-the-notes",
        version: 1,
        role: "check",
        prompt:
          "Change the number in `.legato()` so every note lasts until the next one begins. Like `.clip()`, `.legato()` sets how long each note sounds as a share of its time: at `.4`, less than half. Done when the notes join with no gaps.",
        skills: [{ skill: "M01", w: 1 }],
        code: { starter: `${TEMPO}mel: n("${ODE}").scale("C4:major").s("piano").legato(⟪.4⟫)` },
        reference: { solutions: [deg(ODE, "C4:major", ".legato(1)")], bars: 4 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: true },
        feedbackText: {
          "rhythm.duration":
            "Bar {bar}, {beatLabel}: the note sounds {got}, but its time is {expected}. Raise the number in `.legato()` until each note fills its whole time.",
        },
        hints: ladder(
          "Each note must fill all of its time. On the roll, how much of its space does each note's block fill now?",
          "The number in `.legato()` is the share of its time each note sounds: `.5` is half.",
          "The whole of its time is one share. Which number is that?",
        ),
        tests: [
          { name: "reference", response: { code: deg(ODE, "C4:major", ".legato(1)") }, expect: "pass" },
          {
            name: "written as 1.0",
            response: { code: deg(ODE, "C4:major", ".legato(1.0)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: deg(ODE, "C4:major", ".legato(.4)") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "nearly joined",
            response: { code: deg(ODE, "C4:major", ".legato(.6)") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "the tune changed as well",
            response: { code: deg("<[2 2 3 4] [4 3 2 1] [0 0 1 2] [1 0 0@2]>", "C4:major", ".legato(1)") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "sing",
      title: "Sing from the page",
      minutes: 1.5,
      ui: { panels: STAFF, staffLabels: "degree+solfege" },
      exercise: {
        kind: "sing",
        id: "sing-from-the-page",
        version: 1,
        role: "practice",
        prompt:
          "Sing the two bars on the staff on syllables after the chords set home: eight notes, one to a beat. Do is home, the note the chords end on. Oak plays the bars after you sing.",
        skills: [
          { skill: "V04", w: 0.7 },
          { skill: "V03", w: 0.3 },
        ],
        hints: [
          {
            text: "Start from do: hum the note the chords end on. Then find the first note on the staff: how many lines and spaces above do is it?",
          },
          { text: "Mi mi fa sol: up by neighbours. Then back down the same way, one further." },
          { text: "Hear the two bars once, slower, then sing them from the page.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        // Sight-singing: the target is shown on the staff and only the cue plays first; Oak plays it after.
        mode: "sight",
        stimulus: { src: "code", code: deg(ODE_1_2), bars: 2, showCode: false, showStaff: true },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["3", "3", "4", "5", "5", "4", "3", "2"] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "after",
        srs: [
          { family: "fam.mel.sight", mode: "seed" },
          { family: "fam.not.read", mode: "review-if-due" },
        ],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "A tune by numbers",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      exercise: {
        kind: "code-make",
        id: "a-tune-by-numbers",
        version: 1,
        role: "practice",
        // The catalog's text for a `uses` rule names the tool ID; the label says it in words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        prompt:
          "Rewrite the starter's tune so most moves go to the next degree, up or down; the starter leaps on every move. Keep a leap or two for interest. Your tune takes over the eight bars after the opening of your song. Done when at least 6 in 10 moves to a new note are steps.",
        skills: [{ skill: "M01", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "mostly-steps",
            label: "At least 6 in 10 moves to a new note are steps, to the next degree up or down",
            required: true,
            skills: ["M01"],
            rule: "step-ratio",
            track: "@melody",
            min: 0.6,
          },
          {
            id: "ends-home",
            label: "The tune's last note is degree 1, do",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "joined",
            label: "Uses `.legato()` to join the notes",
            required: false,
            skills: ["M01"],
            rule: "uses",
            tool: "tb.legato",
          },
          {
            id: "singable",
            // Not "a sixth": interval names arrive in U04.L01.
            label: "From its lowest note to its highest, the tune spans at most 9 half steps: do up to la",
            required: false,
            skills: ["V04"],
            rule: "range",
            track: "@melody",
            maxSpan: 9,
          },
        ],
        hints: ladder(
          "Most moves must go to the next degree. Sing the starter: does any note go to its neighbour, or does every one jump?",
          "A step goes to the next degree: `n` one more or one less. A repeated note does not count either way.",
          "Keep a few of the starter's jumps and fill the gaps between them: 0 2 becomes 0 1 2.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal",
            response: { code: deg("<[0 1 2 4] [5 4 3 2] [2 1 0 1] [3 2 1 0]>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: hats, a bass line, joined notes, ending home",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nbass: n("<0 3>").scale("C2:major").s("ebass")\nmel: n("<[0 1 2 4] [5 4 3 [2 1]] [2 4 3 2] [1 2 0@2]>").scale("C4:major").s("piano").legato(1)`,
            },
            expect: "pass",
          },
          {
            name: "another arpeggio",
            response: { code: deg("<[0 2 4 2] [3 5 7 5] [4 2 0 2] [5 3 0 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
