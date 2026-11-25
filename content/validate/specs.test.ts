// The unit specs (content/specs/*.ts) against the registries: the authors of Wave 2 build from these, so a
// spec that promises an unknown term, a locked tool, a skill before its prerequisite or a budget the
// lesson cannot meet is caught before anyone writes a step. The rendered Markdown must be current.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTHORING_CAPS,
  plannedOrImplemented,
  type SessionId,
  STEP_EXERCISE_KINDS,
  WORKBENCH_PANEL_TOOLS,
} from "@oak/content-kit";
import { bandById, bandMeter } from "../bands/index.ts";
import { candoById } from "../candos.ts";
import { checkpointMetas } from "../checkpoints.ts";
import { deckById, familyById } from "../families.ts";
import { courseGraph, registries } from "../index.ts";
import { atOrBefore, skillOrderIssues } from "../lib/course.ts";
import { songById } from "../repertoire/index.ts";
import { unitSpecs } from "../specs/index.ts";
import { renderUnit, specBudget } from "../specs/render.ts";
import { termById } from "../terms.ts";
import { toolboxById } from "../toolbox.ts";
import { orderPoint } from "./authoring.ts";
import { BAD_LOG, evaluate, lint, ONBOARDING_PREVIEW, unlockedFor } from "./harness.ts";

setDefaultTimeout(60_000);
const g = courseGraph();
// A spec plans the lessons the Build phase writes: it may use what this wave implements or plans to
// (contracts §5.1, content-kit `PLANNED`); the lessons themselves are held to `IMPLEMENTED` by content:check.
const IMPLEMENTED = plannedOrImplemented();
const meta = new Map(
  registries.syllabus.units.flatMap((u) => u.lessons.map((l) => [l.id as string, l] as const)),
);
const termsOf = (t: string | string[] | undefined): string[] =>
  t === undefined ? [] : Array.isArray(t) ? t : [t];
/** Specs written before Wave 5, which predate the enjoyment / pace / return lines. Every later spec has them. */
const BEFORE_EPR = new Set(["U00", "U01", "U02", "U03", "U04", "U05", "U06", "U07"]);

test("the skill graph is ordered in every legal order (contracts §4.2 rule 1)", () => {
  expect(skillOrderIssues(g, registries.syllabus, registries.skills)).toEqual([]);
});

/**
 * Makes that write their own drums, each with its reason (AUTHORING §8 rule 8): a Band's drums would double or
 * flam against them.
 */
const NO_BAND: Record<string, string> = {
  "U09.L06": "an ending is heard in the silence after it; a Band playing on would fill it",
  "U11.L07": "the shuffle's swung hats are the learner's; a Band's straight hats would flam against them",
  "U11.L08": "the swung shuffle of U11.L07 again, hats, kick and snare in the learner's code",
  // U13 Rhythm II: the groove is the lesson, so kick, snare and hats are lines of the learner's code in every
  // step (content/specs/U13.ts, conventions).
  "U13.L01":
    "a push is heard against the learner's own straight kick, snare and hats; the jazz-soul Band swings its ride",
  "U13.L02": "the ghosted snare and the accented hats are the learner's; a Band's drums would double them",
  "U13.L03": "the tune's ties are read against the U13.L01 rhythm section, which is in the learner's code",
  "U13.L04": "no Band is written in 6/8; the kick and the snare that make the two beats are the learner's",
  "U13.L05":
    "the triplets are the learner's piano and hats; band.doo-wop plays the same triplets and would blur them",
  "U13.L06": "the call's drums are the learner's lines, and the answer is written in the same lines",
  // Wave 7, the rhythm track (content/specs/R1.ts, R2.ts, conventions "Bands").
  "R1.L03": "the funk pocket is the lesson: kick, ghosted snare, bass and clav are all the learner's",
  "R1.L04": "the three interlocking parts and the drums they fit around are the learner's",
  "R1.L05": "the displaced figure is heard against the learner's own steady drums and bass",
  "R2.L01": "no Band is written in 5/4; the kick that groups the bar is the learner's",
  "R2.L02": "no Band is written in 7/8 or 9/8i; the accents that group the bar are the learner's",
  "R2.L04": "both pulses of the polyrhythm are the learner's; a Band's drums would add a third",
  "R2.L05": "the line that drifts and the line that keeps the bar are both the learner's",
};

