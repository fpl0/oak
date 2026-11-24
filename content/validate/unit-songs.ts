// Content validation of the unit songs (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §8), shared by
// content/validate/unit-songs.test.ts and `bun run content:check` (section 16, "Unit song", for a lesson in a song).
//
// - `checkSong`: Oak's song in every flavour evaluates, is not silent, lints in profile `band`, carries exactly its
//   parts in its sections and form, and agrees with the other flavours on the tune, the bass downbeats and the chord
//   roots; its tune and bass hold no note a half step from a chord tone (AUTHORING §13); ids, terms and the ledger.
// - `checkSongStep`: a take's Make is in the song's meter and in the key of every section it plays in; its reference
//   code (the Make's first passing test) plays only parts the step lists, and does not clash with the Oak parts it
//   keeps; `startFrom` opens with code that lints and plays here and does not already meet today's required rule; the
//   `today` line (and a side step's `reason`) passes the voice and terms checks of the lesson.
// - `checkPlanCoverage`: each lesson of the unit once, in syllabus order; `releaseAfter` exists and comes after the
//   last take.
//
// Grading is untouched (spec §4.1): the reference is graded against today's Make exactly as the lesson grades it.
// The song is placed the way the composer places a take (spec §5.2): a loop restarts at the start of each section it
// owns; a reference with `arrange()` maps its sections onto the song's by type. This file reads events, so it does
// not depend on the composer in @oak/strudel.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CellKey,
  claimsOf,
  type Exercise,
  FLAVOUR_IDS,
  type FlavourId,
  type KeySpec,
  type LessonDef,
  type LessonId,
  type MeterId,
  partOfDrumSound,
  partOfTrack,
  R,
  type SessionId,
  type SongPartId,
  type SongSectionId,
  stepSectionIds,
  type TakeoverStep,
  type TakeStep,
  type TermEntry,
  type TestCase,
  type UnitSongDef,
  type UnitSongSection,
  unitSongSchema,
} from "@oak/content-kit";
import { SILENT_GAIN, sectionsFromAst } from "@oak/grader";
import type { HeadlessEvent } from "@oak/grader/testing";
import { identifyChord, METERS, type Pc, triadQuality } from "@oak/theory";
import { checkpointMetas } from "../checkpoints.ts";
import { courseGraph, registries } from "../index.ts";
import { atOrBefore } from "../lib/course.ts";
import { CONTENT_ROOT } from "../lib/load.bun.ts";
import { termById } from "../terms.ts";
import { songStepOf } from "../unit-songs/index.ts";
import { plain, voiceIssues } from "./authoring.ts";
import type { CheckSection } from "./checks.ts";
import { BAD_LOG, type EvalOutcome, evaluate, grade, lint, normalizedCode } from "./harness.ts";

/** What a check found. `advice` is printed by `content:check` and never fails a song (a music review reads it). */
export type SongIssueCode =
  | "usong.schema"
  | "usong.ids"
  | "usong.eval"
  | "usong.silent"
  | "usong.tracks"
  | "usong.sections"
  | "usong.form"
  | "usong.lint"
  | "usong.clash"
  | "usong.flavour-notes"
  | "usong.flavour-roots"
  | "usong.flavour-chords"
  | "usong.make"
  | "usong.meter"
  | "usong.key"
  | "usong.reference"
  | "usong.parts"
  | "usong.start-from"
  | "usong.start-passes"
  | "usong.voice"
  | "usong.terms"
  | "usong.plan"
  | "usong.release";

export interface SongIssue {
  code: SongIssueCode;
  severity: "error" | "advice";
  /** `usong.U02 flavour.funk`, `usong.U02 plan U02.L03 today`. */
  where: string;
  message: string;
}
/** The plan's name for it (docs/superpowers/plans/2026-11-24-unit-songs.md, Task 6). */
export type Issue = SongIssue;

type Role = "drums" | "bass" | "chords" | "melody";

// --- the song's layout and Oak's code -------------------------------------------------------------

interface Placed {
  section: UnitSongSection;
  start: number;
}
const layoutOf = (def: UnitSongDef): Placed[] => {
  let start = 0;
  return def.sections.map((section) => {
    const out = { section, start };
    start += section.bars;
    return out;
  });
};
const totalBars = (def: UnitSongDef): number => def.sections.reduce((n, s) => n + s.bars, 0);
const sameKey = (a: KeySpec, b: KeySpec): boolean => a.tonic === b.tonic && a.mode === b.mode;
const keyName = (k: KeySpec): string => `${k.tonic} ${k.mode}`;
/** The beats a note must last to count as held (as the course's "music over the Band" scan counts them). */
const beatsOf = (meter: MeterId): number => Number(meter.split("/")[0]);

/** Oak's code for one flavour as it plays: the song's tempo line first (Oak's code carries none, spec §5.1). */
export function songCode(def: UnitSongDef, flavour: FlavourId): string {
  return `setcpm(${def.bpm}/${METERS[def.meter].unitsPerBar})\n\n${def.code[flavour] ?? ""}`;
}

/** Each flavour of a song evaluated once per process, whole (checkSong and every step's clash scan share it). */
const songEvals = new Map<string, Promise<EvalOutcome>>();
function evalSong(def: UnitSongDef, flavour: FlavourId): Promise<EvalOutcome> {
  const code = songCode(def, flavour);
  const key = `${totalBars(def)}\u0000${code}`;
  let p = songEvals.get(key);
  if (!p) {
    p = evaluate(code, totalBars(def));
    songEvals.set(key, p);
  }
  return p;
}

