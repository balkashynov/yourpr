import { useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowUpRight, ChartNoAxesCombined, Info } from 'lucide-react'
import type { Bundle } from './schema'
import { reconstructPool } from './poolMath'
import { dateLabel, formatNumber } from './lib'

export default function Distribution({
  bundle,
  score,
  onScore,
  onCalculate,
}: {
  bundle: Bundle
  score: number
  onScore: (n: number) => void
  onCalculate: () => void
}) {
  const [date, setDate] = useState('latest')
  const [method, setMethod] = useState<'smooth' | 'uniform'>('smooth')
  const [range, setRange] = useState<'focus' | 'all'>('focus')
  const pool =
    date === 'latest'
      ? bundle.pool_snapshots.at(-1)
      : bundle.pool_snapshots.find((p) => p.date === date)
  const rows = useMemo(() => (pool ? reconstructPool(pool) : []), [pool])
  if (!pool || !rows.length)
    return (
      <section className="panel">
        <h2>Pool data unavailable</h2>
        <p>A validated snapshot is needed to reconstruct the distribution.</p>
      </section>
    )
  const value = rows[score],
    band = pool.bands.find((b) => score >= b.min && score <= b.max)!
  const focusMin = score < 400 || score > 600 ? Math.max(0, score - 100) : 400
  const focusMax = score < 400 || score > 600 ? Math.min(1200, score + 100) : 600
  const view = range === 'all' ? rows : rows.slice(focusMin, focusMax + 1)
  const estimate = Math.round(method === 'smooth' ? value.smoothAbove : value.uniformAbove)
  return (
    <section className="panel distribution-panel" aria-labelledby="distribution-title">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">
            <ChartNoAxesCombined size={15} /> MODELED DISTRIBUTION
          </div>
          <h2 id="distribution-title">Where does your score fit?</h2>
        </div>
        <span className="tag amber">Estimate</span>
      </div>
      <p className="section-description">
        IRCC publishes score bands. These two models explore how candidates might be spread inside
        them.
      </p>
      <div className="distribution-controls">
        <label className="calc-field">
          <span>Pool snapshot</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="latest">
              Latest · {dateLabel(bundle.pool_snapshots.at(-1)!.date, true)}
            </option>
            {[...bundle.pool_snapshots]
              .reverse()
              .slice(1)
              .map((p) => (
                <option key={p.date} value={p.date}>
                  {dateLabel(p.date, true)}
                </option>
              ))}
          </select>
        </label>
        <label className="calc-field distribution-score">
          <span>Your CRS score</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1200}
            value={score}
            onChange={(e) => onScore(Math.max(0, Math.min(1200, Math.round(+e.target.value))))}
          />
        </label>
        <button className="text-button" onClick={onCalculate}>
          Calculate my score <ArrowUpRight size={15} />
        </button>
      </div>
      <label className="sr-only" htmlFor="distribution-score">
        Explore a CRS score
      </label>
      <input
        id="distribution-score"
        type="range"
        min={0}
        max={1200}
        value={score}
        onChange={(e) => onScore(+e.target.value)}
      />
      <div className="range-labels">
        <span>0 CRS</span>
        <span>1,200 CRS</span>
      </div>
      <div className="distribution-results" aria-live="polite" aria-atomic="true">
        <div className="distribution-estimate">
          <span>Modeled candidates above {score}</span>
          <strong>≈ {formatNumber(estimate)}</strong>
          <small>{method === 'smooth' ? 'Smooth' : 'Uniform'} allocation · excludes ties</small>
        </div>
        <div className="distribution-bounds">
          <span>What the observed bands allow</span>
          <strong>
            {value.lower === value.upper
              ? formatNumber(value.lower)
              : `${formatNumber(value.lower)}–${formatNumber(value.upper)}`}
          </strong>
          <small>
            {value.lower === value.upper
              ? 'Exact strictly-higher count at this band edge.'
              : 'Possible range, not a confidence interval.'}
          </small>
        </div>
      </div>
      <div className="chart-controls">
        <div className="pills" role="group" aria-label="Distribution model">
          {(['smooth', 'uniform'] as const).map((m) => (
            <button
              key={m}
              aria-pressed={method === m}
              className={method === m ? 'selected' : ''}
              onClick={() => setMethod(m)}
            >
              {m === 'smooth' ? 'Smooth curve' : 'Uniform bands'}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          aria-pressed={range === 'all'}
          onClick={() => setRange(range === 'all' ? 'focus' : 'all')}
        >
          {range === 'all' ? 'Focus near my score' : 'Show all scores'}
        </button>
      </div>
      <div
        className="distribution-chart"
        role="img"
        aria-label={`Modeled candidates per CRS point. ${method} allocation selected. ${formatNumber(estimate)} modeled candidates strictly above ${score}; observed-band bounds ${value.lower} to ${value.upper}. Exact band totals and model comparison are below.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={view}
            margin={{ top: 20, right: 15, left: -18, bottom: 10 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="#dfe5dd" strokeDasharray="3 4" />
            <XAxis
              dataKey="score"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#52645b', fontSize: 12 }}
              minTickGap={30}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#52645b', fontSize: 12 }}
              tickFormatter={(n) => (n >= 1000 ? `${n / 1000}k` : n)}
            />
            <Area
              dataKey={method}
              name="Selected model"
              type="linear"
              stroke="#285c44"
              fill="#dcebcf"
              strokeWidth={2.5}
              isAnimationActive={false}
            />
            <Line
              dataKey={method === 'smooth' ? 'uniform' : 'smooth'}
              name="Other model"
              type="linear"
              stroke="#826294"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine
              x={score}
              stroke="#9c502b"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: `You · ${score}`,
                position: 'insideTopRight',
                fill: '#7e3e20',
                fontSize: 12,
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload
                return active && d ? (
                  <div className="chart-tooltip">
                    <strong>CRS {d.score}</strong>
                    <div>Smooth: {formatNumber(Math.round(d.smooth))}</div>
                    <div>Uniform: {formatNumber(Math.round(d.uniform))}</div>
                    <small>Modeled candidates at this score</small>
                  </div>
                ) : null
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-dash" />
          Selected model
        </span>
        <span>
          <i className="legend-dash lavender" />
          Other model
        </span>
        <span>Candidates per CRS point</span>
      </div>
      <div className="notice subtle">
        <Info size={18} />
        <p>
          Full Express Entry pool as of <b>{dateLabel(pool.date, true)}</b>. This cannot tell you
          your CEC rank, who is eligible for a draw, or who will receive an invitation.
        </p>
      </div>
      <details className="distribution-explanation">
        <summary>Compare the numbers & understand the models</summary>
        <dl className="source-facts">
          <div>
            <dt>
              Observed {band.min}–{band.max} band
            </dt>
            <dd>{formatNumber(band.count)} candidates</dd>
          </div>
          <div>
            <dt>Uniform estimate above {score}</dt>
            <dd>{formatNumber(Math.round(value.uniformAbove))}</dd>
          </div>
          <div>
            <dt>Smooth estimate above {score}</dt>
            <dd>{formatNumber(Math.round(value.smoothAbove))}</dd>
          </div>
          <div>
            <dt>Total observed pool</dt>
            <dd>{formatNumber(pool.total)}</dd>
          </div>
        </dl>
        <p>
          <b>Uniform</b> assigns equal numbers to every score in a band. <b>Smooth</b> interpolates
          cumulative counts between band edges using monotone PCHIP. Both preserve every published
          band total. Neither reveals the true individual scores; differences show how the
          assumption affects the estimate.
        </p>
        <p>
          Counts strictly above your score exclude ties and reflect this snapshot only. Profiles can
          enter, leave or change scores afterward.
        </p>
      </details>
      <div className="panel-bottom">
        <span className="small muted">Based on {pool.bands.length} observed bands</span>
        <a href={pool.source_url} target="_blank" rel="noreferrer">
          Official snapshot <ArrowUpRight size={14} />
        </a>
      </div>
    </section>
  )
}
