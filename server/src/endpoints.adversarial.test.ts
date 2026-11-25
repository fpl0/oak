// Every endpoint of the contract, Wave 2's included, against the rules of contracts §11.1 and §11.6:
// Host, Origin, X-Oak (or Sec-Fetch-Site for the three media GETs), no dev route without OAK_DEV, a body
// limit enforced while the body streams, a nonce on every destructive action, and hostile path parameters
// that never reach a 500 or a file outside the data directory. Also: the scripted fake tutor exists only
// in dev, and an upload that is not audio is never stored or served.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { contract, type EndpointName } from "@oak/api";
import { fakeTutorEnabled } from "./app.ts";
import { loadConfig, testConfig } from "./config.ts";
import { BINARY_LIMITS, MAX_JSON_BYTES } from "./routes/define.ts";
import { BROWSER, type Harness, harness } from "./testing/harness.ts";

type Def = {
  method: string;
  path: string;
  body?: unknown;
  res?: unknown;
  media?: true;
  confirm?: string;
  params?: unknown;
};
const ENDPOINTS = Object.entries(contract as Record<string, Def>).map(([name, def]) => ({
  name: name as EndpointName,
  ...def,
}));
const fill = (path: string, value = "x") => `/api${path.replace(/:[A-Za-z]+/g, value)}`;
const isDev = (path: string) => path.startsWith("/dev");

let h: Harness;
let dev: Harness;
beforeAll(async () => {
  h = await harness();
  dev = await harness({ dev: true });
});
afterAll(async () => {
  await h.close();
  await dev.close();
});

describe("§11.1 on every endpoint of the contract", () => {
  test("the contract is walked whole (Wave 2 endpoints included)", () => {
    const names = ENDPOINTS.map((e) => e.name as string);
    for (const n of [
      "session.summary",
      "lessons.steps",
      "lessons.position",
      "capstones.release",
      "unlocks.next",
    ])
      expect(names).toContain(n);
    expect(ENDPOINTS.length).toBeGreaterThan(60);
  });

  test("a foreign Host is refused before anything else, on every endpoint", async () => {
    for (const e of ENDPOINTS) {
      const res = await dev.req(e.method, fill(e.path), undefined, { host: "rebind.example:8787" });
      expect({ e: e.name, status: res.status }).toEqual({ e: e.name, status: 403 });
    }
  });

  test("a request without X-Oak is refused (media GETs: without Sec-Fetch-Site same-origin)", async () => {
    for (const e of ENDPOINTS) {
      const headers: Record<string, string> = { "x-oak": "0" };
      if (e.media) headers["sec-fetch-site"] = "cross-site";
      const res = await dev.req(e.method, fill(e.path), undefined, headers);
      expect({ e: e.name, status: res.status }).toEqual({ e: e.name, status: 403 });
    }
  });

  test("a write from a foreign Origin, or with no Origin at all, is refused", async () => {
    for (const e of ENDPOINTS.filter((x) => x.method !== "GET")) {
      const foreign = await dev.req(e.method, fill(e.path), undefined, { origin: "https://evil.example" });
      expect({ e: e.name, status: foreign.status }).toEqual({ e: e.name, status: 403 });
      const res = await dev.server.app.request(`http://127.0.0.1:8787${fill(e.path)}`, {
        method: e.method,
        headers: { host: BROWSER.host, "x-oak": "1" },
      });
      expect({ e: e.name, status: res.status }).toEqual({ e: e.name, status: 403 });
      for (const k of res.headers.keys()) expect(k.startsWith("access-control-")).toBe(false);
    }
  });

  test("no /api/dev endpoint exists without OAK_DEV, whatever the method or encoding", async () => {
    const devEndpoints = ENDPOINTS.filter((e) => isDev(e.path));
    expect(devEndpoints.length).toBeGreaterThanOrEqual(5);
    for (const e of devEndpoints) {
      for (const path of [
        fill(e.path),
        fill(e.path).replace("/dev", "/%64ev"),
        fill(e.path).replace("/dev", "/DEV"),
      ]) {
        const res = await h.req(e.method, path, {});
        expect({ e: e.name, path, status: res.status }).toEqual({ e: e.name, path, status: 404 });
      }
    }
  });
});

