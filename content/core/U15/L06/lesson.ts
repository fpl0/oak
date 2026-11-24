// U15.L06 Hearing Secondaries. A lab with no new idea: the learner already has the four secondary dominants of
// the unit (V7/V, V7/vi, V7/ii, V7/IV: U15.L02, U15.L03) and the chromatic degrees that make them (fi, si, di, te:
// U15.L01). Today they are found and named by ear, with one method: listen for the note that does not belong,
// name it, and follow it. Fi rises to sol, so the chord was the V7 of V; si rises to la, the V7 of vi; di rises to
// re, the V7 of ii; te falls to la, the V7 of IV. The root of the next chord, a 5th below the visitor's, confirms
// it. Three ways: locate (the drill), name (three fixed loops in three keys), write down (bass, then numerals).
// Then the learner's staircase of sevenths from U12.L04 gets two doors opened by ear. Not here: the leading-tone
// chord (its bass is the giveaway, U15.L04) and chains (U15.L05). Spec: content/specs/U15.md.
//
// How it is graded (AUTHORING §17.3, §19.6): "which bar" is the `fam.har.chromatic` generator at level 2 on
// `bar-buttons`; "which one" is a `choice` per loop; the dictation is staged, bass on the degree pad, then
// numerals on the palette with `secondary` allowed (`harmony` matcher at seventh depth). The Make's one required
// rule is `contains-rn` with `kind: ["secondary-dominant"]` and `mustResolve`, `min: 2`: the staircase has none,
// so Oak's copy fails it, and a visitor that does not land on its chord does not count.
import {
  type AnswerUi,
  defineLesson,
  type HintLadder,
  type IdentifyEx,
  type KeySpec,
} from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const C_MAJOR: KeySpec = { tonic: "C", mode: "major" };
const G_MAJOR: KeySpec = { tonic: "G", mode: "major" };
const F_MAJOR: KeySpec = { tonic: "F", mode: "major" };
const B_FLAT_MAJOR: KeySpec = { tonic: "Bb", mode: "major" };

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
/** The root of every chord, low on the upright: the voicing above does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/**
 * The hook: an eight-bar soul ballad. Two bars lean out of the key and straight back: bar 2 is A7 (the V7 of ii,
 * the tune on C♯, di) into Dm; bar 6 is C7 (the V7 of IV, the tune on B♭, te) into F. Evaluated: the bass plays
 * C A D G C C F G; the tune E G E | C♯ E G | F D | D B | E G E | B♭ G E | A F | G F D.
 */
