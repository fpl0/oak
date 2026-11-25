// One sketch (ux §2.3 "Studio / Sketchbook"): free play in the full Workbench. Every successful Run saves a
// version (autosave; edits not run yet survive a reload in this browser), Mod+S saves a named version, the
// history compares any earlier version with A/B, the Band layer (pop or jazz-soul kit) follows the sketch's
// key and tempo, locked tools are hints that never block (contracts §3.1 rule 4), an imported version opens
// as text until the strict check passes (§11.3), Claude can be asked for a listening note, and the code
// exports as a .js file. Oak 2.0 W1: Jam (every Run is a take; the tutor, hints, tips and compare wait; only lint
// errors show), the takes panel after a jam, Focus one part, and the editor slots other W1 tools fill.
import type { SketchDetail, SketchDimension, SketchVersion, TakeState } from "@oak/api";
import { type KeySpec, type LintResult, labelledLines, type MeterId } from "@oak/content-kit";
import { sectionsFromAst } from "@oak/grader";
import type { EditorHandle, EvalOutcome, MuteMap } from "@oak/strudel";
import { cpsToBpm, METERS } from "@oak/theory";
import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, ChevronLeft, Download, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bandMeter, bands } from "../../../content/bands/index.ts";
import { useContent } from "../lib/content.ts";
import { lessonTitles } from "../lib/content-model.ts";
import { applyToEditor } from "../lib/editors.ts";
import { FLAVOUR_LABEL, formatDate, formatKey } from "../lib/format.ts";
import { lintInBrowser } from "../lib/grader-client.ts";
import { TRACK_LENS_GATES, useLenses } from "../lib/lenses.ts";
import { usePageTitle } from "../lib/nav.ts";
import { useCourseProgress, useSketchAddVersion, useSketchDelete, useSketchPatch } from "../lib/queries.ts";
import { currentSessionId } from "../session/store.ts";
import { clearSubject, patchSubject, registerTutorHost, setSubject } from "../tutor/context.ts";
import { IS_MAC, keyScope, useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { formatKeys } from "../ui/keys/keymap.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Chip, Kbd } from "../ui/kit/basics.tsx";
import { Callout, SegmentedControl } from "../ui/kit/Controls.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import "../workbench/index.ts";
import { errorWords } from "../lib/error-words.ts";
import { appWorkbenchServices } from "../lib/workbench-services.ts";
import { sitesOf, siteTitle } from "../toolbox/model.ts";
import { useSubjectHarmony } from "../tutor/use-subject-harmony.ts";
import { ServicesGate } from "../workbench/ServicesGate.tsx";
import { Workbench } from "../workbench/Workbench.tsx";
import { BandOptions } from "./BandOptions.tsx";
import { clearDraft, readDraft, readLength, writeDraft, writeLength } from "./draft.ts";
import { EDITOR_SLOTS, type EditorSlotPlace, type EditorSlotProps } from "./editor-slots.ts";
import { FocusPanel, FocusToggle } from "./FocusPart.tsx";
import { JamBar, JamToggle } from "./JamBar.tsx";
import { JAM_TUTOR_NOTICE, JAM_WORDS, studioChrome } from "./jam.ts";
import {
  bandMutesOf,
  bandReached,
  bandSetupFor,
  bandsForMeter,
  differsFrom,
  formSoundHints,
  formSoundTips,
  harmonyViewHints,
  LENGTHS,
  type LockedHint,
  linerFlags,
  lockedHints,
  meterLabel,
  musicFactsOf,
  musicLensHints,
  musicLensTips,
  muteMapOf,
  NO_TRACK_FACTS,
  needsReview,
  type SketchBand,
  type SketchMusicFacts,
  type SketchTrackFacts,
  STUDIO_FLAVOURS,
  sameTrackFacts,
  sinceText,
  soundFactsOf,
  strictLint,
  strictVerdict,
  studioFlavour,
  studioLint,
  studioMeters,
  studioModes,
  TONICS,
  trackFactsOf,
  trackLensHints,
  trackLensTips,
  trackStarted,
  type VersionDraft,
  versionBody,
  versionLabel,
} from "./model.ts";
import { analysisForSave } from "./piece-read.ts";
import { useUnlockedSet } from "./queries.ts";
import { ReviewPanel } from "./ReviewPanel.tsx";
import { SketchCover } from "./SketchCover.tsx";
import { ExportDialog, NameVersionDialog } from "./StudioDialogs.tsx";
import { TakesPanel } from "./TakesPanel.tsx";
import { TAKES_WORDS, takesOf } from "./takes.ts";
import { VersionHistory } from "./VersionHistory.tsx";

type SaveStatus =
  | { kind: "saved"; version: number; at: string }
  | { kind: "saving" }
  | { kind: "error"; message: string };

// A style is named as everywhere else, capitalised ("Band: Oak (Jazz-soul style)").
const flavourLabel = (id: string) => FLAVOUR_LABEL[id] ?? id;

export function SketchEditor({ sketch }: { sketch: SketchDetail }) {
  const id = sketch.id;
  const navigate = useNavigate();
  const content = useContent();
  const toolbox = content.data?.toolbox ?? [];
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const { unlocked } = useUnlockedSet();
  const addVersion = useSketchAddVersion();
  const patch = useSketchPatch();
  const del = useSketchDelete();
  const progress = useCourseProgress();
  const lenses = useLenses();
  usePageTitle(sketch.title);

  const latest: SketchVersion =
    sketch.versions.find((v) => v.version === sketch.currentVersion) ??
    (sketch.versions.at(-1) as SketchVersion);

  // --- what the workbench holds -------------------------------------------------------------------
  const [meter, setMeter] = useState<MeterId>(latest.meter ?? "4/4");
  const [keySpec, setKeySpec] = useState<KeySpec | null>(latest.key);
  const [band, setBand] = useState<SketchBand | null>((latest.band as SketchBand | null) ?? null);
  const bandDef = band ? bands.find((b) => b.id === band.bandId) : undefined;
  const [length, setLength] = useState<number>(() => readLength(id) ?? Math.max(4, bandDef?.bars ?? 0));
  const [initial] = useState(() => {
    const draft = readDraft(id);
    return draft && draft.code !== latest.code && !needsReview(latest)
      ? { code: draft.code, restored: true }
      : { code: latest.code, restored: false };
  });
  const [restored, setRestored] = useState(initial.restored);
  const [seed, setSeed] = useState<{ code: string; n: number }>({ code: initial.code, n: 0 });
  const [liveCode, setLiveCode] = useState(seed.code);
  const [review, setReview] = useState<{ code: string; version: number } | null>(() =>
    needsReview(latest) ? { code: latest.code, version: latest.version } : null,
  );
  const [compare, setCompare] = useState<SketchVersion | null>(null);
  const [lint, setLint] = useState<LintResult | null>(null);
  const [status, setStatus] = useState<SaveStatus>({
    kind: "saved",
    version: latest.version,
    at: latest.createdAt,
  });
  const [naming, setNaming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const mutes = useRef<MuteMap>(muteMapOf(band));
  const lastRunOk = useRef<string | null>(null);
  const saved = useRef({ code: latest.code, key: latest.key, meter: latest.meter, band: latest.band });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const bpmRef = useRef<number | null>(latest.bpm);

  // --- Oak 2.0 W1: jam, focus, the cursor's line, the live editor (for the slots) -----------------------
  // Neither Jam nor Focus is on by default: the learner chooses.
  const [jam, setJam] = useState(false);
  const jamRef = useRef(jam);
  jamRef.current = jam;
  const chrome = studioChrome({ jam });
  const [focus, setFocus] = useState<string | null>(null);
  const [cursorLabel, setCursorLabel] = useState<string | null>(null);
  const [editorHandle, setEditorHandle] = useState<EditorHandle | null>(null);
  const [showCut, setShowCut] = useState(false);
  const [lastRunCode, setLastRunCode] = useState<string | null>(null);
  const takesHeading = useRef<HTMLHeadingElement>(null);
  const editorDomId = `studio${id.replace(/[^a-z0-9]/gi, "").slice(-10)}`;

  const bandNow = (): SketchBand | null => (band ? { ...band, mutes: bandMutesOf(mutes.current) } : null);
  const bandSetup = bandSetupFor(band, bands, keySpec, bandReached(progress.data));
  const lessonCtx = { key: keySpec, meter, defaultBpm: latest.bpm ?? 90, loopBars: length };
  const lintCtx = studioLint(unlocked, meter, keySpec);

  // --- saving ---------------------------------------------------------------------------------------
  const lengthRef = useRef(length);
  lengthRef.current = length;
  /** The bars a save's analysis reads (Oak 2.0 W3): the `arrange()` total, else the sketch's loop length. */
  const analysisBars = (code: string): number => {
    try {
      const ast = sectionsFromAst(code);
      if (ast && "totalBars" in ast && ast.totalBars > 0) return ast.totalBars;
    } catch {
      // unreadable code: the loop length
    }
    return lengthRef.current;
  };
  const save = (
    d: Omit<VersionDraft, "sessionId">,
    extra: {
      takeState?: TakeState;
      /** Oak 2.0 W3: a sibling or the next generation names its parent, generation and dimension. */
      parentVersion?: number;
      generation?: number;
      dimension?: SketchDimension;
      /** A Run's autosave: skipped when an earlier save in the queue already saved this state. */
      unlessSaved?: boolean;
    } = {},
  ): Promise<SketchVersion | null> => {
    const job = queue.current.then(async () => {
      if (extra.unlessSaved && !differsFrom(saved.current as Parameters<typeof differsFrom>[0], d))
        return null;
      setStatus({ kind: "saving" });
      try {
        // Oak 2.0 W3: the worker's analysis rides with every Studio save (the habits mirror reads it); never throws,
        // and `null` after ANALYSIS_SAVE_TIMEOUT_MS, so the save is never held up for long.
        const analysis = await analysisForSave(d.code, {
          meter: d.meter,
          key: d.key,
          bars: analysisBars(d.code),
        });
        const res = await addVersion.mutateAsync({
          params: { id },
          body: {
            ...versionBody({ ...d, sessionId: currentSessionId() }),
            analysis,
            // Oak 2.0 W1: a Run saved while Jam is on is a take.
            ...(extra.takeState === undefined ? {} : { takeState: extra.takeState }),
            ...(extra.parentVersion === undefined
              ? {}
              : {
                  parentVersion: extra.parentVersion,
                  generation: extra.generation ?? null,
                  dimension: extra.dimension ?? null,
                }),
          },
        });
        const v = res.sketch.versions.at(-1) ?? null;
        saved.current = { code: d.code, key: d.key, meter: d.meter, band: d.band };
        if (v) setStatus({ kind: "saved", version: v.version, at: v.createdAt });
        if (d.code === liveRef.current) clearDraft(id);
        return v;
      } catch (e) {
        setStatus({ kind: "error", message: errorWords(e) });
        return null;
      }
    });
    queue.current = job;
    return job;
  };
  const liveRef = useRef(liveCode);
  liveRef.current = liveCode;

  const onEvaluated = (outcome: EvalOutcome) => {
    if (!outcome.ok) return;
    lastRunOk.current = outcome.code;
    setLastRunCode(outcome.code);
    const m = METERS[meter];
    if (outcome.cps !== null) bpmRef.current = Math.round(cpsToBpm(outcome.cps, m) * 10) / 10;
    const now = { code: outcome.code, key: keySpec, meter, band: bandNow() };
    if (!differsFrom(saved.current as Parameters<typeof differsFrom>[0], now)) return;
    void save(
      {
        ...now,
        bpm: bpmRef.current,
        lockedTools: outcome.lint?.lockedTools ?? [],
        note: null,
        ranOk: true,
      },
      // A second Run of the same code while the first is still saving saves nothing more.
      jamRef.current ? { takeState: "open", unlessSaved: true } : { unlessSaved: true },
    );
  };

  const retrySave = async () => {
    const code = liveRef.current;
    await save({
      code,
      bpm: bpmRef.current,
      meter,
      key: keySpec,
      band: bandNow(),
      lockedTools: lint?.lockedTools ?? [],
      note: null,
      ranOk: lastRunOk.current === code,
    });
  };

  const saveNamed = async (name: string) => {
    const code = liveRef.current;
    let locked: string[] = [];
    try {
      locked = (await lintInBrowser(code, lintCtx)).lockedTools;
    } catch {
      // the lint is a hint; the version is saved either way
    }
    const v = await save({
      code,
      bpm: bpmRef.current,
      meter,
      key: keySpec,
      band: bandNow(),
      lockedTools: locked,
      note: name,
      ranOk: lastRunOk.current === code,
    });
    setNaming(false);
    if (v) toast.success(`Saved ${versionLabel(v)}`);
  };

  // --- edits not run yet: kept in this browser ---------------------------------------------------------
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (code: string) => {
    setLiveCode(code);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      if (code === saved.current.code) clearDraft(id);
      else writeDraft(id, { code, baseVersion: latest.version, at: new Date().toISOString() });
    }, 400);
  };
  useEffect(
    () => () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    },
    [],
  );

  // --- the locked-tool hints (studio lint, never a block) ---------------------------------------------
  const lintKey = `${liveCode}|${meter}|${keySpec?.tonic ?? ""}${keySpec?.mode ?? ""}|${unlocked.size}`;
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      lintInBrowser(liveCode, lintCtx)
        .then((r) => {
          if (live) setLint(r);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [lintKey]);
  const hints = lockedHints(lint, toolbox, titles);
  // Where a view or lens opens, by the lessons' titles only ("from “Chord Symbols”"): never "U05.L09 · …".
  const unlockWords = (tid: string): string | null => {
    const t = toolbox.find((x) => x.id === tid);
    if (!t) return null;
    return sitesOf(t)
      .map((s) => `“${siteTitle(s, titles)}”`)
      .join(" or ");
  };
  // Wave 4: a sketch with chords hears when its harmony views arrive (a hint, never a block).
  const [hasChords, setHasChords] = useState(false);
  const harmonyHints = harmonyViewHints(hasChords, unlocked as ReadonlySet<string>, unlockWords).slice(0, 2);
  // Wave 5: the form and sound views (the ribbon, the form map, the scope, the probes): hints, never a block.
  const [hasSections, setHasSections] = useState(false);
  const soundFacts = soundFactsOf(liveCode, hasSections);
  const soundHints = formSoundHints(soundFacts, unlocked as ReadonlySet<string>, unlockWords).slice(0, 2);
  const soundTips = formSoundTips(soundFacts, unlocked as ReadonlySet<string>);
  // Wave 6: guide tones, the key ribbon and the beat grid: a tip once the lens is there, a hint before.
  const [musicFacts, setMusicFacts] = useState<SketchMusicFacts>({
    sevenths: false,
    keyChange: false,
    beatGrid: false,
    pushes: false,
  });
  const musicHints = musicLensHints(musicFacts, unlocked as ReadonlySet<string>, unlockWords).slice(0, 2);
  const musicTips = musicLensTips(musicFacts, unlocked as ReadonlySet<string>);
  // Wave 7: the advanced tracks' lenses: a tip once a lens is open, a hint naming its lesson before (never a block).
  const [trackFacts, setTrackFacts] = useState<SketchTrackFacts>(NO_TRACK_FACTS);
  const trackOpen = lenses.track.available;
  // A hint only once the learner has started that lens's track, by the lesson's title (no course id).
  const started = trackStarted(progress.data);
  const trackHints = trackLensHints(trackFacts, trackOpen, (lid) => {
    const lesson = TRACK_LENS_GATES[lid].lesson;
    return started(lesson) ? (titles.get(lesson) ?? null) : null;
  }).slice(0, 2);
  const trackTips = trackLensTips(trackFacts, trackOpen).slice(0, 3);

  // --- the tutor's subject: this sketch -----------------------------------------------------------------
  const thread = { subjectKind: "sketch" as const, subjectId: id };
  const onHarmony = useSubjectHarmony(thread);
  useEffect(() => {
    setSubject({
      thread,
      title: sketch.title,
      tutorOpen: !jamRef.current,
      closedNotice: JAM_TUTOR_NOTICE,
      sketchId: id,
      code: liveRef.current,
    });
    return () => clearSubject(thread);
  }, [id]);
  // Oak 2.0 W1: Jam closes the tutor with its own notice (not the checkpoint copy); editing opens it again.
  useEffect(() => {
    patchSubject(thread, { tutorOpen: chrome.tutorOpen, closedNotice: JAM_TUTOR_NOTICE });
  }, [chrome.tutorOpen]);
  useEffect(() => {
    patchSubject(thread, { title: sketch.title, code: liveCode });
  }, [liveCode, sketch.title]);
  // The tutor's Apply lands in this editor as one undoable change; the next Run saves it as a version. The W1 editor
  // slots write code through the same path.
  const applyCode = (code: string) => {
    if (!applyToEditor(editorDomId, code)) return;
    setLiveCode(code);
  };
  useEffect(() => registerTutorHost({ thread, sketchId: id, applyCode }), [id]);

  // --- keys -------------------------------------------------------------------------------------------
  useHotkeys([
    {
      id: "studio:name-version",
      keys: "Mod+S",
      scope: "studio",
      group: "Studio",
      description: "Save a named version",
      allowInInput: true,
      when: () => review === null,
      run: () => setNaming(true),
    },
  ]);

  // --- versions: compare and open ------------------------------------------------------------------------
  const onCompare = async (v: SketchVersion | null) => {
    if (v && needsReview(v)) {
      const verdict = strictVerdict(await lintInBrowser(v.code, strictLint(meter, keySpec)));
      if (!verdict.safe) {
        toast.info(
          `v${v.version} came from an imported backup and did not pass the safety check`,
          "Open it to review it as text.",
        );
        return;
      }
    }
    setCompare(v);
  };
  const onOpen = (v: SketchVersion) => {
    setCompare(null);
    if (needsReview(v)) {
      setReview({ code: v.code, version: v.version });
      return;
    }
    if (v.meter) setMeter(v.meter);
    setKeySpec(v.key);
    setBand((v.band as SketchBand | null) ?? null);
    mutes.current = muteMapOf((v.band as SketchBand | null) ?? null);
    setSeed((s) => ({ code: v.code, n: s.n + 1 }));
    setLiveCode(v.code);
    toast.info(`Opened ${versionLabel(v)} in the editor`, "Run it to make it the newest version.");
  };

  const rename = (title: string) => {
    setEditingTitle(false);
    const t = title.trim();
    if (t && t !== sketch.title) patch.mutate({ params: { id }, body: { title: t } });
  };
  const remove = async () => {
    try {
      const r = await del.mutateAsync({
        target: id,
        question: `Delete the sketch “${sketch.title}” and all ${sketch.versions.length} versions? This cannot be undone.`,
        input: { params: { id } },
      });
      if (r) {
        clearDraft(id);
        toast.success("Sketch deleted");
        void navigate({ to: "/studio" });
      }
    } catch (e) {
      toast.error("Couldn't delete the sketch", errorWords(e));
    }
  };

  // --- Oak 2.0 W1: jam on and off, building from takes, focus ----------------------------------------------
  const toggleJam = (on: boolean) => {
    setJam(on);
    if (on) {
      setCompare(null);
      return;
    }
    // Jam off opens the edit view: the takes panel.
    requestAnimationFrame(() => {
      takesHeading.current?.scrollIntoView({ block: "nearest" });
      takesHeading.current?.focus({ preventScroll: true });
    });
  };
  const onBuild = async (code: string, note: string) => {
    let locked: string[] = [];
    try {
      locked = (await lintInBrowser(code, lintCtx)).lockedTools;
    } catch {
      // the lint is a hint; the version is saved either way
    }
    const v = await save({
      code,
      bpm: bpmRef.current,
      meter,
      key: keySpec,
      band: bandNow(),
      lockedTools: locked,
      note,
      ranOk: false,
    });
    if (!v) return;
    setCompare(null);
    setSeed((s) => ({ code, n: s.n + 1 }));
    setLiveCode(code);
    toast.success(TAKES_WORDS.built, versionLabel(v));
  };
  const hasTakes = takesOf(sketch.versions, { showCut: true }).length > 0;
  const labelsNow = labelledLines(liveCode).map((l) => l.label);
  // Focus: only the focused statement is editable (the editor maps the range through edits; outlined as a target).
  const focusReadOnly = useMemo(() => {
    if (focus === null) return undefined;
    const line = labelledLines(liveRef.current).find((l) => l.label === focus);
    return line ? { editable: [{ from: line.from, to: line.to }] } : undefined;
  }, [focus, seed.n]);
  // Oak 2.0 W3: a sibling or the next generation, saved from the live draft through the same queue as every Run.
  const saveVersion: EditorSlotProps["saveVersion"] = ({ parentVersion, generation, dimension, note }) => {
    const code = liveRef.current;
    return save(
      {
        code,
        bpm: bpmRef.current,
        meter,
        key: keySpec,
        band: bandNow(),
        lockedTools: lint?.lockedTools ?? [],
        note,
        ranOk: lastRunOk.current === code,
      },
      { parentVersion, generation, dimension },
    );
  };
  const slotProps: EditorSlotProps = {
    sketch,
    version: latest,
    liveCode,
    lastRunCode,
    cursorLabel,
    meter,
    keySpec,
    jam,
    editor: editorHandle,
    applyCode,
    saveVersion,
    compareWith: compare,
  };
  const slots = (place: EditorSlotPlace) =>
    EDITOR_SLOTS.filter((s) => s.place === place).map(({ id: slotId, Component }) => (
      <Component key={slotId} {...slotProps} />
    ));
  const toolbarSlots = slots("toolbar");

  const fitting = bandsForMeter(bands, meter, bandMeter);
  const liner = linerFlags(latest, toolbox, flavourLabel);
  const onWorkbenchMutes = useCallback((m: MuteMap) => {
    mutes.current = m;
  }, []);

  return (
    <div
      {...keyScope("studio")}
      className="@container mx-auto flex w-full max-w-[96rem] flex-col gap-3 px-6 py-4"
    >
      {/* header: title, save state, actions */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          to="/studio"
          className="inline-flex items-center gap-1 rounded-control text-sm text-text-2 hover:text-text"
        >
          <ChevronLeft aria-hidden className="size-4" /> Studio
        </Link>
        <SketchCover seed={id} versions={sketch.currentVersion} flavour={band?.flavour ?? null} size={32} />
        {editingTitle ? (
          <input
            // biome-ignore lint/a11y/noAutofocus: the learner just asked to rename
            autoFocus
            aria-label="Sketch title"
            defaultValue={sketch.title}
            maxLength={120}
            onBlur={(e) => rename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename(e.currentTarget.value);
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="h-9 min-w-64 rounded-control border border-border bg-surface px-2 font-display text-h3"
          />
        ) : (
          <h1 className="text-h2">
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="rounded-control px-1 text-left hover:bg-surface-2"
              title="Rename"
              data-testid="sketch-title"
            >
              {sketch.title}
            </button>
          </h1>
        )}
        <SaveState status={status} onRetry={() => void retrySave()} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {review === null ? (
            <>
              <JamToggle jam={jam} onToggle={toggleJam} />
              <FocusToggle
                focus={focus}
                cursorLabel={cursorLabel}
                onFocus={setFocus}
                onNoLine={() => toast.info(JAM_WORDS.focusNoLine)}
              />
            </>
          ) : null}
          <Button
            icon={<Save aria-hidden className="size-4" />}
            onClick={() => setNaming(true)}
            disabled={review !== null}
            data-testid="name-version"
          >
            Name version <Kbd>{formatKeys("Mod+S", IS_MAC)}</Kbd>
          </Button>
          <Button
            variant="ghost"
            icon={<Download aria-hidden className="size-4" />}
            onClick={() => setExporting(true)}
          >
            Export
          </Button>
          <Button
            variant="ghost"
            icon={<Archive aria-hidden className="size-4" />}
            onClick={() => patch.mutate({ params: { id }, body: { archived: !sketch.archived } })}
          >
            {sketch.archived ? "Unarchive" : "Archive"}
          </Button>
          <Button
            variant="ghost"
            icon={<Trash2 aria-hidden className="size-4" />}
            loading={del.isPending}
            onClick={() => void remove()}
          >
            Delete
          </Button>
          {review === null ? slots("header") : null}
        </div>
      </header>

      {jam && review === null ? (
        <JamBar sketchId={id} lastRunCode={lastRunCode} onSwitchToEditing={() => toggleJam(false)} />
      ) : null}
      {focus !== null && review === null ? (
        <FocusPanel key={focus} label={focus} labels={labelsNow} onEnd={() => setFocus(null)} />
      ) : null}

      {/* settings of the sketch: key, meter, length, Band */}
      <fieldset className="m-0 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-border bg-surface px-3 py-2 text-sm">
        <legend className="sr-only">Sketch settings</legend>
        <span className="flex items-center gap-1.5">
          <span className="text-text-2">Key</span>
          <select
            aria-label="Key: tonic"
            value={keySpec?.tonic ?? ""}
            onChange={(e) =>
              setKeySpec(e.target.value ? { tonic: e.target.value, mode: keySpec?.mode ?? "major" } : null)
            }
            className="h-8 rounded-control border border-border bg-surface px-1.5 text-text"
          >
            <option value="">none</option>
            {TONICS.map((t) => (
              <option key={t} value={t}>
                {t.replace("#", "♯").replace(/(?<=[A-G])b/, "♭")}
              </option>
            ))}
          </select>
          <select
            aria-label="Key: mode"
            value={keySpec?.mode ?? "major"}
            disabled={!keySpec}
            onChange={(e) => keySpec && setKeySpec({ ...keySpec, mode: e.target.value as KeySpec["mode"] })}
            className="h-8 rounded-control border border-border bg-surface px-1.5 text-text disabled:opacity-50"
          >
            {studioModes(unlocked as ReadonlySet<string>, keySpec?.mode ?? null).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </span>
        <label className="flex items-center gap-1.5">
          <span className="text-text-2">Meter</span>
          <select
            value={meter}
            onChange={(e) => {
              const m = e.target.value as MeterId;
              setMeter(m);
              // A new meter rebuilds the editor (its lesson context) around the code as it is now.
              setSeed((s) => ({ code: liveRef.current, n: s.n + 1 }));
              if (band && bandMeter(band.bandId) !== m) {
                const alt = bandsForMeter(bands, m, bandMeter)[0];
                setBand(alt ? { ...band, bandId: alt.id } : null);
              }
            }}
            className="h-8 rounded-control border border-border bg-surface px-1.5 text-text"
          >
            {studioMeters(unlocked as ReadonlySet<string>, meter).map((m) => (
              <option key={m} value={m}>
                {meterLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-text-2">Length</span>
          <select
            value={length}
            onChange={(e) => {
              const n = Number(e.target.value);
              setLength(n);
              writeLength(id, n);
            }}
            className="h-8 rounded-control border border-border bg-surface px-1.5 text-text"
          >
            {/* The loop's own length is always an option (a 12-bar Band's default, a stored 5), or the select
                would show "1 bar" for it. */}
            {[...new Set<number>([...LENGTHS, length])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "bar" : "bars"}
                </option>
              ))}
          </select>
        </label>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
        <label className="flex items-center gap-1.5">
          <span className="text-text-2">Band</span>
          <select
            value={band?.bandId ?? ""}
            onChange={(e) => {
              const bid = e.target.value;
              if (!bid) setBand(null);
              else
                setBand({
                  bandId: bid as SketchBand["bandId"],
                  flavour: band?.flavour ?? studioFlavour(null),
                  mutes: [],
                });
              if (bid && !keySpec) setKeySpec({ tonic: "C", mode: "major" });
            }}
            className="h-8 rounded-control border border-border bg-surface px-1.5 text-text"
            data-testid="band-select"
          >
            <option value="">None</option>
            <BandOptions fitting={fitting} />
          </select>
        </label>
        {band ? (
          <SegmentedControl
            label="Band style"
            size="sm"
            value={band.flavour}
            options={STUDIO_FLAVOURS.map((f) => ({ value: f.id, label: f.label }))}
            onChange={(f) => setBand({ ...band, flavour: f })}
          />
        ) : null}
        {band ? (
          <span className="text-text-3">Follows your tempo and key; joins on the next Run.</span>
        ) : null}
      </fieldset>

      {restored ? (
        <Callout
          tone="info"
          title="Restored the edits you had not run yet"
          onDismiss={() => setRestored(false)}
          actions={
            <Button
              size="sm"
              onClick={() => {
                clearDraft(id);
                setSeed((s) => ({ code: latest.code, n: s.n + 1 }));
                setLiveCode(latest.code);
                setRestored(false);
              }}
            >
              Go back to v{latest.version}
            </Button>
          }
        >
          A Run saves them as a new version.
        </Callout>
      ) : null}

      <div className="grid gap-4 @min-[72rem]:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {review ? (
            <ReviewPanel
              key={review.version}
              code={review.code}
              version={review.version}
              meter={meter}
              keySpec={keySpec}
              onCleared={(code) => {
                setReview(null);
                setSeed((s) => ({ code, n: s.n + 1 }));
                setLiveCode(code);
              }}
            />
          ) : (
            <ServicesGate load={appWorkbenchServices} auto>
              <Workbench
                key={seed.n}
                id={`studio${id.replace(/[^a-z0-9]/gi, "").slice(-10)}`}
                code={seed.code}
                lessonCtx={lessonCtx}
                lint={lintCtx}
                views={["roll", "staff"]}
                band={bandSetup}
                initialMutes={mutes.current}
                onMutes={onWorkbenchMutes}
                target={compare && chrome.compare ? { code: compare.code, audible: "always" } : null}
                abLabels={compare ? { a: "now", b: versionLabel(compare) } : { a: "now", b: "earlier" }}
                onChange={onChange}
                onEvaluated={onEvaluated}
                lintFloor={chrome.lintFloor}
                soloLabel={focus}
                onCursorLabel={setCursorLabel}
                onHandle={setEditorHandle}
                {...(focusReadOnly === undefined ? {} : { readOnly: focusReadOnly, targetRegions: true })}
                {...(toolbarSlots.length > 0 ? { toolbar: <>{toolbarSlots}</> } : {})}
                onModel={(m) => {
                  setHasChords(m.harmony !== null && m.harmony.source === "learner");
                  setHasSections((m.lines?.sections.length ?? 0) > 0);
                  const facts = musicFactsOf(m.colour);
                  setMusicFacts((f) =>
                    f.sevenths === facts.sevenths &&
                    f.keyChange === facts.keyChange &&
                    f.beatGrid === facts.beatGrid &&
                    f.pushes === facts.pushes
                      ? f
                      : facts,
                  );
                  const tf = trackFactsOf(m.track);
                  setTrackFacts((f) => (sameTrackFacts(f, tf) ? f : tf));
                  onHarmony(m);
                }}
                tutorBars
              />
            </ServicesGate>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          {!jam && hasTakes && review === null ? (
            <TakesPanel
              sketch={sketch}
              showCut={showCut}
              onShowCut={setShowCut}
              comparing={compare?.version ?? null}
              onPlay={(v) => void onCompare(v)}
              onBuild={onBuild}
              headingRef={takesHeading}
            />
          ) : null}
          <VersionHistory
            versions={sketch.versions}
            current={sketch.currentVersion}
            comparing={compare?.version ?? null}
            onCompare={(v) => void onCompare(v)}
            onOpen={onOpen}
            showCut={showCut}
            onShowCut={setShowCut}
            compare={chrome.compare}
          />
          {/* Jam hides every hint and tip callout (W1 fidelity rule 2). */}
          {hints.length > 0 && !review && chrome.hints ? <LockedHints hints={hints} /> : null}
          {harmonyHints.length > 0 && !review && chrome.hints ? (
            <Callout tone="info" title="Coming for your chords" className="text-sm">
              <ul className="flex flex-col gap-0.5" data-testid="harmony-hints">
                {harmonyHints.map((h) => (
                  <li key={h.id}>
                    {h.what}: from {h.at}.
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}
          {((soundHints.length > 0 && chrome.hints) || (soundTips.length > 0 && chrome.tips)) && !review ? (
            <Callout tone="info" title="Views for this sketch" className="text-sm">
              <ul className="flex flex-col gap-0.5" data-testid="sound-hints">
                {(chrome.tips ? soundTips : []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
                {(chrome.hints ? soundHints : []).map((h) => (
                  <li key={h.id}>
                    {h.what}: from {h.at}.
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}
          {((musicHints.length > 0 && chrome.hints) || (musicTips.length > 0 && chrome.tips)) && !review ? (
            <Callout tone="info" title="Lenses for this sketch" className="text-sm">
              <ul className="flex flex-col gap-0.5" data-testid="music-hints">
                {(chrome.tips ? musicTips : []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
                {(chrome.hints ? musicHints : []).map((h) => (
                  <li key={h.id}>
                    {h.what}: from {h.at}.
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}
          {((trackHints.length > 0 && chrome.hints) || (trackTips.length > 0 && chrome.tips)) && !review ? (
            <Callout tone="info" title="Track lenses for this sketch" className="text-sm">
              <ul className="flex flex-col gap-0.5" data-testid="track-hints">
                {(chrome.tips ? trackTips : []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
                {(chrome.hints ? trackHints : []).map((h) => (
                  <li key={h.id}>
                    {h.what}: coming in {h.at}.
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}

          {review === null ? slots("aside") : null}
          <Facts
            version={latest}
            liner={liner}
            originId={sketch.originKind === "lesson-make" ? sketch.originId : null}
          />
        </aside>
      </div>

      <NameVersionDialog
        open={naming}
        next={(status.kind === "saved" ? status.version : sketch.currentVersion) + 1}
        saving={addVersion.isPending}
        onClose={() => setNaming(false)}
        onSave={(name) => void saveNamed(name)}
      />
      <ExportDialog
        open={exporting}
        onClose={() => setExporting(false)}
        sketch={sketch}
        version={latest}
        liner={liner}
      />
    </div>
  );
}

function SaveState({ status, onRetry }: { status: SaveStatus; onRetry(): void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-sm text-text-2" aria-live="polite" data-testid="save-state">
      {status.kind === "saving" ? (
        "Saving…"
      ) : status.kind === "error" ? (
        <>
          <span className="text-issue">Not saved. {status.message}</span>{" "}
          <button type="button" className="text-link underline" onClick={onRetry}>
            Try again
          </button>
        </>
      ) : (
        `Saved v${status.version} · ${sinceText(status.at, now, (iso) => formatDate(iso))}`
      )}
    </span>
  );
}

function LockedHints({ hints }: { hints: LockedHint[] }) {
  return (
    <Callout tone="info" title="Ahead of the course" className="text-sm">
      <p>These play, and Oak saves them; they join your toolbox when the course reaches them.</p>
      <ul className="mt-1 flex flex-col gap-0.5" data-testid="locked-hints">
        {hints.map((h) => (
          <li key={h.id}>
            <Link to="/toolbox/$toolId" params={{ toolId: h.id }} className="font-mono text-link">
              {h.code}
            </Link>{" "}
            {/* By title only: a lesson is never named by its ID (U01.L02) in learner copy. */}
            unlocks in {h.atTitle ?? "a later lesson"}{" "}
            <span className="text-text-3">
              (line{h.lines.length === 1 ? "" : "s"} {h.lines.join(", ")})
            </span>
          </li>
        ))}
      </ul>
    </Callout>
  );
}

function Facts({
  version,
  liner,
  originId,
}: {
  version: SketchVersion;
  liner: readonly string[];
  originId: string | null;
}) {
  return (
    <section aria-labelledby="facts-title" className="flex flex-col gap-1.5 text-sm">
      <h2 id="facts-title" className="font-sans text-sm font-semibold text-text-2">
        Liner notes
      </h2>
      <p className="flex flex-wrap gap-1">
        {version.key ? <Chip>{formatKey(version.key)}</Chip> : null}
        {version.bpm ? <Chip>{Math.round(version.bpm)} BPM</Chip> : null}
        {version.meter ? <Chip>{version.meter}</Chip> : null}
      </p>
      {liner.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-text-2" data-testid="liner-flags">
          {liner.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="text-text-3">Only tools from your toolbox. No Band.</p>
      )}
      {originId ? (
        <p>
          From the Make of{" "}
          <Link to="/learn/$lessonId" params={{ lessonId: originId }} className="text-link">
            {originId}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
