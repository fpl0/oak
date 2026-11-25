// U08 Bass Lines: the unit spec (rendered to content/specs/U08.md by `bun scripts/content/spec.ts`).
// Every hook was evaluated with headless Strudel and linted in its lesson; U08.L01 is the exemplar, written
// and passing with the real grader (content/core/U08/L01).
import type { UnitSpec } from "./types.ts";

const C = { tonic: "C", mode: "major" } as const;
const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;

/** What every U08 lesson has from U03–U07 (the voicing gate is met: U05.L08 cannot be completed without it). */
const BASE = [
  "tb.setcpm",
  "tb.label",
  "tb.mini.seq",
  "tb.mini.rest",
  "tb.mini.sub",
  "tb.mini.alt",
  "tb.mini.elongate",
  "tb.mini.replicate",
  "tb.mini.repeat",
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
  "tb.struct",
  "tb.feature.degree-labels",
  "tb.feature.grand-staff",
  "tb.feature.rn",
] as const;
/** The tools behind the voicing gate, open since U05.L08. */
const VOICED = ["tb.chord", "tb.voicing", "chord.triad"] as const;
/** Note names with accidentals: the chromatic approach notes of U08.L03. */
const NAMES = ["tb.note", "tb.note.names", "tb.note.accidentals"] as const;
const DRUMS = ["snd.drum.bd", "snd.drum.sd", "snd.drum.hh"] as const;

/** Triads stacked on `roots` (n values, one a bar), as in U06.L01. */
const chords = (roots: string) => `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("piano")`;
/** A bass line in degrees, an octave below the chords, with the C1 bass preset. */
const bass = (pattern: string, sound = "ebass") =>
  `bass: n("${pattern}").scale("C2:major").s("${sound}").lpf(600)`;
/** A bass shape (`[0 ~ 4 ~]`: root, then the 5th) moved onto each root, like a chord stack. */
const shape = (cell: string, roots: string) =>
  `bass: n("${cell}").add(n("${roots}")).scale("C2:major").s("ebass").lpf(600)`;
const AXIS = "<0 4 5 3>";
const DOO_WOP = "<0 5 3 4>";
const TUNE = 'mel: n("<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>").scale("C4:major").s("piano")';

