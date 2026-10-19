import { useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { useFinanceCategories } from './lib/financeCategories'

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shiftMonth(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export default function BudgetPlanner({ currency }) {
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [items, setItems] = useState([])
  const [tx, setTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newCat, setNewCat] = useState('')
  const [newAmt, setNewAmt] = useState('')
  const [newKind, setNewKind] = useState('expense')
  const { categories: knownCats, savedRows, addCategory, removeCategory } = useFinanceCategories()
  const [catInput, setCatInput] = useState('')

  const mk = monthKey(viewMonth)

  useEffect(() => { load() }, [mk]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    setError(null)
    const start = `${mk}-01`
    const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).toISOString().split('T')[0]
    const [b, t] = await Promise.all([
      supabase.from('budget_items').select('*').eq('month', mk).order('created_at', { ascending: true }),
      supabase.from('transactions').select('type, amount, category').gte('date', start).lte('date', end),
    ])
    if (b.error) setError(b.error.message)
    else setItems(b.data || [])
    setTx(t.data || [])
    setLoading(false)
  }

  const actualFor = (kind, cat) =>
    tx.filter(t => t.type === kind && (t.category || '').toLowerCase() === cat.toLowerCase())
      .reduce((s, t) => s + Number(t.amount), 0)

  const rows = useMemo(() => items.map(i => ({ ...i, actual: actualFor(i.kind, i.category) })), [items, tx]) // eslint-disable-line react-hooks/exhaustive-deps
  const incomeRows = rows.filter(r => r.kind === 'income')
  const expenseRows = rows.filter(r => r.kind === 'expense')
  const sum = (arr, k) => arr.reduce((s, r) => s + Number(r[k] || 0), 0)
  const plannedIncome = sum(incomeRows, 'planned_amount')
  const plannedExpense = sum(expenseRows, 'planned_amount')
  const actualExpense = sum(expenseRows, 'actual')
  const leftToAllocate = plannedIncome - plannedExpense

  async function addItem(e) {
    e.preventDefault()
    const cat = newCat.trim()
    const amt = parseFloat(newAmt)
    if (!cat || Number.isNaN(amt) || amt < 0) return
    const user_id = await getUserId()
    const { error } = await supabase.from('budget_items').insert({ user_id, month: mk, category: cat, planned_amount: amt, kind: newKind })
    if (error) { setError(error.message); return }
    await addCategory(cat)
    setNewCat(''); setNewAmt('')
    load()
  }

  async function updateAmount(item, value) {
    const amt = parseFloat(value)
    if (Number.isNaN(amt) || amt < 0 || amt === Number(item.planned_amount)) return
    const { error } = await supabase.from('budget_items').update({ planned_amount: amt }).eq('id', item.id)
    if (error) setError(error.message)
    else setItems(prev => prev.map(i => i.id === item.id ? { ...i, planned_amount: amt } : i))
  }

  async function removeItem(id) {
    const { error } = await supabase.from('budget_items').delete().eq('id', id)
    if (error) setError(error.message)
    else setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    const name = catInput.trim()
    if (!name) return
    const { error } = await addCategory(name)
    if (error) setError(error.message)
    else setCatInput('')
  }

  async function copyFromLast() {
    const { data, error } = await supabase.from('budget_items').select('*').eq('month', monthKey(shiftMonth(viewMonth, -1)))
    if (error) { setError(error.message); return }
    const have = new Set(items.map(i => `${i.kind}|${i.category.toLowerCase()}`))
    const user_id = await getUserId()
    const add = (data || [])
      .filter(i => !have.has(`${i.kind}|${i.category.toLowerCase()}`))
      .map(i => ({ user_id, month: mk, category: i.category, planned_amount: i.planned_amount, kind: i.kind }))
    if (!add.length) { setError('Nothing new to copy from last month.'); return }
    const { error: e2 } = await supabase.from('budget_items').insert(add)
    if (e2) setError(e2.message)
    else load()
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function renderRow(r) {
    const planned = Number(r.planned_amount)
    const pct = planned > 0 ? Math.min(100, (r.actual / planned) * 100) : 0
    const over = r.kind === 'expense' && r.actual > planned
    return (
      <div key={r.id} className="budget-row">
        <div className="budget-row-top">
          <span className="budget-cat">{r.category}</span>
          <button className="budget-remove" aria-label={`Remove ${r.category}`} onClick={() => removeItem(r.id)}>✕</button>
        </div>
        <div className="budget-bar"><div className={`budget-bar-fill ${over ? 'budget-bar-over' : ''}`} style={{ width: `${pct}%` }} /></div>
        <div className="budget-row-bottom">
          <span>{r.kind === 'income' ? 'Received' : 'Spent'} {formatMoney(r.actual, currency)} of</span>
          <input type="number" step="0.01" min="0" defaultValue={planned} key={`${r.id}-${planned}`}
            aria-label={`Planned amount for ${r.category}`}
            onBlur={e => updateAmount(r, e.target.value)} />
          <span className={over ? 'total-negative' : ''}>
            {r.kind === 'expense' ? (over ? `${formatMoney(r.actual - planned, currency)} over` : `${formatMoney(planned - r.actual, currency)} left`) : ''}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="budget-month-nav">
        <button className="btn-cancel" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))} aria-label="Previous month">←</button>
        <strong>{monthLabel}</strong>
        <button className="btn-cancel" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))} aria-label="Next month">→</button>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {loading && <p className="loading">Crunching the plan… 🧮</p>}

      {!loading && (
        <>
          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">Plan summary</p>
            <div className="goals-summary-row"><span className="goals-summary-label">💰 Planned income</span><span className="goals-summary-value">{formatMoney(plannedIncome, currency)}</span></div>
            <div className="goals-summary-row"><span className="goals-summary-label">🧾 Planned spending</span><span className="goals-summary-value">{formatMoney(plannedExpense, currency)}</span></div>
            <div className="goals-summary-row"><span className="goals-summary-label">💸 Spent so far</span><span className="goals-summary-value">{formatMoney(actualExpense, currency)}</span></div>
            <div className="goals-summary-row">
              <span className="goals-summary-label">{leftToAllocate >= 0 ? '✅ Left to allocate' : '⚠️ Over-planned by'}</span>
              <span className="goals-summary-value">{formatMoney(Math.abs(leftToAllocate), currency)}</span>
            </div>
          </div>

          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">Income</p>
            {incomeRows.length === 0 && <p className="settings-danger-text">No planned income yet.</p>}
            {incomeRows.map(renderRow)}
          </div>

          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">Spending</p>
            {expenseRows.length === 0 && <p className="settings-danger-text">Nothing planned yet — add your first category below.</p>}
            {expenseRows.map(renderRow)}
          </div>

          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">Categories</p>
            <p className="settings-danger-text">Shared across Personal, Recurring and Budget. New categories show up everywhere.</p>
            <form className="budget-cat-form" onSubmit={handleAddCategory}>
              <input placeholder="New category (e.g. Pets)" value={catInput} onChange={e => setCatInput(e.target.value)} aria-label="New category name" />
              <button className="btn-primary" type="submit">Create</button>
            </form>
            <div className="budget-cat-chips">
              {knownCats.map(c => {
                const saved = savedRows.some(r => r.name.toLowerCase() === c.toLowerCase())
                return (
                  <span key={c} className="budget-cat-chip">
                    {c}
                    {saved && <button type="button" aria-label={`Delete category ${c}`} onClick={() => removeCategory(c)}>✕</button>}
                  </span>
                )
              })}
              {knownCats.length === 0 && <span className="settings-danger-text">No categories yet.</span>}
            </div>
          </div>

          <form className="calendar-card goals-summary-card budget-add" onSubmit={addItem}>
            <p className="module-group-label">Add to {monthLabel}</p>
            <div className="budget-add-fields">
              <select value={newKind} onChange={e => setNewKind(e.target.value)} aria-label="Type">
                <option value="expense">Spending</option>
                <option value="income">Income</option>
              </select>
              <input list="budget-cats" placeholder="Category (e.g. Groceries)" value={newCat} onChange={e => setNewCat(e.target.value)} />
              <datalist id="budget-cats">{knownCats.map(c => <option key={c} value={c} />)}</datalist>
              <input type="number" step="0.01" min="0" placeholder="0" value={newAmt} onChange={e => setNewAmt(e.target.value)} aria-label="Planned amount" />
              <button className="btn-primary" type="submit">Add</button>
            </div>
            <button type="button" className="btn-cancel" onClick={copyFromLast}>Copy from last month</button>
          </form>
        </>
      )}
    </div>
  )
}
