import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dB,
  decodeAudio,
  frames,
  fromDb,
  measureCents,
  midiToHz,
  onset,
  type Pcm,
  peak,
  RATE,
  rms,
  scale,
} from "./audio.ts";
import { SYNTH_KITS } from "./drummachine.ts";
import { tapeBed } from "./dsp.ts";
import { ROLE_LEVEL_DB } from "./library.ts";
import { codeFiles } from "./recipe.ts";
import { PIANO_RMS400_DB, renderSynthHit } from "./render.ts";
import {
  PLAIN_RANGES,
  PLAIN_STEP,
  type PlainRole,
  renderGhost,
  renderHandPerc,
  renderHatPair,
  renderPlain,
  renderTunedKick,
  settledCents,
  V5_SYNTH_CREDITS,
} from "./synth-v5.ts";

const mono = (x: Float32Array): Pcm => ({ sampleRate: RATE, channels: [x] });
const channel = (p: Pcm) => p.channels[0] as Float32Array;
const pitchPasses = (c: number | null) => c !== null && Math.abs(c) <= 10;
const level = (p: Pcm, pitched = false) => dB(rms(p, onset(p), Math.round(RATE * (pitched ? 0.4 : 0.1))));
const fmt = (n: number) => n.toFixed(3);

/** First frame after which ALL samples remain below the relative floor (future peak envelope). */
function tailFrame(p: Pcm, floorDb: number): number {
  const threshold = peak(p) * fromDb(floorDb);
  const x = channel(p);
  for (let i = x.length - 1; i >= 0; i--) if (Math.abs(x[i] as number) >= threshold) return i + 1;
  return 0;
}
const tailMs = (p: Pcm, floorDb: number) => ((tailFrame(p, floorDb) - onset(p)) / RATE) * 1000;

/** Energy-weighted spectral centroid of the entire zero-ended hit; radix-2 FFT, zero-padded only. */
function centroid(p: Pcm): number {
  const x = channel(p);
  const n = 2 ** Math.ceil(Math.log2(x.length));
  const re = new Float64Array(n);
  re.set(x);
  const im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j] as number, re[i] as number];
  }
  for (let width = 2; width <= n; width *= 2) {
    const angle = (-2 * Math.PI) / width;
    for (let start = 0; start < n; start += width) {
      for (let k = 0; k < width / 2; k++) {
        const a = start + k;
        const b = a + width / 2;
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const tr = wr * (re[b] as number) - wi * (im[b] as number);
        const ti = wr * (im[b] as number) + wi * (re[b] as number);
        re[b] = (re[a] as number) - tr;
        im[b] = (im[a] as number) - ti;
        re[a] = (re[a] as number) + tr;
        im[a] = (im[a] as number) + ti;
      }
    }
  }
  let energy = 0;
  let weighted = 0;
  for (let k = 0; k <= n / 2; k++) {
    const e = (re[k] as number) ** 2 + (im[k] as number) ** 2;
    energy += e;
    weighted += e * ((k * p.sampleRate) / n);
  }
  return weighted / energy;
}

function correlation(a: Pcm, b: Pcm): number {
  const x = channel(a);
  const y = channel(b);
  expect(x.length).toBe(y.length);
  const mx = x.reduce((sum, v) => sum + v, 0) / x.length;
  const my = y.reduce((sum, v) => sum + v, 0) / y.length;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = (x[i] as number) - mx;
    const b = (y[i] as number) - my;
    xx += a * a;
    yy += b * b;
    xy += a * b;
  }
  return xy / Math.sqrt(xx * yy);
}

const roles: PlainRole[] = ["bass", "keys", "lead"];
const kits = ["oak909", "oak808"] as const;
interface Render {
  name: string;
  pcm: Pcm;
  target: number;
  again: () => Pcm;
  midi?: number;
}
const plain: Render[] = roles.flatMap((role) => {
  const [lo, hi] = PLAIN_RANGES[role];
  return Array.from({ length: (hi - lo) / PLAIN_STEP + 1 }, (_, i) => {
    const midi = lo + i * PLAIN_STEP;
    return {
      name: `plain${role}:${midi}`,
      midi,
      pcm: renderPlain(role, midi),
      target: PIANO_RMS400_DB,
      again: () => renderPlain(role, midi),
    };
  });
});
const kick = renderTunedKick();
const hats = kits.map((kit) => ({ kit, pair: renderHatPair(kit) }));
const ghosts = kits.flatMap((kit) =>
  (["sd", "hh"] as const).map((role) => {
    const voice = SYNTH_KITS[kit][role]?.[0];
    if (!voice) throw new Error(`missing loud reference: ${kit} ${role}`);
    return { kit, role, pcm: renderGhost(kit, role), loud: renderSynthHit(mono(voice()), role) };
  }),
);
const renders: Render[] = [
  ...plain,
  { name: "tkick:24", pcm: kick.pcm, target: ROLE_LEVEL_DB.bd, again: () => renderTunedKick().pcm },
  ...hats.flatMap(({ kit, pair }) =>
    pair.map((pcm, i) => ({
      name: `${kit}:hh:${i}`,
      pcm,
      target: ROLE_LEVEL_DB.hh,
      again: () => renderHatPair(kit)[i] as Pcm,
    })),
  ),
  ...ghosts.map(({ kit, role, pcm, loud }) => ({
    name: `${kit}:${role}:ghost`,
    pcm,
    target: level(loud) - 10,
    again: () => renderGhost(kit, role),
  })),
  ...(["sh", "tb"] as const).map((role) => ({
    name: `oak909:${role}`,
    pcm: renderHandPerc(role),
    target: ROLE_LEVEL_DB[role],
    again: () => renderHandPerc(role),
  })),
];

