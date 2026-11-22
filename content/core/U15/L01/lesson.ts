// U15.L01 Chromatic Degrees. Between the seven notes of a key sit five more. Each is named by the degree it
// bends: raise 4 a half step and it is ♯4, sung fi; lower 7 and it is ♭7, sung te. A raised note leans up into
// the next degree, a lowered one leans down. In code the step comes first and the sign after it: `n("3#")` is
// ♯4, `n("6b")` is ♭7 ("the number is the step, as ever one less than the degree; the sign bends it"). What the
// learner has: the chromatic scale and the five black keys (U02.L05), `n` as degree minus one (U03.L02),
// me le te as a minor key's own notes (U10), ♭3 ♭5 ♭7 bent in the blues (U11), ♭7 ♯4 ♭2 as the colour of a mode
// (U14). Here the key stays major and the notes visit. Not yet: a chord under any of them (U15.L02 puts D7
// under fi), the chords of si, di and te (U15.L03), the chords of me, le and ra (U16). No chord is new today.
// Spec: content/specs/U15.md.
//
// How it is graded (AUTHORING §19.5): the modify step is an `events` match on `mel` in absolute pitch with
// two editable regions, so `4#` (G♯, the 5 raised) and `7b` (B, the plain 7) each miss on a note; the ear
// step is six trials of `fam.deg.fet-chromatic` at level 1, which this lesson seeds, on a pad of exactly the
// level's degrees (no pad offers ♯4 and ♭5 together). The sung step never gates (`fallback: "identify"`).
// The Make's one required rule is `degree-set` on `mel` with every chromatic degree in `anyOf` and
// `minCount: 2`: the starter's tune is on the key's own notes, and a tune with one bent note does not pass.
// Completing this lesson opens CF-T; the Coda announces it (AUTHORING §5 rule 9), never this lesson's prose.
import { defineLesson, type HintLadder, type IdentifyEx } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
/** The root of every chord, low on the upright: the voicing above does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const loop = (form: string, tune: string) => code(changes(form), CHORDS, BASS, mel(tune));

/**
 * The hook: a soul turn with a tune that bends four notes a half step, each into the note after it: sol fi sol
 * (bars 1 and 5), la si la (bar 2), do di re (bar 3), te la (bar 6, over C7, the chord te belongs to).
 * Evaluated: G F♯ G C | A G♯ A | F C♯ D F | G F D | G F♯ G C | B♭ A G | A F A | G. Strudel names `4#` A♭4 and
 * `0#` D♭4; the lens spells them G♯ and C♯ because they rise.
 */
const HOOK = loop(
  "<C Am Dm G7 C C7 F G7>",
  "<[4 3# 4 7] [5 4# 5 ~] [3 0# 1 3] [4 ~ 3 1] [4 3# 4 7] [6b ~ 5 4] [5 ~ 3 5] [4 ~ ~ ~]>",
);
/**
 * S1's first item: the same tune on the key's own notes (`3`, `4`, `0`, `6` where the hook bends). Bar 6 has
 * C instead of C7: the plain tune holds B there, which would grind against the B♭ of C7.
 */
const PLAIN = loop(
  "<C Am Dm G7 C C F G7>",
  "<[4 3 4 7] [5 4 5 ~] [3 0 1 3] [4 ~ 3 1] [4 3 4 7] [6 ~ 5 4] [5 ~ 3 5] [4 ~ ~ ~]>",
);

/** S2: sol, something, sol over a C chord. */
const SOL_FI_SOL = code('chords: chord("C").voicing().s("rhodes")', mel("[4 3# 4 ~]"));

/**
 * S4: four bars of the plain tune over C, C7, F, G7. Bar 1's F wants to be fi (`3#`) on its way back to sol;
 * bar 2's B grinds against the B♭ of C7 and wants to be te (`6b`), falling to la.
 */
const MOD_FORM = "<C C7 F G7>";
const modTune = (fa: string, ti: string) => `<[4 ${fa} 4 7] [${ti} ~ 5 4] [5 ~ 3 5] [4 ~ ~ ~]>`;
const MODIFY_STARTER = loop(MOD_FORM, modTune("⟪3⟫", "⟪6⟫"));
const MODIFY_SOLUTION = loop(MOD_FORM, modTune("3#", "6b"));

