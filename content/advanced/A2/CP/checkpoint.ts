// A.CP Sound & arrangement checkpoint (contracts §7.6; AUTHORING §10), the checkpoint of the Arrangement & Sound
// track. It covers A1 and A2 (A1.L01–L07, A2.L01–L06) and, passed or soft-passed, opens AC1 "One Tune, Two Genres"
// (with U11.CP) and AC2 "Neo-Soul Ballad" (with J3.L04 and R1.L05); it gates nothing else (track checkpoints gate
// only their track's capstones, §7.6 rule 5). Its file sits in the folder of the last unit it covers, as U09.CP and
// U13.CP do.
//
// The generated items come from the two families of the track: cutoff, resonance, attack and release, room and
// delay by ear (D03, D04, D05: `fam.snd.params`) and which part plays which role (D08, `fam.snd.roles`). The other
// gated skills have no family, so the authored items and the Make measure them, each on a part no lesson step
// used:
// - name-the-sound: three short sounds from the A1 loop, one question each: which wave (D02), which grit (D06),
//   what moves (D07);
// - chop-the-break: Oak's break under the A2 loop, cut into slices that play in a new order (D11);
// - balance-the-loop: the A2 loop with a strings pad over the tune; the tune goes on top, the pad under it, still
//   heard (D10).
// The Make is the A2 loop in a verse and a chorus whose parts start the same in both: one section thin and the
// other thick is the one required rule (D09); the chords in their register and a sound of the learner's own are
// suggestions.
// Spec: content/specs/A2.md, "A.CP Sound & arrangement checkpoint".
//
// The corrections-pass standard (AUTHORING §20.2), on every item and the Make:
// - every required rule checks what is HEARD: `slices-reordered` reads the slices that play and their order (two
//   halves, or four in their own order, fail); `level-balance` reads the effective level of each note where the two
//   parts sound together (a part more than 24 dB under is not heard, never "under"); `contrast` on the density
//   axis counts the notes heard per bar in each section, so a quieter section is not a thinner one;
// - each item pins a WRONG answer that uses the right function: `.slice(4, "0 1 2 3")` written as `.splice()`, the
//   pad turned down to level with the tune, the pad turned down to nothing, a verse turned down instead of thinned,
//   a chorus part filled in and muted;
// - each code item passes three other right answers besides its reference.
// Feedback never names the answer: every override describes the sound and the place.
//
// No sung or tapped item: nothing in A1–A2 is sung (contracts §8). Written for the learner at the gate (AUTHORING
// §20.1): A.CP follows A2.L06, which opens after U10.CP and A1.L07, so nothing here needs a dominant seventh,
// swing, `crunch` or the blues (U11) or anything after it.
import {
  type CheckpointDef,
  defineCheckpoint,
  type IdentifyEx,
  type KeySpec,
  type RubricRule,
  type SkillId,
} from "@oak/content-kit";

const tempo = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const at = (bpm: number, ...lines: string[]) => `${tempo(bpm)}${lines.join("\n")}`;
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const A_MINOR: KeySpec = { tonic: "A", mode: "minor" };

// --- name-the-sound -----------------------------------------------------------------------------------------

/** The A1 loop at 100 BPM, in C: kick on 1 and 3, the snare on 2 and 4, eighth hats; C | F under the riff. */
const A1_BPM = 100;
const A1_DRUMS = ['kick: s("bd ~ bd ~")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*8").gain(.5)'];
const A1_BASS = (tail: string) => `bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>")${tail}`;
/** G G E G – E C – | A A F A – F C –: every note on a beat is in the chord, C then F. */
const A1_RIFF = (tail: string) => `mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>").scale("C4:major")${tail}`;
/** The riff on its own wave, nothing shaped: hollow and reedy on the square, bright and buzzing on the sawtooth. */
const WAVE = at(A1_BPM, A1_RIFF('.s("square").gain(.5)'));
/** The bass under the drums twice, the second time saturated and turned down to the same height. */
const GRIT = at(
  A1_BPM,
  ...A1_DRUMS,
  A1_BASS('.s("sawtooth").lpf(500).distort("<0 0 2 2>").gain("<.9 .9 .55 .55>")'),
);
/** A held strings chord, C E G then C F A, its level dipping four times a bar. */
const MOVES = at(
  A1_BPM,
  'pad: note("<[c4,e4,g4] [c4,f4,a4]>").s("strings").tremolosync(4).tremolodepth(.8).gain(.6)',
);

