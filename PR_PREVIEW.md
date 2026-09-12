# Play and review a PR preview

Every PR must link its retained preview and pass `preview-smoke` on its exact head before review. Local emulator results alone do not qualify.

The complete MVP is at **https://anicolao.github.io/deepsea/pr6/**. It uses the dedicated `deepsea-preview-anicolao` Firebase project and `environments/pr6/` events. Open the URL in separate browser profiles or on separate devices to play as different people. Tabs in one profile intentionally share a seat.

Check that the current PR head has green `verify` and `preview-smoke` checks, then follow this journey:

1. Choose **Create room**, enter your name and create it. You appear as **You · Host**. Start is disabled with a reason until enough friends are ready.
2. **Copy invite** and open it in another browser or device. Your friend enters a name and joins. The home page also has **Join with invite** for pasting the complete link. Both players see the same crew; guests cannot start the room.
3. Invite up to six people. A roster change clears readiness. Ready everyone, choose the **First diver** as host, then **Start dive**.
4. The active player chooses a direction and **Roll dice**. First departure is outward; returning cannot reverse. Pick up treasure, leave it, or drop one whole carried unit on an empty space. Other players watch the same board and oxygen. Explore **Find my diver**, **Show submarine**, **Crew & cargo**, **History** and **How to play**.
5. Return to save treasure, or keep diving until oxygen is exhausted. The final player completes their landing choice before cleanup. If you lose several units, use **Earlier** and **Later** to order them, then **Confirm order**. Stacks remain whole and their values stay concealed.
6. Compare **This dive** with **Total**, inspect saved treasure and history, and **Continue to dive 2**. Any seated player can continue. Play three dives to see the winner, the three-dive breakdown and any tiebreak or shared victory.
7. Choose **Play again**. It creates a fresh room and invite with your name; friends join that new invitation. The original game's result remains intact at its old URL.

For recovery, reload after rolling and confirm that the dice, oxygen and seat remain the same. Open the room in a second tab in the same profile; both tabs represent you and cannot take two turns. Disconnect a browser during a landing choice: it labels oxygen as last known and disables moves. Reconnect and continue the same choice. A missing diver keeps their turn; time alone does not consume oxygen. If someone cannot return, the crew can start another room.

For edge states, open a started invitation in a fresh profile, try joining a full room, and create a separate unstarted room to exercise guest departure/rejoin and host closure. The host must confirm **Close room**, while **Stay** cancels it. The app explains lost identity or incompatible saved games and offers a new room or update without pretending to reclaim an active seat.

Clipboard fallback reveals a selectable invite when browser clipboard permission is unavailable. Invitations retain their complete PR path. Another PR and production use separate room namespaces or projects; keep the original invitation for the game you joined.

The [browser walkthroughs](tests/e2e/) cover these journeys with actual screenshots, including a complete two-player game, a complete six-player game, a seventh-person race for the last seat, whole-stack keyboard play and recovery faults. The hosted check creates fresh rooms through UI actions and verifies the deployed revision; it never inserts prepared page data. See [UX_ACCEPTANCE.md](UX_ACCEPTANCE.md) for visual and accessibility evidence and its human-review limits.

Backend setup, version compatibility, production isolation and rollback are documented in [OPERATIONS.md](OPERATIONS.md). Public Firebase configuration lives in `static/backend.json`; privileged credentials stay outside the repository.
