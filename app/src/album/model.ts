// The album as a record (ux §5.3): side A holds the core capstones in course order, side B the advanced ones,
// then the B-sides. Released tracks fill their slots; empty slots say what opens them. Pure.
import type {
  AlbumTake,
  AlbumTrack,
  AlbumTrackDetail,
  AlbumTrackVersion,
  CapstoneMeta,
  CapstoneStatus,
} from "@oak/api";

export type Side = AlbumTrack["side"];

/** Advanced-track capstones (JC*, RC*, AC*) go on side B; every other capstone is core, side A. */
export function sideOfCapstone(id: string): Exclude<Side, "Bside"> {
  return /^(JC|RC|AC)\d/.test(id) ? "B" : "A";
}

/**
 * Side A's running order (content/specs/END.md "The record"): the core capstones in course order with the single
 * last, so the record closes on the learner's own song; the standard, released earlier, sits before it.
 */
export const SIDE_A_ORDER = [
  "C0",
  "C1",
  "C2",
  "X1",
  "C3",
  "C4",
  "C5",
  "X2",
  "C6",
  "C7",
  "CF-T",
  "CF-A",
] as const;

/** A side's capstones in running order: the course's order, the album single (CF-A) moved to the end. */
export function runningOrder<T extends { id: string }>(capstones: readonly T[]): T[] {
  return [...capstones.filter((c) => c.id !== "CF-A"), ...capstones.filter((c) => c.id === "CF-A")];
}

/** Side B's eight capstones (wave7.md §5.5, `ALBUM_SIDES`): jazz, rhythm, sound, as the course lists them. */
export const SIDE_B_CAPSTONES = ["JC1", "JC2", "JC3", "JC4", "RC1", "RC2", "AC1", "AC2"] as const;

/** The track family a Side B capstone belongs to (its cover sits with the others of its track). */
export function trackFamilyOf(capstoneId: string): "jazz" | "rhythm" | "sound" | null {
  if (capstoneId.startsWith("JC")) return "jazz";
  if (capstoneId.startsWith("RC")) return "rhythm";
  if (capstoneId.startsWith("AC")) return "sound";
  return null;
}

export const TRACK_FAMILY_LABEL = { jazz: "Jazz", rhythm: "Rhythm", sound: "Sound" } as const;

/**
 * Side B's running order (wave7.md §5.5: numbered in release order): the released tracks in the order they were
 * released, then the capstones still to come in the course's order.
 */
export function sideBOrder<T extends { id: string }>(
  capstones: readonly T[],
  tracks: readonly Pick<AlbumTrack, "capstoneId" | "createdAt" | "trackNo">[],
): T[] {
  const released = (id: string) => tracks.find((t) => t.capstoneId === id) ?? null;
  const done = capstones
    .filter((c) => released(c.id))
    .sort((a, b) => {
      const x = released(a.id) as Pick<AlbumTrack, "createdAt" | "trackNo">;
      const y = released(b.id) as Pick<AlbumTrack, "createdAt" | "trackNo">;
      return x.createdAt.localeCompare(y.createdAt) || x.trackNo - y.trackNo;
    });
  return [...done, ...capstones.filter((c) => !released(c.id))];
}

/** A side's capstones in its running order. */
export function sideOrder<T extends { id: string }>(
  side: "A" | "B",
  capstones: readonly T[],
  tracks: readonly Pick<AlbumTrack, "capstoneId" | "createdAt" | "trackNo">[],
): T[] {
  const mine = capstones.filter((c) => sideOfCapstone(c.id) === side);
  return side === "A" ? runningOrder(mine) : sideBOrder(mine, tracks);
}

export type Slot =
  | { kind: "track"; no: number; track: AlbumTrack }
  | {
      kind: "empty";
      no: number;
      capstone: Pick<CapstoneMeta, "id" | "title" | "objective">;
      status: CapstoneStatus["status"] | "unknown";
      lockedReason: string | null;
      sessionsDone: number;
      sessionsTotal: number;
    };

export interface SideView {
  side: Side;
  title: string;
  sub: string;
  slots: Slot[];
}

/**
 * The sides of the record. Side A lists every core capstone (released or not); side B lists the advanced
 * capstones only once one of them is released or open; the B-sides only once there is one. `songTracks` are the
 * album rows that are unit-song releases (`songTracksOf`): the Songs shelf is their one home, so they are not listed
 * again as B-sides (their rows carry no unit; the songs list is what says they are songs).
 */
