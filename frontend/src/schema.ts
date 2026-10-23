import { z } from 'zod'
const numeric = z.number().finite()
const sourceSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  fetched_at: z.string().datetime({ offset: true }),
  sha256: z.string(),
  raw_path: z.string(),
  parser_version: z.string(),
})
export const drawSchema = z.object({
  id: z.string(),
  date: z.string(),
  category: z.string(),
  category_raw: z.string(),
  invitations: numeric.int().positive(),
  cutoff: numeric.int().min(0).max(1200),
  tie_break: z.string().nullable(),
  source_url: z.string().url(),
  source_fetch_id: z.string(),
  regime: z.string(),
})
const poolSchema = z.object({
  date: z.string(),
  total: numeric.int(),
  bands: z.array(z.object({ min: numeric, max: numeric, count: numeric })),
  source_url: z.string().url(),
  source_fetch_id: z.string(),
})
const intervalSchema = z.object({
  n: numeric,
  coverage: numeric.nullable(),
  width: numeric.nullable(),
})
const metricSchema = z.object({
  id: z.string(),
  name: z.string(),
  n: numeric,
  mae: numeric.nullable(),
  median_error: numeric.nullable(),
  intervals: z.record(intervalSchema),
})
const periodSchema = z.object({
  regime: z.string(),
  start: z.string(),
  end: z.string(),
  draw_count: numeric,
  metrics: z.array(metricSchema),
  points: z.array(
    z.object({
      date: z.string(),
      actual: numeric,
      predictions: z.record(numeric),
      train_end: z.string(),
      train_count: numeric,
    }),
  ),
})
const modelSchema = z.object({
  version: z.string(),
  coefficients: z.array(numeric).length(4),
  regime: z.string(),
  last_draw: drawSchema,
  training_count: numeric,
  residual_count: numeric,
  residual_radius: numeric.nullable(),
  validation_passed: z.boolean(),
  draw_size_range: z.array(numeric).length(2),
  interval_range: z.array(numeric).length(2),
})
export const bundleSchema = z.object({
  schema_version: z.literal(1),
  source: sourceSchema,
  draws: z.array(drawSchema).min(1),
  pool_snapshots: z.array(poolSchema),
  policies: z.array(
    z.object({
      date: z.string(),
      title: z.string(),
      description: z.string(),
      kind: z.string(),
      url: z.string().url(),
    }),
  ),
  audit: z.object({
    draw_count: numeric,
    pool_count: numeric,
    first_draw: z.string(),
    last_draw: z.string(),
    issues: z.array(z.string()),
    missing: z.record(numeric),
    categories: z.record(numeric),
  }),
  backtests: z.object({
    version: z.string(),
    periods: z.array(periodSchema),
    model: modelSchema.nullable(),
    notes: z.array(z.string()),
  }),
  status: z
    .object({
      stale: z.boolean(),
      last_refresh: z
        .object({ ok: z.boolean(), error: z.string().nullable(), attempted_at: z.string() })
        .nullable(),
    })
    .optional(),
})
export type Bundle = z.infer<typeof bundleSchema>
export type Draw = z.infer<typeof drawSchema>
export type Pool = z.infer<typeof poolSchema>
export type ScenarioInput = {
  crs_score: number
  first_draw_date?: string | null
  draw_size: number
  interval_days: number
  horizon_draws: number
  assumptions: 'base' | 'optimistic' | 'conservative'
}
export type ScenarioPoint = {
  step: number
  date: string
  cutoff: number
  low: number
  high: number
  crosses_policy: boolean
}
