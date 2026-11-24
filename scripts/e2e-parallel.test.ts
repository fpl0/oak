import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import {
  E2E_SUFFIX,
  frontEndCommand,
  oakStack,
  parseShift,
  REPO_ROOT,
  shifted,
} from "../e2e/support/stack.ts";
import {
  autoJobs,
  type BudgetFile,
  balance,
  checkBudgets,
  type Durations,
  eachTest,
  type Listed,
  merge,
  narrowToFiles,
  outcomeOf,
  type Project,
  parseArgs,
  pinFiles,
  plan,
  projectsFor,
  readBudgets,
  readReport,
  rerunPlan,
  SERIAL_RE,
  settle,
  tally,
  wholeSuite,
} from "./e2e-parallel.ts";

const project = (
  name: string,
  files: Record<string, number>,
  servers: string[],
  testDir: string,
): Project => ({
  name,
  files: new Map(Object.entries(files)),
  servers,
  testDir,
});

const PROJECTS = new Map<string, Project>([
  ["lesson", project("lesson", { "app/src/lesson/e2e/a.pw.ts": 2 }, ["oak-api:8801"], "app/src/lesson/e2e")],
  ["drills", project("drills", { "app/src/drills/e2e/d.pw.ts": 1 }, ["oak-api:8803"], "app/src/drills/e2e")],
  ["session-seeds", project("session-seeds", {}, ["oak-api:8835"], "app/src/session/seeds/e2e")],
  ["session", project("session", {}, ["oak-api:8805"], "app/src/session/e2e")],
  ["journey", project("journey", {}, ["oak-api:8812"], "e2e/journey")],
  ["review", project("review", {}, ["oak-api:8821"], "e2e/review")],
  ["map", project("map", {}, ["oak-api:8807"], "app/src/map/e2e")],
  ["ui-review", project("ui-review", {}, ["oak-api:8822"], "app/src/ui/review/e2e")],
]);

describe("--since", () => {
  test("a spec or helper in a project's own folder selects that project", () => {
    const r = projectsFor(["app/src/session/seeds/e2e/support.ts"], PROJECTS);
    expect(r.selected).toEqual(new Set(["session-seeds"]));
  });
  test("an area's source selects the projects that cover it", () => {
    const r = projectsFor(["app/src/drills/DrillRunner.tsx"], PROJECTS);
    expect(r.selected).toEqual(new Set(["drills", "session-seeds", "journey", "review"]));
  });
  test("documentation selects nothing", () => {
    expect(projectsFor(["docs/design/wave5.md"], PROJECTS).selected).toEqual(new Set());
  });
  test("a shared path selects everything", () => {
    expect(projectsFor(["server/src/app.ts"], PROJECTS).selected).toBe("*");
    expect(projectsFor(["e2e/support/stack.ts"], PROJECTS).selected).toBe("*");
    expect(projectsFor(["app/src/ui/kit/Button.tsx"], PROJECTS).selected).toBe("*");
  });
});

describe("shards", () => {
  test("files are balanced longest first", () => {
    const s = balance(
      [
        ["a", 300],
        ["b", 200],
        ["c", 200],
        ["d", 100],
      ],
      2,
    );
    expect(s.map((x) => x.seconds).sort()).toEqual([400, 400]);
  });
  test("a long project alone on its stack is cut into shards on shifted ports; shared stacks are not", () => {
    const files: Record<string, number> = {};
    const d: Durations = { generated: "", projects: {}, files: {} };
    for (let i = 0; i < 6; i++) {
      files[`e2e/journey/j${i}.pw.ts`] = 1;
      d.files[`journey › e2e/journey/j${i}.pw.ts`] = 300;
    }
    const units = plan(
      [
        project("journey", files, ["oak-api:8812"], "e2e/journey"),
        project("platform", { "e2e/p.pw.ts": 1 }, ["platform-api:8787"], "e2e"),
        project("app", { "app/e2e/s.pw.ts": 1 }, ["platform-api:8787"], "app/e2e"),
      ],
      d,
      300,
    );
    const journey = units.filter((u) => u.projects.includes("journey"));
    expect(journey.length).toBe(5); // 30 minutes / 7 per chain
    expect(new Set(journey.map((u) => u.shift)).size).toBe(journey.length);
    expect(journey.every((u) => u.shift >= 300 && u.shift % 100 === 0)).toBe(true);
    expect(journey.flatMap((u) => u.files).sort()).toEqual(Object.keys(files).sort());
    const platform = units.filter((u) => u.projects.includes("platform"));
    expect(platform).toHaveLength(1);
    expect(platform[0]?.projects).toEqual(["platform", "app"]);
  });
  test("quiet files run apart from the loud rest of their project", () => {
    const units = plan(
      [
        project(
          "transcribe",
          { "app/src/transcribe/e2e/ab-drift.pw.ts": 1, "app/src/transcribe/e2e/ladder.pw.ts": 5 },
          ["oak-api:8813"],
          "app/src/transcribe/e2e",
        ),
      ],
      { generated: "", projects: {}, files: {} },
      0,
    );
    expect(units.map((u) => [u.name, u.quiet, u.files])).toEqual([
      ["transcribe.quiet", true, ["app/src/transcribe/e2e/ab-drift.pw.ts"]],
      ["transcribe.loud", false, ["app/src/transcribe/e2e/ladder.pw.ts"]],
    ]);
  });
});

