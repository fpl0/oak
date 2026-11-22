// J3.L03 Comping Rhythms (spec: content/specs/J3.md). Comping is rhythm: the pianist plays the chords in short,
// swung hits that talk with the ride. Two figures carry most of it: the Charleston, a hit on beat 1 and another
// on the "and" of 2, and the push, each chord arriving early on the "and" of 4 and held across the bar line.
// `.struct()` (U06.L12) writes the first, `.early(1/8)` (U13.L01) the second; both sit before `.swingBy(1/3, 4)`,
// so the off-beat hits swing with the ride.
//
// Written for the learner at the gate (AUTHORING §20.1): J3 may be taken with U14–U17 unfinished, so the lesson
// uses only what the core up to U13.CP, J1, J2.L01–L03 and J3.L01–L02 guarantee. Key B♭ (the track's key
// rotation). The chords are the J3.L01 rootless voicings from the left-hand dictionary anchored at A4.
//
// Evaluated (headless Strudel): `chord("<Cm7 F7 Bb^7 Bb^7>").dict("lefthand").anchor("a4").voicing()` plays
// Cm7 B♭3 D4 E♭4 G4 (a B voicing), F7 A3 D4 E♭4 G4 (A), B♭maj7 A3 C4 D4 F4 (B): B A B. The Charleston
// `.struct("x ~ ~ x ~ ~ ~ ~")` before `.swingBy(1/3, 4)` sounds at 0 and 5/12 of each bar (the swung "and" of 2);
// written after the swing call it sounds at a straight 3/8. `.early(1/8)` before the swing call sounds at 11/12,
// 23/12, 35/12, 47/12 (the swung "and" of 4, each chord the next bar's) and bar 1 holds only that one chord the
// first time through; after the swing call the push lands on a straight 7/8. `.struct()` written before
// `.dict()` keeps the notes (the voicing happens after it).
//
// The corrections-pass standard (AUTHORING §20.2): S3 reads the rhythm on the straightened grid AND the chords
// at each onset (pitch classes and lowest note), so a Charleston of wrong chords, or of silence, fails; its
// wrong answer with the right function is `.struct("x ~ ~ x")` (beat 1 and beat 4). S5 reads the chords at each
// onset; its wrong answers with the right function are `.early(1/4)` (on beat 4) and `.late(1/8)` (after the bar
// line). The Make's one required rule is `syncopation` on the chords (at least three chords land off the beat
// and hold over a stronger one, in four bars): the Charleston gives 4, the push 3, whole bars and quarters 0,
// and `.early(1/8)` written before a rhythm on the beats moves the chords under an unmoved rhythm and gives 0.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 144;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One bar in seconds (tap tests). */
const BAR_SEC = 240 / BPM;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;
const SWING = ".swingBy(1/3, 4)";

/** The rhythm section: the jazz kit's ride and hats, the upright in two under Cm7 F7 B♭maj7 B♭maj7. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
const BASS = 'bass: note("<[c2 g2] [f2 c2] [bb1 f2] [bb1 d2]>").s("upright")';

/** The ii–V–I in B♭ from the left-hand dictionary, the hand at A4: B A B. */
const CHANGES = "<Cm7 F7 Bb^7 Bb^7>";
const VOICED = `chord("${CHANGES}").dict("lefthand").anchor("a4").voicing()`;
/** The comping line: `time` goes between the voicing and the swing call (STYLE §1). */
const comp = (time = "", sound = "rhodes", tail = "") =>
  `chords: ${VOICED}${time}${SWING}.s("${sound}")${tail}`;

const CHARLESTON = '.struct("x ~ ~ x ~ ~ ~ ~")';
const PUSH = ".early(1/8)";

const HELD_TRIO = code(RIDE, HATS, BASS, comp());
const CHARLESTON_TRIO = code(RIDE, HATS, BASS, comp(CHARLESTON));
const PUSHED_TRIO = code(RIDE, HATS, BASS, comp(PUSH));

/** S3 and S5: the trio with the comping held a bar each; only the chords line is editable. */
const trio = (chordLine: string) => code(RIDE, HATS, BASS, chordLine);
const STARTER = trio(`chords: ⟪${VOICED}${SWING}.s("rhodes")⟫`);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");
const CHARLESTON_SOLUTION = trio(comp(CHARLESTON));
const PUSH_SOLUTION = trio(comp(PUSH));

/** S6: the Band plays drums and bass; the comping starts held, a bar a chord. */
const MAKE_STARTER = code(comp());
const make = (...lines: string[]) => code(...lines);

