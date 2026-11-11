import { MONTH_NAMES, toIso } from './social'

const DOW = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 }
const MON = Object.fromEntries(MONTH_NAMES.map((m, i) => [m.slice(0, 3).toLowerCase(), i]))
const TYPE_HINTS = [
  [/dentist|doctor|dr\b|appointment|checkup|physio|therapy|salon|haircut/i, 'appointment'],
  [/girls'? ?night|girls/i, 'girls_night'],
  [/date night|date\b|anniversary/i, 'date_night'],
  [/trip|flight|holiday|vacation|weekend away|getaway/i, 'adventure'],
  [/christmas|nye|new year|easter|halloween|valentine/i, 'holiday_magic'],
  [/mom|dad|family|gran|aunt|uncle|cousin/i, 'family_time'],
  [/dinner|brunch|lunch|coffee|drinks|braai|party|catch.?up|book club/i, 'cozy_gathering'],
  [/meeting|work|client|deadline|presentation/i, 'ceo_era'],
  [/remind|call|pay|buy|book\b/i, 'reminder'],
]

// "Dinner Fri 7pm at Rosebank" -> { title, event_date, event_time, location, event_type }
export function parseQuickPlan(input, today = new Date()) {
  let t = ` ${String(input || '').trim()} `
  if (!t.trim()) return null
  const out = {}
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const take = (re, fn) => { const m = t.match(re); if (m) { fn(m); t = t.replace(m[0], ' ') } return !!m }

  // location: "at X" / "@ X" (X runs to the end), after the time has been removed
  const gotTime = take(/\s(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i, (m) => {
    let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12
    out.event_time = `${String(h).padStart(2, '0')}:${m[2] || '00'}`
  })
  if (!gotTime) take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i, (m) => { out.event_time = `${m[1].padStart(2, '0')}:${m[2]}` })

  take(/\s(?:at|@)\s+([^]+?)\s*$/i, (m) => { out.location = m[1].trim() })

  let date = null
  if (take(/\b(today|tonight)\b/i, () => { date = base })) { /* done */ }
  else if (take(/\btomorrow\b/i, () => { date = new Date(base); date.setDate(base.getDate() + 1) })) { /* done */ }
  else if (take(/\b(?:(next)\s+)?(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)(?:day|sday|nesday|rsday|urday)?\b/i, (m) => {
    const target = DOW[m[2].toLowerCase()]
    let add = (target - base.getDay() + 7) % 7
    if (add === 0) add = 7
    date = new Date(base); date.setDate(base.getDate() + add)
  })) { /* done */ }
  else if (take(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i, (m) => { date = pick(+m[1], MON[m[2].toLowerCase()], base) })) { /* done */ }
  else if (take(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, (m) => { date = pick(+m[2], MON[m[1].toLowerCase()], base) })) { /* done */ }
  else take(/\b(\d{1,2})[/.](\d{1,2})\b/, (m) => { date = pick(+m[1], +m[2] - 1, base) })

  if (date) out.event_date = toIso(date)
  out.title = t.replace(/\s+/g, ' ').replace(/\b(on|at|@)\s*$/i, '').trim()
  if (!out.title) return null
  const hint = TYPE_HINTS.find(([re]) => re.test(out.title))
  if (hint) out.event_type = hint[1]
  return out
}

function pick(day, month, base) {
  let d = new Date(base.getFullYear(), month, day)
  if (d < base) d = new Date(base.getFullYear() + 1, month, day)
  return d
}
