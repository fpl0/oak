// A2.L02 Texture & Density (spec: content/specs/A2.md). How many parts play at once is the texture; how many
// notes sound in a bar is the density. A thin section leaves room, and the thick one after it lands: arrangers
// thin a verse and fill a chorus without changing a note of the tune.
//
// Written for the learner at the gate (AUTHORING §20.1): A2 opens after U10.CP and A1.L07, so the tools are the
// A2 loop's (minor, degree stacks, `arrange()` from U09) and nothing of U11 onward. The loop is the A2 loop in
// A minor at 90 BPM (Am F C G) over `band.aeolian-4bar`'s drums; sections are U09's section consts with one
// `arrange()` per track, and a part that rests in a section plays `silence` (STYLE §10).
//
// The corrections-pass standard (AUTHORING §20.2) on S5 and the Make: both are graded by `contrast` on the
// `density` axis, which counts the notes heard per bar in each section (every chord note counted, a part masked
// more than 24 dB down sounds none), so a quieter section is not a thinner one. Each pins wrong answers that use
// the right function (the verse turned down; one rest a bar; only the held pad left out; both sections thinned
// alike; a chorus part filled in but turned down to nothing) and passes three other right answers.
//
// Departures from the spec, each for a reason (apiNotes): the section consts are named `…Verse`/`…Chorus` (the
// grader finds sections by those names; the spec's `chordsThin` would be no section); the pad sits above the tune
// (A5), so it never doubles the tune's notes in its own register, as A2.L01 just taught; the Make starts from the
// thin arrangement in both sections, so S5 thins and the Make fills (the can-do is "thin it out and fill it back up").
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 90;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The A2 tune: E C A | C A | E C E | B G (every note on a beat is in its chord). */
const TUNE =
  'mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("A4:minor").s("square").lpf(2000).gain(.5)';

/** The roots of Am F C G, once a bar / eight times a bar. */
const BASS_ONE = 'note("<a1 f1 c2 g1>")';
const BASS_EIGHT = 'note("<a1*8 f1*8 c2*8 g1*8>")';
/** Am F C G as two-note stacks (root and 3rd), held for the bar. */
const CHORDS_TWO = 'n("<[0,2] [-2,0] [-5,-3] [-1,1]>")';
/** Am F C G as close triads, held for the bar / four times a bar. */
const CHORDS_HELD = 'n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")';
const CHORDS_FOUR = 'n("<[0,2,4]*4 [-2,0,2]*4 [-5,-3,-1]*4 [-1,1,3]*4>")';
/** A strings pad above the tune: A5 E6 | F5 C6 | G5 C6 | B5 D6, two notes of each chord, held. */
const PAD = 'n("<[0,4] [-2,2] [-1,2] [1,3]>")';

/** Eight bars: one const per section and track (STYLE §10), one `arrange()` per track, the tune throughout. */
const song = (
  v: { bass: string; chords: string; pad: string },
  c: { bass: string; chords: string; pad: string },
) =>
  code(
    `const bassVerse = ${v.bass}`,
    `const chordsVerse = ${v.chords}`,
    `const padVerse = ${v.pad}`,
    `const bassChorus = ${c.bass}`,
    `const chordsChorus = ${c.chords}`,
    `const padChorus = ${c.pad}`,
    "",
    'bass: arrange([4, bassVerse], [4, bassChorus]).s("sawtooth").lpf(400)',
    'chords: arrange([4, chordsVerse], [4, chordsChorus]).scale("A3:minor").s("piano").gain(.6)',
    'pad: arrange([4, padVerse], [4, padChorus]).scale("A5:minor").s("strings").gain(.25)',
    TUNE,
  );
const THIN = { bass: BASS_ONE, chords: CHORDS_TWO, pad: "silence" };
const THICK = { bass: BASS_EIGHT, chords: CHORDS_FOUR, pad: PAD };

/** The hook: a thin verse, a thick chorus, the same tune over both. */
const HOOK = song(THIN, THICK);

/** S2: the same bar twice, thin and then thick, at the same tempo. */
const ONE_BAR_TWICE = code(
  'bass: note("<a1 a1*8>").s("sawtooth").lpf(400)',
  'chords: n("<[0,2] [0,2,4]*4>").scale("A3:minor").s("piano").gain(.6)',
  'pad: n("<~ [0,4]>").scale("A5:minor").s("strings").gain(.25)',
  'mel: n("[4 ~ 2 0]").scale("A4:minor").s("square").lpf(2000).gain(.5)',
);

