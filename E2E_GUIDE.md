# E2E Testing Guide

E2E tests prove a user-visible result through the real production-built application. Every documented step combines semantic assertions, layout checks, and a screenshot. The first scenario covers the coming-soon screen and its keyboard-accessible game brief; it makes no claim to test multiplayer or a backend.

## Run the contract

```sh
nix develop
npm ci
npm run verify
```

`verify` runs Svelte/TypeScript checks, guard tests, and the browser suite. `npm run test:e2e` checks E2E source policy, builds the static app, starts a fresh preview server, runs Playwright, and stops the server. It tests a nested base path (`/deepsea/pr-e2e/`) so broken preview asset paths are caught. It never reuses an already-running development server.

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

`scripts/check-e2e-policy.mjs` rejects common forbidden calls and option overrides in scenarios and helpers before browser execution. It is an AST-based guard, not a complete proof against every possible workaround. Reviewers must also check for aliases, dynamic code, injected DOM changes, and policy changes in configuration. Do not weaken or bypass the guard.

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

Call `finish()` after all steps. The desktop run generates a walkthrough containing each step's actual assertion descriptions and links to both viewport screenshots. In a normal run, it verifies that the committed walkthrough matches. Do not hand-edit generated walkthroughs or claim checks not performed by the test.

The shared fixture rejects external network traffic and records console errors, uncaught page errors, and HTTP failures. A screenshot that looks correct still fails if the application reports an error. Extend the fixture to cover every added player context when multiplayer arrives.

## Create or update a baseline

1. Change the application and semantic assertions together. Review the intended behavior first.
2. Run `nix develop -c npm run test:e2e:update`. This is the only documented update path; it also regenerates the walkthrough from passing steps.
3. Inspect **every** added or changed screenshot at phone and desktop sizes. Check content, layout, focus, and readability against the assertions and UX design. An update command succeeding is not review.
4. Run `nix develop -c npm run verify` without update mode. All screenshots must match with zero differences. Missing baselines fail in normal mode rather than being silently accepted.
5. Commit the app, test, walkthrough, screenshots, and verbatim prompt entry together. Explain intentional visual changes in the PR.

Normal tests never rewrite approved screenshots or walkthroughs. On failure, inspect the expected, actual, and difference images under `test-results/`, and the HTML report and retained trace under `playwright-report/`. These diagnostic files are not baselines and are not committed. CI uploads them even when verification fails.

## Hooks and CI

The pre-commit hook checks the staged prompt log and runs `npm run verify`, entering Nix if necessary. The verification uses working-tree files; stage the final related app/test/baseline changes before committing. Never use `--no-verify` or disable Husky to get a failing change through.

CI installs the locked dependencies inside Nix and runs the same verification on the exact checked-out commit. PRs also check that the prompt log appends to the base history. After verification, the same static build is published at `/deepsea/pr<N>/` for same-repository PRs and `/deepsea/` for main. Publication preserves other previews and runs serially. The repository's Pages source is the root of `gh-pages`; the workflow explicitly requests a Pages build because workflow-token pushes do not trigger one automatically. See [GitHub's token documentation](https://docs.github.com/en/actions/concepts/security/github_token). Fork PRs verify without publishing. Preview links appear in the workflow summary; previews are not evidence of Firebase functionality. Browser screenshots and generated walkthroughs must already be committed and are never updated automatically by CI.

## First scenario acceptance

The initial test proves that the nested-path production build loads on phone and desktop, advertises the future multiplayer game without offering unfinished room controls, hydrates its About button, opens the brief with the keyboard, and restores focus when Escape closes it. All three states have zero-tolerance screenshots. There are no Firebase requests or credentials in this slice.
