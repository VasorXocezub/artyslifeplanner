import { useEffect, useState } from 'react'
import { getDisplayName, setDisplayName, getHiddenModules, setHiddenModules } from './lib/localPrefs'
import Settings from './Settings'
import Dashboard from './Dashboard'
import ContactsView from './ContactsView'
import GoalsView from './GoalsView'
import HabitsView from './HabitsView'
import FinancesView from './FinancesView'
import TodoView from './TodoView'
import './App.css'

const NAV_ITEMS = [
  { key: 'home', label: 'Home', num: '00', enabled: true },
  { key: 'contacts', label: '🎂 Cake Club', num: '01', enabled: true },
  { key: 'goals', label: 'Goals', num: '02', enabled: true },
  { key: 'habits', label: 'Habits', num: '03', enabled: true },
  { key: 'finances', label: 'Finances', num: '04', enabled: true },
  { key: 'todos', label: 'To-Do', num: '05', enabled: true },
]

function App() {
  const [view, setView] = useState('home')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [displayName, setDisplayNameState] = useState(getDisplayName())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hiddenModules, setHiddenModulesState] = useState(getHiddenModules())

  useEffect(() => {
    if (hiddenModules.includes(view)) setView('home')
  }, [hiddenModules, view])

  function handleSaveName() {
    if (!nameInput.trim()) return
    setDisplayName(nameInput.trim())
    setDisplayNameState(nameInput.trim())
    setEditingName(false)
  }

  function handleSaveModules(newHidden) {
    setHiddenModules(newHidden)
    setHiddenModulesState(newHidden)
  }

  const localUser = { user_metadata: { full_name: displayName } }

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
              {displayName || 'you'}
              {' · '}
              <button
                className="name-edit-trigger"
                onClick={() => {
                  setNameInput(displayName)
                  setEditingName(true)
                }}
              >
                {displayName ? 'edit name' : 'set your name'}
              </button>
            </>
          )}
        </div>
        <button className="sidebar-settings-trigger" onClick={() => setSettingsOpen(true)}>
          ⚙ Modules
        </button>
      </aside>
      <main className="main">
        {view === 'home' && <Dashboard onNavigate={setView} user={localUser} hiddenModules={hiddenModules} />}
        {view === 'contacts' && <ContactsView />}
        {view === 'goals' && <GoalsView />}
        {view === 'habits' && <HabitsView />}
        {view === 'finances' && <FinancesView />}
        {view === 'todos' && <TodoView />}
      </main>
      {settingsOpen && (
        <Settings
          hiddenModules={hiddenModules}
          onSave={handleSaveModules}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

export default App
