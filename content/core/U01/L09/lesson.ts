// U01.L09 Copy That Groove. Copy a groove by ear (transcription ladder L1), and hear the same groove at
// half and double time with .slow(2) and .fast(2). The rolling, laid-back hats in S5 are a preview:
// `swingBy` stays locked until U11.L07, so that version lives only in a read-only `preview` example and
// no term names it. Tools in reach: everything in U01, plus .slow, .fast, the LinnDrum, AkaiLinn and
// RolandTR707 kits, shaker, cowbell and tambourine, which unlock here. Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const KICK_HOOK = "bd ~ [~ bd] ~";
const BACKBEAT = "~ sd ~ sd";
const HATS8 = "hh*8";
/** One labelled LinnDrum line; `time` is `.slow(2)`, `.fast(2)` or nothing. */
const linn = (label: string, pattern: string, time = "", gain = "") =>
  `${label}: s("${pattern}")${time}.bank("LinnDrum")${gain}`;
/** The hook with the same time change on every line. */
const hook = (time = "") =>
  code(linn("kick", KICK_HOOK, time), linn("snare", BACKBEAT, time), linn("hats", HATS8, time, ".gain(.5)"));
const HOOK = hook();
const HALF = hook(".slow(2)");
const DOUBLE = hook(".fast(2)");
/** The preview: the same hook with the hats rolling, long-short, instead of even. */
const ROLLING = code(
  linn("kick", KICK_HOOK),
  linn("snare", BACKBEAT),
  'hats: s("hh*8").swingBy(1/3, 4).bank("LinnDrum").gain(.5)',
);

/** The groove to copy in S3: a kick that pushes into the next bar under a backbeat, on the eighth grid. */
const COPY_KICK = "bd ~ bd [~ bd]";
const COPY = code(linn("kick", COPY_KICK), linn("snare", BACKBEAT));
const answer = (kick: string, snare = BACKBEAT) => code(`kick: s("${kick}")`, `snare: s("${snare}")`);

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band plays bass and chords under the learner's drums. */
const BAND = { band: "band.two-chord-vamp", tracks: ["bass", "chords"] } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drum hits are one-shots: only where they start matters, never the length of their slot. */
const DRUM_MATCH = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  sound: "drum-role",
} as const;

