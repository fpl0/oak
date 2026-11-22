// A1.L04 Space (spec: content/specs/A1.md). Space is reverb and delay. `.room()` sends a part to a reverb and
// `.roomsize()` sets how big the room is; `.delay()` sends it to an echo, `.delaytime()` sets the gap in
// seconds (60 ÷ BPM a beat) and `.delayfeedback()` how many repeats. Each orbit has one reverb and one delay,
// shared by its parts (superdoughoutput.mjs `getReverb`/`getDelay`: the last note to set a size, time or
// feedback sets it for the orbit); `.orbit(2)` gives a part a space of its own.
//
// A side lesson (contracts §2.6): it opens once U03.L02 is done, so it uses only what U03.L02 guarantees plus
// A1's own unlocks (`.scope()`, `.partials()`, the filters, the envelope, and here `.delay()` at its
// alternative site, `.roomsize()`, `.delaytime()`, `.delayfeedback()` and `.orbit()`). No `ebass`, no `,` inside
// mini-notation, no chords by name, no `arrange()`.
//
// It starts from the A1 loop as A1.L03 leaves it (filtered and shaped, dry) and ends with that loop placed:
// a snare in a room and a riff that echoes on the beat. The Band plays the chords only.
//
// How it is graded: S4 is "match this echo" on the `controls` matcher (time within 0.02 s, feedback within
// 0.15), with `edit-only-regions` keeping the notes; S5 gives one part its own orbit, graded with an `events`
// match on the riff's notes, the `orbits-differ` rule (the snare and the riff end on different orbits, so
// `.orbit(2)` on both or on the hats does not pass), `must-use tb.orbit` and `arg-matches` on the first
// `.orbit()` argument; either part may move; S6 is a `fam.snd.params` level 4
// ear step (more room or echoes); the Make requires a room size or an echo time you hear (`control-set` with
// `anyOf`, carry f4).
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The A1 loop's drums: kick, snare and hats, each on its own line. */
const KICK = 'kick: s("bd ~ bd ~")';
const snare = (tail: string) => `snare: s("~ sd ~ sd")${tail}`;
const HATS = 'hats: s("hh*8").gain(.5)';
const DRUMS = [KICK, snare(""), HATS];
/** C | F under the Band's I | IV: root, root, the 5th below (g1 under C, c2 under F). */
const BASS_NOTES = "<[c2 ~ c2 g1] [f1 ~ f1 c2]>";
/** G G E G – E C – | A A F A – F C –: every note on a beat is in the Band's chord (C, then F). */
const RIFF = "<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>";
const riff = (tail: string) => `mel: n("${RIFF}").scale("C4:major")${tail}`;
/** The bass as A1.L03 leaves it: filtered and plucked. */
const BASS = `bass: note("${BASS_NOTES}").s("sawtooth").lpf(500).decay(.2).sustain(0)`;
/** The riff's sound before any space is added. */
const RIFF_SOUND = '.s("square").lpf(2000)';

/** The loop as A1.L03 leaves it: shaped and dry. The Make's starter. */
const DRY = code(...DRUMS, BASS, riff(`${RIFF_SOUND}.gain(.8)`));
/** The hook: the snare in a big room, the riff echoing half a beat later on its own orbit. */
const PLACED = code(
  KICK,
  snare(".room(.5).roomsize(6)"),
  HATS,
  BASS,
  riff(`${RIFF_SOUND}.delay(.4).delaytime(.3).delayfeedback(.4).orbit(2).gain(.8)`),
);

/** S2: the riff over the drums with an echo a beat later. */
const ECHO_BEAT = code(...DRUMS, riff(`${RIFF_SOUND}.delay(.5).delaytime(.6).gain(.8)`));
/** S3: the echo half a beat later, few repeats in bar 1 and many in bar 2. */
const REPEATS = code(
  ...DRUMS,
  riff(`${RIFF_SOUND}.delay(.5).delaytime(.3).delayfeedback("<.2 .7>").gain(.8)`),
);

/** S4: the riff with an echo; only its time and its repeats change. */
const echoWith = (time: string, fb: string) =>
  code(...DRUMS, riff(`${RIFF_SOUND}.delay(.4).delaytime(${time}).delayfeedback(${fb}).gain(.8)`));
const ECHO_STARTER = echoWith("⟪.6⟫", "⟪.7⟫");
const ECHO_SOLUTION = echoWith(".3", ".3");

