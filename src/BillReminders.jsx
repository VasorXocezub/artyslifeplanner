import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { currentKey, describePeriod, loadBudgetMeta, fmtShort } from './lib/budgetPeriods'
import { billDueDate, plannedOf } from './lib/budgetEngine'

// Overdue and soon-due bills from the current budget period.
export default function BillReminders({ currency, withinDays = 5 }) {
  const [list, setList] = useState([])
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const meta = await loadBudgetMeta()
        const key = currentKey(meta.settings, meta.customs)
        const p = key && describePeriod(key, meta.settings, meta.customs)
        if (!p) return
        const [b, pay] = await Promise.all([
          supabase.from('budget_items').select('*').eq('month', key).eq('is_bill', true),
          supabase.from('budget_bill_payments').select('item_id').eq('period_key', key),
        ])
        if (b.error || !live) return
        const paid = new Set((pay.error ? [] : pay.data || []).map(x => x.item_id))
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const out = (b.data || []).filter(i => !paid.has(i.id)).map(i => ({ i, due: billDueDate(i.due_day, p) }))
          .filter(x => x.due && Math.round((x.due - today) / 864e5) <= withinDays)
          .sort((a, c) => a.due - c.due)
        if (live) setList(out.map(x => ({ id: x.i.id, name: x.i.category, icon: x.i.icon, amount: plannedOf(x.i), due: x.due, late: x.due < today })))
      } catch { /* budget tables not set up yet: show nothing */ }
    })()
    return () => { live = false }
  }, [withinDays])

  if (!list.length) return null
  const money = (n) => formatMoney(n, currency, Number.isInteger(n) ? 0 : 2)
  return (
    <div className="calendar-card bd-reminders" role="status">
      <p className="module-group-label">Bills to pay</p>
      <ul>
        {list.map(b => (
          <li key={b.id}>
            <span>{b.icon || '🧾'} {b.name}</span>
            <span style={b.late ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{b.late ? 'overdue · ' : 'due '}{fmtShort(b.due)} · {money(b.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
