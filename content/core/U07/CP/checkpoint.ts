// U07.CP Melody checkpoint (contracts §7.6; AUTHORING §10). The generated items come from the non-chord-tone
// family (M04 at level 1, M05 at level 2: appoggiatura and suspension), the reading family at its lead-sheet
// level (N07) and sight-singing (V04: a re-test that sets the level and never blocks; skipped in Quiet mode).
// The creative skills have no family, so the authored items and the Make measure them, each in code:
// - land-and-pass: a tune over I V vi IV whose strong beats are put on chord tones, the notes between
//   moving by step (M03, M04);
// - answer-the-question: a four-bar answer to a four-bar question, starting like it and closing on 1 (M06,
//   F01; M02, because the answer reuses the question's two-bar idea);
// - from-the-page: a 3/4 tune with a one-beat pickup read from the page, with the chords named above it,
//   written as code (N07, M10).
// The Make is a hook over the four-chord Band: a motif that comes back (M09, required), with suggestions for
// a call and response on two tracks (M07) and a moved motif (M02).
// Spec: content/specs/U07.md, "U07.CP Melody checkpoint".
//
// Departures from the spec, each forced by contracts §7.6 or by what is implemented:
// - The spec lists five authored items; a checkpoint has two or three (CHECKPOINT_RULES.authoredItems). The
//   spec's "vary-the-motif" (M02) lives on in answer-the-question's motif rule and the Make's `.scaleTranspose()`
//   suggestion; its "respond" (M07) is the Make's two-track suggestion.
// - The page is a lead sheet (`showLeadSheet`): the tune on the staff with its chord symbols above it, read by
//   the harmony view from the page's own chord track (never shown as code). The prompt names the chords too.
//   The item is a `dictation` because only a stimulus can be shown as a page; it can also be played, as in
//   U07.L09.
//
// Checked after U08.L01 (its place in the default order): every U07 tool and word is the learner's.
import { type CheckpointDef, defineCheckpoint, type Matcher } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A tune in degrees of C, home on C4. */
const mel = (pattern: string, label = "mel", sound = "piano") =>
  `${label}: n("${pattern}").scale("C4:major").s("${sound}")`;
/** Triads stacked in degrees, an octave under the tune. */
const chords = (pattern: string) => `chords: n("${pattern}").scale("C3:major").s("piano").gain(.6)`;

// --- land-and-pass ------------------------------------------------------------------------------------

/** I V vi IV: C E G | G B D | A C E | F A C. */
const AXIS = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
/**
 * Beats 1 and 3 on chord tones, the notes between them steps: E D C D | B C D E | C D E D | C B A. Two of
 * fourteen moves are 3rds (D to B into bar 2, E to C into bar 3).
 */
const LANDED = "<[2 1 0 1] [-1 0 1 2] [0 1 2 1] [0 -1 -2 ~]>";
/**
 * The starter: the same line with two strong beats off the chord: C on beat 1 of bar 2 (over G B D) and D on
 * beat 1 of bar 4 (over F A C). Each leans on a note a step from a chord tone.
 */
const LEANING = "<[2 1 0 1] [0 0 1 2] [0 1 2 1] [1 -1 -2 ~]>";
const PASS_STARTER = `${TEMPO}${chords(AXIS)}\n${mel(`⟪${LEANING}⟫`)}`;
const PASS_MATCHER: Matcher = {
  m: "rubric",
  rules: [
    {
      id: "land",
      label: "Every note on beats 1 and 3 is a chord tone of the `chords:` line",
      required: true,
      skills: ["M03"],
      rule: "chord-tones-strong",
      minRatio: 1,
      melody: "mel",
      harmony: "chords",
      strength: "strong",
    },
    {
      id: "pass",
      label: "Mostly steps: at least three in four moves go to the next scale note up or down",
      required: true,
      skills: ["M04"],
      rule: "step-ratio",
      track: "mel",
      min: 0.75,
    },
  ],
};

// --- answer-the-question ------------------------------------------------------------------------------

