// U02.L06 Tones & Timbres. The same notes on different sounds: the piano and the four synth waves
// (sine, triangle, square, sawtooth), which unlock here. Notes are names with octaves; `n()` and
// `.scale()` wait for U03.L02. Synth waves are loud, so every wave line carries a gain of .4 to .6.
// Spec: content/specs/U02.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** One labelled line: notes, a sound, then a gain (waves need one; the piano gets the same for balance). */
const line = (label: string, notes: string, sound: string, gain = ".5", extra = "") =>
  `${label}: note("${notes}")${extra}.s("${sound}").gain(${gain})`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band carries drums, bass and chords; the learner's lines sit on top. */
const BAND = { band: "band.two-chord-vamp" } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

const RIFF = "c4 e4 g4 e4";
/** The hook: one riff handed from the piano to three synth waves, one bar each. */
const HOOK = code(line("mel", RIFF, "<piano square sawtooth sine>"));

/** Before U03.L02 the grader's melody feedback speaks in degrees; say it in places and letters instead. */
const LETTER_FEEDBACK = {
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than the target. Check the octave number of each note.",
  "melody.wrong-degree": "Bar {bar}, {beatLabel}: a different note from the one asked for.",
  "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here.",
} as const;

/** S4: four short lines, each on one sound. Different notes each time, so only the sound gives it away. */
const TRIALS = [
  { id: "trial-1", notes: "c4 e4 g4 e4", sound: "square" },
  { id: "trial-2", notes: "g4 e4 d4 c4", sound: "piano" },
  { id: "trial-3", notes: "e4 g4 c5 g4", sound: "sawtooth" },
  { id: "trial-4", notes: "c5 g4 e4 c4", sound: "sine" },
] as const;
const SOUND_OPTIONS = [
  { id: "piano", label: "Piano" },
  { id: "sine", label: "Sine" },
  { id: "square", label: "Square" },
  { id: "sawtooth", label: "Sawtooth" },
];
const TRIAL_HINTS = ladder(
  "Does the note start with a strike and fade away, or does it hold steady like an organ?",
  "Of the steady ones: the sine is smooth like a whistle, the square is hollow, the sawtooth is the buzziest.",
  "Only the piano fades while it holds. If it does not fade, decide between smooth, hollow and buzzy.",
);

const MAKE_STARTER = code(line("mel", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "piano"));

