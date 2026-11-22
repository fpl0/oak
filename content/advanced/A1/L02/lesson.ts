// A1.L02 Filters & Filter Envelopes (spec: content/specs/A1.md). A low-pass filter lets a sound's low
// harmonics through and takes away those above its cutoff: lower the cutoff and the sound gets darker
// (`.lpf()`, at its alternative unlock site here). Resonance (`.lpq()`) adds a ringing peak at the cutoff, and a
// filter envelope (`.lpenv()` with `.lpd()`) moves the cutoff on every note: the pluck of a synth riff.
//
// A side lesson (contracts §2.6): it opens once U03.L02 is done, so it uses only what U03.L02 guarantees plus
// A1's own unlocks (`.scope()`, `.partials()` from A1.L01; the filters from here). No `ebass`, no `,` inside
// mini-notation, no chords by name, no `arrange()`.
//
// It starts from the A1 loop as A1.L01 leaves it (a raw sawtooth bass, a square riff, nothing taken away) and
// ends with that loop filtered: a round bass under a plucked riff. The Band plays the chords only.
//
// How it is graded: S4 and S6 are "match this sound" steps on the `controls` matcher (the cutoff within half
// an octave; the filter envelope's depth and decay), with `edit-only-regions` keeping the notes; S5 (not
// graded) rings the resonance; S7 is a `fam.snd.params` level 1 ear step (brighter or darker), which seeds the
// family; the Make requires a filter envelope (`uses tb.lpenv`). S3 opens the scope panel and S3, S4 and S6
// draw the `filter` probe beside the part they change (`ui.probe`, feature `step.probe`).
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

/** The A1 loop (A1.L01): three drum lines, a bass in note names, a riff in degrees. */
const DRUMS = ['kick: s("bd ~ bd ~")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*8").gain(.5)'];
/** C | F under the Band's I | IV: root, root, the 5th below (g1 under C, c2 under F). */
const BASS_NOTES = "<[c2 ~ c2 g1] [f1 ~ f1 c2]>";
/** G G E G – E C – | A A F A – F C –: every note on a beat is in the Band's chord (C, then F). */
const RIFF = "<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>";
const bass = (tail: string) => `bass: note("${BASS_NOTES}")${tail}`;
const riff = (tail: string) => `mel: n("${RIFF}").scale("C4:major")${tail}`;

/** The loop as A1.L01 leaves it: a raw sawtooth bass and a square riff, nothing taken away. The Make's starter. */
const RAW = code(...DRUMS, bass('.s("sawtooth")'), riff('.s("square").gain(.8)'));
/** The hook: the bass under a low-pass with a little resonance, the riff plucked by a filter envelope. */
const FILTERED = code(
  ...DRUMS,
  bass('.s("sawtooth").lpf(400).lpq(4)'),
  riff('.s("sawtooth").lpf(300).lpenv(4).lpd(.2).gain(.8)'),
);

/** S2–S3: the riff on a sawtooth, the low-pass closing a bar at a time. */
const CLOSING = riff('.s("sawtooth").lpf("<4000 2000 1000 500>").gain(.8)');

/** S4: the bass over the drums; only the low-pass changes. */
const bassWith = (lpf: string) => code(...DRUMS, bass(`.s("sawtooth").${lpf}`));
const MATCH_STARTER = bassWith("⟪lpf(4000)⟫");
const MATCH_SOLUTION = bassWith("lpf(400)");

/** S5: the riff with a low-pass and the resonance at nothing. */
const ringWith = (lpf: string, lpq: string) =>
  code(...DRUMS, riff(`.s("sawtooth").lpf(${lpf}).lpq(${lpq}).gain(.7)`));
const RING_STARTER = ringWith("⟪800⟫", "⟪0⟫");
const RING_SOLUTION = ringWith("800", "20");

/** S6: the riff on a closed low-pass; the target opens it on every note and closes it fast. */
const pluckWith = (tail: string) => code(...DRUMS, riff(`.s("sawtooth").lpf(300)${tail}.gain(.8)`));
const PLUCK_STARTER = pluckWith("⟪⟫");
const PLUCK_SOLUTION = pluckWith(".lpenv(4).lpd(.2)");

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const CHORDS = { band: "band.two-chord-vamp", tracks: ["chords"] } as const;

