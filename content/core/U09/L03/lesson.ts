// U09.L03 AABA & Strophic. Two more song forms. AABA: a section that plays twice, a contrasting bridge that
// comes once and moves away from home, then the first section again (the 32-bar song of the standards, four
// eight-bar sections). Strophic: the same music for every verse, AAA (folk songs and hymns). A form is
// named by letters in order of first appearance. What the learner has: section consts and one `arrange()`
// per labelled track, verse and chorus, song form (U09.L02); four-bar phrases (U09.L01); root bass lines
// (U08); chord names and `.voicing()` (U05.L08); half cadences on V (U06.L04). Not yet: the energy curve and
// build-ups (U09.L04), entries by bar with `.mask()` (U09.L05). Spec: content/specs/U09.md.
//
// How it grades: the Play-from-the-page step (S4) is an `events` match on the tune's track over the whole
// sixteen bars, octave-free, against the AABA reference; its target is shown only as a lead sheet. The form
// question (S5) offers letter plans as choices (the planned form strip is described at the step). S6 seeds `fam.frm.sections` at level 1 (AABA or verse–chorus?). The
// Make's one required rule is `form` "AABA": section names come from the identifiers (`chordsA`, `melB`),
// so the song must arrange its A and B consts in that order.
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

/** A on the doo-wop loop I vi IV V (C Am F G); the bridge on IV iii ii V (F Em Dm G), away from home. */
const CHORDS_A = 'const chordsA = chord("<C Am F G>").voicing()';
const CHORDS_B = 'const chordsB = chord("<F Em Dm G>").voicing()';
/** The roots, an octave under the chords. */
const BASS_A = 'const bassA = n("<0 5 3 4>").scale("C2:major")';
const BASS_B = 'const bassB = n("<3 2 1 4>").scale("C2:major")';
/** A's tune: G E G | A E | F A F | D, stopping on 2 over V. */
const MEL_A_TUNE = "<[4 ~ 2 4] [5 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>";
/** The bridge climbs, A A C5 | B G | F A F | G, and stops open on 5 over V so A can come back. */
const MEL_B_TUNE = "<[5 ~ 5 7] [6 ~ 4 ~] [3 ~ 5 3] [4 ~ ~ ~]>";
const MEL_A = `const melA = n("${MEL_A_TUNE}").scale("C4:major")`;
const MEL_B = `const melB = n("${MEL_B_TUNE}").scale("C4:major")`;
const CONSTS = [CHORDS_A, CHORDS_B, BASS_A, BASS_B, MEL_A, MEL_B].join("\n");

/** One `arrange()` for a track: A, A, B, A, four bars each. */
const aaba = (a: string, b: string) => `arrange([4, ${a}], [4, ${a}], [4, ${b}], [4, ${a}])`;
const BASS = `bass: ${aaba("bassA", "bassB")}.s("ebass").lpf(600)`;
const CHORDS = `chords: ${aaba("chordsA", "chordsB")}.s("piano")`;
const MEL = `mel: ${aaba("melA", "melB")}.s("piano")`;
/** The AABA miniature: sixteen bars, the bridge at bar 9, A home at bar 13. */
const SONG = `${TEMPO}${CONSTS}\n\n${[BASS, CHORDS, MEL].join("\n")}`;
/**
 * S4's page: the tune and the chords, arranged A A B A. The bass is left out of the shown example because
 * the notation check engraves every pitched track on the lead staff (C2 is far below it), while the lead
 * sheet itself shows only the melody with the chord symbols; the step's code keeps its bass.
 */
const PAGE = `${TEMPO}${[CHORDS_A, CHORDS_B, MEL_A, MEL_B].join("\n")}\n\n${[CHORDS, MEL].join("\n")}`;

/** S4: chords and bass are arranged AABA; the tune plays A all through. The learner writes its arrange(). */
const MEL_WITH = (mel: string) =>
  `${TEMPO}${CONSTS}\n\n${[BASS, CHORDS, `mel: ${mel}.s("piano")`].join("\n")}`;
