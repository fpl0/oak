// U07.L03 Landing on Chord Tones. A tune sounds right over its chords when the notes on the strong beats, 1
// and 3, belong to the chord sounding: chord tones. Between them it can pass through other notes. What the
// learner has: triads stacked in `n` and the four-chord loop I V vi IV (U05–U06), contour (U07.L01), a motif
// moved onto each chord (U07.L02). Not yet: names for the notes between (passing and neighbour tones,
// U07.L04). Spec: content/specs/U07.md.
//
// The chords are a `chords:` line in the code (I V vi IV, a bar each), and the Band plays its drums and bass
// under them. The grader reads chords from the learner's code only (it is not given the Band's code, see
// U06.L05 and U07.L04), so every rule here names the code's own `chords` line; it sounds the same in every
// flavour.
//
// The hook, checked by evaluating it: G F E F | G _ D E | E D C D | C over C | G | Am | F. On beats 1 and 3:
// G E over C, G D over G, E C over Am, C over F, every one a chord tone; the F, D and E between are not.
//
// Deviations from the spec: S4 uses four `identify` items in an `all` (the spec's fallback) because the
// `slot-choice` widget is still planned; S6 accepts the tune in C only (`exact`, `absolute`), as U07.L08
// does, because the chords that come with the tune are in C and `any-key` needs a transposition-invariant
// matcher (content-kit `by-ear.accepts-matcher`).
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A tune in degrees of C. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
/** Triads stacked in degrees, an octave under the tune. */
const chords = (pattern: string) => `chords: n("${pattern}").scale("C3:major").s("piano").gain(.6)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** I V vi IV, a bar each: C, G, Am, F. */
const LOOP = chords("<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>");
const with_ = (tune: string) => code(LOOP, mel(tune));

const HOOK_TUNE = "<[4 3 2 3] [4 ~ 1 2] [2 1 0 1] [0 ~ ~ ~]>";
const HOOK = with_(HOOK_TUNE);
/** The same rhythm one degree higher: A F | A E | F D | D on beats 1 and 3, none of them in its chord. */
const STEP_UP_TUNE = "<[5 4 3 4] [5 ~ 2 3] [3 2 1 2] [1 ~ ~ ~]>";
const STEP_UP = with_(STEP_UP_TUNE);

/**
 * S4: a new tune over the same chords. Marked notes: bar 1 beat 1 E over C (yes), bar 2 beat 3 A over G (no),
 * bar 3 beat 1 G over Am (no), bar 4 beat 3 A over F (yes).
 */
const QUIZ = with_("<[2 ~ 1 0] [4 ~ 5 4] [4 ~ 2 0] [3 ~ 5 ~]>");
const YES_NO = [
  { id: "yes", label: "A chord tone" },
  { id: "no", label: "Not a chord tone" },
];
const QUIZ_WRONG = {
  "id.wrong":
    "Not that one. Spell the chord from its root, skipping a letter each time, and look for the note.",
} as const;
const quizHints = (chord: string): HintLadder =>
  ladder(
    `Which three notes make ${chord}?`,
    "Stack the chord from its root: root, skip a letter, 3rd, skip a letter, 5th.",
    `Write out ${chord}'s three letters, then check whether the marked note is one of them.`,
  );

/**
 * S5: bars 2 and 4 start on a note outside their chord (A over G, E over F). Fixed: B over G, F over F.
 * Reference: C5 G A | B G | A G E | F C.
 */
const LANDING = (bar2: string, bar4: string, bar1 = "[7 ~ 4 5]") =>
  with_(`<${bar1} [${bar2} ~ 4 ~] [5 4 2 ~] [${bar4} ~ 0 ~]>`);
const LANDING_STARTER = code(LOOP, mel("<[7 ~ 4 5] [⟪5⟫ ~ 4 ~] [5 4 2 ~] [⟪2⟫ ~ 0 ~]>"));

