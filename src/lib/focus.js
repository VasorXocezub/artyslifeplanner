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

export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[660, 880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.22
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      o.start(t); o.stop(t + 0.65)
    })
  } catch { /* audio is a nice-to-have */ }
}
