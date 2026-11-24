// The lesson machine's server calls (`LessonDeps`): attempts, hints, series, the Make's sketch and lesson
// completion, the Quick sketch and the step position, over the app's one API client. `previewDeps` is the
// local stand-in for a lesson that is not part of the learner's course (the gate sample, a locked lesson in
// dev): it keeps the rung and the attempts in memory and saves nothing.
import {
  type BandId,
  type FlavourId,
  type GradeResult,
  type HintRung,
  isLessonId,
  type LessonCompleteResult,
  type LessonDef,
  OakApiError,
  type StepState,
  type UnitId,
} from "@oak/api";
import type { QueryClient } from "@tanstack/react-query";
import { callApi } from "../lib/api.ts";
import { idempotencyKey } from "../lib/idempotency.ts";
import type { LessonDeps } from "./machine.ts";
import { localRung, revealNeeds } from "./model.ts";
import {
  isTransientTakeError,
  refineBackfilledTakes,
  retryTakePost,
  type SongTakeInput,
  type SongTakeIo,
  songTakeBody,
} from "./song-make.ts";

/** When a take that did not reach the server is tried again: after 1 s, 4 s and 15 s (a server restart). */
const TAKE_RETRY_MS = [1000, 4000, 15000] as const;

/**
 * A take step's song as the Save needs it: everything of `SongTakeInput` but the saved code and sketch, and the
 * song's takes that Oak backfilled (refined from their code after the save).
 */
export type SongTakeContext = Omit<SongTakeInput, "lessonId" | "code" | "sketchId" | "sketchVersion"> & {
  backfilled: Parameters<typeof refineBackfilledTakes>[1]["takes"];
};

export interface ServerDepsOptions {
  qc: QueryClient;
  lesson: LessonDef;
  sessionId: () => string | null;
  splitPart: () => "A" | "B" | null;
  contentHash: string;
  /** Active ms of the step on screen (the attempt's `activeMs`). */
  activeMs: () => number;
  /**
   * The Band a step plays, as the Make's sketch keeps it: `mutes` are the Band's parts the step leaves out
   * (`ui.band.tracks`), so Studio plays the sketch with what the learner heard in the lesson.
   */
  band: (stepId: string) => {
    bandId: BandId;
    flavour: FlavourId;
    mutes?: string[];
    /** Unit songs: the Make played inside its song, over these takes. */
    song?: { unitId: UnitId; takeIds: number[] };
  } | null;
  /** Whether the Make's code has run successfully at least once (a sketch qualifies a streak day then). */
  ranOk: (stepId: string) => boolean;
  /** Grades the Make's code when no check of it is current. */
  gradeMake: (code: string) => Promise<GradeResult | null>;
  /**
   * Unit songs (spec §5.3): a take step's song, read when the Make is saved. The saved code then becomes a take of the
   * song (`songs.recordTake`), with the cells it claims computed from the code evaluated once (`recordSongTake`).
   */
  songTake?: () => SongTakeContext | null;
  /** Evaluates code without a lint (the browser grader host), for the take's claims. */
  evaluate?: SongTakeIo["evaluate"];
  onAttempt?: (stepId: string, attemptId: number) => void;
}

export const isNotImplemented = (e: unknown) => e instanceof OakApiError && e.code === "not_implemented";

