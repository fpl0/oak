// U17.CP Chromatic checkpoint (contracts §7.6; AUTHORING §10), the last checkpoint of the core. It covers U15, U16
// and U17 (U15 and U16 have no checkpoint of their own). Passed or soft-passed, it opens C7 and J5 (gate
// `J.reharmonization`). The generated items come from `fam.har.chromatic` at the learner's level (which bar holds
// the chord from outside the key, applied or borrowed): it measures H12 and, as level-setting, E12b. Chromatic
// degrees in context (E12a, `fam.deg.fet-chromatic`) and hearing a key change (E13, `fam.har.modulation`) are
// level-setting re-tests that never block. H13 and H14 have no drill family, so the authored items measure them,
// each in a key the lessons did not drill it in:
// - name-the-colours: eight bars in G read from their chord names, numbered: a secondary dominant with its
//   target, and three chords borrowed from G minor (H12, H13);
// - lift-the-last-chorus: a song in G in three sections whose last chorus is lifted a whole step, to A: two key
//   plans after `arrange()` and four new chord names (H14);
// - two-names-one-chord: the pivot of a move from F to C, named in both keys (H14).
// The Make is a song of the learner's own in sections over the Band's drums: a last chorus that lifts a whole
// step is the one required rule (H14); a colour chord chosen on purpose, applied or borrowed, and the same tune a
// step higher are suggestions.
// Spec: content/specs/U17.md, "U17.CP Chromatic checkpoint".
//
// Every authored item and the required rule are implemented shapes: `rn-palette` with `secondary` and `borrowed`,
// `slotKeys` (rn-palette.slot-keys), `events` in absolute pitch, `key-change` on the last section (+2, four bars or
// more: the last chorus is a whole step above the chorus before it, on every line; corrections pass: `in-key` on
// the last section alone passed a song in A, or on one chord, from the first bar). The suggestions use
// `contains-rn` with `kind` and `key-change` with `sameMelody` (verified: the lift alone ticks neither colour
// line, and chord names left in G do not count as the same tune a step higher). A colour chord is never needed to
// pass, and a song with one but no lift does not.
//
// No sung item is gated (contracts §7.6, §8): a learner in Quiet mode passes the same checkpoint. Checked at its
// place in the default order (session 177, after U17.L04 and GYM.16): every U15–U17 tool and word is the learner's.
import { type CheckpointDef, defineCheckpoint, type KeySpec, type Matcher } from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const G_MAJOR: KeySpec = { tonic: "G", mode: "major" };

// --- name-the-colours ---------------------------------------------------------------------------------------

/**
 * I V7/ii ii iv | I ♭VI ♭VII I in G: E7 leans into Am (its G♯ is the leading note of A); Cm, E♭ and F come from
 * G minor (B♭, E♭ and F are G minor's own notes).
 */
const COLOURS = code(
  'const changes = "<G E7 Am Cm G Eb F G>"\n',
  'bass: chord(changes).rootNotes(2).s("upright")',
  'chords: chord(changes).voicing().s("rhodes")',
);
const COLOURS_RN = ["I", "V7/ii", "ii", "iv", "I", "bVI", "bVII", "I"];

/** Known wrong for the Make: twelve bars on one chord and one note that never change key (corrections pass). */
const NO_LIFT_SONG = (chordName: string, note: string) =>
  code(
    `const chordsVerse = chord("${chordName}").voicing()`,
    "const chordsChorus = chordsVerse",
    `const bassVerse = note("${note}2")`,
    "const bassChorus = bassVerse",
    `const melVerse = note("${note}4")`,
    "const melChorus = melVerse",
    "",
    'chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsChorus]).s("piano")',
    'bass: arrange([4, bassVerse], [4, bassChorus], [4, bassChorus]).s("ebass")',
    'mel: arrange([4, melVerse], [4, melChorus], [4, melChorus]).s("piano")',
  );

// --- lift-the-last-chorus -----------------------------------------------------------------------------------

/** U17.L02's tunes: the verse low and close (B B A | G | C C B | A in G), the chorus a 5th higher. */
const VERSE_TUNE = "<[2 ~ 2 1] [0 ~ ~ ~] [3 ~ 3 2] [1 ~ ~ ~]>";
const CHORUS_TUNE = "<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>";
/** One `arrange()` per track: verse, chorus, chorus, four bars each (12 bars). */
const vcc = (role: string, last = `${role}Chorus`) =>
  `arrange([4, ${role}Verse], [4, ${role}Chorus], [4, ${last}])`;
