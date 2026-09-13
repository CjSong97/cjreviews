import { describe, expect, it } from "vitest"
import {
  BANDS,
  DB_LIMIT,
  MAX_HZ,
  MIN_HZ,
  SAMPLE_COUNT,
  baselineDb,
  catmullRomPath,
  dbAtHz,
  dbToUnit,
  generateCurve,
  hzToUnit,
  isAuthored,
  lerpCurves,
  decorativeTrace,
  sampleFrequencies,
  unitToHz,
  type TuningInput,
} from "./curve"

/**
 * These tests exist because a silently wrong curve misinforms readers about real
 * products, rather than merely looking wrong (DESIGN.md §8).
 */

describe("sampleFrequencies", () => {
  it("spans exactly the audible range", () => {
    const hz = sampleFrequencies()
    expect(hz).toHaveLength(SAMPLE_COUNT)
    expect(hz[0]).toBeCloseTo(MIN_HZ, 6)
    expect(hz[hz.length - 1]).toBeCloseTo(MAX_HZ, 6)
  })

  it("is log-spaced, not linear", () => {
    const hz = sampleFrequencies(4)
    // Equal ratios between neighbours is what makes it logarithmic.
    const r1 = hz[1] / hz[0]
    const r2 = hz[2] / hz[1]
    const r3 = hz[3] / hz[2]
    expect(r2).toBeCloseTo(r1, 10)
    expect(r3).toBeCloseTo(r1, 10)
  })

  it("increases monotonically", () => {
    const hz = sampleFrequencies()
    for (let i = 1; i < hz.length; i++) expect(hz[i]).toBeGreaterThan(hz[i - 1])
  })
})

describe("baselineDb", () => {
  it("is flat below 1 kHz and 0 dB at 1 kHz", () => {
    expect(baselineDb(20)).toBe(0)
    expect(baselineDb(500)).toBe(0)
    expect(baselineDb(1000)).toBe(0)
  })

  it("tilts -1.5 dB per octave above 1 kHz", () => {
    expect(baselineDb(2000)).toBeCloseTo(-1.5, 10)
    expect(baselineDb(4000)).toBeCloseTo(-3.0, 10)
    expect(baselineDb(8000)).toBeCloseTo(-4.5, 10)
  })
})

describe("generateCurve — determinism", () => {
  it("returns identical output for identical input", () => {
    const input: TuningInput = { subBass: 3, bass: -2, mids: 1, upperMids: 4, treble: -1 }
    expect(generateCurve(input)).toEqual(generateCurve(input))
  })

  it("does not mutate its input", () => {
    const input: TuningInput = { bass: 3 }
    const copy = { ...input }
    generateCurve(input)
    expect(input).toEqual(copy)
  })
})

describe("generateCurve — clamping", () => {
  it("keeps extreme values within the display limit", () => {
    const extreme: TuningInput = {
      subBass: 1000,
      bass: 1000,
      mids: 1000,
      upperMids: 1000,
      treble: 1000,
    }
    for (const p of generateCurve(extreme)) {
      expect(p.db).toBeLessThanOrEqual(DB_LIMIT)
      expect(p.db).toBeGreaterThanOrEqual(-DB_LIMIT)
    }
  })

  it("clamps negative extremes too", () => {
    const negative: TuningInput = { subBass: -1000, bass: -1000, treble: -1000 }
    for (const p of generateCurve(negative)) {
      expect(p.db).toBeGreaterThanOrEqual(-DB_LIMIT)
    }
  })
})

describe("generateCurve — unauthored fallback", () => {
  it("returns the baseline alone for null", () => {
    for (const p of generateCurve(null)) {
      expect(p.db).toBeCloseTo(baselineDb(p.hz), 10)
    }
  })

  it("distinguishes unauthored from authored-as-neutral", () => {
    expect(isAuthored(null)).toBe(false)
    expect(isAuthored(undefined)).toBe(false)
    // An explicit object of zeroes is a judgement, not an absence.
    expect(isAuthored({})).toBe(true)
    expect(isAuthored({ bass: 0 })).toBe(true)
  })

  it("an empty object yields the same numbers as null but is flagged differently", () => {
    expect(generateCurve({}).map((p) => p.db)).toEqual(generateCurve(null).map((p) => p.db))
    expect(isAuthored({})).not.toBe(isAuthored(null))
  })
})

describe("generateCurve — partial input", () => {
  it("puts a bump at the authored band's centre frequency", () => {
    for (const band of BANDS) {
      const curve = generateCurve({ [band.key]: 5 } as TuningInput)
      const atCentre = dbAtHz(curve, band.centerHz) - baselineDb(band.centerHz)
      // A Gaussian peaks at its centre, so nearly the whole +5 lands here.
      expect(atCentre).toBeGreaterThan(4.5)
    }
  })

  it("leaves distant bands near the baseline", () => {
    const curve = generateCurve({ bass: 5 })
    const atTreble = dbAtHz(curve, 8000) - baselineDb(8000)
    expect(Math.abs(atTreble)).toBeLessThan(0.5)
  })

  it("treats a missing band as neutral", () => {
    const only = generateCurve({ bass: 3 })
    const explicit = generateCurve({ bass: 3, subBass: 0, mids: 0, upperMids: 0, treble: 0 })
    expect(only).toEqual(explicit)
  })
})

