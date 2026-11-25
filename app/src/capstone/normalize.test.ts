// Oak 2.0 W4 F5: an album take is normalised to one loudness with its peak under the cap, and never lost: a take that
// cannot be decoded is kept as recorded, and a silent take is refused before anything is decoded.
import { describe, expect, test } from "bun:test";
import { loudnessOf } from "@oak/audio/loudness";
import type { EditorHandle, OakStrudel, Recording } from "@oak/strudel";
import {
  ALBUM_MAX_PEAK_DB,
  ALBUM_TARGET_LUFS,
  type DecodedTake,
  normalizedTake,
  normalizeRecording,
} from "./normalize.ts";
import { recordPerformance, SILENT_PEAK, SILENT_TAKE } from "./record.ts";

const FS = 48_000;

function sineTake(amp: number, seconds = 3, channels = 2): DecodedTake {
  const x = Float32Array.from(
    { length: FS * seconds },
    (_, i) => amp * Math.sin((2 * Math.PI * 1000 * i) / FS),
  );
  const data = Array.from({ length: channels }, () => x.slice());
  return {
    numberOfChannels: channels,
    sampleRate: FS,
    length: x.length,
    getChannelData: (c) => data[c] as Float32Array,
  };
}

/** A small reader of the 16-bit PCM WAV `encodeWav` writes (44-byte header, interleaved). */
function readWav(wav: ArrayBuffer): { channels: Float32Array[]; sampleRate: number } {
  const view = new DataView(wav);
  const ascii = (at: number) => String.fromCharCode(...new Uint8Array(wav, at, 4));
  expect(ascii(0)).toBe("RIFF");
  expect(ascii(8)).toBe("WAVE");
  expect(view.getUint16(20, true)).toBe(1);
  expect(view.getUint16(34, true)).toBe(16);
  const count = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const frames = view.getUint32(40, true) / (count * 2);
  const channels = Array.from({ length: count }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < count; c++) {
      const v = view.getInt16(44 + (i * count + c) * 2, true);
      (channels[c] as Float32Array)[i] = v < 0 ? v / 0x8000 : v / 0x7fff;
    }
  return { channels, sampleRate };
}

const peakOf = (channels: Float32Array[]) =>
  Math.max(...channels.map((c) => c.reduce((m, x) => Math.max(m, Math.abs(x)), 0)));

describe("normalizedTake", () => {
  test("the WAV reads back at the target within 0.5 LU with its peak at or under −1 dBFS", () => {
    const take = sineTake(0.1);
    const out = normalizedTake(take);
    const back = readWav(out.wav);
    expect(back.channels).toHaveLength(2);
    expect(back.sampleRate).toBe(FS);
    expect(back.channels[0]?.length).toBe(take.length);
    const lufs = loudnessOf(back.channels, back.sampleRate);
    expect(lufs).toBeGreaterThanOrEqual(ALBUM_TARGET_LUFS - 0.5);
    expect(lufs).toBeLessThanOrEqual(ALBUM_TARGET_LUFS + 0.5);
    expect(peakOf(back.channels)).toBeLessThanOrEqual(10 ** (ALBUM_MAX_PEAK_DB / 20) + 1 / 0x7fff);
    // −20 LUFS in, −16 out: turned up by 4 dB, and the report agrees with what was written.
    expect(out.gainDb).toBeCloseTo(4, 0);
    expect(Math.abs(out.lufsAfter - lufs)).toBeLessThanOrEqual(0.05);
    expect(out.peakDbAfter).toBeLessThanOrEqual(ALBUM_MAX_PEAK_DB);
  });

  test("a loud take is turned down to the target", () => {
    const back = readWav(normalizedTake(sineTake(0.8)).wav);
    const lufs = loudnessOf(back.channels, back.sampleRate);
    expect(Math.abs(lufs - ALBUM_TARGET_LUFS)).toBeLessThanOrEqual(0.5);
  });

  test("a silent buffer is left at gain 1", () => {
    const out = normalizedTake(sineTake(0));
    expect(out.gainDb).toBe(0);
    expect(out.lufsAfter).toBe(Number.NEGATIVE_INFINITY);
    expect(peakOf(readWav(out.wav).channels)).toBe(0);
  });

  test("a mono take stays one channel; the decoded buffer is not changed", () => {
    const take = sineTake(0.1, 1, 1);
    const before = take.getChannelData(0).slice();
    const back = readWav(normalizedTake(take).wav);
    expect(back.channels).toHaveLength(1);
    expect(take.getChannelData(0)).toEqual(before);
  });
});

describe("normalizeRecording", () => {
  const rec = (): Recording => ({
    blob: new Blob(["webm bytes"]),
    mime: "audio/webm;codecs=opus",
    durationS: 3.2,
  });

  test("a take becomes a WAV at the album's loudness", async () => {
    const out = await normalizeRecording(rec(), {
      decodeAudioData: async () => sineTake(0.1) as AudioBuffer,
    });
    expect(out.mime).toBe("audio/wav");
    expect(out.blob.type).toBe("audio/wav");
    expect(out.durationS).toBeCloseTo(3, 6);
    const back = readWav(await out.blob.arrayBuffer());
    expect(Math.abs(loudnessOf(back.channels, back.sampleRate) - ALBUM_TARGET_LUFS)).toBeLessThanOrEqual(0.5);
  });

  test("a decode failure keeps the original take", async () => {
    const take = rec();
    const out = await normalizeRecording(take, {
      decodeAudioData: () => Promise.reject(new DOMException("Unable to decode audio data", "EncodingError")),
    });
    expect(out).toBe(take);
  });

  test("a take normalizeGain refuses, or more than two channels, is kept as recorded", async () => {
    const take = rec();
    const empty: DecodedTake = {
      numberOfChannels: 2,
      sampleRate: 0,
      length: 0,
      getChannelData: () => new Float32Array(0),
    };
    expect(await normalizeRecording(take, { decodeAudioData: async () => empty as AudioBuffer })).toBe(take);
    const six = sineTake(0.1, 1, 6);
    expect(await normalizeRecording(take, { decodeAudioData: async () => six as AudioBuffer })).toBe(take);
  });
});

describe("recordPerformance", () => {
  function fakes(peak: number) {
    let decodes = 0;
    const take: Recording = { blob: new Blob(["x"]), mime: "audio/webm", durationS: 3 };
    const oak = {
      unlock: async () => {},
      master: { level: () => ({ rms: peak / 2, peak }) },
      recorder: {
        recording: false,
        record: () => new Promise<Recording>((r) => setTimeout(() => r(take), 60)),
        cancel: () => {},
      },
      ctx: {
        decodeAudioData: async () => {
          decodes++;
          return sineTake(0.1) as AudioBuffer;
        },
      },
    } as unknown as OakStrudel;
    const handle = {
      playing: false,
      disposed: false,
      evaluate: async () => ({ ok: true }),
      play: async () => {},
      stop: () => {},
    } as unknown as EditorHandle;
    return { oak, handle, take, decodes: () => decodes };
  }

  test("a silent take is refused before decoding", async () => {
    const f = fakes(SILENT_PEAK / 2);
    await expect(recordPerformance(f.oak, f.handle, 4)).rejects.toThrow(SILENT_TAKE);
    expect(f.decodes()).toBe(0);
  });

  test("a take with sound is decoded once and comes back as a WAV", async () => {
    const f = fakes(0.4);
    const out = await recordPerformance(f.oak, f.handle, 4);
    expect(f.decodes()).toBe(1);
    expect(out.mime).toBe("audio/wav");
    expect(out).not.toBe(f.take);
  });
});
