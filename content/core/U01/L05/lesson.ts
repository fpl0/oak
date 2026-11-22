// U01.L05 Seeing Rhythm. Lengths have names and shapes on paper: whole, half, quarter and eighth notes,
// and their rests. Tools in reach: U01.L01–L04 plus `@`, `_` and the staff panel (unlocked here).
// On the percussion staff, hits that start together are engraved as one chord with the shorter length
// (AUTHORING §6 rule 3): every example a staff step shows plays without the eighth hats, so its long
// values read as long. Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** One drum line, optionally with something chained after `s("…")`. */
const drums = (pattern: string, extra = "") => `${TEMPO}drums: s("${pattern}")${extra}`;
const HATS = 'hats: s("hh*8").gain(.5)';
/** The hook: a crash held for two beats, then a kick and a snare, over soft eighth hats. */
const HOOK = `${drums("cr@2 bd sd")}\n${HATS}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Seconds of the n-th beat at `bpm` (tap tests are relative to the start of the stimulus). */
const beatTimes = (bpm: number, beats: number[]) => beats.map((b) => Number((b * (60 / bpm)).toFixed(3)));

/** The Band plays bass and chords under the learner's drums. */
const BAND = { band: "band.two-chord-vamp", tracks: ["bass", "chords"] } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "perc", keyboard: false } as const;
/** The catalog's tap lines name a bar and beat the tap grader does not send; these read whole without them. */
const TAP_FEEDBACK = {
  "tap.missed": "A note on the page went by without a tap. Keep counting through the long ones.",
  "tap.extra": "A tap landed where no note starts: a held note gets one tap, at its start.",
} as const;
/** Lengths are the point of this lesson, so the matcher compares them. */
const DRUM_LENGTHS = {
  m: "events",
  pitch: "absolute",
  rhythm: "exact",
  durations: true,
  sound: "drum-role",
} as const;

export default defineLesson({
  id: "U01.L05",
  version: 3,
  title: "Seeing Rhythm",
  objective:
    "I can read quarter, eighth, half and whole notes on the percussion staff and hold a sound with @ or _.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["N01"],
  practises: ["R06"],
  terms: [
    { id: "term.quarter-note", step: "S3" },
    { id: "term.eighth-note", step: "S3" },
    { id: "term.half-note", step: "S4" },
    { id: "term.whole-note", step: "S4" },
  ],
  canDo: ["cd.read.rhythm"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Long and short",
      minutes: 0.5,
      ui: { panels: ROLL, band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "long-and-short",
        version: 1,
        role: "practice",
        prompt:
          "Count four beats a bar along with the soft hats. Crash, kick and snare share each bar: listen for the one that gets two beats to itself.",
        skills: [{ skill: "N01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Crash, kick and snare, with soft hats counting underneath.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "see",
      title: "The bar on paper",
      minutes: 0.5,
      ui: { panels: ROLL_STAFF },
      example: { id: "on-paper", code: drums("cr@2 bd sd"), bars: 1 },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two ways to hold",
      minutes: 1,
      ui: { panels: ROLL_STAFF },
      exercise: {
        kind: "run-investigate",
        id: "two-ways-to-hold",
        version: 1,
        role: "practice",
        prompt:
          "Listen and watch both panels. Then change `bd@2` to `bd _`, listen again and compare. Answer the two questions below.",
        skills: [{ skill: "N01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the shares: `bd@2` takes two and each `sd` one, four in all for the four beats. Where does the first snare start?",
        },
        hints: ladder(
          "Find where the kick ends: it ends where the first snare starts. Counting from beat 1, where is that?",
          "The words in a bar share it out. `@2` gives a word two shares; `_` gives the word before it one more. Here four shares make four beats.",
          "The two snares take beats 3 and 4, so the kick has whatever is left before them.",
        ),
        code: { starter: drums("bd@2 sd sd") },
        mustPlayLoops: 2,
        questions: [
          {
            q: "choice",
            prompt: "Which beats does the kick take up?",
            options: [
              { id: "one", label: "Beat 1 only" },
              { id: "one-two", label: "Beats 1 and 2" },
              { id: "all", label: "The whole bar" },
            ],
            correct: ["one-two"],
          },
          {
            q: "number",
            prompt: "How many beats long is each `sd`?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["one-two"], number: 1 } }, expect: "pass" },
          {
            name: "heard only the hit",
            response: { answer: { choice: ["one"], number: 1 } },
            expect: "fail",
          },
          {
            name: "counted the snares as two beats",
            response: { answer: { choice: ["one-two"], number: 2 } },
            expect: "fail",
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Read the bar",
      minutes: 1,
      graded: true,
      ui: { panels: { roll: false, staff: "perc", keyboard: false } },
      // A whole bar on one kick, shown beside the quiz so the pass text can name what the learner sees.
      example: { id: "whole-bar", code: drums("bd@4"), bars: 1 },
      exercise: {
        kind: "staff-read",
        id: "read-the-bar",
        version: 1,
        role: "check",
        prompt:
          "Read the notes on the page; nothing plays this time. Pick the line of code that is written here.",
        skills: [{ skill: "N01", w: 1 }],
        source: drums("bd sd bd@2"),
        bars: 1,
        answer: {
          ui: "choice",
          options: [
            { id: "a", label: "`bd@2 sd bd`" },
            { id: "b", label: "`bd sd bd@2`" },
            { id: "c", label: "`bd sd bd bd`" },
          ],
        },
        correct: { choice: ["b"] },
        // The catalog line says "Listen to both", but this question has no sound.
        feedbackText: {
          "id.wrong":
            "Not that one. Find the open note head: it lasts two beats. Does it come first or last in the bar?",
        },
        hints: ladder(
          "Match each shape to a length. One of the three notes looks different from the others: which one?",
          "A filled head with a stem lasts one beat. An open head lasts longer.",
          "The first two notes are one beat each, so the long one comes last.",
        ),
        srs: [{ family: "fam.rhy.read", mode: "evidence-only" }],
        tests: [
          { name: "the long kick last", response: { answer: { choice: ["b"] } }, expect: "pass" },
          {
            name: "the long kick first",
            response: { answer: { choice: ["a"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "four short notes",
            response: { answer: { choice: ["c"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Hold the crash",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_STAFF },
      exercise: {
        kind: "code-modify",
        id: "hold-the-crash",
        version: 1,
        role: "check",
        prompt:
          "Make the crash last two beats, using `@` or `_`: it takes over beat 2, where the `~` is now. Keep the kick on beat 3 and the snare on beat 4.",
        skills: [
          { skill: "N01", w: 0.7 },
          { skill: "R06", w: 0.3 },
        ],
        code: { starter: `${TEMPO}drums: s("⟪cr ~ bd sd⟫")` },
        reference: { solutions: [drums("cr@2 bd sd")], bars: 1 },
        matcher: DRUM_LENGTHS,
        target: { audible: true, showRoll: true },
        // The catalog says "missing hit" and "extra hit": these say what the bar should hold.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: no hit here yet{role}. The crash rings over beats 1 and 2, then the kick on 3 and the snare on 4, with no rest left.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a hit that should not be there{role}. The bar holds three sounds: one crash over beats 1 and 2, the kick on 3, the snare on 4.",
        },
        hints: ladder(
          "The crash should take beats 1 and 2. How many words does the bar hold now, and how many beats does the crash take?",
          "The crash needs the two beats that `cr` and `~` share now. `@` or `_` gives it both.",
          "If the crash takes two beats, the `~` has no beat left to take.",
        ),
        tests: [
          { name: "reference", response: { code: drums("cr@2 bd sd") }, expect: "pass" },
          { name: "held with an underscore", response: { code: drums("cr _ bd sd") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: drums("cr ~ bd sd") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "kept the rest as well",
            response: { code: drums("cr@2 ~ bd sd") },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "two crashes instead of one long one",
            response: { code: drums("cr cr bd sd") },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "tap",
      title: "Tap what you read",
      minutes: 1.5,
      ui: { panels: { roll: false, staff: "perc", keyboard: false } },
      exercise: {
        kind: "tap",
        id: "tap-what-you-read",
        version: 1,
        role: "practice",
        prompt:
          "Tap the written rhythm, both bars: one tap at the start of each note, none while a note is held. Each bar holds three notes, so that is six taps in all.",
        skills: [
          { skill: "N01", w: 0.7 },
          { skill: "E01", w: 0.3 },
        ],
        hints: ladder(
          "Tap only where a note starts. How many notes does each bar hold, and which one is long?",
          "The open note lasts two beats: tap once on beat 1, then wait through beat 2.",
          "Count along: tap, two, tap, tap.",
        ),
        mode: "read",
        stimulus: { src: "code", code: drums("sd@2 sd sd"), bars: 2, showCode: false, showStaff: true },
        cue: { context: "none", countInBars: 1, click: true, replays: -1 },
        bars: 2,
        target: { drum: ["snare"] },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: TAP_FEEDBACK,
        srs: [{ family: "fam.rhy.read", mode: "seed" }],
        tests: [
          { name: "as written", response: { taps: beatTimes(BPM, [0, 2, 3, 4, 6, 7]) }, expect: "pass" },
          {
            name: "read the long note as one beat",
            response: { taps: beatTimes(BPM, [0, 1, 2, 4, 5, 6]) },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your long and short",
      minutes: 2.5,
      ui: { panels: ROLL_STAFF, band: BAND },
      exercise: {
        kind: "code-make",
        id: "long-and-short-groove",
        version: 1,
        role: "practice",
        prompt:
          "Write a groove that mixes long and short sounds. Hold at least one sound with `@` or `_`, so it lasts two beats or more, or twice as long as another sound on its line in the same bar.",
        skills: [
          { skill: "N01", w: 0.7 },
          { skill: "R06", w: 0.3 },
        ],
        code: { starter: `${drums("cr bd sd sd")}\n${HATS}` },
        bars: [1, 2],
        saveAs: "sketch",
        rubric: [
          {
            id: "held",
            label: "One sound held with `@` or `_`: two beats or more, or twice another sound on its line",
            required: true,
            skills: ["N01"],
            // The effect, not the symbol: `cr@1 bd sd sd` holds nothing.
            rule: "custom",
            fn: "held",
            params: { alsoUses: ["tb.mini.elongate", "tb.mini.hold"] },
          },
          {
            id: "space",
            label: "Uses a rest, `~`",
            required: false,
            skills: ["R06"],
            rule: "uses",
            tool: "tb.mini.rest",
          },
          {
            id: "eighths",
            label: "Uses `[ ]` to split a beat",
            required: false,
            skills: ["R05"],
            rule: "uses",
            tool: "tb.mini.sub",
          },
        ],
        hints: ladder(
          "Pick one sound and make it last two beats. Which sound in the starter would you like to ring longer?",
          "`@2` gives a word two shares of the bar and every other word one. Count the shares: four of them make four beats.",
          "Try the crash on beats 1 and 2: then the bar holds three words, not four.",
        ),
        tests: [
          { name: "minimal", response: { code: `${drums("cr@2 bd sd")}\n${HATS}` }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: `${TEMPO}kick: s("bd@3 [~ bd]")\nsnare: s("~ sd _ sd")\nhats: s("[hh hh] [hh hh] [hh oh] ~").gain(.5)\nperc: s("cr ~ ~ ~").gain(.6)`,
            },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: `${drums("cr bd sd sd")}\n${HATS}` },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "`@1`: every sound still one beat",
            response: { code: `${drums("cr@1 bd sd sd")}\n${HATS}` },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "held with `_`",
            response: { code: `${drums("cr _ bd sd")}\n${HATS}` },
            expect: "pass",
          },
          {
            name: "a snare held for the last three beats",
            response: { code: `${drums("bd sd@3")}\n${HATS}` },
            expect: "pass",
          },
          {
            name: "a rest, then a snare that rings to the end of the bar",
            response: { code: `${drums("bd ~ sd@2")}\n${HATS}` },
            expect: "pass",
          },
          {
            name: "a gap instead of a hold",
            response: { code: `${drums("cr ~ bd sd")}\n${HATS}` },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
