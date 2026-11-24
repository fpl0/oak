// S1 placeholder: Task 11 replaces it.
//
// Song 2, "the riff song" (docs/design/songs/makes-core-a.md §8, U02): C major, straight, 96 BPM, I–IV throughout
// (every U02 Make was tuned to C then F). Oak plays every part, and the learner takes over the tune section by
// section. The form, the parts and the takeover plan follow the proposal; the music is a plain sketch of it, valid
// for every check (spec §5.1, §8): four flavours with the same roots, bass downbeats and tune, all on chord tones.
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const SECTIONS: UnitSongSection[] = [
  { id: "intro", type: "intro", bars: 4 },
  { id: "verse", type: "verse", bars: 8 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "bridge", type: "bridge", bars: 4 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
];

/** Each kit's sounds and production numbers (content/flavours.ts), and how it plays the drums and chords. */
interface Kit {
  bank: string;
  crash: string;
  bass: string;
  chords: string;
  lead: string;
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  comp: string;
  bassGroove: string;
  chorusHats: string;
}
const KITS: Record<FlavourId, Kit> = {
  "flavour.pop": {
    bank: "",
    crash: "cr",
    bass: "ebass",
    chords: "piano",
    lead: "piano",
    room: 0.25,
    lpf: 800,
    chordsPan: 0.42,
    leadPan: 0.58,
    comp: "x x x x",
    bassGroove: "x ~ x ~",
    chorusHats: "hh*8",
  },
  "flavour.indie": {
    bank: "LinnDrum",
    crash: "cr",
    bass: "ebass",
    chords: "cleangtr",
    lead: "acgtr",
    room: 0.3,
    lpf: 750,
    chordsPan: 0.38,
    leadPan: 0.62,
    comp: "x ~ x ~",
    bassGroove: "x ~ x x",
    chorusHats: "hh*8",
  },
  // Jazz-soul stays straight with triads in U01–U02 (content/flavours.ts FLAVOUR_RULES); its kit has no crash.
  "flavour.jazz-soul": {
    bank: "jazzkit",
    crash: "rd",
    bass: "upright",
    chords: "rhodes",
    lead: "vibes",
    room: 0.35,
    lpf: 900,
    chordsPan: 0.4,
    leadPan: 0.6,
    comp: "x ~ ~ [~ x]",
    bassGroove: "x ~ x ~",
    chorusHats: "hh*8",
  },
  "flavour.funk": {
    bank: "RolandTR808",
    crash: "cr",
    bass: "fingerbass",
    chords: "clav",
    lead: "organ",
    room: 0.2,
    lpf: 850,
    chordsPan: 0.42,
    leadPan: 0.58,
    comp: "~ x ~ [~ x]",
    bassGroove: "x ~ [~ x] ~",
    chorusHats: "hh*16",
  },
};

const num = (x: number): string => String(x).replace(/^0\./, ".");
const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;

/** One labelled track: a const per section type it plays (`melVerse`), `silence` where it rests, one arrange(). */
function track(label: string, bySection: Readonly<Record<string, string>>, tail: string) {
  const consts: string[] = [];
  const entries = SECTIONS.map(({ bars, type }) => {
    const pattern = bySection[type];
    if (pattern === undefined) return `[${bars}, silence]`;
    const name = `${label}${cap(type)}`;
    if (!consts.some((c) => c.startsWith(`const ${name} =`))) consts.push(`const ${name} = ${pattern}`);
    return `[${bars}, ${name}]`;
  });
  return { consts, line: `${label}: arrange(${entries.join(", ")})${tail}` };
}

const TYPES = ["intro", "verse", "chorus", "bridge", "outro"] as const;
/** I–IV, a bar each, in every section: chords by degree in C3 (C E G, then C F A), roots in C2. */
const each = (pattern: (type: (typeof TYPES)[number]) => string): Record<string, string> =>
  Object.fromEntries(TYPES.map((t) => [t, pattern(t)]));

function code(f: FlavourId): string {
  const k = KITS[f];
  const bank = k.bank ? `.bank("${k.bank}")` : "";
  const tracks = [
    track(
      "kick",
      {
        intro: 's("bd ~ ~ ~")',
        verse: 's("bd ~ bd ~")',
        chorus: 's("bd ~ [~ bd] ~")',
        bridge: 's("bd ~ ~ ~")',
        outro: 's("bd ~ ~ ~")',
      },
      `${bank}.gain(.75)`,
    ),
    track(
      "snare",
      { verse: 's("~ sd ~ sd")', chorus: 's("~ sd ~ sd")', bridge: 's("~ ~ sd ~")' },
      `${bank}.gain(.7)`,
    ),
    track(
      "hats",
      { intro: 's("hh*4")', verse: 's("hh*8")', chorus: `s("${k.chorusHats}")`, bridge: 's("hh*4")' },
      `${bank}.gain(.4)`,
    ),
    track(
      "perc",
      {
        intro: `s("<${k.crash} ~ ~ ~>")`,
        chorus: `s("<${k.crash} ~ ~ ~ ~ ~ ~ ~>")`,
        outro: `s("<${k.crash} ~ ~ ~>")`,
      },
      `${bank}.gain(.45)`,
    ),
    track(
      "bass",
      each((t) => `n("<0 3>").struct("${t === "outro" ? "x ~ ~ ~" : k.bassGroove}")`),
      `.scale("C2:major").s("${k.bass}").lpf(${k.lpf}).gain(.9)`,
    ),
    track(
      "chords",
      each((t) => `n("<[0,2,4] [0,3,5]>").struct("${t === "outro" ? "x ~ ~ ~" : k.comp}")`),
      `.scale("C3:major").s("${k.chords}").gain(.4).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    // The riff sits on chord tones over C then F: C and its octave; E G E C | F A C A; C G E | A F C.
    track(
      "mel",
      {
        intro: 'n("[0 ~ 7 ~]")',
        verse: 'n("<[2 4 2 0] [3 5 7 5]>")',
        chorus: 'n("<[7 ~ 4 2] [5 ~ 3 0]>")',
        bridge: 'n("<[4 ~ ~ ~] [5 ~ ~ ~]>")',
        outro: 'n("<[7 ~ 4 ~] [5 ~ ~ ~] [4 ~ 2 ~] [0 ~ ~ ~]>")',
      },
      `.scale("C4:major").s("${k.lead}").gain(.5).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: TakeStep["sections"],
  today: string,
  startFrom: TakeStep["startFrom"] = "oak",
): TakeStep => ({ lesson, kind: "take", sections, parts: ["lead"], startFrom, today });

export const U02_SONG = defineUnitSong({
  id: "usong.U02",
  unit: "U02",
  version: 1,
  title: "The riff song",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 96,
  sections: SECTIONS,
  parts: [
    { id: "kick", label: "kick", role: "drums", sounds: ["bd"], name: "Kick", plainName: "Kick" },
    {
      id: "snare",
      label: "snare",
      role: "drums",
      sounds: ["sd", "rim", "cp"],
      name: "Snare",
      plainName: "Snare",
    },
    { id: "hats", label: "hats", role: "drums", sounds: ["hh", "oh"], name: "Hi-hats", plainName: "Hi-hats" },
    {
      id: "perc",
      label: "perc",
      role: "drums",
      sounds: ["cr", "rd", "lt", "mt", "ht", "sh", "cb", "tb"],
      name: "Cymbals and toms",
      plainName: "Cymbals and toms",
    },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  plan: [
    take("U02.L01", ["intro"], "Your high and low notes open the song."),
    take("U02.L02", ["verse"], "Your four-note tune takes over the second part of the song."),
    take(
      "U02.L03",
      ["verse"],
      "Your tune from the last lesson gets one black key, still in the second part.",
      "U02.L02",
    ),
    take("U02.L04", ["chorus1"], "A tune you read off the page takes over the first big part."),
    take("U02.L05", ["chorus2"], "A moved copy of your tune answers in the last big part."),
    take("U02.L06", ["chorus1", "chorus2"], "A second sound doubles your tune in both big parts."),
    take("U02.L07", ["bridge"], "A short call, with room for you to sing back, fills the quiet part."),
    take("U02.L08", ["outro"], "Your tune, with a room sound around it, ends the song."),
  ],
  releaseAfter: "U02.CP",
});

export default U02_SONG;
