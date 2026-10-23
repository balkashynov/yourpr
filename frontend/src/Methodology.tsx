import { useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  Database,
  Info,
  ShieldCheck,
} from 'lucide-react'
import type { Bundle } from './schema'
import { BacktestChart } from './Charts'
import { dateLabel, exportFile, formatNumber } from './lib'

const glossary = [
  [
    'What is a CRS score?',
    'The Comprehensive Ranking System ranks eligible Express Entry candidates using points. A draw cutoff is the score of the lowest-ranked candidate invited in that round. It is not a standalone eligibility test.',
  ],
  [
    'What do CEC and ITA mean?',
    'CEC is the Canadian Experience Class, one of the programs managed by Express Entry. ITA means invitation to apply. An invitation is a step toward an application; it is not an approval of permanent residence.',
  ],
  [
    'Why are the categories separate?',
    'French-language, occupation-based, CEC, and PNP populations can overlap. Category-based draws select eligible candidates within that category. Comparing their cutoffs without this context can be misleading.',
  ],
  [
    'What happens at the cutoff score?',
    'IRCC applies a tie-breaking rule using the date and time a candidate submitted their profile. Two candidates with the same CRS score may have different outcomes. Each expanded draw record links to the official instructions.',
  ],
  [
    'Can the pool tell me my rank?',
    'The pool shows score bands for all candidates. Our uniform and smooth distributions preserve those totals while making different assumptions inside each band. They cannot reveal exact individual scores, CEC eligibility, category overlap, ties, or your invitation order.',
  ],
  [
    'What does “conditional” mean?',
    'The scenario assumes a particular draw size, interval, and unchanged scoring rules. It illustrates how cutoffs might respond within that model. It does not predict that IRCC will hold those draws, nor the chance of an ITA or permanent residence.',
  ],
]
export default function Methodology({ bundle }: { bundle: Bundle }) {
  const [selectedRegime, setSelectedRegime] = useState<string | null>(null)
  const index = selectedRegime
    ? bundle.backtests.periods.findIndex((p) => p.regime === selectedRegime)
    : bundle.backtests.periods.length - 1
  const period = bundle.backtests.periods[index]
  const model = bundle.backtests.model
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <BookOpen size={14} /> OPEN BY DESIGN
        </div>
        <h1>Clarity includes the caveats.</h1>
        <p>The sources, assumptions, and real-world checks behind every chart.</p>
      </div>
      <div className="method-pillars">
        <article>
          <span className="soft-icon">
            <Database size={20} />
          </span>
          <h3>Official observations</h3>
          <p>
            Draws and pool snapshots come from IRCC. Every import is preserved with a SHA-256
            fingerprint.
          </p>
          <span className="tag">Observed facts</span>
        </article>
        <article>
          <span className="soft-icon lilac">
            <FlaskIcon />
          </span>
          <h3>Explicit assumptions</h3>
          <p>
            Draw size, timing, and cutoff pressure are choices you make. Your CRS score stays in the
            browser.
          </p>
          <span className="tag lilac">User-selected inputs</span>
        </article>
        <article>
          <span className="soft-icon peach">
            <ShieldCheck size={20} />
          </span>
          <h3>Honest limitations</h3>
          <p>
            The CEC-eligible pool is hidden. We publish exploratory ranges without invitation
            probabilities.
          </p>
          <span className="tag amber">Model estimates</span>
        </article>
      </div>
      <section className="panel validation-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">THE REALITY CHECK</div>
            <h2>How well do the baselines hold up?</h2>
          </div>
          <select
            aria-label="Backtest policy period"
            value={selectedRegime ?? period?.regime ?? ''}
            onChange={(e) => setSelectedRegime(e.target.value)}
          >
            {bundle.backtests.periods.map((p) => (
              <option key={p.regime} value={p.regime}>
                {p.regime === '2026-categories'
                  ? '2026 category period'
                  : p.regime === '2025-no-job-points'
                    ? '2025 scoring period'
                    : p.regime}
              </option>
            ))}
          </select>
        </div>
        {period ? (
          <>
            <p className="section-description">
              Train on earlier CEC draws, test on the next draw using its actual size and interval.
              Lower average error is better.
            </p>
            <div className="validation-status">
              <Info size={17} />
              <div>
                <strong>
                  {model?.validation_passed
                    ? 'Exploratory model; uncertainty remains'
                    : 'Calibrated forecast release gate: not passed'}
                </strong>
                <p>
                  At least 20 test draws and an error no worse than both simple baselines are
                  required. Current-period test draws:{' '}
                  {bundle.backtests.periods.at(-1)?.metrics[0].n ?? 0}. These are minimum
                  conditions, not proof of calibration.
                </p>
              </div>
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable data table"
            >
              <table className="validation-table">
                <thead>
                  <tr>
                    <th>METHOD</th>
                    <th>TEST DRAWS</th>
                    <th>AVG. ERROR (CRS)</th>
                    <th>MEDIAN ERROR</th>
                    <th>80% COVERAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {period.metrics.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className={'model-dot ' + m.id} />
                        {m.name}
                      </td>
                      <td>{m.n}</td>
                      <td>
                        <strong>{m.mae?.toFixed(2) ?? '—'}</strong>
                      </td>
                      <td>{m.median_error?.toFixed(2) ?? '—'}</td>
                      <td>
                        {m.intervals['80'].coverage === null
                          ? '—'
                          : `${Math.round(m.intervals['80'].coverage * 100)}%`}{' '}
                        <span className="muted">(n={m.intervals['80'].n})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <BacktestChart bundle={bundle} periodIndex={index} />
            <div className="chart-legend">
              <span>
                <i className="legend-dash" />
                Observed
              </span>
              <span>
                <i className="legend-dash gold" />
                Last-cutoff baseline
              </span>
              <span>
                <i className="legend-dash lavender" />
                Conditional ridge
              </span>
            </div>
            <div className="panel-bottom">
              <span className="small muted">
                {period.draw_count} CEC draws · {dateLabel(period.start, true)} –{' '}
                {dateLabel(period.end, true)}
              </span>
              <button
                className="text-button"
                onClick={() =>
                  exportFile(
                    'yourpr-validation.json',
                    JSON.stringify({ source: bundle.source, backtests: bundle.backtests }, null, 2),
                  )
                }
              >
                <ArrowDownToLine size={14} /> Full results
              </button>
            </div>
            <details className="chart-data">
              <summary>Interval coverage, widths, and evaluation details</summary>
              <p>
                Each interval uses only earlier out-of-sample absolute errors in the same period,
                after at least five errors exist. Empirical coverage is descriptive; four evaluated
                intervals cannot establish reliability.
              </p>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Scrollable data table"
              >
                <table>
                  <thead>
                    <tr>
                      <th>MODEL</th>
                      <th>NOMINAL LEVEL</th>
                      <th>TEST INTERVALS</th>
                      <th>COVERAGE</th>
                      <th>AVG. WIDTH (CRS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.metrics.flatMap((m) =>
                      ['50', '80', '95'].map((level) => (
                        <tr key={m.id + level}>
                          <td>{m.name}</td>
                          <td>{level}%</td>
                          <td>{m.intervals[level].n}</td>
                          <td>
                            {m.intervals[level].coverage === null
                              ? '—'
                              : `${(m.intervals[level].coverage * 100).toFixed(1)}%`}
                          </td>
                          <td>{m.intervals[level].width?.toFixed(2) ?? '—'}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
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
                      <th>TEST DATE</th>
                      <th>TRAINING THROUGH</th>
                      <th>OBSERVED</th>
                      <th>LAST CUTOFF</th>
                      <th>RIDGE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.points.map((p) => (
                      <tr key={p.date}>
                        <td>{p.date}</td>
                        <td>{p.train_end}</td>
                        <td>{p.actual}</td>
                        <td>{p.predictions.last.toFixed(1)}</td>
                        <td>{p.predictions.ridge.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p>No same-regime backtest is available yet.</p>
        )}
      </section>
      <div className="two-columns method-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">TRACEABLE TO THE SOURCE</div>
              <h2>The data behind the view.</h2>
            </div>
            <Database size={19} />
          </div>
          <dl className="source-facts">
            <div>
              <dt>Historical coverage</dt>
              <dd>
                {dateLabel(bundle.audit.first_draw, true)} —{' '}
                {dateLabel(bundle.audit.last_draw, true)}
              </dd>
            </div>
            <div>
              <dt>Official draw records</dt>
              <dd>{formatNumber(bundle.audit.draw_count)}</dd>
            </div>
            <div>
              <dt>Validated pool snapshots</dt>
              <dd>{bundle.audit.pool_count}</dd>
            </div>
            <div>
              <dt>Missing / placeholder pools</dt>
              <dd>{bundle.audit.missing.pool ?? 0} draw records</dd>
            </div>
            <div>
              <dt>Retrieved at (UTC)</dt>
              <dd>
                {new Date(bundle.source.fetched_at).toISOString().replace('T', ' ').slice(0, 19)}
              </dd>
            </div>
            <div>
              <dt>Parser / model</dt>
              <dd>
                {bundle.source.parser_version} / {bundle.backtests.version}
              </dd>
            </div>
          </dl>
          <details className="fingerprint">
            <summary>Data fingerprint · SHA-256</summary>
            <code>{bundle.source.sha256}</code>
          </details>
          <p className="notice subtle">
            <Info size={15} />
            {bundle.audit.issues.join('. ') || 'No source integrity issues detected.'}
          </p>
          <a className="text-button" href={bundle.source.url} target="_blank" rel="noreferrer">
            Open original IRCC dataset <ArrowUpRight size={15} />
          </a>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">CONTEXT MATTERS</div>
              <h2>When the rules change.</h2>
            </div>
            <BookOpen size={19} />
          </div>
          <div className="policy-timeline">
            {bundle.policies.map((p) => (
              <article key={p.date}>
                <span
                  className={'policy-dot ' + (p.date > bundle.audit.last_draw ? 'future' : '')}
                />
                <small>
                  {dateLabel(p.date, true)} ·{' '}
                  {p.kind === 'scoring' ? 'Scoring change' : 'Category update'}
                </small>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <a href={p.url} target="_blank" rel="noreferrer">
                  Official notice <ArrowUpRight size={12} />
                </a>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="panel limits-panel">
        <div>
          <div className="eyebrow">WHAT THE MODEL CAN’T SEE</div>
          <h2>A useful lens. An incomplete picture.</h2>
        </div>
        <div className="limits-copy">
          {bundle.backtests.notes.map((n) => (
            <p key={n}>
              <Info size={15} />
              {n}
            </p>
          ))}
          <p>
            <Info size={15} />
            The regression uses the previous cutoff, relative draw size, and elapsed time. Latent
            arrivals, score changes, and other-category depletion cannot be uniquely recovered from
            public snapshots, so no fitted hidden-population model is released.
          </p>
          <p>
            <Check size={15} />A fixed regularization penalty and direction constraints keep the
            model simple. Multi-step envelopes use historical residual scale × √steps; they have not
            been calibrated as forecast intervals.
          </p>
        </div>
      </section>
      <section className="panel glossary">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">A LITTLE LESS JARGON</div>
            <h2>Good questions, clear answers.</h2>
          </div>
          <CircleHelp size={21} />
        </div>
        {glossary.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <span>+</span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  )
}
function FlaskIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M9 3h6M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10" />
    </svg>
  )
}
