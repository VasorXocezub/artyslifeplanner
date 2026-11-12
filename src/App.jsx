import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import * as focusEngine from './lib/focusEngine'
import { useFocus } from './lib/useFocus'
import { fmtClock } from './lib/focus'
import { runReminders } from './lib/reminders'
import { getHiddenModules, setHiddenModules, getLastSeenTea, setLastSeenTea, getLastSeenUpdates, setLastSeenUpdates, getTheme } from './lib/localPrefs'
import Auth from './Auth'
import './App.css'

const SettingsView = lazy(() => import('./SettingsView'))
const Dashboard = lazy(() => import('./Dashboard'))
const GoalsView = lazy(() => import('./GoalsView'))
const HabitsView = lazy(() => import('./HabitsView'))
const FinancesView = lazy(() => import('./FinancesView'))
const TodoView = lazy(() => import('./TodoView'))
const ShoppingListView = lazy(() => import('./ShoppingListView'))
const BookNookView = lazy(() => import('./BookNookView'))
const GlowUpHubView = lazy(() => import('./GlowUpHubView'))
const SocialButterflyView = lazy(() => import('./SocialButterflyView'))
const BrainDumpView = lazy(() => import('./BrainDumpView'))
const SpillTheTeaView = lazy(() => import('./SpillTheTeaView'))
const WishlistView = lazy(() => import('./WishlistView'))
const InboxView = lazy(() => import('./InboxView'))
const QuickCaptureModal = lazy(() => import('./QuickCaptureModal'))
const UpdatesView = lazy(() => import('./UpdatesView'))
const FocusTimerView = lazy(() => import('./FocusTimerView'))

const NAV_ITEMS = [
  { key: 'home', label: 'Home', num: '00', enabled: true },
  { key: 'contacts', label: 'Social Calendar', num: '01', enabled: true },
  { key: 'inbox', label: 'Inbox', num: '02', enabled: true },
  { key: 'goals', label: 'Dream Board', num: '03', enabled: true },
  { key: 'habits', label: 'Daily Habits', num: '04', enabled: true },
  { key: 'focustimer', label: 'Focus Timer', num: '05', enabled: true },
  { key: 'todos', label: 'To-Do List', num: '06', enabled: true },
  { key: 'glowup', label: 'Glow Up Hub', num: '07', enabled: true },
  { key: 'braindump', label: 'Brain Dump', num: '08', enabled: true },
  { key: 'booknook', label: 'Book Nook', num: '09', enabled: true },
  { key: 'finances', label: 'Rich Girl Era', num: '10', enabled: true },
  { key: 'shopping', label: 'Kitchen Club', num: '11', enabled: true },
  { key: 'wishlist', label: 'Wishlist', num: '12', enabled: true },
  { key: 'spillthetea', label: 'Spill the Tea', num: '13', enabled: true },
  { key: 'updates', label: 'Updates', num: '14', enabled: true },
]

