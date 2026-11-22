// U16.L04 Picardy & Dorian IV. The trade of U16.L01–L03 run the other way: a minor key borrows from the major
// key on the same home note, and again each chord is one changed note, this time raised. End on the major home
// chord instead of the minor one (in A minor: A C E becomes A C♯ E) and the piece ends in sunlight: the Picardy
// third. Make iv major (D F A becomes D F♯ A) and the verse takes the bright IV of Dorian on its way. What the
// learner has: minor keys and their numerals, with V major from harmonic minor (U10.L01–L06), Dorian and its
// i–IV (U14.L03), borrowed chords and the one-changed-note device (U16.L01–L03), chromatic step strings in code
// and on syllables (U15.L01: in a minor scale they alter the minor scale's own steps, so `2#` is C♯ in A minor).
// Not yet: new chords under an unchanged tune and borrowed chords found by ear (U16.L05), a new home note for
// good (U17). Spec: content/specs/U16.md.
//
// How it is graded (AUTHORING §17, §19.6): a chord written by name is its pitch classes and its lowest note at
// each onset (`pcset` with `bass: true`); numerals are an `rn-palette` in the minor key with `borrowed` allowed,
// read by degree and quality, so `iv` for the bright `IV` and `i` for the last `I` are quality misses
// (`harmony.rn-case`), never string mismatches. The sung lines are never graded into the lesson and have a
// Quiet path (`fallback: "identify"`). The Make's one required rule is `last-chord` with `I`: the last chord
// that sounds, read in A minor, is A major. The starter ends on A minor and fails, an ending on C major (III)
// fails, `[A Am]` and `[A E]` in bar 8 fail (A major is in the bar, but it is not the end), and an ending on
// A major passes whatever the other seven bars hold.
import { defineLesson, type HintLadder, type KeySpec, type SingEx } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const A_MINOR: KeySpec = { tonic: "A", mode: "minor" };
const A_MAJOR: KeySpec = { tonic: "A", mode: "major" };
const E_MINOR: KeySpec = { tonic: "E", mode: "minor" };
const D_MINOR: KeySpec = { tonic: "D", mode: "minor" };

/** One string drives the chords, the bass and the pad (U08.L04): change the chords once and all three follow. */
const changes = (form: string) => `const changes = "${form}"\n`;
/** A minor ballad: piano on every beat, upright on the root, a quiet strings pad. */
const CHORDS = 'chords: chord(changes).voicing().struct("x x x x").s("piano")';
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const PAD = 'pad: chord(changes).voicing().s("strings").gain(.4)';
/** The tune on acoustic guitar. `n` counts from 0, so degree 5 is `n` 4; `2#` is the raised 3rd, C♯ in A minor. */
const mel = (pattern: string, scale = "A3:minor") => `mel: n("${pattern}").scale("${scale}").s("acgtr")`;
const ballad = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, PAD, ...lines);
/** One chord a bar, held: the graded steps read (and report) each chord once. */
const HELD = 'chords: chord(changes).voicing().s("piano")';
const held = (form: string, ...lines: string[]) => code(changes(form), HELD, BASS, ...lines);

/**
 * The hook: A minor, D major, F, E, twice, ending on A major. The tune is E C A | F♯ D | F D C | B | E C A |
 * F♯ D | C B B E | C♯: `5#` is F♯ over D (the raised 6), `2#` is C♯ over the last A (the raised 3rd).
 */
const HOOK = ballad(
  "<Am D F E Am D [F E] A>",
  mel("<[4 ~ 2 0] [5# ~ 3 ~] [5 ~ 3 2] [1 ~ ~ ~] [4 ~ 2 0] [5# ~ 3 ~] [2 1 1 4] [2#@3 ~]>"),
);
/** The same eight bars with nothing borrowed: D minor in bars 2 and 6 (the tune on F), A minor at the end (on C). */
const HOOK_PLAIN = ballad(
  "<Am Dm F E Am Dm [F E] Am>",
  mel("<[4 ~ 2 0] [5 ~ 3 ~] [5 ~ 3 2] [1 ~ ~ ~] [4 ~ 2 0] [5 ~ 3 ~] [2 1 1 4] [2@3 ~]>"),
);

/** S2: A minor, then A major. */
const AM_THEN_A = code('chords: chord("<Am A>").voicing().s("piano")');
/** S3: the two pairs stacked by hand from the root, so the roll shows which note moves in each. */
const TWO_PAIRS = code('chords: note("<[a3,c4,e4] [a3,c#4,e4] [d3,f3,a3] [d3,f#3,a3]>").s("piano")');

