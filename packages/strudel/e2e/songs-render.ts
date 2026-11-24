// The render frame of the song loudness harness (songs.pw.ts): one unit song, played the way the offline export plays
// it (src/offline/frame.ts: prepareBandFor → evaluatePreparedBand → finalizePattern, the ordered mix, the seeded
// worklets, the preroll and the quantized scheduling), with two differences a measurement needs:
//
//  - a window of bars (`fromBar`–`toBar`, with `leadBars` rendered before it and cut), so a take's sections render
//    without the whole song;
//  - `raw`: the master limiter is bypassed (a pass-through with the limiter's makeup gain, which the trim after it takes
//    back), so peaks and loudness are read before the limiter, as the Bands' budgets are (sound-wave5.json "bands").
//
// One render per frame instance (superdough's pools cannot switch contexts).
import * as core from "@strudel/core";
import { transpiler } from "@strudel/transpiler";
import * as webaudio from "@strudel/webaudio";
import { prepareBandFor } from "../src/band.ts";
import {
  evaluatePreparedBand,
  finalizePattern,
  installTrackWrapper,
  newSession,
  songCps,
} from "../src/evaluation.ts";
import { missingSoundOf } from "../src/logs.ts";
import { LIMITER, limiterMakeupDb } from "../src/master-bus.ts";
import { checkSource } from "../src/offline/bounds.ts";
import { prerollFrames } from "../src/offline/frame.ts";
import { attachOfflineMaster } from "../src/offline/master.ts";
import { orderedMix } from "../src/offline/mix.ts";
import { seedRandom, seedWorklet } from "../src/offline/random.ts";
import { type HapValue, prebake } from "../src/pack.ts";
import { warmAll } from "../src/preload.ts";
import { type SongBandWire, songBandFromWire, songBandTracks } from "../src/song-compose.ts";
import type { BandSetup } from "../src/types.ts";
import { SOUNDS_ROOT } from "./pack-root.ts";

export interface SongRenderRequest {
  type: "oak-song-render";
  id: number;
  song: SongBandWire;
  /** The live Make's code (a take's reference), or "" for Oak's song alone. */
  code: string;
  /** Track names muted (`band.oak.kick`, the live Make's labels, `main`). */
  muted: string[];
  /** Mute a side as a whole: the live Make's tracks (`learner`) or every Oak part (`oak`). */
  mute?: "learner" | "oak";
  fromBar: number;
  toBar: number;
  /** Bars rendered before `fromBar` and cut (held notes and tails that ring into the window). */
  leadBars: number;
  raw: boolean;
  sampleRate: number;
}

export interface SongRenderReply {
  type: "oak-song-rendered";
  id: number;
  left?: Float32Array;
  right?: Float32Array;
  cps?: number;
  haps?: number;
  missing?: string[];
  ms?: number;
  error?: string;
}

/** The limiter as a pass-through: its makeup gain only, so the trim after it nets 0 dB. */
function bypassLimiter(): void {
  const Real = window.DynamicsCompressorNode;
  const makeup = 10 ** (limiterMakeupDb() / 20);
  // `new` keeps working: the limiter's own options get the pass-through, anything else a real compressor.
  window.DynamicsCompressorNode = new Proxy(Real, {
    construct(target, args: [BaseAudioContext, DynamicsCompressorOptions?]) {
      const [ctx, options] = args;
      const isLimiter =
        options?.threshold === LIMITER.threshold && options?.ratio === LIMITER.ratio && options?.knee === 0;
      return isLimiter ? new GainNode(ctx, { gain: makeup }) : new target(ctx, options);
    },
  });
}

interface OfflineRepl {
  evaluate(code: string, autostart: boolean): Promise<Strudel.Pattern | undefined>;
  setCps(cps: number): void;
  scheduler: { cps: number };
}

