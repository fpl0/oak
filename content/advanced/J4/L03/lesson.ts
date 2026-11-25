// J4.L03 Rhythm Changes (spec: content/specs/J4.md). The 32-bar AABA chords of I Got Rhythm (1930): each A section
// is a string of I–vi–ii–V turns in B♭, and the bridge is four dominant sevenths a 4th apart, two bars each, D7 G7 C7
// F7, every one pulling to the next and the last one back home. Half the bebop tunes ever written are new melodies on
// these chords. The learner hears the form, names the bridge by numeral, writes the bridge into a form whose A section
// is given, and then puts the whole form together for the trio.
//
// Written for the learner at the gate (AUTHORING §20.1): J4 opens after U15.L06, so secondary dominants by name
// (U15.L02–L05; U15.L05 named exactly this chain, V7/vi V7/ii V7/V V7), `arrange()` (U09) and the form lens (U09.L02)
// are there; borrowed chords by name (U16) and key changes (U17) are not, and nothing here needs them. The words
// "head" and "contrafact" wait for J4.L04: this lesson says "tune", "melody" and "riff".
//
// The form as it sounds (evaluated): `arrange([8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)])` plays 32
// bars with the bridge's roots D D G G C C F F in bars 17–24 and B♭ alone in bar 32. The spec's comping figure, the
// Charleston (beat 1 and the "and" of 2), never reaches the second chord of a two-chord bar: both hits fall in the
// bar's first half, so Gm7, F7, B♭7, E°7 and G7 would be heard only in the bass. The comping here adds beat 3
// (`"x ~ ~ x x ~ ~ ~"`), so every chord of the A section sounds in the Rhodes; the bass plays roots on 1 and 3.
// The hook's vibes riff is Oak's own (not I Got Rhythm's melody, which J4.L04 reads): every note on a beat or a
// swung "and" is a tone of the chord sounding under it, and it rests in the bridge so the form is heard.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S4 reads what is heard: the pitch classes and the lowest note at every onset of the comping and the bass over the
//   32 bars (`pcset`, `bass: true`), so the right chords one bar each (the right function, the wrong length), Dm7 for
//   D7, or the right bridge on a silent comping line (the bass's roots alone) fail;
// - the Make's one required rule is `progression` over bars 17–24 read on the comping line itself (`track:
//   "chords"`): the bridge one bar per chord, the bridge before the second A (ABAA), the bebop ii–V variant, Dm7 for
//   D7, and the right bridge on a silent or 24 dB quieter comping line all fail;
// - every graded step pins a wrong answer that uses the right function and three other right answers. The
//   `progression` detail names the expected chord, so the Make overrides `rubric.unmet` with "{label}: not yet.".
import { defineLesson, type HintLadder, type KeySpec, type RubricRule } from "@oak/content-kit";

const BPM = 176;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const B_FLAT: KeySpec = { tonic: "Bb", mode: "major" };
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;

/** The A section: I–vi–ii–V turns, then the turn through IV (Fm7 B♭7 into E♭maj7), iii–VI and ii–V. */
const A_BARS = "[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Fm7 Bb7] [Eb^7 Eo7] [Dm7 G7] [Cm7 F7]";
/** The last A ends at home: its bar 7 is the ii–V and its bar 8 B♭maj7. */
const A3_BARS = "[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Fm7 Bb7] [Eb^7 Eo7] [Cm7 F7] Bb^7";
/** The bridge: dominant sevenths a 4th apart, two bars each. */
const B_BARS = "D7 D7 G7 G7 C7 C7 F7 F7";
const CONST_A = `const A = "<${A_BARS}>"`;
const CONST_A3 = `const A3 = "<${A3_BARS}>"`;
const constB = (bars: string) => `const B = "<${bars}>"`;

/** The jazz kit's ride and hats (J1.L01). */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** The four sections in order, one `arrange()` per labelled line (STYLE §10). */
const FORM = "arrange([8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)])";
/** Comping: beat 1, the "and" of 2, beat 3, so the second chord of a two-chord bar sounds too. */
const COMP_RHYTHM = '.struct("x ~ ~ x x ~ ~ ~").swingBy(1/3, 4)';
const comp = (source = FORM, sound = '.s("rhodes").gain(.6)', rhythm = COMP_RHYTHM) =>
  `chords: ${source}.dict("lefthand").anchor("a4").voicing()${rhythm}${sound}`;
