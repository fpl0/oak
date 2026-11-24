// U08.L03 Walking Up to It. An approach note is the bass note just before a chord change, a step or a half step
// from the new root, so the line leans into it: from the step above, from the step below in the key, or from
// the half step below that lies outside the key (G♯ into A). The new root still lands on beat 1. What the
// learner has: root, 5th and octave basses (U08.L01–L02), passing and neighbour tones in the tune (U07.L04),
// half steps, whole steps, sharps and flats (U02.L03), note names with octaves (U02). Not yet: the kick lock
// and `const` (U08.L04), chromatic `n` steps (U15.L01). Spec: content/specs/U08.md.
//
// The bass is written in note names, because a chromatic approach (F♯ into G in C major) has no plain `n`
// degree until U15.L01. The doo-wop hook's four approaches are B1 into A1 (the step above, in the key), E1
// into F1 and B1 into C2 (the half step below, in the key) and F♯1 into G1 (the half step below, outside it).
//
// Grading: S4 compares the bass with `events` at `pitch: "absolute"`; S5 is four fixed two-bar examples. The
// Make's required rule is `bass-line` with `approach`, which counts every bass note that sits just before a
// chord change a step or a half step from the next root. Two things about how it counts shape the Make:
// (1) a root that is itself a step from the next root counts (G before Am), and (2) a root a minor 3rd from
// the next one counts as a step in the key (C before Am, E before G). So the Make is a soul vamp, I IV I V
// (C F C G), whose roots never move by a step or a 3rd: its roots-only starter counts 0. A Make without
// `arrange()` is graded over 16 bars (the loop four times), so an approach into F, the second C or G counts
// four times and one into the loop's first C three times: one approach note counts at most 4, two at least 7,
// and `min: 5` is "two of the changes". The rule's "chromatic" kind is any half step, in the key or not.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Triads stacked on `roots` (n values, one a bar), as in U06.L01. */
const chords = (roots: string) => `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("piano")`;
/** A bass in note names (approach notes may lie outside the key), with the C1 bass preset. */
const bass = (notes: string) => `bass: note("${notes}").s("ebass").lpf(600)`;
/** Four bars of bass, one cell a bar. */
const bars4 = (b1: string, b2: string, b3: string, b4: string) => `<${b1} ${b2} ${b3} ${b4}>`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The doo-wop order I vi IV V (C Am F G), one chord a bar. */
const DOO_WOP = "<0 5 3 4>";
const LOOP = chords(DOO_WOP);
/** U08.L01's root bass, the root on beats 1, 3 and 4. */
const ROOTS = bars4("[c2 ~ c2 c2]", "[a1 ~ a1 a1]", "[f1 ~ f1 f1]", "[g1 ~ g1 g1]");
/** The same bass with beat 4 leading into the next root. */
const APPROACH = bars4("[c2 ~ c2 b1]", "[a1 ~ a1 e1]", "[f1 ~ f1 f#1]", "[g1 ~ g1 b1]");
const PLAIN = code(LOOP, bass(ROOTS));
const HOOK = code(LOOP, bass(APPROACH));

/** S4: bar 4 stays on G to the end; the learner leads it into C. */
const LEAD_WITH = (bar4: string) =>
  code(LOOP, bass(bars4("[c2 ~ c2 b1]", "[a1 ~ a1 e1]", "[f1 ~ f1 f#1]", bar4)));
const LEAD_STARTER = LEAD_WITH("⟪[g1 ~ g1 g1]⟫");
const LEAD_SOLUTION = LEAD_WITH("[g1 ~ g1 b1]");

/** S5: two bars each, a chord with its root and an approach on beat 4, then the next chord's root. */
const pair = (roots: string, b1: string, b2: string) => code(chords(roots), bass(`<${b1} ${b2}>`));
const FROM_ABOVE_A = pair("<0 5>", "[c2 ~ c2 b1]", "a1");
const FROM_BELOW_OUTSIDE_G = pair("<3 4>", "[f1 ~ f1 f#1]", "g1");
const FROM_BELOW_IN_KEY_A = pair("<0 5>", "[c2 ~ c2 g1]", "a1");
const FROM_ABOVE_C = pair("<4 0>", "[g1 ~ g1 d2]", "c2");
const SIDES = [
  { id: "above", label: "From a step above" },
  { id: "below", label: "From a step below, in the key" },
  { id: "outside", label: "From a half step below, outside the key" },
];
const SIDE_WRONG = {
  "id.wrong":
    "Not this one. Hum beat 4 and the next beat 1: does the line step down or up into the new root? If up, count the half steps on the keyboard: one, or two?",
};

