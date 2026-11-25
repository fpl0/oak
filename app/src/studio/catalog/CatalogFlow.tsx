// Oak 2.0 W3 (PLAN §4 S6, "Catalog of Attributes"; "Outside your lane"): the flow that makes a catalog.
//  1. Pick a reference: a unit song (played with the song player, Oak's own version), one of the learner's
//     transcription projects, or one of their audio files. "Outside your lane" instead asks for a style the learner
//     usually skips and a track its fans love, in their own words (Oak never plays or reads it).
//  2. Listen, then write the six lines (each optional, at most 400 characters).
//  3. "Hide it and write" stops the reference, starts a sketch whose code holds the lines as comments and saves the
//     catalog naming it; "Save the lines only" saves the catalog alone.
// The flow shows no analysis of the reference at any step (W3 fidelity rule 2): Oak's reading of a unit song is shown
// only in the sketch, beside the learner's lines, once it is written (CatalogLines).
import { CATALOG_LINES, type Catalog, type UnitSongDef } from "@oak/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { unitSongById, unitSongs } from "../../../../content/unit-songs/index.ts";
import { errorWords } from "../../lib/error-words.ts";
import { audioUrl, useProfile, useSketchCreate, useTranscriptions } from "../../lib/queries.ts";
import { currentSessionId } from "../../session/store.ts";
import { songBandOf } from "../../song/model.ts";
import { stopSong } from "../../song/player.ts";
import { SongPlayButton } from "../../song/SongPlayButton.tsx";
import { Button, buttonClass } from "../../ui/kit/Button.tsx";
import { Card } from "../../ui/kit/basics.tsx";
import { SegmentedControl } from "../../ui/kit/Controls.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { OAK_DEFAULTS, studioFlavour } from "../model.ts";
import { useCatalogCreate } from "./catalog-queries.ts";
import {
  bpmFromLine,
  CATALOG_LINE_MAX,
  CATALOG_WORDS,
  type CatalogLines,
  type CatalogRefKind,
  catalogSketchBody,
  cleanLines,
  emptyLines,
  LINE_LABELS,
  LINE_PROMPTS,
  outsideRefId,
} from "./model.ts";

export type CatalogMode = "reference" | "outside";
type PickKind = Exclude<CatalogRefKind, "outside">;

/** A reference the learner can pick: what to call it and, for a file, the audio to play. */
export interface RefChoice {
  kind: CatalogRefKind;
  id: string;
  title: string;
  /** The learner's audio file (`audio.get`), when the reference has one. */
  audioId: string | null;
  /** A transcription project to open (its own player). */
  projectId: string | null;
  song: UnitSongDef | null;
}

/** Every reference of a kind the learner can pick, in a stable order. */
export function useRefChoices(): Record<PickKind, RefChoice[]> {
  const tr = useTranscriptions();
  const items = tr.data?.items ?? [];
  const song: RefChoice[] = unitSongs.map((def) => ({
    kind: "song",
    id: def.id,
    title: def.title,
    audioId: null,
    projectId: null,
    song: def,
  }));
  const transcription: RefChoice[] = items.map((t) => ({
    kind: "transcription",
    id: t.id,
    title: t.artist ? `${t.title} (${t.artist})` : t.title,
    audioId: t.audioId,
    projectId: t.id,
    song: null,
  }));
  // There is no list of audio files: the learner's files are the ones their transcriptions play.
  const seen = new Set<string>();
  const audio: RefChoice[] = [];
  for (const t of items) {
    if (t.audioId === null || seen.has(t.audioId)) continue;
    seen.add(t.audioId);
    audio.push({
      kind: "audio",
      id: t.audioId,
      title: t.title,
      audioId: t.audioId,
      projectId: null,
      song: null,
    });
  }
  return { song, transcription, audio };
}

/** The reference a catalog names, as the learner knows it. */
export function useRefOf(c: Pick<Catalog, "refKind" | "refId">): RefChoice {
  const choices = useRefChoices();
  if (c.refKind === "outside")
    return { kind: "outside", id: c.refId, title: c.refId, audioId: null, projectId: null, song: null };
  const found = choices[c.refKind].find((x) => x.id === c.refId);
  if (found) return found;
  const def = c.refKind === "song" ? (unitSongById.get(c.refId as never) ?? null) : null;
  return {
    kind: c.refKind,
    id: c.refId,
    title: def?.title ?? CATALOG_WORDS.refOf(c.refKind),
    audioId: c.refKind === "audio" ? c.refId : null,
    projectId: null,
    song: def,
  };
}

