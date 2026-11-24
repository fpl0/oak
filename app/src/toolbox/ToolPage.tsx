// One toolbox entry (ux §5.1): what it is and does, the concept behind it, where it is learned and which
// lessons use it. Unlocked: a live, editable two-bar example in a small Workbench, "Open in Studio" with the
// example as it is now, and the unlock moment to replay. Locked: the unlock condition and a listen-only teaser
// (you can hear it, not open it; contracts §3.1 rule 4).
import type { ToolEntry, UnlockableId } from "@oak/content-kit";
import type { PatternPlayer } from "@oak/strudel";
import { Link, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ChevronLeft, Lock, NotebookPen, Play, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useContent } from "../lib/content.ts";
import { lessonTitles } from "../lib/content-model.ts";
import { formatDate } from "../lib/format.ts";
import { usePageTitle } from "../lib/nav.ts";
import { getOak } from "../lib/oak.ts";
import { useCourseProgress, useSketchCreate, useUnlocks } from "../lib/queries.ts";
import { appWorkbenchServices } from "../lib/workbench-services.ts";
import { InlineCodeText } from "../session/today/SideOffer.tsx";
import { useUnlockedSet } from "../studio/queries.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Card, Chip, EmptyState, Page } from "../ui/kit/basics.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { LoadingState } from "../ui/kit/QueryState.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { shownConcept, shownToolMeaning, shownToolLabel as toolLabel } from "./label.ts";
import "../workbench/index.ts";
import { errorWords } from "../lib/error-words.ts";
import type { PanelId } from "../workbench/panels.ts";
import { ServicesGate } from "../workbench/ServicesGate.tsx";
import { Workbench } from "../workbench/Workbench.tsx";
import { toolDemo } from "./demos.ts";
import { FeatureGlimpse } from "./Glimpse.tsx";
import { glimpseOf } from "./glimpse.ts";
import {
  courseSort,
  demoBars,
  demoKey,
  demoMeter,
  KIND_LABEL,
  sitesOf,
  siteText,
  siteTitle,
  toolSketchBody,
  unlockText,
  usedInGroups,
} from "./model.ts";
import { creditText, packSoundOf, soundIndex, useSoundCredits } from "./sound-credits.ts";
import { UnlockMoment } from "./UnlockMoment.tsx";
import { useToolUsage } from "./usage.ts";

export function ToolPage({ toolId }: { toolId: string }) {
  const content = useContent();
  const unlocks = useUnlocks();
  const tool = content.data?.toolbox.find((t) => t.id === toolId);
  usePageTitle(tool ? toolLabel(tool).text : "Toolbox");
  if (content.isPending)
    return (
      <Page width="narrow">
        <LoadingState label="Opening the tool" />
      </Page>
    );
  if (!tool)
    return (
      <Page width="narrow">
        <BackLink />
        <h1 className="sr-only">Toolbox</h1>
        <EmptyState
          title="Not in the toolbox"
          action={
            <Link to="/toolbox" className={buttonClass("secondary")}>
              Open the toolbox
            </Link>
          }
        >
          “{toolId}” is not one of Oak's tools. The toolbox lists every one, unlocked or not.
        </EmptyState>
      </Page>
    );
  const unlock = unlocks.data?.items.find((u) => u.itemId === tool.id) ?? null;
  return <ToolDetail key={tool.id} tool={tool} unlockedAt={unlock?.unlockedAt ?? null} />;
}

function BackLink() {
  return (
    <Link
      to="/toolbox"
      className="mb-3 inline-flex items-center gap-1 rounded-control text-sm text-text-2 hover:text-text"
    >
      <ChevronLeft aria-hidden className="size-4" /> Toolbox
    </Link>
  );
}

