// R.CP Rhythm checkpoint (contracts §7.6; AUTHORING §10), the checkpoint of the Advanced Rhythm track. It covers
// R1, R2 and R3 and, passed or soft-passed, opens RC1 "16th-Note Funk" and RC2 "Clave & Polyrhythm"; it gates
// nothing else (track checkpoints gate only their track's capstones, §7.6 rule 5). It lives in the folder of the
// last unit it covers, as U09.CP and U13.CP do.
//
// The generated items come from the families that give evidence for a gated skill: odd groupings in 5/8, 7/8 and
// 9/8 (R16, `fam.rhy.odd-grouping`), three against two, four against three and polymeter (R17,
// `fam.rhy.polyrhythm`), tresillo, cinquillo, son and rumba in both directions (R18, `fam.rhy.clave`); rhythm
// dictation (E14, `fam.rhy.dictation`) is a level-setting re-test of U13.CP and never blocks. R14 and R15 have no
// family, so the authored items measure them, each over a groove no lesson step used:
// - ghost-the-hats: a funk groove whose sixteenth hats are all at one level; the off-beat sixteenths become ghost
//   notes and the beats stay loud (R14);
// - displace-the-riff: a two-bar clav riff whose second time round comes back an eighth later (R15);
// - son-clave-two-three: the son clave turned to face a tune that starts on its two-side, its three-side written
//   with `(3,8)` (R18).
// The Make is four bars of the learner's own over the son clave 3-2: a ghosted sixteenth hat line is the one
// required rule (R14); the clave kept whole and a bass that pulls against the beat are suggestions.
// Spec: content/specs/R3.md, "R.CP Rhythm checkpoint".
//
// The corrections-pass standard (AUTHORING §20.2), on every item and the Make:
// - every required rule checks what is HEARD: `velocity-ghosts` drops a hit at velocity 0 and asks for loud
//   accents beside the ghosts; `displaced-copy` asks every onset of the copy to move by the same eighth (a whole
//   bar moves nothing, a sixteenth is another figure); `clave` with `minBars: 4` asks every two-bar window to hold
//   the whole son clave in the 2-3 order;
// - each item pins a WRONG answer that uses the right function: ghosts at `.velocity(0)`, `.late(1)` and
//   `.late(1/16)`, the 3-2 written with the same `(3,8)`, the right hats at `.gain(.01)` (more than 24 dB under
//   the groove: not heard);
// - each item passes three other right answers besides its reference.
// Feedback never names the answer: every override describes the sound and the place.
//
// No sung item; the tapped items of `fam.rhy.polyrhythm` are level-setting production items, skipped in Quiet
// mode (contracts §7.6, §8). Written for the learner at the gate (AUTHORING §20.1): R3 can be reached right after
// U13.CP, so nothing here needs a mode name, a chromatic degree or U14–U17's sounds; the rhythm track's own tools
// (`.velocity()`, `.late()`, `(k,n)`, `arrange()`) are the learner's by then in every legal order.
import { type CheckpointDef, defineCheckpoint, type KeySpec, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const C_MAJOR: KeySpec = { tonic: "C", mode: "major" };

// --- ghost-the-hats -----------------------------------------------------------------------------------------

/** A funk kick: beat 1, the "a" of 1, the "and" of 2 and the "and" of 3. */
const KICK = 'kick: s("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
/** A D minor funk bass, on the one with the kick, popping the octave. */
const FUNK_BASS = 'bass: note("d2 ~ ~ d3 ~ ~ d2 ~ ~ ~ f2 ~ g2 ~ a2 c3").s("fingerbass").clip(.5)';
const hats = (tail: string) => `hats: s("hh*16")${tail}.gain(.5)`;
const funk = (hatsLine: string) => code(KICK, SNARE, hatsLine, FUNK_BASS);
const GHOST_STARTER = code(KICK, SNARE, 'hats: ⟪s("hh*16").gain(.5)⟫', FUNK_BASS);
const GHOSTED = funk(hats('.velocity("[1 .3 .6 .3]*4")'));
const GHOST_RULE: RubricRule = {
  id: "hats-ghosted",
  label:
    "At least 8 hi-hat hits on the “e”s and “a”s are quiet ghost notes, and the hits on the beats stay loud",
  required: true,
  skills: ["R14"],
  rule: "velocity-ghosts",
  track: "hats",
  min: 8,
  on: "16th-offbeat",
  accents: 2,
};

// --- displace-the-riff --------------------------------------------------------------------------------------

/** The son clave 3-2 on the rimshot (content-kit `claveMini`): the three-side, then the two-side. */
const SON_32 = "<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>";
const CLAVE = `perc: s("${SON_32}").gain(.7)`;
const LOW_KICK = 'kick: s("bd ~ ~ ~ bd ~ ~ ~").gain(.6)';
/**
 * Two bars of clav on C7 then F7, short notes on the eighth grid: bar 1 C E G B♭ on 1, the "and" of 1, 2 and
 * the "and" of 3; bar 2 A C A F on 1, the "and" of 2, 3 and 4.
 */
const RIFF = 'const riff = note("<[c4 e4 g4 ~ ~ bb4 ~ ~] [a4 ~ ~ c5 a4 ~ f4 ~]>")';
const keys = (second: string, sound = "clav") =>
  `keys: arrange([2, riff], [2, ${second}]).s("${sound}").clip(.4)`;
const riffPiece = (second: string, sound = "clav", riff = RIFF) =>
  code(`${riff}\n`, CLAVE, LOW_KICK, keys(second, sound));
const DISPLACE_STARTER = code(
  `${RIFF}\n`,
  CLAVE,
  LOW_KICK,
  'keys: arrange([2, riff], [2, ⟪riff⟫]).s("clav").clip(.4)',
);
const DISPLACED = riffPiece("riff.late(1/8)");
const DISPLACE_RULE: RubricRule = {
  id: "riff-displaced",
  label: "The riff comes back in bars 3 and 4 moved one eighth note later, every note by the same amount",
  required: true,
  skills: ["R15"],
  rule: "custom",
  fn: "displaced-copy",
  params: { track: "keys", by: [[1, 8]], min: 1 },
};

// --- son-clave-two-three ------------------------------------------------------------------------------------

/** A tune in C that starts on the two-side: E G on beats 2 and 3, then D B G on the three-side's hits. */
const TUNE_23 = 'mel: note("<[~ ~ e4 ~ g4 ~ ~ ~] [d5 ~ ~ b4 ~ ~ g4 ~]>").s("piano")';
const SOFT_HATS = 'hats: s("hh*8").gain(.3)';
const claveOn = (percLine: string) => code(percLine, LOW_KICK, SOFT_HATS, TUNE_23);
const CLAVE_STARTER = claveOn('perc: ⟪s("~").gain(.7)⟫');
const TWO_THREE = claveOn('perc: s("<[~ ~ rim ~ rim ~ ~ ~] rim(3,8)>").gain(.7)');
const CLAVE_RULES: RubricRule[] = [
  {
    id: "clave-two-three",
    label: "The rimshot plays the son clave 2-3, its two-side first, for all four bars",
    required: true,
    skills: ["R18"],
    rule: "clave",
    track: "perc",
    type: "son",
    direction: "2-3",
    minBars: 4,
  },
  {
    id: "three-side-euclid",
    label: "The three-side is written as `(3,8)`: three hits spread over eight steps",
    required: true,
    skills: ["R18"],
    rule: "uses",
    tool: "tb.mini.euclid",
  },
];

// --- the Make -----------------------------------------------------------------------------------------------

/** The son clave 3-2 given on the rimshot, a kick on 1 and 3, straight eighth hats at one level, a tresillo bass. */
const MAKE_STARTER = code(
  CLAVE,
  'kick: s("bd ~ bd ~").gain(.7)',
  'hats: s("hh*8").gain(.4)',
  'bass: note("<c2 g1>").struct("x ~ ~ x ~ ~ x ~").s("fingerbass")',
);
const makePiece = (
  hatsLine: string,
  bassLine = 'bass: note("<c2 g1>").struct("x ~ ~ x ~ ~ x ~").s("fingerbass")',
) => code(CLAVE, 'kick: s("bd ~ bd ~").gain(.7)', hatsLine, bassLine);
const MAKE_MINIMAL = makePiece('hats: s("hh*16").velocity("[1 .3 .7 .3]*4").gain(.45)');
/**
 * Beyond the brief: the hats ghosted and opened on the "and" of 4, a tumbao bass (the "and" of 2, then beat 4
 * anticipating the next bar's root) and a cowbell on the cinquillo.
 */
const MAKE_RICH = code(
  CLAVE,
  'kick: s("bd ~ ~ bd ~ ~ bd ~").gain(.7)',
  'hats: s("hh hh hh hh hh hh hh hh hh hh hh hh hh hh oh hh").velocity("[1 .3 .6 .3 1 .3 .6 .3 1 .3 .6 .3 1 .3 1 .3]").gain(.45)',
  'bass: note("<[~ ~ ~ g2 ~ ~ g1 ~] [~ ~ ~ d2 ~ ~ c2 ~]>").s("fingerbass")',
  'perc2: s("cb(5,8)").gain(.35)',
);
const GHOSTS_IN_THE_MAKE: RubricRule = {
  id: "hats-ghosted",
  label: "The hats play sixteenths, with quiet ghost notes on the “e”s and “a”s and loud hits on the beats",
  required: true,
  skills: ["R14"],
  rule: "velocity-ghosts",
  track: "hats",
  min: 4,
  on: "16th-offbeat",
  accents: 2,
};

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "R.CP",
  title: "Rhythm checkpoint",
  covers: ["R1", "R2", "R3"],
  gated: ["R14", "R15", "R16", "R17", "R18"],
  levelSetting: ["E14"],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "ghost-the-hats",
      version: 1,
      role: "checkpoint",
      key: { tonic: "D", mode: "minor" },
      prompt:
        "The sixteenth hi-hats of this funk groove all hit at one level. Give the hats a `.velocity()` string: the sixteenths between the eighths, the “e”s and “a”s, become quiet ghost notes, and the hits on the beats stay loud. Keep the other lines.",
      skills: [{ skill: "R14", w: 1 }],
      hints: null,
      code: { starter: GHOST_STARTER },
      reference: { solutions: [GHOSTED], bars: 2 },
      matcher: { m: "rubric", rules: [GHOST_RULE] },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "rubric.unmet":
          "{label}: not yet. In the target the hats lean on every beat, and the two sixteenths around each “and” drop to a whisper you can still hear.",
      },
      tests: [
        { name: "reference", response: { code: GHOSTED }, expect: "pass" },
        {
          name: "levels written with gain instead",
          response: { code: funk('hats: s("hh*16").gain("[.5 .15 .35 .15]*4")') },
          expect: "pass",
        },
        {
          name: "a loud and a ghost, eight times a bar",
          response: { code: funk(hats('.velocity("[1 .25]*8")')) },
          expect: "pass",
        },
        {
          name: "on a drum machine, the ghosts softer still",
          response: {
            code: funk('hats: s("hh*16").bank("RolandTR909").velocity("[.95 .2 .7 .2]*4").gain(.5)'),
          },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(GHOST_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right function, silent: the ghosts at velocity 0",
          response: { code: funk(hats('.velocity("[1 0 .6 0]*4")')) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "every hat quiet: no beat stands out",
          response: { code: funk(hats(".velocity(.3)")) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "upside down: the beats quiet, the off-beats loud",
          response: { code: funk(hats('.velocity("[.3 1]*8")')) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "displace-the-riff",
      version: 1,
      role: "checkpoint",
      key: C_MAJOR,
      prompt:
        "The two-bar clav riff plays twice over the son clave. Keep bars 1 and 2 as they are. In bars 3 and 4, bring the riff back one eighth note later: the same notes, every one moved by the same eighth. Change only the second `riff` in `arrange()`.",
      skills: [{ skill: "R15", w: 1 }],
      hints: null,
      code: { starter: DISPLACE_STARTER },
      reference: { solutions: [DISPLACED], bars: 4 },
      matcher: { m: "rubric", rules: [DISPLACE_RULE] },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "rubric.unmet":
          "{label}: not yet. In the target bars 3 and 4 play the riff's notes in the same order, each one half a beat after where it fell in bars 1 and 2.",
      },
      tests: [
        { name: "reference", response: { code: DISPLACED }, expect: "pass" },
        { name: "the eighth as a decimal", response: { code: riffPiece("riff.late(.125)") }, expect: "pass" },
        { name: "two sixteenths", response: { code: riffPiece("riff.late(2/16)") }, expect: "pass" },
        {
          name: "the moved riff, a little softer",
          response: { code: riffPiece("riff.late(1/8).gain(.8)") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(DISPLACE_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right function, a whole bar: nothing moves inside the bar",
          response: { code: riffPiece("riff.late(1)") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the right function, the wrong amount: a sixteenth",
          response: { code: riffPiece("riff.late(1/16)") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the right function, a feel: a thirty-second",
          response: { code: riffPiece("riff.late(1/32)") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "son-clave-two-three",
      version: 1,
      role: "checkpoint",
      key: C_MAJOR,
      prompt:
        "Write the son clave on the rimshot line, under a tune that starts on beats 2 and 3. Face the tune: the two-side first, then the three-side written as three hits spread over eight steps. Done when the clave plays 2-3 for all four bars.",
      skills: [{ skill: "R18", w: 1 }],
      hints: null,
      code: { starter: CLAVE_STARTER },
      reference: { solutions: [TWO_THREE], bars: 4 },
      matcher: { m: "rubric", rules: CLAVE_RULES },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "rubric.unmet":
          "{label}: not yet. In the target the rimshot answers the tune: two hits in bar 1, where the tune enters, then three in bar 2, and round again.",
      },
      tests: [
        { name: "reference", response: { code: TWO_THREE }, expect: "pass" },
        {
          name: "the 3-2 moved a bar later",
          response: { code: claveOn('perc: s("<rim(3,8) [~ ~ rim ~ rim ~ ~ ~]>").late(1).gain(.7)') },
          expect: "pass",
        },
        {
          name: "on the cowbell",
          response: { code: claveOn('perc: s("<[~ ~ cb ~ cb ~ ~ ~] cb(3,8)>").gain(.5)') },
          expect: "pass",
        },
        {
          name: "the two-side in quarters",
          response: { code: claveOn('perc: s("<[~ rim rim ~] rim(3,8)>").gain(.7)') },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(CLAVE_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right function, the wrong way round: 3-2",
          response: { code: claveOn('perc: s("<rim(3,8) [~ ~ rim ~ rim ~ ~ ~]>").gain(.7)') },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the right function in every bar: three hits, never two",
          response: { code: claveOn('perc: s("rim(3,8)").gain(.7)') },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the rumba 2-3: the last hit of the three-side an eighth late",
          response: { code: claveOn('perc: s("<[~ ~ rim ~ rim ~ ~ ~] [rim ~ ~ rim ~ ~ ~ rim]>").gain(.7)') },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
  ],
  recipe: {
    items: [14, 16],
    perSkillMin: 2,
    families: {
      R16: ["fam.rhy.odd-grouping"],
      R17: ["fam.rhy.polyrhythm"],
      R18: ["fam.rhy.clave"],
      E14: ["fam.rhy.dictation"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-clave-pocket",
    version: 1,
    role: "checkpoint",
    title: "A pocket over the clave",
    prompt:
      "Make four bars of your own over the son clave 3-2 on the rimshot and the band's chords. Required: the hats play sixteenths, loud on the beats with quiet ghost notes between. Also on the checklist: the clave stays whole, and a bass that pulls against the beat. For more, a bell or a kick of your own.",
    skills: [{ skill: "R14", w: 1 }],
    hints: null,
    key: C_MAJOR,
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [4, 8],
    saveAs: "sketch",
    rubric: [
      GHOSTS_IN_THE_MAKE,
      {
        id: "clave-kept",
        label: "The rimshot keeps the son clave 3-2 for all four bars",
        required: false,
        skills: ["R18"],
        rule: "clave",
        track: "perc",
        type: "son",
        direction: "3-2",
        minBars: 4,
      },
      {
        id: "bass-pulls",
        label: "At least 4 bass notes pull: each on a light place, with the heavier place after it silent",
        required: false,
        skills: ["R15"],
        rule: "syncopation",
        track: "bass",
        min: 4,
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: straight eighths at one level",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      { name: "minimal: the hats ghosted", response: { code: MAKE_MINIMAL }, expect: "pass" },
      {
        name: "beyond the brief: a tumbao, an open hat and a bell",
        response: { code: MAKE_RICH },
        expect: "pass",
      },
      {
        name: "ghosted with gain, a busier kick",
        response: {
          code: code(
            CLAVE,
            'kick: s("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~").gain(.7)',
            'hats: s("hh*16").gain("[.5 .12 .3 .12]*4")',
            'bass: note("<c2 g1>").struct("x ~ ~ x ~ ~ x ~").s("fingerbass")',
          ),
        },
        expect: "pass",
      },
      {
        name: "on a drum machine, the ghosts very low",
        response: {
          code: makePiece('hats: s("hh*16").bank("RolandTR909").velocity("[1 .2 .8 .2]*4").gain(.5)'),
        },
        expect: "pass",
      },
      {
        name: "the right function, silent: the ghosts at velocity 0",
        response: { code: makePiece('hats: s("hh*16").velocity("[1 0 .7 0]*4").gain(.45)') },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "the right hats, far under the groove: not heard",
        response: { code: makePiece('hats: s("hh*16").velocity("[1 .3 .7 .3]*4").gain(.01)') },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "sixteenths at one level",
        response: { code: makePiece('hats: s("hh*16").gain(.4)') },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
