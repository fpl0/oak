// R3.L05 Rhythm Master Lab (spec: content/specs/R3.md). The lab: a son groove like the last lesson's, taken apart by ear,
// and rhythms from the whole track named by ear. Taking a rhythm down is counting it against a ruler: the cowbell's
// eighths, the clave's two bars, the hi-hat of a bar of 7/8. Then a figure you took down comes back displaced.
//
// Written for the learner at the gate (AUTHORING §20.1): R3.L05 always follows R1, R2 and R3.L01–L04, and U14–U17
// may be unfinished. Nothing new is taught and no term is introduced; every rhythm on the tape was built in the
// track (the clave in R3.L02, the cinquillo in R3.L01, rotation in R3.L03, the tumbao and the montuno in R3.L04,
// displacement in R1.L05, groupings in R2.L01–L02, three against two in R2.L04, swing in R1.L02). The 7/8 item
// declares its own meter and tempo line (STYLE §8: `setcpm(240/7)`, eighths at 240), as R2.L01's ear step does.
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - every required rule checks what is HEARD: the bass dictation by the onsets of the bass (a silent line has
//   none); the bell dictation by `onsets` `equals` `perBar` (the five places in EVERY bar, nothing else); the Make by
//   `displaced-copy`, which finds the bell's figure again with every hit moved by the same amount, a 16th or more and
//   less than a bar;
// - each graded step pins a WRONG answer that uses the right function (the right bass rhythm at `.gain(0)`;
//   `cb(5,8,2)`, the right call a step too far; in the Make `.late()` by a whole bar, where nothing moves inside the
//   bar, and by a 32nd, a feel rather than a new place), and at least three OTHER right answers.
// Feedback below rung 4 never names the answer.
import {
  CLAVE_OPTIONS,
  defineLesson,
  type HintLadder,
  type IdentifyEx,
  type Rat,
  type RubricRule,
  SWING_RATIO_OPTIONS,
} from "@oak/content-kit";

const BPM = 100;
const tempo = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const TEMPO = tempo(BPM);
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// --- the lab tape --------------------------------------------------------------------------------------------

/** The son clave 3-2 on the rimshot. */
const CLAVE = 'perc: s("<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>").gain(.8)';
/** The cowbell on the cinquillo, the tape's bell figure. */
const bell = (pattern: string, extra = "") => `perc2: s("${pattern}")${extra}.gain(.4)`;
const BELL = bell("cb(5,8)");
const KICK = 'kick: s("bd ~ ~ ~").gain(.6)';
/** R3.L04's tumbao over C then G7: the "and" of 2 and beat 4, the next chord's root on beat 4. */
const TUMBAO = "<[~ ~ ~ g2 ~ ~ g1 ~] [~ ~ ~ d2 ~ ~ c2 ~]>";
const BASS = `bass: note("${TUMBAO}").s("upright")`;
/** R3.L04's montuno: it faces the clave 3-2. */
const KEYS =
  'keys: note("<[[c4,e4] ~ ~ [e4,g4] [c4,e4] ~ [e4,g4] ~] [~ [d4,f4] [b3,d4] ~ [d4,f4] [b3,d4] ~ [e4,g4]]>").s("piano")';

const tape = (lines: { perc?: string; perc2?: string; kick?: string; bass?: string; keys?: string } = {}) =>
  code(lines.perc ?? CLAVE, lines.perc2 ?? BELL, lines.kick ?? KICK, lines.bass ?? BASS, lines.keys ?? KEYS);
const TAPE = tape();

/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

// --- S2: four rhythms from the track, by ear ------------------------------------------------------------------

const part = (
  id: string,
  prompt: string,
  skill: "R18" | "R16" | "R17" | "R13",
  stimulus: string,
  options: readonly { id: string; label: string }[],
  answer: string,
  neighbour: string,
  wrong: string,
  extra: Partial<Pick<IdentifyEx, "meter" | "bpm" | "swing">> = {},
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  ...extra,
  prompt,
  skills: [
    { skill: "E14", w: 0.5 },
    { skill, w: 0.5 },
  ],
  hints: earHints(),
  stimulus: { src: "code", code: stimulus, bars: 4, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "choice", options: [...options] },
  correct: { choice: [answer] },
  feedbackText: { "id.wrong": wrong },
  tests: [
    { name: answer, response: { answer: { choice: [answer] } }, expect: "pass" },
    {
      name: `heard as ${neighbour}`,
      response: { answer: { choice: [neighbour] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});
const earHints = (): HintLadder =>
  ladder(
    "Before you count, find the ruler: the steady line every other hit can be measured against.",
    "Count the ruler out loud, then say on which counts the line you are asked about lands.",
    "Clave: which bar holds three. Seven: where the group of three falls. Three against two: how many cowbell hits in a bar against how many kicks. Swing: how long the first of each pair is against the second.",
  );

/** A bar of 7/8 at 240 eighths a minute, its groups marked by the kick and the snare: 3+2+2. */
const SEVEN = `setcpm(240/7)\n\n${['drums: s("bd ~ ~ sd ~ sd ~")', 'hats: s("hh*7").gain(.35)'].join("\n")}`;
const GROUPINGS_7 = [
  { id: "2+2+3", label: "2+2+3: 1-2 1-2 1-2-3" },
  { id: "2+3+2", label: "2+3+2: 1-2 1-2-3 1-2" },
  { id: "3+2+2", label: "3+2+2: 1-2-3 1-2 1-2" },
] as const;
/** Three cowbell hits against two kicks in every bar. */
const THREE_TWO = code('kick: s("bd*2")', 'perc: s("cb*3").gain(.7)');
const POLY_OPTIONS = [
  { id: "3:2", label: "Cowbell three, kick two" },
  { id: "2:3", label: "Cowbell two, kick three" },
  { id: "straight", label: "Straight: cowbell four, kick two" },
] as const;
/** A groove whose hi-hat swings hard: the long note three times the short one. */
const HARD = `${tempo(96)}${[
  'kick: s("bd ~ bd ~")',
  'snare: s("~ sd ~ sd")',
  'hats: s("hh*8").swingBy(.5, 4).gain(.6)',
].join("\n")}`;

// --- S3: the bass, by ear --------------------------------------------------------------------------------------

/**
 * The bass's notes are given in order, two a bar (G2 G1, then D2 C2); its rhythm is not: `struct` takes the note
 * sounding at each slot it plays, so the right eight slots make the tape's bass exactly, pitches included.
 */
const BASS_NOTES = "<[g2 g1] [d2 c2]>";
const bassOf = (rhythm: string, extra = "") =>
  `bass: note("${BASS_NOTES}").struct("${rhythm}").s("upright")${extra}`;
const S3_STARTER = tape({ bass: `bass: note("${BASS_NOTES}").struct("⟪x ~ ~ ~ ~ ~ ~ ~⟫").s("upright")` });
const s3 = (bassLine: string) => tape({ bass: bassLine });

// --- S4: the bell, by ear --------------------------------------------------------------------------------------

/** The bell plays the cinquillo started one step later: 1/8, 3/8, 1/2, 3/4, 7/8. */
const ROTATED_TAPE = tape({ perc2: bell("cb(5,8,1)") });
const S4_STARTER = tape({ perc2: 'perc2: s("⟪cb(5,8)⟫").gain(.4)' });
const s4 = (pattern: string, extra = "") => tape({ perc2: bell(pattern, extra) });
const S4_SOLUTION = ROTATED_TAPE;
const ROTATED_ONSETS: Rat[] = [
  [1, 8],
  [3, 8],
  [1, 2],
  [3, 4],
  [7, 8],
];
const BELL_ROTATED: RubricRule = {
  id: "bell-rotated",
  label: "The cowbell plays the tape's five places in every bar, and nothing else",
  required: true,
  skills: ["E14"],
  rule: "onsets",
  track: "perc2",
  equals: ROTATED_ONSETS,
  perBar: true,
};

// --- S5: the Make ------------------------------------------------------------------------------------------

const MAKE_STARTER = TAPE;
const DISPLACED: RubricRule = {
  id: "bell-displaced",
  label: "The cowbell's figure from one bar comes back in another, moved by a sixteenth or more",
  required: true,
  // The lab's skill (E14: the figure the learner took down comes back) and displacement (R15, R1.L05).
  skills: ["E14", "R15"],
  rule: "custom",
  fn: "displaced-copy",
  params: { track: "perc2", min: 1 },
};

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R3.L05",
  version: 4,
  title: "Rhythm Master Lab",
  objective: "I can take down syncopated, swung and odd-meter rhythms by ear.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E14"],
  terms: [],
  canDo: ["cd.transcribe.rhythms"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The lab tape",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "tape", code: TAPE, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-lab-tape",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the lab tape, a son groove in C, twice through, then each line alone. For each line, notice two things: whether it plays on beat 1, and how many hits it plays in a bar.",
        skills: [{ skill: "E14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: TAPE, caption: "The whole tape: rimshot, cowbell, kick, bass and piano.", bars: 4 },
          { code: code(CLAVE), caption: "The rimshot alone: the two-bar frame.", bars: 2 },
          { code: code(BELL), caption: "The cowbell alone: five hits a bar.", bars: 2 },
          { code: code(BASS), caption: "The bass alone, the line you take down first.", bars: 2 },
          { code: code(KEYS), caption: "The piano alone: a two-bar figure in thirds.", bars: 2 },
        ],
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "Name the rhythm",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "all",
        id: "name-the-rhythm",
        version: 1,
        role: "check",
        prompt:
          "Four rhythms from the whole track: the tape's clave, a bar of seven, two pulses at once, and a swing. For each, count against its ruler and pick your answer.",
        skills: [{ skill: "E14", w: 1 }],
        hints: earHints(),
        srs: [
          { family: "fam.rhy.clave", mode: "review-if-due" },
          { family: "fam.rhy.odd-grouping", mode: "review-if-due" },
          { family: "fam.rhy.polyrhythm", mode: "review-if-due" },
          { family: "fam.rhy.swing", mode: "review-if-due" },
        ],
        tests: [],
        parts: [
          part(
            "the-tapes-clave",
            "The tape again. Which clave does the rimshot play?",
            "R18",
            TAPE,
            CLAVE_OPTIONS,
            "son 3-2",
            "son 2-3",
            "Not that one. Find the bar with three rimshots: is it the first of the pair or the second? Then listen to where its last hit falls against the cowbell.",
          ),
          part(
            "a-bar-of-seven",
            "A bar of seven eighths. How is it grouped?",
            "R16",
            SEVEN,
            GROUPINGS_7,
            "3+2+2",
            "2+2+3",
            "Not that one. Count the groups against the hi-hat, 1 to 7: where does the long one fall?",
            { meter: "7/8", bpm: 240 },
          ),
          part(
            "two-pulses",
            "Two pulses at once. Which against which?",
            "R17",
            THREE_TWO,
            POLY_OPTIONS,
            "3:2",
            "straight",
            "Not that one. Count the kicks of one bar, then the cowbell hits of the same bar, and listen for whether they meet anywhere but the downbeat.",
          ),
          part(
            "how-hard",
            "How hard does the hi-hat swing?",
            "R13",
            HARD,
            SWING_RATIO_OPTIONS,
            "hard",
            "triplet",
            "Not that one. Listen to one pair of hi-hat hits: how many times longer is the first than the second?",
            { bpm: 96, swing: { subdivision: 8, amount: 0.5 } },
          ),
        ],
      },
    },
    {
      id: "S3",
      kind: "dictate",
      title: "Take the bass down",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "dictation",
        id: "take-the-bass-down",
        version: 1,
        role: "check",
        prompt:
          "Take down the tape's bass rhythm. In your code its notes are given, but `struct` plays only the first, on beat 1. Write `struct`'s eight slots, one per eighth note, so your bass plays what the tape's bass plays. Compare with the tape as you go.",
        skills: [
          { skill: "E14", w: 0.7 },
          { skill: "B04", w: 0.3 },
        ],
        hints: ladder(
          "Listen to the tape's bass on beat 1 first: it may not play there.",
          "Count the eighths of one bar with the cowbell, 1 to 8. The bass takes two of them, and both bars have the same rhythm.",
          "The second bass note of each bar lands on beat 4, slot 7. Find the first one by counting back from it.",
        ),
        domain: "rhythm",
        stimulus: { src: "code", code: TAPE, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: S3_STARTER },
        reference: { solutions: [TAPE], bars: 2 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: false,
          sound: "drum-role",
          tracks: ["bass"],
        },
        pass: 0.95,
        byEar: { ab: true, rates: [1, 0.75], accepts: "exact" },
        // Where the learner's bass plays wrongly is named; where the tape's bass plays is not (that is the answer).
        feedbackText: {
          "melody.extra-note": "Bar {bar}, {beatLabel}: your bass plays where the tape's is silent.",
          "melody.missing-note": "Bar {bar}: the tape's bass has a note your bass does not play yet.",
        },
        srs: [{ family: "fam.rhy.dictation", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: TAPE }, expect: "pass" },
          { name: "the eight slots", response: { code: s3(bassOf("~ ~ ~ x ~ ~ x ~")) }, expect: "pass" },
          { name: "written with weights", response: { code: s3(bassOf("~@3 x@3 x@2")) }, expect: "pass" },
          {
            name: "written in two halves",
            response: { code: s3(bassOf("[~ ~ ~ x] [~ ~ x ~]")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S3_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "two notes on beats 2 and 4: the right count in the wrong places",
            response: { code: s3(bassOf("~ ~ x ~ ~ ~ x ~")) },
            expect: "fail",
            feedback: ["melody.extra-note", "melody.missing-note"],
          },
          {
            name: "the tresillo: a note on beat 1 too",
            response: { code: s3(bassOf("x ~ ~ x ~ ~ x ~")) },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "the right slots, silent: .gain(0)",
            response: { code: s3(bassOf("~ ~ ~ x ~ ~ x ~", ".gain(0)")) },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "dictate",
      title: "Take the bell down",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "dictation",
        id: "take-the-bell-down",
        version: 1,
        role: "check",
        prompt:
          "Change the cowbell line, which still plays the tape's cinquillo, so it plays the new cowbell figure on the tape. Everything else on the tape is the same. Compare with the tape as you go.",
        skills: [
          { skill: "E14", w: 0.7 },
          { skill: "R18", w: 0.3 },
        ],
        hints: ladder(
          "Listen for the tape's first cowbell hit of each bar and compare it with beat 1.",
          "Count its hits in one bar against the bass and the rimshot: still five, the same spacing as before, started somewhere else.",
          "Every hit sits one eighth note later than the cinquillo's. You can write the eight slots out, or give `(k,n)` its third number.",
        ),
        domain: "rhythm",
        stimulus: { src: "code", code: ROTATED_TAPE, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 2 },
        // The cowbell's hits against the tape's, by drum and onset (what the by-ear A/B compares), and, heard in
        // every bar, exactly the five places and no other: a silent bell, a bell that only plays in bar 1, and one
        // hit too many all fail.
        matcher: {
          m: "all",
          of: [
            {
              m: "events",
              pitch: "absolute",
              rhythm: "onsets",
              durations: false,
              sound: "drum-role",
              tracks: ["perc2"],
            },
            { m: "rubric", rules: [BELL_ROTATED] },
          ],
        },
        pass: 0.95,
        byEar: { ab: true, rates: [1, 0.75], accepts: "exact" },
        // Where the learner's cowbell plays wrongly is named; where the tape's plays is not (that is the answer).
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Count the tape's cowbell hits in one bar against the rimshot and listen for the first one.",
          "rhythm.extra": "Bar {bar}, {beatLabel}: your cowbell plays where the tape's is silent.",
          "rhythm.missing": "Bar {bar}: the tape's cowbell has a hit your cowbell does not play yet.",
        },
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "the method form",
            response: { code: tape({ perc2: 'perc2: s("cb").euclidRot(5, 8, 1).gain(.4)' }) },
            expect: "pass",
          },
          { name: "the eight slots", response: { code: s4("~ cb ~ cb cb ~ cb cb") }, expect: "pass" },
          {
            name: "the cinquillo an eighth later",
            response: { code: s4("cb(5,8)", ".late(1/8)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right call a step too far: cb(5,8,2)",
            response: { code: s4("cb(5,8,2)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "three hits rotated: cb(3,8,1)",
            response: { code: s4("cb(3,8,1)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right figure, silent: .gain(0)",
            response: { code: tape({ perc2: 'perc2: s("cb(5,8,1)").gain(0)' }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "Call and displaced answer",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.son-montuno", tracks: ["drums"] },
      },
      exercise: {
        kind: "code-make",
        id: "call-and-displaced-answer",
        version: 1,
        role: "practice",
        title: "Displaced son",
        prompt:
          "Displace the tape's cowbell, `perc2`: bars 1 and 2 play its figure as it is, bars 3 and 4 the same figure moved later by an eighth or a sixteenth. Keep the clave, the bass and the piano. Also on the checklist: the clave 3-2 through all four bars, and a `hats` line with ghost notes.",
        skills: [
          { skill: "R15", w: 0.6 },
          { skill: "E14", w: 0.4 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          DISPLACED,
          {
            id: "clave-holds",
            label: "The rimshot keeps the son clave 3-2 through all four bars",
            required: false,
            skills: ["R18"],
            rule: "clave",
            track: "perc",
            type: "son",
            direction: "3-2",
            minBars: 4,
          },
          {
            id: "hats-ghosted",
            label: "A `hats` line with at least 4 quiet hits on the “e”s and “a”s, between louder ones",
            required: false,
            skills: ["R14"],
            rule: "velocity-ghosts",
            track: "hats",
            min: 4,
            on: "16th-offbeat",
            accents: 2,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Leave bars 1 and 2 as they are, and move the cowbell's whole figure later in bars 3 and 4.",
          "One line can play its figure as written in some bars and moved in others: give it an amount per bar inside `< >`, or write its bars out one by one.",
          "An eighth note is an eighth of a bar, a sixteenth half that; nothing moves in bars 1 and 2. Keep the amount under a whole bar.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: an eighth later in bars 3 and 4",
            response: { code: tape({ perc2: bell("cb(5,8)", '.late("<0 0 .125 .125>")') }) },
            expect: "pass",
          },
          {
            name: "the bars written out, the moved ones as a rotation",
            response: { code: tape({ perc2: bell("<cb(5,8) cb(5,8) cb(5,8,1) cb(5,8,1)>") }) },
            expect: "pass",
          },
          {
            name: "a sixteenth later",
            response: { code: tape({ perc2: bell("cb(5,8)", '.late("<0 0 .0625 .0625>")') }) },
            expect: "pass",
          },
          {
            name: "another figure: the tresillo on the bell, moved an eighth",
            response: { code: tape({ perc2: bell("cb(3,8)", '.late("<0 0 .125 .125>")') }) },
            expect: "pass",
          },
          {
            name: "beyond the brief: ghosted sixteenth hats, no kick, 104 BPM",
            response: {
              code: tape({
                perc2: bell("cb(5,8)", '.late("<0 0 .0625 .0625>")'),
                kick: 'hats: s("hh*16").velocity("[1 .3 .6 .3]*4").gain(.4)',
              }).replace(`setcpm(${BPM}/4)`, "setcpm(104/4)"),
            },
            expect: "pass",
          },
          {
            name: "the right function, a whole bar: nothing moves inside the bar",
            response: { code: tape({ perc2: bell("cb(5,8)", '.late("<0 0 1 1>")') }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a feel, not a new place: a 32nd later",
            response: { code: tape({ perc2: bell("cb(5,8)", '.late("<0 0 .03125 .03125>")') }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a new figure in bars 3 and 4, not the same one moved",
            response: { code: tape({ perc2: bell("<cb(5,8) cb(5,8) cb(3,8) cb(3,8)>") }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "moved, but too quiet to hear: 28 dB under the rimshot",
            response: { code: tape({ perc2: 'perc2: s("cb(5,8)").late("<0 0 .125 .125>").gain(.03)' }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