/** A track's statement: the line that starts `<label>:` and the indented lines after it. */
function trackText(code: string, label: string): string | null {
  const lines = code.split("\n");
  const head = new RegExp(`^${label}\\s*:(?!:)`);
  for (let i = 0; i < lines.length; i++) {
    if (!head.test(lines[i] as string)) continue;
    let text = lines[i] as string;
    for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j] as string); j++) text += `\n${lines[j]}`;
    return text;
  }
  return null;
}

/** The section const each `[bars, const]` entry of a track's `arrange()` names (`silence` where it rests). */
function arrangedConsts(track: string): string[] | null {
  const at = track.indexOf("arrange(");
  if (at < 0) return null;
  const names: string[] = [];
  let paren = 1;
  let bracket = 0;
  let start = -1;
  for (let i = at + "arrange(".length; i < track.length && paren > 0; i++) {
    const c = track[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < track.length && track[i] !== c; i++) if (track[i] === "\\") i++;
      continue;
    }
    if (c === "(") paren++;
    else if (c === ")") paren--;
    else if (c === "[") {
      if (paren === 1 && bracket === 0) start = i + 1;
      bracket++;
    } else if (c === "]") {
      bracket--;
      if (paren === 1 && bracket === 0 && start >= 0) {
        const body = track.slice(start, i);
        names.push(body.slice(body.indexOf(",") + 1).trim());
        start = -1;
      }
    }
  }
  return names;
}

// --- notes and the clash rule ----------------------------------------------------------------------

/** A pitched note in song time (bars from the start of the song). */
interface Sounding {
  /** The part it belongs to (Oak's) or the learner's track label. */
  owner: string;
  role: Role | null;
  begin: number;
  end: number;
  midi: number;
}

const rat = (s: string): number => {
  const [a, b] = s.split("/").map(Number);
  return b ? (a as number) / b : (a as number);
};
const NAMES = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
const noteName = (m: number): string => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
const EPS = 1e-9;

function placeOf(def: UnitSongDef, t: number, beats: number): string {
  const bar = Math.floor(t + EPS);
  const beat = Math.round((t - bar) * beats * 1000) / 1000 + 1;
  const sec = layoutOf(def).find((p) => bar >= p.start && bar < p.start + p.section.bars);
  return `bar ${bar + 1} beat ${beat}${sec ? ` (${sec.section.id})` : ""}`;
}
/** Where a clash recurs: the first few places, then how many more. */
const placesOf = (places: readonly string[]): string =>
  places.length <= 3 ? places.join(", ") : `${places.slice(0, 3).join(", ")} and ${places.length - 3} more`;

/** Groups repeats of one clash (the same two notes, over and over in a loop) into one line, keeping every place. */
class ClashLog {
  private readonly groups = new Map<
    string,
    { head: string; flavours: Set<string>; places: string[]; severity: SongIssue["severity"] }
  >();
  add(head: string, flavour: string, place: string, severity: SongIssue["severity"]): void {
    const g = this.groups.get(head) ?? { head, flavours: new Set(), places: [], severity };
    g.flavours.add(flavour);
    if (!g.places.includes(place)) g.places.push(place);
    this.groups.set(head, g);
  }
  issues(where: string): SongIssue[] {
    return [...this.groups.values()].map((g) => ({
      code: "usong.clash",
      severity: g.severity,
      where: `${where} ${[...g.flavours].join(" ")}`,
      message: `${g.head}, at ${placesOf(g.places)}`,
    }));
  }
}

/**
 * The AUTHORING §13 clash: a note of `lines` held a beat or more while a note of `against` sounds with it, the upper
 * of the two a half step (or a half step and octaves) above the lower: a minor second or ninth, the harshest clash
 * there is. A major seventh (a half step below, an octave away) is a colour, not a clash.
 */
function clashes(
  lines: readonly Sounding[],
  against: readonly Sounding[],
  beats: number,
): { line: Sounding; with: Sounding }[] {
  const out: { line: Sounding; with: Sounding }[] = [];
  for (const n of lines) {
    if ((n.end - n.begin) * beats < 1 - EPS) continue;
    for (const x of against)
      if (x.begin < n.end - EPS && x.end > n.begin + EPS && Math.abs(n.midi - x.midi) % 12 === 1)
        out.push({ line: n, with: x });
  }
  return out;
}

/**
 * Whether an event is heard at all, by the grader's convention (normalize/nevent.ts `isAudible`): its effective gain,
 * `(gain ?? 0.8) · velocity · postgain`, is above `SILENT_GAIN`. `.gain(0)`, `.velocity(0)` or `.postgain(0)` still
 * makes events, and none of them is music.
 */
function heard(e: HeadlessEvent): boolean {
  const num = (k: string): number | undefined => {
    const v = e.value[k];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };
  return (num("gain") ?? 0.8) * (num("velocity") ?? 1) * (num("postgain") ?? 1) > SILENT_GAIN;
}

/** Oak's pitched notes in one flavour, by part, from the evaluated song (heard ones only). */
function oakNotes(def: UnitSongDef, events: readonly HeadlessEvent[]): Sounding[] {
  const byLabel = new Map(def.parts.map((p) => [p.label, p] as const));
  const out: Sounding[] = [];
  for (const e of events) {
    if (!heard(e)) continue;
    const part = byLabel.get(e.track);
    if (!part || part.role === "drums" || e.midi === null) continue;
    out.push({
      owner: part.id,
      role: part.role === "pad" ? "chords" : part.role,
      begin: rat(e.begin),
      end: rat(e.end),
      midi: e.midi,
    });
  }
  return out;
}

