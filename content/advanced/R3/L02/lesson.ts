// R3.L02 Clave Direction (spec: content/specs/R3.md). The son clave is a two-bar key: a bar of three hits (the
// tresillo of R3.L01) and a bar of two (beats 2 and 3). Which bar comes first is its direction, 3-2 or 2-3, and
// the tune decides: a tune whose notes meet the clave's hits sits with it; turned round, the same clave crosses
// it. The rumba clave moves the third hit of the three-side one eighth later and is heard once, in a comparison.
//
// Written for the learner at the gate (AUTHORING §20.1): R3 always follows R1 and R2, but U14–U17 may be
// unfinished. Nothing here needs more than U13.CP, the R track's own unlocks and R3.L01's `(k,n)`. The rotation
// `(k,n,r)` and the words for spreading hits evenly are R3.L03's: neither appears here.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step and the Make:
// - every required rule checks what is HEARD: S4 is the `clave` rule with `minBars: 4` (every two-bar window
//   from bar 1 holds the whole son clave 2-3, so a clave that stops after two bars fails); the Make is
//   `clave-aligned`, which reads the tune's onsets against the clave AS WRITTEN and against its two bars swapped,
//   so a tune that crosses the clave, or meets both orders equally, fails;
// - each graded step pins a WRONG answer that uses the right function: `.late(2)` (a whole period: nothing
//   moves), the rumba 2-3, the right clave at `.gain(0)`; in the Make, the right tune at `.gain(0)` and the
//   hook's tune over a 2-3 clave; and at least three OTHER right answers each.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type RubricRule } from "@oak/content-kit";

const BPM = 104;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The son clave on the two-bar eighth grid (content-kit `claveMini`): bar A = the three-side, bar B = the two. */
const THREE_SIDE = "rim ~ ~ rim ~ ~ rim ~";
const TWO_SIDE = "~ ~ rim ~ rim ~ ~ ~";
const RUMBA_THREE_SIDE = "rim ~ ~ rim ~ ~ ~ rim";
const SON_32 = `<[${THREE_SIDE}] [${TWO_SIDE}]>`;
const SON_23 = `<[${TWO_SIDE}] [${THREE_SIDE}]>`;
const RUMBA_32 = `<[${RUMBA_THREE_SIDE}] [${TWO_SIDE}]>`;
const RUMBA_23 = `<[${TWO_SIDE}] [${RUMBA_THREE_SIDE}]>`;
const perc = (pattern: string, extra = "") => `perc: s("${pattern}").gain(.8)${extra}`;

/** The groove of the hook: kick on 1 and 3, eighth hats, a tresillo bass on C then G, Rhodes on 2 and 4. */
const KICK = 'kick: s("bd ~ bd ~").gain(.7)';
const HATS = 'hats: s("hh*8").gain(.3)';
const BASS = 'bass: note("<c2 g1>").struct("x ~ ~ x ~ ~ x ~").s("upright")';
const CHORDS = 'chords: chord("<C G7>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)';
/** The hook's tune: E G C on the three-side's hits, D B on the two-side's (evaluated: five of five meet 3-2). */
const HOOK_MEL = 'mel: note("<[e4 ~ ~ g4 ~ ~ c5 ~] [~ ~ d5 ~ b4 ~ ~ ~]>").s("piano")';
const HOOK = code(perc(SON_32), KICK, HATS, BASS, CHORDS, HOOK_MEL);
const HOOK_CROSSED = code(perc(SON_23), KICK, HATS, BASS, CHORDS, HOOK_MEL);

/** S2 and S3: the rimshot alone, over the hats (S3) or with the groove (S2). */
const CLAVE_ALONE = code(perc(SON_32), HATS);

/** S4: a tune that starts on the two-side (E G on beats 2 and 3, then D B G on the three-side's hits). */
const TUNE_23 = 'mel: note("<[~ ~ e4 ~ g4 ~ ~ ~] [d5 ~ ~ b4 ~ ~ g4 ~]>").s("piano")';
const s4 = (percLine: string) => code(percLine, KICK, HATS, BASS, CHORDS, TUNE_23);
const S4_STARTER = s4(`perc: s("⟪${SON_32}⟫").gain(.8)`);
const S4_SOLUTION = s4(perc(SON_23));
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S4's rule: the son clave 2-3 on the rimshot, whole, in every two-bar window of the four bars. */
const CLAVE_23: RubricRule = {
  id: "clave-two-three",
  label: "The rimshot plays the son clave 2-3, its two-side first, for all four bars",
  required: true,
  skills: ["R18"],
  rule: "clave",
  track: "perc",
  type: "son",
  direction: "2-3",
  minBars: 4,
};

