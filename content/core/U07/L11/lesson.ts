// U07.L11 Turn It Around (Oak 2.0 W2; DeSantis, *Making Music*, "Note Transformations"). A motif can be changed
// in more ways than moving it (a sequence) or reading it backwards (U07.L02): turned upside down, its notes started
// from a later note and wrapped round with the rhythm kept, or moved in time. Each keeps something and changes
// something, and the ear can tell which. What the learner has: degrees in `n`, `.add(n(…))` before `.scale()`
// (U06.L01), a motif, a sequence and a retrograde with `.rev()` (U07.L02), `@` for longer notes (U01.L05). Not
// yet: `.early()`/`.late()` (U13.L01), so the time shift is written by moving the rest in the mini-notation;
// `.superimpose()` (U07.L07), so a copy that plays with the motif is its own labelled line. Strudel 1.2.6 has no
// `.rot()`: a rotation is written by rewriting the numbers.
//
// The motif has an uneven rhythm on purpose (two eighths, a quarter, two eighths, a quarter rest) and five
// different degrees, so a rotation (the notes start later in the order, every place in time kept) and a time
// shift (every note moved later, the order kept) sound different, and the rules can tell them apart (evaluated:
// C4 E4 G4~ F4 D4 at 0, 1/8, 1/4, 1/2, 5/8; the rotation from the third note G4 F4~ D4 C4 E4 keeps those onsets; the
// shift by an eighth plays C4 at 1/8). The motif spans 1 to 5, so its middle is 3: mirrored around it
// (degree sum 4) the copy keeps the motif's range, 5 3 1~ 2 4. The rule `inverted-copy` accepts any fixed centre
// (the degree sum is constant), so the prompt asks for the mirror, not for its centre.
//
// Grading: S4 and S6 keep the motif as it is (`events` on `mel`) and read the copy against it (`inverted-copy`,
// `rotated-copy`); the Make requires `time-shifted` with at least an eighth note's shift. Fidelity pins:
// content/validate/pins/U07.L11.ts.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The motif in eighth-note slots: 1 3 5~ 4 2, then a quarter rest. */
const MOTIF = "0 2 4@2 3 1 ~ ~";
/** Two degrees higher. */
const UP = "2 4 6@2 5 3 ~ ~";
/** Upside down around the motif's middle (degree 3): 5 3 1~ 2 4. */
const INV = "4 2 0@2 1 3 ~ ~";
/** Backwards, each note in the place of the one it replaces: 2 4 5~ 3 1. */
const BACK = "1 3 4@2 2 0 ~ ~";
/** Started on the third note and wrapped round: 5 4 2~ 1 3. */
const ROT = "4 3 1@2 0 2 ~ ~";
/** The whole motif an eighth later, and a quarter later. */
const LATER = "~ 0 2 4@2 3 1 ~";
const LATER_QUARTER = "~ ~ 0 2 4@2 3 1";

const mel = (pattern: string, chain = "") => `mel: n("${pattern}")${chain}.scale("C4:major").s("piano")`;
const vox = (pattern: string, chain = "", tail = "") =>
  `vox: n("${pattern}")${chain}.scale("C4:major").s("rhodes").gain(.7)${tail}`;
/** The motif on `mel` and a copy on `vox`. */
const pair = (copy: string, chain = "", motif = MOTIF) => code(mel(motif), vox(copy, chain));

/** S1: the motif, then a copy, four times: higher, upside down, backwards with its rhythm kept, started later. */
const HOOK = code(mel(`<[${MOTIF}] [${UP}] [${MOTIF}] [${INV}] [${MOTIF}] [${BACK}] [${MOTIF}] [${ROT}]>`));

/** S2: the copy mirrored around the motif's first note (degree sum 0), so it falls below it. */
const MIRROR_LOW = pair("0 -2 -4@2 -3 -1 ~ ~");

/** S3: the copy moved up two degrees with `.add(n(2))`. */
const MOVED_UP = pair(MOTIF, ".add(n(2))");

/** S4 and S6: the copy starts as the motif itself; only its numbers change. */
const STARTER = pair(MOTIF);
const S4_REFERENCE = pair(INV);
const S6_REFERENCE = pair(ROT);
/** The motif must stay as it is; the copy is read against it. */
const MOTIF_KEPT: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  tracks: ["mel"],
};
const copyRule = (fn: "inverted-copy" | "rotated-copy", label: string): Matcher => ({
  m: "rubric",
  rules: [
    {
      id: fn,
      label,
      required: true,
      skills: ["M02"],
      rule: "custom",
      fn,
      params: { source: "mel", copy: "vox" },
    },
  ],
});

