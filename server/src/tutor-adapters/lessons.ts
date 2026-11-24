// LessonContextPort over the content index and the learner's library. Step sources are UNREDACTED
// (solutions, wrong variants from `tests` with `expect: 'fail'`, the four hint texts); the tutor redacts.
// Checkpoint items and the current drill trial are never given to the tutor (contracts §10.4).
import type {
  AnalysisSummary,
  Answer,
  CapstoneDef,
  Exercise,
  KeySpec,
  MeterId,
  SongDef,
  StepDef,
  TestCase,
} from "@oak/content-kit";
import { stripMarkers } from "@oak/content-kit";
import { signatureOf } from "@oak/theory";
import type { ContentIndex } from "../content/index.ts";
import type { Repos } from "../db/repos/index.ts";
import type { StoredTranscription } from "../db/repos/library.ts";
import { checkSlots } from "../services/capstone-sessions.ts";
import { checkKeyOf, checkOf, songChecks } from "../services/song-ladder.ts";
import type { UnitSongsService } from "../services/unit-songs.ts";
import type {
  LessonSong,
  LessonSource,
  ReviewSource,
  ReviewTarget,
  ReviewVersion,
  StepSource,
  SubjectFacts,
} from "../tutor/domain.ts";
import type { LessonContextPort } from "../tutor/ports.ts";
import type { CheckLike } from "../tutor/review-facts.ts";
import { revisionCountFor } from "../tutor/reviews.ts";
import type { SubjectRef } from "../tutor/types.ts";
import type { ReviewFactsPort, ReviewW7Port } from "./review-facts.ts";
import { songOfCapstone, type W7ViewPlan, w7PlanFor } from "./review-facts-w7.ts";

/** One version of a two-version capstone (AC1) as the review reads it. */
type VersionCode = { id: "a" | "b"; label: string; code: string };

/** A reviewed piece before its facts: a capstone's (Wave 7: its plan's inputs and AC1's versions) or a transcription's. */
interface CapstoneReviewSource {
  source: ReviewSource;
  key: KeySpec | null;
  meter: MeterId | null;
  target: ReviewTarget | null;
  checks?: CheckLike[];
  pickup?: boolean;
  w7?: { def: CapstoneDef; song: SongDef | null };
  versions?: VersionCode[];
}

/**
 * A step ID as the tool schema documents it (`U03.L02/S5`) or as the app sends it (`S5`): the local ID.
 * The model is told to pass the qualified form; the content index keys steps by the local one.
 */
export function localStepId(lessonId: string, stepId: string): string {
  return stepId.startsWith(`${lessonId}/`) ? stepId.slice(lessonId.length + 1) : stepId;
}

export function keyText(key: KeySpec | null | undefined): string | null {
  return key === null || key === undefined ? null : `${key.tonic} ${key.mode}`;
}

/** The deterministic `AnalysisSummary` as plain text for a review. */
export function analysisText(a: AnalysisSummary | null | undefined): string {
  if (a === null || a === undefined) return "No analysis yet.";
  const lines = [
    `Tempo: ${Math.round(a.bpm)} BPM; ${a.bars} bars; about ${Math.round(a.durationSec)} s.`,
    `Key estimate: ${a.key.map((k) => `${k.key.tonic} ${k.key.mode} (r=${k.r.toFixed(2)})`).join(", ") || "none"}.`,
    `Roles: ${
      Object.entries(a.roles)
        .map(([role, track]) => `${role}=${track}`)
        .join(", ") || "none"
    }.`,
  ];
  const rest = Object.entries(a).filter(([k]) => !["key", "bpm", "bars", "durationSec", "roles"].includes(k));
  for (const [k, v] of rest) lines.push(`${k}: ${JSON.stringify(v)}`);
  return lines.join("\n");
}

function starterOf(ex: Exercise): string | null {
  if (!("code" in ex) || typeof ex.code !== "object" || ex.code === null || !("starter" in ex.code))
    return null;
  try {
    return stripMarkers(ex.code.starter).code;
  } catch {
    return ex.code.starter;
  }
}