const soundPart = (
  id: string,
  skill: SkillId,
  prompt: string,
  stimulus: string,
  bars: number,
  options: { id: string; label: string }[],
  correct: string,
  wrong: string,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "checkpoint",
  prompt,
  skills: [{ skill, w: 1 }],
  hints: null,
  stimulus: { src: "code", code: stimulus, bars, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options },
  correct: { choice: [correct] },
  feedbackText: { "id.wrong": wrong },
  tests: [
    { name: correct, response: { answer: { choice: [correct] } }, expect: "pass" },
    ...options
      .filter((o) => o.id !== correct)
      .map((o) => ({
        name: `heard as ${o.id}`,
        response: { answer: { choice: [o.id] } },
        expect: "fail" as const,
        feedback: ["id.wrong" as const],
      })),
  ],
});

// --- chop-the-break -----------------------------------------------------------------------------------------

/** The break's own tempo (scripts/sounds/brk.ts), the A2 loop's bass and chords under it, in A minor. */
const BRK_BPM = 96;
const A2_BASS = 'bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)';
const A2_CHORDS = 'chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("piano").gain(.5)';
const chopped = (drumsLine: string) => at(BRK_BPM, drumsLine, A2_BASS, A2_CHORDS);
const CHOP_STARTER = at(BRK_BPM, 'drums: s("brk").slice(⟪4, "0 1 2 3"⟫)', A2_BASS, A2_CHORDS);
/** Beat 4 stutters beat 2's snare: the first three quarters as recorded, then the second twice, as eighths. */
const CHOPPED = chopped('drums: s("brk").slice(4, "0 1 2 [1 1]")');
const CHOP_RULE: RubricRule = {
  id: "slices-reordered",
  label: "The break cut into 4 or more slices that play in an order other than the recording's",
  required: true,
  skills: ["D11"],
  rule: "custom",
  fn: "slices-reordered",
  // Four pieces or more, read from the cut (1 / (end − begin)): the spec's own stutter (`0 1 2 [1 1]` on four
  // pieces) passes; two halves still fail.
  params: { track: "drums", minSlices: 4 },
};

// --- balance-the-loop ---------------------------------------------------------------------------------------

const A2_BPM = 90;
/** The A2 tune: E C A | C A | E C E | B G, on a filtered square. */
const A2_TUNE = (tail: string) =>
  `mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("A4:minor").s("square").lpf(2000)${tail}`;
/** A strings pad an octave over the chords' roots: A E | F C | C G | G D, held, in the tune's own register. */
const A2_PAD = (tail: string) =>
  `pad: n("<[0,4] [-2,2] [-5,-1] [-1,3]>").scale("A4:minor").s("strings")${tail}`;
const balanced = (padTail: string, tuneTail = ".gain(.3)") =>
  at(A2_BPM, A2_BASS, A2_PAD(padTail), A2_TUNE(tuneTail));
/** The pad at .6 over the tune at .3: about 6 dB above it. */
const BALANCE_STARTER = at(A2_BPM, A2_BASS, A2_PAD("⟪.gain(.6)⟫"), A2_TUNE(".gain(.3)"));
const BALANCED = balanced(".gain(.12)");
const BALANCE_RULE: RubricRule = {
  id: "tune-on-top",
  label: "The tune on top: the pad 3 to 18 dB under it where both play, still heard",
  required: true,
  skills: ["D10"],
  rule: "custom",
  fn: "level-balance",
  params: { louder: "mel", quieter: "pad", minDb: 3, maxDb: 18 },
};

// --- the Make -----------------------------------------------------------------------------------------------

/** The roots of Am F C G once a bar, on every beat, eight times a bar. */
const BASS_ONE = 'note("<a1 f1 c2 g1>")';
const BASS_FOUR = 'note("<a1*4 f1*4 c2*4 g1*4>")';
const BASS_EIGHT = 'note("<a1*8 f1*8 c2*8 g1*8>")';
/** Am F C G as two-note stacks, as close triads held, as close triads four times a bar (C3 to E4). */
const CHORDS_TWO = 'n("<[0,2] [-2,0] [-5,-3] [-1,1]>")';
const CHORDS_HELD = 'n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")';
const CHORDS_FOUR = 'n("<[0,2,4]*4 [-2,0,2]*4 [-5,-3,-1]*4 [-1,1,3]*4>")';
/** A strings pad above the tune: A5 E6 | F5 C6 | G5 C6 | B5 D6. */
const PAD = 'n("<[0,4] [-2,2] [-1,2] [1,3]>")';
type Section = { bass: string; chords: string; pad: string };
const THIN: Section = { bass: BASS_ONE, chords: CHORDS_TWO, pad: "silence" };
const SAME: Section = { bass: BASS_FOUR, chords: CHORDS_HELD, pad: PAD };
const THICK: Section = { bass: BASS_EIGHT, chords: CHORDS_FOUR, pad: PAD };
const TUNE_LINE = A2_TUNE(".gain(.5)");
/** Eight bars: one const per section and track (STYLE §10), one `arrange()` per track, the tune throughout. */
const song = (v: Section, c: Section, bassSound = '.s("sawtooth").lpf(400)') =>
  at(
    A2_BPM,
    `const bassVerse = ${v.bass}`,
    `const chordsVerse = ${v.chords}`,
    `const padVerse = ${v.pad}`,
    `const bassChorus = ${c.bass}`,
    `const chordsChorus = ${c.chords}`,
    `const padChorus = ${c.pad}`,
    "",
    `bass: arrange([4, bassVerse], [4, bassChorus])${bassSound}`,
    'chords: arrange([4, chordsVerse], [4, chordsChorus]).scale("A3:minor").s("piano").gain(.6)',
    'pad: arrange([4, padVerse], [4, padChorus]).scale("A5:minor").s("strings").gain(.25)',
    TUNE_LINE,
  );
