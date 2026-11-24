// The render stage of the derived pack files: mixdowns, trims, filters and levels (mirror.ts plans and
// writes the files; this decides what they sound like). This file is part of the pitched and kit recipes
// (recipe.ts), so an edit here re-renders them on --update: keep every audio-shaping step in here, not in
// mirror.ts. The upstream files arrive through `load`, which only fetches and decodes (audio.ts); their bytes
// are in each recipe as `input`.

import {
  fromDb,
  measureCents,
  midiToHz,
  mix,
  mono,
  mp3,
  onset,
  type Pcm,
  peak,
  retune,
  rms,
  scale,
  stereo,
  trim,
} from "./audio.ts";
import { biquad, lofi, tapeBed } from "./dsp.ts";
import {
  type DrumRole,
  type Mixdown,
  type ONE_SHOTS,
  type PitchedSpec,
  ROLE_LEVEL_DB,
  type SrcRef,
} from "./library.ts";

/** An upstream file decoded (at 44.1 kHz unless `keepRate`). */
export type Load = (ref: SrcRef, keepRate?: boolean) => Promise<Pcm>;

/** Peak-safe level to an RMS target over the first `ms` after the onset. */
export function levelled(p: Pcm, targetDb: number, ms = 100): Pcm {
  const o = onset(p);
  const r = rms(p, o, Math.round((ms / 1000) * p.sampleRate));
  let g = r > 0 ? fromDb(targetDb) / r : 1;
  const pk = peak(p) * g;
  if (pk > fromDb(-0.5)) g *= fromDb(-0.5) / pk;
  return scale(p, g);
}

/** A mixdown of several microphones (mono). */
export async function mixdown(m: Mixdown, load: Load): Promise<Pcm> {
  const parts = await Promise.all(
    m.mics.map(async ({ ref, gain }) => ({ pcm: mono(await load(ref)), gain })),
  );
  return mix(parts);
}

/** The piano's loudness: RMS of the first 400 ms of its middle notes (measured, dBFS). */
export const PIANO_RMS400_DB = -21;

export async function renderNote(
  spec: PitchedSpec,
  ref: SrcRef,
  midi: number,
  load: Load,
): Promise<{ bytes: Uint8Array; cents: string }> {
  let p = await load(ref, true);
  p = spec.stereo ? stereo(p) : mono(p);
  let cents = "kept";
  if (spec.retune !== false) {
    const c = measureCents(p, midi + 12 * Math.log2(spec.partial ?? 1));
    if (c === null) cents = "unmeasured";
    else if (Math.abs(c) > 2) {
      p = retune(p, -c);
      cents = `${c.toFixed(1)} -> 0`;
    } else cents = c.toFixed(1);
  }
  // rumble, handling noise and hum below the note (a high-pass an octave under it, 24 dB/octave)
  const cut = midiToHz(midi) * 0.5;
  p = {
    sampleRate: p.sampleRate,
    channels: p.channels.map((c) =>
      biquad(biquad(c, "hp", cut, 0.54, 0, p.sampleRate), "hp", cut, 1.31, 0, p.sampleRate),
    ),
  };
  p = trim(p, { maxSec: spec.tailSec, fadeMs: 150, preMs: 2, floorDb: -55 });
  p = levelled(p, PIANO_RMS400_DB + (spec.levelDb ?? 0), 400);
  return { bytes: mp3(p), cents };
}

export async function renderHit(
  hit: Mixdown,
  role: DrumRole,
  maxSec: number,
  lofiChain: boolean,
  levelDb: number,
  load: Load,
): Promise<Pcm> {
  let p = await mixdown(hit, load);
  p = trim(p, { maxSec, fadeMs: role === "sd" || role === "bd" ? 40 : 80, preMs: 1, floorDb: -58 });
  if (lofiChain) p = lofi(p);
  return levelled(p, levelDb);
}

/** A synthesised kit voice (drummachine.ts) at its role's level. */
export const renderSynthHit = (voice: Pcm, role: DrumRole): Pcm => levelled(voice, ROLE_LEVEL_DB[role]);

export async function renderOneShot(
  hit: Mixdown,
  spec: (typeof ONE_SHOTS)[keyof typeof ONE_SHOTS],
  load: Load,
): Promise<Pcm> {
  let p: Pcm;
  if (hit.mics.length === 1 && "stereo" in spec && spec.stereo)
    p = stereo(await load((hit.mics[0] as Mixdown["mics"][number]).ref));
  else p = await mixdown(hit, load);
  p = trim(p, { maxSec: spec.maxSec, fadeMs: 60, preMs: 1, floorDb: -60 });
  return levelled(p, spec.levelDb, 400);
}

/** Oak's tape bed (dsp.ts), levelled. */
export const renderTape = (seconds: number): Pcm => levelled(tapeBed(seconds), -32, 1000);
