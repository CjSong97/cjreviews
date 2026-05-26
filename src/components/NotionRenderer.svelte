<script lang="ts">
  export let blocks: any[]

  function renderRichText(rt: any[]): string {
    return rt.map((r: any) => {
      let text = r.plain_text
      if (r.annotations.bold) text = `<strong>${text}</strong>`
      if (r.annotations.italic) text = `<em>${text}</em>`
      if (r.annotations.code) text = `<code>${text}</code>`
      if (r.href) text = `<a href="${r.href}">${text}</a>`
      return text
    }).join("")
  }
</script>

{#each blocks as block}
  {#if block.type === "paragraph"}
    <p>{@html renderRichText(block.paragraph.rich_text)}</p>

  {:else if block.type === "heading_1"}
    <h1>{@html renderRichText(block.heading_1.rich_text)}</h1>

  {:else if block.type === "heading_2"}
    <h2>{@html renderRichText(block.heading_2.rich_text)}</h2>

  {:else if block.type === "heading_3"}
    <h3>{@html renderRichText(block.heading_3.rich_text)}</h3>

  {:else if block.type === "bulleted_list_item"}
    <ul><li>{@html renderRichText(block.bulleted_list_item.rich_text)}</li></ul>

  {:else if block.type === "numbered_list_item"}
    <ol><li>{@html renderRichText(block.numbered_list_item.rich_text)}</li></ol>

  {:else if block.type === "quote"}
    <blockquote>{@html renderRichText(block.quote.rich_text)}</blockquote>

  {:else if block.type === "callout"}
    <div class="callout">
      {#if block.callout.icon?.emoji}
        <span class="icon">{block.callout.icon.emoji}</span>
      {/if}
      <span>{@html renderRichText(block.callout.rich_text)}</span>
    </div>

  {:else if block.type === "image"}
    <figure>
      <img
        src={block.image.type === "file" ? block.image.file.url : block.image.external.url}
        alt={block.image.caption?.map((r: any) => r.plain_text).join("") ?? ""}
      />
      {#if block.image.caption?.length > 0}
        <figcaption>{@html renderRichText(block.image.caption)}</figcaption>
      {/if}
    </figure>

  {:else if block.type === "divider"}
    <hr />

  {:else if block.type === "code"}
    <pre><code>{block.code.rich_text.map((r: any) => r.plain_text).join("")}</code></pre>
  {/if}
{/each}

<style>
  .callout {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: #f9fafb;
    border-left: 4px solid #d1d5db;
    border-radius: 4px;
    margin: 1rem 0;
  }
  figure { margin: 1.5rem 0; }
  figure img { width: 100%; border-radius: 6px; }
  figcaption { font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem; }
  blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; color: #374151; }
  pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 6px; overflow-x: auto; }
</style>