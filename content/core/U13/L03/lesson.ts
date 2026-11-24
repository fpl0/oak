// U13.L03 Ties Across the Beat. A note can last longer than the beat it starts on. A dot makes a note half as
// long again: a dotted quarter is three eighths. A tie joins two notes of the same pitch into one sound across a
// beat or a bar line. Together they are how a page writes a push: the note that arrives early is tied over to the
// beat it belongs to. In code both are one thing, a note's share of the bar, written with `@`. What the learner
// has: `@` and `_` and quarter, half and whole notes (U01.L05), Ode to Joy's first phrase in plain quarters
// (U02.L08, U03.L09), the push by ear and in code (U13.L01), lead sheets (U07.L09). Not yet: compound meter, whose
// beat is a dotted quarter (U13.L04), triplets (U13.L05), double dots and ties inside chords (never in the core).
// Spec: content/specs/U13.md.
//
// Repertoire (contracts §2.8): song.ode-to-joy (L. van Beethoven, Symphony No. 9, 1824; US-PD), bars 12–16 of
// the theme in C, used in its written rhythm for the first time (the repertoire entry's usedIn lists U13.L03).
// Bar 12: C D G(below) E, the E entering on beat 4 and tied over the bar line; bar 13: (E) E F G; bar 14: G F E D;
// bar 15: C C D E; bar 16: D (dotted quarter) C (eighth) C (half). In `n` over C4:major that is
// `<[0 1 -3 2@2 2 3 4]@2 [4 3 2 1] [0 0 1 2] [1@3 0 0@4]>`: the first item is a two-bar bracket, so `2@2` starts
// on beat 4 of bar 12 and ends after beat 1 of bar 13. The flat setting the learner knows from U02 plays every
// note a quarter long and bar 16 as D C C (half), as U02.L08 flattened bar 4's dotted figure into two quarters.
// Harmony: C then G in bar 12, C, G, C, and G then C in bar 16: the tied E sounds over G and belongs to the C of
// bar 13, an anticipation of the next chord.
//
// Evaluated (headless Strudel): the hook's tune is C D G3 E | (E) E F G | G F E D | C C D E | D. C C, with the E
// at 3/4–5/4 and bar 16 at 4–35/8, 35/8–9/2, 9/2–5. The page riff `<[4@3 5@5] [4@3 2 1@2 0@2]>` plays G 0–3/8,
// A 3/8–1, G 1–11/8, E 11/8–3/2, D 3/2–7/4, C 7/4–2. The staff-writing step's `<[0@2 1@2 2@3 4@5 2@4]@2>` plays C
// and D as quarters, E 1/2–7/8, G 7/8–3/2, E 3/2–2.
//
// How it is graded: the page step is an `events` match on `mel` in absolute pitch with onsets and lengths; the
// staff-writing step compares the written notes, lengths included, with the code it shows; the quiz is a number.
// The Make's one required rule is `syncopation` on the tune: at least two notes that start between the beats
// and hold over a stronger position. A dotted quarter followed at once by its eighth does not count: the eighth
// must hold on, which is the tie this lesson is named for.
//
// Band: none (`band: false`). The Make keeps the U13.L01 rhythm section in the learner's own code (unit
// conventions; NO_BAND in content/validate/specs.test.ts). Staff examples leave the hats out (AUTHORING §6 rule 3).
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** One beat in seconds (tap tests). */
const BEAT_SEC = 60 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

/** A light groove: kick on 1 and 3, snare on 2 and 4, eight hats. */
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.4)';
const DRUMS = [KICK, SNARE, HATS] as const;
const mel = (tune: string) => `mel: n("${tune}").scale("C4:major").s("piano")`;

/** Bars 12–16 under the tune: C and G, then C, G, C, and G to C. */
const PHRASE_BASS = 'bass: n("<[0 4] 0 4 0 [4 0]>").scale("C2:major").s("fingerbass").lpf(800)';
const PHRASE_CHORDS = 'chords: chord("<[C G] C G C [G C]>").voicing().s("rhodes").gain(.6)';
/** Ode to Joy, bars 12–16, as written (see the header). */
const ODE = "<[0 1 -3 2@2 2 3 4]@2 [4 3 2 1] [0 0 1 2] [1@3 0 0@4]>";
/** The same five bars flattened, every note a quarter, bar 16 as D C C: the way the tune was first played. */
const ODE_FLAT = "<[0 1 -3 2] [2 2 3 4] [4 3 2 1] [0 0 1 2] [1 0 0@2]>";
const HOOK = code(...DRUMS, PHRASE_BASS, PHRASE_CHORDS, mel(ODE));
const FLAT = code(...DRUMS, PHRASE_BASS, PHRASE_CHORDS, mel(ODE_FLAT));

