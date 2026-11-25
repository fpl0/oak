// Oak 2.0 W3: the worker's reading of a Studio piece (PLAN §4 S5, S6). `readPiece` evaluates the code in the browser
// grader host in capstone mode and analyses exactly the piece's bars (the same reading a capstone's cover is grown
// from: app/src/capstone/piece.ts). `analysisForSave` is the copy every Studio save attaches to its version
// (`sketch_versions.analysis_json`; the habits mirror reads its key and schemas): it never throws, and a slow or hung
// worker gives `null` after ANALYSIS_SAVE_TIMEOUT_MS, so the save is never held up (W3 Review Focus 5).
import type { AnalysisSummary, KeySpec, MeterId } from "@oak/content-kit";
import { keyEstimate, type Normalized, normalize, type PieceView } from "@oak/grader";
import { hasPitches, MAX_CAPSTONE_BARS, pieceAnalysis, pieceBars, truncate } from "../capstone/piece.ts";

/** How long a save waits for the analysis before it saves without one. Oak's call. */
export const ANALYSIS_SAVE_TIMEOUT_MS = 3000;

export interface PieceRead {
  /** The piece's first `bars` bars and its code (what `diffDimensions` compares). */
  view: PieceView;
  analysis: AnalysisSummary;
  bars: number;
}

interface ReadOptions {
  meter: MeterId;
  key: KeySpec | null;
  /** The bars to read: the `arrange()` total, else the sketch's loop length. */
  bars: number;
}

const clampBars = (bars: number): number => Math.max(1, Math.min(MAX_CAPSTONE_BARS, Math.floor(bars) || 1));

function readNormalized(n: Normalized, o: ReadOptions & { code: string }): PieceRead {
  // The piece's own length (its `arrange()` total, else its period), never more than the bars asked for.
  const bars = Math.min(clampBars(o.bars), pieceBars(o.code, n.all));
  const t = truncate(n, bars);
  // No key chosen: the estimate of the notes; a piece with no pitched notes has none.
  const key = o.key ?? (hasPitches(t) ? (keyEstimate(t.all)[0]?.key ?? null) : null);
  return {
    view: { n: t, code: o.code },
    analysis: pieceAnalysis(t, { code: o.code, meter: o.meter, key, bars }),
    bars,
  };
}

/** The analysis of the piece's first bars: `pieceBars` + `truncate` + the key estimate + `pieceAnalysis`. */
export function analysisOfNormalized(n: Normalized, o: ReadOptions & { code: string }): AnalysisSummary {
  return readNormalized(n, o).analysis;
}

/**
 * Evaluates `code` in the browser grader host (capstone mode) and reads it. `null` when it does not evaluate (or
 * the host fails or the read is aborted).
 */
export async function readPiece(
  code: string,
  o: ReadOptions,
  signal?: AbortSignal,
): Promise<PieceRead | null> {
  try {
    // Loaded on first use: the host module pulls in the worker (a Vite `?worker` import).
    const { graderHost } = await import("../lib/grader-client.ts");
    const host = await graderHost();
    const ev = await host.analyze(
      code,
      { mode: "capstone", bars: clampBars(o.bars), lint: null, meter: o.meter },
      signal,
    );
    if (!ev.ok) return null;
    return readNormalized(normalize(ev, { meter: o.meter }), { ...o, code });
  } catch {
    return null;
  }
}

/** `p`'s value, or `null` when it rejects or takes longer than `ms`. Never rejects. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * The analysis a Studio save attaches to its version. Never throws: `null` when the code does not evaluate, the
 * worker fails, or the read takes longer than ANALYSIS_SAVE_TIMEOUT_MS (the read is then aborted, so a hung worker
 * is replaced instead of holding up the next request).
 */
export async function analysisForSave(code: string, o: ReadOptions): Promise<AnalysisSummary | null> {
  const ac = new AbortController();
  try {
    const read = await withTimeout(readPiece(code, o, ac.signal), ANALYSIS_SAVE_TIMEOUT_MS);
    if (read === null) ac.abort();
    return read?.analysis ?? null;
  } catch {
    ac.abort();
    return null;
  }
}
