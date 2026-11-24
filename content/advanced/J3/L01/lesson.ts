// J3.L01 Rootless A/B Voicings (the J3 exemplar; spec: content/specs/J3.md). A jazz pianist leaves the root to
// the bass and plays four notes in the middle of the keyboard: 3 5 7 9 with the 3rd lowest (the A voicing) or
// 7 9 3 5 with the 7th lowest (the B voicing); on a dominant the 13th takes the 5th's place. Through a ii–V–I they
// alternate, A B A or B A B, so the hand hardly moves. `.dict("lefthand")` holds exactly these shapes;
// `.anchor()` sets how high the hand sits, and `.offset(1)` moves every chord to its next placement up, which in
// `lefthand` is the other shape.
//
// What the dictionary really does (evaluated, AUTHORING §20.5): `voicing()` places each chord of `lefthand` with
// its top note at or below the anchor (c5 by default), so in F the default plays Gm7 as A, C7 as B and F^7 as B,
// a jump up at F^7 (E4 G4 A4 C5); with `.anchor("a4")` it plays A B A (Bb3 D4 F4 A4 | Bb3 D4 E4 A4 | A3 C4 E4
// G4). `.offset(1)` before `.voicing()` gives B A B; after `.voicing()` it does nothing. `.mode("duck")` leaves out
// the one note EQUAL to the anchor so the chord does not double the melody (anchor A4: Gm7 plays Bb3 D4 F4); it
// does not remove the root, which the shapes have already left to the bass.
//
// Written for the learner at the gate (AUTHORING §20.1): J3 opens after U13.CP, J.CP1 and JC1, so it may be taken
// with U14–U17 unfinished; it uses what J1–J2.L03 and the core up to U13.CP guarantee, plus its own unlocks
// (`tb.mode.duck`, `tb.offset`). Key F: the track's key rotation (content/specs/J3.md conventions).
//
// The corrections-pass standard (AUTHORING §20.2) on every graded step: each rule reads what is heard (the pitch
// classes and the lowest note of every chord the Rhodes plays), each pins a wrong answer that uses the right
// function (`.offset(1)` after `.voicing()`, which does nothing; `.offset(2)`, the same shapes an octave up; the
// A voicing on every chord; the root kept on top), and three other right answers. The shape rule
// `voicing-shape` is planned; until the grader builds it, the hand voicings are graded by pitch-class set and
// lowest note (`pcset` with `bass`), which for a four-note rootless chord IS the shape: no root, and the 3rd (A)
// or the 7th (B) at the bottom.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 120;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** Comping on the Charleston (beat 1, the and of 2), swung, on the Rhodes. */
const COMP = '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")';
const handChords = (stacks: string, extra = COMP) => `chords: note("<${stacks}>")${extra}`;

/** The ii–V–I in F, one chord a bar, F^7 held for two. */
const CHANGES = "<Gm7 C7 F^7 F^7>";
/** Shells (J1.L05): root lowest, then the 3rd and 7th. G F B♭ | C E B♭ | F E A. */
const SHELLS = "[g2,f3,bb3] [c3,e3,bb3] [f2,e3,a3] [f2,e3,a3]";
/** Rootless, A B A: Gm7 3 5 7 9 | C7 ♭7 9 3 13 | F^7 3 5 7 9. Only F moves (to E) from Gm7 to C7. */
const ABA = "[bb3,d4,f4,a4] [bb3,d4,e4,a4] [a3,c4,e4,g4] [a3,c4,e4,g4]";
/** Rootless, B A B: Gm7 7 9 3 5 | C7 3 13 ♭7 9 | F^7 7 9 3 5. */
const BAB = "[f3,a3,bb3,d4] [e3,a3,bb3,d4] [e3,g3,a3,c4] [e3,g3,a3,c4]";

/** The rhythm section: the jazz kit's ride and hats, the upright on the roots in two. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
const BASS = 'bass: note("<[g2 d2] [c2 g1] [f1 c2] [f1 a1]>").s("upright")';
const lefthand = (calls: string) => `chords: chord("${CHANGES}").dict("lefthand")${calls}.voicing()${COMP}`;

const SHELL_TRIO = code(RIDE, HATS, BASS, handChords(SHELLS));
const ROOTLESS_TRIO = code(RIDE, HATS, BASS, handChords(ABA));
/** S2: the voicings alone, held a bar each, so the roll shows four notes standing still. */
const ROOTLESS_HELD = code(BASS, handChords(ABA, '.s("rhodes")'));

