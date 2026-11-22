// J.CP1 Jazz checkpoint 1 (contracts §7.6; AUTHORING §10), the first checkpoint of the Jazz Harmony track. It
// covers J1 and J2.L01–L03 (`CHECKPOINT_LESSON_EXCEPTIONS`: J2.L04 and its node J03 belong to J.CP2, so this
// checkpoint never waits for U14.CP) and, passed or soft-passed, opens JC1 "ii–V Ballad"; it gates nothing else
// (track checkpoints gate only their track's capstones, §7.6 rule 5). Its file sits in the folder of the last
// unit it covers, as U09.CP and U13.CP do.
//
// The generated items come from the families that give evidence for a gated skill: ii–V–I against other
// progressions and major against minor (J04, J05: `fam.jzz.ii-v`), guide tones (J07, `fam.jzz.guide`, which also
// sets V06's level; its sung items are skipped in Quiet mode and never block), shells by ear (J08,
// `fam.jzz.voicing` level 1) and extensions (J02, `fam.jzz.extension`). J01, C09 and J06 have no family, so the
// authored items measure them, each in a key no lesson used (pre-flight B1: the twelve-key skill on new keys):
// - read-the-chart: four symbols off a jazz chart, each matched to the code that plays it (J01, C09, J02);
// - two-keys-by-name: a ii–V–I in E major and a minor ii–V–i in G minor, written by name (J05, J06);
// - shells-by-hand: a ii–V–I in A♭ comped with hand-written shells whose top notes make the guide-tone thread
//   (J08, J07).
// The Make is a ii–V–I trio of the learner's own in D major over the Band's drums: the progression heard in D is
// the one required rule (J04); a bass on the roots and a second ii–V–I in another key are suggestions.
// Spec: content/specs/J2.md, "J.CP1 Jazz checkpoint 1".
//
// read-the-chart is a choice of three code spellings per symbol, the spec's fallback while `text.jazz-chord` is
// planned: a text answer could not tell a glyph read from a glyph typed back.
//
// The corrections-pass standard (AUTHORING §20.2), on every item and the Make:
// - every required rule checks what is HEARD: the chords' pitch classes and lowest note at every onset (`pcset`
//   with the bass); the shells' written notes read as a shape against the changes (`voicing-shape`) and their top
//   notes moving by a step or less at every change, the turn back to bar 1 included (`voice-leading` on the top
//   voice); the Make's numerals read from the chords that sound, in D;
// - each item pins a WRONG answer that uses the right function: `E7` for the home chord (a dominant where the chart
//   rests), `Am7` for the half-diminished ii, the right shells all stacked root–3rd–7th so the top voice leaps, a
//   `chord().voicing()` line for the shells, the right names in D at `.gain(0)`;
// - each code item passes three other right answers besides its reference.
// Feedback never names the answer: every override describes the sound and the place.
//
// No sung item is authored (contracts §7.6, §8): a learner in Quiet mode passes the same checkpoint. Written for
// the learner at the gate (AUTHORING §20.1): J.CP1 can follow J2.L03 straight after U13.CP, so nothing here needs a
// mode name, a chord-scale, a chromatic degree or U14–U17's sounds.
import {
  type CheckpointDef,
  defineCheckpoint,
  type FactEx,
  type KeySpec,
  type RubricRule,
  type SkillId,
} from "@oak/content-kit";

const BPM = 132;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** J1.L01's swing pocket: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';

// --- read-the-chart -----------------------------------------------------------------------------------------

/** One symbol off the chart, three code spellings; a part of the one graded item. */
const symbolPart = (
  id: string,
  symbol: string,
  skill: SkillId,
  options: string[],
  correct: string,
  wrong: string,
): FactEx => ({
  kind: "fact",
  id,
  version: 1,
  role: "checkpoint",
  prompt: `${symbol} on the chart: which code plays it?`,
  skills: [{ skill, w: 1 }],
  hints: null,
  answer: { ui: "choice", options: options.map((o) => ({ id: o, label: o })) },
  correct: { choice: [correct] },
  spelling: "strict",
  order: "set",
  feedbackText: { "id.wrong": wrong },
  tests: [
    { name: correct, response: { answer: { choice: [correct] } }, expect: "pass" },
    ...options
      .filter((o) => o !== correct)
      .map((o) => ({
        name: `read as ${o}`,
        response: { answer: { choice: [o] } },
        expect: "fail" as const,
        feedback: ["id.wrong" as const],
      })),
  ],
});

// --- two-keys-by-name ---------------------------------------------------------------------------------------

/** The chart's comping, the Charleston on the Rhodes, and the bass on each chord's root, both read from `changes`. */
const CHART_LINES = [
  'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")',
  'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")',
];
const chart = (first: string, second: string) =>
  code(`const changes = "<${first} ${second}>"`, "", RIDE, HATS, ...CHART_LINES);
