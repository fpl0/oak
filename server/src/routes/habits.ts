import type { HabitsService } from "../services/habits.ts";
import type { Mounter } from "./define.ts";

export function habitsRoutes(mount: Mounter, habits: HabitsService): void {
  mount("habits.get", () => habits.get());
}
