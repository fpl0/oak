// U01.L08 Three to a Bar. A bar can hold three beats: the waltz, and meter as beats per bar, with one
// 2/4 march heard once for contrast. The lesson is in 3/4, so every code string's tempo line is
// `setcpm(bpm/3)`; the march sets `meter: "2/4"` on its own exercise. Tools in reach: everything up to
// U01.L07, plus the 3/4 and 2/4 tempo lines. Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 108;
const TEMPO = `setcpm(${BPM}/3)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const drums = (pattern: string) => `drums: s("${pattern}")`;
const HATS = 'hats: s("hh*6").gain(.5)';

/** The hook: oom-pah-pah on the drums, kick on 1 and snares on 2 and 3, eighth hats over it. */
const HOOK = code(drums("bd sd sd"), HATS);
/** The contrast: a march, two beats to the bar. */
const MARCH = 'setcpm(100/2)\n\ndrums: s("bd sd")\nhats: s("hh*4").gain(.5)';
/** A realistic S5 mistake: the tempo line turned back to four beats a bar. */
const fourFour = (pattern: string) => `setcpm(108/4)\n\n${drums(pattern)}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Seconds of the n-th target at `bpm`, `every` beats apart (tap tests are relative to the stimulus start). */
const beatTimes = (bpm: number, n: number, every = 1, offset = 0) =>
  Array.from({ length: n }, (_, i) => Number(((i * every + offset) * (60 / bpm)).toFixed(3)));

