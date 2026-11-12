// Global focus timer. Lives outside React so a session keeps running (and finishes correctly)
// on any page. Time is always derived from a saved end time; a Web Worker drives the ticks so
// background tabs aren't throttled the way setInterval is.
import { supabase, getUserId } from './supabase'
import { getActiveFocusSession, setActiveFocusSession, clearActiveFocusSession, remainingSecondsFor } from './focusSession'
import { fmtClock, playChime, breakLength } from './focus'

const listeners = new Set()
let state = { active: null, remaining: 0, paused: false, done: null, error: null, prefill: null }
let ticker = null
let started = false
let baseTitle = ''
let finishing = false

const hint = (m) => (/column|schema cache/i.test(m || '') ? `${m} — run focus-v2.sql and focus-v3.sql in Supabase, then refresh.` : m)

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
  if (typeof document !== 'undefined') {
    if (!baseTitle) baseTitle = document.title.replace(/^⏱ [\d:]+ · /, '')
    document.title = state.active ? `⏱ ${fmtClock(state.remaining)} · ${baseTitle}` : baseTitle
  }
}

export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const getState = () => state

export function getSettings() {
  try { return { pomodoro: localStorage.getItem('focus-pomodoro') === '1' } } catch { return { pomodoro: false } }
}
export function setPomodoro(on) {
  try { localStorage.setItem('focus-pomodoro', on ? '1' : '0') } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

function todayCount(delta = 0) {
  const k = new Date().toDateString()
  try {
    const raw = JSON.parse(localStorage.getItem('focus-cycle') || '{}')
    const n = (raw.day === k ? raw.n : 0) + delta
    if (delta) localStorage.setItem('focus-cycle', JSON.stringify({ day: k, n }))
    return n
  } catch { return delta }
}

function startTicker() {
  stopTicker()
  try {
    const blob = new Blob(['setInterval(function(){postMessage(1)},500)'], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const w = new Worker(url)
    w.onmessage = tick
    ticker = { stop: () => { w.terminate(); URL.revokeObjectURL(url) } }
  } catch {
    const id = setInterval(tick, 500)
    ticker = { stop: () => clearInterval(id) }
  }
}
function stopTicker() { if (ticker) { ticker.stop(); ticker = null } }

function tick() {
  const stored = getActiveFocusSession()
  if (!stored || !stored.totalSeconds) { stopTicker(); if (state.active) set({ active: null, paused: false }); return }
  const left = remainingSecondsFor(stored)
  if (left !== state.remaining) set({ remaining: left })
  if (left <= 0 && !stored.paused) finish(stored)
}

export function init() {
  if (started) return
  started = true
  const stored = getActiveFocusSession()
  if (!stored || !stored.totalSeconds) { if (stored) clearActiveFocusSession(); return }
  set({ active: toActive(stored), paused: !!stored.paused, remaining: remainingSecondsFor(stored) })
  if (!stored.paused) startTicker()
  tick()
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) tick() })
}

const toActive = (s) => ({ mode: s.mode || 'focus', sessionId: s.sessionId, totalSeconds: s.totalSeconds, label: s.label || '', todoId: s.todoId, goalId: s.goalId, next: s.next || null })

