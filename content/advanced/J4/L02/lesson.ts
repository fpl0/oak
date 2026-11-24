// J4.L02 Jazz Blues in F (spec: content/specs/J4.md). The twelve bars of U11 with jazz chords put in: bar 4 becomes a
// ii–V into bar 5 (Cm7 F7 into B♭7), bar 6 a diminished seventh (B°7) that climbs back to F7, bars 8 to 10 a
// dominant and a ii–V (D7 Gm7 C7) into the last line, and bar 12 a turnaround (Gm7 C7) back to the top. It is one
// common chart among several (Am7 D7 in bar 8 and F7 in bar 2 are named once as variants), so the lesson says "a"
// jazz blues.
//
// What the trio really plays (evaluated): `.dict("guidetones")` voices every chord as its 3rd and 7th (B°7 as D4
// A♭4, F7 as E♭4 A4, D7 as G♭4 C5); the walking bass of the hook has the root on every beat 1 and reaches every bar
// line by a step or a half step; the muted trumpet's head plays a tone of the chord sounding on every beat it plays
// (bar 4: G over Cm7, A over F7; bar 11: A over F7, F♯ over D7; bar 12: G over Gm7, E over C7).
//
// Departure from the spec's hook, for the music: the spec comps on the Charleston (beat 1 and the "and" of 2), whose
// second hit comes BEFORE the half bar, so the second chord of bars 4, 11 and 12 was never comped (evaluated: bar 4
// played Cm7 twice and no F7). Here the comping adds the "and" of 3 (`x ~ ~ x ~ x ~ ~`), so every chord of the chart
// sounds on the Rhodes.
//
// Written for the learner at the gate (AUTHORING §20.1): J4 opens after U15.L06. The lesson unlocks `mutetpt` and
// introduces `term.jazz-blues`. The comping (J3) and the walk (J3.L04) are reused, not taught.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - what is HEARD: S3 grades each bar's chord by root and quality, never by string; S4 the pitch classes and the
//   lowest note of every chord that sounds, over the comping and the bass together (silent comping leaves only
//   the roots); the Make's `blues-form` (jazz) reads the root of the chord sounding in each of the twelve bars;
// - each graded step pins a WRONG answer that uses the right shape (B7 where the chart has B°7: the right root, a
//   dominant; Dm7 for D7; the chart at `.gain(0)`) and three other right answers. Feedback below rung 4 never names
//   the answer.
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

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const F = { tonic: "F", mode: "major" } as const;

/** J1.L01's pocket on the jazz kit: the ride pattern and the hi-hat on 2 and 4. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** The comping: guide tones (3rd and 7th) on 1, the "and" of 2 and the "and" of 3, swung, so every chord sounds. */
const COMP_RHYTHM = '.struct("x ~ ~ x ~ x ~ ~").swingBy(1/3, 4)';
const comp = (dict = '.dict("guidetones")', rhythm = COMP_RHYTHM, sound = '.s("rhodes").gain(.6)') =>
  `chords: chord(changes)${dict}.voicing()${rhythm}${sound}`;
const COMP = comp();
/** A bass on every beat from the changes: the root, four to the bar (U11's bass rhythm). */
const ROOTS_FOUR = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("upright")';
/** A bass in two from the changes: one root per chord. */
const ROOTS = 'bass: chord(changes).rootNotes(2).s("upright")';
const changes = (form: string) => `const changes = "${form}"\n`;

/** U11's blues in F, with the quick change: F7 B♭7 F7 F7 | B♭7 B♭7 F7 F7 | C7 B♭7 F7 C7. */
const U11_BLUES = "<F7 Bb7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7>";
/** A jazz blues in F, one common chart. */
const JAZZ_BLUES = "<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]>";
/**
 * The hook's walk: the root on every beat 1, each bar reached by a step or a half step from beat 4 (evaluated: B→B♭,
 * G→F, D♭→C, A→B♭, C→B, E→F, C♯→D, A♭→G, D♭→C, G♭→F, F♯→G, E→F).
 */
const WALK =
  'bass: note("<[f2 a2 c3 b2] [bb2 a2 ab2 g2] [f2 a2 c3 db3] [c3 eb3 f2 a2] [bb2 ab2 f2 c3] [b2 ab2 f2 e2] [f2 a2 c3 c#3] [d3 c3 a2 ab2] [g2 bb2 d3 db3] [c3 bb2 g2 gb2] [f2 a2 d2 f#2] [g2 bb2 c3 e2]>").s("upright")';
