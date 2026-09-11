<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/400.css';
  import '@fontsource/atkinson-hyperlegible/700.css';
  import Review from '$lib/components/Review.svelte';
  import Game from '$lib/components/Game.svelte';
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { replaceState } from '$app/navigation';
  import { selectConfig, type DeploymentConfig } from '$lib/backend/config';
  import { connectBackend } from '$lib/backend/firebase';
  import { RoomRepository, type RoomState } from '$lib/backend/repository';
  let name = '', error = '', roomId = '', setupId = '', uid = '', starter = '', invite = '';
  let mounted = false;
  let connected = false, busy = false, online = true, copied = false, closing = false, left = false;
  let state: RoomState | null = null;
  let repository: RoomRepository;
  let initialSeed: number | undefined;
  let unsubscribe = () => {};
  $: room = state?.room;
  $: me = room?.members.find(m => m.uid === uid);
  $: host = room?.hostUid === uid;
  $: enabled = connected && online && !busy && !state?.blocked && (!roomId || !!state?.synchronized) && !state?.pending;
  $: reason = !room || room.members.length < 2 ? 'Invite at least one friend to start.' : !room.members.every(m => m.ready) ? 'Everyone must be ready to start.' : 'Your crew is ready.';
  $: if (room && !room.members.some(m => m.uid === starter)) starter = room.hostUid;
  function failure(_value: unknown) { error = 'We couldn’t confirm that move. Check your connection, then try again.'; }
  function observe(id: string, setup = false) {
    unsubscribe(); roomId = setup ? '' : id;
    unsubscribe = repository.watch(id, next => {
      connected = next.synchronized;
      if (!setup || roomId) state = next;
      if (next.error) error = next.error.includes('before your action') ? 'The game changed before your move arrived. Review the current turn.' : next.blocked ? 'This saved game needs an update. Reload, or create another room.' : 'We couldn’t confirm your last move. Check your connection, then retry.';
    });
  }
  onMount(() => {
    roomId = new URL(location.href).searchParams.get('room') ?? '';
    name = new URL(location.href).searchParams.get('name')?.slice(0,40) ?? '';
    mounted = true;
    let disposed = false;
    let close = async () => {};
    const connectivity = () => { online = navigator.onLine; };
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity); connectivity();
    void (async () => {
      try {
        const response = await fetch(`${base}/backend.json`);
        if (!response.ok) throw new Error('Room setup is not configured on this deployment.');
        const config = selectConfig(await response.json() as DeploymentConfig, new URL(location.href));
        initialSeed = config.initialSeed;
        const backend = await connectBackend(config); close = backend.close;
        if (disposed) { await close(); return; }
        uid = backend.uid;
        repository = new RoomRepository(backend.transport, localStorage, uid, crypto.randomUUID(), `${config.projectId}-${config.namespace ?? 'local'}`);
        const id = new URL(location.href).searchParams.get('room');
        if (id) {
          if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('This room link is invalid.');
          observe(id);
        } else {
          setupId = crypto.randomUUID();
          observe(setupId, true);
        }
      } catch (e) { failure(e); }
    })();
    return () => { disposed = true; unsubscribe(); window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); void close(); };
  });
  async function create() {
    if (!enabled) return;
    busy = true; error = '';
    try {
      const id = setupId, pending = repository.prepareCreation(id, name);
      roomId = id;
      replaceState(`${base}/rooms/?room=${id}`, {});
      await repository.submit(pending);
    } catch (e) { failure(e); } finally { busy = false; }
  }
  async function act(type: string, payload: Record<string, unknown>) {
    if (!enabled) return;
    busy = true; error = '';
    try { await repository.submit(repository.prepareAction(roomId, type, payload)); if (type === 'lobby/left') left = true; }
    catch (e) { failure(e); } finally { busy = false; }
  }
  async function start() {
    if (!room) return;
    await act('game/started', { starterUid: starter, seed: initialSeed ?? crypto.getRandomValues(new Uint32Array(1))[0], expectedActionId: room.lastActionId });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(location.href); copied = true; }
    catch { invite = location.href; }
  }
  async function playAgain() {
    if (!enabled || !me) return;
    const localName = me.name;
    busy = true; error = ''; copied = false; invite = ''; left = false; closing = false;
    try {
      const id = crypto.randomUUID(), pending = repository.prepareCreation(id, localName);
      state = null; observe(id); replaceState(`${base}/rooms/?room=${id}`, {});
      await repository.submit(pending);
    } catch (e) { failure(e); } finally { busy = false; }
  }
  async function retry() {
    if (busy || !online || !state?.synchronized || state.blocked) return;
    busy = true; error = '';
    try { const pending = repository.pending(roomId); if (pending) await repository.submit(pending); }
    catch (e) { failure(e); } finally { busy = false; }
  }