export default defineLesson({
  id: "U01.L09",
  version: 5,
  title: "Copy That Groove",
  objective: "I can copy a drum groove by ear and play the same groove at half or double time.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E01", "R05"],
  terms: [
    { id: "term.half-time", step: "S2" },
    { id: "term.double-time", step: "S2" },
  ],
  canDo: ["cd.transcribe.drums"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One groove, three ways",
      minutes: 0.5,
      ui: { panels: ROLL, band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "three-ways",
        version: 1,
        role: "practice",
        prompt:
          "Nod along at the same speed through all three loops. Listen for which version feels heavier and which feels more urgent.",
        skills: [{ skill: "R05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "The groove on a LinnDrum, a drum machine from the early 1980s.", bars: 4 },
          {
            code: HALF,
            caption: "The same three lines, each with `.slow(2)`. Keep nodding at the same speed.",
            bars: 4,
          },
          { code: DOUBLE, caption: "The same three lines, each with `.fast(2)`.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Same tempo, heavier",
      minutes: 1,
      ui: { panels: ROLL },
      exercise: {
        kind: "run-investigate",
        id: "same-tempo-heavier",
        version: 1,
        role: "practice",
        prompt:
          "This is the `.slow(2)` version of the groove. Count the four beats of each bar and watch where the snare lands on the roll. Then answer the two questions below.",
        skills: [{ skill: "R05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch the snare lane and count the beats of each bar: where does the snare land now, and how often?",
        },
        hints: ladder(
          "Find where the snare lands now, and how often. How long does the groove take before it starts again?",
          "`.slow(2)` stretches one bar of pattern over two bars. The tempo line did not change.",
          "The snare that was on beat 2 now lands twice as late in the bar.",
        ),
        code: { starter: HALF },
        mustPlayLoops: 2,
        questions: [
          {
            q: "choice",
            prompt: "Which version keeps the tempo but lands the backbeat half as often?",
            options: [
              { id: "as-written", label: "The first, as written" },
              { id: "slow", label: "The one with `.slow(2)`" },
              { id: "fast", label: "The one with `.fast(2)`" },
            ],
            correct: ["slow"],
          },
          {
            q: "number",
            prompt: "In the `.slow(2)` version, on which beat of each bar does the snare land?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["slow"], number: 3 } }, expect: "pass" },
          {
            name: "picked the fast one",
            response: { answer: { choice: ["fast"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "snare still on 2",
            response: { answer: { choice: ["slow"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "dictate",
      title: "Copy the groove",
      minutes: 2,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "transcribe-step",
        id: "copy-the-groove",
        version: 1,
        role: "check",
        prompt:
          "Write the groove you hear as two lines under `setcpm(96/4)`: a `kick:` line and a `snare:` line, each one bar long. Slow it down or loop it as often as you like. Done when both lines play what you hear.",
        skills: [
          { skill: "E01", w: 0.5 },
          { skill: "R05", w: 0.5 },
        ],
        hints: [
          {
            text: "Copy the snare first, then the kick. Which drum plays on the beats you nod to, and which one answers it?",
            replay: { isolate: "drums" },
          },
          {
            text: "The snare is a plain backbeat. The kick plays three times, and one of its hits falls between two beats.",
          },
          {
            text: "The kick is on beats 1 and 3. Listen to the end of the bar for the third kick.",
            replay: { rate: 0.5 },
          },
          "auto",
        ],
        projectId: "u01-l09-copy",
        ladder: 1,
        stimulus: { src: "code", code: COPY, bars: 2, showCode: false },
        layer: "drums",
        bars: [1, 2],
        grading: {
          mode: "auto",
          reference: { solutions: [answer(COPY_KICK)], bars: 2 },
          matcher: { m: "rhythm", tol: [1, 32], durations: false, perRole: true, displacementCredit: 0.5 },
        },
        studio: { minRate: 0.5, overlay: true },
        srs: [{ family: "fam.rhy.dictation", mode: "seed" }],
        tests: [
          { name: "reference", response: { code: answer(COPY_KICK) }, expect: "pass" },
          { name: "on the same kit as the recording", response: { code: COPY }, expect: "pass" },
          {
            name: "every beat as two eighths",
            response: { code: answer("[bd ~] [~ ~] [bd ~] [~ bd]", "[~ ~] [sd ~] [~ ~] [sd ~]") },
            expect: "pass",
          },
          {
            // One hit short of five a bar scores 0.88: transcription passes at 0.85 (contracts §6.12), and
            // the learner reads which hit is missing.
            name: "missed the push: close enough to pass",
            response: { code: answer("bd ~ bd ~") },
            expect: "pass",
            feedback: ["rhythm.missing"],
          },
          {
            name: "the last kick on the beat",
            response: { code: answer("bd ~ bd bd") },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
          {
            name: "the push a beat early, on the and of 3",
            response: { code: answer("bd ~ [bd bd] ~") },
            expect: "fail",
            feedback: ["rhythm.displaced"],
          },
          {
            name: "no snare line",
            response: { code: `${TEMPO}kick: s("${COPY_KICK}")` },
            expect: "fail",
            feedback: ["rhythm.role-missing"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Make it heavier",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "make-it-heavier",
        version: 1,
        role: "check",
        prompt:
          'Make the groove half-time: add `.slow(2)` to all three lines, straight after each `s("…")`. Done when kick, snare and hats all play at half pace.',
        skills: [{ skill: "R05", w: 1 }],
        code: { starter: HOOK },
        reference: { solutions: [HALF], bars: 2 },
        matcher: DRUM_MATCH,
        target: { audible: true, showRoll: true },
        // The catalog says "extra hit": this says which lines to check.
        feedbackText: {
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a hit that should not be there{role}. Every line needs `.slow(2)`: check that each of the three has it, and that none has `.fast(2)`.",
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: no hit here yet{role}. Every line needs `.slow(2)`: check that each of the three has it, and that none has `.fast(2)`.",
        },
        hints: ladder(
          "All the drum lines need `.slow(2)`. How many lines play drums?",
          "`.slow(2)` goes into each line's chain, before `.bank(…)`.",
          'The kick line becomes `kick: s("bd ~ [~ bd] ~").slow(2).bank("LinnDrum")`. The other two lines follow.',
        ),
        tests: [
          { name: "reference", response: { code: HALF }, expect: "pass" },
          {
            name: "slow after the bank",
            response: {
              code: code(
                `kick: s("${KICK_HOOK}").bank("LinnDrum").slow(2)`,
                `snare: s("${BACKBEAT}").bank("LinnDrum").slow(2)`,
                `hats: s("${HATS8}").bank("LinnDrum").gain(.5).slow(2)`,
              ),
            },
            expect: "pass",
          },
          { name: "unchanged", response: { code: HOOK }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "only the kick slowed",
            response: {
              code: code(
                linn("kick", KICK_HOOK, ".slow(2)"),
                linn("snare", BACKBEAT),
                linn("hats", HATS8, "", ".gain(.5)"),
              ),
            },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
          {
            name: "fast instead of slow",
            response: { code: DOUBLE },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Which one leans back?",
      minutes: 0.75,
      ui: { panels: ROLL },
      example: { id: "rolling", code: ROLLING, bars: 2, preview: true },
      exercise: {
        kind: "identify",
        id: "leans-back",
        version: 1,
        role: "practice",
        prompt:
          "Tap your foot on the beat and listen to the hats between the taps. Pick the version, A or B, where those hats lean back and roll instead of ticking evenly.",
        skills: [{ skill: "R05", w: 1 }],
        hints: ladder(
          "Compare the hats in A and B. Are the gaps between them all the same?",
          "In one version every hat sits exactly halfway between two beats. In the other, the hat between two beats arrives late.",
          "Tap your foot on the beat and listen to what happens between two taps.",
        ),
        stimulus: { src: "code", code: HOOK, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        },
        correct: { choice: ["b"] },
        feedbackText: {
          "id.wrong":
            "Not that one. Tap your foot on the beat and listen to the hat between two taps: halfway, or late?",
        },
        tests: [
          { name: "B leans back", response: { answer: { choice: ["b"] } }, expect: "pass" },
          { name: "A", response: { answer: { choice: ["a"] } }, expect: "fail", feedback: ["id.wrong"] },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Copy and flip",
      minutes: 2.5,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "code-make",
        id: "copy-and-flip",
        version: 1,
        role: "practice",
        prompt:
          "Write the groove for the quiet part of your song, the four bars before the last loud part. Change its speed with `.slow(2)` for half-time or `.fast(2)` for double-time, on one line or on all of them. Done when at least one line plays at a new speed.",
        skills: [
          { skill: "R05", w: 0.5 },
          { skill: "E01", w: 0.5 },
        ],
        code: { starter: HOOK },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "slow-or-fast",
            label: "At least one line that plays changes speed with `.slow()` or `.fast()`",
            required: true,
            skills: ["R05"],
            // The effect, not the call: `.slow(1)` keeps the speed it had.
            rule: "custom",
            fn: "speed-change",
          },
          {
            id: "new-kit",
            label: "Picks a drum machine with `.bank()`",
            required: false,
            skills: ["R04"],
            rule: "uses",
            tool: "tb.bank",
          },
          {
            id: "shaker",
            label: "Uses the shaker `sh`",
            required: false,
            skills: ["R05"],
            rule: "sounds",
            contains: ["snd.drum.sh"],
          },
        ],
        hints: ladder(
          "Add `.slow(2)` or `.fast(2)` to at least one line. Which part of the groove would sound good half as busy, or twice as busy?",
          '`.slow(2)` and `.fast(2)` go into a line\'s chain, after the `s("…")`.',
          "Try `.fast(2)` on the hats line alone: the kick and snare stay put while the hats double.",
        ),
        tests: [
          {
            name: "the starter: no flip yet",
            response: { code: HOOK },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: all half-time", response: { code: HALF }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: code(
                'kick: s("<[bd ~ [~ bd] ~] [bd ~ bd ~]>").bank("AkaiLinn")',
                'snare: s("~ sd ~ sd").slow(2).bank("AkaiLinn")',
                'hats: s("hh*8").fast(2).bank("AkaiLinn").gain(.4)',
                'perc: s("[~ sh]*4").bank("RolandTR707").gain(.5)',
                'perc2: s("<~ ~ ~ [cb ~ cb cb]>").bank("RolandTR707").gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "`.slow(1)`: the speed it had",
            response: {
              code: code(
                linn("kick", KICK_HOOK, ".slow(1)"),
                linn("snare", BACKBEAT),
                linn("hats", HATS8, "", ".gain(.5)"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "double-time on the hats alone",
            response: {
              code: code(
                linn("kick", KICK_HOOK),
                linn("snare", BACKBEAT),
                linn("hats", HATS8, ".fast(2)", ".gain(.4)"),
              ),
            },
            expect: "pass",
          },
          { name: "all double-time", response: { code: DOUBLE }, expect: "pass" },
          {
            name: "a half-time snare under a shaker",
            response: {
              code: code(
                linn("kick", "bd ~ bd ~"),
                linn("snare", BACKBEAT, ".slow(2)"),
                'perc: s("sh*8").bank("RolandTR707").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "a new kit, but no flip",
            response: {
              code: code(
                'kick: s("bd ~ bd ~").bank("RolandTR707")',
                'snare: s("~ sd ~ sd").bank("RolandTR707")',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
