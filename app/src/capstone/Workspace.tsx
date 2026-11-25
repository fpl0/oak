// The capstone workspace (ux §2.3): the Brief panel (300 px) beside the full Workbench. A compose capstone runs over
// one or more sessions (C2: chords, then melody; contracts §2.4); the panel names this session and what it is for.
// The checklist is live: the rubric runs in capstone mode on every edit with bar-anchored feedback (a bar chip
// lights those bars on the roll and the staff); "Check my track" records the check on the server. Every
// successful Run and every pause in typing saves a version of the draft, bound to the session (`useDraftSaver`).
// Opened again outside Today's runner, the draft is offered from the top. Release names the track, records the
// performance and puts it on the album; a released capstone stays open for revision.
import type {
  CapstoneDef,
  CapstoneState,
  CapstoneVersionDef,
  FlavourId,
  SketchVersion,
  UnlockableId,
} from "@oak/api";
import { renderFeedback, toolsUsed } from "@oak/grader";
import { editorId } from "@oak/strudel";
import { type QueryClient, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Check, CheckCheck, CircleDot, Disc3, Music4, Play, Save, Square } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useContent } from "../lib/content.ts";
import {
  apiQuery,
  useAlbum,
  useApiMutation,
  useBootstrap,
  useCapstoneCheck,
  useCapstoneSessionComplete,
  useCapstoneSessions,
  useCourseProgress,
  useSessionDay,
  useUnlocks,
} from "../lib/queries.ts";
import { ownOpenSession } from "../lib/tab-session.ts";
import { currentSessionId, reportBlockDone } from "../session/store.ts";
import {
  askReview,
  clearSubject,
  openTutor,
  patchSubject,
  registerTutorHost,
  setSubject,
  showBars,
} from "../tutor/context.ts";
import { useSubjectHarmony } from "../tutor/use-subject-harmony.ts";
import { useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { Button } from "../ui/kit/Button.tsx";
import { Chip, Kbd } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { ResultActions } from "../ui/kit/ResultActions.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { useWorkbenchServices } from "../workbench/services.tsx";
import { Workbench } from "../workbench/Workbench.tsx";
import "../workbench/index.ts";
import { bandReached, needsReview } from "../studio/model.ts";
import { ReviewPanel } from "../studio/ReviewPanel.tsx";
import { BriefPanel } from "./BriefPanel.tsx";
import { trackTitleOf } from "./CapstoneScreen.tsx";
import { Ceremony, type CeremonyData } from "./Ceremony.tsx";
import { beyondBrief, checklistOf, readiness } from "./checklist.ts";
import type { CapstoneContent } from "./content.ts";
import { bandSetupFor as bandFor } from "./content.ts";
import { DevicesCard } from "./DevicesCard.tsx";
import { deviceRows, deviceSummary, recordRows } from "./devices.ts";
import { useDraftSaver } from "./draft.ts";
import { type CheckOutcome, checkPiece, lintFor } from "./engine.ts";
import { FormStrip } from "./FormStrip.tsx";
import { LeadSheetCard } from "./LeadSheetCard.tsx";
import { analysisTheory, composeLiner, dedupe } from "./liner.ts";
import { MasterCard, type MasterOutcome } from "./MasterCard.tsx";
import { masterLinerLine } from "./master.ts";
import { theoryTags } from "./piece.ts";
import {
  latestVersion,
  reviewRequestText,
  useCapstoneReview,
  useDraft,
  useDraftSketchId,
  usePatchDraft,
  useReleasedCode,
} from "./queries.ts";
import { ReleaseDialog } from "./ReleaseDialog.tsx";
import { useRecordDevices } from "./record-devices.ts";
import { releaseStandingOf } from "./release-version.ts";
import { useTryRevision } from "./revision.ts";
import { currentSession, isResume, sessionsDone, sessionViews, starterOf } from "./sessions.ts";
import { grownFromLine } from "./sketch-plan.ts";
import { useSongMelody } from "./song-melody.ts";
import { TrackSessionCards } from "./TrackSession.tsx";
import {
  lockedMelodyEditable,
  songFormFor,
  songOfDraft,
  versionsOf,
  versionTag,
  withSessionLines,
} from "./tracks.ts";
import { VersionsWorkspace } from "./Versions.tsx";
import { WorkbenchServicesLoader } from "./WorkbenchServicesLoader.tsx";
import { pieceForm, releaseGate, rowExtras, rubricUsesSections } from "./wave5.ts";
import { mergeExtras, runningLength, showsLeadSheet, wave6Extras } from "./wave6.ts";
import { wave7Extras } from "./wave7.ts";
import { CAPSTONE_SLOTS } from "./workspace-slots.ts";
import { useSong } from "./x1/songs.ts";

export { starterOf };

/** The workbench slug of a capstone's editor (`oak_capstone-C0_0_`). */
export const wbSlug = (id: string) => `capstone-${id}`;

export function Workspace({
  def,
  state,
  content,
}: {
  def: CapstoneDef;
  state: CapstoneState;
  content: CapstoneContent;
}) {
  // AC1 (`capstone.versions`): two pieces of code, each its own draft, side by side.
  if (versionsOf(def).length === 2) return <VersionsWorkspace def={def} state={state} content={content} />;
  return <SingleWorkspace def={def} state={state} content={content} />;
}

function SingleWorkspace({
  def,
  state,
  content,
}: {
  def: CapstoneDef;
  state: CapstoneState;
  content: CapstoneContent;
}) {
  const draftRef = useDraftSketchId(def.id, state.sketchId);
  const draft = useDraft(draftRef.id);
  const ready = !draftRef.pending && (draftRef.id === null || draft.data !== undefined);
  // Once open, the workspace stays mounted. Inside a session there is no draft until the first save creates one;
  // the server then links it (`capstones.get` refetches after a check) while its `sketches.get` is still on the
  // way, which made `ready` false for a moment and remounted the editor — losing the "Checked version N" notice
  // and the live state with it. The draft only seeds the first render, so nothing is lost by staying.
  const [opened, setOpened] = useState(false);
  if (ready && !opened) setOpened(true);
  return (
    <div className="flex h-full min-h-0" data-testid="capstone-workspace">
      {ready || opened ? (
        <WorkbenchServicesLoader label="Loading the workbench">
          <Loaded
            def={def}
            state={state}
            content={content}
            sketchId={draftRef.id}
            latest={latestVersion(draft.data)}
            tags={draft.data?.tags ?? []}
            grown={grownFromLine(draft.data?.versions ?? [])}
          />
        </WorkbenchServicesLoader>
      ) : (
        <div className="flex-1 p-4 text-sm text-text-3">Opening your draft…</div>
      )}
    </div>
  );
}

interface Official {
  code: string;
  version: number;
  outcome: CheckOutcome;
}

/** AC1: the version this editor holds, and what the workspace knows of the other one. */
export interface VersionCtx {
  id: "a" | "b";
  label: string;
  versions: readonly CapstoneVersionDef[];
  /** The code this version opens with when it has no draft yet. */
  starter: string;
  other: { id: "a" | "b"; label: string; code: string | null };
  /** Whether every requirement is met on the other version's draft (`null`: not checked yet). */
  otherReady: boolean | null;
  /** This version's readiness on the code now in the editor, for the other tab and the release. */
  onReadiness(r: { code: string; ready: boolean; met: number; required: number }): void;
  /** The A/B compare at matched loudness, and the version switch: drawn above the Workbench. */
  header: ReactNode;
  /** This version's draft sketch once a save made it (a new sketch is tagged after the list was read). */
  onSketch(id: string): void;
}

export function Loaded({
  def,
  state,
  content,
  sketchId: initialSketch,
  latest,
  tags,
  grown,
  version,
}: {
  def: CapstoneDef;
  state: CapstoneState;
  content: CapstoneContent;
  sketchId: string | null;
  latest: SketchVersion | null;
  tags: readonly string[];
  /** "Grown from “…”.": the sketch a single started from, for its liner notes. */
  grown: string | null;
  /** AC1: the version this editor holds. */
  version?: VersionCtx;
}) {
  const { oak } = useWorkbenchServices();
  const qc = useQueryClient();
  const boot = useBootstrap();
  const day = useSessionDay();
  const shared = useContent();
  const unlocksQ = useUnlocks();
  const progress = useCourseProgress();
  const sessionsQ = useCapstoneSessions(def.id);
  const brief = def.brief as NonNullable<CapstoneDef["brief"]>;
  const released = state.status === "released" && state.trackId !== null;
  const total = def.sessionDefs.length;
  const views = sessionViews(def, state, sessionsQ.data ?? null);
  const current = currentSession(views, sessionsQ.data ?? null);
  const done = sessionsDone(views);
  const nextIndex = current?.index ?? Math.min(state.sessionsDone, total - 1);
  const nextSession = def.sessionDefs[nextIndex];
  const allDone = done >= total || state.sessionsDone >= total;
  const lastSession = current?.release === true || state.sessionsDone >= total - 1;
  // d21: the session this tab left open (never another tab's), when it is one of this capstone's.
  const own = ownOpenSession(day.data);
  const sessionId = currentSessionId() ?? (own?.mapItemId?.startsWith(`${def.id}.`) ? own.id : null);
  const currentRef = useRef(current?.id ?? null);
  currentRef.current = allDone ? null : (current?.id ?? null);
  // Wave 7: the editor of this capstone (AC1's version two has its own), and the song it works on (JC3's model,
  // JC4's standard, AC1's tune) with its melody for the rules that keep or avoid it.
  const slug = version?.id === "b" ? wbSlug(`${def.id}-b`) : wbSlug(def.id);
  const songId = songOfDraft(def, tags);
  const songQ = useSong(songId);
  const song = songQ.data ?? null;
  const songMelody = useSongMelody(song);
  // The song's chart for a device-counting brief (JC4), keyed by the brief and the song's id only, so a re-render
  // that hands over equal objects never restarts the live check (the check waits 650 ms of quiet).
  const countsDevices = (def.brief?.rubric ?? []).some((r) => r.rule === "device-count");
  const songKey = song?.id ?? null;
  const songForm = useMemo(() => (countsDevices ? songFormFor(def, song) : null), [countsDevices, songKey]);
  const checkExtras = useMemo(
    () => ({
      songMelody: songMelody.data ?? null,
      songForm,
      otherVersion: version?.other.code ? { id: version.other.id, code: version.other.code } : null,
    }),
    [songMelody.data, version?.other.id, version?.other.code, songForm],
  );
  const checkExtrasRef = useRef(checkExtras);
  checkExtrasRef.current = checkExtras;

  // --- unlocked set and flavour ------------------------------------------------------------------
  const unlockIds = (unlocksQ.data?.items ?? []).map((u) => u.itemId as UnlockableId);
  const unlockKey = unlockIds.slice().sort().join(",");
  // One Set per distinct unlock list, so a refetch with the same unlocks does not re-run the live check.
  const [unlockedState, setUnlocked] = useState<{ key: string; set: ReadonlySet<UnlockableId> }>(() => ({
    key: unlockKey,
    set: new Set(unlockIds),
  }));
  useEffect(() => {
    if (unlockedState.key !== unlockKey)
      setUnlocked({
        key: unlockKey,
        set: new Set(unlockKey ? (unlockKey.split(",") as UnlockableId[]) : []),
      });
  }, [unlockKey, unlockedState.key]);
  const unlocked = unlockedState.set;
  const tagFlavour = tags.find((t): t is FlavourId => t.startsWith("flavour.")) ?? null;
  const [flavour, setFlavour] = useState<FlavourId>(
    state.flavour ?? tagFlavour ?? boot.data?.profile.flavour ?? content.shipping[0] ?? "flavour.pop",
  );
  const flavourRef = useRef(flavour);
  flavourRef.current = flavour;

  // --- code ----------------------------------------------------------------------------------------
  const initialCode = latest?.code ?? version?.starter ?? starterOf(def, nextIndex);
  const [code, setCode] = useState(initialCode);
  // W7 gate (contracts §11.3): a draft that arrived in an imported backup opens as text, as Studio's does. It runs
  // (and is checked) only after Oak's strict lint passes; the workbench then opens on the reviewed code.
  const [importReview, setImportReview] = useState<{ code: string; version: number } | null>(() =>
    latest && needsReview(latest) ? { code: latest.code, version: latest.version } : null,
  );
  const [workbenchCode, setWorkbenchCode] = useState(initialCode);
  const codeRef = useRef(code);
  codeRef.current = code;
  // JC4 from its second session: the melody line is read-only, the chords are the learner's (wave7.md §4.4). The
  // ranges are taken from the code when the lock begins; the editor carries them through every edit after.
  const lockOn = def.id === "JC4" && nextIndex >= 1 && !released;
  // The ranges are read once, when the lock turns on (through the ref, so later edits never recompute them).
  const melodyLock = useMemo(() => (lockOn ? lockedMelodyEditable(codeRef.current) : undefined), [lockOn]);
  const [bandOn, setBandOn] = useState(latest?.band != null);
  const assisted = useRef<string | null>(null);
  const patch = usePatchDraft();

  // --- live rubric ---------------------------------------------------------------------------------
  const [live, setLive] = useState<{ outcome: CheckOutcome | null; checking: boolean; error: string | null }>(
    { outcome: null, checking: true, error: null },
  );
  const liveRef = useRef(live);
  liveRef.current = live;
  // A superseded check is left to finish and ignored: aborting it would restart the shared grader worker under
  // the Workbench's own analysis.
  const seq = useRef(0);
  useEffect(() => {
    if (unlocksQ.isPending || importReview !== null) return;
    const my = ++seq.current;
    setLive((s) => ({ ...s, checking: true }));
    const t = setTimeout(() => {
      checkPiece(def, code, unlocked, undefined, checkExtras).then(
        (outcome) => {
          if (my === seq.current) setLive({ outcome, checking: false, error: null });
        },
        (e: unknown) => {
          if (my === seq.current)
            setLive((s) => ({ ...s, checking: false, error: e instanceof Error ? e.message : String(e) }));
        },
      );
    }, 650);
    return () => clearTimeout(t);
  }, [def, code, unlocked, unlocksQ.isPending, checkExtras, importReview]);

  const band = bandOn
    ? bandFor(
        def,
        flavour,
        content.bands,
        def.key ?? live.outcome?.key ?? { tonic: "C", mode: "major" },
        bandReached(progress.data),
      )
    : null;
  const bandRef = useRef(band);
  bandRef.current = band;

  // Tools used before their unlock: allowed only as previews, and named in the liner notes (§3.1 rule 4).
  const previewToolsOf = (src: string): string[] => {
    const toolbox = shared.data?.toolbox ?? [];
    if (toolbox.length === 0) return [];
    const ids = dedupe(toolsUsed(src, toolbox).map((t) => t.id)).filter(
      (id) => !unlocked.has(id as UnlockableId),
    );
    return ids.map((id) => toolbox.find((t) => t.id === id)?.code ?? id);
  };

  const draftSaver = useDraftSaver({
    capstoneId: def.id,
    title: version ? `${def.title} · ${version.label}` : def.title,
    // The server binds a draft to a version only for a brief that declares its versions (content-kit 6).
    ...(version && def.versions?.length === 2 ? { versionId: version.id } : {}),
    initialSketch,
    latest: latest ? { version: latest.version, code: latest.code, createdAt: latest.createdAt } : null,
    initialCode,
    sessionId,
    capstoneSessionId: () => currentRef.current,
    tags: () => [
      flavourRef.current,
      ...(songId ? [songId] : []),
      ...(version ? [versionTag(version.id)] : []),
    ],
    body: (src, ranOk) => {
      const o = liveRef.current.outcome;
      const fresh = o && o.code === src ? o : null;
      const note = assisted.current;
      assisted.current = null;
      const b = bandRef.current;
      return {
        code: src,
        bpm: fresh?.analysis?.bpm ?? null,
        meter: def.meter,
        key: fresh?.key ?? def.key ?? null,
        analysis: fresh?.analysis ?? null,
        note,
        tutorAssisted: note !== null,
        band: b
          ? { bandId: b.band, flavour: flavourRef.current, mutes: [] as ("drums" | "bass" | "chords")[] }
          : null,
        flags: { lockedTools: [] as string[], previewTools: previewToolsOf(src) },
        ranOk,
      };
    },
  });
  const save = draftSaver.save;
  const versionSketch = draftSaver.sketchId;
  useEffect(() => {
    if (version && versionSketch) version.onSketch(versionSketch);
  }, [versionSketch, draftSaver.saved?.version]);
  const saveQuietly = draftSaver.saveQuietly;
  const savedInfo = draftSaver.saved;

  // --- official check, sessions, release -------------------------------------------------------------
  const check = useCapstoneCheck();
  const complete = useCapstoneSessionComplete();
  const qa = useApiMutation("qa.report");
  const [official, setOfficial] = useState<Official | null>(null);
  /** How many checks ran here: each one is a new result for the row's focus and Alt+R. */
  const [checks, setChecks] = useState(0);
  const [checkingNow, setCheckingNow] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "attention" | "info";
    title: string;
    body?: string | undefined;
    /** The code a check's notice describes: once the code moves on, the notice no longer speaks for it. */
    code?: string;
    /** A review request's notice: the review entry on screen when it was asked (a newer one means it arrived). */
    reviewOf?: string | null;
  } | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [ceremony, setCeremony] = useState<CeremonyData | null>(null);
  const review = useCapstoneReview(def.id);
  const track = useQuery({
    ...apiQuery("album.track", { params: { id: state.trackId ?? "none" } }),
    enabled: state.trackId !== null,
  });
  const tryRevision = useTryRevision();

  const outcomeFor = async (src: string): Promise<CheckOutcome> => {
    const o = liveRef.current.outcome;
    return o && o.code === src ? o : checkPiece(def, src, unlocked, undefined, checkExtrasRef.current);
  };

  const checkMyTrack = async (): Promise<Official | null> => {
    if (checkingNow) return null;
    setCheckingNow(true);
    try {
      const src = codeRef.current;
      const { sketchId, version } = await save(src, liveRef.current.outcome?.result.status !== "error");
      const outcome = await outcomeFor(src);
      await check.mutateAsync({
        params: { id: def.id },
        body: { sessionId, sketchId, sketchVersion: version, result: outcome.result },
      });
      const rec = { code: src, version, outcome };
      setOfficial(rec);
      setChecks((n) => n + 1);
      // One notice at a time: the check's result takes the place of the welcome (unless it is still playing).
      if (!fromTopRef.current) setResume(false);
      const rows = checklistOf(brief.rubric, outcome.result);
      const r = readiness(rows);
      // CF-A: the check names the devices it found, with their bars, and which are still open.
      const counter = brief.rubric.find((x) => x.rule === "device-count");
      const devicesLine =
        counter && counter.rule === "device-count" && outcome.result.status !== "error"
          ? `Devices: ${deviceSummary(deviceRows(counter.devices, outcome.analysis?.deviceList ?? []), counter.min)}`
          : null;
      setNotice({
        code: src,
        ...(outcome.result.status === "error"
          ? {
              tone: "attention",
              title: "The piece doesn't run yet",
              body: outcome.result.messages[0]?.text ?? "Fix the error the editor shows, then check again.",
            }
          : r.ready
            ? {
                tone: "success",
                title: `Checked version ${version}: every requirement is met.`,
                body:
                  [devicesLine, released || !lastSession ? null : "It's ready to release when you are."]
                    .filter(Boolean)
                    .join(" ") || undefined,
              }
            : {
                tone: "info",
                title: `Checked version ${version}: ${r.met} of ${r.required} requirements met.`,
                body: [devicesLine, "The open ones are marked in the brief, with the bars to look at."]
                  .filter(Boolean)
                  .join(" "),
              }),
      });
      return rec;
    } catch (e) {
      toast.error("The check didn't go through", e instanceof Error ? e.message : undefined);
      return null;
    } finally {
      setCheckingNow(false);
    }
  };

  const finishSession = async () => {
    if (!nextSession) return;
    try {
      const { sketchId } = await save(codeRef.current, true);
      await complete.mutateAsync({
        params: { id: def.id },
        body: { sessionId, capstoneSessionId: nextSession.id, sketchId, flavour },
      });
      setNotice({
        tone: "success",
        title: `Session ${nextIndex + 1} of ${total} done.`,
        body: def.sessionDefs[nextIndex + 1]
          ? `Next time: ${def.sessionDefs[nextIndex + 1]?.title}. Your draft waits here and plays from the top when you come back.`
          : undefined,
      });
      reportBlockDone({ block: "new", source: "capstone", itemId: nextSession.id, completed: true });
    } catch (e) {
      toast.error("Couldn't finish the session", e instanceof Error ? e.message : undefined);
    }
  };

  const openRelease = async () => {
    const src = codeRef.current;
    const rec = official && official.code === src ? official : await checkMyTrack();
    if (!rec) return;
    if (!readiness(checklistOf(brief.rubric, rec.outcome.result)).ready) return;
    setReleaseOpen(true);
  };

  // --- play from the top (a return outside Today's runner; the runner plays it itself) ----------------
  const editorHandle = () => {
    const h = oak.editors.get(editorId(slug));
    return h && !h.disposed ? h : null;
  };
  const [resume, setResume] = useState(
    () =>
      currentSessionId() === null &&
      isResume(views, latest ? { version: latest.version, createdAt: latest.createdAt } : null),
  );
  const [fromTop, setFromTop] = useState(false);
  const playFromTop = async () => {
    const h = editorHandle();
    if (!h) return;
    try {
      await oak.unlock();
      if (h.playing) h.stop();
      const ran = await h.evaluate({ autostart: false });
      if (!ran.ok) {
        toast.error("The draft doesn't run yet", "Fix the error the editor shows, then play it.");
        return;
      }
      await h.play();
      setFromTop(true);
    } catch (e) {
      toast.error("It didn't play", e instanceof Error ? e.message : undefined);
    }
  };
  const stopFromTop = () => {
    editorHandle()?.stop();
    setFromTop(false);
  };
  const fromTopRef = useRef(fromTop);
  fromTopRef.current = fromTop;
  // Play from the top, or Stop while it plays: on the welcome, or on "On the album" for a released piece.
  const fromTopAction = fromTop ? (
    <Button
      size="sm"
      icon={<Square aria-hidden className="size-4" />}
      onClick={stopFromTop}
      data-testid="stop-from-top"
    >
      Stop
    </Button>
  ) : (
    <Button
      size="sm"
      variant="primary"
      icon={<Play aria-hidden className="size-4" />}
      onClick={() => void playFromTop()}
      data-testid="play-from-top"
    >
      Play from the top
    </Button>
  );
  // The welcome is for arriving: the first edit dismisses it (unless the draft is playing from the top, whose
  // Stop lives on it).
  const openedWith = useRef(code);
  useEffect(() => {
    if (resume && !fromTop && code !== openedWith.current) setResume(false);
  }, [code, resume, fromTop]);
  // "Review requested" gives way to "Review ready" when the review lands, so it never reads as still waiting.
  useEffect(() => {
    if (notice?.reviewOf === undefined || review.entryId === null || review.entryId === notice.reviewOf)
      return;
    setNotice({
      tone: "success",
      title: "Review ready",
      body: "Claude's comments are here and in the tutor panel. They never affect pass or fail.",
    });
  }, [notice, review.entryId]);
  // "Released" while the draft on screen is what was released, "Released · revising" once it differs: compared
  // with the release's own code (from the album track), so a reload keeps the answer. A release made here is
  // known at once, before the track is read again.
  const serverReleasedCode = useReleasedCode(
    released ? state.trackId : null,
    draftSaver.sketchId ?? initialSketch,
  );
  const [justReleased, setJustReleased] = useState<string | null>(null);
  const revising = releaseStandingOf(released, code, justReleased ?? serverReleasedCode) === "revising";

  // --- tutor ---------------------------------------------------------------------------------------
  const thread = { subjectKind: "capstone" as const, subjectId: def.id };
  const onHarmony = useSubjectHarmony(thread);
  const onBars = (from: number, to: number) => showBars(thread, from, to);
  // The Workbench's loop region (0-based bars) while it loops: the form strip marks the section it covers, whether
  // the loop came from the strip, the ribbon or a section chip in the tutor panel.
  const [wbLoop, setWbLoop] = useState<{ from: number; bars: number } | null>(null);
  useEffect(() => {
    setSubject({
      thread,
      title: def.title,
      tutorOpen: true,
      capstoneId: def.id,
      code: codeRef.current,
      released,
      ...(def.key ? { key: def.key } : {}),
      ...(draftSaver.sketchId ? { sketchId: draftSaver.sketchId } : {}),
    });
    return () => clearSubject(thread);
    // The thread is fixed for this workspace.
  }, [def.id]);
  const lastResult = live.outcome?.result ?? state.lastResult ?? null;
  useEffect(() => {
    patchSubject({ subjectKind: "capstone", subjectId: def.id }, { code, lastResult, released });
  }, [def.id, code, lastResult, released]);
  // Cards stay Preview-only until the first release (contracts §10.7); afterwards Apply lands in this editor.
  useEffect(
    () =>
      registerTutorHost({
        thread,
        sketchId: draftSaver.sketchId,
        ...(released
          ? {
              applyCode: (next: string, card: { cardId: string; title: string }) => {
                const h = oak.editors.get(editorId(slug));
                if (!h || h.disposed) return;
                assisted.current = `Revision suggested by Claude (${card.title})`;
                h.setCode(next, { undoable: true });
                setCode(next);
              },
            }
          : {}),
      }),
    [released, def.id, oak],
  );

  // --- keys ------------------------------------------------------------------------------------------
  useHotkeys([
    {
      id: "capstone-check",
      keys: "Mod+Shift+Enter",
      scope: "global",
      group: "Capstone",
      description: "Check my track",
      allowInInput: true,
      run: () => void checkMyTrack(),
    },
    {
      id: "capstone-save",
      keys: "Mod+S",
      scope: "global",
      group: "Capstone",
      description: "Save a version",
      allowInInput: true,
      run: () => {
        save(codeRef.current, false).then(
          ({ version }) => toast.success(`Saved version ${version}`),
          (e: unknown) => toast.error("Couldn't save the draft", e instanceof Error ? e.message : undefined),
        );
      },
    },
  ]);

  // --- derived ---------------------------------------------------------------------------------------
  const outcome = live.outcome;
  const stale = outcome !== null && outcome.code !== code;
  const rows = checklistOf(
    brief.rubric,
    outcome?.result ?? null,
    outcome?.anchors ?? {},
    nextSession?.focusRules ?? [],
    lastSession || allDone || released,
  );
  const ready = readiness(rows);
  // JC4.S1 is the analysis (transcribe's analysis stage): the session ends once it is checked or shown.
  const [analysisDone, setAnalysisDone] = useState(false);
  const analysisGate = def.id === "JC4" && nextIndex === 0 && !allDone && song !== null && !analysisDone;
  const beyond =
    outcome && !stale
      ? beyondBrief(brief.rubric, outcome.result, {
          bars: outcome.bars,
          tracks: Object.values(outcome.n?.byTrack ?? {}).filter((e) => e.length > 0).length,
          bpm: outcome.analysis?.bpm ?? null,
        })
      : [];
  const evalError =
    outcome && !stale && outcome.result.status === "error"
      ? (outcome.result.messages[0]?.text ?? "The piece doesn't run.")
      : null;
  // A piece written in another key than the brief's: every row below read it in the brief's key, so say that first.
  // Only a brief that names a key has one to differ from (C6 and the single are in the learner's own).
  const keyDiag =
    def.key && outcome && !stale && outcome.result.status !== "error"
      ? (outcome.result.diagnostics?.find((d) => d.id === "harmony.key-mismatch") ?? null)
      : null;
  const keyNote = keyDiag ? renderFeedback(keyDiag) : null;
  // The piece's sections (C3 and every brief that reads them) and what each row says beyond met / not yet.
  const form = outcome ? pieceForm(outcome.form, outcome.code, brief.rubric) : null;
  // Shown for a brief that reads sections, and for any piece the learner has arranged into sections.
  const showForm =
    rubricUsesSections(brief.rubric) ||
    (form !== null && (form.sections.length > 0 || form.problem !== null));
  const extras = outcome
    ? mergeExtras(
        rowExtras(brief.rubric, outcome.result, {
          bars: outcome.bars,
          bpm: outcome.analysis?.bpm ?? null,
          durationSec: outcome.analysis?.durationSec ?? null,
          meter: def.meter,
          form,
          view: outcome.form,
          analysis: outcome.analysis,
        }),
        // Wave 6: the mode and its colour note, the applied chord and where it goes, ♭VI–♭VII–I, the lift, the
        // devices with their bars: each read from the grader's views of this piece.
        wave6Extras(
          brief.rubric,
          outcome.result,
          outcome.n
            ? {
                n: outcome.n,
                code: outcome.code,
                meter: def.meter,
                key: def.key ?? null,
                bars: outcome.bars,
                form,
                analysis: outcome.analysis,
              }
            : null,
        ),
      )
    : {};
  // Wave 7: the track capstones' rows (keys reached, guide tones, the walking bass, the clave, the swing in a
  // ratio and the lean in milliseconds, the top voice …), read from the grader's Wave 7 views.
  const extras7 = outcome?.n
    ? wave7Extras(brief.rubric, outcome.result, {
        n: outcome.n,
        code: outcome.code,
        meter: def.meter,
        bars: outcome.bars,
        analysis: outcome.analysis,
        form,
        songMelody: songMelody.data ?? null,
        songTitle: song?.title ?? null,
      })
    : {};
  const allExtras = mergeExtras(extras, extras7);
  // CF-A: the running length against two minutes, beside the form (decided in the first session, never found late).
  const length = outcome
    ? runningLength(brief.rubric, { bars: outcome.bars, durationSec: outcome.analysis?.durationSec ?? null })
    : null;
  // CF-A: "Your devices so far" (the learner's own released tracks per device) and, in its last session, the Master.
  // The core finale's card; JC4 names its jazz devices in its own reharmonisation card.
  const deviceRule = def.id === "JC4" ? undefined : brief.rubric.find((r) => r.rule === "device-count");
  const record = useRecordDevices(def.id, deviceRule !== undefined);
  const recordDevices =
    deviceRule && deviceRule.rule === "device-count" ? recordRows(deviceRule.devices, record.tracks) : null;
  const masterStep = def.id === "CF-A" && (lastSession || allDone || released);
  const [master, setMaster] = useState<MasterOutcome>({ reading: null, reference: null });
  const album = useAlbum();
  const albumDetails = useQueries({
    queries: (masterStep ? (album.data?.tracks ?? []) : [])
      .filter((t) => t.capstoneId !== def.id)
      .map((t) => apiQuery("album.track", { params: { id: t.id } })),
  });
  const references = albumDetails.flatMap((q) => {
    const d = q.data;
    const v = d?.versions.find((x) => x.version === d.currentVersion);
    return d && v?.hasAudio
      ? [
          {
            trackId: d.id,
            capstoneId: d.capstoneId,
            title: d.title,
            version: v.version,
            createdAt: d.createdAt,
          },
        ]
      : [];
  });
  // C3.S3: the lead sheet of the arranged piece, once the melodies are written (the `notates` rule's view).
  // d13: C3's lead sheet belongs to its third session (arranging); the take and the release are the fourth's.
  const showLeadSheet =
    showsLeadSheet(brief.rubric, def.sessionDefs, nextIndex, lastSession || allDone || released) &&
    outcome?.n != null;
  // c1: the first release is of the code its last passing check graded; an edit after it asks for a new check.
  const checkedPassing =
    official && readiness(checklistOf(brief.rubric, official.outcome.result)).ready ? official.code : null;
  const gate = releaseGate({
    liveReady: ready.ready && !stale && !live.checking,
    checkedPassingCode: checkedPassing,
    code,
    checkedHere: official !== null,
    serverChanged: state.draftChangedSinceCheck,
    serverPassed: state.lastResult?.status === "pass",
    editedSinceLoad: code !== initialCode,
    released,
  });
  // AC1: the album holds both versions, so the first release waits until the other one meets the brief too.
  const otherBlocks = version !== undefined && !released && version.otherReady !== true;
  const canRelease = (lastSession || allDone) && gate.kind === "ready" && !otherBlocks;
  // Only a settled reading is reported: a version left mid-check must not stand as "not yet" for the other tab
  // (which then checks this version's draft itself).
  useEffect(() => {
    if (stale || live.checking || live.outcome?.code !== code) return;
    version?.onReadiness({ code, ready: ready.ready, met: ready.met, required: ready.required });
  }, [code, ready.ready, ready.met, ready.required, stale, live.checking, live.outcome?.code]);
  const checkAgain = (lastSession || allDone) && !released && gate.kind === "check-again";
  // No check recorded for this capstone yet (a seeded or carried-over draft): nothing was "edited since" one.
  const neverChecked = official === null && (state.lastResult ?? null) === null;
  const skillName = (id: string) => content.skillNames.get(id) ?? null;
  const bandTitle = band ? `${content.bands.find((b) => b.id === band.band)?.title ?? "the Band"}` : null;
  const releaseTheory = (o: CheckOutcome) =>
    dedupe([...theoryTags(brief.rubric, o.result, null, skillName), ...analysisTheory(o.analysis)]);
  const notesFor = (o: CheckOutcome) => (line: string) =>
    composeLiner({
      learnerLine: line,
      bars: o.bars,
      bpm: o.analysis?.bpm ?? null,
      key: o.analysis && o.analysis.key.length > 0 ? o.key : null,
      meter: def.meter,
      theory: releaseTheory(o),
      previewTools: previewToolsOf(o.code),
      revealed: [],
      band: bandTitle ? `Played with ${bandTitle}` : null,
      attribution: latest?.tutorAssisted && latest.note ? latest.note : null,
      extra: [grown, masterStep ? masterLinerLine(master) : null].filter(Boolean).join(" ") || null,
    });

  return (
    <>
      <BriefPanel
        def={def}
        state={state}
        views={views}
        current={allDone ? null : current}
        rows={rows}
        extras={allExtras}
        ready={ready}
        checking={live.checking || checkingNow}
        stale={stale}
        beyond={beyond}
        devices={
          recordDevices ? (
            <DevicesCard
              rows={recordDevices}
              pending={record.pending}
              defaultOpen={!lastSession && !allDone && !released}
              pieces={{
                track: (id) => record.tracks.find((t) => t.trackId === id) ?? null,
                term: (id) => content.terms.find((t) => t.id === id)?.example ?? null,
              }}
            />
          ) : null
        }
        flavour={flavour}
        shipping={content.shipping}
        onFlavour={(f) => {
          setFlavour(f);
          if (draftSaver.sketchId) patch.mutate({ params: { id: draftSaver.sketchId }, body: { tags: [f] } });
        }}
        flavourLocked={done > 0 || state.sessionsDone > 0 || released}
        onBars={onBars}
        review={review.review}
        reviewId={review.entryId}
        reviewVersion={review.version}
        reviewWait={review.wait}
        canRequestReview={state.sketchId !== null || official !== null}
        onRequestReview={(question) => {
          const r = askReviewFor(def, codeRef.current, released, savedInfo?.version ?? null, question);
          if (r.ok) {
            review.asked();
            if (!fromTopRef.current) setResume(false);
            setNotice({
              tone: "info",
              title: "Review requested",
              body: "Claude's comments appear in the tutor panel and here. They never affect pass or fail.",
              reviewOf: review.entryId,
            });
            void qc.invalidateQueries({ queryKey: ["api", "capstones.get"] });
          }
        }}
        released={released}
        tryPending={tryRevision.pending}
        onTryRevision={
          released && review.review
            ? (i) => {
                const rev = review.review?.revisions[i];
                if (rev)
                  void tryRevision.open({
                    trackTitle: track.data?.title ?? trackTitleOf(def),
                    code: codeRef.current,
                    meter: def.meter,
                    rev,
                  });
              }
            : undefined
        }
        onReport={async (note) => {
          const o = liveRef.current.outcome;
          await qa.mutateAsync({
            body: {
              kind: "capstone-rubric",
              lessonId: null,
              stepId: def.sessionDefs[nextIndex]?.id ?? null,
              exerciseId: `${def.id}/${brief.id}`,
              exerciseVersion: brief.version,
              familyId: null,
              trialSeed: null,
              params: null,
              response: { code: codeRef.current },
              gradeResult: o?.result ?? null,
              hintRung: 0,
              note,
              attemptId: null,
            },
          });
          toast.success("Reported. Thank you: it goes to the grading queue on this machine.");
        }}
      />
      <section aria-label="Workbench" className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg px-4 py-2">
          <StatusChip
            released={released}
            revising={revising}
            allDone={allDone}
            total={total}
            nextIndex={nextIndex}
          />
          <span className="text-sm text-text-3" aria-live="polite" data-testid="saved-state">
            {savedInfo ? (
              <>
                <Save aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                Version {savedInfo.version} saved
              </>
            ) : (
              "Not saved yet"
            )}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {content.bands.length > 0 &&
              bandFor(def, flavour, content.bands, def.key ?? { tonic: "C", mode: "major" }) && (
                <Button
                  size="md"
                  variant="ghost"
                  aria-pressed={bandOn}
                  icon={<Music4 aria-hidden className="size-4" />}
                  onClick={() => setBandOn((b) => !b)}
                  className={clsx(bandOn && "bg-surface-2 text-text")}
                >
                  Band {bandOn ? "on" : "off"}
                </Button>
              )}
            <Button
              variant="secondary"
              loading={checkingNow}
              icon={<CheckCheck aria-hidden className="size-4" />}
              onClick={() => void checkMyTrack()}
              data-testid="check-track"
            >
              Check my track{" "}
              <span className="hidden xl:inline">
                <Kbd>⌘⇧↵</Kbd>
              </span>
            </Button>
            {!lastSession && !allDone && nextSession && (
              <Button
                variant="primary"
                loading={complete.isPending}
                disabled={analysisGate}
                title={
                  analysisGate
                    ? "Check the analysis first (or show it): this session is the analysis"
                    : undefined
                }
                onClick={() => void finishSession()}
                data-testid="finish-session"
              >
                Finish session {nextIndex + 1} of {total}
              </Button>
            )}
            {(lastSession || allDone) && (
              <Button
                variant={canRelease ? "primary" : "secondary"}
                icon={<Disc3 aria-hidden className="size-4" />}
                disabled={!canRelease}
                title={
                  canRelease
                    ? undefined
                    : checkAgain
                      ? "Check this version first: the release is of the code a check passed"
                      : otherBlocks && gate.kind === "ready"
                        ? `${version?.other.label} meets the brief first: the album holds both versions`
                        : "Every requirement in the brief is met first"
                }
                onClick={() => void openRelease()}
                data-testid="release"
              >
                {version && released
                  ? `Add ${version.label.toLowerCase()} to the track`
                  : released
                    ? "Release a new version"
                    : "Release to album"}
              </Button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* One notice at a time, the newest. A released piece shows "On the album" (it carries the welcome's
                Play from the top on a return), which gives way to a newer result; a release clears the older ones
                (onReleased). */}
            {resume && !released && (
              <Callout
                tone="info"
                title={`Welcome back. Your draft is as you left it${savedInfo ? ` (version ${savedInfo.version})` : ""}.`}
                onDismiss={() => {
                  stopFromTop();
                  setResume(false);
                }}
                actions={fromTopAction}
              >
                {current && !allDone
                  ? `Hear where it stands, then carry on with session ${current.index + 1}: ${current.title.toLowerCase()}.`
                  : "Hear where it stands, then revise."}
              </Callout>
            )}
            {released && !notice && (
              <Callout
                tone="success"
                title="On the album"
                actions={
                  <>
                    {resume && fromTopAction}
                    <Link
                      to="/album/$trackId"
                      params={{ trackId: state.trackId as string }}
                      className="text-sm text-link underline"
                    >
                      Open the track
                    </Link>
                  </>
                }
              >
                {/* Says what the header chip says: "Released", or "Released · revising" while the draft differs from the release. */}
                {revising
                  ? "You are revising it. When you release again, this becomes its next version; the released ones stay as they are."
                  : "Released as it is now. Edit it to revise: a new release becomes its next version, and the released ones stay as they are."}
              </Callout>
            )}
            {checkAgain && (
              <div data-testid="check-again" role="status">
                <Callout
                  tone="info"
                  title={neverChecked ? "Not checked yet" : "Edited since the last check"}
                  actions={
                    <Button
                      size="sm"
                      variant="primary"
                      loading={checkingNow}
                      icon={<CheckCheck aria-hidden className="size-4" />}
                      onClick={() => void checkMyTrack()}
                    >
                      Check this version
                    </Button>
                  }
                >
                  Check this version before you release: the album gets the version a check passed.
                </Callout>
              </div>
            )}
            {/* A check's notice speaks for the code it checked; a session's ("Session 3 of 4 done.") stands on. */}
            {notice && (notice.code === undefined || (!checkAgain && notice.code === code)) && (
              <Callout
                tone={notice.tone}
                title={notice.title}
                onDismiss={() => setNotice(null)}
                actions={
                  // A check's verdict gets the result row (docs/design/retry.md §3.6): Try again re-runs the check
                  // on the code as it is now; a version's rubric counts once on the server.
                  notice.code !== undefined && official !== null ? (
                    <ResultActions
                      resultKey={`check:${official.version}:${checks}`}
                      onRetry={() => void checkMyTrack()}
                      retryDisabled={checkingNow}
                      onContinue={null}
                      testId="check-result-actions"
                    />
                  ) : undefined
                }
              >
                {notice.body}
              </Callout>
            )}
            {evalError && (
              <Callout tone="attention" title="The piece doesn't run yet">
                {evalError}
              </Callout>
            )}
            {keyNote && (
              <Callout tone="attention" title="Another key than the brief's">
                <span data-testid="capstone-key-note">{keyNote}</span>
              </Callout>
            )}
            {live.error && !evalError && (
              <Callout tone="attention" title="The live check stopped">
                {live.error} The next edit tries again.
              </Callout>
            )}
            {showForm && form && (
              <FormStrip form={form} onBars={onBars} stale={stale} loop={wbLoop} length={length} />
            )}
            {version?.header}
            <TrackSessionCards
              def={def}
              sessionId={allDone ? null : (current?.id ?? null)}
              sessionIndex={nextIndex}
              unlocked={unlocked}
              toolbox={shared.data?.toolbox ?? []}
              outcome={stale ? null : outcome}
              form={form}
              song={song}
              songLoading={songId !== null && songQ.isPending}
              songMelody={songMelody.data ?? null}
              sketchId={draftSaver.sketchId}
              band={band}
              songKey={def.key ?? live.outcome?.key ?? null}
              code={code}
              onAddLines={(lines) => {
                const next = withSessionLines(codeRef.current, lines);
                const h = oak.editors.get(editorId(slug));
                if (h && !h.disposed) h.setCode(next, { undoable: true });
                codeRef.current = next;
                setCode(next);
              }}
              onBars={onBars}
              onAnalysis={setAnalysisDone}
            />
            {masterStep && (
              <MasterCard
                sections={form?.sections ?? []}
                references={references}
                onBars={onBars}
                onOutcome={setMaster}
              />
            )}
            {!version &&
              !importReview &&
              CAPSTONE_SLOTS.filter((sl) => sl.place === "main").map(({ id: slotId, Component }) => (
                <Component
                  key={slotId}
                  def={def}
                  state={state}
                  sketchId={draftSaver.sketchId}
                  liveCode={code}
                  starter={starterOf(def, nextIndex)}
                  savedVersion={savedInfo?.version ?? null}
                  savedCode={draftSaver.savedCode}
                  saveNow={async (c) => (await save(c, false)).version}
                  released={released}
                  sessionIndex={nextIndex}
                  sessionsDone={done}
                  totalSessions={total}
                  band={band}
                  keySpec={def.key ?? live.outcome?.key ?? null}
                  bars={outcome?.bars ?? null}
                  editor={() => oak.editors.get(editorId(slug)) ?? null}
                  applyCode={(next) => {
                    const h = oak.editors.get(editorId(slug));
                    if (h && !h.disposed) h.setCode(next, { undoable: true });
                    codeRef.current = next;
                    setCode(next);
                  }}
                />
              ))}
            {importReview ? (
              <ReviewPanel
                key={importReview.version}
                code={importReview.code}
                version={importReview.version}
                meter={def.meter}
                keySpec={def.key ?? null}
                onCleared={(cleared) => {
                  codeRef.current = cleared;
                  setCode(cleared);
                  setWorkbenchCode(cleared);
                  setImportReview(null);
                }}
              />
            ) : (
              <Workbench
                tutorBars
                onLoopChange={(l) => setWbLoop(l.on ? l.region : null)}
                id={slug}
                onModel={onHarmony}
                code={workbenchCode}
                lessonCtx={{
                  key: def.key ?? outcome?.key ?? null,
                  meter: def.meter,
                  defaultBpm: def.bpm ? Math.round((def.bpm[0] + def.bpm[1]) / 2) : 100,
                  loopBars: Math.max(1, Math.min(64, outcome?.bars ?? 4)),
                }}
                lint={lintFor(def, unlocked)}
                views={["roll", "staff"]}
                {...(melodyLock ? { readOnly: melodyLock } : {})}
                band={band}
                staff={{ kind: def.id === "C0" ? "percussion" : "auto" }}
                onChange={(c) => {
                  // A check reads `codeRef`: set it now, not at the next render (a check pressed in the frame after an
                  // edit graded the code before it; the capstone-silent race of the corrections gate's run).
                  codeRef.current = c;
                  setCode(c);
                  draftSaver.changed(c);
                }}
                onEvaluated={(o) => {
                  if (o.ok) saveQuietly(o.code, true);
                }}
              />
            )}
            {showLeadSheet && outcome?.n && (
              <LeadSheetCard
                stale={stale}
                piece={{
                  n: outcome.n,
                  bars: outcome.bars,
                  key: outcome.key,
                  meter: def.meter,
                  bpm: outcome.analysis?.bpm ?? null,
                  analysis: outcome.analysis,
                  form,
                  title: track.data?.title ?? trackTitleOf(def),
                }}
              />
            )}
          </div>
        </div>
      </section>
      {releaseOpen && official && (
        <ReleaseDialog
          def={def}
          state={state}
          official={{
            code: official.code,
            version: official.version,
            bars: official.outcome.bars,
            n: official.outcome.n,
            analysis: official.outcome.analysis,
            key: official.outcome.key,
          }}
          flavour={flavour}
          shipping={content.shipping}
          sessionId={sessionId}
          sketchId={draftSaver.sketchId as string}
          review={review.review}
          includeReviewDefault={boot.data?.settings.linerNotesInAlbum ?? true}
          notesFor={notesFor(official.outcome)}
          tags={theoryTags(brief.rubric, official.outcome.result, official.outcome.analysis, skillName)}
          defaultTitle={track.data?.title ?? trackTitleOf(def)}
          editor={() => oak.editors.get(editorId(slug)) ?? null}
          onClose={() => setReleaseOpen(false)}
          onReleased={(data) => {
            setJustReleased(codeRef.current);
            // The release is the newest event: the older notice (a check's result, "Review ready") and the welcome
            // give way, so "On the album" shows.
            setNotice(null);
            stopFromTop();
            setResume(false);
            setReleaseOpen(false);
            setCeremony(data);
            refreshAfterRelease(qc, currentSessionId() !== null);
          }}
        />
      )}
      {ceremony && (
        <Ceremony
          data={ceremony}
          inSession={currentSessionId() !== null}
          onContinue={() => {
            const last = def.sessionDefs.at(-1)?.id;
            setCeremony(null);
            refreshAfterRelease(qc, false);
            if (last) reportBlockDone({ block: "new", source: "capstone", itemId: last, completed: true });
          }}
          onClose={() => {
            setCeremony(null);
            refreshAfterRelease(qc, false);
          }}
        />
      )}
    </>
  );
}

function askReviewFor(
  def: CapstoneDef,
  code: string,
  released: boolean,
  version: number | null,
  question: string | null,
) {
  const r = askReview({
    capstoneId: def.id,
    title: def.title,
    code,
    released,
    note: reviewRequestText(version, false),
    question,
  });
  if (!r.ok) openTutor();
  return r;
}

export function StatusChip({
  released,
  revising = false,
  allDone,
  total,
  nextIndex,
}: {
  released: boolean;
  /** Edited since the release on screen: the draft is a revision. */
  revising?: boolean;
  allDone: boolean;
  total: number;
  nextIndex: number;
}) {
  if (released)
    return (
      <Chip tone="accent">
        <Check aria-hidden className="size-3.5" /> {revising ? "Released · revising" : "Released"}
      </Chip>
    );
  if (allDone)
    return (
      <Chip tone="amber">
        <CircleDot aria-hidden className="size-3.5" /> Sessions done · ready to release
      </Chip>
    );
  return (
    <Chip tone="amber">
      <CircleDot aria-hidden className="size-3.5" /> Session {nextIndex + 1} of {total}
    </Chip>
  );
}

/**
 * After a release, everything the album shows is refetched. Inside Today's runner the capstone's own state waits
 * until the ceremony is dismissed: the runner reads it (and course progress) to decide whether the block opens "from the top", and a
 * refetch mid-ceremony would swap the workspace (and the ceremony) for that card.
 */
export function refreshAfterRelease(qc: QueryClient, inSession: boolean): void {
  void qc.invalidateQueries({
    queryKey: ["api"],
    predicate: (q) =>
      !inSession || !/^(capstones\.|session\.|lessons\.progress)/.test(String(q.queryKey[1] ?? "")),
  });
}
