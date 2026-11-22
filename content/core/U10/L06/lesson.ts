// U10.L06 Raise the Seventh. In natural minor the chord on 5 is minor (v, Em in A minor): its 3rd, G, sits a
// whole step below home, so v–i leaves without pulling back. Raise degree 7 a half step (G♯) and v becomes a
// major V whose 3rd is a leading tone, a half step below home: V–i lands the way V–I does in major. The scale
// with the raised 7 is harmonic minor, `.scale("A3:harmonic:minor")` (unlocked here). What the learner has:
// ti leaning to do (U03.L04), the authentic cadence V–I (U06.L04), chord names and `.voicing()` (U05.L08),
// `.rootNotes()` (U08.L01), natural minor (U10.L01) and the chords of a minor key with their numerals,
// v among them (U10.L04). Not yet: the Andalusian descent (U10.L07) and the raised 6 (U10.L08).
// Spec: content/specs/U10.md.
//
// Why chord names: a stack over `A2:harmonic:minor` gives V, but it also turns III into an augmented chord
// (C E G♯) and VII into vii° (G♯ B D); S3 plays the augmented one once as the reason, and every chord line in
// the lesson is written by name. How it is graded: the modify step reads the chords as numerals in A minor
// (`harmony` at level `rn`, triad core; sevenths by name wait for U11.L04 and U12.L01); the ear step is
// four fixed cadences, v–i or V–i; the Make's one required rule is `contains-rn` with `["V"]` and
// `mustResolve`: a major V that goes home to i.
import { defineLesson, type HintLadder, type IdentifyEx, type Matcher } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Chords by name on a Rhodes with a little room: indie and soul both use it. */
const chords = (changes: string) => `chords: chord("${changes}").voicing().s("rhodes").room(.3)`;
/** The root of each chord, low, on a fingerbass (U08.L01's root bass). */
const bass = (changes: string) => `bass: chord("${changes}").rootNotes(2).s("fingerbass").lpf(800)`;
/**
 * The same roots in note names, for the steps where the learner rewrites the chords: a bass read from its own
 * chord symbols would keep naming Em under a learner's E.
 */
const ROOTS = 'bass: note("<a1 d2 e2 a1>").s("fingerbass").lpf(800)';
const mel = (tune: string, scale = "A3:harmonic:minor") => `mel: n("${tune}").scale("${scale}").s("piano")`;

/** i–iv–v–i, then i–iv–V–i. */
const NO_PULL = "<Am Dm Em Am>";
const PULL = "<Am Dm E Am>";
/** The tune of the first four bars sits on chord notes and never touches degree 7. */
const TUNE_A = "<[4 ~ 2 0] [3 ~ 5 3] [4 ~ 1 ~] [0 ~ ~ ~]>";
/** The same tune with a climb in bar 3: sol, ti, then do an octave above home. */
const TUNE_B = "<[4 ~ 2 0] [3 ~ 5 3] [4 ~ 6 ~] [7 ~ ~ ~]>";
const HOOK = code(
  chords("<Am Dm Em Am Am Dm E Am>"),
  bass("<Am Dm Em Am Am Dm E Am>"),
  mel("<[4 ~ 2 0] [3 ~ 5 3] [4 ~ 1 ~] [0 ~ ~ ~] [4 ~ 2 0] [3 ~ 5 3] [4 ~ 6 ~] [7 ~ ~ ~]>"),
);
const HOOK_A = code(chords(NO_PULL), bass(NO_PULL), mel(TUNE_A));
const HOOK_B = code(chords(PULL), bass(PULL), mel(TUNE_B));

/**
 * The two scales from A to A, natural then harmonic, over a held A; then bar 3, a triad stacked on ♭3 of
 * harmonic minor: C E G♯, augmented. The reason this lesson writes its chords by name.
 */
const RUN = code(
  'chords: n("<~ ~ [2,4,6]>").scale("A2:harmonic:minor").s("rhodes").room(.3)',
  'bass: n("<0 0 2>").scale("A1:minor").s("fingerbass").lpf(800)',
  'mel: n("<[0 .. 7] [0 .. 7] ~>").scale("<A3:minor A3:harmonic:minor>").s("piano")',
);

/** The modify step: the tune already climbs through G♯ in bar 3, but the chord under it is still Em. */
const MODIFY_STARTER = code(
  `chords: chord("<Am Dm ⟪Em⟫ Am>").voicing().s("rhodes").room(.3)`,
  ROOTS,
  mel(TUNE_B),
);
const modify = (changes: string) => code(chords(changes), ROOTS, mel(TUNE_B));
const MODIFY_SOLUTION = modify(PULL);
const RN_MATCH: Matcher = {
  m: "harmony",
  level: "rn",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
};