/** S4: one bar of A minor, two ways. Card A is louder; card B has more notes. */
const CARD_HELD = code('chords: n("[0,2]").scale("A3:minor").s("piano").gain(.8)');
const CARD_FULL = code('chords: n("[0,2,4,7]*4").scale("A3:minor").s("piano").gain(.25)');

/** S5: verse and chorus the same thick section; the verse's three consts are the region to change. */
const FULL_STARTER = code(
  `const bassVerse = ⟪${BASS_EIGHT}`,
  `const chordsVerse = ${CHORDS_FOUR}`,
  `const padVerse = ${PAD}⟫`,
  `const bassChorus = ${BASS_EIGHT}`,
  `const chordsChorus = ${CHORDS_FOUR}`,
  `const padChorus = ${PAD}`,
  "",
  'bass: arrange([4, bassVerse], [4, bassChorus]).s("sawtooth").lpf(400)',
  'chords: arrange([4, chordsVerse], [4, chordsChorus]).scale("A3:minor").s("piano").gain(.6)',
  'pad: arrange([4, padVerse], [4, padChorus]).scale("A5:minor").s("strings").gain(.25)',
  TUNE,
);
const FULL = song(THICK, THICK);
const verseWith = (v: Partial<typeof THICK>) => song({ ...THICK, ...v }, THICK);

/** S6: the loop full for four bars, then the same parts playing fewer notes. */
const FEWER_NOTES = code(
  `const bassA = ${BASS_EIGHT}`,
  `const chordsA = ${CHORDS_FOUR}`,
  `const bassB = ${BASS_ONE}`,
  `const chordsB = ${CHORDS_HELD}`,
  "",
  'bass: arrange([4, bassA], [4, bassB]).s("sawtooth").lpf(400)',
  'chords: arrange([4, chordsA], [4, chordsB]).scale("A3:minor").s("piano").gain(.6)',
  TUNE,
);

/** The Make: the thin arrangement in both sections; fill one so it lands (or thin the other further). */
const MAKE_STARTER = song(THIN, THIN);
const chorusWith = (c: Partial<typeof THIN>) => song(THIN, { ...THIN, ...c });

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.aeolian-4bar", tracks: ["drums"] } as const;

/** Verse against chorus, counted in notes per bar: they differ by a quarter or more. */
const thinAgainstThick = (label: string): RubricRule => ({
  id: "verse-against-chorus",
  label,
  required: true,
  skills: ["D09", "F05"],
  rule: "contrast",
  a: { section: "verse" },
  b: { section: "chorus" },
  axes: ["density"],
  minAxes: 1,
});

