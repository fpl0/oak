// U14.CP Modes checkpoint (contracts §7.6; AUTHORING §10). The three gated skills are concept skills that no
// drill family gives evidence for (`fam.key.scale-spell` and `fam.deg.index` credit S01 and S02), so the authored
// items measure them, each on a home note the lessons did not drill it on:
// - two-colours-from-one-word: a call in E on the guitar and an answer in E on the Rhodes, each moved into its
//   mode by changing one word of `.scale()`: E Mixolydian and E Dorian (S12);
// - raise-one-lower-one: two scales on the degree pad, each opened on the scale it comes from: B♭ Lydian from
//   B♭ major, A Phrygian from A minor (S13);
// - number-the-modal-loops: two loops read from their chord names, numbered in their own mode: A G D A in
//   A Mixolydian (I ♭VII IV I), Em A Em A in E Dorian (i IV i IV) (H11).
// E10 is level-setting (a re-test, `CHECKPOINT_RETESTS`): the six colours by ear (`fam.key.mode`, level 5) and
// minor degrees in context (`fam.deg.fet-minor`, whose raised 6 is the Dorian note). It never blocks.
// The Make is a rock loop of the learner's own in D Mixolydian over the Band's drums: the major chord a whole step
// below home (♭VII) is the one required rule (H11); te in the riff (S12) and IV are suggestions.
// Spec: content/specs/U14.md, "U14.CP Modes checkpoint".
//
// Departures from the spec:
// - two-colours-from-one-word plays the two lines one after the other (a two-bar call, then a two-bar answer):
//   in the same bars the G♯ of Mixolydian and the G of Dorian would sound together. Both lines touch degree 3 and
//   degree 6, so a swapped pair of words fails on both lines, and the call touches 4 and 7, so Lydian (A♯, D♯)
//   fails as well.
// - number-the-modal-loops shows each loop as code (its chord names), as the lessons' numeral steps do.
//
// No sung item, and no syllable of U15 (fi, ra): a learner in Quiet mode passes the same checkpoint. Checked at its
// place in the default order (session 155, after U15.L01): every U14 tool and word is the learner's.
import {
  type CheckpointDef,
  type Degree,
  defineCheckpoint,
  type Exercise,
  type KeySpec,
  type Matcher,
} from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
type Fact = Extract<Exercise, { kind: "fact" }>;

// --- two-colours-from-one-word ------------------------------------------------------------------------------

const E_MIX: KeySpec = { tonic: "E", mode: "mixolydian" };
/**
 * The call, bars 1–2 on the crunch guitar: B C♯ D E | D B A G♯ in E Mixolydian (5 6 ♭7 1 | ♭7 5 4 3). On E major
 * the D is D♯; on Lydian the A is A♯ as well.
 */
const CALL = "<[4 5 6 7] [6 4 3 2] ~ ~>";
/**
 * The answer, bars 3–4 on the Rhodes an octave down: E F♯ G C♯ | B G E in E Dorian (1 2 ♭3 6 | 5 ♭3 1). On E
 * minor the C♯ is C; on Mixolydian the G is G♯.
 */
const ANSWER = "<~ ~ [0 1 2 5] [4 2 0 ~]>";
const lines = (callScale: string, answerScale: string) =>
  code(
    `mel: n("${CALL}").scale("E4:${callScale}").s("crunch")`,
    `vox: n("${ANSWER}").scale("E3:${answerScale}").s("rhodes")`,
  );
const COLOURS_STARTER = lines("⟪major⟫", "⟪minor⟫");
const COLOURS = lines("mixolydian", "dorian");
const NOTES: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  tracks: ["mel", "vox"],
};

// --- raise-one-lower-one ------------------------------------------------------------------------------------

const PAD: Degree[] = ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"];
const buildPart = (
  id: string,
  name: string,
  prompt: string,
  tonic: string,
  from: "major" | "minor",
  degrees: Degree[],
  tests: Fact["tests"],
): Fact => ({
  kind: "fact",
  id,
  version: 1,
  role: "checkpoint",
  prompt,
  skills: [{ skill: "S13", w: 1 }],
  hints: null,
  answer: { ui: "scale-builder", tonic, input: "degrees", palette: PAD, from },
  correct: { degrees },
  spelling: "enharmonic",
  order: "set",
  // The catalog writes the scale's name in lower case and adds the chromatic syllables of U15 (fi, ra); the
  // checkpoint keeps to degrees, as U14 does.
  feedbackText: {
    "id.scale-extra": `{deg} ({note}) is not in ${name}. It is ${name.split(" ")[0]} ${from} with one degree moved, so the old note goes.`,
    "id.scale-missing": `${name} also has {deg}, the note {note}.`,
    "id.scale-other": `That is {got}; ${name} has {swaps}.`,
  },
  tests,
});
const LYDIAN: Degree[] = ["1", "2", "3", "#4", "5", "6", "7"];
const PHRYGIAN: Degree[] = ["1", "b2", "b3", "4", "5", "b6", "b7"];

