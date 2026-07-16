import { useState } from 'react'
import PersonalFinances from './PersonalFinances'
import BusinessTracker from './BusinessTracker'
import SavingsGoals from './SavingsGoals'

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'business', label: 'Business' },
  { key: 'savings', label: 'Savings' },
]

export default function FinancesView() {
  const [tab, setTab] = useState('personal')

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Finances</h1>
        </div>
      </div>

      <div className="filter-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`filter-pill ${tab === t.key ? 'filter-pill-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && <PersonalFinances />}
      {tab === 'business' && <BusinessTracker />}
      {tab === 'savings' && <SavingsGoals />}
    </div>
  )
}
