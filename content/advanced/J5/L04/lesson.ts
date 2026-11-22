// J5.L04 Reharm Techniques (spec: content/specs/J5.md). A melody stays; the chords under it move. Every device of
// J5 fits under a tune as long as the tune's long notes agree with the new chord: a passing diminished chord on the
// last beat of bar 1, D♭7 for the second half of a G7 bar, a ii–V aimed at the next chord, a backdoor under a long
// home note. Aura Lee's verse, the folk song of X1 and U16.L05, becomes a late-night tenor ballad without one note of
// its tune changing. The only new chord is the passing diminished chord, named once (S2) and written once (S4); the
// rest are J5.L01–L03's, chosen by the learner in the Make.
//
// Written for the learner at the gate (AUTHORING §20.1): J5 opens after U17.CP and J4.L04, so the whole core
// (reharmonization with borrowed chords and secondary dominants, U16.L05; the tenor) and J1–J4 are behind the
// learner, and J5.L01–L03 brought the tritone substitute, the backdoor and the secondary ii–V. The lesson unlocks
// no tool. The tune sits on the tenor an octave above U16.L05's setting (G4 to D5), and the Rhodes is anchored
// under it (`.anchor("g4")`, U05.L08), so the tune is the top line and no chord crosses it (evaluated).
//
// The corrections-pass standard (AUTHORING §20.2), on every graded step:
// - what is HEARD: S4 compares the chords that sound and their lowest note at each onset (`pcset` per onset with
//   the bass), so a diminished chord on C (the bass does not climb) or on the wrong beat fails; the Make's
//   `reharmonize` with `devices` keeps the tune note for note and counts DIFFERENT devices among the chords that
//   sound and differ from the starter's, every chord of a bar read (a muted chords line has none);
// - each graded step pins a wrong answer that uses the right device in the wrong way (C°7 over C, the passing
//   chord on beat 1; in the Make one device twice, a tune bent to fit a new chord, C°7 over C) and three other
//   right answers (D♭°7 for C♯°7, the bar written in four beats, the weights written in eighths; in the Make the
//   backdoor and a ii–V, all four devices, two devices at another tempo).
// Feedback below rung 4 never names the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 72;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];
/** A starter as the learner first sees it: the editable markers stripped. */
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const SWING = ".swingBy(1/3, 4)";
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const C = { tonic: "C", mode: "major" } as const;

/** The trio of J1: the ride pattern and the hi-hat on 2 and 4 on the jazz kit. */
const RIDE = `drums: s("rd [rd rd] rd [rd rd]")${SWING}.bank("jazzkit")`;
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/**
 * A ballad: each chord held on the Rhodes in the left hand's voicings, anchored at G4 so every voicing sits under
 * the tune (evaluated: the highest chord note in the verse is G4, the tune's lowest note).
 */
const COMP = 'chords: chord(changes).dict("lefthand").anchor("g4").voicing().s("rhodes").gain(.6)';
/** The upright on each chord's root, from the same string. */
const ROOTS = 'bass: chord(changes).rootNotes(2).s("upright")';

/**
 * Aura Lee's verse in the plain-rhythm setting of content/repertoire/aura-lee (X1, U16.L05): G C B C | D A D | C B
 * A B | C | G C B C | D D D | C B A B | C, here on `C5:major`, so `-3` is G4. Every bar is a bar of the original;
 * no step of this lesson changes a note of it.
 */
const PHRASE_1 = "[-3 0 -1 0] [1 -2 1@2] [0 -1 -2 -1] 0";
const PHRASE_2 = "[-3 0 -1 0] [1 1 1@2] [0 -1 -2 -1] 0";
const tenor = (pattern: string) => `mel: n("<${pattern}>").scale("C5:major").s("tenor")`;
const TUNE = tenor(`${PHRASE_1} ${PHRASE_2}`);
const ballad = (changes: string, ...lines: string[]) =>
  code(`const changes = "${changes}"`, "", RIDE, HATS, COMP, ROOTS, ...lines);

/**
 * The verse over sevenths, I, V7/V, V7, I twice: U16.L05's setting (its plain chords are C Dm G C; D7 there is
 * the secondary dominant U16.L05 leaned into G), the starter of the Make.
 */
const PLAIN = ballad("<C^7 D7 G7 C^7 C^7 D7 G7 C^7>", TUNE);
/**
 * The hook: C♯°7 on beat 4 of bar 1 climbing into D7, D♭7 for the second half of each G7 bar sliding into C, Am7
 * D7 aimed at G7 in bar 6. Evaluated with the tune: C over C♯°7 is a whole step above its B♭ (an available
 * tension), A and B over D♭7 are its ♭13 and its 7th (C♭), D over Am7 is its 11th and over D7 its root.
 */
