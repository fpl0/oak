// U01.L04 Two per Beat. A beat can be split in two; brackets squeeze sounds into one beat. Tools in reach:
// U01.L01–L03 plus `[ ]` (unlocked here). `< >` waits for U01.L07, so the hook's before-and-after is two
// listen items, not one alternating pattern (AUTHORING §13). Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const EIGHTHS = "[hh hh] [hh hh] [hh hh] [hh hh]";
/** The backbeat under a hats line of your choice. */
const groove = (hats: string, kick = KICK) => `${TEMPO}${kick}\n${SNARE}\nhats: s("${hats}")`;
const QUARTER_GROOVE = groove("hh hh hh hh");
const HOOK = groove(EIGHTHS);

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band plays bass and chords under the learner's drums. */
const BAND = { band: "band.two-chord-vamp", tracks: ["bass", "chords"] } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/**
 * Drum hits are one-shots: only where they start matters. `rhythm: "exact"` would also compare the length of
 * each slot, and reject `[bd ~]` for `bd` although the two sound the same.
 */
const DRUM_EVENTS = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  sound: "drum-role",
} as const;

/** S4: the second `hh` inside the first brackets is the hat on the "and" of 1. */
const AND_OF_ONE = HOOK.indexOf("[hh hh]") + "[hh ".length;
const ON_ONE = HOOK.indexOf("[hh hh]") + 1;

