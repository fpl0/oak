// U10.L08 Melodic Minor. Harmonic minor's raised 7 (U10.L06) leaves a gap of three half steps between ♭6 and
// 7, F to G♯ in A minor, that a tune climbing home trips over. Melodic minor raises 6 as well (F♯ G♯), so the
// line climbs to home by steps; coming down, tunes usually take natural minor again (G F). In code it is a
// patterned `.scale()` per bar (U03.L05), `"<A3:melodic:minor A3:minor>"`: melodic up, natural down.
// `scale.melodic-minor` unlocks here. What the learner has: natural minor (U10.L01), the chords of a minor
// key (U10.L04), harmonic minor and the major V by chord name (U10.L06), the Andalusian cadence (U10.L07),
// chord names with `.voicing()` (U05.L08), the root bass (U08.L01). Not yet: "mode" (U14), the jazz use of
// melodic minor (the J track: one sentence here, no step). Spec: content/specs/U10.md.
//
// How it is graded: the modify step's tune is in degrees, so the scale word decides its letters; the editable
// region is bar 1's scale name, and the step is an `events` match on the absolute letters (E F♯ G♯ A, then A
// G F E). The ear step is three fixed climbs, one per form of minor, graded as one check. The Make's one
// required rule is `degree-set` with `contains: ["6", "7"]` in A minor: F♯ and G♯ are degrees 6 and 7 spelled
// against major (do-based, contracts §8.3), so a natural-minor tune (♭6 ♭7) and a harmonic-minor one (♭6 and
// 7) both fail it.
//
// Evaluated: the hook plays A C E | D C B | E F♯ G♯ | A over Am | Dm | E (E G♯ B) | Am, with the bass on A D E
// A; F♯ is a passing note over E. `bun run theory scale A:melodic:minor` → A B C D E F♯ G♯.
import { defineLesson, type HintLadder, type IdentifyEx, MINOR_OPTIONS } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Chord names on a Rhodes in a room (U05.L08), and a fingerbass on the roots (U08.L01). */
const chords = (symbols: string) => `chords: chord("${symbols}").voicing().s("rhodes").room(.3).gain(.6)`;
const bass = (symbols: string) => `bass: chord("${symbols}").rootNotes(2).s("fingerbass").lpf(800)`;
const mel = (tune: string, scales: string) => `mel: n("${tune}").scale("${scales}").s("piano")`;

/** i iv V i: the major V by name (U10.L06). */
const LOOP = "<Am Dm E Am>";
const BACKING = [chords(LOOP), bass(LOOP)] as const;
/** A C E | D C B | E ? ? | A: bar 3 climbs from 5 to home; its form of minor decides the middle notes. */
const HOOK_TUNE = "<[0 2 4 ~] [3 ~ 2 1] [4 5 6 ~] [7 ~ ~ ~]>";
const hook = (bar3: string) => code(...BACKING, mel(HOOK_TUNE, `<A3:minor!2 ${bar3} A3:minor>`));
const HOOK = hook("A3:melodic:minor");
const HOOK_HARMONIC = hook("A3:harmonic:minor");

/** The three forms of minor from A to A, one bar each, over a held A. */
const THREE = code(
  'mel: n("0 .. 7").scale("<A3:minor A3:harmonic:minor A3:melodic:minor>").s("piano")',
  'bass: n("0").scale("A1:minor").s("fingerbass").lpf(800)',
);

/** S4: up from 5 to home over E, back down over Am. The learner changes bar 1's scale name. */
const UP_DOWN = "<[4 5 6 7] [7 6 5 4]>";
const TURN = "<E Am>";
const s4 = (scales: string) => code(chords(TURN), bass(TURN), mel(UP_DOWN, scales));
const S4_STARTER = code(
  chords(TURN),
  bass(TURN),
  `mel: n("${UP_DOWN}").scale("⟪<A3:minor A3:minor>⟫").s("piano")`,
);
const S4_SOLUTION = s4("<A3:melodic:minor A3:minor>");

/**
 * S5: three climbs from 5 to home over a held A, one per form of minor. No chords: an E chord would give the
 * answer away (its G♯ against a natural G).
 */
const climb = (scale: string) =>
  code(
    'bass: n("0").scale("A1:minor").s("fingerbass").lpf(800)',
    mel("<[4 5 6 7] [7 ~ ~ ~]>", `<${scale} A3:minor>`),
  );
