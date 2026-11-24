// A1.L05 Grit (spec: content/specs/A1.md). Grit is damage you choose. Saturation (`.distort()`) pushes a sound
// until its peaks round off and flatten, which adds new harmonics: warm and thick a little, harsh a lot, and
// louder either way. A bitcrusher (`.crush()`) rebuilds the sound from fewer steps of level: the fewer bits, the
// grainier. `.coarse()` does the same to time and is left to the Make.
//
// A track lesson (contracts §2.6, AUTHORING §20.1): it opens after U09.CP with A1.L01–L04 behind it, so it may use
// what those unlock and the core through U09.CP, but no minor keys, dominant sevenths, the blues, swing or
// sevenths. It starts from the A1 loop as A1.L04 leaves it (a plucked, filtered sawtooth bass; the riff on a
// square with echoes on orbit 2; the snare in a big room) and ends with that loop, or the learner's own, gritty.
// The Make also shows the lo-fi tools this lesson unlocks beside the two above (`tb.drive`, `tb.density`,
// `snd.textures`): the ladder bass pushed with `.drive()`, crushed hats, and a crackle bed thinned with `.density()`.
//
// Unit song (content/unit-songs/A1.ts, "Turn the dial"): the Make's loop takes the opening and the ending of the A1
// song, which Oak plays as an old record (the band through a low-pass, its chords crushed, a crackle bed); it opens
// with the authored starter (`startFrom: 'oak'`: the lesson before is an optional side lesson the
// learner may have skipped, AUTHORING §23.9 rule 2).
// Make v2: the prompt invites `.drive()` and a crackle bed, and the checklist gains a suggestion, not required:
// `.drive()` or a noise bed (`uses tb.drive | snd.noise | snd.textures`). The required rule is unchanged.
//
// Superdough facts the lesson rests on (superdough@1.3.0, computed on its own curves): `.distort(x)` is the
// S-curve (1 + k)v / (1 + k|v|) with k = e^x − 1, after the filter; on the plucked bass it adds new partials at
// about −22 dB of the sound at .5, −16 dB at 1 and −11 dB at 2, and makes it 2 to 6 dB louder. `.crush(b)` rounds
// every point of the wave to 2^(b−1) steps a side: on the square riff 16 bits adds −95 dB (nothing heard), 8 bits
// −46 dB, 4 bits −25 dB. Both sit after the filter, so `.lpf()` cannot clean them up.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S4 grades what is heard on the bass: an `events` match on its notes (a muted bass has none) and the `controls`
//   matcher on `distort` within .5 of the target; it pins wrong answers that use the right function (too much
//   grit, the grit on the riff instead, the bass saturated and muted) and passes three other right answers;
// - the Make requires `control-set` with `anyOf` (saturation above .5, fewer than 7 bits, or `.coarse()` above 3,
//   each a value you hear) on any line, so `.distort(.2)`, `.crush(16)`, `.coarse(1)` and a muted gritty part
//   all fail;
// - feedback below rung 4 describes the sound, never the value.
import { defineLesson, type HintLadder, SOUND_COMPARE_OPTIONS } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The A1 loop's drums as A1.L04 leaves them: the snare in a big room. */
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd").room(.5).roomsize(6)';
const hats = (tail = "") => `hats: s("hh*8").gain(.5)${tail}`;
/** C | F under the Band's I | IV: root, root, the 5th below. */
const BASS_NOTES = "<[c2 ~ c2 g1] [f1 ~ f1 c2]>";
/** The bass as A1.L03 shaped it: a filtered sawtooth, plucked. */
const BASS_SOUND = '.s("sawtooth").lpf(500).decay(.2).sustain(0)';
const bass = (tail = "") => `bass: note("${BASS_NOTES}")${BASS_SOUND}${tail}`;
/** G G E G – E C – | A A F A – F C –: every note on a beat is in the Band's chord (C, then F). */
const RIFF = "<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>";
/** The riff as A1.L04 placed it: a filtered square echoing half a beat later on its own orbit. */
const RIFF_SOUND = '.s("square").lpf(2000).delay(.4).delaytime(.3).delayfeedback(.4).orbit(2)';
const riff = (tail = "") => `mel: n("${RIFF}").scale("C4:major")${RIFF_SOUND}${tail}.gain(.8)`;

/** The loop as A1.L04 leaves it: clean. The Make's starter. */
const CLEAN = code(KICK, SNARE, hats(), bass(), riff());
/** The hook: the bass saturated (turned down to match) and the hats crushed to five bits. */
const GRITTY = code(KICK, SNARE, hats(".crush(5)"), bass(".distort(1.5).gain(.6)"), riff());

