// U07.L07 Call & Response. One part plays a short phrase and leaves a gap; another part answers in it. A
// second labelled line on another sound makes a real answer; `.off()` (unlocked here) makes a quick echo
// of a line, a beat later and moved by degrees. What the learner has: labelled lines and the code mute
// `_name:` (U00–U01), degrees in `n` (U03), the four-chord loop and its numerals (U05–U06), chord tones on
// beats 1 and 3 (U07.L03), a question answered by a phrase that comes home (U07.L06). Not yet: phrases that
// start before the bar line (U07.L08). Spec: content/specs/U07.md.
//
// How it grades: the modify step is a `rubric` matcher with two required rules: two melody parts (`tracks`
// with `roles: ["melody"]`, so the chords line does not count as the second part) and chord tones on beats 1
// and 3 of the response. The grader is not given the Band's code (see U06.L05, U07.L04), so the step writes
// the loop's chords as a `chords:` line (I V vi IV, the Band's harmony) and the Band plays drums and bass.
// The by-ear step grades only the `vox` line, in any octave but in C (`accepts: "any-octave"`): the call is
// in C, so a reply in another key would answer it differently. The Make's
// one required rule is `call-response` (the two parts take turns: a copy of the call on `vox` plays with it,
// not after it); its chord-tone suggestion is left out for the reason above, so its suggestion is the
// response coming home.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** The call: piano. */
const call = (pattern: string, extra = "") => `mel: n("${pattern}").scale("C4:major")${extra}.s("piano")`;
/** The response: a second melody line, on the Rhodes unless said otherwise. */
const resp = (pattern: string, sound = "rhodes") => `vox: n("${pattern}").scale("C4:major").s("${sound}")`;
/** The loop's chords, I V vi IV, stacked on the roots an octave under the tune. */
const CHORDS = 'chords: n("[0,2,4]").add(n("<0 4 5 3>")).scale("C3:major").s("piano").gain(.5)';

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook over I V vi IV. The call (piano) plays in bars 1 and 3: C E G over I, A G E over vi. The
 * response (Rhodes) answers in bars 2 and 4: G D over V, F C over IV, ending home. Beats 1 and 3 are chord
 * tones throughout.
 */
const CALL = "<[0 2 4 ~] ~ [5 4 2 ~] ~>";
const RESPONSE = "<~ [4 ~ 1 ~] ~ [3 ~ 0 ~]>";
const HOOK = code(call(CALL), resp(RESPONSE));

/** S4: the `vox` line is silent; its bars 2 and 4 are the learner's. */
const S4 = (bar2: string, bar4: string) => code(CHORDS, call(CALL), resp(`<~ ${bar2} ~ ${bar4}>`));
const S4_STARTER = S4("⟪[~ ~ ~ ~]⟫", "⟪[~ ~ ~ ~]⟫");
const S4_PLAIN = S4("[~ ~ ~ ~]", "[~ ~ ~ ~]");
const S4_REF = S4("[4 ~ 1 ~]", "[3 ~ 0 ~]");
const S4_RULES: Matcher = {
  m: "rubric",
  rules: [
    {
      id: "two-parts",
      label: "Two melody lines play: the piano's `mel` and your `vox`",
      required: true,
      skills: ["M07"],
      rule: "tracks",
      min: 2,
      roles: ["melody"],
    },
    {
      id: "on-the-chords",
      label:
        "At least three in four of the `vox` notes on beats 1 and 3 are chord tones of the `chords:` line",
      required: true,
      skills: ["M03"],
      rule: "chord-tones-strong",
      minRatio: 0.75,
      melody: "vox",
      harmony: "chords",
      strength: "strong",
    },
  ],
};

/** S5: the call echoed by itself, a beat later and a 3rd higher. */
const ECHO = (delay: string, step: string) =>
  code(call(CALL, `.off(${delay}, x => x.scaleTranspose(${step}))`));
const ECHO_STARTER = ECHO("1/4", "2");
const ECHO_REF = ECHO("1/2", "2");

/**
 * S6, by ear: a new call is given (C E G over I, A E C over vi); the response is hidden: B G D over V, A F C
 * over IV, home at the end. Six notes over two bars, leaps up to a 4th (fam.mel.dictation level 5 material).
 */
