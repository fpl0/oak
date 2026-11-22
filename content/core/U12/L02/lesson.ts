// U12.L02 Dominant vs Major 7. Cmaj7 and C7 share three notes; the fourth differs by one half step, B against
// B♭. That half step changes what the chord does: the major seventh rests where it is, the dominant seventh
// leans on to the chord a 5th below. Hearing which is which is the first seventh-chord skill (E11). What the
// learner has: the dominant seventh and `C7` from the blues (U11.L04), the major seventh chord and `C^7`
// (U12.L01), one `const` driving chords and bass (U08.L04), te as the blues scale's own ♭7 (U11.L02). Not
// yet: the half-diminished and diminished sevenths (U12.L03), which degree gets which seventh (U12.L04), a
// name for C7 before F (a secondary dominant, U15.L02: here it "leans into F"), chromatic degrees and their
// syllables against a major key (U15.L01). Spec: content/specs/U12.md.
//
// How it is graded (AUTHORING §17, §19): the error hunt is found by its edit (the changed token is the click)
// and fixed against the reference as pitch classes and lowest note per onset (`pcset`, `bass: true`). The ear
// step is six trials of `fam.chd.quality-7th` at level 1 (major seventh against dominant seventh), which this
// lesson seeds. The two sung lines are never graded checks and never gate; the second declares C blues, where
// ♭7 is one of the key's own degrees (check 14, `chromatic.before-u15`). The Make's one required rule is
// `chord-qualities` at seventh depth with `contains: ["maj7", "7"]`: the starter has no dominant seventh, and
// a loop of four dominants has no major seventh.
import { defineLesson, type HintLadder, type IdentifyEx, type SingEx } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
/** The root of every chord, low on the upright: the voicing above does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/** The hook: the same two roots as major sevenths (rest), then as dominant sevenths (lean). */
const HOOK = loop("<C^7 F^7 C7 F7>");
const REST = loop("<C^7 F^7>");
const LEAN = loop("<C7 F7>");

/** S2: Cmaj7, then C7. */
const CMAJ7_THEN_C7 = code('chords: chord("<C^7 C7>").voicing().s("rhodes")');
/**
 * S3: Cmaj7, C7, then Fmaj7 for two bars, stacked by hand from the root so the roll reads root, 3rd, 5th,
 * 7th bottom to top and the one note that moves (B to B♭) is the top one.
 */
const STACKS = code(
  'chords: note("<[c3,e3,g3,b3] [c3,e3,g3,bb3] [f3,a3,c4,e4] [f3,a3,c4,e4]>").s("rhodes")',
  'bass: note("<c2 c2 f2 f2>").s("upright")',
);

/** S4: U12.L01's loop with a major seventh on G: G B D F♯, and F♯ is not in C major. */
const HUNT_STARTER = loop("<C^7 Am7 Dm7 G^7>");
const HUNT_SOLUTION = loop("<C^7 Am7 Dm7 G7>");

/** S6: the two 7ths sung against a held C: do ti do over Cmaj7, do te do over C7 (C5 B4 C5 / C5 B♭4 C5). */
const held = (symbol: string, scale: string, line: string) =>
  code(
    `chords: chord("${symbol}").voicing().s("rhodes").gain(.5)`,
    'bass: note("c2").s("upright")',
    `mel: n("${line}").scale("${scale}").s("piano")`,
  );
const SING_TI = held("C^7", "C4:major", "<[7 ~ 6 ~] [7 ~ ~ ~]>");
/** In `C4:blues` (C E♭ F G♭ G B♭) step 5 is B♭ and step 6 the next C. */
const SING_TE = held("C7", "C4:blues", "<[6 ~ 5 ~] [6 ~ ~ ~]>");

/**
 * The Make: a ballad turn in plain triads (C C F G), in note names so B♭ can be written (`bb4`). Each bar climbs to
 * a held note: B over C (the major 7th, waiting for a chord that holds it), A over the second C, A over F, B over G.
 * The learner colours the turn: a major seventh where it rests, a dominant seventh where it leans (learner review:
 * the old starter already rested in Cmaj7, so one character, G to G7, passed). With bar 2 as C7 the held A can become B♭, and it
 * falls to bar 3's A; with bar 4 as G7 the held note can be F, which falls to bar 1's E.
 */
