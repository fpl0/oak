// A2.L07 Hocket (spec: content/specs/A2.md). The book's "Linear Rhythm in Melodies": one tune split between two
// sounds note by note, each playing where the other rests, so the ear follows one line that keeps changing colour.
// It is not call and response (whole phrases traded) and not a doubling. Its cousin, "Sound-Color Melody", is the
// ungraded S5: a slow line whose notes each change sound.
//
// Written for the learner at the gate (AUTHORING §20.1): A2 opens after U10.CP and A1.L07, so the tools are the
// A2 loop's (minor, degree stacks) and nothing of U11 onward; `marimba`, `kalimba` and `glockenspiel` unlock at
// A2.L06, after this lesson, and `.late`/`.early` at U13.L01. The loop is A2.L03's A minor loop at 90 BPM
// (Am F C G) over `band.aeolian-4bar`'s drums; the second line is labelled `vox` (STYLE §2).
//
// The given line is Oak's own: four bars of eighths in A minor, every note on a beat a note of its bar's chord
// (bar 1 Am: A C E C; bar 2 F: A C F C; bar 3 C: C E G E; bar 4 G: G D B G; evaluated, AUTHORING §20.2 rule 5).
// A one-bar line cannot fit the loop: no note is in all four chords (X9).
//
// The corrections-pass standard (AUTHORING §20.2) on S4 and the Make: both grade the `hocket` rule, which reads the
// heard notes of `mel` and `vox` against the whole four-bar line (`pitches` per loop): every note once in its place,
// no note twice, nothing ringing over the next, two sounds, each sound in every bar (whole bars traded fail: call
// and response), each with a share. A part more than 24 dB under the loudest sounds no notes to the grader, so a
// `vox` turned down to nothing fails. The right-function wrong answers: `vox` playing with `mel` (a doubling), and
// the moved notes at `.gain(.02)`.
import { defineLesson, type HintLadder, type RubricRule, type TestCase } from "@oak/content-kit";

const BPM = 90;
const code = (...lines: string[]) => `setcpm(${BPM}/4)\n\n${lines.join("\n")}`;
const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];
const test = (
  name: string,
  src: string,
  expect: "pass" | "fail",
  feedback?: NonNullable<TestCase["feedback"]>,
): TestCase => ({
  name,
  response: { code: src },
  expect,
  ...(feedback ? { feedback } : {}),
});

/** The A2 loop of A2.L03: the roots low, Am F C G as close triads from C3 to E4. */
const BASS = 'bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)';
const CHORDS = 'chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("piano").gain(.5)';

/** The given line, as degrees of A4 minor, one bracket of eight eighths per bar. */
const LINE = ["0 1 2 3 4 3 2 1", "0 1 2 3 5 4 2 1", "2 3 4 5 6 5 4 3", "6 5 3 2 1 2 6 4"];
/** Half steps above A of each degree of A minor. */
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const midiOf = (degree: number) =>
  69 + 12 * Math.floor(degree / 7) + (MINOR[((degree % 7) + 7) % 7] as number);
/** The rule's `pitches`: the line's 32 notes in order (checked against the evaluated line by the pins). */
const PITCHES = LINE.flatMap((bar) => bar.split(" ").map((d) => midiOf(Number(d))));

/** The line with only the notes `keep` chooses (by their place 0–31 in the line), the rest as rests. */
const part = (keep: (i: number) => boolean) =>
  `<${LINE.map(
    (bar, b) =>
      `[${bar
        .split(" ")
        .map((d, s) => (keep(b * 8 + s) ? d : "~"))
        .join(" ")}]`,
  ).join(" ")}>`;
const REST_BAR = "[~ ~ ~ ~ ~ ~ ~ ~]";
const EMPTY = `<${REST_BAR} ${REST_BAR} ${REST_BAR} ${REST_BAR}>`;
const FULL = part(() => true);