/** S4: a four-bar phrase in E minor; the IV and the last chord are editable. */
const MODIFY_STARTER = held("<Em ⟪Am⟫ B ⟪Em⟫>");
const MODIFY_SOLUTION = held("<Em A B E>");

/** S5: a phrase in D minor, read as numerals. */
const NUMBER_IT = held("<Dm G A D>");

/** S6: the home chord sung down twice, once over A minor and once over A major; one note a bar, then a rest. */
const SING_MINOR = code(
  'chords: chord("Am").voicing().s("piano")',
  'bass: chord("Am").rootNotes(2).s("upright")',
  mel("<4 2 0 ~>"),
);
const SING_MAJOR = code(
  'chords: chord("A").voicing().s("piano")',
  'bass: chord("A").rootNotes(2).s("upright")',
  mel("<4 2 0 ~>", "A3:major"),
);

/**
 * The Make: eight bars in A minor. Its tune ends on A, the note A minor and A major share, and over D minor it
 * holds D and A, the notes D minor and D major share: either chord can change without a clash, and C♯ (`2#`)
 * in the last bar is the learner's choice.
 */
const MAKE_FORM = "<Am Dm F E Am Dm E Am>";
const makeTune = (bar8: string) =>
  mel(`<[4 ~ 2 0] [3 ~ 0 ~] [5 ~ 2 ~] [1 ~ ~ ~] [4 ~ 2 0] [3 ~ 4 3] [1 ~ 6# ~] ${bar8}>`);
const MAKE_STARTER = ballad(MAKE_FORM, makeTune("[0@3 ~]"));
const MAKE_MINIMAL = ballad("<Am Dm F E Am Dm E A>", makeTune("[0@3 ~]"));
const MAKE_SUNLIT = ballad("<Am D F E Am Dm E A>", makeTune("[2#@3 ~]"));

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.aeolian-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

const TOL = {
  cents: "learner",
  octave: "global",
  driftCompCents: 30,
  minCoverage: 0.4,
  passHitRate: 0.8,
} as const;
const singPart = (
  id: string,
  prompt: string,
  stimulus: string,
  third: "b3" | "3",
  hints: HintLadder,
): SingEx => ({
  kind: "sing",
  id,
  version: 1,
  role: "practice",
  prompt,
  skills: [
    { skill: "V03", w: 0.6 },
    { skill: "H13", w: 0.4 },
  ],
  hints,
  // A sung target in a minor key holds ♭3, never 3 (`minor.sung-degree`): the raised 3rd is sung in A major,
  // the key the last chord is borrowed from.
  ...(third === "3" ? { key: A_MAJOR } : {}),
  // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
  fallback: "identify",
  mode: "degree",
  stimulus: { src: "code", code: stimulus, bars: 4, showCode: false },
  cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
  // One note a bar (the rhythm is one bar long and repeats): sol, the 3rd, do, falling inside one octave.
  target: { from: "degrees", degrees: ["5", third, "1"], rhythm: "x", octaves: [0, 0, 0] },
  labels: "syllables",
  tol: TOL,
  showTrace: "live",
  tests: [],
});

