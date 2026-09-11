import { dice, manifest, type Tile } from './random';
export type Unit = { id: string; tiles: Tile[] };
export type Diver = { uid: string; position: number; direction: 'out' | 'home'; status: 'aboard' | 'underwater' | 'returned'; cargo: Unit[]; bank: Tile[] };
export type Dive = { number: number; oxygen: number; turn: number; active: string; phase: 'roll' | 'landing'; path: (Unit | null)[]; divers: Diver[]; roll?: { faces: [number, number]; movement: number; from: number; to: number; uid: string }; history: string[] };
export function initialDive(seed: number, uids: string[], starter: string): Dive {
  return { number: 1, oxygen: 25, turn: 1, active: starter, phase: 'roll', path: manifest(seed).map(t => ({ id: t.id, tiles: [t] })), divers: uids.map(uid => ({ uid, position: 0, direction: 'out', status: 'aboard', cargo: [], bank: [] })), history: [] };
}
export function destination(position: number, length: number, occupied: number[], steps: number, direction: 'out' | 'home') {
  let result = position;
  for (let remaining = steps, cursor = position; remaining > 0;) {
    cursor += direction === 'out' ? 1 : -1;
    if (cursor <= 0) return 0;
    if (cursor > length) break;
    if (!occupied.includes(cursor)) { result = cursor; remaining--; }
  }
  return result;
}
export function conserved(dive: Dive, seed: number) {
  const all = [...dive.path.flatMap(u => u?.tiles ?? []), ...dive.divers.flatMap(d => [...d.cargo.flatMap(u => u.tiles), ...d.bank])];
  const original = manifest(seed);
  return all.length === 32 && new Set(all.map(t => t.id)).size === 32 && all.every(t => original.some(o => o.id === t.id && o.value === t.value && o.level === t.level));
}
function finishTurn(d: Dive) {
  const index = d.divers.findIndex(p => p.uid === d.active);
  for (let n = 1; n <= d.divers.length; n++) {
    const next = d.divers[(index + n) % d.divers.length];
    if (next.status !== 'returned') { d.active = next.uid; break; }
  }
  d.turn++; d.phase = 'roll';
}
export function turn(dive: Dive, seed: number, actor: string, type: string, payload: Record<string, unknown>): Dive | null {
  if (actor !== dive.active || dive.divers.every(p => p.status === 'returned')) return null;
  const d = structuredClone(dive), player = d.divers.find(p => p.uid === actor)!;
  if (type === 'turn/rolled') {
    if (d.phase !== 'roll' || !['out', 'home'].includes(String(payload.direction)) || (player.status === 'aboard' && payload.direction !== 'out') || (player.direction === 'home' && payload.direction !== 'home')) return null;
    player.direction = payload.direction as 'out' | 'home';
    d.oxygen -= player.cargo.length;
    const faces = dice(seed, d.number, d.turn), movement = Math.max(0, faces[0] + faces[1] - player.cargo.length);
    const from = player.position;
    player.position = destination(from, d.path.length, d.divers.filter(p => p.uid !== actor && p.position > 0).map(p => p.position), movement, player.direction);
    d.roll = { faces, movement, from, to: player.position, uid: actor };
    player.status = player.position === 0 && player.direction === 'home' ? 'returned' : 'underwater';
    d.phase = 'landing';
    if (player.status === 'returned') finishTurn(d);
  } else if (type === 'turn/landed') {
    if (d.phase !== 'landing') return null;
    const unit = d.path[player.position - 1];
    if (payload.choice === 'pickup') {
      if (!unit) return null;
      player.cargo.push(unit); d.path[player.position - 1] = null;
    } else if (payload.choice === 'drop') {
      const index = player.cargo.findIndex(u => u.id === payload.unitId);
      if (unit || index < 0 || player.position < 1) return null;
      d.path[player.position - 1] = player.cargo.splice(index, 1)[0];
    } else if (payload.choice !== 'pass') return null;
    finishTurn(d);
  } else return null;
  if (!conserved(d, seed)) throw new Error('Treasure conservation failed');
  return d;
}
/** The only board/cargo shape passed to player components. Concealed values and seed never cross this boundary. */
export function playerView(dive: Dive) {
  const concealed = (u: Unit) => ({ id: u.id, levels: u.tiles.map(t => t.level), count: u.tiles.length });
  return { ...dive, path: dive.path.map(u => u ? concealed(u) : null), divers: dive.divers.map(d => ({ ...d, cargo: d.cargo.map(concealed), bank: d.bank.map(t => ({ level: t.level, value: t.value })), points: d.bank.reduce((sum, t) => sum + t.value, 0) })) };
}
