// U13.L06 Rhythm Dictation II. A groove you can hear is a groove you can write down, with one method: find the
// beat, decide how it divides (in two, long–short, or in three), then place the hits one layer at a time, kick
// first. Every shape heard today came from this unit: hits between the beats (U13.L01), long–short pairs (U11.L07,
// U13.L05), three to the beat (U13.L04, U13.L05). No new sound, call, sign or term. What the learner has: drum
// grooves written on the eighth and sixteenth grid (U01.L09), tunes and bass lines taken down by ear with the
// source and their code side by side (U07, U08.L05, X1, X2), `.swingBy(1/3, 4)` (U11.L07), twelve to the bar
// (U13.L04–L05). Not yet: melodic dictation in these rhythms (the gym), triplets on the staff (`fam.rhy.dictation`
// level 7, in the warm-ups after this lesson). Spec: content/specs/U13.md.
//
// How it is graded: S4 and S5 are by-ear transcriptions of one drum line, the kick, with the rest of the groove
// given in the code (`byEar`, A/B at full and three-quarter speed). They compare the kick's hits by drum role and
// onset (`events` with `sound: "drum-role"`, which the by-ear rule reads as `exact`) and by the rhythm matcher on
// a thirty-second's give. S5 declares `swing`, so onsets are compared on the straight grid and a straight answer
// matches them; the measured `swing` rule on the hats (U11.L07's ratio window) and `swung-offbeats` on the kick
// (its hits on an "and" sit late, long–short) are what make it fail. S6 is twelve
// steps of one bar, kick and snare, on the grid: an `identify` with the grid's cells as the answer (a `dictation`
// answered on a grid has no grading path yet; see the result's apiNotes). The Make's one required rule is
// `syncopation` on the kick in bars 3–4, the learner's answer: at least two kicks that start between the beats
// with no kick on the beat after them (a kick on the "and" of 4 followed by one on 1 does not count), as the
// brief and the label say.
//
// Meter: S6's bar is the twelve eighths of a 12/8 bar, written here as eighth-note triplets in 4/4 on a
// twelve-step grid (the spec's fallback while `meter.compound` is planned): it sounds the same, and the prose
// says both names.
//
// Band: none (`band: false`), as in all of U13: the drums are the learner's own lines, and a Band's would double
// them or swing against them.
import { type Choice, defineLesson, type HintLadder, type IdentifyEx, type Matcher } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The call that swings a line's eighths in 4/4 (U11.L07). */
const SWING = ".swingBy(1/3, 4)";
const SNARE = 'snare: s("~ sd ~ sd")';
const hats = (pattern = "hh*8", swing = "") => `hats: s("${pattern}")${swing}.gain(.5)`;

// --- S1, the hook: one rhythm for kick and bass, three ways ------------------------------------------------

/** Eighths 1, 4 and 7 of bar 1; 1, 4 and 6 of bar 2 (verified: 0, 3/8, 3/4 | 1, 11/8, 13/8). */
const HITS = "<[x ~ ~ x ~ ~ x ~] [x ~ ~ x ~ x ~ ~]>";
/** The same hits in twelve slots: the off-beats sit on the third of three (5/12 of the bar, 5/3 of two). */
const HITS_12 = "<[x ~ ~ ~ ~ x ~ ~ ~ x ~ ~] [x ~ ~ ~ ~ x ~ ~ x ~ ~ ~]>";
const hook = (hits: string, hatsLine: string, swing = "") =>
  code(
    `const hits = "${hits}"\n`,
    `kick: s("bd").struct(hits)${swing}`,
    SNARE,
    hatsLine,
    `bass: n("<0 3>").struct(hits).scale("C2:major")${swing}.s("fingerbass").lpf(800)`,
    'chords: chord("<C^7 F^7>").voicing().s("rhodes").gain(.6)',
  );
const STRAIGHT = hook(HITS, hats());
const SWUNG_HOOK = hook(HITS, hats("hh*8", SWING), SWING);
const TWELVE = hook(HITS_12, hats("hh*12"));

// --- S2, how the beat divides: three new grooves -----------------------------------------------------------

