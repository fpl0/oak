// U10.L03 Hearing Minor. Minor degrees have their own sound against home: me sits close above re and colours
// the whole key, le leans down onto sol, te sits a whole step below do and does not pull up the way ti does.
// Hearing them after a minor cadence is how a minor tune is taken down by ear. What the learner has: natural
// minor, me le te sung on the scale (U10.L01), the relative and parallel twins (U10.L02), leaning notes and
// their resolutions in major (U03.L04, U03.L08), dictation by ear in degrees (U03.L10, U07). Not yet: minor
// chords by numeral (U10.L04), the raised 6 and 7 (U10.L06, L08). No new code and no new term: the one idea is
// the ear. Spec: content/specs/U10.md.
//
// How it is graded (AUTHORING §18.3): the key is A minor, `{ tonic: "A", mode: "minor" }`, its degrees spelled
// do-based against major (C is ♭3, F ♭6, G ♭7). The ear step is `fam.deg.fet-minor` level 1 (1, ♭3, 5 after a
// minor cadence) on a pad that offers `b3`, never `3`. The compare step has two fixed cards, the same phrase
// with me and with mi over the same low A. The dictation is a two-bar phrase written in degrees, graded
// octave-free. The Make's one required rule is `degree-set` with `contains: ["b3", "b6", "b7"]` on the melody.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The soul groove: i iv VI v (Am Dm F Em) on a Rhodes, stacked by degree. */
const GROOVE = "<0 3 5 4>";
const CHORDS = `chords: n("[0,2,4]").add(n("${GROOVE}")).scale("A2:minor").s("rhodes").room(.3)`;
/** A fingerbass bouncing root, root, octave under each chord. */
const BASS = `bass: n("[0 ~ 0 7]").add(n("${GROOVE}")).scale("A1:minor").s("fingerbass").lpf(800)`;
const mel = (tune: string) => `mel: n("${tune}").scale("A3:minor").s("piano")`;
/** The hook's tune: it starts on me (C) and lands on sol (E); every beat 1 and 3 is a chord note. */
const TUNE = "<[2 ~ 1 0] [5 ~ 3 ~] [7 ~ 5 4] [4 ~ ~ ~]>";
const HOOK = code(CHORDS, BASS, mel(TUNE));
/**
 * The tune alone after a minor cadence, i iv v i (Am Dm Em Am, natural minor: the major V waits for
 * U10.L06), one chord a beat in bar 1.
 */
const ALONE = code(
  'chords: n("<[[0,2,4] [3,5,7] [4,6,8] [0,2,4]] ~ ~ ~ ~>").scale("A2:minor").s("rhodes").room(.3)',
  mel("<~ [2 ~ 1 0] [5 ~ 3 ~] [7 ~ 5 4] [4 ~ ~ ~]>"),
);

/** The compare cards: me re do | sol, and mi re do | sol, over the same low A. */
const DRONE = 'bass: note("a1").s("fingerbass").lpf(800)';
const ME_CARD = code(DRONE, 'mel: note("<[c4 ~ b3 a3] [e4 ~ ~ ~]>").s("piano")');
const MI_CARD = code(DRONE, 'mel: note("<[c#4 ~ b3 a3] [e4 ~ ~ ~]>").s("piano")');

/** Sung: le falling to sol, then te rising to do, over a held A. */
const SING = code(
  'mel: n("<[5 4] [6 7]>").scale("A3:minor").s("piano")',
  'bass: n("0").scale("A1:minor").s("fingerbass").lpf(800)',
);

/** The dictation: me re do | le sol over Am and Dm, the hook's first two bars reshaped. */
const DICT_CHORDS = 'chords: n("[0,2,4]").add(n("<0 3>")).scale("A2:minor").s("rhodes").room(.3)';
const heard = (tune: string) => code(DICT_CHORDS, mel(tune));
const HEARD_TUNE = "<[2 ~ 1 0] [5 ~ 4 ~]>";
const HEARD = heard(HEARD_TUNE);
const HEARD_STARTER = code(DICT_CHORDS, 'mel: n("⟪0 ~ ~ ~⟫").scale("A3:minor").s("piano")');