/** The waltz Band: bass on 1, chords on 2 and 3, in three like the lesson. */
const BAND = { band: "band.waltz-vamp", tracks: ["bass", "chords"] } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U01.L08",
  version: 3,
  title: "Three to a Bar",
  objective: "I can hear a groove in three, write a waltz with setcpm(bpm/3), and tell three from four.",
  key: { tonic: "C", mode: "major" },
  meter: "3/4",
  bpm: BPM,
  introduces: ["R08"],
  practises: [],
  terms: [
    { id: "term.meter", step: "S3" },
    { id: "term.time-signature", step: "S4" },
  ],
  canDo: ["cd.hear.meter"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Count to three",
      minutes: 0.5,
      ui: { panels: ROLL, band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "count-to-three",
        version: 1,
        role: "practice",
        prompt:
          "Count along from the kick: 1, 2, 3, 4. Listen for whether a count of four fits, or the kick comes back sooner.",
        skills: [{ skill: "R08", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "The kick starts each bar. Count from one kick to the next.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap on 1",
      minutes: 1.25,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "tap",
        id: "tap-on-one",
        version: 1,
        role: "practice",
        prompt:
          "Tap only on the kick, the low thump on beat 1 of every bar: one tap per bar, four taps in all. Do not tap the two snares after it; count 2, 3 in your head instead.",
        skills: [
          { skill: "R08", w: 0.5 },
          { skill: "E01", w: 0.5 },
        ],
        hints: ladder(
          "Tap the kick only, once per bar. Which drum starts every bar?",
          "The kick plays once a bar, then two snares follow it.",
          "Count 1, 2, 3 out loud with the drums and tap on every 1.",
        ),
        mode: "along",
        meter: "3/4",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { drum: ["kick"] },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A kick went by without a tap. Count 1, 2, 3 and tap on every 1.",
          "tap.extra": "A tap landed between kicks: only beat 1 of each bar gets one.",
        },
        srs: [{ family: "fam.rhy.meter", mode: "seed" }],
        tests: [
          { name: "on every 1", response: { taps: beatTimes(BPM, 4, 3) }, expect: "pass" },
          { name: "on every beat", response: { taps: beatTimes(BPM, 12) }, expect: "fail" },
          { name: "counted in four", response: { taps: beatTimes(BPM, 3, 4) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Read the tempo line",
      minutes: 1,
      ui: { panels: ROLL },
      exercise: {
        kind: "run-investigate",
        id: "read-the-tempo-line",
        version: 1,
        role: "practice",
        prompt:
          "Compare the first line with the tempo lines you have written so far. Then change the drums line to `bd sd sd sd`, listen to the bar, and answer the two questions below.",
        skills: [{ skill: "R08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare `setcpm(108/3)` with the `setcpm(96/4)` you wrote before, and count the beats of a bar while it plays.",
        },
        hints: ladder(
          "Compare the `/3` here with the `/4` you used before. What did the `/4` in `setcpm(96/4)` stand for?",
          "The first number is the beats per minute; the second says how many beats make one bar.",
          "With four words in a three-beat bar, each word gets less than a beat.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What does the `/3` in `setcpm(108/3)` say?",
            options: [
              { id: "three-beats", label: "Each bar holds three beats" },
              { id: "slower", label: "The groove plays three times slower" },
              { id: "three-drums", label: "Three drums play at once" },
            ],
            correct: ["three-beats"],
          },
          {
            q: "number",
            prompt: "With `bd sd sd sd` on the drums line, how many beats long is the bar?",
            correct: 3,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["three-beats"], number: 3 } },
            expect: "pass",
          },
          {
            name: "three times slower",
            response: { answer: { choice: ["slower"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "thought the bar grows",
            response: { answer: { choice: ["three-beats"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "listen",
      title: "Two to a bar",
      minutes: 0.5,
      // No Band: the waltz vamp plays in three and would fight a march in two.
      ui: { panels: ROLL, band: false },
      exercise: {
        kind: "listen",
        id: "two-to-a-bar",
        version: 1,
        role: "practice",
        prompt:
          "Count along with the march, 1, 2, 1, 2. Listen for how its step of two moves compared with the waltz's three.",
        skills: [{ skill: "R08", w: 1 }],
        meter: "2/4",
        hints: null,
        tests: [],
        items: [{ code: MARCH, caption: "Kick and snare, two beats to the bar.", bars: 4 }],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Make it a waltz",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "make-it-a-waltz",
        version: 1,
        role: "check",
        prompt:
          "Change the drums line to three words, one per beat: `bd` on beat 1, then `sd` on beats 2 and 3. Leave the tempo line as it is: it already makes bars of three.",
        skills: [{ skill: "R08", w: 1 }],
        code: { starter: code(drums("⟪bd sd bd sd⟫")) },
        reference: { solutions: [code(drums("bd sd sd"))], bars: 2 },
        // Drum hits are one-shots: only where they start matters, never the length of their slot.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, sound: "drum-role" },
        constraints: [{ c: "tempo", bpm: BPM }],
        target: { audible: true, showRoll: true },
        // The catalog says "missing hit" and "extra hit": these say what the bar of three holds.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: no hit here yet{role}. The bar holds three beats: `bd`, then `sd`, then `sd`.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a hit that should not be there{role}. The bar holds three beats: `bd`, then `sd`, then `sd`.",
        },
        hints: ladder(
          "Write one word per beat, three words for a bar of three. How many words does the line hold now?",
          "Each word in the quotes takes an equal share of the bar. Four words in three beats are each shorter than a beat.",
          "Beat 1 stays `bd`. Beats 2 and 3 both get `sd`.",
        ),
        srs: [{ family: "fam.rhy.meter", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: code(drums("bd sd sd")) }, expect: "pass" },
          { name: "with !", response: { code: code(drums("bd sd!2")) }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: code(drums("bd sd bd sd")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "four sounds in the bar",
            response: { code: code(drums("bd sd sd sd")) },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
          {
            name: "dropped the last snare, kept the second kick",
            response: { code: code(drums("bd sd bd")) },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
          {
            name: "changed the tempo line back to four",
            response: { code: fourFour("bd sd sd") },
            expect: "fail",
            feedback: ["code.tempo"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Three or four?",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "three-or-four",
        version: 1,
        role: "check",
        prompt:
          "Listen to four bars of a groove. Count from one kick to the next, then pick whether it is in three or in four.",
        skills: [{ skill: "R08", w: 1 }],
        hints: [
          { text: "Count the beats from one kick to the next. Where does the loudest kick come back?" },
          { text: "Count from one kick to the next: 1, 2, 3 or 1, 2, 3, 4." },
          { text: "Listen again slower and count out loud.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.rhy.meter", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "3/4", label: "In three (3/4)" },
            { id: "4/4", label: "In four (4/4)" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.rhy.meter", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your waltz",
      minutes: 2.5,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "code-make",
        id: "your-waltz",
        version: 1,
        role: "practice",
        prompt:
          "Write a groove in three: a drum sound on each of the three beats of every bar. The starter leaves beat 2 silent.",
        skills: [{ skill: "R08", w: 1 }],
        code: { starter: code(drums("bd ~ sd")) },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "three-beats",
            label: "A drum sound starts on each of the three beats, in every bar",
            required: true,
            skills: ["R08"],
            rule: "onsets",
            track: "@drums",
            contains: [
              [0, 1],
              [1, 3],
              [2, 3],
            ],
            perBar: true,
          },
          {
            id: "kick-on-one",
            label: "The kick plays on beat 1 and nowhere else",
            required: false,
            skills: ["R08"],
            rule: "onsets",
            track: "@drums",
            drum: "kick",
            equals: [[0, 1]],
            perBar: true,
          },
          {
            id: "two-lines",
            label: "At least two drum lines, for example hats on top",
            required: false,
            skills: ["R04"],
            rule: "tracks",
            min: 2,
            roles: ["drums"],
          },
        ],
        hints: ladder(
          "Each of the three beats needs a sound. Which beat of the starter is silent?",
          "The `~` sits on beat 2. A waltz wants all three beats heard.",
          "Put a `sd` or a `hh` where the `~` is, or add a hats line that plays on every beat.",
        ),
        tests: [
          {
            name: "the starter: beat 2 is silent",
            response: { code: code(drums("bd ~ sd")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: code(drums("bd sd sd")) }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: code(
                'kick: s("bd ~ ~")',
                'snare: s("<[~ sd sd] [~ sd [sd sd]] [~ sd sd] [~ [sd sd] [ht lt]]>")',
                'hats: s("[hh hh] [hh oh] [hh hh]").gain(.5)',
                'perc: s("<cr ~ ~ ~>")',
              ),
            },
            expect: "pass",
          },
          {
            name: "a groove in four",
            response: { code: code(drums("bd sd bd sd")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
