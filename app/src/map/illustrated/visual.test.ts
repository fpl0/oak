import { describe, expect, test } from "bun:test";
import { freshness, nodeFreshness } from "@oak/srs";
import { fixtureState, learnerFixture } from "./fixtures.ts";
import { layoutIllustratedOak } from "./layout.ts";
import { illustratedOakSvg } from "./svg.tsx";
import { leafDescription, leafVisual, TREE_PALETTE } from "./visual.ts";

describe("contract leaf states in both themes", () => {
  test("anatomical labels exceed 4.5:1 against both sky and ground", () => {
    const luminance = (hex: string) => {
      const c = [1, 3, 5]
        .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return (c[0] ?? 0) * 0.2126 + (c[1] ?? 0) * 0.7152 + (c[2] ?? 0) * 0.0722;
    };
    for (const [theme, p] of Object.entries(TREE_PALETTE))
      for (const background of [p.bg, p.ground]) {
        const a = luminance(p.ink);
        const b = luminance(background);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), theme).toBeGreaterThanOrEqual(4.5);
      }
  });
  for (const theme of ["paper", "bark"] as const) {
    for (const level of ["new", "available", "learning", "practiced", "mastered"] as const) {
      test(`${theme} ${level}: every old recall band, both warm-up states`, () => {
        for (const R of [0.99, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.4])
          for (const drying of [true, false]) {
            const F = freshness(R, 0.85);
            const state = fixtureState("R01", { level, R, freshness: F, drying });
            const v = leafVisual(state, theme);
            const tracked = level !== "new" && level !== "available";
            expect(v.opacity).toBeCloseTo(tracked ? 0.35 + 0.65 * F : 1, 9);
            expect(v.droop).toBe(drying && tracked ? 10 : 0);
            expect(v.dryEdge).toBe(drying && tracked);
            expect(v.bud).toBe(!tracked);
            expect(v.ring).toBe(level === "mastered");
            expect(v.glow).toBe(level === "available");
            expect(v.fill).toBe(leafVisual({ ...state, R: 1 }, theme).fill);
            expect(v.fill).toBe(
              theme === "paper"
                ? {
                    new: "none",
                    available: "none",
                    learning: "#b7791f",
                    practiced: "#2a7f80",
                    mastered: "#1d7444",
                  }[level]
                : {
                    new: "none",
                    available: "none",
                    learning: "#e0a54a",
                    practiced: "#5fc0be",
                    mastered: "#72d494",
                  }[level],
            );
          }
      });
    }
  }
  test("per-card retention and perceptual weighting come through unchanged", () => {
    const F = nodeFreshness([
      { retrievability: 0.8, desiredRetention: 0.8, weight: 2 },
      { retrievability: 0.9, desiredRetention: 0.9, weight: 1 },
    ]);
    expect(leafVisual(fixtureState("S01", { freshness: F ?? 0 }), "paper").opacity).toBe(1);
  });
  test("new glint needs explicit introduction evidence; every state has a text alternative", () => {
    const state = fixtureState("S01", { level: "learning", paused: true, drying: true, freshness: 0.3 });
    expect(leafVisual(state, "paper").glint).toBe(false);
    expect(leafVisual(state, "paper", true).glint).toBe(true);
    expect(leafVisual(undefined, "bark", true).glint).toBe(false);
    expect(leafDescription("Major scale", state, true)).toContain("Freshness 30%");
    expect(leafDescription("Major scale", state, true)).toContain("Waiting for the mic");
    expect(leafDescription("Major scale", state, true)).toContain("In today's warm-up");
  });
  test("whole-tree SVG is byte-identical, accessible, and safely escapes text (snapshots)", () => {
    const fixture = learnerFixture("mid");
    const layout = layoutIllustratedOak(fixture.graph);
    for (const theme of ["paper", "bark"] as const) {
      const input = { ...fixture, layout, theme };
      const svg = illustratedOakSvg(input);
      expect(svg).toBe(illustratedOakSvg(input));
      expect((svg.match(/data-node=/g) ?? []).length).toBe(143);
      expect(svg).toMatchSnapshot(theme);
      expect(
        illustratedOakSvg({
          ...input,
          releasedTracks: [{ id: "x", capstoneId: "C0", title: '<script>alert("x")</script>' }],
        }),
      ).toContain("&lt;script&gt;");
    }
  });
});