/** The Make starts with the groove and a tune of 1 and 5 only. */
const MAKE_STARTER = code(CHORDS, BASS, mel("<[0 ~ 4 ~] [0 ~ ~ ~] [0 ~ 4 ~] [4 ~ ~ ~]>"));

/** Drums from the Band; the chords, bass and tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "A", mode: "minor" } as const;

export default defineLesson({
  id: "U10.L03",
  version: 3,
  title: "Hearing Minor",
  objective:
    "I can hear me, le and te against home in a minor key, and tell a minor tune from a major one by its 3rd.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["E10"],
  practises: [],
  terms: [],
  canDo: ["cd.hear.minor"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A groove in A minor",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-groove-in-a-minor",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two clips: the groove, then its tune alone after four chords that set home on A. Listen for the notes that give the tune its dark colour, and find their degrees on the roll.",
        skills: [{ skill: "E10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "The groove. Listen to the tune's first note against the chord under it.",
            bars: 4,
          },
          {
            code: ALONE,
            caption:
              "Four chords set home on A, then the tune alone. Match each note to its degree on the roll.",
            bars: 5,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "Do, me or sol?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "do-me-or-sol",
        version: 1,
        role: "check",
        prompt:
          "Four chords set a minor home, then one note plays. Name that note: 1, ♭3 or 5 (do, me or sol).",
        skills: [{ skill: "E10", w: 1 }],
        hints: [
          { text: "Hum home, the note the chords end on. Is the new note home itself, or above it?" },
          { text: "Sing up from do: re, then me. Is it that close? Sol is further, past fa." },
          {
            text: "Hear it again, slower, and sing do re me fa sol until you meet the note.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.deg.fet-minor", level: 1 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "degree-pad", set: ["1", "b3", "5"], syllables: true },
        correct: {},
        srs: [{ family: "fam.deg.fet-minor", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S3",
      kind: "compare",
      title: "Me or mi?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "me-or-mi",
        version: 1,
        role: "check",
        key: MINOR,
        prompt:
          "Pick the card that plays the minor tune. Both cards play the opening of the hook's tune over the same low A. Only the first note differs: one card starts on me, the other on mi.",
        skills: [{ skill: "E10", w: 1 }],
        hints: ladder(
          "Sing do, the low A, then sing up two steps. Which card's first note matches the one you land on in A minor?",
          "The cards differ in their first note only. In minor it sits a half step lower than in major.",
          "Card 2 starts on C♯, a half step above C. Which of the two is me?",
        ),
        stimulus: { src: "code", code: ME_CARD, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "me", label: "Card 1", audio: ME_CARD },
            { id: "mi", label: "Card 2", audio: MI_CARD },
          ],
        },
        correct: { choice: ["me"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "Card 2 is the bright one: it starts on C♯, mi, the 3 of A major. Card 1 starts on C, me, and that half step lower is minor. Play both again.",
        },
        tests: [
          { name: "card 1, me", response: { answer: { choice: ["me"] } }, expect: "pass" },
          {
            name: "card 2, brighter and so more finished",
            response: { answer: { choice: ["mi"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "sing",
      title: "Le to sol, te to do",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "le-to-sol-te-to-do",
        version: 1,
        role: "practice",
        prompt:
          "Listen once, then sing four notes: le falling to sol, then te rising a whole step to the high do. Sing in your own range.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "E10", w: 0.4 },
        ],
        hints: [
          { text: "Hum do, the held note underneath, before you start." },
          {
            text: "Le is a half step above sol and falls onto it. Te is a whole step below the high do and climbs to it.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // Two notes a bar: le sol, then te and do an octave above home.
        target: { from: "degrees", degrees: ["b6", "5", "b7", "1"], octaves: [0, 0, 0, 1], rhythm: "x x" },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        srs: [{ family: "fam.deg.resolve", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "dictate",
      title: "Take it down",
      minutes: 1.75,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "take-it-down",
        version: 1,
        role: "check",
        key: MINOR,
        prompt:
          "Write the two-bar tune you hear in the `mel:` line, as numbers in `n()` over `A3:minor`. Keep the `chords:` line as it is. Any octave is fine. Done when each note and the beat it starts on match the phrase.",
        skills: [
          { skill: "E10", w: 0.6 },
          { skill: "E07", w: 0.4 },
        ],
        hints: ladder(
          "Sing the phrase back. Find the note each bar ends on first, then work back from it.",
          "Bar 1 walks down by step to home; bar 2 leans from one note onto the note below it. `n` counts from 0, so degree ♭3 is `n` 2.",
          "Bar 1 is `[2 ~ 1 0]`: me re do. Bar 2 has two notes, on beats 1 and 3.",
        ),
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: your note is degree {got} ({gotSyl}); the phrase has {exp} ({expSyl}). `n` counts from 0, so degree ♭3 is `n` 2 and ♭6 is `n` 5.",
        },
        domain: "melody",
        stimulus: { src: "code", code: HEARD, bars: 2, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: HEARD_STARTER },
        reference: { solutions: [HEARD], bars: 2 },
        matcher: {
          m: "melody",
          pitch: "octave-free",
          wPitch: 0.8,
          wRhythm: 0.2,
          rhythmTol: [1, 16],
          track: "mel",
        },
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "any-octave" },
        srs: [{ family: "fam.mel.dictation", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: HEARD }, expect: "pass" },
          {
            name: "the phrase an octave up",
            response: { code: heard("<[9 ~ 8 7] [12 ~ 11 ~]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: HEARD_STARTER.replace("⟪", "").replace("⟫", "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "degree ♭3 written as n 3",
            response: { code: heard("<[3 ~ 1 0] [5 ~ 4 ~]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the right notes a bar late",
            response: { code: heard("<~ [2 ~ 1 0]>") },
            expect: "fail",
            feedback: ["melody.first-difference"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Lean on the dark notes",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "lean-on-the-dark-notes",
        version: 1,
        role: "practice",
        prompt:
          "Rewrite the `mel:` line so the tune plays all three dark notes: me, le and te (♭3, ♭6 and ♭7). Keep the chords and bass as they are. Done when all three are in the tune. If you like, lean le onto sol somewhere.",
        skills: [{ skill: "E10", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "me-le-te",
            label: "The tune plays ♭3 (me), ♭6 (le) and ♭7 (te)",
            required: true,
            skills: ["E10"],
            rule: "degree-set",
            track: "@melody",
            contains: ["b3", "b6", "b7"],
          },
          {
            id: "comes-home",
            label: "The tune's last note is 1 (do)",
            required: false,
            skills: ["S05"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "@melody",
          },
          {
            id: "on-the-chords",
            label: "Most of the tune's notes on beats 1 and 3 are notes of the chord under them",
            required: false,
            skills: ["M01"],
            rule: "chord-tones-strong",
            minRatio: 0.6,
            melody: "@melody",
            harmony: "chords",
            strength: "strong",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The tune needs all three lowered notes: ♭3, ♭6 and ♭7. So far it plays only 1 and 5.",
          "In `n()` over `A3:minor`, degree ♭3 is `n` 2, ♭6 is `n` 5 and ♭7 is `n` 6: C, F and G.",
          "Start from the hook's tune, `[2 ~ 1 0] [5 ~ 3 ~] [7 ~ 5 4]`: it has me and le. Give bar 4 a G.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the hook's tune with te over the last chord",
            response: { code: code(CHORDS, BASS, mel("<[2 ~ 1 0] [5 ~ 3 ~] [7 ~ 5 4] [6 ~ 4 ~]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars, an answer phrase that comes home, a second voice",
            response: {
              code: code(
                CHORDS,
                BASS,
                mel("<[2 ~ 1 0] [5 ~ 3 ~] [7 ~ 5 4] [6 ~ 4 ~] [4 ~ 2 4] [5 ~ 3 ~] [5 ~ 4 2] [0 ~ ~ ~]>"),
                'vox: note("<~ ~ ~ [~ ~ g4 b4] ~ ~ ~ ~>").s("piano").gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "me and le but no te",
            response: { code: code(CHORDS, BASS, mel(TUNE)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
