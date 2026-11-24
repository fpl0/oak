import { describe, expect, test } from "bun:test";
import { PieceRenderError, renderFailure } from "./errors.ts";
import { MAX_TAIL_S, renderLength, trimAndMeasure } from "./math.ts";
import { localUrl, validateRequest } from "./request.ts";
import { encodeWav } from "./wav.ts";

describe("PCM WAV", () => {
  test("stereo header, interleaving, asymmetric endpoints and clipping", () => {
    const data = encodeWav(
      [new Float32Array([-2, -0.5, 0, 0.5, 2]), new Float32Array([1, 0, -1, 0, 1])],
      48000,
    );
    const v = new DataView(data);
    const text = (at: number, n: number) => new TextDecoder().decode(data.slice(at, at + n));
    expect(data.byteLength).toBe(64);
    expect([text(0, 4), text(8, 4), text(12, 4), text(36, 4)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect([v.getUint32(4, true), v.getUint32(16, true), v.getUint32(40, true)]).toEqual([56, 16, 20]);
    expect([v.getUint16(20, true), v.getUint16(22, true), v.getUint16(34, true)]).toEqual([1, 2, 16]);
    expect([v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true)]).toEqual([48000, 192000, 4]);
    expect(Array.from({ length: 10 }, (_, i) => v.getInt16(44 + 2 * i, true))).toEqual([
      -32768, 32767, -16384, 0, 0, -32768, 16383, 0, 32767, 32767,
    ]);
  });
  test("mono and empty PCM have correct lengths", () => {
    const wav = new DataView(encodeWav([new Float32Array([-0.25, 0.25])], 44100));
    expect(wav.byteLength).toBe(48);
    expect(wav.getUint16(22, true)).toBe(1);
    expect(wav.getUint32(28, true)).toBe(88200);
    expect(encodeWav([new Float32Array()], 48000).byteLength).toBe(44);
  });
  test("rejects malformed channels, rates and non-finite PCM", () => {
    for (const channels of [[], [new Float32Array(1), new Float32Array(2)], [new Float32Array([NaN])]])
      expect(() => encodeWav(channels, 48000)).toThrow(PieceRenderError);
    expect(() => encodeWav([new Float32Array(1)], 0)).toThrow(PieceRenderError);
  });
});

describe("form and tail", () => {
  test("96 seconds from 40 bars at 100 BPM; frame counts always round up", () => {
    expect(renderLength(40, 100 / 240, 48000)).toEqual({
      seconds: 96,
      pieceFrames: 4608000,
      frames: 6048000,
    });
    const length = renderLength(1, 7 / 60, 44100);
    expect(length.pieceFrames / 44100).toBeGreaterThanOrEqual(length.seconds);
    expect(length.frames / 44100).toBeGreaterThanOrEqual(length.seconds + MAX_TAIL_S);
  });
  test("128 bars is accepted; excess, ambiguous length and unusable tempos are typed failures", () => {
    expect(renderLength(128, 0.5, 48000).seconds).toBe(256);
    for (const [bars, cps, code] of [
      [129, 0.5, "too-long"],
      [0, 0.5, "length"],
      [1.5, 1, "length"],
      [1, 0, "invalid-request"],
      [1, NaN, "invalid-request"],
      [1, 0.001, "too-long"],
    ] as const) {
      try {
        renderLength(bars, cps, 48000);
        throw new Error("expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(PieceRenderError);
        expect((error as PieceRenderError).code).toBe(code);
      }
    }
  });
  test("retains intentional ending rests, measures both channels and trims only the tail", () => {
    const left = new Float32Array(14000);
    const right = new Float32Array(14000);
    left[0] = 0.5;
    let out = trimAndMeasure(left, right, 2000, 1000);
    expect(out.left.length).toBe(2000);
    expect(out.rms).toBeCloseTo(Math.sqrt(0.25 / 4000), 10);
    right[2999] = 0.01;
    right[9000] = 0.0001; // below −60 dBFS
    out = trimAndMeasure(left, right, 2000, 1000);
    expect(out.left.length).toBe(3050);
    expect(out.peak).toBe(0.5);
  });
  test("rejects silence, invalid output and an unsettled tail", () => {
    const x = new Float32Array(14000);
    expect(() => trimAndMeasure(x, x, 2000, 1000)).toThrow(PieceRenderError);
    x[13999] = 0.01;
    expect(() => trimAndMeasure(x, x, 2000, 1000)).toThrow("30-second");
    x[0] = NaN;
    expect(() => trimAndMeasure(x, x, 2000, 1000)).toThrow("non-finite");
  });
});

describe("requests and errors", () => {
  test("defaults and mutes are a private snapshot", () => {
    const muted = new Set(["band.bass"]);
    const request = validateRequest({ code: "mel: silence", mutes: { muted, solo: null } });
    muted.clear();
    expect(request.sampleRate).toBe(48000);
    expect(request.muted).toEqual(["band.bass"]);
    expect(request.soundsRoot).toBe("/sounds/v4");
  });
  test("empty code, bad sample rates and timeouts fail before creating a realm", () => {
    expect(() => validateRequest({ code: " " })).toThrow(PieceRenderError);
    for (const sampleRate of [0, 44100.5, NaN, Infinity, 192000])
      expect(() => validateRequest({ code: "silence", sampleRate })).toThrow(PieceRenderError);
    for (const timeoutMs of [0, -1, NaN, 300001])
      expect(() => validateRequest({ code: "silence", timeoutMs })).toThrow(PieceRenderError);
  });
  test("frame and pack URLs stay same-origin", () => {
    expect(localUrl("/sounds/v3", "http://localhost:9592/test")).toBe("http://localhost:9592/sounds/v3");
    for (const url of ["https://elsewhere.test/", "//elsewhere.test/x", "data:text/html,x", "javascript:0"])
      expect(() => localUrl(url, "http://localhost:9592/")).toThrow(PieceRenderError);
  });
  test("errors survive the frame boundary with code, explanation and missing names", () => {
    const error = new PieceRenderError("missing-sound", "A sound could not load.", ["piano"]);
    expect(error).toBeInstanceOf(Error);
    expect(renderFailure(error)).toEqual({
      code: "missing-sound",
      message: "A sound could not load.",
      missingSounds: ["piano"],
    });
    expect(renderFailure("broken").code).toBe("engine");
    for (const code of ["aborted", "timeout", "evaluation", "silent"] as const)
      expect(new PieceRenderError(code, code).toJSON().code).toBe(code);
  });
});
