// U17.L02 Truck-Driver & Direct Modulation (exemplar of U17). The last chorus comes back a whole step higher
// with no chord to prepare it: a direct modulation, the move players call the truck-driver's gear change. In
// code the key of a line written in degrees is a pattern: `.scale("<C4:major!4 D4:major!4>")` holds C major
// for four bars, then D major for four, and the numbers in `n()` never change. In a song with sections the
// key plan counts the bars of the whole piece and follows `arrange()`, because inside `arrange()` every
// section starts again from its own first bar (contracts §6.8 item 4, STYLE §9). Chords written by name do
// not follow a key plan: the lifted chorus gets its own const with every name a whole step up
// (`chordsChorus2`, a variant of the chorus, so every track still lists the same sections). What the learner
// has: the patterned `.scale()` (U03.L05), `!` (U01), chords by name (U05.L08), sections and one `arrange()`
// per track (U09.L02), modulation through a pivot chord (U17.L01). Not yet: hearing where a key
// changes (U17.L03), transcribing through one (U17.L04). Spec: content/specs/U17.md.
//
// How it is graded (AUTHORING §19.7): the planned `key-plan` feature and `key-change` rule are not used, so
// every check here is an implemented shape. A lifted line is an `events` match in absolute pitch over the
// whole example (a line a half step up, a plan counted per section or a line left in C all differ from the
// target note by note); `.transpose()` after `.scale()` would sound right and is refused by a `must-not-use`
// constraint, as contracts §6.8 item 2 asks. Until `key-plan` reads each bar in its own key the grader words a
// wrong note of the lifted bars in degrees of C, so those steps override `melody.wrong-degree` with text that
// names the bars and the two keys. The Make's one required rule is `key-change` on the last section, +2 for
// four bars or more: the last chorus is a whole step above the chorus before it, so a song that sits in D (or
// on one chord) from the start fails, as do chord names left in C under a lifted tune and a tune left in C over
// lifted chords (corrections pass: `in-key` on the last section alone passed a song that never moved).
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the chorus on its own (S2–S5): eight bars, the second four a step higher -------------------------------

/** The chorus tune: G G A | G D | A A C | C A over C G Am F, a chord note on every strong beat. */
const CHORUS_TUNE = "<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>";
/** The chorus chords, then the same four a whole step up: every name moves, the numerals stay I V vi IV. */
const LOOP_CHORDS = 'chords: chord("<C G Am F D A Bm G>").voicing().struct("x*4").s("piano")';
const loopBass = (scale: string) =>
  `bass: n("<0 4 5 3>").struct("x ~ x x").scale("${scale}").s("ebass").lpf(700)`;
const loopMel = (scale: string) => `mel: n("${CHORUS_TUNE}").scale("${scale}").s("piano")`;
const chorusLoop = (mel: string) => code(LOOP_CHORDS, loopBass("<C2:major!4 D2:major!4>"), loopMel(mel));

/** S2: the tune alone with its key plan. */
const TUNE_ALONE = code(loopMel("<C4:major!4 D4:major!4>"));
/** S3: the chorus, then the chorus a whole step up. */
const CHORUS_LIFT = chorusLoop("<C4:major!4 D4:major!4>");
/** S4: chords and bass lift at bar 5; the tune stays in C and clashes. */
const TUNE_STARTER = chorusLoop("⟪C4:major⟫");

/** S5: two bars of the chorus, then the same two bars lifted: by a whole step, or by a half step. */
const shortLift = (names: string, tonic: string) =>
  code(
    `chords: chord("<C G ${names}>").voicing().struct("x*4").s("piano")`,
    `bass: n("<0 4>").struct("x ~ x x").scale("<C2:major!2 ${tonic}2:major!2>").s("ebass").lpf(700)`,
    `mel: n("<[4 ~ 4 5] [4 ~ 1 ~]>").scale("<C4:major!2 ${tonic}4:major!2>").s("piano")`,
  );
const WHOLE_STEP = shortLift("D A", "D");
const HALF_STEP = shortLift("Db Ab", "Db");
/** The two bars with no lift, as the question's context. */
const NO_LIFT = code(
  'chords: chord("<C G>").voicing().struct("x*4").s("piano")',
  loopBass("C2:major").replace("<0 4 5 3>", "<0 4>"),
  'mel: n("<[4 ~ 4 5] [4 ~ 1 ~]>").scale("C4:major").s("piano")',
);

// --- the song (S1, S6, S7): verse, chorus, chorus -----------------------------------------------------------

