// J3.L05 Fourths (Oak 2.0 W2; spec: content/specs/J3.md). A chord stacked in 4ths, five half steps between
// neighbours, has no name of its own: the bass under it decides what it is called. D G C F over a D in the bass is
// Dm11 (root, 11th, 7th, minor 3rd); the same four notes over G are G7sus (root, 4th, 5th, 7th). Over the stack's own
// lowest note a stack of 4ths is always a minor 11th chord, which is why pianists comp a minor chord this way: open,
// hollow, and named by the bass.
//
// Written for the learner at the gate (AUTHORING §20.1): J3 opens after U13.CP, J.CP1 and JC1 and may come before
// U14, so no mode names and no modal `.scale()`; the chords are note names, hand-voiced, never `.voicing()`. The
// chord names in the prose are the ones J1–J2.L03 taught (m11 from J2.L03's extensions, 7sus from J1.L02). The keys
// of the stacks are the white keys (C major's notes): D G C F and E A D G.
//
// What the rules hear (evaluated for this lesson with `identifyChord`, @oak/theory, which `bass-names-chord` uses):
// D G C F over D reads "m11"; over G, C or F "7sus4"; over A or B♭ "69"; E A D G over E "m11", over A or D "7sus4";
// G C F over D "m11". The rule reads the quality only, wherever three or more chord notes sound, weighted by how
// long each sounds over its bass (X14), and needs the minor 11th for three quarters of that time (Oak's call; S4,
// "all through the bar", needs all of it): a bass that plays D only on beat 3 of a held chord gets half the bar. `stack-intervals` reads the gaps between neighbouring notes from the lowest up, so the four right
// letters spread over two octaves (D C G F) are not a stack of 4ths.
//
// The corrections-pass standard (AUTHORING §20.2) on every graded step: the reference, three other right answers,
// the unchanged starter, a wrong answer that fails on the effect, two realistic mistakes with different codes, and
// the fidelity pins of content/validate/pins/J3.L05.ts (a stack of 3rds and `.voicing()` fail S3; the 4ths added in
// code pass; D only on beat 3 fails S4; D an octave lower passes; the stacks over a 4th below fail the Make; a
// three-note stack over D passes it).
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

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** Comping on beat 1 and the and of 2, swung, on the Rhodes (J3.L01's rhythm). */
const COMP = '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")';
const chords = (stacks: string, tail = COMP) => `chords: note("<${stacks}>")${tail}`;
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** The two stacks of the lesson: on D (Dm11 over D) and on E (Em11 over E). */
const ON_D = "[d3,g3,c4,f4]";
const ON_E = "[e3,a3,d4,g4]";
const LOOP = `${ON_D} ${ON_D} ${ON_E} ${ON_D}`;

/** The rhythm section: the jazz kit's ride and hats. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
const bass = (notes: string) => `bass: note("${notes}").s("upright")`;
const LOOP_BASS = bass("<d2 d2 e2 d2>");

// ---- S1 and S2 -----------------------------------------------------------------------------------------------

const OVER_D = code(RIDE, HATS, bass("d2"), chords(ON_D));
const OVER_G = code(RIDE, HATS, bass("g1"), chords(ON_D));
/** S2: the stack held over D, so the roll shows four notes standing still. */
const HELD = code(bass("d2"), `chords: note("${ON_D}").s("rhodes")`);

// ---- S3: build the stacks ------------------------------------------------------------------------------------

const STACK_STARTER = code(RIDE, LOOP_BASS, `chords: note("<⟪d3 d3 e3 d3⟫>")${COMP}`);
const stackAnswer = (line: string) => code(RIDE, LOOP_BASS, line);
const STACK_SOLUTION = stackAnswer(chords(LOOP));

// ---- S4: the bass names it -----------------------------------------------------------------------------------

/** One stack on D, held a bar at a time, over a bass on G and C: G7sus all through. */
const HELD_LINE = `chords: note("${ON_D}").s("rhodes")`;
// STYLE rule 3: drums, then bass, then chords (X14: a learner who moved the bass up tripped the edit check).
const BASS_STARTER = code(RIDE, 'bass: note("⟪[g1 c2]⟫").s("upright")', HELD_LINE);
const bassAnswer = (notes: string) => code(RIDE, bass(notes), HELD_LINE);
const BASS_SOLUTION = bassAnswer("[d2 d2]");

/** Both graded steps' and the Make's chord-naming rule: the bass makes each stack a minor 11th. */
const minorEleven = (label: string, min = 0.75): RubricRule => ({
  id: "bass-names-m11",
  label,
  required: true,
  skills: ["J09"],
  rule: "custom",
  fn: "bass-names-chord",
  params: { chords: "chords", bass: "bass", quality: "m11", min },
});

// ---- S5: which one is home -----------------------------------------------------------------------------------

/** A bar of A7 (G C♯ E over A), then the stack on D: over D it lands home, over G it hangs. */
const homeCard = (root: string) =>
  code(
    RIDE,
    HATS,
    bass(`<a1 ${root}>`),
    `chords: note("<[g3,c#4,e4] ${ON_D}>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")`,
  );
const HOME = homeCard("d2");
const HANGS = homeCard("g1");

// ---- S6: the Make --------------------------------------------------------------------------------------------

const MAKE_STARTER = code(chords(LOOP), bass("<g1 g1 a1 g1>"));
const make = (...lines: string[]) => code(...lines);

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "J3.L05",
  version: 1,
  title: "Fourths",
  objective: "I can voice a chord in 4ths and name it from the note the bass plays under it.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["J09"],
  terms: [{ id: "term.quartal-voicing", step: "S3" }],
  canDo: ["cd.code.quartal"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same notes, new bass",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "over-d", code: OVER_D, bars: 2 },
      exercise: {
        kind: "listen",
        id: "same-notes-new-bass",
        version: 1,
        role: "practice",
        prompt:
          "The Rhodes plays the same four notes in both takes; only the bass note under them changes. Listen for how the chord changes its character: settled, or hanging and waiting to move.",
        skills: [{ skill: "J09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: OVER_D, caption: "Four open notes over a D in the bass.", bars: 2 },
          { code: OVER_G, caption: "The same four notes over a G.", bars: 2 },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Measure the stack",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      example: { id: "held-stack", code: HELD, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "measure-the-stack",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read the four Rhodes notes on the roll, from the bottom up. Count the half steps from each note to the next one up, then pick which of them has the same letter as the bass.",
        skills: [{ skill: "J09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the keys from D3 up to the next Rhodes note, every black key included, then check the other gaps the same way. Then compare the bass's letter with the lowest Rhodes note.",
        },
        hints: ladder(
          "Read the notes from the bottom: D, then three more above it.",
          "Count half steps one key at a time, black keys included. D to E is two; carry on to the next Rhodes note.",
          "D up to G: D♯, E, F, F♯, G. Every gap in the stack is the same size.",
        ),
        code: { starter: HELD },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many half steps from each note of the stack to the next one up?",
            correct: 5,
          },
          {
            q: "choice",
            prompt: "Which Rhodes note has the same letter as the bass?",
            options: [
              { id: "lowest", label: "The lowest, D" },
              { id: "highest", label: "The highest, F" },
              { id: "none", label: "None of them" },
            ],
            correct: ["lowest"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 5, choice: ["lowest"] } }, expect: "pass" },
          {
            name: "four: a major 3rd",
            response: { answer: { number: 4, choice: ["lowest"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "none: the bass is an octave down",
            response: { answer: { number: 5, choice: ["none"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Stack the 4ths",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      exercise: {
        kind: "code-modify",
        id: "stack-the-fourths",
        version: 1,
        role: "check",
        prompt:
          "Each bar gives the Rhodes one note. Turn each into a chord of four notes in note names: the given note at the bottom, then three more, each 5 half steps above the one below it. Keep `.struct()` and the rest of the chain. Done when every chord is four notes, 5 half steps apart.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: STACK_STARTER },
        reference: { solutions: [STACK_SOLUTION], bars: 4 },
        // Heard: each chord's pitch classes and lowest note (the given note), and the gaps between neighbouring
        // notes (all 5 half steps). A stack of 3rds, the same letters spread wider, or a stack built down from the
        // given note fail; the 4ths added in code pass.
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
            {
              m: "rubric",
              rules: [
                {
                  id: "fourths-apart",
                  label: "Every chord's neighbouring notes are 5 half steps apart",
                  required: true,
                  skills: ["J09"],
                  rule: "custom",
                  fn: "stack-intervals",
                  params: { track: "chords", semitones: [5] },
                },
              ],
            },
          ],
        },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Not yet: bar {bar} has other notes than the stack. Count 5 half steps up from the given note, then 5 more, then 5 more.",
          "harmony.bass":
            "Not yet: bar {bar} has the right letters with another note at the bottom. The given note stays the lowest; the stack grows upward from it.",
          "rubric.unmet":
            "{label}: not yet. Count the half steps between neighbouring notes of each chord, from the bottom up: every gap is 5.",
        },
        hints: ladder(
          "Start from the given note of bar 1 and count 5 half steps up: which note is that?",
          "Each chord is the given note plus the notes 5, 10 and 15 half steps above it, every one the next 4th up from the one below.",
          "Bar 3 starts on E. Its next note up is A, 5 half steps above it; two more 4ths finish the chord.",
        ),
        tests: [
          { name: "reference", response: { code: STACK_SOLUTION }, expect: "pass" },
          {
            name: "an octave up",
            response: {
              code: stackAnswer(chords("[d4,g4,c5,f5] [d4,g4,c5,f5] [e4,a4,d5,g5] [d4,g4,c5,f5]")),
            },
            expect: "pass",
          },
          {
            name: "the notes written top down",
            response: {
              code: stackAnswer(chords("[f4,c4,g3,d3] [f4,c4,g3,d3] [g4,d4,a3,e3] [f4,c4,g3,d3]")),
            },
            expect: "pass",
          },
          {
            name: "the 4ths added in code",
            response: { code: stackAnswer(`chords: note("<d3 d3 e3 d3>").add(note("[0,5,10,15]"))${COMP}`) },
            expect: "pass",
          },
          {
            name: "on the piano, softer",
            response: {
              code: stackAnswer(
                chords(LOOP, '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("piano").gain(.6)'),
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(STACK_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "stacks of 3rds: D F A C, E G B D",
            response: {
              code: stackAnswer(chords("[d3,f3,a3,c4] [d3,f3,a3,c4] [e3,g3,b3,d4] [d3,f3,a3,c4]")),
            },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right letters spread wide: D C G F",
            response: {
              code: stackAnswer(chords("[d3,c4,g4,f5] [d3,c4,g4,f5] [e3,d4,a4,g5] [d3,c4,g4,f5]")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the given note moved to the top: G C F D",
            response: {
              code: stackAnswer(chords("[g3,c4,f4,d5] [g3,c4,f4,d5] [a3,d4,g4,e5] [g3,c4,f4,d5]")),
            },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "the chord names from the dictionary with .voicing()",
            response: { code: stackAnswer(`chords: chord("<Dm11 Dm11 Em11 Dm11>").voicing()${COMP}`) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The bass names it",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      exercise: {
        kind: "code-modify",
        id: "the-bass-names-it",
        version: 1,
        role: "check",
        prompt:
          "The stack on D sounds as G7sus here, because the bass plays G and C under it. Change the bass notes so the stack reads as Dm11: the bass plays D, in any octave, under every moment the stack sounds. Keep the stack as it is.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: BASS_STARTER },
        reference: { solutions: [BASS_SOLUTION], bars: 4 },
        // Heard: at each moment the stack sounds, the lowest bass note under it with the stack makes a minor 11th,
        // in three moments of four. D only on beat 3, or D and its 5th, fail; D an octave lower passes.
        matcher: {
          m: "rubric",
          rules: [
            minorEleven("The bass under the stack makes it a minor 11th chord, all through the bar", 1),
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true },
        feedbackText: {
          "rubric.unmet":
            "Not yet: somewhere in the bar the stack still sounds over another bass note. Listen to the target: the chord stays dark and settled from beat 1 to the end of the bar.",
        },
        hints: ladder(
          "Which of the stack's four notes is the chord named after when it sounds settled?",
          "The bass plays two notes a bar, G then C. The stack's lowest note is D: the bass needs that letter under the whole bar.",
          "Keep two notes a bar if you like, but give both of them the letter of the stack's lowest note.",
        ),
        tests: [
          { name: "reference", response: { code: BASS_SOLUTION }, expect: "pass" },
          { name: "one D held all bar", response: { code: bassAnswer("d2") }, expect: "pass" },
          { name: "D on every beat", response: { code: bassAnswer("[d2 d2 d2 d2]") }, expect: "pass" },
          { name: "D and the D above", response: { code: bassAnswer("[d2 d3]") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: plain(BASS_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "D only on beat 3, G under beat 1",
            response: { code: bassAnswer("[g1 d2]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "D then its 5th, A",
            response: { code: bassAnswer("[d2 a1]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the stack changed instead: a D chord in 3rds over the old bass",
            response: { code: code(RIDE, bass("[g1 c2]"), 'chords: note("[d3,f3,a3,c4]").s("rhodes")') },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Which one is home",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "which-one-is-home",
        version: 1,
        role: "practice",
        prompt:
          "Each card plays a bar of A7, then the stack on D. Only the bass of the second bar differs. Pick the card whose second bar sounds like home.",
        skills: [{ skill: "J09", w: 1 }],
        hints: ladder(
          "Listen to the second bar of each card: does the chord settle, or does it keep leaning?",
          "A7 leans towards a chord on D. In one card the bass gives the stack that D; in the other it plays a G.",
          "The stack over G is G7sus, a chord that still waits to move.",
        ),
        stimulus: { src: "code", code: HANGS, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "hangs", label: "Card A", audio: HANGS },
            { id: "home", label: "Card B", audio: HOME },
          ],
        },
        correct: { choice: ["home"] },
        feedbackText: {
          "id.wrong":
            "Listen to card A again: after A7 the bass moves to G, and the same stack sounds as G7sus, still leaning somewhere else.",
        },
        tests: [
          { name: "home", response: { answer: { choice: ["home"] } }, expect: "pass" },
          {
            name: "the one that hangs",
            response: { answer: { choice: ["hangs"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your loop in 4ths",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "note",
        band: { band: "band.two-five-one", tracks: ["drums"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-loop-in-fourths",
        version: 1,
        role: "practice",
        title: "Fourths",
        prompt:
          "Here the bass plays G and A under the stacks, so every chord hangs. Make it your loop: stacks of 4ths in any rhythm, and a bass that makes every one a minor 11th, its lowest note under it. Also on the checklist: a 3rd on top of a stack, every gap 4 or 5 half steps.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          minorEleven(
            "Wherever three or more chord notes sound, the bass under them makes a minor 11th chord for at least three quarters of the time",
          ),
          {
            id: "fourths-or-a-third",
            label: "Every chord's neighbouring notes are 4 or 5 half steps apart",
            required: false,
            skills: ["J09"],
            rule: "custom",
            fn: "stack-intervals",
            params: { track: "chords", semitones: [5, 4] },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Listen to the starter: every chord hangs, because the bass plays G under the stacks on D and A under the one on E.",
          "A stack of 4ths over its own lowest note is a minor 11th chord. Give the bass that note under each stack.",
          "Bars 1, 2 and 4 stack up from D, bar 3 from E: the bass follows the stacks' lowest notes.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the bass under each stack's lowest note",
            response: { code: make(chords(LOOP), LOOP_BASS) },
            expect: "pass",
          },
          {
            name: "a 3rd on top of each stack",
            response: {
              code: make(
                chords("[d3,g3,c4,f4,a4] [d3,g3,c4,f4,a4] [e3,a3,d4,g4,b4] [d3,g3,c4,f4,a4]"),
                LOOP_BASS,
              ),
            },
            expect: "pass",
          },
          {
            name: "three-note stacks over D and E",
            response: { code: make(chords("[g3,c4,f4] [g3,c4,f4] [a3,d4,g4] [g3,c4,f4]"), LOOP_BASS) },
            expect: "pass",
          },
          {
            name: "held a bar each, the bass in two",
            response: { code: make(chords(LOOP, '.s("rhodes")'), bass("<[d2 d2] [d2 d3] [e2 e2] [d2 d2]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the stack moved up a half step for two bars, on the piano, 160 BPM",
            response: {
              code: make(
                chords(
                  `${ON_D}!2 [eb3,ab3,db4,gb4]!2`,
                  '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("piano")',
                ),
                bass("<d2!2 eb2!2>"),
              ).replace(`setcpm(${BPM}/4)`, "setcpm(160/4)"),
            },
            expect: "pass",
          },
          {
            name: "the bass a 4th below every stack",
            response: { code: make(chords(LOOP), bass("<g1 g1 a1 g1>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "held chords, the right bass only on beat 3",
            response: { code: make(chords(LOOP, '.s("rhodes")'), bass("<[g1 d2] [g1 d2] [a1 e2] [g1 d2]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "no bass at all",
            response: { code: make(chords(LOOP)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
