import type { Bundle } from './schema'
import { defaultScenario, regime } from './lib'
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
export function recentCec(bundle: Bundle) {
  const cec = bundle.draws.filter((d) => d.category === 'CEC')
  const latest = cec.at(-1)
  const draws = cec.filter((d) => d.regime === latest?.regime).slice(-6)
  const sizes = draws.map((d) => d.invitations)
  const gaps = draws
    .slice(1)
    .map((d, i) => (Date.parse(d.date) - Date.parse(draws[i].date)) / 86400000)
    .filter((n) => n > 0)
  const size = sizes.length
    ? Math.min(10000, Math.max(100, Math.round(median(sizes) / 100) * 100))
    : defaultScenario.draw_size
  const interval = gaps.length
    ? Math.min(60, Math.max(7, Math.round(median(gaps))))
    : defaultScenario.interval_days
  return {
    draws,
    size,
    interval,
    min: sizes.length ? Math.min(...sizes) : 0,
    max: sizes.length ? Math.max(...sizes) : 0,
    hasGaps: gaps.length > 0,
  }
}
export function nextIllustrativeDate(last: string, interval: number, today: string) {
  return new Date(Math.max(Date.parse(last) + interval * 86400000, Date.parse(today) + 86400000))
    .toISOString()
    .slice(0, 10)
}
export function policyAnnouncement(bundle: Bundle, today: string) {
  return bundle.policies
    .filter(
      (p) =>
        p.kind === 'scoring' &&
        Date.parse(today) >= Date.parse(p.date) - 45 * 86400000 &&
        Date.parse(today) < Date.parse(p.date) + 30 * 86400000,
    )
    .at(-1)
}
export const modelIsCurrent = (bundle: Bundle, today: string) =>
  !!bundle.backtests.model && bundle.backtests.model.regime === regime(today)
