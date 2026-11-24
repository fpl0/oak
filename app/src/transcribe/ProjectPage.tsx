// One transcription project (ux §9 Transcription Studio; contracts §6.12): the source on top (own audio as a
// waveform, a ladder item as a bar timeline), the transport (play, speed 25–100 %, transpose, fine-tune, the A–B
// loop, Source · Mine · Both), and below it the learner's Workbench beside the item's panel — a ladder item's
// givens, stages and Check, or own audio's bars, sections, notes and checklist. Keyboard-first (keys.ts).
// Wave 5: song items (L5 phrase by phrase, L6 bass → changes → melody; song.ts, SongPanel.tsx) with section,
// chorus and line marks on the timeline and "bass only" / "without melody" listening; a version imported in a
// backup is reviewed as text before it runs (c2, ImportReview.tsx); own audio's first run sets the bars by tapping
// along and a beat nudge, and a swing switch marks the swung off-beats on the grid.
import type { LadderSubmitResult, TranscriptionDetail } from "@oak/api";
import type { KeyPlanEntry, KeySpec, MeterId } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import type { EvalOutcome } from "@oak/strudel";
import { METERS, tempoLine } from "@oak/theory";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { AudioLines, ChevronLeft, MessageSquareText, Mic, Save, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.ts";
import { formatDate, formatKey } from "../lib/format.ts";
import { usePageTitle } from "../lib/nav.ts";
import {
  apiQuery,
  useTranscriptionAddVersion,
  useTranscriptionDelete,
  useTranscriptionPatch,
  useTranscriptions,
} from "../lib/queries.ts";
import { useUnlockedSet } from "../lib/unlocked.ts";
import { appWorkbenchServices } from "../lib/workbench-services.ts";
import { currentSessionId } from "../session/store.ts";
import { studioLint } from "../studio/model.ts";
import {
  askTranscriptionReview,
  clearSubject,
  openTutor,
  patchSubject,
  registerTutorHost,
  setSubject,
} from "../tutor/context.ts";
import { ReviewCards } from "../tutor/ReviewCard.tsx";
import { useSubjectHarmony } from "../tutor/use-subject-harmony.ts";
import { IS_MAC, keyScope, useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { formatKeys } from "../ui/keys/keymap.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Card, Chip, Kbd, Skeleton } from "../ui/kit/basics.tsx";
import { Callout, SegmentedControl } from "../ui/kit/Controls.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { useThemeName } from "../ui/theme/use-theme-name.ts";
import { useVoice } from "../voice/use-voice.ts";
import "../workbench/index.ts";
import { ServicesGate } from "../workbench/ServicesGate.tsx";
import { Workbench } from "../workbench/Workbench.tsx";
import { FormMapStrip } from "./FormMap.tsx";
import {
  type BarClock,
  barsInRecording,
  emptyFormMap,
  type FormMap,
  formComment,
  formMapOfRegions,
  toggleCut,
  withFormComment,
  withFormRegions,
} from "./form-map.ts";
import {
  addTap,
  barAt,
  beatSecOfGrid,
  bpmFromTaps,
  type ClaveSpec,
  downbeatFromTaps,
  feelOfOnsets,
  type GridFeel,
  gridOf,
  isCompound,
  isOddEighths,
  type Loop,
  loopOf,
  loopOfBars,
  nextClave,
  nudgeDownbeat,
  playheadAt,
  setLoopPoint,
  shiftLoop,
  stepBar,
  stepCents,
  stepRate,
  stepSemitones,
  TAPS_KEPT,
} from "./grid.ts";
import { HumDialog } from "./HumDialog.tsx";
import type { HumTarget } from "./hum.ts";
import { ImportReview, needsReview } from "./ImportReview.tsx";
import { PRIVACY_COPY } from "./import.ts";
import { keyAtBar, keyPlanText, keyRibbon, keySpansOf } from "./keyplan.ts";
import { type TranscribeAction, transcribeBindings } from "./keys.ts";
import { givenOfProject, LadderPanel } from "./LadderPanel.tsx";
import { type LadderLevel, REALISM_WORDS, starterCode } from "./ladder.ts";
import {
  ChecklistCard,
  FormCard,
  NotesCard,
  projectSwing,
  projectSwing16,
  readTriplets,
  SectionsCard,
  SWUNG_EIGHTHS,
  SWUNG_SIXTEENTHS,
  swingMeter,
  TempoCard,
  writeSwing,
  writeTriplets,
} from "./OwnAudioPanel.tsx";
import { type SongFocus, SongPanel } from "./SongPanel.tsx";
import { BarTimeline, type Section, Waveform } from "./SourceView.tsx";
import { StandardPanel, useStandard } from "./StandardPanel.tsx";
import {
  chorusSpans,
  cycleOfBar,
  isSongLevel,
  LISTEN_LABEL,
  LISTEN_MODES,
  type ListenMode,
  lineSpans,
  listenAllowed,
  listenMutes,
  rememberedItem,
  type SongGiven,
  type SongLevel,
  songGivenOf,
  songStarter,
  spanAt,
  spanLoop,
  stageListenMode,
  timelineMarks,
} from "./song.ts";
import { isStandardLevel, standardStarter } from "./standard.ts";
import { TransportControls } from "./TransportControls.tsx";
import { useRememberSettings, useTranscribeTransport, useTransportState } from "./use-transport.ts";

const SOURCE_LABEL = {
  "own-audio": "your audio",
  "pd-song": "public-domain song",
  generated: "ladder",
} as const;
const ZOOMS = [0, 100, 200, 400, 800] as const;
/**
 * The spectrogram analyses every sample of the file in one go on the page's thread: about 0.17 s of a frozen page
 * per minute of audio (a 40-minute file froze it for 7 s). Longer recordings show the waveform only.
 */
export const SPECTROGRAM_MAX_SEC = 8 * 60;

/** What `useStandard` is given on a page that shows no standard (hooks run for every project). */
const FALLBACK_GIVEN: SongGiven = {
  songId: null,
  title: "",
  year: null,
  bpm: 100,
  meter: "4/4",
  key: null,
  pickupBeats: null,
  bars: 1,
  phrases: [],
  swing: false,
  form: null,
};

function ownAudioStarter(p: TranscriptionDetail, swing = false): string {
  const bpm = Math.round(p.bpm ?? 90);
  const key: KeySpec = p.key ?? { tonic: "C", mode: "major" };
  const meter = (p.meter ?? "4/4") as MeterId;
  const feel = !swing
    ? ""
    : projectSwing16(p)
      ? "\n// Swing 16ths: write straight 16ths; .swingBy(1/3, 8) plays them swung."
      : "\n// Swing 8ths: write straight eighths; .swingBy(1/3, 4) plays them swung.";
  return `${tempoLine(bpm, meter)}\n// ${p.title} · ${formatKey(key)}${feel}\n\nmelody: n("0").scale("${key.tonic}4:${key.mode.replace(/ /g, ":")}").s("piano")\n`;
}

/**
 * `inSession`: the project runs as a gym session's New block (session/host/GymBlock.tsx). The session keeps its
 * own page title, and the way back to the list and Delete stay out of the session (both are on /transcribe).
 */
export function ProjectPage({
  project,
  inSession = false,
}: {
  project: TranscriptionDetail;
  inSession?: boolean;
}) {
  const id = project.id;
  const pattern = project.player === "pattern";
  const level = (project.ladderLevel ?? 1) as LadderLevel;
  const songLevel: SongLevel | null =
    pattern && isSongLevel(project.ladderLevel) ? (level as SongLevel) : null;
  // Wave 6, L8: a standard in four stages (form, bass, changes, melody); its form is never among the givens.
  const standard = pattern && isStandardLevel(project.ladderLevel);
  // The song pool is read only for a song item (a server without it answers 501, never on other pages).
  const songs = useQuery({ ...apiQuery("ladder.songs"), enabled: songLevel !== null || standard });
  const listedSong = songs.data?.items.find((x) => x.songId === project.songId) ?? null;
  const songGiven = useMemo(() => {
    if (!songLevel && !standard) return null;
    const g = songGivenOf(project, rememberedItem(project.id), listedSong);
    if (!standard) return g;
    // A standard's feel is given: the server's word for it, else what its own rhythm section plays.
    const meter = g.meter;
    const onsets = (project.stimulus?.events ?? []).map((e) => R.toNum(e.onset));
    return {
      ...g,
      swing: project.given?.swing !== undefined ? g.swing : feelOfOnsets(onsets, meter) === "swing",
    };
  }, [songLevel, standard, project, listedSong]);
  const songPickup = songGiven?.pickupBeats !== null && songGiven !== null;
  const [focus, setFocus] = useState<SongFocus>({ span: null, marks: null, stage: null });
  const navigate = useNavigate();
  const theme = useThemeName();
  const voice = useVoice();
  const { unlocked } = useUnlockedSet();
  const patch = useTranscriptionPatch();
  const addVersion = useTranscriptionAddVersion();
  const del = useTranscriptionDelete();
  usePageTitle(inSession ? "Session" : project.title);

  // --- the bar grid and the transport ------------------------------------------------------------------
  const given = useMemo(() => givenOfProject(project), [project]);
  const grid = pattern
    ? project.stimulus
      ? { downbeatS: 0, barSec: 1 / project.stimulus.cps }
      : null
    : gridOf(project.bpm, project.meter, project.downbeatS);
  const [attempt, setAttempt] = useState(0);
  const load = useTranscribeTransport(project, pattern ? null : grid, attempt);
  const transport = load.kind === "ready" ? load.transport : null;
  const state = useTransportState(transport);
  useRememberSettings(id, state);

  // The playhead between the engine's position updates (tap tempo needs better than 50 ms).
  // Read from the transport itself (not React state): keys pressed in quick succession see every change.
  const stamp = useRef({ t: 0, at: 0 });
  useEffect(
    () =>
      transport?.subscribe((s) => {
        if (s.time !== stamp.current.t) stamp.current = { t: s.time, at: performance.now() };
      }),
    [transport],
  );
  const timeNow = useCallback(() => {
    const s = transport?.state;
    if (!s) return 0;
    // Between the engine's position updates the playhead is extrapolated from the last one (`playheadAt`).
    if (!s.playing) return s.time;
    return playheadAt(stamp.current, performance.now(), s.time, s.rate, s.durationS);
  }, [transport]);

  // --- the learner's code ----------------------------------------------------------------------------
  const latest = project.versions.at(-1) ?? null;
  const starter = () =>
    standard && songGiven
      ? standardStarter(songGiven)
      : songLevel && songGiven
        ? songStarter(songLevel, songGiven)
        : pattern
          ? starterCode(level, given)
          : ownAudioStarter(project, projectSwing(project));
  // c2: a version imported in a backup is shown as text until the learner reviews it; the editor starts fresh.
  const [reviewing, setReviewing] = useState<{ version: number; code: string } | null>(() =>
    latest && needsReview(latest) ? { version: latest.version, code: latest.code } : null,
  );
  const [seed, setSeed] = useState(() => ({
    code: latest && !needsReview(latest) ? latest.code : starter(),
    n: 0,
  }));
  // The L6 chart reads the code as it is typed (a short pause after each edit).
  const [liveCode, setLiveCode] = useState(seed.code);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(seed.code);
  const lastRunOk = useRef<string | null>(null);
  const draftCode = useRef<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(project.currentVersion);
  useEffect(() => {
    if (transport) void transport.setMineCode(live.current);
  }, [transport]);
  const onChange = useCallback(
    (code: string) => {
      live.current = code;
      if (songLevel !== 6 && !standard) return;
      if (liveTimer.current) clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(() => setLiveCode(code), 300);
    },
    [songLevel, standard],
  );
  useEffect(
    () => () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
    },
    [],
  );
  // Own audio: while the editor still holds the untouched starter, it follows the tempo, key and feel the learner
  // sets (the tapped tempo goes into setcpm); once they edit it, it is theirs.
  const ownStarter = useRef<string | null>(
    !pattern && seed.code === ownAudioStarter(project, projectSwing(project)) ? seed.code : null,
  );
  /** Puts code in the editor (a hum draft, an opened version, the chart written in, a reviewed import). */
  const putCode = (code: string) => {
    live.current = code;
    setLiveCode(code);
    setSeed((x) => ({ code, n: x.n + 1 }));
    void transport?.setMineCode(code);
  };
  const putCodeRef = useRef(putCode);
  putCodeRef.current = putCode;
  const onEvaluated = useCallback(
    (o: EvalOutcome) => {
      if (!o.ok) return;
      lastRunOk.current = o.code;
      void transport?.setMineCode(o.code);
    },
    [transport],
  );
  // Before anything plays "mine", the transport hears the code as it is now.
  const syncMine = () => transport?.setMineCode(live.current);

  const saveVersion = async () => {
    const code = live.current;
    try {
      const r = await addVersion.mutateAsync({
        params: { id },
        body: {
          sessionId: currentSessionId(),
          code,
          result: null,
          ranOk: lastRunOk.current === code,
          machineDraft: draftCode.current === code,
        },
      });
      setSavedVersion(r.currentVersion);
      toast.success(`Saved v${r.currentVersion}`);
    } catch (e) {
      toast.error("Couldn't save the version", e instanceof Error ? e.message : undefined);
    }
  };

  // --- the tutor's subject: this project (code only; never the audio) -------------------------------
  const thread = useMemo(() => ({ subjectKind: "transcription" as const, subjectId: id }), [id]);
  useEffect(() => {
    setSubject({
      thread,
      title: project.title,
      tutorOpen: true,
      code: live.current,
      key: project.key,
      ...(savedVersion > 0 ? { transcriptionVersion: savedVersion } : {}),
    });
    return () => clearSubject(thread);
  }, [thread, project.title]);
  useEffect(() => {
    if (savedVersion > 0) patchSubject(thread, { transcriptionVersion: savedVersion });
  }, [thread, savedVersion]);
  const onModel = useSubjectHarmony(thread);
  const requestReview = () => {
    const r = askTranscriptionReview({
      projectId: id,
      title: project.title,
      code: live.current,
      ...(savedVersion > 0 ? { version: savedVersion } : {}),
    });
    if (!r.ok) openTutor();
  };
  const [lastResult, setLastResult] = useState<LadderSubmitResult | null>(null);
  useEffect(() => {
    if (lastResult) patchSubject(thread, { lastResult: lastResult.result, code: live.current });
  }, [lastResult, thread]);
  // --- a standard (L8): the form map, the stage and the section worked now -----------------------------
  // Where the bars sit in source seconds: the map is kept as the project's `section` regions (a backup exports it).
  const patternClock: BarClock | null =
    pattern && grid ? { firstBarS: songPickup ? grid.barSec : 0, barSec: grid.barSec } : null;
  const std = useStandard({
    project,
    given: songGiven ?? FALLBACK_GIVEN,
    listed: standard ? listedSong : null,
    clock: standard ? patternClock : null,
    formLetters: standard ? (project.given?.form ?? null) : null,
    getCode: () => live.current,
    setCode: (code) => putCodeRef.current(code),
    onResult: setLastResult,
  });
  const stdView = standard ? std.view : null;
  // The song's key plan (contracts §6.8), when it changes key: a ribbon over the timeline, and each section's
  // chart read in the key in force there. `given.keyPlan` is requested of the server (apiNotes); read when present.
  const keyPlan =
    (project.given as { keyPlan?: readonly KeyPlanEntry[] | null } | undefined)?.keyPlan ??
    (rememberedItem(project.id)?.given as { keyPlan?: readonly KeyPlanEntry[] | null } | undefined)
      ?.keyPlan ??
    null;
  const keySpans = useMemo(
    () =>
      songGiven ? keySpansOf(keyPlan, songGiven.key, songGiven.bars, songGiven.pickupBeats !== null) : [],
    [keyPlan, songGiven],
  );

  useEffect(
    () =>
      registerTutorHost({
        thread,
        // Bars count from the first full bar (c4): after a song's pickup, bar n is cycle n.
        showBars: (from, to) => {
          if (grid && transport)
            transport.setLoop(loopOfBars(grid, cycleOfBar(from, songPickup), to - from + 1));
        },
      }),
    [thread, transport, grid?.barSec, grid?.downbeatS, songPickup],
  );

  // --- source view ------------------------------------------------------------------------------------
  const [zoomAt, setZoomAt] = useState(0);
  const [spectrogramOn, setSpectrogram] = useState(false);
  const tooLongForSpectrogram =
    load.kind === "ready" && load.buffer !== null && load.buffer.duration > SPECTROGRAM_MAX_SEC;
  const spectrogram = spectrogramOn && !tooLongForSpectrogram;
  const sections: Section[] = project.regions
    .filter((r) => r.kind === "section")
    .map((r) => ({ id: r.id, label: r.label, startS: r.startS, endS: r.endS }));
  const saveRegions = (next: typeof project.regions) =>
    patch.mutate(
      { params: { id }, body: { regions: next } },
      { onError: (e) => toast.error("Couldn't save the sections", e.message) },
    );

  // Own audio (L7): the recording's form on a strip under the waveform, kept as the project's sections.
  const ownClock: BarClock | null =
    !pattern && grid ? { firstBarS: grid.downbeatS, barSec: grid.barSec } : null;
  const ownDuration = load.kind === "ready" && load.buffer ? load.buffer.duration : 0;
  const ownBars = ownClock && ownDuration > 0 ? barsInRecording(ownDuration, ownClock) : 0;
  const [ownDraft, setOwnDraft] = useState<FormMap | null>(null);
  const savedOwnMap = useMemo(
    () =>
      ownClock && ownBars > 0
        ? (formMapOfRegions(project.regions, ownClock, ownBars) ?? emptyFormMap(ownBars))
        : null,
    [project.regions, ownClock?.firstBarS, ownClock?.barSec, ownBars],
  );
  useEffect(() => setOwnDraft(null), [savedOwnMap]);
  const ownMap = ownDraft ?? savedOwnMap;
  const saveOwnMap = (m: FormMap) => {
    if (!ownClock) return;
    setOwnDraft(m);
    saveRegions(withFormRegions(project.regions, m, ownClock));
  };
  const ownMapped = ownMap !== null && (ownMap.cuts.length > 1 || Boolean(ownMap.labels[0]));
  const [formCursor, setFormCursor] = useState(1);

  const [pendingA, setPendingA] = useState<number | null>(null);

  // --- tap tempo ----------------------------------------------------------------------------------------
  const [taps, setTapsState] = useState<number[]>([]);
  const tapsRef = useRef<number[]>([]);
  const setTaps = (next: number[]) => {
    tapsRef.current = next;
    setTapsState(next);
  };
  const applyGrid = (p: { bpm?: number; downbeatS?: number; meter?: MeterId; key?: KeySpec | null }) =>
    patch.mutate(
      { params: { id }, body: p },
      { onError: (e) => toast.error("Couldn't save the tempo", e.message) },
    );
  const tap = () => {
    if (!transport?.state.playing) {
      void transport?.play();
      toast.info("Tap T on each beat", "Start on a bar's first beat; eight taps set the bars.");
      return;
    }
    const next = addTap(tapsRef.current, timeNow());
    setTaps(next);
    if (next.length === TAPS_KEPT) {
      const bpm = bpmFromTaps(next);
      const down = downbeatFromTaps(next);
      if (bpm !== null && down !== null) {
        applyGrid({ bpm, downbeatS: down, ...(project.meter ? {} : { meter: "4/4" }) });
        toast.success(`Bars set: ${Math.round(bpm)} BPM`, "Bar lines are on the waveform now.");
        setTaps([]);
      }
    }
  };

  // --- hum it -------------------------------------------------------------------------------------------
  const [humOpen, setHumOpen] = useState(false);
  const humTarget: HumTarget =
    pattern && (level === 2 || level === 3 || (songLevel === 6 && focus.stage === "bass"))
      ? "bass"
      : "melody";
  const humPlan = {
    key: project.key ?? given.key ?? { tonic: "C", mode: "major" },
    bpm: project.bpm ?? given.bpm,
    meter: (project.meter ?? "4/4") as MeterId,
    bars: songGiven ? (project.stimulus?.bars ?? songGiven.bars) : pattern ? given.bars : 4,
    target: humTarget,
  };

  // --- own audio's feel; a song's phrases, lines and choruses; listening to one layer -----------------
  // The own-audio feel is kept with the project on the server (`settings.swing`, PATCH { swing }).
  const [swing, setSwingState] = useState(() => !pattern && projectSwing(project));
  // Wave 7: swung 16ths (`settings.swing.subdivision` 16), the funk and neo-soul feel of R1.L02.
  const [swing16, setSwing16State] = useState(() => !pattern && projectSwing16(project));
  const setSwing = (on: boolean, sixteenths = false) => {
    const v = on && swingMeter(project.meter);
    setSwingState(v);
    setSwing16State(v && sixteenths);
    writeSwing(id, v);
    patch.mutate(
      { params: { id }, body: { swing: v ? (sixteenths ? SWUNG_SIXTEENTHS : SWUNG_EIGHTHS) : null } },
      { onError: (e) => toast.error("Couldn't save the feel", e.message) },
    );
  };
  // Wave 7: the two-bar clave grid over the bars (K cycles son 3-2, son 2-3, rumba 3-2, rumba 2-3, off).
  const [clave, setClave] = useState<ClaveSpec | null>(null);
  // Wave 6: triplets on the grid (a third feel), and a compound meter's beat in three whatever the feel.
  const [triplets, setTripletsState] = useState(() => !pattern && readTriplets(id));
  const ownFeel: GridFeel = swing ? (swing16 ? "swing16" : "swing") : triplets ? "triplet" : "straight";
  const setFeel = (f: GridFeel) => {
    const t = f === "triplet" && !isCompound(project.meter);
    setTripletsState(t);
    writeTriplets(id, t);
    const want = f === "swing" || f === "swing16";
    if (want !== swing || (f === "swing16") !== swing16) setSwing(want, f === "swing16");
  };
  // A pattern source's feel is given (a song's swing) or read from what its rhythm section plays (triplets).
  const sourceFeel: GridFeel = useMemo(() => {
    if (!pattern) return "straight";
    if (songGiven?.swing) return "swing";
    const onsets = (project.stimulus?.events ?? []).map((e) => R.toNum(e.onset));
    const f = feelOfOnsets(onsets, project.meter);
    return f === "triplet" ? "triplet" : "straight";
  }, [pattern, songGiven?.swing, project.stimulus, project.meter]);
  const unitsPerBar = METERS[(project.meter ?? "4/4") as MeterId]?.unitsPerBar ?? 4;
  useEffect(() => {
    if (pattern || ownStarter.current === null) return;
    if (live.current !== ownStarter.current) {
      ownStarter.current = null;
      return;
    }
    const next = ownAudioStarter(project, swing);
    if (next === live.current) return;
    ownStarter.current = next;
    putCode(next);
  }, [project.bpm, project.key?.tonic, project.key?.mode, project.meter, swing]);
  /** The code stage worked now: L6's (the song panel reports it) or the standard's. */
  const workStage = standard ? (std.codeStage ?? null) : focus.stage;
  /**
   * The spans the digit keys loop: a song's phrases (L5) or 4-bar lines (L6), a standard's sections once its form
   * is mapped (4-bar lines before), a generated item's bars.
   */
  const spans: [number, number][] = songGiven
    ? stdView?.formDone
      ? stdView.sections.map((x) => [x.from, x.to] as [number, number])
      : songLevel === 5
        ? songGiven.phrases
        : lineSpans(songGiven.bars)
    : pattern
      ? Array.from({ length: given.bars }, (_, b) => [b + 1, b + 1] as [number, number])
      : [];
  const loopSpan = (span: readonly [number, number]) => {
    if (!transport || !grid) return;
    const l = spanLoop(span, songPickup, songLevel === 5 || workStage === "melody");
    transport.setLoop(loopOfBars(grid, l.fromBar, l.bars));
  };
  /** The span the loop (or the playhead) is in, as an index into `spans`. */
  const spanNow = (): number => {
    if (!grid || spans.length === 0) return -1;
    const s0 = transport?.state.loop ? transport.state.loop.startS + grid.barSec / 2 : timeNow();
    const cycle = Math.floor(barAt(grid, s0));
    // With a pickup each phrase's loop starts a bar early: the loop's second bar names it.
    const lead = songPickup && transport?.state.loop ? 1 : 0;
    const bar = songPickup ? cycle + lead : cycle + 1;
    return spanAt(spans, bar);
  };
  const realism = project.realism ?? 0;
  const canListen = (songLevel === 6 || standard) && listenAllowed(realism);
  const [listen, setListen] = useState<ListenMode>("full");
  useEffect(() => {
    if ((songLevel === 6 || standard) && workStage) setListen(stageListenMode(workStage));
  }, [songLevel, standard, workStage]);
  useEffect(() => {
    if (!transport) return;
    transport.setSourceMutes(canListen ? listenMutes(listen, transport.state.sourceTracks ?? []) : []);
  }, [transport, listen, canListen]);
  // A standard is written section by section in consts: a hummed line has no one line to land in.
  const humAllowed = !(pattern && (level === 1 || standard));

  // --- keys -------------------------------------------------------------------------------------------
  const act = (a: TranscribeAction, n?: number) => {
    if (!transport) return;
    const state = transport.state;
    const dur = state.durationS;
    switch (a) {
      case "play":
        if (!state.playing && state.side !== "source") void syncMine();
        void transport.toggle();
        return;
      case "setA":
      case "setB": {
        const t = timeNow();
        // With no loop yet, [ marks A and ] closes the loop there; with a loop, each moves its own end.
        if (a === "setA" && !state.loop) {
          setPendingA(t);
          return;
        }
        const l =
          a === "setB" && pendingA !== null
            ? loopOf(pendingA, t, dur)
            : setLoopPoint(state.loop, a === "setA" ? "A" : "B", t, dur, grid);
        setPendingA(null);
        if (l) transport.setLoop(l);
        return;
      }
      case "loop":
        setPendingA(null);
        transport.setLoop(state.loop ? null : defaultLoop());
        return;
      case "rateDown":
      case "rateUp":
        transport.setRate(stepRate(state.rate, a === "rateUp" ? 1 : -1));
        return;
      case "semiDown":
      case "semiUp":
        transport.setSemitones(stepSemitones(state.semitones, a === "semiUp" ? 1 : -1));
        return;
      case "centsDown":
      case "centsUp":
        if (state.cents !== null) transport.setCents(stepCents(state.cents, a === "centsUp" ? 1 : -1));
        return;
      case "abToggle":
        void syncMine()?.then(() => transport.setSide(transport.state.side === "source" ? "mine" : "source"));
        return;
      case "overlay":
        void syncMine()?.then(() => transport.setSide(transport.state.side === "both" ? "source" : "both"));
        return;
      case "tap":
        tap();
        return;
      case "prevBar":
      case "nextBar":
        if (state.loop) transport.setLoop(shiftLoop(state.loop, grid, a === "nextBar" ? 1 : -1, dur));
        else if (grid && transport.canSeek)
          transport.seek(stepBar(grid, timeNow(), a === "nextBar" ? 1 : -1, dur));
        return;
      case "zoomIn":
      case "zoomOut":
        setZoomAt((z) => Math.max(0, Math.min(ZOOMS.length - 1, z + (a === "zoomIn" ? 1 : -1))));
        return;
      case "spectrogram":
        setSpectrogram((s) => !s);
        return;
      case "loopLine": {
        const span = spans[(n ?? 1) - 1];
        if (span) loopSpan(span);
        return;
      }
      case "prevLine":
      case "nextLine": {
        const at = spanNow();
        const to = Math.max(0, Math.min(spans.length - 1, at < 0 ? 0 : at + (a === "nextLine" ? 1 : -1)));
        const span = spans[to];
        if (span) loopSpan(span);
        return;
      }
      case "loopChorus": {
        if (!songGiven || !grid) return;
        const chorus =
          songLevel === 6
            ? (chorusSpans(songGiven.bars)[
                Math.max(
                  0,
                  chorusSpans(songGiven.bars).findIndex((c) => {
                    const bar = songPickup
                      ? Math.floor(barAt(grid, timeNow()))
                      : Math.floor(barAt(grid, timeNow())) + 1;
                    return bar >= c[0] && bar <= c[1];
                  }),
                )
              ] ?? [1, songGiven.bars])
            : ([1, songGiven.bars] as [number, number]);
        const l = spanLoop(chorus, songPickup, songLevel === 5);
        const want = loopOfBars(grid, l.fromBar, l.bars);
        const same =
          state.loop !== null &&
          Math.abs(state.loop.startS - want.startS) < 1e-3 &&
          Math.abs(state.loop.endS - want.endS) < 1e-3;
        transport.setLoop(same ? null : want);
        return;
      }
      case "listenBass":
      case "listenNoMelody": {
        const mode: ListenMode = a === "listenBass" ? "bass" : "no-melody";
        setListen((m) => (m === mode ? "full" : mode));
        return;
      }
      case "downbeatEarlier":
      case "downbeatLater": {
        if (!grid || project.downbeatS === null) return;
        const next = nudgeDownbeat(
          project.downbeatS,
          beatSecOfGrid(grid, project.meter as MeterId),
          a === "downbeatLater" ? 1 : -1,
        );
        if (next !== null) applyGrid({ downbeatS: next });
        return;
      }
      case "swing":
        setSwing(!(swing && !swing16));
        return;
      case "swing16":
        setSwing(!swing16, true);
        return;
      case "clave":
        setClave((c) => nextClave(c));
        return;
      case "formCut": {
        // A section starts at the bar the playhead is in (the loop's first bar while a loop plays).
        const bar = barNow();
        if (bar === null || bar < 1) return;
        if (stdView && !stdView.formDone) {
          stdView.setMap(toggleCut(stdView.map, bar));
          setFormCursor(bar);
        } else if (!pattern && ownMap && ownClock) {
          saveOwnMap(toggleCut(ownMap, bar));
          setFormCursor(bar);
        }
        return;
      }
      case "formFocus":
        root.current?.querySelector<HTMLElement>('[data-testid="form-strip"]')?.focus();
        return;
    }
  };
  /** The 1-based bar at the playhead (0: a song's pickup bar), `null` without a bar grid. */
  const barNow = (): number | null => {
    if (!grid || !transport) return null;
    const at = transport.state.loop ? transport.state.loop.startS + 1e-3 : timeNow();
    const cycle = Math.floor(barAt(grid, at) + 1e-6);
    return pattern ? (songPickup ? cycle : cycle + 1) : cycle + 1;
  };
  const defaultLoop = (): Loop | null => {
    if (!transport) return null;
    if (grid) {
      const bar = Math.max(0, Math.floor((timeNow() - grid.downbeatS) / grid.barSec));
      return loopOfBars(grid, bar, 1);
    }
    return setLoopPoint(null, "A", timeNow(), transport.state.durationS, null);
  };
  const OWN_AUDIO_ONLY: readonly TranscribeAction[] = [
    "centsDown",
    "centsUp",
    "tap",
    "zoomIn",
    "zoomOut",
    "spectrogram",
    "downbeatEarlier",
    "downbeatLater",
    "swing",
    "swing16",
  ];
  const enabled = (a: TranscribeAction) => {
    if (!transport) return false;
    if (a === "formCut") return stdView ? !stdView.formDone : !pattern && grid !== null && ownMap !== null;
    if (a === "formFocus") return stdView !== null || (!pattern && ownMap !== null);
    if (a === "spectrogram" && tooLongForSpectrogram) return false;
    if (pattern && OWN_AUDIO_ONLY.includes(a)) return false;
    if (pattern && (a === "prevBar" || a === "nextBar")) return transport.state.loop !== null;
    if (a === "loopLine" || a === "prevLine" || a === "nextLine") return spans.length > 0 && grid !== null;
    if (a === "loopChorus") return songGiven !== null;
    if (a === "listenBass" || a === "listenNoMelody") return canListen;
    if (a === "downbeatEarlier" || a === "downbeatLater") return grid !== null && project.downbeatS !== null;
    if (a === "swing" || a === "swing16") return swingMeter(project.meter) && !isOddEighths(project.meter);
    if (a === "clave") return grid !== null || pattern;
    return true;
  };
  useHotkeys(transcribeBindings(act, enabled));
  useHotkeys(
    pattern
      ? []
      : [
          {
            id: "transcribe:save",
            keys: "Mod+S",
            scope: "transcription",
            group: "Transcribe",
            description: "Save a version of your code",
            allowInInput: true,
            run: () => void saveVersion(),
          },
        ],
  );

  // Keys act from the first moment: focus the page (not a control) once it is up — unless the learner already
  // put focus on a control of the page around it (the gym's "Finish the gym session" in a session): a late audio
  // load must not move it away (gate: Enter on the focused Finish button did nothing under load).
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (load.kind !== "ready") return;
    const active = document.activeElement as HTMLElement | null;
    if (root.current?.contains(active)) return;
    const elsewhere = active !== null && active !== document.body && active.closest("main") !== null;
    if (!elsewhere) root.current?.focus();
  }, [load.kind]);

  // Own audio: the recording goes with the project unless another project uses it (as Settings › Data does);
  // one native confirm names both (contracts §11.6).
  const all = useTranscriptions();
  const sharedWith = pattern
    ? 0
    : (all.data?.items ?? []).filter(
        (t) => t.id !== id && t.audioId !== null && t.audioId === project.audioId,
      ).length;
  const remove = async () => {
    const versions = `${project.versions.length} version${project.versions.length === 1 ? "" : "s"}`;
    const question = pattern
      ? `Delete the transcription “${project.title}” and its ${versions}? This cannot be undone.`
      : sharedWith > 0
        ? `Delete the transcription “${project.title}” and its ${versions}? The recording stays, because another project uses it. This cannot be undone.`
        : `Delete the transcription “${project.title}”, its ${versions} and its recording? This cannot be undone; a backup you exported earlier still has it.`;
    try {
      const r = await del.mutateAsync({ target: id, question, input: { params: { id } } });
      if (!r) return;
      if (!pattern && project.audioId && sharedWith === 0) {
        try {
          await api().destructive("audio.delete", project.audioId, { params: { id: project.audioId } });
        } catch (e) {
          toast.error(
            "The recording was kept",
            e instanceof Error ? `The project is deleted; its audio file stays: ${e.message}` : undefined,
          );
        }
      }
      void navigate({ to: "/transcribe" });
    } catch (e) {
      toast.error("Couldn't delete it", e instanceof Error ? e.message : undefined);
    }
  };

  const lessonCtx = {
    key: project.key ?? given.key,
    meter: (project.meter ?? "4/4") as MeterId,
    defaultBpm: Math.round(project.bpm ?? given.bpm),
    loopBars: songLevel || standard ? (project.stimulus?.bars ?? given.bars) : pattern ? given.bars : 4,
  };
  const lint = studioLint(unlocked, lessonCtx.meter, lessonCtx.key);
  const sub = [
    SOURCE_LABEL[project.sourceKind],
    // The ladder level and its sound in words, as the ladder card says them (never "L3 · R1").
    pattern ? `Level ${level} · ${REALISM_WORDS[project.realism ?? 0] ?? "its own sound"}` : null,
    project.key ? formatKey(project.key) : null,
    project.bpm ? `${Math.round(project.bpm)} BPM` : null,
    project.meter,
    (songGiven?.swing ?? swing) ? (swing16 && !pattern ? "Swing 16ths" : "Swing 8ths") : null,
    !pattern && triplets && !swing && !isCompound(project.meter) ? "Triplets" : null,
  ].filter(Boolean);
  const timelineBars = project.stimulus?.bars ?? given.bars;
  const loopHint = songGiven ? (
    <>
      <Kbd>1</Kbd>–<Kbd>{Math.min(9, spans.length)}</Kbd> loop a{" "}
      {songLevel === 5 ? "phrase" : stdView?.formDone ? "section" : "line"} · <Kbd>PageUp</Kbd>{" "}
      <Kbd>PageDown</Kbd> the one before or after · <Kbd>C</Kbd>{" "}
      {songLevel === 6 ? "the chorus" : "the whole song"}
    </>
  ) : null;
  const workSpan = standard ? (stdView?.span ?? null) : focus.span;
  const current = workSpan ? spanLoop(workSpan, songPickup, songLevel === 5 || workStage === "melody") : null;
  const workMarks = standard ? (stdView?.barMarks ?? null) : focus.marks;
  const ribbon = keySpans.length > 1 ? keyRibbon(keySpans, state?.semitones ?? 0) : null;

  return (
    <div
      ref={root}
      tabIndex={-1}
      {...keyScope("transcription")}
      className="@container relative mx-auto flex w-full max-w-[96rem] flex-col gap-3 px-6 py-4 outline-none"
      data-testid="transcribe-project"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {inSession ? null : (
          <Link
            to="/transcribe"
            className="inline-flex items-center gap-1 rounded-control text-sm text-text-2 hover:text-text"
          >
            <ChevronLeft aria-hidden className="size-4" /> Transcribe
          </Link>
        )}
        <h1 className="min-w-0 truncate text-h2" data-testid="project-title">
          {project.title}
        </h1>
        <span className="flex flex-wrap gap-1">
          {sub.map((s) => (
            <Chip key={s as string}>{s}</Chip>
          ))}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {humAllowed ? (
            <Button
              icon={<Mic aria-hidden className="size-4" />}
              onClick={() => setHumOpen(true)}
              data-testid="hum-open"
            >
              Hum it
            </Button>
          ) : null}
          {pattern ? null : (
            <Button
              icon={<Save aria-hidden className="size-4" />}
              loading={addVersion.isPending}
              onClick={() => void saveVersion()}
              data-testid="save-version"
            >
              Save version <Kbd>{formatKeys("Mod+S", IS_MAC)}</Kbd>
            </Button>
          )}
          {inSession ? null : (
            <Button
              variant="ghost"
              icon={<Trash2 aria-hidden className="size-4" />}
              loading={del.isPending}
              onClick={() => void remove()}
            >
              Delete
            </Button>
          )}
        </div>
      </header>
      {pattern ? null : <p className="-mt-1 text-sm text-text-3">{PRIVACY_COPY}</p>}

      <Card
        className="flex flex-col gap-2 p-3"
        data-testid="source"
        data-engine={load.kind === "ready" ? (load.engine ?? "pattern") : undefined}
      >
        {load.kind === "loading" ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-[112px] w-full" />
            <p className="text-sm text-text-2">{load.step}…</p>
          </div>
        ) : load.kind === "error" ? (
          <Callout
            tone="issue"
            title="The source didn't load"
            actions={
              <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            }
          >
            {load.message}
          </Callout>
        ) : state && transport ? (
          pattern ? (
            <>
              <BarTimeline
                transport={transport}
                state={state}
                bars={timelineBars}
                pickup={songPickup}
                marks={songLevel && songGiven ? timelineMarks(songLevel, songGiven) : []}
                swing={songGiven?.swing ?? false}
                unitsPerBar={unitsPerBar}
                meter={project.meter ?? "4/4"}
                feel={sourceFeel}
                clave={clave}
                keys={ribbon}
                barButtons={!standard}
                height={standard ? 80 : 112}
                current={current}
                {...(workMarks ? { barMarks: workMarks } : {})}
              />
              {stdView ? (
                <FormMapStrip
                  map={stdView.map}
                  onChange={stdView.formDone ? undefined : stdView.setMap}
                  pickup={songPickup}
                  marks={stdView.formMarks}
                  active={stdView.active}
                  cursor={formCursor}
                  onCursor={setFormCursor}
                  onSection={(x) => {
                    loopSpan([x.from, x.to]);
                    stdView.pick(x.index);
                  }}
                  label={
                    stdView.formDone
                      ? "The form: click a section to loop it"
                      : "The form: cut the tune into sections and name them"
                  }
                  hint={
                    stdView.formDone ? null : (
                      <>
                        <Kbd>X</Kbd> cuts a section at the bar now playing · <Kbd>⇧X</Kbd> go to the strip ·
                        click a bar line to cut
                      </>
                    )
                  }
                />
              ) : null}
              {ribbon ? (
                <p className="text-sm text-text-3" data-testid="key-plan-text">
                  The key is given: {keyPlanText(keySpans)}. Write each section in the key in force there.
                </p>
              ) : null}
              {songLevel === 6 || standard ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="listen">
                  <SegmentedControl
                    label="Listen to (Shift+B bass only, Shift+M without melody)"
                    size="sm"
                    value={canListen ? listen : "full"}
                    options={LISTEN_MODES.map((m) => ({
                      value: m,
                      label: LISTEN_LABEL[m],
                      disabled: !canListen && m !== "full",
                    }))}
                    onChange={(m) => setListen(m)}
                  />
                  <span className="text-text-3">
                    {canListen
                      ? "The source only: your code plays as written."
                      : `With this sound (${REALISM_WORDS[realism] ?? "its own sound"}) the whole mix plays: hearing the part through it is the exercise.`}
                  </span>
                  {standard ? <span className="ml-auto text-text-3">{loopHint}</span> : null}
                </div>
              ) : null}
              {songGiven && !standard ? <p className="text-sm text-text-3">{loopHint}</p> : null}
            </>
          ) : load.buffer ? (
            <>
              <Waveform
                transport={transport}
                state={state}
                buffer={load.buffer}
                grid={grid}
                sections={sections}
                zoom={ZOOMS[zoomAt] ?? 0}
                spectrogram={spectrogram}
                theme={theme}
                unitsPerBar={unitsPerBar}
                swing={swing}
                meter={project.meter ?? "4/4"}
                feel={ownFeel}
                clave={clave}
              />
              {ownMap && ownBars > 1 ? (
                <FormMapStrip
                  map={ownMap}
                  onChange={saveOwnMap}
                  cursor={formCursor}
                  onCursor={setFormCursor}
                  compact={ownBars > 48}
                  onSection={(x) => {
                    if (ownClock)
                      transport.setLoop(loopOfBars(grid as NonNullable<typeof grid>, x.from - 1, x.bars));
                  }}
                  label="Form: your recording's sections, bar by bar"
                  hint={
                    <>
                      <Kbd>X</Kbd> cuts a section at the bar now playing · click a bar line to cut · click a
                      section to loop it
                    </>
                  }
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ZoomOut aria-hidden className="size-4" />}
                  disabled={zoomAt === 0}
                  onClick={() => setZoomAt((z) => Math.max(0, z - 1))}
                  aria-label="Zoom out (<)"
                >
                  Out
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ZoomIn aria-hidden className="size-4" />}
                  disabled={zoomAt === ZOOMS.length - 1}
                  onClick={() => setZoomAt((z) => Math.min(ZOOMS.length - 1, z + 1))}
                  aria-label="Zoom in (>)"
                >
                  In
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<AudioLines aria-hidden className="size-4" />}
                  aria-pressed={spectrogram}
                  disabled={tooLongForSpectrogram}
                  aria-describedby={tooLongForSpectrogram ? "spectrogram-limit" : undefined}
                  onClick={() => setSpectrogram((s) => !s)}
                  data-testid="spectrogram"
                >
                  Spectrogram {spectrogram ? "on" : "off"} <Kbd>⇧S</Kbd>
                </Button>
                {tooLongForSpectrogram ? (
                  <span id="spectrogram-limit" className="text-text-3" data-testid="spectrogram-limit">
                    for recordings up to {SPECTROGRAM_MAX_SEC / 60} minutes
                  </span>
                ) : null}
                <span className="ml-auto text-text-3">
                  {grid ? "Drag across the waveform to loop it · " : "First set the bars: tap along with "}
                  {grid ? (
                    <>
                      <Kbd>[</Kbd> <Kbd>]</Kbd> set A and B · <Kbd>T</Kbd> tap the beat
                    </>
                  ) : (
                    <Kbd>T</Kbd>
                  )}
                </span>
              </div>
            </>
          ) : null
        ) : null}
      </Card>

      {state && transport ? (
        <TransportControls
          onPlay={() => act("play")}
          onSide={(side) => void syncMine()?.then(() => transport.setSide(side))}
          state={state}
          grid={grid}
          pendingA={pendingA}
          onRate={(d) => transport.setRate(stepRate(transport.state.rate, d))}
          onSemitones={(d) => transport.setSemitones(stepSemitones(transport.state.semitones, d))}
          onCents={(d) => act(d > 0 ? "centsUp" : "centsDown")}
          onToggleLoop={() => act("loop")}
          onSetPoint={(w) => act(w === "A" ? "setA" : "setB")}
          setRate={(r) => transport.setRate(r)}
          setSemitones={(st) => transport.setSemitones(st)}
          setCents={(c) => transport.setCents(c)}
          pickup={songPickup}
        />
      ) : null}
      {state && pattern && !state.realismApplied ? (
        <p className="-mt-1 text-sm text-text-3" data-testid="realism-note">
          This item plays clean and on the grid on this build; its arrangement is still the one with{" "}
          {REALISM_WORDS[state.realism ?? 0] ?? "its own sound"}.
        </p>
      ) : null}

      <div
        className={clsx(
          "grid gap-4",
          // A standard's chart offers the seventh chords: its palette needs the wider column.
          standard
            ? "@min-[60rem]:grid-cols-[minmax(0,1fr)_23rem]"
            : "@min-[60rem]:grid-cols-[minmax(0,1fr)_20rem]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-3">
          {reviewing ? (
            <ImportReview
              projectId={id}
              version={reviewing.version}
              code={reviewing.code}
              meter={lessonCtx.meter}
              keySpec={lessonCtx.key ?? null}
              onConfirmed={(code, note) => {
                setReviewing(null);
                putCode(code);
                toast.success(`Version ${reviewing.version} is yours to run`, note ?? undefined);
              }}
              onFresh={() => {
                setReviewing(null);
                toast.info("Starting fresh", `Version ${reviewing.version} stays in Versions, as text.`);
              }}
            />
          ) : (
            <ServicesGate load={appWorkbenchServices} auto>
              <Workbench
                key={seed.n}
                id={`tr${id.replace(/[^a-z0-9]/gi, "").slice(-10)}`}
                code={seed.code}
                lessonCtx={lessonCtx}
                lint={lint}
                views={["roll", "staff"]}
                onChange={onChange}
                onEvaluated={onEvaluated}
                onModel={onModel}
                tutorBars
              />
            </ServicesGate>
          )}
          <Card className="flex flex-col gap-2 p-4" data-testid="transcription-reviews">
            <h2 className="text-h3">Claude's reviews</h2>
            <ReviewCards
              subject={thread}
              empty={
                <div className="flex flex-col items-start gap-2 text-sm">
                  <p className="text-text-2">
                    {pattern
                      ? "No review yet. Claude reads your code and the check, never the hidden answer until you've solved it."
                      : "No review yet. Claude reads your code, your checklist and the title you gave it; never the recording."}
                  </p>
                  <Button
                    size="sm"
                    icon={<MessageSquareText aria-hidden className="size-4" />}
                    onClick={requestReview}
                    data-testid="request-transcription-review"
                  >
                    Ask Claude to review it
                  </Button>
                </div>
              }
            />
          </Card>
          {pattern ? null : (
            <Versions
              project={project}
              current={savedVersion}
              onOpen={(v) => {
                if (needsReview(v)) setReviewing({ version: v.version, code: v.code });
                else putCode(v.code);
              }}
            />
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-3" aria-label={pattern ? "The item" : "Your recording"}>
          {standard && songGiven ? (
            <StandardPanel
              project={project}
              given={songGiven}
              std={std}
              code={liveCode}
              getCode={() => live.current}
              setCode={putCode}
              sectionKey={(bar) => keyAtBar(keySpans, bar)}
              onLoopSpan={loopSpan}
            />
          ) : songLevel && songGiven ? (
            <SongPanel
              project={project}
              level={songLevel}
              given={songGiven}
              code={liveCode}
              getCode={() => live.current}
              setCode={putCode}
              onResult={setLastResult}
              onFocus={setFocus}
              onLoopSpan={loopSpan}
            />
          ) : pattern ? (
            <LadderPanel
              project={project}
              given={given}
              getCode={() => live.current}
              onResult={setLastResult}
            />
          ) : (
            <>
              <TempoCard
                project={project}
                grid={grid}
                taps={taps}
                onClearTaps={() => setTaps([])}
                onApply={applyGrid}
                getTime={timeNow}
                onTap={tap}
                playing={state?.playing ?? false}
                swing={swing}
                onSwing={setSwing}
                feel={ownFeel}
                onFeel={setFeel}
                busy={patch.isPending}
              />
              {ownMap && ownClock ? (
                <FormCard
                  map={ownMap}
                  onChange={saveOwnMap}
                  onLoop={(from, to) => {
                    if (grid) transport?.setLoop(loopOfBars(grid, from - 1, to - from + 1));
                  }}
                  onWrite={() => putCode(withFormComment(live.current, formComment(ownMap)))}
                />
              ) : null}
              <SectionsCard
                sections={sections}
                loop={state?.loop ?? null}
                onAdd={(label) => {
                  if (!state?.loop) return;
                  saveRegions([
                    ...project.regions,
                    {
                      id: `s${Date.now().toString(36)}`,
                      label,
                      startS: state.loop.startS,
                      endS: state.loop.endS,
                      kind: "section",
                    },
                  ]);
                }}
                onRemove={(sid) => saveRegions(project.regions.filter((r) => r.id !== sid))}
                onLoop={(s) => transport?.setLoop({ startS: s.startS, endS: s.endS })}
              />
              <ChecklistCard project={project} withForm={ownMapped} />
              <NotesCard project={project} />
            </>
          )}
        </aside>
      </div>

      <HumDialog
        open={humOpen}
        onClose={() => setHumOpen(false)}
        plan={humPlan}
        quiet={voice.quiet.quiet}
        code={live.current}
        onUse={(code) => {
          draftCode.current = code;
          putCode(code);
          toast.info(
            "Oak's draft is in the editor",
            pattern
              ? "Fix what's off, then Check: a draft counts once you've checked it."
              : "Fix what's off, then save a version.",
          );
        }}
      />
    </div>
  );
}

function Versions({
  project,
  current,
  onOpen,
}: {
  project: TranscriptionDetail;
  current: number;
  onOpen(v: TranscriptionDetail["versions"][number]): void;
}) {
  if (project.versions.length === 0) return null;
  return (
    <Card className="p-4" data-testid="versions">
      <h2 className="mb-2 text-h3">Versions</h2>
      <ol className="flex flex-col gap-1">
        {[...project.versions].reverse().map((v) => (
          <li key={v.version} className="flex items-center gap-2 text-sm">
            <span className="font-medium">v{v.version}</span>
            <span className="text-text-3">{formatDate(v.createdAt)}</span>
            {v.version === current ? <Chip>latest</Chip> : null}
            {needsReview(v) ? <Chip tone="amber">imported</Chip> : null}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onOpen(v)}>
              {needsReview(v) ? "Review it" : "Open in the editor"}
            </Button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