// --- checkSong -----------------------------------------------------------------------------------

/** The ID ledger (content/ids.lock.json), read once. */
let ledger: Set<string> | null = null;
function ledgerIds(): Set<string> {
  if (!ledger) {
    const file = join(CONTENT_ROOT, "ids.lock.json");
    const lock = existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as { ids: { id: string; retiredAt?: string }[] })
      : { ids: [] };
    ledger = new Set(lock.ids.filter((e) => !e.retiredAt).map((e) => e.id));
  }
  return ledger;
}
const lessonIds = (): Set<string> =>
  new Set(registries.syllabus.units.flatMap((u) => u.lessons.map((l) => l.id as string)));

/** What a flavour plays, bar by bar, for the comparison across flavours (spec §5.1). */
interface FlavourView {
  /** The tune's pitches in each bar, in order. */
  lead: number[][];
  /** The pitch class of the bass note sounding on each downbeat (`null` while the bass rests). */
  bass: (number | null)[];
  /**
   * The chords that start in each bar, in order, repeats merged: root and triad (`C`, `Cm`), so a flavour may colour
   * a chord with a sixth, a seventh or a ninth (spec §5.1) but not change its root or its function.
   */
  chords: string[][];
}
function flavourView(def: UnitSongDef, notes: readonly Sounding[]): FlavourView {
  const bars = totalBars(def);
  const lead: number[][] = Array.from({ length: bars }, () => []);
  const bass: (number | null)[] = Array.from({ length: bars }, () => null);
  const chords: string[][] = Array.from({ length: bars }, () => []);
  const sorted = [...notes].sort((a, b) => a.begin - b.begin || a.midi - b.midi);
  const bassNotes = sorted.filter((n) => n.role === "bass");
  const bassAt = (t: number): number | null => {
    const sounding = bassNotes.filter((n) => n.begin <= t + EPS && n.end > t + EPS).map((n) => n.midi);
    return sounding.length ? Math.min(...sounding) : null;
  };
  for (const n of sorted) {
    const bar = Math.floor(n.begin + EPS);
    if (bar >= 0 && bar < bars && n.role === "melody") lead[bar]?.push(n.midi);
  }
  for (let b = 0; b < bars; b++) {
    const m = bassAt(b);
    bass[b] = m === null ? null : ((m % 12) + 12) % 12;
  }
  const groups = new Map<number, number[]>();
  for (const n of sorted.filter((x) => x.role === "chords")) {
    const key = Math.round(n.begin * 1e6) / 1e6;
    groups.set(key, [...(groups.get(key) ?? []), n.midi]);
  }
  for (const [t, midis] of [...groups].sort((a, b) => a[0] - b[0])) {
    const bar = Math.floor(t + EPS);
    if (bar < 0 || bar >= bars) continue;
    const b = bassAt(t);
    const best = identifyChord(midis, b === null ? undefined : { bassPc: (((b % 12) + 12) % 12) as Pc })[0];
    const list = chords[bar] as string[];
    const name = best ? chordName(best.rootPc, triadQuality(best.quality)) : null;
    if (name !== null && list[list.length - 1] !== name) list.push(name);
  }
  return { lead, bass, chords };
}

const PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const pcName = (pc: number | null | undefined): string =>
  pc === null || pc === undefined ? "nothing" : (PC_NAMES[pc] as string);
const TRIAD_SUFFIX: Record<ReturnType<typeof triadQuality>, string> = {
  maj: "",
  min: "m",
  dim: "dim",
  aug: "aug",
  sus2: "sus2",
  sus4: "sus4",
};
/** A chord by root and triad: "C", "Am", "Bdim". */
const chordName = (pc: number, triad: ReturnType<typeof triadQuality>): string =>
  `${pcName(pc)}${TRIAD_SUFFIX[triad]}`;

/**
 * Every item under "For every song" in spec §8: each flavour evaluates (with the song's tempo line), is not silent,
 * plays exactly its parts' tracks, has events in every section each part plays, reads as the song's form, lints in
 * profile `band` (locked tools allowed); its tune and bass hold no note a half step from a chord tone; every flavour
 * plays the first flavour's tune pitches, bass downbeat roots and chord roots; the schema, the ids, the terms and the
 * ledger are valid.
 */
