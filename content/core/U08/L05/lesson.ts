// U08.L05 Bass Dictation & Tone. A bass line can be taken down by ear: each chord's root first (the bass
// degree on beat 1), then the notes between, checked by switching between the source and your own code at the
// same bar. And a bass has a tone: `fingerbass` (unlocked here) is rounder than `ebass`, the synth bass
// (`s("sawtooth")` with the bass preset `.lpf(600)`, the `tb.template.synthbass` recipe, also unlocked here)
// buzzier, and moving `.lpf()` makes either darker or brighter. What the learner has: root bass lines (U08.L01),
// root, 5th and octave (U08.L02), approach notes (U08.L03), the kick lock (U08.L04), the bass degree by ear
// (U06.L05) and loops taken down bass first (U06.L09), `ebass` and `.lpf(600)` (C1), the sawtooth wave
// (U02.L06). No new pitch or rhythm material and no new term: "filter" and "cutoff" are A1.L02's (a side lesson
// the learner may not have taken), so the prose says "darker", "brighter" and "the bass preset". Spec:
// content/specs/U08.md.
//
// How it is graded: S2 is a by-ear transcription of the bass alone (`byEar`, `accepts: "any-octave"`, the
// `melody` matcher octave-free on the `bass` track), with the chords shown in the code, so a root heard an
// octave off still passes and a 5th written a degree off does not. S3 is `fam.har.bass` at level 4. S5 (not a
// graded check) asks for one of today's two tones and leaves the notes alone. The Make's one required rule is
// U08.L01's: the root of each chord in the bass on its beat 1 (`matches` + `harmony` at level `bass`), now
// under vi IV I V, a loop that does not start at home.
import { type AnswerUi, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Triads stacked on `roots` (n values, one a bar), as in U06.L01. */
const chords = (roots: string, sound = "piano") =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("${sound}")`;
/** A bass in degrees an octave below the chords, with a tone: the sound and its `.lpf()`. */
const bass = (pattern: string, tone = '.s("ebass").lpf(600)') =>
  `bass: n("${pattern}").scale("C2:major")${tone}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The doo-wop order I vi IV V with a bass on the root (beats 1 and 3) and the 5th above it (beat 4). */
const DOO_WOP = "<0 5 3 4>";
const HOOK_BASS = "<[0 ~ 0 4] [5 ~ 5 9] [3 ~ 3 7] [4 ~ 4 8]>";
const toned = (tone: string) => code(chords(DOO_WOP), bass(HOOK_BASS, tone));
const EBASS = toned('.s("ebass").lpf(600)');
const FINGER = toned('.s("fingerbass").lpf(600)');
const SYNTH = toned('.s("sawtooth").lpf(600)');

/**
 * S2, by ear: I IV vi V (C F Am G), a root on beat 1 and its 5th on beat 3, the way a bass player keeps it low:
 * C2 G1 | F1 C2 | A1 E2 | G1 D2 (the 5th below C, the roots of F, Am and G below C). The reveal writes the same
 * degrees as "root, then root + 4", the U08.L02 way: C2 G2 | F2 C3 | A1 E2 | G1 D2.
 */
const DICTATION_ROOTS = "<0 3 5 4>";
const SOURCE_BASS = "<[0 ~ -3 ~] [-4 ~ 0 ~] [-2 ~ 2 ~] [-3 ~ 1 ~]>";
const CANONICAL_BASS = "<[0 ~ 4 ~] [3 ~ 7 ~] [-2 ~ 2 ~] [-3 ~ 1 ~]>";
const dictation = (pattern: string) => code(chords(DICTATION_ROOTS), bass(pattern));
const SOURCE = dictation(SOURCE_BASS);
const DICTATION_SOLUTION = dictation(CANONICAL_BASS);
const DICTATION_STARTER = dictation("<⟪0 0 0 0⟫>");
const BASS_BY_EAR: Matcher = {
  m: "melody",
  pitch: "octave-free",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 8],
  track: "bass",
};

/** S3: the bass degree under each chord, on syllables with numbers. */
const PAD: AnswerUi = {
  ui: "degree-pad",
  set: ["1", "2", "3", "4", "5", "6", "7"],
  sequenceLen: 4,
  syllables: true,
};

/** S5: the line from S2 with its tone in the box; the bass comes first (STYLE §1), so its `.s()` is the first. */
const toneOf = (tone: string, pattern = SOURCE_BASS) => code(bass(pattern, tone), chords(DICTATION_ROOTS));
const TONE_STARTER = toneOf('⟪.s("ebass").lpf(600)⟫');
const TONE_SOLUTION = toneOf('.s("fingerbass").lpf(500)');

/** The Make: vi IV I V (Am F C G), the bass a bar late (each beat 1 plays the chord before's root). */
const MAKE_ROOTS = "<5 3 0 4>";
const make = (bassLine: string, chordSound = "piano") => code(chords(MAKE_ROOTS, chordSound), bassLine);
const MAKE_STARTER = make(bass("<4 5 3 0>"));
const ROOT_BASS: Matcher = {
  m: "harmony",
  level: "bass",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
};

