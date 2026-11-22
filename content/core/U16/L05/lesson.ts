// U16.L05 Mixture Lab. A tune does not own its chords: keep every note of a melody, put new chords under it,
// and the song changes mood without changing its tune. That is reharmonization. A new chord works when the
// tune's long notes belong to it; with the secondary dominants of U15 and the borrowed chords of U16 the
// learner has a dozen to choose from, and the ear to tell which kind it hears. The tune is Aura Lee's verse,
// the folk song of X1 and the L5 gym, played as a soul ballad on a tenor sax (which unlocks here). What the
// learner has: secondary dominants and where they lead (U15.L02–L06, `fam.har.chromatic` from U15.L06), the
// four borrowed chords iv, ♭VI, ♭VII, ♭III and the trade in minor (U16.L01–L04), why a chord fits a tune: its
// notes on the strong beats (U07.L03), Aura Lee's plain chords I ii V I (X1). Not yet: a key that moves
// (U17). Spec: content/specs/U16.md.
//
// How it is graded (AUTHORING §17, §19.6): a chord written by name is its pitch classes and its lowest note at
// each onset (`pcset` with `bass: true`), so `[Fm C]` for `[C Fm]` fails on both halves of the bar; the ear set
// is the `fam.har.chromatic` generator at level 3 (iv, ♭VI, ♭VII), so it has no tests in the lesson. The Make's
// one required rule is `reharmonize`: the tune must be the verse's, note for note, and at least two chords
// must be borrowed chords or secondary dominants. The starter (no outside chord) fails, chords from inside
// the key fail, and a version that changes a note of the tune fails whatever its chords.
import { defineLesson, type HintLadder, type KeySpec } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const C: KeySpec = { tonic: "C", mode: "major" };

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
/** A soul ballad: the chord held on the Rhodes, the upright on the root. */
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
/** The tune on tenor sax. `n` counts from 0, so degree 5 is `n` 4, and `-3` is degree 5 below home (G3). */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("tenor")`;
const ballad = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/**
 * Aura Lee's verse in the plain-rhythm setting of content/repertoire/aura-lee (X1, the L5 gym): G C B C |
 * D A D | C B A B | C | G C B C | D D D | C B A B | C. Every bar is a bar of the original; nothing changes in
 * any step of this lesson.
 */
const VERSE = "[-3 0 -1 0] [1 -2 1@2] [0 -1 -2 -1] 0 [-3 0 -1 0] [1 1 1@2] [0 -1 -2 -1] 0";
const TUNE = mel(`<${VERSE}>`);
/** The verse's second phrase, bars 5–8, on its own. */
const PHRASE_2 = mel("<[-3 0 -1 0] [1 1 1@2] [0 -1 -2 -1] 0>");

/** The plain chords of X1's answer key, I ii V I twice. */
const PLAIN = ballad("<C Dm G C C Dm G C>", TUNE);
/**
 * The hook: D7 leaning into G in bars 2 and 6 (the tune's D and A are its root and 5th), and under the long C
 * of bar 4 A♭ then B♭ climbing back to C (C is A♭'s 3rd and B♭'s 9th). Not one note of the tune changes.
 */
const HOOK = ballad("<C D7 G7 [Ab Bb] C D7 G7 C>", TUNE);

/** S2: the three Ds of bar 6 over each borrowed chord in turn. */
const THREE_UNDER_D = code(
  changes("<Bb Ab Fm>"),
  CHORDS,
  BASS,
  'mel: n("[1 1 1@2]").scale("C4:major").s("tenor")',
);

/** S4: the second phrase over its plain chords; bars 2 and 4 are editable. */
const MODIFY_STARTER = ballad("<C ⟪Dm⟫ G ⟪C⟫>", PHRASE_2);
const MODIFY_SOLUTION = ballad("<C Bb G [C Fm]>", PHRASE_2);
const phrase2 = (form: string) => ballad(form, PHRASE_2);

/** The Make: the verse over its plain chords. The reharmonize rule compares the tune with this one, note for note. */
const MAKE_STARTER = PLAIN;
const MAKE_HOOK = HOOK;
const MAKE_SECOND_PHRASE = ballad("<C Dm G C C Bb G [C Fm]>", TUNE);

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const LEAD = { roll: false, staff: "lead", keyboard: false } as const;
const LEAD_SHEET = { melody: "mel", chords: "chords", title: "Aura Lee" } as const;

export default defineLesson({
  id: "U16.L05",
  version: 3,
  title: "Mixture Lab",
  objective:
    "I can put new chords under a tune without changing it, and tell a borrowed chord from a secondary dominant by ear.",
  key: C,
  meter: "4/4",
  bpm: BPM,
  introduces: ["E12b"],
  practises: [],
  terms: [{ id: "term.reharmonization", step: "S3" }],
  canDo: ["cd.compose.reharmonize", "cd.hear.chromatic"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Same tune, new light",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "same-tune-new-light",
        version: 1,
        role: "practice",
        prompt:
          "Aura Lee's verse twice, first over its plain chords, then over new ones. Follow the sax: does the tune change at all? Then listen under it to bars 2 and 4: which chords change the colour?",
        skills: [{ skill: "E12b", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, caption: "C, Dm, G, C, twice: the plain chords.", bars: 8 },
          {
            code: HOOK,
            caption: "New chords, the same tune. Listen under bars 2 and 4.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Three Ds",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "three-ds",
        version: 1,
        role: "practice",
        prompt:
          "Bar 6 of the tune is three Ds. Predict which of these three borrowed chords has D in it, so it can go under that bar. Pick your answer, then run it: the Ds play over all three chords.",
        skills: [{ skill: "H13", w: 1 }],
        hints: null,
        tests: [],
        code: THREE_UNDER_D,
        bars: 3,
        mode: "choose",
        choices: [
          { id: "b-flat", label: "B♭ major: B♭, D, F" },
          { id: "a-flat", label: "A♭ major: A♭, C, E♭" },
          { id: "f-minor", label: "F minor: F, A♭, C" },
        ],
        correct: ["b-flat"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two kinds of visitor",
      minutes: 1,
      ui: { panels: LEAD, leadSheet: LEAD_SHEET, initialPanels: ["chords"] },
      example: { id: "the-hook-on-the-page", code: HOOK, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "two-kinds-of-visitor",
        version: 1,
        role: "practice",
        prompt:
          "Run the new version and read the lead sheet: the tune with its new chords above it. Some chords lean toward the next one; some only change the light. Then answer both questions: what the D7 of bar 2 is, and how many chords come from C minor.",
        skills: [{ skill: "E12b", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Check where D7 goes next, and whether its F♯ is in C minor. For the count, compare each chord with C minor's three lowered notes: E♭, A♭ and B♭.",
        },
        hints: ladder(
          "Which chord comes right after D7, and how far below D is it?",
          "A dominant seventh that leads a 5th down to its chord is that chord's V7. Borrowed chords come from the minor key on the same home note.",
          "D7 goes to G7 in bars 2 and 6. Of the other chords, C, G7, A♭ and B♭, only those with a lowered note come from C minor.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What is the D7 of bar 2?",
            options: [
              { id: "secondary", label: "A secondary dominant: the V7 of the G7 that follows" },
              { id: "borrowed", label: "A borrowed chord from C minor" },
              { id: "own", label: "The key's own chord on degree 2" },
            ],
            correct: ["secondary"],
          },
          {
            q: "number",
            prompt: "How many different chords of the loop are borrowed from C minor?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["secondary"], number: 2 } }, expect: "pass" },
          {
            name: "D7 taken for a borrowed chord",
            response: { answer: { choice: ["borrowed"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "three counted: D7 as well",
            response: { answer: { choice: ["secondary"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Borrow by ear",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "borrow-by-ear",
        version: 1,
        role: "check",
        key: C,
        prompt:
          "The verse's second phrase over its plain chords: C, Dm, G, C. The target keeps the tune and changes bars 2 and 4. Find the target's chords by ear, bass first, and write them in `changes`: one chord in bar 2, two chords in bar 4, the first of them C.",
        skills: [
          { skill: "H13", w: 0.6 },
          { skill: "E12b", w: 0.4 },
        ],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so a B♭ cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Hum the target's bass in that bar first, then find the chord on it that holds the tune's long note.",
        },
        srs: [
          { family: "fam.har.bass", mode: "review-if-due" },
          { family: "fam.har.progression", mode: "review-if-due" },
        ],
        hints: ladder(
          "Hum the target's bass in bar 2. Is it above or below home, and how far?",
          "Bar 2's bass is a whole step below home: the borrowed chord on ♭7. Bar 4 starts at home and, halfway through, moves to the borrowed chord on 4.",
          "The chord on ♭7 is major and holds the tune's D. In bar 4 the second chord is the sad IV; put both chords of that bar in brackets.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "bar 2 in brackets", response: { code: phrase2("<C [Bb] G [C Fm]>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: phrase2("<C Dm G C>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "B♭ minor: its D♭ fights the tune's D",
            response: { code: phrase2("<C Bbm G [C Fm]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the plain IV, no borrowed note",
            response: { code: phrase2("<C Bb G [C F]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the two halves of bar 4 the wrong way round",
            response: { code: phrase2("<C Bb G [Fm C]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the first C changed as well",
            response: { code: phrase2("<Am Bb G [C Fm]>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "B♭ cut to a click: the right chord, 1% of the bar",
            response: { code: phrase2("<C [Bb@0.01 ~@0.99] G [C Fm]>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Find the visitor",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "find-the-visitor",
        version: 1,
        role: "check",
        prompt:
          "Five loops of four bars. Each has one chord from outside the key: the sad IV, ♭VI or ♭VII. Answer the question each loop shows: pick the bar that holds that chord, or, where the bar is marked, pick which chord it is.",
        skills: [
          { skill: "E12b", w: 0.7 },
          { skill: "H13", w: 0.3 },
        ],
        hints: [
          { text: "Three bars sit inside the key. Which one sounds as if the light had dimmed?" },
          {
            text: "Each of the three carries a lowered note: iv and ♭VI hold ♭6 (le), ♭VII holds ♭7 (te). Listen for the bar whose colour darkens.",
          },
          {
            text: "Hear it again, slower, and hum the bass of that bar: iv stands on 4, ♭VI on ♭6, a half step above 5, and ♭VII on ♭7, a whole step under home.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.har.chromatic", level: 3 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "bar-buttons", bars: 4 },
        correct: {},
        srs: [{ family: "fam.har.chromatic", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your reharmonization",
      minutes: 3,
      ui: { panels: LEAD, leadSheet: LEAD_SHEET, band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-reharmonization",
        version: 1,
        role: "practice",
        prompt:
          "Aura Lee's verse with its plain chords and the tune on a tenor sax. Keep every note of the `mel` line. In `changes`, put at least two chords from outside the key: borrowed chords or secondary dominants. Pick each one so it holds the tune's long note in its bar.",
        skills: [
          { skill: "E12b", w: 0.4 },
          { skill: "H13", w: 0.3 },
          { skill: "H12", w: 0.3 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [8, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "same-tune-new-chords",
            label: "The mel line unchanged, over at least two borrowed chords or secondary dominants",
            required: true,
            // The lab's own idea: outside chords chosen by their colour under a tune (E12b), from the two kinds.
            skills: ["E12b", "H13", "H12"],
            rule: "reharmonize",
            melody: "mel",
            reference: { solutions: [MAKE_STARTER], bars: 8 },
            min: 2,
            kinds: ["borrowed", "secondary-dominant"],
          },
          {
            id: "visitor-goes-home",
            label: "A secondary dominant followed by the chord it leans into",
            required: false,
            skills: ["H12"],
            rule: "contains-rn",
            rn: [],
            min: 1,
            kind: ["secondary-dominant"],
            mustResolve: true,
          },
          {
            id: "climb-from-below",
            label: "♭VI, then ♭VII, then I, in that order",
            required: false,
            skills: ["H13"],
            rule: "contains-rn",
            rn: ["bVI", "bVII", "I"],
            min: 1,
            inOrder: true,
          },
          {
            id: "bass-on-roots",
            label: "On most chord changes, the bass plays the new chord's root",
            required: false,
            skills: ["B01"],
            rule: "bass-line",
            track: "bass",
            harmony: "chords",
            roots: { on: "change", minRatio: 0.75 },
          },
          {
            id: "tenor-on-the-tune",
            label: "The tenor sax plays somewhere in the piece",
            required: false,
            skills: ["D01"],
            rule: "sounds",
            anyOf: ["snd.tenor"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Two chords must come from outside the key. Which bars hold one long note? Those are the easiest places to try one.",
          "Bar 4 and bar 8 hold C, bars 2 and 6 lean on D. Find chords from C minor, or a V7 of the next chord, that contain those notes.",
          "In the modify step, B♭ went under the Ds of bar 6 and F minor shared bar 8 with C: those two are already enough. Then try one more in the first phrase.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the second phrase from the modify step",
            response: { code: MAKE_SECOND_PHRASE },
            expect: "pass",
          },
          {
            name: "the hook: D7 twice and the climb in bar 4",
            response: { code: MAKE_HOOK },
            expect: "pass",
          },
          {
            name: "beyond the brief: both phrases reharmonized, sevenths, a moving Rhodes and a fingered bass",
            response: {
              code: code(
                changes("<C [Am7 D7] G7 [Ab Bb] C Bb [Dm7 G7] [C Fm]>"),
                'chords: chord(changes).voicing().struct("x ~ x x").s("rhodes")',
                'bass: chord(changes).rootNotes(2).s("fingerbass")',
                TUNE,
              ),
            },
            expect: "pass",
          },
          {
            name: "new chords from inside the key only",
            response: { code: ballad("<Am Dm G Am C Dm Em C>", TUNE) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "outside chords, but a note of the tune changed in bar 6",
            response: {
              code: ballad(
                "<C D7 G7 [Ab Bb] C Bb G7 [C Fm]>",
                mel("<[-3 0 -1 0] [1 -2 1@2] [0 -1 -2 -1] 0 [-3 0 -1 0] [1 3 1@2] [0 -1 -2 -1] 0>"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
