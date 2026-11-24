// The committed audibility table (packages/strudel/audibility.json, written by the S3 harness in
// packages/strudel/e2e/audibility.pw.ts) against the toolbox registry: every group-H control and every sound of
// the catalog has a case, nothing the registry calls audible is unproven, and the pack's aliases and kits are
// exactly the catalog's sounds.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toolbox } from "../../content/toolbox.ts";
import { W6_TUNING } from "../../packages/strudel/e2e/wave6-fixtures.ts";
import { W7_KNOWN_TUNING, W7_TUNING } from "../../packages/strudel/e2e/wave7-fixtures.ts";
import {
  A1_CASES,
  BASS_TONE_CASES,
  CONTROL_CASES,
  QUALITY_CASES,
  SOUND_CASES,
  W6_LESSON_CASES,
  W7_LESSON_CASES,
} from "../../packages/strudel/src/audibility/cases.ts";
import { KIT_ALIASES, OAK_ALIASES, OAK_KITS } from "./pack.config.ts";

const ROOT = join(import.meta.dirname, "../..");
const table = JSON.parse(readFileSync(join(ROOT, "packages/strudel/audibility.json"), "utf8")) as {
  audible: Record<string, boolean>;
};
const quality = JSON.parse(readFileSync(join(ROOT, "packages/strudel/sound-quality.json"), "utf8")) as {
  aliases: { id: string }[];
};

/** Group-H rows that draw rather than sound (Oak's scope panels): no audibility case by design. */
const VISUAL = new Set(["tb.scope", "tb.fscope"]);
const groupH = toolbox.filter((t) => t.group === "H" && !VISUAL.has(t.id));
const sounds = toolbox.filter((t) => t.kind === "sound");

describe("audibility table", () => {
  test("every group-H control and every catalog sound has a case and a result", () => {
    const cased = new Set([...CONTROL_CASES, ...SOUND_CASES].map((c) => c.id));
    expect(groupH.map((t) => t.id).filter((id) => !cased.has(id))).toEqual([]);
    expect(sounds.map((t) => t.id).filter((id) => !cased.has(id))).toEqual([]);
    for (const id of cased) expect([id, typeof table.audible[id]]).toEqual([id, "boolean"]);
  });

  test("nothing the registry marks audible is unproven by the harness", () => {
    const claimed = toolbox.filter((t) => t.audible === true).map((t) => t.id);
    expect(claimed.filter((id) => table.audible[id] !== true)).toEqual([]);
  });

  test("Wave 3's pending entries are proven: tb.clip and snd.jazzkit", () => {
    expect(table.audible["tb.clip"]).toBe(true);
    expect(table.audible["snd.jazzkit"]).toBe(true);
  });

  test("every catalog sound is audible, the break (A2.L04) included, and the silent no-ops stay silent", () => {
    expect(sounds.filter((t) => table.audible[t.id] !== true).map((t) => t.id)).toEqual([]);
    const noops = Object.keys(table.audible).filter((id) => id.startsWith("noop."));
    expect(noops.length).toBeGreaterThan(0);
    for (const id of noops) expect([id, table.audible[id]]).toEqual([id, false]);
  });

  test("every tool and sound U05–U07 unlock has a case and is proven audible", () => {
    const wave4 = toolbox.filter(
      (t) => /^U0[567]\./.test(String(t.unlock.at)) && ["sound", "tool", "chord"].includes(t.kind),
    );
    expect(wave4.length).toBeGreaterThan(15);
    const cased = new Set([...CONTROL_CASES, ...SOUND_CASES].map((c) => c.id));
    expect(wave4.map((t) => t.id).filter((id) => !cased.has(id))).toEqual([]);
    expect(wave4.map((t) => t.id).filter((id) => table.audible[id] !== true)).toEqual([]);
  });

  test("every group-H row the harness proves audible is flagged audible in content/toolbox.ts", () => {
    const unflagged = groupH
      .filter((t) => t.audible !== true && table.audible[t.id] === true)
      .map((t) => t.id);
    if (unflagged.length)
      console.info(`proven audible, not flagged in content/toolbox.ts: ${unflagged.join(", ")}`);
    expect(unflagged).toEqual([]);
  });
});

