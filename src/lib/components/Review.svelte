<script lang="ts">
  import { playerView } from '$lib/game/engine';
  import type { Room } from '$lib/game/protocol';
  export let room: Room;
  export let uid: string;
  export let enabled: boolean;
  export let act: (type: string, payload: Record<string, unknown>) => Promise<void>;
  $: view = playerView(room.dive!);
  $: current = view.reviews.at(-1)!;
  $: owner = view.cleanup[0];
  $: mine = owner === uid;
  $: lost = view.divers.find(p => p.uid === owner)?.cargo ?? [];
  let order: string[] = [], revision = '';
  $: if (revision !== room.lastActionId) { revision = room.lastActionId; order = lost.map(u => u.id); }
  const name = (id: string) => room.members.find(m => m.uid === id)?.name ?? '';
  function move(id: string, offset: number) { const index = order.indexOf(id), next = [...order]; [next[index], next[index+offset]] = [next[index+offset], next[index]]; order = next; }
</script>
<div class="review">
  <header><p class="eyebrow">BACK AT THE SURFACE · DIVE {view.number} OF 3</p><h1>{view.stage === 'cleanup' ? 'Treasure left behind' : `Dive ${view.number} complete`}</h1><p>Previously saved treasure stays safe.</p></header>
  <section class="report" data-game-path aria-label="Dive results">
    {#if view.stage === 'cleanup' && mine}
      <h2>Choose the order of your lost treasure</h2><p>Place units from first to last. Each group of up to three becomes one stack at the deep end. Existing stacks stay whole.</p>
      <ol aria-label="Lost treasure order">{#each order as id, index}<li><div><strong>Unit {lost.findIndex(u => u.id === id)+1}</strong><span>Level {lost.find(u => u.id === id)?.levels.join(', ')} · {lost.find(u => u.id === id)?.count} tiles</span><small>Stack {Math.floor(index/3)+1} · position {index%3+1}</small></div><button disabled={!enabled || index === 0} on:click={() => move(id,-1)} aria-label={`Move unit ${lost.findIndex(u => u.id === id)+1} earlier`}>↑ Earlier</button><button disabled={!enabled || index === order.length-1} on:click={() => move(id,1)} aria-label={`Move unit ${lost.findIndex(u => u.id === id)+1} later`}>↓ Later</button></li>{/each}</ol>
    {:else if view.stage === 'cleanup'}<h2>Waiting for {name(owner)} to order lost treasure</h2><p>The next dive begins after the lost cargo has been placed. Your friend keeps this choice if they reconnect.</p>
    {:else}<h2>Your crew’s haul</h2><table><caption>Dive {view.number} results</caption><thead><tr><th scope="col">Diver</th><th scope="col">This dive</th><th scope="col">Total</th></tr></thead><tbody>{#each current.players as p}<tr><th scope="row">{name(p.uid)}{p.uid === uid ? ' (You)' : ''}<small>{p.returned ? 'Returned' : 'Treasure lost'}</small></th><td>{p.gained.reduce((sum,t)=>sum+t.value,0)}</td><td>{p.total}</td></tr>{/each}</tbody></table>
      {#each current.players.filter(p=>p.gained.length) as p}<details><summary>{name(p.uid)}’s saved treasure</summary><p>{p.gained.map(t=>`Level ${t.level}: ${t.value} points`).join(' · ')}</p></details>{/each}
    {/if}
  </section>
  <section class="actions" data-game-actions aria-label="After the dive">
    {#if view.stage === 'cleanup' && mine}<p>The first unit cannot move earlier; the last cannot move later.</p><button class="primary" disabled={!enabled} on:click={() => act('dive/ordered', { order, expectedActionId: room.lastActionId })}>Confirm order</button>
    {:else if view.stage === 'cleanup'}<p>Waiting for {name(owner)}. Treasure values stay concealed.</p>
    {:else}<h2>{name(view.nextStarter!)} starts the next dive</h2><p>Take a breath. Your crew’s scores are saved.</p>{/if}
    {#if !enabled}<p>Reconnect to confirm your choice.</p>{/if}
  </section>
</div>
<style>
  .review{height:calc(100dvh - 132px);max-width:850px;margin:auto;display:flex;flex-direction:column;gap:16px}header{flex-shrink:0}.eyebrow{color:#b0eee0;font-size:12px;letter-spacing:2px}h1{font-size:32px;margin:8px 0}h2{font-size:23px;margin:8px 0}p{line-height:1.4;margin:10px 0}.report{min-height:0;overflow-y:auto;flex:1;background:#f5f1dc;color:#12313d;padding:24px}.actions{border:1px solid #497074;background:#12313d;padding:16px}.actions h2{font-size:21px}.actions p{font-size:14px}table{width:100%;border-collapse:collapse;text-align:left}caption{text-align:left;margin-bottom:12px}th,td{padding:14px 8px;border-bottom:1px solid #9fae9c}td{font-size:23px}small{display:block;font-size:14px;font-weight:normal;margin-top:5px}button,summary{font:inherit;min-height:44px}button{padding:10px 12px;background:#173e49;color:#f5f1dc;border:1px solid #779c9a;cursor:pointer}.primary{background:#edcc61;color:#10242d;font-weight:bold}button:disabled{opacity:.55;cursor:default}summary{display:flex;align-items:center;cursor:pointer;font-weight:bold}ol{padding:0;list-style:none}li{display:flex;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid #9fae9c}li div{flex:1}li span{display:block;font-size:14px}
  @media(max-width:700px){.review{gap:10px}h1{font-size:27px}.report{padding:16px}h2{font-size:21px}.actions{padding:12px}.primary{width:100%}th,td{padding:10px 4px}li{flex-wrap:wrap}li div{min-width:100%}}
</style>
