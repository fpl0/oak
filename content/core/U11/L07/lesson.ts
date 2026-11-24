// U11.L07 Shuffle. Swing plays eighth notes long–short instead of even: each off-beat eighth lands two thirds
// of the way through its beat. A shuffle is a groove built on swung eighths, the beat of the blues. Rhythms
// stay written straight; one call, `.swingBy(1/3, 4)`, on each line that swings does the rest (contracts
// §6.10, STYLE §7), and the staff prints "Swing 8ths" over plain eighths. What the learner has: the twelve
// bars as one `const` (U11.L05) with the quick change and the turnaround (U11.L06), the blues scale and
// `crunch` (U11.L03), eighth-note hats since U01, and the swung hats of U01.L09's listen step, heard but not
// written. Not yet: the triplet behind the swing (U13.L05: here it is "long–short", "two thirds of the way
// through the beat"), sixteenth swing (funk and neo-soul tracks). Spec: content/specs/U11.md.
//
// How it is graded (contracts §6.10 item 4): an exercise that declares `swing` is compared on the
// straightened grid, so a straight answer still matches its onsets and only carries `rhythm.swing-missing`;
// what makes S4 and S5 fail a straight answer is the `must-use` constraint (`.swingBy()` or its short form
// `.swing(4)`, both unlocked here) together with a measured `swing` rule per graded line (an `all` matcher).
// `.swingBy(1/3, 8)` swings sixteenths, which leaves eighth notes where they were: the ratio rule names it. The
// rhythm is compared with a sixteenth's give, so `.swingBy(.33, 4)` (the decimal STYLE §7 allows) lines up too.
// The Make's one required rule is `swing` on the hats: ratio 2 for `.swingBy(1/3, 4)`, 1.5 ("light") for
// `.swingBy(.2, 4)`. The brief invites the lighter swing and lets the learner keep it, so the Make's window is
// 1.45–2.4:1 (corrections pass, theory-b 6); straight hats, or a hint of swing such as `.swingBy(.1, 4)`
// (1.2:1), still fail. The modify steps S4 and S5 ask for `.swingBy(1/3, 4)` and keep 1.6–2.4:1.
//
// Band: none (`band: false`). Every step's code carries its own `hats:` and `drums:` lines, because the hats
// are what the learner swings; the drum track of `band.axis-4bar` plays straight hats (pop and indie `hh*8`,
// funk `hh*16`) that would flam against swung ones on every off-beat. A 12-bar Band whose drums leave the
// hats to the learner is requested of author:CP (`band.blues-12bar`).
import { defineLesson, FEEL_OPTIONS, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The call that swings a line's eighths in 4/4. */
const SWING = ".swingBy(1/3, 4)";
/** The standard twelve bars (U11.L05), one chord a bar. */
const FORM = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>";
/** U11.L06's blues: the quick change in bar 2, the turnaround in bars 11–12. */
const QUICK_FORM = "<C7 F7 C7!2 F7!2 C7!2 G7 F7 [C7 F7] [C7 G7]>";
const changes = (form: string) => `const changes = "${form}"\n`;
const hats = (swing = "") => `hats: s("hh*8")${swing}.gain(.5)`;
const DRUMS = 'drums: s("bd ~ sd ~")';
const BASS = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)';
const CHORDS = 'chords: chord(changes).voicing().s("piano")';
/** The hook's riff, in eighths so the swing is heard: C · E♭ F · G F · | G♭ F C ·. */
const RIFF = "<[0 ~ 1 2 ~ 4 2 ~] [3 2 0 ~]>";
const gtr = (swing = "", riff = RIFF) => `gtr: n("${riff}").scale("C3:blues")${swing}.s("crunch")`;
/** A blues: the changes, then hats, drums, bass, chords and riff (STYLE §1 order). */
const blues = (form: string, hatsLine: string, gtrLine: string, ...extra: string[]) =>
  code(changes(form), hatsLine, DRUMS, BASS, CHORDS, gtrLine, ...extra);

const STRAIGHT = blues(FORM, hats(), gtr());
const HOOK = blues(FORM, hats(SWING), gtr(SWING));

