// J2.L02 Minor ii–V–i (spec: content/specs/J2.md). In a minor key the ii–V–I darkens: the ii is
// half-diminished (Em7♭5, Eø7), the V keeps its leading tone but bends its 9th down to the key's own 6th
// (A7♭9, with B♭ in D minor), and home is minor. The same pull, in shadow: the minor ii–V–i.
//
// Written for the learner at the gate (AUTHORING §20.1): the lesson may be taken right after U13.CP and J2.L01,
// with U14–U17 unfinished, so it uses only what U13.CP guarantees, J1's unlocks and its own (`chord.alt`): no
// mode names, no chromatic `n` steps (the bent note is a note name, `bb4`, or a chord symbol, `A7b9`), no
// secondary dominants by name. ONE altered dominant is required, the ♭9 (contracts 1.8, pre-flight B1); ♯9 and alt
// wait for J2.L03. The trio comps with the default dictionary: `lefthand` voices `A7b9` loosely and is silent on
// `A7alt` (STYLE §5.2).
//
// The corrections-pass standard (AUTHORING §20.2) on every graded step:
// - each required check reads what is HEARD: the chords' pitch classes and lowest note at every onset (`pcset`
//   with the bass), and in the Make the numerals of the chords that sound (`contains-rn` with `inOrder`, read in
//   D minor; a silent or a masked chords line has no chords to read);
// - each graded step pins a WRONG answer that uses the right function (the ii left a minor seventh beside the
//   right V; an altered V, but the ♯9; the right names on a silent line; a half-diminished ii and a ♭9 V that land
//   on the relative major) and three other right answers.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** J1.L01's swing pocket: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';

/** The ii–V–I of D major and the minor ii–V–i of D minor, one chord a bar. */
const MAJOR = "<Em7 A7 D^7 D^7>";
const MINOR = "<Em7b5 A7b9 Dm7 Dm7>";
const constChanges = (changes: string) => `const changes = "${changes}"`;

/** The trio's comping on the Charleston, read from `changes`. */
const comp = (tail = "", dict = "") =>
  `chords: chord(changes)${dict}.voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")${tail}`;
/**
 * The bass in two, written by hand: roots on 1 and 3, and the 5th of D (A) under home. The roots are the same in
 * D major and D minor, so the line fits both. Written by hand rather than read from `changes` because the grader
 * reads a chord symbol from a `rootNotes()` line too: with the bass on the symbols, a silent chords line would still
 * show its chords to the Make's numeral rule (pinned in S6).
 */
const TWO_FEEL = "<[e2 e2] [a1 a1] [d2 a1] [d2 a1]>";
const bassLine = (line = TWO_FEEL) => `bass: note("${line}").s("upright")`;
const ROOTS = bassLine();

/**
 * The vibes line, the same rhythm in both keys. In D minor (evaluated): G E D over Em7♭5 (its 3rd, root and ♭7),
 * B♭ held over A7♭9 (the ♭9) falling to A, F over Dm7 with E (the 9th) on beat 4, then D. In D major the three
 * notes that change are B for B♭ and F♯ for F.
 */
const MINOR_LINE = "<[g4 ~ e4 d4] [bb4 ~ a4 ~] [f4 ~ ~ e4] [d4 ~ ~ ~]>";
const MAJOR_LINE = "<[g4 ~ e4 d4] [b4 ~ a4 ~] [f#4 ~ ~ e4] [d4 ~ ~ ~]>";
const vibes = (line: string) => `mel: note("${line}").swingBy(1/3, 4).s("vibes")`;

const trio = (changes: string, line?: string) =>
  code(constChanges(changes), "", RIDE, HATS, comp(), ROOTS, ...(line ? [vibes(line)] : []));

const IN_MAJOR = trio(MAJOR, MAJOR_LINE);
const IN_MINOR = trio(MINOR, MINOR_LINE);

/** S3: two cadences into D minor; only the V differs. No vibes, so the bent note is the only change. */
const PLAIN_V = trio("<Em7b5 A7 Dm7 Dm7>");
const BENT_V = trio(MINOR);

/** S4: the trio plays D major; the chord names are the learner's. */
const chartAnswer = (changes: string, tail = "", dict = "") =>
  code(constChanges(changes), "", RIDE, HATS, comp(tail, dict), ROOTS);
