<script lang="ts">
  import type { ReviewPost } from "../lib/cms/types"
  import RatingBadge from "./RatingBadge.svelte"
  import TagPill from "./TagPill.svelte"
  import PriceDisplay from "./PriceDisplay.svelte"

  export let post: ReviewPost
</script>

<a href={`/reviews/${post.slug}`} class="card">
  <div class="card-image">
    {#if post.coverImage}
      <img src={post.coverImage} alt={post.title} loading="lazy" width="640" height="360" />
    {:else}
      <div class="card-image-placeholder" aria-hidden="true"></div>
    {/if}
  </div>

  <div class="card-body">
    <h2 class="card-title">{post.title}</h2>

    {#if post.description}
      <p class="card-excerpt">{post.description}</p>
    {/if}

    <div class="card-meta">
      {#if post.rating !== null}
        <RatingBadge rating={post.rating} />
      {/if}
      {#if post.price !== null}
        <PriceDisplay price={post.price} />
      {/if}
    </div>

    {#if post.tags.length > 0}
      <div class="card-tags">
        {#each post.tags.slice(0, 3) as tag}
          <TagPill {tag} />
        {/each}
      </div>
    {/if}
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 14px;
    overflow: hidden;
    background: var(--color-bg, #fff);
    transition: box-shadow 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
                transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .card:hover,
  .card:focus-visible {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
    outline: 2px solid var(--color-accent, #2563eb);
    outline-offset: 2px;
  }

  .card:active {
    transform: translateY(0);
  }

  .card-image {
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--color-surface, #f3f4f6);
  }

  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .card:hover .card-image img {
    transform: scale(1.03);
  }

  .card-image-placeholder {
    width: 100%;
    height: 100%;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.125rem 1.125rem;
  }

  .card-title {
    font-family: var(--font-serif, serif);
    font-size: 1.0625rem;
    font-weight: 600;
    line-height: 1.35;
    color: var(--color-text, #111827);
  }

  .card-excerpt {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--color-text-muted, #6b7280);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-top: 0.125rem;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
</style>