describe("bodies and parameters", () => {
  test("a JSON body over the limit is refused with 413 on every JSON endpoint, before it is parsed", async () => {
    // Tutor turns (SSE) are the tutor service's own routes with their own limit (server/src/tutor/http).
    for (const e of ENDPOINTS.filter(
      (x) => typeof x.body === "object" && !isDev(x.path) && x.res !== "sse",
    )) {
      const res = await h.server.app.request(`http://127.0.0.1:8787${fill(e.path)}`, {
        method: e.method,
        headers: {
          ...BROWSER,
          "content-type": "application/json",
          "content-length": String(MAX_JSON_BYTES + 1),
        },
        body: "{}",
      });
      // A path parameter that fails validation is refused first (nothing is read either).
      const body = (await res.json()) as { error: { message: string } };
      const ok =
        res.status === 413 || (res.status === 400 && body.error.message === "invalid path parameters");
      expect({ e: e.name, status: res.status, ok }).toEqual({ e: e.name, status: res.status, ok: true });
    }
  });

  test("audio and peaks uploads have their own limits, refused from Content-Length alone", async () => {
    for (const [name, limit] of Object.entries(BINARY_LIMITS)) {
      const e = ENDPOINTS.find((x) => x.name === name) as Def;
      const path = `${fill(e.path, "1")}${name === "audio.upload" ? "?name=a.wav" : name === "album.putAudio" ? "?durationS=1" : ""}`;
      const res = await h.server.app.request(`http://127.0.0.1:8787${path}`, {
        method: e.method,
        headers: { ...BROWSER, "content-type": "audio/wav", "content-length": String((limit as number) + 1) },
        body: new Uint8Array(16),
      });
      expect({ name, status: res.status }).toEqual({ name, status: 413 });
    }
    expect(BINARY_LIMITS["audio.putPeaks"]).toBe(16 * 1024 * 1024);
  });

  test("hostile path parameters never reach a 500, and never serve a file", async () => {
    const hostile = [
      "..%2F..%2F..%2Fetc%2Fpasswd",
      "%2e%2e%2f%2e%2e%2foak.db",
      "..",
      "%00",
      "a%0d%0aSet-Cookie:%20x=1",
      "x".repeat(4000),
      "%E0%A4%A",
      "%7Bconstructor%7D",
      "U01.L01%2F..%2FU09.L01",
    ];
    const problems: string[] = [];
    for (const e of ENDPOINTS.filter((x) => x.path.includes(":"))) {
      for (const v of hostile) {
        const res = await dev.req(e.method, fill(e.path, v), e.method === "GET" ? undefined : {});
        // 503: a service that is down; 501: the typed stub of an endpoint not built yet (wave3.md §5).
        if (res.status >= 500 && res.status !== 503 && res.status !== 501)
          problems.push(`${e.name} ${v.slice(0, 20)} → ${res.status}`);
        if (e.res === "binary" && res.status === 200)
          problems.push(`${e.name} ${v.slice(0, 20)} served a file`);
        await res.arrayBuffer();
      }
    }
    expect(problems).toEqual([]);
  });

  test("an upload that is not audio is refused, whatever its declared type", async () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>".padEnd(64, " "));
    const res = await h.req("POST", "/api/audio?name=song.wav", html, { "content-type": "audio/wav" });
    expect(res.status).toBe(400);
    expect(h.server.deps.repos.audio.list()).toEqual([]);
    expect(
      existsSync(h.server.deps.config.audioDir) ? readdirSync(h.server.deps.config.audioDir) : [],
    ).toEqual([]);
  });
});

describe("§11.6: every destructive endpoint needs its own nonce", () => {
  const destructive = ENDPOINTS.filter((e) => e.confirm !== undefined);
  test("every endpoint of §11.6 is marked destructive (Oak 2.0 adds scraps.delete and templates.delete)", () => {
    expect(destructive.map((e) => e.name as string).sort()).toEqual(
      [
        "album.deleteTrack",
        "audio.delete",
        "backup.import",
        "data.reset",
        "scraps.delete",
        "settings.anthropicKey.delete",
        "sketches.delete",
        "templates.delete",
        "transcriptions.delete",
      ].sort(),
    );
  });

  test("without a nonce, or with one for another action or target, nothing happens", async () => {
    for (const e of destructive) {
      const path = fill(e.path, "target-1");
      const body = e.body === "binary" ? new Uint8Array([80, 75, 3, 4]) : undefined;
      const none = await h.req(e.method, path, body);
      expect({ e: e.name, status: none.status }).toEqual({ e: e.name, status: 428 });
      // A nonce for another action.
      const otherAction = destructive.find((x) => x.confirm !== e.confirm)?.confirm as string;
      const a = (await (
        await h.req("POST", "/api/confirm", { action: otherAction, target: "target-1" })
      ).json()) as {
        nonce: string;
      };
      const wrongAction = await h.req(e.method, path, body, { "x-oak-confirm": a.nonce });
      expect({ e: e.name, status: wrongAction.status }).toEqual({ e: e.name, status: 428 });
      // A nonce for this action on another target (endpoints with an :id).
      if (e.path.includes(":id")) {
        const b = (await (
          await h.req("POST", "/api/confirm", { action: e.confirm, target: "target-2" })
        ).json()) as {
          nonce: string;
        };
        const wrongTarget = await h.req(e.method, path, body, { "x-oak-confirm": b.nonce });
        expect({ e: e.name, status: wrongTarget.status }).toEqual({ e: e.name, status: 428 });
      }
    }
  });
});

describe("the scripted fake tutor is dev-only", () => {
  test("OAK_TUTOR_FAKE without OAK_DEV is ignored by the config and by the server", () => {
    expect(loadConfig({ env: { OAK_TUTOR_FAKE: "1" }, argv: [] }).tutorFake).toBe(false);
    expect(loadConfig({ env: { OAK_TUTOR_FAKE: "1", OAK_DEV: "1" }, argv: [] }).tutorFake).toBe(true);
    // A config built by hand (a test, a future caller) gets the same rule from createServer.
    expect(fakeTutorEnabled(testConfig("/tmp/x", { tutorFake: true, dev: false }))).toBe(false);
    expect(fakeTutorEnabled(testConfig("/tmp/x", { tutorFake: true, dev: true }))).toBe(true);
  });
});
