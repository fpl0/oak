// U14.L06 Mode Lab. Six colours on one home note, each one note from the next, brightest to darkest: Lydian,
// major, Mixolydian, Dorian, minor, Phrygian. To name one by ear: find home, hear whether the 3rd above it is
// major or minor, then listen for the one note that is not the plain scale's. A vamp shows its mode by staying
// on home and leaning on that note. What the learner has: Mixolydian and its ♭VII (U14.L01–L02), Dorian and its
// major IV (U14.L03), Lydian and its II (U14.L04), Phrygian and its ♭II (U14.L05), each met as one changed
// note of major or of minor; a patterned `.scale()` (U03.L05); chords by name over one `const` and a bass on
// `.rootNotes(2)` (U08.L04); sevenths by name (U12.L01). New tools, met in one step on the vamp: `.pan()` and
// `.jux(rev)`. Not yet: chromatic degrees and their syllables (U15.L01), Ionian / Aeolian / Locrian and
// chord-scales (J2.L04). Spec: content/specs/U14.md.
//
// How it is graded: one graded step, the ear's (S5): `fam.key.mode` at level 5, six trials from the generator.
// The investigate steps check one number and one choice. The sung step is never graded into the lesson and has
// a Quiet path. The Make's one required rule is `mode` with `tonic: "declared"` and `anyOf` the four colours:
// the tonic is read from the riff's `.scale()`, and the vamp passes in whichever of the four it really is.
// The starter plays only notes that Dorian, minor and Phrygian share (D F G A C over Dm7), so it is in no
// mode yet and fails on "its colour tone is on a strong beat 0×".
import { defineLesson, type HintLadder, type IdentifyEx, MODE_OPTIONS, type SingEx } from "@oak/content-kit";

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
 * The hook: one line through all seven degrees over a repeated D, on six scales with the same home. Each bar
 * one note drops a half step: G♯ to G (Lydian to major), C♯ to C (to Mixolydian), F♯ to F (to Dorian), B to
 * B♭ (to minor), E to E♭ (to Phrygian).
 */
const LINE = "0 2 4 3 1 5 6 7";
const LADDER = "D4:lydian D4:major D4:mixolydian D4:dorian D4:minor D4:phrygian";
const PEDAL = 'bass: note("d2*4").s("ebass").lpf(600)';
const line = (scales: string) => `gtr: n("${LINE}").scale("<${scales}>").s("cleangtr")`;
const HOOK = code(line(LADDER), PEDAL);
/** S2: bars 3 and 4 of the hook on their own. */
const MIX_TO_DORIAN = code(line("D4:mixolydian D4:dorian"), PEDAL);

/** S4: two loops made of the same seven notes (those of D major), each resting on its own home. */
const loopOf = (form: string) =>
  code(
    `const changes = "${form}"\n`,
    'chords: chord(changes).voicing().struct("x ~ x ~ ~ x ~ ~").s("rhodes")',
    'bass: chord(changes).rootNotes(2).s("fingerbass").lpf(800)',
  );
/** A Mixolydian: I ♭VII IV I. */
const A_MIX_LOOP = loopOf("<A G D A>");
/** E Dorian: i IV, twice. */
const E_DORIAN_LOOP = loopOf("<Em A Em A>");

const TOL = {
  cents: "learner",
  octave: "global",
  driftCompCents: 30,
  minCoverage: 0.4,
  passHitRate: 0.8,
} as const;

const singHome = (
  id: string,
  prompt: string,
  stimulus: string,
  key: { tonic: "A"; mode: "mixolydian" } | { tonic: "E"; mode: "dorian" },
): SingEx => ({
  kind: "sing",
  id,
  key,
  version: 1,
  role: "practice",
  prompt,
  skills: [
    { skill: "E10", w: 0.6 },
    { skill: "V03", w: 0.4 },
  ],
  hints: [
    { text: "Which chord sounds like the place the loop comes back to and rests?" },
    { text: "Hum the lowest note of that chord, the bass under it, and hold it while the loop goes round." },
    {
      text: "Hear it again, slower, and hum the bass note of the first bar before you sing.",
      replay: { rate: 0.75 },
    },
    "auto",
  ],
  // Quiet mode or no microphone: pick home on the keyboard instead (contracts §8.5); singing never gates.
  fallback: "identify",
  mode: "degree",
  // No cadence cue: the loop is the cue, and finding its home is the question.
  stimulus: { src: "code", code: stimulus, bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  target: { from: "degrees", degrees: ["1"], rhythm: "x _ _ _" },
  labels: "syllables",
  tol: TOL,
  showTrace: "live",
  tests: [],
});

/** S5: one trial of `fam.key.mode` level 5 per part, drawn by the lesson host (new ones every series). */
const earHints = (): HintLadder =>
  ladder(
    "Start with home: hum the note the phrase keeps coming back to.",
    "Now the 3rd above home: major or minor? That leaves three colours on each side.",
    "Sing the plain major or minor scale against the phrase. Which one note does the phrase play differently, and is it raised or lowered?",
  );
const earPart = (n: number): IdentifyEx => ({
  kind: "identify",
  id: `colour-${n}`,
  version: 1,
  role: "check",
  prompt: `Phrase ${n}. Which colour?`,
  skills: [{ skill: "E10", w: 1 }],
  hints: earHints(),
  stimulus: { src: "generator", family: "fam.key.mode", level: 5 },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...MODE_OPTIONS] },
  correct: {},
  tests: [],
});

