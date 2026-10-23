import type { Pool } from './schema'

// Fritsch–Butland monotone cubic interpolation, matching scipy.interpolate.PchipInterpolator.
// We interpolate cumulative counts, then difference at half-integer score edges.
export function reconstructPool(pool: Pool) {
  const bands = [...pool.bands].sort((a, b) => a.min - b.min)
  let next = 0,
    total = 0
  for (const b of bands) {
    if (
      ![b.min, b.max, b.count].every(Number.isInteger) ||
      b.min !== next ||
      b.max < b.min ||
      b.max > 1200 ||
      b.count < 0
    )
      throw new Error('Invalid pool bands')
    next = b.max + 1
    total += b.count
  }
  if (next !== 1201 || total !== pool.total || total <= 0)
    throw new Error('Pool does not reconcile')
  const x = [-0.5, ...bands.map((b) => b.max + 0.5)]
  const y = [0]
  bands.forEach((b) => y.push(y.at(-1)! + b.count))
  const h = x.slice(1).map((v, i) => v - x[i])
  const delta = h.map((v, i) => (y[i + 1] - y[i]) / v)
  const edge = (h0: number, h1: number, d0: number, d1: number) => {
    const d = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
    if (Math.sign(d) !== Math.sign(d0)) return 0
    return Math.sign(d0) !== Math.sign(d1) && Math.abs(d) > 3 * Math.abs(d0) ? 3 * d0 : d
  }
  const slopes = [delta.length === 1 ? delta[0] : edge(h[0], h[1], delta[0], delta[1])]
  for (let i = 1; i < x.length - 1; i++) {
    const a = delta[i - 1],
      b = delta[i],
      w1 = 2 * h[i] + h[i - 1],
      w2 = h[i] + 2 * h[i - 1]
    slopes.push(a * b <= 0 ? 0 : (w1 + w2) / (w1 / a + w2 / b))
  }
  const n = delta.length - 1
  slopes.push(n === 0 ? delta[0] : edge(h[n], h[n - 1], delta[n], delta[n - 1]))
  const cdf = (v: number, i: number) => {
    const t = (v - x[i]) / h[i],
      t2 = t * t,
      t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * y[i] +
      (t3 - 2 * t2 + t) * h[i] * slopes[i] +
      (-2 * t3 + 3 * t2) * y[i + 1] +
      (t3 - t2) * h[i] * slopes[i + 1]
    )
  }
  let remaining = total
  const rows: {
    score: number
    uniform: number
    smooth: number
    lower: number
    upper: number
    uniformAbove: number
    smoothAbove: number
  }[] = []
  bands.forEach((b, i) => {
    const counts = Array.from({ length: b.max - b.min + 1 }, (_, j) =>
      Math.max(0, cdf(b.min + j + 0.5, i) - cdf(b.min + j - 0.5, i)),
    )
    const mass = counts.reduce((a, b) => a + b, 0)
    remaining -= b.count
    counts.forEach((count, j) =>
      rows.push({
        score: b.min + j,
        uniform: b.count / counts.length,
        smooth: mass ? (count * b.count) / mass : 0,
        lower: remaining,
        upper: remaining + (b.min + j === b.max ? 0 : b.count),
        uniformAbove: 0,
        smoothAbove: 0,
      }),
    )
  })
  let uniform = 0,
    smooth = 0
  for (let s = 1200; s >= 0; s--) {
    rows[s].uniformAbove = Math.max(rows[s].lower, Math.min(rows[s].upper, uniform))
    rows[s].smoothAbove = Math.max(rows[s].lower, Math.min(rows[s].upper, smooth))
    uniform += rows[s].uniform
    smooth += rows[s].smooth
  }
  return rows
}
