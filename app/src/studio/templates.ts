// The Studio's song templates (ux §2.3, content/toolbox.ts section A): a whole song to start a sketch from, one
// for each `tb.template.*` row that a capstone's release unlocks. Each starter plays on its own (no Band), uses only
// what the learner has at its unlock site (templates.test.ts lints each one there), and leaves a marked line for
// the learner's own part. Every line is Oak's own; the progressions and forms are the common ones.
import type { SketchCreate } from "@oak/api";
import type { KeySpec, MeterId } from "@oak/content-kit";

export interface StarterSong {
  /** The toolbox row it belongs to. */
  id: string;
  /** What the learner calls it: the row's quoted name. */
  name: string;
  code: string;
  bpm: number;
  meter: MeterId;
  key: KeySpec;
  /** The loop's length: the longest `<…>` alternation, one entry a bar. */
  bars: number;
  /** One sentence: what it is. */
  about: string;
  /** What to listen for and where the learner's own part goes. */
  hint: string;
}

const FOUR_CHORD_POP = [
  "setcpm(100/4)",
  "",
  'kick: s("bd ~ bd ~")',
  'snare: s("~ sd ~ sd")',
  'hats: s("hh*8").gain(.5)',
  'bass: note("<[g1 ~ g1 d2] [d2 ~ d2 a1] [e2 ~ e2 b1] [c2 ~ c2 g1]>").s("ebass").lpf(600)',
  'chords: chord("<G D Em C>").voicing().struct("x ~ ~ x ~ ~ x ~").s("piano").gain(.6)',
  "// Your tune: change these numbers, or write a line of your own",
  'mel: n("<[4 ~ 2 4] [6 4 ~ 1] [2 ~ 0 2] [5 3 ~ ~] [4 ~ 2 4] [6 ~ 8 ~] [7 ~ 5 4] [3 ~ 0 ~]>").scale("G4:major").s("rhodes")',
].join("\n");

const A_BAR = "[a1 a1 e2 a1 g2 a1 f#2 e2]";
const D_BAR = "[d2 d2 a2 d2 c3 d2 b2 a2]";
const E_BAR = "[e2 e2 b2 e2 d3 e2 c#3 b2]";
const TWELVE_BAR_SHUFFLE = [
  "setcpm(100/4)",
  "",
  'const changes = "<A7 D7 A7!2 D7!2 A7!2 E7 D7 A7 E7>"',
  "",
  'kick: s("bd ~ bd ~")',
  'snare: s("~ sd ~ sd")',
  'hats: s("hh*8").swingBy(1/3, 4).gain(.5)',
  `bass: note("<${A_BAR} ${D_BAR} ${A_BAR}!2 ${D_BAR}!2 ${A_BAR}!2 ${E_BAR} ${D_BAR} ${A_BAR} ${E_BAR}>").swingBy(1/3, 4).s("ebass").lpf(700)`,
  'chords: chord(changes).voicing().struct("~ x ~ x").s("piano").gain(.55)',
  "// Your riff: the A blues scale fits all three chords",
  'mel: n("<[~ 0 2 3] [4 3 ~ 0]>").scale("A4:blues").swingBy(1/3, 4).s("piano")',
].join("\n");

const DORIAN_FUNK_VAMP = [
  "setcpm(96/4)",
  "",
  "// D Dorian: D minor with B natural, the bright 6th in G7",
  'kick: s("[bd ~ ~ bd] [~ ~ bd ~] [~ ~ bd ~] ~")',
  'snare: s("~ sd ~ sd")',
  'hats: s("hh*16").gain(.4)',
  'bass: note("<[d2 ~ ~ d2 ~ ~ d3 ~ ~ c3 ~ a2 ~ ~ f2 ~] [g1 ~ ~ g1 ~ ~ g2 ~ ~ f2 ~ d2 ~ b1 ~ ~]>").s("fingerbass")',
  'chords: chord("<Dm7 G7>").voicing().struct("~ ~ x ~ ~ x ~ ~ ~ ~ x ~ ~ x ~ ~").s("cleangtr").gain(.5)',
  "// Your hook: change these numbers, or write a line of your own",
  'mel: n("<[~ ~ 4 ~ 5 ~ 4 2] [5 ~ ~ ~ ~ ~ ~ ~] [~ ~ 4 ~ 5 ~ 7 ~] [5 ~ 4 ~ ~ ~ ~ ~] [~ ~ 4 ~ 5 ~ 4 2] [5 ~ ~ ~ 6 ~ 5 ~] [4 ~ 2 ~ 0 ~ ~ ~] [~ ~ ~ ~ ~ ~ ~ ~]>").scale("D4:dorian").s("rhodes").gain(.8)',
].join("\n");

