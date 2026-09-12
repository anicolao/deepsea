<script lang="ts">
  import type { Room } from "$lib/game/protocol";
  export let room: Room;
  const name = (uid: string) =>
    room.members.find((p) => p.uid === uid)?.name ?? "Diver";
</script>

<h3>Saved dives</h3>
{#if !room.dive!.reviews.length}<p>Your first dive is still underway.</p>{/if}
{#each room.dive!.reviews as review}
  <details>
    <summary>Dive {review.number}</summary>
    {#each review.players as player}<p>
        <strong>{name(player.uid)}</strong> · {player.returned
          ? "Returned"
          : "Treasure lost"} · {player.gained.reduce(
          (sum, t) => sum + t.value,
          0,
        )} points this dive · {player.total} total
      </p>
      {#if player.gained.length}<p>
          Saved treasure: {player.gained
            .map((tile) => `level ${tile.level}, ${tile.value} points`)
            .join(" · ")}
        </p>{/if}
    {/each}
  </details>
{/each}
<h3>Moves</h3>
<ol reversed>
  {#each [...room.dive!.history].reverse() as entry}<li>
      <small>Dive {entry.dive} · Turn {entry.turn}</small>
      <p><strong>{name(entry.uid)}</strong> · {entry.text}</p>
    </li>{/each}
</ol>

<style>
  h3 {
    font-size: 20px;
  }
  p {
    line-height: 1.4;
    margin: 6px 0;
  }
  small {
    color: #496573;
  }
  ol {
    list-style: none;
    padding: 0;
  }
  li {
    padding: 12px 0;
    border-bottom: 1px solid #497074;
  }
  summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-weight: bold;
    cursor: pointer;
  }
  summary::after {
    content: "+";
    margin-left: auto;
  }
  details[open] > summary::after {
    content: "-";
  }
</style>
