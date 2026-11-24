// `bun run e2e`: every browser suite of the repo, side by side, as fast as the machine allows. The rules every spec
// follows (what belongs in a browser test, seeds, budgets) are docs/design/wave5.md §7.1.
//
// The root playwright.config.ts runs one test at a time per process (workers: 1): the tests of one project share one
// server and one database, and dev seeds reset it. Projects have their own ports and data dirs, and
// `OAK_E2E_SHIFT=<n>` (e2e/support/stack.ts) moves every port and data dir of a process by n, so this runner can
// start several Playwright processes at once, even several of ONE project:
//
//   1. builds once (`bun scripts/content/build.ts`, `bun run build`, and the app again in development mode into
//      test-results/e2e-bundle, which every stack that allows it serves with `vite preview` instead of a Vite dev
//      server) and writes every fake-microphone fixture once, then tells the configs so (OAK_E2E_PREBUILT=1,
//      OAK_E2E_BUNDLE=<dir>): no two processes write dist/, content/.generated or a WAV another Chromium is reading;
//   2. the QUIET files first, with nothing loud beside them: the specs that measure milliseconds or cents on real
//      audio (QUIET below), `--quiet-jobs` streams at a time (default 2, longest first);
//   3. every other file, `--jobs` processes at a time (default: from the machine's performance cores and memory, 6 on this 12-core machine),
//      longest first. A project whose files add up to more than CHAIN_MINUTES is cut into SHARDS (up to MAX_SHARDS),
//      files balanced by their measured seconds, shard k on the base shift + 100·k, so no serial chain sets the
//      floor of the run. This pass records no Playwright trace;
//   4. a test that failed (or did not run) is run again alone, traced (its whole file if the file is serial, or if
//      a helper declares the test). The alone outcome is the one that counts; one that passes only alone is listed by
//      name as load-sensitive and still fails the run (fix it, or move its file to QUIET with the evidence): never
//      hidden;
//   5. the budgets: minutes of test time per project (e2e/budgets.json) against this run; more than 15 % over a
//      budget, or the whole suite over its total, fails the run. The total applies whenever the run was given every
//      test the config lists, whatever the arguments were (`-- --trace on` filters nothing: the total holds).
//
// Every listed test is accounted for: the summary names each failed test, each one that never ran (a serial file
// stopped early, a web server that did not start, a dead process) and each skip the spec asked for, and prints the
// counts per project, which must add up to the listing.
//
//   bun run e2e                          everything
//   bun run e2e --jobs 3                 at most three processes at once (a shared machine)
//   bun run e2e --project lesson         only these projects (repeatable); their budgets are checked
//   bun run e2e --project lesson --no-budget   the budget table is printed, not enforced (a partial run)
//   bun run e2e --since origin/main      only the projects that cover the paths changed since that ref (committed,
//                                        staged, unstaged and untracked); a shared path selects everything
//   bun run e2e --file app/src/lesson/e2e/a.pw.ts   only these spec files (repeatable; `bun run e2e:changed`,
//                                        scripts/changed.ts, passes the specs a change affects); a partial run
//   bun run e2e --shift 300              every port and data dir moved by 300 (a second run beside a first one)
//   bun run e2e --quiet-jobs 1           the quiet files one unit at a time
//   bun run e2e --no-bundle              every stack on a Vite dev server (as an area run alone does)
//   bun run e2e --plan                   print the plan (units, shards, files) and exit
//   bun run e2e -- --grep foo            anything after `--` goes to every Playwright process (a filter makes the
//                                        run partial; `-- --trace on` does not)
//   bun run e2e:serial                   the old way: one Playwright process, one test at a time
//
// Logs: test-results/e2e-logs/<unit>.log. Durations: test-results/e2e-durations.json (per project and per file; the
// next run balances its shards with them). The last line printed is `E2E TOTAL: …`; the exit code is 0 only when
// nothing failed, nothing was left unrun, nothing failed only under load and no budget was exceeded.
//
//   bun run e2e --config <file>          another config (the runner's own failure fixtures): its state is kept
//                                        beside that file, Oak's build is skipped, and the budgets are a
//                                        budgets.json beside it (none: not checked)
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startLoadProfile } from "./e2e-load.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const playwright = `${root}node_modules/.bin/playwright`;

/**
 * The config every Playwright process runs and where the run keeps its logs, reports and durations. The root config
 * by default; `--config <file>` points the runner at another one (the runner's own failure fixtures), which keeps
 * its state beside that file and skips Oak's build.
 */
const where = {
  config: `${root}playwright.config.ts`,
  configDir: root,
  logs: `${root}test-results/e2e-logs`,
  out: `${root}test-results/e2e-out`,
  durations: `${root}test-results/e2e-durations.json`,
};
/**
 * A run on a shifted base (`--shift n`, a second run beside a first one) keeps its logs and reports apart
 * (`e2e-logs-s<n>`, `e2e-out-s<n>`), so it never wipes another run's, and writes its durations beside the main file
 * (`e2e-durations-s<n>.json`): the shard plan of the main run reads only the main run's own measurements.
 */
function shiftState(shift: number): void {
  if (shift === 0) return;
  const s = `-s${shift}`;
  where.logs += s;
  where.out += s;
  durationsOut = where.durations.replace(/\.json$/, `${s}.json`);
}
let durationsOut: string | null = null;
function pointAt(file: string): void {
  const config = resolve(root, file);
  const dir = dirname(config);
  Object.assign(where, {
    config,
    configDir: `${dir}/`,
    logs: `${dir}/.e2e-state/logs`,
    out: `${dir}/.e2e-state/out`,
    durations: `${dir}/.e2e-state/durations.json`,
  });
}

/** A serial chain longer than this (minutes) is cut into shards. */
const CHAIN_MINUTES = 7;
const MAX_SHARDS = 6;
/** Shard k of a project runs on the base shift + SHARD_STEP·k (every standard port lies in a window under 100). */
const SHARD_STEP = 100;
/**
 * No test should take longer unless it measures real time (docs/design/wave5.md §7.1): the run lists every one that
 * does.
 */
const TEST_CEILING_S = 60;
/** Minutes of test time per project, enforced at the end of every run (`--no-budget` opts out). */
const BUDGETS_FILE = `${root}e2e/budgets.json`;
/**
 * Projects never traced, not even in the alone re-run of a failure: strudel-gesture tests that audio stays locked
 * until a real gesture, and a trace snapshot runs script with a user activation, which would unlock it.
 */
const NEVER_TRACED = new Set(["strudel-gesture"]);

/**
 * The files that measure time or pitch on real audio: they run first, with nothing loud beside them. "all" is the
 * whole project. The other files of these projects run in the loud pool like any other.
 */
const QUIET: Record<string, "all" | string[]> = {
  audio: [
    "packages/audio/e2e/ab-gate.pw.ts",
    "packages/audio/e2e/bleed.pw.ts",
    "packages/audio/e2e/hum.pw.ts",
    "packages/audio/e2e/mic.pw.ts",
    "packages/audio/e2e/stretch.pw.ts",
    "packages/audio/e2e/stretch-player.pw.ts",
  ],
  "strudel-autoplay": ["packages/strudel/e2e/sounds.pw.ts", "packages/strudel/e2e/editors.pw.ts"],
  "strudel-gesture": ["packages/strudel/e2e/editors.pw.ts"],
  // The pitch gate, the pitch-match trials and the bleed check read the fake microphone frame by frame.
  voice: [
    "app/src/voice/e2e/gate.pw.ts",
    "app/src/voice/e2e/settings.pw.ts",
    "app/src/voice/e2e/bleed.pw.ts",
  ],
  transcribe: [
    "app/src/transcribe/e2e/ab-drift.pw.ts",
    "app/src/transcribe/e2e/hum.pw.ts",
    "app/src/transcribe/e2e/own-audio.pw.ts",
  ],
  // The drift at 0.25×–1× and the click at the A/B switch, measured on the captured audio.
  "review-studio": ["app/src/album/e2e/transcribe.pw.ts"],
  // Failed beside three other suites and passed alone (Wave 5 test-speed runs): the metronome's level on the
  // master bus, and the playhead, roll and staff lit in time.
  workbench: ["app/src/workbench/e2e/loop.pw.ts", "app/src/workbench/e2e/workbench.pw.ts"],
};

