// A2.L01 Roles & Registers (the A2 exemplar; spec: content/specs/A2.md). Every part of an arrangement has a job
// and a height to do it at: the bass low, the chords in the middle, the tune above them. Two notes a third apart
// sound clear in the middle of the keyboard and blur into one rumble low down, so chords voiced down in the
// bass's octave turn the low end to mud. Oak's spectrum panel (`.fscope()`, unlocked here) draws where each part
// sits, low on the left, high on the right.
//
// Written for the learner at the gate (AUTHORING §20.1): A2 opens after U10.CP, and the track's order puts A1.L07
// before it, so a learner here may not have met dominant sevenths, the blues, swing or `crunch` (U11). The loop
// is the A2 loop: A minor at 90 BPM, i–VI–III–VII (Am F C G) over `band.aeolian-4bar`'s drums, with the bass, the
// chords and the tune in the learner's code. The chords are written as degree stacks (`n("[0,2,4]")`, U04.L03)
// so their height is the learner's own: `voicing()` output is never graded by octave (contracts §6.7 item 1).
//
// The corrections-pass standard (AUTHORING §20.2), on both graded code steps:
// - every required rule checks what is HEARD: S5 compares the tune's sounding pitches (an `events` match at
//   absolute pitch), and the Make reads the lowest and highest chord notes that sound (`range`); a part more than
//   24 dB under the loudest is left out by the grader, so chords turned down to nothing fail;
// - each pins a WRONG answer that uses the right function (the octave in `.scale("A3:minor")` moved the wrong way
//   or by two, the bass moved instead of the chords) and passes three OTHER right answers (every degree raised by
//   seven, note names, another sound, a hand-written stack).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 90;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The A2 loop's bass: the roots of Am F C G, low (A1 is 55 times a second). */
const BASS = 'bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)';
/** Am F C G as close triads that move by the shortest way (A C E, F A C, C E G, G B D). */
const CHORD_DEGREES = "<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>";
const chords = (at: string, tail = "") =>
  `chords: n("${CHORD_DEGREES}").scale("${at}:minor").s("piano").gain(.6)${tail}`;
/** E C A | C A | E C E | B G: every note on a beat is in its chord. */
const TUNE = "<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>";
const tune = (at: string, tail = "") =>
  `mel: n("${TUNE}").scale("${at}:minor").s("square").lpf(2000).gain(.5)${tail}`;

/** Everything an octave too low: the chords sit on the bass, the tune where the chords belong. */
const CROWDED = code(BASS, chords("A2"), tune("A3"));
/** Each part at its own height: bass under C3, chords from C3 to E4, the tune above them. */
const CLEAR = code(BASS, chords("A3"), tune("A4"));

/** S2: one A minor triad, close, at three heights, a bar each. */
const THREE_HEIGHTS = 'chords: note("<[a1,c2,e2] [a2,c3,e3] [a3,c4,e4]>").s("piano")';
/** S3: the bass alone, then the chords alone, then the tune alone, with the spectrum. */
const ONE_AT_A_TIME = code(
  'bass: note("<a1 ~ ~>").s("sawtooth").lpf(400)',
  'chords: n("<~ [0,2,4] ~>").scale("A3:minor").s("piano").gain(.6)',
  'mel: n("<~ ~ [4 2 0 2]>").scale("A4:minor").s("square").lpf(2000).gain(.5).fscope()',
);
/** S4: the same two notes, three half steps apart, at three heights. */
const SAME_GAP = 'chords: note("<[a1,c2] [a2,c3] [a3,c4]>").s("piano").fscope()';

/** S5: the chords are in place; the tune sits on top of them. */
const LIFT_STARTER = code(
  BASS,
  chords("A3"),
  'mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("⟪A3⟫:minor").s("square").lpf(2000).gain(.5)',
);
const lifted = (line: string) => code(BASS, chords("A3"), line);
const LIFT_SOLUTION = lifted(tune("A4"));