/** S2: bars 15–16 alone, the tune only. */
const ENDING = "<[0 0 1 2] [1@3 0 0@4]>";
/** S3: one bar of the ending's rhythm over the groove. */
const PREDICT = code(...DRUMS, mel("1@3 0 0@4"));
/** S4: bars 15–16 with their chords, no drums (the staff shows the tune's own lengths). */
const ENDING_PAGE = code(
  'bass: n("<0 [4 0]>").scale("C2:major").s("fingerbass").lpf(800)',
  'chords: chord("<C [G C]>").voicing().s("rhodes").gain(.6)',
  mel(ENDING),
);
/** S5: bars 12–13 on the staff, the tune alone. */
const ACROSS = code(mel("<[0 1 -3 2@2 2 3 4]@2>"));

/** S6: a two-bar soul riff over Fmaj7 and Cmaj7, read from the page and written in code. */
const RIFF = "<[4@3 5@5] [4@3 2 1@2 0@2]>";
const RIFF_BACKING = [
  ...DRUMS,
  'bass: chord("<F^7 C^7>").rootNotes(2).struct("x ~ ~ ~ x ~ ~ ~").s("fingerbass").lpf(800)',
  'chords: chord("<F^7 C^7>").voicing().s("rhodes").gain(.5)',
] as const;
const s6 = (tune: string) => code(...RIFF_BACKING, mel(tune));
/** The starter has the riff's notes in even values: G and A as halves, then four quarters. */
const RIFF_EVEN = "<[4 5] [4 2 1 0]>";
const S6_STARTER = code(...RIFF_BACKING, `mel: n("⟪${RIFF_EVEN}⟫").scale("C4:major").s("piano")`);
const PAGE_MATCH: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets+durations",
  durations: true,
  tracks: ["mel"],
};

/** S7: C D, an E three eighths long, a G that arrives on the last eighth of bar 1 and holds into bar 2, then E. */
const LEAN = "<[0@2 1@2 2@3 4@5 2@4]@2>";
const LEAN_CODE = code(mel(LEAN));

/** The Make: the U13.L01 rhythm section (the Rhodes pushed) under a tune in plain quarters. */
const MAKE_CHANGES = 'const changes = "<C^7 Am7 F^7 G7>"';
const MAKE_BASS = 'bass: chord(changes).rootNotes(2).struct("x ~ ~ ~ x ~ x ~").s("fingerbass").lpf(800)';
const MAKE_CHORDS = 'chords: chord(changes).voicing().early(1/8).s("rhodes").gain(.7)';
const make = (tune: string, hats = 'hats: s("hh*8").gain(.5)') =>
  `${TEMPO}${MAKE_CHANGES}\n\n${[KICK, SNARE, hats, MAKE_BASS, MAKE_CHORDS, mel(tune)].join("\n")}`;
const MAKE_TUNE = "<[4 2 4 5] [4 2 0 2] [3 5 4 3] [1 2 4 ~]>";
const MAKE_STARTER = make(MAKE_TUNE);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_LEAD = { roll: true, staff: "lead", keyboard: false } as const;
const LEAD = { roll: false, staff: "lead", keyboard: false } as const;
const TREBLE = { roll: false, staff: "treble", keyboard: false } as const;
const LEAD_SHEET = { melody: "mel", chords: "chords" } as const;

/** Seconds from the start of the stimulus of the given beat positions (0 = beat 1 of bar 1). */
const at = (beats: number[]) => beats.map((b) => Number((b * BEAT_SEC).toFixed(3)));

