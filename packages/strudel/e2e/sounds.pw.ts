// Ports the S3 proofs through the production adapter: local-only sounds (piano, TR909, the curated
// aliases), the preloader against first-cycle skips, the master bus and recorder, direct playback, the
// pattern player, Oak's scope tap, and the Service Worker (CacheFirst /sounds/*, precache, offline).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { openPage } from "./helpers.ts";
import { SOUNDS_ROOT } from "./pack-root.ts";

// biome-ignore lint/suspicious/noExplicitAny: the test API is driven untyped from page.evaluate
type W = Window & { __oak: any };
const LOCK = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../../sounds/pack.lock.json"), "utf8"),
) as {
  packVersion: string;
  files?: { path: string }[];
  entries?: { path: string }[];
};

test("the test pages load the locked pack version", () => {
  expect(SOUNDS_ROOT).toBe(`/sounds/${LOCK.packVersion}`);
});

async function playFor(
  page: Page,
  code: string,
  ms = 1200,
): Promise<{ ok: boolean; rms: number; diagnostics: string[] }> {
  return page.evaluate(
    async ([code, ms]) => {
      const w = window as unknown as W;
      const e = w.__oak.oak.editors.get("oak_snd_0_") ?? w.__oak.mountImperative("oak_snd_0_", "");
      e.setCode(code);
      const out = await e.play();
      const { rms } = await w.__oak.maxLevel(ms);
      w.__oak.oak.stopAll(); // panic also cuts what is still ringing (soundfont tails)
      await new Promise((r) => setTimeout(r, 300));
      return { ok: out.ok, rms, diagnostics: out.diagnostics.map((d: { id: string }) => d.id) };
    },
    [code, ms] as const,
  );
}

test("zero non-localhost requests while playing piano, TR909 and the curated aliases", async ({ page }) => {
  const external: string[] = [];
  const sounds: string[] = [];
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") {
      external.push(url.href);
      return route.abort();
    }
    if (url.pathname.startsWith("/sounds/")) sounds.push(url.pathname);
    return route.continue();
  });
  const errors = await openPage(page);
  const cases: [string, string][] = [
    ["piano", 'note("c3 e3 g3 c4").s("piano")'],
    ["tr909", 's("bd hh sd hh").bank("RolandTR909")'],
    ["tr909 alias", 's("bd sd").bank("tr909")'],
    ["linndrum sh cb tb", 's("sh cb tb").bank("LinnDrum")'],
    ["uzu kit", 's("bd sd hh oh")'],
    ["rhodes", 'note("c3 e3 g3").s("rhodes")'],
    ["upright", 'note("c2 g2").s("upright")'],
    ["ebass", 'note("c2 g2").s("ebass")'],
    ["organ", 'note("c3 e3").s("organ")'],
    ["crunch", 'note("e2 b2").s("crunch")'],
    ["strings", 'note("c3 g3").s("strings")'],
    ["horns", 'note("c4 e4").s("horns")'],
    ["tenor", 'note("c4 d4").s("tenor")'],
    ["jazzgtr", 'note("c3 e3").s("jazzgtr")'],
    ["cleangtr", 'note("c3 e3").s("cleangtr")'],
    ["acgtr", 'n("0 2 4 7").scale("G3:major").s("acgtr")'],
    ["jazzkit", 's("bd ~ sd ~, rd*4, ~ rim").bank("jazzkit")'],
    ["jazzkit brushes", 's("sd sd:1 sd:2").bank("jazzkit")'],
    ["vibes", 'note("c4 e4").s("vibes")'],
    ["fingerbass", 'note("c2 g2").s("fingerbass")'],
    ["clav", 'note("c3 e3").s("clav")'],
    ["trumpet", 'note("c4 d4").s("trumpet")'],
  ];
  const quiet: string[] = [];
  for (const [name, code] of cases) {
    const r = await playFor(page, code);
    if (!r.ok || r.rms < 0.01)
      quiet.push(`${name}: ok=${r.ok} rms=${r.rms.toFixed(4)} ${r.diagnostics.join(",")}`);
  }
  expect(quiet).toEqual([]);
  expect(external).toEqual([]);
  expect(sounds.length).toBeGreaterThan(20);
  // an unmirrored gm_* name is unregistered: silence and a log line, never a request
  const before = sounds.length;
  const violin = await playFor(page, 'note("c4").s("gm_violin")', 600);
  expect(violin.rms).toBeLessThan(0.001);
  expect(sounds.length).toBe(before);
  const logs = await page.evaluate(() =>
    (window as unknown as W).__oak.logs.map((l: { message: string }) => l.message),
  );
  expect(logs.some((m: string) => /gm_violin not found/.test(m))).toBe(true);
  expect(errors.filter((e) => !/gm_violin/.test(e))).toEqual([]);
});

