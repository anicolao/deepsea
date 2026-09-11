# Deep Sea Adventure — Rules Summary

This summary targets the base game for 2–6 players. Boost and expansion dice are excluded. Oink Games describes the original as a treasure hunt using two dice numbered 1–3 and a shared oxygen supply. [Publisher overview](https://oinkgames.com/en/games/analog/deep-sea-adventure/).

This is an implementation reference, not a replacement rulebook. The full English rules located during research are community transcriptions; important differences and provisional decisions are identified below. Sources reviewed on 2026-09-11.

## Setup and objective

Play three dives. Start each with every diver aboard and oxygen at 25. Only treasure brought back safely scores; previous dives' winnings remain banked.

There are 32 treasure tiles, eight per level, with two copies of each value:

| Level | Shape | Values |
| --- | --- | --- |
| 1 | Triangle | 0–3 |
| 2 | Square | 4–7 |
| 3 | Pentagon | 8–11 |
| 4 | Hexagon | 12–15 |

Shuffle each level separately, values hidden, and form one path from shallowest to deepest. Each die has faces 1, 1, 2, 2, 3, 3. The first player is the most recent swimmer; turns proceed clockwise. [Component and setup transcription](https://cdn.1j1ju.com/medias/57/db/4b-deep-sea-adventure-rulebook.pdf).

## Each turn

Skip divers who already returned. For an active diver:

1. **Breathe:** subtract carried treasure units from oxygen. If it reaches zero or less, finish this turn before ending the dive.
2. **Choose direction:** continue outward or turn home before rolling. Once homeward, stay homeward.
3. **Move:** roll both dice; subtract carried units, minimum zero. Skip occupied spaces without counting them. Stop at the path's end or submarine if movement would exceed it.
4. **Choose one:** leave the space unchanged; collect its treasure and replace it with a blank; or, on a blank, replace it with one carried unit. Keep collected values hidden, including from yourself.

Returning to the submarine ends that diver's participation in this dive. Banked treasure causes no oxygen or movement penalty. [Turn-sequence reference](https://www.ultraboardgames.com/deep-sea-adventure/game-rules.php).

Treasure can also be collected while returning home. [Oink Games FAQ, Japanese](https://oinkgms.zendesk.com/hc/ja/articles/900000690946).

## Ending a dive

End after the oxygen-exhausting turn, or once everyone is safely aboard. Successful divers reveal and retain their treasure; stranded divers lose everything carried during this dive.

Process stranded divers from deepest to shallowest. Append lost treasure at the deep end in groups of three, with a smaller final group if necessary. Owners choose the ordering of their lost treasure. A recovered stack acts as one unit for carrying, movement, and oxygen; its constituent values all contribute to scoring. Remove blank spaces and close the path's gaps for the next dive. [Round-resolution account](https://whatsericplaying.com/2018/04/30/deep-sea-adventure/).

For the next starter, use the deepest stranded diver, or the last successful returner if everyone returned. After dive three, compare total banked points; ties compare recovered level-4 tiles, then remain a shared victory. [Compact rules reference](https://www.scribd.com/document/985853487/English-Rules-Deep-Sea-Adventure-Box-Sized-Rules).

## Source discrepancies

The 2015 transcription linked above is **not an official manual**. Its author explicitly identifies two departures: it reverses the stranded-diver drop order, and its treasure requirement for turning home became outdated. This project permits turning home without treasure after leaving the submarine and uses deepest-first drops. Do not copy the transcription's exceptions into the engine. [Author's corrections](https://games.everybookinchina.com/deepsea.php).

The compact reference specifies level-4 tiles for ties, whereas the older transcription says “high-level” tiles. Level-4 count is the proposed baseline; verify it against the physical base-game rulebook before declaring rules parity.

## Explicit MVP conventions to verify

The available references do not resolve every engine edge case precisely. These are proposed deterministic conventions, not claims of publisher clarification:

- If the deepest space is occupied, an outward overshoot stops at the deepest available space reachable without passing the path's end; if none exists, remain in place.
- A previously formed treasure stack remains indivisible, including when lost again. Group up to three carried units together; the resulting stack can contain more than three original tiles.
- If no treasure remains on the path between dives, resolve the remaining dives with no additional points instead of creating an unplayable board.

Confirm these conventions and the starter/tie rules against a publisher-issued base-game rulebook before implementing the affected cases. Record any resulting correction here and in the rules fixtures. The web-specific room, identity, and disconnection policies belong in [MVP_DESIGN.md](MVP_DESIGN.md).