/** The verse tune, low and close: E E D | C | F F E | D over C Am F G. */
const VERSE_TUNE = "<[2 ~ 2 1] [0 ~ ~ ~] [3 ~ 3 2] [1 ~ ~ ~]>";
const CHORDS_VERSE = 'const chordsVerse = chord("<C Am F G>").voicing().struct("x ~ x ~")';
const CHORDS_CHORUS = 'const chordsChorus = chord("<C G Am F>").voicing().struct("x*4")';
/** The lifted chorus: a variant of the chorus (the digit), so every track still lists verse, chorus, chorus. */
const chordsChorus2 = (names: string) => `const chordsChorus2 = chord("<${names}>").voicing().struct("x*4")`;
const BASS_VERSE = 'const bassVerse = n("<0 5 3 4>").struct("x ~ ~ x")';
const BASS_CHORUS = 'const bassChorus = n("<0 4 5 3>").struct("x ~ x x")';
const melVerse = (tail = "", tune = VERSE_TUNE) => `const melVerse = n("${tune}")${tail}`;
const melChorus = (tail = "", tune = CHORUS_TUNE) => `const melChorus = n("${tune}")${tail}`;

/** One `arrange()` per track: verse, chorus, chorus, four bars each (12 bars). */
const vcc = (role: string, last = `${role}Chorus`) =>
  `arrange([4, ${role}Verse], [4, ${role}Chorus], [4, ${last}])`;
const CHORDS = `chords: ${vcc("chords", "chordsChorus2")}.s("piano")`;
const bass = (scale: string) => `bass: ${vcc("bass")}.scale("${scale}").s("ebass").lpf(700)`;
const mel = (tail: string) => `mel: ${vcc("mel")}${tail}.s("piano")`;
const scale = (s: string) => `.scale("${s}")`;

interface SongParts {
  /** The names of the last chorus. */
  lifted?: string;
  bass?: string;
  /** What follows the tune's `arrange()`. */
  mel?: string;
  /** What follows `n("…")` in the tune's two section consts. */
  inVerse?: string;
  inChorus?: string;
  verseTune?: string;
  chorusTune?: string;
}
const song = (o: SongParts = {}) =>
  `${TEMPO}${[
    CHORDS_VERSE,
    CHORDS_CHORUS,
    chordsChorus2(o.lifted ?? "D A Bm G"),
    BASS_VERSE,
    BASS_CHORUS,
    melVerse(o.inVerse, o.verseTune),
    melChorus(o.inChorus, o.chorusTune),
  ].join("\n")}\n\n${[
    CHORDS,
    bass(o.bass ?? "<C2:major!8 D2:major!4>"),
    mel(o.mel ?? scale("<C4:major!8 D4:major!4>")),
  ].join("\n")}`;

/** The hook and the target of S6: the last chorus a whole step up, on every line. */
const SONG = song();

/** S6: chords and bass lift; the tune's key is still inside its two sections. */
const IN_C = scale("C4:major");
const SECTIONS_STARTER = song({ inVerse: `⟪${IN_C}⟫`, inChorus: `⟪${IN_C}⟫`, mel: "⟪⟫" });
const sections = (o: SongParts) => song({ inVerse: "", inChorus: "", ...o });

/** Known wrong for the Make: twelve bars on one chord and one note that never change key (corrections pass). */
const NO_LIFT_SONG = (chordName: string, note: string) =>
  code(
    `const chordsVerse = chord("${chordName}").voicing()`,
    "const chordsChorus = chordsVerse",
    `const bassVerse = note("${note}2")`,
    "const bassChorus = bassVerse",
    `const melVerse = note("${note}4")`,
    "const melChorus = melVerse",
    "",
    'chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsChorus]).s("piano")',
    'bass: arrange([4, bassVerse], [4, bassChorus], [4, bassChorus]).s("ebass")',
    'mel: arrange([4, melVerse], [4, melChorus], [4, melChorus]).s("piano")',
  );

/** The Make: the whole song in C. `chordsChorus2` is still a copy of the chorus; bass and tune have one key. */
const MAKE_STARTER = song({ lifted: "C G Am F", bass: "C2:major", mel: scale("C4:major") });
const MAKE_MINIMAL = SONG;
/**
 * Beyond the brief: verse, chorus, verse, chorus, then the lifted chorus (20 bars), a new chorus tune that
 * starts on high C, the chords on the Rhodes, and strings that come in for the lift only.
 */
const vcvcc = (role: string, last = `${role}Chorus`) =>
  `arrange([4, ${role}Verse], [4, ${role}Chorus], [4, ${role}Verse], [4, ${role}Chorus], [4, ${last}])`;