function ToolDetail({ tool, unlockedAt }: { tool: ToolEntry; unlockedAt: string | null }) {
  const content = useContent();
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const usage = useToolUsage();
  const open = unlockedAt !== null;
  const [replay, setReplay] = useState(false);
  const progress = useCourseProgress();
  const coreOrder = content.data?.syllabus?.defaultOrder ?? [];
  const lessons = courseSort(
    (usage.data?.get(tool.id) ?? []).filter((l) => !sitesOf(tool).includes(l)),
    titles,
    coreOrder,
  );
  const done = new Set(
    (progress.data?.lessons ?? []).filter((l) => l.status === "completed").map((l) => l.lessonId as string),
  );
  const hasDemo = tool.catalog.demo.trim() !== "" || toolDemo(tool.id) !== null;

  return (
    <Page width="narrow">
      <BackLink />
      <header className="mb-5">
        <p className="text-sm text-text-2">{KIND_LABEL[tool.kind]}</p>
        <h1
          className={clsx("mt-0.5 flex items-center gap-2 text-h2", toolLabel(tool).mono && "font-mono")}
          data-testid="tool-name"
        >
          {open ? null : <Lock aria-label="locked" className="size-5 text-text-3" />}
          {toolLabel(tool).text}
        </h1>
        <p className="mt-2 flex flex-wrap gap-2">
          {open ? (
            <Chip tone="accent">Unlocked {formatDate(unlockedAt)}</Chip>
          ) : (
            <Chip>Not unlocked yet</Chip>
          )}
          {tool.audible === false ? <Chip tone="issue">Not audible in this sound pack</Chip> : null}
        </p>
        {tool.kind === "sound" ? <SoundCreditLine signature={tool.catalog.signature} /> : null}
      </header>

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h2 className="mb-1 font-sans text-sm font-semibold text-text-2">
            {open ? "Why it's in your toolbox" : "The idea behind it"}
          </h2>
          <p className="text-text">{capitalised(shownConcept(tool))}.</p>
          <h2 className="mt-4 mb-1 font-sans text-sm font-semibold text-text-2">What it does</h2>
          <p className="whitespace-pre-wrap">
            <InlineCodeText text={shownToolMeaning(tool)} />
          </p>
          {/* An app feature has no code signature (its catalog row repeats its name): nothing to show. */}
          {tool.catalog.signature !== tool.code || !["feature", "lens", "template"].includes(tool.kind) ? (
            <>
              <h2 className="mt-4 mb-1 font-sans text-sm font-semibold text-text-2">Signature</h2>
              <code className="font-mono">{tool.catalog.signature}</code>
            </>
          ) : null}
        </Card>

        {open && hasDemo ? (
          <LiveExample tool={tool} />
        ) : !open ? (
          <LockedTeaser tool={tool} titles={titles} />
        ) : null}

        <Card className="p-4" data-testid="tool-lessons">
          <h2 className="mb-1 font-sans text-sm font-semibold text-text-2">In the course</h2>
          <p>
            {open ? "Learned in " : "Taught in "}
            {sitesOf(tool).map((s, i) => (
              <span key={s}>
                {i > 0 ? " or " : null}
                <span title={siteText(s, titles)}>{siteTitle(s, titles)}</span>
              </span>
            ))}
            .
          </p>
          {usage.isPending ? (
            <p className="mt-1 text-sm text-text-3">Looking through the lessons…</p>
          ) : lessons.length > 0 ? (
            <UsedIn
              lessons={lessons}
              done={done}
              titles={titles}
              taughtAt={firstSite(sitesOf(tool), coreOrder)}
              coreOrder={coreOrder}
            />
          ) : (
            <p className="mt-1 text-sm text-text-3">No other written lesson uses it yet.</p>
          )}
        </Card>

        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button icon={<Sparkles aria-hidden className="size-4" />} onClick={() => setReplay(true)}>
              Replay the unlock moment
            </Button>
          </div>
        ) : null}
      </div>
      <Dialog
        open={replay}
        onClose={() => setReplay(false)}
        title="Unlock moment"
        hideTitle
        className="w-[min(94vw,40rem)]"
      >
        {replay ? (
          <UnlockMoment toolIds={[tool.id]} onDone={() => setReplay(false)} markSeen={false} />
        ) : null}
      </Dialog>
    </Page>
  );
}

const capitalised = (text: string) => (text[0]?.toUpperCase() ?? "") + text.slice(1);