describe("v5 deterministic, levelled, boundary-safe renders", () => {
  for (const r of renders) {
    test(r.name, () => {
      expect(r.again()).toEqual(r.pcm);
      expect(r.pcm.sampleRate).toBe(RATE);
      expect(r.pcm.channels.length).toBe(1);
      const x = channel(r.pcm);
      expect(x.every(Number.isFinite)).toBe(true);
      expect(Math.abs(level(r.pcm, r.midi !== undefined) - r.target)).toBeLessThanOrEqual(1);
      if (r.midi !== undefined)
        expect(Math.abs(dB(rms(r.pcm, 0, Math.round(0.4 * RATE))) - r.target)).toBeLessThanOrEqual(1);
      expect(dB(peak(r.pcm))).toBeLessThanOrEqual(-0.5);
      expect(x[0]).toBe(0);
      expect(onset(r.pcm) / RATE).toBeLessThanOrEqual(0.002);
      expect(x[x.length - 1]).toBe(0);
      const last2ms = mono(x.slice(-Math.round(0.002 * RATE)));
      expect(dB(peak(last2ms))).toBeLessThan(-60);
      expect(dB(Math.abs(x.reduce((sum, v) => sum + v, 0) / x.length))).toBeLessThan(-60);
    });
  }

  test("different kit and seeded hands do not collapse to the same samples", () => {
    expect(renderHatPair("oak909")[0]).not.toEqual(renderHatPair("oak808")[0]);
    for (const { pair } of hats) expect(pair[0]).not.toEqual(pair[1]);
    for (const role of ["sd", "hh"] as const)
      expect(renderGhost("oak909", role)).not.toEqual(renderGhost("oak808", role));
  });
});

describe("plain pitch and wrong-note rejection", () => {
  for (const r of plain) {
    test(r.name, () => {
      const cents = measureCents(r.pcm, r.midi as number);
      expect(pitchPasses(cents)).toBe(true);
    });
  }
  for (const role of roles) {
    const notes = plain.filter((r) => r.name.startsWith(`plain${role}:`));
    for (const index of [0, Math.round((notes.length - 1) / 2), notes.length - 1]) {
      const r = notes[index] as Render;
      test(`${r.name} is rejected as MIDI + 1`, () => {
        const cents = measureCents(r.pcm, (r.midi as number) + 1);
        // Null is a rejection: no clear partial within ±60 cents of the WRONG claimed MIDI + 1.
        expect(cents === null || Math.abs(cents) > 50).toBe(true);
        expect(pitchPasses(cents)).toBe(false);
        console.log(`wrong-note ${r.name}: ${cents === null ? "null" : fmt(cents)} cents, rejected`);
      });
    }
  }
  test("explicit duration is deterministic and still leaves an analysis window", () => {
    const p = renderPlain("keys", 60, 2);
    expect(frames(p)).toBe(2 * RATE);
    expect(p).toEqual(renderPlain("keys", 60, 2));
    expect(pitchPasses(measureCents(p, 60))).toBe(true);
    expect(() => renderPlain("keys", 60, 0.1)).toThrow(RangeError);
  });
});

const sine = (midi: number, seconds: number, decay = false, phase = 0): Pcm =>
  mono(
    Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => {
      const t = i / RATE;
      return Math.sin(2 * Math.PI * midiToHz(midi) * t + phase) * (decay ? Math.exp(-t / 0.014) : 1);
    }),
  );