/** S5: backwards with `.rev()` (the rhythm turns round too), and backwards with the rhythm kept. */
const REV = code(mel(MOTIF, ".rev()"));
const BACK_KEPT = code(mel(BACK));
const MOTIF_ONCE = code(mel(MOTIF));

/** S8 (optional): the upside-down copy an octave down, under the motif all the way. */
const UNDER = "-3 -5 -7@2 -6 -4 ~ ~";

const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U07.L11",
  version: 2,
  title: "Turn It Around",
  objective:
    "I can transform a motif: turn it upside down, start it from a later note with its rhythm kept, and move it later in time.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["M02"],
  terms: [
    { id: "term.melodic-inversion", step: "S4" },
    { id: "term.pitch-rotation", step: "S6" },
  ],
  canDo: ["cd.compose.transform-motif"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Four copies",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "four-copies",
        version: 1,
        role: "practice",
        prompt:
          "A one-bar motif plays, then a copy of it, four times over: higher, upside down, backwards, and started from a later note. Listen for what every copy keeps from the motif.",
        skills: [{ skill: "M02", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "The motif in bars 1, 3, 5 and 7; a copy after each.", bars: 8 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which copy?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "which-copy", code: MIRROR_LOW, bars: 1 },
      exercise: {
        kind: "predict",
        id: "which-copy",
        version: 1,
        role: "practice",
        prompt:
          "`mel` plays the motif and `vox` a copy, at the same time. Read the numbers on both lines, predict which copy `vox` plays, and pick it.",
        skills: [{ skill: "M02", w: 1 }],
        hints: null,
        tests: [],
        code: MIRROR_LOW,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "higher", label: "The motif, a few degrees higher" },
          { id: "upside-down", label: "The motif upside down: it falls where the motif climbs" },
          { id: "backwards", label: "The motif backwards: last note first" },
        ],
        correct: ["upside-down"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "What a copy keeps",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "moved-up", code: MOVED_UP, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "what-a-copy-keeps",
        version: 1,
        role: "practice",
        prompt:
          "Run it and compare the two lines on the roll. Then answer both questions: how many degrees above the motif `vox` plays, and what the copy keeps.",
        skills: [{ skill: "M02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the number inside `.add(n())` on `vox`, then compare the two lines on the roll: where each note starts, and which way it goes next.",
        },
        hints: ladder(
          "`vox` is the motif with one call added. Which call, and which number is in it?",
          "`.add(n())` before `.scale()` moves every note by that many degrees, as it moved a chord onto a new root.",
          "The motif's first note is degree 1; the copy's first note is degree 3. Count the steps from one to the other.",
        ),
        code: { starter: MOVED_UP },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many degrees above the motif does `vox` play?", correct: 2 },
          {
            q: "choice",
            prompt: "What does the copy on `vox` keep from the motif?",
            options: [
              { id: "both", label: "Its rhythm and its up-and-down shape" },
              { id: "rhythm", label: "Its rhythm only" },
              { id: "notes", label: "Its notes only" },
            ],
            correct: ["both"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 2, choice: ["both"] } }, expect: "pass" },
          {
            name: "the first note's degree, not the distance",
            response: { answer: { number: 3, choice: ["both"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the shape missed",
            response: { answer: { number: 2, choice: ["rhythm"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Upside down",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "upside-down",
        version: 1,
        role: "check",
        prompt:
          "Write the upside-down copy on `vox`. Keep each note's place in time, and replace each number so the line falls where the motif rises. Keep `mel` as it is. Done when every step down in the copy matches a step up in the motif, of the same size.",
        skills: [{ skill: "M02", w: 1 }],
        code: { starter: STARTER },
        reference: { solutions: [S4_REFERENCE], bars: 1 },
        matcher: {
          m: "all",
          of: [
            MOTIF_KEPT,
            copyRule(
              "inverted-copy",
              "`vox` mirrors the motif: it moves down where the motif moves up, by the same number of degrees",
            ),
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet": "{label}: not yet. {detail}.",
          "melody.wrong-degree": "The motif on `mel` changed: {got} where it had {exp}. Change only `vox`.",
        },
        hints: ladder(
          "The motif climbs 1 3 5, then falls 4 2. Which way must the copy go at each of those moves?",
          "Mirror each move: where the motif goes up two degrees, the copy goes down two. Start the copy on the motif's top note, degree 5, and it stays inside the motif's range.",
          "The copy starts `4 2`: from 5 down to 3, where the motif went from 1 up to 3. Keep mirroring.",
        ),
        tests: [
          { name: "reference", response: { code: S4_REFERENCE }, expect: "pass" },
          {
            name: "mirrored around the first note",
            response: { code: pair("0 -2 -4@2 -3 -1 ~ ~") },
            expect: "pass",
          },
          {
            name: "mirrored low, then moved up with .add()",
            response: { code: pair("0 -2 -4@2 -3 -1 ~ ~", ".add(n(4))") },
            expect: "pass",
          },
          { name: "an octave down", response: { code: pair(UNDER) }, expect: "pass" },
          { name: "unchanged", response: { code: STARTER }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "only the first two numbers mirrored",
            response: { code: pair("4 2 4@2 3 1 ~ ~") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a copy moved up instead",
            response: { code: pair(UP) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the motif turned upside down instead of the copy",
            response: { code: pair(MOTIF, "", INV) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Backwards, two ways",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "backwards-two-ways",
        version: 1,
        role: "practice",
        prompt:
          "The motif plays once, then two cards play it backwards, last note first. Pick the card that keeps the motif's rhythm.",
        skills: [{ skill: "M02", w: 1 }],
        hints: ladder(
          "Tap along with the motif: short, short, long, short, short, rest. Which card taps the same?",
          "One card turns the whole bar round, the rest included; the other keeps every note where the motif had one.",
          "Listen to how each card starts: does it begin on the beat, or after a rest?",
        ),
        stimulus: { src: "code", code: MOTIF_ONCE, bars: 1, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "rev", label: "Card A", audio: REV },
            { id: "kept", label: "Card B", audio: BACK_KEPT },
          ],
        },
        correct: { choice: ["kept"] },
        srs: [{ family: "fam.code.functions", mode: "review-if-due" }],
        feedbackText: {
          "id.wrong":
            "Card A is `.rev()`: it turns the whole bar round, so it starts with the rest and ends on a long note. Card B keeps the motif's rhythm. Play both again.",
        },
        tests: [
          { name: "card B", response: { answer: { choice: ["kept"] } }, expect: "pass" },
          {
            name: "card A",
            response: { answer: { choice: ["rev"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Start it later",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "start-it-later",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the numbers on `vox` so the copy starts on the motif's third note, plays the rest in order, and wraps round to the motif's first two notes. Every note keeps its place in time. Keep `mel` as it is. Done when the copy plays the motif's notes in order from a later note.",
        skills: [{ skill: "M02", w: 1 }],
        code: { starter: STARTER },
        reference: { solutions: [S6_REFERENCE], bars: 1 },
        matcher: {
          m: "all",
          of: [
            MOTIF_KEPT,
            copyRule(
              "rotated-copy",
              "`vox` plays the motif's notes in order from a later note, each in the motif's rhythm",
            ),
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet": "{label}: not yet. {detail}.",
          "melody.wrong-degree": "The motif on `mel` changed: {got} where it had {exp}. Change only `vox`.",
        },
        hints: ladder(
          "Read the motif's five numbers in order. Which one is third? That is where the copy begins.",
          "Write the motif's numbers from the third one to the end, then its first two. Leave the `@2` and the rests where they are.",
          "The copy starts `4 3`: the motif's third and fourth notes. Two more before the wrap.",
        ),
        tests: [
          { name: "reference", response: { code: S6_REFERENCE }, expect: "pass" },
          { name: "from the second note", response: { code: pair("2 4 3@2 1 0 ~ ~") }, expect: "pass" },
          { name: "from the fourth note", response: { code: pair("3 1 0@2 2 4 ~ ~") }, expect: "pass" },
          {
            name: "the reference on another sound",
            response: {
              code: code(mel(MOTIF), 'vox: n("4 3 1@2 0 2 ~ ~").scale("C4:major").s("piano").gain(.5)'),
            },
            expect: "pass",
          },
          { name: "unchanged", response: { code: STARTER }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "the notes in the new order, the rhythm moved with them",
            response: { code: pair("4@2 3 1 0 2 ~ ~") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "backwards instead",
            response: { code: pair(BACK) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the motif rewritten instead of the copy",
            response: { code: pair(MOTIF, "", ROT) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "modify",
      title: "Under the motif",
      minutes: 1,
      optional: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "under-the-motif",
        version: 1,
        role: "practice",
        prompt:
          "The upside-down copy crosses the motif in the middle of the bar. Move every note of `vox` down an octave, so the copy plays under the motif the whole bar while still moving the other way. Keep `mel` as it is.",
        skills: [{ skill: "M02", w: 1 }],
        code: { starter: S4_REFERENCE },
        reference: { solutions: [pair(UNDER)], bars: 1 },
        matcher: {
          m: "all",
          of: [
            MOTIF_KEPT,
            {
              m: "rubric",
              rules: [
                {
                  id: "still-mirrored",
                  label: "`vox` still mirrors the motif",
                  required: true,
                  skills: ["M02"],
                  rule: "custom",
                  fn: "inverted-copy",
                  params: { source: "mel", copy: "vox" },
                },
                {
                  id: "underneath",
                  label: "Every note of `vox` is lower than every note of the motif",
                  required: true,
                  skills: ["M02"],
                  rule: "register-separation",
                  low: "vox",
                  high: "mel",
                  minGapSemis: 1,
                },
              ],
            },
          ],
        },
        target: { audible: true, showRoll: false },
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Where does the copy cross the motif? Look at the roll: one line goes up through the other.",
          "Seven degrees make an octave in `n`. Taking 7 from every number moves the copy down an octave and keeps its shape.",
          "The copy's first note, `4`, becomes `-3`.",
        ),
        tests: [
          { name: "reference", response: { code: pair(UNDER) }, expect: "pass" },
          { name: "moved down with .add()", response: { code: pair(INV, ".add(n(-7))") }, expect: "pass" },
          {
            name: "on a lower scale",
            response: { code: code(mel(MOTIF), `vox: n("${INV}").scale("C3:major").s("rhodes").gain(.7)`) },
            expect: "pass",
          },
          {
            name: "two octaves down, in note names",
            response: { code: code(mel(MOTIF), 'vox: note("g2 e2 c2@2 d2 f2 ~ ~").s("rhodes").gain(.7)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: S4_REFERENCE },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "down a 3rd only: it still crosses",
            response: { code: pair(INV, ".add(n(-2))") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the motif moved up instead",
            response: { code: pair(INV, "", "7 9 11@2 10 8 ~ ~") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Later in the bar",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "later-in-the-bar",
        version: 1,
        role: "practice",
        prompt:
          "Keep this motif on `mel` or write your own. Make `vox` play it later in the bar: the same notes in the same order, each moved later by the same amount. Move the rest from the end of the copy to its front. Done when the copy starts at least an eighth note after the motif.",
        skills: [{ skill: "M02", w: 1 }],
        code: { starter: STARTER },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "moved-later",
            label:
              "`vox` plays the motif's notes in order, every one moved later by the same amount, at least an eighth note",
            required: true,
            skills: ["M02"],
            rule: "custom",
            fn: "time-shifted",
            params: { source: "mel", copy: "vox", min: "1/8" },
          },
          {
            id: "upside-down-too",
            label: "A third line, `mel2`, plays the motif upside down, in time with it",
            required: false,
            skills: ["M02"],
            rule: "custom",
            fn: "inverted-copy",
            params: { source: "mel", copy: "mel2" },
          },
        ],
        hints: ladder(
          "Right now `vox` sings with the motif, note for note. What has to happen for it to come in later?",
          "Move the copy's rests: take one from the end and put it at the front, and every note moves an eighth later.",
          "With one rest moved, the copy starts `~ 0 2`. Keep the rest of its notes and lengths in order.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: an eighth later", response: { code: pair(LATER) }, expect: "pass" },
          { name: "a quarter later", response: { code: pair(LATER_QUARTER) }, expect: "pass" },
          {
            name: "three eighths later: the last note wraps round to the front",
            response: { code: pair("1 ~ ~ 0 2 4@2 3") },
            expect: "pass",
          },
          {
            name: "beyond the brief: a new motif, its echo, an upside-down third line",
            response: {
              code: code(
                mel("4 ~ 5 4 2@2 ~ ~"),
                vox("~ ~ 4 ~ 5 4 2@2"),
                'mel2: n("0 ~ -1 0 2@2 ~ ~").scale("C4:major").s("piano").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "half the copy an eighth later, half a quarter later",
            response: { code: pair("~ 0 2 4@2 ~ 3 1") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