const HOOK_CHANGES = "<[C^7@3 C#o7] D7 [G7 Db7] C^7 C^7 [Am7 D7] [G7 Db7] C^7>";
const HOOK = ballad(HOOK_CHANGES, TUNE);

/** S2: bars 1–2 twice, the second time with the passing chord on beat 4. */
const BARS_1_2 = tenor("[-3 0 -1 0] [1 -2 1@2]");
const CARD_STEP = ballad("<C^7 D7>", BARS_1_2);
const CARD_CLIMB = ballad("<[C^7@3 C#o7] D7>", BARS_1_2);

/** S3: bar 3 of the tune twice: D♭7 on beat 1 under the tune's C, then D♭7 from beat 3, after G7. */
const BAR_3 = code('const changes = "<Db7 [G7 Db7]>"', "", COMP, ROOTS, tenor("[0 -1 -2 -1] [0 -1 -2 -1]"));

/** S4: the first phrase over its plain chords; only bar 1's chord is editable. */
const phrase1 = (changes: string, tune = tenor(PHRASE_1)) => ballad(changes, tune);
const PASSING_STARTER = phrase1("<⟪C^7⟫ D7 G7 C^7>");
const PASSING_SOLUTION = phrase1("<[C^7@3 C#o7] D7 G7 C^7>");

