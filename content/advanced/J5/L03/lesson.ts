// J5.L03 Secondary ii–Vs & Diminished Passing Chords (spec: content/specs/J5.md). Any chord of a tune can have its
// own ii–V. Em7 A7 before Dm7 makes Dm7 sound like a little home of its own for a moment: the secondary ii–V,
// the same gesture as the ii–V–I aimed somewhere else. The second device of the title, the diminished seventh
// slipped between two chords a whole step apart, is heard once in a comparison step (S5) and offered as an
// optional stretch (S6); it is named and applied in J5.L04 (contracts 1.8, AUTHORING §20.6: no split).
//
// Written for the learner at the gate (AUTHORING §20.1): J5 opens after U17.CP and J4.L04, so the whole core
// (V7/ii and tonicization, U15), J1–J4 and J5.L01–L02 are behind the learner. The lesson unlocks no tool. Keys
// rotate as the jazz track does: heard in C (S1–S3, S5–S6), written in B♭ (S4), made in G (S7). Medium swing at
// 132 BPM; the Rhodes comps on 1, the and of 2 and 4, so a bar that holds two chords sounds both of them.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - what is HEARD: S4 compares the chords that sound and their lowest note (`pcset` per onset with the bass);
//   the Make's `device-count` reads the chords that sound (a muted chords line has none) and counts a secondary
//   ii–V only where a minor seventh is followed by the dominant a 4th above it AND that dominant's target arrives,
//   and never the ii–V into home;
// - each graded step pins a wrong answer that uses the right device wrongly (two dominants in a row, a ii–V aimed
//   at the wrong chord, a ii–V that never arrives, a tritone substitute where the ii–V was asked) and three other
//   right answers (the minor ii–V for a minor target, the bass written by hand, the lines without the const; in
//   the Make, a ii–V aimed at another chord of the tune).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

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

const SWING = ".swingBy(1/3, 4)";
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const C = { tonic: "C", mode: "major" } as const;
const Bb = { tonic: "Bb", mode: "major" } as const;
const G = { tonic: "G", mode: "major" } as const;

/** The trio of J1: the ride pattern and the hi-hat on 2 and 4 on the jazz kit. */
const RIDE = `drums: s("rd [rd rd] rd [rd rd]")${SWING}.bank("jazzkit")`;
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/**
 * Rhodes comping on 1, the and of 2 and 4, in the left hand's voicings: a bar split in two (`[Em7 A7]`) sounds
 * its first chord on 1 and the and of 2 and its second on 4, and a chord on beat 4 (`[C^7@3 C#o7]`) sounds too.
 */
const comp = (changes: string) =>
  `chords: chord(${changes}).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ x ~")${SWING}.s("rhodes").gain(.6)`;
/** A bass in two from the same string: the root on 1 and 3. */
const ROOTS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")';
/** A bass in four from the same string, so a chord on beat 4 gets its root: S5 and S6. */
const FOUR = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("upright")';
const loop = (changes: string, bassLine: string, ...extra: string[]) =>
  code(`const changes = "${changes}"`, "", RIDE, HATS, comp("changes"), bassLine, ...extra);

/**
 * The hook, in C: C, Am, Dm, G, then the same with Em7 A7 in bar 2 aimed at Dm7. The vibes line is G E | E |
 * A F | B: chord tones of both versions (E is the 5th of Am7, the root of Em7 and the 5th of A7; evaluated).
 */
const PLAIN = "<C^7 Am7 Dm7 G7>";
const AIMED = "<C^7 [Em7 A7] Dm7 G7>";
const VIBES = `mel: note("<[g4 ~ e4 ~] [e4 ~ ~ ~] [a4 ~ f4 ~] [b4 ~ ~ ~]>")${SWING}.s("vibes")`;
const HOOK_PLAIN = loop(PLAIN, ROOTS, VIBES);
const HOOK = loop(AIMED, ROOTS, VIBES);

/** S4: a turnaround in B♭ from one string; the learner aims a ii–V at Cm7 in bar 2. */
const inBb = (changes: string, bassLine = ROOTS) => loop(changes, bassLine);
const AIM_STARTER = inBb("<Bb^7 ⟪Gm7⟫ Cm7 F7>");
const AIM_SOLUTION = inBb("<Bb^7 [Dm7 G7] Cm7 F7>");
/** Cm7 is a minor chord, so the minor ii–V aims at it too: the second reference. */
const AIM_MINOR = inBb("<Bb^7 [Dm7b5 G7] Cm7 F7>");

/** S5 and S6: C to Dm7, plain and with the diminished seventh on beat 4 of bar 1; the bass in four climbs. */
const STEP_UP = loop("<C^7 Dm7 G7 C^7>", FOUR);
const CLIMB = loop("<[C^7@3 C#o7] Dm7 G7 C^7>", FOUR);
const SLIP_STARTER = loop("<⟪C^7⟫ Dm7 G7 C^7>", FOUR);

