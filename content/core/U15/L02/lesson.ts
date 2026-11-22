// U15.L02 Five of Five. The first chord from outside the key. Raise one note of the chord on degree 2 (in C:
// Dm's F to F♯, yesterday's ♯4, "fi") and the chord stops being the key's own: D7 is G's own V7, so it pulls
// into G the way G7 pulls home. G is V here, which makes D7 the V of V, written V7/V (V/V as a triad): a
// secondary dominant. The learner meets it as a sound first, the bar in a familiar turn where the harmony
// leans forward, and only then gets the name. What the learner has: chromatic degrees in code and on syllables
// (`n("3#")` = ♯4 = fi, U15.L01), the dominant seventh and "it leans a 5th down" (U11.L04, U12.L02), the one
// dominant seventh a key owns, on V (U12.L04), chords by name with one `const` driving chords and bass
// (U08.L04), numerals with sevenths on the palette (U12.L04). Not yet: the V of other chords (V/vi, V/ii,
// V7/IV: U15.L03), the leading-tone chord of a chord (U15.L04), chains of dominants (U15.L05), finding them by
// ear in a drill (`fam.har.chromatic`, U15.L06). Spec: content/specs/U15.md.
//
// How it is graded (AUTHORING §17, §19.6): "which bar leans out of the key" is `bar-buttons` on a heard loop;
// a named chord in code is its pitch classes and lowest note per onset (`pcset`, `bass: true`), so `Gm7` or `G`
// for `G7` fails on a note; numerals are an `rn-palette` with `secondary` allowed, read by degree, chroma and
// quality (`II7` names the right notes and the wrong job: `harmony.rn-degree`, with the lesson's own words).
// The Make's one required rule is `contains-rn` with V/V and `mustResolve`: the chord counts only where the
// next chord is V, so a D7 that wanders off to F does not pass, and neither does the key's own Dm.
import { defineLesson, type HintLadder, type IdentifyEx, type KeySpec } from "@oak/content-kit";

const BPM = 92;
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

/** One string drives the chords and the bass (U08.L04): change the chords once and the bass follows. */
const changes = (form: string) => `const changes = "${form}"\n`;
const CHORDS = 'chords: chord(changes).voicing().s("rhodes")';
/** The root of every chord, low on the upright: the voicing above does not always put it lowest. */
const BASS = 'bass: chord(changes).rootNotes(2).s("upright")';
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const loop = (form: string, ...lines: string[]) => code(changes(form), CHORDS, BASS, ...lines);

/**
 * The turn of the hook, first with the key's own chord on degree 2 (bar 3: Dm, the tune on F), then with that
 * chord's F raised to F♯ (D7, the tune on F♯: `3#`, ♯4). The tune is otherwise the same: G E G | E C | F A F
 * (F♯ A F♯) | G F D, a chord note on every strong beat.
 */
const tune = (bar3: string) => mel(`<[4 ~ 2 4] [2 ~ 0 ~] ${bar3} [4 ~ 3 1]>`);
const HOOK_IN_KEY = loop("<C Am Dm G7>", tune("[3 ~ 5 3]"));
const HOOK = loop("<C Am D7 G7>", tune("[3# ~ 5 3#]"));

/** S2: the key's own triad on degree 2, then the same triad with its 3rd raised. */
const DM_THEN_D = code('chords: chord("<Dm D>").voicing().s("rhodes")');
/**
 * S3: two pairs stacked by hand from their roots, so the roll reads root, 3rd, 5th, 7th from the bottom:
 * G7 home to C, then D7 to G, the same move a 5th higher.
 */
const TWO_PAIRS = code('chords: note("<[g2,b2,d3,f3] [c3,e3,g3] [d3,f#3,a3,c4] [g2,b2,d3]>").s("rhodes")');

