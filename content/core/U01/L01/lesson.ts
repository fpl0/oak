// U01.L01 Heartbeat (exemplar). Feel the pulse, set a tempo with setcpm(bpm/4), learn that one cycle is
// one bar, write a one-line beat. Tools in reach: s, setcpm, space-separated sequences, `*`, bd sd hh cp
// rim and labels (rests arrive in U01.L02, brackets in U01.L04). Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const tempo = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const GROOVE_LINES = 'drums: s("bd sd bd sd")\nhats: s("hh*8")';
/** The groove the lesson keeps coming back to: kick and snare on the four beats, hats twice as fast. */
const groove = (bpm: number) => `${tempo(bpm)}${GROOVE_LINES}`;
const kickLine = (pattern: string, bpm = 120) => `${tempo(bpm)}drums: s("${pattern}")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Seconds of the n-th beat at `bpm` (tap tests are relative to the start of the stimulus). */
const beatTimes = (bpm: number, n: number, every = 1, offset = 0) =>
  Array.from({ length: n }, (_, i) => Number(((i * every + offset) * (60 / bpm)).toFixed(3)));

/** The Band plays bass and chords under the learner's drums: a groove Make gets the roles it lacks. */
const BAND = { band: "band.two-chord-vamp", tracks: ["bass", "chords"] } as const;
/**
 * Drum hits are one-shots: only where they start matters. `rhythm: "exact"` would also compare the length of
 * each slot, and reject `[bd ~]` for `bd` although the two sound the same.
 */
const DRUM_ONSETS = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  sound: "drum-role",
} as const;
/** The catalog's tap lines name a bar and beat the tap grader does not send; these read whole without them. */
const TAP_FEEDBACK = {
  "tap.missed": "A sound you were asked to tap went by without a tap. Keep counting through it.",
  "tap.extra": "A tap landed where nothing you were asked to tap plays.",
} as const;

export default defineLesson({
  id: "U01.L01",
  version: 3,
  title: "Heartbeat",
  objective: "I can find the beat, set a tempo with setcpm, and write a one-bar beat on one line.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R01", "R02", "R03", "E01"],
  practises: [],
  terms: [
    { id: "term.pulse", step: "S2" },
    { id: "term.tempo", step: "S4" },
    { id: "term.bar", step: "S5" },
  ],
  canDo: ["cd.hear.pulse", "cd.code.tempo"],
  wrapAt: "S6",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Find the beat",
      minutes: 0.5,
      ui: { panels: { roll: true, staff: false, keyboard: false }, band: BAND },
      example: { id: "groove", code: groove(BPM), bars: 4 },
      exercise: {
        kind: "listen",
        id: "find-the-beat",
        version: 1,
        role: "practice",
        prompt:
          "Nod your head along with the groove. Listen for which drums your nod lands with: the low thump of the kick, the crisp crack of the snare, or the fast ticks of the hats.",
        skills: [{ skill: "R01", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: groove(BPM), caption: "Kick and snare on one line, hats on the other.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap it",
      minutes: 1.25,
      ui: { panels: { roll: true, staff: false, keyboard: false }, band: BAND },
      exercise: {
        kind: "tap",
        id: "tap-the-pulse",
        version: 1,
        role: "practice",
        prompt:
          "Tap once on every kick and every snare: the kick is the low thump, the snare the crisp crack. Do not tap the hats, the fast ticks in between. That makes eight taps in all, evenly spaced.",
        skills: [
          { skill: "R01", w: 0.5 },
          { skill: "E01", w: 0.5 },
        ],
        hints: ladder(
          "Tap only the kick and the snare, eight taps in all. Which sound keeps coming back at the same distance?",
          "Kick, snare, kick, snare: one tap on each of them, none on the hats in between.",
          "Count four with the drums before you start: 1, 2, 3, 4, then tap on the next 1.",
        ),
        mode: "along",
        stimulus: { src: "code", code: groove(BPM), bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 2,
        target: "beat",
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: TAP_FEEDBACK,
        srs: [{ family: "fam.rhy.pulse", mode: "seed" }],
        tests: [
          { name: "on every beat", response: { taps: beatTimes(BPM, 8) }, expect: "pass" },
          { name: "on every other beat", response: { taps: beatTimes(BPM, 4, 2) }, expect: "fail" },
          { name: "on the hats", response: { taps: beatTimes(BPM, 16, 0.5) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "A bigger number",
      minutes: 0.5,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      example: { id: "groove-132", code: groove(132), bars: 2 },
      exercise: {
        kind: "predict",
        id: "bigger-number",
        version: 1,
        role: "practice",
        prompt:
          "The first line now says 132 where it said 96, and nothing else has changed. Predict what you will hear, and pick one answer.",
        skills: [{ skill: "R02", w: 1 }],
        hints: null,
        tests: [],
        code: groove(132),
        bars: 2,
        mode: "choose",
        choices: [
          { id: "faster", label: "The same groove, faster" },
          { id: "slower", label: "The same groove, slower" },
          { id: "more", label: "More drum hits in each loop" },
        ],
        correct: ["faster"],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Turn the dial",
      minutes: 1,
      ui: { panels: { roll: true, staff: false, keyboard: false } },
      exercise: {
        kind: "run-investigate",
        id: "turn-the-dial",
        version: 1,
        role: "practice",
        prompt:
          "Listen at 132 first. Then change 132 in the first line to 70 and listen, then to 160 and listen again. Answer the question below.",
        skills: [{ skill: "R02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Only the first number changed between your tries. Listen at 70 and at 160 again and notice what changed with it.",
        },
        hints: ladder(
          "Compare what you heard at 70 and at 160. You changed one number: what changed in the sound?",
          "Only the first line changed, and only the speed changed with it.",
          "At 60 the kick and snare land once a second; at 120, twice a second.",
        ),
        code: { starter: groove(132) },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What does the first number in `setcpm(132/4)` count?",
            options: [
              { id: "bpm", label: "Beats per minute" },
              { id: "hits", label: "Drum hits per loop" },
              { id: "loops", label: "How many times the loop repeats" },
            ],
            correct: ["bpm"],
          },
        ],
        tests: [
          { name: "beats per minute", response: { answer: { choice: ["bpm"] } }, expect: "pass" },
          { name: "drum hits", response: { answer: { choice: ["hits"] } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S5",
      kind: "investigate",
      title: "Count the loop",
      minutes: 1,
      ui: { panels: { roll: true, staff: false, keyboard: false } },
      exercise: {
        kind: "run-investigate",
        id: "one-loop-one-bar",
        version: 1,
        role: "practice",
        prompt:
          "Count the sounds from one kick up to the next, the kick itself included. Then add two more `hh` to the end of the line inside the quotes and listen again. Answer the two questions below.",
        skills: [{ skill: "R03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count from one kick, the kick included, up to the next kick, and watch whether the loop on the roll gets any wider.",
        },
        hints: ladder(
          "First count from one kick to the next, the kick included. Where does the loop start again?",
          "The kick `bd` is the first word, so every kick starts the loop again.",
          "Count the words inside the quotes: each word is one sound.",
        ),
        code: { starter: kickLine("bd hh hh hh", BPM) },
        mustPlayLoops: 2,
        questions: [
          {
            q: "number",
            prompt: "How many sounds play from one kick up to the next, counting the kick?",
            correct: 4,
          },
          {
            q: "choice",
            prompt: "With two more `hh` in the line, what happened?",
            options: [
              { id: "squeeze", label: "The loop kept its length; the sounds moved closer together" },
              { id: "longer", label: "The loop got longer by two sounds" },
            ],
            correct: ["squeeze"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 4, choice: ["squeeze"] } }, expect: "pass" },
          {
            name: "thought it grows",
            response: { answer: { number: 4, choice: ["longer"] } },
            expect: "fail",
          },
          {
            name: "counted the next kick",
            response: { answer: { number: 5, choice: ["squeeze"] } },
            expect: "fail",
          },
          {
            name: "counted the hats only",
            response: { answer: { number: 3, choice: ["squeeze"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Set the tempo",
      minutes: 1.25,
      graded: true,
      ui: { panels: { roll: true, staff: false, keyboard: false } },
      exercise: {
        kind: "code-modify",
        id: "set-120",
        version: 1,
        role: "check",
        prompt:
          "Change the number in the first line so the groove plays at **120** beats per minute. Keep the `/4`, and leave the drum lines as they are.",
        skills: [{ skill: "R02", w: 1 }],
        code: { starter: `setcpm(⟪80⟫/4)\n\n${GROOVE_LINES}` },
        reference: { solutions: [groove(120)], bars: 1 },
        matcher: DRUM_ONSETS,
        constraints: [{ c: "tempo", bpm: 120 }],
        target: { audible: true },
        // The catalog line names `setcpm({bpm}/{beats})` with values the lint does not send.
        feedbackText: {
          "code.setcpm-form":
            "Write the tempo as beats per minute over the beats in a bar, as the starter does: `setcpm(80/4)`.",
        },
        hints: ladder(
          "Only the speed should change, from 80 to 120 beats per minute. Which line sets the speed?",
          "The first number in `setcpm(…/4)` is the tempo in beats per minute.",
          "For 100 beats per minute the line would read `setcpm(100/4)`.",
        ),
        tests: [
          { name: "reference", response: { code: groove(120) }, expect: "pass" },
          {
            name: "the same speed written as bars per minute",
            response: { code: `setcpm(30)\n\n${GROOVE_LINES}` },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: `setcpm(80/4)\n\n${GROOVE_LINES}` },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "dropped the /4",
            response: { code: `setcpm(120)\n\n${GROOVE_LINES}` },
            expect: "fail",
            feedback: ["code.tempo-factor"],
          },
          {
            name: "another tempo",
            response: { code: groove(112) },
            expect: "fail",
            feedback: ["code.tempo"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "modify",
      title: "Kick on every beat",
      minutes: 1,
      graded: true,
      ui: { panels: { roll: true, staff: false, keyboard: false } },
      exercise: {
        kind: "code-modify",
        id: "kick-every-beat",
        version: 1,
        role: "check",
        prompt:
          "Change the `drums` line so it plays the kick `bd` four times, once on each beat, and no other sound. Done when you hear four kicks and nothing else.",
        skills: [
          { skill: "R01", w: 0.5 },
          { skill: "R03", w: 0.5 },
        ],
        code: { starter: kickLine("⟪bd sd bd sd⟫") },
        reference: { solutions: [kickLine("bd bd bd bd")], bars: 1 },
        matcher: DRUM_ONSETS,
        target: { audible: true },
        // The catalog says "missing hit" and "extra hit": these say what goes where.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: no hit here yet{role}. Each of the four beats needs one `bd`.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: one hit too many{role}. The line should hold four `bd`, one per beat, and nothing else.",
        },
        hints: ladder(
          "The bar needs four kicks, one on each beat. How many words does a bar of four beats need?",
          "Each word inside the quotes is one beat here. Two of the four are `sd`.",
          "`hh*8` played eight hats; the same trick repeats a kick.",
        ),
        srs: [{ family: "fam.rhy.pulse", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: kickLine("bd bd bd bd") }, expect: "pass" },
          { name: "with a star", response: { code: kickLine("bd*4") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: kickLine("bd sd bd sd") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "three kicks",
            response: { code: kickLine("bd bd bd") },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
          {
            name: "kept a snare",
            response: { code: kickLine("bd bd bd sd") },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your heartbeat",
      minutes: 2.5,
      ui: { panels: { roll: true, staff: false, keyboard: false }, band: BAND },
      exercise: {
        kind: "code-make",
        id: "your-heartbeat",
        version: 1,
        role: "practice",
        prompt:
          "Write a one-bar drum beat at a tempo you choose. The starter plays one kick per bar: give each of the four beats its own sound. Done when a sound starts on every beat.",
        skills: [
          { skill: "R01", w: 0.5 },
          { skill: "R02", w: 0.25 },
          { skill: "R03", w: 0.25 },
        ],
        // One kick a bar: the learner writes the beat, rather than saving one that is already there.
        code: { starter: kickLine("bd", 100) },
        bars: [1, 2],
        saveAs: "sketch",
        rubric: [
          {
            id: "every-beat",
            label: "A drum sound starts on each of the four beats, in every bar",
            required: true,
            skills: ["R01", "R03"],
            rule: "onsets",
            track: "@drums",
            contains: [
              [0, 1],
              [1, 4],
              [1, 2],
              [3, 4],
            ],
            perBar: true,
          },
          {
            id: "tempo",
            label: "A tempo between 70 and 140 beats per minute",
            required: false,
            skills: ["R02"],
            rule: "tempo-bpm",
            min: 70,
            max: 140,
          },
          {
            id: "two-lines",
            label: "At least two drum lines, each with its own name",
            required: false,
            skills: ["R01"],
            rule: "tracks",
            min: 2,
            roles: ["drums"],
          },
          {
            id: "star",
            label: "Uses `*` to repeat a sound",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.mini.repeat",
          },
        ],
        hints: ladder(
          "Each of the four beats needs a sound starting on it. What should a listener nod to?",
          "One word takes the whole bar. Four words share it out, one per beat.",
          "`bd sd bd sd` gives every beat a sound. Now make the sounds yours: `cp`, `rim`, `hh`, `sd` and `bd` all work.",
        ),
        tests: [
          { name: "minimal", response: { code: kickLine("bd sd bd sd", 100) }, expect: "pass" },
          {
            name: "the starter as it is: one kick a bar",
            response: { code: kickLine("bd", 100) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "beyond the brief",
            response: {
              code: `${tempo(118)}drums: s("bd cp bd cp")\nhats: s("hh*8")\nperc: s("rim rim rim rim")`,
            },
            expect: "pass",
          },
          {
            name: "three to a bar",
            response: { code: kickLine("bd sd bd", 100) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
