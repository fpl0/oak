import { checkSource } from "./bounds.ts";
import { PieceRenderError, type RenderFailure } from "./errors.ts";
import { localUrl, RENDER_TIMEOUT_MS, validateRequest } from "./request.ts";
import type { PiecePcm, RenderedPiece, RenderPieceRequest } from "./types.ts";
import { encodeWav } from "./wav.ts";

export { MAX_LITERAL, MAX_NOTES } from "./bounds.ts";
export { PieceRenderError, type RenderErrorCode } from "./errors.ts";
export type { RenderedPiece, RenderPieceRequest } from "./types.ts";
export { encodeWav } from "./wav.ts";

/** One disposable realm per take: never imports or resets superdough in the caller's live realm. */
export async function renderPiece(request: RenderPieceRequest): Promise<RenderedPiece> {
  const data = validateRequest(request);
  if (request.signal?.aborted) throw new PieceRenderError("aborted", "The export was cancelled.");
  // Read the source here, before a frame exists: a refusal costs no realm, and a piece that could never end
  // never reaches the frame, which shares this page's main thread (bounds.ts).
  // A unit song's length is the song's form: the code itself (the live Make, or none) needs no form of its own.
  checkSource(data.code, false, !data.band?.song);
  const frameUrl = localUrl(request.frameUrl ?? "/offline-render.html", location.href);
  data.soundsRoot = localUrl(data.soundsRoot, location.href);
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.title = "Offline audio export";
    frame.dataset.oakOffline = "";
    let finished = false;
    let started = false;
    let progress = -1;
    const cleanup = () => {
      finished = true;
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", abort);
      window.removeEventListener("message", message);
      // Removing the realm cancels its fetches and timers. The offline graph always has a suspension
      // barrier queued, so it cannot run to the end after the realm that resumes it has gone away.
      frame.remove();
    };
    const fail = (error: PieceRenderError) => {
      if (finished) return;
      cleanup();
      reject(error);
    };
    const report = (value: number) => {
      if (finished || !Number.isFinite(value) || value <= progress) return;
      progress = Math.max(0, Math.min(1, value));
      try {
        request.onProgress?.(progress);
      } catch {
        /* An observer cannot break an export. */
      }
    };
    const abort = () => fail(new PieceRenderError("aborted", "The export was cancelled."));
    const timer = setTimeout(
      () =>
        fail(new PieceRenderError("timeout", "The export took too long. Try again with a shorter piece.")),
      request.timeoutMs ?? RENDER_TIMEOUT_MS,
    );
    const message = (event: MessageEvent) => {
      if (finished || event.origin !== location.origin || event.source !== frame.contentWindow) return;
      const reply = event.data;
      if (reply?.type === "oak-piece-ready" && !started) {
        started = true;
        frame.contentWindow?.postMessage({ type: "oak-piece-render", request: data }, location.origin);
      } else if (reply?.type === "oak-piece-progress") report(reply.progress);
      else if (reply?.type === "oak-piece-failed") {
        const error = reply.error as RenderFailure;
        fail(new PieceRenderError(error.code, error.message, error.missingSounds));
      } else if (reply?.type === "oak-piece-rendered") {
        const pcm = reply.pcm as PiecePcm;
        report(1);
        if (finished) return; // A progress observer may abort.
        cleanup();
        const wav = () => encodeWav([pcm.left, pcm.right], pcm.sampleRate);
        resolve({ ...pcm, wav, wavBlob: () => new Blob([wav()], { type: "audio/wav" }) });
      }
    };
    request.signal?.addEventListener("abort", abort, { once: true });
    window.addEventListener("message", message);
    frame.addEventListener(
      "error",
      () => fail(new PieceRenderError("engine", "The export frame could not load.")),
      { once: true },
    );
    report(0);
    if (finished) return;
    frame.src = frameUrl;
    document.body.append(frame);
  });
}
