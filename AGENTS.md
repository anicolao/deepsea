# Project instructions

Use the project's Nix flake for development tools. Add any newly needed tools to `flake.nix`, keep `flake.lock` committed, and run commands through `nix develop`. Do not install project tools globally or through ad hoc package environments. JavaScript dependencies remain managed by npm and `package-lock.json` inside the Nix development shell.

Keep `VISION.md` exclusively about the end state and north star. Do not include design principles, visual direction, success criteria, milestones, implementation plans, release scope, or open planning decisions.

The MVP will be a multiplayer game on the web. `MVP_DESIGN.md` records the design and scope; `RULES_SUMMARY.md` and `docs/protocol/BASE_1.md` record the user's accepted base-1 conventions. Do not describe it as a shared-device game or treat project conventions as publisher verification. Distinguish implemented foundation features from future gameplay.

Write design documents as standalone designs for Deep Sea. Explain decisions from this game's needs; omit reviews of reference projects, comparisons, and the history of how a decision was reached.

Follow `E2E_GUIDE.md` for browser tests: no explicit waits, masking, pixel tolerance, retries, skipped/focused tests, or per-test timeout overrides. Use the shared test fixture and TestSteps helper. Review generated screenshots and walkthroughs, then run normal verification before committing. Run tools through the Nix flake.

Keep the guide's enforcement map and negative regression tests aligned with every E2E rule. Do not weaken the configuration contract or source guards to pass a test. Record exact baseline hashes and specific visual review notes in `E2E_REVIEWS.json`; automated updates must not fabricate review attestations. Stage all non-ignored changes before committing so the hook verifies the same files as the commit.

Record every user prompt concerning this project verbatim in `PROMPTS.md`, including corrections and follow-up requests. Append each prompt once, in conversation order, under the next `## Prompt N: Summary` heading. Give each new prompt a 2–3 word summary, for example `## Prompt 8: Write Prompt Summaries`, followed by a blank line and the verbatim prompt. Preserve spelling, punctuation, capitalization, and line breaks in the prompt body. Leave historical headings unchanged. Do not include assistant messages or automatically supplied environment context.

Update the log before doing other project work for each new prompt. Never rewrite or remove existing entries, and never invent or duplicate a prompt to satisfy a hook. Stage the new entries with the related work when committing.

The Husky pre-commit hook requires a nonempty prompt entry appended to the staged log in every commit, including the initial commit. It checks Git's index, not merely the working file. It cannot access the conversation or prove that every prompt was copied accurately. If one prompt's work spans multiple commits, consolidate that work into one commit instead of fabricating an entry.
