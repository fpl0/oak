// U13.L02 Sixteenth Grooves & Ghost Notes. A groove breathes when its hits are not all the same strength. In a
// sixteenth-note funk groove the snare is loud on 2 and 4 and whispers in between: those quiet hits are ghost
// notes, felt more than heard. In code `.velocity()` gives every hit its strength, one number for each step of
// the pattern on its left (STYLE §11 rule 7). What the learner has: sixteenths (U01.L06), one `.gain()` for a
// whole line (U01.L02), a bass locked to a syncopated kick (U08.L04), the push and the word syncopation
// (U13.L01), sevenths by name (U12). Not yet: notes longer than their beat on the staff (U13.L03), triplets
// and rolls with `.ply()` (U13.L05), swung sixteenths and humanized timing (the rhythm track). Spec:
// content/specs/U13.md.
//
// How it is graded: the modify step is `all` of a `rhythm` match on the snare, drum by drum (`perRole`: every
// hit stays where it is and stays a snare, so hats in its place are `rhythm.extra`; a `~` or a 0 in the velocity
// string silences the hit under it, `rhythm.missing`) and the `velocity-ghosts` rule on the snare's own hits
// (`drum: "snare"`): at least three on sixteenth off-beats at an effective level (`gain × velocity`) of .4
// or less, beside at least two at the line's full strength, so a snare that is quiet throughout fails. The ear
// step is `fam.rhy.syncopation` at level 3 (a kick on a sixteenth between the eighths), drawn by the generator.
// The Make's one required rule is the same `velocity-ghosts` rule on the snare.
//
// Evaluated (headless Strudel): the hook's snare plays beat 2, the "a" of 2, the "e" of 3, beat 4 and the "a"
// of 4 with velocities 1 .3 .3 1 .3; the hats cycle 1 .4 .7 .4 inside every beat (under `.gain(.5)`: .5 .2 .35
// .2); the guitar strums all sixteen sixteenths and accents the third and sixth of each half bar; kick and bass
// share beat 1, the "and" of 2 and the "and" of 3. `s("sd*8").velocity("1 .3")` plays 1 1 1 1 .3 .3 .3 .3.
//
// Band: none (`band: false`). The drums are the lesson: a ghost note is heard and edited in the learner's own
// snare line, and a Band's drums would double it (content/specs/U13.md conventions; NO_BAND in
// content/validate/specs.test.ts).
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** One bar in seconds (tap tests). */
const BAR_SEC = 240 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Dm7 to G7, one bar each: the funk vamp. One string drives the bass and the chords (U08.L04, U12). */
const CHANGES = 'const changes = "<Dm7 G7>"';
/** Beat 1, the "and" of 2 and the "and" of 3: the kick and the bass hit together. */
const KICK_HITS = "bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const KICK = `kick: s("${KICK_HITS}")`;
const BASS =
  'bass: chord(changes).rootNotes(2).struct("x ~ ~ ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~").s("fingerbass").lpf(800)';
/** Beat 2, the "a" of 2, the "e" of 3, beat 4, the "a" of 4. */
const SNARE_HITS = "~ ~ ~ ~ sd ~ ~ sd ~ sd ~ ~ sd ~ ~ sd";
/** The hook's dynamics: one number for each of the sixteen steps, the three small hits at .3. */
const SNARE_VEL = "1 1 1 1 1 1 1 .3 1 .3 1 1 1 1 1 .3";
const FLAT_VEL = "1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1";
const snare = (vel?: string, tail = "") =>
  `snare: s("${SNARE_HITS}")${vel === undefined ? "" : `.velocity("${vel}")`}${tail}`;
/** Sixteen hats, accented inside every beat (the cell repeated four times, STYLE §11 rule 7). */
const HATS_ACCENTED = 'hats: s("hh*16").velocity("[1 .4 .7 .4]*4").gain(.5)';
const HATS_FLAT = 'hats: s("hh*16").gain(.5)';
/** The clean guitar scratches all sixteen sixteenths and leans on the third and sixth of each half bar. */
const GTR_ACCENTED =
  'gtr: chord(changes).voicing().struct("x*16").s("cleangtr").velocity("[.25 .25 1 .25 .25 1 .25 .25]*2").clip(.5).gain(.6)';
const GTR_FLAT = 'gtr: chord(changes).voicing().struct("x*16").s("cleangtr").clip(.5).gain(.6)';
const RHODES = 'chords: chord(changes).voicing().s("rhodes")';

