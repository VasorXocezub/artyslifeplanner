import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import FocusPanel from './FocusPanel'
import { minutesOn, lastDays, focusStreak } from './lib/focus'
import { toIso } from './lib/social'

const GOALS = [30, 60, 90, 120, 180]

function loadGoal() {
  try { return Number(localStorage.getItem('focus-daily-goal')) || 60 } catch { return 60 }
}

export default function FocusTimerView() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dailyGoal, setDailyGoal] = useState(loadGoal)

  const fetchSessions = useCallback(async () => {
    const { data, error: e } = await supabase.from('focus_sessions').select('*').eq('completed', true).order('completed_at', { ascending: false }).limit(500)
    if (e) setError(e.message); else { setSessions(data || []); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSessions()
    window.addEventListener('focus-session-saved', fetchSessions)
    return () => window.removeEventListener('focus-session-saved', fetchSessions)
  }, [fetchSessions])

  function pickGoal(v) {
    setDailyGoal(v)
    try { localStorage.setItem('focus-daily-goal', String(v)) } catch { /* ignore */ }
  }

  const today = toIso(new Date())
  const todayMin = useMemo(() => minutesOn(sessions, today), [sessions, today])
  const week = useMemo(() => lastDays(sessions, 7), [sessions])
  const weekMin = week.reduce((n, d) => n + d.minutes, 0)
  const streak = useMemo(() => focusStreak(sessions), [sessions])
  const maxDay = Math.max(30, ...week.map((d) => d.minutes))
  const goalPct = Math.min(100, Math.round((todayMin / dailyGoal) * 100))

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Focus Timer</h1>
          <p className="view-subtitle cake-club-subtitle">⏱️ One thing at a time, babe.</p>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="calendar-card"><FocusPanel /></div>

      {!loading && (
        <>
          <div className="ft-stats">
            <div className="total-card"><span className="total-label">Today</span><span className="total-value">{todayMin} min</span></div>
            <div className="total-card"><span className="total-label">This week</span><span className="total-value">{weekMin} min</span></div>
            <div className="total-card"><span className="total-label">Streak</span><span className="total-value">{streak} {streak === 1 ? 'day' : 'days'}</span></div>
          </div>

          <div className="calendar-card ft-week">
            <div className="ft-goal-row">
              <span className="module-group-label">Daily goal</span>
              <select value={dailyGoal} onChange={(e) => pickGoal(Number(e.target.value))} aria-label="Daily focus goal">
                {GOALS.map((g) => <option key={g} value={g}>{g} min</option>)}
              </select>
            </div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${goalPct}%`, background: 'var(--accent-deep)' }} /></div>
            <p className="field-hint">{todayMin >= dailyGoal ? 'Goal smashed 👑' : `${dailyGoal - todayMin} min to go today`}</p>
            <div className="ft-bars" aria-label="Minutes focused in the last 7 days">
              {week.map((d) => (
                <div className="ft-bar" key={d.date} title={`${d.minutes} min`}>
                  <span className="ft-bar-fill" style={{ height: `${Math.max(4, (d.minutes / maxDay) * 100)}%`, opacity: d.minutes ? 1 : 0.25 }} />
                  <small>{d.label.slice(0, 2)}</small>
                </div>
              ))}
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="calendar-card">
              <p className="module-group-label">Recent sessions</p>
              <ul className="ft-recent">
                {sessions.slice(0, 8).map((s) => (
                  <li key={s.id}>
                    <span>{s.label || 'Focus session'}{s.note && <em className="ft-recent-note"> — {s.note}</em>}</span>
                    <small>{s.duration_minutes} min · {new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