function hintsOf(ex: Exercise, solutions: readonly string[]): StepSource["hints"] {
  if (ex.hints === null) return null;
  const [a, b, c, d] = ex.hints;
  const reveal = d === "auto" ? (solutions[0] ?? "Show the solution.") : (d.patch ?? d.text);
  return [a.text, b.text, c.text, reveal];
}

type ChoiceLike = { id: string; label: string };

/** A bar-grid answer widget (Wave 5): one entry per bar. */
function isBarGrid(ui: unknown): boolean {
  return typeof ui === "object" && ui !== null && (ui as { ui?: unknown }).ui === "bar-grid";
}

/** A static answer as the learner would say it: choice labels (not IDs), texts, numbers, numerals. */
function answerTexts(
  answer: Partial<Answer> | undefined,
  choices: readonly ChoiceLike[] = [],
  perBar = false,
): string[] {
  if (answer === undefined || answer === null) return [];
  const label = (id: string) => choices.find((c) => c.id === id)?.label ?? id;
  const out: string[] = [];
  if (answer.choice !== undefined && answer.choice.length > 0) out.push(answer.choice.map(label).join(", "));
  // `text` lists accepted spellings of one answer, except in a bar-grid (`entry: "symbol"`), where it holds one
  // chord symbol per bar: there the whole chart is the answer the guard holds back.
  if (answer.text !== undefined) out.push(...(perBar ? [answer.text.join(" ")] : answer.text.slice(0, 1)));
  if (answer.number !== undefined) out.push(String(answer.number));
  if (answer.rn !== undefined && answer.rn.length > 0) out.push(answer.rn.join(" "));
  if (answer.degrees !== undefined && answer.degrees.length > 0) out.push(answer.degrees.join(" "));
  if (answer.qualities !== undefined && answer.qualities.length > 0) out.push(answer.qualities.join(" "));
  // Wave 4: chord dictation stage by stage (bass degrees, then qualities, then numerals).
  for (const stage of ["bass", "quality", "rn"] as const) {
    const st = answer.stages?.[stage];
    if (st !== undefined && st.length > 0) out.push(st.join(" "));
  }
  if (answer.midi !== undefined && answer.midi.length > 0) out.push(answer.midi.join(" "));
  // Wave 5: the form widget's sections ("verse chorus verse chorus"); the bar-grid answers bar by bar in `rn` or
  // `text` (all bars, above) and the scale builder in `midi` or `degrees` (above).
  const sections = (answer as { sections?: readonly string[] }).sections;
  if (sections !== undefined && sections.length > 0) out.push(sections.join(" "));
  // Wave 6: a form map (`input: "map"`) also answers where each section starts: the first bars as a plain list
  // ("1 9 17 25"), the form the answer guard reads as a map's boundaries.
  const bars = (answer as { bars?: readonly number[] }).bars;
  if (bars !== undefined && bars.length > 0) out.push(bars.join(" "));
  // Wave 7: a grouping ("2+2+3", the form the answer guard reads) and a Euclidean rhythm ("(3,8)", "(5,16,10)").
  if (answer.grouping !== undefined && answer.grouping.length > 0) out.push(answer.grouping.join("+"));
  if (answer.euclid !== undefined && answer.euclid.length >= 2) out.push(`(${answer.euclid.join(",")})`);
  return out;
}

/** Wave 7: a voicing a step grades (`keyboard.voicing`, a staff voicing), as "voicing: <shape>", one per shape. */
function voicingTexts(shape: string | readonly string[] | undefined): string[] {
  if (shape === undefined) return [];
  return (typeof shape === "string" ? [shape] : [...shape]).map((x) => `voicing: ${x}`);
}

/**
 * Wave 4: how the learner answers a step when it is not plain code (`StepSource.answerKind`), so the answer guard
 * knows which forms of the answer to hold back below the reveal rung: the answer widget (`rn-palette`,
 * `quality-pad`, `slot-choice`, `degree-pad`, …), `staff-chords`, `chord-dictation`, `dictation`, `voice-leading`.
 */
