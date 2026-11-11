import { supabase, getUserId } from './supabase'

let cache = null
export async function loadRules(force = false) {
  if (cache && !force && Date.now() - cache.t < 60000) return cache.rules
  const { data, error } = await supabase.from('category_rules').select('*').order('created_at', { ascending: true })
  if (error) return []
  cache = { t: Date.now(), rules: data || [] }
  return cache.rules
}
export const clearRulesCache = () => { cache = null }

// longest matching pattern wins, so "UBER EATS" beats "UBER"
export function matchRule(text, rules) {
  const t = (text || '').toLowerCase()
  if (!t) return null
  let best = null
  for (const r of rules || []) {
    const p = (r.pattern || '').toLowerCase().trim()
    if (p && t.includes(p) && (!best || p.length > best.pattern.length)) best = { pattern: p, category: r.category }
  }
  return best
}

export async function addRule(pattern, category) {
  const p = pattern.trim(), c = category.trim()
  if (!p || !c) return { error: { message: 'Enter some text to match and a category.' } }
  const user_id = await getUserId()
  clearRulesCache()
  return supabase.from('category_rules').insert({ user_id, pattern: p, category: c })
}
export async function deleteRule(id) { clearRulesCache(); return supabase.from('category_rules').delete().eq('id', id) }

// ---- CSV ----
export function parseCSV(text) {
  const first = text.split(/\r?\n/)[0] || ''
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === delim) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row)
  return rows
}

export function parseAmount(v) {
  let s = String(v ?? '').trim()
  if (!s) return null
  let neg = /^\(.*\)$/.test(s) || s.startsWith('-') || s.endsWith('-') || /\bdr\b/i.test(s)
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  return neg ? -n : n
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
export function parseDate(v) {
  const s = String(v ?? '').trim()
  let m
  const p = (n) => String(n).padStart(2, '0')
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return `${m[1]}-${p(m[2])}-${p(m[3])}`
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return `${m[3]}-${p(m[2])}-${p(m[1])}` // day first (South Africa)
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/)) && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${p(MONTHS[m[2].toLowerCase()])}-${p(m[1])}`
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

export function guessColumns(header) {
  const h = header.map(x => x.toLowerCase())
  const find = (re) => h.findIndex(x => re.test(x))
  return {
    date: Math.max(0, find(/date/)),
    desc: Math.max(0, find(/descr|detail|narrat|reference|memo|payee|merchant|particular/)),
    amount: find(/^amount|amount$|value/),
    debit: find(/debit|money out|withdraw/),
    credit: find(/credit|money in|deposit/),
  }
}
