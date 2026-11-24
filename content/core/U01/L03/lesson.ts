// U01.L03 Backbeat. Kick on 1 and 3, snare on 2 and 4, written as one labelled line per drum. Tools in
// reach: U01.L01–L02 plus `.bank()` with the TR-808 and TR-909, and `stack()`, which appears once, read-only,
// in S3 (STYLE §2 rule 5). Brackets arrive in U01.L04. Spec: content/specs/U01.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.6)';
/** Lines joined under the tempo line. */
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** The same three lines on a drum machine. */
const onBank = (bank: string) =>
  code(
    `kick: s("bd ~ bd ~").bank("${bank}")`,
    `snare: s("~ sd ~ sd").bank("${bank}")`,
    `hats: s("hh*8").bank("${bank}").gain(.6)`,
  );
/** The hook: the backbeat on a TR-808. */
const HOOK = onBank("RolandTR808");
const NO_SNARE = code(
  'kick: s("bd ~ bd ~").bank("RolandTR808")',
  'hats: s("hh*8").bank("RolandTR808").gain(.6)',
);

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Seconds of the n-th beat at `bpm` (tap tests are relative to the start of the stimulus). */
const beatTimes = (bpm: number, n: number, every = 1, offset = 0) =>
  Array.from({ length: n }, (_, i) => Number(((i * every + offset) * (60 / bpm)).toFixed(3)));

/** The Band plays bass and chords under the learner's drums. */
const BAND = { band: "band.two-chord-vamp", tracks: ["bass", "chords"] } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/**
 * Drum hits are one-shots: only where they start matters. `rhythm: "exact"` would also compare the length of
 * each slot, and reject `[bd ~]` for `bd` although the two sound the same.
 */
const DRUM_EVENTS = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets",
  durations: false,
  sound: "drum-role",
} as const;
/** The catalog's tap lines name a bar and beat the tap grader does not send; these read whole without them. */
const TAP_FEEDBACK = {
  "tap.missed": "A sound you were asked to tap went by without a tap. Keep counting through it.",
  "tap.extra": "A tap landed where nothing you were asked to tap plays.",
} as const;

