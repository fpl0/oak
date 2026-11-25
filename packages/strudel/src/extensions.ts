// Oak's CodeMirror 6 extensions, appended to every mirror with `StateEffect.appendConfig` (spike S2 GOAL 3):
// toolbox-aware completion (only unlocked tools, with their catalog docs), the lint bridge, read-only
// regions, persistent marks, transient flashes (roll and staff → code), cursor and token-click reporting.
// Strudel's own autocompletion stays off (`isAutoCompletionEnabled: false` in the settings), otherwise
// `appendConfig` throws "Config merge conflict for field override" and nothing of this installs.

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { forceLinting, linter } from "@codemirror/lint";
import {
  Annotation,
  type Compartment,
  EditorSelection,
  EditorState,
  type Extension,
  type Range,
  RangeSet,
  StateEffect,
  StateField,
  type Transaction,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { CodeRange, LintDiagnostic, UnlockableId } from "@oak/content-kit";
import { type CompletionKind, completionSiteAt, completionsFor, type Vocabulary } from "./completion.ts";
import { oakEditorTheme } from "./editor-theme.ts";
import { toCmDiagnostics } from "./lint-bridge.ts";
import type { EditorHooks, EditorOptions, LintFloor } from "./types.ts";

export type MarkKind = "hint" | "error" | "target" | "ok";

/** Changes the adapter makes itself (setCode, a hint patch): they pass the read-only filter. */
export const programmatic = Annotation.define<boolean>();

// --- read-only regions ---------------------------------------------------------------------------

/** `all`: everything editable; `none`: nothing; otherwise only these ranges. */
export type EditableState = { kind: "all" } | { kind: "none" } | { kind: "ranges"; ranges: CodeRange[] };

export const setEditableEffect = StateEffect.define<EditableState>();

export function editableOf(readOnly: EditorOptions["readOnly"]): EditableState {
  if (readOnly === undefined) return { kind: "all" };
  if (readOnly === true) return { kind: "none" };
  return { kind: "ranges", ranges: readOnly.editable.map((r) => ({ from: r.from, to: r.to })) };
}

export const editableField = StateField.define<EditableState>({
  create: () => ({ kind: "all" }),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setEditableEffect)) value = e.value;
    if (value.kind !== "ranges" || !tr.docChanged) return value;
    // Insertions at a boundary belong to the region: the start maps left, the end maps right.
    return {
      kind: "ranges",
      ranges: value.ranges.map((r) => ({
        from: tr.changes.mapPos(r.from, -1),
        to: tr.changes.mapPos(r.to, 1),
      })),
    };
  },
});

/** True when every change of `tr` falls inside an editable range. */
export function changeAllowed(state: EditableState, tr: Transaction): boolean {
  if (state.kind === "all") return true;
  if (state.kind === "none") return false;
  let ok = true;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (!state.ranges.some((r) => fromA >= r.from && toA <= r.to)) ok = false;
  });
  return ok;
}

const readOnlyFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.annotation(programmatic)) return tr;
  return changeAllowed(tr.startState.field(editableField), tr) ? tr : [];
});

// --- marks and flashes ---------------------------------------------------------------------------

export const setMarksEffect = StateEffect.define<readonly { range: CodeRange; kind: MarkKind }[]>();
export const addFlashEffect = StateEffect.define<{ id: number; ranges: readonly CodeRange[] }>();
export const removeFlashEffect = StateEffect.define<number>();

function clampedRanges(ranges: readonly CodeRange[], length: number): CodeRange[] {
  return ranges
    .map((r) => ({ from: Math.max(0, Math.min(r.from, length)), to: Math.max(0, Math.min(r.to, length)) }))
    .filter((r) => r.to > r.from);
}

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMarksEffect)) continue;
      const len = tr.state.doc.length;
      const ranges: Range<Decoration>[] = [];
      for (const m of e.value) {
        for (const r of clampedRanges([m.range], len)) {
          ranges.push(Decoration.mark({ class: `oak-mark oak-mark-${m.kind}` }).range(r.from, r.to));
        }
      }
      next = RangeSet.of(ranges, true);
    }
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const flashField = StateField.define<{ id: number; set: DecorationSet }[]>({
  create: () => [],
  update(value, tr) {
    let next = value.map((f) => ({ id: f.id, set: f.set.map(tr.changes) }));
    for (const e of tr.effects) {
      if (e.is(addFlashEffect)) {
        const ranges = clampedRanges(e.value.ranges, tr.state.doc.length).map((r) =>
          Decoration.mark({ class: "oak-flash" }).range(r.from, r.to),
        );
        next = [...next, { id: e.value.id, set: RangeSet.of(ranges, true) }];
      } else if (e.is(removeFlashEffect)) {
        next = next.filter((f) => f.id !== e.value);
      }
    }
    return next;
  },
  provide: (f) => EditorView.decorations.computeN([f], (state) => state.field(f).map((x) => x.set)),
});