/**
 * Quiet projects whose measurement moved toward its gate with another quiet stream beside it: their quiet unit runs
 * with nothing at all beside it. review-studio: the drift at 0.25×, bar 0, went from −7.6 ms alone to −15.6 ms beside
 * a second quiet stream (gate 20 ms; docs/design/wave5.md §7.1).
 */
export const QUIET_ALONE = new Set(["review-studio"]);

/**
 * `--since`: which projects cover a changed path. Checked in order; the first prefix that matches decides. A path
 * inside a project's own test folder always selects that project; a path no rule names selects EVERYTHING (a shared
 * path: the stack, the server's core, the app's shell, the build). NONE selects nothing (documentation).
 */
const ALL = "*";
const NONE: string[] = [];
const LESSON_PATH = ["lesson", "journey", "review", "ui-review"];
const SESSION_PATH = ["session", "session-seeds", "map", "journey", "review"];
const DRILL_PATH = ["drills", "session-seeds", "journey", "review"];
const CAPSTONE_PATH = ["capstone", "review-studio", "ui-review", "journey"];
const VOICE_PATH = ["voice", "onboarding", "audio", "drills", "journey", "review"];
const WORKBENCH_PATH = ["workbench", "studio", "workbench-w3", "ui-review", "lesson", "journey", "platform"];
const CONTENT_PATH = [
  "lesson",
  "answers",
  "drills",
  "session-seeds",
  "capstone",
  "transcribe",
  "journey",
  "review",
  "ui-review",
];
export const SINCE_MAP: [prefix: string, projects: string[] | typeof ALL][] = [
  ["docs/", NONE],
  ["content/STYLE.md", NONE],
  ["content/AUTHORING.md", NONE],
  ["README", NONE],
  ["spikes/", NONE],
  ["app/playwright.config.ts", ["app"]],
  ["app/src/lesson/", LESSON_PATH],
  ["app/src/routes/learn/", LESSON_PATH],
  ["app/src/routes/checkpoint/", LESSON_PATH],
  ["app/src/answers/", ["answers", ...LESSON_PATH, "drills"]],
  ["app/src/drills/", DRILL_PATH],
  ["app/src/routes/practice/", DRILL_PATH],
  ["packages/drills/", DRILL_PATH],
  ["packages/srs/", [...DRILL_PATH, "session"]],
  ["content/families.ts", DRILL_PATH],
  ["content/decks/", DRILL_PATH],
  ["content/gym/", [...DRILL_PATH, "transcribe"]],
  ["app/src/session/", SESSION_PATH],
  ["app/src/map/", SESSION_PATH],
  ["app/src/routes/session/", SESSION_PATH],
  ["app/src/routes/index.tsx", SESSION_PATH],
  ["app/src/routes/progress.tsx", SESSION_PATH],
  ["app/src/routes/oak.tsx", [...SESSION_PATH, "ui-review"]],
  ["app/src/routes/dev/", [...SESSION_PATH, "platform"]],
  ["app/src/capstone/", CAPSTONE_PATH],
  ["app/src/album/", CAPSTONE_PATH],
  ["app/src/routes/capstone/", CAPSTONE_PATH],
  ["app/src/routes/album/", CAPSTONE_PATH],
  ["content/capstones.ts", [...CAPSTONE_PATH, "session-seeds"]],
  ["app/src/tutor/", ["tutor", "ui-review", "lesson", "journey"]],
  ["server/src/tutor/", ["tutor", "ui-review", "lesson", "journey"]],
  ["scripts/tutor/", ["tutor"]],
  ["app/src/lib/tutor-stream.ts", ["tutor", "ui-review", "journey"]],
  ["app/src/routes/settings/tutor.tsx", ["tutor", "kit"]],
  ["app/src/transcribe/", ["transcribe", "review-studio", "journey"]],
  ["app/src/routes/transcribe/", ["transcribe", "review-studio", "journey"]],
  ["content/repertoire/", ["transcribe", "review-studio", "capstone", "journey"]],
  ["app/src/workbench/", WORKBENCH_PATH],
  ["app/src/studio/", WORKBENCH_PATH],
  ["app/src/toolbox/", WORKBENCH_PATH],
  ["app/src/routes/studio/", WORKBENCH_PATH],
  ["app/src/routes/toolbox/", WORKBENCH_PATH],
  ["app/src/voice/", VOICE_PATH],
  ["app/src/onboarding/", VOICE_PATH],
  ["app/src/routes/onboarding/", VOICE_PATH],
  ["app/src/lib/mic", [...VOICE_PATH, "platform"]],
  ["app/src/routes/settings_.voice.setup.tsx", VOICE_PATH],
  ["app/src/routes/settings/voice.tsx", VOICE_PATH],
  ["app/src/routes/settings/audio.tsx", VOICE_PATH],
  ["packages/audio/", [...VOICE_PATH, "transcribe", "review-studio", "capstone"]],
  ["packages/pitch/", VOICE_PATH],
  ["app/src/ui/review/", ["ui-review"]],
  ["packages/notation/", ["notation", "lesson", "drills", "answers", "ui-review", "journey", "review"]],
  ["packages/strudel/", ALL],
  ["sounds/", ALL],
  ["scripts/sounds/", ["strudel-autoplay", "strudel-gesture", "platform"]],
  ["packages/grader/", CONTENT_PATH],
  ["packages/theory/", CONTENT_PATH],
  ["packages/content-kit/", CONTENT_PATH],
  ["content/core/", ["lesson", "journey", "review", "session-seeds", "ui-review"]],
  ["content/checkpoints.ts", ["lesson", "journey", "review", "session-seeds"]],
  ["content/bands/", ["lesson", "capstone", "transcribe", "strudel-autoplay"]],
];

export interface Project {
  name: string;
  /** Spec files (repo-relative) with their test counts, from `playwright test --list`. */
  files: Map<string, number>;
  /** The web servers it starts (projects that share one share a process). */
  servers: string[];
  /** Its own test folder (repo-relative), for `--since`. */
  testDir: string;
}
export interface Unit {
  name: string;
  projects: string[];
  /** Files to run (repo-relative); empty = every file of the projects. */
  files: string[];
  quiet: boolean;
  shift: number;
  /** Expected minutes (for ordering). */
  weight: number;
}
/**
 * What became of one listed test. `notRun`: it never ran: a serial file stopped before it, its web server did not
 * start, the process died, or no report of it came back at all. `skipped` is only a skip the spec asked for
 * (`test.skip`, `test.fixme`).
 */
export type Outcome = "passed" | "failed" | "flaky" | "skipped" | "notRun";
export const OUTCOMES: readonly Outcome[] = ["passed", "failed", "flaky", "skipped", "notRun"];
/** One listed test: `project › file › describe › title` (file repo-relative). */
export type TestKey = string;
export interface Listed {
  key: TestKey;
  project: string;
  file: string;
  /** The line of the test in the file that declares it (`file:line` re-runs exactly that test). */
  line?: number;
  /**
   * The file that declares the test, when it is not `file`: a helper the spec calls (w3walk.ts declares the tests
   * walk-u03a.pw.ts owns). `line` is then a line of the helper, and `file:line` selects nothing.
   */
  declaredIn?: string;
}
interface Result {
  unit: Unit;
  exit: number;
  minutes: number;
  /** The final outcome of every test the unit was given (the alone re-run's, for the files it re-ran). */
  outcomes: Map<TestKey, Outcome>;
  /** Errors outside any test (a web server that did not start, a config error), from the deciding run. */
  errors: string[];
  /** Failed beside other suites, passed alone (by name; units whose web server failed only under load too). */
  loadSensitive: string[];
}
export interface Durations {
  generated: string;
  /** Minutes of test time per project. */
  projects: Record<string, number>;
  /** Seconds of test time per `project › file`. */
  files: Record<string, number>;
  /** Seconds per `project › file › test title` (the last run of each). */
  tests?: Record<string, number>;
}

// --- arguments ---------------------------------------------------------------------------------------------------

