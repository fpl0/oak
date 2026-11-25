// U09.L06 Endings (Oak 2.0 W2; DeSantis, *Making Music*, "Three Ways to End" and "Short Loops as Endings"). A song
// ends on purpose: its parts leave one at a time in the reverse order they came in, a loop of the closing phrase gets
// shorter as it repeats, a loop fades away, or the music lands on a cadence or one last hit and stops. What the
// learner has: sections with one `arrange()` per track (U09.L02), `.mask()` by bar (U09.L05), a signal drawn with
// `saw.range(…).slow(4)` (U09.L04), `< >` one item a bar, `*` and `[ ]` (U01), V to I (U05). Not yet: `.early`
// and `.late` (U13.L01). Spec: content/specs/U09.md.
//
// How it is graded (PLAN §5, §6 F1): `ends-on-purpose` reads the last section. S4 asks for `exit-order` (at least two
// parts stop inside it for good, never a part that came in earlier leaving before one that came in later), S5 for
// `shrinking-tail` (the section loops a piece of the closing phrase heard before it, and the loop gets shorter at
// least once: one shortening is enough, Oak's call written in the rule, never a rule of music). The Make's one
// required rule is `ends-on-purpose` in any of its modes. Every piece carries its own drums and the Make plays with
// no Band (`band: false`): an ending is heard in the silence after it, which a Band playing on would fill (AUTHORING
// §8 rule 8). Fidelity pins (a loop that just stops, a hit on a bar heard before, a loop played faster): content/
// validate/pins/U09.L06.ts.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const song = (consts: string[], tracks: string[]) => `${TEMPO}${consts.join("\n")}\n\n${tracks.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// ---- The song every step ends: the verse of Arranging in Code, and a closing phrase that lands on C --------------

/** The doo-wop loop, I vi IV V (C Am F G); its roots an octave down; the tune of Arranging in Code. */
const LOOP = 'chord("<C Am F G>").voicing()';
const ROOTS = 'n("<0 5 3 4>").scale("C2:major")';
const MEL_VERSE = 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")';
/** The closing phrase, IV V I I (F G C C): A F | B G | C5 G E | C. */
const CLOSE_CHORDS = 'chord("<F G C C>").voicing()';
const CLOSE_ROOTS = 'n("<3 4 0 0>").scale("C2:major")';
const CLOSE_MEL = 'n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] [0 ~ ~ ~]>").scale("C4:major")';
/** Kick on 1 and 3, snare on 2 and 4, softer hats between: one drum line. Levels live in the consts, so a fade
 * written on an outro const (`.gain(saw…)`) is not overridden by a level after `arrange()`. */
const DRUM_LEVELS = '.gain("[.8 .4]*4")';
const BEAT = `s("bd hh sd hh bd hh sd hh")${DRUM_LEVELS}`;
/** The drums' last bar: one kick, then silence. */
const LAST_KICK = `s("<[bd hh sd hh bd hh sd hh]!3 [bd ~ ~ ~]>")${DRUM_LEVELS}`;

const mask = (m: string) => (m ? `.mask("${m}")` : "");
/** Intro, verse and outro (12 bars), each track arranged; masks say where each part plays in the intro and outro. */
const twelve = (o: {
  chordsIntro: string;
  bassIntro: string;
  melIntro: string;
  chordsOut?: string;
  bassOut?: string;
  melOut?: string;
  drumsOutro?: string;
}) =>
  song(
    [
      `const chordsIntro = ${LOOP}${mask(o.chordsIntro)}`,
      `const chordsVerse = ${LOOP}`,
      `const chordsOutro = ${CLOSE_CHORDS}${o.chordsOut ?? ""}`,
      `const bassIntro = ${ROOTS}${mask(o.bassIntro)}`,
      `const bassVerse = ${ROOTS}`,
      `const bassOutro = ${CLOSE_ROOTS}${o.bassOut ?? ""}`,
      `const melIntro = ${o.melIntro}`,
      `const melVerse = ${MEL_VERSE}`,
      `const melOutro = ${CLOSE_MEL}${o.melOut ?? ""}`,
      `const drumsIntro = ${BEAT}`,
      `const drumsVerse = ${BEAT}`,
      `const drumsOutro = ${o.drumsOutro ?? LAST_KICK}`,
    ],
    [
      "drums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsOutro])",
      'bass: arrange([4, bassIntro], [4, bassVerse], [4, bassOutro]).s("ebass").lpf(600)',
      'chords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsOutro]).s("piano")',
      'mel: arrange([4, melIntro], [4, melVerse], [4, melOutro]).s("piano")',
    ],
  );

