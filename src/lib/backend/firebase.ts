import { initializeApp, deleteApp } from "firebase/app";
import {
  initializeAuth,
  browserLocalPersistence,
  connectAuthEmulator,
  signInAnonymously,
} from "firebase/auth";
import {
  initializeFirestore,
  disableNetwork,
  enableNetwork,
  connectFirestoreEmulator,
  collection,
  onSnapshot,
  terminate,
} from "firebase/firestore";
import { type ConfirmedEvent, type PendingEvent } from "../game/protocol";
import { appendEvent } from "./rest";
import type { BackendConfig } from "./config";
import type { EventTransport } from "./repository";

export async function connectBackend(
  config: BackendConfig,
  instanceName = `${config.projectId}-${config.namespace ?? "local"}`,
) {
  const app = initializeApp(
    {
      projectId: config.projectId,
      apiKey: config.apiKey,
      appId: config.appId,
      authDomain: config.authDomain,
    },
    instanceName,
  );
  const auth = initializeAuth(app, { persistence: browserLocalPersistence });
  // Keep the SDK’s streaming transport and automatic proxy detection.
  const db = initializeFirestore(app, {});
  if (config.mode === "local") {
    connectAuthEmulator(auth, `http://${config.authHost}`, {
      disableWarnings: true,
    });
    const [host, port] = config.firestoreHost!.split(":");
    connectFirestoreEmulator(db, host, Number(port));
  }
  const updateConnection = () => {
    void (navigator.onLine ? enableNetwork(db) : disableNetwork(db));
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    updateConnection();
  }
  await auth.authStateReady();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const transport: EventTransport = {
    watch(gameId, next, error) {
      return onSnapshot(
        collection(
          db,
          "environments",
          config.namespace ?? "local",
          "games",
          gameId,
          "events",
        ),
        { includeMetadataChanges: true },
        (snapshot) => {
          const events = snapshot.docs
            .filter(
              (entry) =>
                !entry.metadata.hasPendingWrites &&
                entry.data().createdAt != null,
            )
            .map(
              (entry) =>
                ({
                  ...entry.data(),
                  id: entry.id,
                  createdAt: {
                    seconds: entry.data().createdAt.seconds,
                    nanoseconds: entry.data().createdAt.nanoseconds,
                  },
                }) as ConfirmedEvent,
            );
          next(
            events,
            !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites,
          );
        },
        error,
      );
    },
    async create(pending: PendingEvent) {
      await appendEvent(config, await user.getIdToken(), pending);
    },
  };
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    transport,
    close: async () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", updateConnection);
        window.removeEventListener("offline", updateConnection);
      }
      await terminate(db);
      await deleteApp(app);
    },
  };
}
