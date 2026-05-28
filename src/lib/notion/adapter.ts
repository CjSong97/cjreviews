import type { PageObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints"
import { z } from "zod"
import type { ReviewPost, ContentType, ProductType } from "../cms/types"
import { getNotionClient } from "./client"

const NOTION_DATA_SOURCE_ID = import.meta.env.NOTION_DATA_SOURCE_ID
if (!NOTION_DATA_SOURCE_ID) {
  throw new Error("NOTION_DATA_SOURCE_ID is not set (must be a Notion data_source_id)")
}

/**
 * Controls how strict published filtering should be.
 * - "checkboxOnly": Published checkbox must be true. Status is ignored.
 * - "preferStatus": Published must be true; if Status exists, it must be "Published".
 * - "requireStatus": Published must be true AND Status must equal "Published".
 */
const PUBLISHED_MODE: "checkboxOnly" | "preferStatus" | "requireStatus" =
  (import.meta.env.NOTION_PUBLISHED_MODE as any) ?? "preferStatus"

// ── Primitive helpers ─────────────────────────────────────────────────────────

function richText(items: RichTextItemResponse[]): string {
  return items.map((r) => r.plain_text).join("")
}

/**
 * Notion page.id is already usable as block_id. If you have a URL, this helps.
 * Returns a 32-char hex id (no dashes) when it can.
 */
export function extractPageId(input: string): string {
  const match = input.match(/([a-f0-9]{32}|[a-f0-9-]{36})$/i)
  return match ? match[1].replace(/-/g, "") : input
}

// ── Property extractors ───────────────────────────────────────────────────────

function getSlug(props: PageObjectResponse["properties"]): string | null {
  const canonical = props["Canonical Slug"]
  if (canonical?.type === "rich_text" && canonical.rich_text.length > 0) {
    const v = richText(canonical.rich_text).trim()
    return v.length > 0 ? v : null
  }

  // Fallback to formula slug
  const formula = props["Slug"]
  if (formula?.type === "formula" && formula.formula.type === "string") {
    const v = (formula.formula.string ?? "").trim()
    return v.length > 0 ? v : null
  }

  return null
}

function getMultiSelect(props: PageObjectResponse["properties"], name: string): string[] {
  const prop = props[name]
  if (prop?.type === "multi_select") return prop.multi_select.map((o) => o.name)
  return []
}

function getSelect<T extends string>(props: PageObjectResponse["properties"], name: string): T | null {
  const prop = props[name]
  if (prop?.type === "select" && prop.select) return prop.select.name as T
  return null
}

function getText(props: PageObjectResponse["properties"], name: string): string | null {
  const prop = props[name]
  if (prop?.type === "rich_text") {
    const v = richText(prop.rich_text).trim()
    return v.length > 0 ? v : null
  }
  return null
}

function getNumber(props: PageObjectResponse["properties"], name: string): number | null {
  const prop = props[name]
  if (prop?.type === "number" && prop.number !== null) return prop.number
  return null
}

function getCheckbox(props: PageObjectResponse["properties"], name: string): boolean {
  const prop = props[name]
  return prop?.type === "checkbox" ? prop.checkbox : false
}

function getDate(props: PageObjectResponse["properties"], name: string): string | null {
  const prop = props[name]
  if (prop?.type === "date" && prop.date?.start) return prop.date.start
  return null
}

function getCoverImage(page: PageObjectResponse): string | null {
  // Check custom "Cover Image" files property first
  const prop = page.properties["Cover Image"]
  if (prop?.type === "files" && prop.files.length > 0) {
    const first = prop.files[0]
    if (first.type === "file") return first.file.url
    if (first.type === "external") return first.external.url
  }

  // Fall back to native Notion page cover (the banner set in the Notion UI)
  if (page.cover) {
    if (page.cover.type === "file") return page.cover.file.url
    if (page.cover.type === "external") return page.cover.external.url
  }

  return null
}

function hasStatusProperty(props: PageObjectResponse["properties"]): boolean {
  return !!props["Status"] && props["Status"]?.type === "status"
}

function getStatusName(props: PageObjectResponse["properties"]): string | null {
  const prop = props["Status"]
  if (prop?.type === "status" && prop.status?.name) return prop.status.name
  return null
}

// ── Zod validation ────────────────────────────────────────────────────────────

/**
 * This is runtime validation at the boundary.
 * Keep it permissive where Notion values may be missing.
 * If your ../cms/types are stricter, adjust here to match.
 */
const ReviewPostSchema: z.ZodType<ReviewPost> = z.object({
  id: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  contentType: z.string().nullable(),   // ContentType | null
  productType: z.string().nullable(),   // ProductType | null
  productName: z.string().nullable(),
  brand: z.string().nullable(),
  tags: z.array(z.string()),
  rating: z.number().nullable(),
  price: z.number().nullable(),
  description: z.string().nullable(),
  coverImage: z.string().url().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  featured: z.boolean(),
  notionUrl: z.string().url(),
}) as any

// ── Main transformer ──────────────────────────────────────────────────────────

export function pageToReviewPost(page: PageObjectResponse): ReviewPost {
  const props = page.properties

  const titleProp = props["Title"]
  const titleText = titleProp?.type === "title" ? richText(titleProp.title).trim() : ""
  const title = titleText.length > 0 ? titleText : "Untitled"

  const slug = getSlug(props)
  if (!slug) {
    throw new Error(`Missing slug for page: ${title} (${page.id})`)
  }

  const updatedAt =
    props["Updated"]?.type === "last_edited_time"
      ? props["Updated"].last_edited_time
      : page.last_edited_time

  const candidate: ReviewPost = {
    id: page.id,
    slug,
    title,
    contentType: getSelect<ContentType>(props, "Content Type"),
    productType: getSelect<ProductType>(props, "Product Type"),
    productName: getText(props, "Product Name"),
    brand: getText(props, "Brand"),
    tags: getMultiSelect(props, "Tags"),
    rating: getNumber(props, "Rating"),
    price: getNumber(props, "Price"),
    description: getText(props, "Description"),
    coverImage: getCoverImage(page),
    seoTitle: getText(props, "SEO Title"),
    seoDescription: getText(props, "SEO Description"),
    publishedAt: getDate(props, "Published At"),
    updatedAt,
    featured: getCheckbox(props, "Featured"),
    notionUrl: page.url,
  }

  // Runtime validation so “bad CMS data fails clearly”
  const parsed = ReviewPostSchema.safeParse(candidate)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    throw new Error(`Invalid ReviewPost for page ${page.id} (${slug}): ${issues}`)
  }

  return parsed.data
}

