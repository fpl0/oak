import type { UserTemplate, UserTemplateCreate, UserTemplatePatch } from "@oak/api";
import { int, tx } from "../db/index.ts";
import { type UserTemplateRow, UserTemplatesRepo } from "../db/repos/user-templates.ts";
import { badRequest, notFound } from "../errors.ts";
import { LearnerTime, newId, type ServiceContext } from "./context.ts";
import { templateOfCode } from "./template-code.ts";

const toTemplate = (r: UserTemplateRow): UserTemplate => ({
  id: r.id,
  name: r.name,
  code: r.code,
  bpm: r.bpm,
  meter: r.meter as UserTemplate["meter"],
  isBlank: r.is_blank === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  ...(r.review_before_run === 1 ? { reviewBeforeRun: true as const } : {}),
});

export class UserTemplatesService {
  private readonly repo: UserTemplatesRepo;
  private readonly time: LearnerTime;

  constructor(private readonly ctx: ServiceContext) {
    this.repo = new UserTemplatesRepo(ctx.repos.db);
    this.time = new LearnerTime(ctx);
  }

  list(): UserTemplate[] {
    return this.repo
      .list()
      .map(toTemplate)
      .sort(
        (a, b) =>
          Number(b.isBlank) - Number(a.isBlank) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      );
  }

  create(body: UserTemplateCreate): UserTemplate {
    return tx(this.ctx.repos.db, () => {
      let { code, bpm, meter } = body;
      let reviewBeforeRun = false;
      if (body.fromSketch !== null) {
        const { sketchId, version } = body.fromSketch;
        const source = this.ctx.repos.sketches.version(sketchId, version);
        if (source === null) throw notFound(`sketch ${sketchId} version ${version}`);
        code = templateOfCode(source.code).code;
        bpm = source.bpm;
        meter = source.meter;
        reviewBeforeRun = source.flags.reviewBeforeRun === true;
      }
      if (code === null) throw badRequest("a template needs code, or a sketch to start from");
      const now = this.time.iso();
      const row: UserTemplateRow = {
        id: newId("tpl"),
        name: body.name,
        code,
        bpm,
        meter,
        is_blank: int(body.isBlank),
        created_at: now,
        updated_at: now,
        review_before_run: int(reviewBeforeRun),
      };
      if (body.isBlank) this.repo.clearBlank(null, now);
      this.repo.insert(row);
      if (reviewBeforeRun) this.repo.markForReview(row.id);
      return toTemplate(row);
    });
  }

  patch(id: string, body: UserTemplatePatch): UserTemplate {
    return tx(this.ctx.repos.db, () => {
      const row = this.repo.get(id);
      if (row === null) throw notFound(`template ${id}`);
      if (body.name === undefined && body.isBlank === undefined) return toTemplate(row);
      const patch = {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.isBlank === undefined ? {} : { is_blank: int(body.isBlank) }),
        updated_at: this.time.iso(),
      };
      if (body.isBlank === true) this.repo.clearBlank(id, patch.updated_at);
      this.repo.update(id, patch);
      return toTemplate({ ...row, ...patch });
    });
  }

  delete(id: string): void {
    if (!this.repo.delete(id)) throw notFound(`template ${id}`);
  }
}
