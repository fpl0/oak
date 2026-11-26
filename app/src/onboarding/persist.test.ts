import { describe, expect, test } from "bun:test";
import { OakApiError, type OnboardingPatch, type OnboardingState } from "@oak/api";
import { freshState } from "./flow.ts";
import { createOnboardingStore, type KV, LOCAL_KEY, mergePatch, readLocal } from "./persist.ts";

function memKV(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const notBuilt = () => new OakApiError("onboarding.get", 501, "not_implemented", "Not built yet");
const NOW = "2026-11-11T10:00:00.000Z";

function fakeServer(initial: OnboardingState | "501") {
  let st = initial;
  let puts = 0;
  return {
    get puts() {
      return puts;
    },
    build(s: OnboardingState) {
      st = s;
    },
    async get() {
      if (st === "501") throw notBuilt();
      return st;
    },
    async put(p: OnboardingPatch) {
      puts++;
      if (st === "501") throw notBuilt();
      st = mergePatch(st, p, NOW);
      return st;
    },
  };
}

describe("onboarding persistence", () => {
  test("uses the server when it has the endpoints, and mirrors locally", async () => {
    const kv = memKV();
    const server = fakeServer(freshState());
    const store = createOnboardingStore({ ...server, get: server.get, put: server.put, kv, now: () => NOW });
    expect((await store.load()).source).toBe("server");
    const st = await store.save({ step: "loop", completed: ["welcome"] });
    expect(st.step).toBe("loop");
    expect(readLocal(kv)?.completed).toEqual(["welcome"]);
  });

  test("falls back to the local mirror on a 501 and resumes from it", async () => {
    const kv = memKV();
    const server = fakeServer("501");
    const store = createOnboardingStore({ get: server.get, put: server.put, kv, now: () => NOW });
    const first = await store.load();
    expect(first).toEqual({ state: freshState(), source: "local" });
    await store.save({ step: "edit", completed: ["welcome", "loop"] });
    const again = createOnboardingStore({ get: server.get, put: server.put, kv, now: () => NOW });
    const resumed = await again.load();
    expect(resumed.source).toBe("local");
    expect(resumed.state.step).toBe("edit");
    expect(resumed.state.startedAt).toBe(NOW);
  });

  test("moves to the server at the next load once it gains the endpoint", async () => {
    const kv = memKV();
    const server = fakeServer("501");
    const store = createOnboardingStore({ get: server.get, put: server.put, kv, now: () => NOW });
    await store.load();
    await store.save({ step: "loop", completed: ["welcome"] });
    await store.save({ step: "edit", completed: ["welcome", "loop"] });
    expect(server.puts).toBe(0); // no request per save while the endpoint is missing
    server.build(freshState());
    const later = createOnboardingStore({ get: server.get, put: server.put, kv, now: () => NOW });
    expect((await later.load()).state.step).toBe("edit"); // the local copy is further along
    const st = await later.save({ step: "react", completed: ["welcome", "loop", "edit"] });
    expect(st.completed).toEqual(["welcome", "loop", "edit"]);
    expect(server.puts).toBe(1);
  });

  test("prefers a local copy that is further along than the server's", async () => {
    const kv = memKV();
    kv.setItem(
      LOCAL_KEY,
      JSON.stringify({ ...freshState(), step: "mic", completed: ["welcome", "loop", "edit"] }),
    );
    const server = fakeServer({ ...freshState(), step: "loop", completed: ["welcome"] });
    const store = createOnboardingStore({ get: server.get, put: server.put, kv, now: () => NOW });
    expect((await store.load()).state.step).toBe("mic");
  });

  test("a finished local copy never overrides an unfinished server (progress reset since)", async () => {
    const kv = memKV();
    kv.setItem(
      LOCAL_KEY,
      JSON.stringify({
        ...freshState(),
        step: "coda",
        completed: ["welcome", "loop", "edit", "react"],
        startedAt: NOW,
        finishedAt: NOW,
      }),
    );
    const server = fakeServer(freshState());
    const store = createOnboardingStore({ get: server.get, put: server.put, kv, now: () => NOW });
    const loaded = await store.load();
    expect(loaded.source).toBe("server");
    expect(loaded.state.finishedAt).toBeNull();
    expect(readLocal(kv)?.finishedAt).toBeNull(); // the stale mirror is replaced
  });

  test("a bad request is an error, not a fallback", async () => {
    const kv = memKV();
    const store = createOnboardingStore({
      get: async () => freshState(),
      put: async () => {
        throw new OakApiError("onboarding.put", 400, "bad_request", "no");
      },
      kv,
      now: () => NOW,
    });
    await store.load();
    await expect(store.save({ step: "loop" })).rejects.toBeInstanceOf(OakApiError);
  });

  test("finished stamps finishedAt once", () => {
    const a = mergePatch(freshState(), { finished: true }, NOW);
    expect(a.finishedAt).toBe(NOW);
    expect(mergePatch(a, { finished: true }, "later").finishedAt).toBe(NOW);
  });
});