/** S4: the trio comps in shells; the learner rewrites the chords as rootless A B A. */
const HAND_STARTER = code(RIDE, BASS, `chords: note("<⟪${SHELLS}⟫>")${COMP}`);
const handAnswer = (line: string) => code(RIDE, BASS, line);
const HAND_SOLUTION = handAnswer(handChords(ABA));

/** S5: the dictionary with the hand at A4 plays A B A; the learner moves it to B A B with one call. */
const OFFSET_STARTER = code(
  RIDE,
  BASS,
  `chords: chord("${CHANGES}").dict("lefthand")⟪.anchor("a4")⟫.voicing()${COMP}`,
);
const offsetAnswer = (calls: string) => code(RIDE, BASS, lefthand(calls));
const OFFSET_SOLUTION = offsetAnswer('.anchor("a4").offset(1)');

/** S6: the vibes hold A4 over the comping; the second take keeps the chords off that note. */
const MEL = 'mel: note("a4").s("vibes")';
const DUCK_PAIR = code(
  BASS,
  MEL,
  `chords: chord("${CHANGES}").dict("lefthand").anchor("a4").mode("duck").voicing().s("rhodes").gain(.6)`,
);

/** S7: the Band plays drums and bass; the learner's comping starts in shells. */
const MAKE_STARTER = code(handChords(SHELLS));
const makeAnswer = (...lines: string[]) => code(...lines);

const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** The chords are the dictionary's (`.dict("lefthand")` before `.voicing()`, really in force). */
const LEFTHAND_IN_FORCE: RubricRule = {
  id: "lefthand",
  label: "The chords line takes its notes from the left-hand dictionary",
  required: true,
  skills: ["J09"],
  rule: "custom",
  fn: "voiced-with",
  params: { track: "chords", dict: "lefthand" },
};

