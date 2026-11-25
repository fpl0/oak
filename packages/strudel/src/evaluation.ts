// What every evaluation in the adapter realm shares (editors and the hidden pattern player):
// - the `.p` wrapper installed in `beforeEval` (repl.evaluate re-injects `Pattern.prototype.p` first, so
//   this is the one place it is this repl's fresh collector): it tags every hap with its track and applies
//   UI mute and solo as a LIVE filter, never a code rewrite (contracts §6.2 rule 3);
// - the Band layer, evaluated separately and stacked as `band.<label>` (contracts §5.10), or a unit song (spec §5.2):
//   Oak's code and the saved takes evaluated separately, composed by song-compose.ts once the evaluation's own code
//   (the live Make) is known, and stacked as `band.oak.<label>` and `band.take.<lessonId>.<label>`;
// - the final `editPattern` step: Band stack, mute of untagged and Band haps, transposition, painter.
import { bpmToCps } from "@oak/theory";
import * as core from "@strudel/core";
import { transpiler } from "@strudel/transpiler";
import type { PreparedBand } from "./band.ts";
import { TRACK_KEY } from "./haps.ts";
import { isBandHapMuted, isMuted, trackNameOf } from "./mutes.ts";
import { plainValue } from "./plain-sounds.ts";
import {
  type BuiltSong,
  buildSong,
  type FinishedSong,
  finishSong,
  type SongBand,
  type SongCheck,
} from "./song-compose.ts";
import type { MuteMap } from "./types.ts";

type Pattern = Strudel.Pattern;

export interface EvalSession {
  /** Labels the learner's code registered, in source order (`$0`, `drums`, …). */
  tracks: string[];
  /** The Band's tracks of this evaluation, already tagged `band.<label>`. */
  band: { track: string; pattern: Pattern }[];
  /** The repl's own evaluation error (onEvalError), if any. */
  error: unknown;
  anonymous: number;
  /** The learner's tracks as the `.p` wrapper saw them, untagged: what a song's live Make plays. */
  live: { label: string; pattern: Pattern }[];
  /**
   * A unit song evaluated in `beforeEval` (`evaluateSongBand`). It is composed in `finalizePattern`, once the
   * evaluation's own tracks are known, and fills `band` then.
   */
  song: {
    built: BuiltSong;
    liveCode: string;
    finished: FinishedSong | null;
    band: EvalSession["band"];
  } | null;
}

export function newSession(): EvalSession {
  return { tracks: [], band: [], error: null, anonymous: 0, live: [], song: null };
}

type ContextFn = (fn: (context: Record<string, unknown>) => Record<string, unknown>) => Pattern;
const withContext = (
  pattern: Pattern,
  fn: (context: Record<string, unknown>) => Record<string, unknown>,
): Pattern => (pattern.withContext as ContextFn).call(pattern, fn);
const tag = (pattern: Pattern, track: string): Pattern =>
  withContext(pattern, (context) => ({ ...context, [TRACK_KEY]: track }));

/**
 * Wraps the `.p` the repl just injected. Muted-in-code labels (`_x`, `x_`) and non-strings pass through
 * untouched; every other label is tagged and filtered live by `mutes()`.
 */
export function installTrackWrapper(session: EvalSession, mutes: () => MuteMap): void {
  const proto = core.Pattern.prototype as Record<string, unknown>;
  const injected = proto.p as (this: Pattern, id: unknown) => Pattern;
  proto.p = function (this: Pattern, id: unknown): Pattern {
    if (typeof id !== "string") return injected.call(this, id);
    const { track } = trackNameOf(id, session.anonymous);
    if (track === null) return injected.call(this, id);
    if (id.includes("$")) session.anonymous++;
    session.tracks.push(track);
    // A label written twice plays only its last pattern (the repl's label map replaces it): the live Make keeps the
    // first place and the last pattern, as `collectTracks` does, so it never claims a part nothing plays.
    const again = session.live.find((t) => t.label === track);
    if (again) again.pattern = this;
    else session.live.push({ label: track, pattern: this });
    const live = tag(this, track).filterHaps(() => !isMuted(track, mutes()));
    return injected.call(live, id);
  };
}

/**
 * Evaluates Band code with a private `.p` collector (it never reaches the repl's label map), keeping only
 * the roles the step asked for. Hap locations are dropped: they are offsets into the Band code, not into
 * the learner's editor.
 */
