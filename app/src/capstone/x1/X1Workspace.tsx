// X1 "Folk Transcription" (contracts §2.4, §6.6 X1; wave4.md §5.1): the song the learner picked, worked phrase by
// phrase over three sessions — phrases 1–2, phrases 3–4, then the chords bass-first — with the song beside the code
// (A/B, loop a phrase, slower) and a check per phrase graded in the browser in capstone mode (key-relative melody at
// 0.85, chord stages at 0.85 since contracts 1.6). The givens come first: meter, key, tonic, pickup, the rhythm of phrase 1. A phrase
// can be revealed (hint 4): it earns no evidence and is named in the liner notes. Drafts save continuously; the
// last session ends with the tutor review on offer and the release to the album.
import {
  type CapstoneDef,
  type CapstoneState,
  type GradeResult,
  OakApiError,
  type PhraseCheck,
  R,
  type SketchVersion,
  type SongDef,
  type UnlockableId,
} from "@oak/api";
import { normalize, phraseCheckPassed, phraseCheckRequest, phraseWindow } from "@oak/grader";
import { editorId } from "@oak/strudel";
import { tempoLine } from "@oak/theory";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { CheckCheck, CircleCheck, CircleDot, Disc3, Eye, Lock, Repeat, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/api.ts";
import { analyzeCode, gradeInBrowser } from "../../lib/grader-client.ts";
import { idempotencyKey } from "../../lib/idempotency.ts";
import {
  apiQuery,
  useApiMutation,
  useBootstrap,
  useCapstoneSessionComplete,
  useCapstoneSessions,
  useSessionDay,
  useUnlocks,
} from "../../lib/queries.ts";
import { ownOpenSession } from "../../lib/tab-session.ts";
import { currentSessionId, reportBlockDone } from "../../session/store.ts";
import { ChangesChart } from "../../transcribe/ChangesChart.tsx";
import type { FormMap } from "../../transcribe/form-map.ts";
import { checkLines, lineText } from "../../transcribe/ladder.ts";
import { ReferenceStaff } from "../../transcribe/ReferenceView.tsx";
import { barMarks, changesOfCode, withChanges } from "../../transcribe/song.ts";
import { isBareDraft, skeletonOfForm } from "../../transcribe/standard.ts";
import {
  askReview,
  clearSubject,
  openTutor,
  patchSubject,
  registerTutorHost,
  setSubject,
  showBars,
} from "../../tutor/context.ts";
import { useSubjectHarmony } from "../../tutor/use-subject-harmony.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Chip, Skeleton } from "../../ui/kit/basics.tsx";
import { Callout } from "../../ui/kit/Controls.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { useWorkbenchServices } from "../../workbench/services.tsx";
import { Workbench } from "../../workbench/Workbench.tsx";
import { Checklist } from "../Checklist.tsx";
import { checklistOf, readiness } from "../checklist.ts";
import {
  capstoneStarter,
  FORM_MAP_NAME,
  type FormMapFeedback,
  formMapGrade,
  formMapOf,
  formMapSettled,
  formMapState,
  sessionRubric,
  sessionRubricRequest,
  songFormMap,
} from "./cft.ts";
import { FormMapPanel } from "./FormMapPanel.tsx";
import "../../workbench/index.ts";
import { Report, ReviewWaitNote, SessionList } from "../BriefPanel.tsx";
import { trackTitleOf } from "../CapstoneScreen.tsx";
import { Ceremony, type CeremonyData } from "../Ceremony.tsx";
import type { CapstoneContent } from "../content.ts";
import { useDraftSaver } from "../draft.ts";
import { analyzeDraft } from "../engine.ts";
import { analysisTheory, composeLiner } from "../liner.ts";
import {
  latestVersion,
  reviewRequestText,
  useCapstoneReview,
  useDraft,
  useDraftSketchId,
  useReleasedCode,
} from "../queries.ts";
import { ReleaseDialog, type ReleasePiece } from "../ReleaseDialog.tsx";
import { ReviewCard } from "../ReviewCard.tsx";
import { releaseStandingOf } from "../release-version.ts";
import { useTryRevision } from "../revision.ts";
import { currentSession, isResume, sessionsDone, sessionViews } from "../sessions.ts";
import { useSongMelody } from "../song-melody.ts";
import { WorkbenchServicesLoader } from "../WorkbenchServicesLoader.tsx";
import { refreshAfterRelease } from "../Workspace.tsx";
import {
  applyResult,
  bassFirst,
  type CheckRow,
  capstoneRows,
  chordAnswer,
  givenLines,
  type LocalCheck,
  lockedText,
  phraseLoop,
  revealedItems,
  rowLabel,
  sessionComplete,
  songCycles,
  songGivenFromDef,
} from "./phrases.ts";
import { type SongLayer, SongSource, type SongSourceHandle } from "./SongSource.tsx";
import { songOfDraft } from "./song-of-draft.ts";
import { songWritten, usePhrase1Rhythm, useSong } from "./songs.ts";

export { songOfDraft };

const slug = (id: string) => `capstone-${id}`;
const notBuilt = (e: unknown) => e instanceof OakApiError && e.code === "not_implemented";
const LOCAL_KEY = (id: string, sketch: string | null) => `oak.capstone.${id}.checks.${sketch ?? "new"}`;

export function X1Workspace({
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
  const [opened, setOpened] = useState(false);
  if (ready && !opened) setOpened(true);
  // Which songs have answer keys, without loading them: only the draft's own song is fetched.
  const songId = songOfDraft(def, draft.data?.tags ?? [], (def.song ?? []).filter(songWritten));
  const song = useSong((songId as SongDef["id"]) ?? null);
  const entry = content.repertoire.find((r) => r.id === songId);
  let body: React.ReactNode;
  if (!(ready || opened) || song.isPending)
    body = (
      <div
        className="flex flex-1 flex-col gap-3 p-4"
        role="status"
        aria-busy="true"
        aria-label="Opening your transcription"
      >
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[112px] w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  else if (song.isError || !song.data)
    body = (
      <div className="flex-1 p-6">
        <Callout tone="attention" title={`${entry?.title ?? "This song"} has no answer key yet`}>
          Oak's rendition of the song, with its phrases, is still being written and checked against its
          source. The phrase checks open once it is there; nothing else waits on it.
        </Callout>
      </div>
    );
  else
    body = (
      <WorkbenchServicesLoader label="Loading the workbench">
        <X1Loaded
          def={def}
          state={state}
          song={song.data}
          sketchId={draftRef.id}
          latest={latestVersion(draft.data)}
          tags={draft.data?.tags ?? []}
          entryTitle={
            entry ? `${entry.title} (${entry.year === "trad" ? "traditional" : entry.year})` : song.data.title
          }
        />
      </WorkbenchServicesLoader>
    );
  return (
    <div className="flex h-full min-h-0" data-testid="capstone-workspace" data-kind="transcribe">
      {body}
    </div>
  );
}

interface Feedback {
  key: string;
  result: GradeResult;
  passed: boolean;
}

function readLocal(key: string): Record<string, LocalCheck> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, LocalCheck>) : {};
  } catch {
    return {};
  }
}
function writeLocal(key: string, v: Record<string, LocalCheck>) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Storage may be unavailable (private windows): the server's record is the one that counts.
  }
}