export function answerKindOf(step: StepDef, ex: Exercise | undefined): string | null {
  if (ex === undefined) return null;
  // A staged chord dictation is answered stage by stage (bass degrees, qualities, numerals), whatever its
  // single-stage fallback widget is.
  if (ex.kind === "dictation" && (ex as { stageAnswers?: unknown }).stageAnswers !== undefined)
    return "chord-dictation";
  const ui = (ex as { answer?: { ui?: unknown } }).answer?.ui;
  if (typeof ui === "string") return ui;
  if (ex.kind === "staff-write" && ex.expect.e === "chords") return "staff-chords";
  if (ex.kind === "dictation")
    return (ex as { stageAnswers?: unknown }).stageAnswers !== undefined ? "chord-dictation" : "dictation";
  const rubric = (ex as { rubric?: { rule?: string }[] }).rubric ?? [];
  if (step.gateCheck === true || rubric.some((r) => r.rule === "voice-leading")) return "voice-leading";
  return null;
}

/**
 * Reference answers of a step for the tutor's answer policy and redaction (contracts §10.5): the code
 * solutions, and for answer-type exercises with a fixed answer (predict, identify, fact, staff-read, the
 * questions of an investigate step) the answer itself. Without these an ear or predict step looked like
 * an open step ("nothing to withhold") and the tutor was free to say the answer at rung 1. Answers drawn
 * by a generator (`correct: {}`) are not known before the trial and are not here.
 */
export function referenceAnswers(ex: Exercise | undefined): string[] {
  if (ex === undefined) return [];
  const out: string[] = [];
  if ("reference" in ex && ex.reference !== undefined && ex.reference !== null && "solutions" in ex.reference)
    out.push(...(ex.reference as { solutions: string[] }).solutions);
  const optionsOf = (ui: unknown): ChoiceLike[] =>
    typeof ui === "object" && ui !== null && Array.isArray((ui as { options?: unknown }).options)
      ? ((ui as { options: ChoiceLike[] }).options ?? [])
      : [];
  switch (ex.kind) {
    case "predict":
      if (Array.isArray(ex.correct))
        out.push(ex.correct.map((id) => ex.choices?.find((c) => c.id === id)?.label ?? id).join(", "));
      else if (typeof ex.correct === "number") out.push(String(ex.correct));
      break;
    case "identify":
    case "fact":
      out.push(...answerTexts(ex.correct, optionsOf(ex.answer), isBarGrid(ex.answer)));
      break;
    case "staff-read":
      out.push(...answerTexts(ex.correct, optionsOf(ex.answer), isBarGrid(ex.answer)));
      break;
    case "staff-write": {
      // Staff writing (Wave 3): the notes to write, or the key signature's accidentals in written order.
      const e = ex.expect;
      if (e.e === "pitches") out.push(e.spelled.join(" "));
      else if (e.e === "key-signature") {
        const sig = signatureOf(e.key);
        const acc = sig.sharps.length > 0 ? sig.sharps : sig.flats;
        if (acc.length > 0) out.push(acc.join(" "));
      } else if (e.e === "chords") {
        out.push(e.symbols.join(" "));
        out.push(...voicingTexts(e.voicing));
      } else if ("solutions" in e.reference) out.push(...(e.reference as { solutions: string[] }).solutions);
      break;
    }
    case "dictation":
      // By ear (Wave 3): the hidden source is the answer as much as the reference is.
      if (ex.byEar !== undefined && ex.stimulus.src === "code") out.push(ex.stimulus.code);
      // Wave 4 staged chord dictation: the reference is code, but the learner answers in bass degrees,
      // qualities and numerals — the answer guard needs those forms. They are the exercise's first passing test.
      if (ex.stageAnswers !== undefined) {
        const pass = (ex.tests ?? []).find((t) => t.expect === "pass" && "answer" in t.response);
        if (pass !== undefined && "answer" in pass.response)
          out.push(...answerTexts(pass.response.answer as Partial<Answer>));
      }
      break;
    case "all":
      // Wave 7 (R3.L03's quiz): a step of several parts withholds every part's answer.
      for (const part of ex.parts) out.push(...referenceAnswers(part));
      break;
    case "keyboard": {
      // A keyboard answer's notes as a MIDI list (the guard reads it as a set of pitch classes), and Wave 7's
      // voicing shape the chord must be built in.
      const e = ex.expect;
      if (e.midi !== undefined && e.midi.length > 0) out.push(e.midi.join(" "));
      if (e.sequence !== undefined && e.sequence.length > 0) out.push(e.sequence.join(" "));
      out.push(...voicingTexts(e.voicing?.shape));
      break;
    }
    case "run-investigate":
      for (const q of ex.questions)
        if (q.q === "choice")
          out.push(q.correct.map((id) => q.options.find((o) => o.id === id)?.label ?? id).join(", "));
        else if (q.q === "number") out.push(String(q.correct));
      break;
    default:
      break;
  }
  return [...new Set(out.map((t) => t.trim()).filter((t) => t.length > 0))];
}

