import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { getHiddenModules, setHiddenModules, getLastSeenTea, setLastSeenTea, getLastSeenUpdates, setLastSeenUpdates } from './lib/localPrefs'
import Auth from './Auth'
import './App.css'

const SettingsView = lazy(() => import('./SettingsView'))
const Dashboard = lazy(() => import('./Dashboard'))
const ContactsView = lazy(() => import('./ContactsView'))
const GoalsView = lazy(() => import('./GoalsView'))
const HabitsView = lazy(() => import('./HabitsView'))
const FinancesView = lazy(() => import('./FinancesView'))
const TodoView = lazy(() => import('./TodoView'))
const ShoppingListView = lazy(() => import('./ShoppingListView'))
const BookNookView = lazy(() => import('./BookNookView'))
const GlowUpHubView = lazy(() => import('./GlowUpHubView'))
const SocialCalendarView = lazy(() => import('./SocialCalendarView'))
const BrainDumpView = lazy(() => import('./BrainDumpView'))
const SpillTheTeaView = lazy(() => import('./SpillTheTeaView'))
const WishlistView = lazy(() => import('./WishlistView'))
const InboxView = lazy(() => import('./InboxView'))
const QuickCaptureModal = lazy(() => import('./QuickCaptureModal'))
const UpdatesView = lazy(() => import('./UpdatesView'))

const NAV_ITEMS = [
  { key: 'home', label: 'Home', num: '00', enabled: true },
  { key: 'contacts', label: 'Cake Club', num: '01', enabled: true },
  { key: 'social', label: 'Social Club', num: '02', enabled: true },
  { key: 'inbox', label: 'Inbox', num: '03', enabled: true },
  { key: 'goals', label: 'Dream Board', num: '04', enabled: true },
  { key: 'habits', label: 'Daily Habits', num: '05', enabled: true },
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
    if (!session) return
    checkUnseenTea()
    checkUnseenUpdates()
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
    setMobileMenuOpen(false)
  }, [view])

  useEffect(() => {
    if (hiddenModules.includes(view)) setView('home')
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
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <nav className="nav">
          {NAV_ITEMS.filter((item) => !hiddenModules.includes(item.key)).map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
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
          {view === 'contacts' && <ContactsView />}
          {view === 'goals' && <GoalsView />}
          {view === 'habits' && <HabitsView />}
          {view === 'finances' && <FinancesView />}
          {view === 'todos' && <TodoView />}
          {view === 'shopping' && <ShoppingListView />}
          {view === 'booknook' && <BookNookView />}
          {view === 'glowup' && <GlowUpHubView />}
          {view === 'social' && <SocialCalendarView />}
          {view === 'inbox' && <InboxView />}
          {view === 'braindump' && <BrainDumpView />}
          {view === 'spillthetea' && <SpillTheTeaView />}
          {view === 'updates' && <UpdatesView />}
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
