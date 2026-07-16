import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
import ContactsView from './ContactsView'
import GoalsView from './GoalsView'
import HabitsView from './HabitsView'
import FinancesView from './FinancesView'
import TodoView from './TodoView'
import './App.css'

const NAV_ITEMS = [
  { key: 'home', label: 'Home', num: '00', enabled: true },
  { key: 'contacts', label: 'Birthdays', num: '01', enabled: true },
  { key: 'goals', label: 'Goals', num: '02', enabled: true },
  { key: 'habits', label: 'Habits', num: '03', enabled: true },
  { key: 'finances', label: 'Finances', num: '04', enabled: true },
  { key: 'todos', label: 'To-Do', num: '05', enabled: true },
]

function App() {
  const [view, setView] = useState('home')
  const [session, setSession] = useState(undefined)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function handleSaveName() {
    if (!nameInput.trim()) return
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: nameInput.trim() } })
    if (!error && data.user) {
      setSession((s) => ({ ...s, user: data.user }))
      setEditingName(false)
    }
  }

  // Still checking for an existing session
  if (session === undefined) {
    return (
      <div className="auth-screen">
        <p className="loading">Loading…</p>
      </div>
    )
  }

  if (passwordRecovery) {
    return <Auth initialMode="reset" onResetDone={() => setPasswordRecovery(false)} />
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
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
          your whole life,<br />
          organized (mostly) ✨
        </div>
        <div className="sidebar-account">
          {editingName ? (
            <div className="name-edit-row">
              <input
                className="name-edit-input"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <button className="name-edit-save" onClick={handleSaveName}>Save</button>
            </div>
          ) : (
            <>
              {session.user.user_metadata?.full_name || session.user.email}
              {' · '}
              <button
                className="name-edit-trigger"
                onClick={() => {
                  setNameInput(session.user.user_metadata?.full_name || '')
                  setEditingName(true)
                }}
              >
                {session.user.user_metadata?.full_name ? 'edit name' : 'set your name'}
              </button>
            </>
          )}
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>Log out</button>
      </aside>
      <main className="main">
        {view === 'home' && <Dashboard onNavigate={setView} user={session.user} />}
        {view === 'contacts' && <ContactsView />}
        {view === 'goals' && <GoalsView />}
        {view === 'habits' && <HabitsView />}
        {view === 'finances' && <FinancesView />}
        {view === 'todos' && <TodoView />}
      </main>
    </div>
  )
}

export default App
