// R2.L01 Five & Seven (spec: content/specs/R2.md). A bar of five does not split into equal beats of two or three:
// it is a group of three and a group of two (3+2, or 2+3), and seven eighths are 2+2+3 or one of its rotations.
// The groups decide where the bar feels heavy. In code a bar is still one cycle; the tempo line divides by the
// units in the bar: `setcpm(150/5)` is five quarter notes at 150, `setcpm(240/7)` seven eighths at 240.
//
// Written for the learner at the gate (AUTHORING §20.1): R2 opens after U13.CP and may be taken before R1 and with
// U14–U17 unfinished, so the lesson uses what U13.CP guarantees (compound meter and its tempo line from U13.L04,
// `.velocity()` from U13.L02) plus its own unlock, the odd-meter tempo lines (`tb.meter.odd`). R1's words (metric
// weight, displacement) and R3's (clave, tresillo, Euclid) are not used. Felt, then coded, then read: the learner
// taps the group starts (S2) before reading the tempo line and the groups (S3).
//
// The lesson is in 5/4; the ear step's grooves are in 7/8 and each declares its own meter (contracts §6.9: one
// meter per piece). No Band is written in an odd meter (`BAND_METERS`), so every step carries its own backing.
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: the kick sounds on both group starts and on no other eighth of the
//   bar, in every bar (`onsets` with `contains`, `excludes` and `perBar`; a kick at `.gain(0)` is dropped), and
//   the tempo is read in BPM through the meter (`tempo`), so `setcpm(150/4)` put back fails (187.5 BPM);
// - each graded step pins a WRONG answer that uses the right function: the tempo line divided by four again
//   (187.5 BPM); 2+3 for 3+2; 3+3 written in six steps; the right kick at `.gain(0)`; in the ear step, a
//   neighbouring rotation of the right grouping;
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type Rat, type RubricRule } from "@oak/content-kit";

