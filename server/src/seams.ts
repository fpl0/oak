// Seams to modules other engineers own: the grader hosts (`server/src/grader/host.ts`), created lazily;
// the pattern stimulus of hidden Transcribe sources (evaluated by the learner host); the ladder
// generator (`@oak/drills`). A piece that is unfinished fails the request that needs it with 503.
import { toLearnerProfile } from "@oak/api";
import { METER_IDS, type MeterId, type NEvent, type ToolEntry, type UnlockableId } from "@oak/content-kit";
import { generateLadderPiece } from "@oak/drills";
import { type GraderHost, nameUnlockSites, normalize } from "@oak/grader";
import type { ContentIndex } from "./content/index.ts";
import type { Repos } from "./db/repos/index.ts";
import type { GraderHosts } from "./deps.ts";
import { ApiError } from "./errors.ts";
import { createGraderHosts } from "./grader/host.ts";
import type { LadderGenerator, PatternStimulus } from "./services/library.ts";

/** A host created on first use; creation failures surface as 503 on the request that needed it. */
export interface LazyHost {
  (): GraderHost;
  /** The host if it was started, without starting it. */
  peek(): GraderHost | null;
}
export function lazyHost(make: () => GraderHost): LazyHost {
  let host: GraderHost | null = null;
  const get = (() => {
    if (host !== null) return host;
    try {
      host = make();
      return host;
    } catch (e) {
      throw new ApiError(
        "unavailable",
        `the grader is not available: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }) as LazyHost;
  get.peek = () => host;
  return get;
}

/**
 * The server's two hosts from `server/src/grader/host.ts` (the grader-runtime engineer's
 * `createGraderHosts`), created on first use: a host that cannot start fails the request that needs it
 * (503), never the server's start-up.
 */
export function serverGraderHosts(opts: { toolbox: () => readonly ToolEntry[] }): GraderHosts {
  let hosts: ReturnType<typeof createGraderHosts> | null = null;
  const all = () => {
    hosts ??= createGraderHosts({ toolbox: opts.toolbox() });
    return hosts;
  };
  return {
    learner: lazyHost(() => all().learner),
    tutor: lazyHost(() => all().tutor),
    async dispose() {
      await hosts?.dispose().catch(() => undefined);
    },
  };
}

/**
 * The toolbox as the server's graders read it: every row carries the learner's words for the sessions that unlock
 * it ("the lesson “Degrees in Code”"), so a message graded here never names a lesson by its bare ID (the app names
 * its own rows the same way, `withUnlockNames` in app/src/lib/content-model.ts). A row with an unknown site keeps
 * its IDs.
 */
export function namedToolbox(content: ContentIndex): readonly ToolEntry[] {
  return nameUnlockSites(content.toolbox(), (site) => {
    const id = site.replace(/\.S\d+$/, "");
    const checkpoint = content.checkpointMeta(id);
    if (checkpoint) return { kind: "checkpoint", title: checkpoint.title };
    const capstone = content.capstoneMeta(id);
    if (capstone) return { kind: "capstone", title: capstone.title };
    const title = content.lessonSite(id) ? content.lessonTitle(id) : undefined;
    return title === undefined ? undefined : { kind: "lesson", title };
  });
}

/** Events of hidden pattern code (pd-song and ladder sources), evaluated by the learner host. */
export function patternStimulus(graders: GraderHosts, content: ContentIndex): PatternStimulus {
  return async (code, bars, meterText = "4/4") => {
    // A song in 3/4 (or 6/8) is read in its own meter: its `setcpm(bpm/3)` is right there, not a 4/4 mistake.
    const meter = (METER_IDS as readonly string[]).includes(meterText) ? (meterText as MeterId) : "4/4";
    const r = await graders.learner().analyze(code, {
      mode: "capstone",
      bars,
      lint: {
        profile: "content",
        unlocked: new Set(content.toolbox().map((t) => t.id)) as Set<UnlockableId>,
        allowPreview: true,
        meter,
        key: null,
      },
    });
    if (!r.ok) return null;
    const n = normalize(r, { meter });
    const preload = [...new Set(n.all.map((e: NEvent) => e.s).filter((s): s is string => s !== undefined))];
    return { events: n.all, cps: r.cps, bars: r.bars, preload };
  };
}

export function ladderGenerator(repos: Repos): LadderGenerator {
  return (level, realism, seed, opts = {}) => {
    try {
      return generateLadderPiece(
        Math.min(4, Math.max(1, level)) as 1 | 2 | 3 | 4,
        Math.min(4, Math.max(0, realism)) as 0 | 1 | 2 | 3 | 4,
        seed,
        toLearnerProfile(repos.profile.get()),
        opts.completed === undefined ? {} : { completed: opts.completed },
      );
    } catch (e) {
      throw new ApiError(
        "unavailable",
        `the ladder generator is not available: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
}