/** Verse G Em C D, chorus G D Em C (I vi IV V, I V vi IV); `chordsChorus2` is the last chorus. */
const song = (lifted: string, bassScale: string, melScale: string) =>
  `${TEMPO}${[
    'const chordsVerse = chord("<G Em C D>").voicing().struct("x ~ x ~")',
    'const chordsChorus = chord("<G D Em C>").voicing().struct("x*4")',
    `const chordsChorus2 = chord("<${lifted}>").voicing().struct("x*4")`,
    'const bassVerse = n("<0 5 3 4>").struct("x ~ ~ x")',
    'const bassChorus = n("<0 4 5 3>").struct("x ~ x x")',
    `const melVerse = n("${VERSE_TUNE}")`,
    `const melChorus = n("${CHORUS_TUNE}")`,
  ].join("\n")}\n\n${[
    `chords: ${vcc("chords", "chordsChorus2")}.s("piano")`,
    `bass: ${vcc("bass")}.scale("${bassScale}").s("ebass").lpf(700)`,
    `mel: ${vcc("mel")}.scale("${melScale}").s("piano")`,
  ].join("\n")}`;
const LIFT_STARTER = song("⟪G D Em C⟫", "⟪G2:major⟫", "⟪G4:major⟫");
const LIFTED = song("A E F#m D", "<G2:major!8 A2:major!4>", "<G4:major!8 A4:major!4>");
/** A lifted line is its notes, where they sound (contracts §6.8): compared in absolute pitch on every track. */
const NOTES: Matcher = { m: "events", pitch: "absolute", rhythm: "onsets", durations: false };

// --- two-names-one-chord ------------------------------------------------------------------------------------

/** F to C through Dm: vi in F, ii in C, then G7 and C confirm the new key. */
const PIVOT = code(
  'const changes = "<F Dm G7 C>"\n',
  'bass: chord(changes).rootNotes(2).s("upright")',
  'chords: chord(changes).voicing().s("rhodes")',
);

// --- the Make -----------------------------------------------------------------------------------------------

/** The song again, everything in G. Bar 3 of the verse (C, IV) is the natural place for a colour chord. */
const MAKE_STARTER = song("G D Em C", "G2:major", "G4:major");
/**
 * Beyond the brief: B7 (V7/vi) leads the verse into Em, the tune taking its D♯ (`4#`, ♯5) on the way; C turns
 * to Cm (iv, borrowed from G minor) under the held G of the chorus's last bar; the last chorus is the chorus a
 * whole step up, every line moved, with strings for the lift.
 */
