// The advanced tracks' commands in the palette (Wave 7, docs/design/wave7.md §4.2, §5.2): the eight track lenses,
// each with its state ("Tensions lens · on · Shift+X", "Clave lens · Opens with the lesson “Clave Direction”."), switched
// from here; and the learner's focus between the core and the tracks ("Focus on Jazz Harmony", "Focus on the
// core"). A lens that is not open yet leads to Settings › Learning, where every lens and the gate that opens it is
// listed; it never toggles something that draws nothing. A focus is offered only for a track that is open and not
// complete; the core is always offered back. Nothing here reads as required.
import { TRACK_TITLES, type TrackFocusId } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { type Command, useCommandSource } from "../../lib/commands.ts";
import { useContent } from "../../lib/content.ts";
import { useLenses } from "../../lib/lenses.ts";
import { apiQuery, useCourseProgress, useSetTrackFocus } from "../../lib/queries.ts";
import { toast } from "../kit/Toast.tsx";
import { shellTracks } from "./course-state.ts";
import { trackLensRows } from "./track-lenses.ts";

export function TrackCommands() {
  const navigate = useNavigate();
  const lenses = useLenses();
  const content = useContent();
  const progress = useCourseProgress();
  const setFocus = useSetTrackFocus();
  const syllabus = content.data?.syllabus ?? null;
  const tracks = shellTracks(progress.data, syllabus);
  // Asked only once a track is open: before that there is nothing to choose between.
  // Arrangement & Sound counts once its own lessons are open (U09.CP), not for its optional side lessons.
  const choosable = tracks.filter(
    (t) => t.state !== "locked" && t.card !== "complete" && (t.trackId !== "A" || t.pastSideLessons),
  );
  const anyOpen = choosable.length > 0;
  const focus = useQuery({ ...apiQuery("tracks.focus"), enabled: anyOpen });
  const rows = trackLensRows(lenses.track.prefs, lenses.track.available, syllabus);
  const current: TrackFocusId | null = focus.data?.focus ?? null;
  const choose = (f: TrackFocusId) =>
    setFocus.mutate(
      { body: { focus: f } },
      {
        onError: (e) => toast.error("The focus was not changed", e instanceof Error ? e.message : String(e)),
      },
    );
  const signature = `${rows.map((r) => `${r.id}:${r.state}`).join(",")}|${tracks
    .map((t) => `${t.trackId}:${t.state}:${t.card}`)
    .join(",")}|${current ?? ""}|${lenses.ready}`;
  // The commands change only when the signature does; their `run` reads the latest through the command source.
  const commands = useMemo<Command[]>(() => {
    const out: Command[] = [];
    if (lenses.ready)
      for (const r of rows)
        out.push({
          id: `lens:track:${r.id}`,
          title: r.available ? `${r.label} lens: turn ${r.on ? "off" : "on"}` : `${r.label} lens`,
          group: "Actions",
          hint: r.available ? `${r.on ? "On" : "Off"} · ${r.what}` : r.state,
          // A lens whose track is not open yet is found by name, but does not fill the empty palette.
          searchOnly: !r.available,
          ...(r.keys && r.available ? { shortcut: r.keys } : {}),
          keywords: ["lens", "lenses", "label", r.label, r.what, "track"],
          run: () => {
            if (r.available) lenses.track.toggle(r.id);
            else void navigate({ to: "/settings/learning" });
          },
        });
    // The focus: the core, or an open track with something left in it.
    // Only once the server answers where the focus is (an older server cannot set it: no dead command).
    const open = current === null ? [] : choosable;
    if (open.length > 0 && current !== "core")
      out.push({
        id: "focus:core",
        title: "Focus on the core",
        group: "Actions",
        hint: "Today plans the core first; open tracks are offered beside it",
        keywords: ["focus", "track", "core", "order"],
        run: () => choose("core"),
      });
    for (const t of open) {
      if (current === t.trackId) continue;
      out.push({
        id: `focus:${t.trackId}`,
        title: `Focus on ${TRACK_TITLES[t.trackId]}`,
        group: "Actions",
        hint: "Today plans this track's next session first; you can switch back any day",
        keywords: ["focus", "track", t.trackId, "order"],
        run: () => choose(t.trackId),
      });
    }
    return out;
  }, [signature]);
  useCommandSource("tracks", commands);
  return null;
}