export async function checkSong(def: UnitSongDef): Promise<SongIssue[]> {
  const out: SongIssue[] = [];
  const add = (
    code: SongIssueCode,
    where: string,
    message: string,
    severity: SongIssue["severity"] = "error",
  ) => out.push({ code, severity, where: where ? `${def.id} ${where}` : def.id, message });

  const parsed = unitSongSchema.safeParse(def);
  if (!parsed.success) for (const i of parsed.error.issues) add("usong.schema", i.path.join("."), i.message);

  // Ids, terms and the ledger.
  if (!ledgerIds().has(def.id))
    add("usong.ids", "", `${def.id} is not in content/ids.lock.json (run bun run content:build)`);
  for (const p of def.parts)
    if (p.termId && !termById.has(p.termId))
      add("usong.ids", `part ${p.id}`, `term ${p.termId} is not in content/terms.ts`);
  const known = lessonIds();
  for (const s of def.plan)
    if (!known.has(s.lesson))
      add("usong.ids", `plan ${s.lesson}`, `${s.lesson} is not in content/syllabus.ts`);

  const layout = layoutOf(def);
  const beats = beatsOf(def.meter);
  const session = (def.plan[0]?.lesson ?? `${def.unit}.L01`) as SessionId;
  const labels = def.parts.map((p) => p.label);
  const views = new Map<FlavourId, FlavourView>();
  const clashLog = new ClashLog();

  for (const f of FLAVOUR_IDS) {
    if (typeof def.code[f] !== "string") continue; // the schema said so
    const code = songCode(def, f);
    const r = await evalSong(def, f);
    if (!r.ok) {
      add("usong.eval", f, `does not evaluate: ${r.error}`);
      continue;
    }
    const bad = r.logs.filter((l) => BAD_LOG.test(l));
    if (bad.length) add("usong.eval", f, `Strudel says: ${bad.join(" | ")}`);
    // Only what is heard counts: a track at gain 0 still makes events.
    const sounding = r.events.filter(heard);
    if (sounding.length === 0) {
      add("usong.silent", f, "plays nothing anyone can hear");
      continue;
    }

    // Exactly one track per part, named by its label.
    const tracks = [...r.tracks].sort().join(" ");
    if (tracks !== [...labels].sort().join(" "))
      add(
        "usong.tracks",
        f,
        `plays the tracks [${tracks}]; the song's parts are [${[...labels].sort().join(" ")}]`,
      );

    // Every part sounds in every section its arrange() gives it a const.
    for (const part of def.parts) {
      const text = trackText(def.code[f] ?? "", part.label);
      const consts = text === null ? null : arrangedConsts(text);
      if (consts === null || consts.length !== layout.length) continue; // the schema reports it
      layout.forEach(({ section, start }, i) => {
        if (consts[i] === "silence") return;
        const sounds = sounding.some(
          (e) => e.track === part.label && e.onset >= start - EPS && e.onset < start + section.bars - EPS,
        );
        if (!sounds)
          add(
            "usong.sections",
            f,
            `"${part.label}:" plays ${consts[i]} in ${section.id} (bars ${start + 1}–${start + section.bars}), and nothing sounds there`,
          );
      });
    }

    // The form the Workbench reads (`sectionsFromAst`) is the song's.
    const form = sectionsFromAst(code);
    if (form === null) add("usong.form", f, "no arrange() the Workbench can read the form from");
    else if ("inconsistent" in form)
      add("usong.form", f, `${form.inconsistent.track}: ${form.inconsistent.detail}`);
    else {
      const got = form.sections.map((s) => `${s.label} ${s.bars}`).join(", ");
      const want = def.sections.map((s) => `${s.type} ${s.bars}`).join(", ");
      const same =
        form.sections.length === def.sections.length &&
        form.sections.every(
          (s, i) =>
            s.bars === def.sections[i]?.bars && (s.label === def.sections[i]?.type || s.label === "rest"),
        );
      if (!same) add("usong.form", f, `reads as [${got}]; the song's sections are [${want}]`);
    }

    // The band lint, as a preview context (locked tools allowed), in the song's meter and key.
    for (const d of lint(code, {
      session,
      meter: def.meter,
      key: def.key,
      allowPreview: true,
      profile: "band",
    }).diagnostics)
      if (d.severity === "error") add("usong.lint", f, `line ${d.line} ${d.id}: ${d.message}`);

    // The tune and the bass hold no note a half step from a chord tone.
    const notes = oakNotes(def, r.events);
    const lines = notes.filter((n) => n.role === "melody" || n.role === "bass");
    const harmony = notes.filter((n) => n.role === "chords");
    for (const c of clashes(lines, harmony, beats))
      clashLog.add(
        `the ${c.line.owner} holds ${noteName(c.line.midi)} against ${noteName(c.with.midi)} in the ${c.with.owner}, a half step apart`,
        f,
        placeOf(def, c.line.begin, beats),
        "error",
      );
    views.set(f, flavourView(def, notes));
  }
  out.push(...clashLog.issues(def.id));

  // Every flavour plays the same tune, bass downbeats and chord roots (spec §5.1, §10a call 6). Each bar is compared
  // with what most flavours play there, so the flavour that strays is the one named.
  const where = (bar: number) => placeOf(def, bar, beats).replace(/ beat 1\b/, "");
  const aspects: {
    code: SongIssueCode;
    of: (v: FlavourView, bar: number) => string;
    say: (value: string, bar: number) => string;
  }[] = [
    {
      code: "usong.flavour-notes",
      of: (v, b) => (v.lead[b] ?? []).map(noteName).join(" "),
      say: (x, b) => `the tune plays [${x}] in ${where(b)}`,
    },
    {
      code: "usong.flavour-roots",
      of: (v, b) => pcName(v.bass[b]),
      say: (x, b) => `the bass plays ${x} on the downbeat of ${where(b)}`,
    },
    {
      code: "usong.flavour-chords",
      of: (v, b) => (v.chords[b] ?? []).join(" "),
      say: (x, b) => `the chords in ${where(b)} are [${x}]`,
    },
  ];
  const flavours = [...views.keys()];
  for (const aspect of aspects) {
    const reported = new Set<FlavourId>();
    for (let b = 0; b < totalBars(def) && flavours.length > 1; b++) {
      const values = flavours.map((f) => aspect.of(views.get(f) as FlavourView, b));
      const counts = new Map<string, number>();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      // The value most flavours play (a tie goes to the first flavour's).
      let common = values[0] as string;
      for (const [v, n] of counts) if (n > (counts.get(common) ?? 0)) common = v;
      flavours.forEach((f, i) => {
        if (values[i] === common || reported.has(f)) return;
        reported.add(f);
        const others = flavours.filter((_, j) => values[j] === common);
        add(
          aspect.code,
          f,
          `${aspect.say(values[i] as string, b)}; ${others.join(", ")} ${others.length > 1 ? "play" : "plays"} [${common}] there`,
        );
      });
    }
  }
  return out;
}

