// Oak 2.0 W3 (PLAN §4 S6): Studio's calm lines on Today, under the day's own decisions (after "Other ways today",
// before the Later list). On a light day, "Just play": a toolbox tool whose live demo is editable and never saved
// (its "Open in Studio" keeps it), or now and then a sketch over a Band style the learner has not used. And
// "Outside your lane" when it is due ("Not now" hides it for a while, remembered in this browser). Each is one line
// with a quiet button, never a primary action and never a goal (studio-offers.ts holds the rules).
import type { SketchCreate } from "@oak/api";
import type { FlavourId } from "@oak/content-kit";
import { Link, useNavigate } from "@tanstack/react-router";
import { Compass, Shuffle } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { bandMeter, bands } from "../../../../content/bands/index.ts";
import { useContent } from "../../lib/content.ts";
import { errorWords } from "../../lib/error-words.ts";
import { useSketchCreate, useSketches } from "../../lib/queries.ts";
import { toolName } from "../../lib/tool-label.ts";
import { useCatalogs } from "../../studio/catalog/catalog-queries.ts";
import {
  bandsForMeter,
  DEFAULT_KEY,
  nextSketchTitle,
  overBandStart,
  STUDIO_FLAVOURS,
} from "../../studio/model.ts";
import { useSketchDetails, useUnlockedSet } from "../../studio/queries.ts";
import { toolDemo } from "../../toolbox/demos.ts";
import { Button, buttonClass } from "../../ui/kit/Button.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { currentSessionId } from "../store.ts";
import type { TodayState } from "../today-model.ts";
import {
  BAND_STYLE_EVERY,
  daySeed,
  LIGHT_DAY_STATES,
  OUTSIDE_DISMISSED_KEY,
  STUDIO_OFFER_WORDS,
  type StudioOffer,
  studioOffers,
} from "./studio-offers.ts";

