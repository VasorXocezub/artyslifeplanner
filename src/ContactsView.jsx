import { useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CHIP_COLORS = ['#B896C9', '#1E5C57', '#1E5C57', '#1E5C57']
const ICON_OPTIONS = ['🎂', '🎈', '🎁', '✨', '👑', '💐', '🦋', '🌸', '☕', '🍾', '💌', '🧁']

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function formatMonthDay(month, day) {
  return `${MONTH_NAMES[month].slice(0, 3)} ${day}`
}

const emptyForm = {
  name: '', icon: '🎂', birthday: '',
  fave_flowers: '', fave_store: '', coffee_order: '', gift_ideas: '', gift_notes: '',
}

export default function ContactsView() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .not('birthday', 'is', null)
      .order('name', { ascending: true })

    if (error) setError(error.message)
    else setContacts(data)
    setLoading(false)
  }

  function openAdd(prefillDate) {
    setEditingId(null)
    setForm({ ...emptyForm, birthday: prefillDate || new Date().toISOString().split('T')[0] })
    setModalOpen(true)
  }

  function openEdit(contact) {
    setEditingId(contact.id)
    setForm({
      name: contact.name || '',
      icon: contact.icon || '🎂',
      birthday: contact.birthday || '',
      fave_flowers: contact.fave_flowers || '',
      fave_store: contact.fave_store || '',
      coffee_order: contact.coffee_order || '',
      gift_ideas: contact.gift_ideas || '',
      gift_notes: contact.gift_notes || '',
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
    if (!form.name.trim() || !form.birthday) return
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      icon: form.icon || '🎂',
      birthday: form.birthday,
      fave_flowers: form.fave_flowers.trim() || null,
      fave_store: form.fave_store.trim() || null,
      coffee_order: form.coffee_order.trim() || null,
      gift_ideas: form.gift_ideas.trim() || null,
      gift_notes: form.gift_notes.trim() || null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('contacts').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('contacts').insert({ ...payload, user_id }))
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
    if (!confirm('Remove this from the Cake Club?')) return
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

  const upNext = upcoming.slice(0, 3)

  function goToMonth(delta) {
    setViewDate(new Date(year, month + delta, 1))
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Cake Club</h1>
          <p className="view-subtitle cake-club-subtitle">It's giving thoughtful queen. ✨</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={() => openAdd()}>+ Add birthday</button>
        </div>
      </div>

      {loading && <p className="loading">Fetching cake days… 🎂✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
          {upNext.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">UP NEXT</p>
              <div className="card-grid">
                {upNext.map((c, i) => (
                  <div
                    className="contact-card upnext-card"
                    key={c.id}
                    onClick={() => openEdit(c)}
                    style={{ borderTopColor: CHIP_COLORS[i % CHIP_COLORS.length] }}
                  >
                    <h3 className="contact-name">{c.icon || '🎂'} {c.name}</h3>
                    <p className="habit-schedule">
                      {formatMonthDay(c.month, c.day)} · {c.daysAway === 0 ? 'today!' : `in ${c.daysAway}d`}
                    </p>
                    <span className="module-link" style={{ color: CHIP_COLORS[i % CHIP_COLORS.length] }}>
                      Open Gift Vault →
                    </span>
                  </div>
                ))}
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
                          {c.icon || '🎂'} {c.name}
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
                    <span className="upcoming-name">{c.icon || '🎂'} {c.name}</span>
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
              <h3>No cake emergencies this month. 🎂</h3>
              <p>Tap a date above, or hit "+ Add birthday" to get started, queen ✨</p>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal gift-vault-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Gift Vault' : 'New birthday'}</h2>
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
                <label>Icon</label>
                <div className="icon-picker">
                  <span className="icon-preview">{form.icon || '🎂'}</span>
                  <input
                    className="icon-custom-input"
                    value={form.icon}
                    maxLength={4}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="Paste any emoji"
                  />
                </div>
                <div className="icon-grid">
                  {ICON_OPTIONS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      className={`icon-cell ${form.icon === emoji ? 'icon-cell-active' : ''}`}
                      onClick={() => setForm({ ...form, icon: emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
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

              <div className="gift-vault-divider">
                <span className="module-group-label">🔐 GIFT VAULT</span>
                <p className="field-hint">Their favorites, so you're always ready.</p>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Fave flowers</label>
                  <input
                    value={form.fave_flowers}
                    onChange={(e) => setForm({ ...form, fave_flowers: e.target.value })}
                    placeholder="Peonies, sunflowers…"
                  />
                </div>
                <div className="field">
                  <label>Fave store</label>
                  <input
                    value={form.fave_store}
                    onChange={(e) => setForm({ ...form, fave_store: e.target.value })}
                    placeholder="Zara, Sephora…"
                  />
                </div>
              </div>

              <div className="field">
                <label>Coffee order</label>
                <input
                  value={form.coffee_order}
                  onChange={(e) => setForm({ ...form, coffee_order: e.target.value })}
                  placeholder="Oat milk cappuccino, extra hot…"
                />
              </div>

              <div className="field">
                <label>Gift ideas</label>
                <textarea
                  value={form.gift_ideas}
                  onChange={(e) => setForm({ ...form, gift_ideas: e.target.value })}
                  placeholder="Things they've mentioned wanting…"
                />
              </div>

              <div className="field">
                <label>Other notes</label>
                <textarea
                  value={form.gift_notes}
                  onChange={(e) => setForm({ ...form, gift_notes: e.target.value })}
                  placeholder="Anything else worth remembering…"
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