test("validate the short-window estimator before using it to judge the kick", () => {
  const end = Math.round(0.05 * RATE);
  for (const phase of [0, 0.7, 2.1, 4.5]) {
    const exact = settledCents(sine(kick.rootMidi, 0.05, false, phase), kick.rootMidi, 0, end);
    const sharp = settledCents(sine(kick.rootMidi + 1, 0.05, false, phase), kick.rootMidi, 0, end);
    const decaying = settledCents(sine(kick.rootMidi, 0.05, true, phase), kick.rootMidi, 0, end);
    expect(exact).not.toBeNull();
    expect(Math.abs(exact as number)).toBeLessThanOrEqual(1);
    expect(sharp).not.toBeNull();
    expect(Math.abs((sharp as number) - 100)).toBeLessThanOrEqual(5);
    expect(Math.abs(sharp as number)).toBeGreaterThan(50);
    expect(pitchPasses(sharp)).toBe(false);
    expect(decaying).not.toBeNull();
    expect(Math.abs(decaying as number)).toBeLessThanOrEqual(2);
    console.log(`estimator phase=${phase}: exact=${exact}, semitone=${sharp}, decay=${decaying}`);
  }
  const long = sine(60, 2);
  const shortMeasure = settledCents(long, 60, 0, frames(long));
  const standard = measureCents(long, 60);
  expect(shortMeasure).not.toBeNull();
  expect(standard).not.toBeNull();
  expect(Math.abs((shortMeasure as number) - (standard as number))).toBeLessThanOrEqual(1);
  expect(settledCents(mono(new Float32Array(end)), kick.rootMidi, 0, end)).toBeNull();
  expect(settledCents(long, 60, -1, end)).toBeNull();
  expect(settledCents(long, 60, 0, frames(long) + 1)).toBeNull();
  console.log(`estimator MIDI 60: ${shortMeasure}; measureCents: ${standard}`);
});

test("kick settles within 10 cents in its final 50 ms above −40 dB and clears the next sixteenth", () => {
  const end = tailFrame(kick.pcm, -40);
  const start = end - Math.round(0.05 * RATE);
  expect(start).toBeGreaterThanOrEqual(onset(kick.pcm));
  const cents = settledCents(kick.pcm, kick.rootMidi, start, end);
  expect(pitchPasses(cents)).toBe(true);
  expect(tailMs(kick.pcm, -40)).toBeLessThanOrEqual(150);
  const after = mono(channel(kick.pcm).slice(onset(kick.pcm) + Math.round(0.15 * RATE)));
  expect(dB(peak(after) / peak(kick.pcm))).toBeLessThan(-40);
  console.log(
    `kick: root=${kick.rootMidi}, window=${start}..${end}, cents=${cents}, tail40ms=${tailMs(kick.pcm, -40)}, after150dB=${dB(peak(after) / peak(kick.pcm))}`,
  );

  // A test-only long falling sine, not a recording or a third-party patch: it must fail the same gate.
  let phase = 0;
  const longKick = mono(
    Float32Array.from({ length: RATE * 3 }, (_, i) => {
      const t = i / RATE;
      phase += (2 * Math.PI * (midiToHz(24) + 100 * Math.exp(-t / 0.02))) / RATE;
      return Math.sin(phase) * Math.min(1, t / 0.001) * Math.exp(-t / 0.6);
    }),
  );
  expect(tailMs(longKick, -40)).toBeGreaterThan(150);
  console.log(`long-kick negative control: tail40ms=${tailMs(longKick, -40)}`);
});

test("centroid measurement finds a known sine", () => {
  const p = mono(Float32Array.from({ length: 8192 }, (_, i) => Math.sin((2 * Math.PI * 200 * i) / 8192)));
  expect(Math.abs(centroid(p) - (200 * RATE) / 8192)).toBeLessThan(0.01);
});

for (const { kit, pair } of hats) {
  test(`${kit} alternate hands have matched levels and brightness but different samples`, () => {
    const [a, b] = pair;
    const ca = centroid(a);
    const cb = centroid(b);
    const corr = correlation(a, b);
    expect(Math.abs(level(a) - level(b))).toBeLessThanOrEqual(0.5);
    expect(corr).toBeLessThan(0.99);
    expect(Math.max(ca, cb) / Math.min(ca, cb)).toBeLessThanOrEqual(1.15);
    console.log(
      `${kit} pair: levelDelta=${fmt(Math.abs(level(a) - level(b)))}, correlation=${fmt(corr)}, centroidsHz=${fmt(ca)}/${fmt(cb)}, ratio=${fmt(Math.max(ca, cb) / Math.min(ca, cb))}`,
    );
  });
}

