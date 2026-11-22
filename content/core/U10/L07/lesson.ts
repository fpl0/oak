// U10.L07 The Andalusian Cadence. The descent i–VII–VI–V (Am G F E in A minor): the bass steps down from home
// A G F E, and the last chord is the major V of U10.L06. It mixes both minors in one loop, G natural in VII
// and G♯ in V, so it is written in chord names, never in harmonic-minor stacks (which would turn VII into
// vii°). Flamenco, surf rock and soul ballads all lean on it. What the learner has: chord names and
// `.voicing()` (U05.L08), note names (U02), the root–5th bass (U08.L02), the key's VII and VI (U10.L04), the
// Aeolian loop (U10.L05) and the major V with its raised 7 (U10.L06). Not yet: the raised 6 (U10.L08).
// Spec: content/specs/U10.md.
//
// How it is graded: the modify step reads the chords as numerals in A minor (`harmony` at level `rn`, triad
// core); the bass and the tune are in note names and degrees, so they never carry a chord symbol the grader
// could read in place of the learner's. The ear step is `fam.har.schema` level 3 (gate U10.L07): the
// Aeolian loop and the Andalusian cadence join the schemas of U06. The Make's one required rule is
// `progression` with `schema: "schema.andalusian"`, starting on home (no rotation).
import { type Choice, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Chords by name on a steel-string acoustic guitar. */
const guitar = (changes: string) => `chords: chord("${changes}").voicing().s("acgtr")`;
/** Root, root, 5th in each bar, stepping down A G F E: note names, so the bass carries no chord symbol. */
const BASS_NOTES = "<[a1 ~ a1 e2] [g1 ~ g1 d2] [f1 ~ f1 c2] [e1 ~ e1 b1]>";
const BASS = `bass: note("${BASS_NOTES}").s("fingerbass").lpf(800)`;
/** A tune that falls with the chords and hangs on B, the 5th of the E chord, ready to go round again. */
const TUNE = "<[7 ~ 6 7] [6 ~ 8 6] [5 ~ 2 0] [1 ~ ~ ~]>";
const mel = (tune: string) => `mel: n("${tune}").scale("A3:minor").s("piano")`;

const DESCENT = "<Am G F E>";
const HOOK = code(guitar(DESCENT), BASS, mel(TUNE));
/** The bass alone, one loop. */
const BASS_ALONE = code(BASS);

/** The modify step: the descent ends on Em, the minor v. */
const MODIFY_STARTER = code(`chords: chord("<Am ⟪G F Em⟫>").voicing().s("acgtr")`, BASS, mel(TUNE));
const modify = (changes: string) => code(guitar(changes), BASS, mel(TUNE));
const MODIFY_SOLUTION = modify(DESCENT);
const RN_MATCH: Matcher = {
  m: "harmony",
  level: "rn",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
};

/** The loops of `fam.har.schema` up to level 3 (the generator's category ids; the trial offers those open). */
const LOOPS: Choice[] = [
  { id: "axis", label: "I V vi IV: the four-chord loop" },
  { id: "axis-vi", label: "vi IV I V: the four-chord loop from vi" },
  { id: "doo-wop", label: "I vi IV V: doo-wop" },
  { id: "three-chord", label: "I IV V: three-chord rock" },
  { id: "aeolian", label: "i VI III VII: the Aeolian loop" },
  { id: "andalusian", label: "i VII VI V: the Andalusian cadence" },
];

/** Sung: the bass line's four roots, one a bar, do te le sol. */
const SING = code(guitar(DESCENT), mel("<0 -1 -2 -3>"));

/**
 * The Make starts from the bass, not from a near miss (the modify step already fixed Em): the bass walks
 * A G F E, one root a bar, and the guitar strums Am over all of it. The learner chooses the chord above each
 * bass note, which is the cadence written from its own bass line, and then its harmonic rhythm and sound.
 */
const WALK = 'bass: note("<a1 g1 f1 e1>").s("fingerbass").lpf(800)';
const MAKE_STARTER = code(guitar("<Am Am Am Am>"), WALK);

/** Drums from the Band; the chords, the bass and the tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "A", mode: "minor" } as const;

export default defineLesson({
  id: "U10.L07",
  version: 3,
  title: "The Andalusian Cadence",
  objective:
    "I can hear and write the Andalusian cadence, i–VII–VI–V: a minor key walking down to its major V.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H09"],
  terms: [{ id: "term.andalusian-cadence", step: "S3" }],
  canDo: ["cd.hear.andalusian"],
  flavours: {
    "flavour.jazz-soul": { sounds: { "snd.acgtr": "snd.rhodes", "snd.fingerbass": "snd.upright" } },
  },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Four chords falling",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "four-chords-falling",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two clips: the loop twice round, then its bass alone. Listen for which way the bass walks, and for how the last chord feels just before the loop starts again.",
        skills: [{ skill: "H09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Guitar, bass and tune, twice round. Listen to the last chord of each round.",
            bars: 8,
          },
          {
            code: BASS_ALONE,
            caption: "The bass alone, root and 5th in each bar. Follow its roots.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "After E",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "after-e",
        version: 1,
        role: "practice",
        prompt:
          "Predict where the bass goes after E when the loop goes round, and how that move feels. The bass steps down one note a bar: A, G, F, E. Pick an answer, then hear it.",
        skills: [{ skill: "H09", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "back-to-a", label: "Back up to A: it arrives home" },
          { id: "down-to-d", label: "On down to D: the walk keeps going" },
          { id: "stays-on-e", label: "It stays on E: the loop hangs there" },
        ],
        correct: ["back-to-a"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Name the descent",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      example: { id: "the-descent", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "name-the-descent",
        version: 1,
        role: "practice",
        prompt:
          "Run the code. Read each chord's numeral in the chord band as it plays, and find the one bar where G is raised to G♯. Then answer both questions.",
        skills: [{ skill: "H09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the chord band again: upper case is major, lower case minor. Then look for G♯ in the chord notes, bar by bar.",
        },
        hints: ladder(
          "Listen for the chords that sound bright and the one that sounds dark, then read their numerals.",
          "Count each chord's root from A: G is ♭7, F is ♭6, E is 5. Then read its quality on the chord band.",
          "Bar 2 is G B D, a major chord on ♭7: VII. Only one chord has the raised 7 of the last lesson.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which numerals does the loop play?",
            options: [
              { id: "i-VII-VI-V", label: "i VII VI V" },
              { id: "i-vii-VI-V", label: "i vii° VI V" },
              { id: "vi-V-IV-III", label: "vi V IV III" },
            ],
            correct: ["i-VII-VI-V"],
          },
          { q: "number", prompt: "In which bar does G♯ sound?", correct: 4 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["i-VII-VI-V"], number: 4 } }, expect: "pass" },
          {
            name: "every G raised",
            response: { answer: { choice: ["i-vii-VI-V"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the G chord's bar",
            response: { answer: { choice: ["i-VII-VI-V"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Land on the V",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "land-on-the-v",
        version: 1,
        role: "check",
        key: MINOR,
        prompt:
          "This walk ends on Em, the minor v, so the loop goes round without a pull. Change the last chord to the major V, the major chord on E. Keep Am, G and F as they are.",
        skills: [{ skill: "H09", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        matcher: RN_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Look at the chord just before the loop goes home. Is it minor or major?",
          "The last chord is built on E, degree 5. Raise only its middle note; VII in bar 2 keeps its G.",
          "G and F stay as they are. The change is in the last chord's name.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "E struck twice in bar 4", response: { code: modify("<Am G F [E E]>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: modify("<Am G F Em>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "every G raised: G#o in bar 2 as well",
            response: { code: modify("<Am G#o F E>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "home raised to A major",
            response: { code: modify("<A G F E>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Name the loop",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "name-the-minor-loop",
        version: 1,
        role: "check",
        prompt:
          "Name each loop you hear: pick it from the six on offer, two of them minor. Each loop plays in a new key, with its bass and drums.",
        skills: [
          { skill: "H09", w: 0.6 },
          { skill: "H08", w: 0.4 },
        ],
        hints: ladder(
          "Is the first chord bright or dark? A dark first chord means a minor home.",
          "Both minor loops start on i and use VI and VII. Follow the bass: does it fall a step at a time?",
          "The Aeolian loop jumps from VI to III. The Andalusian cadence walks down to a bright V that leans home.",
        ),
        stimulus: { src: "generator", family: "fam.har.schema", level: 3 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "choice", options: LOOPS },
        correct: {},
        srs: [{ family: "fam.har.schema", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the walk down",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-walk-down",
        version: 1,
        role: "practice",
        prompt:
          "Listen, then sing the bass line's four roots, one per bar: do, te, le, sol, each a step below the last. Sing in your own range.",
        skills: [
          { skill: "V02", w: 0.6 },
          { skill: "H09", w: 0.4 },
        ],
        hints: [
          { text: "Hum do, the first note, before you start." },
          { text: "Te is a whole step below do, le a whole step below te, sol a half step below le." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // Home, then three steps down below it.
        target: { from: "degrees", degrees: ["1", "b7", "b6", "5"], octaves: [0, -1, -1, -1] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "The descent, your way",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "the-descent-your-way",
        version: 1,
        role: "practice",
        prompt:
          "The bass walks down A G F E, but the guitar plays Am over every note. In the `chords:` line, give each bass note its chord so the loop plays i VII VI V. Then shape it: two chords a bar if you like (`<[Am G] [F E]>`, the bass to match), a tune that hangs on the V.",
        skills: [{ skill: "H09", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-descent",
            label: "The `chords:` line plays i VII VI V in that order, starting on i",
            required: true,
            skills: ["H09"],
            rule: "progression",
            schema: "schema.andalusian",
            allowRotation: false,
          },
          {
            id: "bass-walks-down",
            label: "A `bass:` line plays the chord's root on at least 3 of every 4 chord changes",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
          {
            id: "tune-on-the-v",
            label: "A tune whose notes on beat 1 are mostly notes of the chord under them",
            required: false,
            skills: ["M01"],
            rule: "chord-tones-strong",
            melody: "@melody",
            harmony: "chords",
            strength: "downbeat",
            minRatio: 0.75,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Each bass note is the root of one chord. Which chord of A minor stands on G, on F, and on E?",
          "G and F are the key's VII and VI, both major. On E goes the V of the last lesson: major, with G♯.",
          'Write the guitar\'s chords as `chord("<Am G F E>")`: one name for each note of the bass.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: a chord on each bass note",
            response: { code: code(guitar(DESCENT), WALK) },
            expect: "pass",
          },
          {
            name: "two chords a bar, the bass to match",
            response: {
              code: code(
                guitar("<[Am G] [F E]>"),
                'bass: note("<[a1 g1] [f1 e1]>").s("fingerbass").lpf(800)',
                mel("<[7 6] [5 ~ 4 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the last chord left minor, Em",
            response: { code: code(guitar("<Am G F Em>"), WALK) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "beyond the brief: eight bars, a room, the bass walk and a tune that answers itself",
            response: {
              code: code(
                'chords: chord("<Am G F E>").voicing().s("acgtr").room(.4)',
                BASS,
                mel("<[7 ~ 6 7] [6 ~ 8 6] [5 ~ 2 0] [1 ~ ~ ~] [4 ~ 2 4] [6 ~ 4 1] [5 ~ 7 5] [4 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the descent started on VI",
            response: { code: code(guitar("<F E Am G>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the Aeolian loop instead",
            response: { code: code(guitar("<Am F C G>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
