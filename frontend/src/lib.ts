import type { Bundle, Draw, Pool, ScenarioInput, ScenarioPoint } from './schema'
export const LABELS: Record<string, string> = {
  CEC: 'Canadian Experience Class',
  PNP: 'Provincial Nominee Program',
  FRENCH: 'French-language proficiency',
  GENERAL: 'General',
  HEALTH: 'Healthcare & social services',
  TRADES: 'Trades occupations',
  STEM: 'STEM occupations',
  EDUCATION: 'Education occupations',
  TRANSPORT: 'Transport occupations',
  AGRICULTURE: 'Agriculture & agri-food',
  PHYSICIANS: 'Physicians · Canadian experience',
  MANAGERS: 'Senior managers · Canadian experience',
  MILITARY: 'Skilled military recruits',
  FSW: 'Federal Skilled Worker',
  FST: 'Federal Skilled Trades',
  OTHER: 'Other categories',
}
export const COLORS: Record<string, string> = {
  CEC: '#426951',
  FRENCH: '#b093ce',
  PNP: '#dca775',
  GENERAL: '#6c8dab',
  HEALTH: '#be7978',
  TRADES: '#b69a55',
}
export const formatNumber = (n: number) => new Intl.NumberFormat('en-CA').format(n)
export function dateLabel(value: string, full = false) {
  return new Date(value.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(full ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}
export const monthLabel = (value: number) =>
  new Date(value).toLocaleDateString('en-CA', { month: 'short', year: '2-digit', timeZone: 'UTC' })
export function regime(day: string) {
  return day >= '2026-11-03'
    ? '2026-lmi'
    : day >= '2026-02-18'
      ? '2026-categories'
      : day >= '2025-03-25'
        ? '2025-no-job-points'
        : 'historical-unmodeled'
}
export function scenarioPoints(bundle: Bundle, input: ScenarioInput): ScenarioPoint[] {
  const model = bundle.backtests.model
  if (!model || model.residual_radius === null) return []
  const last = model.last_draw
  const radius = model.residual_radius
  const shift = { base: 0, optimistic: -0.5, conservative: 0.5 }[input.assumptions] * radius
  const points: ScenarioPoint[] = [
    {
      step: 0,
      date: last.date,
      cutoff: last.cutoff,
      low: last.cutoff,
      high: last.cutoff,
      crosses_policy: false,
    },
  ]
  let previous = last.cutoff,
    invitations = last.invitations
  const round = (n: number) => Math.round(n * 10) / 10
  for (let step = 1; step <= input.horizon_draws; step++) {
    const day = new Date(
      input.first_draw_date
        ? Date.parse(input.first_draw_date) + (step - 1) * input.interval_days * 86400000
        : Date.parse(last.date) + step * input.interval_days * 86400000,
    )
      .toISOString()
      .slice(0, 10)
    const features = [
      1,
      Math.log(input.draw_size / invitations),
      ((step === 1 ? (Date.parse(day) - Date.parse(last.date)) / 86400000 : input.interval_days) -
        14) /
        14,
      (previous - 520) / 20,
    ]
    const cutoff = Math.max(
      0,
      Math.min(
        1200,
        previous + model.coefficients.reduce((sum, c, i) => sum + c * features[i], 0) + shift,
      ),
    )
    const width = radius * Math.sqrt(step)
    points.push({
      step,
      date: day,
      cutoff: round(cutoff),
      low: round(Math.max(0, cutoff - width)),
      high: round(Math.min(1200, cutoff + width)),
      crosses_policy: regime(day) !== model.regime,
    })
    previous = cutoff
    invitations = input.draw_size
  }
  return points
}
export function broadBands(pool: Pool) {
  return [
    [601, 1200],
    [501, 600],
    [451, 500],
    [401, 450],
    [351, 400],
    [301, 350],
    [0, 300],
  ].map(([min, max]) => ({
    min,
    max,
    count: pool.bands.filter((b) => b.min >= min && b.max <= max).reduce((s, b) => s + b.count, 0),
  }))
}
export function exportFile(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function csv(draws: Draw[]) {
  return [
    'round,date,category,cutoff_crs,invitations,tie_break,official_source',
    ...draws.map((d) =>
      [d.id, d.date, d.category_raw, d.cutoff, d.invitations, d.tie_break ?? '', d.source_url]
        .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
        .join(','),
    ),
  ].join('\r\n')
}
export const defaultScenario: ScenarioInput = {
  crs_score: 510,
  draw_size: 3000,
  interval_days: 14,
  horizon_draws: 6,
  assumptions: 'base',
}
