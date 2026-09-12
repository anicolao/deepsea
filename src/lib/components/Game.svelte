<script lang="ts">
  import History from "./History.svelte";
  import Dice from "./Dice.svelte";
  import { afterUpdate } from "svelte";
  import { base } from "$app/paths";
  import { playerView } from "$lib/game/engine";
  import type { Room } from "$lib/game/protocol";
  export let room: Room;
  export let uid: string;
  export let enabled: boolean;
  export let connected = true;
  export let act: (
    type: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  let locatedRoll = "";
  afterUpdate(() => {
    if (
      view.roll?.uid === uid &&
      view.phase === "landing" &&
      view.active === uid &&
      room.lastActionId !== locatedRoll
    ) {
      locatedRoll = room.lastActionId;
      locate(view.roll.to);
    }
  });
  let direction = "out",
    selected = "",
    revision = "";
  let help: HTMLDialogElement, helpButton: HTMLButtonElement;
  let panel: HTMLDialogElement,
    panelTrigger: HTMLButtonElement,
    panelKind: "crew" | "history" = "crew";
  function inspect(kind: "crew" | "history", trigger: HTMLButtonElement) {
    panelKind = kind;
    panelTrigger = trigger;
    panel.showModal();
  }
  $: view = playerView(room.dive!);
  $: me = view.divers.find((d) => d.uid === uid)!;
  $: active = view.divers.find((d) => d.uid === view.active)!;
  $: mine = view.active === uid;
  $: if (revision !== room.lastActionId) {
    revision = room.lastActionId;
    direction = me.direction;
    selected = "";
  }
  const name = (id: string) =>
    room.members.find((m) => m.uid === id)?.name ?? "";
  const symbol = (id: string) =>
    String(room.members.find((m) => m.uid === id)?.seat ?? 1) + " ·";
  function send(type: string, payload: Record<string, unknown>) {
    return act(type, { ...payload, expectedActionId: room.lastActionId });
  }
  let path: HTMLDivElement,
    anchor = 0;
  function locate(position: number) {
    anchor = position;
    const target = document.getElementById(`space-${position}`);
    if (!path || !target) return;
    path.scrollTo({
      top:
        path.scrollTop +
        target.getBoundingClientRect().top -
        path.getBoundingClientRect().top -
        (path.clientHeight - target.getBoundingClientRect().height) / 2,
      behavior: "instant",
    });
  }
  function keepAnchor(node: HTMLDivElement) {
    path = node;
    anchor = me.position;
    const observer = new ResizeObserver(() => locate(anchor));
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
</script>

<div class="game">
  <header aria-live="polite" aria-atomic="true">
    <div>
      <p class="eyebrow">DEEP SEA · DIVE {view.number} OF 3</p>
      <h1>{mine ? "Your turn" : `${name(view.active)}’s turn`}</h1>
    </div>
    <div class="oxygen">
      <span>{connected ? "Oxygen" : "Last known oxygen"}</span><strong
        >{Math.max(0, view.oxygen)} <small>/ 25</small></strong
      >
    </div>
  </header>
  <div
    class="meter"
    role="meter"
    aria-label="Shared oxygen"
    aria-valuenow={Math.max(0, view.oxygen)}
    aria-valuemin="0"
    aria-valuemax="25"
  >
    <span style={`width:${Math.max(0, view.oxygen) * 4}%`}></span>
  </div>
  <div class="board-grid">
    <section
      class="sea"
      aria-label="Ocean path"
      style={`background-image:url(${base}/art/ocean.png);background-size:cover`}
    >
      <nav aria-label="Find your way">
        <button on:click={() => locate(me.position)}>Find my diver</button
        ><button on:click={() => locate(0)}>Show submarine</button>
      </nav>
      <!-- A named scroll region needs keyboard focus for native arrow-key scrolling. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="path"
        use:keepAnchor
        data-game-path
        role="region"
        tabindex="0"
        aria-label="Scrollable treasure path"
      >
        <div class="submarine" id="space-0">
          <svg viewBox="0 0 160 70" width="120" height="53" aria-hidden="true"
            ><path
              d="M24 25h92a20 20 0 0 1 0 40H24a20 20 0 0 1 0-40M60 25V12h28v13M73 12V3h22"
              fill="#edcc61"
              stroke="#edcc61"
              stroke-width="5"
            /><circle cx="37" cy="45" r="10" fill="#163e4a" /><circle
              cx="72"
              cy="45"
              r="10"
              fill="#163e4a"
            /><circle cx="107" cy="45" r="10" fill="#163e4a" /></svg
          ><strong>Submarine</strong><span
            >{view.divers
              .filter((d) => d.position === 0)
              .map((d) => `${symbol(d.uid)} ${name(d.uid)}`)
              .join(" · ")}</span
          >
        </div>
        <ol>
          {#each view.path as unit, i}<li
              id={`space-${i + 1}`}
              class:occupied={view.divers.some((d) => d.position === i + 1)}
            >
              <span class="depth">{String(i + 1).padStart(2, "0")}</span>
              <div
                class="treasure"
                class:blank={!unit}
                style={`--level:${unit?.levels[0] ?? 0}`}
                aria-label={unit
                  ? `Space ${i + 1}, concealed level ${unit.levels.join(", ")} treasure, ${unit.count} tiles`
                  : `Space ${i + 1}, empty`}
              >
                <svg
                  viewBox="0 0 32 32"
                  width="30"
                  height="30"
                  aria-hidden="true"
                  >{#if unit}<polygon
                      points={[
                        "",
                        "16,2 30,28 2,28",
                        "4,4 28,4 28,28 4,28",
                        "16,2 30,12 25,29 7,29 2,12",
                        "9,3 23,3 31,16 23,29 9,29 1,16",
                      ][unit.levels[0]]}
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    />{:else}<circle
                      cx="16"
                      cy="16"
                      r="12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    />{/if}</svg
                >{#if unit}<small
                    >{unit.count > 1
                      ? `${unit.count} tiles`
                      : ["", "I", "II", "III", "IV"][unit.levels[0]]}</small
                  >{/if}
              </div>
              <div class="divers">
                {#each view.divers.filter((d) => d.position === i + 1) as diver}<strong
                    >{symbol(diver.uid)}
                    {name(diver.uid)}<small
                      >{diver.direction === "home"
                        ? "↑ Returning"
                        : "↓ Diving"}</small
                    ></strong
                  >{/each}
              </div>
            </li>{/each}
        </ol>
        <p class="seabed">THE DEEP · What will you bring home?</p>
      </div>
    </section>
    <aside>
      <section class="action" data-game-actions aria-label="Your move">
        {#if view.oxygen <= 0}<strong>Last turn of this dive</strong>
          <p>Finish your move and landing choice.</p>
        {:else}<p class="eyebrow">
            {mine ? "YOUR MOVE" : "FOLLOW THE DIVE"}
          </p>{/if}
        {#if mine && view.phase === "roll"}
          {#if me.status === "aboard"}<h2>
              Diving out
            </h2>{:else if me.direction === "home"}<h2>
              Returning to the submarine
            </h2>{:else}<fieldset disabled={!enabled}>
              <legend>Which way?</legend><label
                ><input type="radio" bind:group={direction} value="out" /> Keep diving</label
              ><label
                ><input type="radio" bind:group={direction} value="home" /> Turn
                back</label
              >
            </fieldset>{/if}
          <p>
            After your turn cost: <strong
              >{Math.max(0, view.oxygen - me.cargo.length)} / 25</strong
            >
          </p>
          <button
            class="primary"
            disabled={!enabled}
            on:click={() => send("turn/rolled", { direction })}
            >Roll dice</button
          >
        {:else if mine}
          <h2>
            {view.path[me.position - 1]
              ? "A little deeper, a little richer?"
              : "An empty space"}
          </h2>
          {#if view.roll}<Dice faces={view.roll.faces} />
            <p class="dice">
              Dice: {view.roll.faces.join(" + ")} − {me.cargo.length} cargo = {view
                .roll.movement} spaces
            </p>{/if}
          {#if view.roll?.movement === 0}<p>
              Your cargo prevents movement.
            </p>{/if}
          {#if view.path[me.position - 1]}<p>
              Pickup adds one carried unit to future turns.
            </p>
            <button
              class="primary"
              disabled={!enabled}
              on:click={() => send("turn/landed", { choice: "pickup" })}
              >Pick up treasure</button
            >
          {:else if me.cargo.length}<label for="drop">Choose a whole unit</label
            ><select id="drop" bind:value={selected}
              ><option value="">Select treasure</option
              >{#each me.cargo as unit, i}<option value={unit.id}
                  >Unit {i + 1} · {unit.count}
                  {unit.count === 1 ? "tile" : "tiles"} · level {unit.levels.join(
                    ", ",
                  )}</option
                >{/each}</select
            ><button
              class="primary"
              disabled={!enabled || !selected}
              on:click={() =>
                send("turn/landed", { choice: "drop", unitId: selected })}
              >Drop selected treasure</button
            >
          {:else}<p>Nothing to pick up or drop here.</p>{/if}
          <button
            disabled={!enabled}
            on:click={() => send("turn/landed", { choice: "pass" })}
            >{view.path[me.position - 1] || me.cargo.length
              ? "Leave it"
              : "End turn"}</button
          >
        {:else}<h2>
            {me.status === "returned"
              ? "Back aboard"
              : `${name(active.uid)} is ${view.phase === "roll" ? "choosing a direction" : "choosing treasure"}`}
          </h2>
          <p>
            {me.status === "returned"
              ? "Your dive is complete. Follow your friends home."
              : "Watch the shared path. Your turn follows the crew order."}
          </p>{/if}
      </section>
      <div class="tools">
        <button on:click={(event) => inspect("crew", event.currentTarget)}
          >Crew & cargo · {me.cargo.length} carried {me.cargo.length === 1
            ? "unit"
            : "units"}</button
        ><button on:click={(event) => inspect("history", event.currentTarget)}
          >History</button
        >
      </div>
      <button bind:this={helpButton} on:click={() => help.showModal()}
        >How to play</button
      >
    </aside>
  </div>
</div>
<dialog
  class="inspection"
  bind:this={panel}
  aria-labelledby="panel-title"
  on:close={() => panelTrigger?.focus()}
>
  <h2 id="panel-title">
    {panelKind === "crew" ? "Your crew & cargo" : "Game history"}
  </h2>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="inspection-body"
    data-game-path
    role="region"
    tabindex="0"
    aria-label={panelKind === "crew"
      ? "Crew and concealed cargo"
      : "Saved dives and moves"}
  >
    {#if panelKind === "crew"}<ul aria-label="Crew">
        {#each view.divers as d}<li>
            <button
              class="find-diver"
              aria-label={`Find ${name(d.uid)}`}
              on:click={() => {
                panel.close();
                locate(d.position);
              }}
              >{symbol(d.uid)}
              {name(d.uid)}{d.uid === uid ? " (You)" : ""}</button
            ><span
              >{d.status === "underwater"
                ? d.direction === "home"
                  ? "Returning"
                  : "Diving"
                : d.status === "returned"
                  ? "Returned"
                  : "Aboard"} · {d.cargo.length}
              {d.cargo.length === 1 ? "unit" : "units"} · {d.points} saved points</span
            >{#if d.cargo.length}<p>
                {d.cargo
                  .map(
                    (unit, i) =>
                      "Unit " +
                      (i + 1) +
                      ": " +
                      unit.count +
                      (unit.count === 1 ? " tile, level " : " tiles, level ") +
                      unit.levels.join(", "),
                  )
                  .join(" · ")}
              </p>{/if}
          </li>{/each}
      </ul>
      <p>
        A stack is one carried unit, however many tiles it holds. Each unit
        costs one oxygen and one movement.
      </p>
      <p>
        If a friend cannot return, their seat and turn stay theirs. You can
        start another room together from Deep Sea.
      </p>
    {:else}<History {room} />{/if}
  </div>
  <button on:click={() => panel.close()}>Back to the dive</button>
</dialog>
<dialog
  aria-labelledby="help-title"
  bind:this={help}
  on:close={() => helpButton.focus()}
>
  <h2 id="help-title">One ocean. One oxygen tank.</h2>
  <p>
    Take turns in crew order. Choose your direction, then roll two dice.
    Subtract your carried units from movement and shared oxygen. Swim past
    occupied spaces without counting them.
  </p>
  <p>
    Pick up concealed treasure, leave it, or drop one whole unit on an empty
    space. Once you turn back, keep heading home. Reach the submarine to save
    your treasure.
  </p>
  <p>
    Oxygen changes only on turns. When it runs out, finish that turn, then
    treasure still underwater is lost. After three dives, the most points wins.
    Ties use saved level IV tiles, then share victory.
  </p>
  <button on:click={() => help.close()}>Back to the dive</button>
</dialog>

<style>
  .game {
    width: 100%;
    max-width: 1180px;
    margin: auto;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  h1 {
    font-size: 30px;
    margin: 4px 0 12px;
  }
  h2 {
    font-size: 23px;
    margin: 8px 0;
  }
  .eyebrow {
    font-size: 12px;
    letter-spacing: 2px;
    color: #b0eee0;
    margin: 4px 0;
  }
  .oxygen {
    display: grid;
    text-align: right;
  }
  .oxygen strong {
    font-size: 32px;
  }
  .oxygen small {
    font-size: 16px;
    color: #bdcece;
  }
  .meter {
    height: 5px;
    background: #34515a;
    margin: 0 0 16px;
  }
  .meter span {
    display: block;
    height: 100%;
    background: #b0eee0;
  }
  .board-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 24px;
  }
  .sea {
    min-width: 0;
    border: 1px solid #497074;
    background: linear-gradient(#153e4b, #071e2a);
  }
  nav {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    gap: 8px;
  }
  .path {
    height: calc(100dvh - 330px);
    min-height: 260px;
    overflow-y: auto;
    padding: 12px 24px;
    scrollbar-color: #779c9a #071e2a;
  }
  .submarine {
    display: grid;
    justify-items: center;
    gap: 5px;
    padding-bottom: 24px;
  }
  .submarine span {
    font-size: 14px;
    text-align: center;
  }
  ol {
    list-style: none;
    margin: 0 auto;
    padding: 0;
    max-width: 360px;
  }
  ol li {
    display: flex;
    gap: 16px;
    align-items: center;
    min-height: 85px;
    position: relative;
  }
  ol li:before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 66px;
    border-left: 2px dashed #497074;
    z-index: 0;
  }
  .depth {
    color: #b6c9ce;
    font-size: 12px;
    width: 26px;
  }
  .treasure {
    position: relative;
    background: #e8dfba;
    color: #123640;
    width: 56px;
    height: 58px;
    display: grid;
    place-content: center;
    text-align: center;
    border: 3px solid #b0eee0;
    flex-shrink: 0;
  }
  .treasure small {
    font-weight: bold;
    font-size: 12px;
  }
  .blank {
    background: #102e3c;
    border: 2px dashed #779c9a;
    color: #b0eee0;
  }
  .divers strong {
    display: grid;
    gap: 4px;
    background: #071e2a;
    padding: 6px;
    border-radius: 0;
  }
  .divers small {
    color: #b0eee0;
    font-size: 13px;
  }
  .find-diver {
    text-align: left;
    font-weight: bold;
  }
  .occupied .treasure {
    box-shadow: 0 0 0 4px #edcc61;
  }
  .seabed {
    font-size: 12px;
    text-align: center;
    color: #bdcece;
    padding: 24px 0;
  }
  aside {
    min-width: 0;
  }
  .action {
    padding: 18px;
    background: #12313d;
    border: 1px solid #497074;
    margin-bottom: 12px;
  }
  p {
    line-height: 1.4;
  }
  button,
  select {
    font: inherit;
    min-height: 44px;
  }
  button {
    border: 1px solid #779c9a;
    background: #173e49;
    color: #f5f1dc;
    padding: 10px 14px;
    cursor: pointer;
  }
  button.primary {
    background: #edcc61;
    color: #10242d;
    border-color: #edcc61;
    font-weight: bold;
  }
  .action button {
    width: 100%;
    margin: 5px 0;
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    font-size: 23px;
    font-weight: bold;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  input {
    accent-color: #edcc61;
  }
  select {
    width: 100%;
    background: #071e2a;
    color: #f5f1dc;
  }
  ul {
    padding: 0;
    list-style: none;
  }
  ul li {
    display: grid;
    gap: 4px;
    padding: 8px 0;
    border-bottom: 1px solid #497074;
  }
  li span {
    font-size: 14px;
  }
  dialog {
    background: #12313d;
    color: #f5f1dc;
    border: 1px solid #b0eee0;
    max-width: 480px;
    width: calc(100% - 32px);
    padding: 24px;
  }
  dialog::backdrop {
    background: #02121ce6;
  }
  @media (max-width: 700px) {
    header h1 {
      font-size: 24px;
    }
    .oxygen strong {
      font-size: 26px;
    }
    .board-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .path {
      height: 260px;
      min-height: 0;
      padding: 12px 20px;
    }
    .action {
      padding: 12px;
    }
    .action h2 {
      font-size: 20px;
    }
    .action p {
      margin: 8px 0;
      font-size: 14px;
    }
    .action button {
      margin: 3px 0;
    }
    .eyebrow {
      font-size: 10px;
    }
    .meter {
      margin-bottom: 10px;
    }
    nav {
      padding: 4px;
    }
    nav button {
      font-size: 14px;
      padding: 8px;
    }
    aside > button {
      width: 100%;
    }
  }
  .tools {
    display: flex;
    gap: 8px;
    margin: 12px 0;
  }
  .tools button:first-child {
    flex: 1;
    text-align: left;
  }
  .tools button {
    font-size: 14px;
  }
  .inspection {
    max-height: calc(100dvh - 40px);
  }
  .inspection[open] {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .inspection-body {
    overflow-y: auto;
    min-height: 0;
  }
  .inspection > button {
    flex-shrink: 0;
  }
  .inspection p {
    font-size: 15px;
  }
  .treasure svg {
    margin: auto;
  }
  .divers {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  header > div:first-child {
    min-width: 0;
  }
  h1 {
    overflow-wrap: anywhere;
  }
  @media (prefers-reduced-motion: no-preference) {
    .occupied .treasure {
      animation: arrive 0.25s ease-out;
    }
    @keyframes arrive {
      from {
        transform: scale(0.9);
      }
      to {
        transform: scale(1);
      }
    }
  }
  .game {
    height: calc(100dvh - 132px);
    display: flex;
    flex-direction: column;
  }
  .board-grid {
    flex: 1;
    min-height: 0;
  }
  .sea {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .path {
    flex: 1;
    height: auto;
    min-height: 0;
  }
  @media (max-width: 700px) {
    .board-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
    }
    .game {
      height: calc(100dvh - 132px);
    }
  }
  .sea,
  .action {
    border-radius: 0;
  }
  .sea {
    overflow: hidden;
  }
  button,
  select,
  dialog {
    border-radius: 0;
  }
  .meter {
    border-radius: 0;
    overflow: hidden;
  }
  .submarine span {
    background: #071e2a;
    padding: 6px 10px;
    border-radius: 0;
  }
  .depth {
    background: #071e2a;
    border-radius: 0;
    padding: 3px 0;
    text-align: center;
    flex-shrink: 0;
  }
</style>
