import type { PageObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints"
import type { ReviewPost, ContentType, ProductType } from "../cms/types"
import { getNotionClient } from "./client"

const DATABASE_ID = import.meta.env.NOTION_DATABASE_ID

// ── Primitive helpers ─────────────────────────────────────────────────────────

function richText(items: RichTextItemResponse[]): string {
  return items.map((r) => r.plain_text).join("")
}

function extractPageId(url: string): string {
  // Notion page URLs end with a 32-char hex ID (with or without dashes)
  const match = url.match(/([a-f0-9]{32}|[a-f0-9-]{36})$/)
  return match ? match[1].replace(/-/g, "") : url
}

// ── Property extractors ───────────────────────────────────────────────────────

function getSlug(props: PageObjectResponse["properties"]): string | null {
  const canonical = props["Canonical Slug"]
  if (canonical?.type === "rich_text" && canonical.rich_text.length > 0) {
    return richText(canonical.rich_text)
  }

  // Fallback to formula slug
  const formula = props["Slug"]
  if (formula?.type === "formula" && formula.formula.type === "string") {
    return formula.formula.string
  }

  return null
}

function getMultiSelect(props: PageObjectResponse["properties"], name: string): string[] {
  const prop = props[name]
  if (prop?.type === "multi_select") {
    return prop.multi_select.map((o) => o.name)
  }
  return []
}

function getSelect<T extends string>(
  props: PageObjectResponse["properties"],
  name: string
): T | null {
  const prop = props[name]
  if (prop?.type === "select" && prop.select) {
    return prop.select.name as T
  }
  return null
}

function getText(props: PageObjectResponse["properties"], name: string): string | null {
  const prop = props[name]
  if (prop?.type === "rich_text") {
    const text = richText(prop.rich_text)
    return text.length > 0 ? text : null
  }
  return null
}

function getNumber(props: PageObjectResponse["properties"], name: string): number | null {
  const prop = props[name]
  if (prop?.type === "number" && prop.number !== null) {
    return prop.number
  }
  return null
}

function getCheckbox(props: PageObjectResponse["properties"], name: string): boolean {
  const prop = props[name]
  return prop?.type === "checkbox" ? prop.checkbox : false
}

function getDate(props: PageObjectResponse["properties"], name: string): string | null {
  const prop = props[name]
  if (prop?.type === "date" && prop.date) {
    return prop.date.start
  }
  return null
}

function getCoverImage(props: PageObjectResponse["properties"]): string | null {
  const prop = props["Cover Image"]
  if (prop?.type === "files" && prop.files.length > 0) {
    const first = prop.files[0]
    if (first.type === "file") return first.file.url
    if (first.type === "external") return first.external.url
  }
  return null
}

// ── Main transformer ──────────────────────────────────────────────────────────

export function pageToReviewPost(page: PageObjectResponse): ReviewPost {
  const props = page.properties
  const title = props["Title"]
  const titleText =
    title?.type === "title" ? richText(title.title) : "Untitled"

  const slug = getSlug(props)
  if (!slug) {
    throw new Error(`Missing slug for page: ${titleText} (${page.id})`)
  }

  const updatedAt =
    props["Updated"]?.type === "last_edited_time"
      ? props["Updated"].last_edited_time
      : page.last_edited_time

  return {
    id: page.id,
    slug,
    title: titleText,
    contentType: getSelect<ContentType>(props, "Content Type"),
    productType: getSelect<ProductType>(props, "Product Type"),
    productName: getText(props, "Product Name"),
    brand: getText(props, "Brand"),
    tags: getMultiSelect(props, "Tags"),
    rating: getNumber(props, "Rating"),
    price: getNumber(props, "Price"),
    description: getText(props, "Description"),
    coverImage: getCoverImage(props),
    seoTitle: getText(props, "SEO Title"),
    seoDescription: getText(props, "SEO Description"),
    publishedAt: getDate(props, "Published At"),
    updatedAt,
    featured: getCheckbox(props, "Featured"),
    notionUrl: page.url,
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getPublishedPosts(): Promise<ReviewPost[]> {
  const notion = getNotionClient()

  const response = await notion.dataSources.query({
    data_source_id: DATABASE_ID,
    filter: {
      and: [
        { property: "Published", checkbox: { equals: true } },
        { property: "Status", status: { equals: "Published" } },
      ],
    },
    sorts: [{ property: "Published At", direction: "descending" }],
  })

  return response.results
    .filter((p): p is PageObjectResponse => p.object === "page")
    .map(pageToReviewPost)
}

export async function getPostBySlug(slug: string): Promise<ReviewPost | null> {
  const notion = getNotionClient()

  const response = await notion.dataSources.query({
    data_source_id: DATABASE_ID,
    filter: {
      and: [
        { property: "Published", checkbox: { equals: true } },
        { property: "Status", status: { equals: "Published" } },
        { property: "Canonical Slug", rich_text: { equals: slug } },
      ],
    },
  })

  const pages = response.results.filter(
    (p): p is PageObjectResponse => p.object === "page"
  )
  return pages.length > 0 ? pageToReviewPost(pages[0]) : null
}

export async function getPostBlocks(pageId: string) {
  const notion = getNotionClient()
  const response = await notion.blocks.children.list({ block_id: pageId })
  return response.results
}