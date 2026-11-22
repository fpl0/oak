// J5.L05 Coltrane Changes (spec: content/specs/J5.md). Enrichment: not gated, in no checkpoint. Three keys a major
// 3rd apart, B, G and E♭, split the octave into three equal parts; reach each one through its own V7 and a ii–V–I
// can travel through all three in eight bars. The farthest reach of the substitutions: in place of one V7, a chain
// of new homes, each with its own dominant.
//
// Written for the learner at the gate (AUTHORING §20.1): J5 opens after U17.CP and J4.L04, so the whole core (key
// changes, U17), J1–J4 and J5.L01–L04 are behind the learner. The lesson unlocks no tool. Heard from B (S1, S2),
// written from C (S3), played over in C (S4). Brisk swing at 144 BPM; the Rhodes comps on the Charleston, anchored
// at D4 so the tenor's line stays on top (evaluated: the highest chord note is D4, the tenor's lowest D♯4).
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - what is HEARD: S3 compares the chords that sound and their lowest note at each onset (`pcset` per onset with the
//   bass), so the right root with the wrong quality fails; the Make's `guide-tones` judges the notes the tenor plays
//   at each change against the GIVEN changes, so putting the plain ii–V–I back under a plain line cannot pass, and a
//   muted tenor has no notes;
// - each graded step pins a wrong answer that uses the right idea in the wrong way (the old key's V7 a half step
//   off, a dominant where the new home is, the right root with no dominant; in the Make the plain ii–V–I's guide
//   tones, the right notes a bar late, a line of 3rds and 7ths that leaps) and three other right answers (C♭7 for
//   B7, `!` for the repeated chord, the bass written by hand; in the Make a line in the low octave, a line that
//   lands on 7ths, a swung line with passing notes at another tempo).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 144;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const SWING = ".swingBy(1/3, 4)";
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const C = { tonic: "C", mode: "major" } as const;

/** The trio of J1: the ride pattern and the hi-hat on 2 and 4 on the jazz kit. */
const RIDE = `drums: s("rd [rd rd] rd [rd rd]")${SWING}.bank("jazzkit")`;
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** Rhodes comping on the Charleston in the left hand's voicings, anchored at D4 under the tenor. */
const COMP = `chords: chord(changes).dict("lefthand").anchor("d4").voicing().struct("x ~ ~ x ~ ~ ~ ~")${SWING}.s("rhodes").gain(.6)`;
/** A bass in two from the same string: the root on 1 and 3. */
const ROOTS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")';
const trio = (changes: string, ...lines: string[]) =>
  code(`const changes = "${changes}"`, "", RIDE, HATS, COMP, ROOTS, ...lines);

/**
 * The hook: the cycle from B. The tenor plays one note a bar: each home's 3rd, and on each V7 its 7th, which falls
 * a half step onto the next home's 3rd (C to B, A♭ to G, E to D♯). In eight bars the line falls exactly one octave,
 * D♯5 to D♯4 (evaluated).
 */
const CYCLE = "<B^7 D7 G^7 Bb7 Eb^7 F#7 B^7 B^7>";
const GUIDE_LINE = 'mel: note("<d#5 c5 b4 ab4 g4 e4 d#4 ~>").s("tenor")';
const HOOK = trio(CYCLE, GUIDE_LINE);
const HOOK_BARE = trio(CYCLE);

/** S2: the three homes alone, a bar each, back to B. */
const HOMES = code(
  'const changes = "<B^7 G^7 Eb^7 B^7>"',
  "",
  'chords: chord(changes).dict("lefthand").anchor("d4").voicing().s("rhodes").gain(.6)',
  'bass: note("<b2 g2 eb2 b1>").s("upright")',
);

/** S3: a ii–V–I in C with a detour through two more keys; the learner writes bars 4 and 5. */
const MODIFY_STARTER = trio("<Dm7 Eb7 Ab^7 ⟪Ab^7 Ab^7⟫ G7 C^7 C^7>");
const COUNTDOWN = "<Dm7 Eb7 Ab^7 B7 E^7 G7 C^7 C^7>";
const MODIFY_SOLUTION = trio(COUNTDOWN);
const modify = (changes: string, bass = ROOTS) =>
  code(`const changes = "${changes}"`, "", RIDE, HATS, COMP, bass);

/** S4: the eight bars of S3 under the Band's drums; the tenor only plays each chord's root. */
const make = (mel: string, changes = COUNTDOWN) =>
  code(`const changes = "${changes}"`, "", COMP, ROOTS, `mel: ${mel}.s("tenor")`);
const MAKE_STARTER = make('note("<d4 eb4 ab4 b4 e4 g4 c5 c5>")');
/** Landing notes, one a bar: Dm7's 3rd F, E♭7's 3rd G, A♭maj7's 7th G, B7's 7th A, Emaj7's 3rd G♯, G7's 7th F, Cmaj7's 3rd E. */
const LANDINGS = 'note("<f4 g4 g4 a4 g#4 f4 e4 e4>")';

/** The Make's one idea: the line meets every new chord on its 3rd or 7th, through all three keys. */
const GUIDE_TONES: RubricRule = {
  id: "guide-tones-through",
  label:
    "At 3 of every 4 chord changes or more, the line lands on the new chord's 3rd or 7th, within four half steps of the last landing",
  required: true,
  skills: ["J14"],
  rule: "guide-tones",
  track: "mel",
  harmony: "chords",
  at: "change",
  minRatio: 0.75,
  // A major 3rd between landings: the keys move by one, and with 2 no line can meet B7 from A♭maj7 (probed).
  maxMoveSemis: 4,
  changes: ["Dm7", "Eb7", "Ab^7", "B7", "E^7", "G7", "C^7", "C^7"],
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J5.L05",
  version: 3,
  title: "Coltrane Changes",
  objective: "I can take a ii–V–I through three keys a major 3rd apart and play a line through them.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["J14"],
  terms: [{ id: "term.coltrane-changes", step: "S2" }],
  canDo: ["cd.code.coltrane-changes"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three homes",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "three-homes",
        version: 1,
        role: "practice",
        prompt:
          "Listen for each moment the ground shifts to a new home. Count how many homes arrive in the eight bars, and notice whether the tenor leaps or steps to follow.",
        skills: [{ skill: "J14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "The trio with the tenor on top.",
            bars: 8,
          },
          {
            code: HOOK_BARE,
            caption: "The same eight bars, chords alone. Count the homes.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Split the octave",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "homes", code: HOMES, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "split-the-octave",
        version: 1,
        role: "practice",
        prompt:
          "The three homes alone, a bar each, then B again. Run it, read the bass on the roll and answer two questions: how many half steps from B down to G, and where three such steps down from B land.",
        skills: [{ skill: "J14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the half steps on the roll from the first bass note down to the second, then follow the same distance on down.",
        },
        hints: ladder(
          "Count the half steps from each bass note to the next on the roll.",
          "Count down from B one half step at a time until you reach G. Then do the same from G.",
          "B to G and G to E♭ are the same size. Twelve half steps make an octave: how many of those steps fit in it?",
        ),
        code: { starter: HOMES },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many half steps from B down to G?", correct: 4 },
          {
            q: "choice",
            prompt: "Three such steps down from B land where?",
            options: [
              { id: "b", label: "On B again, an octave lower" },
              { id: "c", label: "On C, a half step above B" },
              { id: "a", label: "On A, a whole step below B" },
            ],
            correct: ["b"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 4, choice: ["b"] } }, expect: "pass" },
          {
            name: "a minor 3rd",
            response: { answer: { number: 3, choice: ["b"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "landing a half step off",
            response: { answer: { number: 4, choice: ["c"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Detour through E",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "detour-through-e",
        version: 1,
        role: "check",
        key: C,
        prompt:
          "A ii–V–I in C with a detour: Dm7, then E♭7 into A♭maj7. Bars 4 and 5 still hold A♭maj7. Rewrite bars 4 and 5 in `changes` as the V7 and the home of the key a major 3rd below A♭, so that G7 can take the line home to C. Keep the other bars.",
        skills: [{ skill: "J14", w: 1 }],
        swing: SWUNG,
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 8 },
        // The chords that sound and their lowest note, onset by onset (one string drives the chords and the bass).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Listen to the target's bass in bars 3 to 6: each home is a major 3rd below the last, and the root of the chord before each home is a 5th above it.",
        },
        hints: ladder(
          "A♭ is home in bar 3 and C in bar 7. The new home sits a major 3rd below A♭ and a major 3rd above C.",
          "Bar 5 is the home of that key, a major seventh chord. Bar 4 leads into it the way E♭7 leads into A♭maj7: its V7, a 5th above it.",
          "The new home is E, a major seventh like A♭maj7. The chord before it leads in the way E♭7 leads into A♭maj7.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "spelled from the flat side: Cb7",
            response: { code: modify("<Dm7 Eb7 Ab^7 Cb7 E^7 G7 C^7 C^7>") },
            expect: "pass",
          },
          {
            name: "the last chord written once with !",
            response: { code: modify("<Dm7 Eb7 Ab^7 B7 E^7 G7 C^7!2>") },
            expect: "pass",
          },
          {
            name: "the bass written by hand",
            response: {
              code: modify(
                COUNTDOWN,
                'bass: note("<d2 eb2 ab2 b1 e2 g2 c2 c2>").struct("x ~ x ~").s("upright")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(MODIFY_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the old key's V7 kept, a half step off: Bb7 before Emaj7",
            response: { code: modify("<Dm7 Eb7 Ab^7 Bb7 E^7 G7 C^7 C^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "a dominant where the new home is: E7",
            response: { code: modify("<Dm7 Eb7 Ab^7 B7 E7 G7 C^7 C^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right root with no dominant: Bmaj7",
            response: { code: modify("<Dm7 Eb7 Ab^7 B^7 E^7 G7 C^7 C^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "make",
      title: "Your line through three keys",
      minutes: 3,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-line-through-three-keys",
        version: 1,
        role: "practice",
        key: C,
        title: "Through three keys",
        prompt:
          "Rewrite the tenor line, which only plays roots. Required: at each chord change, land on the new chord's 3rd or 7th, within four half steps of the last landing. Between changes, go anywhere. Also on the checklist: swing it, and a tempo of 160 to 220.",
        skills: [{ skill: "J14", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          GUIDE_TONES,
          {
            id: "it-swings",
            label: "The line's eighths swing long-short, not even",
            required: false,
            skills: ["J14"],
            rule: "swing",
            track: "mel",
            subdivision: 8,
            ratio: [1.45, 2.4],
          },
          {
            id: "faster",
            label: "`setcpm` sets a tempo between 160 and 220 beats a minute",
            required: false,
            skills: ["J14"],
            rule: "tempo-bpm",
            min: 160,
            max: 220,
          },
        ],
        // The override serves every rule, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Land on the two notes that carry each chord's colour, its 3rd and its 7th.",
          "Write out the 3rd and the 7th of all seven chords first. Then, bar by bar, pick the one closest to the note you just played.",
          "Dm7 can start on its 3rd, F; E♭7's 3rd is a whole step above it, and A♭maj7's 7th is that same note held.",
        ),
        tests: [
          {
            name: "the starter as it is: roots",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: one landing a bar", response: { code: make(LANDINGS) }, expect: "pass" },
          {
            name: "the line in the low octave, on 7ths where it is closer",
            response: { code: make('note("<c4 db4 c4 a3 g#3 f3 e3 e3>")') },
            expect: "pass",
          },
          {
            name: "high, mostly on 7ths, with passing notes between the landings",
            response: {
              code: make(
                'note("<[c5 a4 f4 d4] [db5 bb4 g4 eb4] [c5 eb5 c5 ab4] [d#5 b4 f#4 a4] [d#5 b4 g#4 e4] [f5 d5 b4 g4] [e5 c5 g4 b4] e5>")',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: a swung line with passing notes, faster",
            response: {
              code: make(
                `note("<[f4 a4 g4 f4] [g4 bb4 ab4 g4] [g4 f4 eb4 c4] [d#4 f#4 a4 b4] [d#4 e4 g#4 b4] [f4 d4 b3 g3] [e4 g4 b4 d5] [e4 ~ ~ ~]>")${SWING}`,
              ).replace(`setcpm(${BPM}/4)`, "setcpm(184/4)"),
            },
            expect: "pass",
          },
          {
            name: "the plain ii–V–I's guide tones: they miss the detour",
            response: { code: make('note("<f4 f4 e4 e4 e4 e4 e4 e4>")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right notes, each a bar late",
            response: { code: make('note("<e4 f4 g4 g4 a4 g#4 f4 e4>")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "3rds and 7ths that leap: a 4th up into bar 3",
            response: { code: make('note("<f4 g4 c5 a4 d#5 b4 e5 e5>")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the landings written, the tenor silent: .gain(0)",
            response: { code: make(`${LANDINGS}.gain(0)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
