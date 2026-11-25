// U09.L04 The Energy Curve. A song's energy rises and falls from section to section: louder, busier, higher,
// more parts. A build-up raises it into the next section. In code a signal draws the rise: `saw` climbs from 0
// to 1 over a bar, `.range(.2, .9)` sets where it starts and ends, `.slow(4)` stretches it over four bars, and
// `.segment(8)` turns the curve into steps that play as notes. `tb.signal`, `tb.range` and `tb.segment` unlock
// here. What the learner has: verse and chorus with one `arrange()` per track and `silence` (U09.L02), AABA and
// strophic (U09.L03), `.slow()` (U01.L09), `.gain()`, the sawtooth wave (U02.L06). Not yet: parts entering
// and leaving by bar with `.mask()` (U09.L05). Spec: content/specs/U09.md.
//
// How it is graded: S4 by the `controls` matcher on the hats' `gain`, event by event (a level gain or a
// falling curve misses); S6 by an `events` match on the riser, with `.segment()` required. The Make's one
// required rule is `contrast` on the energy axis, chorus against verse (|ΔE| ≥ 0.15 on the grader's energy
// curve: onsets, active tracks, gain and register per bar).
//
// Oak 2.0 W2 (DeSantis, *Making Music*, "Repetition and Insistence"): S8 hears one bar of chance-made notes turn into
// something that sounds meant once it is frozen and repeated, and the optional S9 freezes it: `matches` against the
// first bar `rand` played, looped (at least 3 in 4 of its notes, Oak's loose call), and `no-chance` on `mel`. Fidelity
// pins: content/validate/pins/U09.L04.ts.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Verse I vi IV V (C Am F G); the chorus starts away from home, IV V I I (F G C C), as in U09.L02. */
const CHORDS_VERSE = 'const chordsVerse = chord("<C Am F G>").voicing()';
/** The build plays the verse's chords and swells: the gain climbs from .5 to 1 over its four bars. */
const CHORDS_BUILD = 'const chordsBuild = chord("<C Am F G>").voicing().gain(saw.range(.5, 1).slow(4))';
const CHORDS_CHORUS = 'const chordsChorus = chord("<F G C C>").voicing()';
/** The roots, one a bar in the verse and the build; on every beat in the chorus. */
const BASS_VERSE = 'const bassVerse = n("<0 5 3 4>").scale("C2:major")';
const BASS_BUILD = 'const bassBuild = n("<0 5 3 4>").scale("C2:major")';
const BASS_CHORUS = 'const bassChorus = n("<[3 3 3 3] [4 4 4 4] [0 0 0 0] [0 0 0 0]>").scale("C2:major")';
const HATS_VERSE = 'const hatsVerse = s("hh*8").gain(.4)';
/** Sixteenths, rising from .2 to .9 over the four bars of the build. */
const hatsBuild = (gain: string) => `const hatsBuild = s("hh*16").gain(${gain})`;
const RISE = "saw.range(.2, .9).slow(4)";
/** Louder, with open hats on beats 2 and 4. */
const HATS_CHORUS = 'const hatsChorus = s("[hh hh oh hh]*2").gain(.7)';
/** The U09.L02 chorus tune, C5 A4 | B4 G4 | C5 E5 C5 | C5: chord tones on beats 1 and 3. */
const MEL_CHORUS = 'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")';
/** The riser: eight steps of the curve, C4 D4 E4 F4 G4 A4 B4 C5, two a bar over the build. */
const fxBuild = (riser: string) => `const fxBuild = ${riser}.scale("C4:major")`;
const RISER = "n(saw.range(0, 8).segment(8).slow(4))";

