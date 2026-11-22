// U11.L04 The Dominant Seventh. A dominant seventh is a major triad with a minor 7th on top: C7 is C E G B♭,
// ten half steps from the root up to the 7th. It sounds restless and wants to move; the blues puts one on
// every chord. Its symbol is `C7` and its code `chord("C7")`. What the learner has: triads by name in
// `chord()` with `.voicing()` (U05.L08) and their symbols (U05.L04), the four-note stack (U06.L10), V–I
// (U06.L04), `const` and `.rootNotes()` (U08), the blues scale and `crunch` (U11.L03). Not yet: the other
// sevenths by name (major 7th, minor 7th: U12.L01), the twelve bars (U11.L05), swing (U11.L07).
// Spec: content/specs/U11.md.
//
// How it is graded (AUTHORING §17): a chord answer is its pitch classes and its lowest note (`pcset` per
// onset with `bass: true`), so a major 7th (`C^7`) fails and the same four notes in another dictionary would
// too only if the notes differ. The keyboard compares pitch classes and the lowest note. The Make's one
// required rule is `chord-qualities` read at seventh depth (`depth: "seventh"`), so a triad vamp and a vamp
// of major sevenths both fail while any two dominant sevenths pass, whatever their roots. The key is C blues
// (contracts §6.6 C5), so the chord band reads C7 as I7 and F7 as IV7, never V7/IV.
import { defineLesson, type HintLadder, type IdentifyEx } from "@oak/content-kit";

const BPM = 90;
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
const CHORDS = 'chords: chord(changes).voicing().s("piano")';
/** The root of every chord on every beat. */
const BASS = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)';
/** A two-bar riff on the blues scale (U11.L03): C E♭ F G | G♭ F C. */
const RIFF = 'gtr: n("<[0 1 2 4] [3 2 0 ~]>").scale("C3:blues").s("crunch")';
const vamp = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

const HOOK = vamp("<C7 F7>", RIFF);
const TRIADS = vamp("<C F>");
const SEVENTHS = vamp("<C7 F7>");
/** S2: G, then G7. */
const G_THEN_G7 = code('chords: chord("<G G7>").voicing().s("piano")');
/** S3: the vamp's two chords, then G7 pulling home to C. */
const PULL = vamp("<C7 F7 G7 C>");

/** S5: four triads, the one thing to change is the string. */
const MODIFY_STARTER = vamp("<⟪C F G C⟫>");
const MODIFY_SOLUTION = vamp("<C7 F7 G7 C7>");

/** S6: one chord a bar, comped twice, in several keys and voicings. */
const comp = (sym: string) => code(`chords: chord("${sym}").voicing().struct("x ~ x ~").s("piano")`);
/** D7 by hand, close and in root position: D F♯ A C, so the 7th is the top note. */
const D7_BY_HAND = code('chords: note("[d3,f#3,a3,c4]").struct("x ~ x ~").s("piano")');

/** The Make starts from the vamp in triads, chords and bass, without a riff. */
// Learner review: the Make starts with the hook's riff over the plain triads, so the vamp sounds like a record
// the moment the sevenths go in, and the learner's own choice is the riff (and the pair of chords).
const MAKE_STARTER = vamp("<C F>", RIFF);

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

const TRIAD_OR_SEVENTH = [
  { id: "triad", label: "A major triad" },
  { id: "seventh", label: "A dominant seventh" },
];
const earHints = (): HintLadder =>
  ladder(
    "Does the chord sound settled, or does it lean somewhere?",
    "A dominant seventh adds a ♭7 on top of the major triad: a note a whole step below the root's octave, with a rub in it.",
    "Play the hook's C7 in your head, then this chord. Do they share that lean?",
  );
