import { SCRAP_ROLES, SCRAP_SOURCE_KINDS, type Scrap, type ScrapCreate, type ScrapRole } from "@oak/api";
import { labelledLines, roleOfLabel, scrapCode } from "@oak/content-kit";
import { fromJson, toJsonOrNull } from "../db/index.ts";
import { type ScrapRow, ScrapsRepo } from "../db/repos/scraps.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import { LearnerTime, newId, type ServiceContext } from "./context.ts";

const SKETCH_REF = /^(sk_[A-Za-z0-9]+)@([1-9]\d*)$/;

export function indexScrapId(sketchId: string, version: number, position: number): string {
  return `idx_${sketchId}_v${version}_${position}`;
}

function savedScrap(r: ScrapRow): Scrap | null {
  // Edited backups may contain future enums: keep unknown roles as other, skip unknown sources without deleting.
  const sourceKind = SCRAP_SOURCE_KINDS.find((kind) => kind === r.source_kind);
  if (sourceKind === undefined) return null;
  const role = r.role === null ? null : (SCRAP_ROLES.find((role) => role === r.role) ?? "other");
  const ref = sourceKind === "sketch" ? SKETCH_REF.exec(r.source_ref ?? "") : null;
  const version = ref === null ? null : Number(ref[2]);
  return {
    id: r.id,
    origin: "saved",
    role,
    label: r.label,
    code: r.code,
    bpm: r.bpm,
    meter: r.meter as Scrap["meter"],
    key: fromJson<Scrap["key"]>(r.key_json, null),
    sourceKind,
    sourceRef: r.source_ref,
    sketchId: ref?.[1] ?? null,
    sketchVersion: Number.isSafeInteger(version) ? version : null,
    createdAt: r.created_at,
    ...(r.review_before_run === 1 ? { reviewBeforeRun: true as const } : {}),
  };
}

export class ScrapsService {
  private readonly repo: ScrapsRepo;
  private readonly time: LearnerTime;

  constructor(private readonly ctx: ServiceContext) {
    this.repo = new ScrapsRepo(ctx.repos.db);
    this.time = new LearnerTime(ctx);
  }

  list(filter: { role?: ScrapRole; origin?: "saved" | "index" }): Scrap[] {
    const items: Scrap[] = [];
    for (const row of this.repo.list()) {
      const scrap = savedScrap(row);
      if (scrap !== null) items.push(scrap);
    }
    for (const sketch of this.ctx.repos.sketches.list({ archived: false })) {
      const version = this.ctx.repos.sketches.version(sketch.id, sketch.currentVersion);
      if (version === null) continue;
      for (const [position, line] of labelledLines(version.code).entries()) {
        items.push({
          id: indexScrapId(sketch.id, version.version, position),
          origin: "index",
          role: roleOfLabel(line.label),
          label: line.label,
          code: scrapCode(version.code, line) ?? line.text,
          bpm: version.bpm,
          meter: version.meter,
          key: version.key,
          sourceKind: "sketch",
          sourceRef: null,
          sketchId: sketch.id,
          sketchVersion: version.version,
          createdAt: version.createdAt,
          ...(version.flags.reviewBeforeRun === true ? { reviewBeforeRun: true as const } : {}),
        });
      }
    }
    return items
      .filter(
        (s) =>
          (filter.role === undefined || s.role === filter.role) &&
          (filter.origin === undefined || s.origin === filter.origin),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  create(body: ScrapCreate): Scrap {
    if (body.sourceKind === "sketch") {
      const ref = SKETCH_REF.exec(body.sourceRef ?? "");
      if (ref === null) throw badRequest("a line saved from a sketch names it as <sketch id>@<version>");
      const id = ref[1] as string;
      const version = Number(ref[2]);
      if (!Number.isSafeInteger(version) || this.ctx.repos.sketches.version(id, version) === null)
        throw notFound(`sketch ${id} version ${version}`);
    }
    const row: ScrapRow = {
      id: newId("scr"),
      role: body.role,
      label: body.label,
      code: body.code,
      bpm: body.bpm,
      meter: body.meter,
      key_json: toJsonOrNull(body.key),
      source_kind: body.sourceKind,
      source_ref: body.sourceRef,
      created_at: this.time.iso(),
      review_before_run: 0,
    };
    this.repo.insert(row);
    return savedScrap(row) as Scrap;
  }

  delete(id: string): void {
    if (id.startsWith("idx_"))
      throw conflict("a line of a sketch goes with that line: change it in the sketch");
    if (!this.repo.delete(id)) throw notFound(`scrap ${id}`);
  }
}
