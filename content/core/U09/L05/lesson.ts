// U09.L05 Arranging in Code. Inside a section, parts come in and drop out by bar with `.mask()`:
// `.mask("<0 1 1 1>")` keeps a part silent in the first bar of four and lets it play in the other three. An
// intro brings the parts in one by one; a part that stops for the bar before the chorus makes the chorus land
// (a breakdown). Written inside the section's `const`, the mask restarts with the section (contracts §6.3 item 7).
// `tb.mask` unlocks here; no new terms. What the learner has: verse and chorus with one `arrange()` per track
// and `silence` for a part that rests a whole section (U09.L02), the build-up drawn with a signal (U09.L04),
// `< >` one item a bar and `!` repeats (U01). Not yet: fades and effects across sections (A1.L05–L07).
// Spec: content/specs/U09.md.
//
// How it is graded: S4 by pitch-class sets per onset on the chords (voicing output, contracts §6.7), S5 by an
// `events` match on the bass (degrees, octave-free), S6 by the bar the bass comes in. The Make's one required
// rule counts `.mask()` uses: content-independent, so a learner who brings their own U09.L02 song passes the
// same way.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 104;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The doo-wop loop, I vi IV V (C Am F G), in the verse; the chorus starts away from home, IV V I I. */
const LOOP = 'chord("<C Am F G>").voicing()';
const chordsIntro = (mask: string) => `const chordsIntro = ${LOOP}${mask}`;
const CHORDS_VERSE = `const chordsVerse = ${LOOP}`;
const CHORDS_CHORUS = 'const chordsChorus = chord("<F G C C>").voicing()';
/** The roots an octave under the chords (U08.L01). */
const ROOTS = 'n("<0 5 3 4>").scale("C2:major")';
const BASS_INTRO = `const bassIntro = ${ROOTS}.mask("<0 1 1 1>")`;
const bassVerse = (mask: string) => `const bassVerse = ${ROOTS}${mask}`;
const BASS_CHORUS = 'const bassChorus = n("<3 4 0 0>").scale("C2:major")';
/** The tune's lead-in: G A on beats 3 and 4 of the intro's last bar, into C5 on the verse's first beat. */
const MEL_INTRO = 'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")';
/** C5 G E | C E | F A F | G: chord tones on beats 1 and 3. */
const MEL_VERSE = 'const melVerse = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")';
/** The U09.L02 chorus tune: C5 A4 | B4 G4 | C5 E5 C5 | C5. */
const MEL_CHORUS = 'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")';

const DRUMS = ['kick: s("bd ~ bd ~")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*8").gain(.5)'];
/** One `arrange()` per track over the sections named. */
const arr = (sections: [number, string][]) =>
  `arrange(${sections.map(([b, c]) => `[${b}, ${c}]`).join(", ")})`;
/** Chords, bass and tune, each with one `arrange()` of the same four-bar sections (`Intro`, `Verse`, …). */
const tracks = (...names: string[]) => {
  const each = (role: string) => arr(names.map((n): [number, string] => [4, `${role}${n}`]));
  return [
    `chords: ${each("chords")}.s("piano")`,
    `bass: ${each("bass")}.s("ebass").lpf(600)`,
    `mel: ${each("mel")}.s("piano")`,
  ];
};

/** The hook: an intro that brings the parts in one at a time, then the verse (8 bars). */
const hook = (chordsMask = '.mask("<0 0 1 1>")') =>
  `${TEMPO}${[chordsIntro(chordsMask), CHORDS_VERSE, BASS_INTRO, bassVerse(""), MEL_INTRO, MEL_VERSE].join("\n")}\n\n${[
    ...DRUMS,
    ...tracks("Intro", "Verse"),
  ].join("\n")}`;
const HOOK = hook();
/** The verse with everything from its first bar (4 bars). */
const VERSE_ONLY = code(
  CHORDS_VERSE,
  bassVerse(""),
  MEL_VERSE,
  "",
  ...DRUMS,
  'chords: chordsVerse.s("piano")',
  'bass: bassVerse.s("ebass").lpf(600)',
  'mel: melVerse.s("piano")',
);

/** S4: the chords play all through the intro. */
const CHORDS_STARTER = hook("⟪⟫");

/** S5: the verse goes straight into the chorus; the bass plays every bar. */
const drop = (mask: string, chorusMask = "") =>
  `${TEMPO}${[
    CHORDS_VERSE,
    CHORDS_CHORUS,
    bassVerse(mask),
    `${BASS_CHORUS}${chorusMask}`,
    MEL_VERSE,
    MEL_CHORUS,
  ].join("\n")}\n\n${[...DRUMS, ...tracks("Verse", "Chorus")].join("\n")}`;