/** Where a tool is taught first in the core's order (-1: not in the core). */
function firstSite(sites: readonly string[], coreOrder: readonly string[]): number {
  const at = sites.map((s) => coreOrder.indexOf(s)).filter((i) => i >= 0);
  return at.length > 0 ? Math.min(...at) : -1;
}

/**
 * "Also used in", in course order: the five most recent lessons already done (links back to them), the earlier
 * done ones behind "and N earlier lessons", then the next three still to come (with the lock), the rest behind "and
 * N more" (`usedInGroups`). A lesson of the core that comes before the one that teaches the tool says so: its code
 * plays the tool before the learner is taught it.
 */
function UsedIn({
  lessons,
  done,
  titles,
  taughtAt,
  coreOrder,
}: {
  lessons: readonly string[];
  done: ReadonlySet<string>;
  titles: ReadonlyMap<string, string>;
  taughtAt: number;
  coreOrder: readonly string[];
}) {
  const { earlier, recent, next, later } = usedInGroups(lessons, done);
  const early = (l: string) => {
    const at = coreOrder.indexOf(l);
    return taughtAt >= 0 && at >= 0 && at < taughtAt;
  };
  const row = (l: string) => (
    <li key={l} className="flex items-center gap-1.5">
      {done.has(l) ? (
        /^[A-Z]+\d*\.L\d+$/.test(l) ? (
          <Link
            to="/learn/$lessonId"
            params={{ lessonId: l }}
            className="text-link underline-offset-2 hover:underline"
          >
            {siteTitle(l, titles)}
          </Link>
        ) : (
          <span>{siteTitle(l, titles)}</span>
        )
      ) : (
        <>
          <Lock aria-label="not done yet" className="size-3.5 shrink-0 text-text-3" />
          <span className="text-text-2">{siteTitle(l, titles)}</span>
        </>
      )}
      {early(l) ? <span className="text-sm text-text-3">(heard there before it is taught)</span> : null}
    </li>
  );
  const more = (testId: string, words: string, rows: readonly string[]) =>
    rows.length > 0 ? (
      <details className="mt-1" data-testid={testId}>
        {/* py-1 makes it a 24px target (26.5px: text-sm's line is 18.5px). Not flex with min-h-6: a summary
            that is not display: list-item loses its disclosure triangle. */}
        <summary className="cursor-pointer py-1 text-sm text-text-2">
          and {rows.length} {words} {rows.length === 1 ? "lesson" : "lessons"}
        </summary>
        <ul className="mt-1 flex flex-col gap-0.5">{rows.map(row)}</ul>
      </details>
    ) : null;
  return (
    <>
      <h3 className="mt-3 mb-1 font-sans text-sm font-semibold text-text-2">Also used in</h3>
      {recent.length > 0 ? (
        <ul className="flex flex-col gap-0.5" data-testid="tool-used-in">
          {recent.map(row)}
        </ul>
      ) : null}
      {/* The earlier done lessons read as a tail of the recent five ("…, and 30 earlier lessons"). */}
      {more("tool-used-earlier", "earlier", earlier)}
      {next.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5" data-testid="tool-used-next">
          {next.map(row)}
        </ul>
      ) : null}
      {more("tool-used-more", "more", later)}
    </>
  );
}

/**
 * A sound's credit, from the pack's own credits (the same index as Settings → About → Sound credits), so the two
 * never disagree: every source the sound is built from, with its licence.
 */
function SoundCreditLine({ signature }: { signature: string }) {
  const credits = useSoundCredits();
  const sound = packSoundOf(signature);
  const entry =
    credits.data && sound ? soundIndex(credits.data.credits).find((s) => s.sound === sound) : null;
  if (!entry) return null;
  return (
    <p className="mt-2 text-sm text-text-2" data-testid="sound-credit">
      Sound: {creditText(entry)} ·{" "}
      <Link to="/settings/about" className="text-link underline-offset-2 hover:underline">
        Sound credits
      </Link>
    </p>
  );
}

