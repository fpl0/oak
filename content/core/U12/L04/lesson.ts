// U12.L04 Diatonic Sevenths in Major. Stack four notes on each degree of a major key and the seventh chords
// come out in a fixed order: Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7. Two major sevenths (I and IV), three minor
// sevenths (ii, iii, vi), one half-diminished (vii) and exactly one dominant seventh, on V: which is why a
// dominant seventh tells the ear where home is. What the learner has: the triad on every degree (U06.L01:
// major, minor, minor, major, major, minor, diminished), the stack `n("[0,2,4,6]")` (U06.L10), Roman numerals
// (U06.L02), all five sevenths by name (U11.L04, U12.L01, U12.L03), the dominant seventh by ear (U12.L02). Not
// yet: the same walk in minor and the guide tones (U12.L05), left-hand voicings (U12.L06), dominant sevenths
// on other degrees on purpose (U15). Spec: content/specs/U12.md.
//
// How it is graded (AUTHORING §17, §19): numerals with sevenths are an `rn-palette` with `allow: ["sevenths"]`,
// read by degree and quality, never as text (`V` for `V7` is `harmony.rn-quality`); the Play from the page step
// writes `changes` by name and is graded as chords, pitch classes and lowest note per onset (`pcset`, `bass:
// true`). The ear step is three trials of `fam.har.progression` at level 5 and is not one of the graded checks.
// The Make's one required rule is `chord-qualities` at seventh depth with `contains: ["maj7", "m7", "7"]`: the
// starter's four bars of Cmaj7 fail it, a loop without the dominant seventh fails it.
import { defineLesson, type HintLadder, type LeadSheetSpec } from "@oak/content-kit";

const BPM = 92;
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
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
/** The root of every chord, low on the upright: the voicing above does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const mel = (pattern: string, scale = "C4:major") => `mel: n("${pattern}").scale("${scale}").s("piano")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/** The hook: the key's sevenths walked up from Cmaj7 to Fmaj7 and back down, one a bar. */
const HOOK = loop("<C^7 Dm7 Em7 F^7 F^7 Em7 Dm7 C^7>");

/** S2: the stack of Seventh Colour on degree 1, then moved to degree 5 (`n` 4): C E G B, then G B D F. */
const STACK_ON_FIVE = code('chords: n("[0,2,4,6]").add(n("<0 4>")).scale("C3:major").s("rhodes")');
/** S3: the same stack on every degree, one a bar: maj7 m7 m7 maj7 7 m7 m7♭5. */
const SEVEN_STACKS = code('chords: n("[0,2,4,6]").add(n("<0 1 2 3 4 5 6>")).scale("C3:major").s("rhodes")');

/** S4: the loop of U12.L01, Cmaj7 Am7 Dm7 G7, shown in chord names. */
const SOUL_LOOP = loop("<C^7 Am7 Dm7 G7>");

/**
 * S5, Play from the page: a tune in G major whose every bar is three notes of the chord under it (B D B over
 * Gmaj7, C E C over Am7, D F♯ D over Bm7, E G over Cmaj7). The page shows the tune; the prompt gives the
 * numerals Imaj7 ii7 iii7 IVmaj7.
 */
const PAGE_TUNE = mel("<[2 ~ 4 2] [3 ~ 5 3] [4 ~ 6 4] [5 ~ 7 ~]>", "G4:major");
const page = (form: string) => loop(form, PAGE_TUNE);
const PAGE_STARTER = page("<⟪G^7 G^7 G^7 G^7⟫>");
const PAGE_SOLUTION = page("<G^7 Am7 Bm7 C^7>");
/**
 * The lead sheet: the tune, and only the first bar's symbol (the starter already holds it); the other three would
 * give the answer away, so the page shows numerals for them in the prompt.
 */
const LEAD_SHEET: LeadSheetSpec = {
  melody: "mel",
  chords: { chart: [{ bar: 1, beat: 1, symbol: "G^7" }] },
  title: "Four bars in G",
};

/**
 * The Make: four bars of Cmaj7 with a tune that also fits I vi IV V in sevenths (G E G | E C | C E C | B G),
 * so the learner can change the chords without the tune fighting them.
 */
