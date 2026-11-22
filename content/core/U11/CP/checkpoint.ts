// U11.CP Blues checkpoint (contracts §7.6; AUTHORING §10). Every skill in range is a concept or creative skill,
// so every item gates; no sing or tap item (a learner in Quiet mode passes the same checkpoint). The generated
// items come from the blues-form family (F04: which chord, where IV arrives, quick change or standard) and the
// swing family (R13: straight, triplet, light, hard). The rest is measured by the authored items and the Make:
// - build-the-scales: three scales on the keyboard, each from its own tonic: D major pentatonic, E minor
//   pentatonic, A blues (S09, S10, S11);
// - chart-the-blues: a quick-change blues in F, heard with its chords hidden, charted bar by bar in numerals with
//   their sevenths: I7 IV7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7 (H10, F04, C06);
// - swing-it: a straight blues made to shuffle, the hats and the riff each swung (R13).
// The Make is twelve bars of the learner's own over the Band's shuffle drums (`band.blues-12bar`, drums only:
// kick and snare on the beat, so the learner's hats decide straight or swung): a riff that comes back (M08,
// required), with the blues form, dominant sevenths and swung hats as suggestions.
// Spec: content/specs/U11.md, "U11.CP Blues checkpoint".
//
// Departures from the spec, each forced by what is implemented or by content CI:
// - build-the-scales is three `scale-builder` parts on the keyboard (keys read as pitch classes against each
//   tonic) and chart-the-blues a twelve-bar `bar-grid` of numerals that reads the sevenths (Wave 5 answers).
// - The recipe names only families that give evidence for the skill: `fam.key.scale-spell` gives S01 evidence
//   (not S09 or S11) and `fam.har.schema` H04/H05 (not H10), so content CI refuses them for those skills;
//   build-the-scales and chart-the-blues measure them instead.
// - The Make's motif rule asks for 0.3 of the two-bar units, as U11.L08 does: a riff that returns in lines 2 and
//   3 under answers that change is 2 of 6 units. The spec's 0.5 fails that blues, the one the unit teaches.
//
// Checked at its place in the default order, after U12.L01 (or GYM.11): every U11 tool and word is the learner's.
import { type CheckpointDef, defineCheckpoint, type Exercise, type Matcher } from "@oak/content-kit";

const BPM = 104;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

// --- build-the-scales ---------------------------------------------------------------------------------

/** One scale on the keyboard, an octave from its tonic, read as degrees against that tonic (any octave counts). */
type Fact = Extract<Exercise, { kind: "fact" }>;
const scalePart = (
  id: string,
  prompt: string,
  skill: "S09" | "S10" | "S11",
  tonic: string,
  range: [string, string],
  degrees: string[],
  tests: Fact["tests"],
): Fact => ({
  kind: "fact",
  id,
  version: 2,
  role: "checkpoint",
  prompt,
  skills: [{ skill, w: 1 }],
  hints: null,
  answer: { ui: "scale-builder", tonic, input: "keyboard", range },
  correct: { degrees: degrees as never },
  spelling: "enharmonic",
  order: "set",
  tests,
});

// --- chart-the-blues ----------------------------------------------------------------------------------

/** The quick change in F: B♭7 in bar 2, the turnaround on C7 in bar 12. */
const F_BLUES = "<F7 Bb7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7>";
const CHART = code(
  `const changes = "${F_BLUES}"\n`,
  'hats: s("hh*8").gain(.5)',
  'drums: s("bd ~ sd ~")',
  'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)',
  'chords: chord(changes).voicing().s("piano").gain(.6)',
);
const CHART_RN = ["I7", "IV7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"];

// --- swing-it -----------------------------------------------------------------------------------------

const FORM = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>";
const SWING = ".swingBy(1/3, 4)";
/** U11.L08's call, in eighths so the swing is heard: C · E♭ F · G F · | G♭ F C ·. */
const CALL = "<[0 ~ 1 2 ~ 4 2 ~] [3 2 0 ~]>";
const shuffle = (hatsSwing: string, gtrSwing: string) =>
  code(
    `const changes = "${FORM}"\n`,
    `hats: s("hh*8")${hatsSwing}.gain(.5)`,
    'drums: s("bd ~ sd ~")',
    'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)',
    'chords: chord(changes).voicing().s("piano").gain(.6)',
    `gtr: n("${CALL}").scale("C3:blues")${gtrSwing}.s("crunch")`,
  );
