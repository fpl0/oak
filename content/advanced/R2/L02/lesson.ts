// R2.L02 Odd Grooves (spec: content/specs/R2.md). Seven eighths grouped 2+2+3 are short, short, long: two groups of
// two, then one of three. Nine eighths grouped 2+2+2+3 are the irregular 9/8 of Balkan dance music:
// short, short, short, long, not the three equal beats of a compound 9/8 (3+3+3). In both, the long group comes
// last and pulls the bar round to its downbeat.
//
// Written for the learner at the gate (AUTHORING §20.1): what U13.CP guarantees plus R2.L01 (odd meters, grouping,
// the odd-meter tempo lines `tb.meter.odd`). No new term: the lesson practises R16. Felt, then coded, then read:
// the learner taps the group starts (S2), runs and reads a bar of nine (S3) and names groupings by ear (S4)
// before writing one (S5).
//
// The lesson is in 7/8 at 240 eighths a minute; every step in nine declares `meter: "9/8i"` (contracts §6.9: one
// meter per piece, and `"9/8"` would be compound 3+3+3 counted in dotted quarters). No Band is written in 7/8 or
// 9/8i (`BAND_METERS`), so every step carries its own backing.
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: in S5 the kick sounds on all four group starts and on no other eighth,
//   in every bar (`onsets` `contains`, `excludes`, `perBar`), and the tempo is read in BPM through 9/8i (`tempo`);
//   the Make's accents (a kick, a snare, or a hit near the loudest of the drums) fall on the three group starts and
//   nowhere else, in every bar (custom `grouping-accents`), so silent drums or a snare inside a group fail;
// - each graded step pins a WRONG answer that uses the right function: 3+3+3 (nine eighths in the compound way);
//   the 7/8 tempo line put back; the 2+2+3 kick with a snare inside the long group; the 2+2+3 kick moved one eighth
//   late with `.late(1/7)`; in the ear step, a rotation and 3+3+3;
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type Rat, type RubricRule } from "@oak/content-kit";

