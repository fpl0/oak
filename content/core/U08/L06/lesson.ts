// U08.L06 Kick and Bass, One Line (Oak 2.0 W2; DeSantis, *Making Music*, "Bass Lines and Kick Drums as a Single
// Composite"). The opposite of Lock with the Kick: the bass plays in the gaps between the kicks, never with one, and
// in S4/S5 stops before the next kick; the Make also allows held notes with clear attacks. What the learner
// has: one labelled line per drum (U01.L03), eighths and the "and" (U01.L04), `.struct()` (U06.L12), root bass lines
// in degrees (U08.L01), `.clip()` for short notes (U02.L08), the groove lock (U08.L04). Not yet: the word for hits
// between the beats (U13.L01), the bass's tone (U08.L05). Spec: content/specs/U08.md.
//
// How it is graded (AUTHORING §18.1, §20.2; PLAN §2 rule 4): the learner writes the kick and the bass, so the Band
// plays the chords only (`band.axis-4bar`, I V vi IV, the bass's roots). S4 and S5 keep the kick's rhythm (`rhythm`
// on `kick`) and require `kick-bass-composite`: no bass note starts within a 32nd of a kick, no kick lands while a
// bass note still sounds (its written length, `.clip()` included), and one bass note at a time.
// Oak's call: two bass onsets in every full bar. The Make allows notes to ring past kicks when their attacks
// stay clear (owner item 2). Fidelity pins: content/validate/pins/U08.L06.ts.
import { defineLesson, type HintLadder, type Matcher, type RubricRule } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The kick on beats 1 and 3; snare and hats as every U08 groove has them. */
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.5)';
/** The four-chord loop's roots, I V vi IV (n 0 4 5 3), one chord a bar, laid on a rhythm with `.struct()`. */
const bass = (rhythm: string, tail = "", octave = "C2") =>
  `bass: n("<0 4 5 3>").struct("${rhythm}").scale("${octave}:major").s("ebass").lpf(600)${tail}`;
const groove = (bassLine: string, kick = KICK) => code(kick, SNARE, HATS, bassLine);

/** Kick on 1 and 3; the bass on beat 2, the "and" of 3 and the "and" of 4: kick, bass, kick, bass, bass. */
const GAPS = "~ ~ x ~ ~ x ~ x";
const HOOK = groove(bass(GAPS));
/** The same notes with the bass on the kicks: the groove lock of the last lesson. */
const LOCKED = groove(bass("x ~ ~ ~ x ~ ~ ~"));

/** S2: the bass between the kicks, held through the next kick (`@2` holds beat 2 through beat 3), and cut short. */
const HELD = "~ x@2 x";
const RINGING = groove(bass(HELD));
const SHORT = groove(bass(HELD, ".clip(.5)"));

/** S4: an eighth on every beat: on beats 1 and 3 it starts with the kick. */
const S4_STARTER = groove(bass("⟪x ~ x ~ x ~ x ~⟫"));
const S4_SOLUTION = HOOK;
/** S5: the bass starts in the gaps, but its first note is held straight through the kick on beat 3. */
const S5_STARTER = groove(`${bass(HELD)}⟪⟫`);
const S5_SOLUTION = SHORT;

/** The Make: the kick and bass of the last lesson, locked on beats 1 and 3. */
const MAKE_STARTER = code(KICK, SNARE, bass("x ~ x ~"));

