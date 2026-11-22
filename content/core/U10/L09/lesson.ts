// U10.L09 Minor Melodies. A minor spiritual carries the whole unit: me and do-based minor heard in a real tune,
// a key home that a voice can feel without a chord, and the raised 7 of Raise the Seventh (U10.L06) where the
// tune climbs home. The learner takes the opening of Go Down Moses down by ear, sings its second line from the
// lead sheet, writes its answer "Let my people go" from the page, and arranges the whole line as a slow minor
// ballad with `strings` and `.delay()` (both unlocked here). What the learner has: by-ear transcription
// (U03.L10), `n` below 0 (U03.L03), pickups and lead sheets (U07.L08–L09), natural minor in code (U10.L01), the
// minor chords and the major V of harmonic minor (U10.L04–L06), the upright bass. No new theory and no new term.
// Spec: content/specs/U10.md.
//
// Repertoire (contracts §2.8): song.go-down-moses ("Jubilee Songs, as Sung by the Fisk Jubilee Singers", 1872;
// A minor, 4/4), answer key content/repertoire/go-down-moses/song.ts. The verse's first line, as that key has it
// (in degrees of A minor, home A4): 5 | ♭3 ♭3 2 2 | ♭3 ♭3 1 | 5 5 7 7 | 1 ("When Israel was in Egypt's land, let
// my people go"). The pickup and "let my" are the 5 BELOW home (E4); "peo-ple" climbs to the raised 7 (G♯4), the
// tune's only accidental; "go" lands on home. In `n` over `A4:harmonic:minor` that is
// `<[~ ~ ~ -3] [2 2 1 1] [2 2 0@2] [-3 -3 [-1 -1] ~] [0@4]>`: every attack where the answer key has it; the key's
// "peo-ple" (an eighth and a quarter, then an eighth rest) is two eighths and a quarter rest here (same onsets),
// and its last bar holds home for the whole bar (the key's line 1 ends with a half note, a rest and the next
// pickup). The second line sings the same notes without the pickup. The opening (S2) uses only 1, 2, ♭3 and 5, so
// it is written over `A4:minor`; every code string with the G♯ is in harmonic minor, and its exercise declares
// that key (check 13). Wayfaring Stranger (song.wayfaring-stranger) is not used: it goes to ladder L5.
//
// Harmony (Oak's, a ballad reharmonisation of the key's i i V i): i VI V i, Am F E Am. Every beat-1 note is a
// chord note: C over Am, C over F, E over E, A over Am; the G♯ of "peo-ple" sounds against the E chord's own G♯.
// Evaluated: pad A2 C3 E3 | F3 A3 C4 | E3 G♯3 B3 | A2 C3 E3, upright A1 F2 E2 A1, tune E4 | C5 C5 B4 B4 | C5 C5 A4 |
// E4 E4 G♯4 G♯4 | A4.
//
// How it is graded: the dictation is a by-ear `melody` match in any octave (`octave-free`, pass 0.85); the
// Play-from-the-page step is an `events` match on its own track, octave-free; the Make's one required rule is
// `matches` against the whole line with a key-relative `melody` matcher, so any octave, sound or key with the
// same degrees and rhythm passes, and a new tune does not.
import { type ByEarSpec, defineLesson, type HintLadder, type Matcher } from "@oak/content-kit";

const BPM = 76;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** i VI V i: strings on stacked triads, roots first so each bar is one chord (U06.L08). */
/** The ballad's scale: harmonic minor, so that `n` 4 under the pad is E major and `n` −1 in the tune is G♯. */
const H = "harmonic:minor";
const pad = (roots: string, scale = H) =>
  `pad: n("${roots}").add(n("[0,2,4]")).scale("A2:${scale}").s("strings").gain(.6)`;
const bass = (roots: string, scale = H) => `bass: n("${roots}").scale("A1:${scale}").s("upright")`;
const mel = (tune: string, extra = "") => `mel: n("${tune}").scale("A4:${H}").s("piano")${extra}`;