/** S5: son 3-2 for two bars, then rumba 3-2 for two, the rimshot alone over the hats. */
const SON_THEN_RUMBA = code(
  `perc: s("<[${THREE_SIDE}] [${TWO_SIDE}] [${RUMBA_THREE_SIDE}] [${TWO_SIDE}]>").gain(.8)`,
  HATS,
);

/** S6: four two-bar grooves; the kick, the hats and the bass that marks bar 1 never change. */
const EAR_OPTIONS = [
  { id: "son 3-2", label: "Son clave, 3-2" },
  { id: "son 2-3", label: "Son clave, 2-3" },
] as const;
type EarAnswer = (typeof EAR_OPTIONS)[number]["id"];
const earCode = (pattern: string) =>
  code(
    'kick: s("bd ~ bd ~").gain(.6)',
    'hats: s("hh*8").gain(.25)',
    'bass: note("<c2 g1>").struct("x ~").s("upright").gain(.7)',
    perc(pattern),
  );
const earHints = (): HintLadder =>
  ladder(
    "Count the rimshots in each of the two bars: one bar has three.",
    "The bass plays C in the first bar and the G below it in the second. Count the rimshots in the bar on C.",
    "Three in the first bar is one direction, two in the first bar the other: the name says which side comes first.",
  );
