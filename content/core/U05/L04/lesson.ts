// U05.L04 Arpeggios. One thing a chord can do besides sound as a block: be played one note at a time
// (`.arp()`, which picks notes out of a stack by position, in the order they are written, the first as 0; every
// stack in this lesson is written lowest note first, so 0 is the lowest here). Review finding theory-c A3:
// `n("[4,0,2]").arp("0 1 2")` plays G, C, E. What the learner
// has: triads stacked by hand (U05.L01), the four qualities by ear and by their 3rds (U05.L02–L03). Not yet:
// chord names (U05.L09 "Chord Names", the next lesson: split out of this one in contracts 1.6, so this
// lesson keeps one idea), `chord()` and `.voicing()` (U05.L08), inversions (U05.L05).
// Spec: content/specs/U05.md.
//
// How it is graded: the arpeggio step compares the notes and their onsets (`events`, absolute pitch), since
// order and timing are the point. The Make's one required rule is `uses tb.arp`: the starter plays the same
// four triads as blocks.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** The loop of Stacking Thirds: C G Am F, a triad on each note of the Band's bass (1 5 6 4). */
const LOOP = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
/** A chord line of stacked degrees in C, broken by an `.arp()` pattern. */
const broken = (stacks: string, arp: string, extra = "") =>
  `chords: n("${stacks}").arp("${arp}").scale("C3:major").s("piano")${extra}`;
/** The same stacks as blocks. */
const blocks = (stacks: string, extra = "") => `chords: n("${stacks}").scale("C3:major").s("piano")${extra}`;
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Up and back down, a quarter note each: C E G E | G B D B | A C E C | F A C A. */
const HOOK = code(broken(LOOP, "0 1 2 1"));
const ONE_STACK = (arp: string) => code(broken("[0,2,4]", arp));
/** The modify step: the same pattern twice as fast, eight notes a bar. */
const EIGHTHS = code(broken(LOOP, "0 1 2 1 0 1 2 1"));
const eighthsTry = (arp: string) => code(broken(LOOP, arp));

/** A tune for the rich Make sketch: chord notes on the beats it plays (G E | B G | C A | A F). */
const TUNE = "<[4 ~ 2 ~] [6 ~ 4 ~] [7 ~ 5 ~] [5 ~ 3 ~]>";
const MAKE_STARTER = code(blocks(LOOP));

