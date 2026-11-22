// U15.L05 Dominant Chains. The chord of U15.L02 used several times in a row: a secondary dominant aimed at
// another dominant. In C, E7 leads to A7, A7 to D7, D7 to G7 and G7 home: every chord is the V7 of the next, the
// roots fall by 5ths (E A D G C), and inside the chords two notes slide down a half step at every change (the
// 3rd and 7th of U12.L05, swapping roles each time). Players name the chain by its roots, III7 VI7 II7 V7; Oak's
// numerals name each link by where it goes, V7/vi V7/ii V7/V V7. The sound is a 1920s dance band: a jazz
// guitar on the off-beats, an upright bass on 1 and 3, horn stabs and a trumpet line (`snd.horns` and
// `snd.trumpet` unlock here). Repertoire (contracts §2.8): the changes of `song.five-foot-two` (the first eight
// bars of the chorus, in C: C E7 A7 A7 D7 G7 C G7) and of `song.sweet-georgia-brown` (VI7 II7 V7 I, two bars a
// chord; in its registry key F the chain is D7 G7 C7 F, the answer of S5). Both are 1925 and in the US public
// domain; neither tune is played or shown (the trumpet line is Oak's, and Five Foot Two's tune is CF-T's to take
// down). What the learner has: V7/V (U15.L02), V7/vi, V7/ii, V7/IV (U15.L03), guide tones (U12.L05), the
// circle of fifths (U04), chords by name with one `const` driving chords and bass (U08.L04). Not yet: finding
// applied chords by ear in a drill (`fam.har.chromatic`, U15.L06), tritone substitutes (J5.L01).
// Spec: content/specs/U15.md.
//
// How it is graded (AUTHORING §17, §19.6): numerals are an `rn-palette` with `secondary` allowed, read by
// degree, chroma and quality (the players' `III7` names the right notes and another job: `harmony.rn-degree`,
// with the lesson's own words); a named chord in code is its pitch classes and lowest note per onset (`pcset`,
// `bass: true`); the bass of a chain by ear is an `identify` on a degree pad. The Make's one required rule is
// `contains-rn` with `inOrder`: V/ii, V/V, V and I one after the other (A7 D7 G7 C in C), a held chord counted
// once, so a chain that turns away before home (G7 to F) does not pass.
import { defineLesson, type HintLadder, type KeySpec } from "@oak/content-kit";

const BPM = 120;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const C_MAJOR: KeySpec = { tonic: "C", mode: "major" };
const F_MAJOR: KeySpec = { tonic: "F", mode: "major" };

/** One string drives the guitar, the bass and the horns (U08.L04). */
const changes = (form: string) => `const changes = "${form}"\n`;
/** The guitar chops on 2 and 4, the upright plays roots on 1 and 3: a dance band of the 1920s. */
const GUITAR = 'chords: chord(changes).voicing().struct("~ x ~ x").s("jazzgtr")';
const BASS = 'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")';
const HORNS = 'horns: chord(changes).voicing().struct("x ~ ~ ~ ~ ~ ~ x").s("horns").gain(.6)';
const trumpet = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("trumpet")`;
const band = (form: string, ...lines: string[]) => code(changes(form), GUITAR, BASS, ...lines);

/**
 * The hook: the changes that open Five Foot Two, under a trumpet line of Oak's that takes the note each link
 * brings and resolves it: G♯ over E7, C♯ over A7, F♯ over D7. Evaluated: G E G | G♯ B G♯ | C♯ E G | A |
 * F♯ A F♯ | G F D | E.
 */
const FIVE_FOOT_TWO = "<C E7 A7 A7 D7 G7 C G7>";
const HOOK_TUNE = "<[4 ~ 2 4] [4# ~ 6 4#] [0# ~ 2 4] [5 ~ ~ ~] [3# ~ 5 3#] [4 ~ 3 1] [2 ~ ~ ~] ~>";
const HOOK = band(FIVE_FOOT_TWO, HORNS, trumpet(HOOK_TUNE));
/** S1, second item: the chain of Sweet Georgia Brown set in C, one link later and two bars a chord. */
const GEORGIA = band("<A7 A7 D7 D7 G7 G7 C C>", HORNS);

/** S2: two links of the chain, then the question of where D7 goes. */
const TWO_LINKS = band("<E7 A7 D7 D7>");

/**
 * S3: the chain reduced to two notes a chord over its bass. Each voice falls a half step at every change:
 * G♯ G F♯ F above, D C♯ C B below it; the 3rd of one chord becomes the 7th of the next, and the 7th the 3rd.
 */
const THREAD = code(
  'chords: note("<[g#3,d4] [g3,c#4] [f#3,c4] [f3,b3]>").s("jazzgtr")',
  'bass: note("<e2 a2 d2 g2>").s("upright")',
);

/** S4: the chain in chord names, landing home. */
const CHAIN = band("<E7 A7 D7 G7 C>");

/** S5: Sweet Georgia Brown's chain in F, two bars a chord, the first link given. */
const GEORGIA_STARTER = band("<D7 D7 ⟪D7 D7 D7 D7⟫ F F>");
const GEORGIA_IN_F = band("<D7 D7 G7 G7 C7 C7 F F>");

/** S6: the bass of a chain under its chords, six bars, every bass note a different root. */
const HEARD_CHAIN = code(
  changes("<C E7 A7 D7 G7 C>"),
  'chords: chord(changes).voicing().struct("~ x ~ x").s("jazzgtr")',
  'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")',
);

/**
 * The Make: an eight-bar turn on the key's own chords whose roots already fall by 5ths from E to C (Em Am Dm G7
 * C), with a trumpet tune on the key's own notes. Turning Em, Am and Dm into dominant sevenths makes the chain;
 * the tune's G, C and F then want to become G♯, C♯ and F♯ (`4#`, `0#`, `3#`).
 */