/** S6: sol fi sol over C, then do te la over C7 and F; the do is an octave up. */
const SING_FORM = "<C [C7 F]>";
const SING = code(
  `chords: chord("${SING_FORM}").voicing().s("rhodes")`,
  `bass: chord("${SING_FORM}").rootNotes(2).s("upright")`,
  mel("<[4 3# 4 ~] [7 6b 5 ~]>"),
);

/**
 * The Make: a soul turn, C Am Dm G7, with a tune on the key's own notes that has a bend waiting in three bars:
 * B before A over C (te, `6b`, turns the C chord bluesy on its way to la), F and G before A over Am (fi and si,
 * `3#` and `4#`: the rising line of A melodic minor), C before D over Dm (di, `0#`). Bar 4 is left plain: over
 * G7, fi would grind against the chord's F.
 */
const MAKE_FORM = "<C Am Dm G7>";
const MAKE_STARTER = loop(MAKE_FORM, "<[4 ~ 6 5] [2 3 4 5] [3 ~ 0 1] [4 ~ 3 1]>");
const MAKE_MINIMAL = loop(MAKE_FORM, "<[4 ~ 6 5] [2 3# 4# 5] [3 ~ 0 1] [4 ~ 3 1]>");

/** Drums from the Band; chords and bass are the learner's (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** S5: one trial of the family per part, drawn by the lesson host (a new one in every series). */
const PAD = ["4", "#4", "5", "6", "b7", "7", "1"] as const;
const earPart = (n: number): IdentifyEx => ({
  kind: "identify",
  id: `bent-or-not-${n}`,
  version: 1,
  role: "check",
  prompt: `Note ${n}. Which degree?`,
  skills: [{ skill: "E12a", w: 1 }],
  hints: [
    { text: "Sing the note, then let it go where it wants. Does it want to move at all?" },
    {
      text: "A note that climbs a half step to sol was fi, ♯4. A note that falls a half step to la was te, ♭7. Ti climbs a half step too, but to do.",
    },
    {
      text: "Hear it again, slower. Sing do re mi fa sol from home and stop where the note sits, or between two of them.",
      replay: { rate: 0.75 },
    },
    "auto",
  ],
  stimulus: { src: "generator", family: "fam.deg.fet-chromatic", level: 1 },
  cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
  answer: { ui: "degree-pad", set: [...PAD], syllables: true },
  correct: {},
  // The catalog prints the degree as plain text ("#4"); this says where each of the two new notes leans.
  feedbackText: {
    "id.wrong":
      "Not {got}. Let the note move where it wants: fi, ♯4, climbs a half step to sol; te, ♭7, falls a half step to la. The key's own notes lean too, ti up to do and fa down to mi, but sol and do are already at rest.",
  },
  tests: [],
});

