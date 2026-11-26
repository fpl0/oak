// /onboarding/$step: the first ten minutes (ux §8; contracts §2.3 U00, §8). The machine (machine.ts) owns where
// the learner is; the URL mirrors it; every change is saved through `PUT /api/onboarding` (persist.ts), so a
// reload resumes on the same screen. The screens are the onboarding's own (loop, edit, reaction, preferences,
// tutor, sketch, coda) and the shared set-up parts of app/src/voice, all in one frame (docs/design/retry.md §6.1):
// the header says "Step N of 13 · name" (with the mic's and timing's sub-steps) and its done dots go back; every
// screen has its name as the heading, one sentence of what to do, and the same footer, with "Back: <name>" at its
// left and the primary at its right.
import type { OnboardingStep, Profile } from "@oak/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMachine } from "@xstate/react";
import { useEffect, useRef, useState } from "react";
import { usePageTitle } from "../lib/nav.ts";
import { useBootstrap, useProfile, useProfileUpdate, useTutorStatus } from "../lib/queries.ts";
import { browserStorage, EMPTY_BASELINE, saveEnded } from "../session/persist.ts";
import { clearSubject, setSubject } from "../tutor/context.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Page } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { ErrorState, LoadingState } from "../ui/kit/QueryState.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { useFocusHeaderContent } from "../ui/shell/focus-header.ts";
import type { PartBack } from "../voice/parts/common.tsx";
import { FirstSingPart } from "../voice/parts/FirstSingPart.tsx";
import { HeadphonesPart } from "../voice/parts/HeadphonesPart.tsx";
import { LatencyPart } from "../voice/parts/LatencyPart.tsx";
import { MicPart } from "../voice/parts/MicPart.tsx";
import { RangePart } from "../voice/parts/RangePart.tsx";
import { useVoiceSync } from "../voice/sync.ts";
import { useQuietChosen, useVoice } from "../voice/use-voice.ts";
import { canVisit, isOnboardingStep, prevBefore, railOf, STEP_META, stepFromParam } from "./flow.ts";
import { LoopStage } from "./LoopStage.tsx";
import { ONBOARDING_LOOP, withEdit } from "./loop.ts";
import { onboardingMachine, patchOf } from "./machine.ts";
import { onboardingStore } from "./persist.ts";
import { SoundGate } from "./SoundGate.tsx";
import { CodaScreen } from "./screens/CodaScreen.tsx";
import { PrefsScreen } from "./screens/PrefsScreen.tsx";
import { SketchScreen } from "./screens/SketchScreen.tsx";
import { TutorScreen } from "./screens/TutorScreen.tsx";
import { WelcomeScreen } from "./screens/WelcomeScreen.tsx";
import { ONBOARDING_THREAD } from "./thread.ts";
import "../workbench/index.ts";

export function OnboardingFlow({ param }: { param: string }) {
  const profile = useProfile();
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  if (!profile.data) return <LoadingState label="Loading your set-up…" />;
  return <Flow param={param} profile={profile.data} />;
}

