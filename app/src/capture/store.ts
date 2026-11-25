// Oak 2.0 W1 (S1): capture anywhere. Whoever wants the capture dialog (the top-bar button, Mod+Shift+K, a starting
// point) asks for it here; `CaptureHost` (mounted once in the shell) renders the dialog for the open request.
import { create } from "zustand";

export type CaptureMode = "hum" | "tap" | "memo";

export interface CaptureRequest {
  /** "scrap": the result lands in scraps. "sketch": it lands in scraps, then a new sketch is made from it. */
  to: "scrap" | "sketch";
  /** The mode the dialog opens on; the learner can switch. */
  mode?: CaptureMode;
}

interface CaptureState {
  request: CaptureRequest | null;
}

const useCaptureStore = create<CaptureState>(() => ({ request: null }));

/** Opens the capture dialog (replacing any open request). */
export function openCapture(req: CaptureRequest): void {
  useCaptureStore.setState({ request: { ...req } });
}

/** Closes the capture dialog. */
export function closeCapture(): void {
  useCaptureStore.setState({ request: null });
}

/** The open capture request, or `null` while the dialog is closed. */
export function useCaptureRequest(): CaptureRequest | null {
  return useCaptureStore((s) => s.request);
}