// ── Query builders ───────────────────────────────────────────────────────────

function buildPublishedFilter() {
  // Always require Published checkbox per spec.
  const baseAnd: any[] = [{ property: "Published", checkbox: { equals: true } }]

  if (PUBLISHED_MODE === "checkboxOnly") {
    return { and: baseAnd }
  }

  // In Notion query API, filtering on a missing property can error depending on DB schema.
  // We *cannot* express “only enforce Status when available” purely in the API filter
  // unless we know the DB definitely has Status.
  //
  // Strategy:
  // - preferStatus: query by Published only, then post-filter by Status if the property exists on returned pages.
  // - requireStatus: include Status in API filter (fastest, strictest).
  if (PUBLISHED_MODE === "requireStatus") {
    baseAnd.push({ property: "Status", status: { equals: "Published" } })
  }

  return { and: baseAnd }
}

function statusPostFilterIfNeeded(page: PageObjectResponse): boolean {
  if (PUBLISHED_MODE === "checkboxOnly") return true
  if (PUBLISHED_MODE === "requireStatus") return true // already enforced in API

  // preferStatus
  const props = page.properties
  if (!hasStatusProperty(props)) return true
  return getStatusName(props) === "Published"
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getPublishedPosts(): Promise<ReviewPost[]> {
  const notion = getNotionClient()

  const response = await notion.dataSources.query({
    data_source_id: NOTION_DATA_SOURCE_ID,
    filter: buildPublishedFilter(),
    sorts: [{ property: "Published At", direction: "descending" }],
  })

  return response.results
    .filter((p): p is PageObjectResponse => p.object === "page")
    .filter(statusPostFilterIfNeeded)
    .map(pageToReviewPost)
}

export async function getPostBySlug(slug: string): Promise<ReviewPost | null> {
  const notion = getNotionClient()

  const response = await notion.dataSources.query({
    data_source_id: NOTION_DATA_SOURCE_ID,
    filter: {
      and: [
        ...buildPublishedFilter().and,
        { property: "Canonical Slug", rich_text: { equals: slug } },
      ],
    },
    page_size: 1,
  })

  const pages = response.results.filter((p): p is PageObjectResponse => p.object === "page")
  const page = pages.find(statusPostFilterIfNeeded)
  return page ? pageToReviewPost(page) : null
}

/**
 * Returns a de-duped, sorted list of all tags used by published posts.
 * (This is simple + stable; if you later need counts, return a map.)
 */
export async function getAllTags(): Promise<string[]> {
  const posts = await getPublishedPosts()
  const set = new Set<string>()
  for (const p of posts) for (const t of p.tags) set.add(t)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

/**
 * Practical related-posts heuristic:
 * - Prefer same productType, then overlap tags
 * - Exclude same slug
 * - Returns up to `limit` posts
 */
export async function getRelatedPosts(
  post: ReviewPost,
  opts?: { limit?: number }
): Promise<ReviewPost[]> {
  const limit = opts?.limit ?? 4
  const all = await getPublishedPosts()

  const targetTags = new Set(post.tags)
  const score = (p: ReviewPost) => {
    if (p.slug === post.slug) return -1
    let s = 0
    if (post.productType && p.productType === post.productType) s += 3
    if (post.contentType && p.contentType === post.contentType) s += 1
    for (const t of p.tags) if (targetTags.has(t)) s += 2
    return s
  }

  return all
    .map((p) => ({ p, s: score(p) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ p }) => p)
}

/**
 * Fetches the page blocks for rendering.
 * - Accepts a page id or a page url.
 * - Handles pagination.
 */
export async function getPostBlocks(pageIdOrUrl: string) {
  const notion = getNotionClient()
  const blockId = extractPageId(pageIdOrUrl)

  const results: any[] = []
  let cursor: string | undefined = undefined

  while (true) {
    const resp = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    })

    results.push(...resp.results)
    if (!resp.has_more) break
    cursor = resp.next_cursor ?? undefined
  }

  return results
}