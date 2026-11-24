// U08.L04 Lock with the Kick. A bass and a kick drum that share one rhythm sound like one instrument: the groove
// locks. In code the rhythm is named once, `const hits = "x ~ ~ x ~ ~ x ~"`, and both lines take it with
// `.struct(hits)`; change `hits` and the kick and the bass move together. A hit between the beats (here the
// "and" of 2) pushes the groove forward. `const` unlocks here (`tb.const`). What the learner has: one labelled
// line per drum (U01.L03), eighths and the "and" (U01.L04), `.struct()` laying a part onto a rhythm (U06.L12),
// root bass lines in degrees (U08.L01), root, 5th and octave (U08.L02), approach notes (U08.L03). Not yet: the
// word for hits between the beats (U13.L01), section consts and `arrange()` (U09.L02), the bass's tone
// (U08.L05). Spec: content/specs/U08.md.
//
// How it is graded (AUTHORING §18.1): the learner writes the kick, so the Band plays the chords only
// (`band.axis-4bar`, I V vi IV, the same roots as the bass). S4 compares only when the bass plays (`rhythm` on
// the `bass` track): the notes are given, the rhythm is the point. The Make's one required rule is
// `groove-lock`: at least three in four of the bass notes start with a kick.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The shared rhythm: beat 1, the "and" of 2, beat 4 (eighths 1, 4 and 7 of the bar). */
const HITS = "x ~ ~ x ~ ~ x ~";
const constHits = (rhythm = HITS) => `const hits = "${rhythm}"`;
/** One labelled line per drum; the kick takes `hits`. */
const KICK = 'kick: s("bd").struct(hits)';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.5)';
/** The four-chord loop's roots, I V vi IV (n 0 4 5 3), one a bar, on the rhythm `struct`. */
const ROOTS = "<0 4 5 3>";
const bass = (struct: string, roots = ROOTS) =>
  `bass: n("${roots}").struct(${struct}).scale("C2:major").s("ebass").lpf(600)`;
/** A file with the `hits` const above the labelled lines. */
const withHits = (rhythm: string, ...lines: string[]) =>
  `${TEMPO}${constHits(rhythm)}\n\n${lines.join("\n")}`;
const groove = (bassLine: string, kick = KICK) => withHits(HITS, kick, SNARE, HATS, bassLine);

/** The hook: kick and bass on one rhythm. */
const HOOK = groove(bass("hits"));
/** The same drums with the bass on straight quarters: the two rub on beats 2 and 3 and the "and" of 2. */
const RUB = groove(bass('"x x x x"'));

/** S4: the bass has its own rhythm, an eighth on every beat; it should take the kick's. */
const S4_STARTER = groove(bass('⟪"x ~ x ~ x ~ x ~"⟫'));
const S4_SOLUTION = groove(bass("hits"));

/** The Make: no const yet; the kick on 1 and 3, the bass on every beat. */
const MAKE_STARTER = code('kick: s("bd ~ bd ~")', bass('"x x x x"'));