/** How a feature's own page shows it at work (Wave 3 and Wave 4 features). */
const FEATURE_DEMOS: Record<string, { panels?: Partial<Record<PanelId, boolean>>; hint: string }> = {
  "tb.feature.degree-labels": {
    hint: "Every note carries its degree on the roll and under the staff. D in the Workbench turns them off and on.",
  },
  "tb.feature.solfege": {
    hint: "Syllables under the degrees: do is home. S in the Workbench turns them off and on.",
  },
  "tb.feature.keysig": {
    panels: { key: true },
    hint: "The Key panel follows the code: change D4 to A4 in .scale() and press Run. Shift+K opens it anywhere.",
  },
  "tb.feature.circle": {
    panels: { circle: true },
    hint: "Choose a key on the ring to hear this code in it; nothing in the code changes until you press Use. Shift+C opens it anywhere.",
  },
  "tb.feature.grand-staff": {
    hint: "The chords sit on the treble staff and the bass track on the bass clef below; middle C lies between the two.",
  },
  "tb.feature.rn": {
    hint: "The band under the roll names each chord and its numeral in C; the staff prints the numerals under the notes. Shift+R turns the numerals off and on, Shift+H the chord names.",
  },
  "tb.lens.function": {
    panels: { function: true },
    hint: "Home chords are T, chords that lead away are PD, chords that want home are D. Change a chord in the code and press Run to see its colour change. Shift+F turns the bands off and on.",
  },
  "tb.lens.range": {
    panels: { range: true },
    hint: "The flag marks the highest note, the mark under the roll the lowest; the line above the roll gives the span in half steps. Shift+G turns it off and on.",
  },
  "tb.lens.chord-tones": {
    panels: { "chord-tones": true },
    hint: "Ringed notes belong to the chord under them; dashed ones do not, tagged P for passing or N for neighbour. Shift+T turns it off and on.",
  },
  "tb.feature.leadsheet": {
    panels: { lead: true },
    hint: "The melody on one staff with the chord names above it. Save it as SVG from the staff, or Shift+L to switch back to the full staff.",
  },
};

/** Code tools that play chords: their example shows the roll with the chord band, not the mini view. */
const CHORD_TOOLS = new Set([
  "tb.arp",
  "tb.chord",
  "tb.voicing",
  "tb.anchor",
  "tb.mode.below",
  "tb.dict.triads",
  "tb.add",
  "tb.mode.root",
  "tb.struct",
  "chord.triad",
  "snd.rhodes",
  "snd.organ",
  "snd.pad",
]);

