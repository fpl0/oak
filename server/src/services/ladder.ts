// The generated transcription ladder L1–L4 (contracts §2.9, §6.12; docs/design/wave4.md §5.4): the learner's level
// and realism, the next item from `@oak/drills` `generateLadderPiece` (hidden code on the server, stimulus events to
// the browser), exact grading through the grader's ladder entry on the learner host, graded passes (what
// milestones and level-ups count), the realism rule from each session's best score, and the offered level-up.
// Wave 5 (wave5.md §5.3): the song levels L5 (PD folk, one phrase per submission) and L6 (blues, bass → changes →
// melody), cut from the repertoire's answer keys (`song-ladder.ts`) and graded with `songLadderRequest`.
import type {
  LadderItem,
  LadderNext,
  LadderSong,
  LadderState,
  LadderSubmit,
  LadderSubmitResult,
  TranscriptionDetail,
} from "@oak/api";
import type {
  GradeResult,
  KeySpec,
  LintContext,
  MeterId,
  PickupSpec,
  SongDef,
  SwingSpec,
  UnlockableId,
} from "@oak/content-kit";
import { skillOf } from "@oak/content-kit";
import {
  type GradeRequest,
  LADDER_PASS,
  type LadderGradeRequest,
  ladderGradedPass,
  ladderGradeRequest,
  nextRealism,
  type RealismLevel,
  STANDARD_LADDER_PASS,
  type StandardCodeStage,
  type StandardLadderStage,
  songLadderPassed,
  songLadderRequest,
  standardLadderPassed,
  standardLadderRequest,
} from "@oak/grader";
import { tx } from "../db/index.ts";
import type { StoredTranscription } from "../db/repos/library.ts";
import type { LadderSessionRow } from "../db/repos/wave4.ts";
import { ApiError, badRequest, conflict, notFound } from "../errors.ts";
import { familyForLayer } from "./capstone-sessions.ts";
import { LearnerTime, newId, type ServiceContext } from "./context.ts";
import type { LadderGenerator, LibraryService, PatternStimulus } from "./library.ts";
import { evidenceWeight, type MasteryService } from "./mastery.ts";
import type { SrsPort } from "./ports.ts";
import {
  checkKeyOf,
  checkOf,
  type SongCheck,
  type SongLevel,
  type SongStage,
  songChecks,
  songGaps,
  songLock,
  songPhrases,
  strainBars,
} from "./song-ladder.ts";
import {
  CODE_STAGES,
  formMapResult,
  STANDARD_STAGES,
  sectionCount,
  standardGaps,
  standardIds,
  standardKey,
  standardKeys,
  standardLock,
  versionKeys,
} from "./standard-ladder.ts";
import type { StreakService } from "./streak.ts";
import type { UnlocksService } from "./unlocks.ts";

/** The levels an item is drawn at or the ladder is set to: 7 is the learner's own audio, never an item. */
export type LadderLevelNo = 1 | 2 | 3 | 4 | 5 | 6 | 8;
type Stage = "bass" | "quality" | "rn";
/** The level-up to L6 also needs the 12-bar form (wave5.md §5.3: L6 material is blues). */
export const L6_NEEDS_LESSON = "U11.L05";

/** Level-up (wave4.md §5.4): graded passes at the current level, at realism R2 or higher, on this many days. */
export const LEVEL_UP_PASSES = 2;
export const LEVEL_UP_MIN_REALISM = 2;
/** Sessions `ladder.get` reports (oldest first). */
export const LADDER_HISTORY = 10;

export interface LadderDeps {
  library: LibraryService;
  mastery: MasteryService;
  streak: StreakService;
  unlocks: UnlocksService;
  srs: () => SrsPort | null;
  /** The learner host's `grade` (`GraderHost.grade`): learner code never runs in the server's own realm. */
  grade: (req: GradeRequest) => Promise<GradeResult>;
  generator?: LadderGenerator;
  /** Wave 5: events of a song item's hidden code for the pattern source (the learner host evaluates it). */
  stimulus?: PatternStimulus;
  /** Wave 5, OAK_DEV=1 only: offer songs whose answer key is still "Being checked" (e2e and dev seeds). */
  allowUnverifiedSongs?: boolean;
}

/** The layer a level (and an L3 or L6 stage) transcribes, for evidence. */
function layerOf(level: number, stage: Stage | SongStage | null): "melody" | "bass" | "chords" | null {
  if (level === 1) return null;
  if (level === 2) return "bass";
  if (level === 3) return stage === null || stage === "bass" ? "bass" : "chords";
  if (level === 6) return stage === "bass" ? "bass" : stage === "changes" ? "chords" : "melody";
  return "melody";
}
const isSongItem = (t: StoredTranscription): boolean =>
  t.sourceKind === "pd-song" && (t.ladderLevel === 5 || t.ladderLevel === 6) && t.ladder != null;
/** Wave 6: an L8 item, a standard taken down form → bass → changes → melody. */
const isStandardItem = (t: StoredTranscription): boolean =>
  t.sourceKind === "pd-song" && t.ladderLevel === 8 && t.ladder != null;
/** Where a sound a learner has not unlocked falls back to at realism R3 and above (d7), first unlocked wins. */
const SOUND_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  upright: ["ebass", "piano"],
  fingerbass: ["ebass", "piano"],
  rhodes: ["piano"],
  organ: ["piano"],
  vibes: ["piano"],
  tenor: ["piano"],
  choir: ["piano"],
};

