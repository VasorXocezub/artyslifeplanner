import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  MONTH_NAMES, DAY_NAMES, CHIP_COLORS, formatMonthDay, formatTime, toIso, startOfToday,
  nextBirthday, giftNeeded, planItem, planOccursOn, inDays, isIsoDate, parseCustomType,
} from './lib/social'

const TYPE_EMOJI = {
  holiday_magic: '🎄', bestie_time: '👯', date_night: '💖', girls_night: '🥂', family_time: '🌸', cozy_gathering: '🍓',
  treat_yourself: '🛍️', adventure: '✈️', ceo_era: '💼', appointment: '🩺', growth_moment: '🎓', main_character: '✨', reminder: '📝',
}
const RSVP_MARK = { going: '✅', maybe: '🤔', cant: '❌' }

export default function SocialAllView({ onOpen, onAdd }) {
  const [contacts, setContacts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [viewDate, setViewDate] = useState(new Date())
  const [dayPick, setDayPick] = useState(null)
  const calRef = useRef(null)
  const [yearMode, setYearMode] = useState(false)

  useEffect(() => {
    (async () => {
      const [c, e] = await Promise.all([
        supabase.from('contacts').select('*').not('birthday', 'is', null),
        supabase.from('social_events').select('*').order('event_date', { ascending: true }),
      ])
      if (c.error) setError(c.error.message)
      else if (e.error) setError(e.error.message)
      setContacts((c.data || []).filter((x) => !x.archived && x.name && isIsoDate(x.birthday)))
      setEvents((e.data || []).filter((x) => x.title && isIsoDate(x.event_date)))
      setLoading(false)
    })()
  }, [])

  const today = startOfToday()
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const births = useMemo(() => contacts.map((c) => ({ ...nextBirthday(c, today), kind: 'b', title: c.name })), [contacts]) // eslint-disable-line react-hooks/exhaustive-deps
  const plans = useMemo(() => events.filter((e) => e.event_date).map((e) => planItem(e, today)), [events]) // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c.name])), [contacts])

  const q = search.trim().toLowerCase()
  const match = (x) => !q || `${x.title} ${x.location || ''} ${(x.contact_ids || []).map((id) => nameOf[id] || '').join(' ')}`.toLowerCase().includes(q)

  const feed = useMemo(() => [...births, ...plans.filter((p) => !p.past)].filter(match).sort((a, b) => a.nextDate - b.nextDate), [births, plans, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const week = feed.filter((x) => x.daysAway <= 7)
  const later = feed.filter((x) => x.daysAway > 7)
  const todays = births.filter((b) => b.daysAway === 0)
  const giftNudge = births.filter((b) => b.daysAway > 0 && b.daysAway <= 14 && giftNeeded(b))

  const byDay = useMemo(() => {
    const map = {}
    const dim = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= dim; d++) {
      const date = new Date(year, month, d)
      const hits = [
        ...births.filter((b) => b.month === month && b.day === d && match(b)),
        ...plans.filter((p) => p.status !== 'cancelled' && planOccursOn(p, date) && match(p)),
      ]
      if (hits.length) map[d] = hits
    }
    return map
  }, [births, plans, month, year, q]) // eslint-disable-line react-hooks/exhaustive-deps

  // year view: for each month, which days have a birthday and/or a plan
  const yearData = useMemo(() => {
    if (!yearMode) return []
    return Array.from({ length: 12 }, (_, m) => {
      const dim = new Date(year, m + 1, 0).getDate()
      const days = {}
      for (let d = 1; d <= dim; d++) {
        const date = new Date(year, m, d)
        const b = births.some((x) => x.month === m && x.day === d && match(x))
        const p = plans.some((x) => x.status !== 'cancelled' && planOccursOn(x, date) && match(x))
        if (b || p) days[d] = { b, p }
      }
      return { m, dim, first: new Date(year, m, 1).getDay(), days, count: Object.keys(days).length }
    })
  }, [yearMode, births, plans, year, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = new Date(year, month, 1).getDay()
    const dim = new Date(year, month + 1, 0).getDate()
    return [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  }, [year, month])

  const emoji = (x) => (x.kind === 'b' ? (x.icon || '🎂') : (parseCustomType(x.event_type)?.emoji || TYPE_EMOJI[x.event_type] || '📝'))
  const when = (x) => (x.kind === 'b'
    ? `${formatMonthDay(x.month, x.day)}${x.turning ? ` · turns ${x.turning}` : ''}`
    : `${formatMonthDay(x.nextDate.getMonth(), x.nextDate.getDate())}${x.event_time ? ` · ${formatTime(x.event_time)}` : ''}`)

  if (loading) return <p className="loading">Checking the calendar… ✨</p>

  return (
    <div>
      <div className="sc-actionbar">
        <input className="search-box cake-search-input" placeholder="🔍 Search birthdays, plans, places or people…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <p className="error-msg">{error}</p>}

      {todays.map((c) => (
        <div className="sc-banner sc-banner-today" key={c.id}>
          <span>🎉 It's {c.name}'s birthday today{c.turning ? ` — turning ${c.turning}` : ''}!</span>
          {c.phone && <a className="sc-chip-btn" href={`sms:${c.phone}`}>💬 Text</a>}
        </div>
      ))}
      {giftNudge.length > 0 && (
        <div className="sc-banner sc-banner-gift">
          <span>🎁 Gift needed soon: {giftNudge.slice(0, 3).map((c) => `${c.name} (${inDays(c.daysAway)})`).join(', ')}{giftNudge.length > 3 ? ` +${giftNudge.length - 3} more` : ''}</span>
          <button className="sc-chip-btn" onClick={() => onOpen('contacts', null)}>Open</button>
        </div>
      )}

      {q && feed.length === 0 && (
        <div className="empty-state"><h3>No matches, bestie ✨</h3><p>Try a different search.</p></div>
      )}

      {week.length > 0 && (
        <div className="upcoming-section">
          <p className="module-group-label">{q ? 'Results' : 'This week'}</p>
          <div className="sc-stack">
            {week.map((x, i) => (
              <div className="sc-row-card" key={`${x.kind}${x.id}`} onClick={() => onOpen(x.kind === 'b' ? 'contacts' : 'social', x.id)} style={{ borderLeftColor: CHIP_COLORS[x.kind === 'b' ? 0 : 1 + (i % 3)] }}>
                <span className="sc-row-emoji">{emoji(x)}</span>
                <div className="sc-row-main">
                  <span className="sc-row-title">{x.title}{x.kind === 'p' && x.rsvp ? ` ${RSVP_MARK[x.rsvp]}` : ''} <em>{inDays(x.daysAway)}</em></span>
                  <span className="sc-row-sub">{when(x)}{x.kind === 'b' && giftNeeded(x) ? ' · 🎁 gift needed' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {later.length > 0 && (
        <div className="upcoming-section">
          <p className="module-group-label">Later</p>
          <div className="upcoming-list">
            {later.slice(0, q ? 20 : 6).map((x, i) => (
              <div className="upcoming-row" key={`${x.kind}${x.id}`} onClick={() => onOpen(x.kind === 'b' ? 'contacts' : 'social', x.id)} style={{ borderLeftColor: CHIP_COLORS[x.kind === 'b' ? 0 : 1 + (i % 3)] }}>
                <span className="upcoming-name">{emoji(x)} {x.title}</span>
                <span className="upcoming-date">{when(x)} · {inDays(x.daysAway)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sc-viewtoggle">
        <button className={`filter-pill ${!yearMode ? 'filter-pill-active' : ''}`} onClick={() => setYearMode(false)}>Month</button>
        <button className={`filter-pill ${yearMode ? 'filter-pill-active' : ''}`} onClick={() => { setYearMode(true); setDayPick(null) }}>Year</button>
      </div>

      {yearMode && (
        <div className="calendar-card">
          <div className="calendar-nav">
            <button className="cal-nav-btn" onClick={() => setViewDate(new Date(year - 1, month, 1))} aria-label="Previous year">‹</button>
            <span className="cal-month-label">{year}</span>
            <button className="cal-nav-btn" onClick={() => setViewDate(new Date(year + 1, month, 1))} aria-label="Next year">›</button>
          </div>
          <div className="sc-legend"><span><i style={{ background: CHIP_COLORS[0] }} /> Birthday</span><span><i style={{ background: CHIP_COLORS[1] }} /> Plan</span></div>
          <div className="sc-year-grid">
            {yearData.map((mo) => (
              <button key={mo.m} className={`sc-mini ${mo.m === today.getMonth() && year === today.getFullYear() ? 'now' : ''}`} onClick={() => { setViewDate(new Date(year, mo.m, 1)); setYearMode(false) }}>
                <span className="sc-mini-name">{MONTH_NAMES[mo.m].slice(0, 3)} <em>{mo.count > 0 ? mo.count : ''}</em></span>
                <span className="sc-mini-grid">
                  {Array(mo.first).fill(0).map((_, i) => <i key={`e${i}`} />)}
                  {Array.from({ length: mo.dim }, (_, i) => {
                    const hit = mo.days[i + 1]
                    return <i key={i} className={hit ? (hit.b && hit.p ? 'both' : hit.b ? 'bd' : 'pl') : ''} />
                  })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="calendar-card" ref={calRef} style={yearMode ? { display: 'none' } : undefined}>
        <div className="calendar-nav">
          <button className="cal-nav-btn" onClick={() => { setViewDate(new Date(year, month - 1, 1)); setDayPick(null) }} aria-label="Previous month">‹</button>
          <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
          <button className="cal-nav-btn" onClick={() => { setViewDate(new Date(year, month + 1, 1)); setDayPick(null) }} aria-label="Next month">›</button>
        </div>
        <div className="sc-legend"><span><i style={{ background: CHIP_COLORS[0] }} /> Birthday</span><span><i style={{ background: CHIP_COLORS[1] }} /> Plan</span></div>
        <div className="calendar-grid">
          {DAY_NAMES.map((d) => <div key={d} className="cal-day-name">{d}</div>)}
          {cells.map((day, i) => {
            const iso = day ? toIso(new Date(year, month, day)) : null
            return (
              <div key={i}
                className={`cal-cell ${day ? 'cal-cell-active' : 'cal-cell-empty'} ${iso === toIso(today) ? 'cal-cell-today' : ''} ${dayPick === day ? 'cal-cell-selected' : ''}`}
                onClick={() => { if (day) setDayPick(dayPick === day ? null : day) }}>
                {day && <span className="cal-day-num">{day}</span>}
                {day && byDay[day] && (
                  <div className="cal-chip-stack">
                    {byDay[day].slice(0, 2).map((x, ci) => (
                      <span key={`${x.kind}${x.id}`} className="cal-chip" style={{ background: CHIP_COLORS[x.kind === 'b' ? 0 : 1 + (ci % 3)] }}>{emoji(x)} {x.title}</span>
                    ))}
                    {byDay[day].length > 2 && <span className="cal-chip cal-chip-more">+{byDay[day].length - 2}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {dayPick && (
          <div className="sc-day-list">
            <p className="module-group-label">{formatMonthDay(month, dayPick)}</p>
            {(byDay[dayPick] || []).map((x) => (
              <div key={`${x.kind}${x.id}`} className="upcoming-row" onClick={() => onOpen(x.kind === 'b' ? 'contacts' : 'social', x.id)}>
                <span className="upcoming-name">{emoji(x)} {x.title}</span>
                <span className="upcoming-date">{x.kind === 'b' ? 'Birthday' : (x.event_time ? formatTime(x.event_time) : 'Plan')}</span>
              </div>
            ))}
            <div className="sc-card-actions">
              <button className="sc-chip-btn" onClick={() => onAdd('social', toIso(new Date(year, month, dayPick)))}>+ Plan</button>
              <button className="sc-chip-btn" onClick={() => onAdd('contacts', toIso(new Date(year, month, dayPick)))}>+ Birthday</button>
            </div>
          </div>
        )}
      </div>

      {contacts.length === 0 && events.length === 0 && (
        <div className="empty-state">
          <h3>A blank calendar, how serene 🦋</h3>
          <p>Add a birthday or a plan to get started.</p>
        </div>
      )}
    </div>
  )
}
