// The checkpoint player's pure rules (contracts §7.6): the score the server will give (pass ≥ 0.85 on gating
// items with every gated skill's mean ≥ 0.70; skipped level-setting items left out, skipped gating items 0;
// "Continue anyway" on a retake ≥ 0.75 or from the third attempt), the answer surface of a family item drawn
// from its trial, the drill response it is graded with, and the copy of the result. No DOM: `bun test`.
import type {
  Answer,
  AttemptResponse,
  CheckpointItemSpec,
  CheckpointOutcome,
  Exercise,
  FamilyDef,
  GradeResult,
  KeySpec,
  Trial,
} from "@oak/api";
import type { TrialResponse } from "@oak/drills";
import { CHECKPOINT } from "@oak/srs";
import type { AnswerSpec, SungSummary } from "../../answers/types.ts";
import { surfaceOf } from "../../drills/model.ts";
import { staffAnswer } from "../../drills/staff.ts";
import { clickCellAnswer, clickCellsOf, padAnswer } from "../../drills/wave6.ts";
import { sungPerformance } from "../grading.ts";

export interface ItemRecord {
  idx: number;
  score: number;
  skipped: boolean;
  response: AttemptResponse;
  result: GradeResult | null;
}

export type LocalScore = Pick<CheckpointOutcome, "score" | "passed" | "softPassOffered" | "perSkill">;

/** The server's scoring (server/src/services/gates.ts `scoreCheckpoint`), to offer "Continue anyway" first. */
export function scoreLocal(
  items: readonly CheckpointItemSpec[],
  records: ReadonlyMap<number, Pick<ItemRecord, "score" | "skipped">>,
  attemptNo: number,
): LocalScore {
  const bySkill = new Map<string, { role: CheckpointItemSpec["role"]; sum: number; n: number }>();
  let gSum = 0;
  let gN = 0;
  for (const item of items) {
    const r = records.get(item.idx);
    // A level-setting item never answered is handed in as skipped (Quiet mode sets sung items aside): left out.
    if ((r === undefined || r.skipped) && item.role === "level-setting") continue;
    const score = r === undefined || r.skipped ? 0 : Math.max(0, Math.min(1, r.score));
    const agg = bySkill.get(item.skillId) ?? { role: item.role, sum: 0, n: 0 };
    agg.sum += score;
    agg.n += 1;
    bySkill.set(item.skillId, agg);
    if (item.role === "gating") {
      gSum += score;
      gN += 1;
    }
  }
  const perSkill = [...bySkill.entries()].map(([skillId, a]) => {
    const mean = a.n === 0 ? 0 : a.sum / a.n;
    return {
      skillId: skillId as CheckpointItemSpec["skillId"],
      role: a.role,
      mean,
      items: a.n,
      ok: mean >= CHECKPOINT.perSkillPass,
    };
  });
  const score = gN === 0 ? 1 : gSum / gN;
  const passed = score >= CHECKPOINT.pass && perSkill.every((p) => p.role !== "gating" || p.ok);
  const softPassOffered =
    !passed &&
    (attemptNo >= CHECKPOINT.softPassAlwaysFromAttempt || (attemptNo >= 2 && score >= CHECKPOINT.softPass));
  return { score, passed, softPassOffered, perSkill };
}

const label = (s: string) => s.replace(/^deg\./, "").replace(/-/g, " ");

/**
 * The answer surface of a family item, from the family's answer kind and the drawn trial (its own options
 * where it carries them, else the family's categories). `null`: no widget can answer it in this version.
 */
export function familyAnswerSpec(
  answer: string,
  trial: Pick<Trial, "params" | "expected">,
  categories: readonly string[],
  /** The family, for the surfaces this table leaves to the drill runner's (code, contours, choices by label). */
  def?: FamilyDef,
): AnswerSpec | null {
  // Chromatic degrees (U17.CP, `fam.deg.fet-chromatic`): the drill runner's pad, one key per pitch with the
  // usual spelling (♯4, ♭6), never the category IDs ("deg.s4").
  if (def?.id === "fam.deg.fet-chromatic") {
    const s = surfaceOf(trial as Trial<unknown>, def);
    if (s.kind === "widget") return s.spec;
  }
  const own = ownSpec(answer, trial, categories);
  if (own || !def) return own;
  const s = surfaceOf(trial as Trial<unknown>, def);
  return s.kind === "widget" ? s.spec : null;
}