const ROOTS = "<0 5 4 0>";
/** The same four chords after an empty pickup bar. */
const ROOTS_PICKUP = "<~ 0 5 4 0>";
const HOOK = code(pad(ROOTS), bass(ROOTS), mel("<[4 ~ ~ 2] [0 ~ 2 ~] [1 ~ ~ ~] [0 ~ ~ ~]>", ".delay(.3)"));

/**
 * Go Down Moses, the verse's first line (see the header): the pickup bar, then four bars, over `A4:harmonic:minor`.
 * 5 | ♭3 ♭3 2 2 | ♭3 ♭3 1 (half) | 5 5 7 7 | 1 (whole), the 5s below home. In A minor: E | C C B B | C C A | E E G♯ G♯ | A.
 */
const GO_DOWN_MOSES = "<[~ ~ ~ -3] [2 2 1 1] [2 2 0@2] [-3 -3 [-1 -1] ~] [0@4]>";
/** Its opening, the pickup and two bars ("When Israel was in Egypt's land"). */
const OPENING = "<[~ ~ ~ -3] [2 2 1 1] [2 2 0@2]>";
/** Its answer, two bars ("Let my people go"). */
const ANSWER = "<[-3 -3 [-1 -1] ~] [0@4]>";
/** The verse's second line ("Oppressed so hard they could not stand, let my people go"): the same notes, no pickup. */
const LINE_TWO = "<[2 2 1 1] [2 2 0@2] [-3 -3 [-1 -1] ~] [0@4]>";
const MOSES = code(pad(ROOTS_PICKUP), bass(ROOTS_PICKUP), mel(GO_DOWN_MOSES));

/** One quarter note before the first full bar. */
const PICKUP = { units: [1, 1] } as const;

/** S2: the opening by ear, over the pad and the bass. The starter gives the rhythm and the first note. */
const DICTATE_PAD = [pad("<~ 0 5>", "minor"), bass("<~ 0 5>", "minor")] as const;
const dictation = (tune: string, key = "A4:minor") =>
  code(...DICTATE_PAD, `mel: n("${tune}").scale("${key}").s("piano")`);
const SKELETON = "<[~ ~ ~ -3] [0 0 0 0] [0 0 0@2]>";
const DICTATE_STARTER = code(...DICTATE_PAD, `mel: n("⟪${SKELETON}⟫").scale("A4:minor").s("piano")`);
/** By ear, in any octave: the rule shown before the learner starts (`any-octave` = `octave-free`). */
const BY_EAR: ByEarSpec = { ab: true, rates: [1, 0.75, 0.5], accepts: "any-octave" };
const BY_EAR_MATCHER: Matcher = {
  m: "melody",
  pitch: "octave-free",
  wPitch: 0.8,
  wRhythm: 0.2,
  rhythmTol: [1, 16],
  track: "mel",
};

/** S3: the second line on the page, the same notes as the first without the pickup, the pad's chords above. */
const CHART = [
  { bar: 1, beat: 1, symbol: "Am" },
  { bar: 2, beat: 1, symbol: "F" },
  { bar: 3, beat: 1, symbol: "E" },
  { bar: 4, beat: 1, symbol: "Am" },
];
const LEAD_SHEET = { melody: "mel", chords: { chart: CHART }, title: "Go Down Moses" } as const;
const PAGE = code(mel(LINE_TWO));

/** S4: the answer from the page alone, written in code over its two chords. */
const ANSWER_PAD = [pad("<4 0>"), bass("<4 0>")] as const;
const ANSWER_CHART = [
  { bar: 1, beat: 1, symbol: "E" },
  { bar: 2, beat: 1, symbol: "Am" },
];
const s5 = (tune: string) => code(...ANSWER_PAD, mel(tune));
const S5_PLACEHOLDER = "<[0 0 [0 0] ~] [0@4]>";
const S5_STARTER = code(...ANSWER_PAD, `mel: n("⟪${S5_PLACEHOLDER}⟫").scale("A4:${H}").s("piano")`);

