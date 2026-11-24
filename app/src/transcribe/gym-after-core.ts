// The Transcription Gym after the core (Wave 7; contracts §2.5 "In the advanced tracks the slot rule does not run;
// Today offers the gym once a week", §2.9; content/specs/END.md "Transcription Gym"): the gym goes on, drawing from
// every stage the learner has opened — their own audio (L7), the ladder's generated levels and songs, the
// standards (L8) and their analysis once CF-T is released, and, from the advanced tracks, jazz charts and rhythm
// items — and never serves the same source twice inside two weeks. Pure: the page passes what it knows; the log of
// what was served is kept by the caller (`gym-log.ts`).
import { FOURTHS_MAJOR, FOURTHS_MINOR } from "@oak/theory";

export type GymSourceKind = "own-audio" | "ladder" | "song" | "standard" | "analysis" | "jazz" | "rhythm";

/** One thing the gym can serve. `id` is what "the same source" means for the two-week rule. */
export interface GymSource {
  id: string;
  kind: GymSourceKind;
  /** The ladder level or ear stage it belongs to: "L7", "L3", "G" (jazz), "H" (rhythm). */
  stage: string;
  title: string;
  /** One line: what the learner takes down. */
  detail: string;
  /** Ladder levels and songs open through `ladder.next`; own audio by its project; the rest on the gym page. */
  open:
    | { via: "project"; projectId: string }
    | { via: "ladder"; level: number; songId?: string }
    | { via: "item"; itemId: string }
    | { via: "analysis"; songId: string };
}

/** Days inside which a source is not served again. */
export const NO_REPEAT_DAYS = 14;

/** What the learner has done that opens a gym item (a track lesson completed). */
export interface GymGate {
  lesson: string;
}

/** The generated jazz charts (stage G): a form in a key; each opens with the lesson that teaches the form. */
export const JAZZ_FORMS = {
  "ii-V-I": { title: "ii–V–I", gate: "J1.L03", bars: 4 },
  "minor-ii-V-i": { title: "Minor ii–V–i", gate: "J2.L02", bars: 4 },
  turnaround: { title: "I–vi–ii–V turnaround", gate: "J4.L01", bars: 4 },
  blues: { title: "Jazz blues", gate: "J4.L02", bars: 12 },
  "rhythm-A": { title: "Rhythm changes, the A section", gate: "J4.L03", bars: 8 },
} as const;
export type JazzForm = keyof typeof JAZZ_FORMS;

/** The tonics a jazz form is served in: the cycle of fourths (minor keys spelled as minor keys). */
export const jazzTonics = (form: JazzForm): readonly string[] =>
  form === "minor-ii-V-i" ? FOURTHS_MINOR : FOURTHS_MAJOR;

/** The generated rhythm items (stage H, R1–R3): each opens with the lesson that teaches it. */
export const RHYTHM_ITEMS = {
  "swing-16": { title: "Swung 16ths", gate: "R1.L02" },
  "odd-7": { title: "A groove in 7/8", gate: "R2.L02" },
  "poly-3-2": { title: "Three against two", gate: "R2.L04" },
  tresillo: { title: "Tresillo in the bass", gate: "R3.L01" },
  "clave-son": { title: "Son clave", gate: "R3.L02" },
  "clave-rumba": { title: "Rumba clave", gate: "R3.L02" },
  "bell-5-8": { title: "A rotated bell, (5,8)", gate: "R3.L03" },
} as const;
export type RhythmItem = keyof typeof RHYTHM_ITEMS;

export interface GymContext {
  /** The core is complete (the gym is then offered once a week and on review days). */
  coreComplete: boolean;
  /** Lessons the learner has completed (track lessons open the jazz and rhythm items). */
  completed: ReadonlySet<string>;
  /** The ladder level (1–8). */
  ladderLevel: number;
  /** The learner's own recordings (L7). */
  ownAudio: readonly { id: string; title: string }[];
  /** Ladder songs (`ladder.songs`): L5 and L6 songs open, L8 standards open. */
  songs: readonly { songId: string; title: string; level: 5 | 6 | 8; status: "locked" | "open" | "done" }[];
  /** CF-T released: the standards may be analysed (their changes are no longer a transcription task). */
  cfTReleased: boolean;
  /** Songs with a chart and a form the analysis stage can read (`analysable`). */
  analysable: ReadonlySet<string>;
}

