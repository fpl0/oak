// U13.L01 Pushes & Anticipations. A chord or a note can arrive before its beat. When the Rhodes plays the chord
// of bar 2 on the last eighth note of bar 1 and holds it across the bar line, that early arrival is an
// anticipation; accents that land between the beats, against the pulse, are syncopation. In code one call
// moves a whole line: `.early(1/8)` an eighth note earlier, `.late(1/8)` an eighth note later. The number is a
// share of the bar. What the learner has: hits between the beats written with `.struct()` (U06.L12) and felt
// as "leaning into the next beat" (U08.L04, where the word was held back), the swing call in the same place
// of the chain (U11.L07), sevenths by name over a root bass (U12). Not yet: ghost notes and `.velocity()`
// (U13.L02), the tie that writes a push on the staff (U13.L03: this lesson shows the roll, never the staff),
// triplets (U13.L05), microtiming (R1.L05). Spec: content/specs/U13.md.
//
// How it is graded: a pushed chord is the same chord at another time, so the two modify steps compare the
// pitch classes sounding at each onset of the `chords` line (`pcset`, `perOnset`). `.late(1/8)` for
// `.early(1/8)` puts the chords an eighth after the bar line and fails on every onset; `.late(7/8)` lands on
// the right eighth with the chord of the bar before and fails on the notes. A fraction in quotes
// (`.early("1/8")`) shifts nothing: the lint names it (`code.time-fraction-string`). The ear step is four
// fixed grooves answered with `PUSH_OPTIONS`; `fam.rhy.syncopation` is seeded and starts in tomorrow's
// warm-up. The Make's one required rule is `syncopation` on the chords (Longuet-Higgins and Lee: a note that
// starts on a weak position and holds over a stronger one), at least twice.
//
// Band: none (`band: false`). The kick, snare and hats are lines of the learner's own code in every step:
// they are the grid a push is heard against. A Band's drums would double them, and the jazz-soul Band swings
// its ride (the off-beat two thirds of the way through the beat), so a chord pushed by a straight eighth would
// land a triplet away from it.
//
// One thing every example allows for: a line moved with `.early()` has nothing to play at the very start. Its
// first chord would have begun before bar 1, so the first time through the Rhodes enters on the "and" of 4.
// The bass stays on the beat in every shown example, so bar 1 is never empty, and S4 says what happens.
import { defineLesson, type HintLadder, type IdentifyEx, PUSH_OPTIONS } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** One bar in seconds (tap tests). */
const BAR_SEC = 240 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** One string drives the chords and the bass (U08.L04, U12): change it once and both follow. */
const changes = (form: string) => `const changes = "${form}"`;
/** The grid a push is heard against: kick on 1 and 3, snare on 2 and 4, eight even hats. */
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.5)';
/** The roots on beats 1, 3 and 4, always on the beat: the bass is what the Rhodes pushes against. */
const BASS = 'bass: chord(changes).rootNotes(2).struct("x ~ ~ ~ x ~ x ~").s("fingerbass").lpf(800)';
/** The chord line: `shift` is the time call (STYLE §1: after pitch and structure, before the sound). */
const chords = (shift = "", sound = "rhodes", struct = "", tail = "") =>
  `chords: chord(changes).voicing()${struct}${shift}.s("${sound}")${tail}`;
const groove = (form: string, chordLine: string, ...more: string[]) =>
  `${TEMPO}${changes(form)}\n\n${[KICK, SNARE, HATS, BASS, chordLine, ...more].join("\n")}`;

const EARLY_8 = ".early(1/8)";
const EARLY_16 = ".early(1/16)";
const LATE_8 = ".late(1/8)";

/** The hook: ii7 V7 Imaj7 IVmaj7 in C, the Rhodes an eighth note ahead of every bar line. */
const LOOP = "<Dm7 G7 C^7 F^7>";
const ON_THE_BEAT = groove(LOOP, chords());
const HOOK = groove(LOOP, chords(EARLY_8));
/** S3: the same push, half as long. */
const TIGHT = groove(LOOP, chords(EARLY_16));

