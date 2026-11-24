// "Tree Rings" album covers (ux §0 item 6, §5.3): a cover grown from the music itself. Pure and deterministic:
// the same events, metadata and seed give a byte-identical SVG (ux §10 item 9, snapshot-tested).
//
// Canvas 1000×1000, centre (500, 500). The pith carries the key (or the tempo of a drum piece) in the degree-1
// colour. Every bar is one growth ring from the pith outwards, inner rings first: an earlywood band tinted by
// the bar's harmonic function, closed by a latewood line with a seeded woodgrain wobble (≤ 1.5 px). Pitched
// notes are arcs inside their ring: the angle is the onset in the bar (12 o'clock = beat 1), the sweep the
// duration, the radius the pitch within the piece's range, the colour the scale degree, the width the gain.
// Drums are ticks on the ring line: kick outwards, snare inwards, hats as dots. The wood is the flavour's.
import type { FlavourId, KeySpec, NEvent } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import { degreeOf } from "@oak/theory";
import {
  type BaseDegree,
  DEGREE_COLOURS,
  NEUTRAL,
  parseDegree,
  type ThemeName,
} from "../ui/theme/palette.ts";

export const COVER_SIZE = 1000;
const C = COVER_SIZE / 2;
export const PITH_R = 58;
export const OUTER_R = 432;
/** Rings never get thinner than this; longer pieces fold their later bars onto the outer rings. */
const MIN_RING = 2.5;

export interface CoverInput {
  /** Learner events of the first pass, or `null` when the piece has not been analysed (seed-only cover). */
  events: readonly NEvent[] | null;
  bars: number;
  key: KeySpec | null;
  bpm: number | null;
  flavour: FlavourId | null;
  title: string;
  albumTitle: string;
  /** Track ID (or any stable string): the woodgrain. */
  seed: string;
  /** Harmony slots from the analysis (`AnalysisSummary.slots`): the ring tint of each bar. */
  slots?: readonly { bar: number; rn: string }[];
}

export interface Wood {
  theme: ThemeName;
  bg: string;
  early: string;
  line: string;
  ink: string;
}

/** The flavour's wood. Light woods use the Paper degree colours, dark woods the Bark ones. */
export const WOODS: Record<FlavourId | "default", Wood> = {
  default: { theme: "paper", bg: "#EFE5D3", early: "#E3D3B6", line: "#8C6A4F", ink: "#2A1F16" },
  "flavour.pop": { theme: "paper", bg: "#EFE5D3", early: "#E3D3B6", line: "#8C6A4F", ink: "#2A1F16" },
  "flavour.jazz-soul": { theme: "bark", bg: "#2A201A", early: "#3A2C22", line: "#C79F78", ink: "#F2E6D4" },
  "flavour.indie": { theme: "paper", bg: "#E5E4D7", early: "#D5D6C3", line: "#66744F", ink: "#23251E" },
  "flavour.funk": { theme: "bark", bg: "#2B1A21", early: "#3B2430", line: "#D58C6C", ink: "#F6E6DD" },
  // Smoked oak: a near-black, cool-grained wood with a pale steel-blue line.
  "flavour.electronic": { theme: "bark", bg: "#1C2024", early: "#272D33", line: "#8FB4C4", ink: "#E8EEF2" },
};

export type Prim =
  | {
      t: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string;
      sw?: number;
      op?: number;
    }
  | {
      t: "path";
      d: string;
      stroke: string;
      sw: number;
      op?: number;
      fill?: string;
      cap?: "round";
      /** What the mark stands for (model only; not written to the SVG). */
      role?: "note" | "kick" | "snare" | "hat" | "crash" | "latewood";
    }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; op?: number }
  | {
      t: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      anchor?: "start" | "middle" | "end";
      family: "display" | "sans";
      weight?: number;
      spacing?: number;
      op?: number;
      /** A halo in the wood's colour behind the letters, so a ring line passing under them never crosses them. */
      halo?: { color: string; width: number };
    };

