// sketches, album, audio (media GETs with Range), transcriptions.
import type { AppDeps } from "../deps.ts";
import { badRequest } from "../errors.ts";
import { serveFile } from "../services/audio-store.ts";
import type { Mounter } from "./define.ts";

/** A partial body without its absent keys (`exactOptionalPropertyTypes`). */
function stripUndefined<T extends object>(o: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as never;
}

function versionParam(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw badRequest("version must be a positive integer");
  return n;
}

function durationParam(v: string | undefined): number | null {
  const duration = v === undefined ? null : Number(v);
  if (duration !== null && !(Number.isFinite(duration) && duration >= 0))
    throw badRequest("durationS must be a number of seconds");
  return duration;
}

export function libraryRoutes(mount: Mounter, d: AppDeps): void {
  const lib = d.services.library;

  mount("sketches.list", ({ query }) => ({
    items: lib.sketches({
      ...(query.origin === undefined ? {} : { origin: query.origin }),
      ...(query.archived === undefined ? {} : { archived: query.archived === "1" }),
    }),
  }));
  mount("sketches.create", ({ body }) => lib.createSketch(body));
  mount("sketches.get", ({ params }) => lib.sketch(params.id));
  mount("sketches.addVersion", ({ params, body }) => lib.addSketchVersion(params.id, body));
  mount("sketches.patch", ({ params, body }) => lib.patchSketch(params.id, body as never));
  mount("sketches.delete", ({ params }) => {
    lib.deleteSketch(params.id);
    return { ok: true as const };
  });
  // Oak 2.0 W1 (S3): keep or cut a take (cut = hidden in the app, never deleted).
  mount("sketches.patchVersion", ({ params, body }) =>
    lib.patchSketchVersion(params.id, versionParam(params.version), body.takeState),
  );

  mount("album.get", () => lib.album());
  mount("album.track", ({ params }) => lib.track(params.id));
  mount("album.createTrack", ({ body }) => lib.createTrack(body));
  mount("album.addVersion", ({ params, body }) => lib.addTrackVersion(params.id, body));
  // Oak 2.0 W4 F6: the Shelf (listed in `OAK2_BUILT` by the W4 integrator).
  mount("album.patchTrack", ({ params, body }) => lib.patchTrack(params.id, body));
  // Wave 6 (d20): a recording on a version that already has one is another take; nothing is replaced, so the
  // `album.audio.replace` nonce is accepted and no longer needed (an older client cannot delete a recording).
  mount("album.putAudio", ({ params, query, bytes, contentType }) =>
    lib.putTrackAudio(params.id, versionParam(params.v), bytes, contentType, durationParam(query.durationS)),
  );
  mount("album.getAudio", ({ params, query }, c) => {
    const take = query.take === undefined ? null : Number(query.take);
    const a = lib.trackAudio(params.id, versionParam(params.v), take);
    return serveFile(a.abs, c.req.raw, { mime: a.mime, media: true });
  });
  mount("album.deleteTrack", ({ params }) => {
    lib.deleteTrack(params.id);
    return { ok: true as const };
  });

  mount("audio.upload", ({ query, bytes, contentType }) => lib.uploadAudio(query.name, bytes, contentType));
  mount("audio.get", ({ params }, c) => {
    const a = lib.audio(params.id);
    return serveFile(a.abs, c.req.raw, {
      mime: a.mime,
      media: true,
      cacheControl: "private, max-age=31536000, immutable",
    });
  });
  mount("audio.putPeaks", ({ params, bytes }) => {
    lib.putPeaks(params.id, bytes);
    return { ok: true as const };
  });
  mount("audio.getPeaks", ({ params }, c) =>
    serveFile(lib.peaks(params.id), c.req.raw, { mime: "application/octet-stream", media: true }),
  );
  mount("audio.delete", ({ params }) => {
    lib.deleteAudio(params.id);
    return { ok: true as const };
  });

  mount("transcriptions.list", () => ({ items: lib.transcriptions() }));
  mount("transcriptions.create", ({ body }) => lib.createTranscription(body));
  mount("transcriptions.get", ({ params }) => lib.transcription(params.id));
  mount("transcriptions.patch", ({ params, body }) => lib.patchTranscription(params.id, body as never));
  mount("transcriptions.addVersion", ({ params, body }) =>
    lib.addTranscriptionVersion(params.id, {
      code: body.code,
      result: body.result,
      ranOk: body.ranOk,
      ...(body.machineDraft === undefined ? {} : { machineDraft: body.machineDraft }),
    }),
  );
  mount("transcriptions.delete", ({ params }) => {
    lib.deleteTranscription(params.id);
    return { ok: true as const };
  });

  // Wave 4 (docs/design/wave4.md §5.2, §5.3): album versions, reviews attached, transcription settings.
  mount("album.patchVersion", ({ params, body }) =>
    lib.patchTrackVersion(params.id, versionParam(params.v), {
      ...(body.linerNotesMd === undefined ? {} : { linerNotesMd: body.linerNotesMd }),
      ...(body.includeReviewNote === undefined ? {} : { includeReviewNote: body.includeReviewNote }),
    }),
  );
  mount("album.attachReview", ({ params, body }) =>
    lib.attachTrackReview(params.id, versionParam(params.v), body),
  );
  mount("transcriptions.putSettings", ({ params, body }) =>
    lib.putTranscriptionSettings(params.id, stripUndefined(body)),
  );

  // Wave 5 (carry-over c2, contracts §11.3): an imported version runs as the learner's own once confirmed.
  mount("transcriptions.confirmVersion", ({ params }) => {
    const v = Number(params.v);
    if (!Number.isInteger(v) || v < 1) throw badRequest("the version must be a positive integer");
    return lib.confirmTranscriptionVersion(params.id, v);
  });

  // Wave 6 (docs/design/wave6.md §5.7).
  // d15: the learner's latest saved Make sketch of a lesson (a Make that builds on an earlier lesson's sketch).
  mount("lessons.sketch", ({ params }) => lib.lessonSketch(params.id));
  // d20: re-recording keeps both takes; the newest plays by default, an older one can be chosen and exported.
  mount("album.addTake", ({ params, query, bytes, contentType }) =>
    lib.addTrackTake(params.id, versionParam(params.v), bytes, contentType, durationParam(query.durationS)),
  );
  mount("album.chooseTake", ({ params, body }) =>
    lib.chooseTrackTake(params.id, versionParam(params.v), body.take),
  );
  // Wave 7 (docs/design/wave7.md §5.5, carry f2): exactly what a released version plays, for the offline Export.
  mount("album.source", ({ params }) => lib.albumSource(params.id, versionParam(params.v)));
}
