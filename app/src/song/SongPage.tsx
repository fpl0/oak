// The song page, `/song/$unitId` (spec 2026-11-24 §5.5): one unit's song at full size. Its cover, its title (renamed
// in place), its style (changed in place: the takes stay, Oak's parts change style), ▶ with the playhead over the
// grid, a section looped from its header, mute and solo per part, the album (Release / Release again, or where it
// is), and the history of takes, each lesson with what it took over and ▶ for the song as it stood right after it.
import type { FlavourId, SongPartId, UnitId, UnitSongDef, UnitSongDetail } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Pencil, Repeat } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { unitSongOfUnit } from "../../../content/unit-songs/index.ts";
import { formatDate } from "../lib/format.ts";
import { usePageTitle } from "../lib/nav.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { EmptyState, Page } from "../ui/kit/basics.tsx";
import { SegmentedControl } from "../ui/kit/Controls.tsx";
import { ErrorState, LoadingState } from "../ui/kit/QueryState.tsx";
import { ReleasePlayButton } from "./AlbumSongs.tsx";
import {
  useIntroducedTerms,
  useLessonTitles,
  useRenameSong,
  useSetSongFlavour,
  useUnitSong,
} from "./hooks.ts";
import { nowId, ofUnit, takeId } from "./ids.ts";
import { type SongView, type SongViewPart, songBandOf, songViewOf } from "./model.ts";
import { NewSong } from "./NewSong.tsx";
import { playSong, setSongLoop, setSongMutes, stopSong, useSongPlay } from "./player.ts";
import { ringTonesOf, SongCover } from "./SongCover.tsx";
import { SongRelease } from "./SongGrew.tsx";
import { SongGrid } from "./SongGrid.tsx";
import { SongPlayButton } from "./SongPlayButton.tsx";
import {
  andList,
  blocksLine,
  cellsHeldBy,
  cellsSentence,
  detailUpTo,
  lessonsInSong,
  partMutes,
  releaseOffer,
  SONG_STAGE_WORDS,
  SONG_STYLES,
  sectionAtBar,
  songStage,
  styleName,
} from "./surfaces-model.ts";

