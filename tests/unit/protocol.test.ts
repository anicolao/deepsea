import { describe, it, expect } from 'vitest';
import { replay, compareEvents, sameEnvelope, validEnvelope, VERSIONS, type ConfirmedEvent } from '../../src/lib/game/protocol';
import { dice, manifest, stream } from '../../src/lib/game/random';
const event = (overrides = {}): ConfirmedEvent => ({ ...VERSIONS, type: 'game/created', payload: { gameId: 'room', hostName: 'Mira' }, actorUid: 'mira', clientId: 'tab-a', clientSeq: 1, id: 'created', createdAt: { seconds: 100, nanoseconds: 4 }, ...overrides });
describe('chronological room projection', () => {
  it('creates one host and ignores illegal later events without partial changes', () => {
    const accepted = replay('room', [event()]);
    expect(accepted.room).toEqual({ gameId: 'room', hostName: 'Mira', hostUid: 'mira', phase: 'lobby', lastActionId: 'created', rosterRevision: 'created', members: [{ uid: 'mira', name: 'Mira', seat: 1, ready: false }] });
    expect(replay('room', [event({ id: 'other', actorUid: 'other' }), event()]).room).toEqual(accepted.room);
  });
  it('preserves nanoseconds and uses bytewise IDs at equal timestamps', () => {
    const a = event({ id: 'Z', createdAt: { seconds: 1, nanoseconds: 2 } });
    const b = event({ id: 'a', createdAt: { seconds: 1, nanoseconds: 2 } });
    const c = event({ id: 'A', createdAt: { seconds: 1, nanoseconds: 3 } });
    expect([c, b, a].sort(compareEvents).map(e => e.id)).toEqual(['Z', 'a', 'A']);
  });
  it('rebuilds identically from late and differently delivered events', () => {
    const events = [event(), event({ id: 'late', type: 'invalid', createdAt: { seconds: 102, nanoseconds: 0 } })];
    expect(replay('room', events)).toEqual(replay('room', [...events].reverse()));
  });
  it('deduplicates exact IDs but rejects conflicting duplicate contents in either order', () => {
    expect(replay('room', [event(), event()]).acceptedIds).toEqual(['created']);
    const conflict = event({ actorUid: 'sol' });
    expect(replay('room', [event(), conflict])).toEqual(replay('room', [conflict, event()]));
    expect(replay('room', [event(), conflict]).room).toBeNull();
  });
  it('ignores malformed envelopes, wrong rooms and unconfirmed timestamps', () => {
    for (const raw of [null, {}, event({ createdAt: null }), event({ clientSeq: -1 }), event({ actorUid: '' }), event({ payload: { gameId: 'other', hostName: 'Mira' } }), event({ injected: true })]) {
      expect(replay('room', [raw]).room).toBeNull();
      expect(replay('room', [raw]).diagnostics.length).toBeGreaterThan(0);
    }
  });
  it('blocks incompatible versions without treating them as supported actions', () => {
    for (const changed of [{ schemaVersion: 2 }, { reducerVersion: 3 }, { rulesetVersion: 'base-2' }]) expect(replay('room', [event(changed)]).blocked).toBe(true);
  });
  it('compares every immutable field independent of map insertion order', () => {
    const { id: _id, createdAt: _at, ...envelope } = event();
    expect(validEnvelope(envelope)).toBe(true);
    expect(sameEnvelope(envelope, { ...envelope, payload: { hostName: 'Mira', gameId: 'room' } })).toBe(true);
    expect(sameEnvelope(envelope, { ...envelope, clientSeq: 2 })).toBe(false);
  });
});
describe('versioned randomness', () => {
  it('matches the frozen base-1 reference vectors', () => {
    const next = stream(2026, 'dice:1:1');
    expect([next(), next(), next(), next()]).toEqual([73294744, 3448632910, 465957484, 344733096]);
    expect([dice(2026, 1, 1), dice(2026, 1, 2), dice(2026, 2, 1)]).toEqual([[3, 3], [1, 1], [2, 3]]);
    expect(manifest(2026).map(tile => tile.value)).toEqual([3, 3, 2, 1, 1, 0, 0, 2, 7, 4, 4, 7, 6, 6, 5, 5, 8, 9, 8, 11, 11, 10, 9, 10, 12, 14, 13, 15, 15, 13, 14, 12]);
    expect(manifest(2026)[0].id).toBe('t_9000546bcb225c8d');
  });
  it('produces the complete manifest with opaque unique identities and exact value multiplicities', () => {
    const tiles = manifest(2026);
    expect(tiles).toHaveLength(32);
    expect(new Set(tiles.map(t => t.id)).size).toBe(32);
    for (let value = 0; value < 16; value++) expect(tiles.filter(t => t.value === value)).toHaveLength(2);
    expect(tiles.map(t => t.level)).toEqual(Array.from({ length: 32 }, (_, i) => Math.floor(i / 8) + 1));
    expect(manifest(2026)).toEqual(tiles);
  });
  it('addresses dice independently of shuffle calls and rejected actions', () => {
    const first = dice(2026, 1, 1);
    manifest(2026); dice(2026, 3, 50);
    expect(dice(2026, 1, 1)).toEqual(first);
    for (let turn = 1; turn < 100; turn++) for (const die of dice(2026, 1, turn)) expect([1, 2, 3]).toContain(die);
    expect(() => stream(-1, 'dice')).toThrow();
    expect(() => dice(2026, 0, 1)).toThrow();
  });
});
