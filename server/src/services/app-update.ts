// "A new version is out": the desktop app is ad hoc signed, so it cannot update itself (Squirrel.Mac needs a
// notarised app). Instead the server asks GitHub for Oak's latest release at most once a day and tells the app
// when it is newer than OAK_APP_VERSION. Only the desktop app's server asks (config.desktopApp), and only while
// the learner's "Check for new versions" setting is on. The request is a plain GET with a generic User-Agent and
// no user data; it times out after a few seconds, and offline it fails silently (the next try is an hour later).
// The last answer is kept in memory and in one internal row of the key/value `settings` table, so a restart within
// the day asks nothing.
import type { AppUpdate } from "@oak/api";
import { type Db, fromJson, get, run, toJson } from "../db/index.ts";

export const RELEASES_API = "https://api.github.com/repos/fpl0/oak/releases/latest";
const RELEASES_PREFIX = "https://github.com/fpl0/oak/releases/";
const DMG = "Oak-macos-arm64.dmg";
/** A successful check holds for a day. */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
/** After a failed check (offline, rate-limited), the next try is an hour later. */
export const RETRY_AFTER_MS = 60 * 60 * 1000;
export const TIMEOUT_MS = 5000;
/** The settings-table key of the last check (internal; not a learner setting: `SettingsRepo.all` skips it). */
export const UPDATE_CHECK_KEY = "app.updateCheck";

// --- versions -------------------------------------------------------------------------------------------------

interface Version {
  core: [number, number, number];
  pre: string | null;
}

/** `1.3.2`, `v1.3.2`, `1.4.0-beta.1`; anything else is `null`. */
export function parseVersion(v: string): Version | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  if (!m) return null;
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null };
}

/**
 * Semver order of two versions: negative, 0 or positive; `null` when either is not a version. A pre-release sorts
 * before its release (`1.4.0-beta` < `1.4.0`); two pre-releases of one version compare as text.
 */
