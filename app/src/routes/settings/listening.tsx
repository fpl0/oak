// Settings › Listening pass (architecture §3.8): app/src/routes/settings/-listen/ListenPage.tsx.
import { createFileRoute } from "@tanstack/react-router";
import { ListenPage } from "./-listen/ListenPage.tsx";

export const Route = createFileRoute("/settings/listening")({ component: ListenPage });