const DRUMS = ['kick: s("bd ~ bd ~")', 'snare: s("~ sd ~ sd")'];
const HATS = "hats: arrange([4, hatsVerse], [4, hatsBuild], [4, hatsChorus])";
const BASS = 'bass: arrange([4, bassVerse], [4, bassBuild], [4, bassChorus]).s("ebass").lpf(600)';
const CHORDS = 'chords: arrange([4, chordsVerse], [4, chordsBuild], [4, chordsChorus]).s("piano")';
const MEL = 'mel: arrange([4, silence], [4, silence], [4, melChorus]).s("piano")';
const FX = 'fx: arrange([4, silence], [4, fxBuild], [4, silence]).s("sawtooth").lpf(1200).gain(.4)';
/** Verse, build, chorus (12 bars), with the build's hats gain and riser given. */
const song = (gain = RISE, riser = RISER) =>
  `${TEMPO}${[
    CHORDS_VERSE,
    CHORDS_BUILD,
    CHORDS_CHORUS,
    BASS_VERSE,
    BASS_BUILD,
    BASS_CHORUS,
    HATS_VERSE,
    hatsBuild(gain),
    HATS_CHORUS,
    MEL_CHORUS,
    fxBuild(riser),
  ].join("\n")}\n\n${[...DRUMS, HATS, BASS, CHORDS, MEL, FX].join("\n")}`;

/** Twelve bars: verse, build, chorus. The chorus lands at bar 9, 17 seconds in. */
const SONG = song();
/** The same verse and chorus with no build between them (8 bars). */
const NO_BUILD = code(
  CHORDS_VERSE,
  CHORDS_CHORUS,
  BASS_VERSE,
  BASS_CHORUS,
  HATS_VERSE,
  HATS_CHORUS,
  MEL_CHORUS,
  "",
  ...DRUMS,
  "hats: arrange([4, hatsVerse], [4, hatsChorus])",
  'bass: arrange([4, bassVerse], [4, bassChorus]).s("ebass").lpf(600)',
  'chords: arrange([4, chordsVerse], [4, chordsChorus]).s("piano")',
  'mel: arrange([4, silence], [4, melChorus]).s("piano")',
);
/** S2: the rising hats on their own, over the kick and snare (4 bars). */
const RISING_HATS = code(...DRUMS, `hats: s("hh*16").gain(${RISE})`);
/** S5, card B: the same build, then a chorus back at the verse's level: quiet hats, one bass note a bar, no tune. */
const FLAT_CHORUS = code(
  CHORDS_VERSE,
  CHORDS_BUILD,
  CHORDS_CHORUS,
  BASS_VERSE,
  BASS_BUILD,
  'const bassChorus = n("<3 4 0 0>").scale("C2:major")',
  HATS_VERSE,
  hatsBuild(RISE),
  'const hatsChorus = s("hh*8").gain(.4)',
  fxBuild(RISER),
  "",
  ...DRUMS,
  HATS,
  BASS,
  CHORDS,
  FX,
);

/** S4: the build's hats are level. */
const HATS_STARTER = song("⟪.5⟫");
/** S6: the riser is a smooth curve and plays nothing. */
const RISER_STARTER = song(RISE, "⟪n(saw.range(0, 8).slow(4))⟫");

/**
 * The Make: verse and chorus at the same level of everything; the chorus has new chords only. The learner adds
 * a four-bar build between them and makes the chorus land with more energy.
 */
