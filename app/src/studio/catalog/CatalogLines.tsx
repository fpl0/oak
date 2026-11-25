// Oak 2.0 W3 (PLAN §4 S6): the catalog in its sketch (slot `catalog-lines`, place `aside`), shown when a catalog names
// this sketch. The learner's six lines, and "Compare with the reference": the reference comes back, and for a unit song
// Oak's reading (`referenceReading`) sits beside the learner's words. The learner has listened and written first
// (`revealed`: a version after the comment-only start has an unmuted part), so Oak's reading is a comparison, never
// a key (PLAN §2 rule 3). A transcription or an audio file gets no reading: Oak reads chords and form from code only. In Jam the compare
// is hidden (Jam shows no compare, W1 rule 2); the lines stay.
import { CATALOG_LINES, type Catalog, type UnitSongDef } from "@oak/api";
import { songLengthBars } from "@oak/strudel/song-compose";
import { tempoLine } from "@oak/theory";
import { NotebookText } from "lucide-react";
import { useEffect, useState } from "react";
import { useProfile } from "../../lib/queries.ts";
import { stopSong } from "../../song/player.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Card } from "../../ui/kit/basics.tsx";
import type { EditorSlotProps } from "../editor-slots.ts";
import { studioFlavour } from "../model.ts";
import { readPiece } from "../piece-read.ts";
import { catalogSongPlayId, ReferencePlayer, useRefOf } from "./CatalogFlow.tsx";
import { useCatalogs } from "./catalog-queries.ts";
import {
  CATALOG_WORDS,
  type CatalogLine,
  catalogOfSketch,
  LINE_LABELS,
  referenceReading,
  revealed,
  tuneRange,
} from "./model.ts";

export function CatalogLines({ sketch, jam }: EditorSlotProps) {
  const q = useCatalogs();
  const catalog = q.data ? catalogOfSketch(q.data.items, sketch.id) : null;
  if (catalog === null) return null;
  return <CatalogLinesCard catalog={catalog} sketch={sketch} jam={jam} />;
}

function CatalogLinesCard({
  catalog,
  sketch,
  jam,
}: {
  catalog: Catalog;
  sketch: EditorSlotProps["sketch"];
  jam: boolean;
}) {
  const ref = useRefOf(catalog);
  const [comparing, setComparing] = useState(false);
  // The compare button and the reference player wait until a part has been written from the lines (W5 S9).
  const canCompare = !jam && revealed(catalog, [sketch]);
  const open = comparing && canCompare;
  const reading = useSongReading(open && ref.song ? ref.song : null);
  const hide = () => {
    if (ref.song) stopSong(catalogSongPlayId(ref.song.id));
    setComparing(false);
  };
  return (
    <Card className="p-4" data-testid="catalog-lines">
      <h3 className="flex items-center gap-2 text-h3">
        <NotebookText aria-hidden className="size-4 text-text-3" />
        {CATALOG_WORDS.inSketch}
      </h3>
      <p className="mt-0.5 text-sm text-text-2">{ref.title}</p>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {CATALOG_LINES.map((k) => (
          <div key={k} data-line={k}>
            <dt className="text-text-2">{LINE_LABELS[k]}</dt>
            <dd className={catalog.lines[k] ? undefined : "text-text-3"}>
              {catalog.lines[k] || CATALOG_WORDS.noLines}
              {open && reading ? (
                <span className="mt-0.5 block text-text-2" data-testid={`oak-reading-${k}`}>
                  <span className="text-text-3">{CATALOG_WORDS.oaks}: </span>
                  {reading[k]}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      {canCompare ? (
        open ? (
          <div className="mt-3 flex flex-col gap-2" data-testid="catalog-compare">
            <ReferencePlayer choice={ref} />
            {ref.song ? (
              reading === null ? (
                <p className="text-sm text-text-3">{CATALOG_WORDS.reading}</p>
              ) : null
            ) : (
              <p className="text-sm text-text-2">
                {catalog.refKind === "outside" ? CATALOG_WORDS.outsideOnly : CATALOG_WORDS.recordingOnly}
              </p>
            )}
            <Button variant="link" size="sm" className="self-start" onClick={hide}>
              {CATALOG_WORDS.hideCompare}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setComparing(true)}
            data-testid="catalog-compare-open"
          >
            {CATALOG_WORDS.compare}
          </Button>
        )
      ) : null}
    </Card>
  );
}

/** Oak's reading of a unit song (its own version in the learner's style), read once the compare opens. */
function useSongReading(song: UnitSongDef | null): Record<CatalogLine, string> | null {
  const profile = useProfile();
  const flavour = studioFlavour(profile.data?.flavour);
  const [reading, setReading] = useState<{ id: string; lines: Record<CatalogLine, string> } | null>(null);
  const id = song ? `${song.id}:${flavour}` : null;
  useEffect(() => {
    if (song === null) return;
    const ac = new AbortController();
    const code = `${tempoLine(song.bpm, song.meter)}\n\n${song.code[flavour]}`;
    const bars = songLengthBars(song);
    void readPiece(code, { meter: song.meter, key: song.key, bars }, ac.signal).then((piece) => {
      if (ac.signal.aborted) return;
      setReading({
        id: `${song.id}:${flavour}`,
        lines: referenceReading({
          code,
          bpm: song.bpm,
          analysis: piece?.analysis ?? null,
          meter: song.meter,
          key: song.key,
          tune: piece ? tuneRange(piece.view.n.all) : null,
        }),
      });
    });
    return () => ac.abort();
  }, [song, flavour]);
  return reading !== null && reading.id === id ? reading.lines : null;
}
