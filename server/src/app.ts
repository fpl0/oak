// The server: `createServer(options)` opens the database, builds the content index, the services, the
// tutor wiring and the Hono app. `main.ts` adds Bun.serve; tests call `app.request()` directly.
import { Hono } from "hono";
import type { OakConfig } from "./config.ts";
import { ConfirmStore } from "./confirm.ts";
import { ContentIndex } from "./content/index.ts";
import type { ContentSource } from "./content/types.ts";
import { type Db, openDb } from "./db/index.ts";
import { createRepos } from "./db/repos/index.ts";
import type { AppDeps, GraderHosts } from "./deps.ts";
import { ApiError, errorResponse } from "./errors.ts";
import { catalogsRoutes } from "./routes/catalogs.ts";
import { courseRoutes } from "./routes/course.ts";
import { createMounter } from "./routes/define.ts";
import { habitsRoutes } from "./routes/habits.ts";
import { laterRoutes } from "./routes/later.ts";
import { libraryRoutes } from "./routes/library.ts";
import { lineageRoutes } from "./routes/lineage.ts";
import { metaRoutes } from "./routes/meta.ts";
import { oak2PendingRoutes } from "./routes/oak2.ts";
import { opsRoutes } from "./routes/ops.ts";
import { practiceRoutes } from "./routes/practice.ts";
import { scrapsRoutes } from "./routes/scraps.ts";
import { songRoutes } from "./routes/songs.ts";
import { templatesRoutes } from "./routes/templates.ts";
import { tutorRoutes, tutorTurnRoutes } from "./routes/tutor.ts";
import { ladderGenerator, patternStimulus } from "./seams.ts";
import { anthropicKeyValidator, type KeyValidator, redactSecrets, Secrets } from "./secrets.ts";
import { apiSecurity, cspOnHtml, hostOnly } from "./security.ts";
import { type FetchLike, settingsUpdateStore, UpdateChecker } from "./services/app-update.ts";
import { dailyBackup } from "./services/backup.ts";
import { type Clock, LearnerTime, systemClock, systemTimeZone } from "./services/context.ts";
import { DevClock } from "./services/dev-clock.ts";
import { createServices } from "./services/index.ts";
import type { SessionPlannerPort, SrsPort } from "./services/ports.ts";
import { createSrsWiring } from "./srs-wiring.ts";
import { staticRoutes } from "./static.ts";
import { createTutorWiring, type TutorWiringDeps } from "./tutor-wiring.ts";

export interface ServerOptions {
  config: OakConfig;
  content: ContentSource;
  graders: GraderHosts;
  clock?: Clock;
  srs?: SrsPort | null;
  planner?: SessionPlannerPort | null;
  /** Wire the SRS engineer's `SrsService` and `SessionPlanService` (default true; tests of other parts may skip it). */
  srsWiring?: boolean;
  /** Read once at start-up, before any grader host starts (main.ts builds it first). */
  secrets?: Secrets;
  keyValidator?: KeyValidator;
  /** `false`: no tutor (tests of everything else); otherwise options passed through to `createDefaultTutor`. */
  tutor?: false | TutorWiringDeps["tutor"];
  env?: Record<string, string | undefined>;
  validateResponses?: boolean;
  /** The daily backup and the unlock backfill at start-up (default true). */
  startup?: boolean;
  /** How the desktop app's update check reaches GitHub (default: the global `fetch`; tests inject one). */
  updateFetch?: FetchLike;
  log?: (msg: string) => void;
}

export interface OakServer {
  app: Hono;
  deps: AppDeps;
  close(): Promise<void>;
}

