import type { Habits, KeySpec, MeterId } from "@oak/api";
import { chainLinks, isDescriptive, labelledLines, roleOfLabel } from "@oak/content-kit";
import { SCHEMAS } from "@oak/theory";

export interface HabitItem {
  sketchId: string;
  version: number;
  code: string;
  bpm: number | null;
  meter: MeterId | null;
  key: KeySpec | null;
  analysis: {
    key: readonly { key: KeySpec }[];
    schemas: readonly { schema: string }[];
  } | null;
}

export interface HabitDefaults {
  bpm: number;
  meter: MeterId;
  key: KeySpec;
  lines: readonly string[];
}

export type HabitKind =
  | "tempo"
  | "meter"
  | "mode"
  | "key"
  | "kit"
  | "sound"
  | "drums"
  | "first"
  | "schema"
  | "form";

export interface HabitFact {
  kind: HabitKind;
  id: string;
  value: string;
}

export const HABIT_MIN_SKETCHES = 3; // Oak's call
export const HABIT_TEMPO_WINDOW = 12; // Oak's call, BPM
const HABIT_SHARE_DENOMINATOR = 2; // Oak's call: at least half of the sketches read
const HABIT_ID_MAX = 74;
export const HABIT_TERM_IDS: readonly string[] = [
  "term.tempo",
  "term.meter",
  "term.loop",
  "term.schema",
  "term.form",
  "term.major-scale",
  "term.natural-minor",
];

const KINDS: readonly HabitKind[] = [
  "tempo",
  "meter",
  "mode",
  "key",
  "kit",
  "sound",
  "drums",
  "first",
  "schema",
  "form",
];
const schemaTitles = new Map<string, string>(SCHEMAS.map(({ id, title }) => [id, title]));

/** Read literal contents only; a const or computed argument is never executed. */
function literal(args: string): string | null {
  const match = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')$/s.exec(args.trim());
  const contents = match?.[1] ?? match?.[2];
  if (contents === undefined) return null;
  return contents.replace(/\\(u\{[\da-f]+\}|u[\da-f]{4}|x[\da-f]{2}|\r\n|[\s\S])/gi, (_, escaped: string) => {
    if (escaped.startsWith("u{") || /^u[\da-f]{4}$/i.test(escaped) || /^x[\da-f]{2}$/i.test(escaped)) {
      const hex = escaped.startsWith("u{") ? escaped.slice(2, -1) : escaped.slice(1);
      const point = Number.parseInt(hex, 16);
      return point <= 0x10ffff ? String.fromCodePoint(point) : `\\${escaped}`;
    }
    const escapes: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      v: "\v",
      "0": "\0",
      "\n": "",
      "\r": "",
      "\r\n": "",
    };
    return escapes[escaped] ?? escaped;
  });
}

