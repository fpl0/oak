// U13.L04 Compound Meter. Some music divides every beat in three instead of two. A bar of 6/8 holds six eighth
// notes but only two beats, each a dotted quarter long, counted 1 la li 2 la li; 12/8 has four such beats. That
// is compound meter, the sway of soul ballads, slow blues and doo-wop. In code a bar is still one cycle, six or
// twelve equal steps grouped in threes, and the tempo line counts the dotted-quarter beat: `setcpm(60/2)` is 60
// beats a minute in 6/8, `setcpm(60/4)` in 12/8. What the learner has: 3/4 and 2/4 and "the meter is how the pulse
// is grouped" (U01.L08), the doo-wop Band's piano three to the beat with no name for it (U06.L07), the dotted
// quarter (U13.L03), `.velocity()` (U13.L02), sevenths by name over a root bass (U12). Not yet: triplets inside
// 4/4 and `.ply()` (U13.L05: the word "triplet" waits for it), 9/8 and odd meters (rhythm track). Spec:
// content/specs/U13.md.
//
// How it is graded: the drums are compared with the `rhythm` matcher on the named tracks (per role, onsets
// only). The 12/8 step adds a `tempo` constraint, because twelve steps under the 6/8 tempo line play the same
// positions in the bar twice as fast. The ear step is `fam.rhy.meter` at level 3, where 6/8 joins 4/4, 3/4 and
// 2/4. The Make's one required rule is `onsets`: a snare on the fourth eighth of every bar, beat 2 of 6/8.
//
// Band: none (`band: false`). No Band is written in 6/8 or 12/8 (`BAND_METERS`), and the kick and the snare that
// make the two beats are the learner's own lines. Every starter carries the whole rhythm section.
//
// The whole lesson is in a compound meter: it is the planned feature `meter.compound` until every host draws the
// dotted-quarter beat (the roll's grid, the counts, the tap pad), and content:check reports it once.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 60;
/** 6/8: the tempo line divides by the two dotted-quarter beats of the bar. */
const TEMPO = `setcpm(${BPM}/2)\n\n`;
/** 12/8: four dotted-quarter beats. */
const TEMPO_12 = `setcpm(${BPM}/4)\n\n`;
/** One beat (a dotted quarter) in seconds: at 60 a second, so a bar of 6/8 is two seconds. */
const BEAT_SEC = 60 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** One string drives the chords and the bass (U12): Imaj7 vi7 IVmaj7 V7 in C. */
const CHANGES = 'const changes = "<C^7 Am7 F^7 G7>"';
const kick = (p: string) => `kick: s("${p}")`;
const snare = (p: string) => `snare: s("${p}")`;
const HATS = 'hats: s("hh*6").gain(.5)';
/** The hook's hats: loud on each beat, quiet in between, so the threes can be heard. */
const HATS_ACCENTED = 'hats: s("hh*6").velocity("[1 .5 .6]*2").gain(.5)';
const bass = (struct: string) =>
  `bass: chord(changes).rootNotes(2).struct("${struct}").s("fingerbass").lpf(800)`;
const HELD = 'chords: chord(changes).voicing().s("rhodes")';
/** Six even notes a bar, up and back down the voicing. */
const ROLLED = 'chords: chord(changes).voicing().arp("0 1 2 3 2 1").s("rhodes")';
const piece = (tempo: string, ...lines: string[]) => `${tempo}${CHANGES}\n\n${lines.join("\n")}`;

/** Kick on 1 and on the sixth eighth (a lift into the next bar), snare on the fourth eighth: beat 2. */
const KICK_68 = "bd ~ ~ ~ ~ bd";
const SNARE_68 = "~ ~ ~ sd ~ ~";
const HOOK = piece(TEMPO, kick(KICK_68), snare(SNARE_68), HATS_ACCENTED, bass("x ~ ~ x ~ ~"), ROLLED);

/** S3 and S4: six hats, one kick, one snare, held chords. */
const sixHats = (snarePattern: string) =>
  piece(TEMPO, kick("bd ~ ~ ~ ~ ~"), snare(snarePattern), HATS, bass("x ~ ~ ~ ~ ~"), HELD);
const PREDICT = sixHats(SNARE_68);

/** S5: the kick on 1 only and no snare yet; only the two drum patterns are editable. */
const s5 = (k: string, sn: string) => piece(TEMPO, kick(k), snare(sn), HATS, bass("x ~ ~ x ~ ~"), HELD);
const S5_STARTER = s5("⟪bd ~ ~ ~ ~ ~⟫", "⟪~ ~ ~ ~ ~ ~⟫");
const S5_SOLUTION = s5(KICK_68, SNARE_68);
const DRUMS_RHYTHM: Matcher = {
  m: "rhythm",
  tol: [1, 32],
  durations: false,
  perRole: true,
  displacementCredit: 0.5,
  tracks: ["kick", "snare"],
};