const tune = (pattern: string) => `mel: note("${pattern}").s("piano")`;
const TURN_TUNE = tune("<[e4 g4 b4@2] [e4 g4 a4@2] [c4 e4 a4@2] [d4 g4 b4@2]>");
const LEAN_TUNE = tune("<[e4 g4 b4@2] [e4 g4 bb4@2] [c4 e4 a4@2] [b3 d4 f4@2]>");
const MAKE_STARTER = loop("<C C F G>", TURN_TUNE);
/** One that rests and one that leans, two edits: the learner chooses which bars. */
const MAKE_ONE_EACH = loop("<C^7 C F G7>", TURN_TUNE);
const MAKE_MINIMAL = loop("<C^7 C^7 F^7 G7>", TURN_TUNE);
const MAKE_BOTH = loop("<C^7 C7 F^7 G7>", LEAN_TUNE);

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

const TOL = {
  cents: "learner",
  octave: "global",
  driftCompCents: 30,
  minCoverage: 0.4,
  passHitRate: 0.8,
} as const;

/** S5: one trial of the family per part, drawn by the lesson host (a new one in every series). */
const earPart = (n: number): IdentifyEx => ({
  kind: "identify",
  id: `seventh-${n}`,
  version: 1,
  role: "check",
  prompt: `Chord ${n}: pick major seventh if it rests, dominant seventh if it leans on.`,
  skills: [{ skill: "E11", w: 1 }],
  hints: ladder(
    "Does this chord sound settled on its own, or does it seem to want another chord after it?",
    "Both kinds have a major triad inside. Listen to the top note: a half step under the octave it rests; a whole step under, it leans.",
    "Sing the lowest note an octave up, then slide down to the chord's top note. One key down is a major seventh chord; two keys down is a dominant seventh.",
  ),
  stimulus: { src: "generator", family: "fam.chd.quality-7th", level: 1 },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: { ui: "quality-pad", set: ["maj7", "7"] },
  correct: {},
  tests: [],
});

/** S6: three long notes against the held chord, on syllables with the numbers shown. */
const singPart = (
  id: string,
  prompt: string,
  stimulus: string,
  seventh: "7" | "b7",
  hints: HintLadder,
  key?: { tonic: "C"; mode: "blues" },
): SingEx => ({
  kind: "sing",
  id,
  version: 1,
  role: "practice",
  prompt,
  skills: [
    { skill: "V03", w: 0.6 },
    { skill: "E11", w: 0.4 },
  ],
  hints,
  ...(key ? { key } : {}),
  // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
  fallback: "identify",
  mode: "degree",
  stimulus: { src: "code", code: stimulus, bars: 2, showCode: false },
  cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
  // Held half notes, as the model plays them: do on beat 1, the 7th on beat 3, do again on the next beat 1.
  target: { from: "degrees", degrees: ["1", seventh, "1"], rhythm: "x _ x _", octaves: [1, 0, 1] },
  labels: "syllables",
  tol: TOL,
  showTrace: "live",
  tests: [],
});