/** S5: the snare in a big room and the riff in a small one, on one orbit unless an `.orbit()` moves one. */
const rooms = (snareTail: string, riffTail: string) =>
  code(
    KICK,
    snare(`.room(.5).roomsize(6)${snareTail}`),
    HATS,
    riff(`${RIFF_SOUND}.room(.3).roomsize(1)${riffTail}.gain(.8)`),
  );
/** Either line may take the orbit: both ends are marked. */
const ROOMS_STARTER = rooms("⟪⟫", "⟪⟫");
const ROOMS_RIFF_MOVED = rooms("", ".orbit(2)");
const ROOMS_SNARE_MOVED = rooms(".orbit(2)", "");

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const CHORDS = { band: "band.two-chord-vamp", tracks: ["chords"] } as const;

export default defineLesson({
  id: "A1.L04",
  version: 3,
  title: "Space",
  objective: "I can put my loop in a room and give a part echoes in time, each part in its own space.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["D05"],
  terms: [
    { id: "term.delay", step: "S3" },
    { id: "term.feedback", step: "S4" },
  ],
  canDo: ["cd.code.space"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Dry and placed",
      minutes: 0.5,
      ui: { panels: ROLL, band: CHORDS },
      example: { id: "hook", code: PLACED, bars: 2 },
      exercise: {
        kind: "listen",
        id: "dry-and-placed",
        version: 1,
        role: "practice",
        prompt:
          "Loop 2 adds space to two parts and leaves the others dry. Listen for the two parts that now sound further away from you.",
        skills: [{ skill: "D05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: DRY, caption: "Loop 1: the loop as Envelopes left it, dry.", bars: 2 },
          { code: PLACED, caption: "Loop 2: listen in the gaps, after each hit and each note.", bars: 2 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Where the echo lands",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "where-the-echo-lands",
        version: 1,
        role: "practice",
        prompt:
          "The riff with an echo, `.delaytime(.6)`: each echo comes 0.6 seconds after its note. At 100 BPM a beat lasts 60 ÷ 100 = 0.6 seconds. Predict where each echo lands, and pick it.",
        skills: [{ skill: "D05", w: 1 }],
        hints: null,
        tests: [],
        code: ECHO_BEAT,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "beat", label: "One beat after its note" },
          { id: "half", label: "Half a beat after its note" },
          { id: "bar", label: "On the next bar" },
        ],
        correct: ["beat"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Half a beat later",
      minutes: 1,
      ui: { panels: NONE },
      example: { id: "half-a-beat", code: REPEATS, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "half-a-beat",
        version: 1,
        role: "practice",
        prompt:
          "The echo now comes 0.3 seconds after each note, and the `.delayfeedback()` number changes between the two bars. Listen to how long the echoes go on in each bar. Then answer both questions: which bar's echoes last longer, and which `.delaytime()` lands half a beat late.",
        skills: [{ skill: "D05", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Listen to the gaps in each bar: in one the echoes die at once, in the other they keep coming. A beat is 0.6 seconds here.",
        },
        hints: ladder(
          "Listen to the riff's rests in each bar. In which bar do echoes still sound there?",
          "The bars differ only in the `.delayfeedback()` number: 0.2, then 0.7. A beat at 100 BPM lasts 0.6 seconds.",
          "A whole beat is 0.6 seconds. What is half of it?",
        ),
        code: { starter: REPEATS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "In which bar do the echoes go on longer?",
            options: [
              { id: "bar1", label: "Bar 1" },
              { id: "bar2", label: "Bar 2" },
            ],
            correct: ["bar2"],
          },
          {
            q: "number",
            prompt: "At 100 BPM, which `.delaytime()` puts the echo half a beat after its note?",
            correct: 0.3,
            tol: 0.01,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 0.3, choice: ["bar2"] } },
            expect: "pass",
          },
          {
            name: "bar 1",
            response: { answer: { number: 0.3, choice: ["bar1"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole beat",
            response: { answer: { number: 0.6, choice: ["bar2"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Match the echo",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "match-the-echo",
        version: 1,
        role: "check",
        prompt:
          "Yours echoes a beat after each note and keeps going. The target echoes half a beat after each note and dies out after two or three repeats. Change the `.delaytime()` and `.delayfeedback()` numbers on the mel line to match. Done when both are close to the target's.",
        skills: [{ skill: "D05", w: 1 }],
        code: { starter: ECHO_STARTER },
        reference: { solutions: [ECHO_SOLUTION], bars: 2 },
        matcher: {
          m: "controls",
          track: "mel",
          controls: [
            { control: "delaytime", scale: "linear", tol: 0.02 },
            { control: "delayfeedback", scale: "linear", tol: 0.15 },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        hints: ladder(
          "Two numbers need to change: one sets when the echo comes, the other how long it keeps repeating. Which is which?",
          "`.delaytime()` is in seconds: a beat at 100 BPM is 0.6. `.delayfeedback()` runs from 0 (one echo) towards 1 (endless).",
          "Half a beat is half of 0.6. For the repeats, try something well under the 0.7 you have.",
        ),
        tests: [
          { name: "reference", response: { code: ECHO_SOLUTION }, expect: "pass" },
          { name: "close enough", response: { code: echoWith(".30", ".25") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: echoWith(".6", ".7") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "three seconds for three tenths",
            response: { code: echoWith("3", ".3") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "the time right, the repeats left long",
            response: { code: echoWith(".3", ".7") },
            expect: "fail",
            feedback: ["code.control-off"],
          },
          {
            name: "the riff's notes changed as well",
            response: {
              code: code(
                ...DRUMS,
                `mel: n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 2 ~]>").scale("C4:major")${RIFF_SOUND}.delay(.4).delaytime(.3).delayfeedback(.3).gain(.8)`,
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
      title: "Two rooms",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL },
      exercise: {
        kind: "code-modify",
        id: "two-rooms",
        version: 1,
        role: "check",
        prompt:
          "The snare wants a big room and the riff a small one, but both share one reverb, which cuts their tails. Add `.orbit()` with a number from 2 to 9 to the end of the snare line or the mel line. Keep the notes as they are. Done when the two parts are on different orbits.",
        skills: [{ skill: "D05", w: 1 }],
        code: { starter: ROOMS_STARTER },
        reference: { solutions: [ROOMS_RIFF_MOVED, ROOMS_SNARE_MOVED], bars: 2 },
        // The two rooms are apart only when the snare and the riff end up on different orbits: `.orbit(2)` on
        // both, or on the hats, still leaves them sharing one reverb (corrections pass, theory-b 1).
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
            {
              m: "rubric",
              rules: [
                {
                  id: "two-rooms",
                  label: "The snare and the riff on different orbits",
                  required: true,
                  skills: [],
                  rule: "custom",
                  fn: "orbits-differ",
                  params: { a: "snare", b: "mel" },
                },
              ],
            },
          ],
        },
        constraints: [
          { c: "must-use", tool: "tb.orbit", feedback: "code.must-use" },
          {
            c: "arg-matches",
            fn: "orbit",
            argIndex: 0,
            // A number, or the same number in quotes (`.orbit("2")` is valid Strudel; corrections gate).
            pattern: "^([\"'`]?)[2-9]\\1$",
            feedback: "code.arg-mismatch",
          },
        ],
        target: { audible: false, showRoll: false },
        feedbackText: {
          "code.must-use":
            "Not yet: both parts still share one reverb. The room is shared, not the send: give one line an orbit of its own.",
          "code.arg-mismatch":
            "Not yet: every part starts on orbit 1, so a space of its own needs another number, such as 2.",
          "melody.wrong-degree":
            "Bar {bar}: the riff's notes changed. Add `.orbit()` and leave the notes as they are.",
        },
        hints: ladder(
          "The snare and the riff share one reverb now. How many reverbs can one orbit have?",
          "Every part starts on orbit 1. A part on another orbit gets its own reverb, with its own room size.",
          "Pick either line, the snare or the riff, and send it to orbit 2.",
        ),
        tests: [
          { name: "the riff moved", response: { code: ROOMS_RIFF_MOVED }, expect: "pass" },
          { name: "the snare moved", response: { code: ROOMS_SNARE_MOVED }, expect: "pass" },
          { name: "orbit 3", response: { code: rooms("", ".orbit(3)") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: rooms("", "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the riff's room taken away instead",
            response: {
              code: code(
                KICK,
                snare(".room(.5).roomsize(6)"),
                HATS,
                riff(`${RIFF_SOUND}.room(0).roomsize(1).gain(.8)`),
              ),
            },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            name: "orbit 1 written out",
            response: { code: rooms("", ".orbit(1)") },
            expect: "fail",
            feedback: ["code.arg-mismatch"],
          },
          {
            name: "both lines sent to orbit 2, so they still share one",
            response: { code: rooms(".orbit(2)", ".orbit(2)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the hats moved, the snare and the riff left together",
            response: {
              code: code(
                KICK,
                snare(".room(.5).roomsize(6)"),
                `${HATS}.orbit(2)`,
                riff(`${RIFF_SOUND}.room(.3).roomsize(1).gain(.8)`),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "each line on an orbit of its own",
            response: { code: rooms(".orbit(2)", ".orbit(3)") },
            expect: "pass",
          },
          {
            name: "the snare on orbit 4",
            response: { code: rooms(".orbit(4)", "") },
            expect: "pass",
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Room or echoes",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "room-or-echoes",
        version: 1,
        role: "check",
        prompt:
          "Bar 2 repeats the phrase of bar 1 with a space added around it. Listen to what follows each note in bar 2, and pick: more room or echoes.",
        skills: [{ skill: "D05", w: 1 }],
        hints: [
          { text: "After each note in bar 2, do you hear a wash or a repeat?" },
          {
            text: "A reverb is a smooth wash around the sound. A delay repeats the note, clearly, after a gap.",
          },
          { text: "Hear it again, slower, and listen to the end of bar 2.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.snd.params", level: 4 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          options: [
            { id: "room", label: "More room (reverb)" },
            { id: "delay", label: "Echoes (delay)" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.snd.params", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Place your loop",
      minutes: 2.75,
      ui: { panels: ROLL, band: CHORDS },
      exercise: {
        kind: "code-make",
        id: "place-your-loop",
        version: 1,
        role: "practice",
        prompt:
          "This loop is dry. Give at least one part a space you set: a room bigger than the default with `.room()` and `.roomsize()`, or echoes with `.delay()` and `.delaytime()` timed to the beat (60 ÷ BPM seconds a beat). Give a part its own orbit if it needs a different space.",
        skills: [{ skill: "D05", w: 1 }],
        code: { starter: DRY },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-space-you-set",
            label:
              "A heard part in a room bigger than the default (.roomsize() above 2.5) or with echoes timed by .delaytime()",
            required: true,
            skills: ["D05"],
            // Carry f4 (corrections pass): what is heard, not the call. A room bigger than the one you get without
            // `.roomsize()` (about 2), on a part sent to the reverb; or echoes timed by `.delaytime()` on a part sent
            // to the delay. A size or a time on a dry part sets nothing you hear.
            rule: "custom",
            fn: "control-set",
            params: {
              anyOf: [
                { control: "roomsize", above: 2.5 },
                { control: "delaytime", above: 0 },
              ],
            },
          },
          {
            id: "echoes",
            label: "Echoes, .delay(), on a part",
            required: false,
            skills: ["D05"],
            rule: "uses",
            tool: "tb.delay",
          },
          {
            id: "own-orbit",
            label: "A part on an orbit of its own, with .orbit()",
            required: false,
            skills: ["D05"],
            rule: "uses",
            tool: "tb.orbit",
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Pick the part that would sound best further away, the snare or the riff, and give it a room or echoes. Which one?",
          "`.room()` sends a part to the reverb and `.roomsize()` sets how big the room is. `.delay()` sends it to the echo and `.delaytime()` sets when, in seconds.",
          "Try the snare first: a room of half and a size bigger than the default of about 2.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: DRY },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the snare in a big room",
            response: {
              code: code(KICK, snare(".room(.4).roomsize(4)"), HATS, BASS, riff(`${RIFF_SOUND}.gain(.8)`)),
            },
            expect: "pass",
          },
          { name: "beyond the brief: room and echoes", response: { code: PLACED }, expect: "pass" },
          {
            name: "echoes timed to half a beat on the riff",
            response: {
              code: code(KICK, snare(""), HATS, BASS, riff(`${RIFF_SOUND}.delay(.3).delaytime(.3).gain(.8)`)),
            },
            expect: "pass",
          },
          {
            name: "the riff in a big room of its own",
            response: {
              code: code(
                KICK,
                snare(""),
                HATS,
                BASS,
                riff(`${RIFF_SOUND}.room(.4).roomsize(5).orbit(2).gain(.8)`),
              ),
            },
            expect: "pass",
          },
          {
            name: "right function, nothing sent: a room size on a dry snare",
            response: {
              code: code(KICK, snare(".roomsize(6)"), HATS, BASS, riff(`${RIFF_SOUND}.gain(.8)`)),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "right function, nothing sent: an echo time with no delay",
            response: {
              code: code(KICK, snare(""), HATS, BASS, riff(`${RIFF_SOUND}.delaytime(.3).gain(.8)`)),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "right function, the size you already had",
            response: {
              code: code(KICK, snare(".room(.5).roomsize(2)"), HATS, BASS, riff(`${RIFF_SOUND}.gain(.8)`)),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a room with no size",
            response: {
              code: code(KICK, snare(".room(.5)"), HATS, BASS, riff(`${RIFF_SOUND}.gain(.8)`)),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