const PAGE_STARTER = MEL_WITH("⟪melA⟫");
const PAGE_SOLUTION = MEL_WITH(aaba("melA", "melB"));
const PAGE_MATCH: Matcher = {
  m: "events",
  pitch: "octave-free",
  rhythm: "onsets",
  durations: false,
  tracks: ["mel"],
};

/**
 * S5: a strophic song in three eight-bar sections, the same tune and chords each time and a new lead sound.
 * Tune over C F C G | C F G C: G G A | A F | E G E | D || G G A | A F | G D | C.
 */
const EIGHT = code(
  'const tune = n("<[4 ~ 4 5] [5 ~ 3 ~] [2 ~ 4 2] [1 ~ ~ ~] [4 ~ 4 5] [5 ~ 3 ~] [4 ~ 1 ~] [0 ~ ~ ~]>").scale("C4:major")',
  'const melVerse = tune.s("acgtr")',
  'const melVerse2 = tune.s("rhodes")',
  'const melVerse3 = tune.s("piano")',
  "",
  'kick: s("bd ~ bd ~")',
  'snare: s("~ sd ~ sd")',
  'hats: s("hh*8").gain(.4)',
  'bass: n("<0 3 0 4 0 3 4 0>").scale("C2:major").s("ebass").lpf(600)',
  'chords: chord("<C F C G C F G C>").voicing().s("piano").gain(.6)',
  "mel: arrange([8, melVerse], [8, melVerse2], [8, melVerse3])",
);

/**
 * The Make: A is written and loops on its own. A first bridge is sketched, starting on IV and ending on V;
 * the learner rewrites it and arranges the song A A B A.
 */
const MAKE_CHORDS_B = 'const chordsB = chord("<F F G G>").voicing()';
const MAKE_MEL_B = 'const melB = n("<[5 ~ ~ ~] [3 ~ ~ ~] [4 ~ ~ ~] [1 ~ ~ ~]>").scale("C4:major")';
const MAKE_CONSTS = [CHORDS_A, MEL_A, MAKE_CHORDS_B, MAKE_MEL_B].join("\n");
const MAKE = (...tracks: string[]) => `${TEMPO}${MAKE_CONSTS}\n\n${tracks.join("\n")}`;
const MAKE_STARTER = MAKE('chords: chordsA.s("piano")', 'mel: melA.s("piano")');
/** Minimal: the sketched bridge kept, both parts arranged. */
const MAKE_MINIMAL = MAKE(
  `chords: ${aaba("chordsA", "chordsB")}.s("piano")`,
  `mel: ${aaba("melA", "melB")}.s("piano")`,
);
/** Beyond the brief: the hook's own bridge on F Em Dm G, a bass arranged with it, room on the tune. */
const MAKE_BEYOND = `${TEMPO}${CONSTS}\n\n${[BASS, CHORDS, `mel: ${aaba("melA", "melB")}.s("piano").room(.3)`].join("\n")}`;
/** Wrong: the bridge second, A A at the end (A B A A). */
const MAKE_ABAA = MAKE(
  'chords: arrange([4, chordsA], [4, chordsB], [4, chordsA], [4, chordsA]).s("piano")',
  'mel: arrange([4, melA], [4, melB], [4, melA], [4, melA]).s("piano")',
);

