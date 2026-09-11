<script lang="ts">
  import { onMount } from 'svelte';
  import '@fontsource/atkinson-hyperlegible/400.css';
  import '@fontsource/atkinson-hyperlegible/700.css';

  let ready = $state(false);
  let brief: HTMLDialogElement;
  onMount(() => { ready = true; });
</script>

<svelte:head>
  <title>Deep Sea — Coming soon</title>
  <meta name="description" content="A multiplayer treasure-diving game for your browser. Gather your crew. Share the oxygen. Know when to turn back." />
</svelte:head>

<main>
  <header class="masthead">
    <span class="wordmark">DEEP SEA</span>
    <span class="edition">A browser board game</span>
  </header>

  <section class="hero" aria-labelledby="title">
    <div class="ocean" aria-hidden="true">
      <svg viewBox="0 0 480 210" fill="none">
        <path d="M40 143C120 109 159 162 232 145S362 103 443 128" stroke="#83c8ce" stroke-opacity=".18" />
        <path d="M78 175C165 146 246 192 395 159" stroke="#83c8ce" stroke-opacity=".12" />
        <circle cx="346" cy="74" r="7" stroke="#81c8d3" stroke-width="2" />
        <circle cx="365" cy="42" r="4" stroke="#81c8d3" stroke-width="2" />
        <circle cx="336" cy="27" r="2" fill="#81c8d3" />
        <path d="M213 77V46H244V60H232V77" stroke="#e1ad61" stroke-width="12" stroke-linejoin="round" />
        <path d="M140 101L114 91V135L140 125" fill="#b78146" />
        <rect x="137" y="76" width="179" height="68" rx="34" fill="#e7b96d" />
        <path d="M151 128C180 146 265 147 302 127" stroke="#bb8748" stroke-width="8" stroke-linecap="round" />
        <circle cx="182" cy="108" r="17" fill="#b17c44" />
        <circle cx="182" cy="108" r="12" fill="#164d60" />
        <circle cx="227" cy="108" r="17" fill="#b17c44" />
        <circle cx="227" cy="108" r="12" fill="#164d60" />
        <circle cx="271" cy="108" r="17" fill="#b17c44" />
        <circle cx="271" cy="108" r="12" fill="#164d60" />
        <path d="M178 103L186 111M223 103L231 111M267 103L275 111" stroke="#7fc3cf" stroke-width="3" stroke-linecap="round" />
        <path d="M169 147V155M283 147V155" stroke="#b78146" stroke-width="7" stroke-linecap="round" />
      </svg>
    </div>
    <p class="eyebrow">Preparing to dive</p>
    <h1 id="title">Deep Sea</h1>
    <p class="tagline">One ocean. One oxygen tank.<br />How far will you go?</p>
    <p class="description">Gather your crew for a treasure hunt in your browser.<br class="desktop-break" /> Dive together, push your luck, and make it back aboard.</p>
    <div class="status"><span aria-hidden="true"></span>Coming soon</div>
    <button class="brief-button" disabled={!ready} onclick={() => brief.showModal()} aria-haspopup="dialog">About the game <span aria-hidden="true">↗</span></button>
  </section>

  <ul class="facts" aria-label="Game at a glance">
    <li><strong>2–6</strong><span>players, separate devices</span></li>
    <li><strong>Shared oxygen</strong><span>Every choice affects the crew</span></li>
    <li><strong>Three dives</strong><span>Bring your treasure home</span></li>
  </ul>
  <footer>Based on Deep Sea Adventure by Oink Games.</footer>
</main>

<dialog bind:this={brief} aria-labelledby="brief-title">
  <p class="eyebrow">A little courage. A little restraint.</p>
  <h2 id="brief-title">Treasure is only yours<br />if you make it back.</h2>
  <p>Play with 2–6 friends, each on their own device. Head deeper for treasure, or turn back toward the submarine.</p>
  <p>Everyone shares one oxygen supply. The treasure you carry slows you down and uses more air. Bring back the most value over three dives to win.</p>
  <p class="availability">The game is still being built. Room creation and play will arrive later.</p>
  <form method="dialog"><button class="close-button">Back to the surface</button></form>
