// R1.L05 Displacement & Laid-Back Feel (spec: content/specs/R1.md). Displacement moves a whole figure to another
// place in the bar: the same three hits, an eighth later, lean on different beats and sound like a new rhythm. It
// is not the laid-back feel: a few milliseconds behind the beat (`.late(.01)` at 92 BPM is 26 ms) leaves the
// rhythm where it was and changes only how it sits. The lesson requires the first and compares the second
// (contracts 1.8, AUTHORING §20.6); AC2.S2 applies the laid-back snare.
//
// Written for the learner at the gate (AUTHORING §20.1): `.late()` and `.early()` are U13.L01's calls, used here
// with an amount patterned per bar (`"<0 .125>"`, decimals in the string: a fraction there moves nothing,
// `code.time-fraction-string`). `.late(x)` moves by x BARS, so milliseconds depend on the tempo (content-kit
// `lateMs`): at 92 BPM `.late(.125)` is 326 ms (an eighth), `.late(1/32)` 82 ms (heard as a new rhythm),
// `.late(.01)` 26 ms (a feel). `.nudge()` never unlocks (contracts §3.1 rule 8).
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: the cowbell's onsets in both bars (`contains` the moved places,
//   `excludes` the places it left), and in the Make `displaced-copy`, which finds a figure that comes back with
//   every onset moved by the same amount, the same sounds in the same rhythm (a silent line has no figure);
// - each graded step pins a WRONG answer that uses the right function: `.late(1)` (a whole bar: the figure lands
//   where it was), `.late(.25)` on every bar (moved, but nothing to compare it with), `.late(.008)` (a feel, not a
//   move), four even beats moved by a beat (the same rhythm), the right amounts at `.gain(0)`;
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, MICROTIMING_OPTIONS, type RubricRule } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Seconds per bar at the lesson's tempo. */
const BAR_SEC = 240 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const KICK = 'kick: s("bd ~ ~ ~ bd ~ ~ ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.4)';
/** Dm7 for two bars, Gm7 for two: degree 1, then degree 4 (`n` counts from 0, so degree 4 is `n` 3). */
const BASS = 'bass: n("<0 0 3 3>").struct("x ~ ~ x ~ ~ x ~").scale("D2:minor").s("fingerbass")';
const DRUMS = [KICK, SNARE, HATS];
/** The clav's figure: beat 1, beat 2 and the "and" of 2, on the eighth grid. */
const FIGURE = "x ~ x x ~ ~ ~ ~";
const keys = (tail = "") =>
  `keys: chord("<Dm7 Dm7 Gm7 Gm7>").voicing().struct("${FIGURE}")${tail}.s("clav").clip(.3)`;
const ON_THE_ONE = code(...DRUMS, BASS, keys());
const HOOK = code(...DRUMS, BASS, keys('.late("<0 .125>")'));

/** Seconds from the start of a tap stimulus: positions in bars (0-based, across bars). */
const at = (bars: number[]) => bars.map((b) => Math.round(b * BAR_SEC * 1000) / 1000);
const FIGURE_TAPS = at([
  0,
  1 / 4,
  3 / 8,
  1 + 1 / 8,
  1 + 3 / 8,
  1 + 1 / 2,
  2,
  2 + 1 / 4,
  2 + 3 / 8,
  3 + 1 / 8,
  3 + 3 / 8,
  3 + 1 / 2,
]);

/** S4: a cowbell figure, the same in every bar; the learner moves it a beat later in bar 2. */
const COWBELL = 's("cb ~ cb cb ~ ~ ~ ~")';
const BELL_STARTER = code(...DRUMS, BASS, `perc: ⟪${COWBELL}⟫`);
const bell = (line: string) => code(...DRUMS, BASS, `perc: ${line}`);
const BELL_SOLUTION = bell(`${COWBELL}.late("<0 .25>")`);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** Bar 1 as written; bar 2 a beat later: on beat 2, beat 3 and the "and" of 3, and not where it was. */
const BELL_RULE: RubricRule = {
  id: "bell-displaced",
  label: "Bar 1 hits on 1, 2 and the “and” after 2; bar 2 hits a beat later, on 2, 3 and the “and” after 3",
  required: true,
  skills: ["R15"],
  rule: "onsets",
  track: "perc",
  contains: [
    [0, 1],
    [1, 4],
    [3, 8],
    [5, 4],
    [3, 2],
    [13, 8],
  ],
  excludes: [
    [1, 1],
    [11, 8],
  ],
  perBar: false,
};

