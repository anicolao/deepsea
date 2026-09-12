import { expect, it } from "vitest";
import {
  createProjector,
  replay,
  VERSIONS,
  type ConfirmedEvent,
} from "../../src/lib/game/protocol";

const creation: ConfirmedEvent = {
  ...VERSIONS,
  type: "game/created",
  id: "created",
  actorUid: "mira",
  clientId: "tab",
  clientSeq: 1,
  createdAt: { seconds: 1, nanoseconds: 0 },
  payload: { gameId: "room", hostName: "Mira" },
};
const join = (n: number, name: string): ConfirmedEvent => ({
  ...creation,
  id: `join-${n}`,
  actorUid: name,
  clientSeq: n,
  createdAt: { seconds: n, nanoseconds: 0 },
  type: "lobby/joined",
  payload: { name },
});

it("rebuilds changed, deleted, late and conflicting history exactly like full replay", () => {
  const project = createProjector("room"),
    sol = join(2, "Sol"),
    kai = join(3, "Kai");
  for (const events of [
    [creation],
    [creation, kai],
    [kai, creation, sol],
    [creation, sol, kai],
    [creation, kai],
    [creation, { ...kai, payload: { name: "Renamed" } }],
    [creation, kai, { ...kai, payload: { name: "Collision" } }],
    [creation, sol, kai],
    [],
    [creation],
  ])
    expect(project(events)).toEqual(replay("room", events));
});

it("preserves rejected actions, malformed snapshots and version blocks across cache updates", () => {
  const project = createProjector("room"),
    sol = join(2, "Sol");
  const illegal = { ...join(3, "Sol"), id: "duplicate-seat" };
  const future = { ...join(4, "Kai"), reducerVersion: 999 };
  for (const events of [
    [creation, sol],
    [creation, sol, illegal],
    [creation, sol, illegal, future],
    [creation, sol, illegal, future, join(5, "Pip")],
    [creation, null],
    [creation, sol],
    [creation, sol, sol],
  ])
    expect(project(events)).toEqual(replay("room", events));
});

it("does not retain mutations made to an input or returned projection", () => {
  const project = createProjector("room"),
    events = structuredClone([creation, join(2, "Sol")]);
  const result = project(events);
  result.room!.members[0].name = "Changed outside the projector";
  result.acceptedIds.length = 0;
  result.diagnostics.push("external");
  expect(project(events)).toEqual(replay("room", events));
  events[1].payload.name = "Kai";
  expect(project(events)).toEqual(replay("room", events));
});

for (const count of [2, 6])
  it(`matches a full replay after every move of a ${count}-player three-dive game`, () => {
    const project = createProjector("room"),
      events: ConfirmedEvent[] = [creation];
    let state = project(events);
    const append = (
      actorUid: string,
      type: string,
      payload: Record<string, unknown>,
    ) => {
      const n = events.length + 1;
      events.push({
        ...creation,
        id: `action-${n}`,
        actorUid,
        type,
        payload,
        clientSeq: n,
        createdAt: { seconds: n, nanoseconds: 0 },
      });
      state = project(events);
      expect(state).toEqual(replay("room", [...events].reverse()));
      expect(state.acceptedIds).toHaveLength(events.length);
    };
    for (let n = 1; n < count; n++)
      append(`friend-${n}`, "lobby/joined", { name: `Friend ${n}` });
    for (const member of state.room!.members)
      append(member.uid, "lobby/ready", {
        ready: true,
        rosterRevision: state.room!.rosterRevision,
      });
    append("mira", "game/started", {
      seed: 393,
      starterUid: "mira",
      expectedActionId: state.room!.lastActionId,
    });
    for (
      let move = 0;
      move < 150 && state.room!.dive!.stage !== "finished";
      move++
    ) {
      const dive = state.room!.dive!,
        expectedActionId = state.room!.lastActionId;
      if (dive.stage === "review")
        append("mira", "dive/continued", { expectedActionId });
      else if (dive.phase === "landing")
        append(dive.active, "turn/landed", {
          choice: "pass",
          expectedActionId,
        });
      else {
        const diver = dive.divers.find((p) => p.uid === dive.active)!;
        append(dive.active, "turn/rolled", {
          direction: diver.position === 0 ? "out" : "home",
          expectedActionId,
        });
      }
    }
    expect(state.room!.dive!.stage).toBe("finished");
    expect(state.room!.dive!.reviews).toHaveLength(3);
  });
