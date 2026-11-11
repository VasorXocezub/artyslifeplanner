import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { useFinanceCategories } from './lib/financeCategories'

const ICONS = ['🛒', '🏠', '🚗', '⛽', '💡', '📱', '🍽️', '☕', '🎬', '👗', '💅', '💊', '🐾', '✈️', '🎁', '🎓', '💻', '🏋️', '🧾', '🐷', '💖', '✨']
const COLORS = ['#C2567D', '#E8A5BC', '#B896C9', '#F3C9A8', '#E0A458', '#7BC4A8', '#6E8FB5', '#8A6B78']
const GROUP_SUGGESTIONS = ['Needs', 'Wants', 'Savings & goals', 'Fun money']
const SORTS = [
  { key: 'custom', label: 'My order' },
  { key: 'name', label: 'A–Z' },
  { key: 'spent', label: 'Most spent' },
  { key: 'pct', label: '% used' },
  { key: 'remaining', label: 'Least left' },
]
const DEFAULT_SETTINGS = { period_type: 'monthly', month_start_day: 1, anchor_date: null, warn_pct: 80 }
const PERIOD_TYPES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly (every 2 weeks)' },
  { key: 'custom', label: 'Custom periods (I set the dates)' },
]
const LEGACY_COLORS = { '#1E5C57': '#C2567D', '#8FC2BE': '#E8A5BC', '#D9A8B8': '#E8A5BC', '#E4CBA0': '#F3C9A8', '#7BA37A': '#7BC4A8' }
const fixColor = (c) => (c && LEGACY_COLORS[c.toUpperCase()]) || c
const WARN_COLOR = '#E0A458'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseD = (s) => new Date(s + 'T00:00:00')
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const dayMs = 86400000
const diffDays = (a, b) => Math.round((b - a) / dayMs)
const fmtShort = (d) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
const fmtLong = (d) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
const toMonthly = (amount, freq) => (freq === 'weekly' ? amount * 4.33 : freq === 'yearly' ? amount / 12 : amount)
const firstEmoji = (str) => {
  const t = (str || '').trim()
  if (!t) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)[Symbol.iterator]().next()
    return it.value ? it.value.segment : ''
  }
  return Array.from(t).slice(0, 2).join('')
}
const lastMonday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return addDays(t, -((t.getDay() + 6) % 7)) }

// A period key is a string stored in budget_items.month:
//   monthly      "2026-11"         (starts on the chosen start day)
//   week/fort.   "P7:2026-11-09"   (length in days : start date)
//   custom       "C:<uuid>"
function describePeriod(key, settings, customs) {
  if (!key) return null
  if (key.startsWith('C:')) {
    const c = customs.find(x => 'C:' + x.id === key)
    if (!c) return null
    const start = parseD(c.start_date), end = parseD(c.end_date)
    return { key, start, end, type: 'custom', label: c.name, sub: `${fmtShort(start)} – ${fmtLong(end)}`, custom: c }
  }
  if (key.startsWith('P')) {
    const [lenPart, date] = key.slice(1).split(':')
    const len = Number(lenPart)
    const start = parseD(date), end = addDays(start, len - 1)
    return { key, start, end, type: len === 14 ? 'fortnightly' : 'weekly', label: `${fmtShort(start)} – ${fmtShort(end)}`, sub: `${end.getFullYear()} · ${len === 14 ? 'fortnight' : 'week'}` }
  }
  const [y, m] = key.split('-').map(Number)
  const sd = Math.min(28, Math.max(1, Number(settings.month_start_day) || 1))
  const start = new Date(y, m - 1, sd), end = new Date(y, m, sd - 1)
  return { key, start, end, type: 'monthly', label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), sub: `${fmtShort(start)} – ${fmtShort(end)}` }
}

