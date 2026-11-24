// TanStack Query hooks for every endpoint group of the REST contract (interfaces §6). Server state lives here
// and nowhere else; keys are `["api", endpointName, input]`, so a mutation invalidates by endpoint name.
import type { ConfirmEndpointName, EndpointInput, EndpointOutput, JsonEndpointName } from "@oak/api";
import {
  type QueryClient,
  queryOptions,
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiUrl, callApi, callDestructive } from "./api.ts";

// --- generic -------------------------------------------------------------------------------------

export function apiKey<N extends JsonEndpointName>(name: N, input?: EndpointInput<N>) {
  return ["api", name, input ?? null] as const;
}

/** Query options for a GET endpoint; reuse with `queryClient.ensureQueryData` in route loaders. */
export function apiQuery<N extends JsonEndpointName>(name: N, input?: EndpointInput<N>) {
  return queryOptions({
    queryKey: apiKey(name, input),
    queryFn: ({ signal }) => callApi(name, input, { signal }),
  });
}

function invalidate(qc: QueryClient, names: readonly JsonEndpointName[]) {
  return Promise.all(names.map((n) => qc.invalidateQueries({ queryKey: ["api", n] })));
}

type MutOpts<N extends JsonEndpointName> = Omit<
  UseMutationOptions<EndpointOutput<N>, Error, EndpointInput<N>>,
  "mutationFn"
>;

/** A mutation over one endpoint that invalidates the listed GET endpoints on success. */
export function useApiMutation<N extends JsonEndpointName>(
  name: N,
  invalidates: readonly JsonEndpointName[] = [],
  options: MutOpts<N> = {},
) {
  const qc = useQueryClient();
  return useMutation<EndpointOutput<N>, Error, EndpointInput<N>>({
    ...options,
    mutationKey: ["api", name],
    mutationFn: (input) => callApi(name, input),
    onSuccess: async (data, vars, onMutateResult, ctx) => {
      await invalidate(qc, invalidates);
      await options.onSuccess?.(data, vars, onMutateResult, ctx);
    },
  });
}

/**
 * A destructive mutation (contracts §11.6): native confirm dialog naming the action, then nonce and call.
 * Resolves `null` when the learner cancels.
 */
export function useDestructiveMutation<N extends ConfirmEndpointName>(
  name: N,
  invalidates: readonly JsonEndpointName[] = [],
) {
  const qc = useQueryClient();
  return useMutation<
    EndpointOutput<N> | null,
    Error,
    { target: string; question: string; input?: EndpointInput<N> }
  >({
    mutationKey: ["api", name],
    mutationFn: ({ target, question, input }) => callDestructive(name, target, question, input),
    onSuccess: async (data) => {
      if (data !== null) await invalidate(qc, invalidates);
    },
  });
}

// --- health, bootstrap, settings ------------------------------------------------------------------

export const useHealth = () => useQuery({ ...apiQuery("health"), refetchInterval: 30_000, retry: 0 });
export const useBootstrap = () => useQuery({ ...apiQuery("bootstrap"), staleTime: 30_000 });
export const useSettingsPut = () => useApiMutation("settings.put", ["bootstrap", "app.update"]);
/** Desktop app only: a newer Oak on GitHub, or `null` (the server asks GitHub at most once a day). */
export const useAppUpdate = () =>
  useQuery({ ...apiQuery("app.update"), staleTime: 60 * 60_000, refetchInterval: 6 * 60 * 60_000, retry: 0 });
export const useAnthropicKeySet = () => useApiMutation("settings.anthropicKey.set", ["health", "bootstrap"]);
export const useAnthropicKeyDelete = () =>
  useDestructiveMutation("settings.anthropicKey.delete", ["health", "bootstrap"]);
export const useDataReset = () =>
  useDestructiveMutation("data.reset", ["bootstrap", "profile.get", "lessons.progress", "skills.map"]);

// --- profile ------------------------------------------------------------------------------------

export const useProfile = () => useQuery(apiQuery("profile.get"));
export const useProfileUpdate = () => useApiMutation("profile.put", ["profile.get", "bootstrap"]);
export const useCalibrationRun = () =>
  useApiMutation("profile.calibration", ["profile.get", "bootstrap", "profile.calibrations"]);

// --- session ------------------------------------------------------------------------------------

