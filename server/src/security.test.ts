import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { checkApiRequest, contentSecurityPolicy, isMediaGet } from "./security.ts";
import { BROWSER, type Harness, harness } from "./testing/harness.ts";

const cfg = { port: 8787, devPorts: [], dev: false };
const req = (method: string, path: string, headers: Record<string, string>) =>
  new Request(`http://127.0.0.1:8787${path}`, { method, headers });

describe("checkApiRequest (contracts §11.1)", () => {
  test.each<[string, string, string, Record<string, string>, string | null]>([
    ["same-origin GET", "GET", "/api/health", BROWSER, null],
    ["same-origin POST", "POST", "/api/sketches", BROWSER, null],
    [
      "localhost is allowed too",
      "GET",
      "/api/health",
      { ...BROWSER, host: "localhost:8787", origin: "http://localhost:8787" },
      null,
    ],
    [
      "DNS rebinding: a foreign Host",
      "GET",
      "/api/health",
      { ...BROWSER, host: "evil.example:8787" },
      "host",
    ],
    ["the Vite port without OAK_DEV", "GET", "/api/health", { ...BROWSER, host: "127.0.0.1:5173" }, "host"],
    [
      "a cross-origin POST",
      "POST",
      "/api/sketches",
      { ...BROWSER, origin: "https://evil.example" },
      "origin",
    ],
    [
      "a cross-origin GET with an Origin",
      "GET",
      "/api/profile",
      { ...BROWSER, origin: "https://evil.example" },
      "origin",
    ],
    ["a POST without Origin", "POST", "/api/sketches", { host: "127.0.0.1:8787", "x-oak": "1" }, "origin"],
    ["a preflight", "OPTIONS", "/api/sketches", BROWSER, "preflight"],
    [
      "no X-Oak header (a form post or no-cors fetch)",
      "POST",
      "/api/sketches",
      { ...BROWSER, "x-oak": "" },
      "x-oak",
    ],
    [
      "Sec-Fetch-Site cross-site with X-Oak",
      "POST",
      "/api/sketches",
      { ...BROWSER, "sec-fetch-site": "cross-site" },
      "fetch-site",
    ],
    ["a typed navigation GET (none)", "GET", "/api/health", { ...BROWSER, "sec-fetch-site": "none" }, null],
    [
      "media GET from <audio>: same-origin, no X-Oak",
      "GET",
      `/api/audio/${"a".repeat(64)}`,
      { host: "127.0.0.1:8787", "sec-fetch-site": "same-origin" },
      null,
    ],
    [
      "media GET cross-site",
      "GET",
      `/api/audio/${"a".repeat(64)}`,
      { host: "127.0.0.1:8787", "sec-fetch-site": "cross-site" },
      "fetch-site",
    ],
    [
      "media GET without fetch metadata",
      "GET",
      "/api/album/tracks/t/versions/1/audio",
      { host: "127.0.0.1:8787" },
      "fetch-site",
    ],
    [
      "a non-media GET still needs X-Oak",
      "GET",
      "/api/profile",
      { host: "127.0.0.1:8787", "sec-fetch-site": "same-origin" },
      "x-oak",
    ],
  ])("%s", (_name, method, path, headers, expected) => {
    expect(checkApiRequest(req(method, path, headers), cfg)).toBe(expected as never);
  });

  test("in dev the Vite port is an allowed Host and Origin", () => {
    const dev = { port: 8787, devPorts: [5173], dev: true };
    expect(
      checkApiRequest(
        req("POST", "/api/sketches", { ...BROWSER, host: "localhost:5173", origin: "http://localhost:5173" }),
        dev,
      ),
    ).toBeNull();
  });

  test("in dev any loopback port is allowed (several Vite stacks side by side); production stays exact", () => {
    const dev = { port: 8801, devPorts: [5173], dev: true };
    const at = (host: string, origin = `http://${host}`) =>
      req("POST", "/api/sketches", { ...BROWSER, host, origin });
    expect(checkApiRequest(at("127.0.0.1:5201"), dev)).toBeNull();
    expect(checkApiRequest(at("localhost:5299"), dev)).toBeNull();
    expect(checkApiRequest(at("127.0.0.1:5201", "http://localhost:5207"), dev)).toBeNull();
    // Still refused in dev: another host, another loopback address, a port out of range, https, a suffix.
    expect(checkApiRequest(at("evil.example:5201"), dev)).toBe("host");
    expect(checkApiRequest(at("127.0.0.2:5201"), dev)).toBe("host");
    expect(checkApiRequest(at("127.0.0.1:70000"), dev)).toBe("host");
    expect(checkApiRequest(at("127.0.0.1:0"), dev)).toBe("host");
    expect(checkApiRequest(at("127.0.0.1:5201", "https://127.0.0.1:5201"), dev)).toBe("origin");
    expect(checkApiRequest(at("127.0.0.1:5201", "http://127.0.0.1:5201.evil.example"), dev)).toBe("origin");
    expect(checkApiRequest(at("127.0.0.1:5201", "http://127.0.0.1:5201/x"), dev)).toBe("origin");
    // Production: only the server's own port.
    const prod = { port: 8801, devPorts: [], dev: false };
    expect(checkApiRequest(at("127.0.0.1:5201"), prod)).toBe("host");
    expect(checkApiRequest(at("127.0.0.1:8801", "http://127.0.0.1:5201"), prod)).toBe("origin");
    expect(checkApiRequest(at("127.0.0.1:8801"), prod)).toBeNull();
  });

  test("exactly three media GETs", () => {
    expect(isMediaGet("GET", "/api/audio/abc")).toBe(true);
    expect(isMediaGet("GET", "/api/audio/abc/peaks")).toBe(true);
    expect(isMediaGet("GET", "/api/album/tracks/t1/versions/2/audio")).toBe(true);
    expect(isMediaGet("PUT", "/api/audio/abc/peaks")).toBe(false);
    expect(isMediaGet("GET", "/api/audio")).toBe(false);
    expect(isMediaGet("GET", "/api/backup/export")).toBe(false);
  });

  test("the CSP of §11.2", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("script-src 'self' 'unsafe-eval' data: blob:");
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy(true)).toContain(
      "connect-src 'self' ws://127.0.0.1:5173 ws://localhost:5173",
    );
  });
});

