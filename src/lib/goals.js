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
  const kids = ctx.children?.[goal.id]
  if (kids && kids.length) {
    const sub = { ...ctx, children: {} }
    return clamp(kids.reduce((n, k) => n + effectivePct(k, sub), 0) / kids.length)
  }
  if (goal.linked_savings_id && ctx.savings?.[goal.linked_savings_id]) {
    const s = ctx.savings[goal.linked_savings_id]
    const t = Number(goal.cost) > 0 ? Number(goal.cost) : Number(s.target_amount)
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
  if (how === 'manual') return a.sort((x, y) => (x.sort_order ?? 1e9) - (y.sort_order ?? 1e9))
  return a
}

// ---------- round 2 ----------
const DAY = 86400000
const isoOf = toIso

export function firstOpenStep(goal) {
  const ms = Array.isArray(goal.milestones) ? goal.milestones : []
  const i = ms.findIndex((m) => !m.d)
  return i < 0 ? null : { index: i, step: ms[i] }
}

export function moveItem(arr, i, dir) {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const a = [...arr]
  ;[a[i], a[j]] = [a[j], a[i]]
  return a
}

export function stepDue(step, today = new Date()) {
  if (!step || step.d || !step.due) return null
  return dueInfo({ target_date: step.due }, 'in_progress', today)
}

// Linear projection of when a progress goal will finish, from its logged updates.
export function projectFinish(goal, updates, now = new Date()) {
  const pts = updates.map((u) => ({ t: new Date(u.created_at).getTime(), v: Number(u.value) })).filter((p) => !isNaN(p.t) && !isNaN(p.v))
  if (pts.length < 2) return null
  const first = pts[0], last = pts[pts.length - 1]
  const dt = last.t - first.t
  if (dt <= 0) return null
  const slope = (last.v - first.v) / dt
  const remaining = Number(goal.target_value) - last.v
  if (slope === 0 || remaining / slope < 0) return null
  if (remaining === 0) return isoOf(new Date(last.t))
  const finish = new Date(last.t + remaining / slope)
  if (finish.getTime() < now.getTime() - DAY * 365 || finish.getFullYear() > now.getFullYear() + 20) return null
  return isoOf(finish)
}

// No real movement for 30+ days (unless snoozed)
export function isStalled(goal, status, updates = [], now = new Date(), days = 30) {
  if (status === 'done' || goal.archived) return false
  if (goal.snoozed_until && new Date(goal.snoozed_until + 'T23:59:59') >= now) return false
  const stamps = [goal.created_at, goal.touched_at, ...updates.map((u) => u.created_at)].filter(Boolean).map((s) => new Date(s).getTime())
  if (!stamps.length) return false
  return now.getTime() - Math.max(...stamps) >= days * DAY
}

export function recapStats(goals, ctx, year) {
  const doneIn = goals.filter((g) => {
    if (effectiveStatus(g, ctx) !== 'done') return false
    const when = g.completed_at || g.created_at
    return when && new Date(when).getFullYear() === year
  })
  const eras = {}
  doneIn.forEach((g) => { if (g.category) eras[g.category] = (eras[g.category] || 0) + 1 })
  const top = Object.entries(eras).sort((a, b) => b[1] - a[1])[0]
  return {
    slayed: doneIn,
    rewards: doneIn.filter((g) => g.reward_claimed).length,
    topEra: top ? top[0] : null,
  }
}

export function dreamReminders(goals, ctx, today = new Date()) {
  const out = []
  const stamp = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  for (const g of goals) {
    if (g.archived) continue
    const status = effectiveStatus(g, ctx)
    if (status === 'done') continue
    const d = dueInfo(g, status, today)
    if (d && d.days === 0) out.push({ key: `d-${g.id}-0-${stamp}`, title: `🌱 "${g.title}" is due today`, body: 'Last push — you got this.' })
    else if (d && d.days === 1) out.push({ key: `d-${g.id}-1-${stamp}`, title: `🌱 "${g.title}" is due tomorrow`, body: '' })
    else if (d && d.days === 7) out.push({ key: `d-${g.id}-7-${stamp}`, title: `🌱 "${g.title}" is due in a week`, body: '' })
    ;(Array.isArray(g.milestones) ? g.milestones : []).forEach((m, i) => {
      const s = stepDue(m, today)
      if (s && s.days === 0) out.push({ key: `s-${g.id}-${i}-${stamp}`, title: `✅ Step due today: ${m.t}`, body: g.title })
    })
  }
  return out
}

