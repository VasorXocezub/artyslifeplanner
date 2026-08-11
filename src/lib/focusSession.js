const KEY = 'activeFocusSession'

export function getActiveFocusSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function setActiveFocusSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearActiveFocusSession() {
  localStorage.removeItem(KEY)
}

export function remainingSecondsFor(session) {
  if (!session) return 0
  if (session.paused) return session.remainingAtPause
  return Math.max(0, Math.round((session.endTime - Date.now()) / 1000))
}
