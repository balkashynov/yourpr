import { describe, it, expect } from 'vitest'
import snapshot from './data/snapshot.json'
import reference from './data/pool-reference.json'
import { reconstructPool } from './poolMath'
describe('Pool reconstruction', () => {
  it('matches the independent SciPy PCHIP reference at every score', () => {
    const pool = snapshot.pool_snapshots.find((p) => p.date === reference.observed_on)!
    const rows = reconstructPool(pool)
    reference.scores.forEach((expected, i) => {
      expect(rows[i].smooth).toBeCloseTo(expected.smooth_count, 6)
      expect(rows[i].smoothAbove).toBeCloseTo(expected.smooth_above, 6)
      expect(rows[i].uniformAbove).toBeCloseTo(expected.uniform_above, 6)
      expect([rows[i].lower, rows[i].upper]).toEqual([expected.lower_above, expected.upper_above])
    })
  })
  it('preserves every observed band for all historical snapshots and stays within sharp bounds', () => {
    for (const pool of snapshot.pool_snapshots) {
      const rows = reconstructPool(pool)
      for (const band of pool.bands) {
        const cells = rows.slice(band.min, band.max + 1)
        expect(cells.reduce((s, r) => s + r.smooth, 0)).toBeCloseTo(band.count, 6)
        expect(cells.reduce((s, r) => s + r.uniform, 0)).toBeCloseTo(band.count, 6)
        expect(rows[band.max].lower).toBe(rows[band.max].upper)
      }
      rows.forEach((r, i) => {
        expect(r.smooth).toBeGreaterThanOrEqual(0)
        expect(r.smoothAbove).toBeGreaterThanOrEqual(r.lower)
        expect(r.smoothAbove).toBeLessThanOrEqual(r.upper)
        if (i) expect(r.smoothAbove).toBeLessThanOrEqual(rows[i - 1].smoothAbove + 1e-8)
      })
    }
  })
  it('rejects malformed data instead of displaying a fabricated distribution', () => {
    const pool = snapshot.pool_snapshots.at(-1)!
    expect(() => reconstructPool({ ...pool, total: pool.total + 1 })).toThrow()
    expect(() => reconstructPool({ ...pool, bands: pool.bands.slice(1) })).toThrow()
  })
})
