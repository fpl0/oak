// The seam between the server and the tutor service (server/src/tutor, owned by another session).
// Everything the server knows about the tutor's shape is in this file and in tutor-adapters/: the
// eight port adapters, `createDefaultTutor`, the review sink, and the status the health route reports.
// The contract routes whose wire shape differs from the tutor's own routes (timeline, usage, notes,
// card applied, note retract) are served by routes/tutor.ts and mounted before the tutor's app.
import type { BackendId } from "@oak/api";
import { lintStrict as graderStrict } from "@oak/grader";
import type { Hono } from "hono";
import type { ContentIndex } from "./content/index.ts";
import type { Repos } from "./db/repos/index.ts";
import type { GraderHosts } from "./deps.ts";
import type { Secrets } from "./secrets.ts";
import type { Services } from "./services/index.ts";
import { createDefaultTutor, type DefaultTutorDeps } from "./tutor/compose.ts";
import { createTutorApp, createTutorService, localSecurity, type TutorLogEntry } from "./tutor/index.ts";
import { type LintIssue, type LintRule, setHostStrictLint } from "./tutor/lint/strict.ts";
import type { TutorPorts } from "./tutor/ports.ts";
import type { TutorService } from "./tutor/service-types.ts";
import { FakeTutorBackend, type FakeTutorOptions } from "./tutor-adapters/fake-backend.ts";
import { GraderAdapter } from "./tutor-adapters/grader.ts";
import { LessonContextAdapter, lessonSongPort } from "./tutor-adapters/lessons.ts";
import { ProgressAdapter } from "./tutor-adapters/progress.ts";
import { reviewFactsPort, reviewW7Port } from "./tutor-adapters/review-facts.ts";
import {
  learnerClock,
  SettingsAdapter,
  SqliteConversationStore,
  SqliteNotesStore,
  SqliteUsageSink,
} from "./tutor-adapters/stores.ts";

const GRADER_RULES: ReadonlySet<string> = new Set<LintRule>([
  "lint.base.import",
  "lint.base.with",
  "lint.base.identifier",
  "lint.base.member",
  "lint.base.remote-samples",
  "lint.strict.computed-member",
  "lint.strict.this",
  "lint.strict.reserved-string",
  "lint.strict.construct",
]);

/** The grader's strict profile as tutor lint issues (an unknown id, e.g. `eval.syntax`, reads as `lint.parse`). */
export function graderStrictIssues(code: string): LintIssue[] {
  return graderStrict(code)
    .filter((d) => d.severity === "error")
    .map((d) => ({
      rule: (GRADER_RULES.has(d.id) ? d.id : "lint.parse") as LintRule,
      message: d.message,
      line: d.line,
      from: d.range.from,
      to: d.range.to,
    }));
}
// Every server that wires the tutor holds the model's code to the grader's strict profile too (review:security).
setHostStrictLint(graderStrictIssues);

export type TutorHealth = "ready" | "missing_key" | "invalid_key" | "unreachable";

export interface TutorWiring {
  /** Mount at the root: `/api/tutor/*` and the CLI backend's `/mcp/tutor`. */
  app: Hono;
  service: TutorService;
  ports: TutorPorts;
  lessons: LessonContextAdapter;
  status(): Promise<{ tutor: TutorHealth; backend: BackendId | null }>;
  /** After a key is pasted or removed, or the backend setting changes. */
  refresh(): void;
}

export interface TutorWiringDeps {
  repos: Repos;
  content: ContentIndex;
  services: Services;
  graders: GraderHosts;
  secrets: Secrets;
  now: () => Date;
  port: number;
  devPorts: readonly number[];
  /** Test and transport options passed through to `createDefaultTutor`. */
  tutor?: Pick<DefaultTutorDeps, "api" | "cli" | "idleTimeout" | "bunServer" | "heartbeatMs" | "log">;
  /**
   * Dev only (`OAK_DEV=1 OAK_TUTOR_FAKE=1`, config.ts `tutorFake`): the scripted fake backend replaces both
   * real backends, so no model is ever called (docs/design/wave2.md §5). `true` or its options.
   */
  fake?: boolean | FakeTutorOptions;
}

