import { useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calculator as CalculatorIcon,
  Check,
  LockKeyhole,
} from 'lucide-react'
import {
  ABILITIES,
  calculateCrs,
  crsRulesSupported,
  CRS_SOURCE,
  CRS_VERIFIED,
  EDUCATION,
  LANGUAGE_SOURCE,
  languageOptions,
  OFFICIAL_CALCULATOR,
  profileErrors,
  TEST_NAMES,
} from './crs'
import type { Language, Profile, Test } from './crs'
import { dateLabel } from './lib'

function Choice({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[] | { value: string; label: string }[]
  hint?: string
}) {
  return (
    <label className="calc-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Choose an answer
        </option>
        {options.map((o, i) => (
          <option key={i} value={typeof o === 'string' ? i : o.value}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
      {hint && <small>{hint}</small>}
    </label>
  )
}
function LanguageFields({
  label,
  value,
  onChange,
  language,
}: {
  label: string
  value: Language
  onChange: (v: Language) => void
  language: 'english' | 'french' | 'either'
}) {
  const tests: Test[] =
    language === 'english'
      ? ['none', 'celpip', 'ielts', 'pte', 'clb']
      : language === 'french'
        ? ['none', 'tef', 'tcf', 'nclc']
        : ['none', 'celpip', 'ielts', 'pte', 'tef', 'tcf', 'clb', 'nclc']
  return (
    <fieldset className="language-fields">
      <legend>{label}</legend>
      <Choice
        label={`${label} test`}
        value={value.test}
        onChange={(v) =>
          onChange({ test: v as Test, levels: v === 'none' ? [0, 0, 0, 0] : [-1, -1, -1, -1] })
        }
        options={tests.map((t) => ({ value: t, label: TEST_NAMES[t] }))}
      />
      {value.test && value.test !== 'none' && (
        <>
          {value.test === 'tef' && (
            <p className="calc-hint">
              Use the “Équivalence ancien score” column, not the score out of 699.
            </p>
          )}
          <div className="language-grid">
            {ABILITIES.map((ability, i) => (
              <Choice
                key={ability}
                label={`${label} ${ability.toLowerCase()}`}
                value={value.levels[i] < 0 ? '' : String(value.levels[i])}
                onChange={(v) => {
                  const next = [...value.levels] as Language['levels']
                  next[i] = +v
                  onChange({ ...value, levels: next })
                }}
                options={languageOptions(value.test as Test, i).map((o) => ({
                  ...o,
                  value: String(o.value),
                }))}
              />
            ))}
          </div>
        </>
      )}
    </fieldset>
  )
}
const years = ['None / less than one year', '1 year', '2 years', '3 years', '4 years', '5+ years']
const steps = ['About you', 'Languages', 'Experience', 'Extra points', 'Your result']
export default function Calculator({
  profile,
  setProfile,
  score,
  onUse,
  today,
}: {
  profile: Profile
  setProfile: (p: Profile) => void
  score: number
  onUse: (score: number) => void
  today: string
}) {
  const [mode, setMode] = useState<'calculate' | 'manual'>('calculate')
  const [manual, setManual] = useState(String(score))
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const heading = useRef<HTMLHeadingElement>(null)
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile({ ...profile, [key]: value })
    setErrors([])
  }
  const accompanying = profile.partner === 'accompanying'
  const supported = crsRulesSupported(today)
  const complete = [0, 1, 2, 3].every((i) => profileErrors(profile, i).length === 0)
  const result = supported && complete ? calculateCrs(profile, today) : null
  const go = (next: number) => {
    setStep(next)
    setErrors([])
    requestAnimationFrame(() => {
      heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      heading.current?.focus({ preventScroll: true })
    })
  }
  const next = () => {
    const issues = profileErrors(profile, step)
    if (issues.length) setErrors(issues)
    else go(step + 1)
  }
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <CalculatorIcon size={14} /> YOUR SCORE, EXPLAINED
        </div>
        <h1>Start with your number.</h1>
        <p>A few details. A clear breakdown. No account needed.</p>
      </div>
      <div className="score-modes" role="group" aria-label="How to enter your CRS">
        <button aria-pressed={mode === 'calculate'} onClick={() => setMode('calculate')}>
          <CalculatorIcon size={17} /> Calculate my CRS
        </button>
        <button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>
          <Check size={17} /> I know my score
        </button>
      </div>
      {mode === 'manual' ? (
        <section className="panel manual-score">
          <h2>You’re ready to explore.</h2>
          <p>Enter the score from your Express Entry profile.</p>
          <label className="calc-field">
            <span>Your CRS score</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="1200"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={!manual.trim() || !Number.isInteger(+manual) || +manual < 0 || +manual > 1200}
            onClick={() => onUse(+manual)}
          >
            Explore with this score <ArrowRight size={17} />
          </button>
        </section>
      ) : !supported ? (
        <section className="panel calculator-paused">
          <h2>The scoring rules have changed.</h2>
          <p>
            Our verified rule set ended on November 3, 2026. Use IRCC’s calculator while we verify
            the new rules, then enter your score here.
          </p>
          <a className="primary-button" href={OFFICIAL_CALCULATOR} target="_blank" rel="noreferrer">
            Open official calculator <ArrowUpRight size={17} />
          </a>
        </section>
      ) : (
        <div className="calculator-layout">
          <section className="panel calculator-form">
            <ol className="calc-steps" aria-label="Calculator progress">
              {steps.map((s, i) => (
                <li key={s} aria-current={step === i ? 'step' : undefined}>
                  <span>{i < step ? <Check size={13} /> : i + 1}</span>
                  <small>{s}</small>
                </li>
              ))}
            </ol>
            <div className="calc-step-heading">
              <span className="eyebrow">STEP {step + 1} OF 5</span>
              <h2 ref={heading} tabIndex={-1}>
                {
                  [
                    'Let’s start with the basics.',
                    'Your language results.',
                    'The experience you bring.',
                    'A few finishing details.',
                    'Here’s how it adds up.',
                  ][step]
                }
              </h2>
            </div>
            {step === 0 && (
              <div className="calc-fields">
                <Choice
                  label="Your relationship situation"
                  value={profile.partner}
                  onChange={(v) => update('partner', v as Profile['partner'])}
                  options={[
                    { value: 'none', label: 'No spouse or common-law partner' },
                    { value: 'accompanying', label: 'My partner is coming with me' },
                    { value: 'nonaccompanying', label: 'My partner is not coming with me' },
                    { value: 'canadian', label: 'My partner is a Canadian citizen / PR' },
                  ]}
                  hint="Only an accompanying partner who is not a Canadian citizen or permanent resident changes the points grid."
                />
                <label className="calc-field">
                  <span>Your age</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    placeholder="e.g. 29"
                    value={profile.age}
                    onChange={(e) => update('age', e.target.value)}
                  />
                  <small>Your age today, or on the invitation date if already invited.</small>
                </label>
                <Choice
                  label="Highest eligible education"
                  value={profile.education}
                  onChange={(v) => update('education', v)}
                  options={EDUCATION}
                  hint="Use a Canadian credential or the equivalency on a valid ECA (issued within 5 years)."
                />
                <details className="calc-help">
                  <summary>Which credentials count?</summary>
                  <p>
                    For two or more credentials, at least one program must be three years or longer.
                    Eligible professional degrees are in medicine, veterinary medicine, dentistry,
                    optometry, law, chiropractic medicine or pharmacy.
                  </p>
                </details>
                {accompanying && (
                  <Choice
                    label="Partner’s highest eligible education"
                    value={profile.spouseEducation}
                    onChange={(v) => update('spouseEducation', v)}
                    options={EDUCATION}
                    hint="A foreign credential needs a valid ECA. Choose the lowest option if none qualifies."
                  />
                )}
              </div>
            )}
            {step === 1 && (
              <div className="calc-fields">
                <p className="calc-hint">
                  Use approved test results that are less than two years old. Select the range
                  containing each score. We use the first-language choice that gives the higher
                  total.
                </p>
                <LanguageFields
                  label="English"
                  language="english"
                  value={profile.english}
                  onChange={(v) => update('english', v)}
                />
                <LanguageFields
                  label="French"
                  language="french"
                  value={profile.french}
                  onChange={(v) => update('french', v)}
                />
                {accompanying && (
                  <LanguageFields
                    label="Partner"
                    language="either"
                    value={profile.spouseLanguage}
                    onChange={(v) => update('spouseLanguage', v)}
                  />
                )}
                <a className="calc-source" href={LANGUAGE_SOURCE} target="_blank" rel="noreferrer">
                  IRCC test equivalencies <ArrowUpRight size={14} />
                </a>
              </div>
            )}
            {step === 2 && (
              <div className="calc-fields">
                <p className="calc-hint">
                  Count qualifying paid work in skilled occupations (TEER 0–3) within the last 10
                  years. Use full-time years or the part-time equivalent.
                </p>
                <Choice
                  label="Canadian work experience"
                  value={profile.canadianYears}
                  onChange={(v) => update('canadianYears', v)}
                  options={years}
                  hint="Work for a Canadian employer while physically in Canada. Generally exclude self-employment and work while a full-time student; check IRCC for exceptions."
                />
                <Choice
                  label="Foreign work experience"
                  value={profile.foreignYears}
                  onChange={(v) => update('foreignYears', v)}
                  options={years.slice(0, 3).concat('3+ years')}
                />
                {accompanying && (
                  <Choice
                    label="Partner’s Canadian work experience"
                    value={profile.spouseYears}
                    onChange={(v) => update('spouseYears', v)}
                    options={years}
                  />
                )}
                <label className="calc-check">
                  <input
                    type="checkbox"
                    checked={profile.trade}
                    onChange={(e) => update('trade', e.target.checked)}
                  />
                  <span>
                    I hold a Canadian certificate of qualification in a skilled trade.
                    <small>
                      Issued by a province, territory or federal authority; this is not a provincial
                      nomination.
                    </small>
                  </span>
                </label>
              </div>
            )}
            {step === 3 && (
              <div className="calc-fields">
                <Choice
                  label="Eligible Canadian post-secondary education"
                  value={profile.canadianEducation}
                  onChange={(v) => update('canadianEducation', v)}
                  options={[
                    { value: '0', label: 'None / does not qualify' },
                    { value: '15', label: 'One- or two-year credential' },
                    { value: '30', label: '3+ years / master’s / professional degree / PhD' },
                  ]}
                />
                <details className="calc-help">
                  <summary>Canadian study requirements</summary>
                  <p>
                    Study must meet IRCC’s requirements for the Canadian education bonus: a Canadian
                    school, normally at least eight months of full-time study and physical presence,
                    and no majority language training or award requiring a return home. Special
                    exceptions apply to study during March 2020–August 2022. Distance learning alone
                    does not qualify.{' '}
                    <a href={OFFICIAL_CALCULATOR} target="_blank" rel="noreferrer">
                      Check the official conditions.
                    </a>
                  </p>
                </details>
                <label className="calc-check">
                  <input
                    type="checkbox"
                    checked={profile.nomination}
                    onChange={(e) => update('nomination', e.target.checked)}
                  />
                  <span>
                    I have an accepted Express Entry provincial or territorial nomination.
                  </span>
                </label>
                <label className="calc-check">
                  <input
                    type="checkbox"
                    checked={profile.sibling}
                    onChange={(e) => update('sibling', e.target.checked)}
                  />
                  <span>
                    I have an eligible sibling in Canada.
                    <small>
                      Age 18+, living in Canada, and a Canadian citizen or permanent resident. An
                      accompanying partner’s sibling can also qualify.
                    </small>
                  </span>
                </label>
                <p className="calc-hint">
                  Job offers do not earn CRS points under this verified rule set. French-language
                  bonus points are calculated from your test results.
                </p>
              </div>
            )}
            {step === 4 && result && (
              <div className="calc-result">
                <div className="calc-total">
                  <span>Estimated CRS score</span>
                  <strong>
                    {result.total}
                    <small> / 1,200</small>
                  </strong>
                  <p>{result.firstLanguage} used as your first official language.</p>
                </div>
                <div className="score-stack" aria-hidden="true">
                  {Object.values(result.totals).map((n, i) => (
                    <span key={i} className={`score-part part-${i}`} style={{ flexGrow: n }} />
                  ))}
                </div>
                {(
                  [
                    ['Core factors', result.totals.core, result.core],
                    ['Partner factors', result.totals.spouse, result.spouse],
                    ['Skill combinations · capped at 100', result.totals.transfer, result.transfer],
                    ['Additional points · capped at 600', result.totals.additional, result.extra],
                  ] as const
                ).map(([label, total, rows]) => (
                  <details className="score-breakdown" key={label}>
                    <summary>
                      <span>{label}</span>
                      <strong>{total}</strong>
                    </summary>
                    <dl>
                      {Object.entries(rows).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
                <p className="calc-hint">
                  This estimate does not establish program eligibility. Verify your answers and
                  result with IRCC before acting.
                </p>
              </div>
            )}
            {!!errors.length && (
              <div className="calc-errors" role="alert">
                {errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            )}
            <div className="calc-actions">
              {step > 0 && (
                <button className="secondary-button" onClick={() => go(step - 1)}>
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {step < 4 ? (
                <button className="primary-button" onClick={next}>
                  {step === 3 ? 'See my score' : 'Continue'} <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={!result}
                  onClick={() => result && onUse(result.total)}
                >
                  Use this score <ArrowRight size={16} />
                </button>
              )}
            </div>
          </section>
          <aside className="calc-aside">
            <div className="calc-aside-icon">
              <CalculatorIcon size={27} />
            </div>
            <h3>
              A little context.
              <br />A clearer picture.
            </h3>
            <p>Your score combines age, education, languages, experience and extra factors.</p>
            <div className="calc-privacy">
              <LockKeyhole size={17} />
              <span>
                Your answers stay in this tab. We don’t send them to a server or save them after a
                reload.
              </span>
            </div>
            <a href={OFFICIAL_CALCULATOR} target="_blank" rel="noreferrer">
              Compare with IRCC <ArrowUpRight size={15} />
            </a>
            <small>
              Rules checked {dateLabel(CRS_VERIFIED, true)}.<br />
              Valid before Nov 3, 2026.
            </small>
            <a className="calc-source" href={CRS_SOURCE} target="_blank" rel="noreferrer">
              Official scoring grid <ArrowUpRight size={14} />
            </a>
          </aside>
        </div>
      )}
    </>
  )
}
