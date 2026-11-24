// One take per frame. superdough's module-global pools and worklet registrations cannot switch contexts.
import * as core from "@strudel/core";
import { transpiler } from "@strudel/transpiler";
import * as webaudio from "@strudel/webaudio";
import { prepareBandFor } from "../band.ts";
import {
  evaluatePreparedBand,
  finalizePattern,
  installTrackWrapper,
  newSession,
  songCps,
} from "../evaluation.ts";
import { friendlyEvalError } from "../friendly.ts";
import { missingSoundOf } from "../logs.ts";
import { type HapValue, prebake } from "../pack.ts";
import { warmAll } from "../preload.ts";
import { songLengthBars } from "../song-compose.ts";
import { boundedQuery, checkSource } from "./bounds.ts";
import { PieceRenderError, renderFailure } from "./errors.ts";
import { attachOfflineMaster } from "./master.ts";
import { MAX_PIECE_BARS, renderLength, trimAndMeasure } from "./math.ts";
import { orderedMix } from "./mix.ts";
import { seedRandom, seedWorklet } from "./random.ts";
import type { FrameRequest, PiecePcm } from "./types.ts";

interface OfflineRepl {
  evaluate(code: string, autostart: boolean): Promise<Strudel.Pattern | undefined>;
  setCps(cps: number): void;
  scheduler: { cps: number };
}

/** A song's bars, refused like a piece's form when it is longer than an export takes. */
function renderableSongBars(bars: number): number {
  if (!Number.isInteger(bars) || bars <= 0)
    throw new PieceRenderError("length", "The song needs whole bars in every section.");
  if (bars > MAX_PIECE_BARS)
    throw new PieceRenderError(
      "too-long",
      `The song has ${bars} bars; exports support at most ${MAX_PIECE_BARS}.`,
    );
  return bars;
}

/**
 * Frames rendered before bar 1 and cut from the take: one scheduling step (a quarter second, a multiple of the
 * 128-frame render quantum). A note queued before the graph starts rendering lost part of its attack (the first
 * kick 4 dB, a pad 1.3 dB under the live engine; a 1024-frame pre-roll still left 1.9 and 0.75 dB; one step leaves
 * 0.0, measured in offline.pw.ts "orbits").
 */
export const prerollFrames = (sampleRate: number): number => Math.floor(sampleRate / 4 / 128) * 128;

/** Wait on actual IR readiness: superdough generates filtered reverb in another offline context. */
async function waitForReverb(): Promise<void> {
  const orbits = Object.values(webaudio.getSuperdoughAudioController().nodes ?? {}) as {
    reverbNode?: ConvolverNode;
  }[];
  const deadline = performance.now() + 5000;
  while (orbits.some((o) => o.reverbNode && !o.reverbNode.buffer)) {
    if (performance.now() > deadline)
      throw new PieceRenderError("timeout", "The reverb could not finish loading.");
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
  }
}

