// Server configuration: where the data lives, which ports are allowed, whether dev routes exist.
// Nothing else in the server reads `process.env` or `Bun.argv` (the API key is read by secrets.ts).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PORTS } from "@oak/api";

/** What the server reports when no version can be found (tests, a checkout without desktop/). */
export const APP_VERSION = "0.0.0";

/**
 * Oak's version, from the one place a release sets it: desktop/package.json's "version". The desktop app passes it
 * as `OAK_APP_VERSION` (Electron's `app.getVersion()` reads that file, desktop/main.cjs), because the staged app
 * carries no desktop/ folder; a checkout (`bun run dev`, `bun run start`) reads the file itself. A dev server says
 * "-dev" after it, so a report from a dev build is never mistaken for a release.
 */
export function appVersionOf(env: Record<string, string | undefined>, rootDir: string, dev: boolean): string {
  let v = env.OAK_APP_VERSION?.trim() || "";
  if (!v)
    try {
      const pkg = JSON.parse(readFileSync(join(rootDir, "desktop", "package.json"), "utf8")) as {
        version?: unknown;
      };
      if (typeof pkg.version === "string") v = pkg.version.trim();
    } catch {
      // No desktop/ beside the server: the fallback below.
    }
  v ||= APP_VERSION;
  return dev ? `${v}-dev` : v;
}

export interface OakConfig {
  /** Always loopback: the server never listens on another interface (contracts §11.1 rule 1). */
  hostname: "127.0.0.1";
  port: number;
  /** `OAK_DEV=1`: `/api/dev/*` exists and the Vite port is an allowed Host and Origin. */
  dev: boolean;
  /** Serve `dist/` with SPA fallback (`--serve-dist`, the production start). */
  serveDist: boolean;
  /** `OAK_DATA_DIR`, default `~/.oak`. */
  dataDir: string;
  dbPath: string;
  audioDir: string;
  albumDir: string;
  backupsDir: string;
  secretsDir: string;
  /** Repository root: `content/`, `sounds/pack/`, `dist/` and `.env.local` are found from here. */
  rootDir: string;
  distDir: string;
  soundsDir: string;
  contentDir: string;
  appVersion: string;
  /**
   * Run by the desktop app: `OAK_APP_VERSION` is set (desktop/main.cjs) and this is not a dev server. Only then does
   * the server ask GitHub whether a newer Oak is out (services/app-update.ts).
   */
  desktopApp: boolean;
  /**
   * Extra ports whose Host and Origin the tutor's own routes allow (the Vite proxy in dev): 5173 and
   * `OAK_VITE_PORT`. Oak's /api security accepts any loopback port in dev (security.ts).
   */
  devPorts: readonly number[];
  /** `OAK_DEV=1` and `OAK_TUTOR_FAKE=1`: the scripted fake tutor backend answers (tutor-adapters/fake-backend.ts). */
  tutorFake: boolean;
  /**
   * `OAK_DEV=1` and `OAK_SONGS_AUTOSTART=1` (every e2e stack, e2e/support/stack.ts): a unit song not started starts in
   * the profile's style the first time it is read, so a lesson opens without the New song moment. Off everywhere else.
   */
  songsAutostart: boolean;
  /** `OAK_NOW=<ISO>` with `OAK_DEV=1`: the dev clock starts at this instant and runs on (services/dev-clock.ts). */
  nowAt: string | null;
}

export interface ConfigInput {
  env?: Record<string, string | undefined>;
  argv?: readonly string[];
  rootDir?: string;
}

/** The data directory layout of contracts §11.10 under `dataDir`. */
export function dataPaths(dataDir: string) {
  return {
    dataDir,
    dbPath: join(dataDir, "oak.db"),
    audioDir: join(dataDir, "audio"),
    albumDir: join(dataDir, "album"),
    backupsDir: join(dataDir, "backups"),
    secretsDir: join(dataDir, "secrets"),
  };
}

export function loadConfig(input: ConfigInput = {}): OakConfig {
  const env = input.env ?? process.env;
  const argv = input.argv ?? process.argv.slice(2);
  const rootDir = resolve(input.rootDir ?? join(import.meta.dir, "..", ".."));
  const dataDir = resolve(env.OAK_DATA_DIR?.trim() || join(homedir(), ".oak"));
  const dev = env.OAK_DEV === "1";
  const port = Number(env.OAK_PORT) > 0 ? Number(env.OAK_PORT) : PORTS.api;
  const vitePort = Number(env.OAK_VITE_PORT) > 0 ? Number(env.OAK_VITE_PORT) : PORTS.vite;
  return {
    hostname: "127.0.0.1",
    port,
    dev,
    serveDist: argv.includes("--serve-dist"),
    ...dataPaths(dataDir),
    rootDir,
    distDir: join(rootDir, "dist"),
    soundsDir: join(rootDir, "sounds", "pack"),
    contentDir: join(rootDir, "content"),
    appVersion: appVersionOf(env, rootDir, dev),
    desktopApp: !dev && Boolean(env.OAK_APP_VERSION?.trim()),
    devPorts: dev ? [...new Set([PORTS.vite, vitePort])] : [],
    tutorFake: dev && env.OAK_TUTOR_FAKE === "1",
    songsAutostart: dev && env.OAK_SONGS_AUTOSTART === "1",
    nowAt: dev && env.OAK_NOW?.trim() && Number.isFinite(Date.parse(env.OAK_NOW)) ? env.OAK_NOW.trim() : null,
  };
}

/** A configuration for tests: everything under one temp directory, no dev routes unless asked. */
export function testConfig(dataDir: string, overrides: Partial<OakConfig> = {}): OakConfig {
  const rootDir = resolve(join(import.meta.dir, "..", ".."));
  return {
    hostname: "127.0.0.1",
    port: PORTS.api,
    dev: false,
    serveDist: false,
    ...dataPaths(dataDir),
    rootDir,
    distDir: join(dataDir, "dist"),
    soundsDir: join(dataDir, "sounds"),
    contentDir: join(dataDir, "content"),
    appVersion: APP_VERSION,
    desktopApp: false,
    devPorts: [],
    tutorFake: false,
    songsAutostart: false,
    nowAt: null,
    ...overrides,
  };
}
