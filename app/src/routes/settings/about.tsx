import { createFileRoute } from "@tanstack/react-router";
import About from "../../content/about.mdx";
import { isDesktopApp } from "../../lib/app-update.ts";
import { useContent } from "../../lib/content.ts";
import { usePageTitle } from "../../lib/nav.ts";
import { useAppUpdate, useBootstrap, useHealth } from "../../lib/queries.ts";
import { useUpdateSetting } from "../../lib/settings.ts";
import { Field, ReadOnlyRow, Section, Switch } from "../../ui/kit/Field.tsx";
import { SoundCredits } from "./-components/SoundCredits.tsx";

export const Route = createFileRoute("/settings/about")({ component: AboutPage });

function AboutPage() {
  usePageTitle("Settings · About");
  const health = useHealth();
  const content = useContent();
  const update = useAppUpdate();
  const bootstrap = useBootstrap();
  const setting = useUpdateSetting();
  const u = update.data;
  return (
    <div className="flex flex-col gap-6">
      <article className="rounded-card border border-border bg-surface p-5">
        <About />
      </article>
      <SoundCredits />
      <Section title="Versions">
        <ReadOnlyRow
          label="App"
          value={
            <>
              {health.data?.appVersion ?? (health.isError ? "server offline" : "…")}
              {u && (
                <span className="ml-3" data-testid="update-available">
                  Oak {u.latest} is out.{" "}
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link underline underline-offset-2"
                  >
                    Download
                  </a>
                  {" · "}
                  <a
                    href={u.notesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link underline underline-offset-2"
                  >
                    What's new
                  </a>
                </span>
              )}
            </>
          }
        />
        {isDesktopApp() && (
          <Field
            label="Check for new versions"
            help="Once a day, Oak asks GitHub for its latest version. Nothing about you is sent."
          >
            {({ id, describedBy }) => (
              <Switch
                id={id}
                describedBy={describedBy}
                checked={bootstrap.data?.settings.checkForUpdates ?? true}
                disabled={!bootstrap.data}
                onChange={(v) => setting.set("checkForUpdates", v)}
              />
            )}
          </Field>
        )}
        <ReadOnlyRow label="Contracts" value={health.data?.contractsVersion ?? "…"} />
        <ReadOnlyRow label="Database schema" value={health.data ? String(health.data.schemaVersion) : "…"} />
        <ReadOnlyRow
          label="Content"
          value={
            <code className="text-sm">
              {(health.data?.contentVersion ?? content.data?.version)?.slice(0, 12) ??
                (content.data ? "from source" : "…")}
            </code>
          }
        />
      </Section>
    </div>
  );
}
