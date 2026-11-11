import { MONTH_NAMES, pad } from './social'

const MONTHS = Object.fromEntries(MONTH_NAMES.flatMap((m, i) => [[m.toLowerCase(), i + 1], [m.slice(0, 3).toLowerCase(), i + 1]]))

// Returns { month, day, year|null } or null. Numeric dates with a slash/dot are read day-first (DD/MM/YYYY).
export function parseDateLoose(raw) {
  const t = String(raw || '').trim().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!t) return null
  let m
  if ((m = t.match(/^(\d{4})-?(\d{2})-?(\d{2})$/))) return valid(+m[2], +m[3], +m[1])
  if ((m = t.match(/^--(\d{2})-?(\d{2})$/))) return valid(+m[1], +m[2], null)
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) return valid(+m[2], +m[1], m[3] ? fullYear(+m[3]) : null)
  if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+)(?: (\d{4}))?$/)) && MONTHS[m[2].toLowerCase()]) return valid(MONTHS[m[2].toLowerCase()], +m[1], m[3] ? +m[3] : null)
  if ((m = t.match(/^([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/)) && MONTHS[m[1].toLowerCase()]) return valid(MONTHS[m[1].toLowerCase()], +m[2], m[3] ? +m[3] : null)
  return null
}
function fullYear(y) { return y < 100 ? (y > 30 ? 1900 + y : 2000 + y) : y }
function valid(month, day, year) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day, year }
}

export function toRow(name, dateParts, extra = {}) {
  const yearForDate = dateParts.year || new Date().getFullYear()
  return {
    name: name.trim(),
    birthday: `${yearForDate}-${pad(dateParts.month)}-${pad(dateParts.day)}`,
    birth_year: dateParts.year && dateParts.year > 1900 ? dateParts.year : null,
    ...extra,
  }
}

// "Name, date, relationship(optional), phone(optional)" per line (comma, semicolon or tab separated)
export function parseLines(text) {
  const rows = []
  const bad = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const l = line.trim()
    if (!l) continue
    const cells = l.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ''))
    if (/^name$/i.test(cells[0])) continue
    // the date is whichever cell parses as one; name is the first cell
    const dIdx = cells.findIndex((c, i) => i > 0 && parseDateLoose(c))
    if (!cells[0] || dIdx < 0) { bad.push(l); continue }
    const rest = cells.filter((_, i) => i > 0 && i !== dIdx)
    const phone = rest.find((c) => /^[+\d][\d\s()-]{6,}$/.test(c)) || null
    const rel = rest.find((c) => c && c !== phone) || null
    rows.push(toRow(cells[0], parseDateLoose(cells[dIdx]), { relationship: rel ? rel.toLowerCase() : null, phone }))
  }
  return { rows, bad }
}

// vCard (.vcf) export from phone contacts: FN, BDAY, TEL
export function parseVcf(text) {
  const rows = []
  const cards = String(text || '').split(/BEGIN:VCARD/i).slice(1)
  for (const card of cards) {
    const unfolded = card.replace(/\r?\n[ \t]/g, '')
    const get = (k) => (unfolded.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, 'im')) || [])[1]?.trim()
    const name = get('FN') || (get('N') || '').split(';').filter(Boolean).reverse().join(' ')
    const bday = get('BDAY')
    const parts = parseDateLoose(bday)
    if (!name || !parts) continue
    rows.push(toRow(name, parts, { phone: get('TEL') || null, relationship: null }))
  }
  return rows
}
