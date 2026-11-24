// J4.L01 Turnarounds (spec: content/specs/J4.md). The last two bars of a tune send it back to its top: I–vi–ii–V
// (E♭maj7 Cm7 Fm7 B♭7 in E♭), the turn jazz shares with doo-wop. Swap its first two chords for iii–VI (Gm7 C7) and
// the turn gets brighter: Gm7 keeps three notes of E♭maj7, and C7 is a dominant aimed at Fm7, U15's V7/ii, so the
// turn pulls harder on its way home: iii–VI–ii–V.
//
// What the trio really plays (evaluated, `lefthand` anchored at A4): E♭maj7 G3 B♭3 D4 F4, Gm7 B♭3 D4 F4 A4 (three
// of E♭maj7's four notes, plus A), Cm7 B♭3 D4 E♭4 G4, C7 B♭3 D4 E4 A4 (E♭ rises to E and G to A: the brighter
// colour), Fm7 A♭3 C4 E♭4 G4, B♭7 A♭3 C4 D4 G4. The bass reads the same string (`rootNotes(2)`).
//
// Written for the learner at the gate (AUTHORING §20.1): J4 opens after U15.L06, so secondary dominants by name
// (V7/ii) are the learner's, borrowed chords (U16) and key changes (U17) are not. "Turnaround" is U11's word; this
// lesson introduces no term. The other turnarounds (I–VI7–ii–V, a tritone sub, the backdoor) appear only as the
// wrong answer of the right shape or wait for J5.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - what is HEARD: S4 compares the pitch classes and the lowest note of every chord that sounds (`pcset` per onset
//   with the bass, over the chords and the bass), so silent comping fails; the Make's `contains-rn` reads the run
//   iii7 → VI7 → ii7 → V7 in the chords that sound, by degree, chroma and quality (C7 counts as VI7, V7/ii);
// - each graded step pins a WRONG answer with the right roots or the right shape: Cm7 kept on degree 6 (iii–vi–ii–V,
//   the right roots), I–VI7–ii–V (the right dominant, no iii), vi7 named in slot 2, the right chords at `.gain(0)`;
//   and three other right answers. Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type RubricRule } from "@oak/content-kit";

const BPM = 132;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const Eb = { tonic: "Eb", mode: "major" } as const;
const C = { tonic: "C", mode: "major" } as const;

/** J1.L01's pocket on the jazz kit: the ride pattern and the hi-hat on 2 and 4. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** The bass in two from the changes: the root of every chord, low on the upright. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
/** J3's comping: the left-hand dictionary with the hand at A4, on the Charleston, swung. */
const COMP_RHYTHM = '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4)';
const comp = (
  dict = '.dict("lefthand").anchor("a4")',
  rhythm = COMP_RHYTHM,
  sound = '.s("rhodes").gain(.6)',
) => `chords: chord(changes)${dict}.voicing()${rhythm}${sound}`;
const COMP = comp();
const changes = (form: string) => `const changes = "${form}"\n`;
/** A whole trio from one string of changes. */
const trio = (form: string, ...lines: string[]) => code(changes(form), RIDE, HATS, BASS, COMP, ...lines);

const I_VI = "<Eb^7 Cm7 Fm7 Bb7>";
const III_VI = "<Gm7 C7 Fm7 Bb7>";
/** The hook: I–vi–ii–V, then iii–VI–ii–V; only bars 5 and 6 differ. */
const HOOK = trio("<Eb^7 Cm7 Fm7 Bb7 Gm7 C7 Fm7 Bb7>");
const PLAIN_TURN = trio(I_VI);

/** S4: the trio loops I–vi–ii–V; the learner turns it into iii–VI–ii–V. */
const modify = (form: string, ...lines: string[]) =>
  code(changes(form), RIDE, BASS, ...(lines.length ? lines : [COMP]));
const TURN_STARTER = code(changes("<⟪Eb^7 Cm7⟫ Fm7 Bb7>"), RIDE, BASS, COMP);
const TURN_SOLUTION = modify(III_VI);