async function render(req: SongRenderRequest): Promise<Omit<SongRenderReply, "type" | "id">> {
  const t0 = performance.now();
  if (req.raw) bypassLimiter();
  seedRandom();
  const missing = new Set<string>();
  webaudio.setLogger((message: unknown) => {
    const name = missingSoundOf(String(message));
    if (name) missing.add(name);
  });
  await prebake(SOUNDS_ROOT);
  const song = songBandFromWire(req.song);
  const band: BandSetup = {
    band: "band.unit-song" as BandSetup["band"],
    flavour: song.flavour,
    code: "",
    followsLearnerKey: false,
    tracks: songBandTracks(song),
    song,
  };
  const session = newSession();
  const mutes = { muted: new Set(req.muted), solo: null };
  const repl = core.repl({
    id: "oak_songs_",
    getTime: () => 0,
    transpiler,
    beforeEval: async () => {
      installTrackWrapper(session, () => mutes);
      const prepared = prepareBandFor(band, {
        key: song.def.key,
        defaultBpm: 120,
        learnerCode: req.code.trim() ? req.code : "silence",
      });
      if (prepared.kind !== "song") throw new Error("not a song");
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
    },
    editPattern: (pattern: Strudel.Pattern) => finalizePattern(pattern, { session, mutes: () => mutes }),
    onEvalError: (error: unknown) => {
      session.error = error;
    },
  }) as OfflineRepl;
  // As the export (src/offline/request.ts): a song with no code of its own plays alone over `silence`.
  const pattern = await repl.evaluate(req.code.trim() ? req.code : "silence", false);
  if (session.error || !pattern) throw new Error(`evaluation: ${String(session.error ?? "no pattern")}`);
  // Mutes are read live, when the pattern is queried: the live Make's labels are known only now.
  if (req.mute === "learner") for (const t of ["main", ...session.tracks]) mutes.muted.add(t);
  if (req.mute === "oak") for (const p of song.def.parts) mutes.muted.add(`band.oak.${p.label}`);
  const cps = repl.scheduler.cps;
  const start = Math.max(0, req.fromBar - req.leadBars);
  const haps: Strudel.Hap[] = [];
  for (let bar = start; bar < req.toBar; bar++)
    for (const hap of pattern.queryArc(bar, bar + 1, { _cps: cps, cyclist: "cyclist" }))
      if (hap.hasOnset()) haps.push(hap);
  haps.sort((a, b) => Number(a.whole?.begin.valueOf()) - Number(b.whole?.begin.valueOf()));
  for (const hap of haps) (hap as unknown as { ensureObjectValue(): void }).ensureObjectValue();

  const preroll = prerollFrames(req.sampleRate);
  const lead = preroll / req.sampleRate;
  const total = preroll + Math.ceil(((req.toBar - start) / cps) * req.sampleRate);
  const ctx = new OfflineAudioContext(2, total, req.sampleRate);
  webaudio.setAudioContext(ctx);
  webaudio.setSuperdoughAudioController(null);
  await seedWorklet(ctx);
  const mix = orderedMix(ctx);
  await webaudio.initAudio({ maxPolyphony: 128 });
  attachOfflineMaster(ctx);
  const warmed = await warmAll(haps.map((h) => ({ s: "sine", ...(h.value as HapValue) })));
  for (const name of warmed.missing) missing.add(name);
  const waitForReverb = async () => {
    const orbits = Object.values(webaudio.getSuperdoughAudioController().nodes ?? {}) as {
      reverbNode?: ConvolverNode;
    }[];
    const deadline = performance.now() + 5000;
    while (orbits.some((o) => o.reverbNode && !o.reverbNode.buffer)) {
      if (performance.now() > deadline) throw new Error("the reverb never finished loading");
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
    }
  };
  let at = 0;
  const schedule = async (until: number) => {
    while (at < haps.length) {
      const hap = haps[at] as Strudel.Hap;
      const time = (Number(hap.whole?.begin.valueOf()) - start) / cps + lead;
      if (time >= until) break;
      const duration =
        Number((hap as unknown as { duration: { valueOf(): number } }).duration.valueOf()) / cps;
      if (!hap.context.onTrigger || !hap.context.dominantTrigger)
        await webaudio.webaudioOutput(hap, time - ctx.currentTime, duration, cps, time);
      if (typeof hap.context.onTrigger === "function")
        await hap.context.onTrigger(hap, ctx.currentTime, cps, time);
      at++;
      if (at % 32 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    await waitForReverb();
  };
  // As the export: voices are queued as time advances, one scheduling step at a time.
  const step = prerollFrames(req.sampleRate);
  let boundary = Math.min(step, total);
  await schedule(boundary / req.sampleRate);
  mix.flush();
  let suspended = boundary < total ? ctx.suspend(boundary / req.sampleRate) : null;
  const rendering = ctx.startRendering();
  void rendering.catch(() => undefined);
  while (suspended) {
    await suspended;
    boundary = Math.min(boundary + step, total);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await schedule(boundary / req.sampleRate);
    mix.flush();
    suspended = boundary < total ? ctx.suspend(boundary / req.sampleRate) : null;
    await ctx.resume();
  }
  const buffer = await rendering;
  mix.restore();
  // Cut the preroll and the lead bars: the window starts at `fromBar`.
  const cut = preroll + Math.round(((req.fromBar - start) / cps) * req.sampleRate);
  return {
    left: buffer.getChannelData(0).slice(cut),
    right: buffer.getChannelData(1).slice(cut),
    cps,
    haps: haps.length,
    missing: [...missing].sort(),
    ms: Math.round(performance.now() - t0),
  };
}

window.addEventListener("message", async (event) => {
  if (event.source !== window.parent || event.data?.type !== "oak-song-render") return;
  const req = event.data as SongRenderRequest;
  try {
    const out = await render(req);
    const transfer = [out.left?.buffer, out.right?.buffer].filter(Boolean) as ArrayBuffer[];
    window.parent.postMessage({ type: "oak-song-rendered", id: req.id, ...out }, location.origin, transfer);
  } catch (error) {
    window.parent.postMessage(
      { type: "oak-song-rendered", id: req.id, error: String((error as Error)?.stack ?? error) },
      location.origin,
    );
  }
});
window.parent.postMessage({ type: "oak-song-ready" }, location.origin);
