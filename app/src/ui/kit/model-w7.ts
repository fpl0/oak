// Pure rules behind the Wave 7 kit pieces (docs/design/wave7.md): the track card's state and its one honest line,
// the A/B version switch's words, the export button's phases, the per-part level rows (a part more than 24 dB under
// the loudest one is "not heard", the corrections pass's rule c), the Euclid ring's geometry and words, and the
// slider that plays. Every piece draws and reports only; the owner measures, plays and words the music.
import type { TrackState } from "@oak/api";
import { euclid } from "@oak/theory";
import { waitsForNote } from "./lock-notes.ts";
import { dbFraction, dbText } from "./model-w6.ts";

// --- track card ------------------------------------------------------------------------------------

/**
 * Where an advanced track stands for the learner:
 * - `open`: something can be started and nothing is done yet;
 * - `in-progress`: something is done and something can be started;
 * - `waiting`: nothing can be started now, and a named gate holds the next thing (before the track opens, J2.L04
 *   before U14.CP, a track whose next lessons are not written yet: its note says so);
 * - `complete`: every session of the track is done.
 */
export type TrackCardState = "open" | "in-progress" | "waiting" | "complete";

export const TRACK_CARD_WORDS: Readonly<Record<TrackCardState, string>> = {
  open: "Open",
  "in-progress": "In progress",
  waiting: "Waiting",
  complete: "Complete",
};

type TrackLike = Pick<TrackState, "status" | "next" | "note" | "gates" | "sessionsDone" | "sessionsTotal"> &
  Partial<Pick<TrackState, "nextSession" | "focus" | "capstones" | "title" | "trackId">>;

/** The next thing the learner may start in the track: the server's `nextSession`, else the next lesson. */
export function trackNext(t: TrackLike): {
  kind: "lesson" | "checkpoint" | "capstone";
  id: string;
  title: string | null;
  minutes: number | null;
} | null {
  if (t.nextSession) {
    return {
      kind: t.nextSession.kind,
      id: t.nextSession.mapItemId,
      title: t.nextSession.title || null,
      minutes: t.nextSession.estMinutes > 0 ? t.nextSession.estMinutes : null,
    };
  }
  // An older server reports only the next lesson.
  if (t.nextSession === undefined && t.next)
    return { kind: "lesson", id: t.next, title: null, minutes: null };
  return null;
}

export function trackCardState(t: TrackLike): TrackCardState {
  if (t.sessionsTotal > 0 && t.sessionsDone >= t.sessionsTotal) return "complete";
  if (t.status === "locked") return "waiting";
  if (!trackNext(t)) return "waiting";
  return t.sessionsDone > 0 ? "in-progress" : "open";
}

/**
 * The gate that holds a waiting track, as the server words its requirement ("U13 checkpoint passed", "U14
 * checkpoint passed"): the first closed gate's first unmet requirement. `null` when no gate is closed (the track
 * waits on something else, e.g. lessons not written yet: its note says so).
 */
export function trackWaitingFor(t: Pick<TrackState, "gates">): string | null {
  for (const g of t.gates) {
    if (g.open) continue;
    const r = g.requires.find((x) => !x.met);
    if (r) return r.label;
  }
  return null;
}

/** "Next: J1.L03 The Major ii–V–I · about 20 min"; the checkpoint and capstone kinds say what they are. */
export function trackNextLine(next: NonNullable<ReturnType<typeof trackNext>>): string {
  const kind =
    next.kind === "checkpoint" ? "Checkpoint " : next.kind === "capstone" ? "Capstone session " : "";
  const title = next.title ? ` ${next.title}` : "";
  const minutes = next.minutes ? ` · about ${Math.round(next.minutes)} min` : "";
  return `Next: ${kind}${next.id}${title}${minutes}`;
}

/**
 * The card's one line. Waiting names the gate in words ("Waits for the unit 14 checkpoint.", `waitsForNote`: the
 * server's label leads with the id), never a count of what is
 * missing (wave7.md §10 item 18); a waiting track with no closed gate keeps the server's note. Open and in
 * progress name the next session; complete says so plainly.
 */
export function trackCardLine(t: TrackLike): string {
  const state = trackCardState(t);
  if (state === "complete") return `All ${t.sessionsTotal} sessions done. Every lesson stays open to replay.`;
  if (state === "waiting") {
    const gate = t.gates.filter((g) => !g.open).flatMap((g) => g.requires.find((r) => !r.met) ?? [])[0];
    // A track's own checkpoint is named by the server's label ("Jazz checkpoint 1 passed"), which carries no id.
    const named =
      gate?.kind === "checkpoint" && !/^U\d+\.CP$/.test(gate.ref) ? gate.label.replace(/ passed$/, "") : null;
    return gate ? waitsForNote(gate, named) : t.note.replace(/^Open\.\s+/, "");
  }
  const next = trackNext(t);
  return next ? trackNextLine(next) : t.note;
}

/** "12 of 34 sessions" (shown once something is done, and never for a track with nothing to count). */
export function trackProgressText(t: Pick<TrackState, "sessionsDone" | "sessionsTotal">): string | null {
  if (t.sessionsTotal <= 0 || t.sessionsDone <= 0) return null;
  return `${Math.min(t.sessionsDone, t.sessionsTotal)} of ${t.sessionsTotal} sessions`;
}

