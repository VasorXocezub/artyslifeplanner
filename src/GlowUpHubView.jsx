import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { getHiddenGlowupTabs, getWellnessGoals, setWellnessGoals, getHiddenWellnessMetrics, setHiddenWellnessMetrics } from './lib/localPrefs'

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

const CYCLE_ERAS = {
  period: {
    key: 'period', icon: '🩸', name: 'Period Era', caption: '💌 Please lower your expectations of me.',
    description: "Your body is resting, recharging, and asking for a little extra kindness. This is your permission slip to slow down, wear the comfy clothes, cancel non-essential plans, and prioritize rest. The goal isn't productivity—it's recovery.",
    vibes: ['🛋️ Blanket Burrito', '🍫 Powered by Chocolate', '💌 Do Not Perceive Me', '🌙 Cozy Goblin Mode', '🦥 Moving at Government Speed'],
    bestFor: ['Reading', 'Journaling', 'Gentle walks', 'Comfort food', 'Early nights', 'Existing softly'],
    reminder: '🌸 Resting is productive too.',
    energy: 'Low', color: '#D9A8B8',
    summaryTagline: 'Operating on vibes, snacks, and survival.',
  },
  fresh_start: {
    key: 'fresh_start', icon: '🌱', name: 'Fresh Start Era', caption: '✨ Suddenly we have hobbies again.',
    description: "Energy is returning, motivation is rising, and you're starting to feel like yourself again. This is a great time to begin new habits, tackle projects, make plans, and get back into routines. Everything feels a little lighter and more possible.",
    vibes: ['✨ Fresh Energy', '🌸 Getting My Life Together', '🦋 New Beginning Energy', '💅 Productive Princess', "🎀 Let's Start Over"],
    bestFor: ['Goal setting', 'Planning', 'Learning new skills', 'Organizing', 'Deep work', 'Building habits'],
    reminder: '🌱 She remembered who she is.',
    energy: 'Rising', color: '#AFC5A5',
    summaryTagline: 'Suddenly we have hobbies again.',
  },
  hot_girl: {
    key: 'hot_girl', icon: '☀️', name: 'Hot Girl Era', caption: '💅 Feeling suspiciously powerful.',
    description: "Confidence is high, energy is peaking, and the main character energy is impossible to ignore. This is your social butterfly era. You're likely feeling more outgoing, motivated, creative, and ready to take on the world.",
    vibes: ['👑 Main Character', '✨ Unstoppable', '💖 Flirty & Thriving', '🌸 Social Butterfly', '💅 Hot Girl Energy'],
    bestFor: ['Social plans', 'Important meetings', 'Date nights', 'Work presentations', 'Strength workouts', 'Taking cute photos'],
    reminder: '☀️ Wear the outfit. Send the text. Take the photo.',
    energy: 'High', color: '#E9C86A',
    summaryTagline: 'Feeling suspiciously powerful.',
  },
  villain: {
    key: 'villain', icon: '🌙', name: 'Villain Era', caption: '🚨 Everyone is testing my patience.',
    description: "Your body is preparing for its next reset. Energy may fluctuate, emotions can feel stronger, and suddenly everyone's breathing sounds personal. This isn't a bad phase—it's a phase that asks for boundaries, self-awareness, and a little extra grace.",
    vibes: ['🚨 The Lore Thickens', '🌧️ In My Feels', '🍟 Little Treat Required', '🤡 Learning Lessons Against My Will', '💌 Processing...'],
    bestFor: ['Wrapping up projects', 'Self-care', 'Reflection', 'Cozy nights in', 'Protecting your peace', 'Avoiding unnecessary nonsense'],
    reminder: '🌙 Not everyone deserves access to your energy.',
    energy: 'Fluctuating', color: '#8FC2BE',
    summaryTagline: 'Everyone is testing my patience.',
  },
}
const ERA_ORDER = ['period', 'fresh_start', 'hot_girl', 'villain']

function getCycleDay(lastPeriodStart, cycleLength) {
  if (!lastPeriodStart) return null
  const start = new Date(lastPeriodStart + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today - start) / 86400000)
  const day = ((diff % cycleLength) + cycleLength) % cycleLength + 1
  return day
}

