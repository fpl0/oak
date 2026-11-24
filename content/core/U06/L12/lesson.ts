// U06.L12 Comping Patterns. Comping is playing the chords in a rhythm that locks with the drums and leaves
// room for the tune. `.struct("~ x ~ x")` lays a chord line onto a rhythm: every `x` plays the chord that is
// sounding at that moment, every `~` leaves a gap. With the snare on 2 and 4, `"~ x ~ x"` hits with it, and
// a last hit on the "and" of 4 (`"~ x ~ [~ x]"`) pulls the groove over the bar line. What the learner has:
// kick and snare grooves (U01), `< >` and `[ ]` (U01), the four-chord loop moved by `.add()` (U06.L01),
// harmonic rhythm (U06.L08: how often the chords change). Not yet: melodies over chords (U07), "syncopation"
// (U13.L01). Spec: content/specs/U06.md.
//
// The steps that check the rhythm play their own drums in code (snare on 2 and 4), so the snare is where the
// prose says it is in every flavour: the Band's axis groove puts its snare on beat 3 in the indie, funk and
// jazz-soul kits. The Make plays over the Band and asks only for `.struct()` (`uses`), so any comping rhythm
// the learner picks is good music. The comping steps are graded with `events` on the chords track, onsets
// only and octave-free: the chords are given, the rhythm is the point.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

/** A back-beat groove: kick on 1 and the "and" of 3, snare on 2 and 4, eighth hats. */
const DRUMS = 'drums: s("bd sd [~ bd] sd")';
const HATS = 'hats: s("hh*8").gain(.5)';
/** I V vi IV: roots on degrees 1, 5, 6 and 4 (n 0, 4, 5, 3), one a bar. */
const LOOP = "<0 4 5 3>";
const BASS = `bass: n("${LOOP}").scale("C2:major").s("ebass").lpf(600)`;
/** The four-chord loop on the piano, given a rhythm by `.struct()` (no struct: each chord fills its bar). */
const comp = (struct?: string, octave = 4, sound = "piano") =>
  `chords: n("[0,2,4]").add(n("${LOOP}")).scale("C${octave}:major")${struct === undefined ? "" : `.struct("${struct}")`}.s("${sound}")`;
/** The groove and the bass, with the chords on top. */
const groove = (chords: string) => code(DRUMS, HATS, BASS, chords);
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SNARE = "~ x ~ x";
const PUSH = "~ x ~ [~ x]";
const HOOK = groove(comp(PUSH));

/** S2: one stack, two hits. */
const ONE_STACK = code(DRUMS, HATS, 'chords: n("[0,2,4]").scale("C4:major").struct("x ~ x ~").s("piano")');

/** S4: from a hit on every beat to hits with the snare. */
const S4_STARTER = groove(comp("⟪x x x x⟫"));
const S4_SOLUTION = groove(comp(SNARE));
/** S6: the second hit moves to the "and" of 4. */
const S6_STARTER = groove(comp("~ x ~ ⟪x⟫"));
const S6_SOLUTION = groove(comp(PUSH));
const strip = (s: string) => s.replace("⟪", "").replace("⟫", "");

/** S5: the same tune over chords on every beat, and over chords on 2 and 4 (chords an octave lower). */
const TUNE = "<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>";
const EVERY_BEAT = code(DRUMS, HATS, BASS, comp("x x x x", 3), mel(TUNE));
const ON_TWO_FOUR = code(DRUMS, HATS, BASS, comp(SNARE, 3), mel(TUNE));

/** The Make: the Band plays drums and the 1 5 6 4 bass; the starter holds each chord for its whole bar. */
const MAKE_STARTER = code(comp());

const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** When the chords sound, nothing else: the chords are given, only their rhythm is graded. */
const RHYTHM: Matcher = {
  m: "rhythm",
  tol: [1, 32],
  durations: false,
  perRole: false,
  displacementCredit: 0.5,
  tracks: ["chords"],
};

