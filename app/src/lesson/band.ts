// The Band a step plays under the learner's part (contracts §3.4): the content's `BandRef` resolved to the
// Workbench's `BandSetup` in the learner's flavour (pop when the Band has none for it), with the key and tempo
// filled in, and the stage the Band has reached at this point of the course (contracts §5.10: jazz-soul plays
// four-note chords and swings from U03 on). A checkpoint's Make plays the Band content/checkpoints.ts names for it
// (`CHECKPOINT_MAKE_BANDS`), else the Band of its unit's last Make.
import type { BandId, BandRef, CheckpointId, FlavourId, KeySpec, LessonDef, SessionId } from "@oak/api";
import type { BandSetup } from "@oak/strudel";
import { type SongBand, songBandTracks } from "@oak/strudel/song-compose";
import { bandById, bandCodeAt } from "../../../content/bands/index.ts";
import { CHECKPOINT_MAKE_BANDS } from "../../../content/checkpoints.ts";
import { courseGraph } from "../../../content/index.ts";
import { atOrBefore } from "../../../content/lib/course.ts";
import { keyArg } from "./model.ts";

/**
 * The Band a step plays. With `song` (a take step's Make inside its unit song, spec §5.3), the setup plays the song
 * instead (`songBandSetupOf`); its `code` stays the step's own Band, the Make's "Today's code".
 */
export function bandSetupOf(
  ref: BandRef | false | undefined,
  o: { flavour: FlavourId; key: KeySpec; bpm: number; at?: SessionId | null; song?: SongBand | null },
): BandSetup | null {
  const own = plainBandSetupOf(ref, o);
  return o.song ? songBandSetupOf(own, o.song) : own;
}

/** A step with no Band of its own (`band: false`, U13's Makes) plays the song alone: this id only names it. */
const SONG_ONLY_BAND = "band.unit-song" as BandId;

/**
 * Unit songs (spec §5.2): the setup that plays a song on every path (`BandSetup.song`). `code` stays the step's own
 * Band (empty when it has none: the song then plays alone), so the same setup without `song` is the Make's "Today's
 * code". `tracks` are the song's track names (`oak.kick`, `take.U01.L01.drums`): the Band parts the Workbench hears.
 */
export function songBandSetupOf(own: BandSetup | null, song: SongBand): BandSetup {
  return {
    band: own?.band ?? SONG_ONLY_BAND,
    flavour: song.flavour,
    code: own?.code ?? "",
    followsLearnerKey: false,
    tracks: songBandTracks(song),
    song,
  };
}

function plainBandSetupOf(
  ref: BandRef | false | undefined,
  o: { flavour: FlavourId; key: KeySpec; bpm: number; at?: SessionId | null },
): BandSetup | null {
  if (!ref) return null;
  const def = bandById.get(ref.band);
  if (!def) return null;
  const flavour = (def.code[o.flavour] ? o.flavour : "flavour.pop") as FlavourId;
  const at = o.at ?? null;
  const graph = at ? courseGraph() : null;
  const staged = bandCodeAt(def, flavour, (from) =>
    graph && at ? atOrBefore(graph, from as SessionId, at) : false,
  );
  const code = staged.replaceAll("{{key}}", keyArg(o.key)).replaceAll("{{bpm}}", String(o.bpm));
  if (!code) return null;
  return {
    band: ref.band as BandId,
    flavour,
    code,
    followsLearnerKey: ref.followsLearnerKey === true,
    tracks: [...(ref.tracks ?? def.roles)],
  };
}

/**
 * The Band parts a step leaves out (`ui.band.tracks`), as a sketch's `band.mutes`: a Make saved over the drums
 * alone opens in Studio with the Band's bass and chords still muted, so it sounds as it did in the lesson.
 */
export function bandMutesOf(setup: Pick<BandSetup, "tracks">): ("drums" | "bass" | "chords")[] {
  return (["drums", "bass", "chords"] as const).filter((r) => !setup.tracks.includes(r));
}

/** The Band of a lesson's Make (its last step that declares one). */
export function makeBandOf(lesson: Pick<LessonDef, "steps"> | null | undefined): BandRef | null {
  if (!lesson) return null;
  const make = [...lesson.steps].reverse().find((s) => s.kind === "make" && s.ui.band);
  return make?.ui.band ? make.ui.band : null;
}

/** The Band of a checkpoint's Make: the one content names for it, else its unit's last Make's. */
export function checkpointMakeBand(
  cpId: string,
  lastLesson: Pick<LessonDef, "steps"> | null,
): BandRef | null {
  return CHECKPOINT_MAKE_BANDS[cpId as CheckpointId] ?? makeBandOf(lastLesson);
}
