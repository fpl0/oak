// R3.L04 Montuno & Tumbao Layering (spec: content/specs/R3.md). Over the son clave the bass and the piano each have
// a figure. The tumbao skips the downbeat and plays the "and" of 2 and beat 4, where it already sounds the NEXT
// chord's root, so the bass pulls the harmony forward. The montuno is a two-bar syncopated piano figure, and like a
// tune it faces the clave: more of its hits meet the clave as written than with the clave turned round.
//
// Written for the learner at the gate (AUTHORING §20.1): the rhythm track opens after U13.CP and runs in a fixed
// order, so R3.L04 always follows R1, R2 and R3.L01–L03, while U14–U17 may be unfinished. The lesson uses only what
// U13.CP guarantees, the R track's own tools and words (anticipation from U13.L01, the clave from R3.L02), and its
// own two terms. The montuno here is Oak's own figure, not a universal formula: prose says "a montuno".
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - every required rule checks what is HEARD: the tumbao's two attacks in every bar and nothing else (`onsets`
//   `equals` `perBar`), and its pitches against the target (`events`, octave-free), so the beat-4 note must be the
//   next chord's root; the montuno is read against the clave in every two-bar window (`clave-aligned`: it meets at
//   least three strokes, more than with the clave's bars swapped, and its two bars differ);
// - each graded step pins a WRONG answer that uses the right function (the tumbao on its own bar's roots; the right
//   tumbao at `.gain(0)`; the montuno moved by `.late(2)`, a whole period, so nothing changes; the montuno turned
//   round AND the clave turned round, which the brief does not allow; in the Make the hook's montuno at `.late(1)`,
//   which crosses), and at least three OTHER right answers.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type IdentifyEx, type Rat, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const tempo = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const TEMPO = tempo(BPM);
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The son clave 3-2 on the rimshot (R3.L02): bar A {0, 3/8, 3/4}, bar B {1/4, 1/2}. Given in every step. */
const CLAVE = 'perc: s("<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>").gain(.8)';
/** The cowbell on the four beats: the ruler the other lines are heard against. */
const BELL = 'perc2: s("cb*4").gain(.4)';

/** The tumbao over C then G7: the 5th on the "and" of 2, the NEXT chord's root on beat 4 (G1, then C2). */
const TUMBAO = "<[~ ~ ~ g2 ~ ~ g1 ~] [~ ~ ~ d2 ~ ~ c2 ~]>";
/** The starter's bass: each chord's root on beats 1 and 3. */
const ROOTS = "<[c2 ~ ~ ~ c2 ~ ~ ~] [g1 ~ ~ ~ g1 ~ ~ ~]>";
const bass = (pattern: string, extra = "") => `bass: note("${pattern}").s("upright")${extra}`;

/**
 * The montuno in thirds (Oak's own figure). Bar A over C: 0, 3/8, 1/2, 3/4; bar B over G7: 1/8, 1/4, 1/2, 5/8,
 * 7/8, its last dyad (E G) anticipating C. Against the clave 3-2 it meets 3 + 2 = 5 strokes; with the clave's bars
 * swapped it would meet 1 (evaluated).
 */
const BAR_A = "[[c4,e4] ~ ~ [e4,g4] [c4,e4] ~ [e4,g4] ~]";
const BAR_B = "[~ [d4,f4] [b3,d4] ~ [d4,f4] [b3,d4] ~ [e4,g4]]";
const MONTUNO = `<${BAR_A} ${BAR_B}>`;
/** The same two bars in the other order: against a 3-2 clave it crosses. */
const CROSSED = `<${BAR_B} ${BAR_A}>`;
const keys = (pattern: string, extra = "", sound = "piano") =>
  `keys: note("${pattern}").s("${sound}")${extra}`;

const HOOK = code(CLAVE, BELL, bass(TUMBAO), keys(MONTUNO));
const CLAVE_AND_BELL = code(CLAVE, BELL);

/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

// --- S3: the tumbao ------------------------------------------------------------------------------------------

