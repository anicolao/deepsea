<script lang="ts">
  export let seat = 1;
</script>

<span
  class="marker"
  style={"--diver:" +
    ["#087b8c", "#bb482b", "#7251ad", "#2468a2", "#9b6814", "#9f3d79"][
      (seat - 1) % 6
    ]}
  aria-hidden="true">{seat}</span
>

<style>
  .marker {
    display: inline-grid;
    place-items: center;
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--diver);
    color: #fff;
    border: 2px solid #fff;
    box-shadow: 0 1px 3px #092c4033;
    font-size: 18px;
    font-weight: bold;
  }
</style>
