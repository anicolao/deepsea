export const VERSIONS = { schemaVersion: 1, reducerVersion: 1, rulesetVersion: 'base-1' } as const;
export type Stamp = { seconds: number; nanoseconds: number };
export type Envelope = {
  schemaVersion: number; reducerVersion: number; rulesetVersion: string;
  type: string; payload: Record<string, unknown>; actorUid: string;
  clientId: string; clientSeq: number;
};
export type ConfirmedEvent = Envelope & { id: string; createdAt: Stamp };
export type PendingEvent = { gameId: string; id: string; envelope: Envelope };
export type Room = { gameId: string; hostUid: string; hostName: string; phase: 'lobby'; lastActionId: string };
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
    if (event.type !== 'game/created' || event.id !== 'created' || result.room || event.payload.gameId !== gameId ||
      Object.keys(event.payload).sort().join() !== 'gameId,hostName' || typeof event.payload.hostName !== 'string' ||
      !event.payload.hostName.trim() || event.payload.hostName !== event.payload.hostName.trim() || event.payload.hostName.length > 40) {
      result.diagnostics.push(`Illegal action: ${event.id}`); continue;
    }
    result.room = { gameId, hostUid: event.actorUid, hostName: event.payload.hostName, phase: 'lobby', lastActionId: event.id };
    result.acceptedIds.push(event.id);
  }
  result.diagnostics.sort();
  return result;
}