function X1Loaded({
  def,
  state,
  song,
  sketchId: initialSketch,
  latest,
  tags,
  entryTitle,
}: {
  def: CapstoneDef;
  state: CapstoneState;
  song: SongDef;
  sketchId: string | null;
  latest: SketchVersion | null;
  tags: readonly string[];
  entryTitle: string;
}) {
  const { oak } = useWorkbenchServices();
  const qc = useQueryClient();
  const boot = useBootstrap();
  const unlocksQ = useUnlocks();
  const sessionsQ = useCapstoneSessions(def.id);
  const server = sessionsQ.data ?? null;
  const views = sessionViews(def, state, server);
  const current = currentSession(views, server);
  const total = def.sessionDefs.length;
  const done = sessionsDone(views);
  const allDone = done >= total || state.sessionsDone >= total;
  const released = state.status === "released" && state.trackId !== null;
  // d21: the session this tab left open (never another tab's), when it is one of this capstone's.
  const day = useSessionDay();
  const own = ownOpenSession(day.data);
  const sessionId = currentSessionId() ?? (own?.mapItemId?.startsWith(`${def.id}.`) ? own.id : null);
  const currentId = useRef<string | null>(null);
  currentId.current = allDone ? null : (current?.id ?? null);
  const unlocked = new Set((unlocksQ.data?.items ?? []).map((u) => u.itemId as UnlockableId));

  // --- code and saving ------------------------------------------------------------------------------
  const allChecks = def.sessionDefs.flatMap((sd) => sd.checks ?? []);
  const staged = bassFirst(allChecks);
  const initialCode = latest?.code ?? capstoneStarter(def, song);
  const [code, setCode] = useState(initialCode);
  const codeRef = useRef(code);
  codeRef.current = code;
  const saver = useDraftSaver({
    capstoneId: def.id,
    title: def.title,
    initialSketch,
    latest: latest ? { version: latest.version, code: latest.code, createdAt: latest.createdAt } : null,
    initialCode,
    sessionId,
    capstoneSessionId: () => currentId.current,
    tags: () => [String(song.id), ...tags.filter((t) => !t.startsWith("song."))],
    body: (src, ranOk) => ({
      code: src,
      bpm: song.bpm,
      meter: song.meter,
      key: song.key,
      analysis: null,
      note: null,
      tutorAssisted: false,
      band: null,
      flags: { lockedTools: [], previewTools: [] },
      ranOk,
    }),
  });

  // --- checks ---------------------------------------------------------------------------------------
  const storeKey = LOCAL_KEY(def.id, initialSketch);
  const [local, setLocal] = useState<Record<string, LocalCheck>>(() => readLocal(storeKey));
  useEffect(() => writeLocal(storeKey, local), [storeKey, local]);
  const checksOf = (i: number): PhraseCheck[] => def.sessionDefs[i]?.checks ?? [];
  // Every session's rows in order, so a check waits for one of an earlier session (X2: the melody after S1's
  // changes; contracts §6.6 "stages in that order").
  // CF-T: session 1 opens with the form map; the phrase checks wait for it (`after: ["form-map"]`).
  const fm = formMapOf(def);
  const fmState = fm ? formMapState(fm.check, views[fm.sessionIndex]?.checks ?? [], local) : null;
  // CF-T: its checks are the song's own sections, named by letter only once the form is mapped or shown
  // ("Section 3 (B) · changes"; before that "Section 3 · bass", which gives nothing away).
  const formKnown = fmState !== null && (fmState.passed || fmState.revealed);
  const sectionNames = fm ? (song.answerKey.sections ?? []).map((x) => (formKnown ? x.label : "")) : null;
  const bySession = capstoneRows(
    def.sessionDefs.map((_, i) => ({ checks: checksOf(i), server: views[i]?.checks ?? [] })),
    local,
    fm && fmState ? formMapSettled(fm.check, fmState) : undefined,
  );
  const allRows = bySession.flat();
  const sessionIndex = current?.index ?? 0;
  const rows = bySession[sessionIndex] ?? [];
  const formHere = fm !== null && fmState !== null && fm.sessionIndex === sessionIndex && !allDone;
  const formSettledNow = fmState === null || fmState.passed || fmState.revealed;
  // CF-T.S4: the session's own rubric (the four roles, the song's sections) on the whole arrangement.
  const rubric = sessionRubric(def.sessionDefs[allDone ? total - 1 : sessionIndex]);
  const complete =
    (rows.length === 0 && rubric.length > 0 ? true : sessionComplete(rows)) && (!formHere || formSettledNow);
  const releaseSession = current?.release === true;
  const qa = useApiMutation("qa.report");
  const completeSession = useCapstoneSessionComplete();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmReveal, setConfirmReveal] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "info" | "attention";
    title: string;
    body?: string;
  } | null>(null);
  const recordOff = useRef(false);

  const runCheck = async (row: CheckRow, reveal: boolean) => {
    const check = checksOf(sessionIndex).find((c) => c.id === row.checkId);
    if (!check || !current || busy) return;
    setBusy(row.key);
    setConfirmReveal(null);
    try {
      const src = codeRef.current;
      const { sketchId, version } = await saver.save(src, true);
      const result = await gradeInBrowser(
        phraseCheckRequest({
          capstoneId: def.id,
          check,
          song,
          code: src,
          ...(row.stage ? { stage: row.stage } : {}),
          ctx: {
            params: {},
            attemptNo: row.attempts + 1,
            firstAttempt: row.attempts === 0,
            rung: reveal ? 4 : 0,
            tutorHints: 0,
            extraReplays: 0,
            lint: { profile: "graded", unlocked, allowPreview: false, meter: song.meter, key: song.key },
          },
        }),
      );
      const passed = phraseCheckPassed(result);
      setLocal((prev) => ({ ...prev, [row.key]: applyResult(prev[row.key], result, passed) }));
      setFeedback({ key: row.key, result, passed });
      if (!recordOff.current)
        await callApi("capstones.recordCheck", {
          params: { id: def.id, checkId: row.checkId },
          body: {
            capstoneSessionId: current.id as never,
            stage: row.stage,
            sketchId,
            sketchVersion: version,
            result,
            idempotencyKey: idempotencyKey(),
          },
        })
          .then((s) => {
            // Inside Today's runner the stored state waits for the block's end (the runner reads it to decide
            // whether the block opens "from the top"); the check shows from the local record meanwhile.
            if (sessionId === null)
              qc.setQueryData(apiQuery("capstones.sessions", { params: { id: def.id } }).queryKey, s);
          })
          .catch((e: unknown) => {
            if (notBuilt(e)) recordOff.current = true;
            else toast.error("The check wasn't stored", e instanceof Error ? e.message : undefined);
          });
    } catch (e) {
      toast.error("The check didn't run", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  // The form map's check: graded here (`gradeFormMap`, no Strudel), stored as the capstone's `form` check. A map
  // that passed, or was shown, writes the draft's skeleton over the bare starter: one const per distinct section.
  const [formFeedback, setFormFeedback] = useState<FormMapFeedback | null>(null);
  const checkForm = async (map: FormMap, reveal: boolean) => {
    if (!fm || !fmState || !current || busy) return;
    setBusy(fm.check.id);
    try {
      const g = formMapGrade({
        capstoneId: def.id,
        check: fm.check,
        song,
        map,
        attemptNo: fmState.attempts + 1,
        reveal,
      });
      setLocal((prev) => ({ ...prev, [fm.check.id]: applyResult(prev[fm.check.id], g.result, g.passed) }));
      setFormFeedback({ map, result: g.result, passed: g.passed });
      let src = codeRef.current;
      if (g.passed || reveal) {
        const settledMap = reveal ? (songFormMap(song) ?? map) : map;
        if (isBareDraft(src)) {
          src = skeletonOfForm(songGivenFromDef(song), settledMap);
          const h = editorHandle();
          if (h) h.setCode(src, { undoable: true });
          setCode(src);
          saver.changed(src);
          source.current?.setMine(src);
        }
      }
      const { sketchId, version } = await saver.save(src, true);
      if (!recordOff.current)
        await callApi("capstones.recordCheck", {
          params: { id: def.id, checkId: fm.check.id },
          body: {
            capstoneSessionId: current.id as never,
            stage: null,
            sketchId,
            sketchVersion: version,
            result: g.result,
            idempotencyKey: idempotencyKey(),
          },
        })
          .then((s) => {
            if (sessionId === null)
              qc.setQueryData(apiQuery("capstones.sessions", { params: { id: def.id } }).queryKey, s);
          })
          .catch((e: unknown) => {
            if (notBuilt(e)) recordOff.current = true;
            else toast.error("The check wasn't stored", e instanceof Error ? e.message : undefined);
          });
    } catch (e) {
      toast.error("The form check didn't run", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  // Carry f4: the song's own melody, so the arrangement's rules can tell a kept tune from a changed one.
  const songMelody = useSongMelody(rubric.length > 0 ? song : null);
  // The session rubric, live: re-read a moment after each edit, like a compose capstone's checklist.
  const [rubricResult, setRubricResult] = useState<{ code: string; result: GradeResult } | null>(null);
  const rubricSeq = useRef(0);
  const unlockKey = [...unlocked].sort().join(",");
  useEffect(() => {
    if (rubric.length === 0) return;
    const my = ++rubricSeq.current;
    const t = setTimeout(() => {
      gradeInBrowser(
        sessionRubricRequest({
          capstoneId: def.id,
          sessionId: def.sessionDefs.at(-1)?.id ?? def.id,
          rubric,
          song,
          code,
          songMelody: songMelody.data ?? null,
          lint: {
            profile: "graded",
            unlocked: new Set(unlockKey ? (unlockKey.split(",") as UnlockableId[]) : []),
            allowPreview: false,
            meter: song.meter,
            key: song.key,
          },
        }),
      ).then(
        (result) => {
          if (my === rubricSeq.current) setRubricResult({ code, result });
        },
        () => {},
      );
    }, 650);
    return () => clearTimeout(t);
    // `rubric` is the session's own list; its length stands for it.
  }, [def, song, code, unlockKey, rubric.length, songMelody.data]);
  const rubricRows = checklistOf(rubric, rubricResult?.result ?? null, {}, [], true);
  const rubricReady = rubric.length === 0 || (readiness(rubricRows).ready && rubricResult?.code === code);

  const finish = async () => {
    if (!current) return;
    try {
      const { sketchId } = await saver.save(codeRef.current, true);
      await completeSession.mutateAsync({
        params: { id: def.id },
        body: { sessionId, capstoneSessionId: current.id, sketchId, flavour: null },
      });
      const next = views[current.index + 1];
      setNotice({
        tone: "success",
        title: `Session ${current.index + 1} of ${total} done.`,
        ...(next
          ? { body: `Next time: ${next.title}. Your transcription waits here and plays from the top.` }
          : {}),
      });
      setFeedback(null);
      reportBlockDone({ block: "new", source: "capstone", itemId: current.id, completed: true });
    } catch (e) {
      toast.error("Couldn't finish the session", e instanceof Error ? e.message : undefined);
    }
  };

  // --- the source and the editor ---------------------------------------------------------------------
  const source = useRef<SongSourceHandle | null>(null);
  const onSource = useCallback((h: SongSourceHandle | null) => {
    source.current = h;
  }, []);
  // X1 plays the tune alone until its chords session; a bass-first transcription (X2) the whole band from the start.
  const layers: SongLayer[] =
    allDone ||
    staged ||
    def.sessionDefs
      .slice(0, sessionIndex + 1)
      .some((sd) => (sd.checks ?? []).some((c) => c.layer !== "melody"))
      ? ["melody", "bass", "chords"]
      : ["melody"];
  const loopPhrase = (phrase: number | [number, number]) => {
    const l = phraseLoop(song, phrase);
    if (l) source.current?.loopBars(l.fromBar, l.bars);
  };
  const editorHandle = () => {
    const h = oak.editors.get(editorId(slug(def.id)));
    return h && !h.disposed ? h : null;
  };

  // --- reveal display ------------------------------------------------------------------------------------
  const revealedRow = feedback?.result.assist.revealed ? rows.find((r) => r.key === feedback.key) : null;

  // --- release ---------------------------------------------------------------------------------------
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [piece, setPiece] = useState<ReleasePiece | null>(null);
  const [ceremony, setCeremony] = useState<CeremonyData | null>(null);
  const review = useCapstoneReview(def.id);
  const track = useQuery({
    ...apiQuery("album.track", { params: { id: state.trackId ?? "none" } }),
    enabled: state.trackId !== null,
  });
  const tryRevision = useTryRevision();
  // "Released" or "Released · revising", as in the composing workspace: the draft on screen against the code of
  // the current release (a release made here is known at once).
  const serverReleasedCode = useReleasedCode(
    released ? state.trackId : null,
    saver.sketchId ?? initialSketch,
  );
  const [justReleased, setJustReleased] = useState<string | null>(null);
  const revising = releaseStandingOf(released, code, justReleased ?? serverReleasedCode) === "revising";
  const canRelease = (releaseSession || allDone) && (complete || allDone || released) && rubricReady;
  const openRelease = async () => {
    try {
      const src = codeRef.current;
      const { sketchId, version } = await saver.save(src, true);
      const a = await analyzeDraft(src, { meter: song.meter, key: song.key, unlocked });
      if (a.error) {
        setNotice({ tone: "attention", title: "The transcription doesn't run yet", body: a.error });
        return;
      }
      // CF-T.S4: the session's own rubric is graded live here; the server releases on the run it has stored
      // (capstone-release.ts), so the passing run of this very version is recorded first.
      if (rubric.length > 0 && rubricResult && rubricResult.code === src)
        await callApi("capstones.check", {
          params: { id: def.id },
          body: { sessionId, sketchId, sketchVersion: version, result: rubricResult.result },
        });
      setPiece({ code: src, version, bars: a.bars, n: a.n, analysis: a.analysis, key: song.key });
      setReleaseOpen(true);
    } catch (e) {
      toast.error("Couldn't prepare the release", e instanceof Error ? e.message : undefined);
    }
  };
  const bassHeard = allRows.some((r) => (r.layer === "bass" || r.stage === "bass") && r.passed);
  const theory = staged
    ? [
        ...(bassHeard ? ["the bass line by ear"] : []),
        ...(allRows.some((r) => r.layer === "chords" && r.stage === null && r.passed)
          ? ["the changes by ear"]
          : []),
        "the melody by ear, line by line",
        ...(song.swing ? ["the shuffle feel"] : []),
      ]
    : [
        "the melody by ear, phrase by phrase",
        ...(bassHeard ? ["the bass line by ear"] : []),
        ...(allRows.some((r) => r.stage === "quality" && r.passed) ? ["chord qualities by ear"] : []),
        ...(allRows.some((r) => r.stage === "rn" && r.passed) ? ["the chords as Roman numerals"] : []),
      ];
  const notesFor = (p: ReleasePiece) => (line: string) =>
    composeLiner({
      learnerLine: line,
      source: entryTitle,
      bars: song.answerKey.bars,
      bpm: song.bpm,
      key: song.key,
      meter: song.meter,
      theory: [...theory, ...analysisTheory(p.analysis)],
      previewTools: [],
      revealed: [...(fmState?.revealed && !fmState.passed ? [FORM_MAP_NAME] : []), ...revealedItems(allRows)],
    });

  // --- tutor ---------------------------------------------------------------------------------------
  const thread = { subjectKind: "capstone" as const, subjectId: def.id };
  const onHarmony = useSubjectHarmony(thread);
  // The tutor's bar references land here (the host's `showBars`, after the panel lit the bars): loop them. Bars
  // count from the first full bar (c4), so with a pickup bar n is cycle n.
  const loopTutorBars = (from: number, to: number) => {
    source.current?.loopBars(song.pickup ? from : from - 1, to - from + 1);
  };
  // A bar named on this page (a check line): light it and loop it through the same path as a tutor reference.
  // (`showBars` calls the host below, so the host must not call `showBars` again.)
  const onBars = (from: number, to: number) => showBars(thread, from, to);
  useEffect(() => {
    setSubject({
      thread,
      title: def.title,
      tutorOpen: true,
      capstoneId: def.id,
      code: codeRef.current,
      released,
      key: song.key,
      ...(saver.sketchId ? { sketchId: saver.sketchId } : {}),
    });
    return () => clearSubject(thread);
  }, [def.id]);
  useEffect(() => {
    patchSubject(thread, { code, released, lastResult: feedback?.result ?? null });
  }, [code, released, feedback]);
  useEffect(
    () => registerTutorHost({ thread, sketchId: saver.sketchId, showBars: (a, b) => loopTutorBars(a, b) }),
    [def.id],
  );

  // --- play from the top on a return outside Today's runner ------------------------------------------
  const [resume, setResume] = useState(
    () =>
      currentSessionId() === null &&
      isResume(views, latest ? { version: latest.version, createdAt: latest.createdAt } : null),
  );
  const playFromTop = async () => {
    const h = editorHandle();
    if (!h) return;
    try {
      await oak.unlock();
      if (h.playing) h.stop();
      const ran = await h.evaluate({ autostart: false });
      if (ran.ok) await h.play();
      else toast.error("The transcription doesn't run yet", "Fix the error the editor shows, then play it.");
    } catch (e) {
      toast.error("It didn't play", e instanceof Error ? e.message : undefined);
    }
  };

  // The changes check (X2, unstaged chords): the chart from the code's `chords:` line, written back as the
  // learner fills it (Transcribe's chart and its code helpers).
  const pickup = song.pickup !== undefined;
  const changesRow = rows.find((r) => r.layer === "chords" && r.stage === null) ?? null;
  const chart = changesRow ? changesOfCode(code, song.answerKey.bars, pickup) : null;
  const changesMarks =
    changesRow && feedback?.key === changesRow.key
      ? barMarks(feedback.result, [1, song.answerKey.bars], pickup)
      : null;
  const writeChart = (next: string[]) => {
    const src = withChanges(codeRef.current, next, pickup);
    const h = editorHandle();
    if (h) h.setCode(src, { undoable: true });
    setCode(src);
    saver.changed(src);
    source.current?.setMine(src);
  };

  const given = givenLines(song);
  // Phrase 1's rhythm is per song (`phrase1Rhythm` in its module); a check's own `given` is the fallback.
  const songRhythm = usePhrase1Rhythm(song.id);
  const skeleton =
    songRhythm.data ?? checksOf(0).find((c) => c.given?.rhythmSkeleton)?.given?.rhythmSkeleton ?? null;
  const showGiven = sessionIndex === 0 || current?.status !== "done";

  return (
    <>
      <aside
        aria-label="Brief"
        className="flex w-[300px] shrink-0 flex-col gap-5 overflow-auto border-r border-border bg-surface px-4 py-4"
      >
        <header>
          <p className="text-sm text-text-3">Capstone</p>
          <h1 className="font-display text-h2 leading-tight">{def.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-2">{def.objective}</p>
        </header>
        <SessionList views={views} current={allDone ? null : current} />
        <section aria-labelledby="x1-song" className="flex flex-col gap-2">
          <h2 id="x1-song" className="font-sans text-sm font-semibold text-text-2">
            The song
          </h2>
          <p className="text-sm font-medium" data-testid="x1-song">
            {entryTitle}
          </p>
          {showGiven && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" data-testid="x1-given">
              {given.map((g) => (
                <div key={g.label} className="contents">
                  <dt className="text-text-3">{g.label}</dt>
                  <dd>{g.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {skeleton && sessionIndex === 0 && <RhythmSkeleton code={skeleton} />}
        </section>
        <section aria-labelledby="x1-checks" className="flex flex-col gap-2" data-testid="x1-checks">
          <div className="flex items-center justify-between gap-2">
            <h2 id="x1-checks" className="font-sans text-sm font-semibold text-text-2">
              {allDone ? "Checks" : `Checks · session ${sessionIndex + 1}`}
            </h2>
            {rows.length > 0 && (
              <span className="text-sm text-text-3 tabular-nums" data-testid="x1-check-count">
                {rows.filter((r) => r.passed || r.revealed).length} of {rows.length} done
              </span>
            )}
          </div>
          {rows.length === 0 && rubric.length > 0 ? (
            <p className="text-sm text-text-2">
              Every section is transcribed. This session is checked on the whole arrangement: the requirements
              below.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-text-2">
              This session's phrase checks are still being written. Work by ear meanwhile: your draft saves as
              you go.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((r) => (
                <CheckRowView
                  sections={sectionNames}
                  key={r.key}
                  row={r}
                  busy={busy === r.key}
                  disabled={busy !== null && busy !== r.key}
                  confirming={confirmReveal === r.key}
                  onLoop={() => loopPhrase(r.phrase)}
                  onCheck={() => void runCheck(r, false)}
                  onReveal={() => setConfirmReveal(r.key)}
                  onConfirmReveal={() => void runCheck(r, true)}
                  onCancelReveal={() => setConfirmReveal(null)}
                />
              ))}
            </ul>
          )}
        </section>
        {rubric.length > 0 && (
          <div data-testid="session-rubric">
            <Checklist
              rows={rubricRows}
              ready={readiness(rubricRows)}
              checking={rubricResult?.code !== code}
              stale={rubricResult !== null && rubricResult.code !== code}
              onBars={onBars}
            />
          </div>
        )}
        {(releaseSession || allDone) && (
          <section aria-labelledby="x1-review" className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 id="x1-review" className="font-sans text-sm font-semibold text-text-2">
              Claude's review
            </h2>
            {review.review ? (
              <div data-testid="review-summary">
                <ReviewCard
                  key={review.entryId ?? "review"}
                  review={review.review}
                  doneId={review.entryId ?? undefined}
                  heading={review.version ? `Review of version ${review.version}` : undefined}
                  onBars={onBars}
                  headingLevel={3}
                  compact
                  {...(released
                    ? {
                        onTry: (i: number) => {
                          const rev = review.review?.revisions[i];
                          if (rev)
                            void tryRevision.open({
                              trackTitle: track.data?.title ?? trackTitleOf(def),
                              code: codeRef.current,
                              meter: song.meter,
                              rev,
                            });
                        },
                        tryPending: tryRevision.pending,
                      }
                    : {})}
                />
              </div>
            ) : (
              <p className="text-sm text-text-2">
                What you heard well, one place to listen again, one question. It never affects pass or fail.
              </p>
            )}
            <ReviewWaitNote wait={review.wait} />
            <Button
              size="sm"
              disabled={saver.sketchId === null || review.wait.kind === "pending"}
              onClick={() => {
                const r = askReview({
                  capstoneId: def.id,
                  title: def.title,
                  code: codeRef.current,
                  released,
                  note: reviewRequestText(saver.saved?.version ?? null, true),
                });
                if (!r.ok) openTutor();
                else {
                  review.asked();
                  void qc.invalidateQueries({ queryKey: ["api", "capstones.get"] });
                }
              }}
              data-testid="request-review"
            >
              {review.wait.kind === "pending"
                ? "Review requested"
                : review.review
                  ? "Ask for a new review"
                  : "Request review"}
            </Button>
          </section>
        )}
        <Report
          onReport={async (note) => {
            await qa.mutateAsync({
              body: {
                kind: "capstone-rubric",
                lessonId: null,
                stepId: current?.id ?? null,
                exerciseId: `${def.id}/${feedback?.key ?? current?.id ?? "draft"}`,
                exerciseVersion: def.version,
                familyId: null,
                trialSeed: null,
                params: null,
                response: { code: codeRef.current },
                gradeResult: feedback?.result ?? null,
                hintRung: 0,
                note,
                attemptId: null,
              },
            });
            toast.success("Reported. Thank you: it goes to the grading queue on this machine.");
          }}
        />
      </aside>

      <section aria-label="Transcription" className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg px-4 py-2">
          {released ? (
            <Chip tone="accent">
              <CircleCheck aria-hidden className="size-3.5" /> {revising ? "Released · revising" : "Released"}
            </Chip>
          ) : (
            <Chip tone="amber">
              <CircleDot aria-hidden className="size-3.5" />{" "}
              {allDone ? "Sessions done · ready to release" : `Session ${sessionIndex + 1} of ${total}`}
            </Chip>
          )}
          <span className="text-sm text-text-3" aria-live="polite" data-testid="saved-state">
            {saver.saved ? (
              <>
                <Save aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                Version {saver.saved.version} saved
              </>
            ) : (
              "Not saved yet"
            )}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!releaseSession && !allDone && current && (
              <Button
                variant={complete ? "primary" : "secondary"}
                disabled={!complete}
                title={
                  complete
                    ? undefined
                    : formHere && !formSettledNow
                      ? "The form map is checked first, then each section"
                      : "Each phrase is checked (or revealed) first"
                }
                loading={completeSession.isPending}
                onClick={() => void finish()}
                data-testid="finish-session"
              >
                Finish session {sessionIndex + 1} of {total}
              </Button>
            )}
            {(releaseSession || allDone) && (
              <Button
                variant={canRelease ? "primary" : "secondary"}
                disabled={!canRelease}
                title={
                  canRelease
                    ? undefined
                    : rubric.length > 0 && !rubricReady
                      ? "The two lines of this session's checklist are met first"
                      : "Every stage of the chords is checked (or revealed) first"
                }
                icon={<Disc3 aria-hidden className="size-4" />}
                onClick={() => void openRelease()}
                data-testid="release"
              >
                {released ? "Release a new version" : "Release to album"}
              </Button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* One notice at a time, the newest, as in the composing workspace: a released piece shows "On the
                album" (with the welcome's Play from the top on a return), which gives way to a newer notice. */}
            {resume && !released && (
              <Callout
                tone="info"
                title={`Welcome back. Your transcription is as you left it${saver.saved ? ` (version ${saver.saved.version})` : ""}.`}
                onDismiss={() => {
                  editorHandle()?.stop();
                  setResume(false);
                }}
                actions={
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => void playFromTop()}
                    data-testid="play-from-top"
                  >
                    Play from the top
                  </Button>
                }
              >
                Hear your draft once through, then compare it with the song (V switches, O plays both).
              </Callout>
            )}
            {released && state.trackId && !notice && (
              <Callout
                tone="success"
                title="On the album"
                actions={
                  <>
                    {resume && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void playFromTop()}
                        data-testid="play-from-top"
                      >
                        Play from the top
                      </Button>
                    )}
                    <Link
                      to="/album/$trackId"
                      params={{ trackId: state.trackId }}
                      className="text-sm text-link underline"
                    >
                      Open the track
                    </Link>
                  </>
                }
              >
                {/* Says what the header chip says, as the composing workspace does. */}
                {revising
                  ? "You are revising it. When you release again, this becomes its next version; the released ones stay as they are."
                  : "Released as it is now. Edit it to revise: a new release becomes its next version, and the released ones stay as they are."}
              </Callout>
            )}
            {notice && (
              <Callout tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                {notice.body}
              </Callout>
            )}
            <SongSource song={song} layers={layers} code={code} onReady={onSource} />
            {fm && fmState && (formHere || formSettledNow) && (
              <FormMapPanel
                storeId={`${def.id}.${initialSketch ?? "new"}`}
                bars={song.answerKey.bars}
                pickup={song.pickup !== undefined}
                state={fmState}
                known={songFormMap(song)}
                feedback={formFeedback}
                busy={busy === fm.check.id}
                onCheck={(m) => void checkForm(m, false)}
                onReveal={(m) => void checkForm(m, true)}
                onSection={(from, to) => onBars(from, to)}
              />
            )}
            {changesRow?.open && (
              <section aria-label="The changes" className="flex flex-col gap-1.5" data-testid="x2-changes">
                {chart ? (
                  <ChangesChart
                    chart={chart}
                    onChart={writeChart}
                    bars={song.answerKey.bars}
                    meter={song.meter}
                    keySpec={song.key}
                    bpm={song.bpm}
                    swing={song.swing !== undefined}
                    marks={changesMarks}
                    firstCycle={pickup ? 1 : 0}
                    disabled={busy !== null}
                    onSubmit={() => void runCheck(changesRow, false)}
                  />
                ) : (
                  <p className="text-sm text-text-2">
                    Your <code className="font-mono">chords:</code> line is written your own way, so the chart
                    leaves it alone. Write one chord a bar in{" "}
                    <code className="font-mono">chord("&lt;…&gt;")</code> and the chart follows it.
                  </p>
                )}
              </section>
            )}
            {feedback && (
              <FeedbackView
                fb={feedback}
                rows={rows}
                sections={sectionNames}
                onDismiss={() => setFeedback(null)}
              />
            )}
            {revealedRow && <Revealed song={song} row={revealedRow} sections={sectionNames} />}
            <Workbench
              tutorBars
              id={slug(def.id)}
              onModel={onHarmony}
              code={initialCode}
              lessonCtx={{
                key: song.key,
                meter: song.meter,
                defaultBpm: song.bpm,
                loopBars: Math.max(1, Math.min(64, songCycles(song))),
              }}
              {...(song.pickup ? { pickup: song.pickup } : {})}
              lint={{ profile: "graded", unlocked, allowPreview: false, meter: song.meter, key: song.key }}
              views={["roll", "staff"]}
              onChange={(c) => {
                // A check reads `codeRef`: set it now, not at the next render. Under load a Check pressed in the
                // frame after an edit graded the code before it (the CF-T session 1 race of the Wave 6 run).
                codeRef.current = c;
                setCode(c);
                saver.changed(c);
                source.current?.setMine(c);
              }}
              onEvaluated={(o) => {
                if (o.ok) saver.saveQuietly(o.code, true);
              }}
            />
          </div>
        </div>
      </section>
      {releaseOpen && piece && saver.sketchId && (
        <ReleaseDialog
          def={def}
          state={state}
          official={piece}
          flavour={null}
          sessionId={sessionId}
          sketchId={saver.sketchId}
          review={review.review}
          includeReviewDefault={boot.data?.settings.linerNotesInAlbum ?? true}
          notesFor={notesFor(piece)}
          tags={
            staged
              ? [
                  "Bass lines by ear",
                  "Changes by ear",
                  "Melodic dictation",
                  ...(song.swing ? ["Swing feel"] : []),
                ]
              : ["Melodic dictation", "Phrase structure", ...(theory.length > 1 ? ["Chords by ear"] : [])]
          }
          defaultTitle={track.data?.title ?? song.title}
          editor={() => editorHandle()}
          onClose={() => setReleaseOpen(false)}
          onReleased={(data) => {
            setJustReleased(codeRef.current);
            // The release is the newest event: the older notice and the welcome give way to "On the album".
            setNotice(null);
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

function CheckRowView({
  row,
  busy,
  disabled,
  confirming,
  onLoop,
  onCheck,
  onReveal,
  onConfirmReveal,
  onCancelReveal,
  sections,
}: {
  row: CheckRow;
  /** CF-T: the song's section letters, so a row reads "Section 3 (B) · changes". */
  sections: readonly string[] | null;
  busy: boolean;
  disabled: boolean;
  confirming: boolean;
  onLoop(): void;
  onCheck(): void;
  onReveal(): void;
  onConfirmReveal(): void;
  onCancelReveal(): void;
}) {
  const label = rowLabel(row, sections);
  const state = row.passed
    ? "passed"
    : row.revealed
      ? "revealed"
      : !row.open
        ? "locked"
        : row.attempts > 0
          ? "open"
          : "new";
  return (
    <li
      data-check={row.key}
      data-state={state}
      className={clsx(
        "flex flex-col gap-1.5 rounded-control border px-2.5 py-2 text-sm",
        row.passed ? "border-accent/40 bg-lane-in" : "border-border",
      )}
    >
      <div className="flex items-start gap-2">
        {row.passed ? (
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        ) : row.revealed ? (
          <Eye aria-hidden className="mt-0.5 size-4 shrink-0 text-text-3" />
        ) : !row.open ? (
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-text-3" />
        ) : (
          <CircleDot aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-2" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{label}</p>
          <p className="text-text-2">
            {row.passed
              ? `Passed${row.score !== null ? ` at ${Math.round(row.score * 100)} %` : ""}.`
              : row.revealed
                ? "Revealed: no evidence, named in the liner notes."
                : !row.open
                  ? lockedText(row)
                  : row.score !== null
                    ? `Best so far ${Math.round(row.score * 100)} % of ${Math.round(row.pass * 100)} %.`
                    : `Pass mark ${Math.round(row.pass * 100)} %.`}
          </p>
        </div>
      </div>
      {row.open && !row.passed && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={<Repeat aria-hidden className="size-3.5" />}
            onClick={onLoop}
            aria-label={`Loop ${label} in the song`}
          >
            Loop it
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<CheckCheck aria-hidden className="size-3.5" />}
            loading={busy}
            disabled={disabled}
            onClick={onCheck}
            aria-label={`Check ${label}`}
            data-testid="check-phrase"
          >
            Check
          </Button>
          {!row.revealed && !confirming && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || busy}
              onClick={onReveal}
              aria-label={`Reveal ${label}`}
            >
              Reveal
            </Button>
          )}
        </div>
      )}
      {row.passed && (
        <div>
          <Button
            size="sm"
            variant="ghost"
            icon={<Repeat aria-hidden className="size-3.5" />}
            onClick={onLoop}
            aria-label={`Loop ${label} in the song`}
          >
            Loop it
          </Button>
        </div>
      )}
      {confirming && (
        <fieldset className="rounded-control border-0 bg-surface-2 p-2">
          <legend className="sr-only">Reveal {label}?</legend>
          <p>Revealing shows the answer. This check then earns no evidence, and the liner notes name it.</p>
          <div className="mt-1.5 flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={onConfirmReveal}
              data-testid="confirm-reveal"
              autoFocus
            >
              Reveal it
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelReveal}>
              Keep listening
            </Button>
          </div>
        </fieldset>
      )}
    </li>
  );
}

function FeedbackView({
  fb,
  rows,
  sections,
  onDismiss,
}: {
  fb: Feedback;
  rows: readonly CheckRow[];
  sections: readonly string[] | null;
  onDismiss(): void;
}) {
  const row = rows.find((r) => r.key === fb.key);
  const label = row ? rowLabel(row, sections) : "The check";
  const pct = Math.round(fb.result.score * 100);
  const lines = checkLines(fb.result).slice(0, 4);
  if (fb.result.status === "error")
    return (
      <Callout tone="attention" title="That code didn't run, so nothing was checked" onDismiss={onDismiss}>
        {fb.result.messages[0]?.text ?? "Fix the error the editor shows, then check again."}
      </Callout>
    );
  if (fb.result.assist.revealed)
    return (
      <Callout tone="info" title={`${label}: revealed`} onDismiss={onDismiss}>
        Here is the answer. Write it in, then move on; the next phrase is yours to hear.
      </Callout>
    );
  return (
    <div role="status" data-testid="x1-feedback">
      <Callout
        tone={fb.passed ? "success" : "info"}
        title={
          fb.passed
            ? `${label}: that's it (${pct} %).`
            : `${label}: ${pct} % of ${Math.round((row?.pass ?? 0.85) * 100)} %. Loop it and listen again.`
        }
        onDismiss={onDismiss}
      >
        {lines.length > 0 && !fb.passed ? (
          <ul className="mt-1 list-disc pl-5">
            {lines.map((l) => (
              <li key={lineText(l)}>{lineText(l)}</li>
            ))}
          </ul>
        ) : fb.passed ? (
          "Saved with this version of your transcription."
        ) : null}
      </Callout>
    </div>
  );
}

/** The answer of a revealed check: the phrase on a staff, or the chords of a stage with their numerals. */
function Revealed({
  song,
  row,
  sections,
}: {
  song: SongDef;
  row: CheckRow;
  sections: readonly string[] | null;
}) {
  const melody = row.layer === "melody" || row.stage === null;
  const q = useQuery({
    queryKey: ["x1-reveal", song.id, JSON.stringify(row.phrase)],
    enabled: melody && row.layer !== "chords",
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const layer = song.answerKey.layers[row.layer === "bass" ? "bass" : "melody"];
      if (!layer) return null;
      const cycles = songCycles(song);
      const ev = await analyzeCode(`${tempoLine(song.bpm, song.meter)}\n\nmel: ${layer}`, {
        mode: "capstone",
        bars: cycles,
        lint: {
          profile: "content",
          unlocked: new Set(),
          allowPreview: true,
          meter: song.meter,
          key: song.key,
        },
        meter: song.meter,
      });
      if (!ev.ok) return null;
      const n = normalize(ev, { meter: song.meter, key: song.key });
      const w = phraseWindow(song, row.phrase);
      const events = n.all
        .filter((e) => !R.lt(e.onset, w.from) && R.lt(e.onset, w.to))
        .map((e) => ({ ...e, onset: R.sub(e.onset, w.from) }));
      const bars = Math.max(1, Math.ceil(R.toNum(R.sub(w.to, w.from))));
      return { events, bars };
    },
  });
  if (row.layer === "chords") {
    const chords = chordAnswer(song, row.phrase);
    return (
      <section
        aria-label="The answer"
        className="rounded-card border border-border bg-surface p-3 text-sm"
        data-testid="x1-revealed"
      >
        <p className="mb-1 font-medium">{rowLabel(row, sections)}: the answer</p>
        {chords.length === 0 ? (
          <p className="text-text-2">The answer key lists no chords for these bars.</p>
        ) : (
          <ol className="flex flex-wrap gap-x-4 gap-y-1">
            {chords.map((c) => (
              <li key={`${c.bar}.${c.beat}`}>
                <span className="font-mono text-text-3">Bar {c.bar}</span>{" "}
                {row.stage === "bass"
                  ? (c.symbol.split("/")[1] ?? c.symbol.replace(/[^A-G#b].*$/, ""))
                  : c.symbol}
                {row.stage === "rn" && c.rn ? <span className="text-text-2"> · {c.rn}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }
  return (
    <section
      aria-label="The answer"
      className="rounded-card border border-border bg-surface p-3"
      data-testid="x1-revealed"
    >
      <p className="mb-1 text-sm font-medium">{rowLabel(row, sections)}: the answer</p>
      {q.data ? (
        <ReferenceStaff events={q.data.events} bars={q.data.bars} meter={song.meter} keySpec={song.key} />
      ) : q.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <p className="text-sm text-text-2">The answer could not be drawn.</p>
      )}
    </section>
  );
}

/** The rhythm of phrase 1, given (contracts §6.6 X1): its code, shown and playable as rhythm only. */
function RhythmSkeleton({ code }: { code: string }) {
  const { oak } = useWorkbenchServices();
  const [playing, setPlaying] = useState(false);
  const player = useRef<ReturnType<typeof oak.createPatternPlayer> | null>(null);
  useEffect(
    () => () => {
      player.current?.dispose();
      player.current = null;
    },
    [],
  );
  const toggle = async () => {
    if (playing) {
      player.current?.stop();
      setPlaying(false);
      return;
    }
    try {
      await oak.unlock();
      player.current ??= oak.createPatternPlayer();
      const { cps, body } = splitTempo(code);
      const out = await player.current.load(body, {
        bars: 4,
        cps,
        lint: { profile: "studio", unlocked: new Set(), allowPreview: true, meter: "4/4", key: null },
      });
      if (!out.ok) throw new Error(out.diagnostics[0]?.message ?? "It didn't run.");
      await player.current.play();
      setPlaying(true);
    } catch (e) {
      toast.error("The rhythm didn't play", e instanceof Error ? e.message : undefined);
    }
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-border p-2" data-testid="x1-skeleton">
      <p className="text-sm font-medium">Phrase 1's rhythm, given</p>
      <pre className="overflow-x-auto rounded-control bg-surface-2 p-1.5 font-mono text-[0.75rem] leading-snug">
        {code}
      </pre>
      <Button size="sm" variant="ghost" onClick={() => void toggle()} aria-pressed={playing}>
        {playing ? "Stop the rhythm" : "Play the rhythm"}
      </Button>
    </div>
  );
}

/** "setcpm(84/4)" → cps 0.35 and the code without the tempo line (the pattern player sets the tempo). */
export function splitTempo(code: string): { cps: number; body: string } {
  const m = /^\s*setcp(m|s)\(\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*\)\s*$/m.exec(code);
  let cps = 0.5;
  if (m) {
    const v = Number(m[2]) / (m[3] ? Number(m[3]) : 1);
    cps = m[1] === "m" ? v / 60 : v;
  }
  const body = m ? code.replace(m[0], "").trim() : code;
  return { cps: Number.isFinite(cps) && cps > 0 ? cps : 0.5, body };
}
