// Oak 2.0 W3: the starts other tasks add to the New sketch dialog (a registry, so no task edits NewSketchDialog for
// another). The dialog lists each slot after "From scraps", before "Your templates"; a selected slot renders its
// Component (with its own Start, a `type="button"`: the dialog is a form) in place of the dialog's Create button.
// Wired in W3 stage B ("With a card"); W4 stage B added "From a form you mapped" after it.
import type { Sketch } from "@oak/api";
import type { ComponentType } from "react";
import { WithCardStart } from "./cards/WithCardStart.tsx";
import { FormStartOption } from "./FormStart.tsx";

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

export const START_SLOTS: readonly StartSlot[] = [
  {
    id: "with-card",
    label: "With a card",
    detail: "Oak draws a card from your deck; you start a sketch with it.",
    Component: WithCardStart,
  },
  // Oak 2.0 W4 (PLAN F7): the sections of a song the learner mapped, as empty parts to write into.
  FormStartOption,
];