/**
 * The Make: a vamp on D in no mode yet. Dm7 in every bar; a bass on its root; a riff that plays D F G A C
 * only (1 ♭3 4 5 ♭7), notes that Dorian, minor and Phrygian share. `.pan(.3)` puts the Rhodes a little left;
 * `.jux(rev)` plays the riff as written on the left and backwards on the right.
 */
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().struct("~ x ~ x ~ ~ x ~").s("rhodes").pan(.3)';
const BASS = 'bass: chord(changes).rootNotes(2).struct("x ~ ~ x ~ ~ x ~").s("fingerbass").lpf(800)';
const RIFF = "<[0 ~ 2 3 ~ 4 6 ~] [7 ~ 6 4 ~ 3 2 0]>";
const riff = (scale: string, pattern = RIFF, after = ".jux(rev)") =>
  `gtr: n("${pattern}").scale("${scale}").s("cleangtr")${after}`;
const vamp = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);
const MAKE_STARTER = vamp("<Dm7 Dm7>", riff("D3:dorian"));

/** Dorian: G7 brings B, and the riff lands on B (`n` 5) on beat 1 of bar 2. */
const DORIAN_MINIMAL = vamp("<Dm7 G7>", riff("D3:dorian", "<[0 ~ 2 3 ~ 4 6 ~] [5 ~ 6 4 ~ 3 2 0]>"));
/** Phrygian: the scale word, and E♭ under the second bar: the bass plays it on beat 1. */
const PHRYGIAN_MINIMAL = vamp("<Dm7 Eb>", riff("D3:phrygian"));
/** Mixolydian: the chord turns major (F becomes F♯ in the riff too) and C, ♭VII, takes bar 2. */
const MIXOLYDIAN_MINIMAL = vamp("<D C>", riff("D3:mixolydian"));
/** Lydian: D and E major, with G♯ (`n` 3) on beat 3 of both bars. */
const LYDIAN_MINIMAL = vamp("<D E>", riff("D3:lydian", "<[0 ~ 2 1 3 ~ 4 ~] [7 ~ 6 4 3 ~ 2 0]>"));

