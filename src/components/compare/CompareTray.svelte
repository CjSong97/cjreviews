<script lang="ts">
  import { onMount } from "svelte"

  /**
   * Docked control for building a comparison.
   *
   * Selection lives in localStorage so it survives navigation, but the URL is
   * the source of truth for the comparison itself (`/compare?compare=a,b`) —
   * which is what makes a comparison shareable.
   *
   * Renders nothing on the server: an empty tray flashing in before hydration
   * would be worse than it appearing a moment late.
   */

  const KEY = "cjreviews:compare"
  const MAX = 3

  let { slug, title }: { slug: string; title: string } = $props()

  let selection = $state<{ slug: string; title: string }[]>([])
  let ready = $state(false)

  const included = $derived(selection.some((s) => s.slug === slug))
  const full = $derived(selection.length >= MAX && !included)
  const href = $derived(`/compare?compare=${selection.map((s) => encodeURIComponent(s.slug)).join(",")}`)

  function load(): { slug: string; title: string }[] {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((e) => e && typeof e.slug === "string" && typeof e.title === "string")
        .slice(0, MAX)
    } catch {
      // Private mode, cleared storage, or malformed JSON — start empty.
      return []
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(selection))
    } catch {
      // Storage unavailable; the tray still works for this page view.
    }
  }

  function toggle() {
    selection = included
      ? selection.filter((s) => s.slug !== slug)
      : [...selection, { slug, title }].slice(0, MAX)
    save()
  }

  function remove(target: string) {
    selection = selection.filter((s) => s.slug !== target)
    save()
  }

  function clear() {
    selection = []
    save()
  }

  onMount(() => {
    selection = load()
    ready = true
  })
</script>

{#if ready}
  <aside class="tray bezel" aria-label="Comparison tray">
    <div class="row">
      <button type="button" class="toggle" onclick={toggle} disabled={full} aria-pressed={included}>
        {included ? "Remove from comparison" : "Add to comparison"}
      </button>

      {#if full}
        <p class="label note">Comparison full — remove one first</p>
      {/if}
    </div>

    {#if selection.length > 0}
      <ul class="chips" role="list">
        {#each selection as item (item.slug)}
          <li class="chip">
            <span class="chip-name">{item.title}</span>
            <button
              type="button"
              class="chip-remove"
              onclick={() => remove(item.slug)}
              aria-label={`Remove ${item.title} from comparison`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        {/each}
      </ul>

      <div class="row">
        <a class="go" {href}>
          Compare <span class="numeral">{selection.length}</span>
        </a>
        <button type="button" class="clear label" onclick={clear}>Clear</button>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .tray {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: var(--max-w-content);
    margin: 2rem auto 0;
    padding: 1rem 1.125rem;
    border-radius: var(--radius);
    background: var(--color-panel);
  }

  .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .toggle {
    padding: 0.5rem 0.875rem;
    border: 1px solid var(--color-panel-edge);
    border-radius: var(--radius-sm);
    background: var(--color-ground-raised);
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: var(--text-small);
    font-weight: 500;
    cursor: pointer;
    transition: border-color var(--duration-fast) var(--ease-instrument);
  }

  .toggle:hover:not(:disabled),
  .toggle:focus-visible {
    border-color: var(--color-signal);
  }

  .toggle[aria-pressed="true"] {
    border-color: var(--color-signal);
    color: var(--color-signal);
  }

  .toggle:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .note {
    color: var(--color-alert);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.1875rem 0.25rem 0.1875rem 0.5rem;
    border: 1px solid var(--color-panel-edge);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }

  .chip-name {
    color: var(--color-text-muted);
  }

  .chip-remove {
    display: grid;
    place-items: center;
    width: 1.125rem;
    height: 1.125rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.875rem;
    line-height: 1;
  }

  .chip-remove:hover,
  .chip-remove:focus-visible {
    color: var(--color-alert);
  }

  .go {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: var(--radius-sm);
    background: var(--color-signal);
    color: var(--color-on-signal);
    font-family: var(--font-display);
    font-size: var(--text-small);
    font-weight: 600;
    text-decoration: none;
  }

  .clear {
    border: 0;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .clear:hover,
  .clear:focus-visible {
    color: var(--color-text);
  }
</style>
