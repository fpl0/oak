// J1.L01 Swing Feel & the Ride (the jazz track's exemplar; spec: content/specs/J1.md). A jazz groove swings
// because the drummer's ride cymbal plays four beats with a short swung note just after beats 2 and 4 (ding,
// ding-a, ding, ding-a) and the hi-hat closes on 2 and 4. Written as plain eighths and swung with
// `.swingBy(1/3, 4)` (U11.L07), the same pattern turns a trio's chords and bass into a rhythm section.
//
// Written for the learner at the gate (AUTHORING §20.1): the jazz track opens after U13.CP and may be taken with
// U14–U17 unfinished, so this lesson uses only what U13.CP guarantees plus its own unlocks, the jazz kit and the
// vibraphone (contracts §3.2). The chords and bass of every example are the trio's backing and are never asked
// about: "ii–V–I" is J1.L03's term.
//
// The corrections-pass standard (AUTHORING §20.3), shown on both graded steps:
// - every required rule checks what is HEARD: the ride's skip notes must really swing (`swung-offbeats`), the
//   hi-hat must sound on 2 and 4 and NOT on 1 and 3 (`onsets` with `excludes`; a silent line has no onsets);
// - each graded step pins at least one WRONG answer that uses the right function (`.swingBy(1/3, 8)`, which
//   leaves eighths even; `.swingBy(0, 4)`; the right places at `.gain(0)`), and at least three OTHER right
//   answers (the short form `.swing(4)`, the pattern written as eighths, the swing written on the triplet grid,
//   a lighter amount inside the window).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 132;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The swing call of U11.L07: eighth notes long–short, one slice a beat in 4/4. */
const SWING = ".swingBy(1/3, 4)";
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
/** The ride on the `drums:` line (STYLE §2: the kit's timekeeping line), on the jazz kit. */
const ride = (pattern: string, call = SWING) => `drums: s("${pattern}")${call}.bank("jazzkit")`;
/** The ride pattern: a hit on every beat, a short one just after 2 and 4. */
const PATTERN = "rd [rd rd] rd [rd rd]";
const RIDE = ride(PATTERN);
const QUARTERS = "rd rd rd rd";
const hats = (pattern: string, extra = "") => `hats: s("${pattern}").bank("jazzkit")${extra}`;
const HATS = hats("~ hh ~ hh");

/** The trio's backing in C: a bass in two (root and 5th) and Rhodes comping on the Charleston. */
const BASS = 'bass: note("<[d2 a1] [g1 d2] [c2 g1] [c2 e2]>").s("upright")';
const COMP =
  'chords: chord("<Dm7 G7 C^7 C^7>").dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)';
/** A vibes line over the backing: F A C | D F | E G B G | E (every note on a beat is in its chord). */
const VIBES =
  'mel: n("<[3 ~ 5 0] [1 ~ 3 ~] [2 4 6 4] [2 ~ ~ ~]>").scale("C4:major").swingBy(1/3, 4).s("vibes")';

const TRIO = code(RIDE, HATS, BASS, COMP, VIBES);
const TRIO_QUARTERS = code(ride(QUARTERS, ""), HATS, BASS, COMP, VIBES);
const RIDE_ALONE = code(RIDE);

/** S4: the trio's backing with a ride of four swung quarters (nothing to swing); the learner adds the skip notes. */
const RIDE_STARTER = code(BASS, COMP, `drums: s("⟪${QUARTERS}⟫")${SWING}.bank("jazzkit")`);
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const rideAnswer = (line: string) => code(BASS, COMP, line);
const RIDE_SOLUTION = rideAnswer(RIDE);

/** S6: the ride in place; the hi-hat line is empty. */
const HATS_STARTER = code(BASS, COMP, RIDE, 'hats: s("⟪~ ~ ~ ~⟫").bank("jazzkit")');
const hatsAnswer = (line: string) => code(BASS, COMP, RIDE, line);
const HATS_SOLUTION = hatsAnswer(HATS);

/** S7: the Band plays bass and chords; the learner's drums start on plain quarters. */
const MAKE_STARTER = code(ride(QUARTERS, ""), HATS);

