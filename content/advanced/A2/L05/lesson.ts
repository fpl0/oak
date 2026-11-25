// A2.L05 Mix & Dynamics (spec: content/specs/A2.md). The mix is the balance of every part: how loud each one is,
// where it sits from left to right, and how much room is around it. The tune sits on top, the chords under it,
// the bass under both. `.gain()` has set loudness since U01; here it sets a balance, counted in decibels (halving
// a part's gain turns it down 6 dB: 20·log10(.5) = −6.02). `.pan()` gives a part its side (0 left, 1 right,
// superdough's StereoPanner at 2·pan − 1), `.room()` its depth, `.compressor()` turns a part's loud moments down
// so it sits steadier, and `.postgain()` sets a level after the effects. `.duckorbit()` is named once, in the
// Make's prose.
//
// Written for the learner at the gate (AUTHORING §20.1): A2 opens after U10.CP and A1.L07, so a learner here may
// not have met dominant sevenths, swing or the blues (U11), `.velocity()` (U13.L02) or `.pan()` (U14.L06; this is
// its other site). The loop is the A2 loop (A minor, 90 BPM, Am F C G over `band.aeolian-4bar`'s drums) with a
// strings pad above the chords.
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: S4 and the Make read the effective level of each note
//   (gain × velocity × postgain) with `level-balance`: the chords sit 3 to 18 dB under the tune where the two
//   sound together. A part more than 24 dB under the loudest one is left out by the grader, so chords turned
//   down to nothing are "not heard", never "under the tune". Pan, room and compression are heard and free: they
//   are never counted as level (compression does change loudness; the brief asks for levels by `.gain()`).
// - each pins WRONG answers that use the right function (the chords halved once, which only makes them level with
//   the tune; the chords turned down 22 dB, too far to carry; the chords panned or compressed instead of lowered)
//   and passes three or more OTHER right answers (another amount inside the window, the tune raised instead,
//   `.postgain()`, a whole mix with pan and room).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 90;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The A2 loop's bass: the roots of Am F C G, low. */
const bass = (tail = "") => `bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)${tail}`;
const BASS = bass();
/** Am F C G as close triads that move by the shortest way (A C E, F A C, C E G, G B D), from C3 to E4. */
const CHORD_DEGREES = "<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>";
const chords = (tail: string) => `chords: n("${CHORD_DEGREES}").scale("A3:minor").s("piano")${tail}`;
/** A held pad above the chords: the root and 5th of each chord (A E | F C | C G | G D), A4 to D5. */
const PAD_DEGREES = "<[0,4] [-2,2] [-5,-1] [-1,3]>";
const pad = (tail: string) => `pad: n("${PAD_DEGREES}").scale("A4:minor").s("strings")${tail}`;
/** E C A | C A | E C E | B G: every note on a beat is in its chord. */
const TUNE = "<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>";
const tune = (tail: string) => `mel: n("${TUNE}").scale("A4:minor").s("square").lpf(2000)${tail}`;

/** The compressor of the hook: threshold −20 dB, ratio 4:1, knee 10 dB, attack 2 ms, release 100 ms. */
const COMP = '.compressor("-20:4:10:.002:.1")';

/** The A2 loop unbalanced: the chords and the pad over the tune, everything in the middle. */
const UNBALANCED = code(bass(".gain(.8)"), chords(".gain(.8)"), pad(".gain(.6)"), tune(".gain(.3)"));
/** Mixed: the tune on top and compressed, the chords under it a little left, the pad under them, right and back. */
const MIXED = code(
  bass(".gain(.8)"),
  chords(".gain(.35).pan(.35).room(.3)"),
  pad(".gain(.2).pan(.65)"),
  tune(`.gain(.6)${COMP}`),
);

/** S2: the chords loud, the tune soft. */
const TUNE_UNDER = code(BASS, chords(".gain(.8)"), tune(".gain(.3)"));

/** S3: the chords alone, two bars loud and two bars at a quarter of the level, the bars left and right in turn. */
const LEVELS_AND_SIDES = code(chords('.gain("<.8 .8 .2 .2>").pan("<0 1>")'));

/** S4: the chords cover the tune. */
const ON_TOP_STARTER = code(BASS, chords(".gain(⟪.8⟫)"), tune(".gain(.4)"));
const onTop = (chordsTail: string, tuneTail = ".gain(.4)") => code(BASS, chords(chordsTail), tune(tuneTail));
const ON_TOP_SOLUTION = onTop(".gain(.2)");