/**
 * A known wrong answer as the learner would have given it: code, a staff note list (`C4:4 E4:4`), the
 * accidentals of a key signature or a typed answer, the degrees of a pad, the order of a sequence. `null`
 * for taps and sung fixtures (nothing the tutor could quote).
 */
export function responseText(r: TestCase["response"]): string | null {
  if ("code" in r) return r.code;
  if ("staff" in r) return r.staff;
  if ("answer" in r)
    return r.answer.text !== undefined && r.answer.text.length > 0
      ? r.answer.text.join(" ")
      : answerTexts(r.answer).join(" ") || null;
  if ("order" in r) return r.order.join(" ");
  if ("blanks" in r) return Object.values(r.blanks).join(" ") || null;
  return null;
}

export function stepSource(lessonId: string, step: StepDef): StepSource {
  const ex = step.exercise;
  const solutions = referenceAnswers(ex);
  const rubric =
    ex !== undefined && "rubric" in ex && Array.isArray(ex.rubric)
      ? (ex.rubric as { label: string; required: boolean }[]).map((r) => ({
          label: r.label,
          required: r.required,
        }))
      : null;
  const constraints =
    ex !== undefined && "constraints" in ex && Array.isArray(ex.constraints)
      ? (ex.constraints as unknown[]).map((c) =>
          typeof c === "object" && c !== null && "id" in c
            ? String((c as { id: unknown }).id)
            : JSON.stringify(c),
        )
      : [];
  return {
    lessonId,
    id: step.id,
    kind: step.kind,
    grading: step.kind === "make" ? "make" : step.graded === true ? "graded" : "ungraded",
    exerciseRef: ex === undefined ? null : `${lessonId}/${ex.id}`,
    prompt: ex?.prompt ?? step.title,
    starterCode: ex === undefined ? null : starterOf(ex),
    constraints,
    rubric,
    hints: ex === undefined ? null : hintsOf(ex, solutions),
    knownMistakes:
      ex?.tests
        .filter((t) => t.expect === "fail")
        .map((t) => ({
          feedback: t.feedback?.[0] ?? "",
          description: t.name,
          variantCode: responseText(t.response),
        })) ?? [],
    solutions: step.kind === "make" ? [] : solutions,
    answerKind: answerKindOf(step, ex),
  };
}

/** Unit songs (contracts §5.11 rule 19): the song a lesson is in, as `LessonSource.song`. */
export interface LessonSongPort {
  songOf(lessonId: string): LessonSong | null;
}

/**
 * The song of a lesson from the unit-songs service: its title and style (the profile's while it is new), every cell
 * the learner's takes play (deduped, in take order) and this lesson's `today` line (`null` on a side step).
 */
export function lessonSongPort(songs: Pick<UnitSongsService, "planSong" | "get">): LessonSongPort {
  return {
    songOf(lessonId) {
      const plan = songs.planSong(lessonId);
      if (plan === null) return null;
      const yours = plan.status === "new" ? [] : songs.get(plan.unitId).takes.flatMap((t) => t.cells);
      return { title: plan.title, flavour: plan.flavour, yours: [...new Set(yours)], today: plan.today };
    },
  };
}