const HOOK_FORM = "<C A7 Dm G7 C C7 F G7>";
const HOOK_TUNE = "<[2 ~ 4 2] [0# ~ 2 4] [3 ~ 1 ~] [1 ~ -1 ~] [2 ~ 4 2] [6b ~ 4 2] [5 ~ 3 ~] [4 ~ 3 1]>";
// Learner review: the lab has no new chord, so the record that opens it brings a sound: the trumpet of U15.L05 sings
// the tune over a strings pad. The pitches are those above; only the instruments differ from the Make.
const PAD = 'pad: chord(changes).voicing().s("strings").gain(.3)';
const horn = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("trumpet")`;
const ballad = (form: string, pattern: string) => code(changes(form), CHORDS, BASS, PAD, horn(pattern));
const HOOK = ballad(HOOK_FORM, HOOK_TUNE);

/** S4: the hook's first four bars, taken down. I V7/ii ii V7 over the bass 1 6 2 5. */
const FIRST_FOUR = ballad("<C A7 Dm G7>", "<[2 ~ 4 2] [0# ~ 2 4] [3 ~ 1 ~] [1 ~ -1 ~]>");

/** S3: a loop heard without its code, comped, one visitor in bar 2 aimed at bar 3. */
const heard = (form: string) =>
  code(
    changes(form),
    'chords: chord(changes).voicing().struct("x ~ x ~").s("rhodes")',
    'bass: chord(changes).rootNotes(2).struct("x ~ ~ x").s("upright")',
  );

/** S5: the two outside notes of the hook and where they go, two to a bar over the chords that hold them. */
const SING = code(
  'chords: chord("<[A7 Dm] [C7 F]>").voicing().s("rhodes")',
  'bass: chord("<[A7 Dm] [C7 F]>").rootNotes(2).s("upright")',
  'mel: note("<[c#4 d4] [bb3 a3]>").s("piano")',
);

/**
 * The Make: Oak's copy of the staircase from U12.L04 (Cmaj7 Dm7 Em7 Fmaj7 and back down), with a bass and a tune
 * on chord notes. Every chord is the key's own, so no bar leans. Opening a door: turn the chord in front of a
 * target into the target's V7 (C7 before Fmaj7 in bar 4, A7 before Dm7 in bar 6, B7 before Em7 in bar 2 or 5).
 */
const STAIRCASE = "<C^7 Dm7 Em7 F^7 F^7 Em7 Dm7 C^7>";
const stairTune = (bar4: string, bar5: string, bar6: string, bar7: string) =>
  mel(`<[2 ~ 4 6] [5 ~ 3 1] [4 ~ 6 4] ${bar4} ${bar5} ${bar6} ${bar7} [2 ~ ~ ~]>`);
const STAIR_TUNE = stairTune("[5 ~ ~ ~]", "[7 ~ 5 3]", "[6 ~ 4 2]", "[3 ~ 5 3]");
const MAKE_STARTER = loop(STAIRCASE, STAIR_TUNE);
const TWO_DOORS = "<C^7 Dm7 Em7 C7 F^7 A7 Dm7 C^7>";
const MAKE_MINIMAL = loop(TWO_DOORS, STAIR_TUNE);
/** The tune takes the notes the visitors bring: te falling to la over C7, di rising to re over A7. */
const MAKE_TUNED = loop(TWO_DOORS, stairTune("[4 ~ 6b ~]", "[5 ~ 3 0]", "[4 ~ 2 0#]", "[1 ~ 3 5]"));

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** S2: one trial of the family per part, drawn by the lesson host (a new one in every series). */
const findPart = (n: number): IdentifyEx => ({
  kind: "identify",
  id: `find-it-${n}`,
  version: 1,
  role: "check",
  prompt: `Loop ${n}.`,
  skills: [
    { skill: "H12", w: 0.6 },
    { skill: "E12a", w: 0.4 },
  ],
  hints: ladder(
    "Three of the four bars stay inside the key. In which bar does one note sound brighter or darker than the key allows?",
    "The visitor leans into the bar after it. Find the bar that sounds like an arrival, then listen to the bar before it.",
    "Hum along with the top of the chords. The bar where your hum has to move by a half step the key does not have is the one.",
  ),
  stimulus: { src: "generator", family: "fam.har.chromatic", level: 2 },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "bar-buttons", bars: 4 },
  correct: {},
  tests: [],
});

/** S3: the four secondary dominants of the unit, named by the note each brings and where that note goes. */
const VISITORS = [
  { id: "v-of-v", label: "The V7 of V: fi rises to sol" },
  { id: "v-of-vi", label: "The V7 of vi: si rises to la" },
  { id: "v-of-ii", label: "The V7 of ii: di rises to re" },
  { id: "v-of-iv", label: "The V7 of IV: te falls to la" },
];
const nameHints = (): HintLadder => [
  { text: "Listen to bar 2 for the one note the key does not own. Does it pull up, or does it sag down?" },
  {
    text: "Follow that note into bar 3. A raised note rises a half step into the next chord; a lowered one falls a half step. The degree it lands on names the target.",
  },
  {
    text: "Hear it again, slower. Sing the outside note of bar 2 and keep going to where it lands in bar 3: sol, la or re.",
    replay: { rate: 0.75 },
  },
  "auto",
];
const namePart = (
  id: string,
  prompt: string,
  key: KeySpec,
  form: string,
  right: string,
  wrong: string,
  wrongName: string,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  key,
  prompt,
  skills: [
    { skill: "H12", w: 0.6 },
    { skill: "E12a", w: 0.4 },
  ],
  hints: nameHints(),
  stimulus: { src: "code", code: heard(form), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: { ui: "choice", options: VISITORS },
  correct: { choice: [right] },
  // The catalog names the option ids. This names the method instead: the outside note, and where it goes.
  feedbackText: {
    "id.wrong":
      "Not that one. Sing the outside note of bar 2, then follow it into bar 3: does it rise or fall, and onto which syllable does it land?",
  },
  tests: [
    { name: right, response: { answer: { choice: [right] } }, expect: "pass" },
    {
      name: wrongName,
      response: { answer: { choice: [wrong] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

/** S4: the bass on the degree pad (numbers with syllables), then the numerals with secondary dominants allowed. */
const STAGES: Partial<Record<"bass" | "rn", AnswerUi>> = {
  bass: {
    ui: "degree-pad",
    set: ["1", "2", "3", "4", "5", "6", "7"],
    sequenceLen: 4,
    syllables: true,
  },
  rn: { ui: "rn-palette", slots: 4, allow: ["triads", "sevenths", "secondary"] },
};
const RIGHT = { bass: ["1", "6", "2", "5"], rn: ["I", "V7/ii", "ii", "V7"] };

export default defineLesson({
  id: "U15.L06",
  version: 4,
  title: "Hearing Secondaries",
  objective: "I can find a secondary dominant by ear and name the chord it points at.",
  key: C_MAJOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H12", "E12a"],
  terms: [],
  canDo: ["cd.hear.secondary-dominants"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two bars lean out",
      minutes: 1,
      // Code and roll hidden: the hook is found by ear before anything is shown.
      ui: { panels: NONE, band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "two-bars-lean-out",
        version: 1,
        role: "practice",
        prompt:
          "Listen to eight bars of a soul ballad in C major, with nothing to read, and count the bars from 1 to 8. Twice the harmony leans out of the key for one bar and comes straight back. Listen for which two bars those are.",
        skills: [{ skill: "E12a", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Count the bars, 1 to 8. Two of them lean.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "Find the bar",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "find-the-bar",
        version: 1,
        role: "check",
        prompt:
          "Five loops of four bars, each in its own major key, each with one secondary dominant. Each loop asks one question: which bar the visitor sits in, or which chord it is. Listen for the note that does not belong, then answer.",
        skills: [
          { skill: "H12", w: 0.6 },
          { skill: "E12a", w: 0.4 },
        ],
        hints: ladder(
          "Three of the four bars stay inside the key. In which bar does one note sound brighter or darker than the key allows?",
          "The visitor leans into the bar after it. Find the bar that sounds like an arrival, then listen to the bar before it.",
          "Hum along with the top of the chords. The bar where your hum has to move by a half step the key does not have is the one.",
        ),
        srs: [{ family: "fam.har.chromatic", mode: "seed" }],
        tests: [],
        parts: [1, 2, 3, 4, 5].map(findPart),
      },
    },
    {
      id: "S3",
      kind: "ear",
      title: "Name the visitor",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "name-the-visitor",
        version: 1,
        role: "check",
        prompt:
          "Name the visitor in three loops, each in its own key. Each loop starts on I, and bar 2 holds a secondary dominant that leans into bar 3. Pick which one it is from the note it brings and where that note goes.",
        skills: [
          { skill: "H12", w: 0.6 },
          { skill: "E12a", w: 0.4 },
        ],
        hints: nameHints(),
        tests: [],
        parts: [
          namePart(
            "visitor-in-g",
            "Loop 1, in G major.",
            G_MAJOR,
            "<G B7 Em C>",
            "v-of-vi",
            "v-of-ii",
            "the V7 of ii for the V7 of vi: the right bar, the wrong target",
          ),
          namePart(
            "visitor-in-f",
            "Loop 2, in F major.",
            F_MAJOR,
            "<F D7 Gm C7>",
            "v-of-ii",
            "v-of-v",
            "the V7 of V for the V7 of ii",
          ),
          namePart(
            "visitor-in-b-flat",
            "Loop 3, in B♭ major.",
            B_FLAT_MAJOR,
            "<Bb Bb7 Eb F7>",
            "v-of-iv",
            "v-of-vi",
            "a raised note heard where a lowered one falls",
          ),
        ],
      },
    },
    {
      id: "S4",
      kind: "dictate",
      title: "Bass, then numerals",
      minutes: 1.75,
      graded: true,
      ui: { panels: NONE, band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "dictation",
        id: "bass-then-numerals",
        version: 1,
        role: "check",
        prompt:
          "Write down the first four bars of the ballad in two passes. First the bass: pick the degree under each chord, four in all. Then write the numeral of each chord, with the 7th where it has one. The bass gives each root; the outside note tells you where the visitor is aimed.",
        skills: [
          { skill: "H12", w: 0.6 },
          { skill: "E12a", w: 0.4 },
        ],
        hints: [
          {
            text: "For the bass, sing the lowest note of each bar down to do. Which bars sit on degrees the key's own chords use?",
          },
          {
            text: "Bar 2's root is the one under the key's own minor chord on 6, but the chord above it is major with a 7th. Where does it lean?",
            replay: { rate: 0.75 },
          },
          {
            text: "The bass is 1, then 6, then two more. Bar 2 leans into bar 3, so its numeral is a V7 with a slash and bar 3's numeral after it.",
          },
          "auto",
        ],
        domain: "harmony",
        stimulus: { src: "code", code: FIRST_FOUR, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads", "sevenths", "secondary"] },
        stages: ["bass", "rn"],
        stageAnswers: STAGES,
        stageFlow: "sequential",
        stagePass: 0.8,
        reference: { solutions: [FIRST_FOUR], bars: 4 },
        matcher: {
          m: "harmony",
          level: "rn",
          qualityDepth: "seventh",
          inversion: false,
          harmonicRhythm: "given",
        },
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        tests: [
          { name: "both stages", response: { answer: { stages: RIGHT } }, expect: "pass" },
          {
            name: "the bass under bar 2 heard as 4",
            response: { answer: { stages: { ...RIGHT, bass: ["1", "4", "2", "5"] } } },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "VI7: the right root, named as the key's own chord",
            response: { answer: { stages: { ...RIGHT, rn: ["I", "VI7", "ii", "V7"] } } },
            expect: "fail",
            feedback: ["harmony.rn-applied"],
          },
          {
            name: "V7/V for V7/ii: the wrong target",
            response: { answer: { stages: { ...RIGHT, rn: ["I", "V7/V", "ii", "V7"] } } },
            expect: "fail",
            feedback: ["harmony.rn-target"],
          },
          {
            name: "V/ii: the 7th left off",
            response: { answer: { stages: { ...RIGHT, rn: ["I", "V/ii", "ii", "V7"] } } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "sing",
      title: "Sing them home",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-them-home",
        version: 1,
        role: "practice",
        prompt:
          "Listen, then sing the ballad's two outside notes, each with the note it goes to, two notes a bar. First di re (♯1 2), over A7 into D minor. Then te la (♭7 6), over C7 into F, below home. Sing in your own range.",
        skills: [
          { skill: "E12a", w: 0.6 },
          { skill: "V03", w: 0.4 },
        ],
        hints: [
          { text: "Hum re first and hold it. Di is the smallest step below it, and it leans up into re." },
          {
            text: "Te sits a half step above la. Sing la, then the note just above it, and let it fall back.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // Two notes a bar: di and re over A7 then Dm, te and la (below home) over C7 then F.
        target: {
          from: "degrees",
          degrees: ["#1", "2", "b7", "6"],
          rhythm: "x x",
          octaves: [0, 0, -1, -1],
        },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        srs: [{ family: "fam.deg.fet-chromatic", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Open two doors",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "open-two-doors",
        version: 1,
        role: "practice",
        prompt:
          "Open two doors in the staircase: in `changes`, pick two target chords and turn the chord in front of each into the target's V7. Try a door before each chord in turn and keep the two that land best. Done when two secondary dominants each move straight into their target. Your loop plays your song's solo.",
        skills: [{ skill: "H12", w: 1 }],
        fromSketch: "U12.L04",
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-doors-that-land",
            label:
              "Within the 8 bars, two secondary dominants, each at least a beat long and moving straight into its target",
            required: true,
            skills: ["H12"],
            rule: "contains-rn",
            rn: [],
            kind: ["secondary-dominant"],
            min: 2,
            mustResolve: true,
            // `min` counts chords over the whole graded window, where an eight-bar loop plays twice: read one
            // pass, so a single door is not counted as two.
            section: { bars: [1, 8] },
          },
          {
            id: "tune-takes-the-visitor",
            label: "`mel` plays at least one note a visitor brings: ♯4, ♯5, ♯1 or ♭7",
            required: false,
            skills: ["E12a"],
            rule: "degree-set",
            track: "mel",
            // The theory names a raised 5 or 1 by its pitch class in a major key (♭6, ♭2), so both spellings count.
            anyOf: ["#4", "#5", "b6", "#1", "b2", "b7"],
          },
          {
            id: "a-leading-tone-chord",
            label:
              "A leading-tone chord (a diminished seventh) at least a beat long, moving straight into the chord whose root is a half step above its own",
            required: false,
            skills: ["H12"],
            rule: "contains-rn",
            rn: ["vii°/ii", "vii°/iii", "vii°/IV", "vii°/V", "vii°/vi"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "bass-on-roots",
            label: "The bass plays each chord's root on at least 3 of every 4 chord changes",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "A door sits right before the chord it leads to. Pick a chord of the staircase you would like to arrive on. Which chord would lean into it?",
          "A door is the V7 of the next chord: built a 5th above it, major with a ♭7. It replaces the chord in front, so the bar count stays the same.",
          "In Oak's copy, Fmaj7 in bar 5 has Fmaj7 in front of it. The V7 of F is built on C. Then look for a second target: Dm7 or Em7.",
        ),
        tests: [
          {
            name: "Oak's copy as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: C7 into Fmaj7, A7 into Dm7", response: { code: MAKE_MINIMAL }, expect: "pass" },
          { name: "and the tune takes te and di", response: { code: MAKE_TUNED }, expect: "pass" },
          {
            name: "beyond the brief: three doors (B7 into Em7 too), comped, G7 and Cmaj7 sharing the last bar",
            response: {
              code: code(
                changes("<C^7 B7 Em7 C7 F^7 A7 Dm7 [G7 C^7]>"),
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("rhodes")',
                BASS,
                mel("<[2 ~ 4 6] [5 ~ 3# ~] [4 ~ 6 4] [4 ~ 6b ~] [5 ~ 3 0] [4 ~ 2 0#] [1 ~ 3 5] [4 ~ 2 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "one door only",
            response: { code: loop("<C^7 Dm7 Em7 C7 F^7 Em7 Dm7 C^7>", STAIR_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "two visitors, one landing on the wrong kind of chord: A7 into D major, not ii",
            response: { code: loop("<C^7 Dm7 Em7 C7 F^7 A7 D C^7>", STAIR_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "two doors in other places: B7 into Em7, A7 into Dm7",
            response: { code: loop("<C^7 B7 Em7 F^7 F^7 A7 Dm7 C^7>", STAIR_TUNE) },
            expect: "pass",
          },
          {
            name: "two visitors, one of which does not land: E7 goes to Dm7",
            response: { code: loop("<C^7 Dm7 Em7 C7 F^7 E7 Dm7 C^7>", STAIR_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
