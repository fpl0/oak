// U04.L03 Together Now. Two notes played at the same moment: `,` inside the brackets of mini-notation
// (`[c4,e4]`). Some pairs rest (3rds, 6ths, 5ths, octaves: consonance), some clash and want to move (2nds,
// 7ths, the tritone: dissonance). The tritone is six half steps, degrees 4 and 7 of a major key; here it
// moves by half steps to a pair at rest (B–F to C–E). The hook plays without the Band: its B–F would grate
// against the vamp. Unlocks `tb.mini.stack`. Spec: content/specs/U04.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const keys = (pattern: string, extra = "") => `${TEMPO}keys: note("${pattern}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: 1+3, 1+5, then 7+4 (the tritone, B below middle C up to F), back to 1+3. */
const HOOK = `${TEMPO}keys: n("<[0,2] [0,4] [-1,3] [0,2]>").scale("C4:major").s("piano")`;
/** The same four pairs in note names, for counting on the keyboard. */
const PAIRS = keys("<[c4,e4] [c4,g4] [b3,f4] [c4,e4]>");

/** The modify riff: four pairs, each played one note after the other; then together. */
const RIFF_APART = "[c4 e4] [c4 a4] [b3 f4] [c4 e4]";
const RIFF_TOGETHER = "[c4,e4] [c4,a4] [b3,f4] [c4,e4]";

/** The Make: rest, rest | rest, then the clash, which lets go on the next downbeat (C–E over the C chord). */
const MAKE_APART = "<[c4 e4 c4 g4] [c4 a4 b3 f4]>";
const MAKE_TOGETHER = "<[[c4,e4] [c4,g4]] [[c4,a4] [b3,f4]]>";

