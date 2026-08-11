import { useEffect, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const DURATIONS = [
  { key: 15, label: '15 min' },
  { key: 25, label: '25 min' },
  { key: 45, label: '45 min' },
  { key: 60, label: '60 min' },
]

const STAGES = [
  { at: 0, emoji: '🌰', label: 'Planting a seed…' },
  { at: 0.1, emoji: '🌱', label: 'A sprout appears' },
  { at: 0.3, emoji: '🌿', label: 'Growing steadily' },
  { at: 0.6, emoji: '🪴', label: 'Filling out nicely' },
  { at: 0.9, emoji: '🌳', label: 'Almost fully grown' },
]

function currentStage(pct) {
  let stage = STAGES[0]
  for (const s of STAGES) {
    if (pct >= s.at) stage = s
  }
  return stage
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function FocusTimerView() {
  const [garden, setGarden] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDuration, setSelectedDuration] = useState(25)
  const [customMinutes, setCustomMinutes] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [wilted, setWilted] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    fetchGarden()
  }, [])

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  async function fetchGarden() {
    setLoading(true)
    const { data } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('completed', true)
      .order('completed_at', { ascending: false })
    setGarden(data || [])
    setLoading(false)
  }

  async function startSession() {
    const minutes = customMinutes ? parseInt(customMinutes, 10) || 25 : selectedDuration
    const user_id = await getUserId()
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({ duration_minutes: minutes, user_id })
      .select().single()
    if (error) return

    setSessionId(data.id)
    setTotalSeconds(minutes * 60)
    setRemainingSeconds(minutes * 60)
    setRunning(true)
    setWilted(false)
    setJustCompleted(false)

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          finishSession(true, data.id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function finishSession(success, id) {
    clearInterval(intervalRef.current)
    setRunning(false)
    const targetId = id || sessionId
    if (success) {
      await supabase.from('focus_sessions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', targetId)
      setJustCompleted(true)
      fetchGarden()
    } else {
      await supabase.from('focus_sessions').delete().eq('id', targetId)
      setWilted(true)
    }
  }

  function giveUp() {
    if (!confirm("Leaving now will wilt your plant — this session won't count. Are you sure?")) return
    finishSession(false)
  }

  function resetToStart() {
    setSessionId(null)
    setWilted(false)
    setJustCompleted(false)
    setRemainingSeconds(0)
    setTotalSeconds(0)
  }

  const elapsed = totalSeconds - remainingSeconds
  const pct = totalSeconds > 0 ? elapsed / totalSeconds : 0
  const stage = currentStage(pct)

  const totalMinutesFocused = garden.reduce((sum, g) => sum + g.duration_minutes, 0)

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Focus Timer</h1>
          <p className="view-subtitle cake-club-subtitle">🌱 Stay focused, watch it grow.</p>
        </div>
      </div>

      {!sessionId && !justCompleted && !wilted && (
        <div className="calendar-card focus-timer-card">
          <p className="cake-section-heading">🌰 How long are you focusing?</p>
          <div className="filter-row">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                className={`filter-pill ${selectedDuration === d.key && !customMinutes ? 'filter-pill-active' : ''}`}
                onClick={() => { setSelectedDuration(d.key); setCustomMinutes('') }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="log-value-row" style={{ marginTop: 10 }}>
            <input
              type="number"
              className="log-value-input"
              placeholder="Custom minutes"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
            />
          </div>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={startSession}>
            🌱 Start focusing
          </button>
          <p className="field-hint" style={{ marginTop: 10 }}>
            Stay on this page while you focus — leaving early wilts your plant.
          </p>
        </div>
      )}

      {sessionId && running && (
        <div className="calendar-card focus-timer-card focus-timer-active">
          <span className="focus-plant-emoji" style={{ transform: `scale(${0.6 + pct * 0.7})` }}>
            {stage.emoji}
          </span>
          <p className="focus-plant-stage">{stage.label}</p>
          <p className="focus-timer-clock">{formatTime(remainingSeconds)}</p>
          <div className="momentum-track">
            <div className="momentum-fill" style={{ width: `${pct * 100}%` }} />
          </div>
          <button className="btn-cancel" style={{ marginTop: 16 }} onClick={giveUp}>
            Give up
          </button>
        </div>
      )}

      {justCompleted && (
        <div className="calendar-card focus-timer-card">
          <span className="focus-plant-emoji">🌳</span>
          <p className="cake-section-heading">Fully grown! Nice work. 🎉</p>
          <p className="field-hint">Your plant just joined the garden below.</p>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={resetToStart}>
            Start another session
          </button>
        </div>
      )}

      {wilted && (
        <div className="calendar-card focus-timer-card">
          <span className="focus-plant-emoji" style={{ opacity: 0.5 }}>🥀</span>
          <p className="cake-section-heading">That one wilted.</p>
          <p className="field-hint">No worries — every focus session is a fresh start.</p>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={resetToStart}>
            Try again
          </button>
        </div>
      )}

      {!loading && garden.length > 0 && (
        <div className="upnext-section">
          <div className="cake-stats-row" style={{ marginBottom: 18 }}>
            <div className="cake-stat-card">
              <span className="cake-stat-icon">🌳</span>
              <span className="cake-stat-value">{garden.length}</span>
              <span className="cake-stat-label">Plants grown</span>
            </div>
            <div className="cake-stat-card">
              <span className="cake-stat-icon">⏱️</span>
              <span className="cake-stat-value">{Math.round(totalMinutesFocused / 60 * 10) / 10}h</span>
              <span className="cake-stat-label">Total focus</span>
            </div>
          </div>
          <p className="cake-section-heading">🌲 Your Garden</p>
          <div className="focus-garden-grid">
            {garden.map((g) => (
              <div className="focus-garden-plant" key={g.id} title={`${g.duration_minutes} min · ${new Date(g.completed_at).toLocaleDateString()}`}>
                🌳
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
