// Loop region maths (ux §3.4 "Transport bar": `Loop ⟲ bars 1–2`; ux §7.10: `L` loop, `[`/`]` shrink/extend,
// `Shift+[`/`Shift+]` move). A region is whole bars inside the analysed loop. While the region loops, the
// workbench plays the code through the adapter's hidden PatternPlayer, whose A–B loop is
// `.ribbon(fromBar, bars)`: the code text is never changed, and the Band (or the unit song) plays as the player's
// own Band layer, the same one the editor plays (use-loop.ts). Pure: tested in loop.test.ts.

export interface LoopRegion {
  /** 0-based first bar. */
  from: number;
  /** Length in bars, at least 1. */
  bars: number;
}

/** The region `L` loops first: the first half of the loop (bars 1–2 of a 4-bar loop), at least one bar. */
export function defaultRegion(loopBars: number): LoopRegion {
  const total = Math.max(1, Math.floor(loopBars));
  return { from: 0, bars: Math.max(1, Math.floor(total / 2)) };
}

/** Keeps a region inside `[0, loopBars)`, whole bars, at least one bar long. */
export function clampRegion(r: LoopRegion, loopBars: number): LoopRegion {
  const total = Math.max(1, Math.floor(loopBars));
  const bars = Math.max(1, Math.min(total, Math.floor(r.bars)));
  const from = Math.max(0, Math.min(total - bars, Math.floor(r.from)));
  return { from, bars };
}

export type RegionStep = "shrink" | "extend" | "earlier" | "later";

/** `[` one bar shorter, `]` one bar longer (at the end), `Shift+[` / `Shift+]` move by one bar. */
export function stepRegion(r: LoopRegion, step: RegionStep, loopBars: number): LoopRegion {
  const total = Math.max(1, Math.floor(loopBars));
  switch (step) {
    case "shrink":
      return clampRegion({ from: r.from, bars: r.bars - 1 }, total);
    case "extend":
      // Grow at the end; at the end of the loop, grow at the start instead.
      if (r.from + r.bars < total) return clampRegion({ from: r.from, bars: r.bars + 1 }, total);
      return clampRegion({ from: r.from - 1, bars: r.bars + 1 }, total);
    case "earlier":
      return clampRegion({ from: r.from - 1, bars: r.bars }, total);
    case "later":
      return clampRegion({ from: r.from + 1, bars: r.bars }, total);
  }
}

/** "bars 1–2", "bar 3". */
export function regionLabel(r: LoopRegion): string {
  return r.bars === 1 ? `bar ${r.from + 1}` : `bars ${r.from + 1}–${r.from + r.bars}`;
}

/** Bar position of an ever-growing transport cycle inside a looping region (what the playhead shows). */
export function loopPosition(cycle: number, r: LoopRegion): number {
  if (!Number.isFinite(cycle) || r.bars <= 0) return r.from;
  const within = ((cycle % r.bars) + r.bars) % r.bars;
  return r.from + within;
}

/**
 * The loop a tutor bar reference asks for (`[[bars:2-3]]`, 1-based, inclusive). Bars count from the first full bar
 * (c4), so with a pickup the tutor's bar n is cycle n (cycle 0 holds the pickup); without one it is cycle n − 1.
 */
export function tutorBarsRegion(d: { from: number; to: number }, pickup: boolean): LoopRegion {
  const from = Math.min(d.from, d.to);
  const to = Math.max(d.from, d.to);
  return { from: from - 1 + (pickup ? 1 : 0), bars: to - from + 1 };
}

/** True when the region covers the whole loop (looping it changes nothing audible). */
export function isWholeLoop(r: LoopRegion, loopBars: number): boolean {
  return r.from === 0 && r.bars >= Math.floor(loopBars);
}