/**
 * S6: the S5 groove, to be written as one bar of 12/8 (two bars of 6/8 joined). The tempo line is given in its
 * 12/8 form: a 6/8 tempo line under `meter: "12/8"` is a lint error in authored code, and with it the starter's
 * six-step bars play at half speed, which is what the learner hears and fixes.
 */
const s6 = (tempo: string, k: string, sn: string, h: string) =>
  piece(tempo, kick(k), snare(sn), `hats: s("${h}").gain(.5)`, bass("x ~ ~ x ~ ~"), HELD);
const S6_STARTER = s6("⟪setcpm(60/4)⟫\n\n", `⟪${KICK_68}⟫`, `⟪${SNARE_68}⟫`, "⟪hh*6⟫");
const KICK_128 = "bd ~ ~ ~ ~ bd bd ~ ~ ~ ~ bd";
const SNARE_128 = "~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~";
const S6_SOLUTION = s6(TEMPO_12, KICK_128, SNARE_128, "hh*12");

/** The Make: four held chords, a bass note on 1, six even hats, a kick on 1. No snare yet. */
const MAKE_CHANGES = 'const changes = "<Am7 Dm7 F^7 G7>"';
const make = (...lines: string[]) => `${TEMPO}${MAKE_CHANGES}\n\n${lines.join("\n")}`;
const MAKE_STARTER = make(kick("bd ~ ~ ~ ~ ~"), HATS, bass("x ~ ~ ~ ~ ~"), HELD);
const MAKE_MINIMAL = make(kick("bd ~ ~ ~ ~ ~"), snare(SNARE_68), HATS, bass("x ~ ~ ~ ~ ~"), HELD);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** Seconds from the start of the stimulus of every `every`-th eighth note in `bars` bars (6 eighths a bar). */
const eighths = (bars: number, every: number) =>
  Array.from({ length: (bars * 6) / every }, (_, i) => Number(((i * every * BEAT_SEC) / 3).toFixed(3)));

