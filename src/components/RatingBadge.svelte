<script lang="ts">
  export let rating: number

  function tierClass(r: number): string {
    if (r >= 80) return "tier-high"
    if (r >= 60) return "tier-mid"
    return "tier-low"
  }
</script>

<span class="badge {tierClass(rating)}">{rating}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.5rem;
    padding: 0.125rem 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border-radius: 6px;
    transition: transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
    letter-spacing: 0.02em;
  }

  .badge:hover {
    transform: scale(1.02);
  }

  .tier-high {
    background: #dcfce7;
    color: #14532d;
  }

  .tier-mid {
    background: #fef9c3;
    color: #713f12;
  }

  .tier-low {
    background: #fee2e2;
    color: #7f1d1d;
  }

  @media (prefers-color-scheme: dark) {
    .tier-high { background: #14532d; color: #bbf7d0; }
    .tier-mid  { background: #713f12; color: #fef08a; }
    .tier-low  { background: #7f1d1d; color: #fecaca; }
  }
</style>
