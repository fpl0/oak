// R3.L01 Tresillo & Cinquillo (the R3 exemplar; spec: content/specs/R3.md). Three hits spread over the eight
// eighth notes of a bar, 3+3+2, are the tresillo: the bass rhythm under habanera, son, rock and roll and pop. Fill
// two more hits into it and it is the cinquillo. Strudel writes both as "k hits as evenly as possible over n
// steps": `(3,8)` and `(5,8)` after any mini-notation word.
//
// Written for the learner at the gate (AUTHORING §20.1): the rhythm track opens after U13.CP and its order is
// fixed, so R3.L01 always follows R1 and R2, but U14–U17 may be unfinished. The lesson uses only what U13.CP
// guarantees, the R track's own unlocks, and its own: `(k,n)` (contracts §3.2 `tb.mini.euclid`). The word for a
// two-bar rhythmic key is R3.L02's and the word for spreading hits evenly is R3.L03's: neither appears here.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - every required rule checks what is HEARD: the bass's onsets in EVERY bar (`onsets` `equals`, so a silent
//   line, a line that only plays in bar 1, or one note too many all fail); the Make's tresillo is three heard
//   attacks and no attack on the beats it skips;
// - each graded step pins a WRONG answer that uses the right function (`x@2 x@3 x@3`, the weights in the wrong
//   order; `cb(5,16)`, the right call on sixteen steps; the tresillo at `.gain(0)`; `(3,4)` in the Make), and
//   at least three OTHER right answers (`x@3 x@3 x@2`, `x(3,8)`, the pattern written in each bar).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type Rat, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The groove under every step: kick on 1 and 3, snare on 2 and 4, eighth-note hats, Rhodes on 2 and 4. */
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.4)';
const CHORDS = 'chords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)';
/** The bass: C in bar 1, F in bar 2, its rhythm given by the eight slots of `struct`. */
const bass = (rhythm: string, extra = "") =>
  `bass: note("<c2 f2>").struct("${rhythm}").s("fingerbass")${extra}`;
const TRESILLO = "x ~ ~ x ~ ~ x ~";
const ONE_AND_THREE = "x ~ ~ ~ x ~ ~ ~";
const BASS = bass(TRESILLO);

const GROOVE = code(KICK, SNARE, HATS, CHORDS, BASS);
const GROOVE_STRAIGHT = code(KICK, SNARE, HATS, CHORDS, bass(ONE_AND_THREE));

/** S3: the bass on 1 and 3; the learner rewrites its eight slots. */
const S3_STARTER = code(
  KICK,
  SNARE,
  HATS,
  CHORDS,
  `bass: note("<c2 f2>").struct("⟪${ONE_AND_THREE}⟫").s("fingerbass")`,
);
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const s3 = (bassLine: string) => code(KICK, SNARE, HATS, CHORDS, bassLine);
const S3_SOLUTION = s3(BASS);

/** S4 and S5: the cowbell over the groove, its rhythm in `(k,n)`. */
const perc = (pattern: string, extra = "") => `perc: s("${pattern}").gain(.6)${extra}`;
const BELL = code(perc("cb(3,8)"));
const S5_STARTER = code(KICK, SNARE, HATS, CHORDS, BASS, 'perc: s("⟪cb(3,8)⟫").gain(.6)');
const s5 = (percLine: string) => code(KICK, SNARE, HATS, CHORDS, BASS, percLine);
const S5_SOLUTION = s5(perc("cb(5,8)"));

/** The tresillo and the cinquillo as onsets in a bar of 4/4 (eighth-note steps 1, 4, 7 and 1, 3, 4, 6, 7). */
const TRESILLO_ONSETS: Rat[] = [
  [0, 1],
  [3, 8],
  [3, 4],
];
const CINQUILLO_ONSETS: Rat[] = [
  [0, 1],
  [1, 4],
  [3, 8],
  [5, 8],
  [3, 4],
];
/** The eighth-note places the tresillo leaves empty, beats 2 and 3 among them (the last one, 7/8, stays free). */
const TRESILLO_GAPS: Rat[] = [
  [1, 8],
  [1, 4],
  [1, 2],
  [5, 8],
];

