import { describe, expect, test } from "bun:test";
import type { BleedReport } from "@oak/pitch";
import { FakeContext, FakeNode, FakeStream, FakeWorkletNode, framesBetween } from "./fakes.test-data.ts";
import { bindMicShortcut, createMicGraphWith, micConstraints, PITCH_PROCESSOR } from "./mic.ts";
import { MicError, type MicState } from "./types.ts";

function setup(
  over: {
    getUserMedia?: () => Promise<MediaStream>;
    createNodeThrowsFor0?: boolean;
    playback?: FakeNode;
  } = {},
) {
  const ctx = new FakeContext();
  const nodes: FakeWorkletNode[] = [];
  const streams: FakeStream[] = [];
  const graph = createMicGraphWith(ctx as unknown as AudioContext, {
    workletUrl: "/pitch.worklet.js",
    ...(over.playback ? { playback: () => over.playback as unknown as AudioNode } : {}),
    mediaDevices: {
      getUserMedia:
        over.getUserMedia ??
        (async () => {
          const s = new FakeStream();
          streams.push(s);
          return s as unknown as MediaStream;
        }),
    },
    createNode: (_c, name, options) => {
      if (over.createNodeThrowsFor0 && options.numberOfOutputs === 0) throw new Error("no output-less nodes");
      const n = new FakeWorkletNode(name, options);
      nodes.push(n);
      return n as unknown as AudioWorkletNode;
    },
  });
  const states: MicState[] = [];
  graph.subscribe((s) => states.push(s));
  return { ctx, graph, nodes, streams, states };
}

test("constraints: echo cancellation, noise suppression and AGC off, mono, exact device", () => {
  expect(micConstraints("abc")).toEqual({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      deviceId: { exact: "abc" },
    },
    video: false,
  });
});

