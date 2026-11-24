// Settings › Grading reports (contracts §11.8): app/src/routes/settings/-reports/ReportsPage.tsx.
import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "./-reports/ReportsPage.tsx";

export const Route = createFileRoute("/settings/reports")({ component: ReportsPage });
