// U11.L05 Twelve Bars (exemplar of U11). The 12-bar blues is three chords, I7 IV7 and V7, in a fixed order
// over twelve bars: four bars of I, two of IV, two of I, then V IV I V, and round again. In code the whole form
// is one string in a `const` (U08.L04): `const changes = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>"`, read by the chords
// (`chord(changes).voicing()`) and the bass (`chord(changes).rootNotes(2)`, U08.L01) alike; `!4` holds a chord
// for four bars because `< >` plays one entry a bar. What the learner has: the dominant seventh and its symbol
// (U11.L04), the minor pentatonic riff (U11.L02) and the blues scale with `crunch` (U11.L03), I IV V as numerals
// (U06.L02), `const` and `.rootNotes()` (U08). Not yet: the quick change and the turnaround as named devices
// (U11.L06), swing (U11.L07: this blues is straight, like a rock-and-roll blues). Spec: content/specs/U11.md.
//
// How it is graded (AUTHORING §17–§18): chords are compared as Roman numerals on the triad core (`harmony`
// matcher, level `rn`, `qualityDepth: "triad"`), so C7 counts as I and a hand-voiced or differently voiced C7
// passes too. The Make's required rule is `matches` against the standard form at `min: 0.9`: eleven bars of
// twelve, so the quick change (IV in bar 2) and a last bar on I, both real blues, pass; twelve bars of I fail.
// `blues-form`, the `bar-grid` chart answer and the 12-bar Band are planned (Build), so the exemplar uses
// none of them. The key is C blues (contracts §6.6 C5): numerals read I7 IV7 V7, never V7/IV.
import { type Degree, defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The standard 12-bar blues in C, one chord a bar: I7 ×4, IV7 ×2, I7 ×2, V7 IV7 I7 V7. */
const FORM = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>";
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("piano")';
/** The root of every bar, on every beat: the bass walks the form with the chords. */
const BASS = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)';
/** A two-bar riff on the blues scale (U11.L03), the same over every chord: C E♭ F G | G♭ F C. */
const RIFF = 'gtr: n("<[0 1 2 4] [3 2 0 ~]>").scale("C3:blues").s("crunch")';
const piece = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

const HOOK = piece(FORM, RIFF);
const CHORDS_ONLY = piece(FORM);
/** S4: the first eight bars are written; the last line still sits on I. */
const LAST_LINE_STARTER = piece("<C7!4 F7!2 C7!2 ⟪C7 C7 C7 C7⟫>");
const LAST_LINE = piece(FORM);
/** S6: the roots of the twelve bars, for singing: do ×4, fa ×2, do ×2, sol fa do sol. */
const ROOTS: Degree[] = ["1", "1", "1", "1", "4", "4", "1", "1", "5", "4", "1", "5"];
/** The Make starts from twelve bars of I and the riff. */
const MAKE_STARTER = piece("<C7!12>", RIFF);

