// Oak 2.0 W1 (S1): "Capture an idea" in the top bar and the focus bar, and `CaptureHost`, mounted once in the shell:
// the Mod+Shift+K shortcut (everywhere, focus mode and text fields included) and the dialog for the open request.
// The dialog (CaptureDialog.tsx, with the hum, tap and memo flows) loads on first use.
import { Lightbulb } from "lucide-react";
import { lazy, Suspense } from "react";
import { IS_MAC, useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { formatKeys } from "../ui/keys/keymap.ts";
import { IconButton } from "../ui/kit/Button.tsx";
import { closeCapture, openCapture, useCaptureRequest } from "./store.ts";

/** The capture shortcut. */
export const CAPTURE_KEYS = "Mod+Shift+K";

const CaptureDialog = lazy(() => import("./CaptureDialog.tsx").then((m) => ({ default: m.CaptureDialog })));

export function CaptureButton() {
  return (
    <IconButton
      label="Capture an idea"
      shortcut={formatKeys(CAPTURE_KEYS, IS_MAC)}
      icon={<Lightbulb aria-hidden className="size-4" />}
      onClick={() => openCapture({ to: "scrap" })}
      data-testid="capture-button"
    />
  );
}

export function CaptureHost() {
  const request = useCaptureRequest();
  useHotkeys([
    {
      id: "capture",
      keys: CAPTURE_KEYS,
      scope: "global",
      group: "Global",
      description: "Capture an idea",
      allowInInput: true,
      run: () => openCapture({ to: "scrap" }),
    },
  ]);
  if (!request) return null;
  return (
    <Suspense fallback={null}>
      <CaptureDialog request={request} onClose={closeCapture} />
    </Suspense>
  );
}
