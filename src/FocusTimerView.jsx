import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import ConfirmSheet from './ConfirmSheet'
import { getActiveFocusSession, setActiveFocusSession, clearActiveFocusSession, remainingSecondsFor } from './lib/focusSession'
import { fmtClock, minutesOn, lastDays, focusStreak, playChime } from './lib/focus'
import { toIso } from './lib/social'

const PRESETS = [15, 25, 45, 60]
const BREAKS = [5, 10]
const GOALS = [30, 60, 90, 120, 180]
const R = 92
const C = 2 * Math.PI * R

const hint = (m) => (/column|schema cache/i.test(m || '') ? `${m} — run focus-v2.sql in Supabase, then refresh.` : m)

function loadGoal() {
  try { return Number(localStorage.getItem('focus-daily-goal')) || 60 } catch { return 60 }
}

export default function FocusTimerView() {
  const [sessions, setSessions] = useState([])
  const [todos, setTodos] = useState([])
  const [dreams, setDreams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [minutes, setMinutes] = useState(25)
  const [custom, setCustom] = useState('')
  const [label, setLabel] = useState('')
  const [link, setLink] = useState('')
  const [active, setActive] = useState(null) // { mode, sessionId, totalSeconds, label, todoId, goalId }
  const [remaining, setRemaining] = useState(0)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(loadGoal)
  const timer = useRef(null)

  const fetchAll = useCallback(async () => {
    const [s, t, g] = await Promise.all([
      supabase.from('focus_sessions').select('*').eq('completed', true).order('completed_at', { ascending: false }).limit(500),
      supabase.from('todos').select('id,text').eq('completed', false).order('created_at', { ascending: false }).limit(100),
      supabase.from('goals').select('*').order('created_at', { ascending: false }),
    ])
    if (s.error) setError(s.error.message); else setSessions(s.data || [])
    setTodos(t.data || [])
    setDreams((g.data || []).filter((x) => !x.archived && x.status !== 'done'))
    setLoading(false)
  }, [])

  const finish = useCallback(async (stored) => {
    clearInterval(timer.current)
    clearActiveFocusSession()
    setActive(null); setPaused(false)
    playChime()
    const mins = Math.round(stored.totalSeconds / 60)
    if (stored.mode === 'break') { setDone({ mode: 'break', mins }); return }
    const { error: e1 } = await supabase.from('focus_sessions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', stored.sessionId)
    if (e1) setError(hint(e1.message))
    let dreamTitle = null
    if (stored.goalId) {
      const user_id = await getUserId()
      const g = dreams.find((x) => String(x.id) === String(stored.goalId))
      dreamTitle = g?.title || null
      const r = await supabase.from('goal_notes').insert({ user_id, goal_id: String(stored.goalId), body: `⏱ Focused for ${mins} min${stored.label ? ` — ${stored.label}` : ''}` })
      if (r.error) setError(`Focus saved, but couldn't add it to the dream's journal — ${hint(r.error.message)}`)
      if (g && 'touched_at' in g) await supabase.from('goals').update({ touched_at: new Date().toISOString() }).eq('id', g.id)
    }
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('⏱ Focus session complete', { body: `${mins} minutes done${stored.label ? ` — ${stored.label}` : ''}. Nice work!` })
    } catch { /* ignore */ }
    setDone({ mode: 'focus', mins, label: stored.label, todoId: stored.todoId, dreamTitle })
    fetchAll()
  }, [dreams, fetchAll])

  const tick = useCallback(() => {
    const stored = getActiveFocusSession()
    if (!stored) { clearInterval(timer.current); return }
    const left = remainingSecondsFor(stored)
    setRemaining(left)
    if (left <= 0 && !stored.paused) finish(stored)
  }, [finish])

  useEffect(() => { fetchAll() }, [fetchAll])

  // pick up a session that's already running (e.g. you left the page and came back)
  useEffect(() => {
    const stored = getActiveFocusSession()
    if (!stored || !stored.totalSeconds) { if (stored) clearActiveFocusSession(); return }
    setActive({ mode: stored.mode || 'focus', sessionId: stored.sessionId, totalSeconds: stored.totalSeconds, label: stored.label || '', todoId: stored.todoId, goalId: stored.goalId })
    setPaused(!!stored.paused)
    setRemaining(remainingSecondsFor(stored))
    if (!stored.paused) timer.current = setInterval(tick, 500)
    return () => clearInterval(timer.current)
  }, [tick])

  useEffect(() => {
    if (!active) { document.title = document.title.replace(/^⏱ [\d:]+ · /, ''); return }
    document.title = `⏱ ${fmtClock(remaining)} · ${document.title.replace(/^⏱ [\d:]+ · /, '')}`
  }, [active, remaining])

  async function start(mode, mins) {
    setError(null); setDone(null)
    const total = mins * 60
    let sessionId = null
    const todoId = link.startsWith('todo:') ? link.slice(5) : null
    const goalId = link.startsWith('goal:') ? link.slice(5) : null
    if (mode === 'focus') {
      const user_id = await getUserId()
      const row = { duration_minutes: mins, user_id }
      if (label.trim()) row.label = label.trim()
      if (todoId) row.todo_id = todoId
      if (goalId) row.goal_id = goalId
      const { data, error: e } = await supabase.from('focus_sessions').insert(row).select().single()
      if (e) { setError(hint(e.message)); return }
      sessionId = data.id
    }
    const stored = { mode, sessionId, totalSeconds: total, endTime: Date.now() + total * 1000, paused: false, remainingAtPause: null, label: mode === 'focus' ? label.trim() : '', todoId, goalId }
    setActiveFocusSession(stored)
    setActive({ mode, sessionId, totalSeconds: total, label: stored.label, todoId, goalId })
    setRemaining(total); setPaused(false)
    clearInterval(timer.current); timer.current = setInterval(tick, 500)
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ }
  }

  function togglePause() {
    const stored = getActiveFocusSession()
    if (!stored) return
    if (paused) {
      setActiveFocusSession({ ...stored, paused: false, endTime: Date.now() + stored.remainingAtPause * 1000, remainingAtPause: null })
      setPaused(false)
      clearInterval(timer.current); timer.current = setInterval(tick, 500)
    } else {
      clearInterval(timer.current)
      setActiveFocusSession({ ...stored, paused: true, remainingAtPause: remainingSecondsFor(stored) })
      setPaused(true)
    }
  }

  async function stop() {
    setConfirmStop(false)
    clearInterval(timer.current)
    if (active?.sessionId) {
      const { error: e } = await supabase.from('focus_sessions').delete().eq('id', active.sessionId)
      if (e) setError(hint(e.message))
    }
    clearActiveFocusSession(); setActive(null); setPaused(false)
  }

  async function completeTodo(id) {
    const { error: e } = await supabase.from('todos').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    if (e) { setError(e.message); return }
    setDone((d) => ({ ...d, todoDone: true }))
    fetchAll()
  }

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

  const total = active?.totalSeconds || (minutes * 60)
  const shown = active ? remaining : (custom ? (parseInt(custom, 10) || 25) * 60 : minutes * 60)
  const progress = active ? 1 - remaining / total : 0
  const customMins = custom ? Math.min(240, Math.max(1, parseInt(custom, 10) || 25)) : null
  const startMins = customMins || minutes

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Focus Timer</h1>
          <p className="view-subtitle cake-club-subtitle">⏱️ One thing at a time, babe.</p>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="calendar-card ft-card">
        <div className="ft-ring" role="timer" aria-live="off" aria-label={`${fmtClock(shown)} ${active ? 'remaining' : 'ready'}`}>
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={R} className="ft-track" />
            <circle cx="100" cy="100" r={R} className={`ft-arc ${active?.mode === 'break' ? 'ft-arc-break' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 100 100)" />
          </svg>
          <div className="ft-center">
            <span className="ft-clock">{fmtClock(shown)}</span>
            <span className="ft-sub">
              {active ? (paused ? 'paused' : active.mode === 'break' ? 'break time ☕' : active.label || 'focusing…') : 'ready when you are'}
            </span>
          </div>
        </div>

        {!active && (
          <>
            <div className="ft-presets">
              {PRESETS.map((m) => (
                <button key={m} className={`filter-pill ${!custom && minutes === m ? 'filter-pill-active' : ''}`} onClick={() => { setMinutes(m); setCustom('') }}>{m} min</button>
              ))}
              <input className="ft-custom" type="number" min="1" max="240" placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom minutes" />
            </div>
            <div className="ft-fields">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What are you focusing on?" maxLength={80} />
              <select value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link to a to-do or dream">
                <option value="">Not linked</option>
                {dreams.length > 0 && <optgroup label="🌱 Dreams">{dreams.map((g) => <option key={g.id} value={`goal:${g.id}`}>{g.cover_emoji || '🌱'} {g.title}</option>)}</optgroup>}
                {todos.length > 0 && <optgroup label="✅ To-dos">{todos.map((t) => <option key={t.id} value={`todo:${t.id}`}>{t.text}</option>)}</optgroup>}
              </select>
            </div>
            <button className="btn-primary ft-start" onClick={() => start('focus', startMins)}>Start {startMins} min</button>
          </>
        )}

        {active && (
          <div className="ft-controls">
            <button className="btn-primary" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
            <button className="btn-cancel" onClick={() => (active.mode === 'break' ? stop() : setConfirmStop(true))}>{active.mode === 'break' ? 'Skip break' : 'Stop'}</button>
          </div>
        )}

        {done && (
          <div className="ft-done">
            {done.mode === 'break' ? (
              <>
                <b>Break over ✨</b>
                <button className="btn-primary" onClick={() => { setDone(null); start('focus', startMins) }}>Start another {startMins} min</button>
              </>
            ) : (
              <>
                <b>🎉 {done.mins} minutes done{done.label ? ` — ${done.label}` : ''}</b>
                {done.dreamTitle && <span className="field-hint">Logged to “{done.dreamTitle}” on your Dream Board.</span>}
                <div className="ft-done-actions">
                  {BREAKS.map((m) => <button key={m} className="sc-chip-btn" onClick={() => start('break', m)}>☕ {m} min break</button>)}
                  {done.todoId && !done.todoDone && <button className="sc-chip-btn" onClick={() => completeTodo(done.todoId)}>✅ Mark to-do done</button>}
                  {done.todoDone && <span className="field-hint">To-do ticked ✅</span>}
                  <button className="sc-chip-btn" onClick={() => setDone(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
                    <span>{s.label || 'Focus session'}</span>
                    <small>{s.duration_minutes} min · {new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {confirmStop && <ConfirmSheet title="Stop this session?" body="It won't count towards your focus time." confirmLabel="Stop" danger onConfirm={stop} onCancel={() => setConfirmStop(false)} />}
    </div>
  )
}
