// Oak 2.0 W4 F6 (DeSantis, Fail Better): "The Shelf" on the album page, after the sides: finished pieces the learner
// kept off the album (`Album.shelf`). Each row names the piece and where it would sit, opens it, and can put it on the
// album (`album.patchTrack { shelved: false }`). Hidden while the Shelf is empty. The album's "Songs" shelf of unit
// songs keeps its name; this one is "The Shelf" ("Calls to check" 13).
import type { AlbumTrack } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { errorWords } from "../lib/error-words.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { useAlbumPatchTrack } from "./shelf-queries.ts";

export const SHELF_COPY = {
  title: "The Shelf",
  line: "Finished pieces you kept off the album.",
  open: "Open",
  toAlbum: "Put it on the album",
  toShelf: "Move to the Shelf",
  failed: "That could not be moved. Try again.",
  sideA: "Side A",
  sideB: "Side B",
  bside: "A B-side",
} as const;

/** Where a shelved track would sit on the album, in words. */
export function shelfSideWords(t: Pick<AlbumTrack, "side" | "capstoneId">): string {
  return t.side === "A" ? SHELF_COPY.sideA : t.side === "B" ? SHELF_COPY.sideB : SHELF_COPY.bside;
}

export function ShelfDrawer({ shelf }: { shelf: AlbumTrack[] }) {
  const patch = useAlbumPatchTrack();
  if (shelf.length === 0) return null;
  const toAlbum = async (t: AlbumTrack) => {
    try {
      await patch.mutateAsync({ params: { id: t.id }, body: { shelved: false } });
    } catch (e) {
      toast.error(SHELF_COPY.failed, errorWords(e));
    }
  };
  return (
    <section aria-labelledby="the-shelf" data-testid="the-shelf">
      <div className="mb-3 flex flex-col gap-0.5 border-b border-border pb-2">
        <h2 id="the-shelf" className="font-display text-h2">
          {SHELF_COPY.title}
        </h2>
        <span className="text-sm text-text-3">{SHELF_COPY.line}</span>
      </div>
      <ul className="flex flex-col">
        {shelf.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-3 border-b border-border/60 py-3"
            data-shelf-track={t.id}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-text-3">{shelfSideWords(t)}</p>
            </div>
            <Link to="/album/$trackId" params={{ trackId: t.id }} className={buttonClass("secondary", "sm")}>
              {SHELF_COPY.open}
            </Link>
            <Button
              size="sm"
              variant="ghost"
              loading={patch.isPending && patch.variables?.params.id === t.id}
              onClick={() => void toAlbum(t)}
              data-testid="shelf-to-album"
            >
              {SHELF_COPY.toAlbum}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
