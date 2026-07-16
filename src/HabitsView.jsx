import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function toISO(date) {
  return date.toISOString().split('T')[0]
}

function calcStreak(dateSet) {
  let streak = 0
  const cursor = new Date()
  if (!dateSet.has(toISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (dateSet.has(toISO(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

const CARD_COLORS = ['#EE93BE', '#B49BD9', '#7FAEDB', '#92CDBB']

export default function HabitsView() {
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newHabitName, setNewHabitName] = useState('')
  const [adding, setAdding] = useState(false)

  const todayStr = toISO(new Date())

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
      if (!grouped[log.habit_id]) grouped[log.habit_id] = new Set()
      grouped[log.habit_id].add(log.logged_date)
    }

    setHabits(habitsData)
    setLogsByHabit(grouped)
    setLoading(false)
  }

  async function handleAddHabit(e) {
    e.preventDefault()
    if (!newHabitName.trim()) return
    setAdding(true)
    const { error } = await supabase.from('habits').insert({ name: newHabitName.trim() })
    setAdding(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewHabitName('')
    fetchAll()
  }

  async function handleDeleteHabit(habitId) {
    if (!confirm('Delete this habit and all its check-ins?')) return
    const { error } = await supabase.from('habits').delete().eq('id', habitId)
    if (error) {
      setError(error.message)
      return
    }
    fetchAll()
  }

  async function toggleToday(habitId) {
    const doneToday = logsByHabit[habitId]?.has(todayStr)

    if (doneToday) {
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('logged_date', todayStr)
      if (error) {
        setError(error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habitId, logged_date: todayStr })
      if (error) {
        setError(error.message)
        return
      }
    }
    fetchAll()
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Habits</h1>
          <p className="view-subtitle">
            {habits.length === 0 ? 'Ready to build something? ✨' : `${habits.length} ${habits.length === 1 ? 'habit' : 'habits'} in the works`}
          </p>
        </div>
      </div>

      <form className="habit-add-row" onSubmit={handleAddHabit}>
        <input
          className="search-box habit-add-input"
          placeholder="Add a new habit, e.g. Drink water"
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={adding}>
          {adding ? 'Adding…' : '+ Add habit'}
        </button>
      </form>

      {loading && <p className="loading">Warming up your streaks… 🔥</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && habits.length === 0 && (
        <div className="empty-state">
          <h3>No habits yet — every streak starts at zero 🔥</h3>
          <p>Add the first thing you want to build daily.</p>
        </div>
      )}

      {!loading && !error && habits.length > 0 && (
        <div className="card-grid">
          {habits.map((h, i) => {
            const dateSet = logsByHabit[h.id] || new Set()
            const doneToday = dateSet.has(todayStr)
            const streak = calcStreak(dateSet)
            return (
              <div
                className="contact-card habit-card"
                key={h.id}
                style={{ borderTopColor: CARD_COLORS[i % CARD_COLORS.length] }}
              >
                <h3 className="contact-name">{h.name}</h3>
                <div className="streak-row">
                  <span className="streak-number">{streak > 0 ? '🔥' : ''}{streak}</span>
                  <span className="streak-label">day{streak === 1 ? '' : 's'} strong</span>
                </div>
                <div className="habit-actions">
                  <button
                    className={`btn-check ${doneToday ? 'btn-check-done' : ''}`}
                    onClick={() => toggleToday(h.id)}
                  >
                    {doneToday ? '✓ Nailed it today' : 'Mark done today'}
                  </button>
                  <button className="btn-delete-small" onClick={() => handleDeleteHabit(h.id)}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