export function serverDeps(o: ServerDepsOptions): LessonDeps {
  const id = o.lesson.id;
  const invalidate = (...names: string[]) => {
    for (const n of names) void o.qc.invalidateQueries({ queryKey: ["api", n] });
  };
  const exerciseOf = (stepId: string) => o.lesson.steps.find((s) => s.id === stepId)?.exercise;
  /** The Make's attempt: one key per saved code, so a Save retried after a failure counts once. */
  const makeKeys = new Map<string, string>();
  const makeKey = (stepId: string, code: string) => {
    const k = `${stepId}\n${code}`;
    const held = makeKeys.get(k);
    if (held) return held;
    const key = idempotencyKey();
    makeKeys.set(k, key);
    return key;
  };

  const createSketch = async (stepId: string, code: string, title: string, tutorAssisted: boolean) => {
    const band = o.band(stepId);
    const saved = await callApi("sketches.create", {
      body: {
        title: title.slice(0, 120) || o.lesson.title,
        originKind: "lesson-make",
        originId: id,
        sessionId: o.sessionId(),
        code,
        bpm: o.lesson.bpm,
        meter: o.lesson.meter,
        key: o.lesson.key,
        analysis: null,
        note: null,
        tutorAssisted,
        band: band
          ? {
              bandId: band.bandId,
              flavour: band.flavour,
              mutes: band.mutes ?? [],
              ...(band.song ? { song: band.song } : {}),
            }
          : null,
        flags: { lockedTools: [], previewTools: [] },
        ranOk: o.ranOk(stepId),
      },
    });
    invalidate("sketches.list", "streak.get");
    return { id: saved.sketch.id, version: saved.sketch.currentVersion };
  };

  /**
   * The saved Make as a take of its song (spec §5.3, contracts §5.11 rule 15), after the lesson is complete: a take
   * never stands for a Save that did not finish. One idempotency key per saved version, so a retry records it once.
   * A take that cannot be recorded leaves the lesson complete. The complete screen waits for the first try only; a
   * transient failure (the local server restarting, a network blip) is tried again in the background with the same
   * body and key, and the song's reads refresh when it lands. The Coda says so when the take is still missing
   * (`SongGrew`): the Make stays a sketch, and redoing the lesson puts it in the song.
   */
  const recordTake = async (code: string, saved: { id: string; version: number }) => {
    const song = o.songTake?.();
    if (!song || !o.evaluate || !isLessonId(id)) return;
    const io: SongTakeIo = {
      evaluate: o.evaluate,
      post: (unitId, body) => callApi("songs.recordTake", { params: { unitId: unitId as UnitId }, body }),
    };
    const { backfilled, ...take } = song;
    const recorded = (ok: boolean) => {
      invalidate("songs.get", "songs.list");
      // The takes Oak made from earlier lessons' sketches learn the cells their code really plays (spec §5.6a), after
      // the lesson has moved on: the complete screen does not wait for them.
      if (ok && backfilled.length > 0)
        void refineBackfilledTakes(io, { ...take, takes: backfilled }).then(
          () => invalidate("songs.get", "songs.list"),
          (e: unknown) => console.warn("oak: the song's earlier takes were not refined", e),
        );
    };
    let post: (() => Promise<unknown>) | null = null;
    try {
      const body = await songTakeBody(io.evaluate, {
        ...take,
        lessonId: id,
        code,
        sketchId: saved.id,
        sketchVersion: saved.version,
      });
      post = () => io.post(take.unitId, body);
      await post();
      recorded(true);
    } catch (e) {
      console.warn("oak: the take was not recorded in the song", e);
      recorded(false);
      if (post && isTransientTakeError(e))
        void retryTakePost(post, { delaysMs: TAKE_RETRY_MS }).then((ok) => {
          if (ok) recorded(true);
          else console.warn("oak: the take was still not recorded in the song after retrying");
        });
    }
  };

  return {
    async postAttempt(a) {
      const res = await callApi("steps.attempt", {
        params: { id, stepId: a.stepId },
        body: {
          sessionId: o.sessionId(),
          exerciseId: a.exercise.id,
          exerciseVersion: a.exercise.version,
          seriesNo: a.seriesNo,
          params: Object.keys(a.params).length > 0 ? a.params : null,
          response: a.response,
          result: a.result,
          extraReplays: a.extraReplays,
          activeMs: Math.max(0, Math.round(o.activeMs())),
          tutorAssisted: a.tutorAssisted,
          idempotencyKey: a.idempotencyKey,
        },
      });
      o.onAttempt?.(a.stepId, res.attempt.id);
      invalidate("lessons.progress", "skills.map");
      return res;
    },
    hint: (stepId, reveal) => callApi("steps.hint", { params: { id, stepId }, body: { reveal } }),
    newSeries: (stepId) => callApi("steps.newSeries", { params: { id, stepId } }),
    async finish(f) {
      const ex = exerciseOf(f.stepId);
      const result = f.result?.status !== undefined ? f.result : await o.gradeMake(f.code);
      // The Make's rubric gives evidence (contracts §6.5 rule 5) unless the code did not run.
      if (ex && result && result.status !== "error")
        await callApi("steps.attempt", {
          params: { id, stepId: f.stepId },
          body: {
            sessionId: o.sessionId(),
            exerciseId: ex.id,
            exerciseVersion: ex.version,
            seriesNo: 0,
            params: null,
            response: { code: f.code },
            result,
            extraReplays: 0,
            activeMs: Math.max(0, Math.round(o.activeMs())),
            tutorAssisted: f.tutorAssisted,
            idempotencyKey: makeKey(f.stepId, f.code),
          },
        }).catch(() => null);
      const saved = await createSketch(f.stepId, f.code, f.title, f.tutorAssisted);
      const sketchId = saved.id;
      let complete: LessonCompleteResult | null = null;
      if (isLessonId(id))
        complete = await callApi("lessons.complete", {
          params: { id },
          body: {
            sessionId: o.sessionId(),
            sketchId,
            lessonVersion: o.lesson.version,
            contentHash: o.contentHash,
            splitPart: o.splitPart() === "B" ? "B" : null,
          },
        });
      await recordTake(f.code, saved);
      invalidate(
        "lessons.progress",
        "skills.map",
        "unlocks.list",
        "cando.list",
        "session.today",
        "bootstrap",
      );
      return { sketchId, result: complete };
    },
    async quickSketch(q) {
      const sketchId = (await createSketch(q.stepId, q.code, q.title, false)).id;
      if (q.part === "A")
        await callApi("lessons.complete", {
          params: { id },
          body: {
            sessionId: o.sessionId(),
            sketchId,
            lessonVersion: o.lesson.version,
            contentHash: o.contentHash,
            splitPart: "A",
          },
        });
      else
        await callApi("lessons.position", {
          params: { id },
          body: { sessionId: o.sessionId(), stepId: q.resumeStep, splitPart: o.splitPart(), wrapped: true },
        }).catch(() => null);
      invalidate("lessons.progress", "session.today");
      return { sketchId };
    },
    position(stepId, wrapped) {
      // The cached progress learns the step at once: a player mounted again in this tab (Back then Forward, a
      // session block remounted) resumes here, not at the step the progress was first fetched with.
      o.qc.setQueriesData<{ lessons: { lessonId: string; currentStep: string | null }[] }>(
        { queryKey: ["api", "lessons.progress"] },
        (old) =>
          old && Array.isArray(old.lessons)
            ? {
                ...old,
                lessons: old.lessons.map((l) => (l.lessonId === id ? { ...l, currentStep: stepId } : l)),
              }
            : old,
      );
      void callApi("lessons.position", {
        params: { id },
        body: { sessionId: o.sessionId(), stepId, splitPart: o.splitPart(), wrapped },
      }).catch(() => null);
    },
  };
}