const MAKE_RICH = `${TEMPO}${[
  CHORDS_VERSE,
  CHORDS_CHORUS,
  chordsChorus2("D A Bm G"),
  BASS_VERSE,
  BASS_CHORUS,
  melVerse(),
  melChorus("", "<[7 ~ 7 6] [4 ~ ~ 4] [5 ~ 5 4] [5 ~ ~ ~]>"),
  'const padChorus = n("<[4,7] [4,6] [5,7] [5,7]>")',
].join("\n")}\n\n${[
  `chords: ${vcvcc("chords", "chordsChorus2")}.s("rhodes")`,
  `bass: ${vcvcc("bass")}.scale("<C2:major!16 D2:major!4>").s("ebass").lpf(700)`,
  `mel: ${vcvcc("mel")}.scale("<C4:major!16 D4:major!4>").s("piano")`,
  'pad: arrange([4, silence], [4, silence], [4, silence], [4, silence], [4, padChorus]).scale("<C4:major!16 D4:major!4>").s("strings").gain(.5)',
].join("\n")}`;

/** A lifted line is its notes, where they sound (contracts §6.8): compared in absolute pitch on every track. */
const NOTES: Matcher = { m: "events", pitch: "absolute", rhythm: "onsets", durations: false };
/** Until `key-plan` reads each bar in its key, a wrong note of the lifted bars would be worded in degrees of C. */
const offTarget = (c: string, d: string, count: string) =>
  `Bar {bar}, {beatLabel}: not the target's note. Bars ${c} are in C major, bars ${d} the same numbers in D major. Check the two keys, their octave and the counts after \`!\` (${count}).`;

