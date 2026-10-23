import { describe, expect, it } from 'vitest'
import snapshot from './data/snapshot.json'
import reference from './data/scenario-reference.json'
import { bundleSchema } from './schema'
import type { ScenarioInput } from './schema'
import { broadBands, csv, defaultScenario, regime, scenarioPoints } from './lib'
const bundle = bundleSchema.parse(snapshot)
describe('official data and scenario calculations', () => {
  it('matches the Python API numerically for all reference scenarios', () => {
    expect(bundle.source.sha256).toBe(reference.source_sha256)
    for (const c of reference.cases)
      expect(scenarioPoints(bundle, c.input as ScenarioInput)).toEqual(c.points)
  })
  it('does not double-count pool subtotals', () => {
    for (const pool of bundle.pool_snapshots)
      expect(broadBands(pool).reduce((s, b) => s + b.count, 0)).toBe(pool.total)
  })
  it('marks policy boundaries and keeps ranges ordered', () => {
    expect(regime('2026-11-02')).toBe('2026-categories')
    expect(regime('2026-11-03')).toBe('2026-lmi')
    const points = scenarioPoints(bundle, defaultScenario)
    expect(points.some((p) => p.crosses_policy)).toBe(true)
    for (const p of points) {
      expect(p.low).toBeLessThanOrEqual(p.cutoff)
      expect(p.high).toBeGreaterThanOrEqual(p.cutoff)
    }
  })
  it('preserves official source and quoted raw category in CSV', () => {
    const row = { ...bundle.draws[0], category_raw: 'category, "version"' }
    const output = csv([row])
    expect(output).toContain('"category, ""version"""')
    expect(output).toContain(row.source_url)
  })
  it('rejects incompatible API schemas and invalid cutoffs', () => {
    expect(bundleSchema.safeParse({ ...snapshot, schema_version: 2 }).success).toBe(false)
    expect(
      bundleSchema.safeParse({ ...snapshot, draws: [{ ...snapshot.draws[0], cutoff: 1201 }] })
        .success,
    ).toBe(false)
  })
  it('returns no scenario for insufficient history', () => {
    expect(
      scenarioPoints(
        { ...bundle, backtests: { ...bundle.backtests, model: null } },
        defaultScenario,
      ),
    ).toEqual([])
  })
})