export function SongPage({ unitId, song: given }: { unitId: string; song?: UnitSongDef }) {
  const def = given ?? unitSongOfUnit(unitId as UnitId);
  const q = useUnitSong(def ? unitId : null);
  usePageTitle(q.data?.title ?? def?.title ?? "Song");
  // Started from the New song moment on this page: the song page replaces it at the top, with focus on its title.
  const [justStarted, setJustStarted] = useState(false);
  if (!def)
    return (
      <Page width="narrow">
        <EmptyState
          title="No song for this unit"
          action={
            <Link to="/album" className={buttonClass("primary")}>
              The album
            </Link>
          }
        >
          {unitId} has no song yet.
        </EmptyState>
      </Page>
    );
  if (q.isError)
    return (
      <Page>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  if (!q.data)
    return (
      <Page>
        <LoadingState label="Opening the song" />
      </Page>
    );
  if (q.data.status === "new")
    return (
      <Page>
        <NewSong unitId={unitId} song={def} onStarted={() => setJustStarted(true)} />
      </Page>
    );
  return (
    <Page>
      <SongBody def={def} detail={q.data} arrived={justStarted} />
    </Page>
  );
}

export interface PartState {
  muted: ReadonlySet<SongPartId>;
  solo: SongPartId | null;
}

function SongBody({
  def,
  detail,
  arrived = false,
}: {
  def: UnitSongDef;
  detail: UnitSongDetail;
  /** The learner just started the song on this page: scroll to the top and focus the title. */
  arrived?: boolean;
}) {
  const introduced = useIntroducedTerms();
  const titleOf = useLessonTitles();
  const view = songViewOf(def, detail, introduced);
  const id = nowId(def.unit);
  const play = useSongPlay(id);
  const [parts, setParts] = useState<PartState>({ muted: new Set(), solo: null });
  const mutesOf = (tracks: readonly string[]) => partMutes(def, detail, parts, tracks);
  // Mutes follow the rows while the song plays.
  const partsRef = useRef(parts);
  useEffect(() => {
    if (partsRef.current === parts) return;
    partsRef.current = parts;
    setSongMutes(id, (tracks) => partMutes(def, detail, parts, tracks));
  });
  const band = songBandOf(def, detail, { flavour: detail.flavour });
  const showBars = introduced.has("term.bar");
  const looping = play.loop
    ? (view.sections.find((s) => s.startBar === play.loop?.fromBar)?.id ?? null)
    : null;
  const onLoop = (s: { startBar: number; bars: number } | null) => {
    const loop = s ? { fromBar: s.startBar, bars: s.bars } : null;
    if (play.playing || play.loading) setSongLoop(id, loop);
    else if (loop) void playSong(id, band, { loop, mutes: mutesOf, title: detail.title });
  };
  const toggle = (part: SongPartId, what: "mute" | "solo") =>
    setParts((p) => {
      if (what === "solo") return { ...p, solo: p.solo === part ? null : part };
      const muted = new Set(p.muted);
      if (muted.has(part)) muted.delete(part);
      else muted.add(part);
      return { ...p, muted };
    });
  const lessons = lessonsInSong(def, detail);
  const at = play.bar === null ? null : sectionAtBar(view, play.bar);
  const atLabel = at ? view.sections.find((s) => s.id === at)?.label : null;

  return (
    <div className="flex flex-col gap-10" data-testid="song-page">
      <header className="grid items-end gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <SongCover
          seed={def.unit}
          flavour={detail.flavour}
          tones={ringTonesOf(def, detail.takes)}
          size={212}
          className="rounded-[16px] shadow-card"
          label={`The cover of “${detail.title}”: ${detail.takes.length} ${detail.takes.length === 1 ? "ring" : "rings"}, one per Make saved into it`}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <TitleEditor unitId={def.unit} title={detail.title} arrived={arrived} />
          <p className="text-text-2 tabular-nums" data-testid="song-page-meta">
            {SONG_STAGE_WORDS[songStage(detail, lessons)]} · {lessons.done} of {lessons.of} lessons in it ·{" "}
            {blocksLine(view)}
          </p>
          <StyleSwitch unitId={def.unit} flavour={detail.flavour} playingId={id} />
        </div>
      </header>

      <section aria-labelledby="song-grid-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <SongPlayButton
            id={id}
            band={band}
            label="Play the song"
            ariaLabel={`Play “${detail.title}”`}
            look="round"
            options={{ mutes: mutesOf, title: detail.title }}
            data-testid="song-page-play"
          />
          <div className="min-w-0">
            <h2 id="song-grid-h" className="text-h3">
              The song, part by part
            </h2>
            {/* Two live regions: what plays (it changes bar by bar), and which parts are muted or soloed, said once
                per change of the M and S buttons. */}
            <p className="text-sm text-text-2" data-testid="song-page-now">
              <span aria-live="polite">
                {looping
                  ? `Looping ${view.sections.find((s) => s.id === looping)?.label}. Click it again to play on.`
                  : play.playing && atLabel
                    ? `Playing ${atLabel}${showBars && play.bar !== null ? `, bar ${play.bar + 1} of ${view.lengthBars}` : ""}.`
                    : "Click a section's name to loop it. M mutes a part, S plays it alone."}
              </span>{" "}
              <span aria-live="polite" className="font-medium text-text" data-testid="song-page-parts">
                {partsLine(view, parts)}
              </span>
            </p>
          </div>
          {looping && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Repeat aria-hidden className="size-3.5" />}
              onClick={() => onLoop(null)}
            >
              Stop the loop
            </Button>
          )}
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <SongGrid
            view={view}
            follows={ofUnit(def.unit)}
            loopSection={looping}
            onLoop={onLoop}
            showBars={showBars}
            rowControls={(p) => <PartControls part={p} state={parts} onToggle={toggle} />}
            // A muted part, or every part but the soloed one, is drawn faded and struck through, as it sounds.
            silent={(p) => parts.muted.has(p.id) || (parts.solo !== null && parts.solo !== p.id)}
          />
        </div>
      </section>

      <AlbumLine def={def} detail={detail} />

      <TakeHistory def={def} detail={detail} view={view} titleOf={titleOf} />
    </div>
  );
}

/** Which parts are muted or soloed, in words ("Kick muted.", "Only Snare plays."); empty when every part plays. */
export function partsLine(view: Pick<SongView, "parts">, state: PartState): string {
  const name = (id: SongPartId) => view.parts.find((p) => p.id === id)?.name ?? id;
  if (state.solo !== null)
    return state.muted.has(state.solo)
      ? `${name(state.solo)} plays alone but is muted: nothing plays.`
      : `Only ${name(state.solo)} plays.`;
  const muted = view.parts.filter((p) => state.muted.has(p.id)).map((p) => p.name);
  return muted.length > 0 ? `${andList(muted)} muted.` : "";
}

