import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, collection, doc, onSnapshot, runTransaction, serverTimestamp, terminate } from 'firebase/firestore';
import { sameEnvelope, type ConfirmedEvent, type PendingEvent } from '../game/protocol';
import type { BackendConfig } from './config';
import type { EventTransport } from './repository';

export async function connectBackend(config: BackendConfig, instanceName = `${config.projectId}-${config.namespace ?? 'local'}`) {
  const app = initializeApp({ projectId: config.projectId, apiKey: config.apiKey, appId: config.appId, authDomain: config.authDomain }, instanceName);
  const auth = initializeAuth(app, { persistence: browserLocalPersistence });
  const db = initializeFirestore(app, {});
  if (config.mode === 'local') {
    connectAuthEmulator(auth, `http://${config.authHost}`, { disableWarnings: true });
    const [host, port] = config.firestoreHost!.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }
  await auth.authStateReady();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const transport: EventTransport = {
    watch(gameId, next, error) {
      return onSnapshot(collection(db, 'environments', config.namespace ?? 'local', 'games', gameId, 'events'), { includeMetadataChanges: true }, snapshot => {
        const events = snapshot.docs.filter(entry => !entry.metadata.hasPendingWrites && entry.data().createdAt != null)
          .map(entry => ({ ...entry.data(), id: entry.id, createdAt: { seconds: entry.data().createdAt.seconds, nanoseconds: entry.data().createdAt.nanoseconds } }) as ConfirmedEvent);
        next(events, !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites);
      }, error);
    },
    async create(pending: PendingEvent) {
      const reference = doc(db, 'environments', config.namespace ?? 'local', 'games', pending.gameId, 'events', pending.id);
      await runTransaction(db, async transaction => {
        const existing = await transaction.get(reference);
        if (existing.exists()) {
          const { createdAt: _time, ...envelope } = existing.data();
          if (!sameEnvelope(envelope as PendingEvent['envelope'], pending.envelope)) throw new Error('Room ID collision: another creation already exists.');
          return;
        }
        transaction.set(reference, { ...pending.envelope, createdAt: serverTimestamp() });
      });
    }
  };
  return { uid: user.uid, isAnonymous: user.isAnonymous, transport, close: async () => { await terminate(db); await deleteApp(app); } };
}