/** A checkpoint is played and graded in its Make's key and tempo, else these. */
export const CP_KEY: KeySpec = { tonic: "C", mode: "major" };
export const CP_BPM = 100;

/**
 * A plain title for an authored item that has none: what the learner does, never "a short task". A listening or
 * answer item the content leaves untitled is named by the skill it counts for ("Intervals in a key, by ear"),
 * so it never reads as a generic "Answer this one".
 */
export function authoredTitle(ex: Exercise, skill: string | null = null): string {
  if (ex.kind === "staff-write")
    return ex.answer.ui === "staff-input" && ex.answer.mode === "key-signature"
      ? "Write the key signature"
      : "Write it on the staff";
  if (ex.kind === "code-modify" || ex.kind === "error-hunt") return "Change the code";
  if (ex.kind === "code-make" || ex.kind === "compose-brief") return "Write it in code";
  if (ex.kind === "staff-read") return "Read it";
  if ("stimulus" in ex && ex.stimulus) return skill ? `${skill}, by ear` : "Listen and answer";
  return skill ?? "Answer this one";
}

/** The key an item is played and graded in: its own, its trial's, else the checkpoint's. */
export function itemKey(ex: Exercise, trial: Pick<Trial, "params"> | null, fallback: KeySpec): KeySpec {
  const tk = (trial?.params as { key?: KeySpec } | undefined)?.key;
  return ex.key ?? tk ?? fallback;
}

/**
 * Wave 7 (`tap.lanes`, contracts §8.4): a drawn polyrhythm trial that is tapped with two hands (`params.tapLanes`,
 * fam.rhy.polyrhythm "tap-3-over-2": F the 2, J the 3) is drawn as a two-lane tap, its lanes in the trial's order;
 * the take then reaches the drill grader as `lanes` (`familyResponse`). `null` for a one-lane trial.
 */
export function trialTapLanes(
  trial: Pick<Trial, "params">,
): { label: string; track: string; key?: string }[] | null {
  const lanes = (trial.params as { tapLanes?: unknown }).tapLanes;
  if (!Array.isArray(lanes) || lanes.length < 2) return null;
  const out: { label: string; track: string; key?: string }[] = [];
  for (const l of lanes.slice(0, 2)) {
    const lane = l as { label?: unknown; key?: unknown };
    if (typeof lane.label !== "string" || lane.label === "") return null;
    out.push({
      label: lane.label,
      track: "drill",
      ...(typeof lane.key === "string" ? { key: lane.key } : {}),
    });
  }
  return out;
}

/** A family item answered by singing (contracts §7.6: level-setting, skipped in Quiet mode). */
export function isSungTrial(trial: Pick<Trial, "params">): boolean {
  return (trial.params as Record<string, unknown>).mode === "sing";
}

/** The sung targets a family trial carries (seconds from the response window), as MIDI. */
export function sungTargetsOf(trial: Pick<Trial, "params">): { midi: number; on: number; off: number }[] {
  const raw = (trial.params as Record<string, unknown>).singTargets;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is { midi: number; on: number; off: number } =>
      !!t && typeof t === "object" && typeof (t as { midi?: unknown }).midi === "number",
  );
}

/** A sung family item's score: the mean per-note credit within the learner's current tolerance (§7.6). */
export function sungItemScore(sung: readonly SungSummary[], trial: Pick<Trial, "params">, tolCents: number) {
  const targets = sungTargetsOf(trial).map((t) => t.midi);
  const perf = sungPerformance(sung, targets, tolCents, "global");
  return { score: perf.score, noVoice: perf.diagnostics.some((d) => d.id === "sing.no-voice") };
}

