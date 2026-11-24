// U12.L01 Major 7 & Minor 7. A seventh chord is a triad with one more note, a 7th above the root. A major
// triad with the 7th a half step below the octave is a major seventh chord: Cmaj7 is C E G B, in code `C^7`.
// A minor triad with a ♭7 is a minor seventh chord: Am7 is A C E G, in code `Am7`. Together they are the
// sound of soul and neo-soul. What the learner has: the four-note stack `n("[0,2,4,6]")` on this very loop
// (U06.L10 "Seventh Colour", the preview this lesson calls back), the dominant seventh and its symbol `C7`
// (U11.L04), chords by name with `.voicing()` (U05.L08), one `const` driving chords and bass (U08.L04,
// U11.L04), the Rhodes and the upright bass. Not yet: the ear for major against dominant seventh (U12.L02),
// the half-diminished and diminished sevenths (`Cm7b5`, `Co7`: U12.L03), which degree gets which seventh
// (U12.L04), left-hand voicings (U12.L06). Spec: content/specs/U12.md.
//
// How it is graded (AUTHORING §17, §19): a chord written by name is its pitch classes and its lowest note at
// each onset (`pcset` with `bass: true`), so `C7` for `C^7` fails on one note and the same symbols in
// brackets pass; the keyboard compares pitch classes and the lowest note; quality by ear is a `quality-pad`
// with the two qualities of the lesson. The Make's one required rule is `chord-qualities` read at seventh
// depth (`depth: "seventh"`) with `contains: ["maj7", "m7"]`: a triad loop and a loop of dominant sevenths
// both fail, and any loop with one of each passes, whatever its roots.
import { defineLesson, type HintLadder, type IdentifyEx } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
/** The root of every chord, low on the upright: the voicing above does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/**
 * The tune of U06.L10 "Seventh Colour": every note belongs to the four-note chord under it
 * (E G B | A G E | F D A | G F).
 */
const SOUL_TUNE = mel("<[2 ~ 4 6] [5 ~ 4 2] [3 ~ 1 5] [4 ~ 3 ~]>");
/** The loop of U06.L10 by name: Cmaj7 Am7 Dm7 G7. */
const HOOK = loop("<C^7 Am7 Dm7 G7>", SOUL_TUNE);
const HOOK_TRIADS = loop("<C Am Dm G>", SOUL_TUNE);

/** S2: C, then Cmaj7. */
const C_THEN_CMAJ7 = code('chords: chord("<C C^7>").voicing().s("rhodes")');
/** S3: the two kinds stacked by hand from their roots, so the roll reads root, 3rd, 5th, 7th bottom to top. */
const TWO_KINDS = code('chords: note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>").s("rhodes")');

/** S5: three triads to name as sevenths; G7 is already one (U11.L04). */
const MODIFY_STARTER = loop("<⟪C Am Dm⟫ G7>");
const MODIFY_SOLUTION = loop("<C^7 Am7 Dm7 G7>");

/** S6: one chord a bar, comped twice, on roots the lesson has not used. */
const comp = (sym: string) => code(`chords: chord("${sym}").voicing().struct("x ~ x ~").s("rhodes")`);

/**
 * The Make: a walk down from F to C in plain triads, with a tune that falls with it (A C A | G B G | F A F |
 * E). Named with sevenths it is Fmaj7 Em7 Dm7 Cmaj7, and every tune note is still a chord note.
 */
const WALK_TUNE = mel("<[5 ~ 7 5] [4 ~ 6 4] [3 ~ 5 3] [2 ~ ~ ~]>");
const MAKE_STARTER = loop("<F Em Dm C>", WALK_TUNE);
const MAKE_MINIMAL = loop("<F^7 Em7 Dm7 C^7>", WALK_TUNE);

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

const earHints = (): HintLadder =>
  ladder(
    "Listen through the whole chord, not only its lowest notes: is the triad inside it major, bright, or minor, darker?",
    "A major triad with a 7th close under the octave is a major seventh chord; a minor triad with a ♭7 is a minor seventh chord.",
    "Hum the hook's first chord, Cmaj7, then its second, Am7. Which of the two does this one sit like?",
  );
const earPart = (id: string, prompt: string, symbol: string, answer: "maj7" | "m7"): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "C07", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: comp(symbol), bars: 1, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "quality-pad", set: ["maj7", "m7"] },
  correct: { qualities: [answer] },
  feedbackText: {
    "id.quality":
      answer === "maj7"
        ? "Listen again for the triad inside the chord: this one is major, bright, and its 7th sits a half step under the root's octave."
        : "Listen again for the triad inside the chord: this one is minor, darker, and its 7th sits a whole step under the root's octave.",
  },
  tests: [
    { name: answer, response: { answer: { qualities: [answer] } }, expect: "pass" },
    {
      name: answer === "maj7" ? "heard as a minor seventh" : "heard as a major seventh",
      response: { answer: { qualities: [answer === "maj7" ? "m7" : "maj7"] } },
      expect: "fail",
      feedback: ["id.quality"],
    },
  ],
});

