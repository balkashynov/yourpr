import { Fragment, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  Users,
} from 'lucide-react'
import type { Bundle, Draw, Pool } from './schema'
import { broadBands, COLORS, csv, dateLabel, exportFile, formatNumber, LABELS } from './lib'

export function Badge({ category, label }: { category: string; label?: string }) {
  return (
    <span className={'category-badge cat-' + category.toLowerCase()}>
      <i style={{ background: COLORS[category] ?? '#8c9a86' }} />
      {label ?? LABELS[category] ?? category}
    </span>
  )
}
export function SourceLine({ bundle }: { bundle: Bundle }) {
  return (
    <span>
      Source:{' '}
      <a href={bundle.source.url} target="_blank" rel="noreferrer">
        IRCC
      </a>{' '}
      · retrieved {dateLabel(bundle.source.fetched_at, true)}
    </span>
  )
}

export function PoolPanel({
  bundle,
  onExplore,
  expanded = false,
  sharedScore,
  onScore,
  onCalculate,
}: {
  bundle: Bundle
  onExplore?: () => void
  expanded?: boolean
  sharedScore?: number
  onScore?: (score: number) => void
  onCalculate?: () => void
}) {
  const [snapshotDate, setSnapshotDate] = useState('latest')
  const [selected, setSelected] = useState<number | null>(null)
  const [localScore, setLocalScore] = useState(510)
  const score = sharedScore ?? localScore
  const setScore = onScore ?? setLocalScore
  const pool: Pool | undefined =
    snapshotDate === 'latest'
      ? bundle.pool_snapshots.at(-1)
      : bundle.pool_snapshots.find((p) => p.date === snapshotDate)
  if (!pool)
    return (
      <section className="panel">
        <h2>Pool data unavailable</h2>
        <p>The official snapshot is missing or did not pass validation.</p>
      </section>
    )
  const bands = expanded ? pool.bands : broadBands(pool)
  const max = Math.max(...bands.map((b) => b.count))
  const chosen = bands.find((b) => b.min === selected)
  const scoreBand = pool.bands.find((b) => score >= b.min && score <= b.max)
  const above = pool.bands
    .filter((b) => scoreBand && b.min > scoreBand.max)
    .reduce((s, b) => s + b.count, 0)
  return (
    <section
      className={'panel pool-panel ' + (expanded ? 'pool-expanded' : '')}
      aria-labelledby="pool-heading"
    >
      <div className="panel-heading">
        <div>
          <div className="eyebrow">A LOOK AT THE POOL</div>
          <h2 id="pool-heading">Where everyone stands.</h2>
        </div>
        <span className="soft-icon">
          <Users size={18} />
        </span>
      </div>
      <div className="pool-total">
        <strong>{formatNumber(pool.total)}</strong>
        <span>candidates · {dateLabel(pool.date)}</span>
      </div>
      {expanded && (
        <div className="pool-tools">
          <label>
            Snapshot{' '}
            <select
              value={snapshotDate}
              onChange={(e) => {
                setSnapshotDate(e.target.value)
                setSelected(null)
              }}
            >
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
          <button
            className="text-button"
            onClick={() =>
              exportFile(
                `yourpr-pool-${pool.date}.json`,
                JSON.stringify({ source: bundle.source, snapshot: pool }, null, 2),
              )
            }
          >
            <ArrowDownToLine size={15} /> Export snapshot
          </button>
        </div>
      )}
      <div className="bar-labels">
        <span>CRS SCORE</span>
        <span>CANDIDATES</span>
      </div>
      <div className="pool-bars">
        {bands.map((b) => (
          <button
            className={'pool-row ' + (b.min === selected ? 'selected' : '')}
            key={b.min}
            aria-pressed={b.min === selected}
            aria-label={`${b.min} to ${b.max} CRS: ${formatNumber(b.count)} candidates. Select for details.`}
            onClick={() => setSelected(b.min === selected ? null : b.min)}
          >
            <span className="band-name">
              {b.min}–{b.max}
            </span>
            <span className="bar-track">
              <span
                className={'bar-fill ' + (b.min === 501 ? 'highlight' : '')}
                style={{ width: `${Math.max(1, (b.count / max) * 100)}%` }}
              />
            </span>
            <span className="band-count">{formatNumber(b.count)}</span>
          </button>
        ))}
      </div>
      <p className="pool-note" aria-live="polite">
        <Info size={14} />
        <span>
          {chosen
            ? `${formatNumber(chosen.count)} candidates have ${chosen.min}–${chosen.max} CRS (${((chosen.count / pool.total) * 100).toFixed(1)}% of this snapshot).`
            : 'The full Express Entry pool. Not all candidates are eligible for CEC.'}
        </span>
      </p>
      {expanded && (
        <div className="score-band">
          <div>
            <h3>Find your score band</h3>
            {onCalculate ? (
              <button className="text-button calculate-link" onClick={onCalculate}>
                Calculate my CRS <ArrowUpRight size={14} />
              </button>
            ) : (
              <p>Your score stays in this browser.</p>
            )}
          </div>
          <label className="score-input">
            Your CRS
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="1200"
              value={score}
              onChange={(e) =>
                setScore(Math.max(0, Math.min(1200, Math.round(Number(e.target.value)))))
              }
            />
          </label>
          <p className="band-result">
            {scoreBand && (
              <>
                <strong>{formatNumber(scoreBand.count)}</strong> candidates share the{' '}
                {scoreBand.min}–{scoreBand.max} band. <strong>{formatNumber(above)}</strong> are in
                higher bands. The data cannot tell us your exact rank or how many are CEC eligible.
              </>
            )}
          </p>
        </div>
      )}
      <div className="panel-bottom">
        <a href={pool.source_url} target="_blank" rel="noreferrer">
          Official snapshot <ArrowUpRight size={13} />
        </a>
        {onExplore && (
          <button className="text-button" onClick={onExplore}>
            Explore pool <ArrowRight size={14} />
          </button>
        )}
      </div>
    </section>
  )
}