describe("Wave 5: U08–U11 and the A1 side lessons", () => {
  const wave5 = JSON.parse(readFileSync(join(ROOT, "packages/strudel/sound-wave5.json"), "utf8")) as {
    audibility: {
      tools: { id: string; audible: boolean }[];
      lessons: { id?: string; audible: boolean; same?: boolean; lesson: string }[];
    };
    bass: { tuning: Record<string, unknown[]> };
    blues: { tuning: Record<string, unknown[]> };
  };
  /** Rows that shape the code, not the sound (form and naming): no audibility case by design. */
  const STRUCTURAL = new Set(["tb.const", "tb.arrange"]);
  const unlockedIn = (re: RegExp) =>
    toolbox.filter((t) => {
      const at = Array.isArray(t.unlock.at) ? t.unlock.at : [t.unlock.at];
      return at.some((s) => re.test(String(s)));
    });

  test("every tool, scale, chord and sound U08–U11 unlock has a case and is proven audible", () => {
    const rows = unlockedIn(/^U(0[89]|1[01])\./).filter(
      (t) => ["sound", "tool", "chord", "scale", "template"].includes(t.kind) && !STRUCTURAL.has(t.id),
    );
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const cased = new Set([...CONTROL_CASES, ...SOUND_CASES].map((c) => c.id));
    expect(rows.map((t) => t.id).filter((id) => !cased.has(id))).toEqual([]);
    expect(rows.map((t) => t.id).filter((id) => table.audible[id] !== true)).toEqual([]);
  });

  test("every sound control A1.L01–L04 teach is rendered in the lesson's own loop and heard there", () => {
    const taught = unlockedIn(/^A1\.L0[1-4]$/).filter((t) => t.group === "H" && !VISUAL.has(t.id));
    expect(taught.length).toBeGreaterThanOrEqual(10);
    const cased = new Set(A1_CASES.map((c) => c.id).filter((id) => id !== ""));
    expect(taught.map((t) => t.id).filter((id) => !cased.has(id))).toEqual([]);
    const rows = wave5.audibility.lessons.filter((r) => r.lesson.startsWith("A1."));
    expect(rows.length).toBe(A1_CASES.length);
    for (const r of rows) {
      if (r.same) expect([r.id, r.audible]).toEqual([r.id, false]);
      else if (r.id) expect([r.id, r.audible]).toEqual([r.id, true]);
    }
    // U08.L05's bass preset on every bass tone
    const bass = wave5.audibility.lessons.filter((r) => r.lesson === "U08.L05");
    expect(bass.length).toBe(BASS_TONE_CASES.length);
    expect(bass.every((r) => r.audible)).toBe(true);
  });

  test("the tuning table covers every pitched sound U08–U11 unlock", () => {
    const pitched = unlockedIn(/^U(0[89]|1[01])\./)
      .filter((t) => t.kind === "sound")
      .map((t) => t.id);
    const measured = new Set(QUALITY_CASES.map((c) => c.id));
    expect(pitched.filter((id) => !measured.has(id))).toEqual([]);
    // and the bass and blues registers they are played in
    expect(Object.keys(wave5.bass.tuning).sort()).toEqual(["ebass", "fingerbass", "synthbass", "upright"]);
    expect(Object.keys(wave5.blues.tuning).sort()).toEqual(["cleangtr", "crunch", "organ", "piano"]);
  });
});

describe("Wave 6: U12–U17", () => {
  const wave6 = JSON.parse(readFileSync(join(ROOT, "packages/strudel/sound-wave6.json"), "utf8")) as {
    audibility: {
      lessons: { id?: string; audible: boolean; lesson: string }[];
      tuning: Record<string, unknown[]>;
    };
  };
  const unlockedIn = (re: RegExp) =>
    toolbox.filter((t) => {
      const at = Array.isArray(t.unlock.at) ? t.unlock.at : [t.unlock.at];
      return at.some((s) => re.test(String(s)));
    });
  const rows = unlockedIn(/^U1[2-7]\./).filter((t) => ["sound", "tool", "chord", "scale"].includes(t.kind));

  test("every tool, chord, scale and sound U12–U17 unlock has a case and is proven audible", () => {
    expect(rows.length).toBeGreaterThanOrEqual(20);
    const cased = new Set([...CONTROL_CASES, ...SOUND_CASES].map((c) => c.id));
    expect(rows.map((t) => t.id).filter((id) => !cased.has(id))).toEqual([]);
    expect(rows.map((t) => t.id).filter((id) => table.audible[id] !== true)).toEqual([]);
  });

  test("every tool, chord and scale U12–U17 unlock is also heard in its lesson's own loop", () => {
    const taught = rows.filter((t) => t.kind !== "sound").map((t) => t.id);
    const inLesson = new Set(W6_LESSON_CASES.map((c) => c.id));
    expect(taught.filter((id) => !inLesson.has(id))).toEqual([]);
    const measured = wave6.audibility.lessons;
    expect(measured.length).toBe(W6_LESSON_CASES.length);
    expect(measured.filter((r) => !r.audible).map((r) => `${r.lesson} ${r.id}`)).toEqual([]);
  });

  test("the tuning table covers every pitched sound U12–U17 unlock, at the pitches its lessons play", () => {
    const pitched = rows.filter((t) => t.kind === "sound").map((t) => t.id.replace(/^snd\./, ""));
    expect(pitched.filter((s) => !(s in W6_TUNING))).toEqual([]);
    for (const [sound, midis] of Object.entries(W6_TUNING))
      expect([sound, wave6.audibility.tuning[sound]?.length]).toEqual([sound, midis.length]);
    const measured = new Set(QUALITY_CASES.map((c) => c.id));
    expect(pitched.map((s) => `snd.${s}`).filter((id) => !measured.has(id))).toEqual([]);
  });
});