/** The skip notes really swing: each beat that holds two hits is divided long–short, about 2:1. */
const SKIPS_SWING: RubricRule = {
  id: "skips-swing",
  label: "The short hits inside beats 2 and 4 land late (long-short), not halfway through the beat",
  required: true,
  skills: ["R13"],
  rule: "custom",
  fn: "swung-offbeats",
  params: { track: "drums", min: 2 },
};
/** The hi-hat closes on 2 and 4 in every bar, and never on 1 or 3. */
const TWO_AND_FOUR: RubricRule = {
  id: "two-and-four",
  label: "The hi-hat plays on beats 2 and 4 of every bar, and not on 1 or 3",
  required: true,
  skills: ["R13"],
  rule: "onsets",
  track: "hats",
  contains: [
    [1, 4],
    [3, 4],
  ],
  excludes: [
    [0, 1],
    [1, 2],
  ],
  perBar: true,
};

/** Seconds from the start of a tap stimulus: the beats `beats` (0-based, across bars) at `bpm`. */
const at = (bpm: number, beats: number[]) => beats.map((b) => Math.round((b * 60000) / bpm) / 1000);
const TWO_AND_FOUR_TAPS = at(BPM, [1, 3, 5, 7, 9, 11, 13, 15]);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "J1.L01",
  version: 3,
  title: "Swing Feel & the Ride",
  objective: "I can play a swing ride pattern with the hi-hat on 2 and 4, and make a trio swing.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["R13"],
  terms: [{ id: "term.ride-pattern", step: "S4" }],
  canDo: ["cd.code.swing-ride"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two trios",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "trio", code: TRIO, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-trios",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the cymbal on top, the ringing sound above the trio, in both takes. Notice which take rolls forward and which only keeps count, and listen for what the cymbal plays between the beats.",
        skills: [{ skill: "R13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: TRIO, caption: "The cymbal as a swing drummer plays it.", bars: 4 },
          {
            code: TRIO_QUARTERS,
            caption: "The same trio. The cymbal plays the four beats and nothing else.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which hits move?",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "which-hits-move",
        version: 1,
        role: "practice",
        prompt:
          '`s("rd [rd rd] rd [rd rd]")` plays the cymbal on each beat, with two hits inside beats 2 and 4. Then comes `.swingBy(1/3, 4)`. Predict which of the six hits move, and pick your answer.',
        skills: [{ skill: "R13", w: 1 }],
        hints: null,
        tests: [],
        code: RIDE_ALONE,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "second-later", label: "The second hit inside beats 2 and 4: each lands later" },
          { id: "all-later", label: "Every hit: the whole line slows down" },
          { id: "two-four-earlier", label: "The hits on beats 2 and 4: each lands earlier" },
        ],
        correct: ["second-later"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Six hits, long and short",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-ride", code: RIDE_ALONE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "six-hits",
        version: 1,
        role: "practice",
        prompt:
          "Run the cymbal alone and read one bar on the roll against the beat lines. Then answer: how many hits the bar holds, and where the short hit inside beat 2 lands.",
        skills: [{ skill: "R13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop the loop and count the hits between two bar lines, then look inside beat 2: one hit on the line, one further in. How far?",
        },
        hints: ladder(
          "Stop the loop and count the hits between one bar line and the next on the roll. Then look inside beat 2: how far into the beat is its second hit?",
          "Beats 1 and 3 have one hit each; beats 2 and 4 have two. The call moves the second of the two later.",
          "Count them in one bar: 1 on beat 1, then the two in beat 2, and so on. The short hit sits in the last part of its beat.",
        ),
        code: { starter: RIDE_ALONE },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many hits does the cymbal play in one bar?", correct: 6 },
          {
            q: "choice",
            prompt: "Where does the short hit inside beat 2 land?",
            options: [
              { id: "two-thirds", label: "Two thirds of the way through the beat" },
              { id: "half", label: "Halfway through the beat" },
              { id: "quarter", label: "A quarter of the way through the beat" },
            ],
            correct: ["two-thirds"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 6, choice: ["two-thirds"] } }, expect: "pass" },
          {
            name: "four: the beats only",
            response: { answer: { number: 4, choice: ["two-thirds"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "halfway: read the straight pattern",
            response: { answer: { number: 6, choice: ["half"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Ding, ding-a",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "ride-pattern",
        version: 1,
        role: "check",
        prompt:
          "Change the cymbal line so beats 2 and 4 each play two hits: one on the beat and a short one after it. Keep one hit on beats 1 and 3, and keep the swing call. Done when the cymbal plays six hits a bar, like the target.",
        skills: [{ skill: "R13", w: 1 }],
        swing: SWUNG,
        code: { starter: RIDE_STARTER },
        reference: { solutions: [RIDE_SOLUTION], bars: 4 },
        // The cymbal's onsets on the straightened grid (contracts §6.10 item 4), and the swing measured where it
        // is heard: the beats that hold two hits must divide long–short. Swing on 16ths (`.swingBy(1/3, 8)`) or
        // an amount of 0 leaves them even and fails, though the function is the right one.
        matcher: {
          m: "all",
          of: [
            {
              m: "rhythm",
              tol: [1, 16],
              durations: false,
              perRole: false,
              displacementCredit: 0.5,
              tracks: ["drums"],
            },
            { m: "rubric", rules: [SKIPS_SWING] },
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. The two hits inside beats 2 and 4 sit an equal distance apart, so the cymbal ticks evenly. Listen to the target: the second hit of each pair is late and short.",
        },
        hints: ladder(
          "Listen to the cymbal in the target: after two of the four beats it adds a second, shorter hit. Which two beats?",
          "Beats 2 and 4 each hold two hits: one on the beat and one just after it. In mini-notation a beat that holds two sounds is a pair in square brackets.",
          "Beat 2 becomes `[rd rd]`. Beat 4 does the same; the call after the pattern does the swinging.",
        ),
        tests: [
          { name: "reference", response: { code: RIDE_SOLUTION }, expect: "pass" },
          {
            name: "the short form: .swing(4)",
            response: { code: rideAnswer(ride(PATTERN, ".swing(4)")) },
            expect: "pass",
          },
          {
            name: "written as eighths with rests",
            response: { code: rideAnswer(ride("rd ~ rd rd rd ~ rd rd")) },
            expect: "pass",
          },
          {
            name: "the swing written on the triplet grid, no call",
            response: { code: rideAnswer(ride("[rd ~ ~] [rd ~ rd] [rd ~ ~] [rd ~ rd]", "")) },
            expect: "pass",
          },
          {
            name: "a lighter swing inside the window: .3",
            response: { code: rideAnswer(ride(PATTERN, ".swingBy(.3, 4)")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(RIDE_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function on 16ths: .swingBy(1/3, 8) leaves the eighths even",
            response: { code: rideAnswer(ride(PATTERN, ".swingBy(1/3, 8)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right function with no swing: .swingBy(0, 4)",
            response: { code: rideAnswer(ride(PATTERN, ".swingBy(0, 4)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the skip notes after 1 and 3",
            response: { code: rideAnswer(ride("[rd rd] rd [rd rd] rd")) },
            expect: "fail",
            feedback: ["rhythm.displaced"],
          },
          {
            name: "the fraction in a string: no swing",
            response: { code: rideAnswer(ride(PATTERN, '.swingBy("1/3", 4)')) },
            expect: "fail",
            feedback: ["code.swing-fraction-string"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "tap",
      title: "Snap on 2 and 4",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "tap",
        id: "snap-two-and-four",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the hi-hat, the short closed “chick” under the cymbal: once on beat 2 and once on beat 4 of every bar, as a jazz audience snaps. The trio plays four bars, so eight taps in all. Done when your taps land with the hi-hat.",
        skills: [{ skill: "R13", w: 1 }],
        hints: ladder(
          "Listen past the cymbal for the hi-hat's short “chick”. It sounds on two of the four beats in every bar. Which two?",
          "Count 1, 2, 3, 4 with the cymbal and tap only on the even numbers.",
          "Say the count out loud and tap on the word two and the word four.",
        ),
        mode: "along",
        stimulus: { src: "code", code: TRIO, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "hats" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        tests: [
          { name: "on 2 and 4", response: { taps: TWO_AND_FOUR_TAPS }, expect: "pass" },
          { name: "on 1 and 3", response: { taps: at(BPM, [0, 2, 4, 6, 8, 10, 12, 14]) }, expect: "fail" },
          {
            name: "on every beat",
            response: {
              taps: at(
                BPM,
                Array.from({ length: 16 }, (_, i) => i),
              ),
            },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "The hi-hat on 2 and 4",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "hats-two-and-four",
        version: 1,
        role: "check",
        prompt:
          "Write the empty hi-hat line so it plays on beats 2 and 4 of every bar and rests on beats 1 and 3. Keep the other lines as they are.",
        skills: [{ skill: "R13", w: 1 }],
        swing: SWUNG,
        code: { starter: HATS_STARTER },
        reference: { solutions: [HATS_SOLUTION], bars: 4 },
        // Heard on 2 and 4 in every bar and never on 1 or 3: hats on every beat, on 1 and 3, or at gain 0 (silent,
        // so no onsets at all) fail.
        matcher: { m: "rubric", rules: [TWO_AND_FOUR] },
        target: { audible: true },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Count the four beats of one bar with the cymbal. The hi-hat sounds on the even beats only and stays silent on the odd ones.",
        },
        hints: ladder(
          "Use the beats you snapped on in the last step. The hi-hat line has four beats, like the cymbal's.",
          "The hi-hat line has four beats, like the cymbal: the even ones sound, the odd ones are rests.",
          "The line starts with a rest on beat 1: `~ hh` and then the same again.",
        ),
        tests: [
          { name: "reference", response: { code: HATS_SOLUTION }, expect: "pass" },
          { name: "a pair repeated", response: { code: hatsAnswer(hats("[~ hh]*2")) }, expect: "pass" },
          { name: "softer", response: { code: hatsAnswer(hats("~ hh ~ hh", ".gain(.5)")) }, expect: "pass" },
          {
            name: "inside an alternation",
            response: { code: hatsAnswer(hats("<[~ hh ~ hh]>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(HATS_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "on 1 and 3",
            response: { code: hatsAnswer(hats("hh ~ hh ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "on every beat",
            response: { code: hatsAnswer(hats("hh*4")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: hatsAnswer(hats("~ hh ~ hh", ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your swing pocket",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.two-five-one", tracks: ["bass", "chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-swing-pocket",
        version: 1,
        role: "practice",
        title: "Swing pocket",
        prompt:
          "Make the drums swing. Required: the ride cymbal (`rd`) plays the ride pattern, swung long-short. Also on the checklist: the hi-hat on beats 2 and 4 only, and a tempo of 110 to 180. For more, add a soft kick on every beat, a ghost-note snare or a vibes line on `.scale()`.",
        skills: [{ skill: "R13", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "ride-swings",
            label: "The ride cymbal swings: its pairs of hits are long-short, not even",
            required: true,
            skills: ["R13"],
            rule: "swing",
            track: ["drums", "@drums"],
            drums: ["ride"],
            subdivision: 8,
            ratio: [1.45, 2.4],
          },
          { ...TWO_AND_FOUR, required: false },
          {
            id: "swing-tempo",
            label: "`setcpm` sets a tempo between 110 and 180 beats a minute",
            required: false,
            skills: ["R13"],
            rule: "tempo-bpm",
            min: 110,
            max: 180,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Start with the cymbal line: it needs the ride pattern from earlier in this lesson, with its swing call.",
          "Four beats, with a second, shorter hit inside beats 2 and 4, and the swing call on that line.",
          'The cymbal\'s pattern is `"rd [rd rd] rd [rd rd]"`; the swing call goes after it.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the ride pattern, swung", response: { code: code(RIDE, HATS) }, expect: "pass" },
          {
            name: "beyond the brief: faster, a feathered kick, a snare comment and a vibes line",
            response: {
              code: code(
                RIDE,
                HATS,
                'kick: s("bd*4").bank("jazzkit").gain(.3)',
                'snare: s("<~ [~ ~ ~ [~ sd]]>").swingBy(1/3, 4).bank("jazzkit").gain(.4)',
                VIBES,
              ).replace(`setcpm(${BPM}/4)`, "setcpm(168/4)"),
            },
            expect: "pass",
          },
          {
            name: "a lighter swing, .2, kept",
            response: { code: code(ride(PATTERN, ".swingBy(.2, 4)"), HATS) },
            expect: "pass",
          },
          {
            name: "the swing written on the triplet grid",
            response: { code: code(ride("[rd ~ ~] [rd ~ rd] [rd ~ ~] [rd ~ rd]", ""), HATS) },
            expect: "pass",
          },
          {
            name: "the right function on 16ths: the eighths stay even",
            response: { code: code(ride(PATTERN, ".swingBy(1/3, 8)"), HATS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "eighths on the ride, straight",
            response: { code: code(ride("rd*8", ""), HATS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
