// A1.L06 Movement (spec: content/specs/A1.md). A sound that moves stays alive. A slow wave, too slow to hear as
// a pitch, can push a setting up and down while a note sounds: that slow wave is an LFO. On the pitch it is
// vibrato (`.vib()` how many times a second, `.vibmod()` how far, in semitones each way); on a sweeping notch
// filter it is a phaser (`.phaser()`); on the level, tremolo (`.tremolosync()`, dips per bar); on the cutoff, a
// filter sweep (`.lprate()` and `.lpdepth()` with `.lpf()`).
//
// A track lesson (contracts §2.6, AUTHORING §20.1): it opens after U09.CP and A1.L05, so it may use what A1.L01–L05
// unlock and the core through U09.CP (stacks with `,`), but no minor keys, dominant sevenths, the blues, swing or
// sevenths. The word "modulation" is U17's (a key change) and is not used here. The A1 loop as A1.L04 left it
// gains a held pad and a long-note lead in place of the riff, because movement is heard on notes that last.
// The Make also shows the movement this lesson unlocks beside the four (`tb.wt`): the pad on `wt_morph`, a wavetable
// of many shapes in a row, swept by an LFO (`.wtrate()` times a second, `.wtdepth()` how far). The required rule
// counts the four movements only, and the prose says so.
//
// Unit song (content/unit-songs/A1.ts, "Turn the dial"): the Make's loop takes both build-ups of the A1 song, where
// Oak's chords keep pulsing under the learner's pad (`oakKeeps`); it opens with the authored starter, because the
// earlier loops have no pad and no long-note lead.
// Make v2: the prompt invites a `wt_morph` pad swept by `.wtrate()`, and the checklist gains a suggestion, not
// required: a wavetable sweep (`uses tb.wt`). The required rule is unchanged, so a sweep alone does not pass.
//
// Superdough facts the lesson rests on (superdough@1.3.0): `getVibratoOscillator` builds the vibrato only when
// `vib` > 0, `vibmod` semitones each way (0.5 when left out); the phaser only with a rate and a depth above 0
// (0.75 when left out); `.tremolosync(n)` dips the level n times a bar (rate = cps × n), `.tremolodepth()` how far
// (1 when left out); the filter's LFO exists only on a line with `.lpf()` (`createFilter`, cutoff set), at
// `lprate` times a second, or once a bar when only `lpdepth` is set.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S4 grades what is heard on the lead: an `events` match on its notes (a muted lead has none) and the
//   `controls` matcher on `vib` (within 1.5 a second) and `vibmod` (within .15 of a semitone); it pins wrong
//   answers that use the right function (no depth, a buzz thirty times a second, the default depth left in) and
//   passes three other right answers;
// - the Make requires `control-set` with `anyOf` (vibrato, phaser, tremolo, filter sweep), each judged with its
//   silencers: `.vibmod(0)`, `.tremolodepth(0)`, `.lprate()` with no `.lpf()` or with `.lpdepth(0)`, a muted or
//   masked part all fail;
// - feedback below rung 4 describes the sound, never the value.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The A1 loop's drums and bass as A1.L04 leaves them. */
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd").room(.5).roomsize(6)';
const HATS = 'hats: s("hh*8").gain(.5)';
const BASS = 'bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).decay(.2).sustain(0)';
const RHYTHM = [KICK, SNARE, HATS, BASS];
/** C E G, then C F A: the Band's C and F, held for a bar each. */
const PAD_CHORDS = "<[c4,e4,g4] [c4,f4,a4]>";
const pad = (tail = "") => `pad: note("${PAD_CHORDS}").s("sawtooth").lpf(900)${tail}.gain(.3)`;
/** G5 held for three beats, then E5 | A5, then F5: chord tones of C, then of F. */
const LEAD = "<[4@3 2] [5@3 3]>";
const lead = (tail = "") => `mel: n("${LEAD}").scale("C5:major").s("triangle")${tail}`;

/** The loop with a pad and a lead, both still. The Make's starter. */
const STILL = code(...RHYTHM, pad(), lead());
/** The hook: the lead sings with vibrato and the pad's cutoff opens and closes slowly. */
const MOVING = code(...RHYTHM, pad(".lprate(.5).lpdepth(.6)"), lead(".vib(5).vibmod(.25)"));

