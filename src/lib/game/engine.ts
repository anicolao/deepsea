import { dice, manifest, type Tile } from './random';
export type Unit = { id: string; tiles: Tile[] };
export type Diver = { uid: string; position: number; direction: 'out' | 'home'; status: 'aboard' | 'underwater' | 'returned'; cargo: Unit[]; bank: Tile[] };
export type Review = { number: number; players: { uid: string; returned: boolean; gained: Tile[]; total: number }[]; starter: string };
export type Dive = { stage: 'playing' | 'cleanup' | 'review' | 'finished'; reviews: Review[]; cleanup: string[]; returnOrder: string[]; nextStarter?: string; number: number; oxygen: number; turn: number; active: string; phase: 'roll' | 'landing'; path: (Unit | null)[]; divers: Diver[]; roll?: { faces: [number, number]; movement: number; from: number; to: number; uid: string }; history: string[] };
export function initialDive(seed: number, uids: string[], starter: string): Dive {
  return { stage: 'playing', reviews: [], cleanup: [], returnOrder: [], number: 1, oxygen: 25, turn: 1, active: starter, phase: 'roll', path: manifest(seed).map(t => ({ id: t.id, tiles: [t] })), divers: uids.map(uid => ({ uid, position: 0, direction: 'out', status: 'aboard', cargo: [], bank: [] })), history: [] };
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
export function groupLost(units: Unit[]): Unit[] {
  const stacks: Unit[] = [];
  for (let i = 0; i < units.length; i += 3) {
    const tiles = units.slice(i, i + 3).flatMap(u => u.tiles);
    stacks.push({ id: 'stack_' + tiles[0].id, tiles });
  }
  return stacks;
}
function placeLost(d: Dive, player: Diver) {
  d.path.push(...groupLost(player.cargo)); player.cargo = []; d.cleanup.shift();
}
function automaticCleanup(d: Dive) {
  while (d.cleanup.length) {
    const player = d.divers.find(p => p.uid === d.cleanup[0])!;
    if (player.cargo.length > 1) break;
    placeLost(d, player);
  }
  if (!d.cleanup.length) {
    d.path = d.path.filter(u => u !== null); d.stage = 'review';
    if (d.number === 3 || !d.path.length) {
      for (let number = d.number + 1; number <= 3; number++) d.reviews.push({ number, starter: d.nextStarter!, players: d.divers.map(p => ({ uid:p.uid, returned:true, gained:[], total:p.bank.reduce((sum,t)=>sum+t.value,0) })) });
      d.stage = 'finished';
    }
  }
}
function resolveDive(d: Dive) {
  const stranded = d.divers.filter(p => p.status !== 'returned').sort((a,b) => b.position - a.position || d.divers.indexOf(a) - d.divers.indexOf(b));
  d.nextStarter = stranded[0]?.uid ?? d.returnOrder.at(-1)!;
  d.reviews.push({ number: d.number, starter: d.nextStarter, players: d.divers.map(p => {
    const gained = p.status === 'returned' ? p.cargo.flatMap(u => u.tiles) : [];
    p.bank.push(...gained);
    if (p.status === 'returned') p.cargo = [];
    return { uid: p.uid, returned: p.status === 'returned', gained, total: p.bank.reduce((sum,t) => sum + t.value,0) };
  }) });
  d.cleanup = stranded.map(p => p.uid); d.stage = 'cleanup'; automaticCleanup(d);
}
export function orderLost(dive: Dive, seed: number, actor: string, order: unknown): Dive | null {
  if (dive.stage !== 'cleanup' || dive.cleanup[0] !== actor || !Array.isArray(order)) return null;
  const player = dive.divers.find(p => p.uid === actor)!;
  if (order.length !== player.cargo.length || new Set(order).size !== order.length || !order.every(id => typeof id === 'string' && player.cargo.some(u => u.id === id))) return null;
  const d = structuredClone(dive), p = d.divers.find(p => p.uid === actor)!;
  p.cargo = order.map(id => p.cargo.find(u => u.id === id)!);
  placeLost(d, p); automaticCleanup(d);
  if (!conserved(d,seed)) throw new Error('Treasure conservation failed');
  return d;
}
function finishTurn(d: Dive) {
  if (d.oxygen <= 0 || d.divers.every(p => p.status === 'returned')) { resolveDive(d); return; }

  const index = d.divers.findIndex(p => p.uid === d.active);
  for (let n = 1; n <= d.divers.length; n++) {
    const next = d.divers[(index + n) % d.divers.length];
    if (next.status !== 'returned') { d.active = next.uid; break; }
  }
  d.turn++; d.phase = 'roll';
}
export function turn(dive: Dive, seed: number, actor: string, type: string, payload: Record<string, unknown>): Dive | null {
  if (dive.stage !== 'playing' || actor !== dive.active || dive.divers.every(p => p.status === 'returned')) return null;
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
    if (player.status === 'returned') { d.returnOrder.push(actor); finishTurn(d); }
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

export function continueDive(dive: Dive, actor: string): Dive | null {
  if (dive.stage !== 'review' || !dive.divers.some(p => p.uid === actor) || dive.number >= 3 || !dive.path.length) return null;
  return { ...structuredClone(dive), number:dive.number+1, stage:'playing', oxygen:25, turn:1, active:dive.nextStarter!, phase:'roll', roll:undefined, returnOrder:[], cleanup:[], divers:dive.divers.map(p=>({...structuredClone(p),position:0,direction:'out',status:'aboard',cargo:[]})) };
}
export function finalResults(dive: Dive) {
  const rows = dive.divers.map(p => ({uid:p.uid, points:p.bank.reduce((sum,t)=>sum+t.value,0), levelFour:p.bank.filter(t=>t.level===4).length, dives:[1,2,3].map(number=>dive.reviews.find(r=>r.number===number)?.players.find(row=>row.uid===p.uid)?.gained.reduce((sum,t)=>sum+t.value,0) ?? 0)}));
  const points = Math.max(...rows.map(p=>p.points));
  const tied = rows.filter(p=>p.points===points);
  const levelFour = Math.max(...tied.map(p=>p.levelFour));
  const winners = tied.filter(p=>p.levelFour===levelFour).map(p=>p.uid);
  return {rows,winners,tiebreak:tied.length>1 && tied.some(p=>p.levelFour!==levelFour)};
}
