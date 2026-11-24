// U12.L03 Half-Diminished & Diminished 7. Two more sevenths, both on the diminished triad (U05.L03). With a
// ♭7 on top it is half-diminished: Bm7♭5 is B D F A, in code `Bm7b5`. Lower that 7th one more half step and
// it is the diminished seventh: B°7 is B D F A♭, in code `Bo7`, four notes each three half steps apart. Both
// are restless chords that lead somewhere: Bm7♭5 into E7 into Am, B°7 up a half step into C. What the
// learner has: major, minor and dominant sevenths by name (U11.L04, U12.L01) and by ear (U12.L02), the minor
// key's major V (E in A minor, U10.L06), harmonic minor. Not yet: which degree gets which seventh (U12.L04),
// the diminished seventh as a chord that leads into any chord of the key (U15.L04: it is heard in the hook
// and left unexplained). Spec: content/specs/U12.md.
//
// How it is graded (AUTHORING §17, §19): the keyboard compares pitch classes and the lowest note; a chord by
// name is its pitch classes and its lowest note per onset (`pcset`, `bass: true`), so `Bo7` for `Bm7b5` fails
// on one note; quality by ear is a `quality-pad`. The ear step opens with three fixed chords (the new pair
// on one root, then the new chord on another) and ends with two trials of `fam.chd.quality-7th` at level 3:
// the generator alone would leave one learner in four without a single half-diminished chord. The Make's one
// required rule is `chord-qualities` at seventh depth with `anyOf: ["m7b5", "dim7"]`. The suggestion "the dark
// chord leads on" is `contains-rn` on ii° or vii° with `mustResolve`, which both offered answers meet: Bm7♭5
// into E7 and G♯°7 into Am7.
import { defineLesson, type HintLadder, type IdentifyEx } from "@oak/content-kit";

const BPM = 76;
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
/** The tune sits on harmonic minor, so its G♯ fits E7 (U10.L06). `n` counts from 0: step 6 is degree 7. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("A3:harmonic:minor").s("piano")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/** The minor turn's tune: D F D over Bm7♭5, E G♯ E over E7, then C held over Am7. */
const TURN_TUNE = mel("<[3 ~ 5 3] [4 ~ 6 4] [2 ~ ~ ~] ~>");
/** The hook: Bm7♭5, E7, then Am7 for two bars. */
const HOOK = loop("<Bm7b5 E7 Am7 Am7>", TURN_TUNE);
/** A walk-up in C: the bass climbs C, C♯, D, and C♯°7 is the step between C and Dm7. */
const WALK_UP = loop("<C C#o7 Dm7 G7>");

/** S2: Bm7, then Bm7♭5. */
const BM7_THEN_FLAT_FIVE = code('chords: chord("<Bm7 Bm7b5>").voicing().s("rhodes")');
/** S3: both chords stacked by hand from B, so the roll reads root, 3rd, 5th, 7th bottom to top. */
const TWO_STACKS = code('chords: note("<[b3,d4,f4,a4] [b3,d4,f4,ab4]>").s("rhodes")');

/** S5: the turn with Bm7 (B D F♯ A) where the key gives B D F A; the tune sings F against the chord's F♯. */
const MODIFY_STARTER = loop("<⟪Bm7⟫ E7 Am7 Am7>", TURN_TUNE);
const turn = (first: string, second = "E7") => loop(`<${first} ${second} Am7 Am7>`, TURN_TUNE);
const MODIFY_SOLUTION = turn("Bm7b5");

/** S6: a chord stacked close from its root and comped twice, as the drill plays them. */
const comp = (notes: string) => code(`chords: note("[${notes}]").struct("x ~ x ~").s("rhodes")`);

/**
 * The Make: A minor's own loop, Am7 Fmaj7 Dm7 E7, with a tune of chord notes (E C E | E C A | D F D | E).
 * Bar 3's D F D also belongs to Bm7♭5, so the swap needs no new tune; G♯ (`n` 6) waits for the learner.
 */
