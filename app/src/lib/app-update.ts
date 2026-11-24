// "A new version is out" (server/src/services/app-update.ts): which build this is, and which notices the learner
// has put away. A dismissal holds for that one version; the next release shows the notice again.

const DISMISSED_KEY = "oak.update.dismissed";

/** Running inside the desktop app (Electron names itself in the user agent). */
export function isDesktopApp(): boolean {
  return typeof navigator !== "undefined" && / Electron\//.test(navigator.userAgent);
}

/** The version whose notice the learner dismissed, or `null` (also when storage is unavailable). */
export function dismissedUpdate(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // Not remembered: the notice comes back on the next start.
  }
}
