<script lang="ts">
  export let price: number

  function format(p: number): string {
    return Number.isInteger(p) ? `£${p}` : `£${p.toFixed(2)}`
  }
</script>

<span class="price">{format(price)}</span>

<style>
  .price {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    font-variant-numeric: tabular-nums;
  }
</style>
