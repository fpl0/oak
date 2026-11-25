// A2 Arrangement & Mix: the spec (rendered to content/specs/A2.md by `bun scripts/content/spec.ts`). The second unit
// of the Arrangement & Sound track (contracts §2.6): six lessons after U10.CP, the track checkpoint A.CP over A1–A2,
// and the track's two capstones, AC1 "One Tune, Two Genres" and AC2 "Neo-Soul Ballad". Written in the Wave 7
// Foundation by spec-A from the content lead's settled pre-flight (scratchpad w7/foundation-content-lead.md):
// A2.L03 requires the counter-melody and leaves re-voicing per section to a stretch and A2.L06; A2.L06 uses only
// the tools of its earliest route (no swing: a ballad against a driving version); AC2's top-voice rule reads
// hand-voiced chords. Every hook was evaluated with headless Strudel and is linted at its lesson by
// content/validate/specs.test.ts; A2.L01 is the exemplar, written and passing with the real grader
// (content/advanced/A2/L01).
import type { UnitSpec } from "./types.ts";

const Am = { tonic: "A", mode: "minor" } as const;
const BPM = 90;
const T = (bpm = BPM) => `setcpm(${bpm}/4)\n\n`;

/**
 * What every A2 lesson may use on its earliest legal route: U10.CP passed, A1.L01–L07 done (the track's order),
 * U11 possibly not begun (contracts §4.3, §7.6 rule 5). No dominant sevenths, blues scale, `crunch` or swing
 * (U11), no sevenths by name (U12), no `.late()` / `.early()` (U13.L01), no `.velocity()` (U13.L02), no `.pan()`
 * before A2.L05 (its own site) unless U14.L06 granted it.
 */
const BASE = [
  "tb.setcpm",
  "tb.label",
  "tb.const",
  "tb.mini.seq",
  "tb.mini.rest",
  "tb.mini.sub",
  "tb.mini.alt",
  "tb.mini.repeat",
  "tb.mini.stack",
  "tb.gain",
  "tb.s",
  "tb.s.pitched",
  "tb.n",
  "tb.scale",
  "scale.minor",
  "tb.note",
  "tb.note.names",
  "snd.drum.bd",
  "snd.drum.sd",
  "snd.drum.hh",
  "snd.wave.sawtooth",
  "snd.wave.square",
  "snd.wave.triangle",
  "snd.piano",
  "snd.strings",
  "tb.lpf",
  "tb.room",
] as const;
/** What A2.L01 unlocks (the spectrum panel); every later A2 lesson has it. */
const L01 = ["tb.fscope"] as const;

/** The A2 loop: A minor, i–VI–III–VII (Am F C G), the bass, the chords and the tune in the learner's code. */
const BASS = 'bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)';
/** Am F C G as close triads that move the shortest way: A C E, F A C, C E G, G B D (C3 to E4). */
const CHORDS = "<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>";
const chords = (tail = "") => `chords: n("${CHORDS}").scale("A3:minor").s("piano").gain(.5)${tail}`;
/** E C A | C A | E C E | B G (every note on a beat is in its chord). */
const TUNE = "<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>";
const tune = (tail = "") => `mel: n("${TUNE}").scale("A4:minor").s("square").lpf(2000).gain(.5)${tail}`;
/** A counter-line under the tune: it moves when the tune holds, or the other way, on chord tones. */
const VOX = "<[~ ~ 0 2] [~ 0 2 ~] [2 ~ ~ 4] [~ 1 ~ -1]>";

