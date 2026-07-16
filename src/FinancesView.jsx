import { useState } from 'react'
import { getCurrency, setCurrency as saveCurrency } from './lib/localPrefs'
import { CURRENCIES } from './lib/currency'
import PersonalFinances from './PersonalFinances'
import BusinessTracker from './BusinessTracker'
import SavingsGoals from './SavingsGoals'
import RecurringExpenses from './RecurringExpenses'
import CurrencyConverter from './CurrencyConverter'

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'business', label: 'Business' },
  { key: 'savings', label: 'Savings' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'converter', label: 'Converter' },
]

export default function FinancesView() {
  const [tab, setTab] = useState('personal')
  const [currency, setCurrency] = useState(getCurrency())

  function handleCurrencyChange(e) {
    const newCurrency = e.target.value
    setCurrency(newCurrency)
    saveCurrency(newCurrency)
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Finances</h1>
        </div>
        <div className="currency-picker">
          <label>Main currency</label>
          <select value={currency} onChange={handleCurrencyChange}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
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

      {tab === 'personal' && <PersonalFinances currency={currency} />}
      {tab === 'business' && <BusinessTracker currency={currency} />}
      {tab === 'savings' && <SavingsGoals currency={currency} />}
      {tab === 'recurring' && <RecurringExpenses currency={currency} />}
      {tab === 'converter' && <CurrencyConverter currency={currency} />}
    </div>
  )
}
