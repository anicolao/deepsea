<script lang="ts">
  import Diver from "./Diver.svelte";
  import History from "./History.svelte";
  import { playerView, finalResults } from "$lib/game/engine";
  import type { Room } from "$lib/game/protocol";
  export let room: Room;
  export let uid: string;
  export let enabled: boolean;
  export let playAgain: () => Promise<void>;
  export let act: (
    type: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  let projectedDive = room.dive;
  let view = playerView(room.dive!);
  let result = finalResults(room.dive!);
  $: if (room.dive !== projectedDive) {
    projectedDive = room.dive;
    view = playerView(room.dive!);
    result = finalResults(room.dive!);
  }
  $: current = view.reviews.at(-1)!;
  $: owner = view.cleanup[0];
  $: mine = owner === uid;
  $: lost = view.divers.find((p) => p.uid === owner)?.cargo ?? [];
  let history: HTMLDialogElement;
  let historyOpen = false;
  let order: string[] = [],
    revision = "";
  $: if (revision !== room.lastActionId) {
    revision = room.lastActionId;
    order = lost.map((u) => u.id);
  }
  const name = (id: string) =>
    room.members.find((m) => m.uid === id)?.name ?? "";
  function move(id: string, offset: number) {
    const index = order.indexOf(id),
      next = [...order];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    order = next;
  }
</script>

<div
  class="review"
  class:full-results={view.stage === "finished" && view.divers.length > 4}
>
  <header aria-live="polite" aria-atomic="true">
    <p class="eyebrow">BACK AT THE SURFACE · DIVE {view.number} OF 3</p>
    <h1>
      {view.stage === "finished"
        ? "Game complete"
        : view.stage === "cleanup"
          ? "Treasure left behind"
          : `Dive ${view.number} complete`}
    </h1>
    <p>
      {view.stage === "finished"
        ? "After 3 dives"
        : "Previously saved treasure stays safe."}
    </p>
  </header>
  <section class="report" data-game-path aria-label="Dive results">
    {#if view.stage === "finished"}<svg
        class="trophy"
        viewBox="0 0 100 100"
        aria-hidden="true"
        ><path d="M28 13h44v24c0 22-44 22-44 0Z" fill="#efba43" /><path
          d="M28 20H14c0 22 8 25 19 25M72 20h14c0 22-8 25-19 25"
          fill="none"
          stroke="#e8a529"
          stroke-width="6"
        /><path
          d="M50 53v22M35 83h30M40 75h20"
          stroke="#d99a22"
          stroke-width="9"
        /><path d="M36 20v14" stroke="#ffe29a" stroke-width="5" /></svg
      >
      <h2 class="winner" aria-live="polite">
        {result.winners.map(name).join(" & ")}
        {result.winners.length === 1 ? "wins!" : "share victory!"}
      </h2>
      <p>
        {result.tiebreak
          ? "Tied on points. Saved level IV tiles break the tie."
          : result.winners.length > 1
            ? "Equal points and equal saved level IV tiles. A shared victory."
            : "The most treasure points after three dives."}
      </p>
      <table>
        <caption>Final scores · three dives</caption><thead
          ><tr
            ><th scope="col">Diver</th><th scope="col">1</th><th scope="col"
              >2</th
            ><th scope="col">3</th><th scope="col">Total</th></tr
          ></thead
        ><tbody
          >{#each result.rows as p}<tr
              ><th scope="row"
                ><span class="player-name"
                  ><Diver
                    seat={room.members.find((m) => m.uid === p.uid)?.seat}
                  /><span>{name(p.uid)}{p.uid === uid ? " (You)" : ""}</span
                  ></span
                ></th
              >{#each p.dives as score}<td>{score}</td>{/each}<td
                ><strong>{p.points}</strong></td
              ></tr
            >{/each}</tbody
        >
      </table>
      <p>
        Level IV tiles saved: {result.rows
          .map((p) => name(p.uid) + " " + p.levelFour)
          .join(" · ")}.
      </p>
    {:else if view.stage === "cleanup" && mine}
      <h2>Choose the order of your lost treasure</h2>
      <p>
        Place units from first to last. Each group of up to three becomes one
        stack at the deep end. Existing stacks stay whole.
      </p>
      <ol aria-label="Lost treasure order">
        {#each order as id, index}<li>
            <div class="lost-unit">
              <span class="concealed-gem" aria-hidden="true">◇</span><strong
                >Unit {lost.findIndex((u) => u.id === id) + 1}</strong
              ><span
                >Level {lost.find((u) => u.id === id)?.levels.join(", ")} · {lost.find(
                  (u) => u.id === id,
                )?.count}
                {lost.find((u) => u.id === id)?.count === 1
                  ? "tile"
                  : "tiles"}</span
              ><small
                >Stack {Math.floor(index / 3) + 1} · position {(index % 3) +
                  1}</small
              >
            </div>
            <button
              disabled={!enabled || index === 0}
              on:click={() => move(id, -1)}
              aria-label={`Move unit ${lost.findIndex((u) => u.id === id) + 1} earlier`}
              >↑ Earlier</button
            ><button
              disabled={!enabled || index === order.length - 1}
              on:click={() => move(id, 1)}
              aria-label={`Move unit ${lost.findIndex((u) => u.id === id) + 1} later`}
              >↓ Later</button
            >
          </li>{/each}
      </ol>
    {:else if view.stage === "cleanup"}<h2>
        Waiting for {name(owner)} to order lost treasure
      </h2>
      <p>
        The next dive begins after the lost cargo has been placed. Your friend
        keeps this choice if they reconnect.
      </p>
    {:else}<h2>Your crew’s haul</h2>
      <table>
        <caption>Dive {view.number} results</caption><thead
          ><tr
            ><th scope="col">Diver</th><th scope="col">This dive</th><th
              scope="col">Total</th
            ></tr
          ></thead
        ><tbody
          >{#each current.players as p}<tr
              ><th scope="row"
                ><span class="player-name"
                  ><Diver
                    seat={room.members.find((m) => m.uid === p.uid)?.seat}
                  /><span>{name(p.uid)}{p.uid === uid ? " (You)" : ""}</span
                  ></span
                ><small class:lost={!p.returned}
                  >{p.returned ? "Returned" : "Treasure lost"}</small
                ></th
              ><td>{p.gained.reduce((sum, t) => sum + t.value, 0)}</td><td
                >{p.total}</td
              ></tr
            >{/each}</tbody
        >
      </table>
      {#each current.players.filter((p) => p.gained.length) as p}<details>
          <summary>{name(p.uid)}’s saved treasure</summary>
          <div class="revealed-coins">
            {#each p.gained as t}<span
                aria-label={"Level " + t.level + ": " + t.value + " points"}
                >{t.value}</span
              >{/each}
          </div>
        </details>{/each}
    {/if}
  </section>
  <section class="actions" data-game-actions aria-label="After the dive">
    {#if view.stage === "finished"}<button
        class="primary"
        disabled={!enabled}
        on:click={playAgain}>Play again</button
      >
      <p>A fresh room and invite. Your friends join when they’re ready.</p>
    {:else if view.stage === "cleanup" && mine}<p>
        The first unit cannot move earlier; the last cannot move later.
      </p>
      <button
        class="primary"
        disabled={!enabled}
        on:click={() =>
          act("dive/ordered", { order, expectedActionId: room.lastActionId })}
        >Confirm order</button
      >
    {:else if view.stage === "cleanup"}<p>
        Waiting for {name(owner)}. Treasure values stay concealed.
      </p>
    {:else}<h2>{name(view.nextStarter!)} starts the next dive</h2>
      <p>Take a breath. Your crew’s scores are saved.</p>
      <button
        class="primary"
        disabled={!enabled}
        on:click={() =>
          act("dive/continued", { expectedActionId: room.lastActionId })}
        >Continue to dive {view.number + 1}</button
      >{/if}
    {#if view.stage !== "cleanup"}<button
        class="history-button"
        on:click={() => {
          historyOpen = true;
          history.showModal();
        }}>View game history</button
      >{/if}
  </section>
</div>

<dialog
  class="history-dialog"
  bind:this={history}
  aria-label="Game history"
  on:close={() => (historyOpen = false)}
>
  <h2>Game history</h2>
  <div class="history-body" data-game-path>
    {#if historyOpen}<History {room} />{/if}
  </div>
  <button on:click={() => history.close()}>Back to results</button>
</dialog>

<style>
  .review {
    width: 100%;
    max-width: 760px;
    margin: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f8f4eb;
    color: #102f46;
    border-radius: 24px;
    overflow: hidden;
    border: 2px solid #658da1;
    box-shadow: 0 0 0 4px #113b51;
  }
  header {
    text-align: center;
    padding: 22px 24px 12px;
    flex-shrink: 0;
  }
  .eyebrow {
    color: #557482;
    font-size: 11px;
    letter-spacing: 2px;
    margin: 0 0 8px;
  }
  h1 {
    font-size: 32px;
    margin: 4px 0 10px;
  }
  h2 {
    font-size: 23px;
    margin: 8px 0;
  }
  p {
    line-height: 1.4;
    margin: 10px 0;
  }
  .report {
    min-height: 0;
    overflow-y: auto;
    flex: 1;
    padding: 8px 24px 18px;
  }
  .report > h2 {
    text-align: center;
  }
  .report > p {
    font-size: 14px;
    text-align: center;
  }
  .trophy {
    display: block;
    width: 95px;
    height: 95px;
    margin: 0 auto;
  }
  .winner {
    font-size: 30px;
  }
  .actions {
    padding: 16px 24px 20px;
    flex-shrink: 0;
    border-top: 1px solid #d4dad1;
  }
  .actions h2 {
    font-size: 19px;
    background: #dcebf0;
    border-radius: 10px;
    padding: 10px;
    margin: 0 0 8px;
  }
  .actions p {
    font-size: 13px;
    text-align: center;
    margin: 6px 0;
  }
  .primary {
    width: 100%;
    background: #087d8b;
    color: white;
    border-color: #087d8b;
    font-weight: bold;
    min-height: 50px;
  }
  button,
  summary {
    font: inherit;
    min-height: 44px;
  }
  button {
    border: 1px solid #93abb4;
    border-radius: 10px;
    padding: 9px 12px;
    background: #e6eeea;
    color: #0b6072;
    cursor: pointer;
  }
  button:disabled {
    background: #c5d2d2;
    color: #4a6670;
    cursor: default;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
    border: 1px solid #cfd7d3;
    border-radius: 12px;
  }
  caption {
    text-align: left;
    font-size: 14px;
    color: #496573;
    padding: 0 0 9px;
  }
  th,
  td {
    padding: 12px 10px;
    border-bottom: 1px solid #d3dbd7;
  }
  thead th {
    font-size: 14px;
    font-weight: normal;
    background: #edf0ea;
  }
  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }
  td {
    font-size: 23px;
  }
  th {
    overflow-wrap: anywhere;
  }
  th small {
    display: block;
    color: #087584;
    font-size: 13px;
    font-weight: normal;
    margin: 5px 0 0 44px;
  }
  .player-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .player-name > span {
    min-width: 0;
  }
  details {
    border-bottom: 1px solid #d4dad1;
    padding: 6px 0;
  }
  summary {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: bold;
    font-size: 15px;
  }
  summary::after {
    content: "+";
    margin-left: auto;
  }
  details[open] > summary::after {
    content: "−";
  }
  .revealed-coins {
    display: flex;
    gap: 10px;
    padding: 10px;
  }
  .revealed-coins > span {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 3px solid #ebc270;
    background: #ffd676;
    box-shadow: inset 0 0 0 2px #ffebaf;
    font-size: 24px;
    font-weight: bold;
  }
  ol {
    list-style: none;
    padding: 0;
    margin: 10px 0;
  }
  li {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #cfd7d3;
  }
  li > div {
    flex: 1;
  }
  li span,
  li small {
    display: block;
    font-size: 13px;
    margin-top: 4px;
  }
  .lost-unit {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 3px 10px;
  }
  .lost-unit .concealed-gem {
    grid-row: 1/4;
    background: #12364b;
    border: 2px solid #638495;
    border-radius: 7px;
    color: #bdd7d7;
    display: grid;
    place-items: center;
    font-size: 32px;
    margin: 0;
  }
  .lost-unit strong {
    font-size: 15px;
  }
  @media (max-width: 700px) {
    .review {
      border: 0;
      border-radius: 18px 18px 0 0;
      box-shadow: none;
    }
    header {
      padding: 16px 18px 8px;
    }
    h1 {
      font-size: 28px;
    }
    header p:not(.eyebrow) {
      font-size: 14px;
      margin: 7px 0;
    }
    .report {
      padding: 8px 16px 12px;
    }
    .actions {
      padding: 12px 16px 16px;
    }
    th,
    td {
      padding: 12px 6px;
    }
    thead th {
      font-size: 12px;
    }
    td {
      font-size: 20px;
    }
    .player-name {
      gap: 5px;
      font-size: 14px;
    }
    th small {
      margin-left: 0;
      font-size: 12px;
    }
    .trophy {
      width: 80px;
      height: 80px;
    }
    .winner {
      font-size: 27px;
    }
    li {
      flex-wrap: wrap;
    }
    .lost-unit {
      min-width: 100%;
    }
    li button {
      flex: 1;
    }
    .actions h2 {
      font-size: 17px;
    }
  }
  .history-button {
    width: 100%;
    margin-top: 10px;
    background: transparent;
  }
  .history-dialog {
    background: #f8f4eb;
    color: #102f46;
    max-width: 540px;
    width: calc(100% - 32px);
    max-height: calc(100dvh - 40px);
    padding: 24px;
    border: 1px solid #7b9ca9;
    border-radius: 18px;
  }
  .history-dialog[open] {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .history-body {
    min-height: 0;
    overflow-y: auto;
  }
  .history-dialog > button {
    flex-shrink: 0;
  }
  th small.lost {
    color: #ad3042;
  }
  .full-results header {
    padding: 12px 24px 4px;
  }
  .full-results header h1 {
    font-size: 27px;
    margin: 3px 0;
  }
  .full-results header p {
    margin: 4px 0;
  }
  .full-results .trophy {
    height: 44px;
  }
  .full-results .winner {
    font-size: 23px;
    margin: 6px 0;
  }
  .full-results .report > p {
    margin: 6px 0;
    font-size: 13px;
  }
  .full-results th,
  .full-results td {
    padding: 5px 6px;
  }
  .full-results td {
    font-size: 19px;
  }
</style>
