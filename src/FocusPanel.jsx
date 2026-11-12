import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import ConfirmSheet from './ConfirmSheet'
import { useFocus, usePomodoro } from './lib/useFocus'
import * as engine from './lib/focusEngine'
import { fmtClock, SOUNDS, getSound, setSound, playChime } from './lib/focus'

const PRESETS = [15, 25, 45, 60]
const BREAKS = [5, 10]
const R = 92
const C = 2 * Math.PI * R

export default function FocusPanel({ compact = false }) {
  const f = useFocus()
  const pomodoro = usePomodoro()
  const [minutes, setMinutes] = useState(25)
  const [custom, setCustom] = useState('')
  const [label, setLabel] = useState('')
  const [link, setLink] = useState('')
  const [todos, setTodos] = useState([])
  const [dreams, setDreams] = useState([])
  const [confirmStop, setConfirmStop] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [sound, setSoundState] = useState(getSound)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('todos').select('id,text').eq('completed', false).order('created_at', { ascending: false }).limit(100),
      supabase.from('goals').select('id,title,cover_emoji,status,archived').order('created_at', { ascending: false }),
    ]).then(([t, g]) => {
      if (!alive) return
      setTodos(t.data || [])
      setDreams((g.data || []).filter((x) => !x.archived && x.status !== 'done'))
    })
    return () => { alive = false }
  }, [])

  // "Focus on this" from a dream or to-do
  useEffect(() => {
    if (!f.prefill) return
    setLink(f.prefill.link || ''); setLabel(f.prefill.label || '')
    engine.clearPrefill()
  }, [f.prefill])

  useEffect(() => { setNote(''); setNoteSaved(false) }, [f.done?.sessionId])

  const active = f.active
  const customMins = custom ? Math.min(240, Math.max(1, parseInt(custom, 10) || 25)) : null
  const startMins = customMins || minutes
  const total = active?.totalSeconds || startMins * 60
  const shown = active ? f.remaining : startMins * 60
  const progress = active ? 1 - f.remaining / total : 0
  const done = f.done

  function begin() {
    const todoId = link.startsWith('todo:') ? link.slice(5) : null
    const goalId = link.startsWith('goal:') ? link.slice(5) : null
    engine.start({ mode: 'focus', mins: startMins, label: label.trim(), todoId, goalId })
  }

  async function saveNote() {
    if (await engine.saveNote(done, note)) setNoteSaved(true)
  }

  async function tickTodo() {
    const { error } = await engine.markTodoDone(done.todoId)
    if (error) return
    engine.dismissDone()
  }

  return (
    <div className={`ft-card ${compact ? 'ft-compact' : ''}`}>
      {f.error && <p className="error-msg" onClick={engine.clearError}>{f.error}</p>}
      <div className="ft-ring" role="timer" aria-label={`${fmtClock(shown)} ${active ? 'remaining' : 'ready'}`}>
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={R} className="ft-track" />
          <circle cx="100" cy="100" r={R} className={`ft-arc ${active?.mode === 'break' ? 'ft-arc-break' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 100 100)" />
        </svg>
        <div className="ft-center">
          <span className="ft-clock">{fmtClock(shown)}</span>
          <span className="ft-sub">{active ? (f.paused ? 'paused' : active.mode === 'break' ? 'break time ☕' : active.label || 'focusing…') : 'ready when you are'}</span>
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
          <button className="btn-primary ft-start" onClick={begin}>Start {startMins} min</button>
          {!compact && (
            <div className="ft-options">
              <button className={`sc-filter-btn ${pomodoro ? 'on' : ''}`} onClick={() => engine.setPomodoro(!pomodoro)} title="Auto-start a 5 min break after each session (15 min after every 4th), then the next session">🍅 Pomodoro cycle {pomodoro ? 'on' : 'off'}</button>
              <label className="ft-sound">🔔
                <select value={sound} onChange={(e) => { setSound(e.target.value); setSoundState(e.target.value); playChime(e.target.value) }} aria-label="Finish sound">
                  {SOUNDS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </>
      )}

      {active && (
        <div className="ft-controls">
          <button className="btn-primary" onClick={engine.togglePause}>{f.paused ? 'Resume' : 'Pause'}</button>
          <button className="btn-cancel" onClick={() => (active.mode === 'break' ? engine.stop() : setConfirmStop(true))}>{active.mode === 'break' ? 'Skip break' : 'Stop'}</button>
        </div>
      )}

      {done && (
        <div className="ft-done">
          {done.mode === 'break' ? (
            <>
              <b>Break over ✨</b>
              <button className="btn-primary" onClick={() => { engine.dismissDone(); begin() }}>Start another {startMins} min</button>
            </>
          ) : (
            <>
              <b>🎉 {done.mins} minutes done{done.label ? ` — ${done.label}` : ''}</b>
              {done.dreamTitle && <span className="field-hint">Logged to “{done.dreamTitle}” on your Dream Board.</span>}
              {done.autoBreak && <span className="field-hint">Break started automatically — {done.autoBreak} min.</span>}
              {!noteSaved ? (
                <div className="ft-note">
                  <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNote()} placeholder="Quick note — what did you get done?" maxLength={200} />
                  <button className="sc-chip-btn" onClick={saveNote} disabled={!note.trim()}>Save</button>
                </div>
              ) : <span className="field-hint">Note saved ✅</span>}
              <div className="ft-done-actions">
                {!done.autoBreak && BREAKS.map((m) => <button key={m} className="sc-chip-btn" onClick={() => engine.start({ mode: 'break', mins: m, next: { mins: done.mins, label: done.label, todoId: done.todoId, goalId: done.goalId } })}>☕ {m} min break</button>)}
                {done.todoId && <button className="sc-chip-btn" onClick={tickTodo}>✅ Mark to-do done</button>}
                <button className="sc-chip-btn" onClick={engine.dismissDone}>Close</button>
              </div>
            </>
          )}
        </div>
      )}

      {confirmStop && <ConfirmSheet title="Stop this session?" body="It won't count towards your focus time." confirmLabel="Stop" danger onConfirm={() => { setConfirmStop(false); engine.stop() }} onCancel={() => setConfirmStop(false)} />}
    </div>
  )
}
