// U03.L01 Home & the Major Scale. One note feels like home (the tonic), and the major scale climbs from it
// whole, whole, half, whole, whole, whole, half, using each letter once. Note names only: `n()` and the
// degree numbers arrive in U03.L02, so nothing the learner reads here names a degree (feedback included).
// What the learner has from U02: note names with octaves, sharps and flats, half and whole steps (U02.L03),
// the treble staff (U02.L04). Spec: content/specs/U03.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A piano line in note names. */
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook: e g a g, then f e d c. Over the vamp's C chord bar 1 rests on chord notes and passes through a;
 * over its F chord bar 2 starts on f and walks down to c, home.
 */
const HOOK = mel("<[e4 g4 a4 g4] [f4 e4 d4 c4]>");
/** Two climbs: the first arrives on c5, the second stops one note short. */
const CLIMB_HOME = "c4 d4 e4 f4 g4 a4 b4 c5";
const CLIMB_SHORT = "c4 d4 e4 f4 g4 a4 b4 ~";
/** The C scale, one eighth each. */
const C_SCALE = mel(CLIMB_HOME);
/** The rule worked from F, where it needs a flat: a key the steps S5 and S7 do not ask for. */
const F_SCALE = mel("f4 g4 a4 bb4 c5 d5 e5 f5");
/** G major: the answer of S5. */
const G_MAJOR = mel("g4 a4 b4 c5 d5 e5 f#5 g5");

/**
 * The Make's starter: one black key, `eb4`, against the band's C chord (C E G), where it sounds plainly sour
 * against the chord's E. Fixing it is the scale idea in one edit.
 */
const MAKE_STARTER = "<[c4 eb4 g4 e4] [f4 a4 g4 ~]>";

