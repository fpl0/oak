// Release to album (ux §2.3, §5.3): the track's title, the learner's one line, Claude's liner note (only with
// consent), the liner notes the analysis writes, then the performance recorded in real time through the
// @oak/strudel recorder, a listen-back, and the release. The flow is `releaseMachine`.
import type {
  AnalysisSummary,
  CapstoneDef,
  CapstoneReview,
  CapstoneState,
  FlavourId,
  KeySpec,
} from "@oak/api";
import type { Normalized } from "@oak/grader";
import type { EditorHandle } from "@oak/strudel";
import { useMachine } from "@xstate/react";
import { Disc3, Mic2, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fromPromise } from "xstate";
import { ALBUM_TITLE_MAX, DEFAULT_ALBUM_TITLE, useAlbumTitle } from "../album/title.ts";
import { useAlbum } from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Progress } from "../ui/kit/basics.tsx";
import { Callout, SegmentedControl } from "../ui/kit/Controls.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { Switch } from "../ui/kit/Field.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { useWorkbenchServices } from "../workbench/services.tsx";
import type { CeremonyData } from "./Ceremony.tsx";
import { FLAVOUR_TITLE } from "./content.ts";
import { recordPerformance, releaseTrack } from "./engine.ts";
import { LINER_MAX_WORDS, wordCount } from "./liner.ts";
import { clock } from "./piece.ts";
import { type ReleaseActorInput, releaseMachine } from "./release-machine.ts";
import { releaseErrorText } from "./release-text.ts";

/** Oak 2.0 W4 F6: releasing to the Shelf, in words (each one passes `isDescriptive`). */
export const SHELF_RELEASE_COPY = {
  label: "Put it on the Shelf, not on the album",
  line: "A piece on the Shelf counts as finished and opens what a release opens; it stays off the album.",
  released: "On the Shelf: finished, and kept off the album.",
} as const;

/** The checked piece being released: its code and saved version, its first pass and its analysis. */
export interface ReleasePiece {
  code: string;
  version: number;
  bars: number;
  n: Normalized | null;
  analysis: AnalysisSummary | null;
  key: KeySpec | null;
}

export interface ReleaseDialogProps {
  def: CapstoneDef;
  state: CapstoneState;
  official: ReleasePiece;
  /** The flavour the track carries on the album (its cover's wood); `null` for a transcription. */
  flavour: FlavourId | null;
  /** Flavours the learner may choose at release; absent or one: no choice shown. */
  shipping?: readonly FlavourId[];
  sessionId: string | null;
  sketchId: string;
  review: CapstoneReview | null;
  includeReviewDefault: boolean;
  /** The liner notes (≤ 60 words) for the learner's one line. */
  notesFor(line: string): string;
  /** Theory tags for the album (≤ 12). */
  tags: readonly string[];
  defaultTitle: string;
  editor(): EditorHandle | null;
  onClose(): void;
  onReleased(data: CeremonyData): void;
}

const canRecord = () => typeof MediaRecorder !== "undefined";

