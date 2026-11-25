// R1.L04 Interlock (spec: content/specs/R1.md). In a funk band no part plays the whole rhythm: the bass takes a few
// sixteenths with the kick, the clav takes others, the guitar a few more. Each part leaves gaps the others fill,
// so together they make one rhythm none of them plays alone.
//
// Written for the learner at the gate (AUTHORING §20.1): R1 may be taken with U14–U17 unfinished, so the parts
// are written as note names on one chord (Cm7) of C minor, rhythms as sixteen-step strings with `.struct()`, and
// the clav (R1.L03) is the only sound that is not from the core. Felt, then coded, then read: the learner taps
// the clav's places (S2) before reading the three parts on the roll (S3).
//
// The corrections-pass standard (AUTHORING §20.2):
// - every required rule checks what is HEARD: `interlock` reads the sixteenth grid of each bar from the parts
//   that sound (a silent part has no places), and `syncopation` counts a note only when the heavier place after
//   it is silent;
// - each graded step pins a WRONG answer that uses the right function: the clav's `.struct()` moved onto the
//   beats (it plays in the gaps but nothing pulls), the guitar's `.struct()` on the clav's own places, the
//   guitar's short chords at `.gain(0)`; in the Make, the parts on the same four beats;
// - at least three other right answers per graded step.
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Seconds per bar and per sixteenth at the lesson's tempo. */
const BAR_SEC = 240 / BPM;
const SIXTEENTH = BAR_SEC / 16;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const KICK = 'kick: s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*16").velocity("[1 .5 .8 .5]*4").gain(.4)';
const DRUMS = [KICK, SNARE, HATS];
/** The bass on 1, the "and" of 2 and the "and" of 3: the kick's three places. */
const BASS = 'bass: note("c2 ~ ~ ~ ~ ~ g2 ~ ~ ~ bb2 ~ ~ ~ ~ ~").s("fingerbass").clip(.6)';
/** The clav on the "and" of 1, the "a" of 2, beat 4 and the "and" of 4. */
const KEYS = 'keys: note("~ ~ eb4 ~ ~ ~ ~ g4 ~ ~ ~ ~ bb4 ~ g4 ~").s("clav").clip(.3)';
/** The guitar's short chords on the "e" of 1, the "e" of 3 and the "a" of 4. */
const GTR_RHYTHM = "~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ x";
const gtr = (rhythm: string, tail = "") =>
  `gtr: note("[g4,c5]").struct("${rhythm}").s("cleangtr").clip(.2).gain(.6)${tail}`;
const GTR = gtr(GTR_RHYTHM);
/** The clav as chord stabs, its rhythm a sixteen-step string. */
const keys = (rhythm: string, tail = "") =>
  `keys: note("[eb4,g4,bb4]").struct("${rhythm}").s("clav").clip(.3)${tail}`;

const PULSE = 'hats: s("hh*16").velocity("[1 .5 .8 .5]*4").gain(.3)';
const MACHINE = code(...DRUMS, BASS, KEYS, GTR);
const THREE_PARTS = code(BASS, KEYS, GTR);

/** S2: the bass and the drums, the clav quietly under them. */
const TAP_STIMULUS = code(
  ...DRUMS,
  BASS,
  'keys: note("~ ~ eb4 ~ ~ ~ ~ g4 ~ ~ ~ ~ bb4 ~ g4 ~").s("clav").clip(.3).gain(.3)',
);
/** Seconds from the start of a tap stimulus: the sixteenths `steps` of each of `bars` bars. */
const taps = (steps: number[], bars = 2) =>
  Array.from({ length: bars }, (_, b) =>
    steps.map((s) => Math.round((b * BAR_SEC + s * SIXTEENTH) * 1000) / 1000),
  ).flat();

/** S4: the clav copies the bass's rhythm. */
const BASS_RHYTHM = "x ~ ~ ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~";
const CLAV_STARTER = code(
  ...DRUMS,
  BASS,
  `keys: ⟪note("[eb4,g4,bb4]").struct("${BASS_RHYTHM}").s("clav").clip(.3)⟫`,
);
const clavAnswer = (line: string) => code(...DRUMS, BASS, line);
const CLAV_GAPS = "~ ~ x ~ ~ ~ ~ x ~ ~ ~ ~ x ~ x ~";
const CLAV_SOLUTION = clavAnswer(keys(CLAV_GAPS));

/** S5: the guitar plays on 2 and 4, where the snare already is, and on the clav's beat 4. */
const BACKBEAT = "~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~";
const GTR_STARTER = code(
  ...DRUMS,
  BASS,
  KEYS,
  `gtr: ⟪note("[g4,c5]").struct("${BACKBEAT}").s("cleangtr").clip(.2).gain(.6)⟫`,
);
const gtrAnswer = (line: string) => code(...DRUMS, BASS, KEYS, line);
const GTR_SOLUTION = gtrAnswer(GTR);

