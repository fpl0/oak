// The NavRail's destinations (ux §2.1, contracts §11.9 naming) and their `G`-then-letter shortcuts (ux §7.10).
import { useEffect } from "react";
import { useShell } from "./shell-store.ts";

export type NavId =
  | "today"
  | "oak"
  | "practice"
  | "studio"
  | "transcribe"
  | "album"
  | "toolbox"
  | "progress"
  | "settings";

export interface NavItem {
  id: NavId;
  label: string;
  to: string;
  /** Second key after `G`. */
  gKey: string;
  /** Path prefixes that light this item up. */
  match: (path: string) => boolean;
}

const under = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`);

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "today", label: "Today", to: "/", gKey: "T", match: (p) => p === "/" },
  { id: "oak", label: "The Oak", to: "/oak", gKey: "O", match: under("/oak") },
  { id: "practice", label: "Practice", to: "/practice", gKey: "P", match: under("/practice") },
  { id: "studio", label: "Studio", to: "/studio", gKey: "S", match: under("/studio") },
  { id: "transcribe", label: "Transcribe", to: "/transcribe", gKey: "R", match: under("/transcribe") },
  // A unit song's page (`/song/$unitId`) lives with the album: its Songs shelf links there.
  {
    id: "album",
    label: "Album",
    to: "/album",
    gKey: "A",
    match: (p) => under("/album")(p) || under("/song")(p),
  },
  { id: "toolbox", label: "Toolbox", to: "/toolbox", gKey: "B", match: under("/toolbox") },
  { id: "progress", label: "Progress", to: "/progress", gKey: "C", match: under("/progress") },
  { id: "settings", label: "Settings", to: "/settings/audio", gKey: ",", match: under("/settings") },
];

export const SETTINGS_SECTIONS = [
  { id: "audio", label: "Audio" },
  { id: "voice", label: "Voice" },
  { id: "tutor", label: "Tutor" },
  { id: "learning", label: "Learning" },
  { id: "appearance", label: "Appearance" },
  { id: "keys", label: "Keys" },
  { id: "data", label: "Data" },
  { id: "listening", label: "Listening pass" },
  { id: "reports", label: "Grading reports" },
  { id: "about", label: "About" },
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

/** Sets the top-bar and document title while the page is mounted. */
export function usePageTitle(title: string): void {
  const setTitle = useShell((s) => s.setTitle);
  useEffect(() => {
    setTitle(title);
    document.title = title === "Oak" ? "Oak" : `${title} · Oak`;
  }, [title, setTitle]);
}

// Where "back" goes from a focus page (a lesson, a checkpoint, a drill, a session): the last ordinary page the
// learner was on, not always Today. The owner found the in-app back button "doesn't go back to where we were
// before" (2026-11-22). Kept for the tab (sessionStorage) so a reload inside a lesson still returns there.
export interface ReturnTarget {
  href: string;
  label: string;
}
const RETURN_KEY = "oak.returnTo";
let returnTo: ReturnTarget | null = null;

/** The page's name as the back button says it: its NavRail item ("Toolbox", "The Oak"), else "Today". */
export function returnLabelOf(path: string): string {
  return NAV_ITEMS.find((n) => n.match(path))?.label ?? "Today";
}

/** Records an ordinary (non-focus) page as the place to return to. */
export function noteReturnTarget(path: string, href: string): void {
  returnTo = { href, label: returnLabelOf(path) };
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(returnTo));
  } catch {
    // storage blocked: the in-memory value still serves this tab
  }
}

export function returnTarget(): ReturnTarget {
  if (returnTo) return returnTo;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<ReturnTarget>) : null;
    if (v && typeof v.href === "string" && v.href.startsWith("/") && typeof v.label === "string") {
      returnTo = { href: v.href, label: v.label };
      return returnTo;
    }
  } catch {
    // fall through to Today
  }
  return { href: "/", label: "Today" };
}
