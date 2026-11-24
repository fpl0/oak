// A small unit song for the app's song tests (not content): a 4/4 song in C, five sections (intro, verse, a one-bar
// stop, two choruses) and five parts, valid for `defineUnitSong` in all four flavours. Self-contained, so the tests
// do not move when the real songs in content/unit-songs are rewritten.
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type LessonId,
  type UnitSongDef,
  type UnitSongDetail,
  type UnitSongTake,
} from "@oak/api";

const CODE = [
  'const kickIntro = s("bd ~ ~ ~")',
  'const kickVerse = s("bd ~ bd ~")',
  'const kickBreak = s("bd ~ ~ ~")',
  'const kickChorus = s("bd ~ bd bd")',
  'const snareVerse = s("~ sd ~ sd")',
  'const snareChorus = s("~ sd ~ sd")',
  'const hatsVerse = s("hh*4")',
  'const hatsChorus = s("hh*8")',
  'const bassVerse = n("<0 3>")',
  'const bassChorus = n("<0 4 5 3>")',
  'const melChorus = n("<[4 2] [4 5]>")',
  "",
  "kick: arrange([4, kickIntro], [8, kickVerse], [1, kickBreak], [8, kickChorus], [8, kickChorus])",
  "snare: arrange([4, silence], [8, snareVerse], [1, silence], [8, snareChorus], [8, snareChorus])",
  "hats: arrange([4, silence], [8, hatsVerse], [1, silence], [8, hatsChorus], [8, hatsChorus])",
  'bass: arrange([4, silence], [8, bassVerse], [1, silence], [8, bassChorus], [8, bassChorus]).scale("C2:major").s("ebass")',
  'mel: arrange([4, silence], [8, silence], [1, silence], [8, melChorus], [8, melChorus]).scale("C4:major").s("piano")',
].join("\n");

export const TEST_SONG: UnitSongDef = defineUnitSong({
  id: "usong.U01",
  unit: "U01",
  version: 1,
  title: "The test song",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: [
    { id: "intro", type: "intro", bars: 4 },
    { id: "verse", type: "verse", bars: 8 },
    { id: "stop", type: "break", bars: 1 },
    { id: "chorus1", type: "chorus", bars: 8 },
    { id: "chorus2", type: "chorus", bars: 8 },
  ],
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
    { id: "hats", label: "hats", role: "drums", sounds: ["hh", "oh"], name: "Hats", plainName: "Hats" },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
    {
      id: "lead",
      label: "mel",
      role: "melody",
      name: "Counter-melody",
      plainName: "Tune",
      termId: "term.counter-melody",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, CODE])) as UnitSongDef["code"],
  plan: [
    {
      lesson: "U01.L01",
      kind: "take",
      sections: ["verse"],
      parts: ["kick", "snare"],
      startFrom: "oak",
      today: "Your drum line plays the kick and snare in the second part of the song.",
    },
    {
      lesson: "U01.L02",
      kind: "take",
      sections: ["chorus1", "chorus2"],
      parts: ["kick", "snare", "hats"],
      startFrom: "U01.L01",
      today: "Your beat drives both big parts of the song.",
    },
    {
      lesson: "U01.L03",
      kind: "side",
      reason: "This lesson counts three to a bar, so its beat stays a sketch of its own.",
    },
  ],
  releaseAfter: "U01.CP",
});

/** A take of the test song as `songs.get` returns it. */
export function testTake(
  id: number,
  lessonId: string,
  code: string,
  cells: string[],
  extra: Partial<UnitSongTake> = {},
): UnitSongTake {
  return {
    id,
    lessonId: lessonId as LessonId,
    sketchId: `sk_${id}`,
    sketchVersion: 1,
    code,
    cells,
    labels: {},
    bpm: 100,
    backfilled: false,
    reviewBeforeRun: false,
    createdAt: `2026-11-2${id}T10:00:00.000Z`,
    ...extra,
  };
}

/** The test song as `songs.get` returns it, with these takes. */
export function testDetail(takes: UnitSongTake[], extra: Partial<UnitSongDetail> = {}): UnitSongDetail {
  return {
    unitId: "U01",
    songId: "usong.U01",
    songVersion: 1,
    contentVersion: 1,
    flavour: "flavour.indie",
    title: "My groove",
    status: "open",
    changedSinceRelease: false,
    releasable: false,
    backfilled: false,
    styleSeen: true,
    takesCount: takes.length,
    releases: [],
    takes,
    ...extra,
  };
}
