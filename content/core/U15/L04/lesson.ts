// U15.L04 Tonicization. A second chord for the job U15.L02–L03 gave the V7: the leading-tone chord of a chord,
// the diminished seventh whose root is a half step below that chord's root (in C: C♯°7 into D minor, F♯°7 into
// G, G♯°7 into A minor). It is the V7 of the same chord with its root taken away and the note above the root put
// in its place (A7 = A C♯ E G, C♯°7 = C♯ E G B♭: three notes shared), so it pulls as hard, and the bass climbs
// by a half step instead of falling a 5th. Leading into a chord with its own V7 or its own leading-tone chord,
// so that it sounds like home for a moment, gets its name here: tonicization. What the learner has: the
// diminished seventh by name (`Co7`, U12.L03, whose hook already played C C♯°7 Dm7 G7), the leading tone
// (U03.L04), secondary dominants aimed at V, vi, ii and IV (U15.L02–L03), chords by name with one `const`
// driving chords and bass (U08.L04). Not yet: chains of dominants (U15.L05), finding applied chords by ear in a
// drill (`fam.har.chromatic`, U15.L06), diminished chords that pass downward (J5.L03). Spec: content/specs/U15.md.
//
// How it is graded (AUTHORING §17, §19.6): building the chord is the keyboard (`expect: { pcs, bassPc }`); a
// named chord in code is its pitch classes and lowest note per onset (`pcset`, `bass: true`), so `F#o` (no 7th)
// or `F#m7b5` (E, not E♭) fails on a note and `Gbo7` (the same four keys) passes; "V7 or leading-tone chord"
// by ear is a choice per loop, with the bass as the clue. The Make's one required rule is `contains-rn` with
// the leading-tone numerals and `mustResolve`: it reads the triad core, so a diminished seventh counts only
// where the next chord stands a half step above its root, and the key's own B° before C never counts.
import { defineLesson, type HintLadder, type IdentifyEx, type KeySpec } from "@oak/content-kit";

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

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
const ORGAN = 'chords: chord(changes).voicing().s("organ").gain(.7)';
/** The root of every chord, low on the upright: the default voicing does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const loop = (form: string, ...lines: string[]) => code(changes(form), ORGAN, BASS, ...lines);

/**
 * The hook: a gospel walk-up. The bass climbs C C♯ D, then F♯ G G♯ A; over each note between the key's own a
 * diminished seventh squeezes into the chord a half step above it. The voicings: C♯°7 = D♭3 B♭3 E4 G4 B♭4,
 * F♯°7 = F♯3 E♭4 F♯4 A4 C5, G♯°7 = D3 B3 F4 A♭4 B4 (Strudel spells the sharps as flats; display re-spells).
 */
const WALK_UP = "<C C#o7 Dm7 F#o7 G7 G#o7 Am7 G7>";
const HOOK = loop(WALK_UP);
/** S1, first item: U15.L03's visitor, A7 into D minor. The bass falls a 5th, A to D. */
const VISITOR = loop("<C A7 Dm7 G7>");

/** S2: A7 from the root, then the same three upper notes with B♭ on top in place of the root. */
const A7_THEN_DIM = code('chords: note("<[a2,c#3,e3,g3] [c#3,e3,g3,bb3]>").s("organ").gain(.7)');
/** S3: A7, C♯°7 and D minor stacked by hand from the root, so the roll reads them bottom to top. */
const THREE_STACKS = code(
  'chords: note("<[a2,c#3,e3,g3] [c#3,e3,g3,bb3] [d3,f3,a3]>").s("organ").gain(.7)',
  'bass: note("<a1 c#2 d2>").s("upright")',
);

/** S5: the walk-up with its first push given and two bars that wait on the chord before. */
const MODIFY_STARTER = loop("<C C#o7 Dm7 ⟪Dm7⟫ G7 ⟪G7⟫ Am7 G7>");
const MODIFY_SOLUTION = HOOK;

/** S6: a loop heard without its code; bar 2 pushes into bar 3 with a V7 or a leading-tone chord. */
const heard = (form: string) =>
  code(
    changes(form),
    'chords: chord(changes).voicing().struct("x ~ x ~").s("organ").gain(.7)',
    'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")',
  );

/**
 * The Make: a slow turn that waits two bars on C, on Dm7 and on G7. The second bar of each pair is the place
 * for a push into the next bar; the starter has none.
 */
const MAKE_FORM = "<C C Dm7 Dm7 G7 G7 Am7 G7>";
const MAKE_STARTER = loop(MAKE_FORM);
const MAKE_MINIMAL = loop("<C C#o7 Dm7 Dm7 G7 G7 Am7 G7>");

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

