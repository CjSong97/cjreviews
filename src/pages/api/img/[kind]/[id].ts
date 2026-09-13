import type { APIRoute } from "astro"
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import sharp from "sharp"
import { getNotionClient } from "../../../../lib/notion/client"
import {
  ALLOWED_WIDTHS,
  resolveBlockImageSource,
  resolvePageCoverSource,
  type ImageSource,
} from "../../../../lib/notion/images"

/**
 * Streams a Notion-hosted image through a stable URL, optionally resized.
 *
 * Notion's own file URLs are signed and expire after an hour, so they cannot be
 * embedded in a page. This route takes the page/block id instead, asks Notion
 * for a freshly signed URL at request time, and returns the bytes.
 *
 * Resizing happens here rather than through Astro's <Image> or Vercel's Image
 * Optimization: we already own this route and its year-long immutable cache, so
 * doing the work inline costs no external quota and behaves identically in dev.
 * Source images are phone-camera originals — one cover is 3000x4000 at 2.3MB —
 * so serving them unresized at card size is the single biggest waste on the site.
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

/**
 * Widths are restricted to a fixed set so the number of cacheable variants
 * stays bounded — an open `w` parameter would let anyone mint unlimited
 * transformations against this function.
 */
function requestedWidth(raw: string | null): number | null {
  if (!raw) return null
  const w = Number(raw)
  return ALLOWED_WIDTHS.includes(w) ? w : null
}

export const GET: APIRoute = async ({ params, url }) => {
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

  const width = requestedWidth(url.searchParams.get("w"))
  const wantsWebp = url.searchParams.get("f") === "webp"

  // No transform requested: stream the original through untouched.
  if (width === null && !wantsWebp) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(upstream.headers.get("content-type"), source.url),
        "Cache-Control": IMMUTABLE,
      },
    })
  }

  try {
    const input = Buffer.from(await upstream.arrayBuffer())
    let pipeline = sharp(input).rotate() // honour EXIF orientation

    if (width !== null) {
      // withoutEnlargement: never upscale a source smaller than the slot.
      pipeline = pipeline.resize({ width, withoutEnlargement: true })
    }

    const output = wantsWebp
      ? await pipeline.webp({ quality: 80 }).toBuffer()
      : await pipeline.toBuffer()

    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": wantsWebp
          ? "image/webp"
          : contentTypeFor(upstream.headers.get("content-type"), source.url),
        "Cache-Control": IMMUTABLE,
      },
    })
  } catch {
    // A malformed or unsupported source (e.g. an SVG) still deserves to render,
    // so fall back to the original bytes rather than failing the image.
    const retry = await fetch(source.url)
    if (!retry.ok || !retry.body) return fail(502, "Image transform and refetch both failed")

    return new Response(retry.body, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(retry.headers.get("content-type"), source.url),
        "Cache-Control": IMMUTABLE,
      },
    })
  }
}
