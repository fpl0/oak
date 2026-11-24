// U01.L07 Four-Bar Phrases & Fills. Grooves come in four-bar phrases; `< >` changes a bar, and a fill
// closes the phrase. Tools in reach: everything up to U01.L06 (rests, [ ], @, _, !, gain, banks, toms),
// plus `< >` and the code mute `_name:`, which unlock here. `_name:` is mentioned in prose as a Studio
// convenience and never appears in authored code (STYLE §2 rule 4). Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const KICK = 'kick: s("bd ~ bd ~")';
const HATS = 'hats: s("hh*8").gain(.6)';
const GROOVE_BAR = "~ sd ~ sd";
const FILL_BAR = "sd sd [ht mt] [lt lt]";
const snare = (pattern: string) => `snare: s("${pattern}")`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A four-bar snare phrase from four bar patterns, one item per bar of `< >`. */
const phrase = (...bars: string[]) => `<${bars.map((b) => `[${b}]`).join(" ")}>`;

/** The hook: three bars of backbeat, then a fill; the hats drop out for the second half of bar 4. */
const HOOK = code(
  KICK,
  snare(phrase(GROOVE_BAR, GROOVE_BAR, GROOVE_BAR, FILL_BAR)),
  'hats: s("<hh*8 hh*8 hh*8 [hh hh hh hh ~ ~ ~ ~]>").gain(.6)',
);
const withSnare = (pattern: string) => code(KICK, snare(pattern), HATS);
const PHRASE = withSnare(phrase(GROOVE_BAR, GROOVE_BAR, GROOVE_BAR, FILL_BAR));

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band plays bass and chords under the learner's drums. */
const BAND = { band: "band.two-chord-vamp", tracks: ["bass", "chords"] } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

/** Parsons blocks: three bars of groove (two of them the same) and the fill. */
const BLOCKS = [
  { id: "groove-a", text: `[${GROOVE_BAR}]` },
  { id: "groove-b", text: `[${GROOVE_BAR}]` },
  { id: "push", text: "[~ sd ~ [sd sd]]" },
  { id: "fill", text: `[${FILL_BAR}]` },
].map((b) => ({ ...b, audition: withSnare(b.text.slice(1, -1)) }));
/** Any order of the three groove bars, as long as the fill comes last. */
const GROOVES = ["groove-a", "groove-b", "push"];
const FILL_LAST: string[][] = GROOVES.flatMap((a) =>
  GROOVES.filter((b) => b !== a).flatMap((b) =>
    GROOVES.filter((c) => c !== a && c !== b).map((c) => [a, b, c, "fill"]),
  ),
);