/** The Band plays the four-chord loop under the learner's kick and bass. */
const CHORDS = { band: "band.axis-4bar", tracks: ["chords"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** When the bass plays, nothing else: the roots are given, only the bass's rhythm is graded. */
const BASS_RHYTHM: Matcher = {
  m: "rhythm",
  tol: [1, 32],
  durations: false,
  perRole: false,
  displacementCredit: 0.5,
  tracks: ["bass"],
};

/** Seconds from the start of the stimulus of each hit of `hits` over `bars` bars (tap tests). */
const BAR_SEC = (4 * 60) / BPM;
const at = (eighths: number[], bars = 2) =>
  Array.from({ length: bars }, (_, b) =>
    eighths.map((e) => Number((b * BAR_SEC + (e * BAR_SEC) / 8).toFixed(3))),
  ).flat();
const TAP_FEEDBACK = {
  "tap.missed": "A kick went by without a tap. Keep counting through the gap after the first one.",
  "tap.extra": "A tap landed where the kick and the bass leave a gap.",
} as const;

export default defineLesson({
  id: "U08.L04",
  version: 4,
  title: "Lock with the Kick",
  objective:
    "I can give the kick drum and the bass one rhythm, named once in a const, so they hit as one instrument.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["B04"],
  practises: [],
  terms: [{ id: "term.groove-lock", step: "S4" }],
  canDo: ["cd.code.groove-lock"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Rub, then lock",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "rub-then-lock",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops, low down, where the kick and the bass play. Listen for whether the two sound like two parts or like one.",
        skills: [{ skill: "B04", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: RUB, caption: "The bass on every beat.", bars: 4 },
          { code: HOOK, caption: "The same bass notes and drums; only the bass's rhythm changes.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "How many together?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "how-many-together",
        version: 1,
        role: "practice",
        prompt:
          'Predict how many times in one bar the kick and the bass hit together, then enter the number. The rhythm is written once, `const hits = "x ~ ~ x ~ ~ x ~"`, and both lines take it with `.struct(hits)`.',
        skills: [{ skill: "B04", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 2,
        mode: "count",
        correct: 3,
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Change the rhythm",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      example: { id: "change-the-rhythm", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "change-the-rhythm",
        version: 1,
        role: "practice",
        prompt:
          'Run the loop. Change the `x`s and `~`s inside the quotes of `hits`, for example to `"x ~ x ~ ~ x ~ ~"`, and run it again. Watch which lines move on the roll, then answer both questions below.',
        skills: [{ skill: "B04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Find every line that says `hits`. Then count the eighths of the hook's rhythm, 1 & 2 & 3 & 4 &, and see which hits land on an &.",
        },
        hints: ladder(
          "Find every line that reads `hits`. Those are the lines a change can reach.",
          "Count the hook's `hits` in eighths: 1 & 2 & 3 & 4 &. Each `x` is one hit.",
          'The first `x` is beat 1 and the last is beat 4. The middle one sits on an "and": which beat comes before it?',
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "When you changed `hits`, what moved?",
            options: [
              { id: "both", label: "The kick and the bass, together" },
              { id: "kick", label: "Only the kick" },
              { id: "bass", label: "Only the bass" },
            ],
            correct: ["both"],
          },
          {
            q: "number",
            prompt: "In the hook's rhythm, how many of the three hits fall between the beats?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["both"], number: 1 } }, expect: "pass" },
          {
            name: "only the kick",
            response: { answer: { choice: ["kick"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "beat 4 counted as between",
            response: { answer: { choice: ["both"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Match the kick",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      exercise: {
        kind: "code-modify",
        id: "give-the-bass-the-kicks-rhythm",
        version: 1,
        role: "check",
        prompt:
          "The kick plays `hits`; the bass plays a rhythm of its own, an eighth on every beat. Change the highlighted rhythm in the bass's `.struct()` so the bass plays the kick's rhythm. Done when every bass note starts with a kick.",
        skills: [{ skill: "B04", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        matcher: BASS_RHYTHM,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: the kick hits and the bass does not. The kick's rhythm is already written once, at the top.",
          "rhythm.extra": "Bar {bar}, {beatLabel}: the bass plays where the kick is silent.",
        },
        hints: ladder(
          "The kick's rhythm is written once, at the top. The bass can read it from the same place.",
          "`.struct()` takes a rhythm; the name `hits` stands for the kick's rhythm, without quotes.",
          'The kick line is `s("bd").struct(hits)`. The bass\'s `.struct()` can hold the same thing.',
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "the rhythm typed out again",
            response: { code: groove(bass(`"${HITS}"`)) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: groove(bass('"x ~ x ~ x ~ x ~"')) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the name in quotes",
            response: { code: groove(bass('"hits"')) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "the middle hit on beat 2",
            response: { code: groove(bass('"x ~ x ~ ~ ~ x ~"')) },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
          {
            name: "the kick changed instead",
            response: { code: groove(bass('"x ~ x ~ x ~ x ~"'), 'kick: s("bd").struct("x ~ x ~ x ~ x ~")') },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "tap",
      title: "Tap the shared rhythm",
      minutes: 1.5,
      ui: { panels: ROLL, band: CHORDS },
      exercise: {
        kind: "tap",
        id: "tap-the-shared-rhythm",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the kick and the bass for two bars, on 1, the “and” of 2, and 4: three taps a bar, six in all.",
        skills: [
          { skill: "B04", w: 0.6 },
          { skill: "R07", w: 0.4 },
        ],
        hints: ladder(
          "Two of the three hits fall on beats, 1 and 4. Listen for the one that falls between two beats.",
          "Count eighths out loud, 1 & 2 & 3 & 4 &, and tap on 1, the & after 2, and 4.",
          "Tap the first bar's three hits alone, then keep going without stopping.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 2,
        target: { drum: ["kick"] },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: TAP_FEEDBACK,
        tests: [
          { name: "with the kick", response: { taps: at([0, 3, 6]) }, expect: "pass" },
          { name: "on every beat", response: { taps: at([0, 2, 4, 6]) }, expect: "fail" },
          { name: "the middle tap on beat 2", response: { taps: at([0, 2, 6]) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Locked or not?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "locked-or-not",
        version: 1,
        role: "check",
        prompt:
          "Listen to two bars of drums and bass, a new groove each time. Pick whether every bass note starts with a kick, or the bass has a rhythm of its own.",
        skills: [{ skill: "B04", w: 1 }],
        hints: [
          {
            text: "Listen to the kick alone first. Then follow the bass: does each bass note start with a kick?",
          },
          {
            text: "Hum the bass's rhythm, then the kick's. Are they the same rhythm?",
            replay: { rate: 0.75 },
          },
          { text: "One bass note away from the kick is enough: then it has a rhythm of its own." },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.rhy.groove-lock", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "locked", label: "With the kick: every bass note starts with a kick" },
            { id: "independent", label: "Its own rhythm: some bass notes fall between the kicks" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.rhy.groove-lock", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Kick and bass together",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      exercise: {
        kind: "code-make",
        id: "kick-and-bass-as-one",
        version: 1,
        role: "practice",
        prompt:
          "Write the kick and bass for the last two loud parts of your song. Put one rhythm in a `const` at the top, with a hit between the beats, and give it to both with `.struct()`. Add a snare on 2 and 4 and hats. Done when at least 3 in 4 bass notes start with a kick.",
        skills: [{ skill: "B04", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "bass-with-the-kick",
            label: "At least 3 in 4 bass notes start with a kick",
            required: true,
            skills: ["B04"],
            rule: "groove-lock",
            kick: "kick",
            bass: "bass",
            min: 0.75,
          },
          {
            id: "named-once",
            label: "A `const` in the code",
            required: false,
            skills: ["B04"],
            rule: "uses",
            tool: "tb.const",
          },
          {
            id: "a-push",
            label: "At least one kick between the beats",
            required: false,
            skills: ["R07"],
            rule: "syncopation",
            track: "kick",
            min: 1,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Now the kick plays on 1 and 3 and the bass on every beat. One rhythm has to serve both lines.",
          'Write the rhythm once at the top, `const hits = "…"`, with `x` for a hit and `~` for a gap in eight eighths. Then give it to both lines with `.struct(hits)`.',
          'The kick becomes `s("bd").struct(hits)`. The bass keeps its notes and takes `.struct(hits)` in place of its own rhythm.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the hook's rhythm for both",
            response: { code: withHits(HITS, KICK, bass("hits")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a sixteenth push, an octave pop, snare and hats",
            response: {
              code: withHits(
                "x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~ x",
                KICK,
                SNARE,
                'hats: s("hh*16").gain(.4)',
                'bass: n("[0 0 0 7 0 7]").add(n("<0 4 5 3>")).struct(hits).scale("C2:major").s("ebass").lpf(600)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the rhythm typed into both lines",
            response: {
              code: code('kick: s("bd").struct("x ~ x ~ ~ x ~ ~")', SNARE, bass('"x ~ x ~ ~ x ~ ~"')),
            },
            expect: "pass",
          },
          {
            name: "the bass keeps its own rhythm under a new kick",
            response: { code: withHits("x ~ ~ x ~ x ~ ~", KICK, SNARE, bass('"x x x x"')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
