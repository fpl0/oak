// R2.L05 Polymeter & Implied Metric Modulation (spec: content/specs/R2.md). A pattern of three steps played at four
// steps a bar does not fit the bar: it crosses the bar line, drifts, and lines up with it again every three bars
// (`polymeterPeriodBars(3, 4)` = 3). That is a polymeter, `{bd ~ ~}%4` in mini-notation. Regrouping a steady pulse
// does something related: twelve even notes heard in threes, then in twos, make the beat seem to speed up while the
// bar stays exactly as long. That is a metric modulation, implied: the tempo line never changes.
//
// Written for the learner at the gate (AUTHORING §20.1): R2 opens after U13.CP and may be taken before R1 and with
// U14–U17 unfinished, so the lesson uses what U13.CP guarantees, R2's own words (odd meter, grouping, hemiola,
// polyrhythm) and its own unlock, `{ }%n` (`tb.mini.polymeter`). R1's words and R3's (clave, tresillo, Euclid) are
// not used. Felt, then coded, then read: the learner taps the drifting kick (S2) before reading it (S3).
//
// Evaluated (headless Strudel): `{bd ~ ~}%4` plays 0, 3/4, 3/2, 9/4, 3, … (a kick every three beats, on beat 1
// again at bar 4); `{bd ~ ~ ~}%4`, `{bd ~ ~}%3` and `{bd ~ ~}` play 0, 1, 2 (every bar the same); the bass
// `n("{0 ~ 4}%4")` plays D at 0, A at 1/2, D at 3/4, A at 5/4, …, so every D lands with the kick;
// `<[bd ~ ~]*4 [bd ~]*6>` over `hh*12` plays a kick every quarter note, then every sixth of the bar.
//
// No Band (contracts §6.6 for R2.L05): the line that keeps the bar and the line that drifts are both the learner's.
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: the kick's onsets across three bars (`onsets` with `perBar: false`,
//   `contains` and `excludes`); the Make's `polymeter-cycle` reads the cycle the kick really plays (its period on
//   the bar grid) and the snare keeping the bar; a silent line or one 30 dB under the rest is dropped;
// - each graded step pins a WRONG answer that uses the right function: `{bd ~ ~ ~}%4` (a four-step cycle at four a
//   bar is the bar), `{bd ~ ~}%3`, `{bd ~ ~}` without `%`, the drift at `.gain(0)`; in the Make also a five-step
//   cycle on the snare that should keep the bar;
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type Rat, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One bar of 4/4 at 100 BPM: 2.4 seconds. */
const BAR_SEC = (4 * 60) / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the groove: snare and hats keep the bar, the kick and the bass drift ---------------------------------------

const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.4)';
/** D minor, one chord: Dm7 on beat 1 of every bar. */
const CHORDS = 'chords: chord("Dm7").voicing().struct("x ~ ~ ~").s("rhodes").gain(.5)';
const kick = (pattern: string, tail = "") => `kick: s("${pattern}")${tail}`;
/** The bass: degree 1 (D, `n` 0) and degree 5 (A, `n` 4). */
const bass = (pattern: string) => `bass: n("${pattern}").scale("D2:minor").s("fingerbass")`;
const DRIFT = "{bd ~ ~}%4";
const BASS_DRIFT = bass("{0 ~ 4}%4");

/** The hook: kick and bass on a three-step cycle at four steps a bar. */
const HOOK = code(kick(DRIFT), SNARE, HATS, BASS_DRIFT, CHORDS);
/** The same groove with everything in the bar: kick on 1 and 3, the bass D and A. */
const IN_THE_BAR = code(kick("bd ~ bd ~"), SNARE, HATS, bass("0 ~ 4 ~"), CHORDS);

// --- S2: tap the drifting kick --------------------------------------------------------------------------------------

/** Seconds from the start of the stimulus of the given beats (0-based quarter notes from bar 1 beat 1). */
const at = (beats: number[]) => beats.map((b) => Math.round(((b * BAR_SEC) / 4) * 1000) / 1000);
const range = (n: number, step: number, offsets: number[] = [0]) =>
  Array.from({ length: n }, (_, i) => i * step).flatMap((x) => offsets.map((o) => x + o));

