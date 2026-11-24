// One Oak stack per Playwright config (docs/design/wave2.md §2): the real Oak server (OAK_DEV=1, a throwaway
// data dir) on `apiPort` and the app's Vite dev server on `vitePort`, proxying /api and /sounds to that server.
// Every Wave 2 area has its own pair of ports, so several stacks run side by side.
//
//   // app/src/<area>/e2e/playwright.config.ts
//   import { defineConfig } from "@playwright/test";
//   import { oakStack, stackUse } from "../../../../e2e/support/stack.ts";
//   const stack = oakStack({ vitePort: 5203, apiPort: 8803, dataDirName: "drills" });
//   export default defineConfig({ testDir: ".", testMatch: /.*\.pw\.ts$/, workers: 1,
//     outputDir: stack.outputDir, webServer: stack.webServer, use: stackUse(stack) });
//
// Playwright starts both servers before the first test and stops them when the run ends (never reused: a
// server already on the port fails the run instead of silently testing someone else's stack).
//
// ONE VARIABLE MOVES EVERY STACK: `OAK_E2E_SHIFT=<n>` adds n to every port of every e2e server (oakStack's two,
// the platform stack, the journey's production server, the package pages) and suffixes every data and output
// dir with `-s<n>`, so a second copy of any suite runs beside the first without a clash: a builder on the
// standard ports, the speed work on +300, and the shards of one project (`bun run e2e` gives shard k of a project
// the shift base + 100·k). Area configs pass their standard ports and follow without edits; a spec that needs a
// port reads it from its config's stack (or `shifted()`), never as a literal.
import { fileURLToPath } from "node:url";
import type { PlaywrightTestConfig } from "@playwright/test";

type WebServer = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, readonly unknown[]>[number];
type Use = NonNullable<PlaywrightTestConfig["use"]>;

export interface StackOptions {
  /** The Vite dev server's port (`OAK_VITE_PORT`). */
  vitePort: number;
  /** The Oak server's port (`OAK_PORT` for the server, `OAK_API_PORT` for Vite's proxy). */
  apiPort: number;
  /** A folder name under `test-results/stacks/`: the server's `OAK_DATA_DIR`, wiped at every start. */
  dataDirName: string;
  /**
   * Extra environment for the Oak server, e.g. `{ OAK_TUTOR_FAKE: "1" }` for the scripted tutor
   * (docs/design/wave2.md §5). `OAK_DEV`, `OAK_PORT`, `OAK_VITE_PORT` and `OAK_DATA_DIR` are set here.
   */
  extraEnv?: Record<string, string>;
  /**
   * Run `bun scripts/content/build.ts` before Vite starts. Default false: the content build writes the shared
   * `content/.generated/`, so parallel stacks should not all rebuild it; run `bun run content:build` once.
   */
  buildContent?: boolean;
  /**
   * May this stack serve the runner's prebuilt development bundle (`OAK_E2E_BUNDLE`, below) instead of the Vite dev
   * server? Default true. Set false for an area whose specs need a page only the dev server has: a dev-only HTML
   * entry (`/src/answers/dev/gallery.html`) or a module imported in the page by its source path (`import("/src/…")`).
   */
  bundle?: boolean;
}

export interface OakStack {
  /** `http://127.0.0.1:<vitePort>`: the app. */
  baseURL: string;
  /** `http://127.0.0.1:<apiPort>`: the Oak server itself (health checks, direct API calls in a spec). */
  apiURL: string;
  /** Absolute path of the server's data dir. */
  dataDir: string;
  /** Absolute path for Playwright's `outputDir`. */
  outputDir: string;
  webServer: WebServer[];
}

/** The repository root (this file is `<root>/e2e/support/stack.ts`). */
export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
/**
 * The dev-seed snapshot folder every stack's server shares (`OAK_SEED_CACHE_DIR`): keyed by the server's code, the
 * content and the request, so stacks of any shift and any run on this checkout may share it.
 */
export const SEED_CACHE_DIR = `${REPO_ROOT}test-results/seed-cache`;

