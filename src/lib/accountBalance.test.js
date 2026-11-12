import { describe, it, expect } from 'vitest'
import { balanceAsOf, monthBalances } from './accountBalance'

const acct = { starting_balance: 1000, start_date: '2026-10-15' }
const txs = [
  { date: '2026-10-10', type: 'expense', amount: 999 }, // before start: ignored
  { date: '2026-10-20', type: 'expense', amount: 100 },
  { date: '2026-11-02', type: 'income', amount: 500 },
  { date: '2026-11-05', type: 'expense', amount: 354.92 },
]
describe('account balance', () => {
  it('ignores transactions before the start date', () => {
    expect(balanceAsOf(acct, txs, '2026-10-31')).toBe(900)
  })
  it('opening and closing for a month', () => {
    const m = monthBalances(acct, txs, '2026-11-01', '2026-11-30', '2026-11-12')
    expect(m.opening).toBe(900)
    expect(m.closing).toBeCloseTo(1045.08, 2)
    expect(m.isCurrent).toBe(true)
  })
  it('starts mid-month and before-start months', () => {
    const m = monthBalances(acct, txs, '2026-10-01', '2026-10-31', '2026-11-12')
    expect(m.opening).toBe(1000)
    expect(m.closing).toBe(900)
    expect(monthBalances(acct, txs, '2026-09-01', '2026-09-30', '2026-11-12').before).toBe(true)
    expect(monthBalances(null, txs, '2026-11-01', '2026-11-30', '2026-11-12')).toBeNull()
  })
})
