// U14.L01 Modes as Colours. Change one note of a scale the learner knows and its colour changes: G major
// with its 7th lowered a half step (F♯ to F) is G Mixolydian. The scale is a mode; the one note that sets
// it apart from major is its characteristic tone, ♭7. The learner never starts a major scale on another
// note here: they change one word in `.scale()` and hear one note move. What the learner has: the major
// scale in `n` (U03), minor with its ♭3 ♭6 ♭7 sung me le te (U10), the ♭7 of the blues scale and of the
// dominant seventh (U11.L03–L04), the crunch guitar and `.distort()` (U11.L03), negative `n` for the notes
// below home (U03.L03), a patterned `.scale()` (U03.L05). Not yet: the chord the ♭7 brings, ♭VII, and the
// loop I–♭VII–IV (U14.L02), Dorian (U14.L03), Lydian (U14.L04), Phrygian (U14.L05). Spec: content/specs/U14.md.
//
// How it is graded: S4 builds the scale on the degree pad (`scale-builder`, a set of degrees against G); S5
// changes the scale word of the riff and of the bass and compares the notes (`events`, absolute pitch,
// onsets), so one line left in major fails on its F♯; S6 is four fixed phrases on other tonics, major or
// Mixolydian (`fam.key.mode` deals Mixolydian from U14.L03). The Make's one required rule is `degree-set`
// with `contains: ["b7"]` on the riff, read in G Mixolydian: the starter is in the scale already but never
// plays its ♭7, so nobody can hear which scale it is; one ♭7 in the loop makes it Mixolydian.
import { defineLesson, type HintLadder, type IdentifyEx, type KeySpec } from "@oak/content-kit";

const BPM = 104;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The lesson starts on G major, the scale the learner knows (the lesson's `key`, so a starter may sit on
 * it: check 13); every step that is on the new scale declares G Mixolydian.
 */
const G_MIX: KeySpec = { tonic: "G", mode: "mixolydian" };

/**
 * The riff: G G F G . B D . | F . D B G . F G in Mixolydian. It touches degree 7 four times in two bars,
 * below home (`n` −1) and above the 5th (`n` 6), so the one note that differs is heard at once.
 */
const RIFF = "<[0 0 -1 0 ~ 2 4 ~] [6 ~ 4 2 0 ~ -1 0]>";
/** Six Gs, then 5 and 7 walking back up to home: the bass meets degree 7 once a bar. */
const WALK = "0!6 4 6";
const gtr = (scale: string, riff = RIFF) => `gtr: n("${riff}").scale("${scale}").s("crunch")`;
const bass = (scale: string, line = WALK) => `bass: n("${line}").scale("${scale}").s("ebass").lpf(600)`;

/** The riff and its bass on G Mixolydian. */
const RIFF_MIX = code(gtr("G3:mixolydian"), bass("G1:mixolydian"));
/** S1: two bars on G major, then the same numbers on G Mixolydian, so the change is heard at once. */
const HOOK = code(gtr("<G3:major!2 G3:mixolydian!2>"), bass("<G1:major!2 G1:mixolydian!2>"));

/** S2, S3: the eight notes from home up to home, bar 1 on major, bar 2 on Mixolydian. */
const TWO_SCALES = code('mel: n("0 1 2 3 4 5 6 7").scale("<G4:major G4:mixolydian>").s("piano")');

/** S5: both lines on G major; the target is the same numbers on G Mixolydian. */
const MODIFY_STARTER = code(gtr("G3:⟪major⟫"), bass("G1:⟪major⟫"));
const MODIFY_SOLUTION = RIFF_MIX;

/** S6: a two-bar phrase over a held home note, on a tonic the lesson has not used. */
const phrase = (tonic: string, mode: "major" | "mixolydian", tune: string) =>
  code(
    `mel: n("${tune}").scale("${tonic}4:${mode}").s("piano")`,
    `bass: note("${tonic.toLowerCase()}2").s("ebass").lpf(600)`,
  );
const COLOURS = [
  { id: "major", label: "Major" },
  { id: "mixolydian", label: "Mixolydian (major with ♭7)" },
];
const earHints = (): HintLadder =>
  ladder(
    "Hum the held bass note: that is home. Now listen for the note just under home.",
    "A half step under home pulls up into it, as in every major tune you know. A whole step under home sits back and does not pull.",
    "Sing home, then the note below it as the phrase plays it, then home again. Small step or wide step?",
  );
