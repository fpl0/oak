// The app shell (ux §2.1): NavRail + TopBar around the page in shell routes; a 56 px focus header and no rail
// in focus routes (lesson, drill, checkpoint, onboarding, coda, calibration). The tutor panel docks on the right.
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { clsx } from "clsx";
import {
  AudioWaveform,
  ChevronLeft,
  ListChecks,
  NotebookPen,
  Search,
  Settings,
  Sunrise,
  Wrench,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { CaptureButton, CaptureHost } from "../../capture/CaptureButton.tsx";
import { useContent } from "../../lib/content.ts";
import { NAV_ITEMS, type NavId, noteReturnTarget, returnTarget } from "../../lib/nav.ts";
import { useCourseProgress, useDue } from "../../lib/queries.ts";
import { useShell } from "../../lib/shell-store.ts";
import { useUnlockedSet } from "../../lib/unlocked.ts";
import { useTutorBridge } from "../../tutor/use-tutor-bridge.ts";
import { OakIcon, RingIcon, TuningForkIcon } from "../icons/index.tsx";
import { isFocusRoute } from "../keys/keymap.ts";
import { IconButton } from "../kit/Button.tsx";
import { StepRail } from "../kit/basics.tsx";
import { Toaster } from "../kit/Toast.tsx";
import { Tooltip } from "../kit/Tooltip.tsx";
import { CommandPalette } from "./CommandPalette.tsx";
import { oakNavLabel, oakTracksNote, shellTracks } from "./course-state.ts";
import { useFocusHeader } from "./focus-header.ts";
import { GlobalKeys } from "./GlobalKeys.tsx";
import { navItemState } from "./nav-state.ts";
import { AudioStatus, MicLiveDot, NowPlaying, TutorToggle } from "./status.tsx";
import { TrackCommands } from "./TrackCommands.tsx";
import { TutorPanel } from "./TutorPanel.tsx";
import { UpdateNotice } from "./UpdateNotice.tsx";

const ICONS: Record<NavId, ReactNode> = {
  today: <Sunrise aria-hidden className="size-5" strokeWidth={1.5} />,
  oak: <OakIcon />,
  practice: <TuningForkIcon />,
  studio: <NotebookPen aria-hidden className="size-5" strokeWidth={1.5} />,
  transcribe: <AudioWaveform aria-hidden className="size-5" strokeWidth={1.5} />,
  album: <RingIcon />,
  toolbox: <Wrench aria-hidden className="size-5" strokeWidth={1.5} />,
  progress: <ListChecks aria-hidden className="size-5" strokeWidth={1.5} />,
  settings: <Settings aria-hidden className="size-5" strokeWidth={1.5} />,
};

function PracticeBadge() {
  const due = useDue();
  const items = due.data?.items.length ?? 0;
  if (!items) return null;
  // Raw due counts are never shown (DueBatch.label); the badge is a dot with the label for screen readers.
  return (
    <span
      className="absolute top-1 right-1 size-2 rounded-full bg-accent-2"
      aria-hidden
      title={due.data?.label}
    />
  );
}

function NavRail({ path }: { path: string }) {
  const due = useDue();
  const { unlocked, ready } = useUnlockedSet();
  // Wave 6: once an advanced track is open the Oak's item says so, and that its lessons are still being written
  // (never a lock, never a badge: a track is optional). Nothing is said before the course progress has loaded.
  const progress = useCourseProgress();
  const content = useContent();
  const tracks = shellTracks(progress.data, content.data?.syllabus ?? null);
  const tracksNote = oakTracksNote(tracks);
  const main = NAV_ITEMS.filter((i) => i.id !== "settings");
  const settings = NAV_ITEMS.find((i) => i.id === "settings");
  const item = (n: (typeof NAV_ITEMS)[number]) => {
    const active = n.match(path);
    const base =
      n.id === "practice" && due.data?.items.length
        ? `${n.label} · ${due.data.label}`
        : n.id === "oak"
          ? oakNavLabel(n.label, tracks)
          : n.label;
    // Transcribe and Album say in their tooltip when they fill in, and stay reachable (never gated, contracts
    // §7.6). No lock badge and no dimming: the owner asked for the locks to go (2026-11-22).
    const { pending, label } = navItemState(n.id, base, unlocked, ready);
    return (
      <li key={n.id}>
        <Tooltip content={label} shortcut={`G ${n.gKey}`} side="right">
          <Link
            to={n.to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            data-nav={n.id}
            data-nav-pending={pending || undefined}
            data-nav-tracks={n.id === "oak" && tracksNote ? "open" : undefined}
            className={clsx(
              "relative flex size-10 items-center justify-center rounded-control transition-colors",
              active ? "bg-lane-in text-accent" : "text-text-2 hover:bg-surface-2 hover:text-text",
            )}
          >
            {ICONS[n.id]}
            {n.id === "practice" && <PracticeBadge />}
          </Link>
        </Tooltip>
      </li>
    );
  };
  return (
    <nav
      aria-label="Main"
      className="flex w-[var(--oak-nav-w)] shrink-0 flex-col items-center justify-between border-r border-border bg-surface py-2"
    >
      <ul className="flex flex-col items-center gap-1">
        <li
          className="mb-2 flex h-10 items-center font-display text-lg font-semibold text-accent"
          aria-hidden
        >
          Oak
        </li>
        {main.map(item)}
      </ul>
      <ul className="flex flex-col items-center gap-1">{settings && item(settings)}</ul>
    </nav>
  );
}

function TopBar() {
  const title = useShell((s) => s.title);
  const setPalette = useShell((s) => s.setPaletteOpen);
  return (
    <header className="flex h-[var(--oak-topbar-h)] shrink-0 items-center justify-between gap-3 border-b border-border bg-bg px-4">
      <p className="min-w-0 flex-1 truncate font-display text-h3 font-semibold" data-testid="page-title">
        {title}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <NowPlaying />
        <MicLiveDot />
        <AudioStatus />
        <CaptureButton />
        <IconButton
          label="Command palette"
          shortcut="⌘K"
          icon={<Search aria-hidden className="size-4" />}
          onClick={() => setPalette(true)}
        />
        <TutorToggle />
      </div>
    </header>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const min = Math.max(0, Math.floor((now - since) / 60_000));
  return (
    <span className="text-sm text-text-3 tabular-nums">
      <span aria-hidden>{min}′</span>
      <span className="sr-only">{min} minutes in</span>
    </span>
  );
}

function FocusBar() {
  const { title, steps, startedAt, position, onVisit } = useFocusHeader();
  const shellTitle = useShell((s) => s.title);
  const router = useRouter();
  const back = returnTarget();
  return (
    <header className="flex h-[var(--oak-focusbar-h)] shrink-0 items-center gap-4 border-b border-border bg-bg px-3">
      <Tooltip content="Your place is saved" shortcut="Esc" side="bottom">
        <a
          href={back.href}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            void router.navigate({ href: back.href });
          }}
          className="inline-flex h-8 items-center gap-1 rounded-control px-2 text-sm text-text-2 hover:bg-surface-2 hover:text-text"
          data-testid="focus-back"
        >
          <ChevronLeft aria-hidden className="size-4" /> {back.label}
        </a>
      </Tooltip>
      <p className="min-w-0 flex-1 truncate font-display text-h3 font-semibold" data-testid="page-title">
        {title ?? shellTitle}
      </p>
      {steps && <StepRail steps={steps} position={position} onVisit={onVisit} />}
      {startedAt && <Elapsed since={startedAt} />}
      <MicLiveDot />
      <AudioStatus />
      <CaptureButton />
      <TutorToggle />
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  const focus = isFocusRoute(path);
  // The last ordinary page is where a focus page's back button (and Esc) returns.
  useEffect(() => {
    if (!focus) noteReturnTarget(path, href);
  }, [focus, path, href]);
  useTutorBridge();
  return (
    // `relative` here and on <main>: an absolutely positioned descendant with no positioned ancestor (every `sr-only`
    // label is one) is laid out against the document, not its scroller. A long page then made the document itself
    // thousands of pixels tall under this fixed-height shell, and the window grew a second scrollbar that scrolled
    // the whole shell away (the Oak's Course view: 175 status labels).
    <div
      className="relative flex h-dvh w-full overflow-hidden bg-bg text-text"
      data-mode={focus ? "focus" : "shell"}
    >
      <a
        href="#main"
        className="sr-only-focusable absolute top-2 left-2 z-[70] rounded-control bg-accent px-3 py-2 text-on-accent"
      >
        Skip to content
      </a>
      {!focus && <NavRail path={path} />}
      <div className="flex min-w-0 flex-1 flex-col">
        {focus ? <FocusBar /> : <TopBar />}
        {!focus && <UpdateNotice />}
        <div className="flex min-h-0 flex-1">
          <main id="main" tabIndex={-1} className="relative min-w-0 flex-1 overflow-auto outline-none">
            {children}
          </main>
          <TutorPanel />
        </div>
      </div>
      <CommandPalette />
      <GlobalKeys />
      <TrackCommands />
      <CaptureHost />
      <Toaster />
    </div>
  );
}
