// Settings › Listening pass (architecture §3.8): the listening pass over every curated sound of the pack and
// every code example of the course, with a verdict each. Examples come from
// `content/.generated/examples.json` (`{ref, code, hash, bars, key, meter}`) when the content build has run,
// otherwise from the lesson files' step examples; sounds from the pack manifest. Verdicts live on the server
// (`GET /api/listen`, `PUT /api/listen/:ref`, wave2 §4). Pure.
import type { ListenMark as ApiListenMark, KeySpec, LessonDef, MeterId } from "@oak/api";

export interface ListenExample {
  /** `U01.L02@slug` (or the generated ref). */
  ref: string;
  code: string;
  /** Content hash of `code`: a verdict is stale once the code changes. */
  hash: string;
  bars: number;
  key: KeySpec | null;
  meter: MeterId;
  /** Unit of the lesson ("U01"), or "Sounds" for the pack's sounds, for the filter. */
  unit: string;
  preview?: boolean;
  /** Sounds only: the group in the list ("Instruments", "Drum kit", ...). */
  group?: string;
}

export const VERDICTS = ["ok", "wrong-sound", "wrong-notation", "weak", "wrong-theory"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_LABEL: Record<Verdict, string> = {
  ok: "OK",
  "wrong-sound": "Wrong sound",
  "wrong-notation": "Wrong notation",
  weak: "Musically weak",
  "wrong-theory": "Wrong theory",
};

export type ListenMark = ApiListenMark;

/** Sounds get three plain verdicts: keep (ok), replace (wrong sound), flag (weak, with a note). */
export const SOUND_VERDICTS: readonly { verdict: Verdict; label: string }[] = [
  { verdict: "ok", label: "Keep" },
  { verdict: "wrong-sound", label: "Replace" },
  { verdict: "weak", label: "Flag" },
];

/** The marks the server returned, by ref (the newest wins if a ref repeats). */
export function marksByRef(items: readonly ListenMark[]): Record<string, ListenMark> {
  const out: Record<string, ListenMark> = {};
  for (const m of [...items].sort((a, b) => a.at.localeCompare(b.at))) out[m.ref] = m;
  return out;
}

// --- sounds ---------------------------------------------------------------------------------------

export const SOUNDS_UNIT = "Sounds";
const BASS = /bass|upright/;
const SYNTHS = ["sine", "triangle", "square", "sawtooth"] as const;

/** A short demo in Oak's dialect (STYLE §1–2) that shows the sound off in its natural register. */
export function soundDemo(name: string, kind: "drum" | "pitched"): string {
  if (kind === "drum") {
    const pattern = /^(hh|oh|sh|rd)$/.test(name)
      ? `${name}*8`
      : /^(cr|cb)$/.test(name)
        ? `${name} ~ ~ ~`
        : `${name}*4`;
    return `setcpm(96/4)\n\ndrums: s("${pattern}")`;
  }
  if (BASS.test(name)) return `setcpm(96/4)\n\nbass: note("c2 ~ g2 c3").s("${name}")`;
  return `setcpm(96/4)\n\nkeys: note("c4 e4 g4 [c4,e4,g4]").s("${name}")`;
}

export interface PackSounds {
  /** Curated aliases (`rhodes`, `upright`, ...). */
  aliases: readonly string[];
  /** General MIDI soundfonts in the pack (`gm_piano`, ...). */
  soundfonts: readonly string[];
  /** Sample-map groups: name → sound names (`piano`, the drum kit). */
  samples: Readonly<Record<string, readonly string[]>>;
}

/** Every curated sound as a listen item, grouped; deterministic order. */
export function soundItems(pack: PackSounds): ListenExample[] {
  const item = (name: string, group: string, kind: "drum" | "pitched"): ListenExample => {
    const code = soundDemo(name, kind);
    return {
      ref: `sound:${name}`,
      code,
      hash: codeHash(code),
      bars: 1,
      key: null,
      meter: "4/4" as MeterId,
      unit: SOUNDS_UNIT,
      group,
    };
  };
  const out: ListenExample[] = [];
  for (const a of [...pack.aliases].sort()) out.push(item(a, "Instruments", "pitched"));
  for (const [group, names] of Object.entries(pack.samples).sort(([a], [b]) => a.localeCompare(b))) {
    const drum = !/piano/.test(group);
    for (const n of [...names].filter((x) => x !== "_base").sort())
      out.push(item(n, drum ? "Drum kit" : "Piano", drum ? "drum" : "pitched"));
  }
  for (const f of [...pack.soundfonts].sort()) out.push(item(f, "General MIDI", "pitched"));
  for (const s of SYNTHS) out.push(item(s, "Synths", "pitched"));
  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.ref)) return false;
    seen.add(e.ref);
    return true;
  });
}

/** FNV-1a 32-bit of the code, hex: deterministic, synchronous, isomorphic. */
export function codeHash(code: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function unitOf(ref: string): string {
  return ref.split(".")[0] ?? ref;
}

/** Normalises `examples.json` entries (unknown shape on disk) into examples. */
export function fromGenerated(json: unknown): ListenExample[] {
  if (!Array.isArray(json)) return [];
  const out: ListenExample[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.ref !== "string" || typeof e.code !== "string") continue;
    const key = e.key && typeof e.key === "object" ? (e.key as KeySpec) : null;
    out.push({
      ref: e.ref,
      code: e.code,
      hash: typeof e.hash === "string" ? e.hash : codeHash(e.code),
      bars: typeof e.bars === "number" ? e.bars : 4,
      key,
      meter: (typeof e.meter === "string" ? e.meter : "4/4") as MeterId,
      unit: unitOf(e.ref),
    });
  }
  return out;
}

/** The step examples of lesson definitions (fallback when the content build has not run). */
export function fromLessons(lessons: readonly LessonDef[]): ListenExample[] {
  const out: ListenExample[] = [];
  for (const l of lessons) {
    for (const step of l.steps) {
      const ex = step.example;
      if (!ex) continue;
      const item: ListenExample = {
        ref: `${l.id}@${ex.id}`,
        code: ex.code,
        hash: codeHash(ex.code),
        bars: ex.bars,
        key: l.key,
        meter: l.meter,
        unit: unitOf(l.id),
      };
      if (ex.preview) item.preview = true;
      out.push(item);
    }
  }
  return out.sort((a, b) => a.ref.localeCompare(b.ref));
}

export type ListenStatus = "unmarked" | "ok" | "flagged" | "changed";

/** "changed": the code moved on since its verdict, so the verdict no longer counts. */
export function statusOf(ex: ListenExample, mark: ListenMark | undefined): ListenStatus {
  if (!mark) return "unmarked";
  if (mark.hash !== ex.hash) return "changed";
  return mark.verdict === "ok" ? "ok" : "flagged";
}

export interface ListenFilter {
  unit: string | null;
  /** Only what still needs a listen: unmarked or changed since its verdict. */
  needsListen: boolean;
}

export function filterExamples(
  examples: readonly ListenExample[],
  marks: Readonly<Record<string, ListenMark>>,
  f: ListenFilter,
): ListenExample[] {
  return examples.filter((e) => {
    if (f.unit && e.unit !== f.unit) return false;
    if (f.needsListen) {
      const s = statusOf(e, marks[e.ref]);
      return s === "unmarked" || s === "changed";
    }
    return true;
  });
}

/** The marks as the JSON file content/.qa/listen-log.json would hold (for the export button). */
export function exportMarks(marks: Readonly<Record<string, ListenMark>>): string {
  const sorted = Object.keys(marks)
    .sort()
    .map((k) => marks[k]);
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