/** The bass plays the tresillo in every bar, and nothing else. */
const BASS_TRESILLO: RubricRule = {
  id: "bass-tresillo",
  label: "The bass plays on eighths 1, 4 and 7 of every bar (3+3+2), and nowhere else",
  required: true,
  skills: ["R18"],
  rule: "onsets",
  track: "bass",
  equals: TRESILLO_ONSETS,
  perBar: true,
};
/** The cowbell plays the cinquillo in every bar, and nothing else. */
const BELL_CINQUILLO: RubricRule = {
  id: "bell-cinquillo",
  label:
    "The cowbell plays five hits in every bar, on eighths 1, 3, 4, 6 and 7: the bass's three and two between them",
  required: true,
  skills: ["R18"],
  rule: "onsets",
  track: "perc",
  equals: CINQUILLO_ONSETS,
  perBar: true,
};
/** The lesson's notation: the rhythm comes from `(k,n)`, not from eight written slots. */
const WITH_K_N: RubricRule = {
  id: "with-k-n",
  label: "The cowbell is written with `(k,n)`, two numbers in brackets",
  required: true,
  skills: ["R18"],
  rule: "uses",
  tool: "tb.mini.euclid",
  min: 1,
};

/** S6: three rhythms by ear on the rimshot, over kick and hats; the drums never change. */
const EAR_OPTIONS = [
  { id: "tresillo", label: "Tresillo: three hits, 3+3+2" },
  { id: "cinquillo", label: "Cinquillo: five hits" },
  { id: "straight", label: "Straight: a hit on every beat" },
] as const;
type EarAnswer = (typeof EAR_OPTIONS)[number]["id"];
const earCode = (pattern: string) =>
  code('kick: s("bd ~ bd ~")', 'hats: s("hh*8").gain(.3)', `perc: s("${pattern}").gain(.8)`);
