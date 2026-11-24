// A2.L04 Sampling (spec: content/specs/A2.md). A sample is a recording played back as a sound, and a drum break
// is a whole bar of a drummer in one recording. `.slice(n, pattern)` cuts it into n equal pieces and the pattern
// says which piece plays where: cut it up, and the same drummer plays a new groove. Oak's break (`s("brk")`) is
// Oak's own recording, rendered from public-domain one-shots and free to use (CC0); no sample of a real record
// appears anywhere in the lesson.
//
// Written for the learner at the gate (AUTHORING §20.1): A2 opens after U10.CP and A1.L07, so a learner here may not
// have met dominant sevenths, swing or the blues (U11), sevenths by name (U12), `.late()` (U13) or `.pan()` (U14,
// A2.L05). The loop is the A2 loop at the break's own tempo, 96 BPM (`BRK_BPM`, scripts/sounds/brk.ts), so the
// break needs no fitting: one bar of the recording is one bar of the loop, and `.loopAt()` is only named.
//
// The break as rendered (scripts/sounds/brk.ts BRK_GROOVE, sixteenth steps 0–15): kick on 1 (0), the "a" of 1 (3),
// 3 (8) and the "and" of 3 (10); snare on 2 (4) and 4 (12) with ghost notes (7, 9, 15); sixteenth hats; an open
// hat on the "and" of 4 (14). Cut in four, the pieces are the four beats: piece 0 holds the kick of beat 1, piece
// 1 the first snare, piece 2 the kicks of beat 3, piece 3 the second snare. Evaluated: `.slice(4, "0 2 1 3")`
// gives four events with begin 0, .5, .25, .75 (each with `end` and `_slices: 4`).
//
// The corrections-pass standard (AUTHORING §20.2):
// - S4 is graded by what plays: the `controls` matcher reads `begin` event by event on the drums (which piece of
//   the recording each beat plays), not the text. It pins wrong answers that use the right function (the swap
//   half done, the bar back to front, two halves in their own order, the right order turned down until it is not
//   heard) and passes three other right answers (`[ ]` around the pattern, `.splice()`, `.begin()`/`.end()`
//   written out, another level).
// - The Make's one required rule is `slices-reordered`: the break is cut into four or more pieces that play in an
//   order other than the recording's own. The starter, the right function in the recording's order, two halves,
//   `.chop(8)` alone, found sounds added over the break as recorded and the drums turned down until they are not
//   heard all fail.
// Feedback below rung 4 never names the answer.
//
// Sound pack v4 and the unit song (AUTHORING §23; content/unit-songs/A2.ts): this lesson unlocks Oak's six two-bar
// breaks (`snd.breaks`: funk 100, boom-bap 90, jungle 170, house 124, jazz 140, lo-fi 80, their pieces in
// sounds/pack/v4/breaks.json) and the found sounds (`snd.foley`: snap, swoosh, impact, scratch, drone and eleven
// `foley` knocks). S1–S5 keep `brk`, one bar at 96, as the first thing to cut up. S7 (added with the songs, placed
// before the Make, which keeps its id S6: step ids are never renumbered, contracts §11.7) plays the breaks against the
// song's 90 BPM: `brkboombap`, recorded at 90, fills each beat as it is; `brkjungle`, recorded at
// 170, sliced the same way runs out halfway through each beat; `.splice()` fits it by slowing it, and slower is lower
// (twice the speed is an octave up, A1.L01's doubling). The Make (exercise version 2) is re-keyed to that tempo and
// break, because it plays in the song's break section at the song's tempo: the boom-bap break cut into its eight beats
// (`.slice(8, "<[0 1 2 3] [4 5 6 7]>")`, the recording's own order, as the starter), the tune, and an empty `perc`
// line for found sounds in the gaps, the broken-cut habit of cutting knocks and slaps in between the drums (a
// suggestion, `uses snd.foley`). Version 1 played `brk` at 96 BPM; at 96 the song would run 6 BPM fast from this take
// on, and `brk` plays no part of the song's kit (a v4 break plays every drum part, contracts §5.11 rule 9).
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The A2 loop's bass: the roots of Am F C G. */
const BASS = 'bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)';
/** Am F C G as close triads that move by the shortest way (A C E, F A C, C E G, G B D). */
const CHORDS = 'chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("piano").gain(.5)';
/** E C A | C A | E C E | B G: every note on a beat is in its chord. */
const TUNE =
  'mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("A4:minor").s("square").lpf(2000).gain(.4)';