export const useTodayPlan = (targetMinutes?: "15" | "20" | "25") =>
  useQuery(apiQuery("session.today", targetMinutes ? { query: { targetMinutes } } : {}));
export const useSessionStart = () =>
  useApiMutation("session.start", ["bootstrap", "session.today", "session.day"]);
export const useSessionHeartbeat = () => useApiMutation("session.heartbeat");
export const useSessionEnd = () =>
  useApiMutation("session.end", [
    "bootstrap",
    "session.today",
    "session.day",
    "streak.get",
    "unlocks.list",
    "cando.list",
    // Wave 5: ending today's core session may turn on the "after-core" side-lesson offer.
    "sideLessons.list",
    // The Coda's "Next time" names a gym slot when the session just ended makes one due.
    "gym.plan",
    // Wave 6: the session that ends may have met a track gate or completed the core.
    "tracks.list",
    "course.completion",
    // Wave 7: or completed the whole course.
    "course.whole",
  ]);

// --- lessons, steps, checkpoints, capstones, gym ----------------------------------------------------

export const useCourseProgress = () => useQuery(apiQuery("lessons.progress"));
export const useStepState = (id: string, stepId: string, enabled = true) =>
  useQuery({ ...apiQuery("steps.state", { params: { id, stepId } }), enabled });
export const useStepAttempt = () =>
  useApiMutation("steps.attempt", ["steps.state", "skills.map", "voice.get", "gates.voicing"]);
export const useStepHint = () => useApiMutation("steps.hint", ["steps.state"]);
export const useStepNewSeries = () => useApiMutation("steps.newSeries", ["steps.state"]);
export const useLessonComplete = () =>
  useApiMutation("lessons.complete", [
    "lessons.progress",
    "unlocks.list",
    "session.today",
    "skills.map",
    // Wave 5: a completed side lesson (A1.L0n) changes the side-lesson list and the next offer.
    "sideLessons.list",
  ]);
export const useCheckpointStart = () => useApiMutation("checkpoints.start", ["lessons.progress"]);
export const useCheckpointAttempt = () =>
  useApiMutation("checkpoints.attempt", ["lessons.progress", "skills.map", "session.today"]);
export const useCapstone = (id: string) => useQuery(apiQuery("capstones.get", { params: { id } }));
export const useCapstoneCheck = () => useApiMutation("capstones.check", ["capstones.get"]);
export const useCapstoneSessionComplete = () =>
  useApiMutation("capstones.completeSession", [
    "capstones.get",
    "capstones.sessions",
    "lessons.progress",
    "session.today",
  ]);
export const useGymStart = () =>
  useApiMutation("gym.start", ["lessons.progress", "session.today", "gym.plan", "ladder.get"]);
export const useTermsIntroduced = () => useQuery(apiQuery("terms.introduced"));

// --- skills, SRS, drills ------------------------------------------------------------------------

export const useSkillMap = () => useQuery(apiQuery("skills.map"));
export const useDue = (budgetSec?: number, more = false) =>
  useQuery(
    apiQuery("srs.due", {
      query: {
        ...(budgetSec === undefined ? {} : { budgetSec: String(Math.round(budgetSec)) }),
        ...(more ? { more: "1" as const } : {}),
      },
    }),
  );
export const useSrsReview = () => useApiMutation("srs.review", ["srs.due", "skills.map", "families.list"]);
export const useFamilies = () => useQuery(apiQuery("families.list"));
export const useFamilyState = (familyId: string) =>
  useQuery(apiQuery("families.state", { params: { familyId } }));
export const useDrillStart = () => useApiMutation("drills.start");
export const useDrillTrials = () => useApiMutation("drills.trials");
export const useDrillFinish = () =>
  useApiMutation("drills.finish", [
    "families.list",
    "families.state",
    "srs.due",
    "skills.map",
    "streak.get",
    "voice.get",
    "drills.get",
  ]);

// --- unlocks, can-do, progress, streak ------------------------------------------------------------

export const useUnlocks = () => useQuery(apiQuery("unlocks.list"));
export const useUnlockSeen = () => useApiMutation("unlocks.seen", ["unlocks.list", "bootstrap"]);
export const useCanDo = () => useQuery(apiQuery("cando.list"));
export const useProgressReport = () => useQuery(apiQuery("progress.get"));
export const useStreak = (weeks?: number) =>
  useQuery(apiQuery("streak.get", { query: weeks === undefined ? {} : { weeks: String(weeks) } }));

