// Everything the HTTP layer needs, built once by `createServer` (app.ts) or by a test.
import type { GraderHost } from "@oak/grader";
import type { OakConfig } from "./config.ts";
import type { ConfirmStore } from "./confirm.ts";
import type { ContentIndex } from "./content/index.ts";
import type { Db } from "./db/index.ts";
import type { Repos } from "./db/repos/index.ts";
import type { KeyValidator, Secrets } from "./secrets.ts";
import type { UpdateChecker } from "./services/app-update.ts";
import type { Clock } from "./services/context.ts";
import type { DevClock } from "./services/dev-clock.ts";
import type { Services } from "./services/index.ts";
import type { SessionPlannerPort, SrsPort } from "./services/ports.ts";
import type { TutorWiring } from "./tutor-wiring.ts";

export interface GraderHosts {
  /** `bun-worker`: the learner's own code (`POST /api/grade`, `/api/analyze`). */
  learner: () => GraderHost;
  /** `bun-subprocess`: model-written code, memory-isolated (contracts §10.A). */
  tutor: () => GraderHost;
  /** Stops the hosts that were started. */
  dispose?(): Promise<void>;
}

export interface AppDeps {
  config: OakConfig;
  db: Db;
  repos: Repos;
  content: ContentIndex;
  clock: Clock;
  /** The movable clock behind `clock` in dev (`/api/dev/clock`, `OAK_NOW`); `null` in production. */
  devClock: DevClock | null;
  services: Services;
  confirm: ConfirmStore;
  secrets: Secrets;
  keyValidator: KeyValidator;
  srs: () => SrsPort | null;
  planner: () => SessionPlannerPort | null;
  graders: GraderHosts;
  tutor: TutorWiring | null;
  /** The desktop app's "a new version is out" check (services/app-update.ts). */
  updates: UpdateChecker;
  /** Validate every JSON response against the contract (dev and tests). */
  validateResponses: boolean;
  log: (msg: string) => void;
}
