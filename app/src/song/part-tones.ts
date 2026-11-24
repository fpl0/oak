// Each part of a unit song has its own colour, the same wherever the song draws it: its row on every song grid and on
// the Make strip, and the cover ring of the take that brought it in (`ringTonesOf`). A part keeps its colour from song
// to song (the melody is always brick, the bass ochre), and no two parts of one song share one: a part whose colour
// another part of the song already holds takes the first one left. SONG_PART_TONES has ten colours, as many as the
// biggest song has parts.
import { SONG_PART_TONES } from "../ui/theme/palette.ts";

/** The colour each common part asks for, as an index into SONG_PART_TONES. */
const WANTS: Readonly<Record<string, number>> = {
  // In the usual row order (tunes, chords, pad, bass, drums) neighbours get far-apart hues.
  lead: 6, // brick
  vox: 7, // green
  riff: 7,
  horns: 9, // rose
  keys: 9,
  gtr: 9,
  chords: 2, // slate
  pad: 3, // mauve
  bass: 4, // ochre
  kick: 8, // indigo
  snare: 1, // olive
  hats: 0, // brown
  perc: 5, // teal blue
  ride: 5,
  cymbals: 5,
};

/** Every part's colour, by part id, in the song's part order. */
export function songPartTones(parts: readonly { id: string }[]): Map<string, string> {
  const taken = new Set<number>();
  const out = new Map<string, string>();
  const pick = (i: number) => {
    taken.add(i);
    return SONG_PART_TONES[i] as string;
  };
  // First the parts whose colour is free, so a part listed later never loses its own colour to a stand-in.
  const later: string[] = [];
  for (const p of parts) {
    const want = WANTS[p.id];
    if (want !== undefined && !taken.has(want)) out.set(p.id, pick(want));
    else later.push(p.id);
  }
  for (const id of later) {
    const free = SONG_PART_TONES.findIndex((_, i) => !taken.has(i));
    // Past ten parts the colours repeat; no song has that many.
    out.set(id, free >= 0 ? pick(free) : (SONG_PART_TONES[out.size % SONG_PART_TONES.length] as string));
  }
  return new Map(parts.map((p) => [p.id, out.get(p.id) as string]));
}

/** One part's colour in its song (the first colour for a part the song does not have). */
export function partToneOf(parts: readonly { id: string }[], id: string): string {
  return songPartTones(parts).get(id) ?? (SONG_PART_TONES[0] as string);
}
