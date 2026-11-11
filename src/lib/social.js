// Shared helpers for the Social Calendar (birthdays + plans)
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const CHIP_COLORS = ['var(--lavender)', 'var(--accent-deep)', 'var(--butter)', 'var(--accent-mid)']

export const RECURRENCE = [
  { key: '', label: 'Does not repeat' },
  { key: 'weekly', label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
  { key: 'yearly', label: 'Every year' },
]

// Local-date helpers (never use toISOString for "today": it is UTC and slips a day near midnight)
export function pad(n) { return String(n).padStart(2, '0') }
export function toIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export function todayIso() { return toIso(new Date()) }
export function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}
export function dateOf(s) { const p = parseLocalDate(s); return new Date(p.year, p.month, p.day) }
export function daysBetween(a, b) { return Math.round((b - a) / 86400000) }
export function formatMonthDay(month, day) { return `${MONTH_NAMES[month].slice(0, 3)} ${day}` }
export function formatDate(d) { return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}` }
export function formatTime(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}
export function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n}d` }

// Birthdays
export function nextBirthday(c, today) {
  const bd = parseLocalDate(c.birthday)
  let next = new Date(today.getFullYear(), bd.month, bd.day)
  if (next < today) next = new Date(today.getFullYear() + 1, bd.month, bd.day)
  const turning = c.birth_year ? next.getFullYear() - c.birth_year : null
  return { ...c, nextDate: next, daysAway: daysBetween(today, next), month: bd.month, day: bd.day, turning }
}
export function giftNeeded(c) { return !c.no_gift && !c.gift_purchased }

// Plans (support weekly / monthly / yearly repeats)
function addMonthsClamped(base, n) {
  const d = new Date(base.getFullYear(), base.getMonth() + n, 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(base.getDate(), last))
  return d
}

export function planOccursOn(ev, date) {
  if (!ev.event_date) return false
  const start = dateOf(ev.event_date)
  if (date < start) return false
  if (!ev.recurrence) return toIso(date) === ev.event_date
  if (ev.recurrence === 'weekly') return daysBetween(start, date) % 7 === 0
  if (ev.recurrence === 'monthly') {
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    return date.getDate() === Math.min(start.getDate(), last)
  }
  if (ev.recurrence === 'yearly') return date.getMonth() === start.getMonth() && date.getDate() === start.getDate()
  return false
}

// The next time this plan happens on/after `today` (or, for one-offs, its only date).
export function planNext(ev, today) {
  const start = dateOf(ev.event_date)
  let next = start
  if (ev.recurrence && start < today) {
    if (ev.recurrence === 'weekly') {
      next = new Date(start); next.setDate(start.getDate() + Math.ceil(daysBetween(start, today) / 7) * 7)
    } else if (ev.recurrence === 'monthly') {
      let n = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth())
      next = addMonthsClamped(start, n)
      if (next < today) next = addMonthsClamped(start, n + 1)
    } else if (ev.recurrence === 'yearly') {
      next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
      if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate())
    }
  }
  const past = !ev.recurrence && start < today
  return { next, past }
}

export function planItem(ev, today) {
  const { next, past } = planNext(ev, today)
  const status = ev.status || 'planned'
  return {
    ...ev, kind: 'p', title: ev.title, nextDate: next, daysAway: daysBetween(today, next),
    past: past || status === 'done' || status === 'cancelled', status,
  }
}

// iCalendar export
function icsDate(iso) { return iso.replace(/-/g, '') }
function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n') }
export function buildIcs({ contacts = [], events = [], today = new Date() }) {
  const stamp = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}T000000Z`
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Arty//Social Calendar//EN', 'CALSCALE:GREGORIAN']
  for (const c of contacts) {
    if (!c.birthday) continue
    const bd = parseLocalDate(c.birthday)
    const start = `${today.getFullYear()}-${pad(bd.month + 1)}-${pad(bd.day)}`
    const end = toIso(new Date(today.getFullYear(), bd.month, bd.day + 1))
    out.push('BEGIN:VEVENT', `UID:birthday-${c.id}@arty`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(start)}`, `DTEND;VALUE=DATE:${icsDate(end)}`,
      'RRULE:FREQ=YEARLY', `SUMMARY:${icsEscape(`🎂 ${c.name}'s birthday`)}`, 'END:VEVENT')
  }
  for (const e of events) {
    if (!e.event_date) continue
    const rule = { weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[e.recurrence]
    out.push('BEGIN:VEVENT', `UID:plan-${e.id}@arty`, `DTSTAMP:${stamp}`)
    if (e.event_time) {
      const t = e.event_time.slice(0, 5).replace(':', '')
      const [h, m] = e.event_time.split(':').map(Number)
      const endT = `${pad((h + 1) % 24)}${pad(m)}`
      out.push(`DTSTART:${icsDate(e.event_date)}T${t}00`, `DTEND:${icsDate(e.event_date)}T${endT}00`)
    } else {
      const next = toIso(new Date(dateOf(e.event_date).getTime() + 86400000))
      out.push(`DTSTART;VALUE=DATE:${icsDate(e.event_date)}`, `DTEND;VALUE=DATE:${icsDate(next)}`)
    }
    if (rule) out.push(`RRULE:FREQ=${rule}`)
    out.push(`SUMMARY:${icsEscape(e.title)}`)
    if (e.location) out.push(`LOCATION:${icsEscape(e.location)}`)
    if (e.notes) out.push(`DESCRIPTION:${icsEscape(e.notes)}`)
    if (e.status === 'cancelled') out.push('STATUS:CANCELLED')
    out.push('END:VEVENT')
  }
  out.push('END:VCALENDAR')
  return out.join('\r\n')
}

export function downloadIcs(text, name = 'social-calendar.ics') {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function missingColumnHint(msg) {
  return /column|schema cache/i.test(msg || '') ? `${msg} — run social-calendar-v2.sql in Supabase, then refresh.` : msg
}