const SKIP_PATTERN =
  'stack(note("c3 e3 g3 b3").s("piano"), note("c2 g2").s("upright"), note("<[c3,e3,g3]>").s("rhodes"), s("bd hh sd hh").bank("RolandTR909"))';

async function slowSounds(page: Page): Promise<void> {
  await page.context().route("**/sounds/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.endsWith(".json")) await new Promise((r) => setTimeout(r, 300));
    return route.continue();
  });
}

test("without preload a slow pack skips first-cycle haps (control)", async ({ page }) => {
  await slowSounds(page);
  await openPage(page);
  const skips = await page.evaluate(async (code) => {
    const w = window as unknown as W;
    const stop = await w.__oak.rawPlay(code);
    await new Promise((r) => setTimeout(r, 2500));
    stop();
    return w.__oak.logs.filter((l: { skippedSound?: string }) => l.skippedSound).length;
  }, SKIP_PATTERN);
  expect(skips).toBeGreaterThan(0);
});

test("the adapter's play preloads the first cycles: no skips, audio from the first cycle", async ({
  page,
}) => {
  await slowSounds(page);
  await openPage(page);
  const r = await page.evaluate(async (code) => {
    const w = window as unknown as W;
    const e = w.__oak.mountImperative("oak_pre_0_", code);
    const out = await e.play();
    const level = await w.__oak.maxLevel(2000);
    e.stop();
    return {
      ok: out.ok,
      rms: level.rms,
      skips: w.__oak.logs.filter((l: { skippedSound?: string }) => l.skippedSound).length,
    };
  }, SKIP_PATTERN);
  expect(r.ok).toBe(true);
  expect(r.skips).toBe(0);
  expect(r.rms).toBeGreaterThan(0.05);
});

/** The U03–U04 sounds by name, as the lesson and drill hosts preload them before a stimulus. */
const WAVE3_SPEC = {
  sounds: [
    { s: "piano" },
    { s: "acgtr" },
    { s: "upright" },
    { s: "ebass" },
    { s: "rhodes" },
    ...["bd", "sd", "rd", "rim", "hh"].map((r) => ({ s: r, bank: "jazzkit" })),
  ],
};

test("U03–U04 sounds preloaded by name: a plan in a new key plays its first notes on a slow pack", async ({
  page,
}) => {
  await slowSounds(page);
  await openPage(page);
  const r = await page.evaluate(async (spec) => {
    const w = window as unknown as W;
    const { oak } = w.__oak;
    const report = await oak.preload(spec);
    // D major on the guitar (degrees 1 3 5 8 7 5), E on the upright, A major on the rhodes, the jazz kit:
    // pitches no octave-C warm-up would have touched, all inside the first half second.
    const ev = (at: number, value: Record<string, unknown>) => ({ at, dur: 0.2, value });
    const plan = {
      events: [
        ...[62, 66, 69, 74, 73, 69].map((note, i) => ev(i * 0.08, { s: "acgtr", note })),
        ev(0, { s: "upright", note: 40 }),
        ev(0.1, { s: "upright", note: 35 }),
        ev(0, { s: "ebass", note: 38 }),
        ...[57, 61, 64].map((note) => ev(0.05, { s: "rhodes", note })),
        ev(0, { s: "bd", bank: "jazzkit" }),
        ev(0.1, { s: "rd", bank: "jazzkit" }),
        ev(0.2, { s: "sd", bank: "jazzkit", n: 2 }),
        ev(0.25, { s: "rim", bank: "jazzkit" }),
      ],
      durationSec: 1,
      preload: spec.sounds.map((x: { s: string }) => x.s),
    };
    const before = w.__oak.logs.length;
    const h = oak.playEvents(plan);
    const level = await w.__oak.maxLevel(800);
    await h.done;
    oak.stopAll();
    const logs = w.__oak.logs.slice(before);
    return {
      report,
      skips: logs
        .filter((l: { skippedSound?: string }) => l.skippedSound)
        .map((l: { message: string }) => l.message),
      notFound: logs.filter((l: { message: string }) => /not found/.test(l.message)).length,
      rms: level.rms,
    };
  }, WAVE3_SPEC);
  expect(r.report.missing).toEqual([]);
  expect(r.skips).toEqual([]);
  expect(r.notFound).toBe(0);
  expect(r.rms).toBeGreaterThan(0.02);
});

