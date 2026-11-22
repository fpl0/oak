// U05.L08 Let Strudel Voice It. `chord()` names the chords and `.voicing()` places their notes, choosing
// close positions much as the learner did by hand in U05.L07; the learner still decides where the chords sit
// (`.anchor()`) and what the bass plays. What the learner has: triads by hand (U05.L01), qualities and chord
// names (U05.L02–L04, written C, Cm, C°, C+ on paper), inversions (U05.L05), the grand staff (U05.L06), hand
// voice leading (U05.L07). Not yet: Roman numerals (U06.L02), "cadence" (U06.L04), "chord tone" (U07.L03),
// `.rootNotes()` and the jazz dictionaries.
// Spec: content/specs/U05.md.
//
// The voicing gate (contracts §3.1 rule 6): `chord`, `voicing`, `anchor`, `mode("below")`, `dict("triads")`,
// the triad symbols, `rhodes` and `organ` unlock on completing this lesson, and only once the gate check has a
// graded attempt at ≥ 0.9 with nothing revealed. S1 is the gate's second chance (`gateCheck: true`, exercise
// `hand-voiced-cadence-again`, a VOICING_GATE variant): the U05.L07 check in G major, shown only while the gate
// is unmet, written without the tools it guards. Everything a `voicing()` plays is graded only by pitch-class
// set (contracts §6.7): no check, hint or line of prose here depends on its octave, top note or note count.
// S6 "Lift them" checks the anchor the learner writes (above Strudel's own, C5), never the notes it places.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A hand-voiced chord line: note lists. */
const handChords = (pattern: string, sound = "piano") => `chords: note("${pattern}").s("${sound}")`;
/** A chord line Strudel places: symbols, then `.voicing()`, with any controls between. */
const named = (symbols: string, controls = "", sound = "piano", extra = "") =>
  `chords: chord("${symbols}")${controls}.voicing().s("${sound}")${extra}`;
const noteBass = (pattern: string) => `bass: note("${pattern}").s("ebass").lpf(800)`;
const degBass = (pattern: string) => `bass: n("${pattern}").scale("C2:major").s("ebass").lpf(800)`;
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- S1: the gate's second chance, in G ----------------------------------------------------------------

/** G C D G over its roots, every chord stacked from its root: all three notes leap. */
const G_JUMP = "<[g3,b3,d4] [c4,e4,g4] [d4,f#4,a4] [g3,b3,d4]>";
/**
 * Voice-led, the U05.L07 path moved to G: G holds into C while B and D step up; into D, G falls a half step,
 * C a 3rd (three half steps) to A and E a whole step to D; D holds into the last G while F♯ and A step up.
 */