export default defineLesson({
  id: "U15.L01",
  version: 3,
  title: "Chromatic Degrees",
  objective:
    "I can hear a note from outside the key, name it by the degree it bends (♯4 fi, ♭7 te), and write it in code.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["E12a"],
  practises: ["P06"],
  terms: [{ id: "term.chromatic-degree", step: "S3" }],
  canDo: ["cd.hear.chromatic-degrees", "cd.code.chromatic-degrees"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Bend the tune",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "bend-the-tune",
        version: 1,
        role: "practice",
        prompt:
          "Listen to one tune twice: first on the key's own notes only, then with four notes bent a half step. In the second loop, listen for where each bent note goes next. Does it hang in the air, or slide straight into the note beside it?",
        skills: [{ skill: "E12a", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, caption: "Plain: every note from the key.", bars: 8 },
          {
            code: HOOK,
            caption: "Bent: four notes moved a half step, and C7 under the bend in bar 6.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Sol, something, sol",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "sol-something-sol",
        version: 1,
        role: "practice",
        prompt:
          'Predict which note `3#` plays in `n("4 3# 4")` in C major, then pick it. `n` counts from 0, so `4` is degree 5 (sol) and `3` is degree 4 (F). The `#` raises a note a half step.',
        skills: [{ skill: "P06", w: 1 }],
        hints: null,
        tests: [],
        code: SOL_FI_SOL,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "f-sharp", label: "F♯: step 3 is degree 4, F, and the sign raises it" },
          { id: "g-sharp", label: "G♯: the 4 raised" },
          { id: "e", label: "E: the note under F" },
        ],
        correct: ["f-sharp"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where each one leans",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "hook-labelled", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "where-each-one-leans",
        version: 1,
        role: "practice",
        prompt:
          "Run the hook and read the degrees on the roll. Answer two questions. First, where does te (♭7), the first note of bar 6, go next? Second, which number written before a `#` plays ♯5? The roll names the four bent notes ♯4, ♯5, ♯1 and ♭7.",
        skills: [
          { skill: "P06", w: 0.5 },
          { skill: "E12a", w: 0.5 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Look at bar 6: te is the first note, and the next note is a half step away. For the number, remember that `n` counts from 0: the number is the step, one less than the degree.",
        },
        hints: ladder(
          "Two answers: where te goes, and one number. A raised note leans up and a lowered one leans down. Which way does ♭7 lean?",
          "Te is B♭, the first note of bar 6. Read the next note on the roll. For the code, find a `#` in the tune and compare its number with the degree the roll shows.",
          "Te falls a half step. In bar 1, `3#` shows as ♯4: the number is one less than the degree. Do the same for degree 5.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Te, ♭7, opens bar 6. Where does it go next?",
            options: [
              { id: "down-to-la", label: "Down a half step to 6, la" },
              { id: "up-to-do", label: "Up a whole step to 1, do" },
              { id: "up-to-ti", label: "Up a half step to 7, ti" },
            ],
            correct: ["down-to-la"],
          },
          { q: "number", prompt: "Which number, written before the `#`, plays ♯5?", correct: 4 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["down-to-la"], number: 4 } }, expect: "pass" },
          {
            name: "te taken to rise to do",
            response: { answer: { choice: ["up-to-do"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "5 for ♯5: the degree, not the step",
            response: { answer: { choice: ["down-to-la"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Fi and te",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "fi-and-te",
        version: 1,
        role: "check",
        prompt:
          "Bend two notes of the tune. In bar 1, change the second note, fa (degree 4), into fi (♯4) so it climbs back to sol. In bar 2, change the first note, ti (degree 7), into te (♭7) so it falls to la. Leave the other notes as they are.",
        skills: [
          { skill: "P06", w: 0.6 },
          { skill: "E12a", w: 0.4 },
        ],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // `durations`: the bent note lasts as the target's does, so a fi cut to a click is not the target.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: true, tracks: ["mel"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the target has {exp} ({expSyl}) here, and your note is another one. The number is the step, one less than the degree, and the sign after it bends it.",
        },
        srs: [{ family: "fam.deg.index", mode: "review-if-due" }],
        hints: ladder(
          "Two notes move a half step each: fa up to fi, ti down to te. Which sign raises a note, and which lowers it?",
          "Degree 4 is step 3 in `n`, and degree 7 is step 6. A `#` after the number raises it a half step; a `b` lowers it.",
          "Bar 1 becomes `[4 3# 4 7]`. Bar 2 needs the same idea on degree 7, with the other sign.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "4b for ♯4: the same key named as ♭5, the same sound",
            response: { code: loop(MOD_FORM, modTune("4b", "6b")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: loop(MOD_FORM, modTune("3", "6")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "4# for ♯4: plays G♯, the 5 raised",
            response: { code: loop(MOD_FORM, modTune("4#", "6b")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "7b for ♭7: plays B, the plain 7",
            response: { code: loop(MOD_FORM, modTune("3#", "7b")) },
            expect: "fail",
            feedback: ["melody.wrong-degree", "code.chromatic-step"],
          },
          {
            name: "fi written in brackets: the same note, the same length",
            response: { code: loop(MOD_FORM, modTune("[3#]", "6b")) },
            expect: "pass",
          },
          {
            name: "bar 3 changed as well",
            response: {
              code: loop(MOD_FORM, "<[4 3# 4 7] [6b ~ 5 4] [5 ~ 3# 5] [4 ~ ~ ~]>"),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "fi cut to a click: the right note, 1% of its length",
            response: { code: loop(MOD_FORM, modTune("[3#@0.01 ~@0.99]", "6b")) },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Bent or not",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "bent-or-not",
        version: 1,
        role: "check",
        prompt:
          "Name six notes by degree. Each time, a few chords set home, then one note sounds. Pick its degree on the pad: 4, ♯4, 5, 6, ♭7, 7 or 1.",
        skills: [{ skill: "E12a", w: 1 }],
        hints: ladder(
          "Sing the note back, then let it go where it wants. If it slides a half step to a neighbour, it is a bent note. Does it want to move at all?",
          "A note that climbs a half step to sol was fi. A note that falls a half step to la was te.",
          "Sing do re mi fa sol la ti do from home and stop where the note sits, or between two of them.",
        ),
        srs: [{ family: "fam.deg.fet-chromatic", mode: "seed" }],
        tests: [],
        parts: [earPart(1), earPart(2), earPart(3), earPart(4), earPart(5), earPart(6)],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the two leans",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-two-leans",
        version: 1,
        role: "practice",
        prompt:
          "Listen, then sing two short phrases, one note a beat: sol fi sol (5 ♯4 5), then do te la (1 ♭7 6). The second do is the high one, above sol. Sing in your own range.",
        skills: [
          { skill: "E12a", w: 0.6 },
          { skill: "V03", w: 0.4 },
        ],
        hints: [
          { text: "Hum sol and hold it. Fi is the smallest step below it, a key you can almost lean on." },
          {
            text: "Te is the smallest step below ti, so do to te is a whole step down, and te to la a half step down.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees on the pad instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // Three notes a bar, a beat each, then a beat's rest: sol fi sol | do' te la.
        target: {
          from: "degrees",
          degrees: ["5", "#4", "5", "1", "b7", "6"],
          rhythm: "x x x ~",
          octaves: [0, 0, 0, 1, 0, 0],
        },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Bend a tune",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "bend-a-tune",
        version: 1,
        role: "practice",
        prompt:
          "Bend at least two notes of the `mel:` line a half step, each one next to the note it leans into: try `3#` before a 4, `4#` before a 5, `6b` before a 5. Done when the tune holds two notes from outside the key. Then make the rest yours: more bends, a new rhythm, an octave up.",
        skills: [
          { skill: "E12a", w: 0.5 },
          { skill: "P06", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-bent-notes",
            label: "At least two notes from outside the key in `mel`",
            required: true,
            skills: ["E12a", "P06"],
            rule: "degree-set",
            track: "mel",
            anyOf: ["#4", "b7", "#5", "#1", "b2", "b3", "b6"],
            minCount: 2,
          },
          {
            id: "bends-resolve-by-step",
            label: "At least half the moves in `mel` are steps, so the bent notes land",
            required: false,
            skills: ["M01"],
            rule: "step-ratio",
            track: "mel",
            min: 0.5,
          },
          {
            id: "ends-on-home",
            label: "The last note of `mel` is degree 1",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            track: "mel",
            degrees: ["1"],
          },
          {
            id: "bass-on-roots",
            label: "The bass plays each chord's root on at least 3 of every 4 chord changes",
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
          "Look for notes in `mel` that sit one step from the note after them. Those can lean. Which of them would you bend?",
          "Bar 1 has B before A; bar 2 climbs E, F, G, A; bar 3 has C before D. A `#` after the number raises a note; a `b` lowers it.",
          "Bar 2 can become `[2 3# 4 5]`, one bent note. One more anywhere else and the tune has two.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: fi and si in bar 2", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: every bend, an octave up, a new last bar home, C7 under te",
            response: {
              code: code(
                changes("<[C C7] Am Dm G7>"),
                CHORDS,
                BASS,
                'mel: n("<[4 ~ 6b 5] [2 3# 4# 5] [3 ~ 0# 1] [4 3 1 0]>").scale("C5:major").s("piano").gain(.8)',
              ),
            },
            expect: "pass",
          },
          {
            name: "one bent note only",
            response: { code: loop(MAKE_FORM, "<[4 ~ 6b 5] [2 3 4 5] [3 ~ 0 1] [4 ~ 3 1]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