function PartControls({
  part,
  state,
  onToggle,
}: {
  part: SongViewPart;
  state: PartState;
  onToggle(part: SongPartId, what: "mute" | "solo"): void;
}) {
  const muted = state.muted.has(part.id);
  const solo = state.solo === part.id;
  const pill = (on: boolean) =>
    clsx(
      // 24px targets (WCAG 2.5.8), 4px apart, with an outline that reads as a button when off (about 3:1 on the card).
      "inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] border text-xs font-semibold transition-colors duration-150",
      on
        ? "border-accent bg-accent text-on-accent"
        : "border-text-3/75 text-text-3 hover:border-text-3 hover:text-text",
    );
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        aria-pressed={muted}
        aria-label={`Mute ${part.name}`}
        title={`Mute ${part.name}`}
        className={pill(muted)}
        onClick={() => onToggle(part.id, "mute")}
        data-testid="part-mute"
      >
        M
      </button>
      <button
        type="button"
        aria-pressed={solo}
        aria-label={`Play ${part.name} alone`}
        title={`Play ${part.name} alone`}
        className={pill(solo)}
        onClick={() => onToggle(part.id, "solo")}
        data-testid="part-solo"
      >
        S
      </button>
    </span>
  );
}

/** The title, renamed in place: Rename opens a field; Enter or Save keeps it, Escape or Cancel leaves it. */
function TitleEditor({ unitId, title, arrived }: { unitId: string; title: string; arrived: boolean }) {
  const rename = useRenameSong();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const fieldId = useId();
  // Closing the field (Save, Escape, Cancel) gives the focus back to Rename, which the field replaced.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (draft !== null) {
      wasOpen.current = true;
      field.current?.select();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      renameButton.current?.focus();
    }
  }, [draft !== null]);
  useEffect(() => {
    if (!arrived) return;
    const main = document.getElementById("main");
    const reduced =
      document.documentElement.dataset.motion === "reduced" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    main?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    heading.current?.focus({ preventScroll: true });
  }, [arrived]);
  const save = async () => {
    const next = (draft ?? "").trim();
    if (!next || next === title) return setDraft(null);
    try {
      await rename.mutateAsync({ params: { unitId: unitId as UnitId }, body: { title: next } });
      setDraft(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The title was not saved.");
    }
  };
  if (draft === null)
    return (
      <div className="flex min-w-0 items-end gap-2">
        <h1
          ref={heading}
          tabIndex={-1}
          className="min-w-0 font-display text-[clamp(2.1rem,4.6vw,3.1rem)] leading-[1.02] font-semibold tracking-[-0.018em] outline-none"
          data-testid="song-page-title"
        >
          {title}
        </h1>
        <Button
          ref={renameButton}
          size="sm"
          variant="ghost"
          icon={<Pencil aria-hidden className="size-3.5" />}
          onClick={() => setDraft(title)}
          className="mb-1.5"
          data-testid="song-rename"
        >
          Rename
        </Button>
      </div>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor={fieldId} className="sr-only">
        Song title
      </label>
      <input
        id={fieldId}
        ref={field}
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDraft(null);
        }}
        className="h-12 min-w-[16rem] flex-1 rounded-control border border-control-border bg-control px-3 font-display text-2xl"
        data-testid="song-rename-field"
      />
      <Button type="submit" variant="primary" loading={rename.isPending}>
        Save
      </Button>
      <Button onClick={() => setDraft(null)}>Cancel</Button>
      {error && (
        <p role="alert" className="w-full text-sm text-issue">
          {error}
        </p>
      )}
    </form>
  );
}

/** The style, changed in place. The song stops first: what plays next is in the new style. */
function StyleSwitch({
  unitId,
  flavour,
  playingId,
}: {
  unitId: string;
  flavour: FlavourId;
  playingId: string;
}) {
  const set = useSetSongFlavour();
  // While the change is on its way the song still reads the old style: the line names the one asked for.
  const asked = set.variables?.body.flavour ?? flavour;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <SegmentedControl
        label="Style"
        size="sm"
        value={flavour}
        onChange={(next) => {
          if (next === flavour) return;
          stopSong(playingId);
          set.mutate({ params: { unitId: unitId as UnitId }, body: { flavour: next } });
        }}
        options={SONG_STYLES.map((s) => ({ value: s.id, label: s.name }))}
      />
      <p className="text-xs text-text-3" data-testid="song-style-line">
        {set.isPending
          ? `Changing to ${styleName(asked)}…`
          : "Your lines keep their sound in every style. Oak's parts change."}
      </p>
      {set.isError && (
        <p role="alert" className="text-sm text-issue" data-testid="song-style-error">
          The style is still {styleName(flavour)}: {set.error.message}
        </p>
      )}
    </div>
  );
}

