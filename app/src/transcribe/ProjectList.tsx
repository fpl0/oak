// Transcribe (contracts §11.9 naming; ux §9): the ladder (L1–L4 at the learner's level and realism, the next
// item, an offered level-up), the Transcription Gym's next session, the learner's own audio (drop or pick a
// file: checked and decoded here, stored by the local server, never sent anywhere), and every project.
import type { GymPlan, LadderSong, LadderState, Transcription } from "@oak/api";
import { AUDIO_UPLOAD_MAX_BYTES, OakApiError } from "@oak/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUp, AudioWaveform, Dumbbell, Lock, Repeat2 } from "lucide-react";
import { useState } from "react";
import { formatDate, formatKey } from "../lib/format.ts";
import { getOak } from "../lib/oak.ts";
import {
  useAudioUpload,
  useCourseProgress,
  useGymPlan,
  useLadder,
  useLadderNext,
  useLadderSetLevel,
  useLadderSongs,
  useTranscriptionCreate,
  useTranscriptions,
} from "../lib/queries.ts";
import { currentSessionId } from "../session/store.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Card, Chip, EmptyState, PageHeader, Skeleton } from "../ui/kit/basics.tsx";
import { FileDropZone } from "../ui/kit/FileDropZone.tsx";
import { QueryView } from "../ui/kit/QueryState.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import {
  cftNext,
  type GymSource,
  gymChoices,
  gymSources,
  gymStageLabel,
  localDay,
} from "./gym-after-core.ts";
import { logGymSource, readGymLog } from "./gym-log.ts";
import { AUDIO_ACCEPT, AUDIO_KINDS, fileProblem, PRIVACY_COPY, titleOf } from "./import.ts";
import { type LadderLevel, LEVEL_TITLE, ladderSummary, REALISM_TEXT, REALISM_WORDS } from "./ladder.ts";
import { rememberItem } from "./song.ts";
import { songWrittenHere } from "./songs.ts";
import { songProgress } from "./standard.ts";

const SOURCE_LABEL: Record<Transcription["sourceKind"], string> = {
  "own-audio": "your audio",
  "pd-song": "public-domain song",
  generated: "ladder",
};

const notBuilt = (e: unknown) => e instanceof OakApiError && e.code === "not_implemented";

/** Upload one file as an own-audio project and open it. */
function useImport() {
  const navigate = useNavigate();
  const upload = useAudioUpload();
  const create = useTranscriptionCreate();
  const [step, setStep] = useState<string | null>(null);
  const run = async (file: File) => {
    const problem = fileProblem(file);
    if (problem) {
      toast.error("Couldn't use that file", problem);
      return;
    }
    try {
      setStep("Reading the file");
      const bytes = await file.arrayBuffer();
      // Decoded here first: a file this browser cannot play never reaches the store.
      const oak = await getOak();
      await oak.ctx.decodeAudioData(bytes.slice(0));
      setStep("Keeping it on this device");
      const audio = await upload.mutateAsync({
        query: { name: file.name.slice(0, 255) },
        body: new Blob([bytes], { type: file.type || "application/octet-stream" }),
        contentType: file.type || "application/octet-stream",
      });
      const t = await create.mutateAsync({
        body: {
          sourceKind: "own-audio",
          audioId: audio.id,
          songId: null,
          title: titleOf(file.name),
          artist: null,
          ladderLevel: null,
          templateId: null,
        },
      });
      void navigate({ to: "/transcribe/$projectId", params: { projectId: t.id } });
    } catch (e) {
      const msg =
        e instanceof DOMException || (e instanceof Error && /decode/i.test(e.message))
          ? "This browser can't read that file as audio. Try WAV, MP3 or FLAC."
          : e instanceof Error
            ? e.message
            : String(e);
      toast.error("Couldn't add that file", msg);
    } finally {
      setStep(null);
    }
  };
  return { run, step };
}