/** S5: four turnarounds by ear, each four bars of the trio, in E♭ or in C. */
const earTrio = (form: string) => code(changes(form), RIDE, HATS, BASS, COMP);
const PLAIN = "plain";
const BRIGHT = "bright";
const TURN_OPTIONS = [
  { id: PLAIN, label: "I–vi–ii–V: the second chord is minor" },
  { id: BRIGHT, label: "iii–VI–ii–V: the second chord is a dominant" },
];
const earHints = (): HintLadder => [
  { text: "Listen to the second chord of the four: it either sits back or leans forward into the third." },
  {
    text: "In one turnaround the second chord is the key's own minor chord on degree 6; in the other it is a dominant seventh aimed at the ii that follows.",
  },
  {
    text: "Hear it again, slower, and listen from the second chord into the third: a dominant pulls into the chord a 5th below it the way V7 pulls home.",
    replay: { rate: 0.75 },
  },
  "auto",
];
const turn = (
  id: string,
  prompt: string,
  form: string,
  answer: string,
  key: typeof Eb | typeof C,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  key,
  prompt,
  skills: [{ skill: "J10", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: earTrio(form), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: { ui: "choice", options: TURN_OPTIONS },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      "Not this time. Listen to the second chord again: is it the key's own minor chord, or a dominant leaning into the third?",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: "the other turnaround",
      response: { answer: { choice: [answer === PLAIN ? BRIGHT : PLAIN] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/** S6: the Band plays the drums; eight bars of the learner's own, the last four I–vi–ii–V. */
const MAKE_FORM = "<Fm7 Bb7 Eb^7 Eb^7 Eb^7 Cm7 Fm7 Bb7>";
const make = (form: string, ...lines: string[]) =>
  code(changes(form), ...(lines.length ? lines : [BASS, COMP]));
const MAKE_STARTER = make(MAKE_FORM);
const MAKE_ANSWER = make("<Fm7 Bb7 Eb^7 Eb^7 Gm7 C7 Fm7 Bb7>");
/**
 * A vibes line over Fm7 B♭7 E♭maj7 E♭maj7 Gm7 C7 Fm7 B♭7: every note on a beat is a tone of its chord (evaluated):
 * C A♭ F | D A♭ | G B♭ D | E♭ | D B♭ G | E B♭ G | A♭ C E♭ | D A♭ F. In bar 6 the E of C7 is the bright note.
 */
const VIBES =
  'mel: note("<[c5 ~ ab4 f4] [d5 ~ ab4 ~] [g4 ~ bb4 d5] [eb5 ~ ~ ~] [d5 ~ bb4 g4] [e5 ~ bb4 g4] [ab4 ~ c5 eb5] [d5 ~ ab4 f4]>").swingBy(1/3, 4).s("vibes")';

/** The Make's one idea, heard in the chords that sound: the run iii7 → VI7 → ii7 → V7 in E♭. */
const BRIGHT_TURN: RubricRule = {
  id: "bright-turn",
  label: "The chords play iii7, VI7, ii7, V7 of E♭ in that order: Gm7, C7, Fm7, B♭7",
  required: true,
  skills: ["J10"],
  rule: "contains-rn",
  rn: ["iii7", "VI7", "ii7", "V7"],
  min: 1,
  inOrder: true,
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J4.L01",
  version: 4,
  title: "Turnarounds",
  objective: "I can end a tune with I–vi–ii–V or the brighter iii–VI–ii–V and send it back to the top.",
  key: Eb,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J10"],
  practises: [],
  terms: [],
  canDo: ["cd.write.turnarounds"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The same turn, brighter",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "same-turn-brighter",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the second chord of each four bars in both takes. Notice in which take it sits back, and in which it leans forward into the chord after it.",
        skills: [{ skill: "J10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: PLAIN_TURN,
            caption: "Four bars that lead home and round again.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The same turn, with its first two chords swapped.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "What C7 is doing",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "hook-again", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "what-c7-is-doing",
        version: 1,
        role: "practice",
        prompt:
          "Run the eight bars with the chord band showing numerals. Compare bars 1–4 with bars 5–8, chord by chord, and answer two questions: what C7 is doing in bar 6, and how many chords the two turns have in common.",
        skills: [{ skill: "J10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the chord band under bars 6 and 7: where does C7's root move, and how far? Then count the chords that are the same in both halves.",
        },
        hints: ladder(
          "C7 is not the chord E♭ major owns on degree 6. Look at the chord right after it, in bar 7.",
          "A dominant seventh whose root falls a 5th to the next chord is that chord's V7. Here the next chord is Fm7, the ii.",
          "Bars 7 and 8 are the same in both halves; so are bars 3 and 4.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What is C7 doing in bar 6?",
            options: [
              { id: "applied", label: "It is the V7 of Fm7, a dominant aimed at the ii" },
              { id: "own", label: "It is the key's own chord on degree 6" },
              { id: "passing", label: "It passes between two chords and leads nowhere" },
            ],
            correct: ["applied"],
          },
          {
            q: "number",
            prompt: "How many chords do the two four-bar turns have in common?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["applied"], number: 2 } }, expect: "pass" },
          {
            name: "the key's own chord: Cm7 is, C7 is not",
            response: { answer: { choice: ["own"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "three: Gm7 counted as E♭maj7",
            response: { answer: { choice: ["applied"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Name the bright turn",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "fact",
        id: "name-the-bright-turn",
        version: 1,
        role: "check",
        key: Eb,
        prompt:
          "The second turnaround in E♭: Gm7, C7, Fm7, B♭7. Write the numeral of each chord in E♭, sevenths included. For the one chord that is not the key's own, write it as the V7 of the chord it leads to, with a slash.",
        skills: [{ skill: "J10", w: 1 }],
        hints: ladder(
          "Three of the four chords are E♭ major's own sevenths. Find the one with a note outside the key, and see where it leads.",
          "Count each root's degree in E♭: G is 3, C is 6, F is 2, B♭ is 5. Then the quality: minor, dominant, minor, dominant.",
          "Fm7 is ii7 and B♭7 is V7. The chord before Fm7 is the V7 of that ii.",
        ),
        stimulus: { src: "code", code: trio(III_VI), bars: 4, showCode: false },
        answer: { ui: "rn-palette", slots: 4, allow: ["sevenths", "secondary"] },
        correct: { rn: ["iii7", "V7/ii", "ii7", "V7"] },
        spelling: "enharmonic",
        order: "sequence",
        srs: [{ family: "fam.jzz.ii-v", mode: "review-if-due" }],
        feedbackText: {
          "harmony.rn-quality":
            "Chord {slot}: the right degree, another kind of chord. Listen to it again: minor, major or dominant?",
          "harmony.rn-degree":
            "Chord {slot}: {got} is not the name this step asks for. Count the root against E♭, then hear the quality: a chord that is not the key's own takes its name from the chord it leads to, with a slash.",
        },
        tests: [
          {
            name: "iii7 V7/ii ii7 V7",
            response: { answer: { rn: ["iii7", "V7/ii", "ii7", "V7"] } },
            expect: "pass",
          },
          {
            name: "VI7: the right chord, not named by where it leads",
            response: { answer: { rn: ["iii7", "VI7", "ii7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "vi7 in slot 2: the minor chord of I–vi–ii–V",
            response: { answer: { rn: ["iii7", "vi7", "ii7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "V/ii without the 7",
            response: { answer: { rn: ["iii7", "V/ii", "ii7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "Imaj7 in slot 1: the first chord of the other turnaround",
            response: { answer: { rn: ["Imaj7", "V7/ii", "ii7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Brighten the turn",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "brighten-the-turn",
        version: 1,
        role: "check",
        key: Eb,
        prompt:
          "The trio loops I–vi–ii–V in E♭. Turn it into iii–VI–ii–V: rewrite the first two chords in `changes` and leave Fm7 and B♭7 as they are. Done when the loop matches the target.",
        skills: [{ skill: "J10", w: 1 }],
        swing: SWUNG,
        code: { starter: TURN_STARTER },
        reference: { solutions: [TURN_SOLUTION], bars: 4 },
        // Heard: the pitch classes and the lowest note of every chord that sounds, over the comping and the bass
        // together (the bass reads `rootNotes`, so the lowest note is the root). Cm7 kept on degree 6, or C7 put
        // after E♭maj7, fails on a note; the right string over silent comping leaves only the roots.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords", "bass"], durations: true },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Listen to bars 1 and 2 of the target: the first chord keeps most of E♭maj7's notes over another root, and the second leans hard into Fm7.",
          "harmony.bass":
            "Bar {bar}: the right notes over another bass note. The bass reads the same string as the chords: check the root of that chord.",
          "code.unknown-chord":
            "Strudel does not know that chord name. A dominant seventh is written as its root and a 7, the way `Bb7` is.",
        },
        hints: ladder(
          "Count up E♭ major to degrees 3 and 6: those are the roots of the two new chords.",
          "Degree 3 of E♭ is G, and the iii is minor. Degree 6 is C, and the VI here is not the key's own minor chord but the V7 of Fm7.",
          "The first chord is `Gm7`. The second keeps the root of Cm7: which kind of seventh leans into Fm7?",
        ),
        tests: [
          { name: "reference", response: { code: TURN_SOLUTION }, expect: "pass" },
          {
            name: "the comping on the piano",
            response: { code: modify(III_VI, comp(undefined, undefined, '.s("piano").gain(.6)')) },
            expect: "pass",
          },
          {
            name: "the comping held a whole bar",
            response: { code: modify(III_VI, comp(undefined, "", '.s("rhodes").gain(.6)')) },
            expect: "pass",
          },
          {
            name: "the hand anchored at G4",
            response: { code: modify(III_VI, comp('.dict("lefthand").anchor("g4")')) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(TURN_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right roots, Cm7 kept: iii–vi–ii–V",
            response: { code: modify("<Gm7 Cm7 Fm7 Bb7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right dominant after E♭maj7: I–VI7–ii–V",
            response: { code: modify("<Eb^7 C7 Fm7 Bb7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right chords, the comping silent",
            response: { code: modify(III_VI, comp(undefined, undefined, '.s("rhodes").gain(0)')) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Cdom7: not a chord symbol",
            response: { code: modify("<Gm7 Cdom7 Fm7 Bb7>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Which turnaround",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "which-turnaround",
        version: 1,
        role: "check",
        prompt:
          "Four turnarounds, four bars each, in E♭ and in C, one at a time. For each, pick I–vi–ii–V or iii–VI–ii–V.",
        skills: [{ skill: "J10", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.jzz.ii-v", mode: "review-if-due" }],
        tests: [],
        parts: [
          turn("turn-one", "Turnaround 1, in E♭.", III_VI, BRIGHT, Eb),
          turn("turn-two", "Turnaround 2, in C.", "<C^7 Am7 Dm7 G7>", PLAIN, C),
          turn("turn-three", "Turnaround 3, in C.", "<Em7 A7 Dm7 G7>", BRIGHT, C),
          turn("turn-four", "Turnaround 4, in E♭.", I_VI, PLAIN, Eb),
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your turnaround",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-turnaround",
        version: 1,
        role: "practice",
        key: Eb,
        title: "Turnaround in E♭",
        prompt:
          "Write your song's bridge, eight bars in E♭ in `changes`. Make bars 5 to 8 turn around through iii–VI–ii–V, back to the top; the starter turns there with I–vi–ii–V. The first four bars are yours. Done when the chords play iii–VI–ii–V in that order. Also on the checklist: one or two chords a bar, and a vibes line.",
        skills: [{ skill: "J10", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          BRIGHT_TURN,
          {
            id: "two-a-bar",
            label: "Every bar holds one or two chords",
            required: false,
            skills: ["J10"],
            rule: "harmonic-rhythm",
            changesPerBar: [1, 2],
          },
          {
            id: "tune-on-top",
            label: "A vibes line plays",
            required: false,
            skills: ["J10"],
            rule: "sounds",
            contains: ["snd.vibes"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral: the rule's own
        // detail names the chord it is missing.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Change only bars 5 and 6, the turn's first two chords. Bars 7 and 8 already hold ii and V.",
          "Bars 5 and 6 hold I and vi. The bright turn starts on the minor chord of degree 3, then a dominant on degree 6 that leans into the ii.",
          "Bar 5 becomes `Gm7`. Bar 6 keeps its root and becomes a dominant seventh.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: bars 5 and 6 changed", response: { code: MAKE_ANSWER }, expect: "pass" },
          {
            // Two chords a bar: comped on 1, the and of 2 and the and of 3, so the second chord of each bar sounds too
            // (the Charleston strikes twice in the first half and would leave C7 and B♭7 to the bass alone).
            name: "the turnaround two chords a bar, at the end",
            response: {
              code: make(
                "<Fm7 Bb7 Eb^7 Eb^7 Fm7 Bb7 [Gm7 C7] [Fm7 Bb7]>",
                BASS,
                comp(undefined, '.struct("x ~ ~ x ~ x ~ ~").swingBy(1/3, 4)'),
              ),
            },
            expect: "pass",
          },
          {
            name: "the right changes, the comping silent over the bass's roots: .gain(0)",
            response: {
              code: make(
                "<Fm7 Bb7 Eb^7 Eb^7 Gm7 C7 Fm7 Bb7>",
                BASS,
                comp(undefined, undefined, '.s("rhodes").gain(0)'),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "beyond the brief: a vibes line, a bass in two, the piano, faster",
            response: {
              code: make(
                "<Fm7 Bb7 Eb^7 Eb^7 Gm7 C7 Fm7 Bb7>",
                'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")',
                comp(undefined, undefined, '.s("piano").gain(.5)'),
                VIBES,
              ).replace(`setcpm(${BPM}/4)`, "setcpm(160/4)"),
            },
            expect: "pass",
          },
          {
            name: "the comping from guide tones",
            response: { code: make("<Fm7 Bb7 Eb^7 Eb^7 Gm7 C7 Fm7 Bb7>", BASS, comp('.dict("guidetones")')) },
            expect: "pass",
          },
          {
            name: "I–VI7–ii–V: the right dominant, no iii before it",
            response: { code: make("<Fm7 Bb7 Eb^7 Eb^7 Eb^7 C7 Fm7 Bb7>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "iii–vi–ii–V: the right roots, Cm7 kept",
            response: { code: make("<Fm7 Bb7 Eb^7 Eb^7 Gm7 Cm7 Fm7 Bb7>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right chords, the comping silent and the bass by hand",
            response: {
              code: make(
                "<Fm7 Bb7 Eb^7 Eb^7 Gm7 C7 Fm7 Bb7>",
                'bass: note("<f2 bb1 eb2 eb2 g2 c2 f2 bb1>").s("upright")',
                comp(undefined, undefined, '.s("rhodes").gain(0)'),
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