/** Drums from the Band; bass, chords and tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const LEAD = { roll: false, staff: "lead", keyboard: false } as const;

export default defineLesson({
  id: "U09.L03",
  version: 4,
  title: "AABA & Strophic",
  objective:
    "I can name a song's form by ear, verse–chorus, AABA or strophic, and arrange a song A A B A with a bridge of my own.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["F03"],
  practises: [],
  terms: [
    { id: "term.bridge", step: "S3" },
    { id: "term.strophic", step: "S5" },
  ],
  canDo: ["cd.hear.form"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Away and back",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: SONG, bars: 16 },
      exercise: {
        kind: "listen",
        id: "two-more-shapes",
        version: 1,
        role: "practice",
        prompt:
          "Listen for the bar where the song leaves its first music, and the bar where that music comes back. Notice how the return feels.",
        skills: [{ skill: "F03", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: SONG, caption: "Sixteen bars, four sections of four.", bars: 16 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Count the A",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "count-the-a",
        version: 1,
        role: "practice",
        prompt:
          "Predict how many times `melA` plays before the song starts over, then enter the number. The tune's line is `mel: arrange([4, melA], [4, melA], [4, melB], [4, melA])`.",
        skills: [{ skill: "F03", w: 1 }],
        hints: null,
        tests: [],
        code: SONG,
        bars: 16,
        mode: "count",
        correct: 3,
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "The new section",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["form"] },
      example: { id: "the-new-section", code: SONG, bars: 16 },
      exercise: {
        kind: "run-investigate",
        id: "the-new-section",
        version: 1,
        role: "practice",
        prompt:
          "Run the song and watch the roll from bar 9, where `melB` and `chordsB` take over. Answer both questions below: what the third section does, and in which bar A comes back.",
        skills: [{ skill: "F03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Listen from bar 9: which chords play, where does the tune stop at bar 12, and when do you hear the opening again?",
        },
        hints: ladder(
          "Compare bars 9 to 12 with bars 1 to 4. The chords and the tune both change at bar 9.",
          "Read `chordsB`: does it start on the home chord? Then listen to how bar 12 ends.",
          "The third section starts on F and stops on G, waiting. Count four bars after bar 9 starts.",
        ),
        code: { starter: SONG },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What does the third section do?",
            options: [
              { id: "away", label: "New chords away from home, then it stops open, waiting for A" },
              { id: "repeat", label: "It plays A a third time" },
              { id: "ending", label: "It brings the song to a close on the home chord" },
            ],
            correct: ["away"],
          },
          { q: "number", prompt: "In which bar does A come back?", correct: 13 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["away"], number: 13 } }, expect: "pass" },
          {
            name: "the third section heard as an ending",
            response: { answer: { choice: ["ending"], number: 13 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the bridge's own bar",
            response: { answer: { choice: ["away"], number: 9 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      // U09's "Play from the page" (AUTHORING §4): the target is shown only as a lead sheet with its sections
      // marked A A B A, no roll; the learner writes the tune's arrange().
      ui: { panels: LEAD, leadSheet: { melody: "mel", chords: "chords" }, band: DRUMS },
      example: { id: "the-page", code: PAGE, bars: 16 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "Replace the highlighted `melA` with an `arrange()` that follows the page: four sections of four bars, A, A, B, A. Use `melA` for A and `melB` for B. The chords and the bass already follow the page. Done when the tune matches the page in all 16 bars.",
        skills: [{ skill: "F03", w: 1 }],
        code: { starter: PAGE_STARTER },
        reference: { solutions: [PAGE_SOLUTION], bars: 16 },
        matcher: PAGE_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: the tune plays {got}, the page has {exp}. Check the order and the lengths of your sections against the page.",
        },
        hints: ladder(
          "Read the section labels on the page in order. Each one covers four bars.",
          "The chords and bass lines already list four sections. The tune needs the same list, with `melA` and `melB`.",
          "The first two sections are both A: `arrange([4, melA], [4, melA], …`. Two to go.",
        ),
        tests: [
          { name: "reference", response: { code: PAGE_SOLUTION }, expect: "pass" },
          {
            name: "the bridge written out in place of melB",
            response: {
              code: MEL_WITH(
                `arrange([4, melA], [4, melA], [4, n("${MEL_B_TUNE}").scale("C4:major")], [4, melA])`,
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: MEL_WITH("melA") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "A B A A: the bridge one section early",
            response: { code: MEL_WITH("arrange([4, melA], [4, melB], [4, melA], [4, melA])") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the letters swapped: the bridge's tune over A's chords",
            response: { code: MEL_WITH(aaba("melB", "melA")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Name the form",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "name-the-form",
        version: 2,
        role: "check",
        prompt:
          "Listen to a song in three sections of eight bars. Give each section a letter: A for the first music you hear, B for the next new music, and so on. Judge by the tune, not the instrument.",
        skills: [{ skill: "F03", w: 1 }],
        hints: [
          {
            text: "Compare the tune that opens section 2 with the tune that opens section 1. Same tune, or a new one?",
          },
          {
            text: "A letter names the music, not the sound it is played on. Hum the first two bars of each section.",
          },
          {
            text: "Hear it again, slower. Sections 1 and 2 have the same tune on different instruments.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "code", code: EIGHT, bars: 24, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        // The form strip (Wave 5 `form` answer): three slots, one letter each, graded by letters by first
        // appearance (`formLetters`), so A A A and B B B are the same answer.
        answer: { ui: "form", sections: 3, vocabulary: "letters", input: "label", sectionBars: [8, 8, 8] },
        correct: { sections: ["A", "A", "A"] },
        feedbackText: {
          "form.section":
            "Section {slot}: a letter names the tune, not the instrument. Give a section a new letter only when its tune is new.",
        },
        tests: [
          { name: "A A A", response: { answer: { sections: ["A", "A", "A"] } }, expect: "pass" },
          {
            name: "the third section heard as new because the sound changed",
            response: { answer: { sections: ["A", "A", "B"] } },
            expect: "fail",
            feedback: ["form.section"],
          },
          {
            name: "every new sound heard as new music",
            response: { answer: { sections: ["A", "B", "C"] } },
            expect: "fail",
            feedback: ["form.section"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "AABA or verse–chorus?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "aaba-or-verse-chorus",
        version: 1,
        role: "check",
        prompt:
          "Listen to each short song, in a new key each time. Pick AABA if one section plays twice, new music comes once and the first returns. Pick verse and chorus if two sections take turns.",
        skills: [
          { skill: "F03", w: 0.6 },
          { skill: "F02", w: 0.4 },
        ],
        hints: [
          { text: "Count how many times the new music comes: once, or again and again." },
          {
            text: "AABA's new section comes once, after the first section has played twice. In verse and chorus the two take turns: A B A B.",
          },
          {
            text: "Hear it again, slower, and count the sections on your fingers: which ones sound alike?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.frm.sections", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "AABA", label: "AABA: a section twice, a bridge, the section again" },
            { id: "verse-chorus", label: "Verse and chorus, taking turns" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.frm.sections", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Write the bridge",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "write-the-bridge",
        version: 1,
        role: "practice",
        prompt:
          "Rewrite the bridge in `chordsB` and `melB`: start away from home, on F or Am, and end on G so A can come back. Then give the chords and the tune each an `arrange()`: A, A, B, A, four bars each. Done when your code runs A A B A. Your song plays B, then A, after its second chorus.",
        skills: [{ skill: "F03", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [16, 32],
        saveAs: "sketch",
        rubric: [
          {
            id: "aaba",
            label: "The sections play A, A, B, A, in that order",
            required: true,
            skills: ["F03"],
            rule: "form",
            pattern: "AABA",
          },
          {
            id: "ends-open",
            label: "A half cadence on V at bar 12, the end of the bridge",
            required: false,
            skills: ["F03"],
            rule: "cadence",
            types: ["HC"],
            at: { bar: 12 },
          },
          {
            id: "every-part",
            label: "`arrange()` used at least twice, for the chords and the tune",
            required: false,
            skills: ["F03"],
            rule: "uses",
            tool: "tb.arrange",
            min: 2,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "A plays twice before the bridge and once after it.",
          "Each track that changes gets one `arrange()` listing four sections of four bars: A, A, B, A.",
          'For the chords: `arrange([4, chordsA], [4, chordsA], [4, chordsB], [4, chordsA]).s("piano")`. The tune needs the same plan.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the sketched bridge, arranged",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: a new bridge on F Em Dm G, a bass, room on the tune",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "A B A A: the bridge too early",
            response: { code: MAKE_ABAA },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
