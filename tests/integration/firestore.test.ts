import { beforeAll, afterAll, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { VERSIONS } from '../../src/lib/game/protocol';
import { connectBackend } from '../../src/lib/backend/firebase';
import { RoomRepository, type Store } from '../../src/lib/backend/repository';
import { loseNextAcknowledgement } from '../support/fault-transport';
let environment: RulesTestEnvironment;
const local = { mode: 'local', projectId: 'demo-deepsea-rules', apiKey: 'emulator-key', authHost: '127.0.0.1:9099', firestoreHost: '127.0.0.1:8080' } as const;
const closers: (() => Promise<void>)[] = [];
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Emulator integration tests must never use live Firestore');
  environment = await initializeTestEnvironment({ projectId: 'demo-deepsea-rules', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { for (const close of closers) await close(); await environment.cleanup(); });
const payload = (gameId: string) => ({ ...VERSIONS, type: 'game/created', actorUid: 'mira', clientId: 'tab1', clientSeq: 1, payload: { gameId, hostName: 'Mira' }, createdAt: serverTimestamp() });
it('allows a bounded self-attributed creation, read, and no mutation', async () => {
  const db = environment.authenticatedContext('mira').firestore();
  const reference = doc(db, 'games/valid/events/created');
  await assertSucceeds(setDoc(reference, payload('valid')));
  await assertSucceeds(getDoc(reference));
  await assertFails(updateDoc(reference, { 'payload.hostName': 'Changed' }));
  await assertFails(deleteDoc(reference));
});
it('denies unauthenticated access, impersonation and unrelated paths', async () => {
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymous, 'games/valid/events/created')));
  await assertFails(setDoc(doc(anonymous, 'games/unauth/events/created'), payload('unauth')));
  const db = environment.authenticatedContext('sol').firestore();
  await assertFails(setDoc(doc(db, 'games/impersonated/events/created'), payload('impersonated')));
  await assertFails(setDoc(doc(db, 'unrelated/example'), payload('other')));
});
it('rejects missing or fabricated timestamps, oversized or malformed envelopes and wrong event IDs', async () => {
  const db = environment.authenticatedContext('mira').firestore();
  for (const [index, changes] of [
    { createdAt: Timestamp.fromMillis(1) }, { injected: true }, { clientSeq: -1 },
    { type: 'unknown' }, { schemaVersion: 1.5 }, { clientId: '../invalid' },
    { payload: { gameId: 'bad', hostName: 'a'.repeat(41) } }, { payload: { gameId: 'bad', hostName: 'Mira', extra: true } }
  ].entries()) await assertFails(setDoc(doc(db, `games/bad${index}/events/created`), { ...payload(`bad${index}`), ...changes }));
  const { createdAt: _at, ...missing } = payload('missing');
  await assertFails(setDoc(doc(db, 'games/missing/events/created'), missing));
  await assertFails(setDoc(doc(db, 'games/wrong/events/other'), payload('wrong')));
});
it('real anonymous SDK clients replay the same creation and immutable retries keep its timestamp', async () => {
  const a = await connectBackend(local, 'integration-a'); closers.push(a.close);
  const b = await connectBackend(local, 'integration-b'); closers.push(b.close);
  expect(a.uid).not.toBe(b.uid);
  expect(a.isAnonymous).toBe(true); expect(b.isAnonymous).toBe(true);
  const values = new Map<string, string>();
  const storage: Store = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  const repository = new RoomRepository(loseNextAcknowledgement(a.transport), storage, a.uid, 'tab-a', local.projectId);
  const pending = repository.prepareCreation('integration-room', 'Mira');
  let stop = () => {};
  const observed = new Promise<unknown>(resolve => {
    stop = b.transport.watch('integration-room', (events, synchronized) => { if (synchronized && events.length) resolve(events[0]); }, error => { throw error; });
  });
  await expect(repository.submit(pending)).rejects.toThrow('Injected acknowledgement loss');
  const afterReload = new RoomRepository(a.transport, storage, a.uid, 'tab-reloaded', local.projectId);
  expect(afterReload.pending('integration-room')).toEqual(pending);
  await afterReload.submit(afterReload.pending('integration-room')!);
  const original = await observed;
  stop();
  await a.transport.create(pending);
  const reread = await new Promise(resolve => {
    stop = b.transport.watch('integration-room', (events, synchronized) => { if (synchronized && events.length) resolve(events[0]); }, error => { throw error; });
  });
  stop(); expect(reread).toEqual(original);
  await expect(b.transport.create({ ...pending, envelope: { ...pending.envelope, actorUid: b.uid } })).rejects.toThrow('collision');
});
