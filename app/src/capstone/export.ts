// Export (carry f2; docs/design/wave7.md §5.5): a released version rendered offline as a WAV. What `album.source`
// returns becomes the render request (its code, its Band as it played at release, its key, its mutes); a render
// that fails says why in plain words, and nothing is saved. The real-time take stays the release recording: an
// export is a download, never stored. Pure.
import type { AlbumSource } from "@oak/api";
import { OakApiError } from "@oak/api";
import type { BandDef, CapstoneDef, FlavourId, KeySpec } from "@oak/content-kit";
import { type EvalOptions, type EvalResult, normalize, sectionsFromAst } from "@oak/grader";
import type { BandSetup, MuteMap } from "@oak/strudel";
import { PieceRenderError, type RenderPieceRequest } from "@oak/strudel/offline";
import { bandCodeAt } from "../../../content/bands/index.ts";
import { type SketchBand, bandSetupFor as sketchBandSetup } from "../studio/model.ts";
import { bandKeyText, bandTracksFor } from "./content.ts";
import { MAX_CAPSTONE_BARS, pieceBars } from "./piece.ts";
import { trackBodies } from "./wave7.ts";

const BAND_ROLES = new Set(["drums", "bass", "chords"]);

/**
 * The release's mutes (`{ label: true }`) as the renderer's mute map. The server stores the Band's muted roles
 * ("drums"); the renderer names a Band part `band.drums` (as the Workbench does), so a role becomes that label.
 */
export function muteMapOf(mutes: Readonly<Record<string, boolean>>): MuteMap {
  return {
    muted: new Set(
      Object.entries(mutes).flatMap(([k, v]) => (v ? [BAND_ROLES.has(k) ? `band.${k}` : k] : [])),
    ),
    solo: null,
  };
}

/** Whether `album.source`'s Band is already one the renderer can play (`BandSetup`), else none. */
export function bandOf(band: unknown): BandSetup | null {
  if (!band || typeof band !== "object") return null;
  const b = band as Partial<BandSetup>;
  return typeof b.code === "string" && typeof b.band === "string" && Array.isArray(b.tracks)
    ? (b as BandSetup)
    : null;
}

/** The Band as a sketch or a capstone stores it (`{ bandId, flavour, mutes }`), the shape `album.source` returns. */
export interface StoredBand {
  bandId: string;
  flavour: FlavourId;
  mutes: ("drums" | "bass" | "chords")[];
}

function storedBandOf(band: unknown): StoredBand | null {
  if (!band || typeof band !== "object") return null;
  const b = band as Partial<StoredBand>;
  return typeof b.bandId === "string" && typeof b.flavour === "string"
    ? { bandId: b.bandId, flavour: b.flavour, mutes: Array.isArray(b.mutes) ? b.mutes : [] }
    : null;
}

/** What the export needs to play a version's Band as the Workbench played it at release. */
export interface ExportBandContext {
  bands: readonly BandDef[];
  /** The capstone the track was released from (`AlbumTrack.capstoneId`), or `null` for a promoted sketch. */
  capstone: CapstoneDef | null;
  /** Whether the course has reached a session (the Band's stages, contracts §5.10). */
  reached?: (from: string) => boolean;
}

/**
 * The Band a released version plays, as the renderer's `BandSetup`. `album.source` returns the stored Band state;
 * the Band's code is built here as the release played it: a capstone's Band plays only the roles its brief leaves
 * to the Band (`bandTracksFor`) in the capstone's key, a sketch's Band every role of the Band in the sketch's key.
 * `null`: the version played with no Band, or its Band is not one this build knows.
 */
export function exportBandOf(band: unknown, key: KeySpec | null, ctx: ExportBandContext): BandSetup | null {
  const ready = bandOf(band);
  if (ready) return ready;
  const stored = storedBandOf(band);
  if (!stored) return null;
  const reached = ctx.reached ?? (() => false);
  if (ctx.capstone) {
    // The capstone's Band plays the roles its brief leaves to it, in the capstone's key (Workspace's bandSetupFor).
    const def = ctx.capstone;
    const tracks = bandTracksFor(def);
    const band = ctx.bands.find((b) => b.id === stored.bandId);
    const code = band?.code[stored.flavour] ? bandCodeAt(band, stored.flavour, reached) : undefined;
    if (tracks.length === 0 || !band || !code) return null;
    return {
      band: band.id,
      flavour: stored.flavour,
      code: code.replaceAll("{{key}}", bandKeyText(def.key ?? key ?? DEFAULT_KEY)),
      followsLearnerKey: true,
      tracks,
    };
  }
  return sketchBandSetup(stored as SketchBand, ctx.bands, key, reached);
}

const DEFAULT_KEY: KeySpec = { tonic: "C", mode: "major" };

/**
 * The Band a released version plays live on its album page (and so in another take of it): `exportBandOf` with the
 * roles the release muted left out, as `muteMapOf` leaves them out of an export.
 */
