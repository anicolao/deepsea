# Operating Deep Sea

The reviewed MVP runs as a static site with anonymous Firebase Auth and immutable Firestore events. The browser computes the game from the confirmed event stream. Games are intended for trusted friends; this is not an authoritative anti-cheat server, and invitation links do not make the stored seed or treasure values confidential.

## Environments

| Address | Firebase project | Event namespace |
| --- | --- | --- |
| Explicit localhost / 127.0.0.1 | `demo-deepsea`, local emulators | `local` |
| `https://anicolao.github.io/deepsea/pr6/` | `deepsea-preview-anicolao` | `pr6` |
| Other retained `/deepsea/pr<N>/` previews | `deepsea-preview-anicolao` | `pr<N>` |
| `https://anicolao.github.io/deepsea/` | `deepsea-game-anicolao` | `production` |

Each hosted project has a default Firestore database in `nam5`, anonymous sign-in enabled, and `anicolao.github.io` authorized. Public web-app configuration lives in `static/backend.json`. Preview and production project IDs must differ. Missing, malformed or unknown-origin configuration fails closed; there is no fallback to another environment. Production forbids a fixed initialization seed and generates one with Web Crypto for each game.

## Reproduce development and verification

Install Nix with flakes enabled, clone the repository, then:

```sh
nix develop
npm ci
npm run verify
```

The flake supplies development tools, Java for Firestore, Chromium and fonts. npm supplies exact locked application and test dependencies. The canonical pixel environment is x86_64 Linux. `verify` owns fresh Auth/Firestore emulators on ports 9099/8080, the hub on 4400 and the built site on 4173. Stop manually started services first. It checks types, policy regressions, deterministic rules, repositories, real emulator authorization and browser journeys. Test rooms are created through player actions; no scenario inserts a prepared game page.

For interactive development, run `npm run emulators` and `npm run dev` in two Nix terminals. Open `http://127.0.0.1:5173/` and copy invitations into separate browser profiles. Emulator data is disposable. Follow E2E_GUIDE.md to update and inspect screenshots; normal verification must pass before committing.

## Provision or update Firebase

Use `nix develop -c npm exec -- firebase login` to authenticate locally. Keep the CLI's credentials outside the repository. Create a dedicated Firebase project and web app, create its default Firestore database, enable anonymous Auth, and authorize the hosting domain. Record only the public SDK configuration in `static/backend.json`.

Deploy the committed authentication settings and immutable event rules explicitly to each intended project:

```sh
nix develop -c npm exec -- firebase deploy --only auth,firestore:rules --project deepsea-preview-anicolao --non-interactive
nix develop -c npm exec -- firebase deploy --only auth,firestore:rules --project deepsea-game-anicolao --non-interactive
```

Deploy compatible rules before publishing a client that uses them. Retained previews share the preview project, so preserve the envelope support required by those builds. CI needs no Firebase administrator credential; its live smoke test signs in anonymously like a player. Fork workflows cannot publish a trusted preview and cannot satisfy the required preview check until moved to a review branch in this repository.

## Publish and review

`verify-and-preview.yml` checks out the exact PR head, verifies it with its nested base path, stamps `revision.json`, and uploads the tested `static-site` artifact. Publication copies that artifact into `pr<N>/` on `gh-pages` and explicitly requests a Pages build. `preview-smoke` checks the revision and repeats the real browser journeys over HTTPS against the isolated preview backend. Both `verify` and `preview-smoke` are required before merge.

Use PR_PREVIEW.md for the manual journey. The PR preview remains available after merge. Merging to `main` verifies and publishes the root `/deepsea/` build; preparing this PR does not itself publish the new game at the production root. Its assets and invitation paths are compiled for that base path.

To independently check a deployed review revision:

```sh
nix develop
LIVE_PREVIEW_URL=https://anicolao.github.io/deepsea/pr6/ PREVIEW_REVISION=<full-reviewed-sha> npm run test:preview
```

This command rejects production URLs. Automated verification must never use production games as fixtures. For production acceptance after merge, check the entry page, deployed revision, asset loading and invitation navigation manually. Keep actual production play separate from automated checks.

## Recovery and compatibility

An anonymous seat belongs to its browser profile. Reload reuses that identity and replays confirmed events. Tabs in one profile share the seat. Clearing browser storage loses it; the app explains why an active seat cannot be reclaimed. An absent diver keeps their turn or lost-cargo choice. Friends can create a new room if that person cannot return.

Disconnected open pages keep a disposable last-known view and disable moves. Pending envelopes persist with their original event IDs. A lost acknowledgement is resolved by reading that exact immutable event and comparing its envelope; retry never creates a second logical roll or charges oxygen again. Reloading an offline page is not an offline installation feature: fetching the app and recovering its complete history require a connection.

The MVP uses schema 1, reducer 6 and ruleset `base-1`. Unsupported rooms block interaction and offer an update or new room. A newer client never silently reinterprets an older event stream. Compatibility tests cover that boundary. Changes to semantics require an explicit version decision and a retained compatible client, not editing stored game events.

## Rollback

Keep the passing workflow run, its `static-site` artifact, its commit SHA and retained preview URL with every release. Git history on `gh-pages` preserves published files; CI browser reports are retained for 14 days. Download important release artifacts before their GitHub retention expires.

Before replacing a production release, retain its root-built artifact. To roll back, restore that exact verified root artifact to the root of `gh-pages`, preserve every `pr<N>/` directory, and request a Pages build. Do not copy a nested PR build to the root: its asset and invite base paths differ. Check `revision.json` against the restored SHA and manually check entry and invite loading. Alternatively, revert the application change in a reviewed PR and let the normal verification pipeline build and publish a compatible root release.

A rollback must support the versions of rooms created since the release, or clearly block those rooms until their compatible client is restored. Preserve backend rules that those retained clients require. Never delete games or rewrite event timestamps to make a rollback appear successful. This is the first complete production-game release; the older retained lobby previews are useful compatibility evidence, not a complete-game production rollback.

## Acceptance evidence and limits

The final PR check records the exact tested SHA, date, live environment and outcome in GitHub Actions. Walkthroughs under `tests/e2e/` show the actual phone and desktop states; E2E_REVIEWS.json binds visual notes to their PNG hashes. UX_ACCEPTANCE.md maps player journeys and accessibility checks to evidence.

Before the final release commit, all 24 browser scenarios also passed with `PUBLIC_BASE_PATH=/deepsea` against local emulators and the same exact screenshot baselines. This checks production-path invitations and assets without creating production games.

Live tests use independent browser contexts and the real hosted backend. They do not constitute a physical-device or screen-reader audit. Final human review should open the invitation on a phone and a different computer and check the intended input methods. No physical-device pass is claimed by automation.
