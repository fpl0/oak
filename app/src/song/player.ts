// The one song player of the song surfaces (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.5): Today's
// ▶, the lesson card, the Coda's before and after, the New song previews, the song page and the album shelf all play
// through it, so only one song plays at a time and a second ▶ stops the first. It plays a `SongBand` composed by
// `@oak/strudel/song-compose` through one `PatternPlayer` (an empty code: the song plays alone), once through, or a
// section on loop. A Workbench or another player that starts takes the sound (the runtime's coordinator); this module
// notices and shows the song stopped. The playhead reads `subscribeFrames` (one callback per frame, no re-render);
// the rest is a small store read with `useSongPlay`.
import type { MuteMap, PatternPlayer } from "@oak/strudel";
import { type SongBand, songLengthBars } from "@oak/strudel/song-compose";
import { useSyncExternalStore } from "react";
import { songBandSetupOf } from "../lesson/band.ts";
import { getOak } from "../lib/oak.ts";

export interface SongLoop {
  fromBar: number;
  bars: number;
}

export interface SongPlayState {
  /** What plays (or loads): the caller's id for this song and version, `null` when nothing does. */
  id: string | null;
  phase: "idle" | "loading" | "playing";
  /** The whole bar playing now (0-based, within the song), `null` while stopped. */
  bar: number | null;
  lengthBars: number;
  loop: SongLoop | null;
  /** The tracks the song loaded (`band.oak.kick`, `band.take.U01.L01.drums`): what mutes act on. */
  tracks: readonly string[];
  /** Why the last ▶ did not play, in plain words. */
  error: { id: string; message: string } | null;
}

const IDLE: SongPlayState = {
  id: null,
  phase: "idle",
  bar: null,
  lengthBars: 0,
  loop: null,
  tracks: [],
  error: null,
};

let state: SongPlayState = IDLE;
const listeners = new Set<() => void>();
const frameListeners = new Set<(id: string | null, position: number | null) => void>();
let player: PatternPlayer | null = null;
let generation = 0;
let raf: number | null = null;
/** The cycle at which a song played through ends (moves on when a section loop is let go mid-song). */
let endAt = 0;