const earPart = (
  id: string,
  prompt: string,
  tonic: string,
  mode: "major" | "mixolydian",
  tune: string,
): IdentifyEx => ({
  kind: "identify",
  id,
  key: { tonic, mode },
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "S12", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: phrase(tonic, mode, tune), bars: 2, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: COLOURS },
  correct: { choice: [mode] },
  feedbackText: {
    "id.wrong":
      mode === "major"
        ? "Listen again to the note just under home: in this phrase it sits a half step below and pulls up into it."
        : "Listen again to the note just under home: in this phrase it sits a whole step below and does not pull.",
  },
  tests: [
    { name: mode, response: { answer: { choice: [mode] } }, expect: "pass" },
    {
      name: mode === "major" ? "heard as Mixolydian" : "heard as major",
      response: { answer: { choice: [mode === "major" ? "mixolydian" : "major"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/**
 * The Make: a riff on G Mixolydian that never plays degree 7 (G G B G . B D . | D . B G . B G .), over a
 * bass that stays on G. Every note of it is in G major too: it has no colour yet.
 */
const PLAIN_RIFF = "<[0 0 2 0 ~ 2 4 ~] [4 ~ 2 0 ~ 2 0 ~]>";
const MAKE_STARTER = code(gtr("G3:mixolydian", PLAIN_RIFF), bass("G1:mixolydian", "0*8"));
/** The smallest change that passes: one number. Bar 2's first 3rd becomes the ♭7 (D . F G . B G .). */
const MAKE_MINIMAL = code(
  gtr("G3:mixolydian", "<[0 0 2 0 ~ 2 4 ~] [4 ~ 6 0 ~ 2 0 ~]>"),
  bass("G1:mixolydian", "0*8"),
);

/** Drums from the Band; the riff and the bass are the learner's (AUTHORING §8 rule 4). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U14.L01",
  version: 4,
  title: "Modes as Colours",
  objective:
    "I can turn a major scale into Mixolydian by lowering its 7th, and hear the colour that one note gives.",
  key: { tonic: "G", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S12"],
  practises: [],
  terms: [
    { id: "term.mode", step: "S3" },
    { id: "term.mixolydian", step: "S3" },
    { id: "term.characteristic-tone", step: "S4" },
  ],
  canDo: ["cd.hear.mode-colour"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One riff, two colours",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-riff-two-colours",
        key: G_MIX,
        version: 1,
        role: "practice",
        prompt:
          "Listen for the change of mood halfway through loop 1. The numbers stay the same all the way; only the scale under them changes after bar 2. Then hear loop 2, the new scale on its own.",
        skills: [{ skill: "S12", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Loop 1: two bars on G major, then two on the new scale.",
            bars: 4,
          },
          {
            code: RIFF_MIX,
            caption: "Loop 2: the new scale on its own.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "How many notes move",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "how-many-notes-move",
        version: 1,
        role: "practice",
        prompt:
          "Predict how many of the eight notes in bar 2 differ from bar 1. Bar 1 plays `n` 0 to 7 on `G4:major`; bar 2 plays the same numbers on the scale of the riff's second half. Pick one answer.",
        skills: [{ skill: "S12", w: 1 }],
        hints: null,
        tests: [],
        code: TWO_SCALES,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "one", label: "One note" },
          { id: "three", label: "Three notes, as between major and minor" },
          { id: "all", label: "All eight: it is a different key" },
        ],
        correct: ["one"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Find the note",
      minutes: 1,
      // The staff keeps G major's signature (the lesson's key), so bar 2's F carries a natural sign: the one
      // accidental on the page is the note that changed.
      ui: {
        panels: { roll: true, staff: "treble", keyboard: false },
        rollLabels: "note",
        staffLabels: "degree",
      },
      example: { id: "two-scales", code: TWO_SCALES, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "find-the-note",
        version: 1,
        role: "practice",
        prompt:
          "Run the code and compare the note names on the roll, bar 1 (G major) against bar 2 (the new scale). Find the one note that differs. Then answer both questions: which degree changed, and how many half steps from it up to the top G.",
        skills: [{ skill: "S12", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare the two bars note by note from the left: only the seventh differs, F♯ in bar 1 and F in bar 2. Then count the keys from F up to G.",
        },
        hints: ladder(
          "Read the roll bar by bar, note by note from the left. Which note of bar 2 has a different name from the same note in bar 1?",
          "The first six notes match: G A B C D E. Look at the seventh note of each bar, just before the top G.",
          "Bar 1 has F♯ there and bar 2 has F. From F♯ up to G is one half step; F is one more below.",
        ),
        code: { starter: TWO_SCALES },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which degree of the scale is different in bar 2?",
            options: [
              { id: "degree-7", label: "Degree 7: F♯ became F" },
              { id: "degree-4", label: "Degree 4: C became C♯" },
              { id: "degree-3", label: "Degree 3: B became B♭" },
            ],
            correct: ["degree-7"],
          },
          {
            q: "number",
            prompt: "In bar 2, how many half steps from that note up to the top G?",
            correct: 2,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["degree-7"], number: 2 } },
            expect: "pass",
          },
          {
            name: "degree 3: that is the note minor changes first",
            response: { answer: { choice: ["degree-3"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one half step: that is F♯ to G, in bar 1",
            response: { answer: { choice: ["degree-7"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Build G Mixolydian",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "build-g-mixolydian",
        key: G_MIX,
        version: 1,
        role: "check",
        prompt:
          "Build G Mixolydian on the pad. The pad opens holding G major: keep the six degrees the two scales share and change the one they do not. Done when the pad holds the seven degrees of G Mixolydian.",
        skills: [{ skill: "S12", w: 1 }],
        srs: [{ family: "fam.key.scale-spell", mode: "review-if-due" }],
        hints: ladder(
          "Only one degree differs from G major. Think back to the riff: which note changed, and what took its place?",
          "Degrees 1 to 6 stay as they are in major. Degree 7 does not: its lowered form is on the pad, next to it.",
          "Leave 1 to 6 as they are. Then choose between 7 and ♭7: the riff's F is a whole step under home.",
        ),
        // The scale builder on the degree pad (Wave 5 `scale-builder`): a set of degrees against G. It opens
        // holding G major (`from`, as U14.L04 and U14.L05 do), so the one move that makes the mode is the answer.
        answer: {
          ui: "scale-builder",
          tonic: "G",
          input: "degrees",
          palette: ["1", "2", "3", "4", "5", "6", "b7", "7"],
          from: "major",
        },
        correct: { degrees: ["1", "2", "3", "4", "5", "6", "b7"] },
        spelling: "enharmonic",
        order: "set",
        feedbackText: {
          "id.scale-extra":
            "{deg} ({note}) is not in G Mixolydian. Its 7th is the lowered one, a whole step under home.",
          "id.scale-missing": "G Mixolydian also has {deg}, the note {note}.",
        },
        tests: [
          {
            name: "1 2 3 4 5 6 ♭7",
            response: { answer: { degrees: ["1", "2", "3", "4", "5", "6", "b7"] } },
            expect: "pass",
          },
          {
            name: "the pad as it opens, G major: 7 where ♭7 belongs",
            response: { answer: { degrees: ["1", "2", "3", "4", "5", "6", "7"] } },
            expect: "fail",
            feedback: ["id.scale-other", "id.scale-extra", "id.scale-missing"],
          },
          {
            name: "both sevenths ticked",
            response: { answer: { degrees: ["1", "2", "3", "4", "5", "6", "b7", "7"] } },
            expect: "fail",
            feedback: ["id.scale-extra"],
          },
          {
            name: "six degrees: no 7th at all",
            response: { answer: { degrees: ["1", "2", "3", "4", "5", "6"] } },
            expect: "fail",
            feedback: ["id.scale-missing"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "One word, twice",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "one-word-twice",
        key: G_MIX,
        version: 1,
        role: "check",
        prompt:
          "Change the scale word from `major` to `mixolydian` in both lines, `gtr:` and `bass:`. Leave every number as it is. Done when both lines play the target's notes, the same numbers on G Mixolydian.",
        skills: [{ skill: "S12", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 2 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["gtr", "bass"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: your {line} plays {got} ({gotSyl}); the target has {exp} ({expSyl}). Both lines need the new scale word, and only degree 7 should move.",
        },
        srs: [{ family: "fam.deg.index", mode: "review-if-due" }],
        hints: ladder(
          "Look inside `.scale()` on each line: the word after the colon names the scale. Does each line name the new one?",
          "Both lines say `major` after the colon: `G3:major` on the riff, `G1:major` on the bass. Each needs the new scale's name there.",
          'The riff becomes `.scale("G3:mixolydian")`. The bass keeps `G1:` and takes the same word after it.',
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: code(gtr("G3:major"), bass("G1:major")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "only the riff changed: the bass still walks through F♯",
            response: { code: code(gtr("G3:mixolydian"), bass("G1:major")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "minor for Mixolydian: B♭ as well as F",
            response: { code: code(gtr("G3:minor"), bass("G1:minor")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            // The spelling slip everyone makes once: the lint names the word it does not know.
            name: "myxolydian",
            response: { code: code(gtr("G3:myxolydian"), bass("G1:myxolydian")) },
            expect: "fail",
            feedback: ["code.uncatalogued"],
          },
          {
            name: "dorian: a scale of a later lesson",
            response: { code: code(gtr("G3:dorian"), bass("G1:dorian")) },
            expect: "fail",
            feedback: ["code.locked-scale"],
          },
          {
            name: "a number changed too",
            response: {
              code: code(
                gtr("G3:mixolydian", "<[0 0 6 0 ~ 2 4 ~] [6 ~ 4 2 0 ~ -1 0]>"),
                bass("G1:mixolydian"),
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Major or Mixolydian",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "major-or-mixolydian",
        version: 1,
        role: "check",
        prompt:
          "Name the scale of each of the four phrases: major or Mixolydian. Each plays over its held home note. Listen for the note just under home: a half step below means major, a whole step below means Mixolydian.",
        skills: [{ skill: "S12", w: 1 }],
        hints: earHints(),
        tests: [],
        parts: [
          earPart("phrase-in-d", "Phrase 1, home on D.", "D", "mixolydian", "<[4 5 6 7] [6 4 2 0]>"),
          earPart("phrase-in-a", "Phrase 2, home on A.", "A", "major", "<[0 2 4 6] [7 6 4 0]>"),
          earPart("phrase-in-c", "Phrase 3, home on C.", "C", "major", "<[4 2 0 -1] [0 ~ 2 0]>"),
          earPart("phrase-in-e", "Phrase 4, home on E.", "E", "mixolydian", "<[0 ~ -1 0] [2 4 6 4]>"),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your Mixolydian riff",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-mixolydian-riff",
        key: G_MIX,
        version: 1,
        role: "practice",
        prompt:
          "Write the riff for your song's first verse. It is on G Mixolydian but never plays degree 7, so its scale cannot be heard. Make the `gtr:` line play the ♭7 (F) at least once: `n` 6 above the 5th or `n` -1 just under home. Then shape it freely. Done when the riff plays an F.",
        skills: [{ skill: "S12", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-colour-note",
            label: "The `gtr:` line plays the ♭7 (F) at least once",
            required: true,
            skills: ["S12"],
            rule: "degree-set",
            track: "gtr",
            contains: ["b7"],
          },
          {
            id: "all-in-the-mode",
            label: "Every note is in G Mixolydian: G A B C D E F, no F♯",
            required: false,
            skills: ["S12"],
            rule: "in-key",
            key: { tonic: "G", mode: "mixolydian" },
            minRatio: 1,
          },
          {
            id: "comes-home",
            label: "The `gtr:` line's last note is 1 (G)",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "gtr",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "One note makes this scale sound unlike G major. Find it in the scale, then check whether your riff plays it.",
          "The ♭7 is F. `n` counts from 0, so degree 7 is `n` 6; the F under home is `n` -1.",
          "In bar 2, change a `2` to a `6` and hear the riff lean back. Then try a `-1` just before a `0`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one number changed, a ♭7 in bar 2",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: four bars, distorted, with a bass that walks through the ♭7",
            response: {
              code: code(
                'gtr: n("<[0 0 -1 0 ~ 2 4 ~] [6 ~ 4 2 0 ~ -1 0] [0 0 -1 0 ~ 4 6 ~] [7 6 4 6 7 ~ ~ ~]>").scale("G3:mixolydian").s("crunch").distort(1)',
                bass("G1:mixolydian", "<[0!6 4 6] [0!6 6 4]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "new numbers and a new rhythm, still no 7th",
            response: {
              code: code(
                gtr("G3:mixolydian", "<[0 2 4 2 ~ 0 4 ~] [5 ~ 4 2 0 ~ 1 0]>"),
                bass("G1:mixolydian", "0*8"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the riff moved to G major: its 7ths are F♯",
            response: { code: code(gtr("G3:major", RIFF), bass("G1:major", "0*8")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