test("a Band-style editor in the jazz-soul and indie kits plays from the first cycle on a slow pack", async ({
  page,
}) => {
  await slowSounds(page);
  await openPage(page);
  const r = await page.evaluate(async () => {
    const w = window as unknown as W;
    const code = [
      'drums: s("bd ~ sd [~ bd], rd*8").bank("jazzkit").gain(.65)',
      'bass: n("<-14 -10>").scale("D:major").s("upright").lpf(900)',
      'chords: n("[0,2,4]").scale("D4:major").struct("x ~ ~ [~ x]").s("rhodes").gain(.45)',
      'mel: n("0 2 4 7").scale("D4:major").s("acgtr")',
    ].join("\n");
    const e = w.__oak.mountImperative("oak_band3_0_", code);
    const before = w.__oak.logs.length;
    const out = await e.play();
    const level = await w.__oak.maxLevel(1500);
    e.stop();
    const logs = w.__oak.logs.slice(before);
    return {
      ok: out.ok,
      rms: level.rms,
      skips: logs.filter((l: { skippedSound?: string }) => l.skippedSound).length,
      notFound: logs.filter((l: { message: string }) => /not found/.test(l.message)).length,
    };
  });
  expect(r.ok).toBe(true);
  expect(r.skips).toBe(0);
  expect(r.notFound).toBe(0);
  expect(r.rms).toBeGreaterThan(0.02);
});

test("preload(spec) warms named sounds at their pitches and reports missing names", async ({ page }) => {
  await openPage(page);
  const r = await page.evaluate(async () => {
    const { oak } = (window as unknown as W).__oak;
    const progress: number[] = [];
    const report = await oak.preload(
      {
        sounds: [
          { s: "piano", notes: ["c3", "e3", 67] },
          { s: "bd", bank: "RolandTR909" },
          { s: "rhodes", notes: [60] },
          { s: "sine" },
          { s: "gm_violin" },
        ],
      },
      (done: number) => progress.push(done),
    );
    return { report, last: progress.at(-1), spec: oak.soundsIn('x: s("bd hh").bank("RolandTR909")') };
  });
  // piano at its 3 pitches, every variant of the TR-909 kick (3: the name plays Oak's oak909 since pack v4), the
  // rhodes at C4
  expect(r.report.warmed).toBe(7);
  expect(r.report.synths).toBe(1);
  expect(r.report.missing).toEqual(["gm_violin"]);
  expect(r.last).toBe(9);
  expect(r.spec.sounds).toEqual([
    { s: "bd", bank: "RolandTR909" },
    { s: "hh", bank: "RolandTR909" },
  ]);
});

test("master bus: limiter + trim, re-attach after a panic rebuilds superdough's output; recorder makes audio", async ({
  page,
}) => {
  await openPage(page);
  const r = await page.evaluate(async () => {
    const w = window as unknown as W;
    const { oak, maxLevel, decodeRecording } = w.__oak;
    const e = w.__oak.mountImperative("oak_bus_0_", 'note("c3 e3 g3 c4").s("sawtooth").gain(0.8)');
    await e.play();
    const playing = await maxLevel(500);
    const attached = oak.master.attachCount();
    const uiAudibleBefore = oak.ui.audible;
    const rec = oak.recorder.record({ bars: 1, tailSec: 0.5 });
    await new Promise((x) => setTimeout(x, 300));
    const recording = oak.recorder.recording;
    const uiDuring = oak.ui.audible;
    const recordingResult = await rec;
    const decoded = await decodeRecording(recordingResult.blob);
    oak.stopAll(); // panic: resetGlobalEffects -> superdough rebuilds destinationGain -> the bus re-attaches
    const afterPanic = oak.master.attachCount();
    await e.play();
    const again = await maxLevel(500);
    e.stop();
    return {
      trim: oak.master.trim.gain.value,
      threshold: oak.master.limiter.threshold.value,
      playing,
      attached,
      afterPanic,
      again,
      uiAudibleBefore,
      uiDuring,
      recording,
      mime: recordingResult.mime,
      bytes: recordingResult.blob.size,
      durationS: recordingResult.durationS,
      decoded,
      uiAfter: oak.ui.audible,
    };
  });
  expect(r.trim).toBeCloseTo(0.8213, 3);
  expect(r.threshold).toBe(-3);
  expect(r.playing.rms).toBeGreaterThan(0.05);
  expect(r.playing.peak).toBeLessThan(1);
  expect(r.afterPanic).toBe(r.attached + 1);
  expect(r.again.rms).toBeGreaterThan(0.05);
  expect(r.recording).toBe(true);
  expect(r.uiAudibleBefore).toBe(true);
  expect(r.uiDuring).toBe(false);
  expect(r.uiAfter).toBe(true);
  expect(r.mime).toContain("audio/");
  expect(r.bytes).toBeGreaterThan(5000);
  expect(r.durationS).toBeGreaterThan(2.2); // 1 bar at 0.5 cps + 0.5 s tail
  expect(r.durationS).toBeLessThan(3.2);
  expect(r.decoded.duration).toBeGreaterThan(2);
  expect(r.decoded.rms).toBeGreaterThan(0.01);
});

