// Wave 5 integration: the SHIPPED capstone briefs and checks of content/capstones.ts graded by this package exactly
// as content CI and the app grade them (capstone mode, the brief's key, meter and middle tempo, the unlocks of its
// first session). C3, C4 and C5: every test piece of the brief (one passing piece per shipped flavour, the starter
// and the known-wrong pieces) grades as the brief pins it, and each known-wrong piece fails on a required rule.
// X2: every song of its pool that has an answer key passes each check with its own layers, and the known-wrong
// drafts fail the check they break (contracts §6.6 X2: bass ≥ 0.90, then changes ≥ 0.85, then melody ≥ 0.85).
// The measured tables are printed (`bun test … capstone-content-wave5`), one line per piece.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  CapstoneDef,
  GradeResult,
  KeySpec,
  PhraseCheck,
  SessionId,
  SongDef,
  SongId,
} from "@oak/content-kit";
import { stripMarkers } from "@oak/content-kit";
import { capstoneById } from "../../../../content/capstones.ts";
import { courseGraph } from "../../../../content/index.ts";
import { unlockedAt } from "../../../../content/lib/course.ts";
import { toolbox } from "../../../../content/toolbox.ts";
import { gradeExercise, gradePhraseCheck, initRealm, phraseCheckPassed } from "../index.ts";
import { SONG_LADDER_MATCHERS } from "./song-ladder.ts";

/** The W0 rules W4 puts on capstones as the book's suggestions (PLAN §6 F1). */
const BOOK_FNS: ReadonlySet<string> = new Set([
  "ends-on-purpose",
  "staggered-boundary",
  "unique-event",
  "arc",
]);

setDefaultTimeout(180_000);
const C_MAJOR: KeySpec = { tonic: "C", mode: "major" };
const unlocked = (c: CapstoneDef) => unlockedAt(courseGraph(), toolbox, c.sessionDefs[0]?.id as SessionId);
const table: string[] = [];

beforeAll(async () => {
  await initRealm({ toolbox: [...toolbox], lockdown: false });
});

const pct = (x: number) => x.toFixed(3);

for (const id of ["C3", "C4", "C5"] as const) {
  const cap = capstoneById.get(id) as CapstoneDef;
  const brief = cap.brief;
  describe(`${id} ${cap.title}: every piece of the shipped brief`, () => {
    test("the brief is authored with passing pieces per flavour and known-wrong pieces", () => {
      expect(brief).toBeTruthy();
      const tests = brief?.tests ?? [];
      expect(tests.filter((t) => t.expect === "pass").length).toBeGreaterThanOrEqual(2);
      expect(tests.filter((t) => t.expect === "fail").length).toBeGreaterThanOrEqual(2);
      // The starter is graded too (it fails: the brief asks for more than it has).
      const starter = stripMarkers(brief?.code.starter ?? "").code;
      expect(tests.some((t) => "code" in t.response && t.response.code === starter)).toBe(true);
    });
    for (const t of brief?.tests ?? []) {
      test(`${t.expect}: ${t.name}`, async () => {
        const code = (t.response as { code: string }).code;
        const r: GradeResult = await gradeExercise({
          exercise: brief as NonNullable<typeof brief>,
          response: { code },
          ctx: {
            exerciseGlobalId: `${id}/brief`,
            mode: "capstone",
            key: cap.key ?? C_MAJOR,
            meter: cap.meter,
            bpm: cap.bpm ? Math.round((cap.bpm[0] + cap.bpm[1]) / 2) : 100,
            params: {},
            attemptNo: 1,
            firstAttempt: true,
            rung: 0,
            tutorHints: 0,
            extraReplays: 0,
            lint: {
              profile: "graded",
              unlocked: unlocked(cap),
              allowPreview: false,
              meter: cap.meter,
              key: cap.key ?? C_MAJOR,
            },
          },
        });
        const failing = (r.rubric ?? []).filter((x) => !x.ok).map((x) => x.ruleId);
        table.push(
          `| ${id} | ${t.expect} | ${t.name.slice(0, 70)} | ${r.status} | ${pct(r.score)} | ${failing.join(", ") || "—"} |`,
        );
        if (t.expect === "pass") {
          expect(r.status).toBe("pass");
          // Oak 2.0 W4 F1: the book's seam, once-only and arc lines are suggestions with no skills; a passing piece
          // may leave them open (they never block). Every other line is met.
          const book = new Set(
            (brief?.rubric ?? [])
              .filter((x) => !x.required && x.rule === "custom" && BOOK_FNS.has((x as { fn: string }).fn))
              .map((x) => x.id),
          );
          expect(failing.filter((f) => !book.has(f))).toEqual([]);
        } else {
          expect(r.status).not.toBe("pass");
          // A known-wrong piece fails on a required rule of the rubric (never only on an evaluation error).
          const required = new Set(brief?.rubric.filter((x) => x.required).map((x) => x.id));
          expect(failing.some((f) => required.has(f))).toBe(true);
          for (const f of t.feedback ?? []) expect(r.diagnostics.map((d) => d.id)).toContain(f);
        }
      });
    }
  });
}

// --- X2 ------------------------------------------------------------------------------------------------------

const X2 = capstoneById.get("X2") as CapstoneDef;
const X2_CHECKS = X2.sessionDefs.flatMap((s) => s.checks ?? []) as PhraseCheck[];
const REPERTOIRE = join(import.meta.dir, "../../../../content/repertoire");
const xctx = {
  params: {},
  attemptNo: 1,
  firstAttempt: true,
  rung: 0 as const,
  tutorHints: 0,
  extraReplays: 0,
  lint: {
    profile: "graded" as const,
    unlocked: unlocked(X2),
    allowPreview: false,
    meter: "4/4" as const,
    key: null,
  },
};