const earPart = (id: string, prompt: string, pattern: string, answer: EarAnswer): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "R18", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: earCode(pattern), bars: 2, showCode: false },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: { ui: "choice", options: [...EAR_OPTIONS] },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong": "Not that one. Find the bar with three hits: is it the first of the two, or the second?",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: `heard as ${answer === "son 3-2" ? "son 2-3" : "son 3-2"}`,
      response: { answer: { choice: [answer === "son 3-2" ? "son 2-3" : "son 3-2"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/**
 * S7: the Band plays drums, bass and chords, the son groove's I–V7 (C, then G7: band.son-montuno, straight in every
 * flavour, with no clave of its own); the clave and the tune are the learner's. Not band.two-chord-vamp: its
 * jazz-soul flavour swings its ride and its comping, which flams against a straight clave.
 */
const make = (...lines: string[]) => code(...lines);
const MAKE_STARTER = make(perc(SON_32), 'mel: note("e4 g4 d5 g4").s("piano")');
/** A tune of the learner's kind over C then G7: E G C on the three-side, B G on the two-side. */
const MAKE_MEL = 'mel: note("<[e4 ~ ~ g4 ~ ~ c5 ~] [~ ~ b4 ~ g4 ~ ~ ~]>").s("piano")';
/** The Make's one rule: the tune meets the clave as written, more than it would meet the clave turned round. */
const FACES_CLAVE: RubricRule = {
  id: "tune-faces-clave",
  label:
    "In every two bars the tune's two bars differ, and at least 3 of its notes land with a rimshot, more than land between them",
  required: true,
  skills: ["R18"],
  rule: "custom",
  fn: "clave-aligned",
  params: { track: "mel", clave: "perc", min: 3 },
};

/** Seconds from the start of a tap stimulus of the eighth-note positions (0 = beat 1 of bar 1) at `BPM`. */
const at = (eighths: number[]) => eighths.map((e) => Math.round((e * 30000) / BPM) / 1000);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R3.L02",
  version: 3,
  title: "Clave Direction",
  objective: "I can hear which way a clave runs and write a tune that faces it.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R18"],
  terms: [{ id: "term.clave", step: "S3" }],
  canDo: ["cd.hear.clave"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One tune, two rimshots",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "son-groove", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-tune-two-rimshots",
        version: 1,
        role: "practice",
        prompt:
          "Listen to each tune note against the rimshot in both loops; only the rimshot changes. Notice in which loop the tune and the rimshot speak together, and in which they talk past each other.",
        skills: [{ skill: "R18", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Follow the tune and the rimshot together.",
            bars: 4,
          },
          {
            code: HOOK_CROSSED,
            caption: "Only the rimshot changed. Does any tune note still meet it?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the rimshot",
      minutes: 1.25,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-rimshot",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the rimshot, the dry click, and ignore the kick and the bass. It plays three times in bar 1 and twice in bar 2, then the same again. Four bars, ten taps in all. Done when each tap lands with a rimshot.",
        skills: [{ skill: "R18", w: 1 }],
        hints: ladder(
          "Listen for the rimshot's dry click: bar 1 and bar 2 hold different numbers of hits.",
          "The first bar is a rhythm you wrote in the last lesson: three, three and two eighths. The second bar has two hits.",
          "In the second bar, tap on beats 2 and 3 and nowhere else.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "perc" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A rimshot went by without a tap. Three in the first bar, two in the second.",
          "tap.extra": "A tap landed where the rimshot is quiet. It never plays on every beat.",
        },
        tests: [
          {
            name: "with the rimshot: three, then two",
            response: { taps: at([0, 3, 6, 10, 12, 16, 19, 22, 26, 28]) },
            expect: "pass",
          },
          {
            name: "on every beat",
            response: { taps: at([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]) },
            expect: "fail",
          },
          {
            name: "two first, then three",
            response: { taps: at([2, 4, 8, 11, 14, 18, 20, 24, 27, 30]) },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two bars, five hits",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-clave", code: CLAVE_ALONE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "two-bars-five-hits",
        version: 1,
        role: "practice",
        prompt:
          "Run the rimshot over the hats and read two bars on the roll; each bar has eight eighth-note slots. Then answer: how many rimshots the two bars hold together, and what the first bar is.",
        skills: [{ skill: "R18", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the rimshots of each bar on the roll separately, then add them.",
        },
        hints: ladder(
          "Count the rimshots of bar 1 and of bar 2 separately.",
          "The pattern inside `< >` plays its first bracket in bar 1 and its second in bar 2. Count the hits in each.",
          "The second bar has two hits. Compare the first bar with the bass you wrote last lesson.",
        ),
        code: { starter: CLAVE_ALONE },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many rimshots in the two bars together?", correct: 5 },
          {
            q: "choice",
            prompt: "What is the first bar?",
            options: [
              { id: "tresillo", label: "Three hits: the tresillo" },
              { id: "two-three", label: "Two hits, on beats 2 and 3" },
              { id: "beats", label: "Three hits, on beats 1, 2 and 3" },
            ],
            correct: ["tresillo"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 5, choice: ["tresillo"] } }, expect: "pass" },
          {
            name: "one bar counted twice",
            response: { answer: { number: 6, choice: ["tresillo"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the bars read the other way",
            response: { answer: { number: 5, choice: ["two-three"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Turn it round",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "turn-it-round",
        version: 1,
        role: "check",
        prompt:
          "The tune opens with two notes on beats 2 and 3, then answers with three, but the clave starts with its three-side. Turn the clave round so its two-side plays under the tune's two-note bar. Keep every hit where it is inside its bar. Done when the two-side comes first.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        // Heard: the whole son clave in its 2-3 order in every two-bar window of four bars, and nothing else on its
        // grid. A clave moved by a whole period (`.late(2)`), a rumba, a clave that stops after two bars and a
        // silent one all fail.
        matcher: { m: "rubric", rules: [CLAVE_23] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the first bar of the target: how many rimshots, and do they meet the tune's first two notes?",
        },
        hints: ladder(
          "Find the tune's two-note bar: the clave's two-side belongs under it.",
          "The clave's two bars are the two brackets inside `< >`. Its two-side has to sound under the tune's two-note bar.",
          "Nothing inside either bracket has to change: every hit already sits in the right place within its bar.",
        ),
        tests: [
          { name: "reference: the two bars swapped", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "moved one bar later: .late(1)",
            response: { code: s4(perc(SON_32, ".late(1)")) },
            expect: "pass",
          },
          {
            name: "moved one bar earlier: .early(1)",
            response: { code: s4(perc(SON_32, ".early(1)")) },
            expect: "pass",
          },
          {
            name: "the three-side written with (3,8)",
            response: { code: s4(perc(`<[${TWO_SIDE}] rim(3,8)>`)) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, a whole period: .late(2)",
            response: { code: s4(perc(SON_32, ".late(2)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the rumba clave 2-3: the third hit an eighth late",
            response: { code: s4(perc(RUMBA_23)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the 2-3 clave in bars 1 and 2 only, then silence",
            response: { code: s4(perc(`<[${TWO_SIDE}] [${THREE_SIDE}] ~ ~>`)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right clave, silent: .gain(0)",
            response: { code: s4(`perc: s("${SON_23}").gain(0)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "One hit moves",
      minutes: 0.75,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "one-hit-moves",
        version: 1,
        role: "practice",
        prompt:
          "Four bars of rimshot over the hats: the son clave 3-2 in bars 1 and 2, then another clave in bars 3 and 4. Pick what changed in bars 3 and 4.",
        skills: [{ skill: "R18", w: 1 }],
        hints: ladder(
          "Compare bar 3 with bar 1 and bar 4 with bar 2: only one pair differs.",
          "Count the hats in bar 3, 1 to 8, and say where each rimshot lands. Then do the same for bar 1.",
          "The first two hits of the three-side do not move.",
        ),
        stimulus: { src: "code", code: SON_THEN_RUMBA, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "third-later", label: "The third hit of the three-side, one eighth later" },
            { id: "two-side", label: "The first hit of the two-side" },
            { id: "nothing", label: "Nothing moved" },
          ],
        },
        correct: { choice: ["third-later"] },
        feedbackText: {
          "id.wrong":
            "Not that one. Count the eighths of bar 3 with the hats and compare each rimshot with the same place in bar 1.",
        },
        tests: [
          { name: "the third hit, later", response: { answer: { choice: ["third-later"] } }, expect: "pass" },
          {
            name: "the two-side",
            response: { answer: { choice: ["two-side"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "nothing",
            response: { answer: { choice: ["nothing"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Which side first",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "which-side-first",
        version: 1,
        role: "check",
        prompt:
          "Four grooves, two bars each, after a one-bar count. The kick, the hats and the bass never change; only the rimshot does. For each, pick 3-2 or 2-3.",
        skills: [{ skill: "R18", w: 1 }],
        hints: earHints(),
        srs: [
          { family: "fam.rhy.clave", mode: "review-if-due" },
          {
            deck: "deck.rhy.clave",
            cards: ["fact.rhy.clave.son-3-2-bar-1", "fact.rhy.clave.direction"],
            mode: "seed",
          },
        ],
        tests: [],
        parts: [
          earPart("groove-one", "Groove 1.", SON_32, "son 3-2"),
          earPart("groove-two", "Groove 2.", SON_23, "son 2-3"),
          earPart("groove-three", "Groove 3.", SON_23, "son 2-3"),
          earPart("groove-four", "Groove 4.", SON_32, "son 3-2"),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your tune on the clave",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.son-montuno", tracks: ["drums", "bass", "chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-tune-on-the-clave",
        version: 1,
        role: "practice",
        title: "Tune on the clave",
        prompt:
          "Write a two-bar piano tune that faces your clave; the band plays drums, bass, and C then G7. Pick the rimshot's clave: son or rumba, 3-2 or 2-3. Required: at least three tune notes land with rimshots in every two bars, and the tune's two bars differ. Also on the checklist: a tempo of 90 to 120.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          FACES_CLAVE,
          {
            id: "groove-tempo",
            label: "`setcpm` sets a tempo between 90 and 120 beats a minute",
            required: false,
            skills: ["R18"],
            rule: "tempo-bpm",
            min: 90,
            max: 120,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Mark where the rimshots fall in each of your clave's two bars: those are the places for your tune's notes.",
          "Write the tune on eight slots a bar, like the clave, one bracket per bar inside `< >`. Put notes in the slots where the clave plays.",
          "Bar 1 is over C and bar 2 over G7: notes of each chord on the clave's slots sound at home. A note or two between them is yours.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: a tune on the 3-2 clave's five hits",
            response: { code: make(perc(SON_32), MAKE_MEL) },
            expect: "pass",
          },
          {
            name: "the clave 2-3 and a tune that opens on its two-side",
            response: {
              code: make(perc(SON_23), 'mel: note("<[~ ~ e4 ~ g4 ~ ~ ~] [f4 ~ ~ b4 ~ ~ d5 ~]>").s("piano")'),
            },
            expect: "pass",
          },
          {
            name: "the rumba 3-2 with a passing note of its own",
            response: {
              code: make(
                perc(RUMBA_32),
                'mel: note("<[e4 ~ ~ g4 ~ d4 ~ c4] [~ ~ b4 ~ d5 ~ ~ ~]>").s("piano")',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: a shaker, a held note, faster",
            response: {
              code: make(
                perc(SON_32),
                'perc2: s("sh*8").gain(.25)',
                'mel: note("<[g4 ~ ~ e4 ~ ~ c5@2] [~ ~ d5 ~ b4 ~ a4 g4]>").s("piano")',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(112/4)"),
            },
            expect: "pass",
          },
          {
            name: "the first tune over the clave turned round: crossed",
            response: { code: make(perc(SON_23), MAKE_MEL) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a tune on every eighth: it meets both orders the same",
            response: {
              code: make(
                perc(SON_32),
                'mel: note("<[e4 g4 e4 g4 e4 g4 e4 g4] [f4 b4 f4 b4 f4 b4 f4 b4]>").s("piano")',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one bar of tune repeated",
            response: { code: make(perc(SON_32), 'mel: note("e4 ~ ~ g4 ~ ~ c5 ~").s("piano")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right tune, silent: .gain(0)",
            response: { code: make(perc(SON_32), `${MAKE_MEL}.gain(0)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "no clave on the rimshot: the tresillo in every bar",
            response: { code: make(perc("rim(3,8)"), MAKE_MEL) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
