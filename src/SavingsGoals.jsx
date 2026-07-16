import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatZAR } from './lib/currency'

const emptyForm = { name: '', icon: '💰', target_amount: '', current_amount: '0' }
const CARD_COLORS = ['#F2B6C6', '#EF7B4D', '#3D6FB4', '#1B3A5C', '#A8CFEA', '#F2C955']
const ICON_OPTIONS = ['💰', '✈️', '🏠', '🚗', '🎓', '💍', '🛍️', '🏝️', '💻', '🐶', '🎉', '🩺']

export default function SavingsGoals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [addFundsInputs, setAddFundsInputs] = useState({})

  useEffect(() => {
    fetchGoals()
  }, [])

  async function fetchGoals() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setGoals(data)
    setLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(goal) {
    setEditingId(goal.id)
    setForm({
      name: goal.name || '',
      icon: goal.icon || '💰',
      target_amount: String(goal.target_amount ?? ''),
      current_amount: String(goal.current_amount ?? '0'),
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
    const target = parseFloat(form.target_amount)
    const current = parseFloat(form.current_amount) || 0
    if (!form.name.trim() || isNaN(target)) return
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      icon: form.icon || '💰',
      target_amount: target,
      current_amount: current,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('savings_goals').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('savings_goals').insert({ ...payload, user_id }))
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchGoals()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Delete this savings goal?')) return
    setSaving(true)
    const { error } = await supabase.from('savings_goals').delete().eq('id', editingId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchGoals()
  }

  async function addFunds(goal) {
    const raw = addFundsInputs[goal.id]
    const amount = parseFloat(raw)
    if (!raw || isNaN(amount)) return
    const { error } = await supabase
      .from('savings_goals')
      .update({ current_amount: Number(goal.current_amount) + amount })
      .eq('id', goal.id)
    if (error) {
      setError(error.message)
      return
    }
    setAddFundsInputs((v) => ({ ...v, [goal.id]: '' }))
    fetchGoals()
  }

  const totalSaved = goals.reduce((acc, g) => acc + Number(g.current_amount), 0)
  const totalTarget = goals.reduce((acc, g) => acc + Number(g.target_amount), 0)

  return (
    <div>
      <div className="view-header">
        <div>
          <p className="view-subtitle">
            {goals.length === 0 ? 'Every big goal starts with R0 ✨' : `${formatZAR(totalSaved)} saved across ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`}
          </p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={openAdd}>+ Add savings goal</button>
        </div>
      </div>

      {goals.length > 0 && (
        <div className="totals-row">
          <div className="total-card">
            <span className="total-label">Total saved</span>
            <span className="total-value total-positive">{formatZAR(totalSaved)}</span>
          </div>
          <div className="total-card">
            <span className="total-label">Total target</span>
            <span className="total-value">{formatZAR(totalTarget)}</span>
          </div>
        </div>
      )}

      {loading && <p className="loading">Counting your coins… 💸</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && goals.length === 0 && (
        <div className="empty-state">
          <h3>No savings goals yet ✨</h3>
          <p>Add something you're saving toward — a trip, a home, anything.</p>
        </div>
      )}

      {!loading && !error && goals.length > 0 && (
        <div className="card-grid">
          {goals.map((g, i) => {
            const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0
            const reached = g.current_amount >= g.target_amount
            return (
              <div
                className="contact-card habit-card"
                key={g.id}
                style={{ borderTopColor: CARD_COLORS[i % CARD_COLORS.length] }}
              >
                <div className="habit-header-row">
                  <h3 className="contact-name">{g.icon} {g.name}</h3>
                  {reached && <span className="type-badge type-badge-build">🎉 Done</span>}
                </div>

                <div className="progress-row">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: CARD_COLORS[i % CARD_COLORS.length] }}
                    />
                  </div>
                  <span className="progress-label">
                    {formatZAR(g.current_amount)} / {formatZAR(g.target_amount)} ({pct}%)
                  </span>
                </div>

                <div className="habit-actions">
                  <div className="log-value-row">
                    <input
                      type="number"
                      className="log-value-input"
                      placeholder="+ amount"
                      value={addFundsInputs[g.id] || ''}
                      onChange={(e) => setAddFundsInputs((v) => ({ ...v, [g.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addFunds(g)}
                    />
                    <button className="btn-check log-value-btn" onClick={() => addFunds(g)}>Add</button>
                  </div>
                  <button className="btn-delete-small" onClick={() => openEdit(g)}>Edit</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit savings goal' : 'New savings goal'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Name</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Trip to Cape Town, new laptop…"
                  required
                />
              </div>
              <div className="field">
                <label>Icon</label>
                <div className="icon-picker">
                  <span className="icon-preview">{form.icon}</span>
                  <input
                    className="icon-custom-input"
                    value={form.icon}
                    maxLength={4}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  />
                </div>
                <div className="icon-grid">
                  {ICON_OPTIONS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      className={`icon-cell ${form.icon === emoji ? 'icon-cell-active' : ''}`}
                      onClick={() => setForm({ ...form, icon: emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Target (R)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.target_amount}
                    onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                    placeholder="e.g. 10000"
                    required
                  />
                </div>
                <div className="field">
                  <label>Already saved (R)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.current_amount}
                    onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
                  />
                </div>
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