function currentKey(settings, customs) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const type = settings.period_type
  if (type === 'weekly' || type === 'fortnightly') {
    const len = type === 'weekly' ? 7 : 14
    const anchor = settings.anchor_date ? parseD(settings.anchor_date) : lastMonday()
    const start = addDays(anchor, Math.floor(diffDays(anchor, today) / len) * len)
    return `P${len}:${ymd(start)}`
  }
  if (type === 'custom') {
    const sorted = [...customs].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const t = ymd(today)
    const hit = sorted.find(c => c.start_date <= t && t <= c.end_date)
      || [...sorted].reverse().find(c => c.start_date <= t) || sorted[0]
    return hit ? 'C:' + hit.id : null
  }
  const sd = Math.min(28, Math.max(1, Number(settings.month_start_day) || 1))
  const base = today.getDate() < sd ? new Date(today.getFullYear(), today.getMonth() - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}`
}

function shiftKey(key, n, settings, customs) {
  if (!key) return null
  if (key.startsWith('C:')) {
    const sorted = [...customs].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const i = sorted.findIndex(c => 'C:' + c.id === key) + n
    return i >= 0 && i < sorted.length && sorted.findIndex(c => 'C:' + c.id === key) >= 0 ? 'C:' + sorted[i].id : null
  }
  if (key.startsWith('P')) {
    const [lenPart, date] = key.slice(1).split(':')
    return `P${lenPart}:${ymd(addDays(parseD(date), n * Number(lenPart)))}`
  }
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

const emptyLine = { id: null, kind: 'expense', category: '', customCategory: false, icon: '🧾', color: COLORS[0], grp: '', planned_amount: '', rollover: false, notes: '', forward: 0, parts: [] }

export default function BudgetPlanner({ currency }) {
  // whole amounts show without cents; anything with cents keeps them
  const money = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return formatMoney(v, currency, Number.isInteger(v) ? 0 : 2) }
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsRow, setSettingsRow] = useState(null)
  const [customs, setCustoms] = useState([])
  const [periodKey, setPeriodKey] = useState(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('plan') // plan | history
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [items, setItems] = useState([])
  const [prevItems, setPrevItems] = useState([])
  const [tx, setTx] = useState([])
  const [prevTx, setPrevTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortKey, setSortKey] = useState('custom')
  const [expanded, setExpanded] = useState(null)
  const [modal, setModal] = useState(null) // line form or null
  const [periodModal, setPeriodModal] = useState(null) // custom period form or null
  const [saving, setSaving] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [catInput, setCatInput] = useState('')
  const { categories: knownCats, savedRows, addCategory, removeCategory } = useFinanceCategories()

  const period = describePeriod(periodKey, settings, customs)
  const warnPct = Math.min(100, Math.max(1, Number(settings.warn_pct) || 80))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = period ? period.start : today
  const end = period ? period.end : today
  const totalDays = Math.max(1, diffDays(start, end) + 1)
  const elapsedDays = today < start ? 0 : today > end ? totalDays : diffDays(start, today) + 1
  const daysLeft = Math.max(0, totalDays - elapsedDays)
  const inPeriod = today >= start && today <= end
  const prevKey = shiftKey(periodKey, -1, settings, customs)
  const nextKey = shiftKey(periodKey, 1, settings, customs)
  const unit = period?.type === 'weekly' ? 'week' : period?.type === 'fortnightly' ? 'fortnight' : period?.type === 'custom' ? 'period' : 'month'

  // settings + custom periods first, then pick the current period
  const loadMeta = useCallback(async (keepKey) => {
    const [sRes, cRes] = await Promise.all([
      supabase.from('budget_settings').select('*').limit(1).maybeSingle(),
      supabase.from('budget_periods').select('*').order('start_date', { ascending: true }),
    ])
    const st = { ...DEFAULT_SETTINGS, ...(sRes.error || !sRes.data ? {} : sRes.data) }
    const cs = cRes.error ? [] : (cRes.data || [])
    setSettingsRow(sRes.error ? null : sRes.data)
    setSettings(st)
    setCustoms(cs)
    if (!keepKey) setPeriodKey(currentKey(st, cs))
    setReady(true)
    return { st, cs }
  }, [])

  useEffect(() => { loadMeta(false) }, [loadMeta])

  const load = useCallback(async () => {
    if (!periodKey) { setItems([]); setTx([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    const cur = describePeriod(periodKey, settings, customs)
    const pk = shiftKey(periodKey, -1, settings, customs)
    const prev = describePeriod(pk, settings, customs)
    const empty = Promise.resolve({ data: [], error: null })
    const [b, pb, t, pt] = await Promise.all([
      supabase.from('budget_items').select('*').eq('month', periodKey).order('created_at', { ascending: true }),
      pk ? supabase.from('budget_items').select('*').eq('month', pk) : empty,
      cur ? supabase.from('transactions').select('id, date, type, amount, category, notes').gte('date', ymd(cur.start)).lte('date', ymd(cur.end)).order('date', { ascending: false }) : empty,
      prev ? supabase.from('transactions').select('type, amount, category').gte('date', ymd(prev.start)).lte('date', ymd(prev.end)) : empty,
    ])
    if (b.error) setError(b.error.message + ' — have you run the budget SQL in Supabase?')
    setItems(b.data || [])
    setPrevItems(pb.data || [])
    setTx(t.data || [])
    setPrevTx(pt.data || [])
    setLoading(false)
  }, [periodKey, settings, customs])

  useEffect(() => { if (ready) load() }, [ready, load])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    const bi = await supabase.from('budget_items').select('month, kind, planned_amount')
    if (bi.error) { setError(bi.error.message); setHistLoading(false); return }
    const keys = [...new Set([...(bi.data || []).map(r => r.month), periodKey].filter(Boolean))]
    const descs = keys.map(k => describePeriod(k, settings, customs)).filter(Boolean)
    if (!descs.length) { setHistory([]); setHistLoading(false); return }
    const min = descs.reduce((m, d) => (d.start < m ? d.start : m), descs[0].start)
    const max = descs.reduce((m, d) => (d.end > m ? d.end : m), descs[0].end)
    const t = await supabase.from('transactions').select('date, type, amount').gte('date', ymd(min)).lte('date', ymd(max))
    if (t.error) { setError(t.error.message); setHistLoading(false); return }
    const out = descs.map(d => {
      const s = ymd(d.start), e = ymd(d.end)
      const inRange = (t.data || []).filter(x => x.date >= s && x.date <= e)
      const planned = (kind) => (bi.data || []).filter(r => r.month === d.key && r.kind === kind).reduce((a, r) => a + Number(r.planned_amount || 0), 0)
      const actual = (kind) => inRange.filter(x => x.type === kind).reduce((a, x) => a + Number(x.amount), 0)
      return { ...d, budget: planned('expense'), spent: actual('expense'), incomePlanned: planned('income'), incomeActual: actual('income') }
    }).sort((a, b) => b.start - a.start)
    setHistory(out)
    setHistLoading(false)
  }, [periodKey, settings, customs])

  useEffect(() => { if (ready && view === 'history') loadHistory() }, [ready, view, loadHistory])

  const sumTx = (list, kind, cat) =>
    list.filter(t => t.type === kind && (t.category || 'Uncategorized').toLowerCase() === cat.toLowerCase())
      .reduce((s, t) => s + Number(t.amount), 0)

  const rows = useMemo(() => items.map((i, idx) => {
    const parts = Array.isArray(i.items) ? i.items.filter(p => p && p.name) : []
    const planned = parts.length ? parts.reduce((a, p) => a + (Number(p.amount) || 0), 0) : (Number(i.planned_amount) || 0)
    const prevLine = i.rollover ? prevItems.find(p => p.kind === i.kind && p.category.toLowerCase() === i.category.toLowerCase()) : null
    const carry = prevLine ? Math.max(0, (Number(prevLine.planned_amount) || 0) - sumTx(prevTx, prevLine.kind, prevLine.category)) : 0
    const budget = planned + carry
    const actual = sumTx(tx, i.kind, i.category)
    const pct = budget > 0 ? (actual / budget) * 100 : (actual > 0 ? 999 : 0)
    return { ...i, color: fixColor(i.color), parts, planned, carry, budget, actual, pct, remaining: budget - actual, grpName: (i.grp || '').trim() || (i.kind === 'income' ? 'Income' : 'Expenses'), order: i.sort_order ?? idx }
  }), [items, prevItems, tx, prevTx]) // eslint-disable-line react-hooks/exhaustive-deps

  const expenseRows = rows.filter(r => r.kind === 'expense')
  const incomeRows = rows.filter(r => r.kind === 'income')
  const budgetedSet = new Set(expenseRows.map(r => r.category.toLowerCase()))
  const unbudgeted = useMemo(() => {
    const map = {}
    tx.filter(t => t.type === 'expense').forEach(t => {
      const c = t.category || 'Uncategorized'
      if (!budgetedSet.has(c.toLowerCase())) map[c] = (map[c] || 0) + Number(t.amount)
    })
    return Object.entries(map).map(([category, actual]) => ({ category, actual })).sort((a, b) => b.actual - a.actual)
  }, [tx, items]) // eslint-disable-line react-hooks/exhaustive-deps

  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0)
  const totalBudget = sum(expenseRows, 'budget')
  const totalActual = sum(expenseRows, 'actual') + sum(unbudgeted, 'actual')
  const remaining = totalBudget - totalActual
  const plannedIncome = sum(incomeRows, 'budget')
  const receivedIncome = sum(incomeRows, 'actual')
  const unallocated = plannedIncome - totalBudget
  const usedPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
  const paceFrac = totalDays ? elapsedDays / totalDays : 0
  const projected = elapsedDays > 0 && inPeriod ? (totalActual / elapsedDays) * totalDays : totalActual
  const dailyLeft = daysLeft > 0 ? remaining / daysLeft : null

  const statusColor = (pct, over) => (over || pct > 100 ? 'var(--danger)' : pct >= warnPct ? WARN_COLOR : 'var(--good)')

  const groupNames = [...new Set(rows.map(r => r.grpName))]
  const existingGroups = [...new Set([...groupNames.filter(g => g !== 'Expenses' && g !== 'Income'), ...GROUP_SUGGESTIONS])]

  function sortRows(list) {
    const copy = [...list]
    const by = {
      custom: (a, b) => a.order - b.order,
      name: (a, b) => a.category.localeCompare(b.category),
      spent: (a, b) => b.actual - a.actual,
      pct: (a, b) => b.pct - a.pct,
      remaining: (a, b) => a.remaining - b.remaining,
    }[sortKey]
    return copy.sort(by)
  }

  const visible = rows.filter(r => (kindFilter === 'all' || r.kind === kindFilter) && (groupFilter === 'all' || r.grpName === groupFilter))
  const grouped = {}
  sortRows(visible.filter(r => r.kind === 'expense')).forEach(r => { (grouped[r.grpName] ||= []).push(r) })
  const incomeVisible = sortRows(visible.filter(r => r.kind === 'income'))

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(null), 3500) }

  // ----- editing -----
  function openNew(preset = {}) { setModal({ ...emptyLine, ...preset }) }
  function openEdit(r) {
    setModal({
      id: r.id, kind: r.kind, category: r.category, customCategory: false, icon: r.icon || '🧾', color: r.color || COLORS[0],
      grp: r.grp || '', planned_amount: String(r.planned), rollover: !!r.rollover, notes: r.notes || '', forward: 0,
      parts: (r.parts || []).map(p => ({ name: p.name, amount: String(p.amount ?? '') })),
    })
  }

  async function saveLine(e) {
    e.preventDefault()
    const cat = modal.category.trim()
    const cleanParts = (modal.parts || []).map(p => ({ name: p.name.trim(), amount: parseFloat(p.amount) })).filter(p => p.name || !Number.isNaN(p.amount))
    if (cleanParts.some(p => !p.name || Number.isNaN(p.amount) || p.amount < 0)) { setError('Each item needs a name and an amount (0 or more) — or remove the empty row.'); return }
    const amt = cleanParts.length ? cleanParts.reduce((a, p) => a + p.amount, 0) : parseFloat(modal.planned_amount)
    if (!cat) { setError('Choose or type a category.'); return }
    if (Number.isNaN(amt) || amt < 0) { setError('Enter a budget amount (0 or more).'); return }
    setSaving(true)
    setError(null)
    const base = {
      category: cat, kind: modal.kind, planned_amount: amt, items: cleanParts, icon: modal.icon || null, color: modal.color || null,
      grp: modal.grp.trim() || null, rollover: modal.kind === 'expense' && modal.rollover, notes: modal.notes.trim() || null,
    }
    let err
    if (modal.id) {
      ;({ error: err } = await supabase.from('budget_items').update(base).eq('id', modal.id))
    } else {
      const user_id = await getUserId()
      const keys = [periodKey]
      for (let n = 1; n <= Number(modal.forward || 0); n++) {
        const k = shiftKey(periodKey, n, settings, customs)
        if (k) keys.push(k)
      }
      const existing = new Set(items.map(i => `${i.kind}|${i.category.toLowerCase()}`))
      const payload = keys
        .map(k => ({ ...base, user_id, month: k, sort_order: items.length + 1 }))
        .filter((p, idx) => idx > 0 || !existing.has(`${p.kind}|${p.category.toLowerCase()}`))
      if (!payload.length) { setSaving(false); setError(`${cat} is already in this month's budget — tap it to edit.`); return }
      ;({ error: err } = await supabase.from('budget_items').insert(payload))
    }
    if (!err) await addCategory(cat)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModal(null)
    load()
  }

  async function deleteLine() {
    if (!modal?.id || !window.confirm(`Remove ${modal.category} from this month's budget?`)) return
    const { error: err } = await supabase.from('budget_items').delete().eq('id', modal.id)
    if (err) { setError(err.message); return }
    setModal(null)
    load()
  }

  async function move(r, dir) {
    const list = sortRows(rows.filter(x => x.kind === r.kind && x.grpName === r.grpName))
    const i = list.findIndex(x => x.id === r.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i], b = list[j]
    const [ra, rb] = await Promise.all([
      supabase.from('budget_items').update({ sort_order: b.order }).eq('id', a.id),
      supabase.from('budget_items').update({ sort_order: a.order === b.order ? a.order + dir : a.order }).eq('id', b.id),
    ])
    if (ra.error || rb.error) setError((ra.error || rb.error).message)
    load()
  }

  // ----- quick-fill tools -----
  async function bulkInsert(lines, okMsg) {
    const have = new Set(items.map(i => `${i.kind}|${i.category.toLowerCase()}`))
    const user_id = await getUserId()
    const add = lines.filter(l => !have.has(`${l.kind}|${l.category.toLowerCase()}`) && l.planned_amount > 0)
      .map((l, n) => ({ user_id, month: periodKey, sort_order: items.length + n + 1, ...l }))
    if (!add.length) { flash('Nothing new to add.'); return }
    const { error: err } = await supabase.from('budget_items').insert(add)
    if (err) { setError(err.message); return }
    flash(`${okMsg} (${add.length} added)`)
    load()
  }

  async function copyFromLast() {
    await bulkInsert(prevItems.map(p => ({
      category: p.category, kind: p.kind, planned_amount: p.planned_amount, items: p.items || [], icon: p.icon, color: p.color,
      grp: p.grp, rollover: p.rollover, notes: p.notes,
    })), `Copied from previous ${unit}`)
  }

  async function importRecurring() {
    const { data, error: err } = await supabase.from('recurring_expenses').select('*').eq('active', true)
    if (err) { setError(err.message); return }
    const map = {}
    ;(data || []).forEach(r => { const c = r.category || 'Recurring'; map[c] = (map[c] || 0) + toMonthly(Number(r.amount), r.frequency) })
    const factor = period?.type === 'monthly' ? 1 : totalDays / 30.44
    await bulkInsert(Object.entries(map).map(([category, amt]) => ({ category, kind: 'expense', planned_amount: Math.round(amt * factor * 100) / 100, grp: 'Needs' })), 'Imported recurring')
  }

  async function fillFromAverage() {
    const keys = [-1, -2, -3].map(n => shiftKey(periodKey, n, settings, customs)).filter(Boolean)
    const descs = keys.map(k => describePeriod(k, settings, customs)).filter(Boolean)
    if (!descs.length) { flash('No earlier periods to average yet.'); return }
    const results = await Promise.all(descs.map(d => supabase.from('transactions').select('amount, category').eq('type', 'expense').gte('date', ymd(d.start)).lte('date', ymd(d.end))))
    const bad = results.find(r => r.error)
    if (bad) { setError(bad.error.message); return }
    const map = {}
    results.forEach(r => (r.data || []).forEach(t => { const c = t.category || 'Uncategorized'; map[c] = (map[c] || 0) + Number(t.amount) }))
    await bulkInsert(Object.entries(map).map(([category, total]) => ({ category, kind: 'expense', planned_amount: Math.ceil(total / descs.length / 10) * 10 })), `Filled from your ${descs.length}-${unit} average`)
  }

  async function saveSettings(patch, { resetPeriod = false } = {}) {
    const next = { ...settings, ...patch }
    setSettings(next)
    const payload = {
      period_type: next.period_type, month_start_day: Number(next.month_start_day) || 1,
      anchor_date: next.anchor_date || null, warn_pct: Number(next.warn_pct) || 80,
    }
    let err
    if (settingsRow) ({ error: err } = await supabase.from('budget_settings').update(payload).eq('id', settingsRow.id))
    else {
      const user_id = await getUserId()
      const res = await supabase.from('budget_settings').insert({ ...payload, user_id }).select().single()
      err = res.error
      if (!err) setSettingsRow(res.data)
    }
    if (err) { setError(err.message + ' — have you run the budget SQL in Supabase?'); return }
    if (resetPeriod) setPeriodKey(currentKey(next, customs))
  }

  // ----- custom periods -----
  function openPeriod(p) {
    if (p) { setPeriodModal({ id: p.id, name: p.name, start_date: p.start_date, end_date: p.end_date }); return }
    const last = [...customs].sort((a, b) => a.end_date.localeCompare(b.end_date)).pop()
    const st = last ? addDays(parseD(last.end_date), 1) : new Date()
    const len = last ? diffDays(parseD(last.start_date), parseD(last.end_date)) : 29
    setPeriodModal({ id: null, name: '', start_date: ymd(st), end_date: ymd(addDays(st, len)) })
  }

  async function savePeriod(e) {
    e.preventDefault()
    const name = periodModal.name.trim()
    if (!name) { setError('Give the period a name (e.g. "Holiday trip" or "Pay cycle 3").'); return }
    if (!periodModal.start_date || !periodModal.end_date || periodModal.end_date < periodModal.start_date) { setError('The end date must be on or after the start date.'); return }
    setSaving(true)
    setError(null)
    const payload = { name, start_date: periodModal.start_date, end_date: periodModal.end_date }
    let err, newId = periodModal.id
    if (periodModal.id) ({ error: err } = await supabase.from('budget_periods').update(payload).eq('id', periodModal.id))
    else {
      const user_id = await getUserId()
      const res = await supabase.from('budget_periods').insert({ ...payload, user_id }).select().single()
      err = res.error
      newId = res.data?.id
    }
    setSaving(false)
    if (err) { setError(err.message + ' — have you run the budget SQL in Supabase?'); return }
    setPeriodModal(null)
    const { st, cs } = await loadMeta(true)
    if (newId) setPeriodKey('C:' + newId)
    else setPeriodKey(currentKey(st, cs))
  }

  async function deletePeriod() {
    if (!periodModal?.id || !window.confirm('Delete this period and its budget lines? Your transactions are not affected.')) return
    const key = 'C:' + periodModal.id
    await supabase.from('budget_items').delete().eq('month', key)
    const { error: err } = await supabase.from('budget_periods').delete().eq('id', periodModal.id)
    if (err) { setError(err.message); return }
    setPeriodModal(null)
    const { st, cs } = await loadMeta(true)
    setPeriodKey(currentKey(st, cs))
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    const name = catInput.trim()
    if (!name) return
    const { error: err } = await addCategory(name)
    if (err) setError(err.message)
    else setCatInput('')
  }

  const monthLabel = period ? period.label : 'Budget'

  // ----- render pieces -----
  function renderRow(r) {
    const isIncome = r.kind === 'income'
    const over = !isIncome && r.actual > r.budget
    const color = isIncome ? 'var(--good)' : statusColor(r.pct, over)
    const accent = r.color || COLORS[0]
    const barPct = Math.min(100, r.pct === 999 ? 100 : r.pct)
    const open = expanded === r.id
    const catTx = tx.filter(t => t.type === r.kind && (t.category || 'Uncategorized').toLowerCase() === r.category.toLowerCase())
    const leftText = isIncome
      ? (r.actual === r.budget ? '✓ received' : r.actual > r.budget ? `${money(r.actual - r.budget)} above` : `${money(r.budget - r.actual)} to go`)
      : over ? `${money(r.actual - r.budget)} over` : `${money(r.remaining)} left`
    return (
      <div key={r.id} className={`bd-row ${open ? 'bd-row-open' : ''}`}>
        <button type="button" className="bd-row-main" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open}>
          <span className="bd-icon" style={{ background: accent + '2E' }}>{r.icon || '🧾'}</span>
          <span className="bd-row-body">
            <span className="bd-row-top">
              <span className="bd-name">{r.category}{r.parts.length > 0 ? <span className="bd-dim"> · {r.parts.length} items</span> : null}{r.carry > 0 ? <span className="bd-dim" title={`+${money(r.carry)} rolled over`}> ↻</span> : null}</span>
              <span className="bd-amounts">{money(r.actual)}<span className="bd-dim"> / {money(r.budget)}</span></span>
            </span>
            <span className="bd-row-bar">
              <span className="bd-bar" aria-hidden="true">
                <span className="bd-bar-fill" style={{ width: `${barPct}%`, background: color }} />
                {inPeriod && !isIncome && <span className="bd-bar-pace" style={{ left: `${paceFrac * 100}%` }} />}
              </span>
              <span className="bd-left" style={{ color }}>{leftText}</span>
            </span>
          </span>
        </button>
        {open && (
          <div className="bd-detail">
            {r.parts.length > 0 && (() => {
              const used = new Set()
              const partRows = r.parts.map(p => {
                const key = p.name.toLowerCase()
                const hits = catTx.filter(t => !used.has(t.id) && (t.notes || '').toLowerCase().includes(key))
                hits.forEach(t => used.add(t.id))
                return { ...p, spent: hits.reduce((a, t) => a + Number(t.amount), 0) }
              })
              const rest = catTx.filter(t => !used.has(t.id)).reduce((a, t) => a + Number(t.amount), 0)
              const anyMatched = partRows.some(p => p.spent > 0)
              return (
                <div className="bd-parts">
                  {partRows.map((p, i) => (
                    <div key={i} className="bd-part">
                      <span>{p.name}</span>
                      <span>{p.spent > 0 ? <><strong>{money(p.spent)}</strong><span className="bd-dim"> / {money(Number(p.amount))}</span></> : <span className="bd-dim">{money(Number(p.amount))}</span>}</span>
                    </div>
                  ))}
                  {rest > 0 && <div className="bd-part"><span className="bd-dim">Not matched to an item</span><span className="bd-dim">{money(rest)}</span></div>}
                  {!anyMatched && <p className="bd-dim bd-note">Tip: put an item's name in a transaction's notes (e.g. “Spotify”) and its spending shows here.</p>}
                </div>
              )
            })()}
            {r.notes && <p className="bd-note">📝 {r.notes}</p>}
            {r.carry > 0 && <p className="bd-dim bd-note">↻ Includes {money(r.carry)} rolled over</p>}
            {catTx.length === 0 ? <p className="bd-dim bd-note">No transactions in this category this period.</p> : (
              <ul className="bd-tx">
                {catTx.slice(0, 6).map(t => (
                  <li key={t.id}><span>{fmtShort(new Date(t.date + 'T00:00:00'))}{t.notes ? ` · ${t.notes}` : ''}</span><strong>{money(Number(t.amount))}</strong></li>
                ))}
                {catTx.length > 6 && <li className="bd-dim">+ {catTx.length - 6} more</li>}
              </ul>
            )}
            <div className="bd-detail-actions">
              {sortKey === 'custom' && <>
                <button type="button" className="bd-mini" onClick={() => move(r, -1)} aria-label="Move up">↑</button>
                <button type="button" className="bd-mini" onClick={() => move(r, 1)} aria-label="Move down">↓</button>
              </>}
              <button type="button" className="bd-mini bd-mini-primary" onClick={() => openEdit(r)}>Edit</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const groupSubtotal = (list) => ({ b: sum(list, 'budget'), a: sum(list, 'actual') })

  return (
    <div className="bd">
      <div className="bd-viewtabs filter-row">
        <button className={`filter-pill ${view === 'plan' ? 'filter-pill-active' : ''}`} onClick={() => setView('plan')}>Plan</button>
        <button className={`filter-pill ${view === 'history' ? 'filter-pill-active' : ''}`} onClick={() => setView('history')}>History</button>
      </div>

      {view === 'plan' && (
        <div className="bd-nav">
          <button className="btn-cancel" disabled={!prevKey} onClick={() => prevKey && setPeriodKey(prevKey)} aria-label={`Previous ${unit}`}>←</button>
          <div className="bd-nav-label">
            <strong>{period ? period.label : 'No budget period yet'}</strong>
            {period && <span className="bd-dim">{period.sub}{inPeriod ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}</span>}
            <span className="bd-nav-links">
              {periodKey !== currentKey(settings, customs) && <button type="button" className="bd-link" onClick={() => setPeriodKey(currentKey(settings, customs))}>Jump to current</button>}
              {period?.type === 'custom' && <button type="button" className="bd-link" onClick={() => openPeriod(period.custom)}>Edit period</button>}
            </span>
          </div>
          {nextKey || settings.period_type !== 'custom' && period?.type !== 'custom'
            ? <button className="btn-cancel" onClick={() => nextKey && setPeriodKey(nextKey)} aria-label={`Next ${unit}`}>→</button>
            : <button className="btn-primary" onClick={() => openPeriod(null)}>＋ New</button>}
        </div>
      )}

      {error && <p className="error-msg" role="alert">{error}</p>}
      {notice && <p className="bd-notice" role="status">✓ {notice}</p>}
      {view === 'plan' && !periodKey && ready && (
        <div className="calendar-card bd-empty">
          <p><strong>Create your first budget period</strong></p>
          <p className="bd-dim">Custom periods let you budget for any date range — a pay cycle, a trip, a project.</p>
          <div className="bd-empty-actions"><button className="btn-primary" onClick={() => openPeriod(null)}>＋ New period</button></div>
        </div>
      )}

      {view === 'plan' && loading && periodKey && <p className="loading">Crunching the plan… 🧮</p>}

      {view === 'plan' && !loading && periodKey && (
        <>
          <div className="calendar-card bd-hero">
            <div className="bd-eq">
              <div><span className="bd-eq-label">Budget</span><span className="bd-eq-num">{money(totalBudget)}</span></div>
              <span className="bd-eq-op">−</span>
              <div><span className="bd-eq-label">Actual</span><span className="bd-eq-num">{money(totalActual)}</span></div>
              <span className="bd-eq-op">=</span>
              <div>
                <span className="bd-eq-label">{remaining >= 0 ? 'Remaining' : 'Over by'}</span>
                <span className="bd-eq-num" style={{ color: remaining >= 0 ? 'var(--good)' : 'var(--danger)' }}>{money(Math.abs(remaining))}</span>
              </div>
            </div>
            <div className="bd-bar bd-bar-big" aria-hidden="true">
              <span className="bd-bar-fill" style={{ width: `${Math.min(100, usedPct)}%`, background: statusColor(usedPct, remaining < 0) }} />
              {inPeriod && <span className="bd-bar-pace" style={{ left: `${paceFrac * 100}%` }} />}
            </div>
            <p className="bd-dim bd-hero-caption">
              {totalBudget > 0 ? `${Math.round(usedPct)}% of budget used` : 'Add budget lines below to get started'}
              {inPeriod && totalBudget > 0 ? ` · ${Math.round(paceFrac * 100)}% of the ${unit} gone` : ''}
            </p>
            <div className="bd-stats">
              {dailyLeft !== null && totalBudget > 0 && (
                <div><span className="bd-eq-label">Daily allowance</span><strong>{dailyLeft >= 0 ? money(dailyLeft) : '—'}</strong></div>
              )}
              {inPeriod && totalActual > 0 && (
                <div><span className="bd-eq-label">On pace to spend</span><strong style={{ color: projected > totalBudget && totalBudget > 0 ? 'var(--danger)' : undefined }}>{money(projected)}</strong></div>
              )}
              <div><span className="bd-eq-label">Income {plannedIncome > 0 ? 'planned' : 'received'}</span><strong>{money(plannedIncome > 0 ? plannedIncome : receivedIncome)}</strong></div>
              {plannedIncome > 0 && (
                <div><span className="bd-eq-label">{unallocated >= 0 ? 'Unallocated' : 'Over-allocated'}</span><strong style={{ color: unallocated < 0 ? 'var(--danger)' : undefined }}>{money(Math.abs(unallocated))}</strong></div>
              )}
            </div>
          </div>

          <div className="bd-toolbar">
            <div className="filter-row bd-pills">
              {[['all', 'All'], ['expense', 'Spending'], ['income', 'Income']].map(([k, l]) => (
                <button key={k} className={`filter-pill ${kindFilter === k ? 'filter-pill-active' : ''}`} onClick={() => setKindFilter(k)}>{l}</button>
              ))}
            </div>
            <div className="bd-toolbar-right">
              {groupNames.length > 1 && (
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} aria-label="Filter by group">
                  <option value="all">All groups</option>
                  {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
              <select value={sortKey} onChange={e => setSortKey(e.target.value)} aria-label="Sort">
                {SORTS.map(s => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
              </select>
              <button className="btn-primary" onClick={() => openNew()}>＋ Add line</button>
            </div>
          </div>

          {rows.length === 0 && (
            <div className="calendar-card bd-empty">
              <p><strong>Nothing planned for {monthLabel} yet.</strong></p>
              <p className="bd-dim">Add a line, copy last month, or fill it from what you usually spend.</p>
              <div className="bd-empty-actions">
                <button className="btn-primary" onClick={() => openNew()}>＋ Add first line</button>
                <button className="btn-cancel" onClick={copyFromLast}>Copy previous {unit}</button>
                <button className="btn-cancel" onClick={fillFromAverage}>Fill from 3-{unit} average</button>
              </div>
            </div>
          )}

          {Object.entries(grouped).map(([g, list]) => {
            const st = groupSubtotal(list)
            return (
              <section key={g} className="bd-group">
                <div className="bd-group-head">
                  <h3>{g}</h3>
                  <span className="bd-dim">{money(st.a)} of {money(st.b)}</span>
                </div>
                <div className="bd-card">{list.map(renderRow)}</div>
              </section>
            )
          })}

          {incomeVisible.length > 0 && (
            <section className="bd-group">
              <div className="bd-group-head"><h3>Income</h3><span className="bd-dim">{money(receivedIncome)} of {money(plannedIncome)}</span></div>
              <div className="bd-card">{incomeVisible.map(renderRow)}</div>
            </section>
          )}

          {kindFilter !== 'income' && unbudgeted.length > 0 && (
            <section className="bd-group">
              <div className="bd-group-head"><h3>Unbudgeted spending</h3><span className="bd-dim">{money(sum(unbudgeted, 'actual'))}</span></div>
              <div className="bd-card">
                {unbudgeted.map(u => (
                  <div key={u.category} className="bd-row">
                    <div className="bd-row-main bd-row-static">
                      <span className="bd-icon">❔</span>
                      <span className="bd-row-body">
                        <span className="bd-row-top"><span className="bd-name">{u.category}</span><span className="bd-amounts">{money(u.actual)}</span></span>
                        <span className="bd-row-bar"><span className="bd-dim">No budget set</span>
                          <button type="button" className="bd-link" onClick={() => openNew({ category: u.category, planned_amount: String(Math.ceil(u.actual / 10) * 10) })}>Set a budget</button>
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="calendar-card bd-tools">
            <button type="button" className="bd-tools-toggle" onClick={() => setShowTools(s => !s)} aria-expanded={showTools}>
              <span>⚙️ Tools &amp; settings</span><span>{showTools ? '▲' : '▼'}</span>
            </button>
            {showTools && (
              <div className="bd-tools-body">
                <p className="module-group-label">Quick fill</p>
                <div className="bd-tool-actions">
                  <button className="btn-cancel" onClick={copyFromLast}>Copy from previous {unit}</button>
                  <button className="btn-cancel" onClick={importRecurring}>Import recurring expenses</button>
                  <button className="btn-cancel" onClick={fillFromAverage}>Fill from 3-{unit} average</button>
                </div>
                <p className="module-group-label">Budget period</p>
                <div className="bd-pref-grid">
                  <div className="field">
                    <label>Track my budget</label>
                    <select value={settings.period_type} onChange={e => {
                      const t = e.target.value
                      saveSettings({ period_type: t, anchor_date: (t === 'weekly' || t === 'fortnightly') && !settings.anchor_date ? ymd(lastMonday()) : settings.anchor_date }, { resetPeriod: true })
                    }}>
                      {PERIOD_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <small className="bd-dim">Earlier periods are kept — see them under History.</small>
                  </div>
                  {settings.period_type === 'monthly' && (
                    <div className="field">
                      <label>Month starts on day</label>
                      <input type="number" min="1" max="28" value={settings.month_start_day} onChange={e => setSettings({ ...settings, month_start_day: e.target.value })} onBlur={e => saveSettings({ month_start_day: Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)) }, { resetPeriod: true })} />
                      <small className="bd-dim">Set to your payday (e.g. 25) so a month runs payday to payday.</small>
                    </div>
                  )}
                  {(settings.period_type === 'weekly' || settings.period_type === 'fortnightly') && (
                    <div className="field">
                      <label>Periods start on</label>
                      <input type="date" value={settings.anchor_date || ''} onChange={e => saveSettings({ anchor_date: e.target.value || null }, { resetPeriod: true })} />
                      <small className="bd-dim">Pick any {settings.period_type === 'weekly' ? 'week' : 'fortnight'} start date (e.g. a payday) — periods repeat from it.</small>
                    </div>
                  )}
                  {settings.period_type === 'custom' && (
                    <div className="field">
                      <label>Your periods</label>
                      <button type="button" className="btn-cancel" onClick={() => openPeriod(null)}>＋ New period</button>
                      <small className="bd-dim">{customs.length} created · use ← → to move between them.</small>
                    </div>
                  )}
                </div>
                <p className="module-group-label">Alerts</p>
                <div className="bd-pref-grid">
                  <div className="field">
                    <label>Warn me at (% of budget used)</label>
                    <input type="number" min="1" max="100" value={settings.warn_pct} onChange={e => setSettings({ ...settings, warn_pct: e.target.value })} onBlur={e => saveSettings({ warn_pct: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 80)) })} />
                    <small className="bd-dim">Bars turn amber at this point and red when over.</small>
                  </div>
                </div>
                <p className="module-group-label">Categories</p>
                <p className="bd-dim">Shared with Personal and Recurring.</p>
                <form className="budget-cat-form" onSubmit={handleAddCategory}>
                  <input placeholder="New category (e.g. Pets)" value={catInput} onChange={e => setCatInput(e.target.value)} aria-label="New category name" />
                  <button className="btn-primary" type="submit">Create</button>
                </form>
                <div className="budget-cat-chips">
                  {knownCats.map(c => {
                    const saved = savedRows.some(r => r.name.toLowerCase() === c.toLowerCase())
                    return (
                      <span key={c} className="budget-cat-chip">{c}
                        {saved && <button type="button" aria-label={`Delete category ${c}`} onClick={() => removeCategory(c)}>✕</button>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {view === 'history' && (
        <>
          {histLoading && <p className="loading">Looking back… 📈</p>}
          {!histLoading && history.length === 0 && (
            <div className="calendar-card bd-empty"><p><strong>No history yet</strong></p><p className="bd-dim">Once you set budgets, every period you track shows up here.</p></div>
          )}
          {!histLoading && history.length > 0 && (() => {
            const tracked = history.filter(h => h.budget > 0)
            const under = tracked.filter(h => h.end < today && h.spent <= h.budget).length
            const finished = tracked.filter(h => h.end < today).length
            const avg = history.length ? history.reduce((a, h) => a + h.spent, 0) / history.length : 0
            const maxVal = Math.max(1, ...history.map(h => Math.max(h.budget, h.spent)))
            return (
              <>
                <div className="calendar-card bd-hero">
                  <div className="bd-stats bd-stats-top">
                    <div><span className="bd-eq-label">Periods tracked</span><strong>{history.length}</strong></div>
                    <div><span className="bd-eq-label">Finished under budget</span><strong>{finished ? `${under} of ${finished}` : '—'}</strong></div>
                    <div><span className="bd-eq-label">Average spend</span><strong>{money(avg)}</strong></div>
                  </div>
                </div>
                <section className="bd-group">
                  {history.map(h => {
                    const left = h.budget - h.spent
                    const isOver = h.budget > 0 && left < 0
                    const pct = h.budget > 0 ? (h.spent / h.budget) * 100 : 0
                    const color = h.budget === 0 ? 'var(--ink-faint)' : statusColor(pct, isOver)
                    return (
                      <button key={h.key} type="button" className={`bd-row bd-hist-row ${h.key === periodKey ? 'bd-hist-current' : ''}`} onClick={() => { setPeriodKey(h.key); setView('plan') }}>
                        <span className="bd-row-top">
                          <span className="bd-name">{h.label}{h.start <= today && today <= h.end ? ' · now' : ''}</span>
                          <span className="bd-chip" style={{ color, borderColor: color }}>
                            {h.budget === 0 ? 'No budget' : isOver ? `${money(-left)} over` : `${money(left)} left`}
                          </span>
                        </span>
                        <span className="bd-dim">{h.sub}</span>
                        <span className="bd-hist-bars" aria-hidden="true">
                          <span className="bd-hist-bar" style={{ width: `${(h.budget / maxVal) * 100}%`, background: 'var(--border-strong)' }} />
                          <span className="bd-hist-bar" style={{ width: `${(h.spent / maxVal) * 100}%`, background: color }} />
                        </span>
                        <span className="bd-row-bottom">
                          <span className="bd-dim">Budget {money(h.budget)}</span>
                          <span className="bd-dim">Spent {money(h.spent)}{h.incomeActual > 0 ? ` · Income ${money(h.incomeActual)}` : ''}</span>
                        </span>
                      </button>
                    )
                  })}
                </section>
              </>
            )
          })()}
        </>
      )}

      {periodModal && (
        <div className="modal-backdrop" onClick={() => setPeriodModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Budget period">
            <h2>{periodModal.id ? 'Edit period' : 'New budget period'}</h2>
            <form onSubmit={savePeriod}>
              <div className="field"><label>Name</label><input autoFocus value={periodModal.name} onChange={e => setPeriodModal({ ...periodModal, name: e.target.value })} placeholder="e.g. Pay cycle 3, Holiday trip" /></div>
              <div className="field-row">
                <div className="field"><label>Starts</label><input type="date" value={periodModal.start_date} onChange={e => setPeriodModal({ ...periodModal, start_date: e.target.value })} /></div>
                <div className="field"><label>Ends</label><input type="date" value={periodModal.end_date} min={periodModal.start_date} onChange={e => setPeriodModal({ ...periodModal, end_date: e.target.value })} /></div>
              </div>
              <div className="modal-actions">
                {periodModal.id ? <button type="button" className="btn-delete" onClick={deletePeriod}>Delete</button> : <span />}
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setPeriodModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Budget line">
            <h2>{modal.id ? 'Edit budget line' : 'New budget line'}</h2>
            <form onSubmit={saveLine}>
              <div className="toggle-group" style={{ marginBottom: 12 }}>
                {[['expense', 'Spending'], ['income', 'Income']].map(([k, l]) => (
                  <button key={k} type="button" className={`toggle-btn ${modal.kind === k ? 'toggle-btn-active' : ''}`} onClick={() => setModal({ ...modal, kind: k })}>{l}</button>
                ))}
              </div>
              <div className="field">
                <label>Category</label>
                <select
                  value={modal.customCategory ? '__new' : (knownCats.some(c => c.toLowerCase() === modal.category.toLowerCase()) ? knownCats.find(c => c.toLowerCase() === modal.category.toLowerCase()) : (modal.category ? '__new' : ''))}
                  onChange={e => e.target.value === '__new' ? setModal({ ...modal, category: '', customCategory: true }) : setModal({ ...modal, category: e.target.value, customCategory: false })}
                >
                  <option value="">Choose category…</option>
                  {knownCats.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new">＋ New category…</option>
                </select>
                {(modal.customCategory || (modal.category && !knownCats.some(c => c.toLowerCase() === modal.category.toLowerCase()))) && (
                  <input style={{ marginTop: 8 }} placeholder="New category name" value={modal.category} onChange={e => setModal({ ...modal, category: e.target.value, customCategory: true })} autoFocus />
                )}
              </div>
              <div className="field">
                <label>{modal.kind === 'income' ? 'Expected' : 'Budget'} per {unit} ({currency}){modal.parts.length > 0 ? ' — total of items' : ''}</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0"
                  value={modal.parts.length > 0 ? String(Math.round(modal.parts.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0) * 100) / 100) : modal.planned_amount}
                  disabled={modal.parts.length > 0}
                  onChange={e => setModal({ ...modal, planned_amount: e.target.value })} />
              </div>
              <div className="field">
                <label>Break it down (optional)</label>
                {modal.parts.map((p, idx) => (
                  <div key={idx} className="bd-part-row">
                    <input placeholder="Item (e.g. Spotify)" value={p.name} onChange={e => setModal({ ...modal, parts: modal.parts.map((x, j) => j === idx ? { ...x, name: e.target.value } : x) })} />
                    <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" value={p.amount} onChange={e => setModal({ ...modal, parts: modal.parts.map((x, j) => j === idx ? { ...x, amount: e.target.value } : x) })} aria-label="Item amount" />
                    <button type="button" className="budget-remove" aria-label="Remove item" onClick={() => setModal({ ...modal, parts: modal.parts.filter((_, j) => j !== idx) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="bd-mini" onClick={() => setModal({ ...modal, parts: [...modal.parts, { name: '', amount: '' }] })}>＋ Add item</button>
                <small className="bd-dim" style={{ display: 'block', marginTop: 6 }}>Split this category into line items — the total becomes the budget.</small>
              </div>
              <div className="field">
                <label>Icon</label>
                <div className="bd-picker">
                  {modal.icon && !ICONS.includes(modal.icon) && (
                    <button type="button" className="bd-pick bd-pick-on" aria-label={`Icon ${modal.icon}`}>{modal.icon}</button>
                  )}
                  {ICONS.map(i => (
                    <button key={i} type="button" className={`bd-pick ${modal.icon === i ? 'bd-pick-on' : ''}`} onClick={() => setModal({ ...modal, icon: i })} aria-label={`Icon ${i}`}>{i}</button>
                  ))}
                </div>
                <div className="bd-custom-emoji">
                  <input
                    value=""
                    onChange={e => { const em = firstEmoji(e.target.value); if (em) setModal({ ...modal, icon: em }) }}
                    placeholder="Or type / paste any emoji 😀"
                    aria-label="Custom emoji"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="field">
                <label>Colour</label>
                <div className="bd-picker">
                  {COLORS.map(c => (
                    <button key={c} type="button" className={`bd-swatch ${modal.color === c ? 'bd-swatch-on' : ''}`} style={{ background: c }} onClick={() => setModal({ ...modal, color: c })} aria-label={`Colour ${c}`} />
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Group (optional)</label>
                <input list="bd-groups" placeholder="Needs, Wants, Fun money…" value={modal.grp} onChange={e => setModal({ ...modal, grp: e.target.value })} />
                <datalist id="bd-groups">{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
              </div>
              {modal.kind === 'expense' && (
                <label className="bd-check">
                  <input type="checkbox" checked={modal.rollover} onChange={e => setModal({ ...modal, rollover: e.target.checked })} />
                  <span>Roll over unspent money from the previous {unit}</span>
                </label>
              )}
              <div className="field">
                <label>Notes (optional)</label>
                <input value={modal.notes} onChange={e => setModal({ ...modal, notes: e.target.value })} placeholder="e.g. Includes Woolies + Checkers" />
              </div>
              {!modal.id && period?.type !== 'custom' && (
                <div className="field">
                  <label>Repeat</label>
                  <select value={modal.forward} onChange={e => setModal({ ...modal, forward: Number(e.target.value) })}>
                    <option value={0}>This {unit} only</option>
                    <option value={2}>This + next 2 {unit}s</option>
                    <option value={5}>This + next 5 {unit}s</option>
                    <option value={11}>This + next 11 {unit}s</option>
                  </select>
                </div>
              )}
              <div className="modal-actions">
                {modal.id ? <button type="button" className="btn-delete" onClick={deleteLine}>Delete</button> : <span />}
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
