// J2.L03 Extensions (spec: content/specs/J2.md). Keep stacking thirds above a seventh chord and you reach the
// 9th, the 11th and the 13th: the 2nd, the 4th and the 6th, an octave up. They colour a chord without changing
// its job: Fm9 is still the ii, B♭13 still the V. A melody may sit on them; a long note a half step above a
// chord tone clashes (A♭ held over E♭maj7, which has G): an avoid note, fine in passing.
//
// Written for the learner at the gate (AUTHORING §20.1): the lesson may be taken right after U13.CP and J2.L02,
// with U14–U17 unfinished, so it uses only what U13.CP guarantees, J1's and J2's unlocks and its own
// (`chord.ext`, `.dict("ireal-ext")`): no mode names, no chromatic `n` steps (every melody is in note names),
// no secondary dominants by name. ♯9 and alt are heard once in S3 and never asked for.
//
// Evaluated (headless Strudel): `ireal-ext` voices Fm9 A♭3 E♭4 G4 A♭4 C5, B♭13 D3 A♭3 D4 G4 C5, E♭maj9 E♭3 D4
// F4 G4 C5 (it adds the 13th, C, to a maj9: the same notes as its E♭maj7), Fm7 F3 C4 E♭4 A♭4 C5, B♭7#9 D3 A♭3
// D♭4 F4 A♭4, B♭7alt D3 A♭3 D♭4 G♭4 B4; the default dictionary voices Fm9 A♭3 E♭4 F4 G4 C5 and B♭13 A♭3 C4 D4
// G4 B♭4. The hook's long notes: G over Fm9 (the 9th), G over B♭13 (the 13th), C over B♭13 (the 9th), F over
// E♭maj9 (the 9th), B♭ (the 5th); its short notes are chord tones (A♭, G).
//
// The corrections-pass standard (AUTHORING §20.2) on every graded step:
// - each required check reads what is HEARD: the chords' pitch classes and lowest note at every onset (`pcset`
//   with the bass), and in the Make the melody's long or on-beat notes against the chord sounding under them
//   (`tensions-used`), so a 9th touched as a passing eighth, or a silent tune, does not count;
// - each graded step pins a WRONG answer that uses the right function (a ninth chord where the chart asks the
//   13th; the right names on a silent line; the 9ths only off the beat) and three other right answers.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, TENSION_OPTIONS } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** J1.L01's swing pocket, soft for a ballad: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit").gain(.7)';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit").gain(.6)';

/** The ii–V–I of E♭, plain and coloured, one chord a bar. */
const PLAIN = "<Fm7 Bb7 Eb^7 Eb^7>";
const COLOUR = "<Fm9 Bb13 Eb^9 Eb^9>";
const constChanges = (changes: string) => `const changes = "${changes}"`;

/** A ballad: one long chord a bar on Rhodes, read from `changes`; `tail` appends to the line. */
const comp = (dict = '.dict("ireal-ext")', tail = "") =>
  `chords: chord(changes)${dict}.voicing().s("rhodes").gain(.6)${tail}`;
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const vibes = (line: string, tail = "") => `mel: note("${line}").s("vibes")${tail}`;

/**
 * The hook's tune: long notes on the 9ths and the 13th, short ones on chord tones (evaluated: G . . A♭ | G . C . |
 * F . . G | B♭).
 */
const TUNE = "<[g4@3 ab4] [g4@2 c5@2] [f4@3 g4] bb4>";
const ballad = (changes: string, dict = '.dict("ireal-ext")', line = TUNE) =>
  code(constChanges(changes), "", RIDE, HATS, comp(dict), BASS, vibes(line));

const HOOK = ballad(COLOUR);
const PLAIN_BALLAD = ballad(PLAIN, "");

/** S2: Fm7, then Fm9, in the extended dictionary, over F in the bass. */
const NINE_ADDED = code(constChanges("<Fm7 Fm9>"), "", comp(), BASS);

/** S3: three Vs into E♭maj9, chords and bass only. */
const intoHome = (v: string) => code(constChanges(`<${v} Eb^9>`), "", RIDE, comp(), BASS);
const V_SHARP_NINE = intoHome("Bb7#9");
const V_THIRTEEN = intoHome("Bb13");
const V_ALT = intoHome("Bb7alt");

/**
 * S4: four plain sevenths, each under one held vibes note (evaluated): G over Fm7 (the 9th), G over B♭7 (the
 * 13th), A♭ over E♭maj7 (a half step above its G: a clash), C over B♭7 (the 9th).
 */