export function compareVersions(a: string, b: string): number | null {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (x === null || y === null) return null;
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return (x.core[i] ?? 0) - (y.core[i] ?? 0);
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** `latest` is a newer version than `current` (a dev build's `-dev` suffix counts as a pre-release). */
export function isNewer(latest: string, current: string): boolean {
  return (compareVersions(latest, current) ?? 0) > 0;
}

// --- the release ----------------------------------------------------------------------------------------------

export interface LatestRelease {
  version: string;
  /** The DMG, or the release page when the release has none. */
  url: string;
  notesUrl: string;
}

const releaseLink = (u: unknown): string | null =>
  typeof u === "string" && u.toLowerCase().startsWith(RELEASES_PREFIX) && !/[\s"<>]/.test(u) ? u : null;

/** The parts of GitHub's `releases/latest` answer Oak uses; `null` for a draft, a pre-release or a malformed one. */
export function readRelease(json: unknown): LatestRelease | null {
  if (typeof json !== "object" || json === null) return null;
  const r = json as Record<string, unknown>;
  if (r.draft === true || r.prerelease === true || typeof r.tag_name !== "string") return null;
  const parsed = parseVersion(r.tag_name);
  if (parsed === null || parsed.pre !== null) return null;
  const version = r.tag_name.trim().replace(/^v/, "");
  const notesUrl = releaseLink(r.html_url) ?? `${RELEASES_PREFIX}tag/v${version}`;
  const assets = Array.isArray(r.assets) ? (r.assets as unknown[]) : [];
  const dmg = assets.find(
    (a): a is Record<string, unknown> =>
      typeof a === "object" && a !== null && (a as Record<string, unknown>).name === DMG,
  );
  const url = releaseLink(dmg?.browser_download_url) ?? notesUrl;
  return { version, url, notesUrl };
}

// --- the check ------------------------------------------------------------------------------------------------

/** One successful check: when, and what GitHub said (`null`: no release yet). */
export interface StoredCheck {
  checkedAt: string;
  latest: LatestRelease | null;
}

export interface UpdateStore {
  get(): StoredCheck | null;
  put(check: StoredCheck): void;
}

/** The last check as one row of the `settings` table (as `srs.state` and `voice.cpOffers` are). */
export function settingsUpdateStore(db: Db): UpdateStore {
  return {
    get() {
      const row = get<{ value_json: string }>(
        db,
        "SELECT value_json FROM settings WHERE key = ?",
        UPDATE_CHECK_KEY,
      );
      const v = row === null ? null : fromJson<unknown>(row.value_json, null);
      if (typeof v !== "object" || v === null) return null;
      const c = v as Record<string, unknown>;
      if (typeof c.checkedAt !== "string" || !Number.isFinite(Date.parse(c.checkedAt))) return null;
      const l = c.latest as Record<string, unknown> | null | undefined;
      const latest =
        l &&
        typeof l.version === "string" &&
        parseVersion(l.version) !== null &&
        releaseLink(l.url) !== null &&
        releaseLink(l.notesUrl) !== null
          ? { version: l.version, url: l.url as string, notesUrl: l.notesUrl as string }
          : null;
      return { checkedAt: c.checkedAt, latest };
    },
    put(check) {
      run(
        db,
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
        UPDATE_CHECK_KEY,
        toJson(check),
        check.checkedAt,
      );
    },
  };
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface UpdateCheckerDeps {
  /** This app's version; `null` when the server is not the desktop app's (then nothing is ever asked). */
  current: string | null;
  /** The learner's "Check for new versions" setting. */
  enabled: () => boolean;
  fetch: FetchLike;
  now: () => Date;
  store?: UpdateStore;
  timeoutMs?: number;
  log?: (msg: string) => void;
}

export class UpdateChecker {
  private last: StoredCheck | null = null;
  private loaded = false;
  private failedAt: number | null = null;
  private inflight: Promise<void> | null = null;

  constructor(private readonly d: UpdateCheckerDeps) {}

  /** A newer release than this app, or `null`. Asks GitHub first when the last answer is over a day old. */
  async update(): Promise<AppUpdate | null> {
    if (this.d.current === null || !this.d.enabled()) return null;
    if (this.due()) {
      this.inflight ??= this.check().finally(() => {
        this.inflight = null;
      });
      await this.inflight;
    }
    return this.answer();
  }

  /** The cached answer, without asking. */
  answer(): AppUpdate | null {
    const current = this.d.current;
    const latest = this.stored()?.latest ?? null;
    if (current === null || latest === null || !isNewer(latest.version, current)) return null;
    return { current, latest: latest.version, url: latest.url, notesUrl: latest.notesUrl };
  }

  private stored(): StoredCheck | null {
    if (!this.loaded) {
      this.loaded = true;
      try {
        this.last = this.d.store?.get() ?? null;
      } catch {
        this.last = null;
      }
    }
    return this.last;
  }

  /** Whether it is time to ask: no answer yet, or one over a day old (or from the future), and no failure this hour. */
  private due(): boolean {
    const now = this.d.now().getTime();
    if (this.failedAt !== null && now - this.failedAt >= 0 && now - this.failedAt < RETRY_AFTER_MS)
      return false;
    const last = this.stored();
    if (last === null) return true;
    const age = now - Date.parse(last.checkedAt);
    return !(age >= 0 && age < CHECK_EVERY_MS);
  }

  private async check(): Promise<void> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.d.timeoutMs ?? TIMEOUT_MS);
    try {
      const res = await this.d.fetch(RELEASES_API, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Oak-desktop",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        credentials: "omit",
        redirect: "follow",
        signal: ctrl.signal,
      });
      // 404: the repository has no release yet. A successful answer either way.
      const latest = res.status === 404 ? null : res.ok ? readRelease(await res.json()) : undefined;
      if (latest === undefined) throw new Error(`GitHub answered ${res.status}`);
      const check = { checkedAt: this.d.now().toISOString(), latest };
      this.last = check;
      this.loaded = true;
      this.failedAt = null;
      try {
        this.d.store?.put(check);
      } catch {
        // The memory copy is enough until the next start.
      }
    } catch (e) {
      this.failedAt = this.d.now().getTime();
      this.d.log?.(`update check failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
