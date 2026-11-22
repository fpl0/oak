// U11.L01 Five Notes, No Wrong Ones. The major pentatonic is the major scale without its two half steps:
// degrees 1 2 3 5 6, no 4 and no 7. Over the four-chord loop none of its notes clashes with a chord (the worst
// any of them does is add a colour: E over F, C over G), so the learner can improvise by editing: change any
// number and it still fits. In code it is `.scale("C4:major:pentatonic")` (unlocked here), and `n` counts the
// scale's own five notes, so "degree − 1" no longer holds: n 3 is degree 5, n 4 is degree 6. What the learner
// has: degrees and `n` (U03), the four-chord loop as stacks (U06.L01), the root bass (U08.L01). Not yet: the
// minor pentatonic (U11.L02), blue notes (U11.L03), the 12-bar form (U11.L05). U11.L01 sits before U10.CP
// (session 110) and asks for nothing from U10. Spec: content/specs/U11.md.
//
// How it is graded: S4 moves a line onto the pentatonic and compares it with `events` (absolute, onsets), so
// the numbers must change to keep the notes; writing degree − 1 earns `melody.wrong-degree`. S5 is four fixed
// runs over a C chord (no drill family generates scale colour yet). S6 builds G major pentatonic on the
// keyboard with the spec's `scale-builder` answer (keys read as pitch classes against G). The Make's required rule is `in-key`
// with a C major pentatonic key: any tune on `.scale("C4:major:pentatonic")` passes whatever its numbers,
// which is the point of the lesson.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The four-chord loop, I V vi IV, by chord name, and its root bass (U08.L01). Names, not stacks on
 * `.scale("C3:major")`: every code string here has one scale, the key of its exercise (check 13).
 */
const CHORDS = 'chords: chord("<C G Am F>").voicing().s("piano").gain(.5)';
const BASS = 'bass: chord("<C G Am F>").rootNotes(2).s("ebass").lpf(600)';
const LOOP = [CHORDS, BASS] as const;
const PENTA = "C4:major:pentatonic";
const mel = (tune: string, scale = PENTA) => `mel: n("${tune}").scale("${scale}").s("piano")`;

/** The hook's tune: A G E D | C D E | G A C5 A | E D C. No F and no B anywhere. */
const TUNE = "<[4 3 2 1] [0 1 2 ~] [3 4 5 4] [2 1 0 ~]>";
const HOOK = code(...LOOP, mel(TUNE));
/**
 * The same rhythm on all seven notes: F E D C | C D E | F G A G | B A G. F lands on beat 1 over C and over Am,
 * a half step above the chords' E; B lands on beat 1 over F, against its C.
 */
const RUB = code(...LOOP, 'mel: note("<[f4 e4 d4 c4] [c4 d4 e4 ~] [f4 g4 a4 g4] [b4 a4 g4 ~]>").s("piano")');
/** S2: the five notes of the scale, from home, over a held C. */
const FIVE = code(mel("0 1 2 3 4"), 'bass: note("c2").s("ebass").lpf(600)');

/** S4: a line written on the major scale (C D E G | A G E), now sitting on the pentatonic. */
const LINE_ON_MAJOR = "<[0 1 2 4] [5 4 2 ~]>";
const LINE_ON_PENTA = "<[0 1 2 3] [4 3 2 ~]>";
const MOVE_STARTER = code(...LOOP, `mel: n("⟪${LINE_ON_MAJOR}⟫").scale("${PENTA}").s("piano")`);
const MOVE_SOLUTION = code(...LOOP, mel(LINE_ON_PENTA));

/** S5: runs over a held C chord, on the major scale or the major pentatonic. */
const run = (tune: string, scale: string) =>
  code('chords: chord("C").voicing().s("piano").gain(.6)', mel(tune, scale));
const RUN_SEVEN_UP = run("0 1 2 3 4 5 6 7", "C4:major");
const RUN_FIVE_UP = run("0 1 2 3 4 5 ~ ~", PENTA);
const RUN_FIVE_DOWN = run("5 4 3 2 1 0 ~ ~", PENTA);
const RUN_SEVEN_DOWN = run("7 6 5 4 3 2 1 0", "C4:major");
const COUNT = [
  { id: "five", label: "Five notes: the major pentatonic" },
  { id: "seven", label: "Seven notes: the major scale" },
];
const COUNT_WRONG = {
  "id.wrong":
    "Not this one. Listen for the two smallest steps, E to F and B to C: if they are there, the run has all seven notes.",
};

