<script lang="ts">
  import type { ReviewPost } from "../lib/cms/types"
  export let post: ReviewPost
</script>

<a href={`/reviews/${post.slug}`} class="card">
  {#if post.coverImage}
    <img src={post.coverImage} alt={post.title} />
  {/if}
  <div class="card-body">
    <h2>{post.title}</h2>
    {#if post.description}
      <p>{post.description}</p>
    {/if}
    <div class="card-meta">
      {#if post.productType}
        <span class="badge">{post.productType}</span>
      {/if}
      {#if post.rating !== null}
        <span class="rating">{post.rating}/100</span>
      {/if}
      {#if post.price}
        <span class="price">£{post.price}</span>
      {/if}
    </div>
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  img { width: 100%; aspect-ratio: 16/9; object-fit: cover; }
  .card-body { padding: 1rem; }
  .card-meta { display: flex; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.875rem; }
  .badge { background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
  .rating { font-weight: 600; }
</style>