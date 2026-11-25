// Oak 2.0 W4 F5 (Oak's call, not the book's): a take recorded for the album is normalised to one loudness, so the
// album's tracks play at a common level and none is left louder just because it was mixed hotter. The take is
// decoded, measured (BS.1770 integrated loudness, X19), turned up or down towards the target with its sample peak
// kept at or under the cap, and written back as a 16-bit WAV. Only what is recorded changes: the code's `.gain()`
// values are never read or written. Nothing the learner made is lost: a take that fails to decode or encode comes
// back as it was recorded.
import { applyGain, normalizeGain } from "@oak/audio/loudness";
import type { Recording } from "@oak/strudel";
import { encodeWav } from "@oak/strudel/offline";

/**
 * The album's loudness target, in LUFS. Oak's call (PLAN §10 call 6): a common level for listening on headphones and
 * laptop speakers, with room under the peak cap for a piece's hits. Never shown to the learner as a target.
 */
export const ALBUM_TARGET_LUFS = -16;
/** The highest sample peak a normalised take may reach, in dBFS (Oak's call; sample peak, not true peak). */
export const ALBUM_MAX_PEAK_DB = -1;

/** The part of an `AudioBuffer` normalisation reads. */
export interface DecodedTake {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(c: number): Float32Array;
}

/**
 * The take at the album's loudness, as a 16-bit WAV. A take that cannot be measured (silence, or under the −70 LUFS
 * gate) is left at gain 1. One or two channels; anything else throws (`normalizeRecording` then keeps the take).
 */
export function normalizedTake(buf: DecodedTake): {
  wav: ArrayBuffer;
  gainDb: number;
  lufsAfter: number;
  peakDbAfter: number;
} {
  if (buf.numberOfChannels !== 1 && buf.numberOfChannels !== 2)
    throw new RangeError(`a take has one or two channels, not ${buf.numberOfChannels}`);
  const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const r = normalizeGain(channels, buf.sampleRate, ALBUM_TARGET_LUFS, ALBUM_MAX_PEAK_DB);
  const wav = encodeWav(applyGain(channels, r.gain), buf.sampleRate);
  return { wav, gainDb: r.gainDb, lufsAfter: r.lufsAfter, peakDbAfter: r.peakDbAfter };
}

/**
 * The recording normalised to the album's loudness, as `audio/wav`. Any failure (the browser cannot decode the take,
 * `normalizeGain` refuses its channels, the WAV cannot be written) returns `rec` itself, unchanged: the learner's take
 * is kept as recorded rather than lost.
 */
export async function normalizeRecording(
  rec: Recording,
  ctx: Pick<BaseAudioContext, "decodeAudioData">,
): Promise<Recording> {
  try {
    const buf = await ctx.decodeAudioData(await rec.blob.arrayBuffer());
    const { wav } = normalizedTake(buf);
    return {
      blob: new Blob([wav], { type: "audio/wav" }),
      mime: "audio/wav",
      durationS: buf.length / buf.sampleRate,
    };
  } catch {
    return rec;
  }
}
