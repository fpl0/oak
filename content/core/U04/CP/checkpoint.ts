// U04.CP Interval checkpoint (contracts §7.6; AUTHORING §10). The generated items come from the interval
// spelling family (I02, I03; its augmented and diminished level opens at U05.L03, so items stay at levels
// 1–3 here) and the in-key interval ear family (E06, level-setting). These authored items cover what no
// family measures: naming three intervals with their quality, the tritone among them (I02, I03); a second
// voice a 3rd above a riff, played together with `,` (I01, I05); counting a distance in degrees with both
// ends included (I01, so that it has two items). Then the checkpoint Make: a riff in two voices over the
// Band with notes played together. Spec: content/specs/U04.md, "U04.CP Interval checkpoint".
//
// Checked after U05.L01 (its place in the default order): `.transpose("3M")` and `,` are the learner's;
// augmented and diminished as words wait for U05.L03, except the tritone, which U04.L03 named.
import { type CheckpointDef, defineCheckpoint } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line in degrees over C major. */
const line = (label: string, pattern: string, extra = "") =>
  `${label}: n("${pattern}").scale("C4:major").s("piano")${extra}`;
const deg = (pattern: string, extra = "") => `${TEMPO}${line("mel", pattern, extra)}`;

/** Three pairs, one to a bar: C–E (a major 3rd), D–A (a perfect 5th), F–B (the tritone). */
const PAIRS = `${TEMPO}mel: note("<[c4 e4] [d4 a4] [f4 b4]>").s("piano")`;

/** The riff: 1 2 3 1 | 4 3 2, rest. A 3rd above, in the key: 3 4 5 3 | 6 5 4. */
const RIFF = "<[0 1 2 0] [3 2 1 ~]>";
const THIRDS = "<[[0,2] [1,3] [2,4] [0,2]] [[3,5] [2,4] [1,3] ~]>";

/**
 * The Make starter: two voices a 3rd apart, written as two lines that play at the same time. Over the
 * vamp (C, then F) neither voice sits a half step above a chord note.
 */
