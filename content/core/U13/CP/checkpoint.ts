// U13.CP Sevenths & rhythm checkpoint (contracts §7.6; AUTHORING §10). It covers U12 and U13 (U12 has no
// checkpoint of its own) and, passed or soft-passed, opens the jazz and rhythm tracks (gates `J.main`, `R.main`).
// The generated items come from the families that give evidence for a gated skill: the seventh chords spelled
// (C07, `fam.chd.spell` level 3), intervals at the learner's level, compound ones from its upper levels (I04,
// `fam.int.isolated`), the push (R10, `fam.rhy.syncopation`), 6/8 against 3/4 (R11, `fam.rhy.meter`) and three to
// the beat (R12, `fam.rhy.subdivision`); seventh-chord qualities by ear (E11) and rhythm dictation (E14) set
// levels and never gate. The rest is measured by three authored items, each a shape graded and drawn today:
// - sevenths-by-number: a four-bar loop in F read from its chord names, written in numerals with their sevenths
//   (C08, C07);
// - read-the-push: two bars read off the treble staff, no sound, written in code with `@`: a dotted quarter, and
//   a note tied over the bar line (R09, N08);
// - three-to-the-beat: one bar of a guitar chop read off the staff, eighths and triplets, written in code
//   (N09, R12).
// The Make is a groove of the learner's own with seventh chords: something pushed ahead of the beat is the one
// required rule (R10); sevenths, ghost notes and a triplet are suggestions.
// Spec: content/specs/U13.md, "U13.CP Sevenths & rhythm checkpoint".
//
// Departures from the spec, each forced by what the checkpoint player draws:
// - sevenths-by-number is a `fact` with the loop as its stimulus, code shown, as U15.L02 S6 asks for numerals of
//   named chords; the chord names are the point, so nothing is hidden.
// - read-the-push and three-to-the-beat are `staff-read` items answered in code (U13.L05 S6's shape): the
//   checkpoint player opens the staff panel for a staff item and plays nothing, which is what "from the page"
//   means. The player draws a checkpoint staff item on the treble staff (it takes the clef from the answer, and a
//   code answer has none), so three-to-the-beat is a pitched guitar chop rather than hats on the percussion
//   staff; the rhythm read is the same, two eighths and a triplet a beat apiece.
// - No interval inversion is asked: a checkpoint has three authored items at most, and I04's evidence comes from
//   `fam.int.isolated` at the learner's level.
//
// No Band under the Make (the unit's rule, content/specs/U13.md): the drums are the learner's lines, and the
// jazz-soul Band's swung ride would put a straight eighth-note push a triplet away. `checkpointMakeBand` falls
// back to U13.L06's Make, which has none.
//
// Checked at its place in the default order (session 147, after U14.L01 and GYM.14): every U12 and U13 tool and
// word is the learner's.
import { type CheckpointDef, defineCheckpoint, type Matcher } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

// --- sevenths-by-number -------------------------------------------------------------------------------------

/** ii7 V7 Imaj7 IVmaj7 in F: Gm7 C7 Fmaj7 B♭maj7, on the Rhodes over the roots on the upright. */
const F_LOOP = code(
  'const changes = "<Gm7 C7 F^7 Bb^7>"\n',
  'bass: chord(changes).rootNotes(2).s("upright")',
  'chords: chord(changes).voicing().s("rhodes")',
);
const F_RN = ["ii7", "V7", "Imaj7", "IVmaj7"];

// --- read-the-push -------------------------------------------------------------------------------------------

/** A tune in C from middle C, on the piano. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
/**
 * Two bars cut into sixteen eighths: G for three (a dotted quarter), A for one, G for two, then E on beat 4 for
 * six, a quarter tied over the bar line to a half note; D and C as quarters. Evaluated: G 0–3/8, A 3/8–1/2,
 * G 1/2–3/4, E 3/4–3/2, D 3/2–7/4, C 7/4–2.
 */
const PUSH = "<[4@3 5 4@2 2@6 1@2 0@2]@2>";
const PUSH_PAGE = code(mel(PUSH));
const PUSH_MATCH: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets+durations",
  durations: true,
  tracks: ["mel"],
};

// --- three-to-the-beat ---------------------------------------------------------------------------------------

/** A clean-guitar chop, one note a beat: G, G, E, D. */
const gtr = (pattern: string, tail = "") => `gtr: n("${pattern}")${tail}.scale("C4:major").s("cleangtr")`;
/** Two eighths on G, a triplet on G, two eighths on E, a triplet on D. */
const CHOP = "[4 4] [4 4 4] [2 2] [1 1 1]";
const CHOP_PAGE = code(gtr(CHOP));
const CHOP_MATCH: Matcher = {
  m: "events",
  pitch: "absolute",
  rhythm: "onsets+durations",
  durations: true,
  tracks: ["gtr"],
};

// --- the Make ------------------------------------------------------------------------------------------------