/** The id the song player plays a catalog's unit song under. */
export const catalogSongPlayId = (songId: string): string => `catalog:${songId}`;

/** Plays the reference: a unit song through the song player (Oak's own version), a file in an audio element. */
export function ReferencePlayer({ choice }: { choice: RefChoice }) {
  const profile = useProfile();
  if (choice.song) {
    const band = songBandOf(choice.song, null, { flavour: studioFlavour(profile.data?.flavour) });
    return (
      <SongPlayButton
        id={catalogSongPlayId(choice.song.id)}
        band={band}
        label={`Play “${choice.song.title}”`}
        data-testid="catalog-play"
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {choice.audioId ? (
        // biome-ignore lint/a11y/useMediaCaption: the learner's own recording has no captions to offer.
        <audio
          controls
          preload="none"
          src={audioUrl(choice.audioId)}
          className="w-full"
          data-testid="catalog-audio"
        />
      ) : null}
      {choice.projectId ? (
        <Link
          to="/transcribe/$projectId"
          params={{ projectId: choice.projectId }}
          className={buttonClass("ghost", "sm", "self-start")}
        >
          {CATALOG_WORDS.openPlayer}
        </Link>
      ) : null}
    </div>
  );
}

/** The six line fields. */
export function LineFields({
  lines,
  onChange,
  outside,
}: {
  lines: CatalogLines;
  onChange(lines: CatalogLines): void;
  outside: boolean;
}) {
  const ids = useId();
  return (
    <div className="flex flex-col gap-3">
      {outside ? <p className="text-sm text-text-2">{CATALOG_WORDS.outsideLines}</p> : null}
      {CATALOG_LINES.map((k) => (
        <label key={k} className="flex flex-col gap-1 text-sm" htmlFor={`${ids}-${k}`}>
          <span className="font-medium text-text-2">{LINE_LABELS[k]}</span>
          <input
            id={`${ids}-${k}`}
            value={lines[k]}
            maxLength={CATALOG_LINE_MAX}
            placeholder={LINE_PROMPTS[k]}
            onChange={(e) => onChange({ ...lines, [k]: e.target.value })}
            className="h-9 rounded-control border border-border bg-surface px-2 text-base text-text"
            data-testid={`catalog-line-${k}`}
          />
        </label>
      ))}
    </div>
  );
}

/** Writes a sketch from the lines, then the catalog naming it, and opens the sketch. */
export function useWriteFromLines() {
  const navigate = useNavigate();
  const createSketch = useSketchCreate();
  const createCatalog = useCatalogCreate();
  const [busy, setBusy] = useState(false);
  const write = async (o: {
    refKind: CatalogRefKind;
    refId: string;
    refTitle: string;
    lines: CatalogLines;
  }): Promise<boolean> => {
    setBusy(true);
    try {
      const lines = cleanLines(o.lines);
      const saved = await createSketch.mutateAsync({
        body: catalogSketchBody({
          lines,
          refTitle: o.refTitle,
          title: CATALOG_WORDS.sketchTitle(o.refTitle),
          sessionId: currentSessionId(),
          bpm: bpmFromLine(lines.tempo) ?? OAK_DEFAULTS.bpm,
          meter: OAK_DEFAULTS.meter,
        }),
      });
      await createCatalog.mutateAsync({
        body: { refKind: o.refKind, refId: o.refId, lines, sketchId: saved.sketch.id },
      });
      void navigate({ to: "/studio/$sketchId", params: { sketchId: saved.sketch.id } });
      return true;
    } catch (e) {
      toast.error(CATALOG_WORDS.saveFailed, errorWords(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { write, busy };
}

export function CatalogFlow({ mode, onClose }: { mode: CatalogMode; onClose(): void }) {
  const outside = mode === "outside";
  const choices = useRefChoices();
  const [kind, setKind] = useState<PickKind>("song");
  const [refId, setRefId] = useState<string>("");
  const [style, setStyle] = useState("");
  const [track, setTrack] = useState("");
  const [lines, setLines] = useState<CatalogLines>(emptyLines);
  const createCatalog = useCatalogCreate();
  const { write, busy } = useWriteFromLines();
  const ids = useId();

  const list = choices[kind];
  const choice: RefChoice | null = outside ? null : (list.find((c) => c.id === refId) ?? null);
  const outsideId = outside ? outsideRefId(style, track) : null;
  const ref: { kind: CatalogRefKind; id: string; title: string } | null = outside
    ? outsideId
      ? { kind: "outside", id: outsideId, title: outsideId }
      : null
    : choice
      ? { kind: choice.kind, id: choice.id, title: choice.title }
      : null;

  const stop = () => {
    if (choice?.song) stopSong(catalogSongPlayId(choice.song.id));
  };
  const close = () => {
    stop();
    onClose();
  };
  const hideAndWrite = async () => {
    if (!ref) return;
    stop();
    await write({ refKind: ref.kind, refId: ref.id, refTitle: ref.title, lines });
  };
  const linesOnly = async () => {
    if (!ref) return;
    try {
      await createCatalog.mutateAsync({
        body: { refKind: ref.kind, refId: ref.id, lines: cleanLines(lines), sketchId: null },
      });
      toast.success(CATALOG_WORDS.saved);
      close();
    } catch (e) {
      toast.error(CATALOG_WORDS.saveFailed, errorWords(e));
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-4" data-testid="catalog-flow" data-mode={mode}>
      <div>
        <h2 className="text-h3">{outside ? CATALOG_WORDS.outsideStart : CATALOG_WORDS.start}</h2>
        <p className="mt-0.5 text-sm text-text-2">
          {outside ? CATALOG_WORDS.outsideIntro : CATALOG_WORDS.intro}
        </p>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby={`${ids}-pick`}>
        <h3 id={`${ids}-pick`} className="font-medium">
          {CATALOG_WORDS.pickHeading}
        </h3>
        {outside ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-2">{CATALOG_WORDS.outsideStyle}</span>
              <input
                value={style}
                maxLength={90}
                onChange={(e) => setStyle(e.target.value)}
                className="h-9 rounded-control border border-border bg-surface px-2 text-base text-text"
                data-testid="outside-style"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-2">{CATALOG_WORDS.outsideTrack}</span>
              <input
                value={track}
                maxLength={100}
                onChange={(e) => setTrack(e.target.value)}
                className="h-9 rounded-control border border-border bg-surface px-2 text-base text-text"
                data-testid="outside-track"
              />
            </label>
          </div>
        ) : (
          <>
            <SegmentedControl<PickKind>
              label="Reference"
              size="sm"
              value={kind}
              options={[
                { value: "song", label: CATALOG_WORDS.kindSong },
                { value: "transcription", label: CATALOG_WORDS.kindTranscription },
                { value: "audio", label: CATALOG_WORDS.kindAudio },
              ]}
              onChange={(k) => {
                stop();
                setKind(k);
                setRefId("");
              }}
            />
            {list.length === 0 ? (
              <p className="text-sm text-text-2">{CATALOG_WORDS.noneOfKind}</p>
            ) : (
              <select
                aria-label={CATALOG_WORDS.pickHeading}
                value={refId}
                onChange={(e) => {
                  stop();
                  setRefId(e.target.value);
                }}
                className="h-9 rounded-control border border-border bg-surface px-2 text-text"
                data-testid="catalog-ref"
              >
                <option value="">…</option>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </section>

      {ref ? (
        <section className="flex flex-col gap-3" aria-labelledby={`${ids}-listen`}>
          <h3 id={`${ids}-listen`} className="font-medium">
            {CATALOG_WORDS.listenHeading}
          </h3>
          {choice ? (
            <>
              <p className="text-sm text-text-2">{CATALOG_WORDS.listenFirst}</p>
              <ReferencePlayer choice={choice} />
            </>
          ) : null}
          <LineFields lines={lines} onChange={setLines} outside={outside} />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          {CATALOG_WORDS.cancel}
        </Button>
        <Button
          variant="secondary"
          disabled={!ref || busy}
          loading={createCatalog.isPending && !busy}
          onClick={() => void linesOnly()}
          data-testid="catalog-lines-only"
        >
          {CATALOG_WORDS.linesOnly}
        </Button>
        <Button
          variant="primary"
          disabled={!ref}
          loading={busy}
          onClick={() => void hideAndWrite()}
          data-testid="catalog-hide-and-write"
        >
          {CATALOG_WORDS.hideAndWrite}
        </Button>
      </div>
    </Card>
  );
}
