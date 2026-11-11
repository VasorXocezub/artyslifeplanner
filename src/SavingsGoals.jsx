import { useEffect, useState } from 'react'
import { keyForDate, loadBudgetMeta, ymd, addDays } from './lib/budgetPeriods'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { toIso } from './lib/social'

const emptyForm = { name: '', icon: '💰', target_amount: '', current_amount: '0' }
const CARD_COLORS = ['var(--lavender)', 'var(--accent-deep)', 'var(--butter)', 'var(--accent-mid)', '#EC9A8C', 'var(--lavender)']
const ICON_OPTIONS = ['💰', '✈️', '🏠', '🚗', '🎓', '💍', '🛍️', '🏝️', '💻', '🐶', '🎉', '🩺', '👶', '🎁', '📱', '👗', '💅', '🏖️', '🐷', '💖', '✨', '🛡️', '🏡', '🎀']

// first emoji (grapheme) of whatever was typed or pasted
const firstEmoji = (str) => {
  const t = (str || '').trim()
  if (!t) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)[Symbol.iterator]().next()
    return it.value ? it.value.segment : ''
  }
  return Array.from(t).slice(0, 2).join('')
}

export default function SavingsGoals({ currency }) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [addFundsInputs, setAddFundsInputs] = useState({})
  const [budgeted, setBudgeted] = useState({}) // goal id -> { amount, days }

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
    loadBudgeted()
  }

  // how much the budget sets aside for each goal per period (needs the budget tables; silently skipped otherwise)
  async function loadBudgeted() {
    try {
      const meta = await loadBudgetMeta()
      const key = keyForDate(ymd(new Date()), meta.settings, meta.customs)
      if (!key) return
      const { data: lines, error: e1 } = await supabase.from('budget_items').select('planned_amount, items, savings_goal_id').eq('month', key).not('savings_goal_id', 'is', null)
      if (e1 || !lines) return
      const t = meta.settings.period_type
      const days = t === 'weekly' ? 7 : t === 'fortnightly' ? 14 : 30
      const map = {}
      lines.forEach(l => {
        const parts = Array.isArray(l.items) ? l.items.filter(p => p && p.name) : []
        const amt = parts.length ? parts.reduce((a, p) => a + (Number(p.amount) || 0), 0) : Number(l.planned_amount) || 0
        map[l.savings_goal_id] = { amount: (map[l.savings_goal_id]?.amount || 0) + amt, days, unit: t === 'weekly' ? 'week' : t === 'fortnightly' ? 'fortnight' : 'month' }
      })
      setBudgeted(map)
    } catch { /* budget not set up */ }
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

  async function withdrawFunds(goal) {
    const raw = addFundsInputs[goal.id]
    const amount = parseFloat(raw)
    if (!raw || isNaN(amount)) return
    const newAmount = Math.max(0, Number(goal.current_amount) - amount)

    const { error: goalError } = await supabase
      .from('savings_goals')
      .update({ current_amount: newAmount })
      .eq('id', goal.id)
    if (goalError) {
      setError(goalError.message)
      return
    }

    const user_id = await getUserId()
    const { error: txError } = await supabase.from('transactions').insert({
      date: toIso(new Date()),
      amount: Math.abs(amount),
      type: 'income',
      category: 'Savings Withdrawal',
      notes: `Withdrawn from ${goal.name}`,
      savings_goal_id: goal.id,
      user_id,
    })
    if (txError) {
      setError(txError.message)
      return
    }

    setAddFundsInputs((v) => ({ ...v, [goal.id]: '' }))
    fetchGoals()
  }

  const totalSaved = goals.reduce((acc, g) => acc + Number(g.current_amount), 0)
  const totalTarget = goals.reduce((acc, g) => acc + Number(g.target_amount), 0)
  const totalRemaining = goals.reduce((acc, g) => acc + Math.max(0, Number(g.target_amount) - Number(g.current_amount)), 0)

  return (
    <div>
      <div className="view-header">
        <div>
          <p className="view-subtitle">
            {goals.length === 0 ? 'Every big goal starts with 0, and that\'s iconic ✨' : `${formatMoney(totalSaved, currency)} saved up across ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`}
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
            <span className="total-value total-positive">{formatMoney(totalSaved, currency)}</span>
          </div>
          <div className="total-card">
            <span className="total-label">Total target</span>
            <span className="total-value">{formatMoney(totalTarget, currency)}</span>
          </div>
          <div className="total-card">
            <span className="total-label">Still to save</span>
            <span className="total-value">{formatMoney(totalRemaining, currency)}</span>
          </div>
        </div>
      )}

      {loading && <p className="loading">Counting your coins… 💸</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && goals.length === 0 && (
        <div className="empty-state">
          <h3>No savings goals yet, let's manifest ✨</h3>
          <p>Add something you're saving toward — a trip, a home, anything at all. Manifest it ✨</p>
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
                  <h3 className="contact-name" title={g.name}>{g.icon} {g.name}</h3>
                  {reached && <span className="type-badge type-badge-build">🎉 Manifested!</span>}
                </div>

                <div className="progress-row">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: CARD_COLORS[i % CARD_COLORS.length] }}
                    />
                  </div>
                  <span className="progress-label">
                    {formatMoney(g.current_amount, currency)} / {formatMoney(g.target_amount, currency)} ({pct}%)
                    {' · '}
                    {reached ? 'Goal reached 🎉' : `${formatMoney(Number(g.target_amount) - Number(g.current_amount), currency)} to go`}
                  </span>
                </div>

                {(() => {
                  const b = budgeted[g.id]
                  if (!b || b.amount <= 0 || reached) return null
                  const left = Number(g.target_amount) - Number(g.current_amount)
                  const periods = Math.ceil(left / b.amount)
                  const eta = addDays(new Date(), periods * b.days)
                  return <p className="progress-label" style={{ marginTop: 4 }}>💖 {formatMoney(b.amount, currency)} per {b.unit} budgeted · on track by {eta.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}</p>
                })()}

                <div className="habit-actions">
                  <div className="log-value-row">
                    <input
                      type="number"
                      className="log-value-input"
                      placeholder="amount"
                      value={addFundsInputs[g.id] || ''}
                      onChange={(e) => setAddFundsInputs((v) => ({ ...v, [g.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addFunds(g)}
                    />
                    <button className="btn-check log-value-btn" onClick={() => addFunds(g)}>+ Add</button>
                    <button className="btn-delete-small savings-withdraw-btn" onClick={() => withdrawFunds(g)}>Withdraw</button>
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
                    className="icon-custom-input icon-custom-wide"
                    value=""
                    placeholder="Type or paste any emoji 😀"
                    aria-label="Custom emoji"
                    autoComplete="off"
                    onChange={(e) => { const em = firstEmoji(e.target.value); if (em) setForm({ ...form, icon: em }) }}
                  />
                </div>
                <div className="icon-grid">
                  {form.icon && !ICON_OPTIONS.includes(form.icon) && (
                    <button type="button" className="icon-cell icon-cell-active" aria-label={`Icon ${form.icon}`}>{form.icon}</button>
                  )}
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
                  <label>Target ({currency})</label>
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
                  <label>Already saved ({currency})</label>
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