/** The head on the muted trumpet: a tone of the sounding chord on every beat it plays. */
const HEAD =
  'mel: note("<[f4 a4 c5 eb5] [d5 ~ bb4 ~] [c5 a4 f4 ~] [g4 ~ a4 ~] [bb4 d5 f5 ab5] [f5 ~ d5 ~] [c5 a4 f4 ~] [f#4 ~ a4 ~] [bb4 ~ d5 ~] [e5 ~ c5 ~] [a4 ~ f#4 ~] [g4 ~ e4 ~]>").swingBy(1/3, 4).s("mutetpt")';

const HOOK = code(changes(JAZZ_BLUES), RIDE, HATS, WALK, COMP, HEAD);
const U11_TRIO = code(changes(U11_BLUES), RIDE, HATS, ROOTS_FOUR, COMP);
/** S2: both charts, one after the other, in the chord band: twelve bars of U11's blues, then twelve of the jazz blues. */
const BOTH = code(
  changes(
    "<F7 Bb7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7 F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]>",
  ),
  RIDE,
  HATS,
  ROOTS_FOUR,
  COMP,
);

/** S3: the chart, one chord a bar; bars 1, 4, 11 and 12 are given (bars 4, 11 and 12 hold two chords). */
const GRID = ["F7", "Bb7", "F7", "Cm7", "Bb7", "Bo7", "F7", "D7", "Gm7", "C7", "F7", "Gm7"];
const grid = (bar: number, symbol: string) => GRID.map((x, i) => (i === bar - 1 ? symbol : x));

/** S4: `changes` holds U11's blues; the learner rewrites it as the jazz blues. */
const modify = (form: string, ...lines: string[]) =>
  code(changes(form), RIDE, ROOTS, ...(lines.length ? lines : [COMP]));
const BLUES_STARTER = code(changes(`⟪${U11_BLUES}⟫`), RIDE, ROOTS, COMP);
const BLUES_SOLUTION = modify("<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 F7 [Gm7 C7]>");
const BLUES_AM7 = modify("<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 [Am7 D7] Gm7 C7 F7 [Gm7 C7]>");
const BLUES_D7_11 = modify(JAZZ_BLUES);

/** S5: the Band plays the drums; the learner's trio starts on U11's blues, with no head yet. */
const MAKE_STARTER = code(changes(U11_BLUES), RIDE, HATS, ROOTS, COMP);
const make = (form: string, ...lines: string[]) =>
  code(changes(form), RIDE, HATS, ...(lines.length ? lines : [ROOTS, COMP]));

