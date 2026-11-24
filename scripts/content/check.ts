// `bun run content:check <id> [--verbose]`: the focused validation of AUTHORING §12.1 for one lesson
// (`U01.L03`), a unit (`U01`: its authored lessons and its checkpoint file), a checkpoint (`U01.CP`), a
// capstone (`C0`), or `all`. Prints each check in order with its first problems, then a summary; exits 1
// when anything fails. `--verbose` also prints every graded test with the grader's feedback codes and the
// text the learner would read. Things only an unfinished package can decide are listed as pending.
//
// Parallel-safe: the check reads the content sources and writes nothing, so several authors can run it at
// once. A lesson that another author is still writing and that does not load is reported, and fails the
// run only when it is one of the targets.
import { relative } from "node:path";
import type { CheckpointDef } from "@oak/content-kit";
import { capstones } from "../../content/capstones.ts";
import { checkpointMetas } from "../../content/checkpoints.ts";
import {
  CONTENT_ROOT,
  type LoadedLesson,
  loadCheckpointFiles,
  loadLessons,
} from "../../content/lib/load.bun.ts";
import { syllabus } from "../../content/syllabus.ts";
import { type CheckSection, checkLesson } from "../../content/validate/checks.ts";
import { backends } from "../../content/validate/harness.ts";
import { checkCapstone, checkCheckpoint } from "../../content/validate/owners.ts";
import { unitSongSection } from "../../content/validate/unit-songs.ts";

