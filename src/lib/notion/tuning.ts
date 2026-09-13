import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import type { Tuning } from "../cms/types"

/**
 * Notion → Tuning extraction.
 *
 * Lives in its own module rather than in the adapter because it is pure mapping
 * with no client or configuration dependency — the adapter throws at import
 * time when `NOTION_DATA_SOURCE_ID` is unset, which would make this
 * untestable. Same separation as `images.ts`.
 */

/** Notion property name → domain key. */
export const TUNING_FIELDS: readonly [keyof Tuning, string][] = [
  ["subBass", "Sub Bass"],
  ["bass", "Bass"],
  ["mids", "Mids"],
  ["upperMids", "Upper Mids"],
  ["treble", "Treble"],
]

/** Documented authorable range; values outside it are CMS mistakes. */
export const BAND_MIN = -5
export const BAND_MAX = 5

function numberProp(props: PageObjectResponse["properties"], name: string): number | null {
  const prop = props[name]
  if (prop?.type === "number" && prop.number !== null) return prop.number
  return null
}

/**
 * Reads the five tuning bands.
 *
 * Returns `null` unless at least one band carries a value, so "unauthored"
 * stays distinguishable from "authored as neutral" — the compare tool must not
 * present an absence as a judgement (DESIGN.md §8).
 *
 * Every field is optional, preserving Epic 02's guarantee that missing CMS
 * fields never break the build.
 */
export function getTuning(props: PageObjectResponse["properties"]): Tuning | null {
  const tuning: Tuning = {}
  let authored = false

  for (const [key, field] of TUNING_FIELDS) {
    const value = numberProp(props, field)
    if (value === null) continue
    authored = true
    // Clamp at the boundary: a value typed outside the documented range is a
    // CMS mistake, and silently rendering a 40 dB spike would misinform.
    tuning[key] = Math.max(BAND_MIN, Math.min(BAND_MAX, value))
  }

  return authored ? tuning : null
}
