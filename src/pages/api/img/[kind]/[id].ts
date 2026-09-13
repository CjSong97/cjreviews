import type { APIRoute } from "astro"
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import { getNotionClient } from "../../../../lib/notion/client"
import {
  resolveBlockImageSource,
  resolvePageCoverSource,
  type ImageSource,
} from "../../../../lib/notion/images"

/**
 * Streams a Notion-hosted image through a stable URL.
 *
 * Notion's own file URLs are signed and expire after an hour, so they cannot be
 * embedded in a page. This route takes the page/block id instead, asks Notion
 * for a freshly signed URL at request time, and returns the bytes.
 *
 * The response is cached immutably at the edge because callers version the URL
 * with `?v=<last_edited_time>` — see proxiedImageUrl().
 */

const IMMUTABLE = "public, max-age=0, s-maxage=31536000, immutable"
// Never cache a failure for long: a transient Notion error would otherwise
// blank out an image for as long as the success case is cached.
const ERROR_CACHE = "public, max-age=0, s-maxage=60"

const UUID = /^[a-f0-9]{32}$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
}

/**
 * Notion's S3 responses sometimes carry a bare `content-type: image`, which is
 * not a usable MIME type. Fall back to the file extension when the upstream
 * type isn't a complete `image/<subtype>`.
 */
function contentTypeFor(upstream: string | null, url: string): string {
  if (upstream && /^image\/[a-z0-9.+-]+$/i.test(upstream)) return upstream

  const ext = new URL(url).pathname.split(".").pop()?.toLowerCase()
  return (ext && EXT_TYPES[ext]) || "application/octet-stream"
}

function fail(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Cache-Control": ERROR_CACHE, "Content-Type": "text/plain" },
  })
}

async function sourceFor(kind: string, id: string): Promise<ImageSource | null> {
  const notion = getNotionClient()

  if (kind === "page") {
    const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse
    return resolvePageCoverSource(page)
  }

  const block = await notion.blocks.retrieve({ block_id: id })
  return resolveBlockImageSource(block)
}

export const GET: APIRoute = async ({ params }) => {
  const { kind, id } = params

  if (kind !== "page" && kind !== "block") return fail(404, "Unknown image kind")
  if (!id || !UUID.test(id)) return fail(400, "Malformed id")

  let source: ImageSource | null
  try {
    source = await sourceFor(kind, id)
  } catch {
    return fail(404, "Notion object not found")
  }

  if (!source) return fail(404, "No image on that object")

  const upstream = await fetch(source.url)
  if (!upstream.ok || !upstream.body) {
    return fail(502, `Upstream image fetch failed (${upstream.status})`)
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(upstream.headers.get("content-type"), source.url),
      "Cache-Control": IMMUTABLE,
    },
  })
}
