import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"

/**
 * Notion-hosted files are served from S3 behind signed URLs that carry
 * `X-Amz-Expires=3600`. Writing one into a page means it 403s an hour later,
 * so we never hand those URLs to a browser: we emit a stable proxy path and
 * re-sign on demand in src/pages/api/img/[kind]/[id].ts.
 *
 * External URLs are passed through untouched — they never expire, so proxying
 * them would only cost us bandwidth.
 */

export type ImageSource = {
  /** "file" is Notion-hosted and expiring; "external" is a stable third-party URL. */
  type: "file" | "external"
  url: string
}

/**
 * Widths the proxy will resize to. Fixed rather than open-ended so the set of
 * cacheable variants is bounded and nobody can mint unlimited transformations.
 */
export const ALLOWED_WIDTHS = [320, 480, 640, 960, 1280, 1600] as const

/**
 * The proxy URL is versioned with the source object's `last_edited_time` so it
 * can be cached immutably: editing a page in Notion changes the timestamp,
 * which changes the cache key, so a swapped image appears immediately while an
 * unchanged one stays cached.
 */
function versionOf(lastEditedTime: string | undefined): string {
  const parsed = lastEditedTime ? Date.parse(lastEditedTime) : NaN
  return Number.isNaN(parsed) ? "0" : String(parsed)
}

export function proxiedImageUrl(
  kind: "page" | "block",
  id: string,
  lastEditedTime: string | undefined
): string {
  return `/api/img/${kind}/${id}?v=${versionOf(lastEditedTime)}`
}

/**
 * Returns the URL safe to put in HTML: a proxy path for expiring Notion files,
 * the original URL for external ones.
 */
export function toPublicImageUrl(
  source: ImageSource | null,
  kind: "page" | "block",
  id: string,
  lastEditedTime: string | undefined
): string | null {
  if (!source) return null
  if (source.type === "external") return source.url
  return proxiedImageUrl(kind, id, lastEditedTime)
}

/**
 * Builds a WebP `srcset` for an image already served by our proxy.
 *
 * Returns null for anything else — an external URL has no resizing endpoint, so
 * callers fall back to a plain `src`.
 */
export function proxySrcset(url: string | null): string | null {
  if (!url || !url.startsWith("/api/img/")) return null

  return ALLOWED_WIDTHS.map((w) => `${withParams(url, { w: String(w), f: "webp" })} ${w}w`).join(
    ", "
  )
}

/** Returns a single resized WebP variant, or the URL unchanged if not proxied. */
export function proxyVariant(url: string | null, width: number): string | null {
  if (!url) return null
  if (!url.startsWith("/api/img/")) return url
  return withParams(url, { w: String(width), f: "webp" })
}

function withParams(url: string, params: Record<string, string>): string {
  const [path, query = ""] = url.split("?")
  const search = new URLSearchParams(query)
  for (const [key, value] of Object.entries(params)) search.set(key, value)
  return `${path}?${search.toString()}`
}

/**
 * Resolves which image a page uses as its cover: the custom "Cover Image"
 * files property takes precedence over the native Notion page banner.
 *
 * Shared by the adapter (to build the public URL) and by the proxy route (to
 * re-sign it), so the two can never disagree about which file is the cover.
 */
export function resolvePageCoverSource(page: PageObjectResponse): ImageSource | null {
  const prop = page.properties["Cover Image"]
  if (prop?.type === "files" && prop.files.length > 0) {
    const first = prop.files[0]
    if (first.type === "file") return { type: "file", url: first.file.url }
    if (first.type === "external") return { type: "external", url: first.external.url }
  }

  if (page.cover) {
    if (page.cover.type === "file") return { type: "file", url: page.cover.file.url }
    if (page.cover.type === "external") return { type: "external", url: page.cover.external.url }
  }

  return null
}

/** Resolves the image URL of a Notion `image` block. */
export function resolveBlockImageSource(block: any): ImageSource | null {
  if (block?.type !== "image") return null
  const image = block.image
  if (image?.type === "file") return { type: "file", url: image.file.url }
  if (image?.type === "external") return { type: "external", url: image.external.url }
  return null
}