// --- checkPlanCoverage ---------------------------------------------------------------------------

/**
 * The plan lists each lesson of the unit exactly once, in syllabus order; `releaseAfter` names a lesson or a
 * checkpoint of the course that comes after the last take step (in the plan, or in every legal order).
 */
export function checkPlanCoverage(def: UnitSongDef): SongIssue[] {
  const out: SongIssue[] = [];
  const add = (code: SongIssueCode, where: string, message: string) =>
    out.push({ code, severity: "error", where: where ? `${def.id} ${where}` : def.id, message });
  const unit = registries.syllabus.units.find((u) => u.id === def.unit);
  const got = def.plan.map((s) => s.lesson as string);
  if (!unit) add("usong.plan", "plan", `${def.unit} is not a unit of the syllabus`);
  else {
    const want = unit.lessons.map((l) => l.id as string);
    for (const id of want) if (!got.includes(id)) add("usong.plan", "plan", `${id} is not in the plan`);
    for (const id of new Set(got)) {
      if (!want.includes(id)) add("usong.plan", "plan", `${id} is not a lesson of ${def.unit}`);
      const n = got.filter((x) => x === id).length;
      if (n > 1) add("usong.plan", "plan", `${id} is in the plan ${n} times`);
    }
    const order = got.filter((id) => want.includes(id));
    const wrong = order.findIndex(
      (id, i) => i > 0 && want.indexOf(id) < want.indexOf(order[i - 1] as string),
    );
    if (wrong > 0)
      add(
        "usong.plan",
        "plan",
        `${order[wrong]} comes after ${order[wrong - 1]}; the syllabus order is ${want.join(" ")}`,
      );
  }

  const release = def.releaseAfter as string;
  const exists = lessonIds().has(release) || checkpointMetas.some((c) => c.id === release);
  if (!exists) add("usong.release", "releaseAfter", `${release} is not a lesson or checkpoint of the course`);
  const lastTake = def.plan.findLastIndex((s) => s.kind === "take");
  const last = def.plan[lastTake]?.lesson as string | undefined;
  if (exists && last) {
    const inPlan = got.indexOf(release);
    if (inPlan >= 0) {
      if (inPlan < lastTake)
        add("usong.release", "releaseAfter", `${release} comes before the last take, ${last}`);
    } else {
      const g = courseGraph();
      if (
        g.nodes.has(release as SessionId) &&
        g.nodes.has(last as SessionId) &&
        !atOrBefore(g, last as SessionId, release as SessionId)
      )
        add(
          "usong.release",
          "releaseAfter",
          `${release} can be complete before the last take, ${last}, in some legal order`,
        );
    }
  }
  return out;
}

// --- checkSongStep -------------------------------------------------------------------------------

