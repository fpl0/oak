// U00.L01 Hello, Loop. The first screen after "Start sound": the onboarding loop builds up one line at a
// time, the learner mutes lines to hear what each one does, changes one number in the melody, meets the
// tutor and saves Sketch 001. All of it runs on the onboarding loop, a preview context (contracts §3.1
// rule 5a): chord, voicing, n, scale, ebass and rhodes are heard here long before they unlock, and the
// learner only ever edits an `n` value. No tool is named in the prose. Spec: content/specs/U00.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const DRUMS = 'drums: s("bd ~ sd ~, hh*8").bank("RolandTR808").gain(.8)';
const BASS = 'bass: note("<c2 a1 f1 g1>").s("ebass").lpf(800)';
const CHORDS = 'chords: chord("<C Am F G>").voicing().s("rhodes").gain(.5)';
/** The melody's four cells, one per pass of the chords; the last cell is the one the learner changes. */
const mel = (last = "4", cells = `[4 ~ 2 4] [0 ~ ~ 2] [5 ~ 3 5] [${last} ~ ~ ~]`) =>
  `mel: n("<${cells}>").scale("C4:major").s("piano")`;
const loopOf = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

/** The onboarding loop (STYLE §14, `ONBOARDING_LOOP` in content/specs/U00.ts), character for character. */
const LOOP = loopOf(DRUMS, BASS, CHORDS, mel());
/** The same loop with its last melody number marked as the one editable region. */
const LOOP_ONE_NUMBER = loopOf(DRUMS, BASS, CHORDS, mel("⟪4⟫"));
/** The Make: the whole melody pattern is the learner's. */
const LOOP_MELODY_OPEN = loopOf(
  DRUMS,
  BASS,
  CHORDS,
  'mel: n("<⟪[4 ~ 2 4] [0 ~ ~ 2] [5 ~ 3 5] [4 ~ ~ ~]⟫>").scale("C4:major").s("piano")',
);

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U00.L01",
  version: 4,
  title: "Hello, Loop",
  objective: "I can start, stop and change a loop in code, and hear what each of its lines plays.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D01"],
  practises: [],
  terms: [
    { id: "term.loop", step: "S1" },
    { id: "term.timbre", step: "S2" },
  ],
  canDo: ["cd.code.first-loop"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "It builds",
      minutes: 0.75,
      // The onboarding loop is already a full band (drums, bass, chords, melody): no Band layer in U00.
      ui: { panels: ROLL, band: false },
      example: { id: "loop", code: LOOP, bars: 4, preview: true },
      exercise: {
        kind: "listen",
        id: "it-builds",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the four parts in order: the players come in one at a time. Let each part play until the music comes back to where it started, then go on to the next.",
        skills: [{ skill: "D01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: loopOf(DRUMS), caption: "The drums alone.", bars: 4 },
          { code: loopOf(DRUMS, BASS), caption: "The bass joins underneath.", bars: 4 },
          { code: loopOf(DRUMS, BASS, CHORDS), caption: "Soft keys come in between.", bars: 4 },
          { code: LOOP, caption: "Last, a piano plays the tune on top.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Four players",
      minutes: 0.75,
      ui: { panels: ROLL, band: false },
      exercise: {
        kind: "run-investigate",
        id: "four-players",
        version: 1,
        role: "practice",
        prompt:
          "Mute one line at a time with the button beside it and listen to what goes missing. Leave the code as it is. Then answer the two questions below.",
        skills: [{ skill: "D01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Mute every line but one and listen, then do the same for the next line. Find the line that sits lowest, then count the notes it plays before it repeats.",
        },
        hints: ladder(
          "You are looking for the line with the deepest notes. Mute lines one at a time: what disappears each time?",
          "Mute everything except one line, then swap. The name at the start of each line says who plays.",
          "Listen to `bass` and `mel` alone, one after the other: one sits far below the other.",
        ),
        code: { starter: LOOP },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which line plays the lowest notes?",
            options: [
              { id: "drums", label: "`drums`" },
              { id: "bass", label: "`bass`" },
              { id: "chords", label: "`chords`" },
              { id: "mel", label: "`mel`" },
            ],
            correct: ["bass"],
          },
          {
            q: "number",
            prompt: "Play `bass` on its own. How many different notes does it play before it starts over?",
            correct: 4,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bass"], number: 4 } }, expect: "pass" },
          {
            name: "heard the kick as the lowest",
            response: { answer: { choice: ["drums"], number: 4 } },
            expect: "fail",
          },
          {
            name: "counted one pass of the melody",
            response: { answer: { choice: ["bass"], number: 2 } },
            expect: "fail",
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Change one number",
      minutes: 1,
      ui: { panels: ROLL, band: false },
      exercise: {
        kind: "code-modify",
        id: "change-one-number",
        version: 1,
        role: "practice",
        prompt:
          "Change the highlighted number in the `mel` line to any other number from 0 to 7. It is the tune's last note. Listen to how the end of the tune changes. Done when the new number plays.",
        skills: [{ skill: "D01", w: 1 }],
        code: { starter: LOOP_ONE_NUMBER },
        reference: { solutions: [loopOf(DRUMS, BASS, CHORDS, mel("2"))], bars: 4 },
        // Not a test of taste: any new number passes. The constraints keep the edit on the highlighted
        // number; the rubric only asks that the loop still plays.
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "still-plays",
              label: "All four lines still play",
              required: true,
              skills: ["D01"],
              rule: "tracks",
              min: 4,
            },
          ],
        },
        constraints: [{ c: "edit-only-regions" }, { c: "max-changed-tokens", n: 1 }],
        target: { audible: true, showRoll: true },
        hints: ladder(
          "Change only the highlighted number to a different one. Which way do you want the last note to go, higher or lower?",
          "Only the highlighted number can change. It sits in the last pair of square brackets of the `mel` line.",
          "Bigger numbers play higher notes, smaller numbers lower ones. Try one far from the number there now.",
        ),
        tests: [
          { name: "reference", response: { code: loopOf(DRUMS, BASS, CHORDS, mel("2")) }, expect: "pass" },
          { name: "up high", response: { code: loopOf(DRUMS, BASS, CHORDS, mel("7")) }, expect: "pass" },
          { name: "unchanged", response: { code: LOOP }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "changed the first number instead",
            response: {
              code: loopOf(DRUMS, BASS, CHORDS, mel("4", "[2 ~ 2 4] [0 ~ ~ 2] [5 ~ 3 5] [4 ~ ~ ~]")),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "concept",
      title: "Meet the tutor",
      minutes: 0.75,
      ui: { panels: { roll: false, staff: false, keyboard: false }, band: false },
    },
    {
      id: "S5",
      kind: "make",
      title: "Sketch 001",
      minutes: 1.5,
      // The onboarding loop is already a full band; a Band layer would double every part.
      ui: { panels: ROLL, band: false },
      exercise: {
        kind: "code-make",
        id: "sketch-001",
        version: 1,
        // The default title of the saved sketch, as the step heading and the prose promise.
        title: "Sketch 001",
        role: "practice",
        prompt:
          "Change any numbers you like in the `mel` line and listen after each change. Save it when it sounds like yours. Keep at least two lines playing.",
        skills: [{ skill: "D01", w: 1 }],
        code: { starter: LOOP_MELODY_OPEN },
        bars: [4, 4],
        saveAs: "sketch",
        // Saving is never blocked: the one rule only catches a loop emptied by accident.
        rubric: [
          {
            id: "still-plays",
            label: "At least two lines still play",
            required: true,
            skills: ["D01"],
            rule: "tracks",
            min: 2,
          },
        ],
        hints: ladder(
          "Change one or more numbers in the `mel` line. Pick a part of the tune to change first: the start, the middle or the end.",
          "Each pair of square brackets in the `mel` line is one stretch of the tune. Each number in it is one note.",
          "Swap two numbers inside one pair of brackets, or put a `~` where a number was to leave a gap.",
        ),
        tests: [
          { name: "the loop as it is", response: { code: LOOP }, expect: "pass" },
          {
            name: "minimal: one number",
            response: { code: loopOf(DRUMS, BASS, CHORDS, mel("7")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a new tune",
            response: {
              code: loopOf(DRUMS, BASS, CHORDS, mel("4", "[7 ~ 4 5] [4 2 ~ 0] [3 ~ 5 7] [6 ~ 4 ~]")),
            },
            expect: "pass",
          },
          {
            name: "everything deleted but the tune",
            response: { code: loopOf(mel("2")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
