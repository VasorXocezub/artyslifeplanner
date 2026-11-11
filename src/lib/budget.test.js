import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: {}, getUserId: async () => 'u' }))
import { describePeriod, keyForDate, shiftKey, DEFAULT_SETTINGS } from './budgetPeriods'
import { computeCarries, buildRows, safeToSpend, incomeBaseFor, billDueDate } from './budgetEngine'
import { parseAmount, parseDate, parseCSV, matchRule } from './budgetRules'

const S = { ...DEFAULT_SETTINGS, overrides: {} }
const line = (o) => ({ id: 'x', kind: 'expense', category: 'Groceries', planned_amount: 1000, items: [], rollover: true, ...o })

describe('budget periods (month starts on the 25th)', () => {
  it('names a period by the month it ends in', () => {
    const p = describePeriod('2026-11', S, [])
    expect(p.start.toDateString()).toBe(new Date(2026, 9, 25).toDateString())
    expect(p.end.toDateString()).toBe(new Date(2026, 10, 24).toDateString())
  })
  it('finds the period for any date, including the boundaries', () => {
    expect(keyForDate('2026-10-25', S, [])).toBe('2026-11')
    expect(keyForDate('2026-11-24', S, [])).toBe('2026-11')
    expect(keyForDate('2026-11-25', S, [])).toBe('2026-12')
    expect(keyForDate('2026-12-31', S, [])).toBe('2027-01')
  })
  it('steps between periods across a year end', () => {
    expect(shiftKey('2026-12', 1, S, [])).toBe('2027-01')
    expect(shiftKey('2027-01', -1, S, [])).toBe('2026-12')
  })
  it('honours a custom date override for one period', () => {
    const st = { ...S, overrides: { '2026-11': { start_date: '2026-10-27', end_date: '2026-11-26' } } }
    expect(keyForDate('2026-10-26', st, [])).not.toBe('2026-11')
  })
})

describe('rollover', () => {
  const rolls = [{ ...line({ id: 'a' }), month: '2026-09' }, { ...line({ id: 'b' }), month: '2026-10' }]
  const spend = [
    { date: '2026-08-30', amount: 700, category: 'Groceries' }, // Sep period (25 Aug–24 Sep)
    { date: '2026-10-01', amount: 1200, category: 'Groceries' }, // Oct period (25 Sep–24 Oct)
  ]
  it('previous-only carries just last period’s leftover', () => {
    const c = computeCarries([line({ id: 'n' })], rolls, spend, '2026-11', S, [])
    expect(c.n).toBe(0) // October overspent, so nothing to carry
  })
  it('accumulating mode adds leftovers across periods', () => {
    const c = computeCarries([line({ id: 'n', rollover_mode: 'all' })], rolls, [{ ...spend[0] }], '2026-11', S, [])
    expect(c.n).toBe(300 + 1000) // Sep left 300, Oct untouched 1000 + 300 carried
  })
  it('debt mode lets an overspend reduce next period', () => {
    const c = computeCarries([line({ id: 'n', carry_debt: true })], rolls, spend, '2026-11', S, [])
    expect(c.n).toBe(-200)
  })
  it('respects a cap', () => {
    const c = computeCarries([line({ id: 'n', rollover_mode: 'all', rollover_cap: 500 })], rolls, [{ ...spend[0] }], '2026-11', S, [])
    expect(c.n).toBe(500)
  })
})

describe('rows', () => {
  const period = describePeriod('2026-11', S, [])
  const base = { carries: {}, tx: [], prevTx: [], goals: [], payments: [], period, debtSpend: {} }
  it('works a %-of-income line out from income', () => {
    const items = [{ id: 'i', kind: 'income', category: 'Salary', planned_amount: 20000, items: [] }, line({ id: 'p', category: 'Savings', planned_amount: 0, pct_of_income: 10, rollover: false })]
    const rows = buildRows({ ...base, items, incomeBase: incomeBaseFor(items, 'planned', []) })
    expect(rows.find(r => r.id === 'p').planned).toBe(2000)
  })
  it('caps a sinking fund at its total', () => {
    const items = [line({ id: 'f', planned_amount: 500, fund_total: 1200, fund_periods: 3, rollover_mode: 'all' })]
    const rows = buildRows({ ...base, items, carries: { f: 900 }, incomeBase: 0 })
    expect(rows[0].planned).toBe(300)
    expect(rows[0].budget).toBe(1200)
  })
  it('counts goal contributions on the linked line, not as unbudgeted', () => {
    const items = [line({ id: 's', category: 'Savings', savings_goal_id: 'g1', rollover: false })]
    const tx = [{ id: 't', type: 'expense', amount: 400, category: 'Savings', savings_goal_id: 'g1', date: '2026-11-01' }]
    expect(buildRows({ ...base, items, tx, incomeBase: 0 })[0].actual).toBe(400)
  })
  it('puts a bill on the right due date', () => {
    expect(billDueDate(1, period).toDateString()).toBe(new Date(2026, 10, 1).toDateString())
    expect(billDueDate(31, describePeriod('2026-03', S, [])).getDate()).toBeLessThanOrEqual(31)
  })
  it('safe to spend holds back unpaid bills', () => {
    const rows = [{ kind: 'expense', remaining: 1000, planned: 400, is_bill: true, pay: null }, { kind: 'expense', remaining: 600, planned: 600, is_bill: false }]
    const r = safeToSpend(rows, 10)
    expect(r.spendable).toBe(1200)
    expect(r.perDay).toBe(120)
  })
  it('irregular income: lowest / average of recent periods', () => {
    const items = [{ kind: 'income', category: 'Pay', planned_amount: 20000, items: [] }]
    expect(incomeBaseFor(items, 'lowest', [18000, 15000, 22000])).toBe(15000)
    expect(incomeBaseFor(items, 'average', [18000, 15000, 21000])).toBe(18000)
    expect(incomeBaseFor(items, 'planned', [1])).toBe(20000)
  })
})

describe('statement import helpers', () => {
  it('reads amounts in several formats', () => {
    expect(parseAmount('-1 234,56')).toBe(-1234.56)
    expect(parseAmount('R1,234.50')).toBe(1234.5)
    expect(parseAmount('(250.00)')).toBe(-250)
    expect(parseAmount('')).toBe(null)
  })
  it('reads day-first dates', () => {
    expect(parseDate('05/11/2026')).toBe('2026-11-05')
    expect(parseDate('2026-11-05')).toBe('2026-11-05')
    expect(parseDate('5 Nov 2026')).toBe('2026-11-05')
    expect(parseDate('nonsense')).toBe(null)
  })
  it('parses quoted CSV and picks the longest matching rule', () => {
    const rows = parseCSV('Date;Description;Amount\n05/11/2026;"UBER EATS; Cape Town";-120,50\n')
    expect(rows[1][1]).toBe('UBER EATS; Cape Town')
    const rules = [{ pattern: 'uber', category: 'Transport' }, { pattern: 'uber eats', category: 'Eating out' }]
    expect(matchRule('UBER EATS Cape Town', rules).category).toBe('Eating out')
    expect(matchRule('Spar', rules)).toBe(null)
  })
})
