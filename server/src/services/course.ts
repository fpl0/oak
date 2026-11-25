// The course: lesson steps (state, hints, series, attempts), lesson completion, checkpoints, capstones
// and gym sessions. Each write is one transaction: attempt, evidence, unlocks, can-dos and the skill
// cache commit together (architecture §4). The SRS side goes through `SrsPort`.
import type {
  CanDoEntry,
  CapstoneState,
  CheckpointAttemptStart,
  CheckpointItemSpec,
  CheckpointOutcome,
  CheckpointSubmit,
  Evidence,
  ExerciseResult,
  LessonCompleteResult,
  LessonProgress,
  LessonSteps,
  SrsReviewResult,
  StepAttemptCreate,
  StepAttemptResult,
  StepState,
  TermIntroduced,
  TrackGateState,
  Unlock,
} from "@oak/api";
import {
  adjustScore,
  type CapstoneDef,
  type Exercise,
  type GradeResult,
  HINTLESS_KINDS,
  type HintRung,
  type LessonDef,
  type RubricRule,
  type SkillWeight,
  type StepDef,
  skillOf,
} from "@oak/content-kit";
import { tx } from "../db/index.ts";
import type { StepStateRow } from "../db/repos/lessons.ts";
import { conflict, notFound } from "../errors.ts";
import type { CanDoService } from "./cando.ts";
import type { CapstoneSessionsService } from "./capstone-sessions.ts";
import { recordCapstoneCheck } from "./check-history.ts";
import { LearnerTime, type ServiceContext } from "./context.ts";
import { openFamilyLevels } from "./family-levels.ts";
import { GatesService } from "./gates.ts";
import { evidenceWeight, type MasteryService } from "./mastery.ts";
import type { SrsPort } from "./ports.ts";
import { countAttempt, type PriorAttempt } from "./retry.ts";
import type { StreakService } from "./streak.ts";
import type { TracksService } from "./tracks.ts";
import type { UnlocksService } from "./unlocks.ts";
import type { VoiceService } from "./voice.ts";

const TAP_SING = new Set<Exercise["kind"]>(["sing", "tap"]);
const NO_EVIDENCE_KINDS = new Set<Exercise["kind"]>(["listen", "run-investigate"]);

export interface CourseDeps {
  gates: GatesService;
  unlocks: UnlocksService;
  mastery: MasteryService;
  cando: CanDoService;
  streak: StreakService;
  voice: VoiceService;
  srs: () => SrsPort | null;
  /** Wave 4: capstone sessions remember when each was completed. */
  capstoneSessions?: CapstoneSessionsService;
  /** Wave 6: the advanced-track gates a completion or a checkpoint pass meets are recorded with it. */
  tracks?: TracksService;
}

type EvidenceInput = Omit<Evidence, "at" | "day">;

/** Evidence for each weighted skill of an exercise: `E05/deg.6` is evidence on E05 with category `E05/deg.6`. */
function skillEvidence(
  skills: readonly SkillWeight[],
  score: number,
  base: number,
  sourceKind: Evidence["sourceKind"],
  sourceId: string,
): EvidenceInput[] {
  return skills.map((s) => ({
    skillId: skillOf(s.skill) as Evidence["skillId"],
    category: s.skill.includes("/") ? s.skill : null,
    score,
    weight: base * s.w,
    sourceKind,
    sourceId,
  }));
}

export class CourseService {
  readonly time: LearnerTime;
  constructor(
    private readonly ctx: ServiceContext,
    private readonly d: CourseDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }

