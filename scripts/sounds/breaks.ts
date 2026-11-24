// Oak's rendered drum breaks (`s("brkfunk")` ...): original two-bar grooves, each at its own native tempo,
// played sample by sample from the one-shots of Oak's CC0 kits (rockkit, jazzkit, lofikit, oak909) and mixed
// like a recorded kit: panned, a small room under it, and for the lo-fi styles Oak's lo-fi chain and a vinyl
// bed. The grooves are written here ("in the style of", never a transcription of a record), so the renders
// are Oak's own work, released CC0. Every onset is known, so each break ships a slice table (breaks.json):
// lessons can `.slice()` and `.splice()` on real hits. Deterministic: fixed tables and seeded humanising.
//
// `brk` (one bar at 96, from the uzu-drumkit) is rendered by brk.ts and stays byte-identical.

import { frames, fromDb, peak, RATE } from "./audio.ts";
import type { Pcm } from "./brk.ts";
import { lofi, rng, room } from "./dsp.ts";
import type { DrumRole } from "./library.ts";

/** Where a track's hits come from: an Oak kit's role and variant (`n`). */
export interface BreakVoice {
  kit: string;
  role: DrumRole;
  n?: number;
}

/**
 * One track: a pattern string per bar, one character per step. `X` accent (1.0), `x` normal (0.8),
 * `o` ghost (0.45), `g` feather (0.3), `.` rest.
 */
export interface BreakTrack {
  voice: BreakVoice;
  pan: number;
  bars: string[];
  /** Level of the track in the mix (dB). */
  db?: number;
  /** A closed hat on this voice chokes the ringing open hat of `chokes`. */
  chokes?: string;
  /** Track name, for the slice table. */
  name: string;
}

export interface BreakSpec {
  bpm: number;
  /** Steps per bar: 16 (sixteenths) or 12 (eighth-note triplets). */
  steps: 16 | 12;
  /** Where the off-step lands within its pair, 0.5 = straight (16-step grids only). */
  swing: number;
  tracks: BreakTrack[];
  /** Room level (dB below the dry kit), or null for none. */
  roomDb: number | null;
  lofi?: boolean;
  /** Mix the `vinyl` texture under the break at this level (dB). */
  vinylDb?: number;
  /** Humanising: timing spread (ms) and level spread (dB), seeded. */
  feelMs: number;
  feelDb: number;
  seed: number;
}

const V = (kit: string, role: DrumRole, n?: number): BreakVoice => ({
  kit,
  role,
  ...(n !== undefined ? { n } : {}),
});