/** Drums from the Band; the chords and the bass are in the learner's code (the A/B compares bass with bass). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U08.L05",
  version: 3,
  title: "Bass Dictation & Tone",
  objective: "I can take a bass line down by ear, and give a bass its tone.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["B01", "V05", "E09"],
  terms: [],
  canDo: ["cd.transcribe.bass"],
  flavours: {
    "flavour.funk": { sounds: { "snd.ebass": "snd.fingerbass" } },
    "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } },
  },
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One line, three tones",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: FINGER, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-line-three-tones",
        version: 1,
        role: "practice",
        prompt:
          "Listen to one bass line in three sounds; the notes stay the same. Listen for how each note starts and how much it buzzes, and decide which sits best under these chords for you.",
        skills: [{ skill: "B01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: EBASS, caption: "`ebass`, the bass you have used since your first loop.", bars: 4 },
          { code: FINGER, caption: "`fingerbass`. Listen to how each note starts.", bars: 4 },
          {
            code: SYNTH,
            caption: "The synth bass, a sawtooth wave with `.lpf(600)`. Listen to its edge.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "dictate",
      title: "Take the bass down",
      minutes: 2,
      graded: true,
      ui: { panels: NONE, band: DRUMS },
      exercise: {
        kind: "dictation",
        id: "take-the-bass-down",
        version: 1,
        role: "check",
        prompt:
          "Write the hidden bass line in `n`, in any octave. Replace each of the four numbers with a cell of two notes, one on beat 1 and one on beat 3, like `[0 ~ 0 ~]`. Done when all eight notes match the source.",
        skills: [
          { skill: "E09", w: 0.6 },
          { skill: "B01", w: 0.4 },
        ],
        hints: ladder(
          "Start with beat 1 of each bar, where the chord changes. Which note of the chord does the bass land on?",
          "Beat 1 of each bar is the chord's root: write those first. Then find the note on beat 3: is it the root again, or another note of the chord?",
          "Bar 1 starts on 0, the root of I, and its second note is the 5th of that chord, above or below. The other bars do the same from their own root.",
        ),
        domain: "bass",
        stimulus: { src: "code", code: SOURCE, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: DICTATION_STARTER },
        reference: { solutions: [DICTATION_SOLUTION, SOURCE], bars: 4 },
        matcher: BASS_BY_EAR,
        // Eight notes: one wrong note, or the right notes on the wrong beats, scores about 0.9, above the kind's
        // default mark. A bass line is its notes and its rhythm, so every note must be right (U06.L09 does the same).
        pass: 0.95,
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "any-octave" },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: your bass plays {got} where the source plays {exp}. Play that bar of the source again; the note belongs to the chord above it.",
        },
        tests: [
          { name: "reference", response: { code: DICTATION_SOLUTION }, expect: "pass" },
          { name: "the source's own octaves", response: { code: SOURCE }, expect: "pass" },
          {
            name: "every 5th above its root",
            response: { code: dictation("<[0 ~ 4 ~] [3 ~ 7 ~] [5 ~ 9 ~] [4 ~ 8 ~]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: dictation("<0 0 0 0>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the 5ths written as 5 (degree 6)",
            response: { code: dictation("<[0 ~ 5 ~] [3 ~ 8 ~] [5 ~ 10 ~] [4 ~ 9 ~]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "a bar late",
            response: { code: dictation("<[4 ~ 8 ~] [0 ~ 4 ~] [3 ~ 7 ~] [5 ~ 9 ~]>") },
            expect: "fail",
            feedback: ["melody.first-difference"],
          },
          {
            name: "right notes, the second on beat 2",
            response: { code: dictation("<[0 4 ~ ~] [3 7 ~ ~] [5 9 ~ ~] [4 8 ~ ~]>") },
            expect: "fail",
            feedback: ["melody.rhythm-note"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "ear",
      title: "Bass under new loops",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "the-bass-under-new-loops",
        version: 1,
        role: "check",
        prompt:
          "Listen to a chord loop with its bass, in a new key each time, sometimes two chords a bar. Enter the bass degree under each chord, in order: four degrees.",
        skills: [{ skill: "E09", w: 1 }],
        hints: [
          {
            text: "Hum the lowest note under each chord. Then find home, the note the opening chords settle on.",
          },
          {
            text: "Sing down from each bass note to do and count the steps, both ends included: that is its degree.",
          },
          {
            text: "Hear it again, slower, and sing each bass note as it arrives.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.har.bass", level: 4 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: PAD,
        correct: {},
        srs: [
          { family: "fam.har.bass", mode: "review-if-due" },
          { family: "fam.mel.dictation", mode: "review-if-due" },
        ],
        tests: [],
      },
    },
    {
      id: "S4",
      kind: "sing",
      title: "Sing it back",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-what-you-took-down",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the bass line from the dictation, then sing it back, one syllable a note, eight notes: do sol, fa do, la mi, sol re. Sing in your own range; your voice does not need to reach the bass.",
        skills: [
          { skill: "V05", w: 0.6 },
          { skill: "E09", w: 0.4 },
        ],
        hints: [
          { text: "Hum do first, the note the line starts on, and hold it." },
          { text: "Each bar starts on its root and drops or climbs to the 5th. Sol sits below do here." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "echo",
        stimulus: { src: "code", code: SOURCE, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // The source's contour: C2 G1 F1 C2 A1 E2 G1 D2, so sol, fa and la sit below do.
        target: {
          from: "degrees",
          degrees: ["1", "5", "4", "1", "6", "3", "5", "2"],
          octaves: [0, -1, -1, 0, -1, 0, -1, 0],
          rhythm: "x ~ x ~",
        },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "after",
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Choose the tone",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "choose-the-tone",
        version: 1,
        role: "practice",
        prompt:
          'Change the bass sound in the highlighted part to `.s("fingerbass")` or the synth bass, `.s("sawtooth")`. Then try lower numbers in `.lpf()` for darker and higher for brighter. Keep the one that sits under the chords without covering them.',
        skills: [{ skill: "B01", w: 1 }],
        code: { starter: TONE_STARTER },
        reference: { solutions: [TONE_SOLUTION], bars: 4 },
        matcher: {
          m: "events",
          pitch: "octave-free",
          rhythm: "onsets",
          durations: false,
          tracks: ["bass"],
        },
        target: { audible: false },
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          // The bass's `.s()` is the first in the file: it must name one of today's two sounds.
          {
            c: "arg-matches",
            fn: "s",
            argIndex: 0,
            pattern: "fingerbass|sawtooth",
            feedback: "code.must-use",
          },
        ],
        feedbackText: {
          "code.must-use": 'This step is for a new tone: `.s("fingerbass")` or `.s("sawtooth")`.',
        },
        hints: ladder(
          "The bass line has a part that says what it plays and a part that says what it sounds like. Find the second.",
          '`.s()` picks the sound. Today adds two: `"fingerbass"` and `"sawtooth"`.',
          "Change the sound first and listen. Then try `.lpf()` at half the number, then at twice it, and keep what sits best.",
        ),
        tests: [
          { name: "reference", response: { code: TONE_SOLUTION }, expect: "pass" },
          {
            name: "the synth bass, a little brighter",
            response: { code: toneOf('.s("sawtooth").lpf(800)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: toneOf('.s("ebass").lpf(600)') },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "only darker, the same sound",
            response: { code: toneOf('.s("ebass").lpf(300)') },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            name: "the notes changed as well",
            response: { code: toneOf('.s("fingerbass").lpf(500)', CANONICAL_BASS) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your bass, your tone",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-bass-your-tone",
        version: 1,
        role: "practice",
        prompt:
          "The bass is a bar late: each bar plays the root of the chord before. Change it so every bar plays its own chord's root on beat 1. Then add 5ths, octaves or approach tones, and pick a bass sound. Keep the chords as they are.",
        skills: [{ skill: "B01", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "roots-on-the-one",
            label: "The bass plays each chord's root on beat 1 of its bar, in every bar",
            required: true,
            skills: ["B01"],
            rule: "matches",
            reference: { solutions: [make(bass(MAKE_ROOTS))], bars: 4 },
            matcher: ROOT_BASS,
            // "Each chord its root": every change, not three of four (corrections pass).
            min: 1,
          },
          {
            id: "a-tone-from-today",
            label: "A bass sound from today: `fingerbass` or `sawtooth`",
            required: false,
            skills: ["B01"],
            rule: "sounds",
            anyOf: ["snd.fingerbass", "snd.wave.sawtooth"],
          },
          {
            id: "more-than-roots",
            label: "At least 1 in 5 bass notes is a 5th or an octave",
            required: false,
            skills: ["B02"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            members: { allowed: ["fifth", "octave"], minRatio: 0.2 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Bar 1's chord is Am, stacked on 5 in `.add()`. Compare that with the bass's first number.",
          "The bass can take the chords' own numbers from `.add()`, one a bar, in the same order.",
          "Bar 1 is vi, stacked on 5, so the bass's first number is 5. Then a 5th on top of each root is the root plus 4.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one root a bar",
            response: { code: make(bass(MAKE_ROOTS)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: fingerbass, root–5th, an approach into each change",
            response: {
              code: make(
                bass("<[-2 ~ 2 4] [3 ~ 0 -1] [0 ~ 4 5] [4 ~ 1 -1]>", '.s("fingerbass").lpf(700)'),
                "rhodes",
              ),
            },
            expect: "pass",
          },
          {
            name: "the synth bass on the roots in eighths",
            response: { code: make(bass("<[5*8] [3*8] [0*8] [4*8]>", '.s("sawtooth").lpf(400)')) },
            expect: "pass",
          },
          {
            name: "every root a beat late",
            response: { code: make(bass("<[4 5 5 5] [5 3 3 3] [3 0 0 0] [0 4 4 4]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "three roots right, the last chord left on C",
            response: { code: make(bass("<5 3 0 0>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "roots on beat 1, each with its 5th on beat 3",
            response: { code: make(bass("<[5 ~ 9 ~] [3 ~ 7 ~] [0 ~ 4 ~] [4 ~ 8 ~]>")) },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