const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const CLAV_IN_GAPS: RubricRule = {
  id: "clav-in-gaps",
  label:
    "Apart from beat 1, the clav shares no place with the bass and has at least 2 places of its own; together they fill 6 or more of the 16 places",
  required: true,
  skills: ["B04", "R14"],
  rule: "custom",
  fn: "interlock",
  // The bass and the clav share nothing but the one; the clav has places of its own in every bar, and the two
  // cover at least six of the sixteen places (the bass's three and three or more of the clav's).
  params: { tracks: ["bass", "keys"], maxShared: 0, minOwn: 2, minCover: 6 },
};
const CLAV_PULLS: RubricRule = {
  id: "clav-pulls",
  label: "At least 4 clav notes pull: each on a light place, with the heavier place after it empty",
  required: true,
  skills: ["R14"],
  rule: "syncopation",
  track: "keys",
  min: 4,
};
const GTR_IN_GAPS: RubricRule = {
  id: "gtr-in-gaps",
  label:
    "Apart from beat 1, the guitar shares no place with the bass or the clav and has at least 2 places of its own; the three fill 9 or more of the 16 places",
  required: true,
  skills: ["R14"],
  rule: "custom",
  fn: "interlock",
  params: { tracks: ["bass", "keys", "gtr"], maxShared: 0, minOwn: 2, minCover: 9 },
};
const GTR_PULLS: RubricRule = {
  id: "gtr-pulls",
  label: "At least 4 guitar chords pull: each on a light place, with the heavier place after it empty",
  required: true,
  skills: ["R14"],
  rule: "syncopation",
  track: "gtr",
  min: 4,
};

