import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const CARD_COLORS = ['#E0457B', '#E8623C', '#8A9A5B', '#5A1730']

const UNIT_LABELS = { none: 'times', steps: 'steps', calories: 'cal', time: 'min' }
const PERIOD_LABELS = { day: 'day', week: 'week', month: 'month' }

const emptyForm = {
  name: '',
  type: 'build',
  start_date: '',
  end_date: '',
  goal_period: 'day',
  unit_type: 'none',
  target_value: '',
  target_count: '1',
  task_days_mode: 'every_day',
  task_days_count: '',
  task_days_specific: [],
}

function toISO(date) {
  return date.toISOString().split('T')[0]
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getPeriodBounds(period, refDate) {
  const d = new Date(refDate)
  d.setHours(0, 0, 0, 0)
  if (period === 'week') {
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (period === 'month') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start, end }
  }
  return { start: d, end: d }
}

function shiftPeriod(period, date, delta) {
  const d = new Date(date)
  if (period === 'week') d.setDate(d.getDate() + delta * 7)
  else if (period === 'month') d.setMonth(d.getMonth() + delta)
  else d.setDate(d.getDate() + delta)
  return d
}

function logsInRange(logs, start, end) {
  return logs.filter((l) => {
    const d = parseLocalDate(l.logged_date)
    return d >= start && d <= end
  })
}

function progressFor(habit, logs, refDate) {
  const { start, end } = getPeriodBounds(habit.goal_period, refDate)
  const periodLogs = logsInRange(logs, start, end)
  if (habit.unit_type === 'none') {
    const count = new Set(periodLogs.map((l) => l.logged_date)).size
    return { value: count, target: habit.target_count || 1 }
  }
  const sum = periodLogs.reduce((acc, l) => acc + Number(l.value || 0), 0)
  return { value: sum, target: habit.target_value || 0 }
}

function calcStreak(habit, logs) {
  let streak = 0
  let refDate = new Date()
  for (let i = 0; i < 24; i++) {
    refDate = shiftPeriod(habit.goal_period, refDate, -1)
    const { value, target } = progressFor(habit, logs, refDate)
    if (target > 0 && value >= target) streak++
    else break
  }
  return streak
}

function taskDaysLabel(habit) {
  const v = habit.task_days_value || {}
  switch (habit.task_days_mode) {
    case 'days_per_week':
      return `${v.count || 1}x per week`
    case 'days_per_month':
      return `${v.count || 1}x per month`
    case 'specific_days_of_month':
      return (v.days || []).length ? `Days ${(v.days || []).join(', ')} of the month` : 'Specific days'
    default:
      return 'Every day'
  }
}