/** S2: the bass over the drums, more saturation each bar. */
const MORE_EACH_BAR = code(KICK, SNARE, hats(), bass('.distort("<0 .5 1 2>")'));
/** S3: one low sine, round, then saturated, then flattened. */
const FLAT_TOPS = code('bass: note("c3").s("sine").distort("<0 1 3>").gain(.5).scope()');

/** S4: the placed loop with the bass's saturation to set; only the bass line differs. */
const warm = (bassTail: string, riffTail = "") => code(KICK, SNARE, hats(), bass(bassTail), riff(riffTail));
const WARM_STARTER = warm(".distort(⟪0⟫)");
const WARM_SOLUTION = warm(".distort(1)");

/** S5: the riff over the drums, sixteen bits in bar 1, four in bar 2. */
const FEWER_BITS = code(KICK, SNARE, hats(), riff('.crush("<16 4>")'));

/** S6: the placed loop twice; the second time the riff is crushed to four bits. */
const CRUSHED_SECOND_TIME = code(KICK, SNARE, hats(), bass(), riff('.crush("<16 16 4 4>")'));

/**
 * S7: an old record, made of this lesson's other tools. The bass under the ladder filter of Filters, pushed with
 * `.drive()` and turned down to match; the hats crushed to five bits; a crackle bed, its clicks thinned with
 * `.density()`.
 */
const OLD_RECORD = code(
  KICK,
  SNARE,
  hats(".crush(5)"),
  `bass: note("${BASS_NOTES}").s("sawtooth").lpf(500).lpq(8).ftype("ladder").drive(3).decay(.2).sustain(0).gain(.5)`,
  riff(),
  'fx: s("crackle").density(.2).gain(.5)',
);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const CHORDS = { band: "band.two-chord-vamp", tracks: ["chords"] } as const;