const earHints = (): HintLadder =>
  ladder(
    "Count the rimshots in one bar before you choose.",
    "Count eighth notes with the hats, 1 to 8. Do the rimshots land on every other eighth, or are they spaced unevenly?",
    "Three uneven hits, five uneven hits, or four even ones: each answer has its own count.",
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
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...EAR_OPTIONS] },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong": "Not that one. Count the rimshots in one bar against the hats, then listen once more.",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: `heard as ${answer === "cinquillo" ? "tresillo" : "cinquillo"}`,
      response: { answer: { choice: [answer === "cinquillo" ? "tresillo" : "cinquillo"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/**
 * S7: the Band plays drums and chords, the son groove's I–V7 (C, G7: band.son-montuno, straight in every flavour);
 * the bass and the cowbell are the learner's. Not band.two-chord-vamp: its jazz-soul flavour swings its ride and
 * its comping (`.swingBy(1/3, 4)`), which flams against a straight tresillo and cinquillo.
 */
const MAKE_STARTER = code('bass: note("<c2 g1>").s("fingerbass")', 'perc: s("cb*4").gain(.5)');
const make = (...lines: string[]) => code(...lines);
/** The Make's one rule: three heard bass attacks on the tresillo's places, none on the places it skips. */
const MAKE_TRESILLO: RubricRule = {
  id: "bass-tresillo",
  label: "The bass plays on eighths 1, 4 and 7 of every bar, and not on eighths 2, 3, 5 or 6",
  required: true,
  skills: ["R18"],
  rule: "onsets",
  track: "@bass",
  contains: TRESILLO_ONSETS,
  excludes: TRESILLO_GAPS,
  perBar: true,
};

/** Seconds from the start of a tap stimulus of the eighth-note positions (0 = beat 1 of bar 1) at `BPM`. */
const at = (eighths: number[]) => eighths.map((e) => Math.round((e * 30000) / BPM) / 1000);
const bars4 = (perBar: number[]) => [0, 8, 16, 24].flatMap((b) => perBar.map((e) => b + e));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R3.L01",
  version: 3,
  title: "Tresillo & Cinquillo",
  objective: "I can write the tresillo and the cinquillo, by hand and with (k,n), and hear which is which.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R18"],
  practises: [],
  terms: [
    { id: "term.tresillo", step: "S3" },
    { id: "term.cinquillo", step: "S5" },
  ],
  canDo: ["cd.code.tresillo"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two bass lines",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "groove", code: GROOVE, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-bass-lines",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the bass in both loops; nothing else changes. Notice which loop leans forward into the next bar and which stands still, and where the bass's second note falls against the beat.",
        skills: [{ skill: "R18", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: GROOVE,
            caption: "Three bass notes a bar.",
            bars: 4,
          },
          {
            code: GROOVE_STRAIGHT,
            caption: "The same notes, now on beats 1 and 3.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the bass",
      minutes: 1.25,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-bass",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the bass, the low plucked notes, and ignore the kick and the snare. It plays three times a bar, and its second note falls between two beats. Four bars, twelve taps in all. Done when each tap lands with a bass note.",
        skills: [{ skill: "R18", w: 1 }],
        hints: ladder(
          "Listen for the bass alone: it plays three notes a bar, not one on every beat.",
          "Count eighth notes with the hats, 1 to 8. The bass takes three of them, and the second falls between two beats.",
          "Say the count out loud and tap on the words one, four and seven.",
        ),
        mode: "along",
        stimulus: { src: "code", code: GROOVE, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "bass" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed":
            "A bass note went by without a tap. Three in every bar: count the eighths with the hats.",
          "tap.extra": "A tap landed where the bass is quiet. It plays three times a bar, not on every beat.",
        },
        tests: [
          { name: "with the bass: 3+3+2", response: { taps: at(bars4([0, 3, 6])) }, expect: "pass" },
          { name: "on beats 1 and 3", response: { taps: at(bars4([0, 4])) }, expect: "fail" },
          { name: "on every beat", response: { taps: at(bars4([0, 2, 4, 6])) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Three, three, two",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "three-three-two",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the bass's `struct` string, now on beats 1 and 3, with the rhythm you tapped. It has eight slots, one per eighth note. Put three notes in each bar: the gaps are three slots, three slots, then two to the bar line. Done when the bass matches the target.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: S3_STARTER },
        reference: { solutions: [S3_SOLUTION], bars: 4 },
        // Heard in every bar, exactly: three notes in the tresillo's places and no other. A bass that only plays it
        // in bar 1 (`.slow(2)`), the weights in the wrong order, and a silent bass all fail.
        matcher: { m: "rubric", rules: [BASS_TRESILLO] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Count the eighth notes of one bar with the hats and listen for which ones the bass takes in the target.",
        },
        hints: ladder(
          "Count the eighths between the first and the second bass note in the target, with the hats.",
          "The gaps between the notes are three eighths, three eighths, then two to the next bar line. Slot 1 is the first note.",
          "Say the eight slots of one bar aloud: a note, two rests, and again; the last group is one slot shorter.",
        ),
        tests: [
          { name: "reference", response: { code: S3_SOLUTION }, expect: "pass" },
          {
            name: "written with weights: x@3 x@3 x@2",
            response: { code: s3(bass("x@3 x@3 x@2")) },
            expect: "pass",
          },
          { name: "with (k,n): x(3,8)", response: { code: s3(bass("x(3,8)")) }, expect: "pass" },
          {
            name: "the notes written in each bar",
            response: {
              code: s3('bass: note("<[c2 ~ ~ c2 ~ ~ c2 ~] [f2 ~ ~ f2 ~ ~ f2 ~]>").s("fingerbass")'),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S3_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right weights in the wrong order: x@2 x@3 x@3",
            response: { code: s3(bass("x@2 x@3 x@3")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right slots, stretched over two bars",
            response: { code: s3(bass(TRESILLO, ".slow(2)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right slots, silent: .gain(0)",
            response: { code: s3(bass(TRESILLO, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "an extra note on the last eighth",
            response: { code: s3(bass("x ~ ~ x ~ ~ x x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "predict",
      title: "Three over eight",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "three-over-eight",
        version: 1,
        role: "practice",
        prompt:
          '`s("cb(3,8)")` asks for 3 hits spread as evenly as 8 steps allow, the steps being the eighth notes of a bar. 8 does not divide by 3. Predict what you will hear, and pick it.',
        skills: [{ skill: "R18", w: 1 }],
        hints: null,
        tests: [],
        code: BELL,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "tresillo", label: "The tresillo: 3+3+2" },
          { id: "beats", label: "Three hits on beats 1, 2 and 3, then a rest" },
          { id: "bunched", label: "Three hits in a row, then five rests" },
        ],
        correct: ["tresillo"],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Five over eight",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "five-over-eight",
        version: 1,
        role: "check",
        prompt:
          "Change the cowbell's `(3,8)` so it spreads five hits over the same eight steps instead of three. Keep the other lines. Done when the cowbell plays five hits a bar, like the target.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 4 },
        // Heard: the five hits in every bar and nothing else. Then the notation the lesson teaches: the same
        // rhythm written out slot by slot sounds right and is told to use `(k,n)`.
        matcher: { m: "rubric", rules: [BELL_CINQUILLO, WITH_K_N] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // The override serves both rules (the rhythm heard and the notation), so it stays neutral; the hints carry
        // the listening advice.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Listen to the target against the bass: the cowbell keeps the bass's three hits and adds some of its own. How many in all?",
          "Of the two numbers in the brackets, one counts the hits and one the steps. The steps stay eight eighth notes.",
          "Change the first number inside the brackets; leave the second alone.",
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          { name: "on the rimshot", response: { code: s5(perc("rim(5,8)")) }, expect: "pass" },
          { name: "inside an alternation", response: { code: s5(perc("<cb(5,8)>")) }, expect: "pass" },
          { name: "softer", response: { code: s5('perc: s("cb(5,8)").gain(.3)') }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: plain(S5_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right call on sixteen steps: cb(5,16)",
            response: { code: s5(perc("cb(5,16)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right call, silent: .gain(0)",
            response: { code: s5(perc("cb(5,8)", ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right call, stretched over two bars",
            response: { code: s5(perc("cb(5,8)", ".slow(2)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right rhythm written slot by slot, without (k,n)",
            response: { code: s5(perc("cb ~ cb cb ~ cb cb ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Three, five or four",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "three-five-or-four",
        version: 1,
        role: "check",
        prompt:
          "Three grooves, two bars each. The kick and the hats never change; only the rimshot does. For each, pick tresillo, cinquillo, or straight on the beat.",
        skills: [{ skill: "R18", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.clave", mode: "seed" }],
        tests: [],
        parts: [
          earPart("groove-one", "Groove 1.", "rim ~ rim rim ~ rim rim ~", "cinquillo"),
          earPart("groove-two", "Groove 2.", "rim ~ ~ rim ~ ~ rim ~", "tresillo"),
          earPart("groove-three", "Groove 3.", "rim rim rim rim", "straight"),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your tresillo groove",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.son-montuno", tracks: ["drums", "chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-tresillo-groove",
        version: 1,
        role: "practice",
        title: "Tresillo groove",
        prompt:
          "Put the bass on the tresillo; the band plays drums and two chords, C then G7. Required: the bass plays the tresillo in every bar, on C in one bar and G in the next. Also on the checklist: a cinquillo on the cowbell, and a tempo of 90 to 120.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          MAKE_TRESILLO,
          {
            ...BELL_CINQUILLO,
            id: "bell-cinquillo",
            label: "The cowbell plays the cinquillo: eighths 1, 3, 4, 6 and 7 of every bar",
            required: false,
          },
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
          "Start with the bass's rhythm: three notes a bar, on the tresillo's places.",
          "Three notes on eight eighth-note steps: you can write the slots, or ask Strudel to spread them.",
          'The bass keeps `note("<c2 g1>")`; its rhythm can come from `(k,n)` right after the notes.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the bass on (3,8)",
            response: {
              code: make('bass: note("<c2 g1>(3,8)").s("fingerbass")', 'perc: s("cb*4").gain(.5)'),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: a pickup on the last eighth, the cinquillo bell, faster",
            response: {
              code: make(
                'bass: note("<[c2 ~ ~ c2 ~ ~ c2 a1] [g1 ~ ~ g1 ~ ~ g1 b1]>").s("fingerbass")',
                'perc: s("cb(5,8)").gain(.5)',
                'perc2: s("~ rim ~ rim").gain(.3)',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(112/4)"),
            },
            expect: "pass",
          },
          {
            name: "degrees on the tresillo: root, 5th and octave of each chord",
            response: {
              code: make(
                'bass: n("<[0 4 7] [-3 1 4]>").scale("C2:major").struct("x ~ ~ x ~ ~ x ~").s("fingerbass")',
                'perc: s("cb(5,8)").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "another sound, written slot by slot",
            response: {
              code: make(
                'bass: note("<c2 g1>").struct("x ~ ~ x ~ ~ x ~").s("ebass")',
                'perc: s("cb*4").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the right call, three hits on four steps: (3,4)",
            response: {
              code: make('bass: note("<c2 g1>(3,4)").s("fingerbass")', 'perc: s("cb*4").gain(.5)'),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the cinquillo in the bass: (5,8) fills the places the tresillo skips",
            response: {
              code: make('bass: note("<c2 g1>(5,8)").s("fingerbass")', 'perc: s("cb*4").gain(.5)'),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the tresillo, silent: .gain(0)",
            response: {
              code: make('bass: note("<c2 g1>(3,8)").s("fingerbass").gain(0)', 'perc: s("cb(5,8)").gain(.5)'),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
