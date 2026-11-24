import pack from "../../../../sounds/pack.lock.json";
import type { SongBand } from "../song-compose.ts";
import { PieceRenderError } from "./errors.ts";
import type { FrameRequest, RenderPieceRequest } from "./types.ts";

export const RENDER_TIMEOUT_MS = 60_000;

/** Validate before constructing a frame; copy mutable selection state at the request boundary. */
export function validateRequest(request: RenderPieceRequest): FrameRequest {
  // A unit song plays alone when there is no code of its own (an album release, the song page).
  const songAlone = !!request?.band?.song && typeof request.code === "string" && !request.code.trim();
  if (!request || typeof request.code !== "string" || (!request.code.trim() && !songAlone))
    throw new PieceRenderError("invalid-request", "Choose a piece with code to export.");
  const sampleRate = request.sampleRate ?? 48000;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000)
    throw new PieceRenderError("invalid-request", "Use a whole sample rate between 8000 and 96000 Hz.");
  const timeout = request.timeoutMs ?? RENDER_TIMEOUT_MS;
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 300_000)
    throw new PieceRenderError("invalid-request", "The render timeout must be between 0 and 300000 ms.");
  if (
    request.band &&
    (typeof request.band.code !== "string" ||
      (!request.band.code.trim() && !request.band.song) ||
      !Array.isArray(request.band.tracks) ||
      request.band.tracks.some((t) => typeof t !== "string" || !t.trim()))
  )
    throw new PieceRenderError("invalid-request", "The Band selection needs its code and track labels.");
  const song = request.band?.song;
  if (song && !validSong(song))
    throw new PieceRenderError(
      "invalid-request",
      "The song needs its sections, its codes and who owns each part.",
    );
  return {
    code: songAlone ? "silence" : request.code,
    band: request.band
      ? {
          ...request.band,
          tracks: [...request.band.tracks],
          ...(song
            ? { song: { ...song, sources: song.sources.map((x) => ({ ...x })), grid: new Map(song.grid) } }
            : {}),
        }
      : null,
    key: request.key ? { ...request.key } : null,
    muted: [...(request.mutes?.muted ?? [])],
    solo: request.mutes?.solo ?? null,
    sampleRate,
    soundsRoot: request.soundsRoot ?? pack.publicRoot,
  };
}

/** A unit song the frame can play: a form, a tempo, Oak's code or the def's, sources with code, a grid. */
function validSong(song: SongBand): boolean {
  const def = song.def as Partial<SongBand["def"]> | undefined;
  return (
    !!def &&
    Array.isArray(def.sections) &&
    def.sections.length > 0 &&
    def.sections.every((s) => Number.isInteger(s.bars) && s.bars > 0) &&
    Array.isArray(def.parts) &&
    Number.isFinite(song.bpm) &&
    song.bpm > 0 &&
    Array.isArray(song.sources) &&
    song.sources.every((x) => typeof x.sourceId === "string" && typeof x.code === "string") &&
    song.grid instanceof Map
  );
}

export function localUrl(path: string, base: string): string {
  let url: URL;
  try {
    url = new URL(path, base);
  } catch {
    throw new PieceRenderError("invalid-request", "The render frame or sound pack URL is invalid.");
  }
  if (url.origin !== new URL(base).origin || !["http:", "https:"].includes(url.protocol))
    throw new PieceRenderError("invalid-request", "The render frame and sound pack must be on Oak's origin.");
  return url.href;
}