export default defineLesson({
  id: "U01.L07",
  version: 4,
  title: "Four-Bar Phrases & Fills",
  objective: "I can write a four-bar drum phrase with < > and end it with a fill.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R04", "R07"],
  terms: [{ id: "term.fill", step: "S3" }],
  canDo: ["cd.compose.fill"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Count four bars",
      minutes: 0.5,
      ui: { panels: ROLL, band: BAND },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "count-four-bars",
        version: 1,
        role: "practice",
        prompt:
          "Count the bars along with the bar counter: 1, 2, 3, 4, and round again. Listen for the bar that sounds different, and for what it does to the bar after it.",
        skills: [{ skill: "R04", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "A backbeat, four bars to a loop, played twice through.", bars: 8 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "One per bar?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "angle", code: code('drums: s("<bd sd>")'), bars: 2 },
      exercise: {
        kind: "predict",
        id: "one-per-bar",
        version: 1,
        role: "practice",
        prompt:
          'The drum line reads `s("<bd sd>")`: `bd sd` inside `< >`. Predict what you will hear, and pick one answer.',
        skills: [{ skill: "R04", w: 1 }],
        hints: null,
        tests: [],
        code: code('drums: s("<bd sd>")'),
        bars: 2,
        mode: "choose",
        choices: [
          { id: "alternate", label: "`bd` for a whole bar, then `sd` for the next" },
          { id: "both", label: "`bd` then `sd` in every bar, as without `< >`" },
          { id: "together", label: "`bd` and `sd` together, once per bar" },
        ],
        correct: ["alternate"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Which bar breaks?",
      minutes: 1,
      ui: { panels: ROLL },
      exercise: {
        kind: "run-investigate",
        id: "which-bar-breaks",
        version: 1,
        role: "practice",
        prompt:
          "Count the bars while the groove plays, and watch the snare lane on the roll. Then read the snare line in the code and answer the two questions below.",
        skills: [
          { skill: "R04", w: 0.5 },
          { skill: "R07", w: 0.5 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. On the snare line, each `[ ]` inside `< >` is one item and one bar. Count them, then watch which bar the snare lane changes in.",
        },
        hints: ladder(
          "In most bars the snare plays on 2 and 4. Find the bar where it stops: which one is it?",
          "`< >` plays one of its items per bar, in order, then starts again.",
          "The first three items inside `< >` are the same backbeat.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many items sit inside the `< >` on the snare line?",
            correct: 4,
          },
          {
            q: "number",
            prompt: "In which bar of the four does the snare leave the backbeat?",
            correct: 4,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 4 } }, expect: "pass" },
          {
            name: "counted the toms as items",
            response: { answer: { number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "parsons",
      title: "End on the fill",
      minutes: 1,
      ui: { panels: ROLL },
      exercise: {
        kind: "parsons",
        id: "end-on-the-fill",
        version: 1,
        role: "practice",
        prompt:
          "Put the four snare bars in order so the phrase ends on the fill, the bar with the toms. The other three can go in any order. You can hear each block before you place it.",
        skills: [
          { skill: "R04", w: 0.5 },
          { skill: "R07", w: 0.5 },
        ],
        hints: ladder(
          "The fill has one right place in the phrase. Where in the phrase does a fill belong?",
          "A fill leads into bar 1 of the next phrase, so it plays just before it.",
          "The block with the toms goes in the last slot. The other three can go in any order.",
        ),
        blocks: BLOCKS,
        assemble: "bar-seq",
        accept: { orders: FILL_LAST },
        tests: [
          {
            name: "fill last",
            response: { order: ["groove-a", "groove-b", "push", "fill"] },
            expect: "pass",
          },
          {
            name: "push first, fill last",
            response: { order: ["push", "groove-a", "groove-b", "fill"] },
            expect: "pass",
          },
          {
            name: "fill first",
            response: { order: ["fill", "groove-a", "groove-b", "push"] },
            expect: "fail",
            feedback: ["parsons.swap"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Close the phrase",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "close-the-phrase",
        version: 1,
        role: "check",
        prompt: `Turn the snare line into a four-bar phrase with \`< >\`: \`${GROOVE_BAR}\` in bars 1 to 3, and the fill \`${FILL_BAR}\` in bar 4. Wrap each bar in \`[ ]\` so it counts as one item.`,
        skills: [
          { skill: "R04", w: 0.5 },
          { skill: "R07", w: 0.5 },
        ],
        code: { starter: code(KICK, `snare: s("⟪${GROOVE_BAR}⟫")`, HATS) },
        reference: { solutions: [PHRASE], bars: 4 },
        // Drum hits are one-shots: only where they start matters, never the length of their slot.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, sound: "drum-role" },
        constraints: [{ c: "must-use", tool: "tb.mini.alt", feedback: "code.must-use" }],
        target: { audible: true, showRoll: true },
        feedbackText: {
          "code.must-use": "Write the four bars inside `< >`, one item per bar.",
          "rhythm.missing": `Bar {bar}, {beatLabel}: no hit here yet{role}. Bars 1 to 3 play \`${GROOVE_BAR}\`, and bar 4 plays the fill.`,
          "rhythm.extra": `Bar {bar}, {beatLabel}: a hit that should not be there{role}. Bars 1 to 3 play \`${GROOVE_BAR}\`, and only bar 4 plays the fill.`,
        },
        hints: ladder(
          "The phrase needs four bars, each one item inside `< >`. How many items does `< >` need?",
          "Each item is one bar. Wrap a bar of several sounds in `[ ]` so it counts as one item.",
          `Bar 1 is \`[${GROOVE_BAR}]\`. Bars 2 and 3 are the same, and the fill comes last.`,
        ),
        srs: [{ family: "fam.code.mini", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: PHRASE }, expect: "pass" },
          {
            name: "the groove bar written once, with !3",
            response: { code: withSnare(`<[${GROOVE_BAR}]!3 [${FILL_BAR}]>`) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: withSnare(GROOVE_BAR) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "fill in bar 1",
            response: { code: withSnare(phrase(FILL_BAR, GROOVE_BAR, GROOVE_BAR, GROOVE_BAR)) },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
          {
            name: "three bars in the phrase",
            response: { code: withSnare(phrase(GROOVE_BAR, GROOVE_BAR, FILL_BAR)) },
            expect: "fail",
            feedback: ["rhythm.extra"],
          },
          {
            name: "the fill in every bar, without < >",
            response: { code: withSnare(FILL_BAR) },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "tap",
      title: "Echo two bars",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "tap",
        id: "echo-two-bars",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two bars of rhythm, then tap them back: one tap for every sound, in the same places. Bar 2 is different from bar 1.",
        skills: [{ skill: "E01", w: 1 }],
        hints: ladder(
          "Tap both bars, every sound in its place. Does bar 2 copy bar 1, or answer it?",
          "Tap bar 1 alone a few times first, then add bar 2.",
          "Count 1-e-&-a in the busy beats and tap only on the words that got a sound.",
        ),
        mode: "echo",
        stimulus: { src: "generator", family: "fam.rhy.echo", level: 4 },
        cue: { context: "none", countInBars: 1, click: true, replays: 2 },
        bars: 2,
        target: {},
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        srs: [{ family: "fam.rhy.echo", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your four-bar phrase",
      minutes: 3,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "code-make",
        id: "four-bar-phrase",
        version: 1,
        role: "practice",
        prompt:
          "Write a four-bar drum phrase for the second part of your song, with `< >`, so that at least one line plays two or more different bars before it repeats. End the phrase with a fill in bar 4.",
        skills: [
          { skill: "R04", w: 0.5 },
          { skill: "R07", w: 0.5 },
        ],
        code: { starter: withSnare(GROOVE_BAR) },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "alt",
            label: "One line plays at least two different bars, using `< >`",
            required: true,
            skills: ["R04"],
            // The effect, not the brackets: `<[~ sd ~ sd]>` holds one choice and plays the same bar every time.
            rule: "custom",
            fn: "bars-differ",
            params: { min: 2, alsoUses: ["tb.mini.alt"] },
          },
          {
            id: "four-bars",
            label: "The loop runs four bars or more before it repeats",
            required: false,
            skills: ["R04"],
            rule: "bars",
            min: 4,
          },
          {
            id: "toms",
            label: "Uses the low tom `lt`",
            required: false,
            skills: ["R07"],
            rule: "sounds",
            contains: ["snd.drum.lt"],
          },
          {
            id: "backbeat",
            label: "Snare on beats 2 and 4 in bars 1 to 3",
            required: false,
            skills: ["R04"],
            rule: "onsets",
            track: "@drums",
            drum: "snare",
            contains: [
              [1, 4],
              [3, 4],
              [5, 4],
              [7, 4],
              [9, 4],
              [11, 4],
            ],
            perBar: false,
          },
        ],
        hints: ladder(
          "Make bar 4 different from bars 1 to 3 on at least one line. Which line should change in bar 4?",
          "Put that line's bar inside `< >` four times, then change the last item.",
          `\`<[${GROOVE_BAR}]!3 [~ sd ~ ~]>\` is a phrase whose bar 4 drops a snare. Make that last bar busier.`,
        ),
        tests: [
          {
            name: "the starter: one bar on repeat",
            response: { code: withSnare(GROOVE_BAR) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal",
            response: { code: withSnare(`<[${GROOVE_BAR}]!3 [sd sd lt lt]>`) },
            expect: "pass",
          },
          {
            name: "beyond the brief",
            response: {
              code: code(
                'kick: s("<[bd ~ bd ~] [bd ~ bd [~ bd]] [bd ~ bd ~] [bd ~ ~ ~]>").bank("RolandTR909")',
                snare(`<[${GROOVE_BAR}]!3 [sd [sd sd] [ht!2 mt!2] [lt lt lt lt]]>`),
                'hats: s("<hh*16 hh*8 hh*16 [hh*4 ~ ~]>").gain(.5)',
                'perc: s("<cr ~ ~ ~>")',
              ),
            },
            expect: "pass",
          },
          {
            name: "`< >` with one choice: the same bar every time",
            response: { code: withSnare(`<[${GROOVE_BAR}]>`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kick changes in bar 4, the snare stays",
            response: {
              code: code('kick: s("<[bd ~ bd ~]!3 [bd bd [bd bd] [bd bd]]>")', snare(GROOVE_BAR), HATS),
            },
            expect: "pass",
          },
          {
            name: "the hats drop out at the end of bar 4",
            response: {
              code: code(
                KICK,
                snare(`<[${GROOVE_BAR}]!3 [sd sd sd sd]>`),
                'hats: s("<hh*8 hh*8 hh*8 [hh hh hh hh ~ ~ ~ ~]>").gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "toms in every bar, no < >",
            response: { code: withSnare("~ sd [ht mt] [lt lt]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
