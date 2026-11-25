// The transcription guard: re-parses the binding tables of docs/design/contracts.md and fails on any drift
// between them and the typed data (course map §2.3/§2.6, default order §2.5, unlock table §3.2, skill
// graph §4.1, family catalog §7.3, checkpoint map §7.6, capstone session goals §2.4/§2.6). Changing a
// contract means editing both.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capstones } from "../capstones.ts";
import { checkpointMetas } from "../checkpoints.ts";
import { PLANNED_DECKS, plannedDeckById } from "../decks/planned.ts";
import { decks, FAMILY_TABLE } from "../families.ts";
import { skills } from "../skills.ts";
import { syllabus } from "../syllabus.ts";
import { toolbox } from "../toolbox.ts";

const doc = readFileSync(join(import.meta.dir, "..", "..", "docs", "design", "contracts.md"), "utf8");
const lines = doc.split("\n");
const cells = (line: string) =>
  line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
const list = (cell: string) => (cell === "—" || cell === "" ? [] : cell.split(/\s+/));
const plain = (s: string) => s.replace(/\s+/g, " ").trim();

describe("course map (§2.3, §2.6)", () => {
  const rows = lines.filter((l) => /^\| (U\d{2}|[JRA]\d)\.L\d{2} \|/.test(l)).map(cells);
  const meta = new Map(syllabus.units.flatMap((u) => u.lessons.map((l) => [l.id as string, l] as const)));
  test("every lesson row is in the syllabus and the reverse", () => {
    expect<unknown>(rows.map((r) => r[0]).sort()).toEqual([...meta.keys()].sort());
  });
  test("titles, objectives, introduces and practises match", () => {
    for (const [id, title, objective, introduces, practises] of rows as string[][]) {
      const m = meta.get(id as string);
      expect<unknown>([id, m?.title, plain(m?.objective ?? ""), m?.introduces, m?.practises]).toEqual([
        id,
        title,
        plain(objective as string),
        list(introduces as string),
        list(practises as string),
      ]);
    }
  });
});

test("default order (§2.5)", () => {
  const block = doc.slice(doc.indexOf("**Default linear order of the core**"));
  const code = block.slice(block.indexOf("```") + 3, block.indexOf("```", block.indexOf("```") + 3));
  const order = [...code.matchAll(/(\d+):(\S+)/g)].map((m) => m[2]);
  expect<unknown>(order.length).toBe(191);
  expect<unknown>(syllabus.defaultOrder).toEqual(order as never);
});

describe("capstone sessions (§2.4, §2.6)", () => {
  // Core capstone rows have 4 columns (objective last); track capstone rows share the lesson table's
  // 5 columns (objective third).
  const rows = lines
    .filter((l) => /^\| [A-Z][A-Z0-9-]*\.S\d \|/.test(l))
    .map(cells)
    .map((c) => [c[0] as string, plain((c.length === 4 ? c[3] : c[2]) ?? "")] as const);
  const defs = capstones.flatMap((c) => c.sessionDefs.map((s) => [s.id as string, plain(s.goal)] as const));
  test("every capstone session row is a session def and the reverse", () => {
    expect<unknown>(rows.map((r) => r[0]).sort()).toEqual(defs.map((d) => d[0]).sort());
  });
  test("session goals match the Objective column", () => {
    expect<unknown>(new Map(defs)).toEqual(new Map(rows));
  });
});

describe("unlock table (§3.2)", () => {
  const rows = lines.filter((l) => /^\| `(tb|snd|scale|chord)\.[^`]+` \|/.test(l)).map(cells);
  const byId = new Map(toolbox.map((t) => [t.id as string, t]));
  /**
   * Rows content/toolbox.ts has ahead of the table, each requested from the contracts owner with its exact
   * §3.2 text (a Foundation result's apiNotes). Remove an entry once the table carries the row.
   */
  const PENDING_IN_CONTRACTS: Record<string, string> = {};
  test("the same rows", () => {
    expect<unknown>(rows.map((r) => (r[0] as string).replaceAll("`", "")).sort()).toEqual(
      [...byId.keys()]
        .filter((id) => !(id in PENDING_IN_CONTRACTS && !rows.some((r) => r[0] === `\`${id}\``)))
        .sort(),
    );
  });
  test("the same unlock sites, START rows and voicing-gate marks", () => {
    for (const r of rows) {
      const id = (r[0] as string).replaceAll("`", "");
      const t = byId.get(id);
      const at = (r[2] as string).replace("*", "").split(" or ");
      expect<unknown>([id, t?.unlock.at]).toEqual([id, at.length > 1 ? at : at[0]]);
      expect<unknown>([id, Boolean(t?.unlock.condition)]).toEqual([id, (r[2] as string).includes("*")]);
      const start = /START/.test(r[5] ?? "") || /START/.test(r[4] ?? "");
      if (start && !/RC1\.S2/.test(r[5] ?? "")) expect<unknown>([id, t?.unlock.when]).toEqual([id, "start"]);
    }
  });
});

