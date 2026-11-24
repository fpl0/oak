// The same pure SVG scene is used on screen and in the whole-tree snapshot.
import type { SkillState } from "@oak/api";
import { memo, type ReactNode, useId } from "react";
import { REGION_LABEL } from "../../lib/content-model.ts";
import { type ThemeName, TREE_LINES } from "../../ui/theme/palette.ts";
import type { TreeLayout, TreeLeaf } from "./layout.ts";
import { BUD, leafDescription, leafVisual, OAK_LEAF, TREE_PALETTE } from "./visual.ts";

export interface ReleasedTrack {
  id: string;
  capstoneId: string | null;
  title: string;
}
export interface DrawingProps {
  layout: TreeLayout;
  states: ReadonlyMap<string, SkillState>;
  theme: ThemeName;
  releasedTracks?: readonly ReleasedTrack[];
  newlyLearned?: ReadonlySet<string>;
  renderLeaf?: (leaf: TreeLeaf, glyph: ReactNode, description: string) => ReactNode;
  renderAcorn?: (track: ReleasedTrack, glyph: ReactNode, x: number, y: number) => ReactNode;
  /** The limbs' names and lines (Harmony, Line, …); off in a thumbnail, where they would be specks. */
  labels?: boolean;
}

export function LeafDrawing({
  state,
  theme,
  newlyLearned = false,
}: {
  state: SkillState | undefined;
  theme: ThemeName;
  newlyLearned?: boolean;
}) {
  const v = leafVisual(state, theme, newlyLearned);
  const palette = TREE_PALETTE[theme];
  const d = v.bud ? BUD : OAK_LEAF;
  return (
    <g transform={`rotate(${v.droop} 0 16)`} data-leaf={v.status} data-drying={v.drying || undefined}>
      {v.glow && <path d={d} fill="none" stroke={v.stroke} strokeWidth={5} opacity={0.18} />}
      {/* Mastered: an open growth ring around the leaf, parted at the stem, light enough that a crown of mastered
          leaves reads as foliage and not as a sheet of coins. */}
      {v.ring && (
        <path
          d="M-7 17 A 16.5 19.5 0 1 1 7 17"
          fill="none"
          stroke={v.stroke}
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.42}
        />
      )}
      <path
        d={d}
        fill={v.fill}
        fillOpacity={v.opacity}
        stroke={v.stroke}
        strokeWidth={1.2}
        strokeDasharray={v.dash}
      />
      {v.veins > 0 && (
        <path d="M0 13 Q-1 0 0 -12" fill="none" stroke={palette.bg} opacity={0.7} strokeWidth={1} />
      )}
      {v.veins > 1 && (
        <path
          d="M0 6 L-7 1 M0 1 L7 -4 M0 -5 L-5 -9"
          fill="none"
          stroke={palette.bg}
          opacity={0.7}
          strokeWidth={0.9}
        />
      )}
      {v.dryEdge && <path d={d} fill="none" stroke={palette.issue} strokeWidth={1.7} strokeDasharray="2 2" />}
      {v.glint && <path d="M10 -20 v8 M6 -16 h8" fill="none" stroke={palette.accent} strokeWidth={1.5} />}
      {v.paused && (
        <g transform="translate(12 10)" stroke={palette.ink} strokeWidth={1.3} fill={palette.bg}>
          <rect x={-3} y={-6} width={6} height={9} rx={3} />
          <path d="M-5 0 Q-5 6 0 6 Q5 6 5 0 M0 6 v4 M-6 -6 L6 8" fill="none" />
        </g>
      )}
    </g>
  );
}

/** One acorn: the nut, its cup and the cup's scales. */
function AcornGlyph({ theme }: { theme: ThemeName }) {
  const p = TREE_PALETTE[theme];
  return (
    <>
      <path d="M-8 0 Q-9 13 0 16 Q9 13 8 0 Z" fill={p.acorn} stroke={p.wood} />
      <path d="M-10 1 Q-10 -10 0 -8 Q10 -10 10 1 Z" fill={p.wood} />
      <path d="M-6 -3 L-2 0 M-1 -5 L3 -1 M4 -5 L7 -2" fill="none" stroke={p.bg} opacity={0.5} />
    </>
  );
}

const ANATOMY = [
  { x: 335, y: 570, title: "Harmony", detail: "Triads · function · chromatic colour" },
  { x: 1320, y: 570, title: "Line", detail: "Melody & bass" },
  { x: 810, y: 70, title: "Form", detail: "Shape a song" },
  { x: 1430, y: 220, title: "Colour", detail: "Minor · blues · modes" },
  { x: 365, y: 70, title: "Jazz", detail: "Harmony & voicing" },
  { x: 1390, y: 80, title: "Sound", detail: "Arrangement & texture" },
  { x: 570, y: 672, title: "Foundations", detail: "Pitch · scales · intervals" },
  { x: 1290, y: 890, title: "Rhythm", detail: "The roots of the music" },
] as const;