for (const { kit, role, pcm, loud } of ghosts) {
  test(`${kit} ${role} ghost is softer, darker and shorter; a scaled loud hit is rejected`, () => {
    const reduction = level(loud) - level(pcm);
    const centroidRatio = centroid(pcm) / centroid(loud);
    const decayRatio = tailMs(pcm, -30) / tailMs(loud, -30);
    expect(reduction).toBeGreaterThanOrEqual(8);
    expect(reduction).toBeLessThanOrEqual(14);
    expect(centroidRatio).toBeLessThanOrEqual(0.85);
    expect(decayRatio).toBeLessThanOrEqual(0.8);
    const fake = scale(loud, fromDb(-10));
    expect(centroid(fake) / centroid(loud)).toBeGreaterThan(0.85);
    expect(tailMs(fake, -30) / tailMs(loud, -30)).toBeGreaterThan(0.8);
    console.log(
      `${kit} ${role} ghost: reductionDb=${fmt(reduction)}, centroidsHz=${fmt(centroid(loud))}/${fmt(centroid(pcm))}, ratio=${fmt(centroidRatio)}, decay30ms=${fmt(tailMs(loud, -30))}/${fmt(tailMs(pcm, -30))}, ratio=${fmt(decayRatio)}; scaled control centroid/decay ratios=${fmt(centroid(fake) / centroid(loud))}/${fmt(tailMs(fake, -30) / tailMs(loud, -30))}`,
    );
  });
}

test("credits cover every family and the new recipe reaches its value dependencies", () => {
  expect(V5_SYNTH_CREDITS.length).toBe(12);
  expect(new Set(V5_SYNTH_CREDITS.map((c) => c.name)).size).toBe(12);
  for (const credit of V5_SYNTH_CREDITS) {
    expect(credit.licence).toBe("CC0-1.0");
    expect(credit.author).toBe("Oak");
    expect(credit.note.length).toBeGreaterThan(0);
  }
  expect(codeFiles(["synth-v5.ts"])).toEqual(
    expect.arrayContaining([
      "synth-v5.ts",
      "audio.ts",
      "dsp.ts",
      "drummachine.ts",
      "render.ts",
      "library.ts",
    ]),
  );
});

test("report every render and the v4 loop seams (seams are information, not gates)", () => {
  console.log("name | target dB | measured dB | peak dBFS | cents | tail40 ms");
  for (const r of renders) {
    const end = tailFrame(r.pcm, -40);
    const cents =
      r.midi !== undefined
        ? measureCents(r.pcm, r.midi)
        : r.name.startsWith("tkick")
          ? settledCents(r.pcm, kick.rootMidi, end - Math.round(0.05 * RATE), end)
          : undefined;
    console.log(
      `${r.name} | ${fmt(r.target)} | ${fmt(level(r.pcm, r.midi !== undefined))} | ${fmt(dB(peak(r.pcm)))} | ${cents === undefined ? "n/a" : cents === null ? "could not verify" : fmt(cents)} | ${fmt(tailMs(r.pcm, -40))}`,
    );
  }
  const dc = Math.max(
    ...renders.map(({ pcm }) => dB(Math.abs(channel(pcm).reduce((s, v) => s + v, 0) / frames(pcm)))),
  );
  const endPeak = Math.max(
    ...renders.map(({ pcm }) => dB(peak(mono(channel(pcm).slice(-Math.round(0.002 * RATE)))))),
  );
  console.log(
    `boundaries: worst DC=${fmt(dc)} dBFS; worst final 2 ms peak=${fmt(endPeak)} dBFS; latest onset=${fmt(Math.max(...renders.map(({ pcm }) => (onset(pcm) / RATE) * 1000)))} ms`,
  );
  for (const name of ["vinyl", "tape"]) {
    const path = join(import.meta.dirname, "../../sounds/pack/v4/perc", `${name}_0.flac`);
    const present = existsSync(path);
    const p = present ? decodeAudio(readFileSync(path), name) : tapeBed(4);
    // Report both the instantaneous sample discontinuity and the 10 ms RMS level change. A tiny
    // level change alone does not establish a click-free loop; audibility could not verify here.
    for (const [i, x] of p.channels.entries()) {
      const c = { sampleRate: p.sampleRate, channels: [x] };
      const window = Math.round(p.sampleRate * 0.01);
      const jump = Math.abs((x[0] as number) - (x[x.length - 1] as number));
      const levelChange = dB(rms(c, 0, window)) - dB(rms(c, x.length - window, window));
      console.log(
        `loop ${name} channel=${i} source=${present ? "v4 FLAC" : "tapeBed fallback (original could not verify)"}: jumpDbFS=${fmt(dB(jump))}, jumpVsRmsDb=${fmt(dB(jump / rms(c)))}, headMinusTail10msDb=${fmt(levelChange)}`,
      );
    }
  }
});