/** The local stand-in: nothing is saved; the ladder and the attempts live in memory. */
export function previewDeps(lesson: LessonDef): LessonDeps {
  const states = new Map<string, StepState>();
  const stateOf = (stepId: string): StepState =>
    states.get(stepId) ?? {
      lessonId: lesson.id,
      stepId,
      rung: 0,
      passed: false,
      attempts: 0,
      seriesNo: 0,
      revealAvailable: false,
      result: null,
    };
  const save = (s: StepState) => {
    const ex = lesson.steps.find((x) => x.id === s.stepId)?.exercise;
    const next = { ...s, revealAvailable: s.attempts >= revealNeeds(ex) && !!ex?.hints };
    states.set(s.stepId, next);
    return next;
  };
  return {
    async postAttempt(a) {
      const s = stateOf(a.stepId);
      const graded = a.result.status !== "error";
      return {
        state: save({
          ...s,
          attempts: s.attempts + (graded ? 1 : 0),
          passed: s.passed || a.result.status === "pass",
          // docs/design/retry.md §3.1: after a pass, the next attempt is practice (said before the take).
          practiceNext: s.passed || a.result.status === "pass",
        }),
        testedOut: [],
      };
    },
    async hint(stepId, reveal) {
      const s = stateOf(stepId);
      if (reveal && !s.revealAvailable) throw new Error("reveal is not available yet");
      return save({ ...s, rung: Math.max(s.rung, localRung(s.rung, reveal)) as HintRung });
    },
    async newSeries(stepId) {
      const s = stateOf(stepId);
      return save({ ...s, seriesNo: s.seriesNo + 1, attempts: 0, rung: 0 });
    },
    async finish() {
      return { sketchId: "preview", result: null };
    },
    async quickSketch() {
      return { sketchId: "preview" };
    },
    position() {},
  };
}
