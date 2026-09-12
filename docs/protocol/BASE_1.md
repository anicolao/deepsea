# Base-1 rules and event protocol

## Accepted rules baseline

The project accepts the proposed resolutions in RULES_SUMMARY under `rulesetVersion: "base-1"`. This is the user's explicit project decision, not a new claim of publisher verification.

- Permit turning home without cargo after leaving the submarine; the first movement is outward.
- With an occupied deep end, outward overshoot stops at the deepest reachable available space. If no outward destination exists, stay in place and resolve the current space normally.
- Process stranded divers deepest first. Existing stacks remain indivisible when lost again; group up to three carried units, even if a new stack contains more than three original tiles.
- The deepest stranded diver starts the next dive. If all returned, the last successful returner starts.
- Count individual banked level-4 tiles to break a points tie; an equal count remains a shared victory.
- With no treasure left on the path, remaining dives add zero points and the game resolves its final score.

[rules-fixtures.json](rules-fixtures.json) records concrete expected outcomes for movement, oxygen exhaustion, repeated stack loss, starter selection, empty paths, and ties. These accepted specifications are exercised by the engine, resolution, completion and race suites under tests/unit.

## Versions and validation

The initial envelope uses integer `schemaVersion: 1`, integer `reducerVersion: 6`, and `rulesetVersion: "base-1"`. Missing/invalid envelopes are diagnosed and ignored. A structurally valid incompatible version blocks further interaction; it is never interpreted as the current version. Reducer 6 includes atomic turns, resolved dives, complete three-dive games and structured public move history; earlier reducer versions require their retained compatible app. Never reinterpret an older room with a newer reducer.

Canonical event fields are `schemaVersion`, `reducerVersion`, `rulesetVersion`, `type`, `payload`, `actorUid`, `clientId`, `clientSeq`, and server-assigned `createdAt`. IDs and timestamps are added by the repository adapter to replay input. Unknown envelope fields are rejected. Payloads are bounded JSON maps; the creation payload contains only the room ID and a trimmed, nonempty host name of at most 40 characters.

Firestore requires authentication and own-UID attribution and permits bounded supported action envelopes at `environments/{namespace}/games/{gameId}/events/{eventId}`. It denies updates, deletes, unauthenticated reads, and unrelated paths. Authenticated room reads are not membership restricted. The pure reducer validates the room ID, fixed creation ID, host name, supported action and versions before accepting the host projection. This is trusted-group consistency, not adversarial game validation or confidential storage.

## Ordering and retry identity

Replay confirmed events ordered by full timestamp seconds, then nanoseconds, then bytewise ASCII document ID. Never round to milliseconds or use locale comparison. A snapshot with pending writes or no server timestamp cannot confirm an event. Rebuild from the entire confirmed snapshot; arrival order cannot change the projection. Identical duplicate IDs collapse to one event; conflicting duplicate input is diagnosed and excluded rather than depending on input order.

New room IDs are cryptographically random five-letter uppercase codes drawn uniformly from `ABCDEFGHJKLMNPQRSTUVWXYZ`; existing room IDs and links remain valid. The creation document ID is always `created`. Atomic create rejects an occupied code; only a confirmed different creation permits discarding that rejected pending creation and trying another code, up to five attempts. An uncertain acknowledgement retains the original code and envelope for exact retry. Action IDs use the per-tab client ID and monotonic sequence. A page load allocates a fresh cryptographic client ID; previously saved pending actions retain their exact original ID, sequence, actor, versions, and payload across reloads. Counters and pending records are namespaced by Firebase project, deployment namespace, and authenticated UID. This avoids cloned-tab sequence collisions without rewriting an earlier pending action.

Persist a pending action before contacting Firestore. Submit an atomic create with an absent-document precondition: create when absent, acknowledge an exactly matching existing envelope after a recovery read, or report a collision. Never update an existing document or refresh its timestamp. After an uncertain acknowledgement, use the saved action; a confirmed matching snapshot also clears that pending record. Different identities or projects cannot pick up another session's pending action. Cached projections are not canonical.

Acknowledgement recovery reads the original immutable event; it never repeats the player decision under a new ID. This protocol recovery is separate from the E2E prohibition on retrying failed tests.

## Randomness and identities

`xorshift32-fnv1a-v1` is the frozen deterministic algorithm, implemented in `src/lib/game/random.ts`. Its seed is an unsigned 32-bit integer. Hash each ASCII stream label with FNV-1a (initial 2166136261, multiplier 16777619, unsigned 32-bit wrap). XOR that hash with the seed; replace zero with `0x6d2b79f5`. Each draw performs xorshift steps left 13, unsigned right 17, left 5 and returns unsigned 32 bits.

Use rejection sampling before modulo when choosing from a bounded range. Shuffle each eight-value level using descending Fisher–Yates with `shuffle:1` through `shuffle:4`. Draw the two dice from a fresh `dice:{dive}:{turn}` stream, sampling six faces and mapping adjacent pairs to 1, 2, 3. Dice addresses start at dive 1, turn 1. Rejected moves do not advance any stream. A separate `tile-identities` stream supplies pairs of zero-padded eight-digit hex words for opaque tile IDs; retry an ID draw on collision. Those IDs do not encode levels or values. Path addresses use the dive number and position independently of treasure identities. Blanks retain their position during a dive; cleanup compacts the path for the next dive.

Reference seed **2026** gives the first `dice:1:1` words **73294744, 3448632910, 465957484, 344733096**; dice at (1,1), (1,2), and (2,1) are **[3,3], [1,1], [2,3]**. The first tile is `t_9000546bcb225c8d`, level 1, value 3. Unit tests freeze the entire 32-value manifest as well as these vectors.