const BAND = { band: "band.two-chord-vamp" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const STAFF_ONLY = { roll: false, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U04.L03",
  version: 3,
  title: "Together Now",
  objective:
    "I can play two notes together with `,` and hear whether a pair is at rest or clashes, the tritone included.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["I05", "I03"],
  practises: [],
  terms: [
    { id: "term.tritone", step: "S2" },
    { id: "term.consonance", step: "S3" },
    { id: "term.dissonance", step: "S3" },
  ],
  canDo: ["cd.hear.consonance"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Four pairs",
      minutes: 0.5,
      // No Band: the third pair is meant to grate, and over the vamp it would grate against the chords too.
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "four-pairs",
        version: 1,
        role: "practice",
        prompt:
          "Each bar plays one pair of notes, both at once. Listen for the one pair of the four you would not want the music to stop on, the one that sounds as if it must move on.",
        skills: [{ skill: "I05", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Piano alone, no band: nothing but the four pairs.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "The pair that pulls",
      minutes: 1,
      // Letters on the roll: the step counts half steps from B to F on the keyboard.
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      example: { id: "pairs", code: PAIRS, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "pair-that-pulls",
        version: 1,
        role: "practice",
        prompt:
          "These are the same four pairs in letters. A comma inside brackets plays notes together: `[c4,e4]` is C and E at once. Run the code, watch the keyboard, then answer both questions below.",
        skills: [
          { skill: "I05", w: 0.5 },
          { skill: "I03", w: 0.5 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play bar 3 against bar 4, and count every key from B up to F, black ones too.",
        },
        hints: ladder(
          "For the first question, listen for the pair that sounds unfinished, as if it must move on. For the count, use the keyboard.",
          "Listen to what happens after it: the next pair sounds like a relief. To count, start after the lower note and count every key up, black ones too.",
          "From B, the next key up is C, then C♯. Keep counting until you reach F.",
        ),
        code: { starter: PAIRS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which pair pulls, as if it wants to move on?",
            options: [
              { id: "c-e", label: "Bar 1: C and E" },
              { id: "c-g", label: "Bar 2: C and G" },
              { id: "b-f", label: "Bar 3: B and F" },
            ],
            correct: ["b-f"],
          },
          { q: "number", prompt: "How many half steps from B up to F?", correct: 6 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["b-f"], number: 6 } }, expect: "pass" },
          {
            name: "the open 5th heard as the pull",
            response: { answer: { choice: ["c-g"], number: 6 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted it as a perfect 5th",
            response: { answer: { choice: ["b-f"], number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "compare",
      title: "Which one ends it?",
      minutes: 0.75,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-ends-it",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both cards: C with E, then C with D♭, each pair played at once. Pick the pair that could end a song, the one that sounds settled when the music stops on it.",
        skills: [{ skill: "I05", w: 1 }],
        hints: ladder(
          "Imagine the music stopping on each card. Pick the one whose silence after it feels finished.",
          "One pair blends into a single sound; the other buzzes, as if the two notes rub against each other.",
          "C and D♭ are only a half step apart. C and E are a major 3rd apart.",
        ),
        feedbackText: {
          "id.wrong":
            "Listen again: C with D♭ rubs, C with E blends. Which one leaves a silence that feels finished?",
        },
        stimulus: { src: "code", code: keys("<[c4,e4] [c4,db4]>"), bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "third", label: "C with E", audio: keys("[c4,e4]@4") },
            { id: "half-step", label: "C with D♭", audio: keys("[c4,db4]@4") },
          ],
        },
        correct: { choice: ["third"] },
        tests: [
          { name: "C with E", response: { answer: { choice: ["third"] } }, expect: "pass" },
          {
            name: "C with D flat",
            response: { answer: { choice: ["half-step"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      // U04's "Play from the page" (AUTHORING §4): the target is on the staff only, never on the roll.
      ui: { panels: STAFF_ONLY, staffLabels: "none" },
      example: { id: "the-page", code: keys(RIFF_TOGETHER), bars: 1 },
      exercise: {
        kind: "code-modify",
        id: "play-them-together",
        version: 1,
        role: "check",
        prompt:
          "Your code plays each pair one note after the other. The page stacks each pair on one stem: both notes at once. Change the code so all four pairs sound at once, keeping the same notes. Done when it plays what the page shows.",
        skills: [
          { skill: "I05", w: 0.7 },
          { skill: "I03", w: 0.3 },
        ],
        code: { starter: keys(`⟪${RIFF_APART}⟫`) },
        reference: { solutions: [keys(RIFF_TOGETHER)], bars: 1 },
        // The notes that sound together on each beat, at the octave the page shows, whatever their order inside
        // the brackets: a pair is an interval, and C4 with E5 is not the 3rd the staff stacks.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["keys"] },
        constraints: [{ c: "must-use", tool: "tb.mini.stack", feedback: "code.must-use" }],
        target: { audible: true },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the pair has {got} ({gotSyl}) where the page shows {exp} ({expSyl}). Keep the same two notes in each pair, only together.",
          "melody.octave":
            "Bar {bar}, {beatLabel}: the right letter, but an octave {dir} than the page shows. Moving one note of a pair by an octave changes the distance between them: keep each note at the octave written.",
          "code.must-use": "Play each pair at once with a comma between the two notes inside its brackets.",
        },
        hints: ladder(
          "Two notes on one stem start at the same moment. Something must go between the two notes of each pair, inside their brackets.",
          "A comma inside brackets: `[c4,e4]` plays both at once. Every pair keeps its own brackets.",
          "The first pair becomes `[c4,e4]`. Do the same to the other three.",
        ),
        tests: [
          { name: "reference", response: { code: keys(RIFF_TOGETHER) }, expect: "pass" },
          {
            name: "the upper note written first",
            response: { code: keys("[e4,c4] [a4,c4] [f4,b3] [e4,c4]", ".gain(.8)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: keys(RIFF_APART) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "F for E in the first pair",
            response: { code: keys("[c4,f4] [c4,a4] [b3,f4] [c4,e4]") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            // Review finding (theory-c A1): the same letters at other octaves are other intervals.
            name: "the upper notes an octave too high: a 10th, not the 3rd on the page",
            response: { code: keys("[c4,e5] [c4,a5] [b3,f5] [c4,e5]") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "written as degrees, with spaces after the commas",
            response: {
              code: `${TEMPO}keys: n("[0, 2] [0, 5] [-1, 3] [0, 2]").scale("C4:major").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "two lines instead of a comma",
            response: {
              code: `${TEMPO}keys: note("c4 c4 b3 c4").s("piano")\nvox: note("e4 a4 f4 e4").s("piano")`,
            },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Two at once",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "two-at-once",
        version: 1,
        role: "check",
        prompt: "Chords set home, then you hear two notes at once. Enter both degrees, the lower note first.",
        skills: [{ skill: "E06", w: 1 }],
        hints: [
          { text: "Hum the lower note first, then the higher one on top of it. Name each by its syllable." },
          { text: "Sing each note down to do on syllables. The syllables name the degrees." },
          { text: "Hear it again, slower, one note at a time.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.int.in-key", level: 5 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "degree-pad",
          set: ["1", "2", "3", "4", "5", "6", "7"],
          sequenceLen: 2,
          syllables: true,
        },
        correct: {},
        srs: [{ family: "fam.int.in-key", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Where the pull lives",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "where-the-pull-lives",
        version: 1,
        role: "check",
        prompt:
          "Pick the two degrees that make the tritone in any major key: the only pair in the key six half steps apart.",
        skills: [{ skill: "I03", w: 1 }],
        feedbackText: {
          "id.wrong":
            "Not those two. Find the tritone of the hook in C major, then name its two notes as degrees.",
        },
        hints: ladder(
          "Start from the hook in C major. Find its pair that was six half steps apart, then name both notes as degrees.",
          "B and F. Name each one as a degree of C major, counting C as 1.",
          "B is degree 7, the note just below home. Now count up from C to F.",
        ),
        answer: {
          ui: "choice",
          options: [
            { id: "four-seven", label: "4 and 7" },
            { id: "one-five", label: "1 and 5" },
            { id: "three-six", label: "3 and 6" },
            { id: "two-six", label: "2 and 6" },
          ],
        },
        correct: { choice: ["four-seven"] },
        spelling: "strict",
        order: "set",
        tests: [
          { name: "4 and 7", response: { answer: { choice: ["four-seven"] } }, expect: "pass" },
          {
            name: "1 and 5",
            response: { answer: { choice: ["one-five"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Clash, then rest",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      exercise: {
        kind: "code-make",
        id: "clash-then-rest",
        version: 1,
        role: "practice",
        // The catalog's text for a `uses` rule names the tool ID; the label says it in words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        prompt:
          "The riff plays its pairs one note after the other. Change it so each pair's two notes play together, with `,`. Keep B with F as the clash and let it move to a pair at rest. Done when the riff plays notes together with `,`.",
        skills: [{ skill: "I05", w: 1 }],
        code: { starter: keys(MAKE_APART) },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "together",
            label: "`,` used in a pattern, so notes play at once",
            required: true,
            skills: ["I05"],
            rule: "uses",
            tool: "tb.mini.stack",
          },
          {
            id: "answer",
            label: "`< >` used, so bar 2 can answer bar 1",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.mini.alt",
          },
          {
            id: "hold",
            label: "`@` used, for example to hold a pair at rest longer",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.mini.elongate",
          },
        ],
        hints: ladder(
          "The starter's pairs play one note at a time. Make the two notes of each pair start at the same moment.",
          "A comma inside brackets: `[c4,e4]`. Each pair needs its own brackets, inside the bar's brackets.",
          "Bar 1 becomes `[[c4,e4] [c4,g4]]`: two pairs, each half a bar. Do the same in bar 2, and keep B with F for the clash.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: keys(MAKE_APART) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the pairs together", response: { code: keys(MAKE_TOGETHER) }, expect: "pass" },
          {
            name: "beyond the brief: hats, a held pair, an octave on top",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nkeys: note("<[[c4,e4] [c4,g4] [e4,c5] [c4,g4]] [[c4,a4]@2 [b3,f4]@2]>").s("piano").gain(.8)`,
            },
            expect: "pass",
          },
          {
            name: "two lines, no comma",
            response: {
              code: `${TEMPO}keys: note("<[c4 c4] [c4 b3]>").s("piano")\nvox: note("<[e4 g4] [a4 f4]>").s("piano")`,
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
