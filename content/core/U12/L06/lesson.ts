// U12.L06 Seventh Ear Lab & Left-Hand Voicings. A pianist's left hand leaves the root to the bass and plays the
// rest of a seventh chord close together in the middle of the keyboard: the 3rd and the 7th with one or two
// colour notes. `.dict("lefthand")` voices chords that way (Cmaj7 becomes B D E G, Dm7 C E F A). Two interval
// ideas explain what the hand is doing: the D on top of the left-hand Cmaj7 is a 9th above C, a 2nd an octave
// up (a compound interval), and a 3rd turned upside down is a 6th (an interval inversion), moved here from
// U04. What the learner has: the five seventh qualities by name and by ear (U12.L01–L03), every degree's
// seventh (U12.L04), guide tones (U12.L05), chords by name with `.voicing()` and the `triads` dictionary
// (U05.L08), interval names with their quality (U04), `.struct()` (U09). Not yet: shells (J1.L05), the
// words "tension" and "extension" (J2.L03), pushes and ghost notes (U13). Spec: content/specs/U12.md.
//
// How it is graded (AUTHORING §17, §19.1): the interval quiz is three typed interval names (`normalize:
// "interval"`), so a wrong quality and a wrong number get different feedback. The modify step grades the
// left-hand loop as pitch classes and lowest note per onset against a reference in the same dictionary, with
// `must-use tb.dict.lefthand`: `.dict("lefthand")` written after `.voicing()` changes nothing and is named by
// `harmony.pcset`. The ear step is five trials of `fam.chd.quality-7th` at level 4, all five qualities. The
// Make's one required rule is `voiced-with lefthand` on `chords`: the chords themselves must be voiced by that
// dictionary, so `.dict("lefthand")` written after `.voicing()`, or on the bass, does not meet it.
import { defineLesson, type FactEx, type HintLadder, type IdentifyEx } from "@oak/content-kit";

const BPM = 112;
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
/** The comping rhythm of the hook: the "and" of 1, then beat 3. */
const COMP = '.struct("~ x ~ ~ x ~ ~ ~")';
/**
 * The upright plays the roots in quarter notes (no walking bass: that moves between the roots), and the left-hand
 * voicings below leave the root to it.
 */
const WALK = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("upright")';
/** The guitar answers the comping: A F over Dm7, B G over G7, G B over Cmaj7, then a bar of space. */
const GTR = 'gtr: n("<[~ 5 ~ 3] [~ 6 ~ 4] [~ 4 6 ~] ~>").scale("C4:major").s("jazzgtr")';
const TRIO = "<Dm7 G7 C^7 C^7>";

/** The trio loop with the chords in the dictionary given (`""` is the default one). */
const trio = (dict: string, sound = "rhodes") =>
  code(changes(TRIO), `chords: chord(changes)${dict}.voicing()${COMP}.s("${sound}")`, WALK, GTR);
const LEFT = '.dict("lefthand")';
const HOOK = trio(LEFT);
/** S1, first item: the same three chords held, one a bar, in the default voicing over a root bass. */
const PLAIN = code(
  changes(TRIO),
  'chords: chord(changes).voicing().s("rhodes")',
  'bass: chord(changes).rootNotes(2).s("upright")',
);

/** S2: Cmaj7 for the left hand over a low C. */
const LEFT_CMAJ7 = code(
  'chords: chord("C^7").dict("lefthand").voicing().s("rhodes")',
  'bass: note("c2").s("upright")',
);
/**
 * S3: Cmaj7 stacked by hand from C3 (C E G B), then the left-hand Cmaj7 (B3 D4 E4 G4) over the same C3 in
 * the bass. D4 is the one note that is not in the stack: 14 half steps above C3, a 9th.
 */
const STACK_THEN_LEFT = code(
  'keys: note("<[c3,e3,g3,b3] ~>").s("rhodes")',
  'chords: chord("<~ C^7>").dict("lefthand").voicing().s("rhodes")',
  'bass: note("<~ c3>").s("upright")',
);

/** S4: each interval played twice as a pair of notes, low then high: the plain one, then the turned one. */
const pairs = (pattern: string) => code(`mel: note("${pattern}").s("piano")`);