export interface CoverGroup {
  /** `ring` groups carry their bar index (the release ceremony draws them in order). */
  kind: "ground" | "ring" | "pith" | "text";
  index?: number;
  items: Prim[];
}

export interface CoverModel {
  wood: Wood;
  groups: CoverGroup[];
  /** Accessible description: "4 rings, C major, 100 BPM". */
  summary: string;
}

// --- deterministic noise ------------------------------------------------------------------------------

/** FNV-1a, then mulberry32: a small, stable PRNG from a string. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (x: number): string => {
  const v = Math.round(x * 10) / 10;
  return Object.is(v, -0) ? "0" : String(v);
};

type Pt = readonly [number, number];

/** A closed, wobbling ring around `c`: integer harmonics keep it closed; the displacement stays ≤ `amp`. */
function grainRing(c: Pt, r: number, amp: number, rnd: () => number): string {
  const harmonics = [2 + Math.floor(rnd() * 3), 5 + Math.floor(rnd() * 4), 11 + Math.floor(rnd() * 6)];
  const phases = harmonics.map(() => rnd() * Math.PI * 2);
  const weights = [0.55, 0.3, 0.15];
  const steps = Math.max(36, Math.min(120, Math.round(r / 4)));
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    let n = 0;
    for (let k = 0; k < 3; k++)
      n += (weights[k] as number) * Math.sin((harmonics[k] as number) * th + (phases[k] as number));
    const rr = r + amp * n;
    d += `${i === 0 ? "M" : "L"}${f(c[0] + rr * Math.cos(th))} ${f(c[1] + rr * Math.sin(th))}`;
  }
  return `${d}Z`;
}

function polar(c: Pt, r: number, th: number): [number, number] {
  return [c[0] + r * Math.cos(th), c[1] + r * Math.sin(th)];
}