/** S6: the chords in place, the tune dropped onto the bass. */
const TUNE_ON_THE_BASS = code(BASS, chords("A3"), tune("A1"));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.aeolian-4bar", tracks: ["drums"] } as const;

export default defineLesson({
  id: "A2.L01",
  version: 4,
  title: "Roles & Registers",
  objective: "I can give each part its own height, so the low end stays clear, and see it on the spectrum.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D08"],
  practises: [],
  terms: [
    { id: "term.spectrum", step: "S3" },
    { id: "term.register", step: "S5" },
  ],
  canDo: ["cd.code.registers"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Crowded and clear",
      minutes: 0.5,
      ui: { panels: ROLL, band: DRUMS },
      example: { id: "hook", code: CLEAR, bars: 4 },
      exercise: {
        kind: "listen",
        id: "crowded-and-clear",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the lowest sounds in both loops. The notes are the same; in loop 1 the chords and the tune sit an octave lower. Listen for the loop where you can follow the bass as its own line under the chords.",
        skills: [{ skill: "D08", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: CROWDED,
            caption: "Loop 1: the chords and the tune an octave lower.",
            bars: 4,
          },
          {
            code: CLEAR,
            caption: "Loop 2: the chords and the tune an octave higher than in loop 1.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which is least clear?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "which-is-least-clear",
        version: 1,
        role: "practice",
        prompt:
          "One A minor chord, A C E, plays close together at three heights: low in bar 1, in the middle in bar 2, higher in bar 3. Predict which bar will sound the least clear. Pick it, then listen.",
        skills: [{ skill: "D08", w: 1 }],
        hints: null,
        tests: [],
        code: code(THREE_HEIGHTS),
        bars: 3,
        mode: "choose",
        choices: [
          { id: "low", label: "Bar 1, the lowest" },
          { id: "middle", label: "Bar 2, in the middle" },
          { id: "high", label: "Bar 3, the highest" },
        ],
        correct: ["low"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where each part sits",
      minutes: 1,
      ui: { panels: NONE, initialPanels: ["spectrum"] },
      example: { id: "one-at-a-time", code: ONE_AT_A_TIME, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "where-each-part-sits",
        version: 1,
        role: "practice",
        prompt:
          "Watch the panel `.fscope()` opens: it draws each sound by how fast it shakes, slow (low) on the left, fast (high) on the right. Bar 1 plays the bass alone, bar 2 the chords, bar 3 the tune. Answer two questions: whose peaks start furthest left, and how many times a second the chords' lowest note repeats.",
        skills: [{ skill: "D08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch where each bar's peaks start: the lower a part plays, the further left they begin. a3 is two octaves above a1.",
        },
        hints: ladder(
          "Find the low side of the panel first: slow shaking is drawn on the left. Which part plays lowest?",
          "Low notes shake slowly, so they are drawn on the left. An octave up doubles the number.",
          "a2 is twice 55. Go up one more octave.",
        ),
        code: { starter: ONE_AT_A_TIME },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Whose peaks start furthest to the left?",
            options: [
              { id: "bass", label: "Bar 1, the bass" },
              { id: "chords", label: "Bar 2, the chords" },
              { id: "tune", label: "Bar 3, the tune" },
            ],
            correct: ["bass"],
          },
          {
            q: "number",
            prompt:
              "The bass's a1 repeats 55 times a second. The chords' lowest note, a3, is two octaves above it: how many times a second?",
            correct: 220,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bass"], number: 220 } }, expect: "pass" },
          {
            name: "the tune for the lowest",
            response: { answer: { choice: ["tune"], number: 220 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one octave counted",
            response: { answer: { choice: ["bass"], number: 110 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Same gap, three heights",
      minutes: 1,
      ui: { panels: NONE, initialPanels: ["spectrum"] },
      example: { id: "same-gap", code: code(SAME_GAP), bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "same-gap",
        version: 1,
        role: "practice",
        prompt:
          "A and C play together in three bars: low in bar 1, in the middle in bar 2, higher in bar 3. Listen and watch the two peaks in each bar. Answer two questions: in which bar the two notes blur into one rough sound, and how many half steps apart they are.",
        skills: [{ skill: "D08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the keys from A up to C, the black ones too. Then listen for the bar where you can no longer hear two notes, only one rough sound.",
        },
        hints: ladder(
          "Listen for the bar where you can no longer pick out two separate notes. Which bar is it?",
          "Count the half steps from A to C on the keyboard: A to A♯ is one.",
          "A, A♯, B, C. In bar 1 the two peaks crowd together at the left.",
        ),
        code: { starter: code(SAME_GAP) },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "In which bar do the two notes blur into one rough sound?",
            options: [
              { id: "low", label: "Bar 1, the lowest" },
              { id: "middle", label: "Bar 2" },
              { id: "high", label: "Bar 3, the highest" },
            ],
            correct: ["low"],
          },
          { q: "number", prompt: "How many half steps apart are the two notes in each bar?", correct: 3 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["low"], number: 3 } }, expect: "pass" },
          {
            name: "the highest for the blur",
            response: { answer: { choice: ["high"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step counted",
            response: { answer: { choice: ["low"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Lift the tune",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "lift-the-tune",
        version: 1,
        role: "check",
        prompt:
          "Move the whole tune, the `mel` line, up one octave so it plays above the chords. Keep its notes and rhythm, and leave the bass and chords lines as they are. Done when every tune note sounds one octave higher than now.",
        skills: [{ skill: "D08", w: 1 }],
        code: { starter: LIFT_STARTER },
        reference: { solutions: [LIFT_SOLUTION], bars: 4 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["mel"],
        },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "melody.octave":
            "Bar {bar}, {beatLabel}: the right note, {dir} than the target. The tune moves up by one octave, the whole line at once.",
        },
        hints: ladder(
          "The tune's height is set in the `mel` line, not in its notes. Which number there says how high it plays?",
          "In `.scale()` the letter is home and the number after it is the octave: the higher the number, the higher the line.",
          'The chords sit at A3 and the tune starts there too. One octave is one step of that number; the bass\'s "a1" is two below the chords.',
        ),
        tests: [
          { name: "reference", response: { code: LIFT_SOLUTION }, expect: "pass" },
          {
            name: "every degree raised by seven, the octave left at A3",
            response: {
              code: lifted(
                'mel: n("<[11 ~ 9 7] [9 ~ 7 ~] [11 9 11 ~] [8 ~ 13 ~]>").scale("A3:minor").s("square").lpf(2000).gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the same notes written by name",
            response: {
              code: lifted(
                'mel: note("<[e5 ~ c5 a4] [c5 ~ a4 ~] [e5 c5 e5 ~] [b4 ~ g5 ~]>").s("square").lpf(2000).gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "lifted and given another sound",
            response: { code: lifted(`mel: n("${TUNE}").scale("A4:minor").s("triangle").gain(.6)`) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: lifted(tune("A3")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "two octaves up",
            response: { code: lifted(tune("A5")) },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "down an octave instead",
            response: { code: lifted(tune("A2")) },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "the right move on the wrong line: the chords lifted, the tune left",
            response: { code: code(BASS, chords("A4"), tune("A3")) },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "lifted, then turned down until it is not heard",
            response: { code: lifted(tune("A4").replace(".gain(.5)", ".gain(.02)")) },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Who crowds the bass?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "who-crowds-the-bass",
        version: 1,
        role: "check",
        prompt:
          "Listen to the loop: one part has moved down until it plays where the bass plays. Pick the part that crowds the bass.",
        skills: [{ skill: "D08", w: 1 }],
        hints: [
          {
            text: "Listen only to the lowest sounds. Is one line playing down there, or two tangled together?",
          },
          {
            text: "The chords move together as a block of three notes; the tune is one note at a time and moves more often.",
          },
          { text: "Hear it again, slower, and follow the lowest sound.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: TUNE_ON_THE_BASS, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "chords", label: "The chords" },
            { id: "tune", label: "The tune" },
            { id: "none", label: "Neither: every part has its own height" },
          ],
        },
        correct: { choice: ["tune"] },
        feedbackText: {
          "id.wrong":
            "Not this one. Down at the bottom, one note at a time was moving against the bass: the tune, three octaves below its place.",
        },
        srs: [{ family: "fam.snd.roles", mode: "seed" }],
        tests: [
          { name: "the tune", response: { answer: { choice: ["tune"] } }, expect: "pass" },
          {
            name: "the chords",
            response: { answer: { choice: ["chords"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "neither",
            response: { answer: { choice: ["none"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Give each part its place",
      minutes: 2.75,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "give-each-part-its-place",
        version: 1,
        role: "practice",
        prompt:
          "The chords and the tune play an octave too low. Move the chords up so no chord note is below C3. Put the tune from C4 up; keep the bass below C3. Then add a fourth line, such as an FM bell or a supersaw pad. It plays your song's first verse. Done when the chords sit from C3 up.",
        skills: [{ skill: "D08", w: 1 }],
        code: { starter: CROWDED },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "chords-off-the-bass",
            label: "Every chord note from C3 up to C6, out of the bass's octave",
            required: true,
            skills: ["D08"],
            rule: "range",
            track: "chords",
            within: ["c3", "c6"],
          },
          {
            id: "tune-on-top",
            label: "Every tune note from C4 up to C7",
            required: false,
            skills: ["D08"],
            rule: "range",
            track: "mel",
            within: ["c4", "c7"],
          },
          {
            id: "bass-low",
            label: "Every bass note below C3",
            required: false,
            skills: ["D08"],
            rule: "range",
            track: "bass",
            within: ["c1", "b2"],
          },
          {
            id: "a-fourth-part",
            label: "At least four lines in your code",
            required: false,
            skills: ["D08"],
            rule: "tracks",
            min: 4,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Find the lines that play in the same octave as the bass. Which ones are they?",
          "The number in each `.scale()` is that line's octave. The chords and the tune are both one too low.",
          "Start with the chords: one octave up puts their lowest note at C3.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: CROWDED },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the chords up an octave",
            response: { code: code(BASS, chords("A3"), tune("A3")) },
            expect: "pass",
          },
          { name: "every part at its own height", response: { code: CLEAR }, expect: "pass" },
          {
            name: "made its own: a strings pad high above the tune and a lead with vibrato",
            response: {
              code: code(
                BASS,
                chords("A3"),
                tune("A4", ".vib(5).vibmod(.2)"),
                'pad: n("<[0,4] [-2,2] [-5,-1] [-1,3]>").scale("A5:minor").s("strings").gain(.3)',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: an electric bass, the tune on a triangle, the spectrum open",
            response: {
              code: code(
                'bass: note("<a1 f1 c2 g1>").s("ebass").lpf(600)',
                chords("A3", ".room(.3)"),
                `mel: n("${TUNE}").scale("A4:minor").s("triangle").gain(.6).fscope()`,
              ),
            },
            expect: "pass",
          },
          {
            name: "the chords written by hand in the middle",
            response: {
              code: code(
                BASS,
                'chords: note("<[a3,c4,e4] [f3,a3,c4] [c3,e3,g3] [g3,b3,d4]>").s("piano").gain(.6)',
                tune("A4"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the chords moved down an octave instead",
            response: { code: code(BASS, chords("A1"), tune("A4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right move on the wrong line: the bass dropped, the chords left on it",
            response: {
              code: code('bass: note("<a0 f0 c1 g0>").s("sawtooth").lpf(400)', chords("A2"), tune("A4")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chords lifted, then turned down until they are not heard",
            response: { code: code(BASS, chords("A3").replace(".gain(.6)", ".gain(.02)"), tune("A4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
