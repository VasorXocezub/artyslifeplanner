import { useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { getHiddenTodoTabs } from './lib/localPrefs'

const PRIORITIES = [
  { key: 'right_now', label: '🔥 Right Now', color: '#1E5C57' },
  { key: 'next_up', label: '🌱 Next Up', color: '#E4CBA0' },
  { key: 'later', label: '🌙 Later', color: '#F0E8F5' },
]
const PRIORITY_ORDER = { right_now: 0, next_up: 1, later: 2 }

const CATEGORIES = [
  { key: 'personal', label: '💖 Personal' },
  { key: 'business', label: '💼 Business' },
]

const ENERGY_TYPES = [
  { key: 'big_girl_job', label: '🔥 Big Girl Job', color: '#1E5C57' },
  { key: 'deep_focus', label: '🧠 Deep Focus', color: '#B896C9' },
  { key: 'quick_win', label: '⚡ Quick Win', color: '#E4CBA0' },
  { key: 'soft_task', label: '☕ Soft Task', color: '#8FC2BE' },
  { key: 'self_care', label: '🌸 Self Care', color: '#D9A8B8' },
]
const ENERGY_ORDER = { big_girl_job: 0, deep_focus: 1, quick_win: 2, soft_task: 3, self_care: 4 }

const VIBE_FILTERS = [
  { key: 'all', label: '✨ Everything', energies: null },
  { key: 'lets_go', label: "🔥 Let's Go", energies: ['big_girl_job', 'deep_focus'] },
  { key: 'easy_wins', label: '🌱 Easy Wins', energies: ['quick_win'] },
  { key: 'future_me', label: '🌙 Future Me', energies: ['soft_task', 'self_care'] },
]

const HYPE_MESSAGES = [
  "You're literally building your dream life one checkbox at a time.",
  'Tiny progress > perfect plans.',
  "Future you is already obsessed with today's decisions.",
  'Babe, start messy.',
  "We don't wait for motivation around here.",
  "Imagine how good crossing this off is going to feel.",
]

const CELEBRATION_MESSAGES = [
  'She did THAT.',
  'Another slay unlocked.',
  'Main character behavior.',
  'Queen of consistency.',
]

const BADGES = [
  { key: 'first_task', icon: '🌱', name: 'First Task', check: (s) => s.totalCompleted >= 1 },
  { key: 'streak_7', icon: '🔥', name: '7-Day Streak', check: (s) => s.streak >= 7 },
  { key: 'business_boss', icon: '💼', name: 'Business Boss', check: (s) => s.businessCompleted >= 10 },
  { key: 'bookworm', icon: '📚', name: 'Bookworm', check: (s) => s.booksFinished >= 5 },
  { key: 'self_care_queen', icon: '🌸', name: 'Self Care Queen', check: (s) => s.selfCareCompleted >= 5 },
  { key: 'productivity_princess', icon: '👑', name: 'Productivity Princess', check: (s) => s.totalCompleted >= 50 },
]

/* ---------------- Recurrence engine ---------------- */
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' }
const DAY_SHORT = { sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' }
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const FREQ_OPTIONS = [
  { key: 'none', label: 'Does not repeat' },
  { key: 'daily', label: 'Every day' },
  { key: 'weekly', label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
  { key: 'yearly', label: 'Every year' },
  { key: 'custom', label: '✨ Build your routine' },
]

const UNIT_OPTIONS = [
  { key: 'days', label: 'Days' },
  { key: 'weeks', label: 'Weeks' },
  { key: 'months', label: 'Months' },
  { key: 'years', label: 'Years' },
]

const MONTH_MODE_OPTIONS = [
  { key: 'day_of_month', label: 'On a specific day' },
  { key: 'nth_weekday', label: 'On the Nth weekday' },
  { key: 'last_weekday', label: 'On the last weekday' },
]

const END_TYPE_OPTIONS = [
  { key: 'never', label: 'Never' },
  { key: 'on_date', label: 'On date' },
  { key: 'after_n', label: 'After N occurrences' },
]

const MISSED_OPTIONS = [
  { key: 'keep', label: 'Keep until completed' },
  { key: 'skip', label: 'Skip it' },
  { key: 'move_tomorrow', label: 'Move to tomorrow' },
]

const NTH_OPTIONS = [
  { key: 1, label: 'First' },
  { key: 2, label: 'Second' },
  { key: 3, label: 'Third' },
  { key: 4, label: 'Fourth' },
]

function unitFromFreq(freq) {
  if (freq === 'weekly') return 'weeks'
  if (freq === 'monthly') return 'months'
  if (freq === 'yearly') return 'years'
  return 'days'
}
function freqFromUnit(unit) {
  if (unit === 'weeks') return 'weekly'
  if (unit === 'months') return 'monthly'
  if (unit === 'years') return 'yearly'
  return 'daily'
}

function ordinal(n) {
  if (n === -1) return 'last'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const SMART_PRESETS = [
  { key: 'weekday', icon: '🔥', name: 'Every weekday', build: (anchor) => ({ freq: 'weekly', interval: 1, weekDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], anchorDate: anchor, endType: 'never', missed: 'keep' }) },
  { key: 'work_week', icon: '💼', name: 'Work week', build: (anchor) => ({ freq: 'weekly', interval: 1, weekDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], anchorDate: anchor, endType: 'never', missed: 'keep' }) },
  { key: 'weekends', icon: '💖', name: 'Weekends', build: (anchor) => ({ freq: 'weekly', interval: 1, weekDays: ['saturday', 'sunday'], anchorDate: anchor, endType: 'never', missed: 'keep' }) },
  { key: 'biweekly', icon: '🌸', name: 'Every second week', build: (anchor) => ({ freq: 'weekly', interval: 2, weekDays: [DAY_KEYS[new Date(anchor + 'T00:00:00').getDay()]], anchorDate: anchor, endType: 'never', missed: 'keep' }) },
  { key: 'monthly_reset', icon: '🧹', name: 'Monthly reset', build: (anchor) => ({ freq: 'monthly', interval: 1, monthMode: 'day_of_month', monthDay: 1, anchorDate: anchor, endType: 'never', missed: 'keep' }) },
  { key: 'reading', icon: '📚', name: 'Reading reminder', build: (anchor) => ({ freq: 'daily', interval: 1, anchorDate: anchor, endType: 'never', missed: 'keep' }) },
  { key: 'gym', icon: '💪', name: 'Gym schedule', build: (anchor) => ({ freq: 'weekly', interval: 1, weekDays: ['monday', 'wednesday', 'friday'], anchorDate: anchor, endType: 'never', missed: 'keep' }) },
  { key: 'payday', icon: '💰', name: 'Payday', build: (anchor) => ({ freq: 'monthly', interval: 1, monthMode: 'day_of_month', monthDay: 25, anchorDate: anchor, endType: 'never', missed: 'keep' }) },
]

function defaultRule(freq, anchorDateStr) {
  const anchor = new Date(anchorDateStr + 'T00:00:00')
  const base = { interval: 1, endType: 'never', endDate: '', endCount: 10, occurrenceCount: 0, missed: 'keep', anchorDate: anchorDateStr }
  if (freq === 'weekly') return { ...base, freq: 'weekly', weekDays: [DAY_KEYS[anchor.getDay()]] }
  if (freq === 'monthly') return { ...base, freq: 'monthly', monthMode: 'day_of_month', monthDay: anchor.getDate(), monthNth: 1, monthWeekday: DAY_KEYS[anchor.getDay()] }
  if (freq === 'yearly') return { ...base, freq: 'yearly', yearMonth: anchor.getMonth(), yearDay: anchor.getDate() }
  if (freq === 'custom') return { ...base, freq: 'weekly', weekDays: [DAY_KEYS[anchor.getDay()]], monthMode: 'day_of_month', monthDay: anchor.getDate(), monthNth: 1, monthWeekday: DAY_KEYS[anchor.getDay()], yearMonth: anchor.getMonth(), yearDay: anchor.getDate() }
  return { ...base, freq: 'daily' }
}

function buildSummary(rule) {
  if (!rule) return ''
  const n = rule.interval || 1
  let base = ''
  if (rule.freq === 'daily') {
    base = n === 1 ? 'This task repeats every day.' : `Future You will see this every ${n} days.`
  } else if (rule.freq === 'weekly') {
    const days = (rule.weekDays || []).map((d) => DAY_LABELS[d]).join(' and ')
    base = n === 1
      ? `This task repeats every week${days ? ' on ' + days : ''}.`
      : `This task will repeat every ${n} weeks${days ? ' on ' + days : ''}.`
  } else if (rule.freq === 'monthly') {
    const monthWord = n === 1 ? 'month' : `${n} months`
    if (rule.monthMode === 'nth_weekday') {
      base = `This task repeats on the ${ordinal(rule.monthNth)} ${DAY_LABELS[rule.monthWeekday]} of every ${monthWord}.`
    } else if (rule.monthMode === 'last_weekday') {
      base = `This task repeats on the last ${DAY_LABELS[rule.monthWeekday]} of every ${monthWord}.`
    } else {
      base = `This task repeats on the ${ordinal(rule.monthDay)} of every ${monthWord}.`
    }
  } else if (rule.freq === 'yearly') {
    base = `This task repeats every ${n === 1 ? 'year' : n + ' years'} on ${MONTH_LABELS[rule.yearMonth]} ${rule.yearDay}.`
  }
  let end = ''
  if (rule.endType === 'on_date' && rule.endDate) end = ` It stops after ${rule.endDate}.`
  if (rule.endType === 'after_n' && rule.endCount) end = ` It stops after ${rule.endCount} times.`
  return '✨ ' + base + end
}

function matchesFrequency(rule, date) {
  if (!rule.anchorDate) return false
  const anchor = new Date(rule.anchorDate + 'T00:00:00')
  const interval = rule.interval || 1
  if (rule.freq === 'daily') {
    const diff = Math.round((date - anchor) / 86400000)
    return diff >= 0 && diff % interval === 0
  }
  if (rule.freq === 'weekly') {
    const days = rule.weekDays && rule.weekDays.length ? rule.weekDays : [DAY_KEYS[anchor.getDay()]]
    if (!days.includes(DAY_KEYS[date.getDay()])) return false
    const anchorWeekStart = new Date(anchor)
    anchorWeekStart.setDate(anchor.getDate() - anchor.getDay())
    const dateWeekStart = new Date(date)
    dateWeekStart.setDate(date.getDate() - date.getDay())
    const weeksDiff = Math.round((dateWeekStart - anchorWeekStart) / (7 * 86400000))
    return weeksDiff >= 0 && weeksDiff % interval === 0
  }
  if (rule.freq === 'monthly') {
    const monthsDiff = (date.getFullYear() - anchor.getFullYear()) * 12 + (date.getMonth() - anchor.getMonth())
    if (monthsDiff < 0 || monthsDiff % interval !== 0) return false
    if (rule.monthMode === 'nth_weekday') {
      return date.getDay() === DAY_KEYS.indexOf(rule.monthWeekday) && Math.ceil(date.getDate() / 7) === rule.monthNth
    }
    if (rule.monthMode === 'last_weekday') {
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      return date.getDay() === DAY_KEYS.indexOf(rule.monthWeekday) && lastDay - date.getDate() < 7
    }
    return date.getDate() === rule.monthDay
  }
  if (rule.freq === 'yearly') {
    const yearsDiff = date.getFullYear() - anchor.getFullYear()
    return yearsDiff >= 0 && yearsDiff % interval === 0 && date.getMonth() === rule.yearMonth && date.getDate() === rule.yearDay
  }
  return false
}

function shouldReset(todo, now) {
  if (!todo.recur_rule || !todo.completed) return false
  const rule = todo.recur_rule
  const today = todayStr()
  if (todo.last_reset_date === today) return false
  if (rule.endType === 'on_date' && rule.endDate && today > rule.endDate) return false
  if (rule.endType === 'after_n' && rule.endCount != null && (rule.occurrenceCount || 0) >= rule.endCount) return false
  return matchesFrequency(rule, now)
}

/* ---------------- misc helpers ---------------- */
function priorityInfo(key) {
  return PRIORITIES.find((p) => p.key === key) || PRIORITIES[1]
}

function energyInfo(key) {
  return ENERGY_TYPES.find((e) => e.key === key) || ENERGY_TYPES[2]
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
}

function isOverdue(d) {
  if (!d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(d + 'T00:00:00') < today
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatTimestamp(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function calcStreak(completedDates) {
  if (completedDates.length === 0) return 0
  const dateSet = new Set(completedDates)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  let cursor = new Date(today)
  if (!dateSet.has(todayStr())) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (true) {
    const iso = cursor.toISOString().split('T')[0]
    if (dateSet.has(iso)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

/* ---------------- Recurrence builder sub-component ---------------- */
function RecurrenceBuilder({ freq, rule, onFreqChange, onRuleChange }) {
  function update(patch) {
    onRuleChange({ ...rule, ...patch })
  }

  return (
    <div className="field todo-repeat-field">
      <label>✨ Keep this vibe going?</label>
      <select value={freq} onChange={(e) => onFreqChange(e.target.value)}>
        {FREQ_OPTIONS.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>

      {freq === 'custom' && rule && (
        <div className="recur-builder">
          <p className="cake-section-heading" style={{ fontSize: 15 }}>🌸 Custom Repeat</p>

          <div className="log-value-row" style={{ marginBottom: 12 }}>
            <span className="field-hint" style={{ margin: 0 }}>Repeat every</span>
            <input
              type="number"
              min="1"
              className="log-value-input"
              style={{ maxWidth: 70 }}
              value={rule.interval}
              onChange={(e) => update({ interval: parseInt(e.target.value, 10) || 1 })}
            />
            <select
              value={unitFromFreq(rule.freq)}
              onChange={(e) => update({ freq: freqFromUnit(e.target.value) })}
            >
              {UNIT_OPTIONS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>

          {rule.freq === 'weekly' && (
            <div className="field">
              <label>On:</label>
              <div className="custom-days-row">
                {DAY_KEYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`custom-day-chip ${(rule.weekDays || []).includes(d) ? 'custom-day-chip-on' : ''}`}
                    onClick={() => update({ weekDays: (rule.weekDays || []).includes(d) ? rule.weekDays.filter((x) => x !== d) : [...(rule.weekDays || []), d] })}
                  >
                    {DAY_SHORT[d]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {rule.freq === 'monthly' && (
            <div className="field">
              {MONTH_MODE_OPTIONS.map((m) => (
                <label key={m.key} className="savings-toggle-label" style={{ display: 'block', marginBottom: 6 }}>
                  <input type="radio" name="monthMode" checked={rule.monthMode === m.key} onChange={() => update({ monthMode: m.key })} />
                  {' '}{m.label}
                  {m.key === 'day_of_month' && rule.monthMode === 'day_of_month' && (
                    <input
                      type="number" min="1" max="31" className="log-value-input" style={{ maxWidth: 60, marginLeft: 8 }}
                      value={rule.monthDay} onChange={(e) => update({ monthDay: parseInt(e.target.value, 10) || 1 })}
                    />
                  )}
                  {m.key === 'nth_weekday' && rule.monthMode === 'nth_weekday' && (
                    <span style={{ marginLeft: 8 }}>
                      <select value={rule.monthNth} onChange={(e) => update({ monthNth: parseInt(e.target.value, 10) })}>
                        {NTH_OPTIONS.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
                      </select>
                      <select value={rule.monthWeekday} onChange={(e) => update({ monthWeekday: e.target.value })} style={{ marginLeft: 6 }}>
                        {DAY_KEYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                      </select>
                    </span>
                  )}
                  {m.key === 'last_weekday' && rule.monthMode === 'last_weekday' && (
                    <select value={rule.monthWeekday} onChange={(e) => update({ monthWeekday: e.target.value })} style={{ marginLeft: 8 }}>
                      {DAY_KEYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                    </select>
                  )}
                </label>
              ))}
            </div>
          )}

          {rule.freq === 'yearly' && (
            <div className="field-row">
              <div className="field">
                <label>Month</label>
                <select value={rule.yearMonth} onChange={(e) => update({ yearMonth: parseInt(e.target.value, 10) })}>
                  {MONTH_LABELS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Day</label>
                <input type="number" min="1" max="31" value={rule.yearDay} onChange={(e) => update({ yearDay: parseInt(e.target.value, 10) || 1 })} />
              </div>
            </div>
          )}

          <div className="field">
            <label>Ends</label>
            {END_TYPE_OPTIONS.map((e) => (
              <label key={e.key} className="savings-toggle-label" style={{ display: 'block', marginBottom: 6 }}>
                <input type="radio" name="endType" checked={rule.endType === e.key} onChange={() => update({ endType: e.key })} />
                {' '}{e.label}
                {e.key === 'on_date' && rule.endType === 'on_date' && (
                  <input type="date" value={rule.endDate || ''} onChange={(ev) => update({ endDate: ev.target.value })} style={{ marginLeft: 8 }} />
                )}
                {e.key === 'after_n' && rule.endType === 'after_n' && (
                  <input
                    type="number" min="1" className="log-value-input" style={{ maxWidth: 70, marginLeft: 8 }}
                    value={rule.endCount} onChange={(ev) => update({ endCount: parseInt(ev.target.value, 10) || 1 })}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="field">
            <label>If I miss it…</label>
            {MISSED_OPTIONS.map((m) => (
              <label key={m.key} className="savings-toggle-label" style={{ display: 'block', marginBottom: 6 }}>
                <input type="radio" name="missed" checked={rule.missed === m.key} onChange={() => update({ missed: m.key })} />
                {' '}{m.label}
              </label>
            ))}
          </div>

          <p className="momentum-caption">{buildSummary(rule)}</p>

          <div className="field">
            <label>💌 Smart Repeat presets</label>
            <div className="todo-badges-row">
              {SMART_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  className="filter-pill"
                  onClick={() => { onRuleChange(p.build(rule.anchorDate || todayStr())); onFreqChange(p.build(rule.anchorDate).freq) }}
                >
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {['weekly', 'monthly', 'yearly'].includes(freq) && rule && (
        <p className="momentum-caption" style={{ marginTop: 8 }}>{buildSummary(rule)}</p>
      )}
    </div>
  )
}

export default function TodoView() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState(() => {
    const hidden = getHiddenTodoTabs()
    const firstVisible = CATEGORIES.find((c) => !hidden.includes(c.key))
    return firstVisible ? firstVisible.key : 'personal'
  })
  const hiddenTabs = getHiddenTodoTabs()
  const visibleCategories = CATEGORIES.filter((c) => !hiddenTabs.includes(c.key))
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPriority, setNewPriority] = useState('next_up')
  const [newEnergy, setNewEnergy] = useState('quick_win')
  const [newFreq, setNewFreq] = useState('none')
  const [newRule, setNewRule] = useState(null)
  const [adding, setAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [vibeFilter, setVibeFilter] = useState('all')
  const [expandedNotes, setExpandedNotes] = useState({})
  const [notesByTodo, setNotesByTodo] = useState({})
  const [newNoteInputs, setNewNoteInputs] = useState({})
  const [editingRecurId, setEditingRecurId] = useState(null)
  const [editingRule, setEditingRule] = useState(null)
  const [editingFreq, setEditingFreq] = useState('none')
  const [hypeMessage] = useState(() => HYPE_MESSAGES[Math.floor(Math.random() * HYPE_MESSAGES.length)])
  const [celebration, setCelebration] = useState(null)
  const [booksFinished, setBooksFinished] = useState(0)
  const [todayWellness, setTodayWellness] = useState(null)
  const [todayPages, setTodayPages] = useState(0)

  useEffect(() => {
    fetchTodos()
    fetchExtras()
  }, [])

  useEffect(() => {
    if (hiddenTabs.includes(category) && visibleCategories.length > 0) {
      setCategory(visibleCategories[0].key)
    }
  }, [category])

  function handleNewFreqChange(freq) {
    setNewFreq(freq)
    setNewRule(freq === 'none' ? null : defaultRule(freq, newDate || todayStr()))
  }

  async function fetchExtras() {
    const { data: books } = await supabase.from('books').select('id').eq('status', 'finished')
    setBooksFinished((books || []).length)
    const today = todayStr()
    const { data: wellness } = await supabase.from('wellness_logs').select('*').eq('log_date', today).maybeSingle()
    setTodayWellness(wellness || null)
    const { data: readingLogs } = await supabase.from('reading_logs').select('pages').eq('logged_date', today)
    setTodayPages((readingLogs || []).reduce((sum, r) => sum + (Number(r.pages) || 0), 0))
  }

  async function fetchTodos() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const now = new Date()
    const today = todayStr()
    const toReset = (data || []).filter((t) => shouldReset(t, now))
    let finalTodos = data
    if (toReset.length > 0) {
      await Promise.all(
        toReset.map((t) => {
          const rule = t.recur_rule
          const nextOccurrence = (rule.occurrenceCount || 0) + 1
          return supabase.from('todos').update({
            completed: false,
            last_reset_date: today,
            recur_rule: { ...rule, occurrenceCount: nextOccurrence },
          }).eq('id', t.id)
        })
      )
      const { data: refreshed } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: true })
      finalTodos = refreshed || []
    }

    // Missed-task handling: move overdue recurring tasks forward if configured to
    const toShift = (finalTodos || []).filter((t) => {
      if (t.completed || !t.recur_rule || t.recur_rule.missed !== 'move_tomorrow') return false
      return t.due_date && isOverdue(t.due_date)
    })
    if (toShift.length > 0) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      await Promise.all(toShift.map((t) => supabase.from('todos').update({ due_date: tomorrowStr }).eq('id', t.id)))
      const { data: refreshed2 } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: true })
      finalTodos = refreshed2 || []
    }

    setTodos(finalTodos)

    const ids = (finalTodos || []).map((t) => t.id)
    if (ids.length > 0) {
      const { data: notesData } = await supabase
        .from('todo_notes')
        .select('*')
        .in('todo_id', ids)
        .order('created_at', { ascending: false })
      const grouped = {}
      ;(notesData || []).forEach((n) => {
        if (!grouped[n.todo_id]) grouped[n.todo_id] = []
        grouped[n.todo_id].push(n)
      })
      setNotesByTodo(grouped)
    }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const user_id = await getUserId()
    const rule = newFreq === 'none' ? null : { ...newRule, anchorDate: newDate || todayStr() }
    const { error } = await supabase
      .from('todos')
      .insert({
        text: newText.trim(),
        due_date: newDate || null,
        priority: newPriority,
        energy: category === 'personal' ? newEnergy : null,
        category,
        recur_rule: rule,
        last_reset_date: rule ? todayStr() : null,
        user_id,
      })
    setAdding(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewText('')
    setNewDate('')
    setNewFreq('none')
    setNewRule(null)
    fetchTodos()
  }

  function openRecurEditor(todo) {
    setEditingRecurId(editingRecurId === todo.id ? null : todo.id)
    setEditingFreq(todo.recur_rule ? 'custom' : 'none')
    setEditingRule(todo.recur_rule || null)
  }

  function handleEditingFreqChange(freq, todo) {
    setEditingFreq(freq)
    setEditingRule(freq === 'none' ? null : defaultRule(freq, todo.due_date || todayStr()))
  }

  async function saveRecurRule(todo) {
    const rule = editingFreq === 'none' ? null : editingRule
    const { error } = await supabase.from('todos').update({
      recur_rule: rule,
      last_reset_date: rule ? todayStr() : null,
    }).eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    setEditingRecurId(null)
    fetchTodos()
  }

  async function toggleComplete(todo) {
    const willComplete = !todo.completed
    const payload = { completed: willComplete, completed_at: willComplete ? new Date().toISOString() : null }
    if (todo.recur_rule && willComplete) payload.last_reset_date = todayStr()
    const { error } = await supabase
      .from('todos')
      .update(payload)
      .eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    if (willComplete && todo.category === 'personal') {
      setCelebration(CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)])
      setTimeout(() => setCelebration(null), 1800)
    }
    fetchTodos()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  async function changePriority(todo, priority) {
    const { error } = await supabase.from('todos').update({ priority }).eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  async function changeEnergy(todo, energy) {
    const { error } = await supabase.from('todos').update({ energy }).eq('id', todo.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  function toggleNotesExpanded(todo) {
    setExpandedNotes((v) => ({ ...v, [todo.id]: !v[todo.id] }))
  }

  async function addNote(todo) {
    const text = (newNoteInputs[todo.id] || '').trim()
    if (!text) return
    const user_id = await getUserId()
    const { error } = await supabase.from('todo_notes').insert({ todo_id: todo.id, text, user_id })
    if (error) {
      setError(error.message)
      return
    }
    setNewNoteInputs((v) => ({ ...v, [todo.id]: '' }))
    fetchTodos()
  }

  async function deleteNote(noteId) {
    const { error } = await supabase.from('todo_notes').delete().eq('id', noteId)
    if (error) {
      setError(error.message)
      return
    }
    fetchTodos()
  }

  const isPersonal = category === 'personal'
  const categoryTodos = todos.filter((t) => (t.category || 'personal') === category)

  const filteredOpen = categoryTodos.filter((t) => {
    if (t.completed) return false
    if (!isPersonal) return priorityFilter === 'all' || t.priority === priorityFilter
    const vibe = VIBE_FILTERS.find((v) => v.key === vibeFilter)
    if (!vibe || !vibe.energies) return true
    return vibe.energies.includes(t.energy || 'quick_win')
  })

  const openTodos = filteredOpen.sort((a, b) => {
    if (isPersonal) {
      const ea = ENERGY_ORDER[a.energy] ?? 2
      const eb = ENERGY_ORDER[b.energy] ?? 2
      if (ea !== eb) return ea - eb
    } else {
      const pa = PRIORITY_ORDER[a.priority] ?? 1
      const pb = PRIORITY_ORDER[b.priority] ?? 1
      if (pa !== pb) return pa - pb
    }
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })
  const completedTodos = categoryTodos.filter((t) => t.completed)

  const momentumPct = categoryTodos.length > 0
    ? Math.round((completedTodos.length / categoryTodos.length) * 100)
    : 0

  const personalStats = useMemo(() => {
    if (!isPersonal) return null
    const personalTodos = todos.filter((t) => (t.category || 'personal') === 'personal')
    const completedDates = Array.from(new Set(
      personalTodos.filter((t) => t.completed && t.completed_at).map((t) => t.completed_at.split('T')[0])
    ))
    const streak = calcStreak(completedDates)
    const businessCompleted = todos.filter((t) => t.category === 'business' && t.completed).length
    const selfCareCompleted = personalTodos.filter((t) => t.completed && t.energy === 'self_care').length
    const totalCompleted = todos.filter((t) => t.completed).length
    const focusLeft = personalTodos.filter((t) => !t.completed && (t.energy === 'big_girl_job' || t.energy === 'deep_focus')).length
    return {
      today: personalTodos.length,
      focusLeft,
      done: personalTodos.filter((t) => t.completed).length,
      streak,
      businessCompleted,
      selfCareCompleted,
      totalCompleted,
      booksFinished,
    }
  }, [todos, isPersonal, booksFinished])

  const unlockedBadges = personalStats ? BADGES.filter((b) => b.check(personalStats)) : []

  const allPersonalDoneToday = isPersonal && categoryTodos.length > 0 && openTodos.length === 0

  return (
    <div>
      {celebration && (
        <div className="celebration-toast">
          <span className="celebration-sparkles">✨✨✨</span>
          <span>{celebration}</span>
        </div>
      )}

      <div className="view-header">
        <div>
          <h1 className="view-title">To-Do List</h1>
          {isPersonal ? (
            <>
              <p className="view-subtitle cake-club-subtitle">Okay queen, what's getting done today? 👑</p>
              <p className="field-hint" style={{ marginTop: 4 }}>{hypeMessage}</p>
            </>
          ) : (
            <p className="view-subtitle cake-club-subtitle">🫡 Unfortunately, I assigned this to myself.</p>
          )}
        </div>
      </div>

      <div className="filter-row">
        {visibleCategories.map((c) => (
          <button
            key={c.key}
            className={`filter-pill ${category === c.key ? 'filter-pill-active' : ''}`}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isPersonal && personalStats && (
        <div className="todo-hype-stats-row">
          <div className="todo-hype-stat-card">
            <span className="todo-hype-stat-icon">✨</span>
            <span className="todo-hype-stat-value">{personalStats.today}</span>
            <span className="todo-hype-stat-label">Today</span>
          </div>
          <div className="todo-hype-stat-card">
            <span className="todo-hype-stat-icon">🔥</span>
            <span className="todo-hype-stat-value">{personalStats.focusLeft}</span>
            <span className="todo-hype-stat-label">Focus left</span>
          </div>
          <div className="todo-hype-stat-card">
            <span className="todo-hype-stat-icon">🎉</span>
            <span className="todo-hype-stat-value">{personalStats.done}</span>
            <span className="todo-hype-stat-label">Crushed</span>
          </div>
          <div className="todo-hype-stat-card">
            <span className="todo-hype-stat-icon">⭐</span>
            <span className="todo-hype-stat-value">{personalStats.streak}</span>
            <span className="todo-hype-stat-label">Streak</span>
          </div>
        </div>
      )}

      {categoryTodos.length > 0 && (
        <div className="calendar-card momentum-card">
          <p className="module-group-label">{isPersonal ? "TODAY'S PROGRESS" : 'MOMENTUM METER'}</p>
          <div className="momentum-track">
            <div className="momentum-fill" style={{ width: `${momentumPct}%` }} />
          </div>
          <p className="momentum-caption">
            {momentumPct}% · {completedTodos.length} of {categoryTodos.length} tasks complete
            {isPersonal && ' — Keep going, you\'ve got this 💖'}
          </p>
        </div>
      )}

      {allPersonalDoneToday && (
        <div className="calendar-card todo-reflection-card">
          <p className="cake-section-heading">🎉 You absolutely crushed today.</p>
          <div className="goals-summary-row">
            <span className="goals-summary-label">✓ Tasks finished</span>
            <span className="goals-summary-value">{completedTodos.length}</span>
          </div>
          {todayPages > 0 && (
            <div className="goals-summary-row">
              <span className="goals-summary-label">📚 Pages read</span>
              <span className="goals-summary-value">{todayPages}</span>
            </div>
          )}
          {todayWellness?.water_glasses > 0 && (
            <div className="goals-summary-row">
              <span className="goals-summary-label">💧 Water</span>
              <span className="goals-summary-value">{todayWellness.water_glasses} glasses</span>
            </div>
          )}
          <div className="goals-summary-row">
            <span className="goals-summary-label">🔥 Streak</span>
            <span className="goals-summary-value">{personalStats.streak} days</span>
          </div>
          <p className="momentum-caption" style={{ marginTop: 10 }}>Now go romanticize your evening. 🌙✨</p>
        </div>
      )}

      {isPersonal && unlockedBadges.length > 0 && (
        <div className="upnext-section">
          <p className="module-group-label">🏆 BADGES</p>
          <div className="todo-badges-row">
            {unlockedBadges.map((b) => (
              <span key={b.key} className="todo-badge-chip" title={b.name}>{b.icon} {b.name}</span>
            ))}
          </div>
        </div>
      )}

      <form className="habit-add-row" onSubmit={handleAdd}>
        <input
          className="search-box habit-add-input"
          placeholder="Add a task…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        {isPersonal ? (
          <select
            className="todo-date-input"
            value={newEnergy}
            onChange={(e) => setNewEnergy(e.target.value)}
          >
            {ENERGY_TYPES.map((en) => (
              <option key={en.key} value={en.key}>{en.label}</option>
            ))}
          </select>
        ) : (
          <select
            className="todo-date-input"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        )}
        <input
          type="date"
          className="todo-date-input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={adding}>
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </form>

      <RecurrenceBuilder
        freq={newFreq}
        rule={newRule}
        onFreqChange={handleNewFreqChange}
        onRuleChange={setNewRule}
      />

      <div className="filter-row">
        {isPersonal ? (
          VIBE_FILTERS.map((v) => (
            <button
              key={v.key}
              className={`filter-pill ${vibeFilter === v.key ? 'filter-pill-active' : ''}`}
              onClick={() => setVibeFilter(v.key)}
            >
              {v.label}
            </button>
          ))
        ) : (
          <>
            <button
              className={`filter-pill ${priorityFilter === 'all' ? 'filter-pill-active' : ''}`}
              onClick={() => setPriorityFilter('all')}
            >
              All
            </button>
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                className={`filter-pill ${priorityFilter === p.key ? 'filter-pill-active' : ''}`}
                onClick={() => setPriorityFilter(p.key)}
              >
                {p.label}
              </button>
            ))}
          </>
        )}
      </div>

      {loading && <p className="loading">Rounding up your tasks… 📋✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && openTodos.length === 0 && completedTodos.length === 0 && (
        <div className="empty-state">
          <h3>Nothing here yet, iconic ✨</h3>
          <p>Add your first task above — let's get this bread, bestie.</p>
        </div>
      )}

      {!loading && !error && openTodos.length > 0 && (
        <div className="todo-list">
          {openTodos.map((t) => {
            const pInfo = priorityInfo(t.priority)
            const eInfo = energyInfo(t.energy)
            const notesOpen = !!expandedNotes[t.id]
            return (
              <div className="todo-item-wrap" key={t.id}>
                <div className="todo-row">
                  <button className="todo-checkbox" onClick={() => toggleComplete(t)} aria-label="Mark done" />
                  <span className="todo-text">{t.text}</span>
                  <button
                    className={`weather-location-link ${t.recur_rule ? '' : ''}`}
                    onClick={() => openRecurEditor(t)}
                  >
                    {t.recur_rule ? '✨ Repeating' : '🔁 Keep this vibe going'}
                  </button>
                  {isPersonal ? (
                    <select
                      className="todo-priority-select"
                      style={{ color: eInfo.color, borderColor: eInfo.color }}
                      value={t.energy || 'quick_win'}
                      onChange={(e) => changeEnergy(t, e.target.value)}
                    >
                      {ENERGY_TYPES.map((en) => (
                        <option key={en.key} value={en.key}>{en.label}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="todo-priority-select"
                      style={{ color: pInfo.color, borderColor: pInfo.color }}
                      value={t.priority || 'next_up'}
                      onChange={(e) => changePriority(t, e.target.value)}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  )}
                  {t.due_date && (
                    <span className={`todo-due ${isOverdue(t.due_date) ? 'todo-due-overdue' : ''}`}>
                      {formatDate(t.due_date)}
                    </span>
                  )}
                  <button
                    className={`todo-notes-btn ${notesOpen ? 'todo-notes-btn-open' : ''} ${(notesByTodo[t.id] || []).length > 0 ? 'todo-notes-btn-filled' : ''}`}
                    onClick={() => toggleNotesExpanded(t)}
                  >
                    💬{(notesByTodo[t.id] || []).length > 0 && <span className="todo-notes-count">{notesByTodo[t.id].length}</span>}
                  </button>
                  <button className="todo-delete" onClick={() => handleDelete(t.id)}>×</button>
                </div>

                {t.recur_rule && !editingRecurId && (
                  <p className="todo-notes-preview-row" style={{ marginLeft: 44 }}>
                    <span className="todo-notes-timestamp">{buildSummary(t.recur_rule)}</span>
                  </p>
                )}

                <div className={`todo-notes-collapse ${editingRecurId === t.id ? 'todo-notes-collapse-open' : ''}`}>
                  <div className="todo-notes-collapse-inner">
                    <div className="todo-notes-panel">
                      <RecurrenceBuilder
                        freq={editingFreq}
                        rule={editingRule}
                        onFreqChange={(f) => handleEditingFreqChange(f, t)}
                        onRuleChange={setEditingRule}
                      />
                      <div className="log-value-row" style={{ marginTop: 10 }}>
                        <button className="btn-cancel" onClick={() => setEditingRecurId(null)}>Cancel</button>
                        <button className="btn-check log-value-btn" onClick={() => saveRecurRule(t)}>Save</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`todo-notes-collapse ${notesOpen ? 'todo-notes-collapse-open' : ''}`}>
                  <div className="todo-notes-collapse-inner">
                    <div className="todo-notes-panel">
                      <div className="todo-notes-header">
                        <span className="booknook-stat-label">📝 PROGRESS, CONTEXT, FOLLOW-UPS…</span>
                      </div>

                      {(notesByTodo[t.id] || []).length > 0 && (
                        <div className="todo-notes-log">
                          {notesByTodo[t.id].map((n) => (
                            <div className="todo-notes-log-entry" key={n.id}>
                              <p className="todo-notes-log-text">{n.text}</p>
                              <div className="todo-notes-log-footer">
                                <span className="todo-notes-timestamp">{formatTimestamp(n.created_at)}</span>
                                <button className="todo-notes-log-delete" onClick={() => deleteNote(n.id)}>×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <textarea
                        className="todo-notes-textarea"
                        value={newNoteInputs[t.id] || ''}
                        onChange={(e) => setNewNoteInputs((v) => ({ ...v, [t.id]: e.target.value }))}
                        placeholder="Add a new update…"
                      />
                      <div className="todo-notes-footer">
                        <button className="btn-check log-value-btn" onClick={() => addNote(t)}>+ Add note</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {completedTodos.length > 0 && (
        <div className="todo-completed-section">
          <button className="btn-ghost todo-toggle-completed" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? 'Hide' : 'Show'} completed ({completedTodos.length})
          </button>
          {showCompleted && (
            <div className="todo-list">
              {completedTodos.map((t) => (
                <div className="todo-row todo-row-done" key={t.id}>
                  <button className="todo-checkbox todo-checkbox-checked" onClick={() => toggleComplete(t)} aria-label="Mark not done">
                    ✓
                  </button>
                  <span className="todo-text todo-text-done">{t.text}</span>
                  {t.recur_rule && <span className="todo-recurring-badge todo-recurring-badge-on">🔄</span>}
                  <button className="todo-delete" onClick={() => handleDelete(t.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