const BPM = 240;
const TEMPO = `setcpm(${BPM}/7)\n\n`;
const TEMPO_9 = `setcpm(${BPM}/9)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const nine = (...lines: string[]) => `${TEMPO_9}${lines.join("\n")}`;
/** One eighth note at 240 a minute, in seconds. */
const EIGHTH_SEC = 60 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the groove in seven -------------------------------------------------------------------------------

/** A minor: i7 then VImaj7, one chord a bar; the bass on the root (degree 1, then degree 6: `n` 0 and 5). */
const bass7 = (rhythm: string) => `bass: n("<0 5>").struct("${rhythm}").scale("A1:minor").s("fingerbass")`;
const chords7 = (rhythm: string) =>
  `chords: chord("<Am7 F^7>").voicing().struct("${rhythm}").s("rhodes").gain(.5)`;
/** Hats on every eighth, the group starts louder (one velocity per step). */
const HATS_7 = 'hats: s("hh*7").velocity("1 .5 1 .5 1 .5 .5").gain(.5)';
const KICK_7 = 'kick: s("bd ~ ~ ~ bd ~ ~")';
const SNARE_7 = 'snare: s("~ ~ sd ~ ~ ~ ~")';
/** The hook: 2+2+3, kick on the first and the long group, snare on the second. */
const HOOK = code(KICK_7, SNARE_7, HATS_7, bass7("x ~ x ~ x ~ ~"), chords7("x ~ ~ ~ x ~ ~"));
/**
 * The hook again with a clav riff (unlocked at R1.L03) on the three group starts and the last eighth: A G E, then A
 * into the next bar over Am7; C A E, then F over Fmaj7. Every note is in its bar's chord.
 */
const HOOK_RIFF = code(
  KICK_7,
  SNARE_7,
  HATS_7,
  bass7("x ~ x ~ x ~ ~"),
  chords7("x ~ ~ ~ x ~ ~"),
  'keys: note("<[a4 ~ g4 ~ e4 ~ a4] [c5 ~ a4 ~ e4 ~ f4]>").s("clav").clip(.4).gain(.6)',
);

// --- the groove in nine --------------------------------------------------------------------------------

/**
 * A minor: i7 then iv7; 2+2+2+3, kick and snare taking turns on the group starts. S3 reads it, so the drums are one
 * string with one step per eighth. Only the S3 exercise declares `meter: "9/8i"`, so the groove lives in its code
 * (a step `example` is linted in the lesson's 7/8 and cannot carry a 9/8i tempo line).
 */
const NINE_GROOVE = nine(
  'drums: s("bd ~ sd ~ bd ~ sd ~ ~")',
  'hats: s("hh*9").velocity("1 .5 1 .5 1 .5 1 .5 .5").gain(.5)',
  'bass: n("<0 3>").struct("x ~ x ~ x ~ x ~ ~").scale("A1:minor").s("fingerbass")',
  'chords: chord("<Am7 Dm7>").voicing().struct("x ~ ~ ~ ~ ~ x ~ ~").s("rhodes").gain(.5)',
);

// --- S2: tap the group starts ---------------------------------------------------------------------------

const TAP_GROOVE = code(
  KICK_7,
  SNARE_7,
  HATS_7,
  'perc: s("rim ~ rim ~ rim ~ ~").gain(.7)',
  bass7("x ~ x ~ x ~ ~"),
  chords7("x ~ ~ ~ x ~ ~"),
);
/** Seconds from the start of a tap stimulus: the given eighths (0-based) of each of four bars of seven. */
const at = (eighths: number[]) =>
  [0, 7, 14, 21].flatMap((b) => eighths.map((e) => Math.round((b + e) * EIGHTH_SEC * 1000) / 1000));
/** Every other eighth straight through four bars, ignoring the bar line. */
const EVERY_OTHER = Array.from({ length: 14 }, (_, i) => Math.round(i * 2 * EIGHTH_SEC * 1000) / 1000);

// --- S3: seven and nine by ear --------------------------------------------------------------------------

const SEVEN_OPTIONS = [
  { id: "2+2+3", label: "2+2+3: 1-2 1-2 1-2-3" },
  { id: "2+3+2", label: "2+3+2: 1-2 1-2-3 1-2" },
  { id: "3+2+2", label: "3+2+2: 1-2-3 1-2 1-2" },
];
const NINE_OPTIONS = [
  { id: "2+2+2+3", label: "2+2+2+3: 1-2 1-2 1-2 1-2-3" },
  { id: "3+2+2+2", label: "3+2+2+2: 1-2-3 1-2 1-2 1-2" },
  { id: "3+3+3", label: "3+3+3: 1-2-3 1-2-3 1-2-3" },
];
const earHints = (): HintLadder =>
  ladder(
    "Count the hi-hat hits in one bar first: seven or nine.",
    "Count the hi-hat hits of a bar from 1. A drum marks the start of each group: a short group is two hits of the hi-hat, a long one three.",
    "Find the long groups first. How many are there, and do they come at the start of the bar or at its end?",
  );
const groupsCode = (meter: "7/8" | "9/8i", drums: string) =>
  meter === "7/8"
    ? code(`drums: s("${drums}")`, 'hats: s("hh*7").gain(.35)')
    : nine(`drums: s("${drums}")`, 'hats: s("hh*9").gain(.35)');
const earPart = (
  id: string,
  prompt: string,
  meter: "7/8" | "9/8i",
  drums: string,
  answer: string,
  wrong: string[],
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  meter,
  bpm: BPM,
  prompt,
  skills: [{ skill: "R16", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: groupsCode(meter, drums), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: meter === "7/8" ? SEVEN_OPTIONS : NINE_OPTIONS },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      meter === "7/8"
        ? "Not that one. Count the seven hi-hat hits of a bar and say where each drum hit falls: the long group is the one with three hits of the hi-hat."
        : "Not that one. Count the nine hi-hat hits of a bar and say where each drum hit falls. Three equal groups of three would be a compound nine, like 6/8 with one more beat; listen for groups of two among them.",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    ...wrong.map((w) => ({
      name: `heard as ${w}`,
      response: { answer: { choice: [w] } },
      expect: "fail" as const,
      feedback: ["id.wrong" as const],
    })),
  ],
});

// --- S5: from seven to nine -----------------------------------------------------------------------------

/**
 * S5: the tempo line already counts nine eighths at 240; the kick still has the seven steps of the 7/8 groove, so
 * its hits fall between the eighths. A 7/8 tempo line under `meter: "9/8i"` is a lint error in authored code (as in
 * U13.L04 S6), so the starter shows the 9/8i line and the whole code stays editable: a learner who puts the 7/8
 * line back meets the `tempo` constraint. Bass and chords are held, one a bar, so only the kick groups the bar.
 */
const sevenToNine = (tempo: string, kick: string) =>
  `setcpm(${tempo})\n\n${[
    `kick: s("${kick}")`,
    'hats: s("hh*9").gain(.4)',
    'bass: n("<0 3>").scale("A1:minor").s("fingerbass")',
    'chords: chord("<Am7 Dm7>").voicing().s("rhodes").gain(.5)',
  ].join("\n")}`;
const S5_STARTER = sevenToNine("240/9", "⟪bd ~ bd ~ bd ~ ~⟫");
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const KICK_2223 = "bd ~ bd ~ bd ~ bd ~ ~";
const S5_SOLUTION = sevenToNine("240/9", KICK_2223);
const STARTS_2223: Rat[] = [
  [0, 1],
  [2, 9],
  [4, 9],
  [2, 3],
];
const KICK_NINE: RubricRule = {
  id: "kick-two-two-two-three",
  label: "The kick plays only on eighths 1, 3, 5 and 7 of the nine, where each group of 2+2+2+3 starts",
  required: true,
  skills: ["R16"],
  rule: "onsets",
  track: "kick",
  contains: STARTS_2223,
  excludes: [
    [1, 9],
    [1, 3],
    [5, 9],
    [7, 9],
    [8, 9],
  ],
  perBar: true,
};

// --- S6: the Make ---------------------------------------------------------------------------------------

const MAKE_HATS = 'hats: s("hh*7").gain(.4)';
const MAKE_BASS = bass7("x ~ x ~ x ~ x");
const MAKE_CHORDS = 'chords: chord("<Am7 F^7>").voicing().s("rhodes").gain(.5)';
/** The starter: a kick on every other eighth, so the bar groups 2+2+2+1. */
const MAKE_STARTER = code('kick: s("bd ~ bd ~ bd ~ bd")', MAKE_HATS, MAKE_BASS, MAKE_CHORDS);
const make = (...drums: string[]) => code(...drums, MAKE_HATS, MAKE_BASS, MAKE_CHORDS);
const GROUPS_2_2_3: RubricRule = {
  id: "accents-two-two-three",
  label:
    "A kick or snare on eighths 1, 3 and 5 of every bar, where the groups of 2+2+3 start, and no kick or snare inside a group",
  required: true,
  skills: ["R16"],
  rule: "custom",
  fn: "grouping-accents",
  params: { track: "@drums", groups: ["2", "2", "3"], minRatio: 1 },
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R2.L02",
  version: 3,
  title: "Odd Grooves",
  objective:
    "I can hear how a groove in 7/8 or 9/8 is grouped, and write grooves in both with the long group last.",
  key: { tonic: "A", mode: "minor" },
  meter: "7/8",
  bpm: BPM,
  introduces: [],
  practises: ["R16"],
  terms: [],
  canDo: ["cd.hear.odd-grooves"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Short, short, long",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "seven", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "short-short-long",
        version: 1,
        role: "practice",
        prompt:
          "A groove in seven at 240 eighth notes a minute, then the same groove with a clav riff on top. Count along with the captions. Notice whether each bar marches, or whether its end tips you forward into the next.",
        skills: [{ skill: "R16", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Count 1-2 1-2 1-2-3. The louder hi-hat marks each group start.",
            bars: 4,
          },
          {
            code: HOOK_RIFF,
            caption: "The same groove with a clav riff on top. Count along: where does the riff land?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the starts",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-starts",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the rimshot, the dry click that marks each group start, and ignore the kick and the snare. It plays three times a bar: short, short, long. Four bars, twelve taps in all. Done when each tap lands with a rimshot.",
        skills: [{ skill: "R16", w: 1 }],
        hints: ladder(
          "Listen for the rimshot's dry click: its three hits are not evenly spaced, and the last gap is longer.",
          "Count the hi-hat 1 to 7. The rimshot plays on 1, on 3 and on 5, and then waits a little longer.",
          "Tap, wait one hi-hat, tap, wait one, tap, wait two.",
        ),
        mode: "along",
        stimulus: { src: "code", code: TAP_GROOVE, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "perc" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A rimshot went by without a tap. Three a bar: short, short, long.",
          "tap.extra":
            "A tap landed where the rimshot is quiet. The long group at the end of the bar waits a little longer.",
        },
        tests: [
          { name: "on each group start: 2+2+3", response: { taps: at([0, 2, 4]) }, expect: "pass" },
          {
            name: "every other eighth, through the bar line",
            response: { taps: EVERY_OTHER },
            expect: "fail",
          },
          { name: "3+2+2", response: { taps: at([0, 3, 5]) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "A bar of nine",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "run-investigate",
        id: "read-a-bar-of-nine",
        version: 1,
        role: "practice",
        meter: "9/8i",
        prompt:
          "Now nine, at the same 240 eighth notes a minute. Run it and read one bar on the roll and in the code: the drum string has one step per eighth note, and the tempo line divides 240 by the eighths in a bar. Then answer: how many eighths one bar holds, and how the drums group them.",
        skills: [{ skill: "R16", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the steps of the drum string, then count the steps from each drum hit to the next.",
        },
        hints: ladder(
          "Count the steps of the drum string: one step is one eighth.",
          "One step is one eighth note. A group runs from one drum hit to the step before the next.",
          "Write the gaps between the hits as numbers, the last one up to the bar line, and read them in order.",
        ),
        code: { starter: NINE_GROOVE },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many eighth notes are in one bar?", correct: 9 },
          {
            q: "choice",
            prompt: "How do the drums group them?",
            options: [
              { id: "2+2+2+3", label: "2+2+2+3" },
              { id: "3+3+3", label: "3+3+3" },
              { id: "3+2+2+2", label: "3+2+2+2" },
            ],
            correct: ["2+2+2+3"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 9, choice: ["2+2+2+3"] } }, expect: "pass" },
          {
            name: "read as three equal beats",
            response: { answer: { number: 9, choice: ["3+3+3"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "eight: the hits counted, not the steps",
            response: { answer: { number: 8, choice: ["2+2+2+3"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Seven or nine",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "seven-or-nine",
        version: 1,
        role: "check",
        prompt:
          "Four grooves at 240 eighth notes a minute: two in seven, two in nine. The hi-hat plays every eighth; the drums mark where each group starts. For each, pick how the bar is grouped.",
        skills: [{ skill: "R16", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.odd-grouping", mode: "review-if-due" }],
        tests: [],
        parts: [
          earPart("groove-one", "Groove 1, in seven.", "7/8", "bd ~ sd ~ bd ~ ~", "2+2+3", [
            "2+3+2",
            "3+2+2",
          ]),
          earPart("groove-two", "Groove 2, in seven.", "7/8", "bd ~ ~ sd ~ bd ~", "3+2+2", ["2+2+3"]),
          earPart("groove-three", "Groove 3, in nine.", "9/8i", "bd ~ sd ~ bd ~ sd ~ ~", "2+2+2+3", [
            "3+3+3",
            "3+2+2+2",
          ]),
          earPart("groove-four", "Groove 4, in nine.", "9/8i", "bd ~ ~ sd ~ bd ~ sd ~", "3+2+2+2", [
            "2+2+2+3",
            "3+3+3",
          ]),
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Seven steps into nine",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "seven-into-nine",
        version: 1,
        role: "check",
        meter: "9/8i",
        prompt:
          "Rewrite the kick's string with nine steps, one per eighth, grouped 2+2+2+3: a hit on the first eighth of each group and rests everywhere else. The tempo line already counts nine eighths at 240; the kick still has seven steps. Done when the kick plays only where each group starts.",
        skills: [{ skill: "R16", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 4 },
        // Heard: the kick on the four group starts and on no other eighth, in every bar; and the tempo read in BPM
        // through 9/8i, so the 7/8 tempo line put back (or a bar of eight) fails.
        matcher: { m: "rubric", rules: [KICK_NINE] },
        constraints: [{ c: "tempo", bpm: BPM }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Count the nine hi-hat hits with the target and listen for which of them the kick takes.",
        },
        hints: ladder(
          "The tempo line divides 240 by nine, so the bar has nine eighths: the kick's string needs one step for each.",
          "One step per eighth: nine. Then a hit only where a group begins: three short groups of two, then one of three.",
          "Nine steps; the first is a hit. Count two steps on for each of the next hits, and leave the long group's last steps as rests.",
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          {
            name: "written with weights: bd@2 bd@2 bd@2 bd@3",
            response: { code: sevenToNine("240/9", "bd@2 bd@2 bd@2 bd@3") },
            expect: "pass",
          },
          {
            name: "the long group held: bd ~ bd ~ bd ~ bd@3",
            response: { code: sevenToNine("240/9", "bd ~ bd ~ bd ~ bd@3") },
            expect: "pass",
          },
          {
            name: "the kick softer",
            response: { code: S5_SOLUTION.replace(`s("${KICK_2223}")`, `s("${KICK_2223}").gain(.7)`) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S5_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "nine the compound way: 3+3+3",
            response: { code: sevenToNine("240/9", "bd ~ ~ bd ~ ~ bd ~ ~") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the tempo line of seven put back: setcpm(240/7)",
            response: { code: sevenToNine("240/7", KICK_2223) },
            expect: "fail",
            feedback: ["code.tempo"],
          },
          {
            name: "a bar of eight: setcpm(240/8)",
            response: { code: sevenToNine("240/8", KICK_2223) },
            expect: "fail",
            feedback: ["code.tempo"],
          },
          {
            name: "a kick on every eighth",
            response: { code: sevenToNine("240/9", "bd*9") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: S5_SOLUTION.replace(`s("${KICK_2223}")`, `s("${KICK_2223}").gain(0)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your groove in seven",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-make",
        id: "your-groove-in-seven",
        version: 1,
        role: "practice",
        title: "Groove in seven",
        prompt:
          "Group your bar of seven 2+2+3: short, short, long. The starter's kick hits every other eighth, so the bar ends on a group of one. Required: a kick or snare on each group start, and none inside a group; quiet hi-hats are free. Also on the checklist: the bass on the group starts, and a clav riff on top.",
        skills: [{ skill: "R16", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          GROUPS_2_2_3,
          {
            id: "bass-on-the-groups",
            label: "The bass plays on eighths 1, 3 and 5 of every bar",
            required: false,
            skills: ["R16"],
            rule: "onsets",
            track: "bass",
            contains: [
              [0, 1],
              [2, 7],
              [4, 7],
            ],
            perBar: true,
          },
          {
            id: "a-riff-on-top",
            label: "A clav plays",
            required: false,
            skills: ["R16"],
            rule: "sounds",
            contains: ["snd.clav"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Count the hi-hat from 1 and mark where each group of 2+2+3 begins.",
          "The drum strings have seven steps, one per eighth. A kick or a snare goes on the first step of each group; every other loud hit has to go.",
          "Of the starter's four kicks, three already sit where a group starts. One of them is inside the long group.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the kick on 2+2+3",
            response: { code: make('kick: s("bd ~ bd ~ bd ~ ~")') },
            expect: "pass",
          },
          {
            name: "kick and snare taking turns, as in the opening groove",
            response: { code: make(KICK_7, SNARE_7) },
            expect: "pass",
          },
          {
            name: "written with weights: bd@2 sd@2 bd@3",
            response: { code: make('drums: s("bd@2 sd@2 bd@3")') },
            expect: "pass",
          },
          {
            name: "made its own: kick and snare on the groups, a clav riff of its own on top",
            response: {
              code: make(
                KICK_7,
                SNARE_7,
                'keys: note("<[e5 ~ c5 ~ a4 ~ e5] [e5 ~ c5 ~ a4 ~ c5]>").s("clav").clip(.4).gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "a clav riff on top, the kick still on every other eighth",
            response: {
              code: make(
                'kick: s("bd ~ bd ~ bd ~ bd")',
                'keys: note("<[a4 ~ g4 ~ e4 ~ a4] [c5 ~ a4 ~ e4 ~ f4]>").s("clav").clip(.4).gain(.6)',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "beyond the brief: accented hats, bass and chords on the groups, a tune",
            response: {
              code: code(
                KICK_7,
                SNARE_7,
                HATS_7,
                bass7("x ~ x ~ x ~ x"),
                chords7("x ~ ~ ~ x ~ ~"),
                'mel: n("<[4 ~ 2 ~ 4 3 2] [0 ~ 2 ~ 4@3]>").scale("A4:minor").s("piano")',
              ),
            },
            expect: "pass",
          },
          {
            name: "grouped the other way: 3+2+2",
            response: { code: make('kick: s("bd ~ ~ sd ~ sd ~")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right kick, with a snare inside the long group",
            response: { code: make('kick: s("bd ~ bd ~ bd ~ ~")', 'snare: s("~ ~ ~ ~ ~ sd ~")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right kick, one eighth late: .late(1/7)",
            response: { code: make('kick: s("bd ~ bd ~ bd ~ ~").late(1/7)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: make('kick: s("bd ~ bd ~ bd ~ ~").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
