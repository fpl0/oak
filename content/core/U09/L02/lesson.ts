// U09.L02 Verse & Chorus (exemplar of U09). A song is built from sections that contrast: the verse, whose
// music comes back with new words, and the chorus, which comes back with the hook and lifts (new chords, a
// higher tune, something new coming in). In code each section of each part is a `const` named
// `<role><Section>` (`chordsVerse`, `melChorus`), and every labelled track that changes gets ONE `arrange()`
// with the same sections and the same lengths (contracts §6.3, STYLE §10); a part that rests in a section
// uses `silence`. `tb.arrange` and the form lens unlock here. What the learner has: `const` (U08.L04), bass
// lines on the roots (U08), chord names and `.voicing()` (U05.L08), a hook and its phrases (U07), four-bar
// phrases and 8-bar sections by ear (U09.L01). Not yet: AABA and strophic (U09.L03), the energy curve
// (U09.L04), entries and exits with `.mask()` (U09.L05). Spec: content/specs/U09.md.
//
// How it is graded (AUTHORING §18.2): the planned `form` and `contrast` rules wait for the grader's golden
// tests, so every check here uses implemented shapes. A track's arrangement is an `events` match on that
// track over the whole 16-bar song (the bass in degrees, octave-free; the tambourine by drum role). The
// Make's required rule reads the song's chords in order, verse chorus verse chorus, with a `matches` rule and
// a `harmony` matcher at level `rn`: the chords of the two sections differ, so the order of the sections is
// the order of the chords. When the grader lists `form`, the Make switches to
// `form` "verse chorus verse chorus" and keeps its tests.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Verse I vi IV V (C Am F G, the doo-wop order), chorus IV V I I (F G C C): the chorus starts away from home. */
const CHORDS_VERSE = 'const chordsVerse = chord("<C Am F G>").voicing()';
const CHORDS_CHORUS = 'const chordsChorus = chord("<F G C C>").voicing()';
/** The roots, an octave under the chords (U08.L01: the bass takes the chords' own numbers). */
const BASS_VERSE = 'const bassVerse = n("<0 5 3 4>").scale("C2:major")';
const BASS_CHORUS = 'const bassChorus = n("<3 4 0 0>").scale("C2:major")';
/** The verse tune in the middle (E G E | C E | F A F | D), chord tones on beats 1 and 3. */
const MEL_VERSE = 'const melVerse = n("<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major")';
/** The chorus tune a 4th to a 6th higher (C5 A4 | B4 G4 | C5 E5 C5 | C5), longer notes, chord tones. */
const MEL_CHORUS = 'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")';
/** Tambourine on 2 and 4: the chorus brings it in. */
const PERC_CHORUS = 'const percChorus = s("~ tb ~ tb")';
const CONSTS = [
  CHORDS_VERSE,
  CHORDS_CHORUS,
  BASS_VERSE,
  BASS_CHORUS,
  MEL_VERSE,
  MEL_CHORUS,
  PERC_CHORUS,
].join("\n");

/** One `arrange()` for a track: verse, chorus, verse, chorus, four bars each. */
const vcvc = (verse: string, chorus: string) =>
  `arrange([4, ${verse}], [4, ${chorus}], [4, ${verse}], [4, ${chorus}])`;
const CHORDS = `chords: ${vcvc("chordsVerse", "chordsChorus")}.s("piano")`;
const BASS = `bass: ${vcvc("bassVerse", "bassChorus")}.s("ebass").lpf(600)`;
const MEL = `mel: ${vcvc("melVerse", "melChorus")}.s("piano")`;
const PERC = `perc: ${vcvc("silence", "percChorus")}`;
/** The song: four tracks, each with one arrange() of the same four sections (16 bars). */
const SONG = `${TEMPO}${CONSTS}\n\n${[CHORDS, BASS, MEL, PERC].join("\n")}`;
/** The first section on its own, looping: what the song would be without a second section. */
const VERSE_ONLY = `${TEMPO}${[CHORDS_VERSE, BASS_VERSE, MEL_VERSE].join("\n")}\n\nchords: chordsVerse.s("piano")\nbass: bassVerse.s("ebass").lpf(600)\nmel: melVerse.s("piano")`;

/** S4: the bass plays the verse's roots all through, so under the chorus it fights the chords. */
const BASS_WITH = (bass: string) =>
  `${TEMPO}${CONSTS}\n\n${[CHORDS, `bass: ${bass}.s("ebass").lpf(600)`, MEL, PERC].join("\n")}`;
const BASS_STARTER = BASS_WITH("⟪bassVerse⟫");
const BASS_SOLUTION = BASS_WITH(vcvc("bassVerse", "bassChorus"));

/** S5: the tambourine plays all through, so the chorus brings nothing new. */
const PERC_WITH = (perc: string) => `${TEMPO}${CONSTS}\n\n${[CHORDS, BASS, MEL, `perc: ${perc}`].join("\n")}`;
const PERC_STARTER = PERC_WITH("⟪percChorus⟫");
const PERC_SOLUTION = PERC_WITH(vcvc("silence", "percChorus"));

