// Command palette (Cmd/Ctrl+K, ux §2.1): navigation, actions and search over lessons, tools, sketches and tracks.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { unitSongs } from "../../../../content/unit-songs/index.ts";
import {
  allCommands,
  type Command,
  groupInOrder,
  rankCommands,
  useCommandStore,
} from "../../lib/commands.ts";
import { useContent } from "../../lib/content.ts";
import { apiQuery } from "../../lib/queries.ts";
import { useShell } from "../../lib/shell-store.ts";
import { useUnlockedSet } from "../../lib/unlocked.ts";
import { IS_MAC } from "../keys/KeymapProvider.tsx";
import { formatKeys } from "../keys/keymap.ts";
import {
  openCommands,
  shellTracks,
  trackHint,
  trackSessionTarget,
  tracksListedOpen,
  unwrittenHint,
} from "./course-state.ts";
import { sideLessonHint } from "./side-lessons.ts";
import { reachedUnits, songEntries } from "./song-commands.ts";

function useSearchCommands(open: boolean): Command[] {
  const navigate = useNavigate();
  const content = useContent();
  const sketches = useQuery({ ...apiQuery("sketches.list", { query: {} }), enabled: open });
  const album = useQuery({ ...apiQuery("album.get"), enabled: open });
  const songs = useQuery({ ...apiQuery("songs.list"), enabled: open });
  // Wave 5: side lessons say they are optional and where they stand: the server's answer when a page loaded it
  // (never fetched here), else the unlock list the shell has anyway.
  const side = useQuery({ ...apiQuery("sideLessons.list"), enabled: false });
  const { unlocked, ready } = useUnlockedSet();
  // Wave 6: the advanced tracks and what stays open after the core. The course progress is the shell's anyway (the
  // rail reads it); `course.completion` is asked only while the palette is open and the lessons of the core are done.
  const progress = useQuery({ ...apiQuery("lessons.progress"), enabled: open });
  const core = progress.data?.core;
  const completion = useQuery({
    ...apiQuery("course.completion"),
    enabled: open && (core === "lessons-done" || core === "complete"),
  });
  return useMemo(() => {
    const out: Command[] = [];
    const authored = new Set((content.data?.lessons ?? []).map((l) => l.id));
    const toCourse = () => void navigate({ to: "/oak", search: { view: "course" } });
    // What stays open after the core comes first among the results: reviews, the gym, Studio, a track left to
    // release; a track with no lesson yet says so and leads to the Oak, never to a lesson.
    for (const c of openCommands(completion.data?.open ?? []))
      out.push({
        id: c.id,
        title: c.title,
        group: "Navigate",
        hint: c.hint,
        keywords: ["open to you", "what is open", "what next", "after the core"],
        run: () => {
          const to = c.to;
          if (to.kind === "lesson")
            void navigate({ to: "/learn/$lessonId", params: { lessonId: to.lessonId } });
          else if (to.kind === "capstone")
            void navigate({ to: "/capstone/$id", params: { id: to.capstoneId } });
          else if (to.path === "/oak") toCourse();
          else void navigate({ to: to.path });
        },
      });
    const listed = tracksListedOpen(completion.data?.open ?? []);
    for (const t of shellTracks(progress.data, content.data?.syllabus ?? null)) {
      if (listed.has(t.trackId)) continue;
      out.push({
        id: `course-track:${t.trackId}`,
        title: t.title,
        group: "Lessons",
        hint: trackHint(t),
        // Not the next session's id: typing a lesson's id finds that lesson first, not the track around it.
        keywords: ["track", "advanced track", t.trackId],
        // Wave 7: a track is a place: its next session (a lesson, its checkpoint or a capstone session) when one
        // can start, else the Oak's course view, where the track and the gate that holds it are drawn.
        run: () => {
          const to = t.state === "ready" ? trackSessionTarget(t) : null;
          if (to?.kind === "lesson")
            void navigate({ to: "/learn/$lessonId", params: { lessonId: to.lessonId } });
          else if (to?.kind === "checkpoint")
            void navigate({ to: "/checkpoint/$unitId", params: { unitId: to.unitId } });
          else if (to?.kind === "capstone")
            void navigate({ to: "/capstone/$id", params: { id: to.capstoneId } });
          else toCourse();
        },
      });
    }
    // Unit songs (1.3.0): by the title Today and the song page show, before the lessons that make them.
    const units = content.data?.syllabus?.units ?? [];
    const reached = reachedUnits(progress.data?.lessons ?? [], progress.data?.next ?? null);
    for (const s of songEntries(
      unitSongs,
      songs.data?.items ?? [],
      reached,
      (id) => units.find((u) => u.id === id)?.title,
    ))
      out.push({
        id: `song:${s.unitId}`,
        title: s.title,
        group: "Songs",
        hint: s.hint,
        keywords: s.keywords,
        run: () => void navigate({ to: "/song/$unitId", params: { unitId: s.unitId } }),
      });
    const lessonState = new Map((progress.data?.lessons ?? []).map((p) => [p.lessonId as string, p.status]));
    for (const u of units)
      for (const l of u.lessons) {
        // A lesson nobody has written yet is listed honestly and leads to the course view, not to an empty page.
        const unwritten = unwrittenHint(l.id, authored);
        out.push({
          id: `lesson:${l.id}`,
          title: l.title,
          group: "Lessons",
          hint:
            unwritten ??
            sideLessonHint(l.id, l.side === true, {
              state: side.data,
              unlocked,
              ready,
              toolbox: content.data?.toolbox ?? [],
              syllabus: content.data?.syllabus ?? null,
            }) ??
            // A lesson still ahead says so (its page says "This lesson isn't open yet").
            (lessonState.get(l.id) === "locked" ? `${l.id} · not open yet` : l.id),
          keywords: l.side ? [l.id, u.title, "side lesson", "optional", "sound"] : [l.id, u.title],
          run: unwritten
            ? toCourse
            : () => void navigate({ to: "/learn/$lessonId", params: { lessonId: l.id } }),
        });
      }
    for (const t of content.data?.toolbox ?? [])
      out.push({
        id: `tool:${t.id}`,
        title: t.catalog.signature || t.code,
        group: "Tools",
        hint: t.kind,
        keywords: [t.id, t.code, t.concept],
        run: () => void navigate({ to: "/toolbox/$toolId", params: { toolId: t.id } }),
      });
    for (const s of sketches.data?.items ?? [])
      out.push({
        id: `sketch:${s.id}`,
        title: s.title,
        group: "Sketches",
        keywords: s.tags,
        run: () => void navigate({ to: "/studio/$sketchId", params: { sketchId: s.id } }),
      });
    for (const t of album.data?.tracks ?? [])
      out.push({
        id: `track:${t.id}`,
        title: t.title,
        group: "Tracks",
        hint: `Album · ${t.side === "Bside" ? "B-side" : `Side ${t.side}`}`,
        run: () => void navigate({ to: "/album/$trackId", params: { trackId: t.id } }),
      });
    return out;
  }, [
    content.data,
    sketches.data,
    album.data,
    songs.data,
    side.data,
    progress.data,
    completion.data,
    unlocked,
    ready,
    navigate,
  ]);
}