export function habitFacts(item: HabitItem, defaults: HabitDefaults): HabitFact[] {
  const facts: HabitFact[] = [];
  const add = (kind: HabitKind, id: string, value: string) => {
    // Long ids are dropped, never truncated: truncation could turn different patterns into one habit.
    if (id.length > HABIT_ID_MAX) return;
    // For single-valued kinds the first readable value in source order wins.
    if (facts.some((fact) => (kind === "sound" || kind === "schema" ? fact.id === id : fact.kind === kind)))
      return;
    facts.push({ kind, id, value });
  };
  if (item.bpm !== null && item.bpm !== defaults.bpm) {
    // A tempo fact uses `tempo`; only the whole set determines its `tempo.<lo>-<hi>` habit id.
    add("tempo", "tempo", String(Math.round(item.bpm)));
  }
  if (item.meter !== null && item.meter !== defaults.meter)
    add("meter", `meter.${item.meter.replace("/", "-")}`, item.meter);
  const key = item.key ?? item.analysis?.key[0]?.key;
  if (key && (key.tonic !== defaults.key.tonic || key.mode !== defaults.key.mode)) {
    add("mode", `mode.${key.mode}`, key.mode);
    add("key", `key.${key.tonic}-${key.mode}`, `${key.tonic} ${key.mode}`);
  }

  let counted = 0;
  for (const line of labelledLines(item.code)) {
    if (line.muted || defaults.lines.includes(line.text.trim())) continue;
    const links = chainLinks(line.text.slice(line.text.indexOf(":") + 1));
    if (
      links?.some(
        (link, i) =>
          (i === 0 || link.name === "n" || link.name === "note" || link.name === "struct") &&
          (link.args === '"~"' || link.args === "'~'"),
      )
    )
      continue;
    const role = roleOfLabel(line.label);
    if (counted === 0 && role !== "other") add("first", `first.${role}`, role);
    counted++;
    if (role === "drums") {
      for (const link of links ?? []) {
        const bank = link.name === "bank" ? literal(link.args) : null;
        if (bank !== null) add("kit", `kit.${bank}`, bank);
      }
      const head = links?.[0];
      const raw = head && (head.name === "s" || head.name === "sound") ? literal(head.args) : null;
      if (raw !== null) {
        const rhythm = raw.trim().replace(/\s+/g, " ");
        add("drums", `drums.${rhythm.replace(/[^A-Za-z0-9*~]/g, "_")}`, rhythm);
      }
    } else if (role !== "other") {
      for (const link of links ?? []) {
        const sounds = link.name === "s" || link.name === "sound" ? literal(link.args) : null;
        for (const name of sounds?.split(/[\s[\]<>{}(),:*/!@?|%~]+/) ?? []) {
          if (name === "" || Number.isFinite(Number(name))) continue;
          add("sound", `sound.${role}.${name}`, name);
        }
      }
    }
  }
  for (const { schema } of item.analysis?.schemas ?? []) {
    const title = schemaTitles.get(schema);
    if (title !== undefined) add("schema", schema, title);
  }
  if (counted > 0) {
    const form = /arrange\s*\(/.test(item.code) ? "sections" : "loop";
    add("form", `form.${form}`, form);
  }
  return facts;
}

interface CountedFact extends HabitFact {
  count: number;
}

function ending(fact: HabitFact): string {
  const { kind, value } = fact;
  switch (kind) {
    case "tempo": {
      const [lo, hi] = value.split("-");
      return lo === hi ? ` are at ${lo} BPM.` : ` sit between ${lo} and ${hi} BPM.`;
    }
    case "meter":
      return ` are in ${value}.`;
    case "mode":
      return value === "major" || value === "minor"
        ? ` are in a ${value} key.`
        : ` are in ${value.charAt(0).toUpperCase()}${value.slice(1)}.`;
    case "key":
      return ` are in ${value}.`;
    case "kit":
      return ` use the drum kit ${value}.`;
    case "sound":
      return ` give the ${fact.id.split(".")[1]} the sound ${value}.`;
    case "drums":
      return ` share the drum line "${value}".`;
    case "first":
      return ` start with the ${value}.`;
    case "schema":
      return ` use the ${value} schema.`;
    case "form":
      return value === "loop" ? " are one loop, with no sections." : " are in sections.";
  }
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function summarizeHabits(items: readonly HabitItem[], defaults: HabitDefaults): Habits {
  const counts = new Map<string, CountedFact>();
  const tempos: number[] = [];
  let sketches = 0;
  for (const item of items) {
    const facts = habitFacts(item, defaults);
    if (facts.length === 0) continue;
    sketches++;
    for (const fact of facts) {
      if (fact.kind === "tempo") {
        tempos.push(Number(fact.value));
        continue;
      }
      // Group by the actual value too: punctuation-normalised drum ids can collide.
      const group = JSON.stringify([fact.id, fact.value]);
      const previous = counts.get(group);
      if (previous) previous.count++;
      else counts.set(group, { ...fact, count: 1 });
    }
  }
  tempos.sort((a, b) => a - b);
  let best: CountedFact | undefined;
  let right = 0;
  for (let left = 0; left < tempos.length; left++) {
    const lo = tempos[left] as number;
    while (right < tempos.length && (tempos[right] as number) <= lo + HABIT_TEMPO_WINDOW) right++;
    const count = right - left;
    // Ascending starts and strict improvement retain the lowest window on a tie.
    if (!best || count > best.count) {
      const value = `${lo}-${tempos[right - 1]}`;
      best = { kind: "tempo", id: `tempo.${value}`, value, count };
    }
  }
  if (best && best.id.length <= HABIT_ID_MAX) counts.set(best.id, best);
  const habits = [...counts.values()]
    .filter(({ count }) => count >= HABIT_MIN_SKETCHES && HABIT_SHARE_DENOMINATOR * count >= sketches)
    .sort(
      (a, b) =>
        b.count - a.count ||
        KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
        compare(a.id, b.id) ||
        compare(a.value, b.value),
    )
    .map((fact) => ({ id: fact.id, text: `${fact.count} of your ${sketches} sketches${ending(fact)}` }))
    // A learner's own sound or kit name can contain verdict words too; never echo those as Studio advice.
    .filter(({ text }) => isDescriptive(text));
  return { sketches, habits };
}
