// The command palette's registry (ux §2.1): navigation, actions, and search results contributed by pages.
// Pages register commands for as long as they are mounted; the palette ranks them with `rankCommands`.
import { useEffect, useRef } from "react";
import { create } from "zustand";

export type CommandGroup = "Navigate" | "Actions" | "Lessons" | "Tools" | "Sketches" | "Tracks" | "Settings";

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  /** Extra words that should match (synonyms, IDs). */
  keywords?: string[];
  /** Shortcut shown on the right, in binding form ("Mod+J", "G T"). */
  shortcut?: string;
  /** Short secondary text. */
  hint?: string;
  run(): void;
}

interface CommandStore {
  sources: Map<string, readonly Command[]>;
  setSource(id: string, commands: readonly Command[] | null): void;
}

export const useCommandStore = create<CommandStore>((set) => ({
  sources: new Map(),
  setSource(id, commands) {
    set((s) => {
      const sources = new Map(s.sources);
      if (commands) sources.set(id, commands);
      else sources.delete(id);
      return { sources };
    });
  },
}));

/**
 * Everything of a command list the palette shows or matches on. The hint is in it: a track lens that is not open
 * yet keeps its title ("Clave lens") while its hint grows the lesson title once the syllabus loads ("Opens with
 * R3.L02" → "Opens with R3.L02 Clave Direction"); keyed on ids and titles alone, the palette kept the first hint.
 */
export function commandSignature(commands: readonly Command[]): string {
  return commands
    .map((c) =>
      [c.id, c.title, c.group, c.hint ?? "", c.shortcut ?? "", (c.keywords ?? []).join(",")].join("\u0000"),
    )
    .join("\u0001");
}

export function allCommands(sources: Map<string, readonly Command[]>): Command[] {
  const seen = new Set<string>();
  const out: Command[] = [];
  for (const list of sources.values())
    for (const c of list) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  return out;
}

/**
 * Contributes commands while mounted. `commands` may change every render; the source updates when what the palette
 * shows or matches changes (`commandSignature`), not on every new array.
 */
export function useCommandSource(sourceId: string, commands: readonly Command[]): void {
  const setSource = useCommandStore((s) => s.setSource);
  const latest = useRef(commands);
  latest.current = commands;
  const signature = commandSignature(commands);
  useEffect(() => {
    setSource(
      sourceId,
      latest.current.map((c, i) => ({ ...c, run: () => latest.current[i]?.run() })),
    );
  }, [sourceId, signature, setSource]);
  useEffect(() => () => setSource(sourceId, null), [sourceId, setSource]);
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/♭/g, "b").replace(/♯/g, "#");

/**
 * Score of `query` against `text`: 0 when it does not match. Prefix and word-start matches rank above
 * scattered subsequence matches; shorter targets win ties.
 */
export function matchScore(query: string, text: string): number {
  const q = norm(query.trim());
  if (!q) return 1;
  const t = norm(text);
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - t.length;
  const words = t.split(/[\s·./:_-]+/);
  if (words.some((w) => w.startsWith(q))) return 600 - t.length;
  const at = t.indexOf(q);
  if (at >= 0) return 400 - at - t.length / 10;
  // Every query word appears somewhere.
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length > 1 && qWords.every((w) => t.includes(w))) return 300 - t.length / 10;
  // Subsequence ("nwsk" → "new sketch").
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  if (i === q.length) return 100 - t.length / 10;
  return 0;
}

export function rankCommands(query: string, commands: readonly Command[], limit = 50): Command[] {
  if (!query.trim()) return commands.slice(0, limit);
  return commands
    .map((c) => ({
      c,
      s: Math.max(matchScore(query, c.title), ...(c.keywords ?? []).map((k) => matchScore(query, k) * 0.9)),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}