const earPart = (id: string, prompt: string, stimulus: string, answer: "triad" | "seventh"): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "C06", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: stimulus, bars: 1, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: TRIAD_OR_SEVENTH },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      answer === "seventh"
        ? "That was a dominant seventh. Listen for the top: does it lean down a step?"
        : "That was a plain major triad: three different notes, nothing leaning.",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: answer === "seventh" ? "heard as a triad" : "heard as a seventh",
      response: { answer: { choice: [answer === "seventh" ? "triad" : "seventh"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

export default defineLesson({
  id: "U11.L04",
  version: 3,
  title: "The Dominant Seventh",
  objective: "I can build, name and hear a dominant seventh: a major triad with a ♭7 on top, written C7.",
  key: { tonic: "C", mode: "blues" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C06"],
  practises: [],
  terms: [{ id: "term.dominant-seventh", step: "S3" }],
  canDo: ["cd.read.dominant-seventh"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One more note",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-more-note",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the C–F vamp in plain triads, then the same vamp with one note added to each chord and a riff on top. Listen to the chords: does the added note make them more settled, or more restless?",
        skills: [{ skill: "C06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: TRIADS, caption: "The vamp in plain triads.", bars: 4 },
          { code: HOOK, caption: "One note added to each chord, and the blues-scale riff on top.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "What the 7 adds",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "what-the-seven-adds",
        version: 1,
        role: "practice",
        prompt:
          '`chord("<G G7>")` plays G for a bar, then G7. Predict which note the 7 adds to the G chord. Pick one answer, then listen to check it.',
        skills: [{ skill: "C06", w: 1 }],
        hints: null,
        tests: [],
        code: G_THEN_G7,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "flat-seven", label: "F: a minor 7th above G, a whole step below the next G" },
          { id: "major-seven", label: "F♯: the 7th note of G major" },
          { id: "octave", label: "G again, an octave up" },
        ],
        correct: ["flat-seven"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Four notes, one lean",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "the-pull", code: PULL, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "four-notes-one-lean",
        version: 1,
        role: "practice",
        prompt:
          "Run the four bars: C7, F7, G7, then a plain C. Read the degree labels of bar 1 on the roll, bottom to top. Then answer two questions: which four notes make C7, and how many half steps lie from C up to B♭.",
        skills: [{ skill: "C06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop on bar 1: the labels read 1, 3 and 5, plus one more, ♭7. Count the keys from C up to it.",
        },
        hints: ladder(
          "Bar 1 is the C chord with something added. Which label on the roll is new?",
          "The new label is ♭7: the note a whole step below C. Name its letter, then count half steps from C.",
          "From C up to the next C is 12 half steps. The new note sits a whole step, two half steps, below that C.",
        ),
        code: { starter: PULL },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which four notes make C7?",
            options: [
              { id: "c-e-g-bb", label: "C, E, G and B♭" },
              { id: "c-e-g-b", label: "C, E, G and B" },
              { id: "c-eb-g-bb", label: "C, E♭, G and B♭" },
            ],
            correct: ["c-e-g-bb"],
          },
          { q: "number", prompt: "How many half steps from C up to B♭?", correct: 10 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["c-e-g-bb"], number: 10 } },
            expect: "pass",
          },
          {
            name: "B for B♭",
            response: { answer: { choice: ["c-e-g-b"], number: 10 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "eleven half steps: up to B",
            response: { answer: { choice: ["c-e-g-bb"], number: 11 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Build F7",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "build-f7",
        version: 1,
        role: "check",
        prompt:
          "Build F7 on the keyboard with F at the bottom: the F major triad, plus its ♭7 on top. Done when exactly those four keys are down.",
        skills: [{ skill: "C06", w: 1 }],
        hints: ladder(
          "Start with the F major triad, then add one note on top. Which three notes make F major?",
          "F major is F, A and C. The ♭7 sits a whole step below the F an octave up.",
          "F, A, C, then one more key above C: a black key.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [5, 9, 0, 3], bassPc: 5 },
        pitchMode: "octave-free",
        // E for E♭ is the major 7th (U12's chord): the catalog would say "E doesn't belong" and "E♭ is
        // missing"; these name the flat 7th instead.
        feedbackText: {
          "kb.extra-note":
            "{got} doesn't belong. A dominant seventh has the ♭7: a whole step below the octave, not a half step.",
          "kb.missing-note": "{exp} is missing. A dominant seventh is the major triad plus the ♭7.",
        },
        srs: [{ deck: "deck.chd.symbols", cards: ["fact.chord.C7", "fact.chord.G7"], mode: "seed" }],
        tests: [
          { name: "F A C E♭", response: { answer: { midi: [53, 57, 60, 63] } }, expect: "pass" },
          {
            name: "spread: F C E♭ A",
            response: { answer: { midi: [53, 60, 63, 69] } },
            expect: "pass",
          },
          {
            name: "E for E♭: the major 7th",
            response: { answer: { midi: [53, 57, 60, 64] } },
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
            response: { answer: { midi: [57, 60, 63, 65] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Seventh every chord",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "seventh-every-chord",
        version: 1,
        role: "check",
        prompt:
          "The `changes` string holds four triads: C, F, G, C. Make each of the four a dominant seventh by editing that string. The chords and the bass both read `changes`, so this one edit changes both.",
        skills: [{ skill: "C06", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Every chord needs its ♭7: write the root's name, then 7.",
        },
        hints: ladder(
          "Look only at the `changes` string. What does each chord name need so that it plays the ♭7?",
          "C becomes C7 in the string: the number goes straight after the letter.",
          "The first chord is `C7`. Do the same to F, G and the last C.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "each bar in brackets",
            response: { code: vamp("<[C7] [F7] [G7] [C7]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: vamp("<C F G C>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            // `C^7` is U12's chord: the lint stops it before the run and names it.
            name: "major sevenths: C^7 F^7 G7 C^7",
            response: { code: vamp("<C^7 F^7 G7 C^7>") },
            expect: "fail",
            feedback: ["code.locked-chord"],
          },
          {
            name: "G left as a triad",
            response: { code: vamp("<C7 F7 G C7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "lowercase: c7 is silent",
            response: { code: vamp("<c7 F7 G7 C7>") },
            expect: "fail",
            feedback: ["code.lowercase-chord-root"],
          },
          {
            name: "the bass line changed as well",
            response: {
              code: code(
                changes("<C7 F7 G7 C7>"),
                CHORDS,
                'bass: chord(changes).rootNotes(2).s("ebass").lpf(600)',
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Triad or seventh",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "triad-or-seventh",
        version: 1,
        role: "check",
        prompt:
          "Listen to four chords, one at a time, each in its own key and voicing. For each chord, pick a plain major triad or a dominant seventh. Listen for a note that leans and rubs: that is the ♭7.",
        skills: [{ skill: "C06", w: 1 }],
        hints: earHints(),
        tests: [],
        parts: [
          earPart("chord-on-e", "Chord 1, on E.", comp("E7"), "seventh"),
          earPart("chord-on-a", "Chord 2, on A.", comp("A"), "triad"),
          earPart("chord-on-d", "Chord 3, on D, played by hand.", D7_BY_HAND, "seventh"),
          earPart("chord-on-b-flat", "Chord 4, on B♭.", comp("Bb"), "triad"),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your blues vamp",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-blues-vamp",
        version: 1,
        role: "practice",
        prompt:
          "Change both chords in `changes` to dominant sevenths. Then make the riff yours with new notes from the blues scale and a new rhythm. You can also try another pair, such as G7 and C7, or F7 and B♭7 (`Bb7`). Done when the chords line plays at least two dominant sevenths.",
        skills: [{ skill: "C06", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-dominant-sevenths",
            label: "The chords line plays at least two dominant seventh chords",
            required: true,
            skills: ["C06"],
            rule: "chord-qualities",
            track: "chords",
            anyOf: ["7"],
            min: 2,
            depth: "seventh",
          },
          {
            id: "blues-riff",
            label: "The gtr line plays the blue 3rd, ♭3 (E♭ over C), at least once",
            required: false,
            skills: ["S11"],
            rule: "degree-set",
            track: "gtr",
            contains: ["b3"],
          },
          {
            id: "bass-on-roots",
            label: "When the chord changes, the bass plays its root, at least 3 times in 4",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Look at the `changes` string: both chords are plain triads. Which symbol turns a C chord into one with a ♭7 on top?",
          "Both chords live in `changes`. Each name needs a 7 after its letter.",
          'Write `"<C7 F>"` and hear the first chord lean. Now the second one.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: C7 and F7, no riff yet", response: { code: SEVENTHS }, expect: "pass" },
          {
            name: "beyond the brief: G7 and C7 on the organ, a riff of its own",
            response: {
              code: code(
                changes("<G7 C7 G7 F7>"),
                'chords: chord(changes).voicing().s("organ").gain(.6)',
                BASS,
                'gtr: n("<[4 ~ 3 2] [0 ~ 1 0] [5 4 2 ~] [3 2 1 0]>").scale("C3:blues").s("crunch")',
              ),
            },
            expect: "pass",
          },
          {
            name: "only one dominant seventh: C7 and a plain F",
            response: { code: vamp("<C7 F>", RIFF) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
