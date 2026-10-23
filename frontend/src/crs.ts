// Verified against IRCC's CRS grid and language equivalency tables, 2026-10-21.
// New legislation must be reviewed, not inferred from the draw-data feed.
export const CRS_SOURCE =
  'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html'
export const OFFICIAL_CALCULATOR =
  'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html'
export const LANGUAGE_SOURCE =
  'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html'
export const CRS_VERIFIED = '2026-10-21'
export const CRS_RULES_END = '2026-11-03'
export const crsRulesSupported = (day: string) => day >= '2025-03-25' && day < CRS_RULES_END
export const EDUCATION = [
  'Less than high school',
  'High school',
  'One-year post-secondary credential',
  'Two-year post-secondary credential',
  'Bachelor’s / three-year credential',
  'Two or more credentials (one is 3+ years)',
  'Master’s / eligible professional degree',
  'Doctorate (PhD)',
] as const
export const ABILITIES = ['Speaking', 'Listening', 'Reading', 'Writing'] as const
export type Test = 'none' | 'clb' | 'nclc' | 'celpip' | 'ielts' | 'pte' | 'tef' | 'tcf'
export type Levels = [number, number, number, number]
export type Language = { test: Test | ''; levels: Levels }
export const emptyLanguage = (): Language => ({ test: '', levels: [-1, -1, -1, -1] })
export const TEST_NAMES: Record<Test, string> = {
  none: 'No valid test',
  clb: 'I know my CLB levels',
  nclc: 'I know my NCLC levels',
  celpip: 'CELPIP General',
  ielts: 'IELTS General Training',
  pte: 'PTE Core',
  tef: 'TEF Canada · previous-score equivalency',
  tcf: 'TCF Canada',
}
// Minimum scores for CLB/NCLC 4 through 10, in speaking/listening/reading/writing order.
export const THRESHOLDS: Partial<Record<Test, number[][]>> = {
  ielts: [
    [4, 5, 5.5, 6, 6.5, 7, 7.5],
    [4.5, 5, 5.5, 6, 7.5, 8, 8.5],
    [3.5, 4, 5, 6, 6.5, 7, 8],
    [4, 5, 5.5, 6, 6.5, 7, 7.5],
  ],
  pte: [
    [42, 51, 59, 68, 76, 84, 89],
    [28, 39, 50, 60, 71, 82, 89],
    [33, 42, 51, 60, 69, 78, 88],
    [41, 51, 60, 69, 79, 88, 90],
  ],
  tef: [
    [181, 226, 271, 310, 349, 371, 393],
    [145, 181, 217, 249, 280, 298, 316],
    [121, 151, 181, 207, 233, 248, 263],
    [181, 226, 271, 310, 349, 371, 393],
  ],
  tcf: [
    [4, 6, 7, 10, 12, 14, 16],
    [331, 369, 398, 458, 503, 523, 549],
    [342, 375, 406, 453, 499, 524, 549],
    [4, 6, 7, 10, 12, 14, 16],
  ],
}
const maxima: Partial<Record<Test, number[]>> = {
  ielts: [9, 9, 9, 9],
  pte: [90, 90, 90, 90],
  tef: [450, 360, 300, 450],
  tcf: [20, 699, 699, 20],
}
export function languageOptions(test: Test, ability: number) {
  const thresholds = THRESHOLDS[test]?.[ability]
  const prefix = ['nclc', 'tef', 'tcf'].includes(test) ? 'NCLC' : 'CLB'
  return [0, 4, 5, 6, 7, 8, 9, 10].map((level) => {
    if (!thresholds)
      return {
        value: level,
        label:
          level === 0
            ? 'Below 4'
            : `${test === 'celpip' ? '' : prefix + ' '}${level}${level === 10 ? '+' : ''}`,
      }
    if (!level) return { value: 0, label: `Below ${thresholds[0]}` }
    const start = thresholds[level - 4]
    const end =
      level === 10 ? maxima[test]![ability] : thresholds[level - 3] - (test === 'ielts' ? 0.5 : 1)
    return {
      value: level,
      label: `${start}${end === start ? '' : '–' + end} · ${prefix} ${level}${level === 10 ? '+' : ''}`,
    }
  })
}
export type Profile = {
  age: string
  education: string
  partner: '' | 'none' | 'accompanying' | 'nonaccompanying' | 'canadian'
  english: Language
  french: Language
  canadianYears: string
  foreignYears: string
  canadianEducation: string
  nomination: boolean
  sibling: boolean
  trade: boolean
  spouseEducation: string
  spouseYears: string
  spouseLanguage: Language
}
export const emptyProfile = (): Profile => ({
  age: '',
  education: '',
  partner: '',
  english: emptyLanguage(),
  french: { test: 'none', levels: [0, 0, 0, 0] },
  canadianYears: '',
  foreignYears: '',
  canadianEducation: '0',
  nomination: false,
  sibling: false,
  trade: false,
  spouseEducation: '',
  spouseYears: '',
  spouseLanguage: { test: 'none', levels: [0, 0, 0, 0] },
})
const languageComplete = (l: Language) =>
  l.test === 'none' || (!!l.test && l.levels.every((n) => [0, 4, 5, 6, 7, 8, 9, 10].includes(n)))
