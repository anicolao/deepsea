# Deep Sea — MVP Implementation Plan

## Starting point and destination

This plan starts from the implementation merged in PR #3. Steps 1–6 are implemented on the multiplayer branch, including a live Firebase preview backend. The required deployed browser check verifies each reviewed revision before merge. Steps 7–10 are being implemented in logical commits on the complete-MVP branch.

Already implemented: the coming-soon screen and game brief; pinned Nix/npm tooling and verification; retained Pages previews; accepted `base-1` decisions and deterministic randomness; local Auth/Firestore emulators; anonymous browser identities; immutable creation/retry/replay; and a complete create/invite/join/ready/start flow with phone/desktop multi-context tests. The shared board and atomic turns are implemented; dive resolution, lost-cargo ordering and scoring at dive review are implemented; three-dive completion remains in progress. Hosted room provisioning is a current delivery requirement, not deferred work.

Evidence for steps 1–4: [BASE_1.md](docs/protocol/BASE_1.md), the protocol/repository unit suites under `tests/unit/`, real SDK and rules checks under `tests/integration/`, and the [multiplayer browser walkthrough](tests/e2e/002-room-foundation/README.md). Rules edge-case fixtures are accepted expected outcomes for subsequent engine work, not executable proof of unimplemented gameplay.

The completed MVP lets 2–6 friends, each using their own browser, create and join a room, ready up, play three dives, recover from reloads and connection interruptions, understand the result, and create another game. It follows [MVP_DESIGN.md](MVP_DESIGN.md), [RULES_SUMMARY.md](RULES_SUMMARY.md), and [UX_DESIGN.md](UX_DESIGN.md). [E2E_GUIDE.md](E2E_GUIDE.md) governs verification throughout.

Keep the existing trusted-group architecture: client-side deterministic rules, immutable Firestore events, anonymous browser identities, and static hosting. Bots, public matchmaking, chat, spectators, ranked play, account recovery across devices, Boost rules, and server-enforced hidden information are outside this MVP.

## Delivery sequence

Every PR must expose its implemented behavior on a retained preview, include reproducible manual steps, and pass browser journeys on that deployed revision. Provision any required backend in the same PR. Each step has an observable exit condition. Implement steps in order unless their dependencies explicitly allow otherwise. A step is a reviewable delivery goal, not a requirement to fit all its work into one large PR. Once multiplayer infrastructure exists, ship UI, rules, persistence, and verification together for each behavior rather than building those layers in isolation.

| Step | Result | Depends on |
| --- | --- | --- |
| 1 (implemented) | Resolved rules and versioned protocol decisions | Existing documents |
| 2 (implemented) | Repeatable emulator and multiplayer test environment | Existing verification; protocol decisions from 1 |
| 3 (implemented) | Reliable immutable event repository | 2 |
| 4 (implemented; deployed verification required per PR) | Friends can create, join, ready, and start a room | 3 |
| 5 (implemented; deployed verification required per PR) | A complete turn is visible in every browser | 4; movement rules from 1 |
| 6 (implemented; deployed verification required per PR) | A complete dive resolves returns, losses, and cleanup | 5; cleanup rules from 1 |
| 7 | Three dives produce final results and a new-game flow | 6; starter/tie rules from 1 |
| 8 | Interrupted and competing clients recover consistently | 7, with recovery checks added from 3 onward |
| 9 | All required journeys work on phones, desktop, and keyboard | 7–8, with accessibility built into every UI step |
| 10 | The verified MVP works on its deployed URLs | 8–9; environment configuration prepared in 2 |

The user accepted all proposed open rule resolutions as reasonable project conventions for step 1. There are no remaining `base-1` decision blockers. Any later correction requires a documented version change, not a silent reinterpretation of existing games.

### 1. Resolve rules and freeze replay decisions

Adopt the user's accepted conventions in RULES_SUMMARY for occupied deep-end overshoot, already-stacked treasure lost again, an empty path between dives, next-dive starter selection, and the exact tiebreak. Record them as project decisions without claiming new publisher confirmation. This acceptance satisfies the original rules-decision gate.

Define the initial `rulesetVersion`, `schemaVersion`, and `reducerVersion`, event validation boundaries, PRNG/shuffle algorithm, and component identity scheme. Specify how incompatible versions block interaction. Keep opaque identities separate from treasure values. Record representative rules fixtures, including movement with cargo, the final oxygen-exhausting turn, stack conservation, and tied results.

