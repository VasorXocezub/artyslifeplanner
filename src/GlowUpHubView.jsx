import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const MOODS = [
  '👑 Main Character', '✨ Glowing', '🌸 Soft & Happy', '💖 Loved Up', '🔥 Unstoppable',
  '💼 CEO Energy', '🌈 Optimistic', '🌿 At Peace', '☁️ Existing', '🥱 Running on Vibes',
  '😴 Need a Nap', '🫠 Barely Holding It Together', '🌧️ In My Feels', '😵 Chaos Mode',
  '😬 Stressy Bestie', '💔 Tender Heart Day',
]

const STEP_MILESTONES = [
  { at: 10000, label: '👑 Walking Queen' },
  { at: 8000, label: '💖 Glowing' },
  { at: 5000, label: '✨ Moving & Grooving' },
  { at: 2000, label: '🌱 Warming up' },
]

const CYCLE_PHASES = ['🌱 Follicular Phase', '✨ Ovulation', '🌙 Luteal Phase', '🌹 Period']
const SYMPTOMS = [
  '😣 Cramps', '🤕 Headache', '😴 Fatigue', '🍫 Cravings', '💢 Bloating', '😬 Mood Swings',
  '🤢 Nausea', '🩹 Back Pain', '💔 Tender Breasts', '🌪️ Brain Fog', '😰 Anxiety',
  '😡 Irritable', '🥺 Emotional', '🤍 No Symptoms',
]
const ENERGY_LEVELS = ['🚀 Unstoppable', '✨ High Energy', '😊 Good Energy', '🌸 Steady', '☁️ Low Energy', '😴 Tired', '🛌 Couch Potato Mode', '🫠 Barely Functioning']
const FLOW_LEVELS = ['🤍 Spotting', '🌸 Light', '🌹 Medium', '❤️ Heavy', '🌊 Very Heavy']
const ACTIVITIES = ['🚶 Walk', '🧘 Stretch / Yoga', '💃 Dance', '🏋️ Strength Training', '🏃 Cardio', '🛏️ Rest Day', '🌿 Gentle Movement']

const CARE_ITEMS = [
  { key: 'care_water', label: 'Drank water' },
  { key: 'care_outside', label: 'Went outside' },
  { key: 'care_moved', label: 'Moved body' },
  { key: 'care_vitamins', label: 'Took vitamins' },
  { key: 'care_read', label: 'Read 10 mins' },
]

