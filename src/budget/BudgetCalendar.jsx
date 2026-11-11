import { useState } from 'react'
import { ymd, addDays, diffDays } from '../lib/budgetPeriods'

// Day-by-day view of a period: bills due, income received, and what was spent.
export default function BudgetCalendar({ period, rows, tx, money, today }) {
  const [sel, setSel] = useState(null)
  if (!period) return null
  const n = diffDays(period.start, period.end) + 1
  const days = Array.from({ length: n }, (_, i) => addDays(period.start, i))
  const lead = (period.start.getDay() + 6) % 7 // Monday first
  const bills = rows.filter(r => r.kind === 'expense' && r.is_bill && r.due)
  const info = (d) => {
    const k = ymd(d)
    const dayTx = tx.filter(t => t.date === k)
    return {
      k, bills: bills.filter(b => ymd(b.due) === k),
      spent: dayTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0),
      income: dayTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0),
      list: dayTx,
    }
  }
  const selected = sel ? info(new Date(sel + 'T00:00:00')) : null
  return (
    <div className="calendar-card bd-cal">
      <div className="bd-cal-grid" role="grid" aria-label={`Calendar for ${period.label}`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="bd-cal-dow">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={'p' + i} />)}
        {days.map(d => {
          const x = info(d)
          const isToday = x.k === ymd(today)
          const late = x.bills.some(b => !b.pay && d < today)
          return (
            <button key={x.k} type="button" className={`bd-cal-day ${isToday ? 'bd-cal-today' : ''} ${sel === x.k ? 'bd-cal-sel' : ''}`} onClick={() => setSel(sel === x.k ? null : x.k)} aria-label={`${d.toDateString()}: ${x.bills.length} bills, spent ${money(x.spent)}`}>
              <span className="bd-cal-num">{d.getDate()}</span>
              <span className="bd-cal-marks">
                {x.bills.length > 0 && <i title="Bill due" style={{ background: late ? 'var(--danger)' : x.bills.every(b => b.pay) ? 'var(--good)' : 'var(--accent-deep)' }} />}
                {x.income > 0 && <i title="Income" style={{ background: 'var(--good)', borderRadius: 2 }} />}
              </span>
              {x.spent > 0 && <span className="bd-cal-spent">{money(Math.round(x.spent))}</span>}
            </button>
          )
        })}
      </div>
      <div className="bd-legend" style={{ padding: '0 4px' }}>
        <span><i style={{ background: 'var(--accent-deep)' }} /> Bill due</span>
        <span><i style={{ background: 'var(--danger)' }} /> Overdue</span>
        <span><i style={{ background: 'var(--good)' }} /> Paid / income</span>
      </div>
      {selected && (
        <div className="bd-cal-detail">
          <strong>{new Date(selected.k + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          {selected.bills.map(b => <p key={b.id} className="bd-dim bd-note">🧾 {b.category} due · {money(b.planned)}{b.pay ? ' · paid ✓' : ''}</p>)}
          {selected.list.length === 0 && selected.bills.length === 0 && <p className="bd-dim bd-note">Nothing on this day.</p>}
          <ul className="bd-tx">{selected.list.map(t => <li key={t.id}><span>{t.category || 'Uncategorized'}{t.notes ? ` · ${t.notes}` : ''}</span><strong>{t.type === 'income' ? '+' : ''}{money(Number(t.amount))}</strong></li>)}</ul>
        </div>
      )}
    </div>
  )
}
