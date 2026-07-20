import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CHIP_COLORS = ['#B896C9', '#1E5C57', '#1E5C57', '#1E5C57']
const ICON_OPTIONS = ['🎂', '🎈', '🎁', '✨', '👑', '💐', '🦋', '🌸', '☕', '🍾', '💌', '🧁']

const RELATIONSHIPS = [
  { key: 'family', label: '👪 Family' },
  { key: 'friends', label: '👯 Friends' },
  { key: 'work', label: '💼 Work' },
  { key: 'partner', label: '💖 Partner' },
]

const FILTERS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'next_30', label: 'Next 30 Days' },
  { key: 'next_90', label: 'Next 90 Days' },
  { key: 'gift_needed', label: 'Gift Needed' },
  { key: 'gift_purchased', label: 'Gift Purchased' },
  { key: 'family', label: '👪 Family' },
  { key: 'friends', label: '👯 Friends' },
  { key: 'work', label: '💼 Work' },
  { key: 'partner', label: '💖 Partner' },
]

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function formatMonthDay(month, day) {
  return `${MONTH_NAMES[month].slice(0, 3)} ${day}`
}

function relationshipLabel(key) {
  if (!key) return null
  return RELATIONSHIPS.find((r) => r.key === key)?.label || `💫 ${key}`
}

function giftStatus(c) {
  if (c.no_gift) return { icon: '✅', text: 'Ready to Celebrate', tone: 'ready' }
  if (c.gift_purchased) return { icon: '🛍️', text: 'Gift Purchased', tone: 'purchased' }
  return { icon: '🎁', text: 'Gift Needed', tone: 'needed' }
}

const emptyForm = {
  name: '', icon: '🎂', birthday: '', relationship: '', phone: '',
  fave_flowers: '', fave_store: '', coffee_order: '', gift_ideas: '', gift_notes: '',
  gift_purchased: false, no_gift: false,
}

function ConfettiBurst() {
  const pieces = useMemo(() => {
    const colors = ['#B896C9', '#1E5C57', '#E4CBA0', '#8FC2BE', '#D9A8B8']
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: Math.round(Math.random() * 100),
      delay: Math.random() * 0.15,
      rotate: Math.round(Math.random() * 360),
    }))
  }, [])
  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function CountdownRing({ daysAway, color, size = 56 }) {
  const pct = Math.max(0, Math.min(100, 100 - (daysAway / 365) * 100))
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  return (
    <div className="countdown-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="countdown-ring-fill"
        />
      </svg>
      <div className="countdown-ring-label">
        {daysAway === 0 ? (
          <span className="countdown-ring-today">🎉</span>
        ) : (
          <>
            <span className="countdown-ring-num">{daysAway}</span>
            <span className="countdown-ring-unit">d</span>
          </>
        )}
      </div>
    </div>
  )
}