function ImportCard() {
  const imp = useImport();
  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="import">
      <div className="flex items-start gap-3">
        <AudioWaveform aria-hidden className="mt-0.5 size-5 shrink-0 text-text-3" />
        <div className="min-w-0">
          <h2 className="text-h3">Your own audio</h2>
          <p className="mt-0.5 text-sm text-text-2">
            Slow a song down, loop a bar, and write what you hear. You judge it yourself with a checklist.
          </p>
        </div>
      </div>
      <FileDropZone
        title="Bring a recording"
        hint="It stays on this device."
        accept={AUDIO_ACCEPT}
        kinds={AUDIO_KINDS}
        maxBytes={AUDIO_UPLOAD_MAX_BYTES}
        onFile={(f) => void imp.run(f)}
        busy={imp.step !== null}
        {...(imp.step ? { busyText: imp.step } : {})}
        buttonText="Choose your own audio…"
        data-testid="drop-zone"
      />
      <p className="text-sm text-text-3">{PRIVACY_COPY}</p>
    </Card>
  );
}

/** One song of the L5/L6/L8 pool: what is passed, and Start or Continue (or why it is not open). */
function SongRow({ song, busy, onOpen }: { song: LadderSong; busy: boolean; onOpen(): void }) {
  const progress = songProgress(song);
  const started = song.passedPhrases.length > 0 || song.passedStages.length > 0;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm" data-testid="song-row">
      <span className="min-w-0 flex-1">
        <span className="font-medium">{song.title}</span>{" "}
        <span className="text-text-3">({song.year === "trad" ? "trad." : song.year})</span>
        <span className="block text-text-2">
          {song.status === "locked"
            ? song.level === 5
              ? `${song.phrases.length} phrases`
              : song.level === 8
                ? "Form, bass, changes, melody"
                : "Bass, changes, melody"
            : progress}
        </span>
      </span>
      {song.status === "locked" ? (
        <Chip>
          <Lock aria-hidden className="size-3" /> {song.lockedReason ?? "Locked"}
        </Chip>
      ) : song.status === "done" ? (
        <Chip tone="accent">done</Chip>
      ) : (
        <Button size="sm" loading={busy} onClick={onOpen}>
          {started ? "Continue" : "Start"}
        </Button>
      )}
    </li>
  );
}

/** L5/L6/L8: the song pool (contracts §2.8) to pick from; locked and unchecked songs say why. */
function SongPicker({
  level,
  onOpen,
  busy,
}: {
  level: 5 | 6 | 8;
  onOpen(songId: string, level: 5 | 6 | 8): void;
  busy: boolean;
}) {
  const songs = useLadderSongs();
  if (songs.isPending) return <Skeleton className="h-20 w-full" />;
  if (songs.isError)
    return (
      <p className="text-sm text-text-2" data-testid="songs-unavailable">
        {notBuilt(songs.error)
          ? "Not built yet: this server can't list the songs."
          : "The songs couldn't be read."}
      </p>
    );
  const pool = songs.data.items.filter((s) => s.level === level);
  if (pool.length === 0)
    return (
      <p className="text-sm text-text-2" data-testid="songs-empty">
        {level === 8
          ? "No standard is ready yet: each one's answer key is checked against the printed song first."
          : "No songs at this level yet: their answer keys are being checked."}
      </p>
    );
  return (
    <ul
      className="flex flex-col divide-y divide-border"
      aria-label={`Songs for level ${level}`}
      data-testid="song-picker"
    >
      {pool.map((s) => (
        <SongRow key={s.songId} song={s} busy={busy} onOpen={() => onOpen(s.songId, level)} />
      ))}
    </ul>
  );
}

