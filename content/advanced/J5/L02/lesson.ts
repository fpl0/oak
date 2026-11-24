// J5.L02 Backdoor (spec: content/specs/J5.md). A tune can come home from a whole step below: Fm7, B♭7, Cmaj7.
// The minor iv borrowed from C minor (U16.L01) leads to the dominant on ♭7 (U16.L02's ♭VII, now with its
// 7th), and in the left hand's voicings its A♭ falls to G while the bass climbs from B♭ to C: the backdoor,
// softer and more wistful than G7 to C.
//
// Written for the learner at the gate (AUTHORING §20.1): J5 opens after U17.CP and J4.L04, so the whole core and
// J1–J4 and J5.L01 are behind the learner. The lesson unlocks no tool: chord symbols by name, `.dict("lefthand")`,
// the jazz kit and the vibes. Keys rotate as the jazz track does: heard in C (S1–S3), written in G (S4), made in
// F (S6). A ballad at 76 BPM; the chords are held a bar each, the bass plays in two.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - what is HEARD: S4 compares the chords that sound and their lowest note (`pcset` per onset with the bass);
//   the Make's `device-count` reads the chords that sound (a muted chords line has none) and counts a backdoor
//   only where the minor iv is followed by a DOMINANT on ♭7 that lands on home;
// - each graded step pins a wrong answer that uses the right device wrongly (♭VII as a major seventh; C's
//   backdoor carried into G or F; the iv left major; a backdoor that lands somewhere else) and three other right
//   answers (`!` for a repeated chord, the bass written by hand, the lines written out without the const; in the
//   Make, the backdoor in other bars of the loop).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 76;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const SWING = ".swingBy(1/3, 4)";
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const C = { tonic: "C", mode: "major" } as const;
const G = { tonic: "G", mode: "major" } as const;
const F = { tonic: "F", mode: "major" } as const;

/** The trio of J1: the ride pattern and the hi-hat on 2 and 4 on the jazz kit. */
const RIDE = `drums: s("rd [rd rd] rd [rd rd]")${SWING}.bank("jazzkit")`;
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** A ballad's Rhodes: each chord held for its bar, in the left hand's voicings. */
const held = (changes: string) => `chords: chord(${changes}).dict("lefthand").voicing().s("rhodes").gain(.6)`;
/** A bass in two from the same string: the root on 1 and 3. */
const ROOTS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")';

/**
 * The hook, in C: eight bars, home through the front door (Dm7 G7 Cmaj7), then through the back (Fm7 B♭7 Cmaj7).
 * The bass falls a 5th from G2 to C2 in bars 2–3, and climbs a whole step from B♭1 to C2 in bars 6–7. The vibes
 * lean on A♭ in bars 5 and 6 (the 3rd of Fm7, the 7th of B♭7) and fall to G in bar 7 (evaluated: in `lefthand`
 * B♭7 is D4 G4 A♭4 C5 and Cmaj7 is B3 D4 E4 G4, so the voicing's A♭4 falls a half step to G4 as well).
 */
const FRONT = "<Dm7 G7 C^7 C^7>";
const BACK = "<Fm7 Bb7 C^7 C^7>";
const FRONT_BASS = "[d2 a1] [d2 g2] [c2 g1] [c2 e2]";
const BACK_BASS = "[f2 c2] [f2 bb1] [c2 g1] [c2 e2]";
const FRONT_MEL = "[a4 ~ f4 d4] [f4 ~ ~ b3] [c4 e4 g4 b4] [e4 ~ ~ ~]";
const BACK_MEL = "[ab4 ~ f4 c4] [ab4 ~ ~ d4] [g4 e4 c4 g3] [c4 ~ ~ ~]";
const bass = (bars: string) => `bass: note("<${bars}>").s("upright")`;
const vibes = (bars: string) => `mel: note("<${bars}>")${SWING}.s("vibes")`;
const ending = (changes: string, bassBars: string, melBars: string) =>
  code(RIDE, HATS, bass(bassBars), held(`"${changes}"`), vibes(melBars));
const TRIO_FRONT = ending(FRONT, FRONT_BASS, FRONT_MEL);
const TRIO_BACK = ending(BACK, BACK_BASS, BACK_MEL);
const HOOK = ending(
  "<Dm7 G7 C^7 C^7 Fm7 Bb7 C^7 C^7>",
  `${FRONT_BASS} ${BACK_BASS}`,
  `${FRONT_MEL} ${BACK_MEL}`,
);

