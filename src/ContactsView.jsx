import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import ConfirmSheet from './ConfirmSheet'
import ImportBirthdaysModal from './ImportBirthdaysModal'
import WishSheet from './WishSheet'
import { formatMoney } from './lib/currency'
import { getCurrency } from './lib/localPrefs'
import {
  MONTH_NAMES, DAY_NAMES, CHIP_COLORS, parseLocalDate, formatMonthDay, todayIso, startOfToday,
  nextBirthday, giftNeeded, inDays, missingColumnHint, isIsoDate,
} from './lib/social'

const ICON_OPTIONS = ['🎂', '🎈', '🎁', '✨', '👑', '💐', '🦋', '🌸', '☕', '🍾', '💌', '🧁']

const RELATIONSHIPS = [
  { key: 'family', label: '👪 Family' },
  { key: 'friends', label: '👯 Friends' },
  { key: 'work', label: '💼 Work' },
  { key: 'partner', label: '💖 Partner' },
]

const FILTERS = [
  { key: 'this_month', label: 'This month' },
  { key: 'next_30', label: 'Next 30 days' },
  { key: 'next_90', label: 'Next 90 days' },
  { key: 'gift_needed', label: 'Gift needed' },
  { key: 'gift_purchased', label: 'Gift purchased' },
  { key: 'family', label: '👪 Family' },
  { key: 'friends', label: '👯 Friends' },
  { key: 'work', label: '💼 Work' },
  { key: 'partner', label: '💖 Partner' },
]

function relationshipLabel(key) {
  if (!key) return null
  return RELATIONSHIPS.find((r) => r.key === key)?.label || `💫 ${key}`
}

function giftStatus(c) {
  if (c.no_gift) return { icon: '✅', text: 'Ready to celebrate', tone: 'ready' }
  if (c.gift_purchased) return { icon: '🛍️', text: 'Gift purchased', tone: 'purchased' }
  return { icon: '🎁', text: 'Gift needed', tone: 'needed' }
}

const emptyForm = {
  name: '', icon: '🎂', birthday: '', birth_year: '', relationship: '', phone: '',
  fave_flowers: '', fave_store: '', coffee_order: '', gift_ideas: '', gift_notes: '', gift_price: '', gift_link: '',
  gift_purchased: false, no_gift: false,
}

