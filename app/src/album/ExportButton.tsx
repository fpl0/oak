// "Export" on an album track (carry f2; wave7.md §5.5): the released version rendered offline as a WAV download,
// with its progress, a Cancel, and a plain sentence when it fails (nothing is saved then, and no partial file is
// offered). The file is exactly what the version plays (`album.source`: its code, its Band at release, its key, its
// mutes; a released unit song: its frozen release, `songs.snapshot`). The real-time take stays the release
// recording: an export is never stored as a take.
import type { UnitId } from "@oak/api";
import { type RenderPieceRequest, renderPiece } from "@oak/strudel/offline";
import { useQueryClient } from "@tanstack/react-query";
import { FileAudio, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCapstoneContent } from "../capstone/content.ts";
import {
  exportErrorText,
  exportProgressText,
  pieceLength,
  renderableCode,
  renderRequestOf,
  wavFileName,
} from "../capstone/export.ts";
import { formatDuration } from "../lib/format.ts";
import { analyzeCode } from "../lib/grader-client.ts";
import { apiQuery, useCourseProgress } from "../lib/queries.ts";
import { songReleaseRenderRequest } from "../song/surfaces-model.ts";
import { bandReached } from "../studio/model.ts";
import { Button } from "../ui/kit/Button.tsx";

type Phase =
  | { kind: "idle" }
  | { kind: "working"; progress: number }
  | { kind: "done"; text: string }
  | { kind: "failed"; text: string };

/** Hands the browser a file to save (no server round trip; the URL is revoked after the click). */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportButton({
  trackId,
  version,
  capstoneId = null,
  song = false,
}: {
  trackId: string;
  version: number;
  /** The capstone the track was released from: its Band plays only the roles the brief leaves to it. */
  capstoneId?: string | null;
  /** A unit-song release: it has no recording of its own, so the note does not speak of one. */
  song?: boolean;
}) {
  const qc = useQueryClient();
  const content = useCapstoneContent();
  const progress = useCourseProgress();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => {
    ctrl.current?.abort();
    setPhase({ kind: "idle" });
  }, [trackId, version]);

  const run = async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase({ kind: "working", progress: 0 });
    // A Cancel before the render starts (while the source or the piece's length is read) ends the same way.
    const stopIfCancelled = () => {
      if (c.signal.aborted) throw new DOMException("The export was cancelled.", "AbortError");
    };
    try {
      const source = await qc.fetchQuery({
        ...apiQuery("album.source", { params: { id: trackId, v: String(version) } }),
        staleTime: 0,
      });
      stopIfCancelled();
      let request: Pick<RenderPieceRequest, "code" | "band" | "key" | "mutes">;
      if (source.songRelease) {
        // A released unit song plays its frozen release (`songs.snapshot`): every take and Oak's code as released,
        // never the newest take's code alone (contracts §5.11 rule 18).
        const { unitId, releaseId } = source.songRelease;
        const snapshot = await qc.fetchQuery({
          ...apiQuery("songs.snapshot", {
            params: { unitId: unitId as UnitId, releaseId: String(releaseId) },
          }),
          staleTime: 0,
        });
        stopIfCancelled();
        request = songReleaseRenderRequest(snapshot);
      } else {
        // A loop is rendered for its own length (the renderer takes only a piece that says where it ends).
        const bars = await pieceLength(source.code, analyzeCode);
        stopIfCancelled();
        // The Band as it played at release: `album.source` stores its state, the code is built here.
        const bundle = content.data ?? (await content.refetch()).data;
        stopIfCancelled();
        const own = renderRequestOf(source, {
          bands: bundle?.bands ?? [],
          capstone: bundle?.capstones.find((c) => c.id === capstoneId) ?? null,
          reached: bandReached(progress.data),
        });
        request = { ...own, code: renderableCode(source.code, bars) };
      }
      const piece = await renderPiece({
        ...request,
        signal: c.signal,
        onProgress: (p) => {
          if (!c.signal.aborted) setPhase({ kind: "working", progress: p });
        },
      });
      const name = wavFileName(source);
      saveBlob(piece.wavBlob(), name);
      setPhase({ kind: "done", text: `Saved ${name} (${formatDuration(piece.durationS)}).` });
    } catch (e) {
      // Cancelled: said quietly, not as a failure.
      if (c.signal.aborted) setPhase({ kind: "done", text: "The export was cancelled. Nothing was saved." });
      else setPhase({ kind: "failed", text: exportErrorText(e) });
    } finally {
      if (ctrl.current === c) ctrl.current = null;
    }
  };

  return (
    <div className="flex flex-col gap-1.5" data-testid="export">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          icon={<FileAudio aria-hidden className="size-4" />}
          loading={phase.kind === "working"}
          onClick={() => void run()}
          data-testid="export-wav"
        >
          Export WAV
        </Button>
        {phase.kind === "working" && (
          <>
            <div
              role="progressbar"
              aria-label="Export"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(phase.progress * 100)}
              className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2"
              data-testid="export-progress"
            >
              <span
                className="block h-full bg-accent"
                style={{ width: `${Math.round(phase.progress * 100)}%` }}
              />
            </div>
            <span className="text-sm text-text-2 tabular-nums">{exportProgressText(phase.progress)}</span>
            <Button
              size="sm"
              variant="ghost"
              icon={<X aria-hidden className="size-4" />}
              onClick={() => ctrl.current?.abort()}
              data-testid="export-cancel"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
      {phase.kind === "failed" ? (
        <p className="text-sm text-issue" role="alert" data-testid="export-error">
          {phase.text}
        </p>
      ) : phase.kind === "done" ? (
        <p className="text-sm text-text-2" role="status" data-testid="export-done">
          {phase.text}
          {song ? "" : " The release recording stays as it is."}
        </p>
      ) : (
        <p className="text-sm text-text-3">
          {song
            ? "Renders the released song as a WAV file to keep."
            : "Renders this version from its code, as a file to keep. The release recording stays as it is."}
        </p>
      )}
    </div>
  );
}