const MEL_SOUND = '.scale("A4:minor").s("square").lpf(2000).gain(.5)';
const VOX_SOUND = '.scale("A4:minor").s("piano").gain(.5)';
const mel = (pattern: string, tail = MEL_SOUND) => `mel: n("${pattern}")${tail}`;
const vox = (pattern: string, tail = VOX_SOUND) => `vox: n("${pattern}")${tail}`;

const odd = (i: number) => i % 2 === 1;
const even = (i: number) => i % 2 === 0;
/** Two notes, then one, round and round: turns that cross the bar line. */
const twoThenOne = (i: number) => i % 3 === 2;
/** Turns of one, two, one and three notes, then again. */
const irregular = (i: number) => [1, 2, 4, 5, 6].includes(i % 7);
/** Three notes each, crossing the bar line. */
const threes = (i: number) => Math.floor(i / 3) % 2 === 1;
/** Whole bars: `vox` takes bars 2 and 4. */
const wholeBars = (i: number) => Math.floor(i / 8) % 2 === 1;
/** `vox`'s notes: the hocket's notes; `mel` keeps the rest. */
const split = (toVox: (i: number) => boolean, voxTail = VOX_SOUND, melTail = MEL_SOUND) => [
  mel(
    part((i) => !toVox(i)),
    melTail,
  ),
  vox(part(toVox), voxTail),
];

// S1, S3, S4: the line alone over the Band's drums.
const ONE_SOUND = code(mel(FULL));
const HOCKET = code(...split(odd));
/** S3: the same hocket, broken in bar 3: `vox` doubles the tune's first note there. */
const BROKEN = code(
  ...split(odd).map((line, i) => (i === 1 ? line.replace("[~ 3 ~ 5 ~ 5 ~ 3]", "[2 3 ~ 5 ~ 5 ~ 3]") : line)),
);

/** S2: one bar, split in pairs. */
const PAIRS = code(mel("0 1 ~ ~ 4 3 ~ ~"), vox("~ ~ 2 3 ~ ~ 2 1"));

/** S4: the whole line on `mel`, `vox` empty. */
const STARTER = code(mel(`⟪${FULL}⟫`), vox(`⟪${EMPTY}⟫`));
const UNCHANGED = code(mel(FULL), vox(EMPTY));
const at4 = (...lines: string[]) => code(...lines);

// S5: a slow line of repeated notes, one sound against a sound per note.
const SLOW = "<[4 4 4 4] [2 2 2 2] [0 0 0 0] [1 1 1 1]>";
const COLOUR = code(`mel: n("${SLOW}").scale("A4:minor").s("square piano triangle piano").gain(.5)`);
const PLAIN = code(`mel: n("${SLOW}").scale("A4:minor").s("square").lpf(2000).gain(.5)`);

// S6, the Make: the A2 loop with the line on `mel` and an empty `vox`.
const MAKE_STARTER = code(BASS, CHORDS, mel(FULL), vox(EMPTY));
const make = (...lines: string[]) => code(BASS, CHORDS, ...lines);
const MAKE_REFERENCE = make(...split(odd));

