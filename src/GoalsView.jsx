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
  reward: '',
}

const STATUS_LABELS = {
  not_started: '🌱 Not Started',
  in_progress: '🚀 In Motion',
  done: '👑 Slayed',
}

const STATUS_COLORS = {
  not_started: '#1E5C57',
  in_progress: '#1E5C57',
  done: '#B896C9',
}

const ERA_OPTIONS = [
  '🌸 Glow-Up Era', '💸 Rich Girl Era', '👑 Main Character Era', '🌿 Peace Era',
  '💼 CEO Era', '💖 Lover Girl Era', '🏡 Cozy Girl Era', '📚 Smart Girl Era',
  '✈️ Passport Princess Era', '💪 Strong Girl Era', '🎨 Creative Girl Era', '🎀 Dream Life Era',
  '🔥 Discipline Era', '🌙 Healing Era', '🍒 Hot Girl Era', '🦋 Reinvention Era',
  '⭐ Success Era', '☁️ Soft Life Era', '🧘 Wellness Era', '💎 Luxury Era',
  '🛍️ Wishlist Era', '🏠 Homebody Era', '👶 Family Era', '🐾 Pet Mom Era',
  '🌎 Adventure Era', '🎯 Level-Up Era', '📈 Money Moves Era', '✨ Becoming Her Era',
  '💌 Self-Love Era', '🌻 Happy Girl Era', '🥂 Celebration Era', '🎄 Holiday Era',
  '🧁 Hobby Era', '🎓 Student Era', '💻 Content Creator Era', '🚀 Side Hustle Era',
  '🗂️ Life Admin Era', '🕊️ Fresh Start Era', '🌈 Bucket List Era', '🍵 Slow Living Era',
  '💫 Future Me Era',
]

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

function effectivePct(goal) {
  if (goal.goal_type === 'progress') return computeProgress(goal).pct
  const status = effectiveStatus(goal)
  if (status === 'done') return 100
  if (status === 'in_progress') return 50
  return 0
}

function progressStage(pct) {
  if (pct >= 100) return { label: 'Bloomed', icon: '👑' }
  if (pct >= 75) return { label: 'Thriving', icon: '🌳' }
  if (pct >= 25) return { label: 'Growing', icon: '🌿' }
  return { label: 'Seedling', icon: '🌱' }
}