/** The Make's one idea, heard: the root of the chord sounding in each bar follows a jazz blues. */
const JAZZ_FORM: RubricRule = {
  id: "jazz-blues",
  label: "The chords play the twelve-bar jazz blues in F, with its jazz chords",
  required: true,
  skills: ["J11"],
  rule: "blues-form",
  variant: "jazz",
  choruses: 1,
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.blues-12bar", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J4.L02",
  version: 4,
  title: "Jazz Blues in F",
  objective:
    "I can play and chart a jazz blues: the twelve bars with ii–Vs, a diminished chord and a turnaround in them.",
  key: F,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J11"],
  practises: [],
  terms: [{ id: "term.jazz-blues", step: "S2" }],
  canDo: ["cd.read.jazz-blues"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The blues, then jazz chords",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 12 },
      exercise: {
        kind: "listen",
        id: "blues-then-jazz",
        version: 1,
        role: "practice",
        prompt:
          "Both takes follow the same twelve-bar frame in F. Listen for the bars where the second take's chords keep moving while the first take's stand still.",
        skills: [{ skill: "J11", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: U11_TRIO,
            caption: "The plain blues you know, with the quick change.",
            bars: 12,
          },
          {
            code: HOOK,
            caption:
              "The same twelve bars with jazz chords in them. Listen at bar 4, at bar 6, and from bar 8 to the end.",
            bars: 12,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Where the chords changed",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "both-charts", code: BOTH, bars: 24 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-chords-changed",
        version: 1,
        role: "practice",
        prompt:
          "Run both charts and read the chord band: bars 1–12 are the plain blues, bars 13–24 the jazz version. Compare them bar by bar and answer two questions: which jazz bar holds a ii–V into bar 5, and how many of the twelve bars differ.",
        skills: [{ skill: "J11", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Lay bar 13 under bar 1, bar 14 under bar 2, and so on: which of the jazz bars hold another chord, or two chords where the plain blues had one?",
        },
        hints: ladder(
          "Find the jazz bar that holds two chords leading into the B♭7 of the next bar.",
          "A ii–V into B♭7 is the minor chord a whole step above B♭, then the dominant a 5th above B♭. Then count every jazz bar that differs from the plain blues.",
          "The first two bars and bars 3, 5 and 7 are the same in both charts.",
        ),
        code: { starter: BOTH },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which bar of the jazz version holds a ii–V into bar 5?",
            options: [
              { id: "bar4", label: "Bar 4" },
              { id: "bar8", label: "Bar 8" },
              { id: "bar12", label: "Bar 12" },
            ],
            correct: ["bar4"],
          },
          {
            q: "number",
            prompt: "How many of the twelve bars differ from the plain blues?",
            correct: 7,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bar4"], number: 7 } }, expect: "pass" },
          {
            name: "bar 12: the ii–V back to the top",
            response: { answer: { choice: ["bar12"], number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "five: the two-chord bars 11 and 12 not counted",
            response: { answer: { choice: ["bar4"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Chart it",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "fact",
        id: "chart-the-jazz-blues",
        version: 1,
        role: "check",
        key: F,
        prompt:
          "Fill in the chart of the jazz blues in F you heard: for each empty bar, write one chord, its root and its kind of seventh. Bar 1 and the three bars that hold two chords (4, 11 and 12) are given.",
        skills: [{ skill: "J11", w: 1 }],
        hints: ladder(
          "Start with the bars that did not change from the plain blues; then listen to the others one at a time.",
          "Bar 6 climbs from B♭7 back to F7 through a chord a half step above B♭; bars 8 to 10 are a dominant, then a ii–V into the last line.",
          "Bar 6's root is B, and all its notes are a minor 3rd apart. Bar 8 leads into bar 9 the way C7 leads into F.",
        ),
        stimulus: { src: "code", code: HOOK, bars: 12, showCode: false },
        answer: {
          ui: "bar-grid",
          bars: 12,
          perRow: 4,
          entry: "symbol",
          qualities: ["maj7", "7", "m7", "m7b5", "dim7"],
          given: [1, 4, 11, 12],
        },
        correct: { text: GRID },
        spelling: "enharmonic",
        order: "sequence",
        srs: [{ family: "fam.frm.blues", mode: "review-if-due" }],
        // The catalog names the expected chord, and calls every chord of a twelve-bar chart whose symbols end in
        // 7 a dominant (B°7 and Cm7 too): the override names neither.
        feedbackText: {
          "harmony.bar":
            "Bar {bar}: not {got}. Listen to that bar again: its root first, then the kind of seventh above it.",
        },
        tests: [
          { name: "the chart", response: { answer: { text: GRID } }, expect: "pass" },
          {
            name: "B♭7 spelled A♯7",
            response: { answer: { text: grid(2, "A#7").map((x, i) => (i === 4 ? "A#7" : x)) } },
            expect: "pass",
          },
          {
            name: "B°7 spelled C♭°7",
            response: { answer: { text: grid(6, "Cbo7") } },
            expect: "pass",
          },
          {
            name: "B7 in bar 6: the right root, a dominant",
            response: { answer: { text: grid(6, "B7") } },
            expect: "fail",
            feedback: ["harmony.bar"],
          },
          {
            name: "Dm7 in bar 8: the key's own chord on 6",
            response: { answer: { text: grid(8, "Dm7") } },
            expect: "fail",
            feedback: ["harmony.bar"],
          },
          {
            name: "U11's chords in bars 8 to 10",
            response: {
              answer: { text: GRID.map((x, i) => (i === 7 ? "F7" : i === 8 ? "C7" : i === 9 ? "Bb7" : x)) },
            },
            expect: "fail",
            feedback: ["harmony.bar"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Put the jazz chords in",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "put-the-jazz-chords-in",
        version: 1,
        role: "check",
        key: F,
        prompt:
          "Rewrite `changes`, the plain blues in F, as the jazz blues you charted. Change bars 4, 6, 8, 9, 10 and 12; bar 11 may keep F7 or move to D7 halfway. Keep the other bars. Done when every bar matches the target.",
        skills: [{ skill: "J11", w: 1 }],
        swing: SWUNG,
        code: { starter: BLUES_STARTER },
        reference: { solutions: [BLUES_SOLUTION, BLUES_AM7, BLUES_D7_11], bars: 12 },
        // Heard: the pitch classes and the lowest note of every chord that sounds, over the comping and the bass
        // together (the bass reads `rootNotes`). B7 for B°7 and Dm7 for D7 fail on a note; the right string over
        // silent comping leaves only the roots.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords", "bass"], durations: true },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Play the target and listen to that bar: the root, and then the kind of chord above it.",
          "harmony.bass":
            "Bar {bar}: the right notes over another bass note. The bass reads the same string as the chords: check that chord's root.",
          "code.unknown-chord":
            "Strudel does not know that chord name, so that bar is silent. Look at how the code of the two charts writes the diminished seventh.",
        },
        hints: ladder(
          "Work through the six bars that change, one at a time, using your chart from the last step.",
          "Bar 4 holds two chords in brackets, the ii–V of the next bar's chord. Bar 6 climbs a half step above B♭. Bars 8 to 10 lead into the last line: a dominant, then the ii–V of F.",
          "Bar 4 is `[Cm7 F7]`; bar 12 is two chords too, the ii–V of F.",
        ),
        tests: [
          { name: "reference", response: { code: BLUES_SOLUTION }, expect: "pass" },
          { name: "Am7 D7 in bar 8", response: { code: BLUES_AM7 }, expect: "pass" },
          { name: "F7 D7 in bar 11", response: { code: BLUES_D7_11 }, expect: "pass" },
          {
            name: "the comping on the piano",
            response: {
              code: modify(
                "<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 F7 [Gm7 C7]>",
                comp(undefined, undefined, '.s("piano").gain(.6)'),
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(BLUES_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "B7 in bar 6: the right root, a dominant",
            response: { code: modify("<F7 Bb7 F7 [Cm7 F7] Bb7 B7 F7 D7 Gm7 C7 F7 [Gm7 C7]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Dm7 in bar 8: the key's own chord on 6",
            response: { code: modify("<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 Dm7 Gm7 C7 F7 [Gm7 C7]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the chart, the comping silent",
            response: {
              code: modify(
                "<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 F7 [Gm7 C7]>",
                comp(undefined, undefined, '.s("rhodes").gain(0)'),
              ),
            },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Bdim7: not a chord symbol",
            response: { code: modify("<F7 Bb7 F7 [Cm7 F7] Bb7 Bdim7 F7 D7 Gm7 C7 F7 [Gm7 C7]>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "Your jazz blues",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-jazz-blues",
        version: 1,
        role: "practice",
        key: F,
        title: "Jazz blues in F",
        prompt:
          "Turn the plain blues into a jazz blues in F; your song plays these twelve bars three times. Done when `changes` plays the twelve bars with the jazz blues chords. Also on the checklist: a tune of your own on the muted trumpet (`mutetpt`), on chord tones on strong beats. The tempo, bass and comping are yours.",
        skills: [{ skill: "J11", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [12, 12],
        saveAs: "sketch",
        rubric: [
          JAZZ_FORM,
          {
            id: "muted-head",
            label: "A tune plays on the muted trumpet (`mutetpt`)",
            required: false,
            skills: ["J11"],
            rule: "sounds",
            contains: ["snd.mutetpt"],
          },
          {
            id: "head-on-chord-tones",
            label: "At least 6 in 10 of the tune's notes on strong beats are notes of the chord",
            required: false,
            skills: ["J11"],
            rule: "chord-tones-strong",
            melody: "mel",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.6,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral: the
        // blues-form detail names the chord a bar should move to.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start from the chart you wrote two steps ago: the same six bars change from the plain blues.",
          "Bar 4 leads into bar 5 with a ii–V, bar 6 climbs back through a diminished chord, bars 8 to 10 lead into the last line, and bar 12 turns around.",
          "From bar 8: a dominant on D, then the ii–V of F, two bars of it. Bar 12 is that ii–V again, two chords in one bar.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the jazz chords, no tune yet",
            response: { code: make("<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 F7 [Gm7 C7]>") },
            expect: "pass",
          },
          {
            name: "the hook: a walk and a head",
            response: { code: make(JAZZ_BLUES, WALK, COMP, HEAD) },
            expect: "pass",
          },
          {
            name: "Am7 D7 in bar 8, F7 in bar 2, the left hand comping",
            response: {
              code: make(
                "<F7 F7 F7 [Cm7 F7] Bb7 Bo7 F7 [Am7 D7] Gm7 C7 F7 [Gm7 C7]>",
                ROOTS,
                comp('.dict("lefthand").anchor("a4")'),
                HEAD,
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: faster, the head on the vibes, the comping held",
            response: {
              code: make(
                JAZZ_BLUES,
                WALK,
                comp(undefined, '.struct("x ~ x ~")'),
                HEAD.replace("mutetpt", "vibes"),
              ).replace(`setcpm(${BPM}/4)`, "setcpm(176/4)"),
            },
            expect: "pass",
          },
          {
            name: "only bar 4 changed: U11's blues with a ii–V",
            response: { code: make("<F7 Bb7 F7 [Cm7 F7] Bb7 Bb7 F7 F7 C7 Bb7 F7 C7>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "eleven bars: bar 7 left out",
            response: { code: make("<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 D7 Gm7 C7 F7 [Gm7 C7]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the jazz chords, the comping silent over the bass's roots: .gain(0)",
            response: { code: make(JAZZ_BLUES, ROOTS, comp(undefined, undefined, '.s("rhodes").gain(0)')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the jazz chords, the comping silent over a bass that walks by hand",
            response: { code: make(JAZZ_BLUES, WALK, comp(undefined, undefined, '.s("rhodes").gain(0)')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
