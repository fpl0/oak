// U13.L05 Triplets. A triplet puts three equal notes where two would go: for one beat, 4/4 borrows the
// three-feel of yesterday's 6/8. It is also what the swing of U11.L07 was made of: the long–short pair is the
// first and third note of a triplet (`s("hh*8").swingBy(1/3, 4)` and `s("[hh ~ hh]*4")` sound at the same
// moments; evaluated). In code a triplet is a bracket of three, which has been legal since U01, and `.ply(3)`
// plays every step of a line three times in its own time; a patterned `.ply("<1 1 1 [1 1 1 3]>")` writes a roll
// into one beat of one bar. On the staff it is three notes under a bracket with a 3. What the learner has: 6/8 and
// 12/8 with the dotted-quarter beat (U13.L04), swing as "long–short, two thirds of the way through the beat"
// (U11.L07), the doo-wop Band's piano triplets heard with no name (U06.L07), `.velocity()` (U13.L02). Not yet:
// quarter-note triplets, fives and sevens, three against two (rhythm track); triplet staff writing
// (`fam.rhy.dictation` level 7, after U13.L06). Spec: content/specs/U13.md.
//
// How it is graded: the modify step compares the rhythm of the `chords` line (`[x x x]*4` and `x*12` pass as
// well as `.ply(3)`) and its chords at every onset (`pcset`: a hat or one note in their place is no chord);
// `.ply(3)` written before `.struct()` multiplies nothing the ear can hear and fails like `.ply(2)`. The read-it step is a staff-read answered in code, compared note for note in absolute pitch with
// lengths. The ear step is `fam.rhy.subdivision` at level 1, which this lesson seeds. The Make's one required
// rule is `tuplets-every-bar`: one line plays all three triplet places of every beat in every bar, which the
// starter's eighths never do and two hits early in each bar do not.
//
// Band: none (`band: false`). The doo-wop Band plays these piano triplets itself, and two pianos in threes would
// be a blur; every other Band's drums would double the learner's lines. The starter carries the whole section.
import { BEAT_DIVISION_OPTIONS, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 76;
const TEMPO = `setcpm(${BPM}/4)\n\n`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** U13.L04's ballad chords, back in 4/4: Imaj7 vi7 IVmaj7 V7 in C. */
const changes = (form: string) => `const changes = "${form}"`;
const LOOP = "<C^7 Am7 F^7 G7>";
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
/** Three snare hits in beat 4 of bar 4, a roll into the repeat. */
const SNARE_ROLL = 'snare: s("~ sd ~ sd").ply("<1 1 1 [1 1 1 3]>")';
const HATS_EIGHTHS = 'hats: s("hh*8").gain(.5)';
/** Twelve hats a bar, loud on each beat. */
const HATS_THREES = 'hats: s("hh*4").ply(3).velocity("[1 .5 .6]*4").gain(.5)';
const BASS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("fingerbass").lpf(800)';
const piano = (rhythm: string) => `chords: chord(changes).voicing()${rhythm}.s("piano").gain(.6)`;
const QUARTERS = '.struct("x*4")';
const THREES = '.struct("x*4").ply(3)';
const song = (form: string, ...lines: string[]) => `${TEMPO}${changes(form)}\n\n${lines.join("\n")}`;

const EVEN = song(LOOP, KICK, SNARE, HATS_EIGHTHS, BASS, piano('.struct("x*8")'));
const HOOK = song(LOOP, KICK, SNARE_ROLL, HATS_THREES, BASS, piano(THREES));

/** S3: four hats, each played three times. */
const PREDICT = `${TEMPO}${[KICK, SNARE, 'hats: s("hh*4").ply(3).gain(.5)'].join("\n")}`;
/** S4: the triplet hats alone over kick and snare (roll and percussion staff). */
const DRUMS_THREES = PREDICT;

/** S5: the piano on plain quarter notes under triplet hats; only the piano line is editable. */
const s5 = (chordLine: string) => song(LOOP, KICK, SNARE, HATS_THREES, BASS, chordLine);
const S5_STARTER = s5('chords: ⟪chord(changes).voicing().struct("x*4").s("piano").gain(.6)⟫');
const S5_SOLUTION = s5(piano(THREES));
/** The new rhythm, and still the chords: the notes of each chord at every onset (a hat or one note is no chord). */
const CHORD_RHYTHM: Matcher = {
  m: "all",
  of: [
    {
      m: "rhythm",
      tol: [1, 32],
      durations: false,
      perRole: false,
      displacementCredit: 0.5,
      tracks: ["chords"],
    },
    { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
  ],
};

/** S6: one bar to read: a quarter note, a triplet, a quarter note, a triplet (C, E G C, G, E D C). */
const mel = (pattern: string) => `${TEMPO}mel: n("${pattern}").scale("C4:major").s("piano")`;
const READ_BAR = "0 [2 4 7] 4 [2 1 0]";
const READ_SOURCE = mel(READ_BAR);

/** The Make: I vi ii V on plain quarters, even hats, kick and snare, a bass on 1 and 3. */
const MAKE_LOOP = "<C^7 Am7 Dm7 G7>";
const MAKE_STARTER = song(MAKE_LOOP, KICK, SNARE, HATS_EIGHTHS, BASS, piano(QUARTERS));
const MAKE_MINIMAL = song(MAKE_LOOP, KICK, SNARE, HATS_EIGHTHS, BASS, piano(THREES));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U13.L05",
  version: 3,
  title: "Triplets",
  objective:
    "I can play three even notes in the time of two with .ply(3) or a bracket of three, write a roll, and read a triplet on the staff.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R12", "N09"],
  practises: [],
  terms: [{ id: "term.triplet", step: "S4" }],
  canDo: ["cd.code.triplets"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Square, then rolling",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "square-then-rolling",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the piano and the hats against the square kick and snare. Notice in which loop they walk and in which they roll, and listen for the snare at the very end of bar 4.",
        skills: [{ skill: "R12", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: EVEN, caption: "Loop 1: the piano and the hats in even eighths.", bars: 4 },
          {
            code: HOOK,
            caption: "Loop 2: the same chords and drums. Keep an ear on the end of bar 4.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Echo the threes",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "echo-the-threes",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two bars, then tap their rhythm back, one tap per note. Some beats hold two notes and some hold three: say “1 trip let” under your breath for the beats in three, and tap three even taps there.",
        skills: [{ skill: "R12", w: 1 }],
        hints: ladder(
          "One tap per note you heard. Which beats were busiest, and were their notes even?",
          "Count each beat while it plays: “1 &” for two notes, “1 trip let” for three.",
          "Tap the beats first, then fill in the busy ones: three even taps where you said “1 trip let”.",
        ),
        mode: "echo",
        stimulus: { src: "generator", family: "fam.rhy.echo", level: 6 },
        cue: { context: "none", countInBars: 1, click: true, replays: 2 },
        bars: 2,
        target: {},
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        srs: [{ family: "fam.rhy.echo", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "Count the hats",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "count-the-hats",
        version: 1,
        role: "practice",
        prompt:
          '`.ply(3)` plays every step of the pattern on its left three times, in the time of that step. Here it follows `s("hh*4")`, four hats. Predict how many hats you will hear in each bar, and enter that number.',
        skills: [{ skill: "R12", w: 1 }],
        hints: null,
        tests: [],
        code: PREDICT,
        bars: 2,
        mode: "count",
        correct: 12,
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Three where two go",
      minutes: 1,
      ui: { panels: { roll: true, staff: "perc", keyboard: false }, rollLabels: "none", band: false },
      example: { id: "threes", code: DRUMS_THREES, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "three-where-two-go",
        version: 1,
        role: "practice",
        prompt:
          'Run it and look at the roll and the staff: each beat holds three even hats. Then try each answer line in place of the hats line. Answer both questions: which line matches the swung eighths of Shuffle, `s("hh*8").swingBy(1/3, 4)`, and into how many parts the hats cut each beat.',
        skills: [{ skill: "R12", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Swing put the second eighth two thirds of the way through the beat. Count “1 trip let” and find which of the three hats a swung pair lands on.",
        },
        hints: ladder(
          "A swung pair is long, then short. Where in the beat does the short note start?",
          "Two thirds of the way through the beat is where the third of three even notes starts.",
          "Swing keeps the first of the three and the third, and leaves the middle one out.",
        ),
        code: { starter: DRUMS_THREES },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which line plays exactly the rhythm of the swung hats?",
            options: [
              { id: "first-and-third", label: '`s("[hh ~ hh]*4")`' },
              { id: "first-and-second", label: '`s("[hh hh ~]*4")`' },
              { id: "all-three", label: '`s("hh*4").ply(3)`' },
            ],
            correct: ["first-and-third"],
          },
          { q: "number", prompt: "Into how many equal parts do the hats here cut each beat?", correct: 3 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["first-and-third"], number: 3 } },
            expect: "pass",
          },
          {
            name: "the first and second of the three",
            response: { answer: { choice: ["first-and-second"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two parts",
            response: { answer: { choice: ["first-and-third"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "The piano in threes",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "the-piano-in-threes",
        version: 1,
        role: "check",
        prompt:
          "The hats already move in triplets; the piano still plays one chord a beat. Make the piano play three even chords on every beat, with the hats. Keep its chords: change only its rhythm. Done when the piano plays twelve chords a bar.",
        skills: [{ skill: "R12", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 4 },
        matcher: CHORD_RHYTHM,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: the piano plays {got}; the chord there is {exp}. Keep `chord(changes).voicing()` and change only its rhythm.",
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "The piano needs three chords where it now has one. How do the hats get three notes out of each of their four steps?",
          "The hats line takes `.ply()` after its pattern. The piano's rhythm comes from `.struct()`, so its call goes after that.",
          'The line keeps `.struct("x*4")` and gains one call before `.s("piano")`.',
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          {
            name: "three to the beat written in the rhythm",
            response: { code: s5(piano('.struct("[x x x]*4")')) },
            expect: "pass",
          },
          { name: "twelve even steps", response: { code: s5(piano('.struct("x*12")')) }, expect: "pass" },
          {
            name: "a pattern of one value",
            response: { code: s5(piano('.struct("x*4").ply("3")')) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s5(piano(QUARTERS)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "two to the beat: eighths",
            response: { code: s5(piano('.struct("x*4").ply(2)')) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "one note in place of the chords, in triplets",
            response: { code: s5('chords: note("c#4").struct("x*4").ply(3).s("piano").gain(.6)') },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "hats in place of the piano chords",
            response: { code: s5('chords: s("hh*12")') },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the triplets on the Rhodes, the chords the same",
            response: {
              code: s5('chords: chord(changes).voicing().struct("x*4").ply(3).s("rhodes").gain(.6)'),
            },
            expect: "pass",
          },
          {
            name: "the call before the rhythm: still quarters",
            response: { code: s5(piano('.ply(3).struct("x*4")')) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Read it",
      minutes: 1,
      graded: true,
      ui: { panels: { roll: false, staff: "treble", keyboard: false }, staffLabels: "none", band: false },
      exercise: {
        kind: "staff-read",
        id: "read-the-triplets",
        version: 1,
        role: "check",
        prompt:
          "No sound this time. Read the bar on the staff: a quarter note, a triplet, a quarter note, a triplet. Write it in the `n()` string, one step per beat, with C major numbers from middle C (`0` is C). The starter already has beats 1 and 3 as `0` and `4`.",
        skills: [
          { skill: "N09", w: 0.7 },
          { skill: "R12", w: 0.3 },
        ],
        source: READ_SOURCE,
        bars: 1,
        answer: { ui: "code", starter: mel("⟪0 ~ 4 ~⟫") },
        reference: { solutions: [READ_SOURCE], bars: 1 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets+durations",
          durations: true,
          tracks: ["mel"],
        },
        hints: ladder(
          "Replace each `~` with the beat it stands for. How many beats does the bar have, and which of them hold three notes?",
          "A quarter note is one step of four. A triplet shares one beat between three notes: a bracket of three inside one step.",
          "Beat 1 is `0` and beat 3 is `4`. Beat 2 is a bracket of three notes, `[2 4 …]`.",
        ),
        srs: [{ family: "fam.rhy.read", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: READ_SOURCE }, expect: "pass" },
          {
            name: "the same notes on the Rhodes",
            response: { code: mel(READ_BAR).replace('s("piano")', 's("rhodes")') },
            expect: "pass",
          },
          {
            name: "the triplet read as two eighths and a quarter",
            response: { code: mel("0 [2 4] 7 [2 1 0]") },
            expect: "fail",
            feedback: ["melody.missing-note", "melody.extra-note"],
          },
          {
            name: "four notes for three",
            response: { code: mel("0 [2 4 7 4] 4 [2 1 0]") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "the triplets on beats 1 and 3",
            response: { code: mel("[0 2 4] 7 [4 2 1] 0") },
            expect: "fail",
            feedback: ["melody.extra-note", "melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "ear",
      title: "Two or three",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "two-or-three",
        version: 1,
        role: "check",
        prompt:
          "Two bars of hats over a kick and a snare, a new groove each time. Pick whether the hats move two to the beat or three.",
        skills: [{ skill: "R12", w: 1 }],
        hints: [
          {
            text: "Follow the kick and the snare: they mark the beats. How many hats fit between two of them?",
          },
          { text: "Say “1 & 2 &” along with it, then “1 trip let 2 trip let”. Which one fits the hats?" },
          { text: "Listen again slower and count the hats in one beat.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.rhy.subdivision", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "eighths", label: BEAT_DIVISION_OPTIONS[0]?.label ?? "Two to the beat (eighths)" },
            { id: "triplets", label: BEAT_DIVISION_OPTIONS[1]?.label ?? "Three to the beat (triplets)" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.rhy.subdivision", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your slow dance",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-slow-dance",
        version: 1,
        role: "practice",
        prompt:
          "Put the piano or the hats in triplets: three even notes on every beat, through every bar, with `.ply(3)` or brackets of three. Then, if you like, roll the snare into the repeat with three hits in beat 4 of bar 4, and float a tune over the threes.",
        skills: [{ skill: "R12", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "triplets-every-bar",
            label: "The piano (`chords:`) or the hats play three even notes on every beat of every bar",
            required: true,
            skills: ["R12"],
            rule: "custom",
            fn: "tuplets-every-bar",
            // Corrections gate (AS-25): the piano or the hats, as the brief says; a new rimshot line does not count.
            params: { track: ["chords", "hats"], drums: ["hatClosed", "hatOpen", "ride"] },
          },
          {
            id: "snare-roll",
            label: "The snare plays three even hits in beat 4 of bar 4",
            required: false,
            skills: ["R12"],
            rule: "onsets",
            track: "@drums",
            drum: "snare",
            contains: [
              [15, 4],
              [23, 6],
              [47, 12],
            ],
            perBar: false,
          },
          {
            id: "tune-on-chord-tones",
            label: "On at least 6 of every 10 strong beats, the `mel:` tune plays a note of the chord",
            required: false,
            skills: ["R12"],
            rule: "chord-tones-strong",
            melody: "mel",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.6,
          },
          {
            id: "slow-dance-tempo",
            label: "A tempo from 60 to 84 beats a minute",
            required: false,
            skills: ["R12"],
            rule: "tempo-bpm",
            min: 60,
            max: 84,
          },
        ],
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Check your lines against the item, then run it again.",
        },
        hints: ladder(
          "One line has to play three even notes on every beat, in every bar. Which line could do that without changing its chords?",
          "`.ply(3)` after a line's rhythm plays each of its steps three times. Put it on the piano or the hats.",
          "On the piano it goes after `.struct()`; on the hats, write four hats and multiply them.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the piano in triplets", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: triplet hats and piano, a roll, and a tune over the threes",
            response: {
              code: song(
                MAKE_LOOP,
                KICK,
                SNARE_ROLL,
                HATS_THREES,
                BASS,
                piano(THREES),
                'mel: n("<[4 ~ 2 ~] [2 ~ 0 ~] [3 ~ [1 2] 3] [1@3 ~]>").scale("C5:major").s("rhodes")',
              ),
            },
            expect: "pass",
          },
          {
            name: "a roll in bar 4 only, the rest square",
            response: { code: song(MAKE_LOOP, KICK, SNARE_ROLL, HATS_EIGHTHS, BASS, piano(QUARTERS)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "two hits early in each bar, the rest of the bar square",
            response: {
              code: song(
                MAKE_LOOP,
                KICK,
                SNARE,
                HATS_EIGHTHS,
                BASS,
                piano('.struct("~ x x ~ ~ ~ ~ ~ ~ ~ ~ ~")'),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hats in threes, the piano left on the beats",
            response: { code: song(MAKE_LOOP, KICK, SNARE, HATS_THREES, BASS, piano(QUARTERS)) },
            expect: "pass",
          },
          {
            name: "the piano's triplets written out, three to each beat",
            response: {
              code: song(MAKE_LOOP, KICK, SNARE, HATS_EIGHTHS, BASS, piano('.struct("[x x x]*4")')),
            },
            expect: "pass",
          },
          {
            name: "the piano in eighths: two to the beat",
            response: {
              code: song(MAKE_LOOP, KICK, SNARE, HATS_EIGHTHS, BASS, piano('.struct("x*4").ply(2)')),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
