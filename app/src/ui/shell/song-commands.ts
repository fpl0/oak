// The unit songs the command palette finds (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.5): every
// song the learner has started, by the title they gave it, and the song of every unit they have reached, so typing
// the name Today shows ("Climb the chord") opens that song. A song of a unit still ahead is not listed: its page would
// offer to start a song whose lessons are not open yet.

/** The few fields of a unit song's definition the palette needs. */
export interface SongDefLike {
  unit: string;
  title: string;
}

/** The few fields of a started song (`songs.list`) the palette needs. */
export interface StartedSongLike {
  unitId: string;
  title: string;
  status: "new" | "open" | "released";
}

export interface SongEntry {
  unitId: string;
  title: string;
  hint: string;
  keywords: string[];
}

/** `U05.L03` → `U05`; ids that name no unit lesson (`C0.S1`, `GYM.01`) → null. */
function unitOf(id: string): string | null {
  const m = /^([A-Z]+\d+)\.(L\d+|CP\d*)$/.exec(id);
  return m?.[1] ?? null;
}

/**
 * The units the learner has reached: a lesson of the unit started or done, or the unit of the next session.
 * `lessons` is `lessons.progress`'s list; `next` its next session.
 */
export function reachedUnits(
  lessons: readonly { lessonId: string; status: string }[],
  next: string | null,
): Set<string> {
  const out = new Set<string>();
  for (const l of lessons) {
    if (l.status !== "in_progress" && l.status !== "completed") continue;
    const u = unitOf(l.lessonId);
    if (u) out.add(u);
  }
  const n = next ? unitOf(next) : null;
  if (n) out.add(n);
  return out;
}

/** The songs to list, in course order (the order of `defs`). */
export function songEntries(
  defs: readonly SongDefLike[],
  started: readonly StartedSongLike[],
  reached: ReadonlySet<string>,
  unitTitle: (unitId: string) => string | undefined,
): SongEntry[] {
  const byUnit = new Map(started.map((s) => [s.unitId, s]));
  const out: SongEntry[] = [];
  for (const d of defs) {
    const mine = byUnit.get(d.unit);
    if (!mine && !reached.has(d.unit)) continue;
    const title = mine?.title.trim() || d.title;
    const unit = unitTitle(d.unit);
    const status =
      !mine || mine.status === "new"
        ? "Not started"
        : mine.status === "released"
          ? "On the album"
          : "Started";
    out.push({
      unitId: d.unit,
      title,
      hint: unit ? `${status} · ${unit}` : status,
      // The song's own name finds it after the learner renamed it, and "song" lists every song.
      keywords: ["song", "unit song", d.title, ...(unit ? [unit] : [])],
    });
  }
  return out;
}