const WORKOUT_ITEMS = [
  { key: 'workout_walk', label: 'Walk' },
  { key: 'workout_gym', label: 'Gym' },
  { key: 'workout_stretch', label: 'Stretch' },
  { key: 'workout_dance', label: 'Dance' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function hydrationMessage(glasses, goal) {
  if (glasses >= goal) return 'Hydrated queen ✨'
  if (glasses >= goal / 2) return 'One more sip bestie 💖'
  return 'Future skin says thanks 🌸'
}

function stepMilestone(steps) {
  return STEP_MILESTONES.find((m) => steps >= m.at) || null
}

function toggleSymptom(current, symptom) {
  const arr = Array.isArray(current) ? current : []
  return arr.includes(symptom) ? arr.filter((s) => s !== symptom) : [...arr, symptom]
}

export default function GlowUpHubView() {
  const [log, setLog] = useState(null)
  const [cycleLog, setCycleLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stepsInput, setStepsInput] = useState('')
  const [movementInput, setMovementInput] = useState('')
  const [caloriesInput, setCaloriesInput] = useState('')
  const [proteinInput, setProteinInput] = useState('')
  const [fiberInput, setFiberInput] = useState('')
  const [sleepInput, setSleepInput] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const user_id = await getUserId()
    const date = todayStr()

    let { data: existing, error: fetchErr } = await supabase
      .from('wellness_logs').select('*').eq('log_date', date).maybeSingle()
    if (fetchErr) { setError(fetchErr.message); setLoading(false); return }
    if (!existing) {
      const { data: created, error: createErr } = await supabase
        .from('wellness_logs').insert({ log_date: date, user_id }).select().single()
      if (createErr) { setError(createErr.message); setLoading(false); return }
      existing = created
    }
    setLog(existing)
    setStepsInput(String(existing.steps || 0))
    setMovementInput(String(existing.movement_mins || 0))
    setCaloriesInput(String(existing.calories || 0))
    setProteinInput(String(existing.protein_g || 0))
    setFiberInput(String(existing.fiber_g || 0))
    setSleepInput(existing.sleep_hours != null ? String(existing.sleep_hours) : '')

    let { data: existingCycle } = await supabase
      .from('cycle_logs').select('*').eq('log_date', date).maybeSingle()
    if (!existingCycle) {
      const { data: createdCycle } = await supabase
        .from('cycle_logs').insert({ log_date: date, user_id }).select().single()
      existingCycle = createdCycle
    }
    setCycleLog(existingCycle)
    setLoading(false)
  }

  async function updateLog(fields) {
    const { data, error } = await supabase.from('wellness_logs').update(fields).eq('id', log.id).select().single()
    if (error) { setError(error.message); return }
    setLog(data)
  }

  async function updateCycle(fields) {
    const { data, error } = await supabase.from('cycle_logs').update(fields).eq('id', cycleLog.id).select().single()
    if (error) { setError(error.message); return }
    setCycleLog(data)
  }

  if (loading) return <p className="loading">Drawing you a bath… 🛁✨</p>
  if (error) return <p className="error-msg">{error}</p>
  if (!log) return null

  const water = log.water_glasses || 0
  const waterGoal = log.water_goal || 8
  const milestone = stepMilestone(log.steps || 0)
  const stepsPct = Math.min(100, Math.round(((log.steps || 0) / (log.steps_goal || 10000)) * 100))
  const sleepH = Math.floor(Number(log.sleep_hours || 0))
  const sleepM = Math.round((Number(log.sleep_hours || 0) - sleepH) * 60)

  const scoreItems = [
    { key: 'Hydration', done: water >= waterGoal },
    { key: 'Movement', done: (log.movement_mins || 0) >= 20 },
    { key: 'Sleep', done: Number(log.sleep_hours || 0) >= 7 },
    { key: 'Mood', done: !!log.mood },
  ]
  const scorePct = Math.round((scoreItems.filter((s) => s.done).length / scoreItems.length) * 100)

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Glow Up Hub</h1>
          <p className="view-subtitle cake-club-subtitle">Hydrated, moved, glowing. ✨</p>
        </div>
      </div>

      <div className="calendar-card booknook-progress-card">
        <p className="module-group-label">TODAY'S WELLNESS</p>
        <div className="booknook-stats-grid">
          <div className="booknook-stat">
            <span className="booknook-stat-label">💧 Water</span>
            <span className="booknook-stat-value booknook-stat-small">{water} / {waterGoal} glasses</span>
          </div>
          <div className="booknook-stat">
            <span className="booknook-stat-label">👟 Steps</span>
            <span className="booknook-stat-value booknook-stat-small">{(log.steps || 0).toLocaleString()} / {(log.steps_goal || 10000).toLocaleString()}</span>
          </div>
          <div className="booknook-stat">
            <span className="booknook-stat-label">🔥 Movement</span>
            <span className="booknook-stat-value booknook-stat-small">{log.movement_mins || 0} mins</span>
          </div>
          <div className="booknook-stat">
            <span className="booknook-stat-label">🍓 Calories</span>
            <span className="booknook-stat-value booknook-stat-small">{log.calories || 0} / {log.calories_goal || 1900}</span>
          </div>
          <div className="booknook-stat">
            <span className="booknook-stat-label">😴 Sleep</span>
            <span className="booknook-stat-value booknook-stat-small">{sleepH}h {sleepM}m</span>
          </div>
          <div className="booknook-stat">
            <span className="booknook-stat-label">💖 Mood</span>
            <select value={log.mood || ''} onChange={(e) => updateLog({ mood: e.target.value })}>
              <option value="">Pick a mood…</option>
              {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="upnext-section">
        <p className="module-group-label">💧 HYDRATION</p>
        <div className="calendar-card">
          <p className="water-glasses-row">
            {Array.from({ length: waterGoal }, (_, i) => (
              <span key={i}>{i < water ? '💧' : '○'}</span>
            ))}
          </p>
          <p className="progress-label">{water} / {waterGoal} glasses</p>
          <p className="momentum-caption">{hydrationMessage(water, waterGoal)}</p>
          <div className="log-value-row">
            <button className="btn-delete-small" onClick={() => updateLog({ water_glasses: Math.max(0, water - 1) })}>− Glass</button>
            <button className="btn-check log-value-btn" onClick={() => updateLog({ water_glasses: water + 1 })}>+ Glass</button>
          </div>
        </div>
      </div>

      <div className="upnext-section">
        <p className="module-group-label">👟 STEPS</p>
        <div className="calendar-card">
          <p className="progress-label">👟 {(log.steps || 0).toLocaleString()} steps — {stepsPct}% complete</p>
          <div className="progress-row">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${stepsPct}%`, background: '#1E5C57' }} />
            </div>
          </div>
          {milestone && <p className="momentum-caption">{milestone.label}</p>}
          <div className="log-value-row">
            <input
              type="number"
              className="log-value-input"
              placeholder="Update steps"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateLog({ steps: parseInt(stepsInput, 10) || 0 })}
            />
            <button className="btn-check log-value-btn" onClick={() => updateLog({ steps: parseInt(stepsInput, 10) || 0 })}>Update</button>
          </div>
        </div>
      </div>

      <div className="upnext-section">
        <p className="module-group-label">🏋️ TODAY'S MOVEMENT</p>
        <div className="calendar-card">
          <div className="settings-module-list">
            {WORKOUT_ITEMS.map((w) => {
              const isOn = !!log[w.key]
              return (
                <button
                  key={w.key}
                  type="button"
                  className={`settings-module-row ${isOn ? '' : 'settings-module-row-off'}`}
                  onClick={() => updateLog({ [w.key]: !isOn })}
                >
                  <span className="settings-module-label">{w.label}</span>
                  <span className={`settings-toggle ${isOn ? 'settings-toggle-on' : ''}`}>
                    <span className="settings-toggle-knob" />
                  </span>
                </button>
              )
            })}
          </div>
          <p className="progress-label" style={{ marginTop: 12 }}>🔥 {log.movement_mins || 0} mins moved today</p>
          <div className="log-value-row">
            <input
              type="number"
              className="log-value-input"
              placeholder="Total mins moved"
              value={movementInput}
              onChange={(e) => setMovementInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateLog({ movement_mins: parseInt(movementInput, 10) || 0 })}
            />
            <button className="btn-check log-value-btn" onClick={() => updateLog({ movement_mins: parseInt(movementInput, 10) || 0 })}>Update</button>
          </div>
        </div>
      </div>

      <div className="upnext-section">
        <p className="module-group-label">🍓 NUTRITION</p>
        <p className="field-hint">Keep it simple.</p>
        <div className="calendar-card">
          <p className="progress-label">Calories: {log.calories || 0} / {log.calories_goal || 1900}</p>
          <div className="log-value-row">
            <input
              type="number"
              className="log-value-input"
              placeholder="Calories"
              value={caloriesInput}
              onChange={(e) => setCaloriesInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateLog({ calories: parseInt(caloriesInput, 10) || 0 })}
            />
            <button className="btn-check log-value-btn" onClick={() => updateLog({ calories: parseInt(caloriesInput, 10) || 0 })}>Update</button>
          </div>
          <div className="field-row" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Protein (g)</label>
              <div className="log-value-row">
                <input type="number" className="log-value-input" value={proteinInput} onChange={(e) => setProteinInput(e.target.value)} />
                <button className="btn-check log-value-btn" onClick={() => updateLog({ protein_g: parseInt(proteinInput, 10) || 0 })}>Set</button>
              </div>
            </div>
            <div className="field">
              <label>Fibre (g)</label>
              <div className="log-value-row">
                <input type="number" className="log-value-input" value={fiberInput} onChange={(e) => setFiberInput(e.target.value)} />
                <button className="btn-check log-value-btn" onClick={() => updateLog({ fiber_g: parseInt(fiberInput, 10) || 0 })}>Set</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="upnext-section">
        <p className="module-group-label">😴 SLEEP</p>
        <div className="calendar-card">
          <p className="progress-label">{sleepH}h {sleepM}m last night</p>
          <div className="log-value-row">
            <input
              type="number"
              step="0.25"
              className="log-value-input"
              placeholder="Hours slept, e.g. 7.75"
              value={sleepInput}
              onChange={(e) => setSleepInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateLog({ sleep_hours: parseFloat(sleepInput) || 0 })}
            />
            <button className="btn-check log-value-btn" onClick={() => updateLog({ sleep_hours: parseFloat(sleepInput) || 0 })}>Update</button>
          </div>
        </div>
      </div>

      <div className="upnext-section">
        <p className="module-group-label">💖 SELF-CARE BINGO</p>
        <div className="calendar-card">
          <div className="settings-module-list">
            {CARE_ITEMS.map((c) => {
              const isOn = !!log[c.key]
              return (
                <button
                  key={c.key}
                  type="button"
                  className={`settings-module-row ${isOn ? '' : 'settings-module-row-off'}`}
                  onClick={() => updateLog({ [c.key]: !isOn })}
                >
                  <span className="settings-module-label">{isOn ? '☑' : '☐'} {c.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="upnext-section">
        <p className="module-group-label">🌿 TODAY'S GLOW SCORE</p>
        <div className="calendar-card momentum-card">
          {scoreItems.map((s) => (
            <div className="goals-summary-row" key={s.key}>
              <span className="goals-summary-label">{s.key}</span>
              <span className="goals-summary-value">{s.done ? '✓' : '—'}</span>
            </div>
          ))}
          <div className="momentum-track" style={{ marginTop: 12 }}>
            <div className="momentum-fill" style={{ width: `${scorePct}%` }} />
          </div>
          <p className="momentum-caption">{scorePct}%</p>
        </div>
      </div>

      {cycleLog && (
        <div className="upnext-section">
          <p className="module-group-label">🌸 CYCLE TRACKER</p>
          <div className="calendar-card">
            <div className="field-row">
              <div className="field">
                <label>🌸 Phase</label>
                <select value={cycleLog.phase || ''} onChange={(e) => updateCycle({ phase: e.target.value })}>
                  <option value="">Select…</option>
                  {CYCLE_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field">
                <label>⚡ Energy Level</label>
                <select value={cycleLog.energy_level || ''} onChange={(e) => updateCycle({ energy_level: e.target.value })}>
                  <option value="">Select…</option>
                  {ENERGY_LEVELS.map((e_) => <option key={e_} value={e_}>{e_}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>💧 Flow</label>
                <select value={cycleLog.flow || ''} onChange={(e) => updateCycle({ flow: e.target.value })}>
                  <option value="">Select…</option>
                  {FLOW_LEVELS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="field">
                <label>🧘 Recommended Activity</label>
                <select value={cycleLog.recommended_activity || ''} onChange={(e) => updateCycle({ recommended_activity: e.target.value })}>
                  <option value="">Select…</option>
                  {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>💖 Symptoms</label>
              <div className="settings-module-list">
                {SYMPTOMS.map((s) => {
                  const isOn = (cycleLog.symptoms || []).includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`settings-module-row ${isOn ? '' : 'settings-module-row-off'}`}
                      onClick={() => updateCycle({ symptoms: toggleSymptom(cycleLog.symptoms, s) })}
                    >
                      <span className="settings-module-label">{s}</span>
                      <span className={`settings-toggle ${isOn ? 'settings-toggle-on' : ''}`}>
                        <span className="settings-toggle-knob" />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
