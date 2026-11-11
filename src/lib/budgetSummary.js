import { supabase } from './supabase'
import { currentKey, describePeriod, diffDays, loadBudgetMeta, shiftKey, ymd } from './budgetPeriods'
import { buildRows, computeCarries, incomeBaseFor, safeToSpend } from './budgetEngine'

// A light, read-only version of the Budget screen's numbers, for the Dashboard.
export async function loadCurrentSummary() {
  const meta = await loadBudgetMeta()
  const { settings, customs } = meta
  const key = currentKey(settings, customs)
  const period = key && describePeriod(key, settings, customs)
  if (!period) return null
  const ok = (r) => (r.error ? [] : r.data || [])
  const [b, t, pt, ri, gl, bp] = await Promise.all([
    supabase.from('budget_items').select('*').eq('month', key),
    supabase.from('transactions').select('*').gte('date', ymd(period.start)).lte('date', ymd(period.end)),
    Promise.resolve({ data: [] }),
    supabase.from('budget_items').select('*').eq('rollover', true).neq('month', key),
    supabase.from('savings_goals').select('id, name, icon, target_amount, current_amount'),
    supabase.from('budget_bill_payments').select('*').eq('period_key', key),
  ])
  if (b.error) return null
  const items = ok(b)
  if (!items.length) return null
  const rolls = ok(ri)
  let spendRows = []
  const starts = rolls.map(r => describePeriod(r.month, settings, customs)).filter(Boolean).map(d => d.start)
  if (starts.length) {
    const min = starts.reduce((m, d) => (d < m ? d : m), starts[0])
    spendRows = ok(await supabase.from('transactions').select('date, amount, category').eq('type', 'expense').gte('date', ymd(min)).lt('date', ymd(period.start)))
  }
  let recent = []
  if (settings.income_mode && settings.income_mode !== 'planned') {
    const ds = [-1, -2, -3].map(n => describePeriod(shiftKey(key, n, settings, customs), settings, customs)).filter(Boolean)
    if (ds.length) {
      const mn = ds.reduce((m, d) => (d.start < m ? d.start : m), ds[0].start), mx = ds.reduce((m, d) => (d.end > m ? d.end : m), ds[0].end)
      const ir = ok(await supabase.from('transactions').select('date, amount').eq('type', 'income').gte('date', ymd(mn)).lte('date', ymd(mx)))
      recent = ds.map(d => ir.filter(x => x.date >= ymd(d.start) && x.date <= ymd(d.end)).reduce((a, x) => a + Number(x.amount), 0))
    }
  }
  const carries = computeCarries(items, rolls, spendRows, key, settings, customs)
  const rows = buildRows({ items, carries, tx: ok(t), prevTx: ok(pt), goals: ok(gl), payments: ok(bp), period, incomeBase: incomeBaseFor(items, settings.income_mode, recent), debtSpend: {} })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const inPeriod = today >= period.start && today <= period.end
  const daysLeft = inPeriod ? Math.max(1, diffDays(today, period.end) + 1) : 0
  const exp = rows.filter(r => r.kind === 'expense')
  return { period, inPeriod, daysLeft, ...safeToSpend(rows, daysLeft), left: exp.reduce((a, r) => a + r.remaining, 0), lines: exp.length }
}
