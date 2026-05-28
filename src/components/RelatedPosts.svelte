<script lang="ts">
  import type { ReviewPost } from "../lib/cms/types"
  import ReviewCard from "./ReviewCard.svelte"

  export let posts: ReviewPost[]
</script>

{#if posts.length > 0}
  <section class="related-posts" aria-labelledby="related-heading">
    <h2 id="related-heading" class="related-title">Related Reviews</h2>
    <div class="related-grid">
      {#each posts as post}
        <ReviewCard {post} />
      {/each}
    </div>
  </section>
{/if}

<style>
  .related-posts {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

  .related-title {
    font-family: var(--font-serif, serif);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin-bottom: 1.25rem;
  }

  .related-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    gap: 1.25rem;
  }
</style>
