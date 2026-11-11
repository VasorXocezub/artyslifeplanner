import { describe, it, expect } from 'vitest'
import { planNext, planOccursOn, nextBirthday, buildIcs, toIso } from './social'

const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }

describe('social helpers', () => {
  it('toIso uses the local date', () => {
    expect(toIso(new Date(2026, 10, 11, 0, 30))).toBe('2026-11-11')
  })
  it('birthday: next date, age turning', () => {
    const b = nextBirthday({ birthday: '1990-11-14', birth_year: 1990 }, d('2026-11-11'))
    expect(b.daysAway).toBe(3)
    expect(b.turning).toBe(36)
    const rolled = nextBirthday({ birthday: '1990-11-10' }, d('2026-11-11'))
    expect(rolled.nextDate.getFullYear()).toBe(2027)
  })
  it('one-off plan in the past is past', () => {
    expect(planNext({ event_date: '2026-11-01' }, d('2026-11-11')).past).toBe(true)
    expect(planNext({ event_date: '2026-11-20' }, d('2026-11-11')).past).toBe(false)
  })
  it('weekly repeats land on the same weekday', () => {
    const ev = { event_date: '2026-11-02', recurrence: 'weekly' }
    expect(toIso(planNext(ev, d('2026-11-11')).next)).toBe('2026-11-16')
    expect(planOccursOn(ev, d('2026-11-23'))).toBe(true)
    expect(planOccursOn(ev, d('2026-11-24'))).toBe(false)
    expect(planOccursOn(ev, d('2026-10-26'))).toBe(false)
  })
  it('monthly repeats clamp to short months', () => {
    const ev = { event_date: '2026-01-31', recurrence: 'monthly' }
    expect(planOccursOn(ev, d('2026-02-28'))).toBe(true)
    expect(toIso(planNext(ev, d('2026-02-10')).next)).toBe('2026-02-28')
  })
  it('yearly repeats roll to next year', () => {
    const ev = { event_date: '2020-03-05', recurrence: 'yearly' }
    expect(toIso(planNext(ev, d('2026-11-11')).next)).toBe('2027-03-05')
  })
  it('ics has birthdays and plans', () => {
    const ics = buildIcs({ contacts: [{ id: 'a', name: 'Mom', birthday: '1960-11-14' }], events: [{ id: 'e', title: 'Dinner; fun', event_date: '2026-11-20', event_time: '19:00:00', recurrence: 'weekly' }], today: d('2026-11-11') })
    expect(ics).toContain('RRULE:FREQ=YEARLY')
    expect(ics).toContain('SUMMARY:Dinner' + String.fromCharCode(92) + '; fun')
    expect(ics).toContain('DTSTART:20261120T190000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY')
  })
})

import { parseDateLoose, parseLines, parseVcf } from './birthdayImport'
describe('birthday import', () => {
  it('parses loose dates (day first)', () => {
    expect(parseDateLoose('14/11/1990')).toEqual({ month: 11, day: 14, year: 1990 })
    expect(parseDateLoose('14 Nov')).toEqual({ month: 11, day: 14, year: null })
    expect(parseDateLoose('November 14 1990')).toEqual({ month: 11, day: 14, year: 1990 })
    expect(parseDateLoose('1990-11-14')).toEqual({ month: 11, day: 14, year: 1990 })
    expect(parseDateLoose('--1114')).toEqual({ month: 11, day: 14, year: null })
    expect(parseDateLoose('banana')).toBeNull()
  })
  it('parses lines and flags bad ones', () => {
    const { rows, bad } = parseLines('Name, Birthday\nMom, 14 Nov 1965, family\nLindi, 20/11, friends, +27 82 000 0000\nnonsense')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ name: 'Mom', birth_year: 1965, relationship: 'family' })
    expect(rows[1]).toMatchObject({ name: 'Lindi', phone: '+27 82 000 0000' })
    expect(bad).toEqual(['nonsense'])
  })
  it('parses vcf', () => {
    const rows = parseVcf('BEGIN:VCARD\nFN:Jason Smith\nBDAY:1990-12-21\nTEL;TYPE=CELL:+27 82 111 2222\nEND:VCARD\nBEGIN:VCARD\nFN:No Bday\nEND:VCARD')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Jason Smith', phone: '+27 82 111 2222', birth_year: 1990 })
  })
})
