<script lang="ts">
  import type { ReviewPost } from "../lib/cms/types"
  import RatingBadge from "./RatingBadge.svelte"
  import TagPill from "./TagPill.svelte"
  import PriceDisplay from "./PriceDisplay.svelte"

  export let post: ReviewPost
</script>

<header class="review-hero">
  {#if post.coverImage}
    <div class="hero-image">
      <img src={post.coverImage} alt={post.title} width="1200" height="675" />
    </div>
  {/if}

  <div class="hero-body">
    {#if post.brand || post.productName}
      <p class="hero-overline">
        {[post.brand, post.productName].filter(Boolean).join(" · ")}
      </p>
    {/if}

    <h1 class="hero-title">{post.title}</h1>

    {#if post.description}
      <p class="hero-description">{post.description}</p>
    {/if}

    <div class="hero-meta">
      {#if post.rating !== null}
        <RatingBadge rating={post.rating} />
      {/if}
      {#if post.price !== null}
        <PriceDisplay price={post.price} />
      {/if}
    </div>

    {#if post.tags.length > 0}
      <div class="hero-tags">
        {#each post.tags as tag}
          <TagPill {tag} href={`/tags/${tag.toLowerCase()}`} />
        {/each}
      </div>
    {/if}

    {#if post.publishedAt}
      <time class="hero-date" datetime={post.publishedAt}>
        {new Date(post.publishedAt).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </time>
    {/if}
  </div>
</header>

<style>
  .review-hero {
    margin-bottom: 2rem;
  }

  .hero-image {
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 14px;
    margin-bottom: 1.5rem;
    background: var(--color-surface, #f3f4f6);
  }

  .hero-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-overline {
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted, #6b7280);
    margin-bottom: 0.375rem;
  }

  .hero-title {
    font-family: var(--font-serif, serif);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 700;
    line-height: 1.15;
    color: var(--color-text, #111827);
    margin-bottom: 0.75rem;
  }

  .hero-description {
    font-size: 1.0625rem;
    line-height: 1.65;
    color: var(--color-text-muted, #6b7280);
    margin-bottom: 1rem;
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .hero-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .hero-date {
    display: block;
    font-size: 0.875rem;
    color: var(--color-text-subtle, #9ca3af);
  }
</style>