export default function HabitsView() {
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [valueInputs, setValueInputs] = useState({})

  const todayStr = toISO(new Date())
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)

    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: true })

    if (habitsError) {
      setError(habitsError.message)
      setLoading(false)
      return
    }

    const { data: logsData, error: logsError } = await supabase
      .from('habit_logs')
      .select('*')

    if (logsError) {
      setError(logsError.message)
      setLoading(false)
      return
    }

    const grouped = {}
    for (const log of logsData) {
      if (!grouped[log.habit_id]) grouped[log.habit_id] = []
      grouped[log.habit_id].push(log)
    }

    setHabits(habitsData)
    setLogsByHabit(grouped)
    setLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(habit) {
    const v = habit.task_days_value || {}
    setEditingId(habit.id)
    setForm({
      name: habit.name || '',
      type: habit.type || 'build',
      start_date: habit.start_date || '',
      end_date: habit.end_date || '',
      goal_period: habit.goal_period || 'day',
      unit_type: habit.unit_type || 'none',
      target_value: habit.target_value != null ? String(habit.target_value) : '',
      target_count: habit.target_count != null ? String(habit.target_count) : '1',
      task_days_mode: habit.task_days_mode || 'every_day',
      task_days_count: v.count != null ? String(v.count) : '',
      task_days_specific: v.days || [],
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function toggleSpecificDay(day) {
    setForm((f) => {
      const has = f.task_days_specific.includes(day)
      return {
        ...f,
        task_days_specific: has
          ? f.task_days_specific.filter((d) => d !== day)
          : [...f.task_days_specific, day].sort((a, b) => a - b),
      }
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    let task_days_value = null
    if (form.task_days_mode === 'days_per_week' || form.task_days_mode === 'days_per_month') {
      task_days_value = { count: parseInt(form.task_days_count, 10) || 1 }
    } else if (form.task_days_mode === 'specific_days_of_month') {
      task_days_value = { days: form.task_days_specific }
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      goal_period: form.goal_period,
      unit_type: form.unit_type,
      target_value: form.unit_type !== 'none' ? parseFloat(form.target_value) || null : null,
      target_count: form.unit_type === 'none' ? parseInt(form.target_count, 10) || 1 : null,
      task_days_mode: form.task_days_mode,
      task_days_value,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('habits').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('habits').insert(payload))
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchAll()
  }

  async function handleDeleteHabit() {
    if (!editingId) return
    if (!confirm('Delete this habit and all its check-ins?')) return
    const { error } = await supabase.from('habits').delete().eq('id', editingId)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchAll()
  }

  async function markDoneToday(habit) {
    const logs = logsByHabit[habit.id] || []
    const existing = logs.find((l) => l.logged_date === todayStr)
    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, logged_date: todayStr, value: null })
      if (error) { setError(error.message); return }
    }
    fetchAll()
  }

  async function logValue(habit) {
    const raw = valueInputs[habit.id]
    const amount = parseFloat(raw)
    if (!raw || isNaN(amount)) return
    const logs = logsByHabit[habit.id] || []
    const existing = logs.find((l) => l.logged_date === todayStr)
    let error
    if (existing) {
      ;({ error } = await supabase.from('habit_logs').update({ value: Number(existing.value || 0) + amount }).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, logged_date: todayStr, value: amount }))
    }
    if (error) { setError(error.message); return }
    setValueInputs((v) => ({ ...v, [habit.id]: '' }))
    fetchAll()
  }

  const enriched = useMemo(() => {
    return habits.map((h) => {
      const logs = logsByHabit[h.id] || []
      const progress = progressFor(h, logs, new Date())
      const streak = calcStreak(h, logs)
      const doneToday = logs.some((l) => l.logged_date === todayStr)
      const ended = h.end_date && parseLocalDate(h.end_date) < today
      const notStarted = h.start_date && parseLocalDate(h.start_date) > today
      return { ...h, progress, streak, doneToday, ended, notStarted }
    })
  }, [habits, logsByHabit])

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Habits</h1>
          <p className="view-subtitle">
            {habits.length === 0 ? 'Ready to build something? ✨' : `${habits.length} ${habits.length === 1 ? 'habit' : 'habits'} in the works`}
          </p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={openAdd}>+ Add habit</button>
        </div>
      </div>

      {loading && <p className="loading">Warming up your streaks… 🔥</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && habits.length === 0 && (
        <div className="empty-state">
          <h3>No habits yet — every streak starts at zero 🔥</h3>
          <p>Add the first thing you want to build (or quit).</p>
        </div>
      )}

      {!loading && !error && habits.length > 0 && (
        <div className="card-grid">
          {enriched.map((h, i) => {
            const unitLabel = UNIT_LABELS[h.unit_type]
            const periodLabel = PERIOD_LABELS[h.goal_period]
            const pct = h.progress.target > 0 ? Math.min(100, Math.round((h.progress.value / h.progress.target) * 100)) : 0

            return (
              <div
                className="contact-card habit-card"
                key={h.id}
                style={{ borderTopColor: CARD_COLORS[i % CARD_COLORS.length] }}
              >
                <div className="habit-header-row">
                  <h3 className="contact-name">{h.name}</h3>
                  <span className={`type-badge ${h.type === 'quit' ? 'type-badge-quit' : 'type-badge-build'}`}>
                    {h.type === 'quit' ? '🚫 Quit' : '🌱 Build'}
                  </span>
                </div>

                <p className="habit-schedule">{taskDaysLabel(h)}</p>

                {(h.start_date || h.end_date) && (
                  <p className="habit-dates">
                    {h.start_date ? new Date(h.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '…'}
                    {' – '}
                    {h.end_date ? new Date(h.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'ongoing'}
                  </p>
                )}

                <div className="progress-row">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: CARD_COLORS[i % CARD_COLORS.length] }} />
                  </div>
                  <span className="progress-label">
                    {h.progress.value}/{h.progress.target} {unitLabel} per {periodLabel}
                  </span>
                </div>

                <div className="streak-row">
                  <span className="streak-number">{h.streak > 0 ? '🔥' : ''}{h.streak}</span>
                  <span className="streak-label">{periodLabel}{h.streak === 1 ? '' : 's'} strong</span>
                </div>

                {h.ended && <p className="habit-status-note">Ended</p>}
                {h.notStarted && <p className="habit-status-note">Starts {new Date(h.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}

                {!h.ended && !h.notStarted && (
                  <div className="habit-actions">
                    {h.unit_type === 'none' ? (
                      <button
                        className={`btn-check ${h.doneToday ? 'btn-check-done' : ''}`}
                        onClick={() => markDoneToday(h)}
                      >
                        {h.doneToday ? '✓ Nailed it today' : 'Mark done today'}
                      </button>
                    ) : (
                      <div className="log-value-row">
                        <input
                          type="number"
                          className="log-value-input"
                          placeholder={`+ ${unitLabel}`}
                          value={valueInputs[h.id] || ''}
                          onChange={(e) => setValueInputs((v) => ({ ...v, [h.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && logValue(h)}
                        />
                        <button className="btn-check log-value-btn" onClick={() => logValue(h)}>Log</button>
                      </div>
                    )}
                    <button className="btn-delete-small" onClick={() => openEdit(h)}>
                      Edit
                    </button>
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
            <h2>{editingId ? 'Edit habit' : 'New habit'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Name</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Drink water, quit smoking, read…"
                  required
                />
              </div>

              <div className="field">
                <label>Type</label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${form.type === 'build' ? 'toggle-btn-active' : ''}`}
                    onClick={() => setForm({ ...form, type: 'build' })}
                  >
                    🌱 Build
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${form.type === 'quit' ? 'toggle-btn-active' : ''}`}
                    onClick={() => setForm({ ...form, type: 'quit' })}
                  >
                    🚫 Quit
                  </button>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Start date (optional)</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>End date (optional)</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Goal period</label>
                  <select
                    value={form.goal_period}
                    onChange={(e) => setForm({ ...form, goal_period: e.target.value })}
                  >
                    <option value="day">Every day</option>
                    <option value="week">Every week</option>
                    <option value="month">Every month</option>
                  </select>
                </div>
                <div className="field">
                  <label>Goal value</label>
                  <select
                    value={form.unit_type}
                    onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  >
                    <option value="none">No unit</option>
                    <option value="steps">Steps</option>
                    <option value="calories">Calories</option>
                    <option value="time">Time (minutes)</option>
                  </select>
                </div>
              </div>

              {form.unit_type === 'none' ? (
                <div className="field">
                  <label>Times per {PERIOD_LABELS[form.goal_period]}</label>
                  <input
                    type="number"
                    min="1"
                    value={form.target_count}
                    onChange={(e) => setForm({ ...form, target_count: e.target.value })}
                  />
                </div>
              ) : (
                <div className="field">
                  <label>Target {UNIT_LABELS[form.unit_type]} per {PERIOD_LABELS[form.goal_period]}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.target_value}
                    onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                    placeholder="e.g. 10000"
                  />
                </div>
              )}

              <div className="field">
                <label>Task days</label>
                <select
                  value={form.task_days_mode}
                  onChange={(e) => setForm({ ...form, task_days_mode: e.target.value })}
                >
                  <option value="every_day">Every day</option>
                  <option value="days_per_week">Number of days per week</option>
                  <option value="specific_days_of_month">Specific days of the month</option>
                  <option value="days_per_month">Number of days per month</option>
                </select>
              </div>

              {(form.task_days_mode === 'days_per_week' || form.task_days_mode === 'days_per_month') && (
                <div className="field">
                  <label>{form.task_days_mode === 'days_per_week' ? 'Days per week' : 'Days per month'}</label>
                  <input
                    type="number"
                    min="1"
                    max={form.task_days_mode === 'days_per_week' ? 7 : 31}
                    value={form.task_days_count}
                    onChange={(e) => setForm({ ...form, task_days_count: e.target.value })}
                  />
                </div>
              )}

              {form.task_days_mode === 'specific_days_of_month' && (
                <div className="field">
                  <label>Pick days</label>
                  <div className="day-grid">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <button
                        type="button"
                        key={day}
                        className={`day-cell ${form.task_days_specific.includes(day) ? 'day-cell-active' : ''}`}
                        onClick={() => toggleSpecificDay(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <div>
                  {editingId && (
                    <button type="button" className="btn-delete" onClick={handleDeleteHabit} disabled={saving}>
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
