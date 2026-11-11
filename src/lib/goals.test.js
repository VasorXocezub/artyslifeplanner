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

import { firstOpenStep, moveItem, stepDue, projectFinish, isStalled, recapStats, dreamReminders, dreamHighlights, TEMPLATES } from './goals'
describe('goals round 2', () => {
  const now = new Date(2026, 10, 11, 12)
  it('first open step + move', () => {
    expect(firstOpenStep({ milestones: [{ t: 'a', d: true }, { t: 'b' }] })).toMatchObject({ index: 1 })
    expect(firstOpenStep({ milestones: [{ t: 'a', d: true }] })).toBeNull()
    expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2])
    expect(moveItem([1, 2], 0, -1)).toEqual([1, 2])
  })
  it('step due', () => {
    expect(stepDue({ t: 'x', due: '2026-11-10' }, now).tone).toBe('late')
    expect(stepDue({ t: 'x', due: '2026-11-10', d: true }, now)).toBeNull()
  })
  it('projects finish date', () => {
    const ups = [{ created_at: '2026-10-01T00:00:00Z', value: 80 }, { created_at: '2026-11-01T00:00:00Z', value: 75 }]
    const f = projectFinish({ target_value: 70 }, ups, now)
    expect(f.startsWith('2026-12-0')).toBe(true)
    expect(projectFinish({ target_value: 70 }, [ups[0]], now)).toBeNull()
    expect(projectFinish({ target_value: 90 }, ups, now)).toBeNull() // moving away from target
  })
  it('stalled', () => {
    const old = { created_at: new Date(2026, 8, 1).toISOString() }
    expect(isStalled(old, 'in_progress', [], now)).toBe(true)
    expect(isStalled({ ...old, snoozed_until: '2026-12-01' }, 'in_progress', [], now)).toBe(false)
    expect(isStalled({ ...old, touched_at: new Date(2026, 10, 5).toISOString() }, 'in_progress', [], now)).toBe(false)
    expect(isStalled(old, 'done', [], now)).toBe(false)
  })
  it('recap', () => {
    const gs = [
      { status: 'done', category: 'A', completed_at: '2026-05-01T00:00:00Z', reward_claimed: true },
      { status: 'done', category: 'A', completed_at: '2025-05-01T00:00:00Z' },
      { status: 'in_progress', category: 'B', created_at: '2026-01-01' },
    ]
    const r = recapStats(gs, {}, 2026)
    expect(r.slayed).toHaveLength(1)
    expect(r.rewards).toBe(1)
    expect(r.topEra).toBe('A')
  })
  it('reminders + highlights + templates', () => {
    const g = { id: 1, title: 'Surf', status: 'in_progress', target_date: '2026-11-12', milestones: [{ t: 's', due: '2026-11-11' }] }
    const r = dreamReminders([g], {}, now)
    expect(r.map((x) => x.title).join('|')).toMatch(/due tomorrow/)
    expect(r.map((x) => x.title).join('|')).toMatch(/Step due today/)
    const h = dreamHighlights([g, { id: 2, title: 'P', status: 'not_started', pinned: true }], {}, now)
    expect(h.chips[0].text).toMatch(/Surf · in 1d/)
    expect(h.chips).toHaveLength(2)
    expect(TEMPLATES.length).toBeGreaterThan(3)
  })
})