/** Drums from the Band; chords, bass and riff are the learner's, so the rule reads them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U14.L06",
  version: 4,
  title: "Mode Lab",
  objective:
    "I can name Mixolydian, Dorian, Lydian and Phrygian by ear, and write a vamp that makes its mode heard.",
  key: { tonic: "D", mode: "dorian" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E10"],
  terms: [],
  canDo: ["cd.hear.modes"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Six colours, one home",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 6 },
      exercise: {
        kind: "listen",
        id: "six-colours-one-home",
        version: 1,
        role: "practice",
        prompt:
          "Listen for the bar where the line crosses from bright to dark. One guitar line plays six bars over a repeated D; the numbers never change, and the scale under them changes once a bar.",
        skills: [{ skill: "E10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Six bars on one home note, D, a new scale in each.",
            bars: 6,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "One note down",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "one-note-down",
        version: 1,
        role: "practice",
        prompt:
          "Predict which note drops a half step from bar 3 to bar 4. Bar 3 is D Mixolydian, major with ♭7. Bar 4 is D Dorian, minor with a raised 6. Pick one answer.",
        skills: [{ skill: "E10", w: 1 }],
        hints: null,
        tests: [],
        code: MIX_TO_DORIAN,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "third", label: "The 3rd: F♯ becomes F" },
          { id: "sixth", label: "The 6th: B becomes B♭" },
          { id: "second", label: "The 2nd: E becomes E♭" },
        ],
        correct: ["third"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Read the ladder",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note" },
      example: { id: "ladder", code: HOOK, bars: 6 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-ladder",
        version: 1,
        role: "practice",
        prompt:
          "Run the six bars and compare the note names on the roll, each bar against the one before. Bar 5 is natural minor. Then answer both questions: how many notes change from bar to bar, and which two colours sit on either side of minor.",
        skills: [{ skill: "E10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare each bar with the one before, note by note: one name changes each time. Natural minor is bar 5; bar 4 sits just above it and bar 6 just below.",
        },
        hints: ladder(
          "Compare two neighbours first: bar 1's note names, then bar 2's. How many names differ?",
          "Lydian to major: G♯ becomes G. Do the same for every pair of neighbours; then look at the bars on either side of bar 5.",
          "Bar 4 has B where bar 5 has B♭, so it is one note brighter. Bar 6 has E♭ where bar 5 has E.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "From each bar to the next, how many notes change?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "Which two colours sit on either side of natural minor?",
            options: [
              { id: "dorian-phrygian", label: "Dorian, one note brighter; Phrygian, one note darker" },
              { id: "dorian-mixolydian", label: "Dorian and Mixolydian" },
              { id: "mixolydian-phrygian", label: "Mixolydian and Phrygian" },
            ],
            correct: ["dorian-phrygian"],
          },
        ],
        tests: [
          {
            name: "one note; Dorian and Phrygian",
            response: { answer: { number: 1, choice: ["dorian-phrygian"] } },
            expect: "pass",
          },
          {
            name: "two notes: counting the 3rd and the 6th together",
            response: { answer: { number: 2, choice: ["dorian-phrygian"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "Dorian and Mixolydian: the neighbours of bar 4, not of bar 5",
            response: { answer: { number: 1, choice: ["dorian-mixolydian"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "sing",
      title: "Sing home",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "sing-home",
        version: 1,
        role: "practice",
        prompt:
          "For each of the two loops, sing one long note: do, the home note the loop rests on. Let the loop go round first and find the chord it comes back to; its bass note is do. Sing in your own range.",
        skills: [
          { skill: "E10", w: 0.6 },
          { skill: "V03", w: 0.4 },
        ],
        hints: [
          { text: "Listen for the chord the loop comes back to and rests on. Which one is it?" },
          { text: "The first chord of each loop is a good guess. Hum its lowest note, the bass." },
          {
            text: "Hear it again, slower, and hum the bass of the first bar before you sing.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        fallback: "identify",
        // The two loops are the Mixolydian loop and the Dorian vamp that `fam.har.schema` level 5 plays from here.
        srs: [
          { family: "fam.deg.tonic", mode: "review-if-due" },
          { family: "fam.har.schema", mode: "review-if-due" },
        ],
        tests: [],
        parts: [
          singHome("home-of-loop-1", "Loop 1. Sing do, the note it rests on.", A_MIX_LOOP, {
            tonic: "A",
            mode: "mixolydian",
          }),
          singHome("home-of-loop-2", "Loop 2. Sing do, the note it rests on.", E_DORIAN_LOOP, {
            tonic: "E",
            mode: "dorian",
          }),
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Name the colour",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "name-the-colour",
        version: 1,
        role: "check",
        prompt:
          "Name the colour of each of the six phrases: one of the six you know. Each is on its own home note. Listen in three steps. Find home. Decide whether the 3rd above it is major or minor. Then find the one note the plain scale does not have.",
        skills: [{ skill: "E10", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.key.mode", mode: "review-if-due" }],
        tests: [],
        parts: [1, 2, 3, 4, 5, 6].map(earPart),
      },
    },
    {
      id: "S6",
      kind: "investigate",
      title: "Left and right",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "wide-vamp", code: MAKE_STARTER, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "left-and-right",
        version: 1,
        role: "practice",
        prompt:
          "Find the side where the riff plays backwards: left, right or middle. Use headphones. `.pan(.3)` places the Rhodes; `.jux(rev)` plays the riff twice at once, once as written and once backwards. Run the code, then pick the side.",
        skills: [{ skill: "E10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Listen to the first note of each bar: the riff as written starts on D, beat 1. The backwards copy starts later and ends on D. Which ear hears that one?",
        },
        hints: ladder(
          "Listen to one ear at a time: take one side of the headphones off. Does that side play the riff as written in the code?",
          "`.jux()` sends the line as written to one side and the changed copy to the other. `rev` is the change: the bar played backwards.",
          "The written riff starts on D right on beat 1, and it is on the left. Listen for the copy that ends on D instead.",
        ),
        code: { starter: MAKE_STARTER },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Where is the riff played backwards?",
            options: [
              { id: "right", label: "On the right" },
              { id: "left", label: "On the left" },
              { id: "middle", label: "In the middle, under the written one" },
            ],
            correct: ["right"],
          },
        ],
        tests: [
          { name: "the right", response: { answer: { choice: ["right"] } }, expect: "pass" },
          {
            name: "the left: that is the riff as written",
            response: { answer: { choice: ["left"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your modal vamp",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-modal-vamp",
        key: { tonic: "D", mode: "dorian" },
        version: 1,
        role: "practice",
        prompt:
          "Pick one colour for the D vamp that ends your song. Dorian: add G7, play B. Phrygian: scale word `phrygian`, add E♭. Mixolydian: scale word, chords D and C. Lydian: scale word, chords D and E, play G♯. Done when the colour note lands on beat 1 or 3 twice, with D the chord in 40% of the bars.",
        skills: [
          { skill: "E10", w: 0.4 },
          { skill: "S12", w: 0.3 },
          { skill: "S13", w: 0.3 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "one-mode",
            label:
              "One mode on D: its colour note on beat 1 or 3 at least twice, and the D chord in at least 40% of the bars",
            required: true,
            skills: ["E10", "S12", "S13"],
            rule: "mode",
            tonic: "declared",
            mode: "dorian",
            anyOf: ["dorian", "mixolydian", "lydian", "phrygian"],
            requireCharacteristic: true,
          },
          {
            id: "roots-in-the-bass",
            label: "The `bass:` line plays the root where most chords start",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
        ],
        // No `rubric.unmet` override: the `mode` rule's own detail says what is missing in words the learner has
        // ("its colour note 6 (B) is on a strong beat 0 times; put it on beat 1 or 3 at least twice"; "the D
        // chord is in 0% of the bars"; "B♭ in bar 1 is degree ♭6; D Dorian has 6 (B) in its place").
        hints: ladder(
          "Choose a mood first: rock (Mixolydian), funk (Dorian), floating (Lydian) or dark (Phrygian). Then find the one note that says it.",
          "The colour notes on D: B for Dorian, E♭ for Phrygian, C over a D major chord for Mixolydian, G♯ for Lydian. `n` counts from 0, so degree 6 is `n` 5.",
          "Dorian in two moves: the changes become `<Dm7 G7>`, and one riff note on beat 1 or 3 becomes a `5`.",
        ),
        tests: [
          {
            name: "the starter as it is: no colour note",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal Dorian: G7 and a B on beat 1",
            response: { code: DORIAN_MINIMAL },
            expect: "pass",
          },
          {
            name: "minimal Phrygian: the scale word and E♭",
            response: { code: PHRYGIAN_MINIMAL },
            expect: "pass",
          },
          { name: "minimal Mixolydian: D and C", response: { code: MIXOLYDIAN_MINIMAL }, expect: "pass" },
          {
            name: "minimal Lydian: D and E, G♯ on beat 3",
            response: { code: LYDIAN_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: four bars of Dorian funk, chords pushed an eighth early, a riff that leans on B",
            response: {
              code: code(
                changes("<Dm7 G7 Dm7 [G7 C]>"),
                'chords: chord(changes).voicing().struct("~ x ~ x ~ ~ x ~").early(1/8).s("rhodes").pan(.3)',
                BASS,
                riff(
                  "D3:dorian",
                  "<[0 ~ 2 3 ~ 4 5 ~] [5 ~ 4 3 ~ 2 0 ~] [0 ~ 2 3 ~ 4 6 7] [5 ~ 6 4 5 ~ 3 2]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "G7 added but the riff unchanged: B only off the beat",
            response: { code: vamp("<Dm7 G7>", riff("D3:dorian")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a vamp that leaves home: G7 and C under a D Dorian riff",
            response: {
              code: vamp("<G7 C G7 C>", riff("D3:dorian", "<[0 ~ 2 3 ~ 4 6 ~] [5 ~ 6 4 ~ 3 2 0]>")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a Dorian riff over a D major chord: F♯ in the chord, F in the riff",
            response: {
              code: vamp("<D G>", riff("D3:dorian", "<[0 ~ 2 3 ~ 4 6 ~] [5 ~ 6 4 ~ 3 2 0]>")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the Mixolydian scale word over D minor chords: F in the chord, F♯ in the riff",
            response: { code: vamp("<Dm C>", riff("D3:mixolydian")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "Dorian with Dm7 and Em7: B as the 5th of Em7, on beat 1",
            response: {
              code: vamp("<Dm7 Em7>", riff("D3:dorian", "<[0 ~ 2 3 ~ 4 6 ~] [5 ~ 6 4 ~ 3 2 0]>")),
            },
            expect: "pass",
          },
          {
            name: "Mixolydian with D7 in every bar: C inside the home chord, on beat 1",
            response: {
              code: vamp("<D7 D7>", riff("D3:mixolydian", "<[0 ~ 2 3 ~ 4 6 ~] [6 ~ 4 2 ~ 1 0 ~]>")),
            },
            expect: "pass",
          },
          {
            name: "Dorian chords, but the riff on D minor: B♭ against G7's B",
            response: {
              code: vamp("<Dm7 G7>", riff("D3:minor", "<[0 ~ 2 3 ~ 4 5 ~] [5 ~ 6 4 ~ 3 2 0]>")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
