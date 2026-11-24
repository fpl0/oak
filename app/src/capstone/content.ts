// The capstone content the workspace and the album need beyond the shared bundle (`useContent` carries only
// `CapstoneMeta`): the full definitions with briefs and rubrics, the flavour kits and rules, the Band layers and
// the can-do statements. One lazy chunk of the isomorphic registries, loaded once.
import type {
  BandDef,
  CanDoDef,
  CapstoneDef,
  FlavourId,
  FlavourKit,
  KeySpec,
  TermEntry,
} from "@oak/content-kit";
import type { BandSetup } from "@oak/strudel";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { bandCodeAt } from "../../../content/bands/index.ts";
import type { RepertoireEntry } from "../../../content/repertoire/index.ts";

export interface CapstoneContent {
  capstones: readonly CapstoneDef[];
  flavours: readonly FlavourKit[];
  /** Flavours that ship in this wave (`FLAVOUR_RULES[id].ships === "W2"`). */
  shipping: readonly FlavourId[];
  bands: readonly BandDef[];
  candos: readonly CanDoDef[];
  skillNames: ReadonlyMap<string, string>;
  /** The repertoire registry (titles, years, sources) for the songs a transcribe capstone offers. */
  repertoire: readonly RepertoireEntry[];
  /** The glossary (CF-A's devices card plays a term's example for a device not yet on the learner's record). */
  terms: readonly TermEntry[];
}

/** The registry with folder files in place of their registry entries. */
export function mergeCapstones(
  registry: readonly CapstoneDef[],
  folders: readonly CapstoneDef[],
): CapstoneDef[] {
  const byId = new Map(folders.map((c) => [c.id, c] as const));
  const out = registry.map((c) => byId.get(c.id) ?? c);
  for (const c of folders) if (!registry.some((r) => r.id === c.id)) out.push(c);
  return out;
}

async function load(): Promise<CapstoneContent> {
  const [{ registries }, { FLAVOUR_RULES }, folders] = await Promise.all([
    import("@content/index.ts"),
    import("@content/flavours.ts"),
    import("./capstone-files.ts").then((m) => m.folderCapstones()),
  ]);
  const shipping = (Object.keys(FLAVOUR_RULES) as FlavourId[]).filter(
    (id) => FLAVOUR_RULES[id].ships === "W2",
  );
  return {
    capstones: mergeCapstones(registries.capstones, folders),
    flavours: registries.flavours,
    shipping,
    bands: registries.bands,
    candos: registries.candos,
    skillNames: new Map(registries.skills.map((s) => [String(s.id), s.name] as const)),
    repertoire: registries.repertoire,
    terms: registries.terms,
  };
}

export const capstoneContentQuery = queryOptions({
  queryKey: ["capstone-content"] as const,
  queryFn: load,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
});

export function useCapstoneContent() {
  return useQuery(capstoneContentQuery);
}

export const FLAVOUR_TITLE: Record<FlavourId, string> = {
  "flavour.pop": "Pop",
  "flavour.jazz-soul": "Jazz-soul",
  "flavour.indie": "Indie",
  "flavour.funk": "Funk",
  "flavour.electronic": "Electronic",
};

/** The Band roles a brief leaves to the learner's choice: the ones its rubric does not ask the learner to write. */
export function bandTracksFor(def: CapstoneDef): ("drums" | "bass" | "chords")[] {
  const asked = new Set<string>();
  for (const r of def.brief?.rubric ?? []) {
    if (r.rule === "tracks") for (const role of r.roles ?? []) asked.add(role);
    if ("track" in r && typeof r.track === "string" && r.track.startsWith("@")) asked.add(r.track.slice(1));
  }
  return (["drums", "bass", "chords"] as const).filter((t) => !asked.has(t));
}

/** "C4:major": the scale argument Band code takes for `{{key}}`. */
export function bandKeyText(key: KeySpec): string {
  return `${key.tonic}4:${key.mode}`;
}

/** The Band for a capstone in a flavour: the brief's own choice, else the 4-bar loop (4/4) or the waltz (3/4). */
export function bandSetupFor(
  def: CapstoneDef,
  flavour: FlavourId,
  bands: readonly BandDef[],
  key: KeySpec,
  /** Whether the course has reached a session (contracts §5.10 Band stages); absent: the first stage. */
  reached: (from: string) => boolean = () => false,
): BandSetup | null {
  const tracks = bandTracksFor(def);
  if (tracks.length === 0) return null;
  const wanted =
    def.flavours?.[flavour]?.band ?? (def.meter === "3/4" ? "band.waltz-vamp" : "band.axis-4bar");
  const band = bands.find((b) => b.id === wanted);
  const code = band?.code[flavour] ? bandCodeAt(band, flavour, reached) : undefined;
  if (!band || !code) return null;
  return {
    band: band.id,
    flavour,
    code: code.replaceAll("{{key}}", bandKeyText(key)),
    followsLearnerKey: true,
    tracks,
  };
}