const MAX_SHOWN = 8;
const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("-v");
const arg = args.find((a) => !a.startsWith("-"));
const color = (code: number, s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const PASS = color(32, "PASS");
const FAIL = color(31, "FAIL");
const WAIT = color(33, "PENDING");
const WARN = color(33, "WARN");

function print(title: string, sections: CheckSection[]): boolean {
  console.log(`\n${title}`);
  let ok = true;
  for (const s of sections) {
    const failed = s.issues.length > 0;
    ok &&= !failed;
    const tag = failed ? FAIL : s.pending?.length ? WAIT : s.warnings?.length ? WARN : PASS;
    console.log(`  ${String(s.n).padStart(2)}. ${s.name.padEnd(34)} ${tag}`);
    const limit = verbose ? Number.POSITIVE_INFINITY : MAX_SHOWN;
    for (const i of s.issues.slice(0, limit)) console.log(`        ${i}`);
    if (s.issues.length > limit) console.log(`        … and ${s.issues.length - limit} more (--verbose)`);
    for (const w of (s.warnings ?? []).slice(0, verbose ? undefined : 3))
      console.log(color(33, `        advice: ${w}`));
    if (!verbose && (s.warnings?.length ?? 0) > 3)
      console.log(color(33, `        … and ${(s.warnings?.length ?? 0) - 3} more advice lines (--verbose)`));
    for (const p of (s.pending ?? []).slice(0, verbose ? undefined : 3))
      console.log(color(2, `        pending: ${p}`));
    if (verbose) for (const n of s.notes ?? []) console.log(color(2, `        ${n}`));
  }
  return ok;
}

if (!arg) {
  console.error(
    "usage: bun run content:check <lessonId | unitId | checkpointId | capstoneId | all> [--verbose]",
  );
  process.exit(2);
}

const { lessons, errors } = await loadLessons();
const cps = await loadCheckpointFiles();
const unitIds = new Set(syllabus.units.map((u) => u.id as string));
const isLessonTarget = (id: string | null | undefined) =>
  !!id && (arg === "all" || id === arg || (unitIds.has(arg) && id.startsWith(`${arg}.`)));

let ok = true;
// Load errors: fatal for the targets, a note for anybody else's lesson in progress.
for (const e of errors) {
  if (isLessonTarget(e.folderId) || (arg !== "all" && e.file.includes(arg))) {
    console.error(`${FAIL} ${e.file}: ${e.error}`);
    ok = false;
  } else console.log(color(2, `note: ${e.file} does not load (not checked here): ${e.error.split("\n")[0]}`));
}
for (const e of cps.errors) {
  const id = e.file.match(/core\/(U\d{2})\/CP\//)?.[1];
  if (arg === "all" || (id && (arg === id || arg === `${id}.CP`))) {
    console.error(`${FAIL} ${e.file}: ${e.error}`);
    ok = false;
  } else console.log(color(2, `note: ${e.file} does not load (not checked here)`));
}

let targets: LoadedLesson[] = [];
let checkpoints: CheckpointDef[] = [];
let capstoneIds: string[] = [];
if (arg === "all") {
  targets = lessons;
  checkpoints = cps.defs;
  // A brief is authored just in time (two units ahead of the learner): `all` checks the ones that carry
  // tests, and names the rest.
  // A transcribe capstone is checked once its sessions carry phrase checks or stage exercises (Wave 4), a
  // form map or a session rubric (Wave 6: CF-T).
  const authoredSessions = (c: (typeof capstones)[number]) =>
    c.sessionDefs.some(
      (s) =>
        (s.checks?.length ?? 0) > 0 ||
        (s.stages?.length ?? 0) > 0 ||
        s.formMap !== undefined ||
        (s.rubric?.length ?? 0) > 0,
    );
  capstoneIds = capstones
    .filter((c) => (c.brief?.tests.length ?? 0) > 0 || (c.kind === "transcribe" && authoredSessions(c)))
    .map((c) => c.id);
  const later = capstones.filter((c) => c.brief && c.brief.tests.length === 0).map((c) => c.id);
  if (later.length) console.log(color(2, `note: briefs without tests yet (not checked): ${later.join(" ")}`));
  const unchecked = capstones.filter((c) => c.kind === "transcribe" && !authoredSessions(c)).map((c) => c.id);
  if (unchecked.length)
    console.log(
      color(
        2,
        `note: transcription capstones without phrase checks yet (not checked): ${unchecked.join(" ")}`,
      ),
    );
} else if (unitIds.has(arg)) {
  targets = lessons.filter((l) => l.def.id.startsWith(`${arg}.`) && !l.sample);
  checkpoints = cps.defs.filter((c) => c.id === `${arg}.CP`);
  if (targets.length === 0 && checkpoints.length === 0 && ok)
    console.log(
      `\n${arg}: nothing authored yet (lessons go in content/${arg.startsWith("U") ? "core" : "advanced"}/${arg}/Lnn/).`,
    );
} else if (capstones.some((c) => c.id === arg)) capstoneIds = [arg];
else if (checkpointMetas.some((c) => c.id === arg)) {
  checkpoints = cps.defs.filter((c) => c.id === arg);
  if (checkpoints.length === 0) {
    console.error(
      `${FAIL} ${arg}: no checkpoint file yet (${arg.startsWith("U") ? `content/core/${arg.split(".")[0]}/CP` : "the CP folder of the last unit it covers, content/advanced/<unit>/CP"}/checkpoint.ts, AUTHORING §10)`,
    );
    ok = false;
  }
} else {
  targets = lessons.filter(
    (l) => l.def.id === arg || relative(CONTENT_ROOT, l.dir).includes(arg) || l.folderId === arg,
  );
  if (targets.length === 0 && ok) {
    console.error(
      `${FAIL} no lesson, unit, checkpoint or capstone "${arg}" (authored lessons: ${lessons.map((l) => l.def.id).join(" ") || "none"})`,
    );
    process.exit(1);
  }
}

for (const id of capstoneIds) {
  const c = capstones.find((x) => x.id === id);
  if (c)
    ok =
      print(
        `${c.id} ${c.title} (${c.kind}, ${c.sessions} session${c.sessions === 1 ? "" : "s"})`,
        await checkCapstone(c),
      ) && ok;
}
for (const cp of checkpoints)
  ok =
    print(
      `${cp.id} ${cp.title}  ${relative(process.cwd(), cps.files.get(cp.id) ?? `content/core/${cp.id.split(".")[0]}/CP/checkpoint.ts`)}`,
      await checkCheckpoint(cp),
    ) && ok;
// Section 16, "Unit song" (spec 2026-11-24 §8), for a lesson in a unit song: the song, its plan and this lesson's step.
const lessonOf = async (id: string) => lessons.find((x) => x.def.id === id && !x.sample)?.def ?? null;
for (const l of targets) {
  const song = l.sample ? null : await unitSongSection(l.def, { lessonOf });
  ok =
    print(`${l.def.id} ${l.def.title}${l.sample ? " (sample)" : ""}  ${relative(process.cwd(), l.file)}`, [
      ...(await checkLesson(l)),
      ...(song ? [song] : []),
    ]) && ok;
}
console.log(`\n${ok ? PASS : FAIL}  backends: ${JSON.stringify(backends())}`);
process.exit(ok ? 0 : 1);
