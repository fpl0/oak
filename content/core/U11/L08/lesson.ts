// U11.L08 Riffs & Response. A blues line is a call and its answer: a two-bar riff, then two bars that answer it,
// three times over the twelve bars. The riff stays the same as the chords change under it; the answer can
// change. What the learner has: the twelve bars as one `const` (U11.L05), the shuffle (U11.L07), the blues
// scale and `crunch` (U11.L03), the minor pentatonic riff (U11.L02), call and response and the motif (U07.L02,
// U07.L07), `organ` (U05.L08). Nothing new in rhythm or harmony. Spec: content/specs/U11.md.
//
// How it is graded. S4's answer is judged by a `rubric` matcher on the `vox:` line: it ends on 1, every note
// is in C blues, at least three different notes. The Make's one required rule is `motif-reuse` over both
// melody parts (`@melody`, two-bar units): the guitar's call (`mel:`) and the organ's answers (`vox:`, STYLE
// §2's second lead line) fall in different bars, so
// together they make one twelve-bar line of six two-bar units, call, answer, call, answer, call, answer. When
// the call comes back in lines 2 and 3, two of the six units repeat an earlier one: 0.33. The rule cannot read
// the guitar alone: `motif-reuse` reads one period of a line (AUTHORING §17.6), and a riff written
// `<call1 call2 ~ ~>` is a 4-bar loop with one idea in it, which scores 0 however often it comes back. The
// starter's guitar plays a new figure in every line (0 of 6), so it fails until the call returns. For the same
// reason the brief asks for answers that change: one answer repeated in every line makes the whole chorus a
// 4-bar loop (call, answer), which scores 0; S4 practises one answer, the Make three.
//
// Repertoire (contracts §2.8): the spec's S5 plays the first line of the 12-bar strain of St. Louis Blues
// (W. C. Handy, 1914) from `content/repertoire/st-louis-blues/song.ts`. That answer key does not exist yet
// (author:repertoire), and the spec says to ship nothing that names the song's notes until a human has checked
// them against the 1914 sheet. S5 therefore plays Oak's own four-bar blues line in the same shape, a tune and
// then a fill on another instrument, and asks the same question; `LINE` is the one constant to replace once the
// verified key lands. The prose names the song only as the model of the form, never its notes or words.
//
// Band: none (`band: false`), as in U11.L07: the code carries its own swung `hats:` and `drums:` lines, and
// the drum track of `band.axis-4bar` would play straight hats against them.
import { type Degree, defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 108;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWING = ".swingBy(1/3, 4)";
/** The standard twelve bars (U11.L05). */
const FORM = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>";
const CHANGES = `const changes = "${FORM}"\n`;
const HATS = `hats: s("hh*8")${SWING}.gain(.5)`;
const DRUMS = 'drums: s("bd ~ sd ~")';
const BASS = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)';
const CHORDS = 'chords: chord(changes).voicing().s("piano").gain(.6)';
/** The call: C · E♭ F · G F · | G♭ F C ·, in bars 1–2 of every four (eighths, so the swing is heard). */
const CALL = "[0 ~ 1 2 ~ 4 2 ~] [3 2 0 ~]";
const call = (pattern: string) => `mel: n("${pattern}").scale("C3:blues")${SWING}.s("crunch")`;
const answer = (pattern: string) => `vox: n("${pattern}").scale("C4:blues")${SWING}.s("organ")`;
/** The rhythm section under every step: changes, hats, drums, bass, chords (STYLE §1 order). */
const piece = (...lines: string[]) => code(CHANGES, HATS, DRUMS, BASS, CHORDS, ...lines);

const CALLS = call(`<${CALL} ~ ~>`);
/** Three answers, one per line: each ends at home on C but the third, which climbs F G into the turnaround. */
const ANSWER_1 = "[~ 4 5 4 ~ 2 ~ ~] [1 ~ 0 ~]";
const ANSWER_2 = "[~ 5 ~ 4 3 4 ~ ~] [2 1 0 ~]";
const ANSWER_3 = "[~ 4 2 1 ~ 0 ~ ~] [~ ~ 2 4]";
const ANSWERS = answer(`<~ ~ ${ANSWER_1} ~ ~ ${ANSWER_2} ~ ~ ${ANSWER_3}>`);
const HOOK = piece(CALLS, ANSWERS);
const CALLS_ONLY = piece(CALLS);

