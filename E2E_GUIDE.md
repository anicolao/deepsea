# E2E Testing Guide

E2E tests prove a user-visible result through the real production-built application. Every documented step combines semantic assertions, layout checks, and a screenshot. The suite covers arrival, invitations, complete games, lost treasure, competing clients, and recovery. Every game starts through real player actions, using anonymous Auth and immutable Firestore events.

## Run the contract

```sh
nix develop
npm ci
npm run verify
```

`verify` runs Svelte/TypeScript checks, Node guard tests, Vitest unit tests, and the browser pipeline. `npm run test:e2e` checks source/configuration/review policy, ensures the pinned Firestore emulator artifact is downloaded, builds the static app, and starts fresh Auth/Firestore emulators. Emulator integration tests must pass before the preview server becomes ready for Playwright. It tests a nested base path (`/deepsea/pr-e2e/`) so broken preview asset paths are caught. It never reuses a development server or an existing emulator. Startup retains its 60-second budget; graceful shutdown has a separate five-second infrastructure deadline to release child services and ports on success or failure. Dependency downloads occur before the server-startup deadline.

The shared fixture owns additional browsers through `players.create()`. Each inherits canonical rendering, two-second action/navigation deadlines, network restrictions, and error checks. Each page needs its own named TestSteps view. Native anonymous UIDs and room IDs vary between isolated runs; scenarios assert identity relationships and use fixed display names without rendering opaque IDs. Rules randomness has fixed golden seed fixtures. Each browser scenario creates its own room and identities in the freshly started demo project; emulator-rules tests use a separate demo project.

Use `players.reload(page)` for a connected room. The fixture records exact open Firestore requests before navigation and requests issued by the old document before the main frame commits. Only those request objects with Chromium’s `net::ERR_ABORTED` cancellation qualify, even if the notification arrives after reload resolves. New streams, other pages, other endpoints, and different failure codes still fail. Negative tests cover each boundary. A canceled streaming subscription during deliberate navigation is not a failed page resource; screenshots and semantic assertions must still prove recovery. `players.setConnected(page, connected)` controls native context connectivity. Only registered Firestore requests cancelled by that explicit interruption receive the narrow fault classification below. Repository integration tests inject a lost acknowledgement after a real emulator commit through `tests/support/fault-transport.ts`, without replacing database responses or app state.

The flake supplies Node, the Playwright browser distribution, and font configuration. npm's exact Playwright version must match the version exported by the locked Nix shell. The runner rejects mismatches. Do not run `playwright install`, install browser libraries globally, or substitute a system browser. Add future tools through the flake.

Canonical screenshots use **x86_64-linux**, pinned Chromium, headless mode, local bundled fonts, device scale 1, `en-CA`, UTC, dark color scheme, and reduced motion. The two projects are phone (393 × 852) and desktop (1280 × 900). Other platforms can develop the app, but must use this Linux environment or CI for baseline verification. Browser and font changes require deliberate baseline review.

