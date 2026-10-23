import { describe, expect, it } from 'vitest'
import snapshot from './data/snapshot.json'
import { bundleSchema } from './schema'
import { modelIsCurrent, nextIllustrativeDate, policyAnnouncement, recentCec } from './runtime'
import { defaultScenario, scenarioPoints } from './lib'
const bundle = bundleSchema.parse(snapshot)
describe('live data and calendar behavior', () => {
  it('derives recent defaults from six same-rule CEC draws, ignoring larger other-program draws', () => {
    const r = recentCec(bundle)
    expect(r.draws).toHaveLength(6)
    expect(r.draws.every((d) => d.category === 'CEC')).toBe(true)
    expect(r.size).toBe(2000)
    expect(r.interval).toBe(14)
    const future = {
      ...r.draws.at(-1)!,
      id: 'future',
      date: '2027-01-02',
      regime: '2026-lmi',
      invitations: 4500,
    }
    expect(recentCec({ ...bundle, draws: [...bundle.draws, future] }).size).toBe(4500)
  })
  it('retires the banner 30 days after the change, while old models stay gated', () => {
    expect(policyAnnouncement(bundle, '2026-10-21')?.date).toBe('2026-11-03')
    expect(policyAnnouncement(bundle, '2026-11-03')?.date).toBe('2026-11-03')
    expect(policyAnnouncement(bundle, '2026-12-03')).toBeUndefined()
    expect(modelIsCurrent(bundle, '2026-10-21')).toBe(true)
    expect(modelIsCurrent(bundle, '2026-12-03')).toBe(false)
  })
  it('keeps hypothetical dates in the future and uses the actual gap for the first step', () => {
    expect(nextIllustrativeDate('2026-10-15', 14, '2026-10-21')).toBe('2026-10-29')
    expect(nextIllustrativeDate('2026-10-15', 7, '2026-10-25')).toBe('2026-10-26')
    const points = scenarioPoints(bundle, { ...defaultScenario, first_draw_date: '2026-11-01' })
    expect(points[1].date).toBe('2026-11-01')
    expect(points[2].date).toBe('2026-11-15')
    expect(points[1].cutoff).toBeGreaterThanOrEqual(
      scenarioPoints(bundle, defaultScenario)[1].cutoff,
    )
  })
})