/** I IV I V, then I IV V I: the question pauses on V, the answer comes home. */
const PHRASE_CHORDS = "<[0,2,4] [3,5,7] [0,2,4] [4,6,8] [0,2,4] [3,5,7] [4,6,8] [0,2,4]>";
/** The question: C E G E | F A F | E D C | D, held over G. */
const QUESTION = "[0 2 4 2] [3 5 3 ~] [2 1 0 ~] [1 ~ ~ ~]";
/** The answer: bars 1–2 again, then G F D over G and home to C: the question's start, a closed end. */
const ANSWER = "[0 2 4 2] [3 5 3 ~] [4 3 1 ~] [0 ~ ~ ~]";
const phrase = (answer: string, sound = "piano") =>
  code(chords(PHRASE_CHORDS), mel(`<${QUESTION} ${answer}>`, "mel", sound));
const ANSWER_STARTER = `${TEMPO}${chords(PHRASE_CHORDS)}\n${mel(`<${QUESTION} ⟪~ ~ ~ ~⟫>`)}`;
const ANSWER_MATCHER: Matcher = {
  m: "rubric",
  rules: [
    {
      id: "home",
      label: "The last note of the tune is degree 1 (C)",
      required: true,
      skills: ["M06"],
      rule: "ends-on-degree",
      track: "mel",
      degrees: ["1"],
    },
    {
      id: "like-it",
      label: "A two-bar group repeats the shape of an earlier one, as the answer's start can repeat bars 1–2",
      required: true,
      skills: ["M02", "F01"],
      rule: "motif-reuse",
      track: "mel",
      minRatio: 0.25,
      unitBars: 2,
      shape: "either",
    },
  ],
};

// --- from-the-page ------------------------------------------------------------------------------------

/** 3/4: three beats a bar. */
const TEMPO_3 = `setcpm(${BPM}/3)\n\n`;
/**
 * The page: a one-beat pickup on 5 (G4) into C | F | G | C: E . G | A . F | G . D | C (each first note a
 * half note, the last bar a dotted half). Cycle 0 is the pickup bar; the chords rest there.
 */
