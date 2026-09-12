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
| Handle a full room and identify six divers | [010 last seat and crew](tests/e2e/010-last-seat/README.md); one winning contender, another-invite/new-room routes for the loser, all six ready with a copied invite, and a six-person cargo inspector |
| Pick up and drop an entire stack | [011 whole stack](tests/e2e/011-whole-stack/README.md); a stack is created by actual lost treasure, collected on the next dive and dropped with keyboard controls; the other client sees both tiles together |
| Join by pasted invite and read help without losing a choice | [012 keyboard and help](tests/e2e/012-keyboard-and-help/README.md); long names, native form submission, direction radio, modal dismissal/focus restoration, concealed cargo and readable public history |

Rules tests additionally cover movement boundaries, zero movement, occupied spaces, returning direction, repeated stack loss, tile conservation, empty paths, next starter, level-IV tiebreaks and unresolved ties. Two hundred complete reducer games span two through six players and verify conservation after every accepted action. Repository and real emulator tests exercise ordering, attribution, immutable retries, stale conflicts, incompatible versions and denied writes.

Live clients reuse an unchanged chronological event prefix so later turns do not repeatedly rebuild earlier dives. Projector tests compare every move of complete two- and six-player games with full replay, and cover late events, changed/deleted history, conflicting duplicates, rejected actions, version blocks and mutation isolation.

## Visual and interaction review

The reference is the three mockup sheets embedded in UX_DESIGN.md. The interface uses their ocean surround, rounded ivory surfaces, navy type, teal primary actions, colored diver markers and score hierarchy. The original ocean illustration and submarine/dice/treasure SVGs are reused throughout arrival, play and results. Player-facing information remains governed by the accepted rules, including full path length, concealed cargo and shared winners.

| Screen | Responsive design and review evidence |
| --- | --- |
| Arrival and pasted invitation | Illustrated title/submarine above the ivory name and invitation forms; one create action from home. [Arrival](tests/e2e/001-coming-soon/README.md) covers keyboard help and retained name. |
| Direct invitation and lobby | The invitation names the intended crew before joining. The lobby uses numbered colored markers, readiness pills, a copy-invite action, first-diver choice and explicit disabled-start reason. Six-person crews use compact rows without shrinking controls. [Invitation and lobby](tests/e2e/002-room-foundation/README.md), [full crew](tests/e2e/010-last-seat/README.md). |
| Direction, roll and landing | Desktop places the curved ocean path beside ivory oxygen, cargo and action cards, with crew and tools below. Phone places oxygen and confirmed dice above the independently scrolling path, then cargo and persistent actions. Direction tiles precede the teal roll button. [Turns](tests/e2e/005-multiplayer-turn/README.md), [direction and keyboard](tests/e2e/012-keyboard-and-help/README.md). |
| Reconnecting | An amber reconnecting banner preserves the last confirmed path, labels last-known oxygen and disables moves. [Recovery](tests/e2e/009-recovery/README.md). |
| Lost-treasure ordering | Concealed unit cards, stack positions and keyboard Earlier/Later controls sit in an ivory panel with a persistent confirm action. [Cleanup](tests/e2e/006-dive-resolution/README.md), [whole stacks](tests/e2e/011-whole-stack/README.md). |
| Dive review | Numbered diver rows distinguish returned/lost treasure, this-dive gains and totals. Returned treasure reveals coin values; the next starter and teal continuation remain visible. [Dive review](tests/e2e/006-dive-resolution/README.md). |
| Final result and history | The ivory scorecard presents a gold trophy, winner or shared victory and three-dive totals. Play again and game history remain available below; history opens a scrollable dialog. [Results and history](tests/e2e/007-complete-game/README.md), [six-player shared result](tests/e2e/008-six-player-game/README.md). |
| Help, cargo and failures | Help and inspectors use the same ivory/navy palette and restore focus. Closed, full and started rooms keep the illustrated room context and offer another room. [Keyboard and inspectors](tests/e2e/012-keyboard-and-help/README.md), [room closure](tests/e2e/004-closed-room/README.md). |

Find my diver and Show submarine move only the path. Selecting a crew member locates that diver without making a move. Distinct treasure outlines, level labels, seat numbers and player names supplement color. Unrevealed values remain absent from ordinary board, cargo, help and move history. Saved values are revealed only after a successful return.

The screenshot helper checks viewport overflow, reachable game regions, overlapping controls and 44-pixel button targets. Keyboard journeys cover entry, native radios and selects, ordering, help, history, continuation and replay. Turn/oxygen, connection and result changes have polite live announcements. Visual comparisons remain unmasked with zero pixel tolerance and no retries. The rendered interface is stable in reduced-motion mode.

Text contrast is calculated from solid sRGB palette pairs. These measurements complement visual inspection; they do not certify every rendering or assistive technology. Disabled actions retain adjacent explanations.

| Text / background | Contrast |
| --- | --- |
| Navy / ivory `#102f46` / `#f8f4eb` | 12.61:1 |
| White / primary teal `#ffffff` / `#087d8b` | 4.86:1 |
| Muted text / ivory `#496573` / `#f8f4eb` | 5.64:1 |
| Returned / ivory `#087584` / `#f8f4eb` | 4.92:1 |
| Lost / ivory `#ad3042` / `#f8f4eb` | 5.84:1 |
| Diver name / ocean backplate `#fff8eb` / `#0b3046` | 13.03:1 |

## Human review boundary

Automated phone and desktop browser contexts are independent clients using real UI actions. The deployed preview check repeats the journeys against the live preview project and checks the exact reviewed revision. These runs are not a claim of testing physical phones, all browser engines, assistive technology or touch ergonomics on hardware. Final human review should open a shared invitation on a separate phone and computer, play several turns and check the preferred screen reader if relevant.
