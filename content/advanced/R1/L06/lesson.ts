// R1.L06 One Drummer, One Line (Oak 2.0 W2; spec: content/specs/R1.md). In a linear groove no two drums ever hit
// at the same time: the kick, the snare and the hi-hat take turns, so the beat is one line handed from drum to drum,
// and no drum keeps time on its own. Drummers build one from the top (a cymbal figure first, the kick and snare in
// its holes) or from the bottom (the kick and snare first, the hats in what is left). Split 3+3+2 in eighths, a
// change of drum or an accent on 1, the "and" of 2 and 4 gives the line its shape.
//
// Written for the learner at the gate (AUTHORING §20.1): R1 may be taken with U14–U17 unfinished, so the drums are
// sixteen-step strings on one line per drum (`kick:` `snare:` `hats:`, R1's convention), the bass a note string, and
// the only words are R1's and the core's ("grouping" is R2.L01's term: the prose says "groups of 3, 3 and 2").
//
// What the rule hears (`linear-drums`, packages/grader/src/rubric/oak2-rhythm.ts, evaluated for this lesson):
// - two drums starting together anywhere fail, beat 1 included;
// - fewer than six hits a bar (every drum line counted) fail;
// - any drum whose hits in a bar are evenly spaced (two or more) fails: hats on every eighth, but also a snare on
//   only 2 and 4 or a kick on only 1 and 3. So every groove here keeps its kick and snare off an even spacing: the
//   kick on 1 and the "and" of 3, the snare on 2, 4 and the last sixteenth of the bar;
// - with `group: [3, 3, 2]`, the hits on 1, the "and" of 2 and 4 must each be a different drum from the hit before
//   them, or the loudest hit of the bar, in three bars of four.
//
// The corrections-pass standard (AUTHORING §20.2) on every graded step: the reference, three other right answers,
// the unchanged starter, a wrong answer that uses the right tool and fails on the effect (the hats moved but left
// with the kick on 1; accents written with `.velocity()` but quieter than the kick), and the fidelity pins of
// content/validate/pins/R1.L06.ts (the hats kept on every eighth fails; toms and a ride pass; 2+3+3 fails; accents
// by `.velocity()` pass). Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const kick = (steps: string, tail = "") => `kick: s("${steps}")${tail}`;
const snare = (steps: string, tail = "") => `snare: s("${steps}")${tail}`;
const hats = (steps: string, tail = "") => `hats: s("${steps}")${tail}`;
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** The bass on the kick of the S4 groove: E on 1 and on the "and" of 3. */
const BASS = 'bass: note("e2 ~ ~ ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~").s("fingerbass").clip(.6)';

// ---- S1 and S3: an ordinary groove and a linear one ----------------------------------------------------------

/** The linear groove's kick: 1, the "and" of 2, 4, the starts of the bar's groups of 3, 3 and 2 eighths. */
const LIN_KICK = "bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~";
/** Its snare: the last sixteenth of beat 1, the second of beat 3, the "and" of 4. */
const LIN_SNARE = "~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~ ~ ~ sd ~";
/** Its hats: every sixteenth the kick and the snare leave, loud and soft in turn like two hands. */
const LIN_HATS = "~ hh hh ~ hh hh ~ hh hh ~ hh hh ~ hh ~ hh";
const LIN_BASS = 'bass: note("e2 ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ g2 ~ ~ ~").s("fingerbass").clip(.6)';
const LINEAR_DRUMS = [kick(LIN_KICK), snare(LIN_SNARE), hats(LIN_HATS, '.velocity("[1 .6]*8").gain(.7)')];
const LINEAR = code(...LINEAR_DRUMS, LIN_BASS);
/** The ordinary groove: the same kick, the snare on 2 and 4, the hi-hat on every eighth under both. */
const ORDINARY = code(
  kick(LIN_KICK),
  'snare: s("~ sd ~ sd")',
  hats("hh*8", '.velocity("[1 .6]*4").gain(.7)'),
  LIN_BASS,
);

// ---- S2: from the top, from the bottom ----------------------------------------------------------------------

