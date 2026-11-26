// Where the onboarding state lives: `GET/PUT /api/onboarding` (wave2.md §4). Every write also goes to a local
// mirror, which is read only when the server does not have the endpoints yet (a typed 501 `not_implemented`)
// or cannot be reached, so a reload mid-way always resumes at the same screen.
import { OakApiError, type OnboardingPatch, type OnboardingState, OnboardingStateSchema } from "@oak/api";
import { callApi } from "../lib/api.ts";
import { freshState } from "./flow.ts";

export const LOCAL_KEY = "oak.onboarding.v1";

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function storage(): KV | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLocal(kv: KV | null = storage()): OnboardingState | null {
  try {
    const raw = kv?.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = OnboardingStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Merges `patch` into the mirror the way the server would (`finished` stamps `finishedAt`). */
export function mergePatch(cur: OnboardingState, patch: OnboardingPatch, now: string): OnboardingState {
  const next: OnboardingState = { ...cur };
  if (patch.step !== undefined) next.step = patch.step;
  if (patch.completed !== undefined) next.completed = patch.completed;
  if (patch.skipped !== undefined) next.skipped = patch.skipped;
  if (patch.firstEdit !== undefined) next.firstEdit = patch.firstEdit;
  if (patch.sketchId !== undefined) next.sketchId = patch.sketchId;
  next.startedAt ??= now;
  if (patch.finished) next.finishedAt ??= now;
  return next;
}

export function writeLocal(state: OnboardingState, kv: KV | null = storage()): void {
  try {
    kv?.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full disk: the server copy is the record.
  }
}

/** True for answers that mean "the server cannot keep this" (not built yet, or unreachable), not a bad request. */
export function isFallbackError(e: unknown): boolean {
  return e instanceof OakApiError && (e.code === "not_implemented" || e.status === 0 || e.status >= 500);
}

export interface OnboardingStore {
  load(): Promise<{ state: OnboardingState; source: "server" | "local" }>;
  save(patch: OnboardingPatch): Promise<OnboardingState>;
}

export interface StoreDeps {
  get(): Promise<OnboardingState>;
  put(patch: OnboardingPatch): Promise<OnboardingState>;
  kv: KV | null;
  now(): string;
}

export function createOnboardingStore(deps: StoreDeps): OnboardingStore {
  let fallback = false;
  return {
    async load() {
      try {
        const state = await deps.get();
        fallback = false;
        // The server copy wins; if it is behind the local one (written while the server was away), the
        // local one is newer by construction: it has every step the server has and more. A finished local copy
        // never wins: finishing also stamps the profile on the server, so a server that has no finish forgot it
        // (progress reset), and the mirror is an old run's.
        const local = readLocal(deps.kv);
        if (
          local &&
          local.finishedAt === null &&
          local.completed.length > state.completed.length &&
          state.finishedAt === null
        )
          return { state: local, source: "local" };
        writeLocal(state, deps.kv);
        return { state, source: "server" };
      } catch (e) {
        if (!isFallbackError(e)) throw e;
        fallback = true;
        return { state: readLocal(deps.kv) ?? freshState(), source: "local" };
      }
    },
    async save(patch) {
      const local = mergePatch(readLocal(deps.kv) ?? freshState(), patch, deps.now());
      writeLocal(local, deps.kv);
      // The server answered "not built" or was away at load: keep to the mirror until the next load.
      if (fallback) return local;
      try {
        const st = await deps.put(patch);
        writeLocal(st, deps.kv);
        return st;
      } catch (e) {
        if (!isFallbackError(e)) throw e;
        fallback = true;
        return local;
      }
    },
  };
}

export const onboardingStore: OnboardingStore = createOnboardingStore({
  get: () => callApi("onboarding.get"),
  put: (patch) => callApi("onboarding.put", { body: patch }),
  kv: storage(),
  now: () => new Date().toISOString(),
});
