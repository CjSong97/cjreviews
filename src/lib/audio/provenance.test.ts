import { describe, expect, it } from "vitest"
import { TRACE_LABELS, decorativeTrace, generateCurve, isAuthored } from "./curve"

/**
 * The honesty constraint (DESIGN.md §8) is a correctness requirement, so it gets
 * tests rather than trust. The specific failure guarded against here is real: an
 * earlier build labelled hash-derived decorative traces as "authored by CJ".
 */
describe("trace provenance labels", () => {
  it("only the authored label claims CJ authored it", () => {
    expect(TRACE_LABELS.authored).toContain("authored by CJ")
    expect(TRACE_LABELS.decorative).not.toContain("authored by CJ")
  })

  it("both labels deny being measured data", () => {
    expect(TRACE_LABELS.authored).toMatch(/not measured data/i)
    // The decorative label must not imply measurement either.
    expect(TRACE_LABELS.decorative).not.toMatch(/measured/i)
  })

  it("the decorative label says no signature exists", () => {
    expect(TRACE_LABELS.decorative).toMatch(/no tuning signature/i)
  })
})

describe("isAuthored decides which label applies", () => {
  it("is false for an absent tuning, so the decorative label is used", () => {
    expect(isAuthored(null)).toBe(false)
    expect(isAuthored(undefined)).toBe(false)
  })

  it("is true for any authored object, including neutral", () => {
    expect(isAuthored({})).toBe(true)
    expect(isAuthored({ bass: 0 })).toBe(true)
    expect(isAuthored({ bass: 3 })).toBe(true)
  })
})

describe("decorativeTrace is not a judgement", () => {
  it("depends only on slug and rating, never on product qualities", () => {
    // Same slug and rating always give the same trace: it carries no opinion.
    expect(decorativeTrace("x", 70)).toEqual(decorativeTrace("x", 70))
  })

  it("produces a usable curve so the hero never renders empty", () => {
    const curve = generateCurve(decorativeTrace("blon-bl-03", 74))
    expect(curve.length).toBeGreaterThan(0)
    for (const p of curve) expect(Number.isFinite(p.db)).toBe(true)
  })

  it("differs from the unauthored baseline, so the two are visually distinct", () => {
    const decorative = generateCurve(decorativeTrace("blon-bl-03", 74)).map((p) => p.db)
    const baseline = generateCurve(null).map((p) => p.db)
    expect(decorative).not.toEqual(baseline)
  })
})

describe("every honesty label lives in TRACE_LABELS", () => {
  it("only the authored labels claim CJ authored anything", () => {
    expect(TRACE_LABELS.authored).toContain("authored by CJ")
    expect(TRACE_LABELS.authoredPlural).toContain("authored by CJ")
    expect(TRACE_LABELS.decorative).not.toContain("authored by CJ")
    expect(TRACE_LABELS.noneAuthored).not.toContain("authored by CJ")
  })

  it("the plural form differs from the singular only in number", () => {
    expect(TRACE_LABELS.authoredPlural).toContain("signatures")
    expect(TRACE_LABELS.authored).toContain("signature,")
  })

  it("the none-authored label says it is not a comparison", () => {
    expect(TRACE_LABELS.noneAuthored).toMatch(/not a comparison/i)
  })

  it("all four labels are distinct", () => {
    const values = Object.values(TRACE_LABELS)
    expect(new Set(values).size).toBe(values.length)
  })
})
