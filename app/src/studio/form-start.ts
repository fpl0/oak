// Oak 2.0 W4 F7 "Borrow a form you mapped" (DeSantis, Formal Skeletons; W1 gap 3, PLAN S2 "From a form you
// mapped"): the learner marks the sections of a song they like with Transcribe's form strip, and Oak turns *their*
// map into an empty skeleton: one const per section and part, one `arrange()` per part, all rests, no sound names.
// The skeleton borrows the form (the sections and their lengths), never the song: the tempo and key are fields the
// learner sees, prefilled from the source. Oak's own ready-made maps (the unit songs the learner has started) are
// offered only once the learner has made a map of their own. Pure: tested in form-start.test.ts.
import type { SketchCreate, Transcription, UnitSongSummary } from "@oak/api";
import type { KeySpec, MeterId, UnitId, UnitSongDef } from "@oak/content-kit";
import { barSeconds } from "@oak/theory";
import { cleanLabel, type FormMap, normalizeFormMap } from "../transcribe/form-map.ts";
import { isBareDraft, skeletonOfForm } from "../transcribe/standard.ts";

export interface MappedForm {
  /** The project's id, or `oak:<unit>` for one of Oak's songs. */
  id: string;
  source: "yours" | "oak";
  title: string;
  map: FormMap;
  bpm: number | null;
  meter: MeterId;
  key: KeySpec | null;
}

type ProjectLike = Pick<Transcription, "id" | "title" | "bpm" | "meter" | "key" | "regions">;

/**
 * A project's form: its section regions in time order, each a whole number of bars (at least 1) at the project's
 * tempo and meter, laid end to end from bar 1. `null` without a tempo, without a section, or with one unnamed section
 * (nothing was mapped). The project's pickup and clock are not carried: the form is borrowed, not the song.
 */
export function formOfProject(p: ProjectLike): MappedForm | null {
  if (p.bpm === null || !(p.bpm > 0)) return null;
  const sections = p.regions.filter((r) => r.kind === "section").sort((a, b) => a.startS - b.startS);
  const only = sections[0];
  if (!only || (sections.length === 1 && cleanLabel(only.label) === "")) return null;
  const meter: MeterId = p.meter ?? "4/4";
  const barSec = barSeconds(p.bpm, meter);
  const cuts: number[] = [];
  const labels: string[] = [];
  let bar = 1;
  for (const s of sections) {
    cuts.push(bar);
    labels.push(cleanLabel(s.label));
    bar += Math.max(1, Math.round((s.endS - s.startS) / barSec));
  }
  return {
    id: p.id,
    source: "yours",
    title: p.title,
    map: normalizeFormMap({ bars: bar - 1, cuts, labels }),
    bpm: p.bpm,
    meter,
    key: p.key,
  };
}

/**
 * Oak's ready-made maps: the unit songs the learner has started (never a `new` one), each with its sections named by
 * their type, so a verse that comes back is one section written once.
 */
export function oakForms(
  songs: readonly Pick<UnitSongSummary, "unitId" | "title" | "status">[],
  defOf: (unit: UnitId) => Pick<UnitSongDef, "sections" | "bpm" | "meter" | "key"> | null,
): MappedForm[] {
  const out: MappedForm[] = [];
  for (const song of songs) {
    if (song.status === "new") continue;
    const def = defOf(song.unitId as UnitId);
    if (!def || def.sections.length === 0) continue;
    const cuts: number[] = [];
    let bar = 1;
    for (const s of def.sections) {
      cuts.push(bar);
      bar += Math.max(1, s.bars);
    }
    out.push({
      id: `oak:${song.unitId}`,
      source: "oak",
      title: song.title,
      map: normalizeFormMap({ bars: bar - 1, cuts, labels: def.sections.map((s) => s.type) }),
      bpm: def.bpm,
      meter: def.meter,
      key: def.key,
    });
  }
  return out;
}

/** The forms to pick from: the learner's own maps, and Oak's only once there is one of theirs (PLAN F7). */
export function formsOffered(
  projects: readonly ProjectLike[],
  songs: readonly Pick<UnitSongSummary, "unitId" | "title" | "status">[],
  defOf: (unit: UnitId) => Pick<UnitSongDef, "sections" | "bpm" | "meter" | "key"> | null,
): { yours: MappedForm[]; oak: MappedForm[] } {
  const yours = projects.map(formOfProject).filter((f): f is MappedForm => f !== null);
  return { yours, oak: yours.length > 0 ? oakForms(songs, defOf) : [] };
}

/** The empty skeleton of a form at the tempo, meter and key the learner chose. */
export function formStartCode(f: MappedForm, o: { bpm: number; meter: MeterId; key: KeySpec }): string {
  return skeletonOfForm(
    {
      songId: null,
      title: f.title,
      year: null,
      bpm: o.bpm,
      meter: o.meter,
      key: o.key,
      pickupBeats: null,
      bars: f.map.bars,
      phrases: [],
      swing: false,
      form: null,
    },
    f.map,
    { empty: true },
  );
}

/** A new free sketch from a borrowed form. */
export function formStartBody(
  f: MappedForm,
  o: { title: string; sessionId: string | null; bpm: number; meter: MeterId; key: KeySpec },
): SketchCreate {
  return {
    title: o.title,
    originKind: "free",
    originId: null,
    sessionId: o.sessionId,
    code: formStartCode(f, o),
    bpm: o.bpm,
    meter: o.meter,
    key: o.key,
    analysis: null,
    note: `From the form of “${f.title}”`,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
  };
}

/**
 * In a capstone the form is offered while the draft has nothing of the learner's in it: bare, or still the starter
 * (compose starters are never bare; "Calls to check" 9).
 */
export function canOfferInCapstone(liveCode: string, starter: string): boolean {
  return isBareDraft(liveCode) || liveCode.trim() === starter.trim();
}

/** Tempo limits of the form fields (the editor's own range). */
export const FORM_BPM = { min: 40, max: 240 } as const;

/** Every sentence of the form start (each one passes `isDescriptive`). */
export const FORM_START_COPY = {
  label: "From a form you mapped",
  detail: "The sections of a song you mapped, as empty parts to write into.",
  none: "Map a song's sections in Transcribe first (the form strip under the song).",
  yours: "Your maps",
  oak: "Oak's songs",
  tempo: "Tempo (BPM)",
  key: "Key",
  title: "Title",
  create: "Create",
  creating: "Creating…",
  failed: "The sketch could not be made. Try again.",
  sections: "Sections",
  capstoneTitle: "Borrow a form you mapped",
  capstoneLine: "This replaces the starter's lines with your sections. Undo brings them back.",
  use: "Use this form",
  clamped: "The tempo is moved into the brief's range.",
} as const;
