<script lang="ts">
  export let tag: string
  export let href: string | undefined = undefined
</script>

{#if href}
  <a {href} class="pill">{tag}</a>
{:else}
  <span class="pill">{tag}</span>
{/if}

<style>
  .pill {
    display: inline-block;
    padding: 0.125rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 9999px;
    background: var(--color-surface, #f3f4f6);
    color: var(--color-text-muted, #6b7280);
    text-decoration: none;
    transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
                color 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  a.pill:hover,
  a.pill:focus-visible {
    background: var(--color-accent, #2563eb);
    color: #fff;
    outline: 2px solid var(--color-accent, #2563eb);
    outline-offset: 2px;
  }
</style>
