// R1 Feel & the Pocket: the unit spec (rendered to content/specs/R1.md by `bun scripts/content/spec.ts`).
// The first unit of the rhythm track (contracts §2.6): five lessons, no checkpoint of its own (R.CP covers R1–R3;
// its spec and RC1/RC2 are the R3 spec's). Every hook was evaluated with headless Strudel and is linted in its
// lesson by content/validate/specs.test.ts; every grading claim below was run against the real grader rules
// (packages/grader/src/rubric) unless it names a planned rule. R1.L01 is the exemplar, written and passing every
// content-CI check (content/advanced/R1/L01). The pre-flight decisions this spec rests on are in the Wave 7
// content lead's result (scratchpad w7/foundation-content-lead.md, "Pre-flight settled") and in AUTHORING §20.
import type { UnitSpec } from "./types.ts";

const Em = { tonic: "E", mode: "minor" } as const;
const Am = { tonic: "A", mode: "minor" } as const;
const Cm = { tonic: "C", mode: "minor" } as const;
const Dm = { tonic: "D", mode: "minor" } as const;
const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;

/**
 * What every R1 lesson may use on its earliest legal route: U13.CP passed, U14–U17 possibly unfinished
 * (contracts §4.3, §7.6 rule 5). No mode names or modal scales (U14), no `horns` / `trumpet` (U15.L05), no
 * `.pan()` (U14.L06), no clave or Euclid (R3), no odd meters (R2.L01).
 */
const BASE = [
  "tb.setcpm",
  "tb.label",
  "tb.mini.seq",
  "tb.mini.rest",
  "tb.mini.sub",
  "tb.mini.alt",
  "tb.mini.repeat",
  "tb.mini.replicate",
  "tb.mini.elongate",
  "tb.mini.stack",
  "tb.gain",
  "tb.s",
  "tb.bank",
  "snd.drum.bd",
  "snd.drum.sd",
  "snd.drum.hh",
  "snd.drum.oh",
  "snd.drum.rim",
  "snd.drum.cb",
  "tb.velocity",
  "tb.early",
  "tb.late",
  "tb.struct",
  "tb.clip",
  "tb.n",
  "tb.scale",
  "scale.minor",
  "tb.note",
  "tb.note.names",
  "tb.note.accidentals",
  "tb.s.pitched",
  "tb.chord",
  "tb.voicing",
  "chord.seventh",
  "tb.feature.chord-symbols",
  "snd.fingerbass",
  "snd.rhodes",
  "snd.cleangtr",
] as const;

/** R1.L01's groove: a 16-step bass on 1 and 3, written with `.struct()`, over i7 VI^7 III^7 VII7 in E minor. */
const WEIGHTS = "1 .3 .5 .3 .7 .3 .5 .3 .9 .3 .5 .3 .7 .3 .5 .3";
/** R1.L02's lean: 16th swing at a light amount (3:2) on every line that plays sixteenths. */
const SW16 = ".swingBy(.2, 8)";
/** R1.L03's funk pocket (E minor, one chord): the kick and the bass meet on the one. */
const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FUNK_SNARE =
  'snare: s("~ ~ ~ ~ sd ~ ~ sd ~ sd ~ sd sd ~ ~ sd").velocity("[0 0 0 0 1 0 0 .3 0 .3 0 .3 1 0 0 .3]")';
/** R1.L04's three-part machine in C minor: bass, clav and guitar each in the others' gaps. */
const IL_BASS = 'bass: note("c2 ~ ~ ~ ~ ~ g2 ~ ~ ~ bb2 ~ ~ ~ ~ ~").s("fingerbass").clip(.6)';
const IL_CLAV = 'keys: note("~ ~ eb4 ~ ~ ~ ~ g4 ~ ~ ~ ~ bb4 ~ g4 ~").s("clav").clip(.3)';
const IL_GTR =
  'gtr: note("~ [g4,c5] ~ ~ ~ ~ ~ ~ ~ [g4,c5] ~ ~ ~ ~ ~ [g4,c5]").s("cleangtr").clip(.2).gain(.6)';

/**
 * R1.L06's linear groove (Oak 2.0 W2): one drummer, no two drums at once, grouped 3+3+2 in eighths. Kick 0, 6/16, 12/16
 * (the group starts); snare 3/16, 9/16, 14/16; hats on the ten places left, loud and soft in turn (evaluated: sixteen
 * hits a bar, one at each sixteenth).
 */
const LIN_DRUMS =
  'kick: s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~")\nsnare: s("~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~ ~ ~ sd ~")\nhats: s("~ hh hh ~ hh hh ~ hh hh ~ hh hh ~ hh ~ hh").velocity("[1 .6]*8").gain(.7)';