/** Drums from the Band; chords, bass and tune are in the learner's code, where the rules read them. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const C_MAJOR = { tonic: "C", mode: "major" } as const;

export default defineLesson({
  id: "U17.L02",
  version: 5,
  title: "Truck-Driver & Direct Modulation",
  objective:
    'I can lift a last chorus into a new key: a key plan in .scale("<…>") on every line written in degrees, after arrange(), and new names for the chords.',
  key: C_MAJOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H14"],
  terms: [{ id: "term.direct-modulation", step: "S3" }],
  canDo: ["cd.code.key-lift"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The last chorus",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["form"] },
      example: { id: "hook", code: SONG, bars: 12 },
      exercise: {
        kind: "listen",
        id: "the-last-chorus",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the song: a verse, a chorus, then the chorus again from bar 9. Listen for what the band does to the chorus at bar 9: higher, lower or the same? Then notice what that does to the energy of the song.",
        skills: [{ skill: "H14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: SONG,
            caption: "Verse, chorus, chorus. The last chorus starts at bar 9.",
            bars: 12,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Two keys, one tune",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "two-keys-one-tune",
        version: 1,
        role: "practice",
        prompt:
          "Predict what bars 5 to 8 of the chorus tune play, and pick it. Its `.scale()` holds two keys: `C4:major!4` for bars 1 to 4, then `D4:major!4` for bars 5 to 8. The numbers in `n()` stay the same all through.",
        skills: [{ skill: "H14", w: 1 }],
        hints: null,
        tests: [],
        code: TUNE_ALONE,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "same-tune-higher", label: "The same tune, every note a whole step higher" },
          { id: "new-tune", label: "A different tune: other numbers of the scale" },
          { id: "same-notes", label: "The same notes as bars 1 to 4: only the scale's name changes" },
        ],
        correct: ["same-tune-higher"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Same numbers, new letters",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "chorus-lift", code: CHORUS_LIFT, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "same-numbers-new-letters",
        version: 1,
        role: "practice",
        prompt:
          "Answer two questions about these four bars in C and four in D. First: bar 3 of the chord band is Am; find the chord in bar 7 and pick it. Second: the tune starts bar 1 on G and bar 5 on A; count the half steps from G up to A on the roll and enter the number.",
        skills: [{ skill: "H14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Bar 3 is Am: find the chord four bars later in the chord band. For the count, the tune starts bar 1 on G and bar 5 on A: go from G up to A one key at a time.",
        },
        hints: ladder(
          "From bar 5 on, every line sounds higher by the same distance. Compare one chord name, or one tune note, before and after bar 5.",
          "The chords line spells the lift out: C G Am F, then four new names. Each one is the old name moved up by the same step.",
          "C became D, and G became A. From C up to D is two half steps: C♯, then D.",
        ),
        code: { starter: CHORUS_LIFT },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Bar 3 is Am. Which chord takes its place in bar 7?",
            options: [
              { id: "b-minor", label: "Bm" },
              { id: "b-flat-minor", label: "B♭m" },
              { id: "b-major", label: "B" },
            ],
            correct: ["b-minor"],
          },
          {
            q: "number",
            prompt: "By how many half steps does every note rise at bar 5?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["b-minor"], number: 2 } }, expect: "pass" },
          {
            name: "B♭m: a half step up, not a whole step",
            response: { answer: { choice: ["b-flat-minor"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one: counted in whole steps",
            response: { answer: { choice: ["b-minor"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Lift the tune",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "lift-the-tune",
        version: 1,
        role: "check",
        prompt:
          "The chords and bass lift at bar 5; the tune stays in C and rubs against them. Change the tune's `.scale()` to a key plan shaped like the bass's: C major for bars 1 to 4, then D major for bars 5 to 8, both in octave 4. Done when the tune lifts at bar 5 with the others.",
        skills: [{ skill: "H14", w: 1 }],
        code: { starter: TUNE_STARTER },
        reference: { solutions: [CHORUS_LIFT], bars: 8 },
        matcher: NOTES,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: { "melody.wrong-degree": offTarget("1–4", "5–8", "four and four") },
        hints: ladder(
          "The tune's key lives in its `.scale()`, which names one key for all eight bars. The bass's `.scale()` already names two.",
          "The bass line has a key plan already: two keys inside `< >`, each held for four bars with `!4`. The tune needs the same shape with its own octave, 4.",
          "Start with `<C4:major!4` and put the second key before the `>`: D, the same octave, the same count.",
        ),
        tests: [
          { name: "reference", response: { code: CHORUS_LIFT }, expect: "pass" },
          {
            name: "every bar written out",
            response: {
              code: chorusLoop("<C4:major C4:major C4:major C4:major D4:major D4:major D4:major D4:major>"),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: chorusLoop("C4:major") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "no counts: the key changes every bar",
            response: { code: chorusLoop("<C4:major D4:major>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "a half step: D♭ under chords in D",
            response: { code: chorusLoop("<C4:major!4 Db4:major!4>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the new key an octave too high",
            response: { code: chorusLoop("<C4:major!4 D5:major!4>") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Half step or whole step",
      minutes: 0.75,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "half-step-or-whole-step",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both cards. Each plays two bars of the chorus, then the same two bars lifted. Pick the card that lifts by a half step, the smaller lift.",
        skills: [{ skill: "H14", w: 1 }],
        hints: ladder(
          "Sing the first note of the tune before and after each lift, on each card. The smaller jump is the half step.",
          "One card goes from C to D, the other from C to the black key between them.",
          "The whole step is the lift you just wrote. Which card sounds like it?",
        ),
        stimulus: { src: "code", code: NO_LIFT, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "first", label: "Card 1", audio: WHOLE_STEP },
            { id: "second", label: "Card 2", audio: HALF_STEP },
          ],
        },
        correct: { choice: ["second"] },
        // The catalog's `id.wrong` names the option ids ("That was second, not first").
        feedbackText: {
          "id.wrong":
            "Card 2 is the half step: C to D♭, the smallest lift there is. Card 1 goes a whole step, C to D. Play both again.",
        },
        tests: [
          { name: "card 2", response: { answer: { choice: ["second"] } }, expect: "pass" },
          {
            name: "card 1",
            response: { answer: { choice: ["first"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "After arrange()",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "after-arrange",
        version: 1,
        role: "check",
        prompt:
          "Lift the tune with the chords and bass at bar 9. Delete the `.scale()` from `melVerse` and from `melChorus`. Then write one key plan after the tune's `arrange()`, counted in bars of the whole song: C major for bars 1 to 8, D major for bars 9 to 12, both in octave 4.",
        skills: [{ skill: "H14", w: 1 }],
        code: { starter: SECTIONS_STARTER },
        reference: { solutions: [SONG], bars: 12 },
        matcher: NOTES,
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          {
            c: "must-not-use",
            tool: "tb.transpose",
            why: "after `.scale()` it moves the notes but leaves the key behind. Write the key plan in `.scale()`.",
            feedback: "code.must-not-use",
          },
        ],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: { "melody.wrong-degree": offTarget("1–8", "9–12", "eight and four") },
        hints: ladder(
          "Inside `arrange()` every section starts again from its own first bar, so a plan written in a section never reaches bar 9. The plan for the whole song goes after `arrange()`.",
          "Copy the bass's shape: bare `n()` patterns in its sections, and one `.scale()` after `arrange()`. Verse and first chorus make 8 bars before the last chorus.",
          "Empty the two boxes in the tune's sections. In the box after `arrange(…)`, start `.scale(\"<C4:major!8` and finish it: four bars of D.",
        ),
        tests: [
          { name: "reference", response: { code: SONG }, expect: "pass" },
          {
            name: "verse and first chorus counted apart",
            response: { code: sections({ mel: scale("<C4:major!4 C4:major!4 D4:major!4>") }) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: song({ inVerse: IN_C, inChorus: IN_C, mel: "" }) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "counted like one section: four and four",
            response: { code: sections({ mel: scale("<C4:major!4 D4:major!4>") }) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the plan inside the chorus: it starts again with the section",
            response: {
              code: song({ inVerse: IN_C, inChorus: scale("<C4:major!4 D4:major!4>"), mel: "" }),
            },
            expect: "fail",
            feedback: ["melody.wrong-degree", "code.arranged-scale-pattern"],
          },
          {
            name: "the old .scale() left inside the sections",
            response: {
              code: song({ inVerse: IN_C, inChorus: IN_C, mel: scale("<C4:major!8 D4:major!4>") }),
            },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            // The other legal form of contracts §6.8 (a lifted section with its own key), but not this step's.
            name: "the lifted chorus written into arrange() with its own key: outside the boxes",
            response: {
              code: song({ inVerse: IN_C, inChorus: IN_C, mel: "" }).replace(
                "[4, melChorus], [4, melChorus])",
                `[4, melChorus], [4, n("${CHORUS_TUNE}").scale("D4:major")])`,
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "moved with .transpose() after .scale()",
            response: {
              code: sections({ mel: `${IN_C}.transpose("<0!8 2!4>")` }),
            },
            expect: "fail",
            feedback: ["code.must-not-use", "code.transpose-after-scale"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your last chorus",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["form"] },
      exercise: {
        kind: "code-make",
        id: "your-last-chorus",
        version: 1,
        role: "practice",
        prompt:
          "Lift the last chorus, bars 9 to 12, a whole step to D. Bass and tune: after each `arrange()`, write a key plan of 8 bars of C major, then 4 of D major. Chords: in `chordsChorus2`, move every chord name up a whole step. Done when all three lines lift. The lifted chorus becomes your song's last chorus.",
        skills: [{ skill: "H14", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [12, 24],
        saveAs: "sketch",
        rubric: [
          {
            id: "last-chorus-in-d",
            label: "Bars 9 to 12 are in D major, a whole step up, with the tune and the chords both lifted",
            required: true,
            skills: ["H14"],
            rule: "key-change",
            at: "last",
            semitones: [2],
            minBarsAfter: 4,
          },
          {
            id: "before-it-in-c",
            label: "Bars 1 to 8 use only notes of C major",
            required: false,
            skills: ["H14"],
            rule: "in-key",
            key: C_MAJOR,
            minRatio: 1,
            section: { bars: [1, 8] },
          },
          {
            id: "two-key-plans",
            label: 'Two lines use a key plan in `.scale("<…>")`, such as the bass and the tune',
            required: false,
            skills: ["H14"],
            rule: "uses",
            tool: "tb.scale.patterned",
            min: 2,
          },
          {
            id: "something-new",
            label: "Your code has a fourth line, such as a `pad:`",
            required: false,
            skills: ["F02"],
            rule: "tracks",
            min: 4,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Sort the lines: the bass and the tune are written in numbers and follow a key plan; the chords are written by name and do not. Each kind lifts its own way.",
          "The bass and the tune are numbers: each needs a key plan after its `arrange()`, eight bars of C major and four of D major. The chords are names: in `chordsChorus2`, move each one up a whole step.",
          'C goes up to D, and G to A; Am and F are yours to move. For the bass, write `.scale("<C2:major!8 …>")` and finish it.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: two key plans and four new names",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: five sections, a new chorus tune, Rhodes, strings for the lift",
            response: { code: MAKE_RICH },
            expect: "pass",
          },
          {
            name: "bass and tune lifted, the chord names left in C",
            response: { code: song({ lifted: "C G Am F" }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "chords and bass lifted, the tune left in C",
            response: { code: song({ mel: scale("C4:major") }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the lift with the tune an octave higher and the bass an octave lower",
            response: {
              code: song({ bass: "<C1:major!8 D1:major!4>", mel: scale("<C5:major!8 D5:major!4>") }),
            },
            expect: "pass",
          },
          {
            name: "the whole song in D: the last chorus is in D, but nothing lifts",
            response: { code: NO_LIFT_SONG("D", "d") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one G chord throughout: in both keys at once, and nothing lifts",
            response: { code: NO_LIFT_SONG("G", "g") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the plans counted per section: the first chorus lifts and the last comes back down",
            response: {
              code: song({ bass: "<C2:major!4 D2:major!4>", mel: scale("<C4:major!4 D4:major!4>") }),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
