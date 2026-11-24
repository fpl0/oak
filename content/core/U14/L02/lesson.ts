// U14.L02 Mixolydian Rock. The ♭7 the learner met in U14.L01 brings a chord of its own: stack a triad on the
// lowered 7th and the awkward diminished chord of major (F♯ A C in G) becomes a plain major chord (F A C), a
// whole step below home, written ♭VII. With home and IV it makes I–♭VII–IV, the three-chord loop of rock; and
// the same te is the top note of an old fiddle tune, Old Joe Clark. What the learner has: triads stacked on
// every degree and the diminished one on 7 (U06.L01), Roman numerals (U06.L02), the three-chord loop I–IV–V
// (U06.L07), chords by name over one `const` with the bass on `.rootNotes(2)` (U05.L08, U08.L04), G Mixolydian
// and its ♭7 (U14.L01), by-ear transcription in `n` (U06.L05, U07.L08). Not yet: Dorian and i–IV (U14.L03),
// ♭VII as a visitor in a major key (U16.L02). The mode's v chord is not mentioned. Spec: content/specs/U14.md.
//
// Repertoire (contracts §2.8): song.old-joe-clark (trad., A Mixolydian), the first four bars of the A part as
// commonly sung and fiddled, in quarter notes: sol la te la | sol fa mi (held) | sol la te la | sol (held).
// Taught an octave below fiddle pitch, on A3:mixolydian. The registry entry is `verified: false` and has no
// answer key yet; the step's reference is this lesson's own code, and a verified print wins if it differs.
//
// Evaluated (headless Strudel): `<G F C G>` voices G3 D4 G4 B4 | F3 C4 F4 A4 C5 | E3 C4 E4 G4 C5 | G3 D4 G4 B4,
// so the bass reads `.rootNotes(2)` (G2 F2 C2 G2) and no prose points at a voice of the voicing. The riff plays
// G3 . B3 D4 . D4 B3 . | F4 . C4 A3 . C4 F3 . | C4 . E4 G4 . E4 C4 . | D4 B3 G3: each bar outlines its chord,
// and over F it lands on F, te. `n("[6,8,10]")` plays F♯4 A4 C5 on G major and F4 A4 C5 on G Mixolydian. Old Joe
// Clark on A3:mixolydian plays E4 F♯4 G4 F♯4 | E4 D4 C♯4 (half) | E4 F♯4 G4 F♯4 | E4 (half).
//
// How it is graded: S4 writes the hook's numerals on the palette in G Mixolydian (read by degree and quality,
// never by string: `VII` for `♭VII` is a degree miss); S5 swaps one chord in A Mixolydian and is graded as a
// chord (`pcset` per onset with the bass); S6 is Old Joe Clark by ear (`melody`, octave-free). The Make's one
// required rule is `contains-rn` with `bVII`, read in G Mixolydian: the starter's I I IV I has none, and the
// three-chord loop of major, `<G D C G>`, fails with a detail that names its chords.
import { defineLesson, type HintLadder, type KeySpec, type Matcher } from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The lesson starts and stays in the mode (unit conventions): G Mixolydian, then A Mixolydian in S5–S6. */
const G_MIX: KeySpec = { tonic: "G", mode: "mixolydian" };
const A_MIX: KeySpec = { tonic: "A", mode: "mixolydian" };

