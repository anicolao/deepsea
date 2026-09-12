<script lang="ts">
  import Diver from "./Diver.svelte";
  import Submarine from "./Submarine.svelte";
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
  let projectedDive = room.dive;
  let view = playerView(room.dive!);
  $: if (room.dive !== projectedDive) {
    projectedDive = room.dive;
    view = playerView(room.dive!);
  }
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
  const x = (i: number) => [18, 36, 56, 74, 66, 46, 26, 14][i % 8];
  $: trail = view.path
    .map((_, i) =>
      i === 0
        ? `M ${x(i)} 36`
        : `C ${x(i - 1)} ${i * 82 - 5}, ${x(i)} ${i * 82 - 5}, ${x(i)} ${i * 82 + 36}`,
    )
    .join(" ");
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
    <a data-sveltekit-reload class="brand" href={base + "/"}>Deep Sea</a>
    <p class="dive-progress">
      Dive {view.number} of 3
      <span aria-hidden="true"
        >{#each [1, 2, 3] as n}<i class:current={n <= view.number}
          ></i>{/each}</span
      >
    </p>
    <h1>{mine ? "Your turn" : name(view.active) + "’s turn"}</h1>
  </header>
  <div class="board-grid" class:landing={mine && view.phase === "landing"}>
    <section class="oxygen-card" aria-label="Oxygen supply">
      <svg class="tank" viewBox="0 0 32 64" aria-hidden="true"
        ><path
          d="M11 4h10M16 4v8M10 12h12v5"
          fill="none"
          stroke="#12394d"
          stroke-width="4"
        /><rect
          x="6"
          y="17"
          width="22"
          height="43"
          rx="7"
          fill="#088796"
        /><path d="M11 25v27" stroke="#aee9e1" stroke-width="3" /></svg
      >
      <div>
        <div class="oxygen">
          <span>{connected ? "Oxygen" : "Last known oxygen"}</span><strong
            >{Math.max(0, view.oxygen)} <small>/ 25</small></strong
          >
        </div>
        <div
          class="meter"
          role="meter"
          aria-label="Shared oxygen"
          aria-valuenow={Math.max(0, view.oxygen)}
          aria-valuemin="0"
          aria-valuemax="25"
        >
          <span style={"width:" + Math.max(0, view.oxygen) * 4 + "%"}></span>
        </div>
        {#if mine && view.phase === "roll"}<p>
            After your turn cost: <strong
              >{Math.max(0, view.oxygen - me.cargo.length)} / 25</strong
            >
          </p>{/if}
      </div>
    </section>
    {#if mine && view.phase === "landing" && view.roll}<section
        class="roll-card"
      >
        <strong>Your roll</strong>
        <div class="roll-result">
          <Dice faces={view.roll.faces} />
          <p class="dice">
            Dice: {view.roll.faces.join(" + ")} − {me.cargo.length} cargo = {view
              .roll.movement} spaces
          </p>
        </div>
      </section>{/if}
    <section class="sea" aria-label="Ocean path">
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
        <div class="ocean-depths">
          <div class="ocean-art" aria-hidden="true">
            {#each ["shallows", "twilight", "abyss"] as zone}
              <div
                class={zone}
                style={`--ocean-image:url(${base}/art/ocean-${zone}.webp)`}
              ></div>
            {/each}
          </div>
          <div class="submarine" id="space-0">
            <div class="sub-art"><Submarine /></div>
            <strong>Submarine</strong><span
              >{view.divers
                .filter((d) => d.position === 0)
                .map((d) => `${symbol(d.uid)} ${name(d.uid)}`)
                .join(" · ")}</span
            >
          </div>
          <ol style={"height:" + (view.path.length * 82 + 70) + "px"}>
            <svg
              class="trail"
              viewBox={"0 0 100 " + (view.path.length * 82 + 70)}
              preserveAspectRatio="none"
              aria-hidden="true"
              ><path
                d={trail}
                fill="none"
                stroke="#b8d6cf"
                stroke-width="2"
                stroke-dasharray="2 2"
                vector-effect="non-scaling-stroke"
              /></svg
            >
            {#each view.path as unit, i}<li
                id={`space-${i + 1}`}
                style={"left:" + x(i) + "%;top:" + i * 82 + "px"}
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
                      class:long-name={name(diver.uid).length > 18}
                      ><Diver
                        seat={room.members.find((m) => m.uid === diver.uid)
                          ?.seat}
                      /><span>{symbol(diver.uid)} {name(diver.uid)}</span><small
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
      </div>
    </section>
    <aside>
      <section class="cargo-card" aria-label="Your concealed cargo">
        <h2>Your cargo</h2>
        <div class="cargo-units">
          {#each me.cargo as unit}<div
              class="cargo-unit"
              aria-label={"Concealed level " +
                unit.levels.join(", ") +
                ", " +
                unit.count +
                " tiles"}
            >
              <span aria-hidden="true">◇</span><small
                >{[...new Set(unit.levels)]
                  .map((level) => ["", "I", "II", "III", "IV"][level])
                  .join("·")}{unit.count > 1
                  ? " / " + unit.count + " tiles"
                  : ""}</small
              >
            </div>{:else}<p>Travel light. Bring treasure home.</p>{/each}
        </div>
        <p>
          {me.cargo.length}
          {me.cargo.length === 1 ? "unit" : "units"} · Values hidden
        </p>
      </section>
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
              <legend>Choose your direction</legend><label
                ><input
                  type="radio"
                  bind:group={direction}
                  value="out"
                  aria-label="Keep diving"
                /><span class="direction-icon" aria-hidden="true">↓</span> Keep diving</label
              ><label
                ><input
                  type="radio"
                  bind:group={direction}
                  value="home"
                  aria-label="Turn back"
                /><span class="direction-icon" aria-hidden="true">↑</span> Turn back</label
              >
            </fieldset>{/if}
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
            >{view.path[me.position - 1]
              ? "Leave it"
              : me.cargo.length
                ? "Keep treasure"
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
    </aside>
  </div>
  <footer class="game-footer">
    <nav class="crew-strip" aria-label="Crew positions">
      {#each view.divers as d}<button
          on:click={() => locate(d.position)}
          aria-label={"Locate " + name(d.uid)}
          ><Diver seat={room.members.find((m) => m.uid === d.uid)?.seat} /><span
            ><strong>{name(d.uid)}</strong><small
              >{d.cargo.length}
              {d.cargo.length === 1 ? "unit" : "units"} · {d.status ===
                "returned" || d.status === "aboard"
                ? "Aboard"
                : d.direction === "home"
                  ? "Returning"
                  : "Diving"}</small
            ></span
          ></button
        >{/each}
    </nav>
    <div class="tools">
      <button on:click={(event) => inspect("crew", event.currentTarget)}
        >Crew & cargo · {me.cargo.length} carried {me.cargo.length === 1
          ? "unit"
          : "units"}</button
      ><button on:click={(event) => inspect("history", event.currentTarget)}
        >History</button
      >
    </div>
    <button
      class="help-trigger"
      bind:this={helpButton}
      on:click={() => help.showModal()}>How to play</button
    >
  </footer>
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
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f4efe4;
    color: #102f46;
    border: 2px solid #577f95;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 0 0 5px #12384d;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 16px 24px;
    flex-shrink: 0;
    background: #f8f4eb;
  }
  header .brand {
    font-weight: bold;
    color: #102f46;
    text-decoration: none;
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: 32px;
  }
  h1 {
    font-size: 25px;
    color: #087584;
    margin: 0;
    overflow-wrap: anywhere;
    max-width: 45%;
  }
  h2 {
    font-size: 20px;
    margin: 0 0 10px;
  }
  .dive-progress {
    display: flex;
    align-items: center;
    gap: 16px;
    white-space: nowrap;
  }
  .dive-progress span {
    display: flex;
    gap: 7px;
  }
  .dive-progress i {
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #b8c7c5;
  }
  .dive-progress i.current {
    background: #0b94a0;
  }
  .board-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 335px;
    grid-template-rows: auto auto minmax(0, 1fr);
    background: #eee9de;
    gap: 12px;
    padding: 12px;
  }
  .sea {
    grid-column: 1;
    grid-row: 1/4;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    overflow: hidden;
    background: #083146;
  }
  .oxygen-card {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: #fffbf2;
    border: 1px solid #dddcd1;
    border-radius: 14px;
  }
  .oxygen-card > div {
    flex: 1;
  }
  .tank {
    width: 30px;
    height: 56px;
    flex-shrink: 0;
  }
  .oxygen {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-weight: bold;
    font-size: 22px;
  }
  .oxygen strong {
    white-space: nowrap;
  }
  .oxygen small {
    font-size: 17px;
  }
  .oxygen-card p {
    font-size: 14px;
    margin: 8px 0 0;
  }
  .meter {
    height: 13px;
    margin-top: 8px;
    background: #d4d8cd;
    overflow: hidden;
    border-radius: 10px;
  }
  .meter span {
    display: block;
    height: 100%;
    background: #0b8998;
  }
  .roll-card {
    grid-column: 2;
    grid-row: 2;
    padding: 12px;
    background: #fffbf2;
    border: 1px solid #dddcd1;
    border-radius: 14px;
  }
  .roll-result {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 8px;
  }
  .dice {
    font-weight: bold;
    font-size: 15px;
    line-height: 1.25;
    margin: 0;
  }
  .board-grid:not(.landing) aside {
    grid-row: 2/4;
  }
  aside {
    grid-column: 2;
    grid-row: 3;
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: 10px;
  }
  .cargo-card,
  .action {
    background: #fffbf2;
    border: 1px solid #dddcd1;
    border-radius: 14px;
    padding: 14px;
  }
  .cargo-card p {
    text-align: center;
    font-size: 14px;
    margin: 8px 0 0;
  }
  .cargo-units {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .cargo-unit {
    width: 48px;
    min-height: 57px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    background: #103349;
    color: #b3cbd0;
    border: 2px solid #41657a;
  }
  .cargo-unit > span {
    font-size: 30px;
    line-height: 1;
  }
  .cargo-unit small {
    font-size: 11px;
  }
  .cargo-units > p {
    color: #496573;
    margin: 5px 0;
  }
  .action {
    flex: 1;
  }
  .action p {
    font-size: 14px;
    margin: 8px 0;
    line-height: 1.3;
  }
  .eyebrow {
    font-size: 10px !important;
    letter-spacing: 1.5px;
    color: #486573;
    margin: 0 0 5px !important;
  }
  .action button {
    width: 100%;
    margin-top: 8px;
  }
  button,
  select {
    font: inherit;
    min-height: 44px;
    border: 1px solid #8ba7af;
    border-radius: 10px;
    padding: 9px 12px;
    background: #e9e6dd;
    color: #102f46;
    cursor: pointer;
  }
  button.primary {
    background: #087d8b;
    color: #fff;
    border-color: #087d8b;
    font-weight: bold;
  }
  button:disabled {
    background: #c6d2d3;
    color: #4b6472;
    border-color: #c6d2d3;
    cursor: default;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  legend {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
  }
  fieldset label {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 108px;
    gap: 4px;
    background: #ece8dd;
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 8px;
    font-weight: bold;
    cursor: pointer;
  }
  fieldset label:has(input:checked) {
    background: #c7e7df;
    border-color: #0796a3;
    color: #065f70;
  }
  fieldset input {
    position: absolute;
    left: 8px;
    top: 8px;
    accent-color: #087d8b;
  }
  .direction-icon {
    font-size: 42px;
    line-height: 1;
  }
  .action > label {
    display: block;
    margin: 8px 0;
  }
  .action select {
    width: 100%;
    background: #fffdf8;
  }
  .tools {
    display: flex;
    gap: 8px;
  }
  .tools button {
    font-size: 13px;
  }
  .tools button:first-child {
    flex: 1;
  }
  .help-trigger {
    font-size: 14px;
    background: transparent;
    border: 0;
    text-decoration: underline;
    color: #076679;
    padding: 4px;
  }
  .sea nav {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 8px;
    background: #083146bb;
  }
  .sea nav button {
    background: #0c344b;
    color: #e4f5ef;
    border: 1px solid #588899;
    font-size: 13px;
    padding: 6px 10px;
  }
  .path {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-color: #73aab6 #08283b;
    color: #f8f4eb;
  }
  .ocean-depths {
    padding: 10px 0;
    min-height: 100%;
    position: relative;
    isolation: isolate;
    background: linear-gradient(#08798c, #103e5b 33%, #06192e 66%, #020913);
  }
  .ocean-art {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    overflow: hidden;
  }
  .ocean-art > div {
    position: absolute;
    width: 100%;
    height: calc(100% / 3 + 1px);
    background-image: var(--fade), var(--ocean-image);
    background-size:
      100% 100%,
      cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .ocean-art > .shallows {
    top: 0;
    background-position: center top;
    --fade: linear-gradient(transparent 75%, #103e5b);
  }
  .ocean-art > .twilight {
    top: calc(100% / 3);
    --fade: linear-gradient(#103e5b, transparent 15%, transparent 85%, #06192e);
  }
  .ocean-art > .abyss {
    bottom: 0;
    background-position: center 65%;
    --fade: linear-gradient(#06192e, transparent 15%);
  }
  .submarine {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 12px 16px;
    text-align: center;
    gap: 4px;
  }
  .sub-art {
    width: 200px;
    height: 92px;
  }
  .submarine span {
    font-size: 13px;
    padding: 4px 8px;
    background: #0b3046;
    border-radius: 8px;
  }
  .submarine strong {
    font-size: 15px;
    padding: 2px 8px;
    border-radius: 6px;
    background: #0b3046;
  }
  ol {
    list-style: none;
    position: relative;
    margin: 0;
    padding: 0;
    width: 100%;
  }
  .trail {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  ol li {
    position: absolute;
    width: 120px;
    min-height: 74px;
    transform: translateX(-30px);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .depth {
    position: absolute;
    top: 2px;
    left: -19px;
    font-size: 10px;
    color: #c7deda;
    background: #0b3046;
    padding: 2px;
    border-radius: 4px;
  }
  .treasure {
    position: relative;
    flex-shrink: 0;
    width: 60px;
    height: 60px;
    display: grid;
    place-content: center;
    text-align: center;
    background: #123348;
    border: 3px solid #819da7;
    border-radius: 50%;
    color: #b6c8c9;
    box-shadow: 0 3px 0 #031b2b;
  }
  .treasure svg {
    margin: auto;
  }
  .treasure small {
    font-size: 11px;
    font-weight: bold;
  }
  .blank {
    width: 24px;
    height: 24px;
    margin: 18px;
    background: #b9cfca;
    border: 2px solid #dfebe5;
    box-shadow: none;
  }
  .blank svg {
    display: none;
  }
  .occupied .treasure {
    border-color: #ffdc80;
    box-shadow: 0 0 0 4px #d4a34177;
  }
  .divers {
    position: absolute;
    left: 46px;
    top: 0;
    min-width: 100px;
    max-width: 145px;
  }
  .divers strong {
    display: grid;
    grid-template-columns: 38px 1fr;
    align-items: center;
    gap: 3px 5px;
    font-size: 13px;
    background: #0b3046;
    border: 1px solid #5d929e;
    border-radius: 12px;
    padding: 4px;
    color: #fff8eb;
  }
  .divers strong > span {
    overflow-wrap: anywhere;
  }
  .divers small {
    grid-column: 1/3;
    text-align: center;
    color: #bae4dc;
    font-size: 11px;
  }
  .seabed {
    text-align: center;
    font-size: 11px;
    padding: 12px;
    color: #cee5e2;
  }
  .crew-strip {
    display: flex;
    gap: 0;
    padding: 10px 14px;
    flex-shrink: 0;
    background: #f8f4eb;
  }
  .crew-strip button {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    text-align: left;
    border: 0;
    border-right: 1px solid #d3d9d1;
    border-radius: 0;
    background: transparent;
    padding: 4px 12px;
  }
  .crew-strip button:last-child {
    border: 0;
  }
  .crew-strip span {
    min-width: 0;
  }
  .crew-strip strong {
    display: block;
    overflow-wrap: anywhere;
    font-size: 15px;
  }
  .crew-strip small {
    display: block;
    color: #496573;
    font-size: 12px;
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
  dialog {
    background: #f8f4eb;
    color: #102f46;
    border: 1px solid #bbcaca;
    border-radius: 20px;
    max-width: 520px;
    width: calc(100% - 32px);
    padding: 24px;
  }
  dialog p {
    line-height: 1.4;
  }
  dialog ul {
    list-style: none;
    padding: 0;
  }
  dialog li {
    padding: 10px 0;
    border-bottom: 1px solid #ccd5cd;
    display: grid;
    gap: 5px;
  }
  dialog li span {
    font-size: 14px;
  }
  dialog li p {
    font-size: 14px;
    margin: 4px 0;
  }
  .find-diver {
    text-align: left;
    font-weight: bold;
    background: #d6e9df;
    color: #086376;
  }
  dialog::backdrop {
    background: #031b2bba;
  }
  @media (max-width: 700px) {
    .game {
      border: 0;
      border-radius: 16px 16px 0 0;
      box-shadow: none;
    }
    header {
      padding: 8px 14px;
      gap: 10px;
    }
    header .brand {
      display: none;
    }
    h1 {
      font-size: 18px;
      max-width: 52%;
    }
    .dive-progress {
      font-size: 13px;
      gap: 7px;
      margin: 4px 0;
    }
    .dive-progress i {
      width: 10px;
      height: 10px;
    }
    .dive-progress span {
      gap: 4px;
    }
    .board-grid {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 8px;
    }
    .oxygen-card {
      order: 0;
      padding: 8px 12px;
      gap: 10px;
      border-radius: 12px;
    }
    .oxygen {
      font-size: 18px;
    }
    .oxygen small {
      font-size: 15px;
    }
    .oxygen-card p {
      font-size: 12px;
      margin: 3px 0 0;
    }
    .tank {
      width: 23px;
      height: 40px;
    }
    .meter {
      height: 10px;
      margin-top: 4px;
    }
    .roll-card {
      order: 1;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .roll-card > strong {
      font-size: 14px;
      white-space: nowrap;
    }
    .roll-result {
      margin: 0;
      flex: 1;
      gap: 8px;
    }
    .dice {
      font-size: 13px;
    }
    .sea {
      order: 2;
      flex: 1;
      min-height: 110px;
    }
    .sea nav {
      padding: 3px 6px;
    }
    .sea nav button {
      min-height: 44px;
      font-size: 12px;
      padding: 4px 8px;
    }
    .path {
      padding: 0;
    }
    .sub-art {
      height: 67px;
      width: 160px;
    }
    .submarine {
      gap: 0;
      padding-bottom: 8px;
    }
    .submarine strong {
      font-size: 13px;
    }
    .submarine span {
      font-size: 11px;
    }
    .treasure {
      width: 54px;
      height: 54px;
    }
    .blank {
      width: 24px;
      height: 24px;
      margin: 15px;
    }
    aside {
      display: contents;
    }
    .cargo-card {
      order: 3;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
    }
    .cargo-card h2 {
      font-size: 14px;
      margin: 0;
      white-space: nowrap;
    }
    .cargo-units {
      flex: 1;
      justify-content: flex-start;
      gap: 4px;
    }
    .cargo-unit {
      width: 30px;
      min-height: 36px;
      border-radius: 5px;
    }
    .cargo-unit > span {
      font-size: 20px;
    }
    .cargo-unit small {
      font-size: 9px;
    }
    .cargo-units > p {
      font-size: 12px;
      text-align: left;
    }
    .cargo-card > p {
      font-size: 12px;
      margin: 0;
      max-width: 86px;
    }
    .action {
      order: 4;
      flex: none;
      padding: 9px 12px;
    }
    .action h2 {
      font-size: 17px;
      margin: 2px 0 5px;
    }
    .action p {
      font-size: 12px;
      margin: 5px 0;
    }
    .action button {
      margin-top: 5px;
    }
    .action .eyebrow {
      display: none;
    }
    fieldset {
      gap: 7px;
    }
    legend {
      font-size: 16px;
      margin-bottom: 5px;
    }
    fieldset label {
      min-height: 50px;
      flex-direction: row;
      font-size: 14px;
      padding: 5px 5px 5px 23px;
    }
    .direction-icon {
      font-size: 24px;
    }
    fieldset input {
      left: 5px;
      top: 15px;
    }
    .tools {
      order: 5;
      gap: 6px;
    }
    .tools button {
      font-size: 12px;
      padding: 7px;
    }
    .help-trigger {
      order: 6;
      min-height: 44px;
      position: absolute;
      top: 0;
      right: 10px;
      color: #d9f0ee;
      font-size: 13px;
      padding: 6px 8px;
    }
    .crew-strip {
      display: none;
    }
    .divers {
      left: 43px;
      max-width: 124px;
    }
    .divers strong {
      font-size: 12px;
    }
    .submarine span {
      max-width: 90%;
    }
    .landing .action h2 {
      display: none;
    }
    .landing .action p {
      font-size: 12px;
    }
  }
  @media (max-width: 700px) {
    ol li {
      transform: translateX(-30px);
    }
    .divers {
      max-width: 105px;
      min-width: 95px;
    }
    .divers strong {
      font-size: 11px;
    }
  }
  @media (max-width: 700px) {
    ol li:nth-of-type(8n + 3) .divers,
    ol li:nth-of-type(8n + 4) .divers,
    ol li:nth-of-type(8n + 5) .divers {
      left: auto;
      right: 96px;
    }
  }
  .game-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    flex-shrink: 0;
    background: #f8f4eb;
  }
  .crew-strip {
    flex: 1;
    padding: 0;
  }
  .game-footer .tools {
    flex-shrink: 0;
  }
  .game-footer .help-trigger {
    flex-shrink: 0;
  }
  @media (max-width: 700px) {
    .game-footer {
      padding: 0 8px 8px;
    }
    .game-footer .tools {
      flex: 1;
    }
    .crew-strip {
      display: none;
    }
  }
  @media (min-width: 701px) {
    .crew-strip:has(button:nth-child(6)) {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
    }
  }
  .divers:has(.long-name) {
    width: 170px;
    max-width: 170px;
  }
  .divers .long-name {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 8px 10px 7px 24px;
    gap: 5px;
    text-align: center;
  }
  .long-name :global(.marker) {
    position: absolute;
    left: -16px;
    top: -14px;
  }
  .long-name > span {
    line-height: 1.25;
  }
  .long-name small {
    align-self: center;
  }
  @media (max-width: 700px) {
    .divers:has(.long-name) {
      width: 145px;
      max-width: 145px;
    }
  }
</style>
