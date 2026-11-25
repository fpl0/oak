// Oak 2.0 W3 Studio offers on Today (PLAN §4 S6): "Just play" on light days only, the day's tool stable, a Band style
// about one light day in four, "Outside your lane" when due; never on the first run or in a session.
import { describe, expect, test } from "bun:test";
import { isDescriptive } from "../../studio/descriptive.ts";
import type { TodayState } from "../today-model.ts";
import {
  BAND_STYLE_EVERY,
  daySeed,
  daysBetween,
  LIGHT_DAY_STATES,
  OUTSIDE_LANE_DAYS,
  STUDIO_OFFER_WORDS,
  studioOffers,
} from "./studio-offers.ts";

const TOOLS = ["tb.a", "tb.b", "tb.c"];

/** The first day from 2026-11-01 whose seed mod 4 is (or is not) 0. */
function dayWhere(zero: boolean): string {
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);
    if ((daySeed(d, BAND_STYLE_EVERY) === 0) === zero) return d;
  }
  throw new Error("no such day in 60");
}

const dayBefore = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00.000Z`) - n * 86_400_000).toISOString();

const base = (state: TodayState, day: string, over: Partial<Parameters<typeof studioOffers>[0]> = {}) => ({
  state,
  day,
  playableTools: TOOLS,
  usedFlavours: new Set(["flavour.pop", "flavour.jazz-soul"]),
  lastOutside: dayBefore(day, 3),
  outsideDismissedAt: null,
  ...over,
});

describe("daySeed", () => {
  test("stable for a day, within [0, n)", () => {
    expect(daySeed("2026-11-25", 3)).toBe(daySeed("2026-11-25", 3));
    for (let i = 0; i < 30; i++) {
      const s = daySeed(`2026-11-${String(i + 1).padStart(2, "0")}`, 7);
      expect(s >= 0 && s < 7 && Number.isInteger(s)).toBe(true);
    }
    expect(daySeed("2026-11-25", 0)).toBe(0);
  });

  test("daysBetween reads dates and instants by their date", () => {
    expect(daysBetween("2026-11-05", "2026-11-25")).toBe(20);
    expect(daysBetween("2026-11-22T23:00:00.000Z", "2026-11-25")).toBe(3);
  });
});

describe("Just play", () => {
  test("an ordinary day offers nothing", () => {
    expect(studioOffers(base("normal", "2026-11-25"))).toEqual([]);
  });

  test("a done day offers one tool, the day's, the same on a second call", () => {
    const day = dayWhere(false);
    const offers = studioOffers(base("done", day));
    expect(offers).toEqual([{ kind: "just-play", toolId: TOOLS[daySeed(day, 3)] as string }]);
    expect(studioOffers(base("done", day))).toEqual(offers);
  });

  test("every light day state offers it; no tool with a demo, no line", () => {
    const day = dayWhere(false);
    for (const s of LIGHT_DAY_STATES)
      expect(studioOffers(base(s, day)).map((o) => o.kind)).toEqual(["just-play"]);
    expect(studioOffers(base("done", day, { playableTools: [] }))).toEqual([]);
  });

  test("about one light day in four: a Band style not used yet, else the tool", () => {
    const day = dayWhere(true);
    expect(studioOffers(base("done", day, { usedFlavours: new Set(["flavour.pop"]) }))).toEqual([
      { kind: "band-style", flavour: "flavour.jazz-soul" },
    ]);
    expect(studioOffers(base("done", day, { usedFlavours: new Set() }))).toEqual([
      { kind: "band-style", flavour: "flavour.pop" },
    ]);
    expect(studioOffers(base("done", day)).map((o) => o.kind)).toEqual(["just-play"]);
    // A day that is not one in four never offers the Band style.
    expect(
      studioOffers(base("done", dayWhere(false), { usedFlavours: new Set(["flavour.pop"]) })).map(
        (o) => o.kind,
      ),
    ).toEqual(["just-play"]);
  });
});

describe("Outside your lane", () => {
  const day = "2026-11-25";
  test("shows when the last outside catalog is 20 days old and it was never dismissed", () => {
    expect(studioOffers(base("normal", day, { lastOutside: dayBefore(day, 20) }))).toEqual([
      { kind: "outside-lane" },
    ]);
    expect(studioOffers(base("normal", day, { lastOutside: null }))).toEqual([{ kind: "outside-lane" }]);
    expect(studioOffers(base("normal", day, { lastOutside: dayBefore(day, OUTSIDE_LANE_DAYS) }))).toEqual([
      { kind: "outside-lane" },
    ]);
  });

  test("absent when the last one is 3 days old or it was dismissed 3 days ago", () => {
    expect(studioOffers(base("normal", day, { lastOutside: dayBefore(day, 3) }))).toEqual([]);
    expect(
      studioOffers(base("normal", day, { lastOutside: null, outsideDismissedAt: dayBefore(day, 3) })),
    ).toEqual([]);
  });

  test("after a light day's line, and never on the first run or in a session", () => {
    const d = dayWhere(false);
    expect(studioOffers(base("done", d, { lastOutside: null })).map((o) => o.kind)).toEqual([
      "just-play",
      "outside-lane",
    ]);
    for (const s of ["first-run", "in-session"] as const)
      expect(studioOffers(base(s, d, { lastOutside: null, playableTools: TOOLS }))).toEqual([]);
  });
});

describe("words", () => {
  test("every string only describes", () => {
    for (const [k, v] of Object.entries(STUDIO_OFFER_WORDS)) {
      const text = typeof v === "function" ? v("Jazz-soul") : v;
      expect({ k, ok: isDescriptive(text) }).toEqual({ k, ok: true });
    }
    expect(STUDIO_OFFER_WORDS.justPlay(".rev()")).toStartWith("Just play: try .rev()");
  });
});

test("X24 AC24: Today offers a style the learner would never play", () => {
  expect(STUDIO_OFFER_WORDS.outside).toBe(
    "Outside your lane: pick a style you would never play for yourself and a track its fans love. Listen, then write what they hear in it.",
  );
  for (const value of Object.values(STUDIO_OFFER_WORDS)) {
    if (typeof value === "string") expect(value).not.toContain("usually skip");
  }
});