/** S4: the ii–V–I in G from one string; the learner comes in through the back door instead. */
const inG = (changes: string, bassLine = ROOTS) =>
  code(`const changes = "${changes}"`, "", RIDE, HATS, held("changes"), bassLine);
const BACK_STARTER = inG("<⟪Am7 D7⟫ G^7 G^7>");
const BACK_SOLUTION = inG("<Cm7 F7 G^7 G^7>");

/**
 * S6: a slow loop in F over the Band's drums, a hand-written bass (root and 5th) and a vibes tune. The bass is
 * written by hand so the rule hears the chords from the chords line only (a `rootNotes()` bass carries its
 * chord's name: grader gap 1 of the spec). The tune's notes fit the starter and the backdoor in bars 3–4:
 * C A E over Fmaj7, F A D over Dm7, F and B♭ over Gm7 or B♭m7 (the 7th and 3rd, or the 5th and root), G over C7
 * or E♭7 (the 5th, or the 3rd), and it comes home on C.
 */
const MAKE_MEL = "[c5 ~ a4 e4] [f4 ~ a4 d5] [f5 ~ bb4 ~] [g4 ~ ~ ~]";
const MAKE_BASS = "[f2 c2] [d2 a1] [g1 d2] [c2 g1]";
const loopF = (changes: string, bassBars = MAKE_BASS, melBars: string | null = MAKE_MEL) =>
  code(
    `const changes = "${changes}"`,
    "",
    held("changes"),
    bass(bassBars),
    ...(melBars ? [vibes(melBars)] : []),
  );
const MAKE_STARTER = loopF("<F^7 Dm7 Gm7 C7>");
/** The backdoor in bars 3–4, home on the loop's next bar: B♭ and F, then E♭ and B♭ in the bass. */
const BACKDOOR_BASS = "[f2 c2] [d2 a1] [bb1 f2] [eb2 bb1]";

/** The Make's one idea: the minor iv, the dominant on ♭7, then home, heard on the chords line. */
const BACKDOOR: RubricRule = {
  id: "backdoor",
  label: "Home through the back door: the minor iv7, then the dominant a whole step below home",
  required: true,
  skills: ["J13"],
  rule: "device-count",
  devices: ["backdoor"],
  min: 1,
};

/**
 * The bass moves with the new chords (review): the brief asks for it and the bass is written by hand, so a back
 * door over the old roots is told so. A suggestion: a Make has one required rule.
 */