const DROP = '.mask("<1 1 1 0>")';
const DROP_STARTER = drop("⟪⟫");

/**
 * S6: a different intro, eight bars, no code shown. Hats and chords from bar 1, the bass from bar 3, kick and
 * snare from bar 5.
 */
const EAR_INTRO = code(
  'hats: s("hh*8").gain(.5)',
  'kick: s("bd ~ bd ~").mask("<0!4 1!4>")',
  'snare: s("~ sd ~ sd").mask("<0!4 1!4>")',
  'bass: n("<0 5 3 4>").scale("C2:major").mask("<0!2 1!6>").s("ebass").lpf(600)',
  'chords: chord("<C Am F G>").voicing().s("piano").gain(.6)',
);

/** The Make: verse and chorus arranged, every part from bar 1 (8 bars). The Band plays the drums. */
const MAKE_CONSTS = [CHORDS_VERSE, CHORDS_CHORUS, bassVerse(""), BASS_CHORUS, MEL_VERSE, MEL_CHORUS];
const make = (consts: string[], ...lines: string[]) => `${TEMPO}${consts.join("\n")}\n\n${lines.join("\n")}`;
const MAKE_STARTER = make(MAKE_CONSTS, ...tracks("Verse", "Chorus"));
/** Minimal: a four-bar intro where the bass comes in at bar 2 and the chords at bar 3; the tune waits. */
const MAKE_MINIMAL = make(
  [
    chordsIntro('.mask("<0 0 1 1>")'),
    ...MAKE_CONSTS.slice(0, 2),
    BASS_INTRO,
    ...MAKE_CONSTS.slice(2, 4),
    "const melIntro = silence",
    ...MAKE_CONSTS.slice(4),
  ],
  ...tracks("Intro", "Verse", "Chorus"),
);
/**
 * Beyond the brief: the hook's intro with the tune's lead-in, a drop before each chorus, verse chorus verse
 * chorus, and hats of the learner's own that wait for bar 2.
 */
const MAKE_RICH = make(
  [
    chordsIntro('.mask("<0 0 1 1>")'),
    CHORDS_VERSE,
    CHORDS_CHORUS,
    BASS_INTRO,
    bassVerse(DROP),
    BASS_CHORUS,
    MEL_INTRO,
    MEL_VERSE,
    MEL_CHORUS,
    'const hatsIntro = s("hh*8").mask("<0 1 1 1>")',
    'const hatsVerse = s("hh*8")',
    'const hatsChorus = s("[hh hh oh hh]*2")',
  ],
  `hats: arrange([4, hatsIntro], [4, hatsVerse], [4, hatsChorus], [4, hatsVerse], [4, hatsChorus]).gain(.5)`,
  ...tracks("Intro", "Verse", "Chorus", "Verse", "Chorus"),
);
/** An intro, but only one part is masked: the other parts all start together (the tune plays the verse's). */
const MAKE_ONE_MASK = make(
  [
    chordsIntro(""),
    ...MAKE_CONSTS.slice(0, 2),
    BASS_INTRO,
    ...MAKE_CONSTS.slice(2, 4),
    MEL_VERSE.replace("melVerse", "melIntro"),
    ...MAKE_CONSTS.slice(4),
  ],
  ...tracks("Intro", "Verse", "Chorus"),
);
/** One mask, and the tune waits the whole intro with `silence`: the chords, then the bass, then the tune. */
const MAKE_MASK_AND_SILENCE = make(
  [
    chordsIntro(""),
    ...MAKE_CONSTS.slice(0, 2),
    BASS_INTRO,
    ...MAKE_CONSTS.slice(2, 4),
    "const melIntro = silence",
    ...MAKE_CONSTS.slice(4),
  ],
  ...tracks("Intro", "Verse", "Chorus"),
);
/** The outside review's counterexample: two masks that silence nothing; every part from bar 1. */
const MAKE_EMPTY_MASKS = make(
  [CHORDS_VERSE, CHORDS_CHORUS, bassVerse('.mask("1")'), BASS_CHORUS, MEL_VERSE, `${MEL_CHORUS}.mask("1")`],
  ...tracks("Verse", "Chorus"),
);