function set(next: Partial<SongPlayState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function songPlayState(): SongPlayState {
  return state;
}

/** The player's state (re-renders on a change of song, phase, bar or loop; never per frame). */
export function useSongPlayState(): SongPlayState {
  return useSyncExternalStore(subscribe, songPlayState, () => IDLE);
}

/** One song's view of the player: is it the one playing or loading, the bar it is at, its error. */
export function useSongPlay(id: string | null) {
  const s = useSongPlayState();
  const mine = id !== null && s.id === id;
  return {
    playing: mine && s.phase === "playing",
    loading: mine && s.phase === "loading",
    bar: mine ? s.bar : null,
    loop: mine ? s.loop : null,
    tracks: mine ? s.tracks : [],
    error: s.error && s.error.id === id ? s.error.message : null,
  };
}

/**
 * Calls `cb` every animation frame while a song plays, with its id and fractional bar (within the song), and once
 * with `null` when it stops. Returns the unsubscribe.
 */
export function subscribeFrames(cb: (id: string | null, position: number | null) => void): () => void {
  frameListeners.add(cb);
  cb(state.phase === "playing" ? state.id : null, state.phase === "playing" ? positionNow() : null);
  return () => frameListeners.delete(cb);
}

function positionNow(): number | null {
  if (!player || state.phase !== "playing" || state.lengthBars <= 0) return null;
  const pos = player.position();
  if (!Number.isFinite(pos)) return null;
  return state.loop ? pos : pos % state.lengthBars;
}

function tick(): void {
  raf = null;
  if (state.phase !== "playing" || !player) return;
  // Another source took the sound (the coordinator stopped this player): the song shows stopped.
  if (!player.playing) {
    stopSong();
    return;
  }
  const raw = player.position();
  // Once through, then the song ends (a section loop plays until it is stopped).
  if (!state.loop && Number.isFinite(raw) && raw >= endAt) {
    stopSong();
    return;
  }
  const pos = positionNow();
  const bar = pos === null ? null : Math.floor(pos);
  if (bar !== state.bar) set({ bar });
  for (const l of frameListeners) l(state.id, pos);
  schedule();
}

function schedule(): void {
  if (raf !== null || typeof requestAnimationFrame === "undefined") return;
  raf = requestAnimationFrame(tick);
}

/** Pauses every `<audio>` on the page (an album recording) so the song is heard alone. */
function pauseAudioElements(): void {
  if (typeof document === "undefined") return;
  for (const a of document.querySelectorAll("audio")) if (!a.paused) a.pause();
}

export interface PlaySongOptions {
  loop?: SongLoop | null;
  /** The mutes to apply once the song's tracks are known (a part muted or soloed on the song page). */
  mutes?: (tracks: readonly string[]) => MuteMap;
}

/**
 * Plays a song from its first bar (or loops a section). `id` names this song and version for the buttons that show
 * its state. Whatever played before stops. Resolves `false` when the sound did not start (the error is in the state).
 */
export async function playSong(id: string, band: SongBand, opts: PlaySongOptions = {}): Promise<boolean> {
  const gen = ++generation;
  player?.stop();
  pauseAudioElements();
  const lengthBars = songLengthBars(band.def);
  set({ id, phase: "loading", bar: null, lengthBars, loop: opts.loop ?? null, tracks: [], error: null });
  try {
    const oak = await getOak();
    await oak.unlock();
    if (gen !== generation) return false;
    player ??= oak.createPatternPlayer();
    // The player's own code is empty (the song plays alone), checked as Band code: no tempo line of its own.
    const out = await player.load("", {
      bars: lengthBars,
      cps: 0,
      band: songBandSetupOf(null, band),
      lint: { profile: "band", unlocked: new Set(), allowPreview: true, meter: band.def.meter, key: null },
    });
    if (gen !== generation) return false;
    if (!out.ok) throw new Error("The song did not load.");
    const tracks = out.tracks.filter((t) => t.startsWith("band."));
    player.setLoop(opts.loop ?? null);
    if (opts.mutes) player.setMutes(opts.mutes(tracks));
    else player.setMutes({ muted: new Set(), solo: null });
    await player.play();
    if (gen !== generation) {
      player.stop();
      return false;
    }
    endAt = lengthBars;
    set({ phase: "playing", bar: opts.loop?.fromBar ?? 0, tracks });
    schedule();
    return true;
  } catch (e) {
    if (gen !== generation) return false;
    const message = e instanceof Error ? e.message : "The sound did not start.";
    set({ ...IDLE, error: { id, message } });
    return false;
  }
}

/** Stops the song playing now (only `id`'s, when given). */
export function stopSong(id?: string): void {
  if (id !== undefined && state.id !== id) return;
  generation++;
  player?.stop();
  if (raf !== null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
  raf = null;
  const was = state.id;
  set({ id: null, phase: "idle", bar: null, loop: null, tracks: [] });
  if (was !== null) for (const l of frameListeners) l(null, null);
}

/** Loops a section of the song playing now (or plays it through again with `null`). */
export function setSongLoop(id: string, loop: SongLoop | null): void {
  if (state.id !== id || !player) return;
  player.setLoop(loop);
  if (!loop) {
    const raw = player.position();
    const length = Math.max(1, state.lengthBars);
    endAt = Number.isFinite(raw) ? (Math.floor(raw / length) + 1) * length : length;
  }
  set({ loop });
}

/** Applies mutes to the song playing now. */
export function setSongMutes(id: string, mutes: (tracks: readonly string[]) => MuteMap): void {
  if (state.id !== id || !player) return;
  player.setMutes(mutes(state.tracks));
}