const CLIMBS = {
  minor: climb("A3:minor"),
  harmonic: climb("A3:harmonic:minor"),
  melodic: climb("A3:melodic:minor"),
} as const;
const WHICH_WRONG = {
  "id.wrong":
    "Listen to the two notes just below home. Both a half step lower, one raised, or both raised? A gap of three half steps is harmonic minor.",
};
const which = (
  n: number,
  stimulus: string,
  correct: "minor" | "harmonic minor" | "melodic minor",
): IdentifyEx => ({
  kind: "identify",
  id: `which-minor-${n}`,
  version: 1,
  role: "check",
  prompt: `Climb ${n}. Pick its form of minor.`,
  skills: [{ skill: "S08", w: 1 }],
  hints: ladder(
    "Hum the climb back. Does it move by even steps all the way home?",
    "Listen to the last two notes before home. A leap in the middle is harmonic minor; a smooth climb with a bright top is melodic.",
    "Natural minor's top comes home from a whole step below; the raised forms come home from a half step below.",
  ),
  stimulus: { src: "code", code: stimulus, bars: 2, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...MINOR_OPTIONS] },
  correct: { choice: [correct] },
  feedbackText: WHICH_WRONG,
  tests: [
    { name: "right", response: { answer: { choice: [correct] } }, expect: "pass" },
    {
      name: "wrong",
      response: { answer: { choice: [correct === "melodic minor" ? "minor" : "melodic minor"] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/** Sung: sol la ti do up over E, then do te le sol down over Am. */
const SING = code(chords(TURN), mel(UP_DOWN, "<A3:melodic:minor A3:minor>"));

/** The Make starts with the loop and a tune in natural minor that holds 5 over E, then leaps up to home. */
const MAKE_TUNE = "<[0 2 4 ~] [3 ~ 2 1] [4 ~ ~ ~] [7 ~ ~ ~]>";
const MAKE_STARTER = code(...BACKING, mel(MAKE_TUNE, "A3:minor"));

/** Drums from the Band; the chords, the bass and the tune are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "A", mode: "minor" } as const;
const MELODIC = { tonic: "A", mode: "melodic minor" } as const;

export default defineLesson({
  id: "U10.L08",
  version: 3,
  title: "Melodic Minor",
  objective:
    "I can tell natural, harmonic and melodic minor apart, and write a tune that climbs home through raised 6 and 7 and comes down in natural minor.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["S08"],
  practises: [],
  terms: [{ id: "term.melodic-minor", step: "S3" }],
  canDo: ["cd.write.melodic-minor"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.fingerbass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A smoother climb",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-smoother-climb",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two versions of the same loop; only bar 3 differs. Listen to the tune's climb in bar 3: which version walks up evenly, and which stretches somewhere on the way?",
        skills: [{ skill: "S08", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK_HARMONIC,
            caption: "Version 1. Listen to the middle of the climb in bar 3.",
            bars: 4,
          },
          { code: HOOK, caption: "Version 2: one note of the climb changed.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Close the gap",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "close-the-gap",
        version: 1,
        role: "practice",
        prompt:
          "Predict what F must become so the tune climbs from E to A by even steps. Over the E chord it climbs E, F, G♯, A, and F to G♯ is a wide step. Pick an answer, then hear it.",
        skills: [{ skill: "S08", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "f-sharp", label: "F♯, a half step higher" },
          { id: "f-flat", label: "F♭, a half step lower" },
          { id: "stays", label: "It stays F; G♯ must move instead" },
        ],
        correct: ["f-sharp"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Three minors",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "three-minors", code: THREE, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "three-minors",
        version: 1,
        role: "practice",
        prompt:
          "Run the code: A to A three times, in natural minor, harmonic minor, then the new scale word `melodic:minor`. Compare the top of each bar on the roll, from 5 up to home. Then answer both questions.",
        skills: [{ skill: "S08", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Put bar 1 and bar 3 side by side on the roll: read the degree labels from 5 up to home.",
        },
        hints: ladder(
          "Compare bars 2 and 3 with bar 1, and find the notes that moved in each.",
          "Read the degree labels in bar 3 from 5 up. Where a ♭ has gone, the note was raised.",
          "In bar 2, ♭6 is F and 7 is G♯. Count the keys from F up to G♯.",
        ),
        code: { starter: THREE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which degrees does the third bar raise, against natural minor?",
            options: [
              { id: "6-7", label: "6 and 7" },
              { id: "7", label: "7 only" },
              { id: "3-6-7", label: "3, 6 and 7" },
            ],
            correct: ["6-7"],
          },
          {
            q: "number",
            prompt: "In the second bar, harmonic minor, how many half steps is it from F up to G♯?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["6-7"], number: 3 } }, expect: "pass" },
          {
            name: "7 only",
            response: { answer: { choice: ["7"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step",
            response: { answer: { choice: ["6-7"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Up melodic, down natural",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "up-melodic-down-natural",
        version: 1,
        role: "check",
        key: MELODIC,
        prompt:
          "Bar 1 climbs from 5 to home over E; bar 2 comes back down over Am, both in natural minor. Change the first scale name in the pattern, bar 1's, so the climb goes through raised 6 and 7. Keep bar 2's `A3:minor`. Done when bar 1 plays E F♯ G♯ A.",
        skills: [{ skill: "S08", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 2 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          tracks: ["mel"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: the tune plays {got}; the target has {exp}. Going up, raise 6 and 7; coming down, natural minor. Raised both ways is a jazz sound, not today's.",
        },
        hints: ladder(
          "One of the three scale words raises both notes just below home. Find it.",
          "The pattern `<… …>` gives one scale per bar. Only the first one needs a new word.",
          "Harmonic minor fixes G♯ but leaves F, so the gap stays. One more word raises F too.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "natural minor called by its other name on the way down",
            response: { code: s4("<A3:melodic:minor A3:aeolian>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s4("<A3:minor A3:minor>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "harmonic minor: the gap from F to G sharp",
            response: { code: s4("<A3:harmonic:minor A3:minor>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "melodic minor on the way down too",
            response: { code: s4("<A3:melodic:minor A3:melodic:minor>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the E chord changed to Em",
            response: {
              code: code(chords("<Em Am>"), bass(TURN), mel(UP_DOWN, "<A3:melodic:minor A3:minor>")),
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
      title: "Which minor?",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "which-minor",
        version: 1,
        role: "check",
        prompt:
          "For each of the three climbs from 5 up to home, over a held A, pick natural, harmonic or melodic minor. Listen hardest to the two notes just before home.",
        skills: [{ skill: "S08", w: 1 }],
        hints: ladder(
          "Hum each climb. Does it move by even steps, or is there a wide one?",
          "Listen to the two notes just before home. Natural: F then G, a whole step under home. Harmonic: a wide step from F to G♯. Melodic: F♯ then G♯, smooth and bright.",
          "The one with the leap between its top two steps is harmonic minor.",
        ),
        srs: [{ family: "fam.key.scale-spell", mode: "review-if-due" }],
        tests: [],
        parts: [
          which(1, CLIMBS.melodic, "melodic minor"),
          which(2, CLIMBS.harmonic, "harmonic minor"),
          which(3, CLIMBS.minor, "minor"),
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing up and down",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-up-and-down",
        version: 1,
        role: "practice",
        key: MELODIC,
        prompt:
          "Listen, then sing eight notes: sol la ti do up into home, then do te le sol back down. Sing in your own range.",
        skills: [
          { skill: "V02", w: 0.6 },
          { skill: "S08", w: 0.4 },
        ],
        hints: [
          { text: "Hum do first, then sol below it. The climb starts there." },
          {
            text: "La and ti are the bright pair just below do. Te and le are the darker pair on the way down.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: {
          from: "degrees",
          degrees: ["5", "6", "7", "1", "1", "b7", "b6", "5"],
          octaves: [0, 0, 0, 1, 1, 0, 0, 0],
        },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Climb home",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "climb-home",
        version: 1,
        role: "practice",
        prompt:
          "In bar 3 the tune holds E over the E chord, then leaps up to home. Rewrite the end so it climbs home by steps through raised 6 and 7 (F♯ and G♯) over the E chord. Wherever the tune falls, keep natural minor. Done when the tune plays both F♯ and G♯.",
        skills: [{ skill: "S08", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "raised-6-and-7",
            label: "The tune plays raised 6 and 7 (F♯ and G♯)",
            required: true,
            skills: ["S08"],
            rule: "degree-set",
            track: "@melody",
            contains: ["6", "7"],
          },
          {
            id: "comes-home",
            label: "The tune's last note is 1 (A)",
            required: false,
            skills: ["S08"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "@melody",
          },
          {
            id: "falls-natural",
            label: "The tune also plays ♭6 (F), as a fall in natural minor does",
            required: false,
            skills: ["S05"],
            rule: "degree-set",
            track: "@melody",
            contains: ["b6"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Find the bar with the E chord. The tune needs notes there that climb by steps from E up to A.",
          "A patterned `.scale()` gives each bar its own form of minor: `<A3:minor!2 … A3:minor>`. Bar 3 needs the one that raises 6 and 7.",
          "Try bar 3 as `[4 5 6 ~]` with its scale set to melodic minor, and bar 4 on `n` 7, home.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the hook's climb", response: { code: HOOK }, expect: "pass" },
          {
            name: "beyond the brief: eight bars, a fall in natural minor, room on the tune",
            response: {
              code: code(
                ...BACKING,
                'mel: n("<[7 ~ 6 5] [3 ~ 2 1] [4 5 6 ~] [7 ~ ~ ~] [9 ~ 7 5] [3 ~ 2 ~] [1 2 3 4 5 6] [7 ~ ~ ~]>").scale("<A3:minor!2 A3:melodic:minor A3:minor!3 A3:melodic:minor A3:minor>").s("piano").room(.3)',
              ),
            },
            expect: "pass",
          },
          {
            name: "harmonic minor: G sharp, but F natural",
            response: { code: hook("A3:harmonic:minor") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