/** Drums from the Band in the flavour's kit; chords, bass and tune are in the learner's code. */
const BAND = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const CHORDS_MATCH: Matcher = { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] };
const BASS_MATCH: Matcher = {
  m: "events",
  pitch: "octave-free",
  rhythm: "onsets",
  durations: false,
  tracks: ["bass"],
};

export default defineLesson({
  id: "U09.L05",
  version: 3,
  title: "Arranging in Code",
  objective:
    "I can bring parts in and out of an arrangement by bar with .mask(): an intro that builds, a part that steps out before the chorus.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["F06"],
  practises: [],
  terms: [],
  canDo: ["cd.code.layers"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Part by part",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "part-by-part",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops. Listen for how the first four bars of loop 2, before the verse, start the song differently from loop 1.",
        skills: [{ skill: "F06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: VERSE_ONLY, caption: "Everything from bar 1.", bars: 4 },
          { code: HOOK, caption: "Four bars of opening, then the same verse.", bars: 8 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Read the mask",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "read-the-mask",
        version: 1,
        role: "practice",
        prompt:
          'Predict when the bass plays in the four bars of the intro, then pick it. The intro\'s bass is `n("<0 5 3 4>").scale("C2:major").mask("<0 1 1 1>")`. `.mask()` lets a part play where its pattern says 1 and silences it where it says 0.',
        skills: [{ skill: "F06", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "from-two", label: "From bar 2 to the end of the intro" },
          { id: "only-one", label: "Only in bar 1" },
          { id: "alternate", label: "Every other bar" },
        ],
        correct: ["from-two"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Who comes in when",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      example: { id: "who-comes-in-when", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "who-comes-in-when",
        version: 1,
        role: "practice",
        prompt:
          "Run the intro and verse. On the roll, find the bar where each line first plays. Answer both questions below: which part comes in last, and in which bar the chords come in.",
        skills: [{ skill: "F06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the `.mask()` patterns in the intro consts, one item a bar, and match them to the roll. The tune has no mask: its rests do the waiting.",
        },
        hints: ladder(
          "Find the line that is still empty on the roll when every other line has started.",
          "Each intro const that ends in `.mask()` has one 0 or 1 per bar. Count the 0s before the first 1.",
          "The bass's mask starts with one 0, so it enters at bar 2. Read the chords' mask the same way.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which part comes in last?",
            options: [
              { id: "mel", label: "The tune" },
              { id: "bass", label: "The bass" },
              { id: "chords", label: "The chords" },
            ],
            correct: ["mel"],
          },
          {
            q: "number",
            prompt: "In which bar do the chords come in?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["mel"], number: 3 } }, expect: "pass" },
          {
            name: "the chords last",
            response: { answer: { choice: ["chords"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the bass's bar",
            response: { answer: { choice: ["mel"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Hold the chords back",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "hold-the-chords-back",
        version: 1,
        role: "check",
        prompt:
          "The chords play from bar 1 of the intro, so the drums and bass have no room of their own. Add a `.mask()` in the highlighted place, at the end of `chordsIntro`, so the chords stay silent in bars 1 and 2 and play in bars 3 and 4.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: CHORDS_STARTER },
        reference: { solutions: [HOOK], bars: 8 },
        matcher: CHORDS_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: the chords play {got} here, and the target has {exp}. Read your mask one item a bar.",
        },
        hints: ladder(
          "You need the method that silences a part in some bars and lets it play in others.",
          "The bass's intro const shows it: a `.mask()` at the end, one 0 or 1 for each of the four bars.",
          "The bass's mask is `<0 1 1 1>`: one silent bar. The chords need two.",
        ),
        tests: [
          { name: "reference", response: { code: HOOK }, expect: "pass" },
          {
            name: "the repeats written with !",
            response: { code: hook('.mask("<0!2 1!2>")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: hook("") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "in for two bars, then out",
            response: { code: hook('.mask("<1 1 0 0>")') },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the mask on the verse's chords instead",
            response: {
              code: hook("").replace(
                `const chordsVerse = ${LOOP}`,
                `const chordsVerse = ${LOOP}.mask("<0 0 1 1>")`,
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Room for the chorus",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "make-room-for-the-chorus",
        version: 1,
        role: "check",
        prompt:
          "The verse runs straight into the chorus. Add a `.mask()` in the highlighted place, at the end of `bassVerse`, so the bass rests in bar 4 of the verse, the bar before the chorus. Done when the bass plays in bars 1 to 3 and is silent in bar 4.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: DROP_STARTER },
        reference: { solutions: [drop(DROP)], bars: 8 },
        matcher: BASS_MATCH,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.missing-note":
            "Bar {bar}: the bass should play here. Give this bar a 1 in your mask; only the verse's last bar gets a 0.",
          "melody.extra-note": "Bar {bar}: the bass should rest here, just before the chorus.",
        },
        hints: ladder(
          "The verse has four bars and the chorus starts right after the last one. Find that last bar.",
          "A `.mask()` on the verse's bass, one item for each of its four bars.",
          "In the intro, `<0 1 1 1>` silenced the first bar. Here it is a different bar.",
        ),
        tests: [
          { name: "reference", response: { code: drop(DROP) }, expect: "pass" },
          {
            name: "the repeats written with !",
            response: { code: drop('.mask("<1!3 0>")') },
            expect: "pass",
          },
          { name: "unchanged", response: { code: drop("") }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "the drop at the start of the verse",
            response: { code: drop('.mask("<0 1 1 1>")') },
            expect: "fail",
            feedback: ["melody.missing-note", "melody.extra-note"],
          },
          {
            name: "the mask on the chorus's bass",
            response: { code: drop("", '.mask("<1 1 1 0>")') },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Hear the bass arrive",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "hear-the-bass-arrive",
        version: 1,
        role: "check",
        prompt:
          "Listen to a new eight-bar intro, with no code and no roll. Pick the bar where the bass comes in.",
        skills: [{ skill: "F06", w: 1 }],
        hints: [
          { text: "Listen low, under the piano, for the first deep note, and count the bars as they go by." },
          {
            text: "Count the bars aloud. Two things arrive in this intro, at different bars: the bass and then the kick and snare.",
          },
          {
            text: "Hear it again, slower. The chords change at every bar; the bass waits a little longer than one change.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "code", code: EAR_INTRO, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "bar-buttons", bars: 8 },
        correct: { number: 3 },
        feedbackText: {
          "id.wrong": "Bar {got} is not it. Listen under the piano for the first deep note.",
        },
        srs: [{ family: "fam.frm.sections", mode: "review-if-due" }],
        tests: [
          { name: "bar 3", response: { answer: { number: 3 } }, expect: "pass" },
          {
            name: "bar 2, the first chord change",
            response: { answer: { number: 2 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "bar 5, where the kick and snare come in",
            response: { answer: { number: 5 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Give it an intro",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "give-it-an-intro",
        version: 1,
        role: "practice",
        prompt:
          "Add a four-bar intro before the verse: an intro section in each `arrange()`, with `.mask()` so the parts come in one at a time. Done when, at least twice, a part stays silent for a whole bar while another plays. For more, drop one part out for the bar before a chorus.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [12, 32],
        saveAs: "sketch",
        rubric: [
          {
            id: "mask-twice",
            label:
              "`.mask()` used, and twice or more a part is silent for a whole bar while another part plays",
            required: true,
            skills: ["F06"],
            // Corrections pass: the effect, not the count of `.mask()` calls (two `.mask("1")` silence nothing and
            // passed). A part silent for a whole bar while another plays, coming in later or dropping out: twice.
            rule: "custom",
            fn: "parts-enter",
            params: { min: 2, alsoUses: ["tb.mask"] },
          },
          {
            id: "four-tracks",
            label: "Four parts or more in your code, such as hats that wait for bar 2",
            required: false,
            skills: ["F06"],
            rule: "tracks",
            min: 4,
          },
          {
            id: "sixteen-bars",
            label: "The song lasts 16 bars or more, such as intro, verse, chorus and one more section",
            required: false,
            skills: ["F06"],
            rule: "bars",
            min: 16,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "In the song at the start of the lesson the drums came first, then the bass, then the chords, then the tune.",
          "Each arranged line needs an intro section before its verse. Inside an intro const, a `.mask()` decides the bars that part waits.",
          "Start with `const bassIntro`: the verse's bass with a mask that keeps bar 1 silent. A part can also wait the whole intro with `silence`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: bass in at bar 2, chords at bar 3",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: lead-in, a drop before each chorus, verse chorus verse chorus, own hats",
            response: { code: MAKE_RICH },
            expect: "pass",
          },
          {
            name: "two masks that silence nothing",
            response: { code: MAKE_EMPTY_MASKS },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one mask, and the tune waits the whole intro",
            response: { code: MAKE_MASK_AND_SILENCE },
            expect: "pass",
          },
          {
            name: "an intro with one mask: the other parts start together",
            response: { code: MAKE_ONE_MASK },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