/** The Make starts with the whole backing and the phrase's rhythm on one note, home. */
const MAKE_STARTER = code(
  pad(ROOTS_PICKUP),
  bass(ROOTS_PICKUP),
  mel("<[~ ~ ~ 0] [0 0 0 0] [0 0 0@2] [0 0 [0 0] ~] [0@4]>"),
);
const MAKE_REFERENCE = code(pad(ROOTS_PICKUP), bass(ROOTS_PICKUP), mel(GO_DOWN_MOSES));

/** Drums from the Band, optional in a ballad: the pad and the bass carry the pulse. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const LEAD = { roll: false, staff: "lead", keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const MINOR = { tonic: "A", mode: "minor" } as const;
/** Every code string with the raised 7 (the E chord, the G♯ of "peo-ple") is in harmonic minor. */
const HARMONIC = { tonic: "A", mode: "harmonic minor" } as const;

export default defineLesson({
  id: "U10.L09",
  version: 3,
  title: "Minor Melodies",
  objective:
    "I can take a minor spiritual down by ear, sing it from the lead sheet, and arrange it as a ballad with strings and an echo.",
  key: MINOR,
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E07", "V04"],
  terms: [],
  canDo: ["cd.transcribe.minor-tune"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S2",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Strings and an echo",
      minutes: 0.75,
      ui: { panels: NONE },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-ballad-texture",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "Listen to two clips: strings, an upright bass and a slow piano line, then the opening of Go Down Moses, an African American spiritual, over the same chords. Listen for what follows each piano note, and for the note the spiritual comes home to.",
        skills: [{ skill: "E07", w: 1 }],
        pickup: PICKUP,
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Strings, upright and piano, in A minor. Listen just after each piano note.",
            bars: 4,
          },
          {
            code: MOSES,
            caption:
              "Go Down Moses, the verse's first line: one note before the first full bar, then four bars.",
            bars: 5,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "dictate",
      title: "Take it down",
      minutes: 2,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "dictation",
        id: "take-it-down",
        version: 1,
        role: "check",
        prompt:
          "Write the hidden opening in the `mel:` line: one note before bar 1, then two bars. The starter already has its rhythm and its first note, 5 below home (`n` −3). Replace each home note (`n` 0) with the note you hear. Any octave passes.",
        skills: [{ skill: "E07", w: 1 }],
        pickup: PICKUP,
        hints: ladder(
          "Hum home, A, then the first note. Is it above home or below, and where does the tune go after it?",
          "The first note is 5 below home. Then the tune leaps up past home to ♭3, me, stays there, and steps down to 2. `n` counts from 0, so ♭3 is `n` 2 and 2 is `n` 1.",
          "Bar 1 is `[2 2 1 1]`: me me re re. Bar 2 starts on me again and ends on home.",
        ),
        domain: "melody",
        stimulus: { src: "code", code: dictation(OPENING), bars: 3, showCode: false },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        answer: { ui: "code", starter: DICTATE_STARTER },
        reference: { solutions: [dictation(OPENING)], bars: 3 },
        matcher: BY_EAR_MATCHER,
        byEar: BY_EAR,
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: this note is not the tune's. Play both from this bar and sing the two notes: higher or lower?",
          "melody.index-shift":
            "Every note is one degree {dir}: the shape is there, the numbers are not. `n` counts from 0, so degree ♭3 is `n` 2.",
        },
        srs: [{ family: "fam.mel.dictation", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: dictation(OPENING) }, expect: "pass" },
          {
            name: "an octave down",
            response: { code: dictation(OPENING, "A3:minor") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: dictation(SKELETON) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the degrees typed as n: one step high throughout",
            response: { code: dictation("<[~ ~ ~ -2] [3 3 2 2] [3 3 1@2]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "me heard as fa",
            response: { code: dictation("<[~ ~ ~ -3] [3 3 1 1] [3 3 0@2]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "bar 1's repeated notes written once each, held",
            response: { code: dictation("<[~ ~ ~ -3] [2@2 1@2] [2 2 0@2]>") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "re left out of bar 1",
            response: { code: dictation("<[~ ~ ~ -3] [2 2 2 2] [2 2 0@2]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "sing",
      title: "Sing from the page",
      minutes: 1.5,
      ui: { panels: LEAD, leadSheet: LEAD_SHEET },
      exercise: {
        kind: "sing",
        id: "sing-from-the-page",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          'Sing the verse\'s second line from the lead sheet, four bars on syllables: "Oppressed so hard they could not stand, let my people go". It starts like the line you took down, without the note before bar 1. A chord sets home and one bar counts you in.',
        skills: [
          { skill: "V04", w: 0.8 },
          { skill: "E07", w: 0.2 },
        ],
        hints: [
          { text: "Hum do, the chord's home note. Is the first note above it or below?" },
          {
            text: "The first note is me, a minor 3rd above do. The answer, bars 3 and 4, drops to sol below do and climbs through ti.",
          },
          { text: "Hear the line once, slower, then sing it from the page.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the degrees from the page instead (contracts §8.5); never gates.
        fallback: "identify",
        // Sight-singing: the tune is shown as a lead sheet and only the cue plays first; Oak plays it after.
        mode: "sight",
        stimulus: { src: "code", code: PAGE, bars: 4, showCode: false, showLeadSheet: true },
        cue: { context: "tonic-chord", countInBars: 1, click: false, replays: -1 },
        target: { from: "stimulus", track: "mel" },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "after",
        srs: [{ family: "fam.mel.sight", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      // U10's "Play from the page" (AUTHORING §4): the target is shown only as a lead sheet, no code and no roll.
      ui: {
        panels: LEAD,
        leadSheet: { melody: "mel", chords: { chart: ANSWER_CHART }, title: "Go Down Moses" },
      },
      example: { id: "the-answer", code: code(mel(ANSWER)), bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        key: HARMONIC,
        prompt:
          'Write the answer shown on the page, "Let my people go", in the `mel:` line: two bars over E and Am. Replace each home note (`n` 0) in the starter with the note on the page; keep the rhythm. Below home, `n` counts down: G♯ is −1, F −2, E −3.',
        skills: [
          { skill: "V04", w: 0.5 },
          { skill: "E07", w: 0.5 },
        ],
        code: { starter: S5_STARTER },
        reference: { solutions: [s5(ANSWER)], bars: 2 },
        matcher: {
          m: "events",
          pitch: "octave-free",
          rhythm: "onsets",
          durations: false,
          tracks: ["mel"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: you have {got}; the page has {exp}. Count down from A on the staff, space, line, space: G♯ is `n` −1, F −2, E −3.",
        },
        hints: ladder(
          "Compare the first note on the page with home, A: above or below? Then follow which way the tune moves after two beats.",
          "Home is A, `n` 0. Below it, `n` counts down the scale: G♯ is −1, F is −2, E is −3. The sharp on the page is the raised 7 of harmonic minor.",
          "Bar 1 starts on E, the 5 below home, so `n` −3. The last note, held for the whole bar, is home.",
        ),
        tests: [
          { name: "reference", response: { code: s5(ANSWER) }, expect: "pass" },
          {
            name: "counted up from home: the same notes an octave higher",
            response: { code: s5("<[4 4 [6 6] ~] [7@4]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: s5(S5_PLACEHOLDER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "G♯ read as F, a line too low",
            response: { code: s5("<[-3 -3 [-2 -2] ~] [0@4]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "E read as G♯, the 5 one step too high",
            response: { code: s5("<[-1 -1 [-1 -1] ~] [0@4]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the pad moved to the tune's chord",
            response: { code: code(pad("<0 0>"), bass("<4 0>"), mel(ANSWER)) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "make",
      title: "A minor ballad",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "a-minor-ballad",
        version: 1,
        role: "practice",
        key: HARMONIC,
        prompt:
          "In the `mel:` line, which only sits on home, rebuild the whole line from your two halves: the opening you took down, then the answer from the page. Keep the starter's rhythm. Then make it a ballad: an echo with `.delay()`, your choice of sounds, a reply if you like.",
        skills: [
          { skill: "E07", w: 0.5 },
          { skill: "V04", w: 0.5 },
        ],
        pickup: PICKUP,
        code: { starter: MAKE_STARTER },
        bars: [5, 9],
        saveAs: "sketch",
        rubric: [
          {
            id: "the-spiritual",
            label: "The tune plays the spiritual's whole line, notes and rhythm, in any octave",
            required: true,
            skills: ["E07"],
            rule: "matches",
            // 0.9: one slip in the fourteen notes passes; the answer sung on te (G) against the E chord's G♯, two
            // notes, does not: the raised 7 is what this unit has been building to.
            min: 0.9,
            reference: { solutions: [MAKE_REFERENCE], bars: 5 },
            matcher: {
              m: "melody",
              pitch: "key-relative",
              wPitch: 0.8,
              wRhythm: 0.2,
              rhythmTol: [1, 16],
              track: "mel",
            },
          },
          {
            id: "an-echo",
            label: "An echo with `.delay()`",
            required: false,
            skills: ["E07"],
            rule: "uses",
            tool: "tb.delay",
          },
          {
            id: "warm-under",
            label: "Strings or a Rhodes plays in the piece",
            required: false,
            skills: ["E07"],
            rule: "sounds",
            anyOf: ["snd.strings", "snd.rhodes"],
          },
          {
            id: "four-parts",
            label: "Four or more parts, such as pad, bass, tune and a reply",
            required: false,
            skills: ["E07"],
            rule: "tracks",
            min: 4,
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "You wrote two halves of the line today: the opening by ear and the answer from the page. Put them in order across the five bars.",
          "Bar 0 holds the pickup, bars 1 and 2 the opening you took down, bars 3 and 4 the answer you read from the page.",
          "The tune starts `<[~ ~ ~ -3] [2 2 1 1] …`. Add the answer's two bars after the opening's.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the line put back, with an echo",
            response: { code: code(pad(ROOTS_PICKUP), bass(ROOTS_PICKUP), mel(GO_DOWN_MOSES, ".delay(.3)")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: Rhodes, an octave down, a reply on strings",
            response: {
              code: code(
                `pad: n("${ROOTS_PICKUP}").add(n("[0,2,4]")).scale("A2:harmonic:minor").s("rhodes").room(.4).gain(.5)`,
                bass(ROOTS_PICKUP),
                'mel: n("<[~ ~ ~ -3] [2 2 1 1] [2 2 0@2] [-3 -3 [-1 -1] ~] [0@4]>").scale("A3:harmonic:minor").s("piano").delay(.4).room(.3)',
                'vox: n("<~ ~ [~ ~ 5 2] ~ [~ ~ 2 0]>").scale("A3:harmonic:minor").s("strings").gain(.5)',
              ),
            },
            expect: "pass",
          },
          {
            name: "one slip: the pickup left out",
            response: {
              code: code(
                pad(ROOTS_PICKUP),
                bass(ROOTS_PICKUP),
                mel("<[~ ~ ~ ~] [2 2 1 1] [2 2 0@2] [-3 -3 [-1 -1] ~] [0@4]>", ".delay(.3)"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the answer on te, not ti: natural minor against the E chord's G sharp",
            response: {
              code: code(
                pad(ROOTS_PICKUP),
                bass(ROOTS_PICKUP),
                mel(GO_DOWN_MOSES, ".delay(.3)").replace(`A4:${H}`, "A4:minor"),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a new tune over the same chords",
            response: {
              code: code(
                pad(ROOTS_PICKUP),
                bass(ROOTS_PICKUP),
                mel("<[~ ~ ~ 0] [2 4 2 0] [5 4 2@2] [6 4 1 4] [0@4]>"),
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