/** The 12-bar jazz blues in F (J4's chart, the Toolbox demo of the row): trio and a head to rewrite. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd], ~ hh ~ hh").swingBy(1/3, 4).bank("jazzkit")';
const JAZZ_BLUES_F = [
  "setcpm(132/4)",
  "",
  'const changes = "<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]>"',
  "",
  RIDE,
  'chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ x ~ ~").swingBy(1/3, 4).s("rhodes").gain(.55)',
  'bass: chord(changes).rootNotes(2).struct("x x x x").s("upright")',
  "// Your head: the F blues scale fits the whole chorus",
  'mel: n("<[~ 0 1 2] [3 ~ 2 ~] [0 ~ ~ ~] ~>").scale("F4:blues").swingBy(1/3, 4).s("vibes")',
].join("\n");

export const STARTER_SONGS: readonly StarterSong[] = [
  {
    id: "tb.template.four-chord-pop",
    name: "Four-chord pop",
    code: FOUR_CHORD_POP,
    bpm: 100,
    meter: "4/4",
    key: { tonic: "G", mode: "major" },
    bars: 8,
    about: "A pop song in G on I–V–vi–IV (G D Em C), with drums, bass, piano chords and a tune to rewrite.",
    hint: "Four chords, one a bar, round and round: G, D, Em, C. The last line is the tune; rewrite it, or add a line of your own.",
  },
  {
    id: "tb.template.12-bar-shuffle",
    name: "12-bar shuffle",
    code: TWELVE_BAR_SHUFFLE,
    bpm: 100,
    meter: "4/4",
    key: { tonic: "A", mode: "blues" },
    bars: 12,
    about: "A swung 12-bar blues in A on A7, D7 and E7, with a walking shuffle bass and a riff to rewrite.",
    hint: "Twelve bars: A7, a quick bar of D7, two more on A7, two on D7, two on A7, then E7, D7, A7 and E7 to turn round. The hats, bass and riff swing long–short; the riff is yours to rewrite.",
  },
  {
    id: "tb.template.dorian-funk-vamp",
    name: "Dorian funk vamp",
    code: DORIAN_FUNK_VAMP,
    bpm: 96,
    meter: "4/4",
    key: { tonic: "D", mode: "dorian" },
    bars: 8,
    about: "A funk vamp in D Dorian on two chords, Dm7 and G7, with a syncopated bass and a hook to rewrite.",
    hint: "Two chords, a bar each: Dm7 and G7. The bass lands off the beat in sixteenths; the B in G7 is Dorian's bright 6th. The hook is yours to rewrite.",
  },
  {
    id: "tb.template.jazz-blues-f",
    name: "Jazz blues in F",
    code: JAZZ_BLUES_F,
    bpm: 132,
    meter: "4/4",
    key: { tonic: "F", mode: "blues" },
    bars: 12,
    about:
      "The 12-bar jazz blues in F for a swing trio, with ii–Vs in the last four bars and a head to rewrite.",
    hint: "The jazz blues in F, twelve bars: the blues' F7, B♭7 and C7, with a ii–V into bar 5 (Cm7 F7), a passing B°7, and the ii–Vs of the last four bars. Write a head over it, or walk the bass.",
  },
];

export const starterSong = (id: string): StarterSong | null => STARTER_SONGS.find((s) => s.id === id) ?? null;

/** "Four-chord pop", then "Four-chord pop 2", "Four-chord pop 3": never the title of a sketch the learner has. */
export function templateTitle(name: string, existing: readonly { title: string }[]): string {
  const taken = new Set(existing.map((s) => s.title.trim()));
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} ${n}`)) n++;
  return `${name} ${n}`;
}

/** A new free sketch from a template: its code, tempo, meter and key, no Band. */
export function templateSketchBody(song: StarterSong, title: string, sessionId: string | null): SketchCreate {
  return {
    title,
    originKind: "free",
    originId: null,
    sessionId,
    code: song.code,
    bpm: song.bpm,
    meter: song.meter,
    key: song.key,
    band: null,
    analysis: null,
    note: `From the template ${song.name}`,
    tutorAssisted: false,
    ranOk: false,
    flags: { lockedTools: [], previewTools: [] },
  };
}

const MODE_WORDS: Readonly<Record<string, string>> = { blues: "blues", dorian: "Dorian", major: "major" };

/** "G major, 100 BPM, 8 bars": what a template's song is, in a line. */
export function templateDetail(s: StarterSong): string {
  const tonic = s.key.tonic.replace(/(?<=[A-G])b/, "♭").replace("#", "♯");
  return `${tonic} ${MODE_WORDS[s.key.mode] ?? s.key.mode}, ${s.bpm} BPM, ${s.bars} bars`;
}