const WALTZ = "<[~ ~ 4] [2@2 4] [5@2 3] [4@2 1] [0@3]>";
const WALTZ_CHORDS = "<~ [0,2,4] [3,5,7] [4,6,8] [0,2,4]>";
const fromPage = (tune: string, chordLine = chords(WALTZ_CHORDS)) => `${TEMPO_3}${mel(tune)}\n${chordLine}`;
/** The lead sheet's source: the tune and its chords (the chords are read as symbols above the staff). */
const PAGE = fromPage(WALTZ);
const PAGE_STARTER = `${TEMPO_3}${mel("⟪<[~ ~ ~] [0@3] [0@3] [0@3] [0@3]>⟫")}\n${chords("⟪<~ [0,2,4] [0,2,4] [0,2,4] [0,2,4]>⟫")}`;
const PAGE_MATCHER: Matcher = {
  m: "all",
  of: [
    { m: "melody", pitch: "absolute", wPitch: 0.8, wRhythm: 0.2, rhythmTol: [1, 16], track: "mel" },
    { m: "rhythm", tol: [1, 16], durations: false, perRole: false, displacementCredit: 0.5, tracks: ["mel"] },
    { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
  ],
};

// --- the Make -----------------------------------------------------------------------------------------

/**
 * The starter: four bars over the Band's I V vi IV, no bar like another: C D E G | B A G ~ | A C E ~ | F E D C.
 * Every note sits easily over its chord; nothing comes back.
 */
const MAKE_STARTER = "<[0 1 2 4] [6 5 4 ~] [5 7 9 ~] [3 2 1 0]>";
/**
 * Minimal: a one-bar motif on chord tones (E G E C over C), a step lower over G (D F D B), again over Am, and
 * an answer over F (F E C): E G E C | D F D B | E G E C | F E C. Bars 2 and 3 repeat the motif's shape.
 */
const MAKE_MOTIF = "<[2 4 2 0] [1 3 1 -1] [2 4 2 0] [3 2 0 ~]>";

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U07.CP",
  title: "Melody checkpoint",
  covers: ["U07"],
  gated: ["M02", "M03", "M04", "M05", "M06", "M07", "M09", "M10", "N07", "F01"],
  levelSetting: ["V04"],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "land-and-pass",
      version: 1,
      role: "checkpoint",
      prompt:
        "Two notes on beats 1 and 3 of this tune sit outside the chord of the `chords:` line, I V vi IV. Change the tune so every note on beats 1 and 3 is a chord tone. Done when that holds and at least three in four moves are steps to the next scale note.",
      skills: [
        { skill: "M03", w: 0.6 },
        { skill: "M04", w: 0.4 },
      ],
      hints: null,
      code: { starter: PASS_STARTER },
      reference: { solutions: [code(chords(AXIS), mel(LANDED))], bars: 4 },
      matcher: PASS_MATCHER,
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: code(chords(AXIS), mel(LANDED)) }, expect: "pass" },
        {
          name: "D over G and A over F: other chord tones, still by step",
          response: { code: code(chords(AXIS), mel("<[2 1 0 1] [1 0 1 2] [0 1 2 1] [-2 -1 0 ~]>")) },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: code(chords(AXIS), mel(LEANING)) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "only bar 2 fixed",
          response: { code: code(chords(AXIS), mel("<[2 1 0 1] [-1 0 1 2] [0 1 2 1] [1 -1 -2 ~]>")) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the chords changed to fit the tune",
          response: { code: code(chords("<[0,2,4] [0,2,4] [5,7,9] [1,3,5]>"), mel(LEANING)) },
          expect: "fail",
          feedback: ["code.edit-outside"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "answer-the-question",
      version: 1,
      role: "checkpoint",
      prompt:
        "Bars 1–4 are a question over I IV I V that pauses on degree 2. Write bars 5–8, the highlighted part, as its answer over I IV V I. Start it with the question's first two bars, the same or moved, and end it on degree 1.",
      skills: [
        { skill: "M06", w: 0.5 },
        { skill: "F01", w: 0.3 },
        { skill: "M02", w: 0.2 },
      ],
      hints: null,
      code: { starter: ANSWER_STARTER },
      reference: { solutions: [phrase(ANSWER)], bars: 8 },
      matcher: ANSWER_MATCHER,
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: phrase(ANSWER) }, expect: "pass" },
        {
          name: "the start kept, a new way home: E D C over G, then C",
          response: { code: phrase("[0 2 4 2] [3 5 3 ~] [4 2 1 ~] [0 ~ ~ ~]") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: phrase("~ ~ ~ ~") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "an answer that ends on 1 but shares nothing with the question",
          response: { code: phrase("[4 5 4 2] [5 6 5 ~] [4 3 1 ~] [0 ~ ~ ~]") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the question copied: it pauses again",
          response: { code: phrase(QUESTION) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the question changed too",
          response: {
            code: code(chords(PHRASE_CHORDS), mel(`<[0 2 4 2] [3 5 3 ~] [2 1 0 ~] [0 ~ ~ ~] ${ANSWER}>`)),
          },
          expect: "fail",
          feedback: ["code.edit-outside"],
        },
      ],
    },
    {
      kind: "dictation",
      id: "from-the-page",
      version: 1,
      role: "checkpoint",
      prompt:
        "Read the page: a tune in 3/4 with a one-beat pickup, chords C | F | G | C. Write the tune on the `mel` line in `n`, in C major, with the pickup at the end of bar 0. Write the chords on the `chords` line as stacks, one a bar, with a rest in bar 0.",
      skills: [
        { skill: "N07", w: 0.5 },
        { skill: "M10", w: 0.5 },
      ],
      hints: null,
      meter: "3/4",
      pickup: { units: [1, 1] },
      domain: "melody",
      stimulus: { src: "code", code: PAGE, bars: 5, showCode: false, showLeadSheet: true },
      cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
      answer: { ui: "code", starter: PAGE_STARTER },
      reference: { solutions: [fromPage(WALTZ)], bars: 5 },
      matcher: PAGE_MATCHER,
      feedbackText: {
        "rhythm.pickup-missing":
          "Every note is there, but the tune starts on the bar line. Its first note comes before beat 1: put it at the end of bar 0.",
      },
      tests: [
        { name: "reference", response: { code: fromPage(WALTZ) }, expect: "pass" },
        {
          name: "held notes written with rests, the chords an octave up",
          response: {
            code: fromPage(
              "<[~ ~ 4] [2 ~ 4] [5 ~ 3] [4 ~ 1] [0 ~ ~]>",
              'chords: n("<~ [7,9,11] [10,12,14] [11,13,15] [7,9,11]>").scale("C3:major").s("piano").gain(.6)',
            ),
          },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: {
            code: `${TEMPO_3}${mel("<[~ ~ ~] [0@3] [0@3] [0@3] [0@3]>")}\n${chords("<~ [0,2,4] [0,2,4] [0,2,4] [0,2,4]>")}`,
          },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the pickup left out: the tune starts on the bar line",
          response: { code: fromPage("<[4 2@2] [4 5@2] [3 4@2] [1 0@2] ~>") },
          expect: "fail",
          feedback: ["rhythm.pickup-missing"],
        },
        {
          name: "the chords typed from the degrees as they are, one too high",
          response: { code: fromPage(WALTZ, chords("<~ [1,3,5] [4,6,8] [5,7,9] [1,3,5]>")) },
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
      M04: ["fam.mel.nct"],
      M05: ["fam.mel.nct"],
      N07: ["fam.not.read"],
      V04: ["fam.mel.sight"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-hook",
    version: 1,
    role: "checkpoint",
    title: "A hook",
    prompt:
      "Turn the starter into a hook over the band's I V vi IV: write a short motif and bring it back in another bar, the same or moved to fit the chord. Done when at least one bar comes back. If you like, land it on chord tones, add a pickup, or answer it on a second track.",
    skills: [{ skill: "M09", w: 1 }],
    hints: null,
    key: { tonic: "C", mode: "major" },
    bpm: BPM,
    code: { starter: code(mel(MAKE_STARTER)) },
    bars: [4, 8],
    saveAs: "sketch",
    rubric: [
      {
        id: "hook",
        label:
          "At least one bar repeats the shape of an earlier bar, the same or moved, and not every bar is the same",
        required: true,
        skills: ["M09"],
        rule: "motif-reuse",
        track: "@melody",
        // Corrections gate (now-fails B): a motif in bars 1 and 3, the textbook hook, is one return in four bars.
        minRatio: 0.25,
        shape: "either",
        // Corrections pass: one pass is read as four bars at least, so a two-bar hook played twice (`<A B A B>`)
        // comes back; a one-bar loop, every bar the same, still fails.
        loopRepeats: 4,
      },
      // No chord-tone line here: the Band plays the chords, and the grader is not given the Band's code
      // (neither content:check nor the app passes ctx.band), so a rule against `band.chords` could only ever
      // say "not yet". M03 is measured by `land-and-pass`.
      {
        id: "call-and-response",
        label: "A second melody line, such as `vox:`, plays too",
        required: false,
        skills: ["M07"],
        rule: "tracks",
        min: 2,
        roles: ["melody"],
      },
      {
        id: "moved",
        label: "Uses `.scaleTranspose()`",
        required: false,
        skills: ["M02"],
        rule: "uses",
        tool: "tb.scaleTranspose",
      },
    ],
    tests: [
      {
        name: "the starter: four bars, none like another",
        response: { code: code(mel(MAKE_STARTER)) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      { name: "minimal: a motif in bars 1 and 3", response: { code: code(mel(MAKE_MOTIF)) }, expect: "pass" },
      {
        name: "beyond the brief: the motif moved with .scaleTranspose(), a response on a second track",
        response: {
          code: code(
            'mel: n("[2 4 2 ~]").scale("C4:major").scaleTranspose("<0 -1 0 1>").s("piano")',
            'vox: n("<[~ ~ ~ 4] [~ ~ ~ 3] [~ ~ ~ 4] [~ ~ ~ 5]>").scale("C4:major").s("piano").gain(.6)',
          ),
        },
        expect: "pass",
      },
      {
        name: "a two-bar hook played twice",
        response: { code: code(mel("<[2 4 2 0] [3 ~ 1 ~] [2 4 2 0] [3 ~ 1 ~]>")) },
        expect: "pass",
      },
      {
        name: "a two-bar hook, then moved to fit the next two chords",
        response: { code: code(mel("<[2 4 2 0] [3 ~ 1 ~] [0 2 0 -2] [5 ~ 3 ~]>")) },
        expect: "pass",
      },
      {
        name: "one bar four times: a one-bar loop",
        response: { code: code(mel("<[2 4 2 0] [2 4 2 0] [2 4 2 0] [2 4 2 0]>")) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "eight bars, every bar new",
        response: {
          code: code(
            mel("<[0 1 2 4] [6 5 4 ~] [5 7 9 ~] [3 2 1 0] [4 2 0 2] [1 3 6 ~] [2 0 5 ~] [3 ~ 2 ~]>"),
          ),
        },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