describe("Wave 7: the advanced tracks", () => {
  const wave7 = JSON.parse(readFileSync(join(ROOT, "packages/strudel/sound-wave7.json"), "utf8")) as {
    audibility: {
      lessons: { id?: string; audible: boolean; lesson: string; same: boolean }[];
      tuning: Record<string, { midi: number; cents: number | null }[]>;
    };
  };
  const unlockedIn = (re: RegExp) =>
    toolbox.filter((t) => {
      const at = Array.isArray(t.unlock.at) ? t.unlock.at : [t.unlock.at];
      return at.some((s) => re.test(String(s)));
    });
  const TRACKS = /^(A1\.L0[5-7]|A2\.|J[1-5]\.|R[1-3]\.|JC[1-4]|RC[12]|AC[12])/;
  const rows = unlockedIn(TRACKS).filter(
    (t) => ["sound", "tool", "chord", "scale"].includes(t.kind) && !VISUAL.has(t.id),
  );

  test("every tool, chord, scale and sound the tracks unlock has a case and is proven audible", () => {
    expect(rows.length).toBeGreaterThanOrEqual(40);
    const cased = new Set([...CONTROL_CASES, ...SOUND_CASES].map((c) => c.id));
    expect(rows.map((t) => t.id).filter((id) => !cased.has(id))).toEqual([]);
    expect(rows.map((t) => t.id).filter((id) => table.audible[id] !== true)).toEqual([]);
  });

  test("every sound control A1.L05–L07 and A2 teach is heard in its lesson's loop; every silencer row is not", () => {
    const taught = unlockedIn(/^(A1\.L0[5-7]|A2\.)/).filter((t) => t.group === "H" && !VISUAL.has(t.id));
    expect(taught.length).toBeGreaterThanOrEqual(15);
    const inLesson = new Set(W7_LESSON_CASES.map((c) => c.id).filter((id) => id !== ""));
    expect(taught.map((t) => t.id).filter((id) => !inLesson.has(id))).toEqual([]);
    const measured = wave7.audibility.lessons;
    expect(measured.length).toBe(W7_LESSON_CASES.length);
    for (const r of measured) expect([r.lesson, r.id, r.audible]).toEqual([r.lesson, r.id, !r.same]);
    expect(measured.filter((r) => r.same).length).toBeGreaterThanOrEqual(5);
  });

  test("the tuning table covers every pitched sound the tracks unlock, at the pitches their lessons play", () => {
    const pitched = rows
      .filter((t) => t.kind === "sound" && t.group === "G" && !t.id.startsWith("snd.wave."))
      .map((t) => t.id.replace(/^snd\./, ""));
    const tuned = new Set([...Object.keys(W6_TUNING), ...Object.keys(W7_TUNING)]);
    expect(pitched.filter((s) => !tuned.has(s))).toEqual([]);
    for (const [sound, midis] of Object.entries(W7_TUNING)) {
      const got = wave7.audibility.tuning[sound] ?? [];
      expect([sound, got.length]).toEqual([sound, midis.length]);
      for (const t of got) {
        const known = W7_KNOWN_TUNING[sound]?.[t.midi];
        const ok =
          t.cents !== null &&
          (known !== undefined ? Math.abs(t.cents - known) <= 0.5 : Math.abs(t.cents) <= 10);
        expect([sound, t.midi, ok]).toEqual([sound, t.midi, true]);
      }
    }
  });
});

describe("pack aliases and kits against the catalog", () => {
  /** Group-G rows that are synth sources, not instruments (v4: noise and wavetables, several names each). */
  const SOURCES = new Set(["snd.noise", "snd.wt"]);
  const instruments = sounds.filter(
    (t) => t.group === "G" && !t.id.startsWith("snd.wave.") && t.id !== "snd.piano" && !SOURCES.has(t.id),
  );

  test("every catalog instrument is a curated alias of the pack, and every alias is in the catalog", () => {
    const aliases = Object.keys(OAK_ALIASES).map((a) => `snd.${a}`);
    expect(instruments.map((t) => t.id).filter((id) => !aliases.includes(id))).toEqual([]);
    const catalog = new Set<string>(sounds.map((t) => t.id));
    expect(aliases.filter((id) => !catalog.has(id))).toEqual([]);
  });

  test("every retired bank name plays an Oak kit, and keeps its catalog row", () => {
    for (const [old, kit] of Object.entries(KIT_ALIASES)) {
      expect([old, kit in OAK_KITS]).toEqual([old, true]);
      if (/^(Roland|LinnDrum|AkaiLinn)/.test(old))
        expect([old, sounds.some((t) => t.id === `snd.bank.${old}`)]).toEqual([old, true]);
    }
  });

  test("every Oak kit is a catalog sound", () => {
    for (const kit of Object.keys(OAK_KITS)) expect(sounds.some((t) => t.id === `snd.${kit}`)).toBe(true);
  });

  test("every alias and the piano are measured by the sound-quality harness", () => {
    const measured = new Set(quality.aliases.map((a) => a.id));
    const cases = new Set(QUALITY_CASES.map((c) => c.id));
    for (const id of ["snd.piano", ...Object.keys(OAK_ALIASES).map((a) => `snd.${a}`)]) {
      expect([id, cases.has(id)]).toEqual([id, true]);
      expect([id, measured.has(id)]).toEqual([id, true]);
    }
  });
});