const BASS_FOLLOWS: RubricRule = {
  id: "bass-follows",
  label: "At every chord change the bass plays the new chord's root",
  required: false,
  skills: ["J13"],
  rule: "bass-line",
  track: "bass",
  harmony: "chords",
  roots: { on: "change", minRatio: 1 },
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J5.L02",
  version: 4,
  title: "Backdoor",
  objective: "I can bring a tune home through the backdoor: the minor iv, the dominant on ♭7, then home.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["J13"],
  terms: [{ id: "term.backdoor", step: "S4" }],
  canDo: ["cd.write.backdoor"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two doors home",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "two-doors-home",
        version: 1,
        role: "practice",
        prompt:
          "Listen to how each ending arrives on Cmaj7 in bar 3. Notice which arrival is firm and which is softer.",
        skills: [{ skill: "J13", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: TRIO_FRONT,
            caption: "A ii–V–I in C, the way you know it.",
            bars: 4,
          },
          {
            code: TRIO_BACK,
            caption: "Two other chords before the same Cmaj7.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "From B♭ to C",
      minutes: 0.5,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "predict",
        id: "from-b-flat-to-c",
        version: 1,
        role: "practice",
        prompt:
          "The second ending: Fm7, B♭7, Cmaj7. Bar 2 ends with the bass on B♭. Predict how the bass reaches C in bar 3, and pick your answer.",
        skills: [{ skill: "J13", w: 1 }],
        hints: null,
        tests: [],
        code: TRIO_BACK,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "whole-step", label: "Up a whole step, B♭ to C" },
          { id: "fifth", label: "Down a 5th, as G did in the first ending" },
          { id: "half-step", label: "Down a half step, as D♭ did in the last lesson" },
        ],
        correct: ["whole-step"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where the chords come from",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "back-door", code: TRIO_BACK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-chords-come-from",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read the roll. Answer two questions: which numerals the three chords are in C major, and how many half steps the A♭ in the Rhodes moves from bar 2 into bar 3.",
        skills: [{ skill: "J13", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count each chord's root up from C, and check whether its 3rd is major or minor. Then find the A♭ in bar 2's chord on the roll and the note just below it in bar 3.",
        },
        hints: ladder(
          "Count each root up from C, then check each chord's 3rd: major or minor.",
          "F is degree 4 of C and B♭ is degree ♭7. F minor is the sad iv borrowed from C minor; the chord on ♭7 here has a 7th of its own.",
          "The first chord is iv7. On the roll, A♭ sits in bar 2's Rhodes chord; in bar 3 the nearest note to it is G.",
        ),
        code: { starter: TRIO_BACK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which numerals are Fm7, B♭7 and Cmaj7 in C major?",
            options: [
              { id: "iv-bvii-i", label: "iv7, ♭VII7, Imaj7" },
              { id: "ii-v-i", label: "ii7, V7, Imaj7" },
              { id: "iv-major", label: "IV7, ♭VII7, Imaj7" },
            ],
            correct: ["iv-bvii-i"],
          },
          {
            q: "number",
            prompt: "A♭ is the 7th of B♭7. In bar 3 it moves to G. By how many half steps?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 1, choice: ["iv-bvii-i"] } }, expect: "pass" },
          {
            name: "read as a ii–V",
            response: { answer: { number: 1, choice: ["ii-v-i"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step: the bass's move, not the A♭'s",
            response: { answer: { number: 2, choice: ["iv-bvii-i"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "The back door in G",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "back-door-in-g",
        version: 1,
        role: "check",
        key: G,
        prompt:
          "A ii–V–I in G: Am7, D7, Gmaj7. Rewrite the first two chords in `changes` so the tune comes home the way the softer ending did: the minor iv7, then the dominant seventh a whole step below G. Keep Gmaj7.",
        skills: [{ skill: "J13", w: 1 }],
        swing: SWUNG,
        code: { starter: BACK_STARTER },
        reference: { solutions: [BACK_SOLUTION], bars: 4 },
        // The chords that sound and their lowest note, onset by onset: both new chords must be the right
        // qualities on the right roots (one string drives the comping and the bass).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Listen to the bass from bar 2 into bar 3 in the target, and to the colour of the chord in bar 1: it is darker than anything in G major.",
        },
        hints: ladder(
          "In C the back door used degrees 4 and ♭7. Count those degrees up from G.",
          "Count up from G: degree 4 is C, and ♭7 is the note a whole step below G. The first chord is minor, the second a dominant seventh.",
          "The second chord's root sits a whole step below G, and it is the same kind of chord as D7.",
        ),
        tests: [
          { name: "reference", response: { code: BACK_SOLUTION }, expect: "pass" },
          {
            name: "the last chord written once with !",
            response: { code: inG("<Cm7 F7 G^7!2>") },
            expect: "pass",
          },
          {
            name: "the bass written by hand",
            response: {
              code: inG("<Cm7 F7 G^7 G^7>", 'bass: note("<c2 f2 g2 g2>").struct("x ~ x ~").s("upright")'),
            },
            expect: "pass",
          },
          {
            name: "the chords and the bass written out, no const",
            response: {
              code: code(
                RIDE,
                HATS,
                held('"<Cm7 F7 G^7 G^7>"'),
                'bass: chord("<Cm7 F7 G^7 G^7>").rootNotes(2).struct("x ~ x ~").s("upright")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(BACK_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right roots, ♭VII as a major seventh: no dominant to pull home",
            response: { code: inG("<Cm7 F^7 G^7 G^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "C's backdoor carried over into G",
            response: { code: inG("<Fm7 Bb7 G^7 G^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the iv left major: IV7",
            response: { code: inG("<C7 F7 G^7 G^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Three ways home",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "three-ways-home",
        version: 1,
        role: "check",
        prompt:
          "Short endings in different keys, one at a time. Each comes home through the V7, through its tritone substitute, or through the back door. For each, pick which.",
        skills: [{ skill: "J13", w: 1 }],
        hints: [
          {
            text: "Hum the lowest note of the last two chords: the bass falls, slides or climbs into home.",
          },
          {
            text: "Through the V7 the bass falls a 5th; through the substitute it steps down a half step; through the back door it climbs a whole step.",
          },
          {
            text: "Hear it again, slower, and hum only the last two bass notes: a step up into home is the back door.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        // Level 2: the backdoor joins the ii–V7–I and the ii–♭II7–I of level 1.
        stimulus: { src: "generator", family: "fam.jzz.subs", level: 2 },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "V7-I", label: "Through the V7: the bass falls a 5th" },
            { id: "bII7-I", label: "Through the substitute: the bass slides down a half step" },
            { id: "backdoor", label: "Through the back door: the bass climbs a whole step" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.jzz.subs", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your late-night loop",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-late-night-loop",
        version: 1,
        role: "practice",
        key: F,
        title: "Late-night loop in F",
        prompt:
          "The loop is Fmaj7, Dm7, Gm7, C7: the last A section of your song. Required: bring it home to Fmaj7 through the back door, the minor iv7 and then the dominant seventh a whole step below home. Also on the checklist: the bass plays each chord's root, and a tritone substitute somewhere else in the loop.",
        skills: [{ skill: "J13", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          BACKDOOR,
          BASS_FOLLOWS,
          {
            id: "a-tritone-sub",
            label: "A dominant somewhere else in the loop is replaced by its tritone substitute",
            required: false,
            skills: ["J13"],
            rule: "device-count",
            devices: ["tritone sub"],
            min: 1,
          },
        ],
        // The override serves every rule, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Change bars 3 and 4, the two bars that lead back into Fmaj7 when the loop comes round.",
          "In F, degree 4 is B♭ and ♭7 is the note a whole step below F. The first of the two chords is minor, the second a dominant seventh.",
          "Bar 3 becomes the minor seventh on B♭, the bass on its root. Bar 4 follows the way B♭7 followed Fm7 in C.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: bars 3 and 4 through the back door, home on the next bar",
            response: { code: loopF("<F^7 Dm7 Bbm7 Eb7>", BACKDOOR_BASS) },
            expect: "pass",
          },
          {
            name: "beyond the brief: D♭ falling to C, a tritone sub sliding into B♭m7, slower",
            response: {
              code: loopF(
                "<F^7 B7 Bbm7 Eb7>",
                "[f2 c2] [b1 f#2] [bb1 f2] [eb2 bb1]",
                "[c5 ~ a4 e4] [f#4 ~ a4 d#5] [f5 ~ bb4 ~] [db5 ~ ~ ~]",
              ).replace(`setcpm(${BPM}/4)`, "setcpm(66/4)"),
            },
            expect: "pass",
          },
          {
            name: "the back door in bars 1 and 2, home in bar 3, a tune of its own",
            response: {
              code: loopF(
                "<Bbm7 Eb7 F^7 F^7>",
                "[bb1 f2] [eb2 bb1] [f2 c2] [f2 a1]",
                "[f4 ~ ab4 db5] [db5 ~ ~ g4] [a4 ~ c5 e5] [c5 ~ ~ ~]",
              ),
            },
            expect: "pass",
          },
          {
            name: "the back door in bars 2 and 3, no tune",
            response: { code: loopF("<F^7 Bbm7 Eb7 F^7>", "[f2 c2] [bb1 f2] [eb2 bb1] [f2 a1]", null) },
            expect: "pass",
          },
          {
            name: "the back door in the chords, the bass left on G and C: passes, the bass suggestion unmet",
            response: { code: loopF("<F^7 Dm7 Bbm7 Eb7>") },
            expect: "pass",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the iv left major: B♭7 then E♭7",
            response: { code: loopF("<F^7 Dm7 Bb7 Eb7>", BACKDOOR_BASS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right roots, ♭VII as a major seventh: nothing pulls home",
            response: { code: loopF("<F^7 Dm7 Bbm7 Eb^7>", BACKDOOR_BASS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a back door that never lands: Dm7 after E♭7",
            response: {
              code: loopF("<Bbm7 Eb7 Dm7 Gm7>", "[bb1 f2] [eb2 bb1] [d2 a1] [g1 d2]", null),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the back door written, the chords line silent: .gain(0)",
            response: {
              code: loopF("<F^7 Dm7 Bbm7 Eb7>", BACKDOOR_BASS).replace(
                '.s("rhodes").gain(.6)',
                '.s("rhodes").gain(0)',
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
