// U07.L09 Reading Lead Sheets. A lead sheet is a song on one page: the tune on a staff and the chord symbols
// above it. The learner plays the tune from it, sings it, and writes its chords from the symbols, pickup and
// all. What the learner has: degrees in `n` and notes below home (U03), stacked triads and `chord()` with
// `.voicing()` (U05.L01, U05.L08), chord symbols (U05.L04), 3/4 (U01.L08), pickups in code (U07.L08). Not yet:
// dotted notes and ties (U13), so the tune's long notes are half notes and its last note a half note and a
// rest. Spec: content/specs/U07.md.
//
// How it uses the shapes (AUTHORING §17.7): the staff panel is a lead sheet (`panels.staff: "lead"` with
// `ui.leadSheet`): the melody of the step's code with the symbols above it, read from its `chords` track or
// from a fixed `chart` where the learner writes the chords (S5). Every exercise that reads or writes the tune
// declares the one-beat pickup, `pickup: { units: [1, 1] }` (the grader divides by the three beats of a bar).
// The sing step is "sing from the page": `mode: "sight"` with `showLeadSheet: true`.
//
// Repertoire (contracts §2.8): Amazing Grace (song.amazing-grace), the tune New Britain, in F, 3/4, one-beat
// pickup; U07.L09 reading only, never X1. Phrase 1 as Oak sets it, in degrees: 5 | 1 . 3 1 | 3 . 2 | 1 . 6 |
// 5 . 5 | 1 . 3 1 | 3 . 2 | 5' (the 3 1 of bars 1 and 5 two eighths; the last note a half note and a rest),
// chords I I IV I I I V. Checked against the evaluated events: on beat 1 of bars 1–7 the tune plays F A F C F
// A C over F F Bb F F F C, every one a chord note (F is the 5th of Bb). The repertoire entry has no answer key
// yet (author:songs); if the verified key differs, the hook and S3 follow it.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 80;
const TEMPO = `setcpm(${BPM}/3)\n\n`;
/** A tune in degrees of F. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("F4:major").s("piano")`;
/** Triads stacked in degrees, an octave under the tune. */
const chords = (pattern: string, key = "F3:major") =>
  `chords: n("${pattern}").scale("${key}").s("piano").gain(.6)`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Amazing Grace, phrase 1: the pickup bar, then seven bars. */
const GRACE = "<[~ ~ -3] [0@2 [2 0]] [2@2 1] [0@2 -2] [-3@2 -3] [0@2 [2 0]] [2@2 1] [4@2 ~]>";
/** I I IV I I I V, resting in the pickup bar. */
const GRACE_CHORDS = "<~ [0,2,4] [0,2,4] [3,5,7] [0,2,4] [0,2,4] [0,2,4] [4,6,8]>";
const HOOK = code(chords(GRACE_CHORDS), mel(GRACE));

/** The first half of phrase 1: the pickup and bars 1–4 (5 | 1 . 3 1 | 3 . 2 | 1 . 6 | 5 . 5). */
const HALF = "<[~ ~ -3] [0@2 [2 0]] [2@2 1] [0@2 -2] [-3@2 -3]>";
/** F F Bb F under it. */
const HALF_CHORDS = "<~ [0,2,4] [0,2,4] [3,5,7] [0,2,4]>";
const PAGE = code(chords(HALF_CHORDS), mel(HALF));

/** S3: the starter holds a home note on each beat 1, so the bars are there and the pickup bar is empty. */
const S3_PLACEHOLDER = "<[~ ~ ~] [0 ~ ~] [0 ~ ~] [0 ~ ~] [0 ~ ~]>";
const s3 = (pattern: string) => code(mel(pattern));

/** S5: the tune is given; the learner writes the chords line from the symbols. */
const S5_CHORDS_STARTER = `chords: n("<~ ~ ~ ~ ~>").scale("F3:major").s("piano").gain(.6)`;
const s5 = (chordLine: string) => code(chordLine, mel(HALF));
const S5_REFERENCE = s5(chords(HALF_CHORDS));
/** The chart the lead sheet prints over bars 1–4 (bar 0 is the pickup bar). */
const S5_CHART = [
  { bar: 1, beat: 1, symbol: "F" },
  { bar: 2, beat: 1, symbol: "F" },
  { bar: 3, beat: 1, symbol: "Bb" },
  { bar: 4, beat: 1, symbol: "F" },
];