/** A small Workbench with the tool's two-bar example: editable, played and drawn like any other code. */
function LiveExample({ tool }: { tool: ToolEntry }) {
  const navigate = useNavigate();
  const create = useSketchCreate();
  const { unlocked } = useUnlockedSet();
  // Waves 5 and 6: the tools of U08–U17 and A1 play inside a short groove (demos.ts), with their panel or probe.
  const wave5 = toolDemo(tool.id);
  const demo = wave5?.code ?? tool.catalog.demo;
  const [code, setCode] = useState(demo);
  const meter = wave5?.meter ?? demoMeter(demo);
  const key = demoKey(demo) as { tonic: string; mode: "major" } | null;
  // A feature's page shows the feature at work: roll and staff side by side, its panel open, its lens switch.
  const feature =
    FEATURE_DEMOS[tool.id] ?? (wave5?.panels ? { panels: wave5.panels, hint: wave5.hint } : null);
  const chordTool = CHORD_TOOLS.has(tool.id) || (wave5 !== null && !feature);

  const openInStudio = async () => {
    try {
      const saved = await create.mutateAsync({ body: toolSketchBody(tool, code, wave5?.meter) });
      void navigate({ to: "/studio/$sketchId", params: { sketchId: saved.sketch.id } });
    } catch (e) {
      toast.error("Couldn't open it in the Studio", errorWords(e));
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="tool-example">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-sm font-semibold text-text-2">Try it: change a number and press Run</h2>
        <Button
          variant="primary"
          size="sm"
          icon={<NotebookPen aria-hidden className="size-4" />}
          loading={create.isPending}
          onClick={() => void openInStudio()}
          data-testid="open-in-studio"
        >
          Open in Studio
        </Button>
      </div>
      {feature || wave5 ? (
        <p className="text-sm text-text-2" data-testid="tool-hint">
          {feature?.hint ?? wave5?.hint}
        </p>
      ) : null}
      <ServicesGate load={appWorkbenchServices} auto>
        <Workbench
          id={`tool${tool.id.replace(/[^a-z0-9]/gi, "").slice(-12)}`}
          code={demo}
          {...(feature
            ? {
                variant: "compact" as const,
                views: ["roll", "staff"] as ("roll" | "staff")[],
                initialTab: "both" as const,
                ...(feature.panels ? { initialPanels: feature.panels } : {}),
              }
            : chordTool
              ? { variant: "compact" as const, views: ["roll"] as "roll"[] }
              : { variant: "mini" as const })}
          lessonCtx={{ key, meter, defaultBpm: 90, loopBars: wave5?.bars ?? demoBars(demo) }}
          {...(wave5?.probes ? { probeKinds: wave5.probes } : {})}
          lint={{
            profile: "studio",
            unlocked: unlocked as ReadonlySet<UnlockableId>,
            allowPreview: false,
            meter,
            key,
          }}
          onChange={setCode}
        />
      </ServicesGate>
    </Card>
  );
}

/**
 * What a learner can do with a locked tool before it unlocks. Code (and the sounds, scales and chords it names)
 * already plays in the Studio with a hint; a lens or a feature is part of the app and only appears once unlocked;
 * a template has nothing to add to its unlock condition.
 */
function lockedNote(tool: ToolEntry, titles: ReadonlyMap<string, string>): string | null {
  const where = sitesOf(tool)
    .map((s) => siteTitle(s, titles))
    .join(" or ");
  switch (tool.kind) {
    case "lens":
      return `It arrives in the lens bar after ${where}.`;
    case "feature":
      return `It arrives in the app after ${where}.`;
    case "template":
      return null;
    default:
      return "You can already use it in the Studio, where it plays with a hint; graded steps wait until it is unlocked.";
  }
}

/** Locked: the condition, and the example to hear (not to open). */
function LockedTeaser({ tool, titles }: { tool: ToolEntry; titles: ReadonlyMap<string, string> }) {
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const player = useRef<PatternPlayer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    player.current?.stop();
    setPlaying(false);
  };
  const hear = async () => {
    if (playing) return stop();
    setBusy(true);
    try {
      const oak = await getOak();
      await oak.unlock();
      player.current ??= oak.createPatternPlayer();
      const out = await player.current.load(tool.catalog.demo, {
        bars: 2,
        cps: 0,
        lint: { profile: "content", unlocked: new Set(), allowPreview: true, meter: "4/4", key: null },
      });
      if (!out.ok) {
        toast.info("This example cannot play here");
        return;
      }
      await player.current.play();
      setPlaying(true);
      const cps = oak.transport.cps() || 0.5;
      timer.current = setTimeout(stop, Math.min(8000, (2 / cps) * 1000));
    } catch (e) {
      toast.error("Sound did not start", errorWords(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      player.current?.dispose();
    },
    [],
  );
  return (
    <Card className="border-dashed p-4" data-testid="tool-locked">
      <h2 className="mb-1 font-sans text-sm font-semibold text-text-2">Not in your toolbox yet</h2>
      <p data-testid="unlock-condition">{unlockText(tool, titles)}</p>
      {glimpseOf(tool.id) ? (
        <div className="mt-3">
          <FeatureGlimpse glimpse={glimpseOf(tool.id) as NonNullable<ReturnType<typeof glimpseOf>>} />
        </div>
      ) : null}
      {lockedNote(tool, titles) ? (
        <p className="mt-1 text-sm text-text-2">{lockedNote(tool, titles)}</p>
      ) : null}
      {/* A lens is something to see: an audio-only teaser would play sound and show nothing of it. */}
      {tool.catalog.demo.trim() && tool.kind !== "lens" ? (
        <div className="mt-3">
          <Button
            size="sm"
            loading={busy}
            icon={
              playing ? (
                <Square aria-hidden className="size-3.5" />
              ) : (
                <Play aria-hidden className="size-3.5" />
              )
            }
            aria-pressed={playing}
            onClick={() => void hear()}
            data-testid="teaser"
          >
            {playing ? "Stop" : "Hear an example"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