/** Rootless and alternating: the pitch classes and the lowest note of every chord, A B A or B A B, in F. */
const ROOTLESS_REF = (stacks: string) => code(`chords: note("<${stacks}>").s("rhodes")`);
const ALTERNATES: RubricRule = {
  id: "rootless-alternating",
  label:
    "Every chord is a four-note rootless voicing on beat 1, the lowest note alternating between a 3rd and a 7th (A B A or B A B)",
  required: true,
  skills: ["J09"],
  rule: "matches",
  min: 1,
  reference: { solutions: [ROOTLESS_REF(ABA), ROOTLESS_REF(BAB)], bars: 4 },
  matcher: { m: "pcset", perOnset: false, bass: true, tracks: ["chords"] },
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "J3.L01",
  version: 4,
  title: "Rootless A/B Voicings",
  objective:
    "I can voice a ii–V–I with rootless A and B voicings, by hand and with the left-hand dictionary.",
  key: { tonic: "F", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: ["J09"],
  practises: [],
  terms: [
    { id: "term.a-voicing", step: "S2" },
    { id: "term.b-voicing", step: "S2" },
  ],
  canDo: ["cd.code.rootless"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Shells, then four notes in the middle",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "rootless-trio", code: ROOTLESS_TRIO, bars: 4 },
      exercise: {
        kind: "listen",
        id: "shells-then-rootless",
        version: 1,
        role: "practice",
        prompt:
          "Bass and drums are the same both times. Listen to the Rhodes in both takes. Notice which take sounds richer, and where on the keyboard each one sits: low, or in the middle.",
        skills: [{ skill: "J09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: SHELL_TRIO,
            caption: "Shells, as you comped them before.",
            bars: 4,
          },
          {
            code: ROOTLESS_TRIO,
            caption: "The same changes, in a new shape on the Rhodes.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "What is missing, what moves",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "rootless-held", code: ROOTLESS_HELD, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "what-is-missing",
        version: 1,
        role: "practice",
        prompt:
          "Run it, read the roll and answer two questions: which note of Gm7 the Rhodes leaves out in bar 1, and how many of its four notes move from bar 1 to bar 2.",
        skills: [{ skill: "J09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Name the four notes of the first chord from the bottom, then compare them with G B♭ D F A, a Gm7 with its 9th. Then count how many of the four change at bar 2.",
        },
        hints: ladder(
          "Gm7 with its 9th is G, B♭, D, F, A. Name the four notes of bar 1 on the roll and find the one of those five that is missing.",
          "The bass plays G under bar 1. Now compare bar 1 and bar 2 note by note: three of them stay where they are.",
          "The chord is B♭ D F A. At bar 2 the F slides down to the note just below it.",
        ),
        code: { starter: ROOTLESS_HELD },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which note of Gm7 does the Rhodes leave out in bar 1?",
            options: [
              { id: "root", label: "G, the root" },
              { id: "fifth", label: "D, the 5th" },
              { id: "seventh", label: "F, the 7th" },
            ],
            correct: ["root"],
          },
          {
            q: "number",
            prompt: "From bar 1 to bar 2, how many of the Rhodes' four notes move?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["root"], number: 1 } }, expect: "pass" },
          {
            name: "the 5th: read a shell into it",
            response: { answer: { choice: ["fifth"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "four: every note of a new chord",
            response: { answer: { choice: ["root"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Build the A voicing of Fmaj7",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS, band: false },
      exercise: {
        kind: "keyboard",
        id: "build-a-voicing",
        version: 1,
        role: "check",
        prompt:
          "Play the A voicing of Fmaj7 on the keyboard: no F, its 3rd at the bottom, and the 5th, the 7th and the 9th above it.",
        skills: [{ skill: "J09", w: 1 }],
        hints: ladder(
          "Start from the 3rd of Fmaj7: it goes at the bottom.",
          "Fmaj7 is F A C E; its 9th is G. The A voicing leaves F to the bass and stacks the other four from the 3rd up.",
          "Start on A, then C and E. One more note on top: the 9th, a step above the root F.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [9, 0, 4, 7], bassPc: 9 },
        pitchMode: "octave-free",
        feedbackText: {
          "kb.bass":
            "Those are the right four notes with {got} at the bottom. An A voicing stands on the chord's 3rd.",
          "kb.extra-note":
            "{got} doesn't belong: the voicing leaves the root to the bass and keeps four notes.",
          "kb.missing-note": "{exp} is missing: the voicing has the 3rd, the 5th, the 7th and the 9th.",
        },
        tests: [
          { name: "A C E G", response: { answer: { midi: [57, 60, 64, 67] } }, expect: "pass" },
          { name: "an octave up", response: { answer: { midi: [69, 72, 76, 79] } }, expect: "pass" },
          { name: "spread: A E G C", response: { answer: { midi: [57, 64, 67, 72] } }, expect: "pass" },
          {
            name: "the B voicing: E G A C",
            response: { answer: { midi: [52, 55, 57, 60] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
          {
            name: "the root kept: F A C E G",
            response: { answer: { midi: [53, 57, 60, 64, 67] } },
            expect: "fail",
            feedback: ["kb.extra-note"],
          },
          {
            name: "close Fmaj7 from its 3rd, no 9th: A C E F",
            response: { answer: { midi: [57, 60, 64, 65] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "From shells to A B A",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "shells-to-rootless",
        version: 1,
        role: "check",
        prompt:
          "The Rhodes comps in shells. Rewrite the four chords in note names as rootless voicings: Gm7 as an A voicing, C7 as a B voicing, Fmaj7 (bars 3 and 4) as an A voicing. Each is four notes with no root. Keep `.struct()` and the rest of the chain.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: HAND_STARTER },
        reference: { solutions: [HAND_SOLUTION], bars: 4 },
        // A rootless chord heard: its pitch classes at each onset (3, 5 or 13, 7, 9; no root) and its lowest
        // note (the 3rd for A, the 7th for B). The root kept on top, or an A voicing on C7, fails.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Not yet: one chord has a note too many or too few. Each chord is four notes, no root, with the 9th in it.",
          "harmony.bass":
            "Not yet: the right notes with the wrong one at the bottom. An A voicing stands on the chord's 3rd, a B voicing on its 7th.",
        },
        hints: ladder(
          "Look at the lowest note of each shell: the bass already plays it. A rootless voicing leaves it out.",
          "Leave the root to the bass. Gm7's A voicing is its 3rd, 5th, 7th and 9th from the 3rd up; C7's B voicing starts on its 7th.",
          "Bar 1 is `[bb3,d4,f4,a4]`. Bar 2 keeps three of those notes and moves F down a half step.",
        ),
        tests: [
          { name: "reference", response: { code: HAND_SOLUTION }, expect: "pass" },
          {
            name: "an octave up",
            response: {
              code: handAnswer(handChords("[bb4,d5,f5,a5] [bb4,d5,e5,a5] [a4,c5,e5,g5] [a4,c5,e5,g5]")),
            },
            expect: "pass",
          },
          {
            name: "the notes written top down",
            response: {
              code: handAnswer(handChords("[a4,f4,d4,bb3] [a4,e4,d4,bb3] [g4,e4,c4,a3] [g4,e4,c4,a3]")),
            },
            expect: "pass",
          },
          {
            name: "the dictionary with the hand at A4",
            response: { code: handAnswer(lefthand('.anchor("a4")')) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(HAND_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the root kept on top: five notes",
            response: {
              code: handAnswer(
                handChords("[bb3,d4,f4,a4,g4] [bb3,d4,e4,a4,c5] [a3,c4,e4,g4,f4] [a3,c4,e4,g4,f4]"),
              ),
            },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "an A voicing on every chord: C7 stands on its 3rd",
            response: {
              code: handAnswer(handChords("[bb3,d4,f4,a4] [e3,a3,bb3,d4] [a3,c4,e4,g4] [a3,c4,e4,g4]")),
            },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "the dictionary as it comes: Fmaj7 jumps to a B voicing",
            response: { code: handAnswer(lefthand("")) },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "The other way round: B A B",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "offset-to-b",
        version: 1,
        role: "check",
        prompt:
          "Anchored at A4, the dictionary plays what you wrote: A B A. Add one call before `.voicing()` so every chord moves to the dictionary's other placement and the progression runs B A B. Keep the dictionary and the anchor. Done when the first chord stands on F, the 7th of Gm7.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: OFFSET_STARTER },
        reference: { solutions: [OFFSET_SOLUTION], bars: 4 },
        // Heard: each chord flips shape (B A B: Gm7 and Fmaj7 on their 7ths, C7 on its 3rd), and the chords are
        // still the dictionary's. `.offset(1)` after `.voicing()` changes nothing; `.offset(2)` is A B A an octave up.
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
            { m: "rubric", rules: [LEFTHAND_IN_FORCE] },
          ],
        },
        target: { audible: true },
        feedbackText: {
          "harmony.bass":
            "Not yet: the bottom notes still spell A B A. Listen to the target: its first chord stands on F, Gm7's 7th.",
          "rubric.unmet": "{label}: not yet. The chords should still come from the dictionary.",
        },
        hints: ladder(
          "Compare the lowest note of each chord now with the target's: Gm7 should stand on its 7th, not its 3rd.",
          "The dictionary keeps two shapes for each chord. A call between `.dict()` and `.voicing()` moves every chord to its next placement up.",
          "The call takes a number, `1` for one placement up, and it goes before `.voicing()`.",
        ),
        tests: [
          { name: "reference", response: { code: OFFSET_SOLUTION }, expect: "pass" },
          {
            name: "one placement down",
            response: { code: offsetAnswer('.anchor("a4").offset(-1)') },
            expect: "pass",
          },
          {
            name: "three placements up",
            response: { code: offsetAnswer('.anchor("a4").offset(3)') },
            expect: "pass",
          },
          {
            name: "the hand moved to D5 instead",
            response: { code: offsetAnswer('.anchor("d5")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(OFFSET_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right call after .voicing(): nothing moves",
            response: {
              code: code(
                RIDE,
                BASS,
                `chords: chord("${CHANGES}").dict("lefthand").anchor("a4").voicing().offset(1)${COMP}`,
              ),
            },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "two placements up: A B A an octave higher",
            response: { code: offsetAnswer('.anchor("a4").offset(2)') },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "B A B by hand: right notes, not the dictionary",
            response: { code: handAnswer(handChords(BAB)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "investigate",
      title: "Keep off the melody's note",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "duck", code: DUCK_PAIR, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "what-duck-leaves-out",
        version: 1,
        role: "practice",
        prompt:
          'The vibes hold A4 over the ii–V–I, and the dictionary\'s hand sits at A4 too. Run it, then delete `.mode("duck")` and run it again. Pick what that call left out of Gm7 and C7.',
        skills: [{ skill: "J09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare the Rhodes' top note in bar 1 with and without the call, and look at what the vibes play there.",
        },
        hints: ladder(
          "Run it without the call and read bar 1: one note sounds in both the Rhodes and the vibes.",
          "With the call, Gm7 has three notes. The missing one is the note the hand was anchored on.",
          "The bass still plays G, and the Rhodes still has B♭ at the bottom: the missing note is on top.",
        ),
        code: { starter: DUCK_PAIR },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: 'What does `.mode("duck")` leave out of Gm7 and C7?',
            options: [
              { id: "melody-note", label: "A4, the note the vibes hold" },
              { id: "root", label: "The root" },
              { id: "bottom", label: "The lowest note" },
            ],
            correct: ["melody-note"],
          },
        ],
        tests: [
          { name: "the melody's note", response: { answer: { choice: ["melody-note"] } }, expect: "pass" },
          {
            name: "the root: the shapes have no root to leave out",
            response: { answer: { choice: ["root"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your rootless comping",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.two-five-one", tracks: ["drums", "bass"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-rootless-comping",
        version: 1,
        role: "practice",
        title: "Rootless ii–V–I",
        prompt:
          "Turn the shells into rootless voicings for your song's opening and the first four bars of each time through, all in F. Each chord is four notes, no root, sounding on beat 1 of its bar, the lowest note alternating A B A or B A B. Write them by hand or with the dictionary.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          ALTERNATES,
          {
            id: "swing-tempo",
            label: "`setcpm` sets a tempo between 100 and 180 beats a minute",
            required: false,
            skills: ["R13"],
            rule: "tempo-bpm",
            min: 100,
            max: 180,
          },
          {
            id: "tune-on-top",
            label: "A vibes line plays with the chords",
            required: false,
            skills: ["J09"],
            rule: "sounds",
            contains: ["snd.vibes"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral. The rhythm is
        // the learner's, so a chord that starts after the bar line is described by its sound, not as "late".
        feedbackText: {
          "rubric.unmet": "{label}: not yet.",
          "harmony.pcset":
            "Listen to bar {bar}: that chord has a note too many or too few. A rootless voicing is four notes, no root, the 9th in it.",
          "harmony.bass":
            "Bar {bar}: the right notes, with the other shape's note at the bottom. From chord to chord the lowest note moves between a 3rd and a 7th.",
          "harmony.shifted":
            "Listen to the first beat of each bar: a chord sounds there, four notes with no root, and its lowest note moves between a 3rd and a 7th from one chord to the next.",
        },
        hints: ladder(
          "Start from the shells: the bass already plays each chord's root, so the voicing can leave it out and add the 9th.",
          "Four notes a chord, no root, the 9th added; the bottom note alternates between a 3rd and a 7th from chord to chord.",
          'One way: `chord("<Gm7 C7 F^7 F^7>").dict("lefthand")` with the hand anchored at A4, before `.voicing()`.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: A B A by hand on the Charleston",
            response: { code: makeAnswer(handChords(ABA)) },
            expect: "pass",
          },
          {
            name: "B A B by hand, held a bar each",
            response: { code: makeAnswer(handChords(BAB, '.s("rhodes")')) },
            expect: "pass",
          },
          {
            name: "the dictionary at A4, softer, with a vibes line",
            response: {
              code: makeAnswer(
                lefthand('.anchor("a4")').replace(
                  COMP,
                  '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.7)',
                ),
                'mel: n("<[4 ~ 3 ~] [2 ~ ~ 1] [2 ~ 4 ~] [6 ~ ~ ~]>").scale("F4:major").swingBy(1/3, 4).s("vibes")',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: B A B from the dictionary on the piano, faster",
            response: {
              code: makeAnswer(
                lefthand('.anchor("a4").offset(1)').replace('.s("rhodes")', '.s("piano")'),
              ).replace(`setcpm(${BPM}/4)`, "setcpm(160/4)"),
            },
            expect: "pass",
          },
          {
            name: "the dictionary as it comes: A B B, a jump at Fmaj7",
            response: { code: makeAnswer(lefthand("")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the A voicing on every chord",
            response: {
              code: makeAnswer(handChords("[bb3,d4,f4,a4] [e3,a3,bb3,d4] [a3,c4,e4,g4] [a3,c4,e4,g4]")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "rootless, but no chord on the first beat of a bar",
            response: {
              code: makeAnswer(handChords(ABA, '.struct("~ x ~ x").swingBy(1/3, 4).s("rhodes")')),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
