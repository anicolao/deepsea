import { describe, expect, it } from "vitest";
import {
  initialDive,
  turn,
  destination,
  conserved,
  playerView,
  continueDive,
} from "../../src/lib/game/engine";
describe("multiplayer turns", () => {
  it("charges once, skips occupied spaces, and hands off only after landing", () => {
    const d = initialDive(2026, ["a", "b"], "a");
    const rolled = turn(d, 2026, "a", "turn/rolled", { direction: "out" })!;
    expect(rolled.roll).toMatchObject({ faces: [3, 3], from: 0, to: 6 });
    expect(rolled.active).toBe("a");
    expect(rolled.oxygen).toBe(25);
    expect(
      turn(rolled, 2026, "a", "turn/rolled", { direction: "out" }),
    ).toBeNull();
    const landed = turn(rolled, 2026, "a", "turn/landed", {
      choice: "pickup",
    })!;
    expect(landed.active).toBe("b");
    expect(landed.divers[0].cargo).toHaveLength(1);
    expect(landed.path[5]).toBeNull();
    expect(conserved(landed, 2026)).toBe(true);
    expect(d.divers[0].cargo).toHaveLength(0);
  });
  it("rejects out of turn, first-turn return, pickup on blank and cargo-free drop", () => {
    const d = initialDive(2026, ["a", "b"], "a");
    expect(turn(d, 2026, "b", "turn/rolled", { direction: "out" })).toBeNull();
    expect(turn(d, 2026, "a", "turn/rolled", { direction: "home" })).toBeNull();
    expect(turn(d, 2026, "a", "turn/landed", { choice: "pickup" })).toBeNull();
    const r = turn(d, 2026, "a", "turn/rolled", { direction: "out" })!;
    expect(
      turn(r, 2026, "a", "turn/landed", { choice: "drop", unitId: "missing" }),
    ).toBeNull();
  });
  it("resolves overshoot, occupied skipping and submarine arrival", () => {
    expect(destination(29, 32, [32], 5, "out")).toBe(31);
    expect(destination(31, 32, [32], 2, "out")).toBe(31);
    expect(destination(0, 32, [1, 2], 2, "out")).toBe(4);
    expect(destination(2, 32, [1], 1, "home")).toBe(0);
    expect(destination(9, 32, [], 0, "out")).toBe(9);
  });
  it("conceals every unrevealed tile value and seed from the player view", () => {
    const d = initialDive(2026, ["a", "b"], "a");
    const view = JSON.stringify(playerView(d));
    expect(view).not.toContain("value");
    expect(view).not.toContain("seed");
    expect(playerView(d).path).toHaveLength(32);
  });
  it("conserves all tiles through many legal pickup/pass turns", () => {
    for (let seed = 0; seed < 40; seed++) {
      let d = initialDive(seed, ["a", "b", "c", "d", "e", "f"], "a");
      for (let i = 0; i < 30 && d.stage === "playing"; i++) {
        d = turn(d, seed, d.active, "turn/rolled", { direction: "out" })!;
        const me = d.divers.find((p) => p.uid === d.active)!;
        d = turn(d, seed, d.active, "turn/landed", {
          choice: d.path[me.position - 1] ? "pickup" : "pass",
        })!;
        expect(conserved(d, seed)).toBe(true);
      }
    }
  });
});

it("cargo costs oxygen once, slows movement, and returning cannot reverse", () => {
  let d = initialDive(2026, ["a", "b"], "a");
  d = turn(d, 2026, "a", "turn/rolled", { direction: "out" })!;
  d = turn(d, 2026, "a", "turn/landed", { choice: "pickup" })!;
  d = turn(d, 2026, "b", "turn/rolled", { direction: "out" })!;
  d = turn(d, 2026, "b", "turn/landed", { choice: "pass" })!;
  const r = turn(d, 2026, "a", "turn/rolled", { direction: "home" })!;
  expect(r.oxygen).toBe(24);
  expect(r.roll!.movement).toBe(
    Math.max(0, r.roll!.faces[0] + r.roll!.faces[1] - 1),
  );
  expect(turn(r, 2026, "a", "turn/rolled", { direction: "home" })).toBeNull();
  if (r.phase === "landing") {
    let next = turn(r, 2026, "a", "turn/landed", { choice: "pass" })!;
    next = turn(next, 2026, "b", "turn/rolled", { direction: "out" })!;
    next = turn(next, 2026, "b", "turn/landed", { choice: "pass" })!;
    expect(
      turn(next, 2026, "a", "turn/rolled", { direction: "out" }),
    ).toBeNull();
  }
});

it("keeps public move history across dives without recording concealed treasure values", () => {
  let d = initialDive(2026, ["a", "b"], "a");
  d = turn(d, 2026, "a", "turn/rolled", { direction: "out" })!;
  expect(d.roll?.turn).toBe(1);
  d = turn(d, 2026, "a", "turn/landed", { choice: "pickup" })!;
  expect(d.history).toEqual([
    {
      uid: "a",
      dive: 1,
      turn: 1,
      text: "Rolled 3 + 3, carrying 0 units. Swam outward from the submarine to space 6. Oxygen: 25.",
    },
    { uid: "a", dive: 1, turn: 1, text: "Picked up one treasure unit." },
  ]);
  expect(JSON.stringify(playerView(d))).not.toMatch(/value|seed/);
  for (let moves = 0; moves < 30 && d.stage === "playing"; moves++) {
    const actor = d.active,
      diver = d.divers.find((p) => p.uid === actor)!;
    d = turn(d, 2026, actor, "turn/rolled", {
      direction: diver.status === "aboard" ? "out" : "home",
    })!;
    if (d.stage === "playing" && d.phase === "landing")
      d = turn(d, 2026, actor, "turn/landed", { choice: "pass" })!;
  }
  expect(d.stage).toBe("review");
  const previous = structuredClone(d.history);
  const next = continueDive(d, "b")!;
  expect(next.history).toEqual(previous);
  expect(next.history).not.toBe(d.history);
  expect(next.roll).toBeUndefined();
  expect(next.number).toBe(2);
});

it("conservation caching never accepts changed values, duplicate tiles or another room seed", () => {
  const original = initialDive(2026, ["a", "b"], "a");
  expect(conserved(original, 2026)).toBe(true);
  const changed = structuredClone(original);
  changed.path[0]!.tiles[0].value++;
  expect(conserved(changed, 2026)).toBe(false);
  const duplicate = structuredClone(original);
  duplicate.path[0] = duplicate.path[1];
  expect(conserved(duplicate, 2026)).toBe(false);
  expect(conserved(initialDive(7, ["a", "b"], "a"), 7)).toBe(true);
  expect(conserved(original, 7)).toBe(false);
  expect(conserved(original, 2026)).toBe(true);
});
it("later transitions keep earlier history rows independent", () => {
  const rolled = turn(
    initialDive(2026, ["a", "b"], "a"),
    2026,
    "a",
    "turn/rolled",
    { direction: "out" },
  )!;
  const landed = turn(rolled, 2026, "a", "turn/landed", { choice: "pickup" })!;
  landed.history[0].text = "changed copy";
  expect(rolled.history[0].text).toContain("Rolled 3 + 3");
  expect(rolled.history).toHaveLength(1);
});
