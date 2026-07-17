import { useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CHIP_COLORS = ['#D9A8B8', '#C98A72', '#AFC6DD', '#243B63']

const EVENT_TYPES = [
  { key: 'party', label: '🎉 Party' },
  { key: 'dinner', label: '🍽️ Dinner' },
  { key: 'coffee', label: '☕ Coffee Date' },
  { key: 'girls_night', label: '💅 Girls\' Night' },
  { key: 'movie', label: '🎬 Movie Night' },
  { key: 'trip', label: '🏖️ Trip' },
  { key: 'birthday_party', label: '🎂 Birthday Party' },
  { key: 'drinks', label: '🍷 Drinks' },
  { key: 'selfcare', label: '🧘 Self-Care Day' },
  { key: 'hangout', label: '📅 Hangout' },
]

const RSVP_OPTIONS = [
  { key: 'going', label: '✅ Going' },
  { key: 'maybe', label: '🤔 Maybe' },
  { key: 'cant', label: '❌ Can\'t Make It' },
]

function eventTypeInfo(key) {
  return EVENT_TYPES.find((t) => t.key === key) || EVENT_TYPES[EVENT_TYPES.length - 1]
}

function rsvpInfo(key) {
  return RSVP_OPTIONS.find((r) => r.key === key) || RSVP_OPTIONS[0]
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function formatMonthDay(month, day) {
  return `${MONTH_NAMES[month].slice(0, 3)} ${day}`
}

function formatTime(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

const emptyForm = {
  title: '', event_date: '', event_time: '', location: '',
  event_type: 'hangout', rsvp: 'going', notes: '',
}

export default function SocialCalendarView() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('social_events')
      .select('*')
      .order('event_date', { ascending: true })

    if (error) setError(error.message)
    else setEvents(data)
    setLoading(false)
  }

  function openAdd(prefillDate) {
    setEditingId(null)
    setForm({ ...emptyForm, event_date: prefillDate || new Date().toISOString().split('T')[0] })
    setModalOpen(true)
  }

  function openEdit(event) {
    setEditingId(event.id)
    setForm({
      title: event.title || '',
      event_date: event.event_date || '',
      event_time: event.event_time || '',
      location: event.location || '',
      event_type: event.event_type || 'hangout',
      rsvp: event.rsvp || 'going',
      notes: event.notes || '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) return
    setSaving(true)

    const payload = {
      title: form.title.trim(),
      event_date: form.event_date,
      event_time: form.event_time || null,
      location: form.location.trim() || null,
      event_type: form.event_type,
      rsvp: form.rsvp,
      notes: form.notes.trim() || null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('social_events').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('social_events').insert({ ...payload, user_id }))
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchEvents()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Remove this event from your calendar?')) return
    setSaving(true)
    const { error } = await supabase.from('social_events').delete().eq('id', editingId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchEvents()
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const eventsByDay = useMemo(() => {
    const map = {}
    for (const e of events) {
      if (!e.event_date) continue
      const d = parseLocalDate(e.event_date)
      if (d.month !== month || d.year !== year) continue
      if (!map[d.day]) map[d.day] = []
      map[d.day].push(e)
    }
    return map
  }, [events, month, year])

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const arr = []
    for (let i = 0; i < firstDay; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    return arr
  }, [year, month])

  const upcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return events
      .map((e) => {
        const d = parseLocalDate(e.event_date)
        const eventDate = new Date(d.year, d.month, d.day)
        const daysAway = Math.round((eventDate - today) / 86400000)
        return { ...e, eventDate, daysAway, month: d.month, day: d.day }
      })
      .filter((e) => e.daysAway >= 0)
      .sort((a, b) => a.eventDate - b.eventDate)
  }, [events])

  const upNext = upcoming.slice(0, 3)

  function goToMonth(delta) {
    setViewDate(new Date(year, month + delta, 1))
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Social Calendar</h1>
          <p className="view-subtitle cake-club-subtitle">Your social life, but make it cute. 💌</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={() => openAdd()}>+ Add event</button>
        </div>
      </div>

      {loading && <p className="loading">Checking the group chat… 💬✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
          {upNext.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">UP NEXT</p>
              <div className="card-grid">
                {upNext.map((e, i) => {
                  const typeInfo = eventTypeInfo(e.event_type)
                  const rInfo = rsvpInfo(e.rsvp)
                  return (
                    <div
                      className="contact-card upnext-card"
                      key={e.id}
                      onClick={() => openEdit(e)}
                      style={{ borderTopColor: CHIP_COLORS[i % CHIP_COLORS.length] }}
                    >
                      <span className="status-badge" style={{ background: CHIP_COLORS[i % CHIP_COLORS.length] }}>
                        {typeInfo.label}
                      </span>
                      <h3 className="contact-name">{e.title}</h3>
                      <p className="habit-schedule">
                        {formatMonthDay(e.month, e.day)}{e.event_time ? ` · ${formatTime(e.event_time)}` : ''} · {e.daysAway === 0 ? 'today!' : `in ${e.daysAway}d`}
                      </p>
                      {e.location && <p className="contact-relationship">📍 {e.location}</p>}
                      <p className="progress-label">{rInfo.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="calendar-card">
            <div className="calendar-nav">
              <button className="cal-nav-btn" onClick={() => goToMonth(-1)}>‹</button>
              <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
              <button className="cal-nav-btn" onClick={() => goToMonth(1)}>›</button>
            </div>
            <div className="calendar-grid">
              {DAY_NAMES.map((d) => (
                <div key={d} className="cal-day-name">{d}</div>
              ))}
              {cells.map((day, i) => (
                <div
                  key={i}
                  className={`cal-cell ${day ? 'cal-cell-active' : 'cal-cell-empty'}`}
                  onClick={() => {
                    if (!day) return
                    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    openAdd(iso)
                  }}
                >
                  {day && <span className="cal-day-num">{day}</span>}
                  {day && eventsByDay[day] && (
                    <div className="cal-chip-stack">
                      {eventsByDay[day].map((e, ci) => (
                        <span
                          key={e.id}
                          className="cal-chip"
                          style={{ background: CHIP_COLORS[ci % CHIP_COLORS.length] }}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            openEdit(e)
                          }}
                        >
                          {eventTypeInfo(e.event_type).label.split(' ')[0]} {e.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {upcoming.length > 0 && (
            <div className="upcoming-section">
              <p className="module-group-label">EVERYTHING COMING UP</p>
              <div className="upcoming-list">
                {upcoming.slice(0, 10).map((e, i) => (
                  <div
                    className="upcoming-row"
                    key={e.id}
                    onClick={() => openEdit(e)}
                    style={{ borderLeftColor: CHIP_COLORS[i % CHIP_COLORS.length] }}
                  >
                    <span className="upcoming-name">{eventTypeInfo(e.event_type).label.split(' ')[0]} {e.title}</span>
                    <span className="upcoming-date">
                      {formatMonthDay(e.month, e.day)}{e.event_time ? ` · ${formatTime(e.event_time)}` : ''} · {e.daysAway === 0 ? 'today' : `in ${e.daysAway}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="empty-state">
              <h3>No plans yet — let's fix that ✨</h3>
              <p>Tap a date above, or hit "+ Add event" to get your calendar looking cute.</p>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit event' : 'New event'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>What's the plan?</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Sarah's birthday dinner, girls' trip…"
                  required
                />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Time (optional)</label>
                  <input
                    type="time"
                    value={form.event_time}
                    onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Location (optional)</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Where's it happening?"
                />
              </div>
              <div className="field">
                <label>RSVP</label>
                <select value={form.rsvp} onChange={(e) => setForm({ ...form, rsvp: e.target.value })}>
                  {RSVP_OPTIONS.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="What to wear, what to bring, who's going…"
                />
              </div>
              <div className="modal-actions">
                <div>
                  {editingId && (
                    <button type="button" className="btn-delete" onClick={handleDelete} disabled={saving}>
                      Delete
                    </button>
                  )}
                </div>
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
