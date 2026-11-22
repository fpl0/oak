// A2.L06 Genre Translation (spec: content/specs/A2.md). A style is a set of habits, its idiom: which drums, how
// busy the bass, which sounds, how long the notes. Keep the tune and change the habits, and the same song
// becomes a quiet ballad or a driving dance track. Arrangers do it to every standard.
//
// Written for the learner at the gate (AUTHORING §20.1, pre-flight B6): A2 opens after U10.CP and A1.L07, so swing
// (U11.L07), `crunch`, the blues scale and dominant sevenths are locked on the earliest route. The two idioms are
// therefore a sustained ballad and a driving version (four on the floor on the 909, an eighth-note bass, short
// bright notes), never swung against straight. A learner who has swing may use it in the Make; nothing needs it.
//
// The piece is eight bars in two sections, `ballad` and `drive`, one `arrange()` per labelled track (STYLE §10).
// The tune is one const, `tune`, written once and dressed differently in each section's const, so its degrees and
// rhythm are the same in both by construction. The chords of the hook are the learner's; the Make's starter has
// none, and the Band plays the chords quietly under both sections (`tracks: ["chords"]`): the drums are the
// learner's, because they are one of the habits that change.
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: S4 reads the kick's onsets in bars 5–8 only (a kick on every beat of
//   every bar of the drive) and the tune's notes; the Make's `same-tune-two-ways` compares the melody of the two
//   sections (rhythm and steps from note to note) and needs them to differ on at least two of sounds, density,
//   groove and register, from the events, so a part turned down until it is masked counts as gone.
// - each pins WRONG answers that use the right function (four kicks written into the ballad; two kicks a bar; the
//   right kicks turned down until they are masked; a drive whose only change is the tune's sound; a drive sped up
//   with `.fast(2)`, which changes the tune's rhythm) and passes three or more OTHER right answers.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 90;
const TEMPO = `setcpm(${BPM}/4)\n\n`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** E C A | C A | E C E | B G: the A2 tune, every note on a beat in its chord (Am F C G). */
const TUNE = "<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>";
const TUNE_CONST = `const tune = n("${TUNE}")`;
/** Am F C G as close triads that move the shortest way, from C3 to E4. */
const CHORD_DEGREES = "<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>";
/** The same chords as stabs on the off-beat of every beat. */
const CHORD_STABS = "<[~ [0,2,4]]*4 [~ [-2,0,2]]*4 [~ [-5,-3,-1]]*4 [~ [-1,1,3]]*4>";
const ROOTS = "<a1 f1 c2 g1>";
const ROOTS_EIGHTHS = "<a1*8 f1*8 c2*8 g1*8>";
const TR909 = '.bank("RolandTR909")';

/** One const per part and section; the tracks arrange them, four bars each. */
interface Sections {
  kick: [string, string];
  snare: [string, string];
  hats?: [string, string];
  bass: [string, string];
  chords?: [string, string];
  mel: [string, string];
}
const piece = (x: Sections, melTail = ".gain(.6)") => {
  const consts = [TUNE_CONST];
  const lines: string[] = [];
  const add = (role: string, pair: [string, string] | undefined, tail = "") => {
    if (!pair) return;
    const [a, b] = pair;
    const aName = a === "silence" ? "silence" : `${role}Ballad`;
    const bName = b === "silence" ? "silence" : `${role}Drive`;
    if (a !== "silence") consts.push(`const ${role}Ballad = ${a}`);
    if (b !== "silence") consts.push(`const ${role}Drive = ${b}`);
    lines.push(`${role}: arrange([4, ${aName}], [4, ${bName}])${tail}`);
  };
  add("kick", x.kick);
  add("snare", x.snare);
  add("hats", x.hats, ".gain(.5)");
  add("bass", x.bass);
  add("chords", x.chords, ".gain(.4)");
  add("mel", x.mel, melTail);
  return `${TEMPO}${consts.join("\n")}\n\n${lines.join("\n")}`;
};

/** The ballad: a kick on the one and a rim click, the bass once a bar, strings held, the tune on a piano in a room. */
const BALLAD = {
  kick: 's("bd ~ ~ ~")',
  snare: 's("~ ~ rim ~")',
  bass: `note("${ROOTS}").s("sawtooth").lpf(500)`,
  chords: `n("${CHORD_DEGREES}").scale("A3:minor").s("strings")`,
  mel: 'tune.scale("A4:minor").s("piano").room(.4)',
} as const;
/** The drive: four on the floor and claps on the 909, off-beat hats, eighth-note bass, piano stabs, a short square. */
const DRIVE = {
  kick: `s("bd*4")${TR909}`,
  snare: `s("~ cp ~ cp")${TR909}`,
  hats: `s("[~ hh]*4")${TR909}`,
  bass: `note("${ROOTS_EIGHTHS}").s("sawtooth").lpf(500)`,
  chords: `n("${CHORD_STABS}").scale("A3:minor").s("piano")`,
  mel: 'tune.scale("A4:minor").s("square").lpf(2500).decay(.15).sustain(0)',
} as const;