describe("the app refuses what the rules refuse", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await harness();
  });
  afterAll(async () => {
    await h.close();
  });

  test("a cross-origin request gets 403 with the error body and no CORS header", async () => {
    const res = await h.req("POST", "/api/sketches", {}, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("forbidden");
    for (const k of res.headers.keys()) expect(k.startsWith("access-control-")).toBe(false);
  });

  test("a preflight gets 403", async () => {
    const res = await h.server.app.request("http://127.0.0.1:8787/api/sketches", {
      method: "OPTIONS",
      headers: {
        host: "127.0.0.1:8787",
        origin: "https://evil.example",
        "access-control-request-method": "POST",
      },
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("a foreign Host gets 403 everywhere, sounds included", async () => {
    expect((await h.req("GET", "/api/health", undefined, { host: "rebind.example:8787" })).status).toBe(403);
    expect(
      (await h.req("GET", "/sounds/manifest.json", undefined, { host: "rebind.example:8787" })).status,
    ).toBe(403);
  });

  test("/api/dev/* does not exist without OAK_DEV", async () => {
    expect((await h.req("GET", "/api/dev/seed")).status).toBe(404);
    expect((await h.req("GET", "/api/dev/qa")).status).toBe(404);
    // Grading reports, your sessions and the listening pass are in every build, under the same checks as the rest.
    for (const p of ["/api/qa/reports", "/api/telemetry", "/api/listen"]) {
      expect([p, (await h.req("GET", p)).status]).toEqual([p, 200]);
      expect([p, (await h.req("GET", p, undefined, { host: "rebind.example:8787" })).status]).toEqual([
        p,
        403,
      ]);
    }
    const dev = await harness({ dev: true });
    try {
      expect((await dev.req("GET", "/api/dev/seed")).status).toBe(200);
    } finally {
      await dev.close();
    }
  });

  test("a destructive endpoint needs a fresh nonce for its action and target", async () => {
    expect((await h.req("POST", "/api/data/reset")).status).toBe(428);
    const { nonce } = (await (
      await h.req("POST", "/api/confirm", { action: "data.reset", target: "*" })
    ).json()) as { nonce: string };
    expect((await h.req("POST", "/api/data/reset", undefined, { "x-oak-confirm": nonce })).status).toBe(200);
    // Single use.
    expect((await h.req("POST", "/api/data/reset", undefined, { "x-oak-confirm": nonce })).status).toBe(428);
    // Bound to its action.
    const other = (await (
      await h.req("POST", "/api/confirm", { action: "sketch.delete", target: "*" })
    ).json()) as { nonce: string };
    expect((await h.req("POST", "/api/data/reset", undefined, { "x-oak-confirm": other.nonce })).status).toBe(
      428,
    );
    // Expires after 60 s.
    const late = (await (
      await h.req("POST", "/api/confirm", { action: "data.reset", target: "*" })
    ).json()) as { nonce: string };
    h.clock.advance(61_000);
    expect((await h.req("POST", "/api/data/reset", undefined, { "x-oak-confirm": late.nonce })).status).toBe(
      428,
    );
  });

  test("the API key never appears in health or bootstrap", async () => {
    const key = `sk-ant-secret-${"k".repeat(30)}`;
    await h.req("POST", "/api/settings/anthropic-key", { key });
    for (const path of ["/api/health", "/api/bootstrap"])
      expect(await (await h.req("GET", path)).text()).not.toContain(key);
  });
});

describe("static files", () => {
  test("the sound pack is served with the manifest no-cache and files immutable with Range; HTML gets the CSP", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const h = await harness();
    try {
      const sounds = h.server.deps.config.soundsDir;
      mkdirSync(join(sounds, "v1", "piano dir"), { recursive: true });
      writeFileSync(join(sounds, "v1", "manifest.json"), JSON.stringify({ packVersion: "v1" }));
      writeFileSync(join(sounds, "v1", "piano dir", "C4.mp3"), new Uint8Array([1, 2, 3, 4, 5]));
      const m = await h.req("GET", "/sounds/manifest.json");
      expect(m.status).toBe(200);
      expect(m.headers.get("cache-control")).toBe("no-cache");
      const f = await h.req("GET", "/sounds/v1/piano%20dir/C4.mp3", undefined, { range: "bytes=1-2" });
      expect(f.status).toBe(206);
      expect(f.headers.get("cache-control")).toContain("immutable");
      expect(new Uint8Array(await f.arrayBuffer())).toEqual(new Uint8Array([2, 3]));
      expect((await h.req("GET", "/sounds/v1/..%2F..%2Foak.db")).status).toBe(404);
    } finally {
      await h.close();
    }
    const dist = await harness();
    try {
      const { config } = dist.server.deps;
      // A second server over the same config but serving dist/.
      const { createServer } = await import("./app.ts");
      const { fixtureContent } = await import("./content/fixture.ts");
      mkdirSync(config.distDir, { recursive: true });
      writeFileSync(join(config.distDir, "index.html"), "<!doctype html><title>Oak</title>");
      const s = await createServer({
        config: { ...config, serveDist: true, dbPath: ":memory:" },
        content: fixtureContent(),
        graders: { learner: () => dist.learner, tutor: () => dist.tutorHost },
        tutor: false,
        env: {},
        log: () => {},
      });
      const page = await s.app.request("http://127.0.0.1:8787/learn/U01.L01", {
        headers: { host: "127.0.0.1:8787" },
      });
      expect(page.status).toBe(200);
      expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(await page.text()).toContain("<title>Oak</title>");
      const api = await s.app.request("http://127.0.0.1:8787/api/nope", { headers: BROWSER });
      expect(api.status).toBe(404);
      expect(api.headers.get("content-type")).toContain("application/json");
      await s.close();
    } finally {
      await dist.close();
    }
  });

  test("carry f2 (contracts §11.2, 1.8): /offline-render.html alone may be framed, and only by Oak", async () => {
    const dist = await harness();
    try {
      const { config } = dist.server.deps;
      const { createServer } = await import("./app.ts");
      const { fixtureContent } = await import("./content/fixture.ts");
      const { mkdirSync, rmSync, writeFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      mkdirSync(join(config.distDir, "assets"), { recursive: true });
      writeFileSync(join(config.distDir, "index.html"), "<!doctype html><title>Oak</title>");
      writeFileSync(join(config.distDir, "offline-render.html"), "<!doctype html><title>Oak render</title>");
      writeFileSync(join(config.distDir, "other.html"), "<!doctype html><title>Other</title>");
      writeFileSync(join(config.distDir, "assets", "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
      const s = await createServer({
        config: { ...config, serveDist: true, dbPath: ":memory:" },
        content: fixtureContent(),
        graders: { learner: () => dist.learner, tutor: () => dist.tutorHost },
        tutor: false,
        env: {},
        log: () => {},
      });
      const get = (path: string) => s.app.request(`http://127.0.0.1:8787${path}`, { headers: BROWSER });
      const frame = await get("/offline-render.html");
      expect(frame.status).toBe(200);
      expect(await frame.text()).toContain("Oak render");
      const fcsp = frame.headers.get("content-security-policy") ?? "";
      expect(fcsp).toContain("frame-ancestors 'self'");
      expect(fcsp).not.toContain("frame-ancestors 'none'");
      expect(fcsp).toContain("default-src 'self'");
      expect(frame.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(frame.headers.get("x-content-type-options")).toBe("nosniff");
      // With a query string it is the same document; every other document keeps 'none' and DENY: the SPA routes,
      // the app's index, another HTML file, a path that only looks like the frame, an SVG.
      expect((await get("/offline-render.html?x=1")).headers.get("x-frame-options")).toBe("SAMEORIGIN");
      for (const path of [
        "/",
        "/learn/U01.L01",
        "/album",
        "/index.html",
        "/other.html",
        "/offline-render.html/",
        "/x/offline-render.html",
        "/OFFLINE-RENDER.HTML",
        "/assets/logo.svg",
      ]) {
        const r = await get(path);
        const type = r.headers.get("content-type") ?? "";
        if (!type.includes("html") && !type.includes("svg")) continue;
        expect({
          path,
          csp: r.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"),
        }).toEqual({
          path,
          csp: true,
        });
        expect({ path, xfo: r.headers.get("x-frame-options") }).toEqual({ path, xfo: "DENY" });
      }
      // Without a built frame page the path is not answered with the app's own document.
      rmSync(join(config.distDir, "offline-render.html"));
      expect((await get("/offline-render.html")).status).toBe(404);
      await s.close();
    } finally {
      await dist.close();
    }
  });
});
