// U07.L10 Hook Lab. A hook is short, comes back, and is easy to sing: one or two bars with a clear rhythm and
// one high point. Controlled chance (`?`, `.degradeBy()`, `.sometimesBy()`, unlocked here) changes some of its
// repeats, so the hook stays itself without sounding pasted. What the learner has: a motif moved by a
// sequence (U07.L02, `.scaleTranspose()`), one high point (U07.L01), chord notes on the strong beats (U07.L03),
// echoes with `.off()` (U07.L07), pickups (U07.L08). Spec: content/specs/U07.md.
//
// Randomness never sits under an exact-match grader (STYLE §11 rule 6): the chance tools appear in the
// ungraded steps, the rubric-graded modify (S4 grades motif reuse and range) and the Make. Strudel's chance is
// seeded by the cycle, so the same code makes the same choices on every run: S3 can ask how many of four loops
// play the `3?` note (evaluated: loops 2 and 3, cycles 7 and 11 of 0–15).
//
// Every hook here was checked against the four-chord Band (I V vi IV in C: C G Am F) on the evaluated events:
// on beats 1 and 3 each note is a note of the chord sounding. A third up (`.scaleTranspose(2)`) keeps most of
// them chord notes, which is why the lesson's chance examples move a note by a third rather than by a step.
import { defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 104;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A tune in degrees of C, with an optional tail (chance, effects) before the sound. */
const mel = (pattern: string, tail = "") => `mel: n("${pattern}").scale("C4:major")${tail}.s("piano")`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook: C5 C5 A4 | G4 D4 | C5 C5 A4 | A4 A4 F4, the last F (`3?`) left out on some repeats. Bar 1 comes
 * back in bar 3 as it is and in bar 4 two degrees (a 3rd) lower; bar 2 answers it. Over C G Am F the notes on beats 1 and
 * 3 are C C, G D, C C, A A: all chord notes, and the F on beat 4 of bar 4 is the F chord's root. Its high
 * point is the C an octave above home.
 */
const HOOK_MEL = "<[7 ~ 7 5] [4 ~ 1 ~] [7 ~ 7 5] [5 ~ 5 3?]>";
const HOOK = code(mel(HOOK_MEL));

/**
 * Four bars that never repeat: E C G D | B D5 G A | A E C5 E5 | F A C A. Every note on beats 1 and 3 is a
 * chord note (E G, B G, A C, F C) and none sits a half step above the chord: it fits the Band, and it is
 * only hard to remember.
 */
const NOODLE = "<[2 0 4 1] [6 8 4 5] [5 2 7 9] [3 5 0 5]>";

/**
 * S4: bar 1 is the hook's first bar. The reference brings it back in every bar, moved to fit each chord:
 * C C A over C, G G E over G, C C A over Am, A A F over F.
 */
const S4_BAR1 = "[7 ~ 7 5]";
const S4_REST = "[4 2 6 1] [5 9 0 5] [3 7 5 0]";
const s4 = (rest: string) => code(mel(`<${S4_BAR1} ${rest}>`));
const S4_REFERENCE = s4("[4 ~ 4 2] [7 ~ 7 5] [5 ~ 5 3]");
const S4_MATCHER: Matcher = {
  m: "rubric",
  rules: [
    {
      id: "comes-back",
      label: "At least two of bars 2 to 4 repeat the shape of an earlier bar, the same or moved",
      required: true,
      skills: ["M09"],
      rule: "motif-reuse",
      track: "@melody",
      minRatio: 0.66,
      shape: "either",
      // The brief allows "the same": a hook written out four times comes back three times, it is not a
      // one-bar loop with nothing to reuse (corrections pass, theory-b 5).
      loopRepeats: true,
    },
    {
      id: "singable",
      label: "The lowest and highest notes are at most an octave apart",
      required: true,
      skills: ["M09"],
      rule: "range",
      track: "@melody",
      maxSpan: 12,
    },
  ],
};

/** S5: the hook brought back four times, then chance on top. */
const S5_HOOK = "<[7 ~ 7 5] [4 ~ 4 2] [7 ~ 7 5] [5 ~ 5 3]>";
const s5 = (tail = "") => code(mel(S5_HOOK, tail));

/**
 * S6, by ear: a two-bar hook with a one-beat pickup. 5 | 1' . 1' 7 | 6 . 5 . (G4 | C5 C5 B4 | A4 G4): a 4th
 * up from the pickup to the high home, then down by step.
 */
const HEARD = "<[~ ~ ~ 4] [7 ~ 7 6] [5 ~ 4 ~]>";
const HEARD_STARTER = code(mel("<⟪[~ ~ ~ ~] [0 ~ ~ ~] [0 ~ ~ ~]⟫>"));
const HEARD_STARTER_PLAIN = code(mel("<[~ ~ ~ ~] [0 ~ ~ ~] [0 ~ ~ ~]>"));

/**
 * The Make starts from the noodle. The minimal sketch brings bar 1 back in bars 2 and 4, moved to fit the
 * chord: B G D5 A over G (four degrees up), F D A E over F (one up).
 */
const MAKE_STARTER = code(mel(NOODLE));
const MAKE_MINIMAL = code(mel("<[2 0 4 1] [6 4 8 5] [5 2 7 9] [3 1 5 2]>"));
/** Beyond the brief: the hook, a third up on some notes, the last note left out on some repeats, room. */
const MAKE_BEYOND = code(
  `mel: n("${HOOK_MEL}").scale("C4:major")\n  .sometimesBy(.2, x => x.scaleTranspose(2)).s("piano").room(.3)`,
);

/** The four-chord Band, every track: a hook is heard against a whole song. */
const BAND = { band: "band.axis-4bar" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U07.L10",
  version: 3,
  title: "Hook Lab",
  objective:
    "I can write a short hook that comes back and is easy to sing, and let chance change a few of its repeats.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["M09"],
  practises: [],
  terms: [],
  canDo: ["cd.compose.hook"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Stuck in your head",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 16 },
      exercise: {
        kind: "listen",
        id: "stuck-in-your-head",
        version: 1,
        role: "practice",
        prompt:
          "The hook plays four times round. Hum along as soon as you can. Then listen for the end of each bar 4: does every repeat end the same way?",
        skills: [{ skill: "M09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Over I V vi IV, four times round.",
            bars: 16,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "Which one sticks?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-sticks",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both cards, two tunes over the same chords. Pick the one you could sing back after one hearing.",
        skills: [{ skill: "M09", w: 1 }],
        hints: ladder(
          "After which card can you hum the first bar again?",
          "Listen for a bar that comes back. A tune you can sing back after one go repeats something.",
          "One card plays the same idea in bars 1 and 3. Which one?",
        ),
        stimulus: { src: "code", code: HOOK, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "hook", label: "Card A", audio: HOOK },
            { id: "noodle", label: "Card B", audio: code(mel(NOODLE)) },
          ],
        },
        correct: { choice: ["hook"] },
        // The catalog's `id.wrong` names the option ids.
        feedbackText: {
          "id.wrong":
            "Card A is the one that sticks: bar 3 brings bar 1 back, and every bar has room to breathe. Card B never repeats a bar. Play both again.",
        },
        tests: [
          { name: "card A", response: { answer: { choice: ["hook"] } }, expect: "pass" },
          {
            name: "card B",
            response: { answer: { choice: ["noodle"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Now and then",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "now-and-then", code: HOOK, bars: 16 },
      exercise: {
        kind: "run-investigate",
        id: "now-and-then",
        version: 1,
        role: "practice",
        prompt:
          "Run it for four loops and watch bar 4 on the roll. Its last note is written `3?`, with a question mark. Count the loops in which that note plays, and pick what the `?` does. Answer both questions below.",
        skills: [{ skill: "M09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Watch only the last note of bar 4, the F, and count the loops where it appears on the roll.",
        },
        hints: ladder(
          "In bar 4, which note is sometimes there and sometimes not?",
          "The roll keeps each loop. Look at bar 4 of each of the four loops and count the F.",
          "In the first loop the F is missing. Check the other three.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "In how many of the four loops does the `3?` note play?",
            correct: 2,
          },
          {
            q: "choice",
            prompt: "What does the `?` do to the note before it?",
            options: [
              { id: "chance", label: "Plays it about half the time, chosen by chance" },
              { id: "quieter", label: "Plays it every time, at half the volume" },
              { id: "alternate", label: "Plays it in every other loop, by turns" },
            ],
            correct: ["chance"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 2, choice: ["chance"] } }, expect: "pass" },
          {
            name: "counted every loop",
            response: { answer: { number: 4, choice: ["chance"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "heard it as quieter",
            response: { answer: { number: 2, choice: ["quieter"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Tighten it",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "tighten-it",
        version: 1,
        role: "check",
        prompt:
          "Rewrite bars 2 to 4, the highlighted part, so they bring bar 1 back: its rhythm and its ups and downs, as it is or moved up or down to fit the chord. Done when at least two of bars 2 to 4 repeat bar 1's shape and the whole tune stays within an octave.",
        skills: [{ skill: "M09", w: 1 }],
        code: { starter: s4(`⟪${S4_REST}⟫`) },
        reference: { solutions: [S4_REFERENCE], bars: 4 },
        matcher: S4_MATCHER,
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        // The rules' own details speak of units and semitones; these say it in the lesson's words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Only bars 2 to 4 change. Which of them sounds like bar 1 now, and which would you like to?",
          "A bar brings the hook back if it keeps bar 1's rhythm and its ups and downs. Moving every note by the same number of degrees is still the hook, the way a sequence moves a motif.",
          "Bar 3 sits over the vi chord, whose notes include C and A: bar 1 as it is fits there. Bar 2 is over V: move bar 1 down three degrees.",
        ),
        tests: [
          { name: "reference", response: { code: S4_REFERENCE }, expect: "pass" },
          {
            name: "moved by other amounts",
            response: { code: s4("[4 ~ 4 2] [5 ~ 5 3] [5 ~ 5 3]") },
            expect: "pass",
          },
          {
            name: "the same: bar 1 written out four times",
            response: { code: s4("[7 ~ 7 5] [7 ~ 7 5] [7 ~ 7 5]") },
            expect: "pass",
          },
          {
            name: "the same twice, moved once",
            response: { code: s4("[7 ~ 7 5] [4 ~ 4 2] [7 ~ 7 5]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s4(S4_REST) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "copies, but bar 4 drops an octave: too wide to sing",
            response: { code: s4("[7 ~ 7 5] [7 ~ 7 5] [0 ~ 0 -2]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a different idea in every bar",
            response: { code: s4("[4 3 2 ~] [5 6 7 ~] [3 ~ 5 4]") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Let chance in",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "let-chance-in",
        version: 1,
        role: "practice",
        prompt:
          "Add one chance tool to the `mel` line, after `.scale()`: `.degradeBy(.2)` leaves out about one note in five; `.sometimesBy(.25, x => x.scaleTranspose(2))` moves about one in four up a 3rd. A `?` after one note also works. Done when at least one repeat of the hook sounds different from the first.",
        skills: [{ skill: "M09", w: 1 }],
        code: { starter: s5() },
        // Twelve bars: the four-bar hook three times, so a repeat can be heard to change (corrections gate, AS-44).
        reference: { solutions: [s5(".degradeBy(.2)")], bars: 12 },
        matcher: {
          m: "rubric",
          rules: [
            {
              id: "chance",
              label: "Chance makes at least one four-bar repeat differ from the first",
              required: true,
              skills: ["M09"],
              // Corrections gate (AS-44): a repeat really changes; a chance tool that changes nothing does not count.
              rule: "custom",
              fn: "chance-varies",
              params: { bars: 4, alsoUses: ["tb.mini.maybe", "tb.degradeBy", "tb.sometimesBy"] },
            },
          ],
        },
        feedbackText: {
          "rubric.unmet":
            "No chance yet: every repeat is still the same. Add `.degradeBy()` or `.sometimesBy()` after `.scale()`, or a `?` after a note.",
        },
        target: { audible: false },
        hints: ladder(
          "The hook repeats exactly. Which of the three chance tools would you try first: `?`, `.degradeBy()` or `.sometimesBy()`?",
          "The chance call goes in the chain after `.scale()` and before `.s()`. Its first number is how often it acts, from 0 to 1.",
          "With `.degradeBy()` the number is the share of notes left out: a fifth is .2.",
        ),
        tests: [
          { name: "reference", response: { code: s5(".degradeBy(.2)") }, expect: "pass" },
          {
            name: "sometimes a 3rd up",
            response: { code: s5(".sometimesBy(.25, x => x.scaleTranspose(2))") },
            expect: "pass",
          },
          {
            name: "a question mark on one note",
            response: { code: code(mel("<[7 ~ 7 5] [4 ~ 4 2?] [7 ~ 7 5] [5 ~ 5 3?]>")) },
            expect: "pass",
          },
          { name: "unchanged", response: { code: s5() }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "louder instead of chance",
            response: { code: s5(".gain(.8)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "dictate",
      title: "Catch the hook",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "catch-the-hook",
        version: 2,
        role: "check",
        prompt:
          "Write the two-bar hook you hear in `n`, one bar per word of the `mel` line. Any key passes. Count along from the count-in. If a note comes before beat 1 of the first full bar, write it at the end of bar 0. Done when your hook matches the source note for note.",
        skills: [
          { skill: "E07", w: 0.7 },
          { skill: "M09", w: 0.3 },
        ],
        pickup: { units: [1, 1] },
        hints: ladder(
          "Count along: does the first note come on a 1? Is the highest note home, an octave up?",
          "One note leads in on beat 4 of bar 0 and leaps up a 4th to the high home. From there the line steps down.",
          "Bar 0 is three rests and degree 5 (`n` 4). Bar 1 starts with the high home twice.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: code(mel(HEARD)), bars: 3, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: HEARD_STARTER },
        reference: { solutions: [code(mel(HEARD))], bars: 3 },
        // The step is about where the hook starts ("does it start on a 1?"), so the rhythm matcher sits beside
        // the melody one, as in Pickups S5: a hook written from the bar line is `rhythm.pickup-missing`. The
        // pass is raised from the dictation default (0.85) because five notes leave little room: at 0.85 the
        // hook without its pickup (0.90), the pickup a beat early (0.97) and a wrong last note (0.87) all
        // passed (teaching review).
        matcher: {
          m: "all",
          of: [
            {
              m: "melody",
              pitch: "transposition-invariant",
              wPitch: 0.8,
              wRhythm: 0.2,
              rhythmTol: [1, 16],
              track: "mel",
            },
            {
              m: "rhythm",
              tol: [1, 16],
              durations: false,
              perRole: false,
              displacementCredit: 0.5,
              tracks: ["mel"],
            },
          ],
        },
        pass: 0.98,
        byEar: { ab: true, rates: [1, 0.75, 0.5], accepts: "any-key" },
        feedbackText: {
          "rhythm.pickup-missing":
            "Every note is there, but the hook starts on the bar line. Its first note comes before beat 1: put it on beat 4 of bar 0.",
        },
        srs: [{ family: "fam.mel.dictation", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: code(mel(HEARD)) }, expect: "pass" },
          {
            name: "the same hook in G",
            response: { code: `${TEMPO}mel: n("${HEARD}").scale("G4:major").s("piano")` },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: HEARD_STARTER_PLAIN },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "one degree high throughout",
            response: { code: code(mel("<[~ ~ ~ 5] [8 ~ 8 7] [6 ~ 5 ~]>")) },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "the leap heard as a step",
            response: { code: code(mel("<[~ ~ ~ 4] [5 ~ 5 4] [3 ~ 2 ~]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          // Teaching review: each of these passed at the dictation default.
          {
            name: "written from the bar line, the pickup left out",
            response: { code: code(mel("<[~ ~ ~ ~] [4 7 ~ 7] [6 5 ~ 4]>")) },
            expect: "fail",
            feedback: ["rhythm.pickup-missing"],
          },
          {
            name: "the pickup a beat early, on beat 3",
            response: { code: code(mel("<[~ ~ 4 ~] [7 ~ 7 6] [5 ~ 4 ~]>")) },
            expect: "fail",
            feedback: ["melody.rhythm-note"],
          },
          {
            name: "the last note heard as 3",
            response: { code: code(mel("<[~ ~ ~ 4] [7 ~ 7 6] [5 ~ 2 ~]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the whole hook an octave lower",
            response: { code: code(mel("<[~ ~ ~ -3] [0 ~ 0 -1] [-2 ~ -3 ~]>")) },
            expect: "pass",
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your hook",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "your-hook",
        version: 1,
        role: "practice",
        prompt:
          "Turn these four bars, which never repeat, into a hook. Pick one or two bars and bring them back in other bars, the same or moved to fit the chord. Done when at least one bar comes back. Then, if you like, add `?`, `.degradeBy()` or `.sometimesBy()` so chance changes a few repeats.",
        skills: [{ skill: "M09", w: 1 }],
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "comes-back",
            label:
              "At least one bar repeats the shape of an earlier bar, the same or moved, and not every bar is the same",
            required: true,
            skills: ["M09"],
            rule: "motif-reuse",
            track: "@melody",
            // Corrections gate (now-fails B): one bar of four brought back is a hook (hint 3: "copy bar 1 there").
            minRatio: 0.25,
            shape: "either",
            // Corrections pass: one pass is read as four bars at least, so a two-bar hook played twice
            // (`<A B A B>`) comes back; a one-bar loop, every bar the same, still fails.
            loopRepeats: 4,
          },
          {
            id: "chance",
            label: "Uses `?`, `.degradeBy()` or `.sometimesBy()`",
            required: false,
            skills: ["M09"],
            rule: "uses",
            tool: ["tb.mini.maybe", "tb.degradeBy", "tb.sometimesBy"],
          },
          {
            id: "singable",
            label: "Singable: the lowest and highest notes are at most an octave apart",
            required: false,
            skills: ["M09"],
            rule: "range",
            track: "@melody",
            maxSpan: 12,
          },
        ],
        hints: ladder(
          "A hook is a bar that comes back. Which bar of the starter would you most like to hear again?",
          "Pick one bar and bring it back in another bar, the same or moved by a few degrees to fit the chord.",
          "Bar 1 over C fits again over the vi chord in bar 3. Copy it there and listen.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: bar 1 back in bars 2 and 4", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: the hook, a dropped note, chance a 3rd up, room",
            response: { code: MAKE_BEYOND },
            expect: "pass",
          },
          {
            name: "another four bars that never repeat",
            response: { code: code(mel("<[0 2 4 6] [4 3 1 -1] [5 7 4 2] [3 6 5 0]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a two-bar hook played twice",
            response: { code: code(mel("<[2 0 4 1] [3 ~ 1 ~] [2 0 4 1] [3 ~ 1 ~]>")) },
            expect: "pass",
          },
          {
            name: "a two-bar hook, then the same two bars a step lower",
            response: { code: code(mel("<[2 0 4 1] [3 ~ 1 ~] [1 -1 3 0] [2 ~ 0 ~]>")) },
            expect: "pass",
          },
          {
            name: "one bar four times: a one-bar loop",
            response: { code: code(mel("<[2 0 4 1] [2 0 4 1] [2 0 4 1] [2 0 4 1]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a hook that comes back moved, the last bar new",
            response: { code: code(mel("<[2 0 4 1] [4 2 6 3] [3 1 5 2] [1 ~ 0 ~]>")) },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