const G_SMOOTH = "<[g3,b3,d4] [g3,c4,e4] [f#3,a3,d4] [g3,b3,d4]>";
const G_ROOTS = "<g2 c2 d2 g2>";
const gate = (chordsPattern: string) => code(noteBass(G_ROOTS), handChords(chordsPattern));
const GATE_STARTER = `${TEMPO}${noteBass(G_ROOTS)}\n${handChords(`⟪${G_JUMP}⟫`)}`;
/** The U05.L07 gate matcher, unchanged. */
const GATE_MATCHER: Matcher = {
  m: "all",
  of: [
    { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
    {
      m: "rubric",
      rules: [
        {
          id: "hand-voiced",
          label: "Three voices, shared notes held, no note moving more than three half steps",
          required: true,
          skills: ["C05"],
          rule: "voice-leading",
          track: "chords",
          maxMovePerVoice: 3,
          voices: 3,
          commonTones: true,
          noCrossing: true,
          // The progression loops: the last chord leads back into the first, and that move is judged too.
          loop: true,
        },
      ],
    },
  ],
};

// --- S2 to S6: Strudel places the notes ---------------------------------------------------------------

/** The hook: the four-chord loop as symbols on a Rhodes, over its roots (C G A F). */
const HOOK = code(named("<C G Am F>", "", "rhodes"), degBass("<0 4 5 3>"));
/** The U05.L07 hand path for C F G C, and Strudel's choice for the same chords, over one bass. */
const HAND = "<[c4,e4,g4] [c4,f4,a4] [b3,d4,g4] [c4,e4,g4]>";
const C_ROOTS = "<c2 f2 g2 c2>";
const BY_HAND = code(noteBass(C_ROOTS), handChords(HAND));
const BY_STRUDEL = code(noteBass(C_ROOTS), named("<C F G C>"));
/** S4: one chord, placed by Strudel. */
const ONE_C = code(named("C"));
/** S5: the hand path rewritten as symbols. */
const S5_STARTER = `${TEMPO}${noteBass(C_ROOTS)}\nchords: ⟪note("${HAND}")⟫.s("piano")`;
const s5 = (chordLine: string) => code(noteBass(C_ROOTS), chordLine);
/** S6: the same chords, anchored higher. */
const S6_STARTER = `${TEMPO}${noteBass(C_ROOTS)}\nchords: ⟪chord("<C F G C>").voicing()⟫.s("rhodes")`;
const s6 = (chordLine: string) => code(noteBass(C_ROOTS), chordLine);

// --- S7: the Make ---------------------------------------------------------------------------------------

/** The Make starter: the loop of U05.L07's Make (C G Am F), voice-led by hand. */
const LOOP_BY_HAND = "<[c4,e4,g4] [b3,d4,g4] [c4,e4,a4] [c4,f4,a4]>";
const MAKE_STARTER = code(handChords(LOOP_BY_HAND));
/** A tune of chord notes over C G Am F (G E G | B G | A C A | A F), from Stacking Thirds. */
const TUNE = "<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>";

/** Drums only from the Band: the learner's chords and bass set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const GRAND_KEYS = { roll: false, staff: "grand", keyboard: true } as const;

export default defineLesson({
  id: "U05.L08",
  version: 3,
  title: "Let Strudel Voice It",
  objective:
    'I can write chords as symbols, chord("<C G Am F>"), and let .voicing() place their notes, close to how I would by hand.',
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["C05", "N05"],
  terms: [{ id: "term.voicing", step: "S5" }],
  canDo: ["cd.code.chords"],
  // A jazz-soul learner writes with rhodes once it is unlocked (contracts §5.10 rule 8).
  flavours: { "flavour.jazz-soul": { sounds: { piano: "snd.rhodes" } } },
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "modify",
      title: "Once more by hand",
      minutes: 1.5,
      graded: true,
      gateCheck: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-modify",
        // A VOICING_GATE variant: this id is fixed.
        id: "hand-voiced-cadence-again",
        version: 1,
        role: "check",
        key: { tonic: "G", mode: "major" },
        pass: 0.9,
        prompt:
          "Rewrite all four chords, G C D G, three notes each, over the given bass. Keep every note two neighbouring chords share in the same place in the list. Move every other note three half steps at most, and keep each list lowest to highest. The last G leads back into the first too.",
        skills: [{ skill: "C05", w: 1 }],
        code: { starter: GATE_STARTER },
        reference: { solutions: [gate(G_SMOOTH)], bars: 4 },
        matcher: GATE_MATCHER,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; it should have {exp}. Move notes, but keep the chord's three letters.",
          "rubric.unmet": "Not yet. The lines below name the bar and the note.",
          "harmony.voice-leap":
            "Bar {bar}: {from} leaps {semis} half steps to {to}. {nearest} is the nearest note of the new chord; move at most {max}.",
          "harmony.common-tone":
            "Bar {bar}: {pc} is in both chords. Keep the {note} where it is, in the same place in the list.",
          "harmony.voice-crossing":
            "Bar {bar}: the note that went from {low} to {lowTo} ends above the one that went from {high} to {highTo}. Keep the three in order, lowest first.",
          "harmony.voice-count": "Bar {bar}: {notes} is {got} notes; write {exp}, one for each voice.",
        },
        hints: ladder(
          "Find the shared notes first: one note is in both G and C, one is in both D and G. Those stay put.",
          "Hold the shared note in its place in the list. C and D share none, so there every note moves: find a near note of D for each, and use all three letters.",
          "Bar 2 keeps G at the bottom and steps B and D up to C and E. Into D, G goes down a half step to F♯ and E down a whole step to D. Which letter of D is left for C?",
        ),
        tests: [
          { name: "reference", response: { code: gate(G_SMOOTH) }, expect: "pass" },
          {
            name: "another smooth path, from a higher G: C E G, A D F♯, B D G",
            response: { code: gate("<[b3,d4,g4] [c4,e4,g4] [a3,d4,f#4] [b3,d4,g4]>") },
            expect: "pass",
          },
          {
            // Review finding (theory-c A4, the U05.L07 case moved to G): the last G leaps back to the first one.
            name: "smooth inside, but the last G leaps back to the first: A D F♯, then B D G",
            response: { code: gate("<[g3,b3,d4] [g3,c4,e4] [a3,d4,f#4] [b3,d4,g4]>") },
            expect: "fail",
            feedback: ["harmony.voice-leap"],
          },
          {
            name: "an octave higher",
            response: { code: gate("<[g4,b4,d5] [g4,c5,e5] [f#4,a4,d5] [g4,b4,d5]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: gate(G_JUMP) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "root position below: C and D under G",
            response: { code: gate("<[g3,b3,d4] [c3,e3,g3] [d3,f#3,a3] [g3,b3,d4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a note missing from C",
            response: { code: gate("<[g3,b3,d4] [g3,c4] [f#3,a3,d4] [g3,b3,d4]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the bass changed",
            response: { code: code(noteBass("<g2 c3 d2 g2>"), handChords(G_SMOOTH)) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "listen",
      title: "Chords by name",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "chords-by-name",
        version: 1,
        role: "practice",
        prompt:
          "Four chords on an electric piano, written only by name: C, G, Am, F. Listen for whether the top note of the chords leaps from bar to bar, as your first stacks did, or glides.",
        skills: [{ skill: "N05", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Not one note written by hand. Follow the top note.", bars: 4 }],
      },
    },
    {
      id: "S3",
      kind: "compare",
      title: "Yours or Strudel's",
      minutes: 0.5,
      ui: { panels: NONE, band: DRUMS },
      exercise: {
        kind: "identify",
        id: "yours-or-strudels",
        version: 1,
        role: "practice",
        prompt:
          'Both cards play C F G C over the same bass. One is your hand path from Voice Leading by Hand; the other is `chord("<C F G C>")` placed by Strudel. Pick the card that is Strudel\'s.',
        skills: [{ skill: "C05", w: 1 }],
        hints: ladder(
          "Listen for the card that sounds like the line you wrote in the last lesson: that one is not Strudel's.",
          "Your path had exactly three notes in every chord, with C held at the bottom from the first chord into the second.",
          "Card A keeps C at the bottom through the first two chords, then dips to B. Is that the path you wrote?",
        ),
        stimulus: { src: "code", code: BY_STRUDEL, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "hand", label: "Card A", audio: BY_HAND },
            { id: "strudel", label: "Card B", audio: BY_STRUDEL },
          ],
        },
        correct: { choice: ["strudel"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "Card A is your hand path. Card B is Strudel's: it moves just as smoothly, from different notes.",
        },
        tests: [
          { name: "Strudel's", response: { answer: { choice: ["strudel"] } }, expect: "pass" },
          {
            name: "the hand path",
            response: { answer: { choice: ["hand"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "What C plays",
      minutes: 1,
      ui: { panels: GRAND_KEYS, staffLabels: "degree" },
      example: { id: "one-c", code: ONE_C, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "what-c-plays",
        version: 1,
        role: "practice",
        prompt:
          'Run `chord("C")` placed by Strudel and read its notes on the staff and the keyboard, from the lowest up. Count each letter once, then answer both questions below.',
        skills: [{ skill: "N05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the letters only, from the lowest note up, and cross off each one you have seen before.",
        },
        hints: ladder(
          "C is a triad. Which three letters does a C triad have?",
          "Strudel may use a letter more than once, in different octaves. Count each letter once.",
          "Go up the keyboard key by key and write down each letter you meet the first time only. How long is the list?",
        ),
        code: { starter: ONE_C },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which letters does it play?",
            options: [
              { id: "ceg", label: "Only C, E and G" },
              { id: "cegb", label: "C, E, G and B" },
              { id: "cega", label: "C, E, G and A" },
            ],
            correct: ["ceg"],
          },
          {
            q: "number",
            prompt: "How many different letters is that?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["ceg"], number: 3 } }, expect: "pass" },
          {
            name: "a 7th heard",
            response: { answer: { choice: ["cegb"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "every note counted",
            response: { answer: { choice: ["ceg"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Say it by name",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "say-it-by-name",
        version: 1,
        role: "check",
        prompt:
          'The chords line spells out your hand path note by note. Replace the `note(…)` with the four chord names, C F G C, inside `chord("< >")`, then add `.voicing()` right after it so Strudel places the notes. Keep `.s("piano")`.',
        skills: [
          { skill: "N05", w: 0.6 },
          { skill: "C05", w: 0.4 },
        ],
        code: { starter: S5_STARTER },
        reference: { solutions: [s5(named("<C F G C>"))], bars: 4 },
        // Only the pitch classes of each chord are compared: where Strudel puts them is its choice.
        matcher: { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          { c: "must-use", tool: "tb.voicing", feedback: "code.must-use" },
        ],
        target: { audible: true, showRoll: false },
        srs: [{ deck: "deck.chd.symbols", mode: "review-if-due" }],
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: that chord has {got}; it should have {exp}. Check the name in bar {bar}, and the `< >` around the names that plays one a bar.",
          "code.must-use": "Add `.voicing()` after `chord(…)`: without it a chord name has no notes to play.",
        },
        hints: ladder(
          "Two changes: the note lists become four names inside `chord()`, and `.voicing()` follows it.",
          'Chord names go inside `chord("…")` the way notes go inside `note("…")`, with `< >` for one a bar.',
          'Start with `chord("<C …>")`, then add the call that turns names into notes.',
        ),
        tests: [
          { name: "reference", response: { code: s5(named("<C F G C>")) }, expect: "pass" },
          {
            name: "three-note chords from the triads list",
            response: { code: s5(named("<C F G C>", '.dict("triads")')) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s5(handChords(HAND)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "names without .voicing()",
            response: { code: s5('chords: chord("<C F G C>").s("piano")') },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            // Teaching review: all four names in one bar. The feedback names the `< >` as well as the bar.
            name: "the names without < >: four chords squeezed into every bar",
            response: { code: s5(named("C F G C")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "C minor at the end",
            response: { code: s5(named("<C F G Cm>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Cmaj, a name Strudel does not know",
            response: { code: s5(named("<Cmaj F G Cmaj>")) },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
          {
            name: "a slash chord inside chord()",
            response: { code: s5(named("<C F G/B C>")) },
            expect: "fail",
            feedback: ["code.slash-chord"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Lift them",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "lift-them",
        version: 1,
        role: "practice",
        prompt:
          'Strudel chooses where the chords sit, and `.anchor()` steers it: a higher anchor, higher chords. Add `.anchor("g5")` between `chord(…)` and `.voicing()`. Done when the same four chords play higher.',
        skills: [{ skill: "N05", w: 1 }],
        code: { starter: S6_STARTER },
        reference: { solutions: [s6(named("<C F G C>", '.anchor("g5")', "rhodes"))], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          { c: "must-use", tool: "tb.anchor", feedback: "code.must-use" },
          // "A higher anchor, higher chords" (review finding theory-c A5: `.anchor("g3")` passed and moved them down).
          // Read from the code, not from the voiced notes, whose octave §6.7 never grades: an anchor above Strudel's
          // own, C5 (from D5 up, as a name or a MIDI number), lifts at least one chord of C F G C.
          {
            c: "arg-matches",
            fn: "anchor",
            argIndex: 0,
            pattern:
              "^\\s*[\"'`]?\\s*(?:(?:[eEfFgGaAbB][#b]?|[dD]#?)5|[a-gA-G][#b]?[6-9]|7[4-9]|[89]\\d|1[01]\\d|12[0-7])\\s*[\"'`]?\\s*$",
            feedback: "code.arg-mismatch",
          },
        ],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "code.must-use": 'Put `.anchor("g5")` after `chord(…)` and before `.voicing()`.',
          "code.arg-mismatch":
            '`.anchor({got})` does not lift the chords. With no anchor, Strudel anchors them at C5, and an anchor below D5 keeps them there or takes them down. Anchor on D5 or higher, such as `"g5"`.',
          "harmony.pcset":
            "Bar {bar}: that chord has {got}; it should have {exp}. Keep the four names as they were.",
        },
        hints: ladder(
          "Strudel decides where the notes go at `.voicing()`. The new setting goes just before it.",
          "Settings for the placement go between `chord(…)` and `.voicing()`.",
          'The new call is `.anchor()`, with a note name and an octave inside the quotes: try `"g5"`.',
        ),
        tests: [
          {
            name: "reference",
            response: { code: s6(named("<C F G C>", '.anchor("g5")', "rhodes")) },
            expect: "pass",
          },
          {
            name: "anchored on another high note",
            response: { code: s6(named("<C F G C>", '.anchor("e5")', "rhodes")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s6(named("<C F G C>", "", "rhodes")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "more room instead of an anchor",
            response: { code: s6(named("<C F G C>", "", "rhodes", ".room(.4)")) },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            name: "anchored an octave up",
            response: { code: s6(named("<C F G C>", '.anchor("c6")', "rhodes")) },
            expect: "pass",
          },
          {
            // Review finding (theory-c A5): this anchor moves every chord down, below the default.
            name: "anchored low: the chords go down",
            response: { code: s6(named("<C F G C>", '.anchor("g3")', "rhodes")) },
            expect: "fail",
            feedback: ["code.arg-mismatch"],
          },
          {
            name: "anchored on C5, Strudel's own anchor: nothing moves",
            response: { code: s6(named("<C F G C>", '.anchor("c5")', "rhodes")) },
            expect: "fail",
            feedback: ["code.arg-mismatch"],
          },
          {
            name: "a name changed on the way",
            response: { code: s6(named("<C F G Am>", '.anchor("g5")', "rhodes")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your loop by name",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "loop-by-name",
        version: 1,
        role: "practice",
        prompt:
          "The starter is your hand-led loop from the last lesson. Rewrite it as four bars of chord names, any you like, placed by `.voicing()` on a Rhodes or an organ. A bass line of roots can go under them. Done when `.voicing()` places the chords.",
        skills: [
          { skill: "N05", w: 0.6 },
          { skill: "C05", w: 0.4 },
        ],
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "voiced-by-strudel",
            label: "`.voicing()` used to place the chords",
            required: true,
            skills: ["N05"],
            rule: "uses",
            tool: "tb.voicing",
          },
          // "Rhodes or organ" cannot be one rule (`sounds.contains` asks for all it lists, and `uses` takes
          // tools, not sounds), and a suggestion for one would mark the other "not yet": the prompt asks.
          {
            id: "a-tune",
            label: "A tune on its own line, such as `mel`",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
          {
            id: "bass-line",
            label: "A bass line on its own line, such as `bass`",
            required: false,
            skills: ["C05"],
            rule: "tracks",
            min: 1,
            roles: ["bass"],
          },
        ],
        hints: ladder(
          "Name the starter's four chords bar by bar: those names go inside `chord()`.",
          'Write them inside `chord("< >")`, one a bar, and end the chain with `.voicing()` and a sound.',
          "The bass can play each chord's root, one note a bar, the way the bass did in Voice Leading by Hand.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the loop by name",
            response: { code: code(named("<C G Am F>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: organ, anchored, a bass and a tune",
            response: {
              code: code(
                named("<C G Am F>", '.anchor("e5")', "organ", ".gain(.6)"),
                degBass("<0 4 5 3>"),
                mel(TUNE),
              ),
            },
            expect: "pass",
          },
          {
            name: "the jazz-soul starter sound, by name",
            response: { code: code(named("<Am F C G>", "", "rhodes"), degBass("<5 3 0 4>")) },
            expect: "pass",
          },
          {
            name: "still by hand, with a bass",
            response: { code: code(handChords(LOOP_BY_HAND, "rhodes"), degBass("<0 4 5 3>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