/** From the top: a ride figure written first, then a kick and a snare in two of its holes each. */
const FROM_TOP = code(
  'perc: s("rd ~ ~ rd ~ ~ rd ~ rd ~ ~ rd ~ ~ rd ~").gain(.8)',
  kick("~ ~ bd ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~"),
  snare("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~"),
);
/** From the bottom: a busy kick and snare written first, then quiet hats in every place they leave. */
const FROM_BOTTOM = code(
  kick("bd ~ ~ bd ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
  snare("~ ~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ ~"),
  hats("~ hh hh ~ ~ hh hh ~ hh hh ~ hh ~ hh hh hh", ".gain(.4)"),
);

// ---- S4: the hats move into the gaps ------------------------------------------------------------------------

const S4_KICK = kick("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~");
const S4_SNARE = snare("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ sd");
const HATS_STARTER = code(S4_KICK, S4_SNARE, `hats: s("⟪hh*8⟫")`, BASS);
const hatsAnswer = (line: string) => code(S4_KICK, S4_SNARE, line, BASS);
/** The four eighths the kick and the snare leave: the "and" of 1, the "and" of 2, beat 3, the "and" of 4. */
const GAP_HATS = "~ ~ hh ~ ~ ~ hh ~ hh ~ ~ ~ ~ ~ hh ~";
const HATS_SOLUTION = hatsAnswer(hats(GAP_HATS));

// ---- S5: 3+3+2 ----------------------------------------------------------------------------------------------

/** A linear groove whose hats fill the sixteenths: beat 1 is marked by the kick, the "and" of 2 and 4 by nothing. */
const S5_KICK = "bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~";
const S5_SNARE = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~";
const S5_HATS = "~ hh hh hh ~ hh hh hh hh hh ~ hh hh hh ~ hh";
const GROUP_STARTER = code(`kick: s("⟪${S5_KICK}⟫")`, `snare: s("⟪${S5_SNARE}⟫")`, `hats: s("⟪${S5_HATS}⟫")`);
const groups = (k: string, s: string, h: string, hatTail = "") => code(kick(k), snare(s), hats(h, hatTail));
/** A kick on the "and" of 2 and a snare on 4, where the hats were. */
const GROUP_SOLUTION = groups(
  "bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~",
  "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd ~",
  "~ hh hh hh ~ hh ~ hh hh hh ~ hh ~ hh ~ hh",
);

const LINEAR_RULE = (params: Record<string, unknown>, label: string, id: string): RubricRule => ({
  id,
  label,
  required: true,
  skills: ["R14"],
  rule: "custom",
  fn: "linear-drums",
  params,
});
/** What the rule checks, in the learner's words (AUTHORING §22.3). */
const ONE_LINE_LABEL =
  "No two drums start together, beat 1 included; at least 6 hits a bar; and no drum's hits in a bar are evenly spaced (hats on every eighth, or a snare on only 2 and 4, keep time on their own)";
const ONE_LINE = LINEAR_RULE({ minHitsPerBar: 6 }, ONE_LINE_LABEL, "one-line");
const THREE_THREE_TWO = LINEAR_RULE(
  { group: [3, 3, 2] },
  "The drums still take turns, and in most bars the hits on 1, the and of 2 and 4 are each a new drum or the loudest hit of the bar",
  "three-three-two",
);

// ---- S6: the Make ---------------------------------------------------------------------------------------------

/** The starter: an ordinary beat, the kick on 1 and 3, the snare on 2 and 4, the hats on every eighth. */
const MAKE_STARTER = code(kick("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~"), 'snare: s("~ sd ~ sd")', hats("hh*8"));
const make = (...lines: string[]) => code(...lines);

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "R1.L06",
  version: 1,
  title: "One Drummer, One Line",
  objective: "I can write a beat where no two drums hit together, one line handed from drum to drum.",
  key: { tonic: "E", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["R14", "R10"],
  terms: [{ id: "term.linear-drumming", step: "S4" }],
  canDo: ["cd.code.linear-drums"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Together or in turn",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "one-line", code: LINEAR, bars: 2 },
      exercise: {
        kind: "listen",
        id: "together-or-in-turn",
        version: 1,
        role: "practice",
        prompt:
          "Two grooves over the same bass and the same kick. Listen for any moment where two drums hit at once, and notice which groove never has one.",
        skills: [{ skill: "R14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: ORDINARY,
            caption: "The hi-hat plays every eighth, whatever the kick and the snare are doing.",
            bars: 2,
          },
          { code: LINEAR, caption: "The same kick. Where do the snare and the hi-hat play now?", bars: 2 },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "From the top or the bottom",
      minutes: 0.75,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "top-or-bottom",
        version: 1,
        role: "practice",
        prompt:
          "Both grooves keep every drum to its own places. One was built from the top: a cymbal figure first, then the kick and snare in its holes. The other was built from the bottom: kick and snare first, hats in what is left. Pick the one built from the cymbal.",
        skills: [{ skill: "R14", w: 1 }],
        hints: ladder(
          "Listen to the cymbal in each card: is it the part you would hum, or a tick filling every gap?",
          "In one card the cymbal plays a figure with holes of its own and the kick and snare are few; in the other the kick and snare make a busy pattern and the hats fill every place around it.",
          "The card built from the cymbal has fewer kick and snare hits, and its cymbal is louder than its drums.",
        ),
        stimulus: { src: "code", code: FROM_BOTTOM, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "bottom", label: "Card A", audio: FROM_BOTTOM },
            { id: "top", label: "Card B", audio: FROM_TOP },
          ],
        },
        correct: { choice: ["top"] },
        feedbackText: {
          "id.wrong":
            "Listen to card A again: its kick and snare play a full pattern of their own, and soft hats fill every place they leave. That one grew from the bottom.",
        },
        tests: [
          { name: "the cymbal figure", response: { answer: { choice: ["top"] } }, expect: "pass" },
          {
            name: "the kick-and-snare one",
            response: { answer: { choice: ["bottom"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Find the groups",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "the-line", code: code(...LINEAR_DRUMS), bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "find-the-groups",
        version: 1,
        role: "practice",
        prompt:
          "Run the drums of the second groove and read one bar on the roll: eight eighths, two places in each. The bar splits into groups of 3, 3 and 2 eighths, and the kick starts each group. Pick the eighths where the groups start, then count the hits in one bar.",
        skills: [{ skill: "R14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the bar in eighths, 1 to 8, and find each kick. Then count every hit of every drum in the bar, one place at a time.",
        },
        hints: ladder(
          "Find the kicks on the roll first: there are three in the bar.",
          "Number the eighths 1 to 8: each takes two places on the roll. A group of 3 eighths is six places long.",
          "The first group starts on 1 and lasts three eighths, so the second starts right after it.",
        ),
        code: { starter: code(...LINEAR_DRUMS) },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "On which eighths of the bar do the three groups start?",
            options: [
              { id: "one-four-seven", label: "The 1st, the 4th and the 7th" },
              { id: "one-three-five-seven", label: "The 1st, the 3rd, the 5th and the 7th" },
              { id: "one-five-seven", label: "The 1st, the 5th and the 7th" },
            ],
            correct: ["one-four-seven"],
          },
          {
            q: "number",
            prompt: "How many hits does one bar hold, every drum counted?",
            correct: 16,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["one-four-seven"], number: 16 } },
            expect: "pass",
          },
          {
            name: "every beat",
            response: { answer: { choice: ["one-three-five-seven"], number: 16 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the hats only: ten",
            response: { answer: { choice: ["one-four-seven"], number: 10 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Hats in the gaps",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "hats-in-the-gaps",
        version: 1,
        role: "check",
        prompt:
          "Rewrite the hi-hat string so no hat lands with a kick or a snare: hats only on places the kick and the snare leave empty, and not on every eighth. Keep the kick and the snare. Done when no two drums sound at once.",
        skills: [
          { skill: "R14", w: 0.5 },
          { skill: "R10", w: 0.5 },
        ],
        code: { starter: HATS_STARTER },
        reference: { solutions: [HATS_SOLUTION], bars: 4 },
        // Heard: every drum's onsets, all lines together. A hat left with the kick on 1, the hats deleted, or the
        // hats still ticking every eighth (the kick and snare moved off them) all fail.
        matcher: { m: "rubric", rules: [ONE_LINE] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Look at where the hats land now: on every eighth, the places the kick and the snare play included.",
          "The kick plays the 1st and 11th of the sixteen places, the snare the 5th, the 13th and the 16th. A hat may go only where neither plays.",
          "Take the hats off the four eighths the kick and the snare already play, and keep them on the eighths that are left.",
        ),
        tests: [
          { name: "reference", response: { code: HATS_SOLUTION }, expect: "pass" },
          {
            name: "written beat by beat",
            response: { code: hatsAnswer(hats("[~ ~ hh ~] [~ ~ hh ~] [hh ~ ~ ~] [~ ~ hh ~]")) },
            expect: "pass",
          },
          {
            name: "a sixteenth more on the a of 2",
            response: { code: hatsAnswer(hats("~ ~ hh ~ ~ ~ hh hh hh ~ ~ ~ ~ ~ hh ~")) },
            expect: "pass",
          },
          {
            name: "an open hat on beat 3, soft and loud",
            response: {
              code: hatsAnswer(hats("~ ~ hh ~ ~ ~ hh ~ oh ~ ~ ~ ~ ~ hh ~", '.velocity("[1 .6]*8")')),
            },
            expect: "pass",
          },
          {
            name: "a ride and two toms in the gaps",
            response: { code: hatsAnswer(hats("~ ~ rd ~ ~ ~ lt mt rd ~ ~ ~ ~ ~ rd ~")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(HATS_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the hats moved, one left with the kick on beat 1",
            response: { code: hatsAnswer(hats("hh ~ hh ~ ~ ~ hh ~ hh ~ ~ ~ ~ ~ hh ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hats deleted: five hits a bar",
            response: { code: code(S4_KICK, S4_SNARE, BASS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "every eighth moved a sixteenth later: the last one lands on the snare",
            response: { code: hatsAnswer(hats("[~ hh]*8")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right places, silent: .gain(0)",
            response: { code: hatsAnswer(hats(GAP_HATS, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Three, three, two",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "three-three-two",
        version: 1,
        role: "check",
        prompt:
          "Split the bar into groups of 3, 3 and 2 eighths. Mark the start of each group, on 1, the and of 2 and 4: a kick or a snare where a hat was, or the loudest hat of the bar. Keep no two drums together. Done when all three starts are marked.",
        skills: [
          { skill: "R14", w: 0.5 },
          { skill: "R10", w: 0.5 },
        ],
        code: { starter: GROUP_STARTER },
        reference: { solutions: [GROUP_SOLUTION], bars: 4 },
        // Heard: the hit on each group start is a different drum from the hit before it, or the loudest of the bar.
        // A 2+3+3 split, accents that stay quieter than the kick, or a kick added on top of a hat all fail.
        matcher: { m: "rubric", rules: [THREE_THREE_TWO] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Count the bar in eighths, 1 to 8. Which eighths start the groups of 3, 3 and 2?",
          "The groups start on the 1st, 4th and 7th eighths: places 1, 7 and 13 of the sixteen. Beat 1 already has the kick; the other two starts are hats played just after other hats.",
          "On each of the two unmarked starts, take the hat away and put a kick or a snare there instead.",
        ),
        tests: [
          { name: "reference", response: { code: GROUP_SOLUTION }, expect: "pass" },
          {
            name: "a snare on the and of 2, a kick on 4",
            response: {
              code: groups(
                "bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~",
                "~ ~ ~ ~ sd ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~",
                "~ hh hh hh ~ hh ~ hh hh hh ~ hh ~ hh ~ hh",
              ),
            },
            expect: "pass",
          },
          {
            name: "the hats accented loud on the starts",
            response: {
              code: groups(
                S5_KICK,
                S5_SNARE,
                S5_HATS,
                '.velocity("1 .5 .5 .5 1 .5 1 .5 .5 .5 1 .5 1 .5 1 .5")',
              ),
            },
            expect: "pass",
          },
          {
            name: "rewritten on eighths: kick, hat, hat, snare, hat, hat, kick, hat",
            response: {
              code: groups(
                "bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~",
                "~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~",
                "~ ~ hh ~ hh ~ ~ ~ hh ~ hh ~ ~ ~ hh ~",
              ),
            },
            expect: "pass",
          },
          {
            name: "toms on the two starts",
            response: {
              code: groups(S5_KICK, S5_SNARE, "~ hh hh hh ~ hh lt hh hh hh ~ hh mt hh ~ hh"),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(GROUP_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "split 2+3+3: marks on 1, 2 and the and of 3",
            response: {
              code: groups(
                S5_KICK,
                "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",
                "~ hh hh hh ~ hh hh hh hh hh ~ hh hh hh hh hh",
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right accents with .velocity, but the hats held under the kick by .gain(.6)",
            response: {
              code: groups(
                S5_KICK,
                S5_SNARE,
                S5_HATS,
                '.velocity("1 .5 .5 .5 1 .5 1 .5 .5 .5 1 .5 1 .5 1 .5").gain(.6)',
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a kick added on the and of 2, the hat left under it",
            response: {
              code: groups(
                "bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~",
                "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd ~",
                S5_HATS,
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your one-line groove",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.aeolian-4bar", tracks: ["bass", "chords"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-one-line-groove",
        version: 1,
        role: "practice",
        title: "One line",
        prompt:
          "Turn this ordinary beat into a groove for one drummer: one drum at a time, at least six hits a bar, and no drum keeping steady time alone. It then opens your song. Also on the checklist: groups of 3, 3 and 2 eighths, and a hi-hat that goes loud and soft like two hands.",
        skills: [
          { skill: "R14", w: 0.5 },
          { skill: "R10", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          { ...ONE_LINE, id: "one-drum-at-a-time" },
          {
            id: "three-three-two-accents",
            label:
              "A kick or a snare on the 1st, 4th and 7th eighths of every bar (groups of 3, 3 and 2), and on no other eighth",
            required: false,
            skills: ["R10"],
            rule: "custom",
            fn: "grouping-accents",
            params: { track: "@drums", groups: ["3", "3", "2"], minRatio: 1 },
          },
          {
            id: "two-hands",
            label: "At least 4 hi-hat hits are soft (level .4 or less) and 2 are loud (.8 or more)",
            required: false,
            skills: ["R14"],
            rule: "velocity-ghosts",
            track: "hats",
            min: 4,
            on: "any",
            accents: 2,
          },
        ],
        hints: ladder(
          "Find where two drums play at once: the hats sit on top of every kick and snare.",
          "Clear the hats from the kick's and the snare's places. The kick on 1 and 3 and the snare on 2 and 4 are evenly spaced too: move one hit of each.",
          "One way: the kick on 1 and the and of 3, the snare on 2, 4 and the last sixteenth, the hats on the eighths that are left.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the lesson's hats in the gaps",
            response: { code: make(S4_KICK, S4_SNARE, hats(GAP_HATS)) },
            expect: "pass",
          },
          { name: "the 3+3+2 line of the lesson", response: { code: make(...LINEAR_DRUMS) }, expect: "pass" },
          {
            name: "a ride and toms, no hi-hat",
            response: {
              code: make(S4_KICK, S4_SNARE, 'perc: s("~ ~ rd ~ ~ ~ lt mt rd ~ ~ ~ ~ ~ rd ~")'),
            },
            expect: "pass",
          },
          {
            // Meets both suggestions too: the kick alone on the 1st, 4th and 7th eighths, the snare and the loud
            // hats between the eighths, the soft hats on them.
            name: "every suggestion: the kick on the group starts, hats loud and soft in turn",
            response: {
              code: make(
                kick("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~"),
                snare("~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~ ~ sd ~ ~"),
                hats("~ hh hh ~ hh hh ~ hh hh ~ hh hh ~ ~ hh hh", '.velocity("[.4 1]*8")'),
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: a two-bar line ending in a tom run, 100 BPM",
            response: {
              code: make(
                kick("<[bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~] [bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~]>"),
                snare("<[~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~ ~ ~ sd ~] [~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~]>"),
                hats(
                  "<[~ hh hh ~ hh hh ~ hh hh ~ hh hh ~ hh ~ hh] [~ hh hh ~ hh hh ~ hh hh ~ hh hh ~ ~ ~ ~]>",
                ),
                'perc: s("<[~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ht mt lt lt]>")',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(100/4)"),
            },
            expect: "pass",
          },
          {
            name: "the overlaps removed, the hats still on every eighth",
            response: {
              code: make(
                kick("~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~"),
                snare("~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd"),
                hats("hh*8"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a kick and a hat together on beat 1",
            response: { code: make(S4_KICK, S4_SNARE, hats("hh ~ hh ~ ~ ~ hh ~ hh ~ ~ ~ ~ ~ hh ~")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hats in the gaps, silent: .gain(0)",
            response: { code: make(S4_KICK, S4_SNARE, hats(GAP_HATS, ".gain(0)")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