export async function evaluateBand(
  code: string,
  roles: readonly string[],
  session: EvalSession,
): Promise<void> {
  const proto = core.Pattern.prototype as Record<string, unknown>;
  const saved = proto.p;
  const collected: { label: string; pattern: Pattern }[] = [];
  proto.p = function (this: Pattern, id: unknown): Pattern {
    if (typeof id === "string" && !id.startsWith("_") && !id.endsWith("_") && !id.includes("$")) {
      collected.push({ label: id, pattern: this });
    }
    return this;
  };
  try {
    await core.evaluate(code, transpiler, { id: "oak_band_", emitWidgets: false });
  } finally {
    proto.p = saved;
  }
  for (const { label, pattern } of collected) {
    if (roles.length > 0 && !roles.includes(label)) continue;
    const track = `band.${label}`;
    const clean = withContext(pattern, (context) => ({ ...context, locations: [], [TRACK_KEY]: track }));
    session.band.push({ track, pattern: clean });
  }
}

/** The repl's tempo functions: a song's sources are evaluated with them stubbed (spec §5.2, the song's tempo applies). */
const TEMPO_FUNCTIONS = ["setcpm", "setcps", "setCpm", "setCps"] as const;

/** Replaces the global tempo functions by no-ops until the returned function restores them. */
function neutraliseTempo(): () => void {
  const g = globalThis as Record<string, unknown>;
  const saved = TEMPO_FUNCTIONS.map((name) => [name, Object.getOwnPropertyDescriptor(g, name)] as const);
  for (const name of TEMPO_FUNCTIONS) g[name] = () => core.silence;
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(g, name, descriptor);
      else delete g[name];
    }
  };
}

/**
 * Evaluates code with a private `.p` collector (nothing reaches the repl's label map) and returns its labelled
 * tracks, untagged, in source order with the repl's naming (`$:` → `$0`, `_x` muted, a repeated label keeps its
 * first place and its last pattern). Code with no label is one track, `main`. `neutralTempo`: its `setcpm` and
 * `setcps` do nothing. Throws when the code does not evaluate.
 */
export async function collectTracks(
  code: string,
  opts: { neutralTempo?: boolean } = {},
): Promise<{ label: string; pattern: Pattern }[]> {
  const proto = core.Pattern.prototype as Record<string, unknown>;
  const saved = proto.p;
  const collected = new Map<string, Pattern>();
  let anonymous = 0;
  proto.p = function (this: Pattern, id: unknown): Pattern {
    if (typeof id !== "string") return this;
    const { track } = trackNameOf(id, anonymous);
    if (track === null) return core.silence as Pattern;
    if (id.includes("$")) anonymous++;
    collected.set(track, this);
    return this;
  };
  const restore = opts.neutralTempo ? neutraliseTempo() : null;
  let result: { pattern?: unknown } | undefined;
  try {
    result = (await core.evaluate(code, transpiler, { id: "oak_song_", emitWidgets: false })) as {
      pattern?: unknown;
    };
  } finally {
    proto.p = saved;
    restore?.();
  }
  if (collected.size === 0 && core.isPattern(result?.pattern))
    collected.set("main", result?.pattern as Pattern);
  return [...collected].map(([label, pattern]) => ({ label, pattern }));
}

/** The scheduler's cycles per second for a song's tempo in its meter. */
export function songCps(band: Pick<SongBand, "bpm" | "def">): number {
  return bpmToCps(band.bpm, band.def.meter);
}

/**
 * The unit-song counterpart of `evaluateBand`: evaluates Oak's code and every saved take that still owns a cell, each
 * with a private collector and its own tempo neutralised, and keeps them on the session; `finalizePattern` composes
 * them with the evaluation's own code (`liveCode`, the live Make). `check` is the Band lint (or the export's
 * bounds): Oak's code failing it throws, a source failing it falls back to Oak. The caller sets the song's tempo
 * (`songCps`) before the evaluation's own code runs, so a learner `setcpm` still wins.
 */
export async function evaluateSongBand(
  session: EvalSession,
  band: SongBand,
  opts: { check?: SongCheck; liveCode?: string } = {},
): Promise<void> {
  const built = await buildSong(band, (code) => collectTracks(code, { neutralTempo: true }), opts.check);
  session.song = { built, liveCode: opts.liveCode ?? "", finished: null, band: [] };
}

/** Evaluates what `prepareBandFor` prepared: Band code with its roles, or a unit song. */
export async function evaluatePreparedBand(
  prepared: PreparedBand,
  session: EvalSession,
  check?: SongCheck,
): Promise<void> {
  if (prepared.kind === "song")
    await evaluateSongBand(session, prepared.song, {
      liveCode: prepared.liveCode,
      ...(check ? { check } : {}),
    });
  else await evaluateBand(prepared.code, prepared.roles, session);
}

/** Composes a session's song once (`finishSong`), tags its tracks, and returns it. */
function composeSessionSong(session: EvalSession, learner: Pattern): NonNullable<EvalSession["song"]> | null {
  const song = session.song;
  if (!song) return null;
  if (!song.finished) {
    const live = song.built.band.live
      ? {
          tracks: session.live.length > 0 ? session.live : [{ label: "main", pattern: learner }],
          code: song.liveCode,
        }
      : null;
    song.finished = finishSong(song.built, live);
    song.band = song.finished.tracks.map(({ track, pattern }) => ({
      track,
      pattern: withContext(pattern, (context) => ({ ...context, locations: [], [TRACK_KEY]: track })),
    }));
  }
  return song;
}

