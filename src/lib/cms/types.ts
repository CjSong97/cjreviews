export type ContentType = "Review" | "Article" | "Guide"
export type ProductType = "IEM" | "Headphone" | "Game" | "Other"

/**
 * Five subjective band values authored by CJ in Notion, each −5…+5.
 *
 * A `null` tuning means nobody has authored one — deliberately distinct from an
 * object of zeroes, which means "authored as neutral". Missing individual bands
 * within a non-null object are treated as 0.
 */
export interface Tuning {
  subBass?: number
  bass?: number
  mids?: number
  upperMids?: number
  treble?: number
}

export interface ReviewPost {
  // Identity
  id: string          // Notion page ID (last segment of URL)
  slug: string        // Canonical slug (preferred) or formula fallback
  title: string

  // Editorial
  contentType: ContentType | null
  productType: ProductType | null
  productName: string | null
  brand: string | null
  tags: string[]

  // Review data
  rating: number | null    // 0–100
  price: number | null     // GBP

  // Content
  description: string | null
  coverImage: string | null  // First file URL if present

  // Tuning signature (authored, not measured — see DESIGN.md §8)
  tuning: Tuning | null      // null = unauthored, {} = authored as neutral
  tuningNote: string | null  // one-line descriptor

  // SEO overrides
  seoTitle: string | null
  seoDescription: string | null

  // Dates
  publishedAt: string | null  // ISO date string
  updatedAt: string           // ISO datetime string

  // Meta
  featured: boolean
  notionUrl: string
}