describe("arguments", () => {
  test("flags and the pass-through", () => {
    const a = parseArgs([
      "--jobs",
      "3",
      "--project=lesson",
      "--since",
      "HEAD~1",
      "--shift=300",
      "--",
      "--grep",
      "x",
    ]);
    expect(a).toMatchObject({ jobs: 3, since: "HEAD~1", shift: 300, config: null, rest: ["--grep", "x"] });
    expect(parseArgs(["--config", "test-results/x/playwright.config.ts"]).config).toBe(
      "test-results/x/playwright.config.ts",
    );
    expect(a.only).toEqual(new Set(["lesson"]));
  });
  test("--file is repeatable and repo-relative", () => {
    expect(parseArgs([]).files).toBeNull();
    expect(parseArgs(["--file", "app/src/x/e2e/a.pw.ts", "--file=./e2e/b.pw.ts"]).files).toEqual(
      new Set(["app/src/x/e2e/a.pw.ts", "e2e/b.pw.ts"]),
    );
  });
  test("a shift must leave room for the shards", () => {
    expect(() => parseArgs(["--shift", "4999"])).toThrow();
    expect(() => parseArgs(["--shift", "305"])).toThrow();
  });
});

describe("outcomes", () => {
  const t = (status: string, results: { status: string; annotations?: { type: string }[] }[]) => ({
    projectName: "p",
    status,
    results: results.map((r) => ({ ...r, duration: 1000 })),
  });
  test("a skip the spec asked for is skipped; Playwright's other 'skipped' and a missing result did not run", () => {
    expect(outcomeOf(t("expected", [{ status: "passed" }]))).toBe("passed");
    expect(outcomeOf(t("unexpected", [{ status: "failed" }]))).toBe("failed");
    expect(outcomeOf(t("skipped", [{ status: "skipped", annotations: [{ type: "skip" }] }]))).toBe("skipped");
    expect(outcomeOf(t("skipped", [{ status: "skipped", annotations: [{ type: "fixme" }] }]))).toBe(
      "skipped",
    );
    // The rest of a serial file after a failure: reported "skipped" with no skip asked for.
    expect(outcomeOf(t("skipped", [{ status: "skipped" }]))).toBe("notRun");
    expect(outcomeOf(t("unexpected", [{ status: "interrupted" }]))).toBe("notRun");
    expect(outcomeOf(t("skipped", []))).toBe("notRun");
  });

  const L = (project: string, file: string, title: string): Listed => ({
    key: `${project} › ${file} › ${title}`,
    project,
    file,
  });
  const a = L("p", "a.pw.ts", "one");
  const b = L("p", "a.pw.ts", "two");
  const c = L("q", "c.pw.ts", "three");
  const report = (o: Record<string, string>, exit = 1, errors: string[] = []) => {
    const r = readReport({ errors: errors.map((message) => ({ message })) }, exit);
    for (const [k, v] of Object.entries(o)) r.outcomes.set(k, v as never);
    return r;
  };

  test("a listed test the report does not name did not run; a server that never started names every test", () => {
    const s = settle(
      [a, b, c],
      report({}, 1, ["Error: Process from config.webServer was not able to start."]),
    );
    expect([...s.outcomes.values()]).toEqual(["notRun", "notRun", "notRun"]);
    expect(s.errors).toHaveLength(1);
    expect(settle([a], report({ [a.key]: "passed" }, 0)).errors).toEqual([]);
    // A non-zero exit with everything passed is still a failure.
    expect(settle([a], report({ [a.key]: "passed" }, 1)).errors).toHaveLength(1);
  });

  test("load-sensitive only when it failed beside others and passed alone; a test failing alone never is", () => {
    const first = settle([a, b, c], report({ [a.key]: "failed", [b.key]: "failed", [c.key]: "passed" }));
    const rerun = new Set([a.key, b.key]);
    const m = merge(first, settle([a, b], report({ [a.key]: "passed", [b.key]: "failed" })), rerun);
    expect(m.loadSensitive).toEqual([a.key]);
    expect(m.outcomes.get(b.key)).toBe("failed");
    // Alone, its server could not start: not load-sensitive, and not passed.
    const m2 = merge(first, settle([a, b], report({}, 1, ["webServer"])), rerun);
    expect(m2.loadSensitive).toEqual([]);
    expect(m2.outcomes.get(a.key)).toBe("notRun");
    expect(m2.errors).toEqual(["webServer"]);
  });

  test("only the tests run again are decided by the alone run; the others keep their first outcome", () => {
    const first = settle([a, b, c], report({ [a.key]: "failed", [b.key]: "passed", [c.key]: "passed" }));
    // The alone run of a.pw.ts:<line of a> reports only a.
    const m = merge(first, settle([a], report({ [a.key]: "passed" }, 0)), new Set([a.key]));
    expect(m.loadSensitive).toEqual([a.key]);
    expect(m.outcomes.get(b.key)).toBe("passed");
    expect(m.outcomes.get(c.key)).toBe("passed");
  });

  test("per-project counts add up to the listing", () => {
    const rows = tally(
      new Map([
        [a.key, "passed"],
        [b.key, "notRun"],
        [c.key, "skipped"],
      ] as const),
    );
    expect(rows.get("p")).toEqual({ passed: 1, failed: 0, flaky: 0, skipped: 0, notRun: 1 });
    expect(rows.get("q")).toEqual({ passed: 0, failed: 0, flaky: 0, skipped: 1, notRun: 0 });
  });
});