/**
 * The hook: the intro of Arranging in Code (drums, then the bass at bar 2, the chords at bar 3, the tune's lead-in at
 * the end of bar 4), the verse, and an outro where the parts leave in the reverse order: the tune after bar 9, the
 * chords after bar 10, the bass after bar 11, and the drums end on one kick in bar 12.
 */
const HOOK = twelve({
  chordsIntro: "<0 0 1 1>",
  bassIntro: "<0 1 1 1>",
  melIntro: 'n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
  melOut: mask("<1 0 0 0>"),
  chordsOut: mask("<1 1 0 0>"),
  bassOut: mask("<1 1 1 0>"),
});

/** S4: chords and drums from bar 1, the bass at bar 2, the tune at bar 3; in the outro every part plays to the end. */
const S4_INTRO = {
  chordsIntro: "",
  bassIntro: "<0 1 1 1>",
  melIntro: 'n("<~ ~ [7 ~ 4 2] [0 ~ 2 ~]>").scale("C4:major")',
};
const s4 = (melOut: string, bassOut: string, chordsOut: string) =>
  twelve({ ...S4_INTRO, melOut, bassOut, chordsOut });
const S4_STARTER = s4("⟪⟫", "⟪⟫", "⟪⟫");
const S4_SOLUTION = s4(mask("<1 0 0 0>"), mask("<1 1 0 0>"), mask("<1 1 1 0>"));

// ---- The shrinking loop (S1 card, S5): IV V I I, the last bar a figure on C over a C on every beat ----------------

/** The closing figure, G E D C over C: the last bar of the phrase, and the loop the outro shrinks. */
const FIGURE = "[4 2 1 0]";
const shrink = (melOutro: string) =>
  song(
    [
      'const chordsVerse = chord("<F G C C>").voicing().struct("x x x x")',
      'const chordsOutro = chord("C").voicing().struct("x x x x")',
      `const melVerse = n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] ${FIGURE}>")`,
      `const melOutro = n("${melOutro}")`,
    ],
    [
      'hats: s("hh*8").gain(.4)',
      'chords: arrange([4, chordsVerse], [4, chordsOutro]).s("piano").gain(.7)',
      'mel: arrange([4, melVerse], [4, melOutro]).scale("C4:major").s("piano")',
    ],
  );
/** The figure twice, its second half twice, its last beat four times. */
const SHRUNK = `<${FIGURE} ${FIGURE} [1 0 1 0] [0 0 0 0]>`;
const SHRINKING = shrink(SHRUNK);
const S5_STARTER = shrink(`⟪${FIGURE}⟫`);

// ---- V to I and one last hit (S1 card) ---------------------------------------------------------------------------

const LANDING = song(
  [
    `const chordsVerse = ${LOOP}`,
    'const chordsOutro = chord("<F G G [C ~ ~ ~]>").voicing()',
    `const bassVerse = ${ROOTS}`,
    'const bassOutro = n("<3 4 4 [0 ~ ~ ~]>").scale("C2:major")',
    `const melVerse = ${MEL_VERSE}`,
    'const melOutro = n("<[5 ~ 3 ~] [6 ~ 4 ~] [8 ~ 6 4] [7 ~ ~ ~]>").scale("C4:major")',
    `const drumsVerse = ${BEAT}`,
    `const drumsOutro = s("<[bd hh sd hh bd hh sd hh]!2 [bd hh sd hh sd sd sd sd] [[bd,cr] ~ ~ ~]>")${DRUM_LEVELS}`,
  ],
  [
    "drums: arrange([4, drumsVerse], [4, drumsOutro])",
    'bass: arrange([4, bassVerse], [4, bassOutro]).s("ebass").lpf(600)',
    'chords: arrange([4, chordsVerse], [4, chordsOutro]).s("piano")',
    'mel: arrange([4, melVerse], [4, melOutro]).s("piano")',
  ],
);

