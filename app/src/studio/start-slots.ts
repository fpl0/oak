// Oak 2.0 W3: the starts other tasks add to the New sketch dialog (a registry, so no task edits NewSketchDialog for
// another). The dialog lists each slot after "From scraps", before "Your templates"; a selected slot renders its
// Component (with its own Start, a `type="button"`: the dialog is a form) in place of the dialog's Create button.
// Wired in W3 stage B ("With a card"); W4 adds "From a form you mapped" here.
import type { Sketch } from "@oak/api";
import type { ComponentType } from "react";

export interface StartSlotProps {
  sketches: readonly Sketch[];
  sessionId: string | null;
  /** The slot made a sketch: the dialog closes and opens it. */
  onCreated(sketchId: string): void;
}

export interface StartSlot {
  id: string;
  label: string;
  detail: string;
  Component: ComponentType<StartSlotProps>;
}

export const START_SLOTS: readonly StartSlot[] = [];