/** The break as recorded, one bar of it every bar. */
const RECORDED = 'drums: s("brk")';
/** Cut into four and played in new orders: as recorded, the kick again, the middle swapped, a stutter. */
const FLIPS = 'drums: s("brk").slice(4, "<[0 1 2 3] [0 1 0 3] [0 2 1 3] [0 1 [2 2] 3]>")';
const drums = (order: string, tail = "") => `drums: s("brk").slice(4, "${order}")${tail}`;

const AS_RECORDED = code(RECORDED, BASS, CHORDS);
const HOOK = code(FLIPS, BASS, CHORDS);

/** S2: the four pieces from the last to the first. */
const BACK_TO_FRONT = code(drums("3 2 1 0"));
/** S3: bar 1 in the recording's order, bar 2 with the first piece again on beat 3. */
const LOOK_INSIDE = code('drums: s("brk").slice(4, "<[0 1 2 3] [0 1 0 3]>")');

/** S4: the pieces in the recording's order; the two middle numbers are editable. */
const SWAP_STARTER = code('drums: s("brk").slice(4, "0 ⟪1 2⟫ 3")', BASS, CHORDS);
const swapped = (line: string) => code(line, BASS, CHORDS);
const SWAP_SOLUTION = swapped(drums("0 2 1 3"));

/** S5: the stimulus, the middle swapped, drums alone so the order is plain. */
const MIDDLE_SWAPPED = code(drums("0 2 1 3"));

/** S7 and the Make (S6) play at the song's tempo, 90 BPM: the tempo `brkboombap` was recorded at (breaks.json). */
const SONG_BPM = 90;
const songCode = (...lines: string[]) => `setcpm(${SONG_BPM}/4)\n\n${lines.join("\n")}`;
/** A two-bar break cut into its eight beats, played in the recording's order: bar 1's four beats, then bar 2's. */
const OWN_ORDER = "<[0 1 2 3] [4 5 6 7]>";

/** S7: two bars of each, at 90 BPM: the break recorded at 90, the one recorded at 170 cut the same way, and fitted. */
const AT_ITS_TEMPO = songCode(
  `const fits = s("brkboombap").slice(8, "${OWN_ORDER}")`,
  `const rushed = s("brkjungle").slice(8, "${OWN_ORDER}")`,
  `const fitted = s("brkjungle").splice(8, "${OWN_ORDER}")`,
  "",
  "drums: arrange([2, fits], [2, rushed], [2, fitted])",
);

/** The Make: the boom-bap break in its own order, an empty line for found sounds, the tune; the Band plays the rest. */
const boombap = (order: string, tail = "") => `drums: s("brkboombap").slice(8, "${order}")${tail}`;
const NO_FOUND_SOUNDS = 'perc: s("~")';
const MAKE_STARTER = songCode(boombap(OWN_ORDER), NO_FOUND_SOUNDS, TUNE);
const flipped = (drumsLine: string, perc = NO_FOUND_SOUNDS) => songCode(drumsLine, perc, TUNE);
/** Found sounds in the gaps: a snap after beat 2, a swoosh into the next bar. */
const FOUND = 'perc: s("~ ~ ~ snap ~ ~ ~ [~ swoosh]").gain(.6)';

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const BAND = { band: "band.aeolian-4bar", tracks: ["bass", "chords"] } as const;