const MAKE_TUNE = mel("<[4 ~ 2 4] [2 ~ 0 ~] [0 ~ 2 0] [6 ~ 4 ~]>");
const MAKE_STARTER = loop("<C^7 C^7 C^7 C^7>", MAKE_TUNE);
const MAKE_MINIMAL = loop("<C^7 Am7 F^7 G7>", MAKE_TUNE);

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const G_MAJOR = { tonic: "G", mode: "major" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const LEAD = { roll: false, staff: "lead", keyboard: false } as const;

export default defineLesson({
  id: "U12.L04",
  version: 4,
  title: "Diatonic Sevenths in Major",
  objective:
    "I can name the seventh chord on every degree of a major key, Imaj7 to viiø7, and write them by name.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C08"],
  practises: [],
  terms: [],
  canDo: ["cd.read.diatonic-sevenths"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The staircase",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "the-staircase",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the chords climb four steps of C major and come back down, one chord a bar, every note from the key. Listen for the colour of each step: which chords sound bright, and which sound softer?",
        skills: [{ skill: "C08", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Up four steps of C major and back down, one chord a bar.", bars: 8 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "The stack on 5",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "the-stack-on-five",
        version: 1,
        role: "practice",
        prompt:
          'Predict which kind of seventh chord G B D F is, then run it. The stack from Seventh Colour, `n("[0,2,4,6]")`, plays on degree 1, then `.add()` moves it to degree 5 (`n` counts from 0, so degree 5 is `n` 4).',
        skills: [{ skill: "C08", w: 1 }],
        hints: null,
        tests: [],
        code: STACK_ON_FIVE,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "dominant", label: "A dominant seventh, like the G7 of your blues" },
          { id: "major", label: "A major seventh chord, like Cmaj7" },
          { id: "minor", label: "A minor seventh chord, like Dm7" },
        ],
        correct: ["dominant"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Seven degrees, seven sevenths",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "seven-stacks", code: SEVEN_STACKS, bars: 7 },
      exercise: {
        kind: "run-investigate",
        id: "seven-degrees-seven-sevenths",
        version: 1,
        role: "practice",
        prompt:
          "Run the code and read the seven chord names in the chord band, bar by bar, degree 1 to degree 7. Then answer both questions: how many of the seven are major seventh chords, and which degree gets the half-diminished seventh.",
        skills: [{ skill: "C08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the band bar by bar. maj7 after a capital letter is a major seventh chord; a plain 7 is the dominant seventh, a kind of its own. For the dark one, find the name with m7♭5 in it.",
        },
        hints: ladder(
          "The triads on these degrees were major, minor, minor, major, major, minor, diminished. What does one more 3rd add to each?",
          "A major seventh chord needs a major triad and a 7th a half step under the octave. Three triads are major; one of them gets the ♭7 instead.",
          "Bar 5 is G7: a major triad, but a dominant seventh. Count the maj7s without it, then find the bar whose triad is diminished.",
        ),
        code: { starter: SEVEN_STACKS },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many of the seven are major seventh chords?", correct: 2 },
          {
            q: "choice",
            prompt: "Which degree gets the half-diminished seventh?",
            options: [
              { id: "seven", label: "Degree 7: Bm7♭5" },
              { id: "two", label: "Degree 2: Dm7♭5" },
              { id: "five", label: "Degree 5: Gm7♭5" },
            ],
            correct: ["seven"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 2, choice: ["seven"] } }, expect: "pass" },
          {
            name: "three: G7 counted as a major seventh chord",
            response: { answer: { number: 3, choice: ["seven"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "degree 2: the half-diminished of the minor key, not this one",
            response: { answer: { number: 2, choice: ["two"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Number the soul loop",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "number-the-soul-loop",
        version: 1,
        role: "check",
        prompt:
          "Fill the four slots, in order, with the numeral of each chord of the loop from Major 7 & Minor 7, in C major: Cmaj7, Am7, Dm7, G7. Give each numeral its seventh ending, such as maj7 or 7.",
        skills: [
          { skill: "C08", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        hints: ladder(
          "Each slot needs a numeral for the degree and an ending for the kind of seventh. On which degree of C major does each chord stand?",
          "C is 1, A is 6, D is 2, G is 5. The case of the numeral follows the triad; the ending follows the kind of seventh.",
          "The first chord is Imaj7, a capital I with maj7. A minor seventh chord is lower case with a plain 7.",
        ),
        stimulus: { src: "code", code: SOUL_LOOP, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["sevenths"] },
        correct: { rn: ["Imaj7", "vi7", "ii7", "V7"] },
        srs: [
          { family: "fam.har.rn", mode: "review-if-due" },
          { family: "fam.har.function", mode: "review-if-due" },
        ],
        tests: [
          {
            name: "Imaj7 vi7 ii7 V7",
            response: { answer: { rn: ["Imaj7", "vi7", "ii7", "V7"] } },
            expect: "pass",
          },
          {
            name: "V for V7: the 7th left off",
            response: { answer: { rn: ["Imaj7", "vi7", "ii7", "V"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "I7 for Imaj7: a dominant seventh on 1",
            response: { answer: { rn: ["I7", "vi7", "ii7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "iii7 for vi7: counted from the wrong note",
            response: { answer: { rn: ["Imaj7", "iii7", "ii7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.5,
      graded: true,
      // U12's "Play from the page" (AUTHORING §4): the tune is shown only as a lead sheet, with no chord symbols;
      // the numerals are in the prompt and the key signature says the key.
      ui: { panels: LEAD, leadSheet: LEAD_SHEET, band: DRUMS },
      example: { id: "the-page", code: code(PAGE_TUNE), bars: 4 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        key: G_MAJOR,
        prompt:
          "Write the four chords of the page by name in `changes`, one per bar. The tune is in G major (one sharp, F♯), and the numerals are Imaj7, ii7, iii7, IVmaj7. Bar 1, `G^7`, is already right; the starter repeats it in every bar.",
        skills: [{ skill: "C08", w: 1 }],
        code: { starter: PAGE_STARTER },
        reference: { solutions: [PAGE_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the page wants {exp}. Count up G major from G, then give each degree the seventh the key gives it.",
        },
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        hints: ladder(
          "Which letters stand on degrees 1, 2, 3 and 4 of G major?",
          "G, A, B and C. Degrees 1 and 4 get a major seventh chord, written `^7` after the letter; 2 and 3 get a minor seventh chord, `m7`.",
          "Bar 1 stays as it is and bar 2 is `Am7`. Bars 3 and 4 follow the same two rules.",
        ),
        tests: [
          { name: "reference", response: { code: PAGE_SOLUTION }, expect: "pass" },
          {
            name: "each bar in brackets",
            response: { code: page("<[G^7] [Am7] [Bm7] [C^7]>") },
            expect: "pass",
          },
          {
            name: "unchanged: Gmaj7 in every bar",
            response: { code: page("<G^7 G^7 G^7 G^7>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "C7 for C^7: IV gets a major seventh",
            response: { code: page("<G^7 Am7 Bm7 C7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Bm7b5 for Bm7: iii is minor, vii is the half-diminished",
            response: { code: page("<G^7 Am7 Bm7b5 C^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the numerals read in C: Cmaj7 Dm7 Em7 Fmaj7",
            response: { code: page("<C^7 Dm7 Em7 F^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            // `Gmaj7` is how the name is printed, not how Strudel reads it: the lint names the spelling.
            name: "Gmaj7 written as on paper",
            response: { code: page("<Gmaj7 Am7 Bm7 C^7>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Sevenths by ear",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "sevenths-by-ear",
        version: 1,
        role: "practice",
        prompt:
          "Fill in the four numerals of each of three loops, each in a new key and built from that key's own seventh chords. For every bar, find the bass note's degree first; the degree tells you the kind of seventh.",
        skills: [{ skill: "E09", w: 1 }],
        hints: ladder(
          "Which chord is home? Hum the bass of each bar and count from there.",
          "Find each bass note's degree first; the key gives every degree one kind of seventh, so the degree tells you the rest.",
          "Degrees 1 and 4 take maj7, degree 5 takes the plain 7, and 2, 3 and 6 are minor sevenths in lower case.",
        ),
        // A four-bar loop of the key's sevenths in a new key per trial (level 5, `sevenths`, opens here).
        stimulus: { src: "generator", family: "fam.har.progression", level: 5 },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["sevenths"] },
        correct: {},
        srs: [{ family: "fam.har.progression", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your staircase",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-staircase",
        version: 1,
        role: "practice",
        prompt:
          "Write your song's intro and outro: change the four bars of Cmaj7 in `changes` into a loop of C major's own seventh chords, by name. Walk by step like the hook, or jump. Use at least one major seventh, one minor seventh and the dominant seventh, G7. Four bars, or eight: the song plays the first four.",
        skills: [{ skill: "C08", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "three-kinds",
            label:
              "On the chords line, at least one major seventh (`^7`), one minor seventh (`m7`) and one dominant seventh (`7`)",
            required: true,
            skills: ["C08"],
            rule: "chord-qualities",
            track: "chords",
            contains: ["maj7", "m7", "7"],
            depth: "seventh",
          },
          {
            id: "all-in-c",
            label: "Every note on the chords line belongs to C major",
            required: false,
            skills: ["C08"],
            rule: "in-key",
            key: { tonic: "C", mode: "major" },
            tracks: ["chords"],
            minRatio: 1,
          },
          {
            id: "v7-goes-home",
            label: "The dominant seventh, G7, goes straight on to a C chord",
            required: false,
            skills: ["H02"],
            rule: "contains-rn",
            rn: ["V7"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "tune-from-the-chords",
            label: "A `mel` line whose notes on strong beats are mostly notes of the chord under them",
            required: false,
            skills: ["M03"],
            rule: "chord-tones-strong",
            melody: "mel",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.6,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Change the code until this line of the checklist holds.",
        },
        hints: ladder(
          "Your loop needs three kinds of seventh chord, all from C major. Which degrees give a major seventh, which a minor seventh, and which the dominant seventh?",
          "All four chords live in `changes`. 1 and 4 are maj7, 2, 3 and 6 are m7, and 5 is the dominant seventh: write each by name.",
          'Try `"<C^7 Am7 ...>"` and keep going: one chord on 4, then the dominant seventh in the last bar so the loop leans home.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: Cmaj7 Am7 Fmaj7 G7", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: eight bars that walk and jump, comped, with a tune of its own",
            response: {
              code: code(
                changes("<C^7 Dm7 Em7 F^7 Em7 Am7 Dm7 G7>"),
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("rhodes")',
                BASS,
                mel("<[4 ~ 2 0] [3 ~ 5 ~] [4 ~ 6 4] [2 ~ 0 ~] [6 ~ 4 2] [4 ~ 2 0] [5 ~ 3 1] [3 ~ 1 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "no dominant seventh: Cmaj7 Am7 Fmaj7 Dm7",
            response: { code: loop("<C^7 Am7 F^7 Dm7>", MAKE_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "G as a plain triad",
            response: { code: loop("<C^7 Am7 F^7 G>", MAKE_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