function ownSpec(
  answer: string,
  trial: Pick<Trial, "params" | "expected">,
  categories: readonly string[],
): AnswerSpec | null {
  const p = trial.params as Record<string, unknown>;
  const ui = typeof p.ui === "string" ? p.ui : answer;
  switch (ui) {
    case "choice": {
      const opts = Array.isArray(p.options) ? (p.options as unknown[]).map(String) : [...categories];
      return { ui: "choice", options: opts.map((o) => ({ id: o, label: label(o) })) };
    }
    case "degree-pad": {
      // Categories named by degree (`deg.5`) are the pad's keys. A family whose categories are something else
      // (intervals in a key: "3rd", "up") leaves the pad to the drill runner's surface, which knows its degrees;
      // an empty pad had no keys at all (U04.CP "Intervals in a key").
      // A raised degree's category is spelled with an `s` ("deg.s4"); the pad's key is "#4".
      const set = categories
        .filter((c) => c.startsWith("deg."))
        .map((c) => c.slice(4).replace(/^s(?=\d)/, "#"));
      if (set.length === 0) return null;
      const len = trial.expected.degrees?.length ?? 1;
      return {
        ui: "degree-pad",
        set: set as never,
        syllables: false,
        ...(len > 1 ? { sequenceLen: len } : {}),
      };
    }
    case "number":
      return { ui: "number" };
    case "text":
      return { ui: "text", normalize: (typeof p.textKind === "string" ? p.textKind : "free") as never };
    case "grid": {
      // Wave 6: 6 steps for a bar of 6/8, 24 for sixteenth-note triplets (content-kit `grid.steps`).
      const stepsPerBar = (typeof p.stepsPerBar === "number" ? p.stepsPerBar : 8) as 6 | 8 | 12 | 16 | 24;
      const bars = typeof p.gridBars === "number" ? p.gridBars : 1;
      return { ui: "grid", rows: ["hit"], stepsPerBar, bars };
    }
    case "tap":
      return { ui: "tap" };
    default:
      return null;
  }
}

/**
 * A widget's answer as the drill engine reads it for this trial, as the drill runner converts it (drills/model.ts
 * `trialAnswerOf`): the steps marked on the rhythm grid of a "find the push" trial are the family's own cells
 * (`14` → `c14`), and a chromatic degree picked on its pad key is the asked spelling of that pitch (♭6 for ♯5).
 * Without these a right answer on the widget graded wrong in a checkpoint (U09.CP's bass and kick items).
 */
export function drillAnswer(a: Answer, expected?: Answer, trial?: Trial<unknown>): Answer {
  if (!trial) return a;
  if (a.choice && clickCellsOf(trial))
    return { ...a, ...clickCellAnswer(a.choice.map((c) => String(c).replace(/^c(?=\d+$)/, ""))) };
  if (trial.family === "fam.deg.fet-chromatic" && a.degrees && expected?.degrees)
    return { ...a, degrees: padAnswer(a.degrees, expected.degrees) };
  return a;
}

/** The drill response a family item is graded with (`gradeTrial`). */
export function familyResponse(
  response: AttemptResponse,
  rtMs: number,
  replays: number,
  /** Seconds from bar 1 of the stimulus to the response window (an echo is tapped after the stimulus). */
  responseAt = 0,
  /** The trial's expected answer: a typed answer of several parts ("C D E F G A B") is split to match it. */
  expected?: Answer,
  /** The trial itself: a tune written on the staff (melodic dictation from level 7) is graded as its code. */
  trial?: Trial<unknown>,
): TrialResponse {
  if ("answer" in response) {
    const a = drillAnswer(response.answer as Answer, expected, trial);
    const parts = expected?.text?.length ?? 1;
    if (a.text && a.text.length === 1 && parts > 1) {
      const split = (a.text[0] as string).split(/[\s,]+/).filter(Boolean);
      return { answer: { ...a, text: split }, rtMs, replays };
    }
    return { answer: a, rtMs, replays };
  }
  // A code answer (reading the staff into code) goes to the drill engine as text, as the drill runner sends it.
  if ("code" in response) return { answer: { text: [response.code.trim()] }, rtMs, replays };
  if ("staff" in response && trial) {
    const a = staffAnswer(trial, response.staff);
    return a ? { answer: a, rtMs, replays } : { skipped: true, rtMs, replays };
  }
  if ("taps" in response) return { taps: response.taps.map((t) => t - responseAt), rtMs, replays };
  // Wave 7 (`tap.lanes`, a polyrhythm item of R.CP): two lanes, each shifted to the response window; `taps` holds
  // both in time order for a family that grades one stream.
  const lanes = (response as { lanes?: unknown }).lanes;
  if (Array.isArray(lanes) && lanes.every((l) => Array.isArray(l))) {
    const shifted = (lanes as number[][]).map((l) => l.map((t) => t - responseAt));
    return { taps: shifted.flat().sort((a, b) => a - b), lanes: shifted, rtMs, replays } as TrialResponse;
  }
  return { skipped: true, rtMs, replays };
}