/** A MIDI number for a note value: numbers pass, names go through Strudel's own `noteToMidi`. */
export function midiOfNote(note: unknown): number | null {
  if (typeof note === "number" && Number.isFinite(note)) return note;
  if (typeof note === "string") {
    try {
      const midi = core.noteToMidi(note) as number;
      return Number.isFinite(midi) ? midi : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Transposes every hap that carries a `note` (drums carry none and pass untouched). */
export function transposeValue(value: unknown, semitones: number): unknown {
  if (semitones === 0 || !value || typeof value !== "object" || Array.isArray(value)) return value;
  const v = value as Record<string, unknown>;
  if (v.note === undefined) return value;
  const midi = midiOfNote(v.note);
  return midi === null ? value : { ...v, note: midi + semitones };
}

export interface FinalizeOptions {
  session: EvalSession;
  mutes: () => MuteMap;
  /** Live transposition in semitones (the pattern player). */
  transpose?: () => number;
  /** The track Oak's scope taps (`ScopeTap.setSource({ kind: "track" })`), read live; null for the master bus. */
  scopeTrack?: () => string | null;
  /**
   * Oak 2.0 W1: plain sounds (`EditorHandle.setPlainSounds`), read live per hap: while it answers true the learner's
   * bass, chords and tune haps play `plainValue`; drums, the Band and the code are untouched.
   */
  plain?: () => boolean;
}

/** Plays the learner's pitched parts with plain sounds while `on()` answers true (read per hap, live). */
export function plainTracks(pattern: Pattern, on: () => boolean): Pattern {
  return (pattern.withHap as (fn: (hap: Strudel.Hap) => Strudel.Hap) => Pattern).call(pattern, (hap) => {
    if (!on()) return hap;
    const track = hap.context[TRACK_KEY];
    const next = plainValue(hap.value, typeof track === "string" ? track : null);
    if (next === hap.value) return hap;
    return (hap as unknown as { withValue(f: (x: unknown) => unknown): Strudel.Hap }).withValue(() => next);
  });
}

/** Superdough's analyser id the scope's track source reads (`analyze` on a hap sends its voice there). */
export const SCOPE_TRACK_ANALYSER = "oak.scope.track";
/** superdough sizes an `analyze` analyser as 2^(fft + 5): 6 gives the master analyser's 2048. */
export const SCOPE_TRACK_FFT = 6;

/** Sends the voices of one track, live, to the scope's track analyser too (pre-reverb, post-filter). */
export function tapTrack(pattern: Pattern, scopeTrack: () => string | null): Pattern {
  return (pattern.withHap as (fn: (hap: Strudel.Hap) => Strudel.Hap) => Pattern).call(pattern, (hap) => {
    const label = scopeTrack();
    if (label === null || hap.context[TRACK_KEY] !== label) return hap;
    const v = hap.value;
    if (!v || typeof v !== "object" || Array.isArray(v)) return hap;
    return (hap as unknown as { withValue(f: (x: unknown) => unknown): Strudel.Hap }).withValue((x) => ({
      ...(x as Record<string, unknown>),
      analyze: SCOPE_TRACK_ANALYSER,
      fft: SCOPE_TRACK_FFT,
    }));
  });
}

/**
 * The `editPattern` step: compose a unit song, stack the Band, mute untagged (`main`) and Band haps live, transpose
 * live, plain sounds live (Oak 2.0 W1).
 * The painter is added by the caller, last, so that nothing after it drops the painters.
 */
export function finalizePattern(pattern: Pattern, opts: FinalizeOptions): Pattern {
  let out = pattern;
  // A unit song: the evaluation's own code is the live Make, placed into today's sections; Oak and the saved takes
  // are composed around it.
  const song = composeSessionSong(opts.session, pattern);
  if (song) {
    opts.session.band = song.band;
    if (song.finished?.place) out = song.finished.place(out);
  }
  if (opts.session.band.length > 0)
    out = core.stack(out, ...opts.session.band.map((b) => b.pattern)) as Pattern;
  out = out.filterHaps((hap) => {
    const track = hap.context[TRACK_KEY];
    if (typeof track !== "string") return !isMuted("main", opts.mutes());
    return track.startsWith("band.") ? !isBandHapMuted(track, hap.value, opts.mutes()) : true;
  });
  const transpose = opts.transpose;
  if (transpose) out = out.fmap((value) => transposeValue(value, transpose()));
  if (opts.plain) out = plainTracks(out, opts.plain);
  if (opts.scopeTrack) out = tapTrack(out, opts.scopeTrack);
  return out;
}