const MAKE_RICH = `${TEMPO}${[
  'const chordsVerse = chord("<G B7 Em D>").voicing().struct("x ~ x ~")',
  'const chordsChorus = chord("<G D Em [C Cm]>").voicing().struct("x*4")',
  'const chordsChorus2 = chord("<A E F#m D>").voicing().struct("x*4")',
  'const bassVerse = n("<0 2 5 4>").struct("x ~ ~ x")',
  'const bassChorus = n("<0 4 5 3>").struct("x ~ x x")',
  'const melVerse = n("<[2 ~ 2 1] [4# ~ ~ ~] [5 ~ 4 2] [1 ~ ~ ~]>")',
  'const melChorus = n("<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ ~ ~]>")',
  'const padChorus = n("<[4,7] [4,6] [5,7] [5,7]>")',
].join("\n")}\n\n${[
  `chords: ${vcc("chords", "chordsChorus2")}.s("rhodes")`,
  `bass: ${vcc("bass")}.scale("<G2:major!8 A2:major!4>").s("ebass").lpf(700)`,
  `mel: ${vcc("mel")}.scale("<G4:major!8 A4:major!4>").s("piano")`,
  'pad: arrange([4, silence], [4, silence], [4, padChorus]).scale("<G3:major!8 A3:major!4>").s("strings").gain(.4)',
].join("\n")}`;

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U17.CP",
  title: "Chromatic checkpoint",
  covers: ["U15", "U16", "U17"],
  gated: ["H12", "H13", "H14"],
  levelSetting: ["E12a", "E12b", "E13"],
  version: 2,
  authored: [
    {
      kind: "fact",
      id: "name-the-colours",
      version: 1,
      role: "checkpoint",
      key: G_MAJOR,
      prompt:
        "Write the numeral of each of the eight chords, one a bar, in G major: G, E7, Am, Cm, G, E♭, F, G. Name a chord from outside the key either as the V7 of the chord it leads to, or as a chord borrowed from G minor.",
      skills: [
        { skill: "H12", w: 0.4 },
        { skill: "H13", w: 0.6 },
      ],
      hints: null,
      stimulus: { src: "code", code: COLOURS, bars: 8, showCode: true },
      answer: { ui: "rn-palette", slots: 8, allow: ["triads", "sevenths", "secondary", "borrowed"] },
      correct: { rn: COLOURS_RN },
      spelling: "enharmonic",
      order: "sequence",
      // The catalog describes a miss on an applied chord as if the chord were the key's own (U15.L02's note); this
      // says what an outside chord's numeral is made of, and still fits a miss on the key's own chords.
      feedbackText: {
        "harmony.rn-degree":
          "Chord {slot}: {got} does not fit {expChord} here. Check the root against G major first. A chord with a note the key does not own is either the V7 of the chord it leads to, or a chord of G minor.",
        "harmony.rn-case":
          "Chord {slot}: {got} is close; it is {exp}. Check upper or lower case: a chord borrowed from minor can be minor where the key's own is major.",
      },
      tests: [
        { name: "the numerals", response: { answer: { rn: COLOURS_RN } }, expect: "pass" },
        {
          name: "VI7 for V7/ii: E7 named as if it were the key's own chord",
          response: { answer: { rn: ["I", "VI7", "ii", "iv", "I", "bVI", "bVII", "I"] } },
          expect: "fail",
          feedback: ["harmony.rn-degree"],
        },
        {
          name: "VI for ♭VI: E♭ is a half step lower than the key's E",
          response: { answer: { rn: ["I", "V7/ii", "ii", "iv", "I", "VI", "bVII", "I"] } },
          expect: "fail",
          feedback: ["harmony.rn-degree"],
        },
        {
          name: "IV for iv: Cm read as the key's C",
          response: { answer: { rn: ["I", "V7/ii", "ii", "IV", "I", "bVI", "bVII", "I"] } },
          expect: "fail",
          feedback: ["harmony.rn-case"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "lift-the-last-chorus",
      version: 1,
      role: "checkpoint",
      key: G_MAJOR,
      prompt:
        "Lift the last chorus, bars 9 to 12, a whole step from G to A. Bass and tune: change each `.scale()` to a key plan counted in bars of the whole song, G major for 8 bars, then A major for 4. Chords: move every name in `chordsChorus2` up a whole step.",
      skills: [{ skill: "H14", w: 1 }],
      hints: null,
      code: { starter: LIFT_STARTER },
      reference: { solutions: [LIFTED], bars: 12 },
      matcher: NOTES,
      constraints: [
        { c: "edit-only-regions", feedback: "code.edit-outside" },
        {
          c: "must-not-use",
          tool: "tb.transpose",
          why: "after `.scale()` it moves the notes but leaves the key behind. Write the key plan in `.scale()`.",
          feedback: "code.must-not-use",
        },
      ],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      // Without the key plan in the grader, a wrong note of the lifted bars would be worded in degrees of G.
      feedbackText: {
        "melody.wrong-degree":
          "Bar {bar}, {beatLabel}: not the target's note. Bars 1–8 are in G major, bars 9–12 the same numbers in A major. Check the two keys, their octave and the counts after `!` (eight and four).",
      },
      tests: [
        { name: "reference", response: { code: LIFTED }, expect: "pass" },
        {
          name: "verse and first chorus counted apart",
          response: {
            code: song(
              "A E F#m D",
              "<G2:major!4 G2:major!4 A2:major!4>",
              "<G4:major!4 G4:major!4 A4:major!4>",
            ),
          },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: song("G D Em C", "G2:major", "G4:major") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the plans counted like one section: four and four",
          response: { code: song("A E F#m D", "<G2:major!4 A2:major!4>", "<G4:major!4 A4:major!4>") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "bass and tune lifted, the chord names left in G",
          response: { code: song("G D Em C", "<G2:major!8 A2:major!4>", "<G4:major!8 A4:major!4>") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "a half step: A♭ for A",
          response: { code: song("Ab Eb Fm Db", "<G2:major!8 Ab2:major!4>", "<G4:major!8 Ab4:major!4>") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
      ],
    },
    {
      kind: "fact",
      id: "two-names-one-chord",
      version: 1,
      role: "checkpoint",
      key: { tonic: "F", mode: "major" },
      prompt:
        "Dm is the pivot chord of F, Dm, G7, C, a move from F major to C major. Write its numeral twice: in the first slot its numeral in F major, in the second its numeral in C major.",
      skills: [{ skill: "H14", w: 1 }],
      hints: null,
      stimulus: { src: "code", code: PIVOT, bars: 4, showCode: true },
      answer: {
        ui: "rn-palette",
        slots: 2,
        allow: ["triads"],
        labels: ["In F major", "In C major"],
        slotKeys: [
          { tonic: "F", mode: "major" },
          { tonic: "C", mode: "major" },
        ],
      },
      correct: { rn: ["vi", "ii"] },
      spelling: "enharmonic",
      order: "sequence",
      tests: [
        { name: "vi, then ii", response: { answer: { rn: ["vi", "ii"] } }, expect: "pass" },
        {
          name: "the two keys swapped",
          response: { answer: { rn: ["ii", "vi"] } },
          expect: "fail",
          feedback: ["harmony.rn-degree"],
        },
        {
          name: "VI and II: D minor read as major",
          response: { answer: { rn: ["VI", "II"] } },
          expect: "fail",
          feedback: ["harmony.rn-case"],
        },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      H12: ["fam.har.chromatic"],
      E12a: ["fam.deg.fet-chromatic"],
      E12b: ["fam.har.chromatic"],
      E13: ["fam.har.modulation"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-last-chorus",
    version: 1,
    role: "checkpoint",
    title: "The last chorus lifts",
    prompt:
      "Lift the last chorus, bars 9 to 12, a whole step from G to A. Bass and tune: a key plan after each `arrange()`, 8 bars of G major, then 4 of A major. Chords: move every name in `chordsChorus2` up a whole step. Then add one applied or borrowed chord; bar 3 of the verse is a good place.",
    skills: [{ skill: "H14", w: 1 }],
    hints: null,
    key: G_MAJOR,
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [12, 24],
    saveAs: "sketch",
    rubric: [
      {
        id: "last-chorus-in-a",
        label:
          "The last chorus is a whole step above the chorus before it, in A, on chords, bass and tune, for 4 bars or more",
        required: true,
        skills: ["H14"],
        rule: "key-change",
        at: "last",
        semitones: [2],
        minBarsAfter: 4,
      },
      {
        id: "applied",
        label: "A secondary dominant that moves to the chord it leans into",
        required: false,
        skills: ["H12"],
        rule: "contains-rn",
        rn: [],
        kind: ["secondary-dominant"],
        mustResolve: true,
        min: 1,
      },
      {
        id: "borrowed",
        label: "A chord borrowed from G minor, such as Cm or E♭",
        required: false,
        skills: ["H13"],
        rule: "contains-rn",
        rn: [],
        kind: ["borrowed"],
        min: 1,
      },
      {
        id: "same-tune-higher",
        label:
          "The last chorus plays the same tune as the chorus before it, a half or whole step higher, for 4 bars or more",
        required: false,
        skills: ["H14"],
        rule: "key-change",
        at: "last",
        semitones: [1, 2],
        minBarsAfter: 4,
        sameMelody: true,
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: everything in G",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: the last chorus lifted on every line",
        response: { code: LIFTED },
        expect: "pass",
      },
      {
        name: "beyond the brief: B7 into Em, a borrowed Cm, strings for the lift",
        response: { code: MAKE_RICH },
        expect: "pass",
      },
      {
        name: "bass and tune lifted, the chord names left in G",
        response: { code: song("G D Em C", "<G2:major!8 A2:major!4>", "<G4:major!8 A4:major!4>") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "the whole song in A: the last chorus is in A, but nothing lifts",
        response: { code: NO_LIFT_SONG("A", "a") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "one D chord throughout: in both keys at once, and nothing lifts",
        response: { code: NO_LIFT_SONG("D", "d") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "the lift with the tune an octave higher",
        response: { code: song("A E F#m D", "<G2:major!8 A2:major!4>", "<G5:major!8 A5:major!4>") },
        expect: "pass",
      },
      {
        name: "a colour chord, and no lift",
        response: { code: song("G D Em C", "G2:major", "G4:major").replace("<G Em C D>", "<G Em Cm D>") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
