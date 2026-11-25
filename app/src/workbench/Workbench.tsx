// <Workbench> (architecture §2.2, ux §3.4–§3.6): the Strudel editor (one EditorHandle from the adapter,
// mounted from an effect keyed on the editor ID: never an inline ref callback, spike S2), the TransportBar,
// the PianoRoll and the StaffView (stacked from 760 px, tabs below), an optional Keyboard and the
// FeedbackPanel, all linked through one HighlightBus per instance. The roll and the staff come from the
// static analysis path (the browser grader host), so they show code that has not been played; while it
// plays, the adapter's paint clock drives the playhead and the highlights.
import type { ChordLensId, LensId, LineLensId, MusicLensId, TrackLensId } from "@oak/api";
import {
  type GradeResult,
  type HintLadder,
  type HintRung,
  type KeySpec,
  type LintContext,
  labelledLines,
  lineAt,
  type PickupSpec,
  type UnlockableId,
} from "@oak/content-kit";
import type { StaffKind } from "@oak/notation";
import {
  type BandSetup,
  type EditorHandle,
  type EditorOptions,
  type EvalOutcome,
  editorId,
  friendlyEvalError,
  type LessonCtx,
  type LiveHap,
  type MuteMap,
  NO_MUTES,
  type ScopePanel as ScopePanelId,
  type ScopeSource,
} from "@oak/strudel";
import { probeOf, type VisualProbe } from "@oak/strudel/probes";
import { METERS } from "@oak/theory";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SectionLoop } from "../lib/form-view.ts";
import { FULL_HARMONY_DEPTH, type HarmonyDepth, harmonyDepth } from "../lib/harmony-lens.ts";
import { MUSIC_LENS_UNLOCKS, TRACK_LENS_GATES } from "../lib/lenses.ts";
import { probeFromHaps, probeUnlocked, type ScopePanelHostProps } from "../lib/scope-panel.ts";
import {
  HIGHLIGHT_MS,
  TUTOR_BARS_EVENT,
  TUTOR_HIGHLIGHT_EVENT,
  TUTOR_SECTION_EVENT,
  type TutorHighlight,
} from "../tutor/context.ts";
import { ChartPanel } from "./ChartPanel.tsx";
import { CircleOfFifths } from "./CircleOfFifths.tsx";
import { WorkbenchClock } from "./clock.ts";
import { isColourMode, keyPlanBars } from "./colour.ts";
import { applyDepth, depthKey } from "./depth.ts";
import { FeedbackPanel, InlineCode, viewOf } from "./FeedbackPanel.tsx";
import { FormMap } from "./FormMap.tsx";
import { ghostEvents, marksOf, unlocks } from "./feedback.ts";
import { chordTonePercent, rangeLines } from "./harmony.ts";
import { HighlightBus } from "./highlight-bus.ts";
import { Keyboard } from "./Keyboard.tsx";
import type { KeyExtras } from "./KeyExtras.tsx";
import { KeyPanel } from "./KeyPanel.tsx";
import { MODE_TOOLS } from "./key-extras.ts";
import { TYPING_MAP, typedMidi } from "./keyboard-layout.ts";
import { type LensSource, useAppLensSource, useLensSourceKind } from "./lens-source.tsx";
import { type StaffLabelMode, showsSwitcher, viewLabels } from "./lens-view.ts";
import { alternationBars, barOfCycle, MAX_PIECE_BARS, pieceBarsOf, swingBadges } from "./lines.ts";
import {
  clampRegion,
  defaultRegion,
  type LoopRegion,
  type RegionStep,
  regionLabel,
  stepRegion,
  tutorBarsRegion,
} from "./loop-math.ts";
import { Metronome } from "./metronome.ts";
import { activeAt, keyAtCycle, leadEvents, pieceKeys, type WorkbenchModel } from "./model.ts";
import {
  PianoRoll,
  type RollColorMode,
  type RollLabelMode,
  type RollMusic,
  type RollTrack,
} from "./PianoRoll.tsx";
import {
  chordDisplay,
  initialPanelState,
  PANEL_SWITCHES,
  type PanelId,
  type PanelState,
  panelAvailability,
  readStoredPanels,
  writeStoredPanels,
} from "./panels.ts";
import { FOLLOW_PAGE_BARS } from "./roll-layout.ts";
import { ProbeView, ScopePanel } from "./ScopePanel.tsx";
import { linearAxis, SectionRibbon } from "./SectionRibbon.tsx";
import { StaffView } from "./StaffView.tsx";
import { f0OfHap, probesInHap } from "./scope-view.ts";
import { useWorkbenchServices } from "./services.tsx";
import { TransportBar, type TransportLenses } from "./TransportBar.tsx";
import {
  DEVICE_LESSONS,
  JAZZ_GLYPHS_TOOL,
  PATTERNED_SWING_TOOL,
  TRACK_SWITCHES,
  TWO_FIVE_LESSON,
} from "./track-switches.ts";
import {
  isSilenced,
  nextPracticeTempo,
  type PracticeTempo,
  toggleMute,
  toggleSolo,
} from "./transport-math.ts";
import { tutorHighlightEvents } from "./tutor-highlight.ts";
import { useAB } from "./use-ab.ts";
import { useAnalysis } from "./use-analysis.ts";
import { useKeyPreview } from "./use-key-preview.ts";
import { useLoopPlayback } from "./use-loop.ts";
import { clampViews, isEarlyUnit, layoutFor, type MusicView, type ViewTab } from "./views.ts";

export interface WorkbenchFeedback {
  result: GradeResult | null;
  rung: HintRung;
  /** True once the step has passed: nothing is redacted. */
  passed?: boolean;
  ladder?: HintLadder | null;
  hintPending?: boolean;
  /** Pressing Hint (the server advances the rung: `steps.hint`). */
  onRequestHint?: () => void;
}

export interface WorkbenchProps {
  /** Editor slug: the editor ID is `oak_${id}_${n}_`. Unique per page. */
  id: string;
  n?: number;
  /** Initial (clean) code. A later change of this prop replaces the editor text. */
  code: string;
  lessonCtx: LessonCtx;
  lint: LintContext;
  /** Which music views to show, in order. Default roll + staff. */
  views?: MusicView[];
  /** A unit or lesson ID: U00–U04 show at most two of roll, staff and keyboard. */
  unit?: string;
  variant?: "full" | "compact" | "mini";
  readOnly?: EditorOptions["readOnly"];
  /** Hidden backing tracks (mutable, never editable). */
  band?: BandSetup | null;
  /**
   * The roll's colours and labels. Naming `labels` (a lesson step's `ui.rollLabels`) makes the content decide:
   * the lenses do not apply and their switches are hidden. Without it the shared lenses decide (Wave 3).
   */
  roll?: { color?: RollColorMode; labels?: RollLabelMode };
  /**
   * The staff and its lines; `labels` (a step's `ui.staffLabels`) makes the content decide, as for the roll.
   * `kind: "lead"` shows the staff as a lead sheet (a step's `panels.staff: "lead"`, U07.L09).
   */
  staff?: { kind?: StaffKind; labels?: StaffLabelMode };
  /** A declared pickup (contracts §6.11): bar 0 is the pickup bar on the staff, the lead sheet and the chord band. */
  pickup?: PickupSpec | null;
  /**
   * Draw the editable regions of a code-modify step as target boxes, redrawn after every edit from the editor's
   * live ranges (`EditorHandle.editableRanges()`, wave4.md §3.5). Default off.
   */
  targetRegions?: boolean;
  /**
   * The lens source: by default the app's shared lenses (under a QueryClient) or a `WorkbenchLensProvider`;
   * `null` turns the lenses off (the Wave 2 labels).
   */
  lenses?: LensSource | null;
  /** Offer the key-signature panel and the circle of fifths once unlocked (lens mode, not mini). Default true. */
  panels?: boolean;
  /** The tab shown first when roll and staff are tabbed (narrow or short): default the roll. */
  initialTab?: ViewTab;
  /**
   * Panels open at first (the Toolbox's feature pages; a lesson step's `ui.initialPanels` through
   * `initialPanelsOf` in app/src/lib/panels.ts); otherwise the viewer's last choice. Wave 4 widens the IDs to
   * content-kit `WorkbenchPanelId`; a panel the Workbench does not draw yet is ignored.
   */
  initialPanels?: Partial<Record<PanelId, boolean>>;
  feedback?: WorkbenchFeedback;
  /** A/B target, played as hidden code. */
  target?: { code: string; audible: "always" | "fromHint2" | "never" } | null;
  /** The sound the keyboard and Alt+click audition with. Default "piano". */
  auditionSound?: string;
  analysisDebounceMs?: number;
  onChange?(code: string): void;
  onEvaluated?(outcome: EvalOutcome): void;
  onModel?(model: WorkbenchModel): void;
  /** Start playing as soon as the editor exists (Listen QA). */
  autoPlay?: boolean;
  /** Extra controls rendered at the end of the transport row. */
  toolbar?: ReactNode;
  /**
   * Names of the A/B sides when the target is not a grading target (Studio's "this version" against an
   * earlier one). With these and no `feedback`, a plain A/B strip replaces the feedback panel.
   */
  abLabels?: { a: string; b: string };
  /** Loop region and metronome (ux §7.10 `L`, `[`/`]`, `M`). Default on, except in the mini variant. */
  loopControls?: boolean;
  /**
   * `minimal`: the transport keeps play/stop, the bar counter and the mute chips only (no tempo, metre, key,
   * practice speed, solo or read-only badge): onboarding's first loop, before any of those words are taught.
   */
  transport?: "full" | "minimal";
  /** Long loops: the roll shows this many bars at a time and follows the playhead. Default 16; 0 = off. */
  rollFollowBars?: number;
  /**
   * Follow the tutor's bar references (`[[bars 2-3]]` → `TUTOR_BARS_EVENT`): loop those bars here. For the one
   * Workbench a surface writes in (Studio, the capstone, a lesson's Make). Default off.
   */
  tutorBars?: boolean;
  /** The loop region changed (on/off or bars), e.g. to remember it. */
  onLoopChange?(loop: { on: boolean; region: LoopRegion }): void;
  /** Mutes to start with (a sketch's saved Band mutes). Read when the editor is created. */
  initialMutes?: MuteMap;
  /** The learner changed a mute or solo chip. */
  onMutes?(mutes: MuteMap): void;
  /**
   * Wave 5 (wave5.md §4.4): the scope panel a lesson step asks for, `scopePanelOf(step.ui, outcome.panels)` — its
   * panels (wave, spectrum), its source (the master bus or one track) and its probe (filter, envelope, harmonics).
   * Without it the lenses decide (the panel switches, and the code's own `.scope()` / `.fscope()`).
   */
  scopePanel?: ScopePanelHostProps | null;
  /**
   * Probes to draw beside the code whatever the panels (a Toolbox page: the filter curve of `.lpf()`), each once its
   * tool is unlocked. A step's own probe (`scopePanel.probe`) wins.
   */
  probeKinds?: readonly VisualProbe["kind"][];
  /**
   * Wave 6 (wave6.md §4.3): how deep the chord and degree lenses write, when the host knows it better than the
   * Workbench (a tutor card, a reviewer's page). By default it is `harmonyDepth(lint.unlocked, completed lessons)`
   * with `lessonId` counted as completed, and everything open where there are no lenses at all (the standalone page).
   */
  harmonyDepth?: HarmonyDepth;
  /**
   * The lesson being taken (`U15.L02`): its own steps already show what it teaches (the applied numeral, the
   * borrowed chord, the lift by a step), as `unlocksOf(currentSession)` does for tools.
   */
  lessonId?: string;
  /**
   * Wave 6: a host's choice for the guide-tone lens, the key ribbon or the beat grid (a lesson step that needs one
   * shown, or hidden); it wins over the learner's switch. Without it the shared lenses decide, inside a step too.
   */
  musicLenses?: Partial<Record<MusicLensId, boolean>>;
  /**
   * Wave 7 (wave7.md §4.2): a host's choice for one of the advanced tracks' lenses (a lesson step that needs the
   * clave shown); it wins over the learner's switch. Without it the shared lenses decide, inside a step too.
   */
  trackLenses?: Partial<Record<TrackLensId, boolean>>;
  /**
   * A change of this value puts `code` into the editor again even when `code` is the same string as before (d15:
   * "Start from Oak's copy" pressed after the learner edited a Make that opened with Oak's copy or their sketch).
   */
  codeKey?: string | number;
  /**
   * Unit songs (spec 2026-11-24 §5.3): the host's loop. Read when the Workbench is created (a Make inside its song
   * starts looping where today's code plays) and again whenever `seq` changes: `region` loops those bars, `null` plays
   * the whole piece. Whatever is playing restarts with it (a changed Band included); `play` starts it when nothing is.
   */
  loopRequest?: { seq: number; region: LoopRegion | null; play?: boolean };
  /** The words on a track's mute chip (a unit song tells today's code, yours and Oak's apart). Default: the label. */
  trackLabel?(track: string): string;
  /**
   * Chips that each stand for several tracks (a unit song's Make: one chip per part, every earlier lesson's line of
   * it and Oak's track under it). The chips' own mute and solo state is turned into the player's mutes by `mutesOf`.
   * Absent: one chip per track, as `tracks` reads.
   */
  trackChips?: {
    chipsOf(tracks: readonly string[]): { id: string; label: string }[];
    mutesOf(state: Pick<MuteMap, "muted" | "solo">, tracks: readonly string[]): MuteMap;
  };
  /**
   * Oak 2.0 W1 (focus one part): while set, every other labelled line of the learner's code is muted through the
   * handle's `setMutes` (the chips show it); cleared, the mutes focus added are taken off again and the learner's
   * own mutes stay as they are. The Band is untouched.
   */
  soloLabel?: string | null;
  /** Oak 2.0 W1: the label of the statement under the editor's cursor (`lineAt` at the selection head), or `null`. */
  onCursorLabel?(label: string | null): void;
  /** Oak 2.0 W1 (jam): which lint findings the editor shows (`EditorHandle.setLintFloor`). Default `"info"`. */
  lintFloor?: "info" | "error";
  /** Oak 2.0 W1: the live editor handle once created, `null` when it is disposed (editor slots use it). */
  onHandle?(h: EditorHandle | null): void;
}

