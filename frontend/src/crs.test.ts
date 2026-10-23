import { describe, expect, it } from 'vitest'
import {
  agePoints,
  calculateCrs,
  crsRulesSupported,
  emptyProfile,
  languageOptions,
  profileErrors,
} from './crs'
import type { Profile } from './crs'
const day = '2026-10-21'
const example = (): Profile => ({
  ...emptyProfile(),
  age: '29',
  education: '4',
  partner: 'none',
  english: { test: 'clb', levels: [9, 9, 9, 9] },
  canadianYears: '1',
  foreignYears: '3',
})
describe('CRS: independently worked examples from the official grid', () => {
  it('scores a single bachelor with CLB 9 and Canadian/foreign experience at 482', () => {
    const r = calculateCrs(example(), day)
    expect(r.totals).toEqual({ core: 394, spouse: 0, transfer: 88, additional: 0 })
    expect(r.total).toBe(482)
  })
  it('scores an accompanying partner using the separate applicant and spouse grids', () => {
    const p = {
      ...example(),
      partner: 'accompanying' as const,
      spouseEducation: '4',
      spouseYears: '1',
      spouseLanguage: {
        test: 'clb' as const,
        levels: [9, 9, 9, 9] as [number, number, number, number],
      },
    }
    expect(calculateCrs(p, day).totals).toEqual({
      core: 363,
      spouse: 33,
      transfer: 88,
      additional: 0,
    })
    expect(calculateCrs(p, day).total).toBe(484)
  })
  it.each(['nonaccompanying', 'canadian'] as const)(
    'uses the single grid for %s partner',
    (partner) => {
      expect(calculateCrs({ ...example(), partner }, day).total).toBe(482)
    },
  )
  it('caps additional and transfer factors, including combined nomination and French points', () => {
    const p = {
      ...example(),
      education: '7',
      canadianYears: '5',
      english: {
        test: 'clb' as const,
        levels: [10, 10, 10, 10] as [number, number, number, number],
      },
      french: {
        test: 'nclc' as const,
        levels: [10, 10, 10, 10] as [number, number, number, number],
      },
      nomination: true,
      sibling: true,
      canadianEducation: '30',
      trade: true,
    }
    expect(calculateCrs(p, day).totals).toEqual({
      core: 500,
      spouse: 0,
      transfer: 100,
      additional: 600,
    })
    expect(calculateCrs(p, day).total).toBe(1200)
    const married = {
      ...p,
      partner: 'accompanying' as const,
      spouseEducation: '7',
      spouseYears: '5',
      spouseLanguage: p.english,
    }
    expect(calculateCrs(married, day).totals).toEqual({
      core: 460,
      spouse: 40,
      transfer: 100,
      additional: 600,
    })
    expect(calculateCrs(married, day).core['Second language']).toBe(22)
  })
  it('requires every language ability to clear the transfer threshold', () => {
    const p = { ...example(), canadianYears: '0', foreignYears: '0', education: '6' }
    expect(calculateCrs(p, day).totals.transfer).toBe(50)
    p.english.levels = [9, 9, 9, 8]
    expect(calculateCrs(p, day).totals.transfer).toBe(25)
    p.english.levels = [9, 9, 9, 6]
    expect(calculateCrs(p, day).totals.transfer).toBe(0)
  })
  it('automatically selects French when it earns a higher total and awards the correct French bonus', () => {
    const p = example()
    p.english = { test: 'clb', levels: [4, 4, 4, 4] }
    p.french = { test: 'nclc', levels: [7, 7, 7, 7] }
    expect(calculateCrs(p, day).firstLanguage).toBe('French')
    expect(calculateCrs(p, day).extra['French proficiency']).toBe(25)
    p.english.levels = [5, 5, 5, 5]
    expect(calculateCrs(p, day).extra['French proficiency']).toBe(50)
  })
  it('handles age boundaries without interpolation', () => {
    expect([17, 18, 19, 29, 30, 44, 45].map((a) => agePoints(a, false))).toEqual([
      0, 99, 105, 110, 105, 6, 0,
    ])
    expect([17, 18, 19, 29, 30, 44, 45].map((a) => agePoints(a, true))).toEqual([
      0, 90, 95, 100, 95, 5, 0,
    ])
  })
  it('does not invent scores for incomplete answers or use known-expired rules', () => {
    expect(profileErrors(emptyProfile(), 0).length).toBe(3)
    expect(() => calculateCrs(emptyProfile(), day)).toThrow()
    expect(crsRulesSupported('2026-11-02')).toBe(true)
    expect(crsRulesSupported('2026-11-03')).toBe(false)
    expect(() => calculateCrs(example(), '2026-11-03')).toThrow(/review/)
  })
  it('presents score ranges correctly for all five approved tests', () => {
    expect(languageOptions('ielts', 1).find((o) => o.value === 9)?.label).toBe('8 · CLB 9')
    expect(languageOptions('ielts', 2).find((o) => o.value === 9)?.label).toBe('7–7.5 · CLB 9')
    expect(languageOptions('pte', 3).find((o) => o.value === 10)?.label).toBe('90 · CLB 10+')
    expect(languageOptions('tef', 2).find((o) => o.value === 7)?.label).toBe('207–232 · NCLC 7')
    expect(languageOptions('tcf', 0).find((o) => o.value === 7)?.label).toBe('10–11 · NCLC 7')
    expect(languageOptions('celpip', 0).find((o) => o.value === 10)?.label).toBe('10+')
  })
})