/**
 * S6, a lead sheet to read: an Oak waltz in G with a one-beat pickup, G C D G. Bar 3 is D (D F# A) with A on
 * its beat 1, then F#: both chord notes.
 */
const READ_MEL = "<[~ ~ -3] [0@2 2] [3@2 2] [1@2 -1] [0@2 ~]>";
const READ_CHORDS = "<~ [0,2,4] [3,5,7] [4,6,8] [0,2,4]>";
const READ = code(chords(READ_CHORDS, "G3:major"), `mel: n("${READ_MEL}").scale("G4:major").s("piano")`);
const G_MAJOR = { tonic: "G", mode: "major" } as const;

/**
 * The Make: a four-bar waltz tune alone, F A | C A | Bb G | F, with no chords under it. On beat 1 of each
 * bar F, C, Bb, F: the chords F F Bb F fit it.
 */
const MAKE_TUNE = "<[0@2 2] [4@2 2] [3@2 1] [0@2 ~]>";
const MAKE_STARTER = code(mel(MAKE_TUNE));
const MAKE_MINIMAL = code(chords("<[0,2,4] [0,2,4] [3,5,7] [0,2,4]>"), mel(MAKE_TUNE));
/**
 * Beyond the brief: a pickup into an eight-bar tune, chords by symbol on beat 1 of every bar, room. The
 * chords rest in the pickup bar: F F Bb F | F C C F under 5 | 1 . 3 | 5 . 3 | 4 . 2 | 1 . . | 3 . 5 | 6 . 5 |
 * 2 . 7 | 1.
 */
const MAKE_BEYOND = code(
  `chords: chord("<~ F F Bb F F C C F>").voicing().s("piano").gain(.5)`,
  `mel: n("<[~ ~ -3] [0@2 2] [4@2 2] [3@2 1] [0@2 ~] [2@2 4] [5@2 4] [1@2 -1] [0@2 ~]>").scale("F4:major").s("piano").room(.3)`,
);

/** The Band's drums only: its bass and chords would play over the pickup and fight the learner's chords. */
const BAND = { band: "band.waltz-vamp", tracks: ["drums"] } as const;
const LEAD = { roll: false, staff: "lead", keyboard: false } as const;
/** One beat before the first full bar. */
const PICKUP = { units: [1, 1] } as const;

