// U12.L05 Sevenths in Minor & Guide-Tone Preview. A minor key has its own seven sevenths: i7 iiø7 IIImaj7 iv7
// v7 VImaj7 VII7, with V7 from harmonic minor (U10.L06). And through a chain of sevenths whose roots fall a 5th
// runs a thread: the 3rd of one chord stays to become the 7th of the next, and that 7th falls a step (a half
// step from G7 to Cmaj7, a whole step from Fmaj7 to Bm7♭5) to become the next 3rd. Those two notes, the 3rd and the 7th, are the guide tones. What the learner has: the
// sevenths on every degree of a major key (U12.L04), the half-diminished seventh (U12.L03), minor-key numerals
// (U10.L04, U10.L06), chord tones on strong beats (U07.L03). Not yet: voicing the thread with left-hand
// voicings (U12.L06), the chain's own name and the guide-tone dictionary (the jazz track). Spec:
// content/specs/U12.md.
//
// How it is graded (AUTHORING §17, §19): numerals with sevenths are an `rn-palette` with `allow: ["sevenths"]`
// in A minor, read by degree and quality; the thread the learner finishes note by note is an `events` match in
// absolute pitch on `mel`. The Make's one required rule is `guide-tones` (`at: "bar"`, `minRatio: 1`): the
// note sounding on beat 1 of every bar, the repeated Am7 of bar 8 included, is that bar's chord's 3rd or 7th, as
// the brief says. The starter's held A meets it in two of eight bars (the 3rd of Fmaj7, the 7th of Bm7♭5) and fails. The sung step is a degree line
// in C over the cycle's first four chords (`mode: "degree"`): the spec's `mode: "guide-tones"` is still a
// planned feature (`sing.guide-tones`), and the degree mode sings the same four notes and is graded today.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
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
/** The tune in note names, so any note of a chord can be written, G♯ and G alike. */
const mel = (pattern: string) => `mel: note("${pattern}").s("piano")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/**
 * The cycle: roots falling a 5th each bar, Dm7 G7 Cmaj7 Fmaj7 Bm7♭5 E7 Am7, home held for two bars. On top,
 * the thread, one long note a bar above the Rhodes: F (3rd of Dm7), F (7th of G7), E (3rd of Cmaj7), E (7th
 * of Fmaj7), D (3rd of Bm7♭5), D (7th of E7), C (3rd of Am7).
 */
const CYCLE = "<Dm7 G7 C^7 F^7 Bm7b5 E7 Am7 Am7>";
const THREAD = mel("<f5 f5 e5 e5 d5 d5 c5 c5>");
const CYCLE_ONLY = loop(CYCLE);
const HOOK = loop(CYCLE, THREAD);

/** S2: Dm7, then G7. */
const DM7_THEN_G7 = code('chords: chord("<Dm7 G7>").voicing().s("rhodes")');
/** S3: the first four bars of the cycle with the thread. */
const FIRST_FOUR = loop("<Dm7 G7 C^7 F^7>", mel("<f5 f5 e5 e5>"));

/** S4: a minor loop in chord names. */
const MINOR_LOOP = loop("<Am7 Dm7 Bm7b5 E7>");

/** S5: the cycle's last four bars; the thread starts on D and the learner finishes it. */
const turn = (pattern: string) => loop("<Bm7b5 E7 Am7 Am7>", mel(pattern));
const THREAD_STARTER = turn("<d5 ⟪d5 d5 d5⟫>");
const THREAD_SOLUTION = turn("<d5 d5 c5 c5>");

/** S6: the first four bars again, in C here: fa fa mi mi over Dm7 G7 Cmaj7 Fmaj7. */
const SING = FIRST_FOUR;

/**
 * The Make: the eight-bar cycle with its bass, and a tune that is one A a bar. A is the 3rd of Fmaj7 and the 7th
 * of Bm7♭5, so it starts two of the eight bars on a guide tone.
 */
const MAKE_STARTER = loop(CYCLE, mel("a4"));

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const A_MINOR = { tonic: "A", mode: "minor" } as const;
/** The cycle's first four chords are ii7 V7 Imaj7 IVmaj7 of C major: the sung step is in C. */
const C_MAJOR = { tonic: "C", mode: "major" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U12.L05",
  version: 4,
  title: "Sevenths in Minor & Guide-Tone Preview",
  objective:
    "I can number the seventh chords of a minor key and follow the 3rds and 7ths as a thread through a chain of sevenths.",
  key: A_MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["C08"],
  terms: [{ id: "term.guide-tones", step: "S3" }],
  canDo: ["cd.hear.guide-tones"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Falling fifths",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "falling-fifths",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops: the eight chords alone, then the same chords with one long note a bar on top. In loop 2, listen for that top note: how far does it move while the chords travel?",
        skills: [{ skill: "C08", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: CYCLE_ONLY, caption: "Loop 1: eight chords, each root a 5th below the last.", bars: 8 },
          { code: HOOK, caption: "Loop 2: the same chords, with one long piano note a bar on top.", bars: 8 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "The note that stays",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "the-note-that-stays",
        version: 1,
        role: "practice",
        prompt:
          "Predict the one note that is both the note making Dm7 minor and the note making G7 lean, then run it. Dm7 is D F A C; G7 is G B D F.",
        skills: [{ skill: "C08", w: 1 }],
        hints: null,
        tests: [],
        code: DM7_THEN_G7,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "f", label: "F: the 3rd of Dm7, then the 7th of G7" },
          { id: "d", label: "D: the root of Dm7, then the 5th of G7" },
          { id: "c", label: "C: the 7th of Dm7, gone from G7" },
        ],
        correct: ["f"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Follow the thread",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords", "chord-tones"] },
      example: { id: "first-four", code: FIRST_FOUR, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "follow-the-thread",
        version: 1,
        role: "practice",
        prompt:
          "Run the code with the chord-tone lens open: it marks which member of each chord every note is. The top line plays F, F, E, E. Answer both questions: which member it is in each bar, and how many half steps it moves from G7 to Cmaj7.",
        skills: [{ skill: "C08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count up each chord from its root: F is the 3rd of Dm7 (D, F) and the 7th of G7 (G, B, D, F). For the move, go from F down to E one key at a time.",
        },
        hints: ladder(
          "Over each chord, count from the bass note up to the top note. Which member do you land on?",
          "Dm7 is D F A C and G7 is G B D F; Cmaj7 is C E G B and Fmaj7 is F A C E. Find F in the first two and E in the last two.",
          "In bar 1 F is the 3rd. In bar 2 the same F is the last note of G7. For the move, E is the white key right under F.",
        ),
        code: { starter: FIRST_FOUR },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which member of each chord does the top line play, bar by bar?",
            options: [
              { id: "3-7-3-7", label: "3rd, 7th, 3rd, 7th" },
              { id: "1-5-1-5", label: "Root, 5th, root, 5th" },
              { id: "7-3-7-3", label: "7th, 3rd, 7th, 3rd" },
            ],
            correct: ["3-7-3-7"],
          },
          { q: "number", prompt: "How many half steps does the line move from G7 to Cmaj7?", correct: 1 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["3-7-3-7"], number: 1 } },
            expect: "pass",
          },
          {
            name: "root and 5th",
            response: { answer: { choice: ["1-5-1-5"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two half steps: a whole step, F to E♭",
            response: { answer: { choice: ["3-7-3-7"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Number it in minor",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "number-it-in-minor",
        version: 1,
        role: "check",
        key: A_MINOR,
        prompt:
          "Fill the four slots, in order, with the numeral of each chord of this A minor loop: Am7, Dm7, Bm7♭5, E7. Count the degrees from A, and give each numeral its seventh ending.",
        skills: [
          { skill: "C08", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        hints: ladder(
          "Home is A now, not C. On which degree of A minor does each chord stand?",
          "A is 1, D is 4, B is 2, E is 5. Lower case for a minor triad; the half-diminished takes ø7; E7 has the raised 7, G♯, from harmonic minor.",
          "Am7 is i7 and Dm7 is iv7. The chord on 2 is half-diminished, and the chord on 5 is a dominant seventh with a capital V.",
        ),
        stimulus: { src: "code", code: MINOR_LOOP, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["sevenths"] },
        correct: { rn: ["i7", "iv7", "iiø7", "V7"] },
        srs: [
          { family: "fam.har.rn", mode: "review-if-due" },
          { family: "fam.chd.quality-7th", mode: "review-if-due" },
        ],
        // The catalog names a numeral counted from C as "built on degree 6 (Fm7)", a chord this loop does not
        // have, and calls v7 against V7 a slip of case; these count from A and name the raised 7.
        feedbackText: {
          "harmony.rn-degree":
            "Chord {slot}: {got} does not fit {expChord} here. Count from A, this key's home: A is 1, B is 2, C is 3, D is 4, E is 5.",
          "harmony.rn-case":
            "Chord {slot}: {got} is close; it is {exp}. E7 has G♯, the raised 7 of harmonic minor, so the triad on 5 is major: a capital V.",
        },
        tests: [
          {
            name: "i7 iv7 iiø7 V7",
            response: { answer: { rn: ["i7", "iv7", "iiø7", "V7"] } },
            expect: "pass",
          },
          {
            name: "ii7 for iiø7: the 5th not lowered",
            response: { answer: { rn: ["i7", "iv7", "ii7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "v7 for V7: natural minor's chord on 5",
            response: { answer: { rn: ["i7", "iv7", "iiø7", "v7"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
          {
            name: "vi7 for i7: counted from C, the relative major's home",
            response: { answer: { rn: ["vi7", "iv7", "iiø7", "V7"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Finish the thread",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "finish-the-thread",
        version: 1,
        role: "check",
        prompt:
          "Finish the thread on the `mel` line: change its last three notes, one a bar, over E7, Am7 and Am7. Each note must be the 3rd or the 7th of its chord, and stay put or move one step from the note before. Bar 1 stays D, the 3rd of Bm7♭5.",
        skills: [{ skill: "C08", w: 1 }],
        code: { starter: THREAD_STARTER },
        reference: { solutions: [THREAD_SOLUTION], bars: 4 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: you have {got} ({gotSyl}); the thread has {exp} ({expSyl}). Over each chord take its 3rd or its 7th, whichever is nearest the note before.",
          "melody.octave":
            "Bar {bar}: the right note in the wrong octave. The thread stays close: from D it moves by a step, not a leap.",
        },
        hints: ladder(
          "Start with bar 2, over E7. The thread is on D: is D the 3rd or the 7th of E7? If it is, the thread can stay.",
          "E7 is E G♯ B D: D is its 7th, so bar 2 keeps D. Am7 is A C E G: which of its 3rd and 7th is a step from D?",
          "Bar 2 is D again. In bars 3 and 4 the thread falls one step, to the 3rd of Am7, and stays there.",
        ),
        tests: [
          { name: "reference", response: { code: THREAD_SOLUTION }, expect: "pass" },
          { name: "the last two written with !", response: { code: turn("<d5 d5 c5!2>") }, expect: "pass" },
          {
            name: "unchanged: D held through",
            response: { code: turn("<d5 d5 d5 d5>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the roots: B E A A",
            response: { code: turn("<d5 e5 a4 a4>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "G♯, the other guide tone of E7: a leap, not the thread",
            response: { code: turn("<d5 g#4 c5 c5>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "C an octave down",
            response: { code: turn("<d5 d5 c4 c4>") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the thread",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-thread",
        version: 1,
        role: "practice",
        key: C_MAJOR,
        prompt:
          "Sing the thread over the first four chords: four long notes, one a bar, fa, fa, mi, mi (4, 4, 3, 3). Dm7, G7, Cmaj7 and Fmaj7 all live in C major, so do is C here. Hear it first, and sing in your own range.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "C08", w: 0.4 },
        ],
        hints: [
          { text: "Hum fa first, over Dm7, and hold it while the chord under you changes." },
          { text: "Mi is the smallest step down from fa: one half step, as the 7th of G7 falls into Cmaj7." },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        // One note a bar (the rhythm is one bar long and repeats): fa over Dm7 and G7, mi over Cmaj7 and Fmaj7.
        target: { from: "degrees", degrees: ["4", "4", "3", "3"], rhythm: "x", octaves: [0, 0, 0, 0] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your guide-tone line",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords", "chord-tones"] },
      exercise: {
        kind: "code-make",
        id: "your-line-through-the-cycle",
        version: 1,
        role: "practice",
        prompt:
          "Write the tune for the first eight bars of your song's bridge: replace the one A a bar on the `mel` line. Start every bar on its chord's 3rd or 7th, then fill the rest of the bar as you like: passing notes, a rhythm, a leap. Let the line fall slowly, the way the thread does.",
        skills: [{ skill: "C08", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "starts-on-guide-tones",
            label: "All eight bars of the `mel` line start on the chord's 3rd or 7th",
            required: true,
            skills: ["C08"],
            rule: "guide-tones",
            track: "mel",
            harmony: "chords",
            minRatio: 1,
            at: "bar",
            // Corrections gate (AS-22): judged against the given cycle, so rewriting it under the tune changes nothing.
            changes: ["Dm7", "G7", "C^7", "F^7", "Bm7b5", "E7", "Am7", "Am7"],
          },
          {
            id: "ends-at-home",
            label: "The `mel` line's last note is degree 1, A",
            required: false,
            skills: ["M03"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "mel",
          },
        ],
        // Corrections gate: no "not yet." override; the rule names the bar, the chord and its guide tones.
        hints: ladder(
          "Each bar's first note must be one of its chord's two guide tones. Over Dm7, the first bar, which two notes are they?",
          "Each bar's first note should be its chord's 3rd or 7th: F or C over Dm7, B or F over G7, E or B over Cmaj7, and so on. The chord-tone lens marks them.",
          "Start from the thread you heard, one long note a bar, then give each bar a few more notes after its first. Bar 1 can begin F, then fall through E and D.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the thread itself", response: { code: HOOK }, expect: "pass" },
          {
            name: "beyond the brief: a line that starts on the thread and fills every bar",
            response: {
              code: loop(
                CYCLE,
                mel(
                  "<[f5 ~ e5 d5] [f5 d5 b4 g4] [e5 ~ g5 b5] [e5 c5 a4 c5] [d5 ~ f5 a5] [d5 b4 g#4 b4] [c5 e5 b4 g4] [c5 b4 a4@2]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "a tune on every root",
            response: { code: loop(CYCLE, mel("<d5 g4 c5 f4 b4 e4 a4 a4>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the thread with a root in bar 1 and in bar 8: two bars start on D and A",
            response: { code: loop(CYCLE, mel("<d5 f5 e5 e5 d5 d5 c5 a4>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "other guide tones than the thread's, each bar starting on one, a rhythm after it",
            response: {
              code: loop(
                CYCLE,
                mel(
                  "<[c5 ~ d5 e5] [b4 ~ a4 g4] [b4 a4 g4 e4] [e5 d5 c5 a4] [a4 b4 c5 d5] [g#4 ~ b4 d5] [g5 e5 c5 ~] [c5@3 a4]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "the thread, each move made a beat early, on beat 4 of the bar before",
            response: {
              code: loop(CYCLE, mel("<f5 [f5 ~ ~ e5] e5 [e5 ~ ~ d5] d5 [d5 ~ c5 b4] c5 [g5 e5 c5 a4]>")),
            },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
