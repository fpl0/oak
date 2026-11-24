// J5.L01 Tritone Substitution (the J5 exemplar; spec: content/specs/J5.md). G7 and D♭7 share their 3rd and their
// 7th (B and F; in D♭7 the B is spelled C♭), so either one leads into C. Put D♭7 where G7 was and the bass slides
// down by half steps, D, D♭, C, under the same two guide tones: the tritone substitution, ♭II7 for V7, the sound of a
// jazz ballad's last bar.
//
// Written for the learner at the gate (AUTHORING §20.1): J5 opens after U17.CP and J4.L04, so the whole core and
// J1–J4 are behind the learner (J2.L04's chord-scales may not be: it can be passed over). The lesson unlocks no
// tool; it uses chord symbols by name, `.dict("lefthand")` and `.dict("guidetones")`, the jazz kit and the vibes.
// Device first heard on a record-like trio (S1), then swapped in by the learner in a ii–V–I they know (S4, in F)
// and in the I–VI–ii–V turnaround of J4.L01 (S7, in B♭): keys rotate (C, F, E♭, B♭) as the jazz track does.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - what is HEARD: S4 compares the chords that sound and their lowest note (`pcset` per onset with the bass), so
//   the substitute must sound in the bass too; the Make's `device-count` reads the chords that sound (a muted or
//   masked chords line has none), and only a DOMINANT a half step above the chord it moves to counts;
// - each graded step pins a WRONG answer that uses the right device in the wrong way (D♭maj7 or G♭maj7: the
//   right root, no dominant; D♭7 carried over from C into F; the substitute put on the ii) and three other right
//   answers (F♯7 spelled with sharps, `!` in place of a repeated chord, the bass written by hand, C♭7 for B7).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 120;
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

const SWING = ".swingBy(1/3, 4)";
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const C = { tonic: "C", mode: "major" } as const;
const F = { tonic: "F", mode: "major" } as const;
const Eb = { tonic: "Eb", mode: "major" } as const;
const Bb = { tonic: "Bb", mode: "major" } as const;

/** The trio of J1: the ride pattern and the hi-hat on 2 and 4 on the jazz kit. */
const RIDE = `drums: s("rd [rd rd] rd [rd rd]")${SWING}.bank("jazzkit")`;
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** Rhodes comping on the Charleston in the left hand's voicings, from one chord string. */
const comp = (changes: string) =>
  `chords: chord(${changes}).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~")${SWING}.s("rhodes").gain(.6)`;
/** A bass in two from the same string: the root on 1 and 3. */
const ROOTS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")';

/**
 * The hook, in C: a bass in two and a vibes line over Dm7 G7 Cmaj7, then the same four bars with D♭7 in bar 2.
 * The vibes line is A F D | F B | C E G B | E: over G7 and over D♭7 its bar-2 notes, F and B, are the chords' 3rd
 * and 7th both times (evaluated: `guidetones` voices G7 and D♭7 as the same F4 B4).
 */
const II_V_I = "<Dm7 G7 C^7 C^7>";
const II_SUB_I = "<Dm7 Db7 C^7 C^7>";
const twoFeel = (bar2: string) => `bass: note("<[d2 a1] ${bar2} [c2 g1] [c2 e2]>").s("upright")`;
const BASS_V = twoFeel("[g1 d2]");
const BASS_SUB = twoFeel("[db2 ab1]");
const VIBES = `mel: note("<[a4 ~ f4 d4] [f4 ~ ~ b3] [c4 e4 g4 b4] [e4 ~ ~ ~]>")${SWING}.s("vibes")`;
const TRIO_V = code(RIDE, HATS, BASS_V, comp(`"${II_V_I}"`), VIBES);
const TRIO_SUB = code(RIDE, HATS, BASS_SUB, comp(`"${II_SUB_I}"`), VIBES);
/** Both endings in one eight-bar loop, for the predict step: G7 in bar 2, D♭7 in bar 6. */
const BOTH = code(
  RIDE,
  HATS,
  'bass: note("<[d2 a1] [g1 d2] [c2 g1] [c2 e2] [d2 a1] [db2 ab1] [c2 g1] [c2 e2]>").s("upright")',
  comp('"<Dm7 G7 C^7 C^7 Dm7 Db7 C^7 C^7>"'),
  VIBES,
);

