import { useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import ConfirmSheet from './ConfirmSheet'
import UndoBar from './UndoBar'
import {
  derivedPct, effectivePct, effectiveStatus, dueInfo, computeBadges, progressStage,
  habitConsistency, sparkPoints, sortGoals,
  firstOpenStep, moveItem, stepDue, projectFinish, isStalled, recapStats, TEMPLATES,
} from './lib/goals'
import { toIso } from './lib/social'

const emptyForm = {
  title: '', category: '', newEra: '', target_date: '', status: 'not_started', notes: '',
  goal_type: 'simple', start_value: '', current_value: '', target_value: '', unit: '', reward: '',
  milestones: [], cover_emoji: '', cover_color: '', cover_url: '', linked_savings_id: '', linked_habit_id: '',
}

const STATUS_LABELS = { not_started: '🌱 Not started', in_progress: '🚀 In motion', done: '👑 Slayed' }
const STATUS_COLORS = { not_started: 'var(--accent-deep)', in_progress: 'var(--accent-deep)', done: 'var(--lavender)' }
const COVER_COLORS = ['#F4B6C2', '#F6D0C8', '#D9C7F0', '#C9E4DE', '#FBE3A5', '#BFD7F2']
const NEW_ERA = '__new__'

const ERA_OPTIONS = [
  '🌸 Glow-Up Era', '💸 Rich Girl Era', '👑 Main Character Era', '🌿 Peace Era',
  '💼 CEO Era', '💖 Lover Girl Era', '🏡 Cozy Girl Era', '📚 Smart Girl Era',
  '✈️ Passport Princess Era', '💪 Strong Girl Era', '🎨 Creative Girl Era', '🎀 Dream Life Era',
  '🔥 Discipline Era', '🌙 Healing Era', '🍒 Hot Girl Era', '🦋 Reinvention Era',
  '⭐ Success Era', '☁️ Soft Life Era', '🧘 Wellness Era', '💎 Luxury Era',
  '🛍️ Wishlist Era', '🏠 Homebody Era', '👶 Family Era', '🐾 Pet Mom Era',
  '🌎 Adventure Era', '🎯 Level-Up Era', '📈 Money Moves Era', '✨ Becoming Her Era',
  '💌 Self-Love Era', '🌻 Happy Girl Era', '🥂 Celebration Era', '🎄 Holiday Era',
  '🧁 Hobby Era', '🎓 Student Era', '💻 Content Creator Era', '🚀 Side Hustle Era',
  '🗂️ Life Admin Era', '🕊️ Fresh Start Era', '🌈 Bucket List Era', '🍵 Slow Living Era',
  '💫 Future Me Era',
]

const V2_HINT = 'run dream-board-v2.sql in Supabase, then refresh'
const hint = (msg) => (/column|schema cache|relation|does not exist/i.test(msg || '') ? `${msg} — ${V2_HINT}.` : msg)

function formatDate(d) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['var(--lavender)', 'var(--accent-deep)', '#F6D0C8', 'var(--coral)', '#FBE3A5']
    return Array.from({ length: 28 }, (_, i) => ({
      id: i, color: colors[i % colors.length], left: Math.round(Math.random() * 100), delay: Math.random() * 0.3,
    }))
  }, [])
  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} className="confetti-piece" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  )
}

