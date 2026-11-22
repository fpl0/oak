// J4.L04 Reading a Standard (spec: content/specs/J4.md). A standard is a melody and its changes on one page: the
// head, the tune a band plays at the start and the end, with the solos over its changes in between. The learner reads
// the A section of a tune on I Got Rhythm's changes from its lead sheet: the melody from the staff, the chords from
// the symbols above it, and hears how the two fit (a note of the chord on each beat 1, steps between them).
//
// Repertoire (contracts §2.8; content/repertoire, song.i-got-rhythm): I Got Rhythm (1930) is US public domain since
// 2026 for the published composition, melody and changes only, never its lyrics, never a later arrangement. Its
// answer key (the 1930 refrain, 34 bars with the tag marked) is author:repertoire's to write and verify, and it does
// not exist yet. Until it is `verified`, this lesson runs, as the spec's fallback says, on a head written for Oak in the
// style of the period over the real changes of the A section, and the prose says so ("the tune on this page is
// Oak's"). When the key lands, HEAD and S3's first two bars are replaced by the key's melody (the A section, bars
// 1–8), the reference solutions follow from the constants, and the tests' pitches are re-pinned with
// `bun run content:check J4.L04 --verbose`; the planned `song-melody-kept` with `GradeContext.songMelody` may then
// replace the Make's `matches` rule (spec).
//
// The head, evaluated with the comping (`guidetones` anchored at A4): D B♭ D | E♭ A | D B♭ G | C B♭ A F | C E♭ D |
// G B♭ D♭ | F A B D | C A over B♭maj7 Gm7 | Cm7 F7 | B♭maj7 Gm7 | Cm7 F7 | Fm7 B♭7 | E♭maj7 E°7 | Dm7 G7 | Cm7 F7.
// Every note on a beat belongs to the chord sounding (the A of bar 4 is a passing note on a swung "and"); beat 1 holds
// the 3rd five times and the root or the 5th three times, so "a note of the chord, not always the root" is true; no
// note on a beat sits a half step from a note of the comping (the A of bar 4, a passing note, is the one exception). The first
// phrase ends in bar 4 (F, then a rest).
//
// Written for the learner at the gate (AUTHORING §20.1): J4 opens after U15.L06; nothing here needs U16–U17. The words
// "head" and "contrafact" are this lesson's terms (S2); nothing before S2's pass text uses them.
//
// The corrections-pass standard (AUTHORING §20.2):
// - S3 reads the line as heard and written: absolute pitch, onsets and lengths (`events`, `durations: true`), so the
//   right notes as quarters with rests (the right notes, the wrong rhythm), an octave down, or an eighth late fail;
// - S4 reads the chords as heard: pitch classes and lowest note at every onset of comping and bass (`pcset`), so G7
//   for Gm7 (the right root, the wrong quality) or only one of the two bars fixed fail;
// - the Make's one required rule is the melody as the page writes it (`matches` with a `melody` matcher, absolute
//   pitch, against the page), so no melody, the melody a step off, or the melody a bar late fail.
import { defineLesson, type HintLadder, type KeySpec, type RubricRule } from "@oak/content-kit";

const BPM = 160;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const B_FLAT: KeySpec = { tonic: "Bb", mode: "major" };
const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;

/** The A section of rhythm changes in B♭ (J4.L03), one entry a bar. */
const A_BARS = [
  "[Bb^7 Gm7]",
  "[Cm7 F7]",
  "[Bb^7 Gm7]",
  "[Cm7 F7]",
  "[Fm7 Bb7]",
  "[Eb^7 Eo7]",
  "[Dm7 G7]",
  "[Cm7 F7]",
];
/** Oak's head over it (see the header): half notes as `@2`, the eighths of bar 4 in a bracket. */
const HEAD_BARS = [
  "[d5@2 bb4 d5]",
  "[eb5@2 a4@2]",
  "[d5@2 bb4 g4]",
  "[c5 [bb4 a4] f4 ~]",
  "[c5 eb5 d5@2]",
  "[g4 bb4 db5@2]",
  "[f4 a4 b4 d5]",
  "[c5@2 a4@2]",
];
const alt = (bars: string[]) => `<${bars.join(" ")}>`;
const changesConst = (bars: string[]) => `const changes = "${alt(bars)}"`;