function readDismissed(): string | null {
  try {
    return localStorage.getItem(OUTSIDE_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(at: string): void {
  try {
    localStorage.setItem(OUTSIDE_DISMISSED_KEY, at);
  } catch {
    // not remembered: the line shows again on the next visit
  }
}

const KINDS_WITHOUT_DEMO = new Set(["template", "feature", "lens"]);

export function StudioOffers({ state, day }: { state: TodayState; day: string }) {
  const navigate = useNavigate();
  const content = useContent();
  const { unlocked } = useUnlockedSet();
  const light = LIGHT_DAY_STATES.includes(state);
  // The Band style is offered about one light day in four: only then are the sketches' versions read.
  const bandDay = light && daySeed(day, BAND_STYLE_EVERY) === 0;
  const sketches = useSketches();
  const ids = bandDay ? (sketches.data?.items ?? []).map((s) => s.id) : [];
  const details = useSketchDetails(ids);
  const outside = useCatalogs({ refKind: "outside" }, { enabled: state !== "first-run" });
  const [dismissedAt, setDismissedAt] = useState<string | null>(readDismissed);
  const create = useSketchCreate();

  const tools = content.data?.toolbox;
  const playable = useMemo(
    () =>
      (tools ?? [])
        .filter(
          (t) =>
            !KINDS_WITHOUT_DEMO.has(t.kind) &&
            unlocked.has(t.id as never) &&
            (t.catalog.demo.trim() !== "" || toolDemo(t.id) !== null),
        )
        .map((t) => t.id as string)
        .sort(),
    [tools, unlocked],
  );
  const used = new Set<string>();
  for (const d of details.values()) for (const v of d.versions) if (v.band) used.add(v.band.flavour);
  // While the versions are being read, every style counts as used (no Band offer flickers in and out).
  const readingVersions = bandDay && (sketches.isPending || details.size < ids.length);
  const usedFlavours: ReadonlySet<string> = readingVersions
    ? new Set(STUDIO_FLAVOURS.map((f) => f.id))
    : used;

  const offers = studioOffers({
    state,
    day,
    playableTools: playable,
    usedFlavours,
    // Until the catalogs are read (or where they are not served yet) "Outside your lane" waits.
    lastOutside: outside.isSuccess ? (outside.data.items[0]?.createdAt ?? null) : day,
    outsideDismissedAt: dismissedAt,
  });
  if (offers.length === 0) return null;

  const startBand = async (flavour: FlavourId) => {
    const band = bandsForMeter(bands, "4/4", bandMeter)[0];
    if (!band) return;
    const over = overBandStart("4/4");
    const body: SketchCreate = {
      title: nextSketchTitle(sketches.data?.items ?? []),
      originKind: "free",
      originId: null,
      sessionId: currentSessionId(),
      code: over.code,
      bpm: over.bpm,
      meter: "4/4",
      key: DEFAULT_KEY,
      band: { bandId: band.id, flavour, mutes: [] },
      analysis: null,
      note: null,
      tutorAssisted: false,
      ranOk: false,
      flags: { lockedTools: [], previewTools: [] },
    };
    try {
      const saved = await create.mutateAsync({ body });
      void navigate({ to: "/studio/$sketchId", params: { sketchId: saved.sketch.id } });
    } catch (e) {
      toast.error(STUDIO_OFFER_WORDS.bandFailed, errorWords(e));
    }
  };

  const line = (o: StudioOffer) => {
    if (o.kind === "just-play") {
      const tool = tools?.find((t) => t.id === o.toolId);
      if (!tool) return null;
      return (
        <Row
          key="just-play"
          kind="just-play"
          icon={<Shuffle aria-hidden className="size-4 shrink-0 text-text-3" />}
        >
          <p className="min-w-0 flex-1 text-sm text-text-2" data-testid="studio-offer-line">
            {STUDIO_OFFER_WORDS.justPlay(toolName(tool).text)}
          </p>
          <Link
            to="/toolbox/$toolId"
            params={{ toolId: tool.id }}
            className={buttonClass("ghost", "sm")}
            data-testid="just-play-open"
          >
            {STUDIO_OFFER_WORDS.openTool}
          </Link>
        </Row>
      );
    }
    if (o.kind === "band-style") {
      const style = STUDIO_FLAVOURS.find((f) => f.id === o.flavour)?.label ?? o.flavour;
      return (
        <Row
          key="band-style"
          kind="band-style"
          icon={<Shuffle aria-hidden className="size-4 shrink-0 text-text-3" />}
        >
          <p className="min-w-0 flex-1 text-sm text-text-2" data-testid="studio-offer-line">
            {STUDIO_OFFER_WORDS.bandStyle(style)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            loading={create.isPending}
            onClick={() => void startBand(o.flavour)}
            data-testid="band-style-start"
          >
            {STUDIO_OFFER_WORDS.startBand}
          </Button>
        </Row>
      );
    }
    return (
      <Row
        key="outside-lane"
        kind="outside-lane"
        icon={<Compass aria-hidden className="size-4 shrink-0 text-text-3" />}
      >
        <p className="min-w-0 flex-1 text-sm text-text-2" data-testid="studio-offer-line">
          {STUDIO_OFFER_WORDS.outside}
        </p>
        <Link
          to="/studio"
          search={{ catalog: "outside" }}
          className={buttonClass("ghost", "sm")}
          data-testid="outside-open"
        >
          {STUDIO_OFFER_WORDS.openOutside}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const at = new Date().toISOString();
            writeDismissed(at);
            setDismissedAt(at);
          }}
          data-testid="outside-not-now"
        >
          {STUDIO_OFFER_WORDS.notNow}
        </Button>
      </Row>
    );
  };

  return (
    <section
      aria-label={STUDIO_OFFER_WORDS.label}
      className="flex flex-col gap-2"
      data-testid="studio-offers"
    >
      {offers.map(line)}
    </section>
  );
}

function Row({ kind, icon, children }: { kind: StudioOffer["kind"]; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-border px-3 py-2"
      data-testid="studio-offer"
      data-kind={kind}
    >
      {icon}
      {children}
    </div>
  );
}