  get #repos() {
    return this.ctx.repos;
  }
  get #content() {
    return this.ctx.content;
  }

  // --- lookups ----------------------------------------------------------------------------------

  lesson(lessonId: string): LessonDef {
    const def = this.#content.lessonDef(lessonId);
    if (def === null) throw notFound(`lesson ${lessonId}`);
    return def;
  }
  step(lessonId: string, stepId: string): StepDef {
    const step = this.lesson(lessonId).steps.find((s) => s.id === stepId);
    if (step === undefined) throw notFound(`step ${lessonId}/${stepId}`);
    return step;
  }
  #stepRow(lessonId: string, stepId: string): StepStateRow {
    return (
      this.#repos.lessons.stepState(lessonId, stepId) ?? {
        lessonId,
        stepId,
        seriesNo: 0,
        rung: 0,
        tutorHints: 0,
        attempts: 0,
        passed: false,
        updatedAt: this.time.iso(),
      }
    );
  }

  // --- step state, hints, series ----------------------------------------------------------------

  stepState(lessonId: string, stepId: string): StepState {
    const step = this.step(lessonId, stepId);
    const row = this.#stepRow(lessonId, stepId);
    const ex = step.exercise;
    const needed = ex !== undefined && TAP_SING.has(ex.kind) ? 3 : 2;
    const result: ExerciseResult | null =
      ex === undefined ? null : this.#repos.lessons.latestExerciseResult(lessonId, ex.id);
    return {
      lessonId,
      stepId,
      rung: row.rung,
      passed: row.passed,
      attempts: row.attempts,
      seriesNo: row.seriesNo,
      revealAvailable: row.attempts >= needed && ex !== undefined && ex.hints !== null,
      result,
      practiceNext: ex !== undefined && this.#countNext(lessonId, stepId, ex, row).count === "practice",
    };
  }

  /** Earlier attempts of a step, any series, as the retry policy reads them. */
  #prior(lessonId: string, stepId: string): PriorAttempt[] {
    return this.#repos.lessons.attemptsOfStep(lessonId, stepId).map((a) => ({
      graded: a.result !== null && a.result.status !== "error",
      practice: a.practice === true,
      disputed: a.disputed,
    }));
  }

  /** What the next graded attempt on a step counts for (docs/design/retry.md §3.1). */
  #countNext(lessonId: string, stepId: string, ex: Exercise, row: StepStateRow) {
    const lessonCompleted = this.#repos.lessons.progress(lessonId)?.status === "completed";
    // Only a predict looks at the history; every other kind is decided by `passed` and the lesson's status.
    const prior =
      ex.kind === "predict" && !lessonCompleted && !row.passed ? this.#prior(lessonId, stepId) : [];
    return countAttempt({ kind: ex.kind, stepPassed: row.passed, lessonCompleted, prior });
  }

  /**
   * Pressing Hint: the rung rises by one, to 3 at most; `reveal: true` is the only way to rung 4 and
   * needs `revealAvailable`. A tutor hint is the same operation with `fromTutor` (counts a tutor hint).
   */
  hint(
    lessonId: string,
    stepId: string,
    opts: { reveal: boolean; max?: HintRung; fromTutor?: boolean },
  ): StepState {
    const step = this.step(lessonId, stepId);
    const ex = step.exercise;
    if (ex === undefined || ex.hints === null || (HINTLESS_KINDS as readonly string[]).includes(ex.kind))
      throw conflict("this step has no hints");
    if (this.d.gates.lessonStatus(lessonId) === "locked")
      throw conflict(`lesson ${lessonId} is not open yet`);
    return tx(this.#repos.db, () => {
      const row = this.#stepRow(lessonId, stepId);
      let rung = row.rung;
      if (opts.reveal) {
        if (!this.stepState(lessonId, stepId).revealAvailable) throw conflict("reveal is not available yet");
        rung = 4;
      } else {
        rung = Math.min(rung + 1, Math.min(opts.max ?? 3, 3)) as HintRung;
        if (rung < row.rung) rung = row.rung;
      }
      this.#repos.lessons.saveStepState({
        ...row,
        rung: rung as HintRung,
        tutorHints: row.tutorHints + (opts.fromTutor === true && rung > row.rung ? 1 : 0),
        updatedAt: this.time.iso(),
      });
      return this.stepState(lessonId, stepId);
    });
  }

  /** "Try a new one": a new series with fresh params; attempts and rung start again. */
  newSeries(lessonId: string, stepId: string): StepState {
    this.step(lessonId, stepId);
    return tx(this.#repos.db, () => {
      const row = this.#stepRow(lessonId, stepId);
      this.#repos.lessons.saveStepState({
        ...row,
        seriesNo: row.seriesNo + 1,
        attempts: 0,
        rung: 0,
        updatedAt: this.time.iso(),
      });
      return this.stepState(lessonId, stepId);
    });
  }

  #touchLesson(lessonId: string, stepId: string | null): void {
    const status = this.d.gates.lessonStatus(lessonId);
    if (status === "locked") throw conflict(`lesson ${lessonId} is not open yet`);
    const stored = this.#repos.lessons.progress(lessonId);
    const now = this.time.iso();
    if (stored === null || stored.status !== "completed") {
      this.#repos.lessons.saveProgress({
        ...(stored ?? this.d.gates.lessonProgress(lessonId)),
        status: "in_progress",
        currentStep: stepId ?? stored?.currentStep ?? null,
        startedAt: stored?.startedAt ?? now,
        updatedAt: now,
      });
    } else if (stepId !== null) {
      this.#repos.lessons.saveProgress({ ...stored, currentStep: stepId, updatedAt: now });
    }
  }

  // --- the step rail and the learner's position (wave2 §4: lessons.steps, lessons.position) ------

  /** A step the learner must pass to finish the lesson: one with a graded exercise. Others pass once visited. */
  static needsPass(step: StepDef): boolean {
    return step.exercise !== undefined && step.graded === true;
  }

  /** Every authored step's state, in lesson order, and the stored progress (`null` before the first visit). */
  lessonSteps(lessonId: string): LessonSteps {
    const def = this.lesson(lessonId);
    const stored = this.#repos.lessons.progress(lessonId);
    return {
      lessonId: def.id,
      progress: stored === null ? null : { ...stored, status: this.d.gates.lessonStatus(lessonId) },
      steps: def.steps.map((st) => this.stepState(lessonId, st.id)),
    };
  }

  /**
   * Where the learner is (contracts §9.3, §9.4). Steps before `stepId` that need no pass are recorded as
   * visited (passed); `stepId` itself is not. With `wrapped` ("Wrap up" before the Make) the lesson stays in
   * progress and resumes at the first unfinished step; otherwise it resumes at `stepId`. A completed lesson only moves its replay
   * position. `splitPart` records the half being played (15-minute split, §9.4).
   */
  position(
    lessonId: string,
    body: { sessionId: string | null; stepId: string; splitPart: "A" | "B" | null; wrapped: boolean },
  ): LessonProgress {
    const def = this.lesson(lessonId);
    const index = def.steps.findIndex((st) => st.id === body.stepId);
    if (index < 0) throw notFound(`step ${lessonId}/${body.stepId}`);
    return tx(this.#repos.db, () => {
      this.#touchLesson(lessonId, body.stepId);
      const at = this.time.iso();
      // Only the steps BEFORE `stepId` count as visited: with `wrapped`, `stepId` is where the learner resumes,
      // so an ungraded step on screen at "Wrap up" is done next time, not skipped.
      for (const st of def.steps.slice(0, index)) {
        if (CourseService.needsPass(st)) continue;
        const row = this.#stepRow(lessonId, st.id);
        if (!row.passed) this.#repos.lessons.saveStepState({ ...row, passed: true, updatedAt: at });
      }
      const stored = this.#repos.lessons.progress(lessonId) as LessonProgress;
      if (stored.status === "completed") return { ...stored, status: this.d.gates.lessonStatus(lessonId) };
      let current = body.stepId;
      if (body.wrapped) {
        const open = def.steps.find((st) => !this.#stepRow(lessonId, st.id).passed);
        current = open?.id ?? (def.steps.at(-1)?.id as string);
      }
      const saved = this.#repos.lessons.saveProgress({
        ...stored,
        status: "in_progress",
        currentStep: current,
        splitPart: body.splitPart ?? stored.splitPart,
        updatedAt: at,
      });
      return { ...saved, status: this.d.gates.lessonStatus(lessonId) };
    });
  }

  // --- attempts ---------------------------------------------------------------------------------

  async attempt(lessonId: string, stepId: string, body: StepAttemptCreate): Promise<StepAttemptResult> {
    const def = this.lesson(lessonId);
    const step = this.step(lessonId, stepId);
    const globalId = `${lessonId}/${body.exerciseId}`;
    const site = this.#content.exercise(globalId);
    if (site === null || site.owner !== lessonId || site.stepId !== stepId)
      throw notFound(`exercise ${globalId} in ${stepId}`);
    const ex = site.exercise;
    const result: GradeResult = body.result;
    const graded = result.status !== "error";

    const committed = tx(this.#repos.db, () => {
      this.#touchLesson(lessonId, stepId);
      const row = this.#stepRow(lessonId, stepId);
      // The rung is the server's (contracts §10.4); the client's copy is ignored.
      const rung = row.rung;
      // The retry policy (docs/design/retry.md §3.1): "first" is first in the step, not in the series ("Try a
      // new one" never earns a second first attempt), and every attempt after the step counted is practice.
      const counted = countAttempt({
        kind: ex.kind,
        stepPassed: row.passed,
        lessonCompleted: this.#repos.lessons.progress(lessonId)?.status === "completed",
        prior: this.#prior(lessonId, stepId),
      });
      const practice = graded && counted.count === "practice";
      const attemptNo = graded ? row.attempts + 1 : Math.max(1, row.attempts);
      const firstAttempt = graded && (counted.count === "first" || counted.count === "predict");
      const adjusted = adjustScore(result.score, rung, body.extraReplays);
      const passed = result.status === "pass";
      const at = this.time.iso();
      const code = "code" in body.response ? body.response.code : null;
      const attempt = this.#repos.lessons.insertAttempt({
        sessionId:
          body.sessionId !== null && this.#repos.sessions.get(body.sessionId) !== null
            ? body.sessionId
            : null,
        lessonId,
        stepId,
        exerciseId: body.exerciseId,
        exerciseVersion: body.exerciseVersion,
        seriesNo: body.seriesNo,
        attemptNo,
        params: body.params,
        code,
        response: body.response,
        result: {
          ...result,
          attemptNo,
          firstAttempt,
          adjustedScore: adjusted,
          assist: { ...result.assist, rung },
        },
        passed,
        score: result.score,
        adjusted,
        feedbackCodes: [...new Set(result.diagnostics.map((dg) => dg.id as string))],
        hintRung: rung,
        assisted: rung > 0 || body.tutorAssisted,
        modality: result.modality ?? "normal",
        disputed: false,
        tutorAssisted: body.tutorAssisted,
        practice,
        at,
      });

      // Every graded attempt is one more in the series (one learner action, one count: wave3.md §5.2), practice
      // included; a practice attempt changes nothing else that counts (docs/design/retry.md §4): not `passed`,
      // not the exercise's results, not the lesson's best score.
      if (graded)
        this.#repos.lessons.saveStepState({
          ...row,
          attempts: row.attempts + 1,
          passed: practice ? row.passed : row.passed || passed,
          updatedAt: at,
        });
      if (graded && !practice) {
        const prev = this.#repos.lessons.exerciseResult(lessonId, body.exerciseId, body.exerciseVersion);
        this.#repos.lessons.saveExerciseResult({
          exerciseId: body.exerciseId,
          exerciseVersion: body.exerciseVersion,
          lessonId,
          firstPassAt: prev?.firstPassAt ?? (passed ? at : null),
          attemptsToPass: prev?.attemptsToPass ?? (passed ? attemptNo : null),
          bestScore: Math.max(prev?.bestScore ?? 0, adjusted),
          lastScore: adjusted,
          assisted: (prev?.assisted ?? false) || rung > 0 || body.tutorAssisted,
          lastAt: at,
        });
        const progress = this.#repos.lessons.progress(lessonId);
        if (progress !== null)
          this.#repos.lessons.saveProgress({
            ...progress,
            bestScore: Math.max(progress.bestScore ?? 0, adjusted),
            updatedAt: at,
          });
      }

      // Evidence (contracts §7.5): first attempt 1.0, a retry after a fail 0.3, predict 0.5, Make rubric
      // rules 1.5 each. Tutor-typed code and errors give none; a disputed attempt never gets here.
      const evidence: EvidenceInput[] = [];
      const sourceId = `${globalId}#${attempt.id}`;
      if (
        graded &&
        !practice &&
        !body.tutorAssisted &&
        result.status !== "ungraded" &&
        !NO_EVIDENCE_KINDS.has(ex.kind)
      ) {
        if (ex.kind === "code-make" || ex.kind === "compose-brief") {
          evidence.push(...this.#rubricEvidence(ex, result, sourceId));
        } else {
          const source: Evidence["sourceKind"] =
            ex.kind === "predict" ? "predict" : firstAttempt ? "step" : "retry";
          evidence.push(...skillEvidence(ex.skills, adjusted, evidenceWeight(source), source, sourceId));
        }
      }
      const added = this.d.mastery.addEvidence(evidence);
      // Graded sung notes feed the tolerance ladder (contracts §8.2); they never gate anything. A practice take
      // does not: the ladder reads the takes that count, not the best of many (docs/design/retry.md §3.4).
      if (!practice)
        this.d.voice.recordStep({
          attemptId: attempt.id,
          exercise: ex,
          sung: "sung" in body.response ? body.response.sung : null,
          modality: result.modality,
          status: result.status,
          tutorAssisted: body.tutorAssisted,
        });

      // Test-out (contracts §9.5): a first-attempt pass marks the scaffold steps it skips as done.
      const testedOut: string[] = [];
      if (passed && step.testOut !== undefined && counted.count === "first") {
        for (const skipped of step.testOut.skips) {
          const s = this.#stepRow(lessonId, skipped);
          if (!s.passed) this.#repos.lessons.saveStepState({ ...s, passed: true, updatedAt: at });
          testedOut.push(skipped);
        }
      }

      // The voicing gate (contracts §3.1 rule 6).
      const unlocked = passed ? this.d.unlocks.onGateAttempt(globalId, lessonId) : [];
      const canDo = this.d.cando.evaluate({
        skills: added.map((e) => e.skillId),
        evidence: { kind: "lesson", id: lessonId },
      });
      return { attempt, evidence: added, testedOut, unlocked, canDo, firstAttempt, adjusted, rung, practice };
    });

    let reviews: SrsReviewResult[] = [];
    const srs = this.d.srs();
    if (srs !== null && graded && !committed.practice && !body.tutorAssisted)
      reviews = await srs.afterStep({
        lessonId,
        stepId,
        exerciseId: globalId,
        firstAttempt: committed.firstAttempt,
        adjustedScore: committed.adjusted,
        hintRung: committed.rung,
        revealed: committed.rung >= 4,
        extraReplays: body.extraReplays,
        disputed: false,
      });
    void def;
    return {
      attempt: committed.attempt,
      state: this.stepState(lessonId, stepId),
      evidence: committed.evidence,
      reviews,
      testedOut: committed.testedOut,
      unlocked: committed.unlocked,
    };
  }

  #rubricEvidence(ex: Exercise, result: GradeResult, sourceId: string): EvidenceInput[] {
    const rules: readonly RubricRule[] =
      "rubric" in ex && Array.isArray(ex.rubric) ? (ex.rubric as RubricRule[]) : [];
    const out: EvidenceInput[] = [];
    for (const r of result.rubric ?? []) {
      const rule = rules.find((x) => x.id === r.ruleId);
      const skills = rule?.skills ?? ex.skills.map((s) => s.skill);
      for (const skill of skills)
        out.push({
          skillId: skillOf(skill) as Evidence["skillId"],
          category: skill.includes("/") ? skill : null,
          score: r.ok ? 1 : 0,
          weight: evidenceWeight("rubric-rule"),
          sourceKind: "rubric-rule",
          sourceId,
        });
    }
    return out;
  }

  // --- lesson completion ------------------------------------------------------------------------

  /** Map items that can be started now: lessons, checkpoints, capstones and capstone sessions. */
  #openItems(): Set<string> {
    const out = new Set<string>();
    for (const s of this.#content.allLessons()) if (this.d.gates.lessonOpen(s.meta.id)) out.add(s.meta.id);
    for (const c of this.#content.checkpoints()) if (this.d.gates.checkpointOpen(c.id)) out.add(c.id);
    for (const c of this.#content.capstones())
      if (this.d.gates.capstoneStatus(c.id).status !== "locked") out.add(c.id);
    return out;
  }

  async complete(
    lessonId: string,
    body: {
      sessionId: string | null;
      sketchId: string;
      lessonVersion: number;
      contentHash: string;
      splitPart: "A" | "B" | null;
    },
    opts: { allowUnauthored?: boolean; sketchOptional?: boolean } = {},
  ): Promise<LessonCompleteResult> {
    // `allowUnauthored`: onboarding (U00.L01 is the app's own flow) and the dev seeder complete a syllabus
    // lesson that has no lesson file; the HTTP route never does.
    const def: Pick<LessonDef, "id" | "wrapAt" | "introduces" | "practises"> =
      opts.allowUnauthored === true && this.#content.lessonDef(lessonId) === null
        ? this.#unauthored(lessonId)
        : this.lesson(lessonId);
    // `sketchOptional`: onboarding finished without Sketch 001 (the learner skipped saving it).
    if (
      !(opts.sketchOptional === true && body.sketchId === "") &&
      this.#repos.sketches.get(body.sketchId) === null
    )
      throw notFound(`sketch ${body.sketchId}`);
    const blocked = this.d.unlocks.blockedAt(lessonId);
    if (blocked.length > 0 && body.splitPart !== "A")
      throw conflict("the gate check of this lesson has to pass at 0.9 or better before it can be completed");

    const done = tx(this.#repos.db, () => {
      this.#touchLesson(lessonId, null);
      const stored = this.#repos.lessons.progress(lessonId) as LessonProgress;
      const now = this.time.iso();
      if (body.splitPart === "A") {
        const progress = this.#repos.lessons.saveProgress({
          ...stored,
          splitPart: "A",
          currentStep: def.wrapAt,
          updatedAt: now,
        });
        return {
          progress,
          unlocks: [] as Unlock[],
          canDo: [] as CanDoEntry[],
          terms: [] as TermIntroduced[],
          opened: [] as string[],
          first: false,
          gatesOpened: [] as TrackGateState[],
        };
      }
      const before = this.#openItems();
      const first = stored.status !== "completed";
      const progress = this.#repos.lessons.saveProgress({
        ...stored,
        status: "completed",
        splitPart: null,
        completedAt: stored.completedAt ?? now,
        completedVersion: first ? body.lessonVersion : stored.completedVersion,
        contentHash: first ? body.contentHash : stored.contentHash,
        updatedAt: now,
      });
      const unlocks = this.d.unlocks.onComplete(lessonId);
      if (first) this.d.voice.onLessonComplete(lessonId);
      const terms: TermIntroduced[] = [];
      for (const t of this.#content.termsOfLesson(lessonId)) {
        const row = this.#repos.terms.introduce({ termId: t.id, lessonId: def.id, at: now });
        if (row !== null) terms.push(row);
      }
      for (const s of new Set([...def.introduces, ...def.practises])) this.d.mastery.recompute(s);
      const canDo = this.d.cando.evaluate({ sourceId: lessonId, evidence: { kind: "lesson", id: lessonId } });
      const after = this.#openItems();
      const opened = [...after].filter((x) => !before.has(x));
      // Wave 6 (wave6.md §5.3): a gate this completion meets is recorded now and reported once, here.
      const gatesOpened = first ? (this.d.tracks?.recordGates(lessonId) ?? []) : [];
      return { progress, unlocks, canDo, terms, opened, first, gatesOpened };
    });

    const srs = this.d.srs();
    const seeded = srs !== null && done.first ? await srs.seedLesson(lessonId) : [];
    return {
      progress: { ...done.progress, status: this.d.gates.lessonStatus(lessonId) },
      unlocks: done.unlocks,
      canDo: done.canDo,
      terms: done.terms,
      seeded,
      // `opened` lists session IDs: a capstone this completion opens (CF-T at U15.L01, Wave 6) is named by its first
      // session, as the map and Today name it.
      opened: done.opened.map((x) =>
        this.#content.capstoneMeta(x) !== null ? (this.#content.capstoneSessionIds(x)[0] ?? `${x}.S1`) : x,
      ) as LessonCompleteResult["opened"],
      streak: this.d.streak.summary(),
      ...(done.gatesOpened.length > 0 ? { gatesOpened: done.gatesOpened } : {}),
    };
  }

  /** The syllabus row of a lesson without a lesson file, shaped like the parts of a `LessonDef` completion reads. */
  #unauthored(lessonId: string): Pick<LessonDef, "id" | "wrapAt" | "introduces" | "practises"> {
    const site = this.#content.lessonSite(lessonId);
    if (site === null) throw notFound(`lesson ${lessonId}`);
    return {
      id: site.meta.id,
      wrapAt: "S1" as LessonDef["wrapAt"],
      introduces: [...site.meta.introduces],
      practises: [...(site.meta.practises ?? [])],
    };
  }

  // --- checkpoints ------------------------------------------------------------------------------

  checkpointStart(cpId: string): CheckpointAttemptStart {
    if (this.#content.checkpointMeta(cpId) === null) throw notFound(`checkpoint ${cpId}`);
    const status = this.d.gates.checkpointStatus(cpId);
    if (status.status === "locked")
      throw conflict("this checkpoint opens when the lessons it covers are completed");
    if (status.status === "passed" || status.status === "soft-passed")
      throw conflict("this checkpoint is already passed");
    return tx(this.#repos.db, () => {
      const attempts = this.#repos.checkpoints.attempts(cpId);
      const pending = attempts.find((a) => a.finishedAt === null);
      if (pending !== undefined && !this.d.gates.attemptStale(pending.startedAt))
        return {
          cpId: cpId as CheckpointAttemptStart["cpId"],
          attemptNo: pending.attemptNo,
          startedAt: pending.startedAt,
          items: pending.items,
        };
      const attemptNo = pending?.attemptNo ?? attempts.length + 1;
      const now = this.time.iso();
      const items = this.d.gates.composeCheckpoint(cpId, attemptNo, {
        quiet: this.d.voice.quiet(),
        salt: now,
      });
      const row = this.#repos.checkpoints.start(cpId, attemptNo, now, items);
      return {
        cpId: cpId as CheckpointAttemptStart["cpId"],
        attemptNo,
        startedAt: row.startedAt,
        items: row.items,
      };
    });
  }

  checkpointSubmit(cpId: string, body: CheckpointSubmit): CheckpointOutcome {
    const meta = this.#content.checkpointMeta(cpId);
    if (meta === null) throw notFound(`checkpoint ${cpId}`);
    return tx(this.#repos.db, () => {
      const attempt = this.#repos.checkpoints.attempt(cpId, body.attemptNo);
      if (attempt === null) throw notFound(`checkpoint attempt ${cpId}#${body.attemptNo}`);
      if (attempt.finishedAt !== null) throw conflict("this attempt is already submitted");
      const scores = new Map(body.items.map((i) => [i.idx, { score: i.score, skipped: i.skipped }]));
      const s = GatesService.scoreCheckpoint(attempt.items, scores, body.attemptNo);
      const softPass = s.softPassOffered && body.acceptSoftPass;
      const before = this.#openItems();
      const now = this.time.iso();
      this.#repos.checkpoints.finish(cpId, body.attemptNo, {
        finishedAt: now,
        score: s.score,
        passed: s.passed,
        softPass,
        perSkill: s.perSkill,
        detail: {
          items: body.items.map(({ idx, score, skipped }) => ({ idx, score, skipped })),
          makeSketchId: body.makeSketchId,
        },
      });

      // Evidence: every answered item at weight 2.0 (§7.5); skipped items give none.
      const byIdx = new Map(attempt.items.map((i) => [i.idx, i]));
      const evidence: EvidenceInput[] = [];
      for (const item of body.items) {
        const spec = byIdx.get(item.idx);
        if (spec === undefined || item.skipped) continue;
        evidence.push({
          skillId: spec.skillId,
          category: null,
          score: Math.max(0, Math.min(1, item.score)),
          weight: evidenceWeight("checkpoint"),
          sourceKind: "checkpoint",
          sourceId: `${cpId}#${body.attemptNo}/${item.idx}`,
        });
      }
      this.d.mastery.addEvidence(evidence);
      this.#setFamilyLevels(attempt.items, scores);

      const debts: string[] = [];
      let repairQueue: CheckpointOutcome["repairQueue"] = [];
      let unlocks: Unlock[] = [];
      let gatesOpened: TrackGateState[] = [];
      if (s.passed || softPass) {
        this.#repos.checkpoints.clearRepairs(cpId);
        unlocks = this.d.unlocks.onComplete(cpId);
        for (const p of s.perSkill) {
          if (p.role === "gating" && !p.ok && softPass) {
            this.d.mastery.setDebt(p.skillId, "soft-pass");
            debts.push(p.skillId);
          } else if (p.role === "level-setting") {
            if (!p.ok) {
              this.d.mastery.setDebt(p.skillId, "checkpoint-level");
              debts.push(p.skillId);
            } else if (this.#content.skill(p.skillId)?.kind === "perceptual")
              this.d.mastery.setProvisional(p.skillId);
          }
        }
        // Skills in range become eligible for `mastered`.
        for (const sk of [...meta.gated, ...meta.levelSetting]) this.d.mastery.recompute(sk);
        this.d.cando.evaluate({ sourceId: cpId, evidence: { kind: "checkpoint", id: cpId } });
        // Wave 6 (wave6.md §5.3): the tracks this pass opens are recorded now and reported once, here.
        gatesOpened = this.d.tracks?.recordGates(cpId) ?? [];
      } else {
        const def = this.#content.checkpointDef(cpId);
        repairQueue = s.perSkill
          .filter((p) => p.role === "gating" && !p.ok)
          .map((p) => ({
            skillId: p.skillId,
            familyId: ((def?.recipe.families[p.skillId] ?? [])[0] ??
              this.#content.familiesOfSkill(p.skillId)[0]?.id ??
              null) as CheckpointOutcome["repairQueue"][number]["familyId"],
            sets: 2,
          }));
        this.#repos.checkpoints.setRepairs(
          cpId,
          repairQueue.map((r) => ({ skillId: r.skillId, familyId: r.familyId, sets: r.sets })),
          now,
        );
      }
      const after = this.#openItems();
      return {
        cpId: cpId as CheckpointOutcome["cpId"],
        attemptNo: body.attemptNo,
        score: s.score,
        passed: s.passed,
        softPass,
        softPassOffered: s.softPassOffered,
        perSkill: s.perSkill,
        repairQueue,
        debts: debts as CheckpointOutcome["debts"],
        opened: [...after].filter((x) => !before.has(x)),
        unlocks,
        ...(gatesOpened.length > 0 ? { gatesOpened } : {}),
      };
    });
  }

  /** Level-setting family items set the family level: ≥ 0.85 at a level confirms it, < 0.60 drops one below. */
  #setFamilyLevels(
    items: readonly CheckpointItemSpec[],
    scores: ReadonlyMap<number, { score: number; skipped: boolean }>,
  ): void {
    const byFamily = new Map<string, { level: number; sum: number; n: number }>();
    for (const item of items) {
      if (item.role !== "level-setting" || item.source.kind !== "family") continue;
      const s = scores.get(item.idx);
      if (s === undefined || s.skipped) continue;
      const agg = byFamily.get(item.source.familyId) ?? { level: item.source.level, sum: 0, n: 0 };
      agg.sum += s.score;
      agg.n += 1;
      byFamily.set(item.source.familyId, agg);
    }
    for (const [familyId, a] of byFamily) {
      const state = this.#repos.srs.family(familyId);
      if (state === null || a.n === 0) continue;
      const mean = a.sum / a.n;
      let level = state.level;
      // Confirming a level never carries the family past its open level (§7.3), whatever the item was set at.
      const fam = this.#content.family(familyId);
      const open =
        fam === null
          ? a.level
          : openFamilyLevels(fam, (l) => this.#repos.lessons.progress(l)?.status === "completed")
              .maxOpenLevel;
      if (mean >= 0.85) level = Math.max(level, Math.min(a.level, open));
      else if (mean < 0.6) level = Math.max(1, Math.min(level, a.level - 1));
      if (level !== state.level) this.#repos.srs.saveFamily({ ...state, level, updatedAt: this.time.iso() });
    }
  }

  // --- capstones --------------------------------------------------------------------------------

  capstoneState(id: string): CapstoneState {
    if (this.#content.capstoneMeta(id) === null) throw notFound(`capstone ${id}`);
    const status = this.d.gates.capstoneStatus(id);
    const row = this.#repos.capstones.get(id);
    // c1 (wave5.md §5.2): the draft version the last check graded, and whether the draft changed since (the first
    // release must be of the checked code, so the Brief says "Check again before you release").
    const checked = row?.checked ?? null;
    let changed = false;
    if (checked !== null && row !== null && row.status !== "released" && row.sketchId !== null) {
      const sketch = this.#repos.sketches.get(row.sketchId);
      const latest = sketch === null ? null : this.#repos.sketches.version(sketch.id, sketch.currentVersion);
      const checkedCode = this.#repos.sketches.version(checked.sketchId, checked.version)?.code;
      changed = latest !== null && (checkedCode === undefined || checkedCode.trim() !== latest.code.trim());
    }
    return {
      ...status,
      sessions: row?.sessions ?? [],
      flavour: (row?.flavour ?? null) as CapstoneState["flavour"],
      lastResult: row?.lastResult ?? null,
      reviewRequested: this.#reviewRequested(id),
      checkedVersion:
        checked === null ? null : { sketchId: checked.sketchId, sketchVersion: checked.version },
      draftChangedSinceCheck: changed,
    };
  }
  #reviewRequested(id: string): boolean {
    return this.#repos.tutor
      .conversationIdsOf("capstone", id)
      .some((c) => this.#repos.tutor.conversation(c)?.key.lane === "review");
  }

  #capstoneRow(id: string) {
    const status = this.d.gates.capstoneStatus(id);
    if (status.status === "locked") throw conflict(status.lockedReason ?? "this capstone is not open yet");
    const now = this.time.iso();
    return (
      this.#repos.capstones.get(id) ?? {
        capstoneId: id,
        status: "open" as const,
        sessions: [],
        sketchId: null,
        trackId: null,
        flavour: null,
        lastResult: null,
        startedAt: null,
        releasedAt: null,
        updatedAt: now,
      }
    );
  }

  /** A rubric run on the draft: stored as `lastResult`; rules give evidence at 1.5 unless the version is tutor-assisted. */
  capstoneCheck(
    id: string,
    body: { sessionId?: string | null; sketchId: string; sketchVersion: number; result: GradeResult },
  ): CapstoneState {
    tx(this.#repos.db, () => {
      const row = this.#capstoneRow(id);
      const version = this.#repos.sketches.version(body.sketchId, body.sketchVersion);
      if (version === null) throw notFound(`sketch ${body.sketchId} v${body.sketchVersion}`);
      const now = this.time.iso();
      this.#repos.capstones.save({
        ...row,
        status: row.status === "released" ? "released" : "in_progress",
        sketchId: body.sketchId,
        lastResult: body.result,
        checked: { sketchId: body.sketchId, version: body.sketchVersion },
        startedAt: row.startedAt ?? now,
        updatedAt: now,
      });
      // Oak 2.0 W4 F2: one history row per accepted check (a refused one threw above and writes nothing).
      recordCapstoneCheck(this.#repos.db, {
        capstoneId: id,
        sessionId: body.sessionId ?? null,
        sketchId: body.sketchId,
        sketchVersion: body.sketchVersion,
        passed: body.result.status === "pass",
        at: now,
      });
      const def: CapstoneDef | null = this.#content.capstoneDef(id);
      // A re-check of a version that already gave rubric evidence is practice (docs/design/retry.md §3.6): the
      // check runs and is stored as `lastResult`; the rules count once per version.
      const sourceId = `${id}:${body.sketchId}#v${body.sketchVersion}`;
      if (
        !version.tutorAssisted &&
        def?.brief !== undefined &&
        body.result.status !== "error" &&
        !this.#repos.mastery.hasEvidenceFrom(sourceId)
      ) {
        const added = this.d.mastery.addEvidence(this.#rubricEvidence(def.brief, body.result, sourceId));
        this.d.cando.evaluate({
          skills: added.map((e) => e.skillId),
          evidence: { kind: "sketch", id: body.sketchId },
        });
      }
    });
    return this.capstoneState(id);
  }

  capstoneCompleteSession(
    id: string,
    body: { capstoneSessionId: string; sketchId: string; flavour: CapstoneState["flavour"] },
  ): CapstoneState {
    const meta = this.#content.capstoneMeta(id);
    if (meta === null) throw notFound(`capstone ${id}`);
    if (!this.#content.capstoneSessionIds(id).includes(body.capstoneSessionId))
      throw notFound(`capstone session ${body.capstoneSessionId}`);
    tx(this.#repos.db, () => {
      const row = this.#capstoneRow(id);
      const now = this.time.iso();
      if (this.#repos.sketches.get(body.sketchId) === null) throw notFound(`sketch ${body.sketchId}`);
      // Capstone sessions are worked in order (wave4.md §5.1): a session opens once the one before it is done.
      const order = this.#content.capstoneSessionIds(id);
      const before = order[order.indexOf(body.capstoneSessionId) - 1];
      if (before !== undefined && !row.sessions.includes(before))
        throw conflict(`${body.capstoneSessionId} opens after ${before}; finish ${before} first`);
      const sessions = row.sessions.includes(body.capstoneSessionId)
        ? row.sessions
        : [...row.sessions, body.capstoneSessionId];
      // Finishing the last session does not release: `POST /capstones/:id/release` puts the track on the album.
      this.#repos.capstones.save({
        ...row,
        status: row.status === "released" ? "released" : "in_progress",
        sessions,
        sketchId: body.sketchId,
        flavour: body.flavour ?? row.flavour,
        startedAt: row.startedAt ?? now,
        updatedAt: now,
      });
      this.d.unlocks.onComplete(body.capstoneSessionId);
      this.d.capstoneSessions?.onSessionDone(body.capstoneSessionId);
      void meta;
    });
    return this.capstoneState(id);
  }
}