function LadderCard() {
  const ladder = useLadder();
  const next = useLadderNext();
  const setLevel = useLadderSetLevel();
  const navigate = useNavigate();
  const start = async (level?: LadderLevel, songId?: string) => {
    try {
      const item = await next.mutateAsync({
        body: {
          sessionId: currentSessionId(),
          gymId: null,
          ...(level ? { level } : {}),
          ...(songId ? { songId } : {}),
        },
      });
      rememberItem(item);
      void navigate({ to: "/transcribe/$projectId", params: { projectId: item.itemId } });
    } catch (e) {
      toast.error(
        "Couldn't make a ladder item",
        notBuilt(e)
          ? "The ladder isn't available on this server yet."
          : e instanceof Error
            ? e.message
            : undefined,
      );
    }
  };
  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="ladder-card">
      <div className="flex items-start gap-3">
        <Dumbbell aria-hidden className="mt-0.5 size-5 shrink-0 text-text-3" />
        <div className="min-w-0">
          <h2 className="text-h3">The ladder</h2>
          <p className="mt-0.5 text-sm text-text-2">
            Short loops Oak generates and grades exactly (drums, bass lines, four-chord loops, melodies), then
            songs: folk tunes phrase by phrase, the blues in stages, and a whole standard, form first.
          </p>
        </div>
      </div>
      {ladder.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : ladder.isError ? (
        <p className="text-sm text-text-2" data-testid="ladder-unavailable">
          {notBuilt(ladder.error)
            ? "The ladder isn't available on this server yet."
            : "The ladder couldn't be read. It will be back when the server answers."}
        </p>
      ) : (
        <LadderStatus
          s={ladder.data}
          busy={next.isPending}
          onNext={(l) => void start(l)}
          onSong={(songId, l) => void start(l, songId)}
          onLevelUp={(to) =>
            setLevel.mutate(
              { body: { level: to } },
              {
                onSuccess: () =>
                  toast.success(
                    `Level ${to}: ${LEVEL_TITLE[to as LadderLevel]}`,
                    "Items start clean and on the grid.",
                  ),
                onError: (e) => toast.error("Couldn't move up yet", e.message),
              },
            )
          }
        />
      )}
    </Card>
  );
}

function LadderStatus({
  s,
  busy,
  onNext,
  onSong,
  onLevelUp,
}: {
  s: LadderState;
  busy: boolean;
  onNext(level?: LadderLevel): void;
  onSong(songId: string, level: 5 | 6 | 8): void;
  onLevelUp(to: number): void;
}) {
  const level = s.level as LadderLevel;
  const songLevel = level === 5 || level === 6 || level === 8;
  const lower = ([1, 2, 3, 4] as const).filter((l) => l < level);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" data-testid="ladder-summary">
        {ladderSummary(s)}
      </p>
      <p className="text-sm text-text-3">{REALISM_TEXT[s.realism]}</p>
      {songLevel ? <SongPicker level={level} busy={busy} onOpen={onSong} /> : null}
      {level === 8 ? (
        <p className="text-sm text-text-2" data-testid="l8-note">
          A standard takes several sessions: the form map first, then the bass, the changes and the melody, a
          section at a time. What you pass is kept.
        </p>
      ) : null}
      {level === 8 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-text-2">Blues strains (level 6) to practise</summary>
          <SongPicker level={6} busy={busy} onOpen={onSong} />
        </details>
      ) : null}
      {level === 6 || level === 8 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-text-2">Folk songs (level 5) to practise</summary>
          <SongPicker level={5} busy={busy} onOpen={onSong} />
        </details>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={songLevel ? "secondary" : "primary"}
          loading={busy}
          onClick={() => onNext()}
          data-testid="ladder-next"
        >
          {level === 8
            ? "Next standard · Level 8"
            : songLevel
              ? `Next song · Level ${level}`
              : `Next item · Level ${level}`}
        </Button>
        {s.levelUp ? (
          <Button
            icon={<ArrowUp aria-hidden className="size-4" />}
            onClick={() => onLevelUp(s.levelUp?.to ?? level)}
          >
            Move up to level {s.levelUp.to}
          </Button>
        ) : null}
        {lower.length > 0 ? (
          <span className="flex items-center gap-1 text-sm text-text-2">
            Practise
            {lower.map((l) => (
              <Button
                key={l}
                size="sm"
                variant="ghost"
                onClick={() => onNext(l)}
                aria-label={`Practise level ${l}`}
              >
                Level {l}
              </Button>
            ))}
          </span>
        ) : null}
      </div>
      {s.levelUp ? <p className="text-sm text-text-2">{s.levelUp.reason}</p> : null}
    </div>
  );
}