export async function start({ mode = 'focus', mins, label = '', todoId = null, goalId = null, next = null }) {
  init()
  set({ error: null, done: null })
  const total = Math.round(mins * 60)
  let sessionId = null
  if (mode === 'focus') {
    const user_id = await getUserId()
    const row = { duration_minutes: mins, user_id }
    if (label) row.label = label
    if (todoId) row.todo_id = String(todoId)
    if (goalId) row.goal_id = String(goalId)
    const { data, error } = await supabase.from('focus_sessions').insert(row).select().single()
    if (error) { set({ error: hint(error.message) }); return false }
    sessionId = data.id
  }
  const stored = { mode, sessionId, totalSeconds: total, endTime: Date.now() + total * 1000, paused: false, remainingAtPause: null, label: mode === 'focus' ? label : (next?.label || ''), todoId, goalId, next }
  setActiveFocusSession(stored)
  set({ active: toActive(stored), paused: false, remaining: total })
  startTicker()
  try { if (mode === 'focus' && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ }
  return true
}

export function togglePause() {
  const stored = getActiveFocusSession()
  if (!stored) return
  if (stored.paused) {
    setActiveFocusSession({ ...stored, paused: false, endTime: Date.now() + stored.remainingAtPause * 1000, remainingAtPause: null })
    set({ paused: false }); startTicker()
  } else {
    stopTicker()
    const left = remainingSecondsFor(stored)
    setActiveFocusSession({ ...stored, paused: true, remainingAtPause: left })
    set({ paused: true, remaining: left })
  }
}

export async function stop() {
  stopTicker()
  const a = state.active
  clearActiveFocusSession()
  set({ active: null, paused: false, remaining: 0 })
  if (a?.sessionId) {
    const { error } = await supabase.from('focus_sessions').delete().eq('id', a.sessionId)
    if (error) set({ error: hint(error.message) })
  }
}

async function finish(stored) {
  if (finishing) return
  finishing = true
  stopTicker()
  clearActiveFocusSession()
  set({ active: null, paused: false, remaining: 0 })
  playChime()
  const mins = Math.round(stored.totalSeconds / 60)
  try {
    if (stored.mode === 'break') {
      set({ done: { mode: 'break', mins } })
      if (stored.next && getSettings().pomodoro) await start({ mode: 'focus', mins: stored.next.mins, label: stored.next.label, todoId: stored.next.todoId, goalId: stored.next.goalId })
      return
    }
    const { error } = await supabase.from('focus_sessions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', stored.sessionId)
    if (error) set({ error: hint(error.message) })
    let dreamTitle = null
    if (stored.goalId) {
      const { data: g } = await supabase.from('goals').select('*').eq('id', stored.goalId).maybeSingle()
      dreamTitle = g?.title || null
      const user_id = await getUserId()
      const r = await supabase.from('goal_notes').insert({ user_id, goal_id: String(stored.goalId), body: `⏱ Focused for ${mins} min${stored.label ? ` — ${stored.label}` : ''}` })
      if (r.error) set({ error: `Focus saved, but couldn't add it to the dream's journal — ${hint(r.error.message)}` })
      if (g && 'touched_at' in g) await supabase.from('goals').update({ touched_at: new Date().toISOString() }).eq('id', g.id)
    }
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('⏱ Focus session complete', { body: `${mins} minutes done${stored.label ? ` — ${stored.label}` : ''}. Nice work!` })
    } catch { /* ignore */ }
    const n = todayCount(1)
    const done = { mode: 'focus', mins, label: stored.label, todoId: stored.todoId, goalId: stored.goalId, sessionId: stored.sessionId, dreamTitle, cycle: n }
    set({ done })
    if (getSettings().pomodoro) {
      const b = breakLength(n)
      await start({ mode: 'break', mins: b, next: { mins: Math.round(stored.totalSeconds / 60), label: stored.label, todoId: stored.todoId, goalId: stored.goalId } })
      set({ done: { ...done, autoBreak: b } })
    }
    window.dispatchEvent(new Event('focus-session-saved'))
  } finally {
    finishing = false
  }
}

export async function saveNote(done, text) {
  const body = text.trim()
  if (!body) return true
  if (done.sessionId) {
    const { error } = await supabase.from('focus_sessions').update({ note: body }).eq('id', done.sessionId)
    if (error) { set({ error: hint(error.message) }); return false }
  }
  if (done.goalId) {
    const user_id = await getUserId()
    const r = await supabase.from('goal_notes').insert({ user_id, goal_id: String(done.goalId), body: `📝 ${body}` })
    if (r.error) { set({ error: hint(r.error.message) }); return false }
  }
  window.dispatchEvent(new Event('focus-session-saved'))
  return true
}

export function dismissDone() { set({ done: null }) }
export function clearError() { set({ error: null }) }
export function prefill(p) { set({ prefill: p }) }
export function clearPrefill() { set({ prefill: null }) }
export function markTodoDone(id) {
  return supabase.from('todos').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
}
