import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatZAR } from './lib/currency'

const CARD_COLORS = ['#E8639B', '#E8703C', '#B190D4', '#7C8A3E']

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BusinessTracker() {
  const [expenses, setExpenses] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [allowanceInput, setAllowanceInput] = useState('')
  const [editingAllowance, setEditingAllowance] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)

    const { data: settingsData, error: settingsError } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (settingsError) {
      setError(settingsError.message)
      setLoading(false)
      return
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from('business_expenses')
      .select('*')
      .order('date', { ascending: false })

    if (expensesError) {
      setError(expensesError.message)
      setLoading(false)
      return
    }

    setSettings(settingsData)
    setAllowanceInput(settingsData ? String(settingsData.monthly_allowance) : '')
    setExpenses(expensesData)
    setLoading(false)
  }

  async function saveAllowance() {
    const amount = parseFloat(allowanceInput) || 0
    let error
    if (settings) {
      ;({ error } = await supabase.from('business_settings').update({ monthly_allowance: amount, updated_at: new Date().toISOString() }).eq('id', settings.id))
    } else {
      ;({ error } = await supabase.from('business_settings').insert({ monthly_allowance: amount }))
    }
    if (error) {
      setError(error.message)
      return
    }
    setEditingAllowance(false)
    fetchAll()
  }

  function openAdd() {
    setEditingId(null)
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', description: '' })
    setModalOpen(true)
  }

  function openEdit(exp) {
    setEditingId(exp.id)
    setForm({ date: exp.date || '', amount: String(exp.amount ?? ''), description: exp.description || '' })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.date || isNaN(amount)) return
    setSaving(true)

    const payload = { date: form.date, amount, description: form.description.trim() || null }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('business_expenses').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('business_expenses').insert(payload))
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchAll()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('business_expenses').delete().eq('id', editingId)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchAll()
  }

  const now = new Date()
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date + 'T00:00:00')
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const spentThisMonth = thisMonthExpenses.reduce((acc, e) => acc + Number(e.amount), 0)
  const allowance = settings?.monthly_allowance || 0
  const remaining = allowance - spentThisMonth
  const pct = allowance > 0 ? Math.min(100, Math.round((spentThisMonth / allowance) * 100)) : 0

  return (
    <div>
      <div className="view-header">
        <div>
          <p className="view-subtitle">Your work allowance, tracked simply</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={openAdd}>+ Add expense</button>
        </div>
      </div>

      {loading && <p className="loading">Counting your coins… 💸</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
          <div className="calendar-card">
            <div className="allowance-header">
              <span className="module-group-label">MONTHLY ALLOWANCE</span>
              {!editingAllowance && (
                <button className="btn-delete-small" onClick={() => setEditingAllowance(true)}>Edit</button>
              )}
            </div>
            {editingAllowance ? (
              <div className="log-value-row">
                <input
                  type="number"
                  className="log-value-input"
                  value={allowanceInput}
                  onChange={(e) => setAllowanceInput(e.target.value)}
                  placeholder="e.g. 2000"
                />
                <button className="btn-check log-value-btn" onClick={saveAllowance}>Save</button>
              </div>
            ) : (
              <>
                <div className="progress-row">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--danger)' : CARD_COLORS[0] }}
                    />
                  </div>
                  <span className="progress-label">
                    {formatZAR(spentThisMonth)} spent of {formatZAR(allowance)} this month
                  </span>
                </div>
                <p className={`allowance-remaining ${remaining < 0 ? 'total-negative' : 'total-positive'}`}>
                  {remaining >= 0 ? formatZAR(remaining) + ' left' : formatZAR(Math.abs(remaining)) + ' over budget'}
                </p>
              </>
            )}
          </div>

          {expenses.length === 0 ? (
            <div className="empty-state">
              <h3>No business expenses yet 🧾</h3>
              <p>Log the first thing you spent from your work allowance.</p>
            </div>
          ) : (
            <div className="tx-list">
              {expenses.map((e, i) => (
                <div
                  className="tx-row"
                  key={e.id}
                  onClick={() => openEdit(e)}
                  style={{ borderLeftColor: CARD_COLORS[i % CARD_COLORS.length] }}
                >
                  <div className="tx-main">
                    <span className="tx-category">{e.description || 'Business expense'}</span>
                  </div>
                  <div className="tx-side">
                    <span className="tx-date">{formatDate(e.date)}</span>
                    <span className="tx-amount total-negative">−{formatZAR(Number(e.amount))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit expense' : 'New business expense'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Amount (R)</label>
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
                <label>Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Client lunch, parking, supplies…"
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
