// Oak 2.0 W1 listen-through (PLAN S4). Review Focus 4: the record tap and the analyser are fed before the
// listen-through stage, so a muffled or quiet listen never reaches a recording or a meter reading.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { LISTEN_THROUGH } from "./listen-through.ts";
import { createMasterBus } from "./master-bus.ts";

// --- a fake Web Audio graph that records connect edges ----------------------------------------------

class FakeParam {
  constructor(public value: number) {}
  setTargetAtTime(v: number): this {
    this.value = v;
    return this;
  }
  setValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  static all: FakeNode[] = [];
  readonly out = new Set<FakeNode>();
  constructor(public readonly kind: string) {
    FakeNode.all.push(this);
  }
  connect(to: FakeNode): FakeNode {
    this.out.add(to);
    return to;
  }
  disconnect(to?: FakeNode): void {
    if (to) this.out.delete(to);
    else this.out.clear();
  }
}

class FakeGain extends FakeNode {
  gain: FakeParam;
  constructor(_ctx: unknown, opts: { gain?: number } = {}) {
    super("gain");
    this.gain = new FakeParam(opts.gain ?? 1);
  }
}
class FakeBiquad extends FakeNode {
  type: string;
  frequency: FakeParam;
  Q: FakeParam;
  constructor(_ctx: unknown, opts: { type?: string; frequency?: number; Q?: number } = {}) {
    super("biquad");
    this.type = opts.type ?? "lowpass";
    this.frequency = new FakeParam(opts.frequency ?? 350);
    this.Q = new FakeParam(opts.Q ?? 1);
  }
}
class FakeCompressor extends FakeNode {
  constructor() {
    super("compressor");
  }
}
class FakeAnalyser extends FakeNode {
  fftSize: number;
  constructor(_ctx: unknown, opts: { fftSize?: number } = {}) {
    super("analyser");
    this.fftSize = opts.fftSize ?? 2048;
  }
}

const GLOBALS = ["GainNode", "BiquadFilterNode", "DynamicsCompressorNode", "AnalyserNode"] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  for (const name of GLOBALS) saved.set(name, Object.getOwnPropertyDescriptor(g, name));
  g.GainNode = FakeGain;
  g.BiquadFilterNode = FakeBiquad;
  g.DynamicsCompressorNode = FakeCompressor;
  g.AnalyserNode = FakeAnalyser;
});
afterAll(() => {
  const g = globalThis as Record<string, unknown>;
  for (const name of GLOBALS) {
    const d = saved.get(name);
    if (d) Object.defineProperty(g, name, d);
    else delete g[name];
  }
});

function fakeCtx() {
  const destination = new FakeNode("destination");
  return {
    destination,
    currentTime: 0,
    sampleRate: 48000,
    createMediaStreamDestination: () => new FakeNode("tap"),
  };
}

/** Every node reachable from `from`, not passing through `avoid` (`from` itself excluded). */
function reach(from: FakeNode, avoid: ReadonlySet<FakeNode> = new Set()): Set<FakeNode> {
  const seen = new Set<FakeNode>();
  const stack = [...from.out];
  while (stack.length > 0) {
    const n = stack.pop() as FakeNode;
    if (seen.has(n) || avoid.has(n)) continue;
    seen.add(n);
    stack.push(...n.out);
  }
  return seen;
}

/** The nodes on the way from `from` to `to` (both excluded), following the only branch that reaches `to`. */
function pathNodes(from: FakeNode, to: FakeNode): FakeNode[] {
  const path: FakeNode[] = [];
  let at = from;
  while (at !== to) {
    const next = [...at.out].find((n) => n === to || reach(n).has(to));
    if (!next) throw new Error("no path");
    if (next !== to) path.push(next);
    at = next;
  }
  return path;
}

function busGraph() {
  FakeNode.all = [];
  const ctx = fakeCtx();
  const bus = createMasterBus(ctx as unknown as AudioContext);
  const trim = bus.trim as unknown as FakeNode;
  const analyser = bus.analyser as unknown as FakeNode;
  const tapGain = bus.tapGain as unknown as FakeNode;
  const tap = bus.tap as unknown as FakeNode;
  // `volume` is trim's one child that is neither the analyser nor the record tap.
  const volume = [...trim.out].find((n) => n !== analyser && n !== tapGain) as FakeNode;
  const listenNodes = new Set([...reach(volume)].filter((n) => n !== ctx.destination));
  return { ctx, bus, trim, analyser, tapGain, tap, volume, listenNodes };
}

