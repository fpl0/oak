// Builds every service over one context, in dependency order.

import type { GradeResult } from "@oak/content-kit";
import type { GradeRequest } from "@oak/grader";
import { freshness as cardFreshness } from "@oak/srs";
import type { OakConfig } from "../config.ts";
import { ApiError } from "../errors.ts";
import { CourseAdapter, nextSessionOf } from "../srs-wiring.ts";
import { AudioStore } from "./audio-store.ts";
import { BackupService } from "./backup.ts";
import { CanDoService } from "./cando.ts";
import { CapstoneReleaseService } from "./capstone-release.ts";
import { CapstoneSessionsService } from "./capstone-sessions.ts";
import { CatalogsService } from "./catalogs.ts";
import { CheckHistoryService } from "./check-history.ts";
import type { ServiceContext } from "./context.ts";
import { CourseService } from "./course.ts";
import { GatesService } from "./gates.ts";
import { GymService } from "./gym.ts";
import { HabitsService } from "./habits.ts";
import { LadderService } from "./ladder.ts";
import { LaterService } from "./later.ts";
import { type LadderGenerator, LibraryService, type PatternStimulus } from "./library.ts";
import { LineageService } from "./lineage.ts";
import { MasteryService } from "./mastery.ts";
import { OnboardingService } from "./onboarding.ts";
import { OpsService } from "./ops.ts";
import type { SrsPort } from "./ports.ts";
import { ScrapsService } from "./scraps.ts";
import { SessionsService } from "./sessions.ts";
import { SideLessonsService } from "./side-lessons.ts";
import { StreakService } from "./streak.ts";
import { TrackPlanService } from "./track-plan.ts";
import { TracksService } from "./tracks.ts";
import { UnitSongsService } from "./unit-songs.ts";
import { UnlocksService } from "./unlocks.ts";
import { UserTemplatesService } from "./user-templates.ts";
import { VoiceService } from "./voice.ts";

export interface Services {
  ctx: ServiceContext;
  gates: GatesService;
  unlocks: UnlocksService;
  mastery: MasteryService;
  cando: CanDoService;
  streak: StreakService;
  course: CourseService;
  release: CapstoneReleaseService;
  onboarding: OnboardingService;
  sessions: SessionsService;
  library: LibraryService;
  ops: OpsService;
  backup: BackupService;
  store: AudioStore;
  voice: VoiceService;
  /** Wave 4. */
  capstoneSessions: CapstoneSessionsService;
  ladder: LadderService;
  gym: GymService;
  /** Wave 5: the optional side lessons A1.L01–L04 (wave5.md §5.1). */
  sideLessons: SideLessonsService;
  /** Wave 6: the advanced tracks' recorded gates and the end of the core (wave6.md §5.3, §5.5). */
  tracks: TracksService;
  /** Wave 7: the tracks as sessions, the learner's focus, the whole course (wave7.md §5). */
  trackPlan: TrackPlanService;
  /** Unit songs (spec 2026-11-24 §5.4): each unit's song, its takes, the backfill, releases. */
  unitSongs: UnitSongsService;
  /** Oak 2.0 W1 (PLAN S1): saved scraps and the index of every sketch's labelled lines. */
  scraps: ScrapsService;
  /** Oak 2.0 W1 (PLAN S2): the learner's own templates and Blank. */
  templates: UserTemplatesService;
  /** Oak 2.0 W1 (PLAN S7): the Later list on Today. */
  later: LaterService;
  /** Oak 2.0 W3 (PLAN S5): a version's variation chain, first to last. */
  lineage: LineageService;
  /** Oak 2.0 W3 (PLAN S6): the habits mirror, read from the learner's own free sketches. */
  habits: HabitsService;
  /** Oak 2.0 W3 (PLAN S6): the catalog of attributes. */
  catalogs: CatalogsService;
  /** Oak 2.0 W4 (PLAN F2): every rubric check of a capstone's drafts, oldest first. */
  checkHistory: CheckHistoryService;
}

export interface ServiceOptions {
  config: Pick<OakConfig, "audioDir" | "albumDir" | "backupsDir"> &
    Partial<Pick<OakConfig, "dev" | "songsAutostart">>;
  srs: () => SrsPort | null;
  stimulus?: PatternStimulus;
  ladder?: LadderGenerator;
  /** The learner host's grade (ladder submissions are graded exactly on the server, wave4.md §5.4). */
  grade?: (req: GradeRequest) => Promise<GradeResult>;
}

