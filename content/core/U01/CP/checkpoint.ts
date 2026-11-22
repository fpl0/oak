// U01.CP Rhythm I checkpoint (contracts §7.6; AUTHORING §10). Most items are generated from the drill
// families at each skill's level; these are the authored ones: two code items for the skills no family
// measures yet (R02 tempo, R03 the bar, R04 backbeat, R06 rests, with R05 eighths alongside), a note-value
// fact for N01, and the checkpoint Make. Checkpoint items carry no hints and the tutor is off.
// Spec: content/specs/U01.md, "U01.CP Rhythm I checkpoint".
import { type CheckpointDef, defineCheckpoint } from "@oak/content-kit";

const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const BEAT = (kick: string, snare: string, hats: string, bpm = 100) =>
  `${T(bpm)}kick: s("${kick}")\nsnare: s("${snare}")\nhats: s("${hats}")`;

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U01.CP",
  title: "Rhythm I checkpoint",
  covers: ["U01"],
  gated: ["R02", "R03", "R04", "R05", "R06", "R07", "R08", "N01"],
  levelSetting: ["R01", "E01"],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "tempo-and-rest",
      version: 1,
      role: "checkpoint",
      prompt:
        "Change the tempo to **108** beats per minute, and make beat 4 silent with a rest. Keep beats 1, 2 and 3 as they are, so the line still has four words.",
      skills: [
        { skill: "R02", w: 0.4 },
        { skill: "R06", w: 0.4 },
        { skill: "R03", w: 0.2 },
      ],
      hints: null,
      code: { starter: `setcpm(⟪88⟫/4)\n\ndrums: s("⟪bd sd bd sd⟫")` },
      reference: { solutions: [`${T(108)}drums: s("bd sd bd ~")`], bars: 1 },
      matcher: { m: "rhythm", tol: [0, 1], durations: false, perRole: false, displacementCredit: 0.5 },
      constraints: [{ c: "tempo", bpm: 108 }],
      target: { audible: true },
      // The catalog says "missing hit": this says how to keep the bar four beats long.
      feedbackText: {
        "rhythm.missing":
          "Bar {bar}, {beatLabel}: no hit here yet{role}. Keep beats 1, 2 and 3 where they were: write `~` for beat 4 rather than deleting a word.",
      },
      tests: [
        { name: "reference", response: { code: `${T(108)}drums: s("bd sd bd ~")` }, expect: "pass" },
        { name: "other sounds", response: { code: `${T(108)}drums: s("bd cp bd ~")` }, expect: "pass" },
        {
          name: "unchanged",
          response: { code: `${T(88)}drums: s("bd sd bd sd")` },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the gap, but still at 88",
          response: { code: `${T(88)}drums: s("bd sd bd ~")` },
          expect: "fail",
          feedback: ["code.tempo"],
        },
        {
          name: "deleted the last word instead of resting",
          response: { code: `${T(108)}drums: s("bd sd bd")` },
          expect: "fail",
          feedback: ["rhythm.missing"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "backbeat-three-lines",
      version: 1,
      role: "checkpoint",
      prompt:
        "Make a backbeat on three lines. Keep the `kick:` line as it is, add a `snare:` line with `sd` on beats 2 and 4, and make the hats play two per beat, eight in the bar.",
      skills: [
        { skill: "R04", w: 0.6 },
        { skill: "R05", w: 0.4 },
      ],
      hints: null,
      code: { starter: `${T(100)}kick: s("bd ~ bd ~")\nhats: s("⟪hh hh hh hh⟫")` },
      reference: { solutions: [BEAT("bd ~ bd ~", "~ sd ~ sd", "hh*8")], bars: 1 },
      matcher: { m: "rhythm", tol: [0, 1], durations: false, perRole: true, displacementCredit: 0.5 },
      constraints: [{ c: "labels", min: 3 }],
      target: { audible: true },
      // The catalog says "labeled parts" and only "check where it starts": these say what goes where.
      feedbackText: {
        "code.labels": "Write {min} lines, each starting with its own name: `kick:`, `snare:` and `hats:`.",
        "rhythm.displaced":
          "Right rhythm, shifted {shiftLabel}. The snare goes on beats 2 and 4, the kick on 1 and 3.",
      },
      tests: [
        { name: "reference", response: { code: BEAT("bd ~ bd ~", "~ sd ~ sd", "hh*8") }, expect: "pass" },
        {
          name: "hats in brackets, a little softer",
          response: { code: `${BEAT("bd ~ bd ~", "~ sd ~ sd", "[hh hh]*4")}.gain(.6)` },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: `${T(100)}kick: s("bd ~ bd ~")\nhats: s("hh hh hh hh")` },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "snare on 1 and 3",
          response: { code: BEAT("bd ~ bd ~", "sd ~ sd ~", "hh*8") },
          expect: "fail",
          feedback: ["rhythm.displaced"],
        },
        {
          name: "snare written into the kick line",
          response: { code: `${T(100)}kick: s("bd sd bd sd")\nhats: s("hh*8")` },
          expect: "fail",
          feedback: ["code.labels"],
        },
      ],
    },
    {
      kind: "fact",
      id: "eighths-in-a-whole",
      version: 1,
      role: "checkpoint",
      prompt: "Enter how many eighth notes last as long as one whole note.",
      skills: [{ skill: "N01", w: 1 }],
      hints: null,
      answer: { ui: "number" },
      correct: { number: 8 },
      // The catalog line says "Listen to both", but a fact has no sound.
      feedbackText: {
        "id.wrong":
          "Not {got}. Two eighth notes last as long as a quarter, and four quarters fill a whole note.",
      },
      spelling: "strict",
      order: "set",
      tests: [
        { name: "eight", response: { answer: { number: 8 } }, expect: "pass" },
        { name: "four, the quarter notes", response: { answer: { number: 4 } }, expect: "fail" },
        { name: "two, the half notes", response: { answer: { number: 2 } }, expect: "fail" },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      R05: ["fam.rhy.count"],
      R07: ["fam.rhy.count"],
      R08: ["fam.rhy.meter"],
      N01: ["fam.rhy.read"],
      R01: ["fam.rhy.pulse"],
      E01: ["fam.rhy.echo", "fam.rhy.dictation"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-groove",
    version: 1,
    role: "checkpoint",
    prompt:
      "Write a two-bar groove with anything from this unit you like. Keep the snare on beats 2 and 4 in every bar.",
    skills: [{ skill: "R04", w: 1 }],
    hints: null,
    code: { starter: BEAT("bd ~ bd ~", "~ sd ~ sd", "hh*8", 96) },
    bars: [2, 4],
    saveAs: "sketch",
    rubric: [
      {
        id: "backbeat",
        label: "Snare on beats 2 and 4 in every bar",
        required: true,
        skills: ["R04"],
        rule: "onsets",
        track: "@drums",
        drum: "snare",
        contains: [
          [1, 4],
          [3, 4],
        ],
        perBar: true,
      },
      {
        id: "two-bars",
        label: "At least two different bars on one line, using `< >`",
        required: false,
        skills: ["R03"],
        // The effect, not the brackets: `<[~ sd ~ sd]>` plays the same bar every time.
        rule: "custom",
        fn: "bars-differ",
        params: { min: 2, alsoUses: ["tb.mini.alt"] },
      },
    ],
    tests: [
      {
        name: "the starter as it came",
        response: { code: BEAT("bd ~ bd ~", "~ sd ~ sd", "hh*8", 96) },
        expect: "fail",
        feedback: ["make.unchanged"],
      },
      {
        name: "minimal: a kick moved to the and of 2",
        response: { code: BEAT("bd ~ [~ bd] ~", "~ sd ~ sd", "hh*8", 96) },
        expect: "pass",
      },
      {
        name: "beyond the brief",
        response: {
          code: `${T(104)}kick: s("<[bd ~ bd ~] [bd ~ [~ bd] [bd ~]]>")\nsnare: s("<[~ sd ~ sd] [~ sd ~ [sd sd]]>")\nhats: s("<hh*8 [hh*6 oh ~]>").gain(.7)`,
        },
        expect: "pass",
      },
      {
        name: "snare on the wrong beats",
        response: { code: BEAT("bd ~ bd ~", "sd ~ sd ~", "hh*8", 96) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
