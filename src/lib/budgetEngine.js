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
    for (let n = chain.length - 1; n >= 0; n--) {
      const { it, p } = chain[n]
      const s = ymd(p.start), e = ymd(p.end)
      const spent = spendRows.filter(t => t.date >= s && t.date <= e && (t.category || '').toLowerCase() === it.category.toLowerCase()).reduce((a, t) => a + Number(t.amount), 0)
      const left = plannedOf(it) + (mode === 'all' ? running : 0) - spent
      running = line.carry_debt ? left : Math.max(0, left)
    }
    out[line.id] = running
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
