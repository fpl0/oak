// A1.L07 FM & Supersaw (spec: content/specs/A1.md). FM synthesis lets a second sine bend a note's pitch hundreds
// of times a second: `.fm()` says how far (0 is the plain wave), `.fmh()` how fast, as a multiple of the note
// (superdough helpers.mjs `applyFM`: the modulator runs at fmh × the note and bends it by fm × that, so `.fm()` is
// the modulation index). The new tones sit at the note ± whole multiples of the modulator: at 1 on every harmonic
// (bright, brassy), at 2 on the odd ones (hollow), at 3.5 at 2.5, 4.5, 6, 8, 9.5, 11.5 … times the note: every
// other pair between the harmonics, so the note clangs (a bell). FM bends an oscillator, so it works on the synth
// waves only: `sampler.mjs` and the soundfont loader never call it, and `.s("piano").fm(3)` sounds like a plain
// piano. Beside FM, the supersaw is heard and
// named: five saws a little out of tune with each other (unison 5, detune .18 semitones, spread .6 by default);
// `.detune(0)` puts them on one pitch, so they stop beating and the pad turns narrow and still.
//
// A track lesson (contracts §2.6; AUTHORING §20.1): it opens after U09.CP and follows A1.L01–L06 in the track's
// order, so a learner here may not have met minor keys (U10), dominant sevenths or swing (U11) or sevenths (U12).
// It keeps the A1 loop as A1.L04 left it (a plucked, filtered sawtooth bass; the snare in a big room) in C major
// at 100 BPM over `band.two-chord-vamp`'s chords, and adds a held pad, because a source is heard on notes that last.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S4 grades what is heard: the riff's notes (`events`), the FM ratio (`controls` on `fmh`) and an FM depth in the
//   target's window on a sound FM can bend (`control-set` on `fmi`, the value key `.fm()` writes, with its
//   silencer: a recorded instrument has no oscillator to bend). Wrong answers that use the right function: the
//   target's FM on a piano, `.fm(0)`, `.fm(3)` with no ratio (on the harmonic series: brassy, not a bell), a
//   whole-number ratio, a depth far past the target, the right sound turned down until it is not heard.
// - S7 (optional) asks for more detune on the five saws, and a single voice (nothing left to detune) fails.
// - The Make requires FM you can hear on any line (`control-set` `anyOf` `fmi` above .5, with the silencer):
//   `.fm(0)`, `.fm(.2)`, FM on rhodes and an FM part at `.gain(0)` all fail.
// Feedback and hints below rung 4 describe the sound and never name the answer.
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

/** The A1 loop's drums, as A1.L04 placed them: the snare in a big room. */
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd").room(.5).roomsize(6)';
const HATS = 'hats: s("hh*8").gain(.5)';
/** C | F under the Band's I | IV: root, root, the 5th below; plucked and filtered as A1.L03 left it. */
const BASS = 'bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).decay(.2).sustain(0)';
/** G G E G – E C – | A A F A – F C –: every note on a beat is in the Band's chord (C, then F). */
const RIFF = "<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>";
const riff = (tail: string) => `mel: n("${RIFF}").scale("C4:major")${tail}`;
/** Each riff note falls away in 0.4 seconds, like a struck bell, and echoes half a beat later on its own orbit. */
const RING = ".decay(.4).sustain(0).delay(.3).delaytime(.3).orbit(2)";
/** C (C G E) | F (F C A): the Band's chords, held, an open spread above the bass. */
const PAD_NOTES = "<[c3,g3,e4] [f3,c4,a4]>";
const pad = (tail: string) => `pad: note("${PAD_NOTES}")${tail}`;

/** The loop with its riff on a plain sine and a still pad on a triangle: S1's first take and the Make's starter. */
const PLAIN = code(KICK, SNARE, HATS, BASS, riff(`.s("sine")${RING}`), pad('.s("triangle").gain(.3)'));
/** The hook: the riff rung like a bell with FM, over a wide supersaw pad. */
const RICH = code(
  KICK,
  SNARE,
  HATS,
  BASS,
  riff(`.s("sine").fm(3).fmh(3.5)${RING}`),
  pad('.s("supersaw").lpf(2000).gain(.25)'),
);