const oakTheme = EditorView.baseTheme({
  ".oak-mark-hint": { backgroundColor: "rgba(255, 200, 0, 0.25)" },
  ".oak-mark-error": { textDecoration: "underline wavy rgba(230, 60, 60, 0.9)" },
  ".oak-mark-target": { outline: "1px dashed rgba(120, 160, 255, 0.9)" },
  ".oak-mark-ok": { backgroundColor: "rgba(80, 200, 120, 0.2)" },
  ".oak-flash": { backgroundColor: "rgba(120, 160, 255, 0.35)", transition: "background-color 120ms" },
});

// --- completion ----------------------------------------------------------------------------------

const CM_TYPE: Record<CompletionKind, string> = {
  function: "function",
  sound: "constant",
  bank: "namespace",
  scale: "enum",
};

export interface CompletionDeps {
  vocabulary: () => Vocabulary;
  unlocked: () => ReadonlySet<UnlockableId>;
  hooks?: EditorHooks | undefined;
}

export function oakCompletionSource(deps: CompletionDeps) {
  return (context: CompletionContext): CompletionResult | null => {
    const text = context.state.doc.toString();
    const site = completionSiteAt(text, context.pos);
    const items = completionsFor(deps.vocabulary(), deps.unlocked(), site, context.explicit);
    const options: Completion[] = items.map((item) => ({
      label: item.label,
      type: CM_TYPE[item.kind],
      detail: item.detail,
      info: item.info,
    }));
    const extra =
      deps.hooks?.completions?.(site.prefix, { inString: site.inString, callee: site.callee }) ?? [];
    const seen = new Set(options.map((o) => o.label));
    for (const e of extra) {
      if (seen.has(e.label)) continue;
      // Extra items must be unlocked too (contracts §3.1 rule 3): an item tied to a locked tool is dropped.
      if (e.toolId !== undefined && !deps.unlocked().has(e.toolId)) continue;
      seen.add(e.label);
      const option: Completion = { label: e.label, type: "text" };
      if (e.detail !== undefined) option.detail = e.detail;
      if (e.apply !== undefined) option.apply = e.apply;
      options.push(option);
    }
    if (options.length === 0) return null;
    return { from: site.from, options, validFor: /^[A-Za-z0-9_$:]*$/ };
  };
}

// --- the lint floor (Oak 2.0 W1, jam) -------------------------------------------------------------

/**
 * The diagnostics the editor displays at a lint floor: `"error"` keeps only error-severity findings (jam hides
 * critique); `"info"` keeps everything. Display only: evaluation and its outcome read the full lint.
 */
export function aboveFloor(diagnostics: readonly LintDiagnostic[], floor: LintFloor): LintDiagnostic[] {
  return floor === "error" ? diagnostics.filter((d) => d.severity === "error") : [...diagnostics];
}

// --- the bundle ----------------------------------------------------------------------------------

export interface OakExtensionDeps extends CompletionDeps {
  /** The injected lint, with this editor's context (setUnlocked changes it). */
  lint: (code: string) => readonly LintDiagnostic[];
  /** Diagnostics pushed from outside (evaluation errors, the grader); cleared on the next edit. */
  external: () => readonly LintDiagnostic[];
  clearExternal: () => void;
  /** Oak 2.0 W1: the lowest severity displayed (`setLintFloor`), read on every lint run. Default `"info"`. */
  lintFloor?: () => LintFloor;
  readOnly: Compartment;
  initialReadOnly: EditorOptions["readOnly"];
}

export function oakExtensions(deps: OakExtensionDeps): Extension[] {
  const hooks = deps.hooks;
  return [
    autocompletion({ override: [oakCompletionSource(deps)], activateOnTyping: true, icons: false }),
    linter(
      (view) => {
        const code = view.state.doc.toString();
        let own: readonly LintDiagnostic[] = [];
        try {
          own = deps.lint(code);
        } catch {
          own = [];
        }
        const shown = aboveFloor([...own, ...deps.external()], deps.lintFloor?.() ?? "info");
        return toCmDiagnostics(shown, code.length);
      },
      { delay: 250 },
    ),
    editableField.init(() => editableOf(deps.initialReadOnly)),
    deps.readOnly.of(EditorState.readOnly.of(deps.initialReadOnly === true)),
    readOnlyFilter,
    marksField,
    flashField,
    oakTheme,
    oakEditorTheme(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) deps.clearExternal();
      if (update.selectionSet && hooks?.onCursor) {
        const main = update.state.selection.main;
        hooks.onCursor({ from: main.from, to: main.to });
      }
    }),
    EditorView.domEventHandlers({
      click(event, view) {
        if (!hooks?.onTokenClick) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;
        const word = view.state.wordAt(pos);
        hooks.onTokenClick(word ? { from: word.from, to: word.to } : { from: pos, to: pos });
        return false;
      },
    }),
  ];
}

/** Re-run the linter now (after `setUnlocked` or `setDiagnostics`). */
export function relint(view: EditorView): void {
  forceLinting(view);
}

export function focusRangesIn(view: EditorView, ranges: readonly CodeRange[]): void {
  const valid = clampedRanges(ranges, view.state.doc.length);
  if (valid.length === 0) return;
  view.dispatch({
    selection: EditorSelection.create(valid.map((r) => EditorSelection.range(r.from, r.to))),
    effects: EditorView.scrollIntoView(valid[0]?.from ?? 0, { y: "center" }),
  });
}
