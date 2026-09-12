<script lang="ts">
  export let faces: [number, number];
</script>

<div class="dice" role="img" aria-label={"Dice: " + faces.join(" and ")}>
  {#each faces as face}<svg
      viewBox="0 0 40 40"
      width="40"
      height="40"
      aria-hidden="true"
      ><rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="8"
        fill="#f5f1dc"
        stroke="#edcc61"
        stroke-width="2"
      />{#if face !== 2}<circle
          cx="20"
          cy="20"
          r="3.5"
          fill="#12313d"
        />{/if}{#if face > 1}<circle
          cx="11"
          cy="11"
          r="3.5"
          fill="#12313d"
        /><circle cx="29" cy="29" r="3.5" fill="#12313d" />{/if}</svg
    >{/each}
</div>

<style>
  .dice {
    display: flex;
    gap: 8px;
    margin: 8px 0;
  }
</style>