/** S2–S3: the hats and the kick and snare alone. */
const GROOVE = code(hats(SWING), DRUMS);

/**
 * S5, Play from the page: a two-bar riff in plain eighths, C E♭ F G♭ G · F · | B♭ G F E♭ C · · ·, on the
 * treble staff, marked "Swing 8ths" in the prompt. The learner writes it in code, straight, and swings it.
 */
const PAGE_RIFF = "<[0 1 2 3 4 ~ 2 ~] [5 4 2 1 0 ~ ~ ~]>";
const pageLine = (pattern: string, swing = "", scale = "C4:blues") =>
  `gtr: n("${pattern}").scale("${scale}")${swing}.s("crunch")`;
const page = (gtrLine: string) => code(DRUMS, gtrLine);
const PAGE_STARTER = code(DRUMS, `gtr: ⟪n("<~ ~>").scale("C4:blues").s("crunch")⟫`);
const PAGE_SOLUTION = page(pageLine(PAGE_RIFF, SWING));
/**
 * What the staff shows: the riff alone, as written, in plain eighths. The target the learner hears is the
 * swung reference. (The staff is engraved from the straight line: neither content check 9 nor the Workbench
 * staff passes an exercise's `swing` to the notation yet, so a swung example would engrave approximately.)
 */
const PAGE_SHOWN = code(pageLine(PAGE_RIFF));

