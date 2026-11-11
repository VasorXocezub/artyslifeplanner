import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { describePeriod, keyForDate, loadBudgetMeta, ymd } from './lib/budgetPeriods'

let metaPromise = null
const getMeta = () => (metaPromise ||= loadBudgetMeta().catch(() => { metaPromise = null; return null }))

// Shown under the category field when adding an expense: how much is left on that budget line,
// plus a picker for the line's items (Spotify, Capcut…) so spending is tracked exactly.
export default function BudgetHint({ category, date, type, currency, amount, excludeId, item, onItem }) {
  const [info, setInfo] = useState(null)
  const money = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return formatMoney(v, currency, Number.isInteger(v) ? 0 : 2) }

  useEffect(() => {
    let live = true
    setInfo(null)
    const cat = (category || '').trim()
    if (!cat || !date || type !== 'expense') return undefined
    ;(async () => {
      const meta = await getMeta()
      if (!meta || !live) return
      const key = keyForDate(date, meta.settings, meta.customs)
      const p = key && describePeriod(key, meta.settings, meta.customs)
      if (!p) return
      const [b, t] = await Promise.all([
        supabase.from('budget_items').select('*').eq('month', key).eq('kind', 'expense').ilike('category', cat),
        supabase.from('transactions').select('id, amount, category, budget_item').eq('type', 'expense').ilike('category', cat).gte('date', ymd(p.start)).lte('date', ymd(p.end)),
      ])
      if (!live || b.error || !b.data?.length) return
      const line = b.data[0]
      const parts = Array.isArray(line.items) ? line.items.filter(x => x && x.name) : []
      const spent = (t.data || []).filter(x => x.id !== excludeId).reduce((s, x) => s + Number(x.amount), 0)
      const planned = parts.length ? parts.reduce((s, x) => s + (Number(x.amount) || 0), 0) : Number(line.planned_amount) || 0
      setInfo({ planned, spent, parts, label: p.label })
    })()
    return () => { live = false }
  }, [category, date, type, excludeId])

  if (!info) return null
  const after = info.planned - info.spent - (Number(amount) || 0)
  return (
    <div className="bd-hint">
      <small style={{ color: after < 0 ? 'var(--danger)' : 'var(--good)' }}>
        {after >= 0
          ? `${money(info.planned - info.spent)} left in ${category} (${info.label})${Number(amount) > 0 ? ` → ${money(after)} after this` : ''}`
          : `This puts ${category} ${money(-after)} over budget (${info.label})`}
      </small>
      {info.parts.length > 0 && (
        <select value={item || ''} onChange={e => onItem(e.target.value)} aria-label="Budget item" style={{ marginTop: 6 }}>
          <option value="">Which item? (optional)</option>
          {info.parts.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}
        </select>
      )}
    </div>
  )
}