function App() {
  const [view, setViewState] = useState(() => localStorage.getItem('lastView') || 'home')

  function setView(v) {
    setViewState(v)
    localStorage.setItem('lastView', v)
  }
  const [session, setSession] = useState(undefined)
  const [hiddenModules, setHiddenModulesState] = useState(getHiddenModules())
  const [hasUnseenTea, setHasUnseenTea] = useState(false)
  const [hasUnseenUpdates, setHasUnseenUpdates] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  const focus = useFocus()

  useEffect(() => {
    const go = (e) => setView(e.detail)
    window.addEventListener('app:navigate', go)
    return () => window.removeEventListener('app:navigate', go)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) focusEngine.init()
  }, [session])

  useEffect(() => {
    if (!session) return
    checkUnseenTea()
    checkUnseenUpdates()
    // birthday and plan reminders (only while the app is open)
    runReminders().catch(() => {})
    const timer = setInterval(() => { runReminders().catch(() => {}) }, 30 * 60 * 1000)
    return () => clearInterval(timer)
  }, [session])

  useEffect(() => {
    if (view === 'spillthetea' && hasUnseenTea) {
      setLastSeenTea(new Date().toISOString())
      setHasUnseenTea(false)
    }
    if (view === 'updates' && hasUnseenUpdates) {
      setLastSeenUpdates(new Date().toISOString())
      setHasUnseenUpdates(false)
    }
  }, [view])

  async function checkUnseenTea() {
    const lastSeen = getLastSeenTea()
    let query = supabase.from('dev_feedback').select('id', { count: 'exact', head: true })
    if (lastSeen) query = query.gt('created_at', lastSeen)
    const { count } = await query
    setHasUnseenTea((count || 0) > 0)
  }

  async function checkUnseenUpdates() {
    const lastSeen = getLastSeenUpdates()
    let query = supabase.from('app_updates').select('id', { count: 'exact', head: true })
    if (lastSeen) query = query.gt('created_at', lastSeen)
    const { count } = await query
    setHasUnseenUpdates((count || 0) > 0)
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = getTheme()
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [view])

  useEffect(() => {
    const isSocial = view === 'contacts' || view === 'social'
    // Social Calendar is one section: only bounce home when both of its toggles are hidden
    const hidden = isSocial ? hiddenModules.includes('contacts') && hiddenModules.includes('social') : hiddenModules.includes(view)
    if (hidden) setView('home')
  }, [hiddenModules, view])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handleSaveModules(newHidden) {
    setHiddenModules(newHidden)
    setHiddenModulesState(newHidden)
  }

  // Still checking for an existing session
  if (session === undefined) {
    return (
      <div className="auth-screen">
        <p className="loading">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="app">
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
      {mobileMenuOpen && <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />}
      {(focus.active || focus.done) && view !== 'focustimer' && !mobileMenuOpen && (
        <button className="focus-float" onClick={() => setView('focustimer')} aria-label="Open focus timer">
          ⏱ {focus.active ? `${fmtClock(focus.remaining)}${focus.paused ? ' · paused' : ''}` : 'Done!'}
        </button>
      )}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <nav className="nav">
          {NAV_ITEMS.filter((item) => item.key === 'contacts' ? !(hiddenModules.includes('contacts') && hiddenModules.includes('social')) : !hiddenModules.includes(item.key)).map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key || (item.key === 'contacts' && view === 'social') ? 'active' : ''}`}
              onClick={() => item.enabled && setView(item.key)}
              disabled={!item.enabled}
            >
              <span className="num">{item.num}</span>
              {item.label}
              {!item.enabled && ' (soon)'}
              {item.key === 'spillthetea' && hasUnseenTea && <span className="nav-notification-dot" />}
              {item.key === 'updates' && hasUnseenUpdates && <span className="nav-notification-dot" />}
            </button>
          ))}
        </nav>
        {(focus.active || focus.done) && view !== 'focustimer' && (
          <button className="focus-sidebar-badge" onClick={() => setView('focustimer')}>
            ⏱ {focus.active ? `${fmtClock(focus.remaining)}${focus.paused ? ' · paused' : focus.active.mode === 'break' ? ' · break' : ''}` : 'Session complete!'}
          </button>
        )}
        <div className="sidebar-footer">
          your whole<br />
          life, organized<br />
          (mostly) ✨
        </div>
        <button
          className={`nav-item sidebar-settings-nav ${view === 'settings' ? 'active' : ''}`}
          onClick={() => setView('settings')}
        >
          <span className="num">⚙</span>
          Settings
        </button>
      </aside>
      <main className="main">
        <Suspense fallback={<p className="loading">Loading… ✨</p>}>
          {view === 'home' && <Dashboard onNavigate={setView} user={session.user} hiddenModules={hiddenModules} />}
          {(view === 'contacts' || view === 'social') && <SocialButterflyView initialTab={view} onTabChange={(t) => setView(t)} />}
          {view === 'goals' && <GoalsView />}
          {view === 'habits' && <HabitsView />}
          {view === 'finances' && <FinancesView />}
          {view === 'todos' && <TodoView />}
          {view === 'shopping' && <ShoppingListView />}
          {view === 'booknook' && <BookNookView />}
          {view === 'glowup' && <GlowUpHubView />}
          {view === 'inbox' && <InboxView />}
          {view === 'braindump' && <BrainDumpView />}
          {view === 'spillthetea' && <SpillTheTeaView />}
          {view === 'updates' && <UpdatesView />}
          {view === 'focustimer' && <FocusTimerView />}
          {view === 'wishlist' && <WishlistView />}
          {view === 'settings' && (
            <SettingsView
              session={session}
              hiddenModules={hiddenModules}
              onSaveModules={handleSaveModules}
              onLogout={handleLogout}
            />
          )}
        </Suspense>
      </main>

      <button className="quick-capture-fab" onClick={() => setQuickCaptureOpen(true)} title="Quick Capture">
        📥
      </button>
      {quickCaptureOpen && (
        <Suspense fallback={null}>
          <QuickCaptureModal onClose={() => setQuickCaptureOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default App