const RESERVED = [
  "OAK_DEV",
  "OAK_PORT",
  "OAK_VITE_PORT",
  "OAK_API_PORT",
  "OAK_DATA_DIR",
  "OAK_SEED_CACHE_DIR",
];

/** Parses `OAK_E2E_SHIFT`: a non-negative multiple of 10 below 5000 (0 when unset). */
export function parseShift(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= 5000 || n % 10 !== 0)
    throw new Error(`OAK_E2E_SHIFT must be a multiple of 10 in 0–4990, got "${raw}"`);
  return n;
}

/** The port shift of this process (`OAK_E2E_SHIFT`, default 0). */
export const E2E_SHIFT = parseShift(process.env.OAK_E2E_SHIFT);

/** The suffix of every data and output dir under this shift: "" at 0, `-s300` at 300. */
export const E2E_SUFFIX = E2E_SHIFT === 0 ? "" : `-s${E2E_SHIFT}`;

/** A standard port moved by this process's shift. Every e2e server and URL goes through it. */
export function shifted(port: number): number {
  return port + E2E_SHIFT;
}

/**
 * `OAK_E2E_PREBUILT=1`: `bun run e2e` has already built the content and the production app and written every
 * fake-microphone fixture (scripts/e2e-parallel.ts), so no server command may do it again while others read.
 */
export const PREBUILT = process.env.OAK_E2E_PREBUILT === "1";

/** `fixture && rest`, or just `rest` when the runner has written the fixtures already (`PREBUILT`). */
export function withFixtures(fixtureCommand: string, command: string): string {
  return PREBUILT ? command : `${fixtureCommand} && ${command}`;
}

/**
 * `OAK_E2E_BUNDLE=<absolute dir>`: `bun run e2e` has built the app ONCE in development mode into that folder
 * (`NODE_ENV=development vite build --mode development`: the same source with `import.meta.env.DEV` true, so every
 * `__oak*` test hook, the /dev routes and React's development build are there). A stack that allows it serves that
 * folder with `vite preview` (same ports, same /api and /sounds proxy) instead of a Vite dev server: no module is
 * transformed per process, a page loads ~240 files instead of ~1 600, and the first page of a process is as fast as
 * the others (measured in docs/design/wave5.md §7.1). Unset (an area run on its own): the Vite dev server, as before.
 */
export const BUNDLE_DIR = process.env.OAK_E2E_BUNDLE || null;

/** The front-end command of a stack: `vite preview` of the runner's bundle when there is one and the area allows it. */
export function frontEndCommand(bundleDir: string | null): string {
  const vite = `node ${REPO_ROOT}node_modules/vite/bin/vite.js`;
  // e2e/support/vite.e2e.config.ts: the app's config without a file watcher or HMR (no reload mid-test).
  return bundleDir
    ? `${vite} preview --config e2e/support/vite.e2e.config.ts --outDir "${bundleDir}"`
    : `${vite} --config e2e/support/vite.e2e.config.ts`;
}

function checkPort(name: string, port: number): void {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(`oakStack: ${name} must be an integer port in 1024–65535, got ${port}`);
}

/**
 * The two `webServer` entries and the URLs of one stack. Pure: nothing starts until Playwright runs. The ports
 * given are the standard ones; `OAK_E2E_SHIFT` moves them (and suffixes the data dir) here.
 */
