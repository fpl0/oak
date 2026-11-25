// Peak first: write the complete palette before deciding where its parts sit out.
// The Make starts with bass and chords, unlike U09.L07's everything-everywhere starter.
// `carved` accepts deleted notes, but minDiffer counts distinct sets of playing tracks.
// The arc is a suggestion: starting with the peak must still pass the required rule.
import { defineLesson, type HintLadder, type RubricRule, type TestCase } from "@oak/content-kit";

const code = (...lines: string[]) => `setcpm(90/4)\n\n${lines.join("\n")}`;
const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];
const PARTS = ["hats", "bass", "chords", "mel", "vox"] as const;
type Part = (typeof PARTS)[number];
type Section = "Intro" | "Verse" | "Chorus" | "Outro";
type Parts = Record<Part, string>;
type Changes = Partial<Record<Section, Partial<Parts>>>;
const ORDER: Section[] = ["Intro", "Verse", "Chorus", "Outro"];
const CHORD_DEGREES = "<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>";
const FULL: Parts = {
  hats: 's("hh*8")',
  bass: 'note("<a1 f1 c2 g1>")',
  chords: `n("${CHORD_DEGREES}")`,
  mel: 'n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")',
  vox: 'n("<[~ ~ 0 2] [~ 0 2 ~] [2 ~ ~ 4] [~ 1 ~ -1]>")',
};
const SOUND: Parts = {
  hats: ".gain(.35)",
  bass: '.s("ebass").lpf(700)',
  chords: '.scale("A3:minor").s("piano").gain(.5)',
  mel: '.scale("A4:minor").s("square").lpf(2000).gain(.5)',
  vox: '.scale("A3:minor").s("strings").gain(.4)',
};
// Chorus definitions come first so every other section visibly derives from the peak.
const song = (changes: Changes = {}, peak = FULL, order = ORDER) =>
  code(
    ...PARTS.map((part) => `const ${part}Chorus = ${changes.Chorus?.[part] ?? peak[part]}`),
    ...(["Intro", "Verse", "Outro"] as const).flatMap((section) =>
      PARTS.map((part) => `const ${part}${section} = ${changes[section]?.[part] ?? `${part}Chorus`}`),
    ),
    "",
    ...PARTS.map(
      (part) =>
        `${part}: arrange(${order.map((section) => `[4, ${part}${section}]`).join(", ")})${SOUND[part]}`,
    ),
  );
const CARVING: Changes = {
  Intro: { hats: "silence" },
  Verse: { mel: "silence", vox: "silence" },
  Outro: { hats: "silence", mel: "silence", vox: "silence" },
};
const REFERENCE = song(CARVING);
const PEAK = code(...PARTS.map((part) => `${part}: ${FULL[part]}${SOUND[part]}`));
const PEAK_FIRST = song(CARVING, FULL, ["Chorus", "Intro", "Verse", "Outro"]);
const VERSE = code(...PARTS.map((part) => `${part}: ${CARVING.Verse?.[part] ?? FULL[part]}${SOUND[part]}`));
const STARTER = song();
const MODIFY_STARTER = STARTER.replace("const hatsIntro =", "⟪const hatsIntro =").replace(
  "const voxOutro = voxChorus",
  "const voxOutro = voxChorus⟫",
);
const MAKE_PEAK = { ...FULL, hats: "silence", mel: "silence", vox: "silence" };
const MAKE_STARTER = song({}, MAKE_PEAK);
// Erased eighths retain their original length; hh*4 would lengthen the remaining hits.
const ERASED = song({
  Intro: { bass: "silence", hats: 's("hh ~ ~ ~ hh ~ ~ ~")' },
  Verse: { hats: 's("hh ~ hh ~ hh ~ hh ~")' },
  Outro: { hats: 's("hh ~ ~ ~ hh ~ ~ ~")' },
});
const MASKED = song({
  Intro: { hats: 'hatsChorus.mask("0")' },
  Verse: { mel: 'melChorus.mask("0")', vox: 'voxChorus.mask("0")' },
  Outro: { hats: 'hatsChorus.mask("0")', mel: 'melChorus.mask("0")', vox: 'voxChorus.mask("0")' },
});
const DIFFERENT = song({
  Intro: { mel: "silence", vox: "silence" },
  Verse: { hats: "silence" },
  Outro: { bass: "silence", hats: "silence" },
});
const SAME_REMOVAL = song(Object.fromEntries(ORDER.map((section) => [section, { hats: "silence" }])));
const NEW_VERSE_NOTE = song({ ...CARVING, Verse: { ...CARVING.Verse, bass: 'note("<a1 f1 d2 g1>")' } });
// The chorus retains the greatest density, but no longer contains the strings heard in the intro and verse.
const THINNED_CHORUS = song({
  ...CARVING,
  Chorus: { vox: "silence" },
  Intro: { hats: "silence", vox: FULL.vox },
  Verse: { mel: "silence", vox: FULL.vox },
});
const MINIMAL = song({ Intro: { bass: "silence" }, Outro: { bass: "silence" } }, MAKE_PEAK);
const RICH = song(CARVING, { ...FULL, mel: 'n("<[0 2 4 7] [2 0 2 4] [4 2 6 4] [1 3 6 3]>")' }).replace(
  '.s("square").lpf(2000)',
  '.s("triangle").lpf(2000).room(.2)',
);

