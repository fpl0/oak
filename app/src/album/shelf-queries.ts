// Oak 2.0 W4 F6 (DeSantis, Fail Better): the Shelf's server calls. `album.patchTrack` puts a track on the Shelf or
// back on the album; shelving a sketch saves its live code as a version when it differs from the latest, then makes
// the B-side already on the Shelf (`album.createTrack { shelved: true }`, one call, so it is never on the album for a
// moment). A shelved piece counts as finished, stays off the album, and its lines stay in the scraps.
import type { AlbumTrackDetail, SketchDetail } from "@oak/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callApi } from "../lib/api.ts";
import { useApiMutation } from "../lib/queries.ts";
import { currentSessionId } from "../session/store.ts";

/** `PATCH /album/tracks/:id { shelved }`: the album, the track page and the Shelf read it again. */
export const useAlbumPatchTrack = () => useApiMutation("album.patchTrack", ["album.get", "album.track"]);

export interface ShelveSketch {
  sketch: SketchDetail;
  /** The editor's code now: saved as a new version first when it differs from the latest. */
  liveCode: string;
  title: string;
}

/** The newest saved version of a sketch (the one `currentVersion` names, else the highest). */
const latestOf = (s: SketchDetail) =>
  s.versions.find((v) => v.version === s.currentVersion) ??
  [...s.versions].sort((a, b) => b.version - a.version)[0] ??
  null;

/** A sketch finished anyway goes on the Shelf as a B-side: a version of the live code, then the shelved track. */
export function useShelveSketch() {
  const qc = useQueryClient();
  return useMutation<AlbumTrackDetail, Error, ShelveSketch>({
    mutationKey: ["shelf", "sketch"],
    mutationFn: async ({ sketch, liveCode, title }) => {
      const latest = latestOf(sketch);
      let version = latest?.version ?? sketch.currentVersion;
      if (!latest || latest.code !== liveCode) {
        const saved = await callApi("sketches.addVersion", {
          params: { id: sketch.id },
          body: {
            sessionId: currentSessionId(),
            code: liveCode,
            bpm: latest?.bpm ?? null,
            meter: latest?.meter ?? null,
            key: latest?.key ?? null,
            analysis: null,
            note: "Finished anyway",
            tutorAssisted: latest?.tutorAssisted ?? false,
            band: latest?.band ?? null,
            flags: latest?.flags ?? { lockedTools: [], previewTools: [] },
            ranOk: false,
          },
        });
        version = saved.sketch.currentVersion;
      }
      return callApi("album.createTrack", {
        body: {
          capstoneId: null,
          side: "Bside",
          title: title.trim(),
          flavour: null,
          sketchId: sketch.id,
          sketchVersion: version,
          linerNotesMd: "",
          theoryTags: [],
          attribution: null,
          shelved: true,
        },
      });
    },
    onSuccess: async () => {
      await Promise.all(
        (["album.get", "sketches.get", "sketches.list", "scraps.list"] as const).map((n) =>
          qc.invalidateQueries({ queryKey: ["api", n] }),
        ),
      );
    },
  });
}
