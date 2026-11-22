// U17.L01 Pivot Chords. A song can leave home and make another note home: a modulation. The smooth way goes
// through a chord that both keys own, the pivot chord: A minor is vi in C and ii in G. After it comes the new
// key's own V7 (D7, with the F♯ that C major does not have), and G is home. The learner hears it first as a
// verse that sets out from C and ends at rest on G, beside the same verse ending on G as a chord that still
// wants C. What the learner has: numerals in a major key (U06.L02), the circle's neighbours (U03.L07), the
// dominant seventh (U11.L04), D7 before G as V7/V, a one-bar visit (U15.L02), chord names in one `const` that
// drives chords and bass (U08.L04), a patterned `.scale()` (U03.L05). Not yet: the lift with no door (U17.L02),
// hearing a move by ear (U17.L03), the relative minor as a destination (U17.L03's Make). Spec:
// content/specs/U17.md.
//
// How it is graded (AUTHORING §19.7): "which keys own Am" and "where is the first new note" are an investigate
// step; the pivot named in two keys is an `rn-palette` with a key per slot (`slotKeys`), read by degree and
// quality; the door written in code (S5) and the page read into code (S6) are named chords, graded by pitch
// classes and lowest note per onset (`pcset`). The Make's one required rule is `modulation` to the dominant
// `via: "pivot"`: the piece's key plan ends a 5th up, and the chord before the new key's first V belongs to both
// keys. The planned feature `key-plan` is not used (it is graded but not yet drawn): the steps that read the
// notes across the change show note names on the roll, and S6's lead sheet keeps F major's signature (bars 3
// and 4 carry their B♮).
import { defineLesson, type HintLadder, type KeySpec, type LeadSheetSpec } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const C_MAJOR: KeySpec = { tonic: "C", mode: "major" };
const G_MAJOR: KeySpec = { tonic: "G", mode: "major" };
const F_MAJOR: KeySpec = { tonic: "F", mode: "major" };

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
/** The root of every chord, low on the upright: the voicing above does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const mel = (pattern: string, scale: string) => `mel: n("${pattern}").scale("${scale}").s("piano")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/**
 * The verse tune, the same for six bars: E G E | C | F A F | G | E G E | C E, a chord note on every strong beat.
 * Bars 7–8 either stay in C (F A F | G over F and G: it stops on G, the chord that wants C) or move: the same
 * numbers as the end of a phrase, 5 7 5 | 1', read in G (D F♯ D | G). `G3:major` keeps the tune where it was:
 * its `n` 7 is the G above middle C, the same G4 the verse that stays ends on.
 */
const FIRST_SIX = "[2 ~ 4 2] [0 ~ ~ ~] [3 ~ 5 3] [4 ~ ~ ~] [2 ~ 4 2] [0 ~ 2 ~]";
const STAY_TUNE = `<${FIRST_SIX} [3 ~ 5 3] [4 ~ ~ ~]>`;
const MOVE_TUNE = `<${FIRST_SIX} [4 ~ 6 4] [7 ~ ~ ~]>`;
/** The tune's key plan: six bars of C major, then two of G major. */
const PLAN = "<C4:major!6 G3:major!2>";

/** S1 and the Make's starter: the verse that stays in C. */
const STAY = loop("<C Am F G C Am F G>", mel(STAY_TUNE, "C4:major"));
/** The hook and the target of S5: the second time round Am opens the door, D7 walks through, G is home. */
const HOOK = loop("<C Am F G C Am D7 G>", mel(MOVE_TUNE, PLAN));

/** S2 and S4: the door on its own. */
const DOOR = loop("<C Am D7 G>");

/** S5: the tune already moves; the last two chords do not. */
const door = (last: string) => loop(`<C Am F G C Am ${last}>`, mel(MOVE_TUNE, PLAN));
const DOOR_STARTER = door("⟪F G⟫");

/**
 * S6, Play from the page: four bars that move from F major to C major. The tune: A C A over F, F A over Dm,
 * G B G over G7 (B♮, which F major does not have), C over C. Dm is vi in F and ii in C.
 */