for (const u of unitSpecs)
  describe(`${u.unit} spec`, () => {
    const unit = registries.syllabus.units.find((x) => x.id === u.unit);
    test("covers every lesson of the unit (or the lessons it says it covers), in order", () => {
      const all = (unit?.lessons ?? []).map((l) => l.id as string);
      if (u.covers) for (const id of u.covers) expect([id, all.includes(id)]).toEqual([id, true]);
      expect(u.lessons.map((l) => l.id as string)).toEqual(u.covers ?? all);
    });
    test("content/specs/*.md is the current rendering", () => {
      const md = readFileSync(join(import.meta.dir, "..", "specs", `${u.unit}.md`), "utf8");
      expect(md === renderUnit(u)).toBe(true);
    });
    test("every glossary term of the unit's lessons is introduced by exactly that lesson's spec", () => {
      const ids = new Set(u.lessons.map((l) => l.id as string));
      for (const t of registries.terms.filter((x) => ids.has(x.introducedBy))) {
        const owner = u.lessons.find((l) => l.id === t.introducedBy);
        const named = owner?.steps.flatMap((s) => termsOf(s.term)) ?? [];
        expect([t.id, named.includes(t.id) || (!!t.pairedWith && named.includes(t.pairedWith))]).toEqual([
          t.id,
          true,
        ]);
      }
    });
    test("every can-do whose source is one of these lessons is listed by it", () => {
      for (const c of registries.candos.filter((x) => u.lessons.some((l) => l.id === x.source)))
        expect([c.id, u.lessons.find((l) => l.id === c.source)?.canDo.includes(c.id)]).toEqual([c.id, true]);
    });
    if (u.checkpoint) {
      const cp = u.checkpoint;
      test(`${cp.id}: skills and recipe families fit the checkpoint map`, () => {
        const m = checkpointMetas.find((c) => c.id === cp.id);
        expect(m).toBeDefined();
        const skills = new Set<string>([...(m?.gated ?? []), ...(m?.levelSetting ?? [])]);
        for (const a of cp.authored)
          for (const s of a.skills) expect([a.id, s, skills.has(s)]).toEqual([a.id, s, true]);
        for (const [s, fams] of Object.entries(cp.recipe.families))
          for (const f of fams ?? []) {
            const fam = familyById.get(f);
            expect([s, f, !!fam && atOrBefore(g, fam.unlock.lesson, cp.id as SessionId)]).toEqual([
              s,
              f,
              true,
            ]);
          }
        const measured = new Set([
          ...cp.authored.flatMap((a) => a.skills),
          ...Object.keys(cp.recipe.families),
        ]);
        expect((m?.gated ?? []).filter((s) => !measured.has(s) && !cp.make.required.includes(s))).toEqual([]);
      });
    }
    for (const l of u.lessons)
      describe(l.id, () => {
        const m = meta.get(l.id);
        const preview = ONBOARDING_PREVIEW.has(l.id);
        test("terms exist, belong to this lesson, at most three (a pair counts once)", () => {
          const terms = l.steps.flatMap((s) => termsOf(s.term));
          for (const t of terms) expect([t, termById.get(t)?.introducedBy]).toEqual([t, l.id]);
          const counted = new Set(terms.map((t) => [t, termById.get(t)?.pairedWith ?? t].sort()[0]));
          expect(counted.size).toBeLessThanOrEqual(AUTHORING_CAPS.maxTerms);
          for (const [i, s] of l.steps.entries())
            if (termsOf(s.term).length)
              expect([i + 1, ["concept", "see"].includes(s.kind)]).toEqual([i + 1, false]);
        });
        test("can-dos exist", () => {
          for (const c of l.canDo) expect([c, candoById.has(c)]).toEqual([c, true]);
        });
        test("every tool the code uses, and every panel a step opens, is unlocked here in every legal order", () => {
          const unlocked = unlockedFor(l.id as SessionId);
          for (const s of l.steps)
            for (const p of s.panels ?? [])
              expect([p, unlocked.has(WORKBENCH_PANEL_TOOLS[p])]).toEqual([p, true]);
          for (const t of l.uses) {
            expect([t, toolboxById.has(t)]).toEqual([t, true]);
            if (!preview || !t.startsWith("tb.feature")) expect([t, unlocked.has(t)]).toEqual([t, true]);
          }
        });
        test("families and decks exist; a seeded family unlocks here, a reviewed one no later", () => {
          for (const r of l.srs) {
            if (r.family) {
              const f = familyById.get(r.family);
              expect([r.family, !!f]).toEqual([r.family, true]);
              if (r.mode === "seed") expect([r.family, f?.unlock.lesson]).toEqual([r.family, l.id]);
              else
                expect([r.family, atOrBefore(g, f?.unlock.lesson as SessionId, l.id as SessionId)]).toEqual([
                  r.family,
                  true,
                ]);
            }
            if (r.deck) {
              const d = deckById.get(r.deck);
              expect([r.deck, !!d && atOrBefore(g, d.unlock.lesson, l.id as SessionId)]).toEqual([
                r.deck,
                true,
              ]);
              if (r.mode === "seed" && !r.cards) expect([r.deck, d?.unlock.lesson]).toEqual([r.deck, l.id]);
              for (const c of r.cards ?? []) {
                const card = d?.cards.find((x) => x.id === c);
                expect([c, !!card]).toEqual([c, true]);
                // A seeded card opens here: its own gate, or the deck's lesson when it has none.
                if (r.mode === "seed") expect([c, card?.gate ?? d?.unlock.lesson]).toEqual([c, l.id]);
              }
            }
            if (r.family && r.level !== undefined) {
              // The level the lesson plays is open here in every legal order (contracts §7.3 level gates).
              const f = familyById.get(r.family);
              expect([r.family, r.level >= 1 && r.level <= (f?.levels.length ?? 0)]).toEqual([
                r.family,
                true,
              ]);
              const gate = f?.unlock.levelGates?.[r.level];
              for (const at of gate === undefined ? [] : Array.isArray(gate) ? gate : [gate])
                if (gate && !Array.isArray(gate))
                  expect([r.family, r.level, atOrBefore(g, at, l.id as SessionId)]).toEqual([
                    r.family,
                    r.level,
                    true,
                  ]);
              if (Array.isArray(gate))
                expect([r.family, r.level, gate.some((at) => atOrBefore(g, at, l.id as SessionId))]).toEqual([
                  r.family,
                  r.level,
                  true,
                ]);
            }
          }
          expect(l.srs.flatMap((r) => r.cards ?? []).length).toBeLessThanOrEqual(2);
        });
        test("steps: kinds, exercise kinds and answer widgets are legal and implemented; the last is the Make", () => {
          expect(l.steps.length).toBeLessThanOrEqual(AUTHORING_CAPS.maxSteps);
          expect(l.steps.at(-1)?.kind).toBe("make");
          for (const s of l.steps) {
            const allowed = STEP_EXERCISE_KINDS[s.kind] as readonly string[];
            if (allowed.length === 0) expect([s.kind, s.exercise]).toEqual([s.kind, undefined]);
            else
              expect([s.kind, s.exercise, allowed.includes(s.exercise as string)]).toEqual([
                s.kind,
                s.exercise,
                true,
              ]);
            if (s.exercise) expect(IMPLEMENTED.exerciseKinds).toContain(s.exercise);
            for (const a of s.answer ?? []) expect(IMPLEMENTED.answerUis).toContain(a);
            for (const f of s.features ?? []) expect(IMPLEMENTED.features ?? []).toContain(f);
          }
          expect(IMPLEMENTED.rubricRules).toContain(l.make.required.rule);
        });
        test("budget of §9.2 and the 15-minute split", () => {
          const b = specBudget(l);
          expect(b.gradedChecks).toBeLessThanOrEqual(AUTHORING_CAPS.maxGradedChecks);
          expect(b.scaledMinutes).toBeLessThanOrEqual(AUTHORING_CAPS.lessonScaledMinutes + 1e-9);
          expect(b.partAScaled).toBeLessThanOrEqual(AUTHORING_CAPS.splitPartAScaled + 1e-9);
          expect(b.partBScaled).toBeLessThanOrEqual(AUTHORING_CAPS.splitPartBScaled + 1e-9);
          expect(l.wrapAt).toBeLessThan(l.steps.length);
          for (const s of l.steps) expect((s.minutes * 4) % 1).toBe(0);
        });
        test("the Band exists and is written in the lesson's meter; from U01 every Make has one", () => {
          if (l.make.band === false)
            expect([l.id, l.id.startsWith("U00") || l.id in NO_BAND]).toEqual([l.id, true]);
          else {
            expect(bandById.has(l.make.band)).toBe(true);
            expect(bandMeter(l.make.band)).toBe(l.meter);
          }
        });
        if (!BEFORE_EPR.has(u.unit))
          test("enjoyment, pace and return: one line each (Wave 5)", () => {
            const e = l.epr;
            expect([l.id, Boolean(e)]).toEqual([l.id, true]);
            for (const [k, v] of Object.entries(e ?? {}))
              expect([l.id, k, (v as string).trim().split(/\s+/).length >= 8]).toEqual([l.id, k, true]);
          });
        test("singing: numbers until U03.L08, syllables from it (contracts §8.3)", () => {
          const order = registries.syllabus.defaultOrder as readonly string[];
          // A side lesson is judged at the earliest point it can be taken (just after U03.L02 for A1).
          const at = orderPoint(l.id);
          const before = at >= 0 && at < order.indexOf("U03.L08");
          const sings = l.steps.some((s) => s.kind === "sing");
          if (sings && at >= order.indexOf("U03.L02"))
            expect([l.id, l.singOn]).toEqual([l.id, before ? "numbers" : "syllables"]);
          if (l.singOn === "syllables") expect([l.id, before]).toEqual([l.id, false]);
        });
        for (const r of l.repertoire ?? [])
          test(`repertoire ${r.song}: the degrees are the cited tune, no pickup or dot or tie before they are taught`, async () => {
            expect([r.song, !!songById.get(r.song)]).toEqual([r.song, true]);
            expect([r.song, songById.get(r.song)?.usedIn.includes(l.id)]).toEqual([r.song, true]);
            const tempo = `setcpm(${l.bpm}/4)\n\n`;
            const asDegrees = await evaluate(
              `${tempo}mel: n("${r.degrees}").scale("${r.sourceKey}").s("piano")`,
              r.bars,
            );
            const asLetters = await evaluate(`${tempo}mel: note("${r.letters}").s("piano")`, r.bars);
            const sig = (x: typeof asDegrees) =>
              x.events.map((e) => `${e.begin}-${e.end}:${e.midi}`).join(" ");
            expect(sig(asDegrees)).toBe(sig(asLetters));
            const taught = await evaluate(
              `${tempo}mel: n("${r.degrees}").scale("${r.key}").s("piano")`,
              r.bars,
            );
            expect(taught.events.length).toBeGreaterThan(0);
            const rat = (x: string) => {
              const [a, b] = String(x).split("/").map(Number);
              return b ? (a as number) / b : (a as number);
            };
            const plain = [1, 1 / 2, 1 / 4, 1 / 8];
            // From U13.L03 on a fragment may hold dotted values and ties (the lesson that teaches them); from
            // U07.L08 on it may start with a pickup (contracts §2.8).
            const order = registries.syllabus.defaultOrder as readonly string[];
            const dotsAndTies = orderPoint(l.id) >= order.indexOf("U13.L03");
            const pickups = orderPoint(l.id) >= order.indexOf("U07.L08");
            for (const e of dotsAndTies ? [] : taught.events) {
              const [b0, b1] = [rat(e.begin), rat(e.end)];
              // No dotted value, nothing held over a bar line (both would need a dot or a tie before U13.L03).
              expect([r.song, e.begin, plain.some((p) => Math.abs(b1 - b0 - p) < 1e-9)]).toEqual([
                r.song,
                e.begin,
                true,
              ]);
              expect([r.song, e.begin, Math.floor(b0 + 1e-9) === Math.floor(b1 - 1e-9)]).toEqual([
                r.song,
                e.begin,
                true,
              ]);
            }
            // No pickup (contracts §2.8, before U07.L08): the first bar has a note or a rest on beat 1, and the
            // fragment is written from that bar on.
            if (!pickups) expect([r.song, rat(taught.events[0]?.begin ?? "1") < 1]).toEqual([r.song, true]);
            const lint1 = lint(`${tempo}mel: n("${r.degrees}").scale("${r.key}").s("piano")`, {
              session: l.id as SessionId,
              meter: l.meter,
              key: l.key,
              allowPreview: false,
            }).diagnostics.filter((d) => d.severity === "error");
            expect(lint1.map((d) => d.message)).toEqual([]);
          });
        test("the hook evaluates, makes sound, has a tempo line and lints in this lesson", async () => {
          const r = await evaluate(l.hook.code, 2);
          expect([r.ok, r.error ?? ""]).toEqual([true, ""]);
          expect(r.events.length).toBeGreaterThan(0);
          expect(r.cpsSet).toBe(true);
          expect(r.logs.filter((x) => BAD_LOG.test(x))).toEqual([]);
          const errors = lint(l.hook.code, {
            session: l.id as SessionId,
            meter: l.meter,
            key: l.key,
            allowPreview: Boolean(l.hook.preview) || preview,
          }).diagnostics.filter((d) => d.severity === "error");
          expect(errors.map((d) => `${d.id} ${d.message}`)).toEqual([]);
          expect(m).toBeDefined();
        });
      });
  });