// --- S4: from the bar to the cycle -----------------------------------------------------------------------------------

const S4_STARTER = code('kick: ⟪s("bd ~ ~ ~")⟫', SNARE, HATS, BASS_DRIFT, CHORDS);
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const s4 = (kickLine: string) => code(kickLine, SNARE, HATS, BASS_DRIFT, CHORDS);
const S4_SOLUTION = s4(kick(DRIFT));

/** The kick every three beats, across three bars, and none on beat 1 of bars 2 and 3. */
const DRIFT_ONSETS: Rat[] = [
  [0, 1],
  [3, 4],
  [3, 2],
  [9, 4],
];
const KICK_DRIFTS: RubricRule = {
  id: "kick-drifts",
  label:
    "The kick plays every three beats across the bar line: beat 1 of bar 1, then not on beat 1 again until bar 4",
  required: true,
  skills: ["R17"],
  rule: "onsets",
  track: "kick",
  contains: DRIFT_ONSETS,
  excludes: [
    [1, 1],
    [2, 1],
  ],
  perBar: false,
};

// --- S5: the same pulse, a new grouping -----------------------------------------------------------------------------

const REGROUP = code(
  'kick: s("<[bd ~ ~]*4 [bd ~]*6>")',
  'hats: s("hh*12").gain(.4)',
  'chords: chord("Dm7").voicing().s("rhodes").gain(.4)',
);

// --- S6: the Make -----------------------------------------------------------------------------------------------

const MAKE_STARTER = code(kick("bd ~ ~ ~"), SNARE, HATS, bass("0 ~ 4 ~"), CHORDS);
const make = (kickLine: string, ...rest: string[]) =>
  code(kickLine, ...(rest.length ? rest : [SNARE, HATS, bass("0 ~ 4 ~"), CHORDS]));