export function versionBandOf(band: unknown, key: KeySpec | null, ctx: ExportBandContext): BandSetup | null {
  const setup = exportBandOf(band, key, ctx);
  const muted = new Set<string>(storedBandOf(band)?.mutes ?? []);
  if (!setup || muted.size === 0) return setup;
  const tracks = setup.tracks.filter((t) => !muted.has(t));
  return tracks.length > 0 ? { ...setup, tracks } : null;
}

/** The render request for a released version, exactly as `album.source` says it plays. */
export function renderRequestOf(
  source: Pick<AlbumSource, "code" | "band" | "key" | "mutes">,
  ctx: ExportBandContext = { bands: [], capstone: null },
): Pick<RenderPieceRequest, "code" | "band" | "key" | "mutes"> {
  return {
    code: source.code,
    band: exportBandOf(source.band, source.key, ctx),
    key: source.key,
    mutes: muteMapOf(source.mutes),
  };
}

/** "oak-side-b-02-blues-in-f-v1.wav": the download's name (the server's safe name, never the title raw). */
export function wavFileName(source: Pick<AlbumSource, "fileName">): string {
  const base = source.fileName.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "oak-track";
  return base.toLowerCase().endsWith(".wav") ? base : `${base}.wav`;
}

/** Why an export failed, in the learner's words; it always ends with what was kept (nothing). */
export function exportErrorText(e: unknown): string {
  if (e instanceof OakApiError)
    return e.code === "not_implemented"
      ? "Export is not available on this server yet: it cannot read what this version plays. Nothing was saved."
      : "This version's code could not be read from the album. Nothing was saved.";
  if (!(e instanceof PieceRenderError)) return "The export stopped unexpectedly. Nothing was saved.";
  switch (e.code) {
    case "aborted":
      return "The export was cancelled. Nothing was saved.";
    case "timeout":
      return "The export took longer than a minute and was stopped. Nothing was saved.";
    case "silent":
      return "The render came out silent: every part is muted or too quiet to hear. Nothing was saved.";
    case "missing-sound":
      return `A sound it uses could not be loaded${e.missingSounds.length > 0 ? ` (${e.missingSounds.join(", ")})` : ""}. Nothing was saved.`;
    case "evaluation":
      return "This version's code no longer runs, so it cannot be rendered. Nothing was saved.";
    case "length":
    case "too-long":
    case "tail-limit":
      return `This version cannot be rendered in one piece: ${plain(e.message)} Nothing was saved.`;
    default:
      return "The audio engine could not render this version. Nothing was saved.";
  }
}

/** A renderer message without package names or code paths, ending in a full stop. */
function plain(message: string): string {
  const m = message
    .replace(/@oak\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!m) return "it is longer than the export allows.";
  const lower = m.charAt(0).toLowerCase() + m.slice(1);
  return /[.!?]$/.test(lower) ? lower : `${lower}.`;
}

/** "Rendering 42%": the progress line of an export. */
export function exportProgressText(progress: number): string {
  return `Rendering ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
}

// --- a loop's length, for the renderer ------------------------------------------------------------------------

/** The bars an arrangement states (`arrange()` on every sectioned track), or `null` for a loop without one. */
export function statedBars(code: string): number | null {
  const form = sectionsFromAst(code);
  return form && "totalBars" in form && form.totalBars > 0 ? form.totalBars : null;
}

/**
 * The code the offline renderer takes for a piece (it renders only a piece whose arrangement says where it ends,
 * wave7.md §3.4): unchanged when it has one; a loop has each labelled track wrapped in `arrange([bars, …])` for
 * the piece's own length, the length its check read. Every note in those bars is the same (wave7.test.ts).
 */
export function renderableCode(code: string, bars: number): string {
  if (statedBars(code) !== null) return code;
  const n = Math.max(1, Math.min(MAX_CAPSTONE_BARS, Math.round(bars)));
  const bodies = trackBodies(code);
  if (bodies.length === 0) return code;
  const lines = code.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const m = /^([A-Za-z_$][\w$]*)\s*:\s?(.*)$/.exec(line);
    if (!m || line.startsWith("const ")) {
      out.push(line);
      continue;
    }
    // The track's body: this line and the indented lines under it.
    const body = [m[2] as string];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1] as string)) body.push(lines[++i] as string);
    out.push(`${m[1]}: arrange([${n}, ${body.join("\n")}])`);
  }
  return out.join("\n");
}

/** The piece's length in bars as the capstone check reads it (its arrangement, else one period of its loop). */
export async function pieceLength(
  code: string,
  analyze: (code: string, opts: EvalOptions) => Promise<EvalResult>,
): Promise<number> {
  const stated = statedBars(code);
  if (stated !== null) return stated;
  const ev = await analyze(code, { mode: "capstone", bars: MAX_CAPSTONE_BARS, lint: null, meter: "4/4" });
  if (!ev.ok) return 1;
  return pieceBars(code, normalize(ev, { meter: "4/4" }).all);
}
