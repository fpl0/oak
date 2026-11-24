// `/album/$trackId?v=` (ux §5.3): the cover (360) and liner notes on the left; the recording, the live code, the
// version timeline with A/B and the revision path on the right. Each version has its own cover.
import type { AlbumTrackDetail, AlbumTrackVersion, CapstoneReview, MeterId, SketchDetail } from "@oak/api";
import { CapstoneReviewSchema, OakApiError } from "@oak/api";
import { editorId } from "@oak/strudel";
import { Link, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Check, Code2, Download, MessageSquareText, Mic2, Pencil, Play, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCapstoneContent } from "../capstone/content.ts";
import { recordingSeconds, recordPerformance } from "../capstone/engine.ts";
import { versionBandOf } from "../capstone/export.ts";
import { PIECE_DOES_NOT_RUN } from "../capstone/record.ts";
import { WorkbenchServicesLoader } from "../capstone/WorkbenchServicesLoader.tsx";
import { FLAVOUR_LABEL, formatDate, formatDuration } from "../lib/format.ts";
import { usePageTitle } from "../lib/nav.ts";
import {
  albumAudioUrl,
  albumTakeUrl,
  useAlbumAddTake,
  useAlbumAttachReview,
  useAlbumChooseTake,
  useAlbumDeleteTrack,
  useAlbumPatchVersion,
  useAlbumPutAudio,
  useAlbumTrack,
  useCourseProgress,
  useSketch,
  useTutorReviews,
} from "../lib/queries.ts";
import { askReview, clearSubject, openTutor, setSubject, showBars } from "../tutor/context.ts";
import { useSubjectHarmony } from "../tutor/use-subject-harmony.ts";
import { AlbumCover } from "../ui/AlbumCover.tsx";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Card, Chip, Page, Skeleton } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { Switch } from "../ui/kit/Field.tsx";
import { ErrorState } from "../ui/kit/QueryState.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import type { WorkbenchModel } from "../workbench/model.ts";
import { useWorkbenchServices } from "../workbench/services.tsx";
import { Workbench } from "../workbench/Workbench.tsx";
import "../workbench/index.ts";
import { sideLabel } from "../capstone/Ceremony.tsx";
import { LINER_MAX_WORDS, wordCount } from "../capstone/liner.ts";
import { ReviewCard } from "../capstone/ReviewCard.tsx";
import { useTryRevision } from "../capstone/revision.ts";
import { useContent } from "../lib/content.ts";
import { ReleasePlayButton } from "../song/AlbumSongs.tsx";
import { useUnitSongs } from "../song/hooks.ts";
import { SongReleaseCover } from "../song/SongCover.tsx";
import { songReleaseOfVersion, songTracksOf, styleName } from "../song/surfaces-model.ts";
import { bandReached } from "../studio/model.ts";
import { LinerNotes } from "./AlbumPage.tsx";
import { ExportButton } from "./ExportButton.tsx";
import { audioFileName, changeSummary, currentTakeOf, takeFileName, takesOf } from "./model.ts";
import { useCoverMusic } from "./music.ts";

export function TrackPage({ trackId, v }: { trackId: string; v: number | undefined }) {
  const track = useAlbumTrack(trackId);
  usePageTitle(track.data?.title ?? "Track");
  if (track.isError)
    return (
      <Page>
        <ErrorState error={track.error} onRetry={() => void track.refetch()} />
      </Page>
    );
  if (!track.data)
    return (
      <Page>
        <div
          className="grid gap-8 lg:grid-cols-[360px_1fr]"
          role="status"
          aria-busy="true"
          aria-label="Loading the track"
        >
          <Skeleton className="aspect-square w-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-72" />
            <Skeleton className="mt-4 h-12 w-full" />
          </div>
        </div>
      </Page>
    );
  return <Track t={track.data} v={v} />;
}

