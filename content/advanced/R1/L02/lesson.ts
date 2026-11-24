// R1.L02 Swing Ratios (spec: content/specs/R1.md). Swing is a ratio: the long note of each pair against the short
// one. 1:1 is straight, 3:2 a light swing, 2:1 the triplet swing of the blues, 3:1 a hard swing, and
// `.swingBy(a, n)` sets it with one number: the ratio is (1 + a) / (1 − a) (content-kit `swingRatio`,
// `SWING_FEELS`). The same call swings the sixteenths instead of the eighths when the bar is cut into eight slices
// (`.swingBy(a, 8)` in 4/4): the lazy, leaning sixteenths of neo-soul. A patterned amount changes it bar by bar.
//
// Written for the learner at the gate (AUTHORING §20.1): the swing call and the word swing are U11.L07's, the
// triplet behind 2:1 is U13.L05's; both are called back, never retaught. What is new is the amount as a number the
// learner chooses, and the slice count that moves the swing onto the sixteenths. Felt (S2), then read (S3), then
// heard (S4), then coded (S5, S6).
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: the hi-hat's sixteenth pairs must measure long–short inside the
//   window (`swing`, subdivision 16), and the hi-hat must still play its sixteen hits (the rhythm on the
//   straightened grid);
// - each graded step pins a WRONG answer that uses the right function: `.swingBy(.2, 4)` and `.swingBy(1/3, 4)`
//   (eighth swing: the sixteenth pairs stay even), `.swingBy(.1, 8)` (too light to name), the right call on a
//   silent hi-hat, the right call on a line of quarter notes;
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the call.
import {
  defineLesson,
  type HintLadder,
  type IdentifyEx,
  type RubricRule,
  SWING_RATIO_OPTIONS,
} from "@oak/content-kit";

const BPM = 88;
const tempo = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const code = (...lines: string[]) => `${tempo(BPM)}${lines.join("\n")}`;
/** Seconds per beat at the lesson's tempo. */
const BEAT_SEC = 60 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The neo-soul lean of the hook: sixteenths at 3:2. */
const LEAN = ".swingBy(.2, 8)";
/** The kick pushes on the "a" of 2 and the "and" of 3. */
const KICK = 'kick: s("bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const hats = (call = "") => `hats: s("hh*16").velocity("[1 .4 .7 .4]*4")${call}.gain(.5)`;
/** Rhodes on the "and" of 1 and the "and" of 3: eighth places, which sixteenth swing never moves. */
const chords = (call = "") =>
  `chords: chord("<Am7 Dm7>").voicing().struct("~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~")${call}.s("rhodes").gain(.5)`;
const bass = (call = "") =>
  `bass: n("<0 3>").struct("x ~ ~ ~ ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~").scale("A1:minor")${call}.s("fingerbass")`;
const groove = (call: string) => code(`${KICK}${call}`, SNARE, hats(call), chords(call), bass(call));

const GROOVE_LIGHT = groove(LEAN);
const GROOVE_STRAIGHT = groove("");
const GROOVE_GROWING = groove('.swingBy("<0 .1 .2 .33>", 8)');

/** S2: eighth-note hi-hats at 2:1 over kick and snare. */
const TAP_GROOVE = code(
  'kick: s("bd ~ bd ~")',
  SNARE,
  'hats: s("hh*8").swingBy(1/3, 4).gain(.6)',
  'bass: n("<0 3>").struct("x ~ ~ x").scale("A1:minor").s("fingerbass")',
);
/** Seconds from the start of a tap stimulus: positions given in beats (0-based, across bars). */
const at = (beats: number[]) => beats.map((b) => Math.round(b * BEAT_SEC * 1000) / 1000);
const beatsOf = (inside: number[], bars: number) =>
  Array.from({ length: bars * 4 }, (_, b) => inside.map((f) => b + f)).flat();
const SWUNG_TAPS = at(beatsOf([0, 2 / 3], 2));

/** S3: the eighth-note hi-hat alone, swung by an amount the learner changes. */
const READ_SWING = code('hats: s("hh*8").swingBy(.2, 4).gain(.6)', 'kick: s("bd ~ bd ~")');

/** S4: four grooves, each at its own tempo; the hats (and the bass) swing by one amount. */
const earGroove = (bpm: number, amount: string, slices: 4 | 8) =>
  `${tempo(bpm)}${[
    'kick: s("bd ~ bd ~")',
    SNARE,
    `hats: s("hh*${slices === 8 ? 16 : 8}").swingBy(${amount}, ${slices}).gain(.6)`,
    `bass: note("<[a1 ~ a1 a2 g1 ~ e2 g2] [d2 ~ d2 d3 c2 ~ a1 c2]>").swingBy(${amount}, ${slices}).s("fingerbass")`,
  ].join("\n")}`;
