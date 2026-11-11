import { supabase } from './supabase'
import { dreamReminders } from './goals'
import { startOfToday, nextBirthday, giftNeeded, planItem, isIsoDate } from './social'

const PREF = 'sc-reminders-on'
const SEEN = 'sc-reminders-seen'

export function remindersSupported() { return typeof window !== 'undefined' && 'Notification' in window }
export function remindersOn() {
  try { return localStorage.getItem(PREF) === '1' && remindersSupported() && Notification.permission === 'granted' } catch { return false }
}
export async function enableReminders() {
  if (!remindersSupported()) return { ok: false, message: 'This browser doesn’t support notifications.' }
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, message: 'Notifications are blocked — allow them in your browser settings for this site.' }
  try { localStorage.setItem(PREF, '1') } catch { /* private mode */ }
  return { ok: true }
}
export function disableReminders() { try { localStorage.removeItem(PREF) } catch { /* ignore */ } }

// Pure: what should we remind about right now?
export function dueReminders(contacts, events, today = startOfToday()) {
  const out = []
  for (const c of contacts) {
    const b = nextBirthday(c, today)
    if (b.daysAway === 0) out.push({ key: `b-${c.id}-0-${today.getFullYear()}`, title: `🎉 ${c.name}'s birthday today`, body: b.turning ? `Turning ${b.turning}.` : 'Send a message!' })
    else if (b.daysAway === 1) out.push({ key: `b-${c.id}-1-${today.getFullYear()}`, title: `🎂 ${c.name}'s birthday is tomorrow`, body: giftNeeded(c) ? 'You still need a gift 🎁' : 'Gift sorted ✅' })
    else if (b.daysAway === 7 && giftNeeded(c)) out.push({ key: `b-${c.id}-7-${today.getFullYear()}`, title: `🎁 ${c.name}'s birthday in a week`, body: 'No gift yet — time to shop.' })
  }
  for (const e of events) {
    const p = planItem(e, today)
    if (p.past || p.status === 'cancelled') continue
    const stamp = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
    if (p.daysAway === 0) out.push({ key: `p-${e.id}-0-${stamp}`, title: `💌 ${e.title} today`, body: e.event_time ? `At ${e.event_time.slice(0, 5)}${e.location ? ` · ${e.location}` : ''}` : (e.location || '') })
    else if (p.daysAway === 1) out.push({ key: `p-${e.id}-1-${stamp}`, title: `💌 ${e.title} tomorrow`, body: e.event_time ? `At ${e.event_time.slice(0, 5)}` : '' })
  }
  return out
}

// Runs while the app is open. Each reminder fires once.
export async function runReminders() {
  if (!remindersOn()) return 0
  const [c, e, gl, sv] = await Promise.all([
    supabase.from('contacts').select('*').not('birthday', 'is', null),
    supabase.from('social_events').select('*'),
    supabase.from('goals').select('*'),
    supabase.from('savings_goals').select('id,target_amount,current_amount'),
  ])
  if (c.error || e.error) return 0
  const contacts = (c.data || []).filter((x) => !x.archived && x.name && isIsoDate(x.birthday))
  const events = (e.data || []).filter((x) => x.title && isIsoDate(x.event_date))
  let seen = {}
  try { seen = JSON.parse(localStorage.getItem(SEEN) || '{}') } catch { seen = {} }
  let fired = 0
  const savings = {}
  ;(sv.data || []).forEach((x) => { savings[x.id] = x })
  const dreams = gl.error ? [] : dreamReminders(gl.data || [], { savings })
  for (const r of [...dueReminders(contacts, events), ...dreams]) {
    if (seen[r.key]) continue
    try { new Notification(r.title, { body: r.body }); seen[r.key] = Date.now(); fired++ } catch { /* ignore */ }
  }
  // keep the seen-list small
  const cutoff = Date.now() - 14 * 864e5
  for (const k of Object.keys(seen)) if (seen[k] < cutoff) delete seen[k]
  try { localStorage.setItem(SEEN, JSON.stringify(seen)) } catch { /* ignore */ }
  return fired
}