function ConfettiBurst() {
  const pieces = useMemo(() => {
    const colors = ['var(--lavender)', 'var(--accent-deep)', '#F6D0C8', 'var(--accent-mid)', '#EC9A8C']
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

export default function ContactsView({ focus = null, onFocusDone }) {
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
  const [archived, setArchived] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [ask, setAsk] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [notice, setNotice] = useState(null)

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

    if (error) setError(missingColumnHint(error.message))
    else {
      setContacts((data || []).filter((c) => !c.archived && c.name && isIsoDate(c.birthday)))
      setArchived((data || []).filter((c) => c.archived))
    }
    setLoading(false)
  }

  function openAdd(prefillDate) {
    setEditingId(null)
    setForm({ ...emptyForm, birthday: prefillDate || todayIso() })
    setProfileMode(false)
    setModalOpen(true)
  }

  function openProfile(contact) {
    populateForm(contact)
    loadHistory(contact.id)
    setProfileMode(true)
    setModalOpen(true)
  }

  function populateForm(contact) {
    setEditingId(contact.id)
    setForm({
      name: contact.name || '',
      icon: contact.icon || '🎂',
      birthday: contact.birthday || '',
      birth_year: contact.birth_year ? String(contact.birth_year) : '',
      relationship: contact.relationship || '',
      phone: contact.phone || '',
      fave_flowers: contact.fave_flowers || '',
      fave_store: contact.fave_store || '',
      coffee_order: contact.coffee_order || '',
      gift_ideas: contact.gift_ideas || '',
      gift_notes: contact.gift_notes || '',
      gift_price: contact.gift_price != null ? String(contact.gift_price) : '',
      gift_link: contact.gift_link || '',
      gift_purchased: !!contact.gift_purchased,
      no_gift: !!contact.no_gift,
    })
  }

  // Jump straight into add/profile from the All tab
  useEffect(() => {
    if (!focus || loading) return
    if (focus.import) setImportOpen(true)
    else if (focus.add) openAdd(focus.date)
    else if (focus.id) { const c = contacts.find((x) => x.id === focus.id); if (c) openProfile(c) }
    onFocusDone?.()
  }, [focus, loading]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // birth_year is only sent when used, so saving still works before the v2 SQL has been run
    const prevC = editingId ? contacts.find((x) => x.id === editingId) : null
    // v3 gift fields are only sent when used, so saving still works before the v3 SQL has been run
    if (form.gift_price || prevC?.gift_price != null) payload.gift_price = form.gift_price ? Number(form.gift_price) : null
    if (form.gift_link.trim() || prevC?.gift_link) payload.gift_link = form.gift_link.trim() || null
    if (form.birth_year || prevC?.birth_year) payload.birth_year = form.birth_year ? Number(form.birth_year) : null

    let error
    if (editingId) {
      ;({ error } = await supabase.from('contacts').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('contacts').insert({ ...payload, user_id }))
    }

    setSaving(false)
    if (error) {
      setError(missingColumnHint(error.message))
      return
    }
    closeModal()
    fetchContacts()
  }

  async function handleDelete() {
    if (!editingId) return
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
    const next = !contact.gift_purchased
    const patch = { gift_purchased: next }
    if ('gift_purchased_at' in contact) patch.gift_purchased_at = next ? todayIso() : null
    const { error } = await supabase.from('contacts').update(patch).eq('id', contact.id)
    if (error) { setError(error.message); return }
    fetchContacts()
  }

  // ---- gift history + shopping list + wishes
  const [history, setHistory] = useState([])
  const [histForm, setHistForm] = useState({ year: String(new Date().getFullYear()), gift: '', price: '' })
  const [wishFor, setWishFor] = useState(null)
  const [shopMsg, setShopMsg] = useState(null)

  async function loadHistory(id) {
    const { data, error } = await supabase.from('gift_history').select('*').eq('contact_id', String(id)).order('year', { ascending: false })
    if (error) { setHistory([]); if (!/gift_history|relation|schema cache/i.test(error.message)) setError(error.message); return }
    setHistory(data || [])
  }

  async function addHistory() {
    if (!histForm.gift.trim() || !editingId) return
    const user_id = await getUserId()
    const { error } = await supabase.from('gift_history').insert({
      contact_id: String(editingId), year: Number(histForm.year) || new Date().getFullYear(),
      gift: histForm.gift.trim(), price: histForm.price ? Number(histForm.price) : null, user_id,
    })
    if (error) { setError(missingColumnHint(error.message) + (/relation|gift_history/i.test(error.message) ? ' — run social-calendar-v3.sql in Supabase.' : '')); return }
    setHistForm((f) => ({ ...f, gift: '', price: '' }))
    loadHistory(editingId)
  }

  async function removeHistory(id) {
    const { error } = await supabase.from('gift_history').delete().eq('id', id)
    if (error) { setError(error.message); return }
    loadHistory(editingId)
  }

  async function addToShopping(c) {
    const user_id = await getUserId()
    const idea = (c.gift_ideas || '').split('\n')[0].trim()
    const { error } = await supabase.from('shopping_items').insert({
      text: `🎁 ${idea || 'Gift'} for ${c.name.split(' ')[0]}`, category: 'planned', price: c.gift_price != null ? Number(c.gift_price) : null, user_id,
    })
    if (error) { setError(error.message); return }
    setShopMsg(`Added to your shopping list ✅`)
    setTimeout(() => setShopMsg(null), 3000)
  }

  async function archiveContact(contact, e) {
    e?.stopPropagation()
    const { error } = await supabase.from('contacts').update({ archived: true }).eq('id', contact.id)
    if (error) { setError(error.message); return }
    fetchContacts()
  }

  async function restoreContact(contact) {
    const { error } = await supabase.from('contacts').update({ archived: false }).eq('id', contact.id)
    if (error) { setError(error.message); return }
    fetchContacts()
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
  const today = startOfToday()
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
    return contacts.map((c) => nextBirthday(c, today)).sort((a, b) => a.nextDate - b.nextDate)
  }, [contacts]) // eslint-disable-line react-hooks/exhaustive-deps

  const giftSpend = useMemo(() => {
    const y = new Date().getFullYear()
    let spent = 0, planned = 0
    for (const c of contacts) {
      const price = Number(c.gift_price) || 0
      if (!price || c.no_gift) continue
      if (c.gift_purchased) { if (!c.gift_purchased_at || Number(String(c.gift_purchased_at).slice(0, 4)) === y) spent += price } else planned += price
    }
    return { spent, planned }
  }, [contacts])

  const todays = upcoming.filter((c) => c.daysAway === 0)
  const giftNudge = upcoming.filter((c) => c.daysAway > 0 && c.daysAway <= 14 && giftNeeded(c))

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
    const giftsRemaining = contacts.filter((c) => !c.gift_purchased && !c.no_gift).length
    const giftsPlanned = contacts.filter((c) => c.gift_purchased || (c.gift_ideas && c.gift_ideas.trim())).length
    return { total: contacts.length, giftsPlanned, giftsRemaining, nextDays: upcoming.length ? upcoming[0].daysAway : null }
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
      openAdd(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }

  return (
    <div>
      <div className="sc-actionbar">
        {contacts.length > 0 && (
          <input className="search-box cake-search-input" placeholder="🔍 Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
        {contacts.length > 0 && (
          <button className={`sc-filter-btn ${showFilters || activeFilter ? 'on' : ''}`} onClick={() => setShowFilters((v) => !v)}>
            ⚙ Filter{activeFilter ? ' · 1' : ''}
          </button>
        )}
      </div>

      {loading && <p className="loading">Fetching birthdays… 🎂✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
          {todays.map((c) => (
            <div className="sc-banner sc-banner-today" key={c.id}>
              <span>🎉 It's {c.name}'s birthday today{c.turning ? ` — turning ${c.turning}` : ''}!</span>
              <button className="sc-chip-btn" onClick={() => setWishFor(c)}>💬 Send a wish</button>
            </div>
          ))}
          {giftNudge.length > 0 && (
            <div className="sc-banner sc-banner-gift">
              <span>🎁 Gift needed soon: {giftNudge.slice(0, 3).map((c) => `${c.name} (${inDays(c.daysAway)})`).join(', ')}{giftNudge.length > 3 ? ` +${giftNudge.length - 3} more` : ''}</span>
              <button className="sc-chip-btn" onClick={() => setActiveFilter('gift_needed')}>Show</button>
            </div>
          )}

          {contacts.length > 0 && (
            <p className="sc-summary">
              <b>{stats.total}</b> birthday{stats.total === 1 ? '' : 's'}
              <span> · </span><b>{stats.giftsRemaining}</b> gift{stats.giftsRemaining === 1 ? '' : 's'} to sort
              {stats.nextDays != null && <><span> · </span>next {inDays(stats.nextDays)}</>}
              {(giftSpend.spent > 0 || giftSpend.planned > 0) && (
                <><span> · </span>🎁 <b>{formatMoney(giftSpend.spent, getCurrency(), 0)}</b> spent{giftSpend.planned > 0 && <> · {formatMoney(giftSpend.planned, getCurrency(), 0)} planned</>}</>
              )}
            </p>
          )}

          {contacts.length > 0 && (showFilters || activeFilter) && (
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
              <p className="module-group-label">{dateFilter || search || activeFilter ? 'Results' : 'Up next'}</p>
              <div className="sc-stack">
                {upNext.map((c, i) => {
                  const color = CHIP_COLORS[i % CHIP_COLORS.length]
                  const status = giftStatus(c)
                  const actions = (
                    <span className="sc-card-actions">
                      <button className="sc-icon-btn" onClick={(e) => { e.stopPropagation(); setWishFor(c) }} aria-label={`Birthday wish for ${c.name}`} title="Birthday wish">💬</button>
                      {c.phone && <a className="sc-icon-btn" href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} aria-label={`Call ${c.name}`}>📞</a>}
                      {giftNeeded(c) && <button className="sc-icon-btn" onClick={(e) => toggleGiftPurchased(c, e)} aria-label="Mark gift purchased" title="Mark gift purchased">✅</button>}
                    </span>
                  )
                  if (c.daysAway > 0) {
                    return (
                      <div className="sc-row-card" key={c.id} onClick={() => openProfile(c)} style={{ borderLeftColor: color }}>
                        <CountdownRing daysAway={c.daysAway} color={color} size={38} />
                        <div className="sc-row-main">
                          <span className="sc-row-title">{c.icon || '🎂'} {c.name}</span>
                          <span className="sc-row-sub">{formatMonthDay(c.month, c.day)}{c.turning ? ` · turns ${c.turning}` : ''} · <span className={`sc-dot-${status.tone}`}>{status.text}</span></span>
                        </div>
                        {actions}
                      </div>
                    )
                  }
                  return (
                    <div className="contact-card upnext-card cake-card sc-card" key={c.id} onClick={() => openProfile(c)} style={{ borderTopColor: color }}>
                      <ConfettiBurst />
                      <div className="cake-card-top">
                        <div>
                          <h3 className="contact-name">{c.icon || '🎂'} {c.name}</h3>
                          <p className="habit-schedule">{formatMonthDay(c.month, c.day)}{c.turning ? ` · turns ${c.turning}` : ''}</p>
                          {c.relationship && <span className="cake-relationship-tag">{relationshipLabel(c.relationship)}</span>}
                        </div>
                        <CountdownRing daysAway={c.daysAway} color={color} size={48} />
                      </div>
                      <div className="sc-card-foot">
                        <span className={`cake-gift-status cake-gift-status-${status.tone}`}>{status.icon} {status.text}</span>
                        {actions}
                      </div>
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

          {archived.length > 0 && (
            <div className="upcoming-section">
              <button className="weather-location-link" onClick={() => setShowArchived((v) => !v)}>
                🗄️ Archived ({archived.length}) {showArchived ? '▲' : '▼'}
              </button>
              {showArchived && (
                <div className="upcoming-list">
                  {archived.map((c) => (
                    <div className="upcoming-row" key={c.id}>
                      <span className="upcoming-name">{c.icon || '🎂'} {c.name}</span>
                      <button className="sc-chip-btn" onClick={() => restoreContact(c)}>Restore</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {contacts.length === 0 && (
            <div className="empty-state">
              <h3>No cake emergencies this month. 🎂</h3>
              <p>Tap a date above, or tap the + button to get started, queen ✨</p>
            </div>
          )}
        </>
      )}

      {notice && <p className="sc-banner sc-banner-today">{notice}</p>}
      {importOpen && (
        <ImportBirthdaysModal
          existing={[...contacts, ...archived]}
          onClose={() => setImportOpen(false)}
          onDone={(n) => { setImportOpen(false); setNotice(`Imported ${n} birthday${n > 1 ? 's' : ''} 🎉`); setTimeout(() => setNotice(null), 4000); fetchContacts() }}
        />
      )}

      {wishFor && <WishSheet contact={wishFor} onClose={() => setWishFor(null)} />}

      {ask && (
        <ConfirmSheet
          title={ask.title} body={ask.body} confirmLabel={ask.label} danger
          onCancel={() => setAsk(null)}
          onConfirm={() => { const r = ask.run; setAsk(null); r() }}
        />
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
                <div className="sc-card-actions" style={{ marginTop: 8 }}>
                  <a className="sc-chip-btn" href={`sms:${form.phone}`}>💬 Text</a>
                  <a className="sc-chip-btn" href={`tel:${form.phone}`}>📞 Call</a>
                </div>
              ) : (
                <button className="weather-location-link" style={{ marginTop: 8 }} onClick={() => setProfileMode(false)}>
                  + Add a phone number to text them
                </button>
              )}
            </div>

            <div className="cake-profile-section">
              <p className="cake-section-heading">🛍️ Purchases</p>
              {(form.gift_price || form.gift_link) && (
                <p className="field-hint">
                  {form.gift_price && <>Budget {formatMoney(Number(form.gift_price), getCurrency(), 0)}</>}
                  {form.gift_price && form.gift_link && ' · '}
                  {form.gift_link && <a href={form.gift_link} target="_blank" rel="noreferrer">🔗 Gift link</a>}
                </p>
              )}
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
                  <button className="btn-check" style={{ marginTop: 8, marginLeft: 8 }} onClick={() => { const c = contacts.find((x) => x.id === editingId); if (c) addToShopping(c) }}>
                    🛒 Add to shopping list
                  </button>
                  {shopMsg && <p className="field-hint">{shopMsg}</p>}
                </>
              )}
            </div>

            <div className="cake-profile-section">
              <p className="cake-section-heading">📜 Gift history</p>
              {history.length === 0 && <p className="field-hint">What you gave each year, so you never repeat yourself.</p>}
              {history.map((h) => (
                <div className="goals-summary-row" key={h.id}>
                  <span className="goals-summary-label">{h.year}</span>
                  <span className="goals-summary-value">
                    {h.gift}{h.price != null ? ` · ${formatMoney(Number(h.price), getCurrency(), 0)}` : ''}
                    {' '}<button className="sc-icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} onClick={() => removeHistory(h.id)} aria-label="Remove">×</button>
                  </span>
                </div>
              ))}
              <div className="sc-check-row" style={{ marginTop: 8 }}>
                <input type="number" value={histForm.year} onChange={(e) => setHistForm({ ...histForm, year: e.target.value })} style={{ maxWidth: 80 }} aria-label="Year" />
                <input value={histForm.gift} onChange={(e) => setHistForm({ ...histForm, gift: e.target.value })} placeholder="What you gave" aria-label="Gift" />
                <input type="number" inputMode="decimal" value={histForm.price} onChange={(e) => setHistForm({ ...histForm, price: e.target.value })} placeholder="Price" style={{ maxWidth: 90 }} aria-label="Price" />
                <button className="sc-chip-btn" onClick={addHistory}>Add</button>
              </div>
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
              <p className="field-hint">Move them out of the list without deleting their info. Restore them any time from Archived.</p>
              <button
                type="button"
                className="btn-delete"
                style={{ marginTop: 8 }}
                onClick={() => { const c = contacts.find((x) => x.id === editingId); if (c) setAsk({ title: `Archive ${c.name}?`, body: 'They move out of the list. You can restore them any time from Archived.', label: 'Archive', run: () => { archiveContact(c); closeModal() } }) }}
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
                  <label>Birth year (optional)</label>
                  <input
                    type="number" inputMode="numeric" min="1900" max={new Date().getFullYear()}
                    value={form.birth_year}
                    onChange={(e) => setForm({ ...form, birth_year: e.target.value })}
                    placeholder="Shows their age"
                  />
                </div>
              </div>
              <div className="field-row">
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
                <label>Phone (optional, for text and call)</label>
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
                <span className="module-group-label">🔐 Gift vault</span>
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

              <div className="field-row">
                <div className="field">
                  <label>Gift budget / price</label>
                  <input type="number" inputMode="decimal" min="0" step="any" value={form.gift_price} onChange={(e) => setForm({ ...form, gift_price: e.target.value })} placeholder="e.g. 500" />
                </div>
                <div className="field">
                  <label>Gift link (optional)</label>
                  <input type="url" value={form.gift_link} onChange={(e) => setForm({ ...form, gift_link: e.target.value })} placeholder="https://…" />
                </div>
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
                    <button type="button" className="btn-delete" onClick={() => setAsk({ title: 'Delete this birthday?', body: 'This removes them completely.', label: 'Delete', run: handleDelete })} disabled={saving}>
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
