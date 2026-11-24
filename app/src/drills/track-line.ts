// The practice hub's line for an open advanced track (pure): what the learner may start there next, named in words
// (shared decision 5: an id such as J1.L01 or JC1.S2 never stands alone in learner copy).
import type { TrackState } from "@oak/api";

type NextSession = NonNullable<TrackState["nextSession"]>;

/**
 * "Next: “Swing Feel & the Ride”." for a lesson or a checkpoint (both titled in words), and "Next: “JC1 ii–V
 * Ballad”, session 2." for a capstone session: its title keeps the album's track number, which is part of the
 * title. A title the server could not find comes back as the bare id; then the kind is said instead.
 */
export function nextSessionLine(n: Pick<NextSession, "kind" | "mapItemId" | "title">): string {
  const title = n.title.trim();
  const named = title !== "" && title !== n.mapItemId;
  const session = n.kind === "capstone" ? /\.S(\d+)$/.exec(n.mapItemId)?.[1] : undefined;
  const what = named
    ? `“${title}”`
    : n.kind === "checkpoint"
      ? "the track's checkpoint"
      : n.kind === "capstone"
        ? "the track's capstone"
        : "the next lesson";
  return session ? `Next: ${what}, session ${Number(session)}.` : `Next: ${what}.`;
}