/** The upright on the roots, half notes on 1 and 3: a two-feel at this tempo (each root sounds under every comping hit). */
const bass = (source = FORM) => `bass: ${source}.rootNotes(2).struct("x x").s("upright")`;

/**
 * Oak's riff for the vibes over the A sections (evaluated against the comping, `lefthand` at A4): each note on a beat
 * or a swung "and" belongs to the chord under it (D F D | G over B♭maj7 then Gm7; C B♭ G | A over Cm7 then F7; C E♭ C
 * | D; G B♭ G | D♭ over E°7; A C A | B over G7; C | A), and none sits a half step from a note of the voicing (the 3rd
 * of Cm7 or Fm7 would rub against the 9th the rootless voicing puts under it, so the riff takes the root or 5th
 * there). The last A ends C B♭ G | A, then D over B♭maj7.
 */
const RIFF_12 = "[d5 ~ f5 d5 ~ g5 ~ ~] [c5 ~ bb4 g4 ~ a4 ~ ~]";
const RIFF = `<${RIFF_12} ${RIFF_12} [c5 ~ eb5 c5 ~ d5 ~ ~] [g4 ~ bb4 g4 ~ db5 ~ ~] [a4 ~ c5 a4 ~ b4 ~ ~] [c5 ~ ~ ~ ~ a4 ~ ~]>`;
const RIFF3 = `<${RIFF_12} ${RIFF_12} [c5 ~ eb5 c5 ~ d5 ~ ~] [g4 ~ bb4 g4 ~ db5 ~ ~] [c5 ~ bb4 g4 ~ a4 ~ ~] [d5 ~ ~ ~ ~ ~ ~ ~]>`;
const RIFF_CONSTS = [`const riff = "${RIFF}"`, `const riff3 = "${RIFF3}"`];
/** The riff in the A sections, resting through the bridge. */
const MEL =
  'mel: arrange([8, note(riff)], [8, note(riff)], [8, note("~")], [8, note(riff3)]).swingBy(1/3, 4).s("vibes")';

/**
 * The ride and the hi-hat of the whole form (PLAN §7, W2): they play the four sections and end with the form, the ride
 * on beat 1 of bar 32 and the hi-hat a bar early, so the last A lands on B♭maj7 instead of riding on into the loop.
 */
const RIDE_FORM =
  'drums: arrange([8, drumsA], [8, drumsA], [8, drumsB], [8, drumsA3]).swingBy(1/3, 4).bank("jazzkit")';
const HATS_FORM = 'hats: arrange([8, hatsA], [8, hatsA], [8, hatsB], [8, hatsA3]).bank("jazzkit")';
/** One const per section, named as the chords' sections are (A, B, A3), so every track lists the same form. */
const FORM_DRUMS = [
  'const drumsA = s("rd [rd rd] rd [rd rd]")',
  "const drumsB = drumsA",
  'const drumsA3 = s("<[rd [rd rd] rd [rd rd]]!7 [rd ~ ~ ~]>")',
  'const hatsA = s("~ hh ~ hh")',
  "const hatsB = hatsA",
  'const hatsA3 = s("<[~ hh ~ hh]!7 ~>")',
];

/** S1 and S2: the whole form, the trio and the riff. */
const HOOK = code(
  CONST_A,
  CONST_A3,
  constB(B_BARS),
  ...RIFF_CONSTS,
  ...FORM_DRUMS,
  "",
  RIDE_FORM,
  HATS_FORM,
  comp(),
  bass(),
  MEL,
);

/** S3: the bridge alone, eight bars, for the learner to number. */
const BRIDGE = code(
  constB(B_BARS),
  "",
  RIDE,
  HATS,
  comp("chord(B)", '.s("rhodes").gain(.6)', '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4)'),
  bass("chord(B)"),
);

