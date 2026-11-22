// U14.L04 Lydian Glow. Major with its 4th raised a half step: F major has B♭, F Lydian has B. The raised 4th
// leans up into 5 and never weighs the music down, so it floats; and it turns the chord on degree 2 major,
// so I–II over one held bass note is the Lydian shimmer. What the learner has: modes as one changed note and
// the characteristic tone (U14.L01), Mixolydian's ♭7 and ♭VII (U14.L01–L02), Dorian's raised 6 (U14.L03),
// chords by name over one `const` (U05.L08, U08.L04), Roman numerals and the chord band (U06.L02), the pedal,
// a held bass under moving chords (U06.L11), `.delay()`. Not yet: Phrygian (U14.L05), the lab that puts all
// six colours on one home note (U14.L06), the syllable for ♯4 (fi, U15.L01) and the same II chord pulling to
// V (U15.L02). Spec: content/specs/U14.md.
//
// How it is graded: S4 opens the scale builder holding F major (`from: "major"`) and asks for F Lydian, a set
// of degrees; S5 changes the scale word and the second chord of a pad piece and grades both (`all` of `pcset`
// per onset on the pad, without the bass, which holds F, and `events` in absolute pitch on the line); S6 is
// four fixed phrases on other home notes, major, Lydian or Mixolydian (`fam.key.mode` deals Lydian from its
// level 5, which opens at U14.L05). The Make's one required rule is `degree-set` with `contains: ["#4"]` on
// the line, read in F Lydian: the starter is on the scale already but never plays its 4th.
import { defineLesson, type HintLadder, type IdentifyEx, type KeySpec } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The lesson starts on F major, the scale the learner knows (the lesson's `key`, so a starter may sit on it:
 * check 13); every step that is on the new scale declares F Lydian.
 */
const F_LYD: KeySpec = { tonic: "F", mode: "lydian" };

/** One string drives the pad (U08.L04); the bass holds F under every chord, a pedal (U06.L11). */
const changes = (form: string) => `const changes = "${form}"\n`;
const PAD = 'pad: chord(changes).voicing().s("pad").gain(.6)';
const BASS = 'bass: note("f2").s("ebass").lpf(600)';
const mel = (line: string, scale: string) => `mel: n("${line}").scale("${scale}").s("piano").delay(.3)`;
const piece = (form: string, line: string, scale: string) => code(changes(form), PAD, BASS, mel(line, scale));

/** F . A B♭ | D . B♭ . on major, F . A B | D . B . on Lydian: the 4th sits on a beat in every bar. */
const LINE = "<[0 ~ 2 3] [5 ~ 3 ~]>";
/** S1: two bars of F major (F, Gm), then the same numbers on F Lydian over F and G. */
const HOOK = piece("<F Gm F G>", LINE, "<F4:major!2 F4:lydian!2>");
/** S1, second item: four bars of F Lydian alone, F . A B | D . B . | E . C B | G. */
const LYDIAN_ALONE = piece("<F G>", "<[0 ~ 2 3] [5 ~ 3 ~] [6 ~ 4 3] [1 ~ ~ ~]>", "F4:lydian");

/** S2: the eight notes from home up to home, bar 1 on major, bar 2 on Lydian. */
const TWO_SCALES = code('mel: n("0 1 2 3 4 5 6 7").scale("<F4:major F4:lydian>").s("piano")');
/** S3: the triad on degree 2, stacked from its root: G B♭ D on major, G B D on Lydian. */
const DEGREE_TWO = code('chords: n("[1,3,5]").scale("<F3:major F3:lydian>").s("piano")');

/** S5: the pad piece in F major; the target is the hook's Lydian half. */
const MODIFY_STARTER = piece("<F ⟪Gm⟫>", LINE, "F4:⟪major⟫");
const MODIFY_SOLUTION = piece("<F G>", LINE, "F4:lydian");

/** S6: a two-bar phrase over a held home note, on a home note the lesson has not used. */
type Colour = "major" | "lydian" | "mixolydian";
const phrase = (tonic: string, mode: Colour, tune: string) =>
  code(
    `mel: n("${tune}").scale("${tonic}4:${mode}").s("piano")`,
    `bass: note("${tonic.toLowerCase()}2").s("ebass").lpf(600)`,
  );