const PAGE_TUNE = mel("<[2 ~ 4 2] [0 ~ 2 ~] [4 ~ 6 4] [7 ~ ~ ~]>", "<F4:major!2 C4:major!2>");
const page = (form: string) => loop(form, PAGE_TUNE);
const PAGE_STARTER = page("<⟪F F F F⟫>");
const PAGE_SOLUTION = page("<F Dm G7 C>");
const LEAD_SHEET: LeadSheetSpec = {
  melody: "mel",
  chords: {
    chart: [
      { bar: 1, beat: 1, symbol: "F" },
      { bar: 2, beat: 1, symbol: "Dm" },
      { bar: 3, beat: 1, symbol: "G7" },
      { bar: 4, beat: 1, symbol: "C" },
    ],
  },
  title: "From F to C",
};

/** The Make: the verse that stays (S1), to be turned the second time round. */
const MAKE_STARTER = STAY;
const MAKE_MINIMAL = HOOK;
/**
 * Beyond the brief: Em as the door (iii in C, vi in G), a new tune, organ stabs and a bass that walks on the
 * beats. G E G | A G E | F A F | G D | E G C' | B G E, then D F♯ D and G in G.
 */
const MAKE_RICH = code(
  changes("<C Am F G C Em D7 G>"),
  'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("organ").gain(.6)',
  'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")',
  mel("<[4 ~ 2 4] [5 ~ 4 2] [3 ~ 5 3] [4 ~ 1 ~] [2 ~ 4 7] [6 ~ 4 2] [4 ~ 6 4] [7 ~ ~ ~]>", PLAN),
);

