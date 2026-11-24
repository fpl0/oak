// The server grader (grade, analyze), telemetry, the QA queue, backup, and the dev endpoints.
import { type AnalyzeResponse, toLearnerProfile } from "@oak/api";
import {
  drawExerciseParams,
  type KeySpec,
  type LintContext,
  type MeterId,
  type UnlockableId,
} from "@oak/content-kit";
import { analyzePiece, type ExerciseResponse, normalize } from "@oak/grader";
import type { AppDeps } from "../deps.ts";
import { badRequest, notFound } from "../errors.ts";
import { clockState, needDevClock, SEED_POINTS, seedLearner } from "../services/dev-seed.ts";
import type { Mounter } from "./define.ts";

const DEFAULT_KEY: KeySpec = { tonic: "C", mode: "major" };

function toExerciseResponse(r: Record<string, unknown>): ExerciseResponse {
  if ("taps" in r || "lanes" in r || "sung" in r)
    throw badRequest("sung and tapped answers are graded in the browser");
  if ("skipped" in r) throw badRequest("a skipped answer has nothing to grade");
  return r as ExerciseResponse;
}

export function opsRoutes(mount: Mounter, d: AppDeps): void {
  const s = d.services;

  mount("grade", async ({ body }) => {
    const site = d.content.exercise(body.exerciseId);
    if (site === null) throw notFound(`exercise ${body.exerciseId}`);
    const lesson = d.content.lessonDef(site.owner);
    const key = site.exercise.key ?? lesson?.key ?? DEFAULT_KEY;
    const meter: MeterId = site.exercise.meter ?? lesson?.meter ?? "4/4";
    const row = site.stepId === null ? null : d.repos.lessons.stepState(site.owner, site.stepId);
    const params = body.params ?? drawExerciseParams(site.exercise, site.globalId, row?.seriesNo ?? 0);
    const lint: LintContext = {
      profile: "graded",
      unlocked: s.unlocks.usableIn(site.ownerKind === "lesson" ? site.owner : null) as Set<UnlockableId>,
      allowPreview: false,
      meter,
      key,
    };
    return d.graders.learner().grade({
      exercise: site.exercise,
      response: toExerciseResponse(body.response as Record<string, unknown>),
      ctx: {
        exerciseGlobalId: site.globalId,
        mode: body.mode,
        key,
        meter,
        bpm: lesson?.bpm ?? 120,
        params,
        attemptNo: (row?.attempts ?? 0) + 1,
        firstAttempt: (row?.attempts ?? 0) === 0,
        rung: row?.rung ?? 0,
        tutorHints: row?.tutorHints ?? 0,
        extraReplays: 0,
        lint,
        profile: toLearnerProfile(d.repos.profile.get()),
      },
    });
  });

  mount("analyze", async ({ body }) => {
    const meter: MeterId = "4/4";
    const lint: LintContext = {
      profile: body.mode === "tutor" ? "tutor-card" : "studio",
      unlocked: s.unlocks.ids() as Set<UnlockableId>,
      allowPreview: body.mode === "tutor",
      meter,
      key: null,
    };
    const host = body.mode === "tutor" ? d.graders.tutor() : d.graders.learner();
    const r = await host.analyze(body.code, { mode: body.mode, bars: body.bars, lint });
    const logs = r.logs.map((l) => ({
      level: l.level,
      text: l.tag === null ? l.message : `[${l.tag}] ${l.message}`,
    }));
    if (!r.ok) {
      const out: AnalyzeResponse = {
        ok: false,
        error: { kind: r.error.kind, message: r.error.message, line: r.error.line ?? null },
        cps: null,
        bpm: null,
        tracks: [],
        events: [],
        logs,
        analysis: null,
      };
      return out;
    }
    const n = normalize(r, { meter });
    let analysis: AnalyzeResponse["analysis"] = null;
    try {
      analysis = analyzePiece(n, { meter, code: body.code });
    } catch {
      analysis = null;
    }
    const out: AnalyzeResponse = {
      ok: true,
      error: null,
      cps: r.cps,
      bpm: r.bpm,
      tracks: r.tracks,
      events: n.all,
      logs,
      analysis,
    };
    return out;
  });

  mount("telemetry.steps", ({ body }) => {
    s.ops.addSteps(body.steps);
    return { ok: true as const };
  });
  mount("qa.report", ({ body }) => s.ops.addQa(body));

  mount("backup.info", () => s.backup.info());
  mount("backup.export", ({ query }) => {
    const withAudio =
      query.audio === undefined ? d.repos.settings.get("backupWithAudio") : query.audio === "1";
    const { bytes, filename } = s.backup.export(withAudio);
    return new Response(bytes, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  });
  mount("backup.import", ({ bytes }) => {
    if (bytes.length === 0) throw badRequest("empty upload");
    const result = s.backup.import(bytes);
    // Unlocks may have moved since the backup was made; grant what its completed sessions earn (§11.7 rule 5).
    s.unlocks.backfill();
    // Unit songs (spec 2026-11-24 §5.6a): a backup from before songs (schema < 11) carries completed lessons and no
    // songs; they are backfilled now, as at the first start-up after the update. A backup that already had songs is
    // restored as it was; its songs later gain only the takes of completed take lessons they lack (at the next read
    // or start-up), never a cell one of their takes owns (`UnitSongsService.backfill`).
    if (result.migratedFrom !== null) {
      try {
        s.unitSongs.backfill();
      } catch (e) {
        d.log(`unit song backfill after import failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return result;
  });

  mount("dev.qa", () => ({ items: s.ops.qaList() }));
  mount("dev.qaUpdate", ({ params, body }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) throw badRequest("report id must be an integer");
    return s.ops.setQaStatus(id, body.status);
  });
  mount("dev.telemetry", async () => {
    const srs = d.srs();
    const forecast = srs?.forecast === undefined ? [] : await srs.forecast();
    const month = s.streak.time.day().slice(0, 7);
    const m = d.repos.tutor.month(month);
    const totalIn = m.inputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens;
    return s.ops.report(forecast, {
      cacheHitRatio: totalIn === 0 ? 0 : m.cacheReadInputTokens / totalIn,
      costUsd: m.costUsd,
    });
  });
  mount("dev.contentReport", () => ({
    contentVersion: d.content.contentVersion,
    lessons: d.content.source.lessons.length,
    problems: [...d.content.source.problems],
  }));

  // Wave 2 (docs/design/wave2.md §4).
  mount("dev.listen", () => ({ items: d.repos.listen.list() }));
  mount("dev.listenMark", ({ params, body }) => {
    if (params.ref.length > 200) throw badRequest("example reference too long");
    return d.repos.listen.put({ ref: params.ref, ...body, at: d.clock.now().toISOString() });
  });

  // Dev tools for the other areas' e2e: the seeder and the clock (services/dev-seed.ts, dev-clock.ts).
  mount("dev.seedPoints", () => ({ items: SEED_POINTS.map((p) => ({ ...p })) }));
  mount("dev.seed", ({ body }) => seedLearner(d, body));
  mount("dev.clock", () => clockState(d));
  mount("dev.clockSet", ({ body }) => {
    const clock = needDevClock(d);
    if (body.reset === true) clock.reset();
    if (body.at !== undefined) clock.jump(body.at);
    if (body.advanceDays !== undefined) clock.advance(body.advanceDays * 86_400_000);
    if (body.advanceMs !== undefined) clock.advance(body.advanceMs);
    if (body.freeze !== undefined) clock.freeze(body.freeze);
    return clockState(d);
  });
}