const WRONG_QUOTES = (src: string) =>
  src.replace('vox: n("', "vox: n('").replace(/(vox: n\('[^"]*)"\)/, "$1')");

const HOCKET_RULE: RubricRule = {
  id: "one-line-two-sounds",
  label:
    "`mel` and `vox` play every note of the line once between them, each in its place and never together, on two different sounds, taking turns inside every bar",
  required: true,
  skills: ["D09", "M07"],
  rule: "custom",
  fn: "hocket",
  params: { tracks: ["mel", "vox"], pitches: PITCHES, steps: 8 },
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.aeolian-4bar", tracks: ["drums"] } as const;

/** Right answers and the book's misses, for S4 (line alone) and the Make (`wrap` adds the loop). */
const corrections = (wrap: (...lines: string[]) => string): TestCase[] => [
  test("vox starts: the odd notes stay on mel", wrap(...split(even)), "pass"),
  test("two notes then one, across the bar lines", wrap(...split(twoThenOne)), "pass"),
  test("turns of one, two, one and three notes", wrap(...split(irregular)), "pass"),
  test(
    "vox on triangle, a little quieter",
    wrap(...split(odd, '.scale("A4:minor").s("triangle").gain(.4)')),
    "pass",
  ),
  test("whole bars traded: call and response", wrap(...split(wholeBars)), "fail", ["rubric.unmet"]),
  test("vox doubles every note of mel", wrap(mel(FULL), vox(FULL)), "fail", ["rubric.unmet"]),
  test(
    "the right notes moved to vox, turned down until they are not heard",
    wrap(...split(odd, '.scale("A4:minor").s("piano").gain(.02)')),
    "fail",
    ["rubric.unmet"],
  ),
  test(
    "both sounds square",
    wrap(...split(odd, '.scale("A4:minor").s("square").lpf(2000).gain(.5)')),
    "fail",
    ["rubric.unmet"],
  ),
  test(
    "one note lost in the move: bar 2's last note on neither line",
    wrap(
      ...split(odd).map((line, i) =>
        i === 1 ? line.replace("[~ 1 ~ 3 ~ 4 ~ 1]", "[~ 1 ~ 3 ~ 4 ~ ~]") : line,
      ),
    ),
    "fail",
    ["rubric.unmet"],
  ),
  test(
    "both lines play beat 1 of bar 1",
    wrap(
      ...split(odd).map((line, i) =>
        i === 1 ? line.replace("[~ 1 ~ 3 ~ 3 ~ 1]", "[0 1 ~ 3 ~ 3 ~ 1]") : line,
      ),
    ),
    "fail",
    ["rubric.unmet"],
  ),
  test("single quotes in vox", WRONG_QUOTES(wrap(...split(odd))), "fail", ["code.single-quoted-pattern"]),
];

export default defineLesson({
  id: "A2.L07",
  version: 1,
  title: "Hocket",
  objective: "One line split across two sounds, note by note.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["D09", "M07"],
  terms: [{ id: "term.hocket", step: "S4" }],
  canDo: ["cd.compose.hocket"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One tune, two sounds",
      minutes: 0.5,
      ui: { panels: ROLL, band: DRUMS },
      example: { id: "hocket", code: HOCKET, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-tune-two-sounds",
        version: 1,
        role: "practice",
        prompt:
          "Listen to loop 1, a tune on one sound, then loop 2, the same tune passed between two sounds. Listen for whether loop 2 still sounds like one tune.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: ONE_SOUND, caption: "Loop 1: the tune on one sound.", bars: 4 },
          { code: HOCKET, caption: "Loop 2: the same tune, its notes shared by two sounds.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Whose notes?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "whose-notes",
        version: 1,
        role: "practice",
        prompt:
          "One bar of eight notes is shared by `mel` and `vox`. Read the code and predict which of the eight notes `vox` plays. Pick it, then listen.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        code: PAIRS,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "pairs", label: "Notes 3, 4, 7 and 8" },
          { id: "alternate", label: "Notes 2, 4, 6 and 8" },
          { id: "half", label: "Notes 5 to 8" },
        ],
        correct: ["pairs"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Find the doubled note",
      minutes: 1,
      ui: { panels: ROLL, band: DRUMS },
      example: { id: "broken", code: BROKEN, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "find-the-doubled-note",
        version: 1,
        role: "practice",
        prompt:
          "This split has one mistake: in one bar both sounds play a note at the same moment. Play it, watch `mel` and `vox` on the roll, and pick that bar.",
        skills: [{ skill: "D09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not that bar. On the roll, look for a beat where a `mel` note and a `vox` note start together.",
        },
        hints: ladder(
          "In a shared line each note belongs to one sound. Look for a moment where both sounds play.",
          "Go bar by bar on the roll and compare the start of each `mel` note with the `vox` notes.",
          "Look at the first beat of each bar: in which bar does `vox` not rest there?",
        ),
        code: { starter: BROKEN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "In which bar do both sounds play at the same moment?",
            options: [
              { id: "b1", label: "Bar 1" },
              { id: "b2", label: "Bar 2" },
              { id: "b3", label: "Bar 3" },
              { id: "b4", label: "Bar 4" },
            ],
            correct: ["b3"],
          },
        ],
        tests: [
          { name: "bar 3", response: { answer: { choice: ["b3"] } }, expect: "pass" },
          {
            name: "bar 1",
            response: { answer: { choice: ["b1"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Share the line",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "share-the-line",
        version: 1,
        role: "check",
        prompt:
          "Move every second note of the tune from `mel` to `vox`: in each bar, notes 2, 4, 6 and 8 go to `vox`, and `mel` rests in their place. Done when the two lines together play the whole tune, each note once, never at the same moment.",
        skills: [
          { skill: "D09", w: 0.6 },
          { skill: "M07", w: 0.4 },
        ],
        code: { starter: STARTER },
        reference: { solutions: [HOCKET], bars: 4 },
        matcher: { m: "rubric", rules: [HOCKET_RULE] },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet": "{label}: not yet. {detail}. Play it and follow the tune from sound to sound.",
        },
        hints: ladder(
          "Each bracket in `mel` is one bar of eight notes. Which of them should move, and what is left in their place?",
          "`vox` has the same brackets, all rests. A note that moves to `vox` keeps its place in the bracket, and `mel` gets a `~` there.",
          "Bar 1 of `mel` becomes notes 1, 3, 5 and 7 with rests between them. Bar 1 of `vox` is the other four, in the same places.",
        ),
        tests: [
          test("reference: every second note on vox", HOCKET, "pass"),
          test("unchanged", UNCHANGED, "fail", ["code.unchanged"]),
          ...corrections(at4),
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "A tune of colours",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "a-tune-of-colours",
        version: 1,
        role: "practice",
        prompt:
          "Both versions play the same slow tune, each bar one note four times. Pick the version where the repeated notes still seem to move.",
        skills: [{ skill: "D09", w: 1 }],
        stimulus: { src: "code", code: COLOUR, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "colour", label: "Version A", audio: COLOUR },
            { id: "plain", label: "Version B", audio: PLAIN },
          ],
        },
        correct: { choice: ["colour"] },
        hints: ladder(
          "Listen to one bar of each version: four times the same note. What changes from one to the next?",
          "In one version every repeat sounds the same. Listen to the other for what is different from note to note.",
          "Follow the sound of each note, not its pitch.",
        ),
        feedbackText: {
          "id.wrong":
            "In that version every repeat has the same sound. Listen to the other one for the sound changing from note to note.",
        },
        tests: [
          { name: "the colours", response: { answer: { choice: ["colour"] } }, expect: "pass" },
          {
            name: "one sound",
            response: { answer: { choice: ["plain"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your own split",
      minutes: 2.75,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-own-split",
        version: 1,
        role: "practice",
        prompt:
          "Share the tune between `mel` and `vox` your own way: turns of one, two or three notes, crossing the bar line if you like. Keep every note of the tune once, give `vox` its own sound, and keep the bass and chords. Done when both sounds play in every bar and never at the same moment.",
        skills: [
          { skill: "D09", w: 0.6 },
          { skill: "M07", w: 0.4 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [HOCKET_RULE],
        feedbackText: {
          "rubric.unmet": "{label}: not yet. {detail}. Follow the tune from sound to sound as it plays.",
        },
        hints: ladder(
          "Sing the tune and choose where it should change colour. Which notes would you give the second sound?",
          "Copy a bracket of `mel` into `vox`, then in each line put a `~` wherever the other line keeps the note.",
          "Try a pattern of turns, such as two notes on `mel` and one on `vox`, and let it run on across the bar lines.",
        ),
        tests: [
          test("the starter as it is", MAKE_STARTER, "fail", ["rubric.unmet"]),
          test("reference: every second note on vox", MAKE_REFERENCE, "pass"),
          test("minimal: three notes each, crossing bar lines", make(...split(threes)), "pass"),
          test(
            "beyond the brief: vox on triangle with room, in turns of one, two, one and three",
            make(...split(irregular, '.scale("A4:minor").s("triangle").gain(.45).room(.3)')),
            "pass",
          ),
          ...corrections(make),
        ],
      },
    },
  ],
});
