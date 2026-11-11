import { useEffect, useState } from 'react'
import { formatMoney } from './lib/currency'
import { loadCurrentSummary } from './lib/budgetSummary'

export default function SafeToSpend({ currency, onOpen }) {
  const [s, setS] = useState(null)
  useEffect(() => {
    let live = true
    loadCurrentSummary().then(r => { if (live) setS(r) }).catch(() => {})
    return () => { live = false }
  }, [])
  if (!s || !s.inPeriod || s.lines === 0) return null
  const money = (n) => formatMoney(n, currency, Number.isInteger(n) ? 0 : 2)
  const neg = s.perDay < 0
  return (
    <button type="button" className="bd-safe" onClick={onOpen}>
      <span className="bd-safe-label">Safe to spend today</span>
      <span className="bd-safe-num" style={{ color: neg ? 'var(--danger)' : 'var(--good)' }}>{neg ? 'Nothing spare' : money(Math.floor(s.perDay))}</span>
      <span className="bd-dim">{money(Math.max(0, s.left))} left this period{s.unpaidBills > 0 ? ` · ${money(s.unpaidBills)} still for bills` : ''} · {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'} to go</span>
    </button>
  )
}