/** The Make: U11.L06's blues with a riff of its own, all straight. */
const MAKE_RIFF = "<[0 1 2 4 ~ 4 2 1] [0 ~ ~ 5 4 ~ ~ ~]>";
const MAKE_STARTER = blues(QUICK_FORM, hats(), gtr("", MAKE_RIFF));

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** The swing each graded line must measure (the Make's ratio window): long–short, not a hint of it. */
const swings = (id: string, label: string, track: string): RubricRule => ({
  id,
  label,
  required: true,
  skills: ["R13"],
  rule: "swing",
  track,
  subdivision: 8,
  ratio: [1.6, 2.4],
});
const RIFF_SWINGS = swings("riff-swings", "The gtr line plays its eighths long–short", "gtr");
const SWING_RULES = [swings("hats-swing", "The hats line plays its eighths long–short", "hats"), RIFF_SWINGS];
const SWING_UNMET =
  "{label}: not yet. Its eighths still sound even. In 4/4 the call's second number is 4, one slice a beat; with 8 the slices are half a beat long and eighth notes stay even.";
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** "Play from the page": the treble staff alone, no code view of the target, no roll, no keys. */
const STAFF = { roll: false, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U11.L07",
  version: 5,
  title: "Shuffle",
  objective: "I can swing my own lines in code and hear whether a groove is straight or swung.",
  key: { tonic: "C", mode: "blues" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R13"],
  practises: [],
  terms: [
    { id: "term.swing", step: "S3" },
    { id: "term.shuffle", step: "S3" },
  ],
  canDo: ["cd.hear.swing"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Even, then long–short",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      example: { id: "hook", code: HOOK, bars: 12 },
      exercise: {
        kind: "listen",
        id: "even-then-long-short",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the start of a blues in C twice, with the same notes both times. Nod along with the hats and the riff. Listen for what changes in the way they move from version 1 to version 2.",
        skills: [{ skill: "R13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: STRAIGHT, caption: "Version 1. Nod along with the hats.", bars: 4 },
          { code: HOOK, caption: "Version 2: the same notes. Nod along again.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which hats move?",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "which-hats-move",
        version: 1,
        role: "practice",
        prompt:
          '`s("hh*8")` plays eight even hats a bar, one on each beat and one between. The only change is `.swingBy(1/3, 4)`. Predict which hats move. Pick one answer, then listen to check it.',
        skills: [{ skill: "R13", w: 1 }],
        hints: null,
        tests: [],
        code: GROOVE,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "between-later", label: "The ones between the beats: each lands later" },
          { id: "all-slower", label: "All eight: the whole line slows down" },
          { id: "on-beat-earlier", label: "The ones on the beat: each lands earlier" },
        ],
        correct: ["between-later"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two thirds of the beat",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-groove", code: GROOVE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "two-thirds-of-the-beat",
        version: 1,
        role: "practice",
        prompt:
          "Run it and look at the hats on the roll against the beat lines. Delete `.swingBy(1/3, 4)`, run it again and compare. Then answer two questions: where the second hat of each beat lands with the call, and what the second number would be for a three-beat waltz.",
        skills: [{ skill: "R13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop the loop and look at one beat on the roll: one hat on the line, one inside the beat. How far in?",
        },
        hints: ladder(
          "Look at one beat only, from one beat line to the next. With the call deleted, where does its second hat sit?",
          "The call keeps the first hat of each beat where it was and delays the second. The 4 says how many slices of the bar it treats that way.",
          "Each slice is one beat: a bar of 4/4 has four of them. A waltz bar has fewer.",
        ),
        code: { starter: GROOVE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "With the call, where does the second hat of each beat land?",
            options: [
              { id: "two-thirds", label: "Two thirds of the way through the beat" },
              { id: "half", label: "Halfway through the beat, as before" },
              { id: "quarter", label: "A quarter of the way through the beat" },
            ],
            correct: ["two-thirds"],
          },
          {
            q: "number",
            prompt:
              "A waltz has three beats in a bar. To make its eighths long–short the same way, what would the second number be?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["two-thirds"], number: 3 } }, expect: "pass" },
          {
            name: "halfway: read the straight hats",
            response: { answer: { choice: ["half"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the 4 copied from 4/4",
            response: { answer: { choice: ["two-thirds"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Shuffle the blues",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: false },
      exercise: {
        kind: "code-modify",
        id: "shuffle-the-blues",
        version: 1,
        role: "check",
        prompt:
          "The twelve bars play straight. Add `.swingBy(1/3, 4)` to the `hats:` line and to the `gtr:` line, after each pattern. Done when both lines play their eighths long–short and every note keeps its place.",
        skills: [{ skill: "R13", w: 1 }],
        swing: SWUNG,
        code: { starter: STRAIGHT },
        reference: { solutions: [HOOK], bars: 12 },
        // The rhythm on the straight grid, and the measured swing of each line: `.swing(4)` (the short form,
        // unlocked here too) passes, and `.swingBy(1/3, 8)`, which leaves the eighths even, fails on the ratio.
        matcher: {
          m: "all",
          of: [
            {
              m: "rhythm",
              tol: [1, 16],
              durations: false,
              perRole: false,
              displacementCredit: 0.5,
              tracks: ["hats", "gtr"],
            },
            { m: "rubric", rules: SWING_RULES },
          ],
        },
        constraints: [{ c: "must-use", tool: ["tb.swingBy", "tb.swing"], min: 2, feedback: "code.must-use" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "code.must-use":
            "Swing works one line at a time: the hats and the riff each need their own `.swingBy(1/3, 4)`, after the pattern and before the sound.",
          "rubric.unmet": SWING_UNMET,
        },
        hints: ladder(
          "Two lines play eighth notes, and each needs its own call. Which two?",
          "The call goes in the chain after the pattern and before `.s()`, on the `hats:` line and on the `gtr:` line.",
          'The hats become `s("hh*8").swingBy(1/3, 4).gain(.5)`. Do the same for the riff, after its `.scale()`.',
        ),
        tests: [
          { name: "reference", response: { code: HOOK }, expect: "pass" },
          {
            name: "the riff swung before its scale",
            response: {
              code: blues(
                FORM,
                hats(SWING),
                `gtr: n("${RIFF}").swingBy(1/3, 4).scale("C3:blues").s("crunch")`,
              ),
            },
            expect: "pass",
          },
          { name: "unchanged", response: { code: STRAIGHT }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "only the hats swung",
            response: { code: blues(FORM, hats(SWING), gtr()) },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            name: "the short form: .swing(4) on both lines",
            response: { code: blues(FORM, hats(".swing(4)"), gtr(".swing(4)")) },
            expect: "pass",
          },
          {
            name: "the amount as a decimal: .33",
            response: { code: blues(FORM, hats(".swingBy(.33, 4)"), gtr(".swingBy(.33, 4)")) },
            expect: "pass",
          },
          {
            name: "sixteenths swung: 8 for 4",
            response: { code: blues(FORM, hats(".swingBy(1/3, 8)"), gtr(".swingBy(1/3, 8)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the fraction in a string: no swing",
            response: { code: blues(FORM, hats('.swingBy("1/3", 4)'), gtr('.swingBy("1/3", 4)')) },
            expect: "fail",
            feedback: ["code.swing-fraction-string"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      // U11's "Play from the page" (AUTHORING §4): the riff is on the treble staff only, in plain eighths; the
      // exercise declares `swing`, so the answer is compared on the straight grid. No degree labels: U11
      // turns them off on the staff (§6).
      ui: { panels: STAFF, staffLabels: "none", band: false },
      example: { id: "the-page", code: PAGE_SHOWN, bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "swing-from-the-page",
        version: 1,
        role: "check",
        prompt:
          'The staff shows a two-bar riff on the C blues scale, in plain eighths, marked "Swing 8ths". Write it on the `gtr:` line in `n()`, eight slots a bar, `~` for a rest. Then add `.swingBy(1/3, 4)` so it plays long–short.',
        skills: [
          { skill: "R13", w: 0.7 },
          { skill: "N04", w: 0.3 },
        ],
        swing: SWUNG,
        code: { starter: PAGE_STARTER },
        reference: { solutions: [PAGE_SOLUTION], bars: 2 },
        // The notes on the straight grid, and the riff's measured swing: `.swingBy(1/3, 8)` leaves the eighths even.
        matcher: {
          m: "all",
          of: [
            // The notes by `melody` with a sixteenth's give, so an amount written `.33` (STYLE §7.4) still lines up.
            { m: "melody", pitch: "absolute", wPitch: 0.8, wRhythm: 0.2, rhythmTol: [1, 16], track: "gtr" },
            { m: "rubric", rules: [RIFF_SWINGS] },
          ],
        },
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          { c: "must-use", tool: ["tb.swingBy", "tb.swing"], feedback: "code.must-use" },
        ],
        target: { audible: true },
        feedbackText: {
          "code.must-use":
            'The notes are right. "Swing 8ths" asks for one more thing: the call that makes them long–short.',
          "rubric.unmet": SWING_UNMET,
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: a different note from the one on the page. In `C4:blues`, `n` counts the scale's six notes: C E♭ F G♭ G B♭.",
        },
        hints: ladder(
          "Read bar 1 on the staff slot by slot. How many eighth notes and rests does it hold?",
          "Each bar is eight slots: write `[ ]` with eight entries, `~` for a rest. The first note is C, the bottom of `C4:blues`, `n` 0.",
          "Bar 1 climbs the scale note by note from C to G, rests, plays F and rests: `[0 1 2 3 4 ~ ? ~]`.",
        ),
        tests: [
          { name: "reference", response: { code: PAGE_SOLUTION }, expect: "pass" },
          {
            name: "in note names",
            response: {
              code: page(
                'gtr: note("<[c4 eb4 f4 gb4 g4 ~ f4 ~] [bb4 g4 f4 eb4 c4 ~ ~ ~]>").swingBy(1/3, 4).s("crunch")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: page('gtr: n("<~ ~>").scale("C4:blues").s("crunch")') },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "straight: the notes without the call",
            response: { code: page(pageLine(PAGE_RIFF)) },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            name: "the short form: .swing(4)",
            response: { code: page(pageLine(PAGE_RIFF, ".swing(4)")) },
            expect: "pass",
          },
          {
            name: "the amount as a decimal: .33",
            response: { code: page(pageLine(PAGE_RIFF, ".swingBy(.33, 4)")) },
            expect: "pass",
          },
          {
            name: "sixteenths swung: the riff stays even",
            response: { code: page(pageLine(PAGE_RIFF, ".swingBy(1/3, 8)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "degree − 1 on the blues scale: G written as n 6",
            response: { code: page(pageLine("<[0 1 2 3 6 ~ 2 ~] [5 4 2 1 0 ~ ~ ~]>", SWING)) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Straight or swung?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "straight-or-swung",
        version: 1,
        role: "check",
        prompt:
          "Listen to a groove, twice through. Pick straight if its eighths are even, swung if they are long–short. Listen to the hats.",
        skills: [{ skill: "R13", w: 1 }],
        hints: [
          { text: "Listen to the hats only: do the two hats inside a beat sound equal?" },
          { text: "Swung hats limp a little: long, short, long, short. Even hats tick like a clock." },
          {
            text: 'Hear it again, slower, and say "long–short" along with the hats.',
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.rhy.swing", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "choice", options: [...FEEL_OPTIONS] },
        correct: {},
        srs: [
          { family: "fam.rhy.swing", mode: "seed" },
          { family: "fam.rhy.echo", mode: "review-if-due" },
        ],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your blues, shuffled",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-blues-shuffled",
        version: 1,
        role: "practice",
        prompt:
          "Swing the hats of your song's third chorus with `.swingBy(1/3, 4)`, then the riff the same way. Try a lighter swing too, `.swingBy(.2, 4)`, and a tempo between 80 and 140 in `setcpm`: your whole song takes that tempo. Keep the feel and tempo you like best. Done when the hats play long–short.",
        skills: [{ skill: "R13", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [12, 24],
        saveAs: "sketch",
        // Decision of 2026-11-13 (d15): this Make opens with the learner's own sketch from U11.L06 when one is
        // saved, with "Start from Oak's copy" to put the starter back; without one it opens with the starter.
        fromSketch: "U11.L06",
        rubric: [
          {
            id: "hats-swing",
            label: "The hats play long–short, between about `.swingBy(.2, 4)` and `.swingBy(.4, 4)`",
            required: true,
            skills: ["R13"],
            rule: "swing",
            track: ["hats", "@drums"],
            drums: ["hatClosed", "hatOpen", "ride"],
            subdivision: 8,
            ratio: [1.45, 2.4],
          },
          {
            id: "riff-swings",
            label: "The gtr line swings too, between about `.swingBy(.2, 4)` and `.swingBy(.4, 4)`",
            required: false,
            skills: ["R13"],
            rule: "swing",
            track: "gtr",
            subdivision: 8,
            ratio: [1.4, 2.4],
          },
          {
            id: "shuffle-tempo",
            label: "The tempo is between 80 and 140 beats a minute",
            required: false,
            skills: ["R13"],
            rule: "tempo-bpm",
            min: 80,
            max: 140,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Only the hats must swing. Which line is that, and where in its chain does the call go?",
          "Swing goes on the hats first: their eighths carry the feel. Then the riff, with the same call.",
          'The hats become `s("hh*8").swingBy(1/3, 4).gain(.5)`. A lighter swing is a smaller first number.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: only the hats swung",
            response: { code: blues(QUICK_FORM, hats(SWING), gtr("", MAKE_RIFF)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: slower, both swung, a new riff and two choruses",
            response: {
              code: blues(
                `${QUICK_FORM.slice(0, -1)} C7!4 F7!2 C7!2 G7 F7 C7 G7>`,
                hats(SWING),
                gtr(SWING, "<[4 ~ 4 5 ~ 4 2 1] [0 ~ 1 0 ~ ~ ~ ~]>"),
              ).replace(`setcpm(${BPM}/4)`, "setcpm(96/4)"),
            },
            expect: "pass",
          },
          {
            name: "only the riff swung, the hats straight",
            response: { code: blues(QUICK_FORM, hats(), gtr(SWING, MAKE_RIFF)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the lighter swing the brief invites, kept: .2 on both lines",
            response: { code: blues(QUICK_FORM, hats(".swingBy(.2, 4)"), gtr(".swingBy(.2, 4)", MAKE_RIFF)) },
            expect: "pass",
          },
          {
            name: "the hats in the short form, .swing(4)",
            response: { code: blues(QUICK_FORM, hats(".swing(4)"), gtr("", MAKE_RIFF)) },
            expect: "pass",
          },
          {
            name: "a hint of swing on the hats, .1: still nearly even",
            response: { code: blues(QUICK_FORM, hats(".swingBy(.1, 4)"), gtr(".swingBy(.1, 4)", MAKE_RIFF)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