/**
 * The Make: the verse plays on its own (no arrange yet); the chorus's chords and bass are written, and its tune
 * starts as a copy of the verse's, for the learner to lift.
 */
const MAKE_MEL_CHORUS = 'const melChorus = n("<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major")';
const MAKE_CONSTS = [CHORDS_VERSE, CHORDS_CHORUS, BASS_VERSE, BASS_CHORUS, MEL_VERSE, MAKE_MEL_CHORUS].join(
  "\n",
);
const MAKE = (...tracks: string[]) => `${TEMPO}${MAKE_CONSTS}\n\n${tracks.join("\n")}`;
const MAKE_STARTER = MAKE(
  'chords: chordsVerse.s("piano")',
  'bass: bassVerse.s("ebass").lpf(600)',
  'mel: melVerse.s("piano")',
);
/**
 * The chords and their roots in order, verse chorus verse chorus: what the required rule reads. The bass is in
 * the reference so that the lowest note under each chord is its root (under C, `.voicing()` puts E lowest).
 */
const FORM_REFERENCE = code(CHORDS_VERSE, CHORDS_CHORUS, BASS_VERSE, BASS_CHORUS, "", CHORDS, BASS);
const CHORD_ORDER: Matcher = {
  m: "harmony",
  level: "rn",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
};

