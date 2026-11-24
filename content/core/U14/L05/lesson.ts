// U14.L05 Phrygian Edge. Minor with its 2nd lowered a half step: E minor has F♯, E Phrygian has F, a half step
// above home. That one note darkens everything and presses down on home, and it gives a major chord a half
// step above the home chord: i–♭II, the sound of flamenco guitar and of heavy riffs. What the learner has:
// modes as one changed note and the characteristic tone (U14.L01), Mixolydian, Dorian and Lydian (U14.L01–L04),
// minor and its numerals, written against the minor scale (U10), chords by name over one `const` driving the
// chords and the bass (U05.L08, U08.L04), `.struct()` for a strum, the crunch guitar and `.distort()`
// (U11.L03), the Andalusian cadence and its half step onto V (U10.L07). Not yet: the lab that puts all six
// colours on one home note (U14.L06), the syllable for ♭2 (ra, U15.L01), the same chord visiting a minor key
// (U16.L03). Spec: content/specs/U14.md.
//
// How it is graded: S4 writes the numerals of i–♭II in E Phrygian (`rn-palette`, read by degree, chroma and
// quality, so `II` for `♭II` is a degree miss and `♭ii` a quality miss); S5 changes the scale word of the riff
// and the second chord (`all` of `pcset` per onset with the bass on the chords and `events` in absolute pitch
// on the riff); S6 is `fam.key.mode` at level 5, all six colours, which this lesson completes. The Make's one
// required rule is `degree-set` with `contains: ["b2"]` on the riff, read in E Phrygian: the starter is on the
// scale already but never plays its 2nd.
import { defineLesson, type HintLadder, type KeySpec } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The lesson starts on E minor, the scale the learner knows (the lesson's `key`, so a starter may sit on it:
 * check 13); every step that is on the new scale declares E Phrygian.
 */
const E_PHR: KeySpec = { tonic: "E", mode: "phrygian" };

/** One string drives the strum and the bass (U08.L04). The strum is three-three-two: beats 1, 2-and and 4. */
const changes = (form: string) => `const changes = "${form}"\n`;
const STRUM = 'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("acgtr").gain(.6)';
const BASS = 'bass: chord(changes).rootNotes(2).s("ebass").lpf(600)';
const gtr = (riff: string, scale: string) => `gtr: n("${riff}").scale("${scale}").s("acgtr")`;
const piece = (form: string, riff: string, scale: string) =>
  code(changes(form), STRUM, BASS, gtr(riff, scale));

/**
 * The riff: E . F♯ E . G F♯ E | F♯ . A F♯ . E on minor, the same with F on Phrygian. The 2nd sits right
 * above home in both bars, so the one note that moves is heard at once.
 */
const RIFF = "<[0 ~ 1 0 ~ 2 1 0] [1 ~ 3 1 ~ 0 ~ ~]>";
/** S1: two bars of E minor over Em, then the same numbers on E Phrygian over Em and F. */
const HOOK = piece("<Em Em Em F>", RIFF, "<E4:minor!2 E4:phrygian!2>");
/** S1, second item: the Phrygian loop alone, i–♭II. */
const LOOP = piece("<Em F>", RIFF, "E4:phrygian");

/** S2: the eight notes from home up to home, bar 1 on minor, bar 2 on Phrygian. */
const TWO_SCALES = code('mel: n("0 1 2 3 4 5 6 7").scale("<E4:minor E4:phrygian>").s("piano")');
/** S3: the triad on degree 2, stacked from its root: F♯ A C on minor, F A C on Phrygian. */
const DEGREE_TWO = code('chords: n("[1,3,5]").scale("<E3:minor E3:phrygian>").s("piano")');

/** S4: the loop by name, one chord a bar, held, so each chord is read once. */
const NUMBER_IT = code(changes("<Em F Em F>"), 'chords: chord(changes).voicing().s("acgtr")', BASS);

/** S5: the riff in E minor over one chord; the target is the Phrygian loop. */
const MODIFY_STARTER = piece("<Em ⟪Em⟫>", RIFF, "E4:⟪minor⟫");
const MODIFY_SOLUTION = LOOP;

/**
 * The Make: a strummed E minor and a riff on E Phrygian that never plays its 2nd (E . G E . B G E | B . G .
 * E). Every note of it is in E minor too: it has no edge yet.
 */
const PLAIN_RIFF = "<[0 ~ 2 0 ~ 4 2 0] [4 ~ 2 ~ 0 ~ ~ ~]>";
const MAKE_STARTER = piece("<Em Em>", PLAIN_RIFF, "E4:phrygian");
/** The smallest change that passes: one number. Bar 1's G becomes F, pressing on home (E . F E). */
const MINIMAL_RIFF = "<[0 ~ 1 0 ~ 4 2 0] [4 ~ 2 ~ 0 ~ ~ ~]>";
const MAKE_MINIMAL = piece("<Em Em>", MINIMAL_RIFF, "E4:phrygian");