/** The Make's one rule: the kick's cycle is not a bar long and comes round to the bar again; the snare keeps it. */
const KICK_CYCLE: RubricRule = {
  id: "kick-cycle",
  label:
    "The kick's cycle crosses the bar line and meets beat 1 again a few bars later, while the snare keeps the bar",
  required: true,
  skills: ["R17"],
  rule: "custom",
  fn: "polymeter-cycle",
  // `alsoUses`: the drift heard and written with `{ }%n`, the lesson's one new tool. A kick written bar by bar as a
  // two-bar figure (`<bd ~>`) comes round every two bars without ever crossing the bar line, and the rule alone
  // passes it (apiNotes of build:author:R2c); the tool keeps it out.
  params: { a: "kick", b: "snare", alsoUses: ["tb.mini.polymeter"] },
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R2.L05",
  version: 4,
  title: "Polymeter & Implied Metric Modulation",
  objective:
    "I can write a part whose cycle is not a bar long, so it drifts and meets the bar again, and hear a beat seem to change speed while the bar stays the same.",
  key: { tonic: "D", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R17"],
  terms: [
    { id: "term.polymeter", step: "S3" },
    { id: "term.metric-modulation", step: "S5" },
  ],
  canDo: ["cd.code.polymeter"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A kick that wanders",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "drift", code: HOOK, bars: 6 },
      exercise: {
        kind: "listen",
        id: "a-kick-that-wanders",
        version: 1,
        role: "practice",
        prompt:
          "Count 1 to 4 under your breath in both loops; the snare and the hi-hat mark the same bar. Notice whether the second loop's kick lands in the same place in every bar, and whether it comes back to beat 1.",
        skills: [{ skill: "R17", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: IN_THE_BAR, caption: "The kick on beats 1 and 3, the same in every bar.", bars: 2 },
          {
            code: HOOK,
            caption: "The kick and the bass change. Count each bar from 1.",
            bars: 6,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the wandering kick",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-wandering-kick",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the kick, the low thud, not with the snare. It comes every three beats, so it lands in a different place in each bar. Six bars, eight taps in all. Done when each tap lands with a kick.",
        skills: [{ skill: "R17", w: 1 }],
        hints: ladder(
          "Follow the kick, not the bar: count the beats from one kick to the next.",
          "Count 1-2-3 from each kick. The kick does not wait for the bar line: it comes back after the same number of beats every time.",
          "Your taps are evenly spaced, and slower than the snare. Only every third bar do they fall on beat 1.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 6, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 6,
        target: { track: "kick" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A kick went by without a tap. Count 1-2-3 from each kick to find the next.",
          "tap.extra":
            "A tap landed where the kick is quiet: it comes back after three beats, wherever the bar is.",
        },
        tests: [
          { name: "with the kick: every three beats", response: { taps: at(range(8, 3)) }, expect: "pass" },
          { name: "on beats 1 and 3 of every bar", response: { taps: at(range(12, 2)) }, expect: "fail" },
          { name: "on every beat", response: { taps: at(range(24, 1)) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Back on the one",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "drift-read", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "back-on-the-one",
        version: 1,
        role: "practice",
        prompt:
          "Run the groove and read four bars on the roll. The kick's string has three steps inside curly brackets, then `%4`. Then answer: after how many bars the kick lands on beat 1 again, and why.",
        skills: [{ skill: "R17", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Follow the kick along the roll from bar 1 and find the next bar that starts with one.",
        },
        hints: ladder(
          "Follow the kick along the roll from bar 1 to the next kick that sits on a bar line.",
          "`%4` plays four steps of the brackets in every bar, and the brackets hold three. Bar 2 starts on the cycle's second step.",
          "Count the steps: bar 1 ends after four, bar 2 after eight. Which bar ends on a whole number of three-step cycles?",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "After how many bars does the kick land on beat 1 again?", correct: 3 },
          {
            q: "choice",
            prompt: "Why then?",
            options: [
              { id: "cycle", label: "Three steps at four a bar line up with the bar every three bars" },
              { id: "slower", label: "The kick slows down" },
              { id: "longer", label: "The bar gets longer" },
            ],
            correct: ["cycle"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["cycle"] } }, expect: "pass" },
          {
            name: "four: the bar's beats",
            response: { answer: { number: 4, choice: ["cycle"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "heard as the kick slowing down",
            response: { answer: { number: 3, choice: ["slower"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Let the kick drift",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "let-the-kick-drift",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the kick's string so it drifts with the bass: a cycle of three steps in curly brackets, played at four steps a bar, like the bass's. Keep the other lines. Done when the kick comes every three beats and meets beat 1 again after three bars.",
        skills: [{ skill: "R17", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        // Heard, across three bars as one figure: a kick every three beats and none on beat 1 of bars 2 and 3. A
        // cycle that fits the bar (four steps at four, three at three, the brackets without `%`) and a silent kick
        // all fail.
        matcher: { m: "rubric", rules: [KICK_DRIFTS] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the target for three bars and count the beats from one kick to the next.",
        },
        hints: ladder(
          "Count the beats between two kicks in the target.",
          "Look at the bass's string: curly brackets around its steps, then `%` and the number of steps played in each bar.",
          "Inside the brackets: one kick, and enough rests to make the cycle as long as the bass's. After the `%`: the steps in one bar.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "the kick in brackets: {[bd] ~ ~}%4",
            response: { code: s4(kick("{[bd] ~ ~}%4")) },
            expect: "pass",
          },
          {
            name: "three bars written out",
            response: { code: s4(kick("<[bd ~ ~ bd] [~ ~ bd ~] [~ bd ~ ~]>")) },
            expect: "pass",
          },
          { name: "a softer kick", response: { code: s4(kick(DRIFT, ".gain(.8)")) }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "four steps at four a bar: {bd ~ ~ ~}%4 is the bar",
            response: { code: s4(kick("{bd ~ ~ ~}%4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "three steps at three a bar: {bd ~ ~}%3",
            response: { code: s4(kick("{bd ~ ~}%3")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the brackets without %: {bd ~ ~}",
            response: { code: s4(kick("{bd ~ ~}")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right drift, silent: .gain(0)",
            response: { code: s4(kick(DRIFT, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Faster, or not",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "faster-or-not",
        version: 1,
        role: "practice",
        prompt:
          "The hi-hat plays twelve even notes a bar the whole time. For one bar the kick groups them in threes, for the next in twos, and round again. When the kick changes, pick what changed.",
        skills: [{ skill: "R17", w: 1 }],
        hints: ladder(
          "Count the hi-hat notes in a bar before the kick changes and after it.",
          "Count the hi-hat notes in a bar before the change and after it.",
          "The kick picks every third hi-hat note, then every second. Which of the three answers is about the kick, and which about the whole loop?",
        ),
        stimulus: { src: "code", code: REGROUP, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "beat-faster", label: "The beat seems faster, and the bar is just as long" },
            { id: "tempo-up", label: "The tempo went up" },
            { id: "bar-shorter", label: "The bar got shorter" },
          ],
        },
        correct: { choice: ["beat-faster"] },
        feedbackText: {
          "id.wrong":
            "Not that one. At 100 beats a minute a bar of four beats lasts 2.4 seconds. Count the twelve hi-hat notes of a bar on each side of the change.",
        },
        tests: [
          {
            name: "the beat seems faster",
            response: { answer: { choice: ["beat-faster"] } },
            expect: "pass",
          },
          {
            name: "heard as a tempo change",
            response: { answer: { choice: ["tempo-up"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your drift",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-make",
        id: "your-drift",
        version: 1,
        role: "practice",
        title: "Drift",
        prompt:
          "Rewrite the kick's string as a cycle in curly brackets of three or five steps at four a bar (`%4`), so it crosses the bar line and meets beat 1 again a few bars later. Keep the snare and hi-hat as they are: they keep the bar. Your loop then plays the bridge and the ending of your song.",
        skills: [{ skill: "R17", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          KICK_CYCLE,
          {
            id: "bass-drifts",
            label: "The bass runs its own cycle across the bar line too",
            required: false,
            skills: ["R17"],
            rule: "custom",
            fn: "polymeter-cycle",
            params: { a: "bass", b: "snare" },
          },
          {
            id: "tempo-for-drift",
            label: "`setcpm` sets a tempo between 90 and 130 beats a minute",
            required: false,
            skills: ["R17"],
            rule: "tempo-bpm",
            min: 90,
            max: 130,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Rewrite the kick's string as a cycle in curly brackets that does not fill a whole bar.",
          "A cycle drifts when it neither fits a whole number of times into a bar nor fills a whole number of bars, as the three steps at four a bar of step 4 do.",
          "Keep `%4`; inside the brackets write one kick and rests, three or five steps in all.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: three steps at four", response: { code: make(kick(DRIFT)) }, expect: "pass" },
          { name: "five steps at four", response: { code: make(kick("{bd ~ ~ ~ ~}%4")) }, expect: "pass" },
          {
            name: "six eighths at eight a bar",
            response: { code: make(kick("{bd ~ ~ bd ~ ~}%8")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the bass drifts with the kick, a five-note tune drifts over them, slower",
            response: {
              code: make(
                kick(DRIFT),
                SNARE,
                HATS,
                BASS_DRIFT,
                CHORDS,
                'mel: n("{4 2 0 2 1}%4").scale("D4:minor").s("piano").gain(.6)',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(92/4)"),
            },
            expect: "pass",
          },
          {
            name: "four steps at four a bar: {bd ~ ~ ~}%4 is the bar",
            response: { code: make(kick("{bd ~ ~ ~}%4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "three steps at three a bar: {bd ~ ~}%3",
            response: { code: make(kick("{bd ~ ~}%3")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the drift, silent: .gain(0)",
            response: { code: make(kick(DRIFT, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the drift 30 dB under the snare: masked",
            response: { code: make(kick(DRIFT, ".gain(.03)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "eight steps at four a bar: {bd ~ ~ ~ ~ ~ ~ ~}%4, a two-bar figure in curly brackets",
            response: { code: make(kick("{bd ~ ~ ~ ~ ~ ~ ~}%4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a two-bar figure that never crosses the bar line: <bd ~>",
            response: { code: make(kick("<bd ~>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the drift written out bar by bar, without curly brackets: the brief asks for them",
            response: { code: make(kick("<[bd ~ ~ bd] [~ ~ bd ~] [~ bd ~ ~]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the snare drifts as well: nothing keeps the bar",
            response: {
              code: make(kick(DRIFT), 'snare: s("{~ sd ~ ~ ~}%4")', HATS, bass("0 ~ 4 ~"), CHORDS),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