function getEraKey(cycleDay, periodLength, cycleLength) {
  if (!cycleDay) return null
  if (cycleDay <= periodLength) return 'period'
  const ovulationDay = Math.round(cycleLength / 2)
  if (cycleDay <= ovulationDay - 3) return 'fresh_start'
  if (cycleDay <= ovulationDay + 2) return 'hot_girl'
  return 'villain'
}

function getPredictions(cycleDay, periodLength, cycleLength) {
  if (!cycleDay) return []
  const ovulationDay = Math.round(cycleLength / 2)
  const daysToOvulation = ovulationDay - cycleDay
  const daysToPeriod = cycleDay <= periodLength ? null : cycleLength - cycleDay + 1
  const preds = []
  if (daysToOvulation > 3) {
    preds.push({ days: daysToOvulation - 3, text: '✨ Energy may increase' })
  }
  if (daysToOvulation > 0) {
    preds.push({ days: daysToOvulation, text: '☀️ Ovulation expected' })
  }
  if (daysToPeriod != null && daysToPeriod > 0) {
    preds.push({ days: daysToPeriod, text: '🩷 Period expected' })
  }
  return preds.sort((a, b) => a.days - b.days)
}

const WELLNESS_METRICS = [
  { key: 'water', label: '💧 Water / Hydration' },
  { key: 'steps', label: '👟 Steps' },
  { key: 'movement', label: '🏋️ Movement' },
  { key: 'calories', label: '🍓 Calories' },
  { key: 'protein', label: '💪 Protein' },
  { key: 'fibre', label: '🌾 Fibre' },
  { key: 'sleep', label: '😴 Sleep' },
  { key: 'mood', label: '💖 Mood' },
  { key: 'selfcare', label: '🎀 Self-Care Bingo' },
]

const TABS = [
  { key: 'today', label: '✨ Today' },
  { key: 'cycle', label: '🌸 Cycle' },
  { key: 'weight', label: '⚖️ Weight Journey' },
  { key: 'summary', label: '📊 Summary' },
]