export default defineLesson({
  id: "U07.L09",
  version: 3,
  title: "Reading Lead Sheets",
  objective:
    "I can play a song from a lead sheet: the tune from the staff, the chords from the symbols above it, pickup and all.",
  key: { tonic: "F", mode: "major" },
  meter: "3/4",
  bpm: BPM,
  introduces: ["N07"],
  practises: ["V04", "M10"],
  terms: [{ id: "term.lead-sheet", step: "S2" }],
  canDo: ["cd.read.leadsheet"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One page, one song",
      minutes: 0.5,
      ui: {
        panels: LEAD,
        leadSheet: { melody: "mel", chords: "chords", title: "Amazing Grace" },
        band: BAND,
      },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "one-page-one-song",
        version: 1,
        role: "practice",
        prompt:
          "Amazing Grace, an old American hymn, to the tune called New Britain. Follow the notes on the staff as it plays. Listen for how each bar splits its three beats between long notes and short ones.",
        skills: [{ skill: "N07", w: 1 }],
        pickup: PICKUP,
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Amazing Grace, the first phrase: a pickup, then seven bars in 3.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Read the page",
      minutes: 1,
      ui: {
        panels: LEAD,
        leadSheet: { melody: "mel", chords: "chords", title: "Amazing Grace" },
        band: BAND,
      },
      example: { id: "read-the-page", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-page",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read along. Bar 1 is the first full bar; the short bar before it is the pickup. Find the chord name printed above bar 3, and count how many beats the pickup holds. Answer both questions below.",
        skills: [{ skill: "N07", w: 1 }],
        pickup: PICKUP,
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count full bars from the first one after the pickup, and read the name printed above the third.",
        },
        hints: ladder(
          "Where does the chord change for the first time? Look above the staff.",
          "Bar 1 starts on the first note after the pickup, the long F. Count along the staff to bar 3 and read the name above it.",
          "The pickup is one note on the last beat of its bar. Bars 1 and 2 both carry F.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which chord name sits over bar 3?",
            options: [
              { id: "f", label: "F" },
              { id: "bb", label: "B♭" },
              { id: "c", label: "C" },
            ],
            correct: ["bb"],
          },
          {
            q: "number",
            prompt: "How many beats does the pickup, the short bar before bar 1, hold?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bb"], number: 1 } }, expect: "pass" },
          {
            name: "read bar 2",
            response: { answer: { choice: ["f"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "counted the pickup as a full bar",
            response: { answer: { choice: ["bb"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.5,
      graded: true,
      // U07's "Play from the page" (AUTHORING §4): the target is shown only as a lead sheet, no code and no roll.
      ui: {
        panels: LEAD,
        leadSheet: { melody: "mel", chords: "chords", title: "Amazing Grace" },
        band: BAND,
      },
      example: { id: "the-page", code: PAGE, bars: 5 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "Write the tune on the page in `n`, in F major: the pickup in bar 0, then bars 1 to 4. The starter holds a placeholder home note on each beat 1; replace each bar with the notes the page shows. Done when every note matches the page in pitch, beat and length.",
        skills: [
          { skill: "N07", w: 0.7 },
          { skill: "M10", w: 0.3 },
        ],
        pickup: PICKUP,
        code: { starter: s3(`⟪${S3_PLACEHOLDER}⟫`) },
        reference: { solutions: [s3(HALF)], bars: 5 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets+durations",
          durations: true,
          tracks: ["mel"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        hints: ladder(
          "Which notes are long, and where do two short notes share a beat?",
          "Home is F, degree 1 (`n` 0). A half note fills two of the bar's three beats: `@2`. Two eighths share one beat: put them in brackets. The pickup goes on the last beat of bar 0, after two rests.",
          "Bar 1 is a half note on F, then A and F as two eighths: `[0@2 [2 0]]`. The pickup is C, degree 5 below home.",
        ),
        tests: [
          { name: "reference", response: { code: s3(HALF) }, expect: "pass" },
          {
            name: "the half notes written as weights of six",
            response: { code: s3("<[~ ~ -3] [0@4 2 0] [2@2 1] [0@2 -2] [-3@2 -3]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s3(S3_PLACEHOLDER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the pickup on beat 1 of bar 0",
            response: { code: s3("<[-3 ~ ~] [0@2 [2 0]] [2@2 1] [0@2 -2] [-3@2 -3]>") },
            expect: "fail",
            feedback: ["melody.extra-note", "melody.missing-note"],
          },
          {
            name: "the two eighths written as quarters",
            response: { code: s3("<[~ ~ -3] [0 2 0] [2@2 1] [0@2 -2] [-3@2 -3]>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "the low notes written above home",
            response: { code: s3("<[~ ~ 4] [0@2 [2 0]] [2@2 1] [0@2 5] [4@2 4]>") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "sing",
      title: "Sing from the page",
      minutes: 1.25,
      ui: { panels: LEAD, leadSheet: { melody: "mel", chords: "chords", title: "Amazing Grace" } },
      exercise: {
        kind: "sing",
        id: "sing-from-the-page",
        version: 1,
        role: "practice",
        prompt:
          "Sing the five bars on the page on syllables, ten notes, starting with the pickup. A chord sets home and one bar counts you in, in 3. Keep counting, and come in on count 3 of the pickup bar. Oak plays the tune after you.",
        skills: [
          { skill: "V04", w: 0.8 },
          { skill: "N07", w: 0.2 },
        ],
        pickup: PICKUP,
        hints: [
          {
            text: "Hum do, the chord's home note. Is the pickup above it or below?",
          },
          {
            text: "The pickup is sol below do, on count 3 of the short pickup bar. Then do, held for two counts.",
          },
          { text: "Hear the five bars once, slower, then sing them from the page.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        // Sight-singing: the tune is shown as a lead sheet and only the cue plays first; Oak plays it after.
        mode: "sight",
        stimulus: { src: "code", code: PAGE, bars: 5, showCode: false, showLeadSheet: true },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        target: { from: "stimulus", track: "mel" },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "after",
        srs: [{ family: "fam.mel.sight", mode: "evidence-only" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Chords from the symbols",
      minutes: 1.25,
      graded: true,
      ui: {
        panels: LEAD,
        leadSheet: { melody: "mel", chords: { chart: S5_CHART }, title: "Amazing Grace" },
        band: BAND,
      },
      example: { id: "the-symbols", code: code(mel(HALF)), bars: 5 },
      exercise: {
        kind: "code-modify",
        id: "chords-from-the-symbols",
        version: 1,
        role: "check",
        prompt:
          "Fill in the `chords` line from the chord symbols above the staff: one chord for each of bars 1 to 4, and a rest, `~`, in the pickup bar. Stack each chord in `n`, or name it with `chord()` and `.voicing()`. Done when every bar plays the chord its symbol names.",
        skills: [{ skill: "N07", w: 1 }],
        pickup: PICKUP,
        code: { starter: s5(`⟪${S5_CHORDS_STARTER}⟫`) },
        reference: { solutions: [S5_REFERENCE], bars: 5 },
        matcher: { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "harmony.pcset":
            "{bar}: your chord has {got}; the page asks for {exp}. Read the symbol above that bar, and keep the pickup bar empty.",
        },
        hints: ladder(
          "How many chords does the page ask for, and what happens in the short bar before bar 1?",
          "In F, the F chord is built on degree 1 and B♭ on degree 4. `n` counts from 0, so a chord on degree 4 starts at `n` 3. The pickup bar is a rest, `~`.",
          "The first two cells are `~` and `[0,2,4]`: a rest, then F. Bar 2 is F again.",
        ),
        tests: [
          { name: "reference", response: { code: S5_REFERENCE }, expect: "pass" },
          {
            name: "by symbol, with chord() and voicing()",
            response: { code: s5(`chords: chord("<~ F F Bb F>").voicing().s("piano").gain(.6)`) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s5(S5_CHORDS_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "B flat stacked on n 4, the degree number",
            response: { code: s5(chords("<~ [0,2,4] [0,2,4] [4,6,8] [0,2,4]>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "B for B flat",
            response: { code: s5(`chords: chord("<~ F F B F>").voicing().s("piano").gain(.6)`) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "no rest in the pickup bar: every chord a bar early",
            response: { code: s5(chords("<[0,2,4] [0,2,4] [3,5,7] [0,2,4]>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Read one bar",
      minutes: 0.75,
      graded: true,
      ui: { panels: LEAD, leadSheet: { melody: "mel", chords: "chords" } },
      example: { id: "one-bar", code: READ, bars: 5 },
      exercise: {
        kind: "all",
        id: "read-one-bar",
        version: 1,
        role: "check",
        prompt:
          "Read the new page, a short waltz in G with a pickup. Find bar 3, the third full bar after the pickup. Type the chord name printed above it, then the letter of the tune's note on its beat 1.",
        skills: [{ skill: "N07", w: 1 }],
        key: G_MAJOR,
        pickup: PICKUP,
        hints: ladder(
          "Which bar is bar 3? Count full bars from the first one after the pickup.",
          "The chord name is printed above the staff where the chord starts. The note on beat 1 is the first note after the bar line.",
          "Bar 1 carries G and bar 2 C. In G every F is sharp, but bar 3 starts higher than that.",
        ),
        srs: [{ family: "fam.not.read", mode: "review-if-due" }],
        tests: [],
        parts: [
          {
            kind: "staff-read",
            id: "read-one-bar-chord",
            version: 1,
            role: "check",
            prompt: "Type the chord name printed above bar 3.",
            skills: [{ skill: "N07", w: 1 }],
            key: G_MAJOR,
            pickup: PICKUP,
            hints: ladder(
              "Which bar is bar 3? Count full bars from the first one after the pickup.",
              "The chord name is printed above the staff where the chord starts.",
              "Bar 1 carries G and bar 2 C. Bar 3 carries the chord built on degree 5 of G.",
            ),
            source: READ,
            bars: 5,
            answer: { ui: "text", normalize: "chord" },
            // The catalog's text names the right chord; this one sends the learner back to the page.
            feedbackText: {
              "id.chord-root":
                "Not {got}. Count full bars from the first one after the pickup, and read the name printed above the third.",
            },
            correct: { text: ["D"] },
            tests: [
              { name: "D", response: { answer: { text: ["D"] } }, expect: "pass" },
              {
                name: "the chord of bar 2",
                response: { answer: { text: ["C"] } },
                expect: "fail",
                feedback: ["id.chord-root"],
              },
              {
                name: "the chord of bar 4",
                response: { answer: { text: ["G"] } },
                expect: "fail",
                feedback: ["id.chord-root"],
              },
            ],
          },
          {
            kind: "staff-read",
            id: "read-one-bar-note",
            version: 1,
            role: "check",
            prompt: "Type the letter of the tune's note on beat 1 of bar 3.",
            skills: [{ skill: "N07", w: 1 }],
            key: G_MAJOR,
            pickup: PICKUP,
            hints: ladder(
              "Is the note on a line or in a space?",
              "The note on beat 1 is the first note after the bar line. Count up from the treble clef's G line.",
              "It sits in the space above the G line.",
            ),
            source: READ,
            bars: 5,
            answer: { ui: "text", normalize: "note" },
            feedbackText: {
              "spell.wrong":
                "Not {got}. Take the first note after the bar line of bar 3, and count lines and spaces up from the G line.",
            },
            correct: { text: ["a"] },
            tests: [
              { name: "a", response: { answer: { text: ["a"] } }, expect: "pass" },
              { name: "capital A", response: { answer: { text: ["A"] } }, expect: "pass" },
              {
                name: "the bar's second note",
                response: { answer: { text: ["f#"] } },
                expect: "fail",
                feedback: ["spell.wrong"],
              },
              {
                name: "the chord name instead of the note",
                response: { answer: { text: ["d"] } },
                expect: "fail",
                feedback: ["spell.wrong"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your own page",
      minutes: 2.75,
      ui: {
        panels: { roll: true, staff: "lead", keyboard: false },
        rollLabels: "degree",
        leadSheet: { melody: "@melody", chords: "@chords" },
        band: BAND,
      },
      exercise: {
        kind: "code-make",
        id: "your-own-page",
        version: 1,
        role: "practice",
        prompt:
          "Add a `chords:` line under this waltz tune, one chord a bar, so the page shows chord names. For each bar, pick a chord that holds the tune's note on beat 1. Then rework or extend the tune, to four to eight bars. Done when the page shows both notes and chord names.",
        skills: [{ skill: "N07", w: 1 }],
        // The rules' own details name tracks and onsets; the label says it in words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 9],
        saveAs: "sketch",
        rubric: [
          {
            id: "tune-and-chords",
            label: "A tune line and a `chords` line both play, so the page shows notes and chord names",
            required: true,
            skills: ["N07"],
            rule: "tracks",
            min: 2,
            roles: ["chords", "melody"],
          },
          {
            id: "chord-notes-on-one",
            label: "The tune's note on beat 1 is a chord tone in at least 3 of every 5 bars",
            required: false,
            skills: ["M03"],
            rule: "chord-tones-strong",
            minRatio: 0.6,
            melody: "@melody",
            harmony: "@chords",
            strength: "downbeat",
          },
          {
            id: "a-pickup",
            label: "A pickup: a note or two before beat 1 of bar 1",
            required: false,
            skills: ["M10"],
            rule: "pickup",
            track: "@melody",
          },
        ],
        hints: ladder(
          "The page has notes but no chord names yet. What would a player need to read off it to play along with the tune?",
          "A `chords` line, one chord a bar, stacked in `n` or named with `chord()`. Pick for each bar a chord that holds the tune's note on beat 1.",
          "Bar 1 starts on F, so F fits: `[0,2,4]`. Bar 3 starts on B♭: the chord on degree 4.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: F F Bb F under the tune", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: a pickup, eight bars, chords by symbol",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "a second tune instead of chords",
            response: {
              code: code(
                mel(MAKE_TUNE),
                `vox: n("<[4@2 4] [7@2 4] [5@2 3] [2@2 ~]>").scale("F4:major").s("piano")`,
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
