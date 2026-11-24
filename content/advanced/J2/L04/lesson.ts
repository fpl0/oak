// J2.L04 Chord-Scales (spec: content/specs/J2.md). Each chord of a ii–V–I has a scale that fits it, as a
// starting choice: Am7 takes A Dorian, D7 takes D Mixolydian, Gmaj7 takes G major (or Lydian, brighter). Over the
// ii and the V they are the seven notes of G, started on each chord's root; written as degrees on a scale per
// bar, one line of numbers outlines every chord as it comes.
//
// Written for the learner at the gate (AUTHORING §20.1): the lesson opens after U14.CP (the modes) and may be
// passed over; it never assumes U15–U17 (no chromatic `n` steps, no secondary dominants by name). Nothing in
// J.CP1, J3 or JC1 needs it. The four scales it unlocks besides (Locrian, altered, Lydian dominant, bebop) are
// shown once in S5 and asked for nowhere.
//
// Evaluated (headless Strudel): `n("0 1 2 4 6 5 4 2")` plays A B C E G F♯ E C on A4 Dorian (the 1, 3, 7 and 5 of
// Am7 on the beats, the 2, 5, 6 and 3 between), D E F♯ A C B A F♯ on D4 Mixolydian, G A B D F♯ E D B on G4 major
// and on G4 Lydian alike (the pattern has no `n` 3, Lydian's raised note). On A4 minor the sixth note is F, on D4
// major the fifth is C♯ (both off the chord's scale). F♯4 Locrian F♯ G A B C D E, B4 altered B C D E♭ F G A, D4
// Lydian dominant D E F♯ G♯ A B C, D4 bebop D E F♯ G A B C C♯.
//
// The corrections-pass standard (AUTHORING §20.2) on every graded step:
// - each required check reads what is HEARD: the line's notes in order (`melody`), and in the Make the line's long
//   or on-beat notes against the scale of the chord sounding under them (`chord-scale-fit`);
// - each graded step pins a WRONG answer that uses the right function (a scale per bar, but A minor on the ii; a
//   scale per bar, but each chord's own major scale; one scale held into the second key) and three other right
//   answers.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, MODE_OPTIONS } from "@oak/content-kit";

const BPM = 126;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** J1.L01's swing pocket: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';

const IN_G = "<Am7 D7 G^7 G^7>";
const constChanges = (changes: string) => `const changes = "${changes}"`;
/** The trio's comping on the Charleston and its bass, read from `changes`. */
const COMP =
  'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)';
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
/** The vibes line: chord tones on the beats, scale notes between (degrees 1 2 3 5 7 6 5 3 of each bar's scale). */
const LINE = "0 1 2 4 6 5 4 2";
const vibes = (scale: string, line = LINE, tail = "") =>
  `mel: n("${line}").scale("${scale}").swingBy(1/3, 4).s("vibes")${tail}`;
const trio = (changes: string, mel: string, drums = true) =>
  code(constChanges(changes), "", ...(drums ? [RIDE, HATS] : []), COMP, BASS, mel);

const CHORD_SCALES = "<A4:dorian D4:mixolydian G4:major G4:lydian>";
const HOOK = trio(IN_G, vibes(CHORD_SCALES));
const ONE_SCALE = trio(IN_G, vibes("G4:major"));

/** S2: A Dorian over Am7, then G major and G Lydian over Gmaj7, each run from its first note to the octave. */
const THREE_RUNS = code(
  constChanges("<Am7 G^7 G^7>"),
  "",
  'chords: chord(changes).voicing().s("rhodes").gain(.5)',
  BASS,
  'mel: n("0 1 2 3 4 5 6 7").scale("<A4:dorian G4:major G4:lydian>").s("vibes")',
);

/** S3: a ii–V–I in B♭ on the trio; the scales are the learner's to name. */
const IN_B_FLAT = trio("<Cm7 F7 Bb^7 Bb^7>", vibes("<C4:dorian F4:mixolydian Bb4:major Bb4:major>"));
const SCALE_OPTIONS = MODE_OPTIONS.filter((o) => ["dorian", "mixolydian", "major", "minor"].includes(o.id));