describe("the listen-through stage on the master bus", () => {
  test("the record tap and the analyser are fed before the listen-through stage", () => {
    const { ctx, bus, trim, analyser, tapGain, tap, volume, listenNodes } = busGraph();
    expect(volume).toBeDefined();
    expect(listenNodes.size).toBeGreaterThan(0);
    // The analyser and the record tap hang off trim and never pass a listen node.
    const fromTrim = reach(trim, new Set([volume, ...listenNodes]));
    expect(fromTrim.has(analyser)).toBe(true);
    expect(fromTrim.has(tapGain)).toBe(true);
    expect(fromTrim.has(tap)).toBe(true);
    for (const n of listenNodes) {
      expect(reach(n).has(analyser)).toBe(false);
      expect(reach(n).has(tapGain)).toBe(false);
    }
    // The speakers are reached only through the stage, whatever the mode.
    for (const mode of [null, "muffled", "small-speaker", "quiet", null] as const) {
      bus.setListenThrough(mode);
      const now = new Set([...reach(volume)].filter((n) => n !== ctx.destination));
      expect(reach(bus.input as unknown as FakeNode, now).has(ctx.destination)).toBe(false);
      expect(reach(volume).has(ctx.destination)).toBe(true);
      expect(volume.out.has(ctx.destination)).toBe(false);
    }
  });

  test('setListenThrough("muffled") sets a lowpass to 700 and null makes the stage pass-through', () => {
    const { ctx, bus, volume } = busGraph();
    expect(bus.listenThrough()).toBeNull();

    bus.setListenThrough("muffled");
    expect(bus.listenThrough()).toBe("muffled");
    let path = pathNodes(volume, ctx.destination);
    const lowpass = path.find((n) => n instanceof FakeBiquad && n.type === "lowpass") as FakeBiquad;
    expect(lowpass?.frequency.value).toBe(700);
    expect(path.some((n) => n instanceof FakeBiquad && n.type === "highpass")).toBe(false);

    bus.setListenThrough("small-speaker");
    path = pathNodes(volume, ctx.destination);
    const biquads = path.filter((n): n is FakeBiquad => n instanceof FakeBiquad);
    expect(biquads.map((b) => [b.type, b.frequency.value])).toEqual([
      ["lowpass", 4000],
      ["highpass", 400],
    ]);
    const quieter = path.filter((n): n is FakeGain => n instanceof FakeGain).map((g) => g.gain.value);
    expect(quieter.some((v) => Math.abs(v - 10 ** (-6 / 20)) < 1e-9)).toBe(true);

    bus.setListenThrough("quiet");
    path = pathNodes(volume, ctx.destination);
    expect(path.some((n) => n instanceof FakeBiquad)).toBe(false);
    expect(
      path
        .filter((n): n is FakeGain => n instanceof FakeGain)
        .some((g) => Math.abs(g.gain.value - 10 ** (-24 / 20)) < 1e-9),
    ).toBe(true);

    bus.setListenThrough(null);
    expect(bus.listenThrough()).toBeNull();
    path = pathNodes(volume, ctx.destination);
    expect(path.some((n) => n instanceof FakeBiquad)).toBe(false);
    for (const n of path) expect(n instanceof FakeGain && n.gain.value).toBe(1);
  });

  test("LISTEN_THROUGH has exactly the three modes", () => {
    expect(Object.keys(LISTEN_THROUGH).sort()).toEqual(["muffled", "quiet", "small-speaker"]);
    expect(LISTEN_THROUGH.muffled).toEqual({ lowpassHz: 700, highpassHz: null, gainDb: 0 });
    expect(LISTEN_THROUGH["small-speaker"]).toEqual({ lowpassHz: 4000, highpassHz: 400, gainDb: -6 });
    expect(LISTEN_THROUGH.quiet).toEqual({ lowpassHz: null, highpassHz: null, gainDb: -24 });
  });
});