// e2e/support/stack.ts (bunfig ignores e2e/**, so its logic is tested here)

test("OAK_E2E_SHIFT: a multiple of 10 below 5000", () => {
  expect(parseShift(undefined)).toBe(0);
  expect(parseShift("")).toBe(0);
  expect(parseShift("300")).toBe(300);
  expect(() => parseShift("-100")).toThrow();
  expect(() => parseShift("305")).toThrow();
  expect(() => parseShift("5000")).toThrow();
  expect(() => parseShift("abc")).toThrow();
});

test("oakStack takes the standard ports and moves them by this process's shift", () => {
  const s = oakStack({ vitePort: 5201, apiPort: 8801, dataDirName: "lesson" });
  expect(s.baseURL).toBe(`http://127.0.0.1:${shifted(5201)}`);
  expect(s.apiURL).toBe(`http://127.0.0.1:${shifted(8801)}`);
  expect(s.dataDir.endsWith(`test-results/stacks/lesson${E2E_SUFFIX}`)).toBe(true);
  expect(s.webServer.map((w) => w.name)).toEqual([`oak-api:${shifted(8801)}`, `oak-vite:${shifted(5201)}`]);
  expect(s.webServer[1]?.command).toContain("e2e/support/vite.e2e.config.ts");
});

describe("the alone re-run", () => {
  const T = (file: string, title: string, line: number): Listed => ({
    key: `p › ${file} › ${title}`,
    project: "p",
    file,
    line,
  });
  const x1 = T("x.pw.ts", "one", 10);
  const x2 = T("x.pw.ts", "two", 20);
  const x3 = T("x.pw.ts", "three", 30);
  const loopA = T("y.pw.ts", "cell paper", 5);
  const loopB = T("y.pw.ts", "cell bark", 5);
  const s1 = T("s.pw.ts", "first", 3);
  const s2 = T("s.pw.ts", "second", 9);
  const tests = [x1, x2, x3, loopA, loopB, s1, s2];
  const serial = (f: string) => f === "s.pw.ts";

  test("a file whose tests stand alone: exactly the failed and not-run tests, by line", () => {
    const r = rerunPlan([x2.key, x3.key], tests, serial);
    expect(r.filters).toHaveLength(2);
    expect(r.filters[0]?.endsWith("x\\.pw\\.ts$:20")).toBe(true);
    expect(r.filters[1]?.endsWith("x\\.pw\\.ts$:30")).toBe(true);
    expect(r.keys).toEqual(new Set([x2.key, x3.key]));
  });
  test("tests made in a loop share a line: all of them run again and are decided by it", () => {
    const r = rerunPlan([loopB.key], tests, serial);
    expect(r.filters).toHaveLength(1);
    expect(r.keys).toEqual(new Set([loopA.key, loopB.key]));
  });
  test("a serial file runs again whole", () => {
    const r = rerunPlan([s2.key], tests, serial);
    expect(r.filters).toHaveLength(1);
    expect(r.filters[0]?.endsWith("s\\.pw\\.ts$")).toBe(true);
    expect(r.keys).toEqual(new Set([s1.key, s2.key]));
  });
  test("a test with no known line (not in the listing) runs its whole file", () => {
    const r = rerunPlan(["p › z.pw.ts › ghost"], tests, serial);
    expect(r.filters).toHaveLength(1);
    expect(r.keys).toEqual(new Set(["p › z.pw.ts › ghost"]));
  });
  // A listing as `playwright test --list --reporter json` gives it: the suite's file is the spec that owns the
  // test, a spec's own `file` and `line` are where test() was called (app/src/lesson/e2e/w3walk.ts:38 for the walks).
  const one = (title: string, file: string, line: number) => ({
    title,
    file,
    line,
    tests: [{ projectName: "lesson", results: [] }],
  });
  const LISTING = {
    suites: [
      {
        file: "walk-u03a.pw.ts",
        specs: [one("U03.L01: every step", "w3walk.ts", 38), one("U03.L02: every step", "w3walk.ts", 38)],
      },
      { file: "own.pw.ts", specs: [one("first", "own.pw.ts", 7), one("second", "own.pw.ts", 12)] },
      {
        file: "mixed.pw.ts",
        specs: [one("the last one, declared in the spec", "mixed.pw.ts", 9)],
        suites: [{ title: "chain", specs: [one("c1", "chain.ts", 4), one("c2", "chain.ts", 4)] }],
      },
      // p1 sits on line 6 of the helper, p2 on line 6 of the spec: the same number, two different places.
      { file: "plain.pw.ts", specs: [one("p1", "plain.ts", 6), one("p2", "plain.pw.ts", 6)] },
    ],
  };
  const listedFx: Listed[] = eachTest(LISTING, (f) => f).map(({ test: _t, ...l }) => l);
  const keyOf = (title: string): string => listedFx.find((t) => t.key.endsWith(title))?.key as string;
  // Only the helpers say "serial": w3walk.ts and chain.ts. No spec file does.
  const helperSerial = (f: string) => f === "w3walk.ts" || f === "chain.ts";

  test("the listing keeps the file that declares a test when it is not the spec that owns it", () => {
    expect(listedFx.map((t) => [t.file, t.declaredIn, t.line])).toEqual([
      ["walk-u03a.pw.ts", "w3walk.ts", 38],
      ["walk-u03a.pw.ts", "w3walk.ts", 38],
      ["own.pw.ts", undefined, 7],
      ["own.pw.ts", undefined, 12],
      ["mixed.pw.ts", undefined, 9],
      ["mixed.pw.ts", "chain.ts", 4],
      ["mixed.pw.ts", "chain.ts", 4],
      ["plain.pw.ts", "plain.ts", 6],
      ["plain.pw.ts", undefined, 6],
    ]);
  });
  test("a test a helper declares: its whole owning spec file runs again, never <spec>:<the helper's line>", () => {
    // Not serial anywhere: the declaring file alone decides.
    const r = rerunPlan([keyOf("p1")], listedFx, () => false);
    expect(r.filters).toHaveLength(1);
    expect(r.filters[0]?.endsWith("plain\\.pw\\.ts$")).toBe(true);
    expect(r.filters.some((f) => /:\d+$/.test(f))).toBe(false);
    expect(r.keys).toEqual(new Set([keyOf("p1"), keyOf("p2")]));
    // The walks (app/src/lesson/e2e/walk-u03a.pw.ts ← w3walk.ts:38).
    const w = rerunPlan([keyOf("U03.L02: every step")], listedFx, helperSerial);
    expect(w.filters).toHaveLength(1);
    expect(w.filters[0]?.endsWith("walk-u03a\\.pw\\.ts$")).toBe(true);
    expect(w.keys).toEqual(new Set([keyOf("U03.L01: every step"), keyOf("U03.L02: every step")]));
  });
  test("a test the spec declares itself, beside helper-declared ones, is still re-run by its line", () => {
    const r = rerunPlan([keyOf("p2")], listedFx, () => false);
    expect(r.filters).toHaveLength(1);
    expect(r.filters[0]?.endsWith("plain\\.pw\\.ts$:6")).toBe(true);
    // plain.pw.ts:6 does not select p1 (plain.ts:6): p1 is not expected of the re-run and keeps its first outcome.
    expect(r.keys).toEqual(new Set([keyOf("p2")]));
    const o = rerunPlan([keyOf("second")], listedFx, helperSerial);
    expect(o.filters[0]?.endsWith("own\\.pw\\.ts$:12")).toBe(true);
    expect(o.keys).toEqual(new Set([keyOf("second")]));
  });
  test("serial mode set by a helper that declares a file's tests makes the whole file run again", () => {
    // The failed test is declared in mixed.pw.ts itself, whose source never says "serial": chain.ts does.
    const r = rerunPlan([keyOf("the last one, declared in the spec")], listedFx, helperSerial);
    expect(r.filters).toHaveLength(1);
    expect(r.filters[0]?.endsWith("mixed\\.pw\\.ts$")).toBe(true);
    expect(r.keys).toEqual(new Set([keyOf("the last one, declared in the spec"), keyOf("c1"), keyOf("c2")]));
  });
  test("serial files are recognised by their source", () => {
    expect(SERIAL_RE.test('test.describe.configure({ mode: "serial" });')).toBe(true);
    expect(SERIAL_RE.test("test.describe.serial('x', () => {})")).toBe(true);
    expect(SERIAL_RE.test('test.describe.configure({ mode: "parallel" });')).toBe(false);
    expect(SERIAL_RE.test("test('serial numbers', () => {})")).toBe(false);
  });
});