/** S4: the line on G major in every bar; the scale per bar is the learner's. */
const lineIn = (scale: string) => trio(IN_G, vibes(scale));
const LINE_STARTER = trio(IN_G, vibes("⟪G4:major⟫"));
const LINE_SOLUTION = lineIn("<A4:dorian D4:mixolydian G4:major G4:major>");
const LINE_LYDIAN = lineIn(CHORD_SCALES);
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/**
 * S5: four more scales on the chords they fit, one bar each, run up from the chord's root (evaluated): F♯ Locrian
 * over F♯m7♭5, B altered over B7alt, D Lydian dominant over D7♯11, D bebop over D7.
 */
const FOUR_MORE = code(
  constChanges("<F#m7b5 B7alt D7#11 D7>"),
  "",
  'chords: chord(changes).voicing().s("rhodes").gain(.5)',
  BASS,
  'mel: n("0 1 2 3 4 5 6 7").scale("<F#4:locrian B4:altered D4:lydian:dominant D4:bebop>").s("vibes")',
);

/** S6: the trio plays the ii–V–I in G, then in B♭; the line starts as the learner left it in S4. */
const TWO_KEYS = "<Am7 D7 G^7 G^7 Cm7 F7 Bb^7 Bb^7>";
const makeAnswer = (mel: string, bpm = BPM) =>
  code(constChanges(TWO_KEYS), "", COMP, BASS, mel).replace(`setcpm(${BPM}/4)`, `setcpm(${bpm}/4)`);
const MAKE_STARTER = makeAnswer(vibes("<A4:dorian D4:mixolydian G4:major G4:major>"));
const BOTH_KEYS = "<A4:dorian D4:mixolydian G4:major G4:major C4:dorian F4:mixolydian Bb4:major Bb4:major>";