function Track({ t, v }: { t: AlbumTrackDetail; v: number | undefined }) {
  const navigate = useNavigate();
  const del = useAlbumDeleteTrack();
  const version = t.versions.find((x) => x.version === (v ?? t.currentVersion)) ?? t.versions.at(-1);
  const sketch = useSketch(version?.sketchId ?? "none");
  const codeOf = (x: AlbumTrackVersion | undefined) =>
    x ? (sketch.data?.versions.find((s) => s.version === x.sketchVersion)?.code ?? null) : null;
  const code = codeOf(version);
  const { music, pending } = useCoverMusic(
    version ? { sketchId: version.sketchId, sketchVersion: version.sketchVersion } : null,
    t.flavour,
  );
  const review = parseReview(version?.review);
  const [codeOpen, setCodeOpen] = useState(false);
  const tryRevision = useTryRevision();
  const thread = { subjectKind: "track" as const, subjectId: t.id };
  const versionNo = version?.version ?? null;
  // A version released from a unit song plays its frozen release (`songs.snapshot`), not its newest take's code.
  const songs = useUnitSongs();
  const songRelease = versionNo === null ? null : songReleaseOfVersion(songs.data?.items, t.id, versionNo);
  // The track is a unit song's (any of its versions is a release): it is named as the unit's song, not as a B-side.
  const songTrack = songTracksOf(songs.data?.items).get(t.id) ?? null;
  const content = useContent();
  const unitTitle = songTrack
    ? (content.data?.syllabus?.units.find((u) => u.id === songTrack.unitId)?.title ?? null)
    : null;

  // The tutor's subject is this version: a review asked here is about it and is kept with it (contracts §10.6).
  useEffect(() => {
    setSubject({
      thread,
      title: t.title,
      tutorOpen: true,
      ...(code ? { code } : {}),
      ...(versionNo !== null ? { albumTrackId: t.id, albumVersion: versionNo } : {}),
    });
    return () => clearSubject(thread);
  }, [t.id, t.title, code, versionNo]);
  const onModel = useSubjectHarmony(thread);

  // A bar link opens the code (roll and staff) and lights those bars there once the Workbench has read the piece.
  const pendingBars = useRef<[number, number] | null>(null);
  const modelReady = useRef(false);
  const onBars = (from: number, to: number) => {
    if (codeOpen && modelReady.current) {
      showBars(thread, from, to);
      return;
    }
    pendingBars.current = [from, to];
    setCodeOpen(true);
  };
  const onLiveModel = (m: Parameters<typeof onModel>[0]) => {
    onModel(m);
    modelReady.current = true;
    const p = pendingBars.current;
    if (!p) return;
    pendingBars.current = null;
    // The roll and the staff draw on the next frame; the highlight then has notes to light.
    setTimeout(() => showBars(thread, p[0], p[1]), 50);
  };

  if (!version) return null;
  return (
    <Page>
      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {songRelease ? (
            <SongReleaseCover
              unitId={songRelease.unitId}
              releaseId={songRelease.releaseId}
              size={360}
              label={`The cover of “${t.title}”: one ring for each lesson's Make in it`}
            />
          ) : (
            <AlbumCover seed={t.coverSeed} title={t.title} music={music} loading={pending} size={360} />
          )}
          {version.theoryTags.length > 0 && (
            <ul aria-label="Theory used" className="flex flex-wrap gap-1.5">
              {version.theoryTags.map((tag) => (
                <li key={tag}>
                  <Chip>{tag}</Chip>
                </li>
              ))}
            </ul>
          )}
          <LinerCard track={t} version={version} review={review} />
          <ReviewPanel
            track={t}
            version={version}
            review={review}
            code={code}
            onBars={onBars}
            tryPending={tryRevision.pending}
            onTry={(i) => {
              const rev = review?.revisions[i];
              if (rev && code)
                void tryRevision.open({
                  trackTitle: t.title,
                  code,
                  meter:
                    sketch.data?.versions.find((x) => x.version === version.sketchVersion)?.meter ?? null,
                  rev,
                });
            }}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <header>
            <p className="text-sm text-text-3" data-testid="track-eyebrow">
              {songTrack
                ? `Song${unitTitle ? ` · ${unitTitle}` : ""}`
                : `${sideLabel(t.side)} · track ${t.trackNo}`}
            </p>
            <h1 className="font-display text-h1">{t.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              {t.flavour && (
                <Chip>{songTrack ? styleName(t.flavour) : (FLAVOUR_LABEL[t.flavour] ?? t.flavour)}</Chip>
              )}
              <Chip tone={version.version === t.currentVersion ? "accent" : "neutral"}>
                {t.capstoneId === "AC1" && version.version <= 2
                  ? `${version.version === 1 ? "Version one" : "Version two"} (album version ${version.version})`
                  : `Version ${version.version}`}
                {version.version === t.currentVersion ? " · current" : ` of ${t.versions.length}`}
              </Chip>
              {version.tutorAssisted && <Chip tone="amber">tutor-assisted</Chip>}
              <span className="text-sm text-text-3">{formatDate(version.createdAt, true)}</span>
            </p>
          </header>

          <section aria-labelledby="trk-listen" className="flex flex-col gap-2">
            <h2 id="trk-listen" className="text-h3">
              Listen
            </h2>
            {songRelease && (
              <div className="flex flex-wrap items-center gap-3" data-testid="track-song-release">
                <ReleasePlayButton
                  unitId={songRelease.unitId}
                  release={songRelease.releaseId}
                  label={`Play version ${version.version} as released`}
                />
                <p className="min-w-0 flex-1 text-text-2">
                  Your song as you released it: Oak's band and every one of your Makes in it.
                </p>
                <Link
                  to="/song/$unitId"
                  params={{ unitId: songRelease.unitId }}
                  className={buttonClass("ghost", "sm")}
                >
                  Open the song
                </Link>
              </div>
            )}
            {version.hasAudio ? (
              <Listen key={`${t.id}-${version.version}`} track={t} version={version} />
            ) : songRelease ? null : (
              <p className="text-text-2">
                {!pending &&
                music === null &&
                code !== null &&
                !sketch.data?.versions.find((x) => x.version === version?.sketchVersion)?.flags
                  .reviewBeforeRun
                  ? "No recording of this version, and its code no longer runs (below)."
                  : "No recording of this version yet. Open the code below to play it live and record it."}
              </p>
            )}
            <ExportButton
              trackId={t.id}
              version={version.version}
              capstoneId={t.capstoneId}
              song={songRelease !== null}
            />
          </section>

          {/* A song version's code is the whole song (Oak's and every take): the song page shows it, not one take. */}
          {!songRelease && (
            <CodeSection
              track={t}
              version={version}
              code={code}
              sketch={sketch.data}
              open={codeOpen}
              onOpen={() => setCodeOpen(true)}
              onModel={onLiveModel}
            />
          )}

          <Versions
            track={t}
            selected={version.version}
            sketch={sketch.data}
            songOf={(n) => songReleaseOfVersion(songs.data?.items, t.id, n)}
          />

          <section
            aria-labelledby="trk-next"
            className="flex flex-wrap items-center gap-2 border-t border-border pt-5"
          >
            <h2 id="trk-next" className="sr-only">
              Revise
            </h2>
            {t.capstoneId ? (
              <Link to="/capstone/$id" params={{ id: t.capstoneId }} className={buttonClass("primary")}>
                <Pencil aria-hidden className="size-4" /> Revise and release version {t.versions.length + 1}
              </Link>
            ) : songTrack ? null : t.sketchId ? (
              <Link
                to="/studio/$sketchId"
                params={{ sketchId: t.sketchId }}
                className={buttonClass("secondary")}
              >
                Open the sketch
              </Link>
            ) : null}
            <Button
              variant="ghost"
              icon={<Trash2 aria-hidden className="size-4" />}
              onClick={async () => {
                try {
                  const r = await del.mutateAsync({
                    target: t.id,
                    question: `Remove “${t.title}” and its ${t.versions.length} ${t.versions.length === 1 ? "version" : "versions"} from the album? This cannot be undone.`,
                    input: { params: { id: t.id } },
                  });
                  if (r) void navigate({ to: "/album" });
                } catch (e) {
                  toast.error("Couldn't remove the track", e instanceof Error ? e.message : undefined);
                }
              }}
            >
              Remove from album
            </Button>
          </section>
        </div>
      </div>
    </Page>
  );
}

/**
 * The recording of a version and its takes (d20): the chosen take plays by default; an older one can be heard,
 * chosen again and downloaded. Nothing is ever deleted here.
 */
function Listen({ track, version }: { track: AlbumTrackDetail; version: AlbumTrackVersion }) {
  const choose = useAlbumChooseTake();
  const takes = takesOf(version);
  const current = currentTakeOf(version);
  const [heard, setHeard] = useState<number | null>(null);
  const take = heard !== null && takes.some((x) => x.take === heard) ? heard : current;
  const audio = useRef<HTMLAudioElement>(null);
  const autoplay = useRef(false);
  const several = takes.length > 1;
  const mime = takes.find((x) => x.take === take)?.audioMime ?? version.audioMime;
  // The current take is the plain URL (what the album and an export use); another take is asked for by number.
  const src =
    take === null || take === current
      ? albumAudioUrl(track.id, version.version)
      : albumTakeUrl(track.id, version.version, take);
  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: an instrumental recording of the learner's own piece. */}
      <audio
        ref={audio}
        // A take recorded or chosen a moment ago is another file at the same address.
        key={`${src}#${take ?? 0}#${takes.length}`}
        controls
        preload="metadata"
        src={src}
        className="w-full"
        data-testid="track-audio"
        data-take={take ?? ""}
        onCanPlay={(e) => {
          if (!autoplay.current) return;
          autoplay.current = false;
          void e.currentTarget.play().catch(() => {});
        }}
      />
      <a
        href={src}
        download={
          take === null
            ? audioFileName(track.title, version.version, mime)
            : takeFileName(track.title, version.version, take, mime, takes.length)
        }
        className={buttonClass("ghost", "sm", "self-start")}
        data-testid="download-audio"
      >
        <Download aria-hidden className="size-4" /> Download {several ? `take ${take}` : "the recording"}
      </a>
      {several && (
        <div className="flex flex-col gap-1" data-testid="takes">
          <h3 className="font-sans text-sm font-semibold text-text-2">
            Takes of version {version.version}{" "}
            <span className="font-normal text-text-3">· every take is kept</span>
          </h3>
          <ol className="flex flex-col gap-1">
            {[...takes].reverse().map((x) => {
              const isCurrent = x.take === current;
              const isHeard = x.take === take;
              return (
                <li
                  key={x.take}
                  data-take={x.take}
                  data-current={isCurrent ? "true" : "false"}
                  className={clsx(
                    "flex flex-wrap items-center gap-2 rounded-control border px-2.5 py-1.5 text-sm",
                    isCurrent ? "border-accent/50 bg-lane-in" : "border-border",
                  )}
                >
                  <span className="font-medium">Take {x.take}</span>
                  <span className="text-text-2 tabular-nums">
                    {formatDate(x.recordedAt, true)}
                    {x.durationS ? ` · ${formatDuration(x.durationS)}` : ""}
                  </span>
                  {isCurrent && (
                    <Chip tone="accent">
                      <Check aria-hidden className="size-3.5" /> plays on the album
                    </Chip>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-pressed={isHeard}
                      icon={<Play aria-hidden className="size-3.5" />}
                      onClick={() => {
                        autoplay.current = true;
                        if (isHeard) void audio.current?.play().catch(() => {});
                        else setHeard(x.take);
                      }}
                      data-testid="hear-take"
                    >
                      Hear it
                    </Button>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        loading={choose.isPending && choose.variables?.body.take === x.take}
                        onClick={() =>
                          choose
                            .mutateAsync({
                              params: { id: track.id, v: String(version.version) },
                              body: { take: x.take },
                            })
                            .then(
                              () => toast.success(`Take ${x.take} now plays on the album`),
                              (e: unknown) =>
                                toast.error(
                                  "The take wasn't changed",
                                  e instanceof Error ? e.message : undefined,
                                ),
                            )
                        }
                        data-testid="use-take"
                      >
                        Use this take
                      </Button>
                    )}
                    <a
                      href={albumTakeUrl(track.id, version.version, x.take)}
                      download={takeFileName(track.title, version.version, x.take, x.audioMime, takes.length)}
                      aria-label={`Download take ${x.take}`}
                      title={`Download take ${x.take}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      <Download aria-hidden className="size-4" />
                    </a>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </>
  );
}

function parseReview(raw: unknown): CapstoneReview | null {
  const r = CapstoneReviewSchema.safeParse(raw);
  return r.success ? r.data : null;
}

const notBuilt = (e: unknown) => e instanceof OakApiError && e.code === "not_implemented";

/**
 * The version's liner notes (ux §5.3): written from the music at release, editable here (≤ 60 words is the
 * guide), and Claude's liner note shown only when the learner chooses it for this version (contracts §10.6).
 */
function LinerCard({
  track,
  version,
  review,
}: {
  track: AlbumTrackDetail;
  version: AlbumTrackVersion;
  review: CapstoneReview | null;
}) {
  const patch = useAlbumPatchVersion();
  const note = review?.linerNote ?? null;
  const inNotes = note !== null && version.linerNotesMd.includes(note);
  // A release with Claude's note appends it to the notes; it is shown apart, labelled as Claude's.
  const own = inNotes && note ? version.linerNotesMd.replace(note, "").trim() : version.linerNotesMd;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(own);
  const [include, setInclude] = useState<boolean>(version.includeReviewNote ?? false);
  useEffect(() => {
    setText(own);
    setInclude(version.includeReviewNote ?? false);
    setEditing(false);
  }, [version.version, own, version.includeReviewNote]);
  const words = wordCount(text);
  const save = async (body: { linerNotesMd?: string; includeReviewNote?: boolean }) => {
    try {
      await patch.mutateAsync({ params: { id: track.id, v: String(version.version) }, body });
      return true;
    } catch (e) {
      toast.error(
        notBuilt(e) ? "Editing liner notes is not built yet" : "Couldn't save the liner notes",
        notBuilt(e) ? "The notes stay as they were released." : e instanceof Error ? e.message : undefined,
      );
      return false;
    }
  };
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-h3">Liner notes</h2>
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Pencil aria-hidden className="size-3.5" />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = inNotes && note ? `${text.trim()}\n\n${note}` : text.trim();
            if (await save({ linerNotesMd: body })) setEditing(false);
          }}
        >
          <label htmlFor="liner-edit" className="sr-only">
            Liner notes for version {version.version}
          </label>
          <textarea
            id="liner-edit"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={4000}
            className="rounded-control border border-border bg-surface p-2 text-sm leading-relaxed"
            data-testid="liner-edit"
          />
          <p
            className={clsx("text-sm", words > LINER_MAX_WORDS ? "text-accent-2" : "text-text-3")}
            aria-live="polite"
          >
            {words} words
            {words > LINER_MAX_WORDS ? `; liner notes read best at ${LINER_MAX_WORDS} or fewer` : ""}
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary" loading={patch.isPending}>
              Save notes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setText(own);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <LinerNotes text={own} attribution={version.attribution} />
      )}
      {note && (inNotes || include) && (
        <p className="mt-2 text-text-2" data-testid="claude-liner-note">
          <span className="text-text-3">Claude's listening note: </span>“{note}”
        </p>
      )}
      {note && !inNotes && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <label htmlFor="liner-claude" className="text-text-2">
            Show Claude's liner note on this version
          </label>
          <Switch
            id="liner-claude"
            checked={include}
            onChange={async (v: boolean) => {
              setInclude(v);
              if (!(await save({ includeReviewNote: v }))) setInclude(!v);
            }}
          />
        </div>
      )}
    </Card>
  );
}

/**
 * Claude's review of this version (contracts §10.6), beside the piece: bar links light the roll and the staff,
 * "Try the revision" opens a copy. A version without one can take the capstone's latest unattached review, or
 * ask for one.
 */
function ReviewPanel({
  track,
  version,
  review,
  code,
  onBars,
  onTry,
  tryPending,
}: {
  track: AlbumTrackDetail;
  version: AlbumTrackVersion;
  review: CapstoneReview | null;
  code: string | null;
  onBars(from: number, to: number): void;
  onTry(i: number): void;
  tryPending: boolean;
}) {
  const reviews = useTutorReviews(
    track.capstoneId && !review ? { subjectKind: "capstone", subjectId: track.capstoneId } : null,
  );
  const attach = useAlbumAttachReview();
  const candidate =
    (reviews.data?.items ?? []).find(
      (r) => r.kind === "capstone" && r.track === null && r.at >= version.createdAt,
    ) ?? null;
  if (review)
    return (
      <Card className="p-4" data-testid="track-review">
        <h2 className="mb-2 text-h3">Claude's review</h2>
        <ReviewCard
          review={review}
          onBars={onBars}
          {...(code ? { onTry } : {})}
          tryPending={tryPending}
          headingLevel={3}
          showLinerNote={false}
        />
        <p className="mt-2 text-sm text-text-3">
          “Try the revision” opens a copy in the Studio; this version stays as it is.
        </p>
      </Card>
    );
  if (!track.capstoneId) return null;
  return (
    <Card className="flex flex-col gap-2 p-4 text-sm" data-testid="track-review">
      <h2 className="text-h3">Claude's review</h2>
      {candidate && candidate.kind === "capstone" ? (
        <>
          <p className="text-text-2">
            Claude reviewed this piece after version {version.version} was released. Keep that review with
            this version?
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={attach.isPending}
            onClick={async () => {
              try {
                await attach.mutateAsync({
                  params: { id: track.id, v: String(version.version) },
                  body: {
                    conversationId: candidate.conversationId,
                    review: candidate.review,
                    includeReviewNote: version.includeReviewNote ?? false,
                  },
                });
                toast.success(`The review is kept with version ${version.version}`);
              } catch (e) {
                toast.error("The review wasn't attached", e instanceof Error ? e.message : undefined);
              }
            }}
            data-testid="attach-review"
          >
            Keep it with version {version.version}
          </Button>
        </>
      ) : (
        <>
          <p className="text-text-2">
            No review of this version yet. A review names what works, one revision to try and one question to
            listen for. It never affects pass or fail.
          </p>
          <Button
            size="sm"
            icon={<MessageSquareText aria-hidden className="size-4" />}
            disabled={!code}
            onClick={() => {
              if (!code || !track.capstoneId) return;
              const r = askReview({
                capstoneId: track.capstoneId,
                title: track.title,
                code,
                albumTrackId: track.id,
                albumVersion: version.version,
                released: true,
              });
              if (!r.ok) openTutor();
            }}
            data-testid="track-request-review"
          >
            Ask Claude to review it
          </Button>
        </>
      )}
    </Card>
  );
}

function CodeSection({
  track,
  version,
  code,
  sketch,
  open,
  onOpen,
  onModel,
}: {
  track: AlbumTrackDetail;
  version: AlbumTrackVersion;
  code: string | null;
  sketch: SketchDetail | undefined;
  open: boolean;
  onOpen(): void;
  onModel(m: WorkbenchModel): void;
}) {
  const sv = sketch?.versions.find((s) => s.version === version.sketchVersion);
  const reviewFirst = sv?.flags.reviewBeforeRun === true;
  return (
    <section aria-labelledby="trk-code" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="trk-code" className="text-h3">
          The code
        </h2>
        {!open && (
          <Button icon={<Code2 aria-hidden className="size-4" />} disabled={!code} onClick={onOpen}>
            Play it live
          </Button>
        )}
      </div>
      {open && code && sv && (
        <WorkbenchServicesLoader label="Loading the code">
          {reviewFirst ? (
            <Callout tone="attention" title="Review before running">
              This version came from a backup. Read the code first; it runs once you release it again from the
              capstone.
              <pre className="mt-2 max-h-60 overflow-auto rounded-control bg-surface-2 p-2 font-mono text-sm">
                {code}
              </pre>
            </Callout>
          ) : (
            <LiveCode
              track={track}
              version={version}
              code={code}
              meter={sv.meter ?? "4/4"}
              onModel={onModel}
            />
          )}
        </WorkbenchServicesLoader>
      )}
    </section>
  );
}

/** A released version whose code no longer evaluates: what stays, and what to do. */
const BROKEN_VERSION_TEXT =
  "Its code stops at the error shown below, so it can't be played or recorded here. The cover, the liner notes and any recording stay as they are. To hear it again, use Revise: fix the code and release a new version.";

function LiveCode({
  track,
  version,
  code,
  meter,
  onModel,
}: {
  track: AlbumTrackDetail;
  version: AlbumTrackVersion;
  code: string;
  meter: MeterId;
  onModel(m: WorkbenchModel): void;
}) {
  const { oak } = useWorkbenchServices();
  const put = useAlbumPutAudio();
  const addTake = useAlbumAddTake();
  const { music, pending } = useCoverMusic(
    { sketchId: version.sketchId, sketchVersion: version.sketchVersion },
    track.flavour,
  );
  // The Band the version was released with plays here too (contracts §5.10 rule 5: the album records the Band unless
  // muted), built as Export builds it: another take of a Band-backed version is the same music, never the learner's
  // parts alone. A take waits until the Band is known.
  const content = useCapstoneContent();
  const progress = useCourseProgress();
  const band = content.data
    ? versionBandOf(version.band, music?.key ?? null, {
        bands: content.data.bands,
        capstone: content.data.capstones.find((c) => c.id === track.capstoneId) ?? null,
        reached: bandReached(progress.data),
      })
    : null;
  const bandPending = version.band != null && content.isPending;
  // The piece's length comes from its analysis: a take started before it is known would be cut at 4 bars. Code that
  // no longer evaluates (a function Oak no longer has) cannot be played or recorded here, only revised.
  const broken = !pending && music === null;
  const [recording, setRecording] = useState(false);
  const slug = `track-${track.id}-v${version.version}`;
  const bars = music?.bars ?? 4;
  const t0 = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!recording) return;
    t0.current = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - t0.current) / 1000), 250);
    return () => clearInterval(id);
  }, [recording]);
  // Stop, or leaving the page mid-take, cancels the recorder: nothing is uploaded after the learner has gone.
  const live = useRef({ recording: false, stopped: false, gone: false });
  useEffect(() => {
    const l = live.current;
    l.gone = false;
    return () => {
      l.gone = true;
      if (l.recording && oak.recorder.recording) {
        l.stopped = true;
        oak.recorder.cancel();
      }
    };
  }, [oak]);
  const stop = () => {
    if (!oak.recorder.recording) return;
    live.current.stopped = true;
    oak.recorder.cancel();
  };
  // d20: a version that has a recording gets another take; the earlier ones stay and can be chosen again.
  const record = async (another: boolean) => {
    const h = oak.editors.get(editorId(slug));
    if (!h || pending || bandPending || broken) return;
    setRecording(true);
    live.current.recording = true;
    live.current.stopped = false;
    try {
      const rec = await recordPerformance(oak, h, bars);
      if (live.current.gone) return;
      const input = {
        params: { id: track.id, v: String(version.version) },
        query: { durationS: String(Math.round(rec.durationS * 10) / 10) },
        body: rec.blob,
        contentType: rec.mime.split(";")[0],
      } as never;
      if (another) {
        try {
          await addTake.mutateAsync(input);
        } catch (e) {
          // A server without takes (a typed 501) could only replace the recording: nothing is replaced unasked.
          if (!notBuilt(e)) throw e;
          toast.error(
            "This take wasn't saved",
            "Keeping several takes is not built on this server yet. The earlier recording is untouched.",
          );
          return;
        }
      } else await put.mutateAsync(input);
      toast.success(
        another
          ? `Another take of version ${version.version} recorded. The earlier ones are kept.`
          : `Version ${version.version} recorded`,
      );
    } catch (e) {
      if (live.current.gone) return;
      if (live.current.stopped) toast.info("Recording stopped. Nothing was saved.");
      else if (e instanceof Error && e.message === PIECE_DOES_NOT_RUN)
        toast.error("This version doesn't run", BROKEN_VERSION_TEXT);
      else toast.error("The recording didn't work", e instanceof Error ? e.message : undefined);
    } finally {
      live.current.recording = false;
      if (!live.current.gone) setRecording(false);
    }
  };
  const expected = music?.bpm ? recordingSeconds(bars, music.bpm / 240) : null;
  return (
    <div className="flex flex-col gap-2">
      {broken ? (
        <div data-testid="version-broken">
          <Callout tone="attention" title="This version doesn't run in Oak today">
            {BROKEN_VERSION_TEXT}
          </Callout>
        </div>
      ) : null}
      <Workbench
        id={slug}
        code={code}
        variant="compact"
        readOnly
        lessonCtx={{
          key: music?.key ?? null,
          meter,
          defaultBpm: 100,
          loopBars: Math.max(1, Math.min(64, bars)),
        }}
        lint={{ profile: "studio", unlocked: new Set(), allowPreview: true, meter, key: null }}
        views={["roll", "staff"]}
        band={band}
        onModel={onModel}
        tutorBars
        toolbar={
          <span className="inline-flex items-center gap-2">
            <Button
              size="sm"
              icon={<Mic2 aria-hidden className="size-4" />}
              loading={recording}
              disabled={pending || bandPending || broken}
              title={
                pending || bandPending
                  ? "Reading the piece…"
                  : broken
                    ? "This version's code doesn't run"
                    : undefined
              }
              onClick={() => void record(version.hasAudio)}
              data-testid="record-version"
              className={clsx(!version.hasAudio && "border-accent")}
            >
              {version.hasAudio ? "Record another take" : "Record this version"}
            </Button>
            {recording && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Square aria-hidden className="size-4" />}
                onClick={stop}
                data-testid="stop-recording"
              >
                Stop
              </Button>
            )}
          </span>
        }
      />
      {recording && (
        <p className="text-sm text-text-2" aria-live="polite">
          Recording {formatDuration(elapsed)}
          {expected ? ` of ${formatDuration(expected)}` : ""}… UI sounds and the mic are off.
        </p>
      )}
      {version.hasAudio && !recording && (
        <p className="text-sm text-text-3" data-testid="take-kept-note">
          A new take is added to this version. Every take is kept; you choose which one plays.
        </p>
      )}
    </div>
  );
}

function Versions({
  track,
  selected,
  sketch,
  songOf,
}: {
  track: AlbumTrackDetail;
  selected: number;
  sketch: SketchDetail | undefined;
  /** The song release an album version is, or `null` (it has no recording of its own: it plays its frozen song). */
  songOf(version: number): { unitId: string; releaseId: number } | null;
}) {
  const codeAt = (sv: number) => sketch?.versions.find((s) => s.version === sv)?.code ?? null;
  const ordered = [...track.versions].sort((a, b) => b.version - a.version);
  return (
    <section aria-labelledby="trk-versions" className="flex flex-col gap-3">
      <h2 id="trk-versions" className="text-h3">
        Versions
      </h2>
      <ol className="flex flex-col gap-1">
        {ordered.map((x) => {
          const prev = track.versions.find((p) => p.version === x.version - 1);
          const now = codeAt(x.sketchVersion);
          const song = songOf(x.version);
          // A song version's code is the whole song, not this one sketch: no line count for it.
          const summary =
            song || now === null ? "" : changeSummary(prev ? codeAt(prev.sketchVersion) : null, now);
          return (
            <li key={x.version}>
              <Link
                to="/album/$trackId"
                params={{ trackId: track.id }}
                search={{ v: x.version }}
                aria-current={x.version === selected ? "page" : undefined}
                className="flex items-center gap-3 rounded-card border border-transparent p-2 hover:bg-surface-2 aria-[current=page]:border-accent/50 aria-[current=page]:bg-lane-in"
              >
                {song ? (
                  <SongReleaseCover unitId={song.unitId} releaseId={song.releaseId} size={48} />
                ) : (
                  <VersionCover track={track} version={x} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">Version {x.version}</span>
                  {x.version === track.currentVersion && <span className="text-text-3"> · current</span>}
                  <span className="block text-sm text-text-2">
                    {formatDate(x.createdAt, true)}
                    {summary ? ` · ${summary}` : ""}
                    {x.durationS ? ` · ${formatDuration(x.durationS)}` : ""}
                    {x.hasAudio || song ? "" : " · not recorded"}
                    {takesOf(x).length > 1 ? ` · ${takesOf(x).length} takes` : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <Compare track={track} selected={selected} />
    </section>
  );
}

function VersionCover({ track, version }: { track: AlbumTrackDetail; version: AlbumTrackVersion }) {
  const { music, pending } = useCoverMusic(
    { sketchId: version.sketchId, sketchVersion: version.sketchVersion },
    track.flavour,
  );
  return (
    <AlbumCover
      seed={track.coverSeed}
      title={`${track.title} v${version.version}`}
      music={music}
      loading={pending}
      size={48}
      plain
    />
  );
}

/** A/B between two recorded versions: switching keeps the position, so the change is heard in place. */
function Compare({ track, selected }: { track: AlbumTrackDetail; selected: number }) {
  const recorded = track.versions.filter((x) => x.hasAudio).sort((a, b) => b.version - a.version);
  const a = recorded.find((x) => x.version === selected) ?? recorded[0];
  const b = recorded.find((x) => x.version !== a?.version);
  const refs = { A: useRef<HTMLAudioElement>(null), B: useRef<HTMLAudioElement>(null) };
  const [side, setSide] = useState<"A" | "B">("A");
  const [playing, setPlaying] = useState(false);
  if (!a || !b) return null;
  const el = (s: "A" | "B") => refs[s].current;
  const switchTo = (s: "A" | "B") => {
    const from = el(side);
    const to = el(s);
    if (!to) return;
    if (from && from !== to) {
      to.currentTime = Math.min(
        from.currentTime,
        Number.isFinite(to.duration) ? to.duration : from.currentTime,
      );
      if (playing) {
        from.pause();
        void to.play();
      }
    }
    setSide(s);
  };
  const toggle = () => {
    const cur = el(side);
    if (!cur) return;
    if (playing) {
      cur.pause();
      setPlaying(false);
    } else {
      void cur.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  };
  return (
    <fieldset
      className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3"
      aria-label="Compare two versions"
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "a" || e.key === "A") switchTo("A");
        else if (e.key === "b" || e.key === "B") switchTo("B");
        else return;
        e.preventDefault();
      }}
    >
      <legend className="sr-only">Compare two versions</legend>
      <span className="mr-1 text-sm font-medium">Hear the difference</span>
      <Button size="sm" variant={playing ? "primary" : "secondary"} onClick={toggle}>
        {playing ? "Pause" : "Play"}
      </Button>
      {(["A", "B"] as const).map((s) => (
        <Button
          key={s}
          size="sm"
          variant="ghost"
          aria-pressed={side === s}
          onClick={() => switchTo(s)}
          className={clsx(side === s && "bg-surface-2 text-text")}
        >
          {s} · v{(s === "A" ? a : b).version}
        </Button>
      ))}
      <span className="text-sm text-text-3">A and B switch in place.</span>
      {(["A", "B"] as const).map((s) => (
        // biome-ignore lint/a11y/useMediaCaption: instrumental recordings of the learner's own piece.
        <audio
          key={s}
          ref={refs[s]}
          preload="metadata"
          src={albumAudioUrl(track.id, (s === "A" ? a : b).version)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      ))}
    </fieldset>
  );
}
