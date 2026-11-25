/** Steps per 4/4 bar: 8 eighths, 12 eighth-note triplets, 16 sixteenths. */
export type TapGrid = 8 | 12 | 16;

export interface TapsToMiniOptions {
  /** Default 8. */
  grid?: TapGrid;
  /** Bars to write from bar 1 (a pickup bar comes on top). Default: enough bars for the last tap. */
  bars?: number;
  /** Quarter-note beats per bar: 4/4 = 4, 3/4 = 3, 2/4 = 2. Default 4. */
  beatsPerBar?: 2 | 3 | 4;
}

export interface TapsToMiniResult {
  /** Hits `x`, rests `~`. One bar: space-separated steps. Several bars: `<[…] […]>`. */
  mini: string;
  /** Bars written, a pickup bar included. */
  bars: number;
  /** Taps merged into an existing hit, outside the written bars, or not finite. */
  dropped: number;
  /** True when taps before bar 1 were written as a first, pickup bar. */
  pickup: boolean;
}

function barToMini(hits: ReadonlySet<number>, stepsPerBar: number): string {
  if (hits.size === 0) return "~";
  // Dividing the bar and every hit by the same factor preserves their positions in the cycle.
  let divisor = stepsPerBar;
  while (stepsPerBar % divisor !== 0 || [...hits].some((step) => step % divisor !== 0)) divisor--;
  return Array.from({ length: stepsPerBar / divisor }, (_, i) => (hits.has(i * divisor) ? "x" : "~")).join(
    " ",
  );
}

export function tapsToMini(
  onsetsSec: readonly number[],
  bpm: number,
  opts: TapsToMiniOptions = {},
): TapsToMiniResult {
  // The default eighth-note grid is Oak's choice, not a target for the learner.
  const { grid = 8, beatsPerBar = 4, bars: requestedBars } = opts;
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError("bpm must be finite and positive");
  if (requestedBars !== undefined && (!Number.isInteger(requestedBars) || requestedBars <= 0))
    throw new RangeError("bars must be a positive integer");
  if (grid !== 8 && grid !== 12 && grid !== 16) throw new RangeError("grid must be 8, 12 or 16");
  if (beatsPerBar !== 2 && beatsPerBar !== 3 && beatsPerBar !== 4)
    throw new RangeError("beatsPerBar must be 2, 3 or 4");

  const beatSec = 60 / bpm;
  const barSec = beatSec * beatsPerBar;
  const stepsPerBar = (grid * beatsPerBar) / 4;
  const stepSec = barSec / stepsPerBar;
  const finiteOnsets = onsetsSec.filter(Number.isFinite).sort((a, b) => a - b);
  let dropped = onsetsSec.length - finiteOnsets.length;
  const hits = new Set<number>();
  let maxK = 0;
  let pickup = false;
  for (const t of finiteOnsets) {
    const k = Math.round(t / stepSec);
    if (
      k < -stepsPerBar ||
      (requestedBars !== undefined && k >= requestedBars * stepsPerBar) ||
      hits.has(k)
    ) {
      dropped++;
      continue;
    }
    hits.add(k);
    if (k < 0) pickup = true;
    else maxK = Math.max(maxK, k);
  }

  const barsFromDownbeat = requestedBars ?? Math.max(1, Math.floor(maxK / stepsPerBar) + 1);
  const bars = barsFromDownbeat + (pickup ? 1 : 0);
  const barHits = Array.from({ length: bars }, () => new Set<number>());
  for (const k of hits) {
    const offset = k + (pickup ? stepsPerBar : 0);
    barHits[Math.floor(offset / stepsPerBar)]?.add(offset % stepsPerBar);
  }
  const written = barHits.map((bar) => barToMini(bar, stepsPerBar));
  const mini = bars === 1 ? written.join("") : `<${written.map((bar) => `[${bar}]`).join(" ")}>`;
  return { mini, bars, dropped, pickup };
}