Chromium runs with `--disable-partial-raster` to redraw complete raster tiles and `--disable-skia-runtime-opts` to use Skia's baseline CPU math. These pin rendering inputs for curved controls and tokens while keeping exact, unmasked comparisons. Both flags are part of the enforced launch contract, with regression cases rejecting removal. See Chromium's [renderer switches](https://chromium.googlesource.com/chromium/src.git/+/refs/heads/main/third_party/blink/common/switches.cc) and Skia's [precise baseline math](https://skia.googlesource.com/skia/+/e5fda8472b21/src/opts/SkRasterPipeline_opts.h).

## Non-negotiable rules

1. **No explicit waits.** No sleeps, timers, `waitForTimeout`, manual polling, `waitFor*` readiness calls, or `networkidle`. Use locator actions and web-first assertions against observable state: `await expect(button).toBeEnabled()` followed by `await button.click()`. Playwright's built-in actionability and assertion retrying are allowed; arbitrary elapsed time is not evidence.
2. **No masking or hiding failures.** No screenshot masks, screenshot-only CSS, injected styles, clipping, removed elements, blurred regions, or changing content to make a screenshot pass. Fix the application or deterministic input. The actual application's modal backdrop is part of the UI, not a test mask.
3. **Zero pixel tolerance.** The central configuration sets `maxDiffPixels: 0`, `maxDiffPixelRatio: 0`, and `threshold: 0`. The last setting also removes Playwright's default per-pixel color tolerance. Do not override any of these in a project, helper, or assertion.
4. **No retries or hidden tests.** `retries: 0`, `forbidOnly: true`; no `.only`, `.skip`, `.fixme`, `.slow`, selective green runs, or automatic baseline updates in CI. Fix failures before committing.
5. **One timing policy.** Actions, navigation, and assertions have a two-second ceiling. No per-step overrides. A scenario has a 30-second total budget; server startup has a separate 60-second infrastructure budget. These are failure deadlines, not delays to insert in a test. Fix a missing readiness signal or slow behavior instead of loosening deadlines.
6. **Real app and real interactions.** No mocked page markup, direct application-state mutation, forced clicks, or test-only routes that bypass the behavior being proved. The initial scenario uses the built app and keyboard. Future multiplayer scenarios use separate browser contexts and local Auth/Firestore emulators; never production data.
7. **No uncontrolled inputs.** Bundle fonts and assets. Block unexpected external network requests and fail on browser errors or failed resources. Fix random seeds, identities, locale, and clock when those features exist. Do not reveal hidden game values to simplify screenshots.
8. **Assertions before pictures.** Screenshots supplement explicit checks of headings, state, enabled controls, focus, and results. A pretty image alone does not prove the scenario worked.

`scripts/check-e2e-policy.mjs` checks source policy, the complete central configuration, verification commands, and baseline review records before browser execution. Scenarios may import only the shared fixture and TestSteps; DOM evaluation and request interception are reserved for the shared infrastructure. Computed API access, aliased test imports, dynamic imports, and unapproved helpers fail the source check. Do not weaken or bypass the guard.

### Enforcement map

Every executable rule has a pre-commit check. The table separates those checks from judgments that software cannot establish. The checks are regression protection, not a security boundary against someone editing the checkers themselves.

| Requirement | Pre-commit enforcement | Remaining review |
| --- | --- | --- |
| 1. No explicit waits | AST guard rejects wait APIs, timers, polling, `networkidle`, and references to forbidden methods, including aliases of those methods. | Decide whether the observed readiness condition proves the intended state. |
| 2. No masking or hiding failures | AST guard rejects screenshot options, style injection, DOM evaluation in scenarios, markup replacement, removal APIs, and direct property mutation. Only TestSteps may capture screenshots. Configuration must match the checked contract. | Inspect app changes and trusted layout-check code for concealed content. |
| 3. Zero pixel tolerance | Entire configuration must match `scripts/e2e-contract.json`, including all three zero thresholds; local overrides fail the AST guard. Normal browser execution compares every baseline. | Changes to the enforcement contract need explicit policy review. |
| 4. No retries or hidden tests | Contract fixes discovery, both projects, retries, `forbidOnly`, and update mode. AST rejects focus/skip/fixme/slow and fixture/config overrides. Runner rejects selection arguments and CI updates; package scripts must invoke the full suite. | A hook cannot prevent someone invoking Git with `--no-verify` or deleting a scenario; CI and PR review remain necessary. |
| 5. Timing policy | Contract fixes every timeout; source guard rejects timeout setters and local overrides. | Diagnose slow behavior rather than raising limits. |
| 6. Real app and interactions | Contract requires the fresh production preview and emulator pipeline. Guard rejects markup mocks, interception outside the fixture, forced actions, injected events, app-state evaluation, contexts outside the shared factory, and unapproved imports. | Verify assertions describe actual user behavior. Shared context creation and fault classification remain reviewable infrastructure. |
| 7. Controlled inputs and browser health | Runner requires the matching Nix browser version, Nix browser/font paths, and Linux architecture. Contract fixes viewport, locale, time zone, theme, and motion. AST rejects uncontrolled random/time calls in tests. Every context allows only the app and the configured local or live Auth/Firestore origins, and fails console, page, HTTP, transport, and unexpected-page errors, with the narrow reload-cancellation classification above. | Inspect application randomness, hidden information, and new emulator data handling. |
| 8. Assertions before pictures | TestSteps requires named checks; each callback must execute a counted matcher before layout checks and screenshot capture. The automatic fixture rejects scenarios without TestSteps or `finish()`. | A matcher count cannot prove that an assertion is meaningful. |
| Step IDs, layout, walkthrough | Helper rejects empty/duplicate IDs, empty descriptions, repeated or premature finish, overflow, clipping, overlapping controls, and small buttons. Normal runs compare the generated walkthrough. | Judge readability and scenario completeness. |
| Reviewed baselines and normal verification | `E2E_REVIEWS.json` must contain the exact SHA-256 and review notes for every baseline, without stale entries. The hook runs normal zero-tolerance verification. Update mode cannot fabricate review notes. | A hash-bound record is an attestation; it cannot prove visual inspection happened. |
| Commit exactly what passed | Hook rejects unstaged changes and untracked, non-ignored files before and after verification, and checks the staged prompt entry. | Review the PR's explanation of intended visual changes. |

Negative regression tests exercise configuration weakening, forbidden APIs and imports, missing/empty steps, stale reviews, and actual hook failures. Guard and infrastructure changes must preserve these tests and their failure cases.

The [Playwright assertion documentation](https://playwright.dev/docs/test-assertions) explains observable-state assertions. Its [screenshot API](https://playwright.dev/docs/api/class-pageassertions) compares stable captures, while [screenshot configuration](https://playwright.dev/docs/api/class-testproject) defines the pixel thresholds. Project rules above intentionally restrict available options.

## How test steps work

Each numbered scenario owns its specification, generated walkthrough, and screenshot baselines:

```text
tests/e2e/001-coming-soon/
  001-coming-soon.spec.ts
  README.md
  screenshots/
    000-splash-phone.png
    000-splash-desktop.png
    ...
```

Import `test` and `expect` from the shared fixture, then construct `TestSteps` with the page, test info, scenario title, and purpose. Perform a real action, then call `step` with a stable ID, a user-facing description, and named checks:

```ts
await page.goto('./');
await steps.step('splash', 'The game is clearly marked as coming soon', [
  {
    description: 'The coming-soon status is visible.',
    assert: async () => {
      await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
    }
  }
]);
steps.finish();
```

The helper runs each semantic check as a named Playwright step, checks font readiness and visible layout, and calls `toHaveScreenshot` without local options. IDs receive sequential prefixes (`000`, `001`, …). Only the helper captures screenshots; do not use `page.screenshot()` or create baselines with a separate browser script.

The initial layout check rejects splash overflow, clipped content, overlapping controls, and buttons below 44 × 44 CSS pixels. These checks are specific to the initial screen: a future intentionally scrollable game path needs explicit scroll-container assertions, not silent relaxation of the splash checks.

Call `finish()` after all steps. For multiple players, pass a stable view ID and layout kind to the constructor, such as `new TestSteps(page, info, title, purpose, 'host', 'room')`; the view ID becomes part of every screenshot filename. IDs must be unique per scenario, and every created player page needs a finished view. The desktop run generates one walkthrough after all named views finish, with their actual assertion descriptions and links to both viewport screenshots. The original primary-view naming remains unchanged. In a normal run, it verifies that the committed walkthrough matches. Do not hand-edit generated walkthroughs or claim checks not performed by the test.

The shared fixture rejects traffic outside the app and configured loopback emulators and records console errors, uncaught page errors, and HTTP failures in every context. A screenshot that looks correct still fails if the application reports an error. The optional `game` layout requires visible `[data-game-path]` and `[data-game-actions]` regions, an independently scrollable path, and reachable controls outside it; this infrastructure is ready for the future board, not evidence of implemented gameplay.

## Create or update a baseline

1. Change the application and semantic assertions together. Review the intended behavior first.
2. Run `nix develop -c npm run test:e2e:update`. This is the only documented update path; it also regenerates the walkthrough from passing steps.
3. Inspect **every** added or changed screenshot at phone and desktop sizes. Check content, layout, focus, and readability against the assertions and UX design. Record its SHA-256 and specific review notes in `E2E_REVIEWS.json`; remove entries for deleted baselines. An update command succeeding is not review. To print hashes, run `nix develop -c node --input-type=module -e 'import { screenshotFiles, digest } from "./scripts/check-e2e-reviews.mjs"; import { readFileSync } from "node:fs"; for (const path of screenshotFiles()) console.log(path, digest(readFileSync(path)));'`. This command does not attest that you reviewed anything.
4. Run `nix develop -c npm run verify` without update mode. All screenshots must match with zero differences. Missing baselines fail in normal mode rather than being silently accepted.
5. Stage the app, test, walkthrough, screenshots, review records, and verbatim prompt entry together, then commit. Explain intentional visual changes in the PR.

Normal tests never rewrite approved screenshots or walkthroughs. On failure, inspect the expected, actual, and difference images under `test-results/`, and the HTML report and retained trace under `playwright-report/`. These diagnostic files are not baselines and are not committed. CI uploads them even when verification fails.

## Hooks and CI

The pre-commit hook checks the staged prompt log, confirms that all non-ignored working files match the index, runs the policy checker directly, and runs `npm run verify`, entering Nix if necessary. It checks index/worktree agreement again afterward and stops on any failed command. Stage all final changes before committing; untracked non-ignored files also fail. Never use `--no-verify` or disable Husky to get a failing change through.

CI installs the locked dependencies inside Nix and runs the same verification on the exact checked-out commit. PRs also check that the prompt log appends to the base history. After verification, the same static build is published at `/deepsea/pr<N>/` for same-repository PRs and `/deepsea/` for main. Publication preserves other previews and runs serially. The repository's Pages source is the root of `gh-pages`; the workflow explicitly requests a Pages build because workflow-token pushes do not trigger one automatically. See [GitHub's token documentation](https://docs.github.com/en/actions/concepts/security/github_token). Fork PRs verify without publishing and must be moved to a same-repository review branch with a passing preview before being considered ready. Preview links appear in the workflow summary; a published page alone is not sufficient. The preview-smoke job verifies revision.json against the reviewed commit and runs the same UI journeys against the retained HTTPS preview with real anonymous Auth and Firestore. A missing preview configuration or failed deployed journey blocks readiness. Browser screenshots and generated walkthroughs must already be committed and are never updated automatically by CI.

## First scenario acceptance

The arrival scenario now verifies the finished name-entry and invitation card on phone and desktop. It uses the configured backend, preserves the entered name while opening help with the keyboard, and restores focus after Escape. All three states have zero-tolerance screenshots. Multiplayer scenarios create rooms directly from this arrival form through real player actions.

## Working preview requirement

Every PR must include a direct retained preview link and manual steps for its implemented behavior. The preview must expose the real entry-to-outcome user journey, including its backend. Seeded pages, emulator-only features, static placeholders, and local passing tests do not satisfy this rule. Run the same browser scenarios against the deployed revision with:

`LIVE_PREVIEW_URL=https://anicolao.github.io/deepsea/pr5/ PREVIEW_REVISION=<head-sha> nix develop -c npm run test:preview`

The live runner rejects non-preview URLs, missing or shared preview/production configuration, and mismatched deployed revisions. It preserves full discovery, both canonical viewports, zero screenshot tolerances, no retries, and the same two-second interaction/assertion limits. It cannot update baselines. The shared fixture allows only the app and the three Firebase Auth/token/Firestore HTTPS origins in live mode; loopback endpoints are local-only. Browser clipboard permission is granted centrally so copy-invite performs a real clipboard write and the invite journey reads that actual clipboard value through a narrowly allowed fixture method; the host page is brought to the foreground before copying.

The pre-commit configuration guard checks that the deployment depends on verification, includes the revision stamp, and retains the dependent preview-smoke job and its command. Negative regression tests reject removal of these requirements; pinned actionlint validates workflow syntax in the same Node guard suite. GitHub main protection requires verify and preview-smoke before merge, including administrators. A fork-only verification or skipped preview is not approval evidence. Polling for the exact Pages build to finish belongs only to bounded deployment infrastructure; browser scenarios still have no explicit waits.

Reload cancellation classification records the exact open Firestore Listen requests belonging to the page before reload. Chromium may report cancellation after the new document has loaded; only those old request objects with net::ERR_ABORTED qualify. New streams, other endpoints, other pages, and different failure codes still fail. Regression tests cover both immediate and delayed delivery; no delay or grace period is added.

### Reproducible game initialization

The shared fixture supplies reproducible initialization randomness through the app's `backend.json` response: seed 2026 by default, or an explicitly validated unsigned seed passed to `players.create(seed)`. All identities, rooms, events and board transitions still come from normal player actions and the real SDK. Production rejects an initialization seed override. The source guard permits only this exact configuration fulfillment; scenarios cannot fulfill requests or inject state. `TestSteps.gameLayout()` switches a lobby walkthrough to the stricter scrollable-path and persistent-action checks after start.

Dive cleanup and review use the same independently scrolling primary panel as the ocean path. Overlap checks intersect controls inside that panel with its clipping rectangle, so naturally offscreen controls do not falsely overlap the persistent footer. Actual visible overlaps still fail; other page regions retain full viewport checks. The negative regression in `check-e2e-steps.test.mjs` exercises partial clipping, fully offscreen controls, visible overlap, and controls outside the panel. Screenshots remain entirely unmasked with zero pixel tolerance.

Browser traces are retained for every run, including all owned player contexts. With failure-only retention, contexts closed inside fixture cleanup could have their traces discarded before a later health assertion marked the test failed. Always-on tracing preserves the network evidence needed to diagnose that failure without relaxing browser health checks.

The health harness recognizes an SDK retry only for an HTTP 409 `ALREADY_EXISTS` or `ABORTED` response from Firestore's commit endpoint containing a single immutable event write, followed by a successful commit for the identical event and fields or a version-checked verification of that same document. An unresolved conflict, changed payload, different document, other endpoint/status, or unconditional verification fails. Only the matching browser-generated 409 console message is paired with that response. This verifies recovery rather than ignoring failed operations. Regression tests exercise each rejected variation.

An explicit player reload also tracks exact already-open Firestore commit and batch-read requests, which navigation can cancel after their results have arrived. Only `net::ERR_ABORTED` for those registered requests qualifies; new requests, other resources, and different errors still fail.

The SDK can abort a successfully consumed Fetch WebChannel response during cleanup. The harness classifies this only for GET Listen RPC requests with HTTP 200, net::ERR_ABORTED, and a subsequent request in the same database/session whose AID proves advancement beyond the cancelled response. Missing original responses, stagnant acknowledgements, different sessions/databases, and other methods/endpoints/codes fail. This is verified protocol progress, not a blanket cancellation exemption. The pinned webchannel-wrapper cleanup calls abort even after readyState 4; deployed traces show the following request acknowledging consumed data. Negative tests cover every boundary.

The next request’s AID is the SDK acknowledgement of data already consumed, even when that next long poll remains open at scenario completion. Its network failures are still checked independently. Multiplayer steps assert that a player has observed the joined roster before readying that roster; another player’s successful click does not synchronize all browsers.
Buffering-proxy detection can cancel the initial streaming probe before response headers arrive. This distinct SDK transition qualifies only for an initial GET Listen RPC at `AID=0`, `CI=0`, `TYPE=xmlhttp`, replaced by HTTP 200 at `AID=0`, `CI=1`, `TYPE=xmlhttp` in the same database/session, followed by a further same-session AID advance. Only `net::ERR_ABORTED` qualifies. Missing replacement responses, unchanged streaming mode, noninitial probes, wrong sessions/databases and lack of progress fail. The pinned WebChannel implementation switches to long polling at its buffering-proxy detection callback; the deployed trace records this exact transition. The harness does not introduce a timer or allow arbitrary retries.

Use `players.visit(page, absoluteURL)` when navigating an already connected player to another room. It checks the destination origin and tracks only the exact already-open Firestore stream requests cancelled by that navigation, using the same narrow error-code classification as `players.reload`. It cannot exempt new streams, other resources, or unrelated failures. `TestSteps.roomLayout()` restores ordinary viewport checks when a completed-game journey returns to a fresh lobby.

### Recovery and concurrent views

`players.tab(page)` opens another tab in the same browser context and identity. Only this explicit factory operation authorizes an extra page; the new page inherits all health and lifecycle checks. `players.setConnected` registers exact outstanding requests in every tab of that context before changing native connectivity, and registers Firestore requests issued while offline. Only their `net::ERR_INTERNET_DISCONNECTED` failures, or `net::ERR_ABORTED` for Listen subscriptions intentionally stopped offline, qualify. Other requests, origins and error codes still fail, including after reconnection. Matching browser-generated resource errors are paired one-for-one with those registered failures.

`players.loseNextAcknowledgement(page)` forwards exactly one real immutable commit, requires an actual HTTP 200 from the server, then aborts only its browser reply. It neither writes fixture data nor fabricates a response. The harness requires one induced failure; the scenario asserts `players.faultCount(page) === 1` and verifies the accepted move and its observers. An existing-event conflict qualifies as recovered only after an identical server event is read, with its document name, fields and update time checked. Unrelated browser errors remain failures.

Trusted backend requests bypass the route callback but retain request/response/error observation. All other requests still pass through the origin gate and unexpected origins are aborted. Separate local and hosted regular expressions prevent local tests from accessing live Firebase. Negative tests cover lookalike hosts, alternate ports, wrong environments and other resources. This removes a routing round trip per streaming packet without relaxing network checks.

Independent static final views may run their TestSteps concurrently. Every semantic callback has an isolated AsyncLocalStorage assertion counter, so it cannot borrow assertions from another check. Each view still gets its own full zero-tolerance screenshot, layout checks and completed walkthrough. The six-player game uses this after all players have acted through the UI. No scenario timeout changes or retries are permitted.

The six-player journey selects return directions with native keyboard input and asserts the radio is checked. Independent invitation pages load together, joins remain ordered, and final views run concurrently. All six clients still play the same three dives and each verifies every score, winner, replay action and full screenshot under the original deadlines.

Its keyboard action locators intersect the named control with `:enabled`, so Playwright resolves the action only when the control becomes enabled. This avoids a separate pre-action polling assertion without allowing disabled controls or forced input. Final state assertions remain explicit.

The navigation classifier ends at the main-frame commit, not after a delay. A request from the new document or another player never qualifies as old-document cancellation. The guard suite exercises this boundary, unused/misapplied faults, shared-tab health, and concurrent empty checks.
