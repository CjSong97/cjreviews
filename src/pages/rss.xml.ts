import rss from "@astrojs/rss"
import { getPublishedPosts } from "../lib/notion/adapter"
import type { APIContext } from "astro"

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts()

  return rss({
    title: "CJ Reviews",
    description: "Honest reviews of earphones, headphones, and games by CJ.",
    site: context.site!.toString(),
    items: posts.map((post) => ({
      title: post.title,
      description: post.description ?? "",
      pubDate: post.publishedAt ? new Date(post.publishedAt) : new Date(post.updatedAt),
      link: `/reviews/${post.slug}/`,
    })),
    customData: `<language>en-gb</language>`,
  })
}
