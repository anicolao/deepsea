import { expect, it } from "vitest";
import {
  replay,
  VERSIONS,
  type ConfirmedEvent,
} from "../../src/lib/game/protocol";
import {
  initialDive,
  turn,
  orderLost,
  continueDive,
  conserved,
  finalResults,
} from "../../src/lib/game/engine";
function game() {
  const events: ConfirmedEvent[] = [];
  const add = (
    actorUid: string,
    type: string,
    payload: Record<string, unknown>,
  ) => {
    const n = events.length + 1;
    const event = {
      ...VERSIONS,
      id: n === 1 ? "created" : "move_" + n,
      clientId: "tab",
      clientSeq: n,
      actorUid,
      type,
      payload,
      createdAt: { seconds: n, nanoseconds: 0 },
    };
    events.push(event);
    return event;
  };
  add("a", "game/created", { gameId: "race", hostName: "Mira" });
  add("b", "lobby/joined", { name: "Sol" });
  add("a", "lobby/ready", { ready: true, rosterRevision: "move_2" });
  add("b", "lobby/ready", { ready: true, rosterRevision: "move_2" });
  add("a", "game/started", {
    starterUid: "a",
    seed: 2026,
    expectedActionId: "move_4",
  });
  return { events, add, state: () => replay("race", events) };
}
it("competing turn envelopes charge oxygen once and converge regardless of arrival order", () => {
  const g = game();
  for (const [actor, type, payload] of [
    ["a", "turn/rolled", { direction: "out" }],
    ["a", "turn/landed", { choice: "pickup" }],
    ["b", "turn/rolled", { direction: "out" }],
    ["b", "turn/landed", { choice: "pass" }],
  ] as const)
    g.add(actor, type, {
      ...payload,
      expectedActionId: g.state().room!.lastActionId,
    });
  const expectedActionId = g.state().room!.lastActionId;
  const accepted = g.add("a", "turn/rolled", {
    direction: "out",
    expectedActionId,
  });
  const once = g.state();
  const duplicate = g.add("a", "turn/rolled", {
    direction: "home",
    expectedActionId,
  });
  expect(g.state().room).toEqual(once.room);
  expect(g.state().acceptedIds).toContain(accepted.id);
  expect(g.state().acceptedIds).not.toContain(duplicate.id);
  expect(g.state().room!.dive!.oxygen).toBe(24);
  expect(replay("race", [...g.events].reverse())).toEqual(g.state());
});
it("competing continuation requests advance exactly one dive without resetting scores twice", () => {
  const g = game();
  while (g.state().room!.dive!.stage === "playing") {
    const d = g.state().room!.dive!,
      p = d.divers.find((p) => p.uid === d.active)!;
    const type = d.phase === "roll" ? "turn/rolled" : "turn/landed";
    const payload =
      d.phase === "roll"
        ? { direction: p.status === "aboard" ? "out" : "home" }
        : { choice: "pass" };
    g.add(d.active, type, {
      ...payload,
      expectedActionId: g.state().room!.lastActionId,
    });
  }
  const expectedActionId = g.state().room!.lastActionId;
  g.add("a", "dive/continued", { expectedActionId });
  const once = g.state().room;
  g.add("b", "dive/continued", { expectedActionId });
  expect(g.state().room).toEqual(once);
  expect(once!.dive!.number).toBe(2);
  expect(replay("race", [...g.events].reverse())).toEqual(g.state());
});
it.each(
  [2, 3, 4, 5, 6].flatMap((players) =>
    Array.from({ length: 40 }, (_, index) => ({ players, seed: index + 1 })),
  ),
)(
  "$players-player complete game with seed $seed conserves tiles through every action and cleanup",
  ({ players, seed }) => {
    let d = initialDive(
        seed,
        ["a", "b", "c", "d", "e", "f"].slice(0, players),
        "a",
      ),
      actions = 0;
    while (d.stage !== "finished" && actions++ < 1000) {
      if (d.stage === "review") d = continueDive(d, "a")!;
      else if (d.stage === "cleanup") {
        const owner = d.cleanup[0],
          cargo = d.divers.find((p) => p.uid === owner)!.cargo;
        d = orderLost(d, seed, owner, cargo.map((u) => u.id).reverse())!;
      } else {
        const p = d.divers.find((p) => p.uid === d.active)!;
        if (d.phase === "roll")
          d = turn(d, seed, p.uid, "turn/rolled", {
            direction:
              p.direction === "home" || p.cargo.length >= 2 ? "home" : "out",
          })!;
        else
          d = turn(d, seed, p.uid, "turn/landed", {
            choice: d.path[p.position - 1] ? "pickup" : "pass",
          })!;
      }
      expect(d).not.toBeNull();
      expect(conserved(d, seed)).toBe(true);
    }
    expect(d.stage).toBe("finished");
    expect(d.reviews).toHaveLength(3);
    const results = finalResults(d);
    expect(results.rows).toHaveLength(players);
    expect(results.winners.length).toBeGreaterThan(0);
    for (const row of results.rows)
      expect(row.dives.reduce((a, b) => a + b, 0)).toBe(row.points);
  },
);
