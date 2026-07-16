import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const emptyForm = {
  title: '',
  category: '',
  target_date: '',
  status: 'not_started',
  notes: '',
}

const STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}

const STATUS_COLORS = {
  not_started: '#A8CFEA',
  in_progress: '#EF7B4D',
  done: '#F2B6C6',
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function GoalsView() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGoals()
  }, [])

  async function fetchGoals() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false })

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
      title: goal.title || '',
      category: goal.category || '',
      target_date: goal.target_date || '',
      status: goal.status || 'not_started',
      notes: goal.notes || '',
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
    if (!form.title.trim()) return
    setSaving(true)

    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      target_date: form.target_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('goals').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('goals').insert({ ...payload, user_id }))
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
    if (!confirm('Delete this goal? This can\'t be undone.')) return
    setSaving(true)
    const { error } = await supabase.from('goals').delete().eq('id', editingId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchGoals()
  }

  const filtered = goals.filter((g) => {
    const q = search.toLowerCase()
    const matchesSearch =
      g.title.toLowerCase().includes(q) ||
      (g.category || '').toLowerCase().includes(q) ||
      (g.notes || '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || g.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Goals</h1>
          <p className="view-subtitle">
            {goals.length === 0 ? 'A blank slate, full of potential ✨' : `${goals.length} ${goals.length === 1 ? 'dream' : 'dreams'} in motion`}
          </p>
        </div>
        <div className="toolbar">
          <input
            className="search-box"
            placeholder="Search goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary" onClick={openAdd}>+ Add goal</button>
        </div>
      </div>

      <div className="filter-row">
        {['all', 'not_started', 'in_progress', 'done'].map((s) => (
          <button
            key={s}
            className={`filter-pill ${statusFilter === s ? 'filter-pill-active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Rounding up your ambitions… 🌱</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <h3>{goals.length === 0 ? 'Nothing here yet — big things start small ✨' : 'No matches'}</h3>
          <p>{goals.length === 0 ? 'Add the first thing you\'re dreaming about.' : 'Try a different search or filter.'}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card-grid">
          {filtered.map((g) => (
            <div
              className="contact-card"
              key={g.id}
              onClick={() => openEdit(g)}
              style={{ borderTopColor: STATUS_COLORS[g.status] || '#F2B6C6' }}
            >
              <span className="status-badge" style={{ background: STATUS_COLORS[g.status] }}>
                {STATUS_LABELS[g.status]}
              </span>
              <h3 className="contact-name">{g.title}</h3>
              {g.category && <p className="contact-relationship">{g.category}</p>}
              <div className="contact-meta">
                {g.target_date && (
                  <div><span className="label">Target</span>{formatDate(g.target_date)}</div>
                )}
              </div>
              {g.notes && <p className="contact-notes">{g.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit goal' : 'New goal'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Title</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="What are you working toward?"
                  required
                />
              </div>
              <div className="field">
                <label>Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Health, career, finances…"
                />
              </div>
              <div className="field">
                <label>Target date</label>
                <input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Why this matters, how you'll get there…"
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
