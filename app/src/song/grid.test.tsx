// The arrangement grid's shared rules (spec 2026-11-24 §5.5): every section header shows at least its letter, a part
// keeps one colour and no two parts of a song share one, the four block states are drawn and named the same on the
// song grid and the Make strip, and a part that does not sound looks silent. A DOM simulator (happy-dom) renders the
// grid and the strip with React: it checks what is drawn, never layout.
import { afterAll, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ReactNode } from "react";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// The content loader uses Vite's `import.meta.glob`, which Bun has not; the strip's module reaches it, but never reads.
mock.module(new URL("../lib/content.ts", import.meta.url).pathname, () => ({
  loadContent: async () => ({}),
  contentQuery: { queryKey: ["content"], queryFn: async () => ({}) },
  useContent: () => ({ data: undefined, isPending: false, isError: false }),
}));

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { unitSongs } = await import("../../../content/unit-songs/index.ts");
const { songViewOf } = await import("./model.ts");
const { cellLook, headName, headText, headTexts, MIN_CUT, MIN_SECTION_PX, SongGrid } = await import(
  "./SongGrid.tsx"
);
const { ringTonesOf } = await import("./SongCover.tsx");
const { SongStrip } = await import("../lesson/song-make-ui.tsx");
const { songPartTones } = await import("./part-tones.ts");
const { TEST_SONG, testDetail, testTake } = await import("./test-song.ts");

import type { TakeStep } from "@oak/api";