// --- sketches (Studio) ----------------------------------------------------------------------------

export type SketchOrigin = NonNullable<NonNullable<EndpointInput<"sketches.list">["query"]>["origin"]>;
export const useSketches = (origin?: SketchOrigin, archived = false) =>
  useQuery(
    apiQuery("sketches.list", {
      query: { ...(origin ? { origin } : {}), ...(archived ? { archived: "1" as const } : {}) },
    }),
  );
export const useSketch = (id: string) => useQuery(apiQuery("sketches.get", { params: { id } }));
export const useSketchCreate = () => useApiMutation("sketches.create", ["sketches.list", "streak.get"]);
export const useSketchAddVersion = () =>
  useApiMutation("sketches.addVersion", ["sketches.get", "sketches.list", "streak.get"]);
export const useSketchPatch = () => useApiMutation("sketches.patch", ["sketches.get", "sketches.list"]);
export const useSketchDelete = () => useDestructiveMutation("sketches.delete", ["sketches.list"]);

// --- album --------------------------------------------------------------------------------------

export const useAlbum = () => useQuery(apiQuery("album.get"));
export const useAlbumTrack = (id: string) => useQuery(apiQuery("album.track", { params: { id } }));
export const useAlbumCreateTrack = () => useApiMutation("album.createTrack", ["album.get"]);
export const useAlbumAddVersion = () => useApiMutation("album.addVersion", ["album.get", "album.track"]);
export const useAlbumPutAudio = () => useApiMutation("album.putAudio", ["album.track"]);
// A song released to the album reads its track (`songs.get`/`songs.list` releases): removing it changes the song's offer.
export const useAlbumDeleteTrack = () =>
  useDestructiveMutation("album.deleteTrack", ["album.get", "songs.get", "songs.list"]);
export const albumAudioUrl = (id: string, v: number) =>
  apiUrl("album.getAudio", { params: { id, v: String(v) } });

// --- audio files and transcriptions ---------------------------------------------------------------

export const useAudioUpload = () => useApiMutation("audio.upload");
export const useAudioPutPeaks = () => useApiMutation("audio.putPeaks");
export const useAudioDelete = () => useDestructiveMutation("audio.delete", ["transcriptions.list"]);
export const audioUrl = (id: string) => apiUrl("audio.get", { params: { id } });
export const audioPeaksUrl = (id: string) => apiUrl("audio.getPeaks", { params: { id } });

export const useTranscriptions = () => useQuery(apiQuery("transcriptions.list"));
export const useTranscription = (id: string) => useQuery(apiQuery("transcriptions.get", { params: { id } }));
export const useTranscriptionCreate = () => useApiMutation("transcriptions.create", ["transcriptions.list"]);
export const useTranscriptionPatch = () =>
  useApiMutation("transcriptions.patch", ["transcriptions.get", "transcriptions.list"]);
export const useTranscriptionAddVersion = () =>
  useApiMutation("transcriptions.addVersion", ["transcriptions.get", "transcriptions.list", "gym.plan"]);
export const useTranscriptionDelete = () =>
  useDestructiveMutation("transcriptions.delete", ["transcriptions.list"]);

// --- tutor (REST side; the streams are in tutor-stream.ts) ----------------------------------------

export type SubjectRef = EndpointInput<"tutor.timeline">["query"];
export const useTutorTimeline = (subject: NonNullable<SubjectRef> | null) =>
  useQuery({
    ...apiQuery("tutor.timeline", { query: subject ?? { subjectKind: "general", subjectId: "general" } }),
    enabled: subject !== null,
  });
export const useTutorUsage = (month?: string) =>
  useQuery(apiQuery("tutor.usage", { query: month ? { month } : {} }));
export const useTutorNotes = (subject?: Partial<NonNullable<SubjectRef>>) =>
  useQuery(apiQuery("tutor.notes", { query: subject ?? {} }));
export const useTutorWarm = () => useApiMutation("tutor.warm");
export const useTutorCardApplied = () =>
  useApiMutation("tutor.cardApplied", ["tutor.timeline", "sketches.get"]);