/** The Make's one idea: the same tune over at least two different devices, read from the chords that sound. */
const DEVICES = ["tritone sub", "secondary ii–V", "backdoor", "diminished passing"] as const;
const SAME_TUNE: RubricRule = {
  id: "same-tune-two-devices",
  label: "The tenor tune is unchanged, over at least two different devices",
  required: true,
  skills: ["J14"],
  rule: "reharmonize",
  melody: "mel",
  reference: { solutions: [PLAIN], bars: 8 },
  devices: [...DEVICES],
  min: 2,
};
/** The backdoor fits under bar 4's long C (its 5th over Fm7, its 9th over B♭7), going home to bar 5. */
const BACKDOOR_AND_II_V = ballad("<C^7 D7 G7 [Fm7 Bb7] C^7 [Am7 D7] G7 C^7>", TUNE);

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J5.L04",
  version: 3,
  title: "Reharm Techniques",
  objective: "I can reharmonize a tune with several jazz devices and keep its melody note for note.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["J14"],
  terms: [{ id: "term.passing-diminished", step: "S2" }],
  canDo: ["cd.write.reharm-devices"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One tune, two settings",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "one-tune-two-settings",
        version: 1,
        role: "practice",
        prompt:
          "Follow the tenor, then listen under it. Notice which bars of the second take sound most changed, though the tune is the same.",
        skills: [{ skill: "J14", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: PLAIN,
            caption: "The verse over the chords you gave it when you first reharmonized it, now as sevenths.",
            bars: 8,
          },
          {
            code: HOOK,
            caption: "New chords in bars 1, 3, 6 and 7. The tune is the same, note for note.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "compare",
      title: "A climbing bass",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "a-climbing-bass",
        version: 1,
        role: "practice",
        prompt:
          "The first two bars of the verse, twice. In one card the last beat of bar 1 holds a short chord of its own. Pick the card whose bass climbs into bar 2 by half steps.",
        skills: [{ skill: "J14", w: 1 }],
        hints: ladder(
          "Listen to the bass only, and count its notes before bar 2.",
          "In one card the bass jumps from C straight up to D. In the other it stops on a note between them.",
          "The note between C and D is a half step from each. Which card plays three bass notes?",
        ),
        stimulus: { src: "code", code: CARD_CLIMB, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "step", label: "Card A", audio: CARD_STEP },
            { id: "climb", label: "Card B", audio: CARD_CLIMB },
          ],
        },
        correct: { choice: ["climb"] },
        feedbackText: {
          "id.wrong":
            "In card A the bass plays two notes, C for all of bar 1 and then D. Listen to card B's last beat of bar 1: the bass moves before the bar does.",
        },
        tests: [
          { name: "the climb", response: { answer: { choice: ["climb"] } }, expect: "pass" },
          {
            name: "the plain bars",
            response: { answer: { choice: ["step"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where the substitute fits",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", band: false, initialPanels: ["chords"] },
      example: { id: "bar-three", code: BAR_3, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-substitute-fits",
        version: 1,
        role: "practice",
        prompt:
          "Bar 3 of the tune, C B A B, twice. First D♭7 holds the whole bar; then G7 holds beats 1 and 2 and D♭7 comes in on beat 3. Listen to beat 1 of each bar, then answer: how many half steps D♭7's 7th is from the tune's C, and why the second bar sounds smooth.",
        skills: [{ skill: "J14", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Find D♭7's 7th on the roll (a note you also call B) and count the half steps to the tune's C. Then compare which tune notes sound over D♭7 in the second bar.",
        },
        hints: ladder(
          "Listen to beat 1 of each bar: one sounds rough.",
          "D♭7 is D♭, F, A♭ and C♭. C♭ is the same key as B. How far is that from the tune's C?",
          "In the second bar D♭7 waits for beat 3. Read the tune's notes on beats 3 and 4 and look for them in D♭7.",
        ),
        code: { starter: BAR_3 },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "D♭7's 7th is C♭. How many half steps is it from the tune's C?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "Why does the second bar sound smooth?",
            options: [
              {
                id: "waits",
                label: "D♭7 comes in after the tune's C has passed; the A and B over it fit the chord",
              },
              { id: "tune", label: "The tune plays C♭ instead of C under D♭7" },
              { id: "quiet", label: "D♭7 plays more quietly the second time" },
            ],
            correct: ["waits"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 1, choice: ["waits"] } }, expect: "pass" },
          {
            name: "a whole step",
            response: { answer: { number: 2, choice: ["waits"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the tune taken to have moved",
            response: { answer: { number: 1, choice: ["tune"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Climb into D7",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "climb-into-d7",
        version: 1,
        role: "check",
        key: C,
        prompt:
          "The verse's first phrase over its sevenths. Put a passing diminished seventh on beat 4 of bar 1, so the bass climbs into D7 by half steps. Keep Cmaj7 for beats 1 to 3. Change only bar 1 of `changes`; the tune stays.",
        skills: [{ skill: "J14", w: 1 }],
        swing: SWUNG,
        code: { starter: PASSING_STARTER },
        reference: { solutions: [PASSING_SOLUTION], bars: 4 },
        // The chords that sound and their lowest note, onset by onset: a diminished seventh on the right root, on
        // the right beat (one string drives the chords and the bass).
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: other notes than the target's. Play the target and follow its bass through bar 1: on which beat does it leave C, and how far does it move?",
        },
        hints: ladder(
          "Follow the target's bass through bar 1: on beat 4 it leaves C for the note a half step above.",
          "On beat 4 the bass is a half step above C, and the chord there is a diminished seventh on that note.",
          "Bar 1 now holds two chords: Cmaj7 for three beats, weighted with `@`, then the new chord for one.",
        ),
        tests: [
          { name: "reference", response: { code: PASSING_SOLUTION }, expect: "pass" },
          {
            name: "spelled from the flat side: Dbo7",
            response: { code: phrase1("<[C^7@3 Dbo7] D7 G7 C^7>") },
            expect: "pass",
          },
          {
            name: "bar 1 written in four beats",
            response: { code: phrase1("<[C^7 C^7 C^7 C#o7] D7 G7 C^7>") },
            expect: "pass",
          },
          {
            name: "the weights in eighths",
            response: { code: phrase1("<[C^7@6 C#o7@2] D7 G7 C^7>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(PASSING_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a diminished chord on C: the bass does not climb",
            response: { code: phrase1("<[C^7@3 Co7] D7 G7 C^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the passing chord on beat 1, under the tune's G",
            response: { code: phrase1("<[C#o7 C^7@3] D7 G7 C^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "a half-diminished chord on C#: the right bass, the wrong chord",
            response: { code: phrase1("<[C^7@3 C#m7b5] D7 G7 C^7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the tune bent to fit: its last C made C#",
            response: {
              code: phrase1("<[C^7@3 C#o7] D7 G7 C^7>", tenor("[-3 0 -1 0#] [1 -2 1@2] [0 -1 -2 -1] 0")),
            },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Find the aimed pair",
      minutes: 1,
      graded: true,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "find-the-aimed-pair",
        version: 1,
        role: "check",
        key: C,
        prompt:
          "The new setting of the verse once more, with nothing on screen. Pick the bar where a secondary ii–V aims at G7.",
        skills: [{ skill: "J14", w: 1 }],
        hints: [
          {
            text: "A secondary ii–V is two chords in one bar. Start by finding the bars that hold two chords.",
          },
          {
            text: "Hum the bass. Under a ii–V the roots move by a 5th inside the bar, and by a 5th again into the next bar.",
          },
          {
            text: "Hear it again, slower. In bars 3 and 7 the bass falls a tritone and then slides a half step; in bar 1 it climbs. Which bar is left?",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "code", code: HOOK, bars: 8, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "bar-buttons", bars: 8 },
        correct: { number: 6 },
        feedbackText: {
          "id.wrong":
            "Bar {got} holds another device. Listen for the bar whose roots move by a 5th inside it, and by a 5th again into the next bar.",
        },
        srs: [{ family: "fam.jzz.subs", mode: "review-if-due" }],
        tests: [
          { name: "bar 6", response: { answer: { number: 6 } }, expect: "pass" },
          {
            name: "bar 7: the tritone substitute",
            response: { answer: { number: 7 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "bar 1: the passing chord",
            response: { answer: { number: 1 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your jazz ballad",
      minutes: 3,
      ui: { panels: ROLL, rollLabels: "none", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-jazz-ballad",
        version: 1,
        role: "practice",
        key: C,
        title: "Aura Lee, reharmonized",
        prompt:
          "Reharmonize the verse, now over Cmaj7, D7, G7, Cmaj7. Required: at least two different devices from these four: a tritone substitute, a backdoor, a secondary ii–V, a passing diminished chord, with the tune unchanged. Also on the checklist: three devices, and tune notes that fit the new chords.",
        skills: [{ skill: "J14", w: 1 }],
        swing: SWUNG,
        code: { starter: PLAIN },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          SAME_TUNE,
          {
            id: "three-devices",
            label: "At least three different devices",
            required: false,
            skills: ["J14"],
            rule: "reharmonize",
            melody: "mel",
            reference: { solutions: [PLAIN], bars: 8 },
            devices: [...DEVICES],
            min: 3,
          },
          {
            id: "tune-fits",
            label: "The tune's long or on-beat notes fit the new chords",
            required: false,
            skills: ["J14"],
            rule: "custom",
            fn: "allowed-tensions",
            params: { melody: "mel", harmony: "chords", minRatio: 0.85 },
          },
        ],
        // The override serves every rule, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Find the bars where the tenor holds one long note: a new chord has room there.",
          "A passing diminished chord goes between two chords a whole step apart; a tritone substitute takes the place of a V7; a ii–V aims at the chord after it; a backdoor fits a bar where the tune holds the home note, right before home.",
          "Bar 1 can climb as in the modify step. Then look at bar 6: the D7 there can get its own ii in front of it, two chords in one bar.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: PLAIN },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the climb in bar 1 and a tritone substitute in bar 7",
            response: { code: ballad("<[C^7@3 C#o7] D7 G7 C^7 C^7 D7 [G7 Db7] C^7>", TUNE) },
            expect: "pass",
          },
          { name: "the hook: three devices", response: { code: HOOK }, expect: "pass" },
          {
            name: "the backdoor under bar 4's long C and a ii–V aimed at G7",
            response: { code: BACKDOOR_AND_II_V },
            expect: "pass",
          },
          {
            name: "beyond the brief: all four devices, slower",
            response: {
              code: ballad("<[C^7@3 C#o7] D7 [G7 Db7] [Fm7 Bb7] C^7 [Am7 D7] [G7 Db7] C^7>", TUNE).replace(
                `setcpm(${BPM}/4)`,
                "setcpm(64/4)",
              ),
            },
            expect: "pass",
          },
          {
            name: "one device twice: two tritone substitutes and nothing else",
            response: { code: ballad("<C^7 D7 [G7 Db7] C^7 C^7 D7 [G7 Db7] C^7>", TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a diminished chord on C, which does not pass anywhere, beside one tritone substitute",
            response: { code: ballad("<[C^7@3 Co7] D7 [G7 Db7] C^7 C^7 D7 G7 C^7>", TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the tune bent to fit: bar 3 starts on C♭ under D♭7",
            response: {
              code: ballad(
                "<[C^7@3 C#o7] D7 Db7 C^7 C^7 [Am7 D7] [G7 Db7] C^7>",
                tenor(`${PHRASE_1.replace("[0 -1 -2 -1]", "[-1 -1 -2 -1]")} ${PHRASE_2}`),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the devices written, the chords line silent: .gain(0)",
            response: { code: HOOK.replace('.s("rhodes").gain(.6)', '.s("rhodes").gain(0)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
