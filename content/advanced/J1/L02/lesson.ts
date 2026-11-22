// J1.L02 Reading 7th-Chord Symbols (spec: content/specs/J1.md). A jazz chart writes the chords the learner
// already plays with a few glyphs: ∆ is a major seventh, – minor, ø half-diminished, ° diminished; a symbol tells
// you the notes. Two symbols are new colours: the sixth chord (F6: the triad plus the 6th, warm and settled) and
// the sus chord (C7sus: the 4th in place of the 3rd, floating until the 3rd comes back).
//
// Written for the learner at the gate (AUTHORING §20.1): J1 may be taken with U14–U17 unfinished, so the lesson
// uses only what U13.CP guarantees plus J1's unlocks (the jazz kit, the vibraphone, the sixth and sus symbols).
// The chords are voiced by the default dictionary: `F6`, `Csus` and `C7sus` are silent under `lefthand`.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S5 reads what is HEARD: the chords' pitch classes and lowest note at every onset (`pcset`), so a `^7` where
//   the page says `7`, a major seventh where it says 6, or the right names on a silent line all fail;
// - the Make's one required rule asks for both colours, read from the chords that sound: a sixth chord and a sus
//   chord on a silent line, or only one of the two, fail;
// - each graded step pins a wrong answer that uses the right function and three other right answers.
// Feedback below rung 4 never names the answer.
//
// S3 grades the glyph reading with a choice of three code spellings per symbol (the spec's fallback): a text
// answer normalized as a chord accepts the glyph typed back as it is printed (`E-7`, `Fø7`), so it cannot tell
// whether the learner read the glyph.
import { defineLesson, type FactEx, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 116;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const F_MAJOR = { tonic: "F", mode: "major" } as const;
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** J1.L01's swing pocket: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** The bass in two: each chord's root on beats 1 and 3. */
const BASS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")';
/** The Rhodes holds each chord, voiced by the default dictionary (it knows the sixth and sus symbols). */
const chordsLine = (extra = "") => `chords: chord(changes).voicing().s("rhodes")${extra}`;
const changesConst = (bars: string) => `const changes = "<${bars}>"`;
const chart = (bars: string, ...lines: string[]) =>
  code(changesConst(bars), "", RIDE, HATS, BASS, chordsLine(), ...lines);

/** The hook: F6 | D–7 | G–7 | C7sus C7 (evaluated: F6 plays F C D F A, C7sus G C F G B♭, C7 E B♭ E G C). */
const HOOK_BARS = "F6 Dm7 Gm7 [C7sus C7]";
const HOOK = chart(HOOK_BARS);
/** The same chart with the two colours taken out: plain F, plain C7. */
const PLAIN = chart("F Dm7 Gm7 C7");

/** S4: two cards, the same ii chord, then the 5th's chord with its 4th or with its 3rd. */
const card = (last: string) => code(changesConst(`Gm7 ${last}`), "", BASS, chordsLine());
const SUS_CARD = card("C7sus");
const PLAIN_CARD = card("C7");

/** S5: the page's chart is G–7 | C7 | F∆7 | F6; the starter plays it as plain triads. */
const PAGE_STARTER = code(`const changes = "<⟪Gm C F F⟫>"`, "", RIDE, HATS, BASS, chordsLine());
const page = (bars: string, extra = "") => code(changesConst(bars), "", RIDE, HATS, BASS, chordsLine(extra));
const PAGE_SOLUTION = page("Gm7 C7 F^7 F6");
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S6: the Band plays the drums; the learner's chart starts as four plain sevenths. */
const makeChart = (bars: string, ...more: string[]) =>
  code(changesConst(bars), "", BASS, chordsLine(), ...more);
const MAKE_STARTER = makeChart("F^7 Dm7 Gm7 C7");
/**
 * A vibes line for the rich sketch over F6 | Dm7 | Gm7 | C7sus C7: A C D | A F | B♭ D F D | G E, every note a chord
 * tone of the chord under it (G over C7sus, E over C7).
 */
const VIBES = 'mel: note("<[a4 ~ c5 d5] [a4 ~ f4 ~] [bb4 d5 f5 d5] [g4 ~ e4 ~]>").swingBy(1/3, 4).s("vibes")';

/** The Make's one required rule: a sixth chord and a sus chord, both heard on the chords line. */
const BOTH_COLOURS: RubricRule = {
  id: "sixth-and-sus",
  label: "`changes` holds at least one sixth chord (such as F6) and one sus chord (such as C7sus)",
  required: true,
  skills: ["J01", "C09"],
  rule: "chord-qualities",
  track: "chords",
  contains: ["6"],
  // C7sus reads as the dominant sus chord (7sus4), Csus as the plain one (sus4): either is the floating colour.
  anyOf: ["sus4", "7sus4"],
  min: 1,
};
/** A suggestion: the chart comes home to F at the end (an F6 there is the warm ending the brief invites). */
const ENDS_HOME: RubricRule = {
  id: "ends-home",
  label: "The last chord of the chart is the home chord, built on F",
  required: false,
  skills: ["J01"],
  rule: "custom",
  fn: "last-chord",
  params: { rn: ["I"], harmony: "chords" },
};
/** S3: one glyph, three code spellings; the parts of one graded check. */
const glyphPart = (
  id: string,
  glyph: string,
  options: [string, string][],
  correct: string,
  hint: [string, string, string],
  wrong: string,
): FactEx => ({
  kind: "fact",
  id,
  version: 1,
  role: "check",
  prompt: `${glyph} on a jazz chart: which code plays it?`,
  skills: [{ skill: "J01", w: 1 }],
  hints: ladder(...hint),
  answer: { ui: "choice", options: options.map(([oid, label]) => ({ id: oid, label })) },
  correct: { choice: [correct] },
  spelling: "strict",
  order: "set",
  feedbackText: { "id.wrong": wrong },
  tests: [
    { name: correct, response: { answer: { choice: [correct] } }, expect: "pass" },
    ...options
      .filter(([oid]) => oid !== correct)
      .map(([oid]) => ({
        name: `read as ${oid}`,
        response: { answer: { choice: [oid] } },
        expect: "fail" as const,
        feedback: ["id.wrong" as const],
      })),
  ],
});

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the bass are the learner's, so the rule reads them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J1.L02",
  version: 3,
  title: "Reading 7th-Chord Symbols",
  objective:
    "I can read a jazz chart's chord symbols, sixths and sus chords included, and play them in code.",
  key: F_MAJOR,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J01", "C09"],
  practises: [],
  terms: [
    { id: "term.sixth-chord", step: "S2" },
    { id: "term.sus-chord", step: "S4" },
  ],
  canDo: ["cd.read.jazz-symbols"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A chart in F",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "chart-in-f", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "chart-in-f",
        version: 1,
        role: "practice",
        prompt:
          "Listen to bar 1 and to the start of bar 4 in both takes; nothing else changes. Notice how each of those two chords feels in the first take compared with the second.",
        skills: [{ skill: "J01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "As the chart prints it: F6 | D–7 | G–7 | C7sus C7.",
            bars: 4,
          },
          {
            code: PLAIN,
            caption: "The same chart with a plain F triad in bar 1 and a plain C7 all through bar 4.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Read the glyphs",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "the-chart", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-glyphs",
        version: 1,
        role: "practice",
        prompt:
          "Run the chart and watch the chord band: it names each chord in code while the chart shows its glyph. Then answer two questions: which code chord bar 2's D–7 is, and how many different letter names bar 1's F6 plays.",
        skills: [{ skill: "J01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare the glyph in bar 2 with the name the chord band gives it, then count the letter names in bar 1 on the roll, each one once.",
        },
        hints: ladder(
          "For the first question, find the mark the chart prints in bar 2 where code writes an m. For the second, read bar 1 on the roll.",
          "The chord band names bar 2 in code while the chart prints its glyph. For bar 1, read the roll: some letters sound twice.",
          "Bar 1 holds the F major triad, F A C, and one more letter.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "The chart prints bar 2 as D–7. Which chord is it in code?",
            options: [
              { id: "dm7", label: "Dm7" },
              { id: "d7", label: "D7" },
              { id: "dmaj7", label: "D^7" },
            ],
            correct: ["dm7"],
          },
          { q: "number", prompt: "How many different letter names does F6, in bar 1, play?", correct: 4 },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 4, choice: ["dm7"] } }, expect: "pass" },
          {
            name: "three: the triad only",
            response: { answer: { number: 3, choice: ["dm7"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "D7: the dash read as a dominant",
            response: { answer: { number: 4, choice: ["d7"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Glyphs into code",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "glyphs-into-code",
        version: 1,
        role: "check",
        prompt: "For each of the four jazz chart symbols, pick the code that plays it.",
        skills: [{ skill: "J01", w: 1 }],
        hints: ladder(
          "Each glyph stands for one kind of seventh chord. Match the glyph first, then the root.",
          "Four glyphs, four kinds: a major seventh, a minor seventh, a half-diminished seventh and a diminished seventh.",
          "The triangle marks the seventh a half step under the root's octave; the dash marks minor, as `m` does in code.",
        ),
        srs: [{ deck: "deck.chd.symbols", cards: ["fact.chord.F6", "fact.chord.Csus"], mode: "seed" }],
        tests: [],
        parts: [
          glyphPart(
            "b-flat-triangle",
            "B♭∆7",
            [
              ["Bb^7", "Bb^7"],
              ["Bb7", "Bb7"],
              ["Bbm7", "Bbm7"],
            ],
            "Bb^7",
            [
              "What does the triangle say about the 7th?",
              "∆ is one of the major chords: the triad is major, and so is its 7th.",
              "In code a major seventh is the letter, then a sign before the 7.",
            ],
            "Not yet. The triangle marks a major triad with a major 7th, a half step under the root's octave.",
          ),
          glyphPart(
            "e-dash",
            "E–7",
            [
              ["Em7", "Em7"],
              ["E7", "E7"],
              ["Em7b5", "Em7b5"],
            ],
            "Em7",
            [
              "What does the dash say about the triad?",
              "The dash stands where code writes the letter m: the triad is minor, its 5th untouched.",
              "A minor triad with a plain 7 on top.",
            ],
            "Not yet. The dash marks a minor triad; the 7 after it is the plain 7th, a whole step under the octave.",
          ),
          glyphPart(
            "f-slashed-circle",
            "Fø7",
            [
              ["Fm7b5", "Fm7b5"],
              ["Fo7", "Fo7"],
              ["F7", "F7"],
            ],
            "Fm7b5",
            [
              "What does the slashed circle say about the 5th?",
              "ø is half-diminished: a diminished triad with the plain 7th on top, not the diminished 7th.",
              "In code it is the minor seventh with its 5th lowered.",
            ],
            "Not yet. The slashed circle is half-diminished: only the triad is diminished, and the 7th stays a whole step under the octave.",
          ),
          glyphPart(
            "a-circle",
            "A°7",
            [
              ["Ao7", "Ao7"],
              ["Am7b5", "Am7b5"],
              ["Am7", "Am7"],
            ],
            "Ao7",
            [
              "What does the plain circle say, next to the slashed one?",
              "° is fully diminished: the triad and the 7th are both diminished, minor 3rds all the way up.",
              "In code the diminished sign is a small o after the letter.",
            ],
            "Not yet. The plain circle is fully diminished: the 7th drops a half step lower than in the half-diminished chord.",
          ),
        ],
      },
    },
    {
      id: "S4",
      kind: "compare",
      title: "Float or lean",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "float-or-lean",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the chord on C in the second bar of each card. In one card it leans toward F; in the other it floats, neither bright nor dark, as if waiting. Pick the card that floats.",
        skills: [{ skill: "C09", w: 1 }],
        hints: ladder(
          "Listen only to the second bar of each card. One chord wants to move on to F; the other hangs in the air.",
          "Both chords on C have the same root and the same 7th. One note in the middle differs.",
          "In one card the chord has no 3rd at all: a note a half step higher sits in its place.",
        ),
        stimulus: { src: "code", code: SUS_CARD, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "sus", label: "Card A", audio: SUS_CARD },
            { id: "plain", label: "Card B", audio: PLAIN_CARD },
          ],
        },
        correct: { choice: ["sus"] },
        feedbackText: {
          "id.wrong":
            "Listen to the middle of each chord on C. In card B you hear its 3rd, which pulls toward F; in card A the 3rd is missing, so the chord hangs.",
        },
        tests: [
          { name: "card A floats", response: { answer: { choice: ["sus"] } }, expect: "pass" },
          {
            name: "card B: the plain C7",
            response: { answer: { choice: ["plain"] } },
            expect: "fail",
            feedback: ["id.wrong"],
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
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "The chart reads G–7 | C7 | F∆7 | F6, but `changes` plays plain triads. Rewrite each of the four chords in `changes` to match the chart, bar by bar. The roots stay; only the kind of chord changes. Done when all four bars play the chart's chords.",
        skills: [
          { skill: "J01", w: 0.7 },
          { skill: "C09", w: 0.3 },
        ],
        swing: SWUNG,
        code: { starter: PAGE_STARTER },
        reference: { solutions: [PAGE_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes and the lowest note of the chords line at every onset (contracts
        // §6.7). A dominant where the page has a triangle, a major seventh where it has a 6, or the right names on
        // a silent line all fail, whatever the code reads like.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: not the chord the page asks for. Read that bar's glyph again: which kind of seventh, or which added note, does it print?",
        },
        hints: ladder(
          "Compare each glyph with the plain triad in the same bar of `changes`. Each glyph adds one note, a 7th or a 6th, to its triad.",
          "Bar 1 is minor with a 7th; bar 2 a dominant seventh; bar 3 a major seventh; bar 4 the triad with its 6th.",
          "Bar 1 becomes `Gm7`. In code a major seventh needs a sign before the 7, and bar 4 keeps the 6 as the chart prints it.",
        ),
        tests: [
          { name: "reference", response: { code: PAGE_SOLUTION }, expect: "pass" },
          { name: "each bar in brackets", response: { code: page("[Gm7] [C7] [F^7] [F6]") }, expect: "pass" },
          { name: "bar 4 struck twice", response: { code: page("Gm7 C7 F^7 [F6 F6]") }, expect: "pass" },
          { name: "bar 2 as an alternation", response: { code: page("Gm7 <C7> F^7 F6") }, expect: "pass" },
          { name: "F spelled E♯", response: { code: page("Gm7 C7 E#^7 E#6") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: plain(PAGE_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the triangle read as a dominant: F7",
            response: { code: page("Gm7 C7 F7 F6") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right kind of symbol in the wrong bar: F^7 for F6",
            response: { code: page("Gm7 C7 F^7 F^7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right names on a silent chords line",
            response: { code: page("Gm7 C7 F^7 F6", ".gain(0)") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right chord on beat 1, then another for the rest of the bar",
            response: { code: page("Gm7 C7 [F^7 Bbm7] F6") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "Fmaj7 is not a code spelling",
            response: { code: page("Gm7 C7 Fmaj7 F6") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your chart in F",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-chart-in-f",
        version: 1,
        role: "practice",
        title: "Chart in F",
        prompt:
          "Write your own four-bar chart in F in `changes`. Required: at least one sixth chord and one sus chord. Also on the checklist: end on the home chord, built on F. For more, add bars, or a swung vibes line whose long notes sit in their chords.",
        skills: [
          { skill: "J01", w: 0.5 },
          { skill: "C09", w: 0.5 },
        ],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [BOTH_COLOURS, ENDS_HOME],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The required rule asks for the two colours this lesson added: one chord with its 6th added, one with a 4th in place of its 3rd.",
          "One chord gets its 6th added to the triad; another gets the 4th in place of its 3rd. Both are written in `changes`.",
          "Bar 4 could hold the sus chord on C for half the bar, then C7; the last chord could become a sixth chord on F.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the sus in bar 3, F6 at the end",
            response: { code: makeChart("F^7 Gm7 C7sus F6") },
            expect: "pass",
          },
          {
            name: "beyond the brief: the hook's chart with a vibes line, slower",
            response: {
              code: makeChart("F6 Dm7 Gm7 [C7sus C7]", VIBES).replace(`setcpm(${BPM}/4)`, "setcpm(100/4)"),
            },
            expect: "pass",
          },
          {
            name: "the plain sus chord: Csus",
            response: { code: makeChart("Gm7 Csus C7 F6") },
            expect: "pass",
          },
          {
            name: "a sixth chord on another root",
            response: { code: makeChart("Bb6 Gm7 [C7sus C7] F^7") },
            expect: "pass",
          },
          {
            name: "a sus chord but no sixth chord",
            response: { code: makeChart("F^7 Dm7 Gm7 [C7sus C7]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a sixth chord but no sus chord",
            response: { code: makeChart("F6 Dm7 Gm7 C7") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "both colours on a silent chords line",
            response: { code: makeChart("F^7 Gm7 C7sus F6").replace('s("rhodes")', 's("rhodes").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "F6 under the left-hand dictionary, which does not know it",
            response: {
              code: makeChart("F^7 Gm7 C7sus F6").replace(
                "chord(changes).voicing()",
                'chord(changes).dict("lefthand").voicing()',
              ),
            },
            expect: "fail",
            feedback: ["code.chord-not-in-dict"],
          },
        ],
      },
    },
  ],
});
