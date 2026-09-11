<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/400.css';
  import '@fontsource/atkinson-hyperlegible/700.css';
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { replaceState } from '$app/navigation';
  import { selectConfig, type DeploymentConfig } from '$lib/backend/config';
  import { connectBackend } from '$lib/backend/firebase';
  import { RoomRepository, type RoomState } from '$lib/backend/repository';
  let name = '';
  let ready = false;
  let busy = false;
  let message = 'Connecting…';
  let error = '';
  let roomId = '';
  let uid = '';
  let state: RoomState | null = null;
  let repository: RoomRepository;
  let unsubscribe = () => {};
  let online = true;
  function describeFailure(failure: unknown) {
    const text = failure instanceof Error ? failure.message : '';
    if (text.includes('collision')) return 'This room address is already in use. Open room setup again to create a new room.';
    return text.startsWith('Room setup') || text.startsWith('This room link') ? text : 'We could not confirm the room. Check your connection and try again.';
  }
  function observe(id: string) {
    unsubscribe();
    roomId = id;
    unsubscribe = repository.watch(id, (next) => {
      state = next;
      if (next.error) error = describeFailure(new Error(next.error));
      message = next.blocked ? 'This room needs a different app version. Reload to update.' : !next.synchronized ? next.room ? 'Reconnecting… Showing the last confirmed room.' : 'Connecting to room…' : next.room ? 'Room saved' : next.pending ? 'Saving room…' : 'Room not found';
    });
  }
  onMount(() => {
    let disposed = false;
    let close = async () => {};
    const connectivity = () => { online = navigator.onLine; };
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    connectivity();
    void (async () => {
      try {
        const response = await fetch(`${base}/backend.json`);
        if (!response.ok) throw new Error('Room setup is not available on this deployment yet.');
        const config = selectConfig(await response.json() as DeploymentConfig, new URL(location.href));
        const backend = await connectBackend(config);
        close = backend.close;
        if (disposed) { await close(); return; }
        uid = backend.uid;
        repository = new RoomRepository(backend.transport, localStorage, uid, crypto.randomUUID(), config.projectId);
        ready = true; message = 'Connected';
        const id = new URL(location.href).searchParams.get('room');
        if (id) {
          if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('This room link is invalid.');
          observe(id);
        }
      } catch (failure) { error = describeFailure(failure); }
    })();
    return () => { disposed = true; unsubscribe(); window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); void close(); };
  });
  async function create() {
    if (!ready || busy || !online) return;
    busy = true; error = '';
    try {
      const id = crypto.randomUUID();
      const pending = repository.prepareCreation(id, name);
      replaceState(`${base}/rooms/?room=${id}`, {});
      observe(id);
      await repository.submit(pending);
    } catch (failure) { error = state?.room?.hostUid === uid && !state.pending ? '' : describeFailure(failure); }
    finally { busy = false; }
  }
  async function retry() {
    if (!online || !state?.synchronized || state.blocked || busy) return;
    const pending = repository.pending(roomId);
    if (!pending) return;
    busy = true; error = '';
    try { await repository.submit(pending); }
    catch (failure) { error = state?.room?.hostUid === uid && !state.pending ? '' : describeFailure(failure); }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Deep Sea — Room setup</title><meta name="description" content="Prepare a Deep Sea room with a saved anonymous browser identity." /></svelte:head>
<main>
  <a class="back" href={`${base}/`}>← Deep Sea</a>
  <p class="eyebrow">PREPARE YOUR NEXT DIVE</p>
  <h1>Room setup</h1>
  <p class="intro">Create a room that stays with you when you reload. Joining and play are coming next.</p>
  {#if error}<p role="alert" class="notice">{error}</p>{/if}
  <p role="status">{!online ? 'Offline — reconnect to make changes.' : message}</p>
  {#if state?.room}
    <section aria-label="Saved room">
      <h2>{state.room.hostName}’s room</h2>
      <dl><div><dt>Host</dt><dd>{state.room.hostName}</dd></div><div><dt>Your place</dt><dd>{state.room.hostUid === uid ? 'Host — this is your room' : 'Not seated — joining comes next'}</dd></div></dl>
      <p>The room is saved. Keep this page’s address to open it again.</p>
      <p class="muted">Readiness, joining, and starting a dive will arrive in the next steps.</p>
    </section>
  {:else if !roomId}
    <form on:submit|preventDefault={create}>
      <label for="name">Your name</label>
      <input id="name" bind:value={name} maxlength="40" autocomplete="nickname" required />
      <button disabled={!ready || busy || !online || !name.trim()}>{busy ? 'Saving…' : 'Create room'}</button>
    </form>
  {/if}
  {#if state?.pending && !state.blocked}
    <p>Your room creation is awaiting confirmation.</p>
    <button on:click={retry} disabled={busy || !online || !state.synchronized}>Check saved creation</button>
  {/if}
  {#if state?.blocked}<button on:click={() => location.reload()}>Reload to update</button>{/if}
</main>
<style>
  :global(body) { margin: 0; background: #071e2a; color: #f5f1dc; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(*) { box-sizing: border-box; }
  main { max-width: 650px; margin: 0 auto; padding: 28px 24px; }
  .back { display: inline-flex; align-items: center; min-height: 44px; color: #b0eee0; }
  .eyebrow { color: #e6c85b; letter-spacing: .12em; font-size: 12px; margin-top: 32px; }
  h1 { font-size: clamp(36px, 6vw, 48px); margin: 12px 0; }
  h2 { font-size: 26px; margin-top: 0; }
  p { line-height: 1.5; }
  .intro, .muted { color: #bdcece; }
  section, form { border: 1px solid #497074; border-radius: 16px; padding: 24px; margin-top: 24px; background: #102f3b; }
  label { display: block; margin-bottom: 8px; font-weight: 700; }
  input, button { font: inherit; min-height: 48px; border-radius: 8px; padding: 12px 16px; }
  input { width: 100%; border: 2px solid #779c9a; background: #071e2a; color: #f5f1dc; }
  button { display: block; margin-top: 16px; border: 0; background: #edcc61; color: #10242d; font-weight: 700; cursor: pointer; }
  button:disabled { opacity: .55; cursor: default; }
  :global(:focus-visible) { outline: 3px solid #91f0d8; outline-offset: 4px; }
  dl div { margin: 14px 0; } dt { color: #bdcece; } dd { margin: 4px 0; font-weight: 700; }
  .notice { border-left: 4px solid #edcc61; padding: 12px; background: #233642; }
</style>