/** Drums from the Band; the strum, the bass and the riff are the learner's (AUTHORING §8 rule 4). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U14.L05",
  version: 4,
  title: "Phrygian Edge",
  objective: "I can turn minor into Phrygian by lowering its 2nd, and give a riff its edge over i and ♭II.",
  key: { tonic: "E", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["S13"],
  terms: [{ id: "term.phrygian", step: "S3" }],
  canDo: ["cd.compose.phrygian"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The riff turns dark",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-riff-turns-dark",
        key: E_PHR,
        version: 1,
        role: "practice",
        prompt:
          "Listen for two changes from bar 3 of loop 1, where the scale under the riff changes and its numbers stay the same: what happens to the mood, and how the riff lands on home. Loop 2 plays the new scale on its own.",
        skills: [{ skill: "S13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Loop 1: E minor, then the new scale from bar 3.",
            bars: 4,
          },
          {
            code: LOOP,
            caption: "Loop 2: the new scale as a loop of its own.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which note moves",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "which-note-moves",
        version: 1,
        role: "practice",
        prompt:
          "Predict which note of bar 2 differs from bar 1, and which way it moves. Both bars play `n` 0 to 7, home up to home: bar 1 on `E4:minor`, bar 2 on the scale the riff turned to. Pick one answer.",
        skills: [{ skill: "S13", w: 1 }],
        hints: null,
        tests: [],
        code: TWO_SCALES,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "second-down", label: "The 2nd, down a half step" },
          { id: "sixth-up", label: "The 6th, up a half step" },
          { id: "seventh-down", label: "The 7th, down a half step" },
        ],
        correct: ["second-down"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "The chord on 2",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", initialPanels: ["chords"] },
      example: { id: "degree-two", code: DEGREE_TWO, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "the-chord-on-2",
        version: 1,
        role: "practice",
        prompt:
          "Run the code and read the note names of bar 2's chord on the roll. Both bars play the chord on degree 2: bar 1 on E minor (F♯ A C, diminished), bar 2 on the new scale. Then answer both questions: which chord bar 2 is, and how many half steps from E up to F.",
        skills: [{ skill: "S13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read bar 2 from the bottom: the moved note, then A, then C. Then count the keys from E, home, up to that moved note.",
        },
        hints: ladder(
          "Read each chord bottom to top and compare the names. Which of the three notes has a different name in bar 2?",
          "A and C stay. The lowest note is degree 2 of the scale: F♯ in E minor. It is the note that moved in the predict step.",
          "Lowered a half step, F♯ becomes F. A chord of F, A and C: is its 3rd major or minor?",
        ),
        code: { starter: DEGREE_TWO },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which chord is bar 2?",
            options: [
              { id: "f-major", label: "F major: F A C" },
              { id: "f-sharp-minor", label: "F♯ minor: F♯ A C♯" },
              { id: "f-minor", label: "F minor: F A♭ C" },
            ],
            correct: ["f-major"],
          },
          {
            q: "number",
            prompt: "In bar 2, how many half steps from home (E) up to the 2nd (F)?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["f-major"], number: 1 } }, expect: "pass" },
          {
            name: "F♯ minor: the root of bar 1, a minor chord",
            response: { answer: { choice: ["f-sharp-minor"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two half steps: that is E to F♯, in bar 1",
            response: { answer: { choice: ["f-major"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Number the loop",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "number-the-loop",
        key: E_PHR,
        version: 1,
        role: "check",
        prompt:
          "Write the numeral for each of the four bars, Em, F, Em, F, counted from home in E Phrygian. Use lower case for a minor chord, upper case for a major one, and a flat where the root is lowered. Done when all four slots hold a numeral.",
        skills: [{ skill: "S13", w: 1 }],
        srs: [{ family: "fam.key.scale-spell", mode: "review-if-due" }],
        hints: ladder(
          "Count each root up from E, home. Which degree of E Phrygian is F, and is the chord on it major or minor?",
          "F is degree 2 of this scale, a half step above home: the lowered 2nd. F A C is a major chord.",
          "Bars 1 and 3 are the home chord, minor: i. Bars 2 and 4 are a major chord on the lowered 2nd.",
        ),
        stimulus: { src: "code", code: NUMBER_IT, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads"] },
        correct: { rn: ["i", "bII", "i", "bII"] },
        tests: [
          { name: "i ♭II i ♭II", response: { answer: { rn: ["i", "bII", "i", "bII"] } }, expect: "pass" },
          {
            name: "the ♭ written as a glyph",
            response: { answer: { rn: ["i", "♭II", "i", "♭II"] } },
            expect: "pass",
          },
          {
            name: "II: the 2nd of minor, F♯",
            response: { answer: { rn: ["i", "II", "i", "II"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "ii°: minor's own chord on 2",
            response: { answer: { rn: ["i", "ii°", "i", "ii°"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "♭ii in lower case",
            response: { answer: { rn: ["i", "bii", "i", "bii"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Give it the edge",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "give-it-the-edge",
        key: E_PHR,
        version: 1,
        role: "check",
        prompt:
          "Make two changes so the riff plays the target, the same riff in E Phrygian. First, change the scale word in the `gtr:` line from `minor` to `phrygian`. Second, change bar 2's chord in `changes`, the second `Em`, to the major chord a half step above home.",
        skills: [{ skill: "S13", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 2 },
        // The strum is its pitch classes and its lowest note at each onset; the riff is its notes, in absolute
        // pitch. The bass reads `changes`, so one edit moves both.
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["gtr"] },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. The chord a half step above home is major, built from the lowered 2nd: F, A and C.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: your riff plays {got}; the target has {exp}. The riff needs the new scale word as well.",
        },
        hints: ladder(
          "Two highlighted places decide the colour: the scale word under the riff, and the second chord. Check that each one is changed.",
          "The scale word in `.scale()` decides the riff's 2nd. The second chord in `changes` is Em, the home chord again.",
          'The riff becomes `.scale("E4:phrygian")`. Now the chord: which major chord sits a half step above E?',
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "the chord in brackets",
            response: { code: piece("<Em [F]>", RIFF, "E4:phrygian") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: piece("<Em Em>", RIFF, "E4:minor") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "F♯ for F: A♯ and C♯ are not in the mode",
            response: { code: piece("<Em F#>", RIFF, "E4:phrygian") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "F minor for F: A♭",
            response: { code: piece("<Em Fm>", RIFF, "E4:phrygian") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "only the chord: the riff still plays F♯ over F",
            response: { code: piece("<Em F>", RIFF, "E4:minor") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "All six colours",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "all-six-colours",
        version: 1,
        role: "check",
        prompt:
          "Name the colour of each loop: one of the six you know. Listen in three steps. Find home. Decide whether its 3rd is major or minor. Then listen for the one note that differs: the 4th or 7th on the major side, the 6th or 2nd on the minor side.",
        skills: [{ skill: "S13", w: 1 }],
        hints: [
          { text: "Hum home first. Is the chord on it bright or dark: major or minor?" },
          {
            text: "On the major side the note to check is the 4th (raised: Lydian) or the 7th (lowered: Mixolydian). On the minor side, the 6th (raised: Dorian) or the 2nd (lowered: Phrygian).",
          },
          {
            text: "Hear it again, slower, and hum the note just above home: a half step above it is Phrygian.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.key.mode", level: 5 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "major", label: "Major" },
            { id: "mixolydian", label: "Mixolydian (major with ♭7)" },
            { id: "lydian", label: "Lydian (major with ♯4)" },
            { id: "minor", label: "Natural minor" },
            { id: "dorian", label: "Dorian (minor with ♮6)" },
            { id: "phrygian", label: "Phrygian (minor with ♭2)" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.key.mode", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your Phrygian riff",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-phrygian-riff",
        key: E_PHR,
        version: 1,
        role: "practice",
        prompt:
          "Write your song's bridge. Make the `gtr:` line play the lowered 2nd, F (`n` 1), at least once, right next to home; without it the riff could be plain E minor. Then let the chords move to F and back. Then choose your guitar: `acgtr` for flamenco, or `crunch` with `.distort()`. Done when the riff plays an F.",
        skills: [{ skill: "S13", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-lowered-two",
            label: "The `gtr:` line plays the lowered 2nd (F) at least once",
            required: true,
            skills: ["S13"],
            rule: "degree-set",
            track: "gtr",
            contains: ["b2"],
          },
          {
            id: "the-chord-above-home",
            label: "An F major chord, ♭II, in `changes` at least once",
            required: false,
            skills: ["S13"],
            rule: "contains-rn",
            rn: ["bII"],
            min: 1,
          },
          {
            id: "comes-home",
            label: "The `gtr:` line's last note is 1 (E)",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "gtr",
          },
          {
            id: "bass-on-roots",
            label: "The `bass:` line plays the root where most chords start",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "One note makes this scale sound unlike E minor. Find it, then check whether your riff plays it.",
          "The lowered 2nd is F. `n` counts from 0, so degree 2 is `n` 1.",
          "In bar 1, change the first `2` to a `1` and hear the riff press on home. Then put F in place of the second Em.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one number changed, an F in bar 1",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "the loop to F and back, the riff falling onto home over F",
            response: { code: piece("<Em F>", "<[0 ~ 1 0 ~ 4 2 0] [1 ~ 5 1 ~ 0 ~ ~]>", "E4:phrygian") },
            expect: "pass",
          },
          {
            name: "beyond the brief: four bars, an octave down on the distorted guitar, the strum kept quiet",
            response: {
              code: code(
                changes("<Em F Em [F Em]>"),
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("acgtr").gain(.3)',
                BASS,
                'gtr: n("<[0 0 1 0 ~ 2 1 0] [1 ~ 5 1 ~ 0 -1 0] [0 0 1 0 ~ 4 3 2] [1 1 1 ~ 0 ~ ~ ~]>").scale("E3:phrygian").s("crunch").distort(1)',
              ),
            },
            expect: "pass",
          },
          {
            name: "new numbers, still no 2nd",
            response: { code: piece("<Em F>", "<[0 ~ 2 3 ~ 4 2 0] [5 ~ 4 ~ 2 ~ 0 ~]>", "E4:phrygian") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the riff moved to E minor: its 2nd is F♯",
            response: { code: piece("<Em Em>", MINIMAL_RIFF, "E4:minor") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