**Done when:** each unresolved rule has either a supported decision or a named blocking entry tied to the affected later step; the protocol and randomness contracts have concrete version identifiers and reproducible examples. Full rules acceptance requires closing all blockers before declaring the MVP complete.

### 2. Add emulators and extend the testing infrastructure

Add the Firebase SDK, pinned CLI, rules-testing dependencies, and Vitest through npm; add the compatible emulator JDK and any other system tools through the Nix flake. Check compatibility when selecting versions. Keep the existing Node guard tests and add the engine/repository test suites to the normal verification pipeline.

Create local Auth/Firestore emulator configuration, isolated data per scenario, and one command that starts the required services, verifies observable readiness, runs the production-build tests, and shuts services down even on failure. Keep credentials and production Firebase data out of tests. Local verification uses emulators; deployed browser verification uses isolated preview data created only through real UI actions. Define explicit local, preview, and production configuration boundaries now; missing or inconsistent configuration must fail visibly rather than silently selecting production.

Extend the shared browser fixture to own multiple independent player contexts. Each context must receive the same network allowlist, browser/resource error checks, deterministic rendering settings, and lifecycle cleanup. Allow only the app and the configured environment’s Auth/Firestore endpoints. Provision reproducible identities and random input at the environment boundary, without injecting board state or adding a test-only route around real actions. Provide controlled connection and acknowledgement fault injection in this infrastructure for later recovery tests.

Extend TestSteps so one scenario can assert and capture named player views without filename collisions; require semantic checks and walkthrough completion for every documented view. Add explicit layout checks for the game's intentionally scrollable path and persistent action area while retaining the splash-specific checks.

The current guard deliberately rejects additional contexts, unapproved helpers, new origins, and changes to verification commands. Update its approved infrastructure paths, configuration contract, enforcement map, and negative tests in the same PR as these capabilities. Preserve no waits, no masking, all zero tolerances, no retries or skipped tests, the two-second interaction/assertion ceiling, and the existing scenario/startup budgets. If a proposed scenario cannot fit, redesign its coverage rather than increasing a timeout or skipping it.

**Done when:** a clean Nix environment runs the existing splash scenario plus an emulator-backed anonymous-session check in two isolated contexts; failures in either context fail verification; CI runs the same pipeline without production configuration or data. The connection harness exercises real SDK connections rather than mocked page markup.

### 3. Implement immutable persistence and deterministic replay

Introduce typed event envelopes, validators, the chronological reducer entry point, and an event repository independent of Svelte components. Start with room creation and a minimal lobby projection so persisted state is observable through the app; expand the reducer only as the next playable slices need it.

Implement the fixed creation-event ID, per-tab event IDs, persisted pending submissions, immutable retry comparison, full timestamp precision, and bytewise ID ordering from MVP_DESIGN. Separate local pending writes from confirmed canonical history. Rebuild projections when confirmed events arrive out of order; ignore invalid actions deterministically and surface diagnostics without partially changing state.

Add Firestore rules for authenticated attribution, bounded envelope validation, timestamps, and immutable writes. Test allowed creates and denied unauthenticated writes, impersonation, updates, deletes, and unrelated paths. Preserve the stated trust boundary: client reducers validate membership and game legality; invite URLs and UI-hidden values do not become access-control guarantees.

**Done when:** creating a room survives reload and yields the same confirmed projection in another client. Repository tests prove ordering, identical retries, conflicting ID reuse, invalid-event handling, and incompatible-version blocking. An uncertain acknowledgement never produces a second logical action.

### 4. Complete the room and readiness flow

Replace the coming-soon entry path with name entry, room creation, and invite acceptance. Retain the useful game brief as rules/help content and deliberately update the entry-screen scenario and reviewed baselines to match the new behavior.

Implement seat allocation, local-player/host labels, readiness, host-selected first diver, start eligibility, leave behavior, and host departure closing an unstarted room. Roster changes clear readiness. Start freezes the 2–6-seat turn order. Include full, missing, closed, and already-started room states; keep disabled controls accompanied by reasons.

Make invite generation, direct opening, copy confirmation, and clipboard fallback work at the root and nested deployment base paths. Reload must retain the anonymous identity and seat. Display pending operations without claiming an unconfirmed join or start succeeded.

**Done when:** two and three independent clients can create/join, change readiness, choose the starter, and start through the UI with the same frozen roster. E2E also proves guests cannot start, insufficient/unready rosters cannot start, and a late join is rejected. Reducer/repository tests cover six-seat capacity and competing lobby actions; the full browser race follows in step 8.

### 5. Deliver one complete multiplayer turn