/** S4: the A sections and the arrangement are given; `const B` still holds the A section's first eight bars. */
const S4_STARTER = code(CONST_A, CONST_A3, `const B = "<⟪${A_BARS}⟫>"`, "", RIDE, comp(), bass());
const s4 = (bars: string, chords = comp()) => code(CONST_A, CONST_A3, constB(bars), "", RIDE, chords, bass());
const S4_SOLUTION = s4(B_BARS);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S5: the Band plays the drums; the starter's trio loops the A section and nothing else. */
const MAKE_STARTER = code(CONST_A, CONST_A3, "", comp("chord(A)"), bass("chord(A)"));
const make = (...lines: string[]) => code(CONST_A, CONST_A3, ...lines);
/** A whole form in another order, for the tests: one `arrange()` call per line from four section names. */
const formOf = (a: string, b: string, c: string, d: string) =>
  `arrange([8, chord(${a})], [8, chord(${b})], [8, chord(${c})], [8, chord(${d})])`;

/**
 * The Make's one required rule: bars 17–24 of the comping line are the bridge, D7 G7 C7 F7 two bars each, read by
 * degree, chroma and quality in B♭ (D7 is III7, the V7 of vi). Reading bars 17–24 also needs A A before it.
 */
const BRIDGE_RULE: RubricRule = {
  id: "bridge",
  label: "Bars 17–24 play the bridge: D7, G7, C7, F7, two bars each",
  required: true,
  skills: ["J12"],
  rule: "progression",
  rn: ["III7", "III7", "VI7", "VI7", "II7", "II7", "V7", "V7"],
  track: "chords",
  bars: [17, 24],
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Drums from the Band: the chords and the bass are the learner's, so the rule reads them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J4.L03",
  version: 4,
  title: "Rhythm Changes",
  objective: "I can play rhythm changes: the 32-bar AABA of I Got Rhythm, with its bridge of dominants.",
  key: B_FLAT,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J12"],
  practises: [],
  terms: [{ id: "term.rhythm-changes", step: "S2" }],
  canDo: ["cd.read.rhythm-changes"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Thirty-two bars, four sections",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["form"] },
      example: { id: "the-whole-form", code: HOOK, bars: 32 },
      exercise: {
        kind: "listen",
        id: "thirty-two-bars",
        version: 1,
        role: "practice",
        prompt:
          "Follow the form lens and listen for the stretch where the vibes stop. Notice how its chords feel against the bars around it.",
        skills: [{ skill: "J12", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption:
              "Thirty-two bars, top to bottom, in about 44 seconds. Listen for the vibes dropping out, and for when they return.",
            bars: 32,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Read the form",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["form", "chords"] },
      example: { id: "read-the-form", code: HOOK, bars: 32 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-form",
        version: 1,
        role: "practice",
        prompt:
          "Run it and answer two questions: how many bars one section lasts in the form lens, and what the chord band shows in B, the section the vibes leave out.",
        skills: [{ skill: "J12", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the bars from the first A's start to the second A's start, then read the chord band through B: how long does each chord last, and how far does the bass move at each change?",
        },
        hints: ladder(
          "Count the bars from the start of the first A to the start of the second A in the form lens.",
          "The form lens marks each section. In B the chord band shows one chord over two bars at a time; follow the bass from one to the next.",
          "Each section has the same length. In B the bass goes D, then the G above it.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many bars long is each section?", correct: 8 },
          {
            q: "choice",
            prompt: "What does section B play?",
            options: [
              { id: "dominants", label: "Four dominant sevenths, two bars each, each a 4th above the last" },
              { id: "two-fives", label: "A ii–V in every bar" },
              { id: "a-moved-up", label: "The A section moved up a 4th" },
            ],
            correct: ["dominants"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 8, choice: ["dominants"] } }, expect: "pass" },
          {
            name: "sixteen: A A counted as one section",
            response: { answer: { number: 16, choice: ["dominants"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a ii–V a bar: the A section's habit",
            response: { answer: { number: 8, choice: ["two-fives"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Number the bridge",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "identify",
        id: "number-the-bridge",
        version: 1,
        role: "check",
        key: B_FLAT,
        prompt:
          "The bridge alone, in B♭ major: D7, G7, C7, F7, two bars each. Write the numeral of each chord in B♭. Write the key's own V7 as V7, and each other chord as the V7 of the chord it leads to, with a slash.",
        skills: [{ skill: "J12", w: 1 }],
        hints: ladder(
          "Start at the end: one of the four is the key's own V7. Work backwards from it.",
          "F7 is V7 in B♭. Each chord before it is the V7 of a chord of B♭ major: find the chord a 4th above its root, and that chord's degree in B♭.",
          "C7 is the V7 of F, and F is degree 5 in B♭: C7 is V7/V. Name D7 and G7 the same way.",
        ),
        stimulus: { src: "code", code: BRIDGE, bars: 8, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "rn-palette",
          slots: 4,
          allow: ["sevenths", "secondary"],
          labels: ["Bars 17–18", "Bars 19–20", "Bars 21–22", "Bars 23–24"],
        },
        correct: { rn: ["V7/vi", "V7/ii", "V7/V", "V7"] },
        // The catalog texts name the right numeral; these name the place and what to listen for instead.
        feedbackText: {
          "harmony.rn-degree":
            "Chord {slot}: not that numeral. Each chord of the bridge is named by the chord it leads to: count a 4th up from its root, and find that chord's degree in B♭.",
          "harmony.rn-quality":
            "Chord {slot}: the right place, the wrong kind of chord. Which kind of seventh does the bridge play, all four times?",
          "harmony.rn-target":
            "Chord {slot}: that is the V7 of another chord. Count a 4th up from this chord's root to find the chord it aims at.",
        },
        srs: [{ family: "fam.jzz.ii-v", mode: "review-if-due" }],
        tests: [
          {
            name: "V7/vi V7/ii V7/V V7",
            response: { answer: { rn: ["V7/vi", "V7/ii", "V7/V", "V7"] } },
            expect: "pass",
          },
          {
            name: "iii7 for D7: the A section's minor chord on 3",
            response: { answer: { rn: ["iii7", "V7/ii", "V7/V", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "the players' names by root: III7 VI7 II7 V7",
            response: { answer: { rn: ["III7", "VI7", "II7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "V/vi: the 7th left off the first chord",
            response: { answer: { rn: ["V/vi", "V7/ii", "V7/V", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "V7/ii for D7: aimed at the chord after it",
            response: { answer: { rn: ["V7/ii", "V7/ii", "V7/V", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-target"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Write the bridge",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["form", "chords"] },
      exercise: {
        kind: "code-modify",
        id: "write-the-bridge",
        version: 1,
        role: "check",
        prompt:
          "The A sections and the order A A B A are written, but `const B` still holds the A section, so the form never leaves home. Rewrite `const B` as the bridge: eight bars, the four dominants you just numbered, two bars each. Leave the A sections and `arrange()` as they are.",
        skills: [{ skill: "J12", w: 1 }],
        swing: SWUNG,
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 32 },
        // A chord is its notes: the pitch classes and the lowest note at every onset of the comping and the bass,
        // over all 32 bars. One bar per chord, a minor seventh for D7, or a silent comping line all fail.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords", "bass"], durations: true },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: not what the target plays there. Hear that bar against the target: is the Rhodes sounding, how long does each chord last, and what kind of seventh is it?",
        },
        hints: ladder(
          "The bridge is eight bars and four chords, so each chord lasts two bars.",
          "Eight bars, four dominant sevenths, each held for two bars. Each root is a 4th above the one before, and the last one is the key's own V7.",
          "The bridge starts on D7 for two bars. Repeat a chord in `< >` by writing it twice, or with `!2`.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          { name: "each chord with !2", response: { code: s4("D7!2 G7!2 C7!2 F7!2") }, expect: "pass" },
          {
            name: "the comping on the piano",
            response: { code: s4(B_BARS, comp(FORM, '.s("piano").gain(.6)')) },
            expect: "pass",
          },
          {
            name: "the comping held a whole bar",
            response: { code: s4(B_BARS, comp(FORM, '.s("rhodes").gain(.6)', "")) },
            expect: "pass",
          },
          {
            name: "unchanged: the A section in the bridge",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right chords one bar each: the bridge goes round twice",
            response: { code: s4("D7 G7 C7 F7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Dm7 for D7",
            response: { code: s4("Dm7 Dm7 G7 G7 C7 C7 F7 F7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right bridge on a silent comping line: only the bass's roots",
            response: { code: s4(B_BARS, comp(FORM, '.s("rhodes").gain(0)')) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "Your rhythm changes",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["form", "chords"] },
      exercise: {
        kind: "code-make",
        id: "your-rhythm-changes",
        version: 1,
        role: "practice",
        title: "Rhythm changes",
        prompt:
          "Your trio only loops the A section. Build the whole form: write `const B`, then use `arrange()` on the comping and the bass for A A B A, eight bars each, the last A from `A3`. Required: the bridge in bars 17 to 24. Also on the checklist: 32 bars or more, and a vibes riff.",
        skills: [{ skill: "J12", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [32, 64],
        saveAs: "sketch",
        rubric: [
          BRIDGE_RULE,
          {
            id: "whole-form",
            label: "The piece is at least 32 bars long",
            required: false,
            skills: ["J12"],
            rule: "bars",
            min: 32,
          },
          {
            id: "riff",
            label: "A vibes line plays",
            required: false,
            skills: ["J12"],
            rule: "sounds",
            contains: ["snd.vibes"],
          },
        ],
        // The `progression` detail names the chord it expected, and the override serves every rule of the rubric,
        // suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The form needs the bridge third, between the second A and the last one. Write it as its own `const` first.",
          "Write `const B` as in the last step, then give the comping and the bass the four sections in order with `arrange()`, eight bars each.",
          "The comping's source becomes `arrange([8, chord(A)], [8, chord(A)], …)` with the bridge third and `A3` last; the bass takes the same four.",
        ),
        tests: [
          {
            name: "the starter as it is: the A section looped",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the bridge and the form on both lines",
            response: { code: make(constB(B_BARS), "", comp(), bass()) },
            expect: "pass",
          },
          {
            name: "the bridge with !2, the comping on the piano",
            response: {
              code: make(constB("D7!2 G7!2 C7!2 F7!2"), "", comp(FORM, '.s("piano").gain(.5)'), bass()),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: the riff over the A sections, the comping held, a little slower",
            response: {
              code: make(
                constB(B_BARS),
                ...RIFF_CONSTS,
                "",
                comp(FORM, '.s("rhodes").gain(.5)', '.struct("x ~ x ~")'),
                bass(),
                MEL,
              ).replace(`setcpm(${BPM}/4)`, "setcpm(160/4)"),
            },
            expect: "pass",
          },
          {
            name: "two choruses: the form played twice",
            response: {
              code: make(
                constB(B_BARS),
                "",
                comp(
                  `arrange([8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)], [8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)])`,
                ),
                bass(
                  `arrange([8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)], [8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)])`,
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "the bridge one bar per chord",
            response: { code: make(constB("D7 G7 C7 F7"), "", comp(), bass()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the bridge before the second A: A B A A",
            response: {
              code: make(
                constB(B_BARS),
                "",
                comp(formOf("A", "B", "A", "A3")),
                bass(formOf("A", "B", "A", "A3")),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the bebop variant: a ii–V into each dominant",
            response: {
              code: make(constB("[Am7 D7] D7 [Dm7 G7] G7 [Gm7 C7] C7 [Cm7 F7] F7"), "", comp(), bass()),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "Dm7 for D7",
            response: { code: make(constB("Dm7 Dm7 G7 G7 C7 C7 F7 F7"), "", comp(), bass()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right bridge on a silent comping line: only the bass's roots are heard",
            response: { code: make(constB(B_BARS), "", comp(FORM, '.s("rhodes").gain(0)'), bass()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the comping more than 24 dB under the bass: not heard",
            response: { code: make(constB(B_BARS), "", comp(FORM, '.s("rhodes").gain(.04)'), bass()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