// Home-page tie-in
export function dreamHighlights(goals, ctx, today = new Date()) {
  const live = goals.filter((g) => !g.archived && effectiveStatus(g, ctx) !== 'done')
  const chips = []
  const pinned = live.filter((g) => g.pinned)
  const seen = new Set()
  for (const g of live) {
    const d = dueInfo(g, effectiveStatus(g, ctx), today)
    if (d && d.days <= 7) { chips.push({ text: `${g.title} · ${d.label}` }); seen.add(g.id) }
  }
  for (const g of pinned) if (!seen.has(g.id)) chips.push({ text: `${g.title} · ${effectivePct(g, ctx)}%` })
  const closest = live
    .filter((g) => derivedPct(g, ctx) != null)
    .map((g) => ({ title: g.title, pct: effectivePct(g, ctx) }))
    .sort((a, b) => b.pct - a.pct)[0] || null
  return { chips: chips.slice(0, 3), closest }
}

export const TEMPLATES = [
  { label: '💸 Save R10k', form: { title: 'Save R10 000', category: '💸 Rich Girl Era', goal_type: 'progress', start_value: '0', current_value: '0', target_value: '10000', unit: 'R', cover_emoji: '💸' } },
  { label: '🏃 Run a 5k', form: { title: 'Run a 5k', category: '💪 Strong Girl Era', goal_type: 'simple', cover_emoji: '🏃', milestones: ['Get running shoes', 'Run 1k without stopping', 'Run 3k', 'Run 5k'] } },
  { label: '📚 Read 12 books', form: { title: 'Read 12 books', category: '📚 Smart Girl Era', goal_type: 'progress', start_value: '0', current_value: '0', target_value: '12', unit: 'books', cover_emoji: '📚' } },
  { label: '🌍 Plan a trip', form: { title: 'Plan a dream trip', category: '✈️ Passport Princess Era', goal_type: 'simple', cover_emoji: '✈️', milestones: ['Pick destination', 'Set budget', 'Book flights', 'Book stay', 'Pack'] } },
  { label: '🏡 Declutter home', form: { title: 'Declutter the house', category: '🏡 Cozy Girl Era', goal_type: 'simple', cover_emoji: '🏡', milestones: ['Wardrobe', 'Kitchen', 'Bathroom', 'Paperwork', 'Donate bags'] } },
]

// ---------- round 3 ----------
export function childrenMap(goals) {
  const m = {}
  goals.forEach((g) => { if (g.parent_id) (m[g.parent_id] = m[g.parent_id] || []).push(g) })
  return m
}

// Move goal `id` to `toIndex` in `list`; returns [{id, sort_order}] for the whole list
export function reorderIds(list, id, toIndex) {
  const ids = list.map((g) => g.id)
  const from = ids.indexOf(id)
  if (from < 0) return []
  ids.splice(from, 1)
  ids.splice(Math.max(0, Math.min(ids.length, toIndex)), 0, id)
  return ids.map((x, i) => ({ id: x, sort_order: i }))
}

const ERA_PALETTE = ['#F4B6C2', '#F6D0C8', '#D9C7F0', '#C9E4DE', '#FBE3A5', '#BFD7F2']
export function eraColor(era) {
  if (!era) return null
  let h = 0
  for (const ch of era) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return ERA_PALETTE[h % ERA_PALETTE.length]
}

export const AFFIRMATIONS = [
  'Delulu is the solulu.',
  'Future you is already proud.',
  'Small steps still count as steps, babe.',
  'You don’t need a perfect plan, just the next step.',
  'Main character energy, one tick at a time.',
  'Your dreams called — they’re on their way.',
  'Slow progress is still glow-up progress.',
  'Manifesting, but make it organised.',
]
export function affirmationOf(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  const day = Math.floor((date - start) / DAY)
  return AFFIRMATIONS[day % AFFIRMATIONS.length]
}

// ISO-ish week key (Mon-based) for weekly check-ins
export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoOf(d)
}
export const checkinDue = (date = new Date()) => date.getDay() === 0 || date.getDay() === 1

export function shareText(goal, pct) {
  return `🌱 ${goal.title} — ${pct}%${goal.target_date ? ` · target ${goal.target_date}` : ''}${goal.category ? ` · ${goal.category}` : ''}`
}