export function createServices(ctx: ServiceContext, opts: ServiceOptions): Services {
  const gates = new GatesService(ctx);
  const unlocks = new UnlocksService(ctx, gates);
  const mastery = new MasteryService(ctx, {
    recall: (cardId) => opts.srs()?.recall(cardId) ?? null,
    lessonStatus: (id) => gates.lessonStatus(id),
  });
  const streak = new StreakService(ctx);
  const voice = new VoiceService(ctx, { gates });
  const sourceDone = (id: string): boolean => {
    if (ctx.content.lessonSite(id) !== null) return gates.lessonCompleted(id);
    if (ctx.content.checkpointMeta(id) !== null) return gates.checkpointPassed(id);
    if (ctx.content.capstoneMeta(id) !== null) return gates.capstoneReleased(id);
    return false;
  };
  const freshness = (skillId: string): number => {
    const input = mastery.inputOf(skillId);
    if (input === null || input.cards.length === 0) return 1;
    const total = input.cards.reduce((s, c) => s + c.weight, 0);
    return (
      input.cards.reduce((s, c) => s + c.weight * cardFreshness(c.retrievability, c.desiredRetention), 0) /
      total
    );
  };
  const cando = new CanDoService(ctx, { sourceDone, freshness });
  const capstoneSessions = new CapstoneSessionsService(ctx, { gates, mastery, streak });
  const sideLessons = new SideLessonsService(ctx, gates);
  const trackPlan = new TrackPlanService(ctx, { gates });
  const tracks = new TracksService(ctx, {
    plan: trackPlan,
    gates,
    sideLesson: () => {
      const list = sideLessons.list();
      const next = list.items.find((i) => i.lessonId === list.next);
      return next === undefined ? null : { lessonId: next.lessonId, title: next.title };
    },
    dueTomorrow: () =>
      ctx.repos.srs.due(new Date(ctx.clock.now().getTime() + 86_400_000).toISOString()).length,
    nextStandard: () => services.ladder.nextStandardTitle(),
  });
  const course = new CourseService(ctx, {
    gates,
    unlocks,
    mastery,
    cando,
    streak,
    voice,
    srs: opts.srs,
    capstoneSessions,
    tracks,
  });
  const store = new AudioStore(opts.config.audioDir, opts.config.albumDir);
  const sessions = new SessionsService(ctx, {
    gates,
    unlocks,
    streak,
    course,
    voice,
    capstoneSessions,
    tutorOff: () => ctx.repos.settings.get("tutor").backend === "off",
    gymSummary: (id) => services.gym.summary(id),
    tracks,
    trackPlan,
    nextSession: () => nextSessionOf(services),
  });
  const library = new LibraryService(ctx, {
    streak,
    mastery,
    store,
    ...(opts.stimulus === undefined ? {} : { stimulus: opts.stimulus }),
    ...(opts.ladder === undefined ? {} : { ladder: opts.ladder }),
  });
  const unitSongs = new UnitSongsService(ctx, {
    gates,
    library,
    autostart: opts.config.dev === true && opts.config.songsAutostart === true,
  });
  const release = new CapstoneReleaseService(ctx, {
    course,
    gates,
    library,
    unlocks,
    cando,
    streak,
    capstoneSessions,
    tracks,
  });
  const ladder = new LadderService(ctx, {
    library,
    mastery,
    streak,
    unlocks,
    srs: opts.srs,
    grade:
      opts.grade ??
      (() => {
        throw new ApiError("unavailable", "the grader is not available");
      }),
    ...(opts.ladder === undefined ? {} : { generator: opts.ladder }),
    ...(opts.stimulus === undefined ? {} : { stimulus: opts.stimulus }),
    // Wave 5: in dev (OAK_DEV=1) the L5/L6 songs whose answer keys are still "Being checked" can be worked (e2e).
    allowUnverifiedSongs: opts.config.dev === true,
  });
  const onboarding = new OnboardingService(ctx, course);
  const ops = new OpsService(ctx, mastery);
  const backup = new BackupService(
    ctx.repos.db,
    { backupsDir: opts.config.backupsDir, store },
    { contentVersion: () => ctx.content.contentVersion, now: () => ctx.clock.now() },
  );
  let services: Services;
  const gym = new GymService(ctx, {
    gates,
    ladder,
    capstoneSessions,
    course: () => new CourseAdapter(ctx.repos, ctx.content, services),
  });
  services = {
    ctx,
    gates,
    unlocks,
    mastery,
    cando,
    streak,
    course,
    release,
    onboarding,
    sessions,
    library,
    ops,
    backup,
    store,
    voice,
    capstoneSessions,
    ladder,
    gym,
    sideLessons,
    tracks,
    trackPlan,
    unitSongs,
    scraps: new ScrapsService(ctx),
    templates: new UserTemplatesService(ctx),
    later: new LaterService(ctx),
    lineage: new LineageService(ctx),
    habits: new HabitsService(ctx),
    catalogs: new CatalogsService(ctx),
    checkHistory: new CheckHistoryService(ctx),
  };
  return services;
}
