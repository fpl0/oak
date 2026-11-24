// U07.L08 Pickups (exemplar of U07). Some tunes start before the first full bar: their first notes lead
// into beat 1 of bar 1 instead of landing on it. In code the pickup is written as rests at the start of an
// extra first bar, bar 0, so the tune's first strong beat still falls on a bar line (contracts §6.11, STYLE
// §9). What the learner has: degrees in `n` and notes below home (U03), the four-chord stacks (U05), phrases
// that end open or closed (U07.L06), echoes between parts (U07.L07). Not yet: lead sheets (U07.L09), where
// the same pickup is read from the page in 3/4. Spec: content/specs/U07.md.
//
// How it uses the shapes (AUTHORING §17.7): the graded code steps declare `pickup` (its length in beats), so
// the grader numbers bars from the first full bar, says "Pickup" for bar 0, and reports a tune that starts
// on the bar line instead as `rhythm.pickup-missing` (the `rhythm` matcher inside an `all`). The Make's
// required rule is `pickup` with `leadsIn`: bar 0 starts with rests, something sounds in its last beat, and
// bar 1 starts on its downbeat.
//
// Repertoire (contracts §2.8): Auld Lang Syne (song.auld-lang-syne), the first phrase in U03.L10's plain-rhythm
// setting (each dotted quarter and eighth as two quarters), now with its pickup: 5 | 1 1 1 3 | 2 1 2 3 |
// 1 1 3 5 | 6. In C. The answer key is still `verified: false`.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A tune in degrees of C. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
/** Triads stacked in degrees, an octave under the tune. */
const chords = (pattern: string) => `chords: n("${pattern}").scale("C3:major").s("piano").gain(.6)`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Auld Lang Syne with its pickup: bar 0 holds three beats of rest and the low 5 (G3) on beat 4. */
const AULD = "<[~ ~ ~ -3] [0 0 0 2] [1 0 1 2] [0 0 2 4] [5@4]>";
/** U03.L10's setting: the same tune from the first full bar, the pickup left out. */
const AULD_FLAT = "<[0 0 0 2] [1 0 1 2] [0 0 2 4] [5@4]>";
/** I V I IV under it; the chords rest in the pickup bar. */
const AULD_CHORDS = "<~ [0,2,4] [4,6,8] [0,2,4] [3,5,7]>";
const AULD_CHORDS_FLAT = "<[0,2,4] [4,6,8] [0,2,4] [3,5,7]>";
const HOOK = code(chords(AULD_CHORDS), mel(AULD));
const FLAT = code(chords(AULD_CHORDS_FLAT), mel(AULD_FLAT));

/**
 * S4: an Oak tune whose two-beat pickup, 3 and 4 (E F), climbs into 5 (G) on beat 1 of bar 1. Over
 * I IV V I every note on beats 1 and 3 is a chord tone: G G | A F | D G | C.
 */
const STEP_CHORDS = "<~ [0,2,4] [3,5,7] [4,6,8] [0,2,4]>";
const STEP_TUNE = (bar0: string) => `<${bar0} [4 ~ 4 ~] [5 4 3 ~] [1 ~ 4 ~] [0@4]>`;
const STEP = (bar0: string) => code(chords(STEP_CHORDS), mel(STEP_TUNE(bar0)));

/**
 * S5, by ear: a one-beat pickup on 5 that leaps up a 4th to the high 1 on beat 1, then steps down and
 * lands home: 5 | 8 . 7 8 | 6 . 5 . | 3 . 1 . (G4 | C5 B4 C5 | A4 G4 | E4 C4).
 */
const HEARD = "<[~ ~ ~ 4] [7 ~ 6 7] [5 ~ 4 ~] [2 ~ 0 ~]>";
const HEARD_STARTER = `${TEMPO}${mel("<⟪[~ ~ ~ ~] [0 ~ ~ ~] [0 ~ ~ ~] [0 ~ ~ ~]⟫>")}`;
const HEARD_STARTER_PLAIN = `${TEMPO}${mel("<[~ ~ ~ ~] [0 ~ ~ ~] [0 ~ ~ ~] [0 ~ ~ ~]>")}`;
/** Pitch and rhythm of the line, plus the rhythm matcher, which names a tune that starts on the bar line. */
const BY_EAR_MATCHER: Matcher = {
  m: "all",
  of: [
    { m: "melody", pitch: "absolute", wPitch: 0.8, wRhythm: 0.2, rhythmTol: [1, 16], track: "mel" },
    { m: "rhythm", tol: [1, 16], durations: false, perRole: false, displacementCredit: 0.5, tracks: ["mel"] },
  ],
};