const KEYS_STARTER = code(
  'const changes = "<⟪Dm7 G7 C^7 C^7⟫ ⟪Dm7 G7 C^7 C^7⟫>"',
  "",
  RIDE,
  HATS,
  ...CHART_LINES,
);
const E_MAJOR = "F#m7 B7 E^7 E^7";
const G_MINOR = "Am7b5 D7b9 Gm7 Gm7";
const KEYS_SOLUTION = chart(E_MAJOR, G_MINOR);

// --- shells-by-hand -----------------------------------------------------------------------------------------

/** A two-feel bass under B♭m7 E♭7 A♭maj7 A♭maj7: root and 5th; the last bar ends on C, a step above the B♭ that starts bar 1. */
const SHELL_BASS = 'bass: note("<[bb1 f2] [eb2 bb1] [ab1 eb2] [ab1 c2]>").s("upright")';
const shellChords = (voicings: string, tail = "") =>
  `chords: note("<${voicings}>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")${tail}`;
const comp = (chordsLine: string) => code(RIDE, HATS, SHELL_BASS, chordsLine);
const SHELL_STARTER = comp(
  'chords: note("<⟪[bb2,db3,f3] [eb2,g2,bb2] [ab2,c3,eb3] [ab2,c3,eb3]⟫>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")',
);
/**
 * Root, then the 3rd and the 7th in the order that keeps the top voice moving least: B♭ D♭ A♭ | E♭ D♭ G | A♭ C G.
 * The top notes, A♭ G G G, are the guide-tone thread (the 7th of B♭m7 falls to the 3rd of E♭7, which holds as the
 * 7th of A♭maj7), with D♭ D♭ C under them.
 */
const SHELLS = "[bb2,db3,ab3] [eb2,db3,g3] [ab2,c3,g3] [ab2,c3,g3]";
const SHELL_SOLUTION = comp(shellChords(SHELLS));
const SHELL_RULES: RubricRule[] = [
  {
    id: "shells",
    label: "Every chord is a shell: the root at the bottom, the 3rd and the 7th above it, nothing else",
    required: true,
    skills: ["J08"],
    rule: "custom",
    fn: "voicing-shape",
    params: { track: "chords", shape: ["shell"], changes: ["Bbm7", "Eb7", "Ab^7", "Ab^7"], minRatio: 1 },
  },
  {
    id: "thread",
    label: "At every change, the turn back to bar 1 included, the top note moves a whole step or less",
    required: true,
    skills: ["J07"],
    rule: "voice-leading",
    track: "chords",
    voice: "top",
    maxMovePerVoice: 2,
    minRatio: 1,
    loop: true,
  },
];

// --- the Make -----------------------------------------------------------------------------------------------

const D_MAJOR: KeySpec = { tonic: "D", mode: "major" };
/** The trio as J1 left it, in C: the changes, the comping and a bass on the roots, all read from `changes`. */
const trio = (changes: string, tail = "", ...more: string[]) =>
  code(
    `const changes = "<${changes}>"`,
    "",
    `chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")${tail}`,
    'bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")',
    ...more,
  );
const MAKE_STARTER = trio("Dm7 G7 C^7 C^7");
const MAKE_MINIMAL = trio("Em7 A7 D^7 D^7");
/**
 * Beyond the brief: eight bars, D then a step down to C (Em7 A7 D∆7 D∆7 | Dm7 G7 C∆7 C∆7), shells by hand (the top
 * voice D C♯ C♯ C♯ | C B B B), a two-feel bass, and a vibes line whose notes on the beat are chord tones.
 */
