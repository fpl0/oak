import { createFileRoute } from "@tanstack/react-router";
import About from "../../content/about.mdx";
import { useContent } from "../../lib/content.ts";
import { usePageTitle } from "../../lib/nav.ts";
import { useHealth } from "../../lib/queries.ts";
import { ReadOnlyRow, Section } from "../../ui/kit/Field.tsx";
import { SoundCredits } from "./-components/SoundCredits.tsx";

export const Route = createFileRoute("/settings/about")({ component: AboutPage });

function AboutPage() {
  usePageTitle("Settings · About");
  const health = useHealth();
  const content = useContent();
  return (
    <div className="flex flex-col gap-6">
      <article className="rounded-card border border-border bg-surface p-5">
        <About />
      </article>
      <SoundCredits />
      <Section title="Versions">
        <ReadOnlyRow
          label="App"
          value={health.data?.appVersion ?? (health.isError ? "server offline" : "…")}
        />
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
