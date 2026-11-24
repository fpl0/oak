// U17.L04 Transcribing Through a Key Change. A tune written down through its key change: find the bar where home
// moves and the new do, and from there the degrees work as they always have, one line of numbers and a key plan
// that says which key they mean (`.scale("<F4:major!4 G4:major!4>")`, U17.L02). Two pieces, both heard before
// they are seen: a pop chorus in F that comes round again a whole step up, in G (the tune, by ear, written once
// and extended by a key plan), and a ballad that leaves D♭ for D, a half step up, at the start of its middle
// section (the bass, by ear). What the learner has: the key plan after U17.L02, hearing where a key changes and by
// how much (U17.L03, U17.L02 S5), tunes and basses taken down by ear since U03.L10 and U08.L05, roots under chords
// since U08.L01. No new term, no new tool, no new drill. Spec: content/specs/U17.md.
//
// The standard: the spec names the end of Body and Soul's second A section and the first bars of its bridge, from
// the verified answer key of `song.body-and-soul`. That answer key does not exist yet (no content/repertoire/
// body-and-soul, no human verifier), so S4 and S5 take the spec's fallback: an Oak ballad of six bars in the same
// shape, D♭ major into D major a half step up, the new key announced by its own ii and V7 (Em7 A7) at the start
// of bar 3. The lesson names no standard and quotes none; the standard is offered in the gym once it is verified.
//
// How it is graded (AUTHORING §16.4, §19.7): the feature `key-plan` is not implemented in content CI yet, so no
// exercise declares `keyPlan`. Both dictations compare pitches as heard (`melody`, `octave-free`: any octave,
// but the notes themselves, so a line left in the first key, or lifted by the wrong amount, differs note by note)
// and override `melody.wrong-degree`, whose catalog text would word a note of the lifted bars in degrees of the
// first key. A dictation takes no constraints, so `.transpose()` after `.scale()` is not refused here: it plays
// the right notes and the lint tells the learner to write a key plan instead (`code.transpose-after-scale`).
// "Where" is `bar-buttons`, "how far" a `choice`. The Make's one required rule is `bass-line` with the roots on
// every chord change (implemented): the starter has no bass, and a bass that stays in F under the second chorus
// meets four of the eight changes.
import { defineLesson, type HintLadder, type IdentifyEx, type Matcher } from "@oak/content-kit";

const BPM = 104;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the pop chorus (S1–S3, S6): four bars in F, the same four in G ----------------------------------------

/**
 * The chorus tune in degrees, written once: A C A | F A | B♭ D B♭ | G in F (3 5 3 | 1 3 | 4 6 4 | 2), a chord note
 * on every beat it sounds. Under the key plan the same numbers play B D B | G B | C E C | A in G.
 */
const TUNE = "<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>";
/** Chords by name, every one moved up a whole step at bar 5 (I vi IV V in both keys). */
const CHORDS = 'chords: chord("<F Dm Bb C G Em C D>").voicing().struct("x ~ x ~").s("piano")';
const BASS = 'bass: n("<0 5 3 4>").struct("x ~ x x").scale("<F2:major!4 G2:major!4>").s("ebass").lpf(700)';
const mel = (tune: string, scale: string) => `mel: n("${tune}").scale("${scale}").s("piano")`;
const PLAN = "<F4:major!4 G4:major!4>";
/** The hook and the source of S2 and S3: the chorus, then the chorus a whole step up. */
const HOOK = code(CHORDS, BASS, mel(TUNE, PLAN));

/** S3: the tune alone, as the learner writes it; the first note (degree 3, `n` 2) is given. */
const tuneAlone = (tune: string, scale: string) => code(mel(tune, scale));
const TUNE_SOLUTION = tuneAlone(TUNE, PLAN);
const TUNE_STARTER = tuneAlone("<⟪[2 ~ ~ ~]⟫>", "⟪F4:major⟫");
const MEL_BY_EAR: Matcher = {
  m: "melody",
  pitch: "octave-free",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 16],
  track: "mel",
};

// --- the ballad (S4, S5): six bars, D♭ major into D major a half step up ------------------------------------

