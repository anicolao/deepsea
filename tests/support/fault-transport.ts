import type { EventTransport } from '../../src/lib/backend/repository';

// Lose delivery of one acknowledgement after the actual transport has committed.
// This never changes a game projection or mocks a page/database response.
export function loseNextAcknowledgement(transport: EventTransport): EventTransport {
  let armed = true;
  return {
    watch: transport.watch.bind(transport),
    async create(pending) {
      await transport.create(pending);
      if (armed) { armed = false; throw new Error('Injected acknowledgement loss'); }
    }
  };
}
