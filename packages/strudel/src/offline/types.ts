import type { KeySpec } from "@oak/content-kit";
import type { BandSetup, MuteMap } from "../types.ts";

export interface RenderPieceRequest {
  /**
   * The editor's complete source, unchanged. One cycle is one bar. With a unit song (`band.song`) it may be empty:
   * the song plays alone, and its length is the song's form.
   */
  code: string;
  /** Resolved selection from the same content snapshot as the live editor. */
  band?: BandSetup | null;
  key?: KeySpec | null;
  mutes?: MuteMap;
  sampleRate?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  /** Same-origin frame entry and pack root; defaults match the installed Oak pack. */
  frameUrl?: string;
  soundsRoot?: string;
  /** Covers frame boot, evaluation, loading and rendering. Default 60 seconds. */
  timeoutMs?: number;
}

export interface PiecePcm {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  bars: number;
  cps: number;
  /** Structure only, before release/reverb. */
  pieceDurationS: number;
  /** Exact PCM length, including the measured tail. */
  durationS: number;
  tailS: number;
  peak: number;
  rms: number;
  /** Empty on success; failed loads reject with PieceRenderError instead of exporting a partial mix. */
  missingSounds: string[];
}

export interface RenderedPiece extends PiecePcm {
  /** Encoded on demand, so callers that only need PCM do not allocate a second audio file. */
  wav(): ArrayBuffer;
  wavBlob(): Blob;
}

export interface FrameRequest {
  code: string;
  band: BandSetup | null;
  key: KeySpec | null;
  muted: string[];
  solo: string | null;
  sampleRate: number;
  soundsRoot: string;
}
