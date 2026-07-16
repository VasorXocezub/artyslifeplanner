import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { CURRENCIES } from './lib/currency'
import PersonalFinances from './PersonalFinances'
import BusinessTracker from './BusinessTracker'
import SavingsGoals from './SavingsGoals'
import RecurringExpenses from './RecurringExpenses'

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'business', label: 'Business' },
  { key: 'savings', label: 'Savings' },
  { key: 'recurring', label: 'Recurring' },
]

export default function FinancesView() {
  const [tab, setTab] = useState('personal')
  const [currency, setCurrency] = useState('ZAR')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrency(data?.user?.user_metadata?.currency || 'ZAR')
      setLoaded(true)
    })
  }, [])

  async function handleCurrencyChange(e) {
    const newCurrency = e.target.value
    setCurrency(newCurrency)
    await supabase.auth.updateUser({ data: { currency: newCurrency } })
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Finances</h1>
        </div>
        {loaded && (
          <div className="currency-picker">
            <label>Main currency</label>
            <select value={currency} onChange={handleCurrencyChange}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        )}
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

      {loaded && (
        <>
          {tab === 'personal' && <PersonalFinances currency={currency} />}
          {tab === 'business' && <BusinessTracker currency={currency} />}
          {tab === 'savings' && <SavingsGoals currency={currency} />}
          {tab === 'recurring' && <RecurringExpenses currency={currency} />}
        </>
      )}
    </div>
  )
}
