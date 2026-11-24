// `/song/$unitId` (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.5): one unit's song. The screen is
// app/src/song/SongPage.tsx.
import { createFileRoute } from "@tanstack/react-router";
import { SongPage } from "../../song/SongPage.tsx";

export const Route = createFileRoute("/song/$unitId")({ component: Song });

function Song() {
  const { unitId } = Route.useParams();
  return <SongPage key={unitId} unitId={unitId} />;
}