export default defineLesson({
  id: "A2.L04",
  version: 4,
  title: "Sampling",
  objective: "I can cut a drum recording into pieces and play them back in an order of my own.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D11"],
  practises: [],
  terms: [
    { id: "term.sample", step: "S3" },
    { id: "term.chop", step: "S4" },
  ],
  canDo: ["cd.code.sampling"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One drummer, two grooves",
      minutes: 0.5,
      ui: { panels: ROLL },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-drummer-two-grooves",
        version: 1,
        role: "practice",
        prompt:
          "Count along with both loops. Loop 2 plays the same recording, cut into four and put back together in a new order each bar. Listen for whether loop 2 still sounds like one drummer playing.",
        skills: [{ skill: "D11", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: AS_RECORDED, caption: "Loop 1: the drum bar as it was recorded, four times.", bars: 4 },
          {
            code: HOOK,
            caption: "Loop 2: the same recording cut into four, in order, then a new order each bar.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Last piece first",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "last-piece-first",
        version: 1,
        role: "practice",
        prompt:
          '`.slice(4, …)` cuts the recording into four equal pieces, one a beat, numbered from 0 as `n` is. This line plays them "3 2 1 0". Predict what you will hear. Pick your answer, then listen.',
        skills: [{ skill: "D11", w: 1 }],
        hints: null,
        tests: [],
        code: BACK_TO_FRONT,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "beats", label: "The four beats in reverse order, each one still played forwards" },
          { id: "tape", label: "The whole bar played backwards, like a tape" },
          { id: "same", label: "The bar as it was recorded" },
        ],
        correct: ["beats"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "What each piece holds",
      minutes: 1,
      ui: { panels: ROLL },
      example: { id: "look-inside", code: LOOK_INSIDE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "what-each-piece-holds",
        version: 1,
        role: "practice",
        prompt:
          "Count the beats as it plays. Bar 1 plays the four pieces in their own order, the bar as recorded; bar 2 changes one number. Answer two questions: on which beat of bar 1 the first loud snare lands, and what plays on beat 3 of bar 2.",
        skills: [{ skill: "D11", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count one, two, three, four along with bar 1 and listen for the first loud snare. Then listen to beat 3 of bar 2: which beat of bar 1 does it sound like?",
        },
        hints: ladder(
          "Count one, two, three, four along with bar 1 and listen for the first loud snare. Does it come before or after the first kick?",
          "Each piece is one beat of the recording. Piece 0 is beat 1, so a number in the pattern names the beat it was cut from, minus one.",
          "Bar 2's pattern has one number twice. Find which beat plays it the second time.",
        ),
        code: { starter: LOOK_INSIDE },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "In bar 1, on which beat does the first loud snare land?", correct: 2 },
          {
            q: "choice",
            prompt: "In bar 2, what plays on beat 3?",
            options: [
              { id: "kick", label: "Beat 1 again: a kick" },
              { id: "snare", label: "A loud snare" },
              { id: "nothing", label: "Nothing" },
            ],
            correct: ["kick"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 2, choice: ["kick"] } }, expect: "pass" },
          {
            name: "the snare on beat 3",
            response: { answer: { number: 2, choice: ["snare"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted the snare on beat 1",
            response: { answer: { number: 1, choice: ["kick"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Swap the middle",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "swap-the-middle",
        version: 1,
        role: "check",
        prompt:
          "The break plays its four pieces in their own order. Change the pattern in `.slice()` so beat 2 plays the piece recorded on beat 3, and beat 3 plays the piece recorded on beat 2. Keep beats 1 and 4 as they are.",
        skills: [{ skill: "D11", w: 1 }],
        code: { starter: SWAP_STARTER },
        reference: { solutions: [SWAP_SOLUTION], bars: 1 },
        matcher: { m: "controls", track: "drums", controls: [{ control: "begin", scale: "exact", tol: 0 }] },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "code.control-off":
            "Not yet: the pieces play in another order than the target's. Listen for where the first loud snare lands, and where the kick comes back.",
        },
        hints: ladder(
          "Only two numbers in the pattern need to change: the ones that choose what plays on beats 2 and 3. Which are they?",
          "The pattern names one piece a beat, counted from 0: its first number plays on beat 1, its second on beat 2.",
          "The first and last numbers stay. The piece recorded on beat 2 is numbered 1.",
        ),
        tests: [
          { name: "reference", response: { code: SWAP_SOLUTION }, expect: "pass" },
          {
            name: "the pattern in brackets",
            response: { code: swapped(drums("[0 2 1 3]")) },
            expect: "pass",
          },
          {
            name: "splice instead of slice",
            response: { code: swapped('drums: s("brk").splice(4, "0 2 1 3")') },
            expect: "pass",
          },
          {
            name: "the start and end of each piece written out",
            response: { code: swapped('drums: s("brk*4").begin("0 .5 .25 .75").end(".25 .75 .5 1")') },
            expect: "pass",
          },
          {
            name: "swapped and a little quieter",
            response: { code: swapped(drums("0 2 1 3", ".gain(.8)")) },
            expect: "pass",
          },
          {
            name: "unchanged: the recording's own order",
            response: { code: swapped(drums("0 1 2 3")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, half the swap: beat 3's piece twice",
            response: { code: swapped(drums("0 2 2 3")) },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "the right function, the whole bar back to front",
            response: { code: swapped(drums("3 2 1 0")) },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "the right function, two halves in their own order",
            response: { code: swapped('drums: s("brk").slice(2, "0 1")') },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "swapped, then turned down until it is not heard",
            response: { code: swapped(drums("0 2 1 3", ".gain(.02)")) },
            expect: "fail",
            feedback: ["eval.silent"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Which order?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-order",
        version: 1,
        role: "check",
        prompt:
          "Listen to the break alone, cut into four and played back in one order. Count the beats and pick the order you hear.",
        skills: [{ skill: "D11", w: 1 }],
        hints: [
          {
            text: "Count one, two, three, four along with it. On which beat does the first loud snare come?",
          },
          {
            text: "As recorded, a loud snare lands on beats 2 and 4 and a kick on beats 1 and 3. Listen for which of those moved.",
          },
          { text: "Hear it again, slower, and count the beats.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: MIDDLE_SWAPPED, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: true, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "recorded", label: "As recorded" },
            { id: "middle", label: "The two middle beats swapped" },
            { id: "again", label: "Beat 2 played again on beat 4" },
          ],
        },
        correct: { choice: ["middle"] },
        feedbackText: {
          "id.wrong":
            "Not this one. Count the beats again and listen for the first loud snare: in this order it is not where the recording put it.",
        },
        tests: [
          { name: "the middle swapped", response: { answer: { choice: ["middle"] } }, expect: "pass" },
          {
            name: "as recorded",
            response: { answer: { choice: ["recorded"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "beat 2 again on beat 4",
            response: { answer: { choice: ["again"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "investigate",
      title: "Its own tempo",
      minutes: 1,
      ui: { panels: ROLL },
      example: { id: "three-fits", code: AT_ITS_TEMPO, bars: 6 },
      exercise: {
        kind: "run-investigate",
        id: "its-own-tempo",
        version: 1,
        role: "practice",
        bpm: SONG_BPM,
        prompt:
          "Count the beats as it plays, at 90 beats a minute. Bars 1–2 play `brkboombap`, recorded at 90; bars 3–4 play `brkjungle`, recorded at 170, cut the same way; bars 5–6 fit it with `.splice()`. Answer two questions: which break fills its beats as recorded, and how much higher `.speed(2)` plays a piece.",
        skills: [{ skill: "D11", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Listen to bars 3–4: each piece ends before its beat does, and a gap follows. Then think of Waves & Harmonics: twice as fast is twice the repeats a second.",
        },
        hints: ladder(
          "Listen for the bars where the drums leave a gap before the next beat comes. Which break plays there?",
          "A break recorded faster than the song runs out before its beat ends. Twice the speed doubles how many times a second every note repeats.",
          "Doubling the repeats a second lifts a note one octave. Count the half steps in one octave.",
        ),
        code: { starter: AT_ITS_TEMPO },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which break fills each beat just as it was recorded?",
            options: [
              { id: "boombap", label: "Bars 1–2: `brkboombap`" },
              { id: "jungle", label: "Bars 3–4: `brkjungle`, cut the same way" },
              { id: "both", label: "Both" },
            ],
            correct: ["boombap"],
          },
          {
            q: "number",
            prompt: "`.speed(2)` plays a piece twice as fast. How many half steps higher does it sound?",
            correct: 12,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["boombap"], number: 12 } }, expect: "pass" },
          {
            name: "the jungle break for the one that fits",
            response: { answer: { choice: ["jungle"], number: 12 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "twice as fast counted as two half steps",
            response: { answer: { choice: ["boombap"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Flip the break",
      minutes: 2.75,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "code-make",
        id: "flip-the-break",
        version: 2,
        role: "practice",
        bpm: SONG_BPM,
        prompt:
          "Play the eight pieces on the `drums` line in a new order: repeat a kick, move a snare or play a piece twice in a row. Found sounds (`snap`, `swoosh`, `impact`) on the `perc` line are up to you. This loop plays in your song's break. Done when the pieces play in an order other than the recording's.",
        skills: [{ skill: "D11", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "break-flipped",
            label: "The break cut into 4 or more pieces that play in an order other than the recording's",
            required: true,
            skills: ["D11"],
            rule: "custom",
            fn: "slices-reordered",
            // The break cut into four or more pieces: the grader reads the cut (1 / (end − begin)), so
            // `.slice(8, "<[0 1 0 3] [4 5 6 7]>")` (the brief's "repeat a kick") is eight pieces and two halves fail.
            params: { track: "drums", minSlices: 4 },
          },
          {
            id: "found-sounds",
            label:
              "A found sound heard in your code: `snap`, `swoosh`, `impact`, `scratch`, `drone` or `foley`",
            required: false,
            skills: ["D11"],
            rule: "uses",
            tool: "snd.foley",
          },
          {
            id: "tune-on-top",
            label: "The drums and the tune both still play",
            required: false,
            skills: ["D11"],
            rule: "tracks",
            min: 2,
            roles: ["drums", "melody"],
          },
        ],
        // The override serves every rule of the rubric, the suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "A new drummer on the same kit plays the same pieces in a different order. Which numbers decide the order?",
          'The pattern in `.slice()` names one piece a beat: "<[0 1 2 3] [4 5 6 7]>" plays bar 1 of the break, then bar 2. Piece 0 holds the first kick, piece 1 the first snare.',
          "Change one number in the first bar's four, so a piece plays where another one was recorded. Then add a `snap` on the `perc` line.",
        ),
        tests: [
          {
            name: "minimal: the middle two beats of each bar swapped",
            response: { code: flipped(boombap("<[0 2 1 3] [4 6 5 7]>")) },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kick repeated on beat 3",
            response: { code: flipped(boombap("<[0 1 0 3] [4 5 6 7]>")) },
            expect: "pass",
          },
          {
            name: "sixteen pieces with a stutter, and found sounds in the gaps",
            response: {
              code: flipped(
                'drums: s("brkboombap").slice(16, "<[0 1 2 3 4 5 6 7] [8 9 10 11 [12 12] 13 14 15]>")',
                FOUND,
              ),
            },
            expect: "pass",
          },
          {
            name: "splice instead of slice",
            response: { code: flipped('drums: s("brkboombap").splice(8, "<[0 2 1 3] [4 5 6 7]>")') },
            expect: "pass",
          },
          {
            name: "beyond the brief: the funk break fitted with splice, a stutter, foley knocks and room",
            response: {
              code: flipped(
                'drums: s("brkfunk").splice(16, "<[0 1 2 3 0 1 6 7] [8 9 10 11 12 13 [14 14] [15 15]]>").room(.2)',
                'perc: s("~ ~ ~ foley ~ ~ foley ~").n("<3 7>").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the right function, the recording's own order in sixteen pieces",
            response: {
              code: flipped(
                'drums: s("brkboombap").slice(16, "<[0 1 2 3 4 5 6 7] [8 9 10 11 12 13 14 15]>")',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function, two pieces only",
            response: { code: flipped('drums: s("brkboombap").slice(2, "<1 0>")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "cut into eight with chop, still in order",
            response: { code: flipped('drums: s("brkboombap").loopAt(2).chop(8)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "found sounds added, the break left in its own order",
            response: { code: flipped(boombap(OWN_ORDER), FOUND) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "flipped, then turned down until it is not heard",
            response: { code: flipped(boombap("<[0 2 1 3] [4 6 5 7]>", ".gain(.02)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