export class LadderService {
  readonly time: LearnerTime;
  constructor(
    private readonly ctx: ServiceContext,
    private readonly d: LadderDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }
  get #repos() {
    return this.ctx.repos;
  }

  /** `GET /ladder`. */
  state(): LadderState {
    const s = this.#repos.ladder.state();
    const sessions = this.#repos.ladder.sessions();
    const gradedPasses: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 };
    for (const t of this.#repos.transcriptions.list())
      if (
        (t.sourceKind === "generated" || isSongItem(t) || isStandardItem(t)) &&
        t.gradedPass === true &&
        t.ladderLevel !== null
      )
        gradedPasses[String(t.ladderLevel)] = (gradedPasses[String(t.ladderLevel)] ?? 0) + 1;
    return {
      level: s.level,
      realism: s.realism,
      history: sessions.slice(-LADDER_HISTORY).map((r) => ({
        level: r.level,
        realism: r.startRealism,
        score: r.bestScore,
        passed: r.passed,
        day: r.day,
        gymId: r.gymId as LadderState["history"][number]["gymId"],
      })),
      gradedPasses,
      levelUp: this.#levelUp(s.level, sessions),
    };
  }

  #levelUp(level: number, sessions: readonly LadderSessionRow[]): LadderState["levelUp"] {
    if (level >= 8) return null;
    if (level >= 6) {
      // L8 (a standard, wave6.md §5.4): once CF-T is released and two L6 songs have a graded pass on two days
      // (decision 36's rule). A released X2 counts as one L6 song, on the day it was released.
      if (this.#l8Missing(sessions) !== null) return null;
      return { to: 8, reason: "CF-T released, and two blues transcribed at L6 on two different days." };
    }
    if (level === 5) {
      // L6 (blues) after two graded L5 songs, once the 12-bar form is known (wave5.md §5.3). A released X1 counts as
      // one graded L5 song (contracts §2.9: X1 is L5 material).
      if (this.#repos.lessons.progress(L6_NEEDS_LESSON)?.status !== "completed") return null;
      const songs = new Set(
        this.#repos.transcriptions
          .list()
          .filter((t) => isSongItem(t) && t.ladderLevel === 5 && t.gradedPass === true)
          .map((t) => t.songId),
      );
      const x1 = this.#repos.capstones.get("X1")?.status === "released" ? 1 : 0;
      if (songs.size + x1 < LEVEL_UP_PASSES) return null;
      return { to: 6, reason: "Two folk songs transcribed phrase by phrase, and the 12-bar form learned." };
    }
    const days = new Set(
      sessions
        .filter((r) => r.level === level && r.gradedPass && r.startRealism >= LEVEL_UP_MIN_REALISM)
        .map((r) => r.day),
    );
    if (days.size < LEVEL_UP_PASSES) return null;
    return {
      to: (level + 1) as LadderLevelNo,
      reason: `Two graded passes at L${level}, realism R${LEVEL_UP_MIN_REALISM} or higher, on two different days.`,
    };
  }

  /** What L8 still waits for, as the reason `ladder.setLevel { level: 8 }` answers 409 with; `null` once offered. */
  #l8Missing(sessions: readonly LadderSessionRow[]): string | null {
    const days = new Set(sessions.filter((r) => r.level === 6 && r.gradedPass).map((r) => r.day));
    const x2 = this.#repos.capstones.get("X2");
    if (x2?.status === "released" && x2.releasedAt !== null) days.add(this.time.day(new Date(x2.releasedAt)));
    const cft = this.#repos.capstones.get("CF-T")?.status === "released";
    if (cft && days.size >= LEVEL_UP_PASSES) return null;
    return "L8 opens once CF-T is released and two blues are transcribed at L6 on two different days (a released X2 counts as one)";
  }

  /** `PUT /ladder`: take the offered level-up, or move down any time. A new level starts at R0. */
  setLevel(level: number): LadderState {
    tx(this.#repos.db, () => {
      const s = this.#repos.ladder.state();
      if (level === s.level) return;
      const up = this.#levelUp(s.level, this.#repos.ladder.sessions());
      if (level > s.level && (up === null || up.to !== level))
        throw conflict(
          level === 8 && s.level === 6
            ? (this.#l8Missing(this.#repos.ladder.sessions()) ?? "L8 is next")
            : level > s.level + 1
              ? `the ladder moves up one level at a time: L${s.level === 6 ? 8 : s.level + 1} is next`
              : up !== null
                ? `the next level is L${up.to}`
                : s.level === 5
                  ? `L6 opens after two folk songs transcribed at L5 (a released X1 counts as one), once ${L6_NEEDS_LESSON} is done`
                  : `L${level} opens after two graded passes at L${s.level} at realism R2 or higher, on two days`,
        );
      this.#repos.ladder.saveState(level, 0, this.time.iso());
    });
    return this.state();
  }

  /**
   * Wave 5 (c10): the level-up a ladder session opened, announced in that session's Coda only: offered now, and not
   * offered without that session's graded pass.
   */
  levelUpEarnedBy(sessionKey: string): LadderState["levelUp"] {
    const s = this.#repos.ladder.state();
    const sessions = this.#repos.ladder.sessions();
    const row = sessions.find((r) => r.sessionKey === sessionKey);
    if (row === undefined || !row.gradedPass || row.level !== s.level) return null;
    const now = this.#levelUp(s.level, sessions);
    if (now === null) return null;
    if (s.level >= 5) {
      // Song levels count songs, not sessions: the session that finished the second song opened it.
      const finished = this.#repos.transcriptions
        .list()
        .some(
          (t) => isSongItem(t) && t.ladderLevel === s.level && t.gradedPass === true && t.gymId === row.gymId,
        );
      return finished ? now : null;
    }
    const without = this.#levelUp(
      s.level,
      sessions.filter((r) => r.sessionKey !== sessionKey),
    );
    return without === null ? now : null;
  }

  /** The realism a gym session's ladder item is drawn at: the learner's, one up on an even slot without audio. */
  realismFor(level: number, fallback: boolean): RealismLevel {
    const s = this.#repos.ladder.state();
    const base = level === s.level ? s.realism : 0;
    return Math.min(4, base + (fallback ? 1 : 0)) as RealismLevel;
  }

  /** `POST /ladder/items`: the next generated item, created as a `generated` transcription project. */
  async next(body: LadderNext): Promise<LadderItem> {
    const s = this.#repos.ladder.state();
    const level = (body.level ?? s.level) as LadderLevelNo;
    if (level > s.level) {
      const up = this.#levelUp(s.level, this.#repos.ladder.sessions());
      if (up === null || up.to !== level)
        throw conflict(
          level === 8 && s.level === 6
            ? (this.#l8Missing(this.#repos.ladder.sessions()) ?? "L8 is not open yet")
            : `L${level} is not open yet; the ladder is at L${s.level}`,
        );
    }
    if (level === 8) return this.#nextStandard(body);
    if (level >= 5) return this.#nextSong(body, level as SongLevel);
    if (body.songId !== undefined)
      throw badRequest("a song is worked at L5 or L6; L1–L4 items are generated");
    if (this.d.generator === undefined)
      throw new ApiError("unavailable", "the ladder generator is not available yet");
    let realism: number = level === s.level ? s.realism : 0;
    let gymId: string | null = null;
    if (body.gymId !== null) {
      const gym = this.#repos.gym.list().find((g) => g.gymId === body.gymId);
      if (gym === undefined) throw notFound(`gym session ${body.gymId}`);
      gymId = gym.gymId;
      // The gym session fixed its realism when it started (an even slot without audio: one level up).
      if (gym.kind === "ladder" && gym.realism !== null && (gym.ladderLevel ?? level) === level)
        realism = gym.realism;
    }
    const seed = body.seed ?? Math.floor(Math.random() * 2 ** 31);
    const completed = new Set(
      this.#repos.lessons
        .allProgress()
        .filter((p) => p.status === "completed")
        .map((p) => p.lessonId as string),
    );
    const piece = this.d.generator(level, realism, seed, { completed });
    // d7: at realism R3 and above the stimulus plays only sounds the learner has unlocked.
    const heard = this.#unlockedStimulus(realism, {
      events: piece.events,
      preload: piece.preload,
      performance: piece.performance,
    });
    const id = newId("tr");
    const at = this.time.iso();
    const t: StoredTranscription = {
      id,
      sourceKind: "generated",
      player: "pattern",
      audioId: null,
      songId: null,
      title: piece.title,
      artist: null,
      key: piece.key,
      bpm: piece.bpm,
      meter: piece.meter,
      downbeatS: null,
      fineTuneCents: 0,
      ladderLevel: level,
      realism,
      regions: [],
      checklist: {},
      selfScore: null,
      currentVersion: 0,
      status: "in_progress",
      review: null,
      createdAt: at,
      updatedAt: at,
      hiddenCode: piece.code,
      gradedPass: false,
      gymId: gymId as StoredTranscription["gymId"],
      ladder: {
        seed,
        given: {
          bpm: piece.given.bpm,
          meter: piece.given.meter,
          key: piece.given.key,
          pickup: piece.given.pickup as { units: [number, number] } | null,
          bars: piece.given.bars,
        },
        cycles: piece.bars,
        stages: piece.stages,
        swing: piece.swing as { subdivision: number; amount: number } | null,
        title: piece.title,
        stimulus: {
          events: heard.events,
          cps: piece.cps,
          bars: piece.bars,
          preload: heard.preload,
          performance: heard.performance,
        },
      },
    };
    tx(this.#repos.db, () => {
      this.#repos.transcriptions.insert(t);
      if (gymId !== null) this.#repos.gym.setTranscription(gymId, id);
    });
    const project: TranscriptionDetail = await this.d.library.transcription(id);
    return {
      itemId: id,
      level,
      realism,
      seed,
      stages: piece.stages,
      given: {
        bpm: piece.given.bpm,
        meter: piece.given.meter,
        key: piece.given.key,
        pickup: piece.given.pickup,
        bars: piece.given.bars,
      },
      project,
    };
  }

  /**
   * The answer key of a stored item as code the learner could write (dev seeds and tests only; never served): the
   * generator is deterministic, so the item is regenerated from its seed and checked against the stored reference.
   */
  answerOf(itemId: string, stage: Stage | null): string | null {
    const t = this.#repos.transcriptions.get(itemId);
    if (t === null || t.ladder === undefined || t.ladder === null || this.d.generator === undefined)
      return null;
    const completed = new Set(
      this.#repos.lessons
        .allProgress()
        .filter((p) => p.status === "completed")
        .map((p) => p.lessonId as string),
    );
    const piece = this.d.generator(t.ladderLevel ?? 1, t.realism ?? 0, t.ladder.seed, { completed });
    if (piece.code !== t.hiddenCode) return null;
    return stage === null ? piece.answer : (piece.stageAnswers?.[stage] ?? null);
  }

  /** The grader's item for a stored ladder project (the hidden reference stays here). */
  #item(t: StoredTranscription, stage: Stage | null): LadderGradeRequest["item"] {
    const l = t.ladder as NonNullable<StoredTranscription["ladder"]>;
    return {
      itemId: `lad.${t.ladderLevel}.${l.seed}`,
      level: t.ladderLevel as 1 | 2 | 3 | 4,
      ...(stage === null ? {} : { stage }),
      reference: t.hiddenCode as string,
      bars: l.cycles,
      key: l.given.key as KeySpec,
      meter: l.given.meter as MeterId,
      bpm: l.given.bpm,
      ...(l.given.pickup === null ? {} : { pickup: l.given.pickup as PickupSpec }),
      ...(l.swing === null ? {} : { swing: l.swing as SwingSpec }),
    };
  }

  /**
   * `POST /ladder/items/:id/submissions`: grade exactly against the hidden reference (pass ≥ 0.85), save the
   * version, record the session's best score and apply the realism rule (contracts §6.12). L3 is staged:
   * `bass`, then `quality`, then `rn`, each open once the one before passed or was revealed.
   */
  async submit(itemId: string, body: LadderSubmit): Promise<LadderSubmitResult> {
    const t = this.#repos.transcriptions.get(itemId);
    if (t === null) throw notFound(`ladder item ${itemId}`);
    if (isStandardItem(t)) return this.#submitStandard(t, body);
    if (body.stage === "form" || body.formMap !== undefined)
      throw badRequest("a form map belongs to an L8 standard");
    if (isSongItem(t)) return this.#submitSong(t, body);
    if (t.sourceKind !== "generated" || t.ladder === undefined || t.ladder === null || t.hiddenCode === null)
      throw conflict("this project is not a generated ladder item");
    const stages = t.ladder.stages as Stage[] | null;
    if (body.stage === "changes" || body.stage === "melody")
      throw badRequest(`the ${body.stage} stage belongs to L6 song items`);
    if (body.phrase !== undefined) throw badRequest("a phrase is named only for an L5 song item");
    const stage: Stage | null = body.stage ?? null;
    if (stages !== null && stages.length > 0) {
      if (stage === null) throw badRequest("this item is checked stage by stage: name the stage");
      const i = stages.indexOf(stage);
      if (i < 0) throw badRequest(`this item has no stage ${stage}`);
      const versions = this.#repos.transcriptions.versions(itemId);
      for (const prev of stages.slice(0, i)) {
        const cleared = versions.some(
          (v) =>
            v.stage === prev &&
            v.result !== null &&
            ((v.result.status === "pass" && v.result.score >= LADDER_PASS) || v.result.assist.revealed),
        );
        if (!cleared) throw conflict(`the ${stage} stage opens once the ${prev} stage passes`);
      }
    } else if (stage !== null) throw badRequest("this item has no stages");

    const lint: LintContext = {
      profile: "graded",
      unlocked: this.d.unlocks.usableIn(null) as Set<UnlockableId>,
      allowPreview: false,
      meter: t.ladder.given.meter as MeterId,
      key: t.ladder.given.key as KeySpec,
    };
    const prior = this.#repos.transcriptions.versions(itemId).filter((v) => (v.stage ?? null) === stage);
    const graded = prior.filter((v) => v.result !== null && v.result.status !== "error").length;
    const req = ladderGradeRequest({
      item: this.#item(t, stage),
      code: body.code,
      ctx: {
        params: {},
        attemptNo: graded + 1,
        firstAttempt: graded === 0,
        rung: body.rung,
        tutorHints: 0,
        extraReplays: 0,
        lint,
      },
    });
    const raw = await this.d.grade(req);
    // The hint rung is the client's for a ladder item (no step row); rung 4 is a reveal: never a graded pass.
    const result: GradeResult = {
      ...raw,
      assist: { ...raw.assist, rung: body.rung, revealed: raw.assist.revealed || body.rung >= 4 },
    };
    const isGraded = result.status !== "error";
    const passed = result.status === "pass" && result.score >= LADDER_PASS - 1e-9;

    let otherWork: { familyId: string; credit: number; gym: boolean } | null = null;
    const out = tx(this.#repos.db, () => {
      const version = this.d.library.saveTranscriptionVersion(itemId, {
        code: body.code,
        result,
        ranOk: isGraded,
        stage,
      });
      const fresh = this.#repos.transcriptions.get(itemId) as StoredTranscription;
      const versions = this.#repos.transcriptions.versions(itemId);
      const stageGraded = (s: Stage | null) =>
        versions.some((v) => (v.stage ?? null) === s && v.result !== null && ladderGradedPass(v.result));
      const gradedPass =
        stages !== null && stages.length > 0 ? stages.every((s) => stageGraded(s)) : ladderGradedPass(result);
      const last = stages === null || stages.length === 0 || stage === stages.at(-1);
      this.#repos.transcriptions.update({
        ...fresh,
        gradedPass: fresh.gradedPass === true || gradedPass,
        status: fresh.status === "done" || (passed && last) ? "done" : fresh.status,
        updatedAt: this.time.iso(),
      });

      // The session's best score (an Oak session, else the learner day) feeds the realism rule.
      const s = this.#repos.ladder.state();
      const day = this.time.day();
      const key =
        body.sessionId !== null && this.#repos.sessions.get(body.sessionId) !== null
          ? body.sessionId
          : `day:${day}`;
      const prev = this.#repos.ladder.session(key);
      const now = this.time.iso();
      const row: LadderSessionRow = {
        sessionKey: key,
        level: t.ladderLevel ?? s.level,
        startRealism: prev?.startRealism ?? s.realism,
        bestScore: isGraded ? Math.max(prev?.bestScore ?? 0, result.score) : (prev?.bestScore ?? 0),
        passed: (prev?.passed ?? false) || passed,
        gradedPass: (prev?.gradedPass ?? false) || gradedPass,
        day: prev?.day ?? day,
        gymId: t.gymId ?? prev?.gymId ?? null,
        firstAt: prev?.firstAt ?? now,
        at: now,
      };
      this.#repos.ladder.saveSession(row);
      let realismChange: LadderSubmitResult["realismChange"] = null;
      // Realism moves with items at the learner's own level; the session's best score decides (so a better item
      // later in the same session can undo a drop an earlier one caused). Announced once, in the Coda.
      if (isGraded && row.level === s.level) {
        const history = this.#repos.ladder
          .sessions()
          .filter((r) => r.sessionKey !== key)
          .concat([row])
          .map((r) => ({
            level: r.level as 1 | 2 | 3 | 4,
            realism: r.startRealism as RealismLevel,
            score: r.bestScore,
          }));
        const to = nextRealism(history, row.startRealism as RealismLevel);
        if (to !== s.realism) this.#repos.ladder.saveState(s.level, to, now);
        if (to !== row.startRealism) realismChange = { from: row.startRealism, to };
      }

      // Evidence (contracts §7.4–§7.5): the item's first graded answer per stage, never a revealed or machine one.
      if (isGraded && graded === 0 && !result.assist.revealed) {
        const layer = layerOf(t.ladderLevel ?? 1, stage);
        const fam = layer === null ? null : familyForLayer(this.ctx.content, layer);
        if (fam !== null) {
          const skills = [...new Set(fam.skills.map((x) => skillOf(x.skill)))];
          this.d.mastery.addEvidence(
            skills.map((skillId) => ({
              skillId: skillId as never,
              category: null,
              score: Math.max(0, Math.min(1, result.score)),
              weight: evidenceWeight("gym-set"),
              sourceKind: "gym-set" as const,
              sourceId: `ladder/${itemId}${stage === null ? "" : `.${stage}`}`,
            })),
          );
          otherWork = { familyId: fam.id, credit: result.score, gym: t.gymId !== null };
        }
      }
      return { result, passed, gradedPass, realismChange, version };
    });
    // A graded transcription step reviews its family's card when due within 2 days, else moves only its level
    // (contracts §7.4): melodic dictation items are what "gym sets" toward X1's family level are made of.
    const ow = otherWork as { familyId: string; credit: number; gym: boolean } | null;
    const srs = this.d.srs();
    if (ow !== null && srs?.otherWork !== undefined)
      await srs.otherWork({
        source: ow.gym ? "gym" : "practice",
        familyId: ow.familyId,
        meanCredit: ow.credit,
      });
    return { ...out, ladder: this.state() };
  }

  // --- Wave 5: the song levels L5 and L6 (wave5.md §5.3) ------------------------------------------

  #completed(): Set<string> {
    return new Set(
      this.#repos.lessons
        .allProgress()
        .filter((p) => p.status === "completed")
        .map((p) => p.lessonId as string),
    );
  }
  #meta(songId: string) {
    return (this.ctx.content.source.repertoire ?? []).find((m) => m.id === songId);
  }
  /** The songs of a level whose answer key can be cut into items, in repertoire order. */
  #pool(level: SongLevel): SongDef[] {
    const order = (this.ctx.content.source.repertoire ?? []).map((m) => m.id);
    return this.ctx.content.source.songs
      .filter((song) => songGaps(song, this.#meta(song.id), level).length === 0)
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  #lockOf(song: SongDef): string | null {
    return songLock(song, this.#meta(song.id), {
      completed: this.#completed(),
      allowUnverified: this.d.allowUnverifiedSongs === true,
      lessonTitle: (id) => this.ctx.content.lessonTitle(id),
    });
  }
  /** The song items (projects) of a song at a level, newest first. */
  #itemsOf(songId: string, level: SongLevel): StoredTranscription[] {
    return this.#repos.transcriptions
      .list()
      .filter((t) => isSongItem(t) && t.songId === songId && t.ladderLevel === level);
  }
  /** The checks of a song item that passed (unrevealed, at their mark), by key. */
  #passedChecks(t: StoredTranscription, song: SongDef, level: SongLevel): Set<string> {
    const out = new Set<string>();
    for (const v of this.#repos.transcriptions.versions(t.id)) {
      if (v.result === null || v.result.status === "error") continue;
      const c = checkOf(song, level, {
        ...(v.stage == null ? {} : { stage: v.stage }),
        ...(v.phrase == null ? {} : { phrase: v.phrase }),
      });
      if (c !== null && songLadderPassed(c as never, v.result)) out.add(checkKeyOf(c));
    }
    return out;
  }
  /** Checks cleared (passed or revealed): the next one in order opens. */
  #clearedChecks(t: StoredTranscription, song: SongDef, level: SongLevel): Set<string> {
    const out = this.#passedChecks(t, song, level);
    for (const v of this.#repos.transcriptions.versions(t.id)) {
      if (v.result === null || !(v.result.assist.revealed || v.result.assist.rung >= 4)) continue;
      const c = checkOf(song, level, {
        ...(v.stage == null ? {} : { stage: v.stage }),
        ...(v.phrase == null ? {} : { phrase: v.phrase }),
      });
      if (c !== null) out.add(checkKeyOf(c));
    }
    return out;
  }

  /** `GET /ladder/songs`: the L5 and L6 pools with each song's state and what the learner passed. */
  songs(): { items: LadderSong[] } {
    const items: LadderSong[] = [];
    for (const level of [5, 6] as const)
      for (const song of this.#pool(level)) {
        const lock = this.#lockOf(song);
        const projects = this.#itemsOf(song.id, level);
        const passed = new Set<string>();
        for (const t of projects) for (const k of this.#passedChecks(t, song, level)) passed.add(k);
        const checks = songChecks(song, level);
        const done = projects.some((t) => t.gradedPass === true);
        const passedStages =
          level === 6
            ? (["bass", "changes", "melody"] as const).filter((st) =>
                checks.filter((c) => c.stage === st).every((c) => passed.has(checkKeyOf(c))),
              )
            : [];
        const lines = checks
          .filter((c) => c.stage === "melody" && passed.has(checkKeyOf(c)))
          .map((c) => c.phrase as number);
        items.push({
          songId: song.id,
          title: song.title,
          year: song.year,
          level,
          phrases: songPhrases(song, level),
          status: lock !== null ? "locked" : done ? "done" : "open",
          lockedReason: lock,
          passedPhrases:
            level === 5
              ? checks.filter((c) => passed.has(checkKeyOf(c))).map((c) => c.phrase as number)
              : lines,
          passedStages: [...passedStages],
          // L6: the melody lines passed so far (the same numbers as `passedPhrases`, named for the page).
          ...(level === 6 ? { passedLines: lines } : {}),
        });
      }
    items.push(...this.#standards());
    return { items };
  }

  /**
   * `POST /ladder/items` at L5/L6: a song item (a `pd-song` project; the answer key stays here). A song worked across
   * slots resumes its unfinished project; `songId` picks the song, else the first open one not yet passed.
   */
  async #nextSong(body: LadderNext, level: SongLevel): Promise<LadderItem> {
    const pool = this.#pool(level);
    let song: SongDef | undefined;
    if (body.songId !== undefined) {
      song = pool.find((x) => x.id === body.songId);
      if (song === undefined) throw notFound(`L${level} song ${body.songId}`);
      const lock = this.#lockOf(song);
      if (lock !== null) throw conflict(`${song.title} is not open yet: ${lock}`);
    } else {
      const open = pool.filter((x) => this.#lockOf(x) === null);
      song =
        open.find((x) => this.#itemsOf(x.id, level).some((t) => t.status !== "done")) ??
        open.find((x) => !this.#itemsOf(x.id, level).some((t) => t.gradedPass === true)) ??
        open[0];
      if (song === undefined)
        throw conflict(
          pool.length === 0
            ? `no L${level} song has a complete answer key yet`
            : `every L${level} song is still being checked`,
        );
    }
    const s = this.#repos.ladder.state();
    let realism: number = level === s.level ? s.realism : 0;
    let gymId: string | null = null;
    if (body.gymId !== null) {
      const gym = this.#repos.gym.list().find((g) => g.gymId === body.gymId);
      if (gym === undefined) throw notFound(`gym session ${body.gymId}`);
      gymId = gym.gymId;
      if (gym.kind === "ladder" && gym.realism !== null && (gym.ladderLevel ?? level) === level)
        realism = gym.realism;
    }
    const phrases = songPhrases(song, level);
    const bars = level === 6 ? strainBars(song) : song.answerKey.bars;
    const resume = this.#itemsOf(song.id, level).find((t) => t.status !== "done");
    let id: string;
    if (resume !== undefined) {
      id = resume.id;
      if (gymId !== null)
        tx(this.#repos.db, () => {
          this.#repos.transcriptions.update({ ...resume, gymId: gymId as StoredTranscription["gymId"] });
          this.#repos.gym.setTranscription(gymId as string, id);
        });
    } else {
      const seed = body.seed ?? Math.floor(Math.random() * 2 ** 31);
      id = newId("tr");
      const at = this.time.iso();
      const reference = song.answerKey.code;
      const cycles = bars + (song.pickup === undefined ? 0 : 1);
      let stimulus: StoredTranscription["ladder"] extends infer L
        ? L extends { stimulus: infer S }
          ? S
          : null
        : null = null;
      if (this.d.stimulus !== undefined) {
        try {
          const ev = await this.d.stimulus(reference, cycles, song.meter);
          if (ev !== null)
            stimulus = this.#unlockedStimulus(realism, {
              ...ev,
              performance: {
                target: level === 5 ? "mel" : "bass",
                // R2 plays a swing feel where idiomatic (contracts §6.12): a song that declares swing (the L6 blues).
                swung: song.swing !== undefined,
                vocalLead: realism >= 4 ? (seed % 2 === 0 ? "tenor" : "choir") : null,
              },
            });
        } catch {
          stimulus = null;
        }
      }
      const t: StoredTranscription = {
        id,
        sourceKind: "pd-song",
        player: "pattern",
        audioId: null,
        songId: song.id,
        title: song.title,
        artist: null,
        key: song.key,
        bpm: song.bpm,
        meter: song.meter,
        downbeatS: null,
        fineTuneCents: 0,
        ladderLevel: level,
        realism,
        regions: [],
        checklist: {},
        selfScore: null,
        currentVersion: 0,
        status: "in_progress",
        review: null,
        createdAt: at,
        updatedAt: at,
        hiddenCode: reference,
        gradedPass: false,
        gymId: gymId as StoredTranscription["gymId"],
        ladder: {
          seed,
          given: {
            bpm: song.bpm,
            meter: song.meter as NonNullable<StoredTranscription["meter"]>,
            key: song.key,
            pickup: (song.pickup as { units: [number, number] } | undefined) ?? null,
            bars,
          },
          cycles,
          stages: level === 6 ? ["bass", "changes", "melody"] : null,
          swing: (song.swing as { subdivision: number; amount: number } | undefined) ?? null,
          title: song.title,
          stimulus,
          song: { songId: song.id, level, phrases },
        },
      };
      tx(this.#repos.db, () => {
        this.#repos.transcriptions.insert(t);
        if (gymId !== null) this.#repos.gym.setTranscription(gymId, id);
      });
    }
    const stored = this.#repos.transcriptions.get(id) as StoredTranscription;
    const project: TranscriptionDetail = await this.d.library.transcription(id);
    return {
      itemId: id,
      level,
      realism: stored.realism ?? realism,
      seed: stored.ladder?.seed ?? 0,
      stages: level === 6 ? ["bass", "changes", "melody"] : null,
      given: {
        bpm: song.bpm,
        meter: song.meter,
        key: song.key,
        pickup: song.pickup ?? null,
        bars,
        // Wave 6: a tune that changes key gives its key plan (its ribbon is a given, like the key).
        ...(song.keyPlan === undefined ? {} : { keyPlan: song.keyPlan.map((k) => ({ ...k })) }),
      },
      project,
      song: { songId: song.id, title: song.title, year: song.year },
      phrases,
    };
  }

  /** The answer key of a song item as code the learner could write (dev seeds and tests only; never served). */
  songAnswerOf(itemId: string): string | null {
    const t = this.#repos.transcriptions.get(itemId);
    if (t === null || !(isSongItem(t) || isStandardItem(t))) return null;
    return this.ctx.content.source.songs.find((x) => x.id === t.songId)?.answerKey.code ?? null;
  }

  /**
   * A song item submission: L5 names its phrase, L6 its stage (and, for the melody, its line). Checks open in order
   * (a phrase or stage once the one before passed or was revealed); graded exactly against the answer key with the
   * grader's song-ladder request (L5 lesson mode, L6 capstone mode).
   */
  async #submitSong(t: StoredTranscription, body: LadderSubmit): Promise<LadderSubmitResult> {
    const level = t.ladderLevel as SongLevel;
    const song = this.ctx.content.source.songs.find((x) => x.id === t.songId);
    if (song === undefined) throw conflict("this song's answer key is no longer available");
    if (level === 5 && body.phrase === undefined)
      throw badRequest("an L5 item is checked phrase by phrase: name the phrase");
    if (level === 6 && body.stage === undefined)
      throw badRequest("an L6 item is checked stage by stage: name the stage");
    if (level === 6 && body.stage === "melody" && body.phrase === undefined)
      throw badRequest("the melody is checked one line at a time: name the line");
    const check = checkOf(song, level, {
      ...(body.stage === undefined ? {} : { stage: body.stage }),
      ...(body.phrase === undefined ? {} : { phrase: body.phrase }),
    });
    if (check === null)
      throw badRequest(
        level === 5
          ? `this song has phrases 1–${songPhrases(song, 5).length}`
          : "an L6 stage is bass, changes or melody (with its line)",
      );
    const checks = songChecks(song, level);
    const cleared = this.#clearedChecks(t, song, level);
    const before = checks.slice(
      0,
      checks.findIndex((c) => checkKeyOf(c) === checkKeyOf(check)),
    );
    const blocking = before.find((c) => !cleared.has(checkKeyOf(c)));
    if (blocking !== undefined)
      throw conflict(
        level === 5
          ? `phrase ${check.phrase as number} opens once phrase ${blocking.phrase as number} passes`
          : `the ${check.stage === "melody" ? `melody line ${check.phrase as number}` : check.stage} opens once the ${
              blocking.stage === "melody" ? `melody line ${blocking.phrase as number}` : blocking.stage
            } passes`,
      );

    const lint: LintContext = {
      profile: "graded",
      unlocked: this.d.unlocks.usableIn(null) as Set<UnlockableId>,
      allowPreview: false,
      meter: song.meter,
      key: song.key,
    };
    const key = checkKeyOf(check);
    const prior = this.#repos.transcriptions.versions(t.id).filter((v) => {
      const c = checkOf(song, level, {
        ...(v.stage == null ? {} : { stage: v.stage }),
        ...(v.phrase == null ? {} : { phrase: v.phrase }),
      });
      return c !== null && checkKeyOf(c) === key;
    });
    const graded = prior.filter((v) => v.result !== null && v.result.status !== "error").length;
    const item = { ...check } as SongCheck;
    const req = songLadderRequest({
      item: item as never,
      song,
      code: body.code,
      ctx: {
        params: {},
        attemptNo: graded + 1,
        firstAttempt: graded === 0,
        rung: body.rung,
        tutorHints: 0,
        extraReplays: 0,
        lint,
      },
    });
    const raw = await this.d.grade(req);
    const result: GradeResult = {
      ...raw,
      assist: { ...raw.assist, rung: body.rung, revealed: raw.assist.revealed || body.rung >= 4 },
    };
    const isGraded = result.status !== "error";
    const passed = isGraded && songLadderPassed(item as never, result);
    let otherWork: { familyId: string; credit: number; gym: boolean } | null = null;
    const out = tx(this.#repos.db, () => {
      const version = this.d.library.saveTranscriptionVersion(t.id, {
        code: body.code,
        result,
        ranOk: isGraded,
        stage: level === 6 ? ((check.stage ?? null) as SongStage | null) : null,
        phrase: level === 5 || check.stage === "melody" ? (check.phrase as number) : null,
      });
      const fresh = this.#repos.transcriptions.get(t.id) as StoredTranscription;
      const passedNow = this.#passedChecks(fresh, song, level);
      const gradedPass = checks.every((c) => passedNow.has(checkKeyOf(c)));
      const clearedNow = this.#clearedChecks(fresh, song, level);
      const allCleared = checks.every((c) => clearedNow.has(checkKeyOf(c)));
      this.#repos.transcriptions.update({
        ...fresh,
        gradedPass: fresh.gradedPass === true || gradedPass,
        status: fresh.status === "done" || allCleared ? "done" : fresh.status,
        updatedAt: this.time.iso(),
      });
      const realismChange = this.#recordSession(t, body.sessionId, result, isGraded, passed, gradedPass);
      if (isGraded && graded === 0 && !result.assist.revealed) {
        const layer = layerOf(level, check.stage ?? null);
        const fam = layer === null ? null : familyForLayer(this.ctx.content, layer);
        if (fam !== null) {
          const skills = [...new Set(fam.skills.map((x) => skillOf(x.skill)))];
          this.d.mastery.addEvidence(
            skills.map((skillId) => ({
              skillId: skillId as never,
              category: null,
              score: Math.max(0, Math.min(1, result.score)),
              weight: evidenceWeight("gym-set"),
              sourceKind: "gym-set" as const,
              sourceId: `ladder/${t.id}.${key}`,
            })),
          );
          otherWork = { familyId: fam.id, credit: result.score, gym: t.gymId !== null };
        }
      }
      return { result, passed, gradedPass, realismChange, version };
    });
    const ow = otherWork as { familyId: string; credit: number; gym: boolean } | null;
    const srs = this.d.srs();
    if (ow !== null && srs?.otherWork !== undefined)
      await srs.otherWork({
        source: ow.gym ? "gym" : "practice",
        familyId: ow.familyId,
        meanCredit: ow.credit,
      });
    return { ...out, ladder: this.state() };
  }

  // --- Wave 6: L8, a full arrangement of a standard (wave6.md §5.4) ------------------------------

  /**
   * d7: at realism R3 and above a stimulus plays only sounds the learner has unlocked. A sound with a toolbox row the
   * learner does not hold yet (the upright, the vibes, a sung lead) is replaced by the first unlocked sound of its
   * fallbacks, in the events, the preload list and the performance hints; the notes are untouched.
   */
  #unlockedStimulus<
    T extends {
      events: unknown[];
      preload: string[];
      performance?: { target: string; swung: boolean; vocalLead: "tenor" | "choir" | null };
    },
  >(realism: number, st: T): T {
    if (realism < 3) return st;
    const have = this.d.unlocks.ids();
    const locked = (sound: string) =>
      this.ctx.content.tool(`snd.${sound}`) !== null && !have.has(`snd.${sound}`);
    const swap = new Map<string, string>();
    for (const sound of st.preload) {
      if (!locked(sound)) continue;
      const to = (SOUND_FALLBACKS[sound] ?? ["piano"]).find((f) => !locked(f));
      if (to !== undefined) swap.set(sound, to);
    }
    const lead = st.performance?.vocalLead ?? null;
    const leadLocked = lead !== null && locked(lead);
    if (swap.size === 0 && !leadLocked) return st;
    const events = st.events.map((e) => {
      const s = (e as { s?: unknown }).s;
      return typeof s === "string" && swap.has(s) ? { ...(e as object), s: swap.get(s) } : e;
    });
    const preload = [...new Set(st.preload.map((x) => swap.get(x) ?? x))];
    return {
      ...st,
      events,
      preload,
      ...(st.performance === undefined
        ? {}
        : { performance: { ...st.performance, vocalLead: leadLocked ? null : lead } }),
    };
  }

  #standardSong(songId: string | null): SongDef | undefined {
    return songId === null ? undefined : this.ctx.content.source.songs.find((x) => x.id === songId);
  }
  /** The standard CF-T was worked on (the song tag of its draft), or `null`. */
  #cftSong(): string | null {
    const row = this.#repos.capstones.get("CF-T");
    const sketch = row?.sketchId == null ? null : this.#repos.sketches.get(row.sketchId);
    return sketch?.tags.find((x) => x.startsWith("song.")) ?? null;
  }
  #standardItems(songId: string): StoredTranscription[] {
    return this.#repos.transcriptions.list().filter((t) => isStandardItem(t) && t.songId === songId);
  }
  /** The checks of an L8 item that passed (unrevealed, at their mark), and those cleared (passed or revealed). */
  #standardChecks(t: StoredTranscription, song: SongDef): { passed: Set<string>; cleared: Set<string> } {
    const passed = new Set<string>();
    const cleared = new Set<string>();
    for (const v of this.#repos.transcriptions.versions(t.id)) {
      if (v.result === null || v.result.status === "error") continue;
      const keys = versionKeys(song, v);
      const revealed = v.result.assist.revealed || v.result.assist.rung >= 4;
      const ok =
        v.stage === "form"
          ? v.result.status === "pass" && v.result.score >= STANDARD_LADDER_PASS.form - 1e-9 && !revealed
          : (v.stage === "bass" || v.stage === "changes" || v.stage === "melody") &&
            !revealed &&
            standardLadderPassed(v.stage, { ...v.result, score: v.result.score + 1e-9 });
      for (const k of keys) {
        if (ok) passed.add(k);
        if (ok || revealed) cleared.add(k);
      }
    }
    return { passed, cleared };
  }
  /** The stages of an L8 item every check of which is in `keys`, in order. */
  #stagesIn(song: SongDef, keys: ReadonlySet<string>): StandardLadderStage[] {
    const n = sectionCount(song);
    return STANDARD_STAGES.filter((st) =>
      st === "form"
        ? keys.has("form")
        : Array.from({ length: n }, (_, i) => standardKey(st, i + 1)).every((k) => keys.has(k)),
    );
  }

  /** The L8 pool as `ladder.songs` lists it: the standards, "Being checked" until a key is complete and verified. */
  #standards(): LadderSong[] {
    const repertoire = this.ctx.content.source.repertoire ?? [];
    const out: LadderSong[] = [];
    for (const id of standardIds(repertoire)) {
      const song = this.#standardSong(id);
      const meta = repertoire.find((m) => m.id === id);
      if (song === undefined && meta === undefined) continue;
      const lock = standardLock(song, this.d.allowUnverifiedSongs === true);
      const projects = song === undefined ? [] : this.#standardItems(id);
      const passed = new Set<string>();
      const cleared = new Set<string>();
      if (song !== undefined)
        for (const t of projects) {
          const c = this.#standardChecks(t, song);
          for (const k of c.passed) passed.add(k);
          for (const k of c.cleared) cleared.add(k);
        }
      const passedStages = song === undefined ? [] : this.#stagesIn(song, passed);
      const clearedStages = song === undefined ? [] : this.#stagesIn(song, cleared);
      // The sections passed of the stage now open (the page marks them on its strip).
      const open = CODE_STAGES.find((st) => !clearedStages.includes(st));
      const lines =
        song === undefined || open === undefined || !clearedStages.includes("form")
          ? []
          : Array.from({ length: sectionCount(song) }, (_, i) => i + 1).filter((n) =>
              passed.has(standardKey(open, n)),
            );
      out.push({
        songId: id,
        title: song?.title ?? meta?.title ?? id,
        year: song?.year ?? meta?.year ?? "trad",
        level: 8,
        // The form is what the first stage asks for: the sections are on the wire only once it is behind.
        phrases:
          song !== undefined && clearedStages.includes("form")
            ? (song.answerKey.phrases ?? []).map(([a, b]) => [a, b] as [number, number])
            : [],
        status: lock !== null ? "locked" : projects.some((t) => t.gradedPass === true) ? "done" : "open",
        lockedReason: lock,
        passedPhrases: lines,
        passedStages: [...passedStages],
        passedLines: lines,
      });
    }
    return out;
  }

  /** The next standard the ladder would draw at L8 (not CF-T's, not passed yet), for "what is open" lines. */
  nextStandardTitle(): string | null {
    if (this.#repos.ladder.state().level !== 8) return null;
    const cft = this.#cftSong();
    const next = this.#standards().find((x) => x.status === "open" && x.songId !== cft);
    return next?.title ?? null;
  }

  /**
   * `POST /ladder/items` at L8: a standard as a `pd-song` project (the answer key stays here), staged form → bass →
   * changes → melody. An unfinished item resumes; `songId` picks the standard, else the first open one that is not
   * the song CF-T used and has no graded pass yet.
   */
  async #nextStandard(body: LadderNext): Promise<LadderItem> {
    const all = this.#standards();
    let pick: LadderSong | undefined;
    if (body.songId !== undefined) {
      pick = all.find((x) => x.songId === body.songId);
      if (pick === undefined) throw notFound(`L8 standard ${body.songId}`);
      if (pick.status === "locked")
        throw conflict(`${pick.title} is not open yet: ${pick.lockedReason ?? "Being checked"}`);
    } else {
      const cft = this.#cftSong();
      const open = all.filter((x) => x.status !== "locked");
      pick =
        open.find((x) => this.#standardItems(x.songId).some((t) => t.status !== "done")) ??
        open.find((x) => x.status === "open" && x.songId !== cft) ??
        open.find((x) => x.status === "open") ??
        open[0];
      if (pick === undefined)
        throw conflict(
          all.length === 0 ? "no standard has an answer key yet" : "every standard is still being checked",
        );
    }
    const song = this.#standardSong(pick.songId) as SongDef;
    const s = this.#repos.ladder.state();
    let realism: number = s.level === 8 ? s.realism : 0;
    let gymId: string | null = null;
    if (body.gymId !== null) {
      const gym = this.#repos.gym.list().find((g) => g.gymId === body.gymId);
      if (gym === undefined) throw notFound(`gym session ${body.gymId}`);
      gymId = gym.gymId;
      if (gym.kind === "ladder" && gym.realism !== null && (gym.ladderLevel ?? 8) === 8)
        realism = gym.realism;
    }
    const bars = song.answerKey.bars;
    const resume = this.#standardItems(song.id).find((t) => t.status !== "done");
    let id: string;
    if (resume !== undefined) {
      id = resume.id;
      if (gymId !== null)
        tx(this.#repos.db, () => {
          this.#repos.transcriptions.update({ ...resume, gymId: gymId as StoredTranscription["gymId"] });
          this.#repos.gym.setTranscription(gymId as string, id);
        });
    } else {
      const seed = body.seed ?? Math.floor(Math.random() * 2 ** 31);
      id = newId("tr");
      const at = this.time.iso();
      const cycles = bars + (song.pickup === undefined ? 0 : 1);
      let stimulus: NonNullable<StoredTranscription["ladder"]>["stimulus"] = null;
      if (this.d.stimulus !== undefined) {
        try {
          const ev = await this.d.stimulus(song.answerKey.code, cycles, song.meter);
          if (ev !== null)
            stimulus = this.#unlockedStimulus(realism, {
              ...ev,
              performance: {
                target: "bass",
                swung: song.swing !== undefined,
                vocalLead: realism >= 4 ? (seed % 2 === 0 ? "tenor" : "choir") : null,
              },
            });
        } catch {
          stimulus = null;
        }
      }
      const t: StoredTranscription = {
        id,
        sourceKind: "pd-song",
        player: "pattern",
        audioId: null,
        songId: song.id,
        title: song.title,
        artist: null,
        key: song.key,
        bpm: song.bpm,
        meter: song.meter,
        downbeatS: null,
        fineTuneCents: 0,
        ladderLevel: 8,
        realism,
        regions: [],
        checklist: {},
        selfScore: null,
        currentVersion: 0,
        status: "in_progress",
        review: null,
        createdAt: at,
        updatedAt: at,
        hiddenCode: song.answerKey.code,
        gradedPass: false,
        gymId: gymId as StoredTranscription["gymId"],
        ladder: {
          seed,
          given: {
            bpm: song.bpm,
            meter: song.meter as NonNullable<StoredTranscription["meter"]>,
            key: song.key,
            pickup: (song.pickup as { units: [number, number] } | undefined) ?? null,
            bars,
          },
          cycles,
          stages: ["form", "bass", "changes", "melody"],
          swing: (song.swing as { subdivision: number; amount: number } | undefined) ?? null,
          title: song.title,
          stimulus,
          song: {
            songId: song.id,
            level: 8,
            phrases: (song.answerKey.phrases ?? []).map(([a, b]) => [a, b]),
          },
        },
      };
      tx(this.#repos.db, () => {
        this.#repos.transcriptions.insert(t);
        if (gymId !== null) this.#repos.gym.setTranscription(gymId, id);
      });
    }
    const stored = this.#repos.transcriptions.get(id) as StoredTranscription;
    const project: TranscriptionDetail = await this.d.library.transcription(id);
    const formBehind = this.#standardChecks(stored, song).cleared.has("form");
    return {
      itemId: id,
      level: 8,
      realism: stored.realism ?? realism,
      seed: stored.ladder?.seed ?? 0,
      stages: ["form", "bass", "changes", "melody"],
      given: {
        bpm: song.bpm,
        meter: song.meter,
        key: song.key,
        pickup: song.pickup ?? null,
        bars,
        // Wave 6: a tune that changes key gives its key plan (its ribbon is a given, like the key).
        ...(song.keyPlan === undefined ? {} : { keyPlan: song.keyPlan.map((k) => ({ ...k })) }),
      },
      project,
      song: { songId: song.id, title: song.title, year: song.year },
      phrases: formBehind ? (song.answerKey.phrases ?? []).map(([a, b]) => [a, b] as [number, number]) : [],
    };
  }

  /**
   * An L8 submission. `stage: "form"` carries the form map and is graded here with `gradeFormMap` (no code runs);
   * the code stages are graded on the learner host with `standardLadderRequest`, one section at a time (`phrase`,
   * 1-based) or the whole tune without it. A stage opens once every check of the stage before passed or was revealed.
   */
  async #submitStandard(t: StoredTranscription, body: LadderSubmit): Promise<LadderSubmitResult> {
    const song = this.#standardSong(t.songId);
    if (song === undefined || standardGaps(song).length > 0)
      throw conflict("this standard's answer key is no longer available");
    const stage = body.stage;
    if (stage === undefined) throw badRequest("an L8 item is checked stage by stage: name the stage");
    if (stage === "quality" || stage === "rn")
      throw badRequest("an L8 stage is form, bass, changes or melody");
    const n = sectionCount(song);
    if (stage === "form") {
      if (body.formMap === undefined) throw badRequest("the form stage needs the form map");
      if (body.formMap.sections.length !== body.formMap.bars.length)
        throw badRequest("the form map needs one starting bar for each section");
      if (body.phrase !== undefined) throw badRequest("the form map is one answer for the whole tune");
    } else {
      if (body.formMap !== undefined) throw badRequest("a form map belongs to the form stage");
      if (body.phrase !== undefined && body.phrase > n) throw badRequest(`this standard has sections 1–${n}`);
    }
    const before = this.#standardChecks(t, song);
    const clearedStages = this.#stagesIn(song, before.cleared);
    const blocking = STANDARD_STAGES.slice(0, STANDARD_STAGES.indexOf(stage)).find(
      (st) => !clearedStages.includes(st),
    );
    if (blocking !== undefined)
      throw conflict(
        `the ${stage} stage opens once the ${blocking === "form" ? "form map" : blocking} passes`,
      );

    const key = standardKey(stage, stage === "form" ? null : (body.phrase ?? null));
    const prior = this.#repos.transcriptions
      .versions(t.id)
      .filter((v) => v.stage === stage && (stage === "form" || (v.phrase ?? null) === (body.phrase ?? null)));
    const graded = prior.filter((v) => v.result !== null && v.result.status !== "error").length;
    const slug = song.id.replace(/^song\./, "");
    let result: GradeResult;
    if (stage === "form") {
      result = formMapResult(song, body.formMap as NonNullable<LadderSubmit["formMap"]>, {
        exerciseId: `ladder/lad.8.${slug}.form`,
        attemptNo: graded + 1,
        rung: body.rung,
      });
    } else {
      const lint: LintContext = {
        profile: "graded",
        unlocked: this.d.unlocks.usableIn(null) as Set<UnlockableId>,
        allowPreview: false,
        meter: song.meter,
        key: song.key,
      };
      const raw = await this.d.grade(
        standardLadderRequest({
          item: {
            itemId: `lad.8.${slug}`,
            level: 8,
            stage,
            ...(body.phrase === undefined ? {} : { phrase: body.phrase }),
          },
          song,
          code: body.code,
          ctx: {
            params: {},
            attemptNo: graded + 1,
            firstAttempt: graded === 0,
            rung: body.rung,
            tutorHints: 0,
            extraReplays: 0,
            lint,
          },
        }),
      );
      result = {
        ...raw,
        assist: { ...raw.assist, rung: body.rung, revealed: raw.assist.revealed || body.rung >= 4 },
      };
    }
    const isGraded = result.status !== "error";
    const revealed = result.assist.revealed || result.assist.rung >= 4;
    const passed =
      isGraded &&
      !revealed &&
      (stage === "form"
        ? result.status === "pass"
        : standardLadderPassed(stage as StandardCodeStage, { ...result, score: result.score + 1e-9 }));
    let otherWork: { familyId: string; credit: number; gym: boolean } | null = null;
    const out = tx(this.#repos.db, () => {
      const version = this.d.library.saveTranscriptionVersion(t.id, {
        code: body.code,
        result,
        ranOk: isGraded,
        stage,
        phrase: stage === "form" ? null : (body.phrase ?? null),
      });
      const fresh = this.#repos.transcriptions.get(t.id) as StoredTranscription;
      const now = this.#standardChecks(fresh, song);
      const keys = standardKeys(song);
      const gradedPass = keys.every((k) => now.passed.has(k));
      const allCleared = keys.every((k) => now.cleared.has(k));
      this.#repos.transcriptions.update({
        ...fresh,
        gradedPass: fresh.gradedPass === true || gradedPass,
        status: fresh.status === "done" || allCleared ? "done" : fresh.status,
        updatedAt: this.time.iso(),
      });
      const realismChange = this.#recordSession(t, body.sessionId, result, isGraded, passed, gradedPass);
      // Evidence: the first graded, unrevealed answer of a check, for the skills of its layer (the form map: none of
      // the three layers; its evidence is the capstone's and the lessons' own).
      if (isGraded && graded === 0 && !revealed && stage !== "form") {
        const fam = familyForLayer(this.ctx.content, stage === "changes" ? "chords" : stage);
        if (fam !== null) {
          const skills = [...new Set(fam.skills.map((x) => skillOf(x.skill)))];
          this.d.mastery.addEvidence(
            skills.map((skillId) => ({
              skillId: skillId as never,
              category: null,
              score: Math.max(0, Math.min(1, result.score)),
              weight: evidenceWeight("gym-set"),
              sourceKind: "gym-set" as const,
              sourceId: `ladder/${t.id}.${key}`,
            })),
          );
          otherWork = { familyId: fam.id, credit: result.score, gym: t.gymId !== null };
        }
      }
      return { result, passed, gradedPass, realismChange, version };
    });
    const ow = otherWork as { familyId: string; credit: number; gym: boolean } | null;
    const srs = this.d.srs();
    if (ow !== null && srs?.otherWork !== undefined)
      await srs.otherWork({
        source: ow.gym ? "gym" : "practice",
        familyId: ow.familyId,
        meanCredit: ow.credit,
      });
    return { ...out, ladder: this.state() };
  }

  /**
   * The ladder session's best score (an Oak session, else the learner day) and the realism rule (contracts §6.12),
   * for items at the learner's own level. Returns the realism change to announce, or `null`.
   */
  #recordSession(
    t: StoredTranscription,
    sessionId: string | null,
    result: GradeResult,
    isGraded: boolean,
    passed: boolean,
    gradedPass: boolean,
  ): LadderSubmitResult["realismChange"] {
    const s = this.#repos.ladder.state();
    const day = this.time.day();
    const key = sessionId !== null && this.#repos.sessions.get(sessionId) !== null ? sessionId : `day:${day}`;
    const prev = this.#repos.ladder.session(key);
    const now = this.time.iso();
    const row: LadderSessionRow = {
      sessionKey: key,
      level: t.ladderLevel ?? s.level,
      startRealism: prev?.startRealism ?? s.realism,
      bestScore: isGraded ? Math.max(prev?.bestScore ?? 0, result.score) : (prev?.bestScore ?? 0),
      passed: (prev?.passed ?? false) || passed,
      gradedPass: (prev?.gradedPass ?? false) || gradedPass,
      day: prev?.day ?? day,
      gymId: t.gymId ?? prev?.gymId ?? null,
      firstAt: prev?.firstAt ?? now,
      at: now,
    };
    this.#repos.ladder.saveSession(row);
    if (!isGraded || row.level !== s.level) return null;
    const history = this.#repos.ladder
      .sessions()
      .filter((r) => r.sessionKey !== key)
      .concat([row])
      .map((r) => ({
        level: r.level as 1 | 2 | 3 | 4,
        realism: r.startRealism as RealismLevel,
        score: r.bestScore,
      }));
    const to = nextRealism(history, row.startRealism as RealismLevel);
    if (to !== s.realism) this.#repos.ladder.saveState(s.level, to, now);
    return to !== row.startRealism ? { from: row.startRealism, to } : null;
  }
}