const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.5)';
const groove = (
  o: { changes?: string; snare?: string; hats?: string; bass?: string; chords?: string } = {},
) =>
  code(
    `const changes = "${o.changes ?? "<C^7 Am7 Dm7 G7>"}"\n`,
    KICK,
    o.snare ?? SNARE,
    o.hats ?? HATS,
    o.bass ?? 'bass: chord(changes).rootNotes(2).s("fingerbass").lpf(800)',
    o.chords ?? 'chords: chord(changes).voicing().s("rhodes")',
  );
const MAKE_STARTER = groove();

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U13.CP",
  title: "Sevenths & rhythm checkpoint",
  covers: ["U12", "U13"],
  gated: ["C07", "C08", "I04", "R09", "R10", "R11", "R12", "N08", "N09"],
  levelSetting: ["E11", "E14"],
  version: 2,
  authored: [
    {
      kind: "fact",
      id: "sevenths-by-number",
      version: 1,
      role: "checkpoint",
      key: { tonic: "F", mode: "major" },
      prompt:
        "A loop in F major, its chords named in the code: Gm7, C7, Fmaj7, B♭maj7. Write the numeral of each of the four chords in F, in order, with its seventh: maj7, m7 or 7, as the chord name shows.",
      skills: [
        { skill: "C08", w: 0.6 },
        { skill: "C07", w: 0.4 },
      ],
      hints: null,
      stimulus: { src: "code", code: F_LOOP, bars: 4, showCode: true },
      answer: { ui: "rn-palette", slots: 4, allow: ["triads", "sevenths"] },
      correct: { rn: F_RN },
      spelling: "enharmonic",
      order: "sequence",
      tests: [
        { name: "ii7 V7 Imaj7 IVmaj7", response: { answer: { rn: F_RN } }, expect: "pass" },
        {
          name: "V for V7: the seventh left off",
          response: { answer: { rn: ["ii7", "V", "Imaj7", "IVmaj7"] } },
          expect: "fail",
          feedback: ["harmony.rn-quality"],
        },
        {
          name: "IV7 for IVmaj7: B♭7 has A♭, the key has A",
          response: { answer: { rn: ["ii7", "V7", "Imaj7", "IV7"] } },
          expect: "fail",
          feedback: ["harmony.rn-quality"],
        },
        {
          name: "counted from C: vi7 II7 V…",
          response: { answer: { rn: ["vi7", "II7", "Vmaj7", "I7"] } },
          expect: "fail",
          feedback: ["harmony.rn-degree"],
        },
      ],
    },
    {
      kind: "staff-read",
      id: "read-the-push",
      version: 1,
      role: "checkpoint",
      prompt:
        "No sound this time. Read the two bars on the staff, C major from middle C. The starter has the notes in even lengths, with the tied E written twice. Give each note the length the page shows, using `@`. Done when every note starts and ends where the page has it.",
      skills: [
        { skill: "R09", w: 0.5 },
        { skill: "N08", w: 0.5 },
      ],
      hints: null,
      source: PUSH_PAGE,
      bars: 2,
      answer: { ui: "code", starter: code(mel("⟪<[4 5 4 2] [2 1 0 ~]>⟫")) },
      reference: { solutions: [PUSH_PAGE], bars: 2 },
      matcher: PUSH_MATCH,
      feedbackText: {
        "melody.extra-note":
          "Bar {bar}, {beatLabel}: no note starts here on the page. Two notes joined by a tie are one sound: one number with one weight.",
        "melody.missing-note":
          "Bar {bar}, {beatLabel}: the page has a note starting here. Check the note before it: a dot makes a note half as long again.",
      },
      tests: [
        { name: "reference", response: { code: PUSH_PAGE }, expect: "pass" },
        {
          name: "the lengths written with _",
          response: { code: code(mel("<[4 _ _ 5 4 _ 2 _ _ _ _ _ 1 _ 0 _]@2>")) },
          expect: "pass",
        },
        {
          // A staff item is graded against the page alone (no starter), so the starter fails on its notes.
          name: "the starter as given: even values, the tied E struck twice",
          response: { code: code(mel("<[4 5 4 2] [2 1 0 ~]>")) },
          expect: "fail",
          feedback: ["melody.extra-note", "melody.missing-note", "rhythm.duration"],
        },
        {
          name: "the tied E played twice, once in each bar",
          response: { code: code(mel("<[4@3 5 4@2 2@2] [2@4 1@2 0@2]>")) },
          expect: "fail",
          feedback: ["melody.extra-note"],
        },
        {
          name: "the dot left off: G a plain quarter, A a quarter",
          response: { code: code(mel("<[4@2 5@2 4@2 2@6 1@2 0@2]@2>")) },
          expect: "fail",
          feedback: ["melody.missing-note"],
        },
      ],
    },
    {
      kind: "staff-read",
      id: "three-to-the-beat",
      version: 1,
      role: "checkpoint",
      prompt:
        "No sound this time. Read one bar of a guitar chop on the staff, C major from middle C. The starter has one note a beat: G G E D. Split each beat as the page does, into two eighths or a triplet, keeping its note. Done when every beat holds as many notes as the page shows.",
      skills: [
        { skill: "N09", w: 0.6 },
        { skill: "R12", w: 0.4 },
      ],
      hints: null,
      source: CHOP_PAGE,
      bars: 1,
      answer: { ui: "code", starter: code(gtr("⟪4 4 2 1⟫")) },
      reference: { solutions: [CHOP_PAGE], bars: 1 },
      matcher: CHOP_MATCH,
      feedbackText: {
        "melody.extra-note":
          "Beat {beatLabel}: no note starts here on the page. A beat with a 3 over it holds three notes; a beat of two eighths holds two.",
        "melody.missing-note":
          "Beat {beatLabel}: the page has a note starting here. Count the notes in each beat: two, or three under a bracket.",
      },
      tests: [
        { name: "reference", response: { code: CHOP_PAGE }, expect: "pass" },
        {
          name: "with a patterned .ply()",
          response: { code: code(gtr("4 4 2 1", '.ply("2 3 2 3")')) },
          expect: "pass",
        },
        {
          name: "the starter as given: one note a beat",
          response: { code: code(gtr("4 4 2 1")) },
          expect: "fail",
          feedback: ["melody.missing-note", "rhythm.duration"],
        },
        {
          name: "the triplets on beats 1 and 3",
          response: { code: code(gtr("[4 4 4] [4 4] [2 2 2] [1 1]")) },
          expect: "fail",
          feedback: ["melody.extra-note", "melody.missing-note"],
        },
        {
          name: "every beat a triplet",
          response: { code: code(gtr("4 4 2 1", ".ply(3)")) },
          expect: "fail",
          feedback: ["melody.extra-note"],
        },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      C07: ["fam.chd.spell"],
      I04: ["fam.int.isolated"],
      R10: ["fam.rhy.syncopation"],
      R11: ["fam.rhy.meter"],
      R12: ["fam.rhy.subdivision"],
      E11: ["fam.chd.quality-7th"],
      E14: ["fam.rhy.dictation"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-groove",
    version: 1,
    role: "checkpoint",
    title: "A groove that leans",
    prompt:
      "Every hit of this groove is on the beat. Push the chords ahead of the beat, so at least two of them start between beats and ring through the next one. Then, if you like, push the bass with them, add ghost notes on the snare, a triplet, or chords of your own. Keep it four or eight bars.",
    skills: [{ skill: "R10", w: 1 }],
    hints: null,
    key: { tonic: "C", mode: "major" },
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [4, 8],
    saveAs: "sketch",
    rubric: [
      {
        id: "pushed",
        label: "At least two chords start between beats and ring through the next beat",
        required: true,
        skills: ["R10"],
        rule: "syncopation",
        track: "@chords",
        min: 2,
      },
      {
        id: "bass-pushed",
        label: "At least two bass notes start between beats and ring through the next beat",
        required: false,
        skills: ["R10"],
        rule: "syncopation",
        track: "@bass",
        min: 2,
      },
      {
        id: "sevenths",
        label: "At least two chords are maj7, m7 or 7",
        required: false,
        skills: ["C08", "C07"],
        rule: "chord-qualities",
        anyOf: ["maj7", "m7", "7"],
        min: 2,
        depth: "seventh",
      },
      {
        id: "ghosts",
        label: "At least two snare hits at .4 or less, and at least two at full strength",
        required: false,
        skills: ["R10"],
        rule: "velocity-ghosts",
        track: "snare",
        min: 2,
        accents: 2,
      },
      {
        id: "triplet",
        label: "At least one triplet, in any line",
        required: false,
        skills: ["R12"],
        rule: "tuplets",
        track: "*",
        min: 1,
      },
    ],
    feedbackText: {
      "rubric.unmet": "{label}: not yet. Check your lines against the item, then run it again.",
    },
    tests: [
      {
        name: "the starter: everything on the beat",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: the Rhodes pushed an eighth",
        response: { code: groove({ chords: 'chords: chord(changes).voicing().early(1/8).s("rhodes")' }) },
        expect: "pass",
      },
      {
        name: "beyond the brief: pushed chords and bass, ghost snares, a triplet fill, new changes",
        response: {
          code: groove({
            changes: "<C^7 Em7 F^7 [Dm7 G7]>",
            snare:
              'snare: s("~ ~ ~ ~ sd ~ ~ sd ~ sd ~ ~ sd ~ ~ sd").velocity("1 1 1 1 1 1 1 .3 1 .3 1 1 1 1 1 .3")',
            hats: 'hats: s("hh*4").ply("<2 2 2 [2 2 2 3]>").gain(.5)',
            bass: 'bass: chord(changes).rootNotes(2).struct("x ~ ~ ~ x ~ x ~").early(1/8).s("fingerbass").lpf(800)',
            chords: 'chords: chord(changes).voicing().struct("x ~ ~ x ~ ~ x ~").early(1/8).s("rhodes")',
          }),
        },
        expect: "pass",
      },
      {
        name: "two chords a bar, both on the beat",
        response: {
          code: groove({ chords: 'chords: chord(changes).voicing().struct("x ~ x ~").s("rhodes")' }),
        },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
