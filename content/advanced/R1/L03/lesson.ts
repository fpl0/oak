// R1.L03 The One (spec: content/specs/R1.md). Funk is busy everywhere except one place: the one. The kick
// syncopates on the sixteenths and the snare's ghost notes whisper around the backbeat, but on beat 1 of every bar
// the kick, the bass and the clav land together. That shared downbeat is what lets everything else move.
//
// Written for the learner at the gate (AUTHORING §20.1): ghost notes and `.velocity()` are U13.L02's, the push and
// syncopation U13.L01's, the bass locked to the kick U08.L04's, and how hard a push pulls R1.L01's; all are applied,
// not retaught. The clav is the one new sound (it unlocks here and is used in the lesson's own steps). No new term:
// "the one" is plain English (the content lead's ruling) and the prose says it in words. Felt (S2: tap the
// downbeat), read (S3: the snare's velocity string), then coded (S4 the kick, S5 the ghost notes, S6 the pocket).
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: the kick lands on beat 1 of every bar AND pulls against the beat
//   (`onsets` with `perBar`, and `syncopation`, which counts a hit only when the heavier place after it is
//   silent); the ghost notes are hits you can hear at a low level, beside a backbeat that stays loud
//   (`velocity-ghosts` with `accents`, which drops a hit at velocity 0 and refuses a snare quiet throughout);
// - each graded step pins a WRONG answer that uses the right function: `.early(1/16)` on a syncopated kick (the
//   one is lost); ghost notes at `.velocity(0)` (silent) and at `.8` (not ghosts); a busy kick whose extra hits
//   all lead into played beats (no pull);
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Seconds per sixteenth at the lesson's tempo. */
const SIXTEENTH_SEC = 15 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The funk kick: beat 1, the "a" of 1, the "and" of 2, the "and" of 3 (three pulls a bar). */
const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const kick = (pattern: string, tail = "") => `kick: s("${pattern}")${tail}`;
const FOUR_ON_THE_FLOOR = "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~";
/** The backbeat on 2 and 4, ghost notes at .3 on the "a" of 2, the "e" and "a" of 3 and the "a" of 4. */
const GHOST_HITS = "~ ~ ~ ~ sd ~ ~ sd ~ sd ~ sd sd ~ ~ sd";
const GHOST_LEVELS = "[0 0 0 0 1 0 0 .3 0 .3 0 .3 1 0 0 .3]";
const snare = (hits: string, levels?: string, tail = "") =>
  `snare: s("${hits}")${levels ? `.velocity("${levels}")` : ""}${tail}`;
const SNARE = snare(GHOST_HITS, GHOST_LEVELS);
const BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const HATS = 'hats: s("hh*16").velocity("[1 .5 .8 .5]*4").gain(.5)';
/** A popping bass on E minor pentatonic, on the one with the kick. */
const bass = (tail = "") =>
  `bass: note("e2 ~ ~ e3 ~ ~ e2 ~ ~ ~ g2 ~ a2 ~ b2 d3").s("fingerbass").clip(.5)${tail}`;
/** Clav stabs on Em7, on the one and around the backbeat. */
const KEYS =
  'keys: chord("Em7").voicing().struct("x ~ ~ ~ ~ x ~ x ~ ~ ~ ~ ~ x ~ ~").s("clav").clip(.3).gain(.6)';

const GROOVE = code(kick(FUNK_KICK), SNARE, HATS, bass(), KEYS);
const GROOVE_TILTED = code(kick(FUNK_KICK), SNARE, HATS, bass(".early(1/16)"), KEYS);
/** S2: the groove with a soft crash on every downbeat. */
const MARKED = code(kick(FUNK_KICK), SNARE, HATS, bass(), KEYS, 'perc: s("cr").gain(.4)');
const DRUMS_ALONE = code(kick(FUNK_KICK), SNARE, HATS);

/** Seconds from the start of a tap stimulus: positions given in sixteenths (0-based, across bars). */
const at = (steps: number[]) => steps.map((s) => Math.round(s * SIXTEENTH_SEC * 1000) / 1000);
const DOWNBEATS = at([0, 16, 32, 48]);

/** S4: four on the floor under the funk snare, bass and clav; the learner writes the kick. */
const KICK_STARTER = code(`kick: s("⟪${FOUR_ON_THE_FLOOR}⟫")`, SNARE, HATS, bass(), KEYS);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const kickAnswer = (line: string) => code(line, SNARE, HATS, bass(), KEYS);
const KICK_SOLUTION = kickAnswer(kick(FUNK_KICK));
const KICK_ON_ONE: RubricRule = {
  id: "kick-on-one",
  label: "The kick plays on beat 1 of every bar",
  required: true,
  skills: ["R14"],
  rule: "onsets",
  track: "kick",
  contains: [[0, 1]],
  perBar: true,
};
/** Counted over the four bars the step renders: two pulls a bar. */
const KICK_PULLS: RubricRule = {
  id: "kick-pulls",
  label: "At least two kicks a bar pull: each on a light place, with the heavier place after it empty",
  required: true,
  skills: ["R14"],
  rule: "syncopation",
  track: "kick",
  min: 8,
};