Implement the 32-tile manifest, deterministic level shuffles and dice, initial dive state, player-view selectors, and legal direction/roll/landing phases. Assert tile conservation after every accepted transition. Production generates the initial seed cryptographically; the test environment supplies reproducible input through the same initialization boundary.

Render the board, oxygen, roster, cargo units, active player, and legal controls on phone and desktop. Show pre-charge and projected post-charge oxygen distinctly. Commit oxygen, direction, dice, and movement once in `turn/rolled`; never charge again because a view rerenders or a submission is retried. The first movement is outward, returning direction is locked, occupied spaces are skipped, and cargo reduces movement to a minimum of zero.

Implement pass, pickup, and whole-unit drop on legal landing spaces; returning to the submarine completes the turn without a redundant landing event. A pickup/drop/pass completes the turn on confirmation. Derive ordinary history and accessible labels from the player view, never raw events or hidden values.

**Done when:** the active player completes a direction choice, roll, and landing decision through the UI, while another browser observes the same oxygen, positions, cargo counts, and next player. Reload does not reroll or charge oxygen twice. Unit tests cover legal/illegal actions and movement boundaries; selector tests and browser assertions prove unrevealed values and seeds are absent from rendered content and accessible labels.

### 6. Finish a complete dive, including cleanup

Implement returned versus not-yet-dived versus underwater participation. Skip returned players without preventing players still awaiting their first departure from taking a turn. End the dive after everyone returns or after the oxygen-exhausting player's complete turn, including any landing choice.

Resolve successful returns and reveal their scoring treasure at dive review. Preserve earlier banked treasure. Queue stranded owners in the resolved cleanup order, accept exact permutations of their carried units, and rebuild stacks without splitting existing units. Resolve empty or choice-free cleanup automatically. Remove blank path spaces and prepare the retained path for the next dive.

Build the lost-treasure ordering UI with keyboard-operable earlier/later controls, concealed units, clear grouping preview, and pending/waiting states. Build dive review with returned/lost outcomes, separate dive and cumulative totals, and the derived next starter.

**Done when:** a two-player browser scenario completes a dive, including at least one safe return and one loss, and both players agree on review and cleanup. Focused scenarios cover all-returned termination and completion of a final oxygen-exhausting landing choice. Unit tests cover repeated stack loss, conservation across all zones, cleanup permutation rejection, and the resolved empty-path behavior.

### 7. Complete three dives and the replay-again flow

Implement continuation after cleanup, oxygen reset to 25, next starter, retained banked scores, and the compacted path without reshuffling the original board. Any seated player can request continuation; no permanently connected host is required after start. Competing continuation events advance only once.

After the third cleanup, derive completion automatically. Render the three-dive score breakdown, total points, resolved tiebreak, and shared winners when still tied. Preserve completed dive details and ordinary game history. Play again creates a fresh room/invite with the local name prefilled; it does not reset the old room or silently transfer the other players.

**Done when:** two independent browser contexts play a complete three-dive game from lobby to final result through real actions, then create and join a fresh room while the original result remains intact. Use a deliberately short legal seeded game that fits the normal scenario budget; cover longer gameplay and rare scoring branches in separate focused scenarios and reducer fixtures. Verify a tiebreak and a shared victory explicitly.

### 8. Prove recovery, conflicts, and six-player behavior

Complete recovery behavior already exercised in earlier steps: cache only disposable versioned projections, restore the anonymous seat, replay the full confirmed stream, and reconcile persisted pending event IDs before enabling another action. Show cached state as last known while disconnected and disable new submissions until synchronized. Explain stale moves, lost identities, and unsupported versions without exposing protocol details in player-facing history.

Add deterministic repository and browser fault scenarios for duplicate clicks, same-identity tabs, simultaneous turn submissions, lost acknowledgements, reload after rolling, disconnect during a landing choice, and reconnect during lost-cargo ordering. Use the controlled fixture to induce transport conditions; do not sleep, hide expected faults, or broadly suppress browser errors. If an induced fault necessarily produces a browser error, classify and assert that specific fault in the shared harness while continuing to fail unrelated errors.

Exercise six distinct players through a complete short game, plus two contenders for the final seat. A losing contender must not appear seated. Prove all clients converge after races and that stale actions make no partial changes. A missing active player retains their seat and turn; oxygen does not tick down with elapsed time. Explain the new-room option when a player cannot return.

**Done when:** all listed scenarios pass with one accepted action per expected state, stable dice, no duplicated oxygen/score effects, and matching player views. Unsupported versions block moves. The game can finish with the original host disconnected when that host has no outstanding required action; nobody substitutes for a missing player's turn or cleanup choice.

