// `POST /api/capstones/:id/release` (wave2 §4, ux §5.2–§5.3): a capstone draft goes on the album. The first
// release creates the capstone's track (Side A for core capstones, Side B for track capstones); a release of
// an already released capstone is a revision and becomes the next version. One transaction: the last
// capstone session (when it is still open), the track version, the capstone state, unlocks and can-dos.
import type { AlbumTrackDetail, CanDoEntry, CapstoneRelease, CapstoneReleaseResult, Unlock } from "@oak/api";
import { CapstoneReviewSchema } from "@oak/api";
import { tx } from "../db/index.ts";
import { conflict, notFound } from "../errors.ts";
import type { CanDoService } from "./cando.ts";
import type { CapstoneSessionsService } from "./capstone-sessions.ts";
import { LearnerTime, type ServiceContext } from "./context.ts";
import type { CourseService } from "./course.ts";
import type { GatesService } from "./gates.ts";
import type { LibraryService } from "./library.ts";
import type { StreakService } from "./streak.ts";
import type { TracksService } from "./tracks.ts";
import type { UnlocksService } from "./unlocks.ts";

export interface ReleaseDeps {
  course: CourseService;
  gates: GatesService;
  library: LibraryService;
  unlocks: UnlocksService;
  cando: CanDoService;
  streak: StreakService;
  /** Wave 4: transcribe capstones release on their checks; revealed checks are named in the liner notes. */
  capstoneSessions?: CapstoneSessionsService;
  /** Wave 6: the release that completes the core records the instant (wave6.md §5.5). */
  tracks?: TracksService;
}

export class CapstoneReleaseService {
  readonly time: LearnerTime;
  constructor(
    private readonly ctx: ServiceContext,
    private readonly d: ReleaseDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }

  /** Side A holds the core capstones; capstones of an advanced track go on Side B. */
  sideOf(capstoneId: string): "A" | "B" {
    return this.ctx.content.source.syllabus.tracks.some((t) => (t.capstones as string[]).includes(capstoneId))
      ? "B"
      : "A";
  }