/** S2: one c4 a bar on a sine, the FM depth rising bar by bar. */
const DEEPER = 'mel: note("c4").s("sine").fm("<0 1 2 4>")';
/** S3: the same depth at three ratios, drawn on the scope. */
const RATIOS = 'mel: note("c4").s("sine").fm("<0 3 3>").fmh("<1 2 3.5>").scope()';

/** S4: the riff over the drums, a struck sine; only its sound changes. */
const bellRiff = (sound: string) =>
  code(KICK, 'snare: s("~ sd ~ sd")', HATS, riff(`${sound}.decay(.4).sustain(0).gain(.8)`));
const BELL_STARTER = bellRiff('.s("sine")⟪⟫');
const BELL_SOLUTION = bellRiff('.s("sine").fm(3).fmh(3.5)');

/** S5: the supersaw pad, its five saws tuned together or pulled apart. */
const padCard = (detune: string) => code(pad(`.s("supersaw").detune(${detune}).lpf(2000).gain(.4)`));
const NARROW = padCard("0");
const WIDE = padCard(".4");

/** S6: a riff on one of three sources. */
const SOURCE_FM = code(KICK, HATS, riff('.s("sine").fm(3).fmh(3.5).decay(.4).sustain(0)'));

/** S7 (optional): the pad behind the bell riff; its voices and their detune change. */
const thick = (unison: string, detune: string) =>
  code(
    KICK,
    'snare: s("~ sd ~ sd")',
    HATS,
    riff('.s("sine").fm(3).fmh(3.5).decay(.4).sustain(0).gain(.8)'),
    pad(`.s("supersaw").unison(${unison}).detune(${detune}).lpf(2000).gain(.25)`),
  );
const THICK_STARTER = thick("⟪5⟫", "⟪.18⟫");
const THICK_SOLUTION = thick("7", ".4");

/** The Make's tests: the starter with one line changed. */
const withRiff = (sound: string) =>
  code(KICK, SNARE, HATS, BASS, riff(`${sound}${RING}`), pad('.s("triangle").gain(.3)'));

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const CHORDS = { band: "band.two-chord-vamp", tracks: ["chords"] } as const;

