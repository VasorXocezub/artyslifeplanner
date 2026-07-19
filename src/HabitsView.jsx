import { useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const CARD_COLORS = ['#B896C9', '#1E5C57', '#1E5C57', '#1E5C57', '#1E5C57', '#8FC2BE']

const UNIT_LABELS = { none: 'times', steps: 'steps', calories: 'cal', time: 'min' }
const PERIOD_LABELS = { day: 'day', week: 'week', month: 'month' }

const ICON_OPTIONS = [
  '✨', '💧', '🏃', '🧘', '📚', '💪', '🥗', '🚭', '🛌', '🎯',
  '🔥', '🧹', '💰', '📵', '🌱', '🧠', '🎨', '🚴', '☀️', '🦷',
  '🧴', '🍎', '☕', '🍺', '💊', '📝', '🎸', '🐶', '🧺', '💤',
]

const emptyForm = {
  name: '',
  icon: '✨',
  type: 'build',
  start_date: '',
  end_date: '',
  goal_period: 'day',
  unit_type: 'none',
  log_style: 'checkbox',
  target_value: '',
  target_count: '1',
  task_days_mode: 'every_day',
  task_days_count: '',
  task_days_specific: [],
  task_days_weekly: [],
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

const RANGE_OPTIONS = [
  { key: 'week', label: 'Last Week', days: 7 },
  { key: 'month', label: 'Last Month', days: 30 },
  { key: '3months', label: '3 Months', days: 90 },
  { key: '6months', label: '6 Months', days: 180 },
  { key: 'year', label: '1 Year', days: 365 },
  { key: 'all', label: 'Total History', days: null },
]

function getRangeBounds(rangeKey, habits) {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const opt = RANGE_OPTIONS.find((r) => r.key === rangeKey)
  if (!opt.days) {
    const earliestStart = habits.reduce((min, h) => {
      if (!h.start_date) return min
      const d = parseLocalDate(h.start_date)
      return !min || d < min ? d : min
    }, null)
    return { start: earliestStart || new Date(2020, 0, 1), end }
  }
  const start = new Date(end)
  start.setDate(start.getDate() - opt.days + 1)
  return { start, end }
}

function expectedCount(habit, start, end) {
  const dayMs = 86400000
  const totalDays = Math.floor((end - start) / dayMs) + 1
  if (habit.task_days_mode === 'specific_days_of_week') {
    const days = habit.task_days_value?.days || []
    if (days.length === 0) return totalDays
    let count = 0
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (days.includes(DAY_KEYS[d.getDay()])) count++
    }
    return count
  }
  if (habit.task_days_mode === 'specific_days_of_month') {
    const days = habit.task_days_value?.days || []
    if (days.length === 0) return totalDays
    let count = 0
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (days.includes(d.getDate())) count++
    }
    return count
  }
  if (habit.task_days_mode === 'days_per_week') {
    const weeks = Math.max(1, Math.ceil(totalDays / 7))
    return weeks * (habit.task_days_value?.count || 1)
  }
  if (habit.task_days_mode === 'days_per_month') {
    const months = Math.max(1, Math.ceil(totalDays / 30))
    return months * (habit.task_days_value?.count || 1)
  }
  return totalDays
}