/** S6, by ear: 5 3 over C, then 2 7 over G and home on 1 over C. G E | D B C. */
const DICT_CHORDS = chords("<[0,2,4] [[4,6,8] [0,2,4]]>");
const HEARD = "<[4 ~ 2 ~] [1 -1 0@2]>";
const DICT = (tune: string) => code(DICT_CHORDS, mel(tune));
const DICT_STARTER = code(DICT_CHORDS, mel("<⟪[0 ~ ~ ~] [0 ~ ~ ~]⟫>"));
const DICT_MATCHER: Matcher = {
  m: "melody",
  pitch: "absolute",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 16],
  track: "mel",
};

/** The Make's starter: on every beat 1 and 3 a note a step away from its chord. */
const MAKE_STARTER = with_("<[1 ~ 5 ~] [5 ~ 2 ~] [6 ~ 1 ~] [4 ~ 1 ~]>");

/** The Band's drums and bass (roots of I V vi IV, in C); the chords are the code's own line. */
const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U07.L03",
  version: 3,
  title: "Landing on Chord Tones",
  objective:
    "I can write a tune that lands on a note of the chord on beats 1 and 3, and moves freely between.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M03"],
  practises: [],
  terms: [{ id: "term.chord-tone", step: "S3" }],
  canDo: ["cd.compose.chord-tones"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A tune that sits",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND, initialPanels: ["chords", "chord-tones"] },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-tune-that-sits",
        version: 1,
        role: "practice",
        prompt:
          "Listen for how the tune sits on its chords: does it sound settled, or does it rub against them?",
        skills: [{ skill: "M03", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four bars over C, G, Am and F, a chord a bar.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Which one fits?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-fits",
        version: 1,
        role: "practice",
        prompt:
          "Play both cards. Listen hardest to beat 1 of each bar, where the chord changes, and pick the tune that sounds settled on the chords.",
        skills: [{ skill: "M03", w: 1 }],
        hints: ladder(
          "In which card does the tune sound at rest with the chords on beat 1?",
          "Hum along with bar 1 of each card. On beat 1, does the tune's note blend with the C chord or rub against it?",
          "Card B is card A moved up one degree. Play bar 4 of each: which one rests on the F chord?",
        ),
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "hook", label: "Card A", audio: HOOK },
            { id: "step-up", label: "Card B", audio: STEP_UP },
          ],
        },
        correct: { choice: ["hook"] },
        feedbackText: {
          "id.wrong":
            "Card B is the same tune one degree higher. Play bar 4 of both: card A ends on C, inside the F chord; card B ends on D, outside it.",
        },
        tests: [
          { name: "hook", response: { answer: { choice: ["hook"] } }, expect: "pass" },
          {
            name: "step up",
            response: { answer: { choice: ["step-up"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Beats 1 and 3",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND, initialPanels: ["chords", "chord-tones"] },
      example: { id: "beats-one-and-three", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "beats-one-and-three",
        version: 1,
        role: "practice",
        prompt:
          "Run the tune. For each note on beat 1 or beat 3, find that bar's chord in the `chords` line and check whether the note is one of its three notes. Then answer both questions.",
        skills: [{ skill: "M03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Take bar 2: its chord is `[4,6,8]`, degrees 5 7 2, G B D. The tune's first note there is `n` 4, degree 5.",
        },
        hints: ladder(
          "Bar 1's chord is C: C, E and G. The tune plays G on beat 1 and E on beat 3. Are they in it?",
          "Do the same for each bar: the chord's three notes, then the tune's notes on beats 1 and 3.",
          "Bar 2's chord stacks from G: G, B, D. Its beat-1 note is G.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "Out of every note on beats 1 and 3, what percentage belongs to the chord under it?",
            correct: 100,
          },
          {
            q: "choice",
            prompt: "Bar 2, beat 1: G over the G chord. Which note of the chord is it?",
            options: [
              { id: "root", label: "The root" },
              { id: "third", label: "The 3rd" },
              { id: "fifth", label: "The 5th" },
            ],
            correct: ["root"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 100, choice: ["root"] } }, expect: "pass" },
          {
            name: "the notes between counted too",
            response: { answer: { number: 50, choice: ["root"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "G read as the 5th of C",
            response: { answer: { number: 100, choice: ["fifth"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "In the chord?",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "all",
        id: "in-the-chord-or-not",
        version: 1,
        role: "check",
        prompt:
          "A new tune over the same four chords. For each of four marked notes, one at a time, pick whether it is a chord tone of the chord under it or not.",
        skills: [{ skill: "M03", w: 1 }],
        hints: ladder(
          "What are the three notes of each chord in the loop?",
          "C is C E G, G is G B D, Am is A C E, F is F A C.",
          "Find the marked note's letter, then look for it in that bar's chord.",
        ),
        tests: [],
        parts: [
          {
            kind: "identify",
            id: "e-over-c",
            version: 1,
            role: "check",
            prompt: "Bar 1, beat 1: degree 3 (E) over the C chord.",
            skills: [{ skill: "M03", w: 1 }],
            hints: quizHints("C"),
            stimulus: { src: "code", code: QUIZ, bars: 4, showCode: true },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: YES_NO },
            correct: { choice: ["yes"] },
            feedbackText: QUIZ_WRONG,
            tests: [
              { name: "yes", response: { answer: { choice: ["yes"] } }, expect: "pass" },
              {
                name: "no",
                response: { answer: { choice: ["no"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "a-over-g",
            version: 1,
            role: "check",
            prompt: "Bar 2, beat 3: degree 6 (A) over the G chord.",
            skills: [{ skill: "M03", w: 1 }],
            hints: quizHints("G"),
            stimulus: { src: "code", code: QUIZ, bars: 4, showCode: true },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: YES_NO },
            correct: { choice: ["no"] },
            feedbackText: QUIZ_WRONG,
            tests: [
              { name: "no", response: { answer: { choice: ["no"] } }, expect: "pass" },
              {
                name: "yes",
                response: { answer: { choice: ["yes"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "g-over-am",
            version: 1,
            role: "check",
            prompt: "Bar 3, beat 1: degree 5 (G) over the Am chord.",
            skills: [{ skill: "M03", w: 1 }],
            hints: quizHints("Am"),
            stimulus: { src: "code", code: QUIZ, bars: 4, showCode: true },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: YES_NO },
            correct: { choice: ["no"] },
            feedbackText: QUIZ_WRONG,
            tests: [
              { name: "no", response: { answer: { choice: ["no"] } }, expect: "pass" },
              {
                name: "yes",
                response: { answer: { choice: ["yes"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "a-over-f",
            version: 1,
            role: "check",
            prompt: "Bar 4, beat 3: degree 6 (A) over the F chord.",
            skills: [{ skill: "M03", w: 1 }],
            hints: quizHints("F"),
            stimulus: { src: "code", code: QUIZ, bars: 4, showCode: true },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: YES_NO },
            correct: { choice: ["yes"] },
            feedbackText: QUIZ_WRONG,
            tests: [
              { name: "yes", response: { answer: { choice: ["yes"] } }, expect: "pass" },
              {
                name: "no",
                response: { answer: { choice: ["no"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Fix the landings",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "fix-the-landings",
        version: 1,
        role: "check",
        prompt:
          "Change the first note of bar 2 to a note of the G chord, and the first note of bar 4 to a note of the F chord. Leave every other note as it is. Done when every note on beats 1 and 3 is a chord tone.",
        skills: [{ skill: "M03", w: 1 }],
        code: { starter: LANDING_STARTER },
        reference: { solutions: [LANDING("6", "3")], bars: 4 },
        // Any chord tone passes: the root, the 3rd or the 5th, in any octave.
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "landings",
              label: "Every note on beats 1 and 3 is a note of the chord under it",
              required: true,
              skills: ["M03"],
              rule: "chord-tones-strong",
              minRatio: 1,
              melody: "mel",
              harmony: "chords",
              strength: "strong",
            },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet ({detail}). Check the first note of bars 2 and 4 against the three notes of that bar's chord.",
        },
        hints: ladder(
          "The bumps are on beat 1 of bars 2 and 4. Which chord plays in each of those bars, and which three notes make it?",
          "Bar 2's chord is `[4,6,8]` and bar 4's is `[3,5,7]`. Any of those numbers, or the same note an octave away, is a chord tone.",
          "Bar 2 is the G chord, G B D. The note there now is `n` 5, one step from B.",
        ),
        tests: [
          { name: "reference", response: { code: LANDING("6", "3") }, expect: "pass" },
          { name: "other chord tones: D and A", response: { code: LANDING("8", "5") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: LANDING("5", "2") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "only bar 2 fixed",
            response: { code: LANDING("6", "2") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bar 1 changed as well",
            response: { code: LANDING("6", "3", "[7 ~ 4 2]") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "dictate",
      title: "Hear where it lands",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "hear-where-it-lands",
        version: 1,
        role: "check",
        prompt:
          "Write the tune you hear in the `mel` line, as degrees of C in `n`: five notes over two bars. The chords, C and then G and C, are already in the code. Done when each note's degree and beat match what you hear.",
        skills: [
          { skill: "M03", w: 0.5 },
          { skill: "E07", w: 0.5 },
        ],
        hints: ladder(
          "Write five numbers in `n`, one per note, each on its beat. Which bar has the lowest note, and does it sit below home?",
          "On beats 1 and 3 the note is in the chord: start from those, then fill in the one between.",
          "Bar 1 is `[4 ~ 2 ~]`: degree 5, then 3, both in the C chord. Bar 2 has three notes and ends on home.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: DICT(HEARD), bars: 2, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: DICT_STARTER },
        reference: { solutions: [DICT(HEARD)], bars: 2 },
        matcher: DICT_MATCHER,
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "exact" },
        // The catalog's text is about `n` counting from 0; here the slip is hearing the start a degree off.
        feedbackText: {
          "melody.index-shift":
            "Every note is one degree {dir}: the shape is right, the start is not. The first note is in the C chord.",
        },
        srs: [{ family: "fam.mel.dictation", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: DICT(HEARD) }, expect: "pass" },
          {
            name: "the notes held with @",
            response: { code: DICT("<[4@2 2@2] [1 -1 0@2]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: DICT("<[0 ~ ~ ~] [0 ~ ~ ~]>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "every note a degree high",
            response: { code: DICT("<[5 ~ 3 ~] [2 0 1@2]>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "the low note heard as 6",
            response: { code: DICT("<[4 ~ 2 ~] [1 -2 0@2]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Land on the chords",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "land-on-the-chords",
        version: 1,
        role: "practice",
        prompt:
          "Rewrite the tune so its notes on beats 1 and 3 are chord tones of the chord in their bar. Between them, go where you like. Done when at least 6 in 10 of the notes on beats 1 and 3 are chord tones.",
        skills: [{ skill: "M03", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "chord-tones",
            label: "At least 6 in 10 notes on beats 1 and 3 are notes of the chord under them",
            required: true,
            skills: ["M03"],
            rule: "chord-tones-strong",
            minRatio: 0.6,
            melody: "@melody",
            harmony: "chords",
            strength: "strong",
          },
          {
            id: "motif",
            label:
              "At least half the bars repeat the shape of an earlier bar, the same or moved to other degrees",
            required: false,
            skills: ["M02"],
            rule: "motif-reuse",
            track: "@melody",
            minRatio: 0.5,
            shape: "either",
          },
          {
            id: "home",
            label: "The last note is home, degree 1",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
        ],
        hints: ladder(
          "Start with bar 1: its chord is C, made of C E G. Is the tune's note on beat 1 one of them? The one on beat 3?",
          "Each number in the `chords` line is a note you can land on: the same number in the tune, or that number plus or minus 7.",
          "Bar 1's chord is `[0,2,4]`. The tune starts on `n` 1 there: move it one step, to 0 or 2.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: each strong-beat note moved a step",
            response: { code: with_("<[2 ~ 4 ~] [4 ~ 1 ~] [5 ~ 2 ~] [5 ~ 0 ~]>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: a motif on each chord, notes between, room",
            response: {
              code: `${with_("<[4 3 2 ~] [6 5 4 ~] [7 6 5 ~] [5 ~ 3 [2 1]] [4 3 2 ~] [6 5 4 ~] [5 4 2 1] [0 ~ ~ ~]>")}.room(.3)`,
            },
            expect: "pass",
          },
          {
            name: "the hook a degree higher",
            response: { code: STEP_UP },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