/** Every source the gym can serve now, in stage order. */
/**
 * The chip over a gym choice, in words: "Level 3" for a ladder level, "Jazz" and "Rhythm" for the track stages.
 * The stage code ("L3", "G", "H") stays internal.
 */
export function gymStageLabel(stage: string): string {
  const level = /^L(\d+)$/.exec(stage);
  if (level) return `Level ${level[1]}`;
  if (stage === "G") return "Jazz";
  if (stage === "H") return "Rhythm";
  return stage;
}

export function gymSources(ctx: GymContext): GymSource[] {
  const out: GymSource[] = [];
  for (const a of ctx.ownAudio)
    out.push({
      id: `own:${a.id}`,
      kind: "own-audio",
      stage: "L7",
      title: a.title,
      detail: "Your own recording: a section or a part, checked by you.",
      open: { via: "project", projectId: a.id },
    });
  for (let level = 1; level <= Math.min(4, ctx.ladderLevel); level++)
    out.push({
      id: `ladder:L${level}`,
      kind: "ladder",
      stage: `L${level}`,
      title: LADDER_TITLES[level] ?? `Level ${level}`,
      detail: "A new generated piece, checked by Oak.",
      open: { via: "ladder", level },
    });
  for (const s of ctx.songs) {
    if (s.status === "locked") continue;
    if (s.level === 8) {
      if (ctx.ladderLevel < 8) continue;
      out.push({
        id: `song:${s.songId}`,
        kind: "standard",
        stage: "L8",
        title: s.title,
        detail: "A standard by ear: form, bass, changes, melody.",
        open: { via: "ladder", level: 8, songId: s.songId },
      });
    } else if (s.level <= ctx.ladderLevel)
      out.push({
        id: `song:${s.songId}`,
        kind: "song",
        stage: `L${s.level}`,
        title: s.title,
        detail:
          s.level === 5 ? "A folk tune, phrase by phrase." : "A blues or an early standard, bass to melody.",
        open: { via: "ladder", level: s.level, songId: s.songId },
      });
  }
  if (ctx.cfTReleased)
    for (const s of ctx.songs)
      if (s.level === 8 && s.status !== "locked" && ctx.analysable.has(s.songId))
        out.push({
          id: `analysis:${s.songId}`,
          kind: "analysis",
          stage: "G",
          title: `${s.title}: the analysis`,
          detail: "Numerals under the chart, brackets over the ii–Vs, the form.",
          open: { via: "analysis", songId: s.songId },
        });
  // Jazz charts: the forms opened so far take turns key by key round the cycle of fourths (a ii–V–I in C, the
  // blues in C, then F …), so the next fresh one is a new form or a new key, never twelve keys of one form first.
  const forms = (Object.keys(JAZZ_FORMS) as JazzForm[]).filter((f) => ctx.completed.has(JAZZ_FORMS[f].gate));
  for (let k = 0; k < 12; k++)
    for (const form of forms) {
      const tonic = jazzTonics(form)[k] as string;
      const itemId = `jazz:${form}:${tonic}`;
      const f = JAZZ_FORMS[form];
      out.push({
        id: itemId,
        kind: "jazz",
        stage: "G",
        title: `${f.title} in ${tonicText(tonic)}${form === "minor-ii-V-i" ? " minor" : ""}`,
        detail: `${f.bars} bars of changes by ear, extensions and all.`,
        open: { via: "item", itemId },
      });
    }
  for (const item of Object.keys(RHYTHM_ITEMS) as RhythmItem[]) {
    const r = RHYTHM_ITEMS[item];
    if (!ctx.completed.has(r.gate)) continue;
    const itemId = `rhythm:${item}`;
    out.push({
      id: itemId,
      kind: "rhythm",
      stage: "H",
      title: r.title,
      detail: "Name what you hear, then write the rhythm on the grid.",
      open: { via: "item", itemId },
    });
  }
  return out;
}

