// U16.L02 ♭VI & ♭VII. Two more chords from the same minor key, both major, built on its lowered 6th and 7th
// notes: A♭ and B♭ in C, written ♭VI and ♭VII. A♭ is yesterday's F minor with one note moved (F steps down to
// E♭; the A♭ and the C stay); B♭ is the key's own diminished chord on 7 with its root lowered (B D F → B♭ D F),
// and it is the chord of Mixolydian Rock (U14.L02). Played in a row they climb by whole steps into home,
// ♭VI–♭VII–I, the ending of a stadium anthem. What the learner has: iv in major and the term borrowed chord
// (U16.L01), the parallel minor (U10.L02), ♭VII in a Mixolydian loop (U14.L02), the chromatic syllables le and
// te and the step strings `5b` and `6b` (U15.L01), chords by name over one `const` (U08.L04). Not yet: ♭III and
// the word for the whole practice (U16.L03), borrowing in a minor key (U16.L04), borrowed chords found by ear
// (U16.L05). No new term, no new tool. Spec: content/specs/U16.md.
//
// How it is graded (AUTHORING §17, §19.6): a chord written by name is its pitch classes and its lowest note at
// each onset (`pcset` with `bass: true`), so `[E F]` for `[Eb F]` fails on one note of one chord; a chord built
// on the keyboard is its pitch classes and its lowest note (`kb.*`). The sung bass line is never graded into
// the lesson and has a Quiet path (`fallback: "identify"`). The Make's one required rule is `contains-rn` with
// `inOrder`: ♭VI, then ♭VII, then I, somewhere in the piece; the starter has no flat chord, the climb in the
// wrong order fails, and the climb into A minor fails.
import { defineLesson, type HintLadder, type KeySpec } from "@oak/content-kit";