const CARVED: RubricRule = {
  id: "carved-from-peak",
  label:
    "Every section is the fullest one with parts or notes taken away; at least two sections differ in which parts play",
  required: true,
  skills: ["D09", "F05", "F06"],
  rule: "custom",
  fn: "carved",
  params: { minDiffer: 2 },
};
const ARC: RubricRule = {
  id: "peak-between-thinner-sections",
  label: "Suggestion: the fullest section has a thinner one before and after it",
  required: false,
  skills: ["F06"],
  rule: "custom",
  fn: "arc",
  params: {},
};
const carvingHints = () =>
  ladder(
    "Compare the parts in each section with the fullest section. Where could a sound wait, so the peak has somewhere to grow?",
    "The Intro, Verse and Outro consts choose what each part plays there. Keep the surviving notes in their original places.",
    "Let a sound wait through an opening section, then consider a different combination for the ending. A rest inside a pattern can also leave room.",
  );
// The two musical mistakes share a code; the fidelity pins distinguish their details.
const corrections = (): TestCase[] => [
  { name: "reference", response: { code: REFERENCE }, expect: "pass" },
  { name: "masks instead of silence", response: { code: MASKED }, expect: "pass" },
  { name: "mostly erasing notes inside parts", response: { code: ERASED }, expect: "pass" },
  { name: "different sections carved", response: { code: DIFFERENT }, expect: "pass" },
  { name: "the peak comes first", response: { code: PEAK_FIRST }, expect: "pass" },
  {
    name: "silence removes the same part everywhere",
    response: { code: SAME_REMOVAL },
    expect: "fail",
    feedback: ["rubric.unmet"],
  },
  {
    name: "a new note in the verse",
    response: { code: NEW_VERSE_NOTE },
    expect: "fail",
    feedback: ["rubric.unmet"],
  },
  {
    name: "the chorus loses a part still heard in the verse",
    response: { code: THINNED_CHORUS },
    expect: "fail",
    feedback: ["rubric.unmet"],
  },
];
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.aeolian-4bar", tracks: ["drums"] } as const;