/** The one rule of S4 and of the Make: the chords under the tune, still heard. */
const TUNE_ON_TOP: RubricRule = {
  id: "tune-on-top",
  label: "The tune on top: the chords 3 to 18 dB under it where both play, still heard",
  required: true,
  skills: ["D10"],
  rule: "custom",
  fn: "level-balance",
  params: { louder: "mel", quieter: "chords", minDb: 3, maxDb: 18 },
};

/** S5: the tune with loud notes on beats 1 and 3 and soft ones on 2 and 4 (about 9.5 dB apart). */
const UNEVEN = '.gain("[.9 .3]*2")';
const RAW = code(tune(UNEVEN));
const SQUEEZED = code(tune(`${UNEVEN}${COMP}`));

/** S6: the bass far too loud for its place: 10.5 dB over the tune, every other part turned down. */
const BASS_TOO_LOUD = code(bass(".gain(1)"), chords(".gain(.15)"), pad(".gain(.1)"), tune(".gain(.3)"));

/** The Make: every part at the same level, everything in the middle. */
const LEVEL = code(bass(".gain(.5)"), chords(".gain(.5)"), pad(".gain(.5)"), tune(".gain(.5)"));
const mixed = (chordsTail: string, padTail = ".gain(.5)", tuneTail = ".gain(.5)") =>
  code(bass(".gain(.5)"), chords(chordsTail), pad(padTail), tune(tuneTail));

/**
 * S8 (Oak 2.0, Foreground, Middle Ground, Background): eight bars on one chord, Am, so the background can repeat bar
 * for bar. The tune changes in every bar (E C A | C A | E C E | C E | E A | E C G | E D C B | A); the chords and the
 * bass play the same bar eight times. `depth-layers` reads the bars: the background parts (chords, bass) mostly
 * repeat, the front (mel) changes more than each of them, and one background part steps forward, louder by 3 dB or
 * more or half again as busy, in one bar of the eight and settles back (Oak's thresholds, in the rule, never shown
 * to the learner). It needs eight bars rendered.
 */
const FRONT_TUNE = "<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [2 ~ 4 ~] [4 ~ 7 ~] [4 2 6 ~] [4 3 2 1] [0 ~ ~ ~]>";
const front = (tune = FRONT_TUNE) => `mel: n("${tune}").scale("A4:minor").s("square").lpf(2000).gain(.5)`;
const BACK_CHORDS = "[0,2,4]@3 [0,2,4]";
const backChords = (pattern: string, gain: string) =>
  `chords: n("${pattern}").scale("A3:minor").s("piano").gain(${gain})`;
const BACK_BASS = 'bass: note("a1 ~ a1 [~ a1]").s("sawtooth").lpf(400).gain(.6)';
const depth = (chordsLine: string, bassLine = BACK_BASS, melLine = front()) =>
  code(bassLine, chordsLine, melLine);
const DEPTH_STARTER = depth(backChords(BACK_CHORDS, "⟪.25⟫"));
/** Bar 8: the chords twice as loud, 6 dB up, then back. */
const DEPTH_SOLUTION = depth(backChords(BACK_CHORDS, '"<.25 .25 .25 .25 .25 .25 .25 .5>"'));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.aeolian-4bar", tracks: ["drums"] } as const;