export class LessonContextAdapter implements LessonContextPort {
  constructor(
    private readonly content: ContentIndex,
    private readonly repos: Repos,
    /** Wave 4: the reviewed piece's analysed facts (`ReviewSource.facts`); absent: the text analysis only. */
    private readonly facts?: ReviewFactsPort,
    /** Wave 7: a song's melody (JC3, JC4) and two versions compared (AC1); absent: neither. */
    private readonly w7?: ReviewW7Port,
    /** Unit songs: the song a lesson is in; absent: no lesson carries a song. */
    private readonly songs?: LessonSongPort,
  ) {}

  async lesson(lessonId: string): Promise<LessonSource | null> {
    const def = this.content.lessonDef(lessonId);
    const song = this.songs?.songOf(lessonId) ?? null;
    if (def !== null)
      return {
        id: def.id,
        title: def.title,
        objective: def.objective,
        key: keyText(def.key),
        meter: def.meter,
        bpm: def.bpm,
        ...(song === null ? {} : { song }),
      };
    const site = this.content.lessonSite(lessonId);
    if (site === null) return null;
    return {
      id: site.meta.id,
      title: site.meta.title,
      objective: site.meta.objective,
      key: null,
      meter: site.unit.meter ?? null,
      bpm: null,
      ...(song === null ? {} : { song }),
    };
  }

  async step(lessonId: string, stepId: string): Promise<StepSource | null> {
    // Checkpoint items (owner is a checkpoint) and drill trials are not lesson steps: never sent.
    if (this.content.checkpointMeta(lessonId) !== null) return null;
    const step = this.content.stepDef(lessonId, localStepId(lessonId, stepId));
    if (step === null) return null;
    // Wave 4 (wave4.md §5.6): the key the step is in, the exercise's own, else the lesson's.
    const key = keyText(step.exercise?.key ?? this.content.lessonDef(lessonId)?.key ?? null);
    // Wave 6: a step that changes key carries its key plan (contracts §6.8), each key with the bar it starts on, and
    // a step in its own meter (a 6/8 step inside a 4/4 lesson) says so.
    const ex = step.exercise as
      | { keyPlan?: readonly { bar: number; key: KeySpec }[]; meter?: string }
      | undefined;
    const plan = (ex?.keyPlan ?? []).map((e) => ({ bar: e.bar, key: keyText(e.key) as string }));
    const lessonMeter = this.content.lessonDef(lessonId)?.meter ?? null;
    return {
      ...stepSource(lessonId, step),
      key,
      ...(plan.length > 1 ? { keyPlan: plan } : {}),
      ...(ex?.meter !== undefined && ex.meter !== lessonMeter ? { meter: ex.meter } : {}),
    };
  }

  async resolveExercise(ref: string): Promise<{ lessonId: string; stepId: string } | null> {
    const site = this.content.exercise(ref);
    if (site === null || site.ownerKind !== "lesson" || site.stepId === null) return null;
    return { lessonId: site.owner, stepId: site.stepId };
  }

  async subject(ref: SubjectRef): Promise<SubjectFacts> {
    const open = (title: string | null, extra: Partial<SubjectFacts> = {}): SubjectFacts => ({
      tutorOpen: true,
      closedReason: null,
      title,
      released: null,
      transcriptionSource: null,
      ...extra,
    });
    switch (ref.subjectKind) {
      case "checkpoint":
        return {
          ...open(this.content.checkpointMeta(ref.subjectId)?.title ?? null),
          tutorOpen: false,
          closedReason: "Checkpoints are done on your own: the tutor opens again afterwards.",
        };
      case "drill":
        return {
          ...open(this.content.family(ref.subjectId)?.title ?? null),
          tutorOpen: false,
          closedReason: "The tutor is off during drill trials.",
        };
      case "lesson":
        return open(this.content.lessonTitle(ref.subjectId));
      case "capstone":
        return open(this.content.capstoneMeta(ref.subjectId)?.title ?? null, {
          released: this.repos.capstones.get(ref.subjectId)?.status === "released",
        });
      case "track": {
        const track = this.content.source.syllabus.tracks.find((t) => t.id === ref.subjectId);
        const released = (track?.capstones ?? []).some(
          (c) => this.repos.capstones.get(c)?.status === "released",
        );
        return open(track?.title ?? null, { released });
      }
      case "transcription": {
        const t = this.repos.transcriptions.get(ref.subjectId);
        return open(t?.title ?? null, {
          transcriptionSource: t === null ? null : t.sourceKind === "own-audio" ? "own-audio" : "ladder",
        });
      }
      case "sketch":
        return open(this.repos.sketches.get(ref.subjectId)?.title ?? null);
      default:
        return open(null);
    }
  }