/**
 * S7: a tune in G over the Band's drums, a hand-written bass (root and 5th) and the vibes on long notes. The bass
 * is written by hand so the rule hears the chords from the chords line only (grader gap 1 of the spec). The
 * vibes play D | B | E | F♯ on beats 1 and 4 (the quarter grid): the 5th of Gmaj7, of Em7 and of Am7 and the 3rd
 * of D7, and they fit every ii–V aimed inside the loop (evaluated): D over F♯m7♭5 and B7 (♭13, ♯9), B over Bm7
 * and E7 (root, 5th), E over Em7 and A7 (root, 5th).
 */
const MAKE_MEL = `mel: note("<[d5 ~ ~ d5] [b4 ~ ~ b4] [e5 ~ ~ e5] [f#5 ~ ~ ~]>").s("vibes")`;
const MAKE_BASS = "[g1 d2] [e2 b1] [a1 e2] [d2 a1]";
const bass = (bars: string) => `bass: note("<${bars}>").s("upright")`;
const tuneG = (changes: string, bassBars = MAKE_BASS, mel: string | null = MAKE_MEL) =>
  code(`const changes = "${changes}"`, "", comp("changes"), bass(bassBars), ...(mel ? [mel] : []));
const MAKE_STARTER = tuneG("<G^7 Em7 Am7 D7>");

/** The Make's one idea: a ii–V aimed at a chord of the tune that is not home, heard on the chords line. */
const SECONDARY: RubricRule = {
  id: "secondary-ii-v",
  label:
    "A ii–V aims at a chord other than home: a minor seventh, then the dominant seventh a 5th above that chord",
  required: true,
  skills: ["J14"],
  rule: "device-count",
  devices: ["secondary ii–V"],
  min: 1,
};

/**
 * The bass moves to the new roots (review): the hint asks for it and the bass is written by hand, so a ii–V over
 * the old roots is told so. A suggestion: a Make has one required rule.
 */
