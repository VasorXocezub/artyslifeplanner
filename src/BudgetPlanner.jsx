import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { useFinanceCategories } from './lib/financeCategories'

const ICONS = ['🛒', '🏠', '🚗', '⛽', '💡', '📱', '🍽️', '☕', '🎬', '👗', '💅', '💊', '🐾', '✈️', '🎁', '🎓', '💻', '🏋️', '🧾', '🐷', '💖', '✨']
const COLORS = ['#1E5C57', '#8FC2BE', '#B896C9', '#D9A8B8', '#E4CBA0', '#E0A458', '#7BA37A', '#6E8FB5']
const GROUP_SUGGESTIONS = ['Needs', 'Wants', 'Savings & goals', 'Fun money']
const SORTS = [
  { key: 'custom', label: 'My order' },
  { key: 'name', label: 'A–Z' },
  { key: 'spent', label: 'Most spent' },
  { key: 'pct', label: '% used' },
  { key: 'remaining', label: 'Least left' },
]
const DEFAULT_SETTINGS = { month_start_day: 1, warn_pct: 80 }
const WARN_COLOR = '#E0A458'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const shiftMonth = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const periodFor = (monthDate, startDay) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), startDay)
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, startDay - 1)
  return { start, end }
}
const dayMs = 86400000
const fmtShort = (d) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
const toMonthly = (amount, freq) => (freq === 'weekly' ? amount * 4.33 : freq === 'yearly' ? amount / 12 : amount)
const emptyLine = { id: null, kind: 'expense', category: '', customCategory: false, icon: '🧾', color: COLORS[0], grp: '', planned_amount: '', rollover: false, notes: '', forward: 0 }

