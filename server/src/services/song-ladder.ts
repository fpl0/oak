// The song levels of the transcription ladder (contracts §2.8–§2.9, §6.6 X2, §6.12; docs/design/wave5.md §5.3):
// L5 public-domain folk, graded one phrase at a time (melody, key-relative, ≥ 0.85, lesson mode), and L6 blues and
// standards ≤ 1930, one strain in three stages that open in order (bass ≥ 0.90, changes ≥ 0.85, then the melody one
// 4-bar line at a time ≥ 0.85; capstone mode). Nobody authors an item: it is cut from a repertoire song's answer key
// (`SongDef`), the same rules as content/gym/songs.ts. A song is offered only when its answer key is complete for the
// level; it is locked before its `availableFrom` lesson and while no human has verified the key ("Being checked").
import type { SongDef } from "@oak/content-kit";
import type { RepertoireMeta } from "../content/types.ts";

export type SongLevel = 5 | 6;
export type SongStage = "bass" | "changes" | "melody";
/** L6 stages in the order they open (contracts §6.6 X2). */
export const SONG_STAGES: readonly SongStage[] = ["bass", "changes", "melody"];
/** The verifier marker of a key no human has checked yet (content/repertoire/fragment.ts). */
const PENDING = /^pending\b/i;

/** A song key is verified once `verifiedBy` names a human, not the pending marker. */
export function songVerified(song: SongDef): boolean {
  return song.verifiedBy.trim().length > 0 && !PENDING.test(song.verifiedBy.trim());
}

/** Bars of an L6 strain: a 12-bar blues chorus, else the first 16 bars (a 16-bar verse). */
export function strainBars(song: SongDef): number {
  return /12-bar/i.test(song.form) ? 12 : Math.min(16, song.answerKey.bars);
}

/** The phrases of the strain, from bar 1, while they stay inside it. */
export function strainLines(song: SongDef): [number, number][] {
  const end = strainBars(song);
  const out: [number, number][] = [];
  let next = 1;
  for (const p of song.answerKey.phrases ?? []) {
    if (p[0] !== next || p[1] > end) break;
    out.push([p[0], p[1]]);
    next = p[1] + 1;
  }
  return out;
}

/** The phrases an item of the level works: L5 every phrase of the key, L6 the strain's 4-bar lines. */
export function songPhrases(song: SongDef, level: SongLevel): [number, number][] {
  return level === 6 ? strainLines(song) : (song.answerKey.phrases ?? []).map(([a, b]) => [a, b]);
}

/** Why a song cannot be cut into items of a level (empty when it can). */
export function songGaps(song: SongDef, meta: RepertoireMeta | undefined, level: SongLevel): string[] {
  const gaps: string[] = [];
  if (meta === undefined) gaps.push("no repertoire entry");
  else if (meta.ladder !== level)
    gaps.push(`the repertoire lists it for ${meta.ladder ? `L${meta.ladder}` : "no level"}`);
  const layers = song.answerKey.layers;
  const need = level === 5 ? (["melody"] as const) : (["bass", "chords", "melody"] as const);
  for (const l of need) if (!layers[l]) gaps.push(`no ${l} layer`);
  const phrases = song.answerKey.phrases ?? [];
  if (phrases.length === 0) gaps.push("no phrases");
  if (level === 6 && phrases.length > 0) {
    const lines = strainLines(song);
    const end = strainBars(song);
    if (lines.length === 0 || (lines.at(-1) as [number, number])[1] !== end)
      gaps.push(`the phrases do not cut bars 1–${end} into lines`);
    if (lines.some(([a, b]) => b - a + 1 !== 4)) gaps.push("a line of the strain is not 4 bars");
  }
  return gaps;
}

/** One gradable check of a song item: L5 a phrase; L6 the bass, the changes, or one line of the melody. */
export interface SongCheck {
  /** `lad.5.<slug>.<phrase>`, `lad.6.<slug>` (bass, changes) or `lad.6.<slug>.<line>` (melody): the exercise ID. */
  itemId: string;
  level: SongLevel;
  phrase: number | [number, number];
  stage?: SongStage;
}
const slugOf = (id: string) => id.replace(/^song\./, "");

/** Every check of an item, in the order they open. */
export function songChecks(song: SongDef, level: SongLevel): SongCheck[] {
  const slug = slugOf(song.id);
  const lines = songPhrases(song, level);
  if (level === 5)
    return lines.map((_, i) => ({ itemId: `lad.5.${slug}.${i + 1}`, level: 5, phrase: i + 1 }));
  return [
    { itemId: `lad.6.${slug}`, level: 6, phrase: [1, lines.length], stage: "bass" },
    { itemId: `lad.6.${slug}`, level: 6, phrase: [1, lines.length], stage: "changes" },
    ...lines.map(
      (_, i): SongCheck => ({ itemId: `lad.6.${slug}.${i + 1}`, level: 6, phrase: i + 1, stage: "melody" }),
    ),
  ];
}

/** A check's key: L5 `p<n>`, L6 `bass`, `changes`, `melody.<n>`. */
export function checkKeyOf(c: Pick<SongCheck, "level" | "phrase" | "stage">): string {
  if (c.level === 5) return `p${c.phrase as number}`;
  return c.stage === "melody" ? `melody.${c.phrase as number}` : (c.stage ?? "bass");
}

/** The check a submission names: L5 by phrase; L6 by stage (and the line, for the melody). `null`: no such check. */
export function checkOf(
  song: SongDef,
  level: SongLevel,
  sub: { stage?: string | undefined; phrase?: number | undefined },
): SongCheck | null {
  const checks = songChecks(song, level);
  if (level === 5)
    return sub.stage !== undefined ? null : (checks.find((c) => c.phrase === sub.phrase) ?? null);
  if (sub.stage === "melody")
    return checks.find((c) => c.stage === "melody" && c.phrase === sub.phrase) ?? null;
  if (sub.stage === "bass" || sub.stage === "changes")
    return sub.phrase !== undefined ? null : (checks.find((c) => c.stage === sub.stage) ?? null);
  return null;
}

/** Whether the learner may pick the song now (`ladder.songs` `status` and `lockedReason`). */
export function songLock(
  song: SongDef,
  meta: RepertoireMeta | undefined,
  opts: {
    completed: ReadonlySet<string>;
    allowUnverified: boolean;
    /** The lesson's title, so the note names it in words ("Opens with the lesson “Blues Changes”"), never by ID. */
    lessonTitle?: (id: string) => string;
  },
): string | null {
  const from = song.availableFrom ?? meta?.availableFrom;
  if (from !== undefined && !opts.completed.has(from)) {
    const title = opts.lessonTitle?.(from);
    return title !== undefined && title !== from
      ? `Opens with the lesson “${title}”`
      : "Opens with a later lesson";
  }
  if (!opts.allowUnverified && !songVerified(song)) return "Being checked";
  return null;
}