/** The Band's drums and its bass (C G A F, a bar each); the learner plays the chords. */
const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U05.L04",
  version: 4,
  title: "Arpeggios",
  objective: "I can play a chord one note at a time with .arp().",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["C01"],
  terms: [{ id: "term.arpeggio", step: "S4" }],
  canDo: ["cd.code.arpeggio"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Note by note",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-note-at-a-time",
        version: 1,
        role: "practice",
        prompt:
          "Loop 1 plays each chord a note at a time, Loop 2 the same chords as blocks. Listen for what the broken chords add between the drum hits.",
        skills: [{ skill: "C01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Each chord a note at a time, up and back down.",
            bars: 4,
          },
          { code: code(blocks(LOOP)), caption: "The same four chords as blocks.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which order?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "one-stack", code: ONE_STACK("0 2 1"), bars: 1 },
      exercise: {
        kind: "predict",
        id: "which-order",
        version: 1,
        role: "practice",
        prompt:
          'Predict the order in which `n("[0,2,4]").arp("0 2 1")` plays C, E and G, and pick it. The stack is written lowest first, so position 0 is C.',
        skills: [{ skill: "C01", w: 1 }],
        hints: null,
        tests: [],
        code: ONE_STACK("0 2 1"),
        bars: 1,
        mode: "choose",
        choices: [
          { id: "c-g-e", label: "C, then G, then E" },
          { id: "c-e-g", label: "C, then E, then G" },
          { id: "c-e-d", label: "C, then E, then D: degrees 1, 3 and 2" },
        ],
        correct: ["c-g-e"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Patterns of positions",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "the-loop", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "patterns-of-positions",
        version: 1,
        role: "practice",
        prompt:
          'Run the loop and count the notes in one bar on the roll. Then change the pattern inside `.arp("…")` to `0 1 2`, `2 1 0` and `0 2 1` in turn, run each, and watch the roll. Answer both questions below.',
        skills: [{ skill: "C01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. In `.arp()` each number is a position in the stack, in the order its notes are written: here 0 is the lowest note, 2 the highest.",
        },
        hints: ladder(
          "Look inside the quotes of `.arp()` and count the numbers: each one plays one note.",
          "Each number plays one note, and the numbers share the bar equally, as in any pattern string.",
          "A line that climbs straight up starts on the lowest note and ends on the highest: which position is the lowest?",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: 'With `.arp("0 1 2 1")`, how many notes does each bar play?',
            correct: 4,
          },
          {
            q: "choice",
            prompt: "Which pattern plays each chord climbing straight up, lowest to highest?",
            options: [
              { id: "up", label: "`0 1 2`" },
              { id: "down", label: "`2 1 0`" },
              { id: "skip", label: "`0 2 1`" },
            ],
            correct: ["up"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 4, choice: ["up"] } }, expect: "pass" },
          {
            name: "the top down",
            response: { answer: { number: 4, choice: ["down"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "three notes, one per position",
            response: { answer: { number: 3, choice: ["up"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Twice as fast",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "twice-as-fast",
        version: 1,
        role: "check",
        prompt:
          "The target plays every chord up and back down twice in a bar: eight notes instead of four. Change the pattern inside `.arp()` to match it. Done when each bar plays the same up-and-down shape twice.",
        skills: [{ skill: "C01", w: 1 }],
        code: { starter: code(broken(LOOP, "⟪0 1 2 1⟫")) },
        reference: { solutions: [EIGHTHS], bars: 4 },
        // The order and the timing are the point here, so the notes are compared with their onsets.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // The catalog says "the melody has", and this line is the chords.
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: you play {got} ({gotSyl}); the target plays {exp} ({expSyl}).",
          "melody.missing-note": "Bar {bar}, {beatLabel}: the target plays {exp} here, and you have nothing.",
        },
        hints: ladder(
          "The pattern needs one number for each note the target plays in a bar. Count them on the roll or by ear.",
          "The four positions you have go up and back down once. The target does exactly that, then does it again.",
          "Each half of the bar is the old pattern: lowest, middle, highest, middle. Write that, then once more.",
        ),
        tests: [
          { name: "reference", response: { code: EIGHTHS }, expect: "pass" },
          {
            name: "the same pattern, doubled with *2",
            response: { code: eighthsTry("[0 1 2 1]*2") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: eighthsTry("0 1 2 1") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "position 3 for the way down",
            response: { code: eighthsTry("0 1 2 3 0 1 2 3") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "eight slots, but rests between the notes",
            response: { code: eighthsTry("0 ~ 1 ~ 2 ~ 1 ~") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "Broken chords",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "broken-chords-on-the-bass",
        version: 1,
        role: "practice",
        prompt:
          "Your four triads play as blocks. Add `.arp()` to the `chords` line, after the stacks and before `.scale()`, with a pattern of your own: up, down, skipping, with gaps. Done when the chords play one note at a time.",
        skills: [{ skill: "C01", w: 1 }],
        // The catalog's text is "{label}: {detail}", and a progression's detail names the chords in Roman
        // numerals (U06.L02). The same text serves every rule, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "broken-with-arp",
            label: "The `chords` line plays its stacks one note at a time, with `.arp()`",
            required: true,
            skills: ["C01"],
            // Corrections gate (AS-41): the chords really sound one note at a time (`.arp("0")` and
            // `.arp("[0,1,2]")` do not break them), written with `.arp()`.
            rule: "custom",
            fn: "broken-chord",
            params: { track: "chords", alsoUses: ["tb.arp"] },
          },
          {
            id: "gaps",
            label: "A `~` somewhere, for a gap in the rhythm",
            required: false,
            skills: ["R06"],
            rule: "uses",
            tool: "tb.mini.rest",
          },
          {
            id: "a-tune",
            label: "A tune on its own line, such as `mel`",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
        ],
        hints: ladder(
          "The `chords` line needs one new method that picks which note of each stack plays when, as in the hook.",
          "`.arp()` goes after the stacks and before `.scale()`, with a pattern of positions in the stack as written: 0 the first note, here the lowest, 2 the last, here the highest.",
          'Start from `.arp("0 1 2 1")`, then change one number, or put a `~` where a note was.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: up and back down", response: { code: HOOK }, expect: "pass" },
          {
            name: "beyond the brief: a gapped pattern, the room and a tune",
            response: {
              code: code(broken(LOOP, "0 ~ 2 1 [0 2] ~ 1 2", ".gain(.7).room(.3)"), mel(TUNE)),
            },
            expect: "pass",
          },
          {
            name: "broken by hand, one degree at a time, no .arp()",
            response: {
              code: code(
                'chords: n("<[0 2 4 2] [4 6 8 6] [5 7 9 7] [3 5 7 5]>").scale("C3:major").s("piano")',
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