const code = (...lines: string[]) => `${TEMPO}${CHANGES}\n\n${lines.join("\n")}`;

/** The hook: every hit has its strength. */
const HOOK = code(KICK, snare(SNARE_VEL), HATS_ACCENTED, BASS, GTR_ACCENTED);
/** The same notes with no `.velocity()` anywhere: stiff. */
const STIFF = code(KICK, snare(), HATS_FLAT, BASS, GTR_FLAT);

/** S3: eight snare hits and two numbers. */
const PREDICT = `${TEMPO}kick: s("bd ~ bd ~")\nsnare: s("sd*8").velocity("1 .3")`;

/** S5: the hook with every snare hit at 1. Only the snare line is editable. */
const s5 = (snareLine: string) => code(KICK, snareLine, HATS_ACCENTED, BASS, GTR_ACCENTED);
const S5_STARTER = s5(`snare: ⟪s("${SNARE_HITS}").velocity("${FLAT_VEL}")⟫`);
const S5_SOLUTION = s5(snare(SNARE_VEL));
const GHOSTS_RULE: RubricRule = {
  id: "snare-ghosts",
  label:
    "At least three snare hits at .4 or less on an “e” or an “a”, and at least two snare hits at full strength",
  required: true,
  skills: ["R10"],
  rule: "velocity-ghosts",
  track: "snare",
  min: 3,
  on: "16th-offbeat",
  accents: 2,
  // Snare hits only: hats written on the snare line are not ghost notes of the snare.
  drum: "snare",
};

/** The Make: the vamp with every hit at the same strength and the Rhodes holding each chord. */
const MAKE_STARTER = code(KICK, snare(), HATS_FLAT, BASS, RHODES);

/** The eight sixteenths between the eighths of a bar, by the cell IDs of `fam.rhy.syncopation` (sixteenths from 0). */
const SIXTEENTH_SPOTS = [1, 2, 3, 4].flatMap((beat) => [
  { id: `c${(beat - 1) * 4 + 1}`, label: `The “e” of ${beat}` },
  { id: `c${(beat - 1) * 4 + 3}`, label: `The “a” of ${beat}` },
]);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** Seconds from the start of the stimulus of the given sixteenth-note positions (0 = beat 1 of bar 1). */
const at = (sixteenths: number[]) => sixteenths.map((s) => Number(((s * BAR_SEC) / 16).toFixed(4)));