export const U08: UnitSpec = {
  unit: "U08",
  title: "Bass Lines",
  summary:
    "Six lessons on the line at the bottom of a song. The bass first plays each chord's root on its downbeat (the floor under the chord), then a three-note vocabulary of root, 5th and octave moved onto each root the way a chord stack is (`n(\"[0 ~ 4 ~]\").add(n(\"<0 4 5 3>\"))`), then approach notes that lead into the next chord a step or a half step away, then a rhythm shared with the kick drum, named once in a `const` and used by both lines, and, from Oak 2.0 (U08.L06), its opposite: a bass that plays only between the kicks, so kick and bass take turns as one line. The unit closes by taking bass lines down by ear and choosing the bass's tone (`fingerbass`, the synth-bass recipe, the filter). The learner's genres live on these bass lines: pop's root eighths, rock's root–5th, disco's octave bounce, soul's approach notes, funk's lock with the kick. U08 has no checkpoint of its own: U09.CP covers U08 and U09. U08.L01 sits before U07.CP in the default order (session 76); U08.L02–L05 follow C2 and X1.",
  conventions: [
    'A bass line is written in degrees an octave below the chords: `n("<0 4 5 3>").scale("C2:major").s("ebass").lpf(600)` under chords stacked from C3. "The bass takes the chord\'s own number": the number in the chords\' `.add()` is the bass\'s `n` (both count from 0), so the off-by-one of U06 (degree 6 written as 6) is again the realistic mistake, and every graded step that turns chords into a bass pins it (`melody.wrong-degree`).',
    'A bass shape is a cell moved onto each root with `.add()`, exactly like a chord stack (U06.L01): `n("[0 ~ 4 ~]").add(n("<0 4 5 3>"))` is root–5th under I V vi IV. The cell goes on the left (`.add()` keeps the structure of the pattern on its left, U06.L08). Inside a major key the 5th above every root but vii° is a perfect 5th (n + 4) and the octave is n + 7; "the octave is 8" is the off-by-one to pin (n 8 is degree 9).',
    'Chromatic approach notes (a half step below the next root that is not in the key: G♯ into A, F♯ into G, C♯ into D) are written as note names, `note("<[c2 ~ c2 g#1] …>")`, because chromatic `n` steps wait for U15.L01. Diatonic approach notes (a step above or below, in the key) may stay in degrees. Approach notes sit on the last beat (or the last eighth) before the change; the new root still lands on beat 1.',
    '`.rootNotes(2)` (U08.L01) reads chord names and plays their roots in octave 2: `chord("<C G Am F>").rootNotes(2)` = C2 G2 A2 F2 (evaluated). It is the bass\'s way of following a chord line written as names. `chord("C").voicing()` puts E3 at the bottom (evaluated), so a chord-name loop without a bass stands on its 3rd: the first reason a bass exists.',
    '`const` (U08.L04) names a pattern once so two lines share it: `const hits = "x ~ ~ x ~ ~ x ~"`, then `kick: s("bd").struct(hits)` and `bass: n("<0 4 5 3>").struct(hits)…`. Only a mini-notation string or a pattern goes in a `const`; the labelled lines still play. Section consts and `arrange()` wait for U09.L02.',
    'Words that wait: "syncopation" (U13.L01; say "between the beats", "off the beat", "a push"), "walking bass" (J3.L04; U08.L03 says "approach notes"), "section", "verse", "chorus" as terms (U07.L06 used "section" plainly; the form terms are U09\'s), "filter", "cutoff", "resonance" as terms (A1.L02, a side lesson the learner may not have taken: U08.L05 says "darker", "brighter" and "the bass preset `.lpf(600)`"). New terms in U08: "approach tone" (U08.L03), "groove lock" (U08.L04). U08.L01, L02 and L05 introduce none: "root", "5th" and "octave" are the learner\'s already (U02, U04, U05).',
    'Harmony under a bass is a `chords:` line in the learner\'s code whenever a rule must read it (the grader is not given the Band, AUTHORING §8 rule 5): the Band plays `tracks: ["drums"]` (U08.L01–L03, L05). In U08.L04 the learner writes the kick, so the Band plays `tracks: ["chords"]` and the bass follows the Band\'s I V vi IV roots; the groove rule reads only the learner\'s kick and bass.',
    'Grading (AUTHORING §18): a bass written as degrees is an `events` match on the `bass` track (`octave-free` where the octave does not matter, `absolute` where it is the point, U08.L02). "Root on each downbeat" is `matches` with a `harmony` matcher at `level: "bass"` against a root bass (implemented: the lowest note sounding at each chord change is compared with the chord\'s root, so a bass that repeats, holds or decorates its roots passes; U08.L01 and L05 Makes). The `bass-line` rule (`members`, `approach`, U08.L02–L03 Makes) and `groove-lock` (U08.L04) are graded and listed as implemented (Wave 5 Build).',
    'Staff and scaffolds (AUTHORING §6, U08 row): degree labels on the roll; the bass staff (`staff: "bass"`) for bass lines, the grand staff for chords over a bass, numerals in the chord band (`tb.feature.rn`). U08\'s Play from the page step is U08.L02 S5: a root–5th line on the bass staff only, no code, no roll, written in code.',
    'Singing: the bass in the learner\'s own range, on syllables with numbers shown (contracts §8.3), `labels: "syllables"`, `fallback: "identify"`; never graded, never gating. Quiet mode replaces it with naming the degrees.',
    "Ear training: `fam.har.bass` (bass degree under a loop) is reviewed in U08.L01 and L05 (levels 2 and 4; level 5 waits for U10.L04); `fam.rhy.groove-lock` is seeded in U08.L04 at level 1 (stage H's groove family, contracts §7.3). U08.L05's bass dictation is a by-ear step (`byEar`, A/B at the bar, rates 1, 0.75, 0.5), the lesson-sized version of ladder L2.",
    'Feedback the grader emits on U08 steps (pin what `bun run content:check <id> --verbose` prints): `melody.wrong-degree` (a bass note on the wrong degree: "Bar {bar}: the bass plays {got}, the chord\'s root is {exp}" when overridden), `melody.octave` (U08.L02\'s octave step), `harmony.bass` (the Make\'s root check: "Chord 2 (bar 2): bass is C; you should hear G"), `code.must-use` (`.rootNotes()`, `const`), `code.edit-outside`, `code.unchanged`, `rhythm.missing` / `rhythm.extra` (U08.L04\'s shared rhythm), `rubric.unmet` (override it with the neutral "{label}: not yet.": an override serves every rule of the rubric, suggestions included).',
  ],
  lessons: [
    {
      id: "U08.L01",
      author: "content-lead",
      idea: "A bass line's first job is the floor: on the downbeat of each chord it plays that chord's root, low, so the chord stands on its own note. In code the root bass takes the chords' own numbers an octave down; from chord names, `.rootNotes(2)` reads the roots for you.",
      hook: {
        hear: "The four-chord loop with its tune over the Band's drums, first with no bass (the chords float), then with a bass on each root (the floor drops in). Both play within the first 30 seconds.",
        code: `${T(92)}${chords(AXIS)}\n${TUNE}\n${bass(AXIS)}`,
      },
      key: C,
      meter: "4/4",
      bpm: 92,
      canDo: ["cd.code.root-bass"],
      uses: [...BASE, ...VOICED, "tb.rootNotes"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items over the drums: the loop and tune without a bass, then the same with a root bass. Floor in.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`n("<0 4 5 3>")` under the chords\' `.add(n("<0 4 5 3>"))`, over `.scale("C2:major")`: which note of each chord does it play? (`choose`: the root, lower down / the top note / the tune\'s note)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "The hook with the roll: when does the bass move (choice: on beat 1, with the chord); bar 3 is Am, which degree is the bass (number: 6; 5 is the `n`, pinned).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The doo-wop order I vi IV V with a bass `n("<0 ⟪0 0 0⟫>")`: give each chord its root (`<0 5 3 4>`; `events`, octave-free, `tracks: ["bass"]`; edit-only-regions; the target\'s roll after one failed try). Equivalent: `<0 -2 3 4>` (vi from below).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The chords as names, `chord("<C G Am F>").voicing()`; replace the bass with `chord("<C G Am F>").rootNotes(2)` (`events`, octave-free; `must-use tb.rootNotes`). Equivalent: `.rootNotes(1)`.',
        },
        {
          kind: "sing",
          exercise: "sing",
          minutes: 1.5,
          what: 'Sing the doo-wop loop\'s roots in your own range, do la fa sol (`mode: "degree"`, `labels: "syllables"`, `fallback: "identify"`).',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A floor for the four-chord loop, then a rhythm of your own.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The four-chord loop over the drums, with a bass that sits on C under every chord. Give each chord its root on beat 1; then play with the bass's rhythm: repeat the root, hold it, or answer the kick.",
        required: {
          rule: "matches",
          label: "Each chord's root in the bass on its beat 1",
          why: '`matches` against `chords + n("<0 4 5 3>").scale("C2:major")` with `{ m: "harmony", level: "bass", qualityDepth: "triad", inversion: false, harmonicRhythm: "given" }`, `min: 0.75`: the lowest note at each chord change is the chord\'s root in at least three bars of four. The starter (C under every chord) scores 0.25 and fails; eighths on the roots, `.rootNotes(2).struct(…)` and root–5th lines pass. Override `rubric.unmet` with "{label}: not yet."',
        },
        suggestions: [
          'the bass between C1 and C3 (`range`, `within: ["c1", "c3"]`)',
          "a tune on top (`tracks`, melody)",
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Drums from the Band in the flavour's kit; a jazz-soul starter swaps `piano` for `rhodes` and `ebass` for `upright` (both unlocked by U05.L08). Funk keeps `ebass`: `fingerbass` waits for U08.L05.",
      },
      srs: [{ family: "fam.har.bass", mode: "review-if-due", level: 2 }],
      singOn: "syllables",
      mistakes: [
        "the numerals read as degrees in the bass (`<0 6 4 5>` for I vi IV V): `melody.wrong-degree` per bar, overridden to name the chord's number in `.add()`",
        "the chords changed as well: `code.edit-outside`; the unchanged starter: `code.unchanged`",
        "the roots written as degrees where the step asks for `.rootNotes()`: `code.must-use`",
        "the chord names in another order in `.rootNotes()`: `melody.wrong-degree`",
        'Make starter (C under every chord) and a bass on each chord\'s 3rd: `rubric.unmet` with `harmony.bass` per bar ("Chord 2 (bar 2): bass is C; you should hear G")',
      ],
      connects: {
        back: "U06.L05 heard and sang the bass degree under a loop; U06.L11 let a bass track decide an inversion. C1's note-name bass was three notes; now each note is a chord's root.",
        forward: "U08.L02 gives the bass more to say on each chord: the 5th and the octave.",
      },
      epr: {
        enjoyment:
          "The learner puts a floor under the four-chord loop they have played since U05 and hears it become a band: drums, chords, tune and their own bass, in a rhythm they choose (a note a bar, pumping eighths, or a line that answers the kick).",
        pace: "One idea: the root on the downbeat. Root–5th, approach notes, the kick lock and bass tone are each held back for their own lesson; `.rootNotes()` is only the same idea read from chord names.",
        return:
          "The Coda says: you can write a bass line on the roots of any chord loop, in degrees or from names. Next: the 5th and the octave, the three notes most bass lines are made of.",
      },
      notes: [
        'The exemplar: content/core/U08/L01 passes every content-CI check with the real grader. Evaluated: `n("<0 4 5 3>").scale("C2:major")` and `chord("<C G Am F>").rootNotes(2)` both play C2 G2 A2 F2; `chord("<C G Am F>").voicing()` puts E3 under C and the root lowest under G, Am and F.',
        "The required rule is `matches` + `harmony` at level `bass` (implemented) rather than the planned `bass-line` with `roots`, so the exemplar ships before the grader adds `bass-line`. U08.L05's Make reuses it.",
      ],
    },
    {
      id: "U08.L02",
      author: "U08a",
      idea: 'Most bass lines use three notes per chord: the root, the 5th above it and the root an octave up. In code a bass shape is a cell moved onto every root with `.add()`, like a chord stack: `n("[0 ~ 4 ~]").add(n("<0 4 5 3>"))` is root–5th under the whole loop; +7 is the octave.',
      hook: {
        hear: "The four-chord loop and the Band's drums under three basses in turn: roots (U08.L01), root–5th on beats 1 and 3 (rock and country), and an octave bounce in eighths (disco).",
        code: `${T(100)}${chords(AXIS)}\n${shape("[0 7]*4", AXIS)}`,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.write.bass-line"],
      uses: [...BASE, ...VOICED, "tb.rootNotes"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.75,
          what: "Three items over the drums: the root bass, root–5th, octave bounce. Same chords, three grooves.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`n("[0 ~ 4 ~]").add(n("<0 4 5 3>"))`: what does the 4 add on beat 3? (`choose`: the 5th above each root / the 4th / a note of the tune)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "A root–5th–octave line `[0 4 7 4]` under the loop, with degree labels: which number gives the root an octave up (choice: 7); over G in bar 2, the 5th is which degree of C (number: 2, D).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Octave bounce: `n("[0 ⟪0⟫]*4").add(…)` → `[0 7]*4` (`events`, `absolute`, `tracks: ["bass"]`: the octave is the point; edit-only-regions).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Play from the page: a two-bar root–5th line under C and G (C2 G2 | G2 D3, half notes) on the bass staff only (`staff: "bass"`, no roll, no code shown); write the bass cell and roots in code (`events`, absolute). Starter: `bass: n("⟪…⟫").add(n("<0 4>")).scale("C2:major")`.',
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1,
          what: "Two audio cards under the same chords: root–5th and root–octave. Which one jumps the whole octave?",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A bass of roots, 5ths and octaves under the four-chord loop.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The four-chord loop over the drums, with a bass that walks root to 3rd. Swap the 3rd for the 5th or the octave, then build your own pattern from root, 5th and octave: any rhythm, any order.",
        required: {
          rule: "bass-line",
          label: "The bass plays only roots, 5ths and octaves",
          why: '`bass-line` with `members: { allowed: ["root", "fifth", "octave"], minRatio: 0.9 }`, `track: "bass"`, `harmony: "chords"`. The starter `[0 ~ 2 ~]` (root, 3rd) fails; a root-only line passes (the brief invites more, a suggestion asks for it).',
        },
        suggestions: [
          'the 5th or the octave in at least two bars (`bass-line`, `members: { allowed: ["fifth", "octave"], minRatio: 0.25 }`)',
          'the bass between C1 and C3 (`range`, `within: ["c1", "c3"]`)',
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Drums from the Band; jazz-soul swaps `piano` for `rhodes` and `ebass` for `upright` in the starter.",
      },
      srs: [{ family: "fam.int.in-key", mode: "review-if-due" }],
      mistakes: [
        'the octave written as 8 ("an octave is eight notes"): `melody.wrong-degree` (n 8 is degree 9); pin it on the octave step',
        "the octave written as -7 (the octave below) in the absolute step: `melody.octave`",
        'the cell written on the right (`n("<0 4 5 3>").add(n("[0 ~ 4 ~]"))`): one note a bar (contracts §0.4 / U06.L08); pin what the grader says (`melody.missing-note` expected)',
        "Play from the page: the 5th written as 5 (degree 6): `melody.wrong-degree`; the unchanged starter: `code.unchanged`",
        "Make starter (root and 3rd): `rubric.unmet`",
      ],
      connects: {
        back: "U04's intervals in a key (the 5th is four steps up, the octave seven); U06.L01's `.add()` moved a chord stack onto any root, and now it moves a bass cell.",
        forward: "U08.L03 adds the note just before each change: the approach.",
      },
      epr: {
        enjoyment:
          "The same four chords become rock, country and disco by changing one bass cell; the learner leaves with a bass groove of their own over the loop, one they will want to loop for a while.",
        pace: "One idea: three notes per chord (root, 5th, octave) moved onto each root with `.add()`. The 3rd stays out of the bass (it muddies the chord when held low); approach notes wait for U08.L03.",
        return:
          "The Coda says: you can write a bass line from root, 5th and octave under any loop. Next: approach notes that pull the bass into each new chord.",
      },
      notes: [
        'Evaluated: `n("[0 7]*4").add(n("<0 4 5 3>")).scale("C2:major")` plays C2 C3 ×4 | G2 G3 ×4 | A2 A3 ×4 | F2 F3 ×4. Root + 4 under every chord of the loop is a perfect 5th (G, D, E, C).',
        "The Play from the page staff renders the line on the bass clef; the step's example uses half notes so the staff needs no ties (contracts §2.8 before U13.L03).",
      ],
    },
    {
      id: "U08.L03",
      author: "U08a",
      idea: "An approach note is the bass note just before a chord change, a step or a half step from the new root, so the line leans into it: from the step above, from the step below in the key, or from a half step below that is outside the key (G♯ into A). The new root still lands on beat 1.",
      hook: {
        hear: "The doo-wop loop over the drums with the root bass of U08.L01, then the same bass with one note changed at the end of each bar: B into Am, E into F, F♯ into G, B into C. The line now pulls forward.",
        code: `${T(92)}${chords(DOO_WOP)}\nbass: note("<[c2 ~ c2 b1] [a1 ~ a1 e1] [f1 ~ f1 f#1] [g1 ~ g1 b1]>").s("ebass").lpf(600)`,
      },
      key: C,
      meter: "4/4",
      bpm: 92,
      canDo: ["cd.compose.approach-tones"],
      uses: [...BASE, ...VOICED, ...NAMES],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items over the drums: the root bass, then the same bass with an approach note on beat 4 of each bar.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: "Bar 1 ends on B before Am: does the bass step down into A, step up into A, or leap? (`choose`)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "The hook with the roll: where the approach notes sit (choice: beat 4, just before each change); how many half steps from F♯ to G (number: 1).",
          term: "term.approach-tone",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Bar 4 stays on G to the end of the bar: `note("<… [g1 ~ g1 ⟪g1⟫]>")`. Lead it into C from the half step below (`b1`; `events`, absolute, `tracks: ["bass"]`; edit-only-regions). The answer from the step above (`d2`) fails with a note saying the step asks for below.',
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1,
          graded: true,
          what: "Four short examples, each a bar of root and an approach into the next chord: from a step above, a step below, or a half step below outside the key? (`choice`, a fixed code stimulus per item; replays unlimited.)",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Approach notes into at least two of the four changes, in a bass of your own.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The doo-wop loop over the drums with a root bass. Lead the bass into at least two of the changes with an approach note on the last beat, from above or below, in the key or a half step outside it. Keep each new root on beat 1.",
        required: {
          rule: "bass-line",
          label: "Approach notes lead into two changes or more",
          why: '`bass-line` with `approach: { min: 2 }` (either kind), `track: "bass"`, `harmony: "chords"`. The starter (roots only) fails.',
        },
        suggestions: [
          "every chord still on its root on beat 1 (`matches` + `harmony` level `bass`, `min: 0.75`)",
          'a chromatic approach (`bass-line`, `approach: { min: 1, kinds: ["chromatic"] }`)',
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Drums from the Band; jazz-soul swaps `piano` for `rhodes` and `ebass` for `upright` in the starter.",
      },
      srs: [{ family: "fam.mel.nct", mode: "review-if-due", level: 1 }],
      mistakes: [
        "the approach from the step above where the step asks for below (`d2`): `melody.wrong-degree`, overridden to say which side",
        "the approach note on beat 1 and the root late (the line shifted by a beat): `melody.wrong-degree` / `rhythm.displaced`; pin what `--verbose` prints",
        "a flat written as a sharp spelling the learner has not met in this key (`gb1` for `f#1`): passes (same sound); the prose spells F♯",
        'ear: the half step below heard as the step below (F♯ vs E into G): `id.wrong`, overridden: "Count the half steps on the keyboard: one, or two?"',
        "Make starter: `rubric.unmet`",
      ],
      connects: {
        back: "U07.L04's passing and neighbour tones stepped between chord tones in the tune; an approach note is the bass's version, leaning into the next root.",
        forward:
          "U08.L04 locks the bass's rhythm to the kick drum, so the approach lands where the drums push too.",
      },
      epr: {
        enjoyment:
          "One changed note per bar turns a plodding bass into one that pulls the song forward; the learner's Make is a bass line with movement they chose, the sound of soul and Motown basses.",
        pace: "One idea: the note before the change. Rhythm is held still (the approach is on beat 4); the kick lock waits for U08.L04, and walking a whole bar is jazz's (J3.L04).",
        return:
          "The Coda says: you can lead a bass into each new chord with an approach note. Next: lock the bass to the kick drum with one shared rhythm.",
      },
      notes: [
        "Evaluated: the hook's bass is C2 C2 B1 | A1 A1 E1 | F1 F1 F♯1 | G1 G1 B1 (beats 1, 3 and 4). B1 enters A1 from the step above (in the key); E1 enters F1 and B1 enters C2 from the half step below (both in the key); F♯1 enters G1 from the half step below, outside the key. The pass text says which is which.",
        'Chromatic approach notes are note names (`note("f#1")`); the bass\'s other notes may stay as degrees on another line only if the two lines do not sound together. Simplest: the whole bass in note names, as in the hook.',
      ],
    },
    {
      id: "U08.L04",
      author: "U08b",
      idea: 'A bass and a kick drum that share one rhythm sound like one instrument: the groove locks. Name the rhythm once with `const hits = "x ~ ~ x ~ ~ x ~"` and give it to both lines with `.struct(hits)`; change `hits` and both move together. Hits between the beats push the groove forward.',
      hook: {
        hear: "Over the Band's chords: a bass on straight quarters against a kick on 1, the 'and' of 2 and 4 (they rub), then the bass on the kick's rhythm (they lock).",
        code: `${T(96)}const hits = "x ~ ~ x ~ ~ x ~"\n\nkick: s("bd").struct(hits)\nsnare: s("~ sd ~ sd")\nhats: s("hh*8").gain(.5)\nbass: n("${AXIS}").struct(hits).scale("C2:major").s("ebass").lpf(600)`,
      },
      key: C,
      meter: "4/4",
      bpm: 96,
      canDo: ["cd.code.groove-lock"],
      uses: [...BASE, ...DRUMS, "tb.const"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items over the Band's chords: bass on quarters against the kick's pattern, then bass and kick on one rhythm.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["number"],
          minutes: 0.5,
          what: '`const hits = "x ~ ~ x ~ ~ x ~"` given to `kick:` and `bass:` with `.struct(hits)`: how many times a bar do they hit together? (`count`: 3)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "Change `hits` and run: what moves (choice: the kick and the bass together); how many of the three hits fall between the beats (number: 1, the 'and' of 2).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The bass has its own rhythm (`.struct("x ~ x ~ x ~ x ~")`) against `kick: s("bd").struct(hits)`: give it the kick\'s (`.struct(hits)`; `rhythm` matcher on `tracks: ["bass"]` against the reference; edit-only-regions on the bass\'s `.struct(…)`).',
          term: "term.groove-lock",
        },
        {
          kind: "tap",
          exercise: "tap",
          minutes: 1.5,
          what: 'Tap the shared rhythm along with the kick and bass for two bars (`mode: "along"`, `target: { drum: ["kick"] }`, `windowMs: "auto"`; never graded).',
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "From `fam.rhy.groove-lock` level 1 (generator stimulus): locked or not? Four grooves; does the bass hit with the kick?",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A kick-and-bass rhythm of your own in one `const`, under the Band's chords.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Write a rhythm for the kick and the bass in one `const`, with at least one hit between the beats, and play the four-chord roots on it under the Band's chords. Add a snare and hats of your own.",
        required: {
          rule: "groove-lock",
          label: "The bass lands with the kick",
          why: '`groove-lock` with `kick: "kick"`, `bass: "bass"`, `min: 0.75`. The starter (bass on quarters, kick on its own pattern) fails.',
        },
        suggestions: [
          "the rhythm named once (`uses` `tb.const`)",
          "a hit between the beats (`onsets` on the kick, `contains` an off-beat eighth: write it as the `onsets` rule allows)",
        ],
        band: "band.axis-4bar",
        tracks: ["chords"],
        flavours:
          "Chords from the Band in the flavour's voicing (funk and jazz-soul play four-note chords); the learner's drums use the default kit; jazz-soul swaps `ebass` for `upright`.",
      },
      srs: [{ family: "fam.rhy.groove-lock", mode: "seed", level: 1 }],
      mistakes: [
        '`.struct(hits)` written before `n(…)` (on the wrong side) or `struct("hits")` with the name in quotes (a string, not the const): `rhythm.missing` / `rhythm.extra`; pin what the grader says',
        "the bass given its own copy of the rhythm typed out: passes (same onsets); the Make's suggestion asks for the `const`",
        "the kick changed instead of the bass: `code.edit-outside` (edit-only-regions on the bass line)",
        "ear: a bass that shares all but one hit read as locked: `id.wrong`",
        "Make starter: `rubric.unmet`",
      ],
      connects: {
        back: "U06.L12 locked the chords to the drums with `.struct()`; U01.L03 wrote one line per drum. Now one rhythm, named once, drives two lines.",
        forward:
          "U08.L05 takes bass lines down by ear and chooses the bass's sound; U09.L02 puts patterns in `const`s again, one per section.",
      },
      epr: {
        enjoyment:
          "Kick and bass hit as one: the groove suddenly feels tight, the sound of funk and modern pop; the learner's Make is their own pocket, a rhythm they invented, driving the four-chord loop.",
        pace: "One idea: one rhythm for two lines, named once with `const`. Pitch stays on the roots; between-the-beat hits are heard and used but not named (syncopation is U13's).",
        return:
          "The Coda says: you can lock the bass to the kick with one shared rhythm, and `const` is yours. Next: take bass lines down by ear and choose the bass's tone.",
      },
      notes: [
        'Evaluated: `s("bd").struct("x ~ ~ x ~ ~ x ~")` hits at 0, 3/8 and 3/4 of the bar; the bass with the same `.struct(hits)` hits at the same three onsets with each bar\'s root.',
        "`fam.rhy.groove-lock` unlocks here (contracts §7.3); the lesson seeds it and plays one generator step at level 1.",
      ],
    },
    {
      id: "U08.L06",
      author: "content-lead",
      idea: 'Oak 2.0 W2 (DeSantis, "Bass Lines and Kick Drums as a Single Composite"). The opposite of the groove lock: the bass plays only in the gaps between the kicks and stops before the next kick, so the two take turns and are heard as one low line, a composite line.',
      hook: {
        hear: "Over the Band's chords: the bass on every kick (they blur into one thud), then the same notes in the gaps between the kicks (kick, bass, kick, bass, bass).",
        code: `${T(96)}kick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd")\nhats: s("hh*8").gain(.5)\nbass: n("${AXIS}").struct("~ ~ x ~ ~ x ~ x").scale("C2:major").s("ebass").lpf(600)`,
      },
      key: C,
      meter: "4/4",
      bpm: 96,
      canDo: ["cd.compose.kick-bass-line"],
      uses: [...BASE, ...DRUMS, "tb.clip", "tb.legato"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items over the Band's chords: the bass on the kicks, then the bass between them.",
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 0.5,
          what: 'Two cards with the bass starting between the kicks: one holds its first note through the kick on beat 3 (`.struct("~ x@2 x")`), the other is cut short with `.clip(.5)`. Pick the one where each bass note has stopped when the next kick hits.',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number"],
          minutes: 1,
          what: "A bass on every beat under a kick on 1 and 3: how many bass notes in bar 1 start with a kick? (number: 2)",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Move the bass into the gaps by changing its `.struct()`; keep the kick. `all`: `rhythm` on `kick` + custom `kick-bass-composite` `{ bass: "bass", minBassPerBar: 2 }` (no bass note within a 32nd of a kick, none sounding when a kick hits, one at a time, two a bar on average).',
          term: "term.composite-line",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "The bass starts in the gaps but `@2` holds a note through the kick on beat 3: shorten every note with `.clip(.5)` (or `.legato`, or the lengths in the rhythm). Same matcher as S4.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A kick and a bass that take turns as one line, under the Band's chords.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Write a kick and a bass that take turns: the bass only where the kick is silent, each note stopped before the next kick, at least two bass notes a bar. Move the bass, the kick or both.",
        required: {
          rule: "custom",
          label: "The bass plays only between the kicks, at least two notes a bar",
          why: 'custom `kick-bass-composite` `{ bass: "bass", minBassPerBar: 2 }`. A token one-note bass fails, a bass that rings through a kick fails, and a bass too quiet to hear (dropped by the grader at more than 24 dB under the loudest part) fails; the kick moved into the bass\'s gaps passes. The starter (the bass on the kicks on 1 and 3) fails.',
        },
        suggestions: ["a snare on 2 and 4 (`onsets`)"],
        band: "band.axis-4bar",
        tracks: ["chords"],
        flavours:
          "Chords from the Band in the flavour's voicing; the learner's drums use the default kit; jazz-soul swaps `ebass` for `upright`.",
      },
      srs: [{ family: "fam.rhy.groove-lock", mode: "review-if-due" }],
      mistakes: [
        "S4: a new rhythm that still starts with the kicks: `rubric.unmet`; one note left on beat 1: `rubric.unmet`; the kick moved instead: `rhythm.displaced`",
        "S5: `.clip(1)` or `.clip(2)` (the right function, no shorter): `rubric.unmet`; the kick on beat 3 deleted to make room: `rhythm.missing`",
        "the unchanged starters: `code.unchanged`; Make starter: `rubric.unmet`",
      ],
      connects: {
        back: "U08.L04 gave the kick and the bass one rhythm; U02.L08 made notes short with `.clip()`.",
        forward:
          "U08.L05 chooses the bass's tone; the electronic flavour's songs are where kick and bass most often take turns.",
      },
      epr: {
        enjoyment:
          "The low end opens up: every kick and every bass note is heard, bouncing off each other, the feel of funk and house bass lines.",
        pace: "One idea, the opposite of the last lesson's, with one tool the learner already has (`.clip()`). No new syntax.",
        return:
          "The Coda says: you can lock a bass to the kick or set it against the kick. Next: the bass's tone.",
      },
      notes: [
        'Evaluated: kick on 1 and 3, bass on beat 2, the "and" of 3 and the "and" of 4: each bass note an eighth, ending at or before the next kick; the rule reads note ends from the written length (`.clip()` included).',
        "The take plays in the song's first chorus (I V vi IV, the loop's roots), not a verse (I IV I V).",
      ],
    },
    {
      id: "U08.L05",
      author: "U08b",
      idea: 'A bass line can be taken down by ear: find each chord\'s root from home (the bass degree), then the notes between, and check by switching between the source and your code at the same bar. And a bass has a tone: `fingerbass` is rounder, the synth bass (`s("sawtooth").lpf(600)`) buzzier, and the bass preset `.lpf()` makes either darker or brighter.',
      hook: {
        hear: "One bass line under the doo-wop loop, played three ways in turn: `ebass`, `fingerbass`, and the sawtooth synth bass with `.lpf(600)`.",
        code: `${T(96)}${chords(DOO_WOP)}\n${bass("<[0 ~ 0 4] [5 ~ 5 9] [3 ~ 3 7] [4 ~ 4 8]>", "fingerbass")}`,
      },
      key: C,
      meter: "4/4",
      bpm: 96,
      canDo: ["cd.transcribe.bass"],
      uses: [...BASE, ...VOICED, "snd.fingerbass", "snd.wave.sawtooth", "tb.template.synthbass"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.75,
          what: "The same bass in three tones: `ebass`, `fingerbass`, sawtooth with `.lpf(600)`.",
        },
        {
          kind: "dictate",
          exercise: "dictation",
          answer: ["code"],
          minutes: 2,
          graded: true,
          wave3: ["by-ear"],
          what: 'By ear under the given chords (`chords:` line shown): a four-bar bass of roots and 5ths; write the `bass:` line (`byEar`: A/B at the bar, rates 1, 0.75, 0.5; `accepts: "any-octave"`; `melody` matcher, `octave-free`, `track: "bass"`). Hint 2: "Beat 1 of each bar is the chord\'s root: write those first."',
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["degree-pad"],
          minutes: 1.25,
          graded: true,
          what: "From `fam.har.bass` at level 4 (generator stimulus): the bass degree under each chord of a new loop, four in a row.",
        },
        {
          kind: "sing",
          exercise: "sing",
          minutes: 1.5,
          what: 'Sing the bass line you took down, in your own range, on syllables (`mode: "echo"`, `labels: "syllables"`, `fallback: "identify"`).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1,
          what: "Tone: swap `ebass` for `fingerbass` or the sawtooth recipe, then move `.lpf()` until the bass sits under the chords without covering them (not graded; `must-use` `snd.fingerbass` or `snd.wave.sawtooth`; the notes must not change).",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your bass, your tone, under a new loop.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "The loop vi IV I V over the drums. Write a bass line from this unit: roots on beat 1, 5ths and octaves, approach notes, a rhythm with the kick. Choose its tone: `fingerbass` or the synth bass, darker or brighter.",
        required: {
          rule: "matches",
          label: "Each chord's root in the bass on its beat 1",
          why: '`matches` against `chords + n("<5 3 0 4>").scale("C2:major")` with the `harmony` matcher at level `bass`, `min: 0.75` (as U08.L01). The starter (the bass a bar late: the previous chord\'s root on each beat 1) fails.',
        },
        suggestions: [
          'a tone from today (`sounds`, `anyOf: ["snd.fingerbass", "snd.wave.sawtooth"]`)',
          "approach notes or 5ths (`bass-line`, planned: listed as a suggestion only once the grader has it)",
        ],
        band: "band.axis-4bar",
        tracks: ["drums"],
        flavours:
          "Drums from the Band; funk's starter swaps `ebass` for `fingerbass` (unlocked here), jazz-soul's for `upright` and `piano` for `rhodes`.",
      },
      srs: [
        { family: "fam.har.bass", mode: "review-if-due", level: 4 },
        { family: "fam.mel.dictation", mode: "review-if-due" },
      ],
      singOn: "syllables",
      mistakes: [
        "dictation: the roots right and the 5ths written as 5 (degree 6): `melody.wrong-degree`; a bar late: `melody.first-difference`; right pitches, wrong rhythm: `melody.pitch-only`",
        "dictation: the bass an octave high: passes (`any-octave`)",
        "Make starter (each root a bar late): `rubric.unmet` with `harmony.bass`",
        "a bass with every root on beat 2 (a beat late): `rubric.unmet` (the lowest note on each beat 1 is the old root)",
      ],
      connects: {
        back: "U06.L09 took loops down bass first; U08.L01–L04 wrote the kinds of bass line now heard. C1 met `ebass` and the preset `.lpf(600)`.",
        forward:
          "U09 builds songs from sections; the ladder's L2 (generated bass lines) in the gym is this lesson's dictation at full length, and X2 takes a blues down bass first.",
      },
      epr: {
        enjoyment:
          "The learner hears a bass line, writes it down, hears their version match the source, then makes a bass of their own with a tone they chose: a finished loop they would put in Studio.",
        pace: "One idea: hearing the bass. Tone is one control and one sound, not synthesis (filters as a topic are A1.L02's); no new rhythm or pitch material.",
        return:
          'The Coda says: you can take a bass line down by ear and give a bass its tone; milestone ms.10 "You can now write a bass line." Next: songs in sections, verse and chorus, in U09.',
      },
      notes: [
        "Evaluated: the hook's bass is C2 C2 G2 | A2 A2 E3 | F2 F2 C3 | G2 G2 D3 under I vi IV V: the root on beats 1 and 3, the 5th above it on beat 4. `fingerbass` unlocks here (contracts §3.2 G), as does the synth-bass recipe.",
        "A dictation with `byEar` uses a `chords:` line the learner sees and a hidden `bass:` source; the Band plays the drums only, so the learner's A/B compares bass with bass.",
      ],
    },
  ],
  capstones: [],
};
