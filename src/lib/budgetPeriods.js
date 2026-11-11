import { supabase } from './supabase'

export const DEFAULT_SETTINGS = { period_type: 'monthly', month_start_day: 25, anchor_date: null, warn_pct: 80, income_mode: 'planned' }

export const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseD = (s) => new Date(s + 'T00:00:00')
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const dayMs = 86400000
export const diffDays = (a, b) => Math.round((b - a) / dayMs)
export const fmtShort = (d) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
export const fmtLong = (d) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
export const toMonthly = (amount, freq) => (freq === 'weekly' ? amount * 4.33 : freq === 'yearly' ? amount / 12 : amount)
export const firstEmoji = (str) => {
  const t = (str || '').trim()
  if (!t) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)[Symbol.iterator]().next()
    return it.value ? it.value.segment : ''
  }
  return Array.from(t).slice(0, 2).join('')
}
export const lastMonday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return addDays(t, -((t.getDay() + 6) % 7)) }

// A period key is a string stored in budget_items.month:
//   monthly      "2026-11"         (starts on the chosen start day)
//   week/fort.   "P7:2026-11-09"   (length in days : start date)
//   custom       "C:<uuid>"
export function describePeriod(key, settings, customs) {
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
  // Payday-style months are named after the month they end in: key 2026-11 with start day 25 = 25 Oct – 24 Nov.
  let start = sd === 1 ? new Date(y, m - 1, 1) : new Date(y, m - 2, sd)
  let end = sd === 1 ? new Date(y, m, 0) : new Date(y, m - 1, sd - 1)
  const ov = settings.overrides && settings.overrides[key]
  if (ov) { start = parseD(ov.start_date); end = parseD(ov.end_date) }
  return { key, start, end, type: 'monthly', custom: !!ov, label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), sub: `${fmtShort(start)} – ${fmtLong(end)}` }
}

export function currentKey(settings, customs) {
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
  // Look for the month whose dates (including any custom dates) contain today
  for (const n of [0, -1, 1, -2, 2]) {
    const d = new Date(today.getFullYear(), today.getMonth() + n, 1)
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    const p = describePeriod(k, settings, [])
    if (p && p.start <= today && today <= p.end) return k
  }
  const base = sd > 1 && today.getDate() >= sd ? new Date(today.getFullYear(), today.getMonth() + 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}`
}

export function shiftKey(key, n, settings, customs) {
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


// The period key that contains a given date (YYYY-MM-DD), or null if none.
export function keyForDate(dateStr, settings, customs) {
  const d = parseD(dateStr)
  const type = settings.period_type
  if (type === 'weekly' || type === 'fortnightly') {
    const len = type === 'weekly' ? 7 : 14
    const anchor = settings.anchor_date ? parseD(settings.anchor_date) : lastMonday()
    return `P${len}:${ymd(addDays(anchor, Math.floor(diffDays(anchor, d) / len) * len))}`
  }
  if (type === 'custom') {
    const hit = customs.find(c => c.start_date <= dateStr && dateStr <= c.end_date)
    return hit ? 'C:' + hit.id : null
  }
  for (const n of [0, -1, 1, -2, 2]) {
    const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
    const k = `${x.getFullYear()}-${pad(x.getMonth() + 1)}`
    const p = describePeriod(k, settings, [])
    if (p && p.start <= d && d <= p.end) return k
  }
  return null
}

// Settings + custom periods + per-period date overrides, ready for describePeriod/currentKey.
export async function loadBudgetMeta() {
  const [sRes, cRes, oRes] = await Promise.all([
    supabase.from('budget_settings').select('*').limit(1).maybeSingle(),
    supabase.from('budget_periods').select('*').order('start_date', { ascending: true }),
    supabase.from('budget_period_overrides').select('*'),
  ])
  const overrides = {}
  ;(oRes.error ? [] : (oRes.data || [])).forEach(o => { overrides[o.period_key] = o })
  const settings = { ...DEFAULT_SETTINGS, ...(sRes.error || !sRes.data ? {} : sRes.data), overrides }
  return { settings, customs: cRes.error ? [] : (cRes.data || []), settingsRow: sRes.error ? null : sRes.data }
}