/** CF-T takes the transcription slots while it is open (wave6.md §5.2): say so, and where it is worked. */
function CfTLine({ plan }: { plan: GymPlan }) {
  const cfT = plan.cfT;
  if (!cfT?.takesSlot) return null;
  return (
    <p className="text-sm text-text-2" data-testid="cft-line">
      Your transcription sessions are the Standard Transcription for now
      {cftNext(cfT.nextSessionId)}: a whole standard, form first.{" "}
      <Link to="/capstone/$id" params={{ id: "CF-T" }} className="underline">
        Open it
      </Link>
      . The gym comes back when it is released.
    </p>
  );
}

/**
 * What the gym serves next, in words: the level by its title and how real it sounds (never the session ID or the
 * L/R codes). `realismNow` is the ladder's own realism: a session that plays more real than that says so.
 */
function GymLine({ plan, realismNow }: { plan: GymPlan; realismNow: number | null }) {
  if (!plan.active || !plan.next) return null;
  const n = plan.next;
  const level = (n.ladderLevel ?? 1) as LadderLevel;
  const realism = n.realism ?? 0;
  const what =
    n.kind === "ladder"
      ? `a ladder item at level ${level} (${LEVEL_TITLE[level]?.toLowerCase() ?? "the ladder"}), with ${REALISM_WORDS[realism] ?? "the sound it has now"}${realismNow !== null && realism > realismNow ? ", a step more real than your ladder plays now" : ""}`
      : n.ownAudioFallback
        ? "a ladder item that sounds a step more real (there's no recording of yours yet)"
        : "your own audio";
  return (
    <p className="text-sm text-text-2" data-testid="gym-line">
      Next in the Transcription Gym: {what}.{" "}
      {plan.slotDue
        ? "It's due in today's session."
        : `${Math.max(0, 4 - plan.sinceLast)} more sessions until it's due.`}
    </p>
  );
}

/**
 * After the core (contracts §2.5: the slot rule stops; the gym is offered once a week and on review days): what the
 * gym serves next, drawn from every stage the learner has opened, own audio to jazz and rhythm, never a source
 * served in the last two weeks (gym-after-core.ts).
 */