export const BREAKS: Record<string, BreakSpec> = {
  // A tight funk groove at 100: syncopated kick, ghosted snare, sixteenth hats, tambourine on 2 and 4.
  brkfunk: {
    bpm: 100,
    steps: 16,
    swing: 0.52,
    roomDb: -16,
    feelMs: 3,
    feelDb: 1,
    seed: 101,
    tracks: [
      { name: "kick", voice: V("rockkit", "bd"), pan: 0, bars: ["X.....x.X.....x.", "X.....x.X..x...."] },
      {
        name: "snare",
        voice: V("rockkit", "sd"),
        pan: -0.08,
        bars: ["....X..o.o..X..o", "....X..o.o..X.oX"],
      },
      {
        name: "hat",
        voice: V("rockkit", "hh"),
        pan: 0.3,
        db: -2,
        chokes: "open",
        bars: ["XoxoXoxoXoxoXo.o", "XoxoXoxoXoxoX..."],
      },
      {
        name: "open",
        voice: V("rockkit", "oh"),
        pan: 0.3,
        db: -4,
        bars: ["..............x.", "............x..."],
      },
      {
        name: "tamb",
        voice: V("rockkit", "tb"),
        pan: -0.35,
        db: -6,
        bars: ["....x.......x...", "....x.......x..."],
      },
    ],
  },
  // Boom-bap at 90: lazy swung sixteenths, a hard snare on 2 and 4, through the lo-fi chain.
  brkboombap: {
    bpm: 90,
    steps: 16,
    swing: 0.58,
    roomDb: -14,
    lofi: true,
    feelMs: 6,
    feelDb: 1.5,
    seed: 202,
    tracks: [
      { name: "kick", voice: V("rockkit", "bd"), pan: 0, bars: ["X......x..X.....", "X......x..X..x.."] },
      {
        name: "snare",
        voice: V("rockkit", "sd"),
        pan: -0.05,
        bars: ["....X.......X...", "....X.......X..o"],
      },
      {
        name: "hat",
        voice: V("rockkit", "hh"),
        pan: 0.25,
        db: -3,
        bars: ["x.o.x.o.x.o.x.o.", "x.o.x.o.x.o.x.xo"],
      },
    ],
  },
  // Jungle at 170: a busy, broken kick against a ghosted snare and a running ride.
  brkjungle: {
    bpm: 170,
    steps: 16,
    swing: 0.5,
    roomDb: -15,
    feelMs: 2,
    feelDb: 1.5,
    seed: 303,
    tracks: [
      { name: "kick", voice: V("rockkit", "bd"), pan: 0, bars: ["X.........X.....", "X.......X..x...."] },
      {
        name: "snare",
        voice: V("rockkit", "sd"),
        pan: -0.08,
        bars: ["....X..o.o.oX..o", "....X.o..o..X.oo"],
      },
      {
        name: "ride",
        voice: V("jazzkit", "rd"),
        pan: 0.35,
        db: -4,
        bars: ["x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x.x."],
      },
    ],
  },
  // House at 124: four on the floor, claps on 2 and 4, open hats on the off-beats, sixteenth closed hats.
  brkhouse: {
    bpm: 124,
    steps: 16,
    swing: 0.54,
    roomDb: -18,
    feelMs: 0,
    feelDb: 0,
    seed: 404,
    tracks: [
      { name: "kick", voice: V("oak909", "bd"), pan: 0, bars: ["X...X...X...X...", "X...X...X...X..."] },
      { name: "clap", voice: V("oak909", "cp"), pan: -0.05, bars: ["....X.......X...", "....X.......X..x"] },
      {
        name: "hat",
        voice: V("oak909", "hh"),
        pan: 0.25,
        db: -4,
        chokes: "open",
        bars: ["o.o.o.o.o.o.o.o.", "o.o.o.o.o.o.o.o."],
      },
      {
        name: "open",
        voice: V("oak909", "oh"),
        pan: 0.25,
        db: -3,
        bars: ["..x...x...x...x.", "..x...x...x...x."],
      },
      {
        name: "shaker",
        voice: V("rockkit", "sh"),
        pan: -0.3,
        db: -8,
        bars: [".ox..ox..ox..ox.", ".ox..ox..ox..ox."],
      },
    ],
  },
  // Jazz at 140 on a triplet grid: ride spang-a-lang, hi-hat pedal on 2 and 4, feathered kick, brush comping.
  brkjazz: {
    bpm: 140,
    steps: 12,
    swing: 0.5,
    roomDb: -12,
    feelMs: 4,
    feelDb: 1.5,
    seed: 505,
    tracks: [
      { name: "ride", voice: V("jazzkit", "rd"), pan: 0.35, bars: ["X..x.oX..x.o", "X..x.oX..x.o"] },
      {
        name: "pedal",
        voice: V("jazzkit", "hh", 1),
        pan: 0.2,
        db: -2,
        bars: ["...x.....x..", "...x.....x.."],
      },
      { name: "kick", voice: V("jazzkit", "bd"), pan: 0, db: -4, bars: ["g..g..g..g..", "g..g..g..g.."] },
      { name: "snare", voice: V("jazzkit", "sd"), pan: -0.1, db: -2, bars: ["........o...", "..o.....o.x."] },
    ],
  },
  // Lo-fi at 80: a lazy, heavily swung pocket on the lofi kit, a vinyl bed underneath.
  brklofi: {
    bpm: 80,
    steps: 16,
    swing: 0.6,
    roomDb: -13,
    lofi: true,
    vinylDb: -26,
    feelMs: 7,
    feelDb: 1.5,
    seed: 606,
    tracks: [
      { name: "kick", voice: V("lofikit", "bd"), pan: 0, bars: ["X......x.xX.....", "X......x..X...x."] },
      {
        name: "snare",
        voice: V("lofikit", "sd"),
        pan: -0.05,
        bars: ["....X.......X...", "....X.......X.o."],
      },
      {
        name: "hat",
        voice: V("lofikit", "hh"),
        pan: 0.25,
        db: -4,
        bars: ["x.o.x.o.x.o.x.o.", "x.o.x.o.x.o.xoo."],
      },
      {
        name: "rim",
        voice: V("lofikit", "rim"),
        pan: -0.2,
        db: -10,
        bars: ["..........o.....", "......o........."],
      },
    ],
  },
};

const LEVEL: Record<string, number> = { X: 1, x: 0.8, o: 0.45, g: 0.3 };

/** A kit's one-shots by role: variants, each with its velocity layers (soft first). */
export type KitHits = Partial<Record<DrumRole, Pcm[][]>>;

export interface BreakMeta {
  bpm: number;
  bars: number;
  steps: number;
  swing: number;
  sampleRate: number;
  frames: number;
  /** Frame of every grid step (swing applied), bar after bar. */
  grid: number[];
  /** Every hit: frame, step, track name. */
  hits: { frame: number; step: number; track: string }[];
}

/** Velocity -> layer (the same split as the runtime's: below 0.6 plays the soft layer). */
const layerOf = (layers: number, vel: number) => (layers > 1 && vel < 0.6 ? 0 : layers - 1);