export default defineLesson({
  id: "U12.L02",
  version: 3,
  title: "Dominant vs Major 7",
  objective:
    "I can hear a major seventh chord from a dominant seventh on the same root: one half step apart, one rests and the other leans.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["E11"],
  practises: [],
  terms: [],
  canDo: ["cd.hear.sevenths"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Rest, then lean",
      minutes: 0.75,
      // Note names on the roll: the captions name the note that moves in each chord.
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "rest-then-lean",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops: the same two roots, C and F, as two kinds of seventh chord. Listen for whether each chord is content to stay or wants to move on. Which loop could sit there all night?",
        skills: [{ skill: "E11", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: REST, caption: "Loop 1: Cmaj7 and Fmaj7, the kind from your soul loop.", bars: 4 },
          {
            code: LEAN,
            caption: "Loop 2: C7 and F7, the kind from your blues.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which note moves",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "which-note-moves",
        version: 1,
        role: "practice",
        prompt:
          'Predict which one of the four notes changes from Cmaj7 to C7, then run it. `chord("<C^7 C7>")` plays Cmaj7 for one bar, then C7 for one bar; three notes stay where they are.',
        skills: [{ skill: "C07", w: 1 }],
        hints: null,
        tests: [],
        code: CMAJ7_THEN_C7,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "seventh", label: "The 7th: B drops a half step to B♭" },
          { id: "third", label: "The 3rd: E drops a half step to E♭" },
          { id: "root", label: "The root: C itself moves" },
        ],
        correct: ["seventh"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "A half step apart",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      example: { id: "half-step", code: STACKS, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "a-half-step-apart",
        version: 1,
        role: "practice",
        prompt:
          "Run the code. Watch the top note of bars 1 and 2 on the roll, and listen for the bar that wants to move on. Then answer both questions: which bar leans into the next, and how many half steps lie between B and B♭.",
        skills: [
          { skill: "E11", w: 0.6 },
          { skill: "C07", w: 0.4 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play it again and stop after bar 2: that chord does not sit still. On the roll its top note is one key below bar 1's.",
        },
        hints: ladder(
          "In this loop, three of the four bars sit still where they are. Which one wants to move on?",
          "Bars 1 and 2 share C, E and G. Only the top note differs: B in bar 1, B♭ in bar 2, and bar 2 is the chord of the blues.",
          "B down to B♭ is the smallest move on the keyboard. The chord with B♭ in it is the one that pulls toward F.",
        ),
        code: { starter: STACKS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which bar leans into the bar after it?",
            options: [
              { id: "bar-1", label: "Bar 1: Cmaj7" },
              { id: "bar-2", label: "Bar 2: C7, into Fmaj7" },
              { id: "bar-3", label: "Bar 3: Fmaj7" },
            ],
            correct: ["bar-2"],
          },
          { q: "number", prompt: "How many half steps apart are the two 7ths, B and B♭?", correct: 1 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bar-2"], number: 1 } }, expect: "pass" },
          {
            name: "bar 1: the major seventh chord rests",
            response: { answer: { choice: ["bar-1"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two half steps: that is B♭ up to the next C",
            response: { answer: { choice: ["bar-2"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "One note from outside",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "error-hunt",
        id: "one-note-from-outside",
        version: 1,
        role: "check",
        prompt:
          "Find the one chord in `changes` that holds a note from outside C major: on the roll, its label carries a ♯. Rename that chord so all four of its notes belong to C major. Leave the other three chords as they are.",
        skills: [
          { skill: "C07", w: 0.6 },
          { skill: "C06", w: 0.4 },
        ],
        code: { starter: HUNT_STARTER },
        reference: { solutions: [HUNT_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        // The fix is the click: the changed token locates the bug (grade/index.ts, `gradeErrorHunt`).
        locateVia: "roll",
        feedbackText: {
          "hunt.not-here":
            "That chord belonged to the key as it was. Look for the bar whose roll has a label with a ♯ in it.",
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Every note of the target belongs to C major.",
        },
        srs: [
          { deck: "deck.chd.symbols", cards: ["fact.chord.Cmaj7", "fact.chord.C7"], mode: "review-if-due" },
        ],
        hints: ladder(
          "Three bars sound like the loop you know. One has a note that glares. Which bar is it?",
          "Bar 4 is `G^7`: G, B, D and F♯. C major has F, not F♯.",
          "A major seventh chord on G needs F♯. The seventh chord whose 7th sits a whole step under the octave is the other kind, the one from the blues.",
        ),
        tests: [
          { name: "reference", response: { code: HUNT_SOLUTION }, expect: "pass" },
          {
            name: "the fix in brackets",
            response: { code: loop("<C^7 Am7 Dm7 [G7]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: HUNT_STARTER },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "Gm7: the F is right, but B became B♭",
            response: { code: loop("<C^7 Am7 Dm7 Gm7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the wrong bar: Dm7 made D7, G^7 left alone",
            response: { code: loop("<C^7 Am7 D7 G^7>") },
            expect: "fail",
            feedback: ["hunt.not-here"],
          },
          {
            // A lowercase root is silent in Strudel: the lint names it before anything plays.
            name: "the right chord with a lowercase root: g7",
            response: { code: loop("<C^7 Am7 Dm7 g7>") },
            expect: "fail",
            feedback: ["code.lowercase-chord-root"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Rest or lean",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "rest-or-lean",
        version: 1,
        role: "check",
        prompt:
          "Name the kind of each of six seventh chords, played one at a time on changing roots. Each is a major triad with a 7th on top. Pick major seventh when the chord rests, dominant seventh when it leans on toward another chord.",
        skills: [{ skill: "E11", w: 1 }],
        hints: ladder(
          "Does this chord sound settled on its own, or does it seem to want another chord after it?",
          "Both kinds have a major triad inside. Listen to the top note: a half step under the octave it rests; a whole step under, it leans.",
          "Sing the lowest note an octave up, then slide down to the chord's top note. One key down is a major seventh chord; two keys down is a dominant seventh.",
        ),
        srs: [{ family: "fam.chd.quality-7th", mode: "seed" }],
        tests: [],
        parts: [1, 2, 3, 4, 5, 6].map(earPart),
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Ti, then te",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "ti-then-te",
        version: 1,
        role: "practice",
        prompt:
          "Sing two short lines against a held C, three notes each, in your own range. First do, ti, do (1, 7, 1): ti is a half step under do. Then do, te, do (1, ♭7, 1): te, the ♭7 you sang in the blues, is a whole step under.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "E11", w: 0.4 },
        ],
        hints: [
          { text: "Hum do first, the note the chord is named after, and keep it in your ear." },
          {
            text: "Ti is the closest note under do. Te is one key further down, and it does not want to climb back.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        fallback: "identify",
        tests: [],
        parts: [
          singPart(
            "do-ti-do",
            "Hear it, then sing it over Cmaj7: do, ti, do. In numbers: 1, 7, 1.",
            SING_TI,
            "7",
            [
              { text: "Hum do first and keep it in your ear: the line leaves it and comes straight back." },
              {
                text: "Ti is the smallest step there is below do: a half step down, then the same half step up.",
              },
              { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
              "auto",
            ],
          ),
          singPart(
            "do-te-do",
            "Now over C7: do, te, do. In numbers: 1, ♭7, 1. Te is the blues scale's own 7th.",
            SING_TE,
            "b7",
            [
              { text: "Think of the top of a blues riff: the note just under home." },
              { text: "Te is a whole step below do, two keys down. Aim a little lower than ti was." },
              { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
              "auto",
            ],
            { tonic: "C", mode: "blues" },
          ),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Rest and lean",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "rest-and-lean",
        version: 1,
        role: "practice",
        prompt:
          "Colour the four triads in `changes`: make at least one a major seventh (`^7`) where the music should rest, and at least one a dominant seventh (`7` straight after the letter) where it should lean on. C7 in bar 2 tips into F; G7 in bar 4 leans home. Then let the tune hold a 7th over a leaning chord.",
        skills: [
          { skill: "C07", w: 0.6 },
          { skill: "E11", w: 0.4 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "rest-and-lean",
            label:
              "On the chords line, at least one major seventh chord (`^7`) and at least one dominant seventh chord (`7`)",
            required: true,
            // Choosing where the music rests and where it leans is the lesson's ear skill put to use.
            skills: ["E11", "C07"],
            rule: "chord-qualities",
            track: "chords",
            contains: ["maj7", "7"],
            depth: "seventh",
          },
          {
            // `contains-rn` reads the triad core, so `V7` would be met by the starter's plain G before C. The
            // applied numeral is not: a plain C before F is I, and only C7 counts as the V7 of IV.
            id: "c7-into-f",
            label: "A C7 with an F chord right after it",
            required: false,
            skills: ["C06"],
            rule: "contains-rn",
            rn: ["V7/IV"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "bass-on-roots",
            label:
              "The bass plays the chord's root where the chord changes, at three changes in four or more",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: {
          "rubric.unmet": "{label}: not yet. Change the code until this line of the checklist holds.",
        },
        hints: ladder(
          "Decide which bars should rest and which should lean on: each takes its own kind of seventh chord. Which bar comes right before the loop goes home to C?",
          "All four chords are in `changes`. A major seventh chord is the letter with `^7`; a dominant seventh is the letter with a 7 and nothing between them.",
          'Write `"<C^7 C7 F G>"`: bar 1 rests and bar 2 tips into F. Now decide what F and G should do.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: Cmaj7 rests in bar 1, G7 leans home",
            response: { code: MAKE_ONE_EACH },
            expect: "pass",
          },
          { name: "the old starter's colours, G made G7", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "only the lean: G7, and nothing that rests",
            response: { code: loop("<C C F G7>", TURN_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "both leans, and the tune holds B♭ and F over them",
            response: { code: MAKE_BOTH },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars on the organ, comped, with a tune of its own",
            response: {
              code: code(
                changes("<C^7 C7 F^7 F^7 Dm7 G7 C^7 G7>"),
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("organ").gain(.6)',
                BASS,
                tune(
                  "<[g4 ~ b4 ~] [g4 ~ bb4 ~] [a4 ~ c5 a4] [e4 ~ ~ ~] [f4 ~ a4 ~] [f4 ~ d4 ~] [e4 ~ g4 b4] [d4 ~ f4 ~]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "every chord a dominant seventh: nothing rests",
            response: { code: loop("<C7 C7 F7 G7>", TURN_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "G made a major seventh chord: no dominant seventh anywhere",
            response: { code: loop("<C^7 C^7 F^7 G^7>", TURN_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
