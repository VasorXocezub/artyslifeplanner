import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'

const emptyForm = { name: '', amount: '', category: '', frequency: 'monthly', next_due: '' }
const CARD_COLORS = ['#F2B6C6', '#EF7B4D', '#3D6FB4', '#1B3A5C', '#A8CFEA', '#F2C955']
const FREQUENCY_LABELS = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

function toMonthly(amount, frequency) {
  if (frequency === 'weekly') return amount * 4.33
  if (frequency === 'yearly') return amount / 12
  return amount
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecurringExpenses({ currency }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({
      name: item.name || '',
      amount: String(item.amount ?? ''),
      category: item.category || '',
      frequency: item.frequency || 'monthly',
      next_due: item.next_due || '',
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
    const amount = parseFloat(form.amount)
    if (!form.name.trim() || isNaN(amount)) return
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      amount,
      category: form.category.trim() || null,
      frequency: form.frequency,
      next_due: form.next_due || null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('recurring_expenses').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('recurring_expenses').insert({ ...payload, user_id }))
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchItems()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Delete this recurring expense?')) return
    setSaving(true)
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', editingId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchItems()
  }

  async function toggleActive(item) {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ active: !item.active })
      .eq('id', item.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchItems()
  }

  const activeItems = items.filter((i) => i.active)
  const monthlyTotal = activeItems.reduce((acc, i) => acc + toMonthly(Number(i.amount), i.frequency), 0)
  const yearlyTotal = monthlyTotal * 12

  return (
    <div>
      <div className="view-header">
        <div>
          <p className="view-subtitle">
            {items.length === 0 ? 'Nothing on repeat yet 🔁' : `${activeItems.length} active of ${items.length} logged`}
          </p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={openAdd}>+ Add recurring expense</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="totals-row">
          <div className="total-card">
            <span className="total-label">Per month</span>
            <span className="total-value total-negative">{formatMoney(monthlyTotal, currency)}</span>
          </div>
          <div className="total-card">
            <span className="total-label">Per year</span>
            <span className="total-value total-negative">{formatMoney(yearlyTotal, currency)}</span>
          </div>
        </div>
      )}

      {loading && <p className="loading">Counting your coins… 💸</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <h3>No recurring expenses yet 🔁</h3>
          <p>Add subscriptions, rent, or bills that repeat on a schedule.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card-grid">
          {items.map((item, i) => (
            <div
              className={`contact-card habit-card ${!item.active ? 'recurring-paused' : ''}`}
              key={item.id}
              style={{ borderTopColor: CARD_COLORS[i % CARD_COLORS.length] }}
            >
              <div className="habit-header-row">
                <h3 className="contact-name">{item.name}</h3>
                <span className="type-badge type-badge-build">{FREQUENCY_LABELS[item.frequency]}</span>
              </div>

              {item.category && <p className="habit-schedule">{item.category}</p>}

              <p className="converter-total recurring-amount">{formatMoney(item.amount, currency)}</p>

              {item.next_due && (
                <p className="habit-dates">Next due {formatDate(item.next_due)}</p>
              )}

              {item.frequency !== 'monthly' && (
                <p className="progress-label recurring-monthly-note">
                  ≈ {formatMoney(toMonthly(Number(item.amount), item.frequency), currency)} / month
                </p>
              )}

              <div className="habit-actions">
                <button
                  className={`btn-check ${item.active ? 'btn-check-done' : ''}`}
                  onClick={() => toggleActive(item)}
                >
                  {item.active ? '✓ Active' : 'Paused — tap to resume'}
                </button>
                <button className="btn-delete-small" onClick={() => openEdit(item)}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit recurring expense' : 'New recurring expense'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Name</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Netflix, rent, gym membership…"
                  required
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Amount ({currency})</label>
                  <input
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
                  <label>Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Subscriptions, housing, insurance…"
                />
              </div>
              <div className="field">
                <label>Next due date (optional)</label>
                <input
                  type="date"
                  value={form.next_due}
                  onChange={(e) => setForm({ ...form, next_due: e.target.value })}
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