/** One string drives the chords and the bass (U08.L04). */
const changes = (form: string) => `const changes = "${form}"\n`;
/** Organ chords, one a bar, and an electric bass pumping eighths on the roots. */
const ORGAN = 'chords: chord(changes).voicing().s("organ")';
const PUMP = 'bass: chord(changes).rootNotes(2).struct("x*8").s("ebass").lpf(600)';
const gtr = (riff: string, scale = "G3:mixolydian") => `gtr: n("${riff}").scale("${scale}").s("crunch")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), ORGAN, PUMP, ...lines);

/**
 * The hook's riff: each bar outlines its chord. Over F it starts on te (`n` 6, F4) and ends on the F below
 * home (`n` -1); bar 4 lands on home.
 */
const RIFF = "<[0 ~ 2 4 ~ 4 2 ~] [6 ~ 3 1 ~ 3 -1 ~] [3 ~ 5 7 ~ 5 3 ~] [4 2 0 ~ ~ ~ ~ ~]>";
const HOOK = loop("<G F C G>", gtr(RIFF));
/** S1: the three-chord song the learner knows, I–V–IV–I in G major: organ and bass alone. */
const THREE_CHORD = loop("<G D C G>");

/** S2: the stack on degree 7, bar 1 on G major, bar 2 on G Mixolydian. */
const STACK_ON_SEVEN = code('chords: n("[6,8,10]").scale("<G3:major G3:mixolydian>").s("organ")');
/** S3: the hook's loop as stacks: roots on 1, ♭7, 4 and 1, each with its 3rd and 5th. */
const STACKS = code('chords: n("<0 6 3 0>").add(n("[0,2,4]")).scale("G3:mixolydian").s("organ")');

/** S4: the hook's chords by name, shown with the code. */
const NAMED = loop("<G F C G>");

/**
 * S5, in A Mixolydian: the hook's riff moved to A (bar 2: G4 D4 B3 D4 G3), whose G (te, `n` 6) rubs against
 * the E chord's G♯. The target swaps E for the major chord a whole step below home, G, which holds every note
 * of that bar.
 */
const A_RIFF = RIFF;
const inA = (form: string) => loop(form, gtr(A_RIFF, "A3:mixolydian"));
const MODIFY_STARTER = inA("<A ⟪E⟫ D A>");
const MODIFY_SOLUTION = inA("<A G D A>");

/** S6: Old Joe Clark's first four bars (see the header), over a strummed A chord. */
const JOE = "<[4 5 6 5] [4 3 2@2] [4 5 6 5] [4@2 ~@2]>";
const joe = (tune: string, scale = "A3:mixolydian") => `mel: n("${tune}").scale("${scale}").s("piano")`;
const STRUM = 'chords: chord("A").voicing().struct("x ~ x x ~ x x ~").s("acgtr").gain(.5)';
const JOE_SOURCE = code(STRUM, joe(JOE));
const JOE_SOLUTION = code(joe(JOE));
/** The given first note, sol (`n` 4); the rest is the learner's. */
const JOE_STARTER = code(joe("<⟪[4 ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]⟫>"));
const JOE_STARTER_PLAIN = code(joe("<[4 ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~] [~ ~ ~ ~]>"));
const BY_EAR: Matcher = {
  m: "melody",
  pitch: "octave-free",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 16],
  track: "mel",
};

/** The Make: I I IV I with a riff that sits on home. No chord on the ♭7 yet. */
const MAKE_RIFF = "<[0 ~ 2 4 ~ 4 2 ~] [0 ~ 2 4 ~ 2 0 ~] [3 ~ 5 7 ~ 5 3 ~] [4 2 0 ~ ~ ~ ~ ~]>";
const MAKE_STARTER = loop("<G G C G>", gtr(MAKE_RIFF));
/** The smallest change that passes: the second G becomes F. */
const MAKE_MINIMAL = loop("<G F C G>", gtr(MAKE_RIFF));
/** The riff rewritten to lean on te over the F. */
const MAKE_WITH_TE = loop("<G F C G>", gtr(RIFF));

/** Drums from the Band; chords, bass and riff are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U14.L02",
  version: 4,
  title: "Mixolydian Rock",
  objective:
    "I can find the major chord on Mixolydian's ♭7, write it as ♭VII, and use it in the loop I–♭VII–IV.",
  key: G_MIX,
  meter: "4/4",
  bpm: BPM,
  introduces: ["H11"],
  practises: [],
  terms: [],
  canDo: ["cd.compose.mixolydian"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One chord changed",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-chord-changed",
        key: G_MIX,
        version: 1,
        role: "practice",
        prompt:
          "Listen for the one bar whose chord changes between loop 1 and loop 2, and for how hard each loop pulls back to G. Loop 1 is a three-chord loop you have written before; loop 2 swaps one chord and adds a guitar riff.",
        skills: [{ skill: "H11", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: THREE_CHORD,
            caption: "Loop 1: G, D, C, G on organ and bass, every chord from G major.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "Loop 2: one chord swapped, and a guitar riff on top.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Stack on the 7th",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "stack-on-the-seventh",
        version: 1,
        role: "practice",
        prompt:
          'Predict what kind of chord bar 2 plays. `n("[6,8,10]")` stacks a triad on degree 7: on G major (bar 1) that is F♯ A C, the diminished chord. Bar 2 plays the same numbers on G Mixolydian. Pick one answer.',
        skills: [{ skill: "H11", w: 1 }],
        hints: null,
        tests: [],
        code: STACK_ON_SEVEN,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "major", label: "F A C: a plain major chord" },
          { id: "still-dim", label: "Still diminished: the scale only moved one note" },
          { id: "minor", label: "A minor chord" },
        ],
        correct: ["major"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Name the new chord",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", initialPanels: ["chords"] },
      example: { id: "stacks", code: STACKS, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "name-the-new-chord",
        key: G_MIX,
        version: 1,
        role: "practice",
        prompt:
          "Run the code and read the numeral the chord band writes under each bar. The roots are degrees 1, ♭7, 4 and 1 of G Mixolydian. Then answer both questions: which numeral bar 2's F chord gets, and how many half steps its root is below home.",
        skills: [{ skill: "H11", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the numeral under bar 2: its flat sign says the root is a lowered degree 7. Then count the keys from F up to G.",
        },
        hints: ladder(
          "Look at the numeral under bar 2: its chord is built on the note the scale lowered. What does the band write there?",
          "A numeral counts from home. Upper case means a major chord; a flat sign means the degree is lowered.",
          "F is the root. From F up to G is the same distance as from home down to the ♭7.",
        ),
        code: { starter: STACKS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which numeral does the chord band write under the F chord?",
            options: [
              { id: "flat-seven", label: "♭VII: major, on the lowered 7th" },
              { id: "seven", label: "VII: major, on degree 7" },
              { id: "seven-dim", label: "vii°: diminished, on degree 7" },
            ],
            correct: ["flat-seven"],
          },
          {
            q: "number",
            prompt: "How many half steps is that chord's root below home?",
            correct: 2,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["flat-seven"], number: 2 } },
            expect: "pass",
          },
          {
            name: "VII: the flat sign missed",
            response: { answer: { choice: ["seven"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one half step: that is F♯, major's 7th",
            response: { answer: { choice: ["flat-seven"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Number the loop",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, initialPanels: ["chords"] },
      exercise: {
        kind: "identify",
        id: "number-the-loop",
        key: G_MIX,
        version: 1,
        role: "check",
        prompt:
          "Write the numeral for each of the hook's four chords, G, F, C, G, counted from home in G Mixolydian. Use upper case for a major chord and a flat sign where the root is a lowered degree. Done when all four slots hold a numeral.",
        skills: [
          { skill: "H11", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        hints: ladder(
          "Count each chord's root up from G. Which chords sit on home, and which degree is C?",
          "Count from G: C is degree 4, and F is the lowered 7th. All four chords are major.",
          "Bars 1 and 4 are I and bar 3 is IV. Bar 2 is on the ♭7.",
        ),
        stimulus: { src: "code", code: NAMED, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads"] },
        correct: { rn: ["I", "bVII", "IV", "I"] },
        srs: [{ family: "fam.har.cadence", mode: "review-if-due" }],
        tests: [
          { name: "I ♭VII IV I", response: { answer: { rn: ["I", "bVII", "IV", "I"] } }, expect: "pass" },
          {
            name: "written with the flat sign",
            response: { answer: { rn: ["I", "♭VII", "IV", "I"] } },
            expect: "pass",
          },
          {
            name: "VII: degree 7 of major, without the flat",
            response: { answer: { rn: ["I", "VII", "IV", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "V for the F chord: the old loop's numeral",
            response: { answer: { rn: ["I", "V", "IV", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "the loop counted from C",
            response: { answer: { rn: ["V", "IV", "I", "V"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Swap the chord",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "swap-the-chord",
        key: A_MIX,
        version: 1,
        role: "check",
        prompt:
          "Change bar 2's chord in `changes`, the `E`, to the major chord a whole step below A, home. In that bar the riff plays G, te, and the E chord's G♯ rubs against it. Keep the other three chords as they are.",
        skills: [{ skill: "H11", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7), held for its
        // bar: a G struck for 1% of the bar and then silent is not the swap (`durations`).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. In A Mixolydian the chord on the ♭7 is major, built on G natural.",
        },
        hints: ladder(
          "Only bar 2's chord changes. Which note is a whole step below A, and which chord is built on it?",
          "Te in A Mixolydian is G natural. The chord on it is major, like F was in G.",
          "Bar 2 needs a G major chord: G, B and D. In `changes` that is one letter.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "the bar in brackets", response: { code: inA("<A [G] D A>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: inA("<A E D A>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "G minor: B♭ is not in A Mixolydian",
            response: { code: inA("<A Gm D A>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "G♯ diminished: the chord major puts on degree 7",
            response: { code: inA("<A G#o D A>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          { name: "G struck twice in its bar", response: { code: inA("<A [G G] D A>") }, expect: "pass" },
          {
            name: "G held three beats, a beat of air",
            response: { code: inA("<A [G@3 ~] D A>") },
            expect: "pass",
          },
          {
            name: "G struck for a moment, then silence for the rest of the bar",
            response: { code: inA("<A [G@0.01 ~@0.99] D A>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "another bar edited too",
            response: { code: inA("<A G G A>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "dictate",
      title: "Old Joe Clark",
      minutes: 1.75,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "old-joe-clark",
        key: A_MIX,
        version: 1,
        role: "check",
        prompt:
          "Write the fiddle tune's four bars by ear in the `mel:` line, in `n` on A Mixolydian. The first note is given: sol, `n` 4. Bars 3 and 4 begin like bar 1. Any octave passes. Done when your notes and their lengths match the tune.",
        skills: [
          { skill: "E07", w: 0.6 },
          { skill: "S12", w: 0.4 },
        ],
        hints: ladder(
          "Start with bar 1 alone: hum it and count its steps. How far does it climb from sol before it turns back?",
          "Bar 1 steps up twice and back down once. `n` counts from 0, so te, degree ♭7, is `n` 6.",
          "Bar 1 is `[4 5 6 5]`. Bar 2 steps down from sol and holds its last note for two beats.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: JOE_SOURCE, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: JOE_STARTER },
        reference: { solutions: [JOE_SOLUTION], bars: 4 },
        matcher: BY_EAR,
        // Raised from the dictation default (0.85): over four short bars, te heard as la twice (0.87) and the
        // held mi played twice (0.93) both passed. A tune this short is passed when every note is right.
        pass: 0.95,
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "any-octave" },
        srs: [{ family: "fam.deg.tonic", mode: "review-if-due" }],
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: you have {got} ({gotSyl}); the tune has {exp} ({expSyl}). Sing up from do and count again; `n` is the degree minus one.",
        },
        tests: [
          { name: "reference", response: { code: JOE_SOLUTION }, expect: "pass" },
          {
            name: "an octave up, the held notes written with _",
            response: {
              code: code(joe("<[4 5 6 5] [4 3 2 _] [4 5 6 5] [4 _ ~ ~]>", "A4:mixolydian")),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: JOE_STARTER_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "te written as its degree number, 7",
            response: { code: code(joe("<[4 5 7 5] [4 3 2@2] [4 5 7 5] [4@2 ~@2]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the climb one step short: la for te",
            response: { code: code(joe("<[4 5 5 5] [4 3 2@2] [4 5 5 5] [4@2 ~@2]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "bar 2's held note played twice",
            response: { code: code(joe("<[4 5 6 5] [4 3 2 2] [4 5 6 5] [4@2 ~@2]>")) },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your three-chord rock",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-three-chord-rock",
        key: G_MIX,
        version: 1,
        role: "practice",
        prompt:
          "Write your song's second verse. Put an F chord, ♭VII, into `changes` at least once: the loop is G, G, C, G now. I–♭VII–IV–I works, or your own order with home coming back. Then rewrite the riff so it plays te (F) over the F chord. Done when the loop has an F chord.",
        skills: [{ skill: "H11", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-flat-seven-chord",
            label: "An F chord, ♭VII, in the loop at least once",
            required: true,
            skills: ["H11"],
            rule: "contains-rn",
            rn: ["bVII"],
            min: 1,
          },
          {
            id: "four-too",
            label: "A C chord, IV, in the loop at least once",
            required: false,
            skills: ["H11"],
            rule: "contains-rn",
            rn: ["IV"],
            min: 1,
          },
          {
            id: "riff-sings-te",
            label: "The `gtr:` line plays te (F) at least once",
            required: false,
            skills: ["S12"],
            rule: "degree-set",
            track: "gtr",
            contains: ["b7"],
          },
          {
            id: "bass-on-roots",
            label: "The `bass:` line plays the root where most chords start",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Your loop needs the one chord G Mixolydian has and G major does not. Is it in `changes` yet?",
          "The chord on the ♭7 is F major, a whole step below home. All four chords live in `changes`.",
          "Replace one of the G chords in the middle of the loop. Keep the first bar on home.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the second G becomes F", response: { code: MAKE_MINIMAL }, expect: "pass" },
          { name: "the riff leans on te over the F", response: { code: MAKE_WITH_TE }, expect: "pass" },
          {
            name: "beyond the brief: eight bars, ♭VII twice, distorted riff, a pushier bass",
            response: {
              code: code(
                changes("<G F C G G F C C>"),
                ORGAN,
                'bass: chord(changes).rootNotes(2).struct("x ~ x x ~ x x x").s("ebass").lpf(600)',
                `gtr: n("${RIFF}").scale("G3:mixolydian").s("crunch").distort(1)`,
              ),
            },
            expect: "pass",
          },
          {
            name: "the three-chord loop of major: D, not F",
            response: { code: loop("<G D C G>", gtr(MAKE_RIFF)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
