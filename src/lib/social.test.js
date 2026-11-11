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