  release(id: string, body: CapstoneRelease): CapstoneReleaseResult {
    const meta = this.ctx.content.capstoneMeta(id);
    if (meta === null) throw notFound(`capstone ${id}`);
    const repos = this.ctx.repos;
    const out = tx(repos.db, () => {
      const status = this.d.gates.capstoneStatus(id);
      if (status.status === "locked") throw conflict(status.lockedReason ?? "this capstone is not open yet");
      const row = repos.capstones.get(id);
      if (row === null) throw conflict("start the capstone's first session before releasing it");
      if (repos.sketches.version(body.sketchId, body.sketchVersion) === null)
        throw notFound(`sketch ${body.sketchId} v${body.sketchVersion}`);
      // The requirements checklist must be met: the latest rubric run on the draft passed (§6.6). A transcribe
      // capstone with authored checks (X1) is ready when every phrase and stage check passed or was revealed.
      const cleared = this.d.capstoneSessions?.checksCleared(id) ?? null;
      if (cleared === false)
        throw conflict(
          "every phrase and chord stage has to be checked before release; check the ones still open",
        );
      if (cleared === null && (row.lastResult === null || row.lastResult.status !== "pass"))
        throw conflict("every required rule of the brief has to pass before release; run the check first");
      // Wave 6 (content-kit `CapstoneSessionDef.rubric`, CF-T.S4): a transcribe capstone whose last session has
      // required rules of its own (the arrangement keeps the song's sections) releases once they pass too.
      const sessionRubric = (this.ctx.content.capstoneDef(id)?.sessionDefs ?? []).some((s) =>
        (s.rubric ?? []).some((r) => r.required),
      );
      if (cleared === true && sessionRubric && (row.lastResult === null || row.lastResult.status !== "pass"))
        throw conflict("the arrangement's required lines have to pass before release; run the check first");
      // The first release must be of the code that passed: a draft checked, then edited, is checked again. (A
      // revision of a released track is the album's Revise flow; "completed stays completed", contracts §11.7.)
      if (cleared === null && row.status !== "released" && row.checked) {
        const checkedCode = repos.sketches.version(row.checked.sketchId, row.checked.version)?.code;
        const releasedCode = repos.sketches.version(body.sketchId, body.sketchVersion)?.code;
        if (checkedCode === undefined || checkedCode.trim() !== releasedCode?.trim())
          throw conflict("the draft changed since its last check; run the check again before release");
      }
      const all = this.ctx.content.capstoneSessionIds(id);
      const missing = all.filter((s) => !row.sessions.includes(s));
      if (missing.length > 1)
        throw conflict(
          `finish ${missing.slice(0, -1).join(", ")} first; the release is the last session's work`,
        );
      const unlocks: Unlock[] = [];
      const now = this.time.iso();
      const sessions = [...row.sessions, ...missing];
      for (const s of missing) unlocks.push(...this.d.unlocks.onComplete(s));

      const review = CapstoneReviewSchema.safeParse(repos.tutor.latestReview("capstone", id));
      const note = review.success && body.includeReviewNote ? review.data.linerNote.trim() : "";
      // A revealed check is named in the liner notes (contracts §6.6), once.
      const revealed = (this.d.capstoneSessions?.revealedLines(id) ?? []).filter(
        (l) => !body.linerNotesMd.includes(l),
      );
      const own = [body.linerNotesMd.trimEnd(), ...revealed].filter((x) => x !== "").join("\n\n");
      // The app may already have appended the review's note (the release dialog does): never twice.
      const linerNotesMd = note === "" || own.includes(note) ? own : `${own}\n\n${note}`.trim();
      const version = {
        sketchId: body.sketchId,
        sketchVersion: body.sketchVersion,
        linerNotesMd,
        theoryTags: body.theoryTags,
        attribution: null,
        includeReviewNote: body.includeReviewNote,
      };
      const existing = repos.album.trackOfCapstone(id);
      // The same release sent twice (a retried request, a second tab) is not a revision: when the track's
      // current version already is this sketch version with these notes and tags, nothing new is made.
      if (existing !== null && row.status === "released") {
        const current = this.d.library.track(existing.id);
        const latest = current.versions.find((v) => v.version === current.currentVersion);
        if (
          latest !== undefined &&
          latest.sketchId === body.sketchId &&
          latest.sketchVersion === body.sketchVersion &&
          latest.linerNotesMd === linerNotesMd &&
          JSON.stringify(latest.theoryTags) === JSON.stringify(body.theoryTags)
        ) {
          // Only where the track sits may differ (Oak 2.0 W4 F6): no new version for it.
          if (body.shelved !== undefined) repos.album.setShelved(existing.id, body.shelved);
          return { trackId: existing.id, unlocks, canDo: [] as CanDoEntry[] };
        }
      }
      // Wave 7 (content-kit `CapstoneDef.versions`, AC1): a two-version capstone is released as ONE album track
      // holding both versions, version one first (track version 1) and version two after it (track version 2).
      const drafts = this.d.capstoneSessions?.versions(id) ?? null;
      const both =
        existing === null && drafts !== null && drafts.every((v) => v.draft !== null)
          ? drafts.map((v) => v.draft as { sketchId: string; sketchVersion: number })
          : null;
      let track =
        existing === null
          ? this.d.library.createTrack({
              capstoneId: id as AlbumTrackDetail["capstoneId"],
              side: this.sideOf(id),
              title: body.title,
              flavour: body.flavour,
              ...version,
              ...(both === null ? {} : (both[0] as { sketchId: string; sketchVersion: number })),
            })
          : this.d.library.addTrackVersion(existing.id, version);
      if (both !== null)
        for (const d of both.slice(1)) track = this.d.library.addTrackVersion(track.id, { ...version, ...d });
      if (review.success) repos.album.setReview(track.id, track.currentVersion, review.data);
      // Oak 2.0 W4 F6: `true` puts the track on the Shelf, `false` on the album, absent keeps where it is (a first
      // release: the album). The release itself is unchanged: released, unlocks, can-dos, the side's count.
      if (body.shelved !== undefined && body.shelved !== (track.shelved === true)) {
        repos.album.setShelved(track.id, body.shelved);
        track = this.d.library.track(track.id);
      }
      const first = row.status !== "released";
      repos.capstones.save({
        ...row,
        status: "released",
        sessions,
        sketchId: body.sketchId,
        trackId: track.id,
        flavour: body.flavour ?? row.flavour,
        startedAt: row.startedAt ?? now,
        releasedAt: row.releasedAt ?? now,
        updatedAt: now,
      });
      for (const sid of missing) this.d.capstoneSessions?.onSessionDone(sid);
      let canDo: CanDoEntry[] = [];
      if (first) {
        unlocks.push(...this.d.unlocks.onComplete(id));
        canDo = this.d.cando.evaluate({ sourceId: id, evidence: { kind: "track", id } });
        // The last piece of the core: the instant is kept; the session's Coda carries the moment (`sessions.end`).
        this.d.tracks?.syncCore(
          body.sessionId !== null && repos.sessions.get(body.sessionId) !== null ? body.sessionId : null,
        );
      }
      return { trackId: track.id, unlocks, canDo };
    });
    return {
      state: this.d.course.capstoneState(id),
      track: this.d.library.track(out.trackId),
      unlocks: out.unlocks,
      canDo: out.canDo,
      streak: this.d.streak.summary(),
    };
  }
}