// ---- Fades (S6) ----------------------------------------------------------------------------------------------------

/** Over four bars the outro's level falls from .8 to nothing. */
const FADE = ".gain(saw.range(.8, 0).slow(4))";
const fade = (chordsOutro: string, melOutro: string) =>
  song(
    [
      'const chordsVerse = chord("<F G C C>").voicing()',
      `const chordsOutro = ${chordsOutro}${FADE}`,
      'const melVerse = n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] [4 2 1 0]>").scale("C4:major")',
      `const melOutro = ${melOutro}${FADE}`,
      'const hatsVerse = s("hh*8").gain(.4)',
      'const hatsOutro = s("hh*8").gain(saw.range(.4, 0).slow(4))',
    ],
    [
      "hats: arrange([4, hatsVerse], [4, hatsOutro])",
      'chords: arrange([4, chordsVerse], [4, chordsOutro]).s("piano")',
      'mel: arrange([4, melVerse], [4, melOutro]).s("piano")',
    ],
  );
/** A: the phrase's last bar loops while it fades. */
const FADE_LOOP = fade('chord("C").voicing()', 'n("[4 2 1 0]").scale("C4:major")');
/** B: new chords and a new tune every bar while the level falls. */
const FADE_NEW = fade(
  'chord("<Am Em F G>").voicing()',
  'n("<[2 ~ 0 ~] [4 ~ 1 ~] [5 3 ~ 0] [6 4 ~ 1]>").scale("C4:major")',
);

// ---- The Make: intro, verse and an eight-bar outro that is the verse twice -----------------------------------------

/** The Make's tracks: intro and verse as in the hook, and an eight-bar outro. */
const MAKE_TRACKS = [
  "drums: arrange([4, drumsIntro], [4, drumsVerse], [8, drumsOutro])",
  'chords: arrange([4, chordsIntro], [4, chordsVerse], [8, chordsOutro]).s("piano")',
  'bass: arrange([4, bassIntro], [4, bassVerse], [8, bassOutro]).s("ebass").lpf(600)',
  'mel: arrange([4, melIntro], [4, melVerse], [8, melOutro]).s("piano")',
];
const makeSong = (outro: { chords: string; bass: string; mel: string; drums: string }) =>
  song(
    [
      `const chordsIntro = ${LOOP}.mask("<0 0 1 1>")`,
      `const chordsVerse = ${LOOP}`,
      `const chordsOutro = ${outro.chords}`,
      `const bassIntro = ${ROOTS}.mask("<0 1 1 1>")`,
      `const bassVerse = ${ROOTS}`,
      `const bassOutro = ${outro.bass}`,
      'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
      `const melVerse = ${MEL_VERSE}`,
      `const melOutro = ${outro.mel}`,
      `const drumsIntro = ${BEAT}`,
      `const drumsVerse = ${BEAT}`,
      `const drumsOutro = ${outro.drums}`,
    ],
    MAKE_TRACKS,
  );