export const A2: UnitSpec = {
  unit: "A2",
  // A2.L07 (X9) and A2.L09 (X11) are in the syllabus but not yet on this branch; their rows join when they merge.
  covers: ["A2.L01", "A2.L02", "A2.L08", "A2.L03", "A2.L04", "A2.L05", "A2.L06"],
  title: "Arrangement & Mix",
  summary:
    "The second unit of the Arrangement & Sound track (contracts §2.6): six lessons that open after U10.CP and follow A1.L07 in the track's order, then the track checkpoint A.CP over A1–A2 and the two capstones. A1 shaped one sound at a time; A2 shapes how the parts sound together. Each part has a job and a height (A2.L01, the exemplar: registers, why low close chords turn to mud, Oak's spectrum panel); a section can be thin or thick (A2.L02); a second line can answer the tune (A2.L03); a recorded drum break can be cut up and played in a new order (A2.L04); every part gets its level and its room (A2.L05); and one tune can wear two styles (A2.L06). Every lesson works on the A2 loop, a minor loop in the learner's own code over the Band's drums, and every Make ends with that loop (or the learner's own) sounding more like a finished record. A.CP checks it all; AC1 arranges a public-domain tune twice in two genres and AC2 is a neo-soul ballad, the last capstones of the course.",
  conventions: [
    "Written for the learner at the gate (contracts §7.6 rule 5, AUTHORING §20.1): A2 opens after U10.CP and the track's order puts A1.L07 before it, so the earliest learner here has minor keys and `strings` (U10), everything of A1 (filters, envelopes, space, grit, movement, FM and the supersaw), chords by name with `.voicing()`, stacks, `.add()`, `arrange()` and section consts, and nothing of U11 onward: no dominant sevenths, blues scale, `crunch` or swing (U11), no sevenths by name (U12), no `.late()`/`.early()` (U13.L01), no `.velocity()` (U13.L02), no `.pan()` before A2.L05 (its own site; U14.L06 is the other). A learner at session 185 reads the same lessons, so none calls a core idea new.",
    'The A2 loop: A minor at 90 BPM, i–VI–III–VII (Am F C G) over `band.aeolian-4bar` with `tracks: ["drums"]` (its drums in the flavour\'s kit; the harmony is the learner\'s). `bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)`; `chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("piano")` (A C E | F A C | C E G | G B D, close triads moving the shortest way, C3 to E4); `mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("A4:minor").s("square").lpf(2000)` (E C A | C A | E C E | B G: every note on a beat is in its chord, evaluated). The chords are degree stacks so their height is the learner\'s: a `voicing()` line is never graded by octave, top note or note count (contracts §6.7 item 1). A2.L04 plays at 96 BPM (the break\'s own tempo, `BRK_BPM`), A2.L06 writes its own drums.',
    "Grading (AUTHORING §20.2, the corrections-pass standard): every required rule reads what is heard. A part more than 24 dB under the loudest learner part is left out by the grader (`audibleInMix`, decision 71), so a part turned down to nothing never carries a rule. Implemented and used here: `range` (A2.L01), `contrast` on the `density` axis (A2.L02: events per bar, every chord note counted, ±25%), `events` and `controls` matchers. Planned (TRACK_CUSTOM_RULES; the lesson fails check 2 until the grader builds them, and its spec line says so): `counter-melody` (A2.L03), `slices-reordered` (A2.L04), `level-balance` (A2.L05), `same-tune-two-ways` (A2.L06), and the rubric rules `register-separation` and `no-muddy-low` (the grader's Wave 1 versions use other limits than `@oak/theory` `LOW_INTERVAL_LIMITS`: rebuild them on the theory table). Each graded step names its WRONG ANSWER THAT USES THE RIGHT FUNCTION and three other right answers.",
    'Grader requests for A2 (apiNotes): `SOUND_CONTROL_KEYS` gains `begin`, `end`, `speed` (A2.L04, `slices-reordered` reads `begin`/`end` from `.slice()` events: evaluated, `s("brk").slice(4, "0 2 1 3")` gives begin 0, .5, .25, .75), `postgain`, `pan`, `compressor` (and its `compressorRatio`, `compressorKnee`, `compressorAttack`, `compressorRelease`), `duckorbit`, `duckdepth` (A2.L05). `level-balance` reads effective gain (`gain × velocity × postgain`) and is honest about it: compression and room change loudness too, so its brief asks for levels by `.gain()`/`.postgain()` and compression is heard, never graded.',
    'Terms (eleven, all in content/terms.ts): "spectrum" and "register" (A2.L01), "texture" and "density" (A2.L02, a pair), "counter-melody" (A2.L03), "sample" and "chop" (A2.L04), "mix" and "compression" (A2.L05), "idiom" (A2.L06). These are common words: no A2 lesson uses one before the lesson that introduces it (course.test.ts scans every legal order; "how full", "how many parts", "a recording", "the balance" stay plain). Words that wait: "voicing" as a jazz idea (J3), "groove" is plain English, "genre" is plain English (A2.L06 names the idiom).',
    "Ear training: `fam.snd.roles` (contracts §7.3; level 1 which instrument plays the bass, the pad, the lead; level 2 which part muddies the bass) is seeded by A2.L01 and reviewed in A2.L02–L06; its generator's option labels vary per trial, so in-lesson ear steps are fixed `identify` items with tests, and the family runs in the warm-up. `fam.snd.params` keeps being reviewed. The planned deck `deck.snd.controls` deals its mix cards from A2.L05 once the drills engine writes it.",
    "Scaffolds: roll on, staff off (sound and arrangement lessons), the spectrum panel (`initialPanels: [\"spectrum\"]`, A2.L01 on) where a step is about where parts sit. No singing step: singing never gates (contracts §7.6, §8) and nothing in A2 is learned by singing. Flavours change the Band's drums only; the learner's sounds are the lesson.",
  ],
  lessons: [
    {
      id: "A2.L01",
      author: "spec-A",
      idea: "Every part has a job and a height: the bass low, the chords in the middle, the tune above them. Two notes a third apart are clear in the middle of the keyboard and blur into one rumble low down, so chords voiced in the bass's octave turn the low end to mud. Oak's spectrum panel (`.fscope()`) draws where each part sits, low on the left, high on the right.",
      hook: {
        hear: "The A2 loop twice within 20 seconds: first the chords and the tune an octave too low, the chords sitting on the bass (a blur); then the same notes with each part at its own height (clear), the spectrum panel drawing both.",
        code: `${T()}${BASS}\n${chords()}\n${tune(".fscope()")}`,
      },
      key: Am,
      meter: "4/4",
      bpm: BPM,
      canDo: ["cd.code.registers"],
      uses: [...BASE, ...L01, "snd.ebass"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Crowded and clear: the A2 loop with the chords and the tune an octave low, then with each part at its own height.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`note("<[a1,c2,e2] [a2,c3,e3] [a3,c4,e4]>").s("piano")`, one A minor chord at three heights: which bar will sound the least clear? (`choose`: bar 1, the lowest)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          panels: ["spectrum"],
          what: "The bass alone, the chords alone, the tune alone, a bar each, with `.fscope()`: whose peaks start furthest left (choice: the bass); a1 repeats 55 times a second, so how many times a second does a3, two octaves up? (number: 220)",
          term: "term.spectrum",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice", "number"],
          minutes: 1,
          panels: ["spectrum"],
          what: '`note("<[a1,c2] [a2,c3] [a3,c4]>").s("piano").fscope()`: in which bar do the two notes blur into one rough sound (choice: bar 1); how many half steps apart are they in every bar (number: 3). The pass text: low close chords tend to blur, a tendency that depends on the sound, not a law.',
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Lift the tune: the chords sit at A3 and the tune plays at their height (`.scale("⟪A3⟫:minor")`); move it up one octave. Graded: `events` on `mel` at absolute pitch. Right answers: `"A4:minor"`, every degree raised by seven at A3, the same notes by name, another sound. Wrong with the right function: two octaves up and one down (`melody.octave`), the chords lifted instead of the tune (`melody.octave`: the tune is where it was), the tune lifted and turned down to `.gain(.02)` (`melody.missing-note`: masked).',
          term: "term.register",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Who crowds the bass: the A2 loop with one part dropped onto the bass's octave (the tune, at A1). The chords, the tune, or neither? A fixed item with tests; seeds `fam.snd.roles`.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Give each part its place: the A2 loop with the chords and the tune an octave too low; give each part its own register.",
        },
      ],
      wrapAt: 5,
      make: {
        brief:
          "The loop with the chords and the tune an octave too low: the chords sit on the bass and the low end blurs. Give each part its own height: the bass low, the chords from C3 up, the tune above them. Add `.fscope()` to a line to watch it.",
        required: {
          rule: "range",
          label: "The chords out of the bass's octave: no chord note below C3",
          why: '`range` on `chords` `within: ["c3", "c6"]` (implemented): the lowest chord note that sounds is C3 or higher, read from the notes heard (a part masked more than 24 dB down sounds no notes and fails). The starter (chords from C2) fails; the chords an octave down, and the bass dropped an octave with the chords left on it (the right function on the wrong line), fail; the chords lifted and turned down to `.gain(.02)` fail. Passes: the chords up an octave, every part at its own height, the chords written by hand from C3, an electric bass and the tune on a triangle with the spectrum open. `no-muddy-low` (planned) is the general form of the idea; it replaces `range` here only if it lands with the theory table\'s limits and its own counterexamples.',
        },
        suggestions: [
          'the tune above the chords (`range` on `mel`, `within: ["c4", "c7"]`)',
          'the bass below C3 (`range` on `bass`, `within: ["c1", "b2"]`)',
        ],
        band: "band.aeolian-4bar",
        tracks: ["drums"],
        flavours:
          "The Band's drums in the flavour's kit; the learner's sounds stay as written (the registers are the lesson).",
      },
      srs: [{ family: "fam.snd.roles", mode: "seed" }],
      mistakes: [
        "S3: the tune for the lowest, or 110 for a3 (one octave counted): `investigate.wrong`, overridden to name where the peaks start and that each octave doubles",
        'S5: two octaves up or one down: `melody.octave`, overridden ("the right note, {dir} than the target. The tune moves up by one octave, the whole line at once.")',
        "S5: the chords lifted, the tune left: `melody.octave` (the tune is still where it was)",
        "S5: lifted, then turned down to `.gain(.02)`: `melody.missing-note` (masked, decision 71)",
        "S5 unchanged: `code.unchanged`",
        "S6: the chords, or neither: `id.wrong`, overridden to name one note at a time moving against the bass",
        "Make: the starter, the chords down an octave, the bass dropped instead, the chords lifted and masked: `rubric.unmet`",
      ],
      connects: {
        back: "A1.L01 counted how many times a second a note repeats and found the harmonics above it; A1.L02 filtered the bass so the riff sat above it. U05 voiced chords; U08.L01 put the bass on the roots, low.",
        forward:
          "A2.L02 decides how many parts play and how often; A2.L05 gives each part its level, its side and its room. J3 (jazz track) voices chords for the left hand with the same care for the low end.",
      },
      epr: {
        enjoyment:
          "The learner's own loop goes from a blurred low end to a bass, chords and a tune that each sit in their own place, and they can watch the spectrum clear as they hear it clear.",
        pace: "One idea: each part its own register, and low close chords blur. Panning, levels and the rest of the mix wait for A2.L05; the spectrum panel is a view, used here only to see what is heard; voicing rules for jazz wait for J3.",
        return:
          "The Coda says: you can give each part its own register so the low end stays clear. Next: how many parts play, and how full each bar is.",
      },
      notes: [
        'Today offer (track lesson, wave7.md §5): "Clear up the low end: give your bass, chords and tune each a place of their own."',
        "The exemplar: content/advanced/A2/L01 passes every content-CI check with the real grader (7 steps, 2 graded, the Make on the implemented `range`), with the corrections-pass test set on S5 and the Make: the reference, three other right answers, the unchanged starter, wrong answers that use the right function (two octaves, the wrong line lifted, a masked part).",
        "Evaluated: the crowded loop's chords are A2 C3 E3 | F2 A2 C3 | C2 E2 G2 | G2 B2 D3 and the bass A1 F1 C2 G1, so in bar 3 the chord's C2 doubles the bass; the clear loop's chords are A3 C4 E4 | F3 A3 C4 | C3 E3 G3 | G3 B3 D4, the tune E5 C5 A4 | C5 A4 | E5 C5 E5 | B4 G5. `@oak/theory` `LOW_INTERVAL_LIMITS`: a minor third is clear from C3, a major third from B♭2: every third of the clear chords is at or above its limit, every one of the crowded chords below it.",
        "`tb.fscope` is a view (`audible: false`): check 10 lists it as pending, as `tb.scope` in A1.L01. The grader stubs `.fscope()` to identity.",
      ],
    },
    {
      id: "A2.L02",
      author: "A2a",
      idea: "How many parts play at once, and how they relate, is the texture; how many notes sound in a bar is the density. A thin section leaves room and makes the next thick one land: arrangers thin a verse and fill a chorus without changing a note of the tune.",
      hook: {
        hear: "Eight bars of the A2 loop in two sections within the first 20 seconds: a thin verse (bass on the one, two-note chords, the tune) and a thick chorus (the bass in eighths, full chords four times a bar, a strings pad above), the same tune over both.",
        code: `${T()}const chordsThin = n("<[0,2] [-2,0] [-5,-3] [-1,1]>")\nconst chordsThick = n("<[0,2,4]*4 [-2,0,2]*4 [-5,-3,-1]*4 [-1,1,3]*4>")\nconst bassThin = note("<a1 f1 c2 g1>")\nconst bassThick = note("<a1*8 f1*8 c2*8 g1*8>")\nconst padThick = n("<[0,4] [-2,2] [-5,-1] [-1,3]>")\nbass: arrange([4, bassThin], [4, bassThick]).s("sawtooth").lpf(400)\nchords: arrange([4, chordsThin], [4, chordsThick]).scale("A3:minor").s("piano").gain(.6)\npad: arrange([4, silence], [4, padThick]).scale("A4:minor").s("strings").gain(.3)\n${tune()}`,
      },
      key: Am,
      meter: "4/4",
      bpm: BPM,
      canDo: ["cd.compose.texture"],
      uses: [...BASE, ...L01, "tb.arrange"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Thin, then thick: the eight bars of the hook, the tune the same in both halves.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: "The chorus adds a pad and plays the chords four times a bar at the same tempo: will it sound bigger, faster or higher? (`choose`: bigger and fuller / faster / higher)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          panels: ["form"],
          what: "With the form map open: how many parts play in the chorus (number: 4); what changed between verse and chorus (choice: more parts and more notes / a faster tempo / a new key).",
          term: "term.texture",
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1,
          what: "One bar, two ways (two audio cards): the chords as a two-note stack held for the bar, and as four-note stacks four times a bar. Which is denser? The pass text names **density** beside texture and says a louder part is not a denser one.",
          term: "term.density",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Thin the verse: verse and chorus are the same thick section; make the verse thin. Graded: a `rubric` matcher with `contrast` (`a: { section: "verse" }`, `b: { section: "chorus" }`, `axes: ["density"]`, `minAxes: 1`; implemented): events per bar differ by 25% or more. Right answers: the chords held once a bar in the verse, the bass on the one, a part left out of the verse, the chorus made thicker instead. Wrong with the right function: the verse\'s chords turned down to `.gain(.3)` (quieter, not thinner: same events), one rest in each bar of the verse (thinner by less than a quarter: not heard as a new texture).',
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Thinner how: the loop twice, the second time thinner (a fixed item, tests in the lesson). Fewer parts, or the same parts playing fewer notes? The stimulus drops the bass to one note a bar and holds the chords: fewer notes.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Breathe: eight bars, verse and chorus, the same thick texture in both; thin one so the other lands.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Eight bars in two sections, verse and chorus, the same full arrangement in both. Make one section thin and the other thick: take parts out, hold the chords, put the bass on the one, or add a pad and more notes. Keep the tune the same in both.",
        required: {
          rule: "contrast",
          label: "One section thin and the other thick",
          why: '`contrast` with `a: { section: "verse" }`, `b: { section: "chorus" }`, `axes: ["density"]`, `minAxes: 1` (implemented; events per bar, every chord note counted, differ by at least 25%; masked parts sound no events). The starter (two equal sections) fails; quieter chords in the verse fail (same events); a single rest per bar fails; any real thinning or filling passes, whichever section is thin. The tune staying the same is a suggestion, not graded (a learner may vary it).',
        },
        suggestions: [
          "a part that enters in the chorus (`custom` `parts-enter`, `min: 1`)",
          'the tune the same in both sections (`matches`, `melody` key-relative on `mel`, `section: { section: "chorus" }` against the verse)',
        ],
        band: "band.aeolian-4bar",
        tracks: ["drums"],
        flavours:
          "The Band's drums in the flavour's kit; its fills follow the learner's `arrange()` sections.",
      },
      srs: [{ family: "fam.snd.roles", mode: "review-if-due", level: 2 }],
      mistakes: [
        'S5: the verse\'s chords turned down (`.gain(.3)`): `rubric.unmet` (quieter is not thinner); override: "{label}: not yet. The verse is quieter, but as full as the chorus."',
        "S5: one rest a bar in the verse: `rubric.unmet` (less than a quarter fewer notes)",
        "S5 unchanged: `code.unchanged`",
        "S6: fewer parts for fewer notes: `id.wrong`, overridden to say every part was still there",
        "Make: the starter, quieter parts only, a section changed by one note a bar: `rubric.unmet`",
      ],
      connects: {
        back: "U09.L02–L05 wrote sections with `arrange()` and brought parts in one at a time; U09.CP and C3 asked a chorus to contrast with its verse. A2.L01 gave each part its height.",
        forward:
          "A2.L03 fills a thin texture with a second line instead of more notes; A2.L06 changes the density with the style.",
      },
      epr: {
        enjoyment:
          "A verse that breathes and a chorus that lands, with the same tune over both: the learner's loop becomes a short song with a lift they arranged.",
        pace: "One idea: thin versus thick, counted in parts and notes. Form and section-writing were U09's and are reused; counter-lines are A2.L03's; levels are A2.L05's.",
        return:
          "The Coda says: you can thin a texture out and fill it back up. Next: a second line that answers the tune.",
      },
      notes: [
        'Today offer: "Make your loop breathe: a thin verse and a full chorus around the same tune."',
        "Evaluated: the hook's verse plays 5 or 6 events a bar (a two-note chord, one bass note, the tune's two or three notes), the chorus 24 or 25 (three-note chords four times, eight bass notes, a two-note pad, the tune): the grader's `contrast` density is events per bar over the section (`spanStats`), chord notes counted one by one, so a thicker voicing counts as well as more onsets.",
        '`silence` in `arrange()` (`[4, silence]`) is Strudel\'s empty pattern (evaluated, and linted at A2.L02 with the hook). The form map opens with `panels: ["form"]` (`tb.lens.form`, U09.L02).',
      ],
    },
    {
      id: "A2.L08",
      author: "content-lead",
      idea: "Write the fullest section first, every part you will use playing together, then make every other section by taking parts or notes away from it. The arrangement then changes without a new idea at every turn, and the peak has somewhere to grow from (DeSantis, Arranging as a Subtractive Process; Dramatic Arc).",
      hook: {
        hear: "Sixteen bars of the A2 loop as intro, verse, chorus and outro, all cut from one five-part chorus (hats, bass, chords, tune, strings): the hats wait through the intro, the tune and strings sit out the verse, everything plays in the chorus, and bass and chords are left for the outro.",
        code: `${T()}const hatsChorus = s("hh*8")\nconst bassChorus = note("<a1 f1 c2 g1>")\nconst chordsChorus = n("${CHORDS}")\nconst melChorus = n("${TUNE}")\nconst voxChorus = n("${VOX}")\nconst hatsIntro = silence\nconst bassIntro = bassChorus\nconst chordsIntro = chordsChorus\nconst melIntro = melChorus\nconst voxIntro = voxChorus\nconst hatsVerse = hatsChorus\nconst bassVerse = bassChorus\nconst chordsVerse = chordsChorus\nconst melVerse = silence\nconst voxVerse = silence\nconst hatsOutro = silence\nconst bassOutro = bassChorus\nconst chordsOutro = chordsChorus\nconst melOutro = silence\nconst voxOutro = silence\n\nhats: arrange([4, hatsIntro], [4, hatsVerse], [4, hatsChorus], [4, hatsOutro]).gain(.35)\nbass: arrange([4, bassIntro], [4, bassVerse], [4, bassChorus], [4, bassOutro]).s("ebass").lpf(700)\nchords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsChorus], [4, chordsOutro]).scale("A3:minor").s("piano").gain(.5)\nmel: arrange([4, melIntro], [4, melVerse], [4, melChorus], [4, melOutro]).scale("A4:minor").s("square").lpf(2000).gain(.5)\nvox: arrange([4, voxIntro], [4, voxVerse], [4, voxChorus], [4, voxOutro]).scale("A3:minor").s("strings").gain(.4)`,
      },
      key: Am,
      meter: "4/4",
      bpm: BPM,
      canDo: ["cd.compose.peak-first"],
      uses: [...BASE, ...L01, "snd.ebass", "tb.arrange", "tb.mask"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 1.25,
          what: "Start with everything: the five-part chorus alone (4 bars), then the same palette spread over intro, verse, chorus and outro (16 bars).",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["number"],
          minutes: 0.5,
          what: "Count the verse: how many labelled parts play in the verse alone (`count`: 3, the hats, bass and chords).",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["choice"],
          minutes: 1,
          panels: ["form"],
          what: "Find the omission: which labelled part plays in the chorus but sits out the intro (choice: the hats).",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "Carve from the peak: every section plays the full chorus; make the intro, verse and outro by taking parts or notes away. Graded: `custom` `carved { minDiffer: 2 }` (every bar of a section is the chorus's bar at the same place with notes deleted; at least one section leaves out a part or keeps every part with a quarter of the notes gone, Oak's call). Right answers: `silence`, masks, notes erased inside parts, the peak placed first. Wrong: the same part removed everywhere, a new note in the verse, the chorus thinner than a section. Pins: content/validate/pins/A2.L08.ts (an additive build, bars moved to another place, identical sections fail; thinning every part passes).",
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 0.5,
          what: "Place the peak: the same four sections in two orders (two audio cards); which builds to the chorus and falls away after it? The pass text names the **dramatic arc** and says opening at full strength is another choice.",
          term: "term.dramatic-arc",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Your fullest moment: write your own chorus from the bass and chords, then carve the intro, verse and outro from it.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Write your own fullest section in the Chorus consts, then make the intro, verse and outro by taking parts or notes away. The bass and chords are a starting point.",
        required: {
          rule: "custom",
          label:
            "Every section is the fullest one with parts or notes taken away, each bar at its own place; at least one section leaves out a part or a quarter of the notes",
          why: "`carved { minDiffer: 2 }`: the starter (every section the same) fails; a note the chorus does not play at that place fails (an additive build, or a bar moved); a part missing from the fullest section fails.",
        },
        suggestions: ["the fullest section with a thinner one before and after it (`custom` `arc`)"],
        band: "band.aeolian-4bar",
        tracks: ["drums"],
        flavours: "The Band's drums in the flavour's kit; the five parts are the learner's.",
      },
      srs: [],
      mistakes: [
        "S4 and Make: the same part removed from every section, the starter unchanged, a new note in the verse, the chorus losing a part still heard in the verse: `rubric.unmet` with the rule's detail",
        "S4 unchanged: `code.unchanged`",
        "S5: the version that opens at full strength: `id.wrong`",
      ],
      connects: {
        back: "A2.L02 thinned a verse so the chorus landed; U09.L07 carved a song that played everything everywhere.",
        forward:
          "A2.L09 blurs the seams between the sections carved here; A2.L03 fills a thin section with a second line.",
      },
      epr: {
        enjoyment:
          "The learner writes the best moment of the song first, then hears four sections come out of it without writing a new note.",
        pace: "One idea: arrange down from the peak. Texture and density were A2.L02's, sections and masks U09's, seams A2.L09's.",
        return:
          "The Coda says: you can build an arrangement down from its fullest section. Next: seams that blur and one surprise.",
      },
      notes: [
        "Oak 2.0 W2, written by Codex X10 (plan `docs/superpowers/plans/2026-11-25-oak2-w2.md` Task 9); this row was added at integration.",
        'Song: a side step ("Peak First builds a whole arrangement of its own, down from its chorus, so it stays a sketch beside the song.").',
        "S1 is 1.25 minutes: its two items play 53 seconds at 90 BPM (`wave7-learner.test.ts`, listen items at most 85 % of the step).",
      ],
    },
    {
      id: "A2.L03",
      author: "A2a",
      idea: "A counter-melody is a second tune that moves against the main one: it moves when the tune holds, and when both move it often goes the other way, so the ear can follow two lines at once. It sits in its own register, under or over the tune, never doubling it for long.",
      hook: {
        hear: "The A2 loop with a strings line under the tune that fills the tune's gaps and moves against it, within the first 20 seconds; then without it, for comparison.",
        code: `${T()}${BASS}\n${chords()}\n${tune()}\nvox: n("${VOX}").scale("A3:minor").s("strings").gain(.5)`,
      },
      key: Am,
      meter: "4/4",
      bpm: BPM,
      canDo: ["cd.compose.counter-melody"],
      uses: [...BASE, ...L01, "tb.arrange"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Two lines: the A2 loop with the strings line under the tune, then the tune alone.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: "A second line will sound clearest if it moves… (`choose`: when the tune holds a note / exactly with the tune / an octave below the tune, note for note)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          what: "The tune and the strings line on the roll: in how many of the four bars does the strings line start a note on a beat where the tune starts none (number: 3, bars 2–4); in bar 1, which way does it go while the tune falls (choice: up / down / it stays).",
          term: "term.counter-melody",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "Answer in bar 4: the strings line's bar 4 is empty (`⟪~ ~ ~ ~⟫`); give it two notes in the gaps after the tune's B and G (beats 2 and 4), on notes of G (G B D). Graded: a `rubric` matcher with `onsets` on `vox` (`contains: [[1, 4], [3, 4]]` in bar 4, `section: { bars: [4, 4] }`) and `in-key` on `vox` (implemented), plus `events` on `mel` (the tune unchanged). Right answers: B3 then G3 (the hook), D4 then B3, G3 then D4, B3 then G3 an octave lower. Wrong with the right function: two notes on beats 1 and 3, with the tune (`rubric.unmet`: they move together), the tune's own B4 and G5 copied an octave down on beats 1 and 3 (a doubling), the right notes at `.gain(.02)` (masked).",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Which second line: two versions of the loop with a second line (a fixed item, tests in the lesson). Does it double the tune, or answer it? The stimulus doubles the tune an octave down: a doubling.",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          optional: true,
          what: "Stretch (25-minute target only, never graded): re-voice per section. Verse and chorus with `arrange()`: give the chorus's chords a wider voicing (the root dropped an octave, the 3rd lifted) so the counter-line has room. `must-use tb.arrange`. The Make of A2.L06 and AC1 apply it.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "A second line: the A2 loop with an empty `vox:` line; write a counter-melody under or over the tune.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The A2 loop with its tune and an empty second line. Write a counter-melody: let it move when the tune holds, go the other way when both move, and stay in its own register. Any sound you like; strings, a pad or a soft synth work well.",
        required: {
          rule: "custom",
          label: "A second line that answers the tune",
          why: '`custom` `counter-melody` (planned) `{ melody: "mel", counter: "vox", minIndependence: .5 }`: the counter moves while the tune holds, or in contrary or oblique motion, in at least half of the tune\'s moves; never doubles the tune for more than two beats; audible. Fails: the starter (empty), the tune copied an octave down (a doubling), a line that moves exactly with the tune in parallel, a line at `.gain(.02)`. Passes: the hook\'s line, a line above the tune in the gaps, a slow line of whole notes moving against the tune\'s steps. PLANNED: the lesson fails check 2 until the grader builds it.',
        },
        suggestions: [
          'the counter-line in its own register (`range` on `vox`, `within: ["c3", "g4"]`)',
          "chord tones on the beats (`chord-tones-strong` on `vox`, `minRatio: .6`)",
        ],
        band: "band.aeolian-4bar",
        tracks: ["drums"],
        flavours: "The Band's drums in the flavour's kit.",
      },
      srs: [{ family: "fam.snd.roles", mode: "review-if-due", level: 1 }],
      mistakes: [
        'S4: notes on beats 1 and 3: `rubric.unmet` on the onsets rule; override: "{label}: not yet. Your notes start with the tune\'s; move them into its held notes."',
        "S4: the tune's notes copied down: `rubric.unmet` (a doubling: onsets with the tune)",
        "S4: notes outside A minor (G♯): `rubric.unmet` on `in-key`",
        "S4: the tune edited: the `events` part on `mel`",
        "S4 unchanged: `code.unchanged`",
        "S5: answer for the doubling: `id.wrong`, overridden to say every note of the second line started with a note of the tune",
        "Make: the starter, a doubling, a parallel line: `rubric.unmet`",
      ],
      connects: {
        back: "U07.L07 wrote call and response, two parts that take turns; U04.L02 sang and wrote a harmony that moves with the tune. A counter-melody is between the two: its own tune, at the same time.",
        forward:
          "A2.L04 adds a drum part made from a recording; A2.L06 and AC1 re-voice the chords per section, the stretch here.",
      },
      epr: {
        enjoyment:
          "Two tunes at once in the learner's own loop: a strings line that sighs in the gaps of the lead, the first arrangement that sounds like more than one person playing.",
        pace: "One idea: a second line that moves against the tune. Re-voicing per section is an optional stretch, applied in A2.L06 and AC1; counterpoint rules (species, voice crossing) are not taught.",
        return:
          "The Coda says: you can write a counter-melody against a tune. Next: a drum break, cut up and played in a new order.",
      },
      notes: [
        'Today offer: "Write a second tune that answers your lead: a counter-melody."',
        "Evaluated against the tune and the chords: the strings line plays A3 C4 (bar 1, beats 3–4, rising while the tune falls E5 C5 A4), A3 C4 (bar 2, beats 2–3: A3 in the gap after the tune's C5, C4 rising as the tune falls to A4), C4 E4 (bar 3, beat 1 with the tune, beat 4 while it rests), B3 G3 (bar 4, beats 2 and 4, in the gaps after the tune's B4 and G5). The planned `counter-melody` rule counts a beat where the tune starts nothing (a rest or a held note) as the tune holding. Every note on a beat is a tone of its chord (Am, F, C, G); it never sounds the tune's pitch class at the same time.",
        'S4\'s onsets rule reads bar 4 only (`section: { bars: [4, 4] }`, feature `rubric.section`, implemented). The pass text names oblique motion once in plain words ("one line holds while the other moves").',
      ],
    },
    {
      id: "A2.L04",
      author: "A2b",
      idea: "A sample is a recording played back as a sound; a drum break is a whole bar of a drummer. `.slice(n, pattern)` cuts it into n equal pieces and the pattern says which piece plays where: chop it, and the same drummer plays a new groove. Oak's break (`brk`) is its own recording, free to use.",
      hook: {
        hear: "Oak's break under the A2 loop at 96 BPM within the first 10 seconds: once as recorded, then chopped into four and played back in new orders, a stutter in the last bar.",
        code: `${T(96)}drums: s("brk").slice(4, "<[0 1 2 3] [0 1 0 3] [0 2 1 3] [0 1 [2 2] 3]>")\n${BASS}\n${chords()}`,
      },
      key: Am,
      meter: "4/4",
      bpm: 96,
      canDo: ["cd.code.sampling"],
      uses: [...BASE, ...L01, "snd.brk", "tb.chop", "tb.loopAt", "tb.speed"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: 'The break as recorded (`s("brk")`), then chopped: the same drummer, a new groove.',
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: '`s("brk").slice(4, "3 2 1 0")`: what will it sound like? (`choose`: the bar played back to front, beat by beat / the bar reversed like tape / the same bar)',
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          what: 'The break sliced in four, `"0 1 2 3"`, with the roll: on which beat is the first snare (number: 2); what plays on beat 3 of `.slice(4, "0 1 0 3")` (choice: the first beat again, a kick / the snare / nothing).',
          term: "term.sample",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Swap the middle: `.slice(4, "0 ⟪1 2⟫ 3")`; the target (audible) plays beat 3\'s piece on beat 2 and beat 2\'s on beat 3. Graded: `controls` on `drums`, `begin` `exact` (PLANNED until `begin`/`end` join the grader\'s control keys; until then `arg-matches` on `slice` argument 1 `^"?\\s*0\\s+2\\s+1\\s+3\\s*"?$` plus `events` on the rhythm). Right answers: `"0 2 1 3"`, the same written `"[0 2 1 3]"`, `.slice(8, "0 1 4 5 2 3 6 7")` (the same pieces in eighths), `.splice(4, "0 2 1 3")`. Wrong with the right function: `"0 1 2 3"` (the sample\'s own order: nothing changes), `"0 2 2 3"` (one swap half done), `.slice(2, "0 1")`.',
          term: "term.chop",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Which order: the break chopped in four (a fixed item, tests in the lesson). Options, worded as what is heard: as recorded (`0 1 2 3`), the two middle beats swapped (`0 2 1 3`), beat 2 played again on beat 4 (`0 1 2 1`). The stimulus is `0 2 1 3`: the first snare lands on beat 3, a kick on beat 2. (`0 1 2 1` is near the recorded bar, since beat 2 and beat 4 both hold a snare: it is the plausible wrong answer.)",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1,
          graded: true,
          what: 'Oak 2.0 (W2), the book\'s Sampling the Old-Fashioned Way: speed changes the rhythm. `brk` at 96 BPM cut into four, `.speed("<1 2 .5>")` given; bars 2 and 3 still play the four pieces on the beats (`⟪[0 1 2 3] [0 1 2 3]⟫`), so bar 2 leaves gaps and bar 3 runs over. Place the pieces so each fills its place: `[0 1 2 3]*2` in bar 2 (double time, an octave up), `[0 1]` in bar 3 (half time, an octave down). Graded: `rhythm` on `drums` and `controls` on `begin` (exact) and `speed` (linear, .05). Right answers: the eight written out, `.speed()` before `.slice()`, three `arrange()` sections with `.speed(1)`, `.speed(2)`, `.speed(.5)`. Wrong: every speed 1 with the new rhythm, each piece twice in bar 2, the two bars swapped. Pins: content/validate/pins/A2.L04.ts.',
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Flip the break: the A2 loop at 96 BPM with the break as recorded; chop it into four or more and play the pieces in an order of your own.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The loop over Oak's break, played as recorded. Flip it: slice the break into four, eight or sixteen pieces and play them in your own order: repeat the kick, move the snare, stutter the last beat. Keep the bar the same length.",
        required: {
          rule: "custom",
          label: "The break chopped and played in a new order",
          why: '`custom` `slices-reordered` (planned) `{ track: "drums", minSlices: 4 }`: the sample is cut into at least four slices (`begin`/`end` from `.slice()`, `.chop()`, `.splice()` or `.begin()`/`.end()`) and they play in an order other than the sample\'s own. Fails: the starter (as recorded), `.slice(4, "0 1 2 3")` (the right function, the sample\'s own order), `.slice(2, "1 0")` (two slices), `.chop(4)` alone (in order), the drums at `.gain(.02)`. Passes: `"0 2 1 3"`, `"0 1 0 3"`, `.slice(8, "0 1 2 3 0 1 [6 6] 7")`, `.splice(4, "0 2 1 3")`. PLANNED: the lesson fails check 2 until the grader builds it and reads `begin`/`end`.',
        },
        suggestions: [
          "the chopped break plays every bar (`bars`, `min: 4`)",
          "a stutter: one slice twice in its own beat (`onsets` on `drums`, more than four a bar)",
        ],
        band: "band.aeolian-4bar",
        tracks: ["bass", "chords"],
        flavours:
          "The Band's bass and chords in the flavour's sounds; the break is the same in every flavour.",
      },
      srs: [{ family: "fam.snd.roles", mode: "review-if-due", level: 2 }],
      mistakes: [
        'S4: `"0 1 2 3"`: the `controls` miss (nothing moved); override: "The pieces still play in the order they were recorded."',
        'S4: `"0 2 2 3"`: the miss on beat 3',
        "S4: `.slice(2, …)`: the miss (two halves, not four pieces)",
        "S4 unchanged: `code.unchanged`",
        "S5: the recorded order, or `0 1 2 1`, for `0 2 1 3`: `id.wrong`, overridden to name the snare that moved to beat 3",
        "Make: the starter, the sample's own order, two slices, `.chop(4)` alone: `rubric.unmet`",
      ],
      connects: {
        back: "U01's drum lines placed one sound per step; here one recording holds a whole bar and the steps rearrange it. A1.L04 gave parts their own space; a break carries its room with it.",
        forward:
          "A2.L05 balances the chopped drums against the bass and chords; RC1 (rhythm track) writes a 16th-note funk pocket by hand.",
      },
      epr: {
        enjoyment:
          "A drum break that grooves under the learner's loop, flipped into a pattern of their own: the oldest trick in hip-hop production, done with three numbers.",
        pace: "One workflow: slice and reorder. `.loopAt()` (fitting a break to another tempo), `.speed()` and `.begin()`/`.end()` are named once in the pass text and hints, `.chop()`, `.striate()` and `.splice()` only in the catalog; the lesson plays at the break's own tempo so nothing needs fitting.",
        return:
          "The Coda says: you can chop a sample and play its slices in a new order. Next: the mix, a level and a place for every part.",
      },
      notes: [
        'Today offer: "Cut up a drum break and play it back as a groove of your own."',
        'Evaluated: Oak\'s break is one bar at 96 BPM (`BRK_BPM`, scripts/sounds/brk.ts): kick on 1, the a of 1, 3 and the and of 3; snare on 2 and 4 with ghost notes; sixteenth hats. `.slice(4, "0 2 1 3")` plays begin 0, .5, .25, .75 (the slice events carry `begin`, `end`, `_slices`). Sliced in four, the pieces are the four beats; slice 0 holds the kick of beat 1, slice 1 the first snare.',
        'S5\'s options are worded as what is heard ("the kick comes back on beat 3"), not as numbers, in the lesson; the spec lists the orders for the author.',
        '`brk` is CC0, rendered by Oak (contracts §3.2 `snd.brk`); the pass text of S3 says so once ("recorded by Oak, free to use"). No sample of a real record appears anywhere.',
      ],
    },
    {
      id: "A2.L05",
      author: "A2c",
      idea: "The mix is the balance of every part: how loud, where from left to right, how much room. The tune sits on top, the chords under it, the bass under both; `.pan()` gives each a side and `.room()` a depth. Compression (`.compressor()`) turns a part's loud moments down so it sits steadier; `.postgain()` sets its level after the effects.",
      hook: {
        hear: "The A2 loop unbalanced (the chords louder than the tune, everything in the middle), then mixed: the tune on top, the chords under it and a little to the left, a strings pad to the right and back, the tune compressed so it sits steady. Within the first 20 seconds.",
        code: `${T()}bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400).gain(.8)\nchords: n("${CHORDS}").scale("A3:minor").s("piano").gain(.35).pan(.35).room(.3)\npad: n("<[0,4] [-2,2] [-5,-1] [-1,3]>").scale("A4:minor").s("strings").gain(.2).pan(.65)\nmel: n("${TUNE}").scale("A4:minor").s("square").lpf(2000).gain(.6).compressor("-20:4:10:.002:.1")`,
      },
      key: Am,
      meter: "4/4",
      bpm: BPM,
      canDo: ["cd.code.mix"],
      uses: [...BASE, ...L01, "tb.pan", "tb.compressor", "tb.postgain", "tb.duck"],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Unbalanced, then balanced: the A2 loop with the chords on top of the tune and everything in the middle, then mixed.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: "The chords at `.gain(.8)`, the tune at `.gain(.3)`: what gets lost? (`choose`: the tune / the bass / nothing)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          what: "Halve a part's `.gain()` and it drops 6 dB: the chords from `.gain(.8)` to `.gain(.4)` drop by how many dB (number: 6); `.pan(0)` and `.pan(1)` on the chords, a bar each: which bar comes from the left (choice: bar 1, `.pan(0)`).",
          term: "term.mix",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: 'Put the tune on top: the chords at `.gain(⟪.8⟫)` drown the tune at `.gain(.4)`. Graded: a `rubric` matcher with `custom` `level-balance` (planned) `{ louder: "mel", quieter: "chords", minDb: 3, maxDb: 18 }`. Right answers: chords at .25, at .2, the tune raised to .8 with the chords at .5, the chords at .3 with `.postgain(.8)`. Wrong with the right function: the chords at `.gain(.03)` (more than 24 dB down: the chords are gone, not under), the chords at `.gain(.4)` (level with the tune, 0 dB), `.pan(.2)` on the chords only (moved, not quieter).',
        },
        {
          kind: "compare",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1,
          what: 'Steady: two cards, the tune with and without `.compressor("-20:4:10:.002:.1")` (a part with loud and soft notes). Which sits steadier, its loud notes no louder than the rest? The pass text names **compression** and says it is heard, not counted.',
          term: "term.compression",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "What is too loud: the A2 loop with one part too loud for its place (a fixed item, tests in the lesson). The bass, the chords or the tune? The stimulus has the bass 9 dB above the tune.",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1,
          graded: true,
          what: 'Oak 2.0 (W2), the book\'s Foreground, Middle Ground, Background: front, middle, back. Eight bars on Am over the Band\'s drums: a tune that changes every bar, chords (`[0,2,4]@3 [0,2,4]`, `.gain(⟪.25⟫)`) and a bass that repeat. Make the chords step forward for one bar of the eight, louder or busier, and settle back. Graded: `events` on `mel` and `custom` `depth-layers { front: "mel", back: ["chords", "bass"] }` over 8 rendered bars (Oak\'s thresholds, in the rule: a background repeats in 3 bars of 4, a step forward is 3 dB louder or half again as busy, in at most one bar of eight). Right answers: bar 8 or bar 4 at `.5`, eighth-note chords in bar 8, the bass stepping forward instead. Wrong: the chords louder in every bar, forward in two bars, raised by a hair, the tune changed. Pins: content/validate/pins/A2.L05.ts.',
          term: "term.foreground",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Mix it: the A2 loop with a pad, every part at the same level and in the middle; give each part its level, its side and its room.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "The loop with a pad, every part at the same level and in the middle. Mix it: the tune on top, the chords and the pad under it, a side for the parts that share a register, a little room where it helps. Compress a part that jumps out if you hear one.",
        required: {
          rule: "custom",
          label: "The tune on top: the chords sit under it, still heard",
          why: '`custom` `level-balance` (planned) `{ louder: "mel", quieter: "chords", minDb: 3, maxDb: 18 }` (effective gain, median over the notes that sound together): the chords between 3 and 18 dB under the tune. Fails: the starter (level, 0 dB), the chords at `.gain(.03)` (more than 24 dB down: not heard), the chords louder, a pan with no level change. Passes: chords 6 dB under, 12 dB under, the tune raised instead, a mix with pan and room and the levels right. Pan, room and compression are heard and free (suggestions), never counted as level. PLANNED: the lesson fails check 2 until the grader builds `level-balance` and adds `postgain` and `pan` to its control keys.',
        },
        suggestions: [
          "two parts on different sides (`custom` `control-set` on `pan`, `not: .5`, on two lines)",
          'the pad under the chords too (`custom` `level-balance`, `louder: "chords"`, `quieter: "pad"`)',
        ],
        band: "band.aeolian-4bar",
        tracks: ["drums"],
        flavours: "The Band's drums in the flavour's kit, mixed by Oak; the learner mixes their own parts.",
      },
      srs: [{ family: "fam.snd.roles", mode: "review-if-due", level: 2 }],
      mistakes: [
        'S4: chords at `.gain(.03)`: `rubric.unmet` (gone, not under); override: "{label}: not yet. The chords have dropped out of hearing; bring them back up under the tune."',
        "S4: chords level with the tune: `rubric.unmet` (0 dB)",
        "S4: chords panned only: `rubric.unmet` (no level change)",
        "S4 unchanged: `code.unchanged`",
        "S6: the chords or the tune for the bass: `id.wrong`, overridden to name the bass covering the low end",
        "Make: the starter, the chords gone, the chords on top: `rubric.unmet`",
      ],
      connects: {
        back: "A1.L04 put parts in a room and on orbits; A2.L01 gave each part a register. `.gain()` has set loudness since U01; here it sets a balance.",
        forward: "A2.L06 mixes one tune two ways; AC1 and AC2 end with a mix and a release.",
      },
      epr: {
        enjoyment:
          "The learner's loop with the tune clearly on top, the chords and pad spread around it and a touch of room: the first time their loop sounds mixed rather than stacked.",
        pace: "One idea: a level and a place for every part. Panning and room are reused (A1.L04, U14.L06 if taken); compression is heard in one comparison and offered, not required; ducking (`.duckorbit()`) is named in a hint only.",
        return: "The Coda says: you can balance a mix and give each part room. Next: one tune, two styles.",
      },
      notes: [
        'Today offer: "Mix your loop: the tune on top, every part with its own level, side and room."',
        "Evaluated: the hook's events carry `pan` (.35, .65), `room` .3, and on the tune `compressor: -20, compressorRatio: 4, compressorKnee: 10, compressorAttack: .002, compressorRelease: .1`. Halving a gain is −6.02 dB (20·log10 .5); `level-balance` and `levelsView` read effective gain (`gain × velocity × postgain`, normalize/nevent.ts).",
        "`tb.pan` has two sites (U14.L06 or A2.L05): granted here silently if already granted. `tb.duck` (`.duckorbit()`, `.duckdepth()`) is unlocked here and named in hint 3 of the Make only.",
      ],
    },
    {
      id: "A2.L06",
      author: "A2c",
      idea: "A style is a set of habits, its idiom: which drums, how busy the bass, which sounds, how long the notes. Keep the tune and change the habits, and the same song becomes a ballad or a driving dance track. Arrangers do it to every standard.",
      hook: {
        hear: "The A2 tune as a slow-feeling ballad (piano with room, strings held, a kick on the one and a rim click, the bass once a bar), then the same notes driven (909 four-on-the-floor, claps, eighth-note bass, chord stabs, the tune short and bright): eight bars, within the first 20 seconds.",
        code: `${T()}const tuneNotes = n("${TUNE}")\nkick: arrange([4, s("bd ~ ~ ~")], [4, s("bd*4").bank("RolandTR909")])\nsnare: arrange([4, s("~ ~ rim ~")], [4, s("~ cp ~ cp").bank("RolandTR909")])\nhats: arrange([4, silence], [4, s("[~ hh]*4").bank("RolandTR909")]).gain(.5)\nbass: arrange([4, note("<a1 f1 c2 g1>")], [4, note("<a1*8 f1*8 c2*8 g1*8>")]).s("sawtooth").lpf(500)\nchords: arrange([4, n("${CHORDS}").s("strings")], [4, n("<[~ [0,2,4]]*4 [~ [-2,0,2]]*4 [~ [-5,-3,-1]]*4 [~ [-1,1,3]]*4>").s("piano")]).scale("A3:minor").gain(.4)\nmel: arrange([4, tuneNotes.s("piano").room(.4)], [4, tuneNotes.s("square").lpf(2500).decay(.15).sustain(0)]).scale("A4:minor").gain(.6)`,
      },
      key: Am,
      meter: "4/4",
      bpm: BPM,
      canDo: ["cd.compose.genre"],
      uses: [
        ...BASE,
        ...L01,
        "tb.arrange",
        "tb.bank",
        "snd.bank.RolandTR909",
        "snd.drum.rim",
        "snd.drum.cp",
        "tb.adsr",
      ],
      steps: [
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "One tune, two ways: the ballad and the driving version of the hook, back to back.",
        },
        {
          kind: "predict",
          exercise: "predict",
          answer: ["choice"],
          minutes: 0.5,
          what: "Between the two versions, what did not change? (`choose`: the tune's notes and rhythm / the drums / the sounds)",
        },
        {
          kind: "investigate",
          exercise: "run-investigate",
          answer: ["number", "choice"],
          minutes: 1,
          panels: ["form"],
          what: "With the form map: how many bass notes in a bar of the driving version (number: 8); which part plays the same notes in both (choice: the tune / the bass / the chords).",
          term: "term.idiom",
        },
        {
          kind: "modify",
          exercise: "code-modify",
          answer: ["code"],
          minutes: 1.25,
          graded: true,
          what: "Drive the drums: the driving section's drums are the ballad's (`⟪bd ~ ~ ~⟫`); give it a kick on every beat. Graded: a `rubric` matcher with `onsets` on `kick` `contains: [0, [1, 4], [1, 2], [3, 4]]`, `perBar: true`, `section: { bars: [5, 8] }` (implemented), plus `events` on `mel` (the tune unchanged). Right answers: `bd*4`, `bd bd bd bd`, `[bd bd bd bd]` on the 909, `bd*4` with an extra kick on the and of 4. Wrong with the right function: `bd*4` written into the ballad's section (the wrong section: bars 5–8 still have one kick), `bd*2` (beats 1 and 3 only), `bd*4` at `.gain(.02)`.",
        },
        {
          kind: "ear",
          exercise: "identify",
          answer: ["choice"],
          minutes: 1.25,
          graded: true,
          what: "Same tune: two short versions (a fixed item, tests in the lesson). Is it the same tune in two styles, or two different tunes in one style? The stimulus keeps the drums and changes two notes of the tune: two tunes.",
        },
        {
          kind: "listen",
          exercise: "listen",
          minutes: 0.5,
          what: "Oak 2.0 (W2), the book's Creating Harmony 2 for non-jazz ears, ungraded: the house pad. A strings pad C E G B over a 909 kick on every beat, then the same pad over a held low A: one soft minor chord on A with G and B above it (a minor 9th; the name waits for U12). The pass text says the bass names the chord.",
        },
        {
          kind: "make",
          exercise: "code-make",
          answer: ["code"],
          minutes: 2.75,
          what: "Two ways: eight bars, the A2 tune in a `ballad` section and a `drive` section with the same arrangement; change the habits of one so the two styles are unmistakable.",
        },
      ],
      wrapAt: 4,
      make: {
        brief:
          "Eight bars: the same tune in two sections, `ballad` and `drive`, arranged the same way. Make them two styles: change the drums, how busy the bass is, the sounds, how long the notes are, the register. Keep the tune's notes and rhythm.",
        required: {
          rule: "custom",
          label: "The same tune in two styles you can hear",
          why: '`custom` `same-tune-two-ways` (planned) `{ melody: "mel", a: { section: "ballad" }, b: { section: "drive" }, minAxes: 2 }`: the tune of both sections is the same (key-relative degrees and rhythm), and the sections differ on at least two of sounds, density (±25%), groove (the drum onsets) and register (±5 half steps). Fails: the starter (two identical sections), two different tunes, a change of sound only (one axis), a change of tempo (not possible inside one piece: the tune\'s rhythm would differ). Passes: the hook, a ballad on strings against a 909 version with an eighth-note bass, a version moved up an octave with new drums. Only tools of the earliest route: no swing (a ballad against a drive, not swung against straight), no `crunch`, no blues scale (pre-flight B6). PLANNED: the lesson fails check 2 until the grader builds the rule.',
        },
        suggestions: [
          "a part that only one version has (`custom` `parts-enter`, `min: 1`)",
          'the drive version denser (`contrast`, `axes: ["density"]`)',
        ],
        band: "band.aeolian-4bar",
        tracks: ["chords"],
        flavours:
          "The Band plays the chords quietly in the flavour's sound under both versions; the drums are the learner's (they are one of the habits that change). Swaps: none (the learner chooses the sounds of each idiom).",
      },
      srs: [{ family: "fam.snd.roles", mode: "review-if-due", level: 1 }],
      mistakes: [
        "S4: `bd*4` in the ballad's section: `rubric.unmet` on the onsets of bars 5–8 (override names the driving section)",
        "S4: `bd*2`: `rubric.unmet` (beats 2 and 4 missing)",
        "S4: the kick at `.gain(.02)`: `rubric.unmet` (masked)",
        "S4 unchanged: `code.unchanged`",
        "S5: same tune for the altered one: `id.wrong`, overridden to name the two notes that moved",
        "Make: the starter, two tunes, sound only: `rubric.unmet`",
      ],
      connects: {
        back: "U09 wrote sections with `arrange()`; A2.L02 thinned and filled them; A2.L05 mixed them. U06.L07 heard two styles of loop (doo-wop, three-chord rock).",
        forward:
          "AC1 arranges a whole public-domain tune twice, in two genres, with swing available; AC2 writes a neo-soul ballad from the jazz and rhythm tracks' tools.",
      },
      epr: {
        enjoyment:
          "The learner's own tune as a quiet ballad and as a dance track in one eight-bar piece: proof that arranging, not just writing notes, makes the music.",
        pace: "One idea: a style is its habits, and the tune survives them. Swing, blues and genre-specific instruments wait for the tools of later units (AC1 uses them); one comparison of two idioms, not a survey of genres.",
        return:
          "The Coda says: you can arrange one tune in two styles. Next: the sound and arrangement checkpoint, then the track's capstones.",
      },
      notes: [
        'Today offer: "Arrange one tune two ways: a ballad and a driving version."',
        "Earliest route (U10.CP and A1.L07): swing, `crunch`, the blues scale and dominant sevenths are locked (pre-flight B6; `swingBy` lints as `code.locked-tool`, `crunch` as `code.locked-sound`), so the two idioms are a sustained ballad and a driving version (four-on-the-floor on the 909, eighth-note bass, short notes). A learner who has them may use them in the Make; nothing requires them.",
        "Evaluated: the hook's tune plays the same degrees and onsets in both sections; the drive section has about four times the events per bar of the ballad (density), other drum onsets (groove) and other sounds: three axes. `rim`, `cp` and the 909 bank are U01's (`snd.drum.rim`, `snd.drum.cp`, `snd.bank.RolandTR909`).",
      ],
    },
  ],
  checkpoint: {
    id: "A.CP",
    author: "CP",
    authored: [
      {
        id: "name-the-sound",
        kind: "all",
        skills: ["D02", "D06", "D07"],
        what: "Three short sounds, one question each (`all` of three `identify` parts, fixed items with tests): which wave (sine, square or sawtooth: D02), which grit (saturated or bit-crushed: D06), what moves (pitch, loudness or brightness: D07). Each stimulus is a part of the A1 loop; no option is a control name. Graded as one item.",
      },
      {
        id: "chop-the-break",
        kind: "code-modify",
        skills: ["D11"],
        what: 'Oak\'s break as recorded under the A2 loop at 96 BPM: make beat 4 stutter beat 2\'s snare (`.slice(4, "0 1 2 [1 1]")`) or play any reorder of four or more slices (`rubric` matcher with `custom` `slices-reordered`, planned, `minSlices: 4`). The unchanged starter, `"0 1 2 3"` (the right function, the own order) and two slices fail. Fallback until the grader lands it: `arg-matches` on `slice` argument 1 refusing `0 1 2 3`.',
      },
      {
        id: "balance-the-loop",
        kind: "code-modify",
        skills: ["D10"],
        what: 'The A2 loop with the chords 6 dB above the tune: put the tune on top (`custom` `level-balance`, planned, `louder: "mel"`, `quieter: "chords"`, 3–18 dB). Fails: unchanged, the chords at `.gain(.03)` (gone, not under), a pan only. Fallback until the grader lands it: `arg-matches` on the chords\' `.gain()` argument, from .05 to .3, with the tune\'s line locked (`edit-only-regions`).',
      },
    ],
    recipe: {
      items: [12, 16],
      families: {
        D03: ["fam.snd.params"],
        D04: ["fam.snd.params"],
        D05: ["fam.snd.params"],
        D08: ["fam.snd.roles"],
      },
      why: "`fam.snd.params` (levels 1–5: cutoff, resonance, attack and release, room and delay, two changes) is the only family for D03–D05 and `fam.snd.roles` (roles, masking) for D08; both unlock before A.CP in every legal order (A1.L02, A2.L01). The other gated skills have no family (D02, D06, D07, D09, D10, D11): the three authored items and the Make measure them. 12–16 items keep the checkpoint inside a 15-minute day with the Make.",
    },
    make: {
      brief:
        "The A2 loop in two sections, verse and chorus, every part at the same height and level and the same in both: arrange it. Give each part its register, make one section thin and the other thick, and give one part a sound of your own (grit, movement or FM).",
      required:
        'D09: `contrast` `axes: ["density"]`, `minAxes: 1` between verse and chorus (implemented): one section thin and the other thick. Registers (D08) and the sound (D02–D07) are suggestions on the same Make: `range` on `chords` from C3, `control-set` with `anyOf` the A1 controls (planned).',
    },
    notes: [
      "A.CP covers A1.L01–A2.L06 (contracts §2.6, `checkpointMetas`: gated D02–D11, no level-setting skills). It gates only AC1 and AC2 (contracts §7.6: track checkpoints gate only the track capstones); nothing in the core waits for it. A learner who soft-passes it opens both capstones.",
      "Default order position: after A2.L06 in track A (`trackOrder.A`); the planner puts it on a later day than A2.L06 like every checkpoint.",
      "Two of three authored items use planned rules (`slices-reordered`, `level-balance`); each names a fallback that ships today. Item 1 is all fixed `identify` parts: no planned shape.",
      "No sung or tapped item: nothing in A1–A2 is sung (contracts §8).",
      'Band for the Make: `band.aeolian-4bar` with `tracks: ["drums"]`, as A2.',
    ],
  },
  capstones: [
    {
      id: "AC1",
      author: "capstones-sound",
      intent:
        "The track's first capstone and a new kind of album track: ONE public-domain tune arranged TWICE, in two genres, released as one album track with two sides (side A and side B: `CapstoneDef.versions`, `Album.sides`). Session 1 arranges version one in a genre the learner picks; session 2 arranges version two in another genre, with another tempo or feel and other sounds; session 3 plays them side by side, polishes both and releases. The tune is the song's own melody, given in the starter and kept note for note (pitch class and rhythm); everything around it is the learner's. Nothing new is taught: the habits of A2.L06 (drums, bass, density, sounds, register), the sound design of A1 and the mix of A2.L05, now with everything the core gave them (swing, the blues, sevenths, `crunch`, horns once unlocked).",
      opens:
        "When A.CP and U11.CP are passed or soft-passed (contracts §2.6, §4.3). Its tune: Sweet Georgia Brown (1925) only once U15.L05 is completed (its harmony is the dominant chain U15.L05 names; repertoire `availableFrom`), St. Louis Blues (1914) as soon as the repertoire author ships a verified answer key (three agreeing readings of Handy's 1914 sheet, f8). Until St. Louis Blues has one, a learner with A.CP and U11.CP but not U15.L05 sees AC1 as closed with one honest line from `capstones.gate` (`CapstoneGate.tunes`): \"AC1's tune, Sweet Georgia Brown, opens with Dominant Chains (U15.L05).\" No countdown; AC2 and the other tracks stay open.",
      band: "None: each version is the learner's whole arrangement (drums, bass, chords and the given melody), so the rules read only their code. The flavour sets the starter's sounds only; the brief asks the two versions to be in two different flavours (pop, indie, jazz-soul, funk) but the rubric reads the music, not the flavour id.",
      sections: [
        {
          title: "The rubric (contracts §6.6 AC1, as the content lead settled it; content/capstones.ts AC1)",
          lead: "Per version means the rule runs on each version's own code; across means it reads both (`GradeContext.otherVersion`). Every rule reads what is heard.",
          items: [
            'Per version, required: `custom` `song-melody-kept` `{ melody: "@melody", pitch: "pitch-class" }` (planned): the melody is the song\'s, note for note, by pitch class and onset (rhythm normalised for declared swing). Octave and sound are free.',
            'Per version, required: `custom` `control-set` `{ anyOf: [{ control: "lpenv", above: 0 }, { control: "distort", above: .5 }, { control: "crush", below: 7 }, { control: "vib", above: 0 }, { control: "phaserrate", above: 0 }, { control: "tremolosync", above: 0 }, { control: "lprate", above: 0 }, { control: "fmi", above: .5 }, { control: "roomsize", above: 3 }, { control: "delaytime", above: 0 }] }` (planned: `anyOf`, the keys and the silencers, grader request 2 of A1): an A1 sound-design control set to a value that is heard. Replaces §6.6\'s "each version `uses` ≥ 1 A1 tool" (contracts change requested by the content lead, apiNote 1).',
            'Across, required: `custom` `two-versions-differ` `{ melody: "@melody", tempoDelta: 20, soundsDiffer: 2 }` (planned): tempo 20 BPM or more apart, or one swung and one straight (proposed: a swing ratio of 1.45 or more measured on one, under 1.2 on the other); and at least two sounds of one version absent from the other.',
            "Brief, both: `bars` ≥ 16 (the first half of the chorus, A and B, or all 32 bars; `song-melody-kept` compares the bars written with the song from its bar 1); `tempo-bpm` 60–220.",
            "Free choice: the genres, the sounds (every unlocked sound), the tempo, the octave of the tune (it is checked by pitch class, so it stays in the song's key: F for Sweet Georgia Brown; a learner who moves the key hears `harmony.key-mismatch` first), the form (the first 16 bars or the whole chorus, an intro, a tag), the chords' voicing, the swing amount, the drums.",
          ],
        },
      ],
      sessions: [
        {
          id: "AC1.S1",
          goal: "St. Louis Blues (1914) or Sweet Georgia Brown (1925), version one.",
          opens:
            "The brief (content/capstones.ts AC1) and version one's starter: the tune's melody as a `mel:` line (from the song's answer key, in F for Sweet Georgia Brown, `const changes` with its 32 bars of chords), a tempo line and empty `drums:`, `bass:` and `chords:` lines. A picker for the tune when both are available.",
          hear: "The melody alone at the song's own tempo; then whatever the learner adds, from bar 1; A/B against the last saved draft.",
          see: 'The two-version capstone workspace (wave7.md §5: `CapstoneSessions.versions`, `CapstoneDraftSave.versionId`): a tab per version, version one active; the Workbench with the chord band and the form map (A B A C); the checklist with "Version one keeps the tune", "Version one has a sound you shaped" live and the across line greyed ("after version two"). Session bar: "Session 1 of 3: Version one".',
          work: [
            "Choose the first genre (a flavour's starter sounds: jazz-soul upright and Rhodes, funk fingerbass and clav once unlocked, pop piano and 808, indie guitars) and a tempo.",
            "Drums in that genre's habit; a bass from the changes (`.rootNotes(2)` or written); chords voiced for it (block, stabs, a pad).",
            "One sound shaped with an A1 tool (a filtered bass, crushed drums, an FM bell, vibrato on a lead).",
          ],
          checks: [
            '`capstones.check` on version one: `song-melody-kept`, the A1 `control-set`; `two-versions-differ` reads "needs version two" and never blocks.',
            "Nothing blocks saving; the session ends when version one's draft is saved.",
          ],
          ends: 'Version one saved (`versionId: "a"`); the Coda says "Next time: the same tune in another style" and names the genre they chose.',
          epr: {
            enjoyment:
              "A public-domain standard in the learner's chosen genre, their drums and chords under the real tune: an arrangement they can play to someone.",
            pace: "One version, one genre, one shaped sound; the comparison and the mix wait for session 3. The melody is given, so the minutes go to arranging, not transcribing.",
            return:
              'The Coda says: version one is saved. Next: "the same tune in another style", with the other genre suggested.',
          },
        },
        {
          id: "AC1.S2",
          goal: "Version two in the other flavour.",
          opens:
            "Version two's starter: the same melody line and changes, the tempo line at version one's tempo, empty parts, with version one one tab away (read-only reference, playable).",
          hear: "Version one and version two A/B from the same bar (a toggle that keeps the playhead's bar).",
          see: 'The same workspace with version two active; the checklist adds the across line live: "The two versions differ: tempo or feel, and sounds". Session bar: "Session 2 of 3: Version two".',
          work: [
            "Another genre: other drums, another bass habit, other sounds (at least two not in version one).",
            "Another tempo (20 BPM or more away) or another feel (swung against straight: `.swingBy(1/3, 4)` is the learner's since U11.L07).",
            "One sound shaped with an A1 tool.",
          ],
          checks: [
            "`capstones.check` on version two, and `two-versions-differ` across both.",
            "Saving never blocks.",
          ],
          ends: 'Version two saved (`versionId: "b"`); the Coda says "Next time: compare, polish and release".',
          epr: {
            enjoyment:
              "The same tune now in a second, different style beside the first: the learner hears for themselves that arranging changes what a song is.",
            pace: "One more version with the same three steps as session 1; the starter already holds the melody and the changes.",
            return: 'The Coda says: both versions are saved. Next: "compare, polish and release".',
          },
        },
        {
          id: "AC1.S3",
          goal: "Compare, polish, release.",
          opens: "Both drafts; version one active.",
          hear: "The two versions back to back (side A, then side B) from the release preview; A/B by section.",
          see: 'Every checklist line live for both versions; "Review" and "Release" at the end. Session bar: "Session 3 of 3: Compare and release".',
          work: [
            "Compare: what each style changed (the liner notes preview lists tempo, feel, sounds, density per version).",
            "Polish both: levels and room (A2.L05), a part's register (A2.L01), an intro or an ending.",
            "Release: one album track, two sides.",
          ],
          checks: [
            "The whole rubric on both versions; release once every required line is met and the latest check graded the code being released (decision 45), for both versions.",
            "The tutor review (contracts §10.6, `reviewRevisions: 2`) compares the two versions and never affects pass or fail.",
          ],
          ends: 'Released: album track AC1 with side A and side B (`Album.sides`), a cover, deterministic liner notes per side and the learner\'s own line. ms.27 ("You can now arrange one tune two ways") shows.',
          epr: {
            enjoyment:
              "Both versions on the album as one track with two sides: a cover project the learner would actually play for a friend.",
            pace: "No new writing: compare, adjust levels and room, release. A version that is not finished still releases once its rules pass.",
            return:
              "The Coda says: you can arrange one tune in two styles. Next: AC2, the neo-soul ballad, once the walking bass (J3.L04) and the laid-back feel (R1.L05) are done, or another track's lesson.",
          },
        },
      ],
      linerNotes: [
        'Per side, deterministic: the tune and its year ("Sweet Georgia Brown (1925), Bernie, Pinkard and Casey"), key, tempo, feel (straight or swung, `swingView`), the sounds, the density per bar, the A1 tool heard ("an FM bell on the lead").',
        'Across: "Side A at 120 swung, side B at 168 straight; four sounds in B that A does not use."',
        "The learner's line, and the tutor's note only with consent.",
      ],
      tests: [
        "Passing (one per shipped flavour pair): jazz-soul at 132 swung (upright, Rhodes, brushes, vibrato on the lead) against funk at 104 straight (fingerbass, clav, 909, a filter-enveloped bass); pop at 112 (piano, 808, crushed hats) against indie at 140 (cleangtr, acgtr, a phaser on the chords).",
        "Fails: the tune changed in one version (two notes moved: `song-melody-kept`); the two versions at 120 and 130, both straight (`two-versions-differ`, tempo); the same sounds in both (`two-versions-differ`, sounds); a version with no A1 control heard, and one with `.vib(5).vibmod(0)` (the right function, nothing heard); a version whose lead is `.fm(4)` on `piano` (silent FM).",
        "The melody at another octave passes (`pitch-class`); a version that only arranges the A section (16 bars) passes `bars`.",
      ],
      notes: [
        'content/capstones.ts AC1 (author: capstones-sound) needs: `versions: [{ id: "a", label: "Version one", startsIn: "AC1.S1" }, { id: "b", label: "Version two", startsIn: "AC1.S2" }]` (feature `capstone.versions`, planned); the `uses` rule replaced by the A1 `control-set` above; the starter replaced by the song\'s melody and changes (the scaffold\'s `n("0 2 4 2")` is a placeholder and must go); `bpm: [60, 220]`; `song: ["song.sweet-georgia-brown", "song.st-louis-blues"]` read by `GradeContext.songMelody` (carry f4).',
        "Copyright: both compositions are US public domain (1914, 1925); Oak plays its own rendition from the answer key. No recording, arrangement or later lyric is used.",
        "The session engineer's planner: AC1 is three sessions; each is a capstone day (contracts §9.1). The capstone engineer's two-version workspace and `Album.sides` are wave7.md §5 seams.",
      ],
    },
    {
      id: "AC2",
      author: "capstones-sound",
      intent:
        "The track's second capstone and the last new kind of track on the album: a neo-soul ballad. Session 1 writes the changes as ninth and eleventh chords, hand-voiced so the top voice moves smoothly (the choir unlocks as a pad); session 2 lays a swung-16th groove whose snare leans back by a few milliseconds with `.late()`, and a melody; session 3 mixes and releases. It draws on all three tracks: extended chords and voicing (jazz, J2.L03 and J3), the swung 16ths and the laid-back feel (rhythm, R1.L02 and R1.L05), and the sound and the mix (A1–A2).",
      opens:
        'When A.CP is passed or soft-passed and J3.L04 and R1.L05 are completed (contracts §2.6, §4.3; the three-way gate of wave7.md §5). `capstones.gate` lists the conditions with `met`; Today says which lesson is left in one line ("AC2 opens after Walking Bass and Displacement & Laid-Back Feel"). `snd.choir` unlocks at the start of AC2.S1 (a START row).',
      band: "None: the ballad is the learner's whole arrangement (drums, bass, chords, choir, melody). The flavour sets the starter's kit and bass sound; the rubric never changes (contracts §6.6).",
      sections: [
        {
          title: "The rubric (contracts §6.6 AC2, as the content lead settled it; content/capstones.ts AC2)",
          lead: "Every rule reads what is heard; the top-voice rule reads chords written note by note.",
          items: [
            'Required: `custom` `extended-share` `{ harmony: "@chords", minRatio: .6 }` (planned): at least 60% of bars carry a 9th, 11th or 13th. Read from the symbol for a `chord()` line, from the notes for a hand voicing; a rootless hand voicing is read with the root the bass sounds at its onset (grader request: `F♯ A C♯ E` over a D bass is Dmaj9, not F♯m7).',
            'Required: `swing` `{ track: ["hats", "@drums"], subdivision: 16, ratio: [1.2, 2.4] }` (implemented): swung 16ths, `.swingBy(.2, 8)` is 3:2 (`swingRatio(.2)` = 1.5), `.swingBy(1/3, 8)` 2:1.',
            'Required: `voice-leading` `{ track: "@chords", maxMovePerVoice: 2, voice: "top", minRatio: .8 }` (planned feature `voice-leading.top`): the highest note of each chord moves 2 half steps or less on at least 80% of the changes. A `voicing()` chords line fails with a message (contracts §6.7 item 1: a dictionary voicing\'s top note is never graded), so the starter\'s chords are note stacks.',
            'Required: `sounds` `{ contains: ["snd.rhodes"], track: "chords" }` (implemented): the Rhodes plays the chords.',
            'Suggestion: `custom` `microtiming` `{ track: "snare", direction: "late", minMs: 8, maxMs: 45 }` (planned): the snare sits 8–45 ms behind the beat at the piece\'s tempo. At 76 BPM a bar lasts 3.16 s, so `.late(.006)` is 19 ms (inside) and `.late(1/32)` is 99 ms (a displacement: it fails, and the message says so in milliseconds). `.nudge()` is never accepted (contracts §6.6).',
            "Brief: `tempo-bpm` 60–90; `bars` ≥ 8.",
            "Free choice: key, the changes (any chords with 9ths and 11ths; the starter's D major cycle is a suggestion), the voicings (any hand voicing whose top voice moves smoothly), the drums, the melody (any notes; tensions on long notes encouraged, `tensions-used` is a suggestion), the choir or not, the mix.",
          ],
        },
        {
          title: "The starter's changes, hand-voiced (evaluated)",
          lead: "Dmaj9 Em11 F♯m7 Bm9, one a bar, top voice E4 D4 E4 D4 (every change, the loop back included, moves 2 half steps).",
          items: [
            "Dmaj9 `[d3,f#3,a3,c#4,e4]` (D F♯ A C♯ E: the 9th on top)",
            "Em11 `[e3,g3,a3,b3,d4]` (E G A B D: the 11th, A, inside)",
            "F♯m7 `[f#3,a3,c#4,e4]` (F♯ A C♯ E: no extension, so three of four bars carry one, 75%)",
            "Bm9 `[b2,f#3,a3,c#4,d4]` (B F♯ A C♯ D: the 9th, C♯, under the 3rd on top)",
          ],
        },
      ],
      sessions: [
        {
          id: "AC2.S1",
          goal: "maj9/m11 changes and voicings (choir unlocks at the start).",
          opens:
            'The brief and its starter: a tempo line at 76, `chords:` with the four hand voicings above on `rhodes`, `bass: note("<d2 e2 f#2 b1>").s("upright")`, an empty `pad:` line suggesting `choir`, and empty drums. The Coda of the previous day or the session start announces the choir ("The choir is yours from today").',
          hear: "The four chords looping on the Rhodes; the top voice highlighted on the roll as it moves.",
          see: 'The capstone workspace: Workbench with the roll (top-voice line drawn), the chord band reading the symbols the notes spell (Dmaj9 …), the checklist with "A 9th or 11th in 60% of the bars", "The top voice moves by 2 half steps or less", "Rhodes on the chords" live, the S2 lines greyed. Session bar: "Session 1 of 3: Changes and voicings".',
          work: [
            "Keep or rewrite the changes: ninth and eleventh chords, one or two a bar.",
            "Voice them by hand so the top note moves by a step or less; drop the root where the bass has it if you like.",
            "A choir pad under the Rhodes, quiet, its own register (A2.L01).",
          ],
          checks: [
            '`capstones.check`: `extended-share`, `voice-leading` top, `sounds` Rhodes on the chords; swing reads "needs the hats" without blocking.',
            'A `chord("<D^9 Em11 …>").voicing()` line fails `voice-leading` with the message "write these chords note by note to choose their top voice".',
          ],
          ends: 'Draft saved; the Coda says "Next time: the groove that leans back, and a melody".',
          epr: {
            enjoyment:
              "Four lush ninth and eleventh chords on a Rhodes with a choir behind them, voiced by the learner so the top line sings: the sound of neo-soul before a single drum.",
            pace: "One job: the changes and their voicings. Groove and melody are session 2's; the starter's voicings already pass, so the learner can listen and adjust instead of building from nothing.",
            return:
              'The Coda says: your changes are voiced. Next: "the groove that leans back, and a melody".',
          },
        },
        {
          id: "AC2.S2",
          goal: "Swung-16th groove with `.late()` feel; melody.",
          opens: "The S1 draft, with empty `kick:`, `snare:` and `hats:` lines and an empty `mel:` line.",
          hear: "The draft from bar 1; a click-free metronome on request; A/B with the S1 draft.",
          see: 'All checklist lines live; the microtiming lens (wave7.md §4 `Lenses.track.microtiming`) draws each snare\'s offset from the beat in milliseconds. Session bar: "Session 2 of 3: Groove and melody".',
          work: [
            "Hats in 16ths, swung: `.swingBy(.2, 8)` (3:2) or lighter.",
            "Kick and snare; the snare leans back: `.late()` with the decimal for 10–30 ms at the piece's tempo (the brief prints it: 20 ms at 76 BPM is `.late(.006)`).",
            "A melody: long notes on chord tones and tensions, room for the chords.",
          ],
          checks: [
            "The whole rubric; the microtiming suggestion reports the snare's median offset in ms.",
            "Saving never blocks.",
          ],
          ends: 'Draft saved; the Coda says "Next time: mix and release".',
          epr: {
            enjoyment:
              "The ballad grooves: swung hats, a snare that sits just behind the beat, a melody over the chords. The first track that sounds like the records the learner came for.",
            pace: "Two jobs the learner has done before (R1.L02 swing, R1.L05 laid-back feel; a melody over changes since U07): applied, not taught.",
            return: 'The Coda says: groove and melody are in. Next: "mix and release".',
          },
        },
        {
          id: "AC2.S3",
          goal: "Mix and release.",
          opens: "The S2 draft.",
          hear: "The full ballad; A/B with the S2 draft; the release preview.",
          see: 'Every checklist line live; the levels view (`levelsView`) per part; "Review" and "Release" at the end. Session bar: "Session 3 of 3: Mix and release".',
          work: [
            "Levels: the melody on top, the Rhodes and the choir under it, the bass and kick together (A2.L05).",
            "Space: room on the choir and the snare; a side for the Rhodes and the choir.",
            "Release.",
          ],
          checks: [
            "The whole rubric; release once every required line passes and the latest check graded the code being released (decision 45).",
            "The tutor review (`reviewRevisions: 2`) comments on feel and mix and never affects pass or fail.",
          ],
          ends: "Released: album track AC2 with a recording, cover, liner notes and the learner's line. If every capstone is now released and the other conditions of ms.28 hold, the course-complete moment follows (content/milestones.ts ms.28).",
          epr: {
            enjoyment:
              "A finished neo-soul ballad on the album, mixed by the learner: lush chords, a laid-back groove and their own melody.",
            pace: "No new writing: levels, room, release. A mix that is good enough releases; polishing is a revision (v2) later.",
            return:
              "The Coda says: you can write a neo-soul ballad. Next: whatever is left on the Oak, or Studio, where every tool is now yours.",
          },
        },
      ],
      linerNotes: [
        'Deterministic: key, tempo, the changes as symbols (read from the notes), the share of extended chords ("9ths or 11ths in 3 of 4 bars"), the top line ("the top voice moves by a step or less"), the swing ("swung 16ths, about 3:2"), the snare\'s lean in ms ("the snare sits 19 ms behind the beat"), the sounds (Rhodes, choir, upright).',
        "The learner's line; the tutor's note only with consent.",
      ],
      tests: [
        "Passing per flavour: jazz-soul (upright, brushes, Rhodes and choir) and funk (fingerbass, 909 hats swung at .2) with the starter's voicings and a melody; pop and indie with the learner's own changes in E♭ (E♭maj9 Fm11 Gm7 Cm9), hand-voiced so the top voice moves by a step or less.",
        'Fails: the starter\'s chords as `chord("<D^9 Em11 F#m7 Bm9>").voicing()` (top voice not graded: `voice-leading` fails with its message); a voicing whose top leaps on 3 of 4 changes (Dmaj9 top E4, Em11 top A4, F♯m7 top C♯5, Bm9 top D4); triads only (`extended-share` 0%); straight 16th hats (`swing`); the chords on `piano` (`sounds` on chords); the snare at `.late(1/32)` at 76 BPM (the microtiming suggestion fails at 99 ms, the rubric still passes on its required lines); `.nudge()` anywhere (lint: not catalogued).',
      ],
      notes: [
        "content/capstones.ts AC2 (author: capstones-sound) needs: the starter's chords rewritten as the hand voicings above (the scaffold's `chord(...).voicing()` fails its own top-voice rule); the snare's `.late(1/32)` replaced by `.late(.006)` (1/32 of a bar at 76 BPM is 99 ms: a displacement, not a feel); `sounds` with `track: \"chords\"`; the `microtiming` suggestion; `bars` ≥ 8.",
        "Evaluated: `.swingBy(.2, 8)` on `hh*16` plays the off-16ths at 3/5 of each 8th (ratio 1.5); `lateMs(.006, 76)` = 18.9 ms; `lateMs(1/32, 76)` = 98.7 ms. The voicings' top notes are E4 D4 E4 D4 and every chord's pitch classes spell its symbol (Dmaj9 D F♯ A C♯ E; Em11 E G A B D, the 11th without the 9th; F♯m7 F♯ A C♯ E; Bm9 B F♯ A C♯ D).",
        "`snd.choir` is a START row at AC2.S1 (contracts §3.2): the starter may name it in a comment-free empty line only from AC2.S1 on; it is in the brief's suggestions, never required.",
      ],
    },
  ],
};