/**
 * Oak's ballad at 72: the end of a section in D♭ (Ebm7 Ab7 | Db, ii V I), then the middle section in D,
 * announced by its own ii and V7 (Em7 A7 | D | Bm7 Em7 | A7). Home is a plain triad, not a major seventh chord:
 * the tenor lands on do in bars 2 and 4, and a Dmaj7 voicing puts its C♯ a half step under that D (content
 * integration, u12-u17-music.test.ts; the 6 chord is a jazz-track chord, locked here). Evaluated: the bass plays E♭ A♭ | D♭ | E A | D |
 * B E | A; the tenor G♭ F E♭ | D♭ F A♭ | G F♯ E | D F♯ A | B A G E | C♯ A. The bass and the tune sing the same
 * degrees on both sides of the change; only the key under them moves.
 */
const BALLAD_BPM = 72;
const BALLAD_TEMPO = `setcpm(${BALLAD_BPM}/4)\n\n`;
const ballad = (...lines: string[]) => `${BALLAD_TEMPO}${lines.join("\n")}`;
const BALLAD_CHORDS = 'chords: chord("<[Ebm7 Ab7] Db [Em7 A7] D [Bm7 Em7] A7>").voicing().s("rhodes")';
const BALLAD_ROOTS = "<[1 4] 0 [1 4] 0 [5 1] 4>";
const BALLAD_PLAN = "<Db2:major!2 D2:major!4>";
const balladBass = (roots: string, scale: string, tail = "") =>
  `bass: n("${roots}").scale("${scale}")${tail}.s("upright")`;
const BALLAD_MEL =
  'mel: n("<[3 2 1 ~] [0@2 2 4] [3 2 1 ~] [0@2 2 4] [5 4 3 1] [6 ~ 4 ~]>").scale("<Db4:major!2 D4:major!4>").s("tenor")';
const BALLAD = ballad(BALLAD_CHORDS, balladBass(BALLAD_ROOTS, BALLAD_PLAN), BALLAD_MEL);

/** S5: the bass alone, as the learner writes it; the first root (degree 2, `n` 1) is given. */
const bassAlone = (roots: string, scale: string, tail = "") => ballad(balladBass(roots, scale, tail));
const BASS_SOLUTION = bassAlone(BALLAD_ROOTS, BALLAD_PLAN);
const BASS_STARTER = bassAlone("<⟪[1 ~]⟫>", "⟪Db2:major⟫");
const BASS_BY_EAR: Matcher = {
  m: "melody",
  pitch: "octave-free",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 8],
  track: "bass",
};

// --- the Make: the chorus with its chords and its tune, and no bass -----------------------------------------

/**
 * The chords are held for the bar here: `bass-line` counts every chord onset as a change, so under chords struck
 * on beats 1 and 3 a bass that moves to the 5th on beat 3 would read as a missed root.
 */
const MAKE_CHORDS = 'chords: chord("<F Dm Bb C G Em C D>").voicing().s("piano")';
const MAKE_STARTER = code(MAKE_CHORDS, mel(TUNE, PLAN));
const withBass = (bassLine: string, ...extra: string[]) =>
  code(bassLine, MAKE_CHORDS, mel(TUNE, PLAN), ...extra);
/** The smallest bass that passes: one root a bar, in degrees, with the tune's key plan. */
const MAKE_MINIMAL = withBass('bass: n("<0 5 3 4>").scale("<F2:major!4 G2:major!4>").s("ebass").lpf(700)');
/** The same roots written out as notes, both keys by hand. */
const MAKE_NOTES = withBass('bass: note("<f2 d2 bb1 c2 g2 e2 c2 d2>").s("ebass").lpf(700)');
/**
 * Beyond the brief: root, the chord's 5th under it and root again under every chord (F C F | D A D | B♭ F B♭ | C G C, the same
 * numbers a whole step up in G), and strings that come in for the second chorus only.
 */
const MAKE_RICH = withBass(
  'bass: n("<[0 ~ -3 0] [5 ~ 2 5] [3 ~ 0 3] [4 ~ 1 4]>").scale("<F2:major!4 G2:major!4>").s("ebass").lpf(700)',
  'pad: chord("<F Dm Bb C G Em C D>").voicing().s("strings").gain("<0!4 .4!4>")',
);
/** The bass written for the first chorus only: it stays in F under the second. */
const MAKE_STAYS_IN_F = withBass('bass: n("<0 5 3 4>").scale("F2:major").s("ebass").lpf(700)');