/** "1 of 4 capstones released" from the track's capstones; `null` when the server sends none. */
export function trackCapstonesText(t: Partial<Pick<TrackState, "capstones">>): string | null {
  const c = t.capstones;
  if (!c || c.length === 0) return null;
  const released = c.filter((x) => x.status === "released").length;
  return `${released} of ${c.length} ${c.length === 1 ? "capstone" : "capstones"} released`;
}

/** The card's accessible name: "Jazz Harmony: in progress, your focus. Next: J1.L03 …". */
export function trackCardSummary(title: string, t: TrackLike): string {
  const state = trackCardState(t);
  const focus = t.focus ? ", your focus" : "";
  return `${title}: ${TRACK_CARD_WORDS[state].toLowerCase()}${focus}. ${trackCardLine(t)}`;
}

// --- version switch --------------------------------------------------------------------------------

export interface VersionOption {
  id: string;
  /** "A", "B". */
  letter: string;
  /** "Swing", "Funk". */
  label: string;
  /** "96 BPM · rhodes, upright bass". */
  detail?: string;
}

/** "Version A: Swing (96 BPM · rhodes, upright bass)". */
export function versionName(v: VersionOption): string {
  return `Version ${v.letter}: ${v.label}${v.detail ? ` (${v.detail})` : ""}`;
}

/** The next version for the switch key (cycles). */
export function nextVersion(options: readonly VersionOption[], current: string, step: 1 | -1 = 1): string {
  if (options.length === 0) return current;
  const at = Math.max(
    0,
    options.findIndex((o) => o.id === current),
  );
  return (options[(at + step + options.length) % options.length] as VersionOption).id;
}

// --- export button ---------------------------------------------------------------------------------

export type ExportPhase = "idle" | "rendering" | "done" | "failed" | "cancelled";

export interface ExportState {
  phase: ExportPhase;
  /** 0–1 while rendering; `null` when the renderer cannot say. */
  fraction?: number | null;
  /** The file saved ("Four-Chord Song.wav"). */
  fileName?: string | null;
  /** Its size in bytes. */
  bytes?: number | null;
  /** Why it failed, in plain words (the renderer's `PieceRenderError.message`). */
  message?: string | null;
}

const pct = (f: number) => `${Math.round(Math.max(0, Math.min(1, f)) * 100)} %`;

function sizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The status line under the export button. A failure says why and that nothing was saved (wave7.md §10 item 22:
 * never a partial file); a cancel says the same.
 */
export function exportStatusText(s: ExportState): string {
  switch (s.phase) {
    case "idle":
      return "";
    case "rendering":
      return typeof s.fraction === "number" ? `Rendering… ${pct(s.fraction)}` : "Rendering…";
    case "done": {
      const size = s.bytes ? ` (${sizeText(s.bytes)})` : "";
      return s.fileName ? `Saved ${s.fileName}${size}.` : "Saved.";
    }
    case "cancelled":
      return "Export cancelled. Nothing was saved.";
    case "failed": {
      const why = (s.message ?? "").trim().replace(/\.?$/, ".");
      return why === "." ? "The export failed. Nothing was saved." : `${why} Nothing was saved.`;
    }
  }
}

// --- level meter rows ------------------------------------------------------------------------------

/** A part this far under the loudest part does not count as heard (the corrections pass, rule c). */
export const INAUDIBLE_BELOW_DB = 24;

export interface LevelPart {
  id: string;
  /** "Bass", "Rhodes". */
  label: string;
  /** Its level in dB (peak or RMS, as the owner measures it); `-Infinity` or `null`: silent. */
  db: number | null;
  /** The target band, when the brief has one: dB values, e.g. { low: -18, high: -10 }. */
  target?: { low: number; high: number } | null;
}

export interface LevelRow extends LevelPart {
  /** Where the bar ends on the meter (0–1). */
  fraction: number;
  /** "−12.0 dB", "silent". */
  text: string;
  /** Under the loudest part by this much (dB, ≥ 0), or `null` for a silent part or with nothing playing. */
  under: number | null;
  /** Counts as heard (not silent, not more than 24 dB under the loudest part). */
  heard: boolean;
  /** Inside its target band; `null` without one. */
  inTarget: boolean | null;
  /** The row's words: "−12.0 dB, 6.0 dB under the loudest part", "not heard: 27.0 dB under the loudest part". */
  sentence: string;
}

const silent = (db: number | null) => db === null || !Number.isFinite(db) || Number.isNaN(db);

