// J3 Voicings, Comping & Walking: the unit spec (rendered to content/specs/J3.md by `bun scripts/content/spec.ts`).
// Four lessons of the jazz track (contracts §2.6), no checkpoint of its own (J.CP2 covers J2.L04 and J3–J5). Every
// hook was evaluated with headless Strudel and is linted in its lesson by content/validate/specs.test.ts; J3.L01 is
// the exemplar, written and passing with the real grader (content/advanced/J3/L01). The pre-flight decisions this
// spec rests on are in the Wave 7 content lead's result (scratchpad w7/foundation-content-lead.md, "Pre-flight
// settled") and in AUTHORING §20; what each dictionary call really returns was evaluated for this spec and is
// written down in the conventions below.
import type { UnitSpec } from "./types.ts";

const F = { tonic: "F", mode: "major" } as const;
const C = { tonic: "C", mode: "major" } as const;
const Bb = { tonic: "Bb", mode: "major" } as const;
const G = { tonic: "G", mode: "major" } as const;
const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;

/**
 * What every J3 lesson may use on its earliest legal route: U13.CP, J1, J2.L01–L03, J.CP1 and JC1 passed (J2.L04
 * may be passed over), U14–U17 possibly unfinished (contracts §4.3, §7.6 rule 5). No mode names (U14), no
 * chromatic `n` steps (U15.L01), no secondary dominants by name (U15), no `horns` / `trumpet` / `tenor`, no
 * `.pan()`.
 */
const BASE = [
  "tb.setcpm",
  "tb.label",
  "tb.mini.seq",
  "tb.mini.rest",
  "tb.mini.sub",
  "tb.mini.alt",
  "tb.mini.stack",
  "tb.gain",
  "tb.s",
  "tb.bank",
  "snd.drum.bd",
  "snd.drum.sd",
  "snd.drum.hh",
  "snd.drum.rd",
  "snd.jazzkit",
  "snd.vibes",
  "snd.upright",
  "snd.rhodes",
  "snd.piano",
  "tb.swingBy",
  "tb.n",
  "tb.scale",
  "scale.major",
  "tb.note",
  "tb.note.names",
  "tb.note.accidentals",
  "tb.s.pitched",
  "tb.const",
  "tb.struct",
  "tb.chord",
  "tb.voicing",
  "tb.anchor",
  "tb.rootNotes",
  "chord.seventh",
  "chord.dom7",
  "tb.dict.lefthand",
  "tb.feature.chord-symbols",
  "tb.feature.rn",
] as const;

const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';

/** J3.L01: rootless A B A in F by hand (Gm7 3 5 7 9 | C7 7 9 3 13 | Fmaj7 3 5 7 9) over a two-feel bass. */
const L01_HOOK = `${T(120)}${RIDE}\n${HATS}\nbass: note("<[g2 d2] [c2 g1] [f1 c2] [f1 a1]>").s("upright")\nchords: note("<[bb3,d4,f4,a4] [bb3,d4,e4,a4] [a3,c4,e4,g4] [a3,c4,e4,g4]>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")`;

/**
 * J3.L02: a vibes tune C5 B4 B4 E5 harmonised in drop-2 under it (the melody is each chord's top note): Dm7 A3 D4
 * F4 C5, G7 G3 D4 F4 B4, Cmaj7 G3 C4 E4 B4, Cmaj7 C4 G4 B4 E5. Each is a close voicing with its second note from the
 * top dropped an octave (verified with `isDropTwo`).
 */
const DROP2 = "[a3,d4,f4,c5] [g3,d4,f4,b4] [g3,c4,e4,b4] [c4,g4,b4,e5]";
const L02_HOOK = `${T(112)}${RIDE}\nbass: note("<d2 g1 c2 c2>").s("upright")\nchords: note("<${DROP2}>").s("rhodes").gain(.7)\nmel: note("<c5 b4 b4 e5>").s("vibes")`;

/** J3.L03: rootless comping in B♭ from the dictionary at A4 (Cm7 B, F7 A, B♭maj7 B), on the Charleston. */
const L03_COMP = 'chord("<Cm7 F7 Bb^7 Bb^7>").dict("lefthand").anchor("a4").voicing()';
const L03_HOOK = `${T(144)}${RIDE}\n${HATS}\nbass: note("<[c2 g2] [f2 c2] [bb1 f2] [bb1 d2]>").s("upright")\nchords: ${L03_COMP}.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")`;

/**
 * J3.L04: a walk through Am7 D7 Gmaj7 Gmaj7: root on every beat 1, a chord tone on every beat 3, every beat 4 a half
 * step from the next bar's first note (evaluated): A C E E♭ | D F♯ A A♭ | G D B F♯ | G A B B♭ | (A).
 */
const WALK = "[a1 c2 e2 eb2] [d2 f#2 a2 ab2] [g2 d2 b1 f#1] [g1 a1 b1 bb1]";
const L04_HOOK = `${T(132)}${RIDE}\n${HATS}\nbass: note("<${WALK}>").s("upright")\nchords: chord("<Am7 D7 G^7 G^7>").dict("lefthand").anchor("a4").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)`;

/**
 * J3.L05 (Oak 2.0 W2): one stack of 4ths, D3 G3 C4 F4, comped on beat 1 and the and of 2 over a D in the bass, then
 * over a G. Evaluated with `identifyChord` (@oak/theory): over D it reads m11 (Dm11), over G 7sus4 (G7sus).
 */
const L05_HOOK = `${T(132)}${RIDE}\n${HATS}\nbass: note("d2").s("upright")\nchords: note("<[d3,g3,c4,f4]>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")`;