/** S2: one long G, still in bar 1, then with a wobble. */
const WOBBLE = code('mel: note("g4@4").s("triangle").vib("<0 5>")');
/** S3: the wobble twice a second in bar 1, six times in bar 2, the same small width. */
const HOW_FAST = code('mel: note("g4@4").s("triangle").vib("<2 6>").vibmod(.3)');

/** S4: the loop with its lead still; the lead's movement goes at the end of its line. */
const sing = (tail: string) => code(...RHYTHM, pad(), lead(tail));
const SING_STARTER = sing("⟪⟫");
const SING_SOLUTION = sing(".vib(5).vibmod(.3)");

/** S5: one chord a bar on three lines, each with another setting moved: a phaser, the level, the cutoff. */
const THREE_MOVES = code(
  'pad: note("<[c4,e4,g4] ~ ~>").s("sawtooth").phaser(2).gain(.4)',
  'keys: note("<~ [c4,e4,g4] ~>").s("sawtooth").tremolosync(4).gain(.4)',
  'chords: note("<~ ~ [c4,e4,g4]>").s("sawtooth").lpf(800).lprate(1).gain(.4)',
);

/** S6: the pad over the drums, its brightness moved by a slow wave. */
const WHAT_MOVES = code(KICK, SNARE, HATS, pad(".lprate(1).lpdepth(.8)").replace(".lpf(900)", ".lpf(700)"));

/** S7: the pad on a wavetable whose shape an LFO sweeps once a second, the lead still. */
const MORPH = code(
  ...RHYTHM,
  `pad: note("${PAD_CHORDS}").s("wt_morph").wtrate(1).wtdepth(1).gain(.3)`,
  lead(),
);

/** The Make, beyond the brief: the pad on `wt_morph`, its shape swept (`tb.wt`), under a lead with vibrato. */
const MORPHING = code(
  ...RHYTHM,
  `pad: note("${PAD_CHORDS}").s("wt_morph").wtrate(.5).wtdepth(1).gain(.3)`,
  lead(".vib(5).vibmod(.25)"),
);

/**
 * S8 (Oak 2.0, Rhythm of Automation): the chords pulse in short eighths, C then F, over the drums and the bass, and
 * their cutoff moves. A slow wave glides it: every chord gets a new value. Steps hold a value for two chords or
 * more and then jump, so the movement itself has a rhythm. `stepped-control` reads the cutoff each chord starts with:
 * at least three different held values, each held for two chords or more, the jumps clear (a fifth of the range at
 * least: Oak's call, in the rule, never shown to the learner).
 */
const PULSE = "<[c4,e4,g4]*8 [c4,f4,a4]*8>";
const pulse = (lpf: string, tail = "") =>
  `chords: note("${PULSE}").s("sawtooth").decay(.12).sustain(0).lpf(${lpf})${tail}.gain(.35)`;
const pulsing = (lpf: string, tail = "") => code(KICK, SNARE, HATS, BASS, pulse(lpf, tail));
const STEPS_STARTER = pulsing("⟪sine.range(400, 3000).slow(2)⟫");
const STEPS_SOLUTION = pulsing('"400 1200 2000 2800"');

/**
 * S9 (optional, Humanizing With Automation): the same pulse, its decay and cutoff drifting slowly on `perlin` (a
 * smooth random wave, U09.L04), so no two chords are quite the same length or brightness, like a player's touch.
 */
const DRIFT = code(
  KICK,
  SNARE,
  HATS,
  BASS,
  `chords: note("${PULSE}").s("sawtooth").decay(perlin.range(.08, .2)).sustain(0).lpf(perlin.range(900, 1600).slow(3)).gain(.35)`,
);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const CHORDS = { band: "band.two-chord-vamp", tracks: ["chords"] } as const;