/** Drums from the Band; chords, bass and tune are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const LEAD = { roll: false, staff: "lead", keyboard: false } as const;

export default defineLesson({
  id: "U17.L01",
  version: 4,
  title: "Pivot Chords",
  objective:
    "I can change key through a chord that both keys share: Am is vi in C and ii in G, then D7 brings G home.",
  key: C_MAJOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["H14"],
  practises: [],
  terms: [
    { id: "term.modulation", step: "S3" },
    { id: "term.pivot-chord", step: "S3" },
  ],
  canDo: ["cd.write.pivot-modulation"],
  // Pop and indie take piano and electric bass for the Rhodes and the upright; the notes never change.
  flavours: {
    "flavour.pop": { sounds: { "snd.rhodes": "snd.piano", "snd.upright": "snd.ebass" } },
    "flavour.indie": { sounds: { "snd.rhodes": "snd.piano", "snd.upright": "snd.ebass" } },
  },
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same chord, new home",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "same-chord-new-home",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both versions of the eight-bar verse. Both end on G in bar 8; the second changes bar 7, chord and tune. Listen for the last G each time: does it sound like a pause that wants to go on, or like home?",
        skills: [{ skill: "H14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: STAY, caption: "C, Am, F, G, twice. Hold the last G in your ear.", bars: 8 },
          {
            code: HOOK,
            caption: "The second time round, bar 7 is D7. Hear where the last G sits now.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "The new note",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "the-new-note",
        version: 1,
        role: "practice",
        prompt:
          '`chord("<C Am D7 G>")` plays three chords that C major owns, then D7. D7 is D, F♯, A and C. Predict which one of those four notes C major does not have, and pick it.',
        skills: [{ skill: "H14", w: 1 }],
        hints: null,
        tests: [],
        code: DOOR,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "f-sharp", label: "F♯: degree ♯4, fi, the note a half step below G" },
          { id: "b-flat", label: "B♭: degree ♭7, te" },
          { id: "c-sharp", label: "C♯: degree ♯1, di" },
        ],
        correct: ["f-sharp"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "The door",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "the-door", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "the-door",
        version: 1,
        role: "practice",
        prompt:
          "Answer two questions about bars 5 to 8. First: spell Am, the chord in bar 6, and check each note against C major (no sharps) and G major (one sharp, F♯); pick the keys that own all three. Second: find the bar where the first note from outside C major sounds on the roll, and enter its number.",
        skills: [{ skill: "H14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Am is A, C and E: check each one against C major (no sharps) and G major (F♯). For the bar, find the first F♯ on the roll.",
        },
        hints: ladder(
          "Start with the three notes of Am. Does either key need a sharp to play them?",
          "C major has no sharps. G major has one, F♯. Am is A, C and E.",
          "None of A, C or E is an F, so both scales hold all three. For the bar, look for the first F♯ in the chords or the tune.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which keys own Am?",
            options: [
              { id: "both", label: "C major and G major" },
              { id: "c-only", label: "C major only" },
              { id: "g-only", label: "G major only" },
            ],
            correct: ["both"],
          },
          { q: "number", prompt: "In which bar does the first note from outside C major sound?", correct: 7 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["both"], number: 7 } }, expect: "pass" },
          {
            name: "Am taken to be C's alone",
            response: { answer: { choice: ["c-only"], number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "bar 8: the arrival, not the first new note",
            response: { answer: { choice: ["both"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Two names",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "two-names",
        version: 1,
        role: "check",
        key: C_MAJOR,
        prompt:
          "Am is the pivot chord of C, Am, D7, G. Name it twice: in the first slot, its numeral in C major; in the second slot, its numeral in G major. Done when each slot holds the numeral Am has in that slot's key.",
        skills: [
          { skill: "H14", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        hints: ladder(
          "A numeral counts from the key's home note. Count up to A from C for the first slot, and from G for the second.",
          "Count C D E F G A in C major, and G A in G major. Am is a minor chord, so both numerals are lower case.",
          "In C major A is the sixth note up, so the first slot is the minor chord on 6. Now count from G.",
        ),
        stimulus: { src: "code", code: DOOR, bars: 4, showCode: true },
        answer: {
          ui: "rn-palette",
          slots: 2,
          allow: ["triads"],
          labels: ["In C major", "In G major"],
          slotKeys: [C_MAJOR, G_MAJOR],
        },
        correct: { rn: ["vi", "ii"] },
        spelling: "enharmonic",
        order: "sequence",
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        feedbackText: {
          "harmony.rn-degree":
            "Slot {slot}: {got} names another degree. Count up to A from that slot's home: C for slot 1, G for slot 2.",
          "harmony.rn-case": "Slot {slot}: {got} is close. Am is minor, so its numeral is lower case.",
        },
        tests: [
          { name: "vi in C, ii in G", response: { answer: { rn: ["vi", "ii"] } }, expect: "pass" },
          {
            name: "the two swapped",
            response: { answer: { rn: ["ii", "vi"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "both read in C",
            response: { answer: { rn: ["vi", "vi"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "upper case: a major chord on 6",
            response: { answer: { rn: ["VI", "ii"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Write the door",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "write-the-door",
        version: 1,
        role: "check",
        prompt:
          "The tune already moves to G in bars 7 and 8; the chords do not. Rewrite the last two chords of `changes`. Bar 7: G's own V7, the dominant seventh built on the note a 5th above G. Bar 8: G. Keep Am in bar 6 and the tune. Done when the chords land in G with the tune.",
        skills: [{ skill: "H14", w: 1 }],
        code: { starter: DOOR_STARTER },
        reference: { solutions: [HOOK], bars: 8 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so a D7 cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. G's own V7 is the dominant seventh a 5th above G, and it holds G major's F♯.",
        },
        srs: [{ family: "fam.key.circle", mode: "review-if-due" }],
        hints: ladder(
          "Bar 7 needs the chord that pulls hardest into G, the way G7 pulls into C. Bar 8 is G itself.",
          "In C, G7 is V7 and pulls home. G's own V7 is the dominant seventh built on the note a 5th above G, and the bar after it is G itself.",
          "A 5th above G is D: bar 7 is the dominant seventh on D. Bar 8 is the new home.",
        ),
        tests: [
          { name: "reference", response: { code: HOOK }, expect: "pass" },
          { name: "each bar in brackets", response: { code: door("[D7] [G]") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: door("F G") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "Dm G: ii and V of C, the phrase never leaves",
            response: { code: door("Dm G") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "D G: the triad, without its 7th",
            response: { code: door("D G") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "G D7: the two swapped",
            response: { code: door("G D7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the tune's key plan changed as well",
            response: { code: loop("<C Am F G C Am D7 G>", mel(MOVE_TUNE, "<C4:major!6 G4:major!2>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "D7 cut to a click: the right chord, 1% of the bar",
            response: { code: door("[D7@0.01 ~@0.99] G") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.5,
      graded: true,
      // U17's "Play from the page" (AUTHORING §4): the four bars are shown only as a lead sheet.
      ui: { panels: LEAD, leadSheet: LEAD_SHEET, band: DRUMS },
      example: { id: "the-page", code: code(PAGE_TUNE), bars: 4 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        key: F_MAJOR,
        prompt:
          "Write the four chord symbols from the lead sheet into `changes`, one per bar, in order. The bass reads the same string, so change nothing else. The four bars start in F major and end in C major; Dm in bar 2 is the pivot chord. Done when every bar plays the chord written above it.",
        skills: [
          { skill: "H14", w: 0.6 },
          { skill: "N06", w: 0.4 },
        ],
        code: { starter: PAGE_STARTER },
        reference: { solutions: [PAGE_SOLUTION], bars: 4 },
        // `durations`: each chord lasts its bar, as the page writes it; a chord cut to a click is not the page's.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the page has {exp}. Read the symbol above that bar: the letter is the root, and a 7 adds the dominant seventh.",
        },
        hints: ladder(
          "The chords are written on the page, not in the code. Look above the staff, one symbol per bar.",
          "Each bar has a symbol above the staff. Write the four in order, one a bar, inside `< >`.",
          "Bars 1 and 2 are F and Dm. Bar 3 is the new key's V7, the chord with B♮ in it.",
        ),
        tests: [
          { name: "reference", response: { code: PAGE_SOLUTION }, expect: "pass" },
          { name: "each bar in brackets", response: { code: page("<[F] [Dm] [G7] [C]>") }, expect: "pass" },
          {
            name: "unchanged: F in every bar",
            response: { code: page("<F F F F>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the chords of F major only: Gm for G7",
            response: { code: page("<F Dm Gm C>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "G for G7: the 7th left off",
            response: { code: page("<F Dm G C>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the tune rewritten into F throughout",
            response: {
              code: loop("<F Dm G7 C>", mel("<[2 ~ 4 2] [0 ~ 2 ~] [4 ~ 6 4] [7 ~ ~ ~]>", "F4:major")),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "Dm cut to a click: the right chord, 1% of the bar",
            response: { code: page("<F [Dm@0.01 ~@0.99] G7 C>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A verse that leaves home",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "a-verse-that-leaves-home",
        version: 1,
        role: "practice",
        key: C_MAJOR,
        prompt:
          "Make the verse end in G major the second time round. Bar 6: a chord both C and G major own. Bar 7: G's V7. Bar 8: G. Then give the tune's `.scale()` a key plan: six bars of C major, then two of G major. Done when chords and tune both end in G.",
        skills: [{ skill: "H14", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [8, 16],
        saveAs: "sketch",
        rubric: [
          {
            id: "ends-in-g-through-a-pivot",
            label: "The verse ends in G major, reached by a chord both C and G major own, then G's V, then G",
            required: true,
            skills: ["H14"],
            rule: "modulation",
            to: "dominant",
            via: "pivot",
          },
          {
            id: "bass-on-roots",
            label: "The bass plays the chord's root on most chord changes",
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
          "Keep bars 1 to 6 and change the end. Bar 6 is the door: which chord there already belongs to G major as well as to C?",
          "Am is vi in C and ii in G: keep it as the door. After it, G's own V7 pulls into G. The tune's `.scale()` needs a key plan: six bars of C major, then two of G.",
          'Bar 7 is the dominant seventh on D, bar 8 is G. For the tune, start `.scale("<C4:major!6` and finish it with G in the octave that keeps the tune where it is.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: Am, D7, G and a key plan", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: Em as the door, organ stabs, a walking bass, a new tune",
            response: { code: MAKE_RICH },
            expect: "pass",
          },
          {
            name: "a jump: F before D7 belongs to C major only",
            response: { code: loop("<C Am F G C F D7 G>", mel(MOVE_TUNE, PLAN)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chords move, the tune stays in C and rubs against D7",
            response: { code: loop("<C Am F G C Am D7 G>", mel(STAY_TUNE, "C4:major")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            // Corrections pass (fix:leftovers): the arrival is G major's home chord, not only its root.
            name: "D7 that lands on G minor",
            response: { code: loop("<C Am F G C Am D7 Gm>", mel(MOVE_TUNE, PLAN)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the door into a G major seventh",
            response: { code: loop("<C Am F G C Am D7 G^7>", mel(MOVE_TUNE, PLAN)) },
            expect: "pass",
          },
          {
            name: "a lift to D instead of a move to G",
            response: {
              code: loop("<C Am F G D Bm G A>", mel(STAY_TUNE, "<C4:major!4 D4:major!4>")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