export default defineLesson({
  id: "A2.L08",
  version: 1,
  title: "Peak First",
  objective: "Write the fullest section first, then make every other section by taking parts away.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: 90,
  introduces: [],
  practises: ["D09", "F05", "F06"],
  terms: [{ id: "term.dramatic-arc", step: "S5" }],
  canDo: ["cd.compose.peak-first"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Start with everything",
      minutes: 0.5,
      ui: { panels: ROLL, band: DRUMS },
      exercise: {
        kind: "listen",
        id: "hear-the-peak",
        version: 1,
        role: "practice",
        prompt:
          "Listen for which parts sit out when the fullest loop becomes an intro, verse, chorus and outro.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PEAK, caption: "The complete palette together.", bars: 4 },
          { code: REFERENCE, caption: "The same palette spread across a song.", bars: 16 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Count the verse",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "count-verse-parts",
        version: 1,
        role: "practice",
        prompt:
          "Predict how many labelled parts play in this verse, then enter the number. Count a line only if it sounds; this example plays without the Band.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        code: VERSE,
        bars: 4,
        mode: "count",
        correct: 3,
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Find the omission",
      minutes: 1,
      ui: { panels: ROLL, band: DRUMS, initialPanels: ["form"] },
      exercise: {
        kind: "run-investigate",
        id: "find-the-missing-part",
        version: 1,
        role: "practice",
        prompt:
          "Find which of your labelled parts plays in the chorus but sits out the intro. Pick its line below; the Band's drums play throughout.",
        skills: [{ skill: "D09", w: 1 }],
        code: { starter: REFERENCE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which labelled part was taken out of the intro?",
            options: [
              { id: "hats", label: "hats" },
              { id: "bass", label: "bass" },
              { id: "chords", label: "chords" },
            ],
            correct: ["hats"],
          },
        ],
        hints: ladder(
          "Compare the opening with the fullest section. Which sound waits until later?",
          "Follow the Intro const for each offered line, then compare it with that line's Chorus const.",
          "A part with no notes in the intro leaves an empty row on the roll there, even while the Band plays.",
        ),
        feedbackText: {
          "investigate.wrong":
            "That part still sounds in the intro. Compare its row in bars 1–4 with bars 9–12, and look for the row that is empty only in the opening.",
        },
        tests: [
          { name: "the omitted part", response: { answer: { choice: ["hats"] } }, expect: "pass" },
          {
            name: "the bass still playing",
            response: { answer: { choice: ["bass"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Carve from the peak",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, band: DRUMS, initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "carve-the-sections",
        version: 1,
        role: "check",
        prompt:
          "Make the intro, verse and outro from the chorus by taking parts or notes away, using silence or a mask. Add nothing and keep the chorus full. Done when at least two sections differ in which parts play and none plays a note absent from the chorus.",
        skills: [
          { skill: "D09", w: 0.5 },
          { skill: "F05", w: 0.5 },
        ],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [REFERENCE], bars: 16 },
        matcher: { m: "rubric", rules: [CARVED] },
        target: { audible: true, showRoll: false },
        hints: carvingHints(),
        feedbackText: {
          "rubric.unmet":
            "{label}: {detail}. Compare what plays in each section with the fullest section, listening for what remains.",
        },
        tests: [
          ...corrections(),
          {
            name: "unchanged starter",
            response: { code: STARTER },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Place the peak",
      minutes: 0.5,
      ui: { panels: NONE, band: DRUMS },
      exercise: {
        kind: "identify",
        id: "hear-the-build",
        version: 1,
        role: "practice",
        prompt:
          "Pick the version that builds to its fullest section and falls away afterwards. Both use exactly the same sections in a different order.",
        skills: [{ skill: "F06", w: 1 }],
        stimulus: { src: "code", code: REFERENCE, bars: 16, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "build", label: "Version A", audio: REFERENCE },
            { id: "first", label: "Version B", audio: PEAK_FIRST },
          ],
        },
        correct: { choice: ["build"] },
        hints: ladder(
          "Follow how full each version feels from beginning to end. Where does it reach its busiest moment?",
          "Listen to the opening, then the section where every part plays. Does the opening leave somewhere to grow?",
          "Listen to what comes after the fullest moment as well as what leads into it.",
        ),
        feedbackText: {
          "id.wrong":
            "That version opens with every part. Compare the openings again and follow where the fullest moment arrives.",
        },
        tests: [
          { name: "build and fall", response: { answer: { choice: ["build"] } }, expect: "pass" },
          {
            name: "peak at the start",
            response: { answer: { choice: ["first"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your fullest moment",
      minutes: 2.75,
      ui: { panels: ROLL, band: DRUMS, initialPanels: ["form"] },
      exercise: {
        kind: "code-make",
        id: "write-your-peak",
        version: 1,
        role: "practice",
        prompt:
          "Write your own fullest section in the Chorus consts, then make the intro, verse and outro by taking parts or notes away. The bass and chords are a starting point. Done when every section uses only the fullest section's material and at least two sections differ in which parts play.",
        skills: [
          { skill: "D09", w: 0.5 },
          { skill: "F06", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [16, 16],
        saveAs: "sketch",
        rubric: [CARVED, ARC],
        hints: ladder(
          "Start with what you want the fullest moment to sound like. Which of its sounds could wait elsewhere?",
          "Write the Chorus consts before changing the Intro, Verse and Outro consts. Each later choice comes from that palette.",
          "Keep a surviving note's length and place when replacing neighbouring notes with rests. Let some sections leave out a whole sound too.",
        ),
        feedbackText: {
          "rubric.unmet":
            "{label}: {detail}. Compare what plays in each section with the fullest section, listening for what remains.",
        },
        tests: [
          ...corrections(),
          {
            name: "unchanged Make starter",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal bass and chords", response: { code: MINIMAL }, expect: "pass" },
          { name: "beyond the brief with a new tune and sound", response: { code: RICH }, expect: "pass" },
        ],
      },
    },
  ],
});