export default defineLesson({
  id: "A1.L05",
  version: 4,
  title: "Grit",
  objective:
    "I can add warmth or grit to a part with saturation and a bitcrusher, and keep it in proportion.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D06"],
  practises: [],
  terms: [
    { id: "term.saturation", step: "S3" },
    { id: "term.bitcrusher", step: "S5" },
  ],
  canDo: ["cd.code.grit"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Clean and gritty",
      minutes: 0.5,
      ui: { panels: ROLL, band: CHORDS },
      example: { id: "hook", code: GRITTY, bars: 2 },
      exercise: {
        kind: "listen",
        id: "clean-and-gritty",
        version: 1,
        role: "practice",
        prompt:
          "Loop 2 damages two parts on purpose, the bass and the hats. Listen to the bass in both loops, and listen for whether the damage makes it sound smaller or bigger.",
        skills: [{ skill: "D06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: CLEAN, caption: "Loop 1: the loop as Space left it.", bars: 2 },
          {
            code: GRITTY,
            caption: "Loop 2: the rest of the loop exactly as before.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Push the bass",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "push-the-bass",
        version: 1,
        role: "practice",
        prompt:
          'The bass over the drums with `.distort("<0 .5 1 2>")`: a bigger number each bar, starting from none. Predict what happens to the bass bar by bar, and pick it.',
        skills: [{ skill: "D06", w: 1 }],
        hints: null,
        tests: [],
        code: MORE_EACH_BAR,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "dirtier", label: "It gets dirtier, and louder" },
          { id: "darker", label: "It gets darker" },
          { id: "higher", label: "It gets higher" },
        ],
        correct: ["dirtier"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Flat tops",
      minutes: 1,
      ui: { panels: NONE },
      example: { id: "flat-tops", code: FLAT_TOPS, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "flat-tops",
        version: 1,
        role: "practice",
        prompt:
          "One low sine plays a bar each with `.distort()` at 0, 1 and 3, with the scope open. Watch the top of each wave and listen. Then answer both questions: in which bar the top is flat, and what flattening the sine added.",
        skills: [{ skill: "D06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch the top of the wave in each bar: one stays a round hill, one gets broader, one goes flat. A flat top is a new shape, and a new shape is a new colour.",
        },
        hints: ladder(
          "Watch the top of the wave bar by bar. In which bar does it stop looking like a round hill?",
          "A sine has one harmonic only. Change its shape and you change which harmonics it has: Waves & Harmonics showed which shape has which.",
          "A flattened sine starts to look like a square. What does a square have that a sine does not?",
        ),
        code: { starter: FLAT_TOPS },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "In which bar is the top of the wave flat?", correct: 3 },
          {
            q: "choice",
            prompt: "What did flattening the round sine add?",
            options: [
              { id: "harmonics", label: "More harmonics: it buzzes" },
              { id: "lower", label: "A lower note" },
              { id: "echo", label: "An echo" },
            ],
            correct: ["harmonics"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 3, choice: ["harmonics"] } },
            expect: "pass",
          },
          {
            name: "bar 2 for the flat top",
            response: { answer: { number: 2, choice: ["harmonics"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a lower note",
            response: { answer: { number: 3, choice: ["lower"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Warm the bass",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "warm-the-bass",
        version: 1,
        role: "check",
        prompt:
          "Your bass is clean; the target's is saturated, a warm growl under the riff. Change the number in `.distort()` on the bass line by ear to match it. Keep the bass playing, and turn it down a little only if it jumps out. Done when your saturation is close to the target's.",
        skills: [{ skill: "D06", w: 1 }],
        code: { starter: WARM_STARTER },
        reference: { solutions: [WARM_SOLUTION], bars: 2 },
        // What is heard: the bass's notes must still sound (a muted bass has none), and its saturation must be
        // within .5 of the target's. The riff and the drums are not compared.
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["bass"] },
            { m: "controls", track: "bass", controls: [{ control: "distort", scale: "linear", tol: 0.5 }] },
          ],
        },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: no bass note is heard here. Keep the bass playing as loud as the target's, or close to it.",
          "melody.wrong-degree": "Bar {bar}, {beatLabel}: the bass's notes changed. Change its sound only.",
        },
        hints: ladder(
          "Compare the target's low notes with yours. Are the target's a little rough, or torn apart?",
          "`.distort()` sets how hard the bass is pushed: 0 is clean, and every step up adds more new harmonics and more level.",
          "Bar 4 of Push the bass was far past a warm growl, and bar 1 was clean. The target sits between them, nearer the clean end.",
        ),
        tests: [
          { name: "reference", response: { code: WARM_SOLUTION }, expect: "pass" },
          { name: "a little more", response: { code: warm(".distort(1.2)") }, expect: "pass" },
          {
            name: "a little less, turned down to match",
            response: { code: warm(".distort(.8).gain(.7)") },
            expect: "pass",
          },
          { name: "at the top of the window", response: { code: warm(".distort(1.4)") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: warm(".distort(0)") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "right function, far too much: a rasp",
            response: { code: warm(".distort(4)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "right function, wrong line: the riff saturated, the bass left clean",
            response: { code: warm(".distort(0)", ".distort(1)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "right value, then the bass muted",
            response: { code: warm(".distort(1).gain(0)") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "the bass's notes changed as well",
            response: {
              code: code(
                KICK,
                SNARE,
                hats(),
                `bass: note("<[c2 ~ c2 g1] [f1 ~ f1 a1]>")${BASS_SOUND}.distort(1)`,
                riff(),
              ),
            },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Fewer bits",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "fewer-bits",
        version: 1,
        role: "practice",
        prompt:
          "The riff over the drums. `.crush()` keeps a number of bits for each point of the wave: 16 in bar 1, 4 in bar 2. Listen to the riff's long notes, and pick how bar 2 sounds next to bar 1.",
        skills: [{ skill: "D06", w: 1 }],
        hints: ladder(
          "Listen to the riff's long notes in each bar: smooth, or full of fine grain?",
          "Each bit fewer halves the number of steps the wave can stand on. Sixteen bits is the detail of a CD.",
          "Bar 1 sounds as it did in Space. Listen for what bar 2 adds.",
        ),
        stimulus: { src: "code", code: FEWER_BITS, bars: 2, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "choice", options: [...SOUND_COMPARE_OPTIONS.grit] },
        correct: { choice: ["dirtier"] },
        feedbackText: {
          "id.wrong":
            "Listen to bar 2 again: a fine buzz rides on every note and on the echoes. Bar 1 has none of it.",
        },
        tests: [
          { name: "dirtier", response: { answer: { choice: ["dirtier"] } }, expect: "pass" },
          {
            name: "cleaner",
            response: { answer: { choice: ["cleaner"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Which grit",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-grit",
        version: 1,
        role: "check",
        prompt:
          "The loop plays twice. The second time, only the riff changes. Listen to the riff and its echoes, and pick what happened to it.",
        skills: [{ skill: "D06", w: 1 }],
        hints: [
          {
            text: "Compare the riff the second time with the first. Is it louder and thicker, grainier, or duller?",
          },
          {
            text: "Saturation rounds the wave's peaks: warmer, thicker, louder. Crushing puts it on a staircase: a fine, hard grain. A closed filter takes the top off: duller.",
          },
          { text: "Hear it again, slower, and listen to the riff's echoes.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: CRUSHED_SECOND_TIME, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "saturated", label: "Saturated: warmer, thicker, louder" },
            { id: "crushed", label: "Bit-crushed: grainy, lo-fi" },
            { id: "darker", label: "Darker: the filter closed" },
          ],
        },
        correct: { choice: ["crushed"] },
        feedbackText: {
          "id.wrong":
            "Not this one. The riff kept its level, and nothing was taken off its top; what came in was a fine, hard grain on every note, like an old game console.",
        },
        srs: [{ family: "fam.snd.params", mode: "review-if-due" }],
        tests: [
          { name: "crushed", response: { answer: { choice: ["crushed"] } }, expect: "pass" },
          {
            name: "heard as saturation",
            response: { answer: { choice: ["saturated"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "heard as a closed filter",
            response: { answer: { choice: ["darker"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Dirty it up",
      minutes: 2.75,
      ui: { panels: ROLL, band: CHORDS },
      example: { id: "old-record", code: OLD_RECORD, bars: 2 },
      exercise: {
        kind: "code-make",
        id: "dirty-it-up",
        // v2 (unit songs): the checklist gains `.drive()` or a noise bed, the lo-fi tools this lesson unlocks (not
        // required), and the prompt invites them for the song's opening and ending.
        version: 2,
        role: "practice",
        prompt:
          "This loop is clean. Give at least one part grit you can hear: saturate it with `.distort()`, or crush it with `.crush()` or `.coarse()`. Turn a saturated part down with `.gain()` so it does not win by being louder. `.drive()` and a `crackle` bed are up to you. Your loop opens and closes your song.",
        skills: [{ skill: "D06", w: 1 }],
        code: { starter: CLEAN },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "grit-you-can-hear",
            label:
              "A heard part with grit: .distort() above 0.5, .crush() under 7 bits, or .coarse() above 3",
            required: true,
            skills: ["D06"],
            rule: "custom",
            fn: "control-set",
            // Each value is past where it starts to be heard: saturation above .5 (new harmonics about −22 dB on
            // the bass), fewer than 7 bits (8 bits is about −45 dB on the riff), `.coarse()` above 3.
            params: {
              anyOf: [
                { control: "distort", above: 0.5 },
                { control: "crush", below: 7 },
                { control: "coarse", above: 3 },
              ],
            },
          },
          {
            id: "a-second-grit",
            label: "A part crushed (.crush() under 7 bits) or coarsened (.coarse() above 3)",
            required: false,
            skills: ["D06"],
            rule: "custom",
            fn: "control-set",
            params: {
              anyOf: [
                { control: "crush", below: 7 },
                { control: "coarse", above: 3 },
              ],
            },
          },
          {
            id: "a-curve-of-your-own",
            label: "A saturation curve chosen with .distorttype()",
            required: false,
            skills: ["D06"],
            rule: "uses",
            tool: "tb.distorttype",
          },
          {
            id: "drive-or-a-bed",
            label: "`.drive()`, or a bed of noise such as `crackle`, `vinyl` or `tape`",
            required: false,
            skills: ["D06"],
            rule: "uses",
            tool: ["tb.drive", "snd.noise", "snd.textures"],
            min: 1,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Choose one part to roughen first: the bass, the hats or the riff. Which would sound best with a rough edge?",
          '`.distort()` saturates a part, `.crush()` keeps fewer bits, `.coarse()` holds each point of the wave for longer. `.distorttype("diode")` or `"fold"` changes how the saturation bends the wave.',
          "Saturate the bass about as much as the target in Warm the bass, then turn its `.gain()` down until it sits where it did.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: CLEAN },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the bass saturated and turned down",
            response: { code: code(KICK, SNARE, hats(), bass(".distort(2).gain(.5)"), riff()) },
            expect: "pass",
          },
          {
            name: "only the hats, crushed to five bits",
            response: { code: code(KICK, SNARE, hats(".crush(5)"), bass(), riff()) },
            expect: "pass",
          },
          {
            name: "the riff coarsened",
            response: { code: code(KICK, SNARE, hats(), bass(), riff(".coarse(6)")) },
            expect: "pass",
          },
          {
            name: "a saturation curve of its own",
            response: {
              code: code(KICK, SNARE, hats(), bass('.distorttype("diode").distort(1).gain(.7)'), riff()),
            },
            expect: "pass",
          },
          { name: "beyond the brief: the hook", response: { code: GRITTY }, expect: "pass" },
          {
            name: "beyond the brief: an old record, the ladder bass driven, crushed hats and a crackle bed",
            response: { code: OLD_RECORD },
            expect: "pass",
          },
          {
            name: "right function, too little: saturation you cannot hear",
            response: { code: code(KICK, SNARE, hats(), bass(".distort(.2)"), riff()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "right function, nothing heard: sixteen bits",
            response: { code: code(KICK, SNARE, hats(".crush(16)"), bass(), riff()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "right function, nothing heard: coarse 1",
            response: { code: code(KICK, SNARE, hats(), bass(), riff(".coarse(1)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the gritty part muted",
            response: { code: code(KICK, SNARE, hats(), bass(".distort(2).gain(0)"), riff()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the gritty part turned down until it is not heard",
            response: { code: code(KICK, SNARE, hats(), bass(".distort(2).gain(.03)"), riff()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the gritty part masked out",
            response: { code: code(KICK, SNARE, hats(), bass('.distort(2).mask("0")'), riff()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
