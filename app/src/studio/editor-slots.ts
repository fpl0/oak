// Oak 2.0 W1: the places in the sketch editor that W1 tools fill (a registry, so no task edits SketchEditor for
// another). Wired in stage B; SketchEditor renders each slot in its place, in this order. W3 widened the props
// (`lastRunCode`, `meter`, `keySpec`, `saveVersion`).
import type { KeySpec, MeterId, SketchDetail, SketchDimension, SketchVersion } from "@oak/api";
import type { EditorHandle } from "@oak/strudel";
import type { ComponentType } from "react";
import { CommitGuard } from "./CommitGuard.tsx";
import { MakeBlankButton } from "./MakeBlankButton.tsx";
import { SoundTools } from "./SoundTools.tsx";

export interface EditorSlotProps {
  sketch: SketchDetail;
  version: SketchVersion;
  /** The editor's code as it is now (may be ahead of `version.code`). */
  liveCode: string;
  /** The code of the last Run that evaluated (Oak 2.0 W3), or `null` before the first. */
  lastRunCode: string | null;
  /** The label of the line the cursor is on (`lineAt`), or `null`. */
  cursorLabel: string | null;
  /** The workbench's meter and key as they are now (W3; the key is `null` when none is chosen). */
  meter: MeterId;
  keySpec: KeySpec | null;
  /** Jam is on: a slot shows no hint, tip or compare (PLAN §2, W1 fidelity rule 2). */
  jam: boolean;
  editor: EditorHandle | null;
  /** Writes code into the editor as one undoable change (the tutor's Apply path). */
  applyCode(code: string): void;
  /**
   * Oak 2.0 W3: saves the live draft as a child of `parentVersion` (a sibling or the next generation), through the
   * editor's own save queue: one version, the editor's saved state updated, so the next Run of the same code saves
   * nothing more. `null` when the save failed (the editor shows the error).
   */
  saveVersion(extra: {
    parentVersion: number;
    generation: number;
    dimension: SketchDimension;
    note: string | null;
  }): Promise<SketchVersion | null>;
}

export type EditorSlotPlace = "header" | "toolbar" | "aside";

export interface EditorSlot {
  id: string;
  place: EditorSlotPlace;
  Component: ComponentType<EditorSlotProps>;
}

export const EDITOR_SLOTS: readonly EditorSlot[] = [
  { id: "make-blank", place: "header", Component: MakeBlankButton },
  { id: "sound-tools", place: "toolbar", Component: SoundTools },
  { id: "commit-guard", place: "aside", Component: CommitGuard },
];
