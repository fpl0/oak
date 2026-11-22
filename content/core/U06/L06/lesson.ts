// U06.L06 The Four-Chord Schema. I V vi IV is a loop so common that you hear it before you know the song:
// a schema. Started on another of its chords (vi IV I V, IV I V vi) it is the same loop, rotated. And when V
// goes to vi instead of home, the ending swerves: a deceptive cadence. What the learner has: the four-chord
// loop as the Band's since U05 and as numerals (U06.L02), function (U06.L03), endings and the words cadence,
// authentic and half cadence (U06.L04), the bass of a loop by ear (U06.L05). Not yet: doo-wop, three-chord
// rock and the plagal ending (U06.L07), the pace of the changes (U06.L08). Spec: content/specs/U06.md.
//
// Shapes: the ear step seeds `fam.har.schema` at level 1 (the four-chord loop against three-chord rock); the
// rotation is a code step graded as chords (`pcset` with the bass, so vi an octave lower passes); the deceptive
// move is a fixed compare on two audio cards, because the cadence family's deceptive category opens only at
// U06.L07; the Make's one required rule is `progression` with `schema: "schema.axis"` and `allowRotation`,
// so every rotation passes and another loop does not. `pad` unlocks here and is every chord line's sound.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One triad on each root of `roots` (n values, one a bar), on the pad. */
const triads = (roots: string) => `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("pad")`;
/** A tune in degrees of C. */
const mel = (pattern: string, scale = "C4:major") => `mel: n("${pattern}").scale("${scale}").s("piano")`;
/** A bass on the roots, one a bar. */
const bassN = (roots: string) => `bass: n("${roots}").scale("C2:major").s("ebass").lpf(700)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** I V vi IV: roots on degrees 1, 5, 6 and 4 (n 0, 4, 5, 3). */
const AXIS = "<0 4 5 3>";
/** The same loop started on vi: vi IV I V (Am F C G). */
const FROM_VI = "<5 3 0 4>";
/** The U05.L01 tune: chord notes on every note it plays over I V vi IV. */
const TUNE = "<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>";
const HOOK = code('pad: chord("<C G Am F>").voicing().s("pad")', mel(TUNE));
/** S2: the same four stacks, started on degree 6. */
const ROTATED = code(triads(FROM_VI));
/** S3: the loop, then the loop started on vi, four bars each. */
const BOTH = code(triads("<0 4 5 3 5 3 0 4>"));

/** S5: the four-chord loop; the learner starts it on vi. */
const MODIFY_STARTER = code(`chords: n("[0,2,4]").add(n("<⟪0 4 5 3⟫>")).scale("C3:major").s("pad")`);

/**
 * S6: a phrase opens on I and IV (C, F) under a tune; then two endings, each V and one more chord, with the
 * tune 2 5 | 1 (D4 G4 | C5) over both: notes of V, then 5 rising a 4th to the high 1, where the ear expects
 * home. (It once leapt a 6th, D4 up to B4.) Card A: V to I (G, C). Card B: V to vi (G, Am). The last tune
 * note, C, belongs to both C and Am: only the chord swerves.
 */
const OPENING = code(triads("<0 3>"), bassN("<0 3>"), mel("<[2 ~ 4 ~] [5 ~ 3 ~]>"));
const ending = (last: string) =>
  code(triads(`<4 ${last}>`), bassN(`<4 ${last}>`), mel("<[1 ~ 4 ~] [7 ~ ~ ~]>"));
const TO_I = ending("0");
const TO_VI = ending("5");

/** The Make: I and V only, on the pad. */
const MAKE_STARTER = code(triads("<0 4>"));

/** The Band's drums and its bass on 1 5 6 4: the hook's chords sit on those roots. */
const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
/** Drums only: a rotated loop would fight the Band's bass. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U06.L06",
  version: 3,
  title: "The Four-Chord Schema",
  objective:
    "I can hear the four-chord loop I V vi IV in a song, start it on any of its chords, and hear V swerve to vi instead of going home.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H04"],
  practises: ["H03"],
  terms: [
    { id: "term.schema", step: "S3" },
    { id: "term.deceptive-cadence", step: "S6" },
  ],
  canDo: [],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "That loop",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "that-loop",
        version: 1,
        role: "practice",
        prompt:
          "I V vi IV on a warm pad, with a tune and the band. Listen for the darkest chord in the loop, and the bar it falls in.",
        skills: [{ skill: "H04", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "The loop on a pad, one chord a bar, a tune on top.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Start somewhere else",
      minutes: 0.5,
      ui: { panels: NONE, band: DRUMS },
      example: { id: "rotated", code: ROTATED, bars: 4 },
      exercise: {
        kind: "predict",
        id: "start-somewhere-else",
        version: 1,
        role: "practice",
        prompt:
          "The code has the same four numbers in `.add()` in another order, `<5 3 0 4>`, so the loop starts on the chord of degree 6. Predict what you will hear, and pick it.",
        skills: [{ skill: "H04", w: 1 }],
        hints: null,
        tests: [],
        code: ROTATED,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "same-song", label: "The same loop, entered from another place" },
          { id: "other-song", label: "A different loop with different chords" },
          { id: "mistake", label: "Chords in the wrong order that do not fit" },
        ],
        correct: ["same-song"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Same chords, new start",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "both", code: BOTH, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "same-chords-new-start",
        version: 1,
        role: "practice",
        prompt:
          "Run it: four bars of I V vi IV, then four of vi IV I V. Read the degree of each root on the roll, then answer both questions below.",
        skills: [{ skill: "H04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the roots bar by bar: 1 5 6 4, then 6 4 1 5. Which ones are new in the second half?",
        },
        hints: ladder(
          "Compare the two halves and listen for whether the second brings in a chord the first did not have.",
          "Write the roots of both halves as degrees, one under the other, and compare them.",
          "The first half is 1 5 6 4. The second starts on 6. Does 6 appear in the first half?",
        ),
        code: { starter: BOTH },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What changed from the first four bars to the last four?",
            options: [
              { id: "rotated", label: "The same chords, starting on another one" },
              { id: "new-chords", label: "Two chords were swapped for new ones" },
              { id: "new-key", label: "The same chords in a new key" },
            ],
            correct: ["rotated"],
          },
          {
            q: "number",
            prompt: "How many different chords do the eight bars play?",
            correct: 4,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["rotated"], number: 4 } },
            expect: "pass",
          },
          {
            name: "heard as new chords",
            response: { answer: { choice: ["new-chords"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted the bars' chords twice",
            response: { answer: { choice: ["rotated"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Name the loop",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "name-the-loop",
        version: 1,
        role: "check",
        prompt:
          "A loop of four chords plays, in C or another key. Pick which loop it is: the four-chord schema, I V vi IV, or the three-chord loop I IV V I that ends where it began.",
        skills: [{ skill: "H04", w: 1 }],
        hints: [
          { text: "Listen for a minor chord: one loop turns dark once, the other stays bright." },
          {
            text: "The four-chord loop has a minor chord in bar 3, vi. The three-chord loop is all major: I IV V I.",
          },
          {
            text: "Hear it again, slower, and sing the bass of each bar: 1 5 6 4, or 1 4 5 1?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.har.schema", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "axis", label: "The four-chord loop: I V vi IV" },
            { id: "three-chord", label: "Three chords: I IV V I" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.har.schema", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Start on vi",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "start-on-vi",
        version: 1,
        role: "check",
        prompt:
          "Rotate the loop so it starts on vi: vi IV I V. Reorder the four numbers in `.add()`, keeping the same four. Done when the loop plays vi IV I V.",
        skills: [
          { skill: "H04", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [code(triads(FROM_VI))], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Keep the four numbers you have (`n` counts from 0) and change only where the loop starts.",
        },
        hints: ladder(
          "Find the number in `.add()` that is the root of vi. The new loop starts there.",
          "A rotation keeps the order and moves the start: the loop reads 0 4 5 3, so starting on vi means starting on the third number.",
          "vi is degree 6, `n` 5, and IV comes after it. Then the loop wraps round to the start.",
        ),
        tests: [
          { name: "reference", response: { code: code(triads(FROM_VI)) }, expect: "pass" },
          {
            name: "vi an octave lower",
            response: { code: code(triads("<-2 3 0 4>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(triads(AXIS)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the numerals written as numbers: 6 4 1 5",
            response: { code: code(triads("<6 4 1 5>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right chords in the wrong order: vi V I IV",
            response: { code: code(triads("<5 4 0 3>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "compare",
      title: "The swerve",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "the-swerve",
        version: 1,
        role: "practice",
        prompt:
          "A phrase opens on I and IV. Then come two endings, each V and one more chord, with the same tune. Pick the ending that goes somewhere you did not expect.",
        skills: [{ skill: "H03", w: 1 }],
        hints: ladder(
          "After V your ear expects one chord in particular. Listen for the ending that does not give it.",
          "V leans toward I: the authentic cadence. Listen for the ending whose last chord is darker than home.",
          "Hum the bass of each last chord. One falls from 5 to 1; the other steps up from 5 to 6.",
        ),
        stimulus: { src: "code", code: OPENING, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "to-i", label: "Card A", audio: TO_I },
            { id: "to-vi", label: "Card B", audio: TO_VI },
          ],
        },
        correct: { choice: ["to-vi"] },
        srs: [{ family: "fam.har.cadence", mode: "review-if-due" }],
        // The catalog's `id.wrong` names the option ids ("That was to-i, not to-vi").
        feedbackText: {
          "id.wrong":
            "Card B is the one. Card A goes V to I and lands home. Card B goes V to vi: the bass steps up from 5 to 6 instead of falling to 1, and the chord turns minor. Play both again.",
        },
        tests: [
          { name: "card B", response: { answer: { choice: ["to-vi"] } }, expect: "pass" },
          {
            name: "card A",
            response: { answer: { choice: ["to-i"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your rotation",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-rotation",
        version: 1,
        role: "practice",
        prompt:
          "Finish the four-chord loop in the `chords` line on the pad, I V vi IV, started on whichever of its chords you like, in the loop's order. Then give the chords a rhythm or add a bass or a tune if you like. Done when all four chords play in the loop's order.",
        skills: [{ skill: "H04", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-four-chord-loop",
            label: "`chords` plays I V vi IV in order, started on any of its four chords",
            required: true,
            skills: ["H04"],
            rule: "progression",
            schema: "schema.axis",
            allowRotation: true,
            track: "chords",
          },
          {
            id: "on-the-pad",
            label: "The `pad` sound used",
            required: false,
            skills: ["H04"],
            rule: "sounds",
            contains: ["snd.pad"],
          },
          {
            id: "a-tune",
            label: "A tune on its own line, such as `mel`",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
        ],
        hints: ladder(
          "The starter has two of the four chords. Add the other two, keeping the loop's order.",
          "I V vi IV are the numbers 0 4 5 3. A rotation keeps that order and starts on any one of them.",
          "Starting on IV gives IV I V vi: the loop begins `<3 0 …>`. Any other start works the same way.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: started on IV",
            response: { code: code(triads("<3 0 4 5>")) },
            expect: "pass",
          },
          {
            name: "the loop as the hook has it",
            response: { code: code(triads(AXIS)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: from vi, chord names, a bass and a tune",
            response: {
              code: code(
                'chords: chord("<Am F C G>").voicing().s("pad").gain(.6)',
                bassN("<[5 ~ 5 4] [3 ~ 3 2] [0 ~ 0 2] [4 ~ 4 ~]>"),
                mel("<[0 ~ 2 0] [5 ~ 3 ~] [4 ~ 2 4] [6 ~ 4 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "another loop: doo-wop, I vi IV V",
            response: { code: code(triads("<0 5 3 4>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