export function CommandPalette() {
  const open = useShell((s) => s.paletteOpen);
  const setOpen = useShell((s) => s.setPaletteOpen);
  const sources = useCommandStore((s) => s.sources);
  const search = useSearchCommands(open);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const commands = useMemo(() => {
    const base = allCommands(sources);
    // Search results only once the learner types: an empty palette shows navigation and actions.
    return query.trim()
      ? groupInOrder(rankCommands(query, [...base, ...search], 40))
      : groupInOrder(rankCommands("", base, 40));
  }, [sources, search, query]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      setQuery("");
      setActive(0);
      el.showModal();
      inputRef.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => setActive(0), [query]);
  // The arrow keys move the active row; the list follows it, or Enter would run a row scrolled out of sight.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const runAt = (i: number) => {
    const c = commands[i];
    if (!c) return;
    setOpen(false);
    // Let the dialog close (and focus return) before the command moves focus elsewhere.
    queueMicrotask(() => c.run());
  };

  let lastGroup = "";
  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      onKeyDown={() => {}}
      className="m-auto mt-[12vh] w-[min(92vw,40rem)] overflow-hidden rounded-sheet border border-border bg-surface p-0 text-text shadow-overlay backdrop:bg-scrim open:animate-pop-in"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search aria-hidden className="size-4 text-text-3" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={commands[active] ? `${listId}-${active}` : undefined}
          aria-label="Search commands, lessons, tools, sketches and tracks"
          placeholder="Go to, do, or find…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(commands.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runAt(active);
            }
          }}
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-text-3"
        />
      </div>
      <div id={listId} role="listbox" aria-label="Results" className="max-h-[55vh] overflow-auto p-1.5">
        {commands.length === 0 && <p className="px-3 py-6 text-center text-text-3">No matches.</p>}
        {commands.map((c, i) => {
          const header = c.group !== lastGroup ? c.group : null;
          lastGroup = c.group;
          return (
            <div key={c.id} role="presentation">
              {header && (
                <div
                  role="presentation"
                  className="px-2 pt-2 pb-1 text-[0.75rem] font-semibold tracking-wide text-text-3 uppercase"
                >
                  {header}
                </div>
              )}
              <div
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                onMouseMove={() => setActive(i)}
                onClick={() => runAt(i)}
                onKeyDown={() => {}}
                className={clsx(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-2",
                  i === active ? "bg-lane-in text-text" : "text-text-2",
                )}
              >
                <span className="truncate">{c.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-text-3">
                  {c.hint}
                  {c.shortcut && (
                    <kbd className="font-mono text-[0.75rem]">{formatKeys(c.shortcut, IS_MAC)}</kbd>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </dialog>
  );
}
