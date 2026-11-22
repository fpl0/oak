// U06.L04 Endings. A phrase ends with a cadence. V to I closes it (authentic: perfect when the tune lands on 1
// over root-position chords, imperfect when it lands on 3 or 5); stopping on V leaves it open (a half
// cadence), like a comma before the answer. What the learner has: the seven chords of a key (U06.L01), Roman
// numerals (U06.L02), the three jobs, tonic, predominant and dominant (U06.L03), a tune that pauses on 5 in
// bar 4 and lands on 1 in bar 8 over `band.phrase-8bar` (U03.L11). Not yet: the bass heard first
// (U06.L05), V swerving to vi (deceptive, U06.L06), IV to I (plagal, U06.L07). Spec: content/specs/U06.md.
//
// How it uses the Wave 4 kinds (AUTHORING §17): the endings of two phrases are a `slot-choice` strip with
// the cadence options taught here (PAC, IAC, HC; `partial` gives an IAC for a PAC half credit); a closed
// ending written in code is graded as chords (`pcset` with the bass); the Make's one required rule is
// `cadence` at the last bar, which accepts V–I with the tune on 1 or elsewhere (PAC or IAC).
import { CADENCE_OPTIONS, defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One triad on each root of `roots` (n values, one a bar), stacked "+2, +2" and moved with `.add()`. */
const triads = (roots: string, extra = "", sound = "piano") =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("${sound}")${extra}`;
/** A melody line in degrees, one bracket per bar. */
const mel = (bars: string[]) => `mel: n("<${bars.join(" ")}>").scale("C4:major").s("piano")`;
/** A bass line on the roots. */
const bass = (roots: string) => `bass: n("${roots}").scale("C2:major").s("ebass").lpf(600)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook: I IV I V | I IV V I, the roots of `band.phrase-8bar`. Bar 4 waits on V with the tune on 2;
 * bar 8 lands V–I with the tune on 1. Every note the tune plays is a note of the chord under it.
 */
const QUESTION = ["[2 ~ 4 ~]", "[5 ~ 3 ~]", "[4 ~ 2 ~]", "[1 ~ ~ ~]"];
const ANSWER = ["[2 ~ 4 ~]", "[5 ~ 3 ~]", "[1 ~ 4 ~]", "[0 ~ ~ ~]"];
const PHRASE = "<0 3 0 4 0 3 4 0>";
const HOOK = code(triads(PHRASE), mel([...QUESTION, ...ANSWER]));
const OPEN_HALF = code(triads("<0 3 0 4>"), mel(QUESTION));
const CLOSED_HALF = code(triads("<0 3 4 0>"), mel(ANSWER));
/** The same V–I twice: the tune lands on 1 (C), then on 3 (E). */
const TWO_ENDINGS = code(triads("<4 0 4 0>"), mel(["[1 ~ 4 ~]", "[0 ~ ~ ~]", "[1 ~ 4 ~]", "[2 ~ ~ ~]"]));

/**
 * The strip: I vi ii V | I vi V I. Phrase 1 stops on V (the tune on 2, D); phrase 2 goes V–I with the tune
 * on 1 (C5), every chord in root position.
 */
const STRIP_TUNE = [
  "[4 ~ 2 ~]",
  "[5 ~ 7 ~]",
  "[3 ~ 1 ~]",
  "[1 ~ ~ ~]",
  "[4 ~ 2 ~]",
  "[5 ~ 7 ~]",
  "[6 ~ 4 ~]",
  "[7 ~ ~ ~]",
];
const STRIP = code(triads("<0 5 1 4 0 5 4 0>"), mel(STRIP_TUNE));

/** Bars 3 and 4 are the learner's: the starter stops on V. */
const MODIFY_STARTER = code(triads("<0 3 ⟪0 4⟫>"));
/** The hook's first four bars twice: it never comes home. */
const MAKE_STARTER = code(triads("<0 3 0 4 0 3 0 4>"));

/** The hook's step: drums and the bass of the eight-bar phrase, whose roots are the hook's. */
const PHRASE_BAND = { band: "band.phrase-8bar", tracks: ["drums", "bass"] } as const;
/** The Band's drums only: the learner's chords set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

const CLOSED_OR_OPEN = CADENCE_OPTIONS.filter((o) => o.id === "PAC" || o.id === "HC");
const AUTHENTIC_OR_HALF = CADENCE_OPTIONS.filter((o) => ["PAC", "IAC", "HC"].includes(o.id));

export default defineLesson({
  id: "U06.L04",
  version: 3,
  title: "Endings",
  objective:
    "I can hear whether a phrase ends closed, V to I, or open on V, and write an eight-bar phrase that waits halfway and comes home at the end.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H03"],
  practises: [],
  terms: [
    { id: "term.cadence", step: "S2" },
    { id: "term.half-cadence", step: "S2" },
    { id: "term.authentic-cadence", step: "S3" },
  ],
  canDo: ["cd.hear.cadences"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Question and answer",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: PHRASE_BAND },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "question-and-answer",
        version: 1,
        role: "practice",
        prompt:
          "Eight bars in two halves of four. Listen for the bar where the music takes a breath and the bar where it settles.",
        skills: [{ skill: "H03", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Chords and a tune, bars 1 to 4, then 5 to 8.", bars: 8 }],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Which one is finished?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-is-finished",
        version: 1,
        role: "practice",
        prompt:
          "Each card plays one half of the hook. Pick the half that sounds finished, as if the song could stop there.",
        skills: [{ skill: "H03", w: 1 }],
        hints: ladder(
          "Listen for the card after which you want to hear more: that one is not finished.",
          "Listen to the last chord of each card. Is it home, or the tension chord?",
          "Bars 1–4 end on V, the tension chord. Where do bars 5–8 end?",
        ),
        stimulus: { src: "code", code: HOOK, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "open", label: "Bars 1–4", audio: OPEN_HALF },
            { id: "closed", label: "Bars 5–8", audio: CLOSED_HALF },
          ],
        },
        correct: { choice: ["closed"] },
        // The catalog's `id.wrong` names the option ids ("That was closed, not open").
        feedbackText: {
          "id.wrong":
            "Bars 5–8 are the finished ones: they end V to I. Bars 1–4 stop on V and wait. Play both again.",
        },
        tests: [
          { name: "bars 5–8", response: { answer: { choice: ["closed"] } }, expect: "pass" },
          {
            name: "bars 1–4",
            response: { answer: { choice: ["open"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two ways home",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "two-endings", code: TWO_ENDINGS, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "two-ways-home",
        version: 1,
        role: "practice",
        prompt:
          "The hook's last two bars play twice: the same V to I each time, but the tune lands on a different note. Run it, compare the two endings, then answer both questions below.",
        skills: [{ skill: "H03", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play it again and stop after bar 2, then after bar 4: which stop sounds like the very end?",
        },
        hints: ladder(
          "Listen for the ending that could close the whole song.",
          "The chords are the same both times. Only the tune's last note differs: read its degree label on the roll.",
          "In bar 4 the tune lands on 3, E. Read the label of its last note in bar 2.",
        ),
        code: { starter: TWO_ENDINGS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which ending sounds more final?",
            options: [
              { id: "first", label: "The first, in bars 1–2" },
              { id: "second", label: "The second, in bars 3–4" },
              { id: "same", label: "Neither: they sound the same" },
            ],
            correct: ["first"],
          },
          {
            q: "number",
            prompt: "On which degree does the tune end in bar 2?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["first"], number: 1 } }, expect: "pass" },
          {
            name: "the ending on 3",
            response: { answer: { choice: ["second"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the n value read as the degree",
            response: { answer: { choice: ["first"], number: 0 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Closed or open?",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "closed-or-open",
        version: 1,
        role: "check",
        prompt:
          "Four chords and a tune, in one of several keys. Pick how the phrase ends: closed, V to I with the tune on 1, or open on V.",
        skills: [{ skill: "H03", w: 1 }],
        hints: [
          { text: "Listen after the last chord and notice whether you want the phrase to go on." },
          {
            text: "A phrase that stops on V waits for more. One that goes V to I with the tune on 1 is closed.",
          },
          {
            text: "Hear it again, slower, and hum 1 after the last chord: does it answer the chord or repeat it?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.har.cadence", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "choice", options: CLOSED_OR_OPEN },
        correct: {},
        srs: [{ family: "fam.har.cadence", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Mark the endings",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "mark-the-endings",
        version: 1,
        role: "check",
        prompt:
          "Two four-bar phrases, eight bars in all. Listen, read the code, and mark the cadence that ends each phrase.",
        skills: [{ skill: "H03", w: 1 }],
        hints: ladder(
          "One phrase stops and waits; the other comes home. Start with the last chord of each.",
          "Read the last two numbers of each phrase in `.add()`, then the tune's last note on that phrase's last bar.",
          "Phrase 1 ends on the chord that adds 4: V. Phrase 2 ends V to I; on which degree does its tune land?",
        ),
        stimulus: { src: "code", code: STRIP, bars: 8, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "slot-choice",
          slots: 2,
          options: AUTHENTIC_OR_HALF,
          labels: ["Bars 1–4", "Bars 5–8"],
        },
        correct: { choice: ["HC", "PAC"] },
        // V–I with the tune on 1 is perfect; calling it imperfect hears the close and misses the tune.
        partial: { PAC: { IAC: 0.5 } },
        feedbackText: {
          "id.wrong":
            "Phrase {slot}: not that one. Read the last chord of that phrase, then the degree of the tune's last note.",
          "id.partial":
            "Phrase {slot}: closed, yes, V to I. Now read the tune's last note: it lands on 1, over chords with their roots at the bottom.",
        },
        tests: [
          { name: "HC, PAC", response: { answer: { choice: ["HC", "PAC"] } }, expect: "pass" },
          {
            name: "the half cadence called perfect",
            response: { answer: { choice: ["PAC", "PAC"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "the perfect one called imperfect",
            response: { answer: { choice: ["HC", "IAC"] } },
            expect: "fail",
            feedback: ["id.partial"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Close the phrase",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "close-the-phrase",
        version: 1,
        role: "check",
        prompt:
          "This phrase stops on V and waits. Change the numbers for bars 3 and 4 in `.add()` so it closes instead: V in bar 3, then I in bar 4.",
        skills: [{ skill: "H03", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [code(triads("<0 3 4 0>"))], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. A closed ending is V, then I; `n` counts from 0.",
        },
        hints: ladder(
          "The phrase now ends on V. A closed ending needs V and then I.",
          "A closed ending is V then I: the tension chord, then home. In `.add()`, V is 4 and I is 0.",
          "Bar 4 must be home. What comes just before it?",
        ),
        tests: [
          { name: "reference", response: { code: code(triads("<0 3 4 0>")) }, expect: "pass" },
          {
            name: "V an octave lower",
            response: { code: code(triads("<0 3 -3 0>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: MODIFY_STARTER.replace(/[⟪⟫]/g, "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "IV then I: a softer close",
            response: { code: code(triads("<0 3 3 0>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "V twice: still open",
            response: { code: code(triads("<0 3 4 4>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "bar 2 changed as well",
            response: { code: code(triads("<0 1 4 0>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Wait, then land",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "wait-then-land",
        version: 1,
        role: "practice",
        prompt:
          "The starter asks its question twice and never answers. Keep bar 4 waiting on V, and change bars 7 and 8 so the phrase lands V to I. Done when bar 4 ends on V and bars 7 and 8 go V to I.",
        skills: [{ skill: "H03", w: 1 }],
        // The rule's detail names cadences by their abbreviations (PAC, HC, PC), which the prose never uses, and
        // PC is U06.L07's. The same text serves the suggestions, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "bar-8-home",
            label: "Bars 7 and 8 go V to I",
            required: true,
            skills: ["H03"],
            rule: "cadence",
            types: ["PAC", "IAC"],
            at: "last",
            // V to I, as the label says (review finding theory-d 1): vii° to I is an authentic close the rule
            // otherwise counts, and this lesson asks for V. V7 counts as V.
            before: ["V"],
          },
          {
            id: "bar-4-waits",
            label: "Bar 4 ends on V, a half cadence",
            required: false,
            skills: ["H03"],
            rule: "cadence",
            types: ["HC"],
            at: { bar: 4 },
          },
          {
            id: "tune-on-1",
            label: "A `mel` line whose last note is 1",
            required: false,
            skills: ["M01"],
            rule: "ends-on-degree",
            degrees: ["1"],
            track: "mel",
          },
        ],
        hints: ladder(
          "The starter's bar 8 is a copy of bar 4. Bar 8 must come home instead of waiting.",
          "Bar 8 must be I, and bar 7 must be V: the numbers 0 and 4 in `.add()`.",
          "Bars 1–6 can stay as they are. Two numbers at the end change.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the hook's chords", response: { code: code(triads(PHRASE)) }, expect: "pass" },
          {
            name: "closed with the tune on 3",
            response: { code: code(triads(PHRASE), mel([...QUESTION, ...ANSWER.slice(0, 3), "[2 ~ ~ ~]"])) },
            expect: "pass",
          },
          {
            name: "beyond the brief: new chords on a Rhodes, a bass, a tune home",
            response: {
              code: code(
                triads("<0 2 3 4 0 5 4 0>", ".gain(.7)", "rhodes"),
                bass("<0 2 3 4 0 5 4 0>"),
                mel([
                  "[4 ~ 2 ~]",
                  "[4 ~ 6 ~]",
                  "[5 ~ 3 ~]",
                  "[1 ~ ~ ~]",
                  "[2 ~ 4 ~]",
                  "[5 ~ 2 ~]",
                  "[6 ~ 4 ~]",
                  "[7 ~ ~ ~]",
                ]),
              ),
            },
            expect: "pass",
          },
          {
            // Review finding (theory-d 1): B D F to C E G closes, but on vii°, not V.
            name: "vii° to I at the end",
            response: { code: code(triads("<0 3 0 4 0 3 6 0>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "IV, V, I at the end, the V on bar 7",
            response: { code: code(triads("<0 5 1 4 0 3 4 0>")) },
            expect: "pass",
          },
          {
            name: "by name, over a bass of roots",
            response: {
              code: code(
                'chords: chord("<C F C G Am F G C>").voicing().s("piano")',
                'bass: note("<c2 f2 c2 g2 a2 f2 g2 c2>").s("ebass").lpf(800)',
              ),
            },
            expect: "pass",
          },
          {
            name: "IV to I at the end",
            response: { code: code(triads("<0 3 0 4 0 4 3 0>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
