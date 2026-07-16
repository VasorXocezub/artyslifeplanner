import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CHIP_COLORS = ['#EE93BE', '#B49BD9', '#7FAEDB', '#92CDBB']

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function formatMonthDay(month, day) {
  return `${MONTH_NAMES[month].slice(0, 3)} ${day}`
}

export default function ContactsView() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', birthday: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, birthday')
      .not('birthday', 'is', null)
      .order('name', { ascending: true })

    if (error) setError(error.message)
    else setContacts(data)
    setLoading(false)
  }

  function openAdd(prefillDate) {
    setEditingId(null)
    setForm({ name: '', birthday: prefillDate || new Date().toISOString().split('T')[0] })
    setModalOpen(true)
  }

  function openEdit(contact) {
    setEditingId(contact.id)
    setForm({ name: contact.name || '', birthday: contact.birthday || '' })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm({ name: '', birthday: '' })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.birthday) return
    setSaving(true)

    const payload = { name: form.name.trim(), birthday: form.birthday }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('contacts').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('contacts').insert(payload))
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchContacts()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Remove this birthday?')) return
    setSaving(true)
    const { error } = await supabase.from('contacts').delete().eq('id', editingId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    closeModal()
    fetchContacts()
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const birthdaysByDay = useMemo(() => {
    const map = {}
    for (const c of contacts) {
      if (!c.birthday) continue
      const bd = parseLocalDate(c.birthday)
      if (bd.month !== month) continue
      if (!map[bd.day]) map[bd.day] = []
      map[bd.day].push(c)
    }
    return map
  }, [contacts, month])

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
    return contacts
      .map((c) => {
        const bd = parseLocalDate(c.birthday)
        let next = new Date(today.getFullYear(), bd.month, bd.day)
        if (next < today) next = new Date(today.getFullYear() + 1, bd.month, bd.day)
        const days = Math.round((next - today) / (1000 * 60 * 60 * 24))
        return { ...c, nextDate: next, daysAway: days, month: bd.month, day: bd.day }
      })
      .sort((a, b) => a.nextDate - b.nextDate)
  }, [contacts])

  function goToMonth(delta) {
    setViewDate(new Date(year, month + delta, 1))
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Birthdays</h1>
          <p className="view-subtitle">
            {contacts.length === 0 ? 'Not a single candle lit yet' : `${contacts.length} ${contacts.length === 1 ? 'cake day' : 'cake days'} on the books`}
          </p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={() => openAdd()}>+ Add birthday</button>
        </div>
      </div>

      {loading && <p className="loading">Fetching cake days… 🎂</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
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
                  {day && birthdaysByDay[day] && (
                    <div className="cal-chip-stack">
                      {birthdaysByDay[day].map((c, ci) => (
                        <span
                          key={c.id}
                          className="cal-chip"
                          style={{ background: CHIP_COLORS[ci % CHIP_COLORS.length] }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(c)
                          }}
                        >
                          🎂 {c.name}
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
              <p className="module-group-label">UPCOMING</p>
              <div className="upcoming-list">
                {upcoming.slice(0, 8).map((c, i) => (
                  <div
                    className="upcoming-row"
                    key={c.id}
                    onClick={() => openEdit(c)}
                    style={{ borderLeftColor: CHIP_COLORS[i % CHIP_COLORS.length] }}
                  >
                    <span className="upcoming-name">{c.name}</span>
                    <span className="upcoming-date">
                      {formatMonthDay(c.month, c.day)} · {c.daysAway === 0 ? 'today' : `in ${c.daysAway}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contacts.length === 0 && (
            <div className="empty-state">
              <h3>No cakes on the calendar yet 🎂</h3>
              <p>Tap a date above, or hit "+ Add birthday" to get started.</p>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit birthday' : 'New birthday'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Name</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="field">
                <label>Birthday</label>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                  required
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
