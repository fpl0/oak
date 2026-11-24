// U11.L02 The Minor Pentatonic Riff. The minor pentatonic is 1 ♭3 4 5 ♭7, sung do me fa sol te (do-based minor:
// 1 is still do). Its five notes are the major pentatonic's, started from that scale's 6: A minor pentatonic is
// C major pentatonic from A, the way A minor is C major's relative (U10.L02). A riff is a short figure, a bar or
// two, that repeats; most rock and blues riffs live on these five notes. In code `.scale("A2:minor:pentatonic")`
// (unlocked here), and `n` counts the scale's own five notes: n 1 is ♭3, n 4 is ♭7, n 5 is home an octave up.
// What the learner has: the major pentatonic (U11.L01), natural minor, relative keys and do-based solfège
// (U10, C4 before this lesson), the kick and the bass locked together (U08.L04), `fingerbass` (U08.L05). Not
// yet: blue notes and the blues scale (U11.L03), the dominant seventh (U11.L04). Spec: content/specs/U11.md.
//
// How it is graded: S4 lands the riff on home (`events`, octave-free, so n 0 and n 5 both pass); writing home
// as n 1 plays C, ♭3, and earns `melody.wrong-degree`. S5 is four fixed riffs and tunes in four keys, each over
// a drone on its home note. The Make's required rule is `in-key` with an A minor pentatonic key on the riff's
// track: the starter on A natural minor leans on B and F and fails; any riff on `A2:minor:pentatonic` passes.
// The riff needs no chords: the Band's drums keep time and the rule reads only the riff.
import { defineLesson, type HintLadder, SCALE_COLOUR_OPTIONS } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** A rock beat, one drum a line (U01), for the steps that play without the Band. */
const KIT = ['kick: s("bd ~ ~ bd ~ ~ bd ~")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*8").gain(.5)'] as const;
const PENTA = "minor:pentatonic";
const gtr = (riff: string, scale = `A2:${PENTA}`) => `gtr: n("${riff}").scale("${scale}").s("acgtr")`;
const bass = (riff: string, scale = `A1:${PENTA}`) =>
  `bass: n("${riff}").scale("${scale}").s("fingerbass").lpf(800)`;

/** The hook's riff: A C D E D C, one bar, again and again. */
const RIFF = "0 ~ 1 2 3 2 1 ~";
const RIFF_ALONE = code(gtr(RIFF));
const HOOK = code(...KIT, gtr(RIFF), bass(RIFF));
/** S2: the five notes from home. */
const FIVE = code(gtr("0 1 2 3 4", `A3:${PENTA}`));
/** S3: the scale up to the octave and back down, over the drums. */
const UP_AND_DOWN = code(...KIT, gtr("<[0 1 2 3 4 5 ~ ~] [5 4 3 2 1 0 ~ ~]>"));
/** S4: the riff ends on D, degree 4, up in the air; the learner lands it on home. */
const LAND_STARTER = code(...KIT, gtr("0 ~ 1 2 3 2 ⟪2⟫ ~"));
const LAND_SOLUTION = code(...KIT, gtr("0 ~ 1 2 3 2 0 ~"));

/** S5: a short line over a drone on its home note, one key each. */
const colour = (tonic: string, mode: "minor" | "major", line: string, octave = 3) =>
  code(
    `bass: n("0").scale("${tonic}2:${mode}:pentatonic").s("fingerbass").lpf(800)`,
    `gtr: n("${line}").scale("${tonic}${octave}:${mode}:pentatonic").s("acgtr")`,
  );
const E_MINOR_RIFF = colour("E", "minor", "0 ~ 1 2 3 2 1 0");
const G_MAJOR_TUNE = colour("G", "major", "0 1 2 4 3 ~ 1 0", 4);
const D_MINOR_FROM_B3 = colour("D", "minor", "1 ~ 0 1 2 ~ 1 0");
const F_MAJOR_TUNE = colour("F", "major", "2 1 0 ~ 4 3 2 ~", 4);
const COLOURS = SCALE_COLOUR_OPTIONS.filter((o) => o.id !== "blues");
const COLOUR_WRONG = {
  "id.wrong":
    "Not this one. Find home first, the low note under the line: is the note a 3rd above it a minor or a major 3rd?",
};

