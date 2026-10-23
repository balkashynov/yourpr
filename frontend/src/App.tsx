import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Calculator as CalculatorIcon,
  FlaskConical,
  LayoutGrid,
  Leaf,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
  MoreHorizontal,
} from 'lucide-react'
import snapshot from './data/snapshot.json'
import { bundleSchema } from './schema'
import { dateLabel, formatNumber, LABELS } from './lib'
import { HistoryChart } from './Charts'
import { DrawTable, PoolPanel } from './Panels'
import Scenario from './Scenario'
import Methodology from './Methodology'
import Calculator from './Calculator'
import { emptyProfile } from './crs'
import { useDashboard } from './useDashboard'
import { utcDay } from './runtime'
import Distribution from './Distribution'

const bundled = bundleSchema.parse(snapshot)
const pages = [
  { id: 'overview', name: 'Overview', icon: LayoutGrid },
  { id: 'draws', name: 'Draw history', icon: TrendingUp },
  { id: 'pool', name: 'Candidate pool', icon: Users },
  { id: 'calculator', name: 'CRS calculator', icon: CalculatorIcon },
  { id: 'scenarios', name: 'Scenario lab', icon: FlaskConical },
  { id: 'methodology', name: 'Methodology', icon: BookOpen },
] as const
type Page = (typeof pages)[number]['id']
function initialPage(): Page {
  return pages.find((p) => p.id === location.hash.slice(1))?.id ?? 'overview'
}
function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="38" height="38" rx="12" fill="currentColor" />
      <path
        d="m12 11 8 10 8-10M20 21v9"
        stroke="#e4f3bd"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(initialPage)
  const [menu, setMenu] = useState(false)
  const api = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
  const { bundle, connection, now } = useDashboard(bundled, api)
  const [score, setScore] = useState(510)
  const [profile, setProfile] = useState(emptyProfile)
  const today = utcDay(now)
  const repoUrl = import.meta.env.VITE_REPOSITORY_URL
  const mainRef = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    document.title = `${pages.find((p) => p.id === page)?.name} · YourPR`
  }, [page])
  useEffect(() => {
    const handle = () => {
      setPage(initialPage())
      setMenu(false)
    }
    window.addEventListener('hashchange', handle)
    return () => window.removeEventListener('hashchange', handle)
  }, [])
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1000px)')
    const closeDrawer = () => {
      if (desktop.matches) setMenu(false)
    }
    desktop.addEventListener('change', closeDrawer)
    return () => desktop.removeEventListener('change', closeDrawer)
  }, [])
  useEffect(() => {
    if (!menu) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const elements = Array.from(
      navRef.current?.querySelectorAll<HTMLElement>('a,button') ?? [],
    ).filter((el) => el.getClientRects().length)
    elements?.[0]?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false)
        requestAnimationFrame(() => menuButton.current?.focus())
      }
      if (event.key === 'Tab' && elements?.length) {
        const first = elements[0],
          last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => {
      document.body.style.overflow = old
      window.removeEventListener('keydown', keyboard)
    }
  }, [menu])
  const navigate = useCallback((id: Page) => {
    location.hash = id
    setPage(id)
    setMenu(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }))
  }, [])
  const age = Math.max(0, (now - Date.parse(bundle.source.fetched_at)) / 3600000)
  const stale = age > 3 || bundle.status?.stale
  const latest = bundle.draws.at(-1)!
  const cec = bundle.draws.filter((d) => d.category === 'CEC')
  const lastCec = cec.at(-1)!
  const previousCec = cec.at(-2)
  const pool = bundle.pool_snapshots.at(-1)
  const year = latest.date.slice(0, 4)
  const yearInvitations = bundle.draws
    .filter((d) => d.date.startsWith(year))
    .reduce((s, d) => s + d.invitations, 0)
  const gap = previousCec ? (Date.parse(lastCec.date) - Date.parse(previousCec.date)) / 86400000 : 0
  const pageName = pages.find((p) => p.id === page)?.name
  return (
    <div className="app-shell">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
      >
        Skip to content
      </a>
      {menu && (
        <div
          className="nav-backdrop"
          onClick={() => {
            setMenu(false)
            requestAnimationFrame(() => menuButton.current?.focus())
          }}
        />
      )}
      <aside
        ref={navRef}
        id="all-pages"
        className={'sidebar ' + (menu ? 'open' : '')}
        aria-label="Main navigation"
        {...(menu ? { role: 'dialog', 'aria-modal': true as const } : {})}
      >
        <a
          className="brand"
          href="#overview"
          onClick={(e) => {
            e.preventDefault()
            navigate('overview')
          }}
        >
          <BrandMark />
          <span>
            YourPR<span className="brand-dot">.</span>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Close menu"
          onClick={() => {
            setMenu(false)
            requestAnimationFrame(() => menuButton.current?.focus())
          }}
        >
          <X size={21} />
        </button>
        <div className="workspace-label">
          <span className="canada-mark">✦</span> EXPRESS ENTRY <span className="tiny-tag">CA</span>
        </div>
        <nav aria-label="All pages">
          {pages.map((p) => (
            <a
              key={p.id}
              href={'#' + p.id}
              aria-current={page === p.id ? 'page' : undefined}
              className={page === p.id ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                navigate(p.id)
              }}
            >
              <p.icon size={18} strokeWidth={1.7} />
              <span>{p.name}</span>
              {page === p.id && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html"
            target="_blank"
            rel="noreferrer"
          >
            <ShieldCheck size={16} /> Built on official IRCC data <ArrowUpRight size={12} />
          </a>
          <span>An independent, open-data project.</span>
        </div>
      </aside>
      <div className="main-shell" inert={menu}>
        <header className="topbar">
          <a
            className="mobile-brand brand"
            href="#overview"
            onClick={(e) => {
              e.preventDefault()
              navigate('overview')
            }}
            aria-label="YourPR home"
          >
            <BrandMark />
            <span>
              YourPR<span className="brand-dot">.</span>
            </span>
          </a>
          <div className="breadcrumb">
            <span>Express Entry</span>
            <ChevronRight size={13} />
            <strong>{pageName}</strong>
          </div>
          <div className="top-actions">
            <span className={'data-status ' + (stale ? 'stale' : '')}>
              <i />
              {stale ? 'Showing saved data' : 'Official IRCC data'}
            </span>
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1}>
          {page === 'overview' && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="tiny-leaf">
                      <Leaf size={13} />
                    </span>{' '}
                    YOUR EXPRESS ENTRY COMPANION
                  </div>
                  <h1>
                    Make sense of
                    <br />
                    <span>Express Entry.</span>
                  </h1>
                  <p>
                    Your score. The latest draws. A clearer picture of the pool. Explore the numbers
                    behind your next chapter.
                  </p>
                  <div className="hero-actions">
                    <button className="primary-button" onClick={() => navigate('calculator')}>
                      Find your CRS score <ArrowUpRight size={17} />
                    </button>
                    <span>
                      <Check size={15} /> Free to explore. No account needed.
                    </span>
                  </div>
                </div>
                <article className="latest-card">
                  <div className="card-orbit" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <BrandMark />
                  </div>
                  <div className="latest-card-top">
                    <span>
                      <i /> LATEST DRAW
                    </span>
                    <a
                      href={latest.source_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View official IRCC draw ${latest.id}`}
                    >
                      <ArrowUpRight size={20} />
                    </a>
                  </div>
                  <div className="latest-type">
                    {LABELS[latest.category] ?? latest.category_raw}
                  </div>
                  <div className="latest-score">
                    {latest.cutoff}
                    <span>CRS cutoff</span>
                  </div>
                  <div className="latest-card-bottom">
                    <span>{formatNumber(latest.invitations)} invitations issued</span>
                    <span>
                      {dateLabel(latest.date)}
                      <span className="separator">·</span>#{latest.id}
                    </span>
                  </div>
                </article>
              </section>
              <div className="overview-heading">
                <h2>Your Express Entry snapshot</h2>
                <div className="as-of">
                  <CalendarDays size={13} /> Draws through {dateLabel(latest.date, true)}
                </div>
              </div>
              <section className="stats-grid" aria-label="Key observed statistics">
                <a className="stat-card" href={lastCec.source_url} target="_blank" rel="noreferrer">
                  <div className="stat-label">
                    Latest CEC cutoff{' '}
                    <span className="stat-icon">
                      <TrendingUp size={15} />
                    </span>
                  </div>
                  <div className="stat-value">
                    {lastCec.cutoff}
                    <small>CRS</small>
                  </div>
                  <div className="stat-foot">
                    <span className="stat-change">
                      {lastCec.cutoff - (previousCec?.cutoff ?? lastCec.cutoff) >= 0 ? '↗' : '↘'}{' '}
                      {Math.abs(lastCec.cutoff - (previousCec?.cutoff ?? lastCec.cutoff))} pt
                    </span>{' '}
                    from previous CEC draw <ArrowUpRight size={12} />
                  </div>
                </a>
                <a className="stat-card" href={bundle.source.url} target="_blank" rel="noreferrer">
                  <div className="stat-label">
                    Invitations in {year}
                    <span className="stat-icon peach">
                      <ArrowUpRight size={16} />
                    </span>
                  </div>
                  <div className="stat-value">{formatNumber(yearInvitations)}</div>
                  <div className="stat-foot">
                    <span className="small-dot" /> Across all draw categories{' '}
                    <ArrowUpRight size={12} />
                  </div>
                </a>
                <button className="stat-card" onClick={() => navigate('pool')}>
                  <div className="stat-label">
                    Candidates in the pool
                    <span className="stat-icon lilac">
                      <Users size={15} />
                    </span>
                  </div>
                  <div className="stat-value">{pool ? formatNumber(pool.total) : '—'}</div>
                  <div className="stat-foot">
                    Full pool · {pool ? dateLabel(pool.date) : 'Not available'}{' '}
                    <ArrowUpRight size={12} />
                  </div>
                </button>
                <a className="stat-card" href={lastCec.source_url} target="_blank" rel="noreferrer">
                  <div className="stat-label">
                    Latest CEC invitations
                    <span className="stat-icon blue">
                      <Activity size={15} />
                    </span>
                  </div>
                  <div className="stat-value">{formatNumber(lastCec.invitations)}</div>
                  <div className="stat-foot">
                    {dateLabel(lastCec.date)} · {gap} days after previous draw{' '}
                    <ArrowUpRight size={12} />
                  </div>
                </a>
              </section>
              <div className="overview-charts">
                <HistoryChart bundle={bundle} />
                <PoolPanel bundle={bundle} onExplore={() => navigate('pool')} />
              </div>
              <section className="scenario-banner">
                <div className="banner-icon">
                  <FlaskConical size={25} />
                </div>
                <div>
                  <span className="eyebrow">LESS WONDERING. MORE UNDERSTANDING.</span>
                  <h2>What could the next few draws look like?</h2>
                  <p>
                    Explore CEC scenarios with your own assumptions. Clear ranges, honest
                    limitations.
                  </p>
                </div>
                <button className="primary-button" onClick={() => navigate('scenarios')}>
                  Open the scenario lab <ArrowRight size={16} />
                </button>
                <span className="banner-decor" aria-hidden="true">
                  ✳
                </span>
              </section>
              <DrawTable bundle={bundle} compact onExplore={() => navigate('draws')} />
              <section className="trust-strip">
                <div>
                  <ShieldCheck size={20} />
                  <span>
                    <strong>Official sources. Open assumptions.</strong>
                    <small>
                      Every observed number leads back to IRCC. Every model has its limits.
                    </small>
                  </span>
                </div>
                <button className="text-button" onClick={() => navigate('methodology')}>
                  See how it works <ArrowRight size={15} />
                </button>
              </section>
            </>
          )}
          {page === 'draws' && (
            <>
              <div className="page-intro">
                <div className="eyebrow">
                  <TrendingUp size={14} /> THE STORY SO FAR
                </div>
                <h1>
                  Follow the draws.
                  <br />
                  <span>See the patterns.</span>
                </h1>
                <p>Every official round, with the context that makes the numbers useful.</p>
              </div>
              <HistoryChart bundle={bundle} expanded />
              <DrawTable bundle={bundle} />
            </>
          )}
          {page === 'pool' && (
            <>
              <div className="page-intro">
                <div className="eyebrow">
                  <Users size={14} /> MORE THAN A SINGLE NUMBER
                </div>
                <h1>A wider view of the pool.</h1>
                <p>
                  Explore score bands across the full Express Entry pool, one official snapshot at a
                  time.
                </p>
              </div>
              <Distribution
                bundle={bundle}
                score={score}
                onScore={setScore}
                onCalculate={() => navigate('calculator')}
              />
              <details className="observed-pool">
                <summary>
                  Explore the official score bands <span>Observed IRCC counts</span>
                </summary>
                <PoolPanel
                  bundle={bundle}
                  expanded
                  sharedScore={score}
                  onScore={setScore}
                  onCalculate={() => navigate('calculator')}
                />
              </details>
              <section className="pool-explainer">
                <span className="soft-icon">
                  <InfoIcon />
                </span>
                <div>
                  <h3>A snapshot, not a waiting list.</h3>
                  <p>
                    Profiles enter, change scores, and expire between snapshots. These counts
                    include candidates across programs and overlapping categories. They do not
                    reveal the number of CEC-eligible candidates ahead of you.
                  </p>
                  <button className="text-button" onClick={() => navigate('methodology')}>
                    Understand the limitations <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            </>
          )}
          {page === 'calculator' && (
            <Calculator
              profile={profile}
              setProfile={setProfile}
              score={score}
              today={today}
              onUse={(value) => {
                setScore(value)
                navigate('scenarios')
              }}
            />
          )}
          {page === 'scenarios' && (
            <Scenario
              bundle={bundle}
              today={today}
              score={score}
              onScore={setScore}
              onCalculate={() => navigate('calculator')}
            />
          )}
          {page === 'methodology' && <Methodology bundle={bundle} />}
          <div
            className={
              'freshness-strip ' +
              (stale || connection === 'unavailable' || bundle.status?.last_refresh?.ok === false
                ? 'needs-refresh'
                : '')
            }
            aria-live="polite"
          >
            <span className="freshness-dot" />
            <span>
              IRCC data checked {dateLabel(bundle.source.fetched_at, true)} ·{' '}
              {api ? 'Updates hourly' : 'Saved snapshot'}
              {(connection === 'unavailable' ||
                bundle.status?.last_refresh?.ok === false ||
                stale) && (
                <small>
                  Showing saved data while updates are unavailable. Newer draws may be missing.
                </small>
              )}
            </span>
          </div>
          <footer>
            <div className="footer-brand">
              <BrandMark />
              <span>YourPR.</span>
            </div>
            <div className="footer-copy">
              <p>
                For entertainment and exploration only. Do not base immigration or other decisions
                on this service. Verify with IRCC.
              </p>
              <details className="site-disclaimer">
                <summary>Disclaimer & privacy</summary>
                <p>
                  This independent service is provided “as is” and “as available”, without
                  warranties of accuracy, completeness, timeliness, availability or fitness for a
                  purpose. It is not affiliated with IRCC and provides no immigration, legal or
                  financial advice. Estimates do not establish eligibility or guarantee an
                  invitation. To the fullest extent permitted by applicable law, the creator
                  disclaims liability for losses or damages arising from use of, or reliance on,
                  this service. Your calculator answers are processed in your browser and are not
                  sent to our server or stored after a reload.
                </p>
              </details>
            </div>
            <div className="footer-links">
              <a href="https://balk.sh/?ref=yourpr" target="_blank" rel="noopener">
                By Ivan <ArrowUpRight size={13} />
              </a>
              {repoUrl && /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(repoUrl) && (
                <a href={repoUrl} target="_blank" rel="noreferrer">
                  GitHub <ArrowUpRight size={13} />
                </a>
              )}
              <a href={bundle.source.url} target="_blank" rel="noreferrer">
                IRCC source <ArrowUpRight size={13} />
              </a>
            </div>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Quick navigation" inert={menu}>
        {(['overview', 'pool', 'calculator', 'scenarios'] as const).map((id) => {
          const item = pages.find((p) => p.id === id)!
          return (
            <a
              key={id}
              href={'#' + id}
              aria-current={page === id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                navigate(id)
              }}
            >
              <item.icon size={21} />
              <span>
                {
                  { overview: 'Home', pool: 'Pool', calculator: 'My score', scenarios: 'What if' }[
                    id
                  ]
                }
              </span>
            </a>
          )
        })}
        <button
          ref={menuButton}
          aria-controls="all-pages"
          aria-label="More pages"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <MoreHorizontal size={21} />
          <span>More</span>
        </button>
      </nav>
    </div>
  )
}
function InfoIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7v1" />
    </svg>
  )
}