/** The ear step: four short cadences, i iv (v or V) i, with a tune that leaves degree 7 out. */
const cadence = (changes: string, scale: string) => code(chords(changes), bass(changes), mel(TUNE_A, scale));
const SIDES = [
  { id: "minor-v", label: "v: the minor chord on 5" },
  { id: "major-v", label: "V: the major chord on 5" },
];
const SIDE_WRONG = {
  "id.wrong":
    "Listen to the chord before the last, and to the note below home inside it. The tune leaves that note out; the chord does not.",
};
const ladderV = ladder(
  "Listen to the last change, from the chord on 5 to home. A strong pull home means V; arriving without a push means v.",
  "In the chord before the last, listen for the note below home. A half step below, it leans in; a whole step, it does not.",
  "Hum home, then the note a half step below it, then home again. Does the chord before the last hold that note?",
);
const part = (
  id: string,
  n: number,
  changes: string,
  scale: string,
  tonic: string,
  answer: "minor-v" | "major-v",
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  key: { tonic, mode: "minor" },
  prompt: `Cadence ${n}. Pick v or V for the chord before the last.`,
  skills: [{ skill: "H09", w: 1 }],
  hints: ladderV,
  stimulus: { src: "code", code: cadence(changes, scale), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: SIDES },
  correct: { choice: [answer] },
  feedbackText: SIDE_WRONG,
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: "the other one",
      response: { answer: { choice: [answer === "major-v" ? "minor-v" : "major-v"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/** Sung: sol ti do over the last two chords of i–iv–V–i. */
const SING = code(chords(PULL), bass(PULL), mel("<~ ~ [4 ~ 6 ~] 7>"));

/**
 * The Make starts from the Aeolian loop of U10.L05, i VI III VII, which circles: VII steps up to home with no
 * leading tone. The modify step already turned v into V, so here the learner chooses where a V goes: in place
 * of VII (Am F C E), or in four more bars that land (Am F E Am). One `const` feeds the chords and the bass.
 */
const AEOLIAN_CHANGES = 'const changes = "<Am F C G>"\n';
const LOOP_CHORDS = 'chords: chord(changes).voicing().s("rhodes").room(.3)';
const LOOP_BASS = 'bass: chord(changes).rootNotes(2).s("fingerbass").lpf(800)';
const LOOP_TUNE = "<[4 ~ 2 0] [2 ~ ~ ~] [4 ~ 2 4] [1 ~ ~ ~]>";
const loop = (changes: string, tune = LOOP_TUNE, scale = "A3:minor") =>
  code(`const changes = "${changes}"\n`, LOOP_CHORDS, LOOP_BASS, mel(tune, scale));
const MAKE_STARTER = code(AEOLIAN_CHANGES, LOOP_CHORDS, LOOP_BASS, mel(LOOP_TUNE, "A3:minor"));

/** Drums from the Band; the chords, the bass and the tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "A", mode: "minor" } as const;
const HARMONIC = { tonic: "A", mode: "harmonic minor" } as const;

export default defineLesson({
  id: "U10.L06",
  version: 4,
  title: "Raise the Seventh",
  objective: "I can raise degree 7 of a minor key to make its v a major V that pulls home to i.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["S07", "H09"],
  practises: [],
  terms: [{ id: "term.harmonic-minor", step: "S3" }],
  canDo: ["cd.compose.harmonic-minor"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.fingerbass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Which one lands?",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "which-one-lands",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "Listen to two versions of a four-bar minor loop; version 2 changes one chord in bar 3. Listen to the arrival home in bar 4: which version lands, and which only stops?",
        skills: [{ skill: "H09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK_A, caption: "Version 1: the tune comes down to home.", bars: 4 },
          {
            code: HOOK_B,
            caption: "Version 2: one chord changed in bar 3, and the tune climbs into home.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Em becomes E",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "em-becomes-e",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "Predict which note of Em (E, G, B) changes to make E, the chord the second loop plays in bar 3. Pick an answer, then hear both loops.",
        skills: [{ skill: "H09", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "g-up", label: "G moves up a half step, to G♯" },
          { id: "e-down", label: "E moves down a half step, to E♭" },
          { id: "b-up", label: "B moves up a half step, to C" },
        ],
        correct: ["g-up"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "One note raised",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "two-minors", code: RUN, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "one-note-raised",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "Run the code: A minor home to home, then the same scale with one note changed, then a chord. Compare bars 1 and 2 on the roll, degree by degree. Then answer both questions.",
        skills: [{ skill: "S07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Put bar 1 and bar 2 side by side on the roll: one note near the top sits higher in bar 2, by the smallest step on the keyboard.",
        },
        hints: ladder(
          "Find the one note of bar 2 that sits at a different height from bar 1.",
          "Read the degree labels near the top of each bar, below the last A.",
          "Bar 1 has ♭7, G. Count the keys from bar 2's note up to A.",
        ),
        code: { starter: RUN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which degree moved in bar 2, and which way?",
            options: [
              { id: "7-up", label: "Degree 7, up" },
              { id: "6-up", label: "Degree 6, up" },
              { id: "3-up", label: "Degree 3, up" },
            ],
            correct: ["7-up"],
          },
          { q: "number", prompt: "How many half steps from bar 2's G♯ up to A?", correct: 1 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["7-up"], number: 1 } }, expect: "pass" },
          {
            name: "the 6th",
            response: { answer: { choice: ["6-up"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step",
            response: { answer: { choice: ["7-up"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Raise it",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "raise-it",
        version: 1,
        role: "check",
        key: HARMONIC,
        prompt:
          "In bar 3 the tune plays G♯, but the chord under it is still Em, with a G: hear them rub. Change bar 3's chord to the major V, the major chord on E. Keep the other chords as they are.",
        skills: [
          { skill: "H09", w: 0.7 },
          { skill: "S07", w: 0.3 },
        ],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        matcher: RN_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Find the chord that holds a G while the tune plays G♯.",
          "Bar 3's chord is built on E, degree 5. Its middle note decides minor or major.",
          "A minor chord name ends in `m`. The chord you want has E, G♯ and B.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "E twice in bar 3", response: { code: modify("<Am Dm [E E] Am>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: modify(NO_PULL) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the raised note's own chord: G#o",
            response: { code: modify("<Am Dm G#o Am>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "home made major as well",
            response: { code: modify("<A Dm E Am>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "v or V?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "v-or-big-v",
        version: 1,
        role: "check",
        prompt:
          "For each of the four short loops, pick whether the chord on 5 is the minor v or the major V. Each loop plays i, iv, the chord on 5, then home, in a new minor key. The tune never sings degree 7, so listen inside the chords.",
        skills: [{ skill: "H09", w: 1 }],
        hints: ladderV,
        srs: [
          { family: "fam.har.rn", mode: "review-if-due" },
          { family: "fam.deg.fet-minor", mode: "review-if-due" },
        ],
        tests: [],
        parts: [
          part("cadence-a", 1, "<Am Dm E Am>", "A3:minor", "A", "major-v"),
          part("cadence-d", 2, "<Dm Gm Am Dm>", "D4:minor", "D", "minor-v"),
          part("cadence-e", 3, "<Em Am Bm Em>", "E4:minor", "E", "minor-v"),
          part("cadence-g", 4, "<Gm Cm D Gm>", "G3:minor", "G", "major-v"),
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sol ti do",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sol-ti-do",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "Listen once, then sing three notes over the last two chords: sol and ti on the V, then do on home. Sing in your own range.",
        skills: [
          { skill: "V02", w: 0.6 },
          { skill: "S07", w: 0.4 },
        ],
        hints: [
          { text: "Hum do, the last note, before you start." },
          { text: "Ti sits right under do and leans into it, as in major." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // Sol and ti below the high do: one climb of three notes.
        target: { from: "degrees", degrees: ["5", "7", "1"], octaves: [0, 0, 1] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A loop that lands",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "a-loop-that-lands",
        version: 1,
        role: "practice",
        prompt:
          "Am F C G circles: G steps up to home without a pull. In the `const changes` line, give it a major V (E) that goes straight home to i (Am): E in place of G, or four more bars that end E Am. Then shape the tune around that landing; a climb through G♯ helps.",
        skills: [{ skill: "H09", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        // Decision of 2026-11-13 (d15): this Make opens with the learner's own sketch from U10.L05 when one is
        // saved, with "Start from Oak's copy" to put the starter back; without one it opens with the starter.
        fromSketch: "U10.L05",
        rubric: [
          {
            id: "v-goes-home",
            label: "The chords play a major V (E) followed by i (Am)",
            required: true,
            skills: ["H09"],
            rule: "contains-rn",
            rn: ["V"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "ti-to-do",
            label: "The tune plays ti, the raised 7 (G♯)",
            required: false,
            skills: ["S07"],
            rule: "degree-set",
            track: "@melody",
            contains: ["7"],
          },
          {
            id: "comes-home",
            label: "The tune's last note is 1 (A)",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "@melody",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Which chord comes right before home in this loop, and does it lean into A?",
          "G is VII: its G natural is a whole step below home. The chord that leans is E, the major V, with G♯.",
          'Change the `const` to `"<Am F C E>"`, or to eight bars such as `"<Am F C G Am F E Am>"`. For the tune, `"A3:harmonic:minor"` gives `n` 6 as G♯.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: E in place of G",
            response: { code: loop("<Am F C E>") },
            expect: "pass",
          },
          {
            name: "eight bars: the loop circles, then lands",
            response: { code: loop("<Am F C G Am F E Am>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: the landing in eight bars, a tune that climbs through ti, a busier bass",
            response: {
              code: code(
                'const changes = "<Am F C G Am F E Am>"\n',
                LOOP_CHORDS,
                'bass: chord(changes).rootNotes(2).struct("x ~ x x").s("fingerbass").lpf(800)',
                mel("<[4 ~ 2 0] [2 ~ ~ ~] [4 ~ 2 4] [1 ~ ~ ~] [4 ~ 2 0] [2 ~ 0 2] [4 ~ 6 ~] [7 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the minor v in place of G: Em",
            response: { code: loop("<Am F C Em>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a V that does not go home: E then Dm",
            response: { code: code(chords("<Am Dm E Dm>"), bass("<Am Dm E Dm>"), mel(TUNE_A, "A3:minor")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