/**
 * The Make: a plain tune over I IV V I (C E | F A | G D | C), with bar 0 in front of both lines. The
 * starter's lead-in note sits on beat 1 of bar 0, where it sounds like a bar of its own; on beat 4 it leads
 * up a 4th into home.
 */
const MAKE_TUNE = "[0 ~ 2 ~] [3 ~ 5 ~] [4 ~ 1 ~] [0@4]";
const MAKE_CHORDS = "[0,2,4] [3,5,7] [4,6,8] [0,2,4]";
const MAKE_WITH = (bar0: string) => code(chords(`<~ ${MAKE_CHORDS}>`), mel(`<${bar0} ${MAKE_TUNE}>`));
const MAKE_STARTER = MAKE_WITH("[-3 ~ ~ ~]");
/** Beyond the brief: a two-note lead-in (6 7 into 1), a reworked tune, the chords on beats 1 and 3, room. */
const MAKE_BEYOND = `${TEMPO}${chords("<~ [[0,2,4] ~ [0,2,4] ~] [[3,5,7] ~ [3,5,7] ~] [[4,6,8] ~ [4,6,8] ~] [0,2,4]>")}\n${mel("<[~ ~ -2 -1] [0 ~ 2 4] [5 ~ 3 ~] [4 ~ 1 ~] [0@4]>")}.room(.3)`;