export default defineLesson({
  id: "U01.L03",
  version: 7,
  title: "Backbeat",
  objective: "I can put the kick on 1 and 3 and the snare on 2 and 4, one labelled line per drum.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["R04"],
  practises: [],
  terms: [{ id: "term.backbeat", step: "S4" }],
  canDo: ["cd.compose.backbeat"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three lines, one groove",
      minutes: 0.5,
      ui: { panels: ROLL, band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "three-lines",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the first groove, then the second. Listen for the drum that goes missing in the second, and for what the groove loses without it.",
        skills: [{ skill: "R04", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Three lines of drums on Oak's 808-style drum machine.", bars: 4 },
          { code: NO_SNARE, caption: "The same groove, one line short.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Where the snare lands",
      minutes: 0.5,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      example: { id: "snare-line", code: code(KICK, SNARE), bars: 2 },
      exercise: {
        kind: "predict",
        id: "where-the-snare-lands",
        version: 1,
        role: "practice",
        prompt:
          'The snare line reads `snare: s("~ sd ~ sd")`. Predict on which beats the snare plays, and pick one answer.',
        skills: [{ skill: "R04", w: 1 }],
        hints: null,
        tests: [],
        code: code(KICK, SNARE),
        bars: 2,
        mode: "choose",
        choices: [
          { id: "one-three", label: "Beats 1 and 3" },
          { id: "two-four", label: "Beats 2 and 4" },
          { id: "all", label: "All four beats" },
        ],
        correct: ["two-four"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "One line at a time",
      minutes: 1,
      ui: { panels: ROLL },
      // `stack()` is shown once, read-only, as the other way to layer; labelled lines stay the Oak way.
      example: {
        id: "stacked",
        code: `${TEMPO}drums: stack(s("bd ~ bd ~"), s("~ sd ~ sd"), s("hh*8").gain(.6)).bank("RolandTR808")`,
        bars: 2,
      },
      exercise: {
        kind: "run-investigate",
        id: "one-line-at-a-time",
        version: 1,
        role: "practice",
        prompt:
          "Clap along with the groove. Then mute the lines one at a time with the buttons beside them, and find the line that plays on the beats you clap. Answer below.",
        skills: [{ skill: "R04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Keep clapping while you mute each line in turn. Which line, once muted, leaves your claps on their own?",
        },
        hints: ladder(
          "Find the line that plays where your claps land. When you clap along to a song, do you clap on 1 and 3, or on 2 and 4?",
          "Mute each line in turn and keep clapping. The line whose silence you miss most is the one.",
          "The kick plays on 1 and 3, so it is not the kick.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 2,
        questions: [
          {
            q: "choice",
            prompt: "Which line plays the beats people clap on?",
            options: [
              { id: "kick", label: "`kick`" },
              { id: "snare", label: "`snare`" },
              { id: "hats", label: "`hats`" },
            ],
            correct: ["snare"],
          },
        ],
        tests: [
          { name: "the snare", response: { answer: { choice: ["snare"] } }, expect: "pass" },
          { name: "the kick", response: { answer: { choice: ["kick"] } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Add the snare",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "add-the-snare",
        version: 1,
        role: "check",
        prompt:
          "Add a third line, `snare:`, that plays `sd` on beats 2 and 4, the two beats the kick leaves empty. Write it as four words, one per beat. Leave the kick and hats as they are.",
        skills: [{ skill: "R04", w: 1 }],
        code: { starter: code(KICK, HATS) },
        reference: { solutions: [code(KICK, SNARE, HATS)], bars: 1 },
        matcher: DRUM_EVENTS,
        constraints: [{ c: "labels", min: 3, feedback: "code.labels" }],
        target: { audible: true, showRoll: true },
        // The catalog says "missing hit" and "labeled parts": these say what goes where.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: no hit here yet{role}. The snare plays on beats 2 and 4.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a hit that should not be there{role}. The snare plays on beats 2 and 4 only.",
          "code.labels": "Write {min} lines, each starting with its own name: `kick:`, `snare:` and `hats:`.",
        },
        hints: ladder(
          "The snare goes on its own line, on beats 2 and 4. Where did your claps land in the last step?",
          'A new line needs its own label, then `s("…")` with four words: one per beat.',
          "The kick line is `bd ~ bd ~`. The snare line has the same shape with the gaps swapped.",
        ),
        tests: [
          { name: "reference", response: { code: code(KICK, SNARE, HATS) }, expect: "pass" },
          {
            name: "the snare line last, on a drum machine",
            response: { code: code(KICK, HATS, 'snare: s("~ sd ~ sd").bank("RolandTR909")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(KICK, HATS) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "snare on 1 and 3",
            response: { code: code(KICK, 'snare: s("sd ~ sd ~")', HATS) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "snare written into the kick line",
            response: { code: code('kick: s("bd sd bd sd")', HATS) },
            expect: "fail",
            feedback: ["code.labels"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "One line per drum",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "one-line-per-drum",
        version: 1,
        role: "check",
        prompt:
          "Split the `drums:` line into two lines: a `kick:` line with only the kicks and a `snare:` line with only the snares. Each keeps four words, with `~` where its drum is silent. Done when it sounds exactly as before.",
        skills: [{ skill: "R04", w: 1 }],
        code: { starter: code('drums: s("bd sd bd sd")', HATS) },
        reference: { solutions: [code(KICK, SNARE, HATS)], bars: 1 },
        matcher: DRUM_EVENTS,
        constraints: [{ c: "labels", min: 3, feedback: "code.labels" }],
        target: { audible: true, showRoll: true },
        // The catalog says "missing hit" and "labeled parts": these say what goes where.
        feedbackText: {
          "rhythm.missing":
            "Bar {bar}, {beatLabel}: no hit here yet{role}. Together the two lines play `bd` on 1 and 3 and `sd` on 2 and 4, four words each.",
          "rhythm.extra":
            "Bar {bar}, {beatLabel}: a hit that should not be there{role}. Each line needs four words, with `~` where its drum is silent.",
          "code.labels": "Write {min} lines, each starting with its own name: `kick:`, `snare:` and `hats:`.",
        },
        hints: ladder(
          "Together the two new lines play what `drums:` plays now. On which beats does `bd` play, and on which does `sd` play?",
          "Each new line keeps four words, one per beat, with `~` wherever its drum is silent.",
          // The same idea on another drum: rung 3 never quotes the solution (the tutor's leak guard rates
          // solution literals as a reveal).
          "A hats line that played only on beat 3 would read `~ ~ hh ~`. Write the kick line that way, then the snare.",
        ),
        tests: [
          { name: "reference", response: { code: code(KICK, SNARE, HATS) }, expect: "pass" },
          {
            name: "snare first, kick a little softer",
            response: { code: code(SNARE, 'kick: s("bd ~ bd ~").gain(.9)', HATS) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code('drums: s("bd sd bd sd")', HATS) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "forgot the rests in the snare line",
            response: { code: code(KICK, 'snare: s("sd sd")', HATS) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "renamed the line only",
            response: { code: code('kick: s("bd sd bd sd")', HATS) },
            expect: "fail",
            feedback: ["code.labels"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "tap",
      title: "Tap the backbeat",
      minutes: 1.25,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "tap",
        id: "tap-the-backbeat",
        version: 1,
        role: "practice",
        prompt:
          "Tap only on the snare, the crisp crack on beats 2 and 4: two taps per bar, four taps in all. Let the kick, the deep thump on 1 and 3, go by without a tap.",
        skills: [
          { skill: "R04", w: 0.5 },
          { skill: "E01", w: 0.5 },
        ],
        hints: ladder(
          "Tap the snare only, on beats 2 and 4. Which drum answers the kick?",
          "Count 1, 2, 3, 4 and tap only on 2 and 4.",
          "Say the count and tap on the even numbers: one, tap, three, tap.",
        ),
        mode: "along",
        stimulus: { src: "code", code: HOOK, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 2,
        target: { drum: ["snare"] },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: TAP_FEEDBACK,
        srs: [{ family: "fam.rhy.pulse", mode: "review-if-due" }],
        tests: [
          { name: "on 2 and 4", response: { taps: beatTimes(BPM, 4, 2, 1) }, expect: "pass" },
          { name: "on every beat", response: { taps: beatTimes(BPM, 8) }, expect: "fail" },
          { name: "on the kicks", response: { taps: beatTimes(BPM, 4, 2) }, expect: "fail" },
          { name: "on the hats", response: { taps: beatTimes(BPM, 16, 0.5) }, expect: "fail" },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S7",
      kind: "investigate",
      title: "Another drum machine",
      minutes: 0.75,
      ui: { panels: ROLL },
      exercise: {
        kind: "run-investigate",
        id: "another-machine",
        version: 1,
        role: "practice",
        prompt:
          'Listen first. Then change all three `"RolandTR808"` to `"RolandTR909"`, listen again and watch the roll. Answer the question below.',
        skills: [{ skill: "R04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Switch the machine back and forth and watch the roll: did any hit move, or only the sound change?",
        },
        hints: ladder(
          "Compare the two machines by ear and on the roll. Did the roll change when you switched?",
          "`.bank()` picks which drum machine plays the sounds. The words in the quotes stay the same.",
          "Watch the roll while you listen: the hits sit exactly where they were. Only the drums that play them changed.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 2,
        questions: [
          {
            q: "choice",
            prompt: "What changed when you switched to the 909?",
            options: [
              { id: "sound", label: "The sound of the drums; every hit stayed on its beat" },
              { id: "rhythm", label: "Where the hits land in the bar" },
              { id: "tempo", label: "The speed of the groove" },
            ],
            correct: ["sound"],
          },
        ],
        tests: [
          { name: "the sound", response: { answer: { choice: ["sound"] } }, expect: "pass" },
          { name: "the rhythm", response: { answer: { choice: ["rhythm"] } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Your backbeat",
      minutes: 2.5,
      ui: { panels: ROLL, band: BAND },
      exercise: {
        kind: "code-make",
        id: "your-backbeat",
        version: 1,
        role: "practice",
        prompt:
          "Write the backbeat for your song's second part, one line per drum, on any kit. The snare plays on beats 2 and 4 and not on 1 or 3. Everything else is yours.",
        skills: [{ skill: "R04", w: 1 }],
        code: { starter: code(KICK, HATS) },
        bars: [1, 2],
        saveAs: "sketch",
        rubric: [
          {
            id: "backbeat",
            label: "In every bar, the snare plays on beats 2 and 4 and not on beats 1 or 3",
            required: true,
            skills: ["R04"],
            rule: "onsets",
            track: "@drums",
            drum: "snare",
            contains: [
              [1, 4],
              [3, 4],
            ],
            // Corrections gate (AS-37): a backbeat leaves 1 and 3 to the kick; a snare on every beat is no backbeat.
            excludes: [
              [0, 1],
              [1, 2],
            ],
            perBar: true,
          },
          {
            id: "three-lines",
            label: "Three or more drum lines, each with its own name",
            required: false,
            skills: ["R04"],
            rule: "tracks",
            min: 3,
            roles: ["drums"],
          },
          {
            id: "machine",
            label: "Picks a drum machine with `.bank()`",
            required: false,
            skills: ["R04"],
            rule: "uses",
            tool: "tb.bank",
          },
        ],
        hints: ladder(
          "The snare needs its own line, on beats 2 and 4 only. Which drum is missing from the starter?",
          "Add a `snare:` line with four words, the snare on the second and fourth.",
          "Put `~` on beats 1 and 3 of the snare line so the kick has them to itself.",
        ),
        tests: [
          { name: "minimal", response: { code: code(KICK, SNARE) }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: code(
                'kick: s("bd ~ bd bd").bank("RolandTR909")',
                'snare: s("~ sd ~ sd").bank("RolandTR909")',
                'hats: s("hh hh oh hh hh hh oh hh").bank("RolandTR909").gain(.5)',
                'perc: s("~ ~ ~ cp").gain(.6)',
              ),
            },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: code(KICK, HATS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "snare on 1 and 3",
            response: { code: code('kick: s("~ bd ~ bd")', 'snare: s("sd ~ sd ~")', HATS) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