/** S6: the drums are given; the bass, the clav and the guitar all play the bass's rhythm. */
const MAKE_STARTER = code(...DRUMS, BASS, keys(BASS_RHYTHM), gtr(BASS_RHYTHM));
const make = (...lines: string[]) => code(...DRUMS, ...lines);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R1.L04",
  version: 5,
  title: "Interlock",
  objective: "I can make bass, clav and guitar fit into each other's gaps, so together they play one rhythm.",
  key: { tonic: "C", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R14", "B04"],
  terms: [{ id: "term.interlock", step: "S3" }],
  canDo: ["cd.code.interlock"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One part at a time",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-machine", code: MACHINE, bars: 2 },
      exercise: {
        kind: "listen",
        id: "one-part-at-a-time",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the bass, the clav and the guitar one at a time over a quiet hi-hat, then all three with the drums. Notice the holes in each part, and whether the last loop sounds like three parts or one.",
        skills: [{ skill: "R14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: code(PULSE, BASS),
            caption: "The bass alone: three notes a bar. Where are its gaps?",
            bars: 2,
          },
          {
            code: code(PULSE, KEYS),
            caption: "The clav alone: four short notes. Does any land on the one?",
            bars: 2,
          },
          {
            code: code(PULSE, GTR),
            caption: "The guitar alone: three short chords, each close to a beat.",
            bars: 2,
          },
          { code: MACHINE, caption: "All three with the drums.", bars: 2 },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the clav",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-clav",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the clav only: the short, bright, clicking notes above the bass. It plays four times a bar and never on beat 1. Ignore the bass and the drums. Two bars, eight taps in all. Done when each tap lands with a clav note.",
        skills: [{ skill: "R14", w: 1 }],
        hints: ladder(
          "Listen past the bass for the short, bright clav notes: they fall where the bass is silent.",
          "The clav never plays on the one. Its first note comes half a beat after it.",
          "Two of the clav's four notes fall in the second half of the bar, close together.",
        ),
        mode: "along",
        stimulus: { src: "code", code: TAP_STIMULUS, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 2,
        target: { track: "keys" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        tests: [
          { name: "the clav's four places", response: { taps: taps([2, 7, 12, 14]) }, expect: "pass" },
          { name: "the bass's places", response: { taps: taps([0, 6, 10]) }, expect: "fail" },
          {
            name: "every eighth",
            response: { taps: taps([0, 2, 4, 6, 8, 10, 12, 14]) },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Read the gaps",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "three-parts", code: THREE_PARTS, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-gaps",
        version: 1,
        role: "practice",
        prompt:
          "Run the bass, the clav and the guitar without the drums and read one bar on the roll: sixteen places, four to a beat. Then answer: on how many places at least one part plays, and where two or more parts start a note together.",
        skills: [{ skill: "R14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Go along the roll one sixteenth at a time and mark each place where any of the three parts starts a note.",
        },
        hints: ladder(
          "Count each part's notes in one bar first.",
          "Count each part's notes, then look for any place where two of them start at the same moment.",
          "The bass plays three notes, the clav four. Add the guitar's, and check whether any place was counted twice.",
        ),
        code: { starter: THREE_PARTS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "On how many of the sixteen places does at least one of the three parts play?",
            correct: 10,
          },
          {
            q: "choice",
            prompt: "Where do two or more of the parts start a note together?",
            options: [
              { id: "nowhere", label: "Nowhere: each place belongs to one part" },
              { id: "one", label: "Only on the one" },
              { id: "beats", label: "On every beat" },
            ],
            correct: ["nowhere"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 10, choice: ["nowhere"] } }, expect: "pass" },
          {
            name: "every part on the one",
            response: { answer: { number: 10, choice: ["one"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the bass and the clav only: seven",
            response: { answer: { number: 7, choice: ["nowhere"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Clav in the gaps",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "clav-in-the-gaps",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the clav's `.struct()` string so it stops copying the bass. Give the clav at least three notes a bar on light places where the bass is silent, pulling against the beat. It may share only beat 1 with the bass. Keep the bass and the drums.",
        skills: [
          { skill: "B04", w: 0.5 },
          { skill: "R14", w: 0.5 },
        ],
        code: { starter: CLAV_STARTER },
        reference: { solutions: [CLAV_SOLUTION], bars: 4 },
        // Heard: the clav shares no place with the bass but the one, owns places of its own in every bar, and
        // pulls against the beat. Moving it onto the beats, onto every sixteenth, or silencing it all fail.
        matcher: { m: "rubric", rules: [CLAV_IN_GAPS, CLAV_PULLS] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the target: the clav answers in the silences after each bass note, and never on a beat that is already played.",
        },
        hints: ladder(
          "Find the places where the bass is silent: it plays only three of the sixteen.",
          "The bass plays the first, seventh and eleventh of the sixteen steps. The clav's rhythm is the string in its `.struct()`.",
          "Clear the clav's seventh and eleventh steps, then put its notes on light places just before beats the bass leaves empty.",
        ),
        tests: [
          { name: "reference", response: { code: CLAV_SOLUTION }, expect: "pass" },
          {
            name: "written beat by beat",
            response: { code: clavAnswer(keys("[~ ~ x ~] [~ ~ ~ x] [~ ~ ~ ~] [x ~ x ~]")) },
            expect: "pass",
          },
          {
            name: "other places: the e of 1, the a of 2, the e and a of 3",
            response: { code: clavAnswer(keys("~ x ~ ~ ~ ~ ~ x ~ x ~ x ~ ~ ~ ~")) },
            expect: "pass",
          },
          {
            name: "sharing the one, single notes, softer",
            response: {
              code: clavAnswer(
                'keys: note("eb4 ~ g4 ~ ~ ~ ~ bb4 ~ ~ ~ ~ ~ ~ g4 ~").s("clav").clip(.3).gain(.7)',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(CLAV_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function, on the beats: in the gaps, but nothing pulls",
            response: { code: clavAnswer(keys("x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "on every sixteenth: it covers the bass",
            response: { code: clavAnswer(keys("x*16")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "notes added, the bass's places kept",
            response: { code: clavAnswer(keys("x ~ x ~ ~ ~ x x ~ ~ x ~ x ~ x ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: clavAnswer(keys(CLAV_GAPS, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the bass edited instead",
            response: {
              code: code(
                ...DRUMS,
                'bass: note("c2 ~ ~ ~ ~ ~ ~ g2 ~ ~ ~ bb2 ~ ~ ~ ~").s("fingerbass").clip(.6)',
                keys(BASS_RHYTHM),
              ),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Add the guitar",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "add-the-guitar",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the guitar's `.struct()` string: its chords now sit on 2 and 4, on top of the snare and a clav note. Move them to places neither the bass nor the clav plays, at least two a bar, on light places that pull against the beat. Keep the bass, the clav and the drums.",
        skills: [{ skill: "R14", w: 1 }],
        code: { starter: GTR_STARTER },
        reference: { solutions: [GTR_SOLUTION], bars: 4 },
        matcher: { m: "rubric", rules: [GTR_IN_GAPS, GTR_PULLS] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the target: each guitar chord falls in a silence the bass and the clav leave, often just next to a beat.",
        },
        hints: ladder(
          "Mark the places the bass and the clav already play. The guitar can use only the places left over.",
          "Read the bass's and the clav's strings and mark their places. The guitar's chords go only on the places left over.",
          "Off the beats, seven places are still free, and each is the sixteenth just after a beat or the one just before the next.",
        ),
        tests: [
          { name: "reference", response: { code: GTR_SOLUTION }, expect: "pass" },
          {
            name: "the clav's figure a sixteenth later",
            response: { code: gtrAnswer(gtr("~ ~ ~ x ~ ~ ~ ~ x ~ ~ ~ ~ x ~ x")) },
            expect: "pass",
          },
          {
            name: "two chords a bar, written beat by beat",
            response: { code: gtrAnswer(gtr("[~ ~ ~ ~] [~ x ~ ~] [~ ~ ~ x] [~ ~ ~ ~]")) },
            expect: "pass",
          },
          {
            name: "a fuller chord, quieter",
            response: {
              code: gtrAnswer(
                'gtr: note("[eb4,g4,c5]").struct("~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ x").s("cleangtr").clip(.2).gain(.45)',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(GTR_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right function on the clav's own places",
            response: { code: gtrAnswer(gtr("~ ~ x ~ ~ ~ ~ x ~ ~ ~ ~ x ~ x ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "in the gaps, but on the beats: nothing pulls",
            response: { code: gtrAnswer(gtr("x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: gtrAnswer(gtr(GTR_RHYTHM, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your machine",
      minutes: 2.75,
      // No Band: the three interlocking parts are the lesson and all the learner's; the drums are in the starter.
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-make",
        id: "your-machine",
        version: 1,
        role: "practice",
        title: "Funk machine",
        prompt:
          "Move the clav and guitar off the bass's three places. Required: give each part at least two places of its own, share few places apart from beat 1, and fill 8 or more of the 16 places together. They then play your song's break. Also on the checklist: the bass with the kick, a clav that pulls.",
        skills: [
          { skill: "R14", w: 0.5 },
          { skill: "B04", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "parts-interlock",
            label:
              "Bass, clav and guitar each have at least 2 places of their own, at most a quarter of the played places are shared (beat 1 aside), and together they fill 8 or more of the 16",
            required: true,
            skills: ["R14", "B04"],
            rule: "custom",
            fn: "interlock",
            params: { tracks: ["bass", "keys", "gtr"], maxShared: 0.25, minOwn: 2, minCover: 8 },
          },
          {
            id: "bass-with-kick",
            label: "The bass and the kick land together most of the time",
            required: false,
            skills: ["B04"],
            rule: "groove-lock",
            kick: "kick",
            bass: "bass",
            min: 0.75,
          },
          {
            id: "clav-pulls",
            label: "At least 4 clav notes pull: each on a light place, with the heavier place after it empty",
            required: false,
            skills: ["R14"],
            rule: "syncopation",
            track: "keys",
            min: 4,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "List the places each part plays in one bar: right now all three share the same three.",
          "Each part's rhythm is the string in its `.struct()` or its note string. Keep the bass with the kick, then give the clav and the guitar the places the bass leaves.",
          "Give the clav three or four light places the bass leaves empty, then the guitar two or three that are still free.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the lesson's machine",
            response: { code: make(BASS, KEYS, GTR) },
            expect: "pass",
          },
          {
            name: "clav and guitar moved, chord stabs",
            response: { code: make(BASS, keys(CLAV_GAPS), gtr(GTR_RHYTHM)) },
            expect: "pass",
          },
          {
            name: "the guitar moved to the e of 1, the e of 3 and the e of 4",
            response: { code: make(BASS, KEYS, gtr("~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ x ~ ~")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: two chords, a busier bass with the kick, 104 BPM",
            response: {
              code: make(
                'bass: note("<[c2 ~ ~ c3 ~ ~ g2 ~ ~ ~ bb2 ~ ~ ~ ~ ~] [f2 ~ ~ f3 ~ ~ c3 ~ ~ ~ eb3 ~ ~ ~ ~ ~]>").s("fingerbass").clip(.6)',
                'keys: note("<[eb4,g4,bb4] [eb4,ab4,c5]>").struct("~ ~ x ~ ~ ~ ~ x ~ ~ ~ ~ x ~ x ~").s("clav").clip(.3)',
                'gtr: note("<[g4,c5] [ab4,c5]>").struct("~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ x").s("cleangtr").clip(.2).gain(.6)',
              )
                .replace(KICK, 'kick: s("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")')
                .replace(`setcpm(${BPM}/4)`, "setcpm(104/4)"),
            },
            expect: "pass",
          },
          {
            name: "the clav and the guitar on the same four beats",
            response: {
              code: make(
                BASS,
                keys("x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~"),
                gtr("x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the clav in the gaps, the guitar copying it",
            response: { code: make(BASS, keys(CLAV_GAPS), gtr(CLAV_GAPS)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, the guitar silent: .gain(0)",
            response: { code: make(BASS, KEYS, gtr(GTR_RHYTHM, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, the guitar 30 dB under the bass: not heard",
            response: { code: make(BASS, KEYS, gtr(GTR_RHYTHM).replace(".gain(.6)", ".gain(.03)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