/** S3: G7 and D♭7 in two notes each, over their roots. */
const SHARED = code(
  'chords: chord("<G7 Db7>").dict("guidetones").voicing().s("rhodes")',
  'bass: note("<g2 db2>").s("upright")',
);

/** S4: the ii–V–I in F from one string; the learner replaces the V. */
const modify = (changes: string, bass = ROOTS) =>
  code(`const changes = "${changes}"`, "", RIDE, HATS, comp("changes"), bass);
const SUB_STARTER = modify("<Gm7 ⟪C7⟫ F^7 F^7>");
const SUB_SOLUTION = modify("<Gm7 Gb7 F^7 F^7>");

/** S5: the ii–V–I in E♭, heard; the learner types the substitute. */
const IN_EB = code('const changes = "<Fm7 Bb7 Eb^7 Eb^7>"', "", RIDE, HATS, comp("changes"), ROOTS);

/**
 * S7: the I–VI–ii–V turnaround of J4.L01 in B♭, looping; the Band plays the drums. The bass is written by hand,
 * root and 5th: the slide is the learner's to write, and a chords line that is muted leaves nothing for the rule to
 * hear (a `rootNotes()` bass would still carry the chord's name: see the spec's note for the grader).
 */
const bassBb = (bar2 = "[g1 d2]", bar4 = "[f1 c2]") =>
  `bass: note("<[bb1 f2] ${bar2} [c2 g1] ${bar4}>").s("upright")`;
const turnaround = (changes: string, bass = bassBb(), extra: string[] = []) =>
  code(`const changes = "${changes}"`, "", comp("changes"), bass, ...extra);
const MAKE_STARTER = turnaround("<Bb^7 G7 Cm7 F7>");
/** The substitutes' basses: D♭ and A♭ under D♭7, B and F♯ under B7. */
const SLIDE_2 = "[db2 ab1]";
const SLIDE_4 = "[b1 f#2]";
/** A vibes line over the turnaround: D | B (C♭ in D♭7) | E♭ | E♭, each a chord tone of the substituted chords. */
const MAKE_VIBES = `mel: note("<[d5 ~ c5 bb4] [b4 ~ ~ ~] [eb5 ~ d5 c5] [eb5 ~ ~ ~]>")${SWING}.s("vibes")`;

/** The Make's one idea: a dominant a half step above the chord it moves to, heard on the chords line. */
const TRITONE_SUB: RubricRule = {
  id: "tritone-sub",
  label: "At least one dominant is replaced by its tritone substitute, the dominant six half steps away",
  required: true,
  skills: ["J13"],
  rule: "device-count",
  devices: ["tritone sub"],
  min: 1,
};

/**
 * The slide is heard in the bass (review): the brief asks the bass to move with the substitute, and the bass is
 * written by hand, so a substitute over the old root (B7 over F, a bass that never slides) is told so.
 */
