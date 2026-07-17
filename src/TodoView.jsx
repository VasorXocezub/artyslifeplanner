import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { getHiddenTodoTabs } from './lib/localPrefs'

const PRIORITIES = [
  { key: 'right_now', label: '🔥 Right Now', color: '#1E5C57' },
  { key: 'next_up', label: '🌱 Next Up', color: '#E4CBA0' },
  { key: 'later', label: '🌙 Later', color: '#F0E8F5' },
]
const PRIORITY_ORDER = { right_now: 0, next_up: 1, later: 2 }

const CATEGORIES = [
  { key: 'personal', label: '💖 Personal' },
  { key: 'business', label: '💼 Business' },
]

const REPEAT_OPTIONS = [
  { key: 'none', label: 'Does not repeat' },
  { key: 'daily', label: '🔄 Daily' },
  { key: 'weekly', label: '📅 Weekly' },
  { key: 'monthly', label: '🗓️ Monthly' },
  { key: 'custom', label: '✨ Custom Repeat' },
]

const DAY_OPTIONS = [
  { key: 'sunday', label: 'Sun' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
]

function toggleDay(current, day) {
  const arr = Array.isArray(current) ? current : []
  return arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day]
}

function formatDays(days) {
  if (!days || days.length === 0) return 'Pick days'
  return days.map((d) => DAY_OPTIONS.find((o) => o.key === d)?.label).join(', ')
}

function repeatInfo(key) {
  return REPEAT_OPTIONS.find((r) => r.key === key) || REPEAT_OPTIONS[0]
}

function priorityInfo(key) {
  return PRIORITIES.find((p) => p.key === key) || PRIORITIES[1]
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
}

