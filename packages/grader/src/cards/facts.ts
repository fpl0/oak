import type { AnalysisSummary, CardFacts, CardTrackFacts, ToolEntry } from "@oak/content-kit";
import { labelledLines, roleOfLabel } from "@oak/content-kit";
import { toolsUsed } from "../lint/index.ts";
import type { Normalized } from "../types.ts";

export function cardFacts(o: {
  code: string;
  n: Normalized;
  bpm: number | null;
  slots: AnalysisSummary["slots"] | null;
  toolbox: readonly ToolEntry[];
}): CardFacts {
  const order = new Map<string, number>();
  for (const [index, line] of labelledLines(o.code).entries()) {
    if (!order.has(line.label)) order.set(line.label, index);
  }
  // Stable sorting leaves anonymous and otherwise unlabelled tracks in their stored order.
  const tracks: CardTrackFacts[] = Object.entries(o.n.byTrack)
    .filter(([label, events]) => !label.startsWith("band.") && events.length > 0)
    .sort(([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
    .map(([label, events]) => {
      const sounds = new Set<string>();
      const pitches = new Set<number>();
      let low: number | null = null;
      let high: number | null = null;
      for (const event of events) {
        if (event.s) sounds.add(event.s);
        if (event.bank) sounds.add(event.bank);
        if (event.midi !== null && !event.drum) {
          pitches.add(event.midi);
          low = low === null ? event.midi : Math.min(low, event.midi);
          high = high === null ? event.midi : Math.max(high, event.midi);
        }
      }
      return {
        label,
        role: roleOfLabel(label),
        sounds: [...sounds],
        notes: events.length,
        low,
        high,
        distinct: pitches.size,
      };
    });
  const numerals: string[] = [];
  for (const { rn } of o.slots ?? []) {
    if (numerals.at(-1) !== rn) numerals.push(rn);
  }
  return {
    bpm: o.bpm,
    tracks,
    tools: [...new Set(toolsUsed(o.code, o.toolbox).map(({ id }) => id))],
    numerals,
  };
}