export function profileErrors(p: Profile, step: number): string[] {
  const errors: string[] = []
  if (step === 0) {
    if (!p.partner) errors.push('Choose your relationship situation.')
    if (!p.age || !Number.isInteger(Number(p.age)) || +p.age < 0 || +p.age > 100)
      errors.push('Enter an age between 0 and 100.')
    if (!/^[0-7]$/.test(p.education)) errors.push('Choose your highest eligible education.')
    if (p.partner === 'accompanying' && !/^[0-7]$/.test(p.spouseEducation))
      errors.push('Choose your partner’s eligible education.')
  }
  if (step === 1) {
    if (!languageComplete(p.english))
      errors.push('Complete all four English abilities or choose “No valid test”.')
    if (!languageComplete(p.french))
      errors.push('Complete all four French abilities or choose “No valid test”.')
    if (p.partner === 'accompanying' && !languageComplete(p.spouseLanguage))
      errors.push('Complete your partner’s language results.')
  }
  if (step === 2) {
    if (!/^[0-5]$/.test(p.canadianYears)) errors.push('Choose your Canadian work experience.')
    if (!/^[0-3]$/.test(p.foreignYears)) errors.push('Choose your foreign work experience.')
    if (p.partner === 'accompanying' && !/^[0-5]$/.test(p.spouseYears))
      errors.push('Choose your partner’s Canadian experience.')
  }
  if (step === 3 && !['0', '15', '30'].includes(p.canadianEducation))
    errors.push('Choose an eligible Canadian education category.')
  return errors
}
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
export function agePoints(age: number, partner: boolean) {
  const single = [
    99, 105, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 105, 99, 94, 88, 83, 77, 72, 66, 61,
    55, 50, 39, 28, 17, 6,
  ]
  const married = [
    90, 95, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55,
    50, 45, 35, 25, 15, 5,
  ]
  return (partner ? married : single)[age - 18] ?? 0
}
const firstPoints = (level: number, partner: boolean) =>
  level < 4
    ? 0
    : level < 6
      ? 6
      : (partner ? [8, 16, 22, 29, 32] : [9, 17, 23, 31, 34])[Math.min(level, 10) - 6]
const secondPoints = (level: number) => (level < 5 ? 0 : level < 7 ? 1 : level < 9 ? 3 : 6)
const spousePoints = (level: number) => (level < 5 ? 0 : level < 7 ? 1 : level < 9 ? 3 : 5)
const levels = (l: Language): Levels => (l.test === 'none' ? [0, 0, 0, 0] : l.levels)
export function calculateCrs(p: Profile, day: string) {
  if (!crsRulesSupported(day))
    throw new Error('This scoring rule set requires review. Use the official IRCC calculator.')
  const errors = [0, 1, 2, 3].flatMap((step) => profileErrors(p, step))
  if (errors.length) throw new Error(errors[0])
  const partner = p.partner === 'accompanying',
    education = +p.education,
    canadian = +p.canadianYears,
    foreign = +p.foreignYears
  const english = levels(p.english),
    french = levels(p.french)
  const calculate = (first: Levels, second: Levels, firstLanguage: string) => {
    const minimum = Math.min(...first)
    const educationTier = education >= 5 ? 2 : education >= 2 ? 1 : 0
    const foreignTier = foreign >= 3 ? 2 : foreign >= 1 ? 1 : 0
    const pair = (tier: number, strength: number) =>
      !tier || !strength
        ? 0
        : tier === 1 && strength === 1
          ? 13
          : tier === 2 && strength === 2
            ? 50
            : 25
    const languageTier = minimum >= 9 ? 2 : minimum >= 7 ? 1 : 0
    const workTier = canadian >= 2 ? 2 : canadian >= 1 ? 1 : 0
    const educationTransfer = Math.min(
      50,
      pair(educationTier, languageTier) + pair(educationTier, workTier),
    )
    const foreignTransfer = Math.min(
      50,
      pair(foreignTier, languageTier) + pair(foreignTier, workTier),
    )
    const tradeTransfer = p.trade ? (minimum >= 7 ? 50 : minimum >= 5 ? 25 : 0) : 0
    const core = {
      Age: agePoints(+p.age, partner),
      Education: (partner
        ? [0, 28, 84, 91, 112, 119, 126, 140]
        : [0, 30, 90, 98, 120, 128, 135, 150])[education],
      'First language': sum(first.map((n) => firstPoints(n, partner))),
      'Second language': Math.min(partner ? 22 : 24, sum(second.map(secondPoints))),
      'Canadian experience': (partner ? [0, 35, 46, 56, 63, 70] : [0, 40, 53, 64, 72, 80])[
        canadian
      ],
    }
    const spouse = partner
      ? {
          Education: [0, 2, 6, 7, 8, 9, 10, 10][+p.spouseEducation],
          Language: sum(levels(p.spouseLanguage).map(spousePoints)),
          'Canadian experience': [0, 5, 7, 8, 9, 10][+p.spouseYears],
        }
      : { Education: 0, Language: 0, 'Canadian experience': 0 }
    const frenchBonus = Math.min(...french) >= 7 ? (Math.min(...english) >= 5 ? 50 : 25) : 0
    const extra = {
      'Provincial nomination': p.nomination ? 600 : 0,
      'Canadian education': +p.canadianEducation,
      'French proficiency': frenchBonus,
      'Sibling in Canada': p.sibling ? 15 : 0,
    }
    const transfer = {
      'Education combinations': educationTransfer,
      'Foreign work combinations': foreignTransfer,
      'Trade qualification': tradeTransfer,
    }
    const totals = {
      core: sum(Object.values(core)),
      spouse: sum(Object.values(spouse)),
      transfer: Math.min(100, sum(Object.values(transfer))),
      additional: Math.min(600, sum(Object.values(extra))),
    }
    return {
      total: sum(Object.values(totals)),
      totals,
      core,
      spouse,
      transfer,
      extra,
      firstLanguage,
    }
  }
  const en = calculate(english, french, 'English'),
    fr = calculate(french, english, 'French')
  return fr.total > en.total ? fr : en
}