/** Drums from the Band; chords, bass and tune are in the learner's code, where the rules read them. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const F_MAJOR = { tonic: "F", mode: "major" } as const;
const D_FLAT_MAJOR = { tonic: "Db", mode: "major" } as const;

/** S2: both questions are asked of the hook, heard and not seen. */
const HOOK_STIMULUS = { src: "code", code: HOOK, bars: 8, showCode: false } as const;
const HEARD = { context: "none", countInBars: 0, click: false, replays: -1 } as const;
const WHERE: IdentifyEx = {
  kind: "identify",
  id: "where-home-moves",
  version: 1,
  role: "check",
  prompt: "Mark the first bar in the new key.",
  skills: [{ skill: "E13", w: 1 }],
  hints: ladder(
    "Hum do along with bar 1. In which bar does your hum stop belonging to the music?",
    "Count the bars from 1 as you listen. The tune starts again from its beginning in the bar where the key changes.",
    "The first four bars are the chorus in its first key. Listen to the bar that follows them.",
  ),
  stimulus: HOOK_STIMULUS,
  cue: HEARD,
  answer: { ui: "bar-buttons", bars: 8 },
  correct: { number: 5 },
  feedbackText: {
    "id.wrong":
      "Bar {got} is still in the key around it. Hum do through the chorus and listen for the bar where the tune starts again, higher.",
  },
  tests: [
    { name: "bar 5", response: { answer: { number: 5 } }, expect: "pass" },
    {
      name: "bar 4: the last bar in the old key",
      response: { answer: { number: 4 } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
    {
      name: "bar 6: one bar late",
      response: { answer: { number: 6 } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
};
const HOW_FAR: IdentifyEx = {
  kind: "identify",
  id: "how-far-it-lifts",
  version: 1,
  role: "check",
  prompt: "Pick the size of the lift at the key change.",
  skills: [{ skill: "E13", w: 1 }],
  hints: ladder(
    "Sing the first note of the chorus, then the first note of the chorus after the change. How far apart are they?",
    "A half step is the next key up, black or white; a whole step skips one.",
    "Hear it again, slower, and sing the two first notes one after the other.",
  ),
  stimulus: HOOK_STIMULUS,
  cue: HEARD,
  answer: {
    ui: "choice",
    options: [
      { id: "half-step", label: "A half step" },
      { id: "whole-step", label: "A whole step" },
    ],
  },
  correct: { choice: ["whole-step"] },
  // The catalog's `id.wrong` names the option ids and the answer ("That was half-step, not whole-step"). This says
  // what to compare, not the size (contracts §5.3); the hint ladder narrows it and the reveal gives it.
  feedbackText: {
    "id.wrong":
      "Not this time. Sing the first note of the chorus, then its first note after the change, one after the other: are they neighbouring keys on the keyboard, black or white, or is there one between them?",
  },
  tests: [
    { name: "a whole step", response: { answer: { choice: ["whole-step"] } }, expect: "pass" },
    {
      name: "a half step",
      response: { answer: { choice: ["half-step"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
};

export default defineLesson({
  id: "U17.L04",
  version: 4,
  title: "Transcribing Through a Key Change",
  objective:
    "I can write a tune down through its key change: find the bar where home moves and the new do, then write the degrees once and give them a key plan.",
  key: F_MAJOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E13"],
  terms: [],
  canDo: ["cd.transcribe.key-change"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A chorus, twice",
      minutes: 0.5,
      // Code and roll hidden: where the key changes is found by ear in S2 before anything is shown.
      ui: { panels: NONE, band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "a-chorus-twice",
        version: 1,
        role: "practice",
        prompt:
          "Listen to this eight-bar pop chorus, with nothing to read. Once bar 1 has settled, hum do softly and keep humming it under the tune. Listen for the bar where your do stops fitting.",
        skills: [{ skill: "E13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Count the bars as you hum. Home moves once.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "Where and how far",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "where-and-how-far",
        version: 1,
        role: "check",
        prompt:
          "Answer two questions about the same eight bars, by ear. First: mark the first bar in the new key. Second: pick how far the music lifts there.",
        skills: [{ skill: "E13", w: 1 }],
        hints: ladder(
          "Hum do along with bar 1. Where does your hum stop belonging to the music?",
          "The tune starts again from its beginning in the bar where the key changes. Compare its first note there with its first note in bar 1.",
          "The first four bars are the chorus in its first key. Listen to the bar that follows them, and sing the two first notes one after the other.",
        ),
        srs: [{ family: "fam.har.modulation", mode: "review-if-due" }],
        tests: [],
        parts: [WHERE, HOW_FAR],
      },
    },
    {
      id: "S3",
      kind: "dictate",
      title: "Take the tune down",
      minutes: 2.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "dictation",
        id: "take-the-tune-down",
        version: 1,
        role: "check",
        prompt:
          "Write the chorus tune in `n`, bars 1 to 4 only; the first note is given, degree 3 (`n` 2). Then change `.scale()` to a key plan: F major for 4 bars, then the key of the new do you heard for 4 bars. Done when your line matches all 8 bars of the source. Any octave passes.",
        skills: [
          { skill: "E13", w: 0.5 },
          { skill: "E07", w: 0.5 },
        ],
        hints: ladder(
          "Compare bar 5 with bar 1: the chorus starts again there. Is it a new tune, or the same tune from another note?",
          "Bars 5 to 8 sing the same degrees as bars 1 to 4, from a new do. So the numbers are written once, inside `< >`, and the key plan in `.scale()` does the rest. `n` counts from 0: degree 3 is `n` 2.",
          "Bar 1 is degrees 3, 5, 3: `[2 ~ 4 2]`. The key plan holds F major for four bars, then the key a whole step above F for four.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: HOOK, bars: 8, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: TUNE_STARTER },
        reference: { solutions: [TUNE_SOLUTION], bars: 8 },
        matcher: MEL_BY_EAR,
        // Raised from the dictation default (0.85): one note heard wrong comes back in the lifted bars, and a tune
        // this short is passed when every note is right (U14.L02 does the same).
        pass: 0.95,
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "any-octave" },
        srs: [{ family: "fam.mel.dictation", mode: "review-if-due" }],
        // Until the key plan reaches grading, a wrong note of bars 5 to 8 would be worded in degrees of F.
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: not the note the tune plays there. Bars 1 to 4 are in F major; bars 5 to 8 sing the same numbers from the new do. Check the numbers, the second key and the counts after `!`.",
        },
        tests: [
          { name: "reference", response: { code: TUNE_SOLUTION }, expect: "pass" },
          {
            name: "an octave lower, every bar's key written out",
            response: {
              code: tuneAlone(
                TUNE,
                "<F3:major F3:major F3:major F3:major G3:major G3:major G3:major G3:major>",
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: tuneAlone("<[2 ~ ~ ~]>", "F4:major") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "bars 5 to 8 written as new numbers in F: B♭ where the tune has B",
            response: {
              code: tuneAlone(
                "<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~] [3 ~ 5 3] [1 ~ 3 ~] [4 ~ 6 4] [2 ~ ~ ~]>",
                "F4:major",
              ),
            },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the plan counted two and six",
            response: { code: tuneAlone(TUNE, "<F4:major!2 G4:major!6>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "four bars written, no key plan: the tune repeats in F",
            response: { code: tuneAlone(TUNE, "F4:major") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "listen",
      title: "A ballad moves up",
      minutes: 0.5,
      // Nothing shown: the bass of these six bars is taken down by ear in S5.
      ui: { panels: NONE },
      exercise: {
        kind: "listen",
        id: "a-ballad-moves-up",
        version: 1,
        role: "practice",
        key: D_FLAT_MAJOR,
        bpm: BALLAD_BPM,
        prompt:
          "Listen to six bars of a slow ballad for Rhodes, upright bass and tenor sax, in the manner of the standards of 1930. It starts in D♭ major, and home moves once. Listen for the bar where it moves, and whether home goes up or down.",
        skills: [{ skill: "E13", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: BALLAD, caption: "Follow the tenor: its first phrase comes back.", bars: 6 }],
      },
    },
    {
      id: "S5",
      kind: "dictate",
      title: "The bass through the door",
      minutes: 2,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "dictation",
        id: "the-bass-through-the-door",
        version: 1,
        role: "check",
        key: D_FLAT_MAJOR,
        bpm: BALLAD_BPM,
        prompt:
          "Write the ballad's bass roots in `n`, each a degree of the key in force; it starts on degree 2 of D♭ major (`n` 1, given). Home moves at bar 3: change `.scale()` to a key plan, D♭ major for bars 1 and 2, then the new key for bars 3 to 6. Any octave passes.",
        skills: [
          { skill: "E13", w: 0.5 },
          { skill: "E09", w: 0.5 },
        ],
        hints: ladder(
          "Find the new do first: sing the bass note where bar 4 settles. Is it above D♭ or below it, and by how much?",
          "Sing the bass note under bar 4's chord, where the music settles, against D♭: that is the new do. The plan holds D♭ major for two bars, then the new key for four.",
          "Bar 1 is degrees 2 and 5 of D♭: `[1 4]`. Bars 3 and 4 do the same as bars 1 and 2, a half step higher.",
        ),
        domain: "bass",
        stimulus: { src: "code", code: BALLAD, bars: 6, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: BASS_STARTER },
        reference: { solutions: [BASS_SOLUTION], bars: 6 },
        matcher: BASS_BY_EAR,
        // Nine notes: one wrong root scores about 0.9. A bass line is its roots, so every one must be right.
        pass: 0.95,
        byEar: {
          ab: true,
          rates: [1, 0.75, 0.5],
          accepts: "any-octave",
          parts: [
            { track: "bass", label: "The bass: the root of each chord", matcher: BASS_BY_EAR, pass: 0.95 },
          ],
        },
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: not the root the bass plays there. Bars 1 and 2 are in D♭ major; from bar 3 the degrees belong to the new key. Check the new do and the counts after `!`.",
        },
        tests: [
          { name: "reference", response: { code: BASS_SOLUTION }, expect: "pass" },
          {
            name: "an octave lower, every bar's key written out",
            response: {
              code: bassAlone(BALLAD_ROOTS, "<Db1:major Db1:major D1:major D1:major D1:major D1:major>"),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: bassAlone("<[1 ~]>", "Db2:major") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "everything read in D♭: the middle section's roots a half step low",
            response: { code: bassAlone(BALLAD_ROOTS, "Db2:major") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the new key guessed a whole step up, E♭",
            response: { code: bassAlone(BALLAD_ROOTS, "<Db2:major!2 Eb2:major!4>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your bass, both keys",
      minutes: 2.75,
      ui: { panels: ROLL, band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-bass-both-keys",
        version: 1,
        role: "practice",
        prompt:
          "Add a `bass:` line that plays the root of every chord: F Dm B♭ C, then G Em C D. Write it once in degrees with a key plan, as the tune has, to follow the chords up to G. Done when it lands on each root in both keys. These eight bars play just before your song's last chorus.",
        skills: [
          { skill: "E13", w: 0.5 },
          { skill: "B01", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [8, 16],
        saveAs: "sketch",
        rubric: [
          {
            id: "roots-in-both-keys",
            label: "The bass plays the chord's root on at least 3 of every 4 chord changes, across both keys",
            required: true,
            skills: ["E13", "B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
          {
            id: "still-the-song",
            label: "The tune still plays the song's notes, in both keys",
            required: false,
            skills: ["E13"],
            rule: "matches",
            min: 0.85,
            reference: { solutions: [MAKE_MINIMAL], bars: 8 },
            matcher: {
              m: "melody",
              pitch: "absolute",
              wPitch: 0.8,
              wRhythm: 0.2,
              rhythmTol: [1, 16],
              track: "mel",
            },
          },
          {
            id: "something-new",
            label: "Your code has a fourth line, such as a `pad:`",
            required: false,
            skills: ["F02"],
            rule: "tracks",
            min: 4,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with the note a bass has played on each new chord since Roots Down Low. Which note of the chord is that?",
          "Add a `bass:` line in degrees on octave 2, one root a bar to start. The chords go F Dm B♭ C, then the same four a whole step up: the bass needs the same key plan as the tune.",
          "Bar 1's root is F, degree 1, `n` 0; bar 2's is D, degree 6, `n` 5. The plan starts `<F2:major!4` and holds the second key for four bars.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one root a bar with a key plan",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          { name: "the roots written out as notes", response: { code: MAKE_NOTES }, expect: "pass" },
          {
            name: "beyond the brief: root, 5th and root under every chord, strings for the second chorus",
            response: { code: MAKE_RICH },
            expect: "pass",
          },
          {
            name: "the bass stays in F under the second chorus",
            response: { code: MAKE_STAYS_IN_F },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
