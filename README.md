# Deep Sea

Deep Sea is a project based on **Deep Sea Adventure** by Oink Games. It will be a multiplayer game on the web that preserves the tension of diving for treasure while everyone shares a limited oxygen supply.

Dive deeper for better rewards, decide when to turn back, and try to reach the submarine before the air runs out. Taking more treasure puts pressure on the shared supply, so each player's choices affect the whole table. See the [official game page](https://oinkgames.com/en/games/analog/deep-sea-adventure/) for an introduction to the original game.

## Project status

This project is in the planning stage. The repository contains documentation and development hooks; there is no playable build or selected game technology stack yet.

Read [VISION.md](VISION.md) for the project's north star.

## MVP direction

The MVP will be a multiplayer game on the web. [MVP_DESIGN.md](MVP_DESIGN.md) proposes its scope, architecture, and implementation strategy. [RULES_SUMMARY.md](RULES_SUMMARY.md) describes the base-game rules and identifies details that need rulebook confirmation.

Game installation and run instructions will be added when an implementation exists.

## Prompt log and development hooks

Record every project prompt verbatim in [PROMPTS.md](PROMPTS.md), following [AGENTS.md](AGENTS.md). Use `## Prompt N: Summary` with a 2–3 word summary, then a blank line and the verbatim prompt. Append new entries without changing earlier entries, then stage them with the related work.

Use Nix with flakes enabled to enter the pinned development environment, then install JavaScript dependencies and activate the hook:

```sh
nix develop
npm ci
npm test
```

The flake provides Git, GitHub CLI (`gh`), Node.js 22 with npm, curl, and ripgrep. Add future development tools to `flake.nix` and commit the lockfile. For a single command, use `nix develop -c <command>`. Hook installation uses the `prepare` script, following the [Husky setup documentation](https://typicode.github.io/husky/how-to.html).

For GitHub operations, run `gh auth status` in the development shell and, if needed, authenticate with `gh auth login --web --git-protocol https`. Keep credentials outside the repository.

The pre-commit hook rejects commits unless the staged `PROMPTS.md` preserves the committed history and adds a nonempty prompt entry. This also applies to the first commit. An unstaged update does not count. Keep work for a single prompt in one commit; never invent entries just to pass the check.

Run `npm run check:prompts` to check the current index, or `npm test` to exercise the guard in temporary Git repositories. The hook cannot read chat history or verify verbatim completeness; recording prompts remains a contributor responsibility.

## Credits

This project's original contributions are licensed under the [GNU General Public License version 3](LICENSE) (`GPL-3.0-only`).

Deep Sea Adventure is published by Oink Games and was designed by Jun Sasaki and Goro Sasaki, with artwork by Jun Sasaki. See [Oink Games' credits](https://oinkgames.com/en/games/analog/deep-sea-adventure/).

This repository documents a separate development project and does not claim official affiliation with Oink Games. No license for the original game's artwork, branding, or rulebook is implied.
