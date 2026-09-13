/**
 * Tuning-signature curve generation.
 *
 * A "tuning signature" is five subjective band values authored by CJ, summed as
 * Gaussian bumps in log-frequency space over a gentle baseline tilt. The result
 * looks like a frequency-response graph and is the data behind the hero trace
 * and (in Phase 3) the A/B comparison tool.
 *
 * These curves are AUTHORED, NOT MEASURED. Every view that renders one must
 * carry the honesty label required by DESIGN.md §8. See `isAuthored`.
 *
 * Pure and deterministic by design — this is the one piece of real domain logic
 * in the codebase, and a silently wrong curve misinforms readers rather than
 * merely looking wrong. Tested in `curve.test.ts`.
 */

export interface TuningInput {
  /** Each −5…+5. A missing band is treated as 0 (neutral), not as unauthored. */
  subBass?: number
  bass?: number
  mids?: number
  upperMids?: number
  treble?: number
}

export interface CurvePoint {
  hz: number
  db: number
}

export const MIN_HZ = 20
export const MAX_HZ = 20_000
/** Samples across the audible range. Dense enough to render as a smooth spline. */
export const SAMPLE_COUNT = 240
/** Display clamp, in dB either side of the baseline. */
export const DB_LIMIT = 12

interface Band {
  key: keyof TuningInput
  /** Notion property name this band is authored under. */
  field: string
  centerHz: number
  /** Gaussian width in octaves. */
  widthOct: number
}

export const BANDS: readonly Band[] = [
  { key: "subBass", field: "Sub Bass", centerHz: 40, widthOct: 1.0 },
  { key: "bass", field: "Bass", centerHz: 120, widthOct: 1.1 },
  { key: "mids", field: "Mids", centerHz: 700, widthOct: 1.4 },
  { key: "upperMids", field: "Upper Mids", centerHz: 3000, widthOct: 0.9 },
  { key: "treble", field: "Treble", centerHz: 8000, widthOct: 1.2 },
] as const

/**
 * Flat to 1 kHz, then −1.5 dB/octave, normalised so 1 kHz reads 0 dB.
 * Gives an unauthored curve a natural downward slope rather than a dead line.
 */
export function baselineDb(hz: number): number {
  if (hz <= 1000) return 0
  return -1.5 * Math.log2(hz / 1000)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Log-spaced frequencies from MIN_HZ to MAX_HZ inclusive. */
export function sampleFrequencies(count: number = SAMPLE_COUNT): number[] {
  const ratio = MAX_HZ / MIN_HZ
  return Array.from({ length: count }, (_, i) => MIN_HZ * Math.pow(ratio, i / (count - 1)))
}

/** Sum of the authored bands' Gaussian contributions at one frequency. */
function bandsDb(hz: number, input: TuningInput): number {
  let total = 0
  for (const band of BANDS) {
    const value = input[band.key]
    if (typeof value !== "number" || value === 0) continue
    const octavesAway = Math.log2(hz / band.centerHz)
    total += value * Math.exp(-0.5 * Math.pow(octavesAway / band.widthOct, 2))
  }
  return total
}

/**
 * Whether a curve reflects authored values. `null` means nobody has authored a
 * tuning signature — deliberately distinct from an object of zeroes, which means
 * "authored as neutral".
 */
export function isAuthored(input: TuningInput | null | undefined): boolean {
  return input != null
}

/**
 * Generates the curve. A `null` input returns the baseline alone, which callers
 * must label as unauthored rather than presenting as a real signature.
 */
export function generateCurve(
  input: TuningInput | null,
  count: number = SAMPLE_COUNT
): CurvePoint[] {
  return sampleFrequencies(count).map((hz) => {
    const db = baselineDb(hz) + (input ? bandsDb(hz, input) : 0)
    return { hz, db: clamp(db, -DB_LIMIT, DB_LIMIT) }
  })
}

// ── Rendering helpers ────────────────────────────────────────────────────────
// Shared by the hero trace and, in Phase 3, the compare graph, so both place a
// given frequency at the same x.

/** Maps a frequency to 0…1 across the log axis. */
export function hzToUnit(hz: number): number {
  return Math.log(clamp(hz, MIN_HZ, MAX_HZ) / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)
}

/** Maps 0…1 back to a frequency — for reading out the value under a cursor. */
export function unitToHz(unit: number): number {
  return MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, clamp(unit, 0, 1))
}

/** Maps dB to 0…1, where 0 is the top of the plot. */
export function dbToUnit(db: number, limit: number = DB_LIMIT): number {
  return 0.5 - clamp(db, -limit, limit) / (limit * 2)
}

/**
 * Builds an SVG/canvas path through the points using a Catmull-Rom spline
 * converted to cubic beziers, so the trace reads as a drawn curve rather than a
 * polyline.
 */
export function catmullRomPath(
  points: { x: number; y: number }[],
  tension: number = 1
): string {
  if (points.length === 0) return ""
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  }

  const segments: string[] = [`M${points[0].x},${points[0].y}`]

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2

    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension

    segments.push(`C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`)
  }

  return segments.join(" ")
}

/**
 * Linear interpolation between two curves, for the hero's scroll morph.
 *
 * The endpoints are returned exactly rather than computed: `from + (to - from)`
 * is not bit-identical to `to` in floating point, and the morph must land
 * precisely on the target curve rather than a rounding error away from it.
 */
export function lerpCurves(from: CurvePoint[], to: CurvePoint[], t: number): CurvePoint[] {
  const amount = clamp(t, 0, 1)

  if (amount === 0) return from.map((point) => ({ hz: point.hz, db: point.db }))
  if (amount === 1) return from.map((point, i) => ({ hz: point.hz, db: to[i]?.db ?? point.db }))

  return from.map((point, i) => ({
    hz: point.hz,
    db: point.db + ((to[i]?.db ?? point.db) - point.db) * amount,
  }))
}

/** Reads the dB value at a frequency by interpolating between samples. */
export function dbAtHz(curve: CurvePoint[], hz: number): number {
  if (curve.length === 0) return 0
  const target = clamp(hz, MIN_HZ, MAX_HZ)

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i]
    const b = curve[i + 1]
    if (target >= a.hz && target <= b.hz) {
      const span = Math.log(b.hz / a.hz)
      const t = span === 0 ? 0 : Math.log(target / a.hz) / span
      return a.db + (b.db - a.db) * t
    }
  }

  return curve[curve.length - 1].db
}

// ── Phase 2 scaffolding ──────────────────────────────────────────────────────

/**
 * Derives a stand-in tuning signature from a review's rating and type, so the
 * hero has visibly different curves to morph between before the Notion fields
 * exist.
 *
 * DELETE IN PHASE 3, once real authored values are available. Anything rendered
 * from this must be labelled unauthored — it is not CJ's judgement, it is a hash.
 */
export function placeholderTuning(seed: string, rating: number | null): TuningInput {
  // Small deterministic string hash: same slug always yields the same curve.
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  const pick = (offset: number, spread: number) => {
    const n = ((h >>> offset) & 0xff) / 255 // 0…1
    return (n * 2 - 1) * spread
  }

  // Better-rated gear leans slightly flatter; the hash supplies the character.
  const restraint = rating === null ? 1 : 1 - clamp(rating, 0, 100) / 220

  return {
    subBass: pick(0, 5) * restraint,
    bass: pick(4, 4.5) * restraint,
    mids: pick(8, 2.5) * restraint,
    upperMids: pick(12, 4) * restraint,
    treble: pick(16, 4.5) * restraint,
  }
}