export default function GoalsView() {
  const [goals, setGoals] = useState([])
  const [updates, setUpdates] = useState([])
  const [savings, setSavings] = useState([])
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('new')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [progressInputs, setProgressInputs] = useState({})
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [undo, setUndo] = useState(null)
  const [celebrate, setCelebrate] = useState(null)
  const [newStep, setNewStep] = useState('')
  const [view, setView] = useState('cards')
  const [groupEra, setGroupEra] = useState(false)
  const [chartId, setChartId] = useState(null)
  const [recapOpen, setRecapOpen] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [inlineStep, setInlineStep] = useState({})

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const [g, u, s, h, hl] = await Promise.all([
      supabase.from('goals').select('*').order('created_at', { ascending: false }),
      supabase.from('goal_updates').select('*').order('created_at', { ascending: true }),
      supabase.from('savings_goals').select('id,name,icon,target_amount,current_amount'),
      supabase.from('habits').select('id,name'),
      supabase.from('habit_logs').select('habit_id,logged_date'),
    ])
    if (g.error) setError(g.error.message)
    else setGoals(g.data || [])
    if (u.error) setNote(`Progress history isn't available yet — ${V2_HINT}.`)
    else { setUpdates(u.data || []); setNote(null) }
    setSavings(s.data || [])
    setHabits(h.data || [])
    setHabitLogs(hl.data || [])
    setLoading(false)
  }

  async function refreshGoals() {
    const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
    if (error) setError(hint(error.message)); else setGoals(data || [])
  }

  const ctx = useMemo(() => {
    const sv = {}
    savings.forEach((s) => { sv[s.id] = s })
    const hp = {}
    habits.forEach((h) => { hp[h.id] = habitConsistency(habitLogs, h.id) })
    return { savings: sv, habitPct: hp }
  }, [savings, habits, habitLogs])

  const updatesByGoal = useMemo(() => {
    const m = {}
    updates.forEach((u) => { (m[u.goal_id] = m[u.goal_id] || []).push(u) })
    return m
  }, [updates])

  const eraList = useMemo(() => {
    const used = goals.map((g) => g.category).filter(Boolean)
    return [...new Set([...used.filter((c) => !ERA_OPTIONS.includes(c)), ...ERA_OPTIONS])]
  }, [goals])

  function fireCelebration(id) {
    setCelebrate(id)
    setTimeout(() => setCelebrate((c) => (c === id ? null : c)), 2600)
  }

  function openAdd() {
    setEditingId(null); setForm(emptyForm); setMoreOpen(false); setNewStep(''); setModalOpen(true)
  }

  function openEdit(goal) {
    setEditingId(goal.id)
    setForm({
      title: goal.title || '', category: goal.category || '', newEra: '',
      target_date: goal.target_date || '', status: goal.status || 'not_started', notes: goal.notes || '',
      goal_type: goal.goal_type || 'simple',
      start_value: goal.start_value != null ? String(goal.start_value) : '',
      current_value: goal.current_value != null ? String(goal.current_value) : '',
      target_value: goal.target_value != null ? String(goal.target_value) : '',
      unit: goal.unit || '', reward: goal.reward || '',
      milestones: Array.isArray(goal.milestones) ? goal.milestones : [],
      cover_emoji: goal.cover_emoji || '', cover_color: goal.cover_color || '', cover_url: goal.cover_url || '',
      linked_savings_id: goal.linked_savings_id || '', linked_habit_id: goal.linked_habit_id || '',
    })
    setMoreOpen(!!(goal.cover_emoji || goal.cover_color || goal.cover_url || goal.linked_savings_id || goal.linked_habit_id))
    setNewStep('')
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setForm(emptyForm); setConfirmDelete(false) }

  function addStep() {
    const t = newStep.trim()
    if (!t) return
    setForm((f) => ({ ...f, milestones: [...f.milestones, { t, d: false }] }))
    setNewStep('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const isProgress = form.goal_type === 'progress'
    const existing = goals.find((g) => g.id === editingId)
    const era = form.category === NEW_ERA ? form.newEra.trim() : form.category
    const steps = [...form.milestones, ...(newStep.trim() ? [{ t: newStep.trim(), d: false }] : [])]
    const payload = {
      title: form.title.trim(),
      category: era || null,
      target_date: form.target_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
      goal_type: form.goal_type,
      start_value: isProgress ? parseFloat(form.start_value) || 0 : null,
      current_value: isProgress ? parseFloat(form.current_value) || parseFloat(form.start_value) || 0 : null,
      target_value: isProgress ? parseFloat(form.target_value) || 0 : null,
      unit: isProgress ? form.unit.trim() || null : null,
      reward: form.reward.trim() || null,
    }
    // v2 columns are only sent when used (or already present), so saving works before the SQL is run
    const v2 = {
      milestones: steps,
      cover_emoji: form.cover_emoji.trim() || null,
      cover_color: form.cover_color || null,
      cover_url: form.cover_url.trim() || null,
      linked_savings_id: form.linked_savings_id || null,
      linked_habit_id: form.linked_habit_id || null,
    }
    if (existing) {
      if ('touched_at' in existing) payload.touched_at = new Date().toISOString()
      if ('completed_at' in existing && effectiveStatus(existing, ctx) !== 'done' && effectiveStatus({ ...existing, ...payload }, ctx) === 'done') payload.completed_at = new Date().toISOString()
    }
    Object.entries(v2).forEach(([k, v]) => {
      const used = Array.isArray(v) ? v.length > 0 : v != null
      if (used || (existing && k in existing)) payload[k] = v
    })

    let error
    if (editingId) ({ error } = await supabase.from('goals').update(payload).eq('id', editingId))
    else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('goals').insert({ ...payload, user_id }))
    }
    setSaving(false)
    if (error) { setError(hint(error.message)); return }
    const wasDone = existing && effectiveStatus(existing, ctx) === 'done'
    if (editingId && !wasDone && effectiveStatus({ ...existing, ...payload }, ctx) === 'done') fireCelebration(editingId)
    closeModal()
    refreshGoals()
  }

  async function patchGoal(id, patch, okUndo) {
    const { error } = await supabase.from('goals').update(patch).eq('id', id)
    if (error) { setError(hint(error.message)); return false }
    if (okUndo) setUndo(okUndo)
    await refreshGoals()
    return true
  }

  async function toggleStep(goal, idx) {
    const before = effectiveStatus(goal, ctx)
    const ms = goal.milestones.map((m, i) => (i === idx ? { ...m, d: !m.d } : m))
    const becameDone = before !== 'done' && effectiveStatus({ ...goal, milestones: ms }, ctx) === 'done'
    const ok = await patchGoal(goal.id, { milestones: ms, ...stamps(goal, becameDone) })
    if (ok && becameDone) fireCelebration(goal.id)
  }

  async function addInlineStep(goal) {
    const t = (inlineStep[goal.id] || '').trim()
    if (!t) return
    const ms = [...(Array.isArray(goal.milestones) ? goal.milestones : []), { t, d: false }]
    const ok = await patchGoal(goal.id, { milestones: ms, ...stamps(goal, false) })
    if (ok) setInlineStep((v) => ({ ...v, [goal.id]: '' }))
  }

  async function moveStep(goal, i, dir) {
    await patchGoal(goal.id, { milestones: moveItem(goal.milestones, i, dir) })
  }

  async function togglePin(goal) {
    if (!goal.pinned && live.filter((g) => g.pinned).length >= 3) { setError('You can pin up to 3 dreams to "This week" — unpin one first.'); return }
    await patchGoal(goal.id, { pinned: !goal.pinned })
  }

  async function snooze(goal) {
    const d = new Date(); d.setDate(d.getDate() + 30)
    await patchGoal(goal.id, { snoozed_until: toIso(d) }, { message: `Snoozed "${goal.title}" for 30 days`, run: async () => { await patchGoal(goal.id, { snoozed_until: null }) } })
  }

  function stamps(goal, becameDone) {
    const out = {}
    if ('touched_at' in goal) out.touched_at = new Date().toISOString()
    if (becameDone && 'completed_at' in goal) out.completed_at = new Date().toISOString()
    return out
  }

  function applyTemplate(t) {
    setForm({ ...emptyForm, ...t.form, milestones: (t.form.milestones || []).map((x) => ({ t: x, d: false })) })
    setMoreOpen(!!t.form.cover_emoji)
  }

  function duplicateGoal() {
    setEditingId(null)
    setForm((f) => ({
      ...f, title: `${f.title} (copy)`, status: 'not_started',
      current_value: f.goal_type === 'progress' ? f.start_value : '', milestones: f.milestones.map((m) => ({ ...m, d: false })),
    }))
  }

  async function updateProgress(goal) {
    const raw = progressInputs[goal.id]
    if (raw === undefined || raw === '') return
    const value = parseFloat(raw)
    if (isNaN(value)) { setError('Enter a number for the new value.'); return }
    const prev = goal.current_value
    const before = effectiveStatus(goal, ctx)
    const becameDone = before !== 'done' && effectiveStatus({ ...goal, current_value: value }, ctx) === 'done'
    const { error } = await supabase.from('goals').update({ current_value: value, ...stamps(goal, becameDone) }).eq('id', goal.id)
    if (error) { setError(hint(error.message)); return }
    let logId = null
    if (!note) {
      const user_id = await getUserId()
      const r = await supabase.from('goal_updates').insert({ user_id, goal_id: String(goal.id), value }).select().single()
      if (r.error) setError(hint(r.error.message)); else { logId = r.data.id; setUpdates((u) => [...u, r.data]) }
    }
    setProgressInputs((v) => ({ ...v, [goal.id]: '' }))
    setUndo({
      message: `Updated "${goal.title}" to ${value}`,
      run: async () => {
        const r1 = await supabase.from('goals').update({ current_value: prev }).eq('id', goal.id)
        if (r1.error) { setError(hint(r1.error.message)); return }
        if (logId) {
          const r2 = await supabase.from('goal_updates').delete().eq('id', logId)
          if (r2.error) setError(hint(r2.error.message)); else setUpdates((u) => u.filter((x) => x.id !== logId))
        }
        refreshGoals()
      },
    })
    await refreshGoals()
    if (before !== 'done' && effectiveStatus({ ...goal, current_value: value }, ctx) === 'done') fireCelebration(goal.id)
  }

  async function claimReward(goal) {
    await patchGoal(goal.id, { reward_claimed: true })
  }

  async function archiveGoal(goal, archived) {
    await patchGoal(goal.id, { archived }, {
      message: archived ? `Archived "${goal.title}"` : `Restored "${goal.title}"`,
      run: async () => { await patchGoal(goal.id, { archived: !archived }) },
    })
  }

  async function handleDelete() {
    const goal = goals.find((g) => g.id === editingId)
    if (!goal) return
    setSaving(true)
    const { error } = await supabase.from('goals').delete().eq('id', goal.id)
    setSaving(false)
    setConfirmDelete(false)
    if (error) { setError(hint(error.message)); return }
    closeModal()
    setUndo({
      message: `Deleted "${goal.title}"`,
      run: async () => {
        const { id: _id, ...rest } = goal
        const { error: e2 } = await supabase.from('goals').insert(rest)
        if (e2) setError(hint(e2.message)); else refreshGoals()
      },
    })
    refreshGoals()
  }

  const isArchived = (g) => g.archived === true
  const live = goals.filter((g) => !isArchived(g))
  const archived = goals.filter(isArchived)

  const base = statusFilter === 'archived' ? archived : live
  const filtered = sortGoals(base.filter((g) => {
    const q = search.toLowerCase()
    const hit = g.title.toLowerCase().includes(q) || (g.category || '').toLowerCase().includes(q) || (g.notes || '').toLowerCase().includes(q)
    const okStatus = statusFilter === 'all' || statusFilter === 'archived' || effectiveStatus(g, ctx) === statusFilter
    return hit && okStatus
  }), sort, ctx)

  const counts = {
    all: live.length,
    not_started: live.filter((g) => effectiveStatus(g, ctx) === 'not_started').length,
    in_progress: live.filter((g) => effectiveStatus(g, ctx) === 'in_progress').length,
    done: live.filter((g) => effectiveStatus(g, ctx) === 'done').length,
  }
  const active = live.filter((g) => effectiveStatus(g, ctx) !== 'done')
  const closest = active
    .filter((g) => derivedPct(g, ctx) != null)
    .map((g) => ({ g, pct: effectivePct(g, ctx) }))
    .sort((a, b) => b.pct - a.pct)[0]
  const eraCounts = {}
  active.forEach((g) => { if (g.category) eraCounts[g.category] = (eraCounts[g.category] || 0) + 1 })
  const topEra = Object.entries(eraCounts).sort((a, b) => b[1] - a[1])[0]

  const showFocus = statusFilter === 'all' && !search
  const focus = showFocus ? filtered.filter((g) => g.pinned) : []
  const rest = showFocus ? filtered.filter((g) => !g.pinned) : filtered
  const eraGroups = groupEra
    ? Object.entries(rest.reduce((m, g) => { const k = g.category || 'No era yet'; (m[k] = m[k] || []).push(g); return m }, {}))
    : null
  const chartGoal = goals.find((g) => g.id === chartId)
  const recapYear = new Date().getFullYear()
  const recap = recapOpen ? recapStats(goals, ctx, recapYear) : null

  function renderCard(g) {
    const status = effectiveStatus(g, ctx)
    const pct = effectivePct(g, ctx)
    const real = derivedPct(g, ctx) != null
    const stage = progressStage(pct)
    const ups = updatesByGoal[g.id] || []
    const badges = computeBadges(g, pct, status, ups, ctx)
    const due = dueInfo(g, status)
    const steps = Array.isArray(g.milestones) ? g.milestones : []
    const next = firstOpenStep(g)
    const open = !!expanded[g.id]
    const isProgress = g.goal_type === 'progress'
    const sv = g.linked_savings_id && ctx.savings[g.linked_savings_id]
    const hb = g.linked_habit_id && habits.find((h) => String(h.id) === String(g.linked_habit_id))
    const accent = g.cover_color || STATUS_COLORS[status]
    const spark = sparkPoints([Number(g.start_value), ...ups.map((u) => Number(u.value))])
    const stalled = isStalled(g, status, ups)
    const shown = open ? steps.map((m, i) => i) : next ? [next.index] : []
    return (
      <div className="contact-card dream-card" key={g.id} style={{ borderTopColor: accent }}>
        {celebrate === g.id && <Confetti />}
        {g.cover_url && <img className="dream-cover" src={g.cover_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <div onClick={() => openEdit(g)} style={{ cursor: 'pointer' }}>
          <div className="dream-top">
            <span className="status-badge" style={{ background: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
            <span className="dream-top-right">
              {due && <span className={`dream-due dream-due-${due.tone}`}>{due.label}</span>}
              {!isArchived(g) && (
                <button className={`dream-pin ${g.pinned ? 'on' : ''}`} aria-label={g.pinned ? 'Unpin from this week' : 'Pin to this week'} title={g.pinned ? 'Unpin from this week' : 'Pin to this week'} onClick={(e) => { e.stopPropagation(); togglePin(g) }}>{g.pinned ? '★' : '☆'}</button>
              )}
            </span>
          </div>
          <h3 className="contact-name" title={g.title}>
            {g.cover_emoji && <span className="dream-emoji" style={{ background: g.cover_color || 'var(--accent-tint)' }}>{g.cover_emoji}</span>}
            {g.title}
          </h3>
          {g.category && <p className="contact-relationship goal-era">{g.category}</p>}
          {g.target_date && <p className="dream-date">Target {formatDate(g.target_date)}</p>}
          {g.notes && <p className="contact-notes">{g.notes}</p>}
        </div>

        {(real || status === 'in_progress') && (
          <div className="progress-row">
            <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: STATUS_COLORS[status] }} /></div>
            <span className="progress-label">
              {stage.icon} {stage.label}
              {steps.length > 0 && ` — ${steps.filter((m) => m.d).length} of ${steps.length} steps`}
              {isProgress && ` — ${g.current_value} / ${g.target_value} ${g.unit || ''}`}
              {sv && ` — ${sv.icon || '💰'} ${sv.name}`}
              {hb && ` — 🔁 ${hb.name} (30d)`}
              {' '}({pct}%)
            </span>
          </div>
        )}

        {steps.length > 0 && (
          <div className="dream-steps-wrap">
            <ul className="dream-steps">
              {shown.map((i) => {
                const m = steps[i]
                const sd = stepDue(m)
                return (
                  <li key={i}>
                    <label>
                      <input type="checkbox" checked={!!m.d} onChange={() => toggleStep(g, i)} />
                      <span className={m.d ? 'dream-step-done' : ''}>{!open && <em className="dream-next">Next: </em>}{m.t}</span>
                      {sd && <span className={`dream-due dream-due-${sd.tone}`}>{sd.label}</span>}
                    </label>
                    {open && (
                      <span className="dream-step-move">
                        <button aria-label="Move step up" disabled={i === 0} onClick={() => moveStep(g, i, -1)}>▲</button>
                        <button aria-label="Move step down" disabled={i === steps.length - 1} onClick={() => moveStep(g, i, 1)}>▼</button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <button className="sc-more-toggle" onClick={() => setExpanded((v) => ({ ...v, [g.id]: !open }))}>
              {open ? '▾ Hide steps' : `▸ All steps (${steps.length})`}
            </button>
            {open && (
              <div className="dream-step-edit">
                <input value={inlineStep[g.id] || ''} placeholder="Add a step" onChange={(e) => setInlineStep((v) => ({ ...v, [g.id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addInlineStep(g)} />
                <button className="sc-chip-btn" onClick={() => addInlineStep(g)}>Add</button>
              </div>
            )}
          </div>
        )}

        {isProgress && ups.length > 0 && spark && (
          <button className="dream-spark-btn" onClick={() => setChartId(g.id)} aria-label="Open progress history">
            <svg className="dream-spark" viewBox="0 0 120 24" preserveAspectRatio="none"><polyline points={spark} fill="none" stroke="var(--accent-deep)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
            <span>📈 History</span>
          </button>
        )}

        {stalled && !isArchived(g) && (
          <div className="dream-stalled">
            <span>💤 No movement in 30+ days — still want this?</span>
            <span className="dream-stalled-actions">
              <button className="sc-chip-btn" onClick={() => snooze(g)}>Snooze 30d</button>
              <button className="sc-chip-btn" onClick={() => archiveGoal(g, true)}>Archive</button>
              <button className="sc-chip-btn" onClick={() => openEdit(g)}>Update</button>
            </span>
          </div>
        )}

        {badges.length > 0 && (
          <div className="goal-badges-row">
            {badges.map((b) => <span className="goal-badge" key={b.label}>{b.icon} {b.label}</span>)}
          </div>
        )}

        {g.reward && (
          <p className="goal-reward">
            🎁 {g.reward_claimed ? 'Claimed: ' : 'Reward: '}{g.reward}
            {status === 'done' && !g.reward_claimed && (
              <button className="sc-chip-btn dream-claim" onClick={() => claimReward(g)}>Claim reward</button>
            )}
          </p>
        )}

        {isProgress && !isArchived(g) && !g.linked_savings_id && (
          <div className="log-value-row">
            <input
              type="number" className="log-value-input" placeholder="Update current value"
              value={progressInputs[g.id] || ''}
              onChange={(e) => setProgressInputs((v) => ({ ...v, [g.id]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && updateProgress(g)}
            />
            <button className="btn-check log-value-btn" onClick={() => updateProgress(g)}>Update</button>
          </div>
        )}

        {status === 'done' && !isArchived(g) && (
          <button className="sc-chip-btn dream-archive" onClick={() => archiveGoal(g, true)}>🗄️ Archive</button>
        )}
        {isArchived(g) && (
          <button className="sc-chip-btn dream-archive" onClick={() => archiveGoal(g, false)}>↩ Restore</button>
        )}
      </div>
    )
  }

  function renderTile(g) {
    const status = effectiveStatus(g, ctx)
    const pct = effectivePct(g, ctx)
    const bg = g.cover_url ? `center / cover url("${g.cover_url}")` : (g.cover_color || 'var(--accent-tint)')
    return (
      <button key={g.id} className="dream-tile" style={{ background: bg }} onClick={() => openEdit(g)}>
        {g.pinned && <span className="dream-tile-pin">★</span>}
        {status === 'done' && <span className="dream-tile-done">👑</span>}
        {!g.cover_url && <span className="dream-tile-emoji">{g.cover_emoji || '✨'}</span>}
        <span className="dream-tile-label">
          <b>{g.title}</b>
          <span className="progress-track"><span className="progress-fill" style={{ width: `${pct}%`, display: 'block', height: '100%', background: STATUS_COLORS[status] }} /></span>
        </span>
      </button>
    )
  }

  const renderList = (list) => (view === 'vision'
    ? <div className="dream-vision">{list.map(renderTile)}</div>
    : <div className="card-grid">{list.map(renderCard)}</div>)

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Dream Board</h1>
          <p className="view-subtitle cake-club-subtitle">✨ Delulu? No. Visionary.</p>
        </div>
      </div>

      <div className="sc-actionbar dream-actionbar">
        <input className="search-box" placeholder="Search dreams…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="dream-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort dreams">
          <option value="new">Newest</option>
          <option value="due">Due soon</option>
          <option value="close">Closest to done</option>
        </select>
        <div className="toolbar"><button className="btn-primary" onClick={openAdd} aria-label="Add dream">+ Add</button></div>
      </div>

      {live.length > 0 && (
        <p className="dream-summary">
          <b>{active.length}</b> active · <b>{counts.done}</b> slayed
          {closest && <> · closest: <b>{closest.g.title}</b> ({closest.pct}%)</>}
          {topEra && <> · era: <b>{topEra[0]}</b></>}
        </p>
      )}

      <div className="filter-row">
        {[['all', '✨ All'], ['not_started', '🌱 Not started'], ['in_progress', '🚀 In motion'], ['done', '👑 Slayed']].map(([k, label]) => (
          <button key={k} className={`filter-pill ${statusFilter === k ? 'filter-pill-active' : ''}`} onClick={() => setStatusFilter(k)}>
            {label} ({counts[k]})
          </button>
        ))}
        {archived.length > 0 && (
          <button className={`filter-pill ${statusFilter === 'archived' ? 'filter-pill-active' : ''}`} onClick={() => setStatusFilter('archived')}>
            🗄️ Archived ({archived.length})
          </button>
        )}
      </div>

      <div className="dream-viewbar">
        <button className={`sc-filter-btn ${view === 'cards' ? 'on' : ''}`} onClick={() => setView('cards')}>▦ Cards</button>
        <button className={`sc-filter-btn ${view === 'vision' ? 'on' : ''}`} onClick={() => setView('vision')}>🖼 Vision board</button>
        {view === 'cards' && <button className={`sc-filter-btn ${groupEra ? 'on' : ''}`} onClick={() => setGroupEra((v) => !v)}>Group by era</button>}
        <button className="sc-filter-btn" onClick={() => setRecapOpen(true)}>🏆 Recap</button>
      </div>

      {loading && <p className="loading">Rounding up your ambitions… 🌟</p>}
      {error && <p className="error-msg">{error}</p>}
      {note && <p className="field-hint">{note}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <h3>{goals.length === 0 ? 'Nothing here yet — big things start small ✨' : 'No matches'}</h3>
          <p>{goals.length === 0 ? "Add the first thing you're manifesting — you got this, bestie." : 'Try a different search or filter.'}</p>
        </div>
      )}

      {!loading && focus.length > 0 && (
        <section className="dream-focus">
          <h2 className="dream-section">⭐ This week</h2>
          {renderList(focus)}
        </section>
      )}

      {!loading && rest.length > 0 && (
        eraGroups ? eraGroups.map(([era, list]) => (
          <details className="dream-group" key={era} open>
            <summary>{era} <span>({list.length})</span></summary>
            {renderList(list)}
          </details>
        )) : (
          <>
            {focus.length > 0 && <h2 className="dream-section">Everything else</h2>}
            {renderList(rest)}
          </>
        )
      )}

      {undo && <UndoBar message={undo.message} onUndo={() => { const r = undo.run; setUndo(null); r() }} onDismiss={() => setUndo(null)} />}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit dream' : 'New dream'}</h2>
            {!editingId && !form.title && (
              <div className="dream-templates">
                <span className="field-hint">Start from a template:</span>
                {TEMPLATES.map((t) => <button type="button" key={t.label} className="sc-chip-btn" onClick={() => applyTemplate(t)}>{t.label}</button>)}
              </div>
            )}
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Title</label>
                <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What are you working toward?" required />
              </div>
              <div className="field">
                <label>Era</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Pick your era…</option>
                  {eraList.map((e) => <option key={e} value={e}>{e}</option>)}
                  <option value={NEW_ERA}>➕ New era…</option>
                </select>
                {form.category === NEW_ERA && (
                  <input style={{ marginTop: 6 }} value={form.newEra} onChange={(e) => setForm({ ...form, newEra: e.target.value })} placeholder="🌟 My Own Era" />
                )}
              </div>

              <div className="field">
                <label>How do you want to track it?</label>
                <div className="toggle-group">
                  <button type="button" className={`toggle-btn ${form.goal_type === 'simple' ? 'toggle-btn-active' : ''}`} onClick={() => setForm({ ...form, goal_type: 'simple' })}>✓ Steps / status</button>
                  <button type="button" className={`toggle-btn ${form.goal_type === 'progress' ? 'toggle-btn-active' : ''}`} onClick={() => setForm({ ...form, goal_type: 'progress' })}>📊 Progress bar</button>
                </div>
              </div>

              {form.goal_type === 'simple' ? (
                <>
                  <div className="field">
                    <label>Steps {form.milestones.length > 0 && `(${form.milestones.filter((m) => m.d).length}/${form.milestones.length})`}</label>
                    {form.milestones.map((m, i) => (
                      <div className="dream-step-edit" key={i}>
                        <input type="checkbox" checked={!!m.d} onChange={() => setForm({ ...form, milestones: form.milestones.map((x, j) => (j === i ? { ...x, d: !x.d } : x)) })} />
                        <input value={m.t} onChange={(e) => setForm({ ...form, milestones: form.milestones.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)) })} />
                        <input type="date" className="dream-step-date" aria-label="Step due date" value={m.due || ''} onChange={(e) => setForm({ ...form, milestones: form.milestones.map((x, j) => (j === i ? { ...x, due: e.target.value || undefined } : x)) })} />
                        <button type="button" className="sc-icon-btn" aria-label="Move step up" disabled={i === 0} onClick={() => setForm({ ...form, milestones: moveItem(form.milestones, i, -1) })}>▲</button>
                        <button type="button" className="sc-icon-btn" aria-label="Move step down" disabled={i === form.milestones.length - 1} onClick={() => setForm({ ...form, milestones: moveItem(form.milestones, i, 1) })}>▼</button>
                        <button type="button" className="sc-icon-btn" aria-label="Remove step" onClick={() => setForm({ ...form, milestones: form.milestones.filter((_, j) => j !== i) })}>✕</button>
                      </div>
                    ))}
                    <div className="dream-step-edit">
                      <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }} placeholder="Add a step and press Enter" />
                      <button type="button" className="sc-chip-btn" onClick={addStep}>Add</button>
                    </div>
                    <p className="field-hint">With steps, progress is real (3 of 5). Without, use the status below.</p>
                  </div>
                  {form.milestones.length === 0 && (
                    <div className="field">
                      <label>Status</label>
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="field-hint">e.g. weight loss: start 80, target 70, unit kg. Or savings: start 0, target 5000, unit R.</p>
                  <div className="field-row">
                    <div className="field"><label>Start value</label><input type="number" value={form.start_value} onChange={(e) => setForm({ ...form, start_value: e.target.value })} placeholder="e.g. 80" /></div>
                    <div className="field"><label>Target value</label><input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} placeholder="e.g. 70" /></div>
                  </div>
                  <div className="field-row">
                    <div className="field"><label>Current value</label><input type="number" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} placeholder="Defaults to start value" /></div>
                    <div className="field"><label>Unit</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, R, pages…" /></div>
                  </div>
                </>
              )}

              <div className="field">
                <label>Target date</label>
                <input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
              </div>
              <div className="field">
                <label>🎁 Reward when you get there</label>
                <input value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} placeholder="New shoes, a spa day, that trip…" />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Why this matters, how you'll get there…" />
              </div>

              <button type="button" className="sc-more-toggle" onClick={() => setMoreOpen((o) => !o)}>
                {moreOpen ? '▾ Fewer options' : '▸ More options (look & links)'}
              </button>
              {moreOpen && (
                <>
                  <div className="field-row">
                    <div className="field"><label>Cover emoji</label><input value={form.cover_emoji} maxLength={4} onChange={(e) => setForm({ ...form, cover_emoji: e.target.value })} placeholder="🏡" /></div>
                    <div className="field">
                      <label>Colour</label>
                      <div className="dream-swatches">
                        {COVER_COLORS.map((c) => (
                          <button type="button" key={c} aria-label={`Colour ${c}`} className={`dream-swatch ${form.cover_color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, cover_color: form.cover_color === c ? '' : c })} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="field"><label>Image link (optional)</label><input type="url" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://…" /></div>
                  <div className="field">
                    <label>Track with a savings goal</label>
                    <select value={form.linked_savings_id} onChange={(e) => setForm({ ...form, linked_savings_id: e.target.value })}>
                      <option value="">None</option>
                      {savings.map((s) => <option key={s.id} value={s.id}>{s.icon || '💰'} {s.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Track with a habit (last 30 days)</label>
                    <select value={form.linked_habit_id} onChange={(e) => setForm({ ...form, linked_habit_id: e.target.value })}>
                      <option value="">None</option>
                      {habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <div>
                  {editingId && <button type="button" className="btn-delete" onClick={() => setConfirmDelete(true)} disabled={saving}>Delete</button>}
                  {editingId && <button type="button" className="btn-cancel" style={{ marginLeft: 6 }} onClick={duplicateGoal}>Duplicate</button>}
                </div>
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmSheet
          title="Delete this dream?"
          body="You can undo for a few seconds after."
          confirmLabel="Delete" danger
          onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)}
        />
      )}

      {chartGoal && (() => {
        const ups = updatesByGoal[chartGoal.id] || []
        const pts = [...(chartGoal.start_value != null ? [{ v: Number(chartGoal.start_value), t: chartGoal.created_at }] : []), ...ups.map((u) => ({ v: Number(u.value), t: u.created_at }))]
        const vals = pts.map((p) => p.v).concat(Number(chartGoal.target_value))
        const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1
        const xy = (p, i) => `${Math.round(20 + (i / Math.max(1, pts.length - 1)) * 260)},${Math.round(100 - ((p.v - min) / span) * 80)}`
        const ty = Math.round(100 - ((Number(chartGoal.target_value) - min) / span) * 80)
        const finish = projectFinish(chartGoal, ups)
        return (
          <div className="modal-backdrop" onClick={() => setChartId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>{chartGoal.title}</h2>
              <svg viewBox="0 0 300 120" className="dream-chart" role="img" aria-label="Progress history">
                <line x1="20" x2="280" y1={ty} y2={ty} stroke="var(--lavender)" strokeDasharray="4 4" />
                <text x="282" y={ty + 3} fontSize="8" fill="var(--ink-dim)">goal</text>
                <polyline points={pts.map(xy).join(' ')} fill="none" stroke="var(--accent-deep)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => <circle key={i} cx={xy(p, i).split(',')[0]} cy={xy(p, i).split(',')[1]} r="3.5" fill="var(--accent-deep)" />)}
              </svg>
              <p className="field-hint">
                {finish ? `At this pace you'll reach ${chartGoal.target_value} ${chartGoal.unit || ''} around ${formatDate(finish)}.` : 'Log a couple more updates to see a projected finish date.'}
              </p>
              <ul className="dream-history">
                {[...ups].reverse().map((u) => (
                  <li key={u.id}><span>{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><b>{u.value} {chartGoal.unit || ''}</b></li>
                ))}
              </ul>
              <div className="modal-actions"><div /><div className="modal-actions-right"><button className="btn-cancel" onClick={() => setChartId(null)}>Close</button></div></div>
            </div>
          </div>
        )
      })()}

      {recap && (
        <div className="modal-backdrop" onClick={() => setRecapOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🏆 {recapYear} recap</h2>
            <p className="dream-summary"><b>{recap.slayed.length}</b> dreams slayed · <b>{recap.rewards}</b> rewards claimed{recap.topEra && <> · top era: <b>{recap.topEra}</b></>}</p>
            {recap.slayed.length === 0 ? <p className="field-hint">No slayed dreams yet this year — your first trophy is coming. 👑</p> : (
              <div className="dream-shelf">
                {recap.slayed.map((g) => (
                  <div className="dream-trophy" key={g.id} style={{ background: g.cover_color || 'var(--accent-tint)' }}>
                    <span>{g.cover_emoji || '🏆'}</span><b>{g.title}</b>
                    {g.completed_at && <small>{formatDate(g.completed_at.slice(0, 10))}</small>}
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions"><div /><div className="modal-actions-right"><button className="btn-cancel" onClick={() => setRecapOpen(false)}>Close</button></div></div>
          </div>
        </div>
      )}
    </div>
  )
}
