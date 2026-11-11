import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import ConfirmSheet from './ConfirmSheet'
import UndoBar from './UndoBar'
import { parseQuickPlan } from './lib/quickAdd'
import {
  MONTH_NAMES, DAY_NAMES, CHIP_COLORS, RECURRENCE, parseLocalDate, formatMonthDay, formatTime,
  todayIso, toIso, startOfToday, makeCustomType, parseCustomType, planItem, planOccursOn, inDays, missingColumnHint, isIsoDate,
} from './lib/social'

const EVENT_TYPES = [
  { key: 'holiday_magic', label: '🎄 Holiday Magic' },
  { key: 'bestie_time', label: '👯 Bestie Time' },
  { key: 'date_night', label: '💖 Date Night' },
  { key: 'girls_night', label: '🥂 Girls\' Night' },
  { key: 'family_time', label: '🌸 Family Time' },
  { key: 'cozy_gathering', label: '🍓 Cozy Gathering' },
  { key: 'treat_yourself', label: '🛍️ Treat Yourself' },
  { key: 'adventure', label: '✈️ Adventure' },
  { key: 'ceo_era', label: '💼 CEO Era' },
  { key: 'appointment', label: '🩺 Appointment' },
  { key: 'growth_moment', label: '🎓 Growth Moment' },
  { key: 'main_character', label: '✨ Main Character Moment' },
  { key: 'reminder', label: '📝 Reminder' },
]

const HOLIDAY_SUBCATEGORIES = [
  { key: 'christmas', label: '🎄 Christmas' },
  { key: 'nye', label: '🎆 New Year\'s Eve' },
  { key: 'easter', label: '🐣 Easter' },
  { key: 'halloween', label: '🎃 Halloween' },
  { key: 'valentines', label: '💘 Valentine\'s Day' },
  { key: 'thanksgiving', label: '🦃 Thanksgiving' },
  { key: 'other_holiday', label: '✨ Other Holiday' },
]

const RSVP_OPTIONS = [
  { key: 'going', label: '✅ Going' },
  { key: 'maybe', label: '🤔 Maybe' },
  { key: 'cant', label: '❌ Can\'t Make It' },
]


const EMOJI_SUGGEST = ['🍕', '💅', '🎬', '🏃‍♀️', '🎮', '🧘', '🛒', '🎤', '📚', '🐶', '🍷', '🎨']
const NEW_TYPE = '__new'

function eventTypeInfo(key) {
  const c = parseCustomType(key)
  if (c) return { key, label: `${c.emoji} ${c.label}` }
  return EVENT_TYPES.find((t) => t.key === key) || EVENT_TYPES[EVENT_TYPES.length - 1]
}
function rsvpInfo(key) {
  return RSVP_OPTIONS.find((r) => r.key === key) || RSVP_OPTIONS[0]
}
const RSVP_MARK = { going: '✅', maybe: '🤔', cant: '❌' }
const NO_RSVP_TYPES = ['holiday_magic', 'reminder', 'appointment', 'treat_yourself', 'ceo_era', 'growth_moment', 'main_character', 'adventure']
const RSVP_FILTERS = [{ key: 'going', label: '✅ Going' }, { key: 'maybe', label: '🤔 Maybe' }, { key: 'cant', label: '❌ Can\'t make it' }]

const emptyForm = {
  title: '', event_date: '', event_time: '', location: '', event_type: 'cozy_gathering', rsvp: 'going',
  notes: '', holiday_subcategory: '', custom_holiday: '', recurrence: '', status: 'planned', contact_ids: [], checklist: [],
}