/** A lesson's definition by its id, from its folder (content/core/<UNIT>/Lnn, content/advanced/<UNIT>/Lnn). */
const lessonDefs = new Map<string, Promise<LessonDef | null>>();
export function loadLessonDef(id: LessonId): Promise<LessonDef | null> {
  let p = lessonDefs.get(id);
  if (!p) {
    const m = /^([A-Z][A-Z0-9]*?\d+)\.(L\d{2})$/.exec(id);
    const file = m
      ? join(
          CONTENT_ROOT,
          (m[1] as string).startsWith("U") ? "core" : "advanced",
          m[1] as string,
          m[2] as string,
          "lesson.ts",
        )
      : null;
    p =
      file && existsSync(file)
        ? import(file).then(
            (mod: { default?: LessonDef }) => mod.default ?? null,
            () => null,
          )
        : Promise.resolve(null);
    lessonDefs.set(id, p);
  }
  return p;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A term as running text has it, plurals included (AUTHORING §7, as content/validate/authoring.ts reads terms). */
const termRe = (t: TermEntry) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t.term)}(s|es)?(?![\\p{L}\\p{N}])`, "iu");

/**
 * The terms a learner has not met when a line about this lesson is read (on Today and on the lesson card, before the
 * lesson begins): the lesson's own and every later one. Later is later in the default order; for a lesson outside it
 * (a side or track lesson), a term is met only when its lesson comes before this one in every legal order.
 */
function untaughtTerms(lessonId: string): TermEntry[] {
  const order = registries.syllabus.defaultOrder as readonly string[];
  const here = order.indexOf(lessonId);
  const g = courseGraph();
  const before = (by: string) =>
    g.nodes.has(by as SessionId) &&
    g.nodes.has(lessonId as SessionId) &&
    atOrBefore(g, by as SessionId, lessonId as SessionId);
  return registries.terms.filter((t) => {
    if (t.introducedBy === lessonId) return true;
    const at = order.indexOf(t.introducedBy);
    if (here >= 0 && at >= 0) return at > here;
    return !before(t.introducedBy);
  });
}

/** AUTHORING §5 voice and §7 terms for a line the app shows before the lesson (a `today` line, a side reason). */
function lineIssues(text: string, where: string, lessonId: string, maxWords?: number): SongIssue[] {
  const out: SongIssue[] = [];
  for (const v of voiceIssues([{ where, text, before: true }]))
    out.push({ code: "usong.voice", severity: "error", where, message: v.slice(where.length + 2) });
  const words = plain(text)
    .split(" ")
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  if (maxWords !== undefined && words > maxWords)
    out.push({
      code: "usong.voice",
      severity: "error",
      where,
      message: `${words} words; at most ${maxWords}`,
    });
  const read = plain(text);
  for (const t of untaughtTerms(lessonId))
    if (termRe(t).test(read))
      out.push({
        code: "usong.terms",
        severity: "error",
        where,
        message: `"${t.term}" is ${t.introducedBy === lessonId ? "this lesson's term" : `a term of ${t.introducedBy}`}, and this line is read before ${lessonId} begins: say it in words the learner has`,
      });
  return out;
}

/** A Make's reference code (spec §8): its first passing test's code. */
function referenceOf(make: Exercise): string | null {
  for (const t of make.tests)
    if (t.expect === "pass" && "code" in t.response && typeof t.response.code === "string")
      return t.response.code;
  return null;
}
const makeOf = (lesson: LessonDef): Extract<Exercise, { kind: "code-make" }> | null => {
  const ex = lesson.steps[lesson.steps.length - 1]?.exercise;
  return ex?.kind === "code-make" ? ex : null;
};

/** What a code plays, read as the grader reads it: its parts, whether it plays chords, and its pitched notes. */
interface Reading {
  played: Set<SongPartId>;
  playsChords: boolean;
  /** Drum sounds no drum part of the song owns. */
  unowned: Set<string>;
  pitched: Sounding[];
  /** The code's own `arrange()` sections, or `null` for a loop. */
  sections: { label: string; tag: string; bars: number; startBar: number }[] | null;
}

export interface StepCheckOptions {
  /** Where an earlier lesson of the plan comes from (`startFrom`); default: its lesson.ts on disk. */
  lessonOf?: (id: LessonId) => Promise<LessonDef | null | undefined>;
}

/**
 * Every item under "For every plan" in spec §8, for one step of the song's plan and its lesson. A side step: its
 * `reason` passes the voice and terms checks. A take step: its Make is in the song's meter and in the key of every
 * section it plays in; its reference code (the first passing test) plays no part the step does not list, and no drum
 * sound no part owns; a reference with `arrange()` names only the song's section kinds; placed in the song, it
 * clashes with no Oak part it keeps (`oakKeeps`; a clash with another Oak part that keeps playing is advice);
 * `startFrom` names an earlier take whose reference lints and plays at this lesson and does not already meet today's
 * required rule; `today` passes the voice and terms checks.
 */
export async function checkSongStep(
  def: UnitSongDef,
  step: TakeoverStep,
  lesson: LessonDef,
  opts: StepCheckOptions = {},
): Promise<SongIssue[]> {
  const out: SongIssue[] = [];
  const at = `${def.id} plan ${step.lesson}`;
  const add = (code: SongIssueCode, message: string, severity: SongIssue["severity"] = "error", where = at) =>
    out.push({ code, severity, where, message });
  if (lesson.id !== step.lesson) add("usong.plan", `checked against ${lesson.id}, not ${step.lesson}`);
  if (step.kind === "side") {
    out.push(...lineIssues(step.reason, `${at} reason`, step.lesson));
    return out;
  }
  out.push(...lineIssues(step.today, `${at} today`, step.lesson, 20));

  const make = makeOf(lesson);
  if (!make) {
    add("usong.make", `${lesson.id} has no code Make for the song to take`);
    return out;
  }
  const meter = make.meter ?? lesson.meter;
  const key = make.key ?? lesson.key;
  if (meter !== def.meter) add("usong.meter", `the Make is in ${meter}; the song is in ${def.meter}`);

  const byId = new Map(def.parts.map((p) => [p.id, p] as const));
  const sections = stepSectionIds(def, step);
  const layout = new Map(layoutOf(def).map((p) => [p.section.id, p] as const));
  const code = referenceOf(make);
  const reading = code === null ? null : await readCode(def, code, meter, key, sections, make);
  if (code === null) add("usong.reference", "the Make has no passing test with code to read the take from");
  else if (typeof reading === "string") add("usong.reference", reading);

  // The key of every section the take plays in, when the take is pitched. A reference with its own arrange() fills
  // only the song sections of the types it names (spec §5.2); the others keep their owner, and their key.
  const pitched =
    step.parts.some((p) => byId.get(p)?.role !== "drums") ||
    (reading !== null && typeof reading !== "string" && reading.pitched.length > 0);
  const named =
    reading !== null && typeof reading !== "string" && reading.sections !== null
      ? new Set(reading.sections.map((s) => s.label))
      : null;
  const fills =
    named === null ? sections : sections.filter((id) => named.has(layout.get(id)?.section.type ?? ""));
  if (pitched)
    for (const id of fills) {
      const k = layout.get(id)?.section.key ?? def.key;
      if (!sameKey(k, key)) add("usong.key", `the Make is in ${keyName(key)}; ${id} is in ${keyName(k)}`);
    }

  if (reading !== null && typeof reading !== "string") {
    // parts ⊇ what the reference plays; every drum sound it plays belongs to a part.
    for (const p of def.parts)
      if (reading.played.has(p.id) && !step.parts.includes(p.id))
        add(
          "usong.parts",
          `the reference code plays the ${p.id} part (${p.name.toLowerCase()}), which parts [${step.parts.join(" ")}] does not list`,
        );
    for (const s of reading.unowned)
      add("usong.parts", `the reference code plays "${s}", which no drum part's sounds own`);

    // A learner arrange() maps onto the song's sections by kind (spec §5.2, from U09.L02).
    const kinds = new Set(def.sections.map((s) => s.type));
    for (const s of reading.sections ?? [])
      if (s.label !== "rest" && !kinds.has(s.label))
        add(
          "usong.form",
          `the reference's arrange() has a ${s.label} section; the song has none to map it onto`,
        );

    out.push(...(await stepClashes(def, step, reading, sections, at)));
  }

  if (step.startFrom !== "oak")
    out.push(...(await startFromIssues(def, step, lesson, make, meter, key, opts, at)));
  return out;
}

