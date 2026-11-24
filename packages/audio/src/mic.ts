// The microphone path (contracts §8.6, spike S5). One AudioWorkletNode for the whole session, created at
// audio unlock or calibration (its constructor costs 6 to 12 ms on the render thread); a sing step only
// opens and closes the MediaStream and its source node. The mic is never connected to the destination.
// This module takes the worklet URL as an argument; `createMicGraph` in index.ts supplies the default
// `?worker&url` one, so this file also loads outside Vite (bun tests).
import type { BleedReport, PitchFrame } from "@oak/pitch";
import { BleedWatch, PlaybackHistory, rmsDb, SINGING_MARGIN_SEC, WINDOW_SIZE } from "@oak/pitch";
import { MicError, type MicGraph, type MicSession, type MicState } from "./types.ts";

/** Name the worklet registers under. */
export const PITCH_PROCESSOR = "oak-pitch";

/** getUserMedia constraints: no echo cancellation, noise suppression or AGC; mono. */
export function micConstraints(deviceId?: string | null): MediaStreamConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  };
  if (deviceId) audio.deviceId = { exact: deviceId };
  return { audio, video: false };
}

export interface MicGraphOptions {
  workletUrl: string;
  lowVoice?: boolean;
  /**
   * 0 (default): the proven output-less node. 1: the spare path, output → GainNode(0) → destination, for a
   * browser that stops pulling output-less worklets. Chosen automatically when constructing with 0 throws.
   */
  outputs?: 0 | 1;
  /** Detector warm-up runs in the processor constructor. Default 8. */
  warmUp?: number;
  /**
   * Wave 4 (contracts §8.6, runtime bleed detection): Oak's own output (the master bus, post-limiter). While a
   * session is open a second pitch node listens to it, every mic frame gets `playing` (what the output had over
   * the last `PLAYBACK_LAG_SEC`) and the session runs the bleed check (`MicSession.bleed`). A function is read
   * at each `open`, so an output created after the graph still counts.
   */
  playback?: AudioNode | (() => AudioNode | null);
  /** Injection points for tests. */
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  createNode?: (ctx: BaseAudioContext, name: string, options: AudioWorkletNodeOptions) => AudioWorkletNode;
}

/** A frame older than this before the session opened came from the previous take: dropped. */
const STALE_SEC = 0.01;