export function buildApp(d: AppDeps): Hono {
  const app = new Hono();
  app.onError((err) => {
    if (err instanceof ApiError) return errorResponse(err);
    d.log(`unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    return errorResponse(new ApiError("internal", "something went wrong on the server"));
  });
  const security = { port: d.config.port, devPorts: d.config.devPorts, dev: d.config.dev };
  app.use(
    "/api/*",
    apiSecurity(security, (reason, req) =>
      d.log(`refused ${req.method} ${new URL(req.url).pathname}: ${reason}`),
    ),
  );
  app.use("/sounds/*", hostOnly(security));
  app.use("*", cspOnHtml(d.config.dev));

  const mount = createMounter(app, {
    confirm: d.confirm,
    validateResponses: d.validateResponses,
    log: d.log,
  });
  metaRoutes(mount, d);
  courseRoutes(mount, d);
  practiceRoutes(mount, d);
  libraryRoutes(mount, d);
  songRoutes(mount, d);
  tutorRoutes(mount, d);
  opsRoutes(mount, d);
  // Oak 2.0 W1: scraps, the learner's templates, the Later list (contracts §13).
  scrapsRoutes(mount, d.services.scraps);
  templatesRoutes(mount, d.services.templates);
  laterRoutes(mount, d.services.later);
  // Oak 2.0 W3: a version's variation chain, the habits mirror, the catalog of attributes.
  lineageRoutes(mount, d.services.lineage);
  habitsRoutes(mount, d.services.habits);
  catalogsRoutes(mount, d.services.catalogs);
  // Oak 2.0 (contracts §13): endpoints not built yet answer the typed 501 (routes/oak2.ts).
  oak2PendingRoutes(mount);
  tutorTurnRoutes(app, d);

  if (d.tutor !== null) app.route("/", d.tutor.app);
  else
    app.all("/api/tutor/*", () => errorResponse(new ApiError("unavailable", "the tutor is not available")));

  if (d.config.serveDist) app.use("*", hostOnly(security));
  staticRoutes(app, {
    soundsDir: d.config.soundsDir,
    distDir: d.config.distDir,
    serveDist: d.config.serveDist,
    dev: d.config.dev,
  });
  app.notFound((c) => {
    if (c.req.path.startsWith("/api")) return errorResponse(new ApiError("not_found", "no such endpoint"));
    return c.text("Not found", 404);
  });
  return app;
}

/**
 * Start-up chores: the first-launch-of-the-day backup, the unlock backfill (contracts §11.7 rule 5, §11.10) and the
 * unit songs' backfill (spec 2026-11-24 §5.6a).
 */
export function startupTasks(d: AppDeps): void {
  const day = new LearnerTime(d.services.ctx).day();
  if (d.config.dbPath !== ":memory:") {
    try {
      dailyBackup(d.db, d.config.backupsDir, day);
    } catch (e) {
      d.log(`daily backup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  d.services.unlocks.backfill();
  // Wave 6 (wave6.md §5.3, §5.5): a learner already past a track gate, or past the end of the core, gets the rows
  // with their instant and no announcement.
  d.services.tracks.backfill();
  // Unit songs (spec 2026-11-24 §5.6a): every unit with a completed take lesson and no song gets its song, with one
  // take per completed take lesson from its latest Make sketch (a learner whose Makes predate songs). A song that
  // exists (a restored backup's too) keeps its takes and gains only the missing takes of completed take lessons,
  // which never take a cell from a take it has (`UnitSongsService.backfill`). Idempotent; a failure never stops the
  // server.
  try {
    d.services.unitSongs.backfill();
  } catch (e) {
    d.log(`unit song backfill failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * The scripted fake tutor exists only in dev (contracts §11.1 rule 7, wave2 §5): `loadConfig` already ties
 * OAK_TUTOR_FAKE to OAK_DEV; a config built any other way gets the same rule here.
 */
export function fakeTutorEnabled(config: Pick<OakConfig, "dev" | "tutorFake">): boolean {
  return config.dev && config.tutorFake;
}

export async function createServer(o: ServerOptions): Promise<OakServer> {
  const sink = o.log ?? ((msg: string) => console.error(`[oak] ${msg}`));
  // Every server log line passes the redaction (contracts §11.1 rule 6): the key in hand, and anything
  // shaped like an Anthropic key (a pasted key that failed validation is in no store to look up).
  let knownKey: () => string | null = () => null;
  const log = (msg: string) => sink(redactSecrets(msg, knownKey()));
  // In dev the clock can be moved (`/api/dev/clock`, `OAK_NOW`); production reads the real one.
  const devClock = o.config.dev ? new DevClock(o.clock ?? systemClock, { at: o.config.nowAt }) : null;
  const clock: Clock = devClock ?? o.clock ?? systemClock;
  const db: Db = openDb(o.config.dbPath);
  const repos = createRepos(db, { timezone: systemTimeZone(), now: () => clock.now() });
  const content = new ContentIndex(o.content);
  const ctx = { repos, content, clock, appVersion: o.config.appVersion };
  let srs: SrsPort | null = o.srs ?? null;
  let planner: SessionPlannerPort | null = o.planner ?? null;
  const services = createServices(ctx, {
    config: o.config,
    srs: () => srs,
    stimulus: patternStimulus(o.graders, content),
    ladder: ladderGenerator(repos),
    // Ladder answers are the learner's own code: graded on the learner host, never in the server's realm.
    grade: (req) => o.graders.learner().grade(req),
  });
  if (o.srsWiring !== false && (srs === null || planner === null)) {
    const wired = await createSrsWiring({ repos, content, services, clock });
    srs ??= wired.srs;
    planner ??= wired.planner;
  }
  const secrets =
    o.secrets ?? new Secrets(o.config.secretsDir, { env: o.env ?? process.env, rootDir: o.config.rootDir });
  knownKey = () => secrets.anthropicKey();
  const deps: AppDeps = {
    config: o.config,
    db,
    repos,
    content,
    clock,
    devClock,
    services,
    confirm: new ConfirmStore(() => clock.now()),
    secrets,
    keyValidator: o.keyValidator ?? anthropicKeyValidator,
    srs: () => srs,
    planner: () => planner,
    graders: o.graders,
    tutor: null,
    // Asks nothing until the app first calls `GET /api/app/update`, and only in the desktop app.
    updates: new UpdateChecker({
      current: o.config.desktopApp ? o.config.appVersion : null,
      enabled: () => repos.settings.get("checkForUpdates") !== false,
      fetch: o.updateFetch ?? ((url, init) => fetch(url, init)),
      now: () => clock.now(),
      store: settingsUpdateStore(db),
      log,
    }),
    validateResponses: o.validateResponses ?? o.config.dev,
    log,
  };
  const tutorFake = fakeTutorEnabled(o.config);
  if (o.tutor !== false) {
    deps.tutor = createTutorWiring({
      repos,
      content,
      services,
      graders: o.graders,
      secrets,
      now: () => clock.now(),
      port: o.config.port,
      devPorts: o.config.devPorts,
      ...(o.tutor === undefined ? {} : { tutor: o.tutor }),
      ...(tutorFake ? { fake: true } : {}),
    });
    if (tutorFake) log("tutor: the scripted fake backend answers (OAK_TUTOR_FAKE=1); no model is called");
  }
  if (o.startup !== false) {
    startupTasks(deps);
    // Wave 7: families added to the content after the learner passed their lesson (the tracks' decks need nothing:
    // a deck's cards open from its lesson's completion whenever the deck arrives).
    try {
      await deps.srs()?.backfillFamilies?.();
    } catch (e) {
      log(`family backfill failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const app = buildApp(deps);
  return {
    app,
    deps,
    async close() {
      await o.graders.dispose?.();
      db.close();
    },
  };
}