/** Reads a reference code; a string is the reason it cannot be read. */
async function readCode(
  def: UnitSongDef,
  code: string,
  meter: MeterId,
  key: KeySpec,
  sections: readonly SongSectionId[],
  make: Extract<Exercise, { kind: "code-make" }>,
): Promise<Reading | string> {
  const form = sectionsFromAst(code);
  if (form && "inconsistent" in form)
    return `the reference's arrange() does not read: ${form.inconsistent.track}: ${form.inconsistent.detail}`;
  const arranged = form && "sections" in form ? form.sections : null;
  const longest = Math.max(1, ...sections.map((id) => def.sections.find((s) => s.id === id)?.bars ?? 1));
  const bars = Math.min(
    64,
    arranged ? (form as { totalBars: number }).totalBars : Math.max(longest, make.bars[1]),
  );
  const r = await normalizedCode(code, { meter, key, bars });
  if (!r.ok) return `the reference code does not evaluate: ${r.error}`;
  const roleOf = new Map<string, Role>();
  for (const [role, track] of Object.entries(r.n.roles)) if (track) roleOf.set(track, role as Role);
  const played = new Set<SongPartId>();
  const unowned = new Set<string>();
  const pitched: Sounding[] = [];
  let playsChords = false;
  for (const e of r.n.all) {
    if (e.midi === null) {
      if (!e.s) continue;
      const part = partOfDrumSound(def, e.s);
      if (part) played.add(part);
      else if (e.drum) unowned.add(e.s);
      continue;
    }
    const role = roleOf.get(e.track) ?? null;
    if (role === "chords") playsChords = true;
    const part = partOfTrack(def, { label: e.track, role });
    if (part) played.add(part);
    const begin = R.toNum(e.onset);
    pitched.push({ owner: e.track, role, begin, end: begin + R.toNum(e.dur), midi: e.midi });
  }
  return { played, playsChords, unowned, pitched, sections: arranged };
}

/**
 * The reference placed in the song as the composer places a take (spec §5.2): a loop restarts at the start of each
 * section; a code with `arrange()` fills each song section of a kind with its section of that kind (a numbered one,
 * `chorus2`, the matching occurrence), looped. Returns the notes in song time and the sections it filled.
 */
function placeReference(
  def: UnitSongDef,
  reading: Reading,
  sections: readonly SongSectionId[],
): { notes: Sounding[]; filled: SongSectionId[] } {
  const notes: Sounding[] = [];
  const filled: SongSectionId[] = [];
  const seenOfType = new Map<string, number>();
  for (const { section, start } of layoutOf(def)) {
    const k = (seenOfType.get(section.type) ?? 0) + 1;
    seenOfType.set(section.type, k);
    if (!sections.includes(section.id)) continue;
    const end = start + section.bars;
    let from = 0;
    let period = Number.POSITIVE_INFINITY;
    if (reading.sections) {
      const of = reading.sections.filter((s) => s.label === section.type);
      const pick = of.find((s) => s.tag === `${section.type}${k}`) ?? of[0];
      if (!pick) continue;
      from = pick.startBar;
      period = pick.bars;
    }
    filled.push(section.id);
    // A loop plays from its own bar 0 at the section's start; an arranged section repeats every `period` bars.
    const span = Math.min(period, section.bars);
    for (const n of reading.pitched) {
      const r = n.begin - from;
      if (r < -EPS || r >= span - EPS) continue;
      const step = Number.isFinite(period) ? period : section.bars;
      for (let begin = start + r; begin < end - EPS; begin += step)
        notes.push({ ...n, begin, end: Math.min(begin + (n.end - n.begin), end) });
    }
  }
  return { notes, filled };
}

/**
 * The reference, placed in the song, against Oak's pitched parts that keep playing in those sections (in every
 * flavour). A clash with a part in `oakKeeps` fails (spec §8); with another Oak part (a learner tune over Oak's chords)
 * it is advice, for the music review: the lesson's own Band was never scanned against every passing test.
 */
