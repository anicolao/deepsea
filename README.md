# Deep Sea

A multiplayer browser game for **2–6 friends**, based on **Deep Sea Adventure** by Oink Games.

Dive for concealed treasure, share one oxygen tank, and decide when to turn back. Every carried unit uses air and slows movement. Bring treasure back to the submarine, play three dives, and compare your crew's final haul.

**[Play the complete MVP review build](https://anicolao.github.io/deepsea/pr6/)** · [Manual review guide](PR_PREVIEW.md)

Create a room and share its invitation. Each friend joins from their own browser or device. Ready the crew, choose the first diver, and start. The game includes complete turns, lost-treasure stacking, three-dive scoring, tiebreaks, shared winners, public move history, keyboard controls and a fresh-room replay flow. Reloads retain the anonymous seat; reconnecting reconciles confirmed moves before allowing another action.

This is for trusted groups. There are no bots, public matchmaking, accounts, chat or ranked play. The client conceals unrevealed values in the player interface; it is not a server-enforced hidden-information or anti-cheat system.

## Run locally

Use Nix with flakes enabled:

```sh
nix develop
npm ci
npm run emulators
```

In another Nix terminal, run `npm run dev`, then open `http://127.0.0.1:5173/`. Copy an invitation into a separate browser profile to add a friend. Two tabs in one profile share an identity. Emulator data is disposable; ordinary reloads retain the seat while the emulators run.

The flake supplies Git, GitHub CLI, Node/npm, Java, curl, ripgrep, actionlint, libwebp, pinned Chromium and fonts. JavaScript tools and libraries have exact versions in the npm lockfile. Add future system tools to `flake.nix` and commit its lockfile; do not install project tools globally. `npm run format` formats application source and scenarios with the pinned formatter.

## Verify and contribute

Stop manually started emulators, then run:

```sh
nix develop -c npm run verify
```

Verification checks types, enforcement regressions, game rules, event repositories, real emulator authorization and complete browser journeys. It owns fresh local services and shuts them down afterwards. Canonical screenshots use the x86_64 Linux Nix environment. [E2E_GUIDE.md](E2E_GUIDE.md) specifies semantic steps, no explicit waits, no masking, zero pixel tolerance and manual baseline review. [UX_ACCEPTANCE.md](UX_ACCEPTANCE.md) maps the finished player journeys to tests and visual evidence.

Every PR requires a working retained preview at `/deepsea/pr<N>/` and green deployed browser checks on its exact head. The preview project is isolated from the production project; neither falls back to the other. Merging to `main` verifies and publishes the root `/deepsea/` build. See [OPERATIONS.md](OPERATIONS.md) for authentication, Firebase setup, deployment, compatibility and rollback.

Record every project prompt verbatim in [PROMPTS.md](PROMPTS.md), in order, under a heading such as `## Prompt 19: Short Prompt Summary`. Use a 2–3 word summary and preserve the original body. Follow [AGENTS.md](AGENTS.md): never rewrite history or invent prompts to pass a hook. A sequence of commits for one prompt appends unique continuation records to [PROMPT_WORK.md](PROMPT_WORK.md), referencing the exact prompt-log hash.

`npm ci` installs the Husky hook. It checks the staged prompt/continuation, rejects unstaged or untracked inputs, enforces every E2E rule and runs normal verification on the exact commit tree. It cannot read the conversation or prove verbatim completeness; maintaining the log remains a contributor responsibility. Use `nix develop -c gh auth status` for GitHub authentication and keep credentials outside the repository.

## Design and rules

- [VISION.md](VISION.md): the project's north star.
- [RULES_SUMMARY.md](RULES_SUMMARY.md) and [BASE_1.md](docs/protocol/BASE_1.md): accepted rules conventions and versioned behavior.
- [MVP_DESIGN.md](MVP_DESIGN.md): scope, event persistence and multiplayer architecture.
- [UX_DESIGN.md](UX_DESIGN.md): player experience and mockups.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): delivery steps and acceptance evidence.
- [Scenario walkthroughs](tests/e2e/): screenshots produced by real browser journeys.

## Credits and license

Original project contributions are licensed under the [GNU General Public License version 3](LICENSE), `GPL-3.0-only`.

Deep Sea Adventure is published by Oink Games, designed by Jun Sasaki and Goro Sasaki, with artwork by Jun Sasaki. See [the publisher's game page and credits](https://oinkgames.com/en/games/analog/deep-sea-adventure/).

This is an independent project with original browser artwork. It does not claim official affiliation or a license to the publisher's artwork, branding or rulebook. The generated ocean asset's provenance and prompt are recorded in [static/art/README.md](static/art/README.md).