/** Seconds from the start of the tap stimulus at the given shares of a bar. */
const at = (bars: number[]) => bars.map((b) => Number((b * BAR_SEC).toFixed(3)));
const FOUR = [0, 1, 2, 3];
/** The Charleston, swung: beat 1 and the "and" of 2, which the swing puts 5/12 of the way into the bar. */
const CHARLESTON_TAPS = at(FOUR.flatMap((b) => [b, b + 5 / 12]));

/**
 * The off-beat hits really swing (review): every chord that starts between two beats sits late in its beat, about
 * 2:1. The rhythm and pcset matchers read the straightened grid, so without this a straight Charleston (the swing
 * call before `.struct()`), a push after the swing call (a straight 7/8) or no swing call at all passed.
 */
const HITS_SWING = (min: number): RubricRule => ({
  id: "hits-swing",
  label: "The off-beat hits land late in their beat, swung with the ride, not halfway",
  required: true,
  skills: ["R13"],
  rule: "custom",
  fn: "swung-offbeats",
  params: { track: "chords", min },
});

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "J3.L03",
  version: 3,
  title: "Comping Rhythms",
  objective: "I can comp a ii–V–I with the Charleston rhythm and with pushes into the next bar.",
  key: { tonic: "Bb", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["H06", "R10"],
  terms: [{ id: "term.charleston", step: "S3" }],
  canDo: ["cd.code.comp-rhythms"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three conversations",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "charleston-trio", code: CHARLESTON_TRIO, bars: 4 },
      exercise: {
        kind: "listen",
        id: "three-conversations",
        version: 1,
        role: "practice",
        prompt:
          "The ride, the bass and the chords' notes never change. Listen to when the Rhodes plays against the ride in each take. Notice how each take changes the conversation between them.",
        skills: [{ skill: "H06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HELD_TRIO,
            caption: "Each chord held for its whole bar.",
            bars: 4,
          },
          {
            code: CHARLESTON_TRIO,
            caption: "Count the Rhodes' hits in each bar.",
            bars: 4,
          },
          {
            code: PUSHED_TRIO,
            caption: "Listen to where each chord starts, against the bass on beat 1.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "tap",
      title: "Tap the two hits",
      minutes: 1,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "tap",
        id: "tap-the-two-hits",
        version: 1,
        role: "practice",
        prompt:
          "Tap with the Rhodes chords, not the ride: one tap on beat 1 and one on the swung “and” of 2, late in beat 2, in every bar. Nothing on beats 3 and 4. Four bars, eight taps in all. Done when each tap lands with a chord.",
        skills: [{ skill: "H06", w: 1 }],
        hints: ladder(
          "Listen for the second Rhodes chord of each bar: it does not land on a beat, but between two.",
          "Count 1 & 2 & 3 & 4 & with the ride. The second hit is on the “&” after 2, late in its beat, where the ride's short note falls.",
          "Say “ONE two-AND three four” and tap on ONE and on AND. Nothing on 3 or 4.",
        ),
        mode: "along",
        stimulus: { src: "code", code: CHARLESTON_TRIO, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 1, click: false, replays: -1 },
        bars: 4,
        target: { track: "chords" },
        tol: { windowMs: "auto", tempo: "locked", forgiveOffset: true, passF1: 0.8, passTiming: 0.7 },
        feedbackText: {
          "tap.missed": "A Rhodes hit came without a tap. There are two in every bar.",
          "tap.extra": "A tap landed where the Rhodes is silent. Two taps a bar, then wait for the next bar.",
        },
        srs: [
          { family: "fam.rhy.syncopation", mode: "review-if-due" },
          { family: "fam.rhy.swing", mode: "review-if-due" },
        ],
        tests: [
          { name: "with the Rhodes", response: { taps: CHARLESTON_TAPS }, expect: "pass" },
          {
            name: "on beats 1 and 3",
            response: { taps: at(FOUR.flatMap((b) => [b, b + 1 / 2])) },
            expect: "fail",
          },
          {
            name: "on every beat",
            response: { taps: at(FOUR.flatMap((b) => [b, b + 1 / 4, b + 1 / 2, b + 3 / 4])) },
            expect: "fail",
          },
          { name: "no taps", response: { taps: [] }, expect: "fail" },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Give the chords two hits",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "comp-two-hits",
        version: 1,
        role: "check",
        prompt:
          "The Rhodes holds each chord for a bar. Give it the rhythm you tapped: a hit on beat 1 and one on the swung “and” of 2, every bar. Place the hits before the swing call so the second one swings with the ride. Keep the chords.",
        skills: [
          { skill: "H06", w: 0.6 },
          { skill: "R10", w: 0.4 },
        ],
        swing: SWUNG,
        code: { starter: STARTER },
        reference: { solutions: [CHARLESTON_SOLUTION], bars: 4 },
        // Heard: the hits on the straightened grid (feel-aligned, so the swung "and" of 2 is read as the "and"),
        // and at each hit the same rootless chord (pitch classes and lowest note).
        matcher: {
          m: "all",
          of: [
            {
              m: "rhythm",
              tol: [1, 16],
              durations: false,
              perRole: false,
              displacementCredit: 0.5,
              tracks: ["chords"],
            },
            { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
            { m: "rubric", rules: [HITS_SWING(4)] },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Listen to the target's second hit: late in beat 2, with the ride's short note, not halfway through the beat.",
          "rhythm.displaced":
            "Not yet: the hits are shifted from the target's. Listen to the target against the ride and count the eighth notes of the bar.",
          "rhythm.missing":
            "Bar {bar}: the target plays a hit that yours does not. Listen to the target against the ride and count the eighth notes of the bar.",
          "rhythm.extra": "Bar {bar}, {beatLabel}: a hit where the target leaves the Rhodes silent.",
          "harmony.pcset":
            "Bar {bar}: where the target plays its chord, yours plays other notes or none. Keep the chords as they were; only when they sound is new.",
          "harmony.bass":
            "Bar {bar}: the rhythm is there, but that chord has another note at the bottom. Keep the chords as they were.",
        },
        hints: ladder(
          "Give the chords a rhythm with the call that takes a string of `x`s and rests, the way the drums and comping did in earlier lessons.",
          "`.struct()` takes one place per eighth note of the bar: eight places, an `x` where the Rhodes plays. It goes before `.swingBy()`, so the off-beat hit swings.",
          "The first place of the eight is `x`, and so is one more, three eighths later. The rest are `~`.",
        ),
        tests: [
          { name: "reference", response: { code: CHARLESTON_SOLUTION }, expect: "pass" },
          {
            name: "half a bar in four places, then a rest",
            response: { code: trio(comp('.struct("[x ~ ~ x] ~")')) },
            expect: "pass",
          },
          {
            name: "the second hit as half of beat 2",
            response: { code: trio(comp('.struct("x [~ x] ~ ~")')) },
            expect: "pass",
          },
          {
            name: "the rhythm written before the voicing",
            response: {
              code: trio(
                `chords: chord("${CHANGES}")${CHARLESTON}.dict("lefthand").anchor("a4").voicing()${SWING}.s("rhodes")`,
              ),
            },
            expect: "pass",
          },
          {
            name: "the hits written in the chord pattern",
            response: {
              code: trio(
                'chords: chord("<[Cm7 ~ ~ Cm7 ~ ~ ~ ~] [F7 ~ ~ F7 ~ ~ ~ ~] [Bb^7 ~ ~ Bb^7 ~ ~ ~ ~] [Bb^7 ~ ~ Bb^7 ~ ~ ~ ~]>").dict("lefthand").anchor("a4").voicing().swingBy(1/3, 4).s("rhodes")',
              ),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "beat 1 and beat 4: the right call, the second hit a beat and a half late",
            response: { code: trio(comp('.struct("x ~ ~ x")')) },
            expect: "fail",
            feedback: ["rhythm.missing", "rhythm.extra"],
          },
          {
            name: "beats 1 and 2: the second hit on the beat",
            response: { code: trio(comp('.struct("x ~ x ~ ~ ~ ~ ~")')) },
            expect: "fail",
            feedback: ["rhythm.extra", "rhythm.missing"],
          },
          {
            name: "the rhythm right, the hand left at its default height",
            response: {
              code: trio(
                `chords: chord("${CHANGES}").dict("lefthand").voicing()${CHARLESTON}${SWING}.s("rhodes")`,
              ),
            },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "the rhythm right, the Rhodes silent",
            response: { code: trio(comp(CHARLESTON, "rhodes", ".gain(0)")) },
            expect: "fail",
            feedback: ["rhythm.missing"],
          },
          {
            name: "the right calls in the wrong order: the swing before the rhythm, a straight Charleston",
            response: { code: trio(`chords: ${VOICED}${SWING}${CHARLESTON}.s("rhodes")`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the rhythm with no swing call",
            response: { code: trio(`chords: ${VOICED}${CHARLESTON}.s("rhodes")`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the swung Charleston written on the triplet grid",
            response: {
              code: trio(`chords: ${VOICED}.struct("[x ~ ~] [~ ~ x] [~ ~ ~] [~ ~ ~]").s("rhodes")`),
            },
            expect: "pass",
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "Arriving early",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "pushed-trio", code: PUSHED_TRIO, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "arriving-early",
        version: 1,
        role: "practice",
        prompt:
          "The Rhodes holds its chords again, now with `.early(1/8)` before the swing call: the push you already know, swung. Run it from the start, read the roll against the bass and answer two questions: where each Rhodes chord begins, and how many begin inside bar 1 the first time through.",
        skills: [{ skill: "R10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Find where a Rhodes chord begins on the roll and compare it with the next bass note on beat 1. Then look at bar 1 alone, the first time through: how many chords begin inside it?",
        },
        hints: ladder(
          "Compare where a Rhodes chord begins on the roll with the next bass note on beat 1.",
          "`.early(1/8)` moves every chord an eighth earlier, and the swing call moves that off-beat later inside its beat, as it does the ride's short note.",
          "The first chord, Cm7, would have begun before the music started, so you never hear it the first time. Count what does begin in bar 1.",
        ),
        code: { starter: PUSHED_TRIO },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Where does each Rhodes chord begin?",
            options: [
              { id: "and-of-4", label: "On the swung “and” of 4, just before the bar line" },
              { id: "beat-4", label: "On beat 4, a whole beat before the bar line" },
              { id: "and-of-1", label: "On the “and” of 1, just after the bar line" },
            ],
            correct: ["and-of-4"],
          },
          {
            q: "number",
            prompt: "The first time through, how many Rhodes chords begin inside bar 1?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["and-of-4"], number: 1 } }, expect: "pass" },
          {
            name: "a whole beat early",
            response: { answer: { choice: ["beat-4"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "none: the push into bar 2 missed",
            response: { answer: { choice: ["and-of-4"], number: 0 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Push every chord",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "push-every-chord",
        version: 1,
        role: "check",
        prompt:
          "The Rhodes holds each chord for its bar. Make every chord arrive on the swung “and” of 4 of the bar before and ring across the bar line. Add one call to the chords line, before the swing call. Keep the chords.",
        skills: [
          { skill: "R10", w: 0.6 },
          { skill: "H06", w: 0.4 },
        ],
        swing: SWUNG,
        code: { starter: STARTER },
        reference: { solutions: [PUSH_SOLUTION], bars: 4 },
        // Heard: the same rootless chord at each onset (pitch classes and lowest note), where the target's sound,
        // still sounding halfway through the target's chord (`durations`: a stab that stops before the bar line is
        // not a push that rings across it), and the push swung (a straight 7/8 is not the swung "and" of 4).
        matcher: {
          m: "all",
          of: [
            { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
            { m: "rubric", rules: [HITS_SWING(3)] },
          ],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true },
        feedbackText: {
          "harmony.shifted":
            "Not yet: the chords are right, but they arrive at another moment than the target's. Listen where each one starts against the bass note on beat 1.",
          "harmony.pcset":
            "Bar {bar}: the chord sounding there is not the target's. Listen to the target: each chord belongs to the bar it rings into.",
          "code.time-fraction-string":
            "In quotes, the number is read as a pattern and nothing moves. Write it bare, as a share of the bar.",
          "rhythm.duration":
            "Bar {bar}: the chord stops too soon. A push rings across the bar line into the bar it belongs to.",
          "rubric.unmet":
            "{label}: not yet. Listen to where the target's push lands: late in beat 4, with the ride's short note, not halfway through the beat.",
        },
        hints: ladder(
          "Use the call from the core that makes a whole line arrive before the beat, as in the last step's code.",
          "`.early()` takes a share of the bar; an eighth note is one eighth of it. Put the call before `.swingBy()` so the early hit swings with the ride.",
          "The line reads `…voicing().early(` then the share, then `)` and the swing call.",
        ),
        tests: [
          { name: "reference", response: { code: PUSH_SOLUTION }, expect: "pass" },
          {
            name: "the share as a decimal",
            response: { code: trio(comp(".early(.125)")) },
            expect: "pass",
          },
          {
            name: "the push on the chord names, before the dictionary",
            response: {
              code: trio(
                `chords: chord("${CHANGES}").early(1/8).dict("lefthand").anchor("a4").voicing()${SWING}.s("rhodes")`,
              ),
            },
            expect: "pass",
          },
          {
            name: "pushed on the piano",
            response: { code: trio(comp(PUSH, "piano")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a quarter early: the right call, on beat 4",
            response: { code: trio(comp(".early(1/4)")) },
            expect: "fail",
            feedback: ["harmony.shifted"],
          },
          {
            name: "late for early: after the bar line",
            response: { code: trio(comp(".late(1/8)")) },
            expect: "fail",
            feedback: ["harmony.shifted"],
          },
          {
            name: "the fraction in quotes: nothing moves",
            response: { code: trio(comp('.early("1/8")')) },
            expect: "fail",
            feedback: ["code.time-fraction-string"],
          },
          {
            name: "the right call after the swing call: a straight push",
            response: { code: trio(`chords: ${VOICED}${SWING}${PUSH}.s("rhodes")`) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right call on short stabs: nothing rings across the bar line",
            response: { code: trio(comp(`.struct("x ~ ~ ~ ~ ~ ~ ~")${PUSH}`)) },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "the push on the triplet grid: a twelfth early, no swing call",
            response: { code: trio(`chords: ${VOICED}.early(1/12).s("rhodes")`) },
            expect: "pass",
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your comping",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.two-five-one", tracks: ["drums", "bass"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-comping",
        version: 1,
        role: "practice",
        title: "Comping in B♭",
        prompt:
          "Give the held Rhodes chords a rhythm that talks with the ride: the Charleston, pushes into the next bar, or hits that change from bar to bar with `< >`. Required: at least three chords start off the beat, with no chord on the beat after them. Also on the checklist: a vibes line, and a tempo of 120 to 200.",
        skills: [
          { skill: "H06", w: 0.6 },
          { skill: "R10", w: 0.4 },
        ],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "off-the-beat",
            label: "At least three chords start between two beats, with no chord on the beat after them",
            required: true,
            skills: ["R10"],
            rule: "syncopation",
            track: "chords",
            min: 3,
          },
          {
            id: "tune-on-top",
            label: "A vibes line plays over the comping",
            required: false,
            skills: ["H06"],
            rule: "sounds",
            contains: ["snd.vibes"],
          },
          {
            id: "swing-tempo",
            label: "`setcpm` sets a tempo between 120 and 200 beats a minute",
            required: false,
            skills: ["R13"],
            rule: "tempo-bpm",
            min: 120,
            max: 200,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Right now every chord starts on beat 1. Move some of them between two beats.",
          "What counts is a hit that starts between two beats, with no new hit on the beat after it. `.struct()` places hits; `.early()` moves the whole line.",
          "The Charleston gives one such hit a bar, and so does a push. Either call goes before the swing call.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the Charleston", response: { code: make(comp(CHARLESTON)) }, expect: "pass" },
          { name: "minimal: the push", response: { code: make(comp(PUSH)) }, expect: "pass" },
          {
            name: "a push on the and of 4, held over the bar line",
            response: { code: make(comp('.struct("~ ~ ~ ~ ~ ~ ~ x")', "jazzgtr")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a rhythm that changes each bar, pushed into bar 3, on the piano, with vibes",
            response: {
              code: make(
                comp(
                  '.struct("<[x ~ ~ x ~ ~ ~ ~] [~ ~ x ~ ~ ~ ~ x] [~ ~ ~ x ~ ~ x ~] [x ~ ~ ~ ~ x ~ ~]>")',
                  "piano",
                  ".gain(.8)",
                ),
                'mel: note("<[d5 ~ c5 bb4] [a4 ~ ~ c5] [d5 ~ f5 ~] [d5 ~ ~ ~]>").swingBy(1/3, 4).s("vibes")',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(168/4)"),
            },
            expect: "pass",
          },
          {
            name: "a chord on every beat",
            response: { code: make(comp('.struct("x x x x")')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right call, before a rhythm on the beats: nothing lands off the beat",
            response: {
              code: make(`chords: ${VOICED}.early(1/8).struct("x ~ x ~ x ~ x ~")${SWING}.s("rhodes")`),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the Charleston, but the Rhodes silent",
            response: { code: make(comp(CHARLESTON, "rhodes", ".gain(0)")) },
            expect: "fail",
            feedback: ["make.silent"],
          },
        ],
      },
    },
  ],
});