</dialog>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) { margin: 0; background: #092c40; color: #f7f1e5; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(button) { font: inherit; }
  :global(button:focus-visible) { outline: 3px solid #e7b96d; outline-offset: 5px; }
  main { min-height: 100svh; padding: 28px 48px 22px; background: radial-gradient(ellipse at 50% 28%, #174f61 0, #0c3449 43%, #082637 85%); }
  .masthead { display: flex; justify-content: space-between; align-items: center; max-width: 1160px; margin: auto; font-size: 14px; }
  .wordmark { font-weight: 700; letter-spacing: .2em; }
  .edition { color: #adc7d0; }
  .hero { text-align: center; max-width: 700px; margin: 0 auto; }
  .ocean { width: min(440px, 100%); margin: 12px auto -12px; }
  svg { display: block; width: 100%; }
  .eyebrow { text-transform: uppercase; letter-spacing: .18em; font-size: 12px; color: #a7d4d4; font-weight: 700; margin: 12px 0; }
  h1 { font-size: clamp(62px, 8vw, 94px); line-height: 1; letter-spacing: -.04em; margin: 10px 0 18px; }
  .tagline { font-size: 26px; line-height: 1.25; margin: 0 0 20px; }
  .description { color: #c0d3d9; font-size: 17px; line-height: 1.5; margin: 0 0 24px; }
  .status { display: flex; width: fit-content; align-items: center; gap: 9px; margin: auto; border: 1px solid #608785; border-radius: 30px; padding: 9px 18px; background: #173e49; font-weight: 700; color: #d7e9db; }
  .status span { width: 7px; height: 7px; border-radius: 50%; background: #c4dbb4; }
  .brief-button { color: #f7f1e5; background: none; border: none; padding: 13px 18px; min-height: 44px; cursor: pointer; margin: 9px 0 22px; text-decoration: underline; text-underline-offset: 5px; }
  .brief-button span { margin-left: 9px; }
  .brief-button:disabled { cursor: progress; }
  .facts { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); margin: 0 auto; padding: 20px 0; max-width: 800px; border-top: 1px solid #315263; border-bottom: 1px solid #315263; }
  .facts li { display: grid; gap: 5px; text-align: center; padding: 0 15px; }
  .facts li + li { border-left: 1px solid #315263; }
  .facts strong { font-size: 18px; }
  .facts span { font-size: 13px; color: #adc7d0; }
  footer { text-align: center; font-size: 12px; color: #a1bdc7; padding-top: 24px; }
  dialog { max-width: 480px; width: calc(100% - 40px); padding: 30px; background: #faf4e8; color: #102f40; border: none; border-radius: 18px; box-shadow: 0 20px 80px #0006; }
  dialog::backdrop { background: #021723cf; }
  dialog .eyebrow { color: #326164; font-size: 10px; }
  h2 { font-size: 30px; line-height: 1.12; margin: 16px 0 22px; }
  dialog p { font-size: 16px; line-height: 1.45; }
  .availability { border-top: 1px solid #d4d7cb; padding-top: 16px; color: #435866; font-size: 14px; }
  .close-button { width: 100%; border: none; border-radius: 9px; padding: 13px; min-height: 44px; background: #126777; color: #fff; font-weight: 700; cursor: pointer; }
  @media (max-width: 600px) {
    main { padding: 22px 24px 20px; }
    .masthead { font-size: 11px; }
    .edition { font-size: 10px; }
    .ocean { width: 300px; max-width: 100%; margin-top: 28px; }
    h1 { font-size: 68px; margin-bottom: 19px; }
    .tagline { font-size: 23px; }
    .description { font-size: 15px; max-width: 310px; margin: 0 auto 24px; }
    .desktop-break { display: none; }
    .facts { padding: 17px 0; }
    .facts li { padding: 0 6px; }
    .facts strong { font-size: 14px; }
    .facts span { font-size: 11px; line-height: 1.3; }
    footer { font-size: 11px; padding-top: 23px; }
    dialog { padding: 25px; }
  }
</style>
