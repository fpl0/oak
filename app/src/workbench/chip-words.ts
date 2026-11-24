// The words on a track chip, shared by the Workbench's plain transport and a unit song's Make (lesson/song-make.ts).
// Pure: the tests and the song Make read it without the Workbench.

/**
 * The one rule for a chip's words: a chip names what the learner hears, so it starts with a capital. Where a line is
 * a part of a song (its code label is the part's label), the song Make says the part's name instead: a `kick:` line
 * of today's code is "Kick (today's code)" beside "Kick (yours and Oak)", never "kick (today's code)". A line that is
 * no part of a song keeps the learner's own label with only its first letter raised ("Mel (today's code)", "Drums"),
 * so the learner still finds it in the code by its name.
 */
export function chipName(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** A chip's words without a host label: accompaniment Oak plays says "(Oak)" ("Bass (Oak)"), a learner's line its name. */
export function defaultTrackLabel(track: string): string {
  return track.startsWith("band.") ? `${chipName(track.slice(5))} (Oak)` : chipName(track);
}