export default function ContactsView() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [profileMode, setProfileMode] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState(null)
  const [dateFilter, setDateFilter] = useState(null)
  const [hoveredDay, setHoveredDay] = useState(null)
  const calendarRef = useRef(null)

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
    else setContacts((data || []).filter((c) => !c.archived))
    setLoading(false)
  }

  function openAdd(prefillDate) {
    setEditingId(null)
    setForm({ ...emptyForm, birthday: prefillDate || new Date().toISOString().split('T')[0] })
    setProfileMode(false)
    setModalOpen(true)
  }

  function openProfile(contact) {
    populateForm(contact)
    setProfileMode(true)
    setModalOpen(true)
  }

  function openEdit(contact) {
    populateForm(contact)
    setProfileMode(false)
    setModalOpen(true)
  }

  function populateForm(contact) {
    setEditingId(contact.id)
    setForm({
      name: contact.name || '',
      icon: contact.icon || '🎂',
      birthday: contact.birthday || '',
      relationship: contact.relationship || '',
      phone: contact.phone || '',
      fave_flowers: contact.fave_flowers || '',
      fave_store: contact.fave_store || '',
      coffee_order: contact.coffee_order || '',
      gift_ideas: contact.gift_ideas || '',
      gift_notes: contact.gift_notes || '',
      gift_purchased: !!contact.gift_purchased,
      no_gift: !!contact.no_gift,
    })
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
      relationship: form.relationship.trim() || null,
      phone: form.phone.trim() || null,
      fave_flowers: form.fave_flowers.trim() || null,
      fave_store: form.fave_store.trim() || null,
      coffee_order: form.coffee_order.trim() || null,
      gift_ideas: form.gift_ideas.trim() || null,
      gift_notes: form.gift_notes.trim() || null,
      gift_purchased: form.gift_purchased,
      no_gift: form.no_gift,
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

  async function toggleGiftPurchased(contact, e) {
    e?.stopPropagation()
    const { error } = await supabase.from('contacts').update({ gift_purchased: !contact.gift_purchased }).eq('id', contact.id)
    if (error) { setError(error.message); return }
    fetchContacts()
  }

  async function archiveContact(contact, e) {
    e?.stopPropagation()
    if (!confirm(`Archive ${contact.name}? You can always re-add them later.`)) return
    const { error } = await supabase.from('contacts').update({ archived: true }).eq('id', contact.id)
    if (error) { setError(error.message); return }
    fetchContacts()
  }

  function sendMessage(contact, e) {
    e?.stopPropagation()
    if (!contact.phone) {
      alert(`No phone number saved for ${contact.name} yet — add one and you'll be able to text them straight from here. Opening their details now.`)
      openEdit(contact)
      return
    }
    window.location.href = `sms:${contact.phone}`
  }

  function jumpToDate(targetMonth, targetDay) {
    setViewDate(new Date(year, targetMonth, 1))
    setDateFilter({ month: targetMonth, day: targetDay })
    setTimeout(() => {
      calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isCurrentMonthView = today.getFullYear() === year && today.getMonth() === month

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

  const filtered = useMemo(() => {
    let list = upcoming
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }
    if (dateFilter != null) {
      list = list.filter((c) => c.month === dateFilter.month && c.day === dateFilter.day)
    }
    if (activeFilter === 'this_month') list = list.filter((c) => c.daysAway <= 31 && c.nextDate.getMonth() === today.getMonth())
    else if (activeFilter === 'next_30') list = list.filter((c) => c.daysAway <= 30)
    else if (activeFilter === 'next_90') list = list.filter((c) => c.daysAway <= 90)
    else if (activeFilter === 'gift_needed') list = list.filter((c) => !c.gift_purchased && !c.no_gift)
    else if (activeFilter === 'gift_purchased') list = list.filter((c) => c.gift_purchased)
    else if (['family', 'friends', 'work', 'partner'].includes(activeFilter)) list = list.filter((c) => c.relationship === activeFilter)
    return list
  }, [upcoming, search, activeFilter, dateFilter])

  const upNext = dateFilter || search || activeFilter ? filtered.slice(0, 6) : filtered.slice(0, 3)

  const stats = useMemo(() => {
    const giftsPlanned = contacts.filter((c) => c.gift_ideas).length
    const giftsRemaining = contacts.filter((c) => !c.gift_purchased && !c.no_gift).length
    const next = upcoming[0]
    return {
      total: contacts.length,
      giftsPlanned,
      giftsRemaining,
      nextDays: next ? next.daysAway : null,
    }
  }, [contacts, upcoming])

  function goToMonth(delta) {
    setViewDate(new Date(year, month + delta, 1))
    setDateFilter(null)
  }

  function handleDayClick(day) {
    if (!day) return
    if (birthdaysByDay[day]) {
      setDateFilter((prev) => (prev && prev.day === day && prev.month === month ? null : { month, day }))
    } else {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      openAdd(iso)
    }
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Cake Club</h1>
          <p className="view-subtitle cake-club-subtitle">Because panic-buying gifts isn't a personality trait. 🎁</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={() => openAdd()}>+ Add birthday</button>
        </div>
      </div>

      {loading && <p className="loading">Fetching cake days… 🎂✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
          {contacts.length > 0 && (
            <div className="cake-stats-row">
              <div className="cake-stat-card">
                <span className="cake-stat-icon">🎂</span>
                <span className="cake-stat-value">{stats.total}</span>
                <span className="cake-stat-label">Birthdays</span>
              </div>
              <div className="cake-stat-card">
                <span className="cake-stat-icon">🎁</span>
                <span className="cake-stat-value">{stats.giftsPlanned}</span>
                <span className="cake-stat-label">Gifts Planned</span>
              </div>
              <div className="cake-stat-card">
                <span className="cake-stat-icon">🎉</span>
                <span className="cake-stat-value">{stats.nextDays != null ? `${stats.nextDays}d` : '—'}</span>
                <span className="cake-stat-label">Next Birthday</span>
              </div>
              <div className="cake-stat-card">
                <span className="cake-stat-icon">💌</span>
                <span className="cake-stat-value">{stats.giftsRemaining}</span>
                <span className="cake-stat-label">Gifts Remaining</span>
              </div>
            </div>
          )}

          {contacts.length > 0 && (
            <div className="cake-search-row">
              <input
                className="search-box cake-search-input"
                placeholder="🔍 Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {contacts.length > 0 && (
            <div className="filter-row">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`filter-pill ${activeFilter === f.key ? 'filter-pill-active' : ''}`}
                  onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {dateFilter && (
            <button className="weather-location-link cake-clear-filter" onClick={() => setDateFilter(null)}>
              📅 Showing {formatMonthDay(dateFilter.month, dateFilter.day)} only — tap to clear
            </button>
          )}

          {upNext.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">{dateFilter || search || activeFilter ? 'RESULTS' : 'UP NEXT'}</p>
              <div className="card-grid">
                {upNext.map((c, i) => {
                  const color = CHIP_COLORS[i % CHIP_COLORS.length]
                  const status = giftStatus(c)
                  return (
                    <div
                      className="contact-card upnext-card cake-card"
                      key={c.id}
                      onClick={() => openProfile(c)}
                      style={{ borderTopColor: color }}
                    >
                      {c.daysAway === 0 && <ConfettiBurst />}
                      <div className="cake-card-top">
                        <div>
                          <h3 className="contact-name">{c.icon || '🎂'} {c.name}</h3>
                          <p className="habit-schedule">{formatMonthDay(c.month, c.day)}</p>
                          {c.relationship && <span className="cake-relationship-tag">{relationshipLabel(c.relationship)}</span>}
                        </div>
                        <CountdownRing daysAway={c.daysAway} color={color} />
                      </div>
                      <span className={`cake-gift-status cake-gift-status-${status.tone}`}>{status.icon} {status.text}</span>
                      <button className="cake-view-profile-btn" onClick={(e) => { e.stopPropagation(); openProfile(c) }}>
                        💌 View Profile →
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {upNext.length === 0 && (search || activeFilter || dateFilter) && (
            <div className="empty-state">
              <h3>No matches, bestie ✨</h3>
              <p>Try a different search or clear your filters.</p>
            </div>
          )}

          <div className="calendar-card" ref={calendarRef}>
            <div className="calendar-nav">
              <button className="cal-nav-btn" onClick={() => goToMonth(-1)}>‹</button>
              <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
              <button className="cal-nav-btn" onClick={() => goToMonth(1)}>›</button>
            </div>
            <div className="calendar-grid">
              {DAY_NAMES.map((d) => (
                <div key={d} className="cal-day-name">{d}</div>
              ))}
              {cells.map((day, i) => {
                const isToday = isCurrentMonthView && day === today.getDate()
                const hasBirthdays = day && birthdaysByDay[day]
                const isSelected = dateFilter && dateFilter.month === month && dateFilter.day === day
                return (
                  <div
                    key={i}
                    className={`cal-cell ${day ? 'cal-cell-active' : 'cal-cell-empty'} ${isToday ? 'cal-cell-today' : ''} ${isSelected ? 'cal-cell-selected' : ''}`}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => day && hasBirthdays && setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    {day && <span className="cal-day-num">{day}</span>}
                    {hasBirthdays && (
                      <div className="cal-chip-stack">
                        {birthdaysByDay[day].slice(0, 2).map((c, ci) => (
                          <span
                            key={c.id}
                            className="cal-chip"
                            style={{ background: CHIP_COLORS[ci % CHIP_COLORS.length] }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openProfile(c)
                            }}
                          >
                            {c.icon || '🎂'} {c.name}
                          </span>
                        ))}
                        {birthdaysByDay[day].length > 2 && (
                          <span className="cal-chip cal-chip-more">+{birthdaysByDay[day].length - 2} more</span>
                        )}
                      </div>
                    )}
                    {hoveredDay === day && hasBirthdays && (
                      <div className="cal-tooltip">
                        {birthdaysByDay[day].map((c) => (
                          <div key={c.id}>{c.icon || '🎂'} {c.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {upcoming.length > 0 && !dateFilter && !search && !activeFilter && (
            <div className="upcoming-section">
              <p className="module-group-label">UPCOMING</p>
              <div className="upcoming-list">
                {upcoming.slice(0, 8).map((c, i) => (
                  <div
                    className="upcoming-row"
                    key={c.id}
                    onClick={() => openProfile(c)}
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

      {modalOpen && profileMode && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal cake-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cake-profile-header">
              <span className="cake-profile-icon">{form.icon}</span>
              <h2>{form.name}</h2>
              {form.relationship && <span className="cake-relationship-tag">{relationshipLabel(form.relationship)}</span>}
            </div>

            <button className="btn-check cake-profile-edit-btn" onClick={() => setProfileMode(false)}>✏️ Edit Details</button>

            <div className="cake-profile-section">
              <p className="cake-section-heading">🎁 Gift Vault</p>
              {(form.fave_flowers || form.fave_store || form.coffee_order || form.gift_ideas) ? (
                <>
                  {form.fave_flowers && <div className="goals-summary-row"><span className="goals-summary-label">💐 Flowers</span><span className="goals-summary-value">{form.fave_flowers}</span></div>}
                  {form.fave_store && <div className="goals-summary-row"><span className="goals-summary-label">🛍️ Store</span><span className="goals-summary-value">{form.fave_store}</span></div>}
                  {form.coffee_order && <div className="goals-summary-row"><span className="goals-summary-label">☕ Coffee</span><span className="goals-summary-value">{form.coffee_order}</span></div>}
                  {form.gift_ideas && <p className="brain-dump-content">{form.gift_ideas}</p>}
                </>
              ) : (
                <p className="field-hint">No gift ideas saved yet — tap Edit to add some. ✨</p>
              )}
            </div>

            <div className="cake-profile-section">
              <p className="cake-section-heading">💬 Notes</p>
              {form.gift_notes ? (
                <p className="brain-dump-content">{form.gift_notes}</p>
              ) : (
                <p className="field-hint">Gift hints, things they've mentioned, anything worth remembering.</p>
              )}
              {form.phone ? (
                <button className="weather-location-link" style={{ marginTop: 8 }} onClick={() => { window.location.href = `sms:${form.phone}` }}>
                  💬 Send a text
                </button>
              ) : (
                <button className="weather-location-link" style={{ marginTop: 8 }} onClick={() => setProfileMode(false)}>
                  + Add a phone number to text them
                </button>
              )}
            </div>

            <div className="cake-profile-section">
              <p className="cake-section-heading">🛍️ Purchases</p>
              {form.no_gift ? (
                <p className="cake-gift-status cake-gift-status-ready">✅ No gift needed</p>
              ) : (
                <>
                  <p className={`cake-gift-status ${form.gift_purchased ? 'cake-gift-status-purchased' : 'cake-gift-status-needed'}`}>
                    {form.gift_purchased ? '🛍️ Gift Purchased' : '🎁 Gift Needed'}
                  </p>
                  <button
                    className="btn-check"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      const c = contacts.find((x) => x.id === editingId)
                      if (c) toggleGiftPurchased(c)
                      setForm((f) => ({ ...f, gift_purchased: !f.gift_purchased }))
                    }}
                  >
                    {form.gift_purchased ? '↩️ Mark as not purchased' : '✅ Mark as purchased'}
                  </button>
                </>
              )}
            </div>

            <div className="cake-profile-section">
              <p className="cake-section-heading">📅 Important Dates</p>
              <div className="goals-summary-row">
                <span className="goals-summary-label">🎂 Birthday</span>
                <span className="goals-summary-value">
                  {form.birthday && `${MONTH_NAMES[parseLocalDate(form.birthday).month]} ${parseLocalDate(form.birthday).day}`}
                </span>
              </div>
              {form.birthday && (
                <button
                  className="weather-location-link"
                  style={{ marginTop: 6 }}
                  onClick={() => { const bd = parseLocalDate(form.birthday); closeModal(); jumpToDate(bd.month, bd.day) }}
                >
                  📅 View in Calendar
                </button>
              )}
            </div>

            <div className="cake-profile-section cake-profile-section-archive">
              <p className="cake-section-heading">🗃️ Archive</p>
              <p className="field-hint">Move them out of Cake Club without deleting their info. You can't undo this from here.</p>
              <button
                type="button"
                className="btn-delete"
                style={{ marginTop: 8 }}
                onClick={(e) => { const c = contacts.find((x) => x.id === editingId); if (c) archiveContact(c, e); closeModal() }}
              >
                🗄️ Archive this person
              </button>
            </div>

            <div className="modal-actions">
              <div />
              <div className="modal-actions-right">
                <button type="button" className="btn-cancel" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && !profileMode && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal gift-vault-modal" onClick={(e) => e.stopPropagation()}>
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

              <div className="field-row">
                <div className="field">
                  <label>Birthday</label>
                  <input
                    type="date"
                    value={form.birthday}
                    onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Relationship</label>
                  <select
                    value={RELATIONSHIPS.some((r) => r.key === form.relationship) || form.relationship === '' ? form.relationship : 'custom'}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value === 'custom' ? ' ' : e.target.value })}
                  >
                    <option value="">Select…</option>
                    {RELATIONSHIPS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    <option value="custom">✏️ Other…</option>
                  </select>
                  {!RELATIONSHIPS.some((r) => r.key === form.relationship) && form.relationship !== '' && (
                    <input
                      style={{ marginTop: 8 }}
                      value={form.relationship.trim()}
                      onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                      placeholder="e.g. Cousin, Neighbor, Bestie…"
                      autoFocus
                    />
                  )}
                </div>
              </div>

              <div className="field">
                <label>Phone (optional, for Send Message)</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 555 123 4567"
                />
              </div>

              <label className="savings-toggle-label">
                <input
                  type="checkbox"
                  checked={form.no_gift}
                  onChange={(e) => setForm({ ...form, no_gift: e.target.checked, gift_purchased: e.target.checked ? false : form.gift_purchased })}
                />
                {' '}🚫 No gift needed for this person
              </label>

              {!form.no_gift && (
                <label className="savings-toggle-label">
                  <input
                    type="checkbox"
                    checked={form.gift_purchased}
                    onChange={(e) => setForm({ ...form, gift_purchased: e.target.checked })}
                  />
                  {' '}✅ Gift already purchased
                </label>
              )}

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
                  <button type="button" className="btn-cancel" onClick={() => (editingId ? setProfileMode(true) : closeModal())}>
                    {editingId ? 'Back' : 'Cancel'}
                  </button>
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
