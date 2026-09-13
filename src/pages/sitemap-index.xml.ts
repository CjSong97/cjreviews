import type { APIContext } from "astro"
import { getAllTags, getPublishedPosts } from "../lib/notion/adapter"

/**
 * Dynamic sitemap, replacing @astrojs/sitemap.
 *
 * That integration only enumerates routes known at build time, so it emits
 * nothing useful now that pages render on demand. Building it from Notion
 * instead means newly published reviews enter the sitemap as soon as they are
 * live, without a redeploy.
 *
 * The filename keeps the /sitemap-index.xml URL that public/robots.txt already
 * advertises and that search engines have on file.
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function urlEntry(loc: string, lastmod?: string): string {
  const mod = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""
  return `<url><loc>${escapeXml(loc)}</loc>${mod}</url>`
}

export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, "")
  const posts = await getPublishedPosts()

  const newest = posts
    .map((p) => p.updatedAt)
    .sort()
    .at(-1)

  // Tag pages are real crawlable content, so they belong here too.
  const tags = await getAllTags()

  const entries = [
    urlEntry(`${site}/`, newest),
    urlEntry(`${site}/reviews/`, newest),
    urlEntry(`${site}/tags/`, newest),
    ...posts.map((post) => urlEntry(`${site}/reviews/${post.slug}/`, post.updatedAt)),
    ...tags.map((tag) => urlEntry(`${site}/tags/${encodeURIComponent(tag.toLowerCase())}/`, newest)),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
