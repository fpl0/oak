// J1.L05 Shells (spec: content/specs/J1.md). A shell voicing is three notes: the root at the bottom, with the 3rd
// and the 7th above it (root–3–7 or root–7–3). It says everything the chord's quality needs and leaves room for
// the bass and the melody. The learner comps their own swinging ii–V–I in shells, written by hand, over the
// rhythm section.
//
// Evaluated (headless Strudel): the shells D3 F3 C4 | G2 F3 B3 | C3 E3 B3 move by a half step or stay in the two
// upper voices (F stays, C falls to B; F falls to E, B stays): the guide-tone threads of J1.L04 with a root under
// them. `n("0 1 2 3").set(chord(changes)).voicing()` plays the voicing's notes one at a time, lowest first, so one
// chord string drives the vibes and the bass (`rootNotes`).
//
// Written for the learner at the gate (AUTHORING §20.1): J1 opens after U13.CP and may be taken with U14–U17
// unfinished, so the lesson uses what U13.CP guarantees, J1.L01–L04, and its own unlocks (`tb.set`,
// `tb.voicing.n`). Rootless, drop-2 and the left-hand dictionary's shapes wait for J3.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S3 (keyboard): the pitch classes and the lowest note (`pcs` + `bassPc`, octave-free: a shell in any spread);
//   the full Fmaj7 (the right chord, four notes) fails, as do the triad, the 3rd at the bottom and F7's shell.
//   The spec's `expect.voicing` is the feature `keyboard.voicing` (graded and rendered, not yet in IMPLEMENTED);
//   for a three-note chord the pitch classes plus the lowest note ARE the shell, so the grade is the same.
// - S4 (shells in code): the pitch classes and the lowest note at every onset of the Rhodes (`pcset` with `bass`,
//   so the Charleston rhythm is kept) AND the shape (`voicing-shape`, octave-aware): four-note close chords with
//   the root at the bottom (the right pitch classes plus the 5th), the 5th for the 7th, the dictionary's voicings
//   and the shells at `.gain(0)` fail; root–7–3 shells, another register and another sound pass.
// - Make: `voicing-shape` (shell) against the given changes: the starter's `voicing()` line, close four-note
//   chords, triads and silent shells fail.
// No hint below rung 4 and no feedback override names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 132;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const CHANGES_CONST = 'const changes = "<Dm7 G7 C^7 C^7>"\n';
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A loop whose parts read the one chord string. */
const withChanges = (...lines: string[]) => `${TEMPO}${CHANGES_CONST}\n${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const CYCLE = ["Dm7", "G7", "C^7", "C^7"];

/** The rhythm section of J1.L01: ride and hi-hat on the jazz kit, the upright in two. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
const BASS = 'bass: note("<[d2 a1] [g1 d2] [c2 g1] [c2 e2]>").s("upright")';
/** Comping on the Charleston (beat 1, the and of 2), swung, on the Rhodes. */
const COMP = '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")';
const hand = (stacks: string, tail = COMP) => `chords: note("<${stacks}>")${tail}`;

/** Shells: D F C (root, 3rd, 7th) | G F B (root, 7th, 3rd) | C E B (root, 3rd, 7th). */
const SHELLS = "[d3,f3,c4] [g2,f3,b3] [c3,e3,b3] [c3,e3,b3]";
/** The same chords with the 7th under the 3rd where the shells above have it over: D C F | G B F | C B E. */
const SHELLS_737 = "[d3,c4,f4] [g2,b3,f4] [c3,b3,e4] [c3,b3,e4]";

const EMPTY_CHAIR = code(RIDE, HATS, BASS);
const SHELL_TRIO = code(RIDE, HATS, BASS, hand(SHELLS));
/** S2: the shells held a bar each over the bass, so the roll shows three notes standing still. */
const SHELLS_HELD = code(BASS, hand(SHELLS, '.s("rhodes")'));

/** S4: the backing gives `changes`; the Rhodes comps full voicings; the learner rewrites them as shells. */
const FULL = `chords: ⟪chord(changes).voicing()⟫${COMP}`;
const shellAnswer = (line: string) => withChanges(RIDE, BASS, line);
const SHELL_STARTER = shellAnswer(FULL);
const SHELL_SOLUTION = shellAnswer(hand(SHELLS));

/** S5: one chord string drives the bass and the vibes; the shells are the learner's own notes. */
const ARP =
  'mel: n("0 1 2 3 2 1 0 ~").set(chord(changes)).dict("lefthand").voicing().swingBy(1/3, 4).s("vibes")';
const ONE_STRING = withChanges(
  RIDE,
  HATS,
  'bass: chord(changes).rootNotes(2).s("upright")',
  hand(SHELLS),
  ARP,
);

/** The Make: the Band plays drums and bass; the Rhodes starts on the default dictionary's full chords. */
const MAKE_STARTER = withChanges(`chords: chord(changes).voicing()${COMP}`);
const makeAnswer = (...lines: string[]) => withChanges(...lines);

const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** Every chord a shell: three notes, the root at the bottom, the 3rd and the 7th above it, against the cycle. */
const SHELLS_RULE: RubricRule = {
  id: "shells",
  label: "Every chord is a shell: the root lowest, then the 3rd and the 7th, nothing else",
  required: true,
  skills: ["J08"],
  rule: "custom",
  fn: "voicing-shape",
  params: { track: "chords", shape: ["shell"], changes: CYCLE },
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;
const DRUMS_BASS = { band: "band.two-five-one", tracks: ["drums", "bass"] } as const;

export default defineLesson({
  id: "J1.L05",
  version: 4,
  title: "Shells",
  objective: "I can voice a ii–V–I in shells, root, 3rd and 7th, and comp it in a swinging trio.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J08"],
  practises: [],
  terms: [{ id: "term.shell-voicing", step: "S2" }],
  canDo: ["cd.code.shells"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The empty chair",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      example: { id: "shell-trio", code: SHELL_TRIO, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-empty-chair",
        version: 1,
        role: "practice",
        prompt:
          "Listen to what the Rhodes adds in the second loop. Notice whether it fills the room or leaves space around the bass and the ride.",
        skills: [{ skill: "J08", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: EMPTY_CHAIR,
            caption: "Ride, hi-hat and bass under a ii–V–I in C. Nobody on the piano.",
            bars: 4,
          },
          {
            code: SHELL_TRIO,
            caption: "The same groove with a pianist's left hand on the Rhodes.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Three notes",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords", "chord-tones"] },
      example: { id: "shells-held", code: SHELLS_HELD, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "three-notes",
        version: 1,
        role: "practice",
        prompt:
          "Run the left hand alone, held a bar a chord. The chord-tone lens names each note. Answer two questions: how many notes each chord has, and which members of G7 the left hand plays in bar 2.",
        skills: [{ skill: "J08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the notes of one chord on the roll, then read the lens over bar 2 from the lowest note up.",
        },
        hints: ladder(
          "Read bar 2 from its lowest note up and name each note's member of G7. Check whether the 5th is there at all.",
          "G7 is G B D F. The lens marks each note of bar 2 as one of those members.",
          "The lowest note of bar 2 is G, the root. Above it are two of B, D and F; one of the three is left out.",
        ),
        code: { starter: SHELLS_HELD },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many notes does each chord have?", correct: 3 },
          {
            q: "choice",
            prompt: "Which members of G7 does the left hand play in bar 2?",
            options: [
              { id: "1-7-3", label: "G, F, B: the root, the 7th and the 3rd" },
              { id: "1-3-5", label: "G, B, D: the root, the 3rd and the 5th" },
              { id: "3-5-7", label: "B, D, F: the 3rd, the 5th and the 7th" },
            ],
            correct: ["1-7-3"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["1-7-3"] } }, expect: "pass" },
          {
            name: "the triad",
            response: { answer: { number: 3, choice: ["1-3-5"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "four notes",
            response: { answer: { number: 4, choice: ["1-7-3"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "A shell of Fmaj7",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "shell-of-fmaj7",
        version: 1,
        role: "check",
        prompt:
          "Play a shell of Fmaj7 on the keyboard: three notes, F at the bottom, then its 3rd and its 7th.",
        skills: [{ skill: "J08", w: 1 }],
        hints: ladder(
          "Fmaj7 has four notes and a shell keeps three. Find the one it leaves out.",
          "Fmaj7 is F A C E. A shell keeps the root at the bottom and the two notes that name the quality above it.",
          "F at the bottom, then the 3rd of Fmaj7, then one more note: not C.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c6"], mode: "chord" },
        expect: { pcs: [5, 9, 4], bassPc: 5 },
        pitchMode: "octave-free",
        srs: [{ family: "fam.jzz.voicing", mode: "seed" }],
        // The catalog names the missing note; these name the member instead (no answer below rung 4).
        feedbackText: {
          "kb.extra-note":
            "{got} doesn't belong in a shell. Three notes: the root, and the two that name the quality.",
          "kb.missing-note": "One of the two notes that name the quality is missing.",
          "kb.bass": "The root goes at the bottom of a shell; here another note is lowest.",
        },
        tests: [
          { name: "F A E", response: { answer: { midi: [53, 57, 64] } }, expect: "pass" },
          {
            name: "F E A: the 7th under the 3rd",
            response: { answer: { midi: [53, 64, 69] } },
            expect: "pass",
          },
          { name: "an octave up: F A E", response: { answer: { midi: [65, 69, 76] } }, expect: "pass" },
          { name: "spread: F3 A4 E5", response: { answer: { midi: [53, 69, 76] } }, expect: "pass" },
          {
            name: "the whole Fmaj7: F A C E",
            response: { answer: { midi: [53, 57, 60, 64] } },
            expect: "fail",
            feedback: ["kb.extra-note"],
          },
          {
            name: "the triad: F A C",
            response: { answer: { midi: [53, 57, 60] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "A at the bottom",
            response: { answer: { midi: [57, 64, 65] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
          {
            name: "F7's shell: F A E♭",
            response: { answer: { midi: [53, 57, 63] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Shells by hand",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords", "chord-tones"] },
      exercise: {
        kind: "code-modify",
        id: "shells-by-hand",
        version: 1,
        role: "check",
        prompt:
          "Replace `chord(changes).voicing()` with chords you write as note names: one bracket of three notes for each bar, Dm7, G7, Cmaj7, Cmaj7. Each is a shell: the root lowest, then the 3rd and the 7th. Keep `.struct()` and the rest of the chain. Done when every chord is a three-note shell.",
        skills: [{ skill: "J08", w: 1 }],
        swing: SWUNG,
        code: { starter: SHELL_STARTER },
        reference: { solutions: [SHELL_SOLUTION], bars: 4 },
        // What is heard (the pitch classes and the lowest note at each onset of the Rhodes, so the rhythm too)
        // and the shape, octave-aware: three notes, the root lowest, the 3rd and 7th above it.
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
            {
              m: "rhythm",
              tol: [1, 16],
              durations: false,
              perRole: false,
              displacementCredit: 0.5,
              tracks: ["chords"],
            },
            { m: "rubric", rules: [SHELLS_RULE] },
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: the Rhodes plays other notes than the target's. A shell keeps the root and the two notes that name the chord's quality, and nothing else.",
          "harmony.bass": "Bar {bar}: the lowest note of the chord is not its root.",
          "rhythm.missing": "Bar {bar}, {beatLabel}: the target comps a chord here and yours does not.",
          "rhythm.extra": "Bar {bar}, {beatLabel}: a chord here that the target leaves out.",
          "rubric.unmet":
            "{label}: not yet. Count the notes of each chord and check which one sits at the bottom.",
        },
        hints: ladder(
          "Start with Dm7, D F A C. A shell keeps three of those four notes, with the root lowest.",
          "Dm7 is D F A C: the root at the bottom, then the 3rd and the 7th. A chord in note names is a bracket with commas, lowest note first.",
          "Bar 1 is `[d3,f3,c4]`. For G7 put G at the bottom and its 3rd and 7th above it; Cmaj7 the same.",
        ),
        tests: [
          { name: "reference", response: { code: SHELL_SOLUTION }, expect: "pass" },
          {
            name: "the 7th under the 3rd",
            response: { code: shellAnswer(hand(SHELLS_737)) },
            expect: "pass",
          },
          {
            name: "the last chord written with !",
            response: { code: shellAnswer(hand("[d3,f3,c4] [g2,f3,b3] [c3,e3,b3]!2")) },
            expect: "pass",
          },
          {
            name: "an octave up, on the piano",
            response: {
              code: shellAnswer(
                hand("[d4,f4,c5] [g3,f4,b4] [c4,e4,b4] [c4,e4,b4]", COMP.replace("rhodes", "piano")),
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(SHELL_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the 5th for the 7th: triads",
            response: { code: shellAnswer(hand("[d3,f3,a3] [g2,b2,d3] [c3,e3,g3] [c3,e3,g3]")) },
            expect: "fail",
            feedback: ["harmony.pcset", "rubric.unmet"],
          },
          {
            name: "by hand with four notes: close chords, root at the bottom",
            response: { code: shellAnswer(hand("[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [c3,e3,g3,b3]")) },
            expect: "fail",
            feedback: ["harmony.pcset", "rubric.unmet"],
          },
          {
            name: "the left-hand dictionary: still the dictionary's shapes",
            response: { code: shellAnswer(`chords: chord(changes).dict("lefthand").voicing()${COMP}`) },
            expect: "fail",
            feedback: ["harmony.pcset", "rubric.unmet"],
          },
          {
            name: "the right shells, all held from beat 1: the comping rhythm lost",
            response: { code: shellAnswer(hand(SHELLS, '.s("rhodes")')) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "the right shells, silent: .gain(0)",
            response: { code: shellAnswer(hand(SHELLS, `${COMP}.gain(0)`)) },
            expect: "fail",
            feedback: ["harmony.pcset", "rhythm.missing", "rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "see",
      title: "One chord string",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: false },
      example: { id: "one-string", code: ONE_STRING, bars: 4 },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your left hand",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS_BASS, initialPanels: ["chords", "chord-tones"] },
      exercise: {
        kind: "code-make",
        id: "your-left-hand",
        version: 1,
        role: "practice",
        title: "Shell comping",
        prompt:
          "Comp your song's three A sections: write the ii–V–I in C (Dm7, G7, Cmaj7, Cmaj7) as shells in note names. Required: each chord is the root at the bottom with its 3rd and 7th above. Also on the checklist: at least two chords off the beat, with the beat after each silent, such as the and of 2.",
        skills: [{ skill: "J08", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          { ...SHELLS_RULE, params: { ...SHELLS_RULE.params, minRatio: 0.75 } },
          {
            id: "comping-pushes",
            label: "At least 2 chords land off the beat, with no chord on the beat after them",
            required: false,
            skills: ["R13"],
            rule: "syncopation",
            track: "chords",
            min: 2,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Replace the dictionary voicing with chords you write yourself as note names, one bracket per bar.",
          "A shell is three notes: the root at the bottom, then the 3rd and the 7th, in either order. Write each chord as a bracket of note names.",
          "Dm7 can be `[d3,f3,c4]`. Give G7 and Cmaj7 the same treatment, and keep or change the rhythm after the chords.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: shells, held a bar each",
            response: { code: makeAnswer(hand(SHELLS, '.s("rhodes")')) },
            expect: "pass",
          },
          {
            name: "a push on the and of 4, swung",
            response: {
              code: makeAnswer(hand(SHELLS_737, '.struct("x ~ ~ ~ ~ ~ ~ x").swingBy(1/3, 4).s("rhodes")')),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: Charleston shells, the ride and a vibes line from the chord string",
            response: { code: makeAnswer(RIDE, HATS, hand(SHELLS), ARP) },
            expect: "pass",
          },
          {
            name: "an octave up on the piano, on beats 2 and 4",
            response: {
              code: makeAnswer(
                hand("[d4,f4,c5] [g3,f4,b4] [c4,e4,b4] [c4,e4,b4]", '.struct("~ x ~ x").s("piano")'),
              ),
            },
            expect: "pass",
          },
          {
            name: "close four-note chords by hand",
            response: { code: makeAnswer(hand("[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [c3,e3,g3,b3]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "triads by hand",
            response: { code: makeAnswer(hand("[d3,f3,a3] [g2,b2,d3] [c3,e3,g3] [c3,e3,g3]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right shells, silent: .gain(0)",
            response: { code: makeAnswer(hand(SHELLS, `${COMP}.gain(0)`)) },
            expect: "fail",
            feedback: ["make.silent"],
          },
        ],
      },
    },
  ],
});
