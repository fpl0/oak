// U06.CP Diatonic checkpoint (contracts §7.6; AUTHORING §10). The generated items come from the numeral
// family (N06), function (H02), cadences (H03), schemas (H04 and H05: the four-chord loop, three-chord rock
// and doo-wop at levels 1–2), and the bass-degree and progression ear families (E09, V05: level-setting, and
// V05's sung items are skipped in Quiet mode). These authored items cover what no family asks, each in code:
// writing numerals as chords in a key whose letters are not C's, with the 7th on ii and V (H01, N06, C10);
// walking a bass down by step under a loop so one chord stands on its 3rd (H15); and doubling the harmonic
// rhythm of a loop's last two bars while the chords lock to the snare (H06). Then the checkpoint Make: the
// four-chord loop in a rotation of the learner's choice, over the Band's drums.
// Spec: content/specs/U06.md, "U06.CP Diatonic checkpoint".
//
// Checked after U07.L01 (its place in the default order): every U06 tool is the learner's, `.struct()`
// (U06.L12) included. Authored items use implemented kinds only (no `slot-choice`, no staged dictation).
// `numerals-to-code` is in F so the numerals, not the letters of C, carry the answer (AUTHORING §13).
import { type CheckpointDef, defineCheckpoint, type Matcher } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A chord line in degrees: `n` stacks over a major scale from octave 3. */
const stacks = (pattern: string, key = "F3:major", extra = "") =>
  `chords: n("${pattern}").scale("${key}").s("piano")${extra}`;

// --- numerals-to-code ---------------------------------------------------------------------------------

/**
 * I vi ii7 V7 in F: F A C | D F A | G B♭ D F | C E G B♭. `n` is the degree minus one, so I is [0,2,4], vi
 * [5,7,9], ii7 [1,3,5,7] and V7 [4,6,8,10]: the 7th is one more 3rd on top.
 */
const NUMERALS = "<[0,2,4] [5,7,9] [1,3,5,7] [4,6,8,10]>";
const NUMERALS_STARTER = code(stacks("<[0,2,4] ⟪[0,2,4] [0,2,4] [0,2,4]⟫>"));
/** The same chords as one triad or seventh moved by `.add()`. */
const NUMERALS_ADD = code(
  'chords: n("<[0,2,4] [0,2,4] [0,2,4,6] [0,2,4,6]>").add(n("<0 5 1 4>")).scale("F3:major").s("piano")',
);

// --- walk-it-down -------------------------------------------------------------------------------------

/** C G Am Am, close to C: E G C | D G B | E A C | E A C. */
const WALK_CHORDS = 'chords: note("<[e3,g3,c4] [d3,g3,b3] [e3,a3,c4] [e3,a3,c4]>").s("piano").gain(.7)';
const walkBass = (notes: string) => `bass: note("${notes}").s("ebass").lpf(800)`;
/** C B A G: G stands on its 3rd (G/B), and the last A minor gets G under it (Am/G). */
const WALK_DOWN = "<c3 b2 a2 g2>";
const WALK_STARTER = `${TEMPO}${WALK_CHORDS}\n${walkBass("⟪<c3 c3 a2 a2>⟫")}`;
const WALK = (notes: string) => code(WALK_CHORDS, walkBass(notes));

// --- change-the-pace ----------------------------------------------------------------------------------

/** I V vi IV in C, a chord a bar, held. */
const PACE_START = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
/** I | V | vi IV | ii V: two chords a bar in bars 3 and 4, each chord struck on beats 2 and 4. */
const PACE = "<[0,2,4] [4,6,8] [[5,7,9] [3,5,7]] [[1,3,5] [4,6,8]]>";
const SNARE = '.struct("~ x ~ x")';
const pace = (pattern: string, extra = "") => code(stacks(pattern, "C3:major", extra));
/**
 * The editable region holds the whole `n(…)`, not only its pattern, so the learner can write the bars the
 * way Harmonic Rhythm taught them, roots first with `.add()`, as well as stacks in brackets (teaching
 * review: with the region inside the quotes, `.add()` could only go after `.s()`, where it does nothing).
 */