/** S5: the snare on the grid for two bars, then 26 ms behind it (`lateMs(.01, 92)`). */
const LEAN = code(KICK, 'snare: s("~ sd ~ sd").late("<0 0 .01 .01>")', HATS, BASS);

/** S6: the drums and the bass keep the bar; the clav plays its figure on the one in every bar. */
const MAKE_STARTER = ON_THE_ONE;
const make = (...lines: string[]) => code(...DRUMS, BASS, ...lines);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R1.L05",
  version: 4,
  title: "Displacement & Laid-Back Feel",
  objective:
    "I can move a figure to another place in the bar, and tell a moved rhythm from a groove that leans back.",
  key: { tonic: "D", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R15"],
  practises: [],
  terms: [
    { id: "term.displacement", step: "S3" },
    { id: "term.laid-back", step: "S5" },
  ],
  canDo: ["cd.code.displacement"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same figure, new place",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "moved", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "same-figure-new-place",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the clav's three short chords against the kick; the drums and the bass hold still. Notice in which bars the clav sounds like a new rhythm, and where its first chord lands in those bars.",
        skills: [{ skill: "R15", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: ON_THE_ONE,
            caption: "The clav's three chords, the same in every bar.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The same three chords. Which bars sound different?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the figure",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-figure",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the clav, the short clicking chords: three a bar. In some bars the figure starts later, so follow the clav, not the kick. Four bars, twelve taps in all. Done when each tap lands with a clav chord.",
        skills: [{ skill: "R15", w: 1 }],
        hints: ladder(
          "Follow the clav, not the kick: its first chord does not land in the same place in every bar.",
          "In bars 1 and 3 its first chord lands with the kick. In bars 2 and 4 it comes a little later.",
          "In bars 2 and 4 the whole figure is half a beat late, with the same gaps between its three chords.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "keys" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        tests: [
          { name: "the figure in both places", response: { taps: FIGURE_TAPS }, expect: "pass" },
          {
            name: "the figure on the one in every bar: bars 2 and 4 missed",
            response: {
              taps: at([
                0,
                1 / 4,
                3 / 8,
                1,
                1 + 1 / 4,
                1 + 3 / 8,
                2,
                2 + 1 / 4,
                2 + 3 / 8,
                3,
                3 + 1 / 4,
                3 + 3 / 8,
              ]),
            },
            expect: "fail",
          },
          {
            name: "quarter notes",
            response: { taps: at(Array.from({ length: 16 }, (_, i) => i / 4)) },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Read the move",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "read-the-move", code: HOOK, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-move",
        version: 1,
        role: "practice",
        prompt:
          "Run the groove and read bars 1 and 2 of the clav on the roll. The `.late()` on its line takes one amount per bar from the `< >`, in fractions of a bar. Then answer: where bar 2's first chord lands, and how many of its three chords fall on a beat.",
        skills: [{ skill: "R15", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Find the first chord of bar 2 on the roll and count in eighths from the bar line: 1 & 2 & 3 & 4 &.",
        },
        hints: ladder(
          "Read the second amount in `.late()`: it is bar 2's move, as a fraction of the bar.",
          "An eighth of a bar is half a beat. Count bar 2 in eighths, 1 & 2 & 3 & 4 &, and find each chord.",
          "In bar 1 the chords fall on 1, 2 and the “and” after 2. Move each one half a beat later.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "In bar 2, where does the figure's first chord land?",
            options: [
              { id: "one", label: "On the one" },
              { id: "and-of-1", label: "On the “and” of 1" },
              { id: "two", label: "On beat 2" },
            ],
            correct: ["and-of-1"],
          },
          {
            q: "number",
            prompt: "In bar 2, how many of the figure's three chords fall on a beat?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["and-of-1"], number: 1 } }, expect: "pass" },
          {
            name: "read as on the one",
            response: { answer: { choice: ["one"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "bar 1's count: two on a beat",
            response: { answer: { choice: ["and-of-1"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Move the cowbell",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "move-the-cowbell",
        version: 1,
        role: "check",
        prompt:
          "The cowbell plays the clav's figure: 1, 2 and the “and” after 2, every bar. Add one call to the cowbell line so bar 1 stays as it is and bar 2 plays the whole figure one beat later. Keep the rhythm string. Done when bar 2 hits on 2, 3 and the “and” after 3.",
        skills: [{ skill: "R15", w: 1 }],
        code: { starter: BELL_STARTER },
        reference: { solutions: [BELL_SOLUTION], bars: 2 },
        // Heard in both bars: bar 1 in its places, bar 2 on beat 2, beat 3 and the "and" of 3, and nothing left
        // on the one or the "and" of 2 of bar 2. A whole bar late, every bar moved, or a silent line all fail.
        matcher: { m: "rubric", rules: [BELL_RULE] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the target: bar 1 starts with the kick, and bar 2 starts a beat later, with the same gaps between the three hits.",
        },
        hints: ladder(
          "Use the call that moved the clav in the last step, with one amount per bar.",
          "The call that pushed lines in the core also moves them later, by a fraction of a bar; amounts written inside `< >` change bar by bar.",
          "Bar 1 moves by nothing. A beat is a quarter of a bar, and amounts in a string are written as decimals.",
        ),
        tests: [
          { name: "reference", response: { code: BELL_SOLUTION }, expect: "pass" },
          {
            name: "the second bar written out",
            response: { code: bell('s("<[cb ~ cb cb ~ ~ ~ ~] [~ ~ cb ~ cb cb ~ ~]>")') },
            expect: "pass",
          },
          {
            name: "the same move from the other side: three beats early",
            response: { code: bell(`${COWBELL}.early("<0 .75>")`) },
            expect: "pass",
          },
          {
            name: "softer, on another kit",
            response: { code: bell(`${COWBELL}.late("<0 .25>").bank("RolandTR808").gain(.6)`) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(BELL_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, a whole bar: .late(1) lands where it was",
            response: { code: bell(`${COWBELL}.late(1)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "every bar moved: nothing left where it was",
            response: { code: bell(`${COWBELL}.late(.25)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a fraction inside the string",
            response: { code: bell(`${COWBELL}.late("<0 1/4>")`) },
            expect: "fail",
            feedback: ["code.time-fraction-string"],
          },
          {
            name: "the right amounts, silent: .gain(0)",
            response: { code: bell(`${COWBELL}.late("<0 .25>").gain(0)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Ahead or behind",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "ahead-or-behind",
        version: 1,
        role: "practice",
        prompt:
          "Four bars. In bars 1 and 2 the snare lands exactly with the hi-hat on 2 and 4. In bars 3 and 4 it moves by a few milliseconds. Pick where it sits there.",
        skills: [{ skill: "R15", w: 1 }],
        hints: ladder(
          "Listen to beats 2 and 4 of bars 3 and 4: the snare and the hi-hat no longer sound as one hit.",
          "Two hits very close together: the hi-hat and the snare no longer start at the same moment. Which comes first?",
          "The hi-hat stays on the grid. Listen for which of the two you hear first on beat 2.",
        ),
        stimulus: { src: "code", code: LEAN, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "choice", options: [...MICROTIMING_OPTIONS] },
        correct: { choice: ["behind"] },
        feedbackText: {
          "id.wrong":
            "In bars 3 and 4 the snare comes 26 ms after the hi-hat it used to land with: behind the beat, by far too little to change the rhythm.",
        },
        tests: [
          { name: "behind", response: { answer: { choice: ["behind"] } }, expect: "pass" },
          {
            name: "ahead",
            response: { answer: { choice: ["ahead"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "on the beat",
            response: { answer: { choice: ["on"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your figure, moved",
      minutes: 2.75,
      // No Band: the figure is the lesson, and the drums and bass that keep the bar steady are in the starter.
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-make",
        id: "your-figure-moved",
        version: 1,
        role: "practice",
        title: "Figure, moved",
        prompt:
          "Write your own figure, two to four hits, on the clav or a percussion line. Required: it comes back in another bar moved to another place in the bar, an eighth, a beat or a dotted eighth later. Your loop then plays your song's lift. Also on the checklist: the snare a few milliseconds late, the bass on beat 1.",
        skills: [{ skill: "R15", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "figure-displaced",
            label: "A figure comes back in another bar, moved to another place in the bar",
            required: true,
            skills: ["R15"],
            rule: "custom",
            fn: "displaced-copy",
            params: { min: 1 },
          },
          {
            id: "snare-leans",
            label: "The snare lands a few milliseconds behind the beat",
            required: false,
            skills: ["R15"],
            rule: "custom",
            fn: "microtiming",
            params: { track: "snare", direction: "late" },
          },
          {
            id: "bass-on-one",
            label: "The bass plays on beat 1 of every bar",
            required: false,
            skills: ["R15"],
            rule: "onsets",
            track: "bass",
            contains: [[0, 1]],
            perBar: true,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Give the figure's line a different `.late()` amount in some bars, so it moves while its rhythm stays.",
          "Give the figure's line an amount per bar inside `< >`: nothing in some bars, a move in others. The rhythm itself stays as written.",
          "An eighth of a bar is half a beat, a quarter is a beat; keep the move a sixteenth or more, and less than a whole bar.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the clav an eighth later every other bar",
            response: { code: HOOK },
            expect: "pass",
          },
          {
            name: "a beat later every other bar",
            response: { code: make(keys('.late("<0 .25>")')) },
            expect: "pass",
          },
          {
            name: "a cowbell of its own, the moved bar written out",
            response: {
              code: make(keys(), 'perc: s("<[cb ~ ~ cb ~ ~ cb ~] [~ cb ~ ~ cb ~ ~ cb]>").gain(.7)'),
            },
            expect: "pass",
          },
          {
            name: "a rim figure a dotted eighth later every other bar",
            response: { code: make(keys(), 'perc: s("rim ~ rim ~ ~ ~ ~ ~").late("<0 .1875>").gain(.7)') },
            expect: "pass",
          },
          {
            name: "only bar 2 of four moved, the others on the one",
            response: { code: make(keys('.late("<0 .125 0 0>")')) },
            expect: "pass",
          },
          {
            name: "a cowbell over the clav, its bar 2 of four written out an eighth later",
            response: {
              code: make(
                keys(),
                'perc: s("<[cb ~ cb cb ~ ~ ~ ~] [~ cb ~ cb cb ~ ~ ~] [cb ~ cb cb ~ ~ ~ ~] [cb ~ cb cb ~ ~ ~ ~]>")',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: a dotted-eighth move in bar 4, the snare laid back, 88 BPM",
            response: {
              code: make(keys('.late("<0 0 0 .1875>")'))
                .replace(SNARE, 'snare: s("~ sd ~ sd").late(.008)')
                .replace(`setcpm(${BPM}/4)`, "setcpm(88/4)"),
            },
            expect: "pass",
          },
          {
            name: "the right function, a whole bar: .late(1) lands where it was",
            response: { code: make(keys(".late(1)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a feel, not a move: .late(.008) on every bar",
            response: { code: make(keys(".late(.008)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "four even beats moved by a beat: the same rhythm",
            response: { code: make(keys(), 'perc: s("cb*4").late("<0 .25>")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right amounts, silent: .gain(0)",
            response: { code: make(keys('.late("<0 .125>").gain(0)')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
