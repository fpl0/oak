import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEGREE_COLOURS,
  degreeBackgroundCss,
  degreeStyle,
  degreeText,
  functionStyle,
  NEUTRAL,
  parseDegree,
  type ThemeName,
  TREE_COLOURS,
  TREE_LINE_SCALE,
  TREE_LINES,
} from "./palette.ts";
import { DEFAULT_PREFS, resolveReducedMotion, resolveTheme, sanitizePrefs } from "./prefs.ts";

// --- WCAG contrast --------------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

function tokens(theme: ThemeName): Record<string, string> {
  const css = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");
  const block =
    theme === "paper"
      ? /:root,\s*:root\[data-theme="paper"\]\s*\{([^}]*)\}/.exec(css)?.[1]
      : /:root\[data-theme="bark"\]\s*\{([^}]*)\}/.exec(css)?.[1];
  const out: Record<string, string> = {};
  for (const m of (block ?? "").matchAll(/--oak-([\w-]+):\s*(#[0-9a-fA-F]{6})/g))
    out[m[1] as string] = m[2] as string;
  return out;
}

describe("tokens.css (ux §7.2, §7.9: WCAG 2.2 AA in both themes)", () => {
  for (const theme of ["paper", "bark"] as const) {
    const t = tokens(theme);
    test(`${theme}: every neutral token is defined`, () => {
      for (const k of [
        "bg",
        "surface",
        "surface-2",
        "border",
        "text",
        "text-2",
        "text-3",
        "accent",
        "issue",
        "danger",
      ])
        expect(t[k]).toMatch(/^#/);
    });
    test(`${theme}: body text passes 4.5:1 on every surface`, () => {
      for (const fg of ["text", "text-2", "text-3"])
        for (const bg of ["bg", "surface", "surface-2"])
          expect(contrast(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(4.5);
    });
    test(`${theme}: accent, issue and danger pass 3:1 as UI colours, and the accent button label 4.5:1`, () => {
      for (const c of ["accent", "issue", "danger"])
        expect(contrast(t[c] as string, t.bg as string)).toBeGreaterThanOrEqual(3);
      expect(contrast(t["on-accent"] as string, t.accent as string)).toBeGreaterThanOrEqual(4.5);
    });
    test(`${theme}: link, issue and danger also pass 4.5:1 as small text on every surface (Wave 4)`, () => {
      for (const fg of ["link", "issue", "danger", "accent"])
        for (const bg of ["bg", "surface", "surface-2"])
          expect(contrast(t[fg] as string, t[bg] as string), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["on-danger"] as string, t.danger as string)).toBeGreaterThanOrEqual(4.5);
    });
    test(`${theme}: a secondary control stands off a card (border ≥ 1.75:1) and its label reads (Wave 4)`, () => {
      for (const bg of ["surface", "bg"])
        expect(contrast(t["control-border"] as string, t[bg] as string)).toBeGreaterThanOrEqual(1.6);
      expect(contrast(t["control-border"] as string, t.surface as string)).toBeGreaterThanOrEqual(1.75);
      for (const fg of ["text", "text-2"])
        for (const bg of ["control", "control-hover"])
          expect(contrast(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(4.5);
    });
  }
  // Oak 2.0 (the owner's pick, 2026-11-26): "Night studio", neutral greys with a green accent, replacing ux §7.2's
  // warm neutrals. Pinned so a change to the palette is a decision, not a drift.
  test("the Oak 2.0 Night studio colours", () => {
    expect(tokens("paper").bg).toBe("#f4f4f2");
    expect(tokens("bark").bg).toBe("#0e0e10");
    expect(tokens("paper").accent).toBe("#1d7444");
    expect(tokens("bark").accent).toBe("#72d494");
  });
});

describe("music palette (ux §7.3)", () => {
  test("the seven degrees use the Okabe–Ito set on Paper", () => {
    expect(Object.values(DEGREE_COLOURS.paper).map((s) => s.fill)).toEqual([
      "#D55E00",
      "#E69F00",
      "#E8D93A",
      "#009E73",
      "#56B4E9",
      "#0072B2",
      "#CC79A7",
    ]);
  });

  test("degree labels stay legible on their fill: WCAG AA for small text (4.5:1), chips and scale rows are 13 px", () => {
    for (const theme of ["paper", "bark"] as const) {
      for (const s of Object.values(DEGREE_COLOURS[theme]))
        expect(contrast(s.label, s.fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(NEUTRAL[theme].label, NEUTRAL[theme].fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("an altered degree's hatch strokes keep the label at 4.5:1 where it crosses them", () => {
    const blend = (fill: string, rgba: string) => {
      const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(rgba) as RegExpExecArray;
      const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      const f = [1, 3, 5].map((i) => Number.parseInt(fill.slice(i, i + 2), 16));
      const mix = [r, g, b].map((c, i) => Math.round(c * a + (f[i] as number) * (1 - a)));
      return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    };
    for (const theme of ["paper", "bark"] as const)
      for (const d of ["b1", "#1", "b2", "b3", "#4", "b5", "b6", "b7", "#2", "#5", "#6"]) {
        const st = degreeStyle(d, theme);
        const css = degreeBackgroundCss(st);
        const stroke = /rgba\([^)]*\)/.exec(css)?.[0] as string;
        expect(contrast(st.label, blend(st.fill, stroke)), `${theme} ${d}`).toBeGreaterThanOrEqual(4.5);
      }
  });

  test("all seven fills are distinct in each theme", () => {
    for (const theme of ["paper", "bark"] as const)
      expect(new Set(Object.values(DEGREE_COLOURS[theme]).map((s) => s.fill)).size).toBe(7);
  });

  test("altered degrees keep the base colour, add a hatch and print the accidental", () => {
    expect(parseDegree("b7")).toEqual({ base: 7, alteration: "flat" });
    expect(parseDegree("#4")).toEqual({ base: 4, alteration: "sharp" });
    expect(parseDegree("8")).toBeNull();
    const flat7 = degreeStyle("b7", "paper");
    expect(flat7.fill).toBe(DEGREE_COLOURS.paper[7].fill);
    expect(flat7.hatchAngle).toBe(45);
    expect(flat7.text).toBe("♭7");
    const sharp4 = degreeStyle("#4", "bark");
    expect(sharp4.hatchAngle).toBe(-45);
    expect(sharp4.text).toBe("♯4");
    expect(degreeStyle("5", "paper").hatchAngle).toBeNull();
    expect(degreeBackgroundCss(flat7)).toContain("repeating-linear-gradient(45deg");
    expect(degreeBackgroundCss(degreeStyle("5", "paper"))).toBe("#56B4E9");
    expect(degreeText("b3")).toBe("♭3");
  });

  test("unknown pitches are neutral and still labelled", () => {
    const s = degreeStyle(null, "paper");
    expect(s.fill).toBe(NEUTRAL.paper.fill);
    expect(s.text).toBe("?");
  });

  test("T / PD / D take the colours of degrees 1, 4 and 5; secondary functions are dashed", () => {
    expect(functionStyle("T", "paper").fill).toBe(DEGREE_COLOURS.paper[1].fill);
    expect(functionStyle("PD", "paper").fill).toBe(DEGREE_COLOURS.paper[4].fill);
    expect(functionStyle("D", "bark").fill).toBe(DEGREE_COLOURS.bark[5].fill);
    expect(functionStyle("D", "paper", true).dashed).toBe(true);
    expect(functionStyle("D", "paper").text).toBe("D");
  });
});

describe("UI preferences", () => {
  test("sanitize keeps valid values and drops junk", () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({ theme: "bark", uiScale: 200, tutorWidth: 400, motion: "sideways" })).toEqual({
      ...DEFAULT_PREFS,
      theme: "bark",
      tutorWidth: 400,
    });
  });
  test("system theme and motion follow the OS", () => {
    expect(resolveTheme("system", true)).toBe("bark");
    expect(resolveTheme("system", false)).toBe("paper");
    expect(resolveTheme("paper", true)).toBe("paper");
    expect(resolveReducedMotion("system", true)).toBe(true);
    expect(resolveReducedMotion("off", true)).toBe(false);
    expect(resolveReducedMotion("on", false)).toBe(true);
  });
});

describe("the illustrated Oak's colours and lines come from the tokens (Wave 7)", () => {
  /** Every `--oak-*` of a theme's block, with `var(--oak-x)` resolved inside the same block. */
  function resolved(theme: ThemeName): Record<string, string> {
    const css = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");
    const block =
      theme === "paper"
        ? /:root,\s*:root\[data-theme="paper"\]\s*\{([^}]*)\}/.exec(css)?.[1]
        : /:root\[data-theme="bark"\]\s*\{([^}]*)\}/.exec(css)?.[1];
    const raw: Record<string, string> = {};
    for (const m of (block ?? "").matchAll(/--oak-([\w-]+):\s*([^;]+);/g))
      raw[m[1] as string] = (m[2] as string).trim();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const ref = /^var\(--oak-([\w-]+)\)$/.exec(v)?.[1];
      out[k] = (ref ? raw[ref] : v)?.toLowerCase() ?? "";
    }
    return out;
  }
  for (const theme of ["paper", "bark"] as const) {
    test(`${theme}: TREE_COLOURS equals tokens.css, and every leaf holds 3:1 on the tree's paper and ground`, () => {
      const t = resolved(theme);
      const c = TREE_COLOURS[theme];
      expect({
        bg: t["tree-bg"],
        ground: t["tree-ground"],
        wood: t["tree-wood"],
        grain: t["tree-grain"],
        ink: t["tree-ink"],
        accent: t.accent,
        issue: t.issue,
        acorn: t["tree-acorn"],
        leaf: {
          introduced: t["leaf-introduced"],
          practising: t["leaf-practising"],
          mastered: t["leaf-mastered"],
        },
      }).toEqual(c);
      // The tree's shared meanings are the chrome's own tokens.
      expect(c.bg).toBe(t.surface as string);
      expect(c.ink).toBe(t["text-2"] as string);
      for (const fill of [...Object.values(c.leaf), c.acorn, c.wood, c.ink, c.accent, c.issue])
        for (const under of [c.bg, c.ground])
          expect({ fill, under, ok: contrast(fill, under) >= 3 }).toEqual({ fill, under, ok: true });
    });
  }
  test("one scale of line weights, the same as tokens.css", () => {
    const css = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");
    for (const [name, w] of Object.entries(TREE_LINE_SCALE))
      expect(new RegExp(`--oak-tree-line-${name}:\\s*${w};`).test(css)).toBe(true);
    for (const w of Object.values(TREE_LINES)) expect(Object.values(TREE_LINE_SCALE)).toContain(w);
  });
});