/**
 * The Make starts with a tune on the major scale: G [F E] D | D E D | G A [B A] G | E D C. F and B pass by as
 * eighths, so they rub without sitting on the chords; moving the tune onto the pentatonic is the first edit.
 */
const MAKE_TUNE = "<[4 [3 2] 1 ~] [1 2 1 ~] [4 5 [6 5] 4] [2 1 0 ~]>";
const MAKE_STARTER = code(BASS, mel(MAKE_TUNE, "C4:major"));

/** Drums from the Band in S1–S4 (the chords are in the code); the Make takes the Band's chords too. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const DRUMS_CHORDS = { band: "band.axis-4bar", tracks: ["drums", "chords"] } as const;
const PENTA_KEY = { tonic: "C", mode: "major pentatonic" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "U11.L01",
  version: 3,
  title: "Five Notes, No Wrong Ones",
  objective: "I can write a melody on the major pentatonic, the major scale without 4 and 7.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S09"],
  practises: [],
  terms: [{ id: "term.pentatonic", step: "S3" }],
  canDo: ["cd.compose.pentatonic"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Nothing rubs",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "nothing-rubs",
        key: PENTA_KEY,
        version: 1,
        role: "practice",
        prompt:
          "Listen to tune 1, then tune 2: the same rhythm over the four-chord loop, on different notes. In each, listen for the moments where the tune grinds against the chords. Notice whether tune 2 has any.",
        skills: [{ skill: "S09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: RUB,
            caption: "Tune 1, on all seven notes of C major. Listen for the grinding moments.",
            bars: 4,
          },
          { code: HOOK, caption: "Tune 2: the same rhythm on five of those notes.", bars: 4 },
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
        key: PENTA_KEY,
        version: 1,
        role: "practice",
        prompt:
          'Predict which five notes `n("0 1 2 3 4")` plays on `.scale("C4:major:pentatonic")`, the second tune\'s scale. Pick one answer, then listen to check it.',
        skills: [{ skill: "S09", w: 1 }],
        hints: null,
        tests: [],
        code: FIVE,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "cdega", label: "C D E G A" },
          { id: "cdefg", label: "C D E F G" },
          { id: "cegbd", label: "C E G B D" },
        ],
        correct: ["cdega"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two notes left out",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "five-notes", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "two-notes-left-out",
        key: PENTA_KEY,
        version: 1,
        role: "practice",
        prompt:
          "Run the tune and read the degree label on each note in the roll. Then answer two questions: which two degrees of the major scale never appear, and which degree `n` 3 plays on this scale.",
        skills: [{ skill: "S09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the labels on the roll: 1, 2, 3, 5 and 6 come round again and again. Two of the seven never do.",
        },
        hints: ladder(
          "Count the different labels on the roll, not the notes. How many of the seven degrees do you see?",
          "List 1 to 7 and cross off each label you find. The two left over are the missing ones.",
          "`n` 0, 1 and 2 are degrees 1, 2 and 3 as always. Find the note `n` 3 plays on the roll and read its label.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which two degrees of the major scale are left out?",
            options: [
              { id: "4-7", label: "4 and 7" },
              { id: "2-6", label: "2 and 6" },
              { id: "3-5", label: "3 and 5" },
            ],
            correct: ["4-7"],
          },
          { q: "number", prompt: "On this scale, `n` 3 plays which degree?", correct: 5 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["4-7"], number: 5 } }, expect: "pass" },
          {
            name: "2 and 6",
            response: { answer: { choice: ["2-6"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "degree − 1 thinking: n 3 is degree 4",
            response: { answer: { choice: ["4-7"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Same notes, new numbers",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "same-notes-new-numbers",
        key: PENTA_KEY,
        version: 1,
        role: "check",
        prompt:
          "This line was written on the major scale to play C D E G, then A G E. Its scale is now the major pentatonic, so some numbers play other notes. Change the numbers in the highlighted part. Done when the line plays C D E G, then A G E again.",
        skills: [{ skill: "S09", w: 1 }],
        code: { starter: MOVE_STARTER },
        reference: { solutions: [MOVE_SOLUTION], bars: 4 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the line plays {got}, the target has {exp}. On the pentatonic `n` counts its five notes, so a number past 2 no longer means degree − 1.",
        },
        hints: ladder(
          "The first three numbers, 0 1 2, still play C D E. Look at the notes after those: which ones are G or A?",
          "On this scale `n` 0, 1 and 2 are C, D and E, as before. The fourth note of the scale is G, the fifth is A.",
          "G is degree 5, and on the pentatonic it is `n` 3. Find every G and every A in the line.",
        ),
        tests: [
          { name: "reference", response: { code: MOVE_SOLUTION }, expect: "pass" },
          {
            name: "the last note held to the end of the bar",
            response: { code: code(...LOOP, mel("<[0 1 2 3] [4 3 2@2]>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(...LOOP, mel(LINE_ON_MAJOR)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "only bar 1 renumbered: n 5 plays C5 for A",
            response: { code: code(...LOOP, mel("<[0 1 2 3] [5 4 2 ~]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "degree − 1 kept for G: n 4 plays A",
            response: { code: code(...LOOP, mel("<[0 1 2 4] [4 3 2 ~]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the scale put back to major",
            response: { code: code(...LOOP, mel(LINE_ON_MAJOR, "C4:major")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      // An `ear` step: the spec's `compare` takes a single identify, and this is four fixed items (U08.L03 S5).
      kind: "ear",
      title: "Five or seven?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "five-or-seven",
        version: 1,
        role: "check",
        prompt:
          "Listen to four short runs over a C chord. For each run, pick five notes or seven. Seven notes move only in small steps; five notes take two bigger jumps.",
        skills: [{ skill: "S09", w: 1 }],
        hints: ladder(
          "Follow each run note by note and listen for a step that sounds wider than the rest. Can you hear one?",
          "Seven notes means every step is small, with two half steps among them. Five notes leaves two bigger gaps.",
          "In the major scale E steps to F by a half step. Listen to the middle of each run for it.",
        ),
        tests: [],
        parts: [
          {
            kind: "identify",
            id: "run-1",
            version: 1,
            role: "check",
            prompt: "Run 1. Five notes or seven?",
            skills: [{ skill: "S09", w: 1 }],
            hints: ladder(
              "Does the run take any bigger steps on its way up?",
              "Listen between E and G, and between A and the top C.",
              "Hum along slowly: is there a note between E and G?",
            ),
            stimulus: { src: "code", code: RUN_SEVEN_UP, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COUNT },
            correct: { choice: ["seven"] },
            feedbackText: COUNT_WRONG,
            tests: [
              { name: "seven", response: { answer: { choice: ["seven"] } }, expect: "pass" },
              {
                name: "five",
                response: { answer: { choice: ["five"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "run-2",
            key: PENTA_KEY,
            version: 1,
            role: "check",
            prompt: "Run 2. Five notes or seven?",
            skills: [{ skill: "S09", w: 1 }],
            hints: ladder(
              "Does the run take any bigger steps on its way up?",
              "Listen between E and the next note, and near the top.",
              "Hum along slowly: after E, does the run skip a note?",
            ),
            stimulus: { src: "code", code: RUN_FIVE_UP, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COUNT },
            correct: { choice: ["five"] },
            feedbackText: COUNT_WRONG,
            tests: [
              { name: "five", response: { answer: { choice: ["five"] } }, expect: "pass" },
              {
                name: "seven",
                response: { answer: { choice: ["seven"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "run-3",
            key: PENTA_KEY,
            version: 1,
            role: "check",
            prompt: "Run 3. Five notes or seven?",
            skills: [{ skill: "S09", w: 1 }],
            hints: ladder(
              "This one comes down. Does it take any bigger steps?",
              "Listen at the top, from C down to the next note, and in the middle.",
              "Hum along slowly: from the top C, is the next note one step down or more?",
            ),
            stimulus: { src: "code", code: RUN_FIVE_DOWN, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COUNT },
            correct: { choice: ["five"] },
            feedbackText: COUNT_WRONG,
            tests: [
              { name: "five", response: { answer: { choice: ["five"] } }, expect: "pass" },
              {
                name: "seven",
                response: { answer: { choice: ["seven"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "run-4",
            version: 1,
            role: "check",
            prompt: "Run 4. Five notes or seven?",
            skills: [{ skill: "S09", w: 1 }],
            hints: ladder(
              "This one comes down too. Are all its steps small?",
              "Listen at the top, from C down, and near the middle, around F and E.",
              "Hum along slowly: from the top C, is the next note one step down or more?",
            ),
            stimulus: { src: "code", code: RUN_SEVEN_DOWN, bars: 1, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: COUNT },
            correct: { choice: ["seven"] },
            feedbackText: COUNT_WRONG,
            tests: [
              { name: "seven", response: { answer: { choice: ["seven"] } }, expect: "pass" },
              {
                name: "five",
                response: { answer: { choice: ["five"] } },
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
      kind: "quiz",
      title: "Build it on G",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "fact",
        id: "build-it-on-g",
        version: 2,
        role: "check",
        prompt:
          "Build G major pentatonic on the keyboard: G as home, then degrees 2, 3, 5 and 6 of G major above it. Leave out degrees 4 and 7. Done when exactly those five keys are down.",
        skills: [{ skill: "S09", w: 1 }],
        srs: [{ family: "fam.key.scale-spell", mode: "review-if-due" }],
        hints: ladder(
          "Start from G major, all seven notes, and take two of them away. Which degrees go?",
          "G major has one black key, F♯, which is its degree 7. Degree 4 is C, the white key a half step above degree 3, B.",
          "Home is G and degree 2 is A. Three more: degree 3, degree 5 and degree 6.",
        ),
        // The scale builder on the keyboard (Wave 5 `scale-builder` answer): the keys are read as pitch classes
        // against G, so any octave counts, and each degree left out or added is named with its note.
        answer: { ui: "scale-builder", tonic: "G", input: "keyboard", range: ["g3", "g4"] },
        correct: { degrees: ["1", "2", "3", "5", "6"] },
        spelling: "enharmonic",
        order: "set",
        feedbackText: {
          "id.scale-extra":
            "{note} doesn't belong. Remove it: G major pentatonic leaves out degree 4 (C) and degree 7 (F♯).",
        },
        tests: [
          { name: "G A B D E", response: { answer: { midi: [55, 57, 59, 62, 64] } }, expect: "pass" },
          {
            name: "G A B D E with the top G as well",
            response: { answer: { midi: [55, 57, 59, 62, 64, 67] } },
            expect: "pass",
          },
          {
            name: "all seven notes of G major",
            response: { answer: { midi: [55, 57, 59, 60, 62, 64, 66] } },
            expect: "fail",
            feedback: ["id.scale-extra"],
          },
          {
            name: "white keys only: C for B",
            response: { answer: { midi: [55, 57, 60, 62, 64] } },
            expect: "fail",
            feedback: ["id.scale-extra", "id.scale-missing"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Five notes, any order",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS_CHORDS },
      exercise: {
        kind: "code-make",
        id: "five-notes-any-order",
        version: 1,
        role: "practice",
        prompt:
          "Your tune is on the major scale, and its F and B rub against the Band's four-chord loop. Change its scale to the major pentatonic so every note fits. Then change numbers, rests and rhythm, and keep what you like. Done when every note is on C major pentatonic.",
        skills: [{ skill: "S09", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "pentatonic-tune",
            label: "Every note of the mel line is on C major pentatonic (C D E G A)",
            required: true,
            skills: ["S09"],
            rule: "in-key",
            key: { tonic: "C", mode: "major pentatonic" },
            minRatio: 1,
            tracks: ["mel"],
          },
          {
            id: "comes-home",
            label: "The last note of the mel line is degree 1 (C)",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "mel",
          },
          {
            id: "an-idea-returns",
            label: "At least half the bars of the mel line repeat the shape of an earlier bar",
            required: false,
            skills: ["M01"],
            rule: "motif-reuse",
            track: "mel",
            minRatio: 0.5,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Look at the scale in the mel line: it still says major. Which two of its notes are not in the pentatonic?",
          "The scale word decides which notes the numbers can reach. Change it, and every number lands on one of five notes.",
          "Write `:major:pentatonic` after `C4` in the scale. Then change any number you like and listen.",
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
            response: { code: code(BASS, mel(MAKE_TUNE)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars, a new rhythm, a rhodes",
            response: {
              code: code(
                BASS,
                'mel: n("<[4 ~ 3 4] [~ 2 ~ 1] [3 ~ 4 5] [4 ~ ~ ~] [4 ~ 3 4] [~ 2 ~ 1] [2 1 [0 1] 2] [0 ~ ~ ~]>").scale("C4:major:pentatonic").s("rhodes")',
              ),
            },
            expect: "pass",
          },
          {
            name: "new numbers, but still on the major scale",
            response: { code: code(BASS, mel("<[4 3 2 1] [0 1 2 ~] [3 4 5 4] [6 5 4 ~]>", "C4:major")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
