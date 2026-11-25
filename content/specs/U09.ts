// U09 Form: the unit spec (rendered to content/specs/U09.md by `bun scripts/content/spec.ts`), with U09.CP (the
// checkpoint over U08–U09) and C3 Verse–Chorus Demo, which opens after it. Every hook was evaluated with
// headless Strudel and linted in its lesson; U09.L02 is the exemplar, written and passing with the real grader
// (content/core/U09/L02).
import type { UnitSpec } from "./types.ts";

const C = { tonic: "C", mode: "major" } as const;
const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;

/** What every U09 lesson has from U03–U08 (the voicing gate is met: U05.L08 cannot be completed without it). */
const BASE = [
  "tb.setcpm",
  "tb.label",
  "tb.mini.seq",
  "tb.mini.rest",
  "tb.mini.sub",
  "tb.mini.alt",
  "tb.mini.elongate",
  "tb.mini.replicate",
  "tb.mini.stack",
  "tb.gain",
  "tb.n",
  "tb.n.range",
  "tb.scale",
  "scale.major",
  "tb.s.pitched",
  "snd.piano",
  "snd.ebass",
  "tb.lpf",
  "tb.add",
  "tb.const",
  "tb.feature.degree-labels",
  "tb.feature.rn",
] as const;
/** Chord names voiced by Strudel (U05.L08): the section consts read as chord symbols. */
const VOICED = ["tb.chord", "tb.voicing", "chord.triad"] as const;
const DRUMS = ["snd.drum.bd", "snd.drum.sd", "snd.drum.hh"] as const;
/** From U09.L02 on: sections in code. */
const FORM = ["tb.arrange"] as const;

/** U09.L01: an eight-bar section of two four-bar phrases over I IV I V | I IV V I, a crash on each phrase. */
const L01_CHORDS =
  'chords: n("<[0,2,4] [3,5,7] [0,2,4] [4,6,8] [0,2,4] [3,5,7] [4,6,8] [0,2,4]>").scale("C3:major").s("piano")';
const L01_MEL =
  'mel: n("<[0 2 4 2] [3 5 3 ~] [2 4 2 0] [1 ~ ~ ~] [0 2 4 2] [3 5 3 ~] [1 3 1 -1] [0 ~ ~ ~]>").scale("C4:major").s("piano")';

/** U09.L02 (the exemplar's song): verse I vi IV V, chorus IV V I I, four bars each, V C V C. */
const vcvc = (verse: string, chorus: string) =>
  `arrange([4, ${verse}], [4, ${chorus}], [4, ${verse}], [4, ${chorus}])`;
const L02_SONG = [
  'const chordsVerse = chord("<C Am F G>").voicing()',
  'const chordsChorus = chord("<F G C C>").voicing()',
  'const bassVerse = n("<0 5 3 4>").scale("C2:major")',
  'const bassChorus = n("<3 4 0 0>").scale("C2:major")',
  'const melVerse = n("<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major")',
  'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")',
  'const percChorus = s("~ tb ~ tb")',
  "",
  `chords: ${vcvc("chordsVerse", "chordsChorus")}.s("piano")`,
  `bass: ${vcvc("bassVerse", "bassChorus")}.s("ebass").lpf(600)`,
  `mel: ${vcvc("melVerse", "melChorus")}.s("piano")`,
  `perc: ${vcvc("silence", "percChorus")}`,
].join("\n");

/** U09.L03: AABA in miniature, four bars a section; the bridge moves to IV and ends open on V. */
const L03_SONG = [
  'const chordsA = chord("<C Am F G>").voicing()',
  'const chordsB = chord("<F Em Dm G>").voicing()',
  'const melA = n("<[4 ~ 2 4] [5 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>").scale("C4:major")',
  'const melB = n("<[5 ~ 5 7] [6 ~ 4 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
  "",
  'chords: arrange([4, chordsA], [4, chordsA], [4, chordsB], [4, chordsA]).s("piano")',
  'mel: arrange([4, melA], [4, melA], [4, melB], [4, melA]).s("piano")',
].join("\n");

/** U09.L04: verse, build-up, chorus; the hats, the chords' level and a stepped riser rise through the build. */
const L04_SONG = [
  'const chordsVerse = chord("<C Am F G>").voicing()',
  'const chordsBuild = chord("<C Am F G>").voicing().gain(saw.range(.5, 1).slow(4))',
  'const chordsChorus = chord("<F G C C>").voicing()',
  'const hatsVerse = s("hh*8").gain(.4)',
  'const hatsBuild = s("hh*16").gain(saw.range(.2, .9).slow(4))',
  'const hatsChorus = s("[hh hh oh hh]*2").gain(.7)',
  'const fxBuild = n(saw.range(0, 8).segment(8).slow(4)).scale("C4:major")',
  "",
  'kick: s("bd ~ bd ~")',
  'snare: s("~ sd ~ sd")',
  'chords: arrange([4, chordsVerse], [4, chordsBuild], [4, chordsChorus]).s("piano")',
  "hats: arrange([4, hatsVerse], [4, hatsBuild], [4, hatsChorus])",
  'fx: arrange([4, silence], [4, fxBuild], [4, silence]).s("sawtooth").lpf(1200).gain(.4)',
].join("\n");

/** U09.L05: a four-bar intro where the parts come in one by one (`.mask()` inside the intro's consts), then the verse. */
const L05_SONG = [
  'const chordsIntro = chord("<C Am F G>").voicing().mask("<0 0 1 1>")',
  'const chordsVerse = chord("<C Am F G>").voicing()',
  'const bassIntro = n("<0 5 3 4>").scale("C2:major").mask("<0 1 1 1>")',
  'const bassVerse = n("<0 5 3 4>").scale("C2:major")',
  'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
  'const melVerse = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
  "",
  'kick: s("bd ~ bd ~")',
  'snare: s("~ sd ~ sd")',
  'hats: s("hh*8").gain(.5)',
  'chords: arrange([4, chordsIntro], [4, chordsVerse]).s("piano")',
  'bass: arrange([4, bassIntro], [4, bassVerse]).s("ebass").lpf(600)',
  'mel: arrange([4, melIntro], [4, melVerse]).s("piano")',
].join("\n");

/** U09.L06 (Oak 2.0 W2): the intro of Arranging in Code, the verse, and an outro the parts leave in reverse order. */
const L06_HOOK = [
  'const chordsIntro = chord("<C Am F G>").voicing().mask("<0 0 1 1>")',
  'const chordsVerse = chord("<C Am F G>").voicing()',
  'const chordsOutro = chord("<F G C C>").voicing().mask("<1 1 0 0>")',
  'const bassIntro = n("<0 5 3 4>").scale("C2:major").mask("<0 1 1 1>")',
  'const bassVerse = n("<0 5 3 4>").scale("C2:major")',
  'const bassOutro = n("<3 4 0 0>").scale("C2:major").mask("<1 1 1 0>")',
  'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
  'const melVerse = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
  'const melOutro = n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] [0 ~ ~ ~]>").scale("C4:major").mask("<1 0 0 0>")',
  'const drumsIntro = s("bd hh sd hh bd hh sd hh").gain("[.8 .4]*4")',
  'const drumsVerse = s("bd hh sd hh bd hh sd hh").gain("[.8 .4]*4")',
  'const drumsOutro = s("<[bd hh sd hh bd hh sd hh]!3 [bd ~ ~ ~]>").gain("[.8 .4]*4")',
  "",
  "drums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsOutro])",
  'chords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsOutro]).s("piano")',
  'bass: arrange([4, bassIntro], [4, bassVerse], [4, bassOutro]).s("ebass").lpf(600)',
  'mel: arrange([4, melIntro], [4, melVerse], [4, melOutro]).s("piano")',
].join("\n");

/** U09.L07 (Oak 2.0 W2): one loop carved into four sections. */
const L07_HOOK = [
  'const drumsVerse = s("bd ~ sd ~ bd ~ sd ~").gain(.8)',
  'const drumsChorus = s("bd ~ sd ~ bd ~ sd ~").gain(.8)',
  'const chordsIntro = chord("<C Am F G>").voicing()',
  'const chordsVerse = chord("<C Am F G>").voicing()',
  'const chordsChorus = chord("<C Am F G>").voicing()',
  'const chordsOutro = chord("<C Am F G>").voicing()',
  'const bassVerse = n("<[0 ~ 0 0] [5 ~ 5 5] [3 ~ 3 3] [4 ~ 4 4]>").scale("C2:major")',
  'const bassChorus = n("<[0 ~ 0 0] [5 ~ 5 5] [3 ~ 3 3] [4 ~ 4 4]>").scale("C2:major")',
  'const melChorus = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
  'const melOutro = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
  "",
  "drums: arrange([4, silence], [4, drumsVerse], [4, drumsChorus], [4, silence])",
  'chords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsChorus], [4, chordsOutro]).s("piano")',
  'bass: arrange([4, silence], [4, bassVerse], [4, bassChorus], [4, silence]).s("ebass").lpf(600)',
  'mel: arrange([4, silence], [4, silence], [4, melChorus], [4, melOutro]).s("piano")',
].join("\n");

