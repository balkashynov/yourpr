import { useId, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
} from 'recharts'
import { ArrowDownToLine, ArrowUpRight, ChartNoAxesCombined, Info } from 'lucide-react'
import type { Bundle, ScenarioPoint } from './schema'
import { COLORS, csv, dateLabel, exportFile, formatNumber, LABELS, monthLabel } from './lib'

export function HistoryChart({ bundle, expanded = false }: { bundle: Bundle; expanded?: boolean }) {
  const [category, setCategory] = useState('CEC')
  const [range, setRange] = useState('1Y')
  const [metric, setMetric] = useState('cutoff')
  const gradient = useId().replaceAll(':', '')
  const rows = useMemo(() => {
    const end = Date.parse(bundle.audit.last_draw)
    const start = range === '6M' ? end - 183 * 86400000 : range === '1Y' ? end - 366 * 86400000 : 0
    return bundle.draws
      .filter((d) => d.category === category && Date.parse(d.date) >= start)
      .map((d) => ({ ...d, time: Date.parse(d.date) }))
  }, [bundle, category, range])
  const latest = rows.at(-1)
  const first = rows[0]
  const delta = latest && first ? latest.cutoff - first.cutoff : 0
  const color = COLORS[category] ?? '#426951'
  return (
    <section className="panel history-panel" aria-labelledby="history-heading">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">THE BIG PICTURE</div>
          <h2 id="history-heading">Every draw tells a story.</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Download displayed chart data as CSV"
          onClick={() => exportFile('yourpr-draws.csv', csv(rows), 'text/csv;charset=utf-8')}
        >
          <ArrowDownToLine size={18} />
        </button>
      </div>
      <div className="chart-controls">
        <div className="pills" aria-label="Draw program">
          {['CEC', 'FRENCH', 'PNP', 'GENERAL'].map((c) => (
            <button
              key={c}
              title={LABELS[c]}
              aria-pressed={category === c}
              className={category === c ? 'selected' : ''}
              onClick={() => setCategory(c)}
            >
              {c === 'FRENCH' ? 'French' : c === 'GENERAL' ? 'General' : c}
            </button>
          ))}
        </div>
        <div className="range-tabs" aria-label="Chart time range">
          {['6M', '1Y', 'ALL'].map((r) => (
            <button
              key={r}
              aria-pressed={range === r}
              className={r === range ? 'active' : ''}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-summary">
        <div>
          <strong>
            {latest ? formatNumber(metric === 'cutoff' ? latest.cutoff : latest.invitations) : '—'}
          </strong>
          <span>{metric === 'cutoff' ? 'latest CRS cutoff' : 'latest invitations'}</span>
          {metric === 'cutoff' && rows.length > 1 && (
            <span className={delta <= 0 ? 'trend down' : 'trend'}>
              {delta <= 0 ? '↘' : '↗'} {Math.abs(delta)} pts in view
            </span>
          )}
        </div>
        <select
          aria-label="Chart metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          <option value="cutoff">CRS cutoff</option>
          <option value="invitations">Invitations</option>
        </select>
      </div>
      <div
        className={'chart-wrap ' + (expanded ? 'expanded' : '')}
        role="img"
        aria-label={`${LABELS[category]} ${metric} chart with ${rows.length} draws. Data available in the table below or CSV download.`}
      >
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{ top: 15, right: 12, left: -25, bottom: 0 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e9eae4" strokeDasharray="3 5" />
              <XAxis
                type="number"
                dataKey="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={monthLabel}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#52645b', fontSize: 11 }}
                minTickGap={35}
                dy={10}
              />
              <YAxis
                domain={metric === 'cutoff' ? ['auto', 'auto'] : [0, 'auto']}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#52645b', fontSize: 11 }}
                tickFormatter={(n) => (n >= 1000 ? `${n / 1000}k` : n)}
              />
              <Tooltip
                cursor={{ stroke: '#9cab9f', strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload
                  return active && d ? (
                    <div className="chart-tooltip">
                      <small>
                        {dateLabel(d.date, true)} · #{d.id}
                      </small>
                      <strong>
                        {d.cutoff} <span>CRS</span>
                      </strong>
                      <div>{formatNumber(d.invitations)} invitations</div>
                      <small>Observed · {LABELS[d.category]}</small>
                    </div>
                  ) : null
                }}
              />
              {bundle.policies
                .filter((p) => rows[0] && p.date >= rows[0].date && p.date <= rows.at(-1)!.date)
                .map((p) => (
                  <ReferenceLine
                    key={p.date}
                    x={Date.parse(p.date)}
                    stroke="#bdc2ad"
                    strokeDasharray="3 6"
                    label={{
                      value: p.kind === 'scoring' ? 'CRS change' : 'Category update',
                      position: 'insideTopRight',
                      fill: '#52645b',
                      fontSize: 9,
                    }}
                  />
                ))}
              {metric === 'cutoff' ? (
                <>
                  <Area
                    type="linear"
                    dataKey="cutoff"
                    stroke="none"
                    fill={`url(#${gradient})`}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="cutoff"
                    stroke={color}
                    strokeWidth={2.6}
                    dot={{ r: 3, stroke: color, strokeWidth: 1.6, fill: '#fff' }}
                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3 }}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <Bar
                  dataKey="invitations"
                  fill={color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">
            <ChartNoAxesCombined />
            <h3>No draws in this window</h3>
            <p>Try a longer time range.</p>
            <button onClick={() => setRange('ALL')}>Show all history</button>
          </div>
        )}
      </div>
      <div className="chart-footer">
        <span>
          <i style={{ background: color }} />
          {LABELS[category]} <span className="muted">· {rows.length} draws</span>
        </span>
        <a href={bundle.source.url} target="_blank" rel="noreferrer">
          IRCC source <ArrowUpRight size={13} />
        </a>
      </div>
      <details className="chart-data">
        <summary>View accessible chart data</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable data table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>CRS</th>
                <th>Invitations</th>
                <th>Official record</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((d) => (
                <tr key={d.id}>
                  <td>{dateLabel(d.date, true)}</td>
                  <td>{d.cutoff}</td>
                  <td>{formatNumber(d.invitations)}</td>
                  <td>
                    <a href={d.source_url} target="_blank" rel="noreferrer">
                      Draw #{d.id} ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export function ScenarioChart({ points, score }: { points: ScenarioPoint[]; score: number }) {
  const rows = points.map((p) => ({ ...p, time: Date.parse(p.date), envelope: [p.low, p.high] }))
  const breakPoint = points.find((p) => p.crosses_policy)
  return (
    <div
      className="scenario-chart"
      role="img"
      aria-label="Illustrative CEC cutoff path, sensitivity envelope, and your CRS score; numerical values are listed below."
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 25, right: 15, left: -20, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="#e9eae4" strokeDasharray="3 5" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(n) => dateLabel(new Date(n).toISOString())}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#52645b', fontSize: 11 }}
            minTickGap={35}
            dy={10}
          />
          <YAxis
            domain={[
              (min: number) => Math.floor(Math.min(min, score) - 5),
              (max: number) => Math.ceil(Math.max(max, score) + 5),
            ]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#52645b', fontSize: 11 }}
          />
          {breakPoint && (
            <ReferenceArea
              x1={Date.parse('2026-11-03')}
              x2={rows.at(-1)?.time}
              fill="#d6b983"
              fillOpacity={0.09}
            />
          )}
          <Area
            dataKey="envelope"
            type="linear"
            stroke="none"
            fill="#b8ccb7"
            fillOpacity={0.5}
            isAnimationActive={false}
          />
          <Line
            dataKey="cutoff"
            type="linear"
            stroke="#426951"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
            strokeDasharray="6 3"
            isAnimationActive={false}
          />
          <ReferenceLine
            y={score}
            stroke="#c37c55"
            strokeDasharray="4 4"
            label={{
              value: `Your CRS · ${score}`,
              position: 'insideTopRight',
              fill: '#8b502d',
              fontSize: 11,
            }}
          />
          {breakPoint && (
            <ReferenceLine
              x={Date.parse('2026-11-03')}
              stroke="#bb9959"
              strokeDasharray="3 3"
              label={{
                value: 'Nov 3 · rule change',
                position: 'insideTopRight',
                fill: '#765322',
                fontSize: 10,
              }}
            />
          )}
          <Tooltip
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload
              return active && d ? (
                <div className="chart-tooltip">
                  <small>
                    {d.step === 0 ? 'Observed origin' : `Hypothetical draw ${d.step}`} ·{' '}
                    {dateLabel(d.date)}
                  </small>
                  <strong>
                    {d.low}–{d.high}
                  </strong>
                  <div>{d.step === 0 ? 'Observed cutoff' : 'Sensitivity range · CRS'}</div>
                  {d.crosses_policy && <small>Frozen pre-change rules</small>}
                </div>
              ) : null
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BacktestChart({ bundle, periodIndex }: { bundle: Bundle; periodIndex: number }) {
  const period = bundle.backtests.periods[periodIndex]
  if (!period?.points.length)
    return (
      <p className="notice">
        <Info size={16} />
        Not enough observations for this period.
      </p>
    )
  const rows = period.points.map((p) => ({
    ...p,
    time: Date.parse(p.date),
    last: p.predictions.last,
    ridge: p.predictions.ridge,
  }))
  return (
    <div
      className="chart-wrap expanded"
      role="img"
      aria-label="Observed cutoffs compared with walk-forward predictions"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 20, right: 15, left: -20, bottom: 5 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="#e9eae4" strokeDasharray="3 5" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={monthLabel}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#52645b' }}
          />
          <YAxis
            domain={['auto', 'auto']}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#52645b' }}
          />
          <Tooltip
            labelFormatter={(v) => dateLabel(new Date(Number(v)).toISOString(), true)}
            formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : String(v))}
            contentStyle={{ border: '1px solid #e2e5da', borderRadius: 10, fontSize: 12 }}
          />
          <Line
            dataKey="actual"
            name="Observed cutoff"
            stroke="#294d3a"
            strokeWidth={3}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="last"
            name="Last observed baseline"
            stroke="#bd9d6b"
            strokeDasharray="4 4"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="ridge"
            name="Conditional ridge"
            stroke="#a092bd"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