describe("generateCurve — monotonic sanity", () => {
  it("raising bass raises 120 Hz without materially moving 8 kHz", () => {
    const low = generateCurve({ bass: 1 })
    const high = generateCurve({ bass: 4 })

    expect(dbAtHz(high, 120)).toBeGreaterThan(dbAtHz(low, 120))
    expect(Math.abs(dbAtHz(high, 8000) - dbAtHz(low, 8000))).toBeLessThan(0.25)
  })

  it("is signed correctly: a negative band dips below the baseline", () => {
    const curve = generateCurve({ mids: -4 })
    expect(dbAtHz(curve, 700)).toBeLessThan(baselineDb(700))
  })
})

describe("axis mapping", () => {
  it("maps the range ends to 0 and 1", () => {
    expect(hzToUnit(MIN_HZ)).toBeCloseTo(0, 10)
    expect(hzToUnit(MAX_HZ)).toBeCloseTo(1, 10)
  })

  it("round-trips through unitToHz", () => {
    for (const hz of [20, 100, 1000, 5000, 20000]) {
      expect(unitToHz(hzToUnit(hz))).toBeCloseTo(hz, 6)
    }
  })

  it("clamps out-of-range frequencies rather than extrapolating", () => {
    expect(hzToUnit(1)).toBe(0)
    expect(hzToUnit(50_000)).toBe(1)
  })

  it("puts 0 dB at the vertical centre and inverts for screen coordinates", () => {
    expect(dbToUnit(0)).toBeCloseTo(0.5, 10)
    expect(dbToUnit(DB_LIMIT)).toBeCloseTo(0, 10)
    expect(dbToUnit(-DB_LIMIT)).toBeCloseTo(1, 10)
  })
})

describe("dbAtHz", () => {
  it("reads back the generated values at sample points", () => {
    const curve = generateCurve({ bass: 2 })
    const mid = curve[120]
    expect(dbAtHz(curve, mid.hz)).toBeCloseTo(mid.db, 8)
  })

  it("handles an empty curve without throwing", () => {
    expect(dbAtHz([], 1000)).toBe(0)
  })
})

describe("lerpCurves", () => {
  it("returns the endpoints at t=0 and t=1", () => {
    const a = generateCurve({ bass: 5 })
    const b = generateCurve({ treble: 5 })
    expect(lerpCurves(a, b, 0).map((p) => p.db)).toEqual(a.map((p) => p.db))
    expect(lerpCurves(a, b, 1).map((p) => p.db)).toEqual(b.map((p) => p.db))
  })

  it("clamps t outside 0…1", () => {
    const a = generateCurve({ bass: 5 })
    const b = generateCurve({ treble: 5 })
    expect(lerpCurves(a, b, -2)).toEqual(lerpCurves(a, b, 0))
    expect(lerpCurves(a, b, 9)).toEqual(lerpCurves(a, b, 1))
  })

  it("sits between the endpoints midway", () => {
    const a = generateCurve({ bass: 5 })
    const b = generateCurve({ bass: -5 })
    const mid = lerpCurves(a, b, 0.5)
    expect(dbAtHz(mid, 120)).toBeCloseTo((dbAtHz(a, 120) + dbAtHz(b, 120)) / 2, 8)
  })
})

describe("catmullRomPath", () => {
  it("returns an empty string for no points", () => {
    expect(catmullRomPath([])).toBe("")
  })

  it("degrades to a line for fewer than three points", () => {
    expect(catmullRomPath([{ x: 0, y: 1 }])).toBe("M0,1")
    expect(catmullRomPath([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe("M0,1 L2,3")
  })

  it("emits one cubic segment per gap and starts at the first point", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
    ]
    const path = catmullRomPath(points)
    expect(path.startsWith("M0,0")).toBe(true)
    expect(path.match(/C/g)).toHaveLength(points.length - 1)
  })

  it("produces no NaN for a real curve", () => {
    const points = generateCurve({ bass: 3 }).map((p, i) => ({ x: i, y: dbToUnit(p.db) * 100 }))
    expect(catmullRomPath(points)).not.toMatch(/NaN/)
  })
})

describe("decorativeTrace (decorative fallback)", () => {
  it("is deterministic per slug", () => {
    expect(decorativeTrace("truthear-hexa", 82)).toEqual(decorativeTrace("truthear-hexa", 82))
  })

  it("gives different slugs different characters", () => {
    const a = decorativeTrace("truthear-hexa", 82)
    const b = decorativeTrace("dunu-titan-s2", 82)
    expect(a).not.toEqual(b)
  })

  it("stays within the authorable range", () => {
    for (const slug of ["a", "blon-bl-03", "qkz-x-hbb", "fiio-fh5", ""]) {
      for (const rating of [null, 0, 55, 100]) {
        for (const value of Object.values(decorativeTrace(slug, rating))) {
          expect(Number.isFinite(value)).toBe(true)
          expect(Math.abs(value as number)).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it("produces a renderable curve", () => {
    const curve = generateCurve(decorativeTrace("blon-bl-03", 74))
    expect(curve).toHaveLength(SAMPLE_COUNT)
    for (const p of curve) expect(Number.isFinite(p.db)).toBe(true)
  })
})