/** Drums from the Band; chords, bass, tune and the tambourine are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const BASS_MATCH: Matcher = {
  m: "events",
  pitch: "octave-free",
  rhythm: "onsets",
  durations: false,
  tracks: ["bass"],
};
const PERC_MATCH: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  sound: "drum-role",
  tracks: ["perc"],
};

export default defineLesson({
  id: "U09.L02",
  version: 3,
  title: "Verse & Chorus",
  objective:
    "I can build a song from two contrasting sections, verse and chorus, with one arrange() per track.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["F02"],
  practises: [],
  terms: [
    { id: "term.verse", step: "S3" },
    { id: "term.chorus", step: "S3" },
    { id: "term.form", step: "S4" },
  ],
  canDo: ["cd.code.arrange"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two sections",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: SONG, bars: 16 },
      exercise: {
        kind: "listen",
        id: "two-sections",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops. In loop 2, a second block of four bars takes over from the first at bar 5. Listen for how the feel of the song changes when it arrives.",
        skills: [{ skill: "F02", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: VERSE_ONLY, caption: "One four-bar section, looping.", bars: 8 },
          { code: SONG, caption: "The same four bars, then four new ones, then both again.", bars: 16 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Read the plan",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "read-the-plan",
        version: 1,
        role: "practice",
        prompt:
          "Predict what the chords play over the 16 bars, then pick it. Each part's music is in a `const`, and the chords line plays them with `arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus])`.",
        skills: [{ skill: "F02", w: 1 }],
        hints: null,
        tests: [],
        code: SONG,
        bars: 16,
        mode: "choose",
        choices: [
          { id: "in-turn", label: "Four bars of one, four bars of the other, then both again" },
          { id: "together", label: "Both sets of chords at the same time, four times" },
          { id: "blocks", label: "The first one twice, then the second one twice" },
        ],
        correct: ["in-turn"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "What changes",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["form"] },
      example: { id: "what-changes", code: SONG, bars: 16 },
      exercise: {
        kind: "run-investigate",
        id: "what-changes",
        version: 1,
        role: "practice",
        prompt:
          "Run the song and compare bar 4 with bar 5 on the roll, where the second section starts. Answer both questions below: what changes at bar 5, and how many bars the whole song lasts before it starts over.",
        skills: [{ skill: "F02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare bar 4 with bar 5 on the roll: the chords, the height of the tune, the lines that play. Then count the bars before it starts over.",
        },
        hints: ladder(
          "At bar 5, watch which lines on the roll move, and which way.",
          "Look at the top line: where does the tune sit in bars 1–4, and where in bars 5–8?",
          "The chords change to F G C C and the tune climbs. Now count: four sections of four bars.",
        ),
        code: { starter: SONG },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What changes when the second section starts?",
            options: [
              { id: "lift", label: "New chords, a higher tune, and a tambourine comes in" },
              { id: "drums", label: "Only the drums" },
              { id: "nothing", label: "Nothing: the first four bars play again" },
            ],
            correct: ["lift"],
          },
          {
            q: "number",
            prompt: "How many bars does the whole song last before it starts over?",
            correct: 16,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["lift"], number: 16 } },
            expect: "pass",
          },
          {
            name: "only the drums",
            response: { answer: { choice: ["drums"], number: 16 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one section's length",
            response: { answer: { choice: ["lift"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Arrange the bass",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "arrange-the-bass",
        version: 1,
        role: "check",
        prompt:
          "The bass plays `bassVerse` all through, so in the chorus it fights the chords. Replace the highlighted `bassVerse` with an `arrange()`: verse, chorus, verse, chorus, four bars each, like the chords line. Done when the bass plays each chord's root in all 16 bars.",
        skills: [{ skill: "F02", w: 1 }],
        code: { starter: BASS_STARTER },
        reference: { solutions: [BASS_SOLUTION], bars: 16 },
        matcher: BASS_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: the bass plays {got}, the chord's root is {exp}. Check the order and the lengths of your sections against the chords line.",
        },
        hints: ladder(
          "The chords line already says which section plays when. The bass can copy that plan.",
          "Every arranged track lists the same sections in the same order, four bars each.",
          "Start the box with `arrange([4, bassVerse], [4, bassChorus], …`. Two sections to go.",
        ),
        tests: [
          { name: "reference", response: { code: BASS_SOLUTION }, expect: "pass" },
          {
            name: "the last chorus written out, its two C roots an octave up",
            response: {
              code: BASS_WITH(
                'arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, n("<3 4 7 7>").scale("C2:major")])',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: BASS_WITH("bassVerse") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "both verses first, then both choruses",
            response: {
              code: BASS_WITH("arrange([4, bassVerse], [4, bassVerse], [4, bassChorus], [4, bassChorus])"),
            },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "eight-bar sections",
            response: { code: BASS_WITH("arrange([8, bassVerse], [8, bassChorus])") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Bring something in",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "bring-something-in",
        version: 1,
        role: "check",
        prompt:
          "The tambourine plays all the way through, so the chorus brings nothing new. Replace the highlighted `percChorus` with an `arrange()`: `silence` in the verses, `percChorus` in the choruses, four bars each. Done when the tambourine plays only in bars 5–8 and 13–16.",
        skills: [{ skill: "F02", w: 1 }],
        code: { starter: PERC_STARTER },
        reference: { solutions: [PERC_SOLUTION], bars: 16 },
        matcher: PERC_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "The tambourine should arrive with the chorus. List the sections where it plays and where it rests.",
          "`silence` can be a section too: it fills its bars with nothing.",
          "`arrange([4, silence], [4, percChorus], …`: the same four sections as the chords.",
        ),
        tests: [
          { name: "reference", response: { code: PERC_SOLUTION }, expect: "pass" },
          {
            name: "the choruses written out",
            response: {
              code: PERC_WITH(
                'arrange([4, silence], [4, s("~ tb ~ tb")], [4, silence], [4, s("~ tb ~ tb")])',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: PERC_WITH("percChorus") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the tambourine in the verses instead",
            response: { code: PERC_WITH(vcvc("percChorus", "silence")) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "silence everywhere",
            response: { code: PERC_WITH("silence") },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Give it a chorus",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "give-it-a-chorus",
        version: 1,
        role: "practice",
        prompt:
          "Give the chords and the bass each an `arrange()`: verse, chorus, verse, chorus, four bars each. Then make the chorus lift: a higher tune in `melChorus`, or a fourth track. Done when the chords play in that order over 16 bars.",
        skills: [{ skill: "F02", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [16, 32],
        saveAs: "sketch",
        rubric: [
          {
            id: "verse-chorus",
            label: "The chords play verse, chorus, verse, chorus, four bars each",
            required: true,
            skills: ["F02"],
            rule: "matches",
            reference: { solutions: [FORM_REFERENCE], bars: 16 },
            matcher: CHORD_ORDER,
            min: 0.85,
          },
          {
            id: "every-part",
            label: "`arrange()` used at least three times, for example by chords, bass and tune",
            required: false,
            skills: ["F02"],
            rule: "uses",
            tool: "tb.arrange",
            min: 3,
          },
          {
            id: "something-new",
            label: "Four tracks or more",
            required: false,
            skills: ["F02"],
            rule: "tracks",
            min: 4,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "List the lines that change when the chorus comes in: the chords and the bass at least.",
          "Each of those lines needs one `arrange()` with the same four sections, like the chords line in the song you heard.",
          'Write `chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus]).s("piano")`, then the bass the same way.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: chords and bass arranged",
            response: {
              code: MAKE(
                `chords: ${vcvc("chordsVerse", "chordsChorus")}.s("piano")`,
                `bass: ${vcvc("bassVerse", "bassChorus")}.s("ebass").lpf(600)`,
                'mel: melVerse.s("piano")',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: every part arranged, a lifted tune, a tambourine with room",
            response: {
              code: `${TEMPO}${[CHORDS_VERSE, CHORDS_CHORUS, BASS_VERSE, BASS_CHORUS, MEL_VERSE, MEL_CHORUS, PERC_CHORUS].join("\n")}\n\n${[
                CHORDS,
                BASS,
                MEL,
                PERC,
              ].join("\n")}.room(.3)`,
            },
            expect: "pass",
          },
          {
            name: "both verses first, then both choruses",
            response: {
              code: MAKE(
                'chords: arrange([4, chordsVerse], [4, chordsVerse], [4, chordsChorus], [4, chordsChorus]).s("piano")',
                'bass: arrange([4, bassVerse], [4, bassVerse], [4, bassChorus], [4, bassChorus]).s("ebass").lpf(600)',
                'mel: melVerse.s("piano")',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
