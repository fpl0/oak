// Oak 2.0 W3 (PLAN §4 S6): Studio's calm offers on Today. On a light day, one "Just play" line: a toolbox tool whose
// demo is live and editable and is never saved (its own "Open in Studio" keeps it), or, about one light day in four,
// a sketch over a Band style the learner has not used yet. And now and then "Outside your lane": a catalog of a track
// from a style the learner usually skips. Each is one line, never a primary button, never a goal. Which days are light
// and how often each offer shows are Oak's calls (W3 fidelity rule 4). Pure: tested in studio-offers.test.ts.
import type { FlavourId } from "@oak/content-kit";
import { STUDIO_FLAVOURS } from "../../studio/model.ts";
import type { TodayState } from "../today-model.ts";

export type StudioOffer =
  | { kind: "just-play"; toolId: string }
  | { kind: "band-style"; flavour: FlavourId }
  | { kind: "outside-lane" };

/** Oak's call of a light day: today's session is done, a light session, a review day, or the edge of the course. */
export const LIGHT_DAY_STATES: readonly TodayState[] = ["done", "light", "review", "edge"];
/** Oak's call: "Outside your lane" shows when no such catalog was made, or the offer dismissed, in this many days. */
export const OUTSIDE_LANE_DAYS = 14;
/** Oak's call: on a light day with `daySeed(day, BAND_STYLE_EVERY) === 0` (about one in four), a Band style instead. */
export const BAND_STYLE_EVERY = 4;
/** Where "Not now" on "Outside your lane" is remembered (this browser only). */
export const OUTSIDE_DISMISSED_KEY = "oak.outside.dismissedAt";

/** A stable index in `[0, n)` for the day: FNV-1a (32-bit) of the date string, mod `n`. */
export function daySeed(day: string, n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % Math.floor(n);
}

/** Whole days from `a` to `b` (each `YYYY-MM-DD` or an ISO instant, read by its date). */
export function daysBetween(a: string, b: string): number {
  const ms = (d: string) =>
    Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

const recent = (at: string | null, day: string): boolean =>
  at !== null && at !== "" && daysBetween(at, day) < OUTSIDE_LANE_DAYS;

/**
 * Today's Studio offers, in order: at most one "Just play" (a tool, or a Band style) on a light day, then "Outside
 * your lane" when it is due. Never on the first run or while a session is open.
 */
export function studioOffers(o: {
  state: TodayState;
  day: string;
  /** Unlocked tools with a live demo, in a stable order. */
  playableTools: readonly string[];
  /** The Band flavours of the learner's sketch versions. */
  usedFlavours: ReadonlySet<string>;
  /** When the newest `outside` catalog was made, or `null`. */
  lastOutside: string | null;
  /** When "Not now" was last chosen on "Outside your lane", or `null`. */
  outsideDismissedAt: string | null;
}): StudioOffer[] {
  if (o.state === "first-run" || o.state === "in-session") return [];
  const out: StudioOffer[] = [];
  if (LIGHT_DAY_STATES.includes(o.state)) {
    const unused = STUDIO_FLAVOURS.find((f) => !o.usedFlavours.has(f.id));
    if (unused && daySeed(o.day, BAND_STYLE_EVERY) === 0)
      out.push({ kind: "band-style", flavour: unused.id });
    else if (o.playableTools.length > 0) {
      const toolId = o.playableTools[daySeed(o.day, o.playableTools.length)];
      if (toolId !== undefined) out.push({ kind: "just-play", toolId });
    }
  }
  if (!recent(o.lastOutside, o.day) && !recent(o.outsideDismissedAt, o.day))
    out.push({ kind: "outside-lane" });
  return out;
}

/** Every string of the offers (descriptive: studio-offers.test.ts). */
export const STUDIO_OFFER_WORDS = {
  label: "Studio, if you like",
  justPlay: (tool: string) =>
    `Just play: try ${tool} with nothing riding on it. Keep it only if you like it.`,
  openTool: "Open it",
  bandStyle: (style: string) => `Just play: a sketch over the ${style} Band, a style you have not used yet.`,
  startBand: "Start it",
  outside:
    "Outside your lane: pick a style you usually skip and a track its fans love. Listen, then write what they hear in it.",
  openOutside: "Try it",
  notNow: "Not now",
  bandFailed: "The sketch was not created. Try again from Studio.",
} as const;
