import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  amount: '',
  category: '',
  type: 'expense',
  notes: '',
}

const CARD_COLORS = ['#B896C9', '#1E5C57', '#1E5C57', '#1E5C57', '#1E5C57', '#8FC2BE']

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PersonalFinances({ currency }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })

    if (error) setError(error.message)
    else setTransactions(data)
    setLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] })
    setModalOpen(true)
  }

  function openEdit(tx) {
    setEditingId(tx.id)
    setForm({
      date: tx.date || '',
      amount: String(tx.amount ?? ''),
      category: tx.category || '',
      type: tx.type || 'expense',
      notes: tx.notes || '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave(e) {
    e.preventDefault()
    const parsedAmount = parseFloat(form.amount)
    if (!form.date || isNaN(parsedAmount)) return
    setSaving(true)

    const payload = {
      date: form.date,
      amount: Math.abs(parsedAmount),
      category: form.category.trim() || null,
      type: form.type,
      notes: form.notes.trim() || null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('transactions').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('transactions').insert({ ...payload, user_id }))
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchTransactions()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Delete this transaction? This can\'t be undone.')) return
    setSaving(true)
    const { error } = await supabase.from('transactions').delete().eq('id', editingId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchTransactions()
  }

  const monthTransactions = transactions.filter((t) => {
    const d = new Date(t.date + 'T00:00:00')
    return d.getMonth() === viewMonth.getMonth() && d.getFullYear() === viewMonth.getFullYear()
  })

  const totals = monthTransactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += Number(t.amount)
      else acc.expenses += Number(t.amount)
      return acc
    },
    { income: 0, expenses: 0 }
  )
  const net = totals.income - totals.expenses

  const categoryTotals = (() => {
    const map = {}
    for (const t of monthTransactions) {
      if (t.type !== 'expense') continue
      const cat = t.category || 'Uncategorized'
      map[cat] = (map[cat] || 0) + Number(t.amount)
    }
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
  })()
  const maxCategoryTotal = categoryTotals[0]?.total || 1

  const knownCategories = Array.from(
    new Set(transactions.map((t) => t.category).filter(Boolean))
  ).sort()

  const filtered = monthTransactions.filter((t) => {
    const q = search.toLowerCase()
    const matchesSearch =
      (t.category || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q)
    const matchesType = typeFilter === 'all' || t.type === typeFilter
    return matchesSearch && matchesType
  })

  const monthLabel = viewMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
  const isCurrentMonth =
    viewMonth.getMonth() === new Date().getMonth() && viewMonth.getFullYear() === new Date().getFullYear()

  function goToMonth(delta) {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1))
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <p className="view-subtitle">
            {transactions.length === 0
              ? 'A squeaky clean ledger, bestie 🧾✨'
              : `${monthTransactions.length} ${monthTransactions.length === 1 ? 'entry' : 'entries'} in ${monthLabel}`}
          </p>
        </div>
        <div className="toolbar">
          <input
            className="search-box"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary" onClick={openAdd}>+ Add transaction</button>
        </div>
      </div>

      <div className="month-nav-row">
        <button className="cal-nav-btn" onClick={() => goToMonth(-1)}>‹</button>
        <span className="cal-month-label">{monthLabel}</span>
        <button className="cal-nav-btn" onClick={() => goToMonth(1)}>›</button>
        {!isCurrentMonth && (
          <button className="btn-ghost month-jump-btn" onClick={() => setViewMonth(new Date())}>
            Jump to this month
          </button>
        )}
      </div>

      <div className="calendar-card converter-card">
        <p className="module-group-label">TOTAL SPENT — {monthLabel.toUpperCase()}</p>
        <p className="converter-total">{formatMoney(totals.expenses, currency)}</p>
      </div>

      <div className="totals-row">
        <div className="total-card">
          <span className="total-label">Income</span>
          <span className="total-value total-positive">{formatMoney(totals.income, currency)}</span>
        </div>
        <div className="total-card">
          <span className="total-label">Expenses</span>
          <span className="total-value total-negative">{formatMoney(totals.expenses, currency)}</span>
        </div>
        <div className="total-card">
          <span className="total-label">Net</span>
          <span className={`total-value ${net >= 0 ? 'total-positive' : 'total-negative'}`}>
            {formatMoney(net, currency)}
          </span>
        </div>
      </div>

      {categoryTotals.length > 0 && (
        <div className="category-breakdown">
          <p className="module-group-label">WHERE IT'S GOING</p>
          <div className="category-list">
            {categoryTotals.map((c, i) => (
              <div className="category-row" key={c.category}>
                <div className="category-row-top">
                  <span className="category-name">{c.category}</span>
                  <span className="category-amount">{formatMoney(c.total, currency)}</span>
                </div>
                <div className="category-track">
                  <div
                    className="category-fill"
                    style={{
                      width: `${Math.max(4, Math.round((c.total / maxCategoryTotal) * 100))}%`,
                      background: CARD_COLORS[i % CARD_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="filter-row">
        {['all', 'income', 'expense'].map((t) => (
          <button
            key={t}
            className={`filter-pill ${typeFilter === t ? 'filter-pill-active' : ''}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expenses'}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Counting your coins… 💸</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <h3>{transactions.length === 0 ? 'Nothing logged yet — fresh start, iconic 🧾' : 'No matches'}</h3>
          <p>{transactions.length === 0 ? 'Log your first income or expense.' : 'Try a different search or filter.'}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="tx-list">
          {filtered.map((t, i) => (
            <div
              className="tx-row"
              key={t.id}
              onClick={() => openEdit(t)}
              style={{ borderLeftColor: CARD_COLORS[i % CARD_COLORS.length] }}
            >
              <div className="tx-main">
                <span className="tx-category">{t.category || 'Uncategorized'}</span>
                {t.notes && <span className="tx-notes">{t.notes}</span>}
              </div>
              <div className="tx-side">
                <span className="tx-date">{formatDate(t.date)}</span>
                <span className={`tx-amount ${t.type === 'income' ? 'total-positive' : 'total-negative'}`}>
                  {t.type === 'income' ? '+' : '−'}{formatMoney(Number(t.amount), currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit transaction' : 'New transaction'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="field">
                <label>Amount ({currency})</label>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Groceries, salary, rent…"
                  list="tx-category-options"
                />
                <datalist id="tx-category-options">
                  {knownCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Anything worth remembering…"
                />
              </div>
              <div className="modal-actions">
                <div>
                  {editingId && (
                    <button type="button" className="btn-delete" onClick={handleDelete} disabled={saving}>
                      Delete
                    </button>
                  )}
                </div>
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
