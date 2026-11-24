// S1 placeholder: Task 11 replaces it.
//
// Song 1, "the groove song" (docs/design/songs/makes-core-a.md §8, U01): C major, straight, 100 BPM. Oak plays
// every part, and the learner takes over the drums lesson by lesson. The form, the parts and the takeover plan
// follow the proposal; the music is a plain sketch of it, valid for every check (spec §5.1, §8): four flavours with
// the same roots, bass downbeats and tune; Oak's tune and bass sit on chord tones.
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
  { id: "stop", type: "break", bars: 1 },
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

/** One labelled track: a const per section type it plays (`kickVerse`), `silence` where it rests, one arrange(). */
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

/** Verse I–IV, the stop on V, chorus I V vi IV, bridge IV V, the end on I (chords by degree in C3, close voiced). */
const CHORDS = {
  intro: '"<[0,2,4] [0,3,5]>"',
  verse: '"<[0,2,4] [0,3,5]>"',
  break: '"[-1,1,4]"',
  chorus: '"<[0,2,4] [-1,1,4] [0,2,5] [0,3,5]>"',
  bridge: '"<[0,3,5] [-1,1,4]>"',
  outro: '"[0,2,4]"',
};
const ROOTS = {
  intro: '"<0 3>"',
  verse: '"<0 3>"',
  break: '"4"',
  chorus: '"<0 4 5 3>"',
  bridge: '"<3 4>"',
  outro: '"0"',
};

function code(f: FlavourId): string {
  const k = KITS[f];
  const bank = k.bank ? `.bank("${k.bank}")` : "";
  const tracks = [
    track(
      "kick",
      {
        intro: 's("bd ~ ~ ~")',
        verse: 's("bd ~ bd ~")',
        break: 's("bd ~ ~ ~")',
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
        break: `s("${k.crash} ~ ~ ~")`,
        chorus: `s("<${k.crash} ~ ~ ~ ~ ~ ~ ~>")`,
        outro: `s("<${k.crash} ~ ~ ~>")`,
      },
      `${bank}.gain(.45)`,
    ),
    track(
      "bass",
      Object.fromEntries(
        Object.entries(ROOTS).map(([type, roots]) => [
          type,
          `n(${roots}).struct("${type === "break" || type === "outro" ? "x ~ ~ ~" : k.bassGroove}")`,
        ]),
      ),
      `.scale("C2:major").s("${k.bass}").lpf(${k.lpf}).gain(.9)`,
    ),
    track(
      "chords",
      Object.fromEntries(
        Object.entries(CHORDS).map(([type, chords]) => [
          type,
          `n(${chords}).struct("${type === "break" || type === "outro" ? "x ~ ~ ~" : k.comp}")`,
        ]),
      ),
      `.scale("C3:major").s("${k.chords}").gain(.4).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    // The tune sits on chord tones: E G E C over C, F A C A over F; C G E, B G, A E C, A F in the chorus.
    track(
      "mel",
      {
        verse: 'n("<[2 4 2 0] [3 5 7 5]>")',
        chorus: 'n("<[7 ~ 4 2] [6 ~ 4 ~] [5 ~ 2 0] [5 ~ 3 ~]>")',
        bridge: 'n("<[5 ~ ~ ~] [6 ~ ~ ~]>")',
        outro: 'n("<[7 ~ 4 ~] [2 ~ ~ ~] [0 ~ ~ ~] ~>")',
      },
      `.scale("C4:major").s("${k.lead}").gain(.5).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: TakeStep["sections"],
  parts: string[],
  today: string,
): TakeStep => ({ lesson, kind: "take", sections, parts, startFrom: "oak", today });

export const U01_SONG = defineUnitSong({
  id: "usong.U01",
  unit: "U01",
  version: 1,
  title: "The groove song",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
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
    take(
      "U01.L01",
      ["verse"],
      ["kick", "snare"],
      "Your drum line plays the kick and snare in the second part of the song.",
    ),
    take(
      "U01.L02",
      ["stop"],
      ["kick", "snare", "hats"],
      "Your beat with a silent beat in it becomes the short stop before the big part.",
    ),
    take(
      "U01.L03",
      ["verse"],
      ["kick", "snare", "hats"],
      "Kick, snare and hats, one line each, take over the second part.",
    ),
    take(
      "U01.L04",
      ["chorus1", "chorus2"],
      ["kick", "snare", "hats"],
      "Your hats, two to a beat, drive both big parts of the song.",
    ),
    take(
      "U01.L05",
      ["intro", "outro"],
      ["kick", "snare", "hats", "perc"],
      "A crash that rings on opens and closes the song.",
    ),
    take(
      "U01.L06",
      ["chorus2"],
      ["kick", "snare", "hats"],
      "Fast hats, four to a beat, lift the last big part.",
    ),
    take(
      "U01.L07",
      ["verse"],
      ["kick", "snare", "hats", "perc"],
      "A four-bar groove that changes in its last bar takes over the second part.",
    ),
    {
      lesson: "U01.L08",
      kind: "side",
      reason:
        "This lesson counts three to a bar and the song counts four, so this beat stays a sketch of its own.",
    },
    take(
      "U01.L09",
      ["bridge"],
      ["kick", "snare", "hats"],
      "Your slowed-down groove plays the quiet part before the last big part.",
    ),
  ],
  releaseAfter: "U01.CP",
});

export default U01_SONG;
