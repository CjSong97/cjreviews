import { describe, expect, it } from "vitest"
import { summariseCatalogue } from "./catalogue"
import type { ReviewPost } from "./types"

/**
 * The About page states what the site contains. Those figures are computed, not
 * written down, because a hardcoded count starts lying the day CJ publishes
 * anything. These tests pin the arithmetic and, more importantly, the absence
 * rules: an empty range must be omitted rather than rendered as 0 or "—".
 */

function post(overrides: Partial<ReviewPost>): ReviewPost {
  return {
    id: "x",
    slug: "x",
    title: "x",
    contentType: "Review",
    productType: "IEM",
    productName: null,
    brand: null,
    tags: [],
    rating: null,
    price: null,
    description: null,
    coverImage: null,
    tuning: null,
    tuningNote: null,
    seoTitle: null,
    seoDescription: null,
    publishedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    featured: false,
    notionUrl: "https://example.invalid",
    ...overrides,
  }
}

describe("summariseCatalogue — counts", () => {
  it("reports zero across the board for an empty catalogue", () => {
    const s = summariseCatalogue([])
    expect(s.total).toBe(0)
    expect(s.listening).toBe(0)
    expect(s.games).toBe(0)
  })

  it("groups IEMs and headphones together as listening gear", () => {
    const s = summariseCatalogue([
      post({ productType: "IEM" }),
      post({ productType: "IEM" }),
      post({ productType: "Headphone" }),
    ])
    expect(s.listening).toBe(3)
    expect(s.games).toBe(0)
    expect(s.total).toBe(3)
  })

  it("counts games separately and leaves Other out of both buckets", () => {
    const s = summariseCatalogue([
      post({ productType: "Game" }),
      post({ productType: "Other" }),
      post({ productType: null }),
    ])
    expect(s.games).toBe(1)
    expect(s.listening).toBe(0)
    // Total is every published post, including the ones that fit no bucket —
    // otherwise the three figures visibly fail to add up on the page.
    expect(s.total).toBe(3)
  })
})

describe("summariseCatalogue — ranges", () => {
  it("returns null ranges when nothing carries a value", () => {
    const s = summariseCatalogue([post({}), post({})])
    expect(s.priceRange).toBeNull()
    expect(s.scoreRange).toBeNull()
  })

  it("ignores posts missing the value rather than treating them as zero", () => {
    const s = summariseCatalogue([
      post({ price: 15, rating: 80 }),
      post({ price: null, rating: null }),
      post({ price: 100, rating: 95 }),
    ])
    expect(s.priceRange).toEqual({ min: 15, max: 100 })
    expect(s.scoreRange).toEqual({ min: 80, max: 95 })
  })

  it("collapses a single value into an equal min and max", () => {
    const s = summariseCatalogue([post({ price: 49.99 })])
    expect(s.priceRange).toEqual({ min: 49.99, max: 49.99 })
  })

  it("treats a genuine zero as a value, not as absent", () => {
    // A rating of 0 is a verdict. Filtering it out would silently raise the
    // bottom of the published score range.
    const s = summariseCatalogue([post({ rating: 0 }), post({ rating: 50 })])
    expect(s.scoreRange).toEqual({ min: 0, max: 50 })
  })
})