function Flow({ param, profile }: { param: string; profile: Profile }) {
  const navigate = useNavigate();
  const [snap, send] = useMachine(onboardingMachine);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const lastSaved = useRef<string | null>(null);
  const prevStep = useRef<OnboardingStep | null>(null);
  const tutor = useTutorStatus();
  const boot = useBootstrap();
  const profileUpdate = useProfileUpdate();
  const ctx = snap.context;
  const step = ctx.step;
  const finished = snap.status === "done";
  // Quiet mode as the learner chose it, wherever (Settings › Voice "just for today" in another tab included): this
  // tab hears the change (`useVoiceSync`) and the flow follows it, so no step asks for the mic in Quiet mode.
  useVoiceSync();
  const voice = useVoice();
  const quietNow = useQuietChosen(profile);

  // Load once: the server's copy (or the local mirror while the endpoint is not there).
  // Deliberately once per mount
  useEffect(() => {
    let live = true;
    onboardingStore.load().then(
      ({ state }) => {
        if (!live) return;
        lastSaved.current = JSON.stringify(patchOf({ ...state, quiet: profile.quiet }));
        send({ type: "LOADED", state, quiet: profile.quiet });
        setLoaded(true);
      },
      (e: unknown) => live && setLoadError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, []);

  // The flow follows Quiet mode switched on or off outside the mic step (the mic step tells the machine itself).
  const lastQuiet = useRef<boolean | null>(null);
  // Deliberately keyed on the chosen Quiet mode only
  useEffect(() => {
    if (!loaded || finished) return;
    const was = lastQuiet.current;
    lastQuiet.current = quietNow;
    if (was === null ? quietNow !== ctx.quiet : was !== quietNow) send({ type: "QUIET", on: quietNow });
  }, [quietNow, loaded]);

  // Save every change of the resumable state.
  useEffect(() => {
    if (!loaded) return;
    const patch = patchOf(ctx);
    const key = JSON.stringify(patch);
    if (key === lastSaved.current) return;
    lastSaved.current = key;
    onboardingStore.save(patch).catch((e: unknown) => {
      toast.error("Your place wasn't saved", e instanceof Error ? e.message : undefined);
    });
  }, [loaded, ctx]);

  // URL → machine: Back/Forward and hand-typed URLs visit a reachable step; anything else is put right.
  // Deliberately keyed on the URL only
  useEffect(() => {
    if (!loaded || finished) return;
    // A number (Today's "/onboarding/1") means "where I left off".
    const want = /^\d+$/.test(param) ? null : stepFromParam(param);
    if (want === step) return;
    if (want && canVisit(ctx, want)) send({ type: "VISIT", step: want });
    else void navigate({ to: "/onboarding/$step", params: { step }, replace: true });
  }, [param, loaded]);

  // Machine → URL: each new screen is a history entry; the first one replaces the URL that brought us here.
  // Deliberately keyed on the step only
  useEffect(() => {
    if (!loaded || finished) return;
    const first = prevStep.current === null;
    prevStep.current = step;
    if (param !== step) void navigate({ to: "/onboarding/$step", params: { step }, replace: first });
    // Focus lands on the new screen: its primary action if it took focus, else its heading.
    requestAnimationFrame(() => {
      const main = document.getElementById("main");
      if (!main || main.contains(document.activeElement)) return;
      main.querySelector<HTMLElement>("h1, h2")?.focus({ preventScroll: true });
      main.scrollTop = 0;
    });
  }, [step, loaded]);

  // The current step's own sub-step (the mic's three, timing's two), for the header's progress. The part sets it
  // while mounted and clears it when it unmounts.
  const [sub, setSub] = useState<string | null>(null);
  const label = STEP_META[step].label;
  usePageTitle(`Hello, Loop · ${label}`);
  useFocusHeaderContent("Hello, Loop", loaded && !finished ? railOf(ctx, step, sub) : null, {
    position: true,
    onVisit: (id) => {
      if (isOnboardingStep(id)) send({ type: "VISIT", step: id });
    },
  });

  const code = ctx.firstEdit === null ? ONBOARDING_LOOP : withEdit(ONBOARDING_LOOP, ctx.firstEdit);
  const [liveCode, setLiveCode] = useState<string | null>(null);
  // The tutor sees the loop while it is on screen (the tutor screen sets its own subject).
  useEffect(() => {
    if (step !== "loop" && step !== "edit" && step !== "react" && step !== "sketch") return;
    setSubject({ thread: ONBOARDING_THREAD, title: "Hello, Loop", tutorOpen: true, code: liveCode ?? code });
  }, [step, liveCode, code]);
  useEffect(() => () => clearSubject(ONBOARDING_THREAD), []);

  const done = (s: OnboardingStep, extra: { firstEdit?: number; sketchId?: string } = {}) =>
    send({ type: "DONE", step: s, at: new Date().toISOString(), ...extra });
  const skip = (s: OnboardingStep) => send({ type: "SKIP", step: s });

  const finish = async () => {
    setFinishing(true);
    try {
      done("coda");
      await onboardingStore.save({
        ...patchOf(ctx),
        step: "coda",
        completed: [...new Set([...ctx.completed, "coda" as const])],
        finished: true,
      });
      if (profile.onboardedAt === null) {
        await profileUpdate.mutateAsync({ body: { onboardedAt: new Date().toISOString() } });
        // Onboarding is the first day's session ("Done for today", ux §8): Today then shows the done state
        // instead of offering a full session straight after it (the learner may still start one from there).
        const day = boot.data?.day;
        if (day)
          saveEnded(browserStorage(), {
            v: 1,
            sessionId: "onboarding",
            day,
            summary: null,
            reports: [],
            wrappedEarly: false,
            baseline: EMPTY_BASELINE,
            mapItemId: "U00.L01",
            title: "Hello, Loop",
          });
      }
      await navigate({ to: "/" });
    } catch (e) {
      setFinishing(false);
      toast.error("That didn't save", e instanceof Error ? e.message : undefined);
    }
  };

  // The record says finished but the profile was never stamped (the stamp failed after the save): Today reads the
  // profile, so without the stamp it would send the learner straight back here.
  const goToday = async () => {
    try {
      if (profile.onboardedAt === null)
        await profileUpdate.mutateAsync({ body: { onboardedAt: new Date().toISOString() } });
      await navigate({ to: "/" });
    } catch (e) {
      toast.error("That didn't save", e instanceof Error ? e.message : undefined);
    }
  };

  if (loadError)
    return (
      <Page width="focus">
        <Callout
          tone="issue"
          title="Oak couldn't load your place"
          actions={<Button onClick={() => location.reload()}>Try again</Button>}
        >
          {loadError}
        </Callout>
      </Page>
    );
  if (!loaded) return <LoadingState label="Loading your place…" />;
  if (finished && !finishing)
    return (
      <Page width="focus">
        <section className="flex flex-col gap-4 py-8" data-testid="onboarding-finished">
          <h1 className="text-h1">You're set up</h1>
          <p className="text-text-2">
            Onboarding is done. Today has your next session; Settings › Voice re-runs any measurement.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" loading={profileUpdate.isPending} onClick={() => void goToday()}>
              Go to Today
            </Button>
            <Link to="/settings/voice/setup" className={buttonClass("secondary")}>
              Set up mic and voice
            </Link>
          </div>
        </section>
      </Page>
    );

  const prev = step === "coda" ? "sketch" : prevBefore(ctx, step);
  const back: PartBack | null = prev
    ? { label: STEP_META[prev].label, onBack: () => send({ type: "VISIT", step: prev }) }
    : null;
  const partCommon = { profile, context: "onboarding" as const, back, onSub: setSub };
  const skipIf = (s: OnboardingStep) => (STEP_META[s].skippable ? () => skip(s) : undefined);

  let body: React.ReactNode;
  switch (step) {
    case "welcome":
      body = <WelcomeScreen onStarted={() => done("welcome")} />;
      break;
    case "loop":
    case "edit":
    case "react":
      body = (
        <SoundGate>
          <LoopStage
            step={step}
            firstEdit={ctx.firstEdit}
            back={back}
            onEdited={(value) => {
              // The edit screen finishes with the first number that runs; on the reaction every run is theirs.
              if (step === "edit") done("edit", { firstEdit: value });
              else if (step === "react") send({ type: "EDITED", value });
            }}
            onContinue={() => done(step)}
            onCode={setLiveCode}
          />
        </SoundGate>
      );
      break;
    case "prefs":
      body = <PrefsScreen profile={profile} onDone={() => done("prefs")} back={back} />;
      break;
    case "tutor":
      body = (
        <TutorScreen
          firstEdit={ctx.firstEdit}
          code={code}
          onDone={() => done("tutor")}
          onSkip={() => skip("tutor")}
          back={back}
        />
      );
      break;
    case "headphones":
      body = (
        <HeadphonesPart {...partCommon} onDone={() => done("headphones")} onSkip={() => skip("headphones")} />
      );
      break;
    case "mic":
      body = (
        <MicPart
          {...partCommon}
          onDone={() => {
            if (ctx.quiet) send({ type: "QUIET", on: false });
            // Allowing the mic ends a Quiet mode chosen for today (or for good) too: the sung steps come back.
            if (quietNow) void voice.setQuiet(false, voice.quiet.reason === "today" ? "today" : "always");
            done("mic");
          }}
          onQuiet={() => {
            send({ type: "QUIET", on: true });
            done("mic");
          }}
        />
      );
      break;
    case "range":
      body = <RangePart {...partCommon} onDone={() => done("range")} onSkip={skipIf("range")} />;
      break;
    case "latency":
      body = <LatencyPart {...partCommon} onDone={() => done("latency")} onSkip={skipIf("latency")} />;
      break;
    case "first-sing":
      body = (
        <FirstSingPart {...partCommon} onDone={() => done("first-sing")} onSkip={skipIf("first-sing")} />
      );
      break;
    case "sketch":
      body = (
        <SoundGate>
          <SketchScreen
            code={code}
            heard={ctx.firstEdit !== null}
            sketchId={ctx.sketchId}
            back={back}
            onSaved={(id) => done("sketch", { sketchId: id })}
          />
        </SoundGate>
      );
      break;
    case "coda":
      body = (
        <CodaScreen
          state={ctx}
          profile={profile}
          tutorReady={tutor.data?.tutor === "ready" && tutor.data.active !== null}
          finishing={finishing}
          back={back}
          onFinish={() => void finish()}
        />
      );
      break;
  }

  return (
    <Page width="focus">
      <div
        className="flex flex-col gap-4"
        data-testid="onboarding"
        data-step={step}
        data-quiet={ctx.quiet ? "1" : "0"}
      >
        {body}
      </div>
    </Page>
  );
}
