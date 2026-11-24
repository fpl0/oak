// The single unlock table (contracts §3): every tb.*, snd.*, scale.* and chord.* entry, transcribed from
// the tables of §3.2 (groups A to H). This is the ONLY place an unlock is declared (rule 1); lesson files
// are checked against it. content/validate/contracts-sync.test.ts re-parses the contract tables and fails
// on drift; content/validate/toolbox.test.ts evaluates every demo headlessly.
//
// `matches` follows the convention of the toolbox-aware lint (`lintOak` in @oak/grader, contracts §3.3):
// for a function row, the callee or method names it covers (`attack decay sustain release`); for a sound
// row, the sound name inside `s()` or, for a bank row, the `.bank()` argument; for a scale row, the mode
// part of the `.scale()` argument (`harmonic:minor`). Rows without `matches` are reached through their ID
// (`tb.mini.rest` → the `~` operator, `tb.dict.triads`, `tb.mode.root`, chord families through the theory
// table, and the special rows such as `tb.n.chromatic` that the lint detects by form).
import {
  type ChordFamilyId,
  defineToolbox,
  type ExerciseId,
  type ScaleId,
  type SessionId,
  type SoundId,
  type ToolEntry,
  type ToolId,
  type ToolKind,
} from "@oak/content-kit";
import { catalogByTool } from "./catalog/index.ts";
import { ex } from "./catalog/types.ts";

type Id = ToolId | SoundId | ScaleId | ChordFamilyId;
interface Opts {
  when?: "complete" | "start";
  fallbackAt?: SessionId;
  gated?: true;
  preview?: string[];
  matches?: string[];
  audible?: boolean;
  audibility?: { base: string; value: string | number };
  signature?: string;
  meaning?: string;
  demo?: string;
  strudelCc?: string;
}

/**
 * The voicing gate (contracts §3.1 rule 6): rows marked `*` in §3.2. The check is U05.L07's
 * `hand-voiced-cadence`; if it has not passed at 0.9 when U05.L08 starts, U05.L08's first step
 * (`gateCheck`) is the same check regenerated in another key, and a pass there counts too.
 */
export const VOICING_GATE = {
  exercise: "U05.L07/hand-voiced-cadence" as ExerciseId,
  minScore: 0.9,
  unrevealed: true as const,
  variants: ["U05.L08/hand-voiced-cadence-again" as ExerciseId],
};

function row(
  group: string,
  id: Id,
  kind: ToolKind,
  code: string,
  at: SessionId | SessionId[],
  concept: string,
  o: Opts = {},
): ToolEntry {
  const fn = catalogByTool.get(id);
  const catalog: ToolEntry["catalog"] = {
    signature: o.signature ?? fn?.signature ?? code,
    meaning: o.meaning ?? fn?.explanation ?? `${concept[0]?.toUpperCase()}${concept.slice(1)}.`,
    demo: o.demo ?? fn?.example ?? "",
    ...((o.strudelCc ?? fn?.strudelCc) ? { strudelCc: (o.strudelCc ?? fn?.strudelCc) as string } : {}),
  };
  // Only `tb.<name>` rows take their names from the catalog; sub-kind rows are found by ID or by form.
  const derive = fn && (id as string).split(".").length === 2;
  const matches =
    o.matches ?? (derive ? [fn.name, ...(fn.aliases ?? [])].filter((n) => /^[A-Za-z]\w*$/.test(n)) : []);
  return {
    id,
    kind,
    group,
    code,
    unlock: {
      at,
      when: o.when ?? "complete",
      ...(o.gated ? { condition: VOICING_GATE } : {}),
      ...(o.fallbackAt ? { fallbackAt: o.fallbackAt } : {}),
    },
    concept,
    ...(o.preview ? { preview: o.preview } : {}),
    ...(o.audible !== undefined ? { audible: o.audible } : {}),
    ...(o.audibility ? { audibility: o.audibility } : {}),
    catalog,
    ...(matches.length > 0 ? { matches } : {}),
  };
}

const P0 = ["U00.L01"];
const BASE = 'note("c3 e3 g3 c4").s("sawtooth")';
/** Group H row: audible when the S3 harness proved it (spikes/s3-sounds/results/05-audibility.json). */
const h = (
  id: ToolId,
  code: string,
  at: SessionId | SessionId[],
  concept: string,
  value: string | number,
  proven: boolean,
  o: Opts = {},
) =>
  row("H", id, "tool", code, at, concept, {
    audibility: { base: o.audibility?.base ?? BASE, value },
    ...(proven ? { audible: true } : {}),
    ...o,
  });
const feature = (id: ToolId, code: string, at: SessionId, concept: string, o: Opts = {}) =>
  row(
    "A",
    id,
    id.startsWith("tb.lens.") ? "lens" : id.startsWith("tb.template.") ? "template" : "feature",
    code,
    at,
    concept,
    o,
  );
const drum = (name: string, label: string, at: SessionId, concept: string, demo: string, o: Opts = {}) =>
  row("F", `snd.drum.${name}` as SoundId, "sound", `${name} ${label}`, at, concept, {
    matches: [name],
    signature: `s("${name}")`,
    meaning: `The ${label} sound, written \`${name}\`.`,
    demo,
    ...o,
  });
const bank = (name: string, at: SessionId, concept: string, o: Opts = {}) =>
  row("F", `snd.bank.${name}` as SoundId, "sound", `.bank("${name}")`, at, concept, {
    matches: [name],
    signature: `.bank("${name}")`,
    meaning: `Plays the drum sounds of the ${name} drum machine.`,
    demo: ex(100, `drums: s("bd sd bd sd").bank("${name}")`),
    ...o,
  });
const inst = (
  alias: string,
  gm: string,
  at: SessionId | SessionId[],
  concept: string,
  line: string,
  o: Opts = {},
) =>
  row("G", `snd.${alias}` as SoundId, "sound", `${alias} (${gm})`, at, concept, {
    matches: [alias],
    signature: `.s("${alias}")`,
    meaning:
      gm.startsWith("gm_") || gm === "Salamander"
        ? `Oak's ${alias} sound (${gm}).`
        : `Oak's ${alias} sound: ${gm}.`,
    demo: ex(90, line),
    strudelCc: gm.startsWith("gm_") ? `.s("${gm}")` : `.s("${alias}")`,
    ...o,
  });