// Learner review: without it this Make would be the third Rhodes loop in three U12 lessons, so it is set as a torch song of its
// own: the piano on every beat, the tune on strings. The rules read `chords` and `mel` as before.
const TORCH_CHORDS = 'chords: chord(changes).voicing().struct("x x x x").s("piano").gain(.6)';
const torchMel = (pattern: string) => `mel: n("${pattern}").scale("A3:harmonic:minor").s("strings")`;
const torch = (form: string, pattern: string) => code(changes(form), TORCH_CHORDS, BASS, torchMel(pattern));
const DARK = "<[4 ~ 2 4] [4 ~ 2 0] [3 ~ 5 3] [4 ~ ~ ~]>";
const DARK_TUNE = mel(DARK);
const MAKE_STARTER = torch("<Am7 F^7 Dm7 E7>", DARK);
const MAKE_HALF_DIM = torch("<Am7 F^7 Bm7b5 E7>", DARK);
/** G♯°7 in the last bar: G♯ B D F, and the bass climbs G♯ to A. The tune holds G♯ over it. */
const MAKE_DIM = torch("<Am7 F^7 Dm7 G#o7>", "<[4 ~ 2 4] [4 ~ 2 0] [3 ~ 5 3] [6 ~ ~ ~]>");

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
/** Every code string whose tune has the raised 7 (G♯ over E7) is in harmonic minor, as in U10.L06. */
const HARMONIC = { tonic: "A", mode: "harmonic minor" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

/** The four qualities of `fam.chd.quality-7th` at level 3, in teaching order. */
const PAD: IdentifyEx["answer"] = { ui: "quality-pad", set: ["maj7", "7", "m7", "m7b5"] };
const earHints = (): HintLadder =>
  ladder(
    "Does the chord sit calmly, or is there something hollow and uneasy in the middle of it?",
    "Listen to the three lowest notes first. A major, a minor or a diminished triad? A minor seventh chord has a minor triad there; a half-diminished seventh has the diminished one.",
    "Sing the lowest note, then the third note up. Under a major or a minor triad that leap is a clean 5th. In a half-diminished seventh it is a tritone.",
  );
const earPart = (id: string, prompt: string, notes: string, answer: "m7" | "m7b5"): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  prompt,
  skills: [{ skill: "E11", w: 1 }],
  hints: earHints(),
  stimulus: { src: "code", code: comp(notes), bars: 1, showCode: false },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: PAD,
  correct: { qualities: [answer] },
  feedbackText: {
    "id.quality":
      answer === "m7b5"
        ? "Listen again to the lowest note and the third note up: here they are a tritone apart, a half step less than a clean 5th, and the chord does not sit calmly."
        : "Listen again to the lowest note and the third note up: here they are a clean 5th apart, and the chord sits calmly.",
  },
  tests: [
    { name: answer, response: { answer: { qualities: [answer] } }, expect: "pass" },
    {
      name: answer === "m7b5" ? "heard as a minor seventh" : "heard as half-diminished",
      response: { answer: { qualities: [answer === "m7b5" ? "m7" : "m7b5"] } },
      expect: "fail",
      feedback: ["id.quality"],
    },
  ],
});
/** One trial of the family at level 3: any of the four qualities, on any root. */
const drillPart = (n: number): IdentifyEx => ({
  kind: "identify",
  id: `seventh-${n}`,
  version: 1,
  role: "check",
  prompt: `Chord ${n}: any of the four kinds now.`,
  skills: [{ skill: "E11", w: 1 }],
  hints: earHints(),
  stimulus: { src: "generator", family: "fam.chd.quality-7th", level: 3 },
  cue: { context: "none", countInBars: 0, click: false, replays: -1 },
  answer: PAD,
  correct: {},
  tests: [],
});

