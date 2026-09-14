import type { ReviewPost } from "./types"

/**
 * Aggregate figures describing what the site currently holds.
 *
 * The About page makes claims about the catalogue ("12 reviews, £15 to £100").
 * Those are derived here rather than written into the page, so publishing a new
 * review updates the prose instead of quietly contradicting it.
 */

export interface Range {
  min: number
  max: number
}

export interface CatalogueSummary {
  total: number
  listening: number
  games: number
  priceRange: Range | null
  scoreRange: Range | null
}

/**
 * A range over the posts that actually carry the value. Posts missing it are
 * skipped rather than counted as 0, which would drag `min` to zero and make the
 * published range wrong. Returns null when nobody carries the value at all, so
 * the caller can omit the row instead of printing a meaningless "0 – 0".
 */
function rangeOf(posts: ReviewPost[], pick: (post: ReviewPost) => number | null): Range | null {
  const values = posts.map(pick).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}

export function summariseCatalogue(posts: ReviewPost[]): CatalogueSummary {
  return {
    // Every published post, including any whose product type fits neither
    // bucket — the figures are shown together and must be seen to add up.
    total: posts.length,
    listening: posts.filter((p) => p.productType === "IEM" || p.productType === "Headphone").length,
    games: posts.filter((p) => p.productType === "Game").length,
    priceRange: rangeOf(posts, (p) => p.price),
    scoreRange: rangeOf(posts, (p) => p.rating),
  }
}