/** The Band's drums only: its bass and chords loop from bar 0 and would not wait for the pickup. */
const BAND = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const STAFF = { roll: false, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U07.L08",
  version: 4,
  title: "Pickups",
  objective:
    "I can start a tune with a pickup: rests at the start of bar 0, so its first notes lead into bar 1.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M10"],
  practises: [],
  terms: [{ id: "term.pickup", step: "S3" }],
  canDo: ["cd.code.pickup"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Before the bar",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 5 },
      exercise: {
        kind: "listen",
        id: "before-the-bar",
        version: 1,
        role: "practice",
        prompt:
          "Listen to how each loop begins. Loop 1 starts with the tune's real first note; loop 2 starts the way you wrote it before, on beat 1. Which start draws you into the tune, and which drops you straight onto it?",
        skills: [{ skill: "M10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Auld Lang Syne, from its first note.", bars: 5 },
          { code: FLAT, caption: "The same tune as you wrote it, from its first beat 1.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "When does it start?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "first-bars", code: HOOK, bars: 2 },
      exercise: {
        kind: "predict",
        id: "when-first-note",
        version: 1,
        role: "practice",
        prompt:
          "Predict when you will hear the tune's first note. Its first bar is `[~ ~ ~ -3]`: three rests, then a note below home. Pick the beat, then run it.",
        skills: [{ skill: "M10", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "beat-four", label: "On beat 4, just before the next bar starts" },
          { id: "beat-one", label: "On beat 1, straight away" },
          { id: "next-bar", label: "On beat 1 of the next bar, after four beats of silence" },
        ],
        correct: ["beat-four"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Count it in",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "count-it-in", code: HOOK, bars: 5 },
      exercise: {
        kind: "run-investigate",
        id: "count-it-in",
        version: 1,
        role: "practice",
        prompt:
          "Run it and count 1, 2, 3, 4 with the drums from the very start. Find how many beats of rest come before the first note, and which note lands on beat 1 of the first full bar. Answer both questions below.",
        skills: [{ skill: "M10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the first bar out loud with the drums and say the number when the first note plays.",
        },
        hints: ladder(
          "The first note plays alone. On which count?",
          "Bar 0 is `[~ ~ ~ -3]`: four slots of one beat each, and only the last one has a note.",
          "Three beats of rest, then the low G. The next note, home, comes on the first beat of the next bar.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many beats of rest come before the first note?",
            correct: 3,
          },
          {
            q: "choice",
            prompt: "Which note lands on beat 1 of the first full bar, where the chords come in?",
            options: [
              { id: "home", label: "Home, degree 1 (C): the note after the first one" },
              { id: "low-five", label: "Degree 5 below home (G): the very first note" },
            ],
            correct: ["home"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["home"] } }, expect: "pass" },
          {
            name: "counted the note as a rest",
            response: { answer: { number: 4, choice: ["home"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the first note taken for beat 1",
            response: { answer: { number: 3, choice: ["low-five"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Write the lead-in",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "write-the-lead-in",
        version: 1,
        role: "check",
        prompt:
          "Listen to the target: two notes climb into the tune before the chords start. Write those two notes in bar 0, the highlighted bar, on the beats where you hear them, with rests on the beats before them. Done when your bar 0 sounds like the target's.",
        skills: [{ skill: "M10", w: 1 }],
        pickup: { units: [2, 1] },
        code: { starter: STEP("⟪[~ ~ ~ ~]⟫") },
        reference: { solutions: [STEP("[~ ~ 2 3]")], bars: 5 },
        matcher: {
          m: "melody",
          pitch: "absolute",
          wPitch: 0.8,
          wRhythm: 0.2,
          rhythmTol: [1, 16],
          track: "mel",
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.rhythm-only":
            "The notes are right, but on the wrong beats of bar 0. Count the target's bar 0 again: the two notes come just before the next beat 1, with rests before them.",
        },
        hints: ladder(
          "Only bar 0 changes. Count the target's bar 0 with the drums: on which beats do you hear the two notes?",
          "They are the last two beats of bar 0, and they climb by step to degree 5 (`n` 4) on the next beat 1.",
          "Two rests, then two notes: `[~ ~ … …]`. The second note is degree 4, `n` 3.",
        ),
        tests: [
          { name: "reference", response: { code: STEP("[~ ~ 2 3]") }, expect: "pass" },
          {
            name: "the rests written as one long rest",
            response: { code: STEP("[~@2 2 3]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: STEP("[~ ~ ~ ~]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the two notes at the start of the bar",
            response: { code: STEP("[2 3 ~ ~]") },
            expect: "fail",
            feedback: ["melody.rhythm-only"],
          },
          {
            name: "one note only",
            response: { code: STEP("[~ ~ ~ 3]") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "the notes one degree high",
            response: { code: STEP("[~ ~ 3 4]") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "dictate",
      title: "Where does it start?",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "where-does-it-start",
        version: 2,
        role: "check",
        prompt:
          "Write the tune you hear in `n`, in C major, one bar per word of the `mel` line. Count along from the count-in. If a note comes before beat 1 of the first full bar, write it at the end of bar 0. Done when your tune matches the source note for note.",
        skills: [
          { skill: "M10", w: 0.6 },
          { skill: "E07", w: 0.4 },
        ],
        pickup: { units: [1, 1] },
        hints: ladder(
          "Count along from the count-in. Does the first note come on a 1, or before it?",
          "The first note comes alone on beat 4 of bar 0 and leaps up to the high home on the next beat 1.",
          "Bar 0 is `[~ ~ ~ 4]`. Bar 1 starts on `n` 7 and steps down once.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: `${TEMPO}${mel(HEARD)}`, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: HEARD_STARTER },
        reference: { solutions: [`${TEMPO}${mel(HEARD)}`], bars: 4 },
        matcher: BY_EAR_MATCHER,
        // Raised from the dictation default (0.85): the step is about where the tune starts, and at 0.85 the
        // pickup on beat 3 (0.93), a pickup leaping an 11th from the low G (0.97) and the last note heard as
        // sol (0.95) all passed (teaching review). The notes held with `@` still score 1.
        pass: 0.98,
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "exact" },
        feedbackText: {
          "rhythm.pickup-missing":
            "Every note is there, but the tune starts on the bar line. Its first note comes before beat 1: move it to the end of bar 0.",
        },
        srs: [{ family: "fam.mel.dictation", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: `${TEMPO}${mel(HEARD)}` }, expect: "pass" },
          {
            name: "the held notes written with @",
            response: { code: `${TEMPO}${mel("<[~@3 4] [7@2 6 7] [5@2 4@2] [2@2 0@2]>")}` },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: HEARD_STARTER_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "started on the bar line",
            response: { code: `${TEMPO}${mel("<[4 7 ~ 6] [7 5 ~ 4] [~ 2 ~ 0] ~>")}` },
            expect: "fail",
            feedback: ["rhythm.pickup-missing"],
          },
          {
            name: "the leap heard as a step",
            response: { code: `${TEMPO}${mel("<[~ ~ ~ 4] [5 ~ 4 5] [3 ~ 2 ~] [0 ~ -2 ~]>")}` },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the pickup a beat early, on beat 3",
            response: { code: `${TEMPO}${mel("<[~ ~ 4 ~] [7 ~ 6 7] [5 ~ 4 ~] [2 ~ 0 ~]>")}` },
            expect: "fail",
            feedback: ["melody.rhythm-note"],
          },
          {
            name: "the pickup heard below home: an 11th up to the high C",
            response: { code: `${TEMPO}${mel("<[~ ~ ~ -3] [7 ~ 6 7] [5 ~ 4 ~] [2 ~ 0 ~]>")}` },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "the last note heard as sol",
            response: { code: `${TEMPO}${mel("<[~ ~ ~ 4] [7 ~ 6 7] [5 ~ 4 ~] [2 ~ -3 ~]>")}` },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "see",
      title: "On the page",
      minutes: 0.5,
      ui: { panels: STAFF, staffLabels: "degree" },
      example: { id: "on-the-page", code: code(mel(AULD)), bars: 5 },
    },
    {
      id: "S7",
      kind: "make",
      title: "Lead in",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "lead-in",
        version: 1,
        role: "practice",
        prompt:
          "Turn bar 0 into a pickup: in your song it plays the one-bar stop before the last loud part. Its note now plays on beat 1 and just sits there. Move it, or write two or three notes, so bar 0 starts with rests and a note sounds on its beat 4, leading into bar 1.",
        skills: [{ skill: "M10", w: 1 }],
        pickup: { units: [1, 1] },
        code: { starter: MAKE_STARTER },
        bars: [5, 9],
        saveAs: "sketch",
        rubric: [
          // The `pickup` rule reads the effect: bar 0 starts with rests, its last beat sounds, and bar 1 starts
          // on its downbeat. A note on beat 4 alone is not enough: `[-3 -2 -1 -3]` fills bar 0 from beat 1 and
          // is a bar of its own (corrections pass, theory-b 4).
          {
            id: "a-pickup",
            label: "Bar 0 starts with a rest, a note sounds on its beat 4, and bar 1 starts on beat 1",
            required: true,
            skills: ["M10"],
            rule: "pickup",
            track: "@melody",
            leadsIn: true,
          },
          {
            id: "chord-tones",
            label:
              "At least 3 in 5 of the tune's notes on beats 1 and 3 are chord tones of the `chords:` line",
            required: false,
            skills: ["M03"],
            rule: "chord-tones-strong",
            minRatio: 0.6,
            melody: "@melody",
            harmony: "chords",
            strength: "strong",
          },
        ],
        hints: ladder(
          "Only bar 0 has to change. Count it with the drums: on which beat would the low G have to be to lead into home?",
          "A lead-in ends on the last beat of bar 0, right before the tune's first beat 1. Rests fill the beats before it.",
          "Three rests, then the note: `[~ ~ ~ …]`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one note on beat 4",
            response: { code: MAKE_WITH("[~ ~ ~ -3]") },
            expect: "pass",
          },
          {
            name: "beyond the brief: a two-note pickup, a new tune, chords on 1 and 3",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "moved to beat 3: a gap before bar 1, not a lead-in",
            response: { code: MAKE_WITH("[~ ~ -3 ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bar 0 filled from beat 1: a bar of its own, not a pickup",
            response: { code: MAKE_WITH("[-3 -2 -1 -3]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a pickup on beat 3, held through beat 4",
            response: { code: MAKE_WITH("[~ ~ -3@2]") },
            expect: "pass",
          },
          {
            name: "three notes climbing into home",
            response: { code: MAKE_WITH("[~ -3 -2 -1]") },
            expect: "pass",
          },
          {
            name: "two quick notes on beat 4",
            response: { code: MAKE_WITH("[~ ~ ~ [-2 -1]]") },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
