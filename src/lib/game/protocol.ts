export const VERSIONS = { schemaVersion: 1, reducerVersion: 2, rulesetVersion: 'base-1' } as const;
export type Stamp = { seconds: number; nanoseconds: number };
export type Envelope = {
  schemaVersion: number; reducerVersion: number; rulesetVersion: string;
  type: string; payload: Record<string, unknown>; actorUid: string;
  clientId: string; clientSeq: number;
};
export type ConfirmedEvent = Envelope & { id: string; createdAt: Stamp };
export type PendingEvent = { gameId: string; id: string; envelope: Envelope };
export type Member = { uid: string; name: string; seat: number; ready: boolean };
export type Room = { gameId: string; hostUid: string; hostName: string; phase: 'lobby' | 'started' | 'closed'; lastActionId: string; rosterRevision: string; members: Member[]; starterUid?: string; seed?: number };
export type Projection = { room: Room | null; blocked: boolean; diagnostics: string[]; acceptedIds: string[] };
const fields = ['schemaVersion', 'reducerVersion', 'rulesetVersion', 'type', 'payload', 'actorUid', 'clientId', 'clientSeq'];
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => jsonValue(item, depth + 1));
  if (plain(value)) return Object.values(value).every(item => jsonValue(item, depth + 1));
  return false;
}
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function validEnvelope(value: unknown): value is Envelope {
  if (!plain(value) || Object.keys(value).sort().join() !== [...fields].sort().join()) return false;
  return Number.isSafeInteger(value.schemaVersion) && Number(value.schemaVersion) > 0 &&
    Number.isSafeInteger(value.reducerVersion) && Number(value.reducerVersion) > 0 &&
    typeof value.rulesetVersion === 'string' && value.rulesetVersion.length > 0 && value.rulesetVersion.length <= 32 &&
    typeof value.type === 'string' && value.type.length > 0 && value.type.length <= 64 &&
    validId(value.actorUid) && validId(value.clientId) && Number.isSafeInteger(value.clientSeq) && Number(value.clientSeq) >= 0 &&
    plain(value.payload) && Object.keys(value.payload).length <= 16 && jsonValue(value.payload) && JSON.stringify(value.payload).length <= 2048;
}
export function supported(event: Envelope) {
  return event.schemaVersion === VERSIONS.schemaVersion && event.reducerVersion === VERSIONS.reducerVersion && event.rulesetVersion === VERSIONS.rulesetVersion;
}
export function validStamp(value: unknown): value is Stamp {
  return plain(value) && Number.isSafeInteger(value.seconds) && Number.isInteger(value.nanoseconds) && Number(value.nanoseconds) >= 0 && Number(value.nanoseconds) < 1_000_000_000;
}
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sameEnvelope = (a: Envelope, b: Envelope) => canonicalJSON(a) === canonicalJSON(b);
export function compareEvents(a: ConfirmedEvent, b: ConfirmedEvent) {
  return a.createdAt.seconds - b.createdAt.seconds || a.createdAt.nanoseconds - b.createdAt.nanoseconds || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export function replay(gameId: string, input: unknown[]): Projection {
  const result: Projection = { room: null, blocked: false, diagnostics: [], acceptedIds: [] };
  const unique = new Map<string, ConfirmedEvent>();
  const collisions = new Set<string>();
  for (const raw of input) {
    if (!plain(raw)) { result.diagnostics.push('Invalid event'); continue; }
    const { id, createdAt, ...envelope } = raw;
    if (!validId(id) || !validStamp(createdAt) || !validEnvelope(envelope)) { result.diagnostics.push('Invalid envelope'); continue; }
    const event = { ...envelope, id, createdAt };
    const previous = unique.get(id);
    if (previous && canonicalJSON(previous) !== canonicalJSON(event)) collisions.add(id);
    unique.set(id, event);
  }
  for (const event of [...unique.values()].sort(compareEvents)) {
    if (collisions.has(event.id)) { result.diagnostics.push(`Conflicting duplicate: ${event.id}`); continue; }
    if (!supported(event)) { result.blocked = true; result.diagnostics.push(`Unsupported version: ${event.id}`); continue; }
    if (result.blocked) continue;
    const room = apply(result.room, gameId, event);
    if (!room) { result.diagnostics.push(`Illegal action: ${event.id}`); continue; }
    result.room = room;
    result.acceptedIds.push(event.id);
  }
  result.diagnostics.sort();
  return result;
}

const keys = (payload: Record<string, unknown>, expected: string[]) => Object.keys(payload).sort().join() === expected.sort().join();
const nameValid = (name: unknown): name is string => typeof name === 'string' && name === name.trim() && name.length > 0 && name.length <= 40;
function apply(room: Room | null, gameId: string, event: ConfirmedEvent): Room | null {
  const p = event.payload;
  if (event.type === 'game/created') {
    if (room || event.id !== 'created' || !keys(p, ['gameId', 'hostName']) || p.gameId !== gameId || !nameValid(p.hostName)) return null;
    return { gameId, hostUid: event.actorUid, hostName: p.hostName, phase: 'lobby', lastActionId: event.id, rosterRevision: event.id, members: [{ uid: event.actorUid, name: p.hostName, seat: 1, ready: false }] };
  }
  if (!room || room.phase !== 'lobby' || event.id === 'created') return null;
  const member = room.members.find(m => m.uid === event.actorUid);
  const changed = { ...room, lastActionId: event.id };
  if (event.type === 'lobby/joined') {
    if (member || room.members.length >= 6 || !keys(p, ['name']) || !nameValid(p.name)) return null;
    const seat = [1, 2, 3, 4, 5, 6].find(n => !room.members.some(m => m.seat === n))!;
    return { ...changed, rosterRevision: event.id, members: [...room.members.map(m => ({ ...m, ready: false })), { uid: event.actorUid, name: p.name, seat, ready: false }].sort((a, b) => a.seat - b.seat) };
  }
  if (event.type === 'lobby/left') {
    if (!member || !keys(p, [])) return null;
    return { ...changed, phase: event.actorUid === room.hostUid ? 'closed' : 'lobby', rosterRevision: event.id, members: room.members.filter(m => m.uid !== event.actorUid).map(m => ({ ...m, ready: false })) };
  }
  if (event.type === 'lobby/ready') {
    if (!member || !keys(p, ['ready', 'rosterRevision']) || typeof p.ready !== 'boolean' || p.rosterRevision !== room.rosterRevision || p.ready === member.ready) return null;
    return { ...changed, members: room.members.map(m => m.uid === event.actorUid ? { ...m, ready: p.ready as boolean } : m) };
  }
  if (event.type === 'game/started') {
    if (event.actorUid !== room.hostUid || !keys(p, ['seed', 'starterUid', 'expectedActionId']) || p.expectedActionId !== room.lastActionId || room.members.length < 2 || !room.members.every(m => m.ready) || !room.members.some(m => m.uid === p.starterUid) || !Number.isInteger(p.seed) || Number(p.seed) < 0 || Number(p.seed) > 0xffffffff) return null;
    return { ...changed, phase: 'started', starterUid: p.starterUid as string, seed: p.seed as number };
  }
  return null;
}