function GymAfterCore({ plan }: { plan: GymPlan | undefined }) {
  const progress = useCourseProgress();
  const ladder = useLadder();
  const songs = useLadderSongs();
  const list = useTranscriptions();
  const next = useLadderNext();
  const navigate = useNavigate();
  const [log, setLog] = useState(readGymLog);
  const p = progress.data;
  if (!p || (p.core !== "complete" && p.course !== "complete")) return null;
  const sources = gymSources({
    coreComplete: true,
    completed: new Set(p.lessons.filter((l) => l.status === "completed").map((l) => l.lessonId)),
    ladderLevel: ladder.data?.level ?? 1,
    ownAudio: (list.data?.items ?? [])
      .filter((t) => t.sourceKind === "own-audio")
      .map((t) => ({ id: t.id, title: t.title })),
    songs: (songs.data?.items ?? []).map((s) => ({
      songId: s.songId,
      title: s.title,
      level: s.level,
      status: s.status,
    })),
    cfTReleased: plan?.cfT?.status === "released",
    analysable: new Set(
      (songs.data?.items ?? []).filter((s) => songWrittenHere(s.songId)).map((s) => s.songId),
    ),
  });
  const today = localDay();
  const choices = gymChoices(sources, log, today, 4);
  const open = async (c: GymSource) => {
    setLog(logGymSource(c.id, today));
    const o = c.open;
    if (o.via === "project") {
      void navigate({ to: "/transcribe/$projectId", params: { projectId: o.projectId } });
      return;
    }
    if (o.via === "item") {
      void navigate({ to: "/transcribe", search: { item: o.itemId } });
      return;
    }
    if (o.via === "analysis") {
      void navigate({ to: "/transcribe", search: { analyse: o.songId } });
      return;
    }
    try {
      const item = await next.mutateAsync({
        body: {
          sessionId: currentSessionId(),
          gymId: null,
          level: o.level as LadderLevel,
          ...(o.songId ? { songId: o.songId } : {}),
        },
      });
      rememberItem(item);
      void navigate({ to: "/transcribe/$projectId", params: { projectId: item.itemId } });
    } catch (e) {
      toast.error("Couldn't make a ladder item", e instanceof Error ? e.message : undefined);
    }
  };
  return (
    <Card className="mb-6 flex flex-col gap-3 p-4" data-testid="gym-after-core">
      <div className="flex items-start gap-3">
        <Repeat2 aria-hidden className="mt-0.5 size-5 shrink-0 text-text-3" />
        <div className="min-w-0">
          <h2 className="text-h3">The gym goes on</h2>
          <p className="mt-0.5 text-sm text-text-2">
            Drawn from everything you have opened: your own audio, the ladder, the standards, and the jazz and
            rhythm of the tracks you have started. Nothing comes back within two weeks.
          </p>
        </div>
      </div>
      {choices.length === 0 ? (
        <p className="text-sm text-text-2" data-testid="gym-rested">
          Everything the gym has for you was served in the last two weeks. Studio is open, and the ladder
          above.
        </p>
      ) : (
        <ul
          className="m-0 flex list-none flex-col divide-y divide-border p-0"
          aria-label="What the gym serves"
        >
          {choices.map((c, i) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
              data-testid="gym-choice"
              data-source={c.id}
            >
              <Chip tone={i === 0 ? "accent" : "neutral"}>{gymStageLabel(c.stage)}</Chip>
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{c.title}</span>
                <span className="block text-text-2">{c.detail}</span>
              </span>
              <Button
                size="sm"
                variant={i === 0 ? "primary" : "secondary"}
                loading={next.isPending}
                onClick={() => void open(c)}
              >
                {i === 0 ? "Start the next" : "Start"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ProjectList() {
  const list = useTranscriptions();
  const gym = useGymPlan();
  const ladder = useLadder();
  return (
    <>
      <PageHeader title="Transcribe" sub="Hear it, write it in code, compare with A/B." />
      {gym.data ? (
        <div className="mb-4 flex flex-col gap-1">
          <GymLine plan={gym.data} realismNow={ladder.data?.realism ?? null} />
          <CfTLine plan={gym.data} />
        </div>
      ) : null}
      <GymAfterCore plan={gym.data} />
      {/* Each card keeps its own height: the ladder's one action does not float in a box stretched to the drop zone. */}
      <div className="mb-6 grid items-start gap-4 md:grid-cols-2">
        <LadderCard />
        <ImportCard />
      </div>
      <h2 className="mb-3 text-h3">Projects</h2>
      <QueryView
        query={list}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState icon={<AudioWaveform aria-hidden />} title="No projects yet">
            Start a ladder item, or bring a recording of your own: it stays on this device.
          </EmptyState>
        }
      >
        {(d) => (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="projects">
            {[...d.items]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((t) => (
                <li key={t.id}>
                  <Link
                    to="/transcribe/$projectId"
                    params={{ projectId: t.id }}
                    className="block rounded-card"
                    data-testid="project-link"
                  >
                    <Card interactive className="flex h-full flex-col gap-1 p-4">
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="text-sm text-text-2">
                        {[t.artist, formatKey(t.key), t.bpm ? `${Math.round(t.bpm)} BPM` : null]
                          .filter(Boolean)
                          .join(" · ") || "Tempo not set yet"}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <Chip>{SOURCE_LABEL[t.sourceKind]}</Chip>
                        {t.ladderLevel ? <Chip>Level {t.ladderLevel}</Chip> : null}
                        {t.gradedPass ? (
                          <Chip tone="accent">passed</Chip>
                        ) : (
                          <Chip tone={t.status === "done" ? "accent" : "neutral"}>
                            {t.status === "done" ? "done" : "in progress"}
                          </Chip>
                        )}
                        <span className="ml-auto text-sm text-text-3">{formatDate(t.updatedAt, true)}</span>
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </QueryView>
    </>
  );
}