  async review(ref: SubjectRef, target: ReviewTarget | null = null): Promise<ReviewSource | null> {
    const source: CapstoneReviewSource | null =
      ref.subjectKind === "capstone"
        ? this.#capstoneReview(ref.subjectId, target?.kind === "album" ? target : null)
        : ref.subjectKind === "transcription"
          ? this.#transcriptionReview(ref.subjectId, target?.kind === "transcription" ? target.version : null)
          : null;
    if (source === null) return null;
    // Wave 7: the track capstones' views, read from the capstone's own rubric, with the song it is on (JC3's model
    // head, JC4's standard) evaluated once from its answer key.
    let w7: W7ViewPlan | null = null;
    if (ref.subjectKind === "capstone" && source.w7 !== undefined) {
      const { def, song } = source.w7;
      const melody = song !== null && this.w7 !== undefined ? await this.w7.songMelody(song) : null;
      w7 = w7PlanFor(def, song, melody);
    }
    // Wave 4: what Oak's analysis found in the reviewed code, so every comment can point at a real bar.
    const factsOf = (code: string) =>
      this.facts === undefined
        ? Promise.resolve(null)
        : this.facts(code, {
            key: source.key,
            meter: source.meter,
            checks: source.checks ?? null,
            pickup: source.pickup === true,
            ...(w7 === null ? {} : { w7 }),
          });
    const facts = await factsOf(source.source.code);
    // Wave 7 (AC1): both versions, each with its own facts, and what differs between them; the review is as long
    // as the longer of the two.
    const vs = source.versions ?? [];
    if (vs.length >= 2) {
      const versions: ReviewVersion[] = [];
      for (const v of vs) versions.push({ ...v, facts: await factsOf(v.code) });
      const [a, b] = vs as [VersionCode, VersionCode];
      const versionsCompared =
        this.w7 === undefined
          ? null
          : await this.w7.compare(a.code, b.code, { key: source.key, meter: source.meter });
      const lengths = versions.map((v) => v.facts?.bars ?? 0);
      const totalBars = Math.max(source.source.totalBars ?? 0, ...lengths) || source.source.totalBars;
      return { ...source.source, totalBars, facts, target: source.target, versions, versionsCompared };
    }
    return { ...source.source, facts, target: source.target };
  }

