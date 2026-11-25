// Oak 2.0 W3 (PLAN §4 S6): the types of the Studio's card deck. A card is a constraint the learner chose (by the
// book's design an arbitrary one); its check only describes what the sketch holds, never ticks, scores or blocks a
// Run or a save (PLAN §2). The deck is `content/studio/cards.ts`; the describers are `@oak/grader`'s cards module.
import type { LessonId } from "./ids.ts";
import type { StudioRole } from "./studio-code.ts";

/**
 * The kinds of Studio card. Named `STUDIO_CARD_KINDS`, not the W3 plan's `CARD_KINDS`: `@oak/api` already exports
 * `CARD_KINDS` (the SRS card kinds, contracts §7.1) and re-exports this package whole, so the plan's name would be
 * ambiguous there.
 */
export const STUDIO_CARD_KINDS = ["constraint", "avoid", "amateur", "tempo", "focus"] as const;
export type CardKind = (typeof STUDIO_CARD_KINDS)[number];

/** What a card's description row reads from the sketch (`describeCard`). */
export type CardCheck =
  | { kind: "tools"; tools: readonly { id: string; label: string }[] }
  /** `sounds: []` describes every part's sounds. */
  | { kind: "sounds"; sounds: readonly string[]; role?: StudioRole }
  | { kind: "range"; role: "bass" | "chords" | "tune" }
  | { kind: "parts" }
  | { kind: "tempo" }
  | { kind: "numerals" };

export interface StudioCard {
  /** `card.<slug>`, or `habit.<habit id>` for a "Not this time" card made from a habit. */
  id: string;
  kind: CardKind;
  text: string;
  /** An avoidance card's "Instead, try …". */
  instead?: string;
  /** The lesson whose completion puts the card in the deck. */
  unlock: LessonId;
  /** The book chapter the card comes from. */
  source: string;
  check?: CardCheck;
}

/** One learner track's facts (never a `band.*` track), in source order. */
export interface CardTrackFacts {
  label: string;
  role: StudioRole;
  /** Distinct `s` and `bank` values of the track's events. */
  sounds: readonly string[];
  /** Event count. */
  notes: number;
  /** Lowest and highest MIDI over pitched events; `null` when none. */
  low: number | null;
  high: number | null;
  /** Distinct pitches over pitched events. */
  distinct: number;
}

export interface CardFacts {
  bpm: number | null;
  tracks: readonly CardTrackFacts[];
  /** Distinct toolbox ids the code uses. */
  tools: readonly string[];
  /** Roman numerals of the chord slots in order, consecutive repeats collapsed. */
  numerals: readonly string[];
}
