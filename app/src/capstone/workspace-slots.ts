// Oak 2.0 W4: the places in the capstone workspace that W4 tools fill (a registry, the same pattern as Studio's
// `editor-slots.ts`, so no task edits Workspace.tsx for another). `Workspace.tsx` renders every slot of place `main`
// after the MasterCard and before the Workbench, in this order, and none while an imported version is under review;
// AC1's two-version workspace and X1's workspace render none. Filled in W4 stage B (PLAN S7, F2, F7, F6, F3).
import type { CapstoneDef, CapstoneState, KeySpec } from "@oak/api";
import type { BandSetup, EditorHandle } from "@oak/strudel";
import type { ComponentType } from "react";
import { BetterOrDifferent } from "./BetterOrDifferent.tsx";
import { CommitAfterSession } from "./CommitAfterSession.tsx";
import { ErasePassCard } from "./ErasePassCard.tsx";
import { FinishAnywayCard } from "./FinishAnywayCard.tsx";
import { FormStartCard } from "./FormStartCard.tsx";

export interface CapstoneSlotProps {
  def: CapstoneDef;
  state: CapstoneState;
  /** The draft sketch, once a save made it. */
  sketchId: string | null;
  /** The editor's code now. */
  liveCode: string;
  /** The code the current session opens with: `starterOf(def, nextIndex)`, or the version's starter. */
  starter: string;
  /** The draft's latest saved version, or `null` before the first save. */
  savedVersion: number | null;
  released: boolean;
  /** The session the workspace is on (0-based). */
  sessionIndex: number;
  sessionsDone: number;
  totalSessions: number;
  band: BandSetup | null;
  keySpec: KeySpec | null;
  /** Bars of the piece as the live check read it, or `null` before the first check. */
  bars: number | null;
  /** The capstone's editor, read at call time (`null` when it is not mounted). */
  editor(): EditorHandle | null;
  /** Writes code into the editor as one undoable change (the session cards' "add lines" path). */
  applyCode(code: string): void;
}

export type CapstoneSlotPlace = "main";

export interface CapstoneSlot {
  id: string;
  place: CapstoneSlotPlace;
  Component: ComponentType<CapstoneSlotProps>;
}

export const CAPSTONE_SLOTS: readonly CapstoneSlot[] = [
  { id: "commit-after-session", place: "main", Component: CommitAfterSession },
  { id: "better-or-different", place: "main", Component: BetterOrDifferent },
  { id: "form-start", place: "main", Component: FormStartCard },
  { id: "finish-anyway", place: "main", Component: FinishAnywayCard },
  { id: "erase-pass", place: "main", Component: ErasePassCard },
];
