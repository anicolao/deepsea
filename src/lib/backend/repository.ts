import { replay, sameEnvelope, supported, validEnvelope, validId, validStamp, VERSIONS, type ConfirmedEvent, type Envelope, type PendingEvent, type Projection } from '../game/protocol';
export interface EventTransport {
  watch(gameId: string, next: (events: ConfirmedEvent[], synchronized: boolean) => void, error: (error: Error) => void): () => void;
  create(pending: PendingEvent): Promise<void>;
}
export interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type RoomState = Projection & { synchronized: boolean; pending: boolean; error: string | null };
export class RoomRepository {
  private submitted = new Map<string, PendingEvent>();
  private clientId: string;
  private sequence: number;
  private prefix: string;
  constructor(private transport: EventTransport, private storage: Store, private actorUid: string, clientId: string, namespace: string) {
    if (!validId(actorUid) || !validId(clientId) || !validId(namespace)) throw new Error('Invalid repository identity');
    this.clientId = clientId;
    this.prefix = `deepsea:${namespace}:${actorUid}:`;
    this.sequence = Number(storage.getItem(`${this.prefix}sequence:${clientId}`) ?? 0);
    if (!Number.isSafeInteger(this.sequence) || this.sequence < 0) throw new Error('Invalid saved sequence');
  }
  prepareCreation(gameId: string, hostName: string): PendingEvent {
    if (!validId(gameId) || !hostName.trim() || hostName.trim().length > 40) throw new Error('Enter a name between 1 and 40 characters.');
    const existing = this.pending(gameId);
    if (existing) {
      if (existing.envelope.payload.hostName !== hostName.trim()) throw new Error('Resolve the saved room creation before changing its name.');
      return existing;
    }
    const clientSeq = ++this.sequence;
    if (!Number.isSafeInteger(clientSeq)) throw new Error('Client sequence exhausted');
    this.storage.setItem(`${this.prefix}sequence:${this.clientId}`, String(clientSeq));
    const pending: PendingEvent = { gameId, id: 'created', envelope: { ...VERSIONS, type: 'game/created', payload: { gameId, hostName: hostName.trim() }, actorUid: this.actorUid, clientId: this.clientId, clientSeq } };
    this.storage.setItem(`${this.prefix}pending:${gameId}`, JSON.stringify(pending));
    return pending;
  }
  prepareAction(gameId: string, type: string, payload: Record<string, unknown>): PendingEvent {
    if (!validId(gameId)) throw new Error('Invalid room');
    if (this.pending(gameId)) throw new Error('Confirm the pending action first.');
    const clientSeq = ++this.sequence;
    const id = eventId(this.clientId, clientSeq);
    this.storage.setItem(`${this.prefix}sequence:${this.clientId}`, String(clientSeq));
    const pending = { gameId, id, envelope: { ...VERSIONS, type, payload, actorUid: this.actorUid, clientId: this.clientId, clientSeq } };
    if (!validEnvelope(pending.envelope)) throw new Error('Invalid action');
    this.storage.setItem(`${this.prefix}pending:${gameId}`, JSON.stringify(pending));
    return pending;
  }
  pending(gameId: string): PendingEvent | null {
    const raw = this.storage.getItem(`${this.prefix}pending:${gameId}`);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingEvent;
    if (pending.gameId !== gameId || !validId(pending.id) || !validEnvelope(pending.envelope) || pending.envelope.actorUid !== this.actorUid || !supported(pending.envelope)) throw new Error('Saved room action is incompatible. Reload with a compatible app.');
    return pending;
  }
  async submit(pending: PendingEvent) {
    if (!validId(pending.gameId) || !validId(pending.id) || (pending.envelope.type === 'game/created' && pending.envelope.payload.gameId !== pending.gameId) || pending.envelope.actorUid !== this.actorUid || !supported(pending.envelope) || !validEnvelope(pending.envelope)) throw new Error('Invalid pending action');
    const saved = this.pending(pending.gameId);
    if (saved && !sameEnvelope(saved.envelope, pending.envelope)) throw new Error('A different creation is already pending for this room.');
    this.storage.setItem(`${this.prefix}pending:${pending.gameId}`, JSON.stringify(pending));
    this.submitted.set(pending.gameId, pending);
    await this.transport.create(pending);
    const current = this.pending(pending.gameId);
    if (current && sameEnvelope(current.envelope, pending.envelope)) this.storage.removeItem(`${this.prefix}pending:${pending.gameId}`);
  }
  watch(gameId: string, next: (state: RoomState) => void) {
    let last = replay(gameId, []);
    return this.transport.watch(gameId, (events, synchronized) => {
      const projection = replay(gameId, events);
      last = projection;
      let pending: PendingEvent | null;
      try { pending = this.pending(gameId) ?? this.submitted.get(gameId) ?? null; }
      catch {
        next({ ...projection, blocked: true, synchronized, pending: true, error: 'Saved room action is incompatible. Reload with a compatible app.' });
        return;
      }
      let error: string | null = null;
      const confirmed = events.find(event => event.id === pending?.id);
      if (pending && confirmed && validStamp(confirmed.createdAt)) {
        const { id: _id, createdAt: _time, ...envelope } = confirmed;
        if (sameEnvelope(envelope, pending.envelope)) {
          if (!projection.acceptedIds.includes(confirmed.id) && !projection.blocked) error = 'The room changed before your action was accepted. Check the room and try again.';
          this.storage.removeItem(`${this.prefix}pending:${gameId}`); this.submitted.delete(gameId); pending = null;
        } else error = 'Room ID collision: the saved action differs from the confirmed room.';
      }
      next({ ...projection, synchronized, pending: !!pending, error });
    }, error => next({ ...last, synchronized: false, pending: this.storage.getItem(`${this.prefix}pending:${gameId}`) !== null, error: error.message }));
  }
}
export const eventId = (clientId: string, sequence: number) => {
  if (!validId(clientId) || !Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Invalid event identity');
  return `${clientId}_${sequence}`;
};