export default defineLesson({
  id: "U01.L04",
  version: 4,
  title: "Two per Beat",
  objective: "I can split a beat in two with [ ] and write hats that play twice on every beat.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R05"],
  practises: [],
  terms: [{ id: "term.subdivision", step: "S4" }],
  canDo: ["cd.code.subdivision"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two kinds of hats",
      minutes: 0.5,
      ui: { panels: ROLL, band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-hats-double",
        version: 1,
        role: "practice",
        prompt:
          "Listen to Loop 1, then Loop 2. No counting yet: listen for what Loop 2 does to the feel of the groove.",
        skills: [{ skill: "R05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: QUARTER_GROOVE, caption: "Kick, snare and a plain hats line.", bars: 4 },
          { code: HOOK, caption: "The same kick and snare, with the hats in brackets.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Hats per beat",
      minutes: 0.75,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      exercise: {
        kind: "identify",
        id: "which-one-moves",
        version: 1,
        role: "practice",
        prompt: "Count 1, 2, 3, 4 along with each version. Pick the one where two hats fit into every beat.",
        skills: [{ skill: "R05", w: 1 }],
        hints: ladder(
          "Count the hats in one beat of each version. While you say one number, how many hats go by?",
          "Listen to the hats only, against the kick and snare: one hat each, or two?",
          "In one version every hat lands together with a kick or a snare. That is the one-per-beat version.",
        ),
        // The stimulus is card A; the learner can audition both cards.
        stimulus: { src: "code", code: QUARTER_GROOVE, bars: 2, loop: true, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "A", label: "Version A", audio: QUARTER_GROOVE },
            { id: "B", label: "Version B", audio: HOOK },
          ],
        },
        correct: { choice: ["B"] },
        tests: [
          { name: "version B", response: { answer: { choice: ["B"] } }, expect: "pass" },
          {
            name: "version A",
            response: { answer: { choice: ["A"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "Read the brackets",
      minutes: 0.5,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      example: { id: "one-pair", code: groove("[hh hh] hh hh hh"), bars: 2 },
      exercise: {
        kind: "predict",
        id: "count-the-hats",
        version: 1,
        role: "practice",
        prompt:
          'The hats line reads `s("[hh hh] hh hh hh")`. Predict how many hats play in one bar, and enter that number.',
        skills: [{ skill: "R05", w: 1 }],
        hints: null,
        tests: [],
        code: groove("[hh hh] hh hh hh"),
        bars: 2,
        mode: "count",
        correct: 5,
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "One beat, two hats",
      minutes: 1,
      ui: { panels: ROLL },
      exercise: {
        kind: "run-investigate",
        id: "one-beat-two-hats",
        version: 1,
        role: "practice",
        prompt:
          "Count along with the hats, 1 and 2 and 3 and 4 and, until you can say the and of every beat. Then click the hat on the and of 1 on the roll.",
        skills: [{ skill: "R05", w: 1 }],
        // The catalog line says only "Listen again and compare": this one says where to look.
        feedbackText: {
          "investigate.not-here":
            "Not that one. The first pair in brackets takes up beat 1, and the and is halfway through it.",
        },
        hints: ladder(
          "The and of 1 is halfway between beat 1 and beat 2. Which hats share beat 1 with the kick?",
          "Each pair in brackets takes up one beat: the first hat is on the number, the second on the and.",
          "The first pair belongs to beat 1. The hat on 1 itself plays with the kick.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 2,
        questions: [
          {
            q: "click-roll",
            prompt: "Click the hat on the and of 1.",
            target: { drum: "hatClosed", beat: 1.5 },
          },
        ],
        tests: [
          {
            name: "the second hat of the first pair",
            response: { click: { from: AND_OF_ONE, to: AND_OF_ONE + 2 } },
            expect: "pass",
          },
          {
            name: "the hat on 1",
            response: { click: { from: ON_ONE, to: ON_ONE + 2 } },
            expect: "fail",
            feedback: ["investigate.not-here"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Eighth hats",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "eighth-hats",
        version: 1,
        role: "check",
        prompt:
          "Make the hats play two per beat in all four beats, eight in the bar. Leave the kick and snare as they are.",
        skills: [{ skill: "R05", w: 1 }],
        code: { starter: `${TEMPO}${KICK}\n${SNARE}\nhats: s("⟪hh hh hh hh⟫")` },
        reference: { solutions: [HOOK], bars: 1 },
        matcher: DRUM_EVENTS,
        target: { audible: true, showRoll: true },
        // The catalog says "1&" and "1e" and names the hat "hatClosed": these say where in the lesson's words.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: the {track} line has no hit here yet. An & after a number means the second half of that beat.",
          "rhythm.extra":
            "Bar {bar}: one hit too many on the {track} line. Every beat gets two hats, no more.",
        },
        hints: ladder(
          "Every beat gets two hats. How many hats does the bar need then?",
          "Each of the four words is one beat. Brackets turn one beat into two sounds.",
          "The first beat becomes `[hh hh]`. The other three need the same.",
        ),
        srs: [
          { family: "fam.code.mini", mode: "review-if-due" },
          { family: "fam.rhy.echo", mode: "seed" },
        ],
        tests: [
          { name: "reference", response: { code: HOOK }, expect: "pass" },
          { name: "with a star", response: { code: groove("hh*8") }, expect: "pass" },
          { name: "a bracket, repeated", response: { code: groove("[hh hh]*4") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: groove("hh hh hh hh") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "four squeezed into the whole bar",
            response: { code: groove("[hh hh hh hh]") },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "only the first beat split",
            response: { code: groove("[hh hh] hh hh hh") },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "four per beat",
            response: { code: groove("hh*16") },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "A kick on the and",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "kick-on-the-and",
        version: 1,
        role: "check",
        prompt:
          "The kick plays only on 1. Add a second kick on the and of 2, and nowhere else. The and of 2 is the second half of beat 2, and beat 2 is the second word of the kick line.",
        skills: [{ skill: "R05", w: 1 }],
        code: { starter: `${TEMPO}kick: s("⟪bd ~ ~ ~⟫")\n${SNARE}\nhats: s("${EIGHTHS}")` },
        reference: { solutions: [groove(EIGHTHS, 'kick: s("bd [~ bd] ~ ~")')], bars: 1 },
        matcher: DRUM_EVENTS,
        target: { audible: true, showRoll: true },
        // The learner's real misses: a kick on beat 3 ("just before beat 3" pulled them there) and on beat 2.
        // The catalog says "2&", a label this lesson never taught: these say where, in the lesson's words.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: the {track} line has no hit here yet. An & after a number means the second half of that beat.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: one hit too many on the {track} line. The new kick belongs in the second half of beat 2 and nowhere else.",
        },
        hints: ladder(
          "Say the count with the hats, 1 and 2 and 3 and 4 and. Which hat falls on the and of 2?",
          "The second word of the kick line, a `~` for now, is beat 2. A kick on its second half needs that beat split in two with brackets, as the hats split theirs.",
          "Split beat 2 into two halves inside brackets, silent first and kick second: the same shape as `[~ hh]`.",
        ),
        tests: [
          {
            name: "reference",
            response: { code: groove(EIGHTHS, 'kick: s("bd [~ bd] ~ ~")') },
            expect: "pass",
          },
          {
            // Drum hits are one-shots: `[bd ~]` on beat 1 sounds exactly like `bd` (regression: the exact
            // rhythm matcher once failed it for the length of its slot).
            name: "beat 1 split as well",
            response: { code: groove(EIGHTHS, 'kick: s("[bd ~] [~ bd] ~ ~")') },
            expect: "pass",
          },
          {
            name: "the same kicks on a drum machine",
            response: { code: groove(EIGHTHS, 'kick: s("bd [~ bd] ~ ~").bank("RolandTR909")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: groove(EIGHTHS, 'kick: s("bd ~ ~ ~")') },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "kick on 3 instead",
            response: { code: groove(EIGHTHS, 'kick: s("bd ~ bd ~")') },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
          {
            name: "kept a kick on 3 as well",
            response: { code: groove(EIGHTHS, 'kick: s("bd [~ bd] bd ~")') },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "ear",
      title: "Count the clap",
      minutes: 1.25,
      graded: true,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      exercise: {
        kind: "identify",
        id: "count-the-clap",
        version: 1,
        role: "check",
        prompt:
          "The hats count 1 and 2 and 3 and 4 and. A single clap lands in bar 2: pick the count it lands on.",
        skills: [{ skill: "R05", w: 1 }],
        hints: [
          { text: "Count out loud with the hats through bar 1, then keep counting into bar 2." },
          { text: "Is the clap with a number, or between two numbers on an and?" },
          { text: "Listen again slower and say the count with the hats.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.rhy.count", level: 1 },
        cue: { context: "none", countInBars: 1, click: false, replays: 3 },
        answer: {
          ui: "choice",
          options: [
            { id: "1", label: "1" },
            { id: "1&", label: "1 and" },
            { id: "2", label: "2" },
            { id: "2&", label: "2 and" },
            { id: "3", label: "3" },
            { id: "3&", label: "3 and" },
            { id: "4", label: "4" },
            { id: "4&", label: "4 and" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.rhy.count", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your eighth-note groove",
      minutes: 2.5,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "code-make",
        id: "your-eighth-groove",
        version: 1,
        role: "practice",
        prompt:
          "Write the groove for both loud parts of your song. Split at least one beat in two with `[ ]`, on any line: two sounds in one beat, or one sound on the second half of a beat.",
        skills: [{ skill: "R05", w: 1 }],
        code: { starter: QUARTER_GROOVE },
        bars: [1, 2],
        saveAs: "sketch",
        rubric: [
          {
            id: "brackets",
            label: "At least one beat split in two on any line, with `[ ]`",
            required: true,
            skills: ["R05"],
            // The effect, not the brackets: `[hh hh hh hh]` over the whole bar is four quarter notes.
            rule: "custom",
            fn: "split-beat",
            params: { alsoUses: ["tb.mini.sub"] },
          },
          {
            id: "backbeat",
            label: "Snare on beats 2 and 4 in every bar",
            required: false,
            skills: ["R04"],
            rule: "onsets",
            track: "@drums",
            drum: "snare",
            contains: [
              [1, 4],
              [3, 4],
            ],
            perBar: true,
          },
          {
            id: "kick-on-an-and",
            label: "A kick on the and of 2 in every bar",
            required: false,
            skills: ["R05"],
            rule: "onsets",
            track: "@drums",
            drum: "kick",
            contains: [[3, 8]],
            perBar: true,
          },
        ],
        hints: ladder(
          "Pick one beat of one line and put two sounds in it. Which line would sound busier that way?",
          "Pick one beat of one line and put two words in brackets there.",
          "The hats are the usual place: `[hh hh]` on every beat. A kick in `[~ bd]` pushes the groove.",
        ),
        tests: [
          { name: "minimal", response: { code: groove("hh hh hh [hh hh]") }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: `${TEMPO}kick: s("bd [~ bd] ~ [~ bd]").bank("RolandTR909")\nsnare: s("~ sd ~ sd").bank("RolandTR909")\nhats: s("[hh hh] [hh oh] [hh hh] [hh oh]").bank("RolandTR909").gain(.5)`,
            },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: QUARTER_GROOVE },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "brackets round the whole bar: four quarter notes, no beat split",
            response: { code: groove("[hh hh hh hh]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a kick pushed off beat 2 with `[~ bd]`",
            response: {
              code: `${TEMPO}kick: s("bd [~ bd] ~ ~")\nsnare: s("~ sd ~ sd")\nhats: s("hh hh hh hh").gain(.5)`,
            },
            expect: "pass",
          },
          {
            name: "an eighth-note fill on beat 4 of the snare",
            response: {
              code: `${TEMPO}kick: s("bd ~ bd ~")\nsnare: s("~ sd ~ [sd sd]")\nhats: s("hh hh hh hh").gain(.5)`,
            },
            expect: "pass",
          },
          {
            name: "eighths with a star, no brackets",
            response: { code: groove("hh*8") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