const LADDER_TITLES: Record<number, string> = {
  1: "Drum loops",
  2: "Bass lines",
  3: "Four-chord loops",
  4: "Short melodies",
};

/** `Bb` → `B♭`. */
export const tonicText = (t: string): string => t.replace(/b$/, "♭").replace(/#$/, "♯");

export interface GymLogEntry {
  sourceId: string;
  /** Local day, `YYYY-MM-DD`. */
  day: string;
}

const dayNumber = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

/** Whether a source was served inside the last `NO_REPEAT_DAYS` days (today included). */
export function servedRecently(log: readonly GymLogEntry[], sourceId: string, today: string): boolean {
  const t = dayNumber(today);
  return log.some((e) => e.sourceId === sourceId && t - dayNumber(e.day) < NO_REPEAT_DAYS);
}

/**
 * What the gym serves next: a source not served in two weeks, from the kind of stage served longest ago (so own
 * audio, the ladder, jazz and rhythm take turns), and inside a kind the one served longest ago (never served
 * first, in stage order; jazz keys move round the cycle of fourths). `null` when everything was served recently.
 */
export function nextGymSource(
  sources: readonly GymSource[],
  log: readonly GymLogEntry[],
  today: string,
): GymSource | null {
  const fresh = sources.filter((s) => !servedRecently(log, s.id, today));
  if (fresh.length === 0) return null;
  const lastOfKind = (k: GymSourceKind): number => {
    let at = -1;
    log.forEach((e, i) => {
      if (sources.find((s) => s.id === e.sourceId)?.kind === k || e.sourceId.startsWith(`${KIND_PREFIX[k]}:`))
        at = i;
    });
    return at;
  };
  const kinds = [...new Set(fresh.map((s) => s.kind))].sort((a, b) => lastOfKind(a) - lastOfKind(b));
  const kind = kinds[0] as GymSourceKind;
  const lastServed = (id: string): number => {
    let at = -1;
    log.forEach((e, i) => {
      if (e.sourceId === id) at = i;
    });
    return at;
  };
  const inKind = fresh.filter((s) => s.kind === kind);
  // Stable: never served first (in stage order), then the one served longest ago.
  return [...inKind].sort((a, b) => lastServed(a.id) - lastServed(b.id))[0] ?? null;
}

const KIND_PREFIX: Record<GymSourceKind, string> = {
  "own-audio": "own",
  ladder: "ladder",
  song: "song",
  standard: "song",
  analysis: "analysis",
  jazz: "jazz",
  rhythm: "rhythm",
};

/** Up to `n` choices for the gym card: the next one first, then one of each other kind, all fresh. */
export function gymChoices(
  sources: readonly GymSource[],
  log: readonly GymLogEntry[],
  today: string,
  n = 4,
): GymSource[] {
  const first = nextGymSource(sources, log, today);
  if (!first) return [];
  const out = [first];
  const seenKinds = new Set([first.kind]);
  let rest = sources.filter((s) => s.id !== first.id && !servedRecently(log, s.id, today));
  while (out.length < n && rest.length > 0) {
    const next = nextGymSource(
      rest.filter((s) => !seenKinds.has(s.kind)),
      log,
      today,
    );
    if (!next) break;
    out.push(next);
    seenKinds.add(next.kind);
    rest = rest.filter((s) => s.id !== next.id);
  }
  return out;
}

/** Today as the log writes it (local calendar day). */
export function localDay(d: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The Standard Transcription's next session in words for the gym's CF-T line ("CF-T.S2" -> " (next: session 2)"),
 * never its ID; nothing when it is not known.
 */
export function cftNext(id: string | null | undefined): string {
  const n = id ? /\.S(\d+)$/.exec(id)?.[1] : undefined;
  return n ? ` (next: session ${Number(n)})` : "";
}