export const R1: UnitSpec = {
  unit: "R1",
  title: "Feel & the Pocket",
  summary:
    "The first six lessons of the rhythm track (contracts §2.6): the inside of the bar, where funk, soul and neo-soul live. Every place in a 4/4 bar has a weight, and syncopation is a note on a light place in front of an empty heavy one (R1.L01, the exemplar); swing is a ratio, and it can swing the sixteenths as well as the eighths (R1.L02); funk is busy everywhere except the one, with ghost notes around the backbeat (R1.L03); bass, clav and guitar fit into each other's gaps until three parts make one rhythm (R1.L04); one drummer does the same with one kit, no two drums at once, grouped 3+3+2 (R1.L06, Oak 2.0); and a figure moved to another place in the bar leans on new beats, while a few milliseconds behind the beat is a feel, not a rhythm (R1.L05). The track opens after U13.CP (about session 135 at the earliest, 185 for most learners) and may interleave with U14–U17. Every lesson is optional and earns the next: each Make is a groove the learner would loop under their own tracks, and the pocket they build here is RC1's.",
  conventions: [
    "Written for the learner at the gate (contracts §7.6 rule 5, AUTHORING §20.1): an R1 lesson may be taken with U14–U17 unfinished, so it uses only what U13.CP guarantees plus R1's own unlocks (`clav` at R1.L03, the patterned swing amount at R1.L02). No mode names or `.scale(\"E2:dorian\")` (U14; a funk vamp is a minor seventh chord over the natural minor scale, `scale.minor`, or the minor pentatonic), no `horns` (U15.L05; RC1.S2 unlocks it at its start), no `.pan()` (U14.L06), no clave words (R3). A learner at session 185 reads the same lessons: they never call the core's ideas new. What R1 calls back and never reteaches: syncopation and the push with `.early()` / `.late()` (U13.L01), sixteenth grooves, ghost notes and `.velocity()` (U13.L02), the swing call and the word swing (U11.L07), the triplet behind it (U13.L05), the bass locked to the kick (U08.L04).",
    "Feel first (the rhythm track's order): every new rhythm is TAPPED before it is coded and READ (on the roll, in the velocity string or on the staff) after. Each lesson has a `tap` step before its first graded code step (R1.L06 excepted: its plan, docs/superpowers/plans/2026-11-25-oak2-w2.md Task 3, hears the line in a listen and a compare and reads it on the roll before any code). Taps are never graded and never gate; their tests pin a right tapping and three wrong ones.",
    'The sound of the unit: straight sixteenth grooves at 88–104 BPM in a minor key, one or two chords a bar: `fingerbass`, `rhodes`, `cleangtr` and from R1.L03 the `clav` (`keys:` line, STYLE §2), the default kit or a classic drum machine (`.bank("RolandTR909")` or `LinnDrum`). The drums are one drum per line (`kick:` `snare:` `hats:` `perc:`), because the lesson\'s rules read one drum at a time. The pocket is written on a sixteen-step string (`"bd ~ ~ bd …"`), or with `.struct("x ~ ~ x …")` on a pitched line, so the learner edits rhythm without touching notes.',
    'Metric weight, the hierarchy every R1 lesson leans on (R1.L01; the grader\'s measure is Longuet-Higgins and Lee, `syncopation` in packages/grader/src/analyze/meter.ts): beat 1 = 0, beat 3 = −1, beats 2 and 4 = −2, the four “ands” = −3, the eight sixteenths between them = −4. A note at weight w followed (before the next note) by a silent place of heavier weight W pulls by W − w: the last sixteenth of a bar in front of an empty downbeat pulls 4, the sixteenth before an empty beat 3 pulls 3, the “and” of 2 before an empty beat 3 pulls 2, an off-beat note with the beat after it played pulls 0. Evaluated: `n(…).struct("x ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~")` has one syncopation of 3 per bar; straight eighths have none.',
    'Swing (contracts §6.10; AUTHORING §20.4): eighth swing is `.swingBy(a, 4)`, sixteenth swing `.swingBy(a, 8)` in 4/4; the ratio is `swingRatio(a)` = (1 + a)/(1 − a): `.1` → 1.22, `.2` → 3:2, `1/3` → 2:1, `.5` → 3:1 (`SWING_FEELS`). Patterned amounts are decimals in a string (`.swingBy("<0 .1 .2 .33>", 8)`; a fraction in the string is `code.swing-fraction-string`). Evaluated with the real `swing` rule (subdivision 16): `hh*16` with `.swingBy(.2, 8)` measures 1.5:1, with `.swingBy(1/3, 8)` 2:1, with `.swingBy(.2, 4)` or `.swingBy(1/3, 4)` 1:1 (eighth swing leaves sixteenth pairs even: the right function, the wrong slot), with `.swingBy(.1, 8)` 1.22:1, and the patterned `"<0 .1 .2 .33>"` reads 1.36:1 (the median of its bars). Swing is not used in R2\'s compound and odd meters.',
    "Microtiming (R1.L05; AUTHORING §20.4): `.late(x)` moves by x BARS, so it is tempo-dependent. A laid-back feel is 8–45 ms (`FEEL_MS`): at 92 BPM `lateCycles(20, 92)` = 0.0077, written `.late(.008)` (21 ms); `.late(1/32)` is 82 ms at 92 BPM, a displacement you hear as rhythm. Prose gives milliseconds and the code the decimal for the lesson's tempo. `.nudge()` never unlocks (contracts §3.1 rule 8): it is a lint error in graded steps and moves nothing the grader can see.",
    'Grading (AUTHORING §20.2, the corrections-pass standard): every required rule checks what is HEARD. A push is `onsets` with `contains` the pushed place AND `excludes` the heavy place it leaves empty (`perBar`); syncopation in a Make is `syncopation` on the line (it counts a note only when the heavier place after it is silent; the count runs over every rendered bar, about 16 in a Make, so `min: 4` means "the loop pulls somewhere", not four pulls a bar); swing is `swing` with `subdivision` and a ratio window; ghost notes are `velocity-ghosts` with `accents` (a line quiet throughout has none). For every graded step: the reference, at least three other right answers, the unchanged starter (`code.unchanged`), and at least one WRONG answer that uses the right function: `.early(1/16)` on the whole line (beat 1 moves too), `.swingBy(.2, 4)` where sixteenths should swing, ghost notes at `.velocity(0)` (silent) or at `.8` (not ghosts), a copied rhythm where the parts should interlock, `.late(1)` (a whole bar: the figure lands where it was).',
    'Feedback overrides: the `swing` rule\'s own detail names the call (`add .swingBy(1/3, 8)`), so a `rubric.unmet` override on a swing step describes the sound ("the sixteenth pairs are even") and never the call (rung 4 alone may show code). Make overrides that serve every rule stay neutral ("{label}: not yet.").',
    'Words that wait: "the one" is plain English and gets no term (the content lead found it collides with prose in A1 and J1); "interlock" is R1.L04\'s term (until then say "fit into each other\'s gaps"); "displacement" and "laid back" are R1.L05\'s; "clave", "tresillo", "montuno" and "tumbao" are R3\'s; "grouping" and "odd meter" R2.L01\'s; "polyrhythm" R2.L04\'s. New terms: metric weight (L01), swing ratio (L02), interlock (L04), linear drumming (L06), displacement and laid back (L05). L03 introduces none. R1.L06 says "groups of 3, 3 and 2", never "grouping".',
    "Bands: R1's Makes write their own drums, because the pocket is the lesson (AUTHORING §8 rule 8). `band.aeolian-4bar` with `tracks: [\"chords\"]` plays the chords where the learner's lines are drums and bass (R1.L01, R1.L02: i–VI–III–VII in the step's minor key; under the jazz-soul flavour its chords sit on 2 and 4 as quarter notes, so its swing never meets the learner's straight sixteenths). R1.L03–L05 have no Band: their parts (clav, guitar, the displaced figure) are the learner's (`NO_BAND` in content/validate/specs.test.ts). R1.L06's Make is drums only, so `band.aeolian-4bar` plays `[\"bass\", \"chords\"]` under it in E minor (its jazz-soul bass is half notes and its chords quarter notes on 2 and 4, so nothing swung meets the learner's straight sixteenths).",
    "Ear training, stage H (contracts §7.3): `fam.rhy.syncopation` is reviewed in R1.L01 and R1.L05; `fam.rhy.swing` level 4 (sixteenth swing, gated at R1.L02) is played in R1.L02; `fam.rhy.groove-lock` (U08.L04) is reviewed in R1.L03–L04. No R1 lesson seeds a family: the families of the rhythm track open in R2 and R3.",
    'Feedback the grader emits on R1 steps (pin what `bun run content:check <id> --verbose` prints): `rubric.unmet`, `rhythm.missing`, `rhythm.extra`, `rhythm.displaced`, `code.unchanged`, `code.edit-outside`, `code.swing-fraction-string`, `code.time-fraction-string` (`.late("1/8")`), `code.nudge` (lint, graded steps), `id.wrong`, `investigate.wrong`, and the tap codes `tap.missed` / `tap.extra`.',
  ],
  lessons: [
    {
      id: "R1.L01",
      author: "spec-R",
      idea: "Every place in a 4/4 bar has a weight: the downbeat heaviest, then beat 3, then beats 2 and 4, then the “ands”, then the sixteenths between them. A note on a light place with the heavier place after it left empty pulls against the beat: that is syncopation, and how hard it pulls depends on the two places. The last sixteenth of a bar in front of a missing downbeat pulls hardest; an off-beat note with the beat after it played does not pull at all.",
      hook: {
        hear: "A funk-soul groove in E minor at 96 BPM: kick on 1 and 3, snare on 2 and 4, a bass on 1 and 3, Rhodes on 2 and 4, and sixteenth hi-hats at one flat strength. Then the same hi-hats with each hit as strong as its place in the bar: the stream of sixteenths turns into a shape.",
        code: `${T(96)}kick: s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~")\nsnare: s("~ sd ~ sd")\nhats: s("hh*16").velocity("${WEIGHTS}").gain(.6)\nbass: n("<0 5 2 6>").struct("x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~").scale("E2:minor").s("fingerbass")\nchords: chord("<Em7 C^7 G^7 D7>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)`,
      },
      key: Em,
      meter: "4/4",
      bpm: 96,
      canDo: ["cd.hear.metric-weight"],
      uses: [...BASE],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items: the groove with flat hi-hats (`.velocity(.6)`), then with each hit as strong as its place. The captions name the one line that changed.",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1,
          what: "Feel it first: tap the two heaviest places of each bar with the kick, beats 1 and 3, eight taps over four bars. Never graded; tests pin 1 and 3 (pass), 2 and 4, every beat, no taps (fail).",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          what: "Run the hi-hat and kick alone and read the velocity string against the roll: how many strengths in a bar (number: 5); which is stronger, beat 2 or the “and” of 1 (choice: beat 2). The pass text names **metric weight** as what a listener expects of each place, whether or not it is played louder.",
          term: "term.metric-weight",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: "The bass's second note moves one sixteenth earlier and beat 3 is left empty: what will you hear? (`choose`: the bass leans into the middle of the bar / nothing much / the groove slows down)",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The bass plays on 1 and 3 (`.struct("x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~")`). Keep beat 1; put the second note on the sixteenth before beat 3 and leave beat 3 empty. Graded: `onsets` on `bass` with `contains` [0, 7/16] and `excludes` [1/2], `perBar` (a rubric matcher).',
        },
        {
          kind: "ear",
          exercise: "all",
          parts: ["identify"],
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Four fixed pairs over a quiet beat (`hh*4`): the bass plays two bars one way, then two bars another. Which two bars pull harder? Each pair's LHL totals were computed with the grader's `syncopation`: 4 against 2, 0 against 6 (beat 3 played vs left empty), 0 against 4, 6 against 2.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your bass pulls: the Band plays the chords; the learner's drums (flat hi-hats) and a bass on 1 and 3 become a groove that leans.",
        },
      ],
      wrapAt: 5,
      make: {
        brief:
          "The band plays the chords; the drums and the bass are yours. The bass sits square on 1 and 3. Make it pull against the beat: notes on light places, the heavy places after them left empty. Then make it your own: the pull into the downbeat, a second pull, other notes of the chord, a shape for the hi-hats.",
        required: {
          rule: "syncopation",
          label: "The bass pulls against the beat",
          why: "`syncopation` on `bass`, `min: 4` (counted over the rendered bars): the starter on 1 and 3 fails (0), straight eighths fail (0: every off-beat note is followed by a beat that is played), the same rhythm at `.gain(0)` fails (silent), and one push a bar, a pull into the downbeat in every other bar, or three pulls a bar all pass. Evaluated with the real grader (content/advanced/R1/L01, S7).",
        },
        suggestions: [
          'the hi-hat\'s sixteenths have a shape: the “e”s and “a”s whisper (`velocity-ghosts` on `hats`, `on: "16th-offbeat"`, `min: 8`, `accents: 4`)',
          "the bass still lands on beat 1 (`onsets` on `bass`, `contains` [0], `perBar`)",
        ],
        band: "band.aeolian-4bar",
        tracks: ["chords"],
        flavours:
          "The Band's chords in the flavour's sound (i7 VI III VII in E minor); the learner's drums and bass stay in the starter's sounds. Under jazz-soul the Band's chords fall on 2 and 4 as quarters, so its swing never rubs against the learner's straight sixteenths.",
      },
      srs: [{ family: "fam.rhy.syncopation", mode: "review-if-due" }],
      mistakes: [
        "modify: the unchanged starter: `code.unchanged`; `.early(1/16)` on the whole line (the right function, beat 1 moves too): `rubric.unmet`; the push with beat 3 still played (nothing pulls): `rubric.unmet`; an eighth early, on the “and” of 2: `rubric.unmet`; the right places at `.gain(0)`: `rubric.unmet`",
        "ear: the other pair: `id.wrong`, with a per-pair explanation that names the empty place, never a number",
        "Make: the starter; straight eighths; off-beat notes each followed by a played beat (`x ~ ~ x x ~ ~ x …`, the right idea in the wrong place); a silent bass: `rubric.unmet`",
      ],
      connects: {
        back: "U13.L01 pushed chords with `.early()` and named syncopation; U13.L02 gave every hit a strength with `.velocity()`; U13.L06 wrote syncopated rhythms down. R1.L01 names what all three lean on: the weight of each place.",
        forward:
          "R1.L02 changes the length of the pair inside each beat (swing ratios); R1.L03 builds a funk groove that is busy everywhere except the one; R2.L01 takes the weights to bars of five and seven.",
      },
      epr: {
        enjoyment:
          "A minor funk-soul groove with the learner's own bass leaning against the beat over Rhodes chords: a loop that moves and that they would play under a tune of their own.",
        pace: "One idea: the five levels of weight, and a note in front of an empty heavy place pulls. The push itself (U13.L01) is reused, not retaught; accenting the hi-hats is heard and offered as a suggestion, never drilled; swing waits for R1.L02.",
        return:
          "The Coda says: you can now hear which places in a bar are strong, and make a line pull against them by leaving one empty. Next: how long the long note of a swung pair is, by ear and in code.",
      },
      notes: [
        "The exemplar: content/advanced/R1/L01 passes every content-CI check with the real grader (7 steps, 2 graded), with the corrections-pass test set on S5 (the reference, `x@7 x@9`, two half bars, a softer and shorter push; fails: unchanged, `.early(1/16)`, beat 3 still played, the “and” of 2, `.gain(0)`) and on the Make (passes: the push into 3, the pull into the downbeat in every other bar, three pulls a bar at 104 BPM; fails: the starter, `x ~ ~ x x ~ ~ x …`, straight eighths, `.gain(0)`).",
        "The planned rule `metric-weight` (an accented line follows the hierarchy by effective gain) is not used: the exemplar grades the hierarchy where it is heard, in what a syncopation leaves empty, with implemented rules. The grader engineer may leave `metric-weight` for last; R1.L01 does not need it.",
        "Every syncopation number in this lesson was computed with the grader's `syncopation` (weights 0, −1, −2, −3, −4 on the sixteenth grid); the ear pairs' explanations name places, never the numbers.",
      ],
    },
    {
      id: "R1.L02",
      author: "R1a",
      idea: "Swing is a ratio: the long note of each pair against the short one. 1:1 is straight, 3:2 a light swing, 2:1 the triplet swing of the blues, 3:1 a hard swing; `.swingBy(a, n)` sets it with one number. The same call can swing the sixteenths instead of the eighths (`.swingBy(a, 8)` in 4/4): the lazy, leaning sixteenths of neo-soul and hip-hop. A patterned amount changes the swing bar by bar.",
      hook: {
        hear: "A neo-soul groove in A minor at 88 BPM with its sixteenths swung lightly (3:2) on the hi-hat, the kick, the Rhodes and the bass; then the same groove straight, stiff by comparison; then the swing patterned across four bars, from straight to triplet, so the lean grows.",
        code: `${T(88)}kick: s("bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~")${SW16}\nsnare: s("~ sd ~ sd")\nhats: s("hh*16").velocity("[1 .4 .7 .4]*4")${SW16}.gain(.5)\nchords: chord("<Am7 Dm7>").voicing().struct("~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~")${SW16}.s("rhodes").gain(.5)\nbass: n("<0 3>").struct("x ~ ~ ~ ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~").scale("A1:minor")${SW16}.s("fingerbass")`,
      },
      key: Am,
      meter: "4/4",
      bpm: 88,
      canDo: ["cd.code.swing-amount"],
      uses: [...BASE, "tb.swingBy", "tb.swing", "tb.swing.patterned"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: 'Three items: the groove with sixteenths at 3:2, straight, and with `.swingBy("<0 .1 .2 .33>", 8)` across four bars. Captions name the lean, never the numbers.',
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1,
          what: "Feel it first: tap along with eighth-note hi-hats swung 2:1 (`hh*8`, `.swingBy(1/3, 4)`), eight taps a bar for two bars, `tol.forgiveOffset`. Tests: the swung onsets (pass), quarter notes (fail), no taps (fail); the author runs the straight eighths too (each short note 114 ms early at 88 BPM) and pins what the tap grader says.",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "Run `hh*8` with `.swingBy(.2, 4)`, then `1/3`, then `.5`, reading the roll: where the short note of a pair lands at `.2` (choice: 60% of the way through the beat), and the long:short ratio at `1/3` (number: 2). The pass text names the **swing ratio** with the four feels of `SWING_FEELS`.",
          term: "term.swing-ratio",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "How hard does it swing? A mini-set of four grooves answered with `SWING_RATIO_OPTIONS` (straight, light 3:2, triplet 2:1, hard 3:1), the same generator as `fam.rhy.swing` level 2 at 96–120 BPM; the fourth item swings sixteenths (level 4).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The groove swings its eighths (`.swingBy(1/3, 4)` on the hi-hat, which plays sixteenths: the and and the a of each beat move late together, to 2/3 and 11/12 of the beat, and the sixteenth pairs stay even (evaluated)). Make the sixteenths lean, lightly. Graded: `swing` on `hats`, `subdivision: 16`, `ratio: [1.35, 2.4]` (a rubric matcher), with the rhythm of the hi-hat line (`rhythm`, straightened grid). Override `rubric.unmet` ("the sixteenth pairs are still even").',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your lean: the Band plays the chords; the learner's drums and bass swing their sixteenths by an amount of their choice inside the window, optionally patterned bar by bar.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "The band plays the chords; the drums and the bass are yours, straight. Give the sixteenths a lean you like, from a light 3:2 to the triplet's 2:1, on the hi-hat and on every line that plays sixteenths with it. Then make it yours: let the swing grow across the bars, push a kick, slow the tempo.",
        required: {
          rule: "swing",
          label: "The sixteenths lean",
          why: '`swing` on `["hats", "@drums"]`, `subdivision: 16`, `ratio: [1.35, 2.4]`: the straight starter fails; `.swingBy(.2, 4)` and `.swingBy(1/3, 4)` on sixteenth hats fail (the right function, measured 1:1: eighth swing leaves sixteenth pairs even); `.swingBy(.1, 8)` fails (1.22:1, too light to name); `.swingBy(.2, 8)` (1.5), `.swingBy(1/3, 8)` (2), `.swingBy(.15, 8)` (1.35) and the patterned `"<0 .1 .2 .33>"` (median 1.36) pass. Evaluated with the real rule.',
        },
        suggestions: [
          "the bass and the kick swing with the hi-hat (`swing` on `bass`, `subdivision: 16`)",
          'the swing grows across the bars (a patterned amount, `.swingBy("<0 .1 .2 .33>", 8)`; the `uses` rule on `tb.swing.patterned`)',
          "a slow neo-soul tempo, 76–96 (`tempo-bpm`)",
        ],
        band: "band.aeolian-4bar",
        tracks: ["chords"],
        flavours:
          "The Band's chords only. In every flavour they sit on the eighth grid (quarters under pop, 2 and 4 under jazz-soul, eighths under indie, 2 and the “and” of 4 under funk), the places sixteenth swing does not move, so nothing flams.",
      },
      srs: [{ family: "fam.rhy.swing", mode: "review-if-due", level: 4 }],
      mistakes: [
        "ear: the neighbouring feel (light for triplet): `id.wrong`, with the ratio named in the feedback",
        'modify: `.swingBy(.2, 4)` or `.swingBy(1/3, 4)` left in place (the right function on eighths): `rubric.unmet`; `.swingBy("1/5", 8)`: `code.swing-fraction-string`; the hi-hat thinned to eighths (`hh*8`): `rhythm.missing`; the unchanged starter: `code.unchanged`',
        "Make: the straight starter; eighth swing on sixteenths; `.swingBy(.1, 8)`; `.swingBy(.2, 8)` on a line of quarter notes only (nothing to measure): `rubric.unmet`",
      ],
      connects: {
        back: "U11.L07 swung the eighths of a shuffle at 2:1 and heard light and hard swing; U13.L05 showed the triplet behind it; J1.L01 (if taken) swung a ride. R1.L02 turns the amount into a number the learner chooses.",
        forward:
          "R1.L03 keeps the sixteenths straight and makes them funk; AC2 (the neo-soul ballad) swings its sixteenths 1.2–2.4:1 on the hats; R1.L05 moves a whole line by milliseconds, which is not swing.",
      },
      epr: {
        enjoyment:
          "A neo-soul groove whose sixteenths lean by exactly the amount the learner chose, the lazy feel of the records they came for, ready to loop under a melody.",
        pace: "One idea: swing is a ratio you set, and it can swing sixteenths. The swing call is U11.L07's; the patterned amount is heard in S1 and offered in the Make, never required; microtiming waits for R1.L05.",
        return:
          "The Coda says: you can now set how hard a groove swings, from straight to hard swing, on eighths or sixteenths. Next: funk, where every part is busy except on the one.",
      },
      notes: [
        'Evaluated with the real `swing` rule (subdivision 16, window [1.35, 2.4]): `.swingBy(.2, 8)` 1.5 ✓, `.swingBy(1/3, 8)` 2 ✓, `.swingBy("<0 .1 .2 .33>", 8)` 1.36 ✓, `.swingBy(.1, 8)` 1.22 ✗, `.swingBy(.2, 4)` 1 ✗, `.swingBy(1/3, 4)` 1 ✗, `hh*8` with `.swingBy(.2, 8)` not measurable ✗.',
        "`.swingBy(.2, 4)` on eighths puts the short note at 0.6 of the beat (contracts §6.10 item 1: `(1 + a) / 2`).",
        "The Make's starter keeps all four lines straight; a learner who swings only the hi-hat passes (the `swing` rule reads the first track of its list that plays sixteenths), and the suggestion asks for the bass and kick to swing with it so nothing flams.",
      ],
    },
    {
      id: "R1.L03",
      author: "R1a",
      idea: "Funk is busy everywhere except one place: the one. The kick syncopates on the sixteenths and the snare's ghost notes whisper around the backbeat, but on beat 1 of every bar the kick, the bass and the clav land together. That shared downbeat is what lets everything else move.",
      hook: {
        hear: "A funk groove in E minor at 100 BPM on one chord: a syncopated sixteenth kick, a snare with ghost notes around 2 and 4, accented sixteenth hi-hats, a popping bass and clav stabs, all meeting on beat 1. Then the same groove with the bass a sixteenth early on the one: the floor tilts.",
        code: `${T(100)}kick: s("${FUNK_KICK}")\n${FUNK_SNARE}\nhats: s("hh*16").velocity("[1 .5 .8 .5]*4").gain(.5)\nbass: note("e2 ~ ~ e3 ~ ~ e2 ~ ~ ~ g2 ~ a2 ~ b2 d3").s("fingerbass").clip(.5)\nkeys: chord("<Em7>").voicing().struct("x ~ ~ ~ ~ x ~ x ~ ~ ~ ~ ~ x ~ ~").s("clav").clip(.3).gain(.6)`,
      },
      key: Em,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.code.funk-drums"],
      uses: [...BASE, "snd.clav", "scale.minor-pentatonic"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items: the funk groove, then the same groove with the bass line moved a sixteenth early (`.early(1/16)`): it no longer meets the kick on the one. The captions name the one line that changed.",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1,
          what: 'Feel it first: tap only the one, beat 1 of each bar, while the whole groove plays; a soft crash marks it (`perc: s("cr").gain(.4)`, the U01.L02 downbeat marker), and the tap target is that line (`target: { track: "perc" }`, four taps over four bars). Tests: the four downbeats (pass), every beat (fail), the “a” of 4 before each (fail), none (fail).',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          what: "Run the drums alone and read the snare's velocity string and the roll: how many snare hits in a bar (number: 6); which of them are ghost notes (choice: the four at .3, each on an “e” or an “a”). The pass text names the clav (the unlock) and says what makes this funk: sixteenth syncopation in the kick, ghost notes in the snare, everything together on the one.",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "The kick plays four on the floor under the funk snare and bass. Write a funk kick: on the one in every bar, and at least two pushes on sixteenths in front of empty heavier places. Graded: a rubric matcher with `onsets` on `kick` `contains` [0] `perBar` and `syncopation` on `kick` with a `min` of two pulls a bar over the bars the step renders (evaluated over 4 bars: the hook kick counts 12, three a bar; four on the floor with extra sixteenths counts 0, since every extra hit is followed by a played beat).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'The snare plays only 2 and 4. Add ghost notes between them with `.velocity()`. Graded: `velocity-ghosts` on `snare`, `min: 3` per pass, `on: "16th-offbeat"`, `accents: 2` (a rubric matcher), plus the backbeat kept (`onsets` on `snare` `contains` [1/4, 3/4] `perBar`).',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your funk pocket: drums, bass and clav on one minor seventh chord, everything landing on the one, ghost notes around the backbeat.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "One chord, Em7, and a pocket of your own: a kick that syncopates on the sixteenths, a snare with ghost notes around 2 and 4, a bass and a clav that land with the kick on the one. The starter has the backbeat and a bass on the one; make it funk.",
        required: {
          rule: "velocity-ghosts",
          label: "The snare whispers between the backbeats",
          why: '`velocity-ghosts` on `snare`, `min: 4`, `on: "16th-offbeat"`, `accents: 2`: ghost notes are hits you can hear at a low level (effective gain ≤ .4 and above the grader\'s silence floor), and the backbeat stays loud. The starter (backbeat only) fails; ghosts at `.velocity(0)` fail (silent, dropped); ghosts at `.velocity(.8)` fail (not quiet); a snare quiet throughout fails (no accents); the reference and any line with four quiet sixteenth off-beats and two loud backbeats pass. The rule RC1 uses (contracts §6.6).',
        },
        suggestions: [
          "the bass on the one in every bar (`onsets` on `bass`, `contains` [0], `perBar`)",
          "the kick on the one in every bar (`onsets` on `kick`, `contains` [0], `perBar`)",
          "the kick pulls against the beat (`syncopation` on `kick`, `min: 4`)",
          'a clav that stabs (`sounds` with `track: "keys"`, `contains` [`snd.clav`])',
        ],
        band: false,
        flavours:
          'No Band: the drums, the bass and the clav are the pocket, all the learner\'s. The starter is on the default kit; `.bank("RolandTR909")` or `LinnDrum` are offered.',
      },
      srs: [{ family: "fam.rhy.groove-lock", mode: "review-if-due", level: 3 }],
      mistakes: [
        "modify (kick): `.early(1/16)` on a syncopated kick (the right function, the one is lost): `rubric.unmet`; four on the floor with extra sixteenths before the beats (busy, but each extra hit is followed by a played beat: no pull): `rubric.unmet`; a kick on every eighth: `rubric.unmet`; unchanged: `code.unchanged`",
        "modify (ghosts): `.velocity(0)` on the ghost places (silent): `rubric.unmet`; ghosts at `.8` (the right function, not quiet): `rubric.unmet`; the backbeat itself made quiet: `rubric.unmet`; a `~` in the velocity string that removes a backbeat: `rhythm.missing`",
        "Make: the starter; ghosts at `.velocity(0)` or `.8`; a snare quiet throughout: `rubric.unmet`",
      ],
      connects: {
        back: "U13.L02 wrote ghost notes and accents with `.velocity()`; U08.L04 locked the bass to the kick; R1.L01 measured how hard a push pulls.",
        forward:
          "R1.L04 adds a guitar and makes the bass, clav and guitar fit into each other's gaps; RC1 (16th-Note Funk) builds this pocket into a track with horn stabs.",
      },
      epr: {
        enjoyment:
          "A funk pocket on one chord that the learner wrote hit by hit: a syncopated kick, a whispering snare, a popping bass and the clav, all landing together on the one.",
        pace: "One idea: busy sixteenths around a shared downbeat. Ghost notes and `.velocity()` are U13.L02's and are applied, not retaught; the clav is the only new sound; how the parts divide the sixteenths waits for R1.L04.",
        return:
          "The Coda says: you can now write a 16th-note funk beat with ghost notes that lands together on the downbeat, and the clav is yours. Next: three parts that fit into each other's gaps.",
      },
      notes: [
        'The pre-flight ran the kick `"bd ~ ~ ~ bd ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~"` and the snare `"~ ~ ~ sd sd ~ ~ ~ ~ ~ sd ~ sd ~ ~ ~"` with two ghosts at .25 (✓); this spec\'s hook kick `bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~` pulls three times a bar by the grader\'s `syncopation`.',
        'No term: "the one" collided with plain English in A1 and J1 prose (content lead). The pass text of S3 says it in words.',
        "`clav` unlocks on completing this lesson (contracts §3.2) and is used in its own steps, like J1.L01's jazz kit.",
      ],
    },
    {
      id: "R1.L04",
      author: "R1b",
      idea: "In a funk band no part plays the whole rhythm. The bass takes a few sixteenths with the kick, the clav takes others, the guitar a few more: each part leaves gaps the others fill, so together they make one rhythm none of them plays alone. That is interlock.",
      hook: {
        hear: "A C minor groove at 100 BPM: the bass alone (three notes a bar), then the clav alone (four), then the guitar's chops alone (three), then all three together with the drums: a single sixteenth-note machine.",
        code: `${T(100)}kick: s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")\nsnare: s("~ sd ~ sd")\nhats: s("hh*16").velocity("[1 .5 .8 .5]*4").gain(.4)\n${IL_BASS}\n${IL_CLAV}\n${IL_GTR}`,
      },
      key: Cm,
      meter: "4/4",
      bpm: 100,
      canDo: ["cd.code.interlock"],
      uses: [...BASE, "snd.clav"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Four items, two bars each: the bass alone, the clav alone, the guitar alone, all three with the drums.",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1,
          what: 'Feel the gaps first: the bass and the drums play and the clav plays quietly under them (`.gain(.3)`); tap with the clav (`mode: "along"`, `target: { track: "keys" }`, four taps a bar for two bars). Tests: the clav\'s four places (pass), the bass\'s places (fail), every eighth (fail), none (fail).',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          what: "Run the three parts and read the roll: on how many of the sixteen places does at least one of them play (number: 10); where do two or more of them play together (choice: nowhere / only on the one / on every beat; answer: nowhere — in this hook each part owns its places; the bass and the kick share theirs). The pass text names **interlock**.",
          term: "term.interlock",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "The clav copies the bass's rhythm (`struct` on the same three places). Move it into the bass's gaps: at least three clav notes a bar, none where the bass plays (except the one, which they may share). Graded: a rubric matcher with `onsets` on `keys` `excludes` the places of the bass but the one ([3/8, 5/8]) `perBar`, and `syncopation` on `keys` (its notes sit on light places with the heavier places after them empty; the author pins the `min`); the bass line is locked (`edit-only-regions`).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "Add the guitar: short chord chops in the places neither the bass nor the clav plays. Graded: `onsets` on `gtr` `excludes` every place of the bass and the clav except 0, `perBar`, and `syncopation` on `gtr` `min: 4` (it really sits on light places with heavier ones empty); bass and clav locked.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your machine: drums, bass, clav and guitar, each with places of its own.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Build a funk machine in C minor: the drums are given, and you write the bass, the clav and the guitar so that each has places of its own, the bass with the kick. Listen for the gaps: when two parts land together off the one, move one of them.",
        required: {
          rule: "custom",
          label: "Bass, clav and guitar fit into each other's gaps",
          why: "`custom` `interlock` (REQUESTED, not yet in `TRACK_CUSTOM_RULES`; apiNotes of the R1/R2 spec result): on the sixteenth grid of one pass, parts `bass`, `keys` and `gtr` each sound (none more than 24 dB under the loudest), at most `maxShared` (0.25) of the places any of them plays are shared by two or more (beat 1 excluded), each part has at least `minOwn` (2) places of its own per bar, and together they cover at least `minCover` (8) of the 16 places. Fails: the clav copying the bass (`struct` on the same string: everything shared), the guitar at `.gain(0)` (not heard), three parts on the same four beats. Passes: the hook, and any machine whose parts take turns. FALLBACK if the grader does not land `interlock`: the Make locks the drums and the bass (`edit-only-regions`) and requires `onsets` on `keys` `excludes` the bass's places except 0 (implemented), with the guitar a suggestion.",
        },
        suggestions: [
          "the bass locks with the kick (`groove-lock`, `min: 0.75`)",
          "the clav really pulls (`syncopation` on `keys`, `min: 4`)",
          'the guitar on the clean guitar (`sounds`, `track: "gtr"`, `contains` [`snd.cleangtr`])',
        ],
        band: false,
        flavours:
          "No Band: the three interlocking parts are the lesson and are all the learner's; the drums are in the starter.",
      },
      srs: [{ family: "fam.rhy.groove-lock", mode: "review-if-due", level: 3 }],
      mistakes: [
        "modify (clav): the bass's rhythm kept (the right function, `struct`, on the same places): `rubric.unmet`; the clav on every sixteenth (it covers the bass): `rubric.unmet`; the clav silent (`.gain(0)`): `rubric.unmet`; an edit to the locked bass: `code.edit-outside`",
        "modify (guitar): the guitar on the clav's places: `rubric.unmet`; the guitar on the beats (no pull): `rubric.unmet`; unchanged: `code.unchanged`",
        "Make: every part on the same beats; the clav copying the bass; a silent guitar: `rubric.unmet`",
      ],
      connects: {
        back: "U08.L04 locked the bass to the kick (parts that play together); R1.L03 built the pocket on the one. R1.L04 is the other half: parts that play apart.",
        forward:
          "R1.L05 moves a figure to another place in the bar; R3.L04 (montuno and tumbao) interlocks piano and bass with the clave; RC1.S2 adds horn stabs to the gaps.",
      },
      epr: {
        enjoyment:
          "A four-piece funk machine the learner assembled part by part, where bass, clav and guitar click together into one rhythm, the sound of a real band locking in.",
        pace: "One idea: parts that fill each other's gaps. The pocket and the one are R1.L03's; the parts are given chord tones, so no harmony is new; the guitar's chord voicing is supplied.",
        return:
          "The Coda says: you can now make bass, clav and guitar interlock into one groove. Next: move a whole figure to another place in the bar, and feel the difference between a rhythm moved and a groove that leans back.",
      },
      notes: [
        'The hook\'s three parts own their places (evaluated): bass 0, 6/16, 10/16 (with the kick); clav 2/16, 7/16, 12/16, 14/16; guitar 1/16, 9/16, 15/16. Together they sound on 10 of the 16 places and never two at once. The pre-flight ran `bass: note("c2 ~ ~ g2 ~ ~ bb2 ~")` with `keys: note("~ eb4 g4 ~ bb4 ~ ~ g4")` on clav (✓, the term example).',
        "The Make's required rule `interlock` does not exist yet in content-kit or the grader: the R1/R2 spec writer has requested it (apiNotes). Until it is planned the lesson fails check 2 on the Make, and the author uses the stated fallback.",
      ],
    },
    {
      id: "R1.L06",
      author: "spec-R",
      idea: "In a linear groove no two drums ever hit at the same time: the kick, the snare and the hi-hat take turns, so the beat is one line handed from drum to drum and no drum keeps time on its own. A drummer builds one from the top (a cymbal figure first, the kick and snare in its holes) or from the bottom (kick and snare first, hats in what is left). Split 3+3+2 in eighths, a change of drum or an accent on 1, the and of 2 and 4 gives the line its shape.",
      hook: {
        hear: "Two grooves over the same bass and the same kick at 96 BPM in E minor: an ordinary one, the hi-hat ticking every eighth on top of the kick and the snare, then a linear one, sixteen hits a bar and never two at once, the kick on 1, the and of 2 and 4.",
        code: `${T(96)}${LIN_DRUMS}\nbass: note("e2 ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~ g2 ~ ~ ~").s("fingerbass").clip(.6)`,
      },
      key: Em,
      meter: "4/4",
      bpm: 96,
      canDo: ["cd.code.linear-drums"],
      uses: [...BASE, "snd.drum.rd", "snd.drum.lt", "snd.drum.mt", "snd.drum.ht"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items over the same bass and kick: the ordinary groove (hats on every eighth, snare on 2 and 4), then the linear one. Focus: any moment where two drums hit at once.",
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 0.75,
          what: "Two linear grooves as audio cards: one built from the bottom (a busy kick and snare, soft hats in every place left), one from the top (a ride figure with holes, two kicks and two snares in them). Pick the one built from the cymbal (`top`).",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: "The linear groove's drums on the roll: on which eighths the groups of 3, 3 and 2 start (choice: the 1st, 4th and 7th; the kick marks each), and how many hits one bar holds (number: 16).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "Rewrite hats into the kick and snare gaps. `linear-drums { minHitsPerBar: 6 }` checks no simultaneous starts and no drum playing every eighth of the bar (every sixteenth included, and extra hits). Oak's call: six hits per bar on average; the label describes a shared line without a quota.",
          term: "term.linear-drumming",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "Mark the starts of 3+3+2 with a change of drum or the loudest hit. `linear-drums { group: [3, 3, 2] }` keeps its group check (Oak's call: three bars in four) and uses the new every-eighth timekeeper check.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your one-line groove: an ordinary beat rebuilt for one drummer, from the top or the bottom, over the Band's bass and chords; in the song it opens the record (the intro).",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Turn this ordinary beat into a groove for one drummer: one drum at a time, handed from drum to drum all through the bar, with no drum keeping time on every eighth or sixteenth. Also on the checklist: groups of 3, 3 and 2 eighths.",
        required: {
          rule: "custom",
          label:
            "No two drums start together, beat 1 included; the line is handed from drum to drum all through the bar; and no drum plays every eighth or every sixteenth, keeping time on its own",
          why: "`linear-drums { minHitsPerBar: 6 }` reads all drums together. Oak's call: six hits per bar on average. The book's simple kick on 1 and 3, snare on 2 and 4, and offbeat hats passes; hats covering every eighth fail even with extra sixteenths. Simultaneous starts still fail.",
        },
        suggestions: [
          'a kick or a snare on the 1st, 4th and 7th eighths (`grouping-accents`, `groups: ["3", "3", "2"]`, `track: "@drums"`, `minRatio: 1`, `allowOthers: true`); other accented eighths are allowed',
        ],
        band: "band.aeolian-4bar",
        tracks: ["bass", "chords"],
        flavours:
          "The Band's bass and chords in the flavour's sounds (i–VI–III–VII in E minor); the learner's drums stay in the default kit.",
      },
      srs: [],
      mistakes: [
        "modify (hats): one hat left with the kick on 1; the hats deleted (five hits); every eighth a sixteenth later (the last lands on the snare); the right places at `.gain(0)`: `rubric.unmet`; unchanged: `code.unchanged`",
        "modify (3+3+2): split 2+3+3; accents by `.velocity()` held under the kick by `.gain(.6)` (the right function, not the loudest); a kick added over a hat on the and of 2: `rubric.unmet`; unchanged: `code.unchanged`",
        "Make: the starter; the hats still on every eighth; a kick and a hat on 1; silent hats: `rubric.unmet`",
      ],
      connects: {
        back: "R1.L04 made three pitched parts fill each other's gaps; R1.L01 weighed every place in the bar; U01.L06 gave the toms. R1.L06 does with one kit what R1.L04 did with a band.",
        forward:
          "R1.L05 moves a whole figure to another place in the bar; R2.L01 takes 3+3+2-like groups into odd meters (and names grouping); RC1 can open with a linear fill.",
      },
      epr: {
        enjoyment:
          "A drum part with no two hits stacked that still drives: a busy, crisp line the learner hears open their song, under the band's bass and chords.",
        pace: "One idea: one drum at a time. The 3+3+2 split is a shape for that line, not a new meter (R2's grouping waits); top-down and bottom-up are heard, not drilled.",
        return:
          "The Coda says: you can now write a beat where no two drums hit together. Next: move a whole figure to another place in the bar.",
      },
      notes: [
        "Oak 2.0 W2 (docs/superpowers/plans/2026-11-25-oak2-w2.md Task 3; lesson content/advanced/R1/L06, fidelity pins content/validate/pins/R1.L06.ts). Passes every content-CI section with the real grader (6 steps, 2 graded, 7.5 expert minutes).",
        "Every rhythm here was evaluated against the real `linear-drums`: the hook's groove is linear and meets `group: [3, 3, 2]`; the S4 starter's kick (0, 10/16) and snare (4/16, 12/16, 15/16) are uneven, so only the hats decide; the reference hats are the four eighths left (2/16, 6/16, 8/16, 14/16).",
        'Song: a take of the intro (kick, snare, hats; `startFrom: "oak"`).',
      ],
    },
    {
      id: "R1.L05",
      author: "R1b",
      idea: "Displacement moves a whole figure to another place in the bar: the same three hits, an eighth later, lean on different beats and sound like a new rhythm. It is not the laid-back feel: a few milliseconds behind the beat (`.late(.008)` at 92 BPM is 21 ms) leaves the rhythm where it was and only changes how it sits.",
      hook: {
        hear: "A D minor groove at 92 BPM with a three-hit clav figure: in bars 1 and 3 it starts on the one, in bars 2 and 4 the same figure starts an eighth later and the bar seems to turn round. Then, for comparison, the snare 21 ms behind the beat: nothing moves, but the groove sits back.",
        code: `${T(92)}kick: s("bd ~ ~ ~ bd ~ ~ ~")\nsnare: s("~ sd ~ sd")\nhats: s("hh*8").gain(.4)\nbass: n("<0 0 3 3>").struct("x ~ ~ x ~ ~ x ~").scale("D2:minor").s("fingerbass")\nkeys: chord("<Dm7 Dm7 Gm7 Gm7>").voicing().struct("x ~ x x ~ ~ ~ ~").late("<0 .125>").s("clav").clip(.3)`,
      },
      key: Dm,
      meter: "4/4",
      bpm: 92,
      canDo: ["cd.code.displacement"],
      uses: [...BASE, "snd.clav"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two items: the clav figure on the one in every bar, then displaced an eighth in every other bar (the hook).",
        },
        {
          kind: "tap",
          exercise: "tap",
          answer: ["tap"],
          minutes: 1,
          what: 'Feel it first: tap the clav figure along with the hook for four bars (`target: { track: "keys" }`, 12 taps). Tests: the figure in both places (pass), the figure on the one every bar (fail: bars 2 and 4 missed), quarter notes (fail), none (fail).',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          what: 'Read the roll: where the figure\'s first hit lands in bar 2 (choice: the "and" of 1); how many of its three hits now fall on a beat (number: 1, the "and" of 2 moved to beat 3). The pass text names **displacement**.',
          term: "term.displacement",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'A cowbell plays a two-bar figure, the same in both bars (`perc: s("cb ~ cb cb ~ ~ ~ ~")`). Displace it in bar 2 by a quarter note. Graded: `onsets` on `perc` (`perBar: false`, two bars) `contains` [0, 1/4, 3/8, 5/4, 3/2, 13/8] `excludes` [1, 11/8]. Passes `.late("<0 .25>")`, the bar written out with `< >`, `.early("<0 .75>")` (the same move from the other side), `.late("<0 .25>")` on a softer line; fails `.late(1)` (the right function, a whole bar: nothing moves), `.late(.25)` on both bars, `.late("<0 1/4>")` (`code.time-fraction-string`).',
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1,
          what: "Ahead, on or behind? Three short items with `MICROTIMING_OPTIONS`: the snare `.late(.008)` (21 ms, behind), `.early(.008)` (ahead), on the grid. The pass text names **laid back** and says it is milliseconds, not a rhythm: `.late(1/32)` at this tempo is 82 ms, which you hear as a displacement. Never graded (a compare step; `fam.rhy.syncopation` review handles R15 evidence).",
          term: "term.laid-back",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your figure, moved: a short figure of your own on one line that comes back displaced (by an eighth, a quarter or a dotted eighth) somewhere in the loop, over the drums and bass.",
        },
      ],
      wrapAt: 3,
      make: {
        brief:
          "Write a short figure of your own, two to four hits, on the clav or a percussion line, and make it come back moved to another place in the bar: an eighth, a quarter or a dotted eighth later. Let the drums and the bass keep the bar steady so the move is heard. If you like, let the snare lean back by a few milliseconds.",
        required: {
          rule: "custom",
          label: "Your figure comes back displaced",
          why: '`custom` `displaced-copy` (planned, `TRACK_CUSTOM_RULES`) with `min: 1`: a figure on one learner line returns with every onset shifted by the same amount (at least a sixteenth, not a whole bar), same drums or pitches, same rhythm. Fails: the starter (no copy), `.late(1)` (the right function, a whole bar: it lands where it was), `.late(.008)` (a feel, under a sixteenth), a figure that repeats every beat (`cb*4` moved by a quarter is the same rhythm). Passes: `.late("<0 .125>")`, `.late("<0 .25>")`, `<[...] [...]>` with the moved bar written out, `.early("<0 .125>")`. Until the grader implements `displaced-copy`, the lesson fails check 2 and says so.',
        },
        suggestions: [
          'the snare lies back by a feel, 8–45 ms (`custom` `microtiming` on `snare`, `direction: "late"`; planned; AC2 requires it)',
          'the figure on a pitched line (`sounds` `track: "keys"` `contains` [`snd.clav`])',
        ],
        band: false,
        flavours:
          "No Band: the figure is the lesson and the drums that keep the bar steady are in the starter.",
      },
      srs: [{ family: "fam.rhy.syncopation", mode: "review-if-due" }],
      mistakes: [
        'modify: `.late(1)` (the right function, the figure lands where it was): `rubric.unmet`; `.late(.25)` without `< >` (both bars move: no copy in place): `rubric.unmet`; `.late("<0 1/4>")`: `code.time-fraction-string`; `.nudge(.25)`: `code.nudge` (lint); unchanged: `code.unchanged`',
        "compare: never graded; the feedback of a wrong pick names the milliseconds",
        "Make: the starter; `.late(1)`; `.late(.008)` alone (a feel, not a move); a figure of four even beats moved by a beat: `rubric.unmet`",
      ],
      connects: {
        back: "U13.L01 moved whole lines with `.early()` and `.late()` to push them; R1.L01 measured where a hit leans; R1.L04 made parts take turns.",
        forward:
          "R2 regroups the pulses themselves (odd meters, hemiola, polyrhythm); AC2.S2 (the neo-soul ballad) applies the laid-back snare by milliseconds, tempo-aware.",
      },
      epr: {
        enjoyment:
          "A groove where the learner's own figure turns the bar round every other bar, the trick that makes funk and hip-hop parts sound smarter than they are.",
        pace: "One idea: a figure moved to another place in the bar. The laid-back feel is heard in one comparison step and offered as a suggestion; it is required only in AC2.S2. `.late()` is U13.L01's call, used with a patterned amount.",
        return:
          "The Coda says: you can now move a figure to another place in the bar, and tell a moved rhythm from a groove that leans back. Next: bars of five and seven.",
      },
      notes: [
        'Evaluated: `perc: s("cb ~ cb cb ~ ~ ~ ~").late("<0 .125>")` plays 0, 1/4, 3/8 in bar 1 and 9/8, 11/8, 3/2 in bar 2 (the term example, corrected in this spec: the old example alternated two different figures). The hook\'s clav plays 0, 1/4, 3/8 then 1/8, 3/8, 1/2.',
        "Tempo-aware amounts (content-kit `lateMs`, `lateCycles`): at 92 BPM `.late(.008)` = 20.9 ms (a feel), `.late(1/32)` = 81.5 ms (a displacement), `.late(.125)` = 326 ms (an eighth).",
        "The required rule `displaced-copy` and the suggestion `microtiming` are planned (`TRACK_CUSTOM_RULES`): the Build lands them before this lesson can pass.",
      ],
    },
  ],
  capstones: [],
};