const MAKE_FORM = "<C Em Am Am Dm G7 C G7>";
const MAKE_TUNE = "<[4 ~ 2 4] [4 ~ 6 4] [0 ~ 2 4] [5 ~ ~ ~] [3 ~ 5 3] [4 ~ 3 1] [2 ~ ~ ~] ~>";
const MAKE_STARTER = band(MAKE_FORM, trumpet(MAKE_TUNE));
const MAKE_MINIMAL = band("<C Em A7 A7 D7 G7 C G7>", trumpet(MAKE_TUNE));

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U15.L05",
  version: 4,
  title: "Dominant Chains",
  objective: "I can write a chain of dominant sevenths that falls by 5ths, each the V7 of the next.",
  key: C_MAJOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["H12"],
  terms: [],
  canDo: ["cd.compose.dominant-chain"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Tumbling home",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "tumbling-home",
        version: 1,
        role: "practice",
        prompt:
          "Listen to two loops for a 1920s dance band: the opening changes of Five Foot Two, then the chain of Sweet Georgia Brown. Listen for the bar where the music finally comes to rest. Until then, does any chord sound settled?",
        skills: [{ skill: "H12", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Five Foot Two (1925): after C, four chords in a row, each leaning into the next.",
            bars: 8,
          },
          {
            code: GEORGIA,
            caption: "Sweet Georgia Brown (1925), set in C: a link later, two bars a chord.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "The next link",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "the-next-link",
        version: 1,
        role: "practice",
        prompt:
          "E7 went to A7, and A7 went to D7: each root a 5th below the one before, each chord the V7 of the next. The code stops on D7. Predict which chord it wants next, then pick it.",
        skills: [{ skill: "H12", w: 1 }],
        hints: null,
        tests: [],
        code: TWO_LINKS,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "g7", label: "G7: a 5th below D, and the V7 of home" },
          { id: "c", label: "C: home, straight away" },
          { id: "f7", label: "F7: a 3rd below D" },
        ],
        correct: ["g7"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Two notes slide down",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", initialPanels: ["chords", "circle"] },
      example: { id: "thread", code: THREAD, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "two-notes-slide-down",
        version: 1,
        role: "practice",
        prompt:
          "Run the chain E7, A7, D7, G7, played as two notes a chord over the bass. Watch the two upper notes on the roll at every change. Answer two questions: how far each upper note falls at every change, and which member of A7 the G is that G♯, the 3rd of E7, slides to.",
        skills: [{ skill: "H12", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the upper line bar by bar, G♯ G F♯ F, and count the keys between neighbours. For the second question, list A7 from its root, A C♯ E G, and find G in it.",
        },
        hints: ladder(
          "Two answers: a number of half steps, then a member of a chord. How far is G♯ from G on the keyboard?",
          "Each of the two upper notes moves to the key right below it at every change: G♯ G F♯ F above, D C♯ C B under it.",
          "A7 is A, C♯, E, G from the root. Count up from A to G: which member of the chord is that?",
        ),
        code: { starter: THREAD },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many half steps does each upper note fall at every change?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "G♯ is the 3rd of E7. Which member of A7 is the G it slides to?",
            options: [
              { id: "seventh", label: "The 7th" },
              { id: "third", label: "The 3rd" },
              { id: "root", label: "The root" },
            ],
            correct: ["seventh"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 1, choice: ["seventh"] } }, expect: "pass" },
          {
            name: "two half steps counted",
            response: { answer: { number: 2, choice: ["seventh"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the 3rd for the 7th",
            response: { answer: { number: 1, choice: ["third"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Name every link",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "name-every-link",
        version: 1,
        role: "check",
        prompt:
          "Write the numeral of each chord of this chain in C major: E7, A7, D7, G7, C. Players call it III7 VI7 II7 V7, by its roots. Name each chord by where it goes instead, with a slash where it is the V7 of a chord other than I.",
        skills: [
          { skill: "H12", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        hints: ladder(
          "Start at the end. Which two chords are the key's own V7 and I?",
          "G7 is V7 and C is I. D7 leads to G7, so it is the V7 of V. Each chord before it leads to the chord after it the same way.",
          "A7 leads to D7, and D minor is ii in C, so A7 is the V7 of ii. Now name E7 by the chord it leads to.",
        ),
        stimulus: { src: "code", code: CHAIN, bars: 5, showCode: true },
        answer: { ui: "rn-palette", slots: 5, allow: ["triads", "sevenths", "secondary"] },
        correct: { rn: ["V7/vi", "V7/ii", "V7/V", "V7", "I"] },
        spelling: "enharmonic",
        order: "sequence",
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        // No overrides: the grader names what each slip is (Wave 6): the players' III7 as the right notes under
        // another kind of name (harmony.rn-applied), a missing 7th as the quality (harmony.rn-quality), and one
        // applied chord for another by the chord each leads to (harmony.rn-target).
        tests: [
          {
            name: "V7/vi V7/ii V7/V V7 I",
            response: { answer: { rn: ["V7/vi", "V7/ii", "V7/V", "V7", "I"] } },
            expect: "pass",
          },
          {
            name: "the players' names: III7 VI7 II7 V7 I",
            response: { answer: { rn: ["III7", "VI7", "II7", "V7", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-applied"],
          },
          {
            name: "V/vi: the 7th left off the first link",
            response: { answer: { rn: ["V/vi", "V7/ii", "V7/V", "V7", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-quality"],
          },
          {
            name: "V7/ii for V7/vi: aimed at the wrong chord",
            response: { answer: { rn: ["V7/ii", "V7/ii", "V7/V", "V7", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-target"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Sweet Georgia's chain",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "sweet-georgias-chain",
        version: 1,
        role: "check",
        key: F_MAJOR,
        prompt:
          "Write the two missing links of Sweet Georgia Brown's chain in F major, in the marked bars 3 to 6, two bars each. The chain starts on D7 and lands on F in bar 7. Each link is the V7 of the chord after it.",
        skills: [{ skill: "H12", w: 1 }],
        code: { starter: GEORGIA_STARTER },
        reference: { solutions: [GEORGIA_IN_F], bars: 8 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so a link cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Each link is a dominant seventh whose root is a 5th above the next chord's root.",
        },
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        hints: ladder(
          "Work backwards from F. Which chord is the V7 of F?",
          "The V7 of F is built on the note a 5th above F, which is C. The link before it is the V7 of that chord.",
          "Bars 5 and 6 are the V7 of F: C, a 7. Bars 3 and 4 are built a 5th above C, the same kind of chord.",
        ),
        tests: [
          { name: "reference", response: { code: GEORGIA_IN_F }, expect: "pass" },
          {
            name: "written with ! for the repeats",
            response: { code: band("<D7 D7 G7!2 C7!2 F F>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: band("<D7 D7 D7 D7 D7 D7 F F>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "A7 A7 E7 E7: up a 5th instead of down",
            response: { code: band("<D7 D7 A7 A7 E7 E7 F F>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Gm7: the key's own ii7, B♭ where the link has B",
            response: { code: band("<D7 D7 Gm7 Gm7 C7 C7 F F>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "G7 G7 C C: the last link without its 7th",
            response: { code: band("<D7 D7 G7 G7 C C F F>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the landing changed too",
            response: { code: band("<D7 D7 G7 G7 C7 C7 F7 F7>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "G7 cut to a click in bar 3: gone before the guitar's first chop",
            response: { code: band("<D7 D7 [G7@0.01 ~@0.99] G7 C7 C7 F F>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "The bass of a chain",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "the-bass-of-a-chain",
        version: 1,
        role: "check",
        key: C_MAJOR,
        prompt:
          "Listen to a chain in C major, heard and not seen, one chord a bar, from home back to home. Enter the bass note of each of the six bars as a degree, in order.",
        skills: [
          { skill: "E09", w: 0.6 },
          { skill: "H12", w: 0.4 },
        ],
        hints: [
          { text: "The first and the last bass note are home. Where does the second one sit?" },
          {
            text: "From the second chord on, each bass note is a 5th below the one before, or a 4th above it: the roots walk the circle back to home.",
          },
          {
            text: "Hear it again, slower, and sing each bass note down to do. The second one is mi.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "code", code: HEARD_CHAIN, bars: 6, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        answer: {
          ui: "degree-pad",
          set: ["1", "2", "3", "4", "5", "6", "7"],
          sequenceLen: 6,
          syllables: true,
        },
        correct: { degrees: ["1", "3", "6", "2", "5", "1"] },
        // The catalog names one degree for another; the chain has a rule that finds every root from the last.
        feedbackText: {
          "id.wrong":
            "Not this time. Find the second bass note first. From there each bass note of a chain is a 5th below the one before it (the bass may climb a 4th instead: the same note one octave apart), so count five degrees down from it, then do it again. The notes that leave the key are in the chords above, not in the bass.",
        },
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        tests: [
          {
            name: "1 3 6 2 5 1",
            response: { answer: { degrees: ["1", "3", "6", "2", "5", "1"] } },
            expect: "pass",
          },
          {
            name: "4 for 2: the fourth root heard as fa",
            response: { answer: { degrees: ["1", "3", "6", "4", "5", "1"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your own 1920s turn",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "your-own-1920s-turn",
        version: 1,
        role: "practice",
        prompt:
          "In `changes`, keep every root and change chord kinds so that at least three dominant sevenths in a row, each the V7 of the next, lead through G7 into C. Then add horn stabs: copy the chords line, label it `horns`, sound it with `horns`, and give it a `.struct()` of your own.",
        skills: [{ skill: "H12", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "three-in-a-row",
            label: "Three dominant sevenths in a row, A7, D7 and G7, then C, one straight after another",
            required: true,
            skills: ["H12"],
            rule: "contains-rn",
            // Corrections gate (AS-26): written with the 7, so the links are dominant SEVENTHS, as the brief asks.
            rn: ["V7/ii", "V7/V", "V7", "I"],
            min: 1,
            inOrder: true,
          },
          {
            id: "the-horns-play",
            label: "A line sounds with `horns`",
            required: false,
            skills: ["H12"],
            rule: "sounds",
            anyOf: ["snd.horns"],
          },
          {
            id: "a-link-earlier",
            label:
              "The chain starts a link earlier: a V7 of vi (E7), at least a beat long, moving straight into Am",
            required: false,
            skills: ["H12"],
            rule: "contains-rn",
            rn: ["V/vi"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "trumpet-takes-the-lean",
            label: "The trumpet (`mel`) plays at least one note the chain brings: G♯, C♯ or F♯",
            required: false,
            skills: ["E12a"],
            rule: "degree-set",
            track: "mel",
            // The theory names a raised 5 or 1 by its pitch class in a major key (♭6, ♭2), so both spellings count.
            anyOf: ["#5", "b6", "#1", "b2", "#4"],
            minCount: 1,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Which chords of the turn are minor? Each one stands a 5th above the chord that follows it.",
          "Em, Am and Dm each fall a 5th into the next chord. A dominant seventh on the same root would lean into that chord as its V7.",
          "Make Dm a D7, the V7 of V, and Am an A7, the V7 of ii: with G7 that is three in a row. Em can join too.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: A7 and D7 into G7", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "beyond the brief: the whole chain from E7, horns on the stabs, the trumpet takes the leaning notes",
            response: {
              code: band(
                FIVE_FOOT_TWO,
                'horns: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("horns").gain(.5)',
                trumpet(
                  "<[4 ~ 2 4] [4# ~ 6 4#] [0# ~ 2 4] [5 ~ 0# 2] [3# ~ 5 3#] [4 ~ 3 1] [2 ~ 0 ~] [4 ~ 6 ~]>",
                ),
              ),
            },
            expect: "pass",
          },
          {
            name: "a chain of two: D7 into G7 only",
            response: { code: band("<C C Am Am D7 G7 C G7>", trumpet(MAKE_TUNE)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "A7 D7 G7, then F: the chain does not land home",
            response: { code: band("<C Em A7 A7 D7 G7 F F>", trumpet(MAKE_TUNE)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the chain one bar a link from E7, home in bar 6, the tune left plain",
            response: { code: band("<C E7 A7 D7 G7 C Dm G7>", trumpet(MAKE_TUNE)) },
            expect: "pass",
          },
          {
            name: "A7 into the key's own Dm: the chain broken after one link",
            response: { code: band("<C Em A7 A7 Dm G7 C G7>", trumpet(MAKE_TUNE)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