/** S4: a loop heard without its code; one bar holds the chord from outside the key. */
const heard = (form: string) =>
  code(
    changes(form),
    'chords: chord(changes).voicing().struct("x ~ x ~").s("rhodes")',
    'bass: chord(changes).rootNotes(2).struct("x ~ ~ x").s("upright")',
  );

/** S5: the same turn in F major. Bar 3 is the key's own Gm; the V7 of C is G7 (G B D F: B♮ is the visitor). */
const MODIFY_STARTER = loop("<F Dm ⟪Gm⟫ C7>");
const MODIFY_SOLUTION = loop("<F Dm G7 C7>");

/** S6: a last line in C, shown in chord names. */
const LAST_LINE = loop("<F D7 G7 C>");

/** S7: the note that moves, fa fi sol, one a bar over Dm, D7 and G; the fourth bar rests on C. */
const SING = code(
  'chords: chord("<Dm D7 G C>").voicing().s("rhodes")',
  'bass: chord("<Dm D7 G C>").rootNotes(2).s("upright")',
  mel("<3 3# 4 ~>"),
);

/**
 * The Make: an eight-bar verse on the key's own chords. Its last V (bar 8) is approached by Dm, with the tune
 * on F. Turning bar 7 into D7 makes the tune's F rub against the chord's F♯, which the learner fixes with the
 * `3#` of U15.L01.
 */
const VERSE = "<C Am F G7 C Am Dm G7>";
const verseTune = (bar7: string) =>
  mel(`<[4 ~ 2 4] [2 ~ 0 ~] [3 ~ 5 3] [4 ~ 1 ~] [4 ~ 2 4] [5 ~ 4 2] ${bar7} [4 ~ 3 1]>`);
const MAKE_STARTER = loop(VERSE, verseTune("[3 ~ 5 3]"));
const MAKE_MINIMAL = loop("<C Am F G7 C Am D7 G7>", verseTune("[3 ~ 5 3]"));
const MAKE_TUNED = loop("<C Am F G7 C Am D7 G7>", verseTune("[3# ~ 5 3#]"));