export function albumSides(
  tracks: readonly AlbumTrack[],
  capstones: readonly Pick<CapstoneMeta, "id" | "title" | "objective" | "sessions">[],
  statuses: readonly CapstoneStatus[],
  songTracks: ReadonlySet<string> = new Set(),
): SideView[] {
  const byCapstone = new Map(
    tracks.filter((t) => t.capstoneId).map((t) => [t.capstoneId as string, t] as const),
  );
  const statusOf = new Map(statuses.map((s) => [s.capstoneId as string, s] as const));
  const sideSlots = (side: "A" | "B"): Slot[] => {
    const slots: Slot[] = [];
    const listed = sideOrder(side, capstones, tracks);
    listed.forEach((c, i) => {
      const t = byCapstone.get(c.id);
      if (t) slots.push({ kind: "track", no: i + 1, track: t });
      else {
        const st = statusOf.get(c.id);
        slots.push({
          kind: "empty",
          no: i + 1,
          capstone: c,
          status: st?.status ?? "unknown",
          lockedReason: tidyReason(st?.lockedReason ?? null),
          sessionsDone: st?.sessionsDone ?? 0,
          sessionsTotal: st?.sessionsTotal ?? c.sessions,
        });
      }
    });
    // Tracks on this side whose capstone is no longer in the course still belong on the record.
    for (const t of tracks)
      if (t.side === side && t.capstoneId && !listed.some((c) => c.id === t.capstoneId))
        slots.push({ kind: "track", no: slots.length + 1, track: t });
    return slots;
  };
  const out: SideView[] = [{ side: "A", title: "Side A", sub: "Core", slots: sideSlots("A") }];
  const b = sideSlots("B");
  if (b.some((s) => s.kind === "track" || s.status === "open" || s.status === "in_progress"))
    out.push({ side: "B", title: "Side B", sub: "Jazz, rhythm and sound", slots: b });
  const bsides = tracks
    .filter((t) => t.side === "Bside" && !songTracks.has(t.id))
    .sort((x, y) => x.trackNo - y.trackNo || x.createdAt.localeCompare(y.createdAt))
    .map((t, i): Slot => ({ kind: "track", no: i + 1, track: t }));
  if (bsides.length)
    out.push({ side: "Bside", title: "B-sides", sub: "Sketches you promoted", slots: bsides });
  return out;
}

/** Server copy says "the Melody checkpoint checkpoint" when a checkpoint's title already ends in the word. */
export function tidyReason(text: string | null): string | null {
  return text === null ? null : text.replace(/\bcheckpoint checkpoint\b/g, "checkpoint");
}