/** The starter: the outro plays the verse twice, every part to the last beat. */
const MAKE_STARTER = makeSong({ chords: LOOP, bass: ROOTS, mel: MEL_VERSE, drums: BEAT });
/** Minimal: the parts leave in turn, tune after outro bar 4, chords after 5, bass after 6, drums end on one kick. */
const MAKE_EXITS = makeSong({
  chords: `${LOOP}.mask("<1!5 0!3>")`,
  bass: `${ROOTS}.mask("<1!6 0!2>")`,
  mel: `${MEL_VERSE}.mask("<1!4 0!4>")`,
  drums: `s("<[bd hh sd hh bd hh sd hh]!7 [bd ~ ~ ~]>")${DRUM_LEVELS}`,
});
/** Beyond the brief: the verse once more, then the closing phrase lands V to I on a new last bar, one hit and a crash. */
const MAKE_CADENCE = makeSong({
  chords: 'chord("<C Am F G F G G [C ~ ~ ~]>").voicing()',
  bass: 'n("<0 5 3 4 3 4 4 [0 ~ ~ ~]>").scale("C2:major")',
  mel: 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~] [5 ~ 3 ~] [6 ~ 4 ~] [8 ~ 6 4] [7 ~ ~ ~]>").scale("C4:major")',
  drums: `s("<[bd hh sd hh bd hh sd hh]!6 [bd hh sd hh sd sd sd sd] [[bd,cr] ~ ~ ~]>")${DRUM_LEVELS}`,
});
/** The verse twice, every part fading out over the eight bars. */
// Down to .1: W2 chose it because a fade to silence lost its last notes under the 24 dB floor and failed `fades-out`.
// Since W5 the rule reads a fade to silence too (the S7 pin with `saw.range(1, 0)`, W5.md); the piece keeps .1.
const FADE8 = ".gain(saw.range(1, .1).slow(8))";
const MAKE_FADE = makeSong({
  chords: `${LOOP}${FADE8}`,
  bass: `${ROOTS}${FADE8}`,
  mel: `${MEL_VERSE}${FADE8}`,
  drums: `${BEAT}${FADE8}`,
});
/** Everything stops at the same moment, after outro bar 6: no part leaves before another. */
const MAKE_ALL_AT_ONCE = makeSong({
  chords: `${LOOP}.mask("<1!6 0!2>")`,
  bass: `${ROOTS}.mask("<1!6 0!2>")`,
  mel: `${MEL_VERSE}.mask("<1!6 0!2>")`,
  drums: `${BEAT}.mask("<1!6 0!2>")`,
});

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

const ENDS = (modes: string[] | undefined, label: string, required: boolean): RubricRule => ({
  id: "ends-on-purpose",
  label,
  required,
  skills: ["F06"],
  rule: "custom",
  fn: "ends-on-purpose",
  params: modes ? { modes } : {},
});

