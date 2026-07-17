import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { getHiddenGlowupTabs, getWellnessGoals, setWellnessGoals } from './lib/localPrefs'

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

const TABS = [
  { key: 'today', label: '✨ Today' },
  { key: 'cycle', label: '🌸 Cycle' },
  { key: 'summary', label: '📊 Summary' },
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

function mostCommon(arr) {
  if (arr.length === 0) return null
  const counts = {}
  arr.forEach((v) => { counts[v] = (counts[v] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function average(nums) {
  const valid = nums.filter((n) => n != null && !isNaN(n))
  if (valid.length === 0) return 0
  return valid.reduce((s, n) => s + Number(n), 0) / valid.length
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
  const [editingGoals, setEditingGoals] = useState(false)
  const [goalInputs, setGoalInputs] = useState(getWellnessGoals())

  const hiddenTabs = getHiddenGlowupTabs()
  const visibleTabs = TABS.filter((t) => !hiddenTabs.includes(t.key))
  const [tab, setTab] = useState(() => {
    const firstVisible = visibleTabs[0]
    return firstVisible ? firstVisible.key : 'today'
  })

  const [monthLogs, setMonthLogs] = useState([])
  const [yearLogs, setYearLogs] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    if (tab === 'summary') fetchSummary()
  }, [tab])

  useEffect(() => {
    if (hiddenTabs.includes(tab) && visibleTabs.length > 0) {
      setTab(visibleTabs[0].key)
    }
  }, [tab])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const user_id = await getUserId()
    const date = todayStr()

    let { data: existing, error: fetchErr } = await supabase
      .from('wellness_logs').select('*').eq('log_date', date).maybeSingle()
    if (fetchErr) { setError(fetchErr.message); setLoading(false); return }
    if (!existing) {
      const goals = getWellnessGoals()
      const { data: created, error: createErr } = await supabase
        .from('wellness_logs')
        .insert({ log_date: date, user_id, water_goal: goals.water, calories_goal: goals.calories, steps_goal: goals.steps })
        .select().single()
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

  async function fetchSummary() {
    setSummaryLoading(true)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

    const { data: monthData } = await supabase
      .from('wellness_logs').select('*').gte('log_date', monthStart).order('log_date', { ascending: true })
    const { data: yearData } = await supabase
      .from('wellness_logs').select('*').gte('log_date', yearStart).order('log_date', { ascending: true })

    setMonthLogs(monthData || [])
    setYearLogs(yearData || [])
    setSummaryLoading(false)
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

  async function saveGoals() {
    const water = parseInt(goalInputs.water, 10) || 8
    const calories = parseInt(goalInputs.calories, 10) || 1900
    const steps = parseInt(goalInputs.steps, 10) || 10000
    setWellnessGoals({ water, calories, steps })
    await updateLog({ water_goal: water, calories_goal: calories, steps_goal: steps })
    setEditingGoals(false)
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

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' })
  const thisYear = new Date().getFullYear()

  function summaryStats(logs) {
    const avgWater = average(logs.map((l) => l.water_glasses))
    const avgSteps = average(logs.map((l) => l.steps))
    const totalMovement = logs.reduce((s, l) => s + Number(l.movement_mins || 0), 0)
    const avgSleep = average(logs.map((l) => l.sleep_hours))
    const daysHydrated = logs.filter((l) => (l.water_glasses || 0) >= (l.water_goal || 8)).length
    const topMood = mostCommon(logs.map((l) => l.mood).filter(Boolean))
    return { avgWater, avgSteps, totalMovement, avgSleep, daysHydrated, topMood, totalDays: logs.length }
  }

  const monthStats = summaryStats(monthLogs)
  const yearStats = summaryStats(yearLogs)

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Glow Up Hub</h1>
          <p className="view-subtitle cake-club-subtitle">Mind, body and main character energy. ✨</p>
        </div>
      </div>

      <div className="filter-row">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={`filter-pill ${tab === t.key ? 'filter-pill-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          <div className="calendar-card momentum-card hero-glow-score">
            <p className="module-group-label">🌿 TODAY'S GLOW SCORE</p>
            <div className="momentum-track">
              <div className="momentum-fill" style={{ width: `${scorePct}%` }} />
            </div>
            <p className="momentum-caption">{scorePct}% — {scoreItems.filter((s) => s.done).length} of {scoreItems.length} glowing</p>
            <div className="glow-score-chips">
              {scoreItems.map((s) => (
                <span key={s.key} className={`glow-score-chip ${s.done ? 'glow-score-chip-on' : ''}`}>
                  {s.done ? '✓' : '·'} {s.key}
                </span>
              ))}
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
                <span className="booknook-stat-label">💪 Protein</span>
                <span className="booknook-stat-value booknook-stat-small">{log.protein_g || 0}g</span>
              </div>
              <div className="booknook-stat">
                <span className="booknook-stat-label">🌾 Fibre</span>
                <span className="booknook-stat-value booknook-stat-small">{log.fiber_g || 0}g</span>
              </div>
              <div className="booknook-stat">
                <span className="booknook-stat-label">💖 Mood</span>
                <select value={log.mood || ''} onChange={(e) => updateLog({ mood: e.target.value })}>
                  <option value="">Pick a mood…</option>
                  {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {editingGoals ? (
              <div className="field-row" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>💧 Water goal</label>
                  <input
                    type="number"
                    value={goalInputs.water}
                    onChange={(e) => setGoalInputs({ ...goalInputs, water: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>👟 Steps goal</label>
                  <input
                    type="number"
                    value={goalInputs.steps}
                    onChange={(e) => setGoalInputs({ ...goalInputs, steps: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>🍓 Calorie goal</label>
                  <input
                    type="number"
                    value={goalInputs.calories}
                    onChange={(e) => setGoalInputs({ ...goalInputs, calories: e.target.value })}
                  />
                </div>
              </div>
            ) : null}
            <div className="log-value-row" style={{ marginTop: editingGoals ? 10 : 14 }}>
              {editingGoals ? (
                <>
                  <button className="btn-cancel" onClick={() => { setEditingGoals(false); setGoalInputs(getWellnessGoals()) }}>Cancel</button>
                  <button className="btn-check log-value-btn" onClick={saveGoals}>Save goals</button>
                </>
              ) : (
                <button className="weather-location-link" onClick={() => setEditingGoals(true)}>🎯 Edit your goals</button>
              )}
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

        </>
      )}

      {tab === 'cycle' && cycleLog && (
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
      )}

      {tab === 'summary' && (
        <>
          {summaryLoading && <p className="loading">Crunching your glow stats… 📊✨</p>}
          {!summaryLoading && (
            <>
              <div className="upnext-section">
                <p className="module-group-label">{monthName.toUpperCase()} SUMMARY</p>
                <div className="calendar-card goals-summary-card">
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">💧 Avg water/day</span>
                    <span className="goals-summary-value">{monthStats.avgWater.toFixed(1)} glasses</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">👟 Avg steps/day</span>
                    <span className="goals-summary-value">{Math.round(monthStats.avgSteps).toLocaleString()}</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">🔥 Total movement</span>
                    <span className="goals-summary-value">{monthStats.totalMovement} mins</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">😴 Avg sleep</span>
                    <span className="goals-summary-value">{monthStats.avgSleep.toFixed(1)}h</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">✨ Days hydrated</span>
                    <span className="goals-summary-value">{monthStats.daysHydrated} / {monthStats.totalDays}</span>
                  </div>
                  {monthStats.topMood && (
                    <div className="goals-summary-row">
                      <span className="goals-summary-label">💖 Top mood</span>
                      <span className="goals-summary-value">{monthStats.topMood}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="upnext-section">
                <p className="module-group-label">{thisYear} SUMMARY</p>
                <div className="calendar-card goals-summary-card">
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">💧 Avg water/day</span>
                    <span className="goals-summary-value">{yearStats.avgWater.toFixed(1)} glasses</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">👟 Avg steps/day</span>
                    <span className="goals-summary-value">{Math.round(yearStats.avgSteps).toLocaleString()}</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">🔥 Total movement</span>
                    <span className="goals-summary-value">{yearStats.totalMovement.toLocaleString()} mins</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">😴 Avg sleep</span>
                    <span className="goals-summary-value">{yearStats.avgSleep.toFixed(1)}h</span>
                  </div>
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">✨ Days hydrated</span>
                    <span className="goals-summary-value">{yearStats.daysHydrated} / {yearStats.totalDays}</span>
                  </div>
                  {yearStats.topMood && (
                    <div className="goals-summary-row">
                      <span className="goals-summary-label">💖 Top mood</span>
                      <span className="goals-summary-value">{yearStats.topMood}</span>
                    </div>
                  )}
                </div>
              </div>

              {yearStats.totalDays === 0 && (
                <div className="empty-state">
                  <h3>Nothing logged yet ✨</h3>
                  <p>Log a few days on the Today tab and your summary will glow up right here.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
