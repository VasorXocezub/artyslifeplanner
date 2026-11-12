import { describe, it, expect } from 'vitest'
import { fmtClock, minutesOn, lastDays, focusStreak } from './focus'

const at = (y, m, d, h = 10) => new Date(y, m, d, h).toISOString()
describe('focus helpers', () => {
  const today = new Date(2026, 10, 12, 9)
  const sessions = [
    { completed_at: at(2026, 10, 12), duration_minutes: 25 },
    { completed_at: at(2026, 10, 12, 15), duration_minutes: 45 },
    { completed_at: at(2026, 10, 11), duration_minutes: 25 },
    { completed_at: at(2026, 10, 10), duration_minutes: 25 },
    { completed_at: at(2026, 10, 7), duration_minutes: 25 },
  ]
  it('formats the clock', () => { expect(fmtClock(1500)).toBe('25:00'); expect(fmtClock(65)).toBe('01:05'); expect(fmtClock(-3)).toBe('00:00') })
  it('minutes per day', () => { expect(minutesOn(sessions, '2026-11-12')).toBe(70) })
  it('last 7 days', () => { const d = lastDays(sessions, 7, today); expect(d).toHaveLength(7); expect(d[6].minutes).toBe(70); expect(d[0].date).toBe('2026-11-06') })
  it('streak counts back from today, or yesterday if today is empty', () => {
    expect(focusStreak(sessions, today)).toBe(3)
    expect(focusStreak(sessions.slice(2), today)).toBe(2)
    expect(focusStreak([], today)).toBe(0)
  })
})
