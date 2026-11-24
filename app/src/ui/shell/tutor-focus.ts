// Where focus goes back to when the docked tutor panel closes (ux §15, shared rule: an action that removes the
// focused control moves focus to the next sensible control). Closing the panel with Mod+J or its Hide button while
// focus is inside it unmounts the focused control; the browser then drops focus to <body> and a keyboard learner
// loses their place. So the shell remembers the last control outside the panel that focus came from, and gives it
// the focus back on close, or the page's main region when that control is gone.

const PANEL = "[data-tutor-panel]";

let cameFrom: HTMLElement | null = null;
let installed = false;

/** Starts remembering where focus enters the panel from. Idempotent. */
export function installTutorFocusMemory(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("focusin", (e) => {
    const to = e.target instanceof Element ? e.target : null;
    const from = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
    if (to?.closest(PANEL) && from && !from.closest(PANEL)) cameFrom = from;
  });
}

/** Whether focus is inside the tutor panel now. */
export function focusInTutor(): boolean {
  return document.activeElement?.closest(PANEL) != null;
}

/**
 * After the panel closed: focus where the learner came from, else `#main`. Run once the panel has unmounted (the
 * next frame), and only when focus was inside it, so closing from the top bar leaves focus on that button.
 */
export function returnFocusFromTutor(): void {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    // Something else took the focus meanwhile (a dialog, a click): leave it there.
    if (active && active !== document.body && !active.closest(PANEL)) return;
    const back = cameFrom?.isConnected ? cameFrom : document.getElementById("main");
    cameFrom = null;
    back?.focus({ preventScroll: true });
  });
}
