import { describe, expect, test } from "bun:test";
import { createClient, type FetchLike, OakApiError, TUTOR_ROUTE_OF } from "./client.ts";
import type { Health, Sketch } from "./dto.ts";
import { THREAD_KINDS, type TutorEvent, type TutorTurnRequest } from "./tutor.ts";

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}
function fake(respond: (seen: Seen) => Response | Promise<Response>): { fetch: FetchLike; calls: Seen[] } {
  const calls: Seen[] = [];
  const fetch: FetchLike = async (url, init) => {
    const seen: Seen = {
      url,
      method: init.method ?? "GET",
      headers: { ...(init.headers as Record<string, string>) },
      body: init.body,
    };
    calls.push(seen);
    if (init.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    return respond(seen);
  };
  return { fetch, calls };
}
const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

const health: Health = {
  ok: true,
  appVersion: "0.0.0",
  contractsVersion: "1.9",
  schemaVersion: 1,
  contentVersion: null,
  tutor: "missing_key",
  tutorBackend: null,
  dev: true,
};
const sketch: Sketch = {
  id: "sk1",
  title: "Sketch 001",
  originKind: "free",
  originId: null,
  currentVersion: 1,
  tags: [],
  archived: false,
  listeningNote: null,
  createdAt: "2026-11-11T09:00:00.000Z",
  updatedAt: "2026-11-11T09:00:00.000Z",
};

describe("call", () => {
  test("sends X-Oak: 1 and parses the response with the contract", async () => {
    const f = fake(() => json(health));
    const api = createClient({ fetch: f.fetch });
    const got = await api.call("health");
    expect(got.tutor).toBe("missing_key");
    expect(f.calls[0]).toMatchObject({ url: "/api/health", method: "GET", headers: { "X-Oak": "1" } });
    expect(f.calls[0]?.body).toBeUndefined();
  });

  test("fills path params, encodes JSON bodies, honours baseUrl", async () => {
    const f = fake(() => json(sketch));
    const api = createClient({ fetch: f.fetch, baseUrl: "http://127.0.0.1:8787" });
    await api.call("sketches.patch", { params: { id: "sk1" }, body: { title: "Renamed" } });
    expect(f.calls[0]).toMatchObject({
      url: "http://127.0.0.1:8787/api/sketches/sk1",
      method: "PATCH",
      headers: { "X-Oak": "1", "Content-Type": "application/json" },
    });
    expect(JSON.parse(f.calls[0]?.body as string)).toEqual({ title: "Renamed" });
  });

  test("a request that does not match the contract never leaves the browser", async () => {
    const f = fake(() => json(sketch));
    const api = createClient({ fetch: f.fetch });
    const err = await api
      .call("sketches.patch", { params: { id: "sk1" }, body: { titel: "typo" } as never })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OakApiError);
    expect((err as OakApiError).code).toBe("bad_request");
    expect(f.calls).toHaveLength(0);
    // @ts-expect-error a path parameter is required
    await api.call("sketches.get").catch(() => {});
    // @ts-expect-error unknown endpoint
    await api.call("sketches.nope").catch(() => {});
    expect(f.calls).toHaveLength(0);
  });

  test("a response that does not match the contract is a `contract` error", async () => {
    const api = createClient({ fetch: fake(() => json({ ...health, tutor: "sk-ant-oops" })).fetch });
    const err = (await api.call("health").catch((e: unknown) => e)) as OakApiError;
    expect(err.code).toBe("contract");
    expect(err.issues[0]?.path).toBe("tutor");
  });

  test("server errors map to OakApiError with the server's code; a bare 403 is `forbidden`", async () => {
    const coded = createClient({
      fetch: fake(() => json({ error: { code: "not_found", message: "No such sketch." } }, 404)).fetch,
    });
    expect(
      await coded
        .call("sketches.get", { params: { id: "x" } })
        .catch((e: OakApiError) => [e.status, e.code, e.message]),
    ).toEqual([404, "not_found", "No such sketch."]);
    const bare = createClient({ fetch: fake(() => new Response(null, { status: 403 })).fetch });
    expect(await bare.call("health").catch((e: OakApiError) => [e.status, e.code])).toEqual([
      403,
      "forbidden",
    ]);
    const down = createClient({
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(await down.call("health").catch((e: OakApiError) => [e.status, e.code])).toEqual([0, "network"]);
  });

  test("binary uploads send the bytes untouched; binary downloads return the Response", async () => {
    const bytes = new Uint8Array([82, 73, 70, 70]);
    const f = fake((seen) =>
      seen.method === "POST"
        ? json({
            id: "a".repeat(64),
            originalName: "take 1.wav",
            mime: "audio/wav",
            bytes: 4,
            durationS: null,
            sampleRate: null,
            channels: null,
            hasPeaks: false,
            createdAt: "2026-11-11T09:00:00.000Z",
          })
        : new Response(bytes),
    );
    const api = createClient({ fetch: f.fetch });
    const file = await api.call("audio.upload", {
      query: { name: "take 1.wav" },
      body: bytes,
      contentType: "audio/wav",
    });
    expect(file.bytes).toBe(4);
    expect(f.calls[0]).toMatchObject({
      url: "/api/audio?name=take+1.wav",
      headers: { "Content-Type": "audio/wav", "X-Oak": "1" },
    });
    expect(f.calls[0]?.body).toBe(bytes);
    const res = await api.call("audio.get", { params: { id: file.id } });
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(api.url("audio.get", { params: { id: file.id } })).toBe(`/api/audio/${file.id}`);
    expect(api.url("backup.export", { query: { audio: "0" } })).toBe("/api/backup/export?audio=0");
  });
});

describe("destructive actions (contracts §11.6)", () => {
  test("a destructive call without a nonce is refused before any request", async () => {
    const f = fake(() => json({ ok: true }));
    const api = createClient({ fetch: f.fetch });
    expect(
      await api.call("sketches.delete", { params: { id: "sk1" } }).catch((e: OakApiError) => e.code),
    ).toBe("confirm_required");
    expect(f.calls).toHaveLength(0);
  });

  test("destructive() asks for a nonce bound to (action, target), then sends it in X-Oak-Confirm", async () => {
    const f = fake((seen) =>
      seen.url === "/api/confirm"
        ? json({ nonce: "n".repeat(32), expiresAt: "2026-11-11T09:01:00.000Z" })
        : json({ ok: true }),
    );
    const api = createClient({ fetch: f.fetch });
    expect(await api.destructive("sketches.delete", "sk1", { params: { id: "sk1" } })).toEqual({ ok: true });
    expect(f.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/confirm",
      "DELETE /api/sketches/sk1",
    ]);
    expect(JSON.parse(f.calls[0]?.body as string)).toEqual({ action: "sketch.delete", target: "sk1" });
    expect(f.calls[1]?.headers["X-Oak-Confirm"]).toBe("n".repeat(32));
    expect(f.calls[0]?.headers["X-Oak-Confirm"]).toBeUndefined();
  });
});

describe("tutor streams", () => {
  const turn: TutorTurnRequest = {
    thread: { subjectKind: "lesson", subjectId: "U03.L02" },
    kind: "hint",
    userText: "",
    lessonId: "U03.L02",
    stepId: "S5",
  };
  const usage = {
    backend: "claude-cli",
    requests: 1,
    inputTokens: 10,
    outputTokens: 5,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheCreation1hInputTokens: 0,
    cacheCreation5mInputTokens: 0,
    costUsd: null,
    includedInPlan: true,
    servedBy: ["claude-opus-5-5"],
  };
  const sse = (events: [string, unknown][], tail = ""): string =>
    events.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join("") + tail;
  /** A Response whose body arrives in the given chunks. */
  const chunked = (chunks: string[]): Response => {
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const c of chunks) controller.enqueue(enc.encode(c));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  };
  const meta = {
    conversationId: "lesson:U03.L02:2026-11-11:hint",
    kind: "hint",
    lane: "hint",
    backend: "claude-cli",
    model: "claude-opus-5-5",
    rung: 1,
    revealAllowed: true,
  };
  const done = { stopReason: "end_turn", backend: "claude-cli", iterations: 1, usage };

  test("events arrive in order across arbitrary chunk boundaries, pings are ignored", async () => {
    const wire =
      sse([
        ["meta", meta],
        ["text", { delta: "Which `n` is " }],
      ]) +
      ": ping\n\n" +
      sse([
        ["text", { delta: "degree 1?" }],
        ["usage", usage],
        ["done", done],
      ]);
    for (const size of [1, 7, 64, wire.length]) {
      const chunks = Array.from({ length: Math.ceil(wire.length / size) }, (_, i) =>
        wire.slice(i * size, (i + 1) * size),
      );
      const f = fake(() => chunked(chunks));
      const seen: TutorEvent[] = [];
      const last = await createClient({ fetch: f.fetch }).stream("tutor.hint", turn, {
        onEvent: (e) => seen.push(e),
      });
      expect(seen.map((e) => e.type)).toEqual(["meta", "text", "text", "usage", "done"]);
      expect(seen.flatMap((e) => (e.type === "text" ? [e.data.delta] : [])).join("")).toBe(
        "Which `n` is degree 1?",
      );
      expect(last as TutorEvent).toEqual(seen[4] as TutorEvent);
      expect(f.calls[0]).toMatchObject({
        url: "/api/tutor/hint",
        method: "POST",
        headers: { "X-Oak": "1", Accept: "text/event-stream" },
      });
    }
  });

  test("a multi-byte character split across chunks survives", async () => {
    const bytes = new TextEncoder().encode(
      sse([
        ["text", { delta: "±35¢ ♭7" }],
        ["done", done],
      ]),
    );
    const cut = bytes.indexOf(0xc2) + 1;
    const res = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(bytes.slice(0, cut));
          c.enqueue(bytes.slice(cut));
          c.close();
        },
      }),
    );
    const seen: TutorEvent[] = [];
    await createClient({ fetch: async () => res }).stream(
      "tutor.chat",
      { ...turn, kind: "chat" },
      { onEvent: (e) => seen.push(e) },
    );
    expect(seen[0]).toEqual({ type: "text", data: { delta: "±35¢ ♭7" } });
  });

  test("a stream that ends without done or error is a network error (an idle drop)", async () => {
    const seen: TutorEvent[] = [];
    const last = await createClient({
      fetch: fake(() =>
        chunked([
          sse([
            ["meta", meta],
            ["text", { delta: "Which" }],
          ]),
          'event: text\ndata: {"del',
        ]),
      ).fetch,
    }).stream("tutor.hint", turn, { onEvent: (e) => seen.push(e) });
    expect(last).toEqual({
      type: "error",
      data: { kind: "network", message: "The tutor could not be reached. Check your connection." },
    });
    expect(seen.map((e) => e.type)).toEqual(["meta", "text", "error"]);
  });

  test("frames that are not ours are dropped; nothing after the terminal event is delivered", async () => {
    const wire = `${sse([
      ["meta", meta],
      ["bogus", { x: 1 }],
      ["text", { delta: 3 }],
      ["error", { kind: "refusal", message: "no" }],
      ["text", { delta: "late" }],
    ])}event: error\ndata: Internal Server Error\n\n`;
    const seen: TutorEvent[] = [];
    const last = await createClient({ fetch: fake(() => chunked([wire])).fetch }).stream("tutor.hint", turn, {
      onEvent: (e) => seen.push(e),
    });
    expect(seen.map((e) => e.type)).toEqual(["meta", "error"]);
    expect(last.type === "error" && last.data.kind).toBe("refusal");
  });

  test("HTTP failures and aborts become error events; the promise never rejects", async () => {
    const run = (res: () => Response | Promise<Response>, signal?: AbortSignal) =>
      createClient({ fetch: fake(res).fetch }).stream("tutor.hint", turn, {
        onEvent: () => {},
        ...(signal ? { signal } : {}),
      });
    expect(
      (await run(() => new Response(null, { status: 429, headers: { "Retry-After": "12" } }))).data,
    ).toMatchObject({ kind: "rate_limit", retryAfterSec: 12 });
    expect((await run(() => new Response(null, { status: 500 }))).data).toMatchObject({ kind: "internal" });
    expect((await run(() => new Response(null, { status: 400 }))).data).toMatchObject({
      kind: "bad_request",
    });
    const aborted = new AbortController();
    aborted.abort();
    expect((await run(() => chunked([]), aborted.signal)).data).toMatchObject({
      kind: "aborted",
      message: "Stopped.",
    });
    const bad = await createClient({ fetch: fake(() => chunked([])).fetch }).stream(
      "tutor.hint",
      { ...turn, kind: "panel" as "hint" },
      { onEvent: () => {} },
    );
    expect(bad.data).toMatchObject({ kind: "bad_request" });
  });

  test("every thread kind has a route", () => {
    expect(Object.keys(TUTOR_ROUTE_OF).sort()).toEqual([...THREAD_KINDS].sort());
  });
});