export const TreeDrawing = memo(function TreeDrawing({
  layout,
  states,
  theme,
  releasedTracks = [],
  newlyLearned,
  renderLeaf,
  renderAcorn,
  labels = true,
}: DrawingProps) {
  const p = TREE_PALETTE[theme];
  // The ground fades out at both sides instead of stopping in a hard edge mid-canvas, and runs to the bottom.
  const groundFade = `oak-ground-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return (
    <>
      <defs>
        <linearGradient id={groundFade} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={p.ground} stopOpacity={0} />
          <stop offset="0.14" stopColor={p.ground} stopOpacity={0.65} />
          <stop offset="0.86" stopColor={p.ground} stopOpacity={0.65} />
          <stop offset="1" stopColor={p.ground} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${groundFade}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={p.wood} stopOpacity={0} />
          <stop offset="0.2" stopColor={p.wood} stopOpacity={0.6} />
          <stop offset="0.8" stopColor={p.wood} stopOpacity={0.6} />
          <stop offset="1" stopColor={p.wood} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g aria-hidden pointerEvents="none">
        <path
          d="M0 706 Q70 704 70 704 Q350 687 640 703 Q800 709 957 700 Q1290 689 1530 705 Q1600 706 1600 706 L1600 1000 L0 1000 Z"
          fill={`url(#${groundFade})`}
        />
        <path
          d="M70 704 Q350 687 640 703 M950 701 Q1290 689 1530 705"
          fill="none"
          stroke={`url(#${groundFade}-line)`}
          strokeWidth={TREE_LINES.limbEdge}
        />
        {layout.branches.map((b) => (
          <g key={b.id} data-branch={b.id}>
            <path d={b.d} fill={p.wood} />
            <path
              d={b.grain}
              fill="none"
              stroke={p.grain}
              strokeWidth={b.kind === "trunk" ? 1.5 : 0.8}
              strokeOpacity={0.25}
            />
          </g>
        ))}
        <path
          d="M776 701 Q790 621 774 566 M810 693 Q828 584 803 503 M800 652 Q782 593 801 552 M818 482 Q810 424 806 387"
          stroke={p.grain}
          strokeWidth={1.3}
          strokeOpacity={0.35}
          fill="none"
        />
        <path
          d="M786 625 Q773 612 788 599 Q800 611 786 625 M790 617 Q784 612 790 606"
          stroke={p.grain}
          strokeWidth={1.1}
          strokeOpacity={0.4}
          fill="none"
        />
        {(labels ? ANATOMY : []).map((label) => (
          <g key={label.title} fill={p.ink} textAnchor="middle" className="illustrated-anatomy">
            <text
              x={label.x}
              y={label.y}
              fontFamily="Georgia, serif"
              fontSize={22}
              fontStyle="italic"
              paintOrder="stroke"
              stroke={p.bg}
              strokeWidth={5}
            >
              {label.title}
            </text>
            <text
              className="illustrated-anatomy-detail"
              x={label.x}
              y={label.y + 21}
              fontFamily="system-ui, sans-serif"
              fontSize={12}
              paintOrder="stroke"
              stroke={p.bg}
              strokeWidth={4}
            >
              {label.detail}
            </text>
          </g>
        ))}
      </g>
      {layout.regions.map((region) => (
        <g key={region} data-region={region} aria-label={REGION_LABEL[region]}>
          {layout.nodes
            .filter((n) => n.region === region)
            .map((n) => {
              const state = states.get(n.id);
              const isNew = newlyLearned?.has(n.id) ?? false;
              const description = leafDescription(n.name, state, isNew);
              const glyph = (
                <g transform={`rotate(${n.angle})`}>
                  <LeafDrawing state={state} theme={theme} newlyLearned={isNew} />
                </g>
              );
              return (
                <g key={n.id}>
                  <path
                    d={n.stem}
                    fill="none"
                    stroke={p.wood}
                    strokeWidth={1.2}
                    aria-hidden
                    pointerEvents="none"
                  />
                  {renderLeaf ? (
                    renderLeaf(n, glyph, description)
                  ) : (
                    <g transform={`translate(${n.cx} ${n.cy})`} data-node={n.id} aria-label={description}>
                      <title>{description}</title>
                      {glyph}
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      ))}
      {releasedTracks.map((track) => {
        const at = track.capstoneId
          ? layout.acorns.find((a) => a.capstoneId === track.capstoneId)
          : undefined;
        if (!at) return null;
        const glyph = <AcornGlyph theme={theme} />;
        return (
          <g key={track.id} data-acorn={track.capstoneId}>
            <path d={at.stem} fill="none" stroke={p.wood} strokeWidth={1.5} pointerEvents="none" />
            {renderAcorn ? (
              renderAcorn(track, glyph, at.x, at.y)
            ) : (
              <g transform={`translate(${at.x} ${at.y})`} aria-label={`Released track: ${track.title}`}>
                <title>{track.title}</title>
                {glyph}
              </g>
            )}
          </g>
        );
      })}
      {/* B-sides (promoted sketches, no capstone): fallen acorns at the foot of the tree, in release order. */}
      {releasedTracks
        .filter((t) => !t.capstoneId)
        .slice(0, layout.fallen.length)
        .map((track, i) => {
          const at = layout.fallen[i];
          if (!at) return null;
          const glyph = (
            <g transform={`rotate(${at.angle} 0 6)`}>
              <AcornGlyph theme={theme} />
            </g>
          );
          return (
            <g key={track.id} data-acorn="b-side">
              {renderAcorn ? (
                renderAcorn(track, glyph, at.x, at.y)
              ) : (
                <g transform={`translate(${at.x} ${at.y})`} aria-label={`B-side: ${track.title}`}>
                  <title>{track.title}</title>
                  {glyph}
                </g>
              )}
            </g>
          );
        })}
    </>
  );
});