export default defineLesson({
  id: "U16.L04",
  version: 4,
  title: "Picardy & Dorian IV",
  objective:
    "I can end a minor piece on the major home chord and brighten its iv into IV, one raised note each.",
  key: A_MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H13"],
  terms: [{ id: "term.picardy-third", step: "S3" }],
  canDo: ["cd.compose.picardy"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The last chord opens",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "the-last-chord-opens",
        version: 1,
        role: "practice",
        prompt:
          "Eight bars of a minor ballad, twice. The second time, the chords of bars 2, 6 and 8 change. Listen to the last chord each time: does the verse end in the dark, or somewhere brighter?",
        skills: [{ skill: "H13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK_PLAIN,
            caption: "Am, Dm, F, E, twice, ending on A minor: the key's own chords.",
            bars: 8,
          },
          {
            code: HOOK,
            caption: "Bars 2, 6 and 8 change. Listen to the tune's last note.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "A minor becomes A",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "a-minor-becomes-a",
        version: 1,
        role: "practice",
        prompt:
          '`chord("<Am A>")` plays A minor for a bar, then A major. A minor is A, C and E. Predict which one of those three notes moves in bar 2, and in which direction. Pick your answer, then run it.',
        skills: [{ skill: "H13", w: 1 }],
        hints: null,
        tests: [],
        code: AM_THEN_A,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "c-up", label: "C moves up a half step, to C♯" },
          { id: "e-up", label: "E moves up a half step, to F" },
          { id: "a-down", label: "A moves down a half step, to G♯" },
        ],
        correct: ["c-up"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "One note up, twice",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      example: { id: "two-pairs", code: TWO_PAIRS, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "one-note-up-twice",
        version: 1,
        role: "practice",
        prompt:
          "Four bars, each chord stacked from its root: A minor, A major, D minor, D major. Compare each pair on the roll, note by note. Then answer both questions: which scale on A has F♯ and C, and how many notes changed in each pair.",
        skills: [{ skill: "H13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. In each pair, count the notes that sit at a different height in the second bar. For the scale: which minor you have played keeps C and raises F to F♯?",
        },
        hints: ladder(
          "Look at bars 1 and 2, then bars 3 and 4. Which notes of the first chord in each pair sit at the same height in the second?",
          "A and E stay in the first pair, D and A in the second. A natural minor has F; the scale you need raises it.",
          "D major is the IV of a minor scale with a raised 6. You wrote i–IV grooves on that scale in Dorian ♮6.",
        ),
        code: { starter: TWO_PAIRS },
        mustPlayLoops: 1,
        srs: [{ family: "fam.key.mode", mode: "review-if-due" }],
        questions: [
          {
            q: "choice",
            prompt:
              "D major has F♯ where A minor has F. Which scale on A that you have played has F♯ and still keeps C?",
            options: [
              { id: "dorian", label: "A Dorian" },
              { id: "natural", label: "A natural minor" },
              { id: "harmonic", label: "A harmonic minor" },
            ],
            correct: ["dorian"],
          },
          { q: "number", prompt: "In each pair, how many of the chord's three notes changed?", correct: 1 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["dorian"], number: 1 } }, expect: "pass" },
          {
            name: "natural minor: it has F, not F♯",
            response: { answer: { choice: ["natural"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "harmonic minor: it raises G, not F",
            response: { answer: { choice: ["harmonic"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two notes counted",
            response: { answer: { choice: ["dorian"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Brighten two chords",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "brighten-two-chords",
        version: 1,
        role: "check",
        key: E_MINOR,
        prompt:
          "A four-bar phrase in E minor: Em, Am, B, Em. Change two chords in `changes`: in bar 2 and in bar 4, raise the chord's 3rd a half step, so each minor chord becomes major on the same root. Keep bars 1 and 3 as they are.",
        skills: [{ skill: "H13", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so a chord cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. In bars 2 and 4 one note of the minor chord rises a half step: its 3rd.",
        },
        hints: ladder(
          "Only bars 2 and 4 change. In A minor, Dm became D and Am became A. What are the same two moves on this phrase's chords?",
          "A minor chord with its 3rd raised a half step is the major chord on the same root. In code that is the letter without its m.",
          "Bar 2 is Am: its 3rd, C, rises to C♯, and that chord is written `A`. Bar 4 makes the same move on its own root.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "the last bar in brackets", response: { code: held("<Em A B [E]>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: held("<Em Am B Em>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "only the IV raised: the ending is still E minor",
            response: { code: held("<Em A B Em>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "A7: a 7th added to the IV",
            response: { code: held("<Em A7 B E>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            // `Amaj` is how some charts print it, not how Strudel reads it: the lint names the spelling.
            name: "Amaj written out",
            response: { code: held("<Em Amaj B E>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
          {
            name: "the first chord raised as well",
            response: { code: held("<E A B E>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "E major cut to a click: the right chord, 1% of the bar",
            response: { code: held("<Em A B [E@0.01 ~@0.99]>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Number it in minor",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "number-it-in-minor",
        version: 1,
        role: "check",
        key: D_MINOR,
        prompt:
          "A phrase in D minor: Dm, G, A, D. Write the numeral of each of the 4 bars, counted on the D minor scale: upper case for a major chord, lower case for a minor one.",
        skills: [
          { skill: "H13", w: 0.6 },
          { skill: "N06", w: 0.4 },
        ],
        hints: ladder(
          "Bars 1 and 4 share a root. Which degree of D minor is it, and which of the two chords is major?",
          "D minor's own chord on degree 4 is G minor, iv. A major chord there keeps the number and changes the case.",
          "Bar 1 is i and bar 3 is V. Bar 4 is the same root as bar 1 with a major chord on it.",
        ),
        stimulus: { src: "code", code: NUMBER_IT, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads", "borrowed"] },
        correct: { rn: ["i", "IV", "V", "I"] },
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        tests: [
          { name: "i IV V I", response: { answer: { rn: ["i", "IV", "V", "I"] } }, expect: "pass" },
          {
            name: "the bright IV in lower case",
            response: { answer: { rn: ["i", "iv", "V", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
          {
            name: "the last chord taken for the minor home chord",
            response: { answer: { rn: ["i", "IV", "V", "i"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
          {
            name: "counted from F, the relative major",
            response: { answer: { rn: ["vi", "II", "III", "VI"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Me, then mi",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "me-then-mi",
        version: 1,
        role: "practice",
        prompt:
          "Sing down the home chord twice, one note a bar, on the same home note. First over A minor: sol, me, do. Then over A major: sol, mi, do. Only the middle note changes, by a half step. Sing in your own range.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "H13", w: 0.4 },
        ],
        hints: [
          { text: "Hum do first, the note both lines end on, and keep it in your ear." },
          { text: "Me and mi are neighbours: mi sits one half step above me." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        fallback: "identify",
        tests: [],
        parts: [
          singPart(
            "sol-me-do",
            "Listen, then sing over A minor, one note a bar: sol, me, do. In numbers: 5, ♭3, 1.",
            SING_MINOR,
            "b3",
            [
              { text: "Start on sol, the top note of the chord, and step down through the chord to do." },
              { text: "Me is the minor chord's middle note: a minor 3rd above do." },
              { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
              "auto",
            ],
          ),
          singPart(
            "sol-mi-do",
            "Listen, then sing over A major, the chord the ending borrows, one note a bar: sol, mi, do. In numbers: 5, 3, 1.",
            SING_MAJOR,
            "3",
            [
              { text: "The same three steps down, with the middle note a little higher than before." },
              { text: "Mi is a major 3rd above do, one half step above where me was." },
              { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
              "auto",
            ],
          ),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "End in sunlight",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "end-in-sunlight",
        version: 1,
        role: "practice",
        prompt:
          "Eight bars in A minor with a bass, a strings pad and a tune. In `changes`, make the last chord that sounds A major. Done when the verse ends on A major. Then, if you like, let the tune end on C♯ (`2#`), put the bright IV, D major, in an earlier bar, or rewrite the tune.",
        skills: [{ skill: "H13", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          {
            // The last chord that sounds, not a chord somewhere in bar 8: `[A Am]` ends on A minor.
            id: "major-home-at-the-end",
            label: "The last chord that sounds is A major, the major home chord",
            required: true,
            skills: ["H13"],
            rule: "custom",
            fn: "last-chord",
            params: { rn: ["I"] },
          },
          {
            id: "the-bright-four",
            label: "At least one bar plays D major, the bright IV",
            required: false,
            skills: ["H13"],
            rule: "contains-rn",
            rn: ["IV"],
            min: 1,
          },
          {
            id: "tune-ends-in-the-chord",
            label: "The mel line ends on A, C♯ or E over the last A major",
            required: false,
            skills: ["P06"],
            rule: "ends-on-degree",
            track: "mel",
            degrees: ["1", "3", "5"],
            over: "I",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The piece must end on A major. Which chord does the last bar of `changes` hold now?",
          "All eight chords live in `changes`. Bar 8 is A minor; the major chord on the same root has its 3rd, C, raised to C♯.",
          "In E minor you turned the last `Em` into its major chord. Do the same to the last chord of this string.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the last Am made major", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "the bright IV in bar 2 and the tune on C♯",
            response: { code: MAKE_SUNLIT },
            expect: "pass",
          },
          {
            name: "beyond the brief: the bright IV twice, a new tune and a Rhodes",
            response: {
              code: code(
                changes("<Am D F E Am D [F G] [E A]>"),
                'chords: chord(changes).voicing().struct("x ~ x x").s("rhodes")',
                BASS,
                PAD,
                mel("<[0 2 4 7] [5# ~ 3 ~] [5 4 2 ~] [1@3 ~] [0 2 4 7] [5# 4 3 ~] [2 ~ 1 ~] [1 ~ 2#@2]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "an ending on C major, the key's own III",
            response: { code: ballad("<Am Dm F E Am Dm E C>", makeTune("[2@3 ~]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "A major, then A minor, in the last bar: the piece ends minor",
            response: { code: ballad("<Am Dm F E Am Dm E [A Am]>", makeTune("[0@3 ~]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "A major, then E, in the last bar: the piece ends on V",
            response: { code: ballad("<Am Dm F E Am Dm E [A E]>", makeTune("[0@3 ~]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "E, then A major, in the last bar: the Picardy chord comes last",
            response: { code: ballad("<Am Dm F E Am Dm Dm [E A]>", makeTune("[0@3 ~]")) },
            expect: "pass",
          },
          {
            name: "A major in bar 1, the ending still minor",
            response: { code: ballad("<A Dm F E Am Dm E Am>", makeTune("[0@3 ~]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
