<script lang="ts">
  export let blocks: any[]

  function renderRichText(rt: any[]): string {
    return rt.map((r: any) => {
      let text = r.plain_text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
      if (r.annotations.bold) text = `<strong>${text}</strong>`
      if (r.annotations.italic) text = `<em>${text}</em>`
      if (r.annotations.code) text = `<code>${text}</code>`
      if (r.href) text = `<a href="${r.href}">${text}</a>`
      return text
    }).join("")
  }

  // Group consecutive list items into a single <ul> or <ol>
  type Group =
    | { type: "ul"; items: any[] }
    | { type: "ol"; items: any[] }
    | { type: "block"; block: any }

  function groupBlocks(input: any[]): Group[] {
    const result: Group[] = []
    for (const block of input) {
      if (block.type === "bulleted_list_item") {
        const last = result[result.length - 1]
        if (last?.type === "ul") {
          last.items.push(block)
        } else {
          result.push({ type: "ul", items: [block] })
        }
      } else if (block.type === "numbered_list_item") {
        const last = result[result.length - 1]
        if (last?.type === "ol") {
          last.items.push(block)
        } else {
          result.push({ type: "ol", items: [block] })
        }
      } else {
        result.push({ type: "block", block })
      }
    }
    return result
  }

  $: groups = groupBlocks(blocks)
</script>

{#each groups as group}
  {#if group.type === "ul"}
    <ul>
      {#each group.items as item}
        <li>{@html renderRichText(item.bulleted_list_item.rich_text)}</li>
      {/each}
    </ul>

  {:else if group.type === "ol"}
    <ol>
      {#each group.items as item}
        <li>{@html renderRichText(item.numbered_list_item.rich_text)}</li>
      {/each}
    </ol>

  {:else}
    {@const block = group.block}
    {#if block.type === "paragraph"}
      <p>{@html renderRichText(block.paragraph.rich_text)}</p>

    {:else if block.type === "heading_1"}
      <h1>{@html renderRichText(block.heading_1.rich_text)}</h1>

    {:else if block.type === "heading_2"}
      <h2>{@html renderRichText(block.heading_2.rich_text)}</h2>

    {:else if block.type === "heading_3"}
      <h3>{@html renderRichText(block.heading_3.rich_text)}</h3>

    {:else if block.type === "quote"}
      <blockquote>{@html renderRichText(block.quote.rich_text)}</blockquote>

    {:else if block.type === "callout"}
      <div class="callout">
        {#if block.callout.icon?.emoji}
          <span class="icon" aria-hidden="true">{block.callout.icon.emoji}</span>
        {/if}
        <span>{@html renderRichText(block.callout.rich_text)}</span>
      </div>

    {:else if block.type === "image"}
      {@const src = block.image.type === "file" ? block.image.file.url : block.image.external.url}
      {@const caption = block.image.caption?.map((r: any) => r.plain_text).join("") ?? ""}
      <figure>
        <img
          {src}
          alt={caption || "Review image"}
          loading="lazy"
        />
        {#if caption}
          <figcaption>{@html renderRichText(block.image.caption)}</figcaption>
        {/if}
      </figure>

    {:else if block.type === "divider"}
      <hr />

    {:else if block.type === "code"}
      <pre><code>{block.code.rich_text.map((r: any) => r.plain_text).join("")}</code></pre>
    {/if}
  {/if}
{/each}

<style>
  .callout {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-bg-subtle, #f9fafb);
    border-left: 4px solid var(--color-border, #d1d5db);
    border-radius: 4px;
    margin: 1rem 0;
  }
  figure { margin: 1.5rem 0; }
  figure img { width: 100%; border-radius: 6px; }
  figcaption { font-size: 0.875rem; color: var(--color-text-muted, #6b7280); margin-top: 0.5rem; }
  blockquote { border-left: 4px solid var(--color-border, #d1d5db); padding-left: 1rem; color: var(--color-text-muted, #374151); }
  pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 6px; overflow-x: auto; }
</style>
