import { describe, it, expect } from 'vitest'
import { derivedPct, effectiveStatus, effectivePct, dueInfo, computeBadges, habitConsistency, sparkPoints, sortGoals } from './goals'

describe('goals helpers', () => {
  it('milestones drive progress', () => {
    const g = { goal_type: 'simple', milestones: [{ t: 'a', d: true }, { t: 'b', d: false }, { t: 'c', d: false }, { t: 'd', d: true }] }
    expect(derivedPct(g)).toBe(50)
    expect(effectiveStatus(g)).toBe('in_progress')
    expect(effectiveStatus({ ...g, milestones: g.milestones.map((m) => ({ ...m, d: true })) })).toBe('done')
  })
  it('plain status goals have no fake percent', () => {
    expect(derivedPct({ goal_type: 'simple', status: 'in_progress' })).toBeNull()
    expect(effectivePct({ goal_type: 'simple', status: 'in_progress' })).toBe(50)
  })
  it('linked savings goal drives progress', () => {
    const ctx = { savings: { s1: { current_amount: 250, target_amount: 1000 } } }
    expect(derivedPct({ linked_savings_id: 's1' }, ctx)).toBe(25)
  })
  it('due info', () => {
    const today = new Date(2026, 10, 11)
    expect(dueInfo({ target_date: '2026-11-06' }, 'in_progress', today)).toMatchObject({ label: 'overdue 5d', tone: 'late' })
    expect(dueInfo({ target_date: '2026-11-11' }, 'in_progress', today).label).toBe('due today')
    expect(dueInfo({ target_date: '2026-12-01' }, 'in_progress', today).label).toBe('in 20d')
    expect(dueInfo({ target_date: '2026-11-01' }, 'done', today)).toBeNull()
  })
  it('badges are earned, not age-based', () => {
    const now = new Date('2026-11-11T12:00:00Z')
    const ups = [1, 2, 3].map((d) => ({ created_at: new Date(now - d * 86400000).toISOString() }))
    const b = computeBadges({}, 60, 'in_progress', ups, {}, now).map((x) => x.label)
    expect(b).toEqual(expect.arrayContaining(['First step', 'On a roll', 'Halfway there']))
    expect(computeBadges({}, 0, 'not_started', [], {}, now)).toEqual([])
  })
  it('habit consistency and sparkline and sort', () => {
    const today = new Date(2026, 10, 11)
    const logs = ['2026-11-11', '2026-11-10', '2026-11-09'].map((d) => ({ habit_id: 'h', logged_date: d }))
    expect(habitConsistency(logs, 'h', 30, today)).toBe(10)
    expect(sparkPoints([1])).toBe('')
    expect(sparkPoints([1, 3]).split(' ')).toHaveLength(2)
    expect(sortGoals([{ id: 1, target_date: '2026-12-01' }, { id: 2, target_date: '2026-11-01' }, { id: 3 }], 'due').map((g) => g.id)).toEqual([2, 1, 3])
  })
})