const V7 = "v7";
const LT = "leading-tone";
const earHints = (): HintLadder => [
  {
    text: "Both kinds of chord pull into bar 3. Listen below the chords: what does the bass do on the way in?",
  },
  {
    text: "Under a V7 the bass falls a 5th into the next chord. Under a leading-tone chord it climbs the smallest step there is.",
  },
  {
    text: "Hear it again, slower, and hum the bass from bar 2 into bar 3: a leap down, or one half step up?",
    replay: { rate: 0.75 },
  },
  "auto",
];
const earPart = (id: string, prompt: string, form: string, right: string): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  key: C_MAJOR,
  prompt,
  skills: [
    { skill: "H12", w: 0.7 },
    { skill: "E09", w: 0.3 },
  ],
  hints: earHints(),
  stimulus: { src: "code", code: heard(form), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: {
    ui: "choice",
    options: [
      { id: V7, label: "Its own V7: the bass falls a 5th into bar 3" },
      { id: LT, label: "Its own leading-tone chord: the bass climbs a half step" },
    ],
  },
  correct: { choice: [right] },
  feedbackText: {
    "id.wrong":
      "Not this time. Both chords pull into bar 3; the bass tells them apart. Hum it from bar 2 into bar 3: a fall of a 5th is the V7, one half step up is the leading-tone chord.",
  },
  tests: [
    { name: right, response: { answer: { choice: [right] } }, expect: "pass" },
    {
      name: "the other kind of push",
      response: { answer: { choice: [right === V7 ? LT : V7] } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

export default defineLesson({
  id: "U15.L04",
  version: 4,
  title: "Tonicization",
  objective: "I can lead into a chord with its own leading-tone chord, and hear it from the climbing bass.",
  key: C_MAJOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H12"],
  terms: [{ id: "term.tonicization", step: "S3" }],
  canDo: ["cd.write.tonicization"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The bass climbs",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "the-bass-climbs",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two ways into D minor: first last lesson's A7, then an organ walk-up. Keep your ear on the bass. Listen for how it reaches each new chord: by a leap, or a half step at a time.",
        skills: [{ skill: "H12", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: VISITOR,
            caption: "C, A7, Dm7, G7: last lesson's visitor.",
            bars: 4,
          },
          {
            code: HOOK,
            caption: "The walk-up: a new chord squeezes in before Dm7, G7 and Am7.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Take the root away",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "take-the-root-away",
        version: 1,
        role: "practice",
        prompt:
          "A7 is A, C♯, E and G. Take the root away and put B♭ on top: C♯, E, G, B♭. The code plays both, one a bar. Predict what kind of chord the second one is, then pick it.",
        skills: [{ skill: "H12", w: 1 }],
        hints: null,
        tests: [],
        code: A7_THEN_DIM,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "dim7", label: "A diminished seventh: every note three half steps above the one below" },
          { id: "half-dim", label: "A half-diminished seventh: a diminished triad with a ♭7" },
          { id: "minor-7", label: "A minor seventh" },
        ],
        correct: ["dim7"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Nearly the same chord",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", initialPanels: ["chords"] },
      example: { id: "three-stacks", code: THREE_STACKS, bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "nearly-the-same-chord",
        version: 1,
        role: "practice",
        prompt:
          "Run the three chords, A7, C♯°7 and D minor, each stacked from its root, and read the note names on the roll. Answer two questions. First, how many notes do A7 and C♯°7 share? Second, where does C♯, the root of the diminished seventh, sit against D?",
        skills: [{ skill: "H12", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read bars 1 and 2 bottom to top, A C♯ E G and C♯ E G B♭, and tick off the names that appear in both. Then count the half steps from C♯ to D.",
        },
        hints: ladder(
          "First count shared notes, then find a distance. Which note names appear in both bar 1 and bar 2?",
          "A7 is A C♯ E G; C♯°7 is C♯ E G B♭. Only one note of each is missing from the other.",
          "A and B♭ are the odd ones out. For the second question: C♯ and D are neighbours on the keyboard.",
        ),
        code: { starter: THREE_STACKS },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "How many notes do A7 and C♯°7 share?", correct: 3 },
          {
            q: "choice",
            prompt: "Where does C♯, the root of the diminished seventh, sit against D, the root it leads to?",
            options: [
              { id: "half-below", label: "A half step below" },
              { id: "half-above", label: "A half step above" },
              { id: "fifth-above", label: "A 5th above, like the root of A7" },
            ],
            correct: ["half-below"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["half-below"] } }, expect: "pass" },
          {
            name: "two shared notes counted",
            response: { answer: { number: 2, choice: ["half-below"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a half step above",
            response: { answer: { number: 3, choice: ["half-above"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Lead into G",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "lead-into-g",
        version: 1,
        role: "check",
        key: C_MAJOR,
        prompt:
          "Build the leading-tone chord of G on the keyboard: the diminished seventh whose root is a half step below G. Play its four notes with the root lowest.",
        skills: [
          { skill: "H12", w: 0.6 },
          { skill: "C07", w: 0.4 },
        ],
        hints: ladder(
          "Find the root first: it is the note a half step below G. Which note is that?",
          "The root is F♯. A diminished seventh stacks three half steps, three more, and three more above it.",
          "F♯, then A, then C: one more key, three half steps above C.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [6, 9, 0, 3], bassPc: 6 },
        pitchMode: "octave-free",
        // E for E♭ is the half-diminished chord on F♯ (the key's own kind of 7th), G♯°7 leads to A, not G: the
        // catalog would only list notes; these name what the leading-tone chord of G is made of.
        feedbackText: {
          "kb.extra-note":
            "{got} doesn't belong. The leading-tone chord of G stands on F♯, and every note is three half steps above the one below.",
          "kb.missing-note":
            "{exp} is missing. From F♯, stack three half steps three times: the top note is a black key.",
          "kb.bass": "The notes are right; put F♯, the root, lowest. It is the note that climbs into G.",
        },
        tests: [
          { name: "F♯ A C E♭", response: { answer: { midi: [54, 57, 60, 63] } }, expect: "pass" },
          {
            name: "higher, with F♯ doubled on top",
            response: { answer: { midi: [66, 69, 72, 75, 78] } },
            expect: "pass",
          },
          {
            name: "E for E♭: the half-diminished seventh on F♯",
            response: { answer: { midi: [54, 57, 60, 64] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "G♯°7: the leading-tone chord of A, not of G",
            response: { answer: { midi: [56, 59, 62, 65] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "A lowest",
            response: { answer: { midi: [57, 60, 63, 66] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Two more pushes",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "two-more-pushes",
        version: 1,
        role: "check",
        key: C_MAJOR,
        prompt:
          "Bars 4 and 6 only repeat the chord before them. Change each marked chord into the leading-tone chord of the chord in the next bar: the diminished seventh on the note a half step below that chord's root. Bar 2, C♯°7 into Dm7, is the first push, already in place.",
        skills: [{ skill: "H12", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 8 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so a push cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. The leading-tone chord stands a half step below the root of the next bar's chord, and it is a diminished seventh: `o7`.",
          // A diminished seventh has the same four notes on four roots (`Ao7` holds F♯°7's notes): the catalog's
          // "bass is E♭" would name the voicing's lowest note, not the root the upright plays.
          "harmony.bass":
            "Bar {bar}: the right four notes, on the wrong root. A diminished seventh has the same notes on four roots; the leading-tone chord is written on the note a half step below the next bar's root, so the bass climbs into it.",
        },
        srs: [
          { family: "fam.har.rn", mode: "review-if-due" },
          { family: "fam.chd.quality-7th", mode: "review-if-due" },
        ],
        hints: ladder(
          "Each new chord aims at the chord in the bar after it, so start from that chord's root. Which chords come after bars 4 and 6?",
          "Bar 5 is G7 and bar 7 is Am7. Each push is the diminished seventh on the note a half step below that root.",
          "Bar 2 shows the shape: `C#o7`, a half step below D. Bar 4 needs the same chord built a half step below G.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "spelled from the flat side: Gbo7 and Abo7, the same four keys each",
            response: { code: loop("<C C#o7 Dm7 Gbo7 G7 Abo7 Am7 G7>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: loop("<C C#o7 Dm7 Dm7 G7 G7 Am7 G7>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "F#o: the diminished triad, no 7th",
            response: { code: loop("<C C#o7 Dm7 F#o G7 G#o7 Am7 G7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "F#m7b5: the half-diminished seventh, E instead of E♭",
            response: { code: loop("<C C#o7 Dm7 F#m7b5 G7 G#o7 Am7 G7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Fo7: the root not raised",
            response: { code: loop("<C C#o7 Dm7 Fo7 G7 G#o7 Am7 G7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Ao7: F♯°7's four notes on another root, so the bass falls to G",
            response: { code: loop("<C C#o7 Dm7 Ao7 G7 G#o7 Am7 G7>") },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "F#dim7: not a symbol Oak's chords know",
            response: { code: loop("<C C#o7 Dm7 F#dim7 G7 G#o7 Am7 G7>") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
          {
            name: "the given push changed too",
            response: { code: loop("<C Dm7 Dm7 F#o7 G7 G#o7 Am7 G7>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "F♯°7 cut to a click: the right chord, 1% of the bar",
            response: { code: loop("<C C#o7 Dm7 [F#o7@0.01 ~@0.99] G7 G#o7 Am7 G7>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Which push",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "which-push",
        version: 1,
        role: "check",
        prompt:
          "Name the push in three loops in C major, heard and not seen. In each, bar 2 pushes into bar 3 with either bar 3's own V7 or its own leading-tone chord. Listen to the bass from bar 2 into bar 3, then pick which one.",
        skills: [
          { skill: "H12", w: 0.7 },
          { skill: "E09", w: 0.3 },
        ],
        hints: earHints(),
        tests: [],
        parts: [
          earPart("push-1", "Loop 1.", "<C A7 Dm G7>", V7),
          earPart("push-2", "Loop 2.", "<C C#o7 Dm G7>", LT),
          earPart("push-3", "Loop 3.", "<C G#o7 Am G7>", LT),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your own walk-up",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-own-walk-up",
        version: 1,
        role: "practice",
        prompt:
          "In your song's bridge, bars 2, 4 and 6 of `changes` repeat the chord before them. Replace at least one with the leading-tone chord of the next bar's chord. Any other repeat can take one too, or a V7 into the next bar. Done when a diminished seventh moves straight into the chord a half step above its root.",
        skills: [{ skill: "H12", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "leading-tone-chord-lands",
            label:
              "A leading-tone chord (a diminished seventh) at least a beat long, moving straight into the chord whose root is a half step above its own",
            required: true,
            skills: ["H12"],
            rule: "contains-rn",
            rn: ["vii°/ii", "vii°/iii", "vii°/IV", "vii°/V", "vii°/vi"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "a-v7-push-too",
            label:
              "A V7 of ii, V or vi (A7, D7 or E7) as well, at least a beat long, moving straight into its target",
            required: false,
            skills: ["H12"],
            rule: "contains-rn",
            rn: ["V/ii", "V/V", "V/vi"],
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
          {
            id: "line-on-chord-tones",
            label:
              "A tune on top: at least 3 of every 4 of its notes on beats 1 and 3 are notes of the chord",
            required: false,
            skills: ["M01"],
            rule: "chord-tones-strong",
            melody: "@melody",
            harmony: "chords",
            strength: "strong",
            minRatio: 0.75,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Each repeated chord is a wait, with room for a chord that leans into the next bar. Which bars of `changes` repeat the chord before them?",
          "Bars 2, 4 and 6 repeat the chord before them. The chord after bar 2 is Dm7, whose root is D.",
          "A half step below D is C♯. Bar 2 becomes the diminished seventh on C♯, and the bass climbs C, C♯, D.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one leading-tone chord, into Dm7",
            response: { code: MAKE_MINIMAL },
            expect: "pass",
          },
          {
            name: "the push in the last two beats of a bar, as the tip shows",
            response: { code: loop("<C [C C#o7] Dm7 Dm7 G7 G7 Am7 G7>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: three pushes, one of them a V7, and a line on top",
            response: {
              code: loop(
                "<C C#o7 Dm7 D7 G7 G#o7 Am7 G7>",
                'mel: n("<[4 ~ 2 0] [6b ~ 4 2] [3 ~ 1 5] [3# ~ 5 ~] [4 ~ 6 3] [4# ~ 6 ~] [5 ~ 2 0] [1 ~ ~ ~]>").scale("C4:major").s("piano")',
              ),
            },
            expect: "pass",
          },
          {
            name: "a diminished seventh that does not step up into the next chord: C♯°7 before G7",
            response: { code: loop("<C C Dm7 C#o7 G7 G7 Am7 G7>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "C♯°7 that lands on D augmented: the right root, not ii",
            response: { code: loop("<C C#o7 Daug Dm7 G7 G7 Am7 G7>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "G♯°7 into Am7 only, the waits before it left as they were",
            response: { code: loop("<C C Dm7 Dm7 G7 G#o7 Am7 G7>") },
            expect: "pass",
          },
          {
            name: "only V7 pushes, no leading-tone chord",
            response: { code: loop("<C A7 Dm7 D7 G7 E7 Am7 G7>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