const BAND = { band: "band.two-chord-vamp" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;

/** Before U03.L02 feedback names letters and places, never degree numbers or syllables. */
const LETTERS = {
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: not the note the scale needs here. Only one note of the starter changes: walk the steps from `g4` again (whole, whole, half, whole, whole, whole, half) to find which.",
  "melody.missing-note":
    "Bar {bar}, {beatLabel}: a note is missing here. The scale has eight notes, `g4` to `g5`.",
  "melody.extra-note":
    "Bar {bar}, {beatLabel}: one note too many here. The scale has eight notes, `g4` to `g5`.",
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than the scale. Check the number after it.",
} as const;

export default defineLesson({
  id: "U03.L01",
  version: 3,
  title: "Home & the Major Scale",
  objective:
    "I can hear which note is home, and spell a major scale from any note with whole and half steps, each letter once.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S01", "E03"],
  practises: [],
  terms: [
    { id: "term.tonic", step: "S2" },
    { id: "term.major-scale", step: "S3" },
  ],
  canDo: ["cd.hear.home", "cd.write.scale"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Back to one note",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "back-to-one-note",
        version: 1,
        role: "practice",
        prompt:
          "Listen for the note the line comes to rest on at the end of bar 2. Hum that note and hold it while the loop starts again. Listen for whether it still fits under bar 1.",
        skills: [{ skill: "E03", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Bar 1 climbs and turns; bar 2 walks down to rest.", bars: 2 }],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Which climb arrives?",
      minutes: 0.75,
      // No band: the ending is heard on its own (spec note).
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-climb-arrives",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both climbs, A and B. Pick the one that sounds finished: the one that does not leave you waiting for one more note.",
        skills: [{ skill: "E03", w: 1 }],
        hints: ladder(
          "Pick the climb that could end a tune. Listen to B and keep humming after it stops: which note does your voice want next?",
          "B stops on `b4`, one note below `c5`. A finished ending lets you stop listening; the other one makes you wait.",
          "The note you hum after B stops is a note B never plays. One of the two climbs does play it, as its last note.",
        ),
        stimulus: { src: "code", code: mel(`<[${CLIMB_HOME}] [${CLIMB_SHORT}]>`), bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "a", label: "A, up to `c5`", audio: mel(CLIMB_HOME) },
            { id: "b", label: "B, stops on `b4`", audio: mel(CLIMB_SHORT) },
          ],
        },
        correct: { choice: ["a"] },
        feedbackText: {
          "id.wrong":
            "Not B: it stops on `b4` and leaves you waiting. Listen to A again: it goes one note further.",
        },
        tests: [
          { name: "A", response: { answer: { choice: ["a"] } }, expect: "pass" },
          { name: "B", response: { answer: { choice: ["b"] } }, expect: "fail", feedback: ["id.wrong"] },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where the steps are short",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      example: { id: "c-climb", code: C_SCALE, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-steps-are-short",
        version: 1,
        role: "practice",
        prompt:
          "Run the climb from `c4` to `c5` and watch the keyboard. For each of its seven steps, check whether a black key sits between the two notes. Then answer both questions below.",
        skills: [{ skill: "S01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. Run it again and check each pair of neighbours on the keyboard: a black key in the gap means a whole step (2 half steps), no black key means a half step (1).",
        },
        hints: ladder(
          "Find the two pairs of neighbouring notes in the climb that sit side by side on the keyboard, with no black key between them. Which pairs are they?",
          "Check the pairs in order: `c4`–`d4`, `d4`–`e4`, `e4`–`f4`, and on up to `b4`–`c5`. No black key in the gap means a half step; a black key in the gap means a whole step, two half steps.",
          "`e4` to `f4` is one of the two short steps. The other one is near the top.",
        ),
        code: { starter: C_SCALE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the two pairs of neighbours that have no black key between them.",
            options: [
              { id: "ef-bc", label: "`e4`–`f4` and `b4`–`c5`" },
              { id: "cd-fg", label: "`c4`–`d4` and `f4`–`g4`" },
              { id: "none", label: "None: every pair has one" },
            ],
            correct: ["ef-bc"],
          },
          {
            q: "number",
            prompt: "Type how many half steps it is from `c4` up to `d4`, as a number.",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["ef-bc"], number: 2 } }, expect: "pass" },
          {
            name: "picked the wide steps",
            response: { answer: { choice: ["cd-fg"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted white keys only",
            response: { answer: { choice: ["ef-bc"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "concept",
      title: "The rule from any note",
      minutes: 0.75,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      example: { id: "f-climb", code: F_SCALE, bars: 1 },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Build G major",
      minutes: 1.5,
      graded: true,
      // Roll and treble staff, both with letter names: degree labels wait for U03.L02.
      ui: { panels: ROLL_STAFF, rollLabels: "note", staffLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "build-g-major",
        version: 1,
        role: "check",
        // The answer is G major; the starter is the white keys from g4 (content check 13: the lesson's key).
        key: { tonic: "G", mode: "major" },
        prompt:
          "The line plays the white keys from `g4` up to `g5`. Change one note so the steps go whole, whole, half, whole, whole, whole, half, each letter used once. Keep the other seven notes as they are. Done when the line is the G major scale.",
        skills: [{ skill: "S01", w: 1 }],
        code: { starter: mel("⟪g4 a4 b4 c5 d5 e5 f5 g5⟫") },
        reference: { solutions: [G_MAJOR], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        // `gb5` sounds the same as `f#5` but uses the letter G twice and skips F.
        constraints: [
          {
            c: "arg-matches",
            fn: "note",
            argIndex: 0,
            pattern: "^(?![\\s\\S]*gb)",
            feedback: "spell.enharmonic",
          },
        ],
        target: { audible: true, showRoll: false },
        feedbackText: {
          ...LETTERS,
          "spell.enharmonic":
            "Right sound, wrong name: `gb5` uses the letter G twice and skips F. Each letter once: write it as an F.",
        },
        hints: ladder(
          "Compare each step from `g4` with the pattern whole, whole, half, whole, whole, whole, half. The first steps fit. Where does the pattern break?",
          "Look at the last two steps, `e5` to `f5` and `f5` to `g5`. The pattern needs whole then half there; the white keys give half then whole.",
          "One note moves up by a half step: it keeps its letter and gains a sharp.",
        ),
        srs: [{ family: "fam.key.scale-spell", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: G_MAJOR }, expect: "pass" },
          {
            name: "the same notes as two groups of four",
            response: { code: mel("[g4 a4 b4 c5] [d5 e5 f#5 g5]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: mel("g4 a4 b4 c5 d5 e5 f5 g5") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "raised the top note instead",
            response: { code: mel("g4 a4 b4 c5 d5 e5 f5 g#5") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "spelled with a flat: G twice",
            response: { code: mel("g4 a4 b4 c5 d5 e5 gb5 g5") },
            expect: "fail",
            feedback: ["spell.enharmonic"],
          },
          {
            name: "sharpened c instead",
            response: { code: mel("g4 a4 b4 c#5 d5 e5 f5 g5") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Find home",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "find-home",
        version: 1,
        role: "check",
        prompt:
          "Listen to a short phrase over a few chords, in a different key each time. Pick the card that plays home: the note the music could end on and feel finished.",
        skills: [{ skill: "E03", w: 1 }],
        hints: [
          {
            text: "Find the note the phrase could stop on. Hum its last note and hold it: could the music end there?",
          },
          {
            text: "Listen to each card right after the phrase ends. Home sounds like an ending; the other two leave you waiting.",
          },
          { text: "Hear it again, slower, and hum the note the chords settle on.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.deg.tonic", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        // The family's trial brings its own options: the note names of its key (home and two near misses).
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "C", label: "C" },
            { id: "G", label: "G" },
            { id: "E", label: "E" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.deg.tonic", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "quiz",
      title: "Spell D major",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "spell-d-major",
        version: 1,
        role: "check",
        prompt:
          "Spell D major from D up. Write its seven letters in order, separated by spaces, each letter once. Add a sharp wherever a step must grow to fit whole, whole, half, whole, whole, whole, half. Stop at the seventh letter: no D at the top.",
        skills: [{ skill: "S01", w: 1 }],
        // Spelling is judged in D major, the scale asked for (not the lesson's C).
        key: { tonic: "D", mode: "major" },
        feedbackText: {
          // A missing or extra slot reads "D → nothing": the eighth note is the D an octave up (S7's prompt).
          "spell.wrong":
            "{got} → {exp}. Check the step up to it: should it be whole or half? Seven letters, no D at the top.",
          "spell.enharmonic":
            "{got} sounds right, but its letter is already taken. Each letter once: write {exp}.",
        },
        hints: ladder(
          "Start from the seven letters D E F G A B C, then check each step against whole, whole, half, whole, whole, whole, half. Which steps come out too short?",
          "Whole, whole, half, whole, whole, whole, half. `e` to `f` is only a half step, so the third note must rise.",
          "The first four are D E F# G. Walk on from G: whole, whole, whole, and the last step back to D is a half.",
        ),
        answer: { ui: "text", normalize: "note" },
        correct: { text: ["D", "E", "F#", "G", "A", "B", "C#"] },
        spelling: "strict",
        order: "sequence",
        srs: [{ family: "fam.key.scale-spell", mode: "seed" }],
        tests: [
          {
            name: "D major",
            response: { answer: { text: ["D", "E", "F#", "G", "A", "B", "C#"] } },
            expect: "pass",
          },
          {
            name: "F instead of F#",
            response: { answer: { text: ["D", "E", "F", "G", "A", "B", "C#"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "Gb for F#: G twice",
            response: { answer: { text: ["D", "E", "Gb", "G", "A", "B", "C#"] } },
            expect: "fail",
            feedback: ["spell.enharmonic"],
          },
          {
            name: "eight notes, D again at the top",
            response: { answer: { text: ["D", "E", "F#", "G", "A", "B", "C#", "D"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "lower case, octave numbers",
            response: { answer: { text: ["d4", "e4", "f#4", "g4", "a4", "b4", "c#5"] } },
            expect: "pass",
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Stay in C",
      minutes: 2.5,
      ui: { panels: ROLL_STAFF, rollLabels: "note", staffLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "stay-in-c",
        version: 1,
        role: "practice",
        prompt:
          "Find the one note in the starter that is not in C major and change it to a note that is. Then end the line on a `c`, home, and keep `< >` so bar 2 answers bar 1. Done when every note is in C major.",
        skills: [{ skill: "S01", w: 1 }],
        code: { starter: mel(MAKE_STARTER) },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "in-c",
            label: "Every note of the line is in C major: white keys only",
            required: true,
            skills: ["S01"],
            rule: "in-key",
            key: { tonic: "C", mode: "major" },
            minRatio: 1,
            tracks: ["@melody"],
          },
          {
            id: "ends-home",
            label: "The line's last note is a `c`, home",
            required: false,
            skills: ["E03"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "answer",
            label: "Uses `< >`, so bar 2 plays different notes from bar 1",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.mini.alt",
          },
          {
            id: "space",
            label: "At least one rest, `~`, somewhere in the line",
            required: false,
            skills: ["R06"],
            rule: "uses",
            tool: "tb.mini.rest",
          },
        ],
        // The catalog words these in degree numbers ("it ends on 5"), which wait for U03.L02.
        feedbackText: {
          "melody.ends-on": "The line does not end on `c` yet. Make its last note a `c`, home.",
          "rubric.unmet": "{label}: not yet.",
        },
        hints: ladder(
          "One note of the starter is not in C major. Listen to the starter over the band: which note sounds sour?",
          "C major uses the white keys only. Look for the one note in the code with a sharp or a flat.",
          "`eb4` is not in C major: it sours the band's chord. Move it up a half step, then try ending the second bar on `c4`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: mel(MAKE_STARTER) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: mel("<[c4 e4 g4 e4] [f4 a4 g4 ~]>") }, expect: "pass" },
          {
            name: "beyond the brief: a hats line, a run home",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: note("<[e4 g4 c5 g4] [a4 f4 [e4 d4] c4]>").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "a black key kept in bar 2",
            response: { code: mel("<[c4 e4 g4 e4] [f4 ab4 g4 c4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