const WEIGHT_ACHIEVEMENTS_KG = [
  { at: 1, icon: '🌸', name: 'First Glow' },
  { at: 2.5, icon: '✨', name: 'Getting Started' },
  { at: 5, icon: '💅', name: 'Snatched Era Begins' },
  { at: 7.5, icon: '🔥', name: 'On Fire' },
  { at: 10, icon: '👑', name: 'Main Character Progress' },
  { at: 15, icon: '🦋', name: 'Transformation Queen' },
  { at: 20, icon: '💎', name: 'Elite Glow Up' },
  { at: 25, icon: '🚀', name: 'Unstoppable' },
  { at: 30, icon: '🏆', name: 'Legend Status' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatDateShort(d) {
  if (!d) return ''
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  const [cycleSettings, setCycleSettings] = useState(null)
  const [periodInput, setPeriodInput] = useState('')
  const [weightSettings, setWeightSettings] = useState(null)
  const [weightLogs, setWeightLogs] = useState([])
  const [weightInput, setWeightInput] = useState('')
  const [startWeightInput, setStartWeightInput] = useState('')
  const [goalWeightInput, setGoalWeightInput] = useState('')
  const [editingWeightGoal, setEditingWeightGoal] = useState(false)
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
  const [hiddenMetrics, setHiddenMetricsState] = useState(getHiddenWellnessMetrics())
  const [customizeOpen, setCustomizeOpen] = useState(false)

  function toggleMetric(key) {
    const next = hiddenMetrics.includes(key) ? hiddenMetrics.filter((m) => m !== key) : [...hiddenMetrics, key]
    setHiddenMetricsState(next)
    setHiddenWellnessMetrics(next)
  }

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

    let { data: existingSettings } = await supabase
      .from('cycle_settings').select('*').maybeSingle()
    if (!existingSettings) {
      const { data: createdSettings } = await supabase
        .from('cycle_settings').insert({ user_id }).select().single()
      existingSettings = createdSettings
    }
    setCycleSettings(existingSettings)

    let { data: existingWeightSettings } = await supabase
      .from('weight_settings').select('*').maybeSingle()
    if (!existingWeightSettings) {
      const { data: createdWS } = await supabase
        .from('weight_settings').insert({ user_id }).select().single()
      existingWeightSettings = createdWS
    }
    setWeightSettings(existingWeightSettings)
    setStartWeightInput(existingWeightSettings.starting_weight != null ? String(existingWeightSettings.starting_weight) : '')
    setGoalWeightInput(existingWeightSettings.goal_weight != null ? String(existingWeightSettings.goal_weight) : '')

    const { data: weightData } = await supabase
      .from('weight_logs').select('*').order('log_date', { ascending: true })
    setWeightLogs(weightData || [])
    const todayWeightLog = (weightData || []).find((w) => w.log_date === date)
    setWeightInput(todayWeightLog ? String(todayWeightLog.weight) : '')

    setLoading(false)
  }

  async function saveWeightGoal() {
    const { data, error } = await supabase
      .from('weight_settings')
      .update({
        starting_weight: parseFloat(startWeightInput) || null,
        goal_weight: parseFloat(goalWeightInput) || null,
      })
      .eq('id', weightSettings.id)
      .select().single()
    if (error) { setError(error.message); return }
    setWeightSettings(data)
    setEditingWeightGoal(false)
  }

  async function setWeightUnit(unit) {
    const { data, error } = await supabase.from('weight_settings').update({ unit }).eq('id', weightSettings.id).select().single()
    if (error) { setError(error.message); return }
    setWeightSettings(data)
  }

  async function logWeight() {
    const weight = parseFloat(weightInput)
    if (!weight) return
    const user_id = await getUserId()
    const date = todayStr()
    const existing = weightLogs.find((w) => w.log_date === date)
    let error
    if (existing) {
      ;({ error } = await supabase.from('weight_logs').update({ weight }).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('weight_logs').insert({ log_date: date, weight, user_id }))
    }
    if (error) { setError(error.message); return }
    const { data: weightData } = await supabase.from('weight_logs').select('*').order('log_date', { ascending: true })
    setWeightLogs(weightData || [])
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

  async function logPeriodStart(dateStr) {
    const { data, error } = await supabase
      .from('cycle_settings')
      .update({ last_period_start: dateStr })
      .eq('id', cycleSettings.id)
      .select().single()
    if (error) { setError(error.message); return }
    setCycleSettings(data)
    setPeriodInput('')
  }

  async function updateCycleLength(field, value) {
    const { data, error } = await supabase
      .from('cycle_settings')
      .update({ [field]: parseInt(value, 10) || (field === 'cycle_length' ? 28 : 5) })
      .eq('id', cycleSettings.id)
      .select().single()
    if (error) { setError(error.message); return }
    setCycleSettings(data)
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

  const cycleLength = cycleSettings?.cycle_length || 28
  const periodLength = cycleSettings?.period_length || 5
  const cycleDay = cycleSettings ? getCycleDay(cycleSettings.last_period_start, cycleLength) : null
  const eraKey = getEraKey(cycleDay, periodLength, cycleLength)
  const era = eraKey ? CYCLE_ERAS[eraKey] : null
  const predictions = getPredictions(cycleDay, periodLength, cycleLength)
  const daysToNextPeriod = cycleDay ? (cycleDay <= periodLength ? null : cycleLength - cycleDay + 1) : null

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' })
  const thisYear = new Date().getFullYear()

  const weightUnit = weightSettings?.unit || 'kg'
  const startingWeight = weightSettings?.starting_weight ? Number(weightSettings.starting_weight) : null
  const goalWeight = weightSettings?.goal_weight ? Number(weightSettings.goal_weight) : null
  const latestWeightLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null
  const currentWeight = latestWeightLog ? Number(latestWeightLog.weight) : startingWeight
  const totalLost = startingWeight != null && currentWeight != null ? Math.max(0, startingWeight - currentWeight) : 0
  const totalToLose = startingWeight != null && goalWeight != null ? Math.max(0, startingWeight - goalWeight) : null
  const goalProgressPct = totalToLose && totalToLose > 0 ? Math.min(100, Math.round((totalLost / totalToLose) * 100)) : 0
  const remainingToGoal = goalWeight != null && currentWeight != null ? Math.max(0, currentWeight - goalWeight) : null
  const achievementThresholds = weightUnit === 'lbs' ? WEIGHT_ACHIEVEMENTS_KG.map((a) => ({ ...a, at: Math.round(a.at * 2.20462 * 10) / 10 })) : WEIGHT_ACHIEVEMENTS_KG
  const unlockedAchievements = achievementThresholds.filter((a) => totalLost >= a.at)
  const nextAchievement = achievementThresholds.find((a) => totalLost < a.at)

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
              {!hiddenMetrics.includes('water') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">💧 Water</span>
                <span className="booknook-stat-value booknook-stat-small">{water} / {waterGoal} glasses</span>
              </div>
              )}
              {!hiddenMetrics.includes('steps') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">👟 Steps</span>
                <span className="booknook-stat-value booknook-stat-small">{(log.steps || 0).toLocaleString()} / {(log.steps_goal || 10000).toLocaleString()}</span>
              </div>
              )}
              {!hiddenMetrics.includes('movement') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">🔥 Movement</span>
                <span className="booknook-stat-value booknook-stat-small">{log.movement_mins || 0} mins</span>
              </div>
              )}
              {!hiddenMetrics.includes('calories') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">🍓 Calories</span>
                <span className="booknook-stat-value booknook-stat-small">{log.calories || 0} / {log.calories_goal || 1900}</span>
              </div>
              )}
              {!hiddenMetrics.includes('sleep') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">😴 Sleep</span>
                <span className="booknook-stat-value booknook-stat-small">{sleepH}h {sleepM}m</span>
              </div>
              )}
              {!hiddenMetrics.includes('protein') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">💪 Protein</span>
                <span className="booknook-stat-value booknook-stat-small">{log.protein_g || 0}g</span>
              </div>
              )}
              {!hiddenMetrics.includes('fibre') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">🌾 Fibre</span>
                <span className="booknook-stat-value booknook-stat-small">{log.fiber_g || 0}g</span>
              </div>
              )}
              {!hiddenMetrics.includes('mood') && (
              <div className="booknook-stat">
                <span className="booknook-stat-label">💖 Mood</span>
                <select value={log.mood || ''} onChange={(e) => updateLog({ mood: e.target.value })}>
                  <option value="">Pick a mood…</option>
                  {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              )}
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
                <>
                  <button className="weather-location-link" onClick={() => setEditingGoals(true)}>🎯 Edit your goals</button>
                  <button className="weather-location-link" onClick={() => setCustomizeOpen(!customizeOpen)}>⚙️ Hide what you don't track</button>
                </>
              )}
            </div>
            {customizeOpen && (
              <div className="settings-module-list" style={{ marginTop: 12 }}>
                {WELLNESS_METRICS.map((m) => {
                  const isOn = !hiddenMetrics.includes(m.key)
                  return (
                    <button
                      key={m.key}
                      type="button"
                      className={`settings-module-row ${isOn ? '' : 'settings-module-row-off'}`}
                      onClick={() => toggleMetric(m.key)}
                    >
                      <span className="settings-module-label">{m.label}</span>
                      <span className={`settings-toggle ${isOn ? 'settings-toggle-on' : ''}`}>
                        <span className="settings-toggle-knob" />
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {!hiddenMetrics.includes('selfcare') && (
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
          )}

          {!hiddenMetrics.includes('water') && (
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
          )}

          {!hiddenMetrics.includes('steps') && (
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
          )}

          {!hiddenMetrics.includes('movement') && (
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
          )}

          {(!hiddenMetrics.includes('calories') || !hiddenMetrics.includes('protein') || !hiddenMetrics.includes('fibre')) && (
          <div className="upnext-section">
            <p className="module-group-label">🍓 NUTRITION</p>
            <p className="field-hint">Keep it simple.</p>
            <div className="calendar-card">
              {!hiddenMetrics.includes('calories') && (
                <>
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
                </>
              )}
              {(!hiddenMetrics.includes('protein') || !hiddenMetrics.includes('fibre')) && (
                <div className="field-row" style={{ marginTop: 14 }}>
                  {!hiddenMetrics.includes('protein') && (
                    <div className="field">
                      <label>Protein (g)</label>
                      <div className="log-value-row">
                        <input type="number" className="log-value-input" value={proteinInput} onChange={(e) => setProteinInput(e.target.value)} />
                        <button className="btn-check log-value-btn" onClick={() => updateLog({ protein_g: parseInt(proteinInput, 10) || 0 })}>Set</button>
                      </div>
                    </div>
                  )}
                  {!hiddenMetrics.includes('fibre') && (
                    <div className="field">
                      <label>Fibre (g)</label>
                      <div className="log-value-row">
                        <input type="number" className="log-value-input" value={fiberInput} onChange={(e) => setFiberInput(e.target.value)} />
                        <button className="btn-check log-value-btn" onClick={() => updateLog({ fiber_g: parseInt(fiberInput, 10) || 0 })}>Set</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}

          {!hiddenMetrics.includes('sleep') && (
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
          )}

        </>
      )}

      {tab === 'cycle' && cycleLog && cycleSettings && (
        <>
          {!cycleSettings.last_period_start && (
            <div className="calendar-card">
              <p className="module-group-label">🩸 LOG YOUR LAST PERIOD START</p>
              <p className="field-hint">This is how we figure out your cycle day, era, and predictions.</p>
              <div className="log-value-row">
                <input type="date" className="log-value-input" value={periodInput} onChange={(e) => setPeriodInput(e.target.value)} />
                <button className="btn-check log-value-btn" onClick={() => logPeriodStart(periodInput)}>Log it</button>
              </div>
            </div>
          )}

          {cycleSettings.last_period_start && era && (
            <>
              {/* Summary card */}
              <div className="calendar-card booknook-progress-card">
                <p className="module-group-label">🌸 CYCLE DAY {cycleDay}</p>
                <div className="cycle-ring-wrap">
                  <div
                    className="cycle-ring"
                    style={{
                      background: `conic-gradient(#D9A8B8 0% ${(periodLength / cycleLength) * 100}%, #AFC5A5 ${(periodLength / cycleLength) * 100}% ${((Math.round(cycleLength / 2) - 3) / cycleLength) * 100}%, #E9C86A ${((Math.round(cycleLength / 2) - 3) / cycleLength) * 100}% ${((Math.round(cycleLength / 2) + 2) / cycleLength) * 100}%, #8FC2BE ${((Math.round(cycleLength / 2) + 2) / cycleLength) * 100}% 100%)`,
                    }}
                  >
                    <div className="cycle-ring-marker" style={{ transform: `rotate(${(cycleDay / cycleLength) * 360}deg)` }}>
                      <span className="cycle-ring-dot" />
                    </div>
                    <div className="cycle-ring-hole">
                      <span className="cycle-ring-icon">{era.icon}</span>
                    </div>
                  </div>
                  <div className="cycle-ring-legend">
                    <span><span className="cycle-legend-dot" style={{ background: '#D9A8B8' }} /> Menstrual</span>
                    <span><span className="cycle-legend-dot" style={{ background: '#AFC5A5' }} /> Follicular</span>
                    <span><span className="cycle-legend-dot" style={{ background: '#E9C86A' }} /> Ovulation</span>
                    <span><span className="cycle-legend-dot" style={{ background: '#8FC2BE' }} /> Luteal</span>
                  </div>
                </div>
                <div className="goals-summary-row">
                  <span className="goals-summary-label">{era.icon} Era</span>
                  <span className="goals-summary-value">{era.name}</span>
                </div>
                <div className="goals-summary-row">
                  <span className="goals-summary-label">💖 Energy</span>
                  <span className="goals-summary-value">{era.energy}</span>
                </div>
                <div className="goals-summary-row">
                  <span className="goals-summary-label">🏃 Best for</span>
                  <span className="goals-summary-value">{era.bestFor.slice(0, 2).join(' & ')}</span>
                </div>
                <div className="goals-summary-row">
                  <span className="goals-summary-label">💧 Water Goal</span>
                  <span className="goals-summary-value">{(waterGoal * 0.25).toFixed(1)}L</span>
                </div>
                {daysToNextPeriod && (
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">📅 Next Period</span>
                    <span className="goals-summary-value">In {daysToNextPeriod} days</span>
                  </div>
                )}
              </div>

              {/* Era description card */}
              <div className="upnext-section">
                <p className="module-group-label">{era.icon} {era.name.toUpperCase()}</p>
                <div className="calendar-card" style={{ borderTop: `4px solid ${era.color}` }}>
                  <p className="cake-club-subtitle" style={{ fontSize: 20, marginBottom: 10 }}>{era.caption}</p>
                  <p className="brain-dump-content" style={{ marginBottom: 16 }}>{era.description}</p>

                  <p className="module-group-label">CURRENT VIBE</p>
                  <select value={cycleLog.vibe || ''} onChange={(e) => updateCycle({ vibe: e.target.value })} style={{ marginBottom: 16 }}>
                    <option value="">Pick your vibe…</option>
                    {era.vibes.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>

                  <p className="module-group-label">BEST FOR</p>
                  <div className="goal-badges-row" style={{ marginBottom: 12 }}>
                    {era.bestFor.map((b) => <span className="goal-badge" key={b}>{b}</span>)}
                  </div>

                  <p className="momentum-caption">{era.reminder}</p>
                </div>
              </div>

              {/* Predictions */}
              {predictions.length > 0 && (
                <div className="upnext-section">
                  <p className="module-group-label">🔮 COMING UP</p>
                  <div className="calendar-card goals-summary-card">
                    {predictions.map((p) => (
                      <div className="goals-summary-row" key={p.text}>
                        <span className="goals-summary-label">In {p.days} day{p.days > 1 ? 's' : ''}</span>
                        <span className="goals-summary-value">{p.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Update period / settings */}
              <div className="upnext-section">
                <p className="module-group-label">🩸 PERIOD TRACKING</p>
                <div className="calendar-card">
                  <p className="field-hint">Last period started {formatDateShort(cycleSettings.last_period_start)}. Starting a new one?</p>
                  <div className="log-value-row" style={{ marginBottom: 16 }}>
                    <input type="date" className="log-value-input" value={periodInput} onChange={(e) => setPeriodInput(e.target.value)} />
                    <button className="btn-check log-value-btn" onClick={() => logPeriodStart(periodInput || todayStr())}>Log new period</button>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Average cycle length (days)</label>
                      <input type="number" defaultValue={cycleLength} onBlur={(e) => updateCycleLength('cycle_length', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Average period length (days)</label>
                      <input type="number" defaultValue={periodLength} onBlur={(e) => updateCycleLength('period_length', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Symptoms & extras */}
          <div className="upnext-section">
            <p className="module-group-label">💖 TODAY'S DETAILS</p>
            <div className="calendar-card">
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

          {/* Cycle Dashboard Summary legend */}
          <div className="upnext-section">
            <p className="module-group-label">✨ CYCLE DASHBOARD SUMMARY</p>
            <div className="finished-shelf">
              {ERA_ORDER.map((key) => {
                const e = CYCLE_ERAS[key]
                return (
                  <div className="library-card library-card-small" key={key} style={{ borderTop: `4px solid ${e.color}` }}>
                    <h3 className="contact-name">{e.icon} {e.name}</h3>
                    <p className="contact-relationship">{e.summaryTagline}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {tab === 'weight' && weightSettings && (
        <>
          {!startingWeight ? (
            <div className="calendar-card">
              <p className="module-group-label">⚖️ LET'S START YOUR GLOW DOWN</p>
              <p className="field-hint">Set your starting weight and goal to begin tracking. You've got this, bestie. 💖</p>
              <div className="field-row" style={{ marginTop: 10 }}>
                <div className="field">
                  <label>Starting weight</label>
                  <input type="number" value={startWeightInput} onChange={(e) => setStartWeightInput(e.target.value)} placeholder="e.g. 75" />
                </div>
                <div className="field">
                  <label>Goal weight</label>
                  <input type="number" value={goalWeightInput} onChange={(e) => setGoalWeightInput(e.target.value)} placeholder="e.g. 65" />
                </div>
              </div>
              <div className="toggle-group" style={{ marginBottom: 14 }}>
                <button type="button" className={`toggle-btn ${weightUnit === 'kg' ? 'toggle-btn-active' : ''}`} onClick={() => setWeightUnit('kg')}>kg</button>
                <button type="button" className={`toggle-btn ${weightUnit === 'lbs' ? 'toggle-btn-active' : ''}`} onClick={() => setWeightUnit('lbs')}>lbs</button>
              </div>
              <button className="btn-primary" onClick={saveWeightGoal}>Start my journey ✨</button>
            </div>
          ) : (
            <>
              <div className="calendar-card booknook-progress-card">
                <p className="module-group-label">👑 YOUR GLOW DOWN JOURNEY</p>
                <div className="booknook-stats-grid">
                  <div className="booknook-stat">
                    <span className="booknook-stat-label">⚖️ Current</span>
                    <span className="booknook-stat-value booknook-stat-small">{currentWeight != null ? `${currentWeight}${weightUnit}` : '—'}</span>
                  </div>
                  <div className="booknook-stat">
                    <span className="booknook-stat-label">🌸 Lost so far</span>
                    <span className="booknook-stat-value booknook-stat-small">{totalLost.toFixed(1)}{weightUnit}</span>
                  </div>
                  {goalWeight != null && (
                    <div className="booknook-stat">
                      <span className="booknook-stat-label">🎯 To goal</span>
                      <span className="booknook-stat-value booknook-stat-small">{remainingToGoal != null ? `${remainingToGoal.toFixed(1)}${weightUnit}` : '—'}</span>
                    </div>
                  )}
                </div>
                {totalToLose != null && (
                  <>
                    <div className="momentum-track" style={{ marginTop: 14 }}>
                      <div className="momentum-fill" style={{ width: `${goalProgressPct}%` }} />
                    </div>
                    <p className="momentum-caption">{goalProgressPct}% of the way to your goal ✨</p>
                  </>
                )}
                <div className="log-value-row" style={{ marginTop: 14 }}>
                  {editingWeightGoal ? (
                    <>
                      <input type="number" className="log-value-input" value={startWeightInput} onChange={(e) => setStartWeightInput(e.target.value)} placeholder="Starting" />
                      <input type="number" className="log-value-input" value={goalWeightInput} onChange={(e) => setGoalWeightInput(e.target.value)} placeholder="Goal" />
                      <button className="btn-check log-value-btn" onClick={saveWeightGoal}>Save</button>
                    </>
                  ) : (
                    <button className="weather-location-link" onClick={() => setEditingWeightGoal(true)}>🎯 Edit starting / goal weight</button>
                  )}
                </div>
              </div>

              <div className="upnext-section">
                <p className="module-group-label">📝 LOG TODAY'S WEIGHT</p>
                <div className="calendar-card">
                  <div className="log-value-row">
                    <input
                      type="number"
                      className="log-value-input"
                      placeholder={`Weight in ${weightUnit}`}
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && logWeight()}
                    />
                    <button className="btn-check log-value-btn" onClick={logWeight}>Log it 💖</button>
                  </div>
                </div>
              </div>

              {nextAchievement && (
                <div className="upnext-section">
                  <p className="module-group-label">🔮 NEXT UP</p>
                  <div className="calendar-card">
                    <p className="momentum-caption">
                      {(nextAchievement.at - totalLost).toFixed(1)}{weightUnit} to unlock {nextAchievement.icon} "{nextAchievement.name}"
                    </p>
                    <div className="momentum-track" style={{ marginTop: 8 }}>
                      <div className="momentum-fill" style={{ width: `${Math.min(100, (totalLost / nextAchievement.at) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              )}

              <div className="upnext-section">
                <p className="module-group-label">🏆 ACHIEVEMENTS</p>
                <div className="finished-shelf">
                  {achievementThresholds.map((a) => {
                    const unlocked = totalLost >= a.at
                    return (
                      <div
                        className="library-card library-card-small"
                        key={a.name}
                        style={{ opacity: unlocked ? 1 : 0.4, borderTop: unlocked ? '4px solid #D9A8B8' : undefined }}
                      >
                        <h3 className="contact-name">{a.icon} {a.name}</h3>
                        <p className="contact-relationship">{a.at}{weightUnit} lost</p>
                        {unlocked && <p className="progress-label">✓ Unlocked</p>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {weightLogs.length > 0 && (
                <div className="upnext-section">
                  <p className="module-group-label">📈 RECENT WEIGH-INS</p>
                  <div className="calendar-card goals-summary-card">
                    {weightLogs.slice(-10).reverse().map((w) => (
                      <div className="goals-summary-row" key={w.id}>
                        <span className="goals-summary-label">{formatDateShort(w.log_date)}</span>
                        <span className="goals-summary-value">{w.weight}{weightUnit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
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