interface Args {
  jobs: number | "auto";
  quietJobs: number;
  only: Set<string> | null;
  since: string | null;
  /** `--file`: only these spec files (repo-relative), in whichever projects list them. */
  files: Set<string> | null;
  shift: number;
  plan: boolean;
  config: string | null;
  /** Check the budgets (e2e/budgets.json) and fail the run on an excess; `--no-budget` only prints the table. */
  budget: boolean;
  /** Serve the prebuilt development bundle to every stack that allows it; `--no-bundle` keeps the Vite dev servers. */
  bundle: boolean;
  rest: string[];
}

export function parseArgs(argv: string[]): Args {
  const a: Args = {
    jobs: "auto",
    quietJobs: 2,
    only: null,
    since: null,
    files: null,
    shift: Number(process.env.OAK_E2E_SHIFT ?? 0),
    plan: false,
    config: null,
    budget: true,
    bundle: true,
    rest: [],
  };
  const only = new Set<string>();
  const files = new Set<string>();
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const [flag, inline] = arg.includes("=")
      ? (arg.split(/=(.*)/s, 2) as [string, string])
      : [arg, undefined];
    const take = (): string => inline ?? value(i++, flag);
    if (arg === "--") {
      a.rest.push(...argv.slice(i + 1));
      break;
    } else if (flag === "--jobs") {
      const v = take();
      a.jobs = v === "auto" ? "auto" : Number(v);
    } else if (flag === "--quiet-jobs") a.quietJobs = Number(take());
    else if (flag === "--project") only.add(take());
    else if (flag === "--since") a.since = take();
    else if (flag === "--file") files.add(take().replace(/^\.\//, ""));
    else if (flag === "--shift") a.shift = Number(take());
    else if (flag === "--plan") a.plan = true;
    else if (flag === "--config") a.config = take();
    else if (arg === "--no-budget") a.budget = false;
    else if (arg === "--no-bundle") a.bundle = false;
    else a.rest.push(arg);
  }
  if (a.jobs !== "auto" && (!Number.isInteger(a.jobs) || a.jobs < 1))
    throw new Error("--jobs must be a positive integer or auto");
  if (!Number.isInteger(a.quietJobs) || a.quietJobs < 1)
    throw new Error("--quiet-jobs must be a positive integer");
  if (
    !Number.isInteger(a.shift) ||
    a.shift < 0 ||
    a.shift % 10 !== 0 ||
    a.shift + SHARD_STEP * MAX_SHARDS >= 5000
  )
    throw new Error("--shift must be a multiple of 10 in 0–4590");
  a.only = only.size > 0 ? only : null;
  a.files = files.size > 0 ? files : null;
  return a;
}

/**
 * Processes at once, from the machine's size, never from the load at start (a load average lags by minutes and
 * halved the pool on an idle machine). Measured in Wave 7 Foundation (docs/design/wave7.md §7.2, the load profile of
 * scripts/e2e-load.ts): a loud unit uses about 0.55 cores alone but about 1 core beside seven others, and at 8 jobs on
 * this 12-core machine (8 performance + 4 efficiency cores) the loud pool ran at 89 % of all cores busy, load 17,
 * with every file ~20 % slower than at 6 jobs (163 against 135 minutes of test time) for the SAME pool wall time
 * (21.6 against 21.7 minutes): the extra processes only queued for cores. So: three quarters of the performance cores
 * where the machine reports them (`hw.perflevel0.physicalcpu`), else half the cores; at most one per 3 GB; 2 to 10.
 * A shared machine passes `--jobs`.
 */
export function autoJobs(
  cores: number = availableParallelism(),
  memBytes: number = totalmem(),
  perfCores: number | null = performanceCores(),
): number {
  const byCpu = perfCores ? Math.floor((perfCores * 3) / 4) : Math.floor(cores / 2);
  const byMem = Math.floor(memBytes / 2 ** 30 / 3);
  return Math.max(2, Math.min(10, byCpu, byMem));
}
/** The machine's performance cores (Apple silicon `hw.perflevel0.physicalcpu`), or `null` where it has no such split. */
export function performanceCores(): number | null {
  if (process.platform !== "darwin") return null;
  const r = spawnSync("sysctl", ["-n", "hw.perflevel0.physicalcpu"], { encoding: "utf8" });
  const n = Number(r.stdout?.trim());
  return r.status === 0 && Number.isInteger(n) && n > 0 ? n : null;
}

// --- discovery ---------------------------------------------------------------------------------------------------

/** The shape `--list --reporter json` and the JSON reporter share (only what the runner reads). */
interface ReportResult {
  status?: string;
  duration: number;
  annotations?: { type: string }[];
}
interface ReportTest {
  projectName: string;
  status?: string;
  annotations?: { type: string }[];
  results: ReportResult[];
}
interface ReportSuite {
  file?: string;
  title?: string;
  /** A spec's own `file` is the file that declares the test: a helper's, when the spec file calls one. */
  specs?: { title: string; file?: string; line?: number; tests: ReportTest[] }[];
  suites?: ReportSuite[];
}
interface Report {
  suites?: ReportSuite[];
  errors?: { message?: string }[];
}

/** Every test of a report (or a listing) with its key, project and repo-relative file. */
export function eachTest(
  report: Report,
  rel: (file: string) => string = relFile,
): (Listed & { test: ReportTest })[] {
  const out: (Listed & { test: ReportTest })[] = [];
  const walk = (s: ReportSuite, file: string, path: string[]): void => {
    for (const spec of s.specs ?? []) {
      const declaredIn = spec.file === undefined ? file : rel(spec.file);
      for (const t of spec.tests)
        out.push({
          key: `${t.projectName} › ${file} › ${[...path, spec.title].join(" › ")}`,
          project: t.projectName,
          file,
          ...(spec.line !== undefined ? { line: spec.line } : {}),
          ...(declaredIn !== file ? { declaredIn } : {}),
          test: t,
        });
    }
    for (const c of s.suites ?? []) walk(c, file, c.title ? [...path, c.title] : path);
  };
  for (const s of report.suites ?? []) walk(s, rel(s.file ?? ""), []);
  return out;
}

type Listing = Report & { config: { projects: { name: string; testDir: string }[] } };

/** `playwright test --list` of the config, narrowed by `rest` exactly as a run with those arguments is. */
function list(shift: number, rest: string[]): Listing {
  const env = { ...process.env, OAK_E2E_SHIFT: String(shift), FORCE_COLOR: "0" };
  const listing = spawnSync(
    playwright,
    ["test", "-c", where.config, "--list", "--reporter", "json", ...rest],
    {
      cwd: root,
      env,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  if (listing.status !== 0)
    throw new Error(`playwright test --list failed:\n${listing.stderr}${listing.stdout}`);
  // A spec that imports Strudel at load time prints its banner ("@strudel/core loaded") to stdout ahead of the
  // JSON report: parse from the report's first line.
  const at = listing.stdout.search(/^\{/m);
  return JSON.parse(at > 0 ? listing.stdout.slice(at) : listing.stdout) as Listing;
}

/**
 * Every project with its spec files and test counts, and its web servers, from the config itself. `whole` is every
 * test the config lists with no pass-through at all: what "the whole suite" means (wholeSuite).
 */
async function discover(
  shift: number,
  rest: string[],
): Promise<{ projects: Map<string, Project>; listed: Listed[]; whole: TestKey[] }> {
  // The pass-through (`-- --grep x`) narrows the listing exactly as it narrows the runs.
  const json = list(shift, rest);
  const whole = [...new Set(eachTest(rest.length === 0 ? json : list(shift, [])).map((t) => t.key))];
  const projects = new Map<string, Project>();
  for (const p of json.config.projects)
    projects.set(p.name, {
      name: p.name,
      files: new Map(),
      servers: [],
      testDir: p.testDir.startsWith(root) ? p.testDir.slice(root.length) : p.testDir,
    });
  const listed: Listed[] = [];
  for (const t of eachTest(json)) {
    const p = projects.get(t.project);
    if (!p) continue;
    p.files.set(t.file, (p.files.get(t.file) ?? 0) + 1);
    listed.push({
      key: t.key,
      project: t.project,
      file: t.file,
      ...(t.line !== undefined ? { line: t.line } : {}),
      ...(t.declaredIn !== undefined ? { declaredIn: t.declaredIn } : {}),
    });
  }

  // The web servers: the same convention the root config uses (process.env is this runner's, so set the shift).
  process.env.OAK_E2E_SHIFT = String(shift);
  process.env.OAK_E2E_PREBUILT = "1";
  const { projectServers } = (await import(where.config)) as {
    projectServers: Record<string, string[]>;
  };
  for (const [name, servers] of Object.entries(projectServers)) {
    const p = projects.get(name);
    if (p) p.servers = servers;
  }
  return { projects, listed, whole };
}

/**
 * Whether a run is the whole suite: every test the config lists is among the tests the run was given. Decided from
 * the selection itself, never from how the arguments look: `-- --trace on` or `-- --workers 1` select every test (the
 * total budget holds); `--project`, `--since`, `-- -g`, `-- --grep-invert`, `-- --shard`, `-- --only-changed` or a
 * file after `--` leave some out (a partial run: the total does not apply).
 */
export function wholeSuite(given: Iterable<TestKey>, whole: Iterable<TestKey>): boolean {
  const g = new Set(given);
  for (const k of whole) if (!g.has(k)) return false;
  return true;
}

/** A spec path as a JSON report gives it (relative to the config's folder, or absolute) → repo-relative. */
function relFile(f: string): string {
  return relative(root, resolve(where.configDir, f));
}

// --- --since -----------------------------------------------------------------------------------------------------

function changedPaths(ref: string): string[] {
  const git = (args: string[]): string[] => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.split("\n").filter(Boolean);
  };
  const base = git(["merge-base", ref, "HEAD"])[0] ?? ref;
  return [
    ...new Set([
      ...git(["diff", "--name-only", base]),
      ...git(["ls-files", "--others", "--exclude-standard"]),
    ]),
  ].sort();
}

/** The projects that cover these paths, with the reason for each (`ALL` when a shared path is among them). */
export function projectsFor(
  paths: string[],
  projects: Map<string, Project>,
): { selected: Set<string> | typeof ALL; why: string[] } {
  const selected = new Set<string>();
  const why: string[] = [];
  for (const path of paths) {
    // A file in a project's own test folder (its specs, helpers, fixtures, config).
    const own = [...projects.values()].filter(
      (p) => p.testDir && (path.startsWith(`${p.testDir}/`) || p.files.has(path)),
    );
    if (own.length > 0) {
      for (const p of own) selected.add(p.name);
      why.push(`${path} → ${own.map((p) => p.name).join(", ")} (its own tests)`);
      continue;
    }
    const rule = SINCE_MAP.find(([prefix]) => path.startsWith(prefix));
    if (!rule) {
      why.push(`${path} → everything (a shared path)`);
      return { selected: ALL, why };
    }
    const [, to] = rule;
    if (to === ALL) {
      why.push(`${path} → everything (${rule[0]})`);
      return { selected: ALL, why };
    }
    for (const p of to) if (projects.has(p)) selected.add(p);
    if (to.length > 0) why.push(`${path} → ${to.join(", ")}`);
  }
  return { selected, why };
}

// --- --file ------------------------------------------------------------------------------------------------------

/**
 * `--file`: keeps only these spec files in every project (in place). `unknown` are the files no project lists;
 * `narrowed` the projects that lost a file (their measured minutes are not a whole project's).
 */
export function narrowToFiles(
  projects: Map<string, Project>,
  files: Set<string>,
): { unknown: string[]; narrowed: Set<string> } {
  const listed = new Set([...projects.values()].flatMap((p) => [...p.files.keys()]));
  const narrowed = new Set<string>();
  for (const p of projects.values())
    for (const f of [...p.files.keys()])
      if (!files.has(f)) {
        p.files.delete(f);
        narrowed.add(p.name);
      }
  return { unknown: [...files].filter((f) => !listed.has(f)).sort(), narrowed };
}

/** A unit planned with every file of its projects (`files: []`) names them when the projects were narrowed. */
export function pinFiles(units: Unit[], projects: Map<string, Project>): void {
  for (const u of units)
    if (u.files.length === 0)
      u.files = [...new Set(u.projects.flatMap((p) => [...(projects.get(p)?.files.keys() ?? [])]))];
}

// --- planning ----------------------------------------------------------------------------------------------------

function readDurations(): Durations {
  const empty: Durations = { generated: "", projects: {}, files: {} };
  try {
    const raw = JSON.parse(readFileSync(where.durations, "utf8")) as Partial<Durations> &
      Record<string, unknown>;
    if (raw.files && raw.projects) return raw as Durations;
    // The first runner's format: { project: minutes }.
    return { ...empty, projects: raw as unknown as Record<string, number> };
  } catch {
    return empty;
  }
}

/** Seconds a file is expected to take: measured, else its project's average per test, else 20 s a test. */
function fileSeconds(d: Durations, p: Project, file: string): number {
  const measured = d.files[`${p.name} › ${file}`];
  if (measured !== undefined) return measured;
  const tests = [...p.files.values()].reduce((s, n) => s + n, 0);
  const minutes = d.projects[p.name];
  const perTest = minutes !== undefined && tests > 0 ? (minutes * 60) / tests : 20;
  return perTest * (p.files.get(file) ?? 1);
}

/** Projects that share a web server share a process (a second process could not bind the port). */
function groups(projects: Project[]): Project[][] {
  const parent = new Map(projects.map((p) => [p.name, p.name]));
  const find = (n: string): string => {
    let r = n;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    return r;
  };
  const owner = new Map<string, string>();
  for (const p of projects)
    for (const s of p.servers) {
      const prev = owner.get(s);
      if (prev) parent.set(find(p.name), find(prev));
      else owner.set(s, p.name);
    }
  const out = new Map<string, Project[]>();
  for (const p of projects) out.set(find(p.name), [...(out.get(find(p.name)) ?? []), p]);
  return [...out.values()];
}

/** Longest-processing-time-first: each file to the lightest shard so far. */
export function balance(files: [string, number][], n: number): { files: string[]; seconds: number }[] {
  const shards = Array.from({ length: n }, () => ({ files: [] as string[], seconds: 0 }));
  for (const [f, s] of [...files].sort((a, b) => b[1] - a[1])) {
    const lightest = shards.reduce((m, x) => (x.seconds < m.seconds ? x : m));
    lightest.files.push(f);
    lightest.seconds += s;
  }
  return shards.filter((s) => s.files.length > 0);
}

export function plan(projects: Project[], d: Durations, shift: number): Unit[] {
  const units: Unit[] = [];
  for (const group of groups(projects)) {
    const name = group.map((p) => p.name).join("+");
    const seconds = new Map<string, number>();
    for (const p of group)
      for (const f of p.files.keys()) seconds.set(f, (seconds.get(f) ?? 0) + fileSeconds(d, p, f));
    const quietFiles = new Set<string>();
    for (const p of group) {
      const q = QUIET[p.name];
      if (q === "all") for (const f of p.files.keys()) quietFiles.add(f);
      else if (q) for (const f of q) if (p.files.has(f)) quietFiles.add(f);
    }
    const quiet = [...seconds].filter(([f]) => quietFiles.has(f));
    const loud = [...seconds].filter(([f]) => !quietFiles.has(f));
    const minutes = (xs: [string, number][]): number => xs.reduce((s, [, v]) => s + v, 0) / 60;
    const all = quiet.length === 0 || loud.length === 0;
    if (quiet.length > 0)
      units.push({
        name: loud.length > 0 ? `${name}.quiet` : name,
        projects: group.map((p) => p.name),
        files: all ? [] : quiet.map(([f]) => f),
        quiet: true,
        shift,
        weight: minutes(quiet),
      });
    if (loud.length === 0) continue;
    // A project alone on its servers can be cut into shards; a shared stack cannot (one process owns its ports).
    const n =
      group.length === 1
        ? Math.min(MAX_SHARDS, loud.length, Math.max(1, Math.ceil(minutes(loud) / CHAIN_MINUTES)))
        : 1;
    if (n === 1) {
      units.push({
        name: quiet.length > 0 ? `${name}.loud` : name,
        projects: group.map((p) => p.name),
        files: all ? [] : loud.map(([f]) => f),
        quiet: false,
        shift,
        weight: minutes(loud),
      });
      continue;
    }
    const shards = balance(loud, n);
    for (const [k, s] of shards.entries())
      units.push({
        name: `${name}.${k + 1}of${shards.length}`,
        projects: group.map((p) => p.name),
        files: s.files,
        quiet: false,
        shift: shift + SHARD_STEP * k,
        weight: s.seconds / 60,
      });
  }
  return units;
}

// --- running -----------------------------------------------------------------------------------------------------

function run(command: string, args: string[], logFile: string, env: Record<string, string>): Promise<number> {
  return new Promise((resolve) => {
    const log = createWriteStream(logFile, { flags: "a" });
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: "0", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on("close", (code) => log.end(() => resolve(code ?? 1)));
    child.on("error", () => log.end(() => resolve(1)));
  });
}

/**
 * One test's outcome from the JSON reporter. A test with no result, or one Playwright reports "skipped" without a
 * skip the spec asked for (the rest of a serial file after a failure), or one interrupted, did not run.
 */
export function outcomeOf(t: ReportTest): Outcome {
  if (t.results.length === 0) return "notRun";
  if (t.results.some((r) => r.status === "interrupted")) return "notRun";
  if (t.status === "expected") return "passed";
  if (t.status === "flaky") return "flaky";
  if (t.status === "unexpected") return "failed";
  const asked = [...(t.annotations ?? []), ...t.results.flatMap((r) => r.annotations ?? [])].some(
    (a) => a.type === "skip" || a.type === "fixme",
  );
  return asked ? "skipped" : "notRun";
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A Playwright file filter that matches exactly this repo-relative file. */
const fileFilter = (f: string): string => `${escapeRe(`${root}${f}`)}$`;

interface Times {
  /** Seconds per `project › file`. */
  files: Record<string, number>;
  /** Seconds per `project › file › title`. */
  tests: Record<string, number>;
}
interface RunReport {
  exit: number;
  /** Every test the report names, with its outcome. */
  outcomes: Map<TestKey, Outcome>;
  /** Errors outside any test (the web server, the config, a global hook). */
  errors: string[];
  times: Times;
}

/** Reads a JSON report: outcomes, errors outside tests, and seconds per file and per test. */
export function readReport(report: Report, exit: number): RunReport {
  const out: RunReport = {
    exit,
    outcomes: new Map(),
    errors: (report.errors ?? []).map((e) => (e.message ?? "an error").split("\n")[0] as string),
    times: { files: {}, tests: {} },
  };
  for (const t of eachTest(report)) {
    out.outcomes.set(t.key, outcomeOf(t.test));
    if (t.test.results.length === 0) continue;
    const sec = t.test.results.reduce((sum, r) => sum + r.duration, 0) / 1000;
    const fileKey = `${t.project} › ${t.file}`;
    out.times.files[fileKey] = (out.times.files[fileKey] ?? 0) + sec;
    out.times.tests[t.key] = sec;
  }
  return out;
}

/**
 * The outcome of every test a run was given: what its report says, and `notRun` for each one the report does not
 * name at all (the process died, or its web server never started). A run that exits non-zero with every test
 * accounted for and passed, and no error named, still fails: the exit code is kept as an error.
 */
export function settle(
  expected: Listed[],
  r: RunReport,
): { outcomes: Map<TestKey, Outcome>; errors: string[] } {
  const outcomes = new Map<TestKey, Outcome>();
  for (const t of expected) outcomes.set(t.key, r.outcomes.get(t.key) ?? "notRun");
  // A test the listing did not have (a spec saved mid-run) still counts.
  for (const [k, o] of r.outcomes) if (!outcomes.has(k)) outcomes.set(k, o);
  const errors = [...r.errors];
  const bad = [...outcomes.values()].some((o) => o === "failed" || o === "notRun");
  if (r.exit !== 0 && errors.length === 0 && !bad)
    errors.push(`Playwright exited ${r.exit} with no failed test`);
  return { outcomes, errors };
}

/**
 * After the alone re-run of some tests: the alone outcome replaces the first one for every test that was run again.
 * A test is load-sensitive only if it FAILED beside other suites and PASSED alone; one that fails, or cannot run,
 * alone is a failure, whatever it did before.
 */
export function merge(
  first: { outcomes: Map<TestKey, Outcome>; errors: string[] },
  alone: { outcomes: Map<TestKey, Outcome>; errors: string[] },
  rerun: Set<TestKey>,
): { outcomes: Map<TestKey, Outcome>; errors: string[]; loadSensitive: string[] } {
  const outcomes = new Map(first.outcomes);
  const loadSensitive: string[] = [];
  for (const [k, before] of first.outcomes) {
    if (!rerun.has(k)) continue;
    const after = alone.outcomes.get(k) ?? "notRun";
    outcomes.set(k, after);
    if (before === "failed" && (after === "passed" || after === "flaky")) loadSensitive.push(k);
  }
  for (const [k, o] of alone.outcomes) if (!outcomes.has(k)) outcomes.set(k, o);
  if (first.errors.length > 0 && alone.errors.length === 0)
    loadSensitive.push(...first.errors.map((e) => `(beside other suites: ${e})`));
  return { outcomes, errors: alone.errors, loadSensitive };
}

/** Counts per project; every listed test lands in exactly one column. */
export function tally(outcomes: Map<TestKey, Outcome>): Map<string, Record<Outcome, number>> {
  const out = new Map<string, Record<Outcome, number>>();
  for (const [k, o] of outcomes) {
    const p = k.split(" › ")[0] as string;
    const row = out.get(p) ?? { passed: 0, failed: 0, flaky: 0, skipped: 0, notRun: 0 };
    row[o]++;
    out.set(p, row);
  }
  return out;
}

/** A serial file (`test.describe.serial`, `mode: "serial"`): its tests share state, so it is re-run whole. */
export const SERIAL_RE = /describe\.serial\b|mode:\s*["']serial["']/;

/**
 * What the alone re-run runs, from the tests that failed or did not run beside other suites: in a serial file, every
 * test of the file (each depends on the ones before it); elsewhere exactly those tests (`file:line`, so the tests
 * that passed are not paid for twice). A test a helper declares (`declaredIn`) has no `file:line` of its own (the
 * line is the helper's, and Playwright matches a line against the declaring file): its whole owning spec file runs
 * again. A file is serial when its own source says so, or the source of a helper that declares its tests (the walk
 * helpers set the mode for the spec that calls them). `tests` are the unit's listed tests; `keys` are the tests whose
 * outcome the re-run decides.
 */
export function rerunPlan(
  bad: TestKey[],
  tests: Listed[],
  isSerial: (file: string) => boolean,
): { filters: string[]; keys: Set<TestKey> } {
  const byKey = new Map(tests.map((t) => [t.key, t]));
  const badFiles = new Set<string>();
  for (const k of bad) badFiles.add(byKey.get(k)?.file ?? (k.split(" › ")[1] as string));
  const filters: string[] = [];
  const keys = new Set<TestKey>();
  for (const file of [...badFiles].sort()) {
    const mine = bad.map((k) => byKey.get(k)).filter((t): t is Listed => t?.file === file);
    const lines = mine.map((t) => t.line);
    const helpers = new Set(tests.flatMap((t) => (t.file === file && t.declaredIn ? [t.declaredIn] : [])));
    const serial = isSerial(file) || [...helpers].some(isSerial);
    const elsewhere = mine.some((t) => t.declaredIn !== undefined);
    if (serial || elsewhere || mine.length === 0 || lines.some((l) => l === undefined)) {
      filters.push(fileFilter(file));
      for (const t of tests) if (t.file === file) keys.add(t.key);
      for (const k of bad) if ((byKey.get(k)?.file ?? k.split(" › ")[1]) === file) keys.add(k);
      continue;
    }
    for (const line of [...new Set(lines as number[])].sort((a, b) => a - b)) {
      filters.push(`${fileFilter(file)}:${line}`);
      // Tests made in a loop share a line: all of them run again, and all of them are decided by the re-run. A
      // helper's test on the same line number of ITS file is not selected by `<spec>:<line>`: it keeps its outcome.
      for (const t of tests)
        if (t.file === file && t.line === line && t.declaredIn === undefined) keys.add(t.key);
    }
  }
  return { filters, keys };
}

// --- budgets -----------------------------------------------------------------------------------------------------

export interface Budget {
  /** A project, or a group of projects that share one budget (the name of the group). */
  name: string;
  projects: string[];
  /** Minutes of test time (the sum of every test's duration in the project, as e2e-durations.json counts it). */
  minutes: number;
}
export interface BudgetFile {
  /** The whole suite's test time may not exceed this (checked only when every project ran). */
  totalMinutes: number;
  /** A budget may be exceeded by this fraction before the run fails (0.15: 15 %). */
  tolerance: number;
  budgets: Budget[];
}
export type BudgetVerdict = "under" | "within tolerance" | "OVER" | "partial" | "no budget";
export interface BudgetRow {
  name: string;
  budget: number | null;
  measured: number;
  verdict: BudgetVerdict;
}

export function readBudgets(raw: unknown): BudgetFile {
  const b = raw as Partial<BudgetFile>;
  if (typeof b.totalMinutes !== "number" || typeof b.tolerance !== "number" || !Array.isArray(b.budgets))
    throw new Error("e2e/budgets.json: needs totalMinutes, tolerance and budgets[]");
  const owner = new Map<string, string>();
  for (const x of b.budgets) {
    if (typeof x.name !== "string" || !Array.isArray(x.projects) || typeof x.minutes !== "number")
      throw new Error(`e2e/budgets.json: a budget needs name, projects[] and minutes (${JSON.stringify(x)})`);
    for (const p of x.projects) {
      const prev = owner.get(p);
      if (prev) throw new Error(`e2e/budgets.json: project "${p}" is in "${prev}" and "${x.name}"`);
      owner.set(p, x.name);
    }
  }
  return b as BudgetFile;
}

/**
 * Each budget against this run's minutes. A budget whose projects all ran is checked: over it by more than the
 * tolerance fails the run. One whose projects ran only in part is printed, not checked (a partial run). A project
 * that ran with no budget fails the run: every suite declares what it may cost. The total is checked only when
 * `everything` ran (wholeSuite: the run was given every test the config lists).
 */
export function checkBudgets(
  file: BudgetFile,
  measured: Record<string, number>,
  ran: Set<string>,
  everything: boolean,
): { rows: BudgetRow[]; total: BudgetRow | null; failed: boolean } {
  const rows: BudgetRow[] = [];
  const covered = new Set<string>();
  const sum = (ps: string[]): number => ps.reduce((s, p) => s + (measured[p] ?? 0), 0);
  for (const b of file.budgets) {
    for (const p of b.projects) covered.add(p);
    const done = b.projects.filter((p) => ran.has(p));
    if (done.length === 0) continue;
    const m = sum(done);
    const verdict: BudgetVerdict =
      done.length < b.projects.length
        ? "partial"
        : m <= b.minutes
          ? "under"
          : m <= b.minutes * (1 + file.tolerance)
            ? "within tolerance"
            : "OVER";
    rows.push({ name: b.name, budget: b.minutes, measured: m, verdict });
  }
  for (const p of [...ran].sort())
    if (!covered.has(p))
      rows.push({ name: p, budget: null, measured: measured[p] ?? 0, verdict: "no budget" });
  let total: BudgetRow | null = null;
  if (everything) {
    const m = sum([...ran]);
    total = {
      name: "TOTAL",
      budget: file.totalMinutes,
      measured: m,
      verdict: m <= file.totalMinutes ? "under" : "OVER",
    };
  }
  const failed = [...rows, ...(total ? [total] : [])].some(
    (r) => r.verdict === "OVER" || r.verdict === "no budget",
  );
  return { rows, total, failed };
}

const projectArgs = (u: Unit): string[] => u.projects.map((p) => `--project=${p}`);

/** Where the runner builds the development bundle the stacks serve (one per base shift: two runs never share one). */
const bundleDir = (shift: number): string =>
  `${root}test-results/e2e-bundle${shift === 0 ? "" : `-s${shift}`}`;
let BUNDLE: string | null = null;

/**
 * One Playwright process. The first pass records no trace (a trace costs 5–80 % of a test's time and is thrown away
 * when it passes); the alone re-run of a failure keeps one (`retain-on-failure`), so every failure the run reports
 * comes with its trace, except in the projects that are never traced.
 */
async function runPlaywright(
  u: Unit,
  files: string[],
  tag: string,
  rest: string[],
  trace: "off" | "retain-on-failure" = "off",
): Promise<RunReport> {
  const logFile = `${where.logs}/${u.name}${tag}.log`;
  const json = `${where.out}/${u.name}${tag}.json`;
  rmSync(json, { force: true });
  const exit = await run(
    playwright,
    [
      "test",
      "-c",
      where.config,
      ...projectArgs(u),
      "--output",
      `${where.out}/${u.name}${tag}`,
      "--reporter",
      "list,json",
      "--pass-with-no-tests",
      ...(trace === "off" || !u.projects.some((p) => NEVER_TRACED.has(p)) ? ["--trace", trace] : []),
      ...files,
      ...rest,
    ],
    logFile,
    {
      OAK_E2E_PREBUILT: "1",
      OAK_E2E_SHIFT: String(u.shift),
      PLAYWRIGHT_JSON_OUTPUT_NAME: json,
      ...(BUNDLE ? { OAK_E2E_BUNDLE: BUNDLE } : {}),
    },
  );
  let report: Report = {};
  try {
    report = JSON.parse(readFileSync(json, "utf8")) as Report;
  } catch {
    report = { errors: [{ message: `no JSON report (see ${relative(root, logFile)})` }] };
  }
  return readReport(report, exit);
}

async function pool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i] as T);
      }
    }),
  );
  return out;
}

