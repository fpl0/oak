// U09.CP Bass & form checkpoint (contracts §7.6; AUTHORING §10). It covers U08 (bass lines) and U09 (form).
// Every skill in range is a concept or creative skill (no bracketed skills in the map), so every item gates; no
// sing or tap item. The generated items come from the groove-lock family (B04, levels 1–2) and the sections
// family (F02, F03: AABA against verse–chorus, four- or eight-bar phrases). The code skills have no family, so
// the authored items measure them:
// - bass-into-the-changes: under C Am F G, a bass that sits on C turns into a line with each root on beat 1, a
//   5th or an octave in the bar and approach notes into the changes (B01, B02, B03), graded with the `bass-line`
//   rule, so any line that does those three things passes, not one fixed answer;
// - arrange-and-enter: the section consts of a song are written; the bass and the tune are arranged intro,
//   verse, chorus, verse, chorus like the chords, and the bass comes in at bar 2 of the intro with `.mask()`
//   (F02, F06);
// - lock-it: the bass takes the kick's rhythm from its `const` (B04).
// The Make is a verse and a chorus of the learner's own drums and bass, arranged verse chorus verse chorus over
// the Band's keys, which follow the learner's sections (`band.sections`, content/checkpoints.ts): the chorus
// must lift (F05, `contrast`), with suggestions for the kick lock (B04) and the form (F02).
// Spec: content/specs/U09.md, "U09.CP Bass & form checkpoint".
//
// Departures from the spec:
// - bass-into-the-changes is graded by the `bass-line` rule the spec names (now implemented), split into four
//   required rules so the learner reads which part is missing: roots on every change (B01); only roots, 5ths,
//   octaves and approach notes (B02); a 5th or an octave in a quarter of the notes or more, which with three
//   notes a bar is "most bars" (B02); approach notes into three of the four changes (B03). The spec asks for
//   two, but over I vi IV V a bass on roots alone already scores two: the rule counts C before A (a 3rd that
//   is a step in the key) and F before G. The spec's fallback (a fixed bass read from the staff) is not
//   needed.
// - lock-it uses a rhythm the learner has not met in U08.L04 (1, the "and" of 2, the "and" of 3).
//
// Checked at its place in the default order, after U10.L01: every U08–U09 tool and word is the learner's.
import { type CheckpointDef, defineCheckpoint, type Matcher, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

// --- bass-into-the-changes ----------------------------------------------------------------------------

/** I vi IV V (C Am F G), one chord a bar: the doo-wop order of U08. */
const CHORDS = 'chords: chord("<C Am F G>").voicing().s("piano").gain(.6)';
/** A bass in note names (approach notes may lie outside the key), as U08.L03 writes it. */
const bass = (notes: string) => `bass: note("${notes}").s("ebass").lpf(600)`;
const changes = (notes: string) => code(CHORDS, bass(notes));
/** The starter: C on beats 1 and 3 of every bar, under every chord. */
const ON_C = "<[c2 ~ c2 ~] [c2 ~ c2 ~] [c2 ~ c2 ~] [c2 ~ c2 ~]>";
/**
 * The root for two beats, the 5th or the octave on beat 3, an approach on beat 4: C2 G2 B1 | A1 A2 E2 |
 * F2 C3 F♯2 | G2 D3 B1. B1 leads into A1 from the step above, E2 into F2 and B1 into C2 from the half step below
 * in the key, F♯2 into G2 from the half step below outside it.
 */
const WALKED = "<[c2@2 g2 b1] [a1@2 a2 e2] [f2@2 c3 f#2] [g2@2 d3 b1]>";
const BASS_RULE = { rule: "bass-line", track: "bass", harmony: "chords" } as const;
const BASS_RULES: RubricRule[] = [
  {
    id: "roots",
    label: "Each chord's root in the bass on beat 1 of its bar, in all four bars",
    required: true,
    skills: ["B01"],
    ...BASS_RULE,
    roots: { on: "change", minRatio: 1 },
  },
  {
    id: "members",
    label: "At least 9 in 10 bass notes are roots, 5ths, octaves or approach tones",
    required: true,
    skills: ["B02"],
    ...BASS_RULE,
    members: { allowed: ["root", "fifth", "octave", "approach"], minRatio: 0.9 },
  },
  {
    id: "fifths",
    label: "At least a quarter of the bass notes are 5ths or octaves",
    required: true,
    skills: ["B02"],
    ...BASS_RULE,
    members: { allowed: ["fifth", "octave"], minRatio: 0.25 },
  },
  {
    id: "approach",
    label: "An approach tone just before three of the four chord changes or more",
    required: true,
    skills: ["B03"],
    ...BASS_RULE,
    approach: { min: 3 },
  },
];

// --- arrange-and-enter --------------------------------------------------------------------------------

/** The doo-wop loop in the intro and the verse; the chorus starts away from home, IV V I I (U09.L02). */
const LOOP = 'chord("<C Am F G>").voicing()';
const CHORDS_CONSTS = [
  `const chordsIntro = ${LOOP}`,
  `const chordsVerse = ${LOOP}`,
  'const chordsChorus = chord("<F G C C>").voicing()',
];
const ROOTS = 'n("<0 5 3 4>").scale("C2:major")';
const bassIntro = (mask: string) => `const bassIntro = ${ROOTS}${mask}`;
const BASS_CONSTS = [`const bassVerse = ${ROOTS}`, 'const bassChorus = n("<3 4 0 0>").scale("C2:major")'];
/** The tune's lead-in, G A on beats 3 and 4 of the intro's last bar, then U09.L05's verse and chorus tunes. */
const MEL_CONSTS = [
  'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
  'const melVerse = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
  'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")',
];
const DRUMS = 'drums: s("bd ~ sd ~, hh*8").gain(.7)';
const FORM = ["Intro", "Verse", "Chorus", "Verse", "Chorus"];
const arranged = (role: string, order = FORM) =>
  `arrange(${order.map((s) => `[4, ${role}${s}]`).join(", ")})`;
const CHORDS_LINE = `chords: ${arranged("chords")}.s("piano").gain(.6)`;
/** The song: the consts, the drums, then one line per pitched part. */
const song = (bassConst: string, bassLine: string, melLine: string) =>
  `${TEMPO}${[...CHORDS_CONSTS, bassConst, ...BASS_CONSTS, ...MEL_CONSTS].join("\n")}\n\n${[
    DRUMS,
    CHORDS_LINE,
    `bass: ${bassLine}.s("ebass").lpf(600)`,
    `mel: ${melLine}.s("piano")`,
  ].join("\n")}`;
const ENTER = '.mask("<0 1 1 1>")';
const ARRANGED = song(bassIntro(ENTER), arranged("bass"), arranged("mel"));
const ARRANGE_STARTER = `${TEMPO}${[
  ...CHORDS_CONSTS,
  `const bassIntro = ${ROOTS}⟪⟫`,
  ...BASS_CONSTS,
  ...MEL_CONSTS,
].join("\n")}\n\n${[
  DRUMS,
  CHORDS_LINE,
  'bass: ⟪bassVerse⟫.s("ebass").lpf(600)',
  'mel: ⟪melVerse⟫.s("piano")',
].join("\n")}`;
/** The bass in degrees whatever its octave; the tune as written. */
const ARRANGE_MATCHER: Matcher = {
  m: "all",
  of: [
    {
      m: "events",
      pitch: "octave-free",
      rhythm: "onsets",
      durations: false,
      tracks: ["bass"],
    },
    { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
  ],
};

// --- lock-it ------------------------------------------------------------------------------------------

/** The kick's rhythm: beat 1, the "and" of 2, the "and" of 3 (eighths 1, 4 and 6 of the bar). */
const HITS = "x ~ ~ x ~ x ~ ~";
const lock = (struct: string) =>
  `${TEMPO}const hits = "${HITS}"\n\n${[
    'kick: s("bd").struct(hits)',
    'snare: s("~ sd ~ sd")',
    'hats: s("hh*8").gain(.5)',
    'chords: chord("<C Am F G>").voicing().s("piano").gain(.5)',
    `bass: n("<0 5 3 4>").struct(${struct}).scale("C2:major").s("ebass").lpf(600)`,
  ].join("\n")}`;
const LOCK_STARTER = lock('⟪"x x x x"⟫');
const LOCKED = lock("hits");
/** Only the bass's rhythm is graded: its notes are given. */
const BASS_RHYTHM: Matcher = {
  m: "rhythm",
  tol: [1, 32],
  durations: false,
  perRole: false,
  displacementCredit: 0.5,
  tracks: ["bass"],
};

// --- the Make -----------------------------------------------------------------------------------------

/**
 * The Make's song: the learner's drums and bass in two sections, verse and chorus, arranged verse chorus verse
 * chorus. The Band plays the keys and follows these sections: C Am F G under the verse, F G C C under the chorus.
 */
const make = (
  drumsVerse: string,
  drumsChorus: string,
  bassVerse: string,
  bassChorus: string,
  ...extra: string[]
) =>
  `${TEMPO}${[
    `const drumsVerse = s("${drumsVerse}")`,
    `const drumsChorus = s("${drumsChorus}")`,
    `const bassVerse = ${bassVerse}`,
    `const bassChorus = ${bassChorus}`,
    ...extra.filter((x) => x.startsWith("const ")),
  ].join("\n")}\n\n${[
    `drums: ${arranged("drums", ["Verse", "Chorus", "Verse", "Chorus"])}`,
    `bass: ${arranged("bass", ["Verse", "Chorus", "Verse", "Chorus"])}.s("ebass").lpf(600)`,
    ...extra.filter((x) => !x.startsWith("const ")),
  ].join("\n")}`;
const VERSE_GROOVE = "bd ~ sd ~, hh*8";
const VERSE_ROOTS = 'n("<0 5 3 4>").scale("C2:major")';
const CHORUS_ROOTS = 'n("<3 4 0 0>").scale("C2:major")';
const MAKE_STARTER = make(VERSE_GROOVE, VERSE_GROOVE, VERSE_ROOTS, CHORUS_ROOTS);

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U09.CP",
  title: "Bass & form checkpoint",
  covers: ["U08", "U09"],
  gated: ["B01", "B02", "B03", "B04", "F02", "F03", "F05", "F06"],
  levelSetting: [],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "bass-into-the-changes",
      version: 1,
      role: "checkpoint",
      prompt:
        "The bass sits on C under C Am F G, one chord a bar. Rewrite the highlighted bass using only roots, 5ths, octaves and approach tones: each chord's root on beat 1, a 5th or an octave in most bars, and an approach tone just before at least three of the four chord changes.",
      skills: [
        { skill: "B01", w: 0.35 },
        { skill: "B02", w: 0.35 },
        { skill: "B03", w: 0.3 },
      ],
      hints: null,
      code: { starter: changes(`⟪${ON_C}⟫`) },
      reference: { solutions: [changes(WALKED)], bars: 4 },
      matcher: { m: "rubric", rules: BASS_RULES },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false },
      feedbackText: { "rubric.unmet": "{label}: not yet." },
      tests: [
        { name: "reference", response: { code: changes(WALKED) }, expect: "pass" },
        {
          name: "octaves, and approaches from above and below on beat 4",
          response: { code: changes("<[c2 ~ c3 b1] [a1 ~ e2 g1] [f1 ~ c2 f#1] [g1 ~ g2 b1]>") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: changes(ON_C) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the 3rd on beat 3 instead of the 5th",
          response: { code: changes("<[c2@2 e2 b1] [a1@2 c2 e2] [f2@2 a2 f#2] [g2@2 b2 b1]>") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "roots and octaves, beat 4 back on the root",
          response: { code: changes("<[c2@2 c3 c2] [a1@2 a2 a1] [f1@2 f2 f1] [g1@2 g2 g1]>") },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the chords changed to fit the bass",
          response: {
            code: code('chords: chord("<C C C C>").voicing().s("piano").gain(.6)', bass(WALKED)),
          },
          expect: "fail",
          feedback: ["code.edit-outside"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "arrange-and-enter",
      version: 1,
      role: "checkpoint",
      prompt:
        "The chords play intro, verse, chorus, verse, chorus, four bars each. Replace the highlighted `bassVerse` and `melVerse` with an `arrange()` each, in the same order. Then add a `.mask()` at the highlighted end of `bassIntro` so the bass is silent in bar 1 of the intro and plays from bar 2.",
      skills: [
        { skill: "F02", w: 0.5 },
        { skill: "F06", w: 0.5 },
      ],
      hints: null,
      code: { starter: ARRANGE_STARTER },
      reference: { solutions: [ARRANGED], bars: 20 },
      matcher: ARRANGE_MATCHER,
      constraints: [
        { c: "edit-only-regions", feedback: "code.edit-outside" },
        { c: "must-use", tool: "tb.mask", feedback: "code.must-use" },
      ],
      target: { audible: true, showRoll: false },
      feedbackText: {
        "melody.wrong-degree":
          "Bar {bar}: a different note from the song's. Check the order and the lengths of your sections against the chords line.",
      },
      tests: [
        { name: "reference", response: { code: ARRANGED }, expect: "pass" },
        {
          name: "the entry written with a repeat",
          response: {
            code: song(bassIntro('.mask("<0 1!3>")'), arranged("bass"), arranged("mel")),
          },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: song(bassIntro(""), "bassVerse", "melVerse") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "arranged, but the bass plays from bar 1",
          response: { code: song(bassIntro(""), arranged("bass"), arranged("mel")) },
          expect: "fail",
          feedback: ["code.must-use"],
        },
        {
          name: "the second verse and chorus swapped",
          response: {
            code: song(
              bassIntro(ENTER),
              arranged("bass", ["Intro", "Verse", "Chorus", "Chorus", "Verse"]),
              arranged("mel", ["Intro", "Verse", "Chorus", "Chorus", "Verse"]),
            ),
          },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "lock-it",
      version: 1,
      role: "checkpoint",
      prompt:
        "The kick plays the rhythm named `hits`; the bass plays on every beat and rubs against it. Change the highlighted rhythm in the bass's `.struct()` so the bass plays the kick's rhythm. Done when every bass note starts with a kick.",
      skills: [{ skill: "B04", w: 1 }],
      hints: null,
      code: { starter: LOCK_STARTER },
      reference: { solutions: [LOCKED], bars: 4 },
      matcher: BASS_RHYTHM,
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: LOCKED }, expect: "pass" },
        {
          name: "the rhythm written out instead of named",
          response: { code: lock(`"${HITS}"`) },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: lock('"x x x x"') },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the snare's rhythm",
          response: { code: lock('"~ x ~ x"') },
          expect: "fail",
          feedback: ["rhythm.missing"],
        },
        {
          name: "the kick's hits an eighth late",
          response: { code: lock('"~ x ~ ~ x ~ x ~"') },
          expect: "fail",
          feedback: ["rhythm.displaced"],
        },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      B04: ["fam.rhy.groove-lock"],
      F02: ["fam.frm.sections"],
      F03: ["fam.frm.sections"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-verse-chorus",
    version: 1,
    role: "checkpoint",
    title: "Verse and chorus",
    prompt:
      "The chorus copies the verse's groove. Change `drumsChorus` or `bassChorus` so the chorus has more energy, more notes or higher notes than the verse. Keep the sections four bars each, arranged verse, chorus, verse, chorus; the band's keys follow them. For more, put the bass on the kick.",
    skills: [{ skill: "F05", w: 1 }],
    hints: null,
    key: { tonic: "C", mode: "major" },
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [8, 16],
    saveAs: "sketch",
    rubric: [
      {
        id: "lift",
        label: "The chorus has more energy, more notes or higher notes than the verse",
        required: true,
        skills: ["F05"],
        rule: "contrast",
        a: { section: "chorus" },
        b: { section: "verse" },
        axes: ["energy", "density", "register"],
        minAxes: 1,
      },
      {
        id: "lock",
        label: "At least half the bass notes start with a kick",
        required: false,
        skills: ["B04"],
        rule: "groove-lock",
        kick: "@drums",
        bass: "@bass",
        min: 0.5,
      },
      {
        id: "form",
        label: "The sections play verse, chorus, verse, chorus",
        required: false,
        skills: ["F02"],
        rule: "form",
        pattern: "verse chorus verse chorus",
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: the chorus grooves like the verse",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: sixteenth hats in the chorus",
        response: { code: make(VERSE_GROOVE, "bd ~ sd ~, hh*16", VERSE_ROOTS, CHORUS_ROOTS) },
        expect: "pass",
      },
      {
        name: "beyond the brief: the bass on the kick, a pushing chorus and a tune",
        response: {
          code: make(
            "bd ~ sd ~, hh*8",
            "bd [~ bd] sd [~ bd], hh*16",
            VERSE_ROOTS,
            'n("<[3 [~ 3] ~ [~ 3]] [4 [~ 4] ~ [~ 4]] [0 [~ 0] ~ [~ 0]] [0 [~ 0] ~ [~ 0]]>").scale("C2:major")',
            'const melVerse = n("<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major")',
            'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")',
            'mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus]).s("piano")',
          ),
        },
        expect: "pass",
      },
      {
        name: "the chorus only changes its snare sound",
        response: { code: make(VERSE_GROOVE, "bd ~ cp ~, hh*8", VERSE_ROOTS, CHORUS_ROOTS) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