// --- number-the-modal-loops ---------------------------------------------------------------------------------

/** A loop of four chords by name on the organ over its roots. */
const loop = (names: string) =>
  code(
    `const changes = "<${names}>"\n`,
    'bass: chord(changes).rootNotes(2).s("ebass").lpf(600)',
    'chords: chord(changes).voicing().s("organ")',
  );
const numberPart = (
  id: string,
  prompt: string,
  key: KeySpec,
  names: string,
  rn: string[],
  tests: Fact["tests"],
): Fact => ({
  kind: "fact",
  id,
  version: 1,
  role: "checkpoint",
  key,
  prompt,
  skills: [{ skill: "H11", w: 1 }],
  hints: null,
  stimulus: { src: "code", code: loop(names), bars: 4, showCode: true },
  answer: { ui: "rn-palette", slots: 4, allow: ["triads"] },
  correct: { rn },
  spelling: "enharmonic",
  order: "sequence",
  tests,
});
const MIX_RN = ["I", "bVII", "IV", "I"];
const DOR_RN = ["i", "IV", "i", "IV"];

// --- the Make -----------------------------------------------------------------------------------------------

const D_MIX: KeySpec = { tonic: "D", mode: "mixolydian" };
/** A rock loop in D Mixolydian: organ stabs, a pumping bass on the roots, the crunch guitar on a riff. */
const rock = (changes: string, riff: string) =>
  code(
    `const changes = "${changes}"\n`,
    'chords: chord(changes).voicing().struct("x ~ x x ~ x x ~").s("organ").gain(.6)',
    'bass: chord(changes).rootNotes(2).struct("x*8").s("ebass").lpf(600)',
    `gtr: n("${riff}").scale("D3:mixolydian").s("crunch")`,
  );