export default defineLesson({
  id: "U02.L06",
  version: 4,
  title: "Tones & Timbres",
  objective:
    "I can play the same line on different instruments and synth waves, and double it on a second sound.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["D01"],
  terms: [{ id: "term.waveform", step: "S3" }],
  canDo: ["cd.code.timbre"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One riff, four sounds",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-riff-four-sounds",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the riff on four sounds, one per bar. Listen for which sound is gentlest and which one buzzes most.",
        skills: [{ skill: "D01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "A new sound every bar. Which ones fade, and which hold steady?", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Same tune or not?",
      minutes: 0.75,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "same-tune",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two bars, the piano and then a synth. Follow the notes, not the sound, and pick the answer that describes the two bars.",
        skills: [{ skill: "D01", w: 1 }],
        hints: ladder(
          "Hum along with the first bar. Can you keep humming the same thing through the second?",
          "Listen for the ups and downs, not the sound: do the notes climb and fall in the same places?",
          "Both bars start low, climb twice, then drop back once.",
        ),
        stimulus: {
          src: "code",
          code: code(line("mel", RIFF, "<piano square>")),
          bars: 2,
          showCode: false,
        },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "same", label: "The same notes on two different sounds" },
            { id: "different", label: "Two different tunes" },
            { id: "louder", label: "The same sound, the second time louder" },
          ],
        },
        correct: { choice: ["same"] },
        // The catalog line names the option IDs; point back at the tune instead.
        feedbackText: {
          "id.wrong":
            "Not quite. Hum along with the first bar and keep humming through the second: did the tune change, or only the sound?",
        },
        tests: [
          { name: "same notes", response: { answer: { choice: ["same"] } }, expect: "pass" },
          { name: "heard a new tune", response: { answer: { choice: ["different"] } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Try the synths",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "try-the-synths",
        version: 1,
        role: "practice",
        prompt:
          'Replace `"piano"` with `"sine"`, then `"square"`, `"sawtooth"` and `"triangle"`, and listen after each change. Then answer the question below.',
        skills: [{ skill: "D01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play `sine`, `square` and `sawtooth` one after the other: which is smoothest, and which buzzes most?",
        },
        hints: ladder(
          "Listen to `sine`, `square` and `sawtooth` one after the other. Which could pass for someone whistling, and which for an angry insect?",
          "Only the word inside `.s(…)` changes. The roll stays the same, so the notes are the same.",
          "The square sits between the two extremes: hollow, a little like a clarinet.",
        ),
        code: { starter: code(line("mel", RIFF, "piano")) },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the order of these three, from the purest sound to the buzziest.",
            options: [
              { id: "sine-first", label: "`sine`, `square`, `sawtooth`" },
              { id: "saw-first", label: "`sawtooth`, `square`, `sine`" },
              { id: "square-first", label: "`square`, `sine`, `sawtooth`" },
            ],
            correct: ["sine-first"],
          },
        ],
        tests: [
          { name: "sine to sawtooth", response: { answer: { choice: ["sine-first"] } }, expect: "pass" },
          { name: "the wrong way round", response: { answer: { choice: ["saw-first"] } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Name the sound",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "name-the-sound",
        version: 1,
        role: "check",
        prompt:
          "Listen to four short lines, each on one sound, and name the sound of each: piano, sine, square or sawtooth.",
        skills: [{ skill: "D01", w: 1 }],
        hints: TRIAL_HINTS,
        tests: [],
        parts: TRIALS.map((t) => ({
          kind: "identify" as const,
          id: t.id,
          version: 1,
          role: "check" as const,
          prompt: "Pick the sound this line plays on.",
          skills: [{ skill: "D01", w: 1 }],
          hints: TRIAL_HINTS,
          stimulus: {
            src: "code" as const,
            code: code(line("mel", t.notes, t.sound)),
            bars: 1,
            showCode: false,
          },
          cue: { context: "none" as const, countInBars: 0 as const, click: false, replays: -1 },
          answer: { ui: "choice" as const, options: SOUND_OPTIONS },
          correct: { choice: [t.sound] },
          feedbackText: {
            "id.wrong":
              "Not that one. Does the note fade like a struck string, or hold steady? If it holds: smooth, hollow or buzzy?",
          },
          tests: [
            { name: t.sound, response: { answer: { choice: [t.sound] } }, expect: "pass" as const },
            {
              name: "another sound",
              response: { answer: { choice: [t.sound === "piano" ? "sine" : "piano"] } },
              expect: "fail" as const,
            },
          ],
        })),
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Double it up",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "double-it-up",
        version: 1,
        role: "check",
        prompt:
          "Add a second line labelled `vox` that plays the same four notes **one octave higher** on a synth wave: `sine`, `triangle`, `square` or `sawtooth`. Keep the piano line as it is. Waves are loud, so `.gain(.4)` keeps the new line under the piano.",
        skills: [{ skill: "D01", w: 1 }],
        code: { starter: code(line("mel", RIFF, "piano"), "⟪⟫") },
        reference: {
          solutions: [code(line("mel", RIFF, "piano"), line("vox", "c5 e5 g5 e5", "triangle", ".4"))],
          bars: 1,
        },
        // The notes, and the sound the brief asks for: an octave double on the piano is right notes, wrong colour.
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
            {
              m: "rubric",
              rules: [
                {
                  id: "synth",
                  label: "The octave line on a synth wave",
                  required: true,
                  skills: [],
                  rule: "sounds",
                  track: "vox",
                  anyOf: ["snd.wave.sine", "snd.wave.triangle", "snd.wave.square", "snd.wave.sawtooth"],
                },
              ],
            },
          ],
        },
        constraints: [{ c: "labels", min: 2, feedback: "code.labels" }],
        target: { audible: true, showRoll: true },
        feedbackText: LETTER_FEEDBACK,
        hints: ladder(
          "A second part needs a line of its own, starting with the label `vox:`. Which notes does it play, and on which sound?",
          "A new line with its own label plays alongside the first. The octave is the number after each letter.",
          'The new line starts `vox: note("c5 …`. Finish the notes, then pick a synth with `.s(…)`.',
        ),
        tests: [
          {
            name: "reference",
            response: {
              code: code(line("mel", RIFF, "piano"), line("vox", "c5 e5 g5 e5", "triangle", ".4")),
            },
            expect: "pass",
          },
          {
            name: "moved with transpose, on a square",
            response: {
              code: code(line("mel", RIFF, "piano"), line("vox", RIFF, "square", ".4", ".transpose(12)")),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(line("mel", RIFF, "piano"), "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "second line at the same height",
            response: { code: code(line("mel", RIFF, "piano"), line("vox", RIFF, "sine", ".4")) },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "the octave line on the piano too",
            response: { code: code(line("mel", RIFF, "piano"), line("vox", "c5 e5 g5 e5", "piano", ".4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "on a sawtooth, a little louder",
            response: {
              code: code(line("mel", RIFF, "piano"), line("vox", "c5 e5 g5 e5", "sawtooth", ".5")),
            },
            expect: "pass",
          },
          {
            name: "on a sine, as MIDI numbers",
            response: { code: code(line("mel", RIFF, "piano"), line("vox", "72 76 79 76", "sine", ".4")) },
            expect: "pass",
          },
          {
            name: "one line only, moved up",
            response: { code: code(line("mel", "c5 e5 g5 e5", "sine", ".4")) },
            expect: "fail",
            feedback: ["code.labels"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "One line, two colours",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "one-line-two-colours",
        version: 1,
        role: "practice",
        prompt:
          "Add a second labelled line, such as `vox:`, that plays the same notes as `mel:` at the same time on **another sound**, at the same height or one or two octaves away. Done when every bar of `mel:` is doubled.",
        skills: [{ skill: "D01", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-parts",
            label:
              "In every bar, a second line plays the same notes at the same time on another sound, at the same height or one or two octaves away",
            required: true,
            skills: ["D01"],
            // Corrections pass: the doubling itself. `tracks` counted two pitched lines, so two piano lines, or a
            // `vox` that played something else, passed. Every bar of the line has a copy on another line, at the
            // same time and in the same rhythm, at the same height or one or two octaves away, on other sounds.
            rule: "custom",
            fn: "transposed-copy",
            params: { together: true, semis: [0, 12, -12, 24, -24], otherSound: true, minRatio: 1 },
          },
          {
            id: "space",
            label: "At least one `~` (a rest) for space",
            required: false,
            skills: ["R06"],
            rule: "uses",
            tool: "tb.mini.rest",
          },
          {
            id: "octave-apart",
            label: "Uses `.transpose()`, for example to move the copy an octave",
            required: false,
            skills: ["P06"],
            rule: "uses",
            tool: "tb.transpose",
          },
        ],
        hints: ladder(
          "The brief needs two lines playing the same notes on two sounds, and the starter has one. What must the second line copy?",
          "Copy the `mel` line, label the copy `vox`, and change its sound.",
          '`vox` with the same notes, `.s("sine")` and `.gain(.4)` is already enough. Change the notes after that if you like.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal",
            response: {
              code: code(
                line("mel", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "piano"),
                line("vox", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "sine", ".4"),
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief",
            response: {
              code: code(
                line("mel", "<[c4 e4 g4 ~] [f4 a4 c5 a4]>", "<piano sawtooth>"),
                line("vox", "<[c4 e4 g4 ~] [f4 a4 c5 a4]>", "triangle", ".4", ".transpose(12)"),
              ),
            },
            expect: "pass",
          },
          {
            // The outside review's counterexamples: two lines on one sound; a second line that plays other notes.
            name: "the copy on the same sound",
            response: {
              code: code(
                line("mel", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "piano"),
                line("vox", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "piano", ".4"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a second line that plays something else",
            response: {
              code: code(
                line("mel", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "piano"),
                line("vox", "c5 ~ ~ ~", "sine", ".4"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "doubled in bar 1 only",
            response: {
              code: code(
                line("mel", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "piano"),
                line("vox", "<[c4 e4 g4 e4] ~>", "sine", ".4"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "an octave below on a sawtooth, a line of its own",
            response: {
              code: code(
                line("mel", "<[e4 ~ d4 c4] [d4 e4 c4 ~]>", "piano"),
                line("vox", "<[e3 ~ d3 c3] [d3 e3 c3 ~]>", "sawtooth", ".3"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the double written as MIDI numbers, on a square wave",
            response: {
              code: code(
                line("mel", "<[c4 e4 g4 e4] [f4 a4 g4 e4]>", "piano"),
                line("vox", "<[60 64 67 64] [65 69 67 64]>", "square", ".3"),
              ),
            },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
