import { expect, it } from "vitest";
import {
  initialDive,
  turn,
  orderLost,
  groupLost,
  conserved,
  playerView,
} from "../../src/lib/game/engine";

it("finishes the oxygen-exhausting landing before asking for lost cargo order", () => {
  const d = initialDive(2026, ["a", "b"], "a");
  const a = d.divers[0];
  a.status = "underwater";
  a.position = 8;
  a.cargo = d.path.slice(0, 3).map((u) => u!);
  d.path.splice(0, 3, null, null, null);
  d.oxygen = 1;
  const rolled = turn(d, 2026, "a", "turn/rolled", { direction: "out" })!;
  expect(rolled.oxygen).toBe(-2);
  expect(rolled.stage).toBe("playing");
  expect(rolled.phase).toBe("landing");
  const landed = turn(rolled, 2026, "a", "turn/landed", { choice: "pickup" })!;
  expect(landed.stage).toBe("cleanup");
  expect(landed.cleanup[0]).toBe("a");
  expect(landed.divers[0].cargo).toHaveLength(4);
  expect(
    turn(landed, 2026, "a", "turn/rolled", { direction: "home" }),
  ).toBeNull();
  const ids = landed.divers[0].cargo.map((u) => u.id);
  expect(orderLost(landed, 2026, "b", ids)).toBeNull();
  expect(
    orderLost(landed, 2026, "a", [ids[0], ids[0], ids[2], ids[3]]),
  ).toBeNull();
  expect(orderLost(landed, 2026, "a", ids.slice(1))).toBeNull();
  const review = orderLost(landed, 2026, "a", ids.toReversed())!;
  expect(review.stage).toBe("review");
  expect(review.nextStarter).toBe("a");
  expect(review.path.at(-2)!.tiles.map((t) => t.id)).toEqual(
    ids.toReversed().slice(0, 3),
  );
  expect(review.path.at(-1)!.tiles).toHaveLength(1);
  expect(conserved(review, 2026)).toBe(true);
  expect(JSON.stringify(playerView(review).path)).not.toContain("value");
});
it("all returned ends the dive, reveals saved cargo, and selects the last returner", () => {
  const d = initialDive(2026, ["a", "b"], "a");
  const a = d.divers[0];
  a.status = "underwater";
  a.direction = "home";
  a.position = 1;
  a.cargo = [d.path[0]!];
  d.path[0] = null;
  d.divers[1].status = "returned";
  d.returnOrder = ["b"];
  const end = turn(d, 2026, "a", "turn/rolled", { direction: "home" })!;
  expect(end.stage).toBe("review");
  expect(end.returnOrder).toEqual(["b", "a"]);
  expect(end.nextStarter).toBe("a");
  expect(end.reviews[0].players[0]).toMatchObject({ returned: true, total: 3 });
  expect(end.divers[0].bank).toHaveLength(1);
  expect(end.divers[0].cargo).toHaveLength(0);
  expect(conserved(end, 2026)).toBe(true);
  expect(end.path).toHaveLength(31);
});
it("existing stacks stay indivisible when lost and dropped again", () => {
  const d = initialDive(2026, ["a", "b"], "a");
  const tiles = d.path.slice(0, 7).flatMap((u) => u!.tiles);
  const units = [
    { id: "first", tiles: tiles.slice(0, 3) },
    { id: "second", tiles: tiles.slice(3, 4) },
    { id: "third", tiles: tiles.slice(4, 6) },
    { id: "fourth", tiles: tiles.slice(6) },
  ];
  const grouped = groupLost(units);
  expect(grouped.map((u) => u.tiles.length)).toEqual([6, 1]);
  d.path.splice(0, 7, ...Array(7).fill(null));
  d.divers[0].cargo = grouped;
  d.divers[0].position = 1;
  d.divers[0].status = "underwater";
  d.phase = "landing";
  const dropped = turn(d, 2026, "a", "turn/landed", {
    choice: "drop",
    unitId: grouped[0].id,
  })!;
  expect(dropped.path[0]!.tiles).toHaveLength(6);
  expect(dropped.divers[0].cargo).toHaveLength(1);
  expect(conserved(dropped, 2026)).toBe(true);
});
it("automatically handles choice-free cleanup and deepest-first starter", () => {
  const d = initialDive(2026, ["a", "b"], "a");
  d.oxygen = 0;
  d.phase = "landing";
  d.divers[0].position = 1;
  d.divers[0].status = "underwater";
  d.divers[0].cargo = [d.path[0]!];
  d.path[0] = null;
  d.divers[1].position = 12;
  d.divers[1].status = "underwater";
  d.divers[1].cargo = [d.path[11]!];
  d.path[11] = null;
  const end = turn(d, 2026, "a", "turn/landed", { choice: "pass" })!;
  expect(end.stage).toBe("review");
  expect(end.nextStarter).toBe("b");
  expect(end.path.at(-2)!.tiles[0].id).toBe(d.divers[1].cargo[0].tiles[0].id);
  expect(conserved(end, 2026)).toBe(true);
});
