// J1.L04 Guide-Tone Lines (spec: content/specs/J1.md). Inside a ii–V–I the 3rd and the 7th of each chord make a
// thread that stays or moves by a half step: the 7th of ii falls to the 3rd of V, the 7th of V falls to the 3rd
// of I. Sing it, write it, play it with `.dict("guidetones")`, and a tune that lands on it at every change
// outlines the chords by itself.
//
// Evaluated (headless Strudel): `chord("<Cm7 F7 Bb^7 Bb^7>").dict("guidetones").voicing()` plays E♭4 B♭4 |
// E♭4 A4 | D4 A4 | D4 A4, two threads: B♭–A–A–A on top (7th of Cm7, 3rd of F7, 7th of B♭maj7) and E♭–E♭–D–D
// below (3rd of Cm7, 7th of F7, 3rd of B♭maj7). The default dictionary plays four or five notes a chord.
//
// Written for the learner at the gate (AUTHORING §20.1): J1 opens after U13.CP and may be taken with U14–U17
// unfinished, so the lesson uses what U13.CP guarantees, J1.L01–L03, and its own unlock, `tb.dict.guidetones`.
// "Guide tones" is U12.L05's term and is called back, not introduced; "ii–V–I" is J1.L03's.
//
// The corrections-pass standard (AUTHORING §20.2), on both graded steps and the Make:
// - S4 (the lower thread, note by note): the notes heard on `mel` in absolute pitch; the right notes made silent
//   with `.gain(0)` (the right function, nothing heard) fail, as do the top thread, D a bar early and the thread an
//   octave up; three other right answers pass.
// - S5 (the dictionary): the pitch classes the Rhodes plays at each onset AND the dictionary really in force
//   (`voiced-with`): `.dict("guidetones")` written after `.voicing()` (the right call, voicing nothing),
//   `lefthand` in its place, and the guide tones at `.gain(0)` fail.
// - Make: `guide-tones` judged against the given changes, at every change, moving at most 2 half steps: a tune on
//   the roots fails, a tune on guide tones that leaps between them fails, the thread silent fails (no notes heard).
// No hint below rung 4 and no feedback override names the answer.
//
// The sung step: the spec's `mode: "guide-tones"` is the planned feature `sing.guide-tones` (not rendered yet);
// the degree mode sings the same four notes, B♭ A A A (do ti ti ti, 1 7 7 7), and is graded today, as U12.L05's
// sung thread is. Never gating; Quiet mode names the degrees instead.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 120;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const CHANGES_CONST = 'const changes = "<Cm7 F7 Bb^7 Bb^7>"\n';
/** Every loop of the lesson: the ii–V–I in B♭ as one chord string, then its parts. */
const code = (...lines: string[]) => `${TEMPO}${CHANGES_CONST}\n${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const BB_MAJOR = { tonic: "Bb", mode: "major" } as const;
/** The given cycle, one chord a bar: what the Make's tune is judged against, whatever the chords line plays. */
const CYCLE = ["Cm7", "F7", "Bb^7", "Bb^7"];

/** The rhythm section of J1.L01 on the jazz kit, and the upright in two (root and 5th, D leading back to C). */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
const BASS = 'bass: note("<[c2 g1] [f1 c2] [bb1 f1] [bb1 d2]>").s("upright")';
/** The Rhodes comps on the Charleston (beat 1, the and of 2), swung. */
const COMP = '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)';
const chords = (calls: string, tail = COMP) => `chords: chord(changes)${calls}${tail}`;
const GUIDES = chords('.dict("guidetones").voicing()');

const vibes = (pattern: string, tail = "") => `mel: note("${pattern}")${tail}.s("vibes")`;
/** The top thread, one note a bar: B♭ (7th of Cm7), A (3rd of F7), A (7th of B♭maj7), A. */
const THREAD = vibes("<bb4 a4 a4 a4>");
/**
 * A tune on the thread: each bar starts on it (B♭, A, A, A), then moves through the chord's own notes (G and E♭
 * of Cm7; C and F of F7; F and D of B♭maj7), swung.
 */
const TUNE_ON_THREAD = vibes(
  "<[bb4 ~ ~ g4 ~ eb4 g4 ~] [a4 ~ ~ c5 ~ a4 f4 ~] [a4 ~ ~ f4 ~ d4 f4 ~] [a4 ~ ~ ~ ~ ~ ~ ~]>",
  ".swingBy(1/3, 4)",
);

const GUIDES_ONLY = code(RIDE, HATS, BASS, GUIDES);
const HOOK = code(RIDE, HATS, BASS, GUIDES, TUNE_ON_THREAD);
/** S2: the guide tones held a bar each over the bass, so the roll shows two notes standing still or sliding. */
const HELD = code(BASS, chords('.dict("guidetones").voicing()', '.s("rhodes")'));
/** S3: Oak's model for the sung thread. */
const SING_MODEL = code(BASS, GUIDES, THREAD);

/** S4: the guide tones play; the vibes start the lower thread on E♭ and the learner finishes it. */
const lower = (pattern: string, tail = "") => code(RIDE, BASS, GUIDES, vibes(pattern, tail));
const LOWER_STARTER = lower("<eb4 ⟪eb4 eb4 eb4⟫>");
const LOWER_SOLUTION = lower("<eb4 eb4 d4 d4>");

/** S5: the Rhodes plays the default dictionary's full chords; the learner keeps only the thread. */
const dictAnswer = (line: string) => code(RIDE, BASS, line, THREAD);
const DICT_STARTER = dictAnswer(`chords: chord(changes)⟪.voicing()⟫${COMP}`);
const DICT_SOLUTION = dictAnswer(GUIDES);

/** The Make: the Band plays drums; the chords and bass are in the code; the tune sits on the roots. */
const ROOTS_TUNE = vibes(
  "<[c5 ~ ~ g4 ~ ~ ~ ~] [f4 ~ ~ c5 ~ ~ ~ ~] [bb4 ~ ~ f4 ~ ~ ~ ~] [bb4 ~ ~ ~ ~ ~ ~ ~]>",
  ".swingBy(1/3, 4)",
);
const MAKE_STARTER = code(BASS, GUIDES, ROOTS_TUNE);
const makeAnswer = (...lines: string[]) => code(BASS, GUIDES, ...lines);

const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** The Rhodes plays the guide-tone dictionary (`.dict("guidetones")` before `.voicing()`, really in force). */
const GUIDETONES_IN_FORCE: RubricRule = {
  id: "guidetones",
  label: "The chords line takes its notes from the guide-tone dictionary",
  required: true,
  skills: ["J07"],
  rule: "custom",
  fn: "voiced-with",
  params: { track: "chords", dict: "guidetones" },
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J1.L04",
  version: 3,
  title: "Guide-Tone Lines",
  objective:
    "I can sing and write the guide-tone lines of a ii–V–I, play them with the guide-tone dictionary, and land a tune on them.",
  key: BB_MAJOR,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J07", "V06"],
  practises: [],
  terms: [],
  canDo: ["cd.sing.guide-tones"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two notes a chord",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-notes-a-chord",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the Rhodes' top note while the chords change under it. Count how often it moves, and by how far.",
        skills: [{ skill: "J07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: GUIDES_ONLY,
            caption: "Bass, drums, and the Rhodes on two notes a chord.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The same loop with a vibes tune on top. Listen to the first note of each bar.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Which two notes",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords", "chord-tones"] },
      example: { id: "held", code: HELD, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "which-two-notes",
        version: 1,
        role: "practice",
        prompt:
          'Run it. `.dict("guidetones")` gives each chord two notes, and the chord-tone lens names them. Answer two questions: which two members of each chord they are, and how many half steps the top note falls from Cm7 to F7.',
        skills: [{ skill: "J07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count up from each chord's root to the two notes the lens marks, and count the keys between B♭ and the next top note.",
        },
        hints: ladder(
          "Cm7 is C E♭ G B♭. Read the lens in bar 1 to see which two of those the Rhodes plays.",
          "The chord-tone lens names the member of the chord each note is. Read it for bar 1, then read the top note of bar 2 against F7: F A C E♭.",
          "In bar 1 the notes are E♭ and B♭: count C, E♭ (the 3rd) and on to B♭. For the move, look for the key right under B♭.",
        ),
        code: { starter: HELD },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which members of each chord does the guide-tone dictionary play?",
            options: [
              { id: "3-7", label: "The 3rd and the 7th" },
              { id: "1-5", label: "The root and the 5th" },
              { id: "1-3", label: "The root and the 3rd" },
            ],
            correct: ["3-7"],
          },
          {
            q: "number",
            prompt: "How many half steps does the top note fall from Cm7 to F7?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["3-7"], number: 1 } }, expect: "pass" },
          {
            name: "root and 5th",
            response: { answer: { choice: ["1-5"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two half steps",
            response: { answer: { choice: ["3-7"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "sing",
      title: "Sing the thread",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-thread",
        version: 1,
        role: "practice",
        key: BB_MAJOR,
        prompt:
          "Hear it, then sing the top thread over the four chords: do, ti, ti, ti, one long note a bar. Do is B♭ here, the 7th of Cm7; ti is A, a half step below. The numbers stay on screen: 1, 7, 7, 7. Sing in your own range.",
        skills: [
          { skill: "V06", w: 0.6 },
          { skill: "J07", w: 0.4 },
        ],
        hints: [
          { text: "Hum do over Cm7 and keep it in your ear as the chord changes under you." },
          {
            text: "Ti is the smallest step down from do: one half step, as the 7th of Cm7 falls to the 3rd of F7.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING_MODEL, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        // One note a bar: do over Cm7, then ti (the octave below do) over F7 and B♭maj7.
        target: { from: "degrees", degrees: ["1", "7", "7", "7"], rhythm: "x", octaves: [0, -1, -1, -1] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        srs: [{ family: "fam.jzz.guide", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The other thread",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords", "chord-tones"] },
      exercise: {
        kind: "code-modify",
        id: "the-other-thread",
        version: 1,
        role: "check",
        prompt:
          "Finish the lower thread in the vibes line. It starts on E♭, the 3rd of Cm7. Write the notes for bars 2, 3 and 4: one note a bar, each the 3rd or the 7th of its chord, staying put or moving a half step from the note before.",
        skills: [{ skill: "J07", w: 1 }],
        swing: SWUNG,
        code: { starter: LOWER_STARTER },
        reference: { solutions: [LOWER_SOLUTION], bars: 4 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // The catalog names the target note; these describe the move instead (no answer below rung 4).
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: that note is not where the thread goes. Ask whether the note before is in this bar's chord; if it is not, it moves by the smallest step that lands on the chord's 3rd or 7th.",
          "melody.octave":
            "Bar {bar}: the right letter in another octave. The thread stays close: from one chord to the next it moves by a half step at most.",
          "melody.missing-note":
            "Bar {bar}: the vibes are not heard there. One note a bar, every bar, loud enough to hear over the Rhodes.",
          // The catalog labels an extra note by a key read from the answer alone (E♭ came out as "1" in B♭).
          "melody.extra-note":
            "Bar {bar}: more than one note. The thread is one long note a bar, struck on beat 1.",
        },
        hints: ladder(
          "Check each new chord for the note before it. If the note is in the chord, the thread stays; if not, it moves.",
          "F7 is F A C E♭, so E♭ is its 7th. B♭maj7 is B♭ D F A: which of its 3rd and 7th is a half step from E♭?",
          "Bar 2 keeps E♭. In bar 3 the thread falls a half step to the 3rd of B♭maj7, and bar 4 repeats bar 3.",
        ),
        tests: [
          { name: "reference", response: { code: LOWER_SOLUTION }, expect: "pass" },
          { name: "written with !", response: { code: lower("<eb4!2 d4!2>") }, expect: "pass" },
          {
            name: "on the piano",
            response: { code: lower("<eb4 eb4 d4 d4>", "").replace('.s("vibes")', '.s("piano")') },
            expect: "pass",
          },
          {
            name: "short notes on beat 1",
            response: { code: lower("<[eb4 ~] [eb4 ~] [d4 ~] [d4 ~]>") },
            expect: "pass",
          },
          { name: "softer", response: { code: lower("<eb4 eb4 d4 d4>", ".gain(.7)") }, expect: "pass" },
          {
            name: "unchanged: E♭ held through",
            response: { code: plain(LOWER_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "D a bar early: F7's 7th skipped",
            response: { code: lower("<eb4 d4 d4 d4>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the top thread instead: B♭ A A A",
            response: { code: lower("<bb4 a4 a4 a4>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the thread an octave up",
            response: { code: lower("<eb5 eb5 d5 d5>") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "the right notes, silent: .gain(0)",
            response: { code: lower("<eb4 eb4 d4 d4>", ".gain(0)") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "the thread with a second note in every bar",
            response: { code: lower("<[eb4 g4] [eb4 c4] [d4 f4] [d4 a4]>") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "written as scale steps: n() is degree − 1",
            response: {
              code: lower("<eb4 eb4 d4 d4>").replace(
                'note("<eb4 eb4 d4 d4>")',
                'n("<3 3 2 2>").scale("Bb3:major")',
              ),
            },
            expect: "pass",
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Only the thread",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      exercise: {
        kind: "code-modify",
        id: "only-the-thread",
        version: 1,
        role: "check",
        prompt:
          "Change the chords line so the Rhodes takes its notes from the guide-tone dictionary and plays only the two threads under the vibes. Keep the other lines as they are. Done when the Rhodes plays two notes a chord, like the target.",
        skills: [{ skill: "J07", w: 1 }],
        swing: SWUNG,
        code: { starter: DICT_STARTER },
        reference: { solutions: [DICT_SOLUTION], bars: 4 },
        // What is heard (the pitch classes at each onset of the Rhodes) and how it is made (the dictionary in
        // force): a `.dict()` after `.voicing()` voices nothing and plays the full chords.
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
            { m: "rubric", rules: [GUIDETONES_IN_FORCE] },
          ],
        },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: the Rhodes plays more, or other, notes than the two the target keeps. Listen to the target: only two notes a chord.",
          "rubric.unmet":
            "{label}: not yet. The chords still come from another dictionary. Where in the chain is a dictionary chosen?",
          "code.dict-after-voicing":
            "The dictionary call comes after `.voicing()`, so the notes are already chosen when it arrives: it changes nothing.",
        },
        hints: ladder(
          "Look at the chords line: one call in its chain decides which notes each chord plays. That is the place to change.",
          "A dictionary is chosen before `.voicing()`, as you did with the left-hand voicings.",
          'The call goes between `chord(changes)` and `.voicing()`, with the dictionary\'s name in quotes, the way `.dict("lefthand")` does.',
        ),
        tests: [
          { name: "reference", response: { code: DICT_SOLUTION }, expect: "pass" },
          {
            name: "the chord symbols written in place of the const",
            response: {
              code: dictAnswer(`chords: chord("<Cm7 F7 Bb^7 Bb^7>").dict("guidetones").voicing()${COMP}`),
            },
            expect: "pass",
          },
          {
            name: "on the piano",
            response: { code: dictAnswer(GUIDES.replace('.s("rhodes")', '.s("piano")')) },
            expect: "pass",
          },
          {
            name: "louder",
            response: { code: dictAnswer(GUIDES.replace(".gain(.6)", ".gain(.8)")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(DICT_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right call after .voicing(): it voices nothing",
            response: { code: dictAnswer(chords('.voicing().dict("guidetones")')) },
            expect: "fail",
            feedback: ["harmony.pcset", "rubric.unmet"],
          },
          {
            name: "the left-hand dictionary instead",
            response: { code: dictAnswer(chords('.dict("lefthand").voicing()')) },
            expect: "fail",
            feedback: ["harmony.pcset", "rubric.unmet"],
          },
          {
            name: "the guide tones, silent: .gain(0)",
            response: { code: dictAnswer(GUIDES.replace(".gain(.6)", ".gain(0)")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "A tune on the thread",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords", "chord-tones"] },
      exercise: {
        kind: "code-make",
        id: "a-tune-on-the-thread",
        version: 1,
        role: "practice",
        title: "Guide-tone tune",
        prompt:
          "Rewrite the vibes tune. Required: on the first beat of each bar, where the chord changes, land on that chord's 3rd or 7th, at most a whole step from the last landing. Between the changes, go anywhere. Also on the checklist: swing the vibes the way the ride swings.",
        skills: [{ skill: "J07", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "lands-on-the-thread",
            label:
              "At 3 of every 4 chord changes or more, the vibes land on the chord's 3rd or 7th, a whole step or less from the last landing",
            required: true,
            skills: ["J07"],
            rule: "guide-tones",
            track: "mel",
            harmony: "chords",
            minRatio: 0.75,
            at: "change",
            maxMoveSemis: 2,
            // The cycle given: rewriting the chords under the tune cannot make a wrong tune right.
            changes: CYCLE,
          },
          {
            id: "tune-swings",
            label: "The vibes' eighths swing long-short, not even",
            required: false,
            skills: ["R13"],
            rule: "swing",
            track: "mel",
            subdivision: 8,
            ratio: [1.45, 2.4],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Look at the note your tune plays on beat 1 of each bar. It must be one of two notes of that bar's chord.",
          "Over Cm7 the 3rd and 7th are E♭ and B♭; over F7, A and E♭; over B♭maj7, D and A. The chord-tone lens marks them. From one landing to the next, stay or move a step.",
          "Start from the thread you sang, one note a bar, then give each bar more notes after its first: bar 1 can begin on B♭ and fall through the chord.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the top thread itself", response: { code: makeAnswer(THREAD) }, expect: "pass" },
          {
            name: "the lower thread, softer",
            response: { code: makeAnswer(vibes("<eb4 eb4 d4 d4>", ".gain(.8)")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the hook's tune with a ride, hats and a soft kick",
            response: {
              code: code(
                RIDE,
                HATS,
                'kick: s("bd*4").bank("jazzkit").gain(.3)',
                BASS,
                GUIDES,
                TUNE_ON_THREAD,
              ),
            },
            expect: "pass",
          },
          {
            name: "an eighth-note line in a higher octave, landing on the lower thread",
            response: {
              code: makeAnswer(
                vibes(
                  "<[eb5 d5 c5 bb4 g4 bb4 c5 d5] [eb5 c5 a4 f4 a4 c5 eb5 d5] [d5 c5 bb4 a4 f4 a4 bb4 c5] [d5 ~ ~ ~ ~ ~ ~ ~]>",
                  ".swingBy(1/3, 4)",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "a tune on the roots",
            response: { code: makeAnswer(vibes("<c5 f4 bb4 bb4>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "guide tones at every change, with a leap of a 5th between them",
            response: { code: makeAnswer(vibes("<bb4 eb4 d4 a4>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the thread, silent: .gain(0)",
            response: { code: makeAnswer(vibes("<bb4 a4 a4 a4>", ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
