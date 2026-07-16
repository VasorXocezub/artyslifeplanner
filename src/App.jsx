import { useState } from 'react'
import Dashboard from './Dashboard'
import ContactsView from './ContactsView'
import GoalsView from './GoalsView'
import HabitsView from './HabitsView'
import FinancesView from './FinancesView'
import './App.css'

const NAV_ITEMS = [
  { key: 'home', label: 'Home', num: '00', enabled: true },
  { key: 'contacts', label: 'Birthdays', num: '01', enabled: true },
  { key: 'goals', label: 'Goals', num: '02', enabled: true },
  { key: 'habits', label: 'Habits', num: '03', enabled: true },
  { key: 'finances', label: 'Finances', num: '04', enabled: true },
]

function App() {
  const [view, setView] = useState('home')

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Ledger<span className="brand-mark">.</span>
        </div>
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
      </aside>
      <main className="main">
        {view === 'home' && <Dashboard onNavigate={setView} />}
        {view === 'contacts' && <ContactsView />}
        {view === 'goals' && <GoalsView />}
        {view === 'habits' && <HabitsView />}
        {view === 'finances' && <FinancesView />}
      </main>
    </div>
  )
}

export default App