const PACE_STARTER = code(`chords: ⟪n("${PACE_START}")⟫.scale("C3:major").s("piano")⟪⟫`);
const PACE_MATCHER: Matcher = {
  m: "all",
  of: [
    { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
    {
      m: "rhythm",
      tol: [1, 32],
      durations: false,
      perRole: false,
      displacementCredit: 0,
      tracks: ["chords"],
    },
  ],
};

// --- the Make -----------------------------------------------------------------------------------------

/** The starter: doo-wop, I vi IV V, as stacks with a root bass. */
const MAKE_STARTER = "<[0,2,4] [5,7,9] [3,5,7] [4,6,8]>";
const makeBass = (pattern: string) => `bass: n("${pattern}").scale("C2:major").s("ebass").lpf(800)`;
const MAKE = (chordsPattern: string, bassPattern: string, ...more: string[]) =>
  code(stacks(chordsPattern, "C3:major"), makeBass(bassPattern), ...more);

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U06.CP",
  title: "Diatonic checkpoint",
  covers: ["U06"],
  gated: ["H01", "H02", "H03", "H04", "H05", "H06", "H15", "N06", "C10"],
  levelSetting: ["E09", "V05"],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "numerals-to-code",
      version: 1,
      role: "checkpoint",
      prompt:
        "In F major, write I vi ii7 V7, one chord a bar, each stacked in 3rds from its root: a 7th chord has one more 3rd on top. Bar 1, I, is written. `n` counts from 0, so degree 2 is `n` 1.",
      skills: [
        { skill: "H01", w: 0.4 },
        { skill: "N06", w: 0.3 },
        { skill: "C10", w: 0.3 },
      ],
      hints: null,
      key: { tonic: "F", mode: "major" },
      code: { starter: NUMERALS_STARTER },
      reference: { solutions: [code(stacks(NUMERALS))], bars: 4 },
      matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
      feedbackText: {
        "harmony.pcset":
          "Bar {bar}: your chord has {got}; it should have {exp}. Count up the scale of F from 1, and take one away for `n`.",
      },
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: code(stacks(NUMERALS)) }, expect: "pass" },
        {
          name: "one triad and one 7th chord moved by .add()",
          response: { code: NUMERALS_ADD },
          expect: "pass",
        },
        {
          name: "vi stacked down from the octave: [-2,0,2]",
          response: { code: code(stacks("<[0,2,4] [-2,0,2] [1,3,5,7] [4,6,8,10]>")) },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: code(stacks("<[0,2,4] [0,2,4] [0,2,4] [0,2,4]>")) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the numerals typed into n as they are: 6, 2 and 5",
          response: { code: code(stacks("<[0,2,4] [6,8,10] [2,4,6,8] [5,7,9,11]>")) },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "ii and V as triads, no 7th",
          response: { code: code(stacks("<[0,2,4] [5,7,9] [1,3,5] [4,6,8]>")) },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "vi with F at the bottom: [0,2,5]",
          response: { code: code(stacks("<[0,2,4] [0,2,5] [1,3,5,7] [4,6,8,10]>")) },
          expect: "fail",
          feedback: ["harmony.bass"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "walk-it-down",
      version: 1,
      role: "checkpoint",
      prompt:
        "Under C, G, Am, Am the bass plays C C A A. Change it to walk down by step from C, one note a bar, so that G stands on its 3rd and the last bar has a new note under A minor.",
      skills: [{ skill: "H15", w: 1 }],
      hints: null,
      code: { starter: WALK_STARTER },
      reference: { solutions: [WALK(WALK_DOWN)], bars: 4 },
      matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords", "bass"] },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      feedbackText: {
        "harmony.pcset":
          "Bar {bar}: with the bass, the notes are {got}; the walk gives {exp}. The bass moves one letter down each bar from C.",
      },
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: WALK(WALK_DOWN) }, expect: "pass" },
        {
          name: "an octave lower",
          response: { code: WALK("<c2 b1 a1 g1>") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: WALK("<c3 c3 a2 a2>") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "every chord on its root: C G A A",
          response: { code: WALK("<c3 g2 a2 a2>") },
          expect: "fail",
          feedback: ["harmony.bass"],
        },
        {
          name: "the walk stops at A: C B A A",
          response: { code: WALK("<c3 b2 a2 a2>") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "change-the-pace",
      version: 1,
      role: "checkpoint",
      prompt:
        "The loop plays I V vi IV, one held chord a bar. Make bars 3 and 4 hold two chords each, half a bar each: vi IV in bar 3, ii V in bar 4. Then make every chord strike only on beats 2 and 4, with the snare.",
      skills: [{ skill: "H06", w: 1 }],
      hints: null,
      code: { starter: PACE_STARTER },
      reference: { solutions: [pace(PACE, SNARE)], bars: 4 },
      matcher: PACE_MATCHER,
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      feedbackText: {
        "harmony.pcset":
          "Bar {bar}: the chord there is {got}; the loop needs {exp}. Bars 3 and 4 each hold two chords, half a bar each.",
      },
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: pace(PACE, SNARE) }, expect: "pass" },
        {
          name: "the beats written out with rests, and a little softer",
          response: {
            code: pace(
              "<[~ [0,2,4] ~ [0,2,4]] [~ [4,6,8] ~ [4,6,8]] [~ [5,7,9] ~ [3,5,7]] [~ [1,3,5] ~ [4,6,8]]>",
              "",
            ).replace('.s("piano")', '.s("piano").gain(.8)'),
          },
          expect: "pass",
        },
        {
          name: "roots first with .add(), as in Harmonic Rhythm",
          response: {
            code: code(
              'chords: n("<0 4 [5 3] [1 4]>").add(n("[0,2,4]")).scale("C3:major").s("piano").struct("~ x ~ x")',
            ),
          },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: pace(PACE_START) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the new chords, still held a whole bar",
          response: { code: pace(PACE) },
          expect: "fail",
          feedback: ["rhythm.missing"],
        },
        {
          name: "on the snare, but bar 4 is ii IV",
          response: { code: pace("<[0,2,4] [4,6,8] [[5,7,9] [3,5,7]] [[1,3,5] [3,5,7]]>", SNARE) },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      N06: ["fam.har.rn"],
      H02: ["fam.har.function"],
      H03: ["fam.har.cadence"],
      H04: ["fam.har.schema"],
      H05: ["fam.har.schema"],
      E09: ["fam.har.bass", "fam.har.progression"],
      V05: ["fam.har.bass"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-loop",
    version: 1,
    role: "checkpoint",
    title: "The loop, your way",
    prompt:
      "The starter plays doo-wop. Rewrite it as the four-chord loop, I V vi IV, started on any of its chords. Comp it or break it into a rhythm, and end the phrase with a cadence if you like. Done when the chords go I V vi IV in order, from any start.",
    skills: [{ skill: "H04", w: 1 }],
    hints: null,
    key: { tonic: "C", mode: "major" },
    bpm: BPM,
    code: { starter: MAKE(MAKE_STARTER, "<0 5 3 4>") },
    bars: [4, 8],
    saveAs: "sketch",
    rubric: [
      {
        id: "the-four-chord-loop",
        label: "`chords` plays I V vi IV in order, started on any of its four chords",
        required: true,
        skills: ["H04"],
        rule: "progression",
        schema: "schema.axis",
        allowRotation: true,
        track: "chords",
      },
      {
        id: "pace",
        label: "`.struct()` sets the rhythm of the chords",
        required: false,
        skills: ["H06"],
        rule: "uses",
        tool: "tb.struct",
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
    tests: [
      {
        name: "the starter: doo-wop, I vi IV V",
        response: { code: MAKE(MAKE_STARTER, "<0 5 3 4>") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: the loop started on vi",
        response: { code: MAKE("<[5,7,9] [3,5,7] [0,2,4] [4,6,8]>", "<5 3 0 4>") },
        expect: "pass",
      },
      {
        name: "beyond the brief: I V vi IV on the Rhodes with the snare, a walking bass and a tune",
        response: {
          code: code(
            'chords: chord("<C G Am F>").dict("triads").voicing().struct("~ x ~ x").s("rhodes").gain(.6)',
            'bass: n("<[0 ~ 0 2] [4 ~ 4 3] [5 ~ 5 4] [3 ~ 3 4]>").scale("C2:major").s("ebass").lpf(800)',
            'mel: n("<[4 ~ 2 ~] [1 ~ ~ ~] [0 ~ 2 4] [5 4 ~ ~]>").scale("C4:major").s("piano")',
          ),
        },
        expect: "pass",
      },
      {
        name: "three-chord rock, I IV V IV",
        response: { code: MAKE("<[0,2,4] [3,5,7] [4,6,8] [3,5,7]>", "<0 3 4 3>") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