export default defineLesson({
  id: "A1.L06",
  version: 5,
  title: "Movement",
  objective:
    "I can make a sound move while it plays, with vibrato, a phaser, tremolo or a slow filter sweep.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D07"],
  practises: [],
  terms: [
    { id: "term.vibrato", step: "S3" },
    { id: "term.lfo", step: "S5" },
  ],
  canDo: ["cd.code.movement"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Still and moving",
      minutes: 0.5,
      ui: { panels: ROLL, band: CHORDS },
      example: { id: "hook", code: MOVING, bars: 2 },
      exercise: {
        kind: "listen",
        id: "still-and-moving",
        version: 1,
        role: "practice",
        prompt:
          "Listen only to the long notes of the lead and the pad. Listen for what keeps changing in loop 2 while each one holds.",
        skills: [{ skill: "D07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: STILL, caption: "Loop 1: every held note stays exactly as it starts.", bars: 2 },
          {
            code: MOVING,
            caption: "Loop 2: the same notes. Follow the lead first, then the pad.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "One long G",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "one-long-g",
        version: 1,
        role: "practice",
        prompt:
          'One G held for a whole bar, twice, with `.vib("<0 5>")`: nothing in bar 1, 5 in bar 2. Predict what changes in bar 2, and pick it.',
        skills: [{ skill: "D07", w: 1 }],
        hints: null,
        tests: [],
        code: WOBBLE,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "pitch", label: "The pitch wobbles up and down" },
          { id: "level", label: "It gets louder and softer" },
          { id: "echo", label: "It echoes" },
        ],
        correct: ["pitch"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "How fast, how far",
      minutes: 1,
      ui: { panels: NONE },
      example: { id: "how-fast", code: HOW_FAST, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "how-fast-how-far",
        version: 1,
        role: "practice",
        prompt:
          "The long G again, now with two calls: `.vib()` changes between the bars, `.vibmod()` stays the same. Count the wobbles in each bar. Then answer both questions: how many wobbles a second in bar 2, and which call sets how far the pitch moves.",
        skills: [{ skill: "D07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Listen to bar 2: the wobbles come faster, but the pitch moves no further than in bar 1. One call changed between the bars, the other did not.",
        },
        hints: ladder(
          "Compare the two bars: one wobbles faster. Does it also move any further from the G?",
          "`.vib()` takes a number of wobbles a second. Read the two values in the pattern, one for each bar.",
          "Bar 1 wobbles twice a second. The call that stayed the same between the bars sets the other thing.",
        ),
        code: { starter: HOW_FAST },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many wobbles a second in bar 2?", correct: 6 },
          {
            q: "choice",
            prompt: "Which call sets how far the pitch moves, in semitones each way?",
            options: [
              { id: "vibmod", label: "`.vibmod()`" },
              { id: "vib", label: "`.vib()`" },
              { id: "gain", label: "`.gain()`" },
            ],
            correct: ["vibmod"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 6, choice: ["vibmod"] } },
            expect: "pass",
          },
          {
            name: "bar 1's speed",
            response: { answer: { number: 2, choice: ["vibmod"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the speed call for the width",
            response: { answer: { number: 6, choice: ["vib"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Match the vibrato",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "match-the-vibrato",
        version: 1,
        role: "check",
        prompt:
          "Your lead holds its notes still; the target's sings with a gentle vibrato, about as fast and as narrow as a singer's. At the end of the mel line, add `.vib()` and `.vibmod()` and set both by ear. Done when your speed and width are close to the target's.",
        skills: [{ skill: "D07", w: 1 }],
        code: { starter: SING_STARTER },
        reference: { solutions: [SING_SOLUTION], bars: 2 },
        // What is heard: the lead's notes must still sound (a muted lead has none), and its vibrato must be
        // within 1.5 wobbles a second and .15 of a semitone of the target's.
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
            {
              m: "controls",
              track: "mel",
              controls: [
                { control: "vib", scale: "linear", tol: 1.5 },
                { control: "vibmod", scale: "linear", tol: 0.15 },
              ],
            },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "code.control-off":
            "`{fn}`: not like the target yet. Listen to how fast the target's pitch wobbles, and how far it moves each way.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: no lead note is heard here. Keep the lead playing; give it a wobble only.",
        },
        hints: ladder(
          "Listen to one long target note and count its wobbles in a second. Then listen to how far it moves each way: further than yours, or less?",
          "`.vib()` sets how many wobbles a second; `.vibmod()` how far, in semitones each way. Left out, `.vibmod()` is half a semitone.",
          "The target's speed sits between the two bars of How fast, how far, and its width is about the same as there.",
        ),
        tests: [
          { name: "reference", response: { code: SING_SOLUTION }, expect: "pass" },
          {
            name: "a touch faster and narrower",
            response: { code: sing(".vib(5.5).vibmod(.25)") },
            expect: "pass",
          },
          {
            name: "the two calls the other way round",
            response: { code: sing(".vibmod(.3).vib(5)") },
            expect: "pass",
          },
          {
            name: "slower and a little wider",
            response: { code: sing(".vib(4).vibmod(.4)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: sing("") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "right function, no depth: nothing wobbles",
            response: { code: sing(".vib(5).vibmod(0)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "right function, far too fast: a buzz, not a singer",
            response: { code: sing(".vib(30).vibmod(.3)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "right speed, the default width left in: wider than the target",
            response: { code: sing(".vib(5)") },
            expect: "fail",
            feedback: ["code.control-missing"],
          },
          {
            name: "the right vibrato, then the lead muted",
            response: { code: sing(".vib(5).vibmod(.3).gain(0)") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "the pad given the vibrato instead of the lead",
            response: { code: code(...RHYTHM, pad(".vib(5).vibmod(.3)"), lead()) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "investigate",
      title: "Other things that move",
      minutes: 1,
      ui: { panels: NONE },
      example: { id: "three-moves", code: THREE_MOVES, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "other-things-that-move",
        version: 1,
        role: "practice",
        prompt:
          "One chord plays a bar, with one setting moving in each bar: `.phaser(2)` in bar 1, `.tremolosync(4)` in bar 2, `.lpf(800).lprate(1)` in bar 3. Listen to what moves in each bar. Then answer both questions: in which bar the loudness dips, and how many times.",
        skills: [{ skill: "D07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. In one bar the chord keeps its colour and only its loudness dips and swells, evenly, a few times. Count the dips in that bar.",
        },
        hints: ladder(
          "Listen for the bar where the chord keeps its colour and only gets softer and louder again. Which bar is it?",
          "`.tremolosync()` counts its dips per bar: the number it is given is how many times the level falls and comes back in each bar.",
          "Bar 1 sweeps the colour, bar 3 opens and closes the brightness. That leaves one bar.",
        ),
        code: { starter: THREE_MOVES },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "In which bar does the loudness dip and swell?",
            options: [
              { id: "bar1", label: "Bar 1" },
              { id: "bar2", label: "Bar 2" },
              { id: "bar3", label: "Bar 3" },
            ],
            correct: ["bar2"],
          },
          { q: "number", prompt: "How many dips in that bar?", correct: 4 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["bar2"], number: 4 } },
            expect: "pass",
          },
          {
            name: "the filter sweep for the loudness",
            response: { answer: { choice: ["bar3"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the phaser's number counted",
            response: { answer: { choice: ["bar2"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "What moves",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "what-moves",
        version: 1,
        role: "check",
        prompt:
          "A held pad plays over the drums, with one setting moved by a slow wave. Listen to the pad's pitch, loudness and brightness, and pick the one that moves.",
        skills: [{ skill: "D07", w: 1 }],
        hints: [
          { text: "Hum along with the pad. Does the note you hum move, or does something else?" },
          {
            text: "Vibrato moves the pitch, tremolo the level, a filter sweep the brightness: the notes stay put and the sound opens and closes, like a mouth saying wah.",
          },
          { text: "Hear it again, slower, and listen to the top of the sound.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: WHAT_MOVES, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "pitch", label: "The pitch: it wobbles" },
            { id: "level", label: "The loudness: it pulses" },
            { id: "brightness", label: "The brightness: it opens and closes" },
          ],
        },
        correct: { choice: ["brightness"] },
        feedbackText: {
          "id.wrong":
            "Not this one. The pad's notes stay on their pitch and at their level; only the top of the sound moves, darker, then brighter, then darker again.",
        },
        srs: [{ family: "fam.snd.params", mode: "review-if-due" }],
        tests: [
          { name: "the brightness", response: { answer: { choice: ["brightness"] } }, expect: "pass" },
          {
            name: "heard as vibrato",
            response: { answer: { choice: ["pitch"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "heard as tremolo",
            response: { answer: { choice: ["level"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      // Oak 2.0 (W2): the book's Rhythm of Automation. Placed before the Make (step ids are never renumbered).
      id: "S8",
      kind: "modify",
      title: "Steps, not sweeps",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "steps-not-sweeps",
        version: 1,
        role: "check",
        prompt:
          "The chords' cutoff glides on a slow wave, so every chord is a little brighter or darker than the last. Replace the wave in `.lpf()` with cutoff values that each hold for two chords or more, then jump. Keep the chords as they are. Done when the cutoff jumps between at least three held values.",
        skills: [{ skill: "D07", w: 1 }],
        code: { starter: STEPS_STARTER },
        reference: { solutions: [STEPS_SOLUTION], bars: 2 },
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["chords"] },
            {
              m: "rubric",
              rules: [
                {
                  id: "steps-not-sweeps",
                  label:
                    "The chords' cutoff holds a value for two chords or more, then jumps, with three values or more",
                  required: true,
                  skills: ["D07"],
                  rule: "custom",
                  fn: "stepped-control",
                  params: { track: "chords", control: "lpf", minSteps: 3 },
                },
              ],
            },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet":
            "Not yet: {label}. Listen to the chords: a glide changes on every chord, steps stay put for a while and then jump.",
        },
        hints: ladder(
          "Listen to the chords: their brightness changes on every one. Which part of the line makes it glide?",
          "A wave in `.lpf()` gives each chord a new value. A pattern of numbers in quotes holds each number for its share of the bar.",
          "Four numbers in the quotes give each one a beat, two chords. Choose them far apart, from dark to bright.",
        ),
        tests: [
          { name: "reference", response: { code: STEPS_SOLUTION }, expect: "pass" },
          {
            name: "a new order in each bar",
            response: { code: pulsing('"<[400 1200 2000 2800] [2800 2000 1200 400]>"') },
            expect: "pass",
          },
          {
            name: "half a bar per value",
            response: { code: pulsing('"<[400 1600] [800 3200]>"') },
            expect: "pass",
          },
          {
            name: "the wave cut into steps with .segment()",
            response: { code: pulsing("saw.range(400, 2000).segment(4)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: pulsing("sine.range(400, 3000).slow(2)") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, a new value on every chord: still a glide",
            response: { code: pulsing('"400 800 1600 3200 400 800 1600 3200"') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one value for the whole loop: nothing moves",
            response: { code: pulsing("1200") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chords made longer as well",
            response: {
              code: code(
                KICK,
                SNARE,
                HATS,
                BASS,
                `chords: note("<[c4,e4,g4]*4 [c4,f4,a4]*4>").s("sawtooth").decay(.12).sustain(0).lpf("400 800 1600 3200").gain(.35)`,
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      // Oak 2.0 (W2): the book's Humanizing With Automation, an optional, ungraded run.
      id: "S9",
      kind: "run",
      title: "Slow drift",
      minutes: 0.75,
      optional: true,
      ui: { panels: NONE },
      example: { id: "drift", code: DRIFT, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "slow-drift",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop and listen to the chords for four bars: each one is a little shorter or longer, brighter or darker, than the one before. Then change the numbers in the two `.range()` calls, wider or narrower, and run it again.",
        skills: [{ skill: "D07", w: 1 }],
        hints: ladder(
          "Listen to one chord after another. Are any two exactly the same?",
          "`perlin` is a slow random wave. `.range()` sets the lowest and highest value it gives the decay and the cutoff.",
          "Pull the two numbers of the decay's range closer together for a steadier hand, further apart for a looser one.",
        ),
        code: { starter: DRIFT },
        mustPlayLoops: 1,
        questions: [],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Make it move",
      minutes: 2.75,
      ui: { panels: ROLL, band: CHORDS },
      example: { id: "morph", code: MORPH, bars: 2 },
      exercise: {
        kind: "code-make",
        id: "make-it-move",
        // v2 (unit songs): the checklist gains a wavetable sweep, the movement this lesson unlocks (not required),
        // and the prompt invites it.
        version: 2,
        role: "practice",
        prompt:
          "The pad and the long-note lead are both still. Make at least one of them move while its notes hold: vibrato on the lead, a phaser on the pad, a slow filter sweep, or a level that pulses with the beat. A `wt_morph` pad swept by `.wtrate()` can join them. Your loop then plays both build-ups of your song.",
        skills: [{ skill: "D07", w: 1 }],
        code: { starter: STILL },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-part-that-moves",
            label:
              "One heard part moves while its notes hold: vibrato, a phaser, a tremolo or a filter sweep",
            required: true,
            skills: ["D07"],
            rule: "custom",
            fn: "control-set",
            // Each counts only where it is heard: a vibrato with depth, a phaser or tremolo with depth, a filter
            // sweep on a line that has a filter (the grader's silencers).
            params: {
              anyOf: [
                { control: "vib", above: 0 },
                { control: "phaserrate", above: 0 },
                { control: "tremolosync", above: 0 },
                { control: "lprate", above: 0 },
                { control: "lpdepth", above: 0 },
              ],
            },
          },
          {
            id: "a-sweep",
            label: "A filter sweep, .lprate() or .lpdepth(), on a part",
            required: false,
            skills: ["D07"],
            rule: "custom",
            fn: "control-set",
            params: {
              anyOf: [
                { control: "lprate", above: 0 },
                { control: "lpdepth", above: 0 },
              ],
            },
          },
          {
            id: "a-singing-lead",
            label: "Vibrato, .vib(), on the lead (the mel line)",
            required: false,
            skills: ["D07"],
            rule: "custom",
            fn: "control-set",
            params: { control: "vib", call: "vib", example: "5", track: "mel" },
          },
          {
            id: "a-wavetable-sweep",
            label: "A wavetable sweep: `.wtrate()`, `.wtdepth()`, `.wtenv()` or `.wt()` on a part",
            required: false,
            skills: ["D07"],
            rule: "uses",
            tool: "tb.wt",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Movement is heard best on long notes. Start with the part that holds its notes longest: which one is it?",
          "`.vib()` moves the pitch, `.phaser()` sweeps the colour, `.tremolosync()` dips the level a number of times a bar, `.lprate()` moves the cutoff of a line that has `.lpf()`.",
          "Try the lead first: a vibrato as in Match the vibrato. Then give the pad a slow sweep of its own.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: STILL },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: vibrato on the lead",
            response: { code: code(...RHYTHM, pad(), lead(".vib(5)")) },
            expect: "pass",
          },
          {
            name: "a phaser on the pad",
            response: { code: code(...RHYTHM, pad(".phaser(2)"), lead()) },
            expect: "pass",
          },
          {
            name: "the pad pulsing four times a bar",
            response: { code: code(...RHYTHM, pad(".tremolosync(4)"), lead()) },
            expect: "pass",
          },
          {
            name: "a slow filter sweep on the pad",
            response: { code: code(...RHYTHM, pad(".lprate(.5)"), lead()) },
            expect: "pass",
          },
          { name: "beyond the brief: the hook", response: { code: MOVING }, expect: "pass" },
          {
            name: "beyond the brief: the pad on a swept wavetable, the lead with vibrato",
            response: { code: MORPHING },
            expect: "pass",
          },
          {
            name: "right function, nothing to move: a sweep on the lead, which has no filter",
            response: { code: code(...RHYTHM, pad(), lead(".lprate(1)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "right function, no depth: a vibrato that does not move",
            response: { code: code(...RHYTHM, pad(), lead(".vib(5).vibmod(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "right function, no depth: a tremolo that does not dip",
            response: { code: code(...RHYTHM, pad(".tremolosync(4).tremolodepth(0)"), lead()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "right function, no depth: a filter sweep of nothing",
            response: { code: code(...RHYTHM, pad(".lprate(1).lpdepth(0)"), lead()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the moving part muted",
            response: { code: code(...RHYTHM, pad(), lead(".vib(5).gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the moving part masked out",
            response: { code: code(...RHYTHM, pad('.phaser(2).mask("0")'), lead()) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
