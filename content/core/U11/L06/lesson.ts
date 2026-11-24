// U11.L06 Quick Change & Turnaround. Two standard variations of the twelve bars (U11.L05). The quick change
// visits IV in bar 2 and comes back to I in bar 3. The turnaround makes the last two bars lead back to the top:
// here two chords a bar, I–IV then I–V, `[C7 F7] [C7 G7]`, ending on V so the next chorus lands on I. Both are
// edits of the one `changes` string (U08.L04), and `[ ]` inside `< >` fits two chords in one bar (U06.L08).
// What the learner has: the 12-bar blues and its `const changes` (U11.L05), the dominant seventh (U11.L04),
// the blues-scale riff on `crunch` (U11.L03), two chords in a bar (U06.L08), I IV V as numerals (U06.L02).
// Not yet: swing (U11.L07: this blues is straight), the jazz blues and other turnarounds (J4).
// Spec: content/specs/U11.md.
//
// How it is graded (AUTHORING §17–§18): each modify step compares Roman numerals on the triad core (`harmony`,
// level `rn`, `qualityDepth: "triad"`, `harmonicRhythm: "given"`), so C7 counts as I and the turnaround's two
// chords a bar are read on the half bar. The Make's one required rule is `blues-form` with `variant:
// "quick-change"`: the grader's `bluesForm` reads the bars and accepts IV or V in bar 10 and I or V in bar 12,
// so any turnaround that ends on V (or a last bar on I) passes, while the standard form fails on bar 2. The
// key is C blues (contracts §6.6 C5): numerals read I7 IV7 V7, never V7/IV. No 12-bar Band exists yet, so the
// drums of `band.axis-4bar` loop under the learner's twelve bars, as in U11.L05.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 104;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** U11.L05's standard 12-bar blues in C: I7 ×4, IV7 ×2, I7 ×2, V7 IV7 I7 V7. */
const PLAIN = "<C7!4 F7!2 C7!2 G7 F7 C7 G7>";
/** The quick change in bar 2, the standard ending. */
const QUICK = "<C7 F7 C7!2 F7!2 C7!2 G7 F7 C7 G7>";
/** The quick change and the turnaround: I–IV | I–V in bars 11 and 12, two beats a chord. */
const BOTH = "<C7 F7 C7!2 F7!2 C7!2 G7 F7 [C7 F7] [C7 G7]>";

const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("piano")';
/** The root of every chord on every beat: under the turnaround it changes on beat 3. */
const BASS = 'bass: chord(changes).rootNotes(2).struct("x x x x").s("ebass").lpf(600)';
/** U11.L05's two-bar riff on the blues scale: C E♭ F G | G♭ F C. */
const RIFF = 'gtr: n("<[0 1 2 4] [3 2 0 ~]>").scale("C3:blues").s("crunch")';
const piece = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

const HOOK = piece(BOTH, RIFF);
const PLAIN_PIECE = piece(PLAIN, RIFF);

/** S4: the plain form; bars 1–4 are the place to edit. */
const QUICK_STARTER = piece("<⟪C7 C7 C7!2⟫ F7!2 C7!2 G7 F7 C7 G7>");
const QUICK_SOLUTION = piece(QUICK);
/** S5: the quick-change form; bars 11–12 are the place to edit. */
const TURN_STARTER = piece("<C7 F7 C7!2 F7!2 C7!2 G7 F7 ⟪C7 G7⟫>");
const TURN_SOLUTION = piece(BOTH);

/**
 * The Make moves the blues to G, the key guitarists reach for first (learner review: in C the Make repeated
 * S4 and S5 edit for edit, and its minimal pass was the hook). Same numerals, new names: I7 IV7 V7 are G7 C7
 * D7, so the quick change and the turnaround are written from the numerals, not copied. The exercise's key is
 * G blues, so `blues-form`, bar 12's V and the riff's ♭3 are read in G.
 */
const G_PLAIN = "<G7!4 C7!2 G7!2 D7 C7 G7 D7>";
const G_QUICK = "<G7 C7 G7!2 C7!2 G7!2 D7 C7 G7 D7>";
const G_BOTH = "<G7 C7 G7!2 C7!2 G7!2 D7 C7 [G7 C7] [G7 D7]>";
/** U11.L05's riff on the blues scale of G, low on the guitar: G B♭ C D | D♭ C G. */
const G_RIFF = 'gtr: n("<[0 1 2 4] [3 2 0 ~]>").scale("G2:blues").s("crunch")';
const MAKE_STARTER = piece(G_PLAIN, G_RIFF);

