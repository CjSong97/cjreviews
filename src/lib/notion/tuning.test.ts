import { describe, expect, it } from "vitest"
import { getTuning } from "./tuning"

/**
 * Tests the Notion→Tuning extraction against synthetic property payloads.
 *
 * Done this way deliberately: proving the pipeline by authoring values on a real
 * review would mean inventing tuning numbers for a real product, which is
 * exactly what the honesty constraint forbids (DESIGN.md §8).
 */

const num = (n: number | null) => ({ type: "number" as const, number: n, id: "x" })

function props(values: Record<string, number | null>): any {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, num(v)]))
}

describe("getTuning — authored vs unauthored", () => {
  it("returns null when no band property exists at all", () => {
    expect(getTuning({} as any)).toBeNull()
  })

  it("returns null when the properties exist but are all empty", () => {
    // This is the state right after the fields are added in Notion.
    const empty = props({
      "Sub Bass": null,
      Bass: null,
      Mids: null,
      "Upper Mids": null,
      Treble: null,
    })
    expect(getTuning(empty)).toBeNull()
  })

  it("returns an object as soon as one band carries a value", () => {
    expect(getTuning(props({ Bass: 3 }))).toEqual({ bass: 3 })
  })

  it("treats an authored zero as authored, not absent", () => {
    // The distinction the compare tool depends on: a deliberate neutral
    // judgement must not read as "nobody has assessed this".
    expect(getTuning(props({ Bass: 0 }))).toEqual({ bass: 0 })
    expect(getTuning(props({ Bass: 0 }))).not.toBeNull()
  })
})

describe("getTuning — field mapping", () => {
  it("maps every Notion field name to its camelCase key", () => {
    const all = props({
      "Sub Bass": 1,
      Bass: 2,
      Mids: 3,
      "Upper Mids": 4,
      Treble: 5,
    })
    expect(getTuning(all)).toEqual({
      subBass: 1,
      bass: 2,
      mids: 3,
      upperMids: 4,
      treble: 5,
    })
  })

  it("omits bands that are empty rather than defaulting them to 0", () => {
    const partial = props({ "Sub Bass": 2, Bass: null, Treble: -1 })
    expect(getTuning(partial)).toEqual({ subBass: 2, treble: -1 })
  })
})

describe("getTuning — boundary clamping", () => {
  it("clamps values typed outside the documented range", () => {
    // A 40 in Notion is a typo; rendering it as a 40 dB spike would misinform.
    expect(getTuning(props({ Bass: 40 }))).toEqual({ bass: 5 })
    expect(getTuning(props({ Treble: -99 }))).toEqual({ treble: -5 })
  })

  it("leaves in-range values untouched, including fractions", () => {
    expect(getTuning(props({ Mids: -2.5 }))).toEqual({ mids: -2.5 })
    expect(getTuning(props({ Mids: 5 }))).toEqual({ mids: 5 })
    expect(getTuning(props({ Mids: -5 }))).toEqual({ mids: -5 })
  })
})

describe("getTuning — ignores wrong-typed properties", () => {
  it("skips a band stored as text instead of a number", () => {
    const wrong: any = {
      Bass: { type: "rich_text", rich_text: [{ plain_text: "3" }] },
    }
    expect(getTuning(wrong)).toBeNull()
  })
})