describe("skill graph (§4.1)", () => {
  const rows = lines
    .filter((l) => /^\| [RPNSICHBMFEVJD]\d{2}[ab]? \|/.test(l))
    .map(cells)
    .filter((r) => r.length >= 6 && /\.L\d{2}$/.test(r[5] ?? ""));
  const byId = new Map(skills.map((s) => [s.id as string, s]));
  test("the same nodes", () =>
    expect<unknown>(rows.map((r) => r[0]).sort()).toEqual([...byId.keys()].sort()));
  test("names, categories, kinds, prerequisites and introducing lessons match", () => {
    for (const [id, name, category, kind, prereq, intro] of rows as string[][]) {
      const s = byId.get(id as string);
      expect<unknown>([id, s?.name, s?.category, s?.kind, s?.prerequisites, s?.introducedBy]).toEqual([
        id,
        name,
        category,
        kind,
        list((prereq as string).replace(/,/g, " ")),
        intro,
      ]);
    }
  });
});

describe("family catalog (§7.3)", () => {
  const rows = lines.filter((l) => /^\| `(fam|deck)\.[^`]+` \|/.test(l)).map(cells);
  // A deck row is written in `decks` or, until the drills engine writes it, planned (content/decks/planned.ts).
  const written = new Set(decks.map((d) => d.id as string));
  const planned = PLANNED_DECKS.filter((d) => !written.has(d.id)).map((d) => d.id);
  test("the same families and decks", () => {
    const ids = rows.map((r) => (r[0] as string).replaceAll("`", "")).sort();
    expect<unknown>(ids).toEqual([...FAMILY_TABLE.keys(), ...written, ...planned].sort());
  });
  test("a planned deck is never written and planned at once", () => {
    for (const d of PLANNED_DECKS) expect<unknown>([d.id, written.has(d.id)]).toEqual([d.id, false]);
  });
  test("kind, first unlock lesson, nodes and mix match", () => {
    const KIND: Record<string, string> = {
      C: "C",
      P: "P",
      Pr: "Pr",
      "P/Pr": "P/Pr",
      "C/P": "C/P",
      "P/C": "P/C",
      "Pr/P": "Pr/P",
    };
    for (const [idCell, kind, unlock, nodes, mix] of rows as string[][]) {
      const id = (idCell as string).replaceAll("`", "");
      const firstLesson = /([UJRA]\d+\.L\d{2})/.exec(unlock as string)?.[1];
      if (id.startsWith("deck.")) {
        const d = decks.find((x) => x.id === id);
        expect<unknown>([id, d?.unlock.lesson ?? plannedDeckById.get(id)?.lesson]).toEqual([id, firstLesson]);
        continue;
      }
      const f = FAMILY_TABLE.get(id);
      const nodeList = (nodes as string).startsWith("category") ? f?.nodes : (nodes as string).split(/,\s*/);
      expect<unknown>([id, f?.kind, f?.unlock, f?.nodes, f?.mix ?? "—"]).toEqual([
        id,
        KIND[kind as string],
        firstLesson,
        nodeList,
        mix,
      ]);
    }
  });
});

describe("checkpoint map (§7.6)", () => {
  const expand = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((tok) => {
        const m = /^([A-Z])(\d{2})–[A-Z](\d{2})$/.exec(tok);
        if (!m) return [tok];
        return Array.from(
          { length: Number(m[3]) - Number(m[2]) + 1 },
          (_, i) => `${m[1]}${String(Number(m[2]) + i).padStart(2, "0")}`,
        );
      });
  const section = doc.slice(doc.indexOf("**Checkpoint map**"), doc.indexOf("### 7.7"));
  const rows = section
    .split("\n")
    .filter((l) => /^\| (U\d{2}\.CP|[JRA]\.CP\d?) \|/.test(l))
    .map(cells);
  test("gated and level-setting skills per checkpoint", () => {
    expect<unknown>(rows.length).toBe(checkpointMetas.length);
    for (const [id, skillsCell] of rows as string[][]) {
      const bracket = /\[([^\]]*)\]/.exec(skillsCell as string)?.[1] ?? "";
      const gated = expand((skillsCell as string).replace(/\[[^\]]*\]/, ""));
      const cp = checkpointMetas.find((c) => c.id === id);
      expect<unknown>([id, cp?.gated, cp?.levelSetting]).toEqual([id, gated, expand(bracket)]);
    }
  });
});