export default defineLesson({
  id: "A2.L05",
  version: 5,
  title: "Mix & Dynamics",
  objective: "I can balance a mix: the tune on top, every part with its own level, side and room.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D10"],
  practises: [],
  terms: [
    { id: "term.mix", step: "S3" },
    { id: "term.compression", step: "S5" },
    { id: "term.foreground", step: "S8" },
  ],
  canDo: ["cd.code.mix"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Stacked, then balanced",
      minutes: 0.5,
      ui: { panels: ROLL, band: DRUMS },
      example: { id: "hook", code: MIXED, bars: 4 },
      exercise: {
        kind: "listen",
        id: "stacked-then-balanced",
        version: 1,
        role: "practice",
        prompt:
          "Both loops play the same notes on the same sounds. Listen for the loop where you can follow the tune without searching for it.",
        skills: [{ skill: "D10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: UNBALANCED,
            caption: "Loop 1: every part from the middle.",
            bars: 4,
          },
          {
            code: MIXED,
            caption: "Loop 2: the same notes. With headphones, listen for the side each part comes from.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "What gets lost?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "what-gets-lost",
        version: 1,
        role: "practice",
        prompt:
          "The chords play at `.gain(.8)` and the tune at `.gain(.3)`. Predict which part will be hard to follow. Pick it, then listen.",
        skills: [{ skill: "D10", w: 1 }],
        hints: null,
        tests: [],
        code: TUNE_UNDER,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "tune", label: "The tune" },
          { id: "bass", label: "The bass" },
          { id: "nothing", label: "Nothing: every part is clear" },
        ],
        correct: ["tune"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Levels and sides",
      minutes: 1,
      ui: { panels: NONE },
      example: { id: "levels-and-sides", code: LEVELS_AND_SIDES, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "levels-and-sides",
        version: 1,
        role: "practice",
        prompt:
          "Loudness is counted in decibels (dB): halve a part's `.gain()` and it drops 6 dB. `.pan()` places a part between left (0) and right (1). Listen with headphones to the four bars of chords. Answer two questions: how many dB quieter bars 3 and 4 are, and which bars come from the left.",
        skills: [{ skill: "D10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the halvings from the level of bars 1 and 2 down to bars 3 and 4, 6 dB for each. Then listen with headphones for the ear each bar arrives in.",
        },
        hints: ladder(
          "Count the halvings from .8 down to .2, one at a time. How many are there?",
          "Each halving is 6 dB. On `.pan()`, 0 is the far left and 1 the far right; `<0 1>` takes one value a bar.",
          "Halving once gives .4, which is 6 dB down. Go one halving further.",
        ),
        code: { starter: LEVELS_AND_SIDES },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt:
              "Bars 3 and 4 play at `.gain(.2)`, bars 1 and 2 at `.gain(.8)`. How many dB quieter are bars 3 and 4?",
            correct: 12,
          },
          {
            q: "choice",
            prompt: "Which bars come from the left?",
            options: [
              { id: "odd", label: "Bars 1 and 3" },
              { id: "even", label: "Bars 2 and 4" },
              { id: "middle", label: "None: all four come from the middle" },
            ],
            correct: ["odd"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["odd"], number: 12 } }, expect: "pass" },
          {
            name: "one halving counted",
            response: { answer: { choice: ["odd"], number: 6 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the sides swapped",
            response: { answer: { choice: ["even"], number: 12 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Put the tune on top",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "put-the-tune-on-top",
        version: 1,
        role: "check",
        prompt:
          "The chords cover the tune. Change the `.gain()` levels so the chords sit 3 to 18 dB under the tune: quieter than it, still clearly heard. Panning does not count. Done when the tune leads and the chords are still there under it.",
        skills: [{ skill: "D10", w: 1 }],
        code: { starter: ON_TOP_STARTER },
        reference: { solutions: [ON_TOP_SOLUTION], bars: 4 },
        matcher: { m: "rubric", rules: [TUNE_ON_TOP] },
        target: { audible: true },
        feedbackText: {
          "rubric.unmet":
            "Not met yet: {label}. Listen to the chords against the tune: the tune should lead, and the chords should still be there underneath it. Change the levels, not the sides.",
        },
        hints: ladder(
          "Compare the `.gain()` of the chords line with the tune's. Which line is louder now?",
          "Each line's `.gain()` sets its level. The chords need to sit a few dB under the tune: more than level with it, less than gone.",
          "From .8, one halving brings the chords only level with the tune. They need to go further, but not so far that they vanish.",
        ),
        tests: [
          { name: "reference", response: { code: ON_TOP_SOLUTION }, expect: "pass" },
          {
            name: "the chords a little higher: 4 dB under",
            response: { code: onTop(".gain(.25)") },
            expect: "pass",
          },
          {
            name: "the tune raised instead, the chords lowered a little",
            response: { code: onTop(".gain(.5)", ".gain(.8)") },
            expect: "pass",
          },
          {
            name: "the level set after the effects with .postgain()",
            response: { code: onTop(".gain(.3).postgain(.8)") },
            expect: "pass",
          },
          {
            name: "lowered, panned and given room",
            response: { code: onTop(".gain(.15).pan(.3).room(.3)", ".gain(.4).pan(.6)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: onTop(".gain(.8)") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, halved once: level with the tune",
            response: { code: onTop(".gain(.4)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function, not far enough: 1 dB under",
            response: { code: onTop(".gain(.35)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "turned down until the chords are not heard",
            response: { code: onTop(".gain(.02)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "panned, not lowered",
            response: { code: onTop(".gain(.8).pan(.2)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Which sits steadier?",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-sits-steadier",
        version: 1,
        role: "practice",
        prompt:
          "Listen to card A and card B: the tune with loud notes on beats 1 and 3 and soft ones on 2 and 4. One card adds `.compressor()`. Pick the card where the loud and soft notes are closer in level, so the line sits steadier.",
        skills: [{ skill: "D10", w: 1 }],
        hints: ladder(
          "Listen to the jump between beat 1 and beat 2 in each card.",
          "In one card the soft notes almost disappear behind the loud ones; in the other they keep up.",
          "Play card B, then card A, and follow the soft note on beat 4 of bar 1.",
        ),
        stimulus: { src: "code", code: RAW, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "raw", label: "Card A", audio: RAW },
            { id: "squeezed", label: "Card B", audio: SQUEEZED },
          ],
        },
        correct: { choice: ["squeezed"] },
        feedbackText: {
          "id.wrong":
            "Card A is the tune as written: its loud notes jump out over the soft ones. In card B the loud notes are turned down as they play, so the two levels sit closer.",
        },
        tests: [
          { name: "the steadier card", response: { answer: { choice: ["squeezed"] } }, expect: "pass" },
          {
            name: "the card as written",
            response: { answer: { choice: ["raw"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "What is too loud?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "what-is-too-loud",
        version: 1,
        role: "check",
        prompt: "Listen to the loop: one part plays far too loud for its place. Pick that part.",
        skills: [{ skill: "D10", w: 1 }],
        hints: [
          {
            text: "Listen for the part you hear before anything else, the one that covers the others. Which is it?",
          },
          {
            text: "The tune is one note at a time, high; the chords and the pad are blocks in the middle; the bass is one note a bar, low.",
          },
          { text: "Hear it again, slower, and listen to the bottom of the sound.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: BASS_TOO_LOUD, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "bass", label: "The bass" },
            { id: "chords", label: "The chords" },
            { id: "tune", label: "The tune" },
          ],
        },
        correct: { choice: ["bass"] },
        feedbackText: {
          "id.wrong":
            "Not this one. The low notes, one a bar, cover everything: the bass, more than 10 dB above the tune, fills the low end and pushes the rest back.",
        },
        srs: [{ family: "fam.snd.roles", mode: "review-if-due" }],
        tests: [
          { name: "the bass", response: { answer: { choice: ["bass"] } }, expect: "pass" },
          {
            name: "the chords",
            response: { answer: { choice: ["chords"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "the tune",
            response: { answer: { choice: ["tune"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      // Oak 2.0 (W2): the book's Foreground, Middle Ground, Background. Placed before the Make (step ids are never
      // renumbered).
      id: "S8",
      kind: "modify",
      title: "Front, middle, back",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "front-middle-back",
        version: 1,
        role: "check",
        prompt:
          "The tune changes in every bar; the chords and the bass play the same bar eight times. Make the chords step forward for one bar of the eight, louder or busier, and settle back in the next. Keep the tune and the bass as they are. Done when the chords come forward in one bar only.",
        skills: [{ skill: "D10", w: 1 }],
        code: { starter: DEPTH_STARTER },
        reference: { solutions: [DEPTH_SOLUTION], bars: 8 },
        // The tune is kept (an `events` match on `mel`), and the depth is read by `depth-layers`.
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
            {
              m: "rubric",
              rules: [
                {
                  id: "front-middle-back",
                  label:
                    "The chords and the bass repeat behind a tune that changes more, and one of them comes forward for one bar",
                  required: true,
                  skills: ["D10"],
                  rule: "custom",
                  fn: "depth-layers",
                  params: { front: "mel", back: ["chords", "bass"] },
                },
              ],
            },
          ],
        },
        target: { audible: true },
        feedbackText: {
          "rubric.unmet":
            "Not yet: {label}. Listen to the chords across the eight bars: they should sound the same in seven of them and stand out in one.",
        },
        hints: ladder(
          "Listen to the eight bars of chords. Does any bar stand out from the others?",
          "A part comes forward when it gets louder or busier. `< >` gives a value or a pattern to each bar in turn: eight entries, one a bar.",
          "Write the chords' `.gain()` as eight values inside `< >`, seven the same and one higher.",
        ),
        tests: [
          { name: "reference", response: { code: DEPTH_SOLUTION }, expect: "pass" },
          {
            name: "forward in bar 4 instead",
            response: { code: depth(backChords(BACK_CHORDS, '"<.25 .25 .25 .5 .25 .25 .25 .25>"')) },
            expect: "pass",
          },
          {
            name: "busier for one bar: eighth-note chords in bar 8",
            response: {
              code: depth(
                backChords(
                  `<[${BACK_CHORDS}] [${BACK_CHORDS}] [${BACK_CHORDS}] [${BACK_CHORDS}] [${BACK_CHORDS}] [${BACK_CHORDS}] [${BACK_CHORDS}] [0,2,4]*8>`,
                  ".25",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "the bass steps forward instead, the chords left alone",
            response: {
              code: depth(
                backChords(BACK_CHORDS, ".25"),
                'bass: note("a1 ~ a1 [~ a1]").s("sawtooth").lpf(400).gain("<.6 .6 .6 .6 .6 .6 .6 1.2>")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: depth(backChords(BACK_CHORDS, ".25")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, the chords louder in every bar: nothing steps forward",
            response: { code: depth(backChords(BACK_CHORDS, '"<.5 .5 .5 .5 .5 .5 .5 .5>"')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "forward in two bars of the eight",
            response: { code: depth(backChords(BACK_CHORDS, '"<.25 .25 .25 .5 .25 .25 .25 .5>"')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chords step forward, and the tune's last bar is changed too",
            response: {
              code: depth(
                backChords(BACK_CHORDS, '"<.25 .25 .25 .25 .25 .25 .25 .5>"'),
                BACK_BASS,
                front("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [2 ~ 4 ~] [4 ~ 7 ~] [4 2 6 ~] [4 3 2 1] [0 ~ 2 ~]>"),
              ),
            },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "the chords raised by a hair",
            response: { code: depth(backChords(BACK_CHORDS, '"<.25 .25 .25 .25 .25 .25 .25 .27>"')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Mix it",
      minutes: 2.75,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "mix-it",
        version: 1,
        role: "practice",
        prompt:
          "Every part plays at `.gain(.5)` from the middle. Mix it: set the chords 3 to 18 dB under the tune, still heard. Then put the pad under the chords, give the chords a side with `.pan()`, and add room where it helps. It plays your song's last chorus. Done when the tune leads and the chords sit under it.",
        skills: [{ skill: "D10", w: 1 }],
        code: { starter: LEVEL },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          TUNE_ON_TOP,
          {
            id: "pad-under-chords",
            label: "The pad 1 to 18 dB under the chords",
            required: false,
            skills: ["D10"],
            rule: "custom",
            fn: "level-balance",
            params: { louder: "chords", quieter: "pad", minDb: 1, maxDb: 18 },
          },
          {
            id: "chords-to-a-side",
            label: "The chords given a `.pan()` other than .5, off the middle",
            required: false,
            skills: ["D10"],
            rule: "custom",
            fn: "control-set",
            params: { track: "chords", anyOf: [{ control: "pan", not: 0.5 }] },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Follow the tune as it plays and listen for any part that sits on top of it. Which one is it?",
          "Levels first: each line's `.gain()`. The chords belong a few dB under the tune; the pad a little under the chords.",
          "Start by halving the chords' level, twice if the tune still hides. Then give the chords and the pad a side each with `.pan()`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: LEVEL },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the chords 6 dB down", response: { code: mixed(".gain(.25)") }, expect: "pass" },
          { name: "the chords 12 dB down", response: { code: mixed(".gain(.12)") }, expect: "pass" },
          {
            name: "the tune raised instead",
            response: { code: mixed(".gain(.5)", ".gain(.4)", ".gain(1)") },
            expect: "pass",
          },
          { name: "beyond the brief: the hook's mix", response: { code: MIXED }, expect: "pass" },
          {
            name: "beyond the brief: sides, room, compression, and the tune ducking the pad",
            response: {
              code: code(
                bass(".gain(.7)"),
                chords(".gain(.3).pan(.3).room(.2)"),
                pad(".gain(.2).pan(.7).room(.5).orbit(2)"),
                tune(`.gain(.6)${COMP}.duckorbit(2).duckdepth(.4)`),
              ),
            },
            expect: "pass",
          },
          {
            name: "the chords louder than the tune",
            response: { code: mixed(".gain(.8)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function, too far: the chords 22 dB down",
            response: { code: mixed(".gain(.04)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chords turned down until they are not heard",
            response: { code: mixed(".gain(.02)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "sides and room, but every level the same",
            response: { code: mixed(".gain(.5).pan(.2).room(.3)", ".gain(.5).pan(.8)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chords compressed, not lowered",
            response: { code: mixed(`.gain(.5)${COMP}`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