const twoWays = (
  kickDrive: string = DRIVE.kick,
  melDrive: string = DRIVE.mel,
  kickBallad: string = BALLAD.kick,
) =>
  piece({
    kick: [kickBallad, kickDrive],
    snare: [BALLAD.snare, DRIVE.snare],
    hats: ["silence", DRIVE.hats],
    bass: [BALLAD.bass, DRIVE.bass],
    chords: [BALLAD.chords, DRIVE.chords],
    mel: [BALLAD.mel, melDrive],
  });
/** The hook: the ballad, then the drive. */
const HOOK = twoWays();

/** S4: the drive's kick is still the ballad's single kick. */
const KICK_STARTER = twoWays(`s("⟪bd ~ ~ ~⟫")${TR909}`);
const KICK_SOLUTION = HOOK;

/** The one rule of S4's kick: a kick on every beat of every bar of the drive. */
const FOUR_ON_THE_FLOOR: RubricRule = {
  id: "four-on-the-floor",
  label: "Bars 5 to 8: a kick on all four beats of every bar",
  required: true,
  skills: ["F06"],
  rule: "onsets",
  track: "kick",
  contains: [
    [0, 1],
    [1, 4],
    [1, 2],
    [3, 4],
  ],
  perBar: true,
  section: { bars: [5, 8] },
};

/** S5: the ballad, then a drive whose tune has new notes in bars 1 and 4 (C E A for E C A; B D for B G). */
const ALTERED_TUNE = "<[2 ~ 4 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 3 ~]>";
const NEW_TUNE_STIMULUS = twoWays(
  DRIVE.kick,
  `n("${ALTERED_TUNE}").scale("A4:minor").s("square").lpf(2500).decay(.15).sustain(0)`,
);

/** The Make: eight bars, two sections arranged the same way. */
const SAME = {
  kick: 's("bd ~ bd ~")',
  snare: 's("~ sd ~ sd")',
  bass: `note("<a1*2 f1*2 c2*2 g1*2>").s("sawtooth").lpf(500)`,
  mel: 'tune.scale("A4:minor").s("triangle")',
} as const;
const make = (o: Partial<Sections> = {}) =>
  piece({
    kick: o.kick ?? [SAME.kick, SAME.kick],
    snare: o.snare ?? [SAME.snare, SAME.snare],
    ...(o.hats ? { hats: o.hats } : {}),
    bass: o.bass ?? [SAME.bass, SAME.bass],
    ...(o.chords ? { chords: o.chords } : {}),
    mel: o.mel ?? [SAME.mel, SAME.mel],
  });
const SAME_TWICE = make();

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const BAND_CHORDS = { band: "band.aeolian-4bar", tracks: ["chords"] } as const;