const MAKE_MEL = "<[0 2 4 2] [3 5 4 ~]>";
const MAKE_VOX = "<[2 4 6 4] [5 7 6 ~]>";
const TWO_LINES = `${TEMPO}${line("mel", MAKE_MEL)}\n${line("vox", MAKE_VOX, ".gain(.7)")}`;

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U04.CP",
  title: "Interval checkpoint",
  covers: ["U04"],
  gated: ["I01", "I02", "I03", "I05"],
  levelSetting: ["E06"],
  version: 2,
  authored: [
    {
      kind: "fact",
      id: "name-the-quality",
      version: 1,
      role: "checkpoint",
      prompt:
        "The staff shows three pairs of notes, one pair to a bar. Name the interval in each bar, in order, by its quality and number, written like `m3`, `M6` or `P4`. Write the tritone as `TT`.",
      skills: [
        { skill: "I02", w: 0.6 },
        { skill: "I03", w: 0.4 },
      ],
      hints: null,
      stimulus: { src: "code", code: PAIRS, bars: 3, showCode: false, showStaff: true },
      answer: { ui: "text", normalize: "interval" },
      correct: { text: ["M3", "P5", "TT"] },
      // F–B is a 4th by its letters (F G A B) and still not a perfect one: the half steps (6, not 5) are what
      // make it the tritone. The grader calls that a quality miss; a wrong count is a number miss.
      feedbackText: {
        "id.interval-quality":
          "Right number, a {generic}, but {exp} ({expLong}), not {got}. Count the half steps: {semis}.",
        "id.interval-number":
          "That was {exp} ({expLong}), not {got}. Count the letter names from the lower note, both ends included, then the half steps between them.",
        // The catalog line ends "Listen to both", but these pairs are read on the staff; an unknown quality
        // ("M5") or a bare number lands here.
        "id.wrong":
          "That was {exp}, not {got}. Name it by its number, counting the letters with both ends included, and by its quality: M, m or P.",
      },
      spelling: "strict",
      order: "sequence",
      tests: [
        { name: "M3 P5 TT", response: { answer: { text: ["M3", "P5", "TT"] } }, expect: "pass" },
        {
          name: "as .transpose() writes them, the tritone as a 4th",
          response: { answer: { text: ["3M", "5P", "4A"] } },
          expect: "pass",
        },
        {
          // F up to B is spelled A4 (four letters, F G A B); d5 is the tritone spelled as a 5th (F up to C♭).
          // The prompt asks for `TT`, and the grader holds the spelling to the notes on the staff.
          name: "the tritone named d5: F–B is spelled as a 4th",
          response: { answer: { text: ["major 3rd", "perfect 5th", "d5"] } },
          expect: "fail",
          feedback: ["id.interval-number"],
        },
        {
          name: "C–E called minor",
          response: { answer: { text: ["m3", "P5", "TT"] } },
          expect: "fail",
          feedback: ["id.interval-quality"],
        },
        {
          name: "F–B called a perfect 4th",
          response: { answer: { text: ["M3", "P5", "P4"] } },
          expect: "fail",
          feedback: ["id.interval-quality"],
        },
        {
          name: "a 5th called major",
          response: { answer: { text: ["M3", "M5", "TT"] } },
          expect: "fail",
          feedback: ["id.wrong"],
        },
        {
          name: "D–A counted without one end",
          response: { answer: { text: ["M3", "P4", "TT"] } },
          expect: "fail",
          feedback: ["id.interval-number"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "thirds-together",
      version: 1,
      role: "checkpoint",
      prompt:
        "Give every note of this riff a second note a 3rd above it, in the key, sounding at the same time. Write each pair in brackets with `,`: `n` 0 becomes `[0,2]`. Keep the rest where it is. Done when every note has its 3rd above.",
      skills: [
        { skill: "I01", w: 0.5 },
        { skill: "I05", w: 0.5 },
      ],
      hints: null,
      code: { starter: deg(`⟪${RIFF}⟫`) },
      reference: { solutions: [deg(THIRDS)], bars: 2 },
      // The pitch classes of each pair, and the size of the pair: the two notes 3 or 4 half steps apart, read from the
      // lower one. Together they say "a 3rd above the riff's note": with the riff's note and its 3rd as the only pitch
      // classes, 3 or 4 half steps apart can only put the 3rd on top (E3 under C4 is a 6th below; E5 over C4 a 10th).
      // The order inside the brackets is free: `[2,0]` sounds the same as `[0,2]`.
      matcher: {
        m: "all",
        of: [
          { m: "pcset", perOnset: true, bass: false },
          {
            m: "rubric",
            rules: [
              {
                id: "a-third-above",
                label: "Each pair is a 3rd, 3 or 4 half steps",
                required: true,
                skills: ["I01"],
                rule: "custom",
                fn: "stack-intervals",
                params: { semitones: [3, 4] },
              },
            ],
          },
        ],
      },
      constraints: [{ c: "must-use", tool: "tb.mini.stack", feedback: "code.must-use" }],
      // The catalog names the tool by its card ("stack"); say what to type.
      feedbackText: {
        "code.must-use":
          "Play each pair at the same time: both notes inside one pair of brackets, with `,` between them.",
        "rubric.unmet":
          "{label}: {detail}. Keep the riff's note where it is and put the second note the next-but-one step up, in the same octave: `n` 0 becomes `[0,2]`.",
      },
      target: { audible: true, showRoll: true },
      tests: [
        { name: "reference", response: { code: deg(THIRDS) }, expect: "pass" },
        {
          name: "the two voices stacked with one comma",
          response: { code: deg("<[0 1 2 0] [3 2 1 ~]>, <[2 3 4 2] [5 4 3 ~]>") },
          expect: "pass",
        },
        {
          name: "each pair written top down",
          response: { code: deg("<[[2,0] [3,1] [4,2] [2,0]] [[5,3] [4,2] [3,1] ~]>") },
          expect: "pass",
        },
        {
          name: "in note names, with spaces after the commas",
          response: {
            code: `${TEMPO}mel: note("<[[c4, e4] [d4, f4] [e4, g4] [c4, e4]] [[f4, a4] [e4, g4] [d4, f4] ~]>").s("piano")`,
          },
          expect: "pass",
        },
        {
          // Review finding (theory-c A1): the same letters an octave apart are a 10th, a compound interval the
          // course names in U12; the brief asks for a 3rd.
          name: "the upper voice an octave higher, a 10th",
          response: { code: deg("<[[0,9] [1,10] [2,11] [0,9]] [[3,12] [2,11] [1,10] ~]>") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          // Review finding (theory-c A1): E3 under C4 has the right letters but is a 6th below, not a 3rd above.
          name: "the second note a 6th below",
          response: { code: deg("<[[0,-5] [1,-4] [2,-3] [0,-5]] [[3,-2] [2,-3] [1,-4] ~]>") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "unchanged",
          response: { code: deg(RIFF) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "a 2nd above instead of a 3rd",
          response: { code: deg("<[[0,1] [1,2] [2,3] [0,1]] [[3,4] [2,3] [1,2] ~]>") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "a second line a 3rd above, not played together with a comma",
          response: { code: `${TEMPO}${line("mel", RIFF)}\n${line("vox", "<[2 3 4 2] [5 4 3 ~]>")}` },
          expect: "fail",
          feedback: ["code.must-use"],
        },
      ],
    },
    {
      kind: "fact",
      id: "count-the-distance",
      version: 1,
      role: "checkpoint",
      prompt:
        "Count the distance from degree 2 up to degree 6 in any major key, in degrees, both ends included. Enter the number: 3 for a 3rd.",
      skills: [{ skill: "I01", w: 1 }],
      hints: null,
      answer: { ui: "number" },
      correct: { number: 5 },
      // The catalog line says "Listen to both", but a fact has no sound.
      feedbackText: {
        "id.wrong": "Not {got}. Count every degree on the way, both ends included: 2 3 4 5 6.",
      },
      spelling: "strict",
      order: "set",
      tests: [
        { name: "a 5th", response: { answer: { number: 5 } }, expect: "pass" },
        { name: "the gap, not the count: 4", response: { answer: { number: 4 } }, expect: "fail" },
        { name: "one too many: 6", response: { answer: { number: 6 } }, expect: "fail" },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      I02: ["fam.int.spell"],
      I03: ["fam.int.spell"],
      E06: ["fam.int.in-key"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-duet",
    version: 1,
    role: "checkpoint",
    title: "Two voices",
    prompt:
      "The starter plays two voices on two lines, `mel` and `vox`. Rewrite the riff so notes play together with `,` in one pattern. 3rds and 6ths blend; a 2nd or the tritone adds tension. Done when at least one `,` makes notes sound at once.",
    skills: [{ skill: "I05", w: 1 }],
    hints: null,
    key: { tonic: "C", mode: "major" },
    bpm: BPM,
    code: { starter: TWO_LINES },
    bars: [2, 4],
    saveAs: "sketch",
    // The catalog's `uses` detail prints the tool's card ("a, b inside mini-notation (…) is not used yet"):
    // the labels say it in words.
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    rubric: [
      {
        id: "together",
        label: "`,` used in a pattern, so notes play at once",
        required: true,
        skills: ["I05"],
        rule: "uses",
        tool: "tb.mini.stack",
      },
      {
        id: "named-distance",
        label: "`.transpose()` used with an interval name in quotes",
        required: false,
        skills: ["I02"],
        rule: "uses",
        tool: "tb.transpose.interval",
      },
      {
        id: "five-notes",
        label: "At least five different notes across the melody",
        required: false,
        skills: ["I01"],
        rule: "distinct-pitches",
        track: "@melody",
        min: 5,
      },
    ],
    tests: [
      {
        name: "the starter: two lines, nothing played together with `,`",
        response: { code: TWO_LINES },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: the two lines stacked with one comma",
        response: { code: deg(`${MAKE_MEL}, ${MAKE_VOX}`) },
        expect: "pass",
      },
      {
        name: "beyond the brief: 3rds, then 6ths, and a bass line moved down with a named distance",
        response: {
          code: `${TEMPO}${line("mel", "<[[0,2] [2,4] [4,6] [2,4]] [[3,8] [2,7] [0,2] ~]>")}\nbass: note("<c3 f3>").transpose("-8P").s("ebass").lpf(800)`,
        },
        expect: "pass",
      },
      {
        name: "one voice only",
        response: { code: deg(MAKE_MEL) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