export default defineLesson({
  id: "U06.L12",
  version: 4,
  title: "Comping Patterns",
  objective: 'I can give a chord loop a rhythm that locks with the drums, with .struct("~ x ~ x").',
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H06"],
  terms: [{ id: "term.comping", step: "S4" }],
  canDo: ["cd.code.comping"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A soul groove",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-soul-groove",
        version: 1,
        role: "practice",
        prompt:
          "Keep your ear on the piano, through the drums and bass. Listen for where in the bar it plays and where it leaves space.",
        skills: [{ skill: "H06", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "I V vi IV, the piano in a rhythm of its own.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Count the hits",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "one-stack", code: ONE_STACK, bars: 2 },
      exercise: {
        kind: "predict",
        id: "count-the-hits",
        version: 1,
        role: "practice",
        prompt:
          'A C chord, `n("[0,2,4]")`, is followed by `.struct("x ~ x ~")`: every `x` is a hit, every `~` a gap. Predict how many times the chord sounds in one bar, and enter the number.',
        skills: [{ skill: "H06", w: 1 }],
        hints: null,
        tests: [],
        code: ONE_STACK,
        bars: 2,
        mode: "count",
        correct: 2,
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where the snare is",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "the-hook-again", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-snare-is",
        version: 1,
        role: "practice",
        prompt:
          'Change the rhythm inside `.struct()` to `"x ~ x ~"`, `"~ x ~ x"` and `"x x x x"` in turn, and run each. Listen to the chords against the kick and the snare, then answer both questions below.',
        skills: [{ skill: "H06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Look at the drums line: the snare is the second and fourth word, `sd`; a rhythm that also hits on beats 1 and 3 plays between the snares too. Count the `x`s in the hook's rhythm, inside the brackets too.",
        },
        hints: ladder(
          'Find the snare in the drums line, `s("bd sd [~ bd] sd")`, and note which beats its `sd` words fall on.',
          "The four words of a `.struct()` rhythm are the four beats. An `x` on the same beat as `sd` hits with the snare.",
          "The snare is on beats 2 and 4. In the hook's rhythm, `[~ x]` splits beat 4 in two and hits on its second half.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            // "Only": `"x x x x"` hits with the snare too, and on beats 1 and 3 (review finding theory-d 7).
            prompt: "Which rhythm hits only with the snare?",
            options: [
              { id: "one-three", label: '"x ~ x ~"' },
              { id: "two-four", label: '"~ x ~ x"' },
              { id: "every-beat", label: '"x x x x"' },
            ],
            correct: ["two-four"],
          },
          {
            q: "number",
            prompt: 'How many hits does the hook\'s rhythm, `"~ x ~ [~ x]"`, play in a bar?',
            correct: 2,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["two-four"], number: 2 } },
            expect: "pass",
          },
          {
            name: "with the kick",
            response: { answer: { choice: ["one-three"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "every beat: with the snare, and on 1 and 3 as well",
            response: { answer: { choice: ["every-beat"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the brackets counted as a beat each",
            response: { answer: { choice: ["two-four"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Lock to the snare",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "lock-to-the-snare",
        version: 1,
        role: "check",
        prompt:
          "The chords hit on every beat. Change the rhythm in `.struct()` so they hit only with the snare, on beats 2 and 4, and stay silent on beats 1 and 3.",
        skills: [{ skill: "H06", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        matcher: RHYTHM,
        constraints: [{ c: "must-use", tool: "tb.struct", feedback: "code.must-use" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rhythm.displaced":
            "The right number of hits, shifted {shiftLabel}. The snare plays on beats 2 and 4: put the `x`s there.",
        },
        hints: ladder(
          "The snare plays on beats 2 and 4. Find the words of the rhythm that stand for those beats.",
          "The rhythm has four words, one per beat. A `~` keeps a beat silent; an `x` plays the chord.",
          "Beat 1 becomes a gap and beat 2 stays a hit. Do the same for beats 3 and 4.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "the same rhythm written as two halves",
            response: { code: groove(comp("[~ x]*2")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: strip(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "with the kick: beats 1 and 3",
            response: { code: groove(comp("x ~ x ~")) },
            expect: "fail",
            feedback: ["rhythm.displaced"],
          },
          {
            name: "five words: the beats squeezed",
            response: { code: groove(comp("~ x ~ x ~")) },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Room for the tune",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "room-for-the-tune",
        version: 1,
        role: "practice",
        prompt:
          "Both cards play the same tune over the same chords: in one the chords hit every beat, in the other only with the snare. Pick the card where the tune is easier to follow.",
        skills: [{ skill: "H06", w: 1 }],
        hints: ladder(
          "Listen for the card where the tune and the chords keep landing on the same moments: that one crowds the tune.",
          "When the chords hit on every beat, they start together with most of the tune's notes.",
          "Most of the tune's notes start on beats 1 and 3. Which card leaves those beats to it?",
        ),
        stimulus: { src: "code", code: ON_TWO_FOUR, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "every-beat", label: "Chords on every beat", audio: EVERY_BEAT },
            { id: "two-and-four", label: "Chords with the snare", audio: ON_TWO_FOUR },
          ],
        },
        correct: { choice: ["two-and-four"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "That was the chords on every beat. Play both again: with the chords on 2 and 4, the tune has beats 1 and 3 to itself.",
        },
        tests: [
          { name: "with the snare", response: { answer: { choice: ["two-and-four"] } }, expect: "pass" },
          {
            name: "every beat",
            response: { answer: { choice: ["every-beat"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Push the last hit",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "push-into-the-next-bar",
        version: 1,
        role: "check",
        prompt:
          'Keep the hit on beat 2. Move the second hit half a beat later, onto the "and" of 4, the second half of beat 4, as in the hook. Change only the last word of the rhythm.',
        skills: [{ skill: "H06", w: 1 }],
        code: { starter: S6_STARTER },
        reference: { solutions: [S6_SOLUTION], bars: 4 },
        matcher: RHYTHM,
        constraints: [
          { c: "must-use", tool: "tb.struct", feedback: "code.must-use" },
          { c: "edit-only-regions", feedback: "code.edit-outside" },
        ],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rhythm.displaced":
            'A hit is not on the "and" of 4. Split beat 4 in two with `[ ]` and hit on its second half.',
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: one hit too many. The bar keeps two hits; only the second one moves.",
        },
        hints: ladder(
          "Two things fit into one beat with brackets, as in your drum lines.",
          '`[a b]` splits one word\'s time in two. A gap in the first half and a hit in the second puts the hit on the "and".',
          "The last word becomes a pair in brackets: a `~` first, then the hit.",
        ),
        tests: [
          { name: "reference", response: { code: S6_SOLUTION }, expect: "pass" },
          {
            name: "the same moment on a sixteenth grid",
            response: { code: groove(comp("~ x ~ [~ ~ x ~]")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: strip(S6_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "two hits on beat 4",
            response: { code: groove(comp("~ x ~ [x x]")) },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
          {
            name: 'the push on the "and" of 3',
            response: { code: groove(comp("~ x [~ x] ~")) },
            expect: "fail",
            feedback: ["rhythm.displaced", "code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Comp the band",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "comp-the-band",
        version: 1,
        role: "practice",
        prompt:
          "Your chords hold each bar over Oak's drums and bass, in the last two loud parts of your song. Add `.struct()` to the `chords` line with a rhythm that locks with the kick and snare and leaves room for Oak's tune. Done when the chords play a rhythm set with `.struct()`.",
        skills: [{ skill: "H06", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "struct",
            label: "`.struct()` sets the rhythm of the chords",
            required: true,
            skills: ["H06"],
            rule: "uses",
            tool: "tb.struct",
          },
          {
            id: "on-the-bass",
            label: "`chords` plays I V vi IV, over the band's bass",
            required: false,
            skills: ["H01"],
            rule: "progression",
            rn: ["I", "V", "vi", "IV"],
            track: "chords",
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
          "Listen first for where Oak's kick and snare land. Your chords can hit with them or in the gaps.",
          "`.struct()` goes after `.scale()`, before `.s()`. Its rhythm has one word a beat: `x` to hit, `~` to rest.",
          'One rhythm to start from: `"~ x ~ x"`. Then try a push, or split a beat in two.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: hits with the snare",
            response: { code: code(comp(SNARE)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a funk push on the Rhodes, a tune",
            response: {
              code: code(
                comp("[~ x] ~ [~ x] [~ x]", 3, "rhodes"),
                mel("<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "a new sound, the chords still held",
            response: { code: code(comp(undefined, 4, "organ")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
