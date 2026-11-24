import { afterEach, describe, expect, test } from "bun:test";
import { AppUpdateSchema } from "@oak/api";
import { loadConfig } from "../config.ts";
import { type Harness, harness } from "../testing/harness.ts";
import {
  CHECK_EVERY_MS,
  compareVersions,
  type FetchLike,
  isNewer,
  RELEASES_API,
  RETRY_AFTER_MS,
  readRelease,
  type StoredCheck,
  settingsUpdateStore,
  UpdateChecker,
  type UpdateStore,
} from "./app-update.ts";

const release = (tag: string, over: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: `Oak ${tag.slice(1)}`,
  html_url: `https://github.com/fpl0/oak/releases/tag/${tag}`,
  draft: false,
  prerelease: false,
  assets: [
    {
      name: "Oak-macos-arm64.dmg",
      browser_download_url: `https://github.com/fpl0/oak/releases/download/${tag}/Oak-macos-arm64.dmg`,
    },
    {
      name: "SHA256SUMS",
      browser_download_url: `https://github.com/fpl0/oak/releases/download/${tag}/SHA256SUMS`,
    },
  ],
  ...over,
});

/** A fetch that answers from a queue and records every call; no network. */
function fakeFetch(...answers: (Response | Error | "hang")[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: FetchLike = (url, init) => {
    calls.push({ url, init });
    const a = answers.shift() ?? new Error("no answer queued");
    if (a === "hang")
      return new Promise((_, reject) =>
        init.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      );
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
  };
  return { fn, calls };
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

function memoryStore(initial: StoredCheck | null = null) {
  const s = { value: initial, puts: 0 };
  const store: UpdateStore = {
    get: () => s.value,
    put: (c) => {
      s.value = c;
      s.puts++;
    },
  };
  return { s, store };
}

function checker(opts: {
  fetch: FetchLike;
  current?: string | null;
  enabled?: () => boolean;
  store?: UpdateStore;
  at?: { t: number };
  timeoutMs?: number;
}) {
  const at = opts.at ?? { t: Date.parse("2026-11-24T12:00:00Z") };
  return {
    at,
    c: new UpdateChecker({
      current: opts.current === undefined ? "1.3.2" : opts.current,
      enabled: opts.enabled ?? (() => true),
      fetch: opts.fetch,
      now: () => new Date(at.t),
      ...(opts.store ? { store: opts.store } : {}),
      ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
    }),
  };
}

describe("versions", () => {
  test("semver order, with or without the v", () => {
    expect(compareVersions("1.3.3", "1.3.2")).toBeGreaterThan(0);
    expect(compareVersions("v1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.3.2", "v1.3.2")).toBe(0);
    expect(compareVersions("1.3.1", "1.3.2")).toBeLessThan(0);
    expect(compareVersions("1.4.0-beta.1", "1.4.0")).toBeLessThan(0);
    expect(compareVersions("1.4.0", "1.4.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("1.3", "1.3.2")).toBeNull();
    expect(compareVersions("latest", "1.3.2")).toBeNull();
  });

  test("isNewer: only a strictly newer version; nonsense is never newer", () => {
    expect(isNewer("1.3.3", "1.3.2")).toBe(true);
    expect(isNewer("1.3.2", "1.3.2")).toBe(false);
    expect(isNewer("1.3.1", "1.3.2")).toBe(false);
    expect(isNewer("1.3.2", "1.3.2-dev")).toBe(true);
    expect(isNewer("garbage", "1.3.2")).toBe(false);
  });
});

describe("readRelease", () => {
  test("takes the version, the DMG and the release page", () => {
    expect(readRelease(release("v1.3.3"))).toEqual({
      version: "1.3.3",
      url: "https://github.com/fpl0/oak/releases/download/v1.3.3/Oak-macos-arm64.dmg",
      notesUrl: "https://github.com/fpl0/oak/releases/tag/v1.3.3",
    });
  });

  test("no DMG: the link is the release page", () => {
    expect(readRelease(release("v1.3.3", { assets: [] }))?.url).toBe(
      "https://github.com/fpl0/oak/releases/tag/v1.3.3",
    );
  });

  test("links that leave Oak's releases are replaced, never passed on", () => {
    const r = readRelease(
      release("v1.3.3", {
        html_url: "https://evil.example/releases/tag/v1.3.3",
        assets: [{ name: "Oak-macos-arm64.dmg", browser_download_url: "https://evil.example/Oak.dmg" }],
      }),
    );
    expect(r).toEqual({
      version: "1.3.3",
      url: "https://github.com/fpl0/oak/releases/tag/v1.3.3",
      notesUrl: "https://github.com/fpl0/oak/releases/tag/v1.3.3",
    });
  });

  test("drafts, pre-releases and malformed answers are nothing", () => {
    expect(readRelease(release("v1.4.0", { draft: true }))).toBeNull();
    expect(readRelease(release("v1.4.0", { prerelease: true }))).toBeNull();
    expect(readRelease(release("v1.4.0-beta.1"))).toBeNull();
    expect(readRelease(release("nightly"))).toBeNull();
    expect(readRelease({ message: "Not Found" })).toBeNull();
    expect(readRelease(null)).toBeNull();
    expect(readRelease("v1.4.0")).toBeNull();
  });
});

describe("UpdateChecker", () => {
  test("a newer release: the answer, from one plain GET with no user data", async () => {
    const f = fakeFetch(json(release("v1.3.3")));
    const { c } = checker({ fetch: f.fn });
    const u = await c.update();
    expect(u).toEqual({
      current: "1.3.2",
      latest: "1.3.3",
      url: "https://github.com/fpl0/oak/releases/download/v1.3.3/Oak-macos-arm64.dmg",
      notesUrl: "https://github.com/fpl0/oak/releases/tag/v1.3.3",
    });
    expect(AppUpdateSchema.parse(u)).toEqual(u as never);
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0];
    expect(call?.url).toBe(RELEASES_API);
    expect(call?.init.method).toBe("GET");
    expect(call?.init.body).toBeUndefined();
    expect(call?.init.credentials).toBe("omit");
    expect(call?.init.headers).toEqual({
      Accept: "application/vnd.github+json",
      "User-Agent": "Oak-desktop",
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });

  test("the same or an older release: null", async () => {
    expect(await checker({ fetch: fakeFetch(json(release("v1.3.2"))).fn }).c.update()).toBeNull();
    expect(await checker({ fetch: fakeFetch(json(release("v1.3.1"))).fn }).c.update()).toBeNull();
  });

  test("not the desktop app, or the setting off: nothing is asked", async () => {
    const f = fakeFetch(json(release("v1.3.3")));
    expect(await checker({ fetch: f.fn, current: null }).c.update()).toBeNull();
    expect(await checker({ fetch: f.fn, enabled: () => false }).c.update()).toBeNull();
    expect(f.calls).toHaveLength(0);
  });

  test("asks at most once a day; the answer is remembered in between", async () => {
    const f = fakeFetch(json(release("v1.3.3")), json(release("v1.4.0")));
    const { c, at } = checker({ fetch: f.fn });
    expect((await c.update())?.latest).toBe("1.3.3");
    at.t += CHECK_EVERY_MS - 1;
    expect((await c.update())?.latest).toBe("1.3.3");
    expect(f.calls).toHaveLength(1);
    at.t += 1;
    expect((await c.update())?.latest).toBe("1.4.0");
    expect(f.calls).toHaveLength(2);
  });

  test("calls at the same time share one request", async () => {
    const f = fakeFetch(json(release("v1.3.3")));
    const { c } = checker({ fetch: f.fn });
    const [a, b] = await Promise.all([c.update(), c.update()]);
    expect(a?.latest).toBe("1.3.3");
    expect(b?.latest).toBe("1.3.3");
    expect(f.calls).toHaveLength(1);
  });

  test("offline, rate-limited or slow: silently null, and the next try is an hour later", async () => {
    const f = fakeFetch(
      new Error("offline"),
      json({ message: "rate limited" }, 403),
      "hang",
      json(release("v1.3.3")),
    );
    const { c, at } = checker({ fetch: f.fn, timeoutMs: 20 });
    expect(await c.update()).toBeNull();
    expect(await c.update()).toBeNull(); // within the hour: not asked again
    expect(f.calls).toHaveLength(1);
    at.t += RETRY_AFTER_MS;
    expect(await c.update()).toBeNull(); // 403
    at.t += RETRY_AFTER_MS;
    expect(await c.update()).toBeNull(); // timed out
    expect(f.calls[2]?.init.signal?.aborted).toBe(true);
    at.t += RETRY_AFTER_MS;
    expect((await c.update())?.latest).toBe("1.3.3");
    expect(f.calls).toHaveLength(4);
  });

  test("a failure keeps the last good answer", async () => {
    const f = fakeFetch(json(release("v1.3.3")), new Error("offline"));
    const { c, at } = checker({ fetch: f.fn });
    expect((await c.update())?.latest).toBe("1.3.3");
    at.t += CHECK_EVERY_MS;
    expect((await c.update())?.latest).toBe("1.3.3");
    expect(f.calls).toHaveLength(2);
  });

  test("no release yet (404) counts as an answer", async () => {
    const f = fakeFetch(json({ message: "Not Found" }, 404));
    const { c } = checker({ fetch: f.fn });
    expect(await c.update()).toBeNull();
    expect(await c.update()).toBeNull();
    expect(f.calls).toHaveLength(1);
  });

  test("the stored check survives a restart: a fresh one asks nothing, a stale one asks again", async () => {
    const mem = memoryStore();
    const first = checker({ fetch: fakeFetch(json(release("v1.3.3"))).fn, store: mem.store });
    await first.c.update();
    expect(mem.s.puts).toBe(1);
    expect(mem.s.value?.latest?.version).toBe("1.3.3");

    const quiet = fakeFetch();
    const restarted = checker({ fetch: quiet.fn, store: mem.store, at: { t: first.at.t + 60_000 } });
    expect((await restarted.c.update())?.latest).toBe("1.3.3");
    expect(quiet.calls).toHaveLength(0);

    const later = fakeFetch(json(release("v1.3.4")));
    const nextDay = checker({ fetch: later.fn, store: mem.store, at: { t: first.at.t + CHECK_EVERY_MS } });
    expect((await nextDay.c.update())?.latest).toBe("1.3.4");
    expect(later.calls).toHaveLength(1);
  });

  test("an update to this very version is no longer news", async () => {
    const mem = memoryStore({
      checkedAt: "2026-11-24T11:00:00.000Z",
      latest: {
        version: "1.3.3",
        url: "https://github.com/fpl0/oak/releases/download/v1.3.3/Oak-macos-arm64.dmg",
        notesUrl: "https://github.com/fpl0/oak/releases/tag/v1.3.3",
      },
    });
    const f = fakeFetch();
    expect(await checker({ fetch: f.fn, store: mem.store, current: "1.3.3" }).c.update()).toBeNull();
    expect(f.calls).toHaveLength(0);
  });
});

test("only the desktop app's server (OAK_APP_VERSION, not dev) is the desktop app", () => {
  const cfg = (env: Record<string, string>) =>
    loadConfig({ env: { OAK_DATA_DIR: "/tmp/oak-x", ...env }, argv: [] });
  expect(cfg({ OAK_APP_VERSION: "1.3.2" }).desktopApp).toBe(true);
  expect(cfg({ OAK_APP_VERSION: " " }).desktopApp).toBe(false);
  expect(cfg({}).desktopApp).toBe(false);
  expect(cfg({ OAK_APP_VERSION: "1.3.2", OAK_DEV: "1" }).desktopApp).toBe(false);
});

describe("GET /api/app/update", () => {
  let h: Harness | null = null;
  afterEach(async () => {
    await h?.close();
    h = null;
  });

  test("a server that is not the desktop app answers null and asks nothing", async () => {
    const f = fakeFetch(json(release("v9.0.0")));
    h = await harness({ updateFetch: f.fn });
    const r = await h.json("GET", "/api/app/update");
    expect(r).toEqual({ status: 200, body: null });
    expect(f.calls).toHaveLength(0);
  });

  test("the desktop app's server answers the update, persists the check, and honours the setting", async () => {
    const f = fakeFetch(json(release("v1.3.3")));
    h = await harness({ updateFetch: f.fn });
    const d = h.server.deps;
    d.updates = new UpdateChecker({
      current: "1.3.2",
      enabled: () => d.repos.settings.get("checkForUpdates") !== false,
      fetch: f.fn,
      now: () => d.clock.now(),
      store: settingsUpdateStore(d.db),
    });
    expect(d.repos.settings.all().checkForUpdates).toBe(true);
    const r = await h.json<{ latest: string }>("GET", "/api/app/update");
    expect(r.status).toBe(200);
    expect(r.body.latest).toBe("1.3.3");
    // Internal row: never listed among the learner's settings.
    expect(Object.keys(d.repos.settings.all())).not.toContain("app.updateCheck");

    const off = await h.json("PUT", "/api/settings/checkForUpdates", { value: false });
    expect(off.status).toBe(200);
    expect(await h.json("GET", "/api/app/update")).toEqual({ status: 200, body: null });
    expect(f.calls).toHaveLength(1);
  });
});