/** A per-skill line for the result: never a fail mark on a level-setting skill. */
export function skillLine(p: LocalScore["perSkill"][number]): {
  tone: "ok" | "look" | "level";
  text: string;
} {
  const pct = Math.round(p.mean * 100);
  if (p.role === "level-setting")
    return { tone: "level", text: `${pct}%: sets your practice level; it never holds you back` };
  return p.ok
    ? { tone: "ok", text: `${pct}%: solid` }
    : { tone: "look", text: `${pct}%: worth another look` };
}

/** The line under "All N items answered" when sung items were set aside (Quiet mode, contracts §8.5). */
export function quietNote(setAside: number): string | null {
  if (setAside <= 0) return null;
  return `${setAside === 1 ? "One sung item was" : `${setAside} sung items were`} set aside in Quiet mode. Singing never counts against a checkpoint.`;
}

/**
 * What a pass opens, by name ("Grit, Verse–Chorus Demo"), never by ID: lessons, checkpoints and capstones by their
 * syllabus titles; a capstone session as its capstone. An item the syllabus does not name is left out.
 */
export function openedText(ids: readonly string[], titles: ReadonlyMap<string, string>): string {
  const names = ids.map((id) => {
    const own = titles.get(id);
    if (own) return own;
    const m = /^(.+)\.S\d+$/.exec(id);
    return m ? (titles.get(m[1] as string) ?? null) : null;
  });
  return [...new Set(names.filter((n): n is string => n !== null))].join(", ");
}

/** The headline of the result screen (calm in every case; "not yet" is never "failed"). */
export function resultCopy(o: Pick<CheckpointOutcome, "passed" | "softPass">): {
  title: string;
  body: string;
} {
  if (o.passed)
    return {
      title: "Checkpoint passed",
      body: "The next lessons are open. Everything you showed here counts.",
    };
  if (o.softPass)
    return {
      title: "On you go",
      body: "The next lessons are open. A few skills are worth another look: they come back in your warm-ups and in the next checkpoint.",
    };
  return {
    title: "Not yet",
    // The plan itself is the "Your practice plan" callout under the skills: said once, there.
    body: "A few skills need more practice before the next lessons open. Studio and Practice stay open.",
  };
}

/** One advanced-track gate as a checkpoint outcome reports it (`CheckpointOutcome.gatesOpened`, contracts §4.3). */
type OpenedGate = NonNullable<CheckpointOutcome["gatesOpened"]>[number];

/** "Jazz", "Jazz and Rhythm", "Jazz, Rhythm and Sound". */
function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What a pass says about the advanced tracks it opened (contracts §2.6, §4.3; wave6.md §5.3): U13.CP opens the
 * Jazz and Rhythm tracks, U14.CP, and U17.CP a further part of Jazz. Said once, honestly: a track whose lessons
 * are not written yet is open and still being written, never offered as something to start; and never as a turn
 * off the road, the core goes on tomorrow either way. Tracks are named by their titles (`titles`: track ID →
 * title, from the syllabus), never by an ID; `null` when the pass opened none.
 */
export function tracksOpenedCopy(
  gates: readonly OpenedGate[] | undefined,
  titles: ReadonlyMap<string, string>,
): { title: string; body: string; authored: boolean } | null {
  const open = (gates ?? []).filter((g) => g.open);
  if (open.length === 0) return null;
  const firstTime = open.filter((g) => g.gateId.endsWith(".main"));
  const tracks = [...new Set((firstTime.length > 0 ? firstTime : open).map((g) => g.trackId))];
  // By title only: a track the syllabus does not name is not printed as its ID.
  const named = tracks
    .map((id) => titles.get(id))
    .filter((t): t is string => typeof t === "string" && t !== "")
    .map((t) => t.replace(/\s+track$/i, ""));
  const many = tracks.length > 1;
  const names = nameList(named);
  const authored = open.some((g) => g.lessonsAuthored > 0);
  const title =
    named.length === 0
      ? "New optional lessons are open"
      : firstTime.length > 0
        ? `The ${names} ${many ? "tracks are" : "track is"} open`
        : `More of the ${names} ${many ? "tracks" : "track"} is open`;
  const what =
    firstTime.length > 0
      ? `${many ? "They are optional side roads" : "It is an optional side road"} off the core`
      : "It is an optional part of that side road";
  const body = authored
    ? `${what}: ${firstTime.length > 0 && many ? "their" : "its"} lessons are on the course map whenever you want them. Your daily session stays on the core, and the next lesson is waiting as usual.`
    : `${what}, and ${firstTime.length > 0 && many ? "their" : "its"} first lessons are still being written. Nothing changes today: the core goes on with your next lesson.`;
  return { title, body, authored };
}