const SHUFFLE_STARTER = shuffle("⟪⟫", "⟪⟫");
const SHUFFLED = shuffle(SWING, SWING);
const SWING_MATCHER: Matcher = {
  m: "rubric",
  rules: [
    {
      id: "hats-swing",
      label: "The hats play their eighths long–short",
      required: true,
      skills: ["R13"],
      rule: "swing",
      track: ["hats", "@drums"],
      drums: ["hatClosed", "hatOpen", "ride"],
      subdivision: 8,
      ratio: [1.6, 2.4],
    },
    {
      id: "riff-swings",
      label: "The gtr line plays its eighths long–short",
      required: true,
      skills: ["R13"],
      rule: "swing",
      track: "gtr",
      subdivision: 8,
      ratio: [1.4, 2.4],
    },
  ],
};

// --- the Make -----------------------------------------------------------------------------------------

/** The changes, the learner's hats, a root bass and the chords: the rhythm section of every sketch below. */
const blues = (form: string, hats: string, ...lines: string[]) =>
  code(
    `const changes = "${form}"\n`,
    `hats: s("hh*8")${hats}.gain(.5)`,
    'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)',
    'chords: chord(changes).voicing().s("piano").gain(.6)',
    ...lines,
  );
const call = (pattern: string, swing = "") => `mel: n("${pattern}").scale("C3:blues")${swing}.s("crunch")`;
const answer = (pattern: string, swing = "") => `vox: n("${pattern}").scale("C4:blues")${swing}.s("organ")`;
/** The starter: a new figure in every line, so nothing comes back. */
const MAKE_STARTER = blues(
  FORM,
  "",
  call("<[0 ~ 1 2 ~ 4 2 ~] [3 2 0 ~] ~ ~ [4 ~ 3 2 ~ 1 0 ~] [1 ~ 0 ~] ~ ~ [2 ~ 3 4 ~ 5 4 ~] [3 ~ ~ ~] ~ ~>"),
);
/** The call in bars 1–2 of every line (a four-bar loop with one idea in it), and three answers that change. */
const CALLS = "<[0 ~ 1 2 ~ 4 2 ~] [3 2 0 ~] ~ ~>";
const ANSWERS =
  "<~ ~ [~ 4 5 4 ~ 2 ~ ~] [1 ~ 0 ~] ~ ~ [~ 5 ~ 4 3 4 ~ ~] [2 1 0 ~] ~ ~ [~ 4 2 1 ~ 0 ~ ~] [~ ~ 2 4]>";

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U11.CP",
  title: "Blues checkpoint",
  covers: ["U11"],
  gated: ["S09", "S10", "S11", "C06", "H10", "F04", "R13", "M08"],
  levelSetting: [],
  version: 2,
  authored: [
    {
      kind: "all",
      id: "build-the-scales",
      version: 1,
      role: "checkpoint",
      prompt:
        "Build three scales on the keyboard, one at a time. For each, start on its home note and press only that scale's keys.",
      skills: [
        { skill: "S09", w: 0.34 },
        { skill: "S10", w: 0.33 },
        { skill: "S11", w: 0.33 },
      ],
      hints: null,
      tests: [],
      parts: [
        scalePart(
          "d-major-pentatonic",
          "Build D major pentatonic: D as home, then degrees 2, 3, 5 and 6 of D major. Five keys in all.",
          "S09",
          "D",
          ["d4", "d5"],
          ["1", "2", "3", "5", "6"],
          [
            { name: "D E F♯ A B", response: { answer: { midi: [62, 64, 66, 69, 71] } }, expect: "pass" },
            {
              name: "with the top D as well",
              response: { answer: { midi: [62, 64, 66, 69, 71, 74] } },
              expect: "pass",
            },
            {
              name: "all seven notes of D major",
              response: { answer: { midi: [62, 64, 66, 67, 69, 71, 73] } },
              expect: "fail",
              feedback: ["id.scale-extra"],
            },
            {
              name: "F for F♯",
              response: { answer: { midi: [62, 64, 65, 69, 71] } },
              expect: "fail",
              feedback: ["id.scale-extra", "id.scale-missing"],
            },
          ],
        ),
        scalePart(
          "e-minor-pentatonic",
          "Build E minor pentatonic: E as home, then ♭3, 4, 5 and ♭7 above it. Five keys in all.",
          "S10",
          "E",
          ["e4", "e5"],
          ["1", "b3", "4", "5", "b7"],
          [
            { name: "E G A B D", response: { answer: { midi: [64, 67, 69, 71, 74] } }, expect: "pass" },
            {
              name: "with the top E as well",
              response: { answer: { midi: [64, 67, 69, 71, 74, 76] } },
              expect: "pass",
            },
            {
              name: "the major pentatonic on E: G♯ and C♯",
              response: { answer: { midi: [64, 66, 68, 71, 73] } },
              expect: "fail",
              feedback: ["id.scale-extra", "id.scale-missing"],
            },
            {
              name: "D left out",
              response: { answer: { midi: [64, 67, 69, 71] } },
              expect: "fail",
              feedback: ["id.scale-missing"],
            },
          ],
        ),
        scalePart(
          "a-blues",
          "Build the A blues scale: the minor pentatonic on A, plus the blue note between 4 and 5. Six keys in all.",
          "S11",
          "A",
          ["a3", "a4"],
          ["1", "b3", "4", "b5", "5", "b7"],
          [
            {
              name: "A C D E♭ E G",
              response: { answer: { midi: [57, 60, 62, 63, 64, 67] } },
              expect: "pass",
            },
            {
              name: "with the top A as well",
              response: { answer: { midi: [57, 60, 62, 63, 64, 67, 69] } },
              expect: "pass",
            },
            {
              name: "the minor pentatonic, no blue note",
              response: { answer: { midi: [57, 60, 62, 64, 67] } },
              expect: "fail",
              feedback: ["id.scale-missing"],
            },
            {
              name: "the blue note between 2 and ♭3: B♭",
              response: { answer: { midi: [57, 58, 60, 62, 64, 67] } },
              expect: "fail",
              feedback: ["id.scale-extra", "id.scale-missing"],
            },
          ],
        ),
      ],
    },
    {
      kind: "fact",
      id: "chart-the-blues",
      version: 2,
      role: "checkpoint",
      key: { tonic: "F", mode: "blues" },
      prompt:
        "Listen to a twelve-bar blues in F, one chord a bar, with the chords hidden. Chart each bar as a numeral with its seventh, such as I7; bar 1 is filled in. Replay it as often as you like.",
      skills: [
        { skill: "H10", w: 0.4 },
        { skill: "F04", w: 0.4 },
        { skill: "C06", w: 0.2 },
      ],
      hints: null,
      stimulus: { src: "code", code: CHART, bars: 12, showCode: false },
      answer: { ui: "bar-grid", bars: 12, perRow: 4, entry: "rn", qualities: ["maj", "7"], given: [1] },
      correct: { rn: CHART_RN },
      spelling: "enharmonic",
      order: "sequence",

      tests: [
        { name: "the quick change", response: { answer: { rn: CHART_RN } }, expect: "pass" },
        {
          name: "heard as the standard form: I7 in bar 2",
          response: { answer: { rn: ["I7", "I7", ...CHART_RN.slice(2)] } },
          expect: "fail",
          feedback: ["harmony.bar"],
        },
        {
          name: "triads: the sevenths left off",
          response: { answer: { rn: CHART_RN.map((x) => x.replace("7", "")) } },
          expect: "fail",
          feedback: ["harmony.bar"],
        },
        {
          name: "bars 9 and 10 swapped: IV7 before V7",
          response: { answer: { rn: [...CHART_RN.slice(0, 8), "IV7", "V7", ...CHART_RN.slice(10)] } },
          expect: "fail",
          feedback: ["harmony.bar"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "swing-it",
      version: 1,
      role: "checkpoint",
      prompt:
        "This blues in C plays straight. Make it shuffle: add a swing call to the `hats:` line and to the `gtr:` line, in the two highlighted spots. Done when both lines play their eighths long–short.",
      skills: [{ skill: "R13", w: 1 }],
      hints: null,
      swing: { subdivision: 8, amount: 1 / 3 },
      code: { starter: SHUFFLE_STARTER },
      reference: { solutions: [SHUFFLED], bars: 4 },
      matcher: SWING_MATCHER,
      constraints: [
        { c: "edit-only-regions", feedback: "code.edit-outside" },
        // `.swing(4)`, the short form unlocked beside `.swingBy()` in Shuffle, counts as the call too.
        { c: "must-use", tool: ["tb.swingBy", "tb.swing"], min: 2, feedback: "code.must-use" },
      ],
      target: { audible: true, showRoll: false },
      feedbackText: { "rubric.unmet": "{label}: not yet." },
      tests: [
        { name: "reference", response: { code: SHUFFLED }, expect: "pass" },
        {
          name: "a touch less swing on the riff",
          response: { code: shuffle(SWING, ".swingBy(.25, 4)") },
          expect: "pass",
        },
        {
          name: "the short form: .swing(4) on both lines",
          response: { code: shuffle(".swing(4)", ".swing(4)") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: shuffle("", "") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the hats swung, the riff straight",
          response: { code: shuffle(SWING, "") },
          expect: "fail",
          feedback: ["code.must-use"],
        },
        {
          name: "sixteenths swung: the eighths stay even",
          response: { code: shuffle(".swingBy(1/3, 8)", ".swingBy(1/3, 8)") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      F04: ["fam.frm.blues"],
      R13: ["fam.rhy.swing"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-twelve-bars",
    version: 1,
    role: "checkpoint",
    title: "Twelve bars",
    prompt:
      "Write a twelve-bar blues of your own over the band's kick and snare. Put a two-bar riff on `mel:` in bars 1–2 of each line, and a different answer after it on `vox:`. Use dominant sevenths, swung or straight. Done when the riff returns in bars 5–6 and 9–10.",
    skills: [{ skill: "M08", w: 1 }],
    hints: null,
    key: { tonic: "C", mode: "blues" },
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [12, 24],
    saveAs: "sketch",
    rubric: [
      {
        id: "riff",
        label: "The riff of bars 1–2 comes back in bars 5–6 and 9–10, while the answers change",
        required: true,
        skills: ["M08"],
        rule: "motif-reuse",
        track: "@melody",
        unitBars: 2,
        minRatio: 0.3,
      },
      {
        id: "form",
        label: "The chords follow the twelve-bar blues, standard or with the quick change",
        required: false,
        skills: ["F04", "H10"],
        rule: "blues-form",
        variant: "standard",
        quickChangeOk: true,
      },
      {
        id: "sevenths",
        label: "Every chord is a dominant seventh, a 7 after the letter",
        required: false,
        skills: ["C06"],
        rule: "chord-qualities",
        subsetOf: ["7"],
        depth: "seventh",
      },
      {
        id: "swing",
        label: "The hats play long–short, as with `.swingBy(1/3, 4)`",
        required: false,
        skills: ["R13"],
        rule: "swing",
        track: ["hats", "@drums"],
        drums: ["hatClosed", "hatOpen", "ride"],
        subdivision: 8,
        ratio: [1.6, 2.4],
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: a new figure in every line",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: the call in every line, three answers, straight",
        response: { code: blues(FORM, "", call(CALLS), answer(ANSWERS)) },
        expect: "pass",
      },
      {
        name: "beyond the brief: the quick change, a turnaround, swung hats, riff and answers",
        response: {
          code: blues(
            "<C7 F7 C7!2 F7!2 C7!2 G7 F7 [C7 F7] [C7 G7]>",
            SWING,
            call(CALLS, SWING),
            answer(ANSWERS, SWING),
          ),
        },
        expect: "pass",
      },
      {
        name: "one two-bar riff looped: one idea, nothing comes back to",
        response: { code: blues(FORM, SWING, call("<[0 ~ 1 2 ~ 4 2 ~] [3 2 0 ~]>", SWING)) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