/**
 * The Make: Cmaj7 Am7 Dm7 G7 held in the default voicing over the upright's quarter-note roots, with a line that meets each chord
 * on a guide tone (B over Cmaj7, G over Am7, F over Dm7, F over G7).
 */
const MAKE_LINE = 'mel: n("<[6 ~ 4 ~] [4 ~ 2 ~] [3 ~ 5 ~] [3 ~ 1 ~]>").scale("C5:major").s("piano")';
/** The upright plays the roots on every beat, so a comping rhythm that starts between the beats still has its root under it. */
const MAKE_BASS = WALK;
const make = (form: string, chords: string, ...rest: string[]) =>
  code(changes(form), `chords: chord(changes)${chords}`, ...rest);
const MAKE_STARTER = make("<C^7 Am7 Dm7 G7>", '.voicing().s("rhodes")', MAKE_BASS, MAKE_LINE);

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** S4: one interval to name, heard first as a pair of notes. */
const factPart = (
  id: string,
  prompt: string,
  stimulus: string,
  answer: string,
  hints: HintLadder,
  wrong: { name: string; text: string; feedback: "id.interval-quality" | "id.interval-number" }[],
  alt: string,
): FactEx => ({
  kind: "fact",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "I04", w: 1 }],
  hints,
  stimulus: { src: "code", code: stimulus, bars: 2, showCode: false },
  answer: { ui: "text", normalize: "interval" },
  correct: { text: [answer] },
  feedbackText: {
    "id.interval-quality":
      "Right number, a {generic}, but {exp} ({expLong}), not {got}. Count the half steps: {semis}.",
    "id.interval-number":
      "That was {exp} ({expLong}), not {got}. Count the letter names from the lower note, both ends included.",
    // An answer the interval reader cannot parse ("4" without its quality): the catalog
    // would say "Listen to both", which a typed name cannot act on.
    "id.wrong":
      "Write the name as a quality and a number, the way the prompt shows: `M3`, `m6`, `P4`, `M10`. Oak cannot read “{got}”.",
  },
  spelling: "strict",
  order: "sequence",
  tests: [
    { name: answer, response: { answer: { text: [answer] } }, expect: "pass" },
    { name: `written out: ${alt}`, response: { answer: { text: [alt] } }, expect: "pass" },
    {
      name: "the number without its quality",
      response: { answer: { text: [answer.slice(1)] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
    ...wrong.map((w) => ({
      name: w.name,
      response: { answer: { text: [w.text] } },
      expect: "fail" as const,
      feedback: [w.feedback],
    })),
  ],
});

/** S6: one trial of the family per part, drawn by the lesson host; all five qualities at level 4. */
const PAD: IdentifyEx["answer"] = { ui: "quality-pad", set: ["maj7", "7", "m7", "m7b5", "dim7"] };
const earHints = (): HintLadder =>
  ladder(
    "Start under the top note. Is the triad inside the chord major, minor or diminished?",
    "A major triad: the 7th decides, a half step under the octave (Cmaj7's kind) or a whole step (C7's). A minor triad: a minor seventh chord. A diminished triad: half-diminished, or the diminished seventh if every note is three half steps from the next.",
    "Hum the lowest note, then the chord's top note. Under a major triad, does it rest or lean on? Under a diminished one, is it dark but settled, or does it want to move at once?",
  );
const earPart = (n: number): IdentifyEx => ({
  kind: "identify",
  id: `seventh-${n}`,
  version: 1,
  role: "check",
  prompt: `Chord ${n}: any of the five kinds.`,
  skills: [{ skill: "E11", w: 1 }],
  hints: earHints(),
  stimulus: { src: "generator", family: "fam.chd.quality-7th", level: 4 },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: PAD,
  correct: {},
  tests: [],
});

export default defineLesson({
  id: "U12.L06",
  version: 3,
  title: "Seventh Ear Lab & Left-Hand Voicings",
  objective:
    'I can voice seventh chords the way a pianist\'s left hand does with .dict("lefthand"), name the 9th on top as a 2nd an octave up, turn an interval upside down, and hear all five sevenths.',
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["I04"],
  practises: ["E11"],
  terms: [
    { id: "term.rootless-voicing", step: "S3" },
    { id: "term.compound-interval", step: "S3" },
    { id: "term.interval-inversion", step: "S4" },
  ],
  canDo: ["cd.code.left-hand-voicings", "cd.read.interval-inversion"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two pianists",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-pianists",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops and follow the chords on the roll, not the band. In loop 2, listen and look for two things: where the chords sit on the keyboard, and how far their notes move from one chord to the next.",
        skills: [{ skill: "C07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, caption: "Loop 1: Dm7, G7, Cmaj7 in the voicing you know, one a bar.", bars: 4 },
          {
            code: HOOK,
            caption:
              "Loop 2: the same chords from a pianist, with the bass on every beat and a guitar answering.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "The missing note",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "the-missing-note",
        version: 1,
        role: "practice",
        prompt:
          'Predict which of Cmaj7\'s own notes, C E G B, is not in the hand, then run it. With `.dict("lefthand")` the chord plays B, D, E and G, and the bass plays a low C.',
        skills: [{ skill: "C07", w: 1 }],
        hints: null,
        tests: [],
        code: LEFT_CMAJ7,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "root", label: "C, the root" },
          { id: "third", label: "E, the 3rd" },
          { id: "seventh", label: "B, the 7th" },
        ],
        correct: ["root"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "A 2nd, an octave up",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note" },
      example: { id: "stack-then-left", code: STACK_THEN_LEFT, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "a-second-an-octave-up",
        version: 1,
        role: "practice",
        prompt:
          "Run the code and compare the two bars on the roll. One note of bar 2 is not in the stack: D, just above the octave from C, a 9th counted from C. Then answer both questions: a 9th is an octave plus which interval, and how many half steps lie from the low C up to that D.",
        skills: [{ skill: "I04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Go from C up to the next C, an octave, 12 half steps. The D is one more letter on: C to D is a 2nd, 2 half steps. Add them.",
        },
        hints: ladder(
          "Find the next C above the low one on the roll. How far past it is the D?",
          "An octave is 12 half steps and spans eight letters. The D sits just past the octave's top C.",
          "C up to the next C is 12 half steps. From that C up to D is 2 more.",
        ),
        code: { starter: STACK_THEN_LEFT },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "A 9th is an octave plus which interval?",
            options: [
              { id: "second", label: "A 2nd" },
              { id: "third", label: "A 3rd" },
              { id: "seventh", label: "A 7th" },
            ],
            correct: ["second"],
          },
          { q: "number", prompt: "How many half steps from the low C up to that D?", correct: 14 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["second"], number: 14 } },
            expect: "pass",
          },
          {
            name: "a 9th taken for a 7th plus a 2nd",
            response: { answer: { choice: ["seventh"], number: 14 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two half steps: C to D without the octave",
            response: { answer: { choice: ["second"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Turn it over, stretch it",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "turn-it-over-stretch-it",
        version: 1,
        role: "check",
        prompt:
          "Name three intervals, each played as two notes, low then high. Type each name as a quality and a number, like `M3`, `m6` or `P4`; a 10th is `M10` or `m10`.",
        skills: [{ skill: "I04", w: 1 }],
        hints: ladder(
          "Count the letter names from the lower note, both ends included. Then count the half steps.",
          "Moving the lower note up an octave turns a 3rd into a 6th and a 5th into a 4th. An octave plus a 3rd is a 10th.",
          "The two numbers add up to 9: a 3rd turns into a 6th. Major turns into minor.",
        ),
        srs: [{ family: "fam.int.isolated", mode: "seed" }],
        tests: [],
        parts: [
          factPart(
            "e-up-to-c",
            "C up to E is a major 3rd. Now turn it over: E up to the next C. Name it.",
            pairs("<[c4 e4] [e4 c5]>"),
            "m6",
            ladder(
              "Count the letters from E up to C, both ends included.",
              "E F G A B C is six letters: a 6th. How many half steps, 8 or 9?",
              "E up to C is 8 half steps. A major 6th would be 9.",
            ),
            [
              { name: "M6 for m6", text: "M6", feedback: "id.interval-quality" },
              { name: "M3 kept: the 3rd not turned over", text: "M3", feedback: "id.interval-number" },
            ],
            "minor 6th",
          ),
          factPart(
            "g-up-to-c",
            "C up to G is a perfect 5th. Turned over, G up to the next C. Name it.",
            pairs("<[c4 g4] [g4 c5]>"),
            "P4",
            ladder(
              "Count the letters from G up to C, both ends included.",
              "G A B C is four letters. Is a 4th of 5 half steps major, minor or perfect?",
              "The numbers add up to 9: 5 and 4. A perfect interval stays perfect.",
            ),
            [{ name: "P5 for P4", text: "P5", feedback: "id.interval-number" }],
            "perfect 4th",
          ),
          factPart(
            "c-up-to-high-e",
            "C up to the E an octave and a major 3rd above it. Name it.",
            pairs("<[c4 e4] [c4 e5]>"),
            "M10",
            ladder(
              "Count the letters from C all the way up to the high E, both ends included.",
              "C up to the next C is eight letters. Two more, D and E, make ten.",
              "An octave plus a 2nd is a 9th; one letter more is a 10th. The 3rd inside it is major.",
            ),
            [
              { name: "M3 for M10: the octave left out", text: "M3", feedback: "id.interval-number" },
              { name: "m10 for M10", text: "m10", feedback: "id.interval-quality" },
            ],
            "major 10th",
          ),
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Voice it for the left hand",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "voice-it-for-the-left-hand",
        version: 1,
        role: "check",
        prompt:
          "Voice the chords for a pianist's left hand: on the chords line, add a `.dict()` that names the left hand's dictionary, before `.voicing()`. Keep the bass and the guitar as they are.",
        skills: [
          { skill: "C07", w: 0.5 },
          { skill: "I04", w: 0.5 },
        ],
        code: { starter: trio("") },
        reference: { solutions: [HOOK], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one, against the same loop in
        // the left-hand dictionary (contracts §6.7).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "must-use", tool: "tb.dict.lefthand", feedback: "code.must-use" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the left hand plays {exp}. `.voicing()` reads the dictionary, so the dictionary goes before it, on the chords line.",
          "code.must-use":
            "The chords line needs the left hand's dictionary: `.dict()` with its name, before `.voicing()`.",
        },
        hints: ladder(
          "Only the chords line changes. Which part of it decides where the notes of each chord go?",
          '`.voicing()` reads a dictionary, the way it read `.dict("triads")` for plain triads. This one is named for the hand a pianist comps with.',
          "Write `.dict()` between `chord(changes)` and `.voicing()`, with the hand's name in the quotes, all lower case.",
        ),
        tests: [
          { name: "reference", response: { code: HOOK }, expect: "pass" },
          {
            name: "on the jazz guitar, the dictionary after the rhythm",
            response: {
              code: code(
                changes(TRIO),
                `chords: chord(changes)${COMP}.dict("lefthand").voicing().s("jazzgtr")`,
                WALK,
                GTR,
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: trio("") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the dictionary after .voicing(): nothing changes",
            response: {
              code: code(
                changes(TRIO),
                `chords: chord(changes).voicing()${LEFT}${COMP}.s("rhodes")`,
                WALK,
                GTR,
              ),
            },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the triads dictionary: sevenths are silent in it",
            response: { code: trio('.dict("triads")') },
            expect: "fail",
            feedback: ["code.chord-not-in-dict"],
          },
          {
            name: "the left hand given to the bass line",
            response: {
              code: code(
                changes(TRIO),
                `chords: chord(changes).voicing()${COMP}.s("rhodes")`,
                'bass: chord(changes).dict("lefthand").rootNotes(2).struct("x x x x").s("upright")',
                GTR,
              ),
            },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "All five by ear",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "all-five-by-ear",
        version: 1,
        role: "check",
        prompt:
          "Name the kind of each of five seventh chords, played one at a time on changing roots. Any of the five kinds can come: major seventh, dominant seventh, minor seventh, half-diminished or diminished seventh.",
        skills: [{ skill: "E11", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.chd.quality-7th", mode: "review-if-due" }],
        tests: [],
        parts: [1, 2, 3, 4, 5].map(earPart),
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your trio",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-trio",
        version: 1,
        role: "practice",
        title: "Your trio",
        prompt:
          "Voice the chords line for the left hand, with the same dictionary as the trio you fixed. Then give the comping a rhythm with `.struct()`, on the Rhodes or the jazz guitar, and keep the bass on the roots. You may swap in a loop of your own from this unit.",
        skills: [
          { skill: "C07", w: 0.5 },
          { skill: "I04", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "voiced-for-the-left-hand",
            label:
              'The chords line reads the left hand\'s dictionary, `.dict("lefthand")`, before `.voicing()`',
            required: true,
            skills: ["C07", "I04"],
            rule: "custom",
            fn: "voiced-with",
            params: { track: "chords", dict: "lefthand" },
          },
          {
            id: "bass-on-roots",
            label:
              "The bass plays the chord's root where the chord changes, at three changes in four or more, since the hand leaves it out",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
          {
            id: "jazz-guitar",
            label: "The jazz guitar (`jazzgtr`) plays somewhere",
            required: false,
            skills: ["C07"],
            rule: "sounds",
            anyOf: ["snd.jazzgtr"],
          },
          {
            id: "line-on-guide-tones",
            label:
              "The `mel` line plays the chord's 3rd or 7th where the chord changes, at three changes in four or more",
            required: false,
            skills: ["C08"],
            rule: "guide-tones",
            track: "mel",
            harmony: "chords",
            minRatio: 0.75,
            at: "change",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Change the code until this line of the checklist holds.",
        },
        hints: ladder(
          "The first line of the checklist is about how the chords are voiced. Which line of the code decides that?",
          "The chords line reads the default dictionary. The left hand's dictionary goes before `.voicing()`, as in the trio you fixed.",
          'Add `.struct("~ x ~ ~ x ~ ~ ~")` after `.voicing()` for a rhythm, then name the dictionary for the hand.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the same loop for the left hand",
            response: {
              code: make("<C^7 Am7 Dm7 G7>", `${LEFT}.voicing().s("rhodes")`, MAKE_BASS, MAKE_LINE),
            },
            expect: "pass",
          },
          {
            name: "the hint's comping rhythm, for the left hand",
            response: {
              code: make("<C^7 Am7 Dm7 G7>", `${LEFT}.voicing()${COMP}.s("rhodes")`, MAKE_BASS, MAKE_LINE),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: its own loop on the jazz guitar, comped, the roots in quarter notes, a swung line",
            response: {
              code: make(
                "<Dm7 G7 C^7 Am7>",
                `${LEFT}.voicing().struct("x ~ ~ x ~ ~ x ~").s("jazzgtr")`,
                MAKE_BASS,
                'mel: n("<[3 ~ 2 ~] [3 ~ ~ 1] [6 ~ 4 ~] [4 ~ 6 ~]>").scale("C5:major").s("rhodes").swingBy(1/3, 4)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the dictionary written after .voicing(): the chords keep the default voicing",
            response: {
              code: make("<C^7 Am7 Dm7 G7>", `.voicing()${LEFT}.s("rhodes")`, MAKE_BASS, MAKE_LINE),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the left hand's dictionary on the bass line, not the chords",
            response: {
              code: make(
                "<C^7 Am7 Dm7 G7>",
                '.voicing().s("rhodes")',
                'bass: chord(changes).dict("lefthand").rootNotes(2).struct("x x x x").s("upright")',
                MAKE_LINE,
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "its own changes for the left hand, comped long–short on the jazz guitar",
            response: {
              code: make(
                "<Am7 D7 G^7 C^7>",
                `${LEFT}.voicing().struct("x ~ ~ x ~ ~ ~ ~").s("jazzgtr")`,
                MAKE_BASS,
                MAKE_LINE,
              ),
            },
            expect: "pass",
          },
          {
            name: "comped with a rhythm, still in the default voicing",
            response: {
              code: make("<C^7 Am7 Dm7 G7>", `.voicing()${COMP}.s("jazzgtr")`, MAKE_BASS, MAKE_LINE),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