const CHART_STARTER = code('const changes = "⟪<Em7 A7 D^7 D^7>⟫"', "", RIDE, HATS, comp(), ROOTS);
const CHART_SOLUTION = chartAnswer(MINOR);
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S6: the Band plays the drums; the learner's trio starts in D major, with its vibes line. */
const makeAnswer = (
  changes: string,
  line: string,
  opts: { tail?: string; dict?: string; bpm?: number; bass?: string } = {},
) =>
  code(constChanges(changes), "", comp(opts.tail, opts.dict), bassLine(opts.bass), vibes(line)).replace(
    `setcpm(${BPM}/4)`,
    `setcpm(${opts.bpm ?? BPM}/4)`,
  );
const MAKE_STARTER = makeAnswer(MAJOR, MAJOR_LINE);

/**
 * The Make's one required rule: somewhere in the piece a half-diminished ii, a dominant V and a minor i sound one
 * after the other, read in D minor. Home is `i`, compared on the triad core, so Dm7, Dm6 and Dm(maj7) all pass
 * there; `iiø7` and `V7` are written with their 7 so each asks for a seventh chord (A7♭9 is a V7). A minor-seventh ii
 * is a minor core, not a diminished one, and fails.
 */
const MINOR_CADENCE: RubricRule = {
  id: "minor-ii-v-i",
  label:
    "The chords play a minor ii–V–i in order: a half-diminished ii, a dominant seventh V, then a minor home",
  required: true,
  skills: ["J06"],
  rule: "contains-rn",
  rn: ["iiø7", "V7", "i"],
  min: 1,
  inOrder: true,
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J2.L02",
  version: 3,
  title: "Minor ii–V–i",
  objective:
    "I can hear and write a minor ii–V–i: a half-diminished ii, a V with its 9th bent down, a minor home.",
  key: { tonic: "D", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J02", "J06"],
  practises: [],
  terms: [
    { id: "term.minor-ii-v-i", step: "S2" },
    { id: "term.altered-dominant", step: "S3" },
  ],
  canDo: ["cd.hear.minor-ii-v-i"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Light, then shadow",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "minor-trio", code: IN_MINOR, bars: 4 },
      exercise: {
        kind: "listen",
        id: "light-then-shadow",
        version: 1,
        role: "practice",
        prompt:
          "Listen to home, bar 3, in each take. Notice how the second landing feels next to the first: brighter, or darker.",
        skills: [{ skill: "J06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: IN_MAJOR, caption: "The ii–V–I into D, as you have played it.", bars: 4 },
          {
            code: IN_MINOR,
            caption: "The same gesture with all three chords changed. The vibes keep their shape.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "The bent note",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "minor-trio-again", code: IN_MINOR, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "the-bent-note",
        version: 1,
        role: "practice",
        prompt:
          "Run the minor version. The V's symbol in the chord band says one of its notes is bent down a half step. Answer two questions: which note is the ♭9 of A7♭9, and which number that note is in the D minor scale, counting D as 1.",
        skills: [{ skill: "J06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read bar 2 in the chord band, then listen to the vibes' first note in that bar: it is the bent note. Then count up D minor from D.",
        },
        hints: ladder(
          "Read the V's symbol in bar 2: the ♭9 names one note, counted up from the V's root, and bends it down.",
          "The 9th is the 2nd an octave up. Count a 2nd above the V's root, then bend it down a half step.",
          "The V's root is A, and the 2nd above A is B. Then find that bent note in D minor: D is 1.",
        ),
        code: { starter: IN_MINOR },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which note is the ♭9 of A7♭9?",
            options: [
              { id: "bb", label: "B♭" },
              { id: "b", label: "B" },
              { id: "gs", label: "G♯" },
            ],
            correct: ["bb"],
          },
          {
            q: "number",
            prompt: "Count up the D minor scale from D as 1. Which number is that note?",
            correct: 6,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 6, choice: ["bb"] } }, expect: "pass" },
          {
            name: "B: the 9th not bent",
            response: { answer: { number: 6, choice: ["b"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "5: counted from E",
            response: { answer: { number: 5, choice: ["bb"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "compare",
      title: "Which V bends?",
      minutes: 0.75,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-v-bends",
        version: 1,
        role: "practice",
        prompt:
          "Listen to bar 2, the V, in both cards. In one card the V bends a note down to one D minor already has. Pick that card.",
        skills: [{ skill: "J02", w: 1 }],
        hints: ladder(
          "Listen only to bar 2 of each card. One V sounds darker, as if it already leans toward the minor home.",
          "Bar 2 of each card is a chord on A. In one of them a note sits a half step above A, an octave up, and rubs against it.",
          "Play bar 2 of each card and then hum the vibes' B♭ from the first example: which V already holds it?",
        ),
        stimulus: { src: "code", code: BENT_V, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "plain", label: "Card A", audio: PLAIN_V },
            { id: "bent", label: "Card B", audio: BENT_V },
          ],
        },
        correct: { choice: ["bent"] },
        feedbackText: {
          "id.wrong":
            "Not this one. Play bar 2 of both cards again: the V you want has a note pressing down from above, the way a minor key leans home.",
        },
        tests: [
          { name: "the bent V", response: { answer: { choice: ["bent"] } }, expect: "pass" },
          {
            name: "the plain V",
            response: { answer: { choice: ["plain"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Into the shadow",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "into-the-shadow",
        version: 1,
        role: "check",
        prompt:
          "The trio plays the ii–V–I of D major. Rename its three chords in `changes` so it plays the minor ii–V–i of D minor: the same three roots, each chord darkened. Done when the trio sounds like the target.",
        skills: [{ skill: "J06", w: 1 }],
        swing: SWUNG,
        code: { starter: CHART_STARTER },
        // Home may be any minor tonic the Make offers: Dm7 (the target), Dm6 or Dm(maj7), the minimal darkening of
        // D^7 (only its 3rd lowered). Graded against the closest of the three.
        reference: {
          solutions: [
            CHART_SOLUTION,
            chartAnswer("<Em7b5 A7b9 Dm6 Dm6>"),
            chartAnswer("<Em7b5 A7b9 Dm^7 Dm^7>"),
          ],
          bars: 4,
        },
        // What is heard: the chords' pitch classes and their lowest note at every onset. A ii left a minor seventh,
        // a major home, the ♯9 for the ♭9 and the right names on a silent line all fail on the sound.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Not yet: bar {bar} does not sound like the target there. Play that bar of each and listen for the notes that differ.",
          "code.unknown-chord":
            '"{sym}" is not a chord name Strudel knows. The glyphs on a chart are for reading; code uses the spellings you have been writing.',
        },
        hints: ladder(
          "Rename all three chords. Each keeps its root and changes its quality, as in the second take of the first step.",
          "Each of the three chords changes its quality: the ii becomes half-diminished, the V takes the bent 9th you found, home becomes minor.",
          "The ii is the half-diminished seventh on E: in code, its root followed by `m7b5`.",
        ),
        tests: [
          { name: "reference", response: { code: CHART_SOLUTION }, expect: "pass" },
          {
            name: "the home chord repeated with !2",
            response: { code: chartAnswer("<Em7b5 A7b9 Dm7!2>") },
            expect: "pass",
          },
          {
            name: "the default dictionary named",
            response: { code: chartAnswer(MINOR, "", '.dict("ireal")') },
            expect: "pass",
          },
          {
            name: "the comping softer",
            response: { code: chartAnswer(MINOR, ".gain(.5)") },
            expect: "pass",
          },
          {
            name: "home darkened only in its 3rd: Dm^7",
            response: { code: chartAnswer("<Em7b5 A7b9 Dm^7 Dm^7>") },
            expect: "pass",
          },
          {
            name: "home on Dm6, as the Make allows",
            response: { code: chartAnswer("<Em7b5 A7b9 Dm6 Dm6>") },
            expect: "pass",
          },
          {
            name: "home a bare minor triad: the seventh lost",
            response: { code: chartAnswer("<Em7b5 A7b9 Dm Dm>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "unchanged",
            response: { code: plain(CHART_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right V, but the ii still a minor seventh",
            response: { code: chartAnswer("<Em7 A7b9 Dm7 Dm7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "home left major",
            response: { code: chartAnswer("<Em7b5 A7b9 D^7 D^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "an altered V, but not the one asked: A7#9",
            response: { code: chartAnswer("<Em7b5 A7#9 Dm7 Dm7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right names on a silent chords line",
            response: { code: chartAnswer(MINOR, ".gain(0)") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the jazz glyph typed into code: Eø7",
            response: { code: chartAnswer("<Eø7 A7b9 Dm7 Dm7>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Major or minor?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "major-or-minor-ii-v",
        version: 1,
        role: "check",
        prompt:
          "Four bars on Rhodes or piano with a bass, in any key. For each, pick whether it is a major ii–V–I or a minor ii–V–i.",
        skills: [{ skill: "J06", w: 1 }],
        hints: [
          { text: "Listen to home in bar 3 first: a bright landing means major, a shadowed one minor." },
          {
            text: "Listen to bars 1 and 3: the minor version's ii is darker than a minor seventh, and its home is minor.",
          },
          {
            text: "Hear it again, slower, and listen to bar 2: does the V have a note pressing down from above?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        feedbackText: {
          "id.wrong":
            "Not this time. Play it again and listen to bar 3, where it lands: bright or in shadow?",
        },
        stimulus: { src: "generator", family: "fam.jzz.ii-v", level: 2 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "major-ii-V", label: "Major ii–V–I" },
            { id: "minor-ii-V", label: "Minor ii–V–i" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.jzz.ii-v", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your minor ballad",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-minor-ii-v-i",
        version: 1,
        role: "practice",
        title: "Minor ii–V–i",
        prompt:
          "Turn the bright starter into four or eight bars in D minor. Required: the chords play a minor ii–V–i. Also on the checklist: the V carries its ♭9, and the vibes line ends on D over the minor home. Home can be Dm7, Dm6 or Dm with a major 7th (`Dm^7`).",
        skills: [{ skill: "J06", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 16],
        saveAs: "sketch",
        rubric: [
          MINOR_CADENCE,
          {
            id: "bent-v",
            label: "The V is written as a 7♭9 chord",
            required: false,
            skills: ["J02"],
            rule: "chord-qualities",
            track: "chords",
            contains: ["7b9"],
            depth: "seventh",
          },
          {
            id: "line-home",
            label: "The vibes line's last note is D, over the minor home chord",
            required: false,
            skills: ["J06"],
            rule: "ends-on-degree",
            track: "mel",
            degrees: ["1"],
            over: "i",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with the chords: all three in the starter are still the bright major ii–V–I.",
          "All three chord names change, as in the trio you darkened; then the vibes line has two notes that clash with the new chords.",
          "The V is the A7♭9 you met; over it the line's long note bends from B down to B♭, and over home F♯ becomes F.",
        ),
        tests: [
          {
            name: "the starter as it is: D major",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the hook's trio",
            response: { code: makeAnswer(MINOR, MINOR_LINE) },
            expect: "pass",
          },
          {
            name: "home on Dm6",
            response: { code: makeAnswer("<Em7b5 A7b9 Dm6 Dm6>", MINOR_LINE) },
            expect: "pass",
          },
          {
            name: "the plain V7 still counts as the V",
            response: {
              code: makeAnswer("<Em7b5 A7 Dm7 Dm7>", "<[g4 ~ e4 d4] [a4 ~ e4 ~] [f4 ~ ~ e4] [d4 ~ ~ ~]>"),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars, home darkened to Dm(maj7), faster, a line of its own",
            response: {
              code: makeAnswer(
                "<Dm7 Gm7 Em7b5 A7b9 Dm7 Dm^7 Em7b5 A7b9>",
                "<[a4 ~ f4 d4] [bb4 ~ g4 f4] [g4 e4 d4 bb3] [a3 ~ bb4 ~] [a4 ~ f4 e4] [c#5 ~ a4 ~] [d5 bb4 g4 e4] [bb4 ~ a4 ~]>",
                { bpm: 144, bass: "<[d2 a1] [g1 d2] [e2 e2] [a1 a1] [d2 a1] [d2 a1] [e2 e2] [a1 a1]>" },
              ),
            },
            expect: "pass",
          },
          {
            name: "the right V, but a minor-seventh ii",
            response: { code: makeAnswer("<Em7 A7b9 Dm7 Dm7>", MINOR_LINE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the half-diminished ii and the bent V land on F major, not D minor",
            response: {
              code: makeAnswer("<Em7b5 A7b9 F^7 F^7>", "<[g4 ~ e4 d4] [bb4 ~ a4 ~] [a4 ~ ~ g4] [f4 ~ ~ ~]>"),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the ii and V go round and never reach home",
            response: { code: makeAnswer("<Em7b5 A7b9 Em7b5 A7b9>", MINOR_LINE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right chords in the wrong order: home first, the ii last",
            response: {
              code: makeAnswer(
                "<Dm7 A7b9 Em7b5 Em7b5>",
                "<[f4 ~ ~ e4] [bb4 ~ a4 ~] [g4 ~ e4 d4] [e4 ~ ~ ~]>",
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right names on a silent chords line",
            response: { code: makeAnswer(MINOR, MINOR_LINE, { tail: ".gain(0)" }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the comping more than 24 dB under the vibes: not heard",
            response: { code: makeAnswer(MINOR, MINOR_LINE, { tail: ".gain(.04)" }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "alt under the left-hand dictionary: silent",
            response: {
              code: makeAnswer("<Em7b5 A7alt Dm7 Dm7>", MINOR_LINE, { dict: '.dict("lefthand")' }),
            },
            expect: "fail",
            feedback: ["code.chord-not-in-dict"],
          },
        ],
      },
    },
  ],
});
