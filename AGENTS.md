# Project instructions

Use the project's Nix flake for development tools. Add any newly needed tools to `flake.nix`, keep `flake.lock` committed, and run commands through `nix develop`. Do not install project tools globally or through ad hoc package environments. JavaScript dependencies remain managed by npm and `package-lock.json` inside the Nix development shell.

Keep `VISION.md` exclusively about the end state and north star. Do not include design principles, visual direction, success criteria, milestones, implementation plans, release scope, or open planning decisions.

The MVP will be a multiplayer game on the web. `MVP_DESIGN.md` records the design and scope; `RULES_SUMMARY.md` and `docs/protocol/BASE_1.md` record the user's accepted base-1 conventions. Do not describe it as a shared-device game or treat project conventions as publisher verification. Distinguish implemented foundation features from future gameplay.

Write design documents as standalone designs for Deep Sea. Explain decisions from this game's needs; omit reviews of reference projects, comparisons, and the history of how a decision was reached.

Follow `E2E_GUIDE.md` for browser tests: no explicit waits, masking, pixel tolerance, retries, skipped/focused tests, or per-test timeout overrides. Use the shared test fixture and TestSteps helper. Review generated screenshots and walkthroughs, then run normal verification before committing. Run tools through the Nix flake.

Keep the guide's enforcement map and negative regression tests aligned with every E2E rule. Do not weaken the configuration contract or source guards to pass a test. Record exact baseline hashes and specific visual review notes in `E2E_REVIEWS.json`; automated updates must not fabricate review attestations. Stage all non-ignored changes before committing so the hook verifies the same files as the commit.

Every PR must provide a working retained PR preview that lets a reviewer manually exercise its implemented functionality through real user actions. Provision/configure its isolated backend and verify the deployed flow before calling the PR ready. A static placeholder, emulator-only feature, seeded page, or green unit suite does not meet this requirement. Include a direct preview link and reproducible manual steps in the PR, and keep a deployment/browser smoke check required. Never defer the preview backend needed by a feature to a later step.

Record every user prompt concerning this project verbatim in `PROMPTS.md`, including corrections and follow-up requests. Append each prompt once, in conversation order, under the next `## Prompt N: Summary` heading. Give each new prompt a 2–3 word summary, for example `## Prompt 8: Write Prompt Summaries`, followed by a blank line and the verbatim prompt. Preserve spelling, punctuation, capitalization, and line breaks in the prompt body. Leave historical headings unchanged. Do not include assistant messages or automatically supplied environment context.

Update the log before doing other project work for each new prompt. Never rewrite or remove existing entries, and never invent or duplicate a prompt to satisfy a hook. Stage the new entries with the related work when committing.

The Husky pre-commit hook requires a nonempty new staged prompt, or an explicit continuation record in PROMPT_WORK.md for the latest logged prompt. Each continuation appends a unique logical step and the SHA-256 of the exact staged prompt log. This supports the user's requested sequence of commits for one prompt without inventing conversation entries. New prompts must still be logged before work. The hook checks Git's index; it cannot access the conversation or prove that prompts were copied accurately.