/** One chord symbol a bar, from the answer key's chart (a chord on beat 1 of each bar). */
const barsOf = (song: SongDef): string[] =>
  (song.answerKey.chords ?? []).filter((c) => c.beat === 1).map((c) => c.symbol);

for (const id of X2.song ?? []) {
  const slug = (id as SongId).replace(/^song\./, "");
  const file = join(REPERTOIRE, slug, "song.ts");
  describe(`X2 on ${id}`, () => {
    if (!existsSync(file)) {
      test.todo(`${id}: no answer key yet (content/repertoire/${slug}/song.ts, author:repertoire)`);
      return;
    }
    let song: SongDef;
    let head = "";
    beforeAll(async () => {
      song = (await import(file)).default as SongDef;
      head = `setcpm(${song.bpm}/${Number(song.meter.split("/")[0])})\n\n`;
    });
    const grade = (check: PhraseCheck, code: string) =>
      gradePhraseCheck({ capstoneId: "X2", check, song, code: `${head}${code}`, ctx: xctx });
    const row = (check: string, what: string, r: GradeResult, mark: number) =>
      table.push(`| X2 ${slug} | ${check} (≥ ${mark}) | ${what} | ${r.status} | ${pct(r.score)} | — |`);

    test("the answer key passes every check; an empty draft fails every check", async () => {
      const l = song.answerKey.layers;
      const all = `bass: ${l.bass}\nchords: ${l.chords}\nmel: ${l.melody}`;
      for (const c of X2_CHECKS) {
        const right = await grade(c, all);
        row(c.id, "the answer key", right, c.pass);
        expect(phraseCheckPassed(right)).toBe(true);
        const empty = await grade(c, 'mel: n("~").s("piano")');
        row(c.id, "an empty draft", empty, c.pass);
        expect(phraseCheckPassed(empty)).toBe(false);
      }
    });

    test("known-wrong: a bass that never leaves the tonic fails the bass check", async () => {
      const bass = X2_CHECKS.find((c) => c.id === "bass") as PhraseCheck;
      const tonic = `${song.key.tonic.toLowerCase()}2`;
      const r = await grade(bass, `bass: note("${tonic} ~ ${tonic} ~").s("ebass")`);
      row("bass", "the tonic in every bar", r, bass.pass);
      expect(phraseCheckPassed(r)).toBe(false);
    });

    test("known-wrong: the last 4-bar line of the changes wrong under the right bass fails the changes", async () => {
      const changes = X2_CHECKS.find((c) => c.id === "changes") as PhraseCheck;
      const b = barsOf(song);
      expect(b.length).toBeGreaterThanOrEqual(12);
      // Swap I and the other chords of bars 9–12 (I ↔ V, IV ↔ I): every bar of the line has the wrong root.
      const tonicOf = b[0] as string;
      const other = b.find((x) => x !== tonicOf) as string;
      const wrong = b.map((x, i) => (i >= 8 && i < 12 ? (x === tonicOf ? other : tonicOf) : x));
      const draft = `bass: ${song.answerKey.layers.bass}\nchords: chord("<${wrong.join(" ")}>").voicing()`;
      const shipped = await grade(changes, draft);
      row("changes", "last line wrong, right bass (shipped matcher)", shipped, changes.pass);
      const fixed = await grade({ ...changes, matcher: SONG_LADDER_MATCHERS.changes }, draft);
      row("changes", "last line wrong, right bass (chords only)", fixed, changes.pass);
      // On the chords alone (the bass has its own check first) the wrong line fails.
      expect(phraseCheckPassed(fixed)).toBe(false);
      // The shipped X2 matcher is that same chords-only matcher (closer: content X2_CHANGES gained weights.bass 0).
      // d11: the ladder's matcher reads sevenths and gives a wrong quality nothing; X2_CHANGES takes the same two
      // fields once content lists `harmony.wrong-quality` (requested from the content owner). Equal either way.
      const shippedMatcher: Record<string, unknown> = {
        ...changes.matcher,
        qualityDepth: "seventh",
        wrongQuality: "none",
      };
      const ladderMatcher: Record<string, unknown> = { ...SONG_LADDER_MATCHERS.changes };
      expect(shippedMatcher).toEqual(ladderMatcher);
      expect(phraseCheckPassed(shipped)).toBe(false);
      const one = b.map((x, i) => (i === 8 ? (x === tonicOf ? other : tonicOf) : x));
      const single = await grade(
        { ...changes, matcher: SONG_LADDER_MATCHERS.changes },
        `bass: ${song.answerKey.layers.bass}\nchords: chord("<${one.join(" ")}>").voicing()`,
      );
      row("changes", "bar 9 alone wrong (chords only)", single, changes.pass);
      expect(phraseCheckPassed(single)).toBe(true);
    });

    test("known-wrong: each melody line in the right rhythm on one repeated note fails its line", async () => {
      for (const c of X2_CHECKS.filter((x) => x.layer === "melody")) {
        const tonic = `${song.key.tonic.toLowerCase()}4`;
        const flat = (song.answerKey.layers.melody ?? "").replace(/\b[a-g](?:#|b)?\d\b/g, tonic);
        expect(flat).not.toBe(song.answerKey.layers.melody);
        const r = await grade(c, `mel: ${flat}`);
        row(c.id, "the rhythm on the tonic alone", r, c.pass);
        expect(phraseCheckPassed(r)).toBe(false);
      }
    });
  });
}

describe("the measured table", () => {
  test("prints", () => {
    console.log(
      [
        "| Capstone | Expect / check | Piece | Status | Score | Failing rules |",
        "|---|---|---|---|---|---|",
        ...table,
      ].join("\n"),
    );
    expect(table.length).toBeGreaterThan(0);
  });
});