/** Renders a break: stereo, 44.1 kHz, exactly `bars` long, with its slice table. */
export function renderBreak(
  spec: BreakSpec,
  kits: Record<string, KitHits>,
  vinyl?: Pcm,
): { pcm: Pcm; meta: BreakMeta } {
  const bars = spec.tracks[0]?.bars.length ?? 0;
  const barFrames = (60 / spec.bpm) * 4 * RATE;
  const stepFrames = barFrames / spec.steps;
  const total = Math.round(barFrames * bars);
  const tail = Math.round(2 * RATE);
  const L = new Float32Array(total + tail);
  const R = new Float32Array(total + tail);
  const r = rng(spec.seed);
  const grid: number[] = [];
  const hits: BreakMeta["hits"] = [];
  const pre = Math.round(0.001 * RATE); // the one-shots keep 1 ms before their onset
  const swingDelay = spec.steps === 16 ? (2 * spec.swing - 1) * stepFrames : 0;
  for (let b = 0; b < bars; b++)
    for (let s = 0; s < spec.steps; s++)
      grid.push(Math.round(b * barFrames + s * stepFrames + (s % 2 === 1 ? swingDelay : 0)));
  // open-hat chokes: the frames where each choking track hits
  const chokeFrames = new Map<string, number[]>();
  const placed: { track: BreakTrack; start: number; vel: number }[] = [];
  for (const track of spec.tracks) {
    for (let b = 0; b < bars; b++) {
      const pat = track.bars[b] ?? "";
      for (let s = 0; s < spec.steps; s++) {
        const ch = pat[s] ?? ".";
        const vel = LEVEL[ch];
        if (vel === undefined) continue;
        const jitter = (r() * 2 - 1) * (spec.feelMs / 1000) * RATE;
        const start = Math.max(0, Math.round((grid[b * spec.steps + s] as number) + jitter) - pre);
        const level = vel * fromDb((r() * 2 - 1) * spec.feelDb);
        placed.push({ track, start, vel: level });
        hits.push({ frame: start + pre, step: b * spec.steps + s, track: track.name });
        if (track.chokes) {
          const list = chokeFrames.get(track.chokes) ?? [];
          list.push(start + pre);
          chokeFrames.set(track.chokes, list);
        }
      }
    }
  }
  for (const { track, start, vel } of placed) {
    const variants = kits[track.voice.kit]?.[track.voice.role];
    if (!variants?.length) throw new Error(`break: kit ${track.voice.kit} has no ${track.voice.role}`);
    const layers = variants[(track.voice.n ?? 0) % variants.length] as Pcm[];
    const shot = layers[layerOf(layers.length, vel)] as Pcm;
    const x = shot.channels[0] as Float32Array;
    if (shot.sampleRate !== RATE) throw new Error("break: one-shots must be 44.1 kHz");
    const gain = vel * fromDb(track.db ?? 0);
    const angle = ((track.pan + 1) / 2) * (Math.PI / 2);
    const gl = Math.cos(angle) * gain;
    const gr = Math.sin(angle) * gain;
    const choke =
      (chokeFrames.get(track.name) ?? []).find((f) => f > start + pre) ?? Number.POSITIVE_INFINITY;
    const chokeLen = 0.02 * RATE;
    for (let i = 0; i < x.length && start + i < L.length; i++) {
      const at = start + i;
      let e = 1;
      if (at >= choke) {
        e = 1 - (at - choke) / chokeLen;
        if (e <= 0) break;
      }
      const v = (x[i] as number) * e;
      L[at] = (L[at] as number) + v * gl;
      R[at] = (R[at] as number) + v * gr;
    }
  }
  let mix: Pcm = { sampleRate: RATE, channels: [L, R] };
  if (spec.roomDb !== null) {
    const wet = room(mix, 0.45, 0.45);
    const g = fromDb(spec.roomDb);
    mix = {
      sampleRate: RATE,
      channels: mix.channels.map((c, i) =>
        c.map((v, j) => v + ((wet.channels[i] as Float32Array)[j] as number) * g),
      ),
    };
  }
  // fold the tail (ringing cymbals, the room) back onto the start: the loop is seamless
  const folded = mix.channels.map((c) => {
    const out = c.slice(0, total);
    for (let i = total; i < c.length; i++) out[i - total] = (out[i - total] as number) + (c[i] as number);
    return out;
  });
  mix = { sampleRate: RATE, channels: folded };
  if (spec.lofi) mix = lofi(mix, 1.5);
  if (vinyl && spec.vinylDb !== undefined) {
    const g = fromDb(spec.vinylDb);
    const vn = frames(vinyl);
    mix = {
      sampleRate: RATE,
      channels: mix.channels.map((c, i) => {
        const v = vinyl.channels[Math.min(i, vinyl.channels.length - 1)] as Float32Array;
        return c.map((x, j) => x + (v[j % vn] as number) * g);
      }),
    };
  }
  // level: peak at −1 dBFS; 3 ms fades at the loop point
  const k = fromDb(-1) / Math.max(peak(mix), 1e-9);
  const fade = Math.round(0.003 * RATE);
  mix = {
    sampleRate: RATE,
    channels: mix.channels.map((c) => c.map((v, i) => v * k * Math.min(1, (total - i) / fade))),
  };
  return {
    pcm: mix,
    meta: {
      bpm: spec.bpm,
      bars,
      steps: spec.steps,
      swing: spec.swing,
      sampleRate: RATE,
      frames: total,
      grid,
      hits,
    },
  };
}