interface RunIssue {
  code: string;
  kind: "error" | "silent";
  message: string;
  detail: string;
}

function runIssueOf(outcome: EvalOutcome): RunIssue | null {
  const error = outcome.diagnostics.find((d) => d.severity === "error");
  if (!outcome.ok && error) {
    const detail = error.params.detail;
    return {
      code: outcome.code,
      kind: "error",
      message: error.message,
      detail: typeof detail === "string" ? detail : "",
    };
  }
  if (outcome.ok && outcome.diagnostics.some((d) => d.id === "eval.silent"))
    return { code: outcome.code, kind: "silent", message: "", detail: "" };
  return null;
}

const sameUnlocked = (a: ReadonlySet<UnlockableId>, b: ReadonlySet<UnlockableId>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

/** The line-lens switches (Wave 5, wave5.md §4.3): label, key and title. */
const LINE_SWITCHES: readonly { id: LineLensId; label: string; keys: string; title: string }[] = [
  { id: "sections", label: "Sections", keys: "Shift+O", title: "The section ribbon over the roll" },
  {
    id: "bassRoles",
    label: "Bass roles",
    keys: "Shift+B",
    title: "Root, fifth, octave and approach notes in the bass",
  },
  { id: "blueNotes", label: "Blue notes", keys: "Shift+U", title: "Blue notes: ♭3, ♭5 and ♭7" },
];

/** The music-lens switches (Wave 6, wave6.md §4.3): label, key and title. */
const MUSIC_SWITCHES: readonly { id: MusicLensId; label: string; keys: string; title: string }[] = [
  {
    id: "guideTones",
    label: "Guide tones",
    keys: "Shift+I",
    title: "The 3rd and 7th of each chord, and the line they make across the changes",
  },
  {
    id: "keyPlan",
    label: "Key ribbon",
    keys: "Shift+J",
    title: "The key in force along the piece, with each key change",
  },
  {
    id: "beatGrid",
    label: "Beat grid",
    keys: "Shift+V",
    title: "The beat and its divisions: counts in 6/8, triplets in thirds, pushes against the beat",
  },
];
/** Pushes arrive with U13.L01, before the compound meters: the beat grid opens with them too (drawn against the plain grid). */
const PUSH_TOOLS: readonly string[] = ["tb.early", "tb.late"];
const VELOCITY_TOOL = "tb.velocity";
const NO_LESSONS: ReadonlySet<string> = new Set<string>();

/** The scope and spectrum panels' toolbox rows (contracts §3.2; `WORKBENCH_PANEL_TOOLS`). */
const SCOPE_TOOL = "tb.scope";
const FSCOPE_TOOL = "tb.fscope";
/** The delay probe has no content-kit probe kind: its row is the delay's own. */
const DELAY_TOOL = "tb.delay";

/** The delay probe of a hap (A1.L04; not a content-kit probe kind, so outside `probeFromHaps`). */
function delayProbeOf(hap: LiveHap, cps: number): VisualProbe | null {
  return probeOf("delay", hap.value, cps);
}

/** The chord-lens switches (Wave 4): label, key and title. */
const CHORD_SWITCHES: readonly { id: ChordLensId; label: string; keys: string; title: string }[] = [
  {
    id: "chordSymbols",
    label: "Chords",
    keys: "Shift+H",
    title: "Chord symbols on the chord band and the staff",
  },
  { id: "romanNumerals", label: "Numerals", keys: "Shift+R", title: "Roman numerals in the key" },
];

export function Workbench(props: WorkbenchProps) {
  const kind = useLensSourceKind();
  if (props.lenses !== undefined) return <WorkbenchView {...props} source={props.lenses} />;
  if (kind === "app") return <AppLensWorkbench {...props} />;
  return <WorkbenchView {...props} source={kind} />;
}

function AppLensWorkbench(props: WorkbenchProps) {
  const source = useAppLensSource();
  return <WorkbenchView {...props} source={source} />;
}

function WorkbenchView(props: WorkbenchProps & { source: LensSource | null }) {
  const { oak, grader, renderFeedback } = useWorkbenchServices();
  const bus = useMemo(() => new HighlightBus(), []);
  const clock = useMemo(() => new WorkbenchClock(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRoot = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(props.code);
  const [handle, setHandle] = useState<EditorHandle | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playedCode, setPlayedCode] = useState<string | null>(null);
  const [mutes, setMutes] = useState<MuteMap>(props.initialMutes ?? NO_MUTES);
  /** The chips' mute and solo, by chip id, while the host groups tracks into chips (`trackChips`). */
  const [chipMutes, setChipMutes] = useState<MuteMap>(NO_MUTES);
  const [practice, setPractice] = useState<PracticeTempo>(1);
  const [width, setWidth] = useState(1024);
  const [availHeight, setAvailHeight] = useState(Number.POSITIVE_INFINITY);
  const [tab, setTab] = useState<ViewTab>(props.initialTab ?? "roll");
  const [typing, setTyping] = useState(false);
  const [octave, setOctave] = useState(4);
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set());
  /** What the last Run said about the code it ran: an error (friendly text) or "ran, but silent". */
  const [runIssue, setRunIssue] = useState<RunIssue | null>(null);
  /** Wave 5: the panels the last run's code asked for (`.scope()`, `.fscope()`) and its first cycle's haps (probes). */
  const [codePanels, setCodePanels] = useState<readonly ScopePanelId[]>([]);
  const [runHaps, setRunHaps] = useState<{ haps: LiveHap[]; cps: number } | null>(null);
  const liveHandle = useRef<EditorHandle | null>(null);
  const variant = props.variant ?? "full";
  const meter = METERS[props.lessonCtx.meter];
  // An arranged song is analysed, drawn and looped whole (Wave 5): its bars, not the step's loop, when longer.
  // Wave 6: so is a key plan (`.scale("<C4:major!4 D4:major!4>")`): the lift is inside what is read and looped.
  const loopBars = useMemo(
    () => Math.max(pieceBarsOf(code, props.lessonCtx.loopBars), Math.min(MAX_PIECE_BARS, keyPlanBars(code))),
    [code, props.lessonCtx.loopBars],
  );
  const loopControls = (props.loopControls ?? true) && variant !== "mini";
  const [loopOn, setLoopOn] = useState(() => (props.loopRequest?.region ?? null) !== null);
  const [regionRaw, setRegion] = useState<LoopRegion>(
    () => props.loopRequest?.region ?? defaultRegion(loopBars),
  );
  const region = clampRegion(regionRaw, loopBars);
  const [metronomeOn, setMetronomeOn] = useState(false);
  // A lead sheet is drawn from the analysed staff (its melody and the chords); the analysis engraves the full one.
  const staffKind: StaffKind = props.staff?.kind === "lead" ? "auto" : (props.staff?.kind ?? "auto");

  const views = useMemo(() => {
    const wanted = variant === "mini" ? (["roll"] as MusicView[]) : (props.views ?? ["roll", "staff"]);
    return clampViews(wanted, { early: isEarlyUnit(props.unit) });
  }, [props.views, props.unit, variant]);

  // The Band parts heard: the step's tracks, less the ones muted here (the chord band reads only these).
  const bandHeard = props.band ? props.band.tracks.filter((r) => !mutes.muted.has(`band.${r}`)) : null;
  // Wave 7: jazz glyphs once the learner reads them (J1.L02), on the chord band and the staff alike.
  const jazzGlyphs =
    props.source !== null && (props.lint.unlocked as ReadonlySet<string>).has(JAZZ_GLYPHS_TOOL);
  const analysis = useAnalysis(grader, code, {
    bandHeard,
    bars: loopBars,
    meter: props.lessonCtx.meter,
    key: props.lessonCtx.key,
    lint: props.lint,
    band: props.band ?? null,
    staff: views.includes("staff") ? staffKind : false,
    staffLabels: props.staff?.labels === "counts" ? "counts" : "none",
    debounceMs: props.analysisDebounceMs ?? 300,
    pickup: props.pickup ?? null,
    chordStyle: jazzGlyphs ? "jazz" : "lead-sheet",
  });
  const source = props.source;
  // --- Wave 6: how deep the labels write for this learner (never ahead of the course) -----------------
  const unlockedKey = [...(props.lint.unlocked as ReadonlySet<string>)].sort().join(",");
  const completed = source?.completedLessons ?? NO_LESSONS;
  const depth: HarmonyDepth = useMemo(() => {
    if (props.harmonyDepth) return props.harmonyDepth;
    if (!source) return FULL_HARMONY_DEPTH;
    const done = props.lessonId ? new Set([...completed, props.lessonId]) : completed;
    return harmonyDepth(props.lint.unlocked as ReadonlySet<string>, done);
    // `unlockedKey` stands for the set's contents (hosts pass a new Set each render).
  }, [props.harmonyDepth, source === null, completed, props.lessonId, unlockedKey]);
  const dKey = depthKey(depth);
  const model = useMemo(
    () => (analysis.model ? applyDepth(analysis.model, depth) : null),
    // `dKey` stands for `depth`.
    [analysis.model, dKey],
  );
  const keySpec: KeySpec | null = model?.key ?? props.lessonCtx.key;

  // --- labels: the lenses or the content (wave3.md §4.3) -------------------------------------------
  const labels = viewLabels({
    ...(props.roll?.labels === undefined ? {} : { rollLabels: props.roll.labels }),
    ...(props.roll?.color === undefined ? {} : { rollColor: props.roll.color }),
    ...(props.staff?.labels === undefined ? {} : { staffLabels: props.staff.labels }),
    lenses: source,
    ...(source ? { rollSetting: source.rollSetting } : {}),
    hasKey: (model?.key ?? null) !== null,
  });
  const chordLenses = labels.mode === "lenses" ? (source?.chords ?? null) : null;
  const chordLensBar =
    variant !== "mini" &&
    chordLenses !== null &&
    (chordLenses.available.chordSymbols || chordLenses.available.romanNumerals);
  // Wave 5: the line lenses (sections, bass roles, blue notes) follow the lenses wherever the content does not
  // name the labels; inside a step that does, the step's form panel shows the ribbon.
  const lineLenses = labels.mode === "lenses" && variant !== "mini" ? (source?.lines ?? null) : null;
  const lineLensBar = lineLenses !== null && LINE_SWITCHES.some((l) => lineLenses.available[l.id] === true);
  const lensBar = variant !== "mini" && (showsSwitcher(source, labels.mode) || chordLensBar || lineLensBar);
  const unlockedSet = props.lint.unlocked as ReadonlySet<string>;
  // Wave 6: guide tones, the key ribbon and the beat grid. No step names them, so the learner's switch decides
  // inside a step too (a host's `musicLenses` wins); each exists once its tool is unlocked, the lesson being
  // taken included, and its switch shows only where the piece has something for it to draw.
  const music = variant !== "mini" ? (source?.music ?? null) : null;
  const colour = model?.colour ?? null;
  const musicOpen = (id: MusicLensId): boolean =>
    music !== null &&
    (music.available[id] ||
      MUSIC_LENS_UNLOCKS[id].some((t) => unlockedSet.has(t)) ||
      (id === "beatGrid" && PUSH_TOOLS.some((t) => unlockedSet.has(t))));
  const musicHas: Record<MusicLensId, boolean> = {
    guideTones: (colour?.guide.marks.size ?? 0) > 0,
    keyPlan: (colour?.keys.length ?? 0) > 1,
    beatGrid: (colour?.rhythm?.grid ?? null) !== null || (colour?.rhythm?.pushes.size ?? 0) > 0,
  };
  const musicOn = (id: MusicLensId): boolean => {
    if (variant === "mini") return false;
    const host = props.musicLenses?.[id];
    if (host !== undefined) return host;
    return music !== null && musicOpen(id) && music.prefs[id];
  };
  const musicSwitches = MUSIC_SWITCHES.filter(
    (m) => props.musicLenses?.[m.id] === undefined && musicOpen(m.id) && musicHas[m.id],
  );
  const toggleMusicLens = (id: MusicLensId) => {
    if (!music || !musicSwitches.some((m) => m.id === id)) return;
    music.toggle(id);
  };
  // What the learner has been taught, for the key panel's Wave 6 rows.
  const taught = (lesson: string): boolean =>
    source === null ||
    props.harmonyDepth === FULL_HARMONY_DEPTH ||
    completed.has(lesson) ||
    props.lessonId === lesson;
  // Panels: the lenses decide outside a step, the step's `initialPanels` inside one (wave4.md §4.4).
  const panelMode: "lenses" | "content" = labels.mode === "lenses" && source !== null ? "lenses" : "content";
  const panelAvailable = panelAvailability({
    mode: panelMode,
    allowed: (props.panels ?? true) && variant !== "mini",
    unlocked: unlockedSet,
    initial: props.initialPanels,
    hasStaff: views.includes("staff"),
    hasRoll: views.includes("roll"),
  });
  const [panelPrefs, setPanelPrefs] = useState<PanelState>(() =>
    initialPanelState(readStoredPanels(), props.initialPanels, panelMode),
  );
  const panelsOpen = Object.fromEntries(
    (Object.keys(panelPrefs) as PanelId[]).map((id) => [id, panelAvailable[id] && panelPrefs[id]]),
  ) as PanelState;
  const togglePanel = (id: PanelId) => {
    if (!panelAvailable[id]) return;
    setPanelPrefs((p) => {
      const next = { ...p, [id]: !p[id] };
      // Only the viewer's own choice outside a step is remembered; a step's panels are the step's.
      if (panelMode === "lenses") writeStoredPanels({ ...readStoredPanels(), ...next } as PanelState);
      return next;
    });
  };
  const toggleLens = (id: LensId) => {
    if (!source || !lensBar || !source.available[id]) return;
    source.toggle(id);
  };
  const toggleLineLens = (id: LineLensId) => {
    if (!lineLenses?.available[id]) return;
    lineLenses.toggle(id);
  };
  const toggleChordLens = (id: ChordLensId) => {
    if (!chordLenses || !chordLensBar || !chordLenses.available[id]) return;
    chordLenses.toggle(id);
  };
  const chords = chordDisplay(panelMode, panelsOpen, chordLenses, unlockedSet);
  // The lead sheet: a step that asks for it (`staff.kind: "lead"`), or the learner's switch.
  const leadSheet = props.staff?.kind === "lead" || panelsOpen.lead;

  // The model of the code that is playing (the clock highlights that, not an unplayed edit).
  const playedModel = useRef<WorkbenchModel | null>(null);
  if (model && model.code === playedCode) playedModel.current = model;
  const modelRef = useRef(model);
  modelRef.current = model;

  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    bus.setEvents(model?.events ?? [], model?.abc ?? null);
    if (model) propsRef.current.onModel?.(model);
  }, [bus, model]);

  // The tutor's references ([[bars:3-4]], [[note:F#4]], a review's bar chip) light the learner's notes on the
  // roll, the staff and in the code for HIGHLIGHT_MS, unless the learner points at something else meanwhile.
  useEffect(() => {
    if (variant === "mini") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onHighlight = (e: Event) => {
      const h = (e as CustomEvent<TutorHighlight>).detail;
      const m = modelRef.current;
      if (!h || !m) return;
      const ids = tutorHighlightEvents(m.events, h, m.pickup !== null);
      if (ids.length === 0) return;
      bus.hover({ events: ids }, "feedback");
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (bus.get().hover.source === "feedback") bus.hover(null, "feedback");
      }, HIGHLIGHT_MS);
    };
    window.addEventListener(TUTOR_HIGHLIGHT_EVENT, onHighlight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(TUTOR_HIGHLIGHT_EVENT, onHighlight);
    };
  }, [bus, variant]);

  // --- feedback → views -------------------------------------------------------------------------
  const fb = props.feedback;
  const gradeView = useMemo(
    () =>
      fb?.result
        ? viewOf(fb.result, fb.rung, {
            ...(fb.passed === undefined ? {} : { passed: fb.passed }),
            ...(renderFeedback ? { render: renderFeedback } : {}),
          })
        : null,
    [fb?.result, fb?.rung, fb?.passed, renderFeedback],
  );
  const marks = useMemo(() => marksOf(gradeView), [gradeView]);
  const can = unlocks(fb?.rung ?? 0, {
    abAudible: props.target?.audible ?? "fromHint2",
    ...(fb?.passed === undefined ? {} : { passed: fb.passed }),
  });
  const ghosts = useMemo(() => (can.ghosts ? ghostEvents(gradeView) : []), [can.ghosts, gradeView]);
  useEffect(() => bus.setIssues(marks.issues), [bus, marks]);
  // The grade's marks, plus (when the host asks) the editable regions as target boxes from the editor's live
  // ranges: after an edit the box is drawn where the region is now, not where the starter had it.
  const targetRegions = props.targetRegions === true;
  const [targetText, setTargetText] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!handle || handle.disposed) return;
    const live = targetRegions ? handle.editableRanges() : null;
    const targets = live && live.length > 0 ? live : [];
    handle.setMarks([...marks.code, ...targets.map((range) => ({ range, kind: "target" as const }))]);
    setTargetText(targetRegions ? targets.map((r) => `${r.from}-${r.to}`).join(" ") : undefined);
  }, [handle, marks, code, targetRegions]);

  // --- the editor (stable lifecycle: created once per ID, disposed on unmount) --------------------
  const id = editorId(props.id, props.n ?? 0);
  // Oak 2.0 W1: the label under the cursor, reported when it changes.
  const cursorLabel = useRef<string | null | undefined>(undefined);
  const reportCursorLabel = () => {
    const live = liveHandle.current;
    if (!live || live.disposed || !propsRef.current.onCursorLabel) return;
    const st = live.view.state;
    const label = lineAt(st.doc.toString(), st.selection.main.head)?.label ?? null;
    if (label === cursorLabel.current) return;
    cursorLabel.current = label;
    propsRef.current.onCursorLabel(label);
  };
  const suppressCursor = useRef<string | null>(null);
  const practiceRef = useRef(practice);
  practiceRef.current = practice;
  useEffect(() => {
    const el = editorRoot.current;
    if (!el) return;
    const p = propsRef.current;
    const opts: EditorOptions = {
      id,
      initialCode: p.code,
      lessonCtx: p.lessonCtx,
      lint: p.lint,
      band: p.band ?? null,
      hooks: {
        onCursor: (range) => {
          reportCursorLabel();
          const key = `${range.from}:${range.to}`;
          if (suppressCursor.current === key) return;
          suppressCursor.current = null;
          bus.select({ code: [range] }, "code");
        },
      },
      onChange: (next) => {
        setCode(next);
        propsRef.current.onChange?.(next);
      },
      onEvaluated: (outcome) => {
        setRunIssue(runIssueOf(outcome));
        if (outcome.ok) {
          setPlayedCode(outcome.code);
          setCodePanels(outcome.panels ?? []);
          try {
            const live = liveHandle.current;
            if (live && !live.disposed) setRunHaps({ haps: live.queryHaps(0, 1), cps: outcome.cps ?? 0.5 });
          } catch {
            setRunHaps(null);
          }
          analysis.analyzeNow(outcome.code);
          if (outcome.cps !== null && practiceRef.current !== 1)
            oak.transport.setCps(outcome.cps * practiceRef.current);
          // A Run while the loop region is on: the new code takes over the loop (the editor itself
          // started playing; the loop player replaces it).
          if (loopOnRef.current) setTimeout(() => loopRef.current.handOver(outcome.code), 0);
        }
        propsRef.current.onEvaluated?.(outcome);
      },
      onToggle: (on) => {
        setPlaying(on);
        if (!on) {
          clock.stop();
          bus.setPlaying([]);
        }
      },
      onPaint: (frame) => {
        clock.tick(frame.audibleCycle);
        const m = playedModel.current ?? modelRef.current;
        if (m) bus.setPlaying(activeAt(m, frame.audibleCycle));
      },
    };
    if (p.readOnly !== undefined) opts.readOnly = p.readOnly;
    const h = oak.createEditor(el, opts);
    liveHandle.current = h;
    if (p.initialMutes) h.setMutes(p.initialMutes);
    setHandle(h);
    if (p.autoPlay) {
      void oak.unlock().then(() => {
        if (!h.disposed) void h.play();
      });
    }
    return () => {
      setHandle(null);
      liveHandle.current = null;
      clock.stop();
      bus.setPlaying([]);
      h.dispose();
    };
    // The editor lives as long as its ID; everything else reaches it through refs and handle calls.
  }, [oak, id, bus, clock]);

  // Prop changes reach the live editor without re-creating it.
  useEffect(() => {
    if (!handle || handle.disposed) return;
    if (props.code !== handle.getCode()) {
      handle.setCode(props.code);
      setCode(props.code);
    }
    // `codeKey`: the host asks for `code` again although the prop's text did not change (d15).
  }, [handle, props.code, props.codeKey]);
  useEffect(() => {
    if (handle && !handle.disposed) handle.setEditable(props.readOnly);
  }, [handle, props.readOnly]);
  useEffect(() => {
    if (handle && !handle.disposed) handle.setBand(props.band ?? null);
  }, [handle, props.band]);
  // Oak 2.0 W1: the host sees the handle (editor slots), and sets the lint floor (jam shows only errors).
  useEffect(() => {
    propsRef.current.onHandle?.(handle);
    cursorLabel.current = undefined;
  }, [handle]);
  const lintFloorSet = useRef(false);
  useEffect(() => {
    if (!handle || handle.disposed) return;
    if (props.lintFloor === undefined && !lintFloorSet.current) return;
    lintFloorSet.current = true;
    handle.setLintFloor(props.lintFloor ?? "info");
  }, [handle, props.lintFloor]);
  const lastUnlocked = useRef(props.lint.unlocked);
  useEffect(() => {
    if (!handle || handle.disposed) return;
    if (!sameUnlocked(lastUnlocked.current, props.lint.unlocked)) handle.setUnlocked(props.lint.unlocked);
    lastUnlocked.current = props.lint.unlocked;
  }, [handle, props.lint.unlocked]);

  // Roll / staff / feedback → code: hover flashes the range, a selection focuses it.
  useEffect(() => {
    if (!handle) return;
    let prev = bus.get();
    return bus.subscribe((s) => {
      if (handle.disposed) return;
      if (s.hover !== prev.hover && s.hover.source !== "code" && s.hover.code.length > 0) {
        handle.flashRanges(s.hover.code);
      }
      if (s.selected !== prev.selected && s.selected.source !== "code" && s.selected.code.length > 0) {
        const first = s.selected.code[0];
        if (first) suppressCursor.current = `${first.from}:${first.to}`;
        handle.focusRanges(s.selected.code);
        // Mirror what the editor really selected (tests and devtools read it).
        const main = handle.view.state.selection.main;
        rootRef.current?.setAttribute(
          "data-editor-selection",
          `${main.from}-${main.to}:${handle.view.state.doc.sliceString(main.from, main.to)}`,
        );
      }
      prev = s;
    });
  }, [bus, handle]);

  // --- the key now: the bar that plays (a patterned .scale() changes key), else the piece's first ---------
  const [keyBar, setKeyBar] = useState(0);
  useEffect(
    () =>
      clock.subscribe((f) => {
        const bars = modelRef.current?.bars ?? 1;
        const bar = f.playing && bars > 0 ? Math.floor(f.audibleCycle % bars) : 0;
        setKeyBar((b) => (b === bar ? b : bar));
      }),
    [clock],
  );
  const keyNow = model ? (keyAtCycle(model.keySpans, keyBar) ?? model.key) : keySpec;
  const keysOfPiece = useMemo(() => (model ? pieceKeys(model.keySpans) : []), [model]);
  const anyPanel = panelsOpen.key || panelsOpen.circle;
  const preview = useKeyPreview({
    oak,
    handle,
    pieceKey: model?.keySpans[0]?.key ?? null,
    bars: loopBars,
    cps: model?.cps ?? 0.5,
    lint: props.lint,
    readOnly: props.readOnly === true,
    band: props.band ?? null,
    mutes,
  });
  const previewRef = useRef(preview);
  previewRef.current = preview;
  // Closing the panels (or leaving) ends a preview.
  useEffect(() => {
    if (!anyPanel) previewRef.current.stop();
  }, [anyPanel]);

  // --- transport --------------------------------------------------------------------------------
  const ab = useAB({
    oak,
    handle,
    target: props.target && props.target.audible !== "never" ? props.target.code : null,
    bars: loopBars,
    cps: model?.cps ?? 0.5,
  });

  // --- loop region and metronome (ux §3.4, §7.10) ------------------------------------------------
  const loop = useLoopPlayback({
    oak,
    handle,
    clock,
    onPosition: (position) => {
      const m = playedModel.current ?? modelRef.current;
      if (m) bus.setPlaying(activeAt(m, position));
    },
    onStopped: () => bus.setPlaying([]),
    lint: props.lint,
    loopBars,
    band: props.band ?? null,
    mutes,
    region,
    rate: practice,
  });
  const loopOnRef = useRef(loopOn);
  loopOnRef.current = loopOn;
  const loopRef = useRef({
    handOver: (_code: string) => {},
  });
  loopRef.current.handOver = (code: string) => {
    if (!loopOnRef.current || !handle || handle.disposed) return;
    if (handle.playing || loop.playing) void restartLoop(code);
  };
  const anyPlaying = playing || loop.playing;
  /**
   * (Re)starts the loop player and records the code it now plays. The roll's "preview · not playing" badge compares
   * the model with the played code, and only the editor's own Run reports that code: without this, a loop that is
   * the first thing played after the page loads leaves the badge up while the sound plays.
   */
  const restartLoop = async (code: string) => {
    const out = await loop.start(code);
    if (out?.ok) setPlayedCode(out.code);
    return out;
  };
  /**
   * Plays the loop from the code as it is, when the editor itself did not just run it: the run is reported as an
   * editor Run is (the host's `onEvaluated`, the "didn't run" banner), so a Make that loops from the start (a unit
   * song's) still ticks its list and counts as run.
   */
  const startLoop = async (code: string) => {
    const out = await restartLoop(code);
    if (out) {
      setRunIssue(runIssueOf(out));
      propsRef.current.onEvaluated?.(out);
    }
    return out;
  };

  const metronome = useMemo(() => new Metronome(oak, meter), [oak, meter]);
  useEffect(() => {
    if (metronomeOn) metronome.start();
    else metronome.stop();
    return () => metronome.stop();
  }, [metronome, metronomeOn]);

  const reportLoop = (on: boolean, r: LoopRegion) => propsRef.current.onLoopChange?.({ on, region: r });
  const toggleLoop = () => {
    const on = !loopOn;
    setLoopOn(on);
    reportLoop(on, region);
    if (!handle || handle.disposed) return;
    if (on && handle.playing) void restartLoop(handle.getCode());
    else if (!on && loop.playing) {
      loop.stop();
      void handle.play();
    }
  };
  const stepLoop = (step: RegionStep) => {
    const next = stepRegion(region, step, loopBars);
    setRegion(next);
    reportLoop(loopOn, next);
  };
  const canStep = (step: RegionStep) => {
    const next = stepRegion(region, step, loopBars);
    return next.from !== region.from || next.bars !== region.bars;
  };
  // Unit songs: the host asks for a loop (a section of the song) or the whole piece, and what plays follows.
  const loopSeq = useRef(props.loopRequest?.seq);
  useEffect(() => {
    const req = propsRef.current.loopRequest;
    if (!req || req.seq === loopSeq.current) return;
    loopSeq.current = req.seq;
    const on = req.region !== null;
    const r = req.region ? clampRegion(req.region, loopBars) : region;
    setLoopOn(on);
    if (req.region) setRegion(r);
    reportLoop(on, r);
    if (!handle || handle.disposed) return;
    const busyNow = handle.playing || loop.playing;
    if (!busyNow && req.play !== true) return;
    void (async () => {
      await oak.unlock();
      if (on) await startLoop(handle.getCode());
      else {
        if (loop.playing) loop.stop();
        await handle.play();
      }
    })();
    // Only a new request acts: the rest is read as it is now.
  }, [props.loopRequest?.seq]);
  // --- Wave 5: the form (section ribbon, form map, section loop) ---------------------------------------
  const lines = model?.lines ?? null;
  const sections = lines?.sections ?? [];
  const sectionLoop: SectionLoop | null = (() => {
    if (!loopOn) return null;
    const s = sections.find((x) => x.startBar === region.from && x.bars === region.bars);
    return s ? { from: s.startBar, bars: s.bars, tag: s.tag } : null;
  })();
  const loopSection = (next: SectionLoop | null) => {
    if (!next) {
      if (!loopOn) return;
      toggleLoop();
      return;
    }
    const r = clampRegion({ from: next.from, bars: next.bars }, loopBars);
    setRegion(r);
    setLoopOn(true);
    reportLoop(true, r);
    if (handle && !handle.disposed && (handle.playing || loop.playing)) void restartLoop(handle.getCode());
  };
  const showRibbon = variant !== "mini" && (lineLenses?.shown.sections === true || panelsOpen.form === true);
  const currentBar = anyPlaying ? barOfCycle(keyBar, model?.bars ?? 0) : null;

  // --- Wave 5: Oak's scope, its spectrum and the visual probes -------------------------------------
  const hostScope = props.scopePanel ?? null;
  // A step that asks for the panel gets it (content check 4 already proved its tool is there, and A1.L01 teaches
  // tb.scope while the learner is in it); elsewhere the tool must be unlocked.
  const wantWave =
    (hostScope?.panels.includes("scope") ?? false) ||
    (unlockedSet.has(SCOPE_TOOL) && (panelsOpen.scope || codePanels.includes("scope")));
  const wantSpectrum =
    (hostScope?.panels.includes("fscope") ?? false) ||
    (unlockedSet.has(FSCOPE_TOOL) && (panelsOpen.spectrum || codePanels.includes("fscope")));
  // The probes: the step's one, else (outside a step) one per control the code sets, each once its tool is unlocked.
  const learnerHaps = useMemo(
    () => (runHaps?.haps ?? []).filter((h) => !h.track.startsWith("band.")),
    [runHaps],
  );
  const firstPitched =
    learnerHaps.find(
      (h) => h.value.note !== undefined || h.value.n !== undefined || h.value.freq !== undefined,
    ) ?? learnerHaps[0];
  const probes: { kind: VisualProbe["kind"]; probe: VisualProbe | null; f0: number | null }[] =
    useMemo(() => {
      const cps = runHaps?.cps ?? 0.5;
      if (hostScope?.probe) {
        const sp = hostScope.probe;
        // The step's own probe shows in the lesson that teaches its tool too (A1.L03 teaches tb.adsr).
        const hap = sp.track ? learnerHaps.find((h) => h.track === sp.track) : firstPitched;
        return [{ kind: sp.kind, probe: probeFromHaps(sp, learnerHaps, cps), f0: f0OfHap(hap) }];
      }
      if (panelMode !== "lenses" || variant === "mini") return [];
      const hap = firstPitched;
      const asked = props.probeKinds ?? null;
      if (!hap)
        return (asked ?? [])
          .filter((k) => (k === "delay" ? unlockedSet.has(DELAY_TOOL) : probeUnlocked(k, unlockedSet)))
          .map((k) => ({ kind: k, probe: null, f0: null }));
      return (asked ? [...asked] : probesInHap(hap.value))
        .filter((k) => (k === "delay" ? unlockedSet.has(DELAY_TOOL) : probeUnlocked(k, unlockedSet)))
        .map((k) => ({
          kind: k,
          probe:
            k === "delay"
              ? delayProbeOf(hap, cps)
              : probeFromHaps({ kind: k, track: hap.track }, learnerHaps, cps),
          f0: f0OfHap(hap),
        }));
    }, [hostScope, unlockedSet, learnerHaps, firstPitched, panelMode, variant, runHaps, props.probeKinds]);
  const scopeShown =
    variant !== "mini" &&
    (wantWave ||
      wantSpectrum ||
      ((hostScope?.probe != null || (props.probeKinds?.length ?? 0) > 0) && probes.length > 0));
  // The source the panel listens to: the step's (one track, A1.L01) or the master bus.
  const [sourceNote, setSourceNote] = useState("The whole mix");
  const sourceKey = hostScope?.source.kind === "track" ? hostScope.source.label : "";
  useEffect(() => {
    if (!scopeShown) return;
    const want: ScopeSource = sourceKey ? { kind: "track", label: sourceKey } : { kind: "master" };
    try {
      oak.scope.setSource(want);
      setSourceNote(want.kind === "track" ? `The track ${want.label}` : "The whole mix");
    } catch {
      // The adapter taps one labelled track (sound, Wave 5); it refuses only a track it cannot name. Then the
      // master bus, said plainly.
      try {
        oak.scope.setSource({ kind: "master" });
      } catch {
        // nothing to fall back to
      }
      setSourceNote(`The whole mix (no track called ${sourceKey} to listen to alone)`);
    }
  }, [oak, scopeShown, sourceKey]);

  // The tutor's bar references loop those bars (1-based, inclusive) in this Workbench. Bars count from the first
  // full bar (c4): with a pickup, the tutor's bar n is cycle n (cycle 0 is the pickup bar).
  const tutorBars = props.tutorBars === true && loopControls;
  useEffect(() => {
    if (!tutorBars) return;
    const onBars = (e: Event) => {
      const d = (e as CustomEvent<{ from: number; to: number }>).detail;
      if (!d || !Number.isFinite(d.from) || !Number.isFinite(d.to)) return;
      const next = clampRegion(tutorBarsRegion(d, Boolean(props.pickup)), loopBars);
      setRegion(next);
      setLoopOn(true);
      propsRef.current.onLoopChange?.({ on: true, region: next });
      if (handle && !handle.disposed && handle.playing) void restartLoop(handle.getCode());
    };
    // A section chip in the tutor panel: select and loop that section, exactly as a click on the ribbon does.
    const onSection = (e: Event) => {
      const d = (e as CustomEvent<SectionLoop | null>).detail;
      if (!d || !Number.isFinite(d.from) || !Number.isFinite(d.bars)) return;
      loopSection(d);
    };
    window.addEventListener(TUTOR_BARS_EVENT, onBars);
    window.addEventListener(TUTOR_SECTION_EVENT, onSection);
    return () => {
      window.removeEventListener(TUTOR_BARS_EVENT, onBars);
      window.removeEventListener(TUTOR_SECTION_EVENT, onSection);
    };
  });

  const onToggle = useCallback(async () => {
    if (!handle) return;
    if (ab?.active) ab.stop();
    const pv = previewRef.current;
    if (pv.playing || pv.pending || pv.lifting || pv.liftPending) {
      pv.stop();
      return;
    }
    setBusy(true);
    try {
      await oak.unlock();
      if (loop.playing) loop.stop();
      else if (handle.playing) handle.stop();
      else if (loopOn) await startLoop(handle.getCode());
      else await handle.play();
    } finally {
      setBusy(false);
    }
  }, [handle, oak, ab, loop, loopOn]);

  const applyMutes = (next: MuteMap) => {
    setMutes(next);
    handle?.setMutes(next);
    propsRef.current.onMutes?.(next);
  };

  // --- Oak 2.0 W1: focus one part (`soloLabel`) -----------------------------------------------------------
  // The labels focus muted (that were not muted before), so ending focus takes off only those. Not reported through
  // `onMutes`: a focus is not the learner's own mute and is never saved with the sketch.
  const mutesNow = useRef(mutes);
  mutesNow.current = mutes;
  const focusAdded = useRef<{ label: string | null; added: ReadonlySet<string> }>({
    label: null,
    added: new Set(),
  });
  const soloLabel = props.soloLabel ?? null;
  const labelsKey = useMemo(
    () =>
      labelledLines(code)
        .map((l) => l.label)
        .join("\n"),
    [code],
  );
  useEffect(() => {
    if (!handle || handle.disposed) return;
    const prev = focusAdded.current;
    if (soloLabel === null && prev.added.size === 0) return;
    // Take off what the previous focus added, then add what this one needs.
    const muted = new Set([...mutesNow.current.muted].filter((t) => !prev.added.has(t)));
    const added = new Set<string>();
    if (soloLabel !== null) {
      for (const l of labelsKey.split("\n")) {
        if (l === "" || l === soloLabel || muted.has(l)) continue;
        muted.add(l);
        added.add(l);
      }
    }
    focusAdded.current = { label: soloLabel, added };
    const next: MuteMap = { ...mutesNow.current, muted };
    setMutes(next);
    handle.setMutes(next);
  }, [handle, soloLabel, labelsKey]);
  const onPracticeTempo = () => {
    const next = nextPracticeTempo(practice);
    setPractice(next);
    if (playing && model) oak.transport.setCps(model.cps * next);
    // While looping, the player's rate follows (use-loop.ts).
  };

  const audition = useCallback(
    (midi: number) => {
      void oak
        .unlock()
        .then(() => oak.playNote({ s: propsRef.current.auditionSound ?? "piano", note: midi, dur: 0.6 }));
    },
    [oak],
  );

  // --- Wave 7: the advanced tracks' lenses (wave7.md §4.2) ------------------------------------------------
  // Each opens with its lesson or one of its tools (the lesson being taken included); its switch shows only where
  // the piece has something for it to draw; a host's `trackLenses` wins. No step names them: they apply in a step too.
  const trackSrc = variant !== "mini" ? (source?.track ?? null) : null;
  const tk = model?.track ?? null;
  const trackOpen = (id: TrackLensId): boolean =>
    trackSrc !== null &&
    (trackSrc.available[id] ||
      TRACK_LENS_GATES[id].tools.some((t) => unlockedSet.has(t)) ||
      props.lessonId === TRACK_LENS_GATES[id].lesson);
  // Swung 16ths (R1.L02, `tb.swing.patterned`) are drawn against their straight places before the microtiming lens
  // opens (R1.L05): the switch then shows the swing alone, named "Swing".
  const swingOnly = trackSrc !== null && !trackOpen("microtiming") && unlockedSet.has(PATTERNED_SWING_TOOL);
  const swingMarks = useMemo(() => {
    const micro = tk?.micro;
    if (!micro) return null;
    return {
      marks: new Map([...micro.marks].filter(([, m]) => m.kind === "swing")),
      tracks: micro.tracks.filter((t) => t.swing !== null),
    };
  }, [tk]);
  const trackHas: Record<TrackLensId, boolean> = {
    tensions: (tk?.tensions.size ?? 0) > 0,
    voicings: (tk?.voicings.length ?? 0) > 0,
    chordScales:
      chords.band && (model?.harmony?.regions.length ?? 0) > 0 && (tk?.regions.some((r) => r.scale) ?? false),
    clave: (tk?.clave ?? null) !== null,
    polyLanes: (tk?.poly ?? null) !== null,
    microtiming: swingOnly ? (swingMarks?.marks.size ?? 0) > 0 : (tk?.micro.marks.size ?? 0) > 0,
    registers: (tk?.registers ?? null) !== null && wantSpectrum,
    density: (tk?.density ?? null) !== null,
  };
  const trackOpenNow = (id: TrackLensId): boolean => trackOpen(id) || (id === "microtiming" && swingOnly);
  const trackOn = (id: TrackLensId): boolean => {
    if (variant === "mini") return false;
    const host = props.trackLenses?.[id];
    if (host !== undefined) return host && trackHas[id];
    return trackSrc !== null && trackOpenNow(id) && trackSrc.prefs[id] && trackHas[id];
  };
  const trackSwitches = TRACK_SWITCHES.filter(
    (m) => props.trackLenses?.[m.id] === undefined && trackOpenNow(m.id) && trackHas[m.id],
  ).map((m) =>
    m.id === "microtiming" && swingOnly
      ? { ...m, label: "Swing", title: "Each swung note against its straight place, with the swing ratio" }
      : m,
  );
  const toggleTrackLens = (id: TrackLensId) => {
    if (!trackSrc || !trackSwitches.some((m) => m.id === id)) return;
    trackSrc.toggle(id);
  };
  const subsTaught = [...Object.entries(DEVICE_LESSONS)].filter(([, l]) => taught(l)).map(([d]) => d);
  const twoFivesOn = chords.symbols && taught(TWO_FIVE_LESSON);
  const onKey = TRACK_SWITCHES.map((m) => (trackOn(m.id) ? "1" : "0")).join("");
  const rollTrack: RollTrack = useMemo(() => {
    const on = (i: number) => onKey[i] === "1";
    const subs = new Set(subsTaught);
    const jazzOn = on(1) || on(2) || subs.size > 0 || (twoFivesOn && (tk?.twoFives.length ?? 0) > 0);
    return {
      tensions: on(0) ? (tk?.tensions ?? null) : null,
      voicings: on(1) ? (tk?.voicings ?? null) : null,
      clave: on(3) ? (tk?.clave ?? null) : null,
      poly: on(4) ? (tk?.poly ?? null) : null,
      micro: on(5) ? (swingOnly ? swingMarks : (tk?.micro ?? null)) : null,
      density: on(7) ? (tk?.density ?? null) : null,
      odd: tk?.odd ?? null,
      jazz:
        tk && jazzOn
          ? {
              regions: tk.regions,
              show: { voicings: on(1), scales: on(2) },
              subs,
              twoFives: twoFivesOn ? tk.twoFives : null,
            }
          : null,
    };
    // `onKey` stands for which lenses are on; the taught substitutions by their text.
  }, [tk, onKey, subsTaught.join("|"), twoFivesOn, swingOnly, swingMarks]);
  const jazzSymbols = useMemo(
    () => (jazzGlyphs && tk ? tk.regions.map((r) => r.jazz) : null),
    [jazzGlyphs, tk],
  );

  // --- layout -----------------------------------------------------------------------------------
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // The height the workbench lives in: the viewport under the shell's header (the <main> top).
    const measureHeight = () => {
      const main = el.closest("main");
      const top = main ? Math.max(0, main.getBoundingClientRect().top) : 0;
      setAvailHeight(Math.floor(window.innerHeight - top));
    };
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 1024);
      if (w > 0) setWidth(w);
      measureHeight();
    });
    ro.observe(el);
    window.addEventListener("resize", measureHeight);
    measureHeight();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureHeight);
    };
  }, []);
  const layout = layoutFor(width, availHeight);
  const anyPanelAvailable = PANEL_SWITCHES.some((p) => panelAvailable[p.id]);
  const musicViews: MusicView[] = views.filter((v) => v !== "keyboard");
  const showKeyboard = views.includes("keyboard");
  const tabs: ViewTab[] = musicViews.length > 1 ? [...musicViews, "both"] : musicViews;
  const activeTab: ViewTab = tabs.includes(tab) ? tab : (tabs[0] ?? "roll");
  const tabIds = `${id}tab`;
  const onTabKey = (ev: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.indexOf(activeTab);
    const next =
      ev.key === "ArrowRight"
        ? tabs[(i + 1) % tabs.length]
        : ev.key === "ArrowLeft"
          ? tabs[(i - 1 + tabs.length) % tabs.length]
          : ev.key === "Home"
            ? tabs[0]
            : ev.key === "End"
              ? tabs[tabs.length - 1]
              : undefined;
    if (!next) return;
    ev.preventDefault();
    ev.stopPropagation();
    setTab(next);
    document.getElementById(`${tabIds}-${next}`)?.focus();
  };

  // Workbench shortcuts (not inside the editor): A/B, Shift+A, K typing keyboard, Z/X octave.
  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    const target = ev.target as Element;
    if (target.closest?.(".cm-editor") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    // ux §7.10 Workbench keys: Space plays/stops (never on a focused control, which Space activates), F focuses
    // the editor, T steps the practice tempo, R/N pick the Roll/Staff tab when the views are tabbed.
    const onControl = target.closest?.(
      "button, a, input, select, textarea, summary, [role=tab], [contenteditable], [data-oak-events]",
    );
    if (!typing && !onControl && !ev.shiftKey && !ev.repeat) {
      if (ev.key === " ") {
        ev.preventDefault();
        void onToggle();
        return;
      }
      if (k === "f" && handle && !handle.disposed) {
        ev.preventDefault();
        handle.view.focus();
        return;
      }
      if (k === "t") {
        ev.preventDefault();
        onPracticeTempo();
        return;
      }
      if (layout === "tabs" && (k === "r" || k === "n") && musicViews.length > 1) {
        const want: MusicView = k === "r" ? "roll" : "staff";
        if (musicViews.includes(want)) {
          ev.preventDefault();
          setTab(want);
          return;
        }
      }
    }
    // Loop region and metronome (ux §7.10): L, [ ], Shift+[ Shift+], M. Not in text fields.
    const textField = target.closest?.("input, select, textarea, [contenteditable]");
    // Wave 7: Shift+X tensions, Shift+Q chord-scales, Shift+D density (the other five from the lens bar).
    if (!typing && !textField && !ev.repeat && ev.shiftKey && trackSwitches.length > 0) {
      const hit = trackSwitches.find((m) => m.keys !== "" && m.keys === `Shift+${k.toUpperCase()}`);
      if (hit) {
        ev.preventDefault();
        toggleTrackLens(hit.id);
        return;
      }
    }
    // Wave 6: Shift+I guide tones, Shift+J the key ribbon, Shift+V the beat grid (inside a lesson step too).
    if (!typing && !textField && !ev.repeat && ev.shiftKey && musicSwitches.length > 0) {
      const hit = musicSwitches.find((m) => m.keys === `Shift+${k.toUpperCase()}`);
      if (hit) {
        ev.preventDefault();
        toggleMusicLens(hit.id);
        return;
      }
    }
    // The lens bar (Wave 3): D degrees, S solfège, Shift+N note names, Shift+K key panel, Shift+C circle; Wave 4:
    // Shift+H chord symbols, Shift+R numerals, Shift+F function, Shift+T chord tones, Shift+G range, Shift+L lead.
    if (!typing && !textField && !ev.repeat && (lensBar || anyPanelAvailable)) {
      const lens: LensId | null =
        !ev.shiftKey && k === "d"
          ? "degrees"
          : !ev.shiftKey && k === "s"
            ? "solfege"
            : ev.shiftKey && k === "n"
              ? "noteNames"
              : null;
      if (lens && lensBar && source?.available[lens]) {
        ev.preventDefault();
        toggleLens(lens);
        return;
      }
      const chordLens: ChordLensId | null =
        ev.shiftKey && k === "h" ? "chordSymbols" : ev.shiftKey && k === "r" ? "romanNumerals" : null;
      if (chordLens && chordLensBar && chordLenses?.available[chordLens]) {
        ev.preventDefault();
        toggleChordLens(chordLens);
        return;
      }
      const lineLens = ev.shiftKey
        ? (LINE_SWITCHES.find((l) => l.keys === `Shift+${k.toUpperCase()}`)?.id ?? null)
        : null;
      if (lineLens && lineLenses?.available[lineLens]) {
        ev.preventDefault();
        toggleLineLens(lineLens);
        return;
      }
      const panel = ev.shiftKey
        ? (PANEL_SWITCHES.find((p) => p.keys === `Shift+${k.toUpperCase()}`)?.id ?? null)
        : null;
      if (panel && panelAvailable[panel]) {
        ev.preventDefault();
        togglePanel(panel);
        return;
      }
    }
    if (loopControls && !typing && !textField && !ev.repeat) {
      const code = ev.code;
      const bracket =
        code === "BracketLeft" || ev.key === "[" || ev.key === "{"
          ? "left"
          : code === "BracketRight" || ev.key === "]" || ev.key === "}"
            ? "right"
            : null;
      if (k === "l" && !ev.shiftKey) {
        ev.preventDefault();
        toggleLoop();
        return;
      }
      if (k === "m" && !ev.shiftKey) {
        ev.preventDefault();
        setMetronomeOn((on) => !on);
        return;
      }
      if (bracket) {
        ev.preventDefault();
        stepLoop(
          bracket === "left" ? (ev.shiftKey ? "earlier" : "shrink") : ev.shiftKey ? "later" : "extend",
        );
        return;
      }
    }
    if (k === "k" && !ev.shiftKey && !typing && showKeyboard) {
      setTyping(true);
      ev.preventDefault();
      return;
    }
    if (typing) {
      if (ev.key === "Escape") setTyping(false);
      else if (k === "z") setOctave((o) => Math.max(1, o - 1));
      else if (k === "x") setOctave((o) => Math.min(7, o + 1));
      else if (k in TYPING_MAP) {
        const midi = typedMidi(k, keySpec, octave);
        if (midi !== null && !ev.repeat) {
          audition(midi);
          setPressed((p) => new Set([...p, midi]));
        }
      } else return;
      ev.preventDefault();
      return;
    }
    if (!ab || !can.ab) return;
    if (k === "a" && ev.shiftKey) ab.alternate();
    else if (k === "a") ab.playA();
    else if (k === "b") ab.playB();
    else return;
    ev.preventDefault();
  };
  const onKeyUp = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    if (!typing) return;
    const midi = typedMidi(ev.key.toLowerCase(), keySpec, octave);
    if (midi !== null) setPressed((p) => new Set([...p].filter((m) => m !== midi)));
  };

  const lensSwitches: TransportLenses = {
    labels: [
      ...(lensBar && source
        ? [
            ...(source.available.degrees
              ? [
                  {
                    id: "degrees",
                    label: "Degrees",
                    on: source.shown.degrees,
                    keys: "D",
                    title: "Degree numbers on every note",
                  },
                ]
              : []),
            ...(source.available.solfege
              ? [
                  {
                    id: "solfege",
                    label: "Solfège",
                    on: source.shown.solfege,
                    keys: "S",
                    title: "Movable-do syllables",
                  },
                ]
              : []),
            {
              id: "noteNames",
              label: "Names",
              on: source.shown.noteNames,
              keys: "Shift+N",
              title: "Note names",
            },
            ...(chordLensBar && chordLenses
              ? CHORD_SWITCHES.filter((c) => chordLenses.available[c.id]).map((c) => ({
                  ...c,
                  on: chordLenses.shown[c.id],
                }))
              : []),
            ...(lineLenses
              ? LINE_SWITCHES.filter((l) => lineLenses.available[l.id]).map((l) => ({
                  ...l,
                  on: lineLenses.shown[l.id],
                }))
              : []),
          ]
        : []),
      ...musicSwitches.map((m) => ({ ...m, on: musicOn(m.id) })),
    ],
    panels: PANEL_SWITCHES.filter((p) => panelAvailable[p.id]).map((p) => ({ ...p, on: panelsOpen[p.id] })),
    track: trackSwitches.map((m) => ({ ...m, on: trackOn(m.id) })),
    onToggle: (id) => {
      if (PANEL_SWITCHES.some((p) => p.id === id)) togglePanel(id as PanelId);
      else if (TRACK_SWITCHES.some((m) => m.id === id)) toggleTrackLens(id as TrackLensId);
      else if (id === "chordSymbols" || id === "romanNumerals") toggleChordLens(id);
      else if (LINE_SWITCHES.some((l) => l.id === id)) toggleLineLens(id as LineLensId);
      else if (MUSIC_SWITCHES.some((m) => m.id === id)) toggleMusicLens(id as MusicLensId);
      else toggleLens(id as LensId);
    },
  };
  const stale = !anyPlaying || (model !== null && model.code !== playedCode);
  const evalError = analysis.error && analysis.errorCode === code ? analysis.error : null;
  // The Run's own error wins (it is what Strudel said); otherwise the static analysis's, made friendly.
  const issue = runIssue && runIssue.code === code ? runIssue : null;
  const banner: { message: string; detail: string } | null =
    issue?.kind === "error"
      ? issue
      : evalError
        ? evalError.kind === "timeout"
          ? { message: "That took too long — infinite loop or huge pattern?", detail: evalError.message }
          : evalError.kind === "lint"
            ? // Oak's own lint already speaks to the learner ("`stack` unlocks in the lesson “Together Now”");
              // the Strudel-error rewording would misread a locked mini-notation operator as a typo.
              { message: evalError.message, detail: evalError.message }
            : friendlyEvalError(evalError.message, code, evalError.pos ?? null)
        : null;
  const silent =
    !banner &&
    (issue?.kind === "silent" ||
      (model !== null && model.code === code && model.events.length === 0 && !analysis.pending));
  const silenced = useCallback((t: string) => isSilenced(mutes, t), [mutes]);
  const tracks = model?.tracks ?? [];
  const trackChips = props.trackChips ?? null;
  const chips = useMemo(() => trackChips?.chipsOf(tracks) ?? null, [trackChips, tracks]);
  const applyChips = (next: MuteMap) => {
    setChipMutes(next);
    if (trackChips) applyMutes(trackChips.mutesOf(next, tracks));
  };
  // The tracks changed under muted or soloed chips (a new line, a song with another take): the player's mutes are
  // read again from the chips, so a soloed part still silences a line that appeared after the click.
  const tracksKey = tracks.join("\n");
  useEffect(() => {
    if (!trackChips || (chipMutes.muted.size === 0 && chipMutes.solo === null)) return;
    applyMutes(trackChips.mutesOf(chipMutes, tracks));
  }, [tracksKey]);
  const harmony = model?.harmony ?? null;
  const ranges = useMemo(
    () => (model && panelsOpen.range ? rangeLines(model.events) : null),
    [model, panelsOpen.range],
  );
  const lead = useMemo(() => (model && leadSheet ? leadEvents(model) : null), [model, leadSheet]);
  const chordSet = useMemo(
    () => ({ symbols: chords.symbols || leadSheet, romans: chords.romans }),
    [chords.symbols, chords.romans, leadSheet],
  );

  const ribbon = showRibbon
    ? {
        sections,
        energy: lines?.form.energy ?? [],
        problem: lines?.problem ?? null,
        currentBar,
        loop: sectionLoop,
        onLoop: loopSection,
        pickup: Boolean(props.pickup),
        showEnergy: panelsOpen.form === true,
      }
    : null;
  // --- Wave 6: what U12–U17 add to the roll ----------------------------------------------------------
  const guideOn = musicOn("guideTones");
  const keyRibbonOn = musicOn("keyPlan") && musicHas.keyPlan;
  const beatGridOn = musicOn("beatGrid");
  // The mode's colour note is ringed while the key panel is open on a mode the learner knows (or wrote).
  const modeKnown =
    keyNow !== null &&
    isColourMode(keyNow) &&
    (source === null || unlockedSet.has(MODE_TOOLS[keyNow.mode as keyof typeof MODE_TOOLS] ?? ""));
  const modeOn = panelsOpen.key && modeKnown && (colour?.mode.size ?? 0) > 0;
  const ghostsOn = source === null || unlockedSet.has(VELOCITY_TOOL);
  const rollMusic: RollMusic = useMemo(
    () => ({
      guide: guideOn ? (colour?.guide ?? null) : null,
      grid: beatGridOn ? (colour?.rhythm?.grid ?? null) : null,
      pushes: beatGridOn ? (colour?.rhythm?.pushes ?? null) : null,
      ghosts: ghostsOn ? (colour?.rhythm?.ghosts ?? null) : null,
      modeTones: modeOn ? (colour?.mode ?? null) : null,
      keys: keyRibbonOn ? (colour?.keys ?? null) : null,
      currentBar,
      chromaticSyllables: depth.chromatic,
    }),
    [colour, guideOn, beatGridOn, ghostsOn, modeOn, keyRibbonOn, currentBar, depth.chromatic],
  );
  const guideMarks = guideOn ? (colour?.guide.marks ?? null) : null;
  const keyExtras: KeyExtras = {
    unlocked: source === null ? null : unlockedSet,
    taught,
    onChord: (midis) => {
      for (const m of midis) audition(m);
    },
  };
  const bassMarks = lineLenses?.shown.bassRoles ? (lines?.bassMarks ?? null) : null;
  const blueNotes = lineLenses?.shown.blueNotes ? (lines?.blue ?? null) : null;
  const badges = useMemo(() => swingBadges(lines?.swing ?? []), [lines]);

  const renderView = (v: MusicView) => {
    if (!model)
      return <p className="oak-muted">{analysis.pending ? "Reading the code…" : "No music yet."}</p>;
    if (v === "roll")
      return (
        <PianoRoll
          model={model}
          bus={bus}
          clock={clock}
          color={labels.color}
          labels={labels.gutter}
          noteLabels={labels.note}
          hover={labels.hover}
          ghosts={ghosts}
          barMarks={marks.barMarks}
          silenced={silenced}
          onAudition={(e) => e.midi !== null && audition(e.midi)}
          stale={stale}
          loop={loopOn ? region : null}
          height={variant === "mini" ? 60 : 180}
          {...(chords.band && harmony
            ? {
                chordBand: {
                  regions: harmony.regions,
                  source: harmony.source,
                  symbols: chords.symbols,
                  romans: chords.romans,
                  fn: chords.fn,
                  pickup: Boolean(props.pickup),
                  chords: model.band,
                  ...(jazzSymbols ? { jazz: jazzSymbols } : {}),
                },
              }
            : {})}
          {...(panelsOpen["chord-tones"]
            ? {
                chordTones: {
                  marks: harmony?.melody ?? new Map(),
                  percent: chordTonePercent(harmony),
                  strong: harmony?.strong ?? null,
                },
              }
            : {})}
          {...(ranges ? { ranges } : {})}
          {...(ribbon ? { ribbon } : {})}
          {...(bassMarks && bassMarks.size > 0 ? { bassMarks } : {})}
          {...(blueNotes && blueNotes.size > 0 ? { blueNotes } : {})}
          music={rollMusic}
          track={rollTrack}
          {...(variant !== "mini" && (props.rollFollowBars ?? FOLLOW_PAGE_BARS) > 0
            ? { followBars: props.rollFollowBars ?? FOLLOW_PAGE_BARS }
            : {})}
        />
      );
    if (v === "staff")
      return (
        <>
          {/* No roll beside the staff (or the staff tab alone): the ribbon rides over the staff instead. */}
          {ribbon && (!musicViews.includes("roll") || (layout === "tabs" && activeTab === "staff")) ? (
            <SectionRibbon {...ribbon} axis={linearAxis(Math.max(200, width - 24), model.bars)} />
          ) : null}
          <StaffView
            model={model}
            bus={bus}
            stale={stale}
            loopLabel={loopOn ? regionLabel(region) : null}
            loopFrom={loopOn ? region.from : null}
            hover={labels.hover}
            annotations={labels.staff}
            chordSet={chordSet}
            playBar={currentBar}
            {...(guideMarks && guideMarks.size > 0 ? { guide: guideMarks } : {})}
            {...(lead ? { lead } : {})}
          />
        </>
      );
    return null;
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: workbench-level shortcuts (ux §7.10)
    <div
      ref={rootRef}
      className={`oak-workbench oak-workbench--${variant} oak-layout--${layout}`}
      data-testid="workbench"
      data-editor-id={id}
      data-playing={anyPlaying ? "1" : "0"}
      data-loop={loopOn ? `${region.from + 1}-${region.from + region.bars}` : undefined}
      data-looping={loop.playing ? "1" : "0"}
      data-metronome={metronomeOn ? "1" : "0"}
      data-analysis={analysis.pending ? "pending" : model ? "ready" : "none"}
      data-labels={labels.mode}
      data-lenses={
        labels.mode === "lenses"
          ? (["degree", "solfege", "noteName"] as const).filter((k) => labels.note[k]).join(" ")
          : undefined
      }
      data-key={keyNow ? `${keyNow.tonic} ${keyNow.mode}` : undefined}
      data-panels={(Object.keys(panelsOpen) as PanelId[]).filter((p) => panelsOpen[p]).join(" ")}
      data-chords={[
        chords.symbols ? "symbols" : "",
        chords.romans ? "romans" : "",
        chords.fn ? "function" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-targets={targetText}
      data-sections={sections.length > 0 ? sections.map((x) => x.tag).join(" ") : undefined}
      data-form-problem={lines?.problem ? "1" : undefined}
      data-line-lenses={
        lineLenses
          ? LINE_SWITCHES.filter((l) => lineLenses.shown[l.id])
              .map((l) => l.id)
              .join(" ")
          : undefined
      }
      data-piece-bars={loopBars}
      data-music-lenses={MUSIC_SWITCHES.filter((m) => musicOn(m.id) && musicHas[m.id])
        .map((m) => m.id)
        .join(" ")}
      data-track-lenses={TRACK_SWITCHES.filter((m) => trackOn(m.id))
        .map((m) => m.id)
        .join(" ")}
      data-chord-style={jazzGlyphs ? "jazz" : undefined}
      data-depth={[
        depth.sevenths ? "sevenths" : "",
        depth.applied ? "applied" : "",
        depth.borrowed ? "borrowed" : "",
        depth.chromatic ? "chromatic" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-key-plan={
        colour && colour.keys.length > 1 ? colour.keys.map((k) => k.text).join(" → ") : undefined
      }
      // Focusable (not a tab stop) so a click on the roll or the staff gives the workbench its keys.
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <div className="oak-wb-editor">
        <div ref={editorRoot} className="oak-editor-root" data-testid="editor-root" />
      </div>
      <TransportBar
        playing={anyPlaying}
        busy={busy || !handle}
        onToggle={() => void onToggle()}
        clock={clock}
        meter={meter}
        cps={model?.cps ?? null}
        cpsDefault={model ? !model.cpsSet : false}
        loopBars={loopBars}
        keySpec={keySpec}
        {...(chips
          ? {
              tracks: chips.map((c) => c.id),
              trackLabel: (id: string) => chips.find((c) => c.id === id)?.label ?? id,
              mutes: chipMutes,
              onMute: (id: string) => applyChips(toggleMute(chipMutes, id)),
              onSolo: (id: string) => applyChips(toggleSolo(chipMutes, id)),
            }
          : {
              tracks,
              ...(props.trackLabel ? { trackLabel: props.trackLabel } : {}),
              mutes,
              onMute: (t: string) => applyMutes(toggleMute(mutes, t)),
              onSolo: (t: string) => applyMutes(toggleSolo(mutes, t)),
            })}
        badges={badges}
        practiceTempo={practice}
        onPracticeTempo={onPracticeTempo}
        readOnly={props.readOnly === true}
        minimal={props.transport === "minimal"}
        {...(lensBar || anyPanelAvailable || musicSwitches.length > 0 || trackSwitches.length > 0
          ? { lenses: lensSwitches }
          : {})}
        {...(loopControls
          ? {
              loop: {
                on: loopOn,
                label: regionLabel(region),
                onToggle: toggleLoop,
                onStep: stepLoop,
                can: {
                  shrink: canStep("shrink"),
                  extend: canStep("extend"),
                  earlier: canStep("earlier"),
                  later: canStep("later"),
                },
              },
              metronome: { on: metronomeOn, onToggle: () => setMetronomeOn((on) => !on) },
            }
          : {})}
      />
      {props.toolbar ? <div className="oak-wb-toolbar">{props.toolbar}</div> : null}
      {banner ? (
        <div className="oak-banner" role="status" data-testid="eval-banner">
          <p>
            {/* Oak's lint names code in backticks ("`n` unlocks in …"): drawn as inline code, never raw. */}
            <strong>Code didn't run.</strong> <InlineCode text={banner.message} />
            {model ? (
              <span className="oak-muted">
                {anyPlaying
                  ? " The last version that ran keeps playing."
                  : " Showing the last version that ran."}
              </span>
            ) : null}
          </p>
          {banner.detail && banner.detail !== banner.message ? (
            <details className="oak-banner-detail">
              <summary>Details</summary>
              <code>{banner.detail}</code>
            </details>
          ) : null}
        </div>
      ) : silent ? (
        <p className="oak-notice" role="status" data-testid="eval-silent">
          The code runs, but it plays no notes yet.
        </p>
      ) : null}
      <div className="oak-wb-views">
        {layout === "tabs" && musicViews.length > 1 ? (
          <>
            <div role="tablist" aria-label="Music views" className="oak-tabs">
              {tabs.map((v) => (
                <button
                  key={v}
                  id={`${tabIds}-${v}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === v}
                  aria-controls={`${tabIds}-panel`}
                  tabIndex={activeTab === v ? 0 : -1}
                  onClick={() => setTab(v)}
                  onKeyDown={onTabKey}
                  data-testid={`tab-${v}`}
                >
                  {v === "roll" ? "Roll" : v === "staff" ? "Staff" : "Both"}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`${tabIds}-panel`}
              aria-labelledby={`${tabIds}-${activeTab}`}
              className="oak-tabpanel"
            >
              {activeTab === "both" && model
                ? musicViews.map((v) => <div key={v}>{renderView(v)}</div>)
                : renderView(activeTab === "both" ? "roll" : activeTab)}
            </div>
          </>
        ) : model ? (
          musicViews.map((v) => <div key={v}>{renderView(v)}</div>)
        ) : musicViews.length > 0 ? (
          // Nothing to draw yet: one line, not one per view side by side.
          <div>{renderView(musicViews[0] ?? "roll")}</div>
        ) : null}
        {showKeyboard ? (
          <Keyboard
            model={model}
            keySpec={keySpec}
            bus={bus}
            onAudition={audition}
            typing={typing}
            pressed={pressed}
            degrees={labels.keyboardDegrees}
          />
        ) : null}
      </div>
      {anyPanel || panelsOpen.form || panelsOpen.chart || scopeShown ? (
        <div
          className={`oak-wb-panels${[panelsOpen.key, panelsOpen.circle, panelsOpen.form, panelsOpen.chart, scopeShown].filter(Boolean).length > 1 ? " oak-wb-panels--two" : ""}`}
        >
          <div className="oak-wb-panels-grid">
            {panelsOpen.key ? (
              <KeyPanel current={keyNow} keys={keysOfPiece} preview={preview} extras={keyExtras} />
            ) : null}
            {panelsOpen.circle ? (
              <CircleOfFifths current={keyNow} keys={keysOfPiece} preview={preview} extras={keyExtras} />
            ) : null}
            {panelsOpen.form ? (
              <FormMap
                form={lines?.form ?? null}
                sections={sections}
                problem={lines?.problem ?? null}
                loop={sectionLoop}
                onLoop={loopSection}
                currentBar={currentBar}
                pickup={Boolean(props.pickup)}
                cut={lines?.cut ?? null}
              />
            ) : null}
            {panelsOpen.chart && model ? (
              <ChartPanel
                regions={harmony?.regions ?? []}
                meter={model.meter}
                bars={model.bars}
                pickup={Boolean(props.pickup)}
                swing={(lines?.swing ?? []).find((t) => t.swung !== null)?.swung ?? null}
                blues={lines?.blues ?? null}
                currentBar={currentBar}
                period={Math.max(model.totalBars ?? 0, alternationBars(model.code))}
                chordStyle={jazzGlyphs ? "jazz" : "lead-sheet"}
              />
            ) : null}
            {scopeShown ? (
              wantWave || wantSpectrum ? (
                <ScopePanel
                  tap={oak.scope}
                  show={{ wave: wantWave, spectrum: wantSpectrum }}
                  playing={anyPlaying}
                  probe={probes[0]?.probe ?? null}
                  probeKind={probes[0]?.kind ?? null}
                  f0={probes[0]?.f0 ?? null}
                  sourceNote={sourceNote}
                  ran={runHaps !== null}
                  registers={trackOn("registers") ? (tk?.registers ?? null) : null}
                />
              ) : (
                <section className="oak-wb-panel oak-scope" aria-label="Sound" data-testid="probe-panel">
                  {probes.slice(0, 1).map((pr) => (
                    <ProbeView
                      key={pr.kind}
                      probe={pr.probe}
                      kind={pr.kind}
                      f0={pr.f0}
                      ran={runHaps !== null}
                    />
                  ))}
                </section>
              )
            ) : null}
            {scopeShown && (wantWave || wantSpectrum) && probes.length > 1 ? (
              <section
                className="oak-wb-panel oak-scope"
                aria-label="More of the sound"
                data-testid="probe-more"
              >
                {probes.slice(1).map((pr) => (
                  <ProbeView
                    key={pr.kind}
                    probe={pr.probe}
                    kind={pr.kind}
                    f0={pr.f0}
                    ran={runHaps !== null}
                  />
                ))}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
      {variant !== "mini" && !fb && props.target && props.abLabels ? (
        ab ? (
          <ABStrip ab={ab} labels={props.abLabels} />
        ) : null
      ) : variant !== "mini" && (fb || props.target) ? (
        <FeedbackPanel
          result={fb?.result ?? null}
          rung={fb?.rung ?? 0}
          {...(fb?.hintPending === undefined ? {} : { hintPending: fb.hintPending })}
          {...(fb?.passed === undefined ? {} : { passed: fb.passed })}
          {...(fb?.ladder === undefined ? {} : { ladder: fb.ladder })}
          {...(fb?.onRequestHint ? { onRequestHint: fb.onRequestHint } : {})}
          {...(renderFeedback ? { render: renderFeedback } : {})}
          bus={bus}
          abAudible={props.target?.audible ?? "fromHint2"}
          ab={ab}
          {...(props.abLabels ? { abLabels: props.abLabels } : {})}
        />
      ) : null}
    </div>
  );
}

/** A/B outside grading (Studio: this version against an earlier one): two sides, the side that plays now. */
function ABStrip({
  ab,
  labels,
}: {
  ab: NonNullable<ReturnType<typeof useAB>>;
  labels: { a: string; b: string };
}) {
  return (
    <section className="oak-ab-strip" aria-label="Compare versions" data-testid="ab-controls">
      <button
        type="button"
        className="oak-ab-btn"
        aria-pressed={ab.active === "A"}
        onClick={ab.playA}
        data-testid="ab-a"
      >
        A · {labels.a}
        {ab.pendingSide === "A" ? " …" : ""}
      </button>
      <button
        type="button"
        className="oak-ab-btn"
        aria-pressed={ab.active === "B"}
        onClick={ab.playB}
        data-testid="ab-b"
      >
        B · {labels.b}
        {ab.pendingSide === "B" ? " …" : ""}
      </button>
      {ab.active ? (
        <span className="oak-muted" data-testid="ab-now" aria-live="polite">
          Now playing {ab.active === "A" ? `A · ${labels.a}` : `B · ${labels.b}`}
          {" · "}
          <button type="button" className="oak-ab-btn" onClick={ab.stop}>
            Stop
          </button>
        </span>
      ) : (
        <span className="oak-muted">Switches on the next bar line. Keys: A and B.</span>
      )}
    </section>
  );
}