const MAKE_STARTER = song(SAME, SAME);
const MAKE_MINIMAL = song(THIN, SAME);
const DENSITY: RubricRule = {
  id: "thin-and-thick",
  label: "Verse and chorus at least a quarter apart in notes heard per bar",
  required: true,
  skills: ["D09"],
  rule: "contrast",
  a: { section: "verse" },
  b: { section: "chorus" },
  axes: ["density"],
  minAxes: 1,
};

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "A.CP",
  title: "Sound & arrangement checkpoint",
  covers: ["A1", "A2"],
  gated: ["D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D11"],
  levelSetting: [],
  version: 2,
  authored: [
    {
      kind: "all",
      id: "name-the-sound",
      version: 1,
      role: "checkpoint",
      prompt:
        "Answer three questions, one for each short sound from the A1 loop. Replay each sound as often as you like.",
      skills: [
        { skill: "D02", w: 0.34 },
        { skill: "D06", w: 0.33 },
        { skill: "D07", w: 0.33 },
      ],
      hints: null,
      tests: [],
      parts: [
        soundPart(
          "which-wave",
          "D02",
          "Listen to the riff, played on one plain wave with nothing shaped. Pick the wave.",
          WAVE,
          2,
          [
            { id: "sine", label: "Sine" },
            { id: "square", label: "Square" },
            { id: "sawtooth", label: "Sawtooth" },
          ],
          "square",
          "Not this one. Listen to the colour of each note: hollow and reedy, like a clarinet, with nothing bright riding on top.",
        ),
        soundPart(
          "which-grit",
          "D06",
          "Listen to the bass under the drums twice. The second time only the bass sounds different. Pick what was done to it.",
          GRIT,
          4,
          [
            { id: "saturated", label: "Saturated: warmer, thicker" },
            { id: "crushed", label: "Bit-crushed: grainy, lo-fi" },
            { id: "darker", label: "Darker: the filter closed" },
          ],
          "saturated",
          "Not this one. The second time the bass is rounder and fuller, its edges pushed; no fine grain rides on it, and nothing was taken off its top.",
        ),
        soundPart(
          "what-moves",
          "D07",
          "Listen to a held strings chord: something in it moves while the notes stay. Pick what moves.",
          MOVES,
          2,
          [
            { id: "pitch", label: "Its pitch wavers" },
            { id: "loudness", label: "Its loudness pulses" },
            { id: "brightness", label: "Its brightness sweeps" },
          ],
          "loudness",
          "Not this one. Listen to the chord's level: it swells and dips four times a bar, while its notes and its colour stay where they are.",
        ),
      ],
    },
    {
      kind: "code-modify",
      id: "chop-the-break",
      version: 1,
      role: "checkpoint",
      key: A_MINOR,
      prompt:
        "Oak's break under the A2 loop plays its four slices as recorded. Change the `.slice()` call so the slices play in an order of your own: repeat a beat, stutter one, or swap two. Done when the break no longer plays in the recorded order.",
      skills: [{ skill: "D11", w: 1 }],
      hints: null,
      code: { starter: CHOP_STARTER },
      reference: { solutions: [CHOPPED], bars: 2 },
      matcher: { m: "rubric", rules: [CHOP_RULE] },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: false },
      feedbackText: {
        "rubric.unmet":
          "Not met yet: {label}. Listen to the break: the same four beats come round in the order they were played. Move at least one of them somewhere else.",
      },
      tests: [
        { name: "reference: beat 4 stutters beat 2's snare", response: { code: CHOPPED }, expect: "pass" },
        {
          name: "the middle two swapped",
          response: { code: chopped('drums: s("brk").slice(4, "0 2 1 3")') },
          expect: "pass",
        },
        {
          name: "the kick beat again on 3",
          response: { code: chopped('drums: s("brk").slice(4, "0 1 0 3")') },
          expect: "pass",
        },
        {
          name: "eight slices, the snare doubled at the end",
          response: { code: chopped('drums: s("brk").slice(8, "0 1 2 3 0 1 [6 6] 7")') },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(CHOP_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right function, the recorded order: four slices played as they were",
          response: { code: chopped('drums: s("brk").splice(4, "0 1 2 3")') },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "two halves in their own order",
          response: { code: chopped('drums: s("brk").slice(2, "0 1")') },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "balance-the-loop",
      version: 1,
      role: "checkpoint",
      key: A_MINOR,
      prompt:
        "A strings pad plays in the tune's register, louder than the tune. Change the pad's `.gain()` so it sits 3 to 18 dB under the tune and can still be heard. Moving it to one side does not count. Done when the tune leads and the pad is a cushion under it.",
      skills: [{ skill: "D10", w: 1 }],
      hints: null,
      code: { starter: BALANCE_STARTER },
      reference: { solutions: [BALANCED], bars: 4 },
      matcher: { m: "rubric", rules: [BALANCE_RULE] },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "rubric.unmet":
          "Not met yet: {label}. In the target the tune is the first thing you hear, and the pad is a cushion under it: there if you listen for it, never in front.",
      },
      tests: [
        { name: "reference", response: { code: BALANCED }, expect: "pass" },
        { name: "a little more of the pad", response: { code: balanced(".gain(.2)") }, expect: "pass" },
        { name: "far back, still there", response: { code: balanced(".gain(.05)") }, expect: "pass" },
        {
          name: "turned down and placed to one side",
          response: { code: balanced(".gain(.12).pan(.3)") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(BALANCE_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right function, not far enough: level with the tune",
          response: { code: balanced(".gain(.3)") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the right function, too far: the pad gone",
          response: { code: balanced(".gain(.005)") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "moved to one side, not turned down",
          response: { code: balanced(".gain(.6).pan(0)") },
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
      D03: ["fam.snd.params"],
      D04: ["fam.snd.params"],
      D05: ["fam.snd.params"],
      D08: ["fam.snd.roles"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-arrange-the-loop",
    version: 1,
    role: "checkpoint",
    title: "Arrange the loop",
    prompt:
      "The A2 loop plays in a verse and a chorus, every part the same in both. Make one section thin and the other thick by changing its consts: fewer or more notes per bar, not less volume. Then keep the chords from C3 up, and give one part grit, movement or FM. Done when one section sounds clearly fuller.",
    skills: [{ skill: "D09", w: 1 }],
    hints: null,
    key: A_MINOR,
    bpm: A2_BPM,
    code: { starter: MAKE_STARTER },
    bars: [8, 16],
    saveAs: "sketch",
    rubric: [
      DENSITY,
      {
        id: "chords-in-their-register",
        label: "Every chord note from C3 up to C6",
        required: false,
        skills: ["D08"],
        rule: "range",
        track: "chords",
        within: ["c3", "c6"],
      },
      {
        id: "a-sound-of-your-own",
        label:
          "A part with `.distort()` above 0.5, `.crush()` under 7, `.vib()`, `.tremolosync()`, or `.fmi()` above 0.5",
        required: false,
        skills: ["D06", "D07"],
        rule: "custom",
        fn: "control-set",
        params: {
          anyOf: [
            { control: "distort", above: 0.5 },
            { control: "crush", below: 7 },
            { control: "vib", above: 0 },
            { control: "tremolosync", above: 0 },
            { control: "fmi", above: 0.5 },
          ],
        },
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: both sections the same",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      { name: "minimal: a thin verse", response: { code: MAKE_MINIMAL }, expect: "pass" },
      {
        name: "beyond the brief: thin, then thick, the bass saturated",
        response: { code: song(THIN, THICK, '.s("sawtooth").lpf(400).distort(1).gain(.7)') },
        expect: "pass",
      },
      { name: "the chorus filled instead", response: { code: song(SAME, THICK) }, expect: "pass" },
      { name: "the chorus thinned, the verse full", response: { code: song(SAME, THIN) }, expect: "pass" },
      {
        name: "the right function, quieter not thinner: the verse turned down",
        response: {
          code: song(
            { bass: `${BASS_FOUR}.gain(.4)`, chords: `${CHORDS_HELD}.gain(.4)`, pad: `${PAD}.gain(.4)` },
            SAME,
          ),
        },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "the chorus bass filled to eighths, every new note turned down to nothing",
        response: { code: song(SAME, { ...SAME, bass: `${BASS_EIGHT}.gain("[1 .003]*4")` }) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
