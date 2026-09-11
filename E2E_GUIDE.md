# E2E Testing Guide

E2E tests prove a user-visible result through the real production-built application. Every documented step combines semantic assertions, layout checks, and a screenshot. The first scenario covers the coming-soon screen and its keyboard-accessible game brief. The room-foundation scenario uses real anonymous Auth and immutable Firestore persistence in local emulators, with separate host and guest browsers; joining and gameplay are not implemented yet.

## Run the contract

```sh
nix develop
npm ci
npm run verify
```

`verify` runs Svelte/TypeScript checks, Node guard tests, Vitest unit tests, and the browser pipeline. `npm run test:e2e` checks source/configuration/review policy, ensures the pinned Firestore emulator artifact is downloaded, builds the static app, and starts fresh Auth/Firestore emulators. Emulator integration tests must pass before the preview server becomes ready for Playwright. It tests a nested base path (`/deepsea/pr-e2e/`) so broken preview asset paths are caught. It never reuses a development server or an existing emulator. Startup retains its 60-second budget; graceful shutdown has a separate five-second infrastructure deadline to release child services and ports on success or failure. Dependency downloads occur before the server-startup deadline.

The shared fixture owns additional browsers through `players.create()`. Each inherits canonical rendering, two-second action/navigation deadlines, network restrictions, and error checks. Each page needs its own named TestSteps view. Native anonymous UIDs and room IDs vary between isolated runs; scenarios assert identity relationships and use fixed display names without rendering opaque IDs. Rules randomness has fixed golden seed fixtures. Each browser scenario creates its own room and identities in the freshly started demo project; emulator-rules tests use a separate demo project.

Use `players.reload(page)` for a connected room. The fixture records the page’s exact open `/google.firestore.v1.Firestore/Listen/channel` requests before navigation. Only those request objects with Chromium’s `net::ERR_ABORTED` cancellation qualify, even if the notification arrives after reload resolves. New streams, other pages, other endpoints, and different failure codes still fail. Negative tests cover each boundary. A canceled streaming subscription during deliberate navigation is not a failed page resource; screenshots and semantic assertions must still prove recovery. `players.setConnected(page, connected)` controls native context connectivity; it does not suppress resulting errors. Repository integration tests inject a lost acknowledgement after a real emulator commit through `tests/support/fault-transport.ts`, without replacing database responses or app state.

The flake supplies Node, the Playwright browser distribution, and font configuration. npm's exact Playwright version must match the version exported by the locked Nix shell. The runner rejects mismatches. Do not run `playwright install`, install browser libraries globally, or substitute a system browser. Add future tools through the flake.

Canonical screenshots use **x86_64-linux**, pinned Chromium, headless mode, local bundled fonts, device scale 1, `en-CA`, UTC, dark color scheme, and reduced motion. The two projects are phone (393 × 852) and desktop (1280 × 900). Other platforms can develop the app, but must use this Linux environment or CI for baseline verification. Browser and font changes require deliberate baseline review.

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

The initial test proves that the nested-path production build loads on phone and desktop, advertises the future multiplayer game without offering unfinished room controls, hydrates its About button, opens the brief with the keyboard, and restores focus when Escape closes it. All three states have zero-tolerance screenshots. There are no Firebase requests or credentials in this slice.

## Working preview requirement

Every PR must include a direct retained preview link and manual steps for its implemented behavior. The preview must expose the real entry-to-outcome user journey, including its backend. Seeded pages, emulator-only features, static placeholders, and local passing tests do not satisfy this rule. Run the same browser scenarios against the deployed revision with:

`LIVE_PREVIEW_URL=https://anicolao.github.io/deepsea/pr5/ PREVIEW_REVISION=<head-sha> nix develop -c npm run test:preview`

The live runner rejects non-preview URLs, missing or shared preview/production configuration, and mismatched deployed revisions. It preserves full discovery, both canonical viewports, zero screenshot tolerances, no retries, and the same two-second interaction/assertion limits. It cannot update baselines. The shared fixture allows only the app and the three Firebase Auth/token/Firestore HTTPS origins in live mode; loopback endpoints are local-only. Browser clipboard permission is granted centrally so copy-invite performs a real clipboard write and the invite journey reads that actual clipboard value through a narrowly allowed fixture method; the host page is brought to the foreground before copying.

The pre-commit configuration guard checks that the deployment depends on verification, includes the revision stamp, and retains the dependent preview-smoke job and its command. Negative regression tests reject removal of these requirements; pinned actionlint validates workflow syntax in the same Node guard suite. GitHub main protection requires verify and preview-smoke before merge, including administrators. A fork-only verification or skipped preview is not approval evidence. Polling for the exact Pages build to finish belongs only to bounded deployment infrastructure; browser scenarios still have no explicit waits.

Reload cancellation classification records the exact open Firestore Listen requests belonging to the page before reload. Chromium may report cancellation after the new document has loaded; only those old request objects with net::ERR_ABORTED qualify. New streams, other endpoints, other pages, and different failure codes still fail. Regression tests cover both immediate and delayed delivery; no delay or grace period is added.