describe("MicGraph", () => {
  test("prepare loads the module once and creates ONE output-less node with the proven options", async () => {
    const { ctx, graph, nodes } = setup();
    await graph.prepare();
    await graph.prepare();
    expect(ctx.modules).toEqual(["/pitch.worklet.js"]);
    expect(nodes.length).toBe(1);
    expect(nodes[0]?.name).toBe(PITCH_PROCESSOR);
    expect(nodes[0]?.options).toMatchObject({
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
      processorOptions: { warmUp: 8 },
    });
    expect(graph.outputs).toBe(0);
  });

  test("the spare path: output → GainNode(0) → destination when an output-less node cannot be made", async () => {
    const { ctx, graph, nodes } = setup({ createNodeThrowsFor0: true });
    await graph.prepare();
    expect(graph.outputs).toBe(1);
    expect(nodes[0]?.options.numberOfOutputs).toBe(1);
    expect(ctx.gains[0]?.gain.value).toBe(0);
    expect(ctx.gains[0]?.connected).toContain(ctx.destination);
  });

  test("a failed module load is not memoized", async () => {
    const { ctx, graph } = setup();
    ctx.failModule = true;
    await expect(graph.prepare()).rejects.toMatchObject({ reason: "worklet" });
    ctx.failModule = false;
    await graph.prepare();
    expect(ctx.modules.length).toBe(1);
  });

  test("open → live; frames reach the session; close stops tracks, disconnects, back to closed", async () => {
    const { ctx, graph, nodes, streams, states } = setup();
    ctx.currentTime = 5;
    const s = await graph.open();
    expect(graph.state).toBe("live");
    expect(states).toEqual(["closed", "opening", "live"]);
    const port = nodes[0]?.port;
    const got: number[] = [];
    s.onFrame((f) => got.push(f.t));
    port?.emit({ t: 4.5, hz: 440, clarity: 1, rms: 0.1 }); // before the session: stale, dropped
    port?.emit({ t: 5.05, hz: 440, clarity: 1, rms: 0.1 });
    port?.emit({ type: "pong" });
    expect(got).toEqual([5.05]);
    expect(s.frames().length).toBe(1);
    expect(s.levelDb()).toBeCloseTo(-20, 6);
    expect(s.deviceId).toBe("mic-1");
    expect(ctx.sources[0]?.connected).toContain(nodes[0]);
    s.close();
    expect(streams[0]?.tracks[0]?.stopped).toBe(true);
    expect(ctx.sources[0]?.connected).toEqual([]);
    expect(graph.state).toBe("closed");
    // The node stays for the next session.
    await graph.open();
    expect(nodes.length).toBe(1);
  });

  test("tap: the leak check's analyser hangs off the mic's source, never the output; a closed session taps nothing", async () => {
    const { ctx, graph, nodes } = setup();
    const s = await graph.open();
    const analyser = new FakeNode();
    const off = s.tap?.(analyser as unknown as AudioNode);
    expect(ctx.sources[0]?.connected).toEqual([nodes[0], analyser]);
    expect(ctx.destination.connected).toEqual([]);
    off?.();
    s.close();
    const late = new FakeNode();
    s.tap?.(late as unknown as AudioNode)();
    expect(ctx.sources[0]?.connected).toEqual([]);
  });

  test("a second open closes the first session; closeAll closes; an ended track closes", async () => {
    const { graph, streams } = setup();
    const a = await graph.open();
    const b = await graph.open();
    expect(streams[0]?.tracks[0]?.stopped).toBe(true);
    expect(graph.state).toBe("live");
    graph.closeAll();
    expect(graph.state).toBe("closed");
    const c = await graph.open();
    streams[2]?.tracks[0]?.end();
    expect(graph.state).toBe("closed");
    expect([a, b, c].length).toBe(3);
  });

  test("permission denied and no device are reported as MicError and as state", async () => {
    const denied = setup({
      getUserMedia: async () => {
        throw Object.assign(new Error("x"), { name: "NotAllowedError" });
      },
    });
    const err = await denied.graph.open().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MicError);
    expect((err as MicError).reason).toBe("denied");
    expect(denied.graph.state).toBe("denied");
    const none = setup({
      getUserMedia: async () => {
        throw Object.assign(new Error("x"), { name: "NotFoundError" });
      },
    });
    await expect(none.graph.open()).rejects.toMatchObject({ reason: "no-device" });
    expect(none.graph.state).toBe("unavailable");
  });

  test("a suspended context is resumed first", async () => {
    const { ctx, graph } = setup();
    ctx.state = "suspended";
    await graph.open();
    expect(ctx.state as AudioContextState).toBe("running");
  });

  test("dispose tells the processor to stop and refuses further use", async () => {
    const { graph, nodes } = setup();
    await graph.open();
    graph.dispose();
    expect(nodes[0]?.port.sent).toContainEqual({ type: "dispose" });
    expect(graph.state).toBe("closed");
    await expect(graph.open()).rejects.toBeInstanceOf(MicError);
  });

  test("listening to Oak's output: frames carry what played, the session's bleed check trips once", async () => {
    const output = new FakeNode();
    const { ctx, graph, nodes } = setup({ playback: output });
    await graph.prepare();
    expect(nodes.length).toBe(2);
    expect(output.connected).toEqual([]);
    ctx.currentTime = 1;
    const s = await graph.open();
    // The output node feeds the second pitch node only while a session is open.
    expect(output.connected).toContain(nodes[1]);
    const mic = nodes[0]?.port;
    const out = nodes[1]?.port;
    const trips: BleedReport[] = [];
    s.onBleed?.((r) => trips.push(r));
    // A cue plays C4 from 1.0 to 2.0 s; the learner sings E4 in the window 2.5–3.5 s (marked as singing) while
    // the cue leaks into the mic at 1.0–2.0 s.
    s.singing?.({ on: 2.5, off: 3.5 });
    const cue = framesBetween(1, 2.2, (tc) => ({ midi: tc >= 1 && tc < 2 ? 60 : null, rms: 0.2 }));
    const leak = framesBetween(1, 2.2, (tc) => ({ midi: tc >= 1.05 && tc < 2.05 ? 60.1 : null }));
    for (let i = 0; i < cue.length; i++) {
      out?.emit(cue[i]);
      if (leak[i]) mic?.emit(leak[i]);
    }
    expect(s.frames().some((f) => (f.playing ?? []).length > 0)).toBe(true);
    expect(trips.length).toBe(1);
    expect(s.bleed?.()?.bleed).toBe(true);
    // Singing over a later playback, in the marked window, never trips anything (already tripped: once only).
    for (const f of framesBetween(2.5, 3.5, () => ({ midi: 64 }))) mic?.emit(f);
    expect(trips.length).toBe(1);
    s.close();
    expect(output.connected).toEqual([]);
  });

  test("singing along in the marked window with the output playing the same note is not bleed", async () => {
    const output = new FakeNode();
    const { ctx, graph, nodes } = setup({ playback: output });
    ctx.currentTime = 1;
    const s = await graph.open();
    s.singing?.({ on: 1.2, off: 2.8 });
    const both = framesBetween(1, 3, (tc) => ({ midi: tc >= 1.3 && tc < 2.7 ? 62 : null, rms: 0.2 }));
    for (const f of both) {
      nodes[1]?.port.emit(f);
      nodes[0]?.port.emit(f);
    }
    expect(s.bleed?.()?.bleed).toBe(false);
    expect(s.bleed?.()?.heardSec).toBe(0);
  });

  test("without a playback node there is no second node and no bleed check", async () => {
    const { graph, nodes } = setup();
    const s = await graph.open();
    expect(nodes.length).toBe(1);
    expect(s.bleed?.()).toBeNull();
  });

  test("Cmd/Ctrl+Shift+M closes the mic", () => {
    let closed = 0;
    const target = new EventTarget();
    const off = bindMicShortcut({ closeAll: () => closed++ }, target);
    const key = (o: Record<string, unknown>) =>
      target.dispatchEvent(Object.assign(new Event("keydown"), { preventDefault() {}, ...o }));
    key({ key: "M", metaKey: true, shiftKey: true, ctrlKey: false });
    key({ key: "m", metaKey: false, shiftKey: true, ctrlKey: true });
    key({ key: "m", metaKey: true, shiftKey: false, ctrlKey: false });
    expect(closed).toBe(2);
    off();
    key({ key: "m", metaKey: true, shiftKey: true, ctrlKey: false });
    expect(closed).toBe(2);
  });
});
