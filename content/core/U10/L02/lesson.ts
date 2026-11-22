// U10.L02 Relative & Parallel. A major key has two minor twins. The relative minor keeps the same seven notes
// and moves home to degree 6 (C major and A minor: no sharps or flats in either); the parallel minor keeps the
// same home and lowers 3, 6 and 7 (C major and C minor: three flats). In code the relative twin changes the
// tonic and the word (`A3:minor`), the parallel twin only the word (`C4:minor`). What the learner has: natural
// minor and do-based minor syllables (U10.L01, where the twin they met was the parallel one, unnamed), key
// signatures and the circle of fifths (U03.L06–L07), the patterned `.scale()` (U03.L05), stacks moved with
// `.add()` (U06.L01), the root bass (U08.L01). Not yet: chords named in minor (U10.L04), hearing minor degrees
// (U10.L03), "a key change" as a term (U17.L01: here it is "moving to the twin key"). Spec: content/specs/U10.md.
//
// How it is graded (AUTHORING §18.3): the lesson's key is C major, where both starters sit. The parallel-twin
// modify step declares C minor as its exercise key and compares chords, bass and tune by absolute pitch, so the
// relative key (`A3:minor`: the same numbers, home on A) fails note by note. The circle facts are one `all` of
// two choices; the key signature is written on the staff. The Make's one required rule is `ends-on-degree`
// judged in A minor: the tune comes home on A, which the C major starter (ending on C, ♭3 of A minor) cannot do.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Triads stacked on `roots` (n values, one a bar) on a Rhodes with a little room. */
const chords = (roots: string, key: string) =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("${key}").s("rhodes").room(.3)`;
/** The root bass, an octave and more below the chords. */
const bass = (roots: string, key: string) => `bass: n("${roots}").scale("${key}").s("ebass").lpf(600)`;
const mel = (tune: string, key: string) => `mel: n("${tune}").scale("${key}").s("piano")`;

/** The hook: a two-chord groove, two bars in each of three keys: C major, A minor, C minor. */
const GROOVE = "<0 3>";
const GROOVE_TUNE = "<[4 2 0 2] [3 ~ 2 ~]>";
const HOOK = code(
  chords(GROOVE, "<C3:major!2 A2:minor!2 C3:minor!2>"),
  bass(GROOVE, "<C2:major!2 A1:minor!2 C2:minor!2>"),
  mel(GROOVE_TUNE, "<C4:major!2 A3:minor!2 C4:minor!2>"),
);
/** S2: the A minor scale from home to home. */
const A_MINOR_RUN = code(mel("0 .. 7", "A3:minor"));
/** S3: the three scales, one bar each. */
const THREE_SCALES = code(mel("0 .. 7", "<C4:major A3:minor C4:minor>"));

/**
 * S4, the parallel twin: I vi IV V in C major (C Am F G), a tune on chord notes on every beat it plays. In C
 * minor the same numbers play i VI iv v (Cm A♭ Fm Gm) under G E♭ G | C A♭ | A♭ F | G D.
 */
const LOOP = "<0 5 3 4>";
const LOOP_TUNE = "<[4 ~ 2 4] [7 ~ 5 ~] [5 ~ 3 ~] [4 ~ 1 ~]>";
const loop = (chordKey: string, bassKey: string, melKey: string) =>
  code(chords(LOOP, chordKey), bass(LOOP, bassKey), mel(LOOP_TUNE, melKey));
const PARALLEL_STARTER = loop("C3:major", "C2:major", "C4:major");
const PARALLEL_SOLUTION = loop("C3:minor", "C2:minor", "C4:minor");

/**
 * The Make, the relative twin: the four-chord loop I V vi IV (C G Am F) and a tune that ends on C. Moved to
 * A minor, the same numbers play Am Em F Dm under C E C | B E | A C F | D F A: every beat a chord note, and
 * the last note is A, home.
 */
const AXIS = "<0 4 5 3>";
const MAKE_TUNE = "<[2 ~ 4 2] [1 ~ 4 ~] [0 ~ 2 5] [3 ~ 5 7]>";
const relative = (chordKey: string, bassKey: string, melKey: string, tune = MAKE_TUNE) =>
  code(chords(AXIS, chordKey), bass(AXIS, bassKey), mel(tune, melKey));
const MAKE_STARTER = relative("C3:major", "C2:major", "C4:major");
const MAKE_A_MINOR = relative("A2:minor", "A1:minor", "A3:minor");

/** Drums from the Band; the chords, bass and tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const C_MINOR = { tonic: "C", mode: "minor" } as const;
const A_MINOR = { tonic: "A", mode: "minor" } as const;

/** The four minor keys offered for each circle fact. */
const keyOptions = (ids: string[]) =>
  ids.map((id) => ({ id, label: `${id[0]?.toUpperCase()}${id[1] === "b" ? "♭" : ""} minor` }));

export default defineLesson({
  id: "U10.L02",
  version: 3,
  title: "Relative & Parallel",
  objective:
    "I can find a major key's relative minor (the same notes, home on degree 6) and its parallel minor (the same home, 3, 6 and 7 lowered).",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S06"],
  practises: [],
  terms: [
    { id: "term.relative-minor", step: "S3" },
    { id: "term.parallel-minor", step: "S3" },
  ],
  canDo: ["cd.read.relative-keys"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One groove, three keys",
      minutes: 0.5,
      ui: { panels: ROLL_KEYS, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 6 },
      exercise: {
        kind: "listen",
        id: "one-groove-three-keys",
        version: 1,
        role: "practice",
        prompt:
          "Listen to six bars of one groove: two in C major, two in A minor, two in C minor. Listen for the low bass note that starts each pair of bars. Which minor keeps C major's home note, and which moves home to a new note?",
        skills: [{ skill: "S06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "C major, then A minor, then C minor, two bars each: the same numbers in every line.",
            bars: 6,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "How many black keys?",
      minutes: 0.5,
      ui: { panels: ROLL_KEYS, rollLabels: "degree" },
      exercise: {
        kind: "predict",
        id: "how-many-black-keys",
        version: 1,
        role: "practice",
        key: A_MINOR,
        prompt:
          'Predict how many black keys A minor plays from home to home: `n("0 .. 7").scale("A3:minor")`. Minor lowers degrees 3, 6 and 7 of A. Pick an answer, then hear it.',
        skills: [{ skill: "S06", w: 1 }],
        hints: null,
        tests: [],
        code: A_MINOR_RUN,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "none", label: "None: every note is a white key" },
          { id: "one", label: "One" },
          { id: "three", label: "Three, like C minor" },
        ],
        correct: ["none"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Same notes, same home",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "degree", initialPanels: ["key"] },
      example: { id: "three-scales", code: THREE_SCALES, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "same-notes-same-home",
        version: 1,
        role: "practice",
        prompt:
          "Run the code: C major, A minor, C minor, one bar each. For each bar, look at the keys it plays, the flats in the key-signature panel and its first note. Then answer both questions.",
        skills: [{ skill: "S06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch the keyboard and the key-signature panel bar by bar: one minor bar plays only white keys, the other adds flats.",
        },
        hints: ladder(
          "Find the minor bar that plays only white keys, like bar 1. Is it bar 2 or bar 3?",
          "The key-signature panel shows each bar's sharps and flats. Read it for bar 2, then for bar 3.",
          "Bar 2 starts on A and plays no black keys. In bar 3, which of C's degrees went down a half step?",
        ),
        code: { starter: THREE_SCALES },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which minor key uses exactly the notes of C major?",
            options: [
              { id: "a-minor", label: "A minor" },
              { id: "c-minor", label: "C minor" },
              { id: "both", label: "Both of them" },
            ],
            correct: ["a-minor"],
          },
          { q: "number", prompt: "How many flats does C minor have?", correct: 3 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["a-minor"], number: 3 } }, expect: "pass" },
          {
            name: "the twin with the same home",
            response: { answer: { choice: ["c-minor"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted only the flat 3",
            response: { answer: { choice: ["a-minor"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The twin at home",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "the-twin-at-home",
        version: 1,
        role: "check",
        key: C_MINOR,
        prompt:
          "Move the chords, bass and tune to C major's parallel minor, the twin that keeps C as home. Change only the `.scale()` of each line, and keep its octave number. Done when all three lines play in C minor.",
        skills: [{ skill: "S06", w: 1 }],
        code: { starter: PARALLEL_STARTER },
        reference: { solutions: [PARALLEL_SOLUTION], bars: 4 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["chords", "bass", "mel"],
        },
        target: { audible: true },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: {got} where the parallel minor has {exp}. Keep home on C: this twin shares its home and lowers 3, 6 and 7.",
          "melody.octave":
            "Bar {bar}: the right note in the wrong octave. Keep each line's octave number as it was; change only the word.",
        },
        hints: ladder(
          "The parallel twin keeps home where it is, on C. Look at the word after the colon in each `.scale()`.",
          "Each line has one `.scale()`. The parallel twin keeps its tonic and octave and changes only the word after the colon.",
          'The chords become `.scale("C3:minor")`. Do the same for the bass and the tune.',
        ),
        tests: [
          { name: "reference", response: { code: PARALLEL_SOLUTION }, expect: "pass" },
          {
            name: "the same key under its other name, aeolian",
            response: { code: loop("C3:aeolian", "C2:aeolian", "C4:aeolian") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: PARALLEL_STARTER },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the relative twin instead: home moved to A",
            response: { code: loop("A2:minor", "A1:minor", "A3:minor") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the bass left in major",
            response: { code: loop("C3:minor", "C2:major", "C4:minor") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the tune's octave changed with the key",
            response: { code: loop("C3:minor", "C2:minor", "C3:minor") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Find the relative",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "find-the-relative",
        version: 1,
        role: "check",
        prompt: "For each of the two major keys, pick the minor key that uses exactly the same notes.",
        skills: [
          { skill: "S06", w: 0.7 },
          { skill: "S04", w: 0.3 },
        ],
        hints: ladder(
          "The relative minor uses every note of the major key, with home on another degree. Find that degree first.",
          "Its home is degree 6 of the major key. Count up the major scale from its home to 6.",
          "In C major, degree 6 is A. In F major, count F G A B♭ C, then one more.",
        ),
        srs: [{ family: "fam.key.circle", mode: "review-if-due" }],
        tests: [],
        parts: [
          {
            kind: "fact",
            id: "relative-of-f",
            version: 1,
            role: "check",
            prompt: "F major has one flat, B♭. Pick the minor key that uses the same notes.",
            skills: [{ skill: "S06", w: 1 }],
            hints: ladder(
              "The relative minor's home is one degree of the major scale: the degree A has in C major. Find it.",
              "Count up F major to its degree 6.",
              "F G A B♭ C: that is degrees 1 to 5. Degree 6 comes next.",
            ),
            feedbackText: {
              "id.wrong":
                "Not that one. The relative minor's home is degree 6 of F major: count F G A B♭ C, then one more.",
            },
            answer: { ui: "choice", options: keyOptions(["d", "f", "a", "bb"]) },
            correct: { choice: ["d"] },
            spelling: "strict",
            order: "set",
            tests: [
              { name: "D minor", response: { answer: { choice: ["d"] } }, expect: "pass" },
              {
                name: "the parallel twin",
                response: { answer: { choice: ["f"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "fact",
            id: "relative-of-g",
            version: 1,
            role: "check",
            prompt: "G major has one sharp, F♯. Pick the minor key that uses the same notes.",
            skills: [{ skill: "S06", w: 1 }],
            hints: ladder(
              "The relative minor's home is one degree of the major scale: the degree A has in C major. Find it.",
              "Count up G major to its degree 6.",
              "G A B C D: that is degrees 1 to 5. Degree 6 comes next.",
            ),
            feedbackText: {
              "id.wrong":
                "Not that one. The relative minor's home is degree 6 of G major: count G A B C D, then one more.",
            },
            answer: { ui: "choice", options: keyOptions(["e", "g", "a", "b"]) },
            correct: { choice: ["e"] },
            spelling: "strict",
            order: "set",
            tests: [
              { name: "E minor", response: { answer: { choice: ["e"] } }, expect: "pass" },
              {
                name: "the parallel twin",
                response: { answer: { choice: ["g"] } },
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
      kind: "notate",
      title: "D minor's signature",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "staff-write",
        id: "d-minor-signature",
        version: 1,
        role: "check",
        key: { tonic: "D", mode: "minor" },
        prompt:
          "Write D minor's key signature at the start of the staff. A minor key uses the signature of the major key that shares its notes.",
        skills: [
          { skill: "N03", w: 0.5 },
          { skill: "S06", w: 0.5 },
        ],
        feedbackText: {
          "keysig.count":
            "You wrote {count}. A minor key borrows the signature of the major key it shares its notes with. Which major key has D as degree 6?",
          "keysig.type": "D minor shares its notes with a flat key: its signature has flats only.",
          "keysig.wrong":
            "Not yet: you wrote {got}. Find the major key whose degree 6 is D, and write that key's signature.",
        },
        hints: ladder(
          "D minor shares all its notes with one major key. Find that major key first.",
          "A minor key writes the signature of its relative major. D is degree 6 of one key from the last step.",
          "D is degree 6 of F major. How many flats does F major have?",
        ),
        answer: {
          ui: "staff-input",
          mode: "key-signature",
          clef: "treble",
          bars: 1,
          palette: { durations: [], accidentals: true, ties: false, rests: false },
        },
        expect: { e: "key-signature", key: { tonic: "D", mode: "minor" }, order: "sequence" },
        srs: [
          {
            deck: "deck.key.signature",
            cards: ["fact.keysig.D-minor", "fact.keysig.E-minor"],
            mode: "seed",
          },
        ],
        tests: [
          { name: "B flat", response: { answer: { text: ["Bb"] } }, expect: "pass" },
          {
            name: "C minor's first two flats",
            response: { answer: { text: ["Bb", "Eb"] } },
            expect: "fail",
            feedback: ["keysig.count"],
          },
          {
            name: "E minor's sharp",
            response: { answer: { text: ["F#"] } },
            expect: "fail",
            feedback: ["keysig.type"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Home on A",
      minutes: 2.75,
      ui: { panels: ROLL_KEYS, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "home-on-a",
        version: 1,
        role: "practice",
        key: A_MINOR,
        prompt:
          "Move the chords, bass and tune to A minor, C major's relative minor: give each `.scale()` the new home and the word `minor`. Done when the tune ends on A. If you like, let the loop travel: four bars in C major, then four in A minor.",
        skills: [{ skill: "S06", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "home-on-a",
            label: "The tune's last note is A, home (1) in A minor",
            required: true,
            skills: ["S06"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "sings-me",
            label: "The tune plays ♭3 of A minor, the note C",
            required: false,
            skills: ["S05"],
            rule: "degree-set",
            track: "@melody",
            contains: ["b3"],
          },
          {
            id: "on-the-chords",
            label: "Most of the tune's notes on beats 1 and 3 are notes of the chord under them",
            required: false,
            skills: ["M01"],
            rule: "chord-tones-strong",
            minRatio: 0.6,
            melody: "@melody",
            harmony: "chords",
            strength: "strong",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The relative twin keeps C major's notes and moves home. Find which degree of C major its home is.",
          "Home moves to degree 6, A. Each `.scale()` takes the new tonic and the word `minor`; the numbers in `n()` stay.",
          'The chords become `.scale("A2:minor")`, one octave number below their old `C3`. Move the bass and the tune the same way.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: three scale calls moved to A minor",
            response: { code: MAKE_A_MINOR },
            expect: "pass",
          },
          {
            name: "beyond the brief: four bars in C major, four in A minor, a held last note",
            response: {
              code: relative(
                "<C3:major!4 A2:minor!4>",
                "<C2:major!4 A1:minor!4>",
                "<C4:major!4 A3:minor!4>",
                "<[2 ~ 4 2] [1 ~ 4 ~] [0 ~ 2 5] [3 ~ 5 7] [2 ~ 4 2] [1 ~ 4 ~] [0 ~ 2 5] [3 5 7@2]>",
              ),
            },
            expect: "pass",
          },
          {
            name: "moved to the other twin, C minor",
            response: { code: relative("C3:minor", "C2:minor", "C4:minor") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
