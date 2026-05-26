export type ContentType = "Review" | "Article" | "Guide"
export type ProductType = "IEM" | "Headphone" | "Game" | "Other"

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