/** The jazz kit's ride and hats (J1.L01). */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
/** The upright on the roots, half notes on 1 and 3 (each root sounds under every comping hit). */
const BASS = 'bass: chord(changes).rootNotes(2).struct("x x").s("upright")';
/**
 * Comping on beat 1, the "and" of 2 and beat 3, so both chords of a bar sound (J4.L03), on guide tones: under a
 * melody that sits on 3rds, the 9th of a rootless voicing would rub a half step against it (B♭ over A in Gm7, E♭ over
 * D in Cm7, evaluated), so the comping plays the 3rd and the 7th only (J1.L05).
 */
const COMP_RHYTHM = '.struct("x ~ ~ x x ~ ~ ~").swingBy(1/3, 4)';
const comp = (calls = '.anchor("a4")', sound = '.s("rhodes").gain(.5)', rhythm = COMP_RHYTHM) =>
  `chords: chord(changes).dict("guidetones")${calls}.voicing()${rhythm}${sound}`;
const mel = (bars: string, sound = '.s("vibes")') => `mel: note("${bars}").swingBy(1/3, 4)${sound}`;

/** The whole page: the A section, eight bars. */
const PAGE = code(changesConst(A_BARS), "", RIDE, HATS, BASS, comp(), mel(alt(HEAD_BARS)));
/** S1's second item: the changes without the melody. */
const CHANGES_ALONE = code(changesConst(A_BARS), "", RIDE, HATS, BASS, comp());

/** S3: the first two bars. The starter holds a placeholder B♭ on each beat 1. */
const TWO = A_BARS.slice(0, 2);
const TWO_HEAD = alt(HEAD_BARS.slice(0, 2));
const s3 = (line: string) => code(changesConst(TWO), "", RIDE, BASS, comp(), line);
const S3_PAGE = s3(mel(TWO_HEAD));
const S3_STARTER = s3('mel: note("<⟪[bb4 ~ ~ ~] [bb4 ~ ~ ~]⟫>").swingBy(1/3, 4).s("vibes")');

/** S4: the first four bars; the code has two wrong chords against the symbols on the page. */
const FOUR = A_BARS.slice(0, 4);
const FOUR_HEAD = alt(HEAD_BARS.slice(0, 4));
const s4 = (bars: string[], chords = comp()) =>
  code(changesConst(bars), "", RIDE, BASS, chords, mel(FOUR_HEAD));
const S4_STARTER = code(
  `const changes = "<⟪[Bb^7 G7] [C7 F7]⟫ [Bb^7 Gm7] [Cm7 F7]>"`,
  "",
  RIDE,
  BASS,
  comp(),
  mel(FOUR_HEAD),
);
const S4_SOLUTION = s4(FOUR);
/** The symbols printed above the staff in S4 (the page is right; the code is not). */
const S4_CHART = [
  { bar: 1, beat: 1, symbol: "Bb^7" },
  { bar: 1, beat: 3, symbol: "Gm7" },
  { bar: 2, beat: 1, symbol: "Cm7" },
  { bar: 2, beat: 3, symbol: "F7" },
  { bar: 3, beat: 1, symbol: "Bb^7" },
  { bar: 3, beat: 3, symbol: "Gm7" },
  { bar: 4, beat: 1, symbol: "Cm7" },
  { bar: 4, beat: 3, symbol: "F7" },
];

/** S5: the trio plays the changes; the melody holds the two bars read in S3 and rests after them. */
const MAKE_HEAD_START = `<${HEAD_BARS.slice(0, 2).join(" ")} ~ ~ ~ ~ ~ ~>`;
const make = (...lines: string[]) => code(changesConst(A_BARS), "", ...lines);
const MAKE_STARTER = make(BASS, comp(), mel(MAKE_HEAD_START));
const MAKE_MINIMAL = make(BASS, comp(), mel(alt(HEAD_BARS)));

const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** The Make's one required rule: the melody of the page, note for note, in pitch and in time. */
const THE_PAGE: RubricRule = {
  id: "the-page",
  label: "The melody plays all eight bars as the page writes them, note for note",
  required: true,
  skills: ["N07"],
  rule: "matches",
  min: 0.9,
  reference: { solutions: [code(mel(alt(HEAD_BARS)))], bars: 8 },
  matcher: {
    m: "melody",
    pitch: "absolute",
    wPitch: 0.8,
    wRhythm: 0.2,
    rhythmTol: [1, 16],
    track: "@melody",
  },
};
/** A suggestion: a tempo the trio can swing at (the brief leaves the tempo to the learner). */
const SWING_TEMPO: RubricRule = {
  id: "swing-tempo",
  label: "`setcpm` sets a tempo between 120 and 220 beats a minute",
  required: false,
  skills: ["J12"],
  rule: "tempo-bpm",
  min: 120,
  max: 220,
};

