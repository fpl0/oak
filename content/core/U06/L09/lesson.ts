// U06.L09 Chord Dictation Workshop. A chord loop is taken down in stages: first the bass (its degrees),
// then each chord's quality (major or minor), and the numerals follow from both: a bass on 6 under a minor
// chord is vi. Bass + quality = numeral. What the learner has: major against minor by ear (U05.L02), Roman
// numerals (U06.L02), the bass heard first and written by ear (U06.L05), the loops songs share (U06.L06–L07),
// two chords a bar (U06.L08). Not yet: sevenths (U06.L10), inverted chords in numerals (U06.L11). Spec:
// content/specs/U06.md. This is the first in-lesson use of transcription ladder level L3 (contracts §2.9:
// "generated four-chord loops, bass first, staged"); its widgets are the ladder's.
//
// Shapes (AUTHORING §17.3, §17.4): S2 is a `dictation` with `domain: "harmony"` and a widget per stage
// (`dictation.stage-answers`: degree pad, quality pad, numeral palette, in that order) and opens the chord
// band (`initialPanels: ["chords"]`), which shows each stage once it passes. S3 is a by-ear transcription in
// parts (`by-ear.parts`), the bass first and then the chords, graded octave-free and as chords (`pcset`
// without the bass), so stacks and chord names both pass. iii is in both loops on purpose: the four-chord
// loop alone could be answered from memory. The Make's one required rule is the `progression` the learner
// took down, I V vi iii, in C and in this order.
import { type AnswerUi, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One triad on each root of `roots` (n values, one a bar), stacked and moved with `.add()`. */
const triads = (roots: string, sound = "piano", extra = "") =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("${sound}")${extra}`;
/** A bass on the roots, one note a bar. */
const bass = (roots: string, scale = "C2:major") =>
  `bass: n("${roots}").scale("${scale}").s("ebass").lpf(600)`;
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const loop = (roots: string) => code(bass(roots), triads(roots));

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: C Em Am F, a bar each (I iii vi IV), piano over a root bass. */
const HOOK_ROOTS = "<0 2 5 3>";
const HOOK = loop(HOOK_ROOTS);

/** Staged answers: the bass as degrees on syllables (numbers shown), then major or minor, then numerals. */
const STAGES: Partial<Record<"bass" | "quality" | "rn", AnswerUi>> = {
  bass: { ui: "degree-pad", set: ["1", "2", "3", "4", "5", "6"], sequenceLen: 4, syllables: true },
  quality: { ui: "quality-pad", set: ["maj", "min"] },
  rn: { ui: "rn-palette", slots: 4, allow: ["triads"] },
};
const RIGHT = {
  bass: ["1", "3", "6", "4"],
  quality: ["maj", "min", "min", "maj"],
  rn: ["I", "iii", "vi", "IV"],
};

/** S3, by ear: G is V, Em is iii. I V vi iii: C G Am Em. */
const HEARD = "<0 4 5 2>";
const HEARD_SOURCE = loop(HEARD);
const HEARD_STARTER = code(bass("<⟪0 0 0 0⟫>"), triads("<⟪0 0 0 0⟫>"));
const HEARD_STARTER_PLAIN = code(bass("<0 0 0 0>"), triads("<0 0 0 0>"));
const BASS_PART: Matcher = {
  m: "melody",
  pitch: "octave-free",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 8],
  track: "bass",
};
/** The chords as pitch classes per onset: any voicing, stacks or names; the bass part has the lowest note. */
const CHORDS_PART: Matcher = { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] };

/** The Make: bar 1 of the loop, written as a stack. */
const MAKE_STARTER = code('chords: n("<[0,2,4] ~ ~ ~>").scale("C3:major").s("piano")');

/** The Band's drums only: none of this lesson's loops is the Band's I V vi IV. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U06.L09",
  version: 3,
  title: "Chord Dictation Workshop",
  objective:
    "I can take down a chord loop by ear: the bass first, then each chord's quality, then its Roman numeral.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E09"],
  terms: [],
  canDo: ["cd.transcribe.chords"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A loop by ear",
      minutes: 0.5,
      // Code and roll hidden: this loop is taken down by ear in the next step.
      ui: { panels: NONE, band: DRUMS },
      exercise: {
        kind: "listen",
        id: "a-loop-to-take-down",
        version: 1,
        role: "practice",
        prompt:
          "Four chords play over the drums, one a bar, with nothing to read. Hum the lowest note of each, and listen for which chords sound bright and which dark.",
        skills: [{ skill: "E09", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four chords, piano over a bass. No code this time.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "Bass, quality, numeral",
      minutes: 2,
      graded: true,
      ui: { panels: NONE, band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "dictation",
        id: "bass-quality-numeral",
        version: 1,
        role: "check",
        prompt:
          "Take the loop down in three passes. First the bass: the degree under each chord. Then each chord's colour: major or minor. Then the numerals: the bass gives the degree, the colour gives upper or lower case.",
        skills: [{ skill: "E09", w: 1 }],
        hints: [
          { text: "Sing the lowest note of each chord, and find home first." },
          {
            text: "The bass gives the degree, the colour gives the case: a minor chord on 6 is vi. Hear it slower.",
            replay: { rate: 0.75 },
          },
          { text: "The bass starts on 1 and ends on 4. The two bars between carry the darker chords." },
          "auto",
        ],
        domain: "harmony",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads"] },
        stages: ["bass", "quality", "rn"],
        stageAnswers: STAGES,
        stageFlow: "sequential",
        stagePass: 0.8,
        reference: { solutions: [HOOK], bars: 4 },
        matcher: {
          m: "harmony",
          level: "rn",
          qualityDepth: "triad",
          inversion: false,
          harmonicRhythm: "given",
        },
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        tests: [
          { name: "all three stages", response: { answer: { stages: RIGHT } }, expect: "pass" },
          {
            name: "the bass under bar 3 heard as 5",
            response: { answer: { stages: { ...RIGHT, bass: ["1", "3", "5", "4"] } } },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "bar 2 heard as major",
            response: { answer: { stages: { ...RIGHT, quality: ["maj", "maj", "min", "maj"] } } },
            expect: "fail",
            feedback: ["id.quality"],
          },
          {
            name: "iii written in capitals",
            response: { answer: { stages: { ...RIGHT, rn: ["I", "III", "vi", "IV"] } } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "dictate",
      title: "By ear, bass first",
      minutes: 1.75,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "dictation",
        id: "by-ear-bass-first",
        version: 1,
        role: "check",
        prompt:
          "A new loop plays, one chord a bar. Write the bass first, one note a bar in degrees, in any octave. Then write the chords above it, as stacks with `.add()` or as chord names. Done when both your bass and your chords match the loop.",
        skills: [{ skill: "E09", w: 1 }],
        hints: ladder(
          "Start with the bass. Find the bars that sit on home, and the bar where the bass climbs highest.",
          "Write the bass degrees, then give each chord the same root: a stack on a root of `n` 4 is V.",
          "The bass starts on 1 and its second note is degree 5, `n` 4. Two more, then copy them into the chords.",
        ),
        domain: "harmony",
        stimulus: { src: "code", code: HEARD_SOURCE, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: HEARD_STARTER },
        reference: { solutions: [HEARD_SOURCE], bars: 4 },
        matcher: { m: "all", of: [BASS_PART, CHORDS_PART] },
        // Four bass notes and four chords: one of the eight wrong scores about 0.9, above the kind's default
        // mark, and a loop with a wrong chord is not the loop. Every part must be right.
        pass: 0.95,
        byEar: {
          ab: true,
          rates: [1, 0.75, 0.5],
          accepts: "any-octave",
          parts: [
            { track: "bass", label: "The bass: one note a bar", matcher: BASS_PART },
            { track: "chords", label: "The chords above it", matcher: CHORDS_PART, pass: 0.8 },
          ],
        },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the loop has {exp}. Give the chord the root your bass plays there.",
        },
        tests: [
          { name: "reference", response: { code: HEARD_SOURCE }, expect: "pass" },
          {
            name: "the bass an octave up",
            response: { code: code(bass(HEARD, "C3:major"), triads(HEARD)) },
            expect: "pass",
          },
          {
            name: "the chords as names",
            response: { code: code(bass(HEARD), 'chords: chord("<C G Am Em>").voicing().s("piano")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: HEARD_STARTER_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the bass right, the last chord a degree off",
            response: { code: code(bass(HEARD), triads("<0 4 5 1>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the bass heard a step low in bar 4",
            response: { code: code(bass("<0 4 5 1>"), triads(HEARD)) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "More loops",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "more-loops",
        version: 1,
        role: "check",
        prompt:
          "A four-chord loop plays, in a new key each time. Enter its four numerals, finding the bass first in your head.",
        skills: [{ skill: "E09", w: 1 }],
        hints: ladder(
          "Find home first and start the count there.",
          "Hum each bass note and find its degree, then hear each chord bright or dark.",
          "Upper case for a major chord, lower case for a minor one: a minor chord on 2 is ii.",
        ),
        stimulus: { src: "generator", family: "fam.har.progression", level: 1 },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads"] },
        correct: {},
        srs: [{ family: "fam.har.progression", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "Make it a track",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "make-it-a-track",
        version: 1,
        role: "practice",
        prompt:
          "Write the loop you took down by ear, I V vi iii, in C and in that order, one chord a bar; bar 1 is written. Then make it a track if you like: a rhythm for the chords, a bass, a tune. Done when the chords go I V vi iii.",
        skills: [{ skill: "E09", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "i-v-vi-iii",
            label: "`chords` plays I V vi iii in C, in that order",
            required: true,
            skills: ["E09"],
            rule: "progression",
            rn: ["I", "V", "vi", "iii"],
            track: "chords",
          },
          {
            id: "a-bass",
            label: "A bass line on its own line, such as `bass`",
            required: false,
            skills: ["H01"],
            rule: "tracks",
            min: 1,
            roles: ["bass"],
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
          "Bar 1, I, is written. The three chords after it are V, vi and iii.",
          "Turn each numeral into a number for `.add()`: the degree minus one.",
          "I and V are 0 and 4. vi and iii are on degrees 6 and 3.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the four triads with .add()",
            response: { code: code(triads(HEARD)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: broken chords on a Rhodes, a bass and a tune",
            response: {
              code: code(
                bass(HEARD),
                'chords: chord("<C G Am Em>").voicing().arp("[0 1 2 1]*2").s("rhodes").gain(.6)',
                mel("<[4 ~ 2 ~] [4 ~ 1 ~] [5 ~ 2 ~] [4 ~ 6 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the loop from V: V vi iii I",
            response: { code: code(triads("<4 5 2 0>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