const S3_STARTER = code(CLAVE, BELL, `bass: note("⟪${ROOTS}⟫").s("upright")`, keys(MONTUNO));
const s3 = (bassLine: string) => code(CLAVE, BELL, bassLine, keys(MONTUNO));
const S3_SOLUTION = s3(bass(TUMBAO));
/** The tumbao's two places in every bar: the "and" of 2 and beat 4, and nothing on beat 1. */
const TUMBAO_ONSETS: Rat[] = [
  [3, 8],
  [3, 4],
];
const BASS_TUMBAO: RubricRule = {
  id: "bass-tumbao",
  label: "The bass plays only on the “and” of 2 and on beat 4, in every bar",
  required: true,
  skills: ["B04"],
  rule: "onsets",
  track: "bass",
  equals: TUMBAO_ONSETS,
  perBar: true,
};

// --- S4: the montuno turned round --------------------------------------------------------------------------

/** No bass in this step: only the clave, the cowbell and the piano, so the piano's order is all you hear. */
const S4_STARTER = code(CLAVE, BELL, `keys: ⟪note("${CROSSED}").s("piano")⟫`);
const s4 = (keysLine: string, claveLine = CLAVE) => code(claveLine, BELL, keysLine);
const S4_SOLUTION = s4(keys(MONTUNO));
const FACES: RubricRule = {
  id: "keys-face-the-clave",
  label: "In every two bars, at least 4 piano chords land with a rimshot, more than land between them",
  required: true,
  skills: ["R18"],
  rule: "custom",
  fn: "clave-aligned",
  // Four strokes, not three: the montuno turned round meets five; the crossed one moved by an eighth
  // (`.late(1/8)`) meets three and lands between the clave's other strokes, which is not turning it round.
  params: { track: "keys", clave: "perc", min: 4 },
};

// --- S5: with the clave or crossed, by ear -------------------------------------------------------------------

const EAR_OPTIONS = [
  { id: "with", label: "With the clave" },
  { id: "crossed", label: "Crossed" },
] as const;
type EarAnswer = (typeof EAR_OPTIONS)[number]["id"];
const earCode = (bpm: number, montuno: string) => `${tempo(bpm)}${[CLAVE, BELL, keys(montuno)].join("\n")}`;
const earHints = (): HintLadder =>
  ladder(
    "Listen to the clave first and find its bar of three hits.",
    "In the bar with three rimshots, how many piano chords land exactly with a rimshot? Count, then do the same in the other bar.",
    "A piano that faces the clave lands with most of its hits; a crossed one lands between them and only meets one.",
  );