export default defineLesson({
  id: "U13.L03",
  version: 4,
  title: "Ties Across the Beat",
  objective:
    "I can read and write dotted and tied rhythms, in code with @ and on the staff, and I know how a push looks on paper.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R09", "N08"],
  practises: [],
  terms: [
    { id: "term.dotted-note", step: "S4" },
    { id: "term.tie", step: "S5" },
  ],
  canDo: ["cd.read.ties-dots"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Flat, then as written",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "hook", code: HOOK, bars: 5 },
      exercise: {
        kind: "listen",
        id: "flat-then-as-written",
        version: 1,
        role: "practice",
        prompt:
          "The notes are the same both times. Listen for where loop 2 stops marching on the beat: there are two places, one near the start of the phrase and one at its very end.",
        skills: [{ skill: "R09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: FLAT, caption: "Loop 1: every note a beat long, the way you first played it.", bars: 5 },
          {
            code: HOOK,
            caption: "Loop 2: the same notes in Beethoven's rhythm.",
            bars: 5,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Echo the ending",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "echo-the-ending",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the tune's last two bars over the click, then tap their rhythm back, one tap per note: seven taps. Bar 1 is four even notes; bar 2 goes long, short, long. Done when each tap starts a note.",
        skills: [{ skill: "R09", w: 1 }],
        hints: ladder(
          "One tap per note, seven in all. How many notes are in the second bar, and which one is the shortest?",
          "Count eighths in the second bar, 1 & 2 & 3 & 4 &. The first note lasts three of them; the second only one.",
          "Tap the first bar on the beats. In the second, tap on 1, on the “and” of 2, then on 3, and let the last note ring.",
        ),
        mode: "echo",
        stimulus: { src: "code", code: code(mel(ENDING)), bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: true, replays: -1 },
        bars: 2,
        target: { track: "mel" },
        // passF1 .9: one note missed of seven still passes; bar 2 tapped as four even beats does not.
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.9, passTiming: 0.7 },
        feedbackText: {
          "tap.missed":
            "A note went by without a tap. Bar 1 has four even notes; bar 2 has three: on 1, on the “and” of 2, and on 3.",
          "tap.extra":
            "A tap landed where a note was only ringing. The first note of bar 2 lasts a beat and a half.",
        },
        srs: [{ family: "fam.rhy.echo", mode: "review-if-due" }],
        tests: [
          { name: "the tune's rhythm", response: { taps: at([0, 1, 2, 3, 4, 5.5, 6]) }, expect: "pass" },
          {
            name: "bar 2 flattened into four beats",
            response: { taps: at([0, 1, 2, 3, 4, 5, 6, 7]) },
            expect: "fail",
          },
          { name: "one note of bar 1 missed", response: { taps: at([0, 1, 3, 4, 5.5, 6]) }, expect: "pass" },
          { name: "bar 1 only", response: { taps: at([0, 1, 2, 3]) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "predict",
      title: "Shares of the bar",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "shares-of-the-bar",
        version: 1,
        role: "practice",
        prompt:
          '`n("1@3 0 0@4")`: three notes share the bar by weight, 3 + 1 + 4, so the bar is cut into eight shares, eighth notes. Predict how long the first note lasts, then pick your answer.',
        skills: [{ skill: "R09", w: 1 }],
        hints: null,
        tests: [],
        code: PREDICT,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "three-eighths", label: "Three eighth notes: a beat and a half" },
          { id: "three-beats", label: "Three beats" },
          { id: "third", label: "A third of a beat" },
        ],
        correct: ["three-eighths"],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Half as long again",
      minutes: 1,
      ui: { panels: ROLL_LEAD, rollLabels: "none", band: false, leadSheet: LEAD_SHEET },
      example: { id: "the-ending", code: ENDING_PAGE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "half-as-long-again",
        version: 1,
        role: "practice",
        prompt:
          "Run the tune's last two bars and compare the roll with the page. Bar 2 starts with the note you just predicted, written as a quarter note with a dot after it. Answer both questions: what the dot adds, and how many eighth notes that note lasts.",
        skills: [
          { skill: "R09", w: 0.5 },
          { skill: "N08", w: 0.5 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare the roll with the page: a quarter note is two eighths, and the note on the roll lasts three. The dot pays for the third.",
        },
        hints: ladder(
          "A plain quarter note lasts one beat. How long does this one last on the roll?",
          "Count eighths along the roll: the first note of bar 2 covers three of them before the short C.",
          "A quarter is two eighths. The note is one eighth longer: what share of a quarter is that?",
        ),
        code: { starter: ENDING_PAGE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What does the dot add to the note before it?",
            options: [
              {
                id: "half",
                label: "Half of the note's own length: a quarter becomes a quarter and an eighth",
              },
              { id: "beat", label: "One more beat: a quarter becomes a half note" },
              { id: "rest", label: "A short rest after the note" },
            ],
            correct: ["half"],
          },
          { q: "number", prompt: "How many eighth notes does that note last?", correct: 3 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["half"], number: 3 } }, expect: "pass" },
          {
            name: "the dot taken for a whole beat",
            response: { answer: { choice: ["beat"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two eighths: the dot ignored",
            response: { answer: { choice: ["half"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Across the bar line",
      minutes: 0.75,
      graded: true,
      ui: { panels: TREBLE, staffLabels: "none", band: false },
      example: { id: "bars-12-13", code: ACROSS, bars: 2 },
      exercise: {
        kind: "staff-read",
        id: "across-the-bar-line",
        version: 1,
        role: "check",
        prompt:
          "Where the phrase begins: the E on beat 4 of the first bar is joined by a curved line to the E on beat 1 of the next. Those two notes are played as one. Count how many beats that E sounds, and answer with that number.",
        skills: [{ skill: "N08", w: 1 }],
        feedbackText: {
          "id.wrong":
            "Not {got}. The curved line joins the two Es into one sound: it starts on beat 4 and goes on through beat 1 of the next bar. Count each beat it covers.",
        },
        hints: ladder(
          "How many times do you hear the E start at the end of the first bar, once or twice?",
          "The curved line means the second E is not played again: its beat is added to the first.",
          "The first E is a quarter note, one beat. Add the note it is joined to.",
        ),
        source: ACROSS,
        bars: 2,
        answer: { ui: "number" },
        correct: { number: 2 },
        srs: [{ family: "fam.rhy.read", mode: "review-if-due" }],
        tests: [
          { name: "two beats", response: { answer: { number: 2 } }, expect: "pass" },
          {
            name: "one beat: the curved line ignored",
            response: { answer: { number: 1 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "four beats: to the end of the second bar",
            response: { answer: { number: 4 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      // U13's "Play from the page" (AUTHORING §4): the target is shown only as a lead sheet, no code and no roll.
      ui: { panels: LEAD, band: false, leadSheet: LEAD_SHEET },
      example: { id: "the-riff", code: s6(RIFF), bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "The page shows a two-bar soul riff over Fmaj7 and Cmaj7. The starter has its notes, G A, then G E D C, in even lengths. Give each note the length the page shows, with `@` inside each bar's brackets. Keep the notes as they are. Done when every note starts and ends where the page has it.",
        skills: [
          { skill: "N08", w: 0.5 },
          { skill: "R09", w: 0.5 },
        ],
        code: { starter: S6_STARTER },
        reference: { solutions: [s6(RIFF)], bars: 2 },
        matcher: PAGE_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "melody.extra-note":
            "Bar {bar}, {beatLabel}: no note starts here on the page. Check the length of the note before it; two notes joined by a curved line are one sound, one number with one weight.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: the page has a note starting here. Check the note before it: a dot makes a note an eighth longer.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: you have {got}; the page has {exp}. The rhythm can be right while the notes are not: keep the numbers of the starter.",
        },
        hints: ladder(
          "Only the lengths change. Count eighths in each bar of the page: how many does each note take?",
          "Each bar is eight eighths. A dotted quarter is `@3`; an eighth joined to a half note is one sound of five eighths, `@5`.",
          "Bar 1 is G for three eighths, then A for the rest of the bar. Bar 2 starts the same way.",
        ),
        tests: [
          { name: "reference", response: { code: s6(RIFF) }, expect: "pass" },
          {
            name: "the lengths written with _",
            response: { code: s6("<[4 _ _ 5 _ _ _ _] [4 _ _ 2 1 _ 0 _]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s6(RIFF_EVEN) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the joined A played twice",
            response: { code: s6("<[4@3 5 5@4] [4@3 2 1@2 0@2]>") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "the dot left off: a plain quarter",
            response: { code: s6("<[4@2 5@6] [4@2 2@2 1@2 0@2]>") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "the right rhythm, one note misread: F for E",
            response: { code: s6("<[4@3 5@5] [4@3 3 1@2 0@2]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the right rhythm a step too high",
            response: { code: s6("<[5@3 6@5] [5@3 3 2@2 1@2]>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "notate",
      title: "Write it down",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      example: { id: "the-lean", code: LEAN_CODE, bars: 2 },
      exercise: {
        kind: "staff-write",
        id: "write-the-lean",
        version: 1,
        role: "check",
        prompt:
          "Write the code's two bars on the staff, lengths included: C and D a beat each, E for three eighths, then G from the last eighth of bar 1, held through the first half of bar 2, then E. Join the two halves of the G with a tie.",
        skills: [{ skill: "N08", w: 1 }],
        feedbackText: {
          "melody.extra-note":
            "Bar {bar}, {beatLabel}: no note starts here in the code. Check the length of the note before it; a note that holds across the bar line is written as two notes joined by a tie.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: a note starts here in the code. Check the length of the note before it: three eighths is a dotted quarter.",
        },
        hints: ladder(
          "Which note crosses the bar line, and how much of it falls in each bar?",
          "The E is `@3` of eight: a quarter with a dot. The G starts on the last eighth of bar 1 and goes on for a half note in bar 2.",
          "Bar 1 is C, D, a dotted quarter E, then an eighth G tied to the next bar. Bar 2 has two notes.",
        ),
        answer: {
          ui: "staff-input",
          clef: "treble",
          bars: 2,
          palette: { durations: ["8", "4", "4.", "2"], accidentals: false, ties: true, rests: false },
        },
        expect: {
          e: "events",
          reference: { solutions: [LEAN_CODE], bars: 2 },
          matcher: { m: "events", pitch: "absolute", rhythm: "onsets+durations", durations: true },
        },
        srs: [{ family: "fam.rhy.read", mode: "review-if-due" }],
        tests: [
          { name: "as written", response: { staff: "C4:4 D4:4 E4:4. G4:8~ G4:2 E4:2" }, expect: "pass" },
          {
            name: "the dotted quarter as a quarter tied to an eighth",
            response: { staff: "C4:4 D4:4 E4:4~ E4:8 G4:8~ G4:2 E4:2" },
            expect: "pass",
          },
          {
            name: "the tie left out: G played twice",
            response: { staff: "C4:4 D4:4 E4:4. G4:8 G4:2 E4:2" },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "a plain quarter for the dotted quarter",
            response: { staff: "C4:4 D4:4 E4:4 G4:8~ G4:2 E4:2" },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "an octave too high",
            response: { staff: "C5:4 D5:4 E5:4. G5:8~ G5:2 E5:2" },
            expect: "fail",
            feedback: ["staff.octave"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your leaning tune",
      minutes: 2.75,
      ui: {
        panels: ROLL_LEAD,
        rollLabels: "none",
        band: false,
        leadSheet: LEAD_SHEET,
        initialPanels: ["chords"],
      },
      exercise: {
        kind: "code-make",
        id: "your-leaning-tune",
        version: 1,
        role: "practice",
        prompt:
          "Rewrite the rhythm of the `mel:` line with `@` so at least two notes start between beats and ring through the next beat: one could start on an “and”, one just before a bar line. Keep the notes if you like. Your loop then plays both verses of your song, its tune in place of Oak's.",
        skills: [{ skill: "R09", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "tune-leans",
            label: "At least two notes of the `mel:` line start between beats and ring through the next beat",
            required: true,
            skills: ["R09"],
            rule: "syncopation",
            track: "mel",
            min: 2,
          },
          {
            id: "writes-cleanly",
            label: "The `mel:` line can be written on the staff",
            required: false,
            skills: ["N08"],
            rule: "notates",
            view: "staff",
            melody: "mel",
          },
          {
            id: "chord-notes-strong",
            label: "On at least 6 of every 10 strong beats, the tune plays a note of the chord under it",
            required: false,
            skills: ["R09"],
            rule: "chord-tones-strong",
            melody: "mel",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.6,
          },
          {
            id: "ends-home",
            label: "The tune's last note is degree 1 (C)",
            required: false,
            skills: ["R09"],
            rule: "ends-on-degree",
            track: "mel",
            degrees: ["1"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Check the tune against the item, then run it again.",
        },
        hints: ladder(
          "Two notes need to start between beats and keep ringing past the next beat. Which notes of your tune could do that?",
          "Inside a bar's brackets `@` gives a note a weight: in a bar of eight shares, `@3` is a dotted quarter and a note after it starts on an “and”.",
          "Try one bar as `[4@3 2@5]`: the second note starts on the “and” of 2 and holds over beat 3. Do the same in another bar.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: two bars that hold across beat 3",
            response: { code: make("<[4@3 2@5] [4 2 0 2] [3@3 5@5] [1 2 4 ~]>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: notes tied over the bar lines, home at the end, hats accented",
            response: {
              code: make(
                "<[4@3 2@3 4@3 5@3 4@2 2@2]@2 [3@3 5@3 4@3 3@3 1@2 0@2]@2>",
                'hats: s("hh*8").velocity("[1 .4]*4").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "dotted quarters, each followed at once by its eighth",
            response: { code: make("<[4@3 2 4@3 2] [4@3 2 0@3 2] [3@3 5 4@3 3] [1@3 2 4@3 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
