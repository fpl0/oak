// U05.L05 Inversions. A triad keeps its name when its notes are rearranged; what changes is the lowest note,
// and the lowest note is what the ear follows. With the root lowest the chord is in root position; with the
// 3rd lowest, first inversion; with the 5th lowest, second inversion. The name shows a bass that is not the
// root after a slash: C/E. What the learner has: triads stacked by hand and their roots (U05.L01), the four
// qualities (U05.L02–L03), chord names (U05.L04), negative `n` and `n` past 7 (U03.L03). Not yet: the bass
// clef (U05.L06), so every staff here is treble; voice leading (U05.L07). Spec: content/specs/U05.md.
//
// How it is graded: chords as chords (`pcset` with `bass: true`, so the same three notes with another note
// lowest fail with `harmony.bass`); a typed name with `normalize: "chord"`, which reads the slash; the Make's
// one required rule is `chord-inversions` (at least one chord whose lowest sounding note, across every
// learner track, is its 3rd or 5th). The starter is in root position throughout.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A chord line of stacked degrees in C, an octave under the tune. */
const chords = (pattern: string, extra = "", scale = "C3:major") =>
  `chords: n("${pattern}").scale("${scale}").s("piano")${extra}`;
const mel = (pattern: string, scale = "C4:major") => `mel: n("${pattern}").scale("${scale}").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * C, G/B, Am, F, an octave up from the lesson's other stacks (integration, Listen QA): in the 3rd octave
 * the last chord was F2 A2 C3, a 3rd too low to sound clearly. The lowest notes walk down C4 B3 A3 F3 while
 * the upper notes barely move: G/B is B3 D4 G4, Am is A3 C4 E4, F is F3 A3 C4. The tune, an octave above,
 * sits on chord notes (G E | G D | E C | C).
 */
const HOOK_CHORDS = "<[0,2,4] [-1,1,4] [-2,0,2] [-4,-2,0]>";
const HOOK_TUNE = "<[4 ~ 2 ~] [4 ~ 1 ~] [2 ~ 0 ~] [0 ~ ~ ~]>";
const HOOK = code(chords(HOOK_CHORDS, ".gain(.8)", "C4:major"), mel(HOOK_TUNE, "C5:major"));
const HOOK_CHORDS_ONLY = code(chords(HOOK_CHORDS, "", "C4:major"));
/** The same four chords with every root at the bottom: the lowest notes leap C3 G3 A3 F3. */
const ROOTS = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
const ROOTS_ONLY = code(chords(ROOTS));

/** The predict step: C E G rearranged as E G C. */
const E_LOWEST = code(chords("[2,4,7]"));

/**
 * The modify step: F, C, Dm, G. With bar 2 in root position the lowest notes go F3 C3 D3 G2; with C's 3rd
 * at the bottom (E3 G3 C4) they walk down by step, F E D, before G.
 */
const walk = (bar2: string) => code(chords(`<[3,5,7] ${bar2} [1,3,5] [-3,-1,1]>`));
const WALK_STARTER = walk("⟪[0,2,4]⟫");
const WALK = walk("[2,4,7]");

/** The quiz: F A C with C lowest (C4 F4 A4), on the treble staff. */
const NAME_IT = code('chords: note("[c4,f4,a4]").s("piano")');

/** The Make. The starter: C G Am F, every chord with its root lowest. */
const MAKE_STARTER = ROOTS_ONLY;

/** Drums only from the Band: the learner's chords and bass set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U05.L05",
  version: 4,
  title: "Inversions",
  objective: "I can turn a triad upside down so its 3rd or 5th is lowest, and name it with a slash: C/E.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C04"],
  practises: [],
  terms: [
    { id: "term.inversion", step: "S3" },
    { id: "term.slash-chord", step: "S6" },
  ],
  canDo: ["cd.read.inversions"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The bass walks down",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-bass-walks-down",
        version: 1,
        role: "practice",
        prompt:
          "Follow the lowest note of each chord, first in Loop 1, then in Loop 2. Listen for the loop where it moves by step and the loop where it leaps.",
        skills: [{ skill: "C04", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "The four chords, rearranged. Follow the bottom note.",
            bars: 4,
          },
          {
            code: ROOTS_ONLY,
            caption: "The same four chords, each stacked up from its root.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "E at the bottom",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "e-lowest", code: E_LOWEST, bars: 1 },
      exercise: {
        kind: "predict",
        id: "e-at-the-bottom",
        version: 1,
        role: "practice",
        prompt:
          '`n("[2,4,7]")` in C major is degrees 3, 5 and 1 an octave up: E, G and C. Predict which note is lowest and which chord this is, and pick that answer.',
        skills: [{ skill: "C04", w: 1 }],
        hints: null,
        tests: [],
        code: E_LOWEST,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "e-still-c", label: "E is lowest, and it is still a C chord: C, E and G" },
          { id: "e-new-chord", label: "E is lowest, so it is a chord on E" },
          { id: "c-lowest", label: "C is lowest, as in every C chord so far" },
        ],
        correct: ["e-still-c"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Same notes, new floor",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "the-chords", code: HOOK_CHORDS_ONLY, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "same-notes-new-floor",
        version: 1,
        role: "practice",
        prompt:
          "Run the four chords and look at bar 2, `[-1,1,4]`: B, D and G. It is a G chord, since G, B and D stack in 3rds from G. Find which of its notes is lowest, then answer both questions below.",
        skills: [{ skill: "C04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stack bar 2's notes in 3rds from G (G, B, D), then find the lowest one on the roll in that stack.",
        },
        hints: ladder(
          "Find bar 2 on the roll and read which of B, D and G sits lowest.",
          "In G, B, D the root is G, the 3rd is B and the 5th is D. Root position G would be `[4,6,8]`.",
          "`n` -1 is degree 7 below home, B. Now compare B, D, G with G, B, D letter by letter.",
        ),
        code: { starter: HOOK_CHORDS_ONLY },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which note of the G chord is lowest in bar 2?",
            options: [
              { id: "third", label: "The 3rd, B" },
              { id: "root", label: "The root, G" },
              { id: "fifth", label: "The 5th, D" },
            ],
            correct: ["third"],
          },
          {
            q: "number",
            prompt:
              "How many of bar 2's notes, by letter, are also in G with its root at the bottom (G, B, D)?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["third"], number: 3 } }, expect: "pass" },
          {
            name: "the root read off the bottom",
            response: { answer: { choice: ["root"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "only G and D counted as shared",
            response: { answer: { choice: ["third"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Let it walk",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "let-it-walk",
        version: 1,
        role: "check",
        prompt:
          "The chords are F, C, D minor, G. Bar 2's C chord has C at the bottom, so the lowest notes do not walk down F, E, D. Rearrange bar 2 so its 3rd, E, is lowest. Done when bar 2 still plays C, E and G, with E at the bottom.",
        skills: [{ skill: "C04", w: 1 }],
        code: { starter: WALK_STARTER },
        reference: { solutions: [WALK], bars: 4 },
        // A chord is its notes plus its lowest one: `[-5,-3,0]` (E G C an octave down) passes too.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Keep C, E and G, all three: only their order changes.",
          "harmony.bass":
            "Bar {bar}: the right three notes, with another one lowest. The target has E, the 3rd, at the bottom.",
        },
        hints: ladder(
          "Find which of `n` 0, 2 and 4 is E. It has to end up below the other two.",
          "E is `n` 2. For E to be lowest, the C has to move above it: up an octave is 7 more.",
          "Start the stack with `n` 2 and keep `n` 4 after it. The C goes on top.",
        ),
        tests: [
          { name: "reference", response: { code: WALK }, expect: "pass" },
          {
            name: "the same chord an octave down",
            response: { code: walk("[-5,-3,0]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: walk("[0,2,4]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the 5th at the bottom instead of the 3rd",
            response: { code: walk("[4,7,9]") },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "C dropped while moving E",
            response: { code: walk("[2,4]") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "a new stack on E",
            response: { code: walk("[2,4,6]") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Root or 3rd?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "root-or-third",
        version: 1,
        role: "check",
        prompt:
          "Oak plays one chord at a time, major or minor, each on a new note. Pick whether its lowest note is the root or the 3rd.",
        skills: [{ skill: "C04", w: 1 }],
        hints: [
          {
            text: "Hum the lowest note. Listen for whether the chord feels planted on it, or lighter, as if it could step on.",
          },
          {
            text: "With the root lowest the bottom note and the chord agree. With the 3rd lowest, the bottom note is a 3rd above the note the chord is named after.",
          },
          {
            text: "Hear it again, slower, and hum the lowest note and then the root.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.chd.inversion", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "root", label: "Root position: the root lowest" },
            { id: "first", label: "First inversion: the 3rd lowest" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.chd.inversion", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Name the bass too",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "name-it-with-its-bass",
        version: 1,
        role: "check",
        prompt:
          "A chord from the key of C plays and shows on the staff. Type its name, then a slash, then its lowest note, as in C/E.",
        skills: [{ skill: "C04", w: 1 }],
        hints: ladder(
          "Find the root first: it is the note the other two stack on in 3rds.",
          "Rearrange C, F, A until the notes are a 3rd apart. The bottom note of that stack is the root.",
          "Stacked in 3rds the notes are F, A, C, so the chord is F, a major triad. Which note is lowest on the staff?",
        ),
        stimulus: { src: "code", code: NAME_IT, bars: 1, showCode: false, showStaff: true },
        answer: { ui: "text", normalize: "chord" },
        correct: { text: ["F/C"] },
        spelling: "enharmonic",
        order: "sequence",
        tests: [
          { name: "F/C", response: { answer: { text: ["F/C"] } }, expect: "pass" },
          { name: "spaced out, with maj", response: { answer: { text: ["Fmaj / C"] } }, expect: "pass" },
          {
            name: "minor instead of major",
            response: { answer: { text: ["Fm/C"] } },
            expect: "fail",
            feedback: ["id.chord-quality"],
          },
          {
            name: "the slash left out",
            response: { answer: { text: ["F"] } },
            expect: "fail",
            feedback: ["id.chord-inversion"],
          },
          {
            name: "named after the lowest note",
            response: { answer: { text: ["C"] } },
            expect: "fail",
            feedback: ["id.chord-root"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A walking floor",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "a-walking-floor",
        version: 1,
        role: "practice",
        prompt:
          "Your chords C G Am F from Stacking Thirds all stand on their roots, so the lowest note leaps. For the part after your song's first loud part, rearrange at least one chord so its 3rd or 5th is lowest, and let the lowest notes move by step: C, G/B, Am, … . Done when at least one chord is an inversion.",
        skills: [{ skill: "C04", w: 1 }],
        // The catalog's text is "{label}: {detail}"; the detail names chords by symbols and members, and the
        // same text serves the suggestions, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "an-inversion",
            label: "At least one chord with its 3rd or 5th at the bottom, not its root",
            required: true,
            skills: ["C04"],
            rule: "chord-inversions",
            min: 1,
          },
          {
            id: "a-tune",
            label: "A tune on its own line, such as `mel`",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
        ],
        hints: ladder(
          "Between C and A the walking line needs a B. Of the four chords, only G has a B in it.",
          "G is G, B, D, written `[4,6,8]`. Take the G an octave up, or the B and D an octave down, and B is lowest.",
          "Bar 2 as `[-1,1,4]` and bar 3 as `[-2,0,2]` give C, B, A in the first three bars. For F in bar 4, try A or C at the bottom and listen.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: G/B in bar 2",
            response: { code: code(chords("<[0,2,4] [-1,1,4] [5,7,9] [3,5,7]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a bass line C B A G under root-position stacks, and a tune",
            response: {
              code: code(
                'bass: n("<0 -1 -2 -3>").scale("C2:major").s("ebass").lpf(700)',
                chords("<[0,2,4] [4,6,8] [5,7,9] [4,6,8]>", ".gain(.7)"),
                mel("<[4 ~ 2 ~] [4 ~ 1 ~] [2 ~ 0 ~] [1 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "inverted stacks, but a bass track plays every root under them",
            response: {
              code: code('bass: n("<0 4 5 3>").scale("C2:major").s("ebass").lpf(700)', chords(HOOK_CHORDS)),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