/** S2: the call and one answer, four bars. */
const ONE_ANSWER = answer(`<~ ~ ${ANSWER_1}>`);
const PREDICT = piece(CALLS, ONE_ANSWER);

/** S4: the organ's bars 3–4 are the learner's; the answer repeats in every line. */
const answerIn = (bars34: string) => piece(CALLS, answer(`<~ ~ ${bars34}>`));
const ANSWER_STARTER = piece(CALLS, answer("<~ ~ ⟪~ ~⟫>"));
const ANSWER_SOLUTION = answerIn(ANSWER_1);

/**
 * S5: Oak's four-bar blues line in the shape of a sung blues line. The tune (piano) runs from bar 1 to the
 * first half of bar 3 and stops; the fill (organ) answers from beat 3 of bar 3 to the end of bar 4.
 */
const LINE = code(
  HATS,
  DRUMS,
  'bass: note("c2*4").s("ebass").lpf(600)',
  'chords: chord("C7").voicing().s("piano").gain(.5)',
  `mel: n("<[~ 4 4 5 4 ~ 2 ~] [1 ~ 0 ~ 1 2 ~ 1] [0@4 ~ ~ ~ ~] ~>").scale("C4:blues")${SWING}.s("piano")`,
  `vox: n("<~ ~ [~ ~ ~ ~ 4 5 6 5] [4 2 1 0 ~ ~ ~ ~]>").scale("C4:blues")${SWING}.s("organ")`,
);

/** S6: the call's first bar on its own, for singing back: do me fa sol. */
const ECHO = code(HATS, `mel: n("[0 ~ 1 2 ~ 4 ~ ~]").scale("C4:blues")${SWING}.s("piano")`);
const ECHO_DEGREES: Degree[] = ["1", "b3", "4", "5"];

/** The Make: three answers, but the guitar plays a new figure in every line, so nothing calls. */
const WANDERING = call(`<${CALL} ~ ~ [4 ~ 4 5 ~ 4 2 ~] [1 ~ ~ ~] ~ ~ [5 4 2 0 ~ 0 ~ ~] [2 3 4 ~] ~ ~>`);
const MAKE_STARTER = piece(WANDERING, ANSWERS);