const COLOURS = [
  { id: "major", label: "Major" },
  { id: "lydian", label: "Lydian (major with ♯4)" },
  { id: "mixolydian", label: "Mixolydian (major with ♭7)" },
];
const HEARD: Record<Colour, string> = {
  major:
    "Listen again to the middle and the top: in this phrase the 4th sits a half step above the 3rd, and the note under home is a half step below it, pulling up.",
  lydian:
    "Listen again to the middle of the phrase: here the 4th sits only a half step under 5, raised, and the phrase floats.",
  mixolydian:
    "Listen again to the top of the phrase: here the 4th is where major has it, but the note under home is a whole step below it and does not pull.",
};
const earHints = (): HintLadder =>
  ladder(
    "Hum the held bass note: that is home. Which side of the scale sounds unlike major, the middle or the top?",
    "Lydian changes the 4th, in the middle of the scale. Mixolydian changes the 7th, just under home. Major changes neither.",
    "Sing the 3rd, then the 4th as the phrase plays it: a half step up, or a whole step? Then the note under home.",
  );
const earPart = (id: string, prompt: string, tonic: string, mode: Colour, tune: string): IdentifyEx => ({
  kind: "identify",
  id,
  key: { tonic, mode },
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "S13", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: phrase(tonic, mode, tune), bars: 2, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: COLOURS },
  correct: { choice: [mode] },
  feedbackText: { "id.wrong": HEARD[mode] },
  tests: [
    { name: mode, response: { answer: { choice: [mode] } }, expect: "pass" },
    {
      name: mode === "lydian" ? "heard as Mixolydian" : "heard as Lydian",
      response: { answer: { choice: [mode === "lydian" ? "mixolydian" : "lydian"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/**
 * The Make: a pad on F for four bars over the held F, and a slow line on F Lydian that never plays its 4th
 * (F . A C | D | C . A G | F). Every note of it is in F major too: it does not float yet.
 */
const PLAIN_LINE = "<[0 ~ 2 4] [5@3 ~] [4 ~ 2 1] [0@3 ~]>";
const MAKE_STARTER = piece("<F F F F>", PLAIN_LINE, "F4:lydian");
/** The smallest change that passes: one number. Bar 3's A becomes the raised 4th (C . B G). */
const MINIMAL_LINE = "<[0 ~ 2 4] [5@3 ~] [4 ~ 3 1] [0@3 ~]>";
const MAKE_MINIMAL = piece("<F F F F>", MINIMAL_LINE, "F4:lydian");

/** Drums from the Band; the pad, the bass and the line are the learner's (AUTHORING §8 rule 4). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U14.L04",
  version: 3,
  title: "Lydian Glow",
  objective: "I can turn a major scale into Lydian by raising its 4th, and make it float over I and II.",
  key: { tonic: "F", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S13"],
  practises: [],
  terms: [{ id: "term.lydian", step: "S3" }],
  canDo: ["cd.compose.lydian"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The music lifts",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-music-lifts",
        key: F_LYD,
        version: 1,
        role: "practice",
        prompt:
          "Listen for the moment in loop 1 when the music lifts off the ground: one note of the scale changes at bar 3. Then listen through loop 2, all on the new scale: does the music ever settle back down?",
        skills: [{ skill: "S13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Loop 1: F major first; the scale changes at bar 3.",
            bars: 4,
          },
          {
            code: LYDIAN_ALONE,
            caption: "Loop 2: four bars on the new scale, with a longer line.",
            bars: 4,
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
          "Predict which note of bar 2 differs from bar 1, and which way it moves. Both bars play `n` 0 to 7, home up to home: bar 1 on `F4:major`, bar 2 on the scale of the music's second half. Pick one answer.",
        skills: [{ skill: "S13", w: 1 }],
        hints: null,
        tests: [],
        code: TWO_SCALES,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "fourth-up", label: "The 4th, up a half step" },
          { id: "seventh-down", label: "The 7th, down a half step" },
          { id: "third-down", label: "The 3rd, down a half step" },
        ],
        correct: ["fourth-up"],
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
          "Run the code and read the note names of the two chords on the roll. Both are the chord on degree 2, stacked from its root: bar 1 on F major, bar 2 on the new scale. Then answer both questions: which chord bar 2 is, and how many half steps from B up to C.",
        skills: [{ skill: "S13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read bar 2 from the bottom: G, then the moved note, then D. Then count the keys from that moved note up to C, degree 5.",
        },
        hints: ladder(
          "Read each chord bottom to top and compare the names. Which of the three notes has a different name in bar 2?",
          "G and D stay. The middle note is degree 4 of the scale: B♭ in F major. It is the note that moved in the predict step.",
          "Raised a half step, B♭ becomes B. A chord of G, B and D: is its 3rd major or minor?",
        ),
        code: { starter: DEGREE_TWO },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which chord is bar 2?",
            options: [
              { id: "g-major", label: "G major: G B D" },
              { id: "g-minor", label: "G minor: G B♭ D" },
              { id: "b-dim", label: "B diminished: B D F" },
            ],
            correct: ["g-major"],
          },
          {
            q: "number",
            prompt: "In bar 2, how many half steps from the raised 4th (B) up to degree 5 (C)?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["g-major"], number: 1 } }, expect: "pass" },
          {
            name: "G minor: that is bar 1",
            response: { answer: { choice: ["g-minor"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two half steps: that is B♭ to C, in bar 1",
            response: { answer: { choice: ["g-major"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Build F Lydian",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "build-f-lydian",
        key: F_LYD,
        version: 1,
        role: "check",
        prompt:
          "Build F Lydian on the pad. It opens holding F major: untick the one degree Lydian changes and tick its raised form. Done when the pad holds the seven degrees of F Lydian.",
        skills: [{ skill: "S13", w: 1 }],
        srs: [{ family: "fam.key.scale-spell", mode: "review-if-due" }],
        hints: ladder(
          "Only one degree differs from F major. Which note moved when the music lifted?",
          "Degrees 1, 2, 3, 5, 6 and 7 stay as they are in major. Degree 4 does not: its raised form is next to it on the pad.",
          "The 7th stays: that was Mixolydian's change, not this one. The note to change sits in the middle of the scale.",
        ),
        // The scale builder opens holding F major (`scale-builder.from`): raise one note to get the mode.
        answer: {
          ui: "scale-builder",
          tonic: "F",
          input: "degrees",
          from: "major",
          palette: ["1", "2", "3", "4", "#4", "5", "6", "7"],
        },
        correct: { degrees: ["1", "2", "3", "#4", "5", "6", "7"] },
        spelling: "enharmonic",
        order: "set",
        feedbackText: {
          "id.scale-extra":
            "{deg} ({note}) is not in F Lydian. Its 4th is the raised one, a half step under 5.",
          "id.scale-missing": "F Lydian also has {deg}, the note {note}.",
        },
        tests: [
          {
            name: "1 2 3 ♯4 5 6 7",
            response: { answer: { degrees: ["1", "2", "3", "#4", "5", "6", "7"] } },
            expect: "pass",
          },
          {
            name: "4 left ticked beside ♯4",
            response: { answer: { degrees: ["1", "2", "3", "4", "#4", "5", "6", "7"] } },
            expect: "fail",
            feedback: ["id.scale-extra"],
          },
          {
            name: "Mixolydian thinking: the 7th unticked as well",
            response: { answer: { degrees: ["1", "2", "3", "#4", "5", "6"] } },
            expect: "fail",
            feedback: ["id.scale-missing"],
          },
          {
            name: "F major left as it was",
            response: { answer: { degrees: ["1", "2", "3", "4", "5", "6", "7"] } },
            expect: "fail",
            feedback: ["id.scale-other", "id.scale-missing", "id.scale-extra"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Make it float",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "make-it-float",
        key: F_LYD,
        version: 1,
        role: "check",
        prompt:
          "Make two changes so the piece plays the target, the same piece in F Lydian. First, change the scale word in the `mel:` line from `major` to `lydian`. Second, change the second chord in `changes`, `Gm`, to G major. Keep the held F in the bass.",
        skills: [{ skill: "S13", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 2 },
        // The pad is its pitch classes at each onset, without the bass: the lowest note of the whole texture is
        // the held F, not the chord's root. The line is its notes, in absolute pitch.
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: false, tracks: ["pad"] },
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your pad has {got}; the target has {exp}. The second chord is the plain major chord on degree 2: G, B and D, nothing added.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: your line plays {got}; the target has {exp}. The line needs the new scale word as well.",
        },
        hints: ladder(
          "Two highlighted places decide the colour: the scale word under the line, and the second chord. Check that each one is changed.",
          "The scale word in `.scale()` decides the line's 4th. The second chord in `changes` is G minor, with B♭ in it.",
          'The line becomes `.scale("F4:lydian")`. Now the chord: G minor with its B♭ raised to B is which chord?',
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "the chord in brackets",
            response: { code: piece("<F [G]>", LINE, "F4:lydian") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: piece("<F Gm>", LINE, "F4:major") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "only the scale word: the pad's G minor still has B♭",
            response: { code: piece("<F Gm>", LINE, "F4:lydian") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "only the chord: the line still plays B♭",
            response: { code: piece("<F G>", LINE, "F4:major") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "G7 for G: an F added to the triad",
            response: { code: piece("<F G7>", LINE, "F4:lydian") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Which colour",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "which-colour",
        version: 1,
        role: "check",
        prompt:
          "Name the scale of each of the four phrases: major, Lydian or Mixolydian. Each plays over its held home note. Listen to the 4th: raised, a half step under 5, means Lydian. Then listen to the note under home: a whole step below means Mixolydian. Neither change means major.",
        skills: [{ skill: "S13", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.key.mode", mode: "review-if-due" }],
        tests: [],
        parts: [
          earPart("phrase-in-c", "Phrase 1, home on C.", "C", "lydian", "<[0 2 4 3] [4 ~ 3 ~]>"),
          earPart("phrase-in-a", "Phrase 2, home on A.", "A", "major", "<[0 2 3 2] [6 ~ 7 ~]>"),
          earPart("phrase-in-g", "Phrase 3, home on G.", "G", "lydian", "<[4 3 4 6] [7 ~ 3 4]>"),
          earPart("phrase-in-d", "Phrase 4, home on D.", "D", "mixolydian", "<[0 2 3 4] [6 ~ 4 ~]>"),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your floating piece",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-floating-piece",
        key: F_LYD,
        version: 1,
        role: "practice",
        prompt:
          "Make the `mel:` line play the raised 4th, B (`n` 3), at least once; without it the line could be plain F major. Put it on a long note or a beat. Then let the pad move to G and back. Keep the held F in the bass. Done when the line plays a B.",
        skills: [{ skill: "S13", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-raised-four",
            label: "The `mel:` line plays the raised 4th (B) at least once",
            required: true,
            skills: ["S13"],
            rule: "degree-set",
            track: "mel",
            contains: ["#4"],
          },
          {
            id: "the-chord-on-two",
            label: "A G major chord, II, in `changes` at least once",
            required: false,
            skills: ["S13"],
            rule: "contains-rn",
            rn: ["II"],
            min: 1,
          },
          {
            id: "all-in-the-mode",
            label: "Every note is in F Lydian: F G A B C D E, no B♭",
            required: false,
            skills: ["S13"],
            rule: "in-key",
            key: { tonic: "F", mode: "lydian" },
            minRatio: 1,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "One note makes this scale sound unlike F major. Find it, then check whether your line plays it.",
          "The raised 4th is B. `n` counts from 0, so degree 4 is `n` 3.",
          "In bar 3, change the `2` to a `3` and hear the line hang above home. Then try G in place of an F in `changes`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one number changed, a B in bar 3",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: F and G under a line that hangs on the raised 4th, longer echoes",
            response: {
              code: code(
                changes("<F G F [G F]>"),
                'pad: chord(changes).voicing().s("pad").gain(.5)',
                BASS,
                'mel: n("<[0 ~ 2 3] [5@3 3] [7 ~ 6 4] [3@3 ~]>").scale("F4:lydian").s("piano").delay(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "new numbers, still no 4th",
            response: { code: piece("<F G F G>", "<[0 ~ 4 5] [6@3 ~] [4 ~ 2 1] [0@3 ~]>", "F4:lydian") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the line moved to F major: its 4th is B♭",
            response: { code: piece("<F F F F>", MINIMAL_LINE, "F4:major") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
