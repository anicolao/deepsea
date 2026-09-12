export const RANDOM_VERSION = "xorshift32-fnv1a-v1";
export function stream(seed: number, label: string) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Seed must be an unsigned 32-bit integer");
  let hash = 2166136261;
  for (const character of label)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  let state = (seed ^ hash) >>> 0 || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}
function bounded(next: () => number, bound: number) {
  const limit = Math.floor(0x100000000 / bound) * bound;
  let value: number;
  do {
    value = next();
  } while (value >= limit);
  return value % bound;
}
export function dice(
  seed: number,
  dive: number,
  turn: number,
): [number, number] {
  if (
    !Number.isInteger(dive) ||
    dive < 1 ||
    dive > 3 ||
    !Number.isSafeInteger(turn) ||
    turn < 1
  )
    throw new Error("Invalid dice address");
  const next = stream(seed, `dice:${dive}:${turn}`);
  return [
    Math.floor(bounded(next, 6) / 2) + 1,
    Math.floor(bounded(next, 6) / 2) + 1,
  ];
}
export type Tile = { id: string; level: number; value: number };
export function manifest(seed: number): Tile[] {
  const identities = stream(seed, "tile-identities");
  const used = new Set<string>();
  const tiles: Tile[] = [];
  for (let level = 1; level <= 4; level++) {
    const values = Array.from(
      { length: 8 },
      (_, i) => (level - 1) * 4 + Math.floor(i / 2),
    );
    const next = stream(seed, `shuffle:${level}`);
    for (let i = values.length - 1; i > 0; i--) {
      const j = bounded(next, i + 1);
      [values[i], values[j]] = [values[j], values[i]];
    }
    for (const value of values) {
      let id: string;
      do {
        id = `t_${identities().toString(16).padStart(8, "0")}${identities().toString(16).padStart(8, "0")}`;
      } while (used.has(id));
      used.add(id);
      tiles.push({ id, level, value });
    }
  }
  return tiles;
}