export function oakStack(options: StackOptions): OakStack {
  checkPort("vitePort", options.vitePort);
  checkPort("apiPort", options.apiPort);
  if (options.vitePort === options.apiPort) throw new Error("oakStack: vitePort and apiPort must differ");
  const o: StackOptions = {
    ...options,
    vitePort: shifted(options.vitePort),
    apiPort: shifted(options.apiPort),
    dataDirName: `${options.dataDirName}${E2E_SUFFIX}`,
  };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(o.dataDirName))
    throw new Error(`oakStack: dataDirName must be a lower-case slug, got "${o.dataDirName}"`);
  for (const key of Object.keys(o.extraEnv ?? {}))
    if (RESERVED.includes(key)) throw new Error(`oakStack: ${key} is set by the stack itself`);

  const dataDir = `${REPO_ROOT}test-results/stacks/${o.dataDirName}`;
  const baseURL = `http://127.0.0.1:${o.vitePort}`;
  const apiURL = `http://127.0.0.1:${o.apiPort}`;
  const vite = frontEndCommand(o.bundle === false ? null : BUNDLE_DIR);
  const common = { cwd: REPO_ROOT, reuseExistingServer: false, stdout: "pipe", stderr: "pipe" } as const;
  return {
    baseURL,
    apiURL,
    dataDir,
    outputDir: `${REPO_ROOT}test-results/stacks/${o.dataDirName}-results`,
    webServer: [
      {
        ...common,
        name: `oak-api:${o.apiPort}`,
        command: `rm -rf "${dataDir}" && bun server/src/main.ts`,
        url: `${apiURL}/api/health`,
        timeout: 60_000,
        env: {
          // A unit song not started starts on first read (config.ts `songsAutostart`): a spec opens a lesson the way
          // a learner who already met its song would, not on the New song moment. A stack may pass "0" to see it.
          OAK_SONGS_AUTOSTART: "1",
          ...o.extraEnv,
          OAK_DEV: "1",
          OAK_PORT: String(o.apiPort),
          OAK_VITE_PORT: String(o.vitePort),
          OAK_DATA_DIR: dataDir,
          // Dev seeds are built once and restored from a snapshot after that (server/src/services/dev-seed-cache.ts),
          // in one folder every stack of the machine shares: a point one shard or project built, the others restore.
          OAK_SEED_CACHE_DIR: SEED_CACHE_DIR,
        },
        // Ask the server to shut down cleanly (it closes SQLite and the grader hosts on SIGTERM).
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      },
      {
        ...common,
        name: `oak-vite:${o.vitePort}`,
        command: o.buildContent ? `bun scripts/content/build.ts && ${vite}` : vite,
        url: `${baseURL}/`,
        timeout: 180_000,
        env: { OAK_VITE_PORT: String(o.vitePort), OAK_API_PORT: String(o.apiPort) },
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      },
    ],
  };
}

/**
 * The `use` block every Wave 2 config shares: the stack's baseURL, Chromium, 1440×900, autoplay without a
 * gesture (sound tests), traces on failure. Spread your own options after it.
 */
export function stackUse(stack: OakStack, extra: Use = {}): Use {
  return {
    baseURL: stack.baseURL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
    ...extra,
  };
}

/** The two themes and two viewports every surface is screenshotted in (docs/design/wave2.md §8). */
export const SCREENSHOT_MATRIX = [
  { theme: "paper", width: 1440, height: 900 },
  { theme: "bark", width: 1440, height: 900 },
  { theme: "paper", width: 1280, height: 800 },
  { theme: "bark", width: 1280, height: 800 },
] as const;

/**
 * One area's browser suite as data: its own stack (web servers), test folder and options. The area's own
 * `playwright.config.ts` is `areaConfig(area)` (run one suite alone); the root `playwright.config.ts` turns every
 * area into a project (`bun run e2e`, or `bunx playwright test --project <name>`).
 */
export interface Area {
  /** The project name (`--project <name>`). */
  name: string;
  testDir: string;
  webServer: WebServer[];
  use: Use;
  outputDir: string;
  timeout: number;
  expect?: { timeout: number };
}

/** An area's standalone config (one suite, its own stack, one worker). */
export function areaConfig(a: Area): PlaywrightTestConfig {
  return {
    testDir: a.testDir,
    testMatch: /.*\.pw\.ts$/,
    workers: 1,
    timeout: a.timeout,
    ...(a.expect ? { expect: a.expect } : {}),
    reporter: [["list"]],
    outputDir: a.outputDir,
    webServer: a.webServer,
    use: a.use,
  };
}

/**
 * The project names a Playwright run asked for (`--project x`, `--project=x`, repeatable), or `null` for all.
 * The root config starts only the web servers of the selected projects.
 */
export function selectedProjects(argv: readonly string[] = process.argv): Set<string> | null {
  const out = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--project" && argv[i + 1]) out.add(argv[++i] as string);
    else if (a.startsWith("--project=")) out.add(a.slice("--project=".length));
  }
  return out.size > 0 ? out : null;
}
