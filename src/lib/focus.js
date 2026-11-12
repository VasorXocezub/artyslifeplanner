// Focus timer helpers (pure)
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(seconds))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

const dayOf = (s) => (s.completed_at ? iso(new Date(s.completed_at)) : null)

export function minutesOn(sessions, dayIso) {
  return sessions.filter((s) => dayOf(s) === dayIso).reduce((n, s) => n + Number(s.duration_minutes || 0), 0)
}

export function lastDays(sessions, n = 7, today = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    out.push({ date: iso(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }), minutes: minutesOn(sessions, iso(d)) })
  }
  return out
}

// Consecutive days with at least one session, counting back from today (or yesterday if today is still empty)
export function focusStreak(sessions, today = new Date()) {
  const days = new Set(sessions.map(dayOf).filter(Boolean))
  let d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export const SOUNDS = [
  { key: 'chime', label: 'Soft chime', notes: [660, 880, 1320], type: 'sine', gap: 0.22 },
  { key: 'bell', label: 'Bell', notes: [880, 660], type: 'triangle', gap: 0.5 },
  { key: 'pop', label: 'Pop', notes: [520, 780], type: 'square', gap: 0.12 },
  { key: 'off', label: 'Silent', notes: [], type: 'sine', gap: 0 },
]

export function getSound() {
  try { return localStorage.getItem('focus-sound') || 'chime' } catch { return 'chime' }
}
export function setSound(k) {
  try { localStorage.setItem('focus-sound', k) } catch { /* ignore */ }
}

export function playChime(kind = getSound()) {
  const snd = SOUNDS.find((x) => x.key === kind) || SOUNDS[0]
  if (!snd.notes.length) return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    snd.notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = snd.type; o.frequency.value = f
      o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime + i * snd.gap
      const peak = snd.type === 'square' ? 0.06 : 0.18
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      o.start(t); o.stop(t + 0.65)
    })
  } catch { /* audio is a nice-to-have */ }
}

// Pomodoro: long break after every 4th focus session
export const breakLength = (completedToday) => (completedToday > 0 && completedToday % 4 === 0 ? 15 : 5)