async function stepClashes(
  def: UnitSongDef,
  step: TakeStep,
  reading: Reading,
  sections: readonly SongSectionId[],
  at: string,
): Promise<SongIssue[]> {
  if (reading.pitched.length === 0) return [];
  const log = new ClashLog();
  const beats = beatsOf(def.meter);
  const { notes, filled } = placeReference(def, reading, sections);
  const claimed = new Set<CellKey>(
    claimsOf(
      def,
      step,
      { parts: reading.played, playsChords: reading.playsChords },
      reading.sections ? filled : undefined,
    ),
  );
  const keeps = new Set(step.oakKeeps ?? []);
  const layout = layoutOf(def).filter((p) => filled.includes(p.section.id));
  const sectionAt = (t: number) =>
    layout.find((p) => t >= p.start - EPS && t < p.start + p.section.bars - EPS);
  const learnerChords = notes.filter((n) => n.role === "chords");
  for (const f of FLAVOUR_IDS) {
    const r = await evalSong(def, f);
    if (!r.ok) continue; // checkSong reports it
    const oak = oakNotes(def, r.events).filter((n) => {
      const sec = sectionAt(n.begin);
      return sec !== undefined && !claimed.has(`${n.owner}@${sec.section.id}` as CellKey);
    });
    for (const c of clashes(notes, oak, beats)) {
      const kept = keeps.has(c.with.owner);
      log.add(
        `the reference's "${c.line.owner}:" holds ${noteName(c.line.midi)} against ${noteName(c.with.midi)} in Oak's ${c.with.owner}, a half step apart${kept ? " (oakKeeps)" : "; Oak plays that part there under this take"}`,
        f,
        placeOf(def, c.line.begin, beats),
        kept ? "error" : "advice",
      );
    }
    // Oak's kept tune or bass held over a short chord note of the reference (a held one was reported just above).
    const kept = oak.filter((n) => keeps.has(n.owner) && (n.role === "melody" || n.role === "bass"));
    const shortChords = learnerChords.filter((n) => (n.end - n.begin) * beats < 1 - EPS);
    for (const c of clashes(kept, shortChords, beats))
      log.add(
        `Oak's ${c.line.owner} (oakKeeps) holds ${noteName(c.line.midi)} against ${noteName(c.with.midi)} in the reference's chords, a half step apart`,
        f,
        placeOf(def, c.line.begin, beats),
        "error",
      );
  }
  return log.issues(at);
}

/** `startFrom` (spec §5.3, §8): an earlier take whose reference opens today's Make, lints and plays here, and leaves today's work to do. */
async function startFromIssues(
  def: UnitSongDef,
  step: TakeStep,
  lesson: LessonDef,
  make: Extract<Exercise, { kind: "code-make" }>,
  meter: MeterId,
  key: KeySpec,
  opts: StepCheckOptions,
  at: string,
): Promise<SongIssue[]> {
  const out: SongIssue[] = [];
  const add = (code: SongIssueCode, message: string) =>
    out.push({ code, severity: "error", where: `${at} startFrom`, message });
  const from = step.startFrom as LessonId;
  const here = def.plan.findIndex((s) => s.lesson === step.lesson);
  const there = def.plan.findIndex((s) => s.lesson === from);
  if (there < 0 || def.plan[there]?.kind !== "take" || (here >= 0 && there >= here)) {
    add("usong.start-from", `${from} is not an earlier take step of ${def.id}`);
    return out;
  }
  const earlier = await (opts.lessonOf ?? loadLessonDef)(from);
  const earlierMake = earlier ? makeOf(earlier) : null;
  const code = earlierMake ? referenceOf(earlierMake) : null;
  if (!earlier || code === null) {
    add("usong.start-from", `${from} ${earlier ? "has no passing test code to open with" : "does not load"}`);
    return out;
  }
  for (const d of lint(code, { session: lesson.id, meter, key, profile: "graded" }).diagnostics)
    if (d.severity === "error")
      add(
        "usong.start-from",
        `${from}'s code does not lint at ${lesson.id}: line ${d.line} ${d.id}: ${d.message}`,
      );
  const r = await evaluate(code, make.bars[1]);
  if (!r.ok) add("usong.start-from", `${from}'s code does not evaluate: ${r.error}`);
  else if (r.events.length === 0) add("usong.start-from", `${from}'s code is silent`);
  else if (r.logs.some((l) => BAD_LOG.test(l)))
    add("usong.start-from", `${from}'s code logs: ${r.logs.join(" | ")}`);
  const test: TestCase = { name: `startFrom ${from}`, response: { code }, expect: "fail" };
  const g = await grade(make as Exercise, test, lesson, lesson.id);
  const required = g.rubric?.find((x) => x.required);
  if (g.decided && (required ? required.ok : g.passed))
    add(
      "usong.start-passes",
      `${from}'s code already meets today's required rule${required ? ` (${required.ruleId})` : ""}: the Make would open done`,
    );
  return out;
}

// --- content:check section 16 --------------------------------------------------------------------

const songChecks = new Map<string, Promise<SongIssue[]>>();
const line = (i: SongIssue) => `${i.code} ${i.where}: ${i.message}`;

/**
 * `content:check` section 16 for a lesson in a song: the song's own checks (once per song and process), its plan's
 * coverage, and this lesson's step. `null` for a lesson in no song.
 */
export async function unitSongSection(
  lesson: LessonDef,
  opts: StepCheckOptions = {},
): Promise<CheckSection | null> {
  const found = songStepOf(lesson.id);
  if (!found) return null;
  const { song, step } = found;
  let whole = songChecks.get(`${song.id}@${song.version}`);
  if (!whole) {
    whole = checkSong(song).then((issues) => [...issues, ...checkPlanCoverage(song)]);
    songChecks.set(`${song.id}@${song.version}`, whole);
  }
  const all = [...(await whole), ...(await checkSongStep(song, step, lesson, opts))];
  const sections = step.kind === "take" ? stepSectionIds(song, step) : [];
  return {
    n: 16,
    name: "Unit song",
    issues: all.filter((i) => i.severity === "error").map(line),
    warnings: all.filter((i) => i.severity === "advice").map(line),
    notes: [
      step.kind === "take"
        ? `${song.id} "${song.title}": takes ${step.parts.join(" ")} in ${sections.join(" ")}, from ${step.startFrom}`
        : `${song.id} "${song.title}": a side sketch (${step.reason})`,
    ],
  };
}