function isOverdue(d) {
  if (!d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(d + 'T00:00:00') < today
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatTimestamp(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function momentumMessage(pct) {
  if (pct >= 100) return 'You did that! 👑'
  if (pct >= 70) return 'Almost there, keep going.'
  if (pct >= 40) return 'Look at you go, queen.'
  if (pct > 0) return 'Nice start — keep it up.'
  return "Let's get this bread."
}

function shouldReset(todo, now) {
  if (!todo.is_recurring || !todo.completed) return false
  if (!todo.last_reset_date) return true
  const last = new Date(todo.last_reset_date + 'T00:00:00')
  if (todo.repeat_type === 'weekly') return (now - last) / 86400000 >= 7
  if (todo.repeat_type === 'monthly') return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()
  if (todo.repeat_type === 'custom') {
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayKey = dayKeys[now.getDay()]
    const days = todo.custom_days || []
    if (!days.includes(todayKey)) return false
    return todo.last_reset_date !== todayStr()
  }
  return todo.last_reset_date !== todayStr()
}

export default function TodoView() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState(() => {
    const hidden = getHiddenTodoTabs()
    const firstVisible = CATEGORIES.find((c) => !hidden.includes(c.key))
    return firstVisible ? firstVisible.key : 'personal'
  })
  const hiddenTabs = getHiddenTodoTabs()
  const visibleCategories = CATEGORIES.filter((c) => !hiddenTabs.includes(c.key))
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPriority, setNewPriority] = useState('next_up')
  const [newRepeat, setNewRepeat] = useState('none')
  const [newCustomDays, setNewCustomDays] = useState([])
  const [adding, setAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [expandedNotes, setExpandedNotes] = useState({})
  const [noteInputs, setNoteInputs] = useState({})
  const [editingDaysId, setEditingDaysId] = useState(null)

  useEffect(() => {
    fetchTodos()
  }, [])

  useEffect(() => {
    if (hiddenTabs.includes(category) && visibleCategories.length > 0) {
      setCategory(visibleCategories[0].key)
    }
  }, [category])

  async function fetchTodos() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const now = new Date()
    const today = todayStr()
    const toReset = (data || []).filter((t) => shouldReset(t, now))
    if (toReset.length > 0) {
      await Promise.all(
        toReset.map((t) =>
          supabase.from('todos').update({ completed: false, last_reset_date: today }).eq('id', t.id)
        )
      )
      const { data: refreshed } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: true })
      setTodos(refreshed || [])
    } else {
      setTodos(data)
    }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const user_id = await getUserId()
    const isRecurring = newRepeat !== 'none'
    const { error } = await supabase
      .from('todos')
      .insert({
        text: newText.trim(),
        due_date: newDate || null,
        priority: newPriority,
        category,
        is_recurring: isRecurring,
        repeat_type: isRecurring ? newRepeat : null,
        custom_days: newRepeat === 'custom' ? newCustomDays : [],
        last_reset_date: isRecurring ? todayStr() : null,
        user_id,
      })
    setAdding(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewText('')
    setNewDate('')
    setNewRepeat('none')
    setNewCustomDays([])
    fetchTodos()
  }

  async function changeRepeat(todo, repeatType) {
    const isRecurring = repeatType !== 'none'
    const { error } = await supabase
      .from('todos')
      .update({ is_recurring: isRecurring, repeat_type: isRecurring ? repeatType : null, last_reset_date: isRecurring ? todayStr() : null })
      .eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    if (repeatType === 'custom') {
      setEditingDaysId(todo.id)
    }
    fetchTodos()
  }

  async function saveCustomDays(todo, days) {
    const { error } = await supabase.from('todos').update({ custom_days: days }).eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  async function toggleComplete(todo) {
    const willComplete = !todo.completed
    const payload = { completed: willComplete }
    if (todo.is_recurring && willComplete) payload.last_reset_date = todayStr()
    const { error } = await supabase
      .from('todos')
      .update(payload)
      .eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  async function changePriority(todo, priority) {
    const { error } = await supabase.from('todos').update({ priority }).eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  function toggleNotesExpanded(todo) {
    setExpandedNotes((v) => ({ ...v, [todo.id]: !v[todo.id] }))
    setNoteInputs((v) => ({ ...v, [todo.id]: v[todo.id] !== undefined ? v[todo.id] : (todo.notes || '') }))
  }

  async function saveNotes(todo) {
    const { error } = await supabase.from('todos').update({
      notes: noteInputs[todo.id] || null,
      notes_updated_at: new Date().toISOString(),
    }).eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  async function toggleNotesVisible(todo) {
    const { error } = await supabase.from('todos').update({ notes_visible: !todo.notes_visible }).eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  const categoryTodos = todos.filter((t) => (t.category || 'personal') === category)
  const filteredOpen = categoryTodos.filter((t) => !t.completed && (priorityFilter === 'all' || t.priority === priorityFilter))
  const openTodos = filteredOpen.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1
    const pb = PRIORITY_ORDER[b.priority] ?? 1
    if (pa !== pb) return pa - pb
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })
  const completedTodos = categoryTodos.filter((t) => t.completed)

  const momentumPct = categoryTodos.length > 0
    ? Math.round((completedTodos.length / categoryTodos.length) * 100)
    : 0

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">To-Do List</h1>
          <p className="view-subtitle cake-club-subtitle">🫡 Unfortunately, I assigned this to myself.</p>
        </div>
      </div>

      <div className="filter-row">
        {visibleCategories.map((c) => (
          <button
            key={c.key}
            className={`filter-pill ${category === c.key ? 'filter-pill-active' : ''}`}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {categoryTodos.length > 0 && (
        <div className="calendar-card momentum-card">
          <p className="module-group-label">MOMENTUM METER</p>
          <div className="momentum-track">
            <div className="momentum-fill" style={{ width: `${momentumPct}%` }} />
          </div>
          <p className="momentum-caption">{momentumPct}% — {momentumMessage(momentumPct)}</p>
        </div>
      )}

      <form className="habit-add-row" onSubmit={handleAdd}>
        <input
          className="search-box habit-add-input"
          placeholder="Add a task…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <select
          className="todo-date-input"
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <input
          type="date"
          className="todo-date-input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={adding}>
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </form>

      <div className="field todo-repeat-field">
        <label>Repeat</label>
        <select value={newRepeat} onChange={(e) => setNewRepeat(e.target.value)}>
          {REPEAT_OPTIONS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        {newRepeat === 'custom' && (
          <div className="custom-days-row">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`custom-day-chip ${newCustomDays.includes(d.key) ? 'custom-day-chip-on' : ''}`}
                onClick={() => setNewCustomDays(toggleDay(newCustomDays, d.key))}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="filter-row">
        <button
          className={`filter-pill ${priorityFilter === 'all' ? 'filter-pill-active' : ''}`}
          onClick={() => setPriorityFilter('all')}
        >
          All
        </button>
        {PRIORITIES.map((p) => (
          <button
            key={p.key}
            className={`filter-pill ${priorityFilter === p.key ? 'filter-pill-active' : ''}`}
            onClick={() => setPriorityFilter(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Rounding up your tasks… 📋✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && openTodos.length === 0 && completedTodos.length === 0 && (
        <div className="empty-state">
          <h3>Nothing here yet, iconic ✨</h3>
          <p>Add your first task above — let's get this bread, bestie.</p>
        </div>
      )}

      {!loading && !error && openTodos.length > 0 && (
        <div className="todo-list">
          {openTodos.map((t) => {
            const pInfo = priorityInfo(t.priority)
            const notesOpen = !!expandedNotes[t.id]
            return (
              <div className="todo-item-wrap" key={t.id}>
                <div className="todo-row">
                  <button className="todo-checkbox" onClick={() => toggleComplete(t)} aria-label="Mark done" />
                  <span className="todo-text">{t.text}</span>
                  <select
                    className="todo-recurring-select"
                    value={t.is_recurring ? (t.repeat_type || 'daily') : 'none'}
                    onChange={(e) => changeRepeat(t, e.target.value)}
                    title="Repeat"
                  >
                    {REPEAT_OPTIONS.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                  <select
                    className="todo-priority-select"
                    style={{ color: pInfo.color, borderColor: pInfo.color }}
                    value={t.priority || 'next_up'}
                    onChange={(e) => changePriority(t, e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  {t.due_date && (
                    <span className={`todo-due ${isOverdue(t.due_date) ? 'todo-due-overdue' : ''}`}>
                      {formatDate(t.due_date)}
                    </span>
                  )}
                  {t.is_recurring && t.repeat_type === 'custom' && (
                    <button className="weather-location-link" onClick={() => setEditingDaysId(editingDaysId === t.id ? null : t.id)}>
                      📆 {formatDays(t.custom_days)}
                    </button>
                  )}
                  <button className="weather-location-link" onClick={() => toggleNotesExpanded(t)}>
                    {t.notes ? '📝 Notes' : '📝 Add notes'}
                  </button>
                  <button className="todo-delete" onClick={() => handleDelete(t.id)}>×</button>
                </div>
                {editingDaysId === t.id && (
                  <div className="todo-notes-panel">
                    <span className="booknook-stat-label">REPEATS ON…</span>
                    <div className="custom-days-row" style={{ marginTop: 8 }}>
                      {DAY_OPTIONS.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          className={`custom-day-chip ${(t.custom_days || []).includes(d.key) ? 'custom-day-chip-on' : ''}`}
                          onClick={() => saveCustomDays(t, toggleDay(t.custom_days, d.key))}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {notesOpen && (
                  <div className="todo-notes-panel">
                    <div className="todo-notes-header">
                      <span className="booknook-stat-label">PROGRESS, CONTEXT, FOLLOW-UPS…</span>
                      <button className="todo-visibility-toggle" onClick={() => toggleNotesVisible(t)}>
                        <span className={`settings-toggle ${t.notes_visible === false ? '' : 'settings-toggle-on'}`}>
                          <span className="settings-toggle-knob" />
                        </span>
                        {t.notes_visible === false ? '🙈 Hidden' : '👀 Visible'}
                      </button>
                    </div>
                    <textarea
                      className="todo-notes-textarea"
                      value={noteInputs[t.id] !== undefined ? noteInputs[t.id] : (t.notes || '')}
                      onChange={(e) => setNoteInputs((v) => ({ ...v, [t.id]: e.target.value }))}
                      placeholder="Progress updates, notes, context, follow-up reminders…"
                    />
                    <div className="todo-notes-footer">
                      {t.notes_updated_at && (
                        <span className="todo-notes-timestamp">Last updated {formatTimestamp(t.notes_updated_at)}</span>
                      )}
                      <button className="btn-check log-value-btn" onClick={() => saveNotes(t)}>Save notes</button>
                    </div>
                  </div>
                )}
                {!notesOpen && t.notes && (
                  <div className="todo-notes-preview-row">
                    <p className="todo-notes-preview" onClick={() => toggleNotesExpanded(t)} style={{ opacity: t.notes_visible === false ? 0.4 : 1 }}>
                      📝 {t.notes_visible === false ? 'Note hidden' : t.notes}
                      {t.notes_updated_at && <span className="todo-notes-timestamp"> · {formatTimestamp(t.notes_updated_at)}</span>}
                    </p>
                    <button className="todo-visibility-toggle todo-visibility-toggle-small" onClick={() => toggleNotesVisible(t)}>
                      <span className={`settings-toggle ${t.notes_visible === false ? '' : 'settings-toggle-on'}`}>
                        <span className="settings-toggle-knob" />
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {completedTodos.length > 0 && (
        <div className="todo-completed-section">
          <button className="btn-ghost todo-toggle-completed" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? 'Hide' : 'Show'} completed ({completedTodos.length})
          </button>
          {showCompleted && (
            <div className="todo-list">
              {completedTodos.map((t) => (
                <div className="todo-row todo-row-done" key={t.id}>
                  <button className="todo-checkbox todo-checkbox-checked" onClick={() => toggleComplete(t)} aria-label="Mark not done">
                    ✓
                  </button>
                  <span className="todo-text todo-text-done">{t.text}</span>
                  {t.is_recurring && <span className="todo-recurring-badge todo-recurring-badge-on">🔄</span>}
                  <button className="todo-delete" onClick={() => handleDelete(t.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