export function levelRows(
  parts: readonly LevelPart[],
  opts: { floorDb?: number; ceilDb?: number; inaudibleDb?: number } = {},
): LevelRow[] {
  const floorDb = opts.floorDb ?? -60;
  const ceilDb = opts.ceilDb ?? 0;
  const gap = opts.inaudibleDb ?? INAUDIBLE_BELOW_DB;
  const levels = parts.filter((p) => !silent(p.db)).map((p) => p.db as number);
  const loudest = levels.length > 0 ? Math.max(...levels) : null;
  return parts.map((p): LevelRow => {
    const quiet = silent(p.db);
    const db = p.db as number;
    const under = quiet || loudest === null ? null : Math.max(0, loudest - db);
    const heard = !quiet && under !== null && under <= gap;
    const target = p.target ?? null;
    const inTarget = target && !quiet ? db >= target.low && db <= target.high : target ? false : null;
    const text = quiet ? "silent" : dbText(db);
    const sentence = quiet
      ? "silent"
      : !heard
        ? `not heard: ${dbText(under ?? 0).replace(/^[+−]/, "")} under the loudest part`
        : under !== null && under >= 0.05
          ? `${text}, ${dbText(under).replace(/^[+−]/, "")} under the loudest part`
          : `${text}, the loudest part`;
    return {
      ...p,
      fraction: quiet ? 0 : dbFraction(db, floorDb, ceilDb),
      text,
      under,
      heard,
      inTarget,
      sentence,
    };
  });
}

// --- Euclid ring -----------------------------------------------------------------------------------

export interface EuclidValue {
  /** Hits (k). */
  pulses: number;
  /** Steps (n). */
  steps: number;
  /** Rotation (r), as Strudel's `x(k,n,r)`. */
  rotation: number;
}

/** The grid of a ring, by @oak/theory's `euclid` (Strudel's rotation); an impossible value draws all rests. */
export function euclidGrid(v: EuclidValue): boolean[] {
  try {
    return euclid(v.pulses, v.steps, v.rotation);
  } catch {
    return Array.from({ length: Math.max(1, v.steps) }, () => false);
  }
}

/** "5 hits in 16 steps, rotated by 10" (the ring's accessible name, also `(5,16,10)` in code). */
export function euclidText(v: EuclidValue): string {
  const hits = `${v.pulses} ${v.pulses === 1 ? "hit" : "hits"} in ${v.steps} steps`;
  return v.rotation ? `${hits}, rotated by ${v.rotation}` : hits;
}

/** "(5,16,10)" or "(3,8)": the mini-notation the ring stands for. */
export function euclidCode(v: EuclidValue): string {
  return v.rotation ? `(${v.pulses},${v.steps},${v.rotation})` : `(${v.pulses},${v.steps})`;
}

/** Where step `i` of `n` sits on a ring of radius `r` around (cx, cy): step 0 at the top, clockwise. */
export function ringPoint(i: number, n: number, r: number, cx = 0, cy = 0): { x: number; y: number } {
  const a = (i / Math.max(1, n)) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export interface EuclidLimits {
  minSteps?: number;
  maxSteps?: number;
}

/**
 * The ring's keys when it is editable: ArrowUp/ArrowDown one hit more or fewer, ArrowRight/ArrowLeft rotate by a
 * step, Shift+ArrowUp/Shift+ArrowDown one step more or fewer (hits kept within the steps), Home: no rotation.
 * `null` for a key the ring does not use.
 */
export function euclidKeyValue(
  e: { key: string; shiftKey?: boolean },
  v: EuclidValue,
  limits: EuclidLimits = {},
): EuclidValue | null {
  const minSteps = limits.minSteps ?? 2;
  const maxSteps = limits.maxSteps ?? 16;
  const wrap = (r: number, n: number) => ((r % n) + n) % n;
  if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    const steps = Math.max(minSteps, Math.min(maxSteps, v.steps + (e.key === "ArrowUp" ? 1 : -1)));
    if (steps === v.steps) return null;
    return { steps, pulses: Math.min(v.pulses, steps), rotation: wrap(v.rotation, steps) };
  }
  switch (e.key) {
    case "ArrowUp":
      return v.pulses < v.steps ? { ...v, pulses: v.pulses + 1 } : null;
    case "ArrowDown":
      return v.pulses > 0 ? { ...v, pulses: v.pulses - 1 } : null;
    case "ArrowRight":
      return { ...v, rotation: wrap(v.rotation + 1, v.steps) };
    case "ArrowLeft":
      return { ...v, rotation: wrap(v.rotation - 1, v.steps) };
    case "Home":
      return v.rotation !== 0 ? { ...v, rotation: 0 } : null;
    default:
      return null;
  }
}

// --- two-lane tap pad ------------------------------------------------------------------------------

/** The keys of the two lanes (as the answers' tap pad: F the first, J the second). */
export const LANE_KEYS = ["f", "j"] as const;

/** Which lane a key taps, or `null`. */
export function laneOfKey(key: string): 0 | 1 | null {
  const k = key.toLowerCase();
  if (k === LANE_KEYS[0]) return 0;
  if (k === LANE_KEYS[1]) return 1;
  return null;
}

/** "6 taps", "1 tap", "No taps yet". */
export function tapCountText(n: number): string {
  return n === 0 ? "No taps yet" : `${n} ${n === 1 ? "tap" : "taps"}`;
}

// --- slider that plays -----------------------------------------------------------------------------

/** How long a slider that plays waits after the last change before it plays the new value (ms). */
export const PLAY_SETTLE_MS = 220;