function arc(c: Pt, r: number, th0: number, sweep: number): string {
  const [x0, y0] = polar(c, r, th0);
  const [x1, y1] = polar(c, r, th0 + sweep);
  const large = sweep > Math.PI ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${large} 1 ${f(x1)} ${f(y1)}`;
}

/** A thin triangle standing on the ring line at angle `th`, pointing outwards (`len` > 0) or inwards. */
function thorn(c: Pt, r: number, th: number, len: number, halfWidth: number): string {
  const d = halfWidth / Math.max(1, r);
  const [ax, ay] = polar(c, r, th - d);
  const [bx, by] = polar(c, r, th + d);
  const [tx, ty] = polar(c, r + len, th);
  return `M${f(ax)} ${f(ay)}L${f(tx)} ${f(ty)}L${f(bx)} ${f(by)}Z`;
}

// --- music → colour ---------------------------------------------------------------------------------

function degreeColour(midi: number, key: KeySpec | null, theme: ThemeName): string {
  if (!key) return NEUTRAL[theme].fill;
  const parsed = parseDegree(degreeOf(midi, key).degree);
  return parsed ? DEGREE_COLOURS[theme][parsed.base].fill : NEUTRAL[theme].fill;
}

/** Tonic, predominant or dominant from a Roman numeral ("V7/vi" reads as its secondary dominant: D). */
export function functionDegree(rn: string): BaseDegree | null {
  const m = /^[b#♭♯]?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)/.exec(rn);
  if (!m) return null;
  if (rn.includes("/")) return 5;
  const base = (m[1] as string).toUpperCase();
  if (base === "I" || base === "VI" || base === "III") return 1;
  if (base === "IV" || base === "II") return 4;
  return 5;
}

// --- the model ------------------------------------------------------------------------------------

/** How far the outermost ring's centre drifts from the pith: trees grow a little off-centre. */
const DRIFT = 14;

/** The title's line: from x 52 to 948 along the bottom edge (a halo keeps the rings' lowest line off its letters). */
export const TITLE_WIDTH = 896;
/**
 * The album name's line: right-aligned at x 948 along the top edge. Past x ≈ 620 it crosses the top of the outer
 * ring (drifted up by DRIFT), where its halo keeps the ring line off the letters; it never reaches the left half.
 */
export const ALBUM_WIDTH = 560;

/**
 * Advance widths in em, rounded up from Fraunces 600 (display) and Inter (sans) so an estimate is never short:
 * the cover is a static SVG (exported, snapshot-tested) and cannot measure its own text.
 */
function advanceEm(ch: string, family: "display" | "sans"): number {
  const wide = family === "display" ? 1.12 : 1.04;
  if (/[MWmw@%&]/.test(ch)) return wide;
  if (/[ .,:;'!|ilIjtf()[\]"’‘]/.test(ch)) return 0.34;
  if (/[A-Z]/.test(ch)) return family === "display" ? 0.78 : 0.74;
  if (/[a-z0-9]/.test(ch)) return 0.62;
  // Accented Latin letters and common punctuation are about a letter wide; anything else (CJK, emoji) a full em.
  return /[\p{Script=Latin}\p{P}\p{S}]/u.test(ch) ? 0.8 : 1.05;
}

/** The estimated drawn width of `text` (letter spacing after every character, as SVG does). */
export function coverTextWidth(text: string, family: "display" | "sans", size: number, spacing = 0): number {
  let w = 0;
  for (const ch of text) w += advanceEm(ch, family) * size + spacing;
  return w;
}

/**
 * Fits a line of cover text into `width`: the given size if it fits, else the largest size down to `minSize` that
 * does, else `minSize` with the text cut at a word (or a character) and an ellipsis. Never splits a surrogate pair.
 */
export function fitCoverText(
  text: string,
  o: { family: "display" | "sans"; size: number; minSize: number; width: number; spacingEm?: number },
): { text: string; size: number; spacing: number } {
  const sp = (size: number) => (o.spacingEm ?? 0) * size;
  const fits = (t: string, size: number) => coverTextWidth(t, o.family, size, sp(size)) <= o.width;
  for (let size = o.size; size >= o.minSize; size--)
    if (fits(text, size)) return { text, size, spacing: sp(size) };
  const size = o.minSize;
  const chars = [...text];
  let n = chars.length;
  while (n > 0 && !fits(`${chars.slice(0, n).join("").trimEnd()}…`, size)) n--;
  let cut = chars.slice(0, n).join("");
  // Prefer a word boundary when one is near (within the last third of what fits).
  const space = cut.lastIndexOf(" ");
  if (space > (cut.length * 2) / 3) cut = cut.slice(0, space);
  return { text: `${cut.trimEnd()}…`, size, spacing: sp(size) };
}

export function coverModel(input: CoverInput): CoverModel {
  const wood = WOODS[input.flavour ?? "default"] ?? WOODS.default;
  const rnd = seededRandom(`${input.seed}|rings`);
  const bars = Math.max(1, Math.round(input.bars));
  const shown = Math.max(1, Math.min(bars, Math.floor((OUTER_R - PITH_R) / MIN_RING)));
  const w = (OUTER_R - PITH_R) / shown;
  const ringOf = (bar: number) => Math.min(shown - 1, bar);
  const drift = rnd() * Math.PI * 2;
  const centre = (i: number): Pt => {
    const k = ((i + 1) / shown) * DRIFT;
    return [C + k * Math.cos(drift), C + k * Math.sin(drift)];
  };
  const groups: CoverGroup[] = [];

  // Ground: the cut face of the trunk, plus one medullary ray.
  const outer = centre(shown - 1);
  const ground: Prim[] = [{ t: "circle", cx: outer[0], cy: outer[1], r: OUTER_R, fill: wood.early, op: 0.5 }];
  const rayAngle = rnd() * Math.PI * 2;
  const [rx0, ry0] = polar([C, C], PITH_R + 4, rayAngle);
  const [rx1, ry1] = polar(outer, OUTER_R - 6, rayAngle);
  ground.push({ t: "line", x1: rx0, y1: ry0, x2: rx1, y2: ry1, stroke: wood.line, sw: 1.4, op: 0.2 });
  groups.push({ kind: "ground", items: ground });

  const events = input.events ?? [];
  const pitched = events.filter((e) => e.midi !== null && !e.drum);
  const lo = pitched.reduce((m, e) => Math.min(m, e.midi as number), 127);
  const hi = pitched.reduce((m, e) => Math.max(m, e.midi as number), 0);
  const tint = new Map<number, BaseDegree>();
  for (const s of input.slots ?? []) {
    const deg = functionDegree(s.rn);
    if (deg !== null && !tint.has(s.bar - 1)) tint.set(s.bar - 1, deg);
  }

  const byRing = new Map<number, NEvent[]>();
  for (const e of events) {
    const b = R.floor(e.onset);
    if (b < 0 || b >= bars) continue;
    const ring = ringOf(b);
    const list = byRing.get(ring);
    if (list) list.push(e);
    else byRing.set(ring, [e]);
  }
  // A busier bar lays down a darker, thicker latewood line.
  const busiest = Math.max(1, ...[...byRing.values()].map((l) => l.length));

  for (let i = 0; i < shown; i++) {
    const c = centre(i);
    const r0 = PITH_R + i * w;
    const r1 = r0 + w;
    const mid = (r0 + r1) / 2;
    const items: Prim[] = [];
    items.push({
      t: "circle",
      cx: c[0],
      cy: c[1],
      r: mid,
      stroke: wood.early,
      sw: w,
      op: i % 2 === 0 ? 0.95 : 0.5,
    });
    const deg = tint.get(i);
    if (deg !== undefined)
      items.push({
        t: "circle",
        cx: c[0],
        cy: c[1],
        r: mid,
        stroke: DEGREE_COLOURS[wood.theme][deg].fill,
        sw: w,
        op: 0.12,
      });
    // Fine grain inside a wide ring: faint lines, as in a real cut.
    for (let g = 0; g < Math.floor(w / 14); g++) {
      const r = r0 + 5 + rnd() * Math.max(1, w - 12);
      items.push({
        t: "path",
        d: grainRing(c, r, 1.2, rnd),
        stroke: wood.line,
        sw: 0.7,
        op: 0.16 + rnd() * 0.12,
      });
    }
    const list = byRing.get(i) ?? [];
    const tick = Math.min(18, 5 + w * 0.3);
    for (const e of list) {
      const th = 2 * Math.PI * R.toNum(R.frac(e.onset)) - Math.PI / 2;
      if (e.midi !== null && !e.drum) {
        const norm = hi > lo ? ((e.midi as number) - lo) / (hi - lo) : 0.5;
        const rp = r0 + w * (0.22 + 0.56 * norm);
        // A little air between notes, the way a phrase breathes; a tiny note is still a dot.
        const sweep = Math.max(0.03, Math.min(2 * Math.PI * R.toNum(e.dur) * 0.88, 2 * Math.PI * 0.94));
        const sw = Math.max(1.2, Math.min(2.5 + 4 * Math.min(1, e.gain), w * 0.5));
        items.push({
          t: "path",
          d: arc(c, rp, th, sweep),
          stroke: degreeColour(e.midi as number, input.key, wood.theme),
          sw,
          op: 0.94,
          cap: "round",
          role: "note",
        });
        continue;
      }
      const loud = 0.55 + 0.45 * Math.min(1, e.gain);
      switch (e.drum) {
        case "kick":
          items.push({
            t: "path",
            d: thorn(c, r1, th, tick, 4.5),
            stroke: wood.ink,
            sw: 0.6,
            fill: wood.ink,
            op: 0.85 * loud,
            role: "kick",
          });
          break;
        case "snare":
        case "clap":
        case "rim":
          items.push({
            t: "path",
            d: thorn(c, r1, th, -tick * 0.85, 3.5),
            stroke: wood.ink,
            sw: 0.6,
            fill: wood.ink,
            op: 0.75 * loud,
            role: "snare",
          });
          break;
        case "hatClosed":
        case "hatOpen":
        case "ride":
        case "shaker": {
          const r = r1 - Math.min(6, w * 0.22);
          const len = (e.drum === "hatOpen" ? 16 : 7) / Math.max(1, r);
          items.push({
            t: "path",
            d: arc(c, r, th - len / 2, len),
            stroke: wood.ink,
            sw: 2.6,
            op: 0.55 * loud,
            cap: "round",
            role: "hat",
          });
          break;
        }
        case "crash": {
          const len = 44 / Math.max(1, mid);
          items.push({
            t: "path",
            d: arc(c, mid, th, len),
            stroke: wood.line,
            sw: 2,
            op: 0.7,
            cap: "round",
            role: "crash",
          });
          break;
        }
        default: {
          const [x, y] = polar(c, mid, th);
          items.push({
            t: "circle",
            cx: x,
            cy: y,
            r: Math.min(5.5, w * 0.22 + 2),
            fill: wood.ink,
            op: 0.6 * loud,
          });
        }
      }
    }
    const density = list.length / busiest;
    items.push({
      t: "path",
      d: grainRing(c, r1, Math.min(1.5, w * 0.3), rnd),
      stroke: wood.line,
      sw: (w > 10 ? 1.4 : 0.9) + 1.6 * density,
      op: 0.55 + 0.35 * density,
      role: "latewood",
    });
    groups.push({ kind: "ring", index: i, items });
  }

  // Bark.
  groups.push({
    kind: "ground",
    items: [{ t: "path", d: grainRing(outer, OUTER_R + 7, 1.5, rnd), stroke: wood.line, sw: 10, op: 0.92 }],
  });

  // Pith: degree 1 of the key, labelled with the key (or the tempo of a piece without pitches).
  const one = DEGREE_COLOURS[wood.theme][1];
  const label = pithLabel(input.key, pitched.length > 0, input.bpm);
  // A cover grown from its seed alone (no music: the code did not run) has a plain pith, not "— BPM"; so does a
  // piece that ran but plays nothing (an empty sketch read Strudel's default "120 BPM", review:studio).
  const silent = input.events !== null && input.events.length === 0;
  const plainPith = (input.events === null && !input.bpm && !input.key) || silent;
  groups.push({
    kind: "pith",
    items: [
      { t: "circle", cx: C, cy: C, r: PITH_R, fill: one.fill },
      ...((plainPith
        ? []
        : [
            {
              t: "text",
              x: C,
              y: C + 6,
              text: label.big,
              size: label.big.length > 2 ? 30 : 40,
              fill: one.label,
              anchor: "middle",
              family: "display",
              weight: 600,
            },
            {
              t: "text",
              x: C,
              y: C + 30,
              text: label.small,
              size: 14,
              fill: one.label,
              anchor: "middle",
              family: "sans",
              spacing: 1.5,
              op: 0.85,
            },
          ]) as Prim[]),
    ],
  });

  // Title (bottom left) and album name (top right), in the free corners. Each is fitted to its corner: smaller
  // type first, then cut with an ellipsis (the full title is in the cover's accessible name), so a long name never
  // runs off the cover or into the rings.
  const rawTitle = input.title.trim() || "Untitled";
  const titleFit = fitCoverText(rawTitle, {
    family: "display",
    size: Math.max(26, Math.min(46, Math.floor(620 / Math.max(8, rawTitle.length)))),
    minSize: 24,
    width: TITLE_WIDTH,
  });
  const albumFit = fitCoverText(input.albumTitle.toUpperCase(), {
    family: "sans",
    size: 18,
    minSize: 13,
    width: ALBUM_WIDTH,
    spacingEm: 1 / 6,
  });
  groups.push({
    kind: "text",
    items: [
      {
        t: "text",
        x: 52,
        y: 952,
        text: titleFit.text,
        size: titleFit.size,
        fill: wood.ink,
        family: "display",
        weight: 600,
        halo: { color: wood.bg, width: 8 },
      },
      {
        t: "text",
        x: 948,
        y: 66,
        text: albumFit.text,
        size: albumFit.size,
        fill: wood.ink,
        anchor: "end",
        family: "sans",
        spacing: albumFit.spacing,
        op: 0.7,
        halo: { color: wood.bg, width: 6 },
      },
    ],
  });

  const keyText = input.key && pitched.length > 0 ? `${input.key.tonic} ${input.key.mode}` : null;
  const summary = [
    `${bars} ${bars === 1 ? "ring" : "rings"}, one per bar`,
    keyText,
    input.bpm && !silent ? `${Math.round(input.bpm)} BPM` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return { wood, groups, summary };
}

function pithLabel(
  key: KeySpec | null,
  pitched: boolean,
  bpm: number | null,
): { big: string; small: string } {
  if (key && pitched) {
    const tonic = key.tonic.replace(/b$/, "♭").replace(/#$/, "♯");
    return { big: tonic, small: key.mode.toUpperCase() };
  }
  return { big: bpm ? String(Math.round(bpm)) : "—", small: "BPM" };
}

// --- SVG text -------------------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const COVER_FONTS = {
  display: "'Fraunces Variable', 'Iowan Old Style', Georgia, serif",
  sans: "'Inter Variable', system-ui, sans-serif",
} as const;

function primSvg(p: Prim): string {
  const op = p.op === undefined ? "" : ` opacity="${f(p.op)}"`;
  switch (p.t) {
    case "circle":
      return `<circle cx="${f(p.cx)}" cy="${f(p.cy)}" r="${f(p.r)}" fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${f(p.sw ?? 1)}"` : ""}${op}/>`;
    case "path":
      return `<path d="${p.d}" fill="${p.fill ?? "none"}" stroke="${p.stroke}" stroke-width="${f(p.sw)}"${p.cap ? ` stroke-linecap="${p.cap}"` : ""}${op}/>`;
    case "line":
      return `<line x1="${f(p.x1)}" y1="${f(p.y1)}" x2="${f(p.x2)}" y2="${f(p.y2)}" stroke="${p.stroke}" stroke-width="${f(p.sw)}" stroke-linecap="round"${op}/>`;
    case "text":
      return `<text x="${f(p.x)}" y="${f(p.y)}" font-family="${esc(COVER_FONTS[p.family])}" font-size="${f(p.size)}" fill="${p.fill}"${p.anchor && p.anchor !== "start" ? ` text-anchor="${p.anchor}"` : ""}${p.weight ? ` font-weight="${p.weight}"` : ""}${p.spacing ? ` letter-spacing="${f(p.spacing)}"` : ""}${p.halo ? ` stroke="${p.halo.color}" stroke-width="${f(p.halo.width)}" stroke-linejoin="round" paint-order="stroke"` : ""}${op}>${esc(p.text)}</text>`;
  }
}

/** The whole cover as a standalone SVG document (export, snapshot). */
export function coverSvg(model: CoverModel, title: string): string {
  const body = model.groups
    .map(
      (g) =>
        `<g class="cover-${g.kind}"${g.index === undefined ? "" : ` data-ring="${g.index}"`}>${g.items.map(primSvg).join("")}</g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COVER_SIZE} ${COVER_SIZE}" role="img" aria-label="${esc(`Cover of ${title}: ${model.summary}`)}"><rect width="${COVER_SIZE}" height="${COVER_SIZE}" fill="${model.wood.bg}"/>${body}</svg>`;
}