</script>
<svelte:head><title>Deep Sea — Gather your crew</title><meta name="description" content="Invite friends, ready up, and start a Deep Sea room together." /></svelte:head>
<main class:playing={room?.phase === 'started' && !!me}>
  <a class="back" href={`${base}/`}>← Deep Sea</a>
  {#if room?.phase !== 'started' || !me}<h1>{room?.phase === 'started' && me ? 'Dive 1 is ready' : 'Gather your crew'}</h1>{/if}
  <p role="status" class="status">{!online ? 'Offline — reconnect to make changes.' : state?.blocked ? 'This room needs a different app version.' : !connected || (roomId && !state?.synchronized) ? 'Connecting…' : busy || state?.pending ? 'Confirming your action…' : 'Connected'}</p>
  {#if error && !(room?.members.length === 6 && !me)}<p role="alert" class="notice">{error}</p>{/if}
  {#if !mounted}<p>Preparing your room…</p>
  {:else if !roomId}
    <form on:submit|preventDefault={create}>
      <h2>Create a room</h2><p>Bring 2–6 friends, each on their own browser.</p>
      <label for="name">Your name</label><input id="name" bind:value={name} maxlength="40" autocomplete="nickname" required />
      <button disabled={!enabled || !name.trim()}>Create room</button>
    </form>
  {:else if room?.phase === 'closed'}
    <section><h2>Room closed</h2><p>The host left before the dive started.</p><a href={`${base}/rooms/`}>Create another room</a></section>
  {:else if room?.phase === 'started' && !me}
    <section><h2>This dive has already started</h2><p>The crew is fixed. Return using the browser you joined with. If its saved identity was cleared, you cannot reclaim that seat; ask your friends to start a new room.</p><a href={`${base}/rooms/`}>Create another room</a></section>
  {:else if room?.phase === 'started' && me && room.dive}{#if room.dive.stage === 'playing'}<Game {room} {uid} {enabled} connected={connected && online} {act} />{:else}<Review {room} {uid} {enabled} {act} {playAgain} />{/if}
  {:else if room}
    <section aria-label="Room lobby">
      <h2>{room.hostName}’s room</h2>
      <ul aria-label="Crew">{#each room.members as member}<li><span>{member.name}{member.uid === uid ? ' (You)' : ''}{member.uid === room.hostUid ? ' · Host' : ''}</span><strong>{room.phase === 'started' ? `Seat ${member.seat}` : member.ready ? 'Ready' : 'Not ready'}</strong></li>{/each}</ul>
      {#if me}
        <div class="actions"><button on:click={() => act('lobby/ready', { ready: !me?.ready, rosterRevision: room.rosterRevision })} disabled={!enabled}>{me.ready ? 'Not ready' : 'Ready up'}</button><button class="secondary" on:click={copy}>Copy invite</button></div>
        {#if copied}<p role="status">Invite copied</p>{/if}
        {#if invite}<label for="invite">Copy this invite link</label><input id="invite" readonly value={invite} on:focus={event => event.currentTarget.select()} />{/if}
        {#if host}
          <div class="start-row"><div><label for="starter">First diver</label><select id="starter" bind:value={starter} disabled={!enabled}>{#each room.members as member}<option value={member.uid}>{member.name}</option>{/each}</select></div><button on:click={start} disabled={!enabled || room.members.length < 2 || !room.members.every(m => m.ready)}>Start dive</button></div><p class="muted">{reason}</p>
        {:else}<p class="muted">{reason} {room.hostName} starts the dive.</p>{/if}
        {#if closing}<div role="group" aria-label="Confirm room closure"><p>Leaving closes this room for everyone.</p><div class="actions"><button on:click={() => act('lobby/left', {})} disabled={!enabled}>Close room</button><button class="secondary" on:click={() => closing = false}>Stay</button></div></div>
        {:else}<button class="quiet" disabled={!enabled} on:click={() => host ? closing = true : act('lobby/left', {})}>Leave room</button>{/if}
      {:else if room.members.length >= 6}<h3>Room full</h3><p>All six seats are taken.</p><a href={`${base}/rooms/`}>Create another room</a>
      {:else}<form class="join" on:submit|preventDefault={() => act('lobby/joined', { name: name.trim() })}>
        {#if left}<p>You left the room. You can join again while it is open.</p>{/if}
        <label for="name">Your name</label><input id="name" bind:value={name} maxlength="40" autocomplete="nickname" required /><button disabled={!enabled || !name.trim()}>Join room</button>
      </form>{/if}
    </section>
  {:else if state?.synchronized && !state.pending && !busy}<section><h2>Room not found</h2><p>Check the invite with your host.</p><a href={`${base}/rooms/`}>Create another room</a></section>{/if}
  {#if state?.pending && !state.blocked}<button on:click={retry} disabled={busy || !online || !state.synchronized}>Retry pending action</button>{/if}
  {#if state?.blocked}<button on:click={() => location.reload()}>Reload to update</button><a href={`${base}/rooms/`}>Create another room</a>{/if}
</main>
<style>
  :global(body) { margin: 0; background: #071e2a; color: #f5f1dc; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(*) { box-sizing: border-box; }
  main.playing { max-width: 1228px; height:100dvh; display:flex; flex-direction:column; }
  main.playing :global(.game), main.playing :global(.review) {height:auto;flex:1;min-height:0}
  .back,.status,.notice {flex-shrink:0}
  main { max-width: 650px; margin: 0 auto; padding: 16px 24px; }
  a { color: #b0eee0; display: inline-flex; align-items: center; min-height: 44px; }
  h1 { font-size: clamp(30px, 6vw, 42px); margin: 8px 0; } h2 { font-size: 25px; margin: 0 0 12px; } h3 { font-size: 20px; }
  p { line-height: 1.4; margin: 12px 0; } .status,.muted { color: #bdcece; }
  section,form { border: 1px solid #497074; padding: 20px; background: #102f3b; }
  form.join { border: 0; padding: 12px 0 0; }
  label { display: block; margin: 12px 0 6px; font-weight: 700; }
  input,select,button { font: inherit; min-height: 44px; border-radius: 8px; padding: 10px 12px; }
  input,select { width: 100%; border: 2px solid #779c9a; background: #071e2a; color: #f5f1dc; }
  button { margin-top: 12px; border: 0; background: #edcc61; color: #10242d; font-weight: 700; cursor: pointer; }
  button:disabled { opacity: .55; cursor: default; } .secondary { background: #b0eee0; } .quiet { background: transparent; color: #b0eee0; text-decoration: underline; }
  .actions { display: flex; gap: 12px; flex-wrap: wrap; }
  :global(:focus-visible) { outline: 3px solid #91f0d8; outline-offset: 4px; }
  ul { list-style: none; padding: 0; margin: 0; } li { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; border-bottom: 1px solid #497074; } li span { overflow-wrap: anywhere; } li strong { white-space: nowrap; font-size: 14px; color: #b0eee0; }
  .start-row {display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end}.start-row button{margin:0}.start-row select{min-width:0}
  .notice { border-left: 4px solid #edcc61; padding: 12px; background: #233642; }
</style>