export default defineLesson({
  id: "U13.L02",
  version: 3,
  title: "Sixteenth Grooves & Ghost Notes",
  objective:
    "I can give every hit of a groove its own strength with .velocity(), and write a sixteenth-note groove with ghost notes.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R10"],
  terms: [{ id: "term.ghost-note", step: "S4" }],
  canDo: ["cd.code.ghost-notes"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Stiff, then breathing",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "stiff-then-breathing",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the snare first, then the hats. Notice which loop sounds like a drum machine and which like a band playing, and what changes inside the snare from hit to hit.",
        skills: [{ skill: "R10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: STIFF,
            caption: "Loop 1: every hit of every part at one strength.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "Loop 2: the same hits in the same places. Follow the snare.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap with the kick",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-with-the-kick",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the kick for two bars: three taps a bar, on 1, the “and” of 2 and the “and” of 3. Six taps in all. Do not tap the snare or beat 4. Done when every tap lands with a kick.",
        skills: [{ skill: "R10", w: 1 }],
        hints: ladder(
          "Tap the kick only, three times a bar. Which of its three hits falls on a beat, and which two fall between beats?",
          "Count eighths with the hats, 1 & 2 & 3 & 4 &. The kick hits on 1, then on the “&” after 2 and the “&” after 3. Beat 4 has no kick.",
          "Say “ONE and two AND three AND four and” and tap on the words in capitals.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 2,
        target: { drum: ["kick"] },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed":
            "A kick went by without a tap. It hits three times a bar: on 1, the “and” of 2, the “and” of 3.",
          "tap.extra": "A tap landed where there is no kick. Beat 4 has none: let the snare have it.",
        },
        srs: [{ family: "fam.rhy.echo", mode: "review-if-due" }],
        tests: [
          { name: "with the kick", response: { taps: at([0, 6, 10, 16, 22, 26]) }, expect: "pass" },
          { name: "on every beat", response: { taps: at([0, 4, 8, 12, 16, 20, 24, 28]) }, expect: "fail" },
          { name: "on 1 and 3 only", response: { taps: at([0, 8, 16, 24]) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "Two numbers, eight hits",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "two-numbers-eight-hits",
        version: 1,
        role: "practice",
        prompt:
          "`.velocity()` sets how hard each hit is played, from 0 to 1. Here eight snare hits get two numbers, `1` and `.3`. Predict how loud each of the eight hits will be, then pick your answer.",
        skills: [{ skill: "R10", w: 1 }],
        hints: null,
        tests: [],
        code: PREDICT,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "half-and-half", label: "Four loud hits, then four quiet ones" },
          { id: "alternate", label: "Loud, quiet, loud, quiet, all the way through the bar" },
          { id: "same", label: "Every hit at the same level" },
        ],
        correct: ["half-and-half"],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Where the whispers are",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-groove", code: HOOK, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-whispers-are",
        version: 1,
        role: "practice",
        prompt:
          "Run the groove and read the snare line: its rhythm string and its `.velocity()` string line up step by step. Answer both questions: which snare hits are quiet, and how many numbers the `.velocity()` string holds.",
        skills: [{ skill: "R10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the two strings side by side: under each `sd` is its number. The hits on beats 2 and 4 have a 1; the three in between have .3.",
        },
        hints: ladder(
          "Count the steps of the snare's rhythm string. Does the velocity string have as many?",
          "The fifth step is beat 2 and the thirteenth is beat 4. Which numbers sit under the snare hits that are neither?",
          "Under the hit on beat 2 is a 1. The next snare hit, three steps later, has .3.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which snare hits are quiet?",
            options: [
              {
                id: "between",
                label: "The three between the backbeats: the “a” of 2, the “e” of 3 and the “a” of 4",
              },
              { id: "backbeat", label: "The two on beats 2 and 4" },
              { id: "every-other", label: "Every other hit, starting on beat 2" },
            ],
            correct: ["between"],
          },
          {
            q: "number",
            prompt: "How many numbers are in the snare's `.velocity()` string?",
            correct: 16,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["between"], number: 16 } }, expect: "pass" },
          {
            name: "the backbeat taken for the quiet hits",
            response: { answer: { choice: ["backbeat"], number: 16 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one number a beat",
            response: { answer: { choice: ["between"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Ghost the snare",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "ghost-the-snare",
        version: 1,
        role: "check",
        prompt:
          "Every snare hit is at 1. In the snare's `.velocity()` string, set the three hits between the backbeats (the “a” of 2, the “e” of 3, the “a” of 4) to .4 or less. Keep beats 2 and 4 at 1, and every hit where it is.",
        skills: [{ skill: "R10", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 2 },
        matcher: {
          m: "all",
          of: [
            {
              m: "rhythm",
              tol: [1, 32],
              durations: false,
              // Each hit stays a snare: a hat in its place is a different drum (rhythm.extra and .missing).
              perRole: true,
              displacementCredit: 0,
              tracks: ["snare"],
            },
            { m: "rubric", rules: [GHOSTS_RULE] },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: a snare hit went missing. A `~` or a 0 in the velocity string silences the hit under it; a ghost note is quiet but heard, so write a small number there, such as .3.",
        },
        hints: ladder(
          "Three snare hits should whisper and two stay loud. Which hits carry the backbeat, and which only fill the gaps?",
          "The velocity string has one number per sixteenth, in the same order as the rhythm string. A ghost note is .4 or less; an accent stays at 1.",
          "The first small hit is the eighth step, the “a” of 2: its number becomes .3. Two more small hits to go.",
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          {
            // Every off-beat sixteenth quiet: the three small hits are among them, and 2 and 4 stay at 1.
            name: "a repeated cell: every off-beat sixteenth quiet",
            response: { code: s5(snare("[1 .3]*8")) },
            expect: "pass",
          },
          {
            name: "quieter ghosts, written beat by beat",
            response: { code: s5(snare("[1 1 1 1] [1 1 1 .2] [1 .2 1 1] [1 1 1 .2]")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s5(snare(FLAT_VEL)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            // Two numbers spread over the bar: the first half loud, the second quiet, beat 4 lost.
            name: "two numbers for the whole line",
            response: { code: s5(snare("1 .3")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "every hit quiet: no backbeat left",
            response: { code: s5(snare("[.3 .3 .3 .3]*4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the whole line turned down with .gain()",
            response: { code: s5(snare(FLAT_VEL, ".gain(.3)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the small hits at 0: silent, not ghosted",
            response: { code: s5(snare("1 1 1 1 1 1 1 0 1 0 1 1 1 1 1 0")) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "hats in place of the snare, ghosted the same way",
            response: {
              code: s5(`snare: s("${SNARE_HITS.replaceAll("sd", "hh")}").velocity("${SNARE_VEL}")`),
            },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
          {
            name: "ghosts at .4, the most the brief allows",
            response: { code: s5(snare(SNARE_VEL.replaceAll(".3", ".4"))) },
            expect: "pass",
          },
          {
            name: "a rest in the velocity string: the hit disappears",
            response: { code: s5(snare("1 1 1 1 1 1 1 ~ 1 .3 1 1 1 1 1 .3")) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Find the push",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "find-the-sixteenth-push",
        version: 1,
        role: "check",
        prompt:
          "A two-bar drum groove, a new one each time. One kick lands on a sixteenth between the eighths, the “e” or the “a” of a beat. Pick the spot where it lands.",
        skills: [{ skill: "R10", w: 1 }],
        hints: [
          { text: "The hats play the eighths. Which kick does not land with a hat?" },
          {
            text: "Count 1 e & a under your breath. The odd kick lands on an “e” or an “a”, where no hat plays.",
            replay: { rate: 0.75 },
          },
          {
            text: "Find the beat it falls in first, then decide: just after the beat, or just before the next one.",
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.rhy.syncopation", level: 3 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        // One button per sixteenth between the eighths, with the family's own cell IDs (`c7` is the "a" of 2), so
        // the drawn trial's expected answer is one of them as it stands.
        answer: { ui: "choice", options: SIXTEENTH_SPOTS },
        correct: {},
        srs: [{ family: "fam.rhy.syncopation", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your funk groove",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-funk-groove",
        version: 1,
        role: "practice",
        prompt:
          "Add `.velocity()` to the snare: ghost notes (.4 or less) on at least three “e” or “a” hits, with 2 and 4 at 1. Then, if you like, accent the hats inside each beat and trade the Rhodes for a clean guitar in sixteenths with accents of its own.",
        skills: [{ skill: "R10", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          GHOSTS_RULE,
          {
            id: "hats-breathe",
            label: "At least eight quiet hats: hits whose `.velocity()` times `.gain()` is .4 or less",
            required: false,
            skills: ["R10"],
            rule: "velocity-ghosts",
            track: "hats",
            min: 8,
            on: "any",
          },
          {
            id: "clean-guitar",
            label: "The clean guitar (`cleangtr`) plays",
            required: false,
            skills: ["R10"],
            rule: "sounds",
            contains: ["snd.cleangtr"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Check that line against the item, then run it again.",
        },
        hints: ladder(
          "The snare needs whispers between its loud backbeats. Which of its hits could whisper?",
          "`.velocity()` after the snare's `s(…)`, one number per sixteenth step: 1 for beats 2 and 4, .4 or less for the hits in between.",
          'For the hats, one cell repeated four times gives every beat the same shape: `.velocity("[1 .4 .7 .4]*4")`. The snare still needs its own numbers.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the snare ghosted, the rest as it came",
            response: { code: code(KICK, snare(SNARE_VEL), HATS_FLAT, BASS, RHODES) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a kick moved, ghosted snare, accented hats, a guitar and the Rhodes on top",
            response: {
              code: code(
                'kick: s("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ bd")',
                'snare: s("~ ~ ~ ~ sd ~ sd sd ~ sd ~ ~ sd ~ sd sd").velocity("[1 .3]*8")',
                HATS_ACCENTED,
                'bass: chord(changes).rootNotes(2).struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~ x").s("fingerbass").lpf(800)',
                GTR_ACCENTED,
                'chords: chord(changes).voicing().struct("~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~").early(1/16).s("rhodes").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "every snare hit ghosted: no backbeat",
            response: { code: code(KICK, snare("[.3 .3 .3 .3]*4"), HATS_ACCENTED, BASS, GTR_ACCENTED) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hats and the guitar accented, the snare left flat",
            response: { code: code(KICK, snare(), HATS_ACCENTED, BASS, GTR_ACCENTED) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