async function render(request: FrameRequest, progress: (p: number) => void): Promise<PiecePcm> {
  // Bound 1 and 2 (bounds.ts): read before anything runs; the form's bars are the render's length. A unit song's
  // length is the song's form (spec §5.2); the code itself (the live Make, or none) needs no form of its own.
  const song = request.band?.song ?? null;
  const own = checkSource(request.code, false, song === null);
  const bars = song ? renderableSongBars(songLengthBars(song.def)) : (own as number);
  seedRandom();
  const missing = new Set<string>();
  webaudio.setLogger((message: unknown) => {
    const name = missingSoundOf(String(message));
    if (name) missing.add(name);
  });
  try {
    await prebake(request.soundsRoot);
  } catch (error) {
    throw new PieceRenderError("missing-sound", `The sound pack could not load: ${String(error)}`, [
      request.soundsRoot,
    ]);
  }
  const session = newSession();
  const mutes = { muted: new Set(request.muted), solo: request.solo };
  const repl = core.repl({
    id: "oak_offline_",
    getTime: () => 0,
    transpiler,
    beforeEval: async () => {
      installTrackWrapper(session, () => mutes);
      if (request.band) {
        const prepared = prepareBandFor(request.band, {
          key: request.key,
          defaultBpm: 120,
          learnerCode: request.code,
        });
        if (prepared.kind === "song") {
          // The song's tempo until the code sets one; Oak's code is read as authored, a take as the learner's.
          repl.setCps(songCps(prepared.song));
          await evaluatePreparedBand(prepared, session, (code, who) => {
            try {
              checkSource(code, who === "oak", false);
              return true;
            } catch (error) {
              if (who === "oak") throw error;
              return false;
            }
          });
        } else {
          checkSource(prepared.code, true);
          await evaluatePreparedBand(prepared, session);
        }
      }
    },
    editPattern: (pattern: Strudel.Pattern) => finalizePattern(pattern, { session, mutes: () => mutes }),
    onEvalError: (error: unknown) => {
      session.error = error;
    },
  }) as OfflineRepl;
  const pattern = await repl.evaluate(request.code, false);
  if (session.error || !pattern)
    throw new PieceRenderError(
      "evaluation",
      friendlyEvalError(String(session.error ?? "No pattern"), request.code).message,
    );
  const cps = repl.scheduler.cps;
  const length = renderLength(bars, cps, request.sampleRate);
  let haps: Strudel.Hap[];
  try {
    // Bound 3: read in slices against a note budget and a time budget, never the whole form at once.
    haps = boundedQuery(pattern, {
      bars,
      state: { _cps: cps, cyclist: "cyclist" },
      hasOnset: (hap: Strudel.Hap) => hap.hasOnset(),
    }).sort((a, b) => Number(a.whole?.begin.valueOf()) - Number(b.whole?.begin.valueOf()));
    for (const hap of haps) (hap as unknown as { ensureObjectValue(): void }).ensureObjectValue();
  } catch (error) {
    if (error instanceof PieceRenderError) throw error;
    throw new PieceRenderError("evaluation", friendlyEvalError(String(error), request.code).message);
  }
  progress(0.05);
  // Bar 1 starts one scheduling step in, so its notes are queued while the graph already renders (prerollFrames).
  const preroll = prerollFrames(request.sampleRate);
  const lead = preroll / request.sampleRate;
  const total = length.frames + preroll;
  const ctx = new OfflineAudioContext(2, total, request.sampleRate);
  webaudio.setAudioContext(ctx);
  webaudio.setSuperdoughAudioController(null);
  await seedWorklet(ctx);
  const mix = orderedMix(ctx);
  await webaudio.initAudio({ maxPolyphony: 128 });
  attachOfflineMaster(ctx);
  // Include superdough's default sine for bare note() values. Preload the whole form before any audio runs.
  const warmed = await warmAll(
    haps.map((h) => ({ s: "sine", ...(h.value as HapValue) })),
    (done, total) => progress(0.05 + 0.1 * (total ? done / total : 1)),
  );
  for (const name of warmed.missing) missing.add(name);
  const checkMissing = () => {
    if (missing.size)
      throw new PieceRenderError(
        "missing-sound",
        `These sounds could not load: ${[...missing].sort().join(", ")}.`,
        [...missing].sort(),
      );
  };
  checkMissing();
  let at = 0;
  const schedule = async (until: number) => {
    while (at < haps.length) {
      const hap = haps[at] as Strudel.Hap;
      const time = Number(hap.whole?.begin.valueOf()) / cps + lead;
      if (time >= until) break;
      const duration =
        Number((hap as unknown as { duration: { valueOf(): number } }).duration.valueOf()) / cps;
      // Same output and custom-trigger semantics as core.repl/getTrigger; errors must fail an export.
      if (!hap.context.onTrigger || !hap.context.dominantTrigger)
        await webaudio.webaudioOutput(hap, time - ctx.currentTime, duration, cps, time);
      if (typeof hap.context.onTrigger === "function")
        await hap.context.onTrigger(hap, ctx.currentTime, cps, time);
      at++;
      if (at % 32 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    await waitForReverb();
    checkMissing();
  };
  // Quantized suspension points: voices/effects are queued as time advances, just like live playback.
  // Queuing the whole song first would exhaust polyphony and apply the last orbit settings to bar one.
  const step = prerollFrames(request.sampleRate);
  let boundary = Math.min(step, total);
  await schedule(boundary / request.sampleRate);
  mix.flush();
  let suspended = boundary < total ? ctx.suspend(boundary / request.sampleRate) : null;
  progress(0.15);
  const rendering = ctx.startRendering();
  // Attach a rejection handler immediately; a later suspension must not leave an unhandled rejection.
  void rendering.catch(() => undefined);
  while (suspended) {
    await suspended;
    progress(0.15 + (0.83 * boundary) / total);
    boundary = Math.min(boundary + step, total);
    // Deliver onended cleanups before reusing engine pools or rebuilding a mix.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await schedule(boundary / request.sampleRate);
    mix.flush();
    suspended = boundary < total ? ctx.suspend(boundary / request.sampleRate) : null;
    await ctx.resume();
  }
  const buffer = await rendering;
  mix.restore();
  const pcm = trimAndMeasure(
    buffer.getChannelData(0).subarray(preroll),
    buffer.getChannelData(1).subarray(preroll),
    length.pieceFrames,
    request.sampleRate,
  );
  const durationS = pcm.left.length / request.sampleRate;
  return {
    ...pcm,
    sampleRate: request.sampleRate,
    bars,
    cps,
    pieceDurationS: length.seconds,
    durationS,
    tailS: durationS - length.seconds,
    missingSounds: [],
  };
}

/** Entry point of the separate, same-origin HTML page (never call in the editor realm). */
export function installPieceRenderFrame(): void {
  let used = false;
  const send = (data: unknown, transfer: Transferable[] = []) =>
    window.parent.postMessage(data, location.origin, transfer);
  window.addEventListener("message", async (event) => {
    if (
      used ||
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.type !== "oak-piece-render"
    )
      return;
    used = true;
    try {
      const pcm = await render(event.data.request as FrameRequest, (progress) =>
        send({ type: "oak-piece-progress", progress }),
      );
      send({ type: "oak-piece-rendered", pcm }, [pcm.left.buffer, pcm.right.buffer]);
    } catch (error) {
      send({ type: "oak-piece-failed", error: renderFailure(error) });
    }
  });
  send({ type: "oak-piece-ready" });
}