  /**
   * The capstone's piece: the album version the review is about (Wave 4: `albumTrackId` + `albumVersion`), else
   * the capstone's current draft.
   */
  #capstoneReview(
    id: string,
    target: { trackId: string; version: number } | null,
  ): CapstoneReviewSource | null {
    const meta = this.content.capstoneMeta(id);
    const row = this.repos.capstones.get(id);
    if (meta === null || row === null) return null;
    let sketchId = row.sketchId;
    let sketchVersion: number | null = null;
    let reviewTarget: ReviewTarget | null = null;
    if (target !== null) {
      const track = this.repos.album.track(target.trackId);
      const v = track?.capstoneId === id ? this.repos.album.version(target.trackId, target.version) : null;
      if (v === null || v === undefined) return null;
      sketchId = v.sketchId;
      sketchVersion = v.sketchVersion;
      reviewTarget = { kind: "album", trackId: target.trackId, version: target.version };
    }
    if (sketchId === null) return null;
    const sketch = this.repos.sketches.get(sketchId);
    if (sketch === null) return null;
    const version = this.repos.sketches.version(sketch.id, sketchVersion ?? sketch.currentVersion);
    if (version === null) return null;
    const def = this.content.capstoneDef(id);
    const authored = def?.brief?.rubric ?? [];
    const results = row.lastResult?.rubric ?? [];
    const rubric = authored.map((r) => ({
      label: r.label,
      required: r.required,
      met: results.find((x) => x.ruleId === r.id)?.ok ?? false,
    }));
    const analysis = version.analysis ?? row.lastResult?.analysis ?? null;
    return {
      source: {
        title: sketch.title,
        code: version.code,
        brief: def?.brief?.prompt ?? meta.objective,
        analysis: analysisText(analysis),
        rubric,
        learnerNote: version.note,
        checklist: [],
        reference: null,
        totalBars: analysis?.bars ?? null,
        revisions: revisionCountFor(id),
        // Wave 6: the Core Finale's single asks for the longest review, three strengths, the strongest first.
        ...(id === "CF-A" ? { strengthsWanted: 3 as const } : {}),
      },
      key: version.key ?? def?.key ?? null,
      meter: version.meter ?? def?.meter ?? null,
      target: reviewTarget,
      checks: this.#capstoneChecks(id),
      ...(def === null
        ? {}
        : { w7: { def, song: songOfCapstone(def, sketch.tags, this.content.source.songs) } }),
      ...this.#versionCodes(id, def, target),
    };
  }

  /**
   * Wave 7 (AC1, `CapstoneDef.versions`): the code of each version, labelled as the brief labels it. A released
   * track holds version one as album version 1 and version two as album version 2 (the capstone engineer's
   * release); a draft reads the latest save of each version (`capstone_versions`). Fewer than two: none.
   */
  #versionCodes(
    id: string,
    def: CapstoneDef | null,
    target: { trackId: string; version: number } | null,
  ): { versions?: VersionCode[] } {
    const defs = (def as { versions?: { id: string; label?: string }[] } | null)?.versions ?? [];
    if (defs.length < 2) return {};
    const out: VersionCode[] = [];
    defs.forEach((d, i) => {
      const vid = d.id === "a" || d.id === "b" ? d.id : null;
      if (vid === null) return;
      let code: string | null = null;
      if (target !== null) {
        const v = this.repos.album.version(target.trackId, i + 1);
        if (v) code = this.repos.sketches.version(v.sketchId, v.sketchVersion)?.code ?? null;
      }
      if (code === null) {
        const row = this.repos.capstoneVersions.of(id).find((r) => r.versionId === vid);
        if (row) code = this.repos.sketches.version(row.sketchId, row.sketchVersion)?.code ?? null;
      }
      if (code !== null) out.push({ id: vid, label: d.label ?? `Version ${vid}`, code });
    });
    return out.length >= 2 ? { versions: out } : {};
  }

  /**
   * Wave 5: a transcribe capstone's checks as the review's facts read them (X2: bass ≥ 0.90, then the changes, then
   * the melody): the best score, the mark, passed or revealed, and whether it is open (its `after` checks cleared).
   */
  #capstoneChecks(id: string): CheckLike[] {
    const def = this.content.capstoneDef(id);
    const slots = (def?.sessionDefs ?? []).flatMap((d) => checkSlots(d));
    const rows = this.repos.capstoneSessions.checks(id);
    const cleared = (checkId: string) =>
      slots
        .filter((x) => x.check.id === checkId)
        .every(({ stage }) => {
          const r = rows.find((x) => x.checkId === checkId && x.stage === stage);
          return r !== undefined && (r.passed || r.revealed);
        });
    return slots.map(({ check, stage }) => {
      const r = rows.find((x) => x.checkId === check.id && x.stage === stage);
      return {
        checkId: check.id,
        phrase: check.phrase,
        layer: check.layer,
        stage,
        open: (check.after ?? []).every(cleared),
        score: r?.bestScore ?? null,
        passed: r?.passed ?? false,
        revealed: r?.revealed ?? false,
        passAt: check.pass,
      };
    });
  }

  /** Wave 5: a ladder song item's checks (L5 phrases, L6 bass → changes → melody lines) for the review's facts. */
  #songChecks(t: StoredTranscription): CheckLike[] {
    const song = this.content.source.songs.find((x) => x.id === t.songId);
    const level = t.ladderLevel;
    if (song === undefined || (level !== 5 && level !== 6)) return [];
    const versions = this.repos.transcriptions.versions(t.id);
    const checks = songChecks(song, level);
    let open = true;
    return checks.map((c) => {
      const mine = versions.filter((v) => {
        const k = checkOf(song, level, {
          ...(v.stage == null ? {} : { stage: v.stage }),
          ...(v.phrase == null ? {} : { phrase: v.phrase }),
        });
        return k !== null && checkKeyOf(k) === checkKeyOf(c);
      });
      const graded = mine.filter((v) => v.result !== null && v.result.status !== "error");
      const passAt = level === 5 ? 0.85 : c.stage === "bass" ? 0.9 : 0.85;
      const passed = graded.some(
        (v) =>
          v.result?.status === "pass" && v.result.score >= passAt - 1e-9 && v.result.assist.revealed !== true,
      );
      const revealed = graded.some(
        (v) => v.result?.assist.revealed === true || (v.result?.assist.rung ?? 0) >= 4,
      );
      const row: CheckLike = {
        checkId: checkKeyOf(c),
        phrase: c.phrase,
        layer: c.stage === "changes" ? "chords" : (c.stage ?? "melody"),
        stage: level === 6 ? (c.stage ?? null) : null,
        open,
        score: graded.length === 0 ? null : Math.max(...graded.map((v) => v.result?.score ?? 0)),
        passed,
        revealed,
        passAt,
      };
      open = open && (passed || revealed);
      return row;
    });
  }

  /** A transcription: the version named (Wave 4: `transcriptionVersion`), else the latest. */
  #transcriptionReview(
    id: string,
    wanted: number | null,
  ): {
    source: ReviewSource;
    key: KeySpec | null;
    meter: MeterId | null;
    target: ReviewTarget | null;
    checks?: CheckLike[];
    pickup?: boolean;
  } | null {
    const t = this.repos.transcriptions.get(id);
    if (t === null) return null;
    const versions = this.repos.transcriptions.versions(id);
    const latest = wanted === null ? versions.at(-1) : versions.find((v) => v.version === wanted);
    if (latest === undefined) return null;
    // The reference is shown only once a graded ladder piece has passed; never for the learner's own audio.
    // Wave 4: a graded pass (≥ 0.85, not revealed, every stage), not a version a reveal made pass.
    // A generated ladder item counts only its graded pass: one passed L3 stage (the bass) must not hand the tutor the
    // whole hidden source, chords included, while the later stages are still to be heard.
    const ladderItem = t.ladder !== undefined && t.ladder !== null;
    const passed =
      t.gradedPass === true ||
      (!ladderItem &&
        versions.some(
          (v) =>
            v.result?.status === "pass" &&
            v.result.assist.revealed !== true &&
            v.result.assist.rung < 4 &&
            v.machineDraft !== true,
        ));
    const reference = t.sourceKind !== "own-audio" && passed ? t.hiddenCode : null;
    const checklist = Object.entries(t.checklist).map(([item, score]) => `${item}: ${score}/2`);
    const source: ReviewSource = {
      title: t.title,
      code: latest.code,
      brief:
        t.sourceKind === "own-audio"
          ? `Transcribe “${t.title}” from your own recording.`
          : `Transcribe “${t.title}”.`,
      analysis: analysisText(latest.result?.analysis ?? null),
      rubric: (latest.result?.rubric ?? []).map((r) => ({
        label: r.ruleId,
        required: r.required,
        met: r.ok,
      })),
      learnerNote: null,
      checklist,
      reference,
      totalBars: latest.result?.analysis?.bars ?? null,
      revisions: 1,
    };
    return {
      source,
      key: t.key,
      meter: t.meter,
      target: { kind: "transcription", version: latest.version },
      checks: this.#songChecks(t),
      pickup: (t.ladder?.given.pickup ?? null) !== null,
    };
  }

  async prefixSources(): Promise<{ syllabus: string; catalog: string }> {
    return this.content.source.tutorPrefix;
  }
}
