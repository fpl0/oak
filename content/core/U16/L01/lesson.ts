// U16.L01 The Sad IV. A major key may borrow a chord from the minor key on the same home note. The first one
// is the IV chord with its 3rd lowered a half step: in C, F A C becomes F A♭ C, F minor, written iv. One note
// moves, la down to le (6 to ♭6), and it wants to fall one more half step to sol: IV, iv, I is the turn that
// closes a thousand ballads. What the learner has: chords by name over one `const` (U05.L08, U08.L04), Roman
// numerals in major and in minor, where iv is the key's own chord (U06.L02, U10.L04), the parallel minor
// (U10.L02), the plagal cadence IV–I (U06.L07), chromatic degrees in code and on syllables, `n("5b")` = ♭6 =
// le (U15.L01), and chords from outside the key that point at a chord (U15.L02–L06). Not yet: ♭VI and ♭VII
// (U16.L02), ♭III and the name "modal mixture" (U16.L03), borrowing in a minor key (U16.L04), finding
// borrowed chords by ear (U16.L05). Spec: content/specs/U16.md.
//
// How it is graded (AUTHORING §17, §19.6): a chord written by name is its pitch classes and its lowest note at
// each onset (`pcset` with `bass: true`), so `Co` for `Cm` fails on one note and `[Cm]` passes; numerals are
// an `rn-palette` with `allow: ["triads", "borrowed"]`, read by degree and quality, so `IV` for `iv` is a
// quality miss (`harmony.rn-case`) and never a string mismatch. The sung line is never graded into the lesson
// and has a Quiet path (`fallback: "identify"`). The Make's one required rule is `contains-rn` with `iv`: a
// loop of the key's own chords fails, a loop with the minor home chord fails, and any loop that holds the
// minor chord on degree 4 passes, wherever it sits.
import { defineLesson, type HintLadder, type KeySpec } from "@oak/content-kit";