const BPM = 112;
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

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
/** An anthem: sustained organ, and a bass pumping eighth notes on each chord's root. */
const CHORDS = 'chords: chord(changes).voicing().s("organ")';
const BASS = 'bass: chord(changes).rootNotes(2).struct("x*8").s("ebass")';
const mel = (pattern: string, scale = "C4:major") => `mel: n("${pattern}").scale("${scale}").s("crunch")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/**
 * The hook's tune, an overdriven guitar: up the home chord, round F, then do re mi a bar and a half from the
 * end. C5, D5 and E5 are the 3rds of A♭, B♭ and C in turn, so the climb needs no note from outside the key.
 */
const HOOK_TUNE = mel("<[2 4 7 4] [5 7 5 3] [7@2 8@2] [9@3 ~]>");
const HOOK = loop("<C F [Ab Bb] C>", HOOK_TUNE);
/** The same tune arriving the usual way, through IV and V: C over F, D over G, E over C. */
const HOOK_PLAIN = loop("<C F [F G] C>", HOOK_TUNE);

/** S2: F minor, then A♭ major. */
const FM_THEN_AB = code('chords: chord("<Fm Ab>").voicing().s("organ")');
/** S3: the three chords of the climb, one held chord a bar, with their roots in the bass. */
const THE_CLIMB = code(
  'chords: chord("<Ab Bb C>").voicing().s("organ")',
  'bass: chord("<Ab Bb C>").rootNotes(2).s("ebass")',
);

/** S4: the anthem's ending in G major; the tune is the hook's, a 4th lower (on G3), so it climbs do re mi again. */
const G_TUNE = mel("<[2 4 7 4] [5 7 5 3] [7@2 8@2] [9@3 ~]>", "G3:major");
const ending = (form: string) => loop(form, G_TUNE);
const MODIFY_STARTER = ending("<G C ⟪[C D]⟫ G>");
const MODIFY_SOLUTION = ending("<G C [Eb F] G>");

/** S6: the three chords held, and the bass line Oak sings first: le, te, do (A♭3, B♭3, C4). */
const SING = code(
  'chords: chord("<Ab Bb C C>").voicing().s("organ")',
  'mel: n("<5b 6b 7 ~>").scale("C3:major").s("piano")',
);

/**
 * The Make: eight bars of an anthem, I V vi IV I V IV I, whose bar 7 walks home through F. The tune of bar 7 is
 * C then D, and bar 8 is E: do re mi fits F and C now, and fits A♭, B♭ and C once the learner rebuilds bar 7.
 */
const MAKE_TUNE = mel("<[2 4 7 4] [6 4 1 ~] [5 7 5 2] [5 3 0 ~] [2 4 7 4] [6 4 1 ~] [7@2 8@2] [9@3 ~]>");
const MAKE_STARTER = loop("<C G Am F C G F C>", MAKE_TUNE);
const MAKE_MINIMAL = loop("<C G Am F C G [Ab Bb] C>", MAKE_TUNE);

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "U16.L02",
  version: 3,
  title: "♭VI & ♭VII",
  objective: "I can write the ♭VI–♭VII–I ending, two borrowed major chords climbing home from below.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H13"],
  terms: [],
  canDo: ["cd.compose.flat-six-seven"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two ways home",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-ways-home",
        version: 1,
        role: "practice",
        prompt:
          "The same tune twice, climbing do re mi at the end. The first time, bar 3 comes home through F and G; the second time, through A♭ and B♭, from below. Listen to bar 3 both times: which way into home sounds bigger?",
        skills: [{ skill: "H13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK_PLAIN,
            caption: "C, F, then F and G, and home: the key's own chords.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "C, F, then A♭ and B♭, and home. Listen to the bass in bar 3.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "F minor to A♭",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "f-minor-to-a-flat",
        version: 1,
        role: "practice",
        prompt:
          '`chord("<Fm Ab>")` plays the sad IV, then A♭ major. F minor is F, A♭ and C; A♭ major is A♭, C and E♭. Predict how many notes change from bar 1 to bar 2. Pick your answer, then run it.',
        skills: [{ skill: "H13", w: 1 }],
        hints: null,
        tests: [],
        code: FM_THEN_AB,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "one", label: "One: F steps down to E♭, and A♭ and C stay" },
          { id: "two", label: "Two" },
          { id: "three", label: "All three" },
        ],
        correct: ["one"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Three steps up",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      example: { id: "the-climb", code: THE_CLIMB, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "three-steps-up",
        version: 1,
        role: "practice",
        prompt:
          "A♭, B♭ and C play one chord a bar, each root in the bass. Read the three roots on the roll. Then answer both questions: how far apart the roots are, and how many notes change from B D F to B♭ major.",
        skills: [{ skill: "H13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the half steps between the bass notes: A♭ to B♭, then B♭ to C. For the chord on 7, compare B D F with B♭ D F note by note.",
        },
        hints: ladder(
          "Which degrees are the three bass notes on? The roll labels them.",
          "The roots are ♭6, ♭7 and 1. Count the half steps between neighbours on a keyboard in your head.",
          "A♭ to A is one half step, A to B♭ another. For the second question, D and F appear in both chords.",
        ),
        code: { starter: THE_CLIMB },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "How far apart are the three roots?",
            options: [
              { id: "whole", label: "A whole step each time" },
              { id: "half", label: "A half step each time" },
              { id: "half-whole", label: "A half step, then a whole step" },
            ],
            correct: ["whole"],
          },
          {
            q: "number",
            prompt:
              "C major's own chord on degree 7 is B, D and F. How many of its notes change to make B♭ major?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["whole"], number: 1 } }, expect: "pass" },
          {
            name: "a half step: the roots read as neighbours",
            response: { answer: { choice: ["half"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two notes counted",
            response: { answer: { choice: ["whole"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Climb home in G",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "climb-home-in-g",
        version: 1,
        role: "check",
        key: G,
        prompt:
          "The same ending in G major: G, C, then C and D in bar 3, and home. Replace the two chords of bar 3 with ♭VI, then ♭VII of G major, two beats each. Keep bars 1, 2 and 4 as they are. Done when bar 3 climbs home from below.",
        skills: [{ skill: "H13", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so an E♭ cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Both chords of the climb are major, on the lowered 6th and 7th notes of G major.",
        },
        srs: [{ family: "fam.har.cadence", mode: "review-if-due" }],
        hints: ladder(
          "Which notes of G major are degrees 6 and 7? What happens to each when it is lowered a half step?",
          "In C the climb was A♭ and B♭: degrees 6 and 7 lowered, a major chord on each. G major's 6 and 7 are E and F♯.",
          "Lowered, F♯ becomes F, so the second chord is F major. Find the first the same way, and write its flat with a b.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "two beats each, written out",
            response: { code: ending("<G C [Eb@2 F@2] G>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: ending("<G C [C D] G>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "E for Eb: the 6th not lowered",
            response: { code: ending("<G C [E F] G>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Ebm: the borrowed chord made minor",
            response: { code: ending("<G C [Ebm F] G>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "lowercase roots",
            response: { code: ending("<G C [eb f] G>") },
            expect: "fail",
            feedback: ["code.lowercase-chord-root"],
          },
          {
            name: "the last G changed as well",
            response: { code: ending("<G C [Eb F] Gm>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "E♭ cut to a click: the right chord, a sliver of its two beats",
            response: { code: ending("<G C [[Eb@0.01 ~@0.99] F] G>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Build ♭VI of D",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "build-flat-six-of-d",
        version: 1,
        role: "check",
        prompt:
          "D major runs D E F♯ G A B C♯. Build its ♭VI on the keyboard, three notes, root lowest. ♭VI is the major chord whose root is degree 6 lowered a half step.",
        skills: [{ skill: "H13", w: 1 }],
        hints: ladder(
          "Which note is degree 6 of D major? Where does it go when it is lowered?",
          "Degree 6 of D major is B. Lowered a half step it is B♭, and ♭VI is the major chord on that note.",
          "A major chord is its root, the note a major 3rd up, and the 5th. B♭ is the root; the 3rd above it is a white key.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [10, 2, 5], bassPc: 10 },
        pitchMode: "octave-free",
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        // B♭ minor (D♭ for D) would read "D♭ doesn't belong / D is missing": these say the chord is major.
        feedbackText: {
          "kb.extra-note":
            "{got} doesn't belong. ♭VI is a major chord: its root, a major 3rd above it, and the 5th.",
          "kb.missing-note": "{exp} is missing. ♭VI is the major chord on the lowered 6th note.",
        },
        tests: [
          { name: "B♭ D F", response: { answer: { midi: [58, 62, 65] } }, expect: "pass" },
          { name: "spread: B♭ F D", response: { answer: { midi: [46, 53, 62] } }, expect: "pass" },
          {
            name: "B minor: degree 6 not lowered (the key's own vi)",
            response: { answer: { midi: [59, 62, 66] } },
            expect: "fail",
            feedback: ["kb.missing-note", "kb.extra-note", "kb.bass"],
          },
          {
            name: "B♭ minor: D♭ for D",
            response: { answer: { midi: [58, 61, 65] } },
            expect: "fail",
            feedback: ["kb.missing-note", "kb.extra-note"],
          },
          {
            name: "D lowest",
            response: { answer: { midi: [62, 65, 70] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Le te do",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "le-te-do",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the bass of the climb under its three chords, then sing it, one note a bar: le, te, do. Le and te are the lowered 6 and 7, each a whole step below the next. Sing in your own range.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "E12a", w: 0.4 },
        ],
        hints: [
          { text: "Hum do first, the note the line arrives on, and keep it in your ear." },
          {
            text: "Te is a whole step under do; le is a whole step under te. The line climbs in two equal steps.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["b6", "b7", "1"], octaves: [-1, -1, 0] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your encore",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-encore",
        version: 1,
        role: "practice",
        prompt:
          "Eight bars of an anthem whose bar 7 walks home through F. Replace the F of bar 7 with A♭ then B♭, two beats each, so bar 8's C arrives from below. Done when ♭VI, ♭VII and I play in that order. Then, if you like, move the climb, give each chord a bar or rewrite the tune.",
        skills: [{ skill: "H13", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-climb",
            label: "♭VI, then ♭VII, then I, in that order, somewhere in the piece",
            required: true,
            skills: ["H13"],
            rule: "contains-rn",
            rn: ["bVI", "bVII", "I"],
            min: 1,
            inOrder: true,
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
          {
            id: "tune-from-the-chords",
            label: "On most strong beats, the mel line plays a note of the chord under it",
            required: false,
            skills: ["M03"],
            rule: "chord-tones-strong",
            melody: "mel",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.6,
          },
          {
            id: "eight-bars",
            label: "At least eight bars",
            required: false,
            skills: ["H13"],
            rule: "bars",
            min: 8,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Bar 7 comes home through the key's own F. Which two chords climb into C from below?",
          "All eight chords live in `changes`. Bar 7 is F; the climb puts two chords in that bar, two beats each, in square brackets.",
          "In G major you wrote `[Eb F]` before G. Here home is C: the two chords a whole step and two whole steps below it.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: bar 7 climbs A♭ B♭ into C", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: a bar a chord, the tune holding each 3rd over the climb",
            response: {
              code: loop(
                "<C G Am F Ab Bb C C>",
                mel("<[2 4 7 4] [6 4 1 ~] [5 7 5 2] [5 3 0 ~] [7@3 ~] [8@3 ~] [9@2 7@2] [9@3 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the wrong order: B♭ then A♭ into C",
            response: { code: loop("<C G Am F C G [Bb Ab] C>", MAKE_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the climb into A minor instead of home",
            response: { code: loop("<C G Am F C G [Ab Bb] Am>", MAKE_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