const M_CHORDS_VERSE = 'const chordsVerse = chord("<C Am F G>").voicing()';
const M_CHORDS_CHORUS = 'const chordsChorus = chord("<F G C C>").voicing()';
const M_BASS_VERSE = 'const bassVerse = n("<0 5 3 4>").scale("C2:major")';
const M_BASS_CHORUS = 'const bassChorus = n("<3 4 0 0>").scale("C2:major")';
const M_HATS_VERSE = 'const hatsVerse = s("hh*8").gain(.5)';
const M_HATS_CHORUS = 'const hatsChorus = s("hh*8").gain(.5)';
const MAKE_CONSTS = [
  M_CHORDS_VERSE,
  M_CHORDS_CHORUS,
  M_BASS_VERSE,
  M_BASS_CHORUS,
  M_HATS_VERSE,
  M_HATS_CHORUS,
];
const make = (consts: string[], tracks: string[]) => `${TEMPO}${consts.join("\n")}\n\n${tracks.join("\n")}`;
const MAKE_STARTER = make(MAKE_CONSTS, [
  'chords: arrange([4, chordsVerse], [4, chordsChorus]).s("piano")',
  'bass: arrange([4, bassVerse], [4, bassChorus]).s("ebass").lpf(600)',
  "hats: arrange([4, hatsVerse], [4, hatsChorus])",
]);
/** Verse, build, chorus for one track. */
const vbc = (prefix: string) => `arrange([4, ${prefix}Verse], [4, ${prefix}Build], [4, ${prefix}Chorus])`;
const M_BUILD_CONSTS = [
  'const chordsBuild = chord("<C Am F G>").voicing()',
  'const bassBuild = n("<0 5 3 4>").scale("C2:major")',
  `const hatsBuild = s("hh*16").gain(${RISE})`,
];
/** Minimal: a build of rising sixteenth hats, and a chorus whose hats play sixteenths, louder. */
const MAKE_MINIMAL = make(
  [
    M_CHORDS_VERSE,
    M_BUILD_CONSTS[0] as string,
    M_CHORDS_CHORUS,
    M_BASS_VERSE,
    M_BASS_CHORUS,
    M_BUILD_CONSTS[1] as string,
    M_HATS_VERSE,
    M_BUILD_CONSTS[2] as string,
    'const hatsChorus = s("hh*16").gain(.8)',
  ],
  [`chords: ${vbc("chords")}.s("piano")`, `bass: ${vbc("bass")}.s("ebass").lpf(600)`, `hats: ${vbc("hats")}`],
);
/** Beyond the brief: a swelling build with a riser, a chorus with open hats, a pumping bass and a tune up high. */
const MAKE_RICH = make(
  [
    M_CHORDS_VERSE,
    CHORDS_BUILD,
    M_CHORDS_CHORUS,
    M_BASS_VERSE,
    'const bassBuild = n("<0 5 3 4>").scale("C2:major")',
    'const bassChorus = n("<[3 3 3 3] [4 4 4 4] [0 0 0 0] [0 0 0 0]>").scale("C2:major")',
    M_HATS_VERSE,
    `const hatsBuild = s("hh*16").gain(${RISE})`,
    'const hatsChorus = s("[hh hh oh hh]*2").gain(.8)',
    'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")',
    fxBuild(RISER),
  ],
  [
    `chords: ${vbc("chords")}.s("piano")`,
    `bass: ${vbc("bass")}.s("ebass").lpf(600)`,
    `hats: ${vbc("hats")}`,
    'mel: arrange([4, silence], [4, silence], [4, melChorus]).s("piano")',
    'fx: arrange([4, silence], [4, fxBuild], [4, silence]).s("sawtooth").lpf(1200).gain(.4)',
  ],
);
/** A build is there, but the chorus is back at the verse's level: the energy does not change between them. */
const MAKE_FLAT = make(
  [
    M_CHORDS_VERSE,
    M_BUILD_CONSTS[0] as string,
    M_CHORDS_CHORUS,
    M_BASS_VERSE,
    M_BASS_CHORUS,
    M_BUILD_CONSTS[1] as string,
    M_HATS_VERSE,
    M_BUILD_CONSTS[2] as string,
    M_HATS_CHORUS,
  ],
  [`chords: ${vbc("chords")}.s("piano")`, `bass: ${vbc("bass")}.s("ebass").lpf(600)`, `hats: ${vbc("hats")}`],
);

/** Kick and snare from the Band; the learner's hats, chords and bass are their own. */
const BAND = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const HATS_GAIN: Matcher = {
  m: "controls",
  track: "hats",
  controls: [{ control: "gain", scale: "linear", tol: 0.1 }],
};
const RISER_MATCH: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  tracks: ["fx"],
};

/**
 * S8, S9 (Oak 2.0 W2): one bar of chance-made notes over the drums. `rand` is a signal like `saw`, jumping instead of
 * climbing; `.segment(8)` takes eight notes a bar from it. Strudel's chance is seeded by the bar, so the first bar is
 * always the same (evaluated: C4 A4 F4 F4 E4 D4 E4 F4, `n` 0 5 3 3 2 1 2 3); every later bar is a new eight notes.
 */
const KIT = ['kick: s("bd ~ bd ~")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*8").gain(.4)'];
const RANDOM_LINE = "n(rand.range(0, 7).segment(8))";
const FIRST_BAR = "[0 5 3 3 2 1 2 3]";
const randomBar = (line: string, tail = "") =>
  code(...KIT, `mel: ${line}.scale("C4:major").s("piano")${tail}`);
const RANDOM = randomBar(RANDOM_LINE);
const FROZEN = randomBar(`n("${FIRST_BAR}")`);
const FREEZE_STARTER = randomBar(`⟪${RANDOM_LINE}⟫`);