test("playEvents plays a plan precisely, stop cancels the rest; playNote sounds; scope panel opens", async ({
  page,
}) => {
  await openPage(page);
  const r = await page.evaluate(async () => {
    const w = window as unknown as W;
    const { oak, maxLevel } = w.__oak;
    await oak.preload({ sounds: [{ s: "piano", notes: [60, 64, 67] }] });
    const plan = {
      events: [0, 0.25, 0.5].map((at, i) => ({ at, dur: 0.4, value: { s: "piano", note: [60, 64, 67][i] } })),
      durationSec: 1,
      preload: ["piano"],
    };
    const t0 = oak.ctx.currentTime;
    const h = oak.playEvents(plan);
    const lead = h.startTime - t0;
    const level = await maxLevel(500);
    const active = oak.coordinator.get().kind;
    await h.done;
    oak.stopAll(); // the piano samples ring for seconds: cut them before the stop test
    await new Promise((x) => setTimeout(x, 300));
    const long = oak.playEvents({
      events: Array.from({ length: 20 }, (_, i) => ({
        at: i * 0.2,
        dur: 0.1,
        value: { s: "triangle", note: 60 },
      })),
      durationSec: 4,
      preload: [],
    });
    await new Promise((x) => setTimeout(x, 300));
    long.stop();
    await long.done;
    await new Promise((x) => setTimeout(x, 800));
    const afterStop = await maxLevel(300);
    oak.playNote({ s: "piano", note: ["c4", "e4", "g4"], dur: 0.5 });
    const note = await maxLevel(400);
    const e = w.__oak.mountImperative("oak_scope_0_", 'note("c3").s("sawtooth").scope()');
    const out = await e.play();
    await new Promise((x) => setTimeout(x, 300));
    const wave = oak.scope.wave();
    const spectrum = oak.scope.spectrum();
    e.stop();
    return {
      lead,
      level: level.rms,
      active,
      afterStop: afterStop.rms,
      note: note.rms,
      panels: out.panels,
      scope: oak.scope.get(),
      waveMax: Math.max(...wave.map(Math.abs)),
      bins: spectrum.length,
    };
  });
  expect(r.lead).toBeGreaterThan(0.05);
  expect(r.lead).toBeLessThan(0.15);
  expect(r.level).toBeGreaterThan(0.02);
  expect(r.active).toBe("plan");
  expect(r.afterStop).toBeLessThan(0.001);
  expect(r.note).toBeGreaterThan(0.02);
  expect(r.panels).toEqual(["scope"]);
  expect(r.scope).toEqual({ editorId: "oak_scope_0_", panels: ["scope"] });
  expect(r.waveMax).toBeGreaterThan(0.01);
  expect(r.bins).toBe(1024);
});