/** S5: another loop (vi7 ii7 V7 Imaj7), the Rhodes on the beat; only its line is editable. */
const S5_LOOP = "<Am7 Dm7 G7 C^7>";
const s5 = (chordLine: string) => groove(S5_LOOP, chordLine);
const S5_STARTER = s5('chords: ⟪chord(changes).voicing().s("rhodes")⟫');
const S5_SOLUTION = s5(chords(EARLY_8));

/** S6: a short chord on every beat (`.clip(.5)` halves each one); `.late(1/8)` moves all four to the "and" after it. */
const STABS = '.struct("x x x x")';
const SHORT = ".clip(.5)";
const S6_LOOP = "<C^7 F^7 Dm7 G7>";
const s6 = (chordLine: string) => groove(S6_LOOP, chordLine);
const organ = (shift: string) => chords(shift, "organ", STABS, SHORT);
const S6_STARTER = s6('chords: ⟪chord(changes).voicing().struct("x x x x").s("organ").clip(.5)⟫');
const S6_SOLUTION = s6(organ(LATE_8));

/**
 * S7: two chords a bar, so two bars hold four arrivals. The drums and the bass are the same every time; only
 * the chords are on the beat or pushed.
 */
const earCode = (form: string, shift: string, sound: string) =>
  `${TEMPO}${changes(form)}\n\n${[KICK, SNARE, HATS, 'bass: chord(changes).rootNotes(2).s("fingerbass").lpf(800)', chords(shift, sound)].join("\n")}`;
const earHints = (): HintLadder =>
  ladder(
    "Follow the bass: it lands on beats 1 and 3 every time. Do the chords change with it, or just before it?",
    "Count 1 & 2 & 3 & 4 &. A chord on the beat starts with a bass note. A pushed chord starts on an “&”, before the bass note it belongs to.",
    "Tap the beats with one hand. If each new chord falls between two taps, it is pushed.",
  );