const SHUFFLE = { subdivision: 8, amount: 1 / 3 } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U11.L08",
  version: 3,
  title: "Riffs & Response",
  objective: "I can write a blues riff that comes back in every line and answer it on another part.",
  key: { tonic: "C", mode: "blues" },
  meter: "4/4",
  bpm: BPM,
  swing: SHUFFLE,
  introduces: ["M08"],
  practises: ["M07"],
  terms: [],
  canDo: ["cd.compose.riff-response"],
  flavours: {
    "flavour.jazz-soul": {
      sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright", "snd.organ": "snd.rhodes" },
    },
  },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Call, then answer",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      example: { id: "hook", code: HOOK, bars: 12 },
      exercise: {
        kind: "listen",
        id: "call-then-answer",
        version: 1,
        role: "practice",
        prompt:
          "Listen to a twelve-bar shuffle in C twice: the guitar riff alone, then the same riff with the organ. Listen to the gap after each riff: how does the music feel with that space empty, and with it filled?",
        skills: [
          { skill: "M08", w: 0.5 },
          { skill: "M07", w: 0.5 },
        ],
        hints: null,
        tests: [],
        items: [
          { code: CALLS_ONLY, caption: "The riff alone. Listen to the room it leaves.", bars: 12 },
          { code: HOOK, caption: "The same riff, with the organ.", bars: 12 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "When does the organ play?",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "when-does-the-organ-play",
        version: 1,
        role: "practice",
        prompt:
          'The organ line is `n("<~ ~ [~ 4 5 4 ~ 2 ~ ~] [1 ~ 0 ~]>")`, and inside `< >` each entry lasts one bar. Predict when the organ plays. Pick one answer, then listen to check it.',
        skills: [{ skill: "M07", w: 1 }],
        hints: null,
        tests: [],
        code: PREDICT,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "after", label: "In bars 3 and 4 of every four, after the riff" },
          { id: "with", label: "In bars 1 and 2, with the riff" },
          { id: "once", label: "Only once, in bars 3 and 4, then never again" },
        ],
        correct: ["after"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "The riff stays",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: false, initialPanels: ["chords"] },
      example: { id: "riff-stays", code: HOOK, bars: 12 },
      exercise: {
        kind: "run-investigate",
        id: "the-riff-stays",
        version: 1,
        role: "practice",
        prompt:
          "Run the shuffle. Watch the guitar's notes on the roll when the chords move to IV7 in bar 5, and count its riffs. Then answer two questions: what the riff plays under IV7, and how many times it sounds in the twelve bars.",
        skills: [
          { skill: "M08", w: 0.6 },
          { skill: "F04", w: 0.4 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop the loop and compare bars 1–2 with bars 5–6 on the roll, note by note.",
        },
        hints: ladder(
          "Compare the guitar's notes in bars 1–2 with bars 5–6 on the roll. Does the `mel:` line know which chord is playing?",
          "The guitar's pattern has four entries, so it starts again every four bars, whatever the chords do.",
          "Twelve bars, a riff every four: count the lines of the blues.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Under IV7 in bar 5, what does the riff play?",
            options: [
              { id: "same", label: "The same notes as in bar 1" },
              { id: "moved", label: "The same shape, moved up to start on F" },
              { id: "new", label: "New notes from F7" },
            ],
            correct: ["same"],
          },
          { q: "number", prompt: "How many times does the riff sound in the twelve bars?", correct: 3 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["same"], number: 3 } }, expect: "pass" },
          {
            name: "heard it follow the chord",
            response: { answer: { choice: ["moved"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted the bars it plays in",
            response: { answer: { choice: ["same"], number: 6 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Answer the call",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      exercise: {
        kind: "code-modify",
        id: "answer-the-call",
        version: 1,
        role: "check",
        prompt:
          "Bars 3 and 4 of the organ line, the highlighted part, are empty. Write an answer there on the blues scale. Use at least three different notes, and make the last note home, C (degree 1).",
        skills: [
          { skill: "M07", w: 0.6 },
          { skill: "M08", w: 0.4 },
        ],
        code: { starter: ANSWER_STARTER },
        reference: { solutions: [ANSWER_SOLUTION], bars: 12 },
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "ends-home",
              label: "The organ answer ends on home, C (degree 1)",
              required: true,
              skills: ["M07"],
              rule: "ends-on-degree",
              degrees: ["1"],
              track: "vox",
            },
            {
              id: "blues-scale",
              label: "Every note of the organ answer is in the C blues scale",
              required: true,
              skills: ["M08"],
              rule: "in-key",
              key: { tonic: "C", mode: "blues" },
              minRatio: 1,
              tracks: ["vox"],
            },
            {
              id: "three-notes",
              label: "The organ answer uses at least three different notes",
              required: true,
              skills: ["M08"],
              rule: "distinct-pitches",
              track: "vox",
              min: 3,
            },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: false },
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The riff climbs from C and drops back. What could answer it from higher up?",
          "Bar 3 and bar 4 are one entry each: `[ ]` with eight slots for eighths, `~` for a rest. In `C4:blues`, `n` 0 is C, and 4 is G.",
          "Start bar 3 on a rest so the call has room, then come down: `[~ 4 5 4 ~ 2 ~ ~]`. Bar 4 still has to reach home.",
        ),
        tests: [
          { name: "reference", response: { code: ANSWER_SOLUTION }, expect: "pass" },
          {
            name: "another answer: down the scale and home",
            response: { code: answerIn("[5 ~ 4 ~ 2 1 ~ 0] [~ ~ 0 ~]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: answerIn("~ ~") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "ends on ♭3, up in the air",
            response: { code: answerIn("[~ 4 5 4 ~ 2 ~ ~] [0 ~ 1 ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one note, repeated",
            response: { code: answerIn("[0 ~ 0 ~ 0 ~ 0 ~] [0 ~ ~ ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the answer written over the call",
            response: { code: piece(CALLS, answer(`<${ANSWER_1} ~ ~>`)) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Where the answer starts",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "where-the-answer-starts",
        version: 1,
        role: "check",
        prompt:
          "Listen to one four-bar line of a blues: a tune on piano, then a fill on another instrument that answers it. Pick the bar where the answer begins.",
        skills: [
          { skill: "M07", w: 0.6 },
          { skill: "E07", w: 0.4 },
        ],
        hints: [
          { text: "Follow the tune first. Where does it stop?" },
          { text: "The tune is the piano; the answer is another instrument, higher and brighter." },
          { text: "Hear it again, slower, and count the bars out loud as it plays.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: LINE, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "bar-buttons", bars: 4 },
        correct: { number: 3 },
        feedbackText: {
          "id.wrong": "Bar {got} is not it. Find where the tune stops; the answer starts after it.",
        },
        srs: [
          { family: "fam.mel.dictation", mode: "review-if-due" },
          { family: "fam.rhy.swing", mode: "review-if-due" },
        ],
        tests: [
          { name: "bar 3", response: { answer: { number: 3 } }, expect: "pass" },
          {
            name: "bar 4: the tune's last note taken for the answer",
            response: { answer: { number: 4 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "bar 2: still the tune",
            response: { answer: { number: 2 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the call back",
      minutes: 1.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "sing",
        id: "sing-the-call-back",
        version: 1,
        role: "practice",
        prompt:
          "Hear the first bar of the riff, then sing it back, four notes: do, me, fa, sol. After that, sing an answer of your own over the hats. Only the four-note echo is checked.",
        skills: [
          { skill: "V05", w: 0.6 },
          { skill: "M07", w: 0.4 },
        ],
        hints: [
          { text: "The riff starts at home and climbs: four notes, the last one the highest." },
          { text: "Me is the blue third, a little lower than mi. Fa and sol follow by step." },
          { text: "Hear it again, slower, and hum it before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the four degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "echo",
        stimulus: { src: "code", code: ECHO, bars: 1, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ECHO_DEGREES },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Riff and response",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "riff-and-response",
        version: 1,
        role: "practice",
        prompt:
          "The guitar plays a new figure in every line, so nothing calls. Change the `mel:` line so one riff plays in bars 1–2 of every line, and keep the three organ answers different. Then make riff and answers your own. Done when the riff returns in bars 5–6 and 9–10.",
        skills: [
          { skill: "M08", w: 0.7 },
          { skill: "M07", w: 0.3 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [12, 24],
        saveAs: "sketch",
        rubric: [
          {
            id: "call-comes-back",
            label: "The riff of bars 1–2 comes back in bars 5–6 and 9–10, while the answers change",
            required: true,
            skills: ["M08"],
            rule: "motif-reuse",
            track: "@melody",
            unitBars: 2,
            minRatio: 0.3,
          },
          {
            id: "two-parts",
            label: "Two melody lines: one for the riff, one for the answers",
            required: false,
            skills: ["M07"],
            rule: "tracks",
            min: 2,
            roles: ["melody"],
          },
          {
            id: "blue-call",
            label: "The mel line plays the blue 3rd, ♭3 (E♭), at least once",
            required: false,
            skills: ["S11"],
            rule: "degree-set",
            track: "mel",
            contains: ["b3"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Only the `mel:` line needs to change. Which two bars of its first line should come back in the second and third lines?",
          "The guitar's pattern has twelve entries, a new figure every four bars. A pattern of four entries starts again every four bars.",
          "Keep the first four entries of the `mel:` pattern and delete the rest: the riff, its second bar and two bars of rest.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the call in every line", response: { code: HOOK }, expect: "pass" },
          {
            name: "beyond the brief: a minor pentatonic riff, new answers, two choruses",
            response: {
              code: code(
                `const changes = "<C7!4 F7!2 C7!2 G7 F7 C7 G7 C7!4 F7!2 C7!2 G7 F7 C7 C7>"\n`,
                HATS,
                DRUMS,
                BASS,
                CHORDS,
                'mel: n("<[4 ~ 3 2 ~ 1 0 ~] [~ 0 1 0 ~ ~ ~ ~] ~ ~>").scale("C3:minor:pentatonic").swingBy(1/3, 4).s("crunch")',
                answer(
                  "<~ ~ [~ 4 5 6 ~ 5 ~ ~] [4 ~ 0 ~] ~ ~ [~ 1 2 3 4 ~ ~ ~] [2 1 0 ~] ~ ~ [6 5 4 2 ~ 1 ~ ~] [0 ~ ~ ~]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            // The brief asks for answers that change: one answer repeated makes the chorus a 4-bar loop whose
            // one pass holds a single call and a single answer, so nothing comes back inside it.
            name: "the same answer in every line",
            response: { code: piece(CALLS, ONE_ANSWER) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the call only once, then two new figures in its place",
            response: {
              code: piece(
                call(`<${CALL} ~ ~ [5 ~ 5 4 ~ 5 4 2] [0 ~ ~ ~] ~ ~ [1 ~ 0 ~ ~ 1 0 ~] [4 ~ ~ ~] ~ ~>`),
                ANSWERS,
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
