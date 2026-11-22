// U02.L08 Playing from the Page. Two public-domain tunes read off the treble staff into code (U02's
// "play from the page" steps, AUTHORING §4), and a first room: `.room()` and `.clip()` unlock here.
// Tunes (content/repertoire): Ode to Joy, theme (Beethoven, Symphony No. 9, 1824), first four bars in a
// plain-rhythm version (bar 4's dotted rhythm becomes `e4 d4 d4@2`: no dots before U13.L03); When the
// Saints Go Marching In (trad), first phrase from its first full bar, its opening "oh when the" on beats
// 2 to 4 after a rest (no pickups before U07.L08). Both set in C over the C–F Band.
// Spec: content/specs/U02.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band carries drums, bass and chords; the learner's tune sits on top. */
const BAND = { band: "band.two-chord-vamp" } as const;
const STAFF_ROLL = { roll: true, staff: "treble", keyboard: false } as const;
/** Play from the page: the target is on the staff only, never in code or on the roll. */
const STAFF_ONLY = { roll: false, staff: "treble", keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** Ode to Joy, bars 1–4, one bar per `< >` item. */
const ODE = "<[e4 e4 f4 g4] [g4 f4 e4 d4] [c4 c4 d4 e4] [e4 d4 d4@2]>";
const ODE_1_2 = "<[e4 e4 f4 g4] [g4 f4 e4 d4]>";
/** When the Saints, first phrase: "oh when the | saints, | go marching | in". */
const SAINTS = "<[~ c4 e4 f4] [g4@4] [~ c4 e4 f4] [g4@4]>";

const HOOK = mel(ODE, ".room(.4)");

/** Before U03.L02 the grader's melody feedback speaks in degrees; say it in places and letters instead. */
const LETTER_FEEDBACK = {
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than the staff shows. Count the lines up from `e4` again.",
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: a different note from the one on the staff. Is it on a line or in a space?",
  "melody.missing-note": "Bar {bar}, {beatLabel}: the staff has a note here.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note more than the staff shows.",
} as const;

const MAKE_STARTER = mel(ODE);

export default defineLesson({
  id: "U02.L08",
  version: 4,
  title: "Playing from the Page",
  objective: "I can read a short tune off the treble staff into code and put it in a room with reverb.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D05"],
  practises: ["N02", "N01"],
  terms: [{ id: "term.reverb", step: "S2" }],
  canDo: ["cd.read.play-from-page"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A tune you know",
      minutes: 0.5,
      ui: { panels: STAFF_ROLL, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-tune-you-know",
        version: 1,
        role: "practice",
        prompt:
          "Follow the notes along the staff as they sound. Listen for whether bar 4 ends the tune or leaves it waiting.",
        skills: [{ skill: "N02", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Ode to Joy, bars 1 to 4. Read along on the staff.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Open the room",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "open-the-room",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the line as it is, with `.room(0)`. Then change `.room(0)` to `.room(.6)` and listen again, paying attention to the empty second bar. Then answer the question below.",
        skills: [{ skill: "D05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Listen to the empty second bar in each version: in which one is something still fading away?",
        },
        hints: ladder(
          "Compare the two versions just after the last note, `c5`, stops. Is the empty bar silent in both?",
          "Listen to the empty bar: is it silent, or is something still fading away?",
          "With `.room(0)` each note stops when the piano stops. Now listen to the other version.",
        ),
        code: { starter: mel("<[c4 e4 g4 c5] [~ ~ ~ ~]>", ".room(0)") },
        mustPlayLoops: 2,
        questions: [
          {
            q: "choice",
            prompt: "Which version sounds as if the piano stands in a bigger space?",
            options: [
              { id: "dry", label: "`.room(0)`" },
              { id: "wet", label: "`.room(.6)`" },
              { id: "same", label: "Neither: they sound the same" },
            ],
            correct: ["wet"],
          },
        ],
        tests: [
          { name: "the one with a tail", response: { answer: { choice: ["wet"] } }, expect: "pass" },
          { name: "the dry one", response: { answer: { choice: ["dry"] } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Read the opening",
      minutes: 2,
      graded: true,
      ui: { panels: STAFF_ONLY },
      example: { id: "ode-bars-1-2", code: mel(ODE_1_2), bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "read-the-opening",
        version: 1,
        role: "check",
        prompt:
          "Write the first two bars on the staff in code: four notes inside each pair of brackets, each with its letter and number. The first note, `e4` on the bottom line, is already written. Done when your notes match the staff.",
        skills: [
          { skill: "N02", w: 0.7 },
          { skill: "P02", w: 0.3 },
        ],
        code: { starter: mel("<[e4 ⟪~ ~ ~⟫] [⟪~ ~ ~ ~⟫]>") },
        reference: { solutions: [mel(ODE_1_2)], bars: 2 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        target: { audible: false, showRoll: false },
        feedbackText: LETTER_FEEDBACK,
        hints: ladder(
          "Read the notes left to right, starting from `e4` on the bottom line. Does each next note go up, down or stay put?",
          "Bottom line `e4`, the space above it `f4`, the next line `g4`. Each step up the staff is the next letter.",
          "Bar 1 is `e4 e4 f4 g4`: it climbs from the bottom line. Bar 2 walks back down.",
        ),
        srs: [{ family: "fam.not.read", mode: "seed" }],
        tests: [
          { name: "reference", response: { code: mel(ODE_1_2) }, expect: "pass" },
          { name: "in a room", response: { code: mel(ODE_1_2, ".room(.4)") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: mel("<[e4 ~ ~ ~] [~ ~ ~ ~]>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "read the f4 space as the g4 line",
            response: { code: mel("<[e4 e4 g4 g4] [g4 f4 e4 d4]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "an octave up after the first note",
            response: { code: mel("<[e4 e5 f5 g5] [g5 f5 e5 d5]>") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "second bar left out",
            response: { code: mel("<[e4 e4 f4 g4] [~ ~ ~ ~]>") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Read the Saints",
      minutes: 1.5,
      graded: true,
      ui: { panels: STAFF_ONLY },
      example: { id: "saints", code: mel(SAINTS), bars: 4 },
      exercise: {
        kind: "code-modify",
        id: "read-the-saints",
        version: 1,
        role: "check",
        prompt:
          "Read bars 2 to 4 of When the Saints from the staff and write them in place of the three bars of `~`, one pair of brackets per bar. Bar 1 is written for you. A whole note fills its bar: write it with `@4` inside its brackets, like `[c5@4]`.",
        skills: [
          { skill: "N02", w: 0.5 },
          { skill: "N01", w: 0.5 },
        ],
        code: { starter: mel("<[~ c4 e4 f4] ⟪[~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]⟫>") },
        reference: { solutions: [mel(SAINTS)], bars: 4 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: true },
        target: { audible: false, showRoll: false },
        feedbackText: {
          ...LETTER_FEEDBACK,
          "rhythm.duration":
            "Bar {bar}, {beatLabel}: this note lasts {got}; the staff holds it for {expected}. Stretch it with `@` inside its brackets.",
        },
        hints: ladder(
          "Compare bars 2, 3 and 4 with bar 1 on the staff. Which bar repeats bar 1, and which bars hold one long note?",
          "An open note head with no stem lasts the whole bar. It sits on the second line: `g4`.",
          "Bar 3 is a copy of bar 1. Bars 2 and 4 are the same whole note.",
        ),
        srs: [{ family: "fam.not.read", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: mel(SAINTS) }, expect: "pass" },
          {
            name: "whole notes held with _",
            response: { code: mel("<[~ c4 e4 f4] [g4 _ _ _] [~ c4 e4 f4] [g4 _ _ _]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: mel("<[~ c4 e4 f4] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "whole notes played short",
            response: { code: mel("<[~ c4 e4 f4] [g4 ~ ~ ~] [~ c4 e4 f4] [g4 ~ ~ ~]>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "read the f4 space as the g4 line",
            response: { code: mel("<[~ c4 e4 f4] [g4@4] [~ c4 e4 g4] [g4@4]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "whole notes an octave up",
            response: { code: mel("<[~ c4 e4 f4] [g5@4] [~ c4 e4 f4] [g5@4]>") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "investigate",
      title: "Short or joined",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "short-or-joined",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the tune with `.clip(.5)`, then change it to `.clip(1)` and listen again. Watch how long each note's bar is on the roll, then answer the question below.",
        skills: [{ skill: "N01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch each note's bar on the roll and listen between the notes: is there a gap, and did the tempo change?",
        },
        hints: ladder(
          "Compare the two versions between one note and the next. With `.clip(.5)`, is there a gap?",
          "On the roll, each note's bar shows how long it sounds. Compare the bar to the space it has.",
          "`.clip(1)` lets each note last until the next one starts.",
        ),
        code: { starter: mel(ODE, ".clip(.5)") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What does `.clip(.5)` do to the notes?",
            options: [
              { id: "short", label: "Each note sounds for half its length, with a gap after it" },
              { id: "joined", label: "Each note rings into the next" },
              { id: "half-speed", label: "The tune plays at half the speed" },
            ],
            correct: ["short"],
          },
        ],
        tests: [
          { name: "short notes", response: { answer: { choice: ["short"] } }, expect: "pass" },
          { name: "thought it slows down", response: { answer: { choice: ["half-speed"] } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your arrangement",
      minutes: 2.75,
      ui: { panels: STAFF_ROLL, rollLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "your-arrangement",
        version: 1,
        role: "practice",
        prompt:
          "Arrange Ode to Joy, the starter, or When the Saints. Pick its sound with `.s()` and how long its notes ring with `.clip()`, and put it in a room with `.room()` and a number above 0, such as `.room(.4)`. Done when the tune rings in a room you can hear.",
        skills: [{ skill: "D05", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "in-a-room",
            label: "At least half of the tune's notes play with `.room()` above 0, such as `.room(.4)`",
            required: true,
            skills: ["D05"],
            // Corrections pass: a room you can hear. `uses tb.room` passed `.room(0)`, a dry sound.
            rule: "custom",
            fn: "control-set",
            // Corrections gate (AS-04, AS-05): on the tune itself, at a size you can hear, for most of its notes.
            params: { control: "room", above: 0.02, example: ".4", track: "@melody", share: 0.5 },
          },
          {
            id: "four-bars",
            label: "The tune runs four bars or more before it repeats",
            required: false,
            skills: ["N02"],
            rule: "bars",
            min: 4,
          },
          {
            id: "short-notes",
            label: "Uses `.clip()` to set how long notes ring",
            required: false,
            skills: ["N01"],
            rule: "uses",
            tool: "tb.clip",
          },
        ],
        hints: ladder(
          "The tune needs a room you can hear around it. Which method added the fading tail in the empty bar, two steps back?",
          "`.room()` goes at the end of the line, after `.s(…)`. Between 0 and 1: more gives a louder tail.",
          "Add `.room(.4)` to the end of the `mel` line. Then change the sound or the note lengths.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: mel(ODE, ".room(.4)") }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: `${TEMPO}mel: note("${SAINTS}").s("triangle").gain(.5).room(.5)\nvox: note("${SAINTS}").transpose(12).s("piano").clip(.6).room(.3)`,
            },
            expect: "pass",
          },
          {
            // The outside review's counterexample.
            name: "a room of 0: dry",
            response: { code: mel(ODE, ".room(0)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a big room on a sine",
            response: { code: `${TEMPO}mel: note("${SAINTS}").s("sine").gain(.5).room(.9)` },
            expect: "pass",
          },
          {
            name: "short notes in a small room",
            response: { code: mel(ODE, ".clip(.5).room(.15)") },
            expect: "pass",
          },
          {
            name: "short notes, no room",
            response: { code: mel(SAINTS, ".clip(.6)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