const BASS_FOLLOWS: RubricRule = {
  id: "bass-follows",
  label: "At every chord change the bass plays the new chord's root",
  required: false,
  skills: ["J14"],
  rule: "bass-line",
  track: "bass",
  harmony: "chords",
  roots: { on: "change", minRatio: 1 },
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J5.L03",
  version: 4,
  title: "Secondary ii–Vs & Diminished Passing Chords",
  objective: "I can aim a ii–V at any chord of a tune, so it sounds like a little home of its own.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J14"],
  practises: [],
  terms: [{ id: "term.secondary-ii-v", step: "S4" }],
  canDo: ["cd.write.secondary-ii-v"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A bar that leans",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-bar-that-leans",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the move from bar 2 into bar 3 in both takes. Notice in which take bar 3 feels like an arrival, not just the next chord.",
        skills: [{ skill: "J14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK_PLAIN,
            caption: "The loop as written, one chord a bar.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The same loop with two chords in bar 2.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which pair leans",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "which-pair-leans",
        version: 1,
        role: "practice",
        prompt:
          "Bar 2 will hold two chords instead of Am7. Predict which pair makes Dm7 in bar 3 sound like a home of its own, and pick it.",
        skills: [{ skill: "J14", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "em-a", label: "Em7 A7" },
          { id: "am-d", label: "Am7 D7" },
          { id: "fm-bb", label: "Fm7 B♭7" },
        ],
        correct: ["em-a"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "A ii–V in D minor",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "aimed", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "a-ii-v-in-d-minor",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read the bass on the roll from bar 2 into bar 3: E, A, then D. Answer two questions: how each root moves to the next, and in which bar the chord A7 points at sounds.",
        skills: [{ skill: "J14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Name the note a 5th below E and the note a 5th below A, and compare them with the roots that follow. A dominant seventh points at the chord a 5th below its root.",
        },
        hints: ladder(
          "Compare with the ii–V–I you know, Dm7 G7 C: each root moves the same distance to the next.",
          "Count down the letter names from E to A: E, D, C, B, A. How many letters is that, counting both ends? Then from A to D.",
          "A7 is V7 of D. Find the bar where the D chord sounds.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "E, A, D: how does each root move to the next?",
            options: [
              { id: "fifths", label: "Down a 5th each time, like D, G, C into home" },
              { id: "steps", label: "Down a whole step each time" },
              { id: "half", label: "Down a half step each time, like a tritone substitute" },
            ],
            correct: ["fifths"],
          },
          {
            q: "number",
            prompt: "A7 is V7/ii here. In which bar does the chord it points at sound?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["fifths"] } }, expect: "pass" },
          {
            name: "steps instead of 5ths",
            response: { answer: { number: 3, choice: ["steps"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "home instead of the D chord",
            response: { answer: { number: 1, choice: ["fifths"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Aim at Cm7",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "aim-at-c-minor",
        version: 1,
        role: "check",
        key: Bb,
        prompt:
          "A turnaround in B♭: B♭maj7, Gm7, Cm7, F7. Replace Gm7 in bar 2 with two chords, half a bar each: a ii and a V that treat Cm7 in bar 3 as their home. Keep the other bars.",
        skills: [{ skill: "J14", w: 1 }],
        swing: SWUNG,
        code: { starter: AIM_STARTER },
        reference: { solutions: [AIM_SOLUTION, AIM_MINOR], bars: 4 },
        // The chords that sound and their lowest note, onset by onset: both new chords must be the right
        // qualities on the right roots (one string drives the comping and the bass).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Listen to bar 2 of the target: its two roots fall by 5ths into the root of bar 3, the way a ii–V falls into home.",
        },
        hints: ladder(
          "Treat Cm7 as home: find its V7 first, a 5th above C.",
          "The V7 of C sits a 5th above C. The ii before it sits a 5th above that V, and it is a minor chord.",
          "The second half of bar 2 is the V7 of C: a dominant seventh on the note a 5th above C. The first half is the minor seventh a 5th above that note.",
        ),
        tests: [
          { name: "reference", response: { code: AIM_SOLUTION }, expect: "pass" },
          { name: "the minor ii–V: Dm7b5 G7", response: { code: AIM_MINOR }, expect: "pass" },
          {
            name: "the bass written by hand",
            response: {
              code: inBb(
                "<Bb^7 [Dm7 G7] Cm7 F7>",
                'bass: note("<[bb1 bb1] [d2 g1] [c2 c2] [f1 f1]>").s("upright")',
              ),
            },
            expect: "pass",
          },
          {
            name: "the chords and the bass written out, no const",
            response: {
              code: code(
                RIDE,
                HATS,
                comp('"<Bb^7 [Dm7 G7] Cm7 F7>"'),
                'bass: chord("<Bb^7 [Dm7 G7] Cm7 F7>").rootNotes(2).struct("x ~ x ~").s("upright")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(AIM_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "two dominants: D7 G7 is a chain of secondary dominants, not a ii–V",
            response: { code: inBb("<Bb^7 [D7 G7] Cm7 F7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "a ii–V aimed at the wrong chord: Am7 D7 points at G",
            response: { code: inBb("<Bb^7 [Am7 D7] Cm7 F7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "a tritone substitute into Cm7 instead of the ii–V",
            response: { code: inBb("<Bb^7 [Dm7 Db7] Cm7 F7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "A bass that climbs",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "a-bass-that-climbs",
        version: 1,
        role: "practice",
        prompt:
          "Two cards: C to Dm7, then G7 and home. In one of them, beat 4 of bar 1 holds a chord between C and Dm7. Pick the card whose bass climbs by half steps into Dm7.",
        skills: [{ skill: "J14", w: 1 }],
        hints: ladder(
          "Hum the bass of each card from bar 1 into bar 2, and count the notes it takes to get from C to D.",
          "C and D are a whole step apart. A bass that climbs by half steps needs a note between them.",
          "Listen to beat 4 of bar 1 only: in one card the bass is still on C there.",
        ),
        stimulus: { src: "code", code: CLIMB, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "step", label: "Card A", audio: STEP_UP },
            { id: "climb", label: "Card B", audio: CLIMB },
          ],
        },
        correct: { choice: ["climb"] },
        feedbackText: {
          "id.wrong":
            "Not this one. In card A the bass plays C four times in bar 1 and steps up a whole step to D. Listen for a different note on beat 4.",
        },
        tests: [
          { name: "the climbing bass", response: { answer: { choice: ["climb"] } }, expect: "pass" },
          {
            name: "the plain step",
            response: { answer: { choice: ["step"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Slip it in",
      minutes: 1.25,
      optional: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "slip-it-in",
        version: 1,
        role: "practice",
        key: C,
        prompt:
          "For the longer session: rewrite bar 1 of `changes` as two chords. Keep Cmaj7 for beats 1 to 3, and put the diminished seventh a half step above C on beat 4, so the bass climbs C, C♯, D. Keep the other bars.",
        skills: [{ skill: "J14", w: 1 }],
        swing: SWUNG,
        code: { starter: SLIP_STARTER },
        reference: { solutions: [CLIMB], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Listen to beat 4 of bar 1 in the target: the bass is a half step above C there, and the chord is darker.",
        },
        hints: ladder(
          "Bar 1 needs two chords of different lengths: three beats, then one.",
          "`@3` makes a step three beats long inside `[ ]`. The new chord is a diminished seventh, written with `o7`.",
          "Bar 1 becomes a bracket: Cmaj7 for three beats, then the diminished seventh on the note between C and D.",
        ),
        tests: [
          { name: "reference", response: { code: CLIMB }, expect: "pass" },
          {
            name: "spelled Dbo7",
            response: { code: loop("<[C^7@3 Dbo7] Dm7 G7 C^7>", FOUR) },
            expect: "pass",
          },
          {
            name: "four steps written out",
            response: { code: loop("<[C^7 C^7 C^7 C#o7] Dm7 G7 C^7>", FOUR) },
            expect: "pass",
          },
          {
            name: "the bass written by hand",
            response: {
              code: loop(
                "<[C^7@3 C#o7] Dm7 G7 C^7>",
                'bass: note("<[c2 c2 c2 c#2] [d2 d2 d2 d2] [g1 g1 g1 g1] [c2 c2 c2 c2]>").s("upright")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(SLIP_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a diminished seventh on C: the bass does not climb",
            response: { code: loop("<[C^7@3 Co7] Dm7 G7 C^7>", FOUR) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the diminished seventh on beat 1 instead of beat 4",
            response: { code: loop("<[C#o7 C^7@3] Dm7 G7 C^7>", FOUR) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your aimed tune",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-aimed-tune",
        version: 1,
        role: "practice",
        key: G,
        title: "Aimed tune in G",
        prompt:
          "The loop is Gmaj7, Em7, Am7, D7: your song's first A section. Required: aim a ii–V at a chord other than home, sharing the bar before it. Also on the checklist: the bass plays each chord's root, and a diminished seventh between chords a whole step apart. Keep the tune; check that its long notes agree with each new chord.",
        skills: [{ skill: "J14", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          SECONDARY,
          BASS_FOLLOWS,
          // The spec's other suggestion, `reharmonize` against the starter, is left out: probed, it reports
          // "done" for a chords line at .gain(0) (it reads the written chords), which would tell the learner
          // something false. Reported to the grader engineer.
          {
            id: "climb",
            label: "A diminished seventh between two chords a whole step apart",
            required: false,
            skills: ["J14"],
            rule: "device-count",
            devices: ["diminished passing"],
            min: 1,
          },
        ],
        // The override serves every rule, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Pick one chord of the loop, not Gmaj7, to arrive at like a small homecoming. The ii–V goes in the bar before it.",
          "Pick a target that is not Gmaj7. Its V7 sits a 5th above it; the ii sits a 5th above that V and is a minor seventh. Both go in the bar before the target, sharing it.",
          "To aim at Am7, its V7 is E7: put it on the second half of bar 2, and the minor seventh a 4th below E on the first half. Move the bass to both roots.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: a ii–V aimed at Am7",
            response: { code: tuneG("<G^7 [Bm7 E7] Am7 D7>", "[g1 d2] [b1 e2] [a1 e2] [d2 a1]") },
            expect: "pass",
          },
          {
            name: "beyond the brief: aimed at Am7 and at D7, a line of its own, faster",
            response: {
              code: tuneG(
                "<G^7 [Bm7 E7] [Em7 A7] D7>",
                "[g1 d2] [b1 e2] [e2 a1] [d2 a1]",
                `mel: note("<[d5 ~ b4 a4] [b4 ~ d5 b4] [e5 ~ g4 e5] [f#5 ~ ~ ~]>")${SWING}.s("vibes")`,
              ).replace(`setcpm(${BPM}/4)`, "setcpm(160/4)"),
            },
            expect: "pass",
          },
          {
            name: "the minor ii–V aimed at Am7",
            response: { code: tuneG("<G^7 [Bm7b5 E7] Am7 D7>", "[g1 d2] [b1 e2] [a1 e2] [d2 a1]") },
            expect: "pass",
          },
          {
            name: "a ii–V aimed at D7 in bar 4, no tune",
            response: { code: tuneG("<G^7 Em7 [Em7 A7] D7>", "[g1 d2] [e2 b1] [e2 a1] [d2 a1]", null) },
            expect: "pass",
          },
          {
            name: "a secondary dominant with no ii: E7 alone before Am7",
            response: { code: tuneG("<G^7 E7 Am7 D7>", "[g1 d2] [e2 b1] [a1 e2] [d2 a1]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "two dominants in a row: B7 E7",
            response: { code: tuneG("<G^7 [B7 E7] Am7 D7>", "[g1 d2] [b1 e2] [a1 e2] [d2 a1]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a ii–V that never arrives: Bm7 E7, then Gmaj7 instead of Am7",
            response: { code: tuneG("<G^7 Em7 Am7 [Bm7 E7]>", "[g1 d2] [e2 b1] [a1 e2] [b1 e2]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the ii–V aimed, the chords line silent: .gain(0)",
            response: {
              code: tuneG("<G^7 [Bm7 E7] Am7 D7>", "[g1 d2] [b1 e2] [a1 e2] [d2 a1]").replace(
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