/** Drums from the Band (a 4-bar groove that loops under the 12 bars); chords and bass are the learner's. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NUMERALS = {
  m: "harmony",
  level: "rn",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
} as const;

export default defineLesson({
  id: "U11.L05",
  version: 4,
  title: "Twelve Bars",
  objective: "I can play and write the 12-bar blues: I, IV and V in their twelve-bar order.",
  key: { tonic: "C", mode: "blues" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H10", "F04"],
  practises: [],
  terms: [{ id: "term.twelve-bar-blues", step: "S3" }],
  canDo: ["cd.read.twelve-bar"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Twelve bars",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 12 },
      exercise: {
        kind: "listen",
        id: "twelve-bars",
        version: 1,
        role: "practice",
        prompt:
          "Listen to a twelve-bar blues in C twice: chords and bass alone, then with a riff on top. Listen for the stretch where the music feels furthest from home, and for the bar that sends it round again.",
        skills: [{ skill: "H10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: CHORDS_ONLY, caption: "Chords and bass alone, twelve bars, then round again.", bars: 12 },
          {
            code: HOOK,
            caption: "The same twelve bars with the riff of The Dominant Seventh on top.",
            bars: 12,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Read the changes",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "read-the-changes",
        version: 1,
        role: "practice",
        prompt:
          'The whole form is one string: `const changes = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>"`. Inside `< >` each entry lasts one bar. Predict how long the first entry, `C7!4`, plays. Pick one answer, then listen to check it.',
        skills: [{ skill: "F04", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 12,
        mode: "choose",
        choices: [
          { id: "four-bars", label: "Four bars: `!4` repeats it four times, one bar each" },
          { id: "four-beats", label: "Four beats: one bar" },
          { id: "four-times-louder", label: "One bar, played four times as loud" },
        ],
        correct: ["four-bars"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Three chords, twelve bars",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "three-chords", code: HOOK, bars: 12 },
      exercise: {
        kind: "run-investigate",
        id: "three-chords-twelve-bars",
        version: 1,
        role: "practice",
        prompt:
          "Run the blues and read the chord band, the numerals under each bar. Then answer two questions: which three chords make the twelve bars, and in which bar V7 first sounds.",
        skills: [
          { skill: "H10", w: 0.5 },
          { skill: "F04", w: 0.5 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop the loop and read the chord band bar by bar: C7 is I7, F7 is IV7, G7 is V7.",
        },
        hints: ladder(
          "Read the `changes` string from left to right. How many different chord names does it use?",
          "C7 is built on 1, F7 on 4 and G7 on 5 of C. Where does G7 first appear in the string?",
          "Count the bars: four of C7, two of F7, two of C7. The next bar is the one.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which three chords make the twelve bars?",
            options: [
              { id: "i-iv-v", label: "I7, IV7 and V7" },
              { id: "i-ii-v", label: "I7, ii7 and V7" },
              { id: "i-iv-vi", label: "I7, IV7 and vi7" },
            ],
            correct: ["i-iv-v"],
          },
          { q: "number", prompt: "In which bar does V7 first sound?", correct: 9 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["i-iv-v"], number: 9 } },
            expect: "pass",
          },
          {
            name: "ii for IV",
            response: { answer: { choice: ["i-ii-v"], number: 9 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted from 0: bar 8",
            response: { answer: { choice: ["i-iv-v"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The last line",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "the-last-line",
        version: 1,
        role: "check",
        prompt:
          "Bars 1–8 are written; bars 9–12 still sit on C7. Replace the four highlighted chords with the last line of the blues, one chord a bar: V, IV, I, then V. Write each as a chord name with a 7, like the bars before.",
        skills: [{ skill: "H10", w: 1 }],
        code: { starter: LAST_LINE_STARTER },
        reference: { solutions: [LAST_LINE], bars: 12 },
        matcher: NUMERALS,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.rn":
            "Bar {bar}: you have {got}, the blues has {exp} there. The last line is V IV I V: G7 F7 C7 G7 in C.",
        },
        hints: ladder(
          "The last line uses all three chords, and one of them has not sounded yet. Which chord is V in C?",
          "V in C is G7. The line runs down from V to IV, lands on I, then V again.",
          "Write `G7 F7` for bars 9 and 10. Two to go: home, then V.",
        ),
        tests: [
          { name: "reference", response: { code: LAST_LINE }, expect: "pass" },
          {
            name: "ends on I: bar 12 on C7",
            response: { code: piece("<C7!4 F7!2 C7!2 G7 F7 C7 C7>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "unchanged",
            response: { code: piece("<C7!4 F7!2 C7!2 C7 C7 C7 C7>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "IV and V swapped: G7 for F7 in bar 10",
            response: { code: piece("<C7!4 F7!2 C7!2 F7 G7 C7 G7>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "the first bars changed as well",
            response: { code: piece("<C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Where am I?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "where-am-i",
        version: 1,
        role: "check",
        prompt:
          "Listen to a 12-bar blues, in C or another key, while the bar counter runs. Pick the chord that plays in the marked bar: I, IV or V.",
        skills: [{ skill: "F04", w: 1 }],
        hints: [
          { text: "Is the marked bar still home, or has the music moved away?" },
          {
            text: "Bars 1–4 are I. Bars 5–6 are IV. Bar 9 is the furthest from home: V.",
          },
          {
            text: "Hear it again, slower, and hum the lowest note of each bar.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.frm.blues", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "I", label: "I" },
            { id: "IV", label: "IV" },
            { id: "V", label: "V" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.frm.blues", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the floor of the blues",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-blues-roots",
        version: 1,
        role: "practice",
        prompt:
          "Sing the bass of the twelve bars, one syllable a bar, 12 notes: do four times, fa twice, do twice, then sol, fa, do, sol. Hear the bars with their bass first, then sing in your own range.",
        skills: [
          { skill: "V05", w: 0.6 },
          { skill: "H10", w: 0.4 },
        ],
        hints: [
          { text: "Hold do through the first four bars; the change to fa is the first thing to listen for." },
          { text: "Fa is four steps up from do, sol one more. The last line steps down sol, fa, do." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the twelve degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: CHORDS_ONLY, bars: 12, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ROOTS },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your first blues",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-first-blues",
        version: 1,
        role: "practice",
        prompt:
          "Write the twelve bars of your song's first chorus. Change the `changes` string so they follow the blues: four bars of I, two of IV, two of I, then V, IV, I, V. Then make the riff yours: change its notes, its rhythm or its sound. Done when at least 11 of the 12 bars match the blues.",
        skills: [{ skill: "H10", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [12, 24],
        saveAs: "sketch",
        rubric: [
          {
            id: "twelve-bar-changes",
            label: "At least 11 of the 12 bars play the blues chord for that bar: I, IV or V",
            required: true,
            skills: ["H10", "F04"],
            rule: "matches",
            reference: { solutions: [piece(FORM)], bars: 12 },
            matcher: NUMERALS,
            min: 0.9,
          },
          {
            id: "a-riff",
            label: "A melody line, such as the riff, plays on top",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
          {
            id: "blue-note",
            label: "The gtr line plays the blue 3rd, ♭3 (E♭), at least once",
            required: false,
            skills: ["S11"],
            rule: "degree-set",
            track: "gtr",
            contains: ["b3"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "A blues has twelve bars, most of them on I. Which bars are on IV, and which on V?",
          "Bars 5–6 are IV (F7), bars 9 and 10 are V and IV (G7 F7), bar 12 is V (G7).",
          'Write it as `"<C7!4 F7!2 C7!2 G7 F7 C7 G7>"`: twelve bars in one string.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the changes, the starter's riff", response: { code: HOOK }, expect: "pass" },
          {
            name: "the quick change: IV in bar 2 (a real blues, U11.L06)",
            response: { code: piece("<C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7>", RIFF) },
            expect: "pass",
          },
          {
            name: "beyond the brief: two choruses, a new riff on the minor pentatonic",
            response: {
              code: piece(
                "<C7!4 F7!2 C7!2 G7 F7 C7 G7 C7!4 F7!2 C7!2 G7 F7 C7 C7>",
                'gtr: n("<[4 3 2 0] [~ 0 1 0]>").scale("C3:minor:pentatonic").s("crunch")',
              ),
            },
            expect: "pass",
          },
          {
            name: "IV and V swapped all through",
            response: { code: piece("<C7!4 G7!2 C7!2 F7 G7 C7 F7>", RIFF) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