export const U09: UnitSpec = {
  unit: "U09",
  title: "Form",
  summary:
    "Seven lessons on how a song is put together from sections, taught on the kind of music the learner has already made: the four-bar hooks of U07, C2's eight bars that loop and land, the bass lines of U08. Bars group into four-bar phrases and phrases into sections, the first bar of each four feeling strong (hypermeter, U09.L01); two sections that contrast, verse and chorus, written as section `const`s with one `arrange()` per labelled track (U09.L02, the exemplar); two more song forms, AABA with its bridge and strophic, heard in songs the learner already knows (U09.L03); the energy curve, with a build-up drawn by a signal (`saw.range(.2, .9).slow(4)`) and stepped with `.segment()` (U09.L04); arranging, parts entering and leaving by bar with `.mask()` (U09.L05); and, from Oak 2.0, endings written on purpose (U09.L06) and arranging by taking parts away from a loop where everything plays, with a blurred seam and a moment heard once (U09.L07). U09.CP covers U08 and U09 and opens C3 Verse–Chorus Demo (four sessions since contracts 1.6) and the side lessons A1.L05–L07. In the default order U09.L01–L04 follow GYM.04; GYM.05 sits before U09.L05, and U10.L01 comes before U09.CP (session 96), so the checkpoint falls on a later day than the unit's last lesson.",
  conventions: [
    'Sections in code (contracts §6.3, STYLE §10). Each section of each part is a `const` named `<role><Section>` in camelCase: `chordsVerse`, `bassChorus`, `melA`, `hatsBuild`, `fxBuild`; the role prefix is a label of STYLE §2, the section word one of `intro verse pre chorus bridge solo break head vamp lift outro` or a letter `a b c`, with a digit for a variant (`melChorus2` is a chorus). Every labelled track that changes between sections gets **one** `arrange()` at the root of its chain (`chords: arrange([4, chordsVerse], [4, chordsChorus]).s("piano")`), listing the same sections with the same bar counts as every other arranged track; a part that rests in a section uses `silence`; a part that never changes stays a plain line (a through track). `arrange()` is never wrapped (`stack(arrange(…))`, `arrange(…).mask(…)` across sections is fine only as a method chain on the same track).',
    "Sections restart (contracts §6.3 item 7, evaluated): inside `arrange()` every section plays from its own bar 1, so a section's length is a whole multiple of its pattern's length (`<C Am F G>` is four bars: sections of 4 or 8, never 6; `form.section-period` otherwise), a build drawn with `.slow(4)` inside a four-bar section starts again at each section, and an intro's `.mask(\"<0 1 1 1>\")` lets the bass in at bar 2 of the intro every time the intro plays. Anything that must run across sections (a fade over the whole song) goes after `arrange()`.",
    "Lesson sections are four bars, so a whole song of four sections is 16 bars at 100–112 BPM (34–38 seconds) and the chorus arrives within 10 seconds of Play; the lesson-mode grader reads up to 16 bars of a learner's loop (contracts §6.4), so a graded reference is at most 16 bars. C3's sections are eight bars (§6.6 asks for 90 seconds).",
    "Form is taught on what the learner made and what they know. The hooks are shaped like their own work: U09.L01's eight bars are the question-and-answer pair of U07.L06 over the Band's eight-bar phrase (C2's \"loop, then land\" is one section of the same kind); U09.L02's verse is the doo-wop loop of U06.L07 with a U07-style tune and a U08 root bass. Every Coda suggests the same thing for Studio, which is never gated: open your C2 track or a U07 hook and give it what today added (a crash on each phrase, a chorus, a bridge, a build-up, an intro). The forms they know from records are the songs already met in Oak: Ode to Joy is A A' B A' (U02.L08, U03.L09), When the Saints and Michael, Row the Boat Ashore are strophic (U02.L08, U03.L10), Swing Low and Auld Lang Syne have a verse and a chorus (U03.L10); standards of the 1920s–30s such as I Got Rhythm are AABA (named only: no recording is played).",
    "Harmony stays in the learner's code wherever a rule or a graded step reads it (AUTHORING §8 rule 5), so a lesson whose song has chords plays the Band on drums only (`band.axis-4bar`, `tracks: [\"drums\"]`). U09.L01's Make is a tune over the Band's eight-bar phrase (`band.phrase-8bar`, every track). The verse loop is I vi IV V (C Am F G) and the chorus IV V I I (F G C C) in U09.L02 and L04; the AABA bridge in U09.L03 is IV iii ii V (F Em Dm G). Every hook was checked against its chords: on beats 1 and 3 every tune note is a chord tone.",
    "Grading (AUTHORING §18.2). Implemented today: a track's arrangement is an `events` match on that track over the whole song (bass in degrees octave-free, drums by role, `pcset` per onset for voiced chords), and the Make of U09.L02 reads the chords' order with `matches` + a `harmony` matcher at level `rn` against a V C V C reference that includes the root bass (so `.voicing()`'s E under C is not reported as a wrong bass). PLANNED until the grader lists them: the rules `form`, `contrast`, `duration-sec`, `groove-lock`; the `form` answer (U09.L03); the `controls` matcher (U09.L04 S4, on `gain`); the form-map panel (`initialPanels: [\"form\"]`, feature `panel.wave5`). A lesson that uses one fails check 2 until it lands: its author writes it, says so, and keeps a fallback in the notes (the exemplar's `matches` shape for `form`).",
    'The form lens (`tb.lens.form`, U09.L02) draws a ribbon of sections over the roll and the staff from the learner\'s own `arrange()` (wave5.md §4.3–4.4); a click or Enter on a section loops it. From U09.L03 the investigate steps open the form map with `initialPanels: ["form"]` (planned). A piece whose tracks disagree shows the rule\'s message, "Write one arrange() per labelled track", never a broken ribbon. The lead sheet draws a label and a double bar at each section (notation `sectionMarks`).',
    'Words that wait and words that are plain. Terms: "hypermeter" (U09.L01), "verse" and "chorus" (a pair, U09.L02 S3), "song form" (U09.L02 S4), "bridge" and "strophic" (U09.L03), "build-up" and "energy curve" (U09.L04); U09.L05 introduces none. Before U09.L02 S3 nothing says "verse" or "chorus" (U09.L01 says "section", "the part that comes back"); before U09.L03 nothing says "bridge" (U04.L01\'s plain use is allowed). Plain English, not terms: "section", "phrase", "intro", "outro", "drop", "riser", "arrangement", "lift". Still waiting: "syncopation" (U13), "swing" (U11), "filter" and "cutoff" (A1.L02, a side lesson the learner may not have taken).',
    "Ear training: `fam.frm.sections` (stage D's form family, contracts §7.3) is seeded in U09.L03 at level 1 (AABA against verse–chorus); its level 2 (four- or eight-bar phrases) opens at the same lesson. `fam.har.cadence` is reviewed in U09.L01 (phrases end open or closed). No sing step in U09 (a form is heard, not sung; contracts §8.3 asks for singing in the warm-ups' sets); U09.L01 has a tap step, never graded.",
    'U09\'s "Play from the page" step is U09.L03 S4: the AABA plan shown as a lead sheet with section labels (A, A, B, A over four-bar systems) and no code, written as one `arrange()` for the tune.',
    "Feedback the grader emits on U09 steps (from U09.L02's tests; pin what `bun run content:check <id> --verbose` prints): `melody.wrong-degree` per bar for a bass or tune whose sections are in the wrong order or the wrong length (override it to say \"check the order and the lengths of your sections against the chords line\"), with `form.inconsistent-arrange` beside it when one track's sections differ from another's; `rhythm.missing` / `rhythm.extra` for a drum part in the wrong sections; `harmony.rn` and `harmony.missing-chord` inside a Make's `rubric.unmet` when the chords run in the wrong order; `code.unchanged`, `code.edit-outside`, `investigate.wrong`. Override `rubric.unmet` with the neutral \"{label}: not yet.\" (it serves every rule of the rubric, suggestions included).",
  ],
  lessons: [
    {
      id: "U09.L01",
      author: "U09a",
      idea: 'Bars group the way beats do: four bars make a phrase, and the first bar of each four feels strong, like beat 1 of a bar. Two phrases that belong together, a question and its answer, make an eight-bar section. A crash on bar 1 of each phrase, `s("<cr ~ ~ ~>")`, marks the grouping: `< >` with four steps takes four bars.',
      hook: {
        hear: "Eight bars over I IV I V | I IV V I: a four-bar question that ends open on 2, then an answer that starts the same way and comes home, with a crash on bar 1 and bar 5. The whole section plays within 20 seconds; the second time round the learner counts the phrases.",
        code: `${T(100)}${L01_CHORDS}\n${L01_MEL}\nperc: s("<cr ~ ~ ~>")`,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.hear.sections"],
      uses: [...BASE, ...DRUMS, "snd.drum.cr"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.75,
          what: "Two items over the Band's drums: the eight bars with no crash, then the same with a crash on bar 1 of each phrase. Where does the music breathe?",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`perc: s("<cr ~ ~ ~>")`: how often does the crash play? (`choose`: once every four bars / on every bar / four times a bar)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "The hook with the roll: how the second phrase begins (choice: like the first one); how many bars the whole section lasts (number: 8). Pass text names the strong first bar of each four.",
          term: "term.hypermeter",
        },
        {
          kind: "tap",
          exercise: "tap",
          minutes: 1.25,
          what: 'Tap beat 1 of every bar for eight bars while the section plays, counting the bars aloud, "one, two, three, four, one…" (a `kick: s("bd ~ ~ ~")` line in the stimulus; `mode: "along"`, `target: { drum: ["kick"] }`, `windowMs: "auto"`; never graded).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The crash plays on every bar (`perc: s("⟪cr⟫")`), so no bar is stronger than another: mark the phrases, `s("<cr ~ ~ ~>")` (`events`, `sound: "drum-role"`, `tracks: ["perc"]`, 8 bars; edit-only-regions). Equivalent: `s("<cr ~@3>")`.',
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["bar-buttons"],
          minutes: 1.25,
          graded: true,
          what: "A sixteen-bar Oak song in two eight-bar sections, each two four-bar phrases (the second section new chords and a higher tune), with no crash: click the bar where the second section starts (`bar-buttons`, `bars: 16`; correct bar 9; a fixed code stimulus, replays unlimited).",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your four-bar idea becomes an eight-bar section: a question, then an answer that starts like it and comes home.",
        },
      ],
      wrapAt: 5,
      make: {
        brief:
          "Over the Band's eight bars, the tune plays a four-bar idea once and then stops. Make it a section: play the idea, then answer it with a phrase that starts the same way and ends home on 1. Mark each phrase with a crash.",
        required: {
          rule: "motif-reuse",
          label: "An answer: the second phrase starts like the first and ends its own way",
          why: '`motif-reuse` on `@melody` with `unitBars: 2`, `minRatio: 0.25`, `shape: "either"`: one two-bar group in four repeats an earlier one, which is bars 5–6 starting like bars 1–2 (the U07.CP measure of "the answer starts like the question"). The starter (bars 1–4, then four bars of rest) scores 0 and fails; the hook passes; an answer moved up a step (`shape: "either"`) passes.',
        },
        suggestions: [
          'a crash on bar 1 of each phrase (`onsets` on `perc`, `drum: "crash"`, `contains: [[0, 1]]`, `perBar: false`: write it as the rule allows, or leave it as an unticked line)',
          'the answer ends home (`ends-on-degree`, `degrees: ["1"]`, `track: "@melody"`)',
        ],
        band: "band.phrase-8bar",
        tracks: ["drums", "bass", "chords"],
        flavours:
          "The Band in the flavour's kit and voicing (jazz-soul swings and adds sevenths); the learner's `mel:` swaps `piano` for `rhodes` in jazz-soul.",
      },
      srs: [{ family: "fam.har.cadence", mode: "review-if-due" }],
      mistakes: [
        'the crash on the last bar of each phrase (`s("<~ ~ ~ cr>")`): `rhythm.missing` and `rhythm.extra`; pin what the grader prints',
        'a three-bar grouping (`s("<cr ~ ~>")`): `rhythm.extra` (bars 4 and 7) and `rhythm.missing` (bar 5)',
        'the crash every eight bars (`s("<cr ~ ~ ~ ~ ~ ~ ~>")`): `rhythm.missing` (bar 5)',
        "the unchanged starter: `code.unchanged`",
        'ear: bar 5 (the second phrase of the first section) for bar 9: `id.wrong`, overridden: "Bar 5 starts a phrase. Listen for the bar where the chords and the tune change."',
        "Make starter (the idea, then rests) and an answer with nothing in common with the question: `rubric.unmet`",
      ],
      connects: {
        back: "U07.L06 wrote a question and its answer, four bars each; C2 was eight bars that loop, then land. U01.L02 counted to four inside a bar; now the bars are counted the same way.",
        forward:
          "U09.L02 puts two different sections side by side, a verse and a chorus, and gives each part one `arrange()`.",
      },
      epr: {
        enjoyment:
          "The learner's own four-bar idea grows into a finished eight-bar section over the Band, a question and an answer with a crash on each phrase, that sounds like the opening of a real song.",
        pace: "One idea: bars group in fours, and two phrases make a section. Contrast between sections, `arrange()` and the form names are held for U09.L02 and L03; the crash is the only new code, and it is old code (`< >`) read a new way.",
        return:
          "The Coda says: you can hear where a phrase starts and count a song in four- and eight-bar groups. Next: two sections that contrast, a verse and a chorus, each written once and arranged in code.",
      },
      notes: [
        'Evaluated: the hook\'s tune is C E G E | F A F | E G E C | D, then C E G E | F A F | D F D B | C over C F C G | C F G C; every note on beats 1 and 3 is a chord tone (F on beat 2 of bar 7, over G, is a weak-beat note outside the triad). `perc: s("<cr ~ ~ ~>")` hits at bars 1 and 5 only.',
        "The ear step's stimulus is authored code (no generator: `fam.frm.sections` opens at U09.L03). Its first section is the hook's; its second is new chords (F G C C) and a higher tune, so the change at bar 9 is heard on more than one count.",
        "The Make's starter is the hook's first four bars followed by four bars of rest (`<[0 2 4 2] [3 5 3 ~] [2 4 2 0] [1 ~ ~ ~] ~ ~ ~ ~>`), over the Band, with no crash. A learner who brings a U07 hook instead passes the same way.",
      ],
    },
    {
      id: "U09.L02",
      author: "spec-U09",
      idea: "A song is built from sections that contrast: the verse, whose music comes back with new words, and the chorus, which comes back with the hook and lifts the song (new chords, a higher tune, something new coming in). In code each section of each part is a `const`, and every part that changes gets one `arrange()` with the same sections in the same order: `chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus])`.",
      hook: {
        hear: "Over the Band's drums, sixteen bars: a four-bar verse on the doo-wop loop with a tune in the middle, then a chorus on F G C C whose tune climbs a 4th to a 6th higher and brings a tambourine on 2 and 4, then both again. The chorus lands at bar 5, under 10 seconds in.",
        code: `${T(100)}${L02_SONG}`,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.code.arrange"],
      uses: [...BASE, ...VOICED, ...FORM, "snd.drum.tb"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 1.25,
          what: "Two items over the drums: one four-bar section looping on its own (8 bars), then the song, two sections in turn and both again (16 bars).",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus])`: what do you hear? (`choose`: four bars of one, four of the other, then both again / both at once / the first twice, then the second twice). The words "verse" and "chorus" appear only inside the code.',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "The song with the roll: what changes at bar 5 (choice: new chords, a higher tune and a tambourine); how many bars before it starts over (number: 16; 4 is one section, pinned).",
          term: ["term.verse", "term.chorus"],
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The bass plays `⟪bassVerse⟫` all through and fights the chorus chords: give it one `arrange()` with the same four sections (`events`, octave-free, `tracks: ["bass"]`, 16 bars; edit-only-regions). Equivalent: the last chorus written out with its two C roots an octave up (`n("<3 4 7 7>")`). Pass text names the song form.',
          term: "term.form",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The tambourine plays all through, so the chorus brings nothing new: `perc: arrange([4, silence], [4, percChorus], [4, silence], [4, percChorus])` (`events`, `sound: "drum-role"`, `tracks: ["perc"]`, 16 bars; edit-only-regions). Equivalent: the chorus sections written out as `s("~ tb ~ tb")`.',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "The verse plays on its own; arrange the song verse, chorus, verse, chorus and make the chorus lift.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The verse plays on its own; the chorus has its chords and bass, and its tune starts as a copy of the verse's. Arrange the song verse, chorus, verse, chorus, four bars each, one `arrange()` per track. Then make the chorus lift: a higher tune, something new coming in.",
        required: {
          rule: "matches",
          label: "Verse, chorus, verse, chorus: the chords in that order",
          why: '`matches` against the chords and the root bass arranged V C V C (16 bars) with `{ m: "harmony", level: "rn", qualityDepth: "triad", inversion: false, harmonicRhythm: "given" }`, `min: 0.85`: the verse and chorus chords differ in every bar, so the chords in order are the form in order. The starter (the verse looping, 0.60) and V V C C (0.65) fail; chords and bass arranged pass (1.00), with or without the tune; sevenths pass on the triad core. When the grader lists `form`, the required rule becomes `form` "verse chorus verse chorus" and keeps these tests.',
        },
        suggestions: [
          'chords, bass and tune each with their own `arrange()` (`uses`, `tool: "tb.arrange"`, `min: 3`)',
          "something new comes in: a fourth track (`tracks`, `min: 4`)",
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Drums from the Band in the flavour's kit; jazz-soul swaps `piano` for `rhodes` and `ebass` for `upright` in the starter.",
      },
      srs: [{ family: "fam.har.schema", mode: "review-if-due" }],
      mistakes: [
        'S4: both verses first, then both choruses (`arrange([4, bassVerse], [4, bassVerse], [4, bassChorus], [4, bassChorus])`): `melody.wrong-degree` on bars 5–12, overridden to "check the order and the lengths of your sections", with `form.inconsistent-arrange`',
        "S4: eight-bar sections (`arrange([8, bassVerse], [8, bassChorus])`): the same codes",
        "S5: the tambourine in the verses instead: `rhythm.extra` and `rhythm.missing`; `silence` everywhere: `rhythm.missing`",
        "the unchanged starters: `code.unchanged`",
        'Make: the starter (the verse looping) and V V C C: `rubric.unmet` with `harmony.rn` ("Chord 5: I, expected IV") and `harmony.missing-chord`',
      ],
      connects: {
        back: "U08.L04 named a rhythm once with `const` and gave it to two lines; U09.L01 heard four-bar phrases make a section. Now each section of each part is a `const`, and `arrange()` plays them in order.",
        forward:
          "U09.L03 names two more song forms, AABA (with a bridge) and strophic, and the form family starts in the warm-ups.",
      },
      epr: {
        enjoyment:
          "The learner's verse gets a chorus that lifts, and for the first time they hear a whole song with a shape, verse, chorus, verse, chorus, that they arranged themselves and would replay in Studio.",
        pace: "One idea: two sections that contrast, one `arrange()` per track. Other forms wait for U09.L03, the energy curve and builds for U09.L04, entries inside a section (`.mask()`) for U09.L05; the chorus's chords and bass are given so the Make fits its minutes.",
        return:
          "The Coda says: you can arrange a song in verse–chorus form with one `arrange()` per track, and the form lens shows its sections. Next: AABA and strophic, the forms of the standards and the folk songs you already know.",
      },
      notes: [
        "The exemplar: content/core/U09/L02 passes every content-CI check with the real grader (6 steps, 2 graded, expert 7.5 minutes, scaled 10.5; part A 4.9, part B 5.6).",
        'Evaluated: the song is 16 bars; the bass plays C A F G | F G C C twice; the verse tune is E G E | C E | F A F | D (E4–A4), the chorus tune C5 A4 | B4 G4 | C5 E5 C5 | C5, every note on beats 1 and 3 a chord tone; the tambourine sounds only in bars 5–8 and 13–16. `chord("C").voicing()` puts E3 lowest, so the Make\'s reference carries the root bass.',
        'The form-map panel (`initialPanels: ["form"]`) is left out of the exemplar because `panel.wave5` is planned: the lens ribbon (unlocked here) is the learner\'s view of the sections until the panel lands.',
      ],
    },
    {
      id: "U09.L03",
      author: "U09a",
      idea: "Two more song forms. AABA: a section that plays twice, a contrasting bridge that comes once and moves away from home, then the first section again (the 32-bar song of the standards, four 8-bar sections). Strophic: the same music for every verse, AAA (folk songs and hymns). A form is named by letters in order of first appearance.",
      hook: {
        hear: "Sixteen bars over the Band's drums: a four-bar A twice, a bridge on F Em Dm G whose tune climbs and ends open on 5, then A home. The bridge lands at bar 9, 17 seconds in.",
        code: `${T(112)}${L03_SONG}`,
      },
      key: C,
      meter: "4/4",
      bpm: 112,
      canDo: ["cd.hear.form"],
      uses: [...BASE, ...VOICED, ...FORM],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.75,
          what: "The AABA miniature over the drums (16 bars). (Learner review: the strophic item was cut from the hook; the learner meets strophic form first in S5, so the hook stays on the shape the Make builds and the step fits its time.)",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["number"],
          minutes: 0.5,
          what: "`mel: arrange([4, melA], [4, melA], [4, melB], [4, melA])`: how many times does `melA` play? (`count`: 3)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          panels: ["form"],
          features: ["panel.wave5"],
          minutes: 1,
          what: "The hook with the form map open: what the third section does (choice: new chords, away from home, ending open so A can return); in which bar A comes back (number: 13).",
          term: "term.bridge",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Play from the page: the AABA plan shown only as a lead sheet with section labels A A B A over four-bar systems (no code, no roll); the chords are arranged, the tune plays `⟪melA⟫` all through: write its `arrange()` (`events`, octave-free, `tracks: ["mel"]`, 16 bars; edit-only-regions).',
          features: ["lead-sheet"],
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["form"],
          minutes: 1.25,
          graded: true,
          what: 'A strophic song in three eight-bar sections (the same tune and chords, a new lead sound each time): name its form (`form` answer, `sections: 3`, `vocabulary: "letters"`, `input: "label"`, `sectionBars: [8, 8, 8]`; correct A A A). Pass text names it strophic, as When the Saints is.',
          term: "term.strophic",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "From `fam.frm.sections` level 1 (generator stimulus): AABA or verse–chorus? Four items.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A bridge for a given A, arranged AABA.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "A is written: four bars of chords and tune. Write a bridge, B, that moves away from home (start on IV or vi) and ends on V, so A can come back. Arrange both parts A A B A.",
        required: {
          rule: "form",
          label: "The song runs A A B A",
          why: "`form` with `pattern: \"AABA\"` (section names read from the identifiers `chordsA`, `melB`: letters by first appearance). The starter (A looping, no `arrange()`) fails with no sections. PLANNED rule: this Make fails check 2 until the grader lists `form`; if it has not landed when the lesson is written, use the exemplar's shape (`matches` + `harmony` level `rn` against A A B A with the starter's B chords given) and say so.",
        },
        suggestions: [
          'the bridge ends on V (`cadence`, `types: ["HC"]`, `at: { bar: 12 }`)',
          'every part arranged (`uses`, `tool: "tb.arrange"`, `min: 2`)',
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours: "Drums from the Band; jazz-soul swaps `piano` for `rhodes` in the starter.",
      },
      srs: [{ family: "fam.frm.sections", mode: "seed", level: 1 }],
      mistakes: [
        "S4: A B A A (the bridge one section early): `melody.wrong-degree` on bars 5–12",
        "S4: the bridge's tune under A's chords (`arrange([4, melB], …)`): `melody.wrong-degree`",
        'S5: A A B (the third section heard as new because the sound changed): `id.wrong`, overridden: "The sound changed; did the tune?"',
        "S6: an AABA heard as verse–chorus (the bridge taken for a chorus): `id.wrong`",
        "the unchanged starter: `code.unchanged`",
        "Make starter: `rubric.unmet` (`form.no-sections`)",
      ],
      connects: {
        back: "U09.L02 arranged verse and chorus; the learner sang and read When the Saints and Michael, Row the Boat Ashore (U02–U03), strophic songs, and Ode to Joy, A A' B A'.",
        forward:
          "U09.L04 shapes how a song's energy rises into a section: the build-up, drawn with a signal.",
      },
      epr: {
        enjoyment:
          "The learner writes a bridge, the part of a song that goes somewhere new and makes coming home feel earned, and hears their tune turn into a small standard, A A B A.",
        pace: "One idea: two more song forms, named with letters. The bridge is written over given A material; energy and entries wait for U09.L04–L05, and the 32-bar length of real AABA songs is heard about, not written.",
        return:
          "The Coda says: you can name a song's form by ear, verse–chorus, AABA or strophic, and write one. Next: the energy curve, builds that make a chorus land. The form drill now joins your warm-ups.",
      },
      notes: [
        "Evaluated: A is G E G | A E | F A F | D over C Am F G; the bridge is A A C | B G | F A F | G over F Em Dm G, ending on 5 over V. Every note on beats 1 and 3 is a chord tone.",
        "S4's lead sheet needs the section marks (notation `sections`, wave5.md §3.3) and the planned form panel elsewhere; the lead sheet itself (`lead-sheet`) is implemented.",
        'The strophic example\'s "different lead sound each time" is one `arrange()` on the `mel` track with three section consts that differ only in `.s()` (`melVerse`, `melVerse2`, `melVerse3`): the form answer is A A A because the music is the same; the form lens shows `verse verse2 verse3` as one letter.',
      ],
    },
    {
      id: "U09.L04",
      author: "U09b",
      idea: "A song's energy rises and falls from section to section: louder, busier, higher, more parts. A build-up raises it into the next section. In code a signal draws the rise: `saw` climbs from 0 to 1 over a bar, `.range(.2, .9)` sets where it starts and ends, `.slow(4)` stretches it over four bars, and `.segment(8)` turns the curve into steps you can play as notes.",
      hook: {
        hear: "Twelve bars: a four-bar verse with quiet hats, a four-bar build where the hats double up and get louder, the chords swell and a sawtooth riser climbs a scale, then the chorus lands with open hats. The chorus arrives at bar 9, 17 seconds in.",
        code: `${T(112)}${L04_SONG}`,
      },
      key: C,
      meter: "4/4",
      bpm: 112,
      canDo: ["cd.compose.energy"],
      uses: [
        ...BASE,
        ...VOICED,
        ...FORM,
        ...DRUMS,
        "snd.drum.oh",
        "tb.slow",
        "tb.signal",
        "tb.range",
        "tb.segment",
        "snd.wave.sawtooth",
      ],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 1,
          what: "Two items: the verse straight into the chorus (8 bars), then the same with the build between them (12 bars). Which chorus lands harder?",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`s("hh*16").gain(saw.range(.2, .9).slow(4))` over four bars: what do the hats do? (`choose`: get louder all the way / get louder every bar and drop back / stay level)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          panels: ["form"],
          features: ["panel.wave5"],
          minutes: 1,
          what: "The hook with the form map (each section's energy drawn under it): which section has the most energy (choice: the chorus); how many notes the riser plays in the build (number: 8).",
          term: "term.build-up",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The build\'s hats are level (`hatsBuild = s("hh*16").gain(⟪.5⟫)`): make them rise over the four bars, `saw.range(.2, .9).slow(4)` (`controls` matcher on `gain`, `scale: "linear"`, `tol: 0.1`, `track: "hats"`, against the reference; PLANNED matcher). Equivalent: `saw.slow(4).range(.2, .9)`.',
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1,
          what: "Two audio cards, the same verse–build–chorus: in A the chorus is louder, busier and higher than the verse; in B the chorus is the verse's level with new chords only. Which song's energy rises into the chorus? Pass text names the energy curve.",
          term: "term.energy-curve",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The riser is a smooth curve and plays nothing (`fxBuild = n(saw.range(0, 8)⟪⟫.slow(4))`): step it into eight notes with `.segment(8)` (`events`, absolute, `tracks: ["fx"]`, 12 bars; `must-use tb.segment`). Equivalent: `saw.segment(8).range(0, 8)` (the same eight values, evaluated).',
        },
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: 'Oak 2.0 W2 (DeSantis, "Repetition and Insistence"), S8: over drums only, `n(rand.range(0, 7).segment(8))` picks eight new notes every bar (4 bars), then its first bar, C4 A4 F4 F4 E4 D4 E4 F4, repeated eight times. Listen for the moment the repeated bar stops sounding random. Ungraded.',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1,
          optional: true,
          what: 'S9 "Freeze the bar" (optional): write bar 1 of the `rand` line as fixed numbers, `n("[0 5 3 3 2 1 2 3]")`, so the same bar plays every time. `rubric`: `matches` ≥ 0.75 against that bar looped (melody, absolute; Oak\'s loose call: a quarter of the notes may change) + custom `no-chance` `{ track: "mel" }` (no `rand`, `?`, `.degradeBy()`, `.sometimesBy()` left).',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Verse, build-up, chorus: shape the energy so the chorus lands.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "A verse and a chorus with the same level of everything. Add a four-bar build-up between them, drawn with a signal, and make the chorus land with more energy than the verse: louder, busier, higher or fuller.",
        required: {
          rule: "contrast",
          label: "The chorus has more energy than the verse",
          why: '`contrast` with `a: { section: "chorus" }`, `b: { section: "verse" }`, `axes: ["energy"]`, `minAxes: 1` (|ΔE| ≥ 0.15, `energyCurve`: loudness, density, register). The starter (chorus at the verse\'s level, new chords only) fails. PLANNED rule: fails check 2 until the grader lists `contrast`; there is no implemented rule that reads a section\'s energy, so this Make waits for it.',
        },
        suggestions: [
          'a signal draws the build (`uses`, `tool: "tb.signal"`)',
          'the song is verse, build, chorus (`form`, `pattern: "verse build chorus"`; planned, listed only once the grader has it)',
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Kick and snare from the Band in the flavour's kit; the learner's hats and chords are their own; jazz-soul swaps `piano` for `rhodes`.",
      },
      srs: [{ family: "fam.frm.sections", mode: "review-if-due", level: 2 }],
      mistakes: [
        "S4: `saw.range(.9, .2)` (falls instead of rising): fails the `controls` match; pin what the grader says",
        "S9: the frozen notes with `.degradeBy(.2)` kept: `rubric.unmet` (no-chance) with `melody.missing-note`; bar 2's notes frozen instead: `rubric.unmet` (matches)",
        "S4: `saw.range(.2, .9)` without `.slow(4)` (rises every bar and drops back): fails",
        "S6: `.segment(4)` (four notes, C E G B): `melody.missing-note`; `.segment(8)` after `.slow(4)` (eight notes a bar, 32 in the build): `melody.extra-note`; pin what the grader prints",
        'S6: the riser written as fixed notes `n("<[0 1] [2 3] [4 5] [6 7]>")`: passes (same events); the step\'s prompt asks for `.segment()`, so add `must-use tb.segment` with `code.must-use`',
        "the unchanged starters: `code.unchanged`",
        "Make starter: `rubric.unmet`",
      ],
      connects: {
        back: "U01.L09 slowed a pattern with `.slow()`; U09.L02 made the chorus lift by changing chords, register and parts. Now the lift is prepared over four bars.",
        forward: "U09.L05 brings parts in and out by bar with `.mask()`: intros, breaks and drops.",
      },
      epr: {
        enjoyment:
          "The learner builds the moment pop and dance music live for: four bars of rising hats and a climbing riser, then the chorus hits, and they made the curve that makes it hit.",
        pace: "One idea: energy rises into a section, drawn with a signal. `sine` and `perlin` are shown in one demo and left for Studio; `.mask()` and drops wait for U09.L05.",
        return:
          "The Coda says: you can shape a song's energy with a build-up drawn in code. Next: parts that enter and leave by bar, the arrangement.",
      },
      notes: [
        'Evaluated: `n(saw.range(0, 8).segment(8).slow(4)).scale("C4:major")` plays C4 D4 E4 F4 G4 A4 B4 C5, two a bar over the four bars of the build; inside `arrange()` the build restarts at its own bar 1. The hats double to sixteenths in the build and their gain rises from .2 to .9 (`saw` sampled at each hit).',
        "The form map's energy line is `formView(...).energy` (wave5.md §3.2); the investigate step's \"most energy\" answer is read from it.",
        "S4 is graded by the planned `controls` matcher on `gain` (`tb.gain` is `audible: true`): until it lands, grade S4 by `events` on the hats' onsets plus a `must-use` of `tb.signal`, and say so in the lesson.",
      ],
    },
    {
      id: "U09.L05",
      author: "U09b",
      idea: 'Inside a section, parts can come in and drop out by bar with `.mask()`: `.mask("<0 1 1 1>")` keeps a part silent in the first bar of four and lets it play in the other three. An intro brings the parts in one by one; a part that stops for the bar before the chorus makes the chorus land (a drop). Written inside the section\'s `const`, the mask restarts with the section.',
      hook: {
        hear: "An intro where the drums start alone, the bass comes in at bar 2, the chords at bar 3 and the tune leads in at the end of bar 4, then the full verse. Everything is playing 10 seconds in.",
        code: `${T(104)}${L05_SONG}`,
      },
      key: C,
      meter: "4/4",
      bpm: 104,
      canDo: ["cd.code.layers"],
      uses: [...BASE, ...VOICED, ...FORM, ...DRUMS, "tb.mask"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.75,
          what: "Two items: the verse with everything from bar 1 (4 bars), then the intro building part by part into it (8 bars).",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`bassIntro = n("<0 5 3 4>")….mask("<0 1 1 1>")`: when does the bass play in the intro? (`choose`: from bar 2 / only in bar 1 / every other bar)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          panels: ["form"],
          features: ["panel.wave5"],
          minutes: 1,
          what: "The hook with the roll and the form map: which part comes in last (choice: the tune); in which bar the chords enter (number: 3).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The chords play all through the intro: let them in at bar 3, `chordsIntro = chord("<C Am F G>").voicing().mask("<0 0 1 1>")` (`pcset`, `perOnset: true`, `tracks: ["chords"]`, 8 bars; edit-only-regions). Equivalent: `.mask("<0!2 1!2>")`.',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'A drop: the verse goes straight into the chorus; make the bass stop for the last bar of the verse, `bassVerse = …mask("<1 1 1 0>")`, so the chorus lands (`events`, octave-free, `tracks: ["bass"]`, 8 bars: verse then chorus).',
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["bar-buttons"],
          minutes: 1.25,
          graded: true,
          what: "A new eight-bar intro, roll hidden: click the bar where the bass comes in (`bar-buttons`, `bars: 8`; correct bar 3; a fixed code stimulus).",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "An intro that builds part by part into your verse and chorus, and a drop before a chorus.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Verse and chorus are arranged, with every part playing from bar 1. Add a four-bar intro that brings the parts in one at a time, and make one part drop out for the bar before a chorus.",
        required: {
          rule: "uses",
          label: "Parts come in or drop out with .mask(), twice or more",
          why: '`uses` with `tool: "tb.mask"`, `min: 2`: the intro\'s entries and the drop are two masks at least. Content-independent, so a learner who brings their own U09.L02 song passes the same way. The starter (no mask) fails.',
        },
        suggestions: [
          "the song is four tracks or more (`tracks`, `min: 4`)",
          "at least 16 bars (`bars`, `min: 16`)",
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Drums from the Band in the flavour's kit (they play from bar 1, the usual start of an intro); jazz-soul swaps `piano` for `rhodes` and `ebass` for `upright`.",
      },
      srs: [{ family: "fam.frm.sections", mode: "review-if-due" }],
      mistakes: [
        'S4: `.mask("<1 1 0 0>")` (in for two bars, then out): `harmony.pcset` / missing notes in bars 1–4; pin what the grader says',
        "S4: the mask on the verse const instead of the intro's: `code.edit-outside`",
        'S5: `.mask("<0 1 1 1>")` (the drop at the start of the verse): `melody.missing-note` and `melody.extra-note`',
        "S6: bar 2 for bar 3 (the bass heard under the first chord change): `id.wrong`",
        "the unchanged starters: `code.unchanged`",
        "Make starter: `rubric.unmet`",
      ],
      connects: {
        back: "U09.L02 rested a whole part in a section with `silence`; U09.L04 drew a build across a section. Now a part enters or leaves at any bar inside a section.",
        forward:
          "U10.L01 turns to minor keys; then U09.CP checks bass lines and form together and opens C3, a verse–chorus demo of at least 90 seconds.",
      },
      epr: {
        enjoyment:
          "The learner's song now starts like a record, drums alone and then each part arriving, and has a drop that makes the chorus hit: an arrangement they would play to someone.",
        pace: "One idea: parts in and out by bar with `.mask()`. Fades, filters and effects across sections are A1's (the side lessons A1.L05–L07 open after U09.CP); nothing new about sections themselves.",
        return:
          "The Coda says: you can bring parts in and out of an arrangement with `.mask()`. Next: minor keys in U10, then the U09 checkpoint, which opens C3 Verse–Chorus Demo.",
      },
      notes: [
        'Evaluated: in the hook the bass plays bars 2–8, the chords bars 3–8, the tune\'s lead-in G A on beats 3 and 4 of bar 4 into C5 on bar 5. `.mask("<0 1 1 1>")` inside a const that sits in a four-bar section restarts with the section (contracts §6.3 item 7).',
        "The drop step's reference is verse (4 bars) then chorus (4 bars) with `bassVerse` masked `<1 1 1 0>`: the bass is silent in bar 4 only.",
      ],
    },
    {
      id: "U09.L06",
      author: "content-lead",
      idea: 'Oak 2.0 W2 (DeSantis, "Three Ways to End", "Short Loops as Endings"). A song ends on purpose: its parts leave one at a time in the reverse order they came in, a loop of the last bar gets shorter as it repeats, a repeating loop fades away, or the music lands on a new last bar, V to I or one final hit, and stops. The closing section is the outro.',
      hook: {
        hear: "Three twelve- and eight-bar songs on the same chords, each ending a different way: the intro of Arranging in Code mirrored (the tune leaves first, then the chords, then the bass, one kick last); the last bar looped shorter and shorter; a fill into C after G and one hit with a crash.",
        code: `${T(100)}${L06_HOOK}`,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.compose.ending"],
      uses: [...BASE, ...VOICED, ...FORM, ...DRUMS, "tb.mask", "tb.signal", "tb.range", "snd.drum.cr"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.75,
          what: "Three endings: parts leave in the reverse of the intro (12 bars), a shrinking loop of the last bar (8 bars), a fill, V to I and one last hit (8 bars).",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: "The hook's outro masks (`melOutro` `<1 0 0 0>`, `chordsOutro` `<1 1 0 0>`, `bassOutro` `<1 1 1 0>`): which part stops first? (`choose`: the tune.)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          panels: ["form"],
          minutes: 1,
          what: "The hook with the roll: which part plays the last bar alone (choice: the drums, one kick); the last bar the bass plays in (number: 11).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          panels: ["form"],
          minutes: 1.25,
          graded: true,
          what: 'A song whose intro brings the chords, then the bass, then the tune: in the outro make them leave in the reverse order with a `.mask()` on each outro part. `rubric`: custom `ends-on-purpose` `{ modes: ["exit-order"] }` (at least two parts stop inside the last section for good; none stops before a part that came in after it; ties allowed).',
          term: "term.outro",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "The outro loops the phrase's last bar, G E D C, four times: rewrite it as that bar twice, its second half twice, its last note four times. `rubric`: custom `ends-on-purpose` `{ modes: [\"shrinking-tail\"] }` (the loop of material heard before gets shorter at least once: one shortening is enough, Oak's call written in the rule).",
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 0.5,
          what: "Two cards fade over their last four bars (`.gain(saw.range(.8, 0).slow(4))`): one fades a bar that repeats, the other fades over new chords. Pick the one that fades a loop.",
          term: "term.fade-out",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          panels: ["form"],
          minutes: 2.75,
          what: "Intro, verse and an eight-bar outro that is the verse twice: end the song on purpose, any way from today or a cadence on a new last bar.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Your song from earlier lessons has an intro, a verse and an eight-bar outro that plays the verse twice and just stops. Rewrite the outro so the song ends on purpose: parts leave in turn, a loop of the last bar shrinks, a repeating loop fades, a build, or a new last bar that lands V to I or on one final hit.",
        required: {
          rule: "custom",
          label: "The outro ends on purpose",
          why: "custom `ends-on-purpose` with every mode (exit-order, shrinking-tail, build-out, fades-out, cadence, final-hit). `cadence` and `final-hit` count only on a last bar heard nowhere earlier, so a verse that already ended on a stop bar does not pass by being played again. The starter (the verse twice to the last beat) fails.",
        },
        suggestions: [],
        band: false,
        flavours:
          "No Band: an ending is heard in the silence after it, and a Band would play on into it (AUTHORING §8 rule 8); the song carries its own drums. Jazz-soul swaps `piano` for `rhodes` and `ebass` for `upright`.",
      },
      srs: [{ family: "fam.frm.sections", mode: "review-if-due" }],
      mistakes: [
        "S4: the parts leave in the order they came in (chords first, tune last): `rubric.unmet`",
        'S4: a `.mask("1")` on every outro part, nothing silenced: `rubric.unmet`; only the tune leaves: `rubric.unmet`',
        "S5: the bar squeezed faster (`[[4 2 1 0]*2]`) instead of cut shorter: `rubric.unmet`; shorter, then back to the whole bar: `rubric.unmet`",
        "Make: every part stopping at the same moment on a bar heard before: `rubric.unmet`; a fade down to 0 (see notes)",
        "the unchanged starters: `code.unchanged`; Make starter: `rubric.unmet`",
      ],
      connects: {
        back: "U09.L05 opened a song by bringing parts in with `.mask()`; U09.L04 drew a curve with `saw.range()`; U05's V to I ends a phrase.",
        forward:
          "U09.L07 carves a whole song out of one loop by taking parts away; C3 and every capstone from C6 on ask for a song that ends on purpose.",
      },
      epr: {
        enjoyment:
          "The learner's song stops sounding like a loop that was switched off and starts ending like a record: parts walking off one by one, a last bar that stutters shorter, a fade, or a final hit.",
        pace: "One idea, four ways to do it, two of them graded (parts leaving, a shrinking loop). The fade and the cadence are heard and allowed in the Make; build-out is allowed without being taught.",
        return:
          "The Coda says: you can end a song on purpose in more than one way. Next: carving a song from one where everything plays all the time.",
      },
      notes: [
        "Evaluated: in the hook the tune plays bar 9 only, the chords bars 9–10, the bass bars 9–11, and the drums end on one kick in bar 12; `ends-on-purpose` exit-order reads it as the tune after bar 9, the chords after bar 10, the bass after bar 11.",
        "A fade to silence fails `fades-out` in production grading (W0 rule, reported in W2): the grader leaves out notes more than 24 dB under the loudest (`audibleInMix`), so the fade's last bars no longer repeat the loop. A fade down to `.05` or more passes; the Make's fade test and hint use `.1`.",
        "The take fills the song's eight-bar outro (`usong.U09`), so the Make's outro is eight bars; it takes the drums there as well, because the Make carries its own.",
      ],
    },
    {
      id: "U09.L07",
      author: "content-lead",
      idea: 'Oak 2.0 W2 (DeSantis, "Arranging as a Subtractive Process", "The Power of Erasing", "Fuzzy Boundaries", "Unique Events"). Start from one loop that every part plays in every section and only delete, whole parts or notes, until the sections differ; let one part stop a beat or two before a seam (a fuzzy boundary); let one bar happen only once (a unique event).',
      hook: {
        hear: "One loop in four sections, twice: every part everywhere, then carved: chords alone in the intro, drums and bass in for the verse, the tune saved for the chorus, the outro thinning out.",
        code: `${T(100)}${L07_HOOK}`,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.compose.carve"],
      uses: [...BASE, ...VOICED, ...FORM, ...DRUMS, "tb.mask", "snd.drum.oh", "snd.drum.cr"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items, 16 bars each: everything everywhere, then the same loop carved.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["number"],
          minutes: 0.5,
          what: "The carved version's code: how many parts play in the verse? (`count`: 3, drums, chords, bass.)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          panels: ["form"],
          minutes: 1,
          what: "Which section plays every part (choice: the chorus); in how many sections is the bass silent (number: 2).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          panels: ["form"],
          minutes: 1.25,
          graded: true,
          what: "Everything everywhere (chords, bass, tune in four sections): carve by deleting only. `rubric`: custom `carved` `{ minDiffer: 2 }` (the fullest section has every part; every other section's bars are its bars with parts or notes taken out; at least two line-ups of parts).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          panels: ["form"],
          minutes: 1.25,
          graded: true,
          what: 'The carved song with hats of its own: the verse\'s hats stop for the last two beats before the chorus, `s("<hh*8 hh*8 hh*8 [hh*4 ~]>")`, while the rest change on the bar line. `rubric`: custom `staggered-boundary` `{ min: 1 }` (a whole-bar move or every part moving by the same amount does not count).',
          term: "term.fuzzy-boundary",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          panels: ["form"],
          minutes: 1.25,
          graded: true,
          what: "Verse, chorus, verse, chorus with drums: a `drumsVerse2` whose last bar (bar 12) is a fill or a stop, heard once. `rubric`: custom `unique-event` `{ min: 1 }` (one bar of one part heard once, inside a section that comes back; a whole new section heard once does not count).",
          term: "term.unique-event",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          panels: ["form"],
          minutes: 2.75,
          what: "Your song with every part everywhere, over Oak's drums: carve it into sections.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Every part of your song (chords, bass, tune) plays in every section over Oak's drums. Carve it by deleting only, so the sections differ; if you like, blur one seam or let one bar happen once.",
        required: {
          rule: "custom",
          label: "The sections are carved from the fullest one",
          why: "custom `carved` `{ minDiffer: 2 }`. An additive build (a part playing something the fullest section never plays) fails, and so does every section losing the same part. The starter fails.",
        },
        suggestions: [
          "a fuzzy boundary at one seam (custom `staggered-boundary` `{ min: 1 }`)",
          "one bar heard once inside a section played twice (custom `unique-event` `{ min: 1 }`)",
          "an arc: the fullest section has a thinner one before and after it (custom `arc`)",
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Drums from the Band in the flavour's kit; the learner's chords, bass and tune are their own; jazz-soul swaps `piano` for `rhodes` and `ebass` for `upright`.",
      },
      srs: [{ family: "fam.frm.sections", mode: "review-if-due" }],
      mistakes: [
        "S4: a new bass line in the verse that the chorus never plays: `rubric.unmet`; the tune out of every section (one line-up): `rubric.unmet`; a section left out of one `arrange()`: `form.inconsistent-arrange`",
        "S5: the hats silent for the whole bar before the chorus (a bar-line move): `rubric.unmet`; the first half silenced instead: `rubric.unmet`",
        "S6: the fill written into `drumsVerse`, heard in both verses: `rubric.unmet`; `drumsVerse2` written but left out of the `arrange()`: `rubric.unmet`",
        "the unchanged starters: `code.unchanged`; Make starter: `rubric.unmet`",
      ],
      connects: {
        back: "U09.L02–L05 built songs up, section by section and part by part; U09.L06 ended them on purpose.",
        forward:
          "C3 Verse–Chorus Demo and every later capstone offer the seam, the once-only moment and the arc as suggestions; A2.L08 builds a whole arrangement down from its peak.",
      },
      epr: {
        enjoyment:
          "The learner finds an arrangement by taking away, the fast way producers work, and hears a drop of two beats or one bar that happens once make the song feel written rather than looped.",
        pace: "One idea, subtractive arranging, with two small moves in its service (a blurred seam, a once-only bar). The arc is a suggestion only.",
        return:
          "The Coda says: you can arrange by taking parts away and blur a section change. Next: minor keys in U10, then the U09 checkpoint.",
      },
      notes: [
        "`carved` counts line-ups of parts: a carve made only by masking bars and thinning notes, with every part still playing somewhere in every section, has one line-up and fails (W0 rule, reported in W2). The prompt asks for at least two different sets of parts, which is what the rule checks.",
        "`staggered-boundary` reads shifts only in parts whose material repeats every one or two bars inside the sections on both sides of the seam (hats, a drum groove, a pedal): a bass or chords that change every bar can stop early or hold over without the rule seeing it (reported in W2). S5 therefore moves the hats.",
        "The take fills the song's intro, verses and choruses with the learner's carved sections (four-bar sections looping inside the song's eight-bar ones); the outro stays the ending of U09.L06.",
      ],
    },
  ],
  checkpoint: {
    id: "U09.CP",
    author: "CP",
    authored: [
      {
        id: "bass-into-the-changes",
        kind: "code-modify",
        skills: ["B01", "B02", "B03"],
        what: 'Under a four-chord verse (chords in the code), a bass that plays C under every chord: give each chord its root on beat 1, a 5th or an octave in every bar, and an approach note into two changes (`rubric` matcher: `bass-line` with `roots: { on: "change", minRatio: 1 }`, `members: { allowed: ["root", "fifth", "octave", "approach"], minRatio: 0.9 }`, `approach: { min: 2 }`; planned rule, as U08.L02–L03).',
      },
      {
        id: "arrange-and-enter",
        kind: "code-modify",
        skills: ["F02", "F06"],
        what: "The section consts of a song are written (intro, verse, chorus for chords, bass and tune); only the chords are arranged. Arrange the bass and the tune intro, verse, chorus, verse, chorus, and let the bass in at bar 2 of the intro with `.mask()` (`events` on `bass` and `mel`, octave-free, 20 bars; `must-use tb.mask`).",
      },
      {
        id: "lock-it",
        kind: "code-modify",
        skills: ["B04"],
        what: "A kick on its own `const` rhythm and a bass on straight quarters: give the bass the kick's rhythm (`rhythm` matcher on `bass` against the reference, as U08.L04 S4).",
      },
    ],
    recipe: {
      items: [12, 16],
      families: {
        B04: ["fam.rhy.groove-lock"],
        F02: ["fam.frm.sections"],
        F03: ["fam.frm.sections"],
      },
      why: "B04 is measured by `fam.rhy.groove-lock` (levels 1–2) and the authored `lock-it`; F02 and F03 by `fam.frm.sections` at the learner's level (AABA against verse–chorus, four- or eight-bar phrases) and F02 also by `arrange-and-enter`. B01–B03 are code skills with no family: `bass-into-the-changes` measures them. F06 is measured by `arrange-and-enter`. F05 (the energy curve) has no family and no authored item: the checkpoint's Make measures it. No level-setting skills (contracts §7.6 map).",
    },
    make: {
      brief:
        "A verse and a chorus, four bars each, arranged verse, chorus, verse, chorus, with a build or a drop into the chorus and a bass that locks with the kick.",
      required:
        'F05: `contrast` `a: { section: "chorus" }`, `b: { section: "verse" }`, `axes: ["energy", "density", "register"]`, `minAxes: 1` (planned, as U09.L04\'s Make). Suggestions: `groove-lock` bass on kick ≥ 0.5 (B04) and `form` "verse chorus verse chorus" (F02), each planned and listed once the grader has them.',
    },
    notes: [
      "In the default order U09.CP is session 96, after U10.L01 (contracts §2.5): a later day than U09.L05. Passing or soft-passing it opens C3 (sessions 97–100) and the side lessons A1.L05–L07 (contracts §2.6), and makes B01–B04, F02, F03, F05 and F06 eligible for `mastered`.",
      "Every gated skill is a concept or creative skill (no bracketed skills in contracts §7.6's map), so every item is gating; no sing or tap item.",
      "Authored items use the exemplar's shapes where they can: `bass-into-the-changes` needs the planned `bass-line` rule; until the grader lists it, it is graded by `events` against a fixed bass shown on the bass staff (a Play-from-the-page item under C Am F G, a half note and two quarters a bar: C2 G2 B1 | A1 A2 E2 | F2 C3 F♯2 | G2 D3 B1: roots on beat 1, the 5th or the octave on beat 3, and an approach into every change, B1 into A1 from the step above, E2 into F2 and B1 into C2 from the half step below in the key, F♯2 into G2 from the half step below outside it), which measures the same three skills on one answer.",
      "`arrange-and-enter`'s intro is four bars with the bass masked `<0 1 1 1>`, then V C V C at four bars each: 20 bars, past the lesson-mode window of 16 bars of the learner's loop but within the reference's (`reference.bars: 20`; contracts §6.4 takes the larger of the two).",
    ],
  },
  capstones: [
    {
      id: "C3",
      author: "capstones",
      intent:
        "The first song with sections on the album (sessions 97–100 in the default order): a verse–chorus demo of at least 90 seconds, verse, chorus, verse, chorus, whose chorus differs from the verse on at least two counts, with a bass locked to the kick and a lead sheet to show for it. Session 1 lays down both sections' groove and changes; session 2 writes both melodies and makes the chorus lift; session 3 arranges the whole song to length and checks the lead sheet; session 4 (contracts 1.6, the learner's decision of 2026-11-13: the real-time take, the lead sheet and the review were too much for one 20-minute session) records the take, takes a review and releases. Everything it asks for was taught in U08–U09; nothing new is introduced. The learner may start from their own C2 (its eight bars become the verse).",
      opens:
        'When U09.CP is passed or soft-passed (contracts §2.4). Today then offers C3.S1 as the New block; a learner who puts it off keeps going into U10 (a capstone never gates a lesson). In progress, no gym slot interrupts it: GYM.06 waits until C3.S4 is done (§2.5). While it is closed the album shows its slot with "Opens after the bass and form checkpoint".',
      band: "None: a capstone is the learner's whole song, so the starter carries its own drums (a `kick:`, `snare:` and `hats:` line per section) and the recording, the cover and the liner notes cover everything that plays. The flavour sets the starter's kit and sounds (§5.10 rule 8: jazz-soul swaps `piano` for `rhodes` and `ebass` for `upright` and declares `swing`, which the lead sheet carries as \"Swing 8ths\") and never changes the rubric (§6.6).",
      sessions: [
        {
          id: "C3.S1",
          goal: "Groove and changes for verse and chorus.",
          opens:
            'The brief, then a choice of two starts. "Start from the template": section consts for both sections, 8 bars each (`kickVerse`, `kickChorus`, `snareVerse`, `hatsVerse`, `hatsChorus`, `chordsVerse = chord("<C Am F G>").voicing()`, `chordsChorus = chord("<F G C C>").voicing()`, `bassVerse`, `bassChorus` on the roots, all `0` where the learner decides), each track arranged verse–chorus once (16 bars), tempo 100, C major. "Start from my C2": the latest version of the learner\'s C2 track becomes the verse (its chords, bass and drums lines renamed to `chordsVerse`, `bassVerse`, …; its tune kept as `melVerse` for session 2) and the chorus consts start empty. Offered only when C2 is released.',
          hear: "The draft looping its verse and chorus (16 bars); a click on a section of the form lens loops that section alone; A/B against the last saved draft.",
          see: 'The capstone workspace: the Workbench (code, roll, lead sheet), the form lens ribbon over the roll (`tb.lens.form`) and the form map panel with each section\'s energy, the bass-role lens (roots, 5ths, approach notes, notes on the kick), and the C3 checklist read from `formView` and `bassView`: "Bass lands with the kick" (live, with the share), "Verse and chorus both have chords and a bass" (the sections found), then the S2 and S3 lines greyed with "next session". Session bar: "Session 1 of 4: Groove and changes".',
          work: [
            "Verse groove: kick, snare and hats; a kick rhythm in a `const` shared with the bass (U08.L04).",
            "Verse changes: a loop of four chords, one a bar, played twice in the eight bars (or the C2 verse as it is).",
            "Chorus changes: chords that start somewhere else (IV or vi is the usual lift) and end home or open; a chorus groove that is busier (open hats, a tambourine, eighths on the bass).",
            "A bass under both: roots on beat 1, 5ths and octaves, approach notes into the changes, locked to the kick.",
            "One `arrange()` per track that changes; the drums that never change may stay through.",
          ],
          checks: [
            '`capstones.check` runs the whole rubric on each save; the session\'s lines are `groove-lock` (`kick: "@drums"`, `bass: "@bass"`, `min: 0.5`; labelled "Bass lands with the kick") and the sections the form view finds (both a verse and a chorus with chords and bass). The `form`, `contrast`, `duration-sec` and lead-sheet lines are shown as "next sessions" and never fail the draft.',
            "Nothing blocks saving; the draft is the session's Make (contracts §9.1). The session is done when a draft is saved (`capstones.saveDraft`, then `capstones.completeSession`).",
          ],
          ends: 'Draft saved and bound to C3.S1; the Coda says "Next time: the tunes, and a chorus that lifts" and shows the lines that are met. No review, no release.',
        },
        {
          id: "C3.S2",
          goal: "Melodies and section contrast.",
          opens:
            'The C3.S1 draft. `melVerse` and `melChorus` consts are added if the draft has none (`n("⟪~⟫").scale(…)` in the draft\'s key), with a `mel:` line arranged like the others.',
          hear: "The draft under the tunes as they grow; the section loop on the form lens to work on one section at a time; A/B between verse and chorus at the same bar of each.",
          see: 'The same workspace with the chord-tone and range lenses; the form map now draws each section\'s features and the contrast hints from `contrastAxes` ("The chorus is higher (+5 half steps), denser and louder than the verse"). The checklist line "The chorus differs from the verse on two counts or more" is live, with the counts it hears. Session bar: "Session 2 of 4: Tunes and contrast".',
          work: [
            "A verse tune in the middle of the voice: a motif that comes back, chord tones on beats 1 and 3 (U07).",
            "A chorus tune with the hook: higher than the verse (the register line moves), longer notes or a repeated hook phrase.",
            "Make the chorus lift on at least two counts the checklist names: tune higher (pitch, register), busier (density), more parts or louder (energy), new chords (harmony).",
            "Optional: a build-up into the chorus drawn with a signal (U09.L04) or a drop with `.mask()` (U09.L05).",
          ],
          checks: [
            '`contrast` (`a: { section: "chorus" }`, `b: { section: "verse" }`, `axes: ["pitch", "density", "harmony", "register", "energy"]`, `minAxes: 2`), labelled "The chorus differs from the verse on two counts or more"; the line names the counts that pass and the nearest one that does not.',
            "`groove-lock` stays live from S1. Saving is never blocked.",
          ],
          ends: 'Draft saved and bound to C3.S2; Coda: "Next time: the whole song to 90 seconds, and its lead sheet".',
        },
        {
          id: "C3.S3",
          goal: "Arrange V C V C; lead sheet.",
          opens: "The C3.S2 draft. The form map shows its length in bars and seconds against 1:30.",
          hear: "The whole song from bar 1, or any section looped from the form lens.",
          see: 'The same workspace with the lead-sheet view (section labels and double bars at each section, chord symbols, "Swing 8ths" when the flavour swings); the full checklist live. No "Release" yet: the session bar reads "Session 3 of 4: Arrange and the lead sheet", and the take is next time.',
          work: [
            "Arrange verse, chorus, verse, chorus with one `arrange()` per track that changes; a second chorus may be a variant (`melChorus2`) or twice as long.",
            "Reach 90 seconds: at 100 BPM a bar lasts 2.4 seconds, so 8-bar sections give 77 seconds; double the last chorus (40 bars, 96 seconds) or slow to 84 BPM or under (32 bars, 91 seconds). An intro or outro is not a section the `form` rule accepts (see notes).",
            "Open the lead sheet and fix what it cannot write exactly (a tuplet, a note shorter than a sixteenth, a melody track with chords in it).",
          ],
          checks: [
            'The whole rubric of contracts §6.6 C3 (content/capstones.ts): `form` "verse chorus verse chorus" (tags allowed); `contrast` on ≥ 2 axes; `duration-sec` ≥ 90 from the AST (`arrange()` sum ÷ cps, never played); `groove-lock` bass on kick ≥ 0.5; `notates` `view: "lead-sheet"` (renders with `approximate = false`; a declared swing passes). Labels: "Verse, chorus, verse, chorus", "The chorus differs from the verse on two counts or more", "At least 90 seconds", "Bass lands with the kick", "The lead sheet writes your song exactly".',
            "Saving is never blocked: a draft with open lines carries them to the last session.",
          ],
          ends: 'Draft saved and bound to C3.S3; Coda: "Next time: press record, hear the whole song once through, and release it". The lines that are met are listed; nothing is recorded yet.',
        },
        {
          id: "C3.S4",
          goal: "Record the full take, review, release.",
          opens:
            "The C3.S3 draft, with the checklist as it stood. A learner who was part-way through the old three-session C3.S3 opens here with everything kept: the draft, every passed check, a take already recorded (then only the review and the release are left).",
          hear: "The take: the final version played once in full while it records, 90 seconds or more of the learner's own song with nothing to do but listen. Then the recording, from the album player.",
          see: 'The workspace with the full checklist, then "Record the take" (a count-in, the song\'s length as a progress line over the form map, each section lighting as it plays), "Review" and "Release", with "Check again before you release" whenever the draft changed after its last passing check (c1). Session bar: "Session 4 of 4: The take and the release".',
          work: [
            "A last pass over the open checklist lines, if any.",
            "Record the take: the whole song in real time (about 96 seconds at the template's tempo). It can be taken again; every take is kept as a version (d20).",
            "Ask for a review (optional, never affects pass or fail), then release: title, the learner's one line for the liner notes, the cover.",
          ],
          checks: [
            "The whole rubric once more, on the code being released (contracts §6.6 Release): release is allowed once every required line is met on that code; the tutor review (contracts §10.6, `reviewRevisions: 1`) is offered before release.",
          ],
          ends: 'Review offered (`review: true`), then release (`release: true`): album track C3 v1 with a recording (`OakStrudel.recorder`, `album.putAudio`), a tree-ring cover drawn from the code (its rings follow the sections), deterministic liner notes and the learner\'s own line; milestone ms.11 "You can now write a song with a verse and a chorus." Revising later makes v2.',
        },
      ],
      linerNotes: [
        'Deterministic (`linerNotes` of @oak/grader, at release): key, tempo, meter, length in bars and minutes ("40 bars, 1:36"); the form in names and letters ("verse–chorus, ABAB") with each section\'s bars; the chords of each section as numerals ("verse I–vi–IV–V, chorus IV–V–I–I"); how the chorus differs, named from `contrastAxes` ("higher by 5 half steps, twice as busy, louder"); the bass lock ("78% of bass notes on the kick"); instruments and the flavour; tools used (`arrange`, `const`, signals, `.mask()` when present).',
        'The learner\'s inputs at release: the track title (default "Verse–Chorus Demo") and one line (`album.patchVersion` `linerNotesMd`), prompted with "What makes your chorus lift?"; when the draft started from C2, the notes say "Grown from C2" with its title.',
        "The tutor's listening note only with consent (`includeReviewNote`, default `Settings.linerNotesInAlbum`).",
      ],
      tests: [
        "The brief's starter fails (chords and drums only: no bass for the lock, one contrast axis, 32 bars at 100 BPM is 76.8 seconds), and so does the C3.S1 template (16 bars, no tune).",
        'Per shipped flavour, one passing piece (contracts §6.6): pop at 100 BPM, 8-bar verse and chorus and a 16-bar last chorus (`melChorus2`), chorus tune 5 half steps higher with open hats; indie at 84 BPM, 32 bars, a chorus that adds a pad and moves the tune up an octave; funk at 104 BPM with a sixteenth-note bass that shares the kick\'s `const`; jazz-soul swung (`swing` declared, `swingBy(1/3, 4)` on the hats) with `rhodes` and `upright` and a lead sheet that says "Swing 8ths".',
        'Fails, one per rule: V C V V (`form`); a chorus that changes only its chords (`contrast`, one axis); 32 bars at 100 BPM, 76.8 seconds (`duration-sec`); a bass on straight eighths against a kick on 1 and the "and" of 2 (`groove-lock` below 0.5); a melody with a triplet the lead sheet cannot write exactly (`notates`).',
        "The convention test of contracts §6.3 item 8: a piece whose bass has its sections in another order than the chords fails `form` with `form.inconsistent-arrange`, which names the first disagreement.",
      ],
      notes: [
        'content/capstones.ts is author:capstones\'. Its C3 entry still has `custom("leadsheet-exact")`: replace it with `notates` (`view: "lead-sheet"`), planned until the grader builds it with @oak/notation (wave5.md §3.2). `groove-lock` keeps `kick: "@drums"` (the rule takes the kick sound out of any drum track, so both a `kick:` line and a whole-kit `drums:` line work). Its starter (8-bar sections V C once more, with a whole-kit `drums:` line using `,`) should follow STYLE §2 rule 5 (one labelled line per drum) and the session starters above.',
        'Length: contracts §6.6 asks for `form` = "verse chorus verse chorus" exactly, so an intro or an outro makes the form line fail; the brief says so ("start on the verse; no intro yet"), and the duration arithmetic is in the session text. Allowing an optional intro and outro would need a contracts change (reported).',
        '"Start from my C2" needs the capstone workspace to copy a released album track into a new draft (code the learner wrote, so not imported code under c2); until the capstone engineer builds it, the brief tells the learner to open their C2 track in Studio and paste its chords and bass into the verse consts.',
        "The cover's rings follow the sections (one band of rings per section) only if the cover reads `formView`; otherwise it is drawn as for C2.",
        "After editing content/capstones.ts, run `bun scripts/content/spec.ts`: this document renders C3's rubric and starter from it.",
      ],
    },
  ],
};