const DIVISION_OPTIONS: readonly Choice[] = [
  { id: "even", label: "Even: two to the beat" },
  { id: "swung", label: "Swung: two to the beat, long–short" },
  { id: "three", label: "Three to the beat" },
];
type Division = "even" | "swung" | "three";
const divisionHints = (): HintLadder =>
  ladder(
    "Leave the kick alone and listen to the hats. How many sounds does each beat hold?",
    "Two equal hats a beat is even. Two hats with the second one late, long then short, is swung. Three equal hats a beat is three to the beat.",
    "Say “1 & 2 &” with the hats, then “1 trip let 2 trip let”. The words that fit without hurrying are the answer.",
  );
const divisionPart = (
  id: string,
  prompt: string,
  groove: string,
  answer: Division,
  right: string,
): IdentifyEx => {
  // The likeliest confusion: swung and three-to-the-beat for each other, even for swung.
  const wrong: Division = answer === "swung" ? "three" : "swung";
  return {
    kind: "identify",
    id,
    version: 1,
    role: "practice",
    prompt,
    skills: [{ skill: "E14", w: 1 }],
    hints: divisionHints(),
    stimulus: { src: "code", code: groove, bars: 2, showCode: false },
    cue: { context: "none", countInBars: 0, click: false, replays: -1 },
    answer: { ui: "choice", options: [...DIVISION_OPTIONS] },
    correct: { choice: [answer] },
    feedbackText: { "id.wrong": right },
    tests: [
      { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
      {
        name: `heard as ${wrong}`,
        response: { answer: { choice: [wrong] } },
        expect: "fail",
        feedback: ["id.wrong"],
      },
    ],
  };
};
/** A shuffle: the hats and the kick swung, an organ holding C7 and F7. */
const EAR_SWUNG = code(
  'kick: s("<[bd ~ bd ~ ~ bd ~ ~] [bd ~ ~ bd ~ ~ ~ bd]>").swingBy(1/3, 4)',
  SNARE,
  hats("hh*8", SWING),
  'chords: chord("<C7 F7>").voicing().s("organ").gain(.5)',
);
/** Twelve hats a bar; the kick on beats 1 and 3 and on the third of three before beats 3 and 1. */
const EAR_THREE = code(
  'kick: s("bd ~ ~ ~ ~ bd bd ~ ~ ~ ~ bd")',
  SNARE,
  hats("hh*12"),
  'chords: chord("<Am7 Dm7>").voicing().s("rhodes").gain(.6)',
);
/** Straight funk: sixteenth-free, every hit on an eighth, the kick off the beat. */
const EAR_EVEN = code(
  'kick: s("<[bd ~ ~ bd ~ bd ~ ~] [bd ~ ~ ~ ~ ~ bd ~]>")',
  SNARE,
  hats(),
  'chords: chord("<Em7 A7>").voicing().s("rhodes").gain(.6)',
);
const SWUNG_TEXT =
  "Swung. Each beat held two hats, the second one late: long, then short. Three to the beat would put a third hat in between.";
const THREE_TEXT =
  "Three to the beat: three even hats in every beat. Swing has only two, the second one late, so it never fills the middle of the three.";
const EVEN_TEXT =
  "Even: two hats a beat, exactly halfway apart. The kick's hits between the beats do not change the feel.";

// --- S4, by ear, straight: the kick of a funk groove ----------------------------------------------------------

/** Bar 1: eighths 1, 4, 7; bar 2: 1, 6, 7 (the “and” of 3 and beat 4). */
const KICK_FUNK = "<[bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ ~ ~ bd bd ~]>";
const FUNK_CHORDS = 'chords: chord("<Dm7 G7>").voicing().s("rhodes").gain(.6)';
const funk = (kickLine: string) => code(kickLine, SNARE, hats(), FUNK_CHORDS);
const FUNK_SOURCE = funk(`kick: s("${KICK_FUNK}")`);
const EMPTY_BARS = "<[~ ~ ~ ~ ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ ~]>";
const FUNK_STARTER = funk(`kick: s("⟪${EMPTY_BARS}⟫")`);
/** The kick's hits by drum role and onset, and its rhythm on a thirty-second's give. */
const kickByEar = (): Matcher => ({
  m: "all",
  of: [
    {
      m: "events",
      pitch: "absolute",
      rhythm: "onsets",
      durations: false,
      sound: "drum-role",
      tracks: ["kick"],
    },
  ],
});

// --- S5, by ear, swung: the kick of a shuffle, and the swing -------------------------------------------------

/** Bar 1: 1, the “and” of 2, 3; bar 2: 1, the “and” of 3, the “and” of 4 (straight; the call swings them). */
const KICK_SHUFFLE = "<[bd ~ ~ bd bd ~ ~ ~] [bd ~ ~ ~ ~ bd ~ bd]>";
const SHUFFLE_CHORDS = 'chords: chord("<C7 F7>").voicing().s("organ").gain(.5)';
const shuffle = (kickLine: string, hatsLine: string) => code(kickLine, SNARE, hatsLine, SHUFFLE_CHORDS);
const SHUFFLE_SOURCE = shuffle(`kick: s("${KICK_SHUFFLE}")${SWING}`, hats("hh*8", SWING));
const SHUFFLE_STARTER = shuffle(`kick: s("⟪${EMPTY_BARS}⟫")`, hats());
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;

// --- S6, in three: one bar on a twelve-step grid ------------------------------------------------------------

/** Kick on the first and third of three in beats 1 and 3 (steps 1, 3, 7, 9), snare on beats 2 and 4 (4, 10). */
const TWELVE_BAR = code(
  'kick: s("bd ~ bd ~ ~ ~ bd ~ bd ~ ~ ~")',
  'snare: s("~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~")',
  hats("hh*12"),
  'chords: chord("<C^7 Am7>").voicing().s("rhodes").gain(.6)',
);
const GRID_CELLS = ["kick:0", "kick:2", "kick:6", "kick:8", "snare:3", "snare:9"];

// --- S7, the Make: call and answer --------------------------------------------------------------------------

/** The call is S4's kick; bars 3–4 hold a plain kick on 1 and 3 for the answer. */
const CALL = "[bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ ~ ~ bd bd ~]";
const PLAIN = "[bd ~ ~ ~ bd ~ ~ ~]";
const MAKE_CHORDS = 'chords: chord("<Dm7 G7 Dm7 G7>").voicing().s("rhodes").gain(.6)';
const callAnswer = (answer: string, bassLine: string, ...more: string[]) =>
  code(`kick: s("<${CALL} ${answer}>")`, SNARE, hats(), bassLine, MAKE_CHORDS, ...more);
/** The roots of Dm7 and G7 (D2, G2) on the kick's hits. */
const MAKE_BASS = 'bass: n("<[1 ~ ~ 1 ~ ~ 1 ~] [4 ~ ~ ~ ~ 4 4 ~] [1 ~ ~ ~ 1 ~ ~ ~] [4 ~ ~ ~ 4 ~ ~ ~]>")';
const bassOf = (pattern: string) => `${pattern}.scale("C2:major").s("fingerbass").lpf(800)`;
const MAKE_STARTER = callAnswer(`${PLAIN} ${PLAIN}`, bassOf(MAKE_BASS));
const ANSWER = "[bd ~ bd ~ ~ bd ~ ~] [bd ~ ~ bd ~ ~ bd ~]";
const MAKE_MINIMAL = callAnswer(ANSWER, bassOf(MAKE_BASS));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U13.L06",
  version: 3,
  title: "Rhythm Dictation II",
  objective:
    "I can write down a syncopated, swung or three-to-the-beat rhythm by ear: beat, division, then the hits.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["E14"],
  practises: [],
  terms: [],
  canDo: ["cd.hear.rhythm-dictation-2"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One rhythm, three feels",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "hook", code: STRAIGHT, bars: 2 },
      exercise: {
        kind: "listen",
        id: "one-rhythm-three-feels",
        version: 1,
        role: "practice",
        prompt:
          "One two-bar groove, three times, the kick and the bass on the same hits. Listen to the hats: one version walks, one shuffles, one rolls. Count the hats in each beat to tell which loop is which.",
        skills: [{ skill: "E14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: STRAIGHT, caption: "Loop 1: count the hats in each beat.", bars: 2 },
          { code: SWUNG_HOOK, caption: "Loop 2: the same hits. Are the hats still even?", bars: 2 },
          {
            code: TWELVE,
            caption: "Loop 3: the same hits. Count the hats in each beat again.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "How the beat divides",
      minutes: 0.75,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "how-the-beat-divides",
        version: 1,
        role: "practice",
        prompt:
          "Three new grooves. Find the beat with the snare, then listen to the hats inside one beat. For each groove, pick even (two to the beat), swung (two, long–short) or three to the beat.",
        skills: [{ skill: "E14", w: 1 }],
        hints: divisionHints(),
        srs: [{ family: "fam.rhy.swing", mode: "review-if-due" }],
        tests: [],
        parts: [
          divisionPart("groove-one", "Groove 1, on the organ.", EAR_SWUNG, "swung", SWUNG_TEXT),
          divisionPart("groove-two", "Groove 2, on the Rhodes.", EAR_THREE, "three", THREE_TEXT),
          divisionPart("groove-three", "Groove 3, on the Rhodes.", EAR_EVEN, "even", EVEN_TEXT),
        ],
      },
    },
    {
      id: "S3",
      kind: "tap",
      title: "Echo the hits",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "echo-the-hits",
        version: 1,
        role: "practice",
        prompt:
          "Listen to a two-bar rhythm over the click, then tap it back, one tap per hit. Some hits fall on the clicks and some between them, on an “&”. Done when every hit has its tap.",
        skills: [{ skill: "R10", w: 1 }],
        hints: ladder(
          "Which hits land with the click, and which fall between two clicks?",
          "Count 1 & 2 & 3 & 4 & with the click. Find which hits land on a number and which fall between two numbers.",
          "Tap the hits on the numbers first. Then add the ones on an “&”, a half beat after the click before them.",
        ),
        mode: "echo",
        stimulus: { src: "generator", family: "fam.rhy.echo", level: 5 },
        cue: { context: "none", countInBars: 1, click: true, replays: 2 },
        bars: 2,
        target: {},
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        srs: [{ family: "fam.rhy.echo", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S4",
      kind: "dictate",
      title: "Take the kick down",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "dictation",
        id: "take-the-kick-down",
        version: 1,
        role: "check",
        prompt:
          "Write down the hidden kick of this two-bar funk groove; the snare, hats and chords are already in the code. Each bar of the `kick:` line has eight slots, one per eighth note. Change a `~` to `bd` wherever the kick plays: three kicks in each bar.",
        skills: [
          { skill: "E14", w: 0.7 },
          { skill: "R10", w: 0.3 },
        ],
        hints: ladder(
          "The beat is even here, two to the beat. Which kicks land with the snare's beats, and which fall between?",
          "Count 1 & 2 & 3 & 4 & with the hats: each “&” is a slot of its own, so beat 3 is slot 5. Find bar 1's three kicks, then bar 2's three.",
          "Bar 1 starts on beat 1 and its second kick is the “and” after beat 2: `[bd ~ ~ bd …`. Bar 2 also starts on beat 1.",
        ),
        domain: "rhythm",
        stimulus: { src: "code", code: FUNK_SOURCE, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: FUNK_STARTER },
        reference: { solutions: [FUNK_SOURCE], bars: 2 },
        matcher: kickByEar(),
        pass: 0.95,
        byEar: { ab: true, rates: [1, 0.75], accepts: "exact" },
        srs: [{ family: "fam.rhy.dictation", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: FUNK_SOURCE }, expect: "pass" },
          {
            name: "written with struct",
            response: { code: funk('kick: s("bd").struct("<[x ~ ~ x ~ ~ x ~] [x ~ ~ ~ ~ x x ~]>")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: funk(`kick: s("${EMPTY_BARS}")`) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "on the beat for the “and”",
            response: { code: funk('kick: s("<[bd ~ bd ~ ~ ~ bd ~] [bd ~ ~ ~ ~ bd bd ~]>")') },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
          {
            name: "a kick missed in bar 2",
            response: { code: funk('kick: s("<[bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ ~ ~ ~ bd ~]>")') },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "dictate",
      title: "Take the shuffle down",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "dictation",
        id: "take-the-shuffle-down",
        version: 1,
        role: "check",
        prompt:
          "Write down the kick of this two-bar shuffle in plain eighths, eight slots a bar, as if it were straight: three kicks in each bar. Then swing the kick and the hats: add `.swingBy(1/3, 4)` after the pattern of each line. Done when the kick's hits match and both lines play long–short.",
        skills: [
          { skill: "E14", w: 0.7 },
          { skill: "R13", w: 0.3 },
        ],
        hints: ladder(
          "A swung rhythm is written straight. Which slots would the kick take if the groove were even?",
          "Each long–short pair is one beat: the long one is the number, the short one its “&”. Then the hats and the kick each take `.swingBy(1/3, 4)` after the pattern.",
          "Bar 1 has kicks on beat 1, on the “and” of 2 and on beat 3: `[bd ~ ~ bd bd ~ ~ ~]`. Bar 2 ends on the “and” of 4.",
        ),
        domain: "rhythm",
        swing: SWUNG,
        stimulus: { src: "code", code: SHUFFLE_SOURCE, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: SHUFFLE_STARTER },
        reference: { solutions: [SHUFFLE_SOURCE], bars: 2 },
        // The kick on the straight grid (the exercise declares swing), and the hats' measured swing (U11.L07's
        // ratio window): a straight answer matches the onsets and fails on the swing.
        matcher: {
          m: "all",
          of: [
            ...(kickByEar() as Extract<Matcher, { m: "all" }>).of,
            {
              m: "rubric",
              rules: [
                {
                  id: "hats-swing",
                  label: "The hats play long–short: swung eighths",
                  required: true,
                  skills: ["R13"],
                  rule: "swing",
                  track: "hats",
                  subdivision: 8,
                  ratio: [1.6, 2.4],
                },
                {
                  id: "kick-shuffles",
                  label: "The kick's hits on an “&” sit late, long–short, like the hats",
                  required: true,
                  skills: ["R13"],
                  rule: "custom",
                  fn: "swung-offbeats",
                  params: { track: "kick" },
                },
              ],
            },
          ],
        },
        pass: 0.95,
        byEar: { ab: true, rates: [1, 0.75], accepts: "exact" },
        // No `rubric.unmet` override: each swing rule names its own line ("bar 1, 2& in `kick` divides its beat 1:1,
        // straight; … add `.swingBy(1/3, 4)` to that line"), so a straight kick under swung hats is told so.
        srs: [{ family: "fam.rhy.swing", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: SHUFFLE_SOURCE }, expect: "pass" },
          {
            name: "the short form: .swing(4)",
            response: { code: shuffle(`kick: s("${KICK_SHUFFLE}").swing(4)`, hats("hh*8", ".swing(4)")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: shuffle(`kick: s("${EMPTY_BARS}")`, hats()) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the kick right, nothing swung",
            response: { code: shuffle(`kick: s("${KICK_SHUFFLE}")`, hats()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hats swung, the kick left straight",
            response: { code: shuffle(`kick: s("${KICK_SHUFFLE}")`, hats("hh*8", SWING)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kick swung, the hats left straight",
            response: { code: shuffle(`kick: s("${KICK_SHUFFLE}")${SWING}`, hats()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kick written with .struct(), both lines swung",
            response: {
              code: shuffle(
                `kick: s("bd").struct("<[x ~ ~ x x ~ ~ ~] [x ~ ~ ~ ~ x ~ x]>")${SWING}`,
                hats("hh*8", SWING),
              ),
            },
            expect: "pass",
          },
          {
            name: "a kick on the wrong eighth",
            response: {
              code: shuffle(
                `kick: s("<[bd ~ ~ bd bd ~ ~ ~] [bd ~ ~ ~ bd ~ ~ bd]>")${SWING}`,
                hats("hh*8", SWING),
              ),
            },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Twelve to the bar",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "twelve-to-the-bar",
        version: 1,
        role: "check",
        prompt:
          "One bar with every beat split in three: twelve steps, one group of three per beat. Mark every kick and every snare hit on the grid, in its own row. Leave the hats out: they play all twelve steps.",
        skills: [
          { skill: "E14", w: 0.7 },
          { skill: "R12", w: 0.3 },
        ],
        hints: [
          { text: "Count “1 trip let 2 trip let” with the hats. Where does the snare fall?" },
          {
            text: "Each beat is one group of three steps: beat 2 starts the second group, beat 4 the fourth. Then find which of each three the kicks take.",
          },
          {
            text: "Hear it again, slower. The snare is on beats 2 and 4, the first step of their groups. The kick plays twice in beat 1.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "code", code: TWELVE_BAR, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "grid", rows: ["kick", "snare"], stepsPerBar: 12, bars: 1 },
        correct: { choice: GRID_CELLS },
        feedbackText: {
          "id.wrong":
            "Not yet. Count the grid in threes, “1 trip let 2 trip let 3 trip let 4 trip let”: the snare starts the second and fourth groups, and the kicks take the first and third step of two groups.",
        },
        srs: [{ family: "fam.rhy.meter", mode: "review-if-due" }],
        tests: [
          { name: "right", response: { answer: { choice: GRID_CELLS } }, expect: "pass" },
          {
            name: "the snare counted in fours: steps 5 and 11",
            response: { answer: { choice: ["kick:0", "kick:2", "kick:6", "kick:8", "snare:4", "snare:10"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "the snare row left empty",
            response: { answer: { choice: ["kick:0", "kick:2", "kick:6", "kick:8"] } },
            expect: "fail",
            feedback: ["id.missing"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Call and answer",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "call-and-answer",
        version: 1,
        role: "practice",
        prompt:
          "Bars 1 and 2 of the `kick:` line are the funk groove you took down: the call. Rewrite bars 3 and 4 as your answer: at least two kicks on an “&”, with no kick on the beat after. Then, if you like, move the bass to the same hits, or add a push, ghost notes or a roll.",
        skills: [
          { skill: "R10", w: 0.6 },
          { skill: "E14", w: 0.4 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "answer-off-the-beat",
            label:
              "In bars 3–4, at least two kicks start between the beats, each with no kick on the beat after it",
            required: true,
            skills: ["E14", "R10"],
            rule: "syncopation",
            track: "kick",
            min: 2,
            section: { bars: [3, 4] },
          },
          {
            id: "bass-with-the-kick",
            label: "At least 3 of every 4 bass notes land with a kick",
            required: false,
            skills: ["R10"],
            rule: "groove-lock",
            kick: "kick",
            bass: "bass",
            min: 0.75,
          },
          {
            id: "snare-ghosts",
            label: "At least two quiet snare hits: `.velocity()` times `.gain()` of .4 or less",
            required: false,
            skills: ["R10"],
            rule: "velocity-ghosts",
            track: "snare",
            min: 2,
            on: "any",
          },
          {
            id: "four-or-eight",
            label: "The piece is 4 to 8 bars long",
            required: false,
            skills: ["R10"],
            rule: "bars",
            min: 4,
            max: 8,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Check your lines against the item, then run it again.",
        },
        hints: ladder(
          "Only bars 3 and 4 of the kick change: two of their kicks should move off the beat. Where do those kicks land now?",
          "The `kick:` line has four bars inside `< >`: the last two are the answer. Move some of their hits to the “&” slots, and give the bass the same slots.",
          "An answer can turn the call around: beat 1, beat 2, then the “and” of 3, `[bd ~ bd ~ ~ bd ~ ~]`. Give the other bar a kick on an “and” too.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the kick of bars 3 and 4 moved off the beat",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: the bass locked, ghost notes, a pushed Rhodes and a roll",
            response: {
              code: callAnswer(
                ANSWER,
                bassOf(
                  'bass: n("<[1 ~ ~ 1 ~ ~ 1 ~] [4 ~ ~ ~ ~ 4 4 ~] [1 ~ 1 ~ ~ 1 ~ ~] [4 ~ ~ 4 ~ ~ 5 ~]>")',
                ),
              )
                .replace(
                  SNARE,
                  'snare: s("[~ ~ ~ sd] [sd ~ ~ ~] [~ ~ ~ sd] [sd ~ ~ ~]").velocity("[.3 1 .3 1]")',
                )
                .replace(
                  MAKE_CHORDS,
                  'chords: chord("<Dm7 G7 Dm7 G7>").voicing().early(1/8).s("rhodes").gain(.6)',
                ),
            },
            expect: "pass",
          },
          {
            // Every hit between the beats is followed at once by a kick on the next beat: nothing is left open.
            name: "eighths all through the answer: the beats are never left open",
            response: {
              code: callAnswer("[bd bd bd bd bd bd bd bd] [bd bd bd bd bd bd bd bd]", bassOf(MAKE_BASS)),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "kicks on the “and” of 1 and of 3, the beats after them open",
            response: { code: callAnswer("[bd bd ~ ~ bd bd ~ ~] [bd bd ~ ~ bd bd ~ ~]", bassOf(MAKE_BASS)) },
            expect: "pass",
          },
          {
            name: "the kick on all four beats",
            response: { code: callAnswer("[bd ~ bd ~ bd ~ bd ~] [bd ~ bd ~ bd ~ bd ~]", bassOf(MAKE_BASS)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