export default defineLesson({
  id: "A2.L02",
  version: 4,
  title: "Texture & Density",
  objective: "I can thin a section out and fill another, so the full one lands.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D09"],
  practises: ["F05"],
  terms: [
    { id: "term.texture", step: "S3" },
    { id: "term.density", step: "S4" },
  ],
  canDo: ["cd.compose.texture"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Thin, then thick",
      minutes: 0.5,
      ui: { panels: ROLL, band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "thin-then-thick",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the parts around the tune, which stays the same all eight bars. Listen for what you hear more of when the chorus starts at bar 5.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "A verse with room in it, then a chorus that fills every beat.", bars: 8 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Bigger or faster?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "bigger-or-faster",
        version: 1,
        role: "practice",
        prompt:
          "One bar of A minor plays twice. In bar 2 the bass plays eight notes instead of one, the chords strike four times, and a strings pad comes in, at the same tempo. Predict how bar 2 will sound next to bar 1. Pick your answer, then listen.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        code: ONE_BAR_TWICE,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "bigger", label: "Bigger and fuller" },
          { id: "faster", label: "Faster" },
          { id: "higher", label: "Higher: the whole loop moves up" },
        ],
        correct: ["bigger"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "What the chorus adds",
      minutes: 1,
      ui: { panels: ROLL, initialPanels: ["form"] },
      example: { id: "verse-and-chorus", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "what-the-chorus-adds",
        version: 1,
        role: "practice",
        prompt:
          "Play the eight bars and watch the form map (the two sections) and the roll (every note). Answer two questions: how many parts play in the chorus, counting the tune, and what changed between the verse and the chorus.",
        skills: [{ skill: "D09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the labelled lines that play in bars 5 to 8, and compare the roll's notes in a verse bar with a chorus bar. The tune and the tempo stay where they were.",
        },
        hints: ladder(
          "Compare bars 5 to 8 with bars 1 to 4, one labelled line at a time. Which lines start playing, and which play more often?",
          "Each labelled line is one part. A line that waits through the verse is `silence` there.",
          "A line whose verse is `silence` waits for the chorus. Count every line that plays in bars 5 to 8, the tune included.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many parts play in the chorus?", correct: 4 },
          {
            q: "choice",
            prompt: "What changed between the verse and the chorus?",
            options: [
              { id: "more", label: "More parts, and more notes in each bar" },
              { id: "tempo", label: "A faster tempo" },
              { id: "key", label: "A new key" },
            ],
            correct: ["more"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["more"], number: 4 } }, expect: "pass" },
          {
            name: "the chorus heard as faster",
            response: { answer: { choice: ["tempo"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the verse's parts counted",
            response: { answer: { choice: ["more"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "compare",
      title: "Louder or fuller?",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "louder-or-fuller",
        version: 1,
        role: "practice",
        prompt:
          "Listen to card A and card B: one bar of A minor, played two ways. Pick the card that fills the bar with more notes, whatever its loudness.",
        skills: [{ skill: "D09", w: 1 }],
        hints: ladder(
          "Ignore how loud each card is and listen for how many notes it plays. Which one plays more?",
          "Count the times the piano starts a sound in each card, and how many notes sound each time.",
          "One card strikes once and lets it ring. The other strikes on every beat.",
        ),
        stimulus: { src: "code", code: CARD_HELD, bars: 1, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "held", label: "Card A", audio: CARD_HELD },
            { id: "full", label: "Card B", audio: CARD_FULL },
          ],
        },
        correct: { choice: ["full"] },
        feedbackText: {
          "id.wrong":
            "Not this one. Card A is the louder of the two, but it plays two notes once and lets them ring. Listen again for how often the piano starts a sound.",
        },
        tests: [
          { name: "the fuller card", response: { answer: { choice: ["full"] } }, expect: "pass" },
          {
            name: "the louder card",
            response: { answer: { choice: ["held"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Thin the verse",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, band: DRUMS, initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "thin-the-verse",
        version: 1,
        role: "check",
        prompt:
          "The verse plays exactly what the chorus plays. Thin the verse: change its three consts, `bassVerse`, `chordsVerse` and `padVerse`, so it plays far fewer notes in each bar. Turning parts down does not count. Leave the chorus consts and the tune as they are.",
        skills: [
          { skill: "D09", w: 0.7 },
          { skill: "F05", w: 0.3 },
        ],
        code: { starter: FULL_STARTER },
        reference: { solutions: [HOOK], bars: 8 },
        matcher: {
          m: "rubric",
          rules: [thinAgainstThick("Verse and chorus at least a quarter apart in notes heard per bar")],
        },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet":
            "Not met yet: {label}. Count the notes in one bar of each section: the verse still plays nearly as many as the chorus. Give the verse parts fewer notes, not less volume.",
        },
        hints: ladder(
          "Look at the three verse consts and find the part that strikes most often. Which ones could play less, or wait for the chorus?",
          "Each verse const is one part's whole verse. A pattern with fewer steps, or fewer notes in a stack, plays fewer notes; `silence` plays none.",
          "Start with the part that strikes most often in the verse, and give it fewer strikes a bar.",
        ),
        tests: [
          { name: "reference", response: { code: HOOK }, expect: "pass" },
          {
            name: "only the chords held once a bar",
            response: { code: verseWith({ chords: CHORDS_HELD }) },
            expect: "pass",
          },
          {
            name: "only the bass, once a bar on the one",
            response: { code: verseWith({ bass: BASS_ONE }) },
            expect: "pass",
          },
          {
            name: "the chords left out of the verse",
            response: { code: verseWith({ chords: "silence" }) },
            expect: "pass",
          },
          {
            name: "the chorus made thicker instead: its chords eight times a bar",
            response: {
              code: song(THICK, {
                ...THICK,
                chords: 'n("<[0,2,4]*8 [-2,0,2]*8 [-5,-3,-1]*8 [-1,1,3]*8>")',
              }),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: FULL },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the verse turned down instead of thinned",
            response: {
              code: FULL.replace('.s("piano").gain(.6)', '.s("piano").gain("<.2!4 .6!4>")').replace(
                '.s("sawtooth").lpf(400)',
                '.s("sawtooth").lpf(400).gain("<.4!4 1!4>")',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one rest a bar in the verse's bass: barely thinner",
            response: {
              code: verseWith({ bass: 'note("<[a1*7 ~] [f1*7 ~] [c2*7 ~] [g1*7 ~]>")' }),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right move, too small: only the held pad left out",
            response: { code: verseWith({ pad: "silence" }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right moves in both sections: verse and chorus thinned alike",
            response: { code: song(THIN, THIN) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Thinner how?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "thinner-how",
        version: 1,
        role: "check",
        prompt:
          "Listen to the loop twice; the second time it is thinner. Pick how it got thinner: a part dropped out, or the same parts played fewer notes.",
        skills: [{ skill: "D09", w: 1 }],
        hints: [
          {
            text: "In the second half, follow one part at a time and check that each one is still there. Is any missing?",
          },
          { text: "Listen to the bottom of the sound first, then to the piano in the middle." },
          {
            text: "Hear it again, slower, and count the bass notes in one bar of each half.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "code", code: FEWER_NOTES, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "fewer-parts", label: "A part dropped out" },
            { id: "fewer-notes", label: "The same parts played fewer notes" },
          ],
        },
        correct: { choice: ["fewer-notes"] },
        feedbackText: {
          "id.wrong":
            "Not this one. Every part was still there in the second half, the bass, the piano and the tune: listen to how often each one starts a note.",
        },
        srs: [{ family: "fam.snd.roles", mode: "review-if-due" }],
        tests: [
          { name: "fewer notes", response: { answer: { choice: ["fewer-notes"] } }, expect: "pass" },
          {
            name: "fewer parts",
            response: { answer: { choice: ["fewer-parts"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Let the chorus land",
      minutes: 2.75,
      ui: { panels: ROLL, band: DRUMS, initialPanels: ["form"] },
      exercise: {
        kind: "code-make",
        id: "let-the-chorus-land",
        version: 1,
        role: "practice",
        prompt:
          "Eight bars: a verse and a chorus, both thin. Your chorus plays your song's first chorus. Make it land: give the chorus consts more notes per bar, or a part that plays only there. Keep the tune as it is. Done when the verse and the chorus clearly differ in how many notes play per bar.",
        skills: [
          { skill: "D09", w: 0.7 },
          { skill: "F05", w: 0.3 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          thinAgainstThick("Verse and chorus at least a quarter apart in notes heard per bar"),
          {
            id: "a-part-enters",
            label:
              "A part silent for a whole bar or more that plays elsewhere, such as one that waits for the chorus",
            required: false,
            skills: ["D09"],
            rule: "custom",
            fn: "parts-enter",
            params: { min: 1 },
          },
          {
            id: "the-tune-kept",
            label: "The tune (`mel`) the same as in the starter",
            required: false,
            skills: ["F05"],
            rule: "matches",
            min: 0.9,
            reference: { solutions: [MAKE_STARTER], bars: 8 },
            matcher: {
              m: "melody",
              pitch: "key-relative",
              wPitch: 0.8,
              wRhythm: 0.2,
              rhythmTol: [1, 16],
              track: "mel",
            },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Decide which section should feel bigger, then look at its consts. What could it play that the other section does not?",
          "The chorus consts decide the chorus. More steps in a pattern, more notes in a stack or a part that only plays there all add notes; louder adds none.",
          "Pick one chorus part and give it more strikes in every bar; the bass is a good place to start.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the chorus's bass in eighths",
            response: { code: chorusWith({ bass: BASS_EIGHT }) },
            expect: "pass",
          },
          {
            name: "the chords four times a bar in the chorus",
            response: { code: chorusWith({ chords: CHORDS_FOUR }) },
            expect: "pass",
          },
          {
            name: "the verse thinned further instead: its chords left out",
            response: { code: song({ ...THIN, chords: "silence" }, THIN) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the full chorus with the pad, room on the piano, the tune on a triangle",
            response: {
              code: HOOK.replace('.s("piano").gain(.6)', '.s("piano").gain(.6).room(.3)').replace(
                '.s("square").lpf(2000).gain(.5)',
                '.s("triangle").gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the chorus only louder",
            response: {
              code: MAKE_STARTER.replace('.s("piano").gain(.6)', '.s("piano").gain("<.4!4 .9!4>")'),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one more bass note a bar in the chorus: barely fuller",
            response: { code: chorusWith({ bass: 'note("<[a1 a1] [f1 f1] [c2 c2] [g1 g1]>")' }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right moves in both sections: verse and chorus filled alike",
            response: { code: song(THICK, THICK) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chorus filled with a part turned down until it is not heard",
            response: {
              code: chorusWith({ pad: 'n("<[0,2,4]*8 [-2,0,2]*8 [-1,2,4]*8 [1,3,5]*8>")' }).replace(
                '.s("strings").gain(.25)',
                '.s("strings").gain(.004)',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