const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the line are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J2.L04",
  version: 4,
  title: "Chord-Scales",
  objective:
    "I can choose a scale that fits each chord of a ii–V–I and play a line that follows the changes.",
  key: { tonic: "G", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J03"],
  practises: [],
  terms: [{ id: "term.chord-scale", step: "S2" }],
  canDo: ["cd.write.chord-scales"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A line that follows",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "line-follows", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-line-that-follows",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the note each bar of the line starts on, in both takes. Notice in which take the line seems to know when the chord changes.",
        skills: [{ skill: "J03", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "A scale for each chord.",
            bars: 4,
          },
          {
            code: ONE_SCALE,
            caption: "One scale, G major, for every bar.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Same notes, new start",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "three-runs", code: THREE_RUNS, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "same-notes-new-start",
        version: 1,
        role: "practice",
        prompt:
          "Bar 1 runs A Dorian over Am7, bar 2 G major over Gmaj7, bar 3 G Lydian over Gmaj7. Run it, read the roll and answer two questions: how many notes of A Dorian are missing from G major, and which one note G Lydian has that G major does not.",
        skills: [{ skill: "J03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the letters of bar 1 against bar 2 on the roll, then find the one note of bar 3 that bar 2 does not have and count up to it from G.",
        },
        hints: ladder(
          "Write out the letters of bars 1 and 2, ignoring order and octave, and compare the two sets.",
          "Compare the letters of bar 1 with the letters of bar 2, ignoring order and octave. Then compare bar 3 with bar 2.",
          "Bar 3 raises one note of G major a half step. Count up from G to it: which number is it, above the octave?",
        ),
        code: { starter: THREE_RUNS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many notes of A Dorian are missing from G major?",
            correct: 0,
          },
          {
            q: "choice",
            prompt: "Over Gmaj7, what is the one note G Lydian has that G major does not?",
            options: [
              { id: "sharp-eleven", label: "The ♯11" },
              { id: "nine", label: "The 9th" },
              { id: "thirteen", label: "The 13th" },
            ],
            correct: ["sharp-eleven"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 0, choice: ["sharp-eleven"] } },
            expect: "pass",
          },
          {
            name: "one: A Dorian heard as another scale",
            response: { answer: { number: 1, choice: ["sharp-eleven"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the 13th: a note G major already has",
            response: { answer: { number: 0, choice: ["thirteen"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Name the scales",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "identify",
        id: "name-the-scales",
        version: 1,
        role: "check",
        prompt:
          "The trio plays a ii–V–I in B♭: Cm7, F7, B♭maj7. For each chord, pick the scale that starts on its root and keeps to the notes of B♭ major.",
        skills: [{ skill: "J03", w: 1 }],
        srs: [
          { family: "fam.jzz.chord-scale", mode: "seed" },
          { family: "fam.key.mode", mode: "review-if-due" },
        ],
        hints: ladder(
          "All three chords come from B♭ major. Start B♭ major on each chord's root and listen to which scale that makes.",
          "Start B♭ major on each chord's root and you get its scale: the ii's has a minor 3rd and a major 6th, the V's a major 3rd and a ♭7.",
          "Cm7 takes the minor scale whose 6th is raised: not natural minor. F7 takes the major scale whose 7th is lowered.",
        ),
        stimulus: { src: "code", code: IN_B_FLAT, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "slot-choice",
          slots: 3,
          options: SCALE_OPTIONS,
          labels: ["Cm7", "F7", "B♭maj7"],
        },
        correct: { choice: ["dorian", "mixolydian", "major"] },
        feedbackText: {
          "id.slot":
            "{at}: not that one. Start B♭ major on this chord's root and compare its 3rd, 6th and 7th with the scales offered.",
        },
        tests: [
          {
            name: "Dorian, Mixolydian, major",
            response: { answer: { choice: ["dorian", "mixolydian", "major"] } },
            expect: "pass",
          },
          {
            name: "the ii and the V swapped",
            response: { answer: { choice: ["mixolydian", "dorian", "major"] } },
            expect: "fail",
            feedback: ["id.slot"],
          },
          {
            name: "natural minor on the ii",
            response: { answer: { choice: ["minor", "mixolydian", "major"] } },
            expect: "fail",
            feedback: ["id.slot"],
          },
          {
            name: "major on the V",
            response: { answer: { choice: ["dorian", "major", "major"] } },
            expect: "fail",
            feedback: ["id.slot"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Follow the changes",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "follow-the-changes",
        version: 1,
        role: "check",
        prompt:
          "The vibes line plays the same numbers on G major in every bar. Change `.scale()` so each bar runs the scale of its chord, starting on its root: Am7, D7, then Gmaj7 for two bars. Keep the numbers in `n()`. Done when the line matches the target.",
        skills: [{ skill: "J03", w: 1 }],
        swing: SWUNG,
        code: { starter: LINE_STARTER },
        reference: { solutions: [LINE_SOLUTION, LINE_LYDIAN], bars: 4 },
        // What is heard: every note of the line in order, in any octave. A scale per bar that does not fit its
        // chord (A minor on the ii, D major on the V) changes one note a bar and fails.
        matcher: {
          m: "melody",
          pitch: "octave-free",
          wPitch: 0.8,
          wRhythm: 0.2,
          rhythmTol: [1, 16],
          track: "mel",
        },
        target: { audible: true },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: that note is not in the scale of the chord under it. Listen to the bar against the target's and check which scale that bar runs on.",
        },
        hints: ladder(
          "Make `.scale()` change every bar, one scale per chord, each starting on that chord's root.",
          "Make `.scale()` a pattern with one scale per bar, each starting on its chord's root: the ii, the V, then home twice.",
          "Bar 1 is `A4:dorian`. The V and the home chord take the scales you named in B♭, started on D and G.",
        ),
        tests: [
          { name: "reference", response: { code: LINE_SOLUTION }, expect: "pass" },
          { name: "Lydian on bar 4", response: { code: LINE_LYDIAN }, expect: "pass" },
          {
            name: "the scales an octave lower",
            response: { code: lineIn("<A3:dorian D3:mixolydian G3:major G3:major>") },
            expect: "pass",
          },
          {
            name: "the home scale written once with !2",
            response: { code: lineIn("<A4:dorian D4:mixolydian G4:major!2>") },
            expect: "pass",
          },
          {
            name: "Lydian on both home bars",
            response: { code: lineIn("<A4:dorian D4:mixolydian G4:lydian!2>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(LINE_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a scale per bar, but natural minor on the ii (F over Am7)",
            response: { code: lineIn("<A4:minor D4:mixolydian G4:major G4:major>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "a scale per bar, but major on the V (C♯ over D7)",
            response: { code: lineIn("<A4:dorian D4:major G4:major G4:major>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "see",
      title: "Four more scales",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "four-more", code: FOUR_MORE, bars: 4 },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your solo",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-solo",
        version: 1,
        role: "practice",
        title: "Two-key solo",
        prompt:
          "Change the line's scales in bars 5 to 8: the chords move into B♭ there, but the line still runs the G scales. These eight bars are your song's second solo. Done when at least 9 in 10 of the line's long or on-beat notes fit the scale of their chord.",
        skills: [{ skill: "J03", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [8, 16],
        saveAs: "sketch",
        rubric: [
          {
            id: "line-fits",
            label:
              "At least 9 in 10 of the line's long or on-beat notes are in the scale of the chord under them",
            required: true,
            skills: ["J03"],
            rule: "custom",
            fn: "chord-scale-fit",
            // 0.9, not the spec's 0.8: the starter's G scales carried into B♭ score 0.81 and each chord's own
            // major scale 0.81, and both must fail (apiNotes).
            params: { melody: "@melody", harmony: "@chords", minRatio: 0.9 },
          },
          {
            id: "line-swings",
            label: "The line's eighths swing long-short, not even",
            required: false,
            skills: ["J03"],
            rule: "swing",
            track: "mel",
            subdivision: 8,
            ratio: [1.45, 2.4],
          },
          {
            id: "lydian-colour",
            label: "At least two long or on-beat notes ring on the ♯11 of their chord",
            required: false,
            skills: ["J03"],
            rule: "custom",
            fn: "tensions-used",
            params: { melody: "@melody", harmony: "@chords", tensions: ["#11"], min: 2 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Look at bars 5 to 8: the chords are in B♭, but the line still runs the G scales there.",
          "The scale pattern has four entries, so it starts again at bar 5 in G. Give it eight, one per bar.",
          "Bars 5 to 8 are the B♭ ii–V–I you named earlier: a scale on C, one on F, then home on B♭ twice.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one scale per bar, eight bars",
            response: { code: makeAnswer(vibes(BOTH_KEYS)) },
            expect: "pass",
          },
          {
            name: "B♭ major through the whole second key",
            response: {
              code: makeAnswer(vibes("<A4:dorian D4:mixolydian G4:major G4:major Bb4:major!4>")),
            },
            expect: "pass",
          },
          {
            name: "a line of its own, Lydian at home",
            response: {
              code: makeAnswer(
                vibes(
                  "<A4:dorian D4:mixolydian G4:lydian G4:lydian C4:dorian F4:mixolydian Bb4:lydian Bb4:lydian>",
                  "<[0 2 4 6] [4 3 2 1] [0 ~ 3 4] [6 ~ ~ 4]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: arpeggios in note names, faster",
            response: {
              code: makeAnswer(
                'mel: note("<[a4 c5 e5 g5] [f#5 d5 c5 a4] [b4 ~ d5 f#5] [e5 ~ ~ d5] [c5 eb5 g5 bb5] [a5 f5 eb5 c5] [d5 ~ f5 a5] [g5 ~ ~ f5]>").swingBy(1/3, 4).s("vibes")',
                160,
              ),
            },
            expect: "pass",
          },
          {
            name: "the right call, the wrong scales: each chord's own major scale",
            response: {
              code: makeAnswer(
                vibes("<A4:major D4:major G4:major G4:major C4:major F4:major Bb4:major Bb4:major>"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "G major held into B♭",
            response: { code: makeAnswer(vibes("G4:major")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right scales on a silent vibes line",
            response: { code: makeAnswer(vibes(BOTH_KEYS, LINE, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
