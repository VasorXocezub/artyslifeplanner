import { useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { buildIcs, downloadIcs, startOfToday } from './lib/social'

const SocialAllView = lazy(() => import('./SocialAllView'))
const ContactsView = lazy(() => import('./ContactsView'))
const SocialCalendarView = lazy(() => import('./SocialCalendarView'))

const TABS = [
  { key: 'all', label: '✨ All' },
  { key: 'contacts', label: '🎂 Birthdays' },
  { key: 'social', label: '💌 Plans' },
]

export default function SocialCalendarHub({ initialTab = 'contacts', onTabChange }) {
  const [tab, setTab] = useState(initialTab === 'social' ? 'social' : 'all')
  const [focus, setFocus] = useState(null)
  const [exportError, setExportError] = useState(null)
  const [exporting, setExporting] = useState(false)

  function pick(k) {
    setTab(k)
    onTabChange?.(k === 'social' ? 'social' : 'contacts')
  }

  function open(k, id) {
    setFocus(id ? { id } : null)
    pick(k)
  }
  function add(k, date) {
    setFocus({ add: true, date })
    pick(k)
  }

  async function exportCalendar() {
    setExporting(true)
    setExportError(null)
    const [c, e] = await Promise.all([
      supabase.from('contacts').select('*').not('birthday', 'is', null),
      supabase.from('social_events').select('*'),
    ])
    setExporting(false)
    if (c.error || e.error) { setExportError((c.error || e.error).message); return }
    downloadIcs(buildIcs({ contacts: (c.data || []).filter((x) => !x.archived), events: e.data || [], today: startOfToday() }))
  }

  const done = () => setFocus(null)

  return (
    <div>
      <div className="view-header sb-header">
        <div>
          <h1 className="view-title">Social Calendar 🎀</h1>
          <p className="view-subtitle sb-tagline">“It’s in my head” was never a system, babe. 🎀</p>
        </div>
        <div className="toolbar">
          <button className="btn-check" onClick={exportCalendar} disabled={exporting}>
            {exporting ? 'Exporting…' : '📅 Add to my calendar'}
          </button>
        </div>
      </div>
      {exportError && <p className="error-msg">{exportError}</p>}
      <div className="sb-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`sb-tab ${tab === t.key ? 'active' : ''}`} onClick={() => pick(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<p className="loading">Loading… ✨</p>}>
        {tab === 'all' && <SocialAllView onOpen={open} onAdd={add} />}
        {tab === 'contacts' && <ContactsView embedded focus={focus} onFocusDone={done} />}
        {tab === 'social' && <SocialCalendarView embedded focus={focus} onFocusDone={done} />}
      </Suspense>
    </div>
  )
}