export const J3: UnitSpec = {
  unit: "J3",
  title: "Voicings, Comping & Walking",
  summary:
    "The five lessons that turn the learner's trio from a chart into a band (contracts §2.6): the piano's left hand gives the root to the bass and plays four notes in the middle, rootless A and B voicings that alternate through a ii–V–I (J3.L01, the exemplar); a chord stacked in 4ths, whose name the bass decides, a minor 11th over its own lowest note (J3.L05, Oak 2.0); a close voicing opened by dropping its second note from the top an octave, drop-2, wide enough to carry a melody on top, and where on the keyboard a voicing sounds clear (J3.L02); the rhythms pianists comp with, the Charleston and the push (J3.L03); and the bass that walks four to the bar, root on 1, a chord tone on 3, and a half step into every new chord on 4 (J3.L04, milestone \"You can now walk a bass line\"). J3 opens after U13.CP, J.CP1 and JC1 and may interleave with U14–U17; most learners reach it with the core finished (about session 190). Every Make is a trio loop the learner plays the piano or the bass of, swinging, in a new key each lesson (F, C, B♭, G; J3.L05's stacks are C major's notes, D G C F and E A D G).",
  conventions: [
    'Written for the learner at the gate (contracts §7.6 rule 5, AUTHORING §20.1): a J3 lesson is taken after J1, J2.L01–L03, J.CP1 and JC1 (J2.L04 may be passed over: never assume chord-scales) and possibly before U14–U17. So: no mode names or modal `.scale()` (U14), no chromatic `n` steps (U15.L01: an altered note is a note name, `note("eb2")`), no secondary dominants by name (U15: J3\'s progressions are ii–V–Is and their I), no `horns`/`trumpet`/`tenor`, no `.pan()`. What J1–J2 gave is used freely: the ride pattern, the jazz kit, vibes, shells, guide tones, `.set()`, the ii–V–I in any key, 9ths (J2.L03, `term.extension`).',
    'What the dictionaries really do (evaluated for this spec; never describe them otherwise, STYLE §5.2, AUTHORING §20.5). `.dict("lefthand")` holds TWO rootless shapes for most qualities (A: 3rd lowest; B: 7th lowest), not one: `voicing()` places each chord of it with its top note at or below the anchor (default C5), choosing the shape and octave that fits. So the default in C plays Dm7 C4 E4 F4 A4 (B), G7 B3 E4 F4 A4 (A), Cmaj7 B3 D4 E4 G4 (B): B A B; in F it plays Gm7 B♭3 D4 F4 A4 (A), C7 B♭3 D4 E4 A4 (B), Fmaj7 E4 G4 A4 C5 (B), A B B, a jump at Fmaj7; with `.anchor("a4")` in F it plays A B A (B♭3 D4 F4 A4 | B♭3 D4 E4 A4 | A3 C4 E4 G4). The alternation comes from the register, not from the dictionary. `.offset(n)` before `.voicing()` moves every chord n placements up its list: `.offset(1)` turns each chord to its other shape (A B A → B A B), `.offset(2)` gives the first shapes an octave higher, `.offset(-1)` the other shapes lower; written after `.voicing()` it does nothing. `.mode("duck")` leaves out the one note EQUAL to the anchor (anchored on A4: Gm7 B♭3 D4 F4, C7 B♭3 D4 E4; the A3 of Fmaj7 stays): it keeps the comping off the melody\'s note and never removes a root. `lefthand` exceptions to keep out of every J3 example: `Cm7b5` keeps its root (E♭ G♭ B♭ C), `7#9` has three notes, `7alt` is silent, `C6` and `F6` are unknown ("[voicing]: unknown chord"), `C69` plays a dominant ninth (E G B♭ D, wrong).',
    "Shapes are taught by hand and graded by what is heard. A rootless chord in this unit is four notes: no root, the 9th in (on a dominant the 13th in place of the 5th); a drop-2 is four notes, not close, that become a close voicing when the lowest goes up an octave and lands second from the top (`isDropTwo`, @oak/content-kit). The shape rule `voicing-shape` (`TRACK_CUSTOM_RULES`) and the keyboard's `keyboard.voicing` are planned: a step written today grades a rootless chord by `pcset` per onset with `bass: true` on the chords track (pitch classes and lowest note, which for these four-note shapes IS the A or B shape, J3.L01) and a drop-2 by an `events` match with absolute pitch (the drop of a given close voicing has one answer, J3.L02); a Make that wants any register, rhythm or key uses `voicing-shape` once it is built. A `voicing()` line is never graded by shape (contracts §6.7 item 1): `lefthand` output is graded by `pcset` + `bass` against a reference in the same dictionary, with `voiced-with` when the step is about the dictionary.",
    'Swing and the kit (J1 conventions hold): `.swingBy(1/3, 4)` on every line with off-beats, swing declared on the lesson (`swing: { subdivision: 8, amount: 1/3 }`), the ride on a `drums:` line, the hi-hat on 2 and 4 on `hats:`, the bass on `upright`, comping on `rhodes` (or `piano`), tunes on `vibes`. A rhythm check on swung comping is a `rhythm` matcher (feel-aligned: it reads the straightened grid) on the chords, never a bare `onsets` rule (which reads raw onsets: the swung "and" of 2 is 5/12 of the bar, not 3/8, evaluated). Quarter notes do not swing: a walking bass is never what a `swing` rule reads.',
    "Keys rotate (pre-flight B1): J3.L01 in F, J3.L02 in C (the drop is the idea; no accidentals in the way), J3.L03 in B♭, J3.L04 in G; J3.L05 sits on C major's notes (Dm11 and Em11 as stacks of 4ths) without naming a mode. Each lesson's Band is `band.two-five-one` with `params.key` the lesson's key; its chords are guide tones of ii–V–I with I as a sixth chord. J3.L05's learner writes the chords and the bass, so its Band plays `[\"drums\"]` only.",
    'Grading (AUTHORING §20.2, the corrections-pass standard): every required rule checks what is heard. For every graded step: the reference, at least three other right answers, the unchanged starter (`code.unchanged`), and at least ONE WRONG ANSWER THAT USES THE RIGHT FUNCTION, named in each lesson below. `feedbackText` overrides describe the sound and the place and never name the notes of the answer below rung 4 (the catalog\'s `harmony.pcset` line names the target notes: override it on every graded chord step and in every Make whose required rule is a `matches`). A Make has exactly one required rule; the rest are suggestions with a neutral "{label}: not yet.".',
    'Words that wait: "tension" and "avoid note" are J2.L03\'s and may be used; "chord-scale" is J2.L04\'s and may NOT be (J2.L04 can be passed over); "turnaround" (U11) may be used, "head" (J4.L04) and "jazz blues" (J4.L02) may not; "register" is A2.L01\'s term (say "how high it sits"); "density" A2\'s. New terms: A voicing / B voicing (L01, a pair), quartal voicing (L05), drop-2 voicing and close position (L02), Charleston rhythm (L03), walking bass (L04). J3.L05 names chords only with the words of J1–J2.L03: m11 (the extensions of J2.L03), 7sus (J1.L02).',
    "Ear training (stage G, contracts §7.3): `fam.jzz.voicing` levels 2 (rootless, gate J3.L01) and 3 (drop-2, gate J3.L02) open here; their lessons `review-if-due` it at that level (the family is seeded in J1.L05). `deck.jzz.voicings` deals its rootless cards from J3.L01 and its drop-2 cards from J3.L02 once the drills engine writes it (`content/decks/planned.ts`; until then the lessons name it in notes only). Stage H: `fam.rhy.syncopation` and `fam.rhy.swing` are reviewed in J3.L03.",
    "Feedback the grader emits on J3 steps (pin what `bun run content:check <id> --verbose` prints): `harmony.pcset` (a note too many or too few: the root kept, the 9th missing), `harmony.bass` (the right notes on the wrong bottom: an A where a B is asked), `harmony.shifted` (a free-rhythm Make read against whole-bar chords: override it), `rubric.unmet` (`voiced-with`, `syncopation`, the planned `walking-bass` and `voicing-shape`), `melody.wrong-degree` / `melody.octave` on an `events` drop-2 step (the wrong voice dropped), `rhythm.displaced` / `rhythm.missing` / `rhythm.extra` on comping rhythms, `code.unchanged`, `kb.bass` / `kb.extra-note` / `kb.missing-note` on the keyboard.",
  ],
  lessons: [
    {
      id: "J3.L01",
      author: "spec-J",
      idea: 'A jazz pianist leaves the root to the bass and plays four notes in the middle of the keyboard: 3 5 7 9 with the 3rd at the bottom (an A voicing) or 7 9 3 5 with the 7th at the bottom (a B voicing); on a dominant the 13th takes the 5th\'s place. Through a ii–V–I they alternate, A B A or B A B, so the hand hardly moves. `.dict("lefthand")` holds both shapes: `.anchor()` sets how high the hand sits, `.offset(1)` turns every chord to its other shape, and `.mode("duck")` keeps the chords off the melody\'s note.',
      hook: {
        hear: "The trio comps a ii–V–I in F with the shells of J1.L05 (root, 3rd, 7th), then with four-note rootless voicings in the middle of the keyboard over the same bass: the root goes to the bass, the chords gain a 9th, and from Gm7 to C7 a single note moves.",
        code: L01_HOOK,
      },
      key: F,
      meter: "4/4",
      bpm: 120,
      canDo: ["cd.code.rootless"],
      uses: [...BASE, "tb.mode.duck", "tb.offset"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items over the same ride and bass: shells, then rootless A B A. The captions name what changed (the root left to the bass, the 9th added).",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 0.75,
          what: "The four rootless chords held a bar each over the bass, on the roll: which note of Gm7 the Rhodes leaves out (choice: G, the root); how many of its four notes move from bar 1 to bar 2 (number: 1, F to E). The pass text names both shapes.",
          term: ["term.a-voicing", "term.b-voicing"],
        },
        {
          kind: "quiz",
          exercise: "keyboard",
          answer: ["keyboard"],
          minutes: 1,
          graded: true,
          what: 'Build the A voicing of Fmaj7: A C E G (`expect: { pcs: [9, 0, 4, 7], bassPc: 9 }`, `pitchMode: "octave-free"`; with `keyboard.voicing`, planned, the same step becomes `expect: { voicing: { shape: "rootless-a", symbol: "F^7" } }`). Passes A C E G, an octave up, A E G C; fails the B voicing E G A C (`kb.bass`), the root kept F A C E G (`kb.extra-note`) and A C E F, close Fmaj7 from its 3rd with no 9th (the right keyboard, wrong notes).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The trio comps in shells; rewrite the four chords by hand as A B A (Gm7 A, C7 B, Fmaj7 A), keeping the Charleston. `pcset` per onset with `bass: true` on `chords`. Passes the reference, an octave up, the notes written top down, and `chord(…).dict("lefthand").anchor("a4").voicing()` (the same chords from the dictionary); fails the starter, the root kept on top (five notes: `harmony.pcset`), an A voicing on every chord (C7 on its 3rd: `harmony.bass`) and the WRONG ANSWER WITH THE RIGHT FUNCTION, the dictionary with no anchor (Fmaj7 jumps to a B voicing: `harmony.bass`).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The dictionary anchored at A4 plays A B A; turn it round to B A B with one call before `.voicing()`. `pcset` + `bass` against `.offset(1)`, plus `voiced-with` `lefthand` (the dictionary still in force). Passes `.offset(1)`, `.offset(-1)`, `.offset(3)` and `.anchor("d5")`; fails the starter, the WRONG ANSWERS WITH THE RIGHT FUNCTION `.offset(1)` after `.voicing()` (nothing moves) and `.offset(2)` (A B A an octave up), both `harmony.bass`, and B A B written by hand (`rubric.unmet`: not the dictionary).',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice"],
          minutes: 0.75,
          what: "The vibes hold A4; the comping is anchored at A4 with `.mode(\"duck\")`. Run it with and without the call: what it leaves out of Gm7 and C7 (choice: A4, the vibes' note; not the root, not the lowest note). The pass text says only the anchor's own note goes, so the A3 of Fmaj7 stays.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your rootless comping on the ii–V–I in F over the Band's drums and bass, from shells, by hand or from the dictionary, in a rhythm of your own; a vibes line on top if you like.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The Band plays the drums and the bass in F. The comping is yours: turn the shells into rootless voicings that alternate, A B A or B A B, each chord sounding on the first beat of its bar. Then make it your own: the rhythm, how high the hand sits, the piano or the Rhodes, a vibes line on top.",
        required: {
          rule: "matches",
          label: "Rootless voicings that alternate: A B A or B A B",
          why: '`matches` with `min: 1`, reference solutions A B A and B A B (hand-voiced, whole bars), matcher `{ m: "pcset", perOnset: false, bass: true, tracks: ["chords"] }`: every chord has the four rootless pitch classes and the right lowest note, in any octave and any rhythm that sounds the chord as its bar begins. The starter (shells), the dictionary with no anchor (A B B) and the A voicing on every chord fail; A B A or B A B by hand, `.anchor("a4")` and `.anchor("a4").offset(1)` pass. When the grader builds `voicing-shape`, the required rule becomes `custom voicing-shape { track: "chords", shape: ["rootless-a", "rootless-b"], changes: ["Gm7", "C7", "F^7", "F^7"], minRatio: 1 }` plus the alternation, and the rhythm is free.',
        },
        suggestions: [
          "a vibes line on top (`sounds` contains `snd.vibes`)",
          "a medium-swing tempo, 100–180 (`tempo-bpm`)",
        ],
        band: "band.two-five-one",
        tracks: ["drums", "bass"],
        flavours:
          "The Band's drums and bass in the flavour's sounds; the learner's comping starts on `rhodes`.",
      },
      srs: [{ family: "fam.jzz.voicing", mode: "review-if-due", level: 2 }],
      mistakes: [
        "keyboard: E G A C (the B voicing): `kb.bass`; F A C E G (the root kept): `kb.extra-note`",
        "modify (hand): five notes with the root: `harmony.pcset`; C7 written as an A voicing: `harmony.bass`; the dictionary with no anchor: `harmony.bass`; the unchanged starter: `code.unchanged`",
        "modify (offset): `.offset(1)` after `.voicing()`, `.offset(2)`: `harmony.bass`; B A B by hand: `rubric.unmet` (`voiced-with`)",
        "Make: the starter's shells, the dictionary with no anchor (A B B), an A voicing on every chord, a comping that rests on every first beat: `rubric.unmet`",
      ],
      connects: {
        back: 'J1.L05 comped with shells (root, 3rd, 7th); U12.L06 used `.dict("lefthand")` and heard it was mostly rootless; J2.L03 named the 9th and the 13th as extensions; U05.L08 set `.anchor()`.',
        forward:
          "J3.L02 opens a close voicing into drop-2, wide enough to carry a tune on top; J3.L03 gives these voicings a comping rhythm; AC2 voices its neo-soul chords by hand with a smooth top voice.",
      },
      epr: {
        enjoyment:
          "The learner's own left hand in a swinging trio in F: four-note rootless chords that glide from Gm7 to C7 by a half step, the sound of a jazz pianist, under a vibes line they may add.",
        pace: 'One idea: the rootless shapes and their alternation. The dictionary calls (`.anchor()`, `.offset()`, `.mode("duck")`) are each a small step that plays what the learner already wrote by hand; drop-2 and comping rhythms wait for the next two lessons.',
        return:
          "The Coda says: you can now voice a ii–V–I with rootless A and B voicings, by hand and with the left-hand dictionary. Next: a close voicing opened wide enough to carry a melody on top.",
      },
      notes: [
        "The exemplar: content/advanced/J3/L01 passes every content-CI check with the real grader (7 steps, 3 graded), with the corrections-pass test set on each graded step.",
        'Evaluated (headless Strudel, this spec): in F the `lefthand` default is A B B (Fmaj7 E4 G4 A4 C5), `.anchor("a4")` A B A, `.anchor("a4").offset(1)` B A B (F4 A4 B♭4 D5 | E4 A4 B♭4 D5 | E4 G4 A4 C5), `.offset(-1)` and `.anchor("e4")` B A B lower, `.anchor("d5")` B A B; `.mode("duck")` at A4 drops A4 from Gm7 and C7 only.',
        '`deck.jzz.voicings` (planned) deals its rootless cards from here: "Dm7, A voicing" → F A C E.',
        "Why the Make rule is a `matches` today: `voicing-shape` is planned (`TRACK_CUSTOM_RULES`); pcset with the lowest note is the same test for a four-note rootless chord. The price is a rhythm limit (a chord must sound as its bar begins), said in the brief; `harmony.shifted`, which the grader adds when the learner's chords start elsewhere, is overridden with a sentence about the sound (requested: no `harmony.shifted` from a `perOnset: false` pcset inside `matches`).",
      ],
    },
    {
      id: "J3.L05",
      author: "spec-J",
      idea: "A chord stacked in 4ths, five half steps between neighbours, has no name of its own: the bass under it decides what it is. D G C F over D is Dm11 (root, 11th, 7th, minor 3rd); the same four over G are G7sus. Over its own lowest note a stack of 4ths is a minor 11th chord, which is why pianists comp a minor chord this way: open, hollow, named by the bass.",
      hook: {
        hear: "The trio at 132 BPM, swung: the Rhodes comps one stack of 4ths, D G C F, over a D in the bass (Dm11, settled), then the same stack over a G (G7sus, hanging).",
        code: L05_HOOK,
      },
      key: C,
      meter: "4/4",
      bpm: 132,
      canDo: ["cd.code.quartal"],
      uses: [...BASE],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items: the stack over D, then over G. Focus: the chord changing its character while its notes stay. The pass text names Dm11 and G7sus.",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 0.75,
          what: "The stack held over D on the roll: the half steps between neighbouring notes (number: 5), and which Rhodes note has the bass's letter (choice: the lowest, D).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'One given note a bar (D D E D). Build each into four notes, three more each 5 half steps above the one below. Graded: `all` of `pcset` per onset with `bass: true` and `custom` `stack-intervals { track: "chords", semitones: [5] }`. The pass text names **quartal voicing**.',
          term: "term.quartal-voicing",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The stack on D held a bar at a time over a bass on G and C (G7sus). Change the bass notes (`edit-only-regions`) so the stack reads as Dm11. Graded: `custom` `bass-names-chord { chords: "chords", bass: "bass", quality: "m11" }`.',
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 0.5,
          what: "Two audio cards, a bar of A7 then the stack on D: over G (hangs) and over D (home). Pick the one that sounds like home.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your loop in 4ths: stacks of 4ths in any rhythm and a bass that makes each a minor 11th, over the Band's drums.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The Rhodes plays stacks of 4ths over a bass on G and A, so every chord hangs. Make it your loop: stacks of 4ths in any rhythm, and a bass that makes every one a minor 11th. Then a 3rd on top of a stack, the shape pianists use on modal tunes.",
        required: {
          rule: "custom",
          label:
            "Wherever three or more chord notes sound, the bass under them makes a minor 11th chord, three times in four",
          why: '`custom` `bass-names-chord { chords: "chords", bass: "bass", quality: "m11" }` (packages/grader/src/rubric/oak2-pitch.ts, W0): at every moment three or more chord notes sound, `identifyChord` of the stack and the lowest bass note under it must report the quality `m11` (the string the rule reports, checked on the reference first), in 75 % of the moments. Fails (evaluated): the starter (G7sus, A7sus); held chords with the right bass only on beat 3 (one moment in two); no bass. Passes: the bass under each stack\'s lowest note, a 3rd on top, three-note stacks G C F over D, the stack moved a half step up for two bars at 160 BPM.',
        },
        suggestions: [
          "every chord's neighbouring notes 4 or 5 half steps apart, a 3rd allowed on top (`custom` `stack-intervals`, `semitones: [5, 4]`)",
        ],
        band: "band.two-five-one",
        tracks: ["drums"],
        flavours:
          "The Band's drums in the flavour's kit; the learner's chords and bass stay on `rhodes` and `upright`.",
      },
      srs: [],
      mistakes: [
        "modify (stacks): stacks of 3rds (`harmony.pcset`); the right letters spread wide, D C G F (`rubric.unmet`: the gaps are not 5); the given note moved to the top (`harmony.bass`); `chord(…).voicing()` (`harmony.pcset`); unchanged: `code.unchanged`",
        "modify (bass): D only on beat 3; D then its 5th A: `rubric.unmet`; the stack edited instead: `code.edit-outside`; unchanged: `code.unchanged`",
        "Make: the bass a 4th under every stack; the right bass only on beat 3 of held chords; no bass: `rubric.unmet`",
      ],
      connects: {
        back: "J3.L01 left the root to the bass and stacked the rest; J2.L03 named the 9th, 11th and 13th; J1.L02 gave the sus chord. J3.L05 stacks one interval and lets the bass pick the name.",
        forward:
          "J3.L02 spreads a close voicing wide (drop-2); the modes of U14 give these stacks their usual home (dorian), named there, not here.",
      },
      epr: {
        enjoyment:
          "The open, floating comping of a modal jazz pianist under the learner's own bass, one minor chord breathing for bars at a time.",
        pace: "One idea: stack 4ths, and let the bass name the chord. Mode names, the 'So What' record and planing a stack through a scale are left out.",
        return:
          "The Coda says: you can now voice a chord in 4ths and name it from its bass. Next: wider voicings, with the notes spread over two octaves.",
      },
      notes: [
        "Oak 2.0 W2 (docs/superpowers/plans/2026-11-25-oak2-w2.md Task 3; lesson content/advanced/J3/L05, fidelity pins content/validate/pins/J3.L05.ts). Passes every content-CI section with the real grader (6 steps, 2 graded, 7 expert minutes).",
        'What `identifyChord` reports (evaluated; `bass-names-chord` compares the quality only): D G C F over D, D1, D3 or E: m11; over G, C or F: 7sus4; over A or B♭: 69; E A D G over E: m11, over A or D: 7sus4; G C F over D: m11; `chord("Dm11").voicing()` plays A3 D4 G4 C5, which over D reads 7sus4. Known gaps for the integrator: a minor 11th written in 3rds over its root passes the Make (the plan keeps the 4ths a suggestion), and E under the D stack passes S4 and the Make (the quality is m11 with D as its root).',
        "Song: a side step. Every room of J3's song is a ii–V–I and this loop stays on minor 11th chords, so no room fits it.",
      ],
    },
    {
      id: "J3.L02",
      author: "J3a",
      idea: "A close voicing packs four notes inside one octave; take its second note from the top down an octave and you have a drop-2 voicing: the same chord, wider and more open, with the top note free to carry a melody. Where a voicing sits matters as much: the same four notes two octaves lower turn to mud, so wide chords keep their close intervals high and their wide ones low.",
      hook: {
        hear: "A four-note vibes tune (C, B, B, E) over Dm7 G7 Cmaj7, harmonised under each note on the Rhodes first in close position (thick, inside one octave), then in drop-2 (the second voice from the top dropped an octave): the same chords, open, and the tune on top of each.",
        code: L02_HOOK,
      },
      key: C,
      meter: "4/4",
      bpm: 112,
      canDo: ["cd.code.drop-2"],
      uses: [...BASE],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "The tune harmonised in close position, then in drop-2. The caption names the one difference: one note of each chord an octave lower.",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 0.75,
          what: '`note("<[c4,e4,g4,b4] [g3,c4,e4,b4]>")` on the roll: which note moved (choice: G, the second from the top); how far (number: 12 half steps). The pass text names close position and the drop-2 voicing.',
          term: ["term.close-position", "term.drop-2"],
        },
        {
          kind: "quiz",
          exercise: "keyboard",
          answer: ["keyboard"],
          features: ["keyboard.voicing"],
          minutes: 1,
          graded: true,
          what: 'Dm7 close is D4 F4 A4 C5: play its drop-2 (A3 D4 F4 C5). With `keyboard.voicing` (planned): `expect: { voicing: { shape: "drop-2", symbol: "Dm7" } }`, `mode: "chord"`, `pitchMode: "absolute"`, any register; until it lands, `expect: { midi: [57, 62, 65, 72] }` with `pitchMode: "absolute"`. Fails the close voicing (`kb.*`), the top note dropped instead (C4 D4 F4 A4, the melody lost), drop-3 (F3 D4 A4 C5).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The tune C5 B4 B4 E5 is harmonised in close position under the vibes (D4 F4 A4 C5 | D4 F4 G4 B4 | C4 E4 G4 B4 | G4 B4 C5 E5); drop the second note from the top of each chord an octave. `events` on `chords`, `pitch: "absolute"`, `rhythm: "onsets"`: the drop of a given voicing has one answer. Passes the reference, the notes written in another order inside each `[ ]`, the same chords on `piano`, and at `.gain(.6)`; fails the starter, the WRONG ANSWER WITH THE RIGHT MOVE ON THE WRONG VOICE (the second note from the BOTTOM dropped: `melody.wrong-degree`/`melody.octave`), the top note dropped (the tune leaves the top) and the whole chord an octave down.',
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 0.75,
          what: "Where a voicing sits: Cmaj7 drop-2 at G3 C4 E4 B4, then the same notes two octaves down (G1 C2 E2 B2), then spread (C3 B3 | E4 G4 D5: root and 7th low, 3rd, 5th and 9th high). Which one is muddy (choice: the low drop-2); the pass text gives the rule of thumb: a 3rd below about C3 blurs; low notes want wide gaps, high notes can sit close. Not graded.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Harmonise a vibes tune of four or eight notes (yours, or the given C B B E) with drop-2 voicings, the tune on top of every chord, over the Band's drums and bass.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The Band plays the drums and the bass on Dm7 G7 Cmaj7 Cmaj7. Write a tune for the vibes, one or two notes a bar (or keep C B B E), and voice the Rhodes under it in drop-2: build each chord close under the tune's note, then drop its second note from the top an octave. Your tune, your rhythm, your sound.",
        required: {
          rule: "custom",
          label: "Your chords are drop-2 voicings",
          why: '`custom` `voicing-shape` (planned) with `track: "chords"`, `shape: ["drop-2"]`, `changes: ["Dm7", "G7", "C^7", "C^7"]`, `minRatio: 0.75`: close voicings fail, drop-3 and the second-from-bottom dropped fail, a `voicing()` line fails with a message (dictionary output is never graded by shape), any drop-2 of the right chord in any register passes. Until the grader builds `voicing-shape`, the lesson fails check 2 and says so; a fallback that passes CI today is a `matches` on the given tune C B B E with an `events` matcher (absolute), which loses the free tune.',
        },
        suggestions: [
          "the tune is each chord's top note (`events` on `mel` against the top voice is not a rule: listen)",
          "a medium-swing tempo, 100–160 (`tempo-bpm`)",
        ],
        band: "band.two-five-one",
        tracks: ["drums", "bass"],
        flavours:
          "The Band's drums and bass in the flavour's sounds; the learner's chords on `rhodes`, the tune on `vibes`.",
      },
      srs: [{ family: "fam.jzz.voicing", mode: "review-if-due", level: 3 }],
      mistakes: [
        "keyboard: D4 F4 A4 C5 (close, unchanged): `kb.*`; F3 D4 A4 C5 (drop-3): `kb.*`",
        "modify: the second note from the bottom dropped (D4 F4 A4 C5 → F3 D4 A4 C5): `melody.wrong-degree`; the top note dropped (the tune moves to the middle): `melody.wrong-degree`; every note an octave down: `melody.octave`; the unchanged starter: `code.unchanged`",
        "Make: the starter's close voicings, a `voicing()` line: `rubric.unmet`",
      ],
      connects: {
        back: "J3.L01 voiced four-note rootless chords inside about an octave; U05.L06 met the grand staff and the low register; U05.L07 voice-led chords by hand.",
        forward:
          "J3.L03 gives the voicings a comping rhythm; JC3 and JC4 voice-lead a melody on top; AC2 keeps a top voice moving by step.",
      },
      epr: {
        enjoyment:
          "A vibes tune of the learner's own carried on top of open, ringing drop-2 chords: the block-chord sound of a jazz arrangement, from four notes and one octave move.",
        pace: 'One operation: drop the second note from the top an octave. Spread voicings are heard once, as "where it sits", not drilled; drop-3 and drop-2-and-4 are named only as wrong answers.',
        return:
          "The Coda says: you can now open a close voicing into a drop-2 voicing and put a tune on top of it. Next: the rhythms jazz pianists comp with.",
      },
      notes: [
        "Evaluated: every chord of the hook is `isDropTwo` (raise its lowest note an octave and it is close with that note second from the top): A3 D4 F4 C5 → D4 F4 A4 C5; G3 D4 F4 B4 → D4 F4 G4 B4; G3 C4 E4 B4 → C4 E4 G4 B4; C4 G4 B4 E5 → G4 B4 C5 E5.",
        "Drop-2 has no Strudel dictionary (no `drop2`): it is always hand-voiced (pre-flight B3). Never grade it with `pcset` (it ignores octaves) nor through `voicing()`.",
        "The quiz's `keyboard.voicing` and the Make's `voicing-shape` are planned; the spec names a fallback for each.",
        '`deck.jzz.voicings` (planned) deals its drop-2 cards from here: "drop-2 of C E G B" → G C E B.',
      ],
    },
    {
      id: "J3.L03",
      author: "J3a",
      idea: 'Comping is rhythm: the pianist plays the chords in short, swung hits that talk with the soloist. Two figures carry most of it: the Charleston, a hit on beat 1 and another on the "and" of 2, and the push, the next bar\'s chord arriving early on the "and" of 4 and held across the bar line. `.struct()` writes the first, `.early(1/8)` the second.',
      hook: {
        hear: 'The trio in B♭ (Cm7 F7 B♭maj7): first the Rhodes holds whole bars, then it comps on the Charleston, then every chord is pushed onto the "and" of 4: the same chords, three different conversations with the ride.',
        code: L03_HOOK,
      },
      key: Bb,
      meter: "4/4",
      bpm: 144,
      canDo: ["cd.code.comp-rhythms"],
      uses: [...BASE, "tb.early"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Three items over the same ride and bass: whole bars, the Charleston, the push. The captions name each rhythm.",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1,
          what: 'Tap the Charleston with the trio (beat 1 and the swung "and" of 2), eight taps over four bars, `mode: "along"`, `target: { track: "chords" }`. Never graded.',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The rootless comping holds whole bars; give it the Charleston. A `rhythm` matcher on `chords` (straightened grid, `durations: false`) plus `pcset` per onset with `bass` (the chords still the J3.L01 ones). Passes `.struct("x ~ ~ x ~ ~ ~ ~")`, `.struct("[x ~ ~ x] ~")`, `.struct("x [~ x] ~ ~")` (the "and" of 2 as half of beat 2), and the hits written in the chord pattern (`<[Cm7 ~ ~ Cm7 ~ ~ ~ ~] …>`); fails the starter, hits on 1 and 2 (`rhythm.displaced`), and the WRONG ANSWER WITH THE RIGHT FUNCTION `.struct("x ~ ~ x")` (beat 1 and beat 4: `rhythm.displaced`).',
          term: "term.charleston",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 0.75,
          panels: ["chords"],
          what: 'The comping with `.early(1/8)` before `.swingBy(1/3, 4)`: on which count each chord now starts (choice: the swung "and" of 4 of the bar before, 11/12 of the bar); how many chords sound in bar 1 the first time through (number: 0, the first chord would have begun before the music did). U13.L01\'s push, now swung.',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Push every chord onto the "and" of 4. `pcset` per onset with `bass` on `chords` (feel-aligned). Passes `.early(1/8)` before the swing call, `.early(.125)`, and `.early(1/8)` on the chord pattern before `.dict()` (all three sound at 11/12, 23/12, 35/12, 47/12: evaluated); fails the starter, the WRONG ANSWERS WITH THE RIGHT FUNCTION `.early(1/4)` (a beat early, on beat 4) and `.late(1/8)` (laid back, after the bar line), both `harmony.shifted`, and `.early("1/8")` (`code.time-fraction-string`).',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your comping on Cm7 F7 B♭maj7 over the Band's drums and bass: the Charleston, pushes, or a rhythm of your own that changes from bar to bar.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "The Band plays the drums and the bass in B♭. Comp the ii–V–I with rootless voicings in a rhythm that talks: the Charleston, a push into the next bar, hits that change from bar to bar with `< >`. At least three chords should land off the beat in four bars.",
        required: {
          rule: "syncopation",
          label: "At least three chords land off the beat",
          why: '`syncopation` with `track: "chords"`, `min: 3` (four-bar loop): evaluated in B♭ with the lesson\'s comping: the Charleston gives 4, the push (`.early(1/8)`) gives 3 (the first bar waits), whole bars and `.struct("x x x x")` give 0, and `.early(1/8)` written before `.struct("x ~ x ~ x ~ x ~")` (the right call, moving the chords under an unmoved rhythm) gives 0 and fails.',
        },
        suggestions: [
          "the comping changes from bar to bar (`bars-differ` on `chords`)",
          "a tempo between 120 and 200 (`tempo-bpm`)",
        ],
        band: "band.two-five-one",
        tracks: ["drums", "bass"],
        flavours: "The Band's drums and bass in the flavour's sounds; the learner's comping on `rhodes`.",
      },
      srs: [
        { family: "fam.rhy.syncopation", mode: "review-if-due" },
        { family: "fam.rhy.swing", mode: "review-if-due" },
      ],
      mistakes: [
        'modify (Charleston): hits on 1 and 2 (`x ~ x ~ ~ ~ ~ ~`): `rhythm.displaced`; `.struct("x ~ ~ x")`: `rhythm.displaced`; the unchanged starter: `code.unchanged`',
        'modify (push): `.early(1/4)`, `.late(1/8)`: `harmony.shifted`; `.early("1/8")`: `code.time-fraction-string`',
        "Make: whole bars, quarters, `.early(1/8)` before `.struct()` on beats: `rubric.unmet`",
      ],
      connects: {
        back: "U06.L08 comped with a rhythm and U06.L12 wrote it with `.struct()`; U13.L01 pushed chords with `.early(1/8)`; J1.L01 put the trio on the ride; J3.L01 gave the voicings.",
        forward:
          "J3.L04 puts a walking bass under this comping; RC1 pushes funk chords and stabs; JC2 comps a whole jazz blues.",
      },
      epr: {
        enjoyment:
          "The learner's own comping that talks with the ride: rootless chords in B♭ landing on the Charleston and leaning into the next bar, the moment the trio sounds played rather than programmed.",
        pace: "One idea: comping is a rhythm, with two figures. Both calls are known (`.struct()` U06.L12, `.early()` U13.L01); only the figures and the swing are new. Comping against a soloist (space, call and answer) is J4's and the capstones'.",
        return:
          "The Coda says: you can now comp with the Charleston rhythm and pushes. Next: the bass that walks under it, four to the bar.",
      },
      notes: [
        "Evaluated: `" +
          L03_COMP +
          '.early(1/8).swingBy(1/3, 4)` sounds at 11/12, 23/12, 35/12 and 47/12 (Cm7 B, F7 A, B♭maj7 B: B A B): the push lands on the swung "and" of 4; bar 1 is empty the first time through. `syncopation` (min 4 here) counted 4 for the Charleston and 3 for the push over four bars, so the Make asks for 3.',
        'A bare `onsets` rule reads raw onsets: the swung "and" of 2 is at 5/12 of the bar, not 3/8. Grade comping rhythms with a `rhythm` matcher (feel-aligned), as J1.L01 S4 does.',
        "Without `.voicing()` before `.struct()` the comping has no notes (evaluated: `chord(…).struct(…)` plays bare events): every example voices first.",
      ],
    },
    {
      id: "J3.L04",
      author: "J3b",
      idea: "A walking bass plays a note on every beat: the chord's root on beat 1, a chord tone on beat 3, and on beat 4 a note a half step (or a whole step) from where the next bar starts, so every bar line is approached and the line walks into each new chord. It is the floor every jazz trio stands on.",
      hook: {
        hear: "The trio in G over Am7 D7 Gmaj7: the bass first in two (root and 5th), then walking four to the bar (A C E E♭ | D F♯ A A♭ | G D B F♯ | G A B B♭), each fourth beat leaning a half step into the next bar.",
        code: L04_HOOK,
      },
      key: G,
      meter: "4/4",
      bpm: 132,
      canDo: ["cd.code.walking-bass"],
      uses: [...BASE],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "The same four bars with the bass in two, then walking. The caption names the one line that changed.",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "The walk on the roll with the chord band: how many notes a bar (number: 4); what beat 1 always plays (choice: the chord's root); how far beat 4 is from the next bar's first note (choice: a half step). The pass text names the walking bass.",
          term: "term.walking-bass",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The walk\'s beat 4s all repeat beat 3 (A C E E | D F♯ A A | …): give each bar line an approach note on beat 4. Graded with `bass-line` `approach: { min: 3, kinds: ["chromatic", "diatonic"] }` (the changes Am7→D7, D7→G, G→Am7) plus `onsets` `contains [0, 1/4, 1/2, 3/4]` `perBar` on `bass` (still four to the bar), in a `rubric` matcher. Passes the reference (E♭, A♭, F♯ from below, B♭), approaches from below (G♯ into A, C♯ into D), whole-step approaches (B into A, E into D), and the reference at `.gain(.8)`; fails the starter, the WRONG ANSWER WITH THE RIGHT IDEA IN THE WRONG PLACE (the approach note on beat 1 of the new bar, the root a beat late), an approach a 3rd away, and four notes crowded into beat 4 (`[e2 eb2 d2 db2]`: the bar loses its quarters).',
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Four fixed items, four bars each: is the bass in two, walking, or walking with every beat 4 a half step into the next bar (choice)? Graded on all four.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Walk your own bass line through Am7 D7 Gmaj7 Gmaj7 under the Band's drums and comping.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "The Band plays the drums and the comping on Am7 D7 Gmaj7 Gmaj7 in G. The bass is yours: walk it, a note on every beat, the root on 1, a chord tone on 3, and beat 4 a step or a half step from the next bar's first note. Up or down, high or low, is your choice.",
        required: {
          rule: "custom",
          label: "Your bass walks: every beat, roots on 1, approaches on 4",
          why: '`custom` `walking-bass` (planned, rebuilt to its content-kit definition: pre-flight A3) with `bass: "bass"`, `changes: ["Am7", "D7", "G^7", "G^7"]`, `rootOnOne: 0.75`, `chordToneOnThree: 0.5`, `approachOnFour: 0.5`, `maxSemis: 2`: four attacks crowded into beat 1 fail, a two-feel fails, four roots a bar fail (beat 4 repeats the next root: not an approach), a walk with roots on 1 and no approaches fails; the hook\'s walk and any walk that meets the shares pass. Until the grader rebuilds the rule, the lesson fails check 2 and says so.',
        },
        suggestions: [
          "beat 3 is a chord tone in every bar (`walking-bass` `chordToneOnThree: 1`)",
          "a tempo between 120 and 200 (`tempo-bpm`)",
        ],
        band: "band.two-five-one",
        tracks: ["drums", "chords"],
        flavours: "The Band's drums and comping in the flavour's sounds; the learner's bass on `upright`.",
      },
      srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
      mistakes: [
        "modify: the approach note on beat 1 (`[a1 c2 e2 e2] [eb2 d2 f#2 a2]`): `rubric.unmet` (bass-line approach); an approach a 3rd away: `rubric.unmet`; four notes crowded into beat 4: `rubric.unmet` (onsets); the unchanged starter: `code.unchanged`",
        "ear: two-feel heard as walking: `id.wrong`",
        "Make: four roots a bar, a two-feel, four attacks crowded into beat 1: `rubric.unmet`",
      ],
      connects: {
        back: "U08.L03 approached a chord change by a step or a half step; U08.L01 put roots on the change; J1.L05's backing walked, unnamed; J3.L01–L03 gave the comping.",
        forward:
          "J4.L02 walks a whole jazz blues; JC2 walks two choruses with the roots coming from the chord pattern; AC2 needs this lesson.",
      },
      epr: {
        enjoyment:
          "A bass line of the learner's own walking under a swinging trio in G, every bar line leaned into: the sound that makes jazz move forward, played by them.",
        pace: "One idea: four to the bar with approach notes. Chromatic passing notes inside the bar, two-octave lines and skips are optional; walking a whole blues is J4.L02's and JC2's.",
        return:
          "The Coda says: you can now walk a bass line through a set of changes (milestone: You can now walk a bass line). Next: the turnarounds that bring a tune back to the top.",
      },
      notes: [
        "Evaluated: the hook's walk A C E E♭ | D F♯ A A♭ | G D B F♯ | G A B B♭ has the root on every beat 1, a chord tone on every beat 3 (E, A, B, B), and every beat 4 a half step from the next first note (E♭→D, A♭→G, F♯→G, B♭→A on the loop).",
        "The term's example (`term.walking-bass`) was corrected for this spec: its G7 bar ended on D♭3 and the next bar began on C2, a 13-half-step drop, not an approach; it now walks D F A A♭ | G B D D♭ | C G E B | C E G E♭ (every bar line approached by a half step or a step).",
        "Ladder: the Make's `walking-bass` is planned (rebuild). The graded modify uses implemented rules (`bass-line` approach, `onsets`), so part A works today.",
        'Milestone ms.22 ("You can now walk a bass line") is this lesson\'s.',
      ],
    },
  ],
  capstones: [],
};