export default defineLesson({
  id: "U12.L03",
  version: 4,
  title: "Half-Diminished & Diminished 7",
  objective:
    "I can build, write and hear the two sevenths on the diminished triad: Bm7♭5 (Bm7b5) and B°7 (Bo7), one half step apart.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["C07"],
  terms: [
    { id: "term.half-diminished", step: "S3" },
    { id: "term.diminished-seventh", step: "S3" },
  ],
  canDo: ["cd.write.seventh-family"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The dark turn",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-dark-turn",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "Listen to both loops. Each has one new chord: the first chord of loop 1, the second chord of loop 2. Listen for where each new chord goes: does it settle, or does it pull the music on into the next bar?",
        skills: [{ skill: "C07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Loop 1: a slow turn into A minor. The new chord opens it.", bars: 4 },
          {
            code: WALK_UP,
            caption: "Loop 2: a brighter loop in C. The new chord is bar 2; follow the bass under it.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "What b5 lowers",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "what-b5-lowers",
        version: 1,
        role: "practice",
        prompt:
          'Predict which note of Bm7 the `b5` lowers by a half step, then run it. `chord("<Bm7 Bm7b5>")` plays Bm7 for one bar, then the first chord of the turn you just heard.',
        skills: [{ skill: "C07", w: 1 }],
        hints: null,
        tests: [],
        code: BM7_THEN_FLAT_FIVE,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "fifth", label: "The 5th: F♯ drops to F" },
          { id: "seventh", label: "The 7th: A drops to A♭" },
          { id: "third", label: "The 3rd: D drops to D♭" },
        ],
        correct: ["fifth"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "One more half step",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "two-stacks", code: TWO_STACKS, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "one-more-half-step",
        version: 1,
        role: "practice",
        prompt:
          "Run the code and read the note names on the roll, bottom to top. Both bars start on B, D and F, the diminished triad. Then answer both questions: which bar is Bm7 with only its 5th lowered, and how many half steps lie between neighbouring notes in bar 2.",
        skills: [{ skill: "C07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Bm7 is B D F♯ A, so the bar that keeps its top note, A, is the one with only the 5th lowered. For the count, go from B up to D one key at a time; the other gaps in bar 2 are the same size.",
        },
        hints: ladder(
          "Both bars start B, D, F. What is the fourth note of each?",
          "Bar 1 ends on A, the note Bm7 already had. Bar 2 lowers it once more, to A♭. Then count the keys between neighbouring notes in bar 2.",
          "B up to D: B, C, C♯, D. Count the moves, then check D up to F and F up to A♭.",
        ),
        code: { starter: TWO_STACKS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Bm7 is B D F♯ A. Which bar is Bm7 with only its 5th lowered?",
            options: [
              { id: "bar-1", label: "Bar 1: B D F A" },
              { id: "bar-2", label: "Bar 2: B D F A♭" },
              { id: "neither", label: "Neither: both lower two notes" },
            ],
            correct: ["bar-1"],
          },
          {
            q: "number",
            prompt: "In bar 2, how many half steps from each note up to the next?",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bar-1"], number: 3 } }, expect: "pass" },
          {
            name: "the two stacks swapped",
            response: { answer: { choice: ["bar-2"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "four half steps: a major 3rd, not a minor one",
            response: { answer: { choice: ["bar-1"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Build Bm7♭5",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "build-bm7-flat-5",
        version: 1,
        role: "check",
        prompt:
          "Play Bm7♭5 on the keyboard: the diminished triad on B, plus the note a whole step below the next B. Done when those four notes sound together with B as the lowest.",
        skills: [{ skill: "C07", w: 1 }],
        hints: ladder(
          "Start with the diminished triad on B. Which three notes is it?",
          "B, D and F: each three half steps above the last. The fourth note sits a whole step below the B an octave up.",
          "B, D, F, then one more key above F. Every key of this chord is white.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [11, 2, 5, 9], bassPc: 11 },
        pitchMode: "octave-free",
        // F♯ for F is Bm7 and A♭ for A is B°7: the catalog would say "F♯ doesn't belong" and "F is missing";
        // these name what the chord lowers and what it leaves alone, which serves both slips.
        feedbackText: {
          "kb.extra-note":
            "{got} doesn't belong. Bm7♭5 lowers the 5th of Bm7 and stops there: its 7th stays a whole step under the next B.",
          "kb.missing-note": "{exp} is missing. This chord is the diminished triad B D F plus the ♭7.",
        },
        tests: [
          { name: "B D F A", response: { answer: { midi: [59, 62, 65, 69] } }, expect: "pass" },
          {
            name: "with B doubled on top",
            response: { answer: { midi: [59, 62, 65, 69, 71] } },
            expect: "pass",
          },
          {
            name: "F♯ for F: Bm7",
            response: { answer: { midi: [59, 62, 66, 69] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "A♭ for A: the diminished seventh",
            response: { answer: { midi: [59, 62, 65, 68] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "B D F: the triad, no 7th",
            response: { answer: { midi: [59, 62, 65] } },
            expect: "fail",
            feedback: ["kb.missing-note"],
          },
          {
            name: "D at the bottom",
            response: { answer: { midi: [62, 65, 69, 71] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "The key's own chord",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "the-keys-own-chord",
        version: 1,
        role: "check",
        key: HARMONIC,
        prompt:
          "Change the first chord in `changes`, Bm7, into the seventh chord A minor builds on B: the same chord with its 5th, F♯, lowered to F, the note the tune sings over it. Leave the other chords as they are.",
        skills: [{ skill: "C07", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        // The catalog's "Write …" has no spelling to offer for `Bm7-5` (it repeats the symbol), so the lesson
        // names the two spellings it teaches. `harmony.pcset` drops `{got}`: for `Bo7` it would read D F A♭ C♭.
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: the target has {exp}. Bar 1 wants Bm7 with only its 5th lowered, F♯ to F; the other chords stay as they are.",
          "code.unknown-chord":
            '"{sym}" is not a chord name Strudel reads. A half-diminished seventh is the root, then `m7b5`; a diminished seventh is the root, then `o7`.',
        },
        srs: [{ deck: "deck.chd.symbols", cards: ["fact.chord.Cm7b5", "fact.chord.Cdim7"], mode: "seed" }],
        hints: ladder(
          "Bar 1 must use only notes of A minor. Bm7 is B D F♯ A: which of its notes is outside the key, and which member of the chord is it?",
          "F♯ is the 5th of Bm7. The symbol that lowers it adds two characters after `m7`: a flat as Strudel writes it, then the number of that chord member.",
          "In code a flat is the letter `b`, written before the number of the note it lowers. Keep `Bm7` as it is and add to its end.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "the bar in brackets", response: { code: turn("[Bm7b5]") }, expect: "pass" },
          {
            name: "unchanged: Bm7 left in place",
            response: { code: turn("Bm7") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "Bo7: the 7th lowered as well",
            response: { code: turn("Bo7") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Bo: the diminished triad, no 7th",
            response: { code: turn("Bo") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            // `Bdim7` is how the other chord is often printed, not how Strudel reads it: the lint names the spelling.
            name: "Bdim7 written as on paper",
            response: { code: turn("Bdim7") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
          {
            name: "Bm7-5: another way the chord is printed",
            response: { code: turn("Bm7-5") },
            expect: "fail",
            feedback: ["code.unknown-chord"],
          },
          {
            name: "E7 changed as well",
            response: { code: turn("Bm7b5", "E") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Calm or hollow",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "calm-or-hollow",
        version: 1,
        role: "check",
        prompt:
          "Name the kind of each of five seventh chords, played one at a time. The pad now has four kinds: major seventh, minor seventh, dominant seventh and half-diminished seventh. Listen to the triad inside first.",
        skills: [{ skill: "E11", w: 1 }],
        hints: earHints(),
        srs: [{ family: "fam.chd.quality-7th", mode: "review-if-due" }],
        tests: [],
        parts: [
          earPart("chord-on-e", "Chord 1, on E.", "e3,g3,b3,d4", "m7"),
          earPart("chord-on-e-again", "Chord 2, on E again. One note has moved.", "e3,g3,bb3,d4", "m7b5"),
          earPart("chord-on-f-sharp", "Chord 3, on F♯.", "f#3,a3,c4,e4", "m7b5"),
          drillPart(4),
          drillPart(5),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your dark turn",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-dark-turn",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "Darken the torch song that ends your song's bridge with one of today's chords in `changes`: put `Bm7b5` in place of Dm7, where it leads into E7, or `G#o7` in place of E7 in the last bar, where it pulls up a half step into Am7. Then shape the tune around the new chord's notes.",
        skills: [{ skill: "C07", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "one-dark-seventh",
            label:
              "On the chords line, at least one half-diminished seventh (`m7b5`) or diminished seventh (`o7`)",
            required: true,
            skills: ["C07"],
            rule: "chord-qualities",
            track: "chords",
            anyOf: ["m7b5", "dim7"],
            min: 1,
            depth: "seventh",
          },
          {
            id: "the-ache-leads-on",
            label:
              "The dark chord goes straight on to its target: Bm7♭5 into E7, or G♯°7 up a half step into Am7",
            required: false,
            skills: ["C07"],
            rule: "contains-rn",
            rn: ["ii°", "vii°"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "raised-seven-in-the-tune",
            label: "G♯, the raised 7, at least once on the `mel` line",
            required: false,
            skills: ["S07"],
            rule: "degree-set",
            track: "mel",
            contains: ["7"],
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
          "Pick one place for the dark chord in `changes`: the third bar, just before E7, or the last bar, on the way home to Am7. Which do you want?",
          "All four chords live in `changes`. The half-diminished seventh on B can stand where Dm7 is: they share D, F and A. The diminished seventh on G♯ can take the last bar.",
          "Swap the third symbol for the first chord of today's hook and listen to what the bass does under it. For the other chord, `o7` goes straight after the root's name.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: Bm7♭5 in place of Dm7", response: { code: MAKE_HALF_DIM }, expect: "pass" },
          {
            name: "the other one: G♯°7 in the last bar, G♯ in the tune",
            response: { code: MAKE_DIM },
            expect: "pass",
          },
          {
            name: "beyond the brief: eight bars with both chords, comped on the organ, a tune of its own",
            response: {
              code: code(
                changes("<Am7 F^7 Bm7b5 E7 Am7 Dm7 G#o7 Am7>"),
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("organ").gain(.6)',
                BASS,
                mel("<[4 ~ 7 ~] [7 ~ 4 2] [3 ~ 5 ~] [6 ~ 4 ~] [7 ~ 4 2] [3 ~ 5 7] [8 ~ 6 ~] [7 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "Bo: the diminished triad without a 7th",
            response: { code: loop("<Am7 F^7 Bo E7>", DARK_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "E7 swapped for Em7: darker, but neither of today's chords",
            response: { code: loop("<Am7 F^7 Dm7 Em7>", DARK_TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