/** The Make: a soul vamp, I IV I V (C F C G), roots on beats 1 and 3. */
const VAMP = "<0 3 0 4>";
const VAMP_LOOP = chords(VAMP);
const MAKE_WITH = (b1: string, b2: string, b3: string, b4: string) =>
  code(VAMP_LOOP, bass(bars4(b1, b2, b3, b4)));
const MAKE_STARTER = MAKE_WITH("[c2 ~ c2 ~]", "[f1 ~ f1 ~]", "[c2 ~ c2 ~]", "[g1 ~ g1 ~]");
const TUNE = 'mel: n("<[4 ~ 2 ~] [5 ~ 3 ~] [4 ~ 2 0] [1 ~ ~ ~]>").scale("C4:major").s("piano")';

/** Drums from the Band; the chords and the bass are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROOT_BASS = {
  m: "harmony",
  level: "bass",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
} as const;

export default defineLesson({
  id: "U08.L03",
  version: 4,
  title: "Walking Up to It",
  objective:
    "I can lead a bass line into a chord change with an approach note a step or a half step from the next root.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["B03"],
  practises: [],
  terms: [{ id: "term.approach-tone", step: "S3" }],
  canDo: ["cd.compose.approach-tones"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Leaning forward",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "leaning-forward",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops. Loop 2 changes one bass note in every bar. Listen at the end of each bar for where the bass seems to be heading.",
        skills: [{ skill: "B03", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, caption: "Roots on beats 1, 3 and 4.", bars: 4 },
          { code: HOOK, caption: "The same bass with one note changed in every bar.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Into the A",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "into-the-a",
        version: 1,
        role: "practice",
        prompt:
          "Predict how the bass moves from `b1`, the last note of bar 1, to `a1`, the root of Am that starts bar 2. Pick one answer.",
        skills: [{ skill: "B03", w: 1 }],
        hints: null,
        tests: [],
        code: code(LOOP, bass(APPROACH)),
        bars: 2,
        mode: "choose",
        choices: [
          { id: "down", label: "It steps down into A" },
          { id: "up", label: "It steps up into A" },
          { id: "leap", label: "It leaps to A" },
        ],
        correct: ["down"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Just before",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "just-before", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "just-before",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop and follow the bass on the roll. Find the four bass notes that are not the root of the chord above them. Answer both questions below: where they sit in the bar, and how many half steps `f#1` is from `g1`.",
        skills: [{ skill: "B03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop on bar 3: F on beats 1 and 3, then a note just under G. Where does it sit, and how far is it from the G that follows?",
        },
        hints: ladder(
          "Watch where in each bar the bass leaves the root. Which beat is it?",
          "Each odd note sits right before a new chord. A half step is one key to the very next on the keyboard, black keys included.",
          "Bar 1's odd note is B, on beat 4, a step above the A that follows. Look at bar 3 the same way.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Where do the four notes that are not roots sit?",
            options: [
              { id: "beat-4", label: "On beat 4, just before the chord changes" },
              { id: "beat-1", label: "On beat 1, with the new chord" },
              { id: "beat-3", label: "On beat 3, in the middle of the bar" },
            ],
            correct: ["beat-4"],
          },
          {
            q: "number",
            prompt: "Bar 3 ends on `f#1` and bar 4 starts on `g1`. How many half steps apart are they?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["beat-4"], number: 1 } }, expect: "pass" },
          {
            name: "heard on the new chord's beat 1",
            response: { answer: { choice: ["beat-1"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step",
            response: { answer: { choice: ["beat-4"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Lead it home",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "lead-it-home",
        version: 1,
        role: "check",
        prompt:
          "Bar 4 plays `g1` on beats 1, 3 and 4. Change its beat 4 to an approach tone into C: the note one half step below `c2`. Keep `g1` on beats 1 and 3.",
        skills: [{ skill: "B03", w: 1 }],
        code: { starter: LEAD_STARTER },
        reference: { solutions: [LEAD_SOLUTION], bars: 4 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["bass"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the bass plays {got}, the target is {exp}. This one comes from below: one half step under the C that starts the loop again.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: the target has a note here. Keep G on beats 1 and 3 and change only beat 4.",
        },
        hints: ladder(
          "The loop starts again on `c2`. Find the note one half step below it on the keyboard.",
          "A half step is the very next key on the keyboard. Below C there is no black key, so the next key down is a white one, in the key of C.",
          "Bar 4 keeps `g1` on beats 1 and 3; only its last note changes, to a note in octave 1.",
        ),
        tests: [
          { name: "reference", response: { code: LEAD_SOLUTION }, expect: "pass" },
          {
            name: "the G held through beat 2",
            response: { code: LEAD_WITH("[g1@2 g1 b1]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: LEAD_WITH("[g1 ~ g1 g1]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "from the step above",
            response: { code: LEAD_WITH("[g1 ~ g1 d2]") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the approach moved to beat 3",
            response: { code: LEAD_WITH("[g1 ~ b1 ~]") },
            expect: "fail",
            feedback: ["melody.wrong-degree", "melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Which side?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "which-side",
        version: 1,
        role: "check",
        prompt:
          "Listen to four short examples, two bars each: a root, an approach tone on beat 4, then the next root. For each, pick where the approach tone comes from: a step above, a step below in the key, or a half step below from outside the key.",
        skills: [
          { skill: "B03", w: 0.7 },
          { skill: "I02", w: 0.3 },
        ],
        hints: ladder(
          "Hum beat 4 and the beat 1 after it. Does your voice go up or down?",
          "Coming down means the approach is above. Coming up, count the half steps: two is a step in the key, one may be a note outside it.",
          "In the first example the line comes down into A. Listen to the second the same way.",
        ),
        srs: [{ family: "fam.mel.nct", mode: "review-if-due" }],
        tests: [],
        parts: [
          {
            kind: "identify",
            id: "side-b-into-a",
            version: 1,
            role: "check",
            prompt: "Example 1. Pick where the approach tone comes from.",
            skills: [{ skill: "B03", w: 1 }],
            hints: ladder(
              "Hum beat 4 and the next beat 1. Does the line go up or down into the new root?",
              "Down into the root means the approach note is above it.",
              "Hum beat 4, then beat 1 of bar 2: the second note is lower.",
            ),
            stimulus: { src: "code", code: FROM_ABOVE_A, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SIDES },
            correct: { choice: ["above"] },
            feedbackText: SIDE_WRONG,
            tests: [
              { name: "above", response: { answer: { choice: ["above"] } }, expect: "pass" },
              {
                name: "below in the key",
                response: { answer: { choice: ["below"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "side-f-sharp-into-g",
            version: 1,
            role: "check",
            prompt: "Example 2. Pick where the approach tone comes from.",
            skills: [{ skill: "B03", w: 1 }],
            hints: ladder(
              "Hum beat 4 and the next beat 1. Does the line go up or down into the new root?",
              "It goes up. Now the size of that last move: one half step, or two?",
              "Hum the last two notes slowly. Do they almost touch, or is there room for a note between them?",
            ),
            stimulus: { src: "code", code: FROM_BELOW_OUTSIDE_G, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SIDES },
            correct: { choice: ["outside"] },
            feedbackText: SIDE_WRONG,
            tests: [
              { name: "outside", response: { answer: { choice: ["outside"] } }, expect: "pass" },
              {
                name: "heard as the step below",
                response: { answer: { choice: ["below"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "side-g-into-a",
            version: 1,
            role: "check",
            prompt: "Example 3. Pick where the approach tone comes from.",
            skills: [{ skill: "B03", w: 1 }],
            hints: ladder(
              "Hum beat 4 and the next beat 1. Does the line go up or down into the new root?",
              "It goes up. Now the size of that last move: one half step, or two?",
              "Hum the last two notes slowly. Is there room for one more note between them?",
            ),
            stimulus: { src: "code", code: FROM_BELOW_IN_KEY_A, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SIDES },
            correct: { choice: ["below"] },
            feedbackText: SIDE_WRONG,
            tests: [
              { name: "below", response: { answer: { choice: ["below"] } }, expect: "pass" },
              {
                name: "heard as the half step outside the key",
                response: { answer: { choice: ["outside"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
          {
            kind: "identify",
            id: "side-d-into-c",
            version: 1,
            role: "check",
            prompt: "Example 4. Pick where the approach tone comes from.",
            skills: [{ skill: "B03", w: 1 }],
            hints: ladder(
              "Hum beat 4 and the next beat 1. Does the line go up or down into the new root?",
              "Down into the root means the approach note is above it.",
              "Hum beat 4, then beat 1 of bar 2: which one is higher?",
            ),
            stimulus: { src: "code", code: FROM_ABOVE_C, bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: -1 },
            answer: { ui: "choice", options: SIDES },
            correct: { choice: ["above"] },
            feedbackText: SIDE_WRONG,
            tests: [
              { name: "above", response: { answer: { choice: ["above"] } }, expect: "pass" },
              {
                name: "below in the key",
                response: { answer: { choice: ["below"] } },
                expect: "fail",
                feedback: ["id.wrong"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Lean into the changes",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "lean-into-the-changes",
        version: 1,
        role: "practice",
        prompt:
          "Write the bass for the second and fourth parts of your song. On beat 4 of at least two bars, add an approach tone: a note a step or a half step from the next chord's root, above or below it. Keep every root on beat 1 and the chords as they are.",
        skills: [{ skill: "B03", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "approaches",
            label: "An approach tone just before two chord changes or more",
            required: true,
            skills: ["B03"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            approach: { min: 5 },
          },
          {
            id: "roots-on-the-one",
            label: "The bass plays each chord's root on beat 1 of its bar, in every bar",
            required: false,
            skills: ["B01"],
            rule: "matches",
            reference: {
              solutions: [MAKE_WITH("[c2 ~ c2 ~]", "[f1 ~ f1 ~]", "[c2 ~ c2 ~]", "[g1 ~ g1 ~]")],
              bars: 4,
            },
            matcher: ROOT_BASS,
            // "Every chord": all four changes (corrections pass).
            min: 1,
          },
          {
            id: "outside-the-key",
            label: "At least one approach tone a half step from the next root",
            required: false,
            skills: ["B03"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            approach: { min: 1, kinds: ["chromatic"] },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Find the chord that comes after each bar. Its root is where the bass is heading.",
          "Beat 4 is empty in every bar. A note there one or two half steps from the next root leads into it.",
          "Bar 1 heads for F: `e1` sits a half step below it, `g1` a step above. Pick one, then do the same in another bar.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: into F and into G",
            response: { code: MAKE_WITH("[c2 ~ c2 e1]", "[f1 ~ f1 ~]", "[c2 ~ c2 f#1]", "[g1 ~ g1 ~]") },
            expect: "pass",
          },
          {
            name: "into G and back into C",
            response: { code: MAKE_WITH("[c2 ~ c2 ~]", "[f1 ~ f1 ~]", "[c2 ~ c2 a1]", "[g1 ~ g1 b1]") },
            expect: "pass",
          },
          {
            name: "beyond the brief: every change, eighths, a tune",
            response: {
              code: code(
                VAMP_LOOP,
                bass(
                  bars4(
                    "[c2 ~ c2 c2 ~ c2 ~ e1]",
                    "[f1 ~ f1 f1 ~ f1 ~ d2]",
                    "[c2 ~ c2 c2 ~ c2 ~ a1]",
                    "[g1 ~ g1 g1 ~ g1 ~ b1]",
                  ),
                ),
                TUNE,
              ),
            },
            expect: "pass",
          },
          {
            name: "the F sharp spelled as G flat",
            response: { code: MAKE_WITH("[c2 ~ c2 e1]", "[f1 ~ f1 ~]", "[c2 ~ c2 gb1]", "[g1 ~ g1 ~]") },
            expect: "pass",
          },
          {
            name: "one approach only",
            response: { code: MAKE_WITH("[c2 ~ c2 ~]", "[f1 ~ f1 ~]", "[c2 ~ c2 f#1]", "[g1 ~ g1 ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
