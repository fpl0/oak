// U01.L02 Count to Four. Beat 1 is where the bar starts, and a silent beat still counts. Tools in reach:
// everything from U01.L01 plus `~`, `.gain()` and the open hat, crash and ride (all unlocked here). Brackets
// arrive in U01.L04, so every pattern here is one word per beat. Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** One drum line, optionally with something chained after `s("…")`. */
const drums = (pattern: string, extra = "") => `${TEMPO}drums: s("${pattern}")${extra}`;
const HATS = 'hats: s("hh*8").gain(.6)';
/** The hook: a crash on every beat 1 over steady kicks and eighth hats. */
const HOOK = `${drums("cr bd bd bd")}\n${HATS}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Seconds of the n-th beat at `bpm` (tap tests are relative to the start of the stimulus). */
const beatTimes = (bpm: number, n: number, every = 1, offset = 0) =>
  Array.from({ length: n }, (_, i) => Number(((i * every + offset) * (60 / bpm)).toFixed(3)));

/** The Band plays bass and chords under the learner's drums. */
const BAND = { band: "band.two-chord-vamp", tracks: ["bass", "chords"] } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/**
 * Drum hits are one-shots: only where they start matters. `rhythm: "exact"` would also compare the length of
 * each slot, and reject `[bd ~]` for `bd` although the two sound the same.
 */
const DRUM_EVENTS = {
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
  id: "U01.L02",
  version: 3,
  title: "Count to Four",
  objective: "I can find beat 1, count a bar of four, and leave a beat silent without losing my place.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R06"],
  practises: ["R03"],
  terms: [
    { id: "term.downbeat", step: "S2" },
    { id: "term.rest", step: "S5" },
  ],
  canDo: ["cd.read.count-four"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Where the count starts",
      minutes: 0.5,
      ui: { panels: ROLL, band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "where-the-count-starts",
        version: 1,
        role: "practice",
        prompt:
          "Count along under your breath, one, two, three, four, and keep going around. Listen for the sound that tells you to start again at one.",
        skills: [{ skill: "R03", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four hits a bar under quick hats.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the one",
      minutes: 1.25,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "tap",
        id: "tap-the-one",
        version: 1,
        role: "practice",
        prompt:
          "Tap only on the crash, the long splashy cymbal that opens every bar: one tap per bar, four taps in all. Count the other three beats of each bar in your head without tapping them.",
        skills: [
          { skill: "R03", w: 0.5 },
          { skill: "E01", w: 0.5 },
        ],
        hints: ladder(
          "Tap once on each crash and nowhere else, four taps in all. How many kicks go by between one crash and the next?",
          "The crash is the first of the four beats. Count 1, 2, 3, 4 and tap on every 1.",
          "Say the count out loud and tap when you say one: tap, two, three, four, tap.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { drum: ["crash"] },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: TAP_FEEDBACK,
        srs: [{ family: "fam.rhy.pulse", mode: "evidence-only" }],
        tests: [
          { name: "on every crash", response: { taps: beatTimes(BPM, 4, 4) }, expect: "pass" },
          { name: "on every beat", response: { taps: beatTimes(BPM, 16) }, expect: "fail" },
          { name: "every other bar", response: { taps: beatTimes(BPM, 2, 8) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "A gap in the line",
      minutes: 0.5,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      example: { id: "gap", code: drums("bd bd ~ bd"), bars: 2 },
      exercise: {
        kind: "predict",
        id: "which-beat-goes-quiet",
        version: 1,
        role: "practice",
        prompt: "The drum line reads `bd bd ~ bd`. Predict which beat goes quiet, and pick it below.",
        skills: [{ skill: "R06", w: 1 }],
        hints: null,
        tests: [],
        code: drums("bd bd ~ bd"),
        bars: 2,
        mode: "choose",
        choices: [
          { id: "b1", label: "Beat 1" },
          { id: "b2", label: "Beat 2" },
          { id: "b3", label: "Beat 3" },
          { id: "b4", label: "Beat 4" },
        ],
        correct: ["b3"],
      },
    },
    {
      id: "S4",
      kind: "run",
      title: "See the gap",
      minutes: 0.5,
      ui: { panels: ROLL },
      example: { id: "gap-run", code: drums("bd bd ~ bd"), bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "see-the-gap",
        version: 1,
        role: "practice",
        prompt:
          "Count 1, 2, 3, 4 along with the loop. Say three out loud in the gap, where no kick plays, and find that gap on the roll.",
        skills: [{ skill: "R06", w: 1 }],
        hints: ladder(
          "Count along and find the beat with no kick. How many slots does the roll show in one bar?",
          "The `~` takes a whole beat of its own; nothing plays there.",
          "The kicks land on 1, 2 and 4.",
        ),
        tests: [],
        code: { starter: drums("bd bd ~ bd") },
        mustPlayLoops: 2,
        questions: [],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Silence beat 3",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "silence-beat-3",
        version: 1,
        role: "check",
        prompt:
          "Make beat 3 silent: replace the third word, `bd`, with a word that plays nothing. Keep beats 1, 2 and 4 as they are, so the line still has four words.",
        skills: [
          { skill: "R06", w: 0.6 },
          { skill: "R03", w: 0.4 },
        ],
        code: { starter: `${TEMPO}drums: s("⟪bd sd bd sd⟫")` },
        reference: { solutions: [drums("bd sd ~ sd")], bars: 1 },
        matcher: DRUM_EVENTS,
        target: { audible: true, showRoll: true },
        // The catalog says "missing hit" and "extra hit": these say what to do about it.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: no hit here yet{role}. Beats 1, 2 and 4 keep their sounds, and the line keeps four words.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a hit that should not be there{role}. Only beat 3 goes silent, and the line keeps four words.",
        },
        hints: ladder(
          "Beat 3 goes silent and the bar keeps four beats. If you delete a word, how many beats are left for the other three sounds to share?",
          "The third word is beat 3. It needs a word that plays nothing, so the bar keeps four words.",
          "In the line you ran before, `~` kept beat 3 silent in `bd bd ~ bd`.",
        ),
        tests: [
          { name: "reference", response: { code: drums("bd sd ~ sd") }, expect: "pass" },
          {
            name: "the same bar, a little softer",
            response: { code: drums("bd sd ~ sd", ".gain(.8)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: drums("bd sd bd sd") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "deleted the word instead",
            response: { code: drums("bd sd sd") },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
          {
            name: "silenced beat 2",
            response: { code: drums("bd ~ bd sd") },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "investigate",
      title: "Lean on the one",
      minutes: 1,
      ui: { panels: ROLL },
      exercise: {
        kind: "run-investigate",
        id: "lean-on-the-one",
        version: 1,
        role: "practice",
        prompt:
          'Listen for the kick that stands out. `.gain("1 .5 .5 .5")` sets how loud each kick is, one number per beat. Then answer the two questions below.',
        skills: [{ skill: "R03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. The four gain numbers line up with the four kicks: find the biggest, then listen for the kick it belongs to.",
        },
        hints: ladder(
          "Find the loudest kick by its number. Which number in the gain list is the biggest?",
          "The four numbers line up with the four kicks: the first number belongs to beat 1.",
          "A loud first kick stands out from the other three, so you always know where the count starts.",
        ),
        code: { starter: `${drums("bd bd bd bd", '.gain("1 .5 .5 .5")')}\n${HATS}` },
        mustPlayLoops: 2,
        questions: [
          {
            q: "number",
            prompt: "On which beat does the loudest kick land?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "How does that loud kick help a listener?",
            options: [
              { id: "start", label: "It tells them where each bar starts" },
              { id: "faster", label: "It makes the groove sound faster" },
              { id: "longer", label: "It adds a beat to the bar" },
            ],
            correct: ["start"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 1, choice: ["start"] } },
            expect: "pass",
          },
          {
            name: "thought it was faster",
            response: { answer: { number: 1, choice: ["faster"] } },
            expect: "fail",
          },
          {
            name: "picked the last kick",
            response: { answer: { number: 4, choice: ["start"] } },
            expect: "fail",
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "modify",
      title: "Kick on 1 and 3",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "kick-one-and-three",
        version: 1,
        role: "check",
        prompt:
          "Make the kick play on beats 1 and 3 only. Put `~` in place of the second and fourth words, so beats 2 and 4 are silent and the line keeps four words.",
        skills: [
          { skill: "R06", w: 0.5 },
          { skill: "R03", w: 0.5 },
        ],
        code: { starter: `${TEMPO}drums: s("⟪bd bd bd bd⟫")` },
        reference: { solutions: [drums("bd ~ bd ~")], bars: 1 },
        matcher: DRUM_EVENTS,
        constraints: [{ c: "must-use", tool: "tb.mini.rest", feedback: "code.must-use" }],
        target: { audible: true, showRoll: true },
        // The catalog says "missing hit" and "extra hit": these say which beats keep the kick.
        feedbackText: {
          "rhythm.missing": "Bar {bar}, {beatLabel}: no hit here yet{role}. Beats 1 and 3 keep their kick.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a hit that should be silent{role}. Only beats 1 and 3 keep their kick.",
          "code.must-use": "Use {tool} for each silent beat, so the line keeps four words.",
        },
        hints: ladder(
          "Beats 1 and 3 keep their kick, and beats 2 and 4 go silent. Which two of the four words stay as they are?",
          "Words 2 and 4 are beats 2 and 4. Each needs a word that plays nothing.",
          "Beat 2 becomes `~`. Do the same to beat 4.",
        ),
        srs: [{ family: "fam.code.mini", mode: "seed" }],
        tests: [
          { name: "reference", response: { code: drums("bd ~ bd ~") }, expect: "pass" },
          {
            name: "the same kicks, accented on 1",
            response: { code: drums("bd ~ bd ~", '.gain("1 .5 .8 .5")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: drums("bd bd bd bd") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "two words, no rests",
            response: { code: drums("bd bd") },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            name: "kicks on 2 and 4",
            response: { code: drums("~ bd ~ bd") },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
          {
            name: "silenced beat 4 only",
            response: { code: drums("bd bd bd ~") },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "A groove with air",
      minutes: 2.5,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "code-make",
        id: "groove-with-air",
        version: 1,
        role: "practice",
        prompt:
          "Write a one-bar groove with at least one silent beat: one whole beat where every line rests, the hats included. A `~` on the drums line alone is not enough while the hats keep playing. Use any drums you have: `bd`, `sd`, `hh`, `oh`, `cr`, `rd`, `cp`, `rim`.",
        skills: [
          { skill: "R06", w: 0.6 },
          { skill: "R03", w: 0.4 },
        ],
        code: { starter: `${drums("bd sd bd sd")}\n${HATS}` },
        bars: [1, 2],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-rest",
            // The effect, not the `~`: a rest in the drums under hats that keep playing leaves no beat empty.
            label: "One whole beat where every line is silent, hats included",
            required: true,
            skills: ["R06"],
            rule: "custom",
            fn: "silent-beat",
            params: { alsoUses: ["tb.mini.rest"] },
          },
          {
            id: "beat-one",
            label: "A drum sound starts on beat 1 of every bar",
            required: false,
            skills: ["R03"],
            rule: "onsets",
            track: "@drums",
            contains: [[0, 1]],
            perBar: true,
          },
          {
            id: "accent",
            label: "Uses `.gain()` to set how loud a line plays",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.gain",
          },
        ],
        hints: ladder(
          "Pick one beat and make every line silent there, the hats included. Where would a gap make the groove breathe?",
          "A beat is empty only when every line rests there, the hats too. Pick one beat and make it silent on the drums line and on the hats line.",
          'Write the hats one word per beat, `hats: s("hh hh ~ hh")`, and put `~` on beat 3 of the drums line too. A crash on beat 1 with a gap after it also marks the start of the bar.',
        ),
        tests: [
          {
            name: "minimal",
            response: { code: `${drums("bd sd ~ sd")}\nhats: s("hh hh ~ hh").gain(.6)` },
            expect: "pass",
          },
          { name: "the hats taken out", response: { code: drums("bd sd bd ~") }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: `${drums("cr ~ bd sd", '.gain("1 .5 .8 .6")')}\nhats: s("hh ~ oh hh").gain(.6)\nperc: s("~ ~ rim ~").gain(.5)`,
            },
            expect: "pass",
          },
          {
            name: "two empty beats, a crash and a kick on the downbeats",
            response: { code: `${drums("cr ~ sd ~")}\nkick: s("bd ~ bd ~")` },
            expect: "pass",
          },
          {
            name: "a rest in the drums, but the hats play through it",
            response: { code: `${drums("bd sd ~ sd")}\n${HATS}` },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the starter as it is",
            response: { code: `${drums("bd sd bd sd")}\n${HATS}` },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
