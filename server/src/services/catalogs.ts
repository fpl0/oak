// Oak 2.0 W3 (PLAN §4 S6): the catalog of attributes. The learner listens to a reference (a unit song, one of their
// transcription projects, one of their audio files, or a track they name for "Outside your lane") and writes six plain
// lines about it (tempo, sound, harmony, melody, rhythm, form); a sketch written from those lines may be named with
// it. Plain words only: nothing here is code or a score. The SQL is private to this file (a `CatalogsRepo` over
// `ctx.repos.db`, table `catalogs`, migration 0012), so the service is mounted without touching `Repos`.
import { CATALOG_LINES, CATALOG_REF_KINDS, type Catalog } from "@oak/api";
import { all, type Db, run } from "../db/index.ts";
import { badRequest } from "../errors.ts";
import { newId, type ServiceContext } from "./context.ts";

export type CatalogRefKind = (typeof CATALOG_REF_KINDS)[number];
export type CatalogLines = Catalog["lines"];
export interface CatalogCreate {
  refKind: CatalogRefKind;
  refId: string;
  lines: CatalogLines;
  sketchId: string | null;
}

/** The longest line (`CatalogCreateSchema`). */
export const CATALOG_LINE_MAX = 400;
/** The longest reference id (`CatalogCreateSchema`): an "Outside your lane" `refId` is the learner's own words. */
export const CATALOG_REF_MAX = 200;

interface CatalogRow {
  id: string;
  ref_kind: string;
  ref_id: string;
  lines_json: string;
  sketch_id: string | null;
  created_at: string;
}

const refKindOf = (v: string): CatalogRefKind | null =>
  (CATALOG_REF_KINDS as readonly string[]).includes(v) ? (v as CatalogRefKind) : null;

/** The six lines from stored JSON: a missing or non-string line reads as empty (a hand-edited row never throws). */
function linesOf(json: string): CatalogLines {
  let raw: unknown = null;
  try {
    raw = JSON.parse(json);
  } catch {
    raw = null;
  }
  const obj = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    CATALOG_LINES.map((k) => {
      const v = obj[k];
      return [k, typeof v === "string" ? v.slice(0, CATALOG_LINE_MAX) : ""];
    }),
  ) as CatalogLines;
}

class CatalogsRepo {
  constructor(private readonly db: Db) {}
  /** Newest first. A row whose `ref_kind` is outside the enum is skipped (no CHECK in the table). */
  list(f: { refKind?: CatalogRefKind; refId?: string }): Catalog[] {
    const where: string[] = [];
    const params: string[] = [];
    if (f.refKind !== undefined) {
      where.push("ref_kind = ?");
      params.push(f.refKind);
    }
    if (f.refId !== undefined) {
      where.push("ref_id = ?");
      params.push(f.refId);
    }
    const sql = `SELECT * FROM catalogs${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC, rowid DESC`;
    const out: Catalog[] = [];
    for (const r of all<CatalogRow>(this.db, sql, ...params)) {
      const refKind = refKindOf(r.ref_kind);
      if (refKind === null) continue;
      out.push({
        id: r.id,
        refKind,
        refId: r.ref_id,
        lines: linesOf(r.lines_json),
        sketchId: r.sketch_id,
        createdAt: r.created_at,
      });
    }
    return out;
  }
  insert(c: Catalog): void {
    run(
      this.db,
      "INSERT INTO catalogs (id, ref_kind, ref_id, lines_json, sketch_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      c.id,
      c.refKind,
      c.refId,
      JSON.stringify(c.lines),
      c.sketchId,
      c.createdAt,
    );
  }
}

export class CatalogsService {
  readonly #repo: CatalogsRepo;
  readonly #ctx: ServiceContext;
  constructor(ctx: ServiceContext) {
    this.#ctx = ctx;
    this.#repo = new CatalogsRepo(ctx.repos.db);
  }

  /** Newest first (`created_at DESC, rowid DESC`), filtered by `refKind` and `refId` when given. */
  list(f: { refKind?: CatalogRefKind; refId?: string } = {}): Catalog[] {
    return this.#repo.list(f);
  }

  /**
   * A new catalog. The reference must exist: a unit song of the content (`usong.*`), one of the learner's
   * transcription projects or audio files; an `outside` reference is the learner's own words and is never resolved.
   * A `sketchId` must name an existing sketch. Any of these failing is a 400.
   */
  create(body: CatalogCreate): Catalog {
    const refKind = refKindOf(body.refKind);
    if (refKind === null) throw badRequest(`refKind must be one of ${CATALOG_REF_KINDS.join(", ")}`);
    const refId = body.refId.trim();
    if (refId === "") throw badRequest("refId is empty");
    if (refId.length > CATALOG_REF_MAX)
      throw badRequest(`refId is longer than ${CATALOG_REF_MAX} characters`);
    const repos = this.#ctx.repos;
    switch (refKind) {
      case "song":
        if (!(this.#ctx.content.source.unitSongs ?? []).some((s) => s.id === refId))
          throw badRequest("refId is not a unit song");
        break;
      case "transcription":
        if (repos.transcriptions.get(refId) === null) throw badRequest("refId is not a transcription");
        break;
      case "audio":
        if (repos.audio.get(refId) === null) throw badRequest("refId is not an audio file");
        break;
      case "outside":
        break;
    }
    const lines = {} as Record<(typeof CATALOG_LINES)[number], string>;
    for (const k of CATALOG_LINES) {
      const v = body.lines[k];
      if (typeof v !== "string") throw badRequest(`lines.${k} is missing`);
      if (v.length > CATALOG_LINE_MAX)
        throw badRequest(`lines.${k} is longer than ${CATALOG_LINE_MAX} characters`);
      lines[k] = v;
    }
    if (body.sketchId !== null && repos.sketches.get(body.sketchId) === null)
      throw badRequest("sketchId is not a sketch");
    const catalog: Catalog = {
      id: newId("cat"),
      refKind,
      refId,
      lines,
      sketchId: body.sketchId,
      createdAt: this.#ctx.clock.now().toISOString(),
    };
    this.#repo.insert(catalog);
    return catalog;
  }
}