export default defineLesson({
  id: "U12.L01",
  version: 4,
  title: "Major 7 & Minor 7",
  objective: "I can write Cmaj7 and Am7 by name (C^7, Am7), build them, and hear what the 7th adds.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C07"],
  practises: [],
  terms: [
    { id: "term.major-seventh-chord", step: "S3" },
    { id: "term.minor-seventh-chord", step: "S3" },
  ],
  canDo: ["cd.code.seventh-chords"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Seventh Colour, by name",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "seventh-colour-by-name",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the loop twice: first in plain triads, then with the note you stacked on each chord in Seventh Colour. Listen for the tune against the chords: in which loop does it blend in, and in which does it stand apart?",
        skills: [{ skill: "C07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK_TRIADS, caption: "Loop 1: C, Am, Dm and G, three notes each.", bars: 4 },
          { code: HOOK, caption: "Loop 2: the same roots, four notes each, written by name.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "What ^7 adds",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "what-the-caret-adds",
        version: 1,
        role: "practice",
        prompt:
          'Predict which note `^7` adds to the C chord, then run it. `chord("<C C^7>")` plays C for one bar, then C^7 for one bar.',
        skills: [{ skill: "C07", w: 1 }],
        hints: null,
        tests: [],
        code: C_THEN_CMAJ7,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "b", label: "B: a half step below the next C" },
          { id: "b-flat", label: "B♭: a whole step below the next C, as in C7" },
          { id: "d", label: "D: the note above the next C" },
        ],
        correct: ["b"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two triads, two sevenths",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "two-kinds", code: TWO_KINDS, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "two-triads-two-sevenths",
        version: 1,
        role: "practice",
        prompt:
          "Run the code and read the note names on the roll, bottom to top: bar 1 is Cmaj7, bar 2 is Am7. Then answer both questions: which four notes make Am7, and how many half steps lie from C up to B.",
        skills: [{ skill: "C07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop on bar 2 and read the roll from the bottom: A, C, E, then one more. For the count, go from C up to B one key at a time; the next C would be 12.",
        },
        hints: ladder(
          "Each bar is a triad you know with one more note on top. Which triad is under bar 2?",
          "Bar 2 is the A minor triad, A C E, plus the note a whole step below the next A. Bar 1's top note is a half step below the next C.",
          "From C up to the next C is 12 half steps. B sits one half step below that C.",
        ),
        code: { starter: TWO_KINDS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which four notes make Am7?",
            options: [
              { id: "a-c-e-g", label: "A, C, E and G" },
              { id: "a-c-sharp-e-g", label: "A, C♯, E and G" },
              { id: "a-c-e-g-sharp", label: "A, C, E and G♯" },
            ],
            correct: ["a-c-e-g"],
          },
          { q: "number", prompt: "In Cmaj7, how many half steps from C up to B?", correct: 11 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["a-c-e-g"], number: 11 } },
            expect: "pass",
          },
          {
            name: "C♯ in Am7: that is A7",
            response: { answer: { choice: ["a-c-sharp-e-g"], number: 11 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "ten half steps: up to B♭, the 7th of C7",
            response: { answer: { choice: ["a-c-e-g"], number: 10 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Build Fmaj7",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "build-fmaj7",
        version: 1,
        role: "check",
        prompt:
          "Play Fmaj7 on the keyboard: the F major triad, plus the note a half step below the next F. Done when those four notes sound together with F as the lowest.",
        skills: [{ skill: "C07", w: 1 }],
        hints: ladder(
          "Start with the F major triad. Which three notes is it?",
          "F major is F, A and C. The fourth note sits a half step below the F an octave up.",
          "F, A, C, then one more white key above C: the one right under the next F.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [5, 9, 0, 4], bassPc: 5 },
        pitchMode: "octave-free",
        // E♭ for E is F7, the dominant seventh of U11.L04: the catalog would say "E♭ doesn't belong" and "E
        // is missing"; these name the size of the 7th instead.
        feedbackText: {
          "kb.extra-note":
            "{got} doesn't belong. The 7th of this chord is a half step below the octave, not a whole step.",
          "kb.missing-note": "{exp} is missing. This chord is the major triad plus the 7th.",
        },
        tests: [
          { name: "F A C E", response: { answer: { midi: [53, 57, 60, 64] } }, expect: "pass" },
          {
            name: "spread: F C E A",
            response: { answer: { midi: [53, 60, 64, 69] } },
            expect: "pass",
          },
          {
            name: "E♭ for E: F7, the dominant seventh",
            response: { answer: { midi: [53, 57, 60, 63] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "F A C: the triad, no 7th",
            response: { answer: { midi: [53, 57, 60] } },
            expect: "fail",
            feedback: ["kb.missing-note"],
          },
          {
            name: "A at the bottom",
            response: { answer: { midi: [57, 60, 64, 65] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Name the sevenths",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "name-the-sevenths",
        version: 1,
        role: "check",
        prompt:
          "Change C, Am and Dm in `changes` into seventh chords by name: write `^7` after a major chord's letter, and `7` after a minor chord's `m`. Leave G7 as it is. Done when `changes` holds four seventh chords; the bass reads `changes` too, so it follows.",
        skills: [{ skill: "C07", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. A major chord takes `^7`, a minor chord `m7`.",
        },
        srs: [
          { deck: "deck.chd.symbols", cards: ["fact.chord.Cmaj7", "fact.chord.Cm7"], mode: "seed" },
          { family: "fam.chd.spell", mode: "review-if-due" },
        ],
        hints: ladder(
          "Look at the three plain chords in `changes`: C, Am and Dm. A major one and a minor one get their sevenths written differently. Which are major?",
          "C is major: its seventh is written `C^7`. Am and Dm are minor: the 7 goes straight after the m.",
          "The first chord is `C^7`. Am becomes `Am7`; do the same to Dm.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "each bar in brackets",
            response: { code: loop("<[C^7] [Am7] [Dm7] G7>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: loop("<C Am Dm G7>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "C7 for C^7: the dominant seventh",
            response: { code: loop("<C7 Am7 Dm7 G7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Dm left as a triad",
            response: { code: loop("<C^7 Am7 Dm G7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            // `Cmaj7` is how the name is printed, not how Strudel reads it: the lint names the spelling.
            name: "Cmaj7 written as on paper",
            response: { code: loop("<Cmaj7 Am7 Dm7 G7>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
          {
            name: "G7 changed as well",
            response: { code: loop("<C^7 Am7 Dm7 G^7>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Major 7 or minor 7",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "major-seven-or-minor-seven",
        version: 1,
        role: "check",
        prompt:
          "Name the kind of each of four seventh chords, played one at a time, twice each. Pick the major seventh when the triad inside sounds major, the minor seventh when it sounds minor.",
        skills: [{ skill: "C07", w: 1 }],
        hints: earHints(),
        tests: [],
        parts: [
          earPart("chord-on-e-flat", "Chord 1, on E♭.", "Eb^7", "maj7"),
          earPart("chord-on-b", "Chord 2, on B.", "Bm7", "m7"),
          earPart("chord-on-g", "Chord 3, on G.", "Gm7", "m7"),
          earPart("chord-on-a", "Chord 4, on A.", "A^7", "maj7"),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your soul loop",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-soul-loop",
        version: 1,
        role: "practice",
        prompt:
          "Write your song's chorus: change each of the four triads in `changes` into its seventh by name, two major (`^7`) and two minor (`m7`). Then go further with one earlier tool: reorder the chords, comp them with `.struct()`, or write a new tune from their notes. Done when the chords line has at least one `^7` and one `m7`.",
        skills: [{ skill: "C07", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "major-and-minor-sevenths",
            label:
              "On the chords line, at least one major seventh chord (`^7`) and at least one minor seventh chord (`m7`)",
            required: true,
            skills: ["C07"],
            rule: "chord-qualities",
            track: "chords",
            contains: ["maj7", "m7"],
            depth: "seventh",
          },
          {
            id: "bass-on-roots",
            label:
              "The bass plays the chord's root where the chord changes, at three changes in four or more",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
          {
            id: "tune-from-the-chords",
            label: "A `mel` line whose notes on strong beats are mostly notes of the chord under them",
            required: false,
            skills: ["M03"],
            rule: "chord-tones-strong",
            melody: "mel",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.6,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Change the code until this line of the checklist holds.",
        },
        hints: ladder(
          "Which of the four triads are major, and which are minor? Each kind takes its own seventh.",
          "All four chords live in `changes`. F and C are major: `^7`. Em and Dm are minor: a 7 after the m.",
          'Write `"<F^7 Em7 Dm C>"` and hear the first two bars soften. Now the other two.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: Fmaj7 Em7 Dm7 Cmaj7", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: its own chords on the organ, comped, with a new tune",
            response: {
              code: code(
                changes("<C^7 Am7 F^7 Em7>"),
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("organ").gain(.6)',
                BASS,
                mel("<[4 ~ 2 4] [2 ~ 0 ~] [5 4 2 0] [1 ~ 4 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "every chord a dominant seventh: F7 E7 D7 C7",
            response: { code: loop("<F7 E7 D7 C7>", WALK_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "major sevenths only: Fmaj7 and Cmaj7, the minor chords left as triads",
            response: { code: loop("<F^7 Em Dm C^7>", WALK_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
