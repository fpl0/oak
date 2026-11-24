// The <option>s of a Band select (the New sketch dialog, the sketch's settings): the Bands the learner has met
// first, under "Your bands", the rest under "Later in the course"; each named without Roman numerals until they
// are taught (`bandLabel`).
import type { BandDef } from "@oak/content-kit";
import { useCourseProgress } from "../lib/queries.ts";
import { bandLabel, bandReached, bandsMet } from "./model.ts";
import { useUnlockedSet } from "./queries.ts";

/** The Roman-numeral overlay's unlock (U06.L02): from then on a Band's name keeps its numerals. */
const NUMERALS_TOOL = "tb.feature.rn";

export function BandOptions({ fitting }: { fitting: readonly Pick<BandDef, "id" | "title">[] }) {
  const progress = useCourseProgress();
  const { unlocked } = useUnlockedSet();
  const numerals = (unlocked as ReadonlySet<string>).has(NUMERALS_TOOL);
  const met = bandsMet(bandReached(progress.data));
  const mine = fitting.filter((b) => met.has(b.id));
  const later = fitting.filter((b) => !met.has(b.id));
  const options = (list: readonly Pick<BandDef, "id" | "title">[]) =>
    list.map((b) => (
      <option key={b.id} value={b.id}>
        {bandLabel(b.title, numerals)}
      </option>
    ));
  // One group needs no heading: a learner who has met none, or all, sees a plain list.
  if (mine.length === 0 || later.length === 0) return <>{options(fitting)}</>;
  return (
    <>
      <optgroup label="Your bands">{options(mine)}</optgroup>
      <optgroup label="Later in the course">{options(later)}</optgroup>
    </>
  );
}