export default defineLesson({
  id: "U13.L04",
  version: 3,
  title: "Compound Meter",
  objective:
    "I can write a groove in 6/8 or 12/8, two or four beats a bar with each beat split in three, and set its tempo by the dotted quarter.",
  key: { tonic: "C", mode: "major" },
  meter: "6/8",
  bpm: BPM,
  introduces: ["R11"],
  practises: [],
  terms: [
    { id: "term.compound-meter", step: "S4" },
    { id: "term.simple-meter", step: "S4" },
  ],
  canDo: ["cd.code.compound-meter"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A slow sway",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-slow-sway",
        version: 1,
        role: "practice",
        prompt:
          "Listen with your body before you count anything. Notice how many times a bar the music sways, and which two drums mark the sway.",
        skills: [{ skill: "R11", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Four seventh chords on the Rhodes, each rolled up and back down. Six hats a bar.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the sway",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-sway",
        version: 1,
        role: "practice",
        prompt:
          "Tap the slow beat: two taps a bar, one with the kick on 1 and one with the snare, a tap every second. Eight taps in four bars. Skip the hats and the second kick, the one just before the next bar. Done when every tap lands on a kick on 1 or a snare.",
        skills: [{ skill: "R11", w: 1 }],
        hints: ladder(
          "Two taps a bar, no more. Of the six hats in a bar, which ones are loudest?",
          "The beat falls on the first hat of each group of three: the kick on 1, then the snare on 2. The kick on the last hat of the bar is a lift, not a beat.",
          "Say “1 la li 2 la li” and tap only on the numbers. A tap every second.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: "beat",
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed":
            "A beat went by without a tap. There are two in every bar: the kick on 1, then the snare.",
          "tap.extra":
            "A tap landed between the beats. Tap the kick on 1 and the snare only, not the hats or the kick just before the next bar.",
        },
        srs: [{ family: "fam.rhy.echo", mode: "review-if-due" }],
        tests: [
          { name: "two taps a bar, on the beats", response: { taps: eighths(4, 3) }, expect: "pass" },
          { name: "six taps a bar: every hat", response: { taps: eighths(4, 1) }, expect: "fail" },
          { name: "three taps a bar: a waltz", response: { taps: eighths(4, 2) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "Six hats, how many beats",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "six-hats-how-many-beats",
        version: 1,
        role: "practice",
        prompt:
          'Six hats in a bar, a kick on the first and a snare on the fourth: `s("hh*6")`, `s("bd ~ ~ ~ ~ ~")`, `s("~ ~ ~ sd ~ ~")`. Predict how many beats you will feel in each bar, then pick your answer.',
        skills: [{ skill: "R11", w: 1 }],
        hints: null,
        tests: [],
        code: PREDICT,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "two", label: "Two beats, each three hats long" },
          { id: "three", label: "Three beats, each two hats long" },
          { id: "six", label: "Six beats, one for every hat" },
        ],
        correct: ["two"],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Two threes or three twos",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "two-threes", code: PREDICT, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "two-threes-or-three-twos",
        version: 1,
        role: "practice",
        prompt:
          'Run it, then change the snare to `s("~ ~ sd ~ sd ~")` and run it again: the same six hats, grouped another way. Answer both questions: which version is a waltz bar, and how many eighth notes go by in a minute.',
        skills: [{ skill: "R11", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the hats in each version and listen for where the snare groups them: in threes (1 la li 2 la li), or in twos (1 & 2 & 3 &).",
        },
        hints: ladder(
          "In which version does the snare come back every two hats?",
          "A waltz has three beats in a bar. With six hats, each of its beats is two hats long, and the snare lands on beats 2 and 3.",
          "The tempo line counts 60 beats a minute, and each beat here is three eighth notes long.",
        ),
        code: { starter: PREDICT },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which version is a waltz bar, three beats of two eighth notes each?",
            options: [
              { id: "first", label: 'The first: the snare on the fourth eighth, `s("~ ~ ~ sd ~ ~")`' },
              { id: "second", label: 'The second: the snare on the third and fifth, `s("~ ~ sd ~ sd ~")`' },
            ],
            correct: ["second"],
          },
          {
            q: "number",
            prompt:
              "The tempo line `setcpm(60/2)` counts 60 beats a minute, and each beat is three eighth notes. How many eighth notes go by in a minute?",
            correct: 180,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["second"], number: 180 } }, expect: "pass" },
          {
            name: "the first version taken for the waltz",
            response: { answer: { choice: ["first"], number: 180 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two eighths to the beat: 120",
            response: { answer: { choice: ["second"], number: 120 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Give it a second beat",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "give-it-a-second-beat",
        version: 1,
        role: "check",
        prompt:
          "A 6/8 bar with six hats and a kick on 1 only. Add a snare on the fourth eighth, beat 2 of the bar. Then add a second kick on the sixth eighth, a lift into the next bar. Keep the kick on 1.",
        skills: [{ skill: "R11", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 2 },
        matcher: DRUMS_RHYTHM,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rhythm.displaced":
            "A hit is in another place than the target's. Count the six steps 1 la li 2 la li: the snare goes on 2, the fourth step; the second kick on the last “li”, the sixth.",
        },
        hints: ladder(
          "Six steps in each string, one per eighth note. Which step is beat 2?",
          "The bar splits into two groups of three. Beat 2 is the first step of the second group.",
          'The snare line is `s("~ ~ ~ sd ~ ~")`. The kick line keeps its `bd` on step 1 and gets another one later.',
        ),
        srs: [{ family: "fam.rhy.count", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          {
            name: "written in two groups of three",
            response: { code: s5("[bd ~ ~] [~ ~ bd]", "[~ ~ ~] [sd ~ ~]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s5("bd ~ ~ ~ ~ ~", "~ ~ ~ ~ ~ ~") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a waltz: the snare on the third and fifth eighths",
            response: { code: s5(KICK_68, "~ ~ sd ~ sd ~") },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
          {
            name: "a 4/4 habit: the snare on the fourth of eight steps",
            response: { code: s5(KICK_68, "~ ~ ~ sd ~ ~ ~ ~") },
            expect: "fail",
            feedback: ["rhythm.displaced"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "From 6/8 to 12/8",
      minutes: 0.75,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "from-six-to-twelve",
        version: 1,
        role: "check",
        meter: "12/8",
        prompt:
          "Your groove is now one bar of 12/8, four beats, and the tempo line already counts them: `setcpm(60/4)`. Give each drum string twelve steps: twelve hats, and the kick and snare patterns each written twice. Leave the tempo line as it is. Done when the drums sound as they did in 6/8.",
        skills: [{ skill: "R11", w: 1 }],
        code: { starter: S6_STARTER },
        reference: { solutions: [S6_SOLUTION], bars: 2 },
        matcher: { ...DRUMS_RHYTHM, tracks: ["kick", "snare", "hats"] },
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          { c: "tempo", bpm: BPM },
        ],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "A bar of 12/8 holds how many eighth notes, and how many beats?",
          "One cycle is now a bar of four beats, twelve eighth notes. Each drum string needs twelve steps: the six you wrote, then the same six again.",
          'The hats are `s("hh*12")`. The kick string starts `bd ~ ~ ~ ~ bd` and goes on with the same six.',
        ),
        tests: [
          { name: "reference", response: { code: S6_SOLUTION }, expect: "pass" },
          {
            name: "each pattern twice with *2",
            response: { code: s6(TEMPO_12, `[${KICK_68}]*2`, `[${SNARE_68}]*2`, "hh*12") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s6(TEMPO_12, KICK_68, SNARE_68, "hh*6") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the 6/8 tempo line put back: twice too fast",
            response: { code: s6(TEMPO, KICK_128, SNARE_128, "hh*12") },
            expect: "fail",
            feedback: ["code.setcpm-form", "code.tempo"],
          },
          {
            name: "the eighth counted as the beat: setcpm(180/4)",
            response: { code: s6("setcpm(180/4)\n\n", KICK_128, SNARE_128, "hh*12") },
            expect: "fail",
            feedback: ["code.tempo"],
          },
          {
            name: "only the hats doubled: kick and snare still six steps",
            response: { code: s6(TEMPO_12, KICK_68, SNARE_68, "hh*12") },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "ear",
      title: "Which meter",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "which-meter",
        version: 1,
        role: "check",
        prompt:
          "Four bars of drums, a new groove each time. Find the beat, count the beats in a bar, and listen whether each beat splits in two or in three. Pick the meter.",
        skills: [{ skill: "R11", w: 1 }],
        hints: [
          { text: "Where does the kick come back? That is the start of each bar." },
          {
            text: "Count the beats between two kicks. Then listen inside one beat: does it split in two, or in three?",
          },
          {
            text: "Listen again slower and count out loud: 1 & 2 & 3 &, or 1 la li 2 la li.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.rhy.meter", level: 3 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "4/4", label: "In four (4/4)" },
            { id: "3/4", label: "In three (3/4)" },
            { id: "2/4", label: "In two (2/4)" },
            { id: "6/8", label: "In two, each beat split in three (6/8)" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.rhy.meter", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your 6/8 ballad",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-six-eight-ballad",
        version: 1,
        role: "practice",
        prompt:
          "Add a `snare:` line with one hit a bar, on the fourth eighth: beat 2 of 6/8. Then, if you like, add a kick that lifts into the next bar, hats accented in threes with `.velocity()`, chords rolled with `.arp()`, or a slow tune on top.",
        skills: [{ skill: "R11", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "snare-on-two",
            label: "In every bar, a snare on the fourth eighth (beat 2) and none on the first three eighths",
            required: true,
            skills: ["R11"],
            rule: "onsets",
            track: "@drums",
            drum: "snare",
            contains: [[1, 2]],
            // Corrections gate (AS-49): beat 2 marked, beat 1 left to the kick, no snare on every eighth.
            excludes: [
              [0, 1],
              [1, 6],
              [1, 3],
            ],
            perBar: true,
          },
          {
            id: "hats-in-threes",
            label: "At least four quiet hats: hits whose `.velocity()` times `.gain()` is .4 or less",
            required: false,
            skills: ["R11"],
            rule: "velocity-ghosts",
            track: "hats",
            on: "any",
            min: 4,
          },
          {
            id: "sway-tempo",
            label: "A tempo from 50 to 72 beats a minute",
            required: false,
            skills: ["R11"],
            rule: "tempo-bpm",
            min: 50,
            max: 72,
          },
          {
            id: "rolled-chords",
            label: "The chords use `.arp()`",
            required: false,
            skills: ["R11"],
            rule: "uses",
            tool: "tb.arp",
          },
        ],
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Check your lines against the item, then run it again.",
        },
        hints: ladder(
          "The snare goes on the second beat of every bar. Where is beat 2 in a bar of six eighths?",
          "The bar is two groups of three eighth notes. Beat 2 is the first eighth of the second group.",
          "Add a snare line with six steps, its only hit on step 4.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: a snare on beat 2", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: a lift, accented hats, rolled chords and a tune in dotted quarters",
            response: {
              code: `setcpm(56/2)\n\n${MAKE_CHANGES}\n\n${[
                kick(KICK_68),
                snare("~ ~ ~ sd ~ ~"),
                'hats: s("hh*6").velocity("[1 .3 .5]*2").gain(.5)',
                bass("x ~ ~ x ~ ~"),
                ROLLED,
                'mel: n("<[4@3 2@3] [5@3 3@3] [5@3 4@2 2] [1@6]>").scale("C5:major").s("piano")',
              ].join("\n")}`,
            },
            expect: "pass",
          },
          {
            name: "a waltz: the snare on the third and fifth eighths",
            response: {
              code: make(kick("bd ~ ~ ~ ~ ~"), snare("~ ~ sd ~ sd ~"), HATS, bass("x ~ ~ ~ ~ ~"), HELD),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