const HELD = code(constChanges("<Fm7 Bb7 Eb^7 Bb7>"), "", comp(""), BASS, vibes("<g4 g4 ab4 c5>"));
/** The quiz offers the colours the lesson has named, and the clash. */
const HELD_OPTIONS = TENSION_OPTIONS.filter((o) => ["chord-tone", "9", "13", "avoid"].includes(o.id));

/** S5: the chart in plain sevenths; the colours are the learner's. */
const chart = (changes: string, dict = '.dict("ireal-ext")', tail = "") =>
  code(constChanges(changes), "", RIDE, HATS, comp(dict, tail), BASS);
const CHART_STARTER = code(constChanges("⟪<Fm7 Bb7 Eb^7 Eb^7>⟫"), "", RIDE, HATS, comp(), BASS);
const CHART_SOLUTION = chart(COLOUR);
/** The same chart in the default dictionary: the same colours, voiced fuller (it keeps the roots of Fm9 and B♭13). */
const CHART_DEFAULT_DICT = chart(COLOUR, "");
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S6: the coloured chart under a vibes tune on chord tones only (A♭ C | A♭ F | G B♭ | E♭). */
const CHORD_TONES = "<[ab4@3 c5] [ab4@2 f4@2] [g4@3 bb4] eb4>";
const MAKE_STARTER = code(constChanges(COLOUR), "", comp(), BASS, vibes(CHORD_TONES));
const makeAnswer = (line: string, tail = "", bpm = BPM) =>
  code(constChanges(COLOUR), "", comp(), BASS, vibes(line, tail)).replace(
    `setcpm(${BPM}/4)`,
    `setcpm(${bpm}/4)`,
  );

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the tune are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J2.L03",
  version: 3,
  title: "Extensions",
  objective: "I can add 9ths, 11ths and 13ths to a chord and know which held notes clash.",
  key: { tonic: "Eb", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["J02", "I04"],
  terms: [
    { id: "term.extension", step: "S2" },
    { id: "term.avoid-note", step: "S4" },
  ],
  canDo: ["cd.write.extensions"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same chords, more colour",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "colour-ballad", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "same-chords-more-colour",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the tune's long notes in both takes. Notice in which take they sound like part of the chord, and in which they float above it.",
        skills: [{ skill: "J02", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: PLAIN_BALLAD,
            caption: "The ballad on plain sevenths.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The same chords, with more on top.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "One note on top",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "nine-added", code: NINE_ADDED, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "one-note-on-top",
        version: 1,
        role: "practice",
        prompt:
          "Bar 1 is Fm7, bar 2 is Fm9, over F in the bass. Run it, read the roll and answer two questions: which note the 9 adds, and how many half steps it sits above the root F.",
        skills: [
          { skill: "J02", w: 0.6 },
          { skill: "I04", w: 0.4 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare the two bars on the roll and find the note that only bar 2 has. Then count up from F: a 2nd, and an octave on top of it.",
        },
        hints: ladder(
          "Compare the two bars on the roll and find the note only bar 2 has.",
          "Count the letters up from F: a 9th is a 2nd above the root, an octave higher.",
          "A 2nd above F is a whole step, two half steps. The octave adds its own half steps on top.",
        ),
        code: { starter: NINE_ADDED },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which note does Fm9 add to Fm7?",
            options: [
              { id: "g", label: "G" },
              { id: "ab", label: "A♭" },
              { id: "eb", label: "E♭" },
            ],
            correct: ["g"],
          },
          { q: "number", prompt: "How many half steps is a 9th above its root?", correct: 14 },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 14, choice: ["g"] } }, expect: "pass" },
          {
            name: "A♭: the 3rd, already in Fm7",
            response: { answer: { number: 14, choice: ["ab"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two: the 2nd without its octave",
            response: { answer: { number: 2, choice: ["g"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "compare",
      title: "Three dominants",
      minutes: 0.75,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "three-dominants",
        version: 1,
        role: "practice",
        prompt:
          "Three cards, each a V going home to the same E♭maj9. Listen to the V in the first bar of each card, and pick the one that sounds brightest.",
        skills: [{ skill: "J02", w: 1 }],
        hints: ladder(
          "Listen only to the first bar of each card. One V sounds sweet; two sound bent.",
          "Two of the Vs bend a note above the seventh a half step away from where the scale has it.",
          "The bright V keeps its colours inside E♭ major: its 9th and 13th are notes of the key.",
        ),
        stimulus: { src: "code", code: V_THIRTEEN, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "sharp-nine", label: "Card A", audio: V_SHARP_NINE },
            { id: "thirteen", label: "Card B", audio: V_THIRTEEN },
            { id: "alt", label: "Card C", audio: V_ALT },
          ],
        },
        correct: { choice: ["thirteen"] },
        feedbackText: {
          "id.wrong":
            "Listen to the first bar of each card again. One V sounds sweet and open; the other two grind against the key before they resolve.",
        },
        tests: [
          { name: "card B, the 13th", response: { answer: { choice: ["thirteen"] } }, expect: "pass" },
          {
            name: "card C: the altered V",
            response: { answer: { choice: ["alt"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "card A: the ♯9",
            response: { answer: { choice: ["sharp-nine"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Colour or clash",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "identify",
        id: "colour-or-clash",
        version: 1,
        role: "check",
        prompt:
          "Four plain sevenths, each under one long vibes note. For each bar, read the roll and pick what the held note is over its chord: a chord tone, a 9th, a 13th, or a clash.",
        skills: [{ skill: "J02", w: 1 }],
        srs: [
          { family: "fam.jzz.extension", mode: "seed" },
          { family: "fam.chd.spell", mode: "review-if-due" },
        ],
        hints: ladder(
          "Listen to each held note against its chord: a colour sounds sweet, a clash rubs. Then count up from the root to name it.",
          "Count up from each chord's root, in the bass, to the held note: a 2nd up an octave is the 9th, a 6th up an octave the 13th.",
          "Bar 1: G over a chord on F is a 2nd above its root. In bar 3, look for a chord note a half step under the held one.",
        ),
        stimulus: { src: "code", code: HELD, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "slot-choice",
          slots: 4,
          options: HELD_OPTIONS,
          labels: ["Bar 1: Fm7", "Bar 2: B♭7", "Bar 3: E♭maj7", "Bar 4: B♭7"],
        },
        correct: { choice: ["9", "13", "avoid", "9"] },
        feedbackText: {
          "id.slot":
            "{at}: not that one. Count up from the chord's root to the held note, and listen for a chord note a half step under it.",
        },
        tests: [
          {
            name: "9th, 13th, clash, 9th",
            response: { answer: { choice: ["9", "13", "avoid", "9"] } },
            expect: "pass",
          },
          {
            name: "G over B♭7 called the 9th",
            response: { answer: { choice: ["9", "9", "avoid", "9"] } },
            expect: "fail",
            feedback: ["id.slot"],
          },
          {
            name: "A♭ over E♭maj7 heard as a colour",
            response: { answer: { choice: ["9", "13", "13", "9"] } },
            expect: "fail",
            feedback: ["id.slot"],
          },
          {
            name: "C over B♭7 called a chord tone",
            response: { answer: { choice: ["9", "13", "avoid", "chord-tone"] } },
            expect: "fail",
            feedback: ["id.slot"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Colour the chart",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "colour-the-chart",
        version: 1,
        role: "check",
        prompt:
          "The trio plays the ballad on plain sevenths. Rewrite the four chords in `changes` with colour: a 9th on the ii, a 13th on the V, a major 9th at home. Keep each root and quality. Done when every bar matches the target.",
        skills: [{ skill: "J02", w: 1 }],
        swing: SWUNG,
        code: { starter: CHART_STARTER },
        // The chords by name are heard as their pitch classes and lowest note at every onset (contracts §6.7),
        // against the extended dictionary of the starter and, for a learner who drops `.dict()`, the default one.
        reference: { solutions: [CHART_SOLUTION, CHART_DEFAULT_DICT], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Not yet: bar {bar} does not sound like the target. Listen to that bar against the target's: is a colour missing, or is there one too many?",
        },
        hints: ladder(
          "Change only the number after each chord's letters. A number above 7 asks for a note above the seventh.",
          "Each chord keeps its root and its quality; only the number after it changes. The V wants the highest of the three colours.",
          "The ii becomes `Fm9`. The V takes the highest of the three colours; home keeps its major seventh under its colour.",
        ),
        tests: [
          { name: "reference", response: { code: CHART_SOLUTION }, expect: "pass" },
          {
            name: "the home chord repeated with !2",
            response: { code: chart("<Fm9 Bb13 Eb^9!2>") },
            expect: "pass",
          },
          {
            name: "sharps for flats: A♯13",
            response: { code: chart("<Fm9 A#13 Eb^9 Eb^9>") },
            expect: "pass",
          },
          {
            name: "the comping softer",
            response: { code: chart(COLOUR, '.dict("ireal-ext")', ".gain(.45)") },
            expect: "pass",
          },
          {
            name: "the default dictionary: the same colours, fuller voicings",
            response: { code: CHART_DEFAULT_DICT },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(CHART_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right idea, the wrong colour: a 9th on the V, Bb9",
            response: { code: chart("<Fm9 Bb9 Eb^9 Eb^9>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "one stack too far on the ii: Fm11",
            response: { code: chart("<Fm11 Bb13 Eb^9 Eb^9>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right names on a silent chords line",
            response: { code: chart(COLOUR, '.dict("ireal-ext")', ".gain(0)") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Ebmaj9 is not a code spelling",
            response: { code: chart("<Fm9 Bb13 Ebmaj9 Ebmaj9>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your ballad",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-ballad",
        version: 1,
        role: "practice",
        title: "E♭ ballad",
        prompt:
          "Rewrite the vibes tune, which sits on chord tones only. Required: in every four bars, at least two long or on-beat notes ring on a 9th or a 13th of their chord. Also on the checklist: no clash held over its chord. A clash may pass quickly. For contrast, let other bars land on a guide tone.",
        skills: [{ skill: "J02", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 16],
        saveAs: "sketch",
        rubric: [
          {
            id: "colours-ring",
            label:
              "In every four bars, at least two long or on-beat notes ring on a 9th or a 13th of their chord",
            required: true,
            skills: ["J02"],
            rule: "custom",
            fn: "tensions-used",
            params: { melody: "@melody", harmony: "@chords", tensions: ["9", "13"], min: 8 },
          },
          {
            id: "no-clash-held",
            label: "The tune's long or on-beat notes fit their chord: no clash is held",
            required: false,
            skills: ["J02"],
            rule: "custom",
            fn: "allowed-tensions",
            params: { melody: "@melody", harmony: "@chords", minRatio: 0.85 },
          },
        ],
        // The Make is heard over 16 bars (a four-bar tune plays four times), so `min: 8` is two in every four bars.
        // The override serves every rule of the rubric, the suggestion included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Put a 9th or a 13th of the chord on a beat, or hold it, so it rings long enough to be heard as a colour.",
          "Over each chord, count up from its root: a 9th is the note a whole step above the root, a 13th the note a 6th above it, in any octave. Put one on a beat and hold it.",
          "Over Fm9, G is the 9th. Over B♭13, find the note a 6th above B♭, and hold it from beat 1.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the hook's tune", response: { code: makeAnswer(TUNE) }, expect: "pass" },
          {
            name: "two colours exactly: G over Fm9, C over B♭13",
            response: { code: makeAnswer("<[g4@3 ab4] [c5@4] [g4@3 bb4] eb4>") },
            expect: "pass",
          },
          {
            name: "the 13th on beat 3 for a beat, the 9th of home on beat 1",
            response: { code: makeAnswer("<[c5 ab4 g4 f4] [ab4 f4 g4 ~] [f4@2 eb4@2] [g4@4]>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars, passing notes, slower",
            response: {
              code: makeAnswer(
                "<[g4@3 [ab4 bb4]] [c5@2 [bb4 ab4] g4] [f4@3 [g4 ab4]] [bb4@4] [eb5@2 c5 [bb4 ab4]] [g4@3 [f4 eb4]] [f4@2 g4 bb4] [d5@4]>",
                ".room(.3)",
                72,
              ),
            },
            expect: "pass",
          },
          {
            name: "the right notes, only in passing: each colour an eighth off the beat",
            response: {
              code: makeAnswer("<[ab4@3 [~ g4]] [ab4 [~ c5] f4@2] [g4@2 [~ f4] bb4] eb4>"),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hook's tune on a silent vibes line",
            response: { code: makeAnswer(TUNE, ".gain(0)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hook's tune more than 24 dB under the chords: not heard",
            response: { code: makeAnswer(TUNE, ".gain(.03)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one colour only, held twice as long",
            response: { code: makeAnswer("<[g4@4] [ab4@2 f4@2] [g4@3 bb4] eb4>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
