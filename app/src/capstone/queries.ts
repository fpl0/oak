// Server state the capstone workspace needs beyond the shared hooks (app/src/lib/queries.ts is frozen): the
// capstone's draft sketch, starting a capstone session outside the daily runner, and the tutor's review.
import {
  type CapstoneReview,
  CapstoneReviewSchema,
  type Sketch,
  type SketchDetail,
  type SketchVersion,
  type TranscriptEntry,
} from "@oak/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiQuery, useApiMutation } from "../lib/queries.ts";
import { type ReviewRequest, useReviewRequest } from "../tutor/context.ts";
import { releasedDraftOf } from "./release-version.ts";

/** The capstone's draft: the sketch the server links (`CapstoneState.sketchId`), else the newest `capstone` sketch for it. */
export function useDraftSketchId(capstoneId: string, linked: string | null | undefined) {
  const list = useQuery({
    ...apiQuery("sketches.list", { query: { origin: "capstone" } }),
    enabled: linked === null,
  });
  if (linked) return { id: linked, pending: false };
  if (linked === undefined) return { id: null, pending: true };
  const mine = (list.data?.items ?? [])
    .filter((s: Sketch) => s.originId === capstoneId && !s.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { id: mine[0]?.id ?? null, pending: list.isPending };
}

export function useDraft(id: string | null) {
  return useQuery({ ...apiQuery("sketches.get", { params: { id: id ?? "none" } }), enabled: id !== null });
}

/**
 * The code of this draft's latest release (`releasedDraftOf`, read from the released sketch version), or null with
 * no release or while it loads. Both queries are ones the workspace already holds, so this costs no fetch when the
 * release was made from the open draft.
 */
export function useReleasedCode(trackId: string | null, draftSketchId: string | null): string | null {
  const track = useQuery({
    ...apiQuery("album.track", { params: { id: trackId ?? "none" } }),
    enabled: trackId !== null,
  });
  const at = releasedDraftOf(track.data, draftSketchId);
  const sketch = useDraft(at?.sketchId ?? null);
  if (!at || !sketch.data) return null;
  return sketch.data.versions.find((v) => v.version === at.sketchVersion)?.code ?? null;
}

export function latestVersion(s: SketchDetail | undefined): SketchVersion | null {
  if (!s) return null;
  return s.versions.find((v) => v.version === s.currentVersion) ?? s.versions.at(-1) ?? null;
}

/** `session.start` for a capstone session the learner opens from the map or the album, outside Today's runner. */
export const useStartCapstoneSession = () =>
  useApiMutation("session.start", [
    "bootstrap",
    "session.today",
    "capstones.get",
    "unlocks.list",
    "lessons.progress",
  ]);

export const useCreateDraft = () => useApiMutation("sketches.create", ["sketches.list", "streak.get"]);
export const useAddDraftVersion = () => useApiMutation("sketches.addVersion", ["streak.get"]);
export const usePatchDraft = () => useApiMutation("sketches.patch", ["sketches.get"]);

/** Seeds the sketch cache after a save, so the editor does not wait for a refetch. */
export function usePutDraft() {
  const qc = useQueryClient();
  return (detail: SketchDetail) => {
    qc.setQueryData(apiQuery("sketches.get", { params: { id: detail.id } }).queryKey, detail);
  };
}

/** How long a requested review is waited for (polling the timeline) before the learner is told it hasn't come. */
export const REVIEW_WAIT_MS = 120_000;
/** Timeline polling while a review is on its way. */
export const REVIEW_POLL_MS = 3000;

export type ReviewWait =
  /** Nothing asked, or the last request was answered (the review is shown). */
  | { kind: "idle" }
  /** Asked; the review is on its way (the timeline is polled). */
  | { kind: "pending" }
  /** The last request ended in an error from the tutor. */
  | { kind: "failed" }
  /** Asked, but nothing came back within `REVIEW_WAIT_MS`. */
  | { kind: "stalled" };

type TimelineEntry = Pick<TranscriptEntry, "role" | "kind" | "review" | "excluded" | "errorKind">;

/** The request text that names the draft version a review is asked about (c11: a review names its version). */
export function reviewRequestText(version: number | null, transcription: boolean): string {
  const what = transcription ? "transcription" : "draft";
  return version === null ? `Please review my ${what}.` : `Please review version ${version} of my ${what}.`;
}

/** The version a review request named (`reviewRequestText`), or `null`. */
export function versionOfRequest(text: string | null | undefined): number | null {
  const m = /\bversion (\d+)\b/i.exec(text ?? "");
  return m ? Number(m[1]) : null;
}
const isReviewKind = (k: string) => k.startsWith("review-");

/**
 * Where the learner's last review request stands, from the subject's timeline: `asked` is set when this page sent
 * one (`asksBefore`: the requests the timeline held then), `waitedMs` how long this page has waited. Pure.
 */
export function reviewWaitOf(
  entries: readonly TimelineEntry[],
  asked: { asksBefore: number } | null,
  waitedMs: number,
): ReviewWait {
  const waiting = (): ReviewWait => (waitedMs >= REVIEW_WAIT_MS ? { kind: "stalled" } : { kind: "pending" });
  const asks = entries.flatMap((e, i) => (e.role === "user" && isReviewKind(e.kind) ? [i] : []));
  // Sent from this page, not on the server's timeline yet.
  if (asked && asks.length <= asked.asksBefore) return waiting();
  const last = asks.at(-1);
  if (last === undefined) return { kind: "idle" };
  const answers = entries.slice(last + 1).filter((e) => e.role === "assistant" && isReviewKind(e.kind));
  if (answers.some((e) => e.review !== null && !e.excluded)) return { kind: "idle" };
  if (answers.some((e) => e.errorKind !== null)) return { kind: "failed" };
  return waiting();
}

/**
 * The Brief's wait joined with the tutor panel's own record of the request (c9, `useReviewRequest`): a request
 * that ended before reaching the server (`failed-early`) or with an error, after this page asked, is failed at once
 * (nothing is on the timeline to wait for); a request the panel sent itself (its "Request review") reads as pending
 * here too. `askedAt` is this page's local clock when it asked. Pure.
 */
export function joinReviewWait(
  wait: ReviewWait,
  request: ReviewRequest | null,
  askedAt: number | null,
  now: number,
): ReviewWait {
  if (!request) return wait;
  const failed = request.phase === "failed-early" || request.phase === "failed";
  if (failed && askedAt !== null && request.at >= askedAt && wait.kind !== "idle") return { kind: "failed" };
  const recent = now - request.at < REVIEW_WAIT_MS;
  if (
    request.phase === "pending" &&
    recent &&
    wait.kind === "idle" &&
    (askedAt === null || request.at >= askedAt)
  )
    return { kind: "pending" };
  return wait;
}

/**
 * The latest structured review of this capstone in its tutor timeline (contracts §10.6), and where the last request
 * stands. The tutor panel renders the review itself; the workspace shows its state and offers its liner note at
 * release. The timeline is polled only while a requested review is on its way, and for `REVIEW_WAIT_MS` at most:
 * once it has arrived (or failed) nothing polls.
 */
export function useCapstoneReview(capstoneId: string) {
  const [asked, setAsked] = useState<{ asksBefore: number; at: number } | null>(null);
  // The panel's own record of the request (c9): a request that never reached the server clears "pending" at once.
  const request = useReviewRequest({ subjectKind: "capstone", subjectId: capstoneId });
  // When this page started waiting (local clock), and the clock the wait is read against.
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const q = useQuery({
    ...apiQuery("tutor.timeline", { query: { subjectKind: "capstone", subjectId: capstoneId } }),
    refetchInterval: (query) => {
      const entries = query.state.data?.entries ?? [];
      const waited = since === null ? 0 : Date.now() - since;
      const w = joinReviewWait(reviewWaitOf(entries, asked, waited), request, asked?.at ?? null, Date.now());
      return w.kind === "pending" ? REVIEW_POLL_MS : false;
    },
    retry: 0,
  });
  const entries = q.data?.entries ?? [];
  let review: CapstoneReview | null = null;
  let at: string | null = null;
  // The entry's id as the tutor panel keys it (`<conversationId>-<seq>`: its "Mark done" ticks), and the draft
  // version the request before it named.
  let entryId: string | null = null;
  let version: number | null = null;
  let lastAsk: string | null = null;
  for (const e of entries) {
    if (e.role === "user" && isReviewKind(e.kind)) lastAsk = e.text;
    if (e.review === null || e.excluded) continue;
    const parsed = CapstoneReviewSchema.safeParse(e.review);
    if (parsed.success) {
      review = parsed.data;
      at = e.at;
      entryId = `${e.conversationId}-${e.seq}`;
      version = versionOfRequest(lastAsk);
    }
  }
  const loaded = q.data !== undefined;
  const pendingNow = (loaded || asked !== null) && reviewWaitOf(entries, asked, 0).kind === "pending";
  useEffect(() => {
    if (pendingNow) setSince((s) => s ?? Date.now());
    else if (loaded) setSince(null);
  }, [pendingNow, loaded]);
  // The wait ends on its own when nothing more arrives: the clock moves once, at the limit.
  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    const t = setTimeout(() => setNow(Date.now()), Math.max(0, since + REVIEW_WAIT_MS - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [since]);
  const wait: ReviewWait = joinReviewWait(
    loaded || asked !== null
      ? reviewWaitOf(entries, asked, since === null ? 0 : Math.max(0, now - since))
      : { kind: "idle" },
    request,
    asked?.at ?? null,
    Date.now(),
  );
  const askedNow = () => {
    const at = Date.now();
    setSince(at);
    setAsked({ asksBefore: entries.filter((e) => e.role === "user" && isReviewKind(e.kind)).length, at });
  };
  return { review, at, entryId, version, query: q, wait, asked: askedNow };
}