/** S5: the kick and the rest in place; the snare plays only 2 and 4. */
const GHOST_STARTER = code(kick(FUNK_KICK), `snare: ⟪s("${BACKBEAT}")⟫`, HATS, bass(), KEYS);
const ghostAnswer = (line: string) => code(kick(FUNK_KICK), line, HATS, bass(), KEYS);
const GHOST_SOLUTION = ghostAnswer(SNARE);
const ghostRule = (min: number): RubricRule => ({
  id: "snare-whispers",
  label: `At least ${min} quiet snare hits on the “e”s and “a”s, with the hits on 2 and 4 loud`,
  required: true,
  skills: ["R14"],
  rule: "velocity-ghosts",
  track: "snare",
  min,
  on: "16th-offbeat",
  accents: 2,
});
const BACKBEAT_KEPT: RubricRule = {
  id: "backbeat-kept",
  label: "The snare still plays on beats 2 and 4 of every bar",
  required: true,
  skills: ["R14"],
  rule: "onsets",
  track: "snare",
  contains: [
    [1, 4],
    [3, 4],
  ],
  perBar: true,
};

/** S6: no Band; the backbeat, a bass and a clav on the one are the starter, the pocket is the learner's. */
const MAKE_STARTER = code(
  kick("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~"),
  snare(BACKBEAT),
  HATS,
  'bass: note("e2 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").s("fingerbass").clip(.5)',
  'keys: chord("Em7").voicing().struct("x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").s("clav").clip(.3).gain(.6)',
);
const make = (snareLine: string) =>
  code(
    kick("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~"),
    snareLine,
    HATS,
    'bass: note("e2 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").s("fingerbass").clip(.5)',
    'keys: chord("Em7").voicing().struct("x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").s("clav").clip(.3).gain(.6)',
  );

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R1.L03",
  version: 3,
  title: "The One",
  objective: "I can write a 16th-note funk beat with ghost notes that lands together on the downbeat.",
  key: { tonic: "E", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R14"],
  practises: [],
  terms: [],
  canDo: ["cd.code.funk-drums"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Everything on one",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "funk", code: GROOVE, bars: 4 },
      exercise: {
        kind: "listen",
        id: "everything-on-one",
        version: 1,
        role: "practice",
        prompt:
          "Listen to beat 1 of each bar in both loops; only the bass changes, by a sixteenth. Notice which loop stands firm and which seems to tilt, and which parts land together on beat 1.",
        skills: [{ skill: "R14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: GROOVE,
            caption: "Busy everywhere. Listen to beat 1 of each bar.",
            bars: 4,
          },
          {
            code: GROOVE_TILTED,
            caption: "The bass moves a sixteenth earlier. What happens on beat 1?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the one",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-one",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the soft crash, the long splashy cymbal on beat 1 of every bar, and nothing else. Let everything in between go by. Four bars, four taps in all. Done when each tap lands with the crash.",
        skills: [{ skill: "R14", w: 1 }],
        hints: ladder(
          "Listen for the crash, the long splashy cymbal: it rings once a bar, together with the kick, the bass and the clav.",
          "The crash sounds once a bar, on beat 1. Everything between it is busy on purpose.",
          "Count 1, 2, 3, 4 and tap on every 1 only.",
        ),
        mode: "along",
        stimulus: { src: "code", code: MARKED, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "perc" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: false, passF1: 0.8, passTiming: 0.7 },
        srs: [{ family: "fam.rhy.groove-lock", mode: "review-if-due" }],
        tests: [
          { name: "the four downbeats", response: { taps: DOWNBEATS }, expect: "pass" },
          {
            name: "on every beat",
            response: { taps: at(Array.from({ length: 16 }, (_, i) => i * 4)) },
            expect: "fail",
          },
          {
            name: "the last sixteenth before each downbeat",
            response: { taps: at([15, 31, 47, 63]) },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Loud and whispered",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-drums", code: DRUMS_ALONE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "loud-and-whispered",
        version: 1,
        role: "practice",
        prompt:
          "Run the drums alone and read one bar: the snare's sixteen steps, and its `.velocity()` string, one value per step. Then answer: how many snare hits one bar holds, and which of them are ghost notes.",
        skills: [{ skill: "R14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the `sd` words in the snare's string, then read the velocity value under each one.",
        },
        hints: ladder(
          "Count the `sd` words in the snare's string first, then read the velocity value under each.",
          "Each step of the snare string has a value at the same place in the velocity string. Two values are 1; the others under a hit are much lower.",
          "The loud hits are on beats 2 and 4. Count the quiet ones and add them.",
        ),
        code: { starter: DRUMS_ALONE },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many snare hits are there in one bar?", correct: 6 },
          {
            q: "choice",
            prompt: "Which of them are ghost notes?",
            options: [
              { id: "quiet-four", label: "The four at .3, each a sixteenth off the beat" },
              { id: "backbeat", label: "The two at 1, on beats 2 and 4" },
              { id: "all", label: "All six" },
            ],
            correct: ["quiet-four"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 6, choice: ["quiet-four"] } }, expect: "pass" },
          {
            name: "two: the backbeat only",
            response: { answer: { number: 2, choice: ["quiet-four"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the loud hits read as ghosts",
            response: { answer: { number: 6, choice: ["backbeat"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "A kick that pulls",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "kick-that-pulls",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the kick line, now on every beat, as a funk kick. Keep a kick on beat 1 of every bar. Add at least two kicks a bar that pull: each on a light place, with the heavier place after it left empty. Keep the other lines.",
        skills: [{ skill: "R14", w: 1 }],
        code: { starter: KICK_STARTER },
        reference: { solutions: [KICK_SOLUTION], bars: 4 },
        // Beat 1 in every bar, and at least eight pulls over the four bars: a kick moved off the one, a busy kick
        // whose extra hits lead into played beats, or a kick on every eighth all fail.
        matcher: { m: "rubric", rules: [KICK_ON_ONE, KICK_PULLS] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. In the target the kick starts every bar with the bass, then lands just before places it leaves empty.",
        },
        hints: ladder(
          "Keep the first kick of the bar and clear the others. Then look at the light places just before beats 2, 3 and 4.",
          "A kick hit pulls when it sits on a light place and the heavier place after it stays empty. Beats 2 and 4 belong to the snare.",
          "Keep the first `bd`. Move the kick on beat 2 one step earlier and leave beat 2 empty; find one more pull later in the bar.",
        ),
        tests: [
          { name: "reference", response: { code: KICK_SOLUTION }, expect: "pass" },
          {
            name: "two pulls a bar: the a of 2 and the and of 3",
            response: { code: kickAnswer(kick("bd ~ ~ ~ bd ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~")) },
            expect: "pass",
          },
          {
            name: "written with weights",
            response: { code: kickAnswer(kick("bd@3 bd@3 bd@4 bd@6")) },
            expect: "pass",
          },
          {
            name: "another pocket, on a drum machine",
            response: {
              code: kickAnswer(kick("bd ~ ~ bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~", '.bank("RolandTR909")')),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(KICK_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function on a funk kick: .early(1/16) loses the one",
            response: { code: kickAnswer(kick(FUNK_KICK, ".early(1/16)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "four on the floor with sixteenths before the beats: busy, but nothing pulls",
            response: { code: kickAnswer(kick("bd ~ ~ bd bd ~ ~ bd bd ~ ~ bd bd ~ ~ ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a kick on every eighth",
            response: { code: kickAnswer(kick("bd*8")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one pull a bar only",
            response: { code: kickAnswer(kick("bd ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
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
          "Add ghost notes to the snare, which plays only 2 and 4: at least three quiet hits a bar on the “e”s and “a”s, kept low with a `.velocity()` string. The hits on 2 and 4 stay in place and loud. Keep the other lines.",
        skills: [{ skill: "R14", w: 1 }],
        code: { starter: GHOST_STARTER },
        reference: { solutions: [GHOST_SOLUTION], bars: 2 },
        // Heard and quiet: hits at velocity 0 are dropped, hits at .8 are not ghosts, a snare quiet throughout has
        // no backbeat, and a backbeat removed while editing fails the second rule.
        matcher: { m: "rubric", rules: [ghostRule(3), BACKBEAT_KEPT] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. In the target the backbeat cracks on 2 and 4, and between them a few snare hits sit so low you feel them more than hear them.",
        },
        hints: ladder(
          "Ghost notes go on the sixteenths off the beat, the “e”s and “a”s, and they play quietly.",
          "Ghost notes are snare hits on sixteenths off the beat, played quietly with `.velocity()`. The hits on 2 and 4 keep full strength.",
          "Add three or four `sd` on the “e”s and “a”s of the string, then give the snare a velocity string with one value per step: 1 on the backbeat, a low value on each new hit.",
        ),
        tests: [
          { name: "reference", response: { code: GHOST_SOLUTION }, expect: "pass" },
          {
            name: "other places, softer",
            response: {
              code: ghostAnswer(
                snare("~ ~ ~ sd sd ~ ~ sd ~ ~ ~ sd sd ~ ~ ~", "[0 0 0 .25 1 0 0 .25 0 0 0 .25 1 0 0 0]"),
              ),
            },
            expect: "pass",
          },
          {
            name: "five ghosts on a drum machine",
            response: {
              code: ghostAnswer(
                snare(
                  "~ ~ ~ sd sd ~ ~ sd ~ sd ~ sd sd ~ ~ sd",
                  "[0 0 0 .35 1 0 0 .3 0 .3 0 .3 1 0 0 .35]",
                  '.bank("RolandTR909")',
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "the ghosts quieter still, and the backbeat a touch under full",
            response: { code: ghostAnswer(snare(GHOST_HITS, "[0 0 0 0 .9 0 0 .2 0 .2 0 .2 .9 0 0 .2]")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(GHOST_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, silent: ghosts at velocity 0",
            response: { code: ghostAnswer(snare(GHOST_HITS, "[0 0 0 0 1 0 0 0 0 0 0 0 1 0 0 0]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function, not quiet: ghosts at .8",
            response: { code: ghostAnswer(snare(GHOST_HITS, "[0 0 0 0 1 0 0 .8 0 .8 0 .8 1 0 0 .8]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the backbeat made quiet too",
            response: { code: ghostAnswer(snare(GHOST_HITS, ".3")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "beat 4 lost while editing",
            response: { code: ghostAnswer(snare("~ ~ ~ ~ sd ~ ~ sd ~ sd ~ sd ~ ~ ~ sd", GHOST_LEVELS)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your funk pocket",
      minutes: 2.75,
      // No Band: the drums, the bass and the clav are the pocket, all the learner's (content/specs/R1.md, NO_BAND).
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-make",
        id: "your-funk-pocket",
        version: 1,
        role: "practice",
        title: "Funk pocket",
        prompt:
          "Make the Em7 pocket funk. Required: at least four quiet snare hits on the “e”s and “a”s, with 2 and 4 loud. Also on the checklist: bass and kick on beat 1 of every bar, a kick that pulls against the beat, and the clav on the keys line.",
        skills: [{ skill: "R14", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          ghostRule(4),
          {
            id: "bass-on-one",
            label: "The bass plays on beat 1 of every bar",
            required: false,
            skills: ["R14"],
            rule: "onsets",
            track: "bass",
            contains: [[0, 1]],
            perBar: true,
          },
          { ...KICK_ON_ONE, required: false },
          {
            id: "kick-pulls",
            label: "At least 4 kicks pull: each on a light place, with the heavier place after it empty",
            required: false,
            skills: ["R14"],
            rule: "syncopation",
            track: "kick",
            min: 4,
          },
          {
            id: "clav-stabs",
            label: "The keys line plays the clav",
            required: false,
            skills: ["R14"],
            rule: "sounds",
            track: "keys",
            contains: ["snd.clav"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with the snare: add quiet hits between the backbeats.",
          "Quiet snare hits on sixteenths off the beat, with `.velocity()` keeping 2 and 4 loud.",
          "Write the snare as sixteen steps with an `sd` on 2 and 4 and on four of the “e”s and “a”s, then one velocity value per step.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: four ghost notes", response: { code: make(SNARE) }, expect: "pass" },
          { name: "the whole pocket of the opening groove", response: { code: GROOVE }, expect: "pass" },
          {
            name: "beyond the brief: two bars of bass, a drum machine, faster",
            response: {
              code: code(
                kick(FUNK_KICK, '.bank("RolandTR909")'),
                snare(GHOST_HITS, GHOST_LEVELS, '.bank("RolandTR909")'),
                'hats: s("hh*16").velocity("[1 .5 .8 .5]*4").bank("RolandTR909").gain(.5)',
                'bass: note("<[e2 ~ ~ e3 ~ ~ e2 ~ ~ ~ g2 ~ a2 ~ b2 d3] [e2 ~ ~ e3 ~ ~ d3 ~ ~ ~ b2 ~ a2 ~ g2 ~]>").s("fingerbass").clip(.5)',
                KEYS,
              ).replace(`setcpm(${BPM}/4)`, "setcpm(108/4)"),
            },
            expect: "pass",
          },
          {
            name: "ghosts in other places, softer",
            response: {
              code: make(
                snare("~ ~ ~ sd sd ~ ~ sd ~ ~ ~ sd sd ~ ~ sd", "[0 0 0 .25 1 0 0 .25 0 0 0 .25 1 0 0 .25]"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the right function, silent: ghosts at velocity 0",
            response: { code: make(snare(GHOST_HITS, "[0 0 0 0 1 0 0 0 0 0 0 0 1 0 0 0]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function, not quiet: ghosts at .8",
            response: { code: make(snare(GHOST_HITS, "[0 0 0 0 1 0 0 .8 0 .8 0 .8 1 0 0 .8]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a snare quiet throughout",
            response: { code: make(snare(GHOST_HITS, undefined, ".gain(.3)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