/** Drums from the Band (a 4-bar groove that loops under the 12 bars); chords and bass are the learner's. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NUMERALS = {
  m: "harmony",
  level: "rn",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
} as const;

export default defineLesson({
  id: "U11.L06",
  version: 4,
  title: "Quick Change & Turnaround",
  objective: "I can add a quick change and a turnaround to a 12-bar blues.",
  key: { tonic: "C", mode: "blues" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H10"],
  terms: [
    { id: "term.quick-change", step: "S3" },
    { id: "term.turnaround", step: "S5" },
  ],
  canDo: ["cd.write.turnaround"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two ways round",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 12 },
      exercise: {
        kind: "listen",
        id: "two-ways-round",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the 12-bar blues you wrote last lesson, then the same blues changed in two places. Listen for where the second one leaves home sooner, and for how its last two bars lead back to the top.",
        skills: [{ skill: "H10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN_PIECE, caption: "The twelve bars as you wrote them last lesson.", bars: 12 },
          {
            code: HOOK,
            caption: "The changed blues. Listen to its first line, then to its last two bars.",
            bars: 12,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Two in one bar",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "two-in-one-bar",
        version: 1,
        role: "practice",
        prompt:
          "The new `changes` ends with `[C7 F7] [C7 G7]`, and inside `< >` each entry lasts one bar. Predict what plays in the bar written `[C7 F7]`. Pick one answer, then listen to check it.",
        skills: [{ skill: "H10", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 12,
        mode: "choose",
        choices: [
          { id: "half-and-half", label: "C7 for two beats, then F7 for two beats" },
          { id: "together", label: "C7 and F7 at the same time" },
          { id: "alternate", label: "C7 this time round, F7 the next" },
        ],
        correct: ["half-and-half"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where it moves",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "where-it-moves", code: HOOK, bars: 12 },
      exercise: {
        kind: "run-investigate",
        id: "where-it-moves",
        version: 1,
        role: "practice",
        prompt:
          "Run the new blues and read the numerals in the chord band, bar by bar. Then answer two questions: in which bar IV first arrives, and how many chords sound in bars 11 and 12 together.",
        skills: [{ skill: "H10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop the loop and read the chord band from bar 1: count the bars, and count each chord in the last two.",
        },
        hints: ladder(
          "In the blues you wrote last lesson, IV waited until bar 5. Is that still true?",
          "Read the string: `C7 F7 C7!2 …`. Each entry is a bar. The last two entries each hold a pair in `[ ]`.",
          "Bar 1 is C7 and the next entry is F7. The last two bars hold two chords each.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "In which bar does IV first arrive now?",
            options: [
              { id: "bar-2", label: "Bar 2" },
              { id: "bar-4", label: "Bar 4" },
              { id: "bar-5", label: "Bar 5, as before" },
            ],
            correct: ["bar-2"],
          },
          { q: "number", prompt: "How many chords sound in bars 11 and 12 together?", correct: 4 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["bar-2"], number: 4 } },
            expect: "pass",
          },
          {
            name: "bar 5, as in the standard form",
            response: { answer: { choice: ["bar-5"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one chord a bar: 2",
            response: { answer: { choice: ["bar-2"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "IV in bar 2",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "iv-in-bar-two",
        version: 1,
        role: "check",
        prompt:
          "Change the highlighted first line, bars 1–4, to: I in bar 1, IV in bar 2, then I in bars 3 and 4. Write chord names, as in the rest of the string. Keep bars 5–12 as they are.",
        skills: [{ skill: "H10", w: 1 }],
        code: { starter: QUICK_STARTER },
        reference: { solutions: [QUICK_SOLUTION], bars: 12 },
        matcher: NUMERALS,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.rn":
            "Bar {bar}: you have {got}, the quick change has {exp} there. IV visits for bar 2 only; bars 1, 3 and 4 are I.",
        },
        hints: ladder(
          "Only bar 2 changes. Which chord is IV in C?",
          "IV in C is F7. It takes bar 2 alone; bars 3 and 4 are C7 again.",
          "The first entry stays `C7`. The second becomes the IV chord.",
        ),
        tests: [
          { name: "reference", response: { code: QUICK_SOLUTION }, expect: "pass" },
          {
            name: "written one bar each: C7 F7 C7 C7",
            response: { code: piece("<C7 F7 C7 C7 F7!2 C7!2 G7 F7 C7 G7>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: piece("<C7 C7 C7!2 F7!2 C7!2 G7 F7 C7 G7>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "IV held for two bars: bars 2 and 3",
            response: { code: piece("<C7 F7 F7 C7 F7!2 C7!2 G7 F7 C7 G7>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "IV in bar 3 instead",
            response: { code: piece("<C7 C7 F7 C7 F7!2 C7!2 G7 F7 C7 G7>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "the last line changed as well",
            response: { code: piece("<C7 F7 C7!2 F7!2 C7!2 G7 F7 [C7 F7] [C7 G7]>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Back to the top",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "back-to-the-top",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the highlighted bars 11 and 12 with two chords each: I then IV in bar 11, I then V in bar 12. Put each pair inside `[ ]` so the two chords share the bar.",
        skills: [{ skill: "H10", w: 1 }],
        code: { starter: TURN_STARTER },
        reference: { solutions: [TURN_SOLUTION], bars: 12 },
        matcher: NUMERALS,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.rn":
            "Bar {bar}: you have {got}, the target has {exp} there. Bar 11 is I then IV, bar 12 is I then V, each pair in `[ ]`.",
        },
        hints: ladder(
          "Each of the last two bars needs two chords, written as one pair. Which chords are I, IV and V in C?",
          "A pair in `[ ]` splits its bar in half. Bar 11 is home, then F7; bar 12 is home, then G7.",
          "Bar 11 is `[C7 F7]`. Bar 12 starts on C7 too.",
        ),
        tests: [
          { name: "reference", response: { code: TURN_SOLUTION }, expect: "pass" },
          {
            name: "the same halves written with @",
            response: { code: piece("<C7 F7 C7!2 F7!2 C7!2 G7 F7 [C7@2 F7@2] [C7 G7]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: piece("<C7 F7 C7!2 F7!2 C7!2 G7 F7 C7 G7>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "I–V twice: bar 11 goes to V too",
            response: { code: piece("<C7 F7 C7!2 F7!2 C7!2 G7 F7 [C7 G7] [C7 G7]>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "no brackets: four new bars, fourteen in all",
            response: { code: piece("<C7 F7 C7!2 F7!2 C7!2 G7 F7 C7 F7 C7 G7>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "ends on I: [C7 F7] [C7 C7]",
            response: { code: piece("<C7 F7 C7!2 F7!2 C7!2 G7 F7 [C7 F7] [C7 C7]>") },
            expect: "fail",
            feedback: ["harmony.rn"],
          },
          {
            name: "the quick change taken out as well",
            response: { code: piece("<C7!4 F7!2 C7!2 G7 F7 [C7 F7] [C7 G7]>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Quick or standard",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "quick-or-standard",
        version: 1,
        role: "check",
        prompt:
          "Listen to the first six bars of a blues, in C or another key. Pick quick change or standard form. Listen closely to bars 1 and 2.",
        skills: [{ skill: "F04", w: 1 }],
        hints: [
          { text: "Listen to the first two bars only. Does the chord stay put?" },
          {
            text: "In the quick change the chord moves to IV in bar 2 and straight back; in the standard form nothing moves until bar 5.",
          },
          {
            text: "Hear it again, slower, and hum the lowest note of bars 1 and 2.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.frm.blues", level: 3 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "quick-change", label: "Quick change (IV in bar 2)" },
            { id: "standard", label: "Standard" },
          ],
        },
        correct: {},
        feedbackText: {
          "id.wrong": "Not that one. Listen to bar 2 only: does the chord move away and come straight back?",
        },
        srs: [{ family: "fam.frm.blues", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your blues, round and round",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-blues-round-and-round",
        version: 1,
        role: "practice",
        prompt:
          "Write your song's second chorus, in G, where I, IV and V are G7, C7 and D7. Give it a quick change: IV in bar 2, I in bars 3 and 4. Then end bars 11–12 on V: I–IV then I–V, I then V, or your own. Done when bar 2 is IV and the rest follows the twelve bars.",
        skills: [{ skill: "H10", w: 1 }],
        key: { tonic: "G", mode: "blues" },
        code: { starter: MAKE_STARTER },
        bars: [12, 24],
        saveAs: "sketch",
        rubric: [
          {
            id: "quick-change-blues",
            label: "IV in bar 2, I in bars 3–4, and the rest of the twelve bars in order",
            required: true,
            skills: ["H10", "F04"],
            rule: "blues-form",
            variant: "quick-change",
          },
          {
            id: "v-in-bar-12",
            label: "Bar 12 plays V (D7)",
            required: false,
            skills: ["H10"],
            rule: "contains-rn",
            rn: ["V"],
            min: 1,
            section: { bars: [12, 12] },
          },
          {
            id: "blue-note",
            label: "The gtr line plays the blue 3rd, ♭3 (B♭ in G), at least once",
            required: false,
            skills: ["S11"],
            rule: "degree-set",
            track: "gtr",
            contains: ["b3"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral. It also
        // hides the grader's detail for the standard form, which today names choruses instead of bar 2.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with bar 2: it should be IV. In G, which chord is IV?",
          "Bar 2 becomes C7, IV in G. For the turnaround, bars 11 and 12 each hold two chords in `[ ]`, the second one ending on D7, V.",
          'Start the string `"<G7 C7 G7!2 C7!2 …"`. The last two entries can be `[G7 C7]` and one more pair.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the quick change and the turnaround, in G",
            response: { code: piece(G_BOTH, G_RIFF) },
            expect: "pass",
          },
          {
            name: "the quick change alone, the standard ending",
            response: { code: piece(G_QUICK, G_RIFF) },
            expect: "pass",
          },
          {
            name: "beyond the brief: two choruses, two turnarounds, a new riff on the organ",
            response: {
              code: code(
                changes("<G7 C7 G7!2 C7!2 G7!2 D7 C7 G7 D7 G7 C7 G7!2 C7!2 G7!2 D7 C7 [G7 C7] [G7 D7]>"),
                'chords: chord(changes).voicing().s("organ").gain(.6)',
                BASS,
                'gtr: n("<[4 3 2 0] [~ 0 1 0]>").scale("G2:minor:pentatonic").s("crunch")',
              ),
            },
            expect: "pass",
          },
          {
            name: "the turnaround without the quick change",
            response: { code: piece("<G7!4 C7!2 G7!2 D7 C7 [G7 C7] [G7 D7]>", G_RIFF) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the lesson's blues in C pasted in",
            response: { code: HOOK },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