const HEARD_CALL = "<[0 ~ 2 4] ~ [5 ~ 2 0] ~>";
const HEARD_RESPONSE = "<~ [6 ~ 4 1] ~ [5 ~ 3 0]>";
const HEARD = code(call(HEARD_CALL), resp(HEARD_RESPONSE));
const heard = (response: string) => code(call(HEARD_CALL), resp(response));
const HEARD_STARTER = heard("<~ ⟪[~ ~ ~ ~]⟫ ~ ⟪[~ ~ ~ ~]⟫>");
const HEARD_PLAIN = heard("<~ [~ ~ ~ ~] ~ [~ ~ ~ ~]>");

/** The Make: a call that climbs twice (C E G over I, E G A over vi) and leaves bars 2 and 4 empty. */
const MAKE_CALL = "<[0 2 4 ~] ~ [2 4 5 ~] ~>";
const MAKE_STARTER = code(call(MAKE_CALL));
const MAKE_MINIMAL = code(call(MAKE_CALL), resp("<~ [4 ~ 1 ~] ~ [3 ~ 0 ~]>"));
/** Beyond the brief: an organ response that ends home, an echo on the call, room. */
const MAKE_BEYOND = code(
  call(MAKE_CALL, ".off(1/2, x => x.scaleTranspose(2))"),
  `${resp("<~ [6 4 ~ 1] ~ [5 3 1 0]>", "organ")}.gain(.7).room(.3)`,
);
/** The response written into the call's own line: one part, not two. */
const MAKE_ONE_LINE = code(call("<[0 2 4 ~] [4 ~ 1 ~] [2 4 5 ~] [3 ~ 0 ~]>"));

