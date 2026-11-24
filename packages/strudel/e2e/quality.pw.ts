// The sound-quality check of the pack (Wave 3): every curated alias in tune (first partial against equal
// temperament, A4 = 440 Hz), in the octave it claims, without a click at note ends and loudness-matched to the
// piano; the reference tones for singing (steady, fundamental-dominant, in tune); the jazz kit against the pop
// kit. Offline renders through the production prebake. Writes packages/strudel/sound-quality.json (committed).
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { QUALITY_CASES } from "../src/audibility/cases.ts";
import { cadencePlan, dronePlan, tonicPlan } from "../src/reference.ts";
import { openPage } from "./helpers.ts";

// biome-ignore lint/suspicious/noExplicitAny: the test API is driven untyped from page.evaluate
type W = Window & { __oak: any };

/** Tolerances. A real piano's bass is stretch-tuned a few cents flat; ±10 c covers that and catches a bad font. */
const MAX_CENTS = 10;
const MAX_CLICK_DB = 12;
const MAX_LOUDNESS_LU = 1.5;
const DRONE_TONICS = [48, 53, 55, 60, 62, 65, 67, 72];
const KIT_ROLES = ["bd", "sd", "sd:1", "sd:2", "rim", "hh", "oh", "rd", "rd:1", "lt", "mt", "ht", "cr"];

test("sound quality: aliases, reference tones, jazz kit", async ({ page }) => {
  test.setTimeout(240_000);
  await openPage(page);
  const drones = DRONE_TONICS.map((m) => [m, dronePlan(m)] as const);
  const result = await page.evaluate(
    async ([cases, drones, tonic, cadence, roles]) => {
      const q = (window as unknown as W).__oak.quality;
      const aliases = [];
      for (const c of cases) {
        const tuning = [];
        for (const n of c.notes) tuning.push(await q.tuning(c.sound, n));
        const clicks = [
          await q.clicks(c.sound, c.clickNote, 2),
          await q.clicks(c.sound, c.notes[0], 1 / 0.15),
        ];
        const loudness = await q.phraseLoudness(c.phrase);
        aliases.push({ id: c.id, sound: c.sound, wave3: c.wave3, tuning, clicks, loudness });
      }
      const droneRows = [];
      for (const [m, p] of drones) droneRows.push(await q.plan(p, m));
      const kit = [];
      for (const r of roles) {
        const pop = await q.phraseLoudness(`s("${r} ${r} ${r} ${r}")`);
        const jazz = await q.phraseLoudness(`s("${r} ${r} ${r} ${r}").bank("jazzkit")`);
        kit.push({ role: r, popLufs: pop.lufs, jazzLufs: jazz.lufs, jazzPeakDb: jazz.peakDb });
      }
      return {
        aliases,
        drones: droneRows,
        tonicLufs: await q.planLoudness(tonic),
        cadenceLufs: await q.planLoudness(cadence),
        kit,
        jazzGroove: await q.phraseLoudness('s("bd ~ sd ~, rd*8, ~ hh ~ hh").bank("jazzkit")', 1),
        popGroove: await q.phraseLoudness('s("bd ~ sd ~, hh*8")', 1),
        jazzVsPopDb: await q.differenceDb('s("bd sd hh rd rim")', 's("bd sd hh rd rim").bank("jazzkit")'),
      };
    },
    [QUALITY_CASES, drones, tonicPlan(60), cadencePlan(60), KIT_ROLES] as const,
  );

  const piano = result.aliases.find((a: { id: string }) => a.id === "snd.piano");
  if (!piano) throw new Error("the piano was not measured");
  const reference = piano.loudness.lufs as number;
  const table = {
    generatedBy: "packages/strudel/e2e/quality.pw.ts",
    rule: `tuning: first partial within ±${MAX_CENTS} c of equal temperament (A4 = 440 Hz) in the asked-for octave; clicks: no HF jump over +${MAX_CLICK_DB} dB after the attack (0.5 s and 0.15 s notes); loudness: BS.1770 LUFS of the phrase within ±${MAX_LOUDNESS_LU} LU of the piano's (${reference} LUFS)`,
    ...result,
  };
  writeFileSync(resolve(import.meta.dirname, "../sound-quality.json"), `${JSON.stringify(table, null, 2)}\n`);

  const problems: string[] = [];
  for (const a of result.aliases) {
    for (const t of a.tuning) {
      if (t.octave !== 0) problems.push(`${a.id} ${t.midi}: sounds ${t.octave} octave(s) off`);
      else if (t.cents === null || Math.abs(t.cents) > MAX_CENTS)
        problems.push(`${a.id} ${t.midi}: ${t.cents} cents`);
    }
    for (const c of a.clicks)
      if (c.worstDb > MAX_CLICK_DB) problems.push(`${a.id} ${c.midi}: click ${c.worstDb} dB at ${c.atSec} s`);
    if (Math.abs(a.loudness.lufs - reference) > MAX_LOUDNESS_LU)
      problems.push(`${a.id}: ${a.loudness.lufs} LUFS against the piano's ${reference}`);
  }
  expect(problems).toEqual([]);

  // Reference tones: in tune, in the asked octave, steady, the fundamental dominant, no click.
  for (const d of result.drones) {
    expect(d.octave, `drone ${d.midi}`).toBe(0);
    expect(Math.abs(d.cents), `drone ${d.midi}`).toBeLessThan(1);
    expect(d.spreadDb, `drone ${d.midi}`).toBeLessThan(0.5);
    expect(d.fundamentalShare, `drone ${d.midi}`).toBeGreaterThan(0.9);
    expect(d.clickDb, `drone ${d.midi}`).toBeLessThan(MAX_CLICK_DB);
    expect(Math.abs(d.lufs - result.cadenceLufs), `drone ${d.midi} vs cadence`).toBeLessThan(2);
  }
  expect(Math.abs(result.tonicLufs - result.cadenceLufs)).toBeLessThan(2);

  // The jazz kit is its own kit: softer kick and brushes, a ride that carries the time, every role sounding.
  const role = (r: string) => {
    const k = result.kit.find((x: { role: string }) => x.role === r);
    if (!k) throw new Error(`kit role ${r} was not measured`);
    return k;
  };
  expect(result.jazzVsPopDb).toBeGreaterThan(-3);
  for (const k of result.kit) expect(k.jazzLufs, k.role).toBeGreaterThan(-40);
  expect(role("bd").jazzLufs).toBeLessThan(role("bd").popLufs - 3);
  expect(role("sd").jazzLufs).toBeLessThan(role("sd").popLufs - 3);
  expect(role("rd").jazzLufs).toBeGreaterThan(role("hh").jazzLufs + 6);
  // v4: the rebuilt jazz kit (Virtuosity Drums) has its own crash, not the default kit's
  expect(role("cr").jazzLufs).not.toBe(role("cr").popLufs);
  // v4: recorded brushes (Swirly), a feathered kick and a ride kept under its peak ceiling sit about 5 LU under
  // the pop groove (the MC-303 kit was within 3); the Band's production balances the parts.
  expect(Math.abs(result.jazzGroove.lufs - result.popGroove.lufs)).toBeLessThan(6);
  expect(result.jazzGroove.peakDb).toBeLessThan(0);
});