const BPM = 150;
const TEMPO = `setcpm(${BPM}/5)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One bar of 5/4 at 150: five quarter notes of 0.4 s. */
const BAR_SEC = (5 * 60) / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the groove in five ------------------------------------------------------------------------------

const HATS = 'hats: s("hh*10").gain(.4)';
/** E minor: i7 then iv7, one chord every bar, the bass on its root (degree 1, then degree 4: `n` 0 and 3). */
const bass = (rhythm: string) => `bass: n("<0 3>").struct("${rhythm}").scale("E2:minor").s("fingerbass")`;
const chords = (rhythm: string) =>
  `chords: chord("<Em7 Am7>").voicing().struct("${rhythm}").s("rhodes").gain(.5)`;
const THREE_TWO = "x ~ ~ x ~";
const TWO_THREE = "x ~ x ~ ~";

/** The hook: 3+2, kick and bass on each group start, the snare closing each group. */
const HOOK = code(
  'kick: s("bd ~ ~ bd ~")',
  'snare: s("~ ~ sd ~ sd")',
  HATS,
  bass(THREE_TWO),
  chords(THREE_TWO),
);
/** The same notes grouped 2+3: kick and bass on beats 1 and 3. */
const HOOK_23 = code(
  'kick: s("bd ~ bd ~ ~")',
  'snare: s("~ sd ~ ~ sd")',
  HATS,
  bass(TWO_THREE),
  chords(TWO_THREE),
);

// --- S4: grooves in seven -----------------------------------------------------------------------------

const TEMPO_7 = "setcpm(240/7)\n\n";
const GROUPINGS_7 = [
  { id: "2+2+3", label: "2+2+3: 1-2 1-2 1-2-3" },
  { id: "2+3+2", label: "2+3+2: 1-2 1-2-3 1-2" },
  { id: "3+2+2", label: "3+2+2: 1-2-3 1-2 1-2" },
] as const;
type Grouping7 = (typeof GROUPINGS_7)[number]["id"];
/** A neighbouring rotation of each grouping: the wrong answer a learner who loses one group gives. */
const NEIGHBOUR: Record<Grouping7, Grouping7> = { "2+2+3": "2+3+2", "2+3+2": "2+2+3", "3+2+2": "2+2+3" };
const sevenCode = (drums: string, extra: string[] = []) =>
  `${TEMPO_7}${[`drums: s("${drums}")`, 'hats: s("hh*7").gain(.35)', ...extra].join("\n")}`;
const earHints = (): HintLadder =>
  ladder(
    "Count the hi-hat hits between one drum hit and the next: two or three.",
    "Count the seven hi-hat hits of a bar, 1 to 7. A drum marks the start of each group: two groups are two hits long, one is three.",
    "Find the long group first. Is it at the start of the bar, in the middle, or at the end?",
  );
const sevenPart = (id: string, prompt: string, stimulus: string, answer: Grouping7): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  meter: "7/8",
  bpm: 240,
  prompt,
  skills: [{ skill: "R16", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: stimulus, bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...GROUPINGS_7] },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      "Not that one. Count the hi-hat hits of one bar, 1 to 7, and say where each drum hit falls: the long group is the one with three hits of the hi-hat.",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: `a neighbouring rotation: ${NEIGHBOUR[answer]}`,
      response: { answer: { choice: [NEIGHBOUR[answer]] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

// --- S5: from four to five ----------------------------------------------------------------------------

/**
 * S5: the tempo line already counts five quarter notes at 150; the kick still has the four steps of a 4/4 bar, so
 * its second hit falls halfway through beat 3. A 4/4 tempo line under `meter: "5/4"` is a lint error in authored
 * code (as in U13.L04 S6), so the starter shows the 5/4 line and the whole code stays editable: a learner who
 * "fixes" it back to `setcpm(150/4)` meets the `tempo` constraint (187.5 beats a minute). Chords and bass are held,
 * one a bar, and the hats tick the ten eighths, so only the kick decides the grouping.
 */
const HELD_BASS = 'bass: n("<0 3>").scale("E2:minor").s("fingerbass")';
const HELD_CHORDS = 'chords: chord("<Em7 Am7>").voicing().s("rhodes").gain(.5)';
const fourToFive = (tempo: string, kick: string) =>
  `setcpm(${tempo})\n\n${[`kick: s("${kick}")`, HATS, HELD_BASS, HELD_CHORDS].join("\n")}`;
const S5_STARTER = fourToFive("150/5", "⟪bd ~ bd ~⟫");
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const S5_SOLUTION = fourToFive("150/5", "bd ~ ~ bd ~");

/** The kick's two group starts in a bar of 3+2, and every other eighth of the bar. */
const STARTS_32: Rat[] = [
  [0, 1],
  [3, 5],
];
const OTHER_EIGHTHS_32: Rat[] = [
  [1, 10],
  [1, 5],
  [3, 10],
  [2, 5],
  [1, 2],
  [7, 10],
  [4, 5],
  [9, 10],
];
const KICK_32: RubricRule = {
  id: "kick-three-two",
  label: "The kick plays only on beats 1 and 4 of the five, where the groups of three and two start",
  required: true,
  skills: ["R16"],
  rule: "onsets",
  track: "kick",
  contains: STARTS_32,
  excludes: OTHER_EIGHTHS_32,
  perBar: true,
};

// --- S6: the Make -------------------------------------------------------------------------------------

const MAKE_STARTER = code(
  'kick: s("bd*5")',
  HATS,
  'bass: n("<0 3>").struct("x*5").scale("E2:minor").s("fingerbass")',
  HELD_CHORDS,
);
const make = (kick: string, ...rest: string[]) =>
  code(
    kick,
    ...(rest.length
      ? rest
      : [HATS, 'bass: n("<0 3>").struct("x*5").scale("E2:minor").s("fingerbass")', HELD_CHORDS]),
  );

/** Seconds from the start of a tap stimulus: the given quarter-note beats (0-based) of bars 1–4. */
const at = (beats: number[]) =>
  [0, 1, 2, 3].flatMap((bar) =>
    beats.map((b) => Math.round((bar * BAR_SEC + (b * BAR_SEC) / 5) * 1000) / 1000),
  );

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R2.L01",
  version: 3,
  title: "Five & Seven",
  objective:
    "I can write a groove in 5/4 grouped 3+2, set its tempo line, and hear how a bar of 7/8 is grouped.",
  key: { tonic: "E", mode: "minor" },
  meter: "5/4",
  bpm: BPM,
  introduces: ["R16"],
  practises: [],
  terms: [
    { id: "term.odd-meter", step: "S3" },
    { id: "term.grouping", step: "S3" },
  ],
  canDo: ["cd.code.odd-meters"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A bar of five",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "five", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-bar-of-five",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops and count along with the captions; the notes and sounds are the same, placed differently. Notice whether the bar feels even or leans, and where the kick starts each group.",
        skills: [{ skill: "R16", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Count 1-2-3 1-2. The kick starts each group, the snare closes it.",
            bars: 4,
          },
          {
            code: HOOK_23,
            caption: "Count 1-2 1-2-3: the same five beats, the short group first.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap where each group starts",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-group-starts",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the kick, the low thud, and nothing else. Count 1-2-3 1-2 with the snare: the kick lands on each count of 1, twice a bar. Four bars, eight taps in all. Done when each tap lands with a kick.",
        skills: [{ skill: "R16", w: 1 }],
        hints: ladder(
          "Listen for the kick alone: it does not play on every beat, only twice a bar.",
          "Count 1-2-3 1-2 with the snare. The kick lands on each word one.",
          "Tap on the first count of the bar, then again three beats later.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "kick" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A kick went by without a tap. Count 1-2-3 1-2 and tap on each one.",
          "tap.extra": "A tap landed where the kick is quiet: it plays twice a bar, not on every beat.",
        },
        tests: [
          { name: "on each group start: 3+2", response: { taps: at([0, 3]) }, expect: "pass" },
          { name: "on every beat", response: { taps: at([0, 1, 2, 3, 4]) }, expect: "fail" },
          { name: "2+3: beats 1 and 3", response: { taps: at([0, 2]) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Read the bar",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "five-read", code: HOOK, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-bar",
        version: 1,
        role: "practice",
        prompt:
          "Run the groove and read one bar on the roll and in the code: the kick's string has one step per beat, and the tempo line divides 150 by the beats in a bar. Then answer: how many beats one bar holds, and how the kick and the snare split it.",
        skills: [{ skill: "R16", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the steps of the kick's string, and look where the kick plays among them.",
        },
        hints: ladder(
          "Count the steps of the kick's string: one step is one beat.",
          "One step is one beat. Count from one kick to the next, and from that kick to the end of the bar.",
          "The first group runs from the first kick to just before the second; the other group runs from there to the bar line.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many beats are in one bar?", correct: 5 },
          {
            q: "choice",
            prompt: "How do the kick and the snare split the bar?",
            options: [
              { id: "3+2", label: "Three beats, then two" },
              { id: "2+3", label: "Two beats, then three" },
              { id: "equal", label: "Five equal beats, no groups" },
            ],
            correct: ["3+2"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 5, choice: ["3+2"] } }, expect: "pass" },
          {
            name: "four: the 4/4 habit",
            response: { answer: { number: 4, choice: ["3+2"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "read the wrong way round: 2+3",
            response: { answer: { number: 5, choice: ["2+3"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Seven, by ear",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "seven-by-ear",
        version: 1,
        role: "check",
        prompt:
          "Four grooves at 240 eighth notes a minute, seven to the bar. The hi-hat plays every eighth; the drums mark each group start. For each, pick how the bar is grouped.",
        skills: [{ skill: "R16", w: 1 }],
        hints: earHints(),
        srs: [
          { family: "fam.rhy.odd-grouping", mode: "seed" },
          { family: "fam.rhy.meter", mode: "review-if-due" },
        ],
        tests: [],
        parts: [
          sevenPart("groove-one", "Groove 1.", sevenCode("bd ~ sd ~ bd ~ ~"), "2+2+3"),
          sevenPart("groove-two", "Groove 2.", sevenCode("bd ~ ~ sd ~ bd ~"), "3+2+2"),
          sevenPart("groove-three", "Groove 3.", sevenCode("bd ~ sd ~ ~ bd ~"), "2+3+2"),
          sevenPart(
            "groove-four",
            "Groove 4.",
            sevenCode("bd ~ sd ~ sd ~ ~", [
              'bass: n("<0 3>").struct("x ~ x ~ x ~ ~").scale("E2:minor").s("fingerbass")',
            ]),
            "2+2+3",
          ),
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Four steps into five",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "four-to-five",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the kick's string with five steps, one per beat, grouped 3+2: a hit on the first beat of each group and rests everywhere else. The tempo line already counts five beats at 150; the kick still has four steps. Done when the kick plays only where each group starts.",
        skills: [{ skill: "R16", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 4 },
        // Heard: the kick on both group starts and on no other eighth, in every bar; and the tempo read in BPM
        // through 5/4, so five steps under the 4/4 tempo line (187.5 a minute) fail.
        matcher: { m: "rubric", rules: [KICK_32] },
        constraints: [{ c: "tempo", bpm: BPM }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Count 1-2-3 1-2 with the target and listen for which counts the kick takes.",
        },
        hints: ladder(
          "The tempo line divides 150 by five, so the bar has five beats: the kick's string needs one step for each.",
          "One step per beat: a bar of five needs five. Then a hit only where a group begins: the group of three first, then the group of two.",
          "Five steps; the first is a hit. Count three beats on from it for the second hit, and make every other step a rest.",
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          {
            name: "written with weights: bd@3 bd@2",
            response: { code: fourToFive("150/5", "bd@3 bd@2") },
            expect: "pass",
          },
          {
            name: "the tempo line as one number: setcpm(30)",
            response: { code: S5_SOLUTION.replace("setcpm(150/5)", "setcpm(30)") },
            expect: "pass",
          },
          {
            name: "the second kick softer",
            response: { code: S5_SOLUTION.replace('s("bd ~ ~ bd ~")', 's("bd ~ ~ bd ~").velocity("1 .7")') },
            expect: "pass",
          },
          {
            name: "another kit",
            response: {
              code: S5_SOLUTION.replace('s("bd ~ ~ bd ~")', 's("bd ~ ~ bd ~").bank("RolandTR808")'),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S5_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the 4/4 habit: the tempo line back to setcpm(150/4), 187.5 beats a minute",
            response: { code: fourToFive("150/4", "bd ~ ~ bd ~") },
            expect: "fail",
            feedback: ["code.tempo"],
          },
          {
            name: "grouped the other way: 2+3",
            response: { code: fourToFive("150/5", "bd ~ bd ~ ~") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a kick on every beat",
            response: { code: fourToFive("150/5", "bd*5") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: S5_SOLUTION.replace('s("bd ~ ~ bd ~")', 's("bd ~ ~ bd ~").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your bar of five",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-make",
        id: "your-bar-of-five",
        version: 1,
        role: "practice",
        title: "Groove in five",
        prompt:
          "Group your bar of five 3+2; the starter's kick plays every beat, so nothing groups. Required: the kick plays where each group starts and nowhere else. Also on the checklist: the bass starts each group with the kick, and a tempo of 120 to 180. For more, a snare closing each group or a line on top.",
        skills: [{ skill: "R16", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          { ...KICK_32, id: "kick-marks-three-two" },
          {
            id: "bass-on-the-groups",
            label: "The bass plays on beats 1 and 4 of every bar, with the kick",
            required: false,
            skills: ["R16"],
            rule: "onsets",
            track: "bass",
            contains: STARTS_32,
            perBar: true,
          },
          {
            id: "tempo-in-five",
            label: "`setcpm` sets a tempo between 120 and 180 beats a minute",
            required: false,
            skills: ["R16"],
            rule: "tempo-bpm",
            min: 120,
            max: 180,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Mark the first beat of each group in a 3+2 bar of five: the group of three first.",
          "The kick's string has one step per beat. A group of three, then a group of two: the kick plays only on the first beat of each.",
          "Keep five steps in the kick's string and turn three of the hits into rests.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the kick on 3+2",
            response: { code: make('kick: s("bd ~ ~ bd ~")') },
            expect: "pass",
          },
          {
            name: "written with weights: bd@3 bd@2",
            response: { code: make('kick: s("bd@3 bd@2")') },
            expect: "pass",
          },
          {
            name: "beyond the brief: snare, accented hats, bass and chords on the groups, a tune, faster",
            response: {
              code: make(
                'kick: s("bd ~ ~ bd ~")',
                'snare: s("~ ~ sd ~ sd")',
                'hats: s("hh*10").velocity("1 .5 .5 .5 .5 .5 1 .5 .5 .5").gain(.4)',
                bass(THREE_TWO),
                chords("x ~ ~ x ~"),
                'mel: n("<[4 ~ 3 2 ~] [3 ~ ~ 2 0]>").scale("E4:minor").s("piano")',
              ).replace(`setcpm(${BPM}/5)`, "setcpm(160/5)"),
            },
            expect: "pass",
          },
          {
            name: "another kit, the bass busier inside the groups",
            response: {
              code: make(
                'kick: s("bd ~ ~ bd ~").bank("RolandTR909")',
                'snare: s("~ ~ sd ~ sd").bank("RolandTR909")',
                HATS,
                'bass: n("<[0 ~ ~ ~ 0 0 4 ~ 0 ~] [3 ~ ~ ~ 3 3 0 ~ 3 ~]>").scale("E2:minor").s("fingerbass")',
                HELD_CHORDS,
              ),
            },
            expect: "pass",
          },
          {
            name: "grouped the other way: 2+3",
            response: { code: make('kick: s("bd ~ bd ~ ~")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right idea in six steps: 3+3 squeezed into a bar of five",
            response: { code: make('kick: s("bd ~ ~ bd ~ ~")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: make('kick: s("bd ~ ~ bd ~").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