const LEAD = { roll: false, staff: "lead", keyboard: false } as const;
const LEAD_SHEET = { melody: "mel", chords: "chords" } as const;
/** Drums from the Band: the chords and the bass are the learner's (AUTHORING §8 rule 5). */
const DRUMS = { band: "band.two-five-one", tracks: ["drums"] } as const;

export default defineLesson({
  id: "J4.L04",
  version: 3,
  title: "Reading a Standard",
  objective: "I can play a standard's melody and changes from its lead sheet.",
  key: B_FLAT,
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["N07", "J12"],
  terms: [
    { id: "term.head", step: "S2" },
    { id: "term.contrafact", step: "S2" },
  ],
  canDo: ["cd.read.standard"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A tune on one page",
      minutes: 0.5,
      ui: { panels: LEAD, leadSheet: LEAD_SHEET, band: false },
      example: { id: "the-page", code: PAGE, bars: 8 },
      exercise: {
        kind: "listen",
        id: "a-tune-on-one-page",
        version: 1,
        role: "practice",
        prompt:
          "Follow the page as it plays. In the second loop the melody drops out: listen to the chords alone and notice where you have heard them before.",
        skills: [{ skill: "N07", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: PAGE,
            caption: "The melody on the vibes, the chords in the trio.",
            bars: 8,
          },
          {
            code: CHANGES_ALONE,
            caption: "The same eight bars without the melody.",
            bars: 8,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "How the tune sits on its chords",
      minutes: 1,
      ui: { panels: LEAD, leadSheet: LEAD_SHEET, band: false },
      example: { id: "read-the-page", code: PAGE, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "how-the-tune-sits",
        version: 1,
        role: "practice",
        prompt:
          "Run it, read along and answer two questions: in which bar the first phrase ends, and what the melody plays on beat 1 of each bar against the chord named above it.",
        skills: [{ skill: "N07", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Look for the first rest on the staff after a run of notes, and spell the chord above three or four of the bars: is the first note one of its letters?",
        },
        hints: ladder(
          "For the phrase, find the first rest on the staff after a run of notes.",
          "Count bars from the left. For beat 1, spell the chord above the bar (Cm7 is C E♭ G B♭) and look for the melody's first note in it.",
          "Bar 2 starts on E♭ under Cm7: the chord's 3rd, not its root. For the phrase, find the first rest the staff shows.",
        ),
        code: { starter: PAGE },
        mustPlayLoops: 1,
        questions: [
          { q: "number", prompt: "In which bar does the first phrase end?", correct: 4 },
          {
            q: "choice",
            prompt: "What does the melody play on beat 1 of each bar?",
            options: [
              { id: "chord-tone", label: "A note of the chord above it, often its 3rd" },
              { id: "root", label: "The root of the chord, every time" },
              { id: "outside", label: "A note from outside the chord" },
            ],
            correct: ["chord-tone"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 4, choice: ["chord-tone"] } }, expect: "pass" },
          {
            name: "bar 2: the first long note, not the first rest",
            response: { answer: { number: 2, choice: ["chord-tone"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the root every time",
            response: { answer: { number: 4, choice: ["root"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      // The unit's "Play from the page" (AUTHORING §4): the target is shown only as the lead sheet, no roll.
      ui: { panels: LEAD, leadSheet: LEAD_SHEET, band: false },
      example: { id: "the-first-two-bars", code: S3_PAGE, bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "The page shows the first two bars. Write those two bars of melody on `mel` in note names: the right notes in the right octave, each as long as the page says. Replace the placeholder B♭s. Done when both bars match the page.",
        skills: [{ skill: "N07", w: 1 }],
        swing: SWUNG,
        code: { starter: S3_STARTER },
        reference: { solutions: [S3_PAGE], bars: 2 },
        matcher: {
          m: "events",
          pitch: "absolute",
          rhythm: "onsets",
          durations: true,
          tracks: ["mel"],
        },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rhythm.duration":
            "Bar {bar}: the right note, held for the wrong length. Read the note's shape on the staff: a hollow head lasts two beats.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: the page has a note here that your line does not play.",
          "melody.extra-note": "Bar {bar}, {beatLabel}: your line plays a note where the page has none.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: not the note the page writes there. Count its line or space again.",
        },
        hints: ladder(
          "Read one bar at a time: count its notes, and mark which have hollow heads and last longer.",
          "A hollow note head is a half note, two beats: write it with `@2`. Read each note's line or space from the treble clef, with the key's flats.",
          "Bar 1 starts on the D in the fourth line, held for two beats. B♭ comes next.",
        ),
        srs: [{ family: "fam.mel.dictation", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: S3_PAGE }, expect: "pass" },
          {
            name: "sharps for the same keys: a#4 and d#5",
            response: { code: s3(mel("<[d5@2 a#4 d5] [d#5@2 a4@2]>")) },
            expect: "pass",
          },
          {
            name: "in degrees of B♭: n counts from 0",
            response: {
              code: s3('mel: n("<[2@2 0 2] [3@2 -1@2]>").scale("Bb4:major").swingBy(1/3, 4).s("vibes")'),
            },
            expect: "pass",
          },
          {
            name: "on the piano, without the swing call",
            response: { code: s3('mel: note("<[d5@2 bb4 d5] [eb5@2 a4@2]>").s("piano")') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S3_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the right notes as quarters with rests: the wrong lengths",
            response: { code: s3(mel("<[d5 ~ bb4 d5] [eb5 ~ a4 ~]>")) },
            expect: "fail",
            feedback: ["rhythm.duration"],
          },
          {
            name: "an octave down",
            response: { code: s3(mel("<[d4@2 bb3 d4] [eb4@2 a3@2]>")) },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "the right notes, an eighth late",
            response: { code: s3(mel("<[d5@2 bb4 d5] [eb5@2 a4@2]>", '.late(1/8).s("vibes")')) },
            expect: "fail",
            feedback: ["melody.missing-note", "melody.extra-note"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Chords from the symbols",
      minutes: 1.25,
      graded: true,
      ui: { panels: LEAD, leadSheet: { melody: "mel", chords: { chart: S4_CHART } }, band: false },
      example: { id: "four-bars", code: s4(FOUR), bars: 4 },
      exercise: {
        kind: "code-modify",
        id: "chords-from-the-symbols",
        version: 1,
        role: "check",
        prompt:
          "The melody is right, but two of the chords in `changes` are not the ones printed above the staff. Compare each symbol in `changes` with the one printed on the page, and fix the two that differ. Keep the melody. Done when the trio plays the page's chords.",
        skills: [{ skill: "J12", w: 1 }],
        swing: SWUNG,
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        // A chord is its notes: pitch classes and lowest note at every onset of the comping and the bass.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords", "bass"], durations: true },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: the trio plays another chord than the one printed above it. Compare the code's symbol with the page's, letter and ending.",
        },
        hints: ladder(
          "Read the symbols above bars 1 and 2 on the page and compare them with `changes`, letter and ending.",
          "The roots are right everywhere. Two chords have the wrong kind of seventh: a minor seventh is written `m7`, a dominant seventh plain `7`.",
          "Bar 1's second chord on the page is G minor with its seventh. Check bar 2 the same way.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "the comping on the piano",
            response: { code: s4(FOUR, comp('.anchor("a4")', '.s("piano").gain(.5)')) },
            expect: "pass",
          },
          {
            name: "the comping held, each chord for its half bar",
            response: { code: s4(FOUR, comp('.anchor("a4")', '.s("rhodes").gain(.5)', "")) },
            expect: "pass",
          },
          {
            name: "the hand anchored at G4",
            response: { code: s4(FOUR, comp('.anchor("g4")')) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "G7 left in bar 1: the right root, the wrong seventh",
            response: { code: s4(["[Bb^7 G7]", "[Cm7 F7]", "[Bb^7 Gm7]", "[Cm7 F7]"]) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "C7 left in bar 2",
            response: { code: s4(["[Bb^7 Gm7]", "[C7 F7]", "[Bb^7 Gm7]", "[Cm7 F7]"]) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Gm and Cm: triads, the sevenths left off",
            response: { code: s4(["[Bb^7 Gm]", "[Cm F7]", "[Bb^7 Gm7]", "[Cm7 F7]"]) },
            expect: "fail",
            feedback: ["code.chord-not-in-dict"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "Play the standard",
      minutes: 2.75,
      ui: {
        panels: { roll: false, staff: "lead", keyboard: false },
        leadSheet: LEAD_SHEET,
        band: DRUMS,
        initialPanels: ["chords"],
      },
      example: { id: "the-a-section", code: PAGE, bars: 8 },
      exercise: {
        kind: "code-make",
        id: "play-the-standard",
        version: 1,
        role: "practice",
        title: "The A section",
        prompt:
          "Finish the melody on `mel`: it has the two bars you read, so write bars 3 to 8 from the page, note for note. Required: the page's melody, all eight bars. Also on the checklist: a tempo of 120 to 220. The arrangement is yours: comping rhythm, a walk or a two-feel, the sound of the head.",
        skills: [{ skill: "N07", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [8, 16],
        saveAs: "sketch",
        rubric: [THE_PAGE, SWING_TEMPO],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        // Catalog melody texts name the expected note; these point at the page instead.
        feedbackText: {
          "rubric.unmet": "{label}: not yet.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: the page has a note here that your line does not play.",
          "melody.extra-note": "Bar {bar}, {beatLabel}: your line plays a note where the page has none.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: not the note the page writes there. Count its line or space again.",
          "melody.index-shift":
            "Every note sits higher or lower than the page writes it. Read the lines and spaces again.",
        },
        hints: ladder(
          "Bars 3 to 8 are still rests in your code. Read them from the page one bar at a time.",
          "Read bars 3 to 8 the way you read bars 1 and 2: the note names in their octave, `@2` for a half note, two eighths in a bracket, `~` for a rest.",
          "Bar 3 is bar 1 with its last note moved down to G. Bar 4 has two eighths on beat 2 and a rest on beat 4.",
        ),
        tests: [
          {
            name: "the starter as it is: two bars of eight",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the whole head on the vibes", response: { code: MAKE_MINIMAL }, expect: "pass" },
          {
            name: "the head on the trumpet, comping on the piano, faster",
            response: {
              code: make(
                BASS,
                comp('.anchor("a4")', '.s("piano").gain(.5)'),
                mel(alt(HEAD_BARS), '.s("trumpet")'),
              ).replace(`setcpm(${BPM}/4)`, "setcpm(184/4)"),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: a walking bass, the comping on the Charleston, the head twice",
            response: {
              code: make(
                'bass: note("<[bb1 d2 g1 b1] [c2 eb2 f2 a1] [bb1 d2 g1 b1] [c2 eb2 f2 e2] [f2 ab2 bb1 d2] [eb2 g2 e2 db2] [d2 f2 g2 b1] [c2 eb2 f2 a1]>").s("upright")',
                comp('.anchor("a4")', '.s("rhodes").gain(.5)', '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4)'),
                mel(alt([...HEAD_BARS, ...HEAD_BARS])),
              ),
            },
            expect: "pass",
          },
          {
            name: "in degrees of B♭ on the Rhodes, comped in rootless voicings",
            response: {
              code: make(
                BASS,
                'chords: chord(changes).dict("lefthand").anchor("e4").voicing().struct("x ~ ~ x x ~ ~ ~").swingBy(1/3, 4).s("piano").gain(.4)',
                'mel: n("<[2@2 0 2] [3@2 -1@2] [2@2 0 -2] [1 [0 -1] -3 ~] [1 3 2@2] [-2 0 [2b]@2] [-3 -1 0# 2] [1@2 -1@2]>").scale("Bb4:major").swingBy(1/3, 4).s("rhodes")',
              ),
            },
            expect: "pass",
          },
          {
            name: "the head a whole step up: the right function, the wrong notes",
            response: { code: make(BASS, comp(), mel(alt(HEAD_BARS), '.transpose(2).s("vibes")')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the head a bar late",
            response: { code: make(BASS, comp(), mel(alt(HEAD_BARS), '.late(1).s("vibes")')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the head silent at gain 0",
            response: { code: make(BASS, comp(), mel(alt(HEAD_BARS), '.s("vibes").gain(0)')) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