const earPart = (
  id: string,
  prompt: string,
  code: string,
  answer: "on" | "pushed",
  wrong: string,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "R10", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code, bars: 2, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...PUSH_OPTIONS] },
  correct: { choice: [answer] },
  feedbackText: { "id.wrong": wrong },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: answer === "on" ? "heard as pushed" : "heard as on the beat",
      response: { answer: { choice: [answer === "on" ? "pushed" : "on"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});
const PUSHED_TEXT =
  "These chords were pushed: each one starts between two beats, just before the bass note it belongs to.";
const ON_TEXT =
  "These chords were on the beat: each one starts together with a bass note, on beat 1 or beat 3.";

/** The Make: Imaj7 vi7 IVmaj7 V7, everything on the beat. */
const MAKE_LOOP = "<C^7 Am7 F^7 G7>";
const MAKE_STARTER = groove(MAKE_LOOP, chords());
const MAKE_MINIMAL = groove(MAKE_LOOP, chords(EARLY_8));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** Seconds from the start of the stimulus of the given eighth-note positions (0 = beat 1 of bar 1). */
const at = (eighths: number[]) => eighths.map((e) => Number(((e * BAR_SEC) / 8).toFixed(3)));
/** Where the pushed Rhodes arrives in four bars: the last eighth of each bar. */
const PUSHES = [7, 15, 23, 31];

export default defineLesson({
  id: "U13.L01",
  version: 3,
  title: "Pushes & Anticipations",
  objective:
    "I can make a chord arrive before its beat with .early(), move a line after the beat with .late(), and hear whether chords are pushed.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R10"],
  practises: [],
  terms: [
    { id: "term.anticipation", step: "S4" },
    { id: "term.syncopation", step: "S4" },
  ],
  canDo: ["cd.code.pushes"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "On the beat, then early",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "on-the-beat-then-early",
        version: 1,
        role: "practice",
        prompt:
          "Listen for when each new chord arrives, in both loops. Notice which loop leans forward, and which instrument reaches the new chord before beat 1.",
        skills: [{ skill: "R10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: ON_THE_BEAT, caption: "Loop 1: every chord changes on beat 1.", bars: 4 },
          {
            code: HOOK,
            caption: "Loop 2: one line has moved; everything else is as before.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the early chord",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-early-chord",
        version: 1,
        role: "practice",
        prompt:
          "Tap once each time the Rhodes plays a new chord: on the “and” after beat 4, the last hat before each bar line. One tap a bar, four taps in all. Done when every tap lands with a Rhodes chord, just before the kick on 1.",
        skills: [{ skill: "R10", w: 1 }],
        hints: ladder(
          "Tap the Rhodes, not the kick. Listen to bar 1: does the Rhodes come in with the kick on beat 1, or before it?",
          "Count the eighth notes with the hats: 1 & 2 & 3 & 4 &. The Rhodes lands on the last “&”, and the kick answers on 1.",
          "Say “four-AND-one” out loud and tap on “AND”. Let the next kick fall right after your tap.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "chords" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed":
            "A Rhodes chord came in with no tap. Tap on the “and” after beat 4, the last hat of each bar.",
          "tap.extra":
            "A tap landed where the Rhodes is only holding its chord. Tap once a bar, on the last “and”, and let the kick on 1 go by.",
        },
        srs: [{ family: "fam.rhy.echo", mode: "review-if-due" }],
        tests: [
          {
            name: "with the Rhodes: the last eighth of each bar",
            response: { taps: at(PUSHES) },
            expect: "pass",
          },
          {
            name: "on beat 1 of each bar, with the bass",
            response: { taps: at([8, 16, 24]) },
            expect: "fail",
          },
          { name: "on beat 4, an eighth too soon", response: { taps: at([6, 14, 22, 30]) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "Half the push",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "half-the-push",
        version: 1,
        role: "practice",
        prompt:
          "The Rhodes line you tapped ended `.early(1/8)`: every chord an eighth note early. This one ends `.early(1/16)`. Predict how far before the bar line each chord now lands, then pick your answer.",
        skills: [{ skill: "R10", w: 1 }],
        hints: null,
        tests: [],
        code: TIGHT,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "sixteenth", label: "A shorter push: each chord lands a sixteenth note before the bar line" },
          { id: "quarter", label: "A longer push: each chord lands a whole beat before the bar line" },
          { id: "sixteen", label: "Sixteen chords in every bar" },
        ],
        correct: ["sixteenth"],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Where the chord lands",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "the-push", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-chord-lands",
        version: 1,
        role: "practice",
        prompt:
          "Run it and watch the Rhodes on the roll against the kick. Each chord lasts a bar, eight eighth notes, but does not start on beat 1. Answer both questions: the count each chord starts on, and how many of its eight eighth notes come after the bar line.",
        skills: [{ skill: "R10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the eighth notes with the hats, 1 & 2 & 3 & 4 &, and find the one where a Rhodes chord begins. One of its eight eighth notes falls before the bar line; the rest come after.",
        },
        hints: ladder(
          "Find the bar line on the roll, where the kick plays beat 1. Does the Rhodes chord start there?",
          "The chord starts with the last hat of the bar, the “&” after beat 4, and rings on into the next bar.",
          "Eight eighth notes in all, and one of them is before the bar line. Take that one away.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "On which count does each Rhodes chord start?",
            options: [
              { id: "and-of-4", label: "The “and” after beat 4: an eighth note before the bar line" },
              { id: "beat-4", label: "Beat 4: a whole beat before the bar line" },
              { id: "and-of-1", label: "The “and” after beat 1: an eighth note after the bar line" },
            ],
            correct: ["and-of-4"],
          },
          {
            q: "number",
            prompt: "Each chord lasts eight eighth notes. How many of them come after the bar line?",
            correct: 7,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["and-of-4"], number: 7 } }, expect: "pass" },
          {
            name: "the push taken for a whole beat",
            response: { answer: { choice: ["beat-4"], number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "eight after the bar line: nothing early",
            response: { answer: { choice: ["and-of-4"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Push the Rhodes",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "push-the-rhodes",
        version: 1,
        role: "check",
        prompt:
          "Move the Rhodes so every chord arrives one eighth note before its bar line. Add one call to the `chords:` line, after `.voicing()` and before `.s()`. Leave the bass and drums as they are. Done when each chord starts on the “and” after beat 4.",
        skills: [{ skill: "R10", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [S5_SOLUTION], bars: 4 },
        // The same chords at another time: the pitch classes sounding at each onset of the Rhodes line.
        matcher: { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: the Rhodes has {got} where the target has {exp}. Play the target again and listen for when each chord arrives, and which notes it holds.",
          "harmony.shifted":
            "The chords are right, but each starts {shift} than in the target{push}. The push is one eighth note: the number is `1/8`.",
          "code.time-fraction-string":
            "In quotes, `1/8` is read as a pattern and nothing moves. Write the number bare: `.early(1/8)`.",
        },
        hints: ladder(
          "Every Rhodes chord should start one eighth note before its bar line. Which call moved the Rhodes ahead in the loop you tapped?",
          "The call is `.early()`, and its number is a share of the bar: an eighth note is one eighth of a bar of 4/4.",
          'The line begins `chord(changes).voicing().early(` and ends `.s("rhodes")`. Only the number is missing.',
        ),
        tests: [
          { name: "reference", response: { code: S5_SOLUTION }, expect: "pass" },
          {
            name: "the call before the voicing",
            response: { code: s5('chords: chord(changes).early(1/8).voicing().s("rhodes")') },
            expect: "pass",
          },
          {
            name: "the amount as a decimal: .125",
            response: { code: s5(chords(".early(.125)")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s5(chords()) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            // An eighth after the bar line: every onset is in another place.
            name: "late for early",
            response: { code: s5(chords(LATE_8)) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            // A quarter early: every target onset still falls inside the same chord, so only the shift names it.
            name: "a quarter early: the push too big",
            response: { code: s5(chords(".early(1/4)")) },
            expect: "fail",
            feedback: ["harmony.shifted"],
          },
          {
            name: "the fraction in quotes: nothing moves",
            response: { code: s5(chords('.early("1/8")')) },
            expect: "fail",
            feedback: ["code.time-fraction-string"],
          },
          {
            // The right eighth, the wrong chord: each chord now sounds a bar behind the bass.
            name: "seven eighths late: the chord of the bar before",
            response: { code: s5(chords(".late(7/8)")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "one note a bar, pushed: the timing right, the chords gone",
            response: { code: s5('chords: note("<a4 d4 g4 c4>").early(1/8).s("rhodes")') },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the bass pushed as well",
            response: {
              code: s5(chords(EARLY_8)).replace(
                '.struct("x ~ ~ ~ x ~ x ~")',
                '.struct("x ~ ~ ~ x ~ x ~").early(1/8)',
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "After the beat",
      minutes: 0.75,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "after-the-beat",
        version: 1,
        role: "check",
        prompt:
          "The organ plays a short chord on every beat. Move all four one eighth note later with `.late()`, the same move the other way. Put the call after `.struct()` and before `.s()`. Done when every organ chord lands on the “and” after its beat.",
        skills: [{ skill: "R10", w: 1 }],
        code: { starter: S6_STARTER },
        reference: { solutions: [S6_SOLUTION], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Not there yet. Every organ chord should land an eighth note after its beat, with the chord of its own bar: `.late(1/8)`, written after `.struct()`, so the rhythm moves and not the chords under it. With `.early(1/8)` the last chord of each bar would already be the next bar's.",
          "code.time-fraction-string":
            "In quotes, `1/8` is read as a pattern and nothing moves. Write the number bare: `.late(1/8)`.",
        },
        hints: ladder(
          "The chords should come after each beat, not before it. Which of the two calls does that?",
          "`.late(1/8)` moves the whole line an eighth note later. It goes after `.struct()` and before `.s()`.",
          'The line begins `chord(changes).voicing().struct("x x x x")` and goes on `.s("organ")`. The call between them starts `.late(`.',
        ),
        tests: [
          { name: "reference", response: { code: S6_SOLUTION }, expect: "pass" },
          {
            name: "the call before the rhythm",
            response: {
              code: s6('chords: chord(changes).voicing().late(1/8).struct("x x x x").s("organ").clip(.5)'),
            },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the amount as a decimal: .125",
            response: { code: s6(organ(".late(.125)")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s6(organ("")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            // The same four "ands", but the last one of each bar already plays the next bar's chord.
            name: "early for late",
            response: { code: s6(organ(EARLY_8)) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the fraction in quotes: nothing moves",
            response: { code: s6(organ('.late("1/8")')) },
            expect: "fail",
            feedback: ["code.time-fraction-string"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "ear",
      title: "On the beat or pushed",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "on-the-beat-or-pushed",
        version: 1,
        role: "check",
        prompt:
          "Four grooves, two bars each, two chords a bar. The drums and bass stay on the beat. For each groove, pick whether the chords land on the beat with the bass, or are pushed ahead of it.",
        skills: [{ skill: "R10", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.syncopation", mode: "seed" }],
        tests: [],
        parts: [
          earPart(
            "groove-one",
            "Groove 1, on the Rhodes.",
            earCode("<[C^7 F^7] [Dm7 G7]>", EARLY_8, "rhodes"),
            "pushed",
            PUSHED_TEXT,
          ),
          earPart(
            "groove-two",
            "Groove 2, on the piano.",
            earCode("<[Am7 Dm7] [G7 C^7]>", "", "piano"),
            "on",
            ON_TEXT,
          ),
          earPart(
            "groove-three",
            "Groove 3, on the organ. Listen closely: this one is tight.",
            earCode("<[F^7 Em7] [Dm7 G7]>", EARLY_16, "organ"),
            "pushed",
            "These chords were pushed, by a sixteenth note: each one starts a hair before the bass note it belongs to.",
          ),
          earPart(
            "groove-four",
            "Groove 4, on the Rhodes.",
            earCode("<[C^7 Am7] [F^7 G7]>", "", "rhodes"),
            "on",
            ON_TEXT,
          ),
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your pushed groove",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-pushed-groove",
        version: 1,
        role: "practice",
        prompt:
          "Push the Rhodes chords ahead of the beat with `.early()`, so at least two of them start before a beat and ring through it. Then, if you like, push the bass with them, try a sixteenth, give the chords a rhythm with `.struct()`, change the chords, or add a line on top.",
        skills: [{ skill: "R10", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "chords-off-the-beat",
            label:
              "At least two chords on the `chords:` line start between beats and ring through the next beat",
            required: true,
            skills: ["R10"],
            rule: "syncopation",
            track: "chords",
            min: 2,
          },
          {
            id: "bass-pushes-too",
            label: "At least two bass notes start between beats and ring through the next beat",
            required: false,
            skills: ["R10"],
            rule: "syncopation",
            track: "bass",
            min: 2,
          },
          {
            id: "groove-tempo",
            label: "A tempo from 84 to 108 BPM",
            required: false,
            skills: ["R10"],
            rule: "tempo-bpm",
            min: 84,
            max: 108,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Check that line against the item, then run it again.",
        },
        hints: ladder(
          "The Rhodes should reach each new chord before the bass does. Which line gets the call?",
          "The Rhodes line takes the call: `.early()` after `.voicing()`, with a share of the bar as its number.",
          "`.early(1/8)` puts every chord on the “and” after beat 4. For a tighter push, try a sixteenth.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the Rhodes an eighth note early",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: its own chords with a rhythm, the bass and a kick pushing with them, a tune",
            response: {
              code: `setcpm(92/4)\n\n${changes("<F^7 Em7 Dm7 G7>")}\n\n${[
                'kick: s("bd ~ ~ ~ bd ~ ~ bd")',
                SNARE,
                HATS,
                'bass: chord(changes).rootNotes(2).struct("x ~ ~ ~ x ~ ~ ~").early(1/8).s("fingerbass").lpf(800)',
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ ~ ~").early(1/8).s("rhodes")',
                'mel: n("<[~ 4 ~ 2] [~ 4 ~ 1] [~ 3 ~ 0] [~ 1 2 ~]>").scale("C5:major").s("piano")',
              ].join("\n")}`,
            },
            expect: "pass",
          },
          {
            name: "only the bass pushed: the chords still on the beat",
            response: {
              code: MAKE_STARTER.replace(
                '.struct("x ~ ~ ~ x ~ x ~")',
                '.struct("x ~ ~ ~ x ~ x ~").early(1/8)',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            // A longer push is still a push: the chord lands on beat 4 and holds across the bar line.
            name: "a whole beat early",
            response: { code: groove(MAKE_LOOP, chords(".early(1/4)")) },
            expect: "pass",
          },
          {
            name: "two chords a bar, both still on the beat",
            response: { code: groove(MAKE_LOOP, chords("", "rhodes", '.struct("x ~ ~ ~ x ~ ~ ~")')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