const BASS_FOLLOWS: RubricRule = {
  id: "bass-follows",
  label: "At every chord change the bass plays the new chord's root",
  required: false,
  skills: ["J13"],
  rule: "bass-line",
  track: "bass",
  harmony: "chords",
  roots: { on: "change", minRatio: 1 },
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J5.L01",
  version: 4,
  title: "Tritone Substitution",
  objective: "I can swap a V7 for the dominant a tritone away and hear the bass slide home.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J13"],
  practises: [],
  terms: [{ id: "term.tritone-sub", step: "S4" }],
  canDo: ["cd.write.tritone-sub"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two endings",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "hook", code: TRIO_SUB, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-endings",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the bass from bar 1 to the last chord in both takes. Notice how it travels: by jumps, or by small steps.",
        skills: [{ skill: "J13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: TRIO_V,
            caption: "A ii–V–I in C, as you have played it.",
            bars: 4,
          },
          {
            code: TRIO_SUB,
            caption: "The same ending with a new chord in bar 2. The vibes do not change.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Where the bass goes",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "where-the-bass-goes",
        version: 1,
        role: "practice",
        prompt:
          "Eight bars: the first ending, then the second, with D♭7 in bar 6. Predict where the bass goes from D in bar 5, and pick your answer.",
        skills: [{ skill: "J13", w: 1 }],
        hints: null,
        tests: [],
        code: BOTH,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "half-step", label: "Down a half step, to D♭, and down a half step again to C" },
          { id: "fifth", label: "To G, as in bar 2, then down a 5th to C" },
          { id: "up", label: "Up to E♭, then back down to C" },
        ],
        correct: ["half-step"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two notes in common",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "shared", code: SHARED, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "two-notes-in-common",
        version: 1,
        role: "practice",
        prompt:
          'G7, then D♭7, each played as its 3rd and 7th with `.dict("guidetones")`, over its root. Run it, read the roll and answer two questions: how many notes the two chords share, and how far D♭ is from G.',
        skills: [{ skill: "J13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare the two upper notes of bar 1 with the two of bar 2 on the roll, then count the half steps between the two bass notes.",
        },
        hints: ladder(
          "Read the two upper notes of bar 1, then of bar 2, and check whether they move at all.",
          "The roll's upper lane holds two notes per bar. Read their names in bar 1, then in bar 2.",
          "In G7 the 3rd is B and the 7th is F. Find the 3rd and the 7th of D♭7 the same way: up four half steps from D♭, and down two from D♭.",
        ),
        code: { starter: SHARED },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many notes do the two chords have in common?", correct: 2 },
          {
            q: "choice",
            prompt: "How far is D♭ from G?",
            options: [
              { id: "tritone", label: "Six half steps: a tritone, half an octave" },
              { id: "fifth", label: "Seven half steps: a 5th" },
              { id: "fourth", label: "Five half steps: a 4th" },
            ],
            correct: ["tritone"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 2, choice: ["tritone"] } }, expect: "pass" },
          {
            name: "none in common",
            response: { answer: { number: 0, choice: ["tritone"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a 5th: the root motion of V to I",
            response: { answer: { number: 2, choice: ["fifth"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The slide into F",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "slide-into-f",
        version: 1,
        role: "check",
        key: F,
        prompt:
          "A ii–V–I in F: Gm7, C7, Fmaj7. Replace C7 in `changes` with the dominant seventh a tritone (six half steps) away, so the bass slides into F by half steps. Keep Gm7 and Fmaj7.",
        skills: [{ skill: "J13", w: 1 }],
        swing: SWUNG,
        code: { starter: SUB_STARTER },
        reference: { solutions: [SUB_SOLUTION], bars: 4 },
        // The chords that sound and their lowest note, onset by onset: the substitute must be a dominant seventh
        // on the right root, and the bass must play that root (one string drives both lines).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Listen to the bass from bar 1 to bar 3: in the target it slides down by half steps, and the chord in bar 2 still leans hard into F.",
        },
        hints: ladder(
          "Count six half steps from C to find the root of the new chord.",
          "Count six half steps up from C. A dominant seventh on that note shares C7's 3rd and 7th, E and B♭.",
          "In C the substitute for G7 was D♭7, a half step above home. Find the same chord above F.",
        ),
        tests: [
          { name: "reference", response: { code: SUB_SOLUTION }, expect: "pass" },
          {
            name: "spelled with sharps: F#7",
            response: { code: modify("<Gm7 F#7 F^7 F^7>") },
            expect: "pass",
          },
          {
            name: "the last chord written once with !",
            response: { code: modify("<Gm7 Gb7 F^7!2>") },
            expect: "pass",
          },
          {
            name: "the bass written by hand",
            response: {
              code: modify(
                "<Gm7 Gb7 F^7 F^7>",
                'bass: note("<g2 gb2 f2 f2>").struct("x ~ x ~").s("upright")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(SUB_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right root as a major seventh: Gbmaj7 does not lean",
            response: { code: modify("<Gm7 Gb^7 F^7 F^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "C's substitute carried over: Db7",
            response: { code: modify("<Gm7 Db7 F^7 F^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the substitute put on the ii",
            response: { code: modify("<Db7 C7 F^7 F^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "The substitute in E♭",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "fact",
        id: "substitute-in-e-flat",
        version: 1,
        role: "check",
        key: Eb,
        prompt: "The ii–V–I in E♭: Fm7, B♭7, E♭maj7. Type the chord that can replace B♭7.",
        skills: [{ skill: "J13", w: 1 }],
        hints: ladder(
          "The substitute's root is a tritone from B♭: count six half steps.",
          "Six half steps from B♭, and the same kind of chord as B♭7.",
          "Its root is a half step above E♭, where the bass lands.",
        ),
        stimulus: { src: "code", code: IN_EB, bars: 4, showCode: false },
        answer: { ui: "text", normalize: "chord" },
        correct: { text: ["E7"] },
        spelling: "enharmonic",
        order: "sequence",
        tests: [
          { name: "E7", response: { answer: { text: ["E7"] } }, expect: "pass" },
          { name: "spelled Fb7", response: { answer: { text: ["Fb7"] } }, expect: "pass" },
          { name: "lower case", response: { answer: { text: ["e7"] } }, expect: "pass" },
          {
            name: "the right root as a major seventh",
            response: { answer: { text: ["E^7"] } },
            expect: "fail",
            feedback: ["id.chord-quality"],
          },
          {
            name: "a half step below home instead of above",
            response: { answer: { text: ["D7"] } },
            expect: "fail",
            feedback: ["id.chord-root"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Which way home",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "which-way-home",
        version: 1,
        role: "check",
        prompt:
          "Short endings in different keys, one at a time. Each comes home through a V7 or through its tritone substitute. For each, pick which.",
        skills: [{ skill: "J13", w: 1 }],
        hints: [
          { text: "Hum the lowest note of the last two chords: the bass either jumps or slides into home." },
          {
            text: "Before home, the V7's bass falls a 5th (or climbs a 4th); the substitute's bass steps down a half step.",
          },
          {
            text: "Hear it again, slower, and hum only the last two bass notes: one half step apart is the substitute.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        // Level 1: a ii–V7–I or a ii–♭II7–I in a key with up to four accidentals.
        stimulus: { src: "generator", family: "fam.jzz.subs", level: 1 },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "V7-I", label: "Through the V7: the bass falls a 5th" },
            { id: "bII7-I", label: "Through the substitute: the bass slides a half step" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.jzz.subs", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your turnaround",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-turnaround",
        version: 1,
        role: "practice",
        key: Bb,
        title: "Turnaround with a slide",
        prompt:
          "The turnaround is B♭maj7, G7, Cm7, F7: the opening of your song, under Oak's top line. Required: replace at least one of its dominants with its tritone substitute. Also on the checklist: the bass plays each new chord's root, so it slides, and a third line of your own, such as a vibes line.",
        skills: [{ skill: "J13", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          TRITONE_SUB,
          // A suggestion (a Make has one required rule): with the bass left on the old root the substitute still
          // sounds, as an altered colour over V, but the slide the brief asks for is not heard.
          BASS_FOLLOWS,
          {
            id: "a-tune",
            label: "At least three lines play, such as a vibes line over chords and bass",
            required: false,
            skills: ["J13"],
            rule: "tracks",
            min: 3,
          },
        ],
        // The override serves both rules, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Find the two dominant sevenths in the loop: either can take a substitute.",
          "Each of them can be replaced by the dominant seventh six half steps away; the new root sits a half step above the chord that follows.",
          "Start with the last one: the chord before B♭maj7 can become a dominant whose root is a half step above B♭.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: F7 replaced",
            response: { code: turnaround("<Bb^7 G7 Cm7 B7>", bassBb(undefined, SLIDE_4)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: both dominants, a vibes line, slower",
            response: {
              code: turnaround("<Bb^7 Db7 Cm7 B7>", bassBb(SLIDE_2, SLIDE_4), [MAKE_VIBES]).replace(
                `setcpm(${BPM}/4)`,
                "setcpm(96/4)",
              ),
            },
            expect: "pass",
          },
          {
            name: "only G7 replaced: Db7 slides into Cm7",
            response: { code: turnaround("<Bb^7 Db7 Cm7 F7>", bassBb(SLIDE_2)) },
            expect: "pass",
          },
          {
            name: "spelled Cb7",
            response: { code: turnaround("<Bb^7 G7 Cm7 Cb7>", bassBb(undefined, SLIDE_4)) },
            expect: "pass",
          },
          {
            name: "the right roots as major sevenths: no dominant, no slide into the next chord",
            response: { code: turnaround("<Bb^7 Db^7 Cm7 B^7>", bassBb(SLIDE_2, SLIDE_4)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the substitute in the wrong place: Gb7 before Bbmaj7",
            response: { code: turnaround("<Bb^7 G7 Cm7 Gb7>", bassBb(undefined, "[gb1 db2]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the substitute in the chords, the bass left on F: passes, and the slide is suggested",
            response: { code: turnaround("<Bb^7 G7 Cm7 B7>") },
            expect: "pass",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the substitute written, the chords line silent: .gain(0)",
            response: {
              code: turnaround("<Bb^7 G7 Cm7 B7>", bassBb(undefined, SLIDE_4)).replace(
                '.s("rhodes").gain(.6)',
                '.s("rhodes").gain(0)',
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