const L01 = testTake(1, "U01.L01", 'setcpm(96/4)\n\ndrums: s("bd sd bd sd")', ["kick@verse", "snare@verse"], {
  bpm: 96,
  labels: { drums: null },
});
const L02_STEP = TEST_SONG.plan[1] as TakeStep;

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLElement;
afterAll(async () => {
  await act(async () => root?.unmount());
});
async function render(node: ReactNode) {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
}
const all = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
const one = (sel: string) => {
  const el = container.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

describe("section headers", () => {
  const verse = { label: "Verse", letter: "B", startBar: 4 };
  test("a wide column shows the name and the start bar; a narrower one drops the bar, then shows the letter", () => {
    expect(headText(verse, 120, { showBars: true })).toMatchObject({
      text: "Verse",
      bars: true,
      tight: false,
    });
    expect(headText(verse, 52, { showBars: true })).toMatchObject({ text: "Verse", bars: false });
    const narrow = headText(verse, 30, { showBars: true, looping: true });
    expect(narrow).toMatchObject({ text: "B", letterForName: true, bars: false });
    // The letter is said with the name, so the visible text is part of the accessible name.
    expect(headName(verse, narrow)).toBe("Verse (B)");
  });
  test("the letter is never hidden, however narrow the column; it loses its padding instead", () => {
    const stop = { label: "C", letter: "C", startBar: 12 };
    expect(headText(stop, 14)).toMatchObject({ text: "C", tight: true, icon: false, bars: false });
    expect(headName(stop, headText(stop, 14))).toBe("C");
    expect(headText(stop, 14, { compact: true }).text).toBe("C");
  });
  test("a name that does not fit is cut short with an ellipsis while about three characters fit", () => {
    const bridge = { label: "Bridge", letter: "C", startBar: 16 };
    // Whole in the smaller type first, then cut ("Bri…"), and only then the letter.
    expect(headText(bridge, 48)).toMatchObject({ text: "Bridge", form: "label", small: true });
    expect(headText(bridge, 34)).toMatchObject({ text: "Bri…", form: "cut", letterForName: true });
    // As much of the name as fits.
    expect(headText(bridge, 39).text).toBe("Brid…");
    expect(headName(bridge, headText(bridge, 34))).toBe("Bridge");
    expect(headText(bridge, 20)).toMatchObject({ text: "C", form: "letter" });
    // A start bar comes only after a whole label, after a hairline, never after a letter that stands for a name.
    expect(headText(bridge, 120, { showBars: true }).bars).toBe(true);
    expect(headText(bridge, 34, { showBars: true }).bars).toBe(false);
  });
  test("two different sections never show the same text: Intro's letter gives way beside the jazz A section", () => {
    const sections = [
      { label: "Intro", letter: "A", startBar: 0 },
      { label: "A", letter: "B", startBar: 4 },
      { label: "Bridge", letter: "C", startBar: 12 },
      { label: "Break", letter: "D", startBar: 16 },
    ];
    const texts = headTexts(sections, [14, 60, 39, 39]).map((h) => h.text);
    expect(texts[0]).not.toBe("A");
    expect(texts[0]?.startsWith("I")).toBe(true);
    // Break and Bridge both start "Br": their cut forms keep enough to tell them apart.
    expect(new Set(texts).size).toBe(4);
  });
  test("the loop icon shows only where it fits", () => {
    expect(headText(verse, 120, { looping: true }).icon).toBe(true);
    expect(headText(verse, 50, { looping: true })).toMatchObject({ text: "Verse", icon: false });
  });
});

/** Each section's column width in a grid whose section area is `area` px (the CSS grid's minmax(14px, bars fr)). */
function columnWidths(bars: readonly number[], area: number, gap = 2): number[] {
  const free = area - gap * (bars.length - 1);
  const fixed = new Set<number>();
  for (;;) {
    const fr = bars.reduce((n, b, i) => (fixed.has(i) ? n : n + Math.max(1, b)), 0);
    const per = (free - fixed.size * MIN_SECTION_PX) / Math.max(1, fr);
    const under = bars.findIndex((b, i) => !fixed.has(i) && Math.max(1, b) * per < MIN_SECTION_PX);
    if (under < 0) return bars.map((b, i) => (fixed.has(i) ? MIN_SECTION_PX : Math.max(1, b) * per));
    fixed.add(under);
  }
}

describe("section headers on every unit song", () => {
  // The terms that name sections: none yet (letters), and all of them (names, the jazz A and B sections included).
  const terms = [
    new Set<string>(),
    new Set(["term.form", "term.verse", "term.chorus", "term.bridge", "term.head"]),
  ];
  // Section areas from the lesson card and Today's hero (about 560 px at 1280) to the song page at 1440 (about 1000).
  const areas = [380, 460, 560, 640, 720, 800, 900, 1000];
  test("a header shows its label, its name cut short, or (narrowest only) a letter; never another section's text", () => {
    for (const song of unitSongs)
      for (const introduced of terms)
        for (const compact of [false, true]) {
          const view = songViewOf(song, null, introduced);
          for (const area of areas) {
            const widths = columnWidths(
              view.sections.map((x) => x.bars),
              compact ? area / 2 : area,
            );
            const heads = headTexts(view.sections, widths, () => ({ compact }));
            const where = `${song.unit} ${compact ? "compact" : "full"} ${area}px`;
            heads.forEach((h, i) => {
              const sec = view.sections[i];
              if (!sec) return;
              expect(h.text.trim(), where).not.toBe("");
              if (h.form === "label") expect(h.text, where).toBe(sec.label);
              if (h.form === "cut") {
                expect(h.text.endsWith("…"), where).toBe(true);
                expect(sec.label.startsWith(h.text.slice(0, -1)), where).toBe(true);
                expect(h.text.length - 1, where).toBeGreaterThanOrEqual(MIN_CUT);
              }
              // A letter (or the start of a name standing in for it) only where a cut name does not fit.
              if (h.form === "letter" && sec.label !== sec.letter)
                expect(widths[i] ?? 0, where).toBeLessThan(compact ? 34 : 38);
              // Two different sections never show the same text; a repeated section may.
              heads.forEach((o, j) => {
                const other = view.sections[j];
                if (other && other.label !== sec.label)
                  expect(o.text, `${where}: ${sec.label}/${other.label}`).not.toBe(h.text);
              });
            });
          }
        }
  });
});

describe("cover rings", () => {
  test("on every unit song, each ring is the colour of the row of the part its take brought in", () => {
    for (const song of unitSongs) {
      const rows = songPartTones(song.parts);
      const first = song.sections[0]?.id ?? "";
      // One take per part, in reverse row order, then one that brings no new part (it takes its first part's colour).
      const parts = [...song.parts].reverse();
      const takes = [
        ...parts.map((p) => ({ cells: [`${p.id}@${first}`] })),
        { cells: [`${parts[0]?.id}@${first}`] },
      ];
      const rings = ringTonesOf(song, takes);
      parts.forEach((p, i) => {
        expect(rings[i], `${song.unit} ${p.id}`).toBe(rows.get(p.id) as string);
      });
      expect(rings.at(-1), song.unit).toBe(rows.get(parts[0]?.id ?? "") as string);
    }
  });
});

describe("part colours", () => {
  test("no two parts of any unit song share a colour", () => {
    for (const song of unitSongs) {
      const tones = [...songPartTones(song.parts).values()];
      expect(new Set(tones).size, song.id).toBe(song.parts.length);
    }
  });
  test("a part keeps its colour from song to song", () => {
    const kick = new Set(unitSongs.map((s) => songPartTones(s.parts).get("kick")));
    const lead = new Set(unitSongs.map((s) => songPartTones(s.parts).get("lead")));
    expect(kick.size).toBe(1);
    expect(lead.size).toBe(1);
  });
  test("Oak's New song wash keeps the hatch, so it never reads as a block of yours", () => {
    const tinted = cellLook("oak", false, "#8C6A4F", true);
    expect(tinted.className).toBe("oak-song-oak");
    expect(Object.keys(tinted.style)).toEqual(["backgroundColor"]);
    expect(cellLook("oak", true, "#8C6A4F").className).toBe("oak-song-rest");
  });
});

describe("the grid and the Make strip", () => {
  const view = songViewOf(TEST_SONG, testDetail([L01]), new Set(), { live: L02_STEP });

  test("the Make strip draws each block with the grid's look and names the same four states", async () => {
    await render(<SongGrid view={view} />);
    const look = (k: string) =>
      one(`[data-cell="${k}"]`).className.match(/oak-song-(oak|rest|yours|today)/)?.[0];
    const keys = all("[data-cell]").map((c) => c.dataset.cell as string);
    const grid = new Map(keys.map((k) => [k, look(k)]));
    const gridLegend = all("[data-legend]").map((l) => l.textContent);
    await render(<SongStrip view={view} loop={null} onLoop={() => {}} />);
    expect(new Map(keys.map((k) => [k, look(k)]))).toEqual(grid);
    expect(all("[data-legend]").map((l) => l.textContent)).toEqual(gridLegend);
    // Each row is named, and every section button shows at least its letter.
    expect(all('[data-testid="song-strip-part"]').map((n) => n.textContent)).toEqual(
      view.parts.map((p) => p.name),
    );
    expect(all("[data-section]").every((b) => (b.textContent ?? "").trim() !== "")).toBe(true);
  });

  test("the Yours swatch is striped in the colours of the parts that are yours, not one part's", async () => {
    await render(<SongGrid view={view} />);
    const tones = songPartTones(view.parts);
    const swatch = one('[data-legend="yours"] span').getAttribute("style") ?? "";
    expect(swatch).toContain("linear-gradient");
    expect(swatch.toLowerCase()).toContain(tones.get("kick")?.toLowerCase());
    expect(swatch.toLowerCase()).toContain(tones.get("snare")?.toLowerCase());
  });

  test("a part that does not sound is drawn faded and struck through", async () => {
    await render(<SongGrid view={view} silent={(p) => p.id !== "kick"} />);
    expect(one('[data-part="kick"]').dataset.silent).toBeUndefined();
    expect(one('[data-part="snare"]').dataset.silent).toBe("1");
    expect(one('[data-cell="snare@verse"]').className).toContain("opacity-35");
    expect(one('[data-part="snare"] [data-testid="song-part-name"]').className).toContain("line-through");
    expect(one('[data-cell="kick@verse"]').className).not.toContain("opacity-35");
  });

  test("a part name is never cut short silently: it wraps, and its title holds the full name", async () => {
    await render(<SongGrid view={view} />);
    const names = all('[data-testid="song-part-name"]');
    expect(names.map((n) => n.getAttribute("title"))).toEqual(view.parts.map((p) => p.name));
    expect(names.every((n) => n.className.includes("line-clamp-2"))).toBe(true);
  });
});