export default defineLesson({
  id: "A1.L07",
  version: 3,
  title: "FM & Supersaw",
  objective: "I can build a bright or bell-like sound with FM, and hear what makes a supersaw wide.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["D07"],
  terms: [
    { id: "term.fm-synthesis", step: "S3" },
    { id: "term.detune", step: "S5" },
  ],
  canDo: ["cd.code.fm"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Plain and rich",
      minutes: 0.5,
      ui: { panels: ROLL, band: CHORDS },
      example: { id: "hook", code: RICH, bars: 2 },
      exercise: {
        kind: "listen",
        id: "plain-and-rich",
        version: 1,
        role: "practice",
        prompt:
          "Loop 2 keeps the drums and the bass and changes two sounds. Listen to the riff, and listen for what it now sounds as if it is made of.",
        skills: [{ skill: "D07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, caption: "Loop 1: the riff on a plain sine, a quiet pad on a triangle.", bars: 2 },
          { code: RICH, caption: "Loop 2: listen to the start of each riff note, then to the pad.", bars: 2 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Bend it further",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "bend-it-further",
        version: 1,
        role: "practice",
        prompt:
          "One c4 a bar on a sine. `.fm()` lets a second, fast sine bend the note's pitch, by 0, 1, 2, then 4. Predict what happens from bar to bar, and pick it.",
        skills: [{ skill: "D07", w: 1 }],
        hints: null,
        tests: [],
        code: code(DEEPER),
        bars: 4,
        mode: "choose",
        choices: [
          { id: "brighter", label: "It gets brighter each bar" },
          { id: "louder", label: "It gets louder each bar" },
          { id: "higher", label: "The note gets higher each bar" },
        ],
        correct: ["brighter"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "On the series or between",
      minutes: 1,
      ui: { panels: NONE },
      example: { id: "three-ratios", code: code(RATIOS), bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "on-the-series-or-between",
        version: 1,
        role: "practice",
        prompt:
          "`.fmh()` sets how fast the second sine runs, as a multiple of the note: 1, 2, then 3.5. Bar 1 has no bend at all. Watch the scope and listen to each bar. Then answer both questions: which bar draws a plain, round wave, and which rings like a bell.",
        skills: [{ skill: "D07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch the scope in each bar, then listen for the bar that stops sounding like one clear note and starts to clang.",
        },
        hints: ladder(
          "Listen for the difference between one clear note and something struck. Which bar sounds struck?",
          "Bar 1 bends by 0. In bars 2 and 3 the bend is the same; only the speed of the second sine changes, as a multiple of the note.",
          "A whole-number multiple adds tones that are harmonics of the note. Which bar's multiple is not a whole number?",
        ),
        code: { starter: code(RATIOS) },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "In which bar does the scope draw a plain, round wave?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "Which bar rings like a bell, some of its new tones falling between the harmonics?",
            options: [
              { id: "bar2", label: "Bar 2" },
              { id: "bar3", label: "Bar 3" },
            ],
            correct: ["bar3"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 1, choice: ["bar3"] } }, expect: "pass" },
          {
            name: "the whole-number ratio taken for the bell",
            response: { answer: { number: 1, choice: ["bar2"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the bell bar taken for the plain wave",
            response: { answer: { number: 3, choice: ["bar3"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Ring the riff",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "ring-the-riff",
        version: 1,
        role: "check",
        prompt:
          "Your riff is a plain sine; the target's rings like a struck bell, bright and a little clangy. Add `.fm()` (how far to bend) and `.fmh()` (how fast) to the mel line, and set both by ear. Keep the notes. Done when your riff rings like the target.",
        skills: [{ skill: "D07", w: 1 }],
        code: { starter: BELL_STARTER },
        reference: { solutions: [BELL_SOLUTION], bars: 2 },
        // What is heard: the notes kept, the ratio (`fmh`) and an FM depth in the target's window on a sound FM can
        // bend. `controls` does not map `.fm()` to its value key `fmi` yet, so the depth is a `control-set` rule,
        // which also knows a recorded instrument has no oscillator to bend.
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
            { m: "controls", track: "mel", controls: [{ control: "fmh", scale: "linear", tol: 0.3 }] },
            {
              m: "rubric",
              rules: [
                {
                  id: "rings",
                  label: "The riff bent about as far as the target, with .fm()",
                  required: true,
                  skills: ["D07"],
                  rule: "custom",
                  fn: "control-set",
                  params: { control: "fmi", call: "fm", above: 1.9, below: 4.1, track: "mel" },
                },
              ],
            },
          ],
        },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet":
            "Not yet: the target's riff rings, bright and clangy, and yours does not ring that way. Listen to how far its sound is from a plain sine. A bend only works on a synth wave.",
          "code.control-missing":
            "Closer: the riff is bent now, but its new tones sit on the harmonics, so it sounds bright rather than like a bell. The target's second sine runs at another speed.",
          "code.control-off":
            "Closer, but the ring sits in another place: some of the target's new tones fall between the harmonics, and yours fall elsewhere. Listen to the target's ring again.",
          "melody.wrong-degree": "Bar {bar}: the riff's notes changed. Change its sound and leave the notes.",
        },
        hints: ladder(
          "An FM sound needs two settings: how far the note is bent, and one more. Listen to the target's ring: what else could shape it?",
          "`.fm()` is how far the second sine bends the note; `.fmh()` is how fast it runs, as a multiple of the note. A whole-number multiple keeps the tones on the harmonics.",
          "The target bends about as far as bar 2 or 3 of the scope step did, and its multiple sits halfway between two whole numbers.",
        ),
        tests: [
          { name: "reference", response: { code: BELL_SOLUTION }, expect: "pass" },
          {
            name: "the two calls the other way round",
            response: { code: bellRiff('.s("sine").fmh(3.5).fm(3)') },
            expect: "pass",
          },
          {
            name: "a little less bend, inside the window",
            response: { code: bellRiff('.s("sine").fm(2.5).fmh(3.5)') },
            expect: "pass",
          },
          {
            name: "on a triangle instead of the sine",
            response: { code: bellRiff('.s("triangle").fm(3).fmh(3.4)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: bellRiff('.s("sine")') },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function on a recorded instrument: FM on the piano does nothing",
            response: { code: bellRiff('.s("piano").fm(3).fmh(3.5)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right ratio with no bend",
            response: { code: bellRiff('.s("sine").fm(0).fmh(3.5)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bent with no ratio: on the harmonics, bright, not a bell",
            response: { code: bellRiff('.s("sine").fm(3)') },
            expect: "fail",
            feedback: ["code.control-missing"],
          },
          {
            name: "a whole-number ratio: on the harmonics",
            response: { code: bellRiff('.s("sine").fm(3).fmh(3)') },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "bent far past the target: a harsh clang",
            response: { code: bellRiff('.s("sine").fm(8).fmh(3.5)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the riff's notes changed as well",
            response: {
              code: code(
                KICK,
                'snare: s("~ sd ~ sd")',
                HATS,
                'mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 2 ~]>").scale("C4:major").s("sine").fm(3).fmh(3.5).decay(.4).sustain(0).gain(.8)',
              ),
            },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the right sound, turned down until it is not heard",
            response: {
              code: code(
                KICK,
                'snare: s("~ sd ~ sd")',
                HATS,
                riff('.s("sine").fm(3).fmh(3.5).decay(.4).sustain(0).gain(.02)'),
              ),
            },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Wide and narrow",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "wide-and-narrow",
        version: 1,
        role: "practice",
        prompt:
          "The same chords on the supersaw. In one card its five saws play at exactly one pitch; in the other they are pulled a little apart. Listen to the space each one fills, and pick the card that sounds wider.",
        skills: [{ skill: "D07", w: 1 }],
        hints: ladder(
          "Listen to how much space each chord fills between your ears. Which card fills more?",
          "Waves a little out of tune with each other drift in and out of step, so the sound shimmers and spreads.",
          "Listen for the shimmer: one card holds perfectly still.",
        ),
        stimulus: { src: "code", code: WIDE, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "narrow", label: "Card A", audio: NARROW },
            { id: "wide", label: "Card B", audio: WIDE },
          ],
        },
        correct: { choice: ["wide"] },
        feedbackText: {
          "id.wrong":
            "Card A's five saws sit on one pitch, so they add up to one steady wave that holds still. Card B's are pulled apart and shimmer.",
        },
        tests: [
          { name: "the wide card", response: { answer: { choice: ["wide"] } }, expect: "pass" },
          {
            name: "the narrow card",
            response: { answer: { choice: ["narrow"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Which source",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-source",
        version: 1,
        role: "check",
        prompt: "A riff plays over kick and hats. Listen to each note, and pick what the riff is played on.",
        skills: [{ skill: "D07", w: 1 }],
        hints: [
          {
            text: "Listen to one note at a time. Is it one pure tone, or does it ring with something extra?",
          },
          {
            text: "A plain sine is pure and soft. A supersaw is a buzzing, wide block. FM keeps one note but adds tones that clang.",
          },
          { text: "Hear it again, slower, and listen to the start of each note.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: SOURCE_FM, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "sine", label: "A plain sine" },
            { id: "fm", label: "FM: bright and bell-like" },
            { id: "supersaw", label: "A supersaw: wide and thick" },
          ],
        },
        correct: { choice: ["fm"] },
        feedbackText: {
          "id.wrong":
            "Not this one. Each note was one pitch with a metallic ring on top, struck and fading: neither pure nor a wide buzz.",
        },
        srs: [{ family: "fam.snd.params", mode: "review-if-due" }],
        tests: [
          { name: "FM", response: { answer: { choice: ["fm"] } }, expect: "pass" },
          {
            name: "a plain sine",
            response: { answer: { choice: ["sine"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "a supersaw",
            response: { answer: { choice: ["supersaw"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "modify",
      title: "Thicken the pad",
      minutes: 1.25,
      optional: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "thicken-the-pad",
        version: 1,
        role: "practice",
        prompt:
          "The pad is on a supersaw, with `.unison()` and `.detune()` written out at their defaults. Raise the `.detune()` number on the pad line so the saws pull further apart. Add voices with `.unison()` if you like, but keep more than two. Keep the chords. Done when the pad fills the space behind the riff.",
        skills: [{ skill: "D07", w: 1 }],
        code: { starter: THICK_STARTER },
        reference: { solutions: [THICK_SOLUTION], bars: 2 },
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["pad"] },
            {
              m: "rubric",
              rules: [
                {
                  id: "pulled-apart",
                  label: "The pad's saws pulled further apart than the default .detune()",
                  required: true,
                  skills: ["D07"],
                  rule: "custom",
                  fn: "control-set",
                  params: { control: "detune", above: 0.25, track: "pad" },
                },
                {
                  id: "voices-to-detune",
                  label: "More than two voices on the pad, so there is something to pull apart",
                  required: true,
                  skills: ["D07"],
                  rule: "custom",
                  fn: "control-set",
                  params: { control: "unison", above: 2, track: "pad" },
                },
              ],
            },
          ],
        },
        target: { audible: false, showRoll: false },
        feedbackText: {
          "rubric.unmet": "{label}: not yet.",
          "melody.wrong-degree": "Bar {bar}: the pad's notes changed. Change its width and leave the chords.",
        },
        hints: ladder(
          "The pad needs to sound wider. What makes five saws sound like one wide sound rather than one plain one?",
          "`.detune()` sets how far apart the voices are tuned; `.unison()` sets how many voices play each note.",
          "Try a detune about twice the default, and keep at least five voices.",
        ),
        tests: [
          { name: "reference", response: { code: THICK_SOLUTION }, expect: "pass" },
          { name: "more detune, five voices kept", response: { code: thick("5", ".35") }, expect: "pass" },
          { name: "many voices, a lot of detune", response: { code: thick("9", ".6") }, expect: "pass" },
          { name: "three voices pulled well apart", response: { code: thick("3", ".5") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: thick("5", ".18") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "more voices, all on one pitch: narrower, not wider",
            response: { code: thick("9", "0") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a big detune on a single voice: nothing to pull apart",
            response: { code: thick("1", ".5") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "A richer source",
      minutes: 2.75,
      ui: { panels: ROLL, band: CHORDS },
      exercise: {
        kind: "code-make",
        id: "a-richer-source",
        version: 1,
        role: "practice",
        prompt:
          "The riff is on a plain sine and the pad is still. Give at least one part an FM sound you can hear: a bright lead, a hollow bass, a bell over the chords. Set how far with `.fm()` and how fast with `.fmh()`, by ear. Then, if you like, put the pad on a wide supersaw.",
        skills: [{ skill: "D07", w: 1 }],
        code: { starter: PLAIN },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "fm-you-can-hear",
            label: "A heard part bent with .fm() above 0.5",
            required: true,
            skills: ["D07"],
            rule: "custom",
            fn: "control-set",
            params: { anyOf: [{ control: "fmi", above: 0.5 }] },
          },
          {
            id: "wide-pad",
            label: "A part on the supersaw",
            required: false,
            skills: ["D07"],
            rule: "sounds",
            anyOf: ["snd.wave.supersaw"],
          },
          {
            id: "off-the-series",
            label: "An .fmh() speed other than 1, the note's own",
            required: false,
            skills: ["D07"],
            rule: "custom",
            fn: "control-set",
            params: { control: "fmh", not: 1 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Choose the part that should sound richer first: the riff, the bass or the pad. Which one?",
          "`.fm()` sets how far a second sine bends the note, `.fmh()` how fast; both work on the synth waves, not on recorded instruments.",
          "Start with the riff: bend it by about 2 and listen, then try a speed between two whole numbers for a bell.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: PLAIN },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the riff bent by 2",
            response: { code: withRiff('.s("sine").fm(2)') },
            expect: "pass",
          },
          {
            name: "a hollow FM bass instead",
            response: {
              code: code(
                KICK,
                SNARE,
                HATS,
                'bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("square").fm(1).fmh(2).lpf(800).decay(.2).sustain(0)',
                riff(`.s("sine")${RING}`),
                pad('.s("triangle").gain(.3)'),
              ),
            },
            expect: "pass",
          },
          {
            name: "a bell between the harmonics",
            response: { code: withRiff('.s("sine").fm(4).fmh(1.41)') },
            expect: "pass",
          },
          {
            name: "beyond the brief: the bell riff and the wide pad",
            response: { code: RICH },
            expect: "pass",
          },
          {
            name: "the right function with no bend",
            response: { code: withRiff('.s("sine").fm(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a bend too slight to hear",
            response: { code: withRiff('.s("sine").fm(.2)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "FM on a recorded instrument: rhodes does not bend",
            response: { code: withRiff('.s("rhodes").fm(4)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the FM riff turned down to nothing",
            response: { code: withRiff('.s("sine").fm(3).fmh(3.5).gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "only the pad made wide: no FM anywhere",
            response: {
              code: code(
                KICK,
                SNARE,
                HATS,
                BASS,
                riff(`.s("sine")${RING}`),
                pad('.s("supersaw").lpf(2000).gain(.25)'),
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