/** Drums from the Band; chords and bass are the learner's, so the rules read them (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

const earHints = (): HintLadder => [
  { text: "Three of the four bars sit inside the key. Which one sounds as if a note had been raised?" },
  {
    text: "The chord you are listening for is brighter than the key expects, and the bar after it feels like an arrival.",
  },
  {
    text: "Hear it again, slower. Hum the bass and notice the bar where the chord above it turns bright.",
    replay: { rate: 0.75 },
  },
  "auto",
];
const earPart = (
  id: string,
  prompt: string,
  key: KeySpec,
  form: string,
  bar: number,
  other: number,
): IdentifyEx => ({
  kind: "identify",
  id,
  version: 1,
  role: "check",
  key,
  prompt,
  skills: [
    { skill: "H12", w: 0.6 },
    { skill: "E12a", w: 0.4 },
  ],
  hints: earHints(),
  stimulus: { src: "code", code: heard(form), bars: 4, showCode: false },
  cue: { context: "none", countInBars: 1, click: false, replays: -1 },
  answer: { ui: "bar-buttons", bars: 4 },
  correct: { number: bar },
  feedbackText: {
    "id.wrong":
      "Bar {got} stays inside the key. Listen for the bar that sounds a shade too bright, right before the loop arrives on a chord that feels expected.",
  },
  tests: [
    { name: `bar ${bar}`, response: { answer: { number: bar } }, expect: "pass" },
    {
      name: `bar ${other}: the chord it leans into`,
      response: { answer: { number: other } },
      expect: "fail",
      feedback: ["id.wrong"],
    },
  ],
});

export default defineLesson({
  id: "U15.L02",
  version: 3,
  title: "Five of Five",
  objective: "I can build the V7 of V, hear the bar where it leans, and name it V7/V.",
  key: C_MAJOR,
  meter: "4/4",
  bpm: BPM,
  introduces: ["H12"],
  practises: [],
  terms: [{ id: "term.secondary-dominant", step: "S3" }],
  canDo: ["cd.write.secondary-dominant"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One note raised",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "one-note-raised",
        version: 1,
        role: "practice",
        prompt:
          "Listen to a four-bar turn twice. The second time, one note of bar 3 is raised a half step, in the chord and in the tune. Listen for bar 3 tilting forward, and for how much more firmly bar 4 lands.",
        skills: [{ skill: "H12", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK_IN_KEY, caption: "C, Am, Dm, G7: all inside the key.", bars: 4 },
          { code: HOOK, caption: "C, Am, D7, G7: hear bar 3 push into bar 4.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which note moved",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "which-note-moved",
        version: 1,
        role: "practice",
        prompt:
          '`chord("<Dm D>")` plays D minor for a bar, then D major. Dm is D, F and A. Predict which one note moves to make D major, and what the new note is called in C major. Pick one.',
        skills: [{ skill: "H12", w: 1 }],
        hints: null,
        tests: [],
        code: DM_THEN_D,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "f-sharp", label: "F goes up to F♯: degree ♯4, fi" },
          { id: "b-flat", label: "A goes up to B♭: degree ♭7, te" },
          { id: "e-flat", label: "D goes up to E♭: degree ♭3, me" },
        ],
        correct: ["f-sharp"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "The same move, a 5th higher",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "note", initialPanels: ["chords"] },
      example: { id: "two-pairs", code: TWO_PAIRS, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "the-same-move-a-fifth-higher",
        version: 1,
        role: "practice",
        prompt:
          "Run the two pairs and read the note names on the roll, bottom to top. Bars 1 and 2 are G7 going home to C; bars 3 and 4 make the same move from D. Answer two questions: which chord is D7 the V7 of, and how many of its four notes are outside C major?",
        skills: [{ skill: "H12", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Bar 3 does to bar 4 what bar 1 does to bar 2: a dominant seventh, then the chord a 5th below it. For the count, read bar 3 from the bottom, D F♯ A C, and check each note against C major.",
        },
        hints: ladder(
          "G7 pulls to the chord a 5th below it. What is a 5th below D?",
          "D7 is D, F♯, A and C. Three of those are white keys that C major owns; one is not.",
          "A 5th below D is G: D7 is to G what G7 is to C. Now count the notes of D7 that C major does not have.",
        ),
        code: { starter: TWO_PAIRS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "D7 is the V7 of which chord?",
            options: [
              { id: "g", label: "G: the chord a 5th below D" },
              { id: "c", label: "C: every dominant seventh leads home" },
              { id: "a-minor", label: "A minor: the chord a 5th above D" },
            ],
            correct: ["g"],
          },
          { q: "number", prompt: "How many of D7's four notes are outside C major?", correct: 1 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["g"], number: 1 } }, expect: "pass" },
          {
            name: "D7 taken to lead home to C",
            response: { answer: { choice: ["c"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "two notes counted: F♯ and the 7th, C",
            response: { answer: { choice: ["g"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Find the lean",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "find-the-lean",
        version: 1,
        role: "check",
        prompt:
          "Find the V7 of V by ear in two four-bar loops, one in C major, one in F major. It is the chord a shade too bright for the key, leaning into the next bar. For each loop, pick the number of that bar.",
        skills: [
          { skill: "H12", w: 0.6 },
          { skill: "E12a", w: 0.4 },
        ],
        hints: earHints(),
        tests: [],
        parts: [
          earPart("lean-in-c", "Loop 1, in C major.", C_MAJOR, "<C F D7 G7>", 3, 4),
          earPart("lean-in-f", "Loop 2, in F major.", F_MAJOR, "<F G7 C7 F>", 2, 3),
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Lean into C",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-modify",
        id: "lean-into-c",
        version: 1,
        role: "check",
        key: F_MAJOR,
        prompt:
          "The turn is now in F major: F, Dm, Gm, C7. Change the marked chord of bar 3, `Gm`, into the V7 of C, so it leans into C7 in bar 4. Edit only that chord: the bass reads `changes` too and follows it.",
        skills: [{ skill: "H12", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one (contracts §6.7); `durations`:
        // and it lasts as the target's does, so a G7 cut to a click is not the target.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. The V7 of C is the dominant seventh built a 5th above C.",
        },
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        hints: ladder(
          "Which note is a 5th above C? The chord you need is the dominant seventh built on it.",
          "A 5th above C is G, the root bar 3 already has. Gm is the key's own chord there; C's V7 is a major triad on G with a ♭7 on top.",
          "In the hook, Dm became D7. Do the same to Gm: the m goes, a 7 comes.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          { name: "the bar in brackets", response: { code: loop("<F Dm [G7] C7>") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: loop("<F Dm Gm C7>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "Gm7: a seventh added, the 3rd still the key's own B♭",
            response: { code: loop("<F Dm Gm7 C7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "D7: the chord of the hook, which is the V7 of G",
            response: { code: loop("<F Dm D7 C7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "G: the V of C as a triad, without its 7th",
            response: { code: loop("<F Dm G C7>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "C7 changed as well",
            response: { code: loop("<F Dm G7 C>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: "G7 cut to a click: the right chord, 1% of the bar",
            response: { code: loop("<F Dm [G7@0.01 ~@0.99] C7>") },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Name it by where it goes",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "name-it-by-where-it-goes",
        version: 1,
        role: "check",
        prompt:
          "Write the numeral of each chord of this line in C major: F, D7, G7, C. Include the 7th where a chord has one. Name the chord that is not the key's own as the V7 of the chord it leads to, with a slash.",
        skills: [
          { skill: "H12", w: 0.7 },
          { skill: "N06", w: 0.3 },
        ],
        hints: ladder(
          "Three of these chords are the key's own. Which one has a note C major does not have?",
          "D7 is not the chord C major puts on degree 2. It is the V7 of the chord that follows it. What is that chord's numeral?",
          "G7 is V7. D7 is the V7 of that V, so it is written with a slash: V7, then the chord it belongs to.",
        ),
        stimulus: { src: "code", code: LAST_LINE, bars: 4, showCode: true },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads", "sevenths", "secondary"] },
        correct: { rn: ["IV", "V7/V", "V7", "I"] },
        spelling: "enharmonic",
        order: "sequence",
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        // The catalog words both misses for the key's own chords: it calls V7/V "built on degree 5" and reads a
        // missing 7th as a slip of case. These name what an applied chord's numeral is made of instead, and
        // still fit a miss on one of the three plain chords.
        feedbackText: {
          "harmony.rn-degree":
            "Chord {slot}: {got} does not fit {expChord} here. Check the root against C major first. If the chord has a note the key does not own, name it as the V7 of the chord it leads to, with a slash.",
          "harmony.rn-case":
            "Chord {slot}: {got} is close; it is {exp}. Check upper or lower case, and whether the chord has a 7th.",
        },
        tests: [
          {
            name: "IV V7/V V7 I",
            response: { answer: { rn: ["IV", "V7/V", "V7", "I"] } },
            expect: "pass",
          },
          {
            name: "II7: the right root, named as if it were the key's own chord",
            response: { answer: { rn: ["IV", "II7", "V7", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
          {
            name: "V/V: the 7th left off",
            response: { answer: { rn: ["IV", "V/V", "V7", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
          {
            name: "ii7: the key's own chord on 2, which is minor",
            response: { answer: { rn: ["IV", "ii7", "V7", "I"] } },
            expect: "fail",
            feedback: ["harmony.rn-degree"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "sing",
      title: "Sing the note that moves",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-note-that-moves",
        version: 1,
        role: "practice",
        prompt:
          "Listen, then sing three notes, one a bar, while the chords change under you: fa, fi, sol (4, ♯4, 5). Hold each note until the chord changes. Sing in your own range.",
        skills: [
          { skill: "E12a", w: 0.6 },
          { skill: "V03", w: 0.4 },
        ],
        hints: [
          { text: "Hum fa first, over the D minor chord, and hold it until the chord changes." },
          {
            text: "Fi is the smallest step up from fa, and sol is the smallest step up from fi: two half steps in a row.",
          },
          { text: "Hear it again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // One note a bar (the rhythm is one bar long and repeats): fa over Dm, fi over D7, sol over G.
        target: { from: "degrees", degrees: ["4", "#4", "5"], rhythm: "x", octaves: [0, 0, 0] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Lean into the last bar",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS, initialPanels: ["chords"] },
      exercise: {
        kind: "code-make",
        id: "lean-into-the-last-bar",
        version: 1,
        role: "practice",
        prompt:
          "In `changes`, put a V7 of V in the bar right before a V chord. Then change the tune's note in that bar that now rubs against the new chord. Done when a V7 of V moves straight into V. After that the verse is yours: move chords, rewrite the tune, try the organ.",
        skills: [{ skill: "H12", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "five-of-five-goes-to-five",
            label: "A V7 of V (D7, or D) at least a beat long, moving straight into V (G or G7)",
            required: true,
            skills: ["H12"],
            rule: "contains-rn",
            rn: ["V/V"],
            min: 1,
            mustResolve: true,
          },
          {
            id: "tune-takes-the-raised-note",
            label: "`mel` plays ♯4 (F♯) at least once",
            required: false,
            skills: ["E12a"],
            rule: "degree-set",
            track: "mel",
            contains: ["#4"],
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
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The new chord is V's own V7, and it goes in the bar right before V. Which chord of the verse is V, and where is it?",
          "V is G7, in bars 4 and 8. The V7 of G is built on D, a 5th above G. Bar 7 is already on D: it only needs to change kind.",
          "Write `D7` where bar 7 has `Dm`. Then listen to the tune in that bar: its F rubs against the chord's F♯. In `n`, ♯4 is `3#`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: Dm becomes D7 in bar 7", response: { code: MAKE_MINIMAL }, expect: "pass" },
          { name: "and the tune takes ♯4 over it", response: { code: MAKE_TUNED }, expect: "pass" },
          {
            name: "beyond the brief: the V of V squeezed into half a bar, twice, on the organ, with a new tune",
            response: {
              code: code(
                changes("<C Am F [D7 G7] C Am [F D7] G7>"),
                'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").s("organ").gain(.6)',
                BASS,
                mel("<[2 ~ 4 2] [0 ~ 2 ~] [5 ~ 3 5] [3# ~ 4 ~] [2 ~ 4 7] [5 ~ 4 2] [3 ~ 3# 5] [4 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "D7 that does not go to V: it falls back to F",
            response: { code: loop("<C Am D7 F C Am Dm G7>", verseTune("[3 ~ 5 3]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "D7 that lands on G minor: the right root, not the V it points at",
            response: { code: loop("<C Am F G7 C Am D7 Gm>", verseTune("[3 ~ 5 3]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "D7 that lands on G augmented: the right root, not the V it points at",
            response: { code: loop("<C Am F G7 C Am D7 Gaug>", verseTune("[3 ~ 5 3]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "D7 into G7 in a new place: bar 3, with the tune on ♯4 there",
            response: {
              code: loop(
                "<C Am D7 G7 C Am F G7>",
                mel("<[4 ~ 2 4] [2 ~ 0 ~] [3# ~ 5 3#] [4 ~ 3 1] [4 ~ 2 4] [5 ~ 4 2] [3 ~ 5 3] [4 ~ 3 1]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "Dm7: a seventh on the key's own chord, no raised note",
            response: { code: loop("<C Am F G7 C Am Dm7 G7>", verseTune("[3 ~ 5 3]")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