export function createMicGraphWith(
  ctx: AudioContext,
  opts: MicGraphOptions,
): MicGraph & { readonly lowVoice: boolean; readonly outputs: 0 | 1 } {
  let state: MicState = "closed";
  const listeners = new Set<(s: MicState) => void>();
  let node: AudioWorkletNode | null = null;
  /** Wave 4: the second pitch node, on Oak's output (`opts.playback`), connected only while a session is open. */
  let playNode: AudioWorkletNode | null = null;
  let sink: GainNode | null = null;
  let outputs: 0 | 1 = opts.outputs ?? 0;
  let preparing: Promise<void> | null = null;
  let session: Session | null = null;
  let disposed = false;
  const mediaDevices = (): Pick<MediaDevices, "getUserMedia"> | undefined =>
    opts.mediaDevices ?? (typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);
  const makeNode =
    opts.createNode ??
    ((c: BaseAudioContext, name: string, o: AudioWorkletNodeOptions) => new AudioWorkletNode(c, name, o));

  const setState = (next: MicState) => {
    if (next === state) return;
    state = next;
    for (const cb of [...listeners]) cb(next);
  };

  class Session implements MicSession {
    readonly deviceId: string | null;
    readonly sampleRate = ctx.sampleRate;
    readonly openedAt: number;
    private readonly all: PitchFrame[] = [];
    private readonly subs = new Set<(f: PitchFrame) => void>();
    private lastRms = 0;
    private readonly history: PlaybackHistory | null;
    private readonly watch: BleedWatch | null;
    private readonly bleedSubs = new Set<(r: BleedReport) => void>();
    private readonly windows: { on: number; off: number }[] = [];
    closed = false;
    constructor(
      private readonly stream: MediaStream,
      private readonly source: MediaStreamAudioSourceNode,
      private readonly output: AudioNode | null,
    ) {
      this.history = output ? new PlaybackHistory() : null;
      this.watch = output ? new BleedWatch() : null;
      const track = stream.getAudioTracks()[0];
      this.deviceId = track?.getSettings().deviceId ?? null;
      this.openedAt = ctx.currentTime;
      // A device that disappears (unplugged, revoked) ends the session.
      track?.addEventListener("ended", () => this.close());
    }
    receive(raw: PitchFrame): void {
      if (this.closed || raw.t < this.openedAt - STALE_SEC) return;
      const frame = this.history ? { ...raw, playing: this.history.at(raw.t) } : raw;
      this.all.push(frame);
      this.lastRms = frame.rms;
      if (this.watch) {
        const was = this.watch.report.bleed;
        const centre = frame.t - WINDOW_SIZE / 2 / ctx.sampleRate;
        const singing = this.windows.some(
          (w) => centre >= w.on - SINGING_MARGIN_SEC && centre <= w.off + SINGING_MARGIN_SEC,
        );
        if (this.watch.push(frame, singing) && !was) {
          const report = this.watch.report;
          for (const cb of [...this.bleedSubs]) cb(report);
        }
      }
      for (const cb of [...this.subs]) cb(frame);
    }
    hearOutput(frame: PitchFrame): void {
      if (!this.closed) this.history?.push(frame);
    }
    bleed(): BleedReport | null {
      return this.watch ? this.watch.report : null;
    }
    onBleed(cb: (report: BleedReport) => void): () => void {
      this.bleedSubs.add(cb);
      return () => this.bleedSubs.delete(cb);
    }
    singing(window: { on: number; off: number }): void {
      if (window.off > window.on) this.windows.push({ on: window.on, off: window.off });
    }
    tap(node: AudioNode): () => void {
      if (this.closed) return () => {};
      this.source.connect(node);
      return () => {
        try {
          this.source.disconnect(node);
        } catch {
          // already disconnected (the session closed first)
        }
      };
    }
    onFrame(cb: (frame: PitchFrame) => void): () => void {
      this.subs.add(cb);
      return () => this.subs.delete(cb);
    }
    frames(): PitchFrame[] {
      return [...this.all];
    }
    levelDb(): number {
      return rmsDb(this.lastRms);
    }
    close(): void {
      if (this.closed) return;
      this.closed = true;
      for (const t of this.stream.getTracks()) t.stop();
      try {
        this.source.disconnect();
      } catch {
        // already disconnected
      }
      this.subs.clear();
      this.bleedSubs.clear();
      if (this.output && playNode) {
        try {
          this.output.disconnect(playNode);
        } catch {
          // already disconnected
        }
      }
      if (session === this) {
        session = null;
        setState("closed");
      }
    }
  }

  async function prepare(): Promise<void> {
    if (disposed) throw new MicError("context", "@oak/audio: the mic graph was disposed");
    if (node) return;
    if (!preparing) {
      preparing = (async () => {
        try {
          await ctx.audioWorklet.addModule(opts.workletUrl);
        } catch (err) {
          throw new MicError("worklet", `@oak/audio: pitch worklet failed to load: ${String(err)}`);
        }
        const options = (n: 0 | 1): AudioWorkletNodeOptions => ({
          numberOfInputs: 1,
          numberOfOutputs: n,
          ...(n === 1 ? { outputChannelCount: [1] } : {}),
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
          processorOptions: { warmUp: opts.warmUp ?? 8 },
        });
        try {
          node = makeNode(ctx, PITCH_PROCESSOR, options(outputs));
        } catch (err) {
          if (outputs === 1) throw new MicError("worklet", `@oak/audio: pitch node failed: ${String(err)}`);
          outputs = 1;
          node = makeNode(ctx, PITCH_PROCESSOR, options(1));
        }
        if (outputs === 1) {
          sink = ctx.createGain();
          sink.gain.value = 0;
          node.connect(sink);
          sink.connect(ctx.destination);
        }
        node.port.onmessage = (event: MessageEvent) => {
          const f = event.data as PitchFrame | { type: string };
          if ("t" in f) session?.receive(f);
        };
        if (opts.playback) {
          playNode = makeNode(ctx, PITCH_PROCESSOR, options(outputs));
          if (outputs === 1 && sink) playNode.connect(sink);
          playNode.port.onmessage = (event: MessageEvent) => {
            const f = event.data as PitchFrame | { type: string };
            if ("t" in f) session?.hearOutput(f);
          };
        }
      })();
      // A failure is not memoized: the next call tries again.
      preparing.catch(() => {
        preparing = null;
      });
    }
    return preparing;
  }

  async function open(o: { deviceId?: string | null } = {}): Promise<MicSession> {
    if (disposed) throw new MicError("context", "@oak/audio: the mic graph was disposed");
    session?.close();
    setState("opening");
    try {
      if (ctx.state !== "running") {
        await Promise.race([
          ctx.resume(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("resume timed out")), 2000)),
        ]).catch((err: unknown) => {
          throw new MicError("context", `@oak/audio: the audio context is not running: ${String(err)}`);
        });
      }
      await prepare();
      const md = mediaDevices();
      if (!md) throw new MicError("no-device", "@oak/audio: no mediaDevices in this browser");
      let stream: MediaStream;
      try {
        stream = await md.getUserMedia(micConstraints(o.deviceId));
      } catch (err) {
        const name = (err as { name?: string }).name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          throw new MicError("denied", "@oak/audio: microphone permission denied");
        }
        throw new MicError("no-device", `@oak/audio: no usable microphone (${name || String(err)})`);
      }
      if (disposed || state !== "opening") {
        for (const t of stream.getTracks()) t.stop();
        throw new MicError("context", "@oak/audio: the mic was closed while opening");
      }
      const source = ctx.createMediaStreamSource(stream);
      source.connect(node as AudioWorkletNode);
      const output = typeof opts.playback === "function" ? opts.playback() : (opts.playback ?? null);
      const listening = output && playNode ? output : null;
      if (listening) listening.connect(playNode as AudioWorkletNode);
      session = new Session(stream, source, listening);
      setState("live");
      return session;
    } catch (err) {
      const e =
        err instanceof MicError ? err : new MicError("context", `@oak/audio: mic failed: ${String(err)}`);
      if (state === "opening")
        setState(e.reason === "denied" ? "denied" : e.reason === "no-device" ? "unavailable" : "closed");
      throw e;
    }
  }

  return {
    get lowVoice() {
      return opts.lowVoice ?? false;
    },
    get outputs() {
      return outputs;
    },
    prepare,
    open,
    get state() {
      return state;
    },
    subscribe(cb) {
      listeners.add(cb);
      cb(state);
      return () => listeners.delete(cb);
    },
    closeAll() {
      if (session) session.close();
      else if (state === "opening") setState("closed");
    },
    dispose() {
      if (disposed) return;
      session?.close();
      disposed = true;
      for (const n of [node, playNode]) {
        if (!n) continue;
        n.port.postMessage({ type: "dispose" });
        n.port.onmessage = null;
        n.disconnect();
      }
      playNode = null;
      sink?.disconnect();
      node = null;
      setState("closed");
      listeners.clear();
    },
  };
}

/** `Cmd/Ctrl+Shift+M` closes the mic. Returns the remover. */
export function bindMicShortcut(graph: Pick<MicGraph, "closeAll">, target: EventTarget = window): () => void {
  const onKey = (e: Event) => {
    const k = e as KeyboardEvent;
    if ((k.metaKey || k.ctrlKey) && k.shiftKey && k.key.toLowerCase() === "m") {
      k.preventDefault();
      graph.closeAll();
    }
  };
  target.addEventListener("keydown", onKey);
  return () => target.removeEventListener("keydown", onKey);
}