export function DrawTable({
  bundle,
  compact = false,
  onExplore,
}: {
  bundle: Bundle
  compact?: boolean
  onExplore?: () => void
}) {
  const [category, setCategory] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const size = compact ? 5 : 12
  const rows = useMemo(
    () =>
      [...bundle.draws]
        .reverse()
        .filter(
          (d) =>
            (category === 'ALL' || d.category === category) &&
            `${d.id} ${d.date} ${d.category_raw}`.toLowerCase().includes(search.toLowerCase()),
        ),
    [bundle, category, search],
  )
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * size, (current + 1) * size)
  const categories = Object.keys(bundle.audit.categories)
  function changeCategory(v: string) {
    setCategory(v)
    setPage(0)
    setExpanded(null)
  }
  return (
    <section className="panel draws-panel" aria-labelledby="rounds-heading">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">STRAIGHT FROM THE SOURCE</div>
          <h2 id="rounds-heading">{compact ? 'The latest rounds.' : 'The draw archive.'}</h2>
        </div>
        {onExplore ? (
          <button className="text-button" onClick={onExplore}>
            View all draws <ArrowRight size={15} />
          </button>
        ) : (
          <button
            className="secondary-button"
            onClick={() => exportFile('yourpr-draws.csv', csv(rows), 'text/csv;charset=utf-8')}
          >
            <ArrowDownToLine size={15} /> Export CSV
          </button>
        )}
      </div>
      {!compact && (
        <div className="table-tools">
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Search draw archive"
              placeholder="Search dates, programs, or round numbers…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
            />
          </label>
          <select
            value={category}
            aria-label="Filter draw program"
            onChange={(e) => changeCategory(e.target.value)}
          >
            <option value="ALL">All draw types</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable data table">
        <table className="draw-table">
          <thead>
            <tr>
              <th>ROUND / DATE</th>
              <th>DRAW TYPE</th>
              <th>INVITATIONS</th>
              <th>CRS CUTOFF</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d: Draw) => (
              <Fragment key={d.id}>
                <tr className={expanded === d.id ? 'expanded-row' : ''}>
                  <td>
                    <span className="round-number">#{d.id}</span>
                    <span className="round-date">{dateLabel(d.date, true)}</span>
                  </td>
                  <td>
                    <Badge
                      category={d.category}
                      label={d.category === 'OTHER' ? d.category_raw : undefined}
                    />
                  </td>
                  <td className="number">{formatNumber(d.invitations)}</td>
                  <td>
                    <span className="cutoff-value">{d.cutoff}</span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-expanded={expanded === d.id}
                      aria-label={`Details for draw ${d.id}`}
                      onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    >
                      <ChevronDown
                        size={16}
                        style={{ transform: expanded === d.id ? 'rotate(180deg)' : undefined }}
                      />
                    </button>
                  </td>
                </tr>
                {expanded === d.id && (
                  <tr className="detail-row">
                    <td colSpan={5}>
                      <div>
                        <p>
                          <strong>Official category:</strong> {d.category_raw}
                        </p>
                        <p>
                          <strong>Tie-breaking timestamp:</strong>{' '}
                          {d.tie_break ?? 'Not published in the source'}
                        </p>
                        <p>
                          At the cutoff score, the profile submission timestamp matters. A CRS score
                          alone does not establish eligibility.
                        </p>
                        <a href={d.source_url} target="_blank" rel="noreferrer">
                          Read Ministerial Instructions for draw #{d.id} <ArrowUpRight size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-draw-list">
        {visible.map((d) => (
          <article className="draw-mobile-card" key={d.id}>
            <div className="draw-mobile-head">
              <span>Draw #{d.id}</span>
              <time dateTime={d.date}>{dateLabel(d.date, true)}</time>
            </div>
            <Badge
              category={d.category}
              label={d.category === 'OTHER' ? d.category_raw : undefined}
            />
            <dl>
              <div>
                <dt>CRS cutoff</dt>
                <dd>{d.cutoff}</dd>
              </div>
              <div>
                <dt>Invitations</dt>
                <dd>{formatNumber(d.invitations)}</dd>
              </div>
            </dl>
            <details>
              <summary>Draw details & official source</summary>
              <p>
                <strong>Official category:</strong> {d.category_raw}
              </p>
              <p>
                <strong>Tie-breaking timestamp:</strong>{' '}
                {d.tie_break ?? 'Not published in the source'}
              </p>
              <p>
                At the cutoff, profile submission time matters. A score alone does not establish
                eligibility.
              </p>
              <a href={d.source_url} target="_blank" rel="noreferrer">
                IRCC instructions · #{d.id} <ArrowUpRight size={14} />
              </a>
            </details>
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="empty-state">
          <Search />
          <h3>No matching draws</h3>
          <p>Try another date, round number, or program.</p>
          <button
            onClick={() => {
              setSearch('')
              changeCategory('ALL')
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="panel-bottom">
        <small>
          {compact ? (
            <SourceLine bundle={bundle} />
          ) : (
            `${rows.length} draws · ${rows.length ? current * size + 1 : 0}–${Math.min((current + 1) * size, rows.length)} shown`
          )}
        </small>
        {!compact && (
          <div className="pagination">
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {current + 1} / {pages}
            </span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={current === pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
