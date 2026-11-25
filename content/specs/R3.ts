// R3 Clave & Euclidean Rhythm: the unit spec (rendered to content/specs/R3.md by `bun scripts/content/spec.ts`).
// The last unit of the rhythm track (contracts §2.6): five lessons, then the track's checkpoint R.CP (over R1–R3)
// and its two capstones RC1 "16th-Note Funk" and RC2 "Clave & Polyrhythm", both specified here. Every hook was
// evaluated with headless Strudel and is linted in its lesson by content/validate/specs.test.ts; R3.L01 is the
// exemplar, written and passing with the real grader (content/advanced/R3/L01). The pre-flight decisions this spec
// rests on are in the Wave 7 content lead's result (scratchpad w7/foundation-content-lead.md, "Pre-flight
// settled") and in AUTHORING §20; the timing fixtures (`CLAVE_GRIDS`, `claveMini`, `claveDirectionOf`, the Euclid
// rotation) are `@oak/content-kit` schema/wave7.ts.
import type { UnitSpec } from "./types.ts";

const C = { tonic: "C", mode: "major" } as const;
const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;

/**
 * What every R3 lesson may use on its earliest legal route: U13.CP passed and R1–R2 completed (the track's order
 * is fixed, contracts §7.6 rule 5), U14–U17 possibly unfinished. No mode names (U14), no `.pan()` (U14.L06), no
 * `horns` (U15.L05 or RC1.S2), no `vibes` or `jazzkit` (J1.L01: the jazz track is another track).
 */
const BASE = [
  "tb.setcpm",
  "tb.label",
  "tb.mini.seq",
  "tb.mini.rest",
  "tb.mini.sub",
  "tb.mini.alt",
  "tb.mini.repeat",
  "tb.mini.stack",
  "tb.mini.elongate",
  "tb.mini.replicate",
  "tb.gain",
  "tb.s",
  "tb.bank",
  "snd.drum.bd",
  "snd.drum.sd",
  "snd.drum.hh",
  "snd.drum.rim",
  "snd.drum.cb",
  "snd.drum.sh",
  "tb.n",
  "tb.scale",
  "scale.major",
  "tb.note",
  "tb.note.names",
  "tb.s.pitched",
  "snd.piano",
  "snd.rhodes",
  "snd.upright",
  "snd.fingerbass",
  "tb.chord",
  "tb.voicing",
  "chord.triad",
  "chord.dom7",
  "chord.seventh",
  "tb.struct",
  "tb.slow",
  "tb.late",
  "tb.early",
  "tb.velocity",
] as const;
/** R3.L01's own unlock (contracts §3.2): `x(k,n)`. Every later R3 lesson has it. */
const L01 = ["tb.mini.euclid"] as const;
/** R3.L03's own unlocks: `x(k,n,r)`, `.euclid()`, `.euclidRot()`. */
const L03 = ["tb.mini.euclid-rot", "tb.euclid", "tb.euclidRot"] as const;

/** The son clave on the rimshot, one bar per `< >` step (`claveMini`, contracts §6.6 RC2). */
const SON_32 = 'perc: s("<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>").gain(.8)';
/** R3.L01's groove: kick on 1 and 3, snare on 2 and 4, Rhodes on 2 and 4, the bass on the tresillo. */
const L01_HOOK = `${T(100)}kick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd")\nhats: s("hh*8").gain(.4)\nchords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)\nbass: note("<c2 f2>").struct("x ~ ~ x ~ ~ x ~").s("fingerbass")`;
/** R3.L02: a two-bar tune whose onsets are the son clave 3-2 itself (E G C | D B over C | G7). */
const L02_HOOK = `${T(104)}${SON_32}\nkick: s("bd ~ bd ~").gain(.7)\nhats: s("hh*8").gain(.3)\nbass: note("<c2 g1>").struct("x ~ ~ x ~ ~ x ~").s("upright")\nchords: chord("<C G7>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)\nmel: note("<[e4 ~ ~ g4 ~ ~ c5 ~] [~ ~ d5 ~ b4 ~ ~ ~]>").s("piano")`;
/** R3.L03: a bossa nova groove; the rimshot is (5,16) rotated by 10 steps: 3+3+4+3+3. */
const L03_HOOK = `${T(128)}perc: s("rim(5,16,10)").gain(.7)\nkick: s("bd ~ ~ bd bd ~ ~ bd").gain(.6)\nhats: s("hh*8").gain(.25)\nbass: note("<[c2 ~ ~ g1 g1 ~ ~ c2] [d2 ~ ~ a1 a1 ~ ~ d2]>").s("upright")\nchords: chord("<C^7 Dm7>").voicing().struct("x ~ ~ x ~ x ~ ~").s("rhodes").gain(.5)`;
/** R3.L04: a son montuno in 3-2 over C | G7: tumbao bass, piano montuno, the bongo bell on quarters. */
const TUMBAO = 'bass: note("<[~ ~ ~ g2 ~ ~ g1 ~] [~ ~ ~ d2 ~ ~ c2 ~]>").s("upright")';
const MONTUNO =
  'keys: note("<[[c4,e4] ~ ~ [e4,g4] [c4,e4] ~ [e4,g4] ~] [~ [d4,f4] [b3,d4] ~ [d4,f4] [b3,d4] ~ [e4,g4]]>").s("piano")';
const L04_HOOK = `${T(100)}${SON_32}\nperc2: s("cb*4").gain(.4)\n${TUMBAO}\n${MONTUNO}`;
/** R3.L05: the lab tape, the same son groove with the cinquillo on the bell and a kick on 1. */
const L05_HOOK = `${T(100)}${SON_32}\nperc2: s("cb(5,8)").gain(.4)\nkick: s("bd ~ ~ ~").gain(.6)\n${TUMBAO}\n${MONTUNO}`;

