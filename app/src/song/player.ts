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
import { useShell } from "../lib/shell-store.ts";

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
/**
 * A song playing on after its section loop was let go: the player's loop is then this long, never-repeating window
 * that keeps the bar sounding at the release (`fromBar` = song bar − scheduler cycle, so the playhead and the sound go
 * on from where the loop was, never from the raw cycle). `null` while the song plays from its first bar.
 */
let playOn: SongLoop | null = null;

/** The label the shell's Now playing shows for a song (and what `stopSong` clears). */
const NOW_PLAYING_PREFIX = "Song: ";

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
  return state.loop ? pos : Math.max(0, pos) % state.lengthBars;
}

function tick(): void {
  raf = null;
  if (state.phase !== "playing" || !player) return;
  // Another source took the sound (the coordinator stopped this player): the song shows stopped.
  if (!player.playing) {
    stopSong();
    return;
  }
  // The song bar sounding now (the player's position honours the loop, and the play-on window after one).
  const raw = player.position();
  // Once through, then the song ends at its last bar (a section loop plays until it is stopped).
  if (!state.loop && Number.isFinite(raw) && raw >= state.lengthBars) {
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
  /** The song's title for the shell's Now playing (the learner's title; Oak's working title when not given). */
  title?: string;
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
  playOn = null;
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
    set({ phase: "playing", bar: opts.loop?.fromBar ?? 0, tracks });
    // The shell shows what plays with a Stop, so a song left playing on another page can be stopped there.
    useShell.getState().setNowPlaying({
      label: `${NOW_PLAYING_PREFIX}${opts.title ?? band.def.title}`,
      stop: () => stopSong(),
    });
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
  playOn = null;
  const was = state.id;
  set({ id: null, phase: "idle", bar: null, loop: null, tracks: [] });
  const np = useShell.getState().nowPlaying;
  if (np?.label.startsWith(NOW_PLAYING_PREFIX)) useShell.getState().setNowPlaying(null);
  if (was !== null) for (const l of frameListeners) l(null, null);
}

/**
 * Loops a section of the song playing now, or, with `null`, lets the loop go: the song plays on from the bar the loop
 * is sounding (after the section's last bar, the next section) to the song's end, never from the scheduler's raw
 * cycle (which, for a loop started from the stop, is an unrelated early bar).
 */
export function setSongLoop(id: string, loop: SongLoop | null): void {
  if (state.id !== id || !player) return;
  if (loop) {
    playOn = null;
    player.setLoop(loop);
  } else if (state.loop) {
    const bar = player.position();
    player.setLoop(null);
    const cycle = player.position();
    playOn = playOnWindow(bar, cycle, state.lengthBars);
    player.setLoop(playOn);
  }
  set({ loop });
}

/**
 * The player loop that keeps song bar `bar` sounding at scheduler cycle `cycle` and goes on bar by bar: offset
 * `bar − cycle` (a whole number: a loop's bars are whole), long enough never to repeat before the song ends.
 * `null` when the two already agree (the song played through from its first bar).
 */
export function playOnWindow(bar: number, cycle: number, lengthBars: number): SongLoop | null {
  if (!Number.isFinite(bar) || !Number.isFinite(cycle)) return null;
  const fromBar = Math.round(bar - cycle);
  if (fromBar === 0) return null;
  return { fromBar, bars: Math.max(1, Math.ceil(lengthBars - fromBar) + 1) };
}

/** Applies mutes to the song playing now. */
export function setSongMutes(id: string, mutes: (tracks: readonly string[]) => MuteMap): void {
  if (state.id !== id || !player) return;
  player.setMutes(mutes(state.tracks));
}
