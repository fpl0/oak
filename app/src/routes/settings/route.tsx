// Settings layout (ux §2.3): a section list and the chosen section.
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { SETTINGS_SECTIONS } from "../../lib/nav.ts";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });

function SettingsLayout() {
  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-6 py-6">
      {/* Sticky inside the scrolling main region: About and Tutor run to several screens, and the list of sections
          stays in reach. */}
      <nav aria-label="Settings" className="sticky top-6 w-44 shrink-0 self-start">
        <h1 className="mb-3 text-h2">Settings</h1>
        <ul className="flex flex-col gap-0.5">
          {SETTINGS_SECTIONS.map((s) => (
            <li key={s.id}>
              <Link
                to={`/settings/${s.id}`}
                className="block rounded-control px-2.5 py-1.5 text-text-2 hover:bg-surface-2 hover:text-text"
                activeProps={{ "aria-current": "page", className: "bg-lane-in text-accent font-medium" }}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
