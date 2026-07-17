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

function momentumMessage(pct) {
  if (pct >= 100) return 'You did that! 👑'
  if (pct >= 70) return 'Almost there, keep going.'
  if (pct >= 40) return 'Look at you go, queen.'
  if (pct > 0) return 'Nice start — keep it up.'
  return "Let's get this bread."
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
  const [newRecurring, setNewRecurring] = useState(false)
  const [adding, setAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState('all')

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

    const today = todayStr()
    const toReset = (data || []).filter(
      (t) => t.is_recurring && t.completed && t.last_reset_date !== today
    )
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
    const { error } = await supabase
      .from('todos')
      .insert({
        text: newText.trim(),
        due_date: newDate || null,
        priority: newPriority,
        category,
        is_recurring: newRecurring,
        last_reset_date: newRecurring ? todayStr() : null,
        user_id,
      })
    setAdding(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewText('')
    setNewDate('')
    setNewRecurring(false)
    fetchTodos()
  }

  async function toggleRecurring(todo) {
    const { error } = await supabase
      .from('todos')
      .update({ is_recurring: !todo.is_recurring, last_reset_date: !todo.is_recurring ? todayStr() : null })
      .eq('id', todo.id)
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
          <h1 className="view-title">To-Do</h1>
          <p className="view-subtitle">
            {openTodos.length === 0 ? 'Nothing on your plate, bestie ✨' : `${openTodos.length} ${openTodos.length === 1 ? 'thing' : 'things'} to slay`}
          </p>
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

      <label className="savings-toggle-label todo-recurring-label">
        <input
          type="checkbox"
          checked={newRecurring}
          onChange={(e) => setNewRecurring(e.target.checked)}
        />
        {' '}🔁 Repeats daily
      </label>

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
            return (
              <div className="todo-row" key={t.id}>
                <button className="todo-checkbox" onClick={() => toggleComplete(t)} aria-label="Mark done" />
                <span className="todo-text">{t.text}</span>
                <button
                  type="button"
                  className={`todo-recurring-badge ${t.is_recurring ? 'todo-recurring-badge-on' : ''}`}
                  onClick={() => toggleRecurring(t)}
                  title={t.is_recurring ? 'Repeats daily — click to turn off' : 'Click to make this repeat daily'}
                >
                  🔁
                </button>
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
                <button className="todo-delete" onClick={() => handleDelete(t.id)}>×</button>
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
                  {t.is_recurring && <span className="todo-recurring-badge todo-recurring-badge-on">🔁</span>}
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
