import { expect, it, vi } from "vitest";
import { createConfirmedEvents } from "../../src/lib/backend/confirmed-events";
import {
  createProjector,
  replay,
  VERSIONS,
  type ConfirmedEvent,
} from "../../src/lib/game/protocol";

const created: ConfirmedEvent = {
  ...VERSIONS,
  id: "created",
  type: "game/created",
  actorUid: "mira",
  clientId: "tab",
  clientSeq: 1,
  payload: { gameId: "room", hostName: "Mira" },
  createdAt: { seconds: 1, nanoseconds: 0 },
};
const joined: ConfirmedEvent = {
  ...created,
  id: "joined",
  actorUid: "sol",
  type: "lobby/joined",
  clientSeq: 2,
  payload: { name: "Sol" },
  createdAt: { seconds: 2, nanoseconds: 0 },
};
const document = (
  event: Record<string, unknown> & { id: string },
  pending = false,
) => ({
  id: event.id,
  metadata: { hasPendingWrites: pending },
  data: vi.fn(() => event),
});

it("decodes each changed document once and reuses history on metadata-only snapshots", () => {
  const update = createConfirmedEvents();
  const first = document(created),
    second = document(joined);
  expect(update([{ type: "added", doc: first }])).toEqual([created]);
  expect(update([{ type: "added", doc: second }])).toEqual([created, joined]);
  expect(update([])).toEqual([created, joined]);
  expect(first.data).toHaveBeenCalledTimes(1);
  expect(second.data).toHaveBeenCalledTimes(1);
});

it("matches full replay for additions, changed history, removals and late arrivals", () => {
  const update = createConfirmedEvents(),
    project = createProjector("room");
  const changed = { ...joined, payload: { name: "Sol renamed" } };
  expect(project(update([{ type: "added", doc: document(joined) }]))).toEqual(
    replay("room", [joined]),
  );
  expect(project(update([{ type: "added", doc: document(created) }]))).toEqual(
    replay("room", [created, joined]),
  );
  expect(
    project(update([{ type: "modified", doc: document(changed) }])),
  ).toEqual(replay("room", [created, changed]));
  const removed = document(created);
  expect(project(update([{ type: "removed", doc: removed }]))).toEqual(
    replay("room", [changed]),
  );
  expect(removed.data).not.toHaveBeenCalled();
});

it("keeps local pending events out until metadata confirms their server timestamp", () => {
  const update = createConfirmedEvents();
  const pending = document(created, true);
  expect(update([{ type: "added", doc: pending }])).toEqual([]);
  expect(pending.data).not.toHaveBeenCalled();
  expect(
    update([
      { type: "modified", doc: document({ ...created, createdAt: null }) },
    ]),
  ).toEqual([]);
  expect(update([{ type: "modified", doc: document(created) }])).toEqual([
    created,
  ]);
  expect(update([{ type: "modified", doc: pending }])).toEqual([]);
  expect(update([{ type: "modified", doc: document(created) }])).toEqual([
    created,
  ]);
});

it("removes a previously confirmed event if its timestamp becomes unresolved", () => {
  const update = createConfirmedEvents();
  update([{ type: "added", doc: document(created) }]);
  expect(
    update([
      { type: "modified", doc: document({ ...created, createdAt: null }) },
    ]),
  ).toEqual([]);
  const invalid = {
    ...created,
    createdAt: { seconds: "invalid", nanoseconds: 0 },
  };
  const projected = createProjector("room")(
    update([{ type: "modified", doc: document(invalid) }]),
  );
  expect(projected).toEqual(
    replay("room", [invalid as unknown as ConfirmedEvent]),
  );
});

it("isolates subscriptions and returns a fresh array without discarding cached events", () => {
  const first = createConfirmedEvents(),
    second = createConfirmedEvents();
  const result = first([{ type: "added", doc: document(created) }]);
  result.pop();
  expect(first([])).toEqual([created]);
  expect(second([])).toEqual([]);
  first([{ type: "removed", doc: document(created) }]);
  expect(first([])).toEqual([]);
});