/** Where the song is with the album: Release, Release again, on the album, or what it waits for. */
function AlbumLine({ def, detail }: { def: UnitSongDef; detail: UnitSongDetail }) {
  const offer = releaseOffer(detail);
  const titleOf = useLessonTitles();
  // Once the Release card has shown, it stays for the visit: after a release it becomes the confirmation (with Open it
  // on the album) instead of vanishing with the offer, which also dropped the focus to the page.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (offer === "release" || offer === "again") setShown(true);
  }, [offer]);
  return (
    <section
      aria-labelledby="song-album-h"
      className="flex flex-col gap-3"
      data-testid="song-album"
      data-offer={offer}
    >
      <h2 id="song-album-h" className="text-h3">
        On the album
      </h2>
      {shown || offer === "release" || offer === "again" ? (
        <SongRelease unitId={def.unit} song={def} listen={false} />
      ) : offer === "not-yet" ? (
        <p className="text-text-2" data-testid="song-album-wait">
          You can release this song once you finish {releasePointWords(def.releaseAfter, titleOf)}.
        </p>
      ) : null}
      {detail.releases.length > 0 && (
        <ul className="flex flex-col gap-2">
          {[...detail.releases].reverse().map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2"
              data-testid="song-release-row"
            >
              <ReleasePlayButton unitId={def.unit} release={r.id} label={`Play “${r.title}” as released`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-sm text-text-3">
                  Released {formatDate(r.createdAt)} in {styleName(r.flavour)}
                </p>
              </div>
              {r.albumTrackId ? (
                <Link
                  to="/album/$trackId"
                  params={{ trackId: r.albumTrackId }}
                  search={{ v: r.albumVersion }}
                  className="text-sm text-link underline-offset-2 hover:underline"
                >
                  Open on the album
                </Link>
              ) : (
                <span className="text-sm text-text-3">Removed from the album</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The takes in the order they went in: each lesson, what it holds now, ▶ for the song right after it. */
function TakeHistory({
  def,
  detail,
  view,
  titleOf,
}: {
  def: UnitSongDef;
  detail: UnitSongDetail;
  view: SongView;
  titleOf(id: string): string | null;
}) {
  if (detail.takes.length === 0)
    return (
      <section aria-labelledby="song-history-h" className="flex flex-col gap-2">
        <h2 id="song-history-h" className="text-h3">
          How it grew
        </h2>
        <p className="text-text-2">
          Oak plays all of it so far. Your first Make in this unit adds the first ring.
        </p>
      </section>
    );
  const tones = ringTonesOf(def, detail.takes);
  return (
    <section aria-labelledby="song-history-h" className="flex flex-col gap-3" data-testid="song-history">
      <h2 id="song-history-h" className="text-h3">
        How it grew
      </h2>
      <ol className="relative flex flex-col">
        {detail.takes.map((t, i) => {
          const held = cellsHeldBy(def, detail, t.id);
          const now = cellsSentence(view, held);
          const took = cellsSentence(view, t.cells);
          return (
            <li
              key={t.id}
              className="relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3 py-3"
              data-testid="song-take"
              data-take={t.id}
            >
              {/* the trunk: one ring per take, joined by a thin line */}
              <span aria-hidden className="relative flex h-full justify-center">
                {i < detail.takes.length - 1 && <span className="absolute top-5 -bottom-3 w-px bg-border" />}
                <span
                  className="relative mt-1 size-3.5 rounded-full border-[3px] bg-surface"
                  style={{ borderColor: tones[i] }}
                />
              </span>
              <div className="min-w-0">
                <p className="font-medium">{titleOf(t.lessonId) ?? t.lessonId}</p>
                <p className="text-sm text-text-2">
                  {now
                    ? `${now}${took && took !== now ? ` (it took ${took})` : ""}`
                    : took
                      ? `It took ${took}; later lessons took all of it over.`
                      : "It holds no block now."}
                </p>
                <p className="text-xs text-text-3">
                  {formatDate(t.createdAt)}
                  {t.backfilled ? " · Oak added it from your Make in that lesson" : ""}
                  {t.reviewBeforeRun ? " · from a backup: checked before it plays" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <SongPlayButton
                  id={takeId(def.unit, t.id)}
                  band={songBandOf(def, detailUpTo(detail, t.id), { flavour: detail.flavour })}
                  label="Play this version"
                  ariaLabel={`Play the song as it was after ${titleOf(t.lessonId) ?? t.lessonId}`}
                  size="sm"
                  variant="ghost"
                  data-testid="song-take-play"
                />
                <Link
                  to="/studio/$sketchId"
                  params={{ sketchId: t.sketchId }}
                  className="text-sm text-link underline-offset-2 hover:underline"
                >
                  Code
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** What the song waits for, in words: a lesson by its title, a checkpoint as the unit's checkpoint. */
export function releasePointWords(id: string, titleOf: (id: string) => string | null): string {
  if (/\.CP$/.test(id)) return "this unit's checkpoint";
  const title = titleOf(id);
  return title ? `“${title}”` : "the last lesson of this unit";
}
