import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  FlaskConical,
  Info,
  LockKeyhole,
  RotateCcw,
} from 'lucide-react'
import { ScenarioChart } from './Charts'
import type { Bundle, ScenarioInput } from './schema'
import { dateLabel, defaultScenario, exportFile, formatNumber, scenarioPoints } from './lib'
import { recentCec, nextIllustrativeDate, policyAnnouncement, modelIsCurrent } from './runtime'

export default function Scenario({
  bundle,
  today,
  score,
  onScore,
  onCalculate,
}: {
  bundle: Bundle
  today: string
  score: number
  onScore: (score: number) => void
  onCalculate: () => void
}) {
  const recent = useMemo(() => recentCec(bundle), [bundle])
  const defaults = useMemo(
    () => ({ ...defaultScenario, draw_size: recent.size, interval_days: recent.interval }),
    [recent],
  )
  const [settings, setSettings] = useState<ScenarioInput>(defaults)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) setSettings(defaults)
  }, [defaults, dirty])
  const model = bundle.backtests.model
  const current = modelIsCurrent(bundle, today)
  const input = {
    ...settings,
    crs_score: score,
    first_draw_date: model
      ? nextIllustrativeDate(model.last_draw.date, settings.interval_days, today)
      : undefined,
  }
  const points = current ? scenarioPoints(bundle, input) : []
  const last = points.at(-1)
  const announcement = policyAnnouncement(bundle, today)
  const outside =
    model &&
    (input.draw_size < model.draw_size_range[0] ||
      input.draw_size > model.draw_size_range[1] ||
      input.interval_days < model.interval_range[0] ||
      input.interval_days > model.interval_range[1])
  const crosses = points.some((p) => p.crosses_policy)
  const change = (key: keyof ScenarioInput, value: number | string) => {
    if (key === 'crs_score') {
      onScore(Number(value))
      return
    }
    setDirty(true)
    setSettings((p) => ({ ...p, [key]: value }))
  }
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <FlaskConical size={14} /> THE WHAT-IF LAB
        </div>
        <h1>Explore the possibilities.</h1>
        <p>Change the assumptions. See how a hypothetical CEC draw path responds.</p>
      </div>
      {announcement && (
        <div className="notice policy-notice">
          <Info size={19} />
          <div>
            <strong>
              {today < announcement.date ? 'CRS rules change ' : 'CRS rules changed '}
              {dateLabel(announcement.date, true)}.
            </strong>
            <p>
              {today < announcement.date
                ? 'Scenarios crossing this date hold the earlier rules fixed.'
                : 'Historical cutoffs and scores under the new rules may not be comparable.'}
            </p>
            <a href={announcement.url} target="_blank" rel="noreferrer">
              What changed <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      )}
      <div className="scenario-layout">
        <section className="panel scenario-controls">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">YOUR ASSUMPTIONS</div>
              <h2>Set the scene.</h2>
            </div>
            <button
              className="icon-button"
              title="Reset assumptions"
              aria-label="Reset scenario assumptions"
              onClick={() => {
                setDirty(false)
                setSettings(defaults)
              }}
            >
              <RotateCcw size={17} />
            </button>
          </div>
          <div className="recent-pattern">
            <div>
              <span className="eyebrow">RECENT CEC DRAWS</span>
              <strong>A starting point, from real draws.</strong>
            </div>
            <div
              className="recent-bars"
              role="img"
              aria-label={recent.draws
                .map(
                  (d) => `${dateLabel(d.date, true)}: ${formatNumber(d.invitations)} invitations`,
                )
                .join('; ')}
            >
              {recent.draws.map((d) => (
                <div key={d.id}>
                  <span>{formatNumber(d.invitations)}</span>
                  <i
                    style={{ height: `${Math.max(8, (d.invitations / (recent.max || 1)) * 42)}px` }}
                  />
                  <small>{dateLabel(d.date)}</small>
                </div>
              ))}
            </div>
            <p>
              {recent.draws.length ? (
                <>
                  Last {recent.draws.length} draws · median{' '}
                  <b>{formatNumber(recent.size)} invitations</b>
                  {recent.hasGaps && (
                    <>
                      {' '}
                      · <b>{recent.interval} days</b> apart
                    </>
                  )}
                  .
                </>
              ) : (
                'No recent CEC history. Values below are examples.'
              )}
            </p>
          </div>
          <div className="input-section">
            <label className="input-heading" htmlFor="score">
              Your CRS score{' '}
              <input
                inputMode="numeric"
                id="score"
                type="number"
                min="0"
                max="1200"
                value={input.crs_score}
                onChange={(e) =>
                  change(
                    'crs_score',
                    Math.max(0, Math.min(1200, Math.round(Number(e.target.value)))),
                  )
                }
              />
            </label>
            <input
              aria-label="Your CRS score slider"
              type="range"
              min="0"
              max="1200"
              value={input.crs_score}
              onChange={(e) => change('crs_score', Number(e.target.value))}
            />
            <div className="range-labels">
              <span>0</span>
              <span>1,200</span>
            </div>
            <button className="text-button calculate-link" onClick={onCalculate}>
              Don’t know your score? Calculate it <ArrowUpRight size={14} />
            </button>
            <small>
              <LockKeyhole size={11} /> Your score stays in your browser.
            </small>
          </div>
          <div className="input-section">
            <label className="input-heading" htmlFor="draw-size">
              Invitations per draw <output>{formatNumber(input.draw_size)}</output>
            </label>
            <input
              id="draw-size"
              type="range"
              min="100"
              max="10000"
              step="100"
              value={input.draw_size}
              onChange={(e) => change('draw_size', Number(e.target.value))}
            />
            <div className="range-labels">
              <span>100</span>
              <span>10,000</span>
            </div>
            <div className="draw-presets" aria-label="Invitation presets">
              {[
                ...new Set([
                  Math.max(100, Math.round((recent.size * 0.5) / 100) * 100),
                  recent.size,
                  Math.min(10000, Math.round((recent.size * 1.5) / 100) * 100),
                ]),
              ].map((size, i) => (
                <button
                  key={size}
                  aria-pressed={input.draw_size === size}
                  onClick={() => change('draw_size', size)}
                >
                  <span>{['Smaller', 'Recent median', 'Larger'][i]}</span>
                  <strong>{formatNumber(size)}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="input-section">
            <label className="input-heading" htmlFor="interval">
              Days between draws <output>{input.interval_days} days</output>
            </label>
            <input
              id="interval"
              type="range"
              min="7"
              max="60"
              step="1"
              value={input.interval_days}
              onChange={(e) => change('interval_days', Number(e.target.value))}
            />
            <div className="range-labels">
              <span>Weekly</span>
              <span>60 days</span>
            </div>
            <p className="control-context">
              {recent.hasGaps ? `Recent median: ${recent.interval} days.` : 'Example interval.'}{' '}
              IRCC does not publish a fixed draw schedule.
            </p>
            {input.first_draw_date && (
              <div className="assumed-date">
                <span>Illustrative next date</span>
                <strong>{dateLabel(input.first_draw_date, true)}</strong>
              </div>
            )}
          </div>
          <div className="input-section">
            <label className="input-heading" htmlFor="horizon">
              Draws to explore <output>{input.horizon_draws}</output>
            </label>
            <input
              id="horizon"
              type="range"
              min="1"
              max="12"
              step="1"
              value={input.horizon_draws}
              onChange={(e) => change('horizon_draws', Number(e.target.value))}
            />
          </div>
          <fieldset className="assumptions">
            <legend>Cutoff pressure</legend>
            <div className="pills">
              {(['optimistic', 'base', 'conservative'] as const).map((a) => (
                <button
                  key={a}
                  aria-pressed={input.assumptions === a}
                  className={input.assumptions === a ? 'selected' : ''}
                  onClick={() => change('assumptions', a)}
                >
                  {a === 'optimistic' ? 'Lower' : a === 'base' ? 'Base' : 'Higher'}
                </button>
              ))}
            </div>
            <p>
              Shifts each step by half the historical error scale. These are sensitivity
              assumptions.
            </p>
          </fieldset>
        </section>
        {model && last ? (
          <section className="panel scenario-output">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">CONDITIONAL ON YOUR SCENARIO</div>
                <h2>A range, with room for uncertainty.</h2>
              </div>
              <span className="tag amber">Exploratory</span>
            </div>
            <div className="scenario-result">
              <strong>
                {Math.floor(last.low)}–{Math.ceil(last.high)}
              </strong>
              <div>
                illustrative CRS range <span>after {input.horizon_draws} hypothetical draws</span>
              </div>
            </div>
            <ScenarioChart points={points} score={input.crs_score} />
            <div className="chart-legend">
              <span>
                <i className="legend-dash" />
                Conditional path
              </span>
              <span>
                <i className="legend-box" />
                Sensitivity envelope
              </span>
              <span>
                <i className="legend-dash copper" />
                Your score
              </span>
            </div>
            <div className="scenario-caveats">
              <p>
                <Info size={15} />
                <span>
                  This is a sensitivity illustration, not a calibrated confidence interval or an
                  invitation probability. Starts at the last observed CEC draw (
                  {dateLabel(model.last_draw.date, true)}).
                </span>
              </p>
              {outside && (
                <p className="warning-text">
                  Your draw size or interval is outside the observed training range.
                </p>
              )}
              {crosses && (
                <p className="warning-text">
                  This path crosses a scoring-rule change. Shaded dates keep the earlier rules
                  fixed.
                </p>
              )}
            </div>
            <button
              className="text-button"
              onClick={() =>
                exportFile(
                  'yourpr-scenario.json',
                  JSON.stringify(
                    {
                      model_version: model.version,
                      data_version: bundle.source.sha256,
                      source: bundle.source,
                      kind: 'illustrative sensitivity; not a calibrated forecast',
                      scenario: input,
                      points,
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              <ArrowDownToLine size={15} /> Export this scenario
            </button>
          </section>
        ) : (
          <section className="panel scenario-output scenario-unavailable">
            <Info size={24} />
            <h2>A little more history is needed.</h2>
            <p>
              {!current && model
                ? 'The scoring rules changed. We’ll resume scenarios once enough CEC draws under the new rules are available.'
                : 'There are not enough comparable CEC draws to show a scenario yet.'}
            </p>
            <p>Your CRS calculator and the official draw archive remain available.</p>
          </section>
        )}
      </div>
      {model && last && (
        <section className="panel scenario-details">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">LOOK CLOSER</div>
              <h2>The assumptions, draw by draw.</h2>
            </div>
            <span className="muted small">CEC only · no eligibility assessment</span>
          </div>
          <div className="scenario-mobile-list">
            {points
              .filter((p) => p.step > 0)
              .map((p) => (
                <article key={p.step}>
                  <header>
                    <strong>Draw {p.step}</strong>
                    <time dateTime={p.date}>{dateLabel(p.date, true)}</time>
                  </header>
                  <dl>
                    <div>
                      <dt>Illustrative cutoff</dt>
                      <dd>{p.cutoff}</dd>
                    </div>
                    <div>
                      <dt>Sensitivity range</dt>
                      <dd>
                        {p.low}–{p.high}
                      </dd>
                    </div>
                  </dl>
                  <span className={'tag ' + (p.crosses_policy ? 'amber' : '')}>
                    {p.crosses_policy ? 'Frozen pre-change rules' : 'Current regime'}
                  </span>
                </article>
              ))}
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable data table"
          >
            <table>
              <thead>
                <tr>
                  <th>HYPOTHETICAL DRAW</th>
                  <th>ASSUMED DATE</th>
                  <th>ILLUSTRATIVE CUTOFF</th>
                  <th>SENSITIVITY RANGE</th>
                  <th>RULES</th>
                </tr>
              </thead>
              <tbody>
                {points
                  .filter((p) => p.step > 0)
                  .map((p) => (
                    <tr key={p.step}>
                      <td>Draw {p.step}</td>
                      <td>{dateLabel(p.date, true)}</td>
                      <td>{p.cutoff}</td>
                      <td>
                        {p.low}–{p.high}
                      </td>
                      <td>
                        {p.crosses_policy ? (
                          <span className="tag amber">Frozen pre-change</span>
                        ) : (
                          <span className="tag">Current regime</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