export const useTutorRetractNote = () =>
  useApiMutation("tutor.retractNote", ["tutor.notes", "session.today"]);

// --- server grader, telemetry, QA -------------------------------------------------------------------

export const useServerGrade = () => useApiMutation("grade");
export const useAnalyze = () => useApiMutation("analyze");
export const useTelemetrySteps = () => useApiMutation("telemetry.steps");
export const useQaReport = () => useApiMutation("qa.report", ["qa.list"]);
// Settings › Grading reports and Progress › Your sessions.
export const useQaReports = () => useQuery(apiQuery("qa.list"));
export const useQaUpdate = () => useApiMutation("qa.update", ["qa.list"]);
export const useSessionTiming = () => useQuery(apiQuery("telemetry.report"));

// --- backup -------------------------------------------------------------------------------------

export const useBackupInfo = () => useQuery(apiQuery("backup.info"));
export const backupExportUrl = (withAudio: boolean) =>
  apiUrl("backup.export", { query: { audio: withAudio ? "1" : "0" } });

/** The backup's file name from the server's `content-disposition`, or a dated fallback. */
export function backupFileName(disposition: string | null, now = new Date()): string {
  const m = /filename="([^"]+)"/.exec(disposition ?? "");
  return m?.[1] ?? `oak-${now.toISOString().slice(0, 10)}.oakbackup`;
}

/**
 * Downloads the backup (W7 gate; contracts §11.1 rule 4): a plain `<a href download>` is a navigation, which
 * carries no `X-Oak` header, so the server refuses it with 403. The export is fetched through the client
 * (X-Oak set) and handed to the browser as a Blob.
 */