const MAKE_RICH = code(
  'chords: note("<[e3,g3,d4] [a2,g3,c#4] [d3,f#3,c#4] [d3,f#3,c#4] [d3,f3,c4] [g2,f3,b3] [c3,e3,b3] [c3,e3,b3]>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")',
  'bass: note("<[e2 b1] [a1 e2] [d2 a1] [d2 f#2] [d2 a1] [g1 d2] [c2 g1] [c2 e2]>").s("upright")',
  'mel: note("<[b4 ~ g4 ~] [a4 e4 c#5 ~] [d5 ~ a4 ~] [f#4 ~ ~ ~] [a4 ~ f4 ~] [g4 d4 b4 ~] [c5 ~ g4 ~] [e4 ~ ~ ~]>").swingBy(1/3, 4).s("vibes")',
);
const TWO_FIVE_ONE_IN_D: RubricRule = {
  id: "two-five-one-in-d",
  label: "Your chords play ii7, V7 and Imaj7 of D major, in that order",
  required: true,
  skills: ["J04"],
  rule: "contains-rn",
  rn: ["ii7", "V7", "Imaj7"],
  inOrder: true,
  min: 1,
};

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "J.CP1",
  title: "Jazz checkpoint 1",
  covers: ["J1", "J2"],
  gated: ["J01", "J02", "J04", "J05", "J06", "J07", "J08", "C09"],
  levelSetting: ["V06"],
  version: 2,
  authored: [
    {
      kind: "all",
      id: "read-the-chart",
      version: 1,
      role: "checkpoint",
      prompt: "For each of the four jazz chart symbols, pick the code that plays it.",
      skills: [
        { skill: "J01", w: 0.4 },
        { skill: "C09", w: 0.3 },
        { skill: "J02", w: 0.3 },
      ],
      hints: null,
      tests: [],
      parts: [
        symbolPart(
          "e-dash-seven",
          "E–7",
          "J01",
          ["E^7", "Em7", "E7"],
          "Em7",
          "Not yet. Read the dash first: it says what kind of triad sits under the 7.",
        ),
        symbolPart(
          "a-flat-six",
          "A♭6",
          "C09",
          ["Ab6", "Ab^7", "Abm6"],
          "Ab6",
          "Not yet. A number on its own after the letter adds that note to a major triad; nothing in this symbol makes it minor.",
        ),
        symbolPart(
          "d-seven-sus",
          "D7sus",
          "C09",
          ["D7", "D7sus", "Dsus"],
          "D7sus",
          "Not yet. The symbol asks for two things at once: the 7th on top, and the note that floats in place of the 3rd.",
        ),
        symbolPart(
          "g-seven-flat-nine",
          "G7♭9",
          "J02",
          ["G7", "G7#9", "G7b9"],
          "G7b9",
          "Not yet. The 9 is altered here: check which way the sign before it moves it.",
        ),
      ],
    },
    {
      kind: "code-modify",
      id: "two-keys-by-name",
      version: 1,
      role: "checkpoint",
      key: { tonic: "E", mode: "major" },
      prompt:
        "Rewrite the eight-bar chart in `changes`, still in C, by name. Bars 1–4: the ii–V–I of E major. Bars 5–8: the minor ii–V–i of G minor, with a half-diminished ii and a dominant with a flat 9. One chord a bar; the home chord fills two bars in each half.",
      skills: [
        { skill: "J05", w: 0.5 },
        { skill: "J06", w: 0.5 },
      ],
      hints: null,
      code: { starter: KEYS_STARTER },
      // The minor home may be any minor tonic J2.L02 offers (Dm7, Dm6, Dm(maj7)): graded against the closest.
      reference: {
        solutions: [
          KEYS_SOLUTION,
          chart(E_MAJOR, "Am7b5 D7b9 Gm6 Gm6"),
          chart(E_MAJOR, "Am7b5 D7b9 Gm^7 Gm^7"),
        ],
        bars: 8,
      },
      matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "harmony.pcset":
          "Not yet: some bars do not sound like the target. Listen to each half on its own: does the first land on a major home chord a 4th below its V, and does the second land on a minor one?",
        "harmony.shifted":
          "Not yet: the chords sound in a different place from the target's. Keep one chord a bar, the home chord held for two.",
      },
      tests: [
        { name: "reference", response: { code: KEYS_SOLUTION }, expect: "pass" },
        {
          name: "the home chords with `!2`",
          response: { code: chart("F#m7 B7 E^7!2", "Am7b5 D7b9 Gm7!2") },
          expect: "pass",
        },
        {
          name: "spelt with flats: G♭–7 and C♭7",
          response: { code: chart("Gbm7 Cb7 E^7 E^7", G_MINOR) },
          expect: "pass",
        },
        {
          name: "the home chords stretched with `@2`",
          response: { code: chart("F#m7 B7 E^7@2", "Am7b5 D7b9 Gm7@2") },
          expect: "pass",
        },
        {
          name: "the minor home as Gm6, as J2.L02 allows",
          response: { code: chart(E_MAJOR, "Am7b5 D7b9 Gm6 Gm6") },
          expect: "pass",
        },
        {
          name: "the minor home as a bare triad: the seventh lost",
          response: { code: chart(E_MAJOR, "Am7b5 D7b9 Gm Gm") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "unchanged",
          response: { code: plain(KEYS_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right chord names, a dominant at home: E7 for E∆7",
          response: { code: chart("F#m7 B7 E7 E7", G_MINOR) },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "the minor ii as a minor seventh: Am7 for Aø7",
          response: { code: chart(E_MAJOR, "Am7 D7b9 Gm7 Gm7") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "the E major half left in C",
          response: { code: chart("Dm7 G7 C^7 C^7", G_MINOR) },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "shells-by-hand",
      version: 1,
      role: "checkpoint",
      key: { tonic: "Ab", mode: "major" },
      prompt:
        "Replace the Rhodes' plain triads with shells you write as note names, for the ii–V–I in A♭: B♭m7, E♭7, A♭maj7. Each chord: the root at the bottom, its 3rd and 7th above. Order the 3rd and 7th so the top note moves a step or less from the chord before.",
      skills: [
        { skill: "J08", w: 0.6 },
        { skill: "J07", w: 0.4 },
      ],
      hints: null,
      code: { starter: SHELL_STARTER },
      reference: { solutions: [SHELL_SOLUTION], bars: 4 },
      matcher: { m: "rubric", rules: SHELL_RULES },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "rubric.unmet":
          "{label}: not yet. In the target each chord is three notes, the root far below, and the highest of them hardly moves from chord to chord: you could sing it.",
      },
      tests: [
        { name: "reference", response: { code: SHELL_SOLUTION }, expect: "pass" },
        {
          name: "the 7th under the 3rd first: the thread one note higher",
          response: { code: comp(shellChords("[bb2,ab3,db4] [eb3,g3,db4] [ab2,g3,c4] [ab2,g3,c4]")) },
          expect: "pass",
        },
        {
          name: "the roots an octave lower",
          response: { code: comp(shellChords("[bb1,db3,ab3] [eb2,db3,g3] [ab1,c3,g3] [ab1,c3,g3]")) },
          expect: "pass",
        },
        {
          name: "the last bar's root dropped an octave",
          response: { code: comp(shellChords("[bb2,db3,ab3] [eb2,db3,g3] [ab2,c3,g3] [ab1,c3,g3]")) },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(SHELL_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right shells, all root–3rd–7th: the top voice leaps",
          response: { code: comp(shellChords("[bb2,db3,ab3] [eb2,g2,db3] [ab2,c3,g3] [ab2,c3,g3]")) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the 5th in place of the 7th",
          response: { code: comp(shellChords("[bb2,db3,f3] [eb2,db3,g3] [ab2,c3,g3] [ab2,c3,g3]")) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the right chords from the dictionary, not by hand",
          response: {
            code: comp(
              'chords: chord("<Bbm7 Eb7 Ab^7 Ab^7>").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")',
            ),
          },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
  ],
  recipe: {
    items: [16, 18],
    perSkillMin: 2,
    families: {
      J04: ["fam.jzz.ii-v"],
      J05: ["fam.jzz.ii-v"],
      J07: ["fam.jzz.guide"],
      J08: ["fam.jzz.voicing"],
      J02: ["fam.jzz.extension"],
      V06: ["fam.jzz.guide"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-trio-in-d",
    version: 1,
    role: "checkpoint",
    title: "A trio in D",
    prompt:
      "Write your own trio in D major over the band's drums: four or eight bars. Required: a ii–V–I in D major in your chords. Also on the checklist: the bass on each chord's root, and a second ii–V–I in another key. Voice the chords as you like. The starter is still in C.",
    skills: [{ skill: "J04", w: 1 }],
    hints: null,
    key: D_MAJOR,
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [4, 8],
    saveAs: "sketch",
    rubric: [
      TWO_FIVE_ONE_IN_D,
      {
        id: "bass-on-roots",
        label: "At most chord changes, the bass plays the new chord's root",
        required: false,
        skills: ["J04"],
        rule: "bass-line",
        track: "bass",
        harmony: "chords",
        roots: { on: "change", minRatio: 0.75 },
      },
      {
        id: "another-key",
        label: "Four bars of chords come back moved to another key",
        required: false,
        skills: ["J05"],
        rule: "custom",
        fn: "transposed-copy",
        params: { track: "chords", unitBars: 4 },
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: the trio still in C",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      { name: "minimal: the chords named in D", response: { code: MAKE_MINIMAL }, expect: "pass" },
      {
        name: "beyond the brief: shells, a two-feel, a vibes line and a second key",
        response: { code: MAKE_RICH },
        expect: "pass",
      },
      {
        name: "the left hand, with the ride of J1.L01",
        response: {
          code: code(
            'const changes = "<Em7 A7 D^7 D^7>"',
            "",
            'chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("piano")',
            'bass: chord(changes).rootNotes(2).s("upright")',
            RIDE,
          ),
        },
        expect: "pass",
      },
      {
        name: "eight bars, the ii–V–I and a turnaround back to it",
        response: { code: trio("Em7 A7 D^7 D^7 Bm7 E7 Em7 A7") },
        expect: "pass",
      },
      {
        name: "the right names in D, the chords at gain 0 over a bass by hand: no chord heard",
        response: {
          code: code(
            'const changes = "<Em7 A7 D^7 D^7>"',
            "",
            'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(0)',
            'bass: note("<e2 a1 d2 d2>").s("upright")',
          ),
        },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "a ii–V–I, but in G",
        response: { code: trio("Am7 D7 G^7 G^7") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "D major's chords without the V: Em7 Bm7 D∆7",
        response: { code: trio("Em7 Bm7 D^7 D^7") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
