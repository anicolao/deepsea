import { it, expect } from 'vitest';
import { RoomRepository, eventId, type EventTransport, type RoomState, type Store } from '../../src/lib/backend/repository';
import { type PendingEvent, type ConfirmedEvent } from '../../src/lib/game/protocol';
function memory(): Store {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
function fixture() {
  const storage = memory();
  const events = new Map<string, ConfirmedEvent>();
  let loseAck = false;
  let notify: (events: ConfirmedEvent[], synchronized: boolean) => void = () => {};
  let creates = 0;
  const transport: EventTransport = {
    watch(_game, next) { notify = next; return () => {}; },
    async create(pending) {
      const existing = events.get(pending.id);
      if (existing && existing.actorUid !== pending.envelope.actorUid) throw new Error('collision');
      if (!existing) { creates++; events.set(pending.id, { ...pending.envelope, id: pending.id, createdAt: { seconds: 1, nanoseconds: 500 } }); }
      if (loseAck) { loseAck = false; throw new Error('Acknowledgement lost'); }
    }
  };
  const repository = new RoomRepository(transport, storage, 'mira', 'tab1', 'demo-test');
  return { repository, storage, transport, events, loseAck: () => { loseAck = true; }, publish: (synced = true) => notify([...events.values()], synced), creates: () => creates };
}
it('persists the exact action before sending, surviving a reload and lost acknowledgement', async () => {
  const f = fixture();
  const pending = f.repository.prepareCreation('room', 'Mira');
  expect(f.repository.pending('room')).toEqual(pending);
  f.loseAck();
  await expect(f.repository.submit(pending)).rejects.toThrow('Acknowledgement lost');
  const afterReload = new RoomRepository(f.transport, f.storage, 'mira', 'tab2', 'demo-test');
  const retry = afterReload.pending('room')!;
  expect(retry).toEqual(pending);
  await afterReload.submit(retry);
  expect(f.creates()).toBe(1);
  expect(afterReload.pending('room')).toBeNull();
});
it('reconciles a confirmed matching action before enabling another submission', async () => {
  const f = fixture(); let state: RoomState | undefined;
  const pending = f.repository.prepareCreation('room', 'Mira');
  f.repository.watch('room', value => { state = value; });
  f.loseAck(); await expect(f.repository.submit(pending)).rejects.toThrow();
  f.publish();
  expect(state?.pending).toBe(false); expect(state?.room?.hostUid).toBe('mira');
  f.publish(false); expect(state?.synchronized).toBe(false); expect(state?.room?.hostName).toBe('Mira');
});
it('does not overwrite a conflicting creation or clear its saved pending action', async () => {
  const f = fixture();
  const other = new RoomRepository(f.transport, memory(), 'sol', 'tab3', 'demo-test');
  await other.submit(other.prepareCreation('room', 'Sol'));
  const pending = f.repository.prepareCreation('room', 'Mira');
  await expect(f.repository.submit(pending)).rejects.toThrow('collision');
  expect(f.repository.pending('room')).toEqual(pending);
  let state: RoomState | undefined;
  f.repository.watch('room', value => { state = value; }); f.publish();
  expect(state?.error).toContain('collision');
});
it('isolates identities and projects; allocates distinct per-tab event IDs', () => {
  const f = fixture();
  f.repository.prepareCreation('room', 'Mira');
  expect(new RoomRepository(f.transport, f.storage, 'sol', 'tab2', 'demo-test').pending('room')).toBeNull();
  expect(new RoomRepository(f.transport, f.storage, 'mira', 'tab2', 'demo-other').pending('room')).toBeNull();
  expect(eventId('tab1', 1)).not.toBe(eventId('tab2', 1));
  expect(f.repository.prepareCreation('other-room', 'Mira').envelope.clientSeq).toBe(2);
});
it('rejects changed pending payloads and mismatched submission actors', async () => {
  const f = fixture();
  const pending = f.repository.prepareCreation('room', 'Mira');
  expect(() => f.repository.prepareCreation('room', 'Sol')).toThrow();
  const forged = { ...pending, envelope: { ...pending.envelope, actorUid: 'sol' } } as PendingEvent;
  await expect(f.repository.submit(forged)).rejects.toThrow('Invalid pending');
  await expect(f.repository.submit({ ...pending, envelope: { ...pending.envelope, payload: { gameId: 'room', hostName: 'Other' } } })).rejects.toThrow('different creation');
});

it('blocks a corrupt or incompatible saved action without throwing from a snapshot callback', () => {
  const f = fixture(); let state: RoomState | undefined;
  f.repository.watch('room', value => { state = value; });
  for (const raw of ['{bad json', JSON.stringify({ id: 'created', gameId: 'room', envelope: {} })]) {
    f.storage.setItem('deepsea:demo-test:mira:pending:room', raw);
    expect(() => f.publish()).not.toThrow();
    expect(state?.blocked).toBe(true); expect(state?.pending).toBe(true);
  }
});
