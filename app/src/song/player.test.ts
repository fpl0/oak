// The song player (player.ts) over a fake PatternPlayer that keeps a scheduler cycle and honours the A–B loop the way
// the real one does (`barPosition`: cycle c sounds bar fromBar + c mod bars): letting a section loop go plays on from
// where the loop was, and the shell's Now playing shows a song while it plays.
import { beforeEach, describe, expect, mock, test } from "bun:test";

let cycle = 0;
let loop: { fromBar: number; bars: number } | null = null;
const barAt = (c: number) => (loop ? loop.fromBar + (((c % loop.bars) + loop.bars) % loop.bars) : c);
const fake = {
  playing: false,
  position: () => barAt(cycle),
  stop() {
    this.playing = false;
  },
  async load() {
    return { ok: true, tracks: ["band.oak.kick"] };
  },
  setLoop(next: { fromBar: number; bars: number } | null) {
    loop = next;
  },
  setMutes() {},
  async play() {
    this.playing = true;
  },
};
mock.module(new URL("../lib/oak.ts", import.meta.url).pathname, () => ({
  getOak: async () => ({ unlock: async () => {}, createPatternPlayer: () => fake }),
}));
mock.module(new URL("../lesson/band.ts", import.meta.url).pathname, () => ({ songBandSetupOf: () => ({}) }));
mock.module("@oak/strudel/song-compose", () => ({ songLengthBars: () => 64 }));
let frame: (() => void) | null = null;
Object.assign(globalThis, {
  requestAnimationFrame: (cb: () => void) => {
    frame = cb;
    return 1;
  },
  cancelAnimationFrame: () => {
    frame = null;
  },
});
const tick = () => {
  const cb = frame;
  frame = null;
  cb?.();
};

const { playOnWindow, playSong, setSongLoop, songPlayState, stopSong } = await import("./player.ts");
const { useShell } = await import("../lib/shell-store.ts");
const band = { def: { meter: "4/4", title: "Oak's title" } } as never;

beforeEach(() => {
  stopSong();
  cycle = 0;
  loop = null;
});

describe("letting a section loop go", () => {
  test("a loop started from the stop plays on after the section, never from the raw cycle", async () => {
    // The chorus, bars 17–24 (0-based 16–23) of a 64-bar song, looped from the stop.
    expect(await playSong("U01@now", band, { loop: { fromBar: 16, bars: 8 } })).toBe(true);
    cycle = 5.5;
    expect(fake.position()).toBe(21.5);
    setSongLoop("U01@now", null);
    expect(songPlayState().loop).toBeNull();
    // The bar sounding goes on: 21.5 → 22 → 24 (the bar after the chorus), not bar 6.
    expect(fake.position()).toBe(21.5);
    cycle = 6;
    expect(fake.position()).toBe(22);
    cycle = 8;
    expect(fake.position()).toBe(24);
    tick();
    expect(songPlayState().bar).toBe(24);
    // It ends at the song's last bar: 40 cycles after bar 24.
    cycle = 47.9;
    tick();
    expect(songPlayState().phase).toBe("playing");
    cycle = 48;
    tick();
    expect(songPlayState().phase).toBe("idle");
  });

  test("a loop set while the song plays through goes on from the bar it is sounding", async () => {
    await playSong("U01@now", band);
    cycle = 10;
    setSongLoop("U01@now", { fromBar: 16, bars: 8 });
    cycle = 13.25;
    const at = fake.position();
    expect(at).toBe(21.25);
    setSongLoop("U01@now", null);
    expect(fake.position()).toBe(at);
    cycle = 14;
    expect(fake.position()).toBe(22);
  });

  test("the window keeps the bar and never repeats before the song ends", () => {
    expect(playOnWindow(21.5, 5.5, 64)).toEqual({ fromBar: 16, bars: 49 });
    expect(playOnWindow(3, 3, 64)).toBeNull();
    expect(playOnWindow(2, 30, 64)?.fromBar).toBe(-28);
  });
});

describe("the shell's Now playing", () => {
  test("shows the song while it plays, with a Stop, and clears when it stops", async () => {
    await playSong("U06@now", band, { loop: { fromBar: 8, bars: 8 }, title: "My groove" });
    const np = useShell.getState().nowPlaying;
    expect(np?.label).toBe("Song: My groove");
    np?.stop();
    expect(songPlayState().phase).toBe("idle");
    expect(useShell.getState().nowPlaying).toBeNull();
    // Another source's Now playing stays when the song stops.
    useShell.getState().setNowPlaying({ label: "Tutor card: x", stop: () => {} });
    stopSong();
    expect(useShell.getState().nowPlaying?.label).toBe("Tutor card: x");
    useShell.getState().setNowPlaying(null);
  });
});
