import type { ConfirmedEvent } from "../game/protocol";

type Change = {
  type: "added" | "modified" | "removed";
  doc: {
    id: string;
    metadata: { hasPendingWrites: boolean };
    data(): Record<string, unknown>;
  };
};

/** One decoder per subscription; unchanged history never needs decoding again. */
export function createConfirmedEvents() {
  const events = new Map<string, ConfirmedEvent>();
  return (changes: readonly Change[]): ConfirmedEvent[] => {
    for (const { type, doc } of changes) {
      if (type === "removed" || doc.metadata.hasPendingWrites) {
        events.delete(doc.id);
        continue;
      }
      const data = doc.data();
      if (data.createdAt == null) {
        events.delete(doc.id);
        continue;
      }
      const timestamp = data.createdAt as {
        seconds: unknown;
        nanoseconds: unknown;
      };
      events.set(doc.id, {
        ...data,
        id: doc.id,
        createdAt: {
          seconds: timestamp.seconds,
          nanoseconds: timestamp.nanoseconds,
        },
      } as ConfirmedEvent);
    }
    // The protocol projector owns canonical ordering and envelope validation.
    return [...events.values()];
  };
}