const wave = (name: string, at: SessionId, concept: string, o: Opts = {}) =>
  row("G", `snd.wave.${name}` as SoundId, "sound", name, at, concept, {
    matches: [name],
    signature: `.s("${name}")`,
    meaning: `The ${name} oscillator: a synth sound with no sample behind it.`,
    demo: ex(90, `mel: note("c3 e3 g3 c4").s("${name}")`),
    ...o,
  });
const scale = (slug: string, names: string[], at: SessionId, concept: string, o: Opts = {}) =>
  row("D", `scale.${slug}` as ScaleId, "scale", names.map((n) => `X4:${n}`).join(", "), at, concept, {
    matches: names,
    signature: `.scale("C4:${names[0]}")`,
    meaning: `The ${slug.replace(/-/g, " ")} scale as the key of an \`n()\` pattern.`,
    demo: ex(90, `mel: n("0 .. 7").scale("C4:${names[0]}").s("piano")`),
    ...o,
  });
const chordFam = (
  slug: string,
  symbols: string[],
  at: SessionId,
  concept: string,
  demo: string,
  o: Opts = {},
) =>
  row("E", `chord.${slug}` as ChordFamilyId, "chord", symbols.join(" "), at, concept, {
    signature: `chord("${symbols[0]}")`,
    meaning: `Chord symbols ${symbols.map((s) => `\`${s}\``).join(" ")} inside \`chord()\`.`,
    demo,
    ...o,
  });

