import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { getHiddenModules, setHiddenModules } from './lib/localPrefs'
import Auth from './Auth'
import SettingsView from './SettingsView'
import Dashboard from './Dashboard'
import ContactsView from './ContactsView'
import GoalsView from './GoalsView'
import HabitsView from './HabitsView'
import FinancesView from './FinancesView'
import TodoView from './TodoView'
import ShoppingListView from './ShoppingListView'
import BookNookView from './BookNookView'
import GlowUpHubView from './GlowUpHubView'
import SocialCalendarView from './SocialCalendarView'
import './App.css'

const NAV_ITEMS = [
  { key: 'home', label: 'Home', num: '00', enabled: true },
  { key: 'contacts', label: 'Cake Club', num: '01', enabled: true },
  { key: 'goals', label: 'Goals', num: '02', enabled: true },
  { key: 'habits', label: 'Habits', num: '03', enabled: true },
  { key: 'finances', label: 'Finances', num: '04', enabled: true },
  { key: 'todos', label: 'To-Do', num: '05', enabled: true },
  { key: 'shopping', label: 'Shopping List', num: '06', enabled: true },
  { key: 'booknook', label: 'Book Nook', num: '07', enabled: true },
  { key: 'glowup', label: 'Glow Up Hub', num: '08', enabled: true },
  { key: 'social', label: 'Social Calendar', num: '09', enabled: true },
]

function App() {
  const [view, setView] = useState('home')
  const [session, setSession] = useState(undefined)
  const [hiddenModules, setHiddenModulesState] = useState(getHiddenModules())

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
      <aside className="sidebar">
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
        {view === 'settings' && (
          <SettingsView
            session={session}
            hiddenModules={hiddenModules}
            onSaveModules={handleSaveModules}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  )
}

export default App