describe("budgets", () => {
  const file: BudgetFile = {
    totalMinutes: 20,
    tolerance: 0.15,
    budgets: [
      { name: "lesson", projects: ["lesson"], minutes: 10 },
      { name: "days", projects: ["drills", "map"], minutes: 6 },
    ],
  };
  const verdicts = (r: ReturnType<typeof checkBudgets>) =>
    Object.fromEntries([...r.rows, ...(r.total ? [r.total] : [])].map((x) => [x.name, x.verdict]));

  test("under, within the 15 % tolerance, and over it", () => {
    expect(verdicts(checkBudgets(file, { lesson: 9.9 }, new Set(["lesson"]), false))).toEqual({
      lesson: "under",
    });
    const within = checkBudgets(file, { lesson: 11.4 }, new Set(["lesson"]), false);
    expect(verdicts(within)).toEqual({ lesson: "within tolerance" });
    expect(within.failed).toBe(false);
    const over = checkBudgets(file, { lesson: 11.6 }, new Set(["lesson"]), false);
    expect(verdicts(over)).toEqual({ lesson: "OVER" });
    expect(over.failed).toBe(true);
  });
  test("a group is checked on the sum of its projects, and only when all of them ran", () => {
    const all = checkBudgets(file, { drills: 4, map: 2.8 }, new Set(["drills", "map"]), false);
    expect(all.rows[0]).toMatchObject({ name: "days", measured: 6.8, verdict: "within tolerance" });
    const part = checkBudgets(file, { drills: 9 }, new Set(["drills"]), false);
    expect(verdicts(part)).toEqual({ days: "partial" });
    expect(part.failed).toBe(false);
  });
  test("a partial run checks only what it ran and never the total; a full run checks the total", () => {
    expect(checkBudgets(file, { lesson: 5 }, new Set(["lesson"]), false).total).toBeNull();
    const full = checkBudgets(
      file,
      { lesson: 10, drills: 6, map: 5 },
      new Set(["lesson", "drills", "map"]),
      true,
    );
    expect(full.total).toMatchObject({ measured: 21, verdict: "OVER" });
    expect(full.failed).toBe(true);
    const ok = checkBudgets(
      file,
      { lesson: 10, drills: 5, map: 1 },
      new Set(["lesson", "drills", "map"]),
      true,
    );
    expect(ok.failed).toBe(false);
  });
  test("the whole suite is decided by the tests a run was given, not by its arguments", () => {
    const whole = ["a › x.pw.ts › one", "a › x.pw.ts › two", "b › y.pw.ts › three"];
    // `-- --trace on`, `-- --workers 1`: the listing with the pass-through is the listing without it.
    expect(wholeSuite([...whole], whole)).toBe(true);
    // `-- -g one`, `-- --grep-invert two`, a file after `--`, `-- --shard 1/2`: some tests are left out.
    expect(wholeSuite(["a › x.pw.ts › one"], whole)).toBe(false);
    expect(wholeSuite(["a › x.pw.ts › one", "b › y.pw.ts › three"], whole)).toBe(false);
    // `--project a`, or `--since` selecting only a: project b is left out.
    expect(wholeSuite(["a › x.pw.ts › one", "a › x.pw.ts › two"], whole)).toBe(false);
    // `--project a --project b`, or `--since` on a shared path: everything, whatever the flag.
    expect(wholeSuite([whole[2] as string, whole[0] as string, whole[1] as string], whole)).toBe(true);
    expect(wholeSuite([], whole)).toBe(false);
    // The total feeds on it: enforced exactly when the selection is whole.
    const m = { lesson: 10, drills: 6, map: 5 };
    const ran = new Set(["lesson", "drills", "map"]);
    expect(checkBudgets(file, m, ran, wholeSuite([...whole], whole)).failed).toBe(true);
    expect(checkBudgets(file, m, ran, wholeSuite(whole.slice(1), whole)).total).toBeNull();
  });
  test("a project that ran with no budget fails the run", () => {
    const r = checkBudgets(file, { lesson: 1, novel: 0.1 }, new Set(["lesson", "novel"]), false);
    expect(verdicts(r)).toEqual({ lesson: "under", novel: "no budget" });
    expect(r.failed).toBe(true);
  });
  test("a project may not sit in two budgets; e2e/budgets.json is valid and covers every project", () => {
    expect(() =>
      readBudgets({ ...file, budgets: [...file.budgets, { name: "x", projects: ["map"], minutes: 1 }] }),
    ).toThrow();
    const real = readBudgets(JSON.parse(readFileSync(`${REPO_ROOT}e2e/budgets.json`, "utf8")));
    // 105 after the suite pass; 131 after Wave 6 (docs/decisions.md 63: the new specs' measured minutes only); 134
    // after the Wave 6 gate (decision 66: the two review specs); 134.9 after Wave 7 Foundation (decision 73: the
    // offline renderer's and the illustrated Oak's specs, measured); 156.8 after Wave 7 (decision 79: the new specs'
    // measured minutes only); 160.7 after the Wave 7 gate (decision 85: the reviews' new specs, measured); 205.7
    // after the unit songs (d94f372: songs.pw.ts and every take lesson opening its unit song, measured).
    expect(real.totalMinutes).toBe(205.7);
    const covered = new Set(real.budgets.flatMap((b) => b.projects));
    for (const p of [
      "lesson",
      "journey",
      "review",
      "session-seeds",
      "drills",
      "onboarding",
      "session",
      "map",
      "ui-review",
      "capstone",
      "answers",
      "review-studio",
      "tutor",
      "studio",
      "workbench-w3",
      "kit",
      "platform",
      "app",
      "notation",
      "strudel-autoplay",
      "strudel-gesture",
      "audio",
      "voice",
      "transcribe",
      "workbench",
    ])
      expect(covered.has(p)).toBe(true);
  });
  test("flags: --no-budget, --no-bundle; quiet streams default to 2", () => {
    expect(parseArgs([])).toMatchObject({ budget: true, bundle: true, quietJobs: 2 });
    expect(parseArgs(["--no-budget", "--no-bundle", "--quiet-jobs", "1"])).toMatchObject({
      budget: false,
      bundle: false,
      quietJobs: 1,
    });
  });
});

