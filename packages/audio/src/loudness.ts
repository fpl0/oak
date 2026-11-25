// Pure loudness and gain arithmetic for listening comparisons and recorded takes.
export interface Stereo {
  left: Float32Array;
  right: Float32Array;
}

function channelLength(channels: readonly Float32Array[]): number {
  if (channels.length === 0) throw new RangeError("At least one channel is required");
  const n = (channels[0] as Float32Array).length;
  if (channels.some((channel) => channel.length !== n))
    throw new RangeError("Channels must have the same length");
  return n;
}

/** One biquad over a whole signal (direct form I). */
function biquad(x: Float64Array, b: [number, number, number], a: [number, number]): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i] as number;
    const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    y[i] = y0;
  }
  return y;
}

/** ITU-R BS.1770 K-weighting at any sample rate (the libebur128 derivation of the two filters). */
function kWeight(x: Float32Array, fs: number): Float64Array {
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const shelf = biquad(
    Float64Array.from(x),
    [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  );
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  return biquad(shelf, [1, -2, 1], [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]);
}

/**
 * Integrated loudness (LUFS) per BS.1770-4: K-weighting, 400 ms blocks with 75 % overlap, the −70 LUFS
 * absolute gate and the −10 LU relative gate. −Infinity when nothing passes the gates.
 * Every channel has weight 1; callers supply audio channels, not a surround layout with an LFE channel.
 */
export function loudnessOf(channels: readonly Float32Array[], fs: number): number {
  const n = channelLength(channels);
  if (!Number.isFinite(fs) || fs <= 0) throw new RangeError("Sample rate must be finite and positive");
  const block = Math.round(0.4 * fs);
  const hop = Math.round(0.1 * fs);
  // A rate that rounds the hop to zero cannot advance the block scan.
  if (hop === 0) throw new RangeError("Sample rate must allow a nonzero block hop");
  for (const channel of channels)
    for (const sample of channel)
      if (!Number.isFinite(sample)) throw new RangeError("Samples must be finite");
  if (n < block) return Number.NEGATIVE_INFINITY;
  const weighted = channels.map((channel) => kWeight(channel, fs));
  const first = weighted[0] as Float64Array;
  const blocks: number[] = [];
  for (let i = 0; i + block <= n; i += hop) {
    let s = 0;
    for (let j = i; j < i + block; j++) {
      // Sum channels per sample, then add to the block: preserves the original stereo rounding exactly.
      let power = (first[j] as number) ** 2;
      for (let c = 1; c < weighted.length; c++) power += ((weighted[c] as Float64Array)[j] as number) ** 2;
      s += power;
    }
    if (!Number.isFinite(s)) throw new RangeError("K-weighted energy must be finite");
    blocks.push(s / block);
  }
  const lufs = (z: number) => -0.691 + 10 * Math.log10(z);
  const abs = blocks.filter((z) => z > 0 && lufs(z) > -70);
  if (abs.length === 0) return Number.NEGATIVE_INFINITY;
  const mean = (zs: number[]) => zs.reduce((a, b) => a + b, 0) / zs.length;
  const rel = lufs(mean(abs)) - 10;
  const gated = abs.filter((z) => lufs(z) > rel);
  return gated.length > 0 ? lufs(mean(gated)) : Number.NEGATIVE_INFINITY;
}

export function loudness(r: Stereo, fs: number): number {
  return loudnessOf([r.left, r.right], fs);
}

/** Peak absolute sample, dBFS. */
export function peakDbOf(channels: readonly Float32Array[]): number {
  channelLength(channels);
  // Oak's call: sample peak, not true peak (no oversampling) — cap the stored samples with the harness's measure.
  let p = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i] as number;
      if (!Number.isFinite(sample)) throw new RangeError("Samples must be finite");
      p = Math.max(p, Math.abs(sample));
    }
  }
  return p > 0 ? 20 * Math.log10(p) : Number.NEGATIVE_INFINITY;
}

export function peakDb(r: Stereo): number {
  return peakDbOf([r.left, r.right]);
}

export interface NormalizeResult {
  gain: number;
  gainDb: number;
  lufsBefore: number;
  lufsAfter: number;
  peakDbAfter: number;
  limitedByPeak: boolean;
}

/** Scale towards the requested loudness only as far as the sample-peak ceiling allows. */
export function normalizeGain(
  channels: readonly Float32Array[],
  sampleRate: number,
  targetLufs: number,
  maxPeakDb = -1,
): NormalizeResult {
  if (!Number.isFinite(targetLufs) || !Number.isFinite(maxPeakDb))
    throw new RangeError("Loudness target and peak ceiling must be finite");
  const lufsBefore = loudnessOf(channels, sampleRate);
  const peak = peakDbOf(channels);
  if (lufsBefore === Number.NEGATIVE_INFINITY)
    return { gain: 1, gainDb: 0, lufsBefore, lufsAfter: lufsBefore, peakDbAfter: peak, limitedByPeak: false };
  const targetGain = 10 ** ((targetLufs - lufsBefore) / 20);
  const peakGain = 10 ** ((maxPeakDb - peak) / 20);
  const gain = Math.min(targetGain, peakGain);
  // Refuse unrepresentable gains instead of passing zero or infinity into the dB arithmetic.
  if (!Number.isFinite(gain) || gain <= 0)
    throw new RangeError("Normalisation gain must be finite and positive");
  const gainDb = 20 * Math.log10(gain);
  return {
    gain,
    gainDb,
    lufsBefore,
    lufsAfter: lufsBefore + gainDb,
    peakDbAfter: peak + gainDb,
    limitedByPeak: peakGain < targetGain,
  };
}

/** New buffers keep the learner's original take intact. */
export function applyGain(channels: readonly Float32Array[], gain: number): Float32Array[] {
  // Supervisor addition (Review Focus 3): refuse gains that would corrupt or invert the take.
  if (!Number.isFinite(gain) || gain < 0) throw new RangeError("Gain must be finite and nonnegative");
  return channels.map((channel) => channel.map((sample) => Math.fround(sample * gain)));
}