export default function SocialCalendarView({ focus = null, onFocusDone }) {
  const [events, setEvents] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [highlightDate, setHighlightDate] = useState(null)
  const calendarRef = useRef(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [when, setWhen] = useState('upcoming') // upcoming | past
  const [rsvpFilter, setRsvpFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [ask, setAsk] = useState(null)
  const [dayPick, setDayPick] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [quick, setQuick] = useState('')
  const [quickNote, setQuickNote] = useState(null)
  const [typesOpen, setTypesOpen] = useState(false)
  const [undo, setUndo] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [typeEdits, setTypeEdits] = useState({})
  const [customEmoji, setCustomEmoji] = useState('✨')
  const [customName, setCustomName] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const [ev, ct] = await Promise.all([
      supabase.from('social_events').select('*').order('event_date', { ascending: true }),
      supabase.from('contacts').select('id, name, icon, archived'),
    ])
    if (ev.error) setError(ev.error.message)
    else setEvents((ev.data || []).filter((e) => e.title && isIsoDate(e.event_date)))
    setContacts((ct.data || []).filter((c) => !c.archived))
    setLoading(false)
  }

  function openAdd(prefillDate) {
    setEditingId(null)
    setForm({ ...emptyForm, event_date: prefillDate || todayIso() })
    setQuick('')
    setQuickNote(null)
    setCustomEmoji('✨')
    setCustomName('')
    setMoreOpen(false)
    setModalOpen(true)
  }

  function openEdit(event) {
    setEditingId(event.id)
    setCustomEmoji('✨')
    setCustomName('')
    const custom = event.holiday_subcategory && !HOLIDAY_SUBCATEGORIES.some((h) => h.key === event.holiday_subcategory)
    setForm({
      title: event.title || '',
      event_date: event.event_date || '',
      event_time: event.event_time || '',
      location: event.location || '',
      event_type: event.event_type || 'cozy_gathering',
      rsvp: event.rsvp || 'going',
      notes: event.notes || '',
      holiday_subcategory: custom ? 'other_holiday' : (event.holiday_subcategory || ''),
      custom_holiday: custom ? event.holiday_subcategory : '',
      recurrence: event.recurrence || '',
      status: event.status || 'planned',
      contact_ids: event.contact_ids || [],
      checklist: Array.isArray(event.checklist) ? event.checklist : [],
    })
    setModalOpen(true)
  }

  // Jump straight into an add/edit from the All tab
  useEffect(() => {
    if (!focus || loading) return
    if (focus.add) openAdd(focus.date)
    else if (focus.id) { const ev = events.find((e) => e.id === focus.id); if (ev) openEdit(ev) }
    onFocusDone?.()
  }, [focus, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function renameType(oldKey) {
    const ed = typeEdits[oldKey]
    const info = parseCustomType(oldKey)
    const emoji = (ed?.emoji ?? info.emoji).trim() || '✨'
    const label = (ed?.label ?? info.label).trim()
    if (!label) { setError('A custom type needs a name.'); return }
    const key = makeCustomType(emoji, label)
    if (key === oldKey) return
    const { error } = await supabase.from('social_events').update({ event_type: key }).eq('event_type', oldKey)
    if (error) { setError(error.message); return }
    setTypeEdits((t) => { const n = { ...t }; delete n[oldKey]; return n })
    fetchAll()
  }

  async function deleteType(oldKey) {
    const { error } = await supabase.from('social_events').update({ event_type: 'reminder' }).eq('event_type', oldKey)
    if (error) { setError(error.message); return }
    fetchAll()
  }

  function applyQuick() {
    const r = parseQuickPlan(quick)
    if (!r) return
    setForm((f) => ({
      ...f,
      title: r.title,
      event_date: r.event_date || f.event_date,
      event_time: r.event_time || f.event_time,
      location: r.location || f.location,
      event_type: r.event_type || f.event_type,
    }))
    setQuickNote(`✓ Filled in${r.event_date ? ` ${formatMonthDay(parseLocalDate(r.event_date).month, parseLocalDate(r.event_date).day)}` : ''}${r.event_time ? ` at ${formatTime(r.event_time)}` : ''} — check below.`)
    setQuick('')
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) return
    if (form.event_type === NEW_TYPE && !customName.trim()) { setError('Give your custom plan type a name.'); return }
    setSaving(true)

    const payload = {
      title: form.title.trim(),
      event_date: form.event_date,
      event_time: form.event_time || null,
      location: form.location.trim() || null,
      event_type: form.event_type === NEW_TYPE ? makeCustomType(customEmoji, customName) : form.event_type,
      rsvp: NO_RSVP_TYPES.includes(form.event_type) ? null : form.rsvp,
      notes: form.notes.trim() || null,
      holiday_subcategory: form.event_type === 'holiday_magic'
        ? (form.holiday_subcategory === 'other_holiday' && form.custom_holiday.trim() ? form.custom_holiday.trim() : (form.holiday_subcategory || null))
        : null,
    }
    // v2 columns are only sent when used, so saving still works before the SQL has been run
    const prev = editingId ? events.find((x) => x.id === editingId) : null
    if (form.recurrence || prev?.recurrence) payload.recurrence = form.recurrence || null
    if (form.status !== 'planned' || (prev && prev.status && prev.status !== 'planned')) payload.status = form.status
    if (form.contact_ids.length || prev?.contact_ids?.length) payload.contact_ids = form.contact_ids
    const cl = form.checklist.filter((i) => i.t.trim())
    if (cl.length || (Array.isArray(prev?.checklist) && prev.checklist.length)) payload.checklist = cl

    let error
    if (editingId) {
      ;({ error } = await supabase.from('social_events').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('social_events').insert({ ...payload, user_id }))
    }
    setSaving(false)
    if (error) { setError(missingColumnHint(error.message)); return }
    closeModal()
    fetchAll()
  }

  async function handleDelete() {
    if (!editingId) return
    setSaving(true)
    const row = events.find((x) => x.id === editingId)
    const { error } = await supabase.from('social_events').delete().eq('id', editingId)
    setSaving(false)
    if (error) { setError(error.message); return }
    closeModal()
    fetchAll()
    if (row) {
      setUndo({
        message: `Deleted “${row.title}”`,
        undo: async () => {
          const { error: e2 } = await supabase.from('social_events').insert(row)
          if (e2) setError(`Couldn’t restore it: ${e2.message}`)
          fetchAll()
        },
      })
    }
  }

  async function skipOne(ev, e) {
    e?.stopPropagation()
    const prev = Array.isArray(ev.skipped_dates) ? ev.skipped_dates : []
    const iso = toIso(ev.nextDate)
    const { error } = await supabase.from('social_events').update({ skipped_dates: [...prev, iso] }).eq('id', ev.id)
    if (error) { setError(missingColumnHint(error.message) + (/column|schema cache/i.test(error.message) ? ' (needs social-calendar-v4.sql)' : '')); return }
    fetchAll()
    setUndo({
      message: `Skipped ${ev.title} on ${formatMonthDay(ev.nextDate.getMonth(), ev.nextDate.getDate())}`,
      undo: async () => {
        const { error: e2 } = await supabase.from('social_events').update({ skipped_dates: prev }).eq('id', ev.id)
        if (e2) setError(e2.message)
        fetchAll()
      },
    })
  }

  async function setStatus(ev, status, e) {
    e?.stopPropagation()
    const { error } = await supabase.from('social_events').update({ status }).eq('id', ev.id)
    if (error) { setError(missingColumnHint(error.message)); return }
    fetchAll()
  }

  const today = startOfToday()
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const customTypes = useMemo(() => {
    const seen = new Map()
    for (const e of events) if (parseCustomType(e.event_type) && !seen.has(e.event_type)) seen.set(e.event_type, eventTypeInfo(e.event_type))
    return [...seen.values()]
  }, [events])
  const nameOf = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c])), [contacts])

  const items = useMemo(() => events.filter((e) => e.event_date).map((e) => planItem(e, today)), [events]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((e) => {
      if (rsvpFilter && e.rsvp !== rsvpFilter) return false
      if (!q) return true
      const people = (e.contact_ids || []).map((id) => nameOf[id]?.name || '').join(' ')
      return `${e.title} ${e.location || ''} ${people}`.toLowerCase().includes(q)
    })
  }, [items, rsvpFilter, search, nameOf])

  const upcoming = filtered.filter((e) => !e.past).sort((a, b) => a.nextDate - b.nextDate)
  const past = filtered.filter((e) => e.past).sort((a, b) => b.nextDate - a.nextDate)
  const listed = when === 'upcoming' ? upcoming : past
  const filtering = !!(search || rsvpFilter)
  const upNext = when === 'upcoming' && !filtering ? upcoming.slice(0, 3) : []

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const arr = []
    for (let i = 0; i < firstDay; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    return arr
  }, [year, month])

  const eventsByDay = useMemo(() => {
    const map = {}
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const hits = filtered.filter((e) => (e.status || 'planned') !== 'cancelled' && planOccursOn(e, date))
      if (hits.length) map[d] = hits
    }
    return map
  }, [filtered, month, year])

  function goToMonth(delta) { setViewDate(new Date(year, month + delta, 1)); setDayPick(null) }

  function jumpToDate(dateStr) {
    const d = parseLocalDate(dateStr)
    setViewDate(new Date(d.year, d.month, 1))
    setHighlightDate(dateStr)
    setTimeout(() => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    setTimeout(() => setHighlightDate(null), 2500)
  }

  function planMeta(e) {
    const t = eventTypeInfo(e.event_type)
    const people = (e.contact_ids || []).map((id) => nameOf[id]).filter(Boolean)
    return { t, people }
  }

  function PlanCard({ e, i }) {
    const { t, people } = planMeta(e)
    const color = CHIP_COLORS[i % CHIP_COLORS.length]
    const bits = [
      `${formatMonthDay(e.nextDate.getMonth(), e.nextDate.getDate())}${e.event_time ? ` · ${formatTime(e.event_time)}` : ''}`,
      e.location && `📍 ${e.location}`,
      people.length > 0 && people.map((p) => p.name).join(', '),
      e.rsvp && rsvpInfo(e.rsvp).label,
      e.recurrence && `🔁 ${RECURRENCE.find((r) => r.key === e.recurrence)?.label.toLowerCase()}`,
      Array.isArray(e.checklist) && e.checklist.length > 0 && `☑ ${e.checklist.filter((i) => i.d).length}/${e.checklist.length}`,
    ].filter(Boolean)
    return (
      <div className="sc-row-card" onClick={() => openEdit(e)} style={{ borderLeftColor: color }}>
        <span className="sc-row-emoji">{t.label.split(' ')[0]}</span>
        <div className="sc-row-main">
          <span className="sc-row-title">{e.title} <em>{inDays(e.daysAway)}</em></span>
          <span className="sc-row-sub">{bits.join(' · ')}</span>
        </div>
        <span className="sc-card-actions">
          {e.recurrence && (
            <button className="sc-icon-btn" onClick={(ev) => skipOne(e, ev)} title="Skip this one" aria-label="Skip this occurrence">⏭</button>
          )}
          {!e.recurrence && e.status !== 'done' && e.status !== 'cancelled' && (
            <button className="sc-icon-btn" onClick={(ev) => setStatus(e, 'done', ev)} title="Mark done" aria-label="Mark done">✅</button>
          )}
          <button className="sc-icon-btn" onClick={(ev) => { ev.stopPropagation(); jumpToDate(e.event_date) }} title="View in calendar" aria-label="View in calendar">📅</button>
        </span>
      </div>
    )
  }

  const hasMore = !!(form.recurrence || form.status !== 'planned' || form.contact_ids.length || form.checklist.length)
  const dayList = dayPick ? (eventsByDay[dayPick] || []) : []

  return (
    <div>
      <div className="sc-actionbar">
        {events.length > 0 && (
          <input className="search-box cake-search-input" placeholder="🔍 Search plans, places or people…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
        {customTypes.length > 0 && (
          <button className="sc-filter-btn" onClick={() => setTypesOpen(true)} title="Manage your custom plan types">🎨 Types</button>
        )}
        {events.length > 0 && (
          <button className={`sc-filter-btn ${showFilters || rsvpFilter ? 'on' : ''}`} onClick={() => setShowFilters((v) => !v)}>
            ⚙ Filter{rsvpFilter ? ' · 1' : ''}
          </button>
        )}
      </div>

      {loading && <p className="loading">Checking the group chat… 💬✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && (
        <>
          {events.length > 0 && (
            <>
              <div className="filter-row" style={{ display: showFilters || rsvpFilter || when === 'past' ? undefined : 'none' }}>
                <button className={`filter-pill ${when === 'upcoming' ? 'filter-pill-active' : ''}`} onClick={() => setWhen('upcoming')}>Upcoming ({upcoming.length})</button>
                <button className={`filter-pill ${when === 'past' ? 'filter-pill-active' : ''}`} onClick={() => setWhen('past')}>Past ({past.length})</button>
                {RSVP_FILTERS.map((f) => (
                  <button key={f.key} className={`filter-pill ${rsvpFilter === f.key ? 'filter-pill-active' : ''}`} onClick={() => setRsvpFilter(rsvpFilter === f.key ? null : f.key)}>{f.label}</button>
                ))}
              </div>
            </>
          )}

          {upNext.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">Up next</p>
              <div className="sc-stack">{upNext.map((e, i) => <PlanCard key={e.id} e={e} i={i} />)}</div>
            </div>
          )}

          <div className="calendar-card" ref={calendarRef}>
            <div className="calendar-nav">
              <button className="cal-nav-btn" onClick={() => goToMonth(-1)} aria-label="Previous month">‹</button>
              <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
              <button className="cal-nav-btn" onClick={() => goToMonth(1)} aria-label="Next month">›</button>
            </div>
            <div className="calendar-grid">
              {DAY_NAMES.map((d) => <div key={d} className="cal-day-name">{d}</div>)}
              {cells.map((day, i) => {
                const iso = day ? toIso(new Date(year, month, day)) : null
                const isToday = iso === toIso(today)
                return (
                  <div
                    key={i}
                    className={`cal-cell ${day ? 'cal-cell-active' : 'cal-cell-empty'} ${isToday ? 'cal-cell-today' : ''} ${iso && iso === highlightDate ? 'cal-cell-highlight' : ''} ${dayPick === day ? 'cal-cell-selected' : ''}`}
                    onClick={() => {
                      if (!day) return
                      if (eventsByDay[day]) setDayPick(dayPick === day ? null : day)
                      else openAdd(iso)
                    }}
                  >
                    {day && <span className="cal-day-num">{day}</span>}
                    {day && eventsByDay[day] && (
                      <div className="cal-chip-stack">
                        {eventsByDay[day].slice(0, 2).map((e, ci) => (
                          <span key={e.id} className="cal-chip" style={{ background: CHIP_COLORS[ci % CHIP_COLORS.length] }}>
                            {eventTypeInfo(e.event_type).label.split(' ')[0]} {e.title}{e.rsvp ? ` ${RSVP_MARK[e.rsvp] || ''}` : ''}
                          </span>
                        ))}
                        {eventsByDay[day].length > 2 && <span className="cal-chip cal-chip-more">+{eventsByDay[day].length - 2}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {dayPick && (
              <div className="sc-day-list">
                <p className="module-group-label">{formatMonthDay(month, dayPick)}</p>
                {dayList.map((e) => (
                  <div key={e.id} className="upcoming-row" onClick={() => openEdit(e)}>
                    <span className="upcoming-name">{eventTypeInfo(e.event_type).label.split(' ')[0]} {e.title}</span>
                    <span className="upcoming-date">{e.event_time ? formatTime(e.event_time) : ''}{e.rsvp ? ` ${RSVP_MARK[e.rsvp]}` : ''}</span>
                  </div>
                ))}
                <button className="sc-chip-btn" onClick={() => openAdd(toIso(new Date(year, month, dayPick)))}>+ Add plan on this day</button>
              </div>
            )}
          </div>

          {listed.length > upNext.length && (
            <div className="upcoming-section">
              <p className="module-group-label">{when === 'upcoming' ? 'Everything coming up' : 'Past plans'}</p>
              <div className="upcoming-list">
                {listed.slice(when === 'upcoming' ? upNext.length : 0, when === 'upcoming' ? 12 : 30).map((e, i) => (
                  <div className="upcoming-row" key={e.id} onClick={() => openEdit(e)} style={{ borderLeftColor: CHIP_COLORS[i % CHIP_COLORS.length], opacity: e.status === 'cancelled' ? 0.55 : 1 }}>
                    <span className="upcoming-name">{eventTypeInfo(e.event_type).label.split(' ')[0]} {e.title}{e.status === 'done' ? ' ✓' : e.status === 'cancelled' ? ' (cancelled)' : ''}</span>
                    <span className="upcoming-date">
                      {formatMonthDay(e.nextDate.getMonth(), e.nextDate.getDate())}{e.event_time ? ` · ${formatTime(e.event_time)}` : ''}{when === 'upcoming' ? ` · ${inDays(e.daysAway)}` : ''}
                    </span>
                    <button className="upcoming-cal-jump" onClick={(ev) => { ev.stopPropagation(); jumpToDate(e.event_date) }} title="View in calendar" aria-label="View in calendar">📅</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listed.length === 0 && events.length > 0 && (
            <div className="empty-state">
              <h3>{filtering ? 'No matches, bestie ✨' : when === 'past' ? 'No past plans yet' : 'Nothing coming up 🥂'}</h3>
              <p>{filtering ? 'Try a different search or clear your filters.' : 'Tap a date above to plan something.'}</p>
            </div>
          )}

          {events.length === 0 && (
            <div className="empty-state">
              <h3>No plans yet — let's fix that ✨</h3>
              <p>Tap a date above, or tap the + button to get your calendar looking cute.</p>
            </div>
          )}
        </>
      )}

      {typesOpen && (
        <div className="modal-backdrop" onClick={() => setTypesOpen(false)}>
          <div className="modal sc-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>Your plan types</h2>
            {customTypes.length === 0 && <p className="field-hint">No custom types yet.</p>}
            {customTypes.map((t) => {
              const info = parseCustomType(t.key)
              const ed = typeEdits[t.key] || {}
              const count = events.filter((e) => e.event_type === t.key).length
              return (
                <div key={t.key} className="sc-check-row">
                  <input style={{ maxWidth: 56 }} maxLength={8} value={ed.emoji ?? info.emoji} onChange={(e) => setTypeEdits({ ...typeEdits, [t.key]: { ...ed, emoji: e.target.value } })} aria-label="Emoji" />
                  <input value={ed.label ?? info.label} maxLength={30} onChange={(e) => setTypeEdits({ ...typeEdits, [t.key]: { ...ed, label: e.target.value } })} aria-label="Name" />
                  <button className="sc-chip-btn" onClick={() => renameType(t.key)}>Save</button>
                  <button className="sc-icon-btn" aria-label="Delete type" onClick={() => setAsk({ title: `Delete “${info.label}”?`, body: `${count} plan${count === 1 ? '' : 's'} will become “📝 Reminder”. Nothing is deleted.`, label: 'Delete type', run: () => deleteType(t.key) })}>🗑</button>
                </div>
              )
            })}
            <div className="modal-actions"><div /><div className="modal-actions-right"><button className="btn-cancel" onClick={() => setTypesOpen(false)}>Close</button></div></div>
          </div>
        </div>
      )}

      {undo && <UndoBar message={undo.message} onDismiss={() => setUndo(null)} onUndo={() => { const u = undo.undo; setUndo(null); u() }} />}

      {ask && (
        <ConfirmSheet title={ask.title} body={ask.body} confirmLabel={ask.label} danger onCancel={() => setAsk(null)} onConfirm={() => { const r = ask.run; setAsk(null); r() }} />
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit plan' : 'New plan'}</h2>
            <form onSubmit={handleSave}>
              {!editingId && (
                <div className="field sc-quick">
                  <label>✨ Quick add</label>
                  <div className="sc-quick-row">
                    <input
                      autoFocus
                      value={quick}
                      onChange={(e) => { setQuick(e.target.value); setQuickNote(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyQuick() } }}
                      placeholder="Dinner Fri 7pm at Rosebank"
                    />
                    <button type="button" className="sc-chip-btn" onClick={applyQuick} disabled={!quick.trim()}>Fill in</button>
                  </div>
                  <p className="field-hint sc-quick-note">{quickNote || 'Type it the way you’d say it, then press Enter.'}</p>
                </div>
              )}
              <div className="field">
                <label>What's the plan?</label>
                <input autoFocus={!!editingId} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sarah's birthday dinner, girls' trip…" required />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                  {EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  {customTypes.length > 0 && <optgroup label="Your types">{customTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</optgroup>}
                  <option value={NEW_TYPE}>➕ New custom type…</option>
                </select>
                {form.event_type === NEW_TYPE && (
                  <div className="sc-custom-type">
                    <div className="icon-picker">
                      <span className="icon-preview">{customEmoji || '✨'}</span>
                      <input className="icon-custom-input" value={customEmoji} maxLength={8} onChange={(e) => setCustomEmoji(e.target.value)} placeholder="Paste any emoji" aria-label="Custom emoji" />
                      <input style={{ flex: 1 }} value={customName} maxLength={30} onChange={(e) => setCustomName(e.target.value)} placeholder="Name, e.g. Pizza night" aria-label="Custom type name" required autoFocus />
                    </div>
                    <div className="icon-grid">
                      {EMOJI_SUGGEST.map((em) => (
                        <button type="button" key={em} className={`icon-cell ${customEmoji === em ? 'icon-cell-active' : ''}`} onClick={() => setCustomEmoji(em)}>{em}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {form.event_type === 'holiday_magic' && (
                <div className="field">
                  <label>Which holiday?</label>
                  <select value={form.holiday_subcategory} onChange={(e) => setForm({ ...form, holiday_subcategory: e.target.value })}>
                    <option value="">Select…</option>
                    {HOLIDAY_SUBCATEGORIES.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
                  </select>
                  {form.holiday_subcategory === 'other_holiday' && (
                    <input style={{ marginTop: 8 }} value={form.custom_holiday} onChange={(e) => setForm({ ...form, custom_holiday: e.target.value })} placeholder="Type the holiday name…" />
                  )}
                </div>
              )}
              <div className="field-row">
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Time (optional)</label>
                  <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Location (optional)</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Where's it happening?" />
              </div>
              {!NO_RSVP_TYPES.includes(form.event_type) && (
                <div className="field">
                  <label>RSVP</label>
                  <select value={form.rsvp} onChange={(e) => setForm({ ...form, rsvp: e.target.value })}>
                    {RSVP_OPTIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What to wear, what to bring, who's going…" />
              </div>
              <button type="button" className="sc-more-toggle" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen || hasMore}>
                {moreOpen || hasMore ? '▲ Fewer options' : '▼ More options (repeat, people, checklist)'}
              </button>
              {(moreOpen || hasMore) && (
                <>
              <div className="field-row">
                <div className="field">
                  <label>Repeats</label>
                  <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                    {RECURRENCE.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="planned">Planned</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              {contacts.length > 0 && (
                <div className="field">
                  <label>Who's it with? (optional)</label>
                  <div className="filter-row sc-wrap">
                    {contacts.map((c) => {
                      const on = form.contact_ids.includes(c.id)
                      return (
                        <button type="button" key={c.id} className={`filter-pill ${on ? 'filter-pill-active' : ''}`}
                          onClick={() => setForm({ ...form, contact_ids: on ? form.contact_ids.filter((x) => x !== c.id) : [...form.contact_ids, c.id] })}>
                          {c.icon || '🎂'} {c.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="field">
                <label>Checklist (optional)</label>
                {form.checklist.map((item, i) => (
                  <div className="sc-check-row" key={i}>
                    <input type="checkbox" checked={!!item.d} aria-label="Done" onChange={() => setForm({ ...form, checklist: form.checklist.map((x, j) => (j === i ? { ...x, d: !x.d } : x)) })} />
                    <input value={item.t} onChange={(e) => setForm({ ...form, checklist: form.checklist.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)) })} placeholder="e.g. Buy a gift" />
                    <button type="button" className="sc-icon-btn" aria-label="Remove item" onClick={() => setForm({ ...form, checklist: form.checklist.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
                <button type="button" className="sc-chip-btn" onClick={() => setForm({ ...form, checklist: [...form.checklist, { t: '', d: false }] })}>+ Add item</button>
              </div>
                </>
              )}
              <div className="modal-actions">
                <div>
                  {editingId && (
                    <button type="button" className="btn-delete" disabled={saving}
                      onClick={() => setAsk({ title: 'Delete this plan?', body: form.recurrence ? 'This removes every repeat of it.' : 'This removes it from your calendar.', label: 'Delete', run: handleDelete })}>
                      Delete
                    </button>
                  )}
                </div>
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