const earHints = (): HintLadder =>
  ladder(
    "Listen to the hi-hat alone and compare the two hits of each pair: the first is longer by some amount.",
    "Even pairs are straight. A first note one and a half times the second is a light lean; twice as long is the triplet feel of the blues; three times as long is hard.",
    "Count “1 trip let” silently with each beat: if the short hit lands on “let”, the long note is twice the short one.",
  );
const feel = (id: string, prompt: string, stimulus: string, answer: string, why: string): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "R13", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: stimulus, bars: 4, showCode: false },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: { ui: "choice", options: [...SWING_RATIO_OPTIONS] },
  correct: { choice: [answer] },
  feedbackText: { "id.wrong": why },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: "the neighbouring feel",
      response: { answer: { choice: [answer === "light" ? "triplet" : "light"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/** S5: the groove whose hi-hat swings its eighths; only the hi-hat has sixteenth pairs to swing. */
const S5_KICK = 'kick: s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~")';
const S5_BASS =
  'bass: n("<0 3>").struct("x ~ ~ ~ ~ ~ ~ ~ x ~ x ~ ~ ~ ~ ~").scale("A1:minor").s("fingerbass")';
const S5_STARTER = code(
  S5_KICK,
  SNARE,
  'hats: s("hh*16").velocity("[1 .4 .7 .4]*4")⟪.swingBy(1/3, 4)⟫.gain(.5)',
  chords(),
  S5_BASS,
);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const s5 = (hatsLine: string) => code(S5_KICK, SNARE, hatsLine, chords(), S5_BASS);
const S5_SOLUTION = s5(hats(LEAN));
const SIXTEENTHS_LEAN: RubricRule = {
  id: "sixteenths-lean",
  label: "The hi-hat's sixteenth pairs are long-short, between a light lean and about 2:1",
  required: true,
  skills: ["R13"],
  rule: "swing",
  track: "hats",
  subdivision: 16,
  ratio: [1.35, 2.4],
};

/** S6: the Band plays the chords (i VI III VII in A minor); the drums and the bass are the learner's, straight. */
const MAKE_BASS = (call = "") =>
  `bass: n("<0 5 2 6>").struct("x ~ ~ ~ ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~").scale("A1:minor")${call}.s("fingerbass")`;
const MAKE_STARTER = code(KICK, SNARE, hats(), MAKE_BASS());
const make = (call: string) => code(`${KICK}${call}`, SNARE, hats(call), MAKE_BASS(call));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R1.L02",
  version: 4,
  title: "Swing Ratios",
  objective:
    "I can set how hard a groove swings, from straight to hard swing, on the eighths or the sixteenths.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R13"],
  terms: [{ id: "term.swing-ratio", step: "S3" }],
  canDo: ["cd.code.swing-amount"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three leans",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "light-lean", code: GROOVE_LIGHT, bars: 4 },
      exercise: {
        kind: "listen",
        id: "three-leans",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the hi-hat's pairs of sixteenths in the three loops; only their spacing changes. Notice which loop sits back and leans and which feels stiff. In the third loop, listen for the bar where the lean starts to bounce.",
        skills: [{ skill: "R13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: GROOVE_LIGHT,
            caption: "Hear the hi-hat's sixteenths in pairs. Is each pair even?",
            bars: 4,
          },
          {
            code: GROOVE_STRAIGHT,
            caption: "The same notes. Does the groove still sit back?",
            bars: 4,
          },
          {
            code: GROOVE_GROWING,
            caption: "Four bars, the spacing a little different in each.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the long and short",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-swing",
        version: 1,
        role: "practice",
        prompt:
          "Tap with every hi-hat hit, the short ticking sound on top. It plays two hits a beat, long then short: the second comes late, just before the next beat. Two bars, sixteen taps in all. Done when your taps land with the hi-hat.",
        skills: [{ skill: "R13", w: 1 }],
        hints: ladder(
          "Listen to the hi-hat alone: the second hit in each beat sits nearer the next beat than the one before.",
          "Each beat holds two hits: one on the beat, one late in the beat, just before the next.",
          "Say “1 trip let” for each beat and tap on “1” and on “let”.",
        ),
        mode: "along",
        stimulus: { src: "code", code: TAP_GROOVE, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 2,
        target: { track: "hats" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        tests: [
          { name: "with the swung hits", response: { taps: SWUNG_TAPS }, expect: "pass" },
          { name: "quarter notes only", response: { taps: at(beatsOf([0], 2)) }, expect: "fail" },
          { name: "straight eighths", response: { taps: at(beatsOf([0, 1 / 2], 2)) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Long against short",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "read-the-swing", code: READ_SWING, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "long-against-short",
        version: 1,
        role: "practice",
        prompt:
          "Run the hi-hat and read one beat on the roll. Change the swing amount, the first number in the swing call, to `1/3`, then to `.5`, running it each time. Then answer: where the second hit starts at `.2`, and how many times longer the long hit is at `1/3`.",
        skills: [{ skill: "R13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read one beat on the roll at each amount: where the second hit starts, and how long the first hit is against the second.",
        },
        hints: ladder(
          "At `.2`, read on the roll where the second hit of a beat starts: halfway, or later.",
          "The call moves the second hit of each pair later by half the amount, measured in beats: `.2` moves it a tenth of a beat.",
          "At `1/3` the second hit starts two thirds of the way through the beat, so the long hit lasts two thirds and the short one third.",
        ),
        code: { starter: READ_SWING },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "At `.2`, where in the beat does the second hit start?",
            options: [
              { id: "half", label: "Halfway through the beat" },
              { id: "sixty", label: "60% of the way through the beat" },
              { id: "two-thirds", label: "Two thirds of the way through the beat" },
            ],
            correct: ["sixty"],
          },
          {
            q: "number",
            prompt: "At `1/3`, how many times longer is the long hit than the short one?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["sixty"], number: 2 } }, expect: "pass" },
          {
            name: "read as straight",
            response: { answer: { choice: ["half"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the ratio of the hard swing",
            response: { answer: { choice: ["sixty"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "How hard it swings",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "how-hard-it-swings",
        version: 1,
        role: "check",
        prompt:
          "Four grooves, each at its own tempo. In the first three the eighth notes swing; in the last one the sixteenths do. For each, pick how hard it swings.",
        skills: [{ skill: "R13", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.swing", mode: "review-if-due" }],
        tests: [],
        parts: [
          feel(
            "groove-one",
            "Groove 1: the eighth notes.",
            earGroove(104, ".2", 4),
            "light",
            "This one is light swing, 3:2: the long hit is one and a half times the short one, a lean more felt than heard.",
          ),
          feel(
            "groove-two",
            "Groove 2: the eighth notes.",
            earGroove(96, ".5", 4),
            "hard",
            "This one is hard swing, 3:1: the long–short of a dotted eighth and a sixteenth, the short hit squeezed against the next beat.",
          ),
          feel(
            "groove-three",
            "Groove 3: the eighth notes.",
            earGroove(112, "1/3", 4),
            "triplet",
            "This one is triplet swing, 2:1: the short hit lands on the last note of a triplet, the shuffle of the blues.",
          ),
          feel(
            "groove-four",
            "Groove 4: the sixteenth notes.",
            earGroove(88, "1/3", 8),
            "triplet",
            "This one is triplet swing, 2:1, on the sixteenths: each half beat is cut long–short, the lazy hi-hat of hip-hop and neo-soul.",
          ),
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Swing the sixteenths",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "swing-the-sixteenths",
        version: 1,
        role: "check",
        prompt:
          "Change the hi-hat's swing call so each pair of sixteenths is long-short, from a light swing up to the triplet feel. Now the call swings the eighths: each half beat moves late as a block, and the sixteenth pairs stay even. Keep the other lines.",
        skills: [{ skill: "R13", w: 1 }],
        swing: { subdivision: 16, amount: 0.2 },
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 2 },
        // The hi-hat's sixteen hits on the straightened grid, and its sixteenth pairs measured long–short inside
        // the window: eighth swing (pairs even), a swing too light to name, a silent hi-hat or one thinned to
        // eighths all fail.
        matcher: {
          m: "all",
          of: [
            {
              m: "rhythm",
              tol: [1, 16],
              durations: false,
              perRole: false,
              displacementCredit: 0.5,
              tracks: ["hats"],
            },
            { m: "rubric", rules: [SIXTEENTHS_LEAN] },
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen inside each half beat of the target: the first hi-hat hit is longer than the second, by a lean between light and the triplet feel. Compare yours with it, pair by pair.",
          // The catalog texts name a call; below rung 4 the feedback describes the sound only.
          "rhythm.swing-missing":
            "The right hits, but the hi-hat's sixteenth pairs are even where the target leans.",
          "rhythm.swing-amount":
            "The hi-hat's sixteenths swing at {ratio}:1; the brief asks for {range}:1, a lean you can hear.",
          "code.swing-fraction-string":
            "A fraction inside quotes gives no swing: write the amount as a plain number, outside the quotes.",
        },
        hints: ladder(
          "The swing call has two numbers. Look at the second one: it decides which notes are paired.",
          "The second number is how many slices of the bar swing. Four slices pair the eighths of each beat; to pair the sixteenths, each slice must be half a beat.",
          "Keep the call where it is and change only its second number. The first number then sets how hard: from a light lean up to the triplet's 2:1.",
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          { name: "the triplet feel: 1/3", response: { code: s5(hats(".swingBy(1/3, 8)")) }, expect: "pass" },
          { name: "the short form: .swing(8)", response: { code: s5(hats(".swing(8)")) }, expect: "pass" },
          { name: "a lighter lean: .15", response: { code: s5(hats(".swingBy(.15, 8)")) }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: plain(S5_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function on the eighths: .swingBy(.2, 4) keeps the pairs even",
            response: { code: s5(hats(".swingBy(.2, 4)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "too light to hear: .swingBy(.1, 8)",
            response: { code: s5(hats(".swingBy(.1, 8)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right call on a silent hi-hat",
            response: {
              code: s5('hats: s("hh*16").velocity("[1 .4 .7 .4]*4").swingBy(.2, 8).gain(0)'),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the fraction in a string",
            response: { code: s5(hats('.swingBy("1/5", 8)')) },
            expect: "fail",
            feedback: ["code.swing-fraction-string"],
          },
          {
            name: "the hi-hat thinned to eighths",
            response: { code: s5('hats: s("hh*8").velocity("[1 .7]*4").swingBy(.2, 8).gain(.5)') },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your lean",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.aeolian-4bar", tracks: ["chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-lean",
        version: 1,
        role: "practice",
        title: "Neo-soul lean",
        prompt:
          "Swing your sixteenths. Required: the hi-hat's sixteenth pairs lean long-short, from a light 3:2 to the triplet's 2:1. Put the same swing on every line that plays sixteenths with it. Your drums and bass then play your song's bridge. Also on the checklist: the swing changes from bar to bar, and a tempo of 76 to 96.",
        skills: [{ skill: "R13", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "sixteenths-lean",
            label: "The hi-hat's sixteenth pairs are long-short, between a light 3:2 and about 2:1",
            required: true,
            skills: ["R13"],
            rule: "swing",
            track: ["hats", "@drums"],
            subdivision: 16,
            ratio: [1.35, 2.4],
          },
          {
            id: "swing-grows",
            label: "The swing amount changes from bar to bar, with amounts written in `< >`",
            required: false,
            skills: ["R13"],
            rule: "uses",
            tool: "tb.swing.patterned",
          },
          {
            id: "slow-tempo",
            label: "`setcpm` sets a tempo between 76 and 96 beats a minute",
            required: false,
            skills: ["R13"],
            rule: "tempo-bpm",
            min: 76,
            max: 96,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral. The swing
        // rule's catalog details name a call; below rung 4 they describe the sound only.
        feedbackText: {
          "rubric.unmet": "{label}: not yet.",
          "rhythm.swing-missing": "The sixteenth pairs are not long–short yet on the line that plays them.",
          "rhythm.swing-amount":
            "`{line}` swings at {ratio}:1; the brief asks for {range}:1, a lean you can hear.",
          "code.swing-fraction-string":
            "A fraction inside quotes gives no swing: write the amount as a plain number, outside the quotes.",
        },
        hints: ladder(
          "The sixteenths should lean, not the eighths. Start with the hi-hat line.",
          "The swing call goes on every line that plays sixteenths, the hi-hat first. Its second number decides which notes are paired.",
          "Eight slices a bar pair the sixteenths. The first number sets the lean: about a fifth is light, a third is the triplet feel.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the hi-hat leans, lightly",
            response: { code: code(KICK, SNARE, hats(LEAN), MAKE_BASS()) },
            expect: "pass",
          },
          { name: "every line at 3:2", response: { code: make(LEAN) }, expect: "pass" },
          {
            name: "beyond the brief: the swing grows bar by bar, slower, a ghosted snare",
            response: {
              code: make('.swingBy("<0 .1 .2 .33>", 8)')
                .replace(`setcpm(${BPM}/4)`, "setcpm(80/4)")
                .replace('snare: s("~ sd ~ sd")', 'snare: s("~ sd ~ [sd ~ ~ sd]").velocity("1 1 1 .3")'),
            },
            expect: "pass",
          },
          {
            name: "the triplet feel on every line",
            response: { code: make(".swingBy(1/3, 8)") },
            expect: "pass",
          },
          {
            name: "the right function on the eighths: the sixteenth pairs stay even",
            response: { code: make(".swingBy(.2, 4)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "too light to name: .swingBy(.1, 8)",
            response: { code: make(".swingBy(.1, 8)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right call on a hi-hat of quarter notes: nothing to swing",
            response: {
              code: code(KICK, SNARE, `hats: s("hh*4")${LEAN}.gain(.5)`, MAKE_BASS()),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right call on a silent hi-hat",
            response: {
              code: code(
                KICK,
                SNARE,
                `hats: s("hh*16").velocity("[1 .4 .7 .4]*4")${LEAN}.gain(0)`,
                MAKE_BASS(),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
