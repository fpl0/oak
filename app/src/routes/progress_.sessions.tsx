// Progress › Your sessions (contracts §9.7): app/src/session/progress/sessions/SessionsPage.tsx.
import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "../session/progress/sessions/SessionsPage.tsx";

export const Route = createFileRoute("/progress_/sessions")({ component: SessionsPage });