export default defineLesson({
  id: "A1.L02",
  version: 3,
  title: "Filters & Filter Envelopes",
  objective: "I can darken a sound with `.lpf()`, make it ring with `.lpq()` and pluck it with `.lpenv()`.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["D03"],
  practises: [],
  terms: [
    { id: "term.filter", step: "S3" },
    { id: "term.cutoff", step: "S3" },
    { id: "term.resonance", step: "S5" },
  ],
  canDo: ["cd.code.filters"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Raw and round",
      minutes: 0.5,
      ui: { panels: ROLL, band: CHORDS },
      example: { id: "hook", code: FILTERED, bars: 2 },
      exercise: {
        kind: "listen",
        id: "raw-and-round",
        version: 1,
        role: "practice",
        prompt:
          "Loop 2 plays the same notes with part of each sound taken away. Listen to the top of the bass and the riff in both loops, and listen for which part of their sound is gone.",
        skills: [{ skill: "D03", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: RAW,
            caption: "Loop 1: the bass and the riff as Waves & Harmonics left them.",
            bars: 2,
          },
          {
            code: FILTERED,
            caption: "Loop 2: listen to the top of each sound, and to the start of each riff note.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Four bars down",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "four-bars-down",
        version: 1,
        role: "practice",
        prompt:
          "The riff plays on a sawtooth while the `.lpf()` number falls bar by bar: 4000, 2000, 1000, 500. Predict what changes in the sound from bar to bar, and pick it.",
        skills: [{ skill: "D03", w: 1 }],
        hints: null,
        tests: [],
        code: code(CLOSING),
        bars: 4,
        mode: "choose",
        choices: [
          { id: "darker", label: "The riff gets darker, as if behind a door" },
          { id: "quieter", label: "It gets quieter but keeps its colour" },
          { id: "higher", label: "It moves to higher notes" },
        ],
        correct: ["darker"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "What goes first",
      minutes: 1,
      ui: { panels: NONE, initialPanels: ["scope"], probe: { kind: "filter", track: "mel" } },
      example: { id: "what-goes-first", code: code(`${CLOSING}.scope()`), bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "what-goes-first",
        version: 1,
        role: "practice",
        prompt:
          "The same four bars play with the scope open. Watch the corners of the wave as the number falls. Then answer both questions: which harmonics go first, and how many of G4's harmonics sit below 1000.",
        skills: [{ skill: "D03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. The number is a line: harmonics above it go. G4's harmonics sit at 392, 784, 1176 and up; count those under 1000.",
        },
        hints: ladder(
          "Watch the corners of the wave as the number falls. Corners are made by the high harmonics: do they go first, or last?",
          "Harmonics sit at 1, 2, 3 … times a note's frequency. Only those under the `.lpf()` number stay.",
          "G4's first harmonic is 392, its second 784. Is the third, 3 × 392, under 1000?",
        ),
        code: { starter: code(`${CLOSING}.scope()`) },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "As the number falls, which harmonics go first?",
            options: [
              { id: "highest", label: "The highest ones" },
              { id: "lowest", label: "The lowest ones" },
              { id: "all", label: "All of them a little at a time" },
            ],
            correct: ["highest"],
          },
          {
            q: "number",
            prompt:
              "The riff's G4 repeats about 392 times a second. With `.lpf(1000)`, how many of its harmonics sit below 1000?",
            correct: 2,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 2, choice: ["highest"] } },
            expect: "pass",
          },
          {
            name: "the lowest go first",
            response: { answer: { number: 2, choice: ["lowest"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "three counted",
            response: { answer: { number: 3, choice: ["highest"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Match the bass",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, probe: { kind: "filter", track: "bass" } },
      exercise: {
        kind: "code-modify",
        id: "match-the-bass",
        version: 1,
        role: "check",
        prompt:
          "Your bass still buzzes; the target is the same bass, round and low. Lower the number in `.lpf()` on the bass line until yours sounds like the target. Keep `.lpf()`; change only its number. Done when your cutoff is close to the target's.",
        skills: [{ skill: "D03", w: 1 }],
        code: { starter: MATCH_STARTER },
        reference: { solutions: [MATCH_SOLUTION], bars: 2 },
        matcher: { m: "controls", track: "bass", controls: [{ control: "lpf", scale: "log", tol: 0.5 }] },
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          { c: "must-use", tool: "tb.lpf", feedback: "code.must-use" },
        ],
        target: { audible: true, showRoll: false },
        feedbackText: {
          // `{how}` says which way: a cutoff below the target's is darker, and lowering it further would
          // take it further away (corrections pass, theory-b 9).
          "code.control-off":
            "Not yet: yours is {how}. The target keeps the bass's lowest few harmonics and takes the rest away.",
          "code.must-use":
            "This step needs `.lpf()`, the low-pass: it keeps the lows. `.hpf()` does the opposite and takes the low note away.",
        },
        hints: ladder(
          "Play yours, then the target, and compare the top of the sound. Is yours brighter or darker?",
          "A lower `.lpf()` number takes away more of the top. The target keeps only the bass's lowest few harmonics.",
          "The bass's c2 repeats about 65 times a second, so its first few harmonics sit under a few hundred. Try a number in the hundreds.",
        ),
        tests: [
          { name: "reference", response: { code: MATCH_SOLUTION }, expect: "pass" },
          { name: "close enough: 350", response: { code: bassWith("lpf(350)") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: bassWith("lpf(4000)") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "lowered, not far enough",
            response: { code: bassWith("lpf(1200)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "lowered too far: darker than the target",
            response: { code: bassWith("lpf(100)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          { name: "close enough from above: 500", response: { code: bassWith("lpf(500)") }, expect: "pass" },
          { name: "close enough from below: 300", response: { code: bassWith("lpf(300)") }, expect: "pass" },
          {
            name: "a high-pass instead",
            response: { code: bassWith("hpf(400)") },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Make it ring",
      minutes: 0.75,
      ui: { panels: NONE },
      exercise: {
        kind: "code-modify",
        id: "make-it-ring",
        version: 1,
        role: "practice",
        prompt:
          "`.lpq()` adds a peak at the `.lpf()` number. On the mel line, change the `.lpq()` number from 0 to a number from 10 to 30, and listen for a whistle in the riff. Then move the `.lpf()` number and hear the whistle move with it.",
        skills: [{ skill: "D03", w: 1 }],
        code: { starter: RING_STARTER },
        reference: { solutions: [RING_SOLUTION], bars: 2 },
        matcher: { m: "controls", track: "mel", controls: [{ control: "lpq", scale: "linear", tol: 10 }] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: false, showRoll: false },
        feedbackText: {
          "code.control-off": "Not yet: yours is {how}. The brief asks for an `.lpq()` number from 10 to 30.",
        },
        hints: ladder(
          "Only one number on the mel line sets how big the peak is. Which call holds it?",
          "`.lpq()` sets the peak; at 0 there is none. Above about 10 it starts to whistle.",
          "At 5 you hear a slight edge. Go higher.",
        ),
        tests: [
          { name: "reference", response: { code: RING_SOLUTION }, expect: "pass" },
          { name: "12, with the number moved", response: { code: ringWith("1500", "12") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: ringWith("800", "0") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "too small to whistle",
            response: { code: ringWith("800", "4") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "past the brief's 30: a scream, not a whistle",
            response: { code: ringWith("800", "45") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          { name: "30, the top of the range", response: { code: ringWith("800", "30") }, expect: "pass" },
          {
            name: "the riff's notes changed as well",
            response: {
              code: code(
                ...DRUMS,
                'mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 2 ~]>").scale("C4:major").s("sawtooth").lpf(800).lpq(20).gain(.7)',
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Pluck the riff",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, probe: { kind: "filter", track: "mel" } },
      exercise: {
        kind: "code-modify",
        id: "pluck-the-riff",
        version: 1,
        role: "check",
        prompt:
          "The riff sits under `.lpf(300)`: dull. `.lpenv(n)` opens the low-pass n octaves above 300 on each note; `.lpd(s)` closes it again in s seconds. Add both to the mel line and set their numbers by ear to match the target. Done when both numbers are close to the target's.",
        skills: [{ skill: "D03", w: 1 }],
        code: { starter: PLUCK_STARTER },
        reference: { solutions: [PLUCK_SOLUTION], bars: 2 },
        matcher: {
          m: "controls",
          track: "mel",
          controls: [
            { control: "lpenv", scale: "linear", tol: 1 },
            { control: "lpd", scale: "linear", tol: 0.1 },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        hints: ladder(
          "Listen to one target note from start to end. Does it start bright and turn dull, or stay the same all the way?",
          "`.lpenv()` sets how far up the low-pass jumps on each note, in octaves; `.lpd()` how long it takes to fall back, in seconds.",
          "From 300, one octave up is 600 and two are 1200. The target's notes start several octaves up and fall back in a fraction of a second.",
        ),
        tests: [
          { name: "reference", response: { code: PLUCK_SOLUTION }, expect: "pass" },
          { name: "close enough", response: { code: pluckWith(".lpenv(3.5).lpd(.25)") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: pluckWith("") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "too shallow",
            response: { code: pluckWith(".lpenv(1).lpd(.2)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "the cutoff raised instead",
            response: { code: code(...DRUMS, riff('.s("sawtooth").lpf(4800).gain(.8)')) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "ear",
      title: "Brighter or darker",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "brighter-or-darker",
        version: 1,
        role: "check",
        prompt:
          "One phrase plays twice, and between bar 1 and bar 2 the low-pass moved. Listen to the top of the sound and pick whether bar 2 got brighter or darker.",
        skills: [{ skill: "D03", w: 1 }],
        hints: [
          { text: "Listen to the top of the sound in each bar: buzzy or muffled?" },
          { text: "Brighter means more of the top harmonics came through; darker means fewer did." },
          {
            text: "Hear it again and listen only to bar 2's first note against bar 1's.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.snd.params", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "brighter", label: "Brighter (filter opened)" },
            { id: "darker", label: "Darker (filter closed)" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.snd.params", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Filter your loop",
      minutes: 2.75,
      ui: { panels: ROLL, band: CHORDS },
      exercise: {
        kind: "code-make",
        id: "filter-your-loop",
        version: 1,
        role: "practice",
        prompt:
          "This is the raw loop: a sawtooth bass and a square riff with nothing taken away. Put the bass under a low-pass with `.lpf()` so the riff sits on top. Then give one part an `.lpenv()` above 0, so its sound opens on every note. Or bring a loop of your own.",
        skills: [{ skill: "D03", w: 1 }],
        code: { starter: RAW },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "filter-envelope",
            label: "One heard part has an .lpenv() number other than 0",
            required: true,
            skills: ["D03"],
            // Corrections gate (fix:leftovers notDone): an envelope you can hear; `.lpenv(0)` moves nothing.
            rule: "custom",
            fn: "control-set",
            params: { control: "lpenv", call: "lpenv", not: 0, example: "3", alsoUses: ["tb.lpenv"] },
          },
          {
            id: "bass-low-pass",
            label: "A low-pass, .lpf(), on at least one part",
            required: false,
            skills: ["D03"],
            rule: "uses",
            tool: "tb.lpf",
          },
          {
            id: "resonance",
            label: "Resonance, .lpq(), on at least one part",
            required: false,
            skills: ["D03"],
            rule: "uses",
            tool: "tb.lpq",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Choose the part that should open on every note, the bass or the riff. Which one would you like to hear move?",
          "`.lpenv()` moves a low-pass, so the part needs one: `.lpf()` sets where it rests, `.lpenv()` how far it jumps, `.lpd()` how fast it falls back.",
          "On the riff, try `.lpf(400)` and then a jump of three octaves that falls back in a quarter of a second.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: RAW },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the riff plucked",
            response: {
              code: code(...DRUMS, bass('.s("sawtooth")'), riff('.s("square").lpf(400).lpenv(3).gain(.8)')),
            },
            expect: "pass",
          },
          { name: "beyond the brief: both parts filtered", response: { code: FILTERED }, expect: "pass" },
          {
            // Corrections gate: `uses` passed it; an envelope of depth 0 opens nothing.
            name: "an envelope of 0: the tool written, nothing moves",
            response: {
              code: code(...DRUMS, bass('.s("sawtooth")'), riff('.s("square").lpf(400).lpenv(0).gain(.8)')),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a downward sweep, a negative envelope",
            response: {
              code: code(...DRUMS, bass('.s("sawtooth")'), riff('.s("square").lpf(2000).lpenv(-3).gain(.8)')),
            },
            expect: "pass",
          },
          {
            name: "a static low-pass only",
            response: {
              code: code(...DRUMS, bass('.s("sawtooth").lpf(400)'), riff('.s("square").lpf(2000).gain(.8)')),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