// --- main --------------------------------------------------------------------------------------------------------

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  if (args.config) pointAt(args.config);
  shiftState(args.shift);
  const t0 = performance.now();
  const say = (s: string): void =>
    console.log(`[e2e ${((performance.now() - t0) / 60_000).toFixed(1)}m] ${s}`);

  const { projects: all, listed, whole } = await discover(args.shift, args.rest);
  if (args.only) for (const p of args.only) if (!all.has(p)) throw new Error(`unknown project "${p}"`);
  let wanted: Set<string> = args.only ?? new Set(all.keys());
  if (args.since) {
    const paths = changedPaths(args.since);
    const { selected, why } = projectsFor(paths, all);
    say(`--since ${args.since}: ${paths.length} changed paths`);
    for (const w of why) console.log(`  ${w}`);
    if (selected !== ALL) wanted = new Set([...wanted].filter((p) => selected.has(p)));
    if (wanted.size === 0) {
      console.log("E2E TOTAL: nothing to run (no project covers the changed paths)");
      process.exit(0);
    }
  }
  let narrowed = new Set<string>();
  if (args.files) {
    const n = narrowToFiles(all, args.files);
    narrowed = n.narrowed;
    say(`--file: ${args.files.size} spec files`);
    for (const f of n.unknown) console.log(`  ${f}: no project of the config lists it (skipped)`);
    wanted = new Set([...wanted].filter((p) => (all.get(p)?.files.size ?? 0) > 0));
    if (wanted.size === 0) {
      console.log("E2E TOTAL: nothing to run (no project lists the given files)");
      process.exit(0);
    }
  }
  // What this run is given, and whether that is the whole suite (the total budget applies only then).
  const wantedListed = listed.filter(
    (t) => wanted.has(t.project) && (args.files === null || args.files.has(t.file)),
  );
  const everything = wholeSuite(
    wantedListed.map((t) => t.key),
    whole,
  );
  const coverage = everything
    ? `every listed test is selected (${whole.length}): the total budget applies`
    : `${new Set(wantedListed.map((t) => t.key)).size} of ${whole.length} listed tests are selected: a partial run, the total budget does not apply`;
  const durations = readDurations();
  const units = plan(
    [...all.values()].filter((p) => wanted.has(p.name) && p.files.size > 0),
    durations,
    args.shift,
  );
  if (args.files) pinFiles(units, all);
  // The tests each unit is given (its projects, its files): what its report must account for.
  const given = (u: Unit): Listed[] =>
    listed.filter(
      (t) => u.projects.includes(t.project) && (u.files.length === 0 || u.files.includes(t.file)),
    );
  const jobs = args.jobs === "auto" ? autoJobs() : args.jobs;
  const quiet = units.filter((u) => u.quiet).sort((a, b) => b.weight - a.weight);
  const loud = units.filter((u) => !u.quiet).sort((a, b) => b.weight - a.weight);
  say(
    `plan: ${units.length} units (${quiet.length} quiet, ${loud.length} loud), jobs ${jobs}, quiet jobs ${args.quietJobs}, base shift ${args.shift}`,
  );
  for (const u of [...quiet, ...loud])
    console.log(
      `  ${u.quiet ? "quiet" : "loud "} ${u.name.padEnd(28)} ~${u.weight.toFixed(1)} min  shift ${u.shift}  ${given(u).length} tests${
        u.files.length > 0 ? `  ${u.files.length} files` : ""
      }`,
    );
  console.log(`  ${coverage}`);
  if (args.plan) {
    for (const u of units.filter((x) => x.files.length > 0)) console.log(`${u.name}: ${u.files.join(" ")}`);
    process.exit(0);
  }

  rmSync(where.logs, { recursive: true, force: true });
  mkdirSync(where.logs, { recursive: true });
  mkdirSync(where.out, { recursive: true });

  // Oak's build and fixtures (not for another config: the runner's own fixtures need neither). The development
  // bundle is the app built once with import.meta.env.DEV true (every __oak* hook and /dev route kept): the stacks
  // serve it with `vite preview` instead of a Vite dev server each (e2e/support/stack.ts BUNDLE_DIR).
  const bundle = args.config || !args.bundle ? null : bundleDir(args.shift);
  interface Step {
    cmd: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
  }
  const prepare: Step[] = args.config
    ? []
    : [
        { cmd: "bun", args: ["scripts/content/build.ts"] },
        { cmd: "bun", args: ["run", "build"] },
        ...(bundle
          ? [
              {
                cmd: "node",
                args: [
                  "node_modules/vite/bin/vite.js",
                  "build",
                  "--config",
                  "app/vite.config.ts",
                  "--mode",
                  "development",
                  "--outDir",
                  bundle,
                  "--emptyOutDir",
                ],
                // --mode development alone leaves import.meta.env.DEV false in a build.
                env: { NODE_ENV: "development" },
              },
            ]
          : []),
        { cmd: "bun", args: ["app/src/onboarding/e2e/make-fixtures.bun.ts"] },
        { cmd: "bun", args: ["e2e/review/make-fixtures.bun.ts"] },
        { cmd: "bun", args: ["app/src/voice/e2e/make-fixtures.bun.ts"] },
        {
          cmd: "bun",
          args: [
            "-e",
            'import { writeMicFixtures } from "./app/src/answers/e2e/fixtures.ts"; writeMicFixtures();',
          ],
        },
        { cmd: "bun", args: ["make-fixtures.bun.ts"], cwd: "packages/audio/e2e" },
      ];
  if (prepare.length > 0)
    say(
      `build once (content, the production app${bundle ? ", the development bundle" : ""}) and write the fake-microphone fixtures`,
    );
  for (const { cmd, args: cmdArgs, cwd, env } of prepare) {
    const code = await new Promise<number>((resolve) => {
      const log = createWriteStream(`${where.logs}/_build.log`, { flags: "a" });
      const child = spawn(cmd, cmdArgs, {
        cwd: cwd ? `${root}${cwd}` : root,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.pipe(log, { end: false });
      child.stderr.pipe(log, { end: false });
      child.on("close", (c) => log.end(() => resolve(c ?? 1)));
    });
    if (code !== 0) {
      console.log(readFileSync(`${where.logs}/_build.log`, "utf8").split("\n").slice(-30).join("\n"));
      console.log(`E2E TOTAL: build failed (${cmd} ${cmdArgs.join(" ")}); nothing was run`);
      process.exit(1);
    }
  }
  BUNDLE = bundle;

  const times: Record<string, number> = {};
  const tests: Record<string, number> = {};
  const results: Result[] = [];
  const line = (o: Map<TestKey, Outcome>): string => {
    const n = (x: Outcome): number => [...o.values()].filter((v) => v === x).length;
    return `${n("passed")} passed, ${n("failed")} failed, ${n("skipped")} skipped${n("notRun") ? `, ${n("notRun")} did not run` : ""}`;
  };
  // The load profile (scripts/e2e-load.ts): what ran beside each unit, and how busy the cores were.
  let runningUnits = 0;
  const profile = startLoadProfile(() => runningUnits);
  const runUnit = async (u: Unit): Promise<Result> => {
    const started = performance.now();
    runningUnits++;
    const done = profile.unit(u.name);
    const r = await runPlaywright(u, u.files.map(fileFilter), "", args.rest).finally(() => {
      runningUnits--;
      done();
    });
    Object.assign(times, r.times.files);
    Object.assign(tests, r.times.tests);
    const s = settle(given(u), r);
    const res: Result = {
      unit: u,
      exit: r.exit,
      minutes: (performance.now() - started) / 60_000,
      outcomes: s.outcomes,
      errors: s.errors,
      loadSensitive: [],
    };
    const ok =
      s.errors.length === 0 && ![...s.outcomes.values()].some((o) => o === "failed" || o === "notRun");
    say(`${ok ? "ok  " : "FAIL"} ${u.name}: ${line(s.outcomes)} (${res.minutes.toFixed(1)} min)`);
    for (const e of s.errors) console.log(`       ${e}`);
    return res;
  };

  if (quiet.length > 0) {
    const alone = quiet.filter((u) => u.projects.some((p) => QUIET_ALONE.has(p)));
    const streams = quiet.filter((u) => !alone.includes(u));
    if (alone.length > 0) {
      say(`quiet files with nothing beside them: ${alone.map((u) => u.name).join(", ")}`);
      results.push(...(await pool(alone, 1, runUnit)));
    }
    say(`quiet files, ${args.quietJobs} at a time: ${streams.map((u) => u.name).join(", ")}`);
    results.push(...(await pool(streams, args.quietJobs, runUnit)));
  }
  if (loud.length > 0) {
    say(`${loud.length} loud units, ${jobs} at a time`);
    results.push(...(await pool(loud, jobs, runUnit)));
  }

  // Tests that failed or could not run beside other suites (quiet units too: their stream had a neighbour): once
  // more, alone, traced. Exactly those tests, or their whole file when it is serial or a helper declares them
  // (rerunPlan; isSerial reads any file's source, a helper's too). The alone outcome is the one that counts.
  const serial = new Map<string, boolean>();
  const isSerial = (file: string): boolean => {
    if (!serial.has(file)) {
      let src = "";
      try {
        src = readFileSync(`${root}${file}`, "utf8");
      } catch {}
      serial.set(file, SERIAL_RE.test(src));
    }
    return serial.get(file) as boolean;
  };
  for (const r of results) {
    const bad = [...r.outcomes].filter(([, o]) => o === "failed" || o === "notRun").map(([k]) => k);
    if (bad.length === 0 && r.errors.length === 0) continue;
    // An error outside the tests with nothing failed (a teardown, an exit code): every test of the unit, alone.
    const rp =
      bad.length > 0
        ? rerunPlan(bad, given(r.unit), isSerial)
        : {
            filters: [...new Set(given(r.unit).map((t) => t.file))].map(fileFilter),
            keys: new Set(given(r.unit).map((t) => t.key)),
          };
    say(
      `again, alone: ${r.unit.name} (${bad.length} failed or not run beside other suites; ${rp.keys.size} tests run again)`,
    );
    const again = await runPlaywright(r.unit, rp.filters, ".alone", args.rest, "retain-on-failure");
    const expected = given(r.unit).filter((t) => rp.keys.has(t.key));
    const m = merge({ outcomes: r.outcomes, errors: r.errors }, settle(expected, again), rp.keys);
    r.outcomes = m.outcomes;
    r.errors = m.errors;
    r.loadSensitive = m.loadSensitive;
    r.exit = again.exit;
    const ok =
      m.errors.length === 0 && ![...m.outcomes.values()].some((o) => o === "failed" || o === "notRun");
    say(`${ok ? "ok  " : "FAIL"} ${r.unit.name} alone: ${line(settle(expected, again).outcomes)}`);
    for (const e of m.errors) console.log(`       ${e}`);
  }

  // Durations: this run's measurements over the previous ones.
  const projectMinutes: Record<string, number> = {};
  for (const [key, s] of Object.entries(times)) {
    const p = key.split(" › ")[0] as string;
    projectMinutes[p] = (projectMinutes[p] ?? 0) + s / 60;
  }
  const next: Durations = {
    generated: new Date().toISOString(),
    projects: {
      ...durations.projects,
      // A project narrowed by `--file` ran only some of its files: its minutes are not the project's.
      ...Object.fromEntries(
        Object.entries(projectMinutes)
          .filter(([k]) => !narrowed.has(k))
          .map(([k, v]) => [k, Number(v.toFixed(2))]),
      ),
    },
    files: {
      ...durations.files,
      ...Object.fromEntries(Object.entries(times).map(([k, v]) => [k, Number(v.toFixed(1))])),
    },
    tests: {
      ...durations.tests,
      ...Object.fromEntries(Object.entries(tests).map(([k, v]) => [k, Number(v.toFixed(1))])),
    },
  };
  writeFileSync(durationsOut ?? where.durations, `${JSON.stringify(next, null, 1)}\n`);

  const load = profile.stop();
  const loadOf = new Map(load.units.map((x) => [x.name, x]));
  writeFileSync(
    (durationsOut ?? where.durations).replace("e2e-durations", "e2e-load"),
    `${JSON.stringify({ generated: new Date().toISOString(), jobs, units: load.units, samples: load.samples }, null, 1)}\n`,
  );
  const testMinutesOf = (u: Unit): number =>
    Object.entries(times)
      .filter(([k]) => {
        const [p, f] = k.split(" › ");
        return u.projects.includes(p as string) && (u.files.length === 0 || u.files.includes(f as string));
      })
      .reduce((s, [, v]) => s + v / 60, 0);
  console.log("");
  console.log("Units (wall minutes; test minutes; beside it: mean units running, mean share of cores busy):");
  for (const r of [...results].sort((a, b) => b.minutes - a.minutes)) {
    const l = loadOf.get(r.unit.name);
    console.log(
      `  ${r.minutes.toFixed(1).padStart(5)}  ${testMinutesOf(r.unit).toFixed(1).padStart(5)}  ${l ? `${l.meanRunning.toFixed(1).padStart(4)} units ${(l.meanBusy * 100).toFixed(0).padStart(3)}% busy` : "".padEnd(19)}  ${r.unit.name}`,
    );
  }
  console.log("Slowest ten files (seconds of test time, this run):");
  for (const [k, v] of Object.entries(times)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10))
    console.log(`  ${v.toFixed(0).padStart(5)}  ${k}`);

  const over = Object.entries(tests).filter(([, v]) => v > TEST_CEILING_S);
  if (over.length > 0) {
    console.log(`Tests over ${TEST_CEILING_S} s (split them, or start them from a seed): ${over.length}`);
    for (const [k, v] of over.sort((a, b) => b[1] - a[1])) console.log(`  ${v.toFixed(0).padStart(5)}  ${k}`);
  }

  // Every listed test, once, with its final outcome; then the counts per project, which must add up to the listing.
  const final = new Map<TestKey, Outcome>();
  for (const r of results) for (const [k, o] of r.outcomes) final.set(k, o);
  for (const t of wantedListed) if (!final.has(t.key)) final.set(t.key, "notRun");
  const byOutcome = (o: Outcome): TestKey[] => [...final].filter(([, v]) => v === o).map(([k]) => k);
  const rows = tally(final);
  console.log("Per project (listed = passed + failed + flaky + skipped + did not run):");
  const listedOf = (p: string): number => wantedListed.filter((t) => t.project === p).length;
  let mismatch = false;
  for (const [p, row] of [...rows].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sum = OUTCOMES.reduce((s, o) => s + row[o], 0);
    if (sum !== listedOf(p)) mismatch = true;
    console.log(
      `  ${p.padEnd(18)} listed ${String(listedOf(p)).padStart(4)}  ${OUTCOMES.map((o) => `${o === "notRun" ? "did not run" : o} ${row[o]}`).join(", ")}${sum !== listedOf(p) ? `  (adds up to ${sum}: tests not in the listing ran)` : ""}`,
    );
  }
  const totalOf = (o: Outcome): number => [...rows.values()].reduce((s, r) => s + r[o], 0);
  const sumAll = OUTCOMES.reduce((s, o) => s + totalOf(o), 0);
  if (sumAll !== wantedListed.length) mismatch = true;

  const failedUnits = results.filter((r) => r.errors.length > 0);
  for (const r of failedUnits) {
    console.log(
      `FAILED ${r.unit.name} outside its tests (log ${relative(root, where.logs)}/${r.unit.name}.log):`,
    );
    for (const e of r.errors) console.log(`  ✘ ${e}`);
  }
  const failed = byOutcome("failed");
  if (failed.length > 0) {
    console.log(`Failed: ${failed.length}`);
    for (const k of failed) console.log(`  ✘ ${k}`);
  }
  const notRun = byOutcome("notRun");
  if (notRun.length > 0) {
    console.log(`Did not run (listed, never ran): ${notRun.length}`);
    for (const k of notRun) console.log(`  ∅ ${k}`);
  }
  const skipped = byOutcome("skipped");
  if (skipped.length > 0) {
    console.log(`Skipped by the spec itself (test.skip / test.fixme): ${skipped.length}`);
    for (const k of skipped) console.log(`  - ${k}`);
  }
  const sensitive = results.flatMap((r) => r.loadSensitive);
  // Still a failed run: the test is not to be trusted beside others until it is fixed or moved to QUIET with the
  // evidence (docs/design/wave5.md, Browser tests). Never hidden, never counted as a pass of the whole run.
  if (sensitive.length > 0) {
    console.log(
      `Load-sensitive (failed beside other suites, passed alone; the run fails): ${sensitive.length}`,
    );
    for (const t of sensitive) console.log(`  ~ ${t}`);
  }
  if (mismatch)
    console.log(`COUNTS DO NOT ADD UP: ${sumAll} outcomes for ${wantedListed.length} listed tests`);

  // The budgets (e2e/budgets.json): minutes of test time per project, this run's first pass. Another config's budgets
  // are a budgets.json beside it, if it has one (the runner's own fixtures prove the check with it).
  let overBudget = false;
  const budgetsFile = args.config ? `${where.configDir}budgets.json` : BUDGETS_FILE;
  // Oak's own run always reads e2e/budgets.json (a missing file fails the run).
  if (!args.config || existsSync(budgetsFile)) {
    const ran = new Set(units.flatMap((u) => u.projects));
    const b = checkBudgets(
      readBudgets(JSON.parse(readFileSync(budgetsFile, "utf8"))),
      projectMinutes,
      ran,
      everything,
    );
    console.log(
      `Budgets (minutes of test time; ${relative(root, budgetsFile)}; ${args.budget ? "enforced" : "NOT enforced: --no-budget"}):`,
    );
    for (const row of [...b.rows, ...(b.total ? [b.total] : [])]) {
      const d =
        row.budget === null
          ? ""
          : `${row.measured - row.budget >= 0 ? "+" : ""}${(row.measured - row.budget).toFixed(1)}`;
      console.log(
        `  ${row.name.padEnd(22)} budget ${row.budget === null ? "  —  " : row.budget.toFixed(1).padStart(5)}  measured ${row.measured.toFixed(1).padStart(5)}  ${d.padStart(6)}  ${row.verdict}`,
      );
    }
    if (!b.total) console.log(`  (the total is not checked: ${coverage})`);
    overBudget = args.budget && b.failed;
    if (overBudget)
      console.log(
        "OVER BUDGET: cut the waste (docs/design/wave5.md §7.1), or argue the new budget in the same change",
      );
  }
  const total = `${wantedListed.length} listed: ${totalOf("passed")} passed, ${totalOf("failed")} failed, ${totalOf("flaky")} flaky, ${totalOf("skipped")} skipped, ${totalOf("notRun")} did not run`;
  console.log(
    `E2E TOTAL: ${total}; ${sensitive.length} load-sensitive; ${results.length} units in ${((performance.now() - t0) / 60_000).toFixed(1)} min (jobs ${jobs}, quiet jobs ${args.quietJobs})${overBudget ? "; OVER BUDGET" : ""}`,
  );
  process.exit(
    failedUnits.length > 0 ||
      failed.length > 0 ||
      notRun.length > 0 ||
      sensitive.length > 0 ||
      mismatch ||
      overBudget
      ? 1
      : 0,
  );
}
