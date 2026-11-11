import { describePeriod, shiftKey, ymd, parseD } from './budgetPeriods'

export const partsOf = (i) => (Array.isArray(i.items) ? i.items.filter(p => p && p.name) : [])
export const plannedOf = (i) => {
  const parts = partsOf(i)
  return parts.length ? parts.reduce((a, p) => a + (Number(p.amount) || 0), 0) : (Number(i.planned_amount) || 0)
}
const same = (a, b) => a.kind === b.kind && a.category.toLowerCase() === b.category.toLowerCase()

// Date a bill is due inside a period (clamped to short months), or null.
export function billDueDate(dueDay, period) {
  if (!dueDay || !period) return null
  for (let m = 0; m < 3; m++) {
    const x = new Date(period.start.getFullYear(), period.start.getMonth() + m, 1)
    const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
    const d = new Date(x.getFullYear(), x.getMonth(), Math.min(Number(dueDay), last))
    if (d >= period.start && d <= period.end) return d
  }
  return null
}

// Rolled-over amount for every line that has rollover switched on.
// 'prev' = only last period's leftover; 'all' = leftovers accumulate across consecutive periods.
// carry_debt lets an overspend reduce the next period instead of vanishing.
export function computeCarries(items, rollItems, spendRows, periodKey, settings, customs) {
  const out = {}
  items.filter(i => i.kind === 'expense' && i.rollover).forEach(line => {
    const mode = line.rollover_mode === 'all' ? 'all' : 'prev'
    const chain = []
    let k = shiftKey(periodKey, -1, settings, customs)
    while (k && chain.length < (mode === 'all' ? 36 : 1)) {
      const it = rollItems.find(r => r.month === k && same(r, line))
      if (!it) break
      const p = describePeriod(k, settings, customs)
      if (!p) break
      chain.push({ it, p })
      k = shiftKey(k, -1, settings, customs)
    }
    let running = 0
    const capOf = Number(line.rollover_cap) || 0
    for (let n = chain.length - 1; n >= 0; n--) {
      const { it, p } = chain[n]
      const s = ymd(p.start), e = ymd(p.end)
      const spent = spendRows.filter(t => t.date >= s && t.date <= e && (t.category || '').toLowerCase() === it.category.toLowerCase()).reduce((a, t) => a + Number(t.amount), 0)
      const left = plannedOf(it) + (mode === 'all' ? running : 0) - spent
      running = line.carry_debt ? left : Math.max(0, left)
      if (capOf > 0) running = Math.min(running, capOf)
    }
    const cap = Number(line.rollover_cap) || 0
    out[line.id] = cap > 0 ? Math.min(running, cap) : running
  })
  return out
}

export function csvEscape(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export { parseD }

const LEGACY_COLORS = { '#1E5C57': '#E4786A', '#8FC2BE': '#EC9A8C', '#D9A8B8': '#EC9A8C', '#E4CBA0': '#F6D0C8', '#7BA37A': '#6B7B3F', '#C2567D': '#E4786A', '#E8A5BC': '#EC9A8C', '#B896C9': '#C5CDE6', '#F3C9A8': '#F6D0C8', '#7BC4A8': '#6B7B3F', '#E0A458': '#EDD98A' }
export const fixColor = (c) => (c && LEGACY_COLORS[c.toUpperCase()]) || c
export const round2 = (n) => Math.round(n * 100) / 100
export const sumTx = (list, kind, cat) =>
  list.filter(t => t.type === kind && (t.category || 'Uncategorized').toLowerCase() === cat.toLowerCase()).reduce((s, t) => s + Number(t.amount), 0)

// Income that %-of-income lines and "unallocated" are worked out from.
export function incomeBaseFor(items, mode, recentIncome) {
  const planned = items.filter(i => i.kind === 'income' && !(Number(i.pct_of_income) > 0)).reduce((a, i) => a + plannedOf(i), 0)
  const past = (recentIncome || []).filter(v => v > 0)
  if (mode === 'lowest' && past.length) return Math.min(planned || Infinity, ...past)
  if (mode === 'average' && past.length) return round2(past.reduce((a, v) => a + v, 0) / past.length)
  return planned
}

// Every budget line with its working-out: planned, carry, actual, bills, goals, debt…
export function buildRows({ items, carries, tx, prevTx, goals, payments, period, incomeBase, debtSpend }) {
  const linkedGoals = new Set(items.map(i => i.savings_goal_id).filter(Boolean))
  return items.map((i, idx) => {
    const parts = partsOf(i)
    const pctOf = Number(i.pct_of_income) || 0
    const basePlanned = pctOf > 0 ? round2(incomeBase * pctOf / 100) : plannedOf(i)
    const carry = carries[i.id] || 0
    const fundTotal = Number(i.fund_total) || 0
    const planned = fundTotal > 0 ? Math.max(0, Math.min(basePlanned, fundTotal - carry)) : basePlanned
    const budget = planned + carry
    const cat = i.category.toLowerCase()
    const catTx = tx.filter(t => t.type === i.kind && (t.category || 'Uncategorized').toLowerCase() === cat)
    const lineTx = i.savings_goal_id
      ? [...tx.filter(t => t.savings_goal_id === i.savings_goal_id), ...catTx.filter(t => !t.savings_goal_id)]
      : catTx.filter(t => !(t.savings_goal_id && linkedGoals.has(t.savings_goal_id)))
    const actual = lineTx.reduce((a, t) => a + Number(t.amount), 0)
    const pct = budget > 0 ? (actual / budget) * 100 : (actual > 0 ? 999 : 0)
    const goal = i.savings_goal_id ? goals.find(g => g.id === i.savings_goal_id) : null
    const debtStart = Number(i.debt_start_balance) || 0
    const debtLeft = debtStart > 0 ? Math.max(0, debtStart - (debtSpend?.[i.id] || 0)) : null
    return {
      ...i, fundDone: fundTotal > 0 && carry >= fundTotal, color: fixColor(i.color), parts, planned, carry, budget, actual,
      prevActual: sumTx(prevTx, i.kind, i.category), lineTx, pct, goal, debtLeft,
      pay: payments.find(p => p.item_id === i.id),
      due: i.is_bill && i.due_day ? billDueDate(i.due_day, period) : null,
      pctOf, remaining: budget - actual,
      grpName: (i.grp || '').trim() || (i.kind === 'income' ? 'Income' : 'Expenses'), order: i.sort_order ?? idx,
    }
  })
}

// What you can spend per day without touching unpaid bills.
export function safeToSpend(rows, daysLeft) {
  const exp = rows.filter(r => r.kind === 'expense')
  const free = exp.reduce((a, r) => a + Math.max(0, r.remaining), 0)
  const unpaidBills = exp.filter(r => r.is_bill && !r.pay).reduce((a, r) => a + Math.max(0, Math.min(r.planned, r.remaining)), 0)
  const spendable = free - unpaidBills
  return { spendable, unpaidBills, perDay: daysLeft > 0 ? spendable / daysLeft : spendable }
}