/** D F♯ A F♯ D | A B A F♯ D: home, the 3rd and 5th, and 6; it never touches degree 7, so no mode is heard. */
const RIFF_NO_7 = "<[0 ~ 2 4 ~ 2 0 ~] [4 ~ 5 4 2 ~ 0 ~]>";
/** The same riff with te (C) in bar 2: A B C A, then down to home. */
const RIFF_TE = "<[0 ~ 2 4 ~ 2 0 ~] [4 ~ 5 6 4 ~ 0 ~]>";
const MAKE_STARTER = rock("<D D G D>", RIFF_NO_7);

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U14.CP",
  title: "Modes checkpoint",
  covers: ["U14"],
  gated: ["S12", "S13", "H11"],
  levelSetting: ["E10"],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "two-colours-from-one-word",
      version: 1,
      role: "checkpoint",
      key: E_MIX,
      prompt:
        "Change one word in each `.scale()`. Put the call, the `mel:` line on E major, in E Mixolydian. Put the answer, the `vox:` line on E minor, in E Dorian. Leave the numbers as they are. Done when both lines play the target's notes.",
      skills: [{ skill: "S12", w: 1 }],
      hints: null,
      code: { starter: COLOURS_STARTER },
      reference: { solutions: [COLOURS], bars: 4 },
      matcher: NOTES,
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      // The catalog words a wrong note in degrees of the exercise's key (E Mixolydian), which misreads the answer
      // line; this names the line and the one note each mode changes.
      feedbackText: {
        "melody.wrong-degree":
          "Bar {bar}, {beatLabel}: not the target's note. Mixolydian is major with its 7th lowered; Dorian is minor with its 6th raised. Check which word went on which line.",
      },
      tests: [
        { name: "reference", response: { code: COLOURS }, expect: "pass" },
        {
          name: "unchanged",
          response: { code: lines("major", "minor") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the two words swapped",
          response: { code: lines("dorian", "mixolydian") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "Lydian for Mixolydian: A♯ and D♯ in the call",
          response: { code: lines("lydian", "dorian") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "only the call moved: the answer still has C",
          response: { code: lines("mixolydian", "minor") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
      ],
    },
    {
      kind: "all",
      id: "raise-one-lower-one",
      version: 1,
      role: "checkpoint",
      prompt:
        "Build two scales on the degree pad, one at a time. Each pad opens on the scale it comes from; change one degree to make the mode. Done when each pad holds its mode's seven degrees.",
      skills: [{ skill: "S13", w: 1 }],
      hints: null,
      tests: [],
      parts: [
        buildPart(
          "b-flat-lydian",
          "B♭ Lydian",
          "Build B♭ Lydian. The pad holds B♭ major: raise one degree a half step.",
          "Bb",
          "major",
          LYDIAN,
          [
            { name: "1 2 3 ♯4 5 6 7", response: { answer: { degrees: LYDIAN } }, expect: "pass" },
            {
              name: "4 left beside ♯4",
              response: { answer: { degrees: ["1", "2", "3", "4", "#4", "5", "6", "7"] } },
              expect: "fail",
              feedback: ["id.scale-extra"],
            },
            {
              name: "Mixolydian: 7 lowered instead",
              response: { answer: { degrees: ["1", "2", "3", "4", "5", "6", "b7"] } },
              expect: "fail",
              feedback: ["id.scale-extra", "id.scale-missing"],
            },
          ],
        ),
        buildPart(
          "a-phrygian",
          "A Phrygian",
          "Build A Phrygian. The pad holds A minor: lower one degree a half step.",
          "A",
          "minor",
          PHRYGIAN,
          [
            { name: "1 ♭2 ♭3 4 5 ♭6 ♭7", response: { answer: { degrees: PHRYGIAN } }, expect: "pass" },
            {
              name: "2 left beside ♭2",
              response: { answer: { degrees: ["1", "b2", "2", "b3", "4", "5", "b6", "b7"] } },
              expect: "fail",
              feedback: ["id.scale-extra"],
            },
            {
              name: "Dorian: 6 raised instead",
              response: { answer: { degrees: ["1", "2", "b3", "4", "5", "6", "b7"] } },
              expect: "fail",
              feedback: ["id.scale-extra", "id.scale-missing"],
            },
          ],
        ),
      ],
    },
    {
      kind: "all",
      id: "number-the-modal-loops",
      version: 1,
      role: "checkpoint",
      prompt:
        "Write the numeral of every chord in two loops, each counted from the home of its own mode. Use upper case for major, lower case for minor, and a flat where the root is a lowered degree.",
      skills: [{ skill: "H11", w: 1 }],
      hints: null,
      tests: [],
      parts: [
        numberPart(
          "a-mixolydian-loop",
          "Write the four numerals of this loop in A Mixolydian: A, G, D, A.",
          { tonic: "A", mode: "mixolydian" },
          "A G D A",
          MIX_RN,
          [
            { name: "I ♭VII IV I", response: { answer: { rn: MIX_RN } }, expect: "pass" },
            {
              name: "VII for ♭VII: G is a whole step under A",
              response: { answer: { rn: ["I", "VII", "IV", "I"] } },
              expect: "fail",
              feedback: ["harmony.rn-degree"],
            },
            {
              name: "counted from D: V IV I V",
              response: { answer: { rn: ["V", "IV", "I", "V"] } },
              expect: "fail",
              feedback: ["harmony.rn-degree"],
            },
          ],
        ),
        numberPart(
          "e-dorian-loop",
          "Write the four numerals of this loop in E Dorian: Em, A, Em, A.",
          { tonic: "E", mode: "dorian" },
          "Em A Em A",
          DOR_RN,
          [
            { name: "i IV i IV", response: { answer: { rn: DOR_RN } }, expect: "pass" },
            {
              name: "iv for IV: A major has C♯",
              response: { answer: { rn: ["i", "iv", "i", "iv"] } },
              expect: "fail",
              feedback: ["harmony.rn-case"],
            },
            {
              name: "I for i: E minor read as major",
              response: { answer: { rn: ["I", "IV", "I", "IV"] } },
              expect: "fail",
              feedback: ["harmony.rn-case"],
            },
          ],
        ),
      ],
    },
  ],
  recipe: {
    items: [12, 14],
    perSkillMin: 2,
    families: {
      E10: ["fam.key.mode", "fam.deg.fet-minor"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-modal-rock",
    version: 1,
    role: "checkpoint",
    title: "D Mixolydian",
    prompt:
      "Write a rock loop of four to eight bars in D Mixolydian over the band's drums. Put a C chord, ♭VII, into `changes` at least once, with D (home) and G (IV) in your order. Let the riff play te, C, the note that keeps it from sounding major. Done when the loop has a C chord.",
    skills: [{ skill: "H11", w: 1 }],
    hints: null,
    key: D_MIX,
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [4, 8],
    saveAs: "sketch",
    rubric: [
      {
        id: "flat-seven",
        label: "A C major chord, ♭VII, in the loop at least once",
        required: true,
        skills: ["H11"],
        rule: "contains-rn",
        rn: ["bVII"],
        min: 1,
      },
      {
        id: "te",
        label: "The `gtr:` line plays te (C) at least once",
        required: false,
        skills: ["S12"],
        rule: "degree-set",
        track: "gtr",
        contains: ["b7"],
      },
      {
        id: "four",
        label: "A G chord, IV, in the loop at least once",
        required: false,
        skills: ["H11"],
        rule: "contains-rn",
        rn: ["IV"],
        min: 1,
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: D D G D, the riff never on 7",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: C in bar 2",
        response: { code: rock("<D C G D>", RIFF_NO_7) },
        expect: "pass",
      },
      {
        name: "beyond the brief: eight bars, ♭VII–IV–I at the end, te in the riff",
        response: { code: rock("<D C G D D C [G C] D>", RIFF_TE) },
        expect: "pass",
      },
      {
        name: "A major for C: V is not the colour chord",
        response: { code: rock("<D A G D>", RIFF_TE) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