const earPart = (
  id: string,
  prompt: string,
  bpm: number,
  montuno: string,
  answer: EarAnswer,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  ...(bpm === BPM ? {} : { bpm }),
  prompt,
  skills: [{ skill: "R18", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: earCode(bpm, montuno), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...EAR_OPTIONS] },
  correct: { choice: [answer] },
  feedbackText: {
    "id.wrong":
      "Not that one. Follow the clave's bar of three and listen to whether the piano lands with it, then listen once more.",
  },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: `heard as ${answer === "with" ? "crossed" : "with"}`,
      response: { answer: { choice: [answer === "with" ? "crossed" : "with"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

// --- S6: the Make ------------------------------------------------------------------------------------------

/** The starter: the clave and the cowbell given, the bass on the roots, block chords on every beat. */
const BLOCKS = 'keys: note("<[c4,e4,g4] [b3,d4,f4,g4]>").struct("x x x x").s("piano")';
const MAKE_STARTER = code(CLAVE, BELL, bass(ROOTS), BLOCKS);
const make = (...lines: string[]) => code(...lines);
const MAKE_FACES: RubricRule = {
  id: "montuno-faces-the-clave",
  label:
    "In every two bars the piano's two bars differ, and at least 3 of its chords land with a clave hit, more than land between them",
  required: true,
  skills: ["R18"],
  rule: "custom",
  fn: "clave-aligned",
  params: { track: "keys", clave: "perc", min: 3 },
};
/**
 * The hand drums (`conga` and `bongo`, unlocked here; sound pack v4): the conga on beat 2 and on beat 4 and its "and",
 * the bongos on every eighth, louder on the beats, over the clave and the cowbell.
 */
const CONGAS = 'perc3: s("~ ~ conga ~ ~ ~ conga conga").gain(.6)';
const BONGOS = 'perc4: s("bongo*8").velocity("[.9 .5]*4").gain(.4)';
const HAND_DRUMS = code(CLAVE, BELL, CONGAS, BONGOS);
/** Not required: congas or bongos in the band, the sounds this lesson unlocks. */
const WITH_HAND_DRUMS: RubricRule = {
  id: "hand-drums",
  label: "Congas or bongos play in a line you can hear: the sound `conga` or `bongo`",
  required: false,
  skills: ["R18"],
  rule: "uses",
  tool: ["snd.drum.conga", "snd.drum.bongo"],
  min: 1,
};
/** In F: the montuno over F then C7, the tumbao on C then F (the next chord's root on beat 4). */
const F_MONTUNO = "<[[f4,a4] ~ ~ [a4,c5] ~ [f4,a4] [a4,c5] ~] [~ ~ [g4,bb4] ~ [e4,g4] ~ ~ [a4,c5]]>";
const F_TUMBAO = "<[~ ~ ~ c3 ~ ~ c2 ~] [~ ~ ~ g2 ~ ~ f2 ~]>";

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R3.L04",
  version: 4,
  title: "Montuno & Tumbao Layering",
  objective: "I can layer a montuno and a tumbao on the clave.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R18", "B04"],
  terms: [
    { id: "term.tumbao", step: "S2" },
    { id: "term.montuno", step: "S4" },
  ],
  canDo: ["cd.code.montuno"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A son band",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "son", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-son-band",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the whole son band, then its clave and cowbell alone, then the band again. When the bass and the piano come back, notice whether the groove sits on the beat or leans ahead, and where the bass lands against beat 1.",
        skills: [{ skill: "R18", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "The whole groove over C and G7: clave 3-2, cowbell, bass and piano.",
            bars: 4,
          },
          {
            code: CLAVE_AND_BELL,
            caption: "Only the clave and the cowbell: the two-bar frame.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The bass and the piano back in. Does the bass ever play on beat 1?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Where the bass lands",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-bass", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-bass-lands",
        version: 1,
        role: "practice",
        prompt:
          "Run the groove and read the bass's row on the roll; the piano plays C in bar 1 and G7 in bar 2. Then answer: on which eighth of bar 1 the bass plays first, and whose root its note on beat 4 is.",
        skills: [{ skill: "B04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the eighth notes of bar 1 with the cowbell, two to a beat, to find where the bass starts; then look at which chord the piano plays in the bar after the bass's last note.",
        },
        hints: ladder(
          "Count the eighths of bar 1 from 1 to 8 with the cowbell and find the first bass note.",
          "Count the eighths of one bar 1 to 8: each beat is a number and its “and”. Then name the last bass note of bar 1.",
          "The last bass note of bar 1 is G. Which chord comes in bar 2?",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "Count the eighth notes of bar 1 from 1 to 8. On which one does the bass play first?",
            correct: 4,
          },
          {
            q: "choice",
            prompt: "The bass's note on beat 4 of bar 1 is G. Whose root is it?",
            options: [
              { id: "own", label: "C's: the chord of its own bar" },
              { id: "next", label: "G7's: the chord of the next bar" },
              { id: "neither", label: "Neither chord's" },
            ],
            correct: ["next"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 4, choice: ["next"] } }, expect: "pass" },
          {
            name: "on beat 1",
            response: { answer: { number: 1, choice: ["next"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "its own bar's chord",
            response: { answer: { number: 4, choice: ["own"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Pull the chords forward",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "pull-the-chords-forward",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the bass, which plays each chord's root on beats 1 and 3. In every bar: nothing on beat 1, its own chord's 5th on the “and” of 2, and on beat 4 the root of the chord that comes next. Done when the bass matches the target.",
        skills: [
          { skill: "B04", w: 0.6 },
          { skill: "R18", w: 0.4 },
        ],
        code: { starter: S3_STARTER },
        reference: { solutions: [S3_SOLUTION], bars: 4 },
        // Heard in every bar: the two places and nothing else; and the notes against the target, octave-free, so
        // the beat-4 note has to be the next chord's root.
        matcher: {
          m: "all",
          of: [
            { m: "rubric", rules: [BASS_TUMBAO] },
            {
              m: "events",
              pitch: "octave-free",
              rhythm: "onsets",
              durations: false,
              tracks: ["bass"],
            },
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Count the eighth notes of one bar with the cowbell and listen for which ones the bass takes in the target.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the right place, another note than the target's. Listen to the target's note there: does it belong to this bar's chord, or to the next one?",
          "melody.missing-note": "Bar {bar}: the target's bass has a note yours does not play yet.",
          "melody.extra-note": "Bar {bar}, {beatLabel}: your bass plays where the target's is silent.",
        },
        hints: ladder(
          "Find the bass notes in the target that sound before the chord they belong to.",
          "Slot 4 of each bar is the “and” of 2 and slot 7 is beat 4. The note on beat 4 belongs to the next bar's chord, and the bars alternate C and G7.",
          "Bar 1 ends on G, the root of G7. Bar 2 ends on the root of the chord that follows it when the loop comes round.",
        ),
        tests: [
          { name: "reference", response: { code: S3_SOLUTION }, expect: "pass" },
          {
            name: "the notes in other octaves",
            response: { code: s3(bass("<[~ ~ ~ g1 ~ ~ g2 ~] [~ ~ ~ d2 ~ ~ c3 ~]>")) },
            expect: "pass",
          },
          {
            name: "written with weights",
            response: { code: s3(bass("<[~@3 g2@3 g1@2] [~@3 d2@3 c2@2]>")) },
            expect: "pass",
          },
          {
            name: "notes and rhythm apart, with struct, on the fingerbass",
            response: {
              code: s3('bass: note("<[g2 g1] [d2 c2]>").struct("~ ~ ~ x ~ ~ x ~").s("fingerbass")'),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S3_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right places on their own bar's roots: no anticipation",
            response: { code: s3(bass("<[~ ~ ~ g2 ~ ~ c2 ~] [~ ~ ~ d2 ~ ~ g1 ~]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the right places, the “and” of 2 on the next chord's 5th: another tumbao than the one read",
            response: { code: s3(bass("<[~ ~ ~ d2 ~ ~ g1 ~] [~ ~ ~ g1 ~ ~ c2 ~]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "a note on beat 1 as well",
            response: { code: s3(bass("<[c2 ~ ~ g2 ~ ~ g1 ~] [g1 ~ ~ d2 ~ ~ c2 ~]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right tumbao, silent: .gain(0)",
            response: { code: s3(bass(TUMBAO, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Turn the piano round",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "turn-the-piano-round",
        version: 1,
        role: "check",
        prompt:
          "The piano's two bars are in the wrong order, so they land between the rimshots. Turn the piano round so the bar that lands with the clave's three rimshots plays under them. Keep the clave and the notes inside each bar. Done when the piano faces the clave.",
        skills: [{ skill: "R18", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        // Read against the clave in every two-bar window: at least three strokes met, more than with the clave's
        // bars swapped, and two bars that differ. Only the piano's line may change.
        matcher: { m: "rubric", rules: [FACES] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. In the clave's bar of three, count the piano chords that land exactly with a rimshot.",
        },
        hints: ladder(
          "Compare each piano bar with the clave's bar of three: one bar lands with more of its rimshots.",
          "The piano's line alternates two bars with `< >`. The clave's bar of three comes first; the piano bar that meets it should come first too.",
          "Either swap the two bars inside `< >`, or keep them and move the whole line by one bar in time.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "moved one bar later: .late(1)",
            response: { code: s4(keys(CROSSED, ".late(1)")) },
            expect: "pass",
          },
          {
            name: "moved one bar earlier: .early(1)",
            response: { code: s4(keys(CROSSED, ".early(1)")) },
            expect: "pass",
          },
          {
            name: "the bars swapped, the thirds turned upside down",
            response: {
              code: s4(
                keys(
                  "<[[e4,c5] ~ ~ [g4,e5] [e4,c5] ~ [g4,e5] ~] [~ [f4,d5] [d4,b4] ~ [f4,d5] [d4,b4] ~ [g4,e5]]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, a whole period: .late(2) lands where it was",
            response: { code: s4(keys(CROSSED, ".late(2)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function, an eighth: the crossed figure .late(1/8) meets three strokes, not turned round",
            response: { code: s4(keys(CROSSED, ".late(1/8)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right bars, silent: .gain(0)",
            response: { code: s4(keys(MONTUNO, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the piano turned round and the clave turned round too",
            response: {
              code: s4(
                keys(MONTUNO),
                'perc: s("<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>").late(1).gain(.8)',
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
      kind: "ear",
      title: "With the clave, or crossed",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "with-or-crossed",
        version: 1,
        role: "check",
        prompt:
          "Three grooves: the clave, the cowbell and the piano, with the same notes every time. For each, pick whether the piano faces the clave or crosses it.",
        skills: [{ skill: "R18", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.rhy.clave", mode: "review-if-due" }],
        tests: [],
        parts: [
          earPart("groove-one", "Groove 1.", BPM, CROSSED, "crossed"),
          earPart("groove-two", "Groove 2.", BPM, MONTUNO, "with"),
          earPart("groove-three", "Groove 3, a little faster.", 112, CROSSED, "crossed"),
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your son",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.son-montuno", tracks: ["drums"] },
      },
      example: { id: "hand-drums", code: HAND_DRUMS, bars: 2 },
      exercise: {
        kind: "code-make",
        id: "your-son",
        // v2 (unit songs): the checklist gains the congas or bongos, the sounds this lesson unlocks (not required).
        version: 2,
        role: "practice",
        title: "Son montuno",
        prompt:
          "Write the piano and the bass for your song's vamp, over the clave 3-2 and Oak's drums. Give the piano a two-bar figure that faces the clave, C in bar 1 and G7 in bar 2, its two bars different. Also on the checklist: a tumbao bass, the cowbell on all four beats, and congas or bongos.",
        skills: [
          { skill: "R18", w: 0.6 },
          { skill: "B04", w: 0.4 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          MAKE_FACES,
          {
            id: "bass-tumbao",
            label: "The bass plays the “and” of 2 and beat 4 in every bar, and not beat 1",
            required: false,
            skills: ["B04"],
            rule: "onsets",
            track: "@bass",
            contains: TUMBAO_ONSETS,
            excludes: [[0, 1]],
            perBar: true,
          },
          {
            id: "bell-on-the-beats",
            label: "The cowbell plays on all four beats of every bar",
            required: false,
            skills: ["R18"],
            rule: "onsets",
            track: "perc2",
            contains: [
              [0, 1],
              [1, 4],
              [1, 2],
              [3, 4],
            ],
            perBar: true,
          },
          WITH_HAND_DRUMS,
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The starter's piano plays the same thing on every beat of both bars. Give its two bars different rhythms.",
          "Write the piano's two bars apart inside `< >`, and give the bar under the clave's three hits most of its chords on those hits.",
          "The bar under the clave's three: hits on its beat 1, its “and” of 2 and its beat 4. The bar under the two: hits on its beats 2 and 3.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the lesson's montuno over the starter's bass",
            response: { code: make(CLAVE, BELL, bass(ROOTS), keys(MONTUNO)) },
            expect: "pass",
          },
          {
            name: "the tumbao and the montuno on the Rhodes, as triads",
            response: {
              code: make(
                CLAVE,
                BELL,
                bass(TUMBAO),
                keys(
                  "<[[c4,e4,g4] ~ ~ [e4,g4,c5] [c4,e4,g4] ~ [e4,g4,c5] ~] [~ [d4,f4,g4] [b3,d4,f4] ~ [d4,f4,g4] [b3,d4,f4] ~ [e4,g4,c5]]>",
                  "",
                  "rhodes",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "another key: F and C7, a montuno of its own",
            response: { code: make(CLAVE, BELL, bass(F_TUMBAO), keys(F_MONTUNO)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a shaker on the eighths, the clave and bell softer, 108 BPM",
            response: {
              code: make(
                'perc: s("<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>").gain(.6)',
                'perc2: s("cb*4").gain(.3)',
                'perc3: s("sh*8").velocity("[.8 .4]*4").gain(.4)',
                bass(TUMBAO),
                keys(MONTUNO),
              ).replace(`setcpm(${BPM}/4)`, "setcpm(108/4)"),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: the tumbao, the montuno, congas and bongos",
            response: { code: make(CLAVE, BELL, bass(TUMBAO), keys(MONTUNO), CONGAS, BONGOS) },
            expect: "pass",
          },
          {
            name: "the right figure, crossed: its two bars in the other order",
            response: { code: make(CLAVE, BELL, bass(TUMBAO), keys(CROSSED)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right figure moved one bar: .late(1) crosses it",
            response: { code: make(CLAVE, BELL, bass(TUMBAO), keys(MONTUNO, ".late(1)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a one-bar figure repeated: both bars alike",
            response: {
              code: make(CLAVE, BELL, bass(TUMBAO), keys("[[c4,e4] ~ ~ [e4,g4] ~ ~ [e4,g4] ~]")),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the montuno, silent: .gain(0)",
            response: { code: make(CLAVE, BELL, bass(TUMBAO), keys(MONTUNO, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