const BPM = 80;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const C: KeySpec = { tonic: "C", mode: "major" };
const G: KeySpec = { tonic: "G", mode: "major" };
const D: KeySpec = { tonic: "D", mode: "major" };

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
/** A piano ballad: the chord on every beat. */
const CHORDS = 'chords: chord(changes).voicing().struct("x x x x").s("piano")';
const BASS = 'bass: chord(changes).rootNotes(2).s("ebass")';
const mel = (pattern: string, scale = "C4:major") => `mel: n("${pattern}").scale("${scale}").s("cleangtr")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);
/** One chord a bar, held: the graded steps read (and report) each chord once. */
const HELD = 'chords: chord(changes).voicing().s("piano")';
const held = (form: string, ...lines: string[]) => code(changes(form), HELD, BASS, ...lines);

/**
 * The hook's tune: a rise through the home chord (E G C G), then one long note a bar that falls by half
 * steps: A over F, A♭ over F minor, G over C. `5b` is step 5 lowered: degree ♭6 (U15.L01).
 */
const HOOK_TUNE = mel("<[2 4 7 4] [5@3 3] [5b@3 3] [4@3 ~]>");
/** The same tune with nothing borrowed: A for two bars, then G. */
const PLAIN_TUNE = mel("<[2 4 7 4] [5@3 3] [5@3 3] [4@3 ~]>");
const HOOK = loop("<C F Fm C>", HOOK_TUNE);
const HOOK_PLAIN = loop("<C F F C>", PLAIN_TUNE);

/** S2: F, then F minor. */
const F_THEN_FM = code('chords: chord("<F Fm>").voicing().s("piano")');
/** S3: the two chords stacked by hand from the root, so the roll shows which note moves. */
const TWO_FOURS = code('chords: note("<[f3,a3,c4] [f3,ab3,c4]>").s("piano")');

/** S4: the same turn in G major, where IV is C and the borrowed iv is C minor. */
const MODIFY_STARTER = held("<G C ⟪C⟫ G>");
const MODIFY_SOLUTION = held("<G C Cm G>");

/** S5: the turn in D major, read as numerals. */
const NUMBER_IT = held("<D G Gm D>");

/** S6: the three long notes on their own, over the three chords, then a bar of home to breathe. */
const SING = held("<F Fm C C>", mel("<5 5b 4 ~>"));

/**
 * The Make: C, Am, then F for two bars, with a tune whose last bar keeps to F and C, the two notes F and
 * F minor share: the learner can turn that bar without touching the tune, and then add le (`5b`) by choice.
 */
const MAKE_TUNE = mel("<[4 ~ 2 4] [2 ~ 0 2] [5 ~ 3 5] [3 ~ 0 ~]>");
const MAKE_STARTER = loop("<C Am F F>", MAKE_TUNE);
const MAKE_MINIMAL = loop("<C Am F Fm>", MAKE_TUNE);
const MAKE_WITH_LE = loop("<C Am F Fm>", mel("<[4 ~ 2 4] [2 ~ 0 2] [5 ~ 3 5] [5b@3 3]>"));

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U16.L01",
  version: 4,
  title: "The Sad IV",
  objective: "I can turn IV into the minor iv in a major key, name it, and hear the note that falls.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  introduces: ["H13"],
  practises: [],
  terms: [{ id: "term.borrowed-chord", step: "S3" }],
  canDo: ["cd.compose.borrowed-iv"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One chord turns",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-chord-turns",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the last line of a piano ballad twice: C, F, F, C. The second time, one note of bar 3 changes. Listen for that bar: does it sound brighter or darker than the first time?",
        skills: [{ skill: "H13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK_PLAIN,
            caption: "C, F for two bars, and home: all inside the key.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "Bar 3 changes. Follow the tune's long notes from bar 2 to bar 4.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "F becomes F minor",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "f-becomes-f-minor",
        version: 1,
        role: "practice",
        prompt:
          '`chord("<F Fm>")` plays F for a bar, then F minor. F is F, A and C. Predict which one of those three notes moves in bar 2, and in which direction. Pick your answer, then run it.',
        skills: [{ skill: "H13", w: 1 }],
        hints: null,
        tests: [],
        code: F_THEN_FM,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "a-down", label: "A moves down a half step, to A♭" },
          { id: "f-down", label: "F moves down a half step, to E" },
          { id: "c-up", label: "C moves up a half step, to D♭" },
        ],
        correct: ["a-down"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Whose chord is it",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      example: { id: "two-fours", code: TWO_FOURS, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "whose-chord-is-it",
        version: 1,
        role: "practice",
        prompt:
          "Bar 1 plays F, bar 2 plays F minor, each stacked from its root. Compare the two bars on the roll, note by note. Then answer both questions: which key builds F minor on degree 4, and how many of its notes changed.",
        skills: [{ skill: "H13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the notes that sit at a different height in bar 2. For the key: which scale on C has an A♭ in it?",
        },
        hints: ladder(
          "Look at the three notes of bar 1 and the three of bar 2 on the roll. Which ones sit at the same height in both bars?",
          "F and C stay where they are. C major has no A♭; the minor key that starts on the same note does.",
          "C minor runs C D E♭ F G A♭ B♭. Stack a triad on its degree 4.",
        ),
        code: { starter: TWO_FOURS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "F minor is not one of C major's chords. Which key builds it on degree 4?",
            options: [
              { id: "c-minor", label: "C minor, the minor key on the same home note" },
              { id: "a-minor", label: "A minor, the relative minor" },
              { id: "f-major", label: "F major" },
            ],
            correct: ["c-minor"],
          },
          { q: "number", prompt: "How many of the chord's three notes changed?", correct: 1 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["c-minor"], number: 1 } }, expect: "pass" },
          {
            name: "A minor: its chord on degree 4 is D minor",
            response: { answer: { choice: ["a-minor"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two notes counted",
            response: { answer: { choice: ["c-minor"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Turn the second one",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "turn-the-second-one",
        version: 1,
        role: "check",
        key: G,
        prompt:
          "The same ballad in G major: G, C, C, G. Change the C in bar 3 into the sad IV: the same chord with its 3rd lowered a half step. Edit only that chord in `changes`; the bass follows it. Done when bar 3 plays C, E♭ and G.",
        skills: [{ skill: "H13", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so a C minor cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // Where and what, not the answer (contracts §5.3): the ladder names the 3rd (rung 2) and the symbol (rung 3).
        // The sentence holds for every miss: Co lowers the 5th as well, C7 adds a note, C keeps the 3rd.
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}, which is not the target's chord. Only the second C changes, into the sad IV: the same root and 5th, and one note lowered, its 3rd.",
        },
        hints: ladder(
          "Bar 3 is the only chord to change. In C major, F became F minor. Which chord is the same move on C?",
          "A major chord with its 3rd lowered a half step is the minor chord on the same root. In code that is one letter after the root.",
          "C major is `C`. C minor is written with an m after the letter.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "the bar in brackets", response: { code: held("<G C [Cm] G>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: held("<G C C G>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "C diminished: the 3rd lowered, and the 5th as well",
            response: { code: held("<G C Co G>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            // `Cmin` is how some charts print it, not how Strudel reads it: the lint names the spelling.
            name: "Cmin written out",
            response: { code: held("<G C Cmin G>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
          {
            name: "the home chord turned minor as well",
            response: { code: held("<G C Cm Gm>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "C minor cut to a click: the right chord, 1% of the bar",
            response: { code: held("<G C [Cm@0.01 ~@0.99] G>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "C7: a 7th added, the 3rd left major",
            response: { code: held("<G C C7 G>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Number the turn",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "number-the-turn",
        version: 1,
        role: "check",
        key: D,
        prompt:
          "The turn once more, in D major. Write the Roman numeral of each bar: upper case for a major chord, lower case for a minor one.",
        skills: [
          { skill: "H13", w: 0.6 },
          { skill: "N06", w: 0.4 },
        ],
        hints: ladder(
          "Which degree of D major is G? Both middle chords are built on it.",
          "G is degree 4. A major chord there is IV. The same root with a minor chord on it takes the same numeral in lower case.",
          "Bars 1 and 4 are I, bar 2 is IV. Bar 3 has the same root as bar 2 and a minor chord on it.",
        ),
        stimulus: { src: "code", code: NUMBER_IT, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads", "borrowed"] },
        correct: { rn: ["I", "IV", "iv", "I"] },
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        tests: [
          { name: "I IV iv I", response: { answer: { rn: ["I", "IV", "iv", "I"] } }, expect: "pass" },
          {
            name: "the minor chord in capitals",
            response: { answer: { rn: ["I", "IV", "IV", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
          {
            name: "G minor taken for the key's own minor chord on 2",
            response: { answer: { rn: ["I", "IV", "ii", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "La le sol",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "la-le-sol",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the three long notes over F, F minor and C, then sing them, one a bar: la, le, sol. Le is the lowered 6, a half step under la and a half step over sol. Sing in your own range.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "E12a", w: 0.4 },
        ],
        hints: [
          { text: "Hum sol first, the note the line ends on, and keep it in your ear." },
          { text: "Each note is one half step below the last: the smallest move there is, twice." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["6", "b6", "5"] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your sad turn",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-sad-turn",
        version: 1,
        role: "practice",
        prompt:
          "The loop plays both verses of your song: C, A minor, F, F. Put the sad IV, F minor, in at least one bar of `changes`: in place of an F, or in a bar you add. Done when the loop holds F minor. Then, if you like, let the tune touch A♭ (`5b`) over it.",
        skills: [{ skill: "H13", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-sad-four",
            label: "At least one bar plays F minor, the sad iv",
            required: true,
            skills: ["H13"],
            rule: "contains-rn",
            rn: ["iv"],
            min: 1,
          },
          {
            id: "tune-sings-le",
            label: "The mel line plays ♭6 (A♭) at least once",
            required: false,
            skills: ["P06"],
            rule: "degree-set",
            track: "mel",
            contains: ["b6"],
          },
          {
            id: "bass-on-roots",
            label: "On most chord changes, the bass plays the new chord's root",
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
          "The sad IV is the IV chord with one note lowered. Which chord of this loop is IV in C major?",
          "All four chords live in `changes`. F is IV in C major; F minor is written with an m after the letter.",
          "In G major you wrote `Cm` after `C`. Here IV is F: put its minor chord in the last bar, just before the loop comes home.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the last F turned minor", response: { code: MAKE_MINIMAL }, expect: "pass" },
          { name: "the tune sings le over the F minor", response: { code: MAKE_WITH_LE }, expect: "pass" },
          {
            name: "beyond the brief: eight bars on the Rhodes with two visiting chords and the sad IV before home",
            response: {
              code: code(
                changes("<C E7 Am C7 F Fm C G7>"),
                'chords: chord(changes).voicing().struct("x ~ x x ~ x x ~").s("rhodes")',
                'bass: chord(changes).rootNotes(2).s("upright")',
                mel("<[4 ~ 2 4] [4# ~ 2 ~] [2 ~ 0 2] [6b ~ 4 ~] [5 ~ 3 5] [5b@3 3] [4 ~ 2 0] [1 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "a minor chord from inside the key instead: D minor",
            response: { code: loop("<C Am F Dm>", MAKE_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the home chord made minor, not the IV",
            response: { code: loop("<C Am F Cm>", MAKE_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