test("jobs from the machine's size: 6 on 8 performance cores and 32 GB; memory caps it; never under 2 or over 10", () => {
  const GB = 2 ** 30;
  // Wave 7 (wave7.md §7.2): three quarters of the performance cores, else half the cores.
  expect(autoJobs(12, 32 * GB, 8)).toBe(6);
  expect(autoJobs(12, 32 * GB, null)).toBe(6);
  expect(autoJobs(12, 16 * GB, 8)).toBe(5);
  expect(autoJobs(2, 4 * GB, null)).toBe(2);
  expect(autoJobs(32, 128 * GB, null)).toBe(10);
  expect(autoJobs(16, 64 * GB, 12)).toBe(9);
});

test("a stack serves the runner's development bundle with vite preview when it has one, else the dev server", () => {
  expect(frontEndCommand("/tmp/bundle")).toContain(
    'preview --config e2e/support/vite.e2e.config.ts --outDir "/tmp/bundle"',
  );
  expect(frontEndCommand(null)).not.toContain("preview");
  expect(frontEndCommand(null)).toContain("--config e2e/support/vite.e2e.config.ts");
});

// The runner itself over a fixture config (`--config`, as its header says): real Playwright listings and runs, no
// browser, no server, no port. The fixture lives under test-results/ (Playwright resolves @playwright/test from the
// repo) and is removed afterwards.
describe("the runner over a fixture config", () => {
  const dir = `${REPO_ROOT}test-results/e2e-runner-fx-${process.pid}`;
  const fixture = (name: string, budgets: BudgetFile | null): string => {
    const d = `${dir}/${name}`;
    mkdirSync(`${d}/a`, { recursive: true });
    mkdirSync(`${d}/b`, { recursive: true });
    writeFileSync(
      `${d}/playwright.config.ts`,
      `import { defineConfig } from "@playwright/test";
export const projectServers: Record<string, string[]> = {};
export default defineConfig({
  testMatch: /.*\\.pw\\.ts$/,
  workers: 1,
  projects: [
    { name: "fx-a", testDir: "./a" },
    { name: "fx-b", testDir: "./b" },
  ],
});
`,
    );
    writeFileSync(
      `${d}/a/one.pw.ts`,
      `import { expect, test } from "@playwright/test";
test("quick", () => {
  expect(1).toBe(1);
});
test("slow", async () => {
  await new Promise((r) => setTimeout(r, 300));
});
`,
    );
    writeFileSync(
      `${d}/a/two.pw.ts`,
      `import { expect, test } from "@playwright/test";
test("other", () => {
  expect(2).toBe(2);
});
`,
    );
    // Two tests declared by a helper on one line (as the lesson walks are; this helper sets no mode), and a chain
    // whose mode only its own helper sets, with a last test the spec declares itself.
    writeFileSync(
      `${d}/b/decl.ts`,
      `import { expect, test } from "@playwright/test";
export function declare(names: string[]): void {
  for (const n of names)
    test(\`\${n}: declared by the helper\`, () => {
      expect(process.env.FX_FAIL ?? "").not.toContain(n);
    });
}
`,
    );
    writeFileSync(
      `${d}/b/links.ts`,
      `import { test } from "@playwright/test";
export function chained(names: string[]): void {
  test.describe.configure({ mode: "serial" });
  for (const n of names) test(\`\${n}: a link the helper declares\`, () => {});
}
`,
    );
    writeFileSync(`${d}/b/walk.pw.ts`, `import { declare } from "./decl.ts";\ndeclare(["alpha", "beta"]);\n`);
    writeFileSync(
      `${d}/b/chain.pw.ts`,
      `import { expect, test } from "@playwright/test";
import { chained } from "./links.ts";
chained(["c1", "c2"]);
test("own: the last link, declared in the spec", () => {
  expect(process.env.FX_FAIL ?? "").not.toContain("own");
});
`,
    );
    if (budgets) writeFileSync(`${d}/budgets.json`, JSON.stringify(budgets));
    return `${d}/playwright.config.ts`;
  };
  const runner = (args: string[], env: Record<string, string> = {}): Promise<{ exit: number; out: string }> =>
    new Promise((done) => {
      const child = spawn("bun", [`${REPO_ROOT}scripts/e2e-parallel.ts`, ...args], {
        cwd: REPO_ROOT,
        // No shift from the caller's shell: the fixture opens no port, and its state sits beside its config.
        env: { ...process.env, OAK_E2E_SHIFT: "0", FX_FAIL: "", ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      child.stdout.on("data", (c: Buffer) => {
        out += c.toString();
      });
      child.stderr.on("data", (c: Buffer) => {
        out += c.toString();
      });
      child.on("close", (code) => done({ exit: code ?? 1, out }));
    });
  // Each project well inside its own budget; only the total (0.06 s for about 0.3 s of tests) can fail a run.
  const TOTAL_ONLY: BudgetFile = {
    totalMinutes: 0.001,
    tolerance: 0.15,
    budgets: [
      { name: "fx-a", projects: ["fx-a"], minutes: 1 },
      { name: "fx-b", projects: ["fx-b"], minutes: 1 },
    ],
  };
  beforeAll(() => rmSync(dir, { recursive: true, force: true }));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("which arguments leave the run whole (the total applies) and which make it partial, by the listing", async () => {
    const config = fixture("plan", null);
    const WHOLE = "every listed test is selected (8): the total budget applies";
    const partial = (n: number): string =>
      `${n} of 8 listed tests are selected: a partial run, the total budget does not apply`;
    const cases: [args: string[], line: string | RegExp][] = [
      [[], WHOLE],
      [["--", "--trace", "on"], WHOLE],
      [["--", "--workers", "1"], WHOLE],
      [["--", "--timeout", "5000", "--trace=on"], WHOLE],
      [["--project", "fx-a", "--project", "fx-b"], WHOLE],
      [["--", "-g", "quick"], partial(1)],
      [["--", "--grep", "declared"], partial(3)],
      [["--", "--grep-invert", "declared"], partial(5)],
      [["--", "--project=fx-a"], partial(3)],
      [["--project", "fx-b"], partial(5)],
      [["--", "a/two.pw.ts"], partial(1)],
      // How many tests a shard takes is Playwright's business; that it is not all of them is ours.
      [
        ["--", "--shard", "1/2"],
        /^[1-7] of 8 listed tests are selected: a partial run, the total budget does not apply$/,
      ],
      [["--", "--trace", "on", "-g", "slow"], partial(1)],
    ];
    const got = await Promise.all(cases.map(([args]) => runner(["--config", config, "--plan", ...args])));
    for (const [i, [args, line]] of cases.entries()) {
      const coverage = got[i]?.out.split("\n").find((l) => l.includes("listed test"));
      expect([args.join(" "), got[i]?.exit, coverage?.trim()]).toEqual([
        args.join(" "),
        0,
        typeof line === "string" ? line : expect.stringMatching(line),
      ]);
    }
  }, 120_000);

  test("`-- --trace on` runs everything and fails on the total; a filter after `--` is a partial run", async () => {
    const config = fixture("total", TOTAL_ONLY);
    const traced = await runner(["--config", config, "--jobs", "2", "--", "--trace", "on"]);
    expect(traced.out).toContain("8 listed: 8 passed, 0 failed, 0 flaky, 0 skipped, 0 did not run");
    expect(traced.out).toMatch(/TOTAL\s+budget\s+0\.0\s+measured\s+\S+\s+\S+\s+OVER/);
    expect(traced.out).toMatch(/fx-a\s+budget\s+1\.0\s+measured\s+\S+\s+\S+\s+under/);
    expect(traced.out).toMatch(/E2E TOTAL: .*; OVER BUDGET/);
    expect(traced.exit).toBe(1);
    // The same run, same budgets, but narrowed: every test it ran passed, the total is not its business.
    const narrowed = await runner(["--config", config, "--jobs", "2", "--", "--trace", "on", "-g", "slow"]);
    expect(narrowed.out).toContain("1 listed: 1 passed, 0 failed");
    expect(narrowed.out).toContain("the total is not checked: 1 of 8 listed tests are selected");
    expect(narrowed.out).not.toMatch(/TOTAL\s+budget/);
    expect(narrowed.exit).toBe(0);
    // And the total is what failed the first run: lifted, the identical run passes.
    writeFileSync(`${dir}/total/budgets.json`, JSON.stringify({ ...TOTAL_ONLY, totalMinutes: 1 }));
    const roomy = await runner(["--config", config, "--jobs", "2", "--", "--trace", "on"]);
    expect(roomy.out).toMatch(/TOTAL\s+budget\s+1\.0\s+measured\s+\S+\s+\S+\s+under/);
    expect(roomy.exit).toBe(0);
  }, 120_000);

  test("a failed test a helper declares runs again alone (its whole spec file), fails by name, and is traced", async () => {
    const config = fixture("alone", null);
    const r = await runner(["--config", config, "--jobs", "2"], { FX_FAIL: "beta own" });
    const state = `${dir}/alone/.e2e-state`;
    // walk.pw.ts (2 tests, both on decl.ts's line) and chain.pw.ts (serial by links.ts alone: 3 tests) run again
    // whole.
    expect(r.out).toContain(
      "again, alone: fx-b (2 failed or not run beside other suites; 5 tests run again)",
    );
    expect(r.out).toContain("FAIL fx-b alone: 3 passed, 2 failed, 0 skipped");
    expect(r.out).toContain("Failed: 2");
    expect(r.out).toMatch(/✘ fx-b › .*b\/walk\.pw\.ts › beta: declared by the helper/);
    expect(r.out).toMatch(/✘ fx-b › .*b\/chain\.pw\.ts › own: the last link, declared in the spec/);
    expect(r.out).not.toContain("Did not run");
    expect(r.out).toContain("8 listed: 6 passed, 2 failed, 0 flaky, 0 skipped, 0 did not run");
    expect(r.exit).toBe(1);
    // The alone run selected whole files, by name, and kept a trace of each failure.
    const log = readFileSync(`${state}/logs/fx-b.alone.log`, "utf8");
    expect(log).toContain("alpha: declared by the helper");
    expect(log).toContain("c1: a link the helper declares");
    const traces = readdirSync(`${state}/out/fx-b.alone`).filter((f) =>
      existsSync(`${state}/out/fx-b.alone/${f}/trace.zip`),
    );
    expect(traces).toHaveLength(2);
  }, 120_000);
});

describe("--file", () => {
  test("keeps only the given files, names the unknown ones and pins them on the units", () => {
    const ps = new Map<string, Project>([
      [
        "lesson",
        project(
          "lesson",
          { "app/src/lesson/e2e/a.pw.ts": 2, "app/src/lesson/e2e/b.pw.ts": 1 },
          ["oak-api:8801"],
          "app/src/lesson/e2e",
        ),
      ],
      [
        "drills",
        project("drills", { "app/src/drills/e2e/d.pw.ts": 1 }, ["oak-api:8803"], "app/src/drills/e2e"),
      ],
    ]);
    const n = narrowToFiles(ps, new Set(["app/src/lesson/e2e/b.pw.ts", "nowhere/x.pw.ts"]));
    expect(n.unknown).toEqual(["nowhere/x.pw.ts"]);
    expect(n.narrowed).toEqual(new Set(["lesson", "drills"]));
    expect([...(ps.get("lesson")?.files.keys() ?? [])]).toEqual(["app/src/lesson/e2e/b.pw.ts"]);
    expect(ps.get("drills")?.files.size).toBe(0);
    const units = plan([ps.get("lesson") as Project], { generated: "", projects: {}, files: {} }, 0);
    expect(units.map((u) => u.files)).toEqual([[]]);
    pinFiles(units, ps);
    expect(units.map((u) => u.files)).toEqual([["app/src/lesson/e2e/b.pw.ts"]]);
  });
});
