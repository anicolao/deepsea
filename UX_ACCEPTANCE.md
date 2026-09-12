# MVP experience acceptance

This checklist maps UX_DESIGN.md to the implemented player experience. The canonical views are a 393 × 852 phone and a 1280 × 900 desktop. Exact screenshot hashes and state-specific visual inspection notes are in E2E_REVIEWS.json; generated walkthroughs link the images to semantic checks.

| Player journey | Evidence |
| --- | --- |
| Understand the game and create a room | [001 entry and brief](tests/e2e/001-coming-soon/README.md); keyboard focus returns when help closes |
| Share an invitation, join and ready a crew | [002 three-player setup](tests/e2e/002-room-foundation/README.md), [003 joining/leaving/late invitation](tests/e2e/003-two-player-start/README.md), [004 room closure](tests/e2e/004-closed-room/README.md) |
| Roll, choose treasure and follow a friend's turn | [005 complete turn](tests/e2e/005-multiplayer-turn/README.md); both clients assert confirmed state; reload preserves the roll; keyboard board navigation locates the submarine and diver |
| Complete an oxygen-exhausting turn and order lost treasure | [006 dive resolution](tests/e2e/006-dive-resolution/README.md); legal landing precedes cleanup; keyboard Earlier/Later controls and reconnect preserve ownership |
| Play three dives, read scores and start again | [007 complete game](tests/e2e/007-complete-game/README.md); the old result stays intact while friends join a fresh room |
| Play with six people and resolve shared winners | [008 six-player game](tests/e2e/008-six-player-game/README.md); all six independent clients verify the same three-dive result |
| Recover a lost reply, reconnect and use another tab | [009 recovery](tests/e2e/009-recovery/README.md); one accepted roll, stable oxygen, concealed cargo, disabled offline moves and restored seat |
| Handle a full room and identify six divers | [010 last seat and crew](tests/e2e/010-last-seat/README.md); one winning contender, a clear new-room route for the loser, and a six-person cargo inspector |
| Pick up and drop an entire stack | [011 whole stack](tests/e2e/011-whole-stack/README.md); a stack is created by actual lost treasure, collected on the next dive and dropped with keyboard controls; the other client sees both tiles together |
| Join by pasted invite and read help without losing a choice | [012 keyboard and help](tests/e2e/012-keyboard-and-help/README.md); long names, native form submission, direction radio, modal dismissal/focus restoration, concealed cargo and readable public history |

Rules tests additionally cover movement boundaries, zero movement, occupied spaces, returning direction, repeated stack loss, tile conservation, empty paths, next starter, level-IV tiebreaks and unresolved ties. Two hundred complete reducer games span two through six players and verify conservation after every accepted action. Repository and real emulator tests exercise ordering, attribution, immutable retries, stale conflicts, incompatible versions and denied writes.

## Visual and interaction review

The final board uses the original generated ocean illustration at `static/art/ocean.png`, original submarine and dice SVGs, and four distinct SVG treasure shapes with level labels. Diver names and seat numbers distinguish players without depending on color. Depth labels and diver names have solid dark backplates over the illustration. Hidden tile values and initialization seeds are absent from ordinary board, cargo, help and move-history text; successful returns reveal their saved values at review.

The board uses the available width consistently. The phone keeps turn, oxygen, legal actions, cargo/history and help accessible while the path scrolls. Find my diver and Show submarine move only the path; selecting a name in Crew & cargo closes the inspector and locates that friend. A resize preserves its current anchor, and confirmed own rolls center their landing. The six-person roster and long cargo/history lists use a named scrollable dialog, with a reachable close control. Dive results scroll independently from continuation or Play again. Crisp rectangular panels echo the treasure cards and avoid variable antialiased corner pixels in exact browser captures.

The screenshot helper checks viewport overflow, reachable game regions, overlapping controls and 44-pixel button targets. Keyboard scenarios exercise native forms, radios, selects, Earlier/Later, help, continuation and replay. Turn/oxygen, connection and result changes have polite live announcements; help restores focus and preserves a selected direction. Reduced motion removes the small arrival animation; confirmed dice and movement remain visible without animation.

Text contrast is calculated from the actual solid colors in Game.svelte, Review.svelte and the room stylesheet using relative sRGB luminance. Normal text in these pairs exceeds WCAG's 4.5:1 threshold. Disabled controls are visually distinct and have adjacent reasons; their reduced opacity is not used as an active text style. Text over the ocean uses the solid backplates described above. These measurements do not certify screen-reader behavior or all possible browser rendering.

| Text / background | Contrast |
| --- | --- |
| Ivory `#f5f1dc` / action navy `#12313d` | 12.07:1 |
| Navy `#12313d` / ivory results | 12.07:1 |
| Teal `#b0eee0` / action navy | 10.54:1 |
| Muted `#bdcece` / deep navy `#071e2a` | 10.49:1 |
| Button ink `#10242d` / gold `#edcc61` | 10.22:1 |
| Ivory / secondary button `#173e49` | 10.15:1 |
| Depth label `#b6c9ce` / deep navy backplate | 9.96:1 |

## Human review boundary

Automated phone and desktop browser contexts are independent clients using real UI actions. The deployed preview check repeats the journeys against the live preview project and checks the exact reviewed revision. These runs are not a claim of testing physical phones, all browser engines, assistive technology or touch ergonomics on hardware. Final human review should open a shared invitation on a separate phone and computer, play several turns and check the preferred screen reader if relevant.
