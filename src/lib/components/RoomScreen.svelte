<script lang="ts">
  import "@fontsource/atkinson-hyperlegible/400.css";
  import "@fontsource/atkinson-hyperlegible/700.css";
  import "./surface.css";
  import { createCodedRoom, invitationRoom } from "$lib/backend/room-code";
  import Submarine from "./Submarine.svelte";
  import Diver from "./Diver.svelte";
  let brief: HTMLDialogElement,
    closure: HTMLDialogElement,
    sharing: HTMLDialogElement;
  let codeCopied = false;
  import Review from "$lib/components/Review.svelte";
  import Game from "$lib/components/Game.svelte";
  import { onMount } from "svelte";
  import { base } from "$app/paths";
  import { replaceState } from "$app/navigation";
  import { selectConfig, type DeploymentConfig } from "$lib/backend/config";
  import { connectBackend } from "$lib/backend/firebase";
  import { RoomRepository, type RoomState } from "$lib/backend/repository";
  let name = "",
    error = "",
    roomId = "",
    uid = "",
    starter = "",
    invite = "";
  let mounted = false,
    joining = false,
    inviteInput = "";
  function openInvite() {
    try {
      const id = invitationRoom(inviteInput, location.origin, base);
      error = "";
      joining = false;
      observe(id);
      replaceState(base + "/rooms/?room=" + id, {});
    } catch {
      error =
        "Enter the five-letter room code or a complete invitation link from this table.";
    }
  }
  let connected = false,
    busy = false,
    online = true,
    copied = false,
    left = false;
  let state: RoomState | null = null;
  let repository: RoomRepository;
  let initialSeed: number | undefined;
  let unsubscribe = () => {};
  $: room = state?.room;
  $: if (room?.phase === "closed" && closure) closure.close();
  $: me = room?.members.find((m) => m.uid === uid);
  $: host = room?.hostUid === uid;
  $: enabled =
    connected &&
    online &&
    !busy &&
    !state?.blocked &&
    (!roomId || !!state?.synchronized) &&
    !state?.pending;
  $: reason =
    !room || room.members.length < 2
      ? "Invite at least one friend to start."
      : !room.members.every((m) => m.ready)
        ? "Everyone must be ready to start."
        : "Your crew is ready.";
  $: if (room && !room.members.some((m) => m.uid === starter))
    starter = room.hostUid;
  function failure(_value: unknown) {
    error = repository
      ? "We couldn’t confirm that move. Check your connection, then try again."
      : "We couldn’t connect to your crew. Check your connection, then reload.";
  }
  function observe(id: string) {
    unsubscribe();
    roomId = id;
    unsubscribe = repository.watch(id, (next) => {
      connected = next.synchronized;
      state = next;
      if (next.error)
        error = next.error.includes("before your action")
          ? "The game changed before your move arrived. Review the current turn."
          : next.blocked
            ? "This saved game needs an update. Reload, or create another room."
            : "We couldn’t confirm your last move. Check your connection, then retry.";
    });
  }
  onMount(() => {
    roomId = new URL(location.href).searchParams.get("room") ?? "";
    name = new URL(location.href).searchParams.get("name")?.slice(0, 40) ?? "";
    joining = new URL(location.href).searchParams.get("join") === "1";
    mounted = true;
    let disposed = false;
    let close = async () => {};
    const connectivity = () => {
      online = navigator.onLine;
    };
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    connectivity();
    void (async () => {
      try {
        const response = await fetch(`${base}/backend.json`);
        if (!response.ok)
          throw new Error("Room setup is not configured on this deployment.");
        const config = selectConfig(
          (await response.json()) as DeploymentConfig,
          new URL(location.href),
        );
        initialSeed = config.initialSeed;
        const backend = await connectBackend(config);
        close = backend.close;
        if (disposed) {
          await close();
          return;
        }
        uid = backend.uid;
        repository = new RoomRepository(
          backend.transport,
          localStorage,
          uid,
          crypto.randomUUID(),
          `${config.projectId}-${config.namespace ?? "local"}`,
        );
        const id = new URL(location.href).searchParams.get("room");
        if (id) {
          if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
            throw new Error("This room link is invalid.");
          observe(id);
        } else {
          connected = true;
        }
      } catch (e) {
        failure(e);
      }
    })();
    return () => {
      disposed = true;
      unsubscribe();
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      void close();
    };
  });
  async function create() {
    if (!enabled) return;
    busy = true;
    error = "";
    try {
      await createCodedRoom(repository, name, undefined, (id) => {
        observe(id);
        replaceState(base + "/rooms/?room=" + id, {});
      });
    } catch (e) {
      failure(e);
    } finally {
      busy = false;
    }
  }
  async function act(type: string, payload: Record<string, unknown>) {
    if (!enabled) return;
    busy = true;
    error = "";
    try {
      await repository.submit(repository.prepareAction(roomId, type, payload));
      if (type === "lobby/left") left = true;
    } catch (e) {
      failure(e);
    } finally {
      busy = false;
    }
  }
  async function start() {
    if (!room) return;
    await act("game/started", {
      starterUid: starter,
      seed: initialSeed ?? crypto.getRandomValues(new Uint32Array(1))[0],
      expectedActionId: room.lastActionId,
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
    } catch {
      invite = location.href;
    }
  }
  async function playAgain() {
    if (!enabled || !me) return;
    const localName = me.name;
    busy = true;
    error = "";
    copied = false;
    invite = "";
    left = false;
    closure.close();
    try {
      state = null;
      await createCodedRoom(repository, localName, undefined, (id) => {
        observe(id);
        replaceState(base + "/rooms/?room=" + id, {});
      });
    } catch (e) {
      failure(e);
    } finally {
      busy = false;
    }
  }
  async function retry() {
    if (busy || !online || !state?.synchronized || state.blocked) return;
    busy = true;
    error = "";
    try {
      const pending = repository.pending(roomId);
      if (pending) await repository.submit(pending);
    } catch (e) {
      failure(e);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title
    >{room?.phase === "started"
      ? room.dive?.stage === "finished"
        ? "Deep Sea — Final scores"
        : "Deep Sea — Dive " + room.dive?.number
      : "Deep Sea — Gather your crew"}</title
  ><meta
    name="description"
    content="Invite friends, ready up, and start a Deep Sea room together."
  /></svelte:head
>
<div
  class="ocean-surround"
  style={"background-image:linear-gradient(#06283c66,#031c30aa),url(" +
    base +
    "/art/ocean.webp)"}
  aria-hidden="true"
></div>
<main
  style={`--ocean: url(${base}/art/ocean.webp)`}
  class:playing={room?.phase === "started" && !!me}
>
  {#if room?.phase === "started" && me}<a
      data-sveltekit-reload
      class="back"
      href={base + "/"}>Deep Sea</a
    >{:else}<header
      class="arrival-header"
      style={"background-image:linear-gradient(#07273a33,#06283c88),url(" +
        base +
        "/art/ocean.webp)"}
    >
      <h1>{room ? "Your crew" : joining ? "Join your friends" : "Deep Sea"}</h1>
      <p>
        {room
          ? room.members.length + " of 6 players"
          : "DIVE TOGETHER. DISCOVER MORE."}
      </p>
      {#if !room && !joining}<div class="arrival-sub"><Submarine /></div>{/if}
    </header>{/if}
  <p
    role="status"
    class="status"
    class:pending-status={online &&
      connected &&
      !state?.blocked &&
      (busy || state?.pending)}
    class:quiet-status={online &&
      connected &&
      !busy &&
      !state?.pending &&
      !state?.blocked}
  >
    {!online
      ? "Reconnecting…"
      : state?.blocked
        ? "This room needs an update."
        : !connected || (roomId && !state?.synchronized)
          ? "Connecting…"
          : busy || state?.pending
            ? "Confirming your action…"
            : "Connected"}
  </p>
  {#if !online}<p class="reconnect-explanation">
      Your last confirmed board is shown. Moves resume when you reconnect.
    </p>{/if}
  {#if error && !(room?.members.length === 6 && !me)}<p
      role="alert"
      class="notice"
    >
      {error}
    </p>{/if}
  {#if !mounted}<p>Preparing your room…</p>
  {:else if !roomId && joining}
    <form on:submit|preventDefault={openInvite}>
      <h2>Join your friends</h2>
      <p>Enter the five-letter code your host shared.</p>
      <label for="invite-input">Room code or invite link</label><input
        id="invite-input"
        bind:value={inviteInput}
        type="text"
        autocapitalize="characters"
        spellcheck="false"
        required
      /><button disabled={!enabled || !inviteInput.trim()}>Find room</button>
      <p>
        <a data-sveltekit-reload href={base + "/rooms/"}
          >Create a room instead</a
        >
      </p>
    </form>
  {:else if !roomId}
    <div class="entry-card">
      <form on:submit|preventDefault={create}>
        <label for="name">Your name</label><input
          id="name"
          bind:value={name}
          maxlength="40"
          autocomplete="nickname"
          required
        />
        <button disabled={!enabled || !name.trim()}>Create room</button>
      </form>
      <div class="invite-divider">
        <a
          data-sveltekit-reload
          href="#home-invite"
          on:click={() => document.getElementById("home-invite")?.focus()}
          >Join with code</a
        >
      </div>
      <form class="paste-invite" on:submit|preventDefault={openInvite}>
        <label for="home-invite">Room code or invite link</label><input
          id="home-invite"
          type="text"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="Five letters, e.g. CORAL"
          bind:value={inviteInput}
          required
        /><button class="secondary" disabled={!enabled || !inviteInput.trim()}
          >Find room</button
        >
      </form>
      <button class="quiet" on:click={() => brief.showModal()}
        >How to play</button
      >
      <ul class="facts" aria-label="Game at a glance">
        <li>2–6 players</li>
        <li>Shared oxygen</li>
        <li>Three dives</li>
      </ul>
    </div>
  {:else if room?.phase === "closed"}
    <section>
      <h2>Room closed</h2>
      <p>The host left before the dive started.</p>
      <div class="invite-options">
        <a data-sveltekit-reload href={`${base}/rooms/?join=1`}
          >Try another invite</a
        ><a data-sveltekit-reload href={`${base}/rooms/`}>Create another room</a
        >
      </div>
    </section>
  {:else if room?.phase === "started" && !me}
    <section>
      <h2>This dive has already started</h2>
      <p>
        The crew is fixed. Return using the browser you joined with. If its
        saved identity was cleared, you cannot reclaim that seat; ask your
        friends to start a new room.
      </p>
      <div class="invite-options">
        <a data-sveltekit-reload href={`${base}/rooms/?join=1`}
          >Try another invite</a
        ><a data-sveltekit-reload href={`${base}/rooms/`}>Create another room</a
        >
      </div>
    </section>
  {:else if room?.phase === "started" && me && room.dive}{#if room.dive.stage === "playing"}<Game
        {room}
        {uid}
        {enabled}
        connected={connected && online}
        {act}
      />{:else}<Review {room} {uid} {enabled} {act} {playAgain} />{/if}
  {:else if room}
    <section class="lobby" aria-label="Room lobby">
      <h2 class="room-context">{room.hostName}’s room</h2>
      {#if me}<div class="actions share-actions">
          <button
            class="secondary"
            on:click={() => {
              codeCopied = false;
              sharing.showModal();
            }}>Room code</button
          ><button
            class="copy-invite secondary"
            aria-label="Copy invite"
            on:click={copy}
            ><span role="status"
              >{copied ? "Invite copied" : "Copy invite"}</span
            ></button
          >
        </div>{/if}
      <ul aria-label="Crew">
        {#each room.members as member}<li>
            <Diver seat={member.seat} />
            <span
              >{member.name}{member.uid === uid ? " (You)" : ""}{member.uid ===
              room.hostUid
                ? " · Host"
                : ""}</span
            ><strong class:ready={member.ready}
              >{room.phase === "started"
                ? `Seat ${member.seat}`
                : member.ready
                  ? "Ready"
                  : "Not ready"}</strong
            >
          </li>{/each}
      </ul>
      {#if me}
        {#if me.ready}<p class="ready-banner">✓ You are ready</p>{/if}
        <div class="actions readiness">
          <button
            on:click={() =>
              act("lobby/ready", {
                ready: !me?.ready,
                rosterRevision: room.rosterRevision,
              })}
            disabled={!enabled}>{me.ready ? "Not ready" : "Ready up"}</button
          >
        </div>
        {#if invite}<label for="invite">Copy this invite link</label><input
            id="invite"
            readonly
            value={invite}
            on:focus={(event) => event.currentTarget.select()}
          />{/if}
        {#if host}
          <div class="start-row">
            <div>
              <label for="starter">First diver</label><select
                id="starter"
                bind:value={starter}
                disabled={!enabled}
                >{#each room.members as member}<option value={member.uid}
                    >{member.name}</option
                  >{/each}</select
              >
            </div>
            <button
              on:click={start}
              disabled={!enabled ||
                room.members.length < 2 ||
                !room.members.every((m) => m.ready)}>Start dive</button
            >
          </div>
          <p class="muted swimming-rule">
            Choose whoever most recently swam in the sea.
          </p>
          <p class="muted">{reason}</p>
        {:else}<p class="muted">
            {reason}
            {room.hostName} starts the dive.
          </p>{/if}
        <button
          class="quiet"
          disabled={!enabled}
          on:click={() => (host ? closure.showModal() : act("lobby/left", {}))}
          >Leave room</button
        >
      {:else if room.members.length >= 6}<h3>Room full</h3>
        <p>All six seats are taken.</p>
        <div class="invite-options">
          <a data-sveltekit-reload href={`${base}/rooms/?join=1`}
            >Try another invite</a
          ><a data-sveltekit-reload href={`${base}/rooms/`}
            >Create another room</a
          >
        </div>
      {:else}<form
          class="join"
          on:submit|preventDefault={() =>
            act("lobby/joined", { name: name.trim() })}
        >
          {#if left}<p>
              You left the room. You can join again while it is open.
            </p>{/if}
          <label for="name">Your name</label><input
            id="name"
            bind:value={name}
            maxlength="40"
            autocomplete="nickname"
            required
          /><button disabled={!enabled || !name.trim()}>Join room</button>
        </form>{/if}
    </section>
  {:else if state?.synchronized && !state.pending && !busy}<section>
      <h2>Room not found</h2>
      <p>Check the invite with your host.</p>
      <div class="invite-options">
        <a data-sveltekit-reload href={`${base}/rooms/?join=1`}
          >Try another invite</a
        ><a data-sveltekit-reload href={`${base}/rooms/`}>Create another room</a
        >
      </div>
    </section>{/if}
  {#if state?.pending && !state.blocked && !busy}<button
      on:click={retry}
      disabled={busy || !online || !state.synchronized}>Retry move</button
    >{/if}
  {#if state?.blocked}<button on:click={() => location.reload()}
      >Reload to update</button
    ><a data-sveltekit-reload href={`${base}/rooms/`}>Create another room</a
    >{:else if error && !repository}<button on:click={() => location.reload()}
      >Reload</button
    >{/if}
</main>
<dialog bind:this={sharing} aria-labelledby="sharing-title">
  <h2 id="sharing-title">Invite your crew</h2>
  <p>Open Deep Sea on this table and choose Join with code.</p>
  <p class="room-code" aria-label="Room code">{roomId}</p>
  <button
    on:click={async () => {
      try {
        await navigator.clipboard.writeText(roomId);
        codeCopied = true;
      } catch {
        codeCopied = false;
      }
    }}>{codeCopied ? "Code copied" : "Copy room code"}</button
  >
  <form method="dialog"><button class="secondary">Back to crew</button></form>
</dialog>
<dialog bind:this={closure} aria-labelledby="close-title">
  <div role="group" aria-label="Confirm room closure">
    <h2 id="close-title">Leave your crew?</h2>
    <p>Leaving closes this room for everyone.</p>
    <div class="actions">
      <button
        on:click={async () => {
          await act("lobby/left", {});
          if (room?.phase === "closed") closure.close();
        }}
        disabled={!enabled}>Close room</button
      >
      <button class="secondary" on:click={() => closure.close()}>Stay</button>
    </div>
  </div>
</dialog>
<dialog bind:this={brief} aria-labelledby="brief-title">
  <h2 id="brief-title">One ocean. One oxygen tank.</h2>
  <p>
    Play with 2–6 friends. Choose a direction, roll two dice, and collect
    treasure or leave it. Carried units slow your movement and consume shared
    oxygen.
  </p>
  <p>
    Turn back in time: treasure only scores if you reach the submarine. Play
    three dives and bring home the greatest haul.
  </p>
  <form method="dialog"><button>Back to the surface</button></form>
</dialog>

<style>
  .room-code {
    font-size: 42px;
    letter-spacing: 0.15em;
    font-weight: bold;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .share-actions {
    margin-bottom: 8px;
  }
  .share-actions button {
    margin: 0;
  }
  .invite-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
  }
  .ocean-surround {
    position: fixed;
    inset: 0;
    z-index: -1;
    background-size: cover;
    background-position: center;
    pointer-events: none;
  }
  main {
    max-width: 480px;
    margin: 28px auto;
    background: #f8f4eb;
    border-radius: 28px;
    overflow: hidden;
    color: #102f46;
    box-shadow:
      0 0 0 3px #5687a3,
      0 20px 70px #00152288;
    position: relative;
  }
  .arrival-header {
    background-position: center 25%;
    background-size: cover;
    color: #fff8eb;
    text-align: center;
    padding: 32px 24px 18px;
  }
  h1 {
    font-size: 42px;
    margin: 4px 0;
  }
  .arrival-header p {
    margin: 8px 0;
    color: #bde7ee;
    letter-spacing: 2px;
    font-size: 13px;
  }
  main:has(.lobby li:nth-child(6)) .arrival-header {
    padding: 12px 24px 8px;
  }
  .arrival-sub {
    height: 135px;
    max-width: 320px;
    margin: auto;
  }
  main > section,
  main > form,
  .entry-card {
    padding: 22px 28px;
  }
  .entry-card {
    border-radius: 24px 24px 0 0;
    margin-top: -12px;
    position: relative;
    background: #f8f4eb;
  }
  form {
    margin: 0;
  }
  h2 {
    font-size: 25px;
    margin: 0 0 12px;
  }
  p {
    line-height: 1.4;
  }
  label {
    display: block;
    font-weight: bold;
    margin: 10px 0 6px;
  }
  input,
  select {
    width: 100%;
    min-height: 48px;
    padding: 10px 12px;
    border: 1px solid #95aebb;
    border-radius: 9px;
    background: #fffdfa;
    color: #102f46;
    font: inherit;
  }
  button {
    width: 100%;
    min-height: 48px;
    margin-top: 12px;
    padding: 10px 14px;
    background: #087d8b;
    color: white;
    border: 1px solid #087d8b;
    border-radius: 12px;
    font: inherit;
    font-weight: bold;
    cursor: pointer;
  }
  button:disabled {
    background: #c2d0d2;
    border-color: #c2d0d2;
    color: #476170;
    cursor: default;
  }
  .secondary {
    background: #d6e9df;
    color: #086376;
    border-color: #d6e9df;
  }
  .quiet {
    background: none;
    border: 0;
    color: #086376;
    text-decoration: underline;
    font-weight: normal;
  }
  a {
    color: #086376;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .invite-divider {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin: 8px 0;
  }
  .invite-divider:before,
  .invite-divider:after {
    content: "";
    height: 1px;
    background: #b9c8ca;
    flex: 1;
  }
  .facts {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: #496573;
    margin: 10px 0 0;
  }
  .facts li {
    white-space: nowrap;
  }
  .status {
    margin: 0;
    padding: 10px 20px;
    background: #ffe0a0;
    color: #15364b;
    text-align: center;
    font-size: 14px;
  }
  .quiet-status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    padding: 0;
  }
  .notice {
    padding: 12px;
    background: #ffe0a0;
    color: #15364b;
    margin: 0;
  }
  .room-context {
    font-size: 16px;
    font-weight: normal;
    text-align: center;
    color: #496573;
  }
  .lobby {
    border-radius: 24px 24px 0 0;
  }
  .copy-invite {
    margin: 0 0 8px;
  }
  .lobby ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .lobby li {
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #d7d9cf;
    min-height: 66px;
  }
  .lobby li > span {
    flex: 1;
    overflow-wrap: anywhere;
  }
  .lobby li > strong {
    font-size: 13px;
    background: #ffebbb;
    color: #855000;
    border-radius: 22px;
    padding: 8px 10px;
    white-space: nowrap;
  }
  .lobby li > strong.ready {
    background: #d8ecd3;
    color: #1c6532;
  }
  .ready-banner {
    background: #d6e9df;
    padding: 12px;
    text-align: center;
    color: #176448;
    border-radius: 12px;
    margin: 12px 0 0;
  }
  .start-row {
    margin-top: 12px;
  }
  .muted {
    color: #496573;
    font-size: 14px;
    text-align: center;
    margin: 8px 0;
  }
  .swimming-rule {
    font-size: 12px;
  }
  .actions {
    display: flex;
    gap: 10px;
  }
  .readiness button {
    background: transparent;
    color: #086376;
  }
  .join {
    padding-top: 12px;
  }
  .back {
    align-self: flex-start;
    padding: 0 22px;
    font-size: 27px;
    font-weight: bold;
    color: #fff8eb;
    text-decoration: none;
    min-height: 56px;
    background: transparent;
    flex-shrink: 0;
  }
  main.playing {
    max-width: 1220px;
    height: calc(100dvh - 40px);
    margin: 20px auto;
    display: flex;
    flex-direction: column;
    background: transparent;
    box-shadow: none;
    border-radius: 20px;
  }
  main.playing :global(.game),
  main.playing :global(.review) {
    flex: 1;
    min-height: 0;
    height: auto;
  }
  main.playing .status,
  main.playing .notice {
    flex-shrink: 0;
    border-radius: 10px 10px 0 0;
  }
  dialog {
    background: #f8f4eb;
    color: #102f46;
    border: 1px solid #bbcaca;
    border-radius: 20px;
    max-width: 480px;
    width: calc(100% - 32px);
    padding: 24px;
  }
  dialog::backdrop {
    background: #031b2bba;
  }
  @media (max-width: 700px) {
    main {
      margin: 12px auto;
      max-width: calc(100% - 24px);
      border-radius: 22px;
    }
    .arrival-header {
      padding: 22px 20px 12px;
    }
    h1 {
      font-size: 36px;
    }
    .arrival-sub {
      height: 112px;
    }
    .entry-card,
    main > section,
    main > form {
      padding: 18px 22px;
    }
    .lobby li {
      min-height: 59px;
    }
    .lobby li > strong {
      font-size: 12px;
      padding: 7px 9px;
    }
    .lobby li > span {
      font-size: 15px;
    }
    .room-context {
      margin-bottom: 8px;
    }
    .swimming-rule {
      margin: 5px 0;
    }
    main.playing {
      height: 100dvh;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
    }
    .back {
      min-height: 46px;
      font-size: 25px;
      padding: 0 16px;
    }
  }
  @media (max-width: 700px) {
    .lobby:has(li:nth-child(6)) {
      padding-top: 12px;
      padding-bottom: 12px;
    }
    .lobby:has(li:nth-child(6)) li {
      min-height: 48px;
    }
  }
  @media (min-width: 701px) {
    main.playing:has(:global(.game)) > .back {
      display: none;
    }
  }
  @media (max-width: 700px) {
    .lobby:has(li:nth-child(6)) .start-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: end;
    }
    .lobby:has(li:nth-child(6)) .start-row button {
      margin: 0;
      width: auto;
    }
  }
  .lobby:has(li:nth-child(6)) li {
    min-height: 48px;
  }
  .lobby:has(li:nth-child(6)) .ready-banner {
    padding: 6px;
    margin-top: 6px;
  }
  .lobby:has(li:nth-child(6)) > .quiet {
    margin-top: 0;
  }
  .lobby:has(li:nth-child(6)) .start-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
  }
  .lobby:has(li:nth-child(6)) .start-row button {
    margin: 0;
    width: auto;
  }
  .reconnect-explanation {
    background: #f8f4eb;
    color: #102f46;
    padding: 6px 14px;
    margin: 0;
    text-align: center;
    font-size: 12px;
    flex-shrink: 0;
  }
  .pending-status {
    position: absolute;
    top: 4px;
    right: 12px;
    max-width: 150px;
    padding: 4px 8px;
    background: #d6e9df;
    border-radius: 8px;
    z-index: 2;
    pointer-events: none;
    font-size: 12px;
  }
  @media (min-width: 701px) {
    main.playing:has(:global(.game)) .pending-status {
      top: 20px;
      left: 220px;
      right: auto;
    }
  }
  @media (max-width: 700px) {
    main.playing .pending-status {
      top: 5px;
      right: 114px;
      width: 128px;
    }
  }
</style>