### 9. Close the UX and accessibility acceptance checklist

Audit the complete journeys in UX_DESIGN against the working application. Verify two- and six-player layouts at both canonical viewports, a readable full path, reachable persistent actions, Find my diver/Show submarine, distinguishable divers without color alone, and clear cargo-unit versus tile counts.

Exercise keyboard-only lobby, direction, landing, lost-unit ordering, help, review, and replay-again flows. Verify focus restoration, announced turn/connection/result changes, explanations beside disabled controls, touch target sizes, actual text contrast, and reduced-motion behavior. Add automated checks where the property is measurable and record the remaining human review rather than treating screenshots as accessibility certification.

Audit board, cargo, history, help, error states, and accessible text for hidden-value leaks. Review every changed screenshot and its hash-bound notes. Preserve original graphics and the project's attribution.

**Done when:** each UX acceptance scenario links to a passing test or a specific recorded manual check. There are no blocked controls, clipped critical information, unexplained dead ends, or unreviewed baselines in the required flows. Accessibility work accompanies earlier UI steps; this is the final completeness check.

### 10. Validate deployment and accept the MVP

Complete dedicated preview and production Firebase configuration with isolated projects or namespaces, anonymous Auth setup, deployed Firestore rules, and documented environment selection. Ensure retained preview builds continue to target preview data even after production moves forward. A wrong/missing configuration must not send preview traffic to production. Keep privileged deployment credentials out of browser bundles and fork workflows.

Use the existing exact-tested-build publication pipeline. Verify room invites, reloads, assets, and navigation from `/deepsea/` and `/deepsea/pr<N>/`, including opening an invitation on another device. Document initial setup, verification, deployment, version compatibility, and rollback behavior. Old rooms must either remain readable under supported versions or clearly block incompatible clients; never silently reinterpret their events.

Run automated verification only against emulators. Separately perform a named live smoke check in an isolated preview environment with fresh test rooms on actual separate devices, then verify production configuration and entry/invite loading without using production games as automated test fixtures. Record the tested commit, environment, date, and result. Retain a known working deployment for rollback.

**Done when:** the acceptance checklist below is complete, CI is green for the release commit, its tested static artifact is deployed, the preview smoke check succeeds, and operating instructions allow another contributor to reproduce setup and verification.

## MVP acceptance checklist

- [x] All rulebook blockers are closed by accepted project conventions, explicitly documented and versioned.
- [ ] Two through six players can join, ready, and play three dives from separate browsers.
- [ ] Rules fixtures cover movement, oxygen, treasure conservation, stacks, cleanup, starter selection, scoring, and ties.
- [ ] Event ordering, attribution, immutable retries, stale conflicts, and version handling pass repository and emulator-rules tests.
- [ ] Complete two- and six-player E2E games pass; other clients' confirmed results are asserted, not merely the actor's screen.
- [ ] Reload, offline state, lost acknowledgements, multiple tabs, and cleanup recovery preserve seats and accepted decisions.
- [ ] Players can understand turns, losses, scores, shared wins, and how to start again using phone, desktop, touch, and keyboard.
- [ ] Normal UI, accessible labels, and history conceal unrevealed information within the documented trusted-client model.
- [ ] Every E2E rule retains pre-commit enforcement and negative regression coverage; walkthroughs and baseline review records match.
- [ ] Live preview/production boundaries, nested invites, deployment, compatibility, and rollback instructions are verified and recorded.

## Working rules for each delivery

Record the initiating prompt before work and make logical step commits, recording continuations in PROMPT_WORK.md as required by AGENTS. Each implementation PR states its user-visible result, dependencies, verification, and any unresolved blocker. Update this plan's status only with evidence; do not infer completion from a mockup or an isolated unit test.

Run the full `nix develop -c npm run verify` pipeline through the normal pre-commit hook and CI. Extend it with new engine, emulator, and repository suites rather than replacing existing checks. When infrastructure changes require new allowed test capabilities, update the guard, configuration contract, enforcement map, and negative tests together while preserving the testing rules. Stage the exact verified files, generated walkthroughs, reviewed screenshots, and prompt log.

Keep VISION focused exclusively on the end state. Scope and architecture changes belong in MVP_DESIGN, interaction changes in UX_DESIGN, rules decisions in RULES_SUMMARY, and sequencing or completion evidence here. Update outdated status text as slices land so proposals are not mistaken for working features.
