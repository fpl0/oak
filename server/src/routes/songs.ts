// songs.* (docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.4): each unit's song, its takes and releases.
// The writes that a retry or a second tab could repeat (start, a take, a release) take an optional idempotency key.
import type { AppDeps } from "../deps.ts";
import { idempotent } from "../idempotency.ts";
import type { Mounter } from "./define.ts";

export function songRoutes(mount: Mounter, d: AppDeps): void {
  const s = d.services.unitSongs;

  mount("songs.list", () => ({ items: s.list() }));
  mount("songs.get", ({ params }) => s.get(params.unitId));
  mount("songs.start", ({ params, body }) => {
    const { idempotencyKey, ...rest } = body;
    return idempotent(d, "songs.start", idempotencyKey, { unitId: params.unitId, body: rest }, () =>
      s.start(params.unitId, rest.flavour),
    );
  });
  mount("songs.setFlavour", ({ params, body }) => s.setFlavour(params.unitId, body.flavour));
  mount("songs.rename", ({ params, body }) => s.rename(params.unitId, body.title));
  mount("songs.ackStyle", ({ params }) => s.ackStyle(params.unitId));
  mount("songs.recordTake", ({ params, body }) => {
    const { idempotencyKey, ...rest } = body;
    return idempotent(d, "songs.recordTake", idempotencyKey, { unitId: params.unitId, body: rest }, () =>
      s.recordTake(params.unitId, rest),
    );
  });
  mount("songs.release", ({ params, body }) => {
    const { idempotencyKey, ...rest } = body;
    return idempotent(d, "songs.release", idempotencyKey, { unitId: params.unitId, body: rest }, () =>
      s.release(params.unitId, rest.title),
    );
  });
  mount("songs.snapshot", ({ params }) => s.snapshot(params.unitId, Number(params.releaseId)));
}