function progressFor(habit, logs, refDate) {
  const { start, end } = getPeriodBounds(habit.goal_period, refDate)
  const periodLogs = logsInRange(logs, start, end)
  if (habit.unit_type === 'none') {
    return { value: periodLogs.length, target: habit.target_count || 1 }
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

const DAY_OF_WEEK_OPTIONS = [
  { key: 'sunday', label: 'Sun' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
]
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function taskDaysLabel(habit) {
  const v = habit.task_days_value || {}
  switch (habit.task_days_mode) {
    case 'days_per_week':
      return `${v.count || 1}x per week`
    case 'days_per_month':
      return `${v.count || 1}x per month`
    case 'specific_days_of_month':
      return (v.days || []).length ? `Days ${(v.days || []).join(', ')} of the month` : 'Specific days'
    case 'specific_days_of_week':
      return (v.days || []).length
        ? (v.days || []).map((d) => DAY_OF_WEEK_OPTIONS.find((o) => o.key === d)?.label).join(', ')
        : 'Specific days'
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
  const [draggedId, setDraggedId] = useState(null)
  const [, setTick] = useState(0)
  const [pageView, setPageView] = useState('list')
  const [rangeFilter, setRangeFilter] = useState('week')

  const todayStr = toISO(new Date())
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)

    const { data: habitsData, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
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

  function handleDragStart(e, id) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
    setDraggedId(id)
  }

  function handleDragEnd() {
    setDraggedId(null)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e, targetId) {
    e.preventDefault()
    if (draggedId === null || draggedId === targetId) return
    const current = [...habits]
    const fromIdx = current.findIndex((h) => h.id === draggedId)
    const toIdx = current.findIndex((h) => h.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = current.splice(fromIdx, 1)
    current.splice(toIdx, 0, moved)
    setHabits(current)
    setDraggedId(null)
    persistOrder(current)
  }

  async function persistOrder(orderedHabits) {
    await Promise.all(
      orderedHabits.map((h, i) => supabase.from('habits').update({ sort_order: i }).eq('id', h.id))
    )
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
      icon: habit.icon || '✨',
      type: habit.type || 'build',
      start_date: habit.start_date || '',
      end_date: habit.end_date || '',
      goal_period: habit.goal_period || 'day',
      unit_type: habit.unit_type || 'none',
      log_style: habit.log_style || 'checkbox',
      target_value: habit.target_value != null ? String(habit.target_value) : '',
      target_count: habit.target_count != null ? String(habit.target_count) : '1',
      task_days_mode: habit.task_days_mode || 'every_day',
      task_days_count: v.count != null ? String(v.count) : '',
      task_days_specific: v.days || [],
      task_days_weekly: habit.task_days_mode === 'specific_days_of_week' ? (v.days || []) : [],
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

  function toggleWeeklyDay(day) {
    setForm((f) => {
      const has = f.task_days_weekly.includes(day)
      return {
        ...f,
        task_days_weekly: has ? f.task_days_weekly.filter((d) => d !== day) : [...f.task_days_weekly, day],
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
    } else if (form.task_days_mode === 'specific_days_of_week') {
      task_days_value = { days: form.task_days_weekly }
    }

    const payload = {
      name: form.name.trim(),
      icon: form.icon || '✨',
      type: form.type,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      goal_period: form.goal_period,
      unit_type: form.unit_type,
      log_style: form.unit_type === 'none' ? form.log_style : null,
      target_value: form.unit_type !== 'none' ? parseFloat(form.target_value) || null : null,
      target_count: form.unit_type === 'none' ? parseInt(form.target_count, 10) || 1 : null,
      task_days_mode: form.task_days_mode,
      task_days_value,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('habits').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('habits').insert({ ...payload, user_id }))
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

  async function toggleLogForDate(habit, dateStr) {
    const logs = logsByHabit[habit.id] || []
    const existing = logs.find((l) => l.logged_date === dateStr)
    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id)
      if (error) { setError(error.message); return }
    } else {
      const user_id = await getUserId()
      const { error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, logged_date: dateStr, value: null, user_id })
      if (error) { setError(error.message); return }
    }
    fetchAll()
  }

  function isScheduledDay(habit, dateStr) {
    const dow = DAY_KEYS[parseLocalDate(dateStr).getDay()]
    if (habit.task_days_mode === 'specific_days_of_week') {
      const days = habit.task_days_value?.days || []
      return days.length === 0 || days.includes(dow)
    }
    if (habit.task_days_mode === 'specific_days_of_month') {
      const days = habit.task_days_value?.days || []
      const dom = parseLocalDate(dateStr).getDate()
      return days.length === 0 || days.includes(dom)
    }
    return true
  }

  async function toggleDoneToday(habit) {
    const logs = logsByHabit[habit.id] || []
    const existing = logs.find((l) => l.logged_date === todayStr)
    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id)
      if (error) { setError(error.message); return }
    } else {
      const user_id = await getUserId()
      const { error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, logged_date: todayStr, value: null, user_id })
      if (error) { setError(error.message); return }
    }
    fetchAll()
  }

  async function incrementToday(habit) {
    const user_id = await getUserId()
    const { error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, logged_date: todayStr, value: null, user_id })
    if (error) { setError(error.message); return }
    fetchAll()
  }

  async function decrementToday(habit) {
    const logs = logsByHabit[habit.id] || []
    const todaysLogs = logs
      .filter((l) => l.logged_date === todayStr)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (todaysLogs.length === 0) return
    const { error } = await supabase.from('habit_logs').delete().eq('id', todaysLogs[0].id)
    if (error) { setError(error.message); return }
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
      const user_id = await getUserId()
      ;({ error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, logged_date: todayStr, value: amount, user_id }))
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
      const todayCount = logs.filter((l) => l.logged_date === todayStr).length
      const ended = h.end_date && parseLocalDate(h.end_date) < today
      const notStarted = h.start_date && parseLocalDate(h.start_date) > today
      return { ...h, progress, streak, todayCount, ended, notStarted }
    })
  }, [habits, logsByHabit])

  const overviewStats = useMemo(() => {
    if (habits.length === 0) return { perHabit: [], totalCheckins: 0, avgRate: 0 }
    const { start, end } = getRangeBounds(rangeFilter, habits)
    const perHabit = habits.map((h) => {
      const logs = logsByHabit[h.id] || []
      const inRange = logs.filter((l) => {
        const d = parseLocalDate(l.logged_date)
        return d >= start && d <= end
      })
      const expected = expectedCount(h, start, end)
      const rate = expected > 0 ? Math.min(100, Math.round((inRange.length / expected) * 100)) : 0
      return { habit: h, checkins: inRange.length, expected, rate }
    })
    const totalCheckins = perHabit.reduce((sum, p) => sum + p.checkins, 0)
    const avgRate = perHabit.length > 0 ? Math.round(perHabit.reduce((sum, p) => sum + p.rate, 0) / perHabit.length) : 0
    return { perHabit, totalCheckins, avgRate, start, end }
  }, [habits, logsByHabit, rangeFilter])

  const weekDates = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      return d
    })
  }, [])

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Daily Habits</h1>
          <p className="view-subtitle cake-club-subtitle">✨ Romanticizing basic human maintenance.</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={openAdd}>+ Add habit</button>
        </div>
      </div>

      <div className="filter-row">
        <button className={`filter-pill ${pageView === 'list' ? 'filter-pill-active' : ''}`} onClick={() => setPageView('list')}>
          🔥 Habits
        </button>
        <button className={`filter-pill ${pageView === 'overview' ? 'filter-pill-active' : ''}`} onClick={() => setPageView('overview')}>
          📊 Overview
        </button>
      </div>

      {loading && <p className="loading">Warming up your streaks… 🔥</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && habits.length === 0 && (
        <div className="empty-state">
          <h3>No habits yet — every streak starts at zero 🔥</h3>
          <p>Add the first thing you want to build (or quit) — let's get iconic.</p>
        </div>
      )}

      {!loading && !error && habits.length > 0 && pageView === 'list' && (
        <div className="habit-list">
          {enriched.map((h, i) => {
            const unitLabel = UNIT_LABELS[h.unit_type]
            const periodLabel = PERIOD_LABELS[h.goal_period]
            const isTickable = h.unit_type === 'none' && h.goal_period === 'day'
            const logs = logsByHabit[h.id] || []
            const loggedDates = new Set(logs.map((l) => l.logged_date))

            return (
              <div
                className={`habit-row ${draggedId === h.id ? 'habit-card-dragging' : ''}`}
                key={h.id}
                style={{ borderLeftColor: CARD_COLORS[i % CARD_COLORS.length] }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, h.id)}
              >
                <span
                  className="drag-handle habit-row-drag"
                  draggable
                  onDragStart={(e) => handleDragStart(e, h.id)}
                  onDragEnd={handleDragEnd}
                  title="Drag to reorder"
                >
                  ⠿⠿
                </span>

                <div className="habit-row-info">
                  <div className="habit-header-row">
                    <h3 className="contact-name" title={h.name}>{h.icon || '✨'} {h.name}</h3>
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
                  {h.ended && <p className="habit-status-note">Ended</p>}
                  {h.notStarted && <p className="habit-status-note">Starts {new Date(h.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}
                  <div className="streak-row">
                    <span className="streak-number">{h.streak > 0 ? '🔥' : ''}{h.streak}</span>
                    <span className="streak-label">{periodLabel}{h.streak === 1 ? '' : 's'} strong, icon behavior 💅</span>
                  </div>
                </div>

                {!h.ended && !h.notStarted && (
                  <div className="habit-row-actions">
                    {isTickable ? (
                      <div className="week-tick-strip">
                        {weekDates.map((d) => {
                          const dStr = toISO(d)
                          const isFuture = d > today
                          const scheduled = isScheduledDay(h, dStr)
                          const done = loggedDates.has(dStr)
                          const dayLetter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
                          return (
                            <button
                              key={dStr}
                              type="button"
                              className={`week-tick-cell ${done ? 'week-tick-cell-done' : ''} ${!scheduled ? 'week-tick-cell-off' : ''} ${d.getTime() === today.getTime() ? 'week-tick-cell-today' : ''}`}
                              disabled={isFuture || !scheduled}
                              onClick={() => toggleLogForDate(h, dStr)}
                              style={done ? { background: CARD_COLORS[i % CARD_COLORS.length], borderColor: CARD_COLORS[i % CARD_COLORS.length] } : {}}
                            >
                              <span className="week-tick-daylabel">{dayLetter}</span>
                              <span className="week-tick-mark">{done ? '✓' : ''}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : h.unit_type === 'none' ? (
                      <div className={`tick-stepper ${h.todayCount >= (h.target_count || 1) ? 'tick-stepper-done' : ''}`}>
                        <button type="button" className="tick-btn" onClick={() => decrementToday(h)} disabled={h.todayCount === 0}>−</button>
                        <span className="tick-count">
                          {h.todayCount >= (h.target_count || 1) ? '✓ ' : ''}{h.todayCount} today
                        </span>
                        <button type="button" className="tick-btn tick-btn-add" onClick={() => incrementToday(h)}>+</button>
                      </div>
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
                    <button className="btn-delete-small" onClick={() => openEdit(h)}>Edit</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && habits.length > 0 && pageView === 'overview' && (
        <>
          <div className="filter-row">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.key}
                className={`filter-pill ${rangeFilter === r.key ? 'filter-pill-active' : ''}`}
                onClick={() => setRangeFilter(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">
              {RANGE_OPTIONS.find((r) => r.key === rangeFilter)?.label.toUpperCase()} SUMMARY
            </p>
            <div className="goals-summary-row">
              <span className="goals-summary-label">✅ Total check-ins</span>
              <span className="goals-summary-value">{overviewStats.totalCheckins}</span>
            </div>
            <div className="goals-summary-row">
              <span className="goals-summary-label">📊 Average completion</span>
              <span className="goals-summary-value">{overviewStats.avgRate}%</span>
            </div>
          </div>

          <div className="habit-list" style={{ marginTop: 16 }}>
            {overviewStats.perHabit.map(({ habit: h, checkins, expected, rate }, i) => (
              <div className="habit-row" key={h.id} style={{ borderLeftColor: CARD_COLORS[i % CARD_COLORS.length] }}>
                <div className="habit-row-info">
                  <div className="habit-header-row">
                    <h3 className="contact-name" title={h.name}>{h.icon || '✨'} {h.name}</h3>
                    <span className={`type-badge ${h.type === 'quit' ? 'type-badge-quit' : 'type-badge-build'}`}>
                      {h.type === 'quit' ? '🚫 Quit' : '🌱 Build'}
                    </span>
                  </div>
                  <div className="progress-row">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${rate}%`, background: CARD_COLORS[i % CARD_COLORS.length] }} />
                    </div>
                    <span className="progress-label">{checkins}/{expected} check-ins · {rate}%</span>
                  </div>
                </div>
                <div className="habit-row-actions">
                  <span className="streak-number">{h.streak > 0 ? '🔥' : ''}{h.streak}</span>
                </div>
              </div>
            ))}
          </div>
        </>
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
                <label>Icon</label>
                <div className="icon-picker">
                  <span className="icon-preview">{form.icon || '✨'}</span>
                  <input
                    className="icon-custom-input"
                    value={form.icon}
                    maxLength={4}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="Paste any emoji"
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
                    onChange={(e) => {
                      const period = e.target.value
                      const defaultTaskDaysMode =
                        period === 'week' ? 'days_per_week' : period === 'month' ? 'days_per_month' : 'every_day'
                      setForm({
                        ...form,
                        goal_period: period,
                        task_days_mode: defaultTaskDaysMode,
                        task_days_count: form.target_count,
                      })
                    }}
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

              {form.unit_type === 'none' && (
                <div className="field">
                  <label>How do you want to log it?</label>
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`toggle-btn ${form.log_style === 'checkbox' ? 'toggle-btn-active' : ''}`}
                      onClick={() => setForm({ ...form, log_style: 'checkbox' })}
                    >
                      ✓ Mark as done
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${form.log_style === 'counter' ? 'toggle-btn-active' : ''}`}
                      onClick={() => setForm({ ...form, log_style: 'counter' })}
                    >
                      🔢 Add value (tally)
                    </button>
                  </div>
                </div>
              )}

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
                  <option value="specific_days_of_week">Specific days of the week</option>
                  <option value="days_per_week">Number of days per week</option>
                  <option value="specific_days_of_month">Specific days of the month</option>
                  <option value="days_per_month">Number of days per month</option>
                </select>
              </div>

              {form.task_days_mode === 'specific_days_of_week' && (
                <div className="field">
                  <label>Which days?</label>
                  <div className="custom-days-row">
                    {DAY_OF_WEEK_OPTIONS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`custom-day-chip ${form.task_days_weekly.includes(d.key) ? 'custom-day-chip-on' : ''}`}
                        onClick={() => toggleWeeklyDay(d.key)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