/** The Band's four-chord loop: I V vi IV. */
const BAND = { band: "band.axis-4bar" } as const;
/** S4: drums and bass only; the code's own chords line sets the harmony. */
const BAND_BASS = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U07.L07",
  version: 4,
  title: "Call & Response",
  objective: "I can write a call in one part and a response in another part that answers it in the gap.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M07"],
  practises: [],
  terms: [{ id: "term.call-and-response", step: "S3" }],
  canDo: ["cd.compose.call-response"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two voices",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "two-voices",
        version: 1,
        role: "practice",
        prompt:
          "Listen for how the piano and the Rhodes share the four bars: do they play at the same time, or take turns?",
        skills: [{ skill: "M07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Four bars, two voices: piano and Rhodes.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Whose bar is it?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "two-lines", code: HOOK, bars: 4 },
      exercise: {
        kind: "predict",
        id: "whose-bar",
        version: 1,
        role: "practice",
        prompt:
          "Predict the bars in which the Rhodes, the `vox` line, plays. Each `< >` holds four bars, one per word, and a `~` on its own is a bar of rest. Pick the bars, then run it.",
        skills: [{ skill: "M07", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "two-four", label: "Bars 2 and 4" },
          { id: "one-three", label: "Bars 1 and 3" },
          { id: "all", label: "All four bars" },
        ],
        correct: ["two-four"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Take turns",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "take-turns", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "take-turns",
        version: 1,
        role: "practice",
        prompt:
          "Run it, then hear each part alone: put `_` in front of `vox:` and run it, then remove it and put `_` in front of `mel:`. Find which part ends on degree 1, and how many beats the piano rests after each phrase. Answer both questions below.",
        skills: [{ skill: "M07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Mute one line at a time and count the beats from the piano's last note to its next one.",
        },
        hints: ladder(
          "Mute one part at a time. Which part sounds finished on its own, and which one sounds like it is waiting?",
          "Read the last note of each line on the roll. Then count the piano's silence with the drums: the rest at the end of its bar, and the bar after.",
          "The piano stops after beat 3 of bar 1 and starts again on beat 1 of bar 3. The Rhodes' last note is `n` 0.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which part ends at home, on degree 1?",
            options: [
              { id: "rhodes", label: "The Rhodes, in bar 4" },
              { id: "piano", label: "The piano, in bar 3" },
            ],
            correct: ["rhodes"],
          },
          {
            q: "number",
            prompt: "After each phrase, how many beats does the piano rest before it plays again?",
            correct: 5,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["rhodes"], number: 5 } }, expect: "pass" },
          {
            name: "only the empty bar counted",
            response: { answer: { choice: ["rhodes"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the piano heard as ending",
            response: { answer: { choice: ["piano"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Answer the call",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND_BASS },
      exercise: {
        kind: "code-modify",
        id: "answer-the-call",
        version: 1,
        role: "check",
        prompt:
          "On the `vox` line, write a response in bars 2 and 4, the two highlighted bars. Put chord tones on beats 1 and 3: V (G B D) in bar 2, IV (F A C) in bar 4. Done when `vox` plays in both bars and its notes on beats 1 and 3 are chord tones.",
        skills: [
          { skill: "M07", w: 0.7 },
          { skill: "M03", w: 0.3 },
        ],
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_REF], bars: 4 },
        matcher: S4_RULES,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Write notes in the two highlighted bars of `vox`: degree 5, 7 or 2 (G B D) on beats 1 and 3 of bar 2, and degree 4, 6 or 1 (F A C) on beats 1 and 3 of bar 4.",
        },
        hints: ladder(
          "Your notes go only in bars 2 and 4 of `vox`, where the piano rests. Which chords play under those two bars?",
          "Bar 2 is V, degrees 5, 7 and 2 (G B D); bar 4 is IV, degrees 4, 6 and 1 (F A C). In `n`, subtract 1.",
          "Bar 2 could start on degree 5, `n` 4, and fall to another note of V on beat 3. Bar 4 can do the same on IV and end on home.",
        ),
        tests: [
          { name: "reference", response: { code: S4_REF }, expect: "pass" },
          {
            name: "a busier response, B G D and A F C",
            response: { code: S4("[6 4 1 ~]", "[5 3 0 ~]") },
            expect: "pass",
          },
          { name: "unchanged", response: { code: S4_PLAIN }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "a response off the chords",
            response: { code: S4("[3 ~ 0 ~]", "[4 ~ 1 ~]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the response written on top of the call, in bars 1 and 3",
            response: { code: code(CHORDS, call(CALL), resp("<[4 ~ 1 ~] ~ [3 ~ 0 ~] ~>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "An echo",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "an-echo",
        version: 1,
        role: "practice",
        prompt:
          "`.off(1/4, x => x.scaleTranspose(2))` plays the call again a beat later, two degrees higher. Change the delay (1/4), the step (2), or both, and listen to where the echo lands. Keep `.off()` on the call. Done when the echo still sounds later than the call, not on top of it.",
        skills: [{ skill: "M07", w: 1 }],
        code: { starter: ECHO_STARTER },
        reference: { solutions: [ECHO_REF], bars: 4 },
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "echo",
              label: "`.off()` plays the call again, later than the call and not on top of it",
              required: true,
              skills: ["M07"],
              // Corrections gate (AS-43): an echo you hear, later than the call; `.off(0, …)` and `.off(4, …)` do not.
              rule: "custom",
              fn: "echo",
              params: { track: "mel", alsoUses: ["tb.off"] },
            },
          ],
        },
        constraints: [{ c: "must-use", tool: "tb.off", feedback: "code.must-use" }],
        target: { audible: false, showRoll: false },
        feedbackText: {
          "code.must-use": "Keep `.off()` on the call: change the numbers inside it.",
        },
        hints: ladder(
          "There are two numbers to change inside `.off()`. Which one says when the echo comes, and which says how far it moves?",
          "The first number is the delay, in bars: 1/4 is one beat. The 2 inside `scaleTranspose` moves the echo two degrees up.",
          "Try a delay of two beats, so the echo lands in the piano's own rest.",
        ),
        tests: [
          { name: "reference: two beats later", response: { code: ECHO_REF }, expect: "pass" },
          {
            name: "an eighth later, a 5th up",
            response: { code: ECHO("1/8", "4") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: ECHO_STARTER },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the echo taken out",
            response: { code: code(call(CALL, ".room(.3)")) },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "dictate",
      title: "Hear the reply",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "hear-the-reply",
        version: 1,
        role: "check",
        prompt:
          "Listen to the source: the piano calls in bars 1 and 3, and a Rhodes replies in bars 2 and 4, three notes a bar. Write the Rhodes' reply in the highlighted bars of the `vox` line, in `n`, in C major. Done when your reply matches it note for note.",
        skills: [
          { skill: "M07", w: 0.4 },
          { skill: "E07", w: 0.6 },
        ],
        hints: ladder(
          "Sing the reply after the source plays. Where does it end, and does it go up or down to get there?",
          "Bar 2 starts high on a note of V and falls through V; bar 4 starts on a note of IV and falls home.",
          "Bar 4 is `[5 ~ … …]`: it starts on degree 6, `n` 5. Bar 2 starts on degree 7.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: HEARD, bars: 4, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: HEARD_STARTER },
        reference: { solutions: [HEARD], bars: 4 },
        // The call is given in C, so the reply is heard against it: a reply in another key changes how
        // it answers the call. Any octave is fine; any key is not (corrections pass, theory-b 2).
        matcher: {
          m: "melody",
          pitch: "octave-free",
          wPitch: 0.8,
          wRhythm: 0.2,
          rhythmTol: [1, 16],
          track: "vox",
        },
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "any-octave" },
        srs: [{ family: "fam.mel.dictation", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: HEARD }, expect: "pass" },
          {
            name: "the reply an octave lower",
            response: { code: heard("<~ [-1 ~ -3 -6] ~ [-2 ~ -4 -7]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: HEARD_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the reply a bar early, on top of the call",
            response: { code: heard("<[6 ~ 4 1] ~ [5 ~ 3 0] ~>") },
            expect: "fail",
            feedback: ["melody.rhythm-note"],
          },
          {
            name: "both last leaps heard as steps: D as F, C as E",
            response: { code: heard("<~ [6 ~ 4 3] ~ [5 ~ 3 2]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the reply in note names",
            response: {
              code: code(call(HEARD_CALL), 'vox: note("<~ [b4 ~ g4 d4] ~ [a4 ~ f4 c4]>").s("rhodes")'),
            },
            expect: "pass",
          },
          {
            name: "the reply an octave higher",
            response: { code: heard("<~ [13 ~ 11 8] ~ [12 ~ 10 7]>") },
            expect: "pass",
          },
          {
            name: "the right shape, but the reply in F# major against a call in C",
            response: {
              code: code(call(HEARD_CALL), resp(HEARD_RESPONSE).replace("C4:major", "F#4:major")),
            },
            expect: "fail",
            feedback: ["melody.wrong-key"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Call, then answer",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "call-then-answer",
        version: 1,
        role: "practice",
        prompt:
          "Add a `vox:` line that answers the call in bars 2 and 4, while `mel` rests, for the quiet part of your song. Play it on the Rhodes, the organ or the piano. Done when the two lines take turns instead of playing together. End `vox` on degree 1 to bring the four bars home.",
        skills: [{ skill: "M07", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          // Taking turns is checked, not only a second line: the call copied onto `vox` plays with it and
          // answers nothing (corrections pass, theory-b 3).
          {
            id: "two-parts",
            label:
              "`mel` and `vox` both play notes and take turns: they rarely start a note on the same beat",
            required: true,
            skills: ["M07"],
            rule: "custom",
            fn: "call-response",
            params: { a: "mel", b: "vox" },
          },
          {
            id: "home",
            label: "The last note of `vox` is degree 1 (C)",
            required: false,
            skills: ["M07"],
            rule: "ends-on-degree",
            track: "vox",
            degrees: ["1"],
          },
        ],
        hints: ladder(
          "The call plays in bars 1 and 3. Where does it leave room, and which new line fills it?",
          "A second part is a second labelled line: `vox:` with its own `n(…)`, `.scale()` and sound. Rest in bars 1 and 3.",
          "The response's line can start `<~ [ … ] ~ [ … ]>`: a rest bar, a bar of notes, again.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: a vox line in bars 2 and 4", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: an organ response, an echo on the call, room",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "the response written into the call's own line",
            response: { code: MAKE_ONE_LINE },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the call copied onto vox: both play together, nothing answers",
            response: { code: code(call(MAKE_CALL), resp(MAKE_CALL)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a vox line that plays all the way through, over the call",
            response: { code: code(call(MAKE_CALL), resp("<[4 2 1 0] [4 ~ 1 ~] [5 4 3 2] [3 ~ 0 ~]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a reply that comes in on beat 4 of the call's bar and runs on",
            response: {
              code: code(call(MAKE_CALL), resp("<[~ ~ ~ 7] [6 4 2 ~] [~ ~ ~ 6] [5 3 1 0]>", "piano")),
            },
            expect: "pass",
          },
          {
            name: "a short answer, one held note a bar, on the organ",
            response: { code: code(call(MAKE_CALL), resp("<~ 4 ~ 0>", "organ")) },
            expect: "pass",
          },
          {
            name: "the parts trade halves of each bar",
            response: {
              code: code(
                call("<[0 2 ~ ~] [2 4 ~ ~] [4 5 ~ ~] [2 0 ~ ~]>"),
                resp("<[~ ~ 4 1] [~ ~ 3 0] [~ ~ 2 1] [~ ~ 1 0]>"),
              ),
            },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