Seeds are not secrets in this architecture. The start action generates game-start seeds with browser cryptographic randomness; deterministic seed fixtures belong at the initialization boundary in tests. Numeric values, seeds, and identity/value mappings must not appear in player-facing labels or ordinary history.

## Lobby actions (reducer 2)

| Type | Payload | Acceptance |
| --- | --- | --- |
| game/created | gameId, hostName | Fixed created ID, trimmed 1–40 character host name, no prior room; host takes seat 1. |
| lobby/joined | name | Open lobby, nonmember, fewer than six seats; allocate lowest free seat. |
| lobby/left | empty map | Seated player in lobby; host departure closes it permanently. |
| lobby/ready | ready, rosterRevision | Seated player, boolean change, matching roster revision. |
| game/started | seed, starterUid, expectedActionId | Host, 2–6 ready members, seated starter, unsigned 32-bit seed, matching last accepted action. |

Joining and leaving clear every readiness flag and advance rosterRevision to the accepted event ID. Separate players can ready concurrently against the same roster revision. A stale readiness or start is rejected without partial state changes. Start freezes the seated roster in seat order and records the selected first diver; later lobby actions are rejected. A confirmed but rejected submission produces an actionable conflict message.

Namespaces are local, pr followed by its numeric PR number, or production. Isolated browser tests append `-e2e-` and a validated per-scenario UUID beneath local or preview namespaces. Each retained preview selects its own namespace and the dedicated preview project. These boundaries prevent accidental cross-environment writes; this trusted-group design does not make namespaces an authorization boundary.

## Turn actions (reducer 3)

`turn/rolled {direction, expectedActionId}` validates the active player, roll phase, first departure and locked returning direction. It commits cargo oxygen cost, addressed dice and occupied-space-skipping movement together. `turn/landed {choice, expectedActionId, unitId?}` accepts pickup, pass, or a whole-unit drop. Only drop includes unitId. Both require the latest accepted action ID, so concurrent submissions cannot charge twice. Tile conservation is checked after every accepted transition.

E2E supplies seed 2026 and an isolated test-run UUID through the configuration-loading boundary for local and preview games only. In these isolated runs, the seed also initializes room-code entropy; atomic creation and normal collision handling still apply. The shared fixture does not create rooms or write events. Ordinary deployed games use browser cryptographic randomness; production rejects a configured fixed seed or test-run override.

## Dive resolution (reducer 4)

Only a completed turn can end a dive, even after oxygen reaches zero. Returning divers sit out; divers awaiting their first departure are still eligible. Successful cargo remains concealed until dive resolution, then moves into the bank and its score breakdown is revealed. Prior banked tiles remain untouched.

Stranded divers are ordered deepest first, with frozen seat order as a deterministic fallback. `dive/ordered {order, expectedActionId}` accepts an exact permutation of the current cleanup owner's unit IDs. Up to three whole units form each new deep-end stack; no existing stack is split. Empty and single-unit choices resolve automatically. Once all owners finish, blanks are removed and review becomes available. Conservation includes all path, carried, and banked tiles after every transition.

Browser connections use the SDK’s streaming transport with automatic proxy detection. Native offline/online events disable and resume its network connection. Each tab retains its last confirmed view in memory while disconnected; identity and exact pending submissions are persisted. Reload uses the full confirmed server stream before enabling moves.

## Continuation and results (reducer 5)

`dive/continued {expectedActionId}` accepts any seated actor exactly once from a completed review. It resets oxygen, positions, directions and turn address, retains banked tiles and the compacted path without reshuffling, and uses the derived next starter. After the third cleanup the game finishes automatically. An empty path finishes early with zero gains recorded for remaining dives.

Final results sum individual banked tile values. Points ties compare the number of individual banked level-IV tiles, then share victory. Play again creates a separate immutable room with the player's existing name and identity; it never resets or deletes the old game.

## Public history (reducer 6)

The replay projection retains public move entries with actor UID, dive, turn and player-facing text. Entries describe confirmed dice, carried-unit deductions, direction, movement, landing choices and lost-unit ordering. Normal history never renders seeds, event envelopes or concealed tile values. Completed dive reviews retain each diver's safely returned tiles, gains and total; those revealed values remain inspectable after later dives and at the final result. Continuation preserves earlier entries and reviews. This projection contract uses reducer 6 with unchanged schema 1 and base-1 rules; incompatible clients block moves rather than silently replaying a different contract.

## Atomic event creation and acknowledgement recovery

Auth and subscriptions use the Firebase SDK. An append uses Firestore’s REST commit with `currentDocument.exists: false` and a server `REQUEST_TIME` transform for `createdAt`. This creates a new immutable event in one round trip, without a preliminary read. Firebase ID tokens enforce the same Firestore rules. A lost reply or existing-ID conflict triggers a read of exactly that event, comparing every immutable envelope field; it never rewrites the timestamp or allocates another ID. An unresolved read remains pending. See [Firestore REST authentication](https://firebase.google.com/docs/firestore/use-rest-api) and [atomic writes](https://firebase.google.com/docs/firestore/reference/rest/v1/Write).

Pending notification reaches repository observers before the network operation. A successful write reply alone does not enable a second move: the confirmed projection must first reconcile the submitted ID. Tests cover a reply arriving before the subscription, lost replies, competing turns/continuations, exact-ID conflicts, and 200 complete games across two through six players with conservation checked at every action.
