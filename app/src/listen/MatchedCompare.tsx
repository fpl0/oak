// Oak 2.0 W4 F5: the one A/B compare every learner-made comparison uses (AC1's two versions, Studio's version compare,
// the F2 nudge). Each side is rendered once offline with its own Band and key, then played at matched loudness: every
// side is turned down to the quietest one, never up (`matchedSideGains`). A switch keeps the place in the tune (the
// bar, not the second: the tempi may differ). Blind (the F2 nudge): the sides are "1" and "2" in `blindOrder(seed)`'s
// order until the caller reveals them. Only what is heard changes: no `.gain()` in the code is read or written.
// Moved from AC1's `CompareAB` (Versions.tsx), its behaviour and test ids unchanged.
import type { KeySpec } from "@oak/content-kit";
import type { BandSetup } from "@oak/strudel";
import { PieceRenderError, type RenderedPiece, renderPiece } from "@oak/strudel/offline";
import { clsx } from "clsx";
import { Headphones, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { exportErrorText, pieceLength, renderableCode } from "../capstone/export.ts";
import { matchedText, samePlaceIn } from "../capstone/tracks.ts";
import { analyzeCode } from "../lib/grader-client.ts";
import { Button } from "../ui/kit/Button.tsx";
import { useWorkbenchServices } from "../workbench/services.tsx";
import { levelDbOf, matchedSideGains, sideLabels } from "./matched.ts";

export interface MatchedSide {
  id: string;
  label: string;
  code: string;
  band: BandSetup | null;
  key: KeySpec | null;
}

/** The two buttons, by place: the first is `compare-a`, the second `compare-b` (AC1's test ids). */
const PLACES = ["a", "b"] as const;

export function MatchedCompare({
  sides,
  blind,
  testId = "matched-compare",
  title = "Compare",
}: {
  /** Two sides. Blind: `sides[0]` is the earlier draft, `sides[1]` the current one. */
  sides: readonly MatchedSide[];
  blind?: { seed: string; revealed: boolean };
  testId?: string;
  title?: string;
}) {
  const { oak } = useWorkbenchServices();
  const [phase, setPhase] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const renders = useRef<{ key: string; pieces: Record<string, RenderedPiece> } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const node = useRef<{
    src: AudioBufferSourceNode;
    gain: GainNode;
    side: string;
    startedAt: number;
    offset: number;
  } | null>(null);

  const shown = sideLabels(sides, {
    blind: blind !== undefined,
    revealed: blind?.revealed ?? false,
    seed: blind?.seed ?? "",
  });
  const bandKey = (s: MatchedSide) =>
    `${s.band?.band ?? ""}|${s.band?.tracks.join(",") ?? ""}|${s.key?.tonic ?? ""}`;
  const key = sides.map((s) => `${s.id}\u0001${s.code}\u0001${bandKey(s)}`).join("\u0000");
  const fresh = renders.current?.key === key;

  const stop = () => {
    const n = node.current;
    node.current = null;
    if (n) {
      n.src.onended = null;
      try {
        n.src.stop();
      } catch {
        /* already stopped */
      }
      n.gain.disconnect();
    }
    setPlaying(null);
  };
  useEffect(
    () => () => {
      abort.current?.abort();
      stop();
    },
    [],
  );
  // The code moved on: the renders no longer speak for it.
  useEffect(() => {
    if (!fresh && phase === "ready") {
      stop();
      setPhase("idle");
    }
  }, [key]);

  const prepare = async (): Promise<boolean> => {
    if (fresh) return true;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase("rendering");
    setError(null);
    setProgress(0);
    try {
      // A loop is rendered for its own length (the renderer takes only a piece that says where it ends).
      const code = async (src: string) => renderableCode(src, await pieceLength(src, analyzeCode));
      const pieces: Record<string, RenderedPiece> = {};
      for (const [i, s] of sides.entries()) {
        pieces[s.id] = await renderPiece({
          code: await code(s.code),
          band: s.band,
          key: s.key,
          signal: ctrl.signal,
          onProgress: (p) => setProgress((i + p) / sides.length),
        });
      }
      renders.current = { key, pieces };
      setPhase("ready");
      return true;
    } catch (e) {
      if (e instanceof PieceRenderError && e.code === "aborted") {
        setPhase("idle");
        return false;
      }
      setError(exportErrorText(e));
      setPhase("error");
      return false;
    }
  };

  const gainsOf = (pieces: Record<string, RenderedPiece>): Record<string, number> => {
    const g = matchedSideGains(sides.map((s) => levelDbOf(pieces[s.id] as RenderedPiece)));
    return Object.fromEntries(sides.map((s, i) => [s.id, g[i] ?? 1]));
  };

  const play = async (side: string) => {
    if (playing === side) return stop();
    if (!(await prepare())) return;
    const r = renders.current;
    if (!r) return;
    await oak.unlock();
    const ctx = oak.ctx as AudioContext;
    const was = node.current;
    const piece = r.pieces[side] as RenderedPiece;
    // The same bar of the tune in the other render (the tempi may differ).
    const at = was
      ? samePlaceIn(
          was.offset + (ctx.currentTime - was.startedAt),
          (r.pieces[was.side] as RenderedPiece).cps,
          piece.cps,
          piece.durationS,
        )
      : 0;
    stop();
    const buffer = ctx.createBuffer(2, piece.left.length, piece.sampleRate);
    buffer.copyToChannel(piece.left as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(piece.right as Float32Array<ArrayBuffer>, 1);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainsOf(r.pieces)[side] ?? 1;
    src.connect(gain).connect(ctx.destination);
    src.onended = () => {
      if (node.current?.src === src) {
        node.current = null;
        setPlaying(null);
      }
    };
    src.start(0, at);
    node.current = { src, gain, side, startedAt: ctx.currentTime, offset: at };
    setPlaying(side);
  };

  const buttonText = (i: number, s: { shown: string }) =>
    blind
      ? blind.revealed
        ? `${i + 1}: ${s.shown}`
        : s.shown
      : `${(PLACES[i] ?? "").toUpperCase()}: ${s.shown}`;
  const r = renders.current;
  const note = (() => {
    if (phase === "error") return error;
    if (fresh && r && shown.length === 2) {
      const g = gainsOf(r.pieces);
      const [x, y] = shown as [{ id: string; shown: string }, { id: string; shown: string }];
      const gx = g[x.id] ?? 1;
      const gy = g[y.id] ?? 1;
      const louder = gx < 1 ? "a" : gy < 1 ? "b" : null;
      const db = louder === null ? 0 : -20 * Math.log10(louder === "a" ? gx : gy);
      return `${matchedText({ a: gx, b: gy, db, louder }, { a: x.shown, b: y.shown })} A switch keeps your place in the tune.`;
    }
    return blind
      ? "Both drafts are rendered once, then 1 and 2 play at the same loudness; a switch keeps your place in the tune."
      : "Each version is rendered once, then A and B play at the same loudness; a switch keeps your place in the tune.";
  })();

  return (
    <div
      className="flex flex-col gap-1.5"
      data-testid={testId}
      data-blind={blind ? (blind.revealed ? "revealed" : "on") : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Headphones aria-hidden className="size-4 text-text-3" />
        <span className="font-medium">{title}</span>
        {shown.map((s, i) => (
          <Button
            key={s.id}
            size="sm"
            variant={playing === s.id ? "primary" : "secondary"}
            aria-pressed={playing === s.id}
            loading={phase === "rendering" && playing === null}
            onClick={() => void play(s.id)}
            data-testid={`compare-${PLACES[i]}`}
          >
            {buttonText(i, s)}
          </Button>
        ))}
        {playing && (
          <Button size="sm" variant="ghost" icon={<Square aria-hidden className="size-3.5" />} onClick={stop}>
            Stop
          </Button>
        )}
        {phase === "rendering" && (
          <span
            className="flex items-center gap-2 text-text-3 tabular-nums"
            role="status"
            data-testid="compare-progress"
          >
            Rendering both, {Math.round(progress * 100)}%
            <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          </span>
        )}
      </div>
      <p
        className={clsx("text-text-2", phase === "error" && "text-issue")}
        data-testid="compare-note"
        role={phase === "error" ? "alert" : undefined}
      >
        {note}
      </p>
    </div>
  );
}
