import { expect, it } from "vitest";
import {
  initialDive,
  turn,
  continueDive,
  conserved,
  finalResults,
} from "../../src/lib/game/engine";
it("plays three dives, preserves the compacted path and bank, and finishes automatically", () => {
  let d = initialDive(2026, ["a", "b"], "a");
  for (let dive = 1; dive <= 3; dive++) {
    for (let n = 0; n < 60 && d.stage === "playing"; n++) {
      const uid = d.active,
        p = d.divers.find((p) => p.uid === uid)!;
      const first = p.status === "aboard";
      d = turn(d, 2026, uid, "turn/rolled", {
        direction: first ? "out" : "home",
      })!;
      if (d.stage === "playing" && d.phase === "landing")
        d = turn(d, 2026, uid, "turn/landed", {
          choice: first ? "pickup" : "pass",
        })!;
      expect(conserved(d, 2026)).toBe(true);
    }
    expect(d.reviews).toHaveLength(dive);
    if (dive < 3) {
      const path = structuredClone(d.path),
        banks = d.divers.map((p) => p.bank);
      expect(continueDive(d, "outsider")).toBeNull();
      d = continueDive(d, "b")!;
      expect(d.oxygen).toBe(25);
      expect(d.path).toEqual(path);
      expect(d.divers.map((p) => p.bank)).toEqual(banks);
      expect(continueDive(d, "b")).toBeNull();
    }
  }
  expect(d.stage).toBe("finished");
  expect(continueDive(d, "a")).toBeNull();
  expect(finalResults(d).rows.map((p) => p.points)).toEqual([2, 12]);
  expect(finalResults(d).winners).toEqual(["b"]);
});
it("breaks point ties by individual level-IV tiles and otherwise shares victory", () => {
  const d = initialDive(2026, ["a", "b"], "a");
  function bank(uid: string, values: number[]) {
    for (const value of values) {
      const index = d.path.findIndex((u) => u?.tiles[0].value === value);
      const unit = d.path[index]!;
      d.divers.find((p) => p.uid === uid)!.bank.push(...unit.tiles);
      d.path[index] = null;
    }
  }
  bank("a", [15, 9]);
  bank("b", [12, 12]);
  expect(conserved(d, 2026)).toBe(true);
  expect(finalResults(d)).toMatchObject({ winners: ["b"], tiebreak: true });
  const shared = initialDive(2026, ["a", "b"], "a");
  for (const player of shared.divers)
    for (const value of [12, 8]) {
      const index = shared.path.findIndex((u) => u?.tiles[0].value === value);
      player.bank.push(...shared.path[index]!.tiles);
      shared.path[index] = null;
    }
  expect(conserved(shared, 2026)).toBe(true);
  expect(finalResults(shared)).toMatchObject({
    winners: ["a", "b"],
    tiebreak: false,
  });
});
it("an empty retained path awards zero for the remaining dives", () => {
  const d = initialDive(2026, ["a", "b"], "a");
  const tiles = d.path.flatMap((u) => u!.tiles);
  d.path = d.path.map(() => null);
  d.divers[0].cargo = [{ id: tiles[0].id, tiles: [tiles[0]] }];
  d.divers[0].position = 1;
  d.divers[0].status = "underwater";
  d.divers[0].direction = "home";
  d.divers[1].bank = tiles.slice(1);
  d.divers[1].status = "returned";
  d.returnOrder = ["b"];
  const end = turn(d, 2026, "a", "turn/rolled", { direction: "home" })!;
  expect(end.stage).toBe("finished");
  expect(end.path).toHaveLength(0);
  expect(end.reviews).toHaveLength(3);
  expect(
    end.reviews
      .slice(1)
      .every((r) => r.players.every((p) => p.gained.length === 0)),
  ).toBe(true);
  expect(conserved(end, 2026)).toBe(true);
});