// biome-ignore format: one row to a line, as in the tables of contracts §3.2
export const toolbox: readonly ToolEntry[] = defineToolbox([
  // A. App features, panels and lenses
  feature("tb.feature.transport", "Play / Stop / Run (Ctrl/Cmd+Enter, Ctrl/Cmd+.)", "U00.L01", "making sound"),
  feature("tb.feature.roll", "Piano roll and drum lanes", "U00.L01", "seeing the loop"),
  feature("tb.feature.studio", "Studio (sketchbook, free play)", "U00.L01", "Sketch 001"),
  feature("tb.feature.tutor", "Tutor panel", "U00.L01", "ask about what you hear"),
  feature("tb.feature.band", "Band layer (read-only backing; mute only)", "U00.L01", "your part inside a song"),
  feature("tb.feature.tuner", "Sing panel (PitchLane)", "U00.L02", "first sung tonic"),
  feature("tb.feature.staff", "Staff panel (percussion staff from U01.L05, treble from U02.L04)", "U01.L05", "rhythm values on paper"),
  feature("tb.feature.album", "Album", "C0.S1", "first track", { when: "start" }),
  feature("tb.feature.degree-labels", "1-based degree labels and colours on roll and staff", "U03.L02", "scale degrees", {
    meaning: "Numbers every note by its degree in the key, 1 for home, on the roll and under the staff, and colours it by degree. `n` counts from 0, so the label is always one more than the number in the code.",
    demo: ex(84, 'mel: n("<[0 2 4 2] [3 1 0 ~]>").scale("C4:major").s("piano")'),
  }),
  feature("tb.feature.keysig", "Key-signature panel", "U03.L06", "sharp keys", {
    meaning: "Shows the key signature of the key in your code: the sharps or flats written once at the start of every staff line, in their fixed order (F C G D A E B for sharps).",
    demo: ex(88, 'mel: n("<[0 2 4 6] [7 [6 4] 5 ~]>").scale("D4:major").s("piano")'),
  }),
  feature("tb.feature.circle", "Circle-of-fifths widget", "U03.L07", "flat keys and the circle", {
    meaning: "The twelve major keys in a ring, a fifth apart: each step clockwise adds a sharp, each step the other way adds a flat. Click a key to hear your code in it; the key panel shows its signature.",
    demo: ex(88, 'mel: n("0 2 4 2").scale("<C4:major F4:major Bb3:major Eb4:major>").s("piano")'),
  }),
  feature("tb.feature.solfege", "Solfège label toggle", "U03.L08", "movable do", {
    meaning: "Adds do re mi fa sol la ti under the degree numbers. Do is home in every key, so a tune keeps its syllables when it moves.",
    demo: ex(80, 'mel: n("<[0 1 2 [3 2]] [4 2 0 ~]>").scale("C4:major").s("piano")'),
  }),
  // Carry-over c14 (Wave 5 Foundation): the chord band's and the staff's chord-symbol labels open with chord
  // names (U05.L04), not with `.arp()`; app/src/lib/lenses.ts `CHORD_LENS_UNLOCKS.chordSymbols` reads this row.
  // Contracts 1.6: chord names are U05.L09 "Chord Names", the lesson split out of U05.L04 (which keeps `.arp()`).
  feature("tb.feature.chord-symbols", "Chord-symbol labels (chord band and staff)", "U05.L09", "chord names", {
    meaning: "Names each chord as it sounds with its lead-sheet symbol (C, Am, G7, C/E), in the chord band under the roll and above the staff.",
    demo: ex(90, 'chords: n("<[0,2,4] [5,7,9] [3,5,7] [4,6,8]>").scale("C3:major").s("piano")'),
  }),
  feature("tb.feature.grand-staff", "Bass clef and grand staff", "U05.L06", "low register on paper", {
    meaning: "The staff panel shows low notes on the bass clef, and chords and bass lines on a grand staff: treble on top, bass below, middle C between them. A bass track goes to the bass staff by itself.",
    demo: ex(84, 'chords: note("<[e3,g3,c4] [f3,a3,c4]>").s("piano")', 'bass: note("<c2 f2>").s("piano")'),
  }),
  feature("tb.feature.rn", "Roman-numeral overlay (chord band, RN under staff)", "U06.L02", "Roman numerals", {
    meaning: "A chord band under the roll names each chord as it sounds, by symbol and by Roman numeral in the key (I ii iii IV V vi vii°); the staff shows the numeral under each chord. Inversions show their bass after a slash.",
    demo: ex(90, 'chords: n("<[0,2,4] [5,7,9] [3,5,7] [4,6,8]>").scale("C3:major").s("piano")'),
  }),
  feature("tb.lens.function", "Lens: function bands (T / PD / D)", "U06.L03", "harmonic function", {
    meaning: "Colours each chord by the job it does: home (T), away (PD) or tension that wants home (D), so a progression's journey is visible at a glance.",
    demo: ex(90, 'chords: n("<[0,2,4] [3,5,7] [4,6,8] [0,2,4]>").scale("C3:major").s("piano")'),
  }),
  feature("tb.lens.range", "Lens: range", "U07.L01", "melodic range", {
    meaning: "Marks the lowest and highest note of each melody line and the span between them in half steps, with the high point flagged.",
    demo: ex(90, 'mel: n("<[0 2 4 2] [4 5 7 ~] [5 4 2 1] [0 ~ ~ ~]>").scale("C4:major").s("piano")'),
  }),
  feature("tb.lens.chord-tones", "Lens: chord-tone %", "U07.L03", "chord tones on strong beats", {
    meaning: "Rings every melody note that belongs to the chord under it and shows the share of strong-beat notes that do.",
    demo: ex(90, 'chords: n("<[0,2,4] [3,5,7]>").scale("C3:major").s("piano")', 'mel: n("<[4 2 0 2] [5 3 5 7]>").scale("C4:major").s("piano")'),
  }),
  feature("tb.feature.transcribe", "Transcribe (ladder pattern-source, melody mode, own audio, ±50¢ fine-tune, \"hum it, Oak drafts it\")", "U07.L01", "transcription gym starts", {
    meaning: "Transcribe opens a piece to write down by ear: a hidden ladder loop or your own audio file, with slower playback, transposition, an A–B loop, and A/B between the original and your code at the same bar. Humming a line drafts it as code for you to correct.",
    demo: ex(90, 'mel: n("<[0 2 4 2] [4 ~ 2 ~]>").scale("C4:major").s("piano")'),
  }),
  feature("tb.feature.leadsheet", "Lead-sheet view and export", "U07.L09", "reading lead sheets", {
    meaning: "Shows a piece as a lead sheet: the melody on one staff, chord symbols above it, the pickup bar when there is one. Export it with your sketch or album track.",
    demo: ex(90, 'chords: n("<[0,2,4] [3,5,7]>").scale("C3:major").s("piano")', 'mel: n("<[4 2 0 2] [5 ~ 3 ~]>").scale("C4:major").s("piano")'),
  }),
  feature("tb.lens.form", "Lens: form map", "U09.L02", "sections", {
    meaning: "Draws the sections of an arranged piece over the bars, named from your consts (verse, chorus, bridge) and lettered by first appearance (A B A B), so the song's form is visible at a glance.",
    demo: ex(100, 'const chordsVerse = chord("<C Am F G>").voicing().s("piano")', 'const chordsChorus = chord("<F G C C>").voicing().s("piano")', 'chords: arrange([4, chordsVerse], [4, chordsChorus])'),
  }),
  feature("tb.feature.transcribe.chords", "Transcribe: chords mode", "C4.S1", "chords by ear in your own songs"),
  feature("tb.feature.transcribe.bass", "Transcribe: bass mode", "X2.S1", "bass first"),
  feature("tb.feature.transcribe.full", "Transcribe: full-arrangement mode", "CF-T.S1", "whole-song transcription"),
  feature("tb.feature.jazz-glyphs", "Jazz-glyph chord display toggle (∆ – ø °)", "J1.L02", "reading jazz charts"),
  feature("tb.template.four-chord-pop", "Studio template \"Four-chord pop\"", "C2.S2", "released C2"),
  feature("tb.template.12-bar-shuffle", "Studio template \"12-bar shuffle\"", "C5.S2", "released C5"),
  feature("tb.template.dorian-funk-vamp", "Studio template \"Dorian funk vamp\"", "C6.S2", "released C6"),
  feature("tb.template.jazz-blues-f", "Studio template \"Jazz blues in F\"", "JC2.S2", "released JC2"),

  // B. Core syntax, rhythm functions and mini-notation operators
  row("B", "tb.label", "tool", "lowercase track labels name:", "U00.L01", "each line is a musician"),
  row("B", "tb.s", "tool", 's("…") / sound("…")', "U01.L01", "pulse", { preview: P0, matches: ["s", "sound"] }),
  row("B", "tb.setcpm", "tool", "setcpm(bpm/4)", "U01.L01", "tempo; 1 cycle = 1 bar", { preview: P0 }),
  row("B", "tb.mini.seq", "tool", "space-separated sequence", "U01.L01", "equal slices of the bar", { preview: P0 }),
  row("B", "tb.mini.repeat", "tool", "x*n", "U01.L01", "repeating inside a slot", { preview: P0 }),
  row("B", "tb.mini.rest", "tool", "~", "U01.L02", "rests", { preview: P0 }),
  row("B", "tb.gain", "tool", ".gain(x)", "U01.L02", "accenting the downbeat", { preview: P0, audible: true, audibility: { base: BASE, value: 0.3 } }),
  row("B", "tb.stack", "tool", "stack(a, b)", "U01.L03", "layering"),
  row("B", "tb.bank", "tool", '.bank("RolandTR909")', "U01.L03", "drum-machine timbres", { preview: P0 }),
  row("B", "tb.mini.sub", "tool", "[a b]", "U01.L04", "subdivision", { preview: P0 }),
  row("B", "tb.mini.elongate", "tool", "x@n", "U01.L05", "note lengths"),
  row("B", "tb.mini.hold", "tool", "_", "U01.L05", "note lengths"),
  row("B", "tb.mini.replicate", "tool", "x!n", "U01.L06", "repeated cells"),
  row("B", "tb.mini.alt", "tool", "<a b>", "U01.L07", "bar-level variation, fills", { preview: P0 }),
  row("B", "tb.label.mute", "tool", "_name: (mute a line in code)", "U01.L07", "trying a groove without a part"),
  row("B", "tb.meter.3-4", "tool", "tempo line setcpm(bpm/3)", "U01.L08", "3/4"),
  row("B", "tb.meter.2-4", "tool", "tempo line setcpm(bpm/2) with meter: '2/4'", "U01.L08", "meter as beats per bar"),
  row("B", "tb.slow", "tool", ".slow(n)", "U01.L09", "half-time feel"),
  row("B", "tb.fast", "tool", ".fast(n)", "U01.L09", "double-time feel"),
  row("B", "tb.mini.stack", "tool", 'a, b inside mini-notation ("[c4,e4]", "bd*2, hh*8")', "U04.L03", "harmonic intervals, then chords", { preview: P0 }),
  row("B", "tb.struct", "tool", '.struct("x ~ x x")', "U06.L12", "comping rhythm"),
  row("B", "tb.lastOf", "tool", ".lastOf(n, fn)", "U07.L06", "phrase-level answers"),
  row("B", "tb.firstOf", "tool", ".firstOf(n, fn)", "U07.L06", "phrase-level answers"),
  row("B", "tb.off", "tool", ".off(t, fn)", "U07.L07", "echoes, call and response"),
  row("B", "tb.superimpose", "tool", ".superimpose(fn)", "U07.L07", "doubling a line"),
  row("B", "tb.mini.maybe", "tool", "x?", "U07.L10", "controlled chance in hooks"),
  row("B", "tb.degradeBy", "tool", ".degradeBy(p)", "U07.L10", "controlled chance"),
  row("B", "tb.sometimesBy", "tool", ".sometimesBy(p, fn)", "U07.L10", "controlled chance"),
  row("B", "tb.const", "tool", "const name = pattern", "U08.L04", "bass and kick share one rhythm"),
  row("B", "tb.arrange", "tool", "arrange([bars, pat], …), one per labelled track", "U09.L02", "sections and form"),
  row("B", "tb.signal", "tool", "sine saw perlin", "U09.L04", "energy curves", { matches: ["sine", "saw", "perlin", "cosine", "tri", "square", "rand"] }),
  row("B", "tb.range", "tool", ".range(lo, hi)", "U09.L04", "energy curves"),
  row("B", "tb.segment", "tool", ".segment(n)", "U09.L04", "stepping a curve"),
  row("B", "tb.mask", "tool", '.mask("<1 0>")', "U09.L05", "layer entries and exits"),
  row("B", "tb.swingBy", "tool", ".swingBy(1/3, beatsPerBar)", "U11.L07", "shuffle and swing", { preview: ["U01.L09", "band:jazz-soul", "band:funk"] }),
  row("B", "tb.swing", "tool", ".swing(beatsPerBar)", "U11.L07", "shuffle"),
  row("B", "tb.early", "tool", ".early(t)", "U13.L01", "anticipations"),
  row("B", "tb.late", "tool", ".late(t)", "U13.L01", "pushes; later, laid-back microtiming (R1.L05)"),
  row("B", "tb.velocity", "tool", '.velocity("1 .4")', "U13.L02", "ghost notes", { audible: true, audibility: { base: BASE, value: 0.3 } }),
  row("B", "tb.meter.compound", "tool", "tempo lines setcpm(bpm/2) (6/8), setcpm(bpm/3) (9/8), setcpm(bpm/4) (12/8)", "U13.L04", "compound meter"),
  row("B", "tb.ply", "tool", ".ply(n)", "U13.L05", "rolls, triplet repeats"),
  row("B", "tb.swing.patterned", "tool", '.swingBy("<0 .1 .2 .33>", 4)', "R1.L02", "swing ratios"),
  row("B", "tb.meter.odd", "tool", "tempo lines for 5/4, 5/8, 7/8, irregular 9/8 (STYLE §8)", "R2.L01", "odd meters"),
  row("B", "tb.mini.polymeter", "tool", "{a b c}%n", "R2.L05", "polymeter"),
  row("B", "tb.mini.euclid", "tool", "x(k,n)", "R3.L01", "tresillo, cinquillo"),
  row("B", "tb.mini.euclid-rot", "tool", "x(k,n,r)", "R3.L03", "rotation"),
  row("B", "tb.euclid", "tool", ".euclid(k, n)", "R3.L03", "Euclidean rhythms"),
  row("B", "tb.euclidRot", "tool", ".euclidRot(k, n, r)", "R3.L03", "rotation"),

  // C. Pitch, scales and harmony functions
  row("C", "tb.note", "tool", 'note("…")', "U02.L01", "pitch", { preview: P0 }),
  row("C", "tb.note.names", "tool", "note names with octave (c4 e4)", "U02.L01", "a pitch is written as a letter plus an octave number"),
  row("C", "tb.note.accidentals", "tool", "# and b in note names", "U02.L03", "accidentals"),
  row("C", "tb.transpose", "tool", ".transpose(halfSteps)", "U02.L05", "half-step distance", { matches: ["transpose"] }),
  row("C", "tb.note.midi", "tool", "numeric note(60)", "U02.L05", "MIDI numbers"),
  row("C", "tb.s.pitched", "tool", '.s("…") on pitched patterns', "U02.L01", "an instrument plays the pitch (.s(\"piano\"))", { preview: P0 }),
  row("C", "tb.n", "tool", 'n("…") as scale index', "U03.L02", "degrees: n = degree − 1", { preview: P0, matches: ["n"] }),
  row("C", "tb.scale", "tool", '.scale("C4:major")', "U03.L02", "key as one parameter", { preview: P0 }),
  row("C", "tb.n.range", "tool", "negative and ≥7 n", "U03.L03", "below and above the tonic"),
  row("C", "tb.mini.range", "tool", "a .. b (with spaces)", "U03.L04", "a run of the scale"),
  row("C", "tb.scale.patterned", "tool", '.scale("<C4:major G4:major>")', "U03.L05", "key as a parameter; later, key changes (U17.L02)"),
  row("C", "tb.legato", "tool", ".legato(x)", "U03.L09", "phrasing"),
  row("C", "tb.transpose.interval", "tool", '.transpose("3M")', "U04.L02", "interval names"),
  row("C", "tb.arp", "tool", '.arp("0 1 2 1")', "U05.L04", "chord tones in time"),
  row("C", "tb.chord", "tool", 'chord("<C Am F G>")', "U05.L08", "chord symbols as code", { gated: true, preview: [...P0, "band"] }),
  row("C", "tb.voicing", "tool", ".voicing()", "U05.L08", "automatic voice leading, after doing it by hand", { gated: true, preview: [...P0, "band"] }),
  row("C", "tb.anchor", "tool", '.anchor("c5")', "U05.L08", "where a voicing sits", { gated: true }),
  row("C", "tb.mode.below", "tool", '.mode("below")', "U05.L08", "top note at or below the anchor", { gated: true }),
  row("C", "tb.dict.triads", "tool", '.dict("triads")', "U05.L08", "three-note voicings", { gated: true }),
  row("C", "tb.add", "tool", '.add(n("…")) before .scale()', "U06.L01", "stacking thirds on any degree"),
  row("C", "tb.mode.root", "tool", '.mode("root:g2")', "U06.L11", "root-position voicings with the root at or below a chosen note"),
  row("C", "tb.rev", "tool", ".rev()", "U07.L02", "retrograde"),
  row("C", "tb.scaleTranspose", "tool", ".scaleTranspose(steps) after .scale()", "U07.L02", "sequence"),
  row("C", "tb.rootNotes", "tool", ".rootNotes(2)", "U08.L01", "root bass lines from chords"),
  row("C", "tb.dict.lefthand", "tool", '.dict("lefthand")', "U12.L06", "left-hand piano voicings (mostly rootless, not all)"),
  row("C", "tb.n.chromatic", "tool", 'chromatic steps n("3#") n("6b") n("2b") n("5b") n("1b")', "U15.L01", "chromatic degrees"),
  row("C", "tb.dict.guidetones", "tool", '.dict("guidetones")', "J1.L04", "3rds and 7ths"),
  row("C", "tb.set", "tool", ".set(pattern)", "J1.L05", "one chord pattern drives every part"),
  row("C", "tb.voicing.n", "tool", 'n("0 1 2 3").chord(changes).voicing()', "J1.L05", "shells and arpeggiated voicings"),
  row("C", "tb.dict.ireal-ext", "tool", '.dict("ireal-ext")', "J2.L03", "extended voicings"),
  row("C", "tb.mode.duck", "tool", '.mode("duck")', "J3.L01", "keeping the chord off the melody note"),
  row("C", "tb.offset", "tool", ".offset(n)", "J3.L01", "A/B voicing positions"),

  // D. Scale names
  scale("major", ["major"], "U03.L02", "major scale", { preview: P0, demo: ex(90, 'mel: n("0 1 2 3 4 5 6 4").scale("C4:major").s("piano")') }),
  scale("minor", ["minor", "aeolian"], "U10.L01", "natural minor"),
  scale("harmonic-minor", ["harmonic:minor"], "U10.L06", "raised 7"),
  scale("melodic-minor", ["melodic:minor"], "U10.L08", "raised 6 and 7"),
  scale("major-pentatonic", ["major:pentatonic"], "U11.L01", "five notes"),
  scale("minor-pentatonic", ["minor:pentatonic"], "U11.L02", "riffs"),
  scale("blues", ["blues"], "U11.L03", "blue notes"),
  scale("mixolydian", ["mixolydian"], "U14.L01", "♭7 colour"),
  scale("dorian", ["dorian"], "U14.L03", "♮6 colour"),
  scale("lydian", ["lydian"], "U14.L04", "♯4 colour"),
  scale("phrygian", ["phrygian"], "U14.L05", "♭2 colour"),
  scale("locrian", ["locrian"], "J2.L04", "chord-scale for m7♭5"),
  scale("altered", ["altered"], "J2.L04", "chord-scale for 7alt"),
  scale("lydian-dominant", ["lydian:dominant"], "J2.L04", "chord-scale for 7♯11"),
  scale("bebop", ["bebop", "bebop:major"], "J2.L04", "passing-tone scales"),

  // E. Chord-symbol families
  chordFam("triad", ["C", "Cm", "Co", "Caug"], "U05.L08", "triads", ex(90, 'chords: chord("<C Am F G>").voicing().s("piano")'), { gated: true, preview: [...P0, "band"] }),
  chordFam("dom7", ["C7"], "U11.L04", "dominant seventh", ex(90, 'chords: chord("<C7 F7>").voicing().s("piano")'), { preview: ["band:jazz-soul"] }),
  chordFam("seventh", ["C^7", "Cm7"], "U12.L01", "major and minor sevenths", ex(90, 'chords: chord("<C^7 Am7 Dm7 G7>").voicing().s("piano")'), { preview: ["band:jazz-soul"] }),
  chordFam("seventh-dim", ["Cm7b5", "Co7"], "U12.L03", "half-diminished and diminished sevenths", ex(90, 'chords: chord("<Bm7b5 Co7>").voicing().s("piano")')),
  chordFam("sixth-sus", ["C6", "Cm6", "C69", "Csus", "C7sus", "C2", "Cadd9"], "J1.L02", "sixths, sus and add chords", ex(90, 'chords: chord("<C6 Cm6 C69 G7sus>").voicing().s("piano")')),
  chordFam("alt", ["C7b9", "C7#9", "C7#11", "C7b13", "C7alt", "Cm^7"], "J2.L02", "altered dominants; the tonic colours of the minor ii–V–i", ex(90, 'chords: chord("<Dm7b5 G7b9 Cm^7 Cm^7>").voicing().s("piano")')),
  chordFam("ext", ["C^9", "Cm9", "C9", "C13", "Cm11"], "J2.L03", "extensions", ex(90, 'chords: chord("<Dm9 G13 C^9 C^9>").voicing().s("piano")')),

  // F. Drum sounds and banks
  drum("bd", "kick", "U01.L01", "pulse", ex(96, 'drums: s("bd bd bd bd")'), { preview: P0 }),
  drum("sd", "snare", "U01.L01", "pulse", ex(96, 'drums: s("bd sd bd sd")'), { preview: P0 }),
  drum("hh", "closed hat", "U01.L01", "pulse", ex(96, 'drums: s("hh*8")'), { preview: P0 }),
  drum("cp", "clap", "U01.L01", "pulse", ex(96, 'drums: s("bd cp bd cp")')),
  drum("rim", "rimshot", "U01.L01", "pulse", ex(96, 'drums: s("bd rim bd rim")')),
  drum("oh", "open hat", "U01.L02", "accents", ex(96, 'drums: s("hh hh oh ~")')),
  drum("cr", "crash", "U01.L02", "marking the downbeat", ex(96, 'drums: s("cr hh hh hh")')),
  drum("rd", "ride", "U01.L02", "a second timekeeper", ex(96, 'drums: s("rd rd rd rd")')),
  bank("RolandTR909", "U01.L03", "drum-machine timbre"),
  bank("RolandTR808", "U01.L03", "drum-machine timbre", { preview: P0 }),
  drum("lt", "low tom", "U01.L06", "fills", ex(96, 'drums: s("ht ht mt mt lt lt ~ ~")')),
  drum("mt", "mid tom", "U01.L06", "fills", ex(96, 'drums: s("ht ht mt mt lt lt ~ ~")')),
  drum("ht", "high tom", "U01.L06", "fills", ex(96, 'drums: s("ht ht mt mt lt lt ~ ~")')),
  bank("LinnDrum", "U01.L09", "copying grooves"),
  bank("AkaiLinn", "U01.L09", "copying grooves"),
  bank("RolandTR707", "U01.L09", "copying grooves"),
  drum("sh", "shaker", "U01.L09", "percussion colour", ex(96, 'drums: s("sh*8")')),
  drum("cb", "cowbell", "U01.L09", "percussion colour", ex(96, 'drums: s("cb ~ cb cb")')),
  drum("tb", "tambourine", "U01.L09", "percussion colour", ex(96, 'drums: s("~ tb ~ tb")')),
  row("F", "snd.jazzkit", "sound", '.bank("jazzkit") (Oak kit: brushes, ride)', "J1.L01", "swing feel", { preview: ["band:jazz-soul"], matches: ["jazzkit"], signature: '.bank("jazzkit")', meaning: "Oak's jazz kit: brushes and a ride cymbal.", demo: ex(120, 'drums: s("bd ~ sd ~, rd*4").bank("jazzkit")') }),
  row("F", "snd.brk", "sound", "brk (CC0 break loop rendered by Oak)", "A2.L04", "sampling", { matches: ["brk"], signature: 's("brk")', meaning: "A one-bar drum break, rendered by Oak and free to use (CC0).", demo: ex(90, 'drums: s("brk").loopAt(1)') }),
  // Sound pack v4 (docs/design/samples/proposal.md §5.2): Oak's CC0 kits, the rendered breaks, hand percussion, foley.
  row("F", "snd.oak909", "sound", '.bank("oak909") (Oak\'s synthesised 909-style machine, CC0)', "U01.L03", "drum-machine timbre", { matches: ["oak909"], signature: '.bank("oak909")', meaning: "Oak's own 909-style drum machine, synthesised by Oak (CC0).", demo: ex(124, 'drums: s("bd cp bd cp").bank("oak909")') }),
  row("F", "snd.oak808", "sound", '.bank("oak808") (Oak\'s synthesised 808-style machine, CC0)', "U01.L03", "drum-machine timbre", { matches: ["oak808"], signature: '.bank("oak808")', meaning: "Oak's own 808-style drum machine, synthesised by Oak (CC0).", demo: ex(96, 'drums: s("bd sd bd sd").bank("oak808")') }),
  row("F", "snd.rockkit", "sound", '.bank("rockkit") (Big Rusty Drums, CC0)', "U01.L09", "copying grooves", { matches: ["rockkit"], signature: '.bank("rockkit")', meaning: "A big vintage rock kit played with sticks (Karoryfer Big Rusty Drums, CC0).", demo: ex(100, 'drums: s("bd sd bd sd").bank("rockkit")') }),
  row("F", "snd.lofikit", "sound", '.bank("lofikit") (a lo-fi kit from Virtuosity Drums, CC0)', "U01.L09", "copying grooves", { matches: ["lofikit"], signature: '.bank("lofikit")', meaning: "A dusty lo-fi kit: a jazz kit's lo-fi microphone through Oak's lo-fi chain (CC0).", demo: ex(80, 'drums: s("bd sd bd sd").bank("lofikit")') }),
  drum("clave", "claves", "R3.L02", "clave direction", ex(100, 'perc: s("clave ~ ~ clave ~ ~ clave ~ ~ ~ clave ~ clave ~ ~ ~")')),
  drum("conga", "conga", "R3.L04", "the tumbao layer", ex(100, 'perc: s("~ ~ conga conga ~ ~ conga ~")')),
  drum("bongo", "bongos", "R3.L04", "the tumbao layer", ex(100, 'perc: s("bongo*8")')),
  row("F", "snd.breaks", "sound", "brkfunk brkboombap brkjungle brkhouse brkjazz brklofi (CC0 breaks rendered by Oak)", "A2.L04", "choosing and fitting breaks", { matches: ["brkfunk", "brkboombap", "brkjungle", "brkhouse", "brkjazz", "brklofi"], signature: 's("brkfunk")', meaning: "Two-bar drum breaks, each at its own tempo (funk 100, boom-bap 90, jungle 170, house 124, jazz 140, lo-fi 80), rendered by Oak (CC0).", demo: ex(100, 'drums: s("brkfunk").loopAt(2)') }),
  row("F", "snd.foley", "sound", "foley snap impact swoosh scratch drone (CC0 one-shots)", "A2.L04", "chopping one-shots", { matches: ["foley", "snap", "impact", "swoosh", "scratch", "drone"], signature: 's("foley")', meaning: "Found sounds, snaps, hits, sweeps, vinyl scratches and drones from Sonic Pi's CC0 samples.", demo: ex(100, 'fx: s("foley*4").chop(2)') }),
  row("F", "snd.textures", "sound", "vinyl tape (texture beds)", "A1.L05", "lo-fi colour", { matches: ["vinyl", "tape"], signature: 's("vinyl")', meaning: "Background beds: vinyl surface noise and tape hiss.", demo: ex(80, 'fx: s("vinyl")') }),
  row("F", "snd.sbd", "sound", "sbd (a synthesised kick)", "A1.L03", "a kick is a falling sine", { matches: ["sbd"], signature: 's("sbd")', meaning: "A kick drum made by a synth: a sine whose pitch falls fast.", demo: ex(100, 'drums: s("sbd ~ sbd ~")') }),

  // G. Pitched instruments (Oak aliases) and synth waves
  inst("piano", "Salamander", "U02.L01", "pitch", 'mel: note("c4 e4 g4 c5").s("piano")', { preview: P0 }),
  wave("sine", "U02.L06", "timbre"),
  wave("triangle", "U02.L06", "timbre"),
  wave("square", "U02.L06", "timbre"),
  wave("sawtooth", "U02.L06", "timbre"),
  inst("ebass", "a real bass guitar, picked (FreePats Bass Guitar YR, CC0)", "C1.S1", "a real bass for the first loop", 'bass: note("c2 c2 g1 bb1").s("ebass").lpf(600)', { when: "start", fallbackAt: "U03.L03", preview: [...P0, "band"] }),
  inst("acgtr", "gm_acoustic_guitar_steel:5", "U03.L11", "folk melody colour", 'mel: n("0 2 4 7").scale("G3:major").s("acgtr")'),
  inst("upright", "a double bass played pizzicato (Karoryfer Sneakybass, CC0)", "U05.L06", "bass register and bass clef", 'bass: note("c2 e2 g2 e2").s("upright")', { preview: ["band:jazz-soul"] }),
  inst("rhodes", "a 1977 Rhodes Mark I (jRhodes3d by Jeff Learman, CC BY 4.0)", "U05.L08", "voiced chords", 'chords: chord("<C Am F G>").voicing().s("rhodes")', { gated: true, preview: [...P0, "band"] }),
  inst("organ", "a drawbar tonewheel organ (FreePats setBfree renders, CC0)", "U05.L08", "voiced chords", 'chords: chord("<C F>").voicing().s("organ")', { gated: true }),
  inst("pad", "gm_pad_warm", "U06.L06", "sustained harmony for schemas", 'pad: chord("<C G Am F>").voicing().s("pad")'),
  inst("fingerbass", "a real bass guitar, fingered (FreePats Bass Guitar YR, CC0)", "U08.L05", "bass tone", 'bass: note("c2 ~ c2 g1").s("fingerbass").lpf(800)', { preview: ["band:funk"] }),
  row("G", "tb.template.synthbass", "template", 'recipe note("…").s("sawtooth").lpf(600)', "U08.L05", "synth bass"),
  inst("strings", "cello, viola and violin sections (VSCO 2 CE, CC0)", "U10.L09", "minor-ballad texture", 'pad: n("[0,2,4]").scale("A3:minor").s("strings")'),
  inst("crunch", "gm_overdriven_guitar:0", "U11.L03", "blues and rock riffs", 'gtr: n("0 2 3 4").scale("E3:blues").s("crunch")'),
  inst("jazzgtr", "an archtop guitar on its pickup (Karoryfer Shinyguitar, CC0)", "U12.L06", "seventh-chord comping", 'chords: chord("<Dm7 G7 C^7 C^7>").voicing().s("jazzgtr")'),
  inst("cleangtr", "a clean electric guitar (FreePats FSBS Clean, CC0)", "U13.L02", "16th grooves", 'gtr: n("[0 2 4 2]*2").scale("C4:major").s("cleangtr")', { preview: ["band:indie"] }),
  inst("horns", "gm_brass_section:3", ["U15.L05", "RC1.S2"], "stabs on dominant chains; funk stabs", 'horns: chord("<E7 A7 D7 G7>").voicing().struct("x ~ ~ x").s("horns")'),
  inst("trumpet", "a real trumpet (VSCO 2 CE, CC0)", "U15.L05", "lead line", 'mel: n("4 3 2 0").scale("C4:major").s("trumpet")'),
  inst("tenor", "a real tenor saxophone (VCSL, CC0)", "U16.L05", "melody voice for mixture", 'mel: n("4 5 4 2").scale("C4:major").s("tenor")', { strudelCc: '.s("sax")' }),
  inst("vibes", "a vibraphone, soft and hard mallets (VCSL, CC0)", "J1.L01", "swing", 'mel: n("0 2 4 6").scale("C4:major").s("vibes")', { preview: ["band:jazz-soul"], strudelCc: '.s("vibraphone")' }),
  inst("mutetpt", "a trumpet with a harmon mute (VSCO 2 CE, CC0)", "J4.L02", "jazz-blues head", 'mel: n("0 2 3 4").scale("F4:blues").s("mutetpt")'),
  inst("clav", "gm_clavinet", "R1.L03", "funk", 'keys: chord("<Cm7 F7>").voicing().struct("~ x ~ x").s("clav")', { preview: ["band:funk"] }),
  inst("choir", "gm_choir_aahs:0", "AC2.S1", "neo-soul pad", 'pad: chord("<D^9 Em11>").voicing().s("choir")', { when: "start" }),
  wave("supersaw", "A1.L07", "thick synth source"),
  inst("marimba", "a marimba (VCSL, CC0)", "A2.L06", "idiomatic timbres", 'mel: n("0 2 4 7").scale("C4:major").s("marimba")', { strudelCc: '.s("marimba")' }),
  inst("kalimba", "a kalimba (VCSL, CC0)", "A2.L06", "idiomatic timbres", 'mel: n("0 2 4 7").scale("C4:major").s("kalimba")', { strudelCc: '.s("kalimba")' }),
  inst("glockenspiel", "a glockenspiel (VCSL, CC0)", "A2.L06", "idiomatic timbres", 'mel: n("0 2 4 7").scale("C5:major").s("glockenspiel")', { strudelCc: '.s("glockenspiel")' }),
  row("G", "snd.noise", "sound", "white pink brown crackle (noise sources)", "A1.L02", "noise is the clearest thing to filter", { matches: ["white", "pink", "brown", "crackle"], signature: 's("pink")', meaning: "Noise: every frequency at once (white is bright, pink and brown darker, crackle is sparse clicks).", demo: ex(100, 'fx: s("pink*4").lpf(1200)') }),
  row("G", "snd.wt", "sound", "wt_basic wt_organ wt_epiano wt_bass wt_fm wt_chip wt_voice wt_clav wt_morph wt_pwm wt_drawbar wt_fmsweep (wavetables)", "A1.L01", "a wave is one repeating cycle", { matches: ["wt_basic", "wt_organ", "wt_epiano", "wt_bass", "wt_fm", "wt_chip", "wt_voice", "wt_clav", "wt_morph", "wt_pwm", "wt_drawbar", "wt_fmsweep"], signature: 's("wt_organ")', meaning: "Wavetables: a stored single cycle played as an oscillator (AKWF CC0 cycles, and Oak's morphing tables).", demo: ex(90, 'mel: note("c3 e3 g3 c4").s("wt_organ")') }),
  wave("pulse", "A1.L07", "pulse width"),

  // H. Effects and sound controls (audible: true only where the S3 harness proved it)
  h("tb.room", ".room(x)", "U02.L08", "the sound of a space", 0.6, true, { preview: ["band"] }),
  h("tb.clip", ".clip(x)", "U02.L08", "short vs long notes", 0.3, true),
  h("tb.lpf", '.lpf(hz) (taught as the bass preset .lpf(600))', ["C1.S1", "A1.L02"], "a darker bass; filters", 400, true, { when: "start", fallbackAt: "U03.L03", preview: [...P0, "band"] }),
  h("tb.delay", ".delay(x)", ["U10.L09", "A1.L04"], "echo for ballads; space", 0.5, true),
  h("tb.distort", ".distort(x)", ["U11.L03", "A1.L05"], "grit for riffs", 2, true),
  h("tb.pan", ".pan(x)", ["U14.L06", "A2.L05"], "stereo space; the mix", 0, true, { preview: ["band"] }),
  h("tb.jux", ".jux(fn)", "U14.L06", "stereo doubling", "rev", true),
  h("tb.scope", ".scope() → Oak scope panel (never Strudel's canvas)", "A1.L01", "seeing a wave", "", false),
  h("tb.partials", ".partials([…]) †", "A1.L01", "the harmonic series", "[1, .5, .3]", true),
  h("tb.hpf", ".hpf(hz)", "A1.L02", "filters", 2000, true),
  h("tb.bpf", ".bpf(hz)", "A1.L02", "filters", 800, true),
  h("tb.lpq", ".lpq(q)", "A1.L02", "resonance", 12, true, { audibility: { base: `${BASE}.lpf(600)`, value: 12 } }),
  h("tb.lpenv", ".lpenv(depth) with .lpa() .lpd() .lps() .lpr()", "A1.L02", "filter envelope", 4, true, { audibility: { base: `${BASE}.lpf(300)`, value: 4 }, matches: ["lpenv", "lpa", "lpd", "lps", "lpr"] }),
  h("tb.adsr", ".attack() .decay() .sustain() .release()", "A1.L03", "envelopes", 0.1, true),
  h("tb.roomsize", ".roomsize(x)", "A1.L04", "reverb size", 6, true, { audibility: { base: `${BASE}.room(.5)`, value: 6 } }),
  h("tb.delaytime", ".delaytime(x)", "A1.L04", "delay time", 0.25, true, { audibility: { base: `${BASE}.delay(.5)`, value: 0.25 } }),
  h("tb.delayfeedback", ".delayfeedback(x)", "A1.L04", "delay repeats", 0.6, true, { audibility: { base: `${BASE}.delay(.5)`, value: 0.6 } }),
  h("tb.orbit", ".orbit(n)", "A1.L04", "separate effect buses", 2, true),
  h("tb.crush", ".crush(bits)", "A1.L05", "bit reduction", 4, true),
  h("tb.coarse", ".coarse(n)", "A1.L05", "sample-rate reduction", 8, true),
  h("tb.distorttype", '.distorttype("…") †', "A1.L05", "saturation flavours", "diode", true, { audibility: { base: `${BASE}.distort(2)`, value: "diode" } }),
  h("tb.ftype", '.ftype("ladder")', "A1.L02", "resonance: the ladder filter's squelch", "ladder", true, { audibility: { base: `${BASE}.lpf(500).lpq(15)`, value: "ladder" }, matches: ["ftype"], demo: ex(120, 'bass: note("c2 c2 eb2 g1").s("sawtooth").lpf(500).lpq(16).ftype("ladder")') }),
  h("tb.penv", ".penv(st) .pattack() .pdecay()", "A1.L03", "pitch envelope", 24, true, { audibility: { base: 'note("c2 ~ c2 ~").s("sine").decay(.4).sustain(0)', value: 24 }, matches: ["penv", "pattack", "pdecay"], demo: ex(100, 'drums: note("c2 ~ c2 ~").s("sine").penv(24).pdecay(.08).decay(.4).sustain(0)') }),
  h("tb.drive", ".drive(x)", "A1.L05", "saturation", 3, true, { audibility: { base: `${BASE}.lpf(800).ftype("ladder")`, value: 3 }, matches: ["drive"], demo: ex(120, 'bass: note("c2 c2 eb2 g1").s("sawtooth").lpf(600).lpq(12).ftype("ladder").drive(3)') }),
  h("tb.density", ".density(x)", "A1.L05", "crackle density", 0.3, true, { audibility: { base: 's("crackle")', value: 0.3 }, matches: ["density"], demo: ex(80, 'fx: s("crackle").density(.3)') }),
  h("tb.vib", ".vib(hz) and .vibmod(depth)", "A1.L06", "vibrato", 6, true),
  h("tb.wt", ".wt(x) .wtenv() .wtrate() .wtdepth()", "A1.L06", "timbre that moves", 0.8, true, { audibility: { base: 'note("c3 e3 g3 c4").s("wt_morph")', value: 0.8 }, matches: ["wt", "wtenv", "wtrate", "wtdepth"], demo: ex(90, 'pad: note("c3 e3 g3 c4").s("wt_morph").wtrate(1).wtdepth(1)') }),
  h("tb.phaser", ".phaser(speed)", "A1.L06", "phaser", 4, true),
  h("tb.tremolo", ".tremolosync(n) .tremolodepth(x) †", "A1.L06", "tremolo", 4, true),
  h("tb.lpmod", ".lprate() .lpdepth() †", "A1.L06", "filter LFO", 2, true, { audibility: { base: `${BASE}.lpf(500)`, value: 2 } }),
  h("tb.fm", ".fm(index) and .fmh(ratio)", "A1.L07", "FM", 4, true),
  h("tb.unison", ".unison(n) .detune(x) .spread(x)", "A1.L07", "supersaw shaping", 5, true, { audibility: { base: 'note("c3 e3 g3 c4").s("supersaw")', value: 5 } }),
  h("tb.pw", ".pw(x)", "A1.L07", "pulse width", 0.2, true, { audibility: { base: 'note("c3 e3 g3 c4").s("pulse")', value: 0.2 } }),
  h("tb.fscope", ".fscope() → Oak spectrum panel", "A2.L01", "frequency space", "", false),
  h("tb.chop", ".chop(n) .slice(n, pat) .splice(n, pat) .striate(n)", "A2.L04", "chopping", 8, true, { audibility: { base: 's("brk")', value: 8 } }),
  h("tb.loopAt", ".loopAt(bars)", "A2.L04", "fitting a loop to the bar", 2, true, { audibility: { base: 's("brk")', value: 2 } }),
  h("tb.speed", ".speed(x) .begin(x) .end(x)", "A2.L04", "sample playback", 2, true, { audibility: { base: 's("piano")', value: 2 } }),
  h("tb.compressor", '.compressor("…")', "A2.L05", "dynamics", "-20:4:10:.002:.1", true),
  h("tb.postgain", ".postgain(x)", "A2.L05", "level after effects", 0.3, true),
  h("tb.duck", ".duckorbit(n) .duckdepth(x) †", "A2.L05", "sidechain feel", 2, true),
]);
export default toolbox;

export const toolboxById: ReadonlyMap<string, ToolEntry> = new Map(toolbox.map((t) => [t.id, t] as const));

/** Every session an entry names (its sites and its fallback). */
export function unlockSites(entry: ToolEntry): SessionId[] {
  const at = Array.isArray(entry.unlock.at) ? entry.unlock.at : [entry.unlock.at];
  return entry.unlock.fallbackAt ? [...at, entry.unlock.fallbackAt] : at;
}

/** Controls that are known silent no-ops in superdough: never taught, never unlocked (rule 7). */
export const SILENT_CONTROLS = ["leslie", "lrate", "lsize", "amp", "squiz", "triode", "ring"] as const;
/** Visual methods: stubbed to identity everywhere and a lint error in authored content (rule 9). */
export const VISUAL_METHODS = [
  "pianoroll",
  "punchcard",
  "spiral",
  "pitchwheel",
  "_scope",
  "_pianoroll",
] as const;