export function createTutorWiring(d: TutorWiringDeps): TutorWiring {
  const clock = learnerClock(d.repos, d.now);
  const lessons = new LessonContextAdapter(
    d.content,
    d.repos,
    reviewFactsPort(d.graders, d.repos),
    reviewW7Port(d.graders, d.repos),
    lessonSongPort(d.services.unitSongs),
  );
  const ports: TutorPorts = {
    grader: new GraderAdapter(d.graders.tutor, d.repos, d.content),
    conversations: new SqliteConversationStore(d.repos, clock),
    notes: new SqliteNotesStore(d.repos, clock),
    lessons,
    progress: new ProgressAdapter(d.repos, d.content, {
      course: d.services.course,
      gates: d.services.gates,
      streak: d.services.streak,
      voice: d.services.voice,
    }),
    settings: new SettingsAdapter(d.repos, clock),
    usage: new SqliteUsageSink(d.repos),
    clock,
  };
  // Wave 4 (wave4.md §5.2): an accepted capstone review lands on the album version it was about (the turn's
  // `albumTrackId` + `albumVersion`), else on the latest; its conversation is kept for `tutor.reviews`.
  const onReview: NonNullable<DefaultTutorDeps["onReview"]> = (accepted) => {
    const target = accepted.target ?? null;
    if (accepted.reviewKind === "capstone")
      d.services.library.saveCapstoneReview(accepted.subject.subjectId, accepted.review, {
        ...(target?.kind === "album" ? { trackId: target.trackId, version: target.version } : {}),
        ...(accepted.conversationId === undefined ? {} : { conversationId: accepted.conversationId }),
      });
    // c11: the review records the transcription version it was asked about.
    else
      d.services.library.saveTranscriptionReview(accepted.subject.subjectId, accepted.review, {
        ...(accepted.conversationId === undefined ? {} : { conversationId: accepted.conversationId }),
        version: target?.kind === "transcription" ? target.version : null,
      });
  };
  const tutor = d.fake
    ? fakeTutor(d, ports, onReview)
    : createDefaultTutor({
        ports,
        apiKey: () => d.secrets.anthropicKey(),
        port: d.port,
        devPorts: d.devPorts,
        onReview,
        ...(d.tutor ?? {}),
      });
  return {
    app: tutor.app,
    service: tutor.service,
    ports,
    lessons,
    async status() {
      try {
        const s = await tutor.service.status();
        return { tutor: s.tutor as TutorHealth, backend: s.active };
      } catch {
        return { tutor: "unreachable", backend: null };
      }
    },
    refresh: () => tutor.refresh(),
  };
}

/**
 * The tutor service and routes over the scripted fake backend only: the same service, redaction, card
 * validation and SSE routes as production, without the API and CLI backends (and without the CLI's MCP
 * endpoint, which only the CLI backend calls).
 */
function fakeTutor(
  d: TutorWiringDeps,
  ports: TutorPorts,
  onReview: NonNullable<DefaultTutorDeps["onReview"]>,
): { app: Hono; service: TutorService; refresh(): void } {
  const log =
    d.tutor?.log ??
    ((e: TutorLogEntry) =>
      console.error(`[tutor:fake] ${e.level}: ${e.msg}${e.detail ? ` (${e.detail})` : ""}`));
  const backend = new FakeTutorBackend(typeof d.fake === "object" ? d.fake : {});
  const service = createTutorService({ ports, backends: [backend], log, onReview });
  const app = createTutorApp({
    service,
    security: localSecurity(d.port, d.devPorts),
    log,
    basePath: "/api",
    idleTimeout: d.tutor?.idleTimeout ?? "require",
    ...(d.tutor?.bunServer === undefined ? {} : { bunServer: d.tutor.bunServer }),
    ...(d.tutor?.heartbeatMs === undefined ? {} : { heartbeatMs: d.tutor.heartbeatMs }),
  });
  return { app, service, refresh: () => service.refreshBackends() };
}
