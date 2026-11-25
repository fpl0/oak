import type { SketchDimension, SketchLineage, SketchVersion } from "@oak/api";
import { constDecls, labelledLines, tempoLineOf } from "@oak/content-kit";
import { badRequest, notFound } from "../errors.ts";
import type { ServiceContext } from "./context.ts";

export interface LineageBody {
  parentVersion?: number | null | undefined;
  generation?: number | null | undefined;
  dimension?: SketchDimension | null | undefined;
}

/** Validate only named copies: ordinary Runs never acquire a generation from the previous version. */
export function checkLineage(
  versions: readonly Pick<SketchVersion, "version" | "generation">[],
  body: LineageBody,
): void {
  const parentVersion = body.parentVersion ?? null;
  const generation = body.generation ?? null;
  const dimension = body.dimension ?? null;
  if (parentVersion === null && generation === null && dimension === null) return;
  if (generation !== null && parentVersion === null)
    throw badRequest("a generation names the version it came from");
  if (dimension !== null && parentVersion === null)
    throw badRequest("a changed dimension names the version it came from");
  if (parentVersion !== null && (generation === null || dimension === null))
    throw badRequest("a version copied from another names its generation and the dimension it changes");
  const parent = versions.find((v) => v.version === parentVersion);
  if (parent === undefined) throw badRequest(`version ${parentVersion} is not a version of this sketch`);
  const expected = (parent.generation ?? 0) + 1;
  if (generation !== expected)
    throw badRequest(`a copy of version ${parentVersion} is generation ${expected}`);
}

function statements(code: string): Map<string, string> {
  const result = new Map<string, string>();
  const counts = new Map<string, number>();
  const add = (key: string, text: string) => {
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    result.set(count === 1 ? key : `${key}#${count}`, text.trim());
  };
  for (const line of labelledLines(code)) add(line.label, line.text);
  for (const decl of constDecls(code)) add(`const:${decl.name}`, decl.text);
  const tempo = tempoLineOf(code);
  if (tempo !== null) add("@tempo", tempo);
  return result;
}

/** Oak's text reading: the child puts back every statement its parent changed against the grandparent. */
export function undoesGrandparent(grandparent: string, parent: string, child: string): boolean {
  const gp = statements(grandparent);
  const p = statements(parent);
  const c = statements(child);
  let changed = false;
  for (const key of new Set([...gp.keys(), ...p.keys()])) {
    if (gp.get(key) === p.get(key)) continue;
    changed = true;
    if (c.get(key) !== gp.get(key)) return false;
  }
  return changed;
}

export class LineageService {
  constructor(private readonly ctx: ServiceContext) {}

  lineage(sketchId: string, version?: number): SketchLineage {
    const repo = this.ctx.repos.sketches;
    const sketch = repo.get(sketchId);
    if (sketch === null) throw notFound(`sketch ${sketchId}`);
    const asked = version ?? sketch.currentVersion;
    let current = repo.version(sketchId, asked);
    if (current === null) throw notFound(`sketch ${sketchId} version ${asked}`);
    const chain: SketchVersion[] = [];
    while (current !== null) {
      chain.push(current);
      const parent = current.parentVersion ?? null;
      // An edited backup can have a missing or non-decreasing parent: end here without throwing or looping.
      if (parent === null || parent >= current.version) break;
      current = repo.version(sketchId, parent);
    }
    chain.reverse();
    return {
      sketchId,
      versions: chain.map((v, i) => {
        const parent = chain[i - 1];
        const grandparent = chain[i - 2];
        return {
          version: v.version,
          parentVersion: v.parentVersion ?? null,
          generation: v.generation ?? null,
          dimension: v.dimension ?? null,
          takeState: v.takeState ?? null,
          undoesGrandparent:
            parent !== undefined &&
            grandparent !== undefined &&
            undoesGrandparent(grandparent.code, parent.code, v.code),
          createdAt: v.createdAt,
        };
      }),
    };
  }
}