/** "12:34" for a total in seconds; "—" when nothing is known. */
export function runtime(totalSec: number | null): string {
  if (totalSec === null || !Number.isFinite(totalSec)) return "—";
  const s = Math.round(totalSec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What changed between two versions of a track's code, in a line ("4 lines changed, 2 added"). */
export function changeSummary(before: string | null, after: string): string {
  if (before === null) return "First release";
  const a = before.split("\n");
  const b = after.split("\n");
  if (before === after) return "Same code, new recording";
  const setA = new Set(a);
  const setB = new Set(b);
  const added = b.filter((l) => l.trim() && !setA.has(l)).length;
  const removed = a.filter((l) => l.trim() && !setB.has(l)).length;
  const changed = Math.min(added, removed);
  const parts: string[] = [];
  if (changed) parts.push(`${changed} ${changed === 1 ? "line" : "lines"} changed`);
  if (added - changed) parts.push(`${added - changed} added`);
  if (removed - changed) parts.push(`${removed - changed} removed`);
  return parts.length ? parts.join(", ") : "Whitespace only";
}

/** "four-chord-song-v2.webm": the recording's file name for a download. */
export function audioFileName(title: string, version: number, mime: string | null): string {
  const slug =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "track";
  const ext = mime?.includes("ogg")
    ? "ogg"
    : mime?.includes("wav")
      ? "wav"
      : mime?.includes("mp4")
        ? "m4a"
        : "webm";
  return `${slug}-v${version}.${ext}`;
}

// --- takes (d20) ------------------------------------------------------------------------------------

/**
 * Every recording of a version, oldest first. A server that lists no takes has at most one recording: it is
 * take 1.
 */
export function takesOf(
  v: Pick<AlbumTrackVersion, "takes" | "hasAudio" | "audioMime" | "durationS" | "createdAt">,
): AlbumTake[] {
  if (v.takes && v.takes.length > 0) return [...v.takes].sort((a, b) => a.take - b.take);
  if (!v.hasAudio) return [];
  return [
    {
      take: 1,
      audioMime: v.audioMime ?? "audio/webm",
      durationS: v.durationS,
      bytes: 0,
      recordedAt: v.createdAt,
    },
  ];
}

/** The take that plays by default and is exported: the chosen one, else the newest. */
export function currentTakeOf(
  v: Pick<AlbumTrackVersion, "takes" | "currentTake" | "hasAudio">,
): number | null {
  if (v.currentTake) return v.currentTake;
  const last = v.takes?.at(-1)?.take;
  return last ?? (v.hasAudio ? 1 : null);
}

/** "four-chord-song-v2-take3.webm"; a version with one take keeps the plain name. */
export function takeFileName(
  title: string,
  version: number,
  take: number,
  mime: string | null,
  takes: number,
): string {
  const plain = audioFileName(title, version, mime);
  return takes <= 1 ? plain : plain.replace(/(\.[a-z0-9]+)$/, `-take${take}$1`);
}

// --- the finished record (content/specs/END.md "The record: Side A, finished") --------------------------

/** The breath between two tracks when Side A plays through, ms. */
export const TRACK_GAP_MS = 1500;

export interface RecordTrack {
  /** 1-based place in the running order. */
  no: number;
  capstoneId: string;
  /** `null`: not released yet. */
  trackId: string | null;
  title: string;
  version: number | null;
  /** The chosen take's length; `null` without a recording. */
  durationS: number | null;
  hasAudio: boolean;
  coverSeed: string | null;
  flavour: AlbumTrack["flavour"];
  sketch: { sketchId: string; sketchVersion: number } | null;
  audioMime: string | null;
}

export interface SideARecordView {
  tracks: RecordTrack[];
  released: number;
  total: number;
  /** Every track of Side A is released. */
  complete: boolean;
  /** Tracks with a recording, in running order: what "Play Side A" plays. */
  playable: RecordTrack[];
  /** The running time: the recordings' lengths (tracks without one are not counted). */
  seconds: number;
  /** Some track's detail has not arrived yet: lengths may still change. */
  loading: boolean;
}

const plainTitle = (c: { id: string; title: string }): string =>
  (c.title.startsWith(`${c.id} `) ? c.title.slice(c.id.length + 1) : c.title).replace(/^Core Finale: /, "");

/** Side A as a record: every core capstone in running order with its released track, its length and its take. */
export function sideARecord(
  tracks: readonly AlbumTrack[],
  details: ReadonlyMap<string, AlbumTrackDetail>,
  capstones: readonly { id: string; title: string }[],
): SideARecordView {
  return sideRecord("A", tracks, details, capstones);
}

/** One side as a record (Side A: the core in running order; Side B: the eight track capstones in release order). */
export function sideRecord(
  side: "A" | "B",
  tracks: readonly AlbumTrack[],
  details: ReadonlyMap<string, AlbumTrackDetail>,
  capstones: readonly { id: string; title: string }[],
): SideARecordView {
  const core = sideOrder(side, capstones, tracks);
  let loading = false;
  const out = core.map((c, i): RecordTrack => {
    const t = tracks.find((x) => x.capstoneId === c.id) ?? null;
    if (!t)
      return {
        no: i + 1,
        capstoneId: c.id,
        trackId: null,
        title: plainTitle(c),
        version: null,
        durationS: null,
        hasAudio: false,
        coverSeed: null,
        flavour: null,
        sketch: null,
        audioMime: null,
      };
    const d = details.get(t.id);
    if (!d) loading = true;
    const v = d?.versions.find((x) => x.version === t.currentVersion) ?? null;
    return {
      no: i + 1,
      capstoneId: c.id,
      trackId: t.id,
      title: t.title,
      version: t.currentVersion,
      durationS: v?.hasAudio ? (v.durationS ?? null) : null,
      hasAudio: v?.hasAudio === true,
      coverSeed: t.coverSeed,
      flavour: t.flavour,
      sketch: v ? { sketchId: v.sketchId, sketchVersion: v.sketchVersion } : null,
      audioMime: v?.audioMime ?? null,
    };
  });
  const playable = out.filter((t) => t.hasAudio);
  const released = out.filter((t) => t.trackId !== null).length;
  return {
    tracks: out,
    released,
    total: out.length,
    complete: out.length > 0 && released === out.length,
    playable,
    seconds: playable.reduce((sum, t) => sum + (t.durationS ?? 0), 0),
    loading,
  };
}

/** "{album title} · Side A · 12 tracks · 10:42" (no time while nothing is recorded). */
export function recordTitleLine(
  albumTitle: string,
  r: Pick<SideARecordView, "released" | "seconds" | "playable">,
  side: "A" | "B" = "A",
): string {
  const tracks = `${r.released} ${r.released === 1 ? "track" : "tracks"}`;
  const time = r.playable.length > 0 ? ` · ${runtime(r.seconds)}` : "";
  return `${albumTitle} · Side ${side} · ${tracks}${time}`;
}

/** The whole record played through: Side A's recordings, then Side B's, each side in its running order. */
export interface WholeRecord {
  queue: (RecordTrack & { side: "A" | "B" })[];
  seconds: number;
  /** Released tracks over both sides, and how many the course has (12 + 8). */
  released: number;
  total: number;
  /** Every track of both sides is released. */
  complete: boolean;
}

export function wholeRecord(a: SideARecordView, b: SideARecordView): WholeRecord {
  const queue = [
    ...a.playable.map((t) => ({ ...t, side: "A" as const })),
    ...b.playable.map((t) => ({ ...t, side: "B" as const })),
  ];
  return {
    queue,
    seconds: queue.reduce((sum, t) => sum + (t.durationS ?? 0), 0),
    released: a.released + b.released,
    total: a.total + b.total,
    complete: a.complete && b.complete,
  };
}

/** "Side B · 3 of 8 · Blues in F · 0:14 / 2:01" while the whole record plays. */
export function wholeNowPlaying(
  t: Pick<RecordTrack, "no" | "title" | "durationS"> & { side: "A" | "B" },
  sideTotal: number,
  elapsedS: number,
): string {
  return `Side ${t.side} · ${nowPlayingLine(t, sideTotal, elapsedS)}`;
}

/** "3 of 12 · Four-Chord Song · 0:14 / 0:20". */
export function nowPlayingLine(
  t: Pick<RecordTrack, "no" | "title" | "durationS">,
  total: number,
  elapsedS: number,
): string {
  const length = t.durationS ? ` / ${runtime(t.durationS)}` : "";
  return `${t.no} of ${total} · ${t.title} · ${runtime(Math.max(0, elapsedS))}${length}`;
}

/**
 * Whether a paused player stands at the end of its track (within 50 ms): Chromium can stop a WAV on its last frame
 * without "ended", and the record must read that as the end of the track, not as a stop.
 */
export function atTrackEnd(p: { currentTime: number; duration: number }, epsilonS = 0.05): boolean {
  return Number.isFinite(p.duration) && p.duration > 0 && p.currentTime >= p.duration - epsilonS;
}

/** The playable track that follows `no` in running order, or `null` at the end of the side. */
export function nextPlayable(r: Pick<SideARecordView, "playable">, no: number): RecordTrack | null {
  return r.playable.find((t) => t.no > no) ?? null;
}

/** The cover to move to with Left / Right (released tracks only; it stops at the ends). */
export function neighbourCover(
  r: Pick<SideARecordView, "tracks">,
  no: number,
  dir: 1 | -1,
): RecordTrack | null {
  const released = r.tracks.filter((t) => t.trackId !== null);
  const at = released.findIndex((t) => t.no === no);
  return released[at + dir] ?? null;
}

/** "01-intro.webm": a recording's name inside the download of the whole side. */
export function recordFileName(t: Pick<RecordTrack, "no" | "title" | "version" | "audioMime">): string {
  const base = audioFileName(t.title, t.version ?? 1, t.audioMime).replace(/-v\d+(\.[a-z0-9]+)$/, "$1");
  return `${String(t.no).padStart(2, "0")}-${base}`;
}