export default defineLesson({
  id: "A2.L06",
  version: 3,
  title: "Genre Translation",
  objective: "I can arrange one tune in two styles: a ballad and a driving version.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["D09", "F06"],
  terms: [{ id: "term.idiom", step: "S3" }],
  canDo: ["cd.compose.genre"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One tune, two ways",
      minutes: 0.5,
      ui: { panels: ROLL },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "one-tune-two-ways",
        version: 1,
        role: "practice",
        prompt:
          "Listen to eight bars in two halves. Listen for the half you would dance to, and for the part that tells you so first.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "A ballad in bars 1–4, a driving version from bar 5. Listen for what arrives at bar 5.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "What stayed?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "what-stayed",
        version: 1,
        role: "practice",
        prompt:
          "Predict what stayed the same between the two halves you just heard. Pick one, then listen to check.",
        skills: [{ skill: "D09", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "tune", label: "The tune's notes and rhythm" },
          { id: "drums", label: "The drums" },
          { id: "sounds", label: "The sounds" },
        ],
        correct: ["tune"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "What changed",
      minutes: 1,
      ui: { panels: ROLL, initialPanels: ["form"] },
      example: { id: "two-sections", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "what-changed",
        version: 1,
        role: "practice",
        prompt:
          "Read the consts and follow the roll as it plays. Each part has one const per section, and the tune is written once, as `tune`. Answer two questions: how many bass notes play in one bar of the second half, and which part plays the same notes in the same rhythm in both halves.",
        skills: [{ skill: "D09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the bass notes in one bar of the second half on the roll. Then compare each part's two consts: which one plays the same pitches at the same moments in both?",
        },
        hints: ladder(
          "Compare each part's two consts, one for each half, and find the part written only once. Which is it?",
          "`*8` plays a note eight times in its bar. The chords and the bass keep their pitches but change their rhythm.",
          "The bass plays one note a bar in the first half. In the second, each of those notes is repeated.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many bass notes play in one bar of the second half?", correct: 8 },
          {
            q: "choice",
            prompt: "Which part plays the same notes in the same rhythm in both halves?",
            options: [
              { id: "tune", label: "The tune" },
              { id: "bass", label: "The bass" },
              { id: "chords", label: "The chords" },
            ],
            correct: ["tune"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["tune"], number: 8 } }, expect: "pass" },
          {
            name: "the bass for the part that stays",
            response: { answer: { choice: ["bass"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one note a bar counted",
            response: { answer: { choice: ["tune"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Drive the drums",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "drive-the-drums",
        version: 1,
        role: "check",
        prompt:
          "The drive's kick, `kickDrive`, still plays the ballad's one hit a bar. Change it so the kick lands on all four beats of every bar in bars 5 to 8. Leave the ballad's consts and the tune as they are.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: KICK_STARTER },
        reference: { solutions: [KICK_SOLUTION], bars: 8 },
        matcher: {
          m: "all",
          of: [
            { m: "rubric", rules: [FOUR_ON_THE_FLOOR] },
            {
              m: "events",
              pitch: "absolute",
              rhythm: "onsets",
              durations: false,
              tracks: ["mel"],
            },
          ],
        },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet":
            "Not met yet: {label}. Count along with bars 5 to 8 and listen for a kick on each beat. Change the drive's kick, not the ballad's.",
        },
        hints: ladder(
          "Only the kick of bars 5 to 8 changes. Which const plays it?",
          "`kickDrive` is the second section of the kick's `arrange()`. Its pattern has one hit and three rests.",
          "Four equal steps in a bar land on the four beats. Fill the rests with kicks, or repeat one kick four times.",
        ),
        tests: [
          { name: "reference", response: { code: KICK_SOLUTION }, expect: "pass" },
          {
            name: "the four kicks written out",
            response: { code: twoWays(`s("bd bd bd bd")${TR909}`) },
            expect: "pass",
          },
          {
            name: "on the default kit",
            response: { code: twoWays('s("bd*4")') },
            expect: "pass",
          },
          {
            name: "four kicks and one more on the and of 4",
            response: { code: twoWays(`s("bd bd bd [bd bd]")${TR909}`) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: twoWays(`s("bd ~ ~ ~")${TR909}`) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right kicks in the wrong section: the ballad",
            response: { code: twoWays(`s("bd ~ ~ ~")${TR909}`, DRIVE.mel, 's("bd*4")') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "two kicks a bar",
            response: { code: twoWays(`s("bd*2")${TR909}`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right kicks turned down until they are not heard",
            response: { code: twoWays(`s("bd*4")${TR909}.gain(.02)`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the kicks right, but the drive's tune sped up",
            response: { code: twoWays(DRIVE.kick, `${DRIVE.mel}.fast(2)`) },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Same tune?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "same-tune",
        version: 1,
        role: "check",
        prompt:
          "Listen to a ballad, then a driving version, and follow the top line through both. Pick what the second half does with the tune.",
        skills: [{ skill: "D09", w: 1 }],
        hints: [
          {
            text: "Hum the first bar of the ballad's tune, then compare it with bar 5. Does the drive start the same way?",
          },
          {
            text: "Leave the drums and the bass aside and follow only the highest line, bar by bar.",
          },
          { text: "Hear it again, slower, and compare bar 1 with bar 5.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "code", code: NEW_TUNE_STIMULUS, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "same", label: "The same tune in a new style" },
            { id: "higher", label: "The same tune, moved higher" },
            { id: "new", label: "A changed tune: some of its notes are new" },
          ],
        },
        correct: { choice: ["new"] },
        feedbackText: {
          "id.wrong":
            "Not this one. The drive's first bar starts upward where the ballad's starts downward, and its last bar ends lower: a changed tune, dressed in new habits.",
        },
        srs: [{ family: "fam.snd.roles", mode: "review-if-due" }],
        tests: [
          { name: "a changed tune", response: { answer: { choice: ["new"] } }, expect: "pass" },
          {
            name: "the same tune",
            response: { answer: { choice: ["same"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "moved higher",
            response: { answer: { choice: ["higher"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Two ways",
      minutes: 2.75,
      ui: { panels: ROLL, initialPanels: ["form"], band: BAND_CHORDS },
      exercise: {
        kind: "code-make",
        id: "two-ways",
        version: 1,
        role: "practice",
        prompt:
          "The tune plays in a `ballad` section and a `drive` section, arranged the same way. Make them two styles: change at least two of the drums, how busy the bass is, the sounds and the register, in one section's consts. Keep the tune's notes and rhythm in both. Done when the two halves sound like two styles.",
        skills: [
          { skill: "D09", w: 0.5 },
          { skill: "F06", w: 0.5 },
        ],
        code: { starter: SAME_TWICE },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-styles",
            label:
              "The tune keeps its rhythm and its steps in both sections, and the sections differ in at least two of: sounds, density, groove, register",
            required: true,
            skills: ["D09", "F06"],
            rule: "custom",
            fn: "same-tune-two-ways",
            params: { melody: "mel", a: { section: "ballad" }, b: { section: "drive" }, minAxes: 2 },
          },
          {
            id: "a-part-of-its-own",
            label:
              "A part silent for a whole bar or more that plays elsewhere, such as one only the drive has",
            required: false,
            skills: ["D09"],
            rule: "custom",
            fn: "parts-enter",
            params: { min: 1 },
          },
          {
            id: "drive-denser",
            label: "Ballad and drive at least a quarter apart in notes heard per bar",
            required: false,
            skills: ["D09"],
            rule: "contrast",
            a: { section: "drive" },
            b: { section: "ballad" },
            axes: ["density"],
            minAxes: 1,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Right now the two halves sound alike. Pick one section and decide what it should sound like. Which of its consts would you change first?",
          "Each part has a `Ballad` and a `Drive` const. Change two or more habits in one of them: the drums' pattern, the bass's rhythm, the sounds, the length of the notes.",
          "Start with the drive's kick and bass: more hits a bar, and the 909. Then give its tune a shorter, brighter sound.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: SAME_TWICE },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: a kick on every beat and a busy bass in the drive",
            response: {
              code: make({
                kick: [SAME.kick, 's("bd*4")'],
                bass: [SAME.bass, `note("${ROOTS_EIGHTHS}").s("sawtooth").lpf(500)`],
              }),
            },
            expect: "pass",
          },
          {
            name: "a ballad on strings against a 909 version with an eighth-note bass",
            response: {
              code: make({
                kick: ['s("bd ~ ~ ~")', `s("bd*4")${TR909}`],
                snare: ['s("~ ~ rim ~")', `s("~ cp ~ cp")${TR909}`],
                bass: [
                  `note("${ROOTS}").s("sawtooth").lpf(500)`,
                  `note("${ROOTS_EIGHTHS}").s("sawtooth").lpf(500)`,
                ],
                mel: ['tune.scale("A4:minor").s("strings")', SAME.mel],
              }),
            },
            expect: "pass",
          },
          {
            name: "the drive an octave up, with new drums",
            response: {
              code: make({
                kick: [SAME.kick, `s("bd*4")${TR909}`],
                snare: [SAME.snare, `s("~ cp ~ cp")${TR909}`],
                mel: [SAME.mel, 'tune.scale("A5:minor").s("triangle")'],
              }),
            },
            expect: "pass",
          },
          { name: "beyond the brief: the hook", response: { code: HOOK }, expect: "pass" },
          {
            name: "two tunes: the drive's notes changed",
            response: {
              code: make({
                kick: [SAME.kick, `s("bd*4")${TR909}`],
                bass: [SAME.bass, `note("${ROOTS_EIGHTHS}").s("sawtooth").lpf(500)`],
                mel: [SAME.mel, `n("${ALTERED_TUNE}").scale("A4:minor").s("triangle")`],
              }),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "one habit only: the tune's sound",
            response: {
              code: make({ mel: [SAME.mel, 'tune.scale("A4:minor").s("square").lpf(2500)'] }),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function, the wrong result: the whole drive sped up",
            response: {
              code: make({
                kick: [SAME.kick, `${SAME.kick}.fast(2)`],
                snare: [SAME.snare, `${SAME.snare}.fast(2)`],
                bass: [SAME.bass, `${SAME.bass}.fast(2)`],
                mel: [SAME.mel, `${SAME.mel}.fast(2)`],
              }),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