/** The Band plays the four-chord loop under the learner's drums and bass. */
const CHORDS = { band: "band.axis-4bar", tracks: ["chords"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** Bass and kick take turns; the Make also accepts the book's held-bass form. */
const COMPOSITE = (id: string, label: string, required: boolean, onsetsOnly = false): RubricRule => ({
  id,
  label,
  required,
  skills: ["B04"],
  rule: "custom",
  fn: "kick-bass-composite",
  // Oak's call: two bass onsets in every full bar.
  params: { bass: "bass", minBassPerBar: 2, ...(onsetsOnly ? { onsetsOnly: true } : {}) },
});
/** The kick keeps its rhythm; the bass takes turns with it. */
const KICK_KEPT_AND_TURNS: Matcher = {
  m: "all",
  of: [
    {
      m: "rhythm",
      tol: [1, 32],
      durations: false,
      perRole: false,
      displacementCredit: 0.5,
      tracks: ["kick"],
    },
    {
      m: "rubric",
      rules: [
        COMPOSITE("turns", "Every bass note starts between two kicks and stops before the next one", true),
      ],
    },
  ],
};

export default defineLesson({
  id: "U08.L06",
  version: 2,
  title: "Kick and Bass, One Line",
  objective:
    "I can write a bass that plays in the gaps between the kicks, so kick and bass sound as one line.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["B04", "B01"],
  terms: [{ id: "term.composite-line", step: "S4" }],
  canDo: ["cd.compose.kick-bass-line"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Together or in turn",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "together-or-in-turn",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops, low down, where the kick and the bass play. Listen for the loop where you can hear every kick and every bass note on its own.",
        skills: [{ skill: "B04", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: LOCKED, caption: "Every bass note starts with a kick.", bars: 4 },
          { code: HOOK, caption: "The same notes; the bass plays where the kick is silent.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Short or held",
      minutes: 0.5,
      ui: { panels: NONE, band: CHORDS },
      exercise: {
        kind: "identify",
        id: "short-or-held",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both cards: the same bass notes start between the kicks in both. Pick the card where each bass note has stopped by the time the next kick hits.",
        skills: [{ skill: "B04", w: 1 }],
        hints: ladder(
          "Listen to beat 3 of each card, where the kick hits after the bass's first note.",
          "In one card the bass note from beat 2 is still sounding when the kick on beat 3 hits.",
          "Listen for a gap of silence in the low end just before beat 3.",
        ),
        stimulus: { src: "code", code: SHORT, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "held", label: "Card A", audio: RINGING },
            { id: "short", label: "Card B", audio: SHORT },
          ],
        },
        correct: { choice: ["short"] },
        feedbackText: {
          "id.wrong":
            "In card A the bass note that starts on beat 2 is held for two beats, through the kick on beat 3. In card B it stops on beat 3, as the kick hits.",
        },
        tests: [
          { name: "the short notes", response: { answer: { choice: ["short"] } }, expect: "pass" },
          {
            name: "the held notes",
            response: { answer: { choice: ["held"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Count the collisions",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      example: { id: "count-the-collisions", code: S4_STARTER.replace(/[⟪⟫]/g, ""), bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "count-the-collisions",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop. On the roll, compare the kick's lane with the bass in bar 1. Count the bass notes that start at the same moment as a kick, then enter the number.",
        skills: [{ skill: "B04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. In bar 1, find each kick on the roll and look straight up: is a bass note starting at that moment?",
        },
        hints: ladder(
          "Find the kicks in bar 1 first. The kick line plays two of them.",
          "The bass plays on every beat. The kick plays on beats 1 and 3.",
          "Count the beats that have both a kick and a bass note.",
        ),
        code: { starter: S4_STARTER.replace(/[⟪⟫]/g, "") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many bass notes in bar 1 start together with a kick?",
            correct: 2,
          },
        ],
        tests: [
          { name: "two", response: { answer: { number: 2 } }, expect: "pass" },
          {
            name: "every bass note counted",
            response: { answer: { number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "none",
            response: { answer: { number: 0 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Into the gaps",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      exercise: {
        kind: "code-modify",
        id: "bass-into-the-gaps",
        version: 1,
        role: "check",
        prompt:
          "Change the bass's rhythm in `.struct()` so every bass note starts between two kicks, never with one. Keep the kick line as it is. Done when no bass note starts on beat 1 or beat 3 or rings into one, and the bass still plays between the kicks all through.",
        skills: [{ skill: "B04", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        matcher: KICK_KEPT_AND_TURNS,
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rhythm.missing": "Bar {bar}, {beatLabel}: the kick is missing here. Keep the kick line as it was.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a kick that was not there before. Keep the kick line as it was.",
          "rhythm.displaced": "The kick has moved, shifted {shiftLabel}. Keep the kick line as it was.",
        },
        hints: ladder(
          "The kick plays on beats 1 and 3. Those are the two places the bass has to leave free.",
          "Each `x` in the bass's `.struct()` is a note and each `~` a gap, eight to a bar. The first and the fifth step sit with the kicks.",
          "Turn the first and fifth steps into `~`, and put the bass's notes on steps where the kick line has a `~` in the same place.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "on the second half of every beat",
            response: { code: groove(bass("~ x ~ x ~ x ~ x")) },
            expect: "pass",
          },
          {
            name: "sixteenths between the kicks",
            response: { code: groove(bass("~ x ~ x ~ x ~ x ~ x ~ x ~ x ~ x")) },
            expect: "pass",
          },
          {
            name: "the same rhythm an octave up",
            response: { code: groove(bass(GAPS, "", "C3")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: groove(bass("x ~ x ~ x ~ x ~")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a new rhythm that still starts with the kicks",
            response: { code: groove(bass("x ~ ~ x x ~ ~ x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one bass note left on beat 1",
            response: { code: groove(bass("x ~ x ~ ~ x ~ x")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kick moved off the beats instead",
            response: { code: groove(bass("x ~ x ~ x ~ x ~"), 'kick: s("~ bd ~ bd")') },
            expect: "fail",
            feedback: ["rhythm.displaced"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Stop before the kick",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      exercise: {
        kind: "code-modify",
        id: "stop-before-the-kick",
        version: 1,
        role: "check",
        prompt:
          "The bass's first note starts on beat 2 but `@2` holds it through the kick on beat 3. Add `.clip()` at the end of the bass line so every bass note stops by the time the next kick hits. Keep the kick line as it is.",
        skills: [{ skill: "B04", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 4 },
        matcher: KICK_KEPT_AND_TURNS,
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rhythm.missing": "Bar {bar}, {beatLabel}: the kick is missing here. Keep the kick line as it was.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a kick that was not there before. Keep the kick line as it was.",
          "rhythm.displaced": "The kick has moved, shifted {shiftLabel}. Keep the kick line as it was.",
        },
        hints: ladder(
          "The first note is two beats long. Only one of those beats is free of the kick.",
          "`.clip()` scales every note's length: 1 leaves it as written, a smaller number cuts it shorter.",
          "The held note needs to lose half its length to stop on beat 3.",
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          { name: "cut shorter still", response: { code: groove(bass(HELD, ".clip(.25)")) }, expect: "pass" },
          {
            name: "the length written in the rhythm instead",
            response: { code: groove(bass("~ x ~ x")) },
            expect: "pass",
          },
          {
            name: "legato, the other name",
            response: { code: groove(bass(HELD, ".legato(.5)")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: groove(bass(HELD)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "clip(1): every note as long as before",
            response: { code: groove(bass(HELD, ".clip(1)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "clip(2): longer, not shorter",
            response: { code: groove(bass(HELD, ".clip(2)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kick on beat 3 removed to make room",
            response: { code: groove(bass(HELD), 'kick: s("bd ~ ~ ~")') },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Take turns",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: CHORDS },
      exercise: {
        kind: "code-make",
        id: "kick-and-bass-take-turns",
        version: 2,
        role: "practice",
        prompt:
          "Write a kick and a bass for the first loud part of your song that take turns as one line. Move the bass, the kick or both. Done when every bass note starts where the kick is silent, all through. A long note may ring past the next kick.",
        skills: [{ skill: "B04", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          COMPOSITE("turns", "The bass plays between the kicks all through", true, true),
          {
            id: "a-backbeat",
            label: "A snare on 2 and 4",
            required: false,
            skills: ["R07"],
            rule: "onsets",
            track: "@drums",
            drum: "snare",
            contains: [
              [1, 4],
              [3, 4],
            ],
            perBar: true,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Right now the kick and the bass start together on beats 1 and 3. Give the bass the places the kick leaves empty.",
          "Change the bass's `.struct()` so its notes start where the kick line is silent, in every bar.",
          "Beats 2 and 4 are free of the kick. So are the second halves of beats 1 and 3.",
        ),
        tests: [
          {
            name: "minimal: the bass on beats 2 and 4",
            response: { code: code(KICK, bass("~ x ~ x")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a pushed kick, a bass that answers each kick with root and octave, hats",
            response: {
              code: code(
                'kick: s("bd ~ ~ bd ~ ~ bd ~")',
                SNARE,
                'hats: s("hh*8").gain(.4)',
                'bass: n("<0 4 5 3>").add(n("[0 7 0 7]")).struct("~ x x ~ x x ~ x").scale("C2:major").s("ebass").lpf(600).clip(.9)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the kick moved into the bass's gaps instead",
            response: { code: code('kick: s("~ bd ~ bd")', SNARE, bass("x ~ x ~")) },
            expect: "pass",
          },
          {
            name: "four on the floor with the bass between the kicks",
            response: { code: code('kick: s("bd*4")', SNARE, bass("~ x ~ x ~ x ~ x")) },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the bass still on the kicks under a new kick",
            response: { code: code('kick: s("bd ~ ~ bd ~ ~ bd ~")', SNARE, bass("x ~ ~ x ~ ~ x ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },

          {
            name: "the book's long notes: each starts in a gap and rings past the next kick",
            response: { code: code(KICK, SNARE, bass("~ x@4 ~ x@2")) },
            expect: "pass",
          },
          {
            name: "long notes that start with the kicks",
            response: { code: code(KICK, SNARE, bass("x@2 x@2")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