export function ReleaseDialog(p: ReleaseDialogProps) {
  const { oak } = useWorkbenchServices();
  const outcome = p.official;
  const analysis = outcome.analysis;
  const notesFor = p.notesFor;
  const tags = [...p.tags];
  // The album gets its name at its first release (ux §5.3), editable later on /album.
  const album = useAlbumTitle();
  // The album is named with its first track only: a learner who kept "Oak Sessions" is not asked again on track 11.
  const albumQ = useAlbum();
  const albumTracks = albumQ.data?.tracks.length;
  const namesAlbum = p.state.trackId === null && !album.named && albumTracks === 0;
  // Oak 2.0 W4 F6: a revision of a track on the Shelf starts with "Put it on the Shelf" ticked.
  const onShelfNow =
    p.state.trackId !== null && (albumQ.data?.shelf ?? []).some((t) => t.id === p.state.trackId);
  const onShelfRef = useRef(onShelfNow);
  onShelfRef.current = onShelfNow;
  const [albumName, setAlbumName] = useState(album.title);
  const [flavour, setFlavour] = useState<FlavourId | null>(p.flavour);
  const flavourRef = useRef(flavour);
  flavourRef.current = flavour;
  const albumNameRef = useRef<string | null>(null);
  albumNameRef.current = namesAlbum ? albumName : null;

  // Stop (or Esc, or leaving the page) during a take cancels the recorder: the take is dropped, the piece stops.
  const stopped = useRef(false);
  const [snapshot, send] = useMachine(
    releaseMachine.provide({
      actors: {
        record: fromPromise(async () => {
          const handle = p.editor();
          if (!handle || handle.disposed)
            throw new Error("The editor isn't ready yet. Try again in a moment.");
          if (handle.getCode() !== p.official.code)
            throw new Error(
              "The code changed since the check. Close this, check your track again, then release.",
            );
          stopped.current = false;
          try {
            return await recordPerformance(oak, handle, outcome.bars);
          } catch (e) {
            if (stopped.current) throw new Error("Recording stopped. Record again when you're ready.");
            throw e;
          }
        }),
        release: fromPromise(async ({ input }: { input: ReleaseActorInput }) => {
          const out = await releaseTrack({
            def: p.def,
            state: p.state,
            sessionId: p.sessionId,
            sketchId: p.sketchId,
            sketchVersion: p.official.version,
            title: input.title,
            flavour: flavourRef.current,
            linerNotesMd: notesFor(input.line),
            theoryTags: tags,
            includeReviewNote: input.includeReviewNote && p.review !== null,
            shelved: input.shelved ?? onShelfRef.current,
            reviewNote: p.review?.linerNote ?? null,
            recording: input.recording,
            otherTakes: input.otherTakes,
          }).catch((e: unknown) => {
            throw new Error(releaseErrorText(e, input.recording !== null));
          });
          const name = albumNameRef.current?.trim();
          if (name && name !== DEFAULT_ALBUM_TITLE) await album.set(name).catch(() => {});
          if (out.track.shelved === true) toast.success(SHELF_RELEASE_COPY.released);
          const music = outcome.n
            ? {
                events: outcome.n.all,
                bars: outcome.bars,
                key: outcome.key,
                bpm: analysis?.bpm ?? null,
                flavour: flavourRef.current,
                slots: analysis?.slots ?? [],
              }
            : null;
          p.onReleased({
            trackId: out.track.id,
            capstoneId: p.def.id,
            title: out.track.title,
            side: out.track.side,
            trackNo: out.track.trackNo,
            version: out.version,
            coverSeed: out.track.coverSeed,
            music,
            linerNotes:
              out.track.versions.find((v) => v.version === out.version)?.linerNotesMd ?? notesFor(input.line),
            audioError: out.audioError,
            recorded: input.recording !== null,
          });
          return { trackId: out.track.id, version: out.version, audioError: out.audioError };
        }),
      },
    }),
    { input: { title: p.defaultTitle, line: "", includeReviewNote: p.includeReviewDefault } },
  );
  const ctx = snapshot.context;
  const phase = snapshot.value as "details" | "recording" | "take" | "releasing" | "released";
  const busy = phase === "recording" || phase === "releasing";
  const stopTake = () => {
    if (!oak.recorder.recording) return;
    stopped.current = true;
    oak.recorder.cancel();
  };
  const recordingNow = useRef(false);
  useEffect(() => {
    recordingNow.current = phase === "recording";
  }, [phase]);
  useEffect(
    () => () => {
      if (recordingNow.current && oak.recorder.recording) {
        stopped.current = true;
        oak.recorder.cancel();
      }
    },
    [oak],
  );

  // Listen back to the take.
  const [takeUrl, setTakeUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!ctx.recording) {
      setTakeUrl(null);
      return;
    }
    const url = URL.createObjectURL(ctx.recording.blob);
    setTakeUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [ctx.recording]);

  // The button that started a phase unmounts with it: focus goes to the phase's next action (Stop while
  // recording, Release once the take is in), never out of the dialog to the page.
  const stopRef = useRef<HTMLButtonElement>(null);
  const releaseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const to = phase === "recording" ? stopRef.current : phase === "take" ? releaseRef.current : null;
    to?.focus({ preventScroll: true });
  }, [phase]);

  // Recording progress against the piece's computed length.
  const expected = (analysis?.durationSec ?? 10) + 1.5;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "recording") return;
    const t0 = performance.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed((performance.now() - t0) / 1000), 250);
    return () => clearInterval(t);
  }, [phase]);

  const isNew = p.state.trackId === null;
  return (
    <Dialog
      open
      onClose={() => {
        if (phase === "releasing") return;
        if (phase === "recording") stopTake();
        p.onClose();
      }}
      title={isNew ? "Release to the album" : "Release a new version"}
      description={
        isNew
          ? "Name the track, add a line for the liner notes, and record the performance."
          : "The album keeps every version; this one becomes the current one."
      }
      className="w-[min(94vw,36rem)]"
      footer={
        phase === "take" || (phase === "releasing" && ctx.recording) ? (
          <>
            <Button
              variant="ghost"
              icon={<RotateCcw aria-hidden className="size-4" />}
              disabled={busy}
              onClick={() => send({ type: "RECORD" })}
            >
              Record another take
            </Button>
            <Button
              ref={releaseRef}
              variant="primary"
              loading={phase === "releasing"}
              icon={<Disc3 aria-hidden className="size-4" />}
              onClick={() => send({ type: "RELEASE" })}
              data-testid="confirm-release"
            >
              Release
            </Button>
          </>
        ) : (
          <>
            {!canRecord() && (
              <Button disabled={busy} onClick={() => send({ type: "RELEASE_WITHOUT_AUDIO" })}>
                Release without a recording
              </Button>
            )}
            {phase === "recording" && (
              <Button
                ref={stopRef}
                icon={<Square aria-hidden className="size-4" />}
                onClick={stopTake}
                data-testid="stop-take"
              >
                Stop
              </Button>
            )}
            <Button
              variant="primary"
              loading={busy}
              disabled={!canRecord() || ctx.title.trim() === ""}
              icon={<Mic2 aria-hidden className="size-4" />}
              onClick={() => send({ type: "RECORD" })}
              data-testid="record-take"
            >
              Record the performance
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="rel-title" className="font-medium">
            Title
          </label>
          <input
            id="rel-title"
            value={ctx.title}
            maxLength={120}
            disabled={busy}
            onChange={(e) => send({ type: "EDIT", patch: { title: e.target.value } })}
            className="h-9 rounded-control border border-border bg-surface px-2"
          />
        </div>
        {flavour !== null && (p.shipping?.length ?? 0) > 1 && (
          <div className="grid gap-1.5">
            <span className="font-medium" id="rel-flavour-label">
              Style
            </span>
            <SegmentedControl<FlavourId>
              label="Style"
              size="sm"
              value={flavour}
              options={(p.shipping ?? []).map((f) => ({ value: f, label: FLAVOUR_TITLE[f] }))}
              onChange={(f) => setFlavour(f)}
            />
            <p className="text-sm text-text-3">
              The wood of the cover and the label on the album. The music stays as it is.
            </p>
          </div>
        )}
        {namesAlbum && (
          <div className="grid gap-1.5">
            <label htmlFor="rel-album" className="font-medium">
              Album name
            </label>
            <input
              id="rel-album"
              value={albumName}
              maxLength={ALBUM_TITLE_MAX}
              disabled={busy}
              aria-describedby="rel-album-hint"
              onChange={(e) => setAlbumName(e.target.value)}
              className="h-9 rounded-control border border-border bg-surface px-2"
              data-testid="release-album-name"
            />
            <p id="rel-album-hint" className="text-sm text-text-3">
              Your first track starts the album. Its name is printed on every cover; you can change it later.
            </p>
          </div>
        )}
        <div className="grid gap-1.5">
          <label htmlFor="rel-line" className="font-medium">
            One line for the liner notes <span className="font-normal text-text-3">(optional)</span>
          </label>
          <input
            id="rel-line"
            value={ctx.line}
            maxLength={160}
            disabled={busy}
            placeholder="What you were going for, in your words."
            onChange={(e) => send({ type: "EDIT", patch: { line: e.target.value } })}
            className="h-9 rounded-control border border-border bg-surface px-2"
          />
        </div>
        <div className="flex items-start justify-between gap-3 rounded-card border border-border p-3">
          <div className="min-w-0 text-sm">
            <label className="font-medium" htmlFor="rel-shelf">
              {SHELF_RELEASE_COPY.label}
            </label>
            <p className="mt-0.5 text-text-2">{SHELF_RELEASE_COPY.line}</p>
          </div>
          <Switch
            id="rel-shelf"
            checked={ctx.shelved ?? onShelfNow}
            disabled={busy}
            onChange={(v: boolean) => send({ type: "EDIT", patch: { shelved: v } })}
          />
        </div>
        {p.review ? (
          <div className="flex items-start justify-between gap-3 rounded-card border border-border p-3">
            <div className="min-w-0 text-sm">
              <label className="font-medium" htmlFor="rel-claude">
                Include Claude's liner note
              </label>
              <p className="mt-0.5 text-text-2">“{p.review.linerNote}”</p>
            </div>
            <Switch
              id="rel-claude"
              checked={ctx.includeReviewNote}
              onChange={(v: boolean) => send({ type: "EDIT", patch: { includeReviewNote: v } })}
            />
          </div>
        ) : null}
        <details
          className="rounded-card border border-border bg-surface-2/50 p-3 text-sm"
          data-testid="release-liner"
        >
          <summary className="cursor-pointer font-medium">
            Liner notes{" "}
            <span className="font-normal text-text-3">
              ({wordCount(notesFor(ctx.line))} of {LINER_MAX_WORDS} words; written from the music)
            </span>
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-text-2">
            {notesFor(ctx.line)}
          </pre>
        </details>

        {phase === "recording" && (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-sm font-medium">
              Recording {clock(Math.min(elapsed, expected))} of {clock(expected)}… UI sounds and the mic are
              off.
            </p>
            <Progress value={Math.min(elapsed, expected)} max={expected} label="Recording" />
          </div>
        )}
        {(phase === "take" || (phase === "releasing" && takeUrl)) && takeUrl && (
          <div className="flex flex-col gap-1.5">
            {ctx.takes.length > 1 ? (
              <fieldset className="flex flex-col gap-1" data-testid="release-takes">
                <legend className="text-sm font-medium">
                  Which take plays on the album?{" "}
                  <span className="font-normal text-text-3">Every take is kept with the track.</span>
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {ctx.takes.map((t, i) => (
                    <label
                      key={`${i}-${t.durationS}`}
                      className="flex cursor-pointer items-center gap-1.5 text-sm"
                    >
                      <input
                        type="radio"
                        name="rel-take"
                        className="accent-[var(--oak-accent)]"
                        checked={ctx.chosen === i}
                        disabled={busy}
                        onChange={() => send({ type: "CHOOSE", index: i })}
                      />
                      Take {i + 1} · {clock(t.durationS)}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-sm font-medium">Your take · {clock(ctx.recording?.durationS ?? 0)}</p>
            )}
            {/* biome-ignore lint/a11y/useMediaCaption: an instrumental recording of the learner's own piece. */}
            <audio controls src={takeUrl} className="w-full" data-testid="take-audio" />
          </div>
        )}
        {phase === "releasing" && (
          <p className="text-sm text-text-2" aria-live="polite">
            Putting it on the album…
          </p>
        )}
        {ctx.error && (
          <Callout tone="attention" title="That didn't work">
            {ctx.error}
          </Callout>
        )}
        {!canRecord() && (
          <p className="text-sm text-text-3">
            This browser cannot record audio. The album will show the track without a recording.
          </p>
        )}
      </div>
    </Dialog>
  );
}