const KEY = (cpId: string, attemptNo: number) => `oak.checkpoint.${cpId}.${attemptNo}`;

/** Answers given so far, kept in this browser so a reload resumes the attempt (the server holds the items). */
export function loadRecords(cpId: string, attemptNo: number): ItemRecord[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY(cpId, attemptNo));
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? (v as ItemRecord[]) : [];
  } catch {
    return [];
  }
}
export function saveRecords(cpId: string, attemptNo: number, records: readonly ItemRecord[]): void {
  try {
    globalThis.localStorage?.setItem(KEY(cpId, attemptNo), JSON.stringify(records));
  } catch {
    // Storage unavailable: the attempt still works, it just cannot resume after a reload.
  }
}
/**
 * Whether this browser holds saved answers of any attempt at `cpId`. The server knows an attempt is pending, but
 * its answers live here only: a pending attempt with none here starts again from item 1, and the intro says so.
 */
export function hasSavedRecords(cpId: string): boolean {
  try {
    const store = globalThis.localStorage;
    if (!store) return false;
    const prefix = `oak.checkpoint.${cpId}.`;
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k?.startsWith(prefix)) continue;
      const v = JSON.parse(store.getItem(k) ?? "[]") as unknown;
      if (Array.isArray(v) && v.length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}
export function clearRecords(cpId: string, attemptNo: number): void {
  try {
    globalThis.localStorage?.removeItem(KEY(cpId, attemptNo));
  } catch {
    // ignore
  }
}

/**
 * The footer's count and the review's title. A skipped item is not "answered": after skipping every item the
 * footer read "25 of 26 answered" and the review "All 26 items answered".
 */
export function progressLine(records: readonly Pick<ItemRecord, "skipped">[], total: number): string {
  const skipped = records.filter((r) => r.skipped).length;
  const answered = records.length - skipped;
  return `${answered} of ${total} answered${skipped > 0 ? `, ${skipped} skipped` : ""}`;
}

/** The checkpoint's state as a word on the intro's chip (never the raw status ID). */
export function statusWord(status: string | null | undefined): string {
  if (status === "passed" || status === "soft-passed") return "Passed";
  if (status === "failed") return "Not yet";
  if (status === "open") return "Ready";
  return "Locked";
}

export function reviewTitle(records: readonly Pick<ItemRecord, "skipped">[], total: number): string {
  const skipped = records.filter((r) => r.skipped).length;
  if (skipped === 0) return `All ${total} items answered`;
  const answered = records.length - skipped;
  return `${answered} of ${total} items answered, ${skipped} skipped`;
}

// --- Try again before hand-in (docs/design/retry.md §3.2, contracts §7.6) -------------------------------------

/**
 * Saving an item: the new answer replaces the item's last one (one record per item, the last saved counts). Once
 * the attempt is handed in nothing in it changes: the retry of a checkpoint is the retake, with new items.
 */
export function recordItem(records: readonly ItemRecord[], r: ItemRecord, handedIn = false): ItemRecord[] {
  if (handedIn) return [...records];
  return [...records.filter((x) => x.idx !== r.idx), r];
}

/** What "Hand it in" sends per item of the attempt: its last saved answer, or skipped when it has none. */
export function handInItems(
  items: readonly { idx: number }[],
  records: readonly ItemRecord[],
): { idx: number; score: number; skipped: boolean; response: AttemptResponse; result: GradeResult | null }[] {
  const rec = new Map(records.map((r) => [r.idx, r]));
  return items.map((it) => {
    const r = rec.get(it.idx);
    return {
      idx: it.idx,
      score: r?.score ?? 0,
      skipped: r?.skipped ?? true,
      response: r?.response ?? { skipped: true },
      result: r?.result ?? null,
    };
  });
}

/** An item as the review lists it: answered (it can be changed), skipped or not reached (it can be answered). */
export function itemState(r: Pick<ItemRecord, "skipped"> | undefined): "answered" | "skipped" | "open" {
  if (!r) return "open";
  return r.skipped ? "skipped" : "answered";
}
