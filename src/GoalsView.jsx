import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const emptyForm = {
  title: '',
  category: '',
  target_date: '',
  status: 'not_started',
  notes: '',
  goal_type: 'simple',
  start_value: '',
  current_value: '',
  target_value: '',
  unit: '',
}

const STATUS_LABELS = {
  not_started: 'Not started yet',
  in_progress: 'In motion ✨',
  done: 'Slayed 💅',
}

const STATUS_COLORS = {
  not_started: '#1E5C57',
  in_progress: '#1E5C57',
  done: '#B896C9',
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function computeProgress(goal) {
  const start = Number(goal.start_value)
  const current = Number(goal.current_value)
  const target = Number(goal.target_value)
  if (isNaN(start) || isNaN(current) || isNaN(target) || start === target) {
    return { pct: 0 }
  }
  const pct = ((current - start) / (target - start)) * 100
  return { pct: Math.max(0, Math.min(100, Math.round(pct))) }
}

function effectiveStatus(goal) {
  if (goal.goal_type !== 'progress') return goal.status || 'not_started'
  const { pct } = computeProgress(goal)
  if (pct >= 100) return 'done'
  if (pct <= 0) return 'not_started'
  return 'in_progress'
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
  const [progressInputs, setProgressInputs] = useState({})

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
      goal_type: goal.goal_type || 'simple',
      start_value: goal.start_value != null ? String(goal.start_value) : '',
      current_value: goal.current_value != null ? String(goal.current_value) : '',
      target_value: goal.target_value != null ? String(goal.target_value) : '',
      unit: goal.unit || '',
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

    const isProgress = form.goal_type === 'progress'

    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      target_date: form.target_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
      goal_type: form.goal_type,
      start_value: isProgress ? parseFloat(form.start_value) || 0 : null,
      current_value: isProgress ? parseFloat(form.current_value) || parseFloat(form.start_value) || 0 : null,
      target_value: isProgress ? parseFloat(form.target_value) || 0 : null,
      unit: isProgress ? form.unit.trim() || null : null,
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

  async function updateProgress(goal) {
    const raw = progressInputs[goal.id]
    if (raw === undefined || raw === '') return
    const value = parseFloat(raw)
    if (isNaN(value)) return
    const { error } = await supabase.from('goals').update({ current_value: value }).eq('id', goal.id)
    if (error) {
      setError(error.message)
      return
    }
    setProgressInputs((v) => ({ ...v, [goal.id]: '' }))
    fetchGoals()
  }

  const knownCategories = Array.from(
    new Set(goals.map((g) => g.category).filter(Boolean))
  ).sort()

  const filtered = goals.filter((g) => {
    const q = search.toLowerCase()
    const matchesSearch =
      g.title.toLowerCase().includes(q) ||
      (g.category || '').toLowerCase().includes(q) ||
      (g.notes || '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || effectiveStatus(g) === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Goals</h1>
          <p className="view-subtitle">
            {goals.length === 0 ? 'A blank slate, full of potential ✨' : `${goals.length} ${goals.length === 1 ? 'dream' : 'dreams'} in motion, let's gooo`}
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

      {loading && <p className="loading">Rounding up your ambitions… 🌟</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <h3>{goals.length === 0 ? 'Nothing here yet — big things start small ✨' : 'No matches'}</h3>
          <p>{goals.length === 0 ? 'Add the first thing you\'re manifesting — you got this, bestie.' : 'Try a different search or filter.'}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card-grid">
          {filtered.map((g) => {
            const status = effectiveStatus(g)
            const isProgress = g.goal_type === 'progress'
            const { pct } = isProgress ? computeProgress(g) : { pct: 0 }
            return (
              <div
                className="contact-card"
                key={g.id}
                style={{ borderTopColor: STATUS_COLORS[status] || '#B896C9' }}
              >
                <div onClick={() => openEdit(g)} style={{ cursor: 'pointer' }}>
                  {!isProgress && (
                    <span className="status-badge" style={{ background: STATUS_COLORS[status] }}>
                      {STATUS_LABELS[status]}
                    </span>
                  )}
                  {isProgress && pct >= 100 && (
                    <span className="type-badge type-badge-build">🎉 Reached!</span>
                  )}
                  <h3 className="contact-name" title={g.title}>{g.title}</h3>
                  {g.category && <p className="contact-relationship">{g.category}</p>}
                  {g.target_date && (
                    <div className="contact-meta">
                      <div><span className="label">Target</span>{formatDate(g.target_date)}</div>
                    </div>
                  )}
                  {g.notes && <p className="contact-notes">{g.notes}</p>}
                </div>

                {isProgress && (
                  <>
                    <div className="progress-row">
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${pct}%`, background: STATUS_COLORS[status] }}
                        />
                      </div>
                      <span className="progress-label">
                        {g.current_value} / {g.target_value} {g.unit || ''} ({pct}%)
                      </span>
                    </div>
                    <div className="log-value-row">
                      <input
                        type="number"
                        className="log-value-input"
                        placeholder="Update current value"
                        value={progressInputs[g.id] || ''}
                        onChange={(e) => setProgressInputs((v) => ({ ...v, [g.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && updateProgress(g)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button className="btn-check log-value-btn" onClick={() => updateProgress(g)}>Update</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
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
                  list="goal-category-options"
                />
                <datalist id="goal-category-options">
                  {knownCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="field">
                <label>How do you want to track it?</label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${form.goal_type === 'simple' ? 'toggle-btn-active' : ''}`}
                    onClick={() => setForm({ ...form, goal_type: 'simple' })}
                  >
                    ✓ Simple status
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${form.goal_type === 'progress' ? 'toggle-btn-active' : ''}`}
                    onClick={() => setForm({ ...form, goal_type: 'progress' })}
                  >
                    📊 Progress bar
                  </button>
                </div>
              </div>

              {form.goal_type === 'simple' ? (
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
              ) : (
                <>
                  <p className="field-hint">e.g. weight loss: start 80, target 70, unit kg. Or savings: start 0, target 5000, unit R.</p>
                  <div className="field-row">
                    <div className="field">
                      <label>Start value</label>
                      <input
                        type="number"
                        value={form.start_value}
                        onChange={(e) => setForm({ ...form, start_value: e.target.value })}
                        placeholder="e.g. 80"
                      />
                    </div>
                    <div className="field">
                      <label>Target value</label>
                      <input
                        type="number"
                        value={form.target_value}
                        onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                        placeholder="e.g. 70"
                      />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Current value</label>
                      <input
                        type="number"
                        value={form.current_value}
                        onChange={(e) => setForm({ ...form, current_value: e.target.value })}
                        placeholder="Defaults to start value"
                      />
                    </div>
                    <div className="field">
                      <label>Unit</label>
                      <input
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        placeholder="kg, R, pages…"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="field">
                <label>Target date</label>
                <input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                />
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