export default defineLesson({
  id: "U09.L04",
  version: 4,
  title: "The Energy Curve",
  objective: "I can draw a build-up with a signal so the chorus lands with more energy than the verse.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["F05"],
  practises: [],
  terms: [
    { id: "term.build-up", step: "S3" },
    { id: "term.energy-curve", step: "S5" },
  ],
  canDo: ["cd.compose.energy"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Which one lands",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "hook", code: SONG, bars: 12 },
      exercise: {
        kind: "listen",
        id: "which-one-lands",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both versions of the same verse and chorus. Listen for which chorus hits harder: the one straight after the verse, or the one with four bars in front of it.",
        skills: [{ skill: "F05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: NO_BUILD, caption: "Verse, then chorus.", bars: 8 },
          { code: SONG, caption: "Verse, four new bars, then the chorus.", bars: 12 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Read the curve",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "read-the-curve",
        version: 1,
        role: "practice",
        prompt:
          'Predict what the hats do over four bars of `s("hh*16").gain(saw.range(.2, .9).slow(4))`, then pick it. `saw` climbs from 0 to 1 over every bar, `.range(.2, .9)` makes it climb from .2 to .9 instead, and `.slow(4)` stretches one climb over four bars.',
        skills: [{ skill: "F05", w: 1 }],
        hints: null,
        tests: [],
        code: RISING_HATS,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "rise", label: "Get louder all the way through the four bars" },
          { id: "saw", label: "Get louder in every bar, then drop back" },
          { id: "level", label: "Stay at the same level" },
        ],
        correct: ["rise"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Four bars that rise",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      example: { id: "four-bars-that-rise", code: SONG, bars: 12 },
      exercise: {
        kind: "run-investigate",
        id: "four-bars-that-rise",
        version: 1,
        role: "practice",
        prompt:
          "Run the song and watch bars 5–8, between the verse and the chorus. Mute the lines one at a time to hear what each adds. Answer both questions below: what happens in bars 5–8, and how many notes the `fx` line plays in all.",
        skills: [{ skill: "F05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare bars 1–4 with bars 5–8 on the roll: how many hats, how loud, and the line that only plays there. Then count its notes.",
        },
        hints: ladder(
          "Compare bars 1–4 with bars 5–8 on the roll. Find the lines that look different.",
          "Look at the hats and at the `fx` line: the hats get denser, and `fx` only plays in those bars.",
          "The hats double up and get louder while the chords swell. Count the `fx` notes in one bar, then in how many bars it plays.",
        ),
        code: { starter: SONG },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What happens in bars 5–8?",
            options: [
              { id: "rise", label: "The hats double up and get louder, the chords swell, a line climbs" },
              { id: "fade", label: "Everything gets quieter before the chorus" },
              { id: "same", label: "The verse plays again, unchanged" },
            ],
            correct: ["rise"],
          },
          {
            q: "number",
            prompt: "How many notes does the `fx` line play?",
            correct: 8,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["rise"], number: 8 } },
            expect: "pass",
          },
          {
            name: "heard as a fade",
            response: { answer: { choice: ["fade"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two notes, one bar's worth",
            response: { answer: { choice: ["rise"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Make the hats rise",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "make-the-hats-rise",
        version: 1,
        role: "check",
        prompt:
          "The build's hats sit at one level, `.gain(.5)`. Replace the highlighted `.5` with a signal that rises from .2 at the start of the build to .9 at its end, once over all four bars. Done when the hats get louder through bars 5–8 without dropping back.",
        skills: [{ skill: "F05", w: 1 }],
        code: { starter: HATS_STARTER },
        reference: { solutions: [song()], bars: 12 },
        matcher: HATS_GAIN,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "A number stays put. Use the word from today's code that climbs.",
          "`saw` climbs from 0 to 1 in one bar. One method sets where it starts and ends, another stretches it.",
          "`saw.range(.2, .9)` starts at .2 and ends at .9, but it climbs again in every bar. Stretch it over the build.",
        ),
        tests: [
          { name: "reference", response: { code: song() }, expect: "pass" },
          {
            name: "slow first, then range",
            response: { code: song("saw.slow(4).range(.2, .9)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: song(".5") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "falls instead of rising",
            response: { code: song("saw.range(.9, .2).slow(4)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "no .slow(4): rises every bar and drops back",
            response: { code: song("saw.range(.2, .9)") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Which song rises",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-song-rises",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both cards: the same verse and build, then two different choruses. Pick the card where the chorus keeps the energy the build raised.",
        skills: [{ skill: "F05", w: 1 }],
        hints: ladder(
          "Listen to bar 9 of each card, where the chorus starts. Compare it with where the build left off.",
          "In each card, compare the chorus with the verse: the hats, the bass, and whether a tune comes in.",
          "In one card the chorus plays exactly as much as the verse did, on new chords. Which one keeps the lift?",
        ),
        stimulus: { src: "code", code: SONG, bars: 12, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "lift", label: "Card A", audio: SONG },
            { id: "flat", label: "Card B", audio: FLAT_CHORUS },
          ],
        },
        correct: { choice: ["lift"] },
        feedbackText: {
          "id.wrong":
            "In card B the chorus falls back to the verse's level: quiet hats, one bass note a bar, no tune; only its chords are new. Card A's chorus brings louder and open hats, a bass on every beat and a tune.",
        },
        srs: [{ family: "fam.frm.sections", mode: "review-if-due" }],
        tests: [
          { name: "the rising chorus", response: { answer: { choice: ["lift"] } }, expect: "pass" },
          {
            name: "the flat chorus",
            response: { answer: { choice: ["flat"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Step the riser",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "step-the-riser",
        version: 1,
        role: "check",
        prompt:
          "The highlighted `fx` curve is smooth, so it plays no notes. Add `.segment()` so it climbs the scale in eight notes, two a bar over the four bars of the build. `.segment(n)` cuts a curve into `n` steps a bar, each one a note.",
        skills: [{ skill: "F05", w: 1 }],
        code: { starter: RISER_STARTER },
        reference: { solutions: [song()], bars: 12 },
        matcher: RISER_MATCH,
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          { c: "must-use", tool: "tb.segment", feedback: "code.must-use" },
        ],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: the climb has no note here. Count the steps the curve needs over the whole build.",
          "melody.extra-note":
            "Bar {bar}, {beatLabel}: one note too many. Written after `.slow(4)`, `.segment()` counts its steps in every bar.",
        },
        hints: ladder(
          "The climb needs eight notes in all, over four bars. Decide where `.segment()` goes to give that count.",
          "`.segment()` sits on the curve. Where you put it, before or after `.slow(4)`, decides whether its count is per bar or per four bars.",
          "Before `.slow(4)`, one bar of curve becomes the whole build. So the count you give it is the number of notes in the whole build.",
        ),
        tests: [
          { name: "reference", response: { code: song() }, expect: "pass" },
          {
            name: "two steps a bar, after .slow(4)",
            response: { code: song(RISE, "n(saw.range(0, 8).slow(4).segment(2))") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: song(RISE, "n(saw.range(0, 8).slow(4))") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "four steps: C E G B",
            response: { code: song(RISE, "n(saw.range(0, 8).segment(4).slow(4))") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "eight steps a bar, after .slow(4)",
            response: { code: song(RISE, "n(saw.range(0, 8).slow(4).segment(8))") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "the notes written out, no .segment()",
            response: { code: song(RISE, 'n("<[0 1] [2 3] [4 5] [6 7]>")') },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "listen",
      title: "Chance, then again",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "chance-then-again", code: FROZEN, bars: 8 },
      exercise: {
        kind: "listen",
        id: "chance-then-again",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops over the same drums. In the first, chance picks eight new notes every bar. In the second, its first bar comes back again and again. Listen for the moment that bar stops sounding random.",
        skills: [{ skill: "F05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: RANDOM, caption: "Eight new notes every bar.", bars: 4 },
          { code: FROZEN, caption: "The first of those bars, eight times.", bars: 8 },
        ],
      },
    },
    {
      id: "S9",
      kind: "modify",
      title: "Freeze the bar",
      minutes: 1,
      optional: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "freeze-the-bar",
        version: 1,
        role: "practice",
        prompt:
          'Run the loop and read bar 1 on the roll. Replace the highlighted chance line with those eight notes as fixed numbers, `n("…")`, so the same bar plays every time. Change one note if you like. Done when no chance is left and 3 in 4 notes match bar 1.',
        skills: [{ skill: "F05", w: 1 }],
        code: { starter: FREEZE_STARTER },
        reference: { solutions: [FROZEN], bars: 4 },
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "kept",
              label: "At least 3 in 4 of the notes are the ones chance played in bar 1, in every bar",
              required: true,
              skills: ["F05"],
              rule: "matches",
              reference: { solutions: [FROZEN], bars: 4, tracks: ["mel"] },
              matcher: {
                m: "melody",
                pitch: "absolute",
                wPitch: 0.7,
                wRhythm: 0.3,
                rhythmTol: [1, 16],
                track: "mel",
              },
              // Oak's call, kept loose: a quarter of the notes may change.
              min: 0.75,
            },
            {
              id: "frozen",
              label: "No chance left on `mel`: no `rand`, `?`, `.degradeBy()` or `.sometimesBy()`",
              required: true,
              skills: ["F05"],
              rule: "custom",
              fn: "no-chance",
              params: { track: "mel" },
            },
          ],
        },
        target: { audible: false },
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Bar 1 of the loop is the one to keep. The roll shows its eight notes.",
          'Read each note of bar 1 as a degree and write the eight numbers inside `n("[ ]")`, in place of the whole `n(rand…)` call.',
          "The first note is C, degree 1 (`n` 0); the second is A, degree 6. Six more to go.",
        ),
        tests: [
          { name: "reference", response: { code: FROZEN }, expect: "pass" },
          {
            name: "frozen, the last note moved up to G",
            response: { code: randomBar('n("[0 5 3 3 2 1 2 4]")') },
            expect: "pass",
          },
          {
            name: "frozen, written without the brackets",
            response: { code: randomBar('n("0 5 3 3 2 1 2 3")') },
            expect: "pass",
          },
          {
            name: "frozen with a room",
            response: { code: randomBar(`n("${FIRST_BAR}")`, ".room(.3)") },
            expect: "pass",
          },
          { name: "unchanged", response: { code: RANDOM }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "the notes frozen, with chance still dropping some of them",
            response: { code: randomBar(`n("${FIRST_BAR}")`, ".degradeBy(.2)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "bar 2's notes frozen instead",
            response: { code: randomBar('n("[4 5 6 2 5 4 2 5]")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Make the chorus land",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "make-the-chorus-land",
        version: 1,
        role: "practice",
        prompt:
          "Add a build between the verse and the chorus: a four-bar section in every `arrange()`, its rise drawn with a signal. Then give the chorus more energy than the verse: more hats, a higher gain, or a new line. Done when the chorus is louder, busier or fuller than the verse.",
        skills: [{ skill: "F05", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [12, 32],
        saveAs: "sketch",
        rubric: [
          {
            id: "chorus-lands",
            label: "The chorus is louder, busier, higher or fuller than the verse",
            required: true,
            skills: ["F05"],
            rule: "contrast",
            a: { section: "chorus" },
            b: { section: "verse" },
            axes: ["energy"],
            minAxes: 1,
          },
          {
            id: "signal-build",
            label: "A signal, such as `saw`, in the code",
            required: false,
            skills: ["F05"],
            rule: "uses",
            tool: "tb.signal",
          },
          {
            id: "verse-build-chorus",
            label: "The sections play verse, build, chorus, in that order",
            required: false,
            skills: ["F05"],
            rule: "form",
            pattern: "verse build chorus",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Compare `hatsVerse` and `hatsChorus`: the chorus plays exactly what the verse plays. Change what the chorus plays.",
          "Give every arranged line a third section between verse and chorus, then change what the chorus consts play: more hats, a higher gain, a new line.",
          'Try `const hatsChorus = s("hh*16")` with a higher gain, and a build whose hats rise with `saw`.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: rising hats, then a louder, busier chorus",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "beyond the brief: a swelling build with a riser, a pumping bass and a tune in the chorus",
            response: { code: MAKE_RICH },
            expect: "pass",
          },
          { name: "the song from the start of the lesson", response: { code: SONG }, expect: "pass" },
          {
            name: "a build, but the chorus is back at the verse's level",
            response: { code: MAKE_FLAT },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
