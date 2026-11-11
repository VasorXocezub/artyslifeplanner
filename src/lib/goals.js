// Dream Board helpers (pure, tested)
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function computeProgress(goal) {
  const start = Number(goal.start_value)
  const current = Number(goal.current_value)
  const target = Number(goal.target_value)
  if (isNaN(start) || isNaN(current) || isNaN(target) || start === target) return { pct: 0 }
  return { pct: clamp(((current - start) / (target - start)) * 100) }
}

// ctx = { savings: {id: row}, habitPct: {id: pct} }
export function derivedPct(goal, ctx = {}) {
  if (goal.linked_savings_id && ctx.savings?.[goal.linked_savings_id]) {
    const s = ctx.savings[goal.linked_savings_id]
    const t = Number(s.target_amount)
    return t > 0 ? clamp((Number(s.current_amount || 0) / t) * 100) : 0
  }
  if (goal.linked_habit_id && ctx.habitPct && goal.linked_habit_id in ctx.habitPct) return ctx.habitPct[goal.linked_habit_id]
  if (goal.goal_type === 'progress') return computeProgress(goal).pct
  const ms = Array.isArray(goal.milestones) ? goal.milestones : []
  if (ms.length) return clamp((ms.filter((m) => m.d).length / ms.length) * 100)
  return null // plain status goal: no real percentage
}

export function effectivePct(goal, ctx) {
  const d = derivedPct(goal, ctx)
  if (d != null) return d
  const s = goal.status || 'not_started'
  return s === 'done' ? 100 : s === 'in_progress' ? 50 : 0
}

export function effectiveStatus(goal, ctx) {
  const d = derivedPct(goal, ctx)
  if (d == null) return goal.status || 'not_started'
  if (d >= 100) return 'done'
  if (d <= 0) return 'not_started'
  return 'in_progress'
}

export function dueInfo(goal, status, today = new Date()) {
  if (!goal.target_date || status === 'done') return null
  const [y, m, d] = goal.target_date.split('-').map(Number)
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((new Date(y, m - 1, d) - t0) / 86400000)
  if (days < 0) return { days, label: `overdue ${-days}d`, tone: 'late' }
  if (days === 0) return { days, label: 'due today', tone: 'soon' }
  if (days <= 14) return { days, label: `in ${days}d`, tone: 'soon' }
  if (days <= 60) return { days, label: `in ${days}d`, tone: 'ok' }
  return { days, label: `in ${Math.round(days / 30)} mo`, tone: 'ok' }
}

// Badges come from real activity, not from how old the goal is.
export function computeBadges(goal, pct, status, updates = [], ctx = {}, now = new Date()) {
  const badges = []
  if (status !== 'not_started' || pct > 0) badges.push({ icon: '🏅', label: 'First step' })
  const recent = updates.filter((u) => now - new Date(u.created_at) <= 14 * 86400000)
  if (recent.length >= 3) badges.push({ icon: '🔥', label: 'On a roll' })
  if (goal.linked_habit_id && ctx.habitPct && (ctx.habitPct[goal.linked_habit_id] ?? 0) >= 70) badges.push({ icon: '🌸', label: 'Consistent' })
  if (pct >= 50) badges.push({ icon: '🎯', label: 'Halfway there' })
  if (pct >= 100) badges.push({ icon: '👑', label: 'Dream achieved' })
  return badges
}

export function progressStage(pct) {
  if (pct >= 100) return { label: 'Bloomed', icon: '👑' }
  if (pct >= 75) return { label: 'Thriving', icon: '🌳' }
  if (pct >= 25) return { label: 'Growing', icon: '🌿' }
  return { label: 'Seedling', icon: '🌱' }
}

// Habit consistency: share of the last `days` days with a log
export function habitConsistency(logs, habitId, days = 30, today = new Date()) {
  const set = new Set()
  for (const l of logs) if (String(l.habit_id) === String(habitId)) set.add(l.logged_date)
  let n = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    if (set.has(toIso(d))) n++
  }
  return clamp((n / days) * 100)
}

export function sparkPoints(values, w = 120, h = 24) {
  if (values.length < 2) return ''
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  return values.map((v, i) => `${Math.round((i / (values.length - 1)) * w)},${Math.round(h - 2 - ((v - min) / span) * (h - 4))}`).join(' ')
}

export function sortGoals(list, how, ctx) {
  const a = [...list]
  if (how === 'due') return a.sort((x, y) => (x.target_date || '9999') .localeCompare(y.target_date || '9999'))
  if (how === 'close') return a.sort((x, y) => effectivePct(y, ctx) - effectivePct(x, ctx))
  return a
}