export default defineLesson({
  id: "U09.L06",
  version: 1,
  title: "Endings",
  objective:
    "I can end a song on purpose: parts that leave in turn, a loop that shrinks, a fade, or a last chord or hit.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["F06", "F05"],
  terms: [
    { id: "term.outro", step: "S4" },
    { id: "term.fade-out", step: "S6" },
  ],
  canDo: ["cd.compose.ending"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three ways out",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "hook", code: HOOK, bars: 12 },
      exercise: {
        kind: "listen",
        id: "three-ways-out",
        version: 1,
        role: "practice",
        prompt:
          "Listen to three endings of songs built on the same chords. Listen for what tells you, in each one, that the song is over.",
        skills: [{ skill: "F06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "The parts come in one by one, and leave one by one.", bars: 12 },
          { code: SHRINKING, caption: "The last bar comes round again, shorter each time.", bars: 8 },
          { code: LANDING, caption: "A drum fill, then one last chord and a crash.", bars: 8 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Who goes first",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "who-goes-first",
        version: 1,
        role: "practice",
        prompt:
          "Read the masks on `melOutro`, `chordsOutro` and `bassOutro`. Predict which part stops first in the last four bars, then pick it. A 0 in a mask silences that part for that bar.",
        skills: [{ skill: "F06", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 12,
        mode: "choose",
        choices: [
          { id: "mel", label: "The tune" },
          { id: "chords", label: "The chords" },
          { id: "bass", label: "The bass" },
        ],
        correct: ["mel"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "The way out",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      example: { id: "the-way-out", code: HOOK, bars: 12 },
      exercise: {
        kind: "run-investigate",
        id: "the-way-out",
        version: 1,
        role: "practice",
        prompt:
          "Run the song and watch bars 9 to 12 on the roll. Answer both questions below: which part plays the last bar on its own, and the number of the last bar the bass plays in.",
        skills: [{ skill: "F06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. On the roll, find the last bar where each line still has notes. Count the bars from the start of the song.",
        },
        hints: ladder(
          "Look at the end of the roll first, then move left until you find each line's last note.",
          "Read `bassOutro`'s mask: one 0 or 1 for each of the last four bars, which start at bar 9.",
          "The bass's mask has three 1s, so it plays the first three of those bars. Count from bar 9.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which part plays the last bar on its own?",
            options: [
              { id: "drums", label: "The drums" },
              { id: "bass", label: "The bass" },
              { id: "mel", label: "The tune" },
            ],
            correct: ["drums"],
          },
          { q: "number", prompt: "In which bar does the bass play for the last time?", correct: 11 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["drums"], number: 11 } }, expect: "pass" },
          {
            name: "the bass last",
            response: { answer: { choice: ["bass"], number: 11 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the first bar without the bass",
            response: { answer: { choice: ["drums"], number: 12 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Leave in turn",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "leave-in-turn",
        version: 1,
        role: "check",
        prompt:
          "In the intro the chords come in first, then the bass, then the tune. In the last four bars, make them leave in the reverse order, tune first: add a `.mask()` in each highlighted place. Done when they stop in at least two different bars before the last one, and none stops before a part that came in after it.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 12 },
        matcher: {
          m: "rubric",
          rules: [
            ENDS(
              ["exit-order"],
              "In the last section parts stop before the end in at least two different bars, and none stops before a part that came in after it",
              true,
            ),
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Find the bar where each part comes in during the intro. The last four bars turn that order round.",
          "`melOutro`, `bassOutro` and `chordsOutro` each need a `.mask()` with four items, one per bar. The part that came in last needs the most 0s.",
          'The tune came in last, so it leaves first: `.mask("<1 0 0 0>")`. The bass and the chords each play one bar more than the part before them.',
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "the repeats written with !",
            response: { code: s4(mask("<1 0!3>"), mask("<1!2 0!2>"), mask("<1!3 0>")) },
            expect: "pass",
          },
          {
            name: "later: the tune after bar 10, the bass after 11, the chords play to the end",
            response: { code: s4(mask("<1 1 0 0>"), mask("<1 1 1 0>"), "") },
            expect: "pass",
          },
          {
            name: "the bars left out with rests instead of masks",
            response: {
              code: s4("", "", "")
                .replace(
                  `const melOutro = ${CLOSE_MEL}`,
                  'const melOutro = n("<[5 ~ 3 ~] ~ ~ ~>").scale("C4:major")',
                )
                .replace(
                  `const bassOutro = ${CLOSE_ROOTS}`,
                  'const bassOutro = n("<3 4 ~ ~>").scale("C2:major")',
                )
                .replace(
                  `const chordsOutro = ${CLOSE_CHORDS}`,
                  'const chordsOutro = chord("<F G C ~>").voicing()',
                ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s4("", "", "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a mask on every part that silences nothing",
            response: { code: s4(mask("1"), mask("1"), mask("1")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "in the order they came in: the chords leave first, the tune last",
            response: { code: s4(mask("<1 1 1 0>"), mask("<1 1 0 0>"), mask("<1 0 0 0>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "only the tune leaves; the bass and the chords play to the end",
            response: { code: s4(mask("<1 0 0 0>"), "", "") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Shrink the loop",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "shrink-the-loop",
        version: 1,
        role: "check",
        prompt:
          "The outro plays the phrase's last bar, G E D C, four times. Rewrite the highlighted pattern as four bars inside `< >`: that bar twice, then its second half twice in one bar, then its last note four times. Done when the loop gets shorter after its first two bars, and again at the end.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [SHRINKING], bars: 8 },
        matcher: {
          m: "rubric",
          rules: [
            ENDS(
              ["shrinking-tail"],
              "The outro loops a piece of the last bar, and the loop gets shorter",
              true,
            ),
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "The outro has four bars and one pattern. Give each bar its own item inside `< >`.",
          "Bars 1 and 2 keep the four notes. In bar 3 the last two notes play twice; in bar 4 the last note plays four times.",
          "The second half of `[4 2 1 0]` is `1 0`. Written twice in one bar it is `[1 0 1 0]`.",
        ),
        tests: [
          { name: "reference", response: { code: SHRINKING }, expect: "pass" },
          {
            name: "written with ! and *",
            response: { code: shrink(`<${FIGURE}!2 [[1 0]*2] [0*4]>`) },
            expect: "pass",
          },
          {
            name: "the second half from bar 2 on",
            response: { code: shrink(`<${FIGURE} [1 0 1 0] [1 0 1 0] [0 0 0 0]>`) },
            expect: "pass",
          },
          {
            name: "one shortening: the bar three times, then its second half",
            response: { code: shrink(`<${FIGURE} ${FIGURE} ${FIGURE} [1 0 1 0]>`) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: shrink(FIGURE) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "faster, not shorter: the whole bar squeezed into half a bar and a quarter",
            response: { code: shrink(`<${FIGURE} ${FIGURE} [${FIGURE}*2] [${FIGURE}*4]>`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "shorter, then back to the whole bar",
            response: { code: shrink(`<${FIGURE} [1 0 1 0] [0 0 0 0] ${FIGURE}>`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "compare",
      title: "Fade a loop",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "fade-a-loop",
        version: 1,
        role: "practice",
        prompt:
          "Both cards get quieter over their last four bars until they are silent. Pick the card where what fades is a loop: one bar that comes round again and again.",
        skills: [{ skill: "F05", w: 1 }],
        hints: ladder(
          "Listen to the last four bars of each card. Does the music change from bar to bar while it gets quieter?",
          "In one card the chords keep changing as the level falls. In the other, one bar repeats.",
          "Hum the last four bars of each card. Which one can you hum with the same four notes every bar?",
        ),
        stimulus: { src: "code", code: FADE_LOOP, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "loop", label: "Card A", audio: FADE_LOOP },
            { id: "new", label: "Card B", audio: FADE_NEW },
          ],
        },
        correct: { choice: ["loop"] },
        feedbackText: {
          "id.wrong":
            "In card B new chords keep arriving while the level falls, so the song sounds cut off in the middle. In card A one bar on C repeats and drifts away.",
        },
        tests: [
          { name: "the fading loop", response: { answer: { choice: ["loop"] } }, expect: "pass" },
          {
            name: "the fade over new chords",
            response: { answer: { choice: ["new"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "End your song",
      minutes: 2.75,
      // No Band: an ending is heard in the silence after it, and a Band would keep playing into it (AUTHORING §8
      // rule 8). The song carries its own drums.
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"], band: false },
      exercise: {
        kind: "code-make",
        id: "end-your-song",
        version: 1,
        role: "practice",
        prompt:
          "The eight-bar outro plays the verse twice, and the song just stops. Rewrite the outro so it ends on purpose: let the parts leave in turn, shrink a loop of the last bar, fade a repeating loop, or land on a new last bar with C after G or one final hit. Done when it ends one of those ways.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [16, 32],
        saveAs: "sketch",
        rubric: [
          ENDS(
            undefined,
            "The outro ends on purpose: parts leave in turn, a loop shrinks, a loop fades, a build, or a last chord or hit on a new bar",
            true,
          ),
        ],
        // The override serves every rule of the rubric, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Right now the outro is the verse twice, every part to the last beat. Pick one way of ending and change only the outro consts.",
          "To let parts leave, give each outro part a `.mask()` with eight items, the tune's with the most 0s. To land, write a last bar the song has not played yet.",
          "For a cadence: end the chords on G for a bar, then a C that plays once and stops, `[C ~ ~ ~]`, with the bass and drums landing with it.",
        ),
        tests: [
          {
            name: "minimal: the parts leave in turn, the drums end on one kick",
            response: { code: MAKE_EXITS },
            expect: "pass",
          },
          {
            name: "beyond the brief: the closing phrase lands on a new last bar, V to I, with a fill and one last hit",
            response: { code: MAKE_CADENCE },
            expect: "pass",
          },
          { name: "the verse twice, fading away", response: { code: MAKE_FADE }, expect: "pass" },
          {
            name: "the outro of the lesson's song",
            response: {
              code: makeSong({
                chords: `${CLOSE_CHORDS}.mask("<1 1 1 1 1 1 0 0>")`,
                bass: `${CLOSE_ROOTS}.mask("<1 1 1 1 1 1 1 0>")`,
                mel: `${CLOSE_MEL}.mask("<1 1 1 1 1 0 0 0>")`,
                drums: `s("<[bd hh sd hh bd hh sd hh]!7 [bd ~ ~ ~]>")${DRUM_LEVELS}`,
              }),
            },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "every part stops at the same moment",
            response: { code: MAKE_ALL_AT_ONCE },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