export default function BudgetPlanner({ currency }) {
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsRow, setSettingsRow] = useState(null)
  const [items, setItems] = useState([])
  const [prevItems, setPrevItems] = useState([])
  const [tx, setTx] = useState([])
  const [prevTx, setPrevTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortKey, setSortKey] = useState('custom')
  const [expanded, setExpanded] = useState(null)
  const [modal, setModal] = useState(null) // line form or null
  const [saving, setSaving] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [catInput, setCatInput] = useState('')
  const { categories: knownCats, savedRows, addCategory, removeCategory } = useFinanceCategories()

  const mk = monthKey(viewMonth)
  const startDay = Math.min(28, Math.max(1, Number(settings.month_start_day) || 1))
  const warnPct = Math.min(100, Math.max(1, Number(settings.warn_pct) || 80))
  const { start, end } = periodFor(viewMonth, startDay)
  const totalDays = Math.round((end - start) / dayMs) + 1
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const elapsedDays = today < start ? 0 : today > end ? totalDays : Math.round((today - start) / dayMs) + 1
  const daysLeft = Math.max(0, totalDays - elapsedDays)
  const inPeriod = today >= start && today <= end

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const sRes = await supabase.from('budget_settings').select('*').limit(1).maybeSingle()
    const st = sRes.error || !sRes.data ? DEFAULT_SETTINGS : sRes.data
    setSettingsRow(sRes.error ? null : sRes.data)
    setSettings({ ...DEFAULT_SETTINGS, ...st })
    const sd = Math.min(28, Math.max(1, Number(st.month_start_day) || 1))
    const cur = periodFor(viewMonth, sd)
    const prev = periodFor(shiftMonth(viewMonth, -1), sd)
    const [b, pb, t, pt] = await Promise.all([
      supabase.from('budget_items').select('*').eq('month', monthKey(viewMonth)).order('created_at', { ascending: true }),
      supabase.from('budget_items').select('*').eq('month', monthKey(shiftMonth(viewMonth, -1))),
      supabase.from('transactions').select('id, date, type, amount, category, notes').gte('date', ymd(cur.start)).lte('date', ymd(cur.end)).order('date', { ascending: false }),
      supabase.from('transactions').select('type, amount, category').gte('date', ymd(prev.start)).lte('date', ymd(prev.end)),
    ])
    if (b.error) setError(b.error.message + ' — have you run the budget SQL in Supabase?')
    setItems(b.data || [])
    setPrevItems(pb.data || [])
    setTx(t.data || [])
    setPrevTx(pt.data || [])
    setLoading(false)
  }, [viewMonth])

  useEffect(() => { load() }, [load])

  const sumTx = (list, kind, cat) =>
    list.filter(t => t.type === kind && (t.category || 'Uncategorized').toLowerCase() === cat.toLowerCase())
      .reduce((s, t) => s + Number(t.amount), 0)

  const rows = useMemo(() => items.map((i, idx) => {
    const planned = Number(i.planned_amount) || 0
    const prevLine = i.rollover ? prevItems.find(p => p.kind === i.kind && p.category.toLowerCase() === i.category.toLowerCase()) : null
    const carry = prevLine ? Math.max(0, (Number(prevLine.planned_amount) || 0) - sumTx(prevTx, prevLine.kind, prevLine.category)) : 0
    const budget = planned + carry
    const actual = sumTx(tx, i.kind, i.category)
    const pct = budget > 0 ? (actual / budget) * 100 : (actual > 0 ? 999 : 0)
    return { ...i, planned, carry, budget, actual, pct, remaining: budget - actual, grpName: (i.grp || '').trim() || 'Other', order: i.sort_order ?? idx }
  }), [items, prevItems, tx, prevTx]) // eslint-disable-line react-hooks/exhaustive-deps

  const expenseRows = rows.filter(r => r.kind === 'expense')
  const incomeRows = rows.filter(r => r.kind === 'income')
  const budgetedSet = new Set(expenseRows.map(r => r.category.toLowerCase()))
  const unbudgeted = useMemo(() => {
    const map = {}
    tx.filter(t => t.type === 'expense').forEach(t => {
      const c = t.category || 'Uncategorized'
      if (!budgetedSet.has(c.toLowerCase())) map[c] = (map[c] || 0) + Number(t.amount)
    })
    return Object.entries(map).map(([category, actual]) => ({ category, actual })).sort((a, b) => b.actual - a.actual)
  }, [tx, items]) // eslint-disable-line react-hooks/exhaustive-deps

  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0)
  const totalBudget = sum(expenseRows, 'budget')
  const totalActual = sum(expenseRows, 'actual') + sum(unbudgeted, 'actual')
  const remaining = totalBudget - totalActual
  const plannedIncome = sum(incomeRows, 'budget')
  const receivedIncome = sum(incomeRows, 'actual')
  const unallocated = plannedIncome - totalBudget
  const usedPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
  const paceFrac = totalDays ? elapsedDays / totalDays : 0
  const projected = elapsedDays > 0 && inPeriod ? (totalActual / elapsedDays) * totalDays : totalActual
  const dailyLeft = daysLeft > 0 ? remaining / daysLeft : null

  const statusColor = (pct, over) => (over || pct > 100 ? 'var(--danger)' : pct >= warnPct ? WARN_COLOR : 'var(--olive-dark)')

  const groupNames = [...new Set(rows.map(r => r.grpName))]
  const existingGroups = [...new Set([...groupNames.filter(g => g !== 'Other'), ...GROUP_SUGGESTIONS])]

  function sortRows(list) {
    const copy = [...list]
    const by = {
      custom: (a, b) => a.order - b.order,
      name: (a, b) => a.category.localeCompare(b.category),
      spent: (a, b) => b.actual - a.actual,
      pct: (a, b) => b.pct - a.pct,
      remaining: (a, b) => a.remaining - b.remaining,
    }[sortKey]
    return copy.sort(by)
  }

  const visible = rows.filter(r => (kindFilter === 'all' || r.kind === kindFilter) && (groupFilter === 'all' || r.grpName === groupFilter))
  const grouped = {}
  sortRows(visible.filter(r => r.kind === 'expense')).forEach(r => { (grouped[r.grpName] ||= []).push(r) })
  const incomeVisible = sortRows(visible.filter(r => r.kind === 'income'))

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(null), 3500) }

  // ----- editing -----
  function openNew(preset = {}) { setModal({ ...emptyLine, ...preset }) }
  function openEdit(r) {
    setModal({
      id: r.id, kind: r.kind, category: r.category, customCategory: false, icon: r.icon || '🧾', color: r.color || COLORS[0],
      grp: r.grp || '', planned_amount: String(r.planned), rollover: !!r.rollover, notes: r.notes || '', forward: 0,
    })
  }

  async function saveLine(e) {
    e.preventDefault()
    const cat = modal.category.trim()
    const amt = parseFloat(modal.planned_amount)
    if (!cat) { setError('Choose or type a category.'); return }
    if (Number.isNaN(amt) || amt < 0) { setError('Enter a budget amount (0 or more).'); return }
    setSaving(true)
    setError(null)
    const base = {
      category: cat, kind: modal.kind, planned_amount: amt, icon: modal.icon || null, color: modal.color || null,
      grp: modal.grp.trim() || null, rollover: modal.kind === 'expense' && modal.rollover, notes: modal.notes.trim() || null,
    }
    let err
    if (modal.id) {
      ;({ error: err } = await supabase.from('budget_items').update(base).eq('id', modal.id))
    } else {
      const user_id = await getUserId()
      const months = [0]
      for (let n = 1; n <= Number(modal.forward || 0); n++) months.push(n)
      const existing = new Set(items.map(i => `${i.kind}|${i.category.toLowerCase()}`))
      const payload = months
        .map(n => ({ ...base, user_id, month: monthKey(shiftMonth(viewMonth, n)), sort_order: items.length + 1 }))
        .filter((p, idx) => idx > 0 || !existing.has(`${p.kind}|${p.category.toLowerCase()}`))
      if (!payload.length) { setSaving(false); setError(`${cat} is already in this month's budget — tap it to edit.`); return }
      ;({ error: err } = await supabase.from('budget_items').insert(payload))
    }
    if (!err) await addCategory(cat)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModal(null)
    load()
  }

  async function deleteLine() {
    if (!modal?.id || !window.confirm(`Remove ${modal.category} from this month's budget?`)) return
    const { error: err } = await supabase.from('budget_items').delete().eq('id', modal.id)
    if (err) { setError(err.message); return }
    setModal(null)
    load()
  }

  async function move(r, dir) {
    const list = sortRows(rows.filter(x => x.kind === r.kind && x.grpName === r.grpName))
    const i = list.findIndex(x => x.id === r.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i], b = list[j]
    const [ra, rb] = await Promise.all([
      supabase.from('budget_items').update({ sort_order: b.order }).eq('id', a.id),
      supabase.from('budget_items').update({ sort_order: a.order === b.order ? a.order + dir : a.order }).eq('id', b.id),
    ])
    if (ra.error || rb.error) setError((ra.error || rb.error).message)
    load()
  }

  // ----- quick-fill tools -----
  async function bulkInsert(lines, okMsg) {
    const have = new Set(items.map(i => `${i.kind}|${i.category.toLowerCase()}`))
    const user_id = await getUserId()
    const add = lines.filter(l => !have.has(`${l.kind}|${l.category.toLowerCase()}`) && l.planned_amount > 0)
      .map((l, n) => ({ user_id, month: mk, sort_order: items.length + n + 1, ...l }))
    if (!add.length) { flash('Nothing new to add.'); return }
    const { error: err } = await supabase.from('budget_items').insert(add)
    if (err) { setError(err.message); return }
    flash(`${okMsg} (${add.length} added)`)
    load()
  }

  async function copyFromLast() {
    await bulkInsert(prevItems.map(p => ({
      category: p.category, kind: p.kind, planned_amount: p.planned_amount, icon: p.icon, color: p.color,
      grp: p.grp, rollover: p.rollover, notes: p.notes,
    })), 'Copied from last month')
  }

  async function importRecurring() {
    const { data, error: err } = await supabase.from('recurring_expenses').select('*').eq('active', true)
    if (err) { setError(err.message); return }
    const map = {}
    ;(data || []).forEach(r => { const c = r.category || 'Recurring'; map[c] = (map[c] || 0) + toMonthly(Number(r.amount), r.frequency) })
    await bulkInsert(Object.entries(map).map(([category, amt]) => ({ category, kind: 'expense', planned_amount: Math.round(amt * 100) / 100, grp: 'Needs' })), 'Imported recurring')
  }

  async function fillFromAverage() {
    const s3 = periodFor(shiftMonth(viewMonth, -3), startDay).start
    const e1 = periodFor(shiftMonth(viewMonth, -1), startDay).end
    const { data, error: err } = await supabase.from('transactions').select('type, amount, category').eq('type', 'expense').gte('date', ymd(s3)).lte('date', ymd(e1))
    if (err) { setError(err.message); return }
    const map = {}
    ;(data || []).forEach(t => { const c = t.category || 'Uncategorized'; map[c] = (map[c] || 0) + Number(t.amount) })
    await bulkInsert(Object.entries(map).map(([category, total]) => ({ category, kind: 'expense', planned_amount: Math.ceil(total / 3 / 10) * 10 })), 'Filled from your 3-month average')
  }

  async function saveSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    const payload = { month_start_day: Number(next.month_start_day) || 1, warn_pct: Number(next.warn_pct) || 80 }
    let err
    if (settingsRow) ({ error: err } = await supabase.from('budget_settings').update(payload).eq('id', settingsRow.id))
    else {
      const user_id = await getUserId()
      const res = await supabase.from('budget_settings').insert({ ...payload, user_id }).select().single()
      err = res.error
      if (!err) setSettingsRow(res.data)
    }
    if (err) setError(err.message)
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    const name = catInput.trim()
    if (!name) return
    const { error: err } = await addCategory(name)
    if (err) setError(err.message)
    else setCatInput('')
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const periodLabel = `${fmtShort(start)} – ${fmtShort(end)}`

  // ----- render pieces -----
  function renderRow(r) {
    const isIncome = r.kind === 'income'
    const over = !isIncome && r.actual > r.budget
    const color = isIncome ? 'var(--olive-dark)' : statusColor(r.pct, over)
    const accent = r.color || COLORS[0]
    const barPct = Math.min(100, r.pct === 999 ? 100 : r.pct)
    const open = expanded === r.id
    const catTx = tx.filter(t => t.type === r.kind && (t.category || 'Uncategorized').toLowerCase() === r.category.toLowerCase())
    return (
      <div key={r.id} className={`bd-row ${open ? 'bd-row-open' : ''}`} style={{ borderLeftColor: accent }}>
        <button type="button" className="bd-row-main" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open}>
          <span className="bd-icon" style={{ background: accent + '33' }}>{r.icon || '🧾'}</span>
          <span className="bd-row-body">
            <span className="bd-row-top">
              <span className="bd-name">{r.category}</span>
              <span className="bd-amounts">
                {formatMoney(r.actual, currency)} <span className="bd-dim">/ {formatMoney(r.budget, currency)}</span>
              </span>
            </span>
            <span className="bd-bar" aria-hidden="true">
              <span className="bd-bar-fill" style={{ width: `${barPct}%`, background: color }} />
              {inPeriod && !isIncome && <span className="bd-bar-pace" style={{ left: `${paceFrac * 100}%` }} />}
            </span>
            <span className="bd-row-bottom">
              <span className="bd-dim">
                {r.carry > 0 && `+${formatMoney(r.carry, currency)} rolled over · `}
                {r.grp && r.grpName}
              </span>
              <span className="bd-chip" style={{ color, borderColor: color }}>
                {isIncome
                  ? (r.actual >= r.budget ? `${formatMoney(r.actual - r.budget, currency)} above` : `${formatMoney(r.budget - r.actual, currency)} to go`)
                  : over ? `${formatMoney(r.actual - r.budget, currency)} over` : `${formatMoney(r.remaining, currency)} left`}
              </span>
            </span>
          </span>
        </button>
        {open && (
          <div className="bd-detail">
            {r.notes && <p className="bd-note">📝 {r.notes}</p>}
            {catTx.length === 0 ? <p className="bd-dim">No transactions in this category this period.</p> : (
              <ul className="bd-tx">
                {catTx.slice(0, 8).map(t => (
                  <li key={t.id}><span>{fmtShort(new Date(t.date + 'T00:00:00'))}{t.notes ? ` · ${t.notes}` : ''}</span><strong>{formatMoney(Number(t.amount), currency)}</strong></li>
                ))}
                {catTx.length > 8 && <li className="bd-dim">+ {catTx.length - 8} more</li>}
              </ul>
            )}
            <div className="bd-detail-actions">
              {sortKey === 'custom' && <>
                <button type="button" className="btn-cancel" onClick={() => move(r, -1)} aria-label="Move up">↑</button>
                <button type="button" className="btn-cancel" onClick={() => move(r, 1)} aria-label="Move down">↓</button>
              </>}
              <button type="button" className="btn-primary" onClick={() => openEdit(r)}>Edit</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const groupSubtotal = (list) => ({ b: sum(list, 'budget'), a: sum(list, 'actual') })

  return (
    <div className="bd">
      <div className="bd-nav">
        <button className="btn-cancel" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))} aria-label="Previous month">←</button>
        <div className="bd-nav-label">
          <strong>{monthLabel}</strong>
          <span className="bd-dim">{periodLabel}{inPeriod ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}</span>
        </div>
        <button className="btn-cancel" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))} aria-label="Next month">→</button>
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}
      {notice && <p className="bd-notice" role="status">✓ {notice}</p>}
      {loading && <p className="loading">Crunching the plan… 🧮</p>}

      {!loading && (
        <>
          <div className="calendar-card bd-hero">
            <div className="bd-eq">
              <div><span className="bd-eq-label">Budget</span><span className="bd-eq-num">{formatMoney(totalBudget, currency)}</span></div>
              <span className="bd-eq-op">−</span>
              <div><span className="bd-eq-label">Actual</span><span className="bd-eq-num">{formatMoney(totalActual, currency)}</span></div>
              <span className="bd-eq-op">=</span>
              <div>
                <span className="bd-eq-label">{remaining >= 0 ? 'Remaining' : 'Over by'}</span>
                <span className="bd-eq-num" style={{ color: remaining >= 0 ? 'var(--olive-dark)' : 'var(--danger)' }}>{formatMoney(Math.abs(remaining), currency)}</span>
              </div>
            </div>
            <div className="bd-bar bd-bar-big" aria-hidden="true">
              <span className="bd-bar-fill" style={{ width: `${Math.min(100, usedPct)}%`, background: statusColor(usedPct, remaining < 0) }} />
              {inPeriod && <span className="bd-bar-pace" style={{ left: `${paceFrac * 100}%` }} />}
            </div>
            <p className="bd-dim bd-hero-caption">
              {totalBudget > 0 ? `${Math.round(usedPct)}% of budget used` : 'Add budget lines below to get started'}
              {inPeriod && totalBudget > 0 ? ` · ${Math.round(paceFrac * 100)}% of the month gone` : ''}
            </p>
            <div className="bd-stats">
              {dailyLeft !== null && totalBudget > 0 && (
                <div><span className="bd-eq-label">Daily allowance</span><strong>{dailyLeft >= 0 ? formatMoney(dailyLeft, currency) : '—'}</strong></div>
              )}
              {inPeriod && totalActual > 0 && (
                <div><span className="bd-eq-label">On pace to spend</span><strong style={{ color: projected > totalBudget && totalBudget > 0 ? 'var(--danger)' : undefined }}>{formatMoney(projected, currency)}</strong></div>
              )}
              <div><span className="bd-eq-label">Income {plannedIncome > 0 ? 'planned' : 'received'}</span><strong>{formatMoney(plannedIncome > 0 ? plannedIncome : receivedIncome, currency)}</strong></div>
              {plannedIncome > 0 && (
                <div><span className="bd-eq-label">{unallocated >= 0 ? 'Unallocated' : 'Over-allocated'}</span><strong style={{ color: unallocated < 0 ? 'var(--danger)' : undefined }}>{formatMoney(Math.abs(unallocated), currency)}</strong></div>
              )}
            </div>
          </div>

          <div className="bd-toolbar">
            <div className="filter-row bd-pills">
              {[['all', 'All'], ['expense', 'Spending'], ['income', 'Income']].map(([k, l]) => (
                <button key={k} className={`filter-pill ${kindFilter === k ? 'filter-pill-active' : ''}`} onClick={() => setKindFilter(k)}>{l}</button>
              ))}
            </div>
            <div className="bd-toolbar-right">
              {groupNames.length > 1 && (
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} aria-label="Filter by group">
                  <option value="all">All groups</option>
                  {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
              <select value={sortKey} onChange={e => setSortKey(e.target.value)} aria-label="Sort">
                {SORTS.map(s => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
              </select>
              <button className="btn-primary" onClick={() => openNew()}>＋ Add line</button>
            </div>
          </div>

          {rows.length === 0 && (
            <div className="calendar-card bd-empty">
              <p><strong>Nothing planned for {monthLabel} yet.</strong></p>
              <p className="bd-dim">Add a line, copy last month, or let me fill it from what you usually spend.</p>
              <div className="bd-empty-actions">
                <button className="btn-primary" onClick={() => openNew()}>＋ Add first line</button>
                <button className="btn-cancel" onClick={copyFromLast}>Copy last month</button>
                <button className="btn-cancel" onClick={fillFromAverage}>Fill from 3-month average</button>
              </div>
            </div>
          )}

          {Object.entries(grouped).map(([g, list]) => {
            const st = groupSubtotal(list)
            return (
              <section key={g} className="bd-group">
                <div className="bd-group-head">
                  <h3>{g}</h3>
                  <span className="bd-dim">{formatMoney(st.a, currency)} of {formatMoney(st.b, currency)}</span>
                </div>
                {list.map(renderRow)}
              </section>
            )
          })}

          {incomeVisible.length > 0 && (
            <section className="bd-group">
              <div className="bd-group-head"><h3>Income</h3><span className="bd-dim">{formatMoney(receivedIncome, currency)} of {formatMoney(plannedIncome, currency)}</span></div>
              {incomeVisible.map(renderRow)}
            </section>
          )}

          {kindFilter !== 'income' && unbudgeted.length > 0 && (
            <section className="bd-group">
              <div className="bd-group-head"><h3>Unbudgeted spending</h3><span className="bd-dim">{formatMoney(sum(unbudgeted, 'actual'), currency)}</span></div>
              {unbudgeted.map(u => (
                <div key={u.category} className="bd-row bd-row-un">
                  <div className="bd-row-main bd-row-static">
                    <span className="bd-icon">❔</span>
                    <span className="bd-row-body">
                      <span className="bd-row-top"><span className="bd-name">{u.category}</span><span className="bd-amounts">{formatMoney(u.actual, currency)}</span></span>
                      <span className="bd-row-bottom"><span className="bd-dim">Spent with no budget set</span>
                        <button type="button" className="bd-link" onClick={() => openNew({ category: u.category, planned_amount: String(Math.ceil(u.actual / 10) * 10) })}>Set a budget</button>
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="calendar-card bd-tools">
            <button type="button" className="bd-tools-toggle" onClick={() => setShowTools(s => !s)} aria-expanded={showTools}>
              <span>⚙️ Tools &amp; settings</span><span>{showTools ? '▲' : '▼'}</span>
            </button>
            {showTools && (
              <div className="bd-tools-body">
                <p className="module-group-label">Quick fill</p>
                <div className="bd-tool-actions">
                  <button className="btn-cancel" onClick={copyFromLast}>Copy from last month</button>
                  <button className="btn-cancel" onClick={importRecurring}>Import recurring expenses</button>
                  <button className="btn-cancel" onClick={fillFromAverage}>Fill from 3-month average</button>
                </div>
                <p className="module-group-label">Preferences</p>
                <div className="bd-pref-grid">
                  <div className="field">
                    <label>Budget month starts on day</label>
                    <input type="number" min="1" max="28" value={settings.month_start_day} onChange={e => setSettings({ ...settings, month_start_day: e.target.value })} onBlur={e => saveSettings({ month_start_day: Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)) })} />
                    <small className="bd-dim">Set to your payday (e.g. 25) so a month runs payday to payday.</small>
                  </div>
                  <div className="field">
                    <label>Warn me at (% of budget used)</label>
                    <input type="number" min="1" max="100" value={settings.warn_pct} onChange={e => setSettings({ ...settings, warn_pct: e.target.value })} onBlur={e => saveSettings({ warn_pct: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 80)) })} />
                    <small className="bd-dim">Bars turn amber at this point and red when over.</small>
                  </div>
                </div>
                <p className="module-group-label">Categories</p>
                <p className="bd-dim">Shared with Personal and Recurring.</p>
                <form className="budget-cat-form" onSubmit={handleAddCategory}>
                  <input placeholder="New category (e.g. Pets)" value={catInput} onChange={e => setCatInput(e.target.value)} aria-label="New category name" />
                  <button className="btn-primary" type="submit">Create</button>
                </form>
                <div className="budget-cat-chips">
                  {knownCats.map(c => {
                    const saved = savedRows.some(r => r.name.toLowerCase() === c.toLowerCase())
                    return (
                      <span key={c} className="budget-cat-chip">{c}
                        {saved && <button type="button" aria-label={`Delete category ${c}`} onClick={() => removeCategory(c)}>✕</button>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Budget line">
            <h2>{modal.id ? 'Edit budget line' : 'New budget line'}</h2>
            <form onSubmit={saveLine}>
              <div className="toggle-group" style={{ marginBottom: 12 }}>
                {[['expense', 'Spending'], ['income', 'Income']].map(([k, l]) => (
                  <button key={k} type="button" className={`toggle-btn ${modal.kind === k ? 'toggle-btn-active' : ''}`} onClick={() => setModal({ ...modal, kind: k })}>{l}</button>
                ))}
              </div>
              <div className="field">
                <label>Category</label>
                <select
                  value={modal.customCategory ? '__new' : (knownCats.some(c => c.toLowerCase() === modal.category.toLowerCase()) ? knownCats.find(c => c.toLowerCase() === modal.category.toLowerCase()) : (modal.category ? '__new' : ''))}
                  onChange={e => e.target.value === '__new' ? setModal({ ...modal, category: '', customCategory: true }) : setModal({ ...modal, category: e.target.value, customCategory: false })}
                >
                  <option value="">Choose category…</option>
                  {knownCats.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new">＋ New category…</option>
                </select>
                {(modal.customCategory || (modal.category && !knownCats.some(c => c.toLowerCase() === modal.category.toLowerCase()))) && (
                  <input style={{ marginTop: 8 }} placeholder="New category name" value={modal.category} onChange={e => setModal({ ...modal, category: e.target.value, customCategory: true })} autoFocus />
                )}
              </div>
              <div className="field">
                <label>{modal.kind === 'income' ? 'Expected per month' : 'Budget per month'} ({currency})</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" value={modal.planned_amount} onChange={e => setModal({ ...modal, planned_amount: e.target.value })} />
              </div>
              <div className="field">
                <label>Icon</label>
                <div className="bd-picker">
                  {ICONS.map(i => (
                    <button key={i} type="button" className={`bd-pick ${modal.icon === i ? 'bd-pick-on' : ''}`} onClick={() => setModal({ ...modal, icon: i })} aria-label={`Icon ${i}`}>{i}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Colour</label>
                <div className="bd-picker">
                  {COLORS.map(c => (
                    <button key={c} type="button" className={`bd-swatch ${modal.color === c ? 'bd-swatch-on' : ''}`} style={{ background: c }} onClick={() => setModal({ ...modal, color: c })} aria-label={`Colour ${c}`} />
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Group (optional)</label>
                <input list="bd-groups" placeholder="Needs, Wants, Fun money…" value={modal.grp} onChange={e => setModal({ ...modal, grp: e.target.value })} />
                <datalist id="bd-groups">{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
              </div>
              {modal.kind === 'expense' && (
                <label className="bd-check">
                  <input type="checkbox" checked={modal.rollover} onChange={e => setModal({ ...modal, rollover: e.target.checked })} />
                  <span>Roll over unspent money from last month</span>
                </label>
              )}
              <div className="field">
                <label>Notes (optional)</label>
                <input value={modal.notes} onChange={e => setModal({ ...modal, notes: e.target.value })} placeholder="e.g. Includes Woolies + Checkers" />
              </div>
              {!modal.id && (
                <div className="field">
                  <label>Repeat</label>
                  <select value={modal.forward} onChange={e => setModal({ ...modal, forward: Number(e.target.value) })}>
                    <option value={0}>This month only</option>
                    <option value={2}>This + next 2 months</option>
                    <option value={5}>This + next 5 months</option>
                    <option value={11}>This + next 11 months</option>
                  </select>
                </div>
              )}
              <div className="modal-actions">
                {modal.id ? <button type="button" className="btn-delete" onClick={deleteLine}>Delete</button> : <span />}
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