export const R3: UnitSpec = {
  unit: "R3",
  title: "Clave & Euclidean Rhythm",
  summary:
    "The last five lessons of the rhythm track (contracts §2.6), the rhythms under son, salsa, bossa nova, habanera and a great deal of pop and funk. Music first: three bass notes over the eight eighth notes of a bar, 3+3+2, are the tresillo, and two more make the cinquillo; Strudel asks for both with `(3,8)` and `(5,8)` (R3.L01, the exemplar). The son clave is two bars, a bar of three (the tresillo) and a bar of two, and the order is the direction, 3-2 or 2-3: a tune either speaks with it or crosses it (R3.L02). Every `(k,n)` is a Euclidean rhythm, `(4,16)` plain quarters among them, and a rotation `(k,n,r)` starts the same rhythm from another step: `(5,16,10)` is the bossa nova rim (R3.L03). Over the clave, the son's bass and piano each have a figure: the tumbao, which skips the downbeat and anticipates the next chord, and the montuno, two bars that face the clave's way (R3.L04). The lab takes a son groove apart by ear and names rhythms from the whole track (R3.L05). Then R.CP, and the two capstones: a sixteenth-note funk pocket with horn stabs (RC1) and a son-clave groove with a three-against-two layer and a Euclidean bell (RC2). The track opens after U13.CP (session 147 of the default order) and runs in a fixed order, so R3 always follows R1 and R2; it may interleave with U14–U17. Every lesson is optional and earns the next: each Make is a loop that sounds like a record.",
  conventions: [
    "Written for the learner at the gate (contracts §7.6 rule 5, AUTHORING §20.1): R3 always follows R1–R2, so it may use their tools (`.swingBy` patterns, the odd-meter tempo lines, `{ }%n`, `.late()` microtiming, `clav`) and their terms (grouping, interlock, hemiola, polyrhythm, polymeter, displacement, laid-back), but U14–U17 may be unfinished: no mode names, no `.pan()`, no `horns` before RC1.S2, no chromatic `n` steps, no secondary dominants by name. The jazz track is another track: no `jazzkit`, no `vibes`, no jazz glyphs. A learner at session 230 reads the same lessons: they never call the core's ideas new.",
    'The sound of the unit: the son\'s percussion on the drum sounds every learner has (`rim` for the clave, `cb` for the bongo bell and the cinquillo, `sh` for a shaker), the `upright` or `fingerbass`, the `piano` for the montuno and `rhodes` for comping. Labels follow STYLE §2: the clave is `perc`, a second percussion line `perc2` (then `perc3`), the montuno `keys`, the tune `mel`. There is no `clave` label and no Strudel sound called clave; prose says "the rimshot plays the clave".',
    'Grids and fixtures (contracts §6.6 RC2, `@oak/content-kit` schema/wave7.ts): 1 cycle = 1 bar of 4/4; the clave lives on the two-bar eighth grid. Son 3-2 is bar A {0, 3/8, 3/4} and bar B {1/4, 1/2}, written `"<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>"` (`claveMini("son", "3-2")`); 2-3 swaps the bars; rumba moves the three-side\'s last hit from 3/4 to 7/8. The direction is read from bar 1 (`claveDirectionOf`): three hits first is 3-2. Evaluated: `.late(1)` and `.early(1)` both turn a 3-2 clave into 2-3 (a period of two bars, shifted by one). Every claim about where a hit lands is read from the evaluated events, never from the code\'s look.',
    'Euclid in Strudel 1.2.6, evaluated: `(3,8)` plays steps {0, 3, 6} of 8 (the tresillo), `(5,8)` {0, 2, 3, 5, 6} (the cinquillo), `(4,16)` plain quarters, `(3,16)` {0, 5, 10}, `(5,16)` {0, 3, 6, 9, 12}. A rotation moves every pulse r steps LATER, wrapping round the bar: `(3,8,2)` plays {0, 2, 5}, `(3,8,1)` {1, 4, 7}, `(5,16,10)` {0, 3, 6, 10, 13} (3+3+4+3+3, the bossa nova rim), `.euclidRot(5,8,1)` {1, 3, 4, 6, 7}. `.euclid(3, 8)` is `(3,8)` as a method, and its arguments may be patterns: `.euclid("<3 5>", 8)` plays the tresillo in bar 1 and the cinquillo in bar 2. `(8,5)` (more hits than steps) throws an evaluation error: a hint, never a test, names it.',
    "Grading (AUTHORING §20.2, the corrections-pass standard): every required rule checks what is HEARD. A rhythm written in a step is `onsets` with `equals` and `perBar` (the exact hits in EVERY bar, so `.slow(2)`, a silent `.gain(0)` line, a pattern that only plays in bar 1 or one hit too many all fail), or a `rhythm` match against the reference for two-bar figures; a clave is the `clave` rule with `minBars` (planned, feature `clave.coverage`: every two-bar window from bar 1); a Euclidean layer the learner chooses is the `euclid` rule (planned) with `rotationFree`; a part that must face the clave is `clave-aligned` (planned custom, with the orientation test this spec asks for: see R3.L02's notes). Where a step teaches a notation, a `uses` rule follows the heard rule in the same rubric matcher (R3.L01 S5: the right rhythm written out slot by slot is told to use `(k,n)`). For every graded step: the reference, at least three other right answers (another sound, the pattern written out, `<…>` around it, `(k,n)` where the lesson allows it), the unchanged starter, and at least one WRONG answer that uses the right function: `(5,16)` for `(5,8)`, `x@2 x@3 x@3` for `x@3 x@3 x@2`, the clave's two bars in the wrong order, `.late(2)` (a whole period: nothing moves), the right call at `.gain(0)`.",
    'Words that wait: "clave" is R3.L02\'s term (R3.L01 says "a two-bar rhythm" if it must); "Euclidean rhythm" and "rotation" are R3.L03\'s (R3.L01–L02 say "k hits as evenly as n steps allow"); "montuno" and "tumbao" R3.L04\'s. Common words that are terms of other tracks\' lessons are avoided in R3 prose, because a learner may take R3 before them (course.test.ts): "register", "mix", "sample", "density", "texture", "head", "idiom", "extension". New terms: tresillo and cinquillo (L01, a pair), clave (L02), Euclidean rhythm and rotation (L03), montuno and tumbao (L04, a pair); L05 introduces none.',
    'Bands: `band.son-montuno` (Wave 7 Build, author:CP) plays the son: a two-bar I–V7 vamp, the bass a tumbao, the keys on the off-beats, toms where a conga would play, and no clave of its own, so it never crosses the learner\'s. L04 and L05, where the learner\'s montuno and tumbao carry the harmony, take its drums (`tracks: ["drums"]`). L01–L03 keep `band.two-chord-vamp` (I–IV, one chord a bar, every flavour; its drums are straight in every flavour) because their briefs are over C then F: `tracks: ["drums", "chords"]` when the learner writes bass and percussion (L01), all three when the learner writes the clave and a tune (L02), `["bass", "chords"]` when the learner writes the percussion (L03).',
    "Ear training, stage H (contracts §7.3): `fam.rhy.clave` is seeded in R3.L01 (level 1: tresillo, cinquillo, straight), level 2 opens in R3.L02 (son 3-2 against 2-3), level 3 adds rumba; `fam.code.mini` level 6 holds `(k,n,r)` (R3.L03). The Wave 7 decks `deck.rhy.euclid` (R3.L01; rotations R3.L03) and `deck.rhy.clave` (R3.L02) are in content/decks/planned.ts: until the drills engine writes them, no lesson names them in `srs` and the notes say where they join.",
    "Feedback the grader emits on R3 steps (pin what `bun run content:check <id> --verbose` prints): `rubric.unmet` (\"{label}: not yet.\"; an override that serves several rules stays neutral), `rhythm.missing`, `rhythm.extra`, `rhythm.displaced`, `code.unchanged`, `code.locked-mini` (`(k,n,r)` before R3.L03), `code.locked-tool` (`.euclid()` before R3.L03), `id.wrong`, `tap.missed`, `tap.extra`. Feedback below rung 4 never names the answer; an identify item's `id.wrong` says how to listen, and the step's pass text names what each answer was.",
  ],
  lessons: [
    {
      id: "R3.L01",
      author: "spec-R",
      idea: "Three bass notes spread over the eight eighth notes of a bar, three, three and two apart, are the tresillo: the bar leans forward because its second note falls between two beats. Two more hits, just before the second and the third, make the cinquillo. Strudel asks for both in one word: `(3,8)` is three hits as evenly as eight steps allow, `(5,8)` five.",
      hook: {
        hear: "A groove with the bass on the tresillo (C in one bar, F in the next) under a backbeat, eighth-note hats and Rhodes on 2 and 4; then the same groove with the bass on beats 1 and 3, which stands still.",
        code: L01_HOOK,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.code.tresillo"],
      uses: [...BASE, ...L01],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "The groove twice: the bass on the tresillo, then on beats 1 and 3. The caption names the one line that changed.",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1.25,
          what: "Tap with the bass over four bars, three taps a bar (twelve). Never graded; tests pin 1-and-3 and every-beat taps as fails.",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The bass\'s `.struct("x ~ ~ ~ x ~ ~ ~")` becomes the rhythm tapped. Graded: `onsets` on `bass` with `equals` {0, 3/8, 3/4} and `perBar` (a rubric matcher). Passes `x ~ ~ x ~ ~ x ~`, `x@3 x@3 x@2`, `x(3,8)`, the notes written in each bar; fails `x@2 x@3 x@3` (the right weights in the wrong order), `.slow(2)`, `.gain(0)`, an extra note on the last eighth, the unchanged starter.',
          term: "term.tresillo",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`s("cb(3,8)")`: 3 hits as evenly as 8 steps allow. What will you hear? (`choose`: the tresillo, 3+3+2 / three hits on beats 1, 2, 3 / three in a row then five rests)',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "The cowbell plays `cb(3,8)` over the tresillo bass; spread five hits over the same eight steps. Graded: `onsets` on `perc` `equals` {0, 1/4, 3/8, 5/8, 3/4} `perBar`, then `uses` `tb.mini.euclid` (the lesson's notation). Passes `cb(5,8)`, `rim(5,8)`, `<cb(5,8)>`, a softer gain; fails `cb(5,16)` (the right call on sixteen steps), `.gain(0)`, `.slow(2)`, and the right rhythm written slot by slot without `(k,n)`.",
          term: "term.cinquillo",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Three two-bar grooves (kick and hats fixed, the rimshot changes): tresillo, cinquillo or straight. An `all` of three `identify` parts; it seeds `fam.rhy.clave` (level 1, the same three categories).",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your tresillo groove: the bass on the tresillo (C, then F) and a cowbell line of your own over the Band's drums and chords.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "The band plays drums and two chords, C then F. The bass and the cowbell are yours. Put the bass on the tresillo, then make it your own: a cinquillo bell, a note on the last eighth that leads into the next bar, another sound, a tempo you like.",
        required: {
          rule: "onsets",
          label: "The bass plays the tresillo in every bar",
          why: "`onsets` on `@bass` with `contains` {0, 3/8, 3/4}, `excludes` {1/8, 1/4, 1/2, 5/8} and `perBar`: three heard attacks on the tresillo's places and none on the places it skips; 7/8 and the sixteenths stay free, so a pickup into the next bar passes. The starter (whole notes) fails; `<c2 f2>(3,8)`, the slots written out, degrees on `struct`, another sound and a pickup on the last eighth pass; `(3,4)` (the right call on four steps), `(5,8)` (the cinquillo in the bass) and the tresillo at `.gain(0)` fail.",
        },
        suggestions: [
          "a cinquillo on the cowbell (`onsets` on `perc` `equals` the cinquillo)",
          "a tempo between 90 and 120 (`tempo-bpm`)",
        ],
        band: "band.two-chord-vamp",
        tracks: ["drums", "chords"],
        flavours:
          "The Band's drums and chords in the flavour's sounds; the learner's bass starts on `fingerbass` in every flavour (unlocked long before R3) and the cowbell is the default kit's.",
      },
      srs: [{ family: "fam.rhy.clave", mode: "seed", level: 1 }],
      mistakes: [
        "modify (bass): `x@2 x@3 x@3` (the right weights in the wrong order) and `x ~ ~ x ~ ~ x x` (one too many): `rubric.unmet`; `.slow(2)` and `.gain(0)` (the right slots, not heard in every bar): `rubric.unmet`; the unchanged starter: `code.unchanged`",
        'modify (cowbell): `cb(5,16)` (the right call on sixteen steps), `.slow(2)`, `.gain(0)`: `rubric.unmet` on the rhythm; `cb ~ cb cb ~ cb cb ~` (the right rhythm without `(k,n)`): `rubric.unmet` on "Written with (k,n)"',
        'ear: the other answer: `id.wrong` ("Not that one. Count the rimshots in one bar against the hats, then listen once more.")',
        "Make: the starter, `(3,4)`, `(5,8)` in the bass, the tresillo at `.gain(0)`: `rubric.unmet`",
      ],
      connects: {
        back: "U13.L01 named syncopation and pushed chords ahead of the beat; R1.L01 heard which places in a bar are strong; R2.L01 grouped eighth notes in twos and threes. The tresillo is a 3+3+2 grouping inside 4/4.",
        forward:
          "R3.L02: the son clave's first bar is this tresillo, and its second bar answers it. R3.L03 opens `(k,n)` to every pair of numbers and rotates them.",
      },
      epr: {
        enjoyment:
          "A groove the learner built: their bass on the tresillo over the Band's backbeat and chords, a cowbell on the cinquillo, the forward lean of habanera and pop in a loop they will replay.",
        pace: "One idea: three (or five) hits spread over eight steps, by ear, by hand and with `(k,n)`. The two-bar clave is tomorrow's; other numbers and rotations wait for R3.L03.",
        return:
          "The Coda says: you can now write the tresillo and the cinquillo, by hand or with `(k,n)`, and hear which is which. Next: the son's two-bar rhythm, whose first half is the tresillo.",
      },
      notes: [
        "The exemplar: content/advanced/R3/L01 passes every content-CI check with the real grader (7 steps, 3 graded; 8.75 expert minutes, 12.25 scaled; split at S3, 4.2 / 8.05 scaled), with the corrections-pass test set on each graded step and on the Make.",
        "Evaluated: the hook's bass plays 0, 3/8, 3/4 in every bar (C2 then F2); `x@3 x@3 x@2` plays the same onsets as `x ~ ~ x ~ ~ x ~`; `x@2 x@3 x@3` plays 0, 1/4, 5/8; `(3,4)` plays 0, 1/4, 1/2; `(3,16)` plays 0, 5/16, 5/8; `(5,16)` 0, 3/16, 3/8, 9/16, 3/4. The tresillo is a heard 3+3+2 inside 4/4: its third note is ON beat 4, only the second is between beats (the first draft's \"the third one early\" was corrected).",
        '`deck.rhy.euclid` (content/decks/planned.ts) is seeded here once the drills engine writes it: "(3,8) as steps" and "(5,8)" cards, rotations from R3.L03.',
      ],
    },
    {
      id: "R3.L02",
      author: "R3a",
      idea: "The son clave is a two-bar key: a bar of three hits (the tresillo) and a bar of two (beats 2 and 3). Which bar comes first is its direction, 3-2 or 2-3, and the song decides: a tune that speaks with the clave sits; turned around, the same clave crosses it. The rumba clave moves the third hit of the three-side one eighth later.",
      hook: {
        hear: "A son groove in C: the rimshot on the clave 3-2, a tresillo bass, Rhodes, and a piano tune (E G C | D B) whose notes fall exactly on the clave's five hits. Then the same groove with the clave turned round to 2-3: not one tune note meets it.",
        code: L02_HOOK,
      },
      key: C,
      meter: "4/4",
      bpm: 104,
      canDo: ["cd.hear.clave"],
      uses: [...BASE, ...L01],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "The groove with the clave 3-2, then 2-3 under the same tune. The caption names the line that changed and says the second one fights the tune.",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1.25,
          what: "Tap the rimshot over four bars: three taps, then two, twice (ten). Never graded; tests pin taps on every beat, and the 2-3 order, as fails.",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 0.75,
          what: "Run the rimshot alone on the roll: how many hits in two bars (number: 5); which bar holds three (choice: the first); the first bar is a rhythm you know (choice: the tresillo). The pass text names the **clave** and its two sides.",
          term: "term.clave",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          features: ["clave.coverage"],
          what: 'A new tune starts on the two-side (its bar 1 hits beats 2 and 3); the clave under it is 3-2. Turn the clave round to 2-3. Graded: `clave` `{ track: "perc", type: "son", direction: "2-3", minBars: 4 }` (planned; until the grader lands it, the same step grades with a `rhythm` match on `perc` against the 2-3 reference, `tracks: ["perc"]`, which tells the two directions apart). Passes the two bars swapped, `.late(1)`, `.early(1)`, the three-side written `rim(3,8)`; fails the unchanged 3-2 starter, `.late(2)` (the right function, a whole period: nothing moves), the rumba 2-3 (third hit at 7/8), the clave in bars 1–2 only.',
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 0.75,
          what: "Son 3-2, then rumba 3-2, alone on the rimshot: which hit moved? (choice: the third hit of the three-side, one eighth later / the first hit of the two-side / nothing). The pass text names the rumba clave; no term.",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Four two-bar grooves: son 3-2 or son 2-3 (`CLAVE_OPTIONS`' son ids), the kick and hats fixed. An `all` of four `identify` parts at `fam.rhy.clave` level 2 (`review-if-due`). The direction fixture: two of the four play the SAME clave hits in the two orders.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A two-bar tune of your own that speaks the clave: choose the clave (son or rumba, 3-2 or 2-3), then write a tune on the piano whose notes meet it, over the Band.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The band plays drums, bass and two chords, C then F. Write the clave on the rimshot, son or rumba, 3-2 or 2-3: your choice. Then write a two-bar tune whose notes meet the clave's hits, so the tune and the clave speak together. Keep at least three of its notes with the clave in every two bars, and make its two bars different.",
        required: {
          rule: "custom",
          label: "Your tune faces the clave",
          why: "`custom` `clave-aligned` (planned) `{ track: \"mel\", clave: \"perc\", min: 3 }`, read in the clave's two-bar windows: the `perc` line is a son or rumba clave in either direction (otherwise the rule fails and says so), at least 3 of the tune's onsets per window coincide with clave hits, MORE coincide with the clave as written than with its two bars swapped (a tune that crosses the clave fails), and the tune's two bars differ. The starter (a tune on four plain quarters, which meets both orders equally) fails; the hook's tune over 3-2 passes, and over 2-3 fails; a tune on every eighth meets both orders equally and fails.",
        },
        suggestions: [
          "the bass on the tresillo in the clave's three-side bar (`onsets` on `@bass`)",
          "the clave at least four bars long (`clave` with `minBars: 4`, in the direction you chose)",
        ],
        band: "band.two-chord-vamp",
        tracks: ["drums", "bass", "chords"],
        flavours:
          "The Band in the flavour's sounds; the learner's tune starts on `piano` in every flavour and the clave on the rimshot.",
      },
      srs: [{ family: "fam.rhy.clave", mode: "review-if-due", level: 2 }],
      mistakes: [
        "modify: the unchanged 3-2: `code.unchanged`; `.late(2)` (the right function, a whole period): `rubric.unmet`; the rumba 2-3: `rubric.unmet`; the 2-3 clave only in bars 1–2 then silence: `rubric.unmet` (coverage)",
        'ear: the other direction: `id.wrong` ("Not that one. Find the bar with three hits: is it the first of the two, or the second?")',
        "Make: the starter (quarters), a tune on every eighth, the hook's tune over a 2-3 clave (crossed): `rubric.unmet`; no clave on `perc` (a tresillo in every bar): `rubric.unmet` with the rule's own detail",
      ],
      connects: {
        back: "R3.L01 wrote the tresillo: it is the clave's three-side. U07.L06 paired a call with a response over two bars; R2.L05 heard a figure cross the bar line and come back.",
        forward:
          "R3.L03 builds every rhythm of this kind from two numbers and rotates them. R3.L04 lines the son's bass and piano up with the clave. RC2 writes eight bars of son clave 3-2 with a tresillo bass.",
      },
      epr: {
        enjoyment:
          "A two-bar tune of the learner's own that locks with the clave they chose, over a band: the moment a son groove sits, and they hear it cross when they flip it.",
        pace: "One idea: the clave is two bars and its direction is the order. The rumba is one hit moved and is heard once; the son's piano and bass figures wait for R3.L04.",
        return:
          "The Coda says: you can now hear a clave's direction and write a tune that faces it. Next: every rhythm of this family from two numbers, and how to rotate one.",
      },
      notes: [
        "Evaluated: the hook's tune plays 0, 3/8, 3/4 | 5/4, 3/2 and its clave 0, 3/8, 3/4 | 5/4, 3/2, five of five together; under the 2-3 clave (`.late(1)`: 1/4, 1/2 | 1, 11/8, 7/4) none of the five meet. `.late(1)` and `.early(1)` of the 3-2 clave both give the 2-3 onsets.",
        'Request to the grader (apiNotes): `clave-aligned` as TRACK_CUSTOM_RULES documents it ("its two bars differ, and at least `min` of its onsets per window coincide with clave hits") passes a part that crosses the clave as long as it coincides `min` times. This spec asks for the orientation test too: per window, the part\'s coincidences with the clave as written are strictly MORE than with the clave\'s two bars swapped, and a `perc` line that is not a clave in either direction fails the rule. Without it R3.L02\'s and R3.L04\'s Makes cannot tell "faces the clave" from "crosses it". Golden tests: the hook\'s tune over 3-2 passes and over 2-3 fails; quarters fail both ways (4 = 4).',
        "`deck.rhy.clave` (planned) is seeded here once written: son and rumba, 3-2 and 2-3, one card a day.",
      ],
    },
    {
      id: "R3.L03",
      author: "R3a",
      idea: "Every `(k,n)` is a Euclidean rhythm: k hits as evenly as n steps allow. `(4,16)` is four plain quarters, `(3,8)` the tresillo, `(5,16)` five hits three sixteenths apart with one longer gap. A third number rotates it, `(k,n,r)`, starting the same spacing r steps later: `(5,16,10)` puts the long gap in the middle, and it is the bossa nova rim. `.euclid()` and `.euclidRot()` say the same as methods, and their numbers can change bar by bar.",
      hook: {
        hear: "A bossa nova groove at 128: the rimshot on 3+3+4+3+3 sixteenths, the bass and kick on 1, the and of 2, 3 and the and of 4, Rhodes on Cmaj7 and Dm7. Then the rimshot on plain `(5,16)`: the same five hits and gaps, starting from another place, and the bossa is gone.",
        code: L03_HOOK,
      },
      key: C,
      meter: "4/4",
      bpm: 128,
      canDo: ["cd.code.euclidean"],
      uses: [...BASE, ...L01, ...L03],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "The bossa groove with its rim on `(5,16,10)`, then on `(5,16)`. The caption: same five hits, same gaps, another starting point.",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1.25,
          what: "Tap the rimshot over four bars, five taps a bar. Never graded.",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 0.75,
          what: "Run three lines, `cb(4,16)`, `cb(3,8)`, `cb(5,16)`, one at a time: which one is plain quarters (choice: `(4,16)`); how many steps apart are most hits of `(5,16)` (number: 3). The pass text names the **Euclidean rhythm**.",
          term: "term.euclidean-rhythm",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`s("cb(3,8,2)")` beside `s("cb(3,8)")`: what changes? (`choose`: the same gaps, 3+3+2, started two steps later, so the bar now reads 2+3+3 / the hits get closer together / every hit moves two steps earlier)',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The rim plays `rim(5,16)` under the bossa; rotate it until it plays the target, 3+3+4+3+3 from beat 1. Graded: `onsets` on `perc` `equals` {0, 3/16, 3/8, 5/8, 13/16} `perBar`, then `uses` [`tb.mini.euclid-rot`, `tb.euclidRot`] (the lesson\'s notation). Passes `rim(5,16,10)`, `s("rim").euclidRot(5,16,10)`, another sound, `<rim(5,16,10)>`; fails `rim(5,16,3)` (the right call, the wrong rotation: 3/16, 3/8, 9/16, 3/4, 15/16), `rim(5,16,10)` at `.gain(0)`, `.slow(2)`, and the target written slot by slot.',
          term: "term.rotation",
        },
        {
          kind: "quiz",
          exercise: "identify",
          answer: ["euclid"],
          minutes: 0.75,
          graded: true,
          what: 'Name the numbers: two rhythms on the cowbell, heard over the hats with the roll shown after the first try; answer each with the `euclid` widget (`{ ui: "euclid", maxSteps: 16, rotation: true }`, planned), `correct: { euclid: [3, 16] }` and `{ euclid: [5, 8, 1] }`. Graded by the onsets the numbers make, so any spelling that plays the same rhythm passes (`[5, 8, 1]` is the only one for the second; the grader proves it). Pins `[3, 8]` for the first (the right k, half the steps: the tresillo, not the wider 5+5+6) and `[5, 8]` for the second (the right k and n, no rotation).',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The method form, with a pattern for k: the cowbell `s("cb").euclid(3, 8)` plays the tresillo in every bar; make bar 2 the cinquillo with one change. Graded: a `rhythm` match on `perc` against `s("cb").euclid("<3 5>", 8)` over 4 bars, then `uses` `tb.euclid`. Passes `.euclid("<3 5>", 8)`, `.euclidRot("<3 5>", 8, 0)`, another sound; fails `.euclid("<5 3>", 8)` (the right call, the bars in the wrong order), `.euclid("[3 5]", 8)` (both inside one bar), and `s("<cb(3,8) cb(5,8)>")` (the right rhythm in mini-notation: `rubric.unmet` on the method).',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A percussion section from Euclidean rhythms over the Band's bass and chords: a five-over-sixteen bell in the rotation you choose, plus layers of your own.",
        },
      ],
      wrapAt: 5,
      make: {
        brief:
          "The band plays bass and two chords. The percussion is yours, every line a Euclidean rhythm: a bell of five hits over sixteen steps, rotated wherever it grooves best for you (the bossa nova is one choice), and around it a kick, a shaker, a second bell, each with its own (k,n) or (k,n,r).",
        required: {
          rule: "euclid",
          label: "Five hits over sixteen steps on the bell, in any rotation",
          why: '`euclid` (planned) `{ track: "perc", k: 5, n: 16, rotationFree: true }`, graded by the onsets heard in every bar: `rim(5,16)`, `(5,16,10)`, `.euclidRot(5,16,3)`, the pattern written out and `.euclid(5,16)` all pass; the starter (`rim*4`, which is (4,16)), `rim(5,8)` (the right call on eight steps), `(5,16,10)` at `.gain(0)` and `.euclidRot(5,16,10).slow(2)` fail.',
        },
        suggestions: [
          "a rotated layer that does not start on beat 1 (`onsets` on `perc2` `excludes` {0})",
          "the rotation of the bossa nova, 3+3+4+3+3 (`onsets` on `perc` `equals` {0, 3/16, 3/8, 5/8, 13/16})",
        ],
        band: "band.two-chord-vamp",
        tracks: ["bass", "chords"],
        flavours:
          "The Band's bass and chords in the flavour's sounds; the learner's percussion on the default kit.",
      },
      srs: [{ family: "fam.code.mini", mode: "review-if-due", level: 6 }],
      mistakes: [
        "modify (rotation): `rim(5,16,3)` (the right call, the wrong rotation), `.gain(0)`, `.slow(2)`: `rubric.unmet`; the target written out: `rubric.unmet` on the notation; `rim(5,16,10)` in R3.L02 or earlier is `code.locked-mini` (pinned in R3.L02's lint, not here)",
        'modify (method): `.euclid("<5 3>", 8)` (bars swapped), `.euclid("[3 5]", 8)`: `rhythm.extra` / `rhythm.missing`; `s("<cb(3,8) cb(5,8)>")`: `rubric.unmet` on the method; the unchanged starter: `code.unchanged`',
        "Make: the starter `rim*4`, `rim(5,8)`, the bell at `.gain(0)`, `.slow(2)`: `rubric.unmet`",
      ],
      connects: {
        back: "R3.L01 wrote `(3,8)` and `(5,8)`; R2.L04 heard two pulses at once and R2.L05 a cycle that crosses the bar line.",
        forward:
          "R3.L04 layers the son's bass and piano on the clave; RC2 asks for a Euclidean bell beside the clave and a three-against-two layer.",
      },
      epr: {
        enjoyment:
          "A percussion section the learner built from numbers over a band: a bell rotated until it grooves (the bossa nova is one turn of the dial) with layers that lock around it.",
        pace: "One idea: two numbers make an even-as-possible rhythm, a third starts it elsewhere. The method form is the same idea with patterned numbers; the clave-aligned parts wait for R3.L04.",
        return:
          "The Coda says: you can now write Euclidean rhythms and rotate them. Next: the son's bass and piano figures, and how they face the clave.",
      },
      notes: [
        'Evaluated: `rim(5,16,10)` and `.euclidRot(5,16,10)` play 0, 3/16, 3/8, 5/8, 13/16; `(5,16,3)` plays 3/16, 3/8, 9/16, 3/4, 15/16; `(3,8,2)` plays 0, 1/4, 5/8; `.euclid("<3 5>", 8)` plays the tresillo in bar 1 and the cinquillo in bar 2; `.euclid(4,16)` plays plain quarters.',
        'The bossa claim: (5,16) rotated so its long gap falls after the third hit, 3+3+4+3+3, is the cross-stick pattern of bossa nova (Toussaint\'s Euclidean-rhythm survey names it so). Prose says "the bossa nova rim", never "the bossa nova clave": clave is the son\'s word in this unit.',
        "`fam.code.mini` level 6 (`(k,n,r)` and `{ }%n`) is open here (its gate is R2.L05 or R3.L03). `deck.rhy.euclid`'s rotation cards open here once the deck is written.",
        "The Make's required rule is the planned `euclid`; until the grader lands it the lesson fails check 2 and says so. With rotationFree it cannot insist on a rotation; the brief's free choice IS the rotation, and the suggestion rewards a layer off the downbeat.",
      ],
    },
    {
      id: "R3.L04",
      author: "R3b",
      idea: "Over the son clave the bass and the piano each have a figure. The tumbao skips the downbeat and plays the and of 2 and beat 4, where it already sounds the NEXT chord's root, so the bass pulls the harmony forward. The montuno is a two-bar syncopated piano figure, and like a tune it faces the clave: more of its hits meet the clave in the right order than turned round.",
      hook: {
        hear: "A son montuno at 100 in C: the rimshot on the clave 3-2, the bongo bell on quarters, the tumbao (G on the and of 2, then the next chord's root on beat 4) and a piano montuno in thirds over C and G7. Then without the bass and piano: only the clave and the bell.",
        code: L04_HOOK,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.code.montuno"],
      uses: [...BASE, ...L01, ...L03],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "The son montuno, then the clave and the bell alone, then the bass and piano back in.",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice"],
          minutes: 0.75,
          what: "The bass alone on the roll: which beats it plays (choice: the and of 2 and beat 4); what it skips (choice: beat 1); which chord the beat-4 note belongs to (choice: the next bar's). The pass text names the **tumbao**.",
          term: "term.tumbao",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The bass plays the roots on beats 1 and 3 (`<[c2 ~ ~ ~ c2 ~ ~ ~] [g1 ~ ~ ~ g1 ~ ~ ~]>`); turn it into a tumbao. Graded: an `all` of `onsets` on `bass` `equals` {3/8, 3/4} `perBar` (rubric matcher) and an `events` match on `bass` (`pitch: "octave-free"`, `rhythm: "onsets"`) against the reference, so the beat-4 note must be the next chord\'s root. Passes the reference, the octave changed, the weights `<[~@3 g2@3 g1@2] [~@3 d2@3 c2@2]>` (evaluated: 3/8, 3/4 in both bars); fails the and of 2 and beat 4 on the chord of their own bar (`<[~ ~ ~ g2 ~ ~ c2 ~] [~ ~ ~ d2 ~ ~ g1 ~]>`: the right places, no anticipation, a pitch miss in every bar), the tumbao with a note on beat 1 too, and the unchanged starter.',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The montuno is written crossed (its two bars in the wrong order against a 3-2 clave); turn it round. Graded: `custom` `clave-aligned` `{ track: "keys", clave: "perc", min: 3 }` (planned, with the orientation test of R3.L02\'s notes); until it lands, a `rhythm` match on `keys` against the reference. Passes the bars swapped, `.late(1)`, `.early(1)`, the dyads revoiced; fails the unchanged starter, `.late(2)` (a whole period), and the montuno flipped AND the clave flipped to 2-3 (the clave is the brief\'s, `edit-only-regions` on `keys`: `code.edit-outside`).',
          term: "term.montuno",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Three grooves: does the montuno face the clave or cross it? (choice: with the clave / crossed). An `all` of three `identify` parts; the clave and the montuno's notes are the same in all three, only the montuno's bar order changes. Reviews `fam.rhy.clave`.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your son: over the clave (given, 3-2), a tumbao and a montuno of your own on two chords, I and V7 in C or a key you choose.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "The clave plays 3-2 on the rimshot and the band's drums keep time. Write the son's bass and piano: a tumbao that skips beat 1 and anticipates the next chord, and a two-bar montuno that faces the clave. C and G7 is the starting point; any two chords, any key.",
        required: {
          rule: "custom",
          label: "Your montuno faces the clave",
          why: '`custom` `clave-aligned` (planned) `{ track: "keys", clave: "perc", min: 3 }` with the orientation test (R3.L02 notes): the starter\'s block chords on every beat meet both orders equally and fail; the hook\'s montuno passes and fails when its bars are swapped (crossed); a one-bar figure repeated (both bars alike) fails.',
        },
        suggestions: [
          "the tumbao on the and of 2 and beat 4 (`onsets` on `@bass` `contains` {3/8, 3/4}, `excludes` {0})",
          "the bongo bell on quarters (`onsets` on `perc2`)",
        ],
        band: "band.son-montuno",
        tracks: ["drums"],
        flavours:
          "The Band's drums in the flavour's kit; the learner's montuno on `piano` and the tumbao on `upright` in every flavour.",
      },
      srs: [{ family: "fam.rhy.clave", mode: "review-if-due" }],
      mistakes: [
        "modify (tumbao): the right places on the own chord's roots: the events matcher's pitch code (pin what `content:check --verbose` prints); a note on beat 1 as well: `rubric.unmet`; the unchanged starter: `code.unchanged`",
        "modify (montuno): `.late(2)`: `rubric.unmet`; the clave flipped too: `code.edit-outside`; the unchanged starter: `code.unchanged`",
        'ear: the other answer: `id.wrong` ("Not that one. Follow the clave\'s three-side bar and listen to whether the piano lands with it.")',
        "Make: the starter, a crossed montuno, a one-bar montuno repeated: `rubric.unmet`",
      ],
      connects: {
        back: "R1.L04 made bass, clav and guitar interlock; U13.L01 pushed chords ahead of the bar line, which the tumbao does with its beat-4 note; R3.L02 lined a tune up with the clave.",
        forward:
          "R3.L05 takes this whole groove apart by ear. RC2 builds an eight-bar son groove of the learner's own on the clave 3-2.",
      },
      epr: {
        enjoyment:
          "A son montuno the learner wrote over the clave: their tumbao pulling the chords forward and their piano figure locked to the clave, the sound of a Cuban band in a two-bar loop.",
        pace: "One idea: two parts that line up with the clave, the bass by anticipation and the piano by direction. Both are written once and the Make combines them; the clave itself is given.",
        return:
          "The Coda says: you can now layer a montuno and a tumbao on the clave. Next: the rhythm lab, where you take a groove like this apart by ear.",
      },
      notes: [
        "Evaluated: the tumbao plays 3/8 (G2 over C, D2 over G7) and 3/4 (G1 then C2: the next bar's root); its two notes meet the clave's 2nd and 3rd hits on the three-side. The montuno plays bar A {0, 3/8, 1/2, 3/4} and bar B {1/8, 1/4, 1/2, 5/8, 7/8}: 3 + 2 = 5 hits meet the clave 3-2, against 1 + 0 = 1 with the clave's bars swapped. Its last dyad (E G on the and of 4) anticipates C.",
        "The C2 of the tumbao on beat 4 of the G7 bar is a 4th above the root, held into the next bar: the tension IS the anticipation. course.test.ts only scans against a Band's chords, and this Band plays drums only.",
        'Treat the montuno as Oak\'s own figure, not a universal formula (pre-flight row R3.L04): prose says "a montuno", never "the montuno pattern".',
        "The montuno step needs `edit-only-regions` on `keys` so a learner cannot pass by flipping the clave instead of the piano.",
      ],
    },
    {
      id: "R3.L05",
      author: "R3b",
      idea: "The rhythm lab: a son groove like yesterday's, taken apart by ear, and rhythms from the whole track named by ear. Taking a rhythm down is counting against a ruler: the hats' eighths, the clave's two bars, the bar of 7/8's groups. Then a figure you took down comes back displaced, the oldest trick in the track.",
      hook: {
        hear: "The lab tape: a son groove at 100 in C, the clave 3-2 on the rimshot, the cinquillo on the bell, a kick on 1, the tumbao and a piano montuno. The learner hears it whole, then takes it apart.",
        code: L05_HOOK,
      },
      key: C,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.transcribe.rhythms"],
      uses: [...BASE, ...L01, ...L03],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "The lab tape twice, then each line alone in turn (rimshot, bell, bass, piano), so the learner knows what they will take down.",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Name the rhythm, four items from the whole track (an `all` of four `identify` parts, each with its own options): the tape's clave (son 3-2 / son 2-3 / rumba 3-2 / rumba 2-3, `CLAVE_OPTIONS`); a bar of 7/8 (2+2+3 / 2+3+2 / 3+2+2, `fam.rhy.odd-grouping`'s ids; the part declares 7/8 and its own tempo line); three against two or straight (`fam.rhy.polyrhythm`); light or hard swing (`fam.rhy.swing`). Reviews each family.",
        },
        {
          kind: "dictate",
          exercise: "dictation",
          answer: ["code"],
          minutes: 1.5,
          graded: true,
          what: 'Take the bass down: the tape plays with its code hidden; the starter is `bass: note("c2").struct("x ~ ~ ~ ~ ~ ~ ~")` (one pitch: rhythm only). Graded: a `rhythm` match on `bass` against the tumbao\'s rhythm (onsets {3/8, 3/4} in both bars), `pass: 0.95`, `byEar: { ab: true, rates: [1, 0.75] }`. Passes `~ ~ ~ x ~ ~ x ~`, `struct("~@3 x@3 x@2")`, the notes written out; fails the bass on beats 2 and 4 (two notes, the right count in the wrong places), the tresillo (a note on beat 1 too), the unchanged starter.',
        },
        {
          kind: "dictate",
          exercise: "dictation",
          answer: ["code"],
          minutes: 1.5,
          graded: true,
          what: 'Take the bell down, now playing a rotation (`cb(5,8,1)`, the cinquillo started one step later: 1/8, 3/8, 1/2, 3/4, 7/8). Starter `perc2: s("cb(5,8)")`. Graded: `onsets` on `perc2` `equals` the five places `perBar`. Passes `cb(5,8,1)`, `s("cb").euclidRot(5,8,1)`, written out; fails the unchanged starter, `cb(5,8,2)` (the right call, a step too far: 0, 1/4, 1/2, 5/8, 7/8), `cb(3,8,1)`.',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Call and displaced answer: four bars from the tape, the bell's figure in bars 1–2 and the same figure moved later by an eighth or a sixteenth in bars 3–4, the rest of the groove holding; then make it yours.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "Four bars from the lab tape. In bars 1 and 2 the bell plays its figure; in bars 3 and 4 the same figure comes back moved later, by an eighth or a sixteenth, while the clave, the bass and the piano hold their ground. Then make it yours: another bell figure, a ghosted hat line, a tempo.",
        required: {
          rule: "custom",
          label: "The bell's figure comes back displaced",
          why: '`custom` `displaced-copy` (planned) `{ track: "perc2", min: 1 }`: a figure comes back moved to another place in the bar, every onset shifted by the same amount, at least a 16th and not a whole bar, with the same drum and rhythm. The starter (the figure repeated as it is) fails; `.late(1/8)` or `.late(1/16)` on bars 3–4 passes; `.late(1)` (a whole bar: the right function, nothing displaced in the bar) and `.late(1/32)` (a feel, under a 16th) fail; a new figure in bars 3–4 fails.',
        },
        suggestions: [
          'the clave holds all four bars (`clave` `{ type: "son", direction: "3-2", minBars: 4 }`)',
          "ghost notes on a hat line (`velocity-ghosts`, R1.L03)",
        ],
        band: "band.son-montuno",
        tracks: ["drums"],
        flavours: "The Band's drums in the flavour's kit; the tape's lines keep their sounds.",
      },
      srs: [
        { family: "fam.rhy.clave", mode: "review-if-due", level: 3 },
        { family: "fam.rhy.odd-grouping", mode: "review-if-due" },
        { family: "fam.rhy.polyrhythm", mode: "review-if-due" },
        { family: "fam.rhy.dictation", mode: "review-if-due" },
      ],
      mistakes: [
        'ear: the other answer on any part: `id.wrong` with that part\'s listening advice ("Count the groups against the hats: where does the long one fall?")',
        "dictate (bass): beats 2 and 4, the tresillo: `rhythm.displaced` / `rhythm.extra`; the unchanged starter: `code.unchanged`",
        "dictate (bell): `cb(5,8,2)`, `cb(3,8,1)`: `rubric.unmet`; the unchanged starter: `code.unchanged`",
        "Make: the starter, `.late(1)`, `.late(1/32)`, a new figure: `rubric.unmet`",
      ],
      connects: {
        back: "U13.L06 took a funk groove down slot by slot; R1.L05 displaced a figure; R2.L01 and R2.L04 named groupings and three against two; R3.L01–L04 built every line of the tape.",
        forward:
          "R.CP checks the whole track. RC1 builds a sixteenth-note funk pocket, RC2 a son groove of the learner's own with a three-against-two layer.",
      },
      epr: {
        enjoyment:
          "Four bars of son that answer themselves: the bell's figure stated, then knocked an eighth sideways over a clave, bass and piano that do not budge, a loop with a joke in it.",
        pace: "One idea: take a rhythm down by counting it against a ruler. The lab brings the track's rhythms together in four named items and two dictations; nothing new is taught, and the Make reuses R1.L05's displacement.",
        return:
          "The Coda says: you can now take down syncopated, swung and odd-meter rhythms by ear. Next: the rhythm checkpoint, then two capstones, a funk pocket with horn stabs and a son groove of your own.",
      },
      notes: [
        "Evaluated: `cb(5,8,1)` plays 1/8, 3/8, 1/2, 3/4, 7/8; `cb(5,8,2)` plays 0, 1/4, 1/2, 5/8, 7/8 (it shares only two places with the target, 1/2 and 7/8). The tape's bass is the tumbao of R3.L04.",
        "The 7/8 part of the ear step is a stimulus in another meter inside a 4/4 lesson: the author writes its own tempo line (`setcpm(bpm/7)`, eighths a minute, STYLE §8: `setcpm(240/7)`) and the part's `meter: \"7/8\"`; if the identify part cannot declare a meter, the author asks the lesson engineer and uses `fam.rhy.odd-grouping`'s generator (a `params` stimulus) instead.",
        "The Make's required rule is the planned `displaced-copy` (R1.L05's); until it lands the lesson fails check 2 and says so.",
      ],
    },
  ],
  checkpoint: {
    id: "R.CP",
    author: "CP",
    authored: [
      {
        id: "ghost-the-hats",
        kind: "code-modify",
        skills: ["R14"],
        what: 'A funk groove at 100 with sixteenth hats all at full level (`hats: s("hh*16")`): ghost the off-beat sixteenths and keep the beats loud. Graded: `velocity-ghosts` `{ track: "hats", min: 8, on: "16th-offbeat", accents: 2 }` (implemented). Passes `.velocity("[1 .3 .6 .3]*4")`, `.gain("[1 .3 .7 .3]*4")`, `.velocity("1 .25")` patterned per sixteenth pair; fails the ghosts at velocity 0 (silent: not heard, decision 71), everything at .3 (no accents), ghosts on the beats and accents between them (`.velocity("[.3 1]*8")`), the unchanged starter.',
      },
      {
        id: "displace-the-riff",
        kind: "code-modify",
        skills: ["R15"],
        what: 'A two-bar clav riff over the clave; bars 3–4 repeat it. Make bars 3–4 the same riff an eighth later (`arrange` or `<…>` with `.late(1/8)`). Graded: `custom` `displaced-copy` `{ track: "keys", by: [[1, 8]], min: 1 }` (planned); until it lands, a `rhythm` match on `keys` against the reference. Passes `.late(1/8)` on bars 3–4, the shifted riff written out; fails `.late(1)` (a whole bar), `.late(1/16)` (the wrong amount for this item), `.late(1/32)` (a feel), the unchanged starter.',
      },
      {
        id: "son-clave-two-three",
        kind: "code-modify",
        skills: ["R18"],
        what: 'Write the son clave 2-3 on `perc` for four bars, its three-side with `(3,8)`. Graded: `clave` `{ track: "perc", type: "son", direction: "2-3", minBars: 4 }` (planned) and `uses` `tb.mini.euclid`; until `clave` lands, a `rhythm` match on `perc` against `"<[~ ~ rim ~ rim ~ ~ ~] rim(3,8)>"`. Passes that, `.late(1)` of the 3-2, another sound; fails the 3-2 (the same hits, the wrong order), the rumba 2-3, `(3,8)` in every bar.',
      },
    ],
    recipe: {
      items: [14, 16],
      families: {
        R16: ["fam.rhy.odd-grouping"],
        R17: ["fam.rhy.polyrhythm"],
        R18: ["fam.rhy.clave"],
        E14: ["fam.rhy.dictation"],
      },
      why: "R16, R17 and R18 have families that give evidence for them, each at the learner's level (odd groupings in 5/8, 7/8 and 9/8; three against two, four against three, polymeter; tresillo, cinquillo, son and rumba in both directions). R14 and R15 are concept skills with no family (fam.rhy.syncopation credits R10), so each is measured by an authored code item; R18 also by `son-clave-two-three` and the Make. E14 is level-setting here (a re-test of U13.CP, contracts §7.6): `fam.rhy.dictation` at the learner's level; it never blocks.",
    },
    make: {
      brief:
        "Four bars of your own over the son clave 3-2 (given on the rimshot): a sixteenth-note hat line with ghost notes, a bass of your choice (a tumbao, a tresillo, a funk line), and anything else from the track.",
      required:
        'R14: `velocity-ghosts` `{ track: "hats", min: 4, on: "16th-offbeat", accents: 2 }` (implemented) as the one required rule; suggestions: `clave` son 3-2 `minBars: 4` (R18), `syncopation` on `@bass` (R15 is measured by its authored item). The starter has the clave and straight eighth hats at one level, so it fails.',
    },
    notes: [
      'R.CP follows R3.L05 and is placed after any one intervening session (contracts §7.6: "the track checkpoints: after any one intervening session"), so it always falls on a later day. Passing or soft-passing it opens RC1 and RC2 (§4.3); it gates nothing else (track checkpoints gate only track capstones, §7.6 rule 5).',
      "Gated: R14 R15 R16 R17 R18; level-setting: E14, a re-test (content/checkpoints.ts `CHECKPOINT_RETESTS`).",
      "No sung item. The tap items of `fam.rhy.polyrhythm` level 3 (`tap-3-over-2`) are production and level-setting only: skipped in Quiet mode, never blocking.",
      'author:CP registers the Make\'s Band in `CHECKPOINT_MAKE_BANDS`: `{ band: "band.two-chord-vamp", tracks: ["chords"] }` (the drums and the bass are the learner\'s).',
      "Recipe families must exist and open by R.CP in every legal order: odd-grouping (R2.L01), polyrhythm (R2.L04), clave (R3.L01), dictation (U01.L09). The planned `clave` and `displaced-copy` rules have stated fallbacks so the checkpoint can be written and pass before the grader lands them.",
    ],
  },
  capstones: [
    {
      id: "RC1",
      author: "capstones-rhythm",
      intent:
        "The first rhythm-track track on the album: a one-chord minor-seventh funk vamp with a sixteenth-note pocket. Session 1 is the drums and the bass: ghosted sixteenths, a kick and a bass that both hit the one, a bass that dances off the eighth grid in between. Session 2 adds the clav and the horn stabs on a `horns:` track and releases. Everything was taught in U13 and R1 (pushes, ghost notes, the one, interlock, displacement); the minor pentatonic is U11's; Dorian is offered only once U14.L03 has unlocked it. It is the funk the learner came for: tight, dry, repeated, and theirs.",
      opens:
        'When R.CP is passed or soft-passed (contracts §4.3). Today offers RC1.S1 as the New block; a learner who puts it off keeps going (a capstone never gates a lesson). While closed, the capstone card says "Opens after the rhythm checkpoint". `snd.horns` is granted when RC1.S2 STARTS if U15.L05 has not already unlocked it (contracts §3.1 rule 11, the START row): the S2 opening shows the horns ceremony; a learner who already has horns sees none.',
      band: "None: a capstone is the learner's whole piece, so the starter carries its own `kick`, `snare`, `hats` and `bass` lines. The flavour sets the starter's kit and sounds (contracts §5.10 rule 8: funk `fingerbass` and `clav`, jazz-soul `upright` and `rhodes`, pop and indie `ebass` and `piano`) and never changes the rubric (§6.6).",
      sections: [
        {
          title: "The rubric (content/capstones.ts, exact rule bodies)",
          lead: 'Contracts §6.6 RC1, written with the settled rules of the Wave 7 Foundation. Five required rules, all checked on the whole piece in every session; S1\'s checklist greys the stabs line with "next session".',
          items: [
            '`ghosts`: `{ rule: "velocity-ghosts", track: "@drums", min: 4, on: "16th-offbeat", accents: 2 }` (the scaffold lacks `accents: 2`: capstones-rhythm adds it, so a line quiet throughout is not a line with ghost notes).',
            '`syncopated-bass`: `{ rule: "syncopation", track: "@bass", min: 3 }` (at least three bass onsets off the eighth grid, on sixteenths).',
            '`one-bass`: `{ rule: "onsets", track: "@bass", contains: [[0, 1]], perBar: true }`.',
            '`one-kick`: `{ rule: "onsets", track: "@drums", drum: "kick", contains: [[0, 1]], perBar: true }`.',
            '`horns`: `{ rule: "custom", fn: "stabs", params: { track: "horns", min: 2, perBars: 2 } }` (planned; `maxDur` defaults to an eighth, each attack audible).',
            'Not required, shown as suggestions: `tempo-bpm` 90–115 (the brief\'s `bpm` already bounds the piece); `clav` on a `keys` line (`sounds` contains `snd.clav`, `track: "keys"`); a displaced figure (`custom displaced-copy`); and (Oak 2.0 W4) "It ends on purpose" (`custom ends-on-purpose`, any of U09.L06\'s endings, no skills).',
          ],
        },
        {
          title: "Fixed and free",
          items: [
            "Fixed: 4/4; 90–115 BPM; one minor-seventh chord for the whole piece (the vamp; a second chord for a break is allowed and not required); at least four bars; the bass and the kick on the one of every bar; ghosts on sixteenth off-beats with real accents; a `horns:` track of short attacks, at least two in every two bars.",
            "Free: the tonic and the chord (Cm7 in the starter; any minor seventh); minor pentatonic or, once U14.L03 is done, Dorian (the brief says so in one line and the lint enforces it); the kit (`bank`), the sounds of every line, the clav part, what the horns play (one note, a dyad, a chord) and where the stabs fall; an intro, a break, an `arrange()`.",
          ],
        },
      ],
      sessions: [
        {
          id: "RC1.S1",
          goal: "Drums and bass pocket on a one-chord minor-seventh vamp (minor pentatonic; Dorian only once U14.L03 has unlocked it).",
          opens:
            "The brief and its starter (content/capstones.ts): tempo 100, `kick` on the eighth grid, `snare` on 2 and 4, sixteenth hats with a velocity pattern (`[1 .35 .6 .35]*4`), and a bass in note names from C minor pentatonic (`c2 ~ ~ c2 ~ eb2 ~ g2`, marked editable) on `fingerbass` with `.lpf(800)`. The starter fails `syncopated-bass` (its bass sits on the eighth grid) and `horns` (no horns line).",
          hear: "The starter looping; A/B against the last saved draft; each line soloed in turn.",
          see: 'The capstone workspace: the Workbench (code, roll with drum lanes, the groove lens from R1.L03 showing ghost and accent levels), and the RC1 checklist with `ghosts`, `syncopated-bass`, `one-bass` and `one-kick` live and "A horns track with stabs" greyed with "next session". Session bar: "Session 1 of 2: The pocket".',
          work: [
            "The chord and the scale: a minor seventh on any tonic; the bass and any riff on its minor pentatonic (Dorian if U14.L03 is done).",
            "The drums: kick on the one, snare on 2 and 4 with ghost notes around it, sixteenth hats with accents and ghosts (`.velocity()` or `.gain()` patterns, U13.L02, R1.L03).",
            "The bass: on the one of every bar, then at least three notes on sixteenths in between, locking with the kick where it wants to (R1.L04).",
            "Listen for the pocket: everything meets on the one and the sixteenths breathe around it.",
          ],
          checks: [
            "`capstones.check` runs the whole rubric on each save; this session's lines are `ghosts`, `syncopated-bass`, `one-bass` and `one-kick` (the exact bodies above). `horns` is shown and not expected yet.",
            "Nothing blocks saving; the draft is the session's Make (contracts §9.1). The session is done when a draft is saved (`capstones.saveDraft`, then `capstones.completeSession`).",
          ],
          ends: 'Draft saved and bound to RC1.S1; the Coda says "Next time: the clav and the horns" and lists the lines already met. No review, no release.',
          epr: {
            enjoyment:
              "A drum-and-bass pocket the learner tuned by hand: ghosted sixteenths and a bass that dances around the one, already a loop they would play on repeat.",
            pace: "Two parts and four checklist lines, all from R1; the horns and the clav are next session, so this one is only the groove.",
            return:
              "The Coda says the pocket is in and that the horns join next time: the next session opens with a new sound.",
          },
        },
        {
          id: "RC1.S2",
          goal: "Clav and horn stabs on a `horns:` track (the `horns` sound unlocks at the start of this session if U15.L05 has not unlocked it yet); release.",
          opens:
            'The RC1.S1 draft, with a `horns:` line added by the workspace if the learner has none (`horns: note("⟪~⟫").s("horns")`) and, if `snd.horns` was granted at this session\'s start, its ceremony card first.',
          hear: "The piece through; A/B between the draft and the last version; the release recording plays the final version once in full.",
          see: 'The same workspace with every checklist line live and the "Review" and "Release" actions at the end. Session bar: "Session 2 of 2: Stabs and release".',
          work: [
            "The clav: a comping part on a `keys` line in sixteenths, short and syncopated, interlocking with the bass (R1.L04).",
            "The horns: short stabs, at least two in every two bars, an eighth long or shorter (`.clip()` or rests), on the chord or a riff note; where they fall is the learner's.",
            "Optional: a displaced repeat of the horn figure (R1.L05), an `arrange()` with a break, a second chord for a bridge.",
            "Check, read the review, release.",
          ],
          checks: [
            "The whole rubric of contracts §6.6 RC1, the five required rules above, on the whole piece.",
            "Release is allowed once every required line is met and the latest passing check graded the code being released (decision 45); the tutor review (contracts §10.6) is offered before release and never affects pass or fail.",
          ],
          ends: 'Review offered (`review: true`), then release (`release: true`): album track RC1 v1 with a recording, a cover, deterministic liner notes and the learner\'s own line. Milestone ms.24 "You can now write a funk pocket." shows. Revising later makes v2.',
          epr: {
            enjoyment:
              "The funk track complete: the learner's pocket with clav chatter and horn stabs on top, released to the album as a track that sounds like the records.",
            pace: "Two parts on a groove that already works, then the release; the horns are the one new sound and the stabs rule is the one new line.",
            return:
              "The Coda shows the album track and the milestone; RC2, the son groove, is the next capstone, and the advanced tracks' other lessons stay open on Today.",
          },
        },
      ],
      linerNotes: [
        'Deterministic (`linerNotes` of @oak/grader, at release): the chord and the scale read from the code ("Cm7, C minor pentatonic"), tempo, bars and duration; the ghost-note count and where the accents fall; the bass\'s off-grid notes ("7 sixteenth-note bass hits off the eighth grid"); the horns\' stabs per two bars; the instruments, the kit and the flavour; tools used.',
        "The learner's line: one sentence they type at release.",
        "The tutor's listening note only with consent (`includeReviewNote`).",
      ],
      tests: [
        "The starter fails `syncopated-bass` and `horns` and passes the other three (pin it).",
        "Per shipped flavour, one passing piece: funk (Cm7 at 100, `fingerbass`, `clav`, `horns`), jazz-soul (Fm7 at 96, `upright`, `rhodes`, `horns`), pop (Am7 at 108, `ebass`, `piano`, `horns`), indie (Em7 at 92, `ebass`, `piano`, `horns`); and one beyond the brief with an `arrange()` break, a displaced horn figure and Dorian (a test whose learner state has U14.L03).",
        "Fails, each on one rule (the corrections-pass wrong answers that use the right function): the ghosts at `.velocity(0)` (silent, not heard: `ghosts`); every hat at .3 (no accents: `ghosts`); the bass missing the one in bar 3 (`one-bass`); the kick on the and of 4 instead of the one in one bar (`one-kick`); the starter's bass shifted `.late(1/8)` (the right function: evaluated 0, 1/8, 1/2, 3/4, still on the eighth grid, so `syncopated-bass` fails while `one-bass` still passes, the last note wrapping onto the one); the horns held a whole bar (`horns`: not stabs); the horns at `.gain(0)` (`horns`); a horns line with one stab in four bars (`horns`).",
        "Lint: a Dorian `.scale()` before U14.L03 is `code.locked-scale` in a learner state without it; `horns` before RC1.S2 (in S1, without U15.L05) is `code.locked-sound`; `.nudge()` is `code.nudge-studio-only`.",
      ],
      notes: [
        "content/capstones.ts is shared by the four capstone authors: re-read it before each edit and change only RC1 and RC2. RC1's rubric is already written with implemented rules except `stabs` (planned); its two session goals are contracts §2.6 word for word. Still to write: `accents: 2` on `ghosts`, the brief's tests, a starter per flavour, the Dorian line in the brief, and the S2 `horns:` offer.",
        "The starter's notes are C minor pentatonic (U11.L02, `scale.minor-pentatonic`): every learner who reaches RC1 has it. A Dorian piece is graded the same: no rule reads the mode.",
        "Dev seeds (wave7.md): `R.CP passed` (today RC1.S1) and `RC1 released`. The capstone engineer's specs start from them.",
      ],
    },
    {
      id: "RC2",
      author: "capstones-rhythm",
      intent:
        "The second rhythm-track track on the album, and the track's finale: an eight-bar (or longer) son groove of the learner's own on the son clave 3-2. Session 1 lays the clave on the two-bar eighth grid for every bar and a tresillo bass under it; session 2 adds a three-against-two layer and a Euclidean bell, and releases. Everything was taught in R2 and R3; nothing new is introduced.",
      opens:
        'When R.CP is passed or soft-passed (contracts §4.3), beside RC1; the learner may take them in either order. While closed, the card says "Opens after the rhythm checkpoint".',
      band: "None: the starter carries the clave on `perc` and a tresillo bass; the learner writes everything else. The flavour sets the starter's sounds (funk `fingerbass`, jazz-soul `upright` and `rhodes`, pop and indie `ebass` and `piano`) and never changes the rubric.",
      sections: [
        {
          title: "The rubric (content/capstones.ts, exact rule bodies)",
          lead: "Contracts §6.6 RC2, with the coverage and simultaneity fixes the pre-flight found (A5, A6) and the heard Euclid line the content lead added.",
          items: [
            '`clave`: `{ rule: "clave", track: "perc", type: "son", direction: "3-2", minBars: 8 }` (planned, feature `clave.coverage`; `exact` defaults to true: the clave line plays nothing else on its grid).',
            '`bars`: `{ rule: "bars", min: 8 }`.',
            '`tresillo`: `{ rule: "onsets", track: "@bass", contains: [[0, 1], [3, 8], [3, 4]], perBar: true }` (every bar, which contracts allows: "every bar also passes").',
            '`poly`: `{ rule: "polyrhythm", a: "perc2", b: "kick", ratio: [3, 2], minBars: 4 }` (planned, feature `polyrhythm.together`). This spec changes the scaffold\'s `b: "drums"` to `b: "kick"`: a `drums:` line is a whole kit (STYLE §2) and can never be two even attacks while it carries hats, so the brief names a `kick:` line for the two.',
            '`euclid`: keep `{ rule: "uses", tool: "tb.mini.euclid", min: 1 }` (§6.6) AND add the heard `{ rule: "euclid", track: "perc3", k: 5, n: 16, rotationFree: true }` (planned): a five-over-sixteen bell in the rotation the learner chooses (R3.L03\'s Make). The bass `c2(3,8)` alone satisfies `uses`; the heard rule makes the Euclidean bell a line of its own.',
            'Not required, shown as suggestions: `clave-aligned` on a `keys` montuno (R3.L04); a tumbao instead of the tresillo bass in the two-side bars is NOT allowed by `tresillo` (every bar), and the brief says so. Oak 2.0 W4 adds the suggestion "It ends on purpose" (`custom ends-on-purpose`, any of U09.L06\'s endings, no skills).',
          ],
        },
        {
          title: "Fixed and free",
          items: [
            "Fixed: 4/4; 90–130 BPM; the son clave 3-2 on `perc` in every two-bar window from bar 1 for at least eight bars, nothing else on that line; the bass on the tresillo's three places in every bar; three even hits on `perc2` against two on `kick` in the same bars, at least four of them; a five-over-sixteen bell on `perc3`.",
            "Free: the key and the chords (the starter's C and G7 are a suggestion); the bass's notes; the sounds of every line; the rotation of the bell; a montuno, a tune, a break; the form as long as the clave runs through it.",
          ],
        },
      ],
      sessions: [
        {
          id: "RC2.S1",
          goal: "Son clave 3-2 on the 2-bar 8th grid with tresillo bass.",
          opens:
            'The brief and its starter: tempo 110, the clave 3-2 on `perc` (`"<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>"`) and a bass on `note("c2(3,8)")`, two bars. The brief says in one line that the clave must run the whole piece, and shows `arrange()` (U09.L02) as the quick way to eight bars.',
          hear: "The two-bar starter looping; A/B against the last saved draft.",
          see: 'The capstone workspace: the Workbench (code, roll with drum lanes and two-bar clave shading from R3.L02), and the RC2 checklist with `clave`, `bars` and `tresillo` live and the `poly` and `euclid` lines greyed with "next session". Session bar: "Session 1 of 2: Clave and bass".',
          work: [
            "Eight bars or more: the clave runs through every two-bar window from bar 1, in 3-2.",
            "The bass: the tresillo in every bar, on the chords of the learner's choice (I and V7 in the starter).",
            "Optional now: a montuno that faces the clave (R3.L04), a kick, a bell on quarters.",
          ],
          checks: [
            "`capstones.check` runs the whole rubric on each save; this session's lines are `clave`, `bars` and `tresillo` (exact bodies above). `poly` and `euclid` are shown and not expected yet.",
            "Nothing blocks saving; the session is done when a draft is saved.",
          ],
          ends: 'Draft saved and bound to RC2.S1; the Coda says "Next time: three against two, and a Euclidean bell". No review, no release.',
          epr: {
            enjoyment:
              "Eight bars of son on the learner's own clave and tresillo bass, the groove the track has been building towards, already danceable.",
            pace: "Two lines and three checklist lines; the layers wait for session 2.",
            return:
              "The Coda says the clave and the bass hold for eight bars and that the polyrhythm and the bell come next time.",
          },
        },
        {
          id: "RC2.S2",
          goal: "A 3:2 layer and Euclidean percussion; release.",
          opens:
            'The RC2.S1 draft with three empty lines offered if absent: `perc2: s("⟪~⟫")`, `kick: s("⟪~⟫")`, `perc3: s("⟪~⟫")`.',
          hear: "The piece through; A/B; the release recording plays the final version once in full.",
          see: 'The same workspace with every checklist line live; the roll shows `perc2` and `kick` lanes together so three against two is visible; "Review" and "Release" at the end. Session bar: "Session 2 of 2: Layers and release".',
          work: [
            "Three against two: `perc2` three even hits a bar (`cb*3`, R2.L04) against `kick` two (`bd*2` or `bd ~ bd ~`), together in at least four bars.",
            "The Euclidean bell: `perc3` five hits over sixteen steps, rotated where it sits best against the clave (R3.L03).",
            "Balance: every layer audible (a line more than 24 dB under the loudest is not heard, decision 71).",
            "Check, read the review, release.",
          ],
          checks: [
            "The whole rubric of contracts §6.6 RC2, the six required rules above, on the whole piece.",
            "Release as RC1.S2 (decision 45); the tutor review never affects pass or fail.",
          ],
          ends: "Review offered, then release: album track RC2 v1 with a recording, a cover, liner notes and the learner's line. With RC2 released and RC1 released, the rhythm track is complete on the Oak.",
          epr: {
            enjoyment:
              "The learner's son groove with a polyrhythm and a bell turning against the clave: the most layered rhythm they have made, on the album.",
            pace: "Two layers, each one rule, on a groove that already passes three; then the release.",
            return:
              "The Coda names the rhythm track complete (with RC1) and points to what stays open: the other tracks, the gym, Studio.",
          },
        },
      ],
      linerNotes: [
        'Deterministic: clave type and direction read from the code ("son clave, 3-2"), tempo, bars and duration; the bass\'s rhythm ("tresillo in every bar"); the polyrhythm ("three against two, bars 1–8"); the bell\'s Euclid numbers as written ("(5,16,10)"); instruments and flavour; tools used.',
        "The learner's line, and the tutor's note only with consent.",
      ],
      tests: [
        "The starter (two bars) fails `bars`, `clave` (coverage asks for eight bars), `poly` and `euclid`, and passes `tresillo` (pin it).",
        "Per shipped flavour, one passing piece of eight bars (an `arrange()` or a two-bar loop written out to eight), and one beyond the brief: sixteen bars with a montuno, a break in bars 9–10 where `perc2` rests and the clave holds.",
        'Fails, each on one rule (the pre-flight\'s counterexamples and the right-function wrong answers): the clave in bars 1–2 only of eight (`clave`: coverage); the clave 2-3 (`clave`: direction, the same hits in the other order); the rumba 3-2 (`clave`: type); the clave with an extra hit on beat 1 of bar B (`clave`: exact); a bass on the tresillo in bars 1–4 only (`tresillo`); `perc2: s("<cb*3 ~>")` with `kick: s("<~ bd*2>")` (three and two in alternating bars, never together: `poly`); `perc2` at `.gain(0)` (`poly`: not heard); `perc3: s("cb(5,8)")` (the right call on eight steps: `euclid`); no Euclidean bell at all while the bass uses `(3,8)` (`euclid` heard fails, `uses` passes).',
      ],
      notes: [
        "content/capstones.ts is shared: re-read it before each edit and change only RC1 and RC2. RC2's scaffold already has `minBars: 8` and the tresillo `onsets`; still to write: `b: \"kick\"` in `poly`, the heard `euclid` rule, the brief's tests and per-flavour starters.",
        "`clave`, `polyrhythm` and `euclid` are PLANNED rubric rules (content-kit `PLANNED`): RC2's brief fails every attempt until the grader lands them, and `bun run content:check RC2` names them.",
        "Dev seeds (wave7.md): `R.CP passed` (today RC1.S1; RC2 also open) and `RC2 released`.",
      ],
    },
  ],
};