test("pattern player: hidden code, rate as cps scale, live transpose and loop, coordinator", async ({
  page,
}) => {
  await openPage(page);
  const r = await page.evaluate(async () => {
    const w = window as unknown as W;
    const { oak, maxLevel } = w.__oak;
    const p = oak.createPatternPlayer();
    const out = await p.load('mel: note("<c4 d4 e4 f4>").s("piano")\ndrums: s("bd*2")', { bars: 4, cps: 1 });
    await p.play();
    const level = await maxLevel(500);
    const full = oak.transport.cps();
    p.setRate(0.5);
    const half = oak.transport.cps();
    p.setTranspose(3);
    p.setLoop({ fromBar: 2, bars: 2 });
    const haps = oak.transport
      .haps(0, 2)
      .filter((h: { track: string }) => h.track === "mel")
      .map((h: { value: { note: unknown } }) => h.value.note);
    const domains = {
      active: oak.coordinator.get().kind,
      playing: p.playing,
      positionOk: p.position() >= 2 && p.position() < 4,
    };
    // an editor starting stops the player (only one source plays)
    const e = w.__oak.mountImperative("oak_pp_0_", 'note("c3").s("sine")');
    await e.play();
    const after = { player: p.playing, editor: e.playing };
    e.stop();
    p.dispose();
    return { ok: out.ok, tracks: out.tracks, level: level.rms, full, half, haps, domains, after };
  });
  expect(r.ok).toBe(true);
  expect(r.tracks).toEqual(["mel", "drums"]);
  expect(r.level).toBeGreaterThan(0.02);
  expect(r.full).toBeCloseTo(1);
  expect(r.half).toBeCloseTo(0.5);
  expect(r.haps).toEqual([67, 68]); // bars 3–4 (e4 f4) up a minor third: G4 Ab4
  expect(r.domains).toEqual({ active: "pattern-player", playing: true, positionOk: true });
  expect(r.after).toEqual({ player: false, editor: true });
});

test("Service Worker: CacheFirst /sounds/*, precache of the whole pack, sounds served offline", async ({
  page,
}) => {
  await openPage(page);
  await page.evaluate(async (version) => {
    await navigator.serviceWorker.register(`/sw.js?pack=${version}`);
    await navigator.serviceWorker.ready;
  }, LOCK.packVersion);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => (window as unknown as W).__oak.oak.ready);
  const files = await page.evaluate(() => (window as unknown as W).__oak.oak.packFiles());
  // Every file of the pack the app can play; the credits and licence texts (v4: CREDITS.md, LICENSES/) are
  // documents, served but never precached.
  const lockCount = (LOCK.files ?? LOCK.entries ?? []).filter((f) => !/\.(md|txt)$/.test(f.path)).length;
  expect(files.length).toBe(lockCount);
  expect(files.every((f: { bytes: number }) => f.bytes > 0)).toBe(true);
  const sw = (msg: unknown) =>
    page.evaluate(
      (msg) =>
        // biome-ignore lint/suspicious/noExplicitAny: the test API is driven untyped from page.evaluate
        new Promise<any>((resolve) => {
          const ch = new MessageChannel();
          ch.port1.onmessage = (e) => {
            if (e.data?.type !== "progress") resolve(e.data);
          };
          navigator.serviceWorker.controller?.postMessage(msg, [ch.port2]);
        }),
      msg,
    );
  const done = await sw({ type: "precache", urls: files.map((f: { url: string }) => f.url) });
  expect(done.errors).toEqual([]);
  expect(done.soundsCached).toBe(lockCount);
  await page.context().setOffline(true);
  const offline = await page.evaluate(
    async (url) => {
      const res = await fetch(url);
      return { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
    },
    files.find((f: { url: string }) => f.url.includes("Hat%20Closed"))?.url ?? files[5].url,
  );
  await page.context().setOffline(false);
  expect(offline.status).toBe(200);
  expect(offline.bytes).toBeGreaterThan(100);
  const stats = await sw({ type: "stats" });
  expect(stats.soundsFromCache).toBeGreaterThan(0);

  // Offline reload: the page, the prebake and the U03–U04 sounds all come from the worker's caches.
  await page.context().setOffline(true);
  try {
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { __oak?: unknown }).__oak !== undefined);
    const played = await page.evaluate(async () => {
      const w = window as unknown as W;
      await w.__oak.oak.ready;
      const e = w.__oak.mountImperative("oak_offline_0_", "");
      e.setCode('mel: n("0 2 4 7").scale("G3:major").s("acgtr")\ndrums: s("bd rd sd rd").bank("jazzkit")');
      const out = await e.play();
      const level = await w.__oak.maxLevel(1200);
      e.stop();
      return { ok: out.ok, rms: level.rms };
    });
    expect(played.ok).toBe(true);
    expect(played.rms).toBeGreaterThan(0.01);
  } finally {
    await page.context().setOffline(false);
  }
});
