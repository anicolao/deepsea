import { it, expect } from "vitest";
import {
  replay,
  VERSIONS,
  type ConfirmedEvent,
} from "../../src/lib/game/protocol";
const creation: ConfirmedEvent = {
  ...VERSIONS,
  type: "game/created",
  id: "created",
  payload: { gameId: "room", hostName: "Mira" },
  actorUid: "host",
  clientId: "host-tab",
  clientSeq: 1,
  createdAt: { seconds: 1, nanoseconds: 0 },
};
const action = (
  n: number,
  actorUid: string,
  type: string,
  payload: Record<string, unknown>,
): ConfirmedEvent => ({
  ...creation,
  id: `action_${n}`,
  clientSeq: n,
  actorUid,
  type,
  payload,
  createdAt: { seconds: n, nanoseconds: 0 },
});
it("caps six seats, deterministically rejects the seventh contender, and reuses a vacated seat", () => {
  const joins = Array.from({ length: 6 }, (_, i) =>
    action(i + 2, `guest${i}`, "lobby/joined", { name: `Guest ${i}` }),
  );
  const events = [creation, ...joins];
  expect(replay("room", events).room?.members.map((m) => m.uid)).toEqual([
    "host",
    "guest0",
    "guest1",
    "guest2",
    "guest3",
    "guest4",
  ]);
  expect(replay("room", [...events].reverse())).toEqual(replay("room", events));
  events.push(
    action(8, "guest1", "lobby/left", {}),
    action(9, "guest5", "lobby/joined", { name: "Guest 5" }),
  );
  expect(
    replay("room", events).room?.members.find((m) => m.uid === "guest5")?.seat,
  ).toBe(3);
});
it("clears readiness on roster change and rejects stale readiness without losing concurrent readies", () => {
  const events = [
    creation,
    action(2, "host", "lobby/ready", {
      ready: true,
      rosterRevision: "created",
    }),
    action(3, "guest", "lobby/joined", { name: "Sol" }),
    action(4, "host", "lobby/ready", {
      ready: true,
      rosterRevision: "created",
    }),
  ];
  expect(replay("room", events).room?.members.every((m) => !m.ready)).toBe(
    true,
  );
  events.push(
    action(5, "host", "lobby/ready", {
      ready: true,
      rosterRevision: "action_3",
    }),
    action(6, "guest", "lobby/ready", {
      ready: true,
      rosterRevision: "action_3",
    }),
  );
  expect(replay("room", events).room?.members.every((m) => m.ready)).toBe(true);
});
it("starts only once with an eligible confirmed crew and host-selected first diver", () => {
  const events = [
    creation,
    action(2, "guest", "lobby/joined", { name: "Sol" }),
  ];
  const payload = {
    seed: 2026,
    starterUid: "guest",
    expectedActionId: "action_2",
  };
  expect(
    replay("room", [...events, action(3, "host", "game/started", payload)]).room
      ?.phase,
  ).toBe("lobby");
  events.push(
    action(3, "host", "lobby/ready", {
      ready: true,
      rosterRevision: "action_2",
    }),
    action(4, "guest", "lobby/ready", {
      ready: true,
      rosterRevision: "action_2",
    }),
  );
  for (const [actor, p] of [
    ["guest", { ...payload, expectedActionId: "action_4" }],
    ["host", payload],
    [
      "host",
      { ...payload, expectedActionId: "action_4", starterUid: "stranger" },
    ],
  ] as const)
    expect(
      replay("room", [...events, action(5, actor, "game/started", p)]).room
        ?.phase,
    ).toBe("lobby");
  events.push(
    action(5, "host", "game/started", {
      ...payload,
      expectedActionId: "action_4",
    }),
  );
  const started = replay("room", events).room;
  expect(started?.phase).toBe("started");
  expect(started?.starterUid).toBe("guest");
  events.push(
    action(6, "late", "lobby/joined", { name: "Late" }),
    action(7, "guest", "lobby/left", {}),
    action(8, "host", "game/started", {
      ...payload,
      expectedActionId: "action_5",
    }),
  );
  expect(replay("room", events).room).toEqual(started);
});
it("host departure closes the lobby permanently", () => {
  const events = [
    creation,
    action(2, "host", "lobby/left", {}),
    action(3, "late", "lobby/joined", { name: "Late" }),
  ];
  expect(replay("room", events).room?.phase).toBe("closed");
  expect(replay("room", events).acceptedIds).toEqual(["created", "action_2"]);
});