function computeBadges(goal) {
  const badges = []
  const createdAt = goal.created_at ? new Date(goal.created_at) : null
  const daysSince = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : 0
  const status = effectiveStatus(goal)
  const pct = effectivePct(goal)

  if (status !== 'not_started') {
    if (daysSince >= 7) badges.push({ icon: '🏅', label: 'First Week' })
    if (daysSince >= 14) badges.push({ icon: '🔥', label: '14-Day Streak' })
    if (daysSince >= 30) badges.push({ icon: '🌸', label: 'Consistent Queen' })
  }
  if (pct >= 50) badges.push({ icon: '🎯', label: 'Halfway There' })
  if (pct >= 100) badges.push({ icon: '👑', label: 'Dream Achieved' })
  return badges
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
      reward: goal.reward || '',
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
      reward: form.reward.trim() || null,
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

  const filtered = goals.filter((g) => {
    const q = search.toLowerCase()
    const matchesSearch =
      g.title.toLowerCase().includes(q) ||
      (g.category || '').toLowerCase().includes(q) ||
      (g.notes || '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || effectiveStatus(g) === statusFilter
    return matchesSearch && matchesStatus
  })

  const counts = {
    all: goals.length,
    not_started: goals.filter((g) => effectiveStatus(g) === 'not_started').length,
    in_progress: goals.filter((g) => effectiveStatus(g) === 'in_progress').length,
    done: goals.filter((g) => effectiveStatus(g) === 'done').length,
  }

  const activeGoals = goals.filter((g) => effectiveStatus(g) !== 'done')
  const closestToFinish = activeGoals
    .filter((g) => g.goal_type === 'progress')
    .map((g) => ({ goal: g, pct: computeProgress(g).pct }))
    .sort((a, b) => b.pct - a.pct)[0]

  const eraCounts = {}
  activeGoals.forEach((g) => {
    if (!g.category) return
    eraCounts[g.category] = (eraCounts[g.category] || 0) + 1
  })
  const topEra = Object.entries(eraCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Goals</h1>
          <p className="view-subtitle cake-club-subtitle">Dreams don't chase themselves. ✨</p>
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

      {goals.length > 0 && (
        <div className="calendar-card goals-summary-card">
          <div className="goals-summary-row">
            <span className="goals-summary-label">✨ Active Dreams</span>
            <span className="goals-summary-value">{activeGoals.length}</span>
          </div>
          {closestToFinish && (
            <div className="goals-summary-row">
              <span className="goals-summary-label">🔥 Closest to Finish</span>
              <span className="goals-summary-value">{closestToFinish.goal.title} ({closestToFinish.pct}%)</span>
            </div>
          )}
          <div className="goals-summary-row">
            <span className="goals-summary-label">🏆 Dreams Slayed</span>
            <span className="goals-summary-value">{counts.done}</span>
          </div>
          {topEra && (
            <div className="goals-summary-row">
              <span className="goals-summary-label">🌸 Current Era</span>
              <span className="goals-summary-value">{topEra[0]}</span>
            </div>
          )}
        </div>
      )}

      <div className="filter-row">
        <button
          className={`filter-pill ${statusFilter === 'all' ? 'filter-pill-active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          ✨ All ({counts.all})
        </button>
        <button
          className={`filter-pill ${statusFilter === 'not_started' ? 'filter-pill-active' : ''}`}
          onClick={() => setStatusFilter('not_started')}
        >
          🌱 Not Started ({counts.not_started})
        </button>
        <button
          className={`filter-pill ${statusFilter === 'in_progress' ? 'filter-pill-active' : ''}`}
          onClick={() => setStatusFilter('in_progress')}
        >
          🚀 In Motion ({counts.in_progress})
        </button>
        <button
          className={`filter-pill ${statusFilter === 'done' ? 'filter-pill-active' : ''}`}
          onClick={() => setStatusFilter('done')}
        >
          👑 Slayed ({counts.done})
        </button>
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
            const pct = effectivePct(g)
            const stage = progressStage(pct)
            const badges = computeBadges(g)
            const eraLabel = g.category
            return (
              <div
                className="contact-card"
                key={g.id}
                style={{ borderTopColor: STATUS_COLORS[status] || '#B896C9' }}
              >
                <div onClick={() => openEdit(g)} style={{ cursor: 'pointer' }}>
                  <span className="status-badge" style={{ background: STATUS_COLORS[status] }}>
                    {STATUS_LABELS[status]}
                  </span>
                  <h3 className="contact-name" title={g.title}>{g.title}</h3>
                  {eraLabel && <p className="contact-relationship goal-era">{eraLabel}</p>}
                  {g.target_date && (
                    <div className="contact-meta">
                      <div><span className="label">Target</span>{formatDate(g.target_date)}</div>
                    </div>
                  )}
                  {g.notes && <p className="contact-notes">{g.notes}</p>}
                </div>

                <div className="progress-row">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: STATUS_COLORS[status] }}
                    />
                  </div>
                  <span className="progress-label">
                    {stage.icon} {stage.label}
                    {isProgress && ` — ${g.current_value} / ${g.target_value} ${g.unit || ''}`}
                    {' '}({pct}%)
                  </span>
                </div>

                {badges.length > 0 && (
                  <div className="goal-badges-row">
                    {badges.map((b) => (
                      <span className="goal-badge" key={b.label} title={b.label}>
                        {b.icon} {b.label}
                      </span>
                    ))}
                  </div>
                )}

                {g.reward && (
                  <p className="goal-reward">🎁 Reward: {g.reward}</p>
                )}

                {isProgress && (
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
                <label>Era</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">Pick your era…</option>
                  {ERA_OPTIONS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
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
                <label>🎁 Reward when you get there</label>
                <input
                  value={form.reward}
                  onChange={(e) => setForm({ ...form, reward: e.target.value })}
                  placeholder="New shoes, a spa day, that trip…"
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