/** S6: sung up and down, do me fa sol te do, and back. */
const SING = code(gtr("<[0 1 2 3] [4 5 ~ ~] [5 4 3 2] [1 0 ~ ~]>", `A3:${PENTA}`), bass("0"));

/** The Make starts with a riff on A natural minor: A B C D F E | D C B A. B and F are not in the pentatonic. */
const MAKE_RIFF = "<[0 ~ 1 2 3 ~ 5 4] [3 2 1 ~ 0 ~ ~ ~]>";
const MAKE_STARTER = code(gtr(MAKE_RIFF, "A2:minor"));

/** Drums from the Band in the Make; the riff, and the bass if the learner adds one, are the learner's. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U11.L02",
  version: 4,
  title: "The Minor Pentatonic Riff",
  objective: "I can write a riff on the minor pentatonic, 1 ♭3 4 5 ♭7, and sing it as do me fa sol te.",
  key: { tonic: "A", mode: "minor pentatonic" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S10"],
  practises: [],
  terms: [],
  canDo: ["cd.compose.riff"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.acgtr": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A riff",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "a-riff",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the six-note riff alone, then doubled by a bass over a rock beat. Listen for the riff's last note before the gap: does it sound finished, or does it lean into the next bar?",
        skills: [{ skill: "S10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: RIFF_ALONE, caption: "The riff alone: A C D E D C, round and round.", bars: 2 },
          { code: HOOK, caption: "A bass doubles it an octave down, over a rock beat.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which five?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "which-five",
        version: 1,
        role: "practice",
        prompt:
          'Predict which five notes `n("0 1 2 3 4")` plays on `.scale("A2:minor:pentatonic")`, the riff\'s scale. Pick one answer, then listen to check it.',
        skills: [{ skill: "S10", w: 1 }],
        hints: null,
        tests: [],
        code: FIVE,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "acdeg", label: "A C D E G" },
          { id: "abcde", label: "A B C D E" },
          { id: "acegb", label: "A C E G B" },
        ],
        correct: ["acdeg"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Minor, minus two",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "up-and-down", code: UP_AND_DOWN, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "minor-minus-two",
        version: 1,
        role: "practice",
        prompt:
          "Run the scale up and down and read the degree label on each note in the roll. Then answer two questions: which two degrees of A natural minor it leaves out, and how many of its notes it shares with C major pentatonic, C D E G A.",
        skills: [{ skill: "S10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Natural minor is 1 2 ♭3 4 5 ♭6 ♭7; cross off each label you see on the roll. Then line up the letters A C D E G against C D E G A.",
        },
        hints: ladder(
          "Write out the seven degrees of natural minor, 1 2 ♭3 4 5 ♭6 ♭7, and tick each label you see on the roll. Which are left?",
          "The roll shows 1, ♭3, 4, 5 and ♭7. Natural minor also has a 2 and a ♭6.",
          "A minor pentatonic is A C D E G. Tick off C, D and E in C D E G A, then look for the other two.",
        ),
        code: { starter: UP_AND_DOWN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which two degrees of A natural minor are left out?",
            options: [
              { id: "2-b6", label: "2 and ♭6" },
              { id: "4-b7", label: "4 and ♭7" },
              { id: "b3-5", label: "♭3 and 5" },
            ],
            correct: ["2-b6"],
          },
          {
            q: "number",
            prompt: "How many notes does A minor pentatonic share with C major pentatonic?",
            correct: 5,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["2-b6"], number: 5 } }, expect: "pass" },
          {
            name: "4 and ♭7",
            response: { answer: { choice: ["4-b7"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "C major pentatonic counted as a different set",
            response: { answer: { choice: ["2-b6"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Land it home",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "land-it-home",
        version: 1,
        role: "check",
        prompt:
          "This riff ends on D, degree 4, and hangs in the air before it starts again. Change the highlighted number so the riff's last note is home, A (degree 1). Keep every other note as it is.",
        skills: [{ skill: "S10", w: 1 }],
        code: { starter: LAND_STARTER },
        reference: { solutions: [LAND_SOLUTION], bars: 2 },
        matcher: { m: "events", pitch: "octave-free", rhythm: "onsets", durations: false, tracks: ["gtr"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the riff ends on {got}, the target is {exp}. On this scale `n` counts five notes, A C D E G, so `n` 1 is C, degree ♭3. Write the number that plays A.",
        },
        hints: ladder(
          "Find the riff's first note and its last note on the roll. Which note should the last one be?",
          "The riff starts on home, degree 1. The highlighted number decides where it ends.",
          "Make the last note before the rest the same note as the riff's first, or that note an octave up.",
        ),
        tests: [
          { name: "reference", response: { code: LAND_SOLUTION }, expect: "pass" },
          {
            name: "home an octave up: n 5",
            response: { code: code(...KIT, gtr("0 ~ 1 2 3 2 5 ~")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(...KIT, gtr("0 ~ 1 2 3 2 2 ~")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "degree 1 written as n 1: C, ♭3",
            response: { code: code(...KIT, gtr("0 ~ 1 2 3 2 1 ~")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "moved to A major pentatonic instead",
            response: { code: code(...KIT, gtr("0 ~ 1 2 3 2 2 ~", "A2:major:pentatonic")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Major or minor five?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "major-or-minor-five",
        version: 1,
        role: "check",
        prompt:
          "Listen to four short lines, each over a low note on its home. For each line, pick major pentatonic or minor pentatonic. Listen for the note a 3rd above the low note: 3 sounds bright, ♭3 dark.",
        skills: [{ skill: "S10", w: 1 }],
        hints: ladder(
          "Hold the low note in your ear: it is home. Does the line sound bright or dark against it?",
          "Home is the low note underneath. The major pentatonic has 3 above it; the minor pentatonic has ♭3.",
          "Hum home, then the note a 3rd above it in the line. Do re mi, or do me?",
        ),
        srs: [
          { family: "fam.key.mode", mode: "review-if-due" },
          { family: "fam.deg.fet-minor", mode: "review-if-due" },
        ],
        tests: [],
        parts: [
          {
            kind: "identify",
            id: "line-1",
            version: 1,
            role: "check",
            key: { tonic: "E", mode: "minor pentatonic" },
            prompt: "Line 1. Major pentatonic or minor pentatonic?",
            skills: [{ skill: "S10", w: 1 }],
            hints: ladder(
              "Is the line bright or dark against the low note?",
              "The line starts on home and climbs. Listen to its second note.",
              "Hum home, then the second note of the line. Is it a half step closer to home than mi would be?",
            ),
            stimulus: { src: "code", code: E_MINOR_RIFF, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["minor pentatonic"] },
            feedbackText: COLOUR_WRONG,
            tests: [
              {
                name: "minor",
                response: { answer: { choice: ["minor pentatonic"] } },
                expect: "pass",
              },
              {
                name: "major",
                response: { answer: { choice: ["major pentatonic"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "line-2",
            version: 1,
            role: "check",
            key: { tonic: "G", mode: "major pentatonic" },
            prompt: "Line 2. Major pentatonic or minor pentatonic?",
            skills: [{ skill: "S10", w: 1 }],
            hints: ladder(
              "Is the line bright or dark against the low note?",
              "The line climbs from home in steps. Listen to its third note.",
              "Hum home and climb two notes with the line: do re mi, or do me fa?",
            ),
            stimulus: { src: "code", code: G_MAJOR_TUNE, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["major pentatonic"] },
            feedbackText: COLOUR_WRONG,
            tests: [
              {
                name: "major",
                response: { answer: { choice: ["major pentatonic"] } },
                expect: "pass",
              },
              {
                name: "minor",
                response: { answer: { choice: ["minor pentatonic"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "line-3",
            version: 1,
            role: "check",
            key: { tonic: "D", mode: "minor pentatonic" },
            prompt: "Line 3. Major pentatonic or minor pentatonic?",
            skills: [{ skill: "S10", w: 1 }],
            hints: ladder(
              "This line does not start on home. Which note does it keep returning to?",
              "Home is the low note underneath. The line starts a 3rd above it.",
              "Hum home, then the line's first note. Is that a major or a minor 3rd?",
            ),
            stimulus: { src: "code", code: D_MINOR_FROM_B3, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["minor pentatonic"] },
            feedbackText: {
              "id.wrong": "Find home first: is the note a minor or a major 3rd above it?",
            },
            tests: [
              {
                name: "minor",
                response: { answer: { choice: ["minor pentatonic"] } },
                expect: "pass",
              },
              {
                name: "heard as major: it starts on ♭3",
                response: { answer: { choice: ["major pentatonic"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "line-4",
            version: 1,
            role: "check",
            key: { tonic: "F", mode: "major pentatonic" },
            prompt: "Line 4. Major pentatonic or minor pentatonic?",
            skills: [{ skill: "S10", w: 1 }],
            hints: ladder(
              "Is the line bright or dark against the low note?",
              "The line starts a 3rd above home and walks down to it.",
              "Hum the first note of the line, then home. Is the gap two whole steps, or a step and a half?",
            ),
            stimulus: { src: "code", code: F_MAJOR_TUNE, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COLOURS },
            correct: { choice: ["major pentatonic"] },
            feedbackText: COLOUR_WRONG,
            tests: [
              {
                name: "major",
                response: { answer: { choice: ["major pentatonic"] } },
                expect: "pass",
              },
              {
                name: "minor",
                response: { answer: { choice: ["minor pentatonic"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the five",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-five",
        version: 1,
        role: "practice",
        prompt:
          "Sing the minor pentatonic up and back down, 12 notes: do me fa sol te do, do te sol fa me do. Hear it first, then sing it in your own range. The numbers 1 ♭3 4 5 ♭7 1 stay on screen.",
        skills: [
          { skill: "V02", w: 0.6 },
          { skill: "S10", w: 0.4 },
        ],
        hints: [
          { text: "Hum do, the low note underneath, before you start." },
          { text: "Do to me is the minor 3rd you know from minor. Te sits a whole step under the top do." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: {
          from: "degrees",
          degrees: ["1", "b3", "4", "5", "b7", "1", "1", "b7", "5", "4", "b3", "1"],
          octaves: [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
        },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A riff of your own",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "a-riff-of-your-own",
        version: 1,
        role: "practice",
        // The starter sits on A natural minor; the rule names its own key.
        key: { tonic: "A", mode: "minor" },
        prompt:
          "Write the riff that opens your song. The riff you start with is on A natural minor and leans on B and F: change its scale to the minor pentatonic. Then rework it into one or two bars of your own by changing numbers and rests. Done when every note of the gtr line is on A minor pentatonic.",
        skills: [{ skill: "S10", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "pentatonic-riff",
            label: "Every note of the gtr line is on A minor pentatonic (A C D E G)",
            required: true,
            skills: ["S10"],
            rule: "in-key",
            key: { tonic: "A", mode: "minor pentatonic" },
            minRatio: 1,
            tracks: ["gtr"],
          },
          {
            id: "doubled",
            label: "A bass line playing beside the riff",
            required: false,
            skills: ["B01"],
            rule: "tracks",
            min: 2,
            roles: ["melody", "bass"],
          },
          {
            id: "answered",
            label: "At least half the bars of the gtr line repeat the shape of an earlier bar",
            required: false,
            skills: ["M01"],
            rule: "motif-reuse",
            track: "gtr",
            minRatio: 0.5,
            unitBars: 1,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Look at the scale in the gtr line: it says `A2:minor`. Which two of its notes are not in the minor pentatonic?",
          "The scale word decides which notes the numbers reach. On the minor pentatonic every number lands on A, C, D, E or G.",
          "Write `:pentatonic` after `minor` in the scale. Then change numbers and rests until the riff is yours.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the starter's numbers on the pentatonic",
            response: { code: code(gtr(MAKE_RIFF)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a two-bar riff, doubled by the bass",
            response: {
              code: code(
                gtr("<[0 ~ 0 1 2 ~ 1 0] [3 ~ 2 1 0 ~ 4 ~]>"),
                bass("<[0 ~ 0 1 2 ~ 1 0] [3 ~ 2 1 0 ~ 4 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "a new riff, still on natural minor",
            response: { code: code(gtr("<[0 ~ 1 2 0 ~ 2 1] [0 ~ ~ ~ 4 ~ ~ ~]>", "A2:minor")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