export async function downloadBackup(withAudio: boolean): Promise<string> {
  const res = (await callApi("backup.export", {
    query: { audio: withAudio ? "1" : "0" },
  })) as unknown as Response;
  const blob = await res.blob();
  const name = backupFileName(res.headers.get("content-disposition"));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
export const useBackupImport = () =>
  useDestructiveMutation("backup.import", ["bootstrap", "profile.get", "lessons.progress", "sketches.list"]);

// --- dev (OAK_DEV=1) ------------------------------------------------------------------------------

export const useDevContentReport = () => useQuery(apiQuery("dev.contentReport"));

// --- Wave 2 additions (docs/design/wave2.md §4) -------------------------------------------------------
// Until the server engineer builds them these answer 501 (`OakApiError.code === "not_implemented"`, never
// retried); a surface shows its own "not built yet" copy through `ErrorState`.

export const useSessionSummary = (id: string | null) =>
  useQuery({ ...apiQuery("session.summary", { params: { id: id ?? "none" } }), enabled: id !== null });
export const useLessonSteps = (id: string) => useQuery(apiQuery("lessons.steps", { params: { id } }));
export const useLessonPosition = () =>
  useApiMutation("lessons.position", ["lessons.progress", "lessons.steps"]);
export const useCapstoneRelease = () =>
  useApiMutation("capstones.release", [
    "capstones.get",
    "capstones.sessions",
    "capstones.gate",
    "gym.plan",
    "album.get",
    "album.track",
    "lessons.progress",
    "unlocks.list",
    "unlocks.next",
    "streak.get",
  ]);
export const useNextUnlocks = () => useQuery(apiQuery("unlocks.next"));
export const useRevive = (skillId?: string, more = false) =>
  useQuery(
    apiQuery("skills.revive", {
      query: { ...(skillId ? { skillId } : {}), ...(more ? { more: "1" as const } : {}) },
    }),
  );
export const useOnboarding = () => useQuery(apiQuery("onboarding.get"));
export const useOnboardingUpdate = () =>
  useApiMutation("onboarding.put", ["onboarding.get", "profile.get", "bootstrap"]);
export type CalibrationKind = NonNullable<
  NonNullable<EndpointInput<"profile.calibrations">["query"]>["kind"]
>;
export const useCalibrations = (kind?: CalibrationKind) =>
  useQuery(apiQuery("profile.calibrations", { query: kind ? { kind } : {} }));
export const useTutorStatus = (refresh = false) =>
  useQuery({ ...apiQuery("tutor.status", { query: refresh ? { refresh: "1" } : {} }), retry: 0 });
export const useListenMarks = () => useQuery(apiQuery("listen.list"));
export const useListenMark = () => useApiMutation("listen.mark", ["listen.list"]);

// --- Wave 3 additions (docs/design/wave3.md §5) -------------------------------------------------------
// Until the server engineer builds them these answer 501 (`OakApiError.code === "not_implemented"`, never
// retried); a surface shows its own "not built yet" copy through `ErrorState`. The lenses are `lenses.ts`.

/** Today's sessions on the server: Today's "done for today" across reloads and browsers. */
export const useSessionDay = () => useQuery(apiQuery("session.day"));
/** Quiet mode for today, vocal range and the tolerance ladder. Read before asking for the mic. */
export const useVoiceState = () => useQuery(apiQuery("voice.get"));
/** The mic chip and Settings → Voice: `{ quiet, scope: "today" | "always" }`. */
export const useVoiceQuiet = () =>
  useApiMutation("voice.quiet", ["voice.get", "profile.get", "bootstrap", "srs.due"]);
/** Settings → Voice: `{ mode: "auto" }`, `{ mode: "fixed", cents }`, `{ mode: "loosen" }`. */
export const useVoiceLadder = () => useApiMutation("voice.ladder", ["voice.get", "profile.get"]);
/** One drill set with its stored trials. */
export const useDrillSession = (id: string | null) =>
  useQuery({ ...apiQuery("drills.get", { params: { id: id ?? "none" } }), enabled: id !== null });

// --- Wave 4 additions (docs/design/wave4.md §5) -------------------------------------------------------
// Until the server engineer builds them these answer 501 (`OakApiError.code === "not_implemented"`, never
// retried); a surface shows its own "not built yet" copy through `ErrorState`.

/** A multi-session capstone's sessions: status, draft, X1's checks. */
export const useCapstoneSessions = (id: string | null) =>
  useQuery({ ...apiQuery("capstones.sessions", { params: { id: id ?? "none" } }), enabled: id !== null });
/** Save a capstone session's draft (its Make). */
export const useCapstoneSaveDraft = () =>
  useApiMutation("capstones.saveDraft", ["capstones.sessions", "capstones.get", "streak.get"]);
/** Record one X1 phrase or stage check graded in the browser. */
export const useCapstoneRecordCheck = () =>
  useApiMutation("capstones.recordCheck", ["capstones.sessions", "capstones.get"]);
/** What a capstone needs to open (X1: "Two more gym sets open X1"). */
export const useCapstoneGate = (id: string | null) =>
  useQuery({ ...apiQuery("capstones.gate", { params: { id: id ?? "none" } }), enabled: id !== null });
/** Edit a release's liner notes or whether the review's note shows. */
export const useAlbumPatchVersion = () => useApiMutation("album.patchVersion", ["album.track", "album.get"]);
/** Attach a submitted capstone review to an album version. */
export const useAlbumAttachReview = () =>
  useApiMutation("album.attachReview", ["album.track", "tutor.reviews"]);
/** Submitted reviews of a capstone or transcription, newest first. */
export const useTutorReviews = (
  subject: { subjectKind: "capstone" | "transcription"; subjectId: string } | null,
) =>
  useQuery({
    ...apiQuery("tutor.reviews", {
      query: subject ?? { subjectKind: "capstone", subjectId: "none" },
    }),
    enabled: subject !== null,
  });
/** Remember a transcription project's player settings and notes. */
export const useTranscriptionSettings = () =>
  useApiMutation("transcriptions.putSettings", ["transcriptions.get", "transcriptions.list"]);
/** The generated ladder: level, realism, history, an offered level-up. */
export const useLadder = () => useQuery(apiQuery("ladder.get"));
/** Take an offered level-up or move down a level. */
export const useLadderSetLevel = () => useApiMutation("ladder.setLevel", ["ladder.get", "gym.plan"]);
/** The next generated ladder item (creates its project). */
export const useLadderNext = () => useApiMutation("ladder.next", ["transcriptions.list"]);
/** Grade a ladder answer on the server. */
export const useLadderSubmit = () =>
  useApiMutation("ladder.submit", [
    "ladder.get",
    "gym.plan",
    "transcriptions.get",
    "transcriptions.list",
    "progress.get",
    "skills.map",
  ]);
/** The gym slot rule and the next gym session. */
export const useGymPlan = () => useQuery(apiQuery("gym.plan"));
/** The U05.L07 voice-leading gate (`voicing()`, `rhodes`, `organ`). */
export const useVoicingGate = () => useQuery(apiQuery("gates.voicing"));

// --- Wave 5 additions (docs/design/wave5.md §5) -------------------------------------------------------
// Until the server engineer builds them these answer 501 (`OakApiError.code === "not_implemented"`, never
// retried); a surface shows its own "not built yet" copy through `ErrorState`.

/** The optional side lessons A1.L01–L04: state, and the one Today would offer next. */
export const useSideLessons = () => useQuery(apiQuery("sideLessons.list"));
/** The L5/L6 repertoire pool with the learner's passed phrases and stages. */
export const useLadderSongs = () => useQuery(apiQuery("ladder.songs"));
/** Confirm an imported transcription version as the learner's own after the strict lint passed (c2). */
export const useTranscriptionConfirmVersion = () =>
  useApiMutation("transcriptions.confirmVersion", ["transcriptions.get", "transcriptions.list"]);

// --- Wave 6 additions (docs/design/wave6.md §5) -------------------------------------------------------
// Until the server engineer builds them these answer 501 (`OakApiError.code === "not_implemented"`, never
// retried); a surface shows its own "not built yet" copy through `ErrorState`. `session.start` and `session.day`
// carry this tab's id by themselves (`callApi`, d21); the tab's own open session is `useOwnOpenSession`
// (tab-session.ts).

/** The advanced tracks (J, R, A): their gates as recorded and the one honest line each shows. */
export const useTracks = () => useQuery(apiQuery("tracks.list"));
/** Where the core stands, what the learner can now do and what stays open after it. */
export const useCoreCompletion = () => useQuery(apiQuery("course.completion"));
/** d15: the learner's latest saved Make sketch of `lessonId` (`sketch: null` when there is none). */
export const useLessonSketch = (lessonId: string | null) =>
  useQuery({
    ...apiQuery("lessons.sketch", { params: { id: lessonId ?? "none" } }),
    enabled: lessonId !== null,
  });
/** d20: record another take of an album version; the earlier takes stay. */
export const useAlbumAddTake = () => useApiMutation("album.addTake", ["album.track", "album.get"]);
/** d20: choose the take that plays by default and is exported. */
export const useAlbumChooseTake = () => useApiMutation("album.chooseTake", ["album.track", "album.get"]);
/** d20: the audio of one take of an album version, for an `<audio src>` (`take` absent: the current one). */
export function albumTakeUrl(trackId: string, version: number, take?: number): string {
  return apiUrl("album.getAudio", {
    params: { id: trackId, v: String(version) },
    ...(take === undefined ? {} : { query: { take: String(take) } }),
  });
}

// --- Wave 7 additions (docs/design/wave7.md §5) -------------------------------------------------------
// Until the server engineer builds them these answer 501 (`OakApiError.code === "not_implemented"`, never
// retried); a surface shows its own "not built yet" copy through `ErrorState`. The planner's real next session
// rides on `SessionSummary.next` (carry f6) and the plan's track offers on `SessionPlan.trackOffers`: no new hook.

/** The learner's choice between the core and the tracks (`core` by default, contracts §2.6). */
export const useTrackFocus = () => useQuery(apiQuery("tracks.focus"));
/** Choose where the New block comes from; Today, the tracks and the plan follow. */
export const useSetTrackFocus = () =>
  useApiMutation("tracks.setFocus", ["tracks.focus", "tracks.list", "session.today", "lessons.progress"]);
/** The whole course (259 sessions): its stage, the tracks, both sides of the album, what stays open after it. */
export const useWholeCourse = () => useQuery(apiQuery("course.whole"));
/**
 * Exactly what a released album version plays, for "Export" (carry f2): the capstone surface renders it with
 * `renderPiece` (`@oak/strudel/offline`) and offers the WAV as a download. Fetched on demand (`enabled`).
 */
export const useAlbumSource = (trackId: string | null, version: number | null) =>
  useQuery({
    ...apiQuery("album.source", { params: { id: trackId ?? "none", v: String(version ?? 1) } }),
    enabled: trackId !== null && version !== null,
  });
