// U06.L08 Harmonic Rhythm. How often the chords change sets the pace of a song: one chord a bar is
// relaxed, two a bar pushes forward, and changes that speed up just before the end drive the phrase home.
// In code two chords share a bar the way two hits share a beat: `[5 3]` is vi for half a bar, then IV. The
// roots come first and the stack is added to them, `n("<0 4 [5 3] [1 4]>").add(n("[0,2,4]"))`, because
// `.add()` keeps the rhythm of the pattern it is called on: the unit's usual stack-first form,
// `n("[0,2,4]").add(n("<0 4 [5 3] …>"))`, plays one chord a bar and drops the second root of a bracket
// (evaluated; the spec's hook was written that way and is corrected here). What the learner has: `[ ]` to fit several steps into one slot (U01.L04), the seven
// triads and `.add(n(…))` (U06.L01), Roman numerals (U06.L02), the three jobs (U06.L03), cadences
// (U06.L04, U06.L06, U06.L07) and the loops songs share (U06.L06–L07). Not yet: whole loops taken down in
// stages (U06.L09), the rhythm of each chord's hits with `.struct()` (U06.L12). Spec: content/specs/U06.md.
//
// Shapes: the changes are graded as chords per onset (`pcset` with the bass), so a bar of `[5 3]` must
// place vi and IV at half a bar each. "Which bars hold two chords?" is a multiple `choice` of the four bars
// (`bar-buttons` takes one bar per answer). The Make's one required rule is `chords-per-bar`, which reads
// the brief as written: at least one bar with one chord, at least one with two, none with more (review finding
// theory-d 3: the average of `harmonic-rhythm`, 1.25–2 changes a bar, failed the hint's own `<0 5 1 [4 0]>`).
import { type Choice, defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/**
 * Triads on the roots of `roots` (n values; `[a b]` puts two in one bar). The roots lead and the stack is
 * added to each of them, so the roots' rhythm is the chords' rhythm.
 */
const triads = (roots: string, sound = "piano", extra = "") =>
  `chords: n("${roots}").add(n("[0,2,4]")).scale("C3:major").s("${sound}")${extra}`;
/** The stack-first form of U06.L01: `.add()` keeps the stack's rhythm, one chord a bar. */
const stackFirst = (roots: string) => `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("piano")`;
/** A bass on the same roots, under the chords. */
const bass = (roots: string) => `bass: n("${roots}").scale("C2:major").s("ebass").lpf(600)`;
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
/** Bass and chords on the same roots. */
const loop = (roots: string) => code(bass(roots), triads(roots));

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Four bars of the four-chord loop, one chord a bar; then I V, vi IV, ii V, two a bar, and home. */
const HOOK_ROOTS = "<0 4 5 3 [0 4] [5 3] [1 4] 0>";
const HOOK = loop(HOOK_ROOTS);
/** S2: two chords in each of two bars: I IV, then V I. */
const TWO_A_BAR = loop("<[0 3] [4 0]>");

/** S4: I V, then bars 3 and 4 hold vi IV and ii V. */
const PUSH = "<0 4 [5 3] [1 4]>";
const PUSH_STARTER = code(triads("<0 4 ⟪5 1⟫>"));
const push = (roots: string) => code(triads(roots));

/** S5: the same eight bars twice. The second doubles its changes in the last two bars and lands home. */
const OPENING = "<0 5 3 4>";
const STEADY = "<0 5 3 4 0 5 3 4>";
const DRIVING = "<0 5 3 4 0 5 [3 1] [4 0]>";

/** S6: I, IV V, vi, ii V: two chords in bars 2 and 4. */
const HIDDEN = "<0 [3 4] 5 [1 4]>";
const BARS: Choice[] = [1, 2, 3, 4].map((b) => ({ id: `bar-${b}`, label: `Bar ${b}` }));

/**
 * S8 (Oak 2.0 W2; DeSantis, "Harmonic Rhythm"): the chords' pace is not the tune's. Eight bars of I V and vi IV,
 * two chords a bar, under a tune of eighth notes; the breakdown in bars 5 to 8 halves the chords' pace and keeps the
 * tune. The tune is G E C E and A G E C (evaluated: beats 1 and 3 are chord notes at the fast pace; under the slow
 * chords bar 6 puts A and E over G and bar 8 E over F, all eighth notes, so nothing is held a beat a half step from a
 * chord note). Graded on what is heard: the tune unchanged (`events` on
 * `mel`), the target's chords per onset (`pcset`), and one chord in each of bars 5 to 8 (`chords-per-bar` on those
 * bars). Fidelity pins: content/validate/pins/U06.L08.ts.
 */
const BUSY = "<[4 2 0 2 4 2 0 2] [5 4 2 0 5 4 2 0]>";
const TWICE = "[0 4] [5 3] [0 4] [5 3]";
const breakdown = (bars5to8: string, tune = mel(BUSY)) => code(triads(`<${TWICE} ${bars5to8}>`), tune);
const BREAKDOWN = breakdown("0 4 5 3");
const BREAKDOWN_STARTER = breakdown(TWICE);

/** The Make: I vi ii V, one chord a bar. */
const MAKE_STARTER = code(triads("<0 5 1 4>"));

/** The Band's drums only: the learner's chords and their pace are the point. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U06.L08",
  version: 5,
  title: "Harmonic Rhythm",
  objective:
    "I can set the pace of a song by changing chords once or twice a bar, and speed up the changes to drive a phrase home.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H06"],
  practises: [],
  terms: [{ id: "term.harmonic-rhythm", step: "S3" }],
  canDo: ["cd.compose.harmonic-rhythm"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same tempo, faster",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "same-tempo-faster",
        version: 1,
        role: "practice",
        prompt:
          "Eight bars, and the tempo never changes. Listen for whether the second half relaxes, holds steady or seems to hurry.",
        skills: [{ skill: "H06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "The four-chord loop, then four bars more. Feel the second half.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Two in a bar",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "two-a-bar", code: TWO_A_BAR, bars: 2 },
      exercise: {
        kind: "predict",
        id: "two-in-a-bar",
        version: 1,
        role: "practice",
        prompt:
          '`n("<[0 3] [4 0]>")` holds the roots, the stack is added to each of them, and each `< >` item is one bar. Predict how many chords each bar holds, and pick it.',
        skills: [{ skill: "H06", w: 1 }],
        hints: null,
        tests: [],
        code: TWO_A_BAR,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "one", label: "One: the brackets play as a single chord" },
          { id: "two", label: "Two, half a bar each" },
          { id: "four", label: "Four, one on every beat" },
        ],
        correct: ["two"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where it speeds up",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook-again", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "where-it-speeds-up",
        version: 1,
        role: "practice",
        prompt:
          "Run the hook again, with the numerals under the roll, and watch how often they change. The roots come first, as in the last step. Then answer both questions below.",
        skills: [{ skill: "H06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the numerals under each bar of the roll, and read the brackets in the roots.",
        },
        hints: ladder(
          "Look for bars where a new numeral appears halfway through.",
          "Each `[ ]` in the roots squeezes two of them into one bar, as `[ ]` squeezes two hits into one beat.",
          "Bar 5 is `[0 4]`. Count its chords, then look for the other brackets.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many chords does bar 5 hold?",
            correct: 2,
          },
          {
            q: "choice",
            prompt: "Which half of the hook changes chords faster?",
            options: [
              { id: "first", label: "The first four bars" },
              { id: "second", label: "The last four bars" },
              { id: "same", label: "Neither: the tempo is the same" },
            ],
            correct: ["second"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 2, choice: ["second"] } }, expect: "pass" },
          {
            name: "the tempo taken for the pace",
            response: { answer: { number: 2, choice: ["same"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the bracket counted as one chord",
            response: { answer: { number: 1, choice: ["second"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Speed up the ending",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "speed-up-the-ending",
        version: 1,
        role: "check",
        prompt:
          "In the target, bars 3 and 4 each hold two chords, half a bar each: vi then IV in bar 3, ii then V in bar 4. Write them into the last two items of the roots pattern.",
        skills: [{ skill: "H06", w: 1 }],
        code: { starter: PUSH_STARTER },
        reference: { solutions: [push(PUSH)], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Two chords in one bar go in brackets, and `n` counts from 0.",
        },
        hints: ladder(
          "Two hits fit into one beat with brackets. Two chords fit into one bar the same way.",
          "Each `< >` item of the roots is a bar. Brackets around two roots put two chords in that bar, half a bar each.",
          "Bar 3 already starts on vi, the 5. Put it in brackets with the root of IV after it.",
        ),
        tests: [
          { name: "reference", response: { code: push(PUSH) }, expect: "pass" },
          { name: "V an octave lower", response: { code: push("<0 4 [5 3] [1 -3]>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: push("<0 4 5 1>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the four chords without brackets: six bars of one chord",
            response: { code: push("<0 4 5 3 1 4>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "ii IV for vi IV",
            response: { code: push("<0 4 [1 3] [1 4]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Which one drives?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-drives",
        version: 1,
        role: "practice",
        prompt:
          "The opening of a loop plays, then two cards that play all eight bars: same tempo, same chords until bar 7. Pick the card that pushes into its ending.",
        skills: [{ skill: "H06", w: 1 }],
        hints: ladder(
          "Listen to the last two bars of each card and count how often the chords change.",
          "One card changes chord once a bar all the way; the other changes twice a bar at the end.",
          "Card A keeps one chord a bar to the end. Listen to bars 7 and 8 of card B.",
        ),
        stimulus: { src: "code", code: loop(OPENING), bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "steady", label: "Card A", audio: loop(STEADY) },
            { id: "driving", label: "Card B", audio: loop(DRIVING) },
          ],
        },
        correct: { choice: ["driving"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "Card B is the one: its last two bars change chord twice each, IV ii and V I. Card A keeps one chord a bar. Play both again.",
        },
        tests: [
          { name: "card B", response: { answer: { choice: ["driving"] } }, expect: "pass" },
          {
            name: "card A",
            response: { answer: { choice: ["steady"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Count the changes",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "count-the-changes",
        version: 1,
        role: "check",
        prompt:
          "A four-bar loop of chords and bass plays, with the code hidden. Pick every bar that holds two chords.",
        skills: [{ skill: "H06", w: 1 }],
        hints: ladder(
          "Follow the bass and listen for bars where it moves halfway through.",
          "A bar with one chord holds its bass note for the whole bar; a bar with two moves on beat 3.",
          "Bar 1 holds one chord. Listen to bar 2 again, then to the last bar.",
        ),
        stimulus: { src: "code", code: loop(HIDDEN), bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "choice", multi: true, options: BARS },
        correct: { choice: ["bar-2", "bar-4"] },
        feedbackText: {
          "id.wrong": "Not quite. Listen for the bass: in a bar with two chords it moves on beat 3.",
        },
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        tests: [
          { name: "bars 2 and 4", response: { answer: { choice: ["bar-2", "bar-4"] } }, expect: "pass" },
          {
            name: "picked in the other order",
            response: { answer: { choice: ["bar-4", "bar-2"] } },
            expect: "pass",
          },
          {
            name: "bar 3, which holds one chord",
            response: { answer: { choice: ["bar-2", "bar-3"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "bar 4 missed",
            response: { answer: { choice: ["bar-2"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "modify",
      title: "Busy notes, slow chords",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "busy-notes-slow-chords",
        version: 1,
        role: "check",
        prompt:
          "Bars 5 to 8 are the breakdown. Slow the chords there to half their pace: the same four chords in the same order, I, V, vi, IV, one a bar. Keep the tune and bars 1 to 4 as they are. Done when bars 5 to 8 hold one chord each and the tune still plays eighth notes.",
        skills: [{ skill: "H06", w: 1 }],
        code: { starter: BREAKDOWN_STARTER },
        reference: { solutions: [BREAKDOWN], bars: 8 },
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
            { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
            {
              m: "rubric",
              rules: [
                {
                  id: "breakdown-one-a-bar",
                  label: "Bars 5 to 8 each hold one chord",
                  required: true,
                  skills: ["H06"],
                  rule: "custom",
                  fn: "chords-per-bar",
                  params: { one: 4, max: 1, harmony: "chords" },
                  section: { bars: [5, 8] },
                },
              ],
            },
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. In bars 5 to 8 the four chords keep their order, one a bar.",
          "rubric.unmet": "{label}: not yet. Each of the last four items of the roots pattern is one bar.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: the tune lost its note {exp}. Keep `mel` as it is; only the chords slow down.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the tune has {got} where it had {exp}. Keep `mel` as it is; only the chords slow down.",
        },
        hints: ladder(
          "In bars 1 to 4 the chords change twice a bar. How many times a bar should they change in bars 5 to 8?",
          "Each `< >` item of the roots is a bar, and brackets put two chords in it. Bars 5 to 8 are the last four items.",
          "Bar 5 becomes I alone: its item is a single number, no brackets. Then V, vi and IV, one item each.",
        ),
        tests: [
          { name: "reference", response: { code: BREAKDOWN }, expect: "pass" },
          {
            name: "each bracket stretched over two bars with @2",
            response: { code: breakdown("[0 4]@2 [5 3]@2") },
            expect: "pass",
          },
          { name: "V an octave lower", response: { code: breakdown("0 -3 5 3") }, expect: "pass" },
          {
            name: "the chords by name",
            response: {
              code: code(
                'chords: chord("<[C G] [Am F] [C G] [Am F] C G Am F>").voicing().s("piano")',
                mel(BUSY),
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: BREAKDOWN_STARTER },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "one chord a bar, but only the first of each pair",
            response: { code: breakdown("0 5 0 5") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the tune slowed with the chords",
            response: { code: breakdown("0 4 5 3", mel(BUSY).replace(".scale(", ".slow(2).scale(")) },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Set the pace",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "set-the-pace",
        version: 1,
        role: "practice",
        prompt:
          "The starter changes chord once a bar. Set the pace for the four bars that climb into your song's second loud part: put two chords, in brackets, in at least one bar, and keep one chord in at least one other. Done when some bars hold one chord and some hold two.",
        skills: [{ skill: "H06", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "some-bars-twice",
            label: "At least one bar with one chord and one with two, never more than two",
            required: true,
            skills: ["H06"],
            rule: "custom",
            fn: "chords-per-bar",
            params: { one: 1, two: 1, max: 2 },
          },
          {
            id: "ends-home",
            label: "The last two chords go home: IV to I, or V to I",
            required: false,
            skills: ["H03"],
            rule: "cadence",
            types: ["PAC", "IAC", "PC"],
            at: "last",
          },
          {
            id: "a-bass",
            label: "A bass line on its own line, such as `bass`",
            required: false,
            skills: ["H06"],
            rule: "tracks",
            min: 1,
            roles: ["bass"],
          },
        ],
        hints: ladder(
          "Pick the bars to hurry; the last ones push hardest. Each of them needs two chords.",
          "Brackets in the roots put two chords in one bar, half a bar each. Keep the roots first: `.add()` keeps the rhythm of the pattern before it.",
          "Turn bar 4 into two chords: V for half a bar, then home. Brackets and two numbers.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: two chords in bars 3 and 4",
            response: { code: code(triads("<0 5 [3 1] [4 0]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars on a Rhodes, a bass, a tune",
            response: {
              code: code(
                bass(HOOK_ROOTS),
                triads(HOOK_ROOTS, "rhodes", ".gain(.6)"),
                mel("<[4 ~ 2 ~] [4 ~ 6 ~] [5 ~ 7 ~] [5 ~ 3 ~] [7 ~ 6 ~] [7 ~ 5 ~] [5 ~ 6 ~] [7 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            // Review finding (theory-d 3): the hint's own answer, bar 4 as V then home.
            name: "the hint: bar 4 turned into V, then home",
            response: { code: code(triads("<0 5 1 [4 0]>")) },
            expect: "pass",
          },
          {
            // Review finding (theory-d 3): eight bars, seven of one chord and one of two.
            name: "eight bars, two chords only in the last",
            response: { code: code(triads("<0 5 1 4 0 5 3 [1 4]>")) },
            expect: "pass",
          },
          {
            name: "two chords in every bar: no bar of one",
            response: { code: code(triads("<[0 5] [3 4] [0 5] [1 4]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the stack first: the brackets fold into one chord a bar",
            response: { code: code(stackFirst("<0 5 [3 1] [4 0]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a chord on every beat: too fast",
            response: { code: code(triads("<[0 5 3 4] [0 5 1 4] [0 5 3 4] [1 4 0 4]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
