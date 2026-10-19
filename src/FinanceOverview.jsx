import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'

function toMonthly(amount, frequency) {
  if (frequency === 'weekly') return amount * 4.33
  if (frequency === 'yearly') return amount / 12
  return amount
}

export default function FinanceOverview({ currency }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [acct, setAcct] = useState(null) // { id, starting_balance, start_date } | null
  const [balance, setBalance] = useState(null)
  const [editingBal, setEditingBal] = useState(false)
  const [balInput, setBalInput] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [balError, setBalError] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const [tx, savings, business, recurring, biz_expenses, acctRes] = await Promise.all([
      supabase.from('transactions').select('*').gte('date', monthStart).lte('date', monthEnd),
      supabase.from('savings_goals').select('*'),
      supabase.from('business_settings').select('*').limit(1).maybeSingle(),
      supabase.from('recurring_expenses').select('*').eq('active', true),
      supabase.from('business_expenses').select('*').gte('date', monthStart).lte('date', monthEnd),
      supabase.from('account_settings').select('*').limit(1).maybeSingle(),
    ])

    // acctRes.error (e.g. table not created yet) just hides the balance card's data
    const a = acctRes.error ? null : acctRes.data
    setAcct(a)
    if (a) {
      const { data: all } = await supabase.from('transactions').select('type, amount').gte('date', a.start_date)
      const delta = (all || []).reduce((sum, t) => sum + (t.type === 'income' ? 1 : -1) * Number(t.amount), 0)
      setBalance(Number(a.starting_balance) + delta)
    } else {
      setBalance(null)
    }

    if (tx.error) { setError(tx.error.message); setLoading(false); return }

    const transactions = tx.data || []
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const net = income - expenses

    const totalSaved = (savings.data || []).reduce((s, g) => s + Number(g.current_amount || 0), 0)
    const totalSavingsTarget = (savings.data || []).reduce((s, g) => s + Number(g.target_amount || 0), 0)

    const monthlyRecurring = (recurring.data || []).reduce((s, r) => s + toMonthly(Number(r.amount), r.frequency), 0)

    const bizAllowance = business.data?.monthly_allowance || 0
    const bizSpent = (biz_expenses.data || []).reduce((s, e) => s + Number(e.amount), 0)
    const bizRemaining = bizAllowance - bizSpent

    setData({
      income, expenses, net, totalSaved, totalSavingsTarget,
      monthlyRecurring, bizAllowance, bizSpent, bizRemaining,
      savingsGoalCount: (savings.data || []).length,
      hasBusiness: bizAllowance > 0,
    })
    setLoading(false)
  }

  function openBalEditor() {
    setBalInput(acct ? String(acct.starting_balance) : '')
    setDateInput(acct ? acct.start_date : new Date().toISOString().split('T')[0])
    setBalError(null)
    setEditingBal(true)
  }

  async function saveBalance() {
    const amount = parseFloat(balInput)
    if (Number.isNaN(amount)) { setBalError('Enter a number (negative is fine if you start overdrawn).'); return }
    if (!dateInput) { setBalError('Pick a start date.'); return }
    const payload = { starting_balance: amount, start_date: dateInput }
    let error
    if (acct) {
      ;({ error } = await supabase.from('account_settings').update(payload).eq('id', acct.id))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('account_settings').insert({ ...payload, user_id }))
    }
    if (error) { setBalError(error.message); return }
    setEditingBal(false)
    fetchAll()
  }

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      {loading && <p className="loading">Adding it all up… 🧮</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">Account balance</p>
            {!editingBal && acct && balance !== null && (
              <>
                <div className="goals-summary-row">
                  <span className="goals-summary-label">🏦 Balance now</span>
                  <span className="goals-summary-value">{formatMoney(balance, currency)}</span>
                </div>
                <div className="goals-summary-row">
                  <span className="goals-summary-label">🌱 Started with</span>
                  <span className="goals-summary-value">
                    {formatMoney(Number(acct.starting_balance), currency)} · {new Date(acct.start_date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <button className="btn-cancel" onClick={openBalEditor}>Edit starting balance</button>
              </>
            )}
            {!editingBal && !acct && (
              <>
                <p className="settings-danger-text">Add what's in your account today and I'll keep a running balance from your income and expenses.</p>
                <button className="btn-primary" onClick={openBalEditor}>Set starting balance</button>
              </>
            )}
            {editingBal && (
              <>
                <div className="field">
                  <label>Balance when you start tracking ({currency})</label>
                  <input type="number" step="0.01" value={balInput} onChange={e => setBalInput(e.target.value)} placeholder="0" autoFocus />
                </div>
                <div className="field">
                  <label>Tracking from</label>
                  <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} />
                </div>
                {balError && <p className="error-msg">{balError}</p>}
                <div className="settings-danger-actions">
                  <button className="btn-cancel" onClick={() => setEditingBal(false)}>Cancel</button>
                  <button className="btn-primary" onClick={saveBalance}>Save</button>
                </div>
              </>
            )}
          </div>

          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">{monthLabel.toUpperCase()} OVERVIEW</p>
            <div className="goals-summary-row">
              <span className="goals-summary-label">💰 Income</span>
              <span className="goals-summary-value">{formatMoney(data.income, currency)}</span>
            </div>
            <div className="goals-summary-row">
              <span className="goals-summary-label">💸 Expenses</span>
              <span className="goals-summary-value">{formatMoney(data.expenses, currency)}</span>
            </div>
            <div className="goals-summary-row">
              <span className="goals-summary-label">{data.net >= 0 ? '✅' : '⚠️'} Net</span>
              <span className="goals-summary-value">{formatMoney(data.net, currency)}</span>
            </div>
            <div className="goals-summary-row">
              <span className="goals-summary-label">🔁 Monthly Recurring</span>
              <span className="goals-summary-value">{formatMoney(data.monthlyRecurring, currency)}</span>
            </div>
          </div>

          <div className="calendar-card goals-summary-card">
            <p className="module-group-label">SAVINGS</p>
            <div className="goals-summary-row">
              <span className="goals-summary-label">🐷 Total Saved</span>
              <span className="goals-summary-value">{formatMoney(data.totalSaved, currency)}</span>
            </div>
            {data.totalSavingsTarget > 0 && (
              <div className="goals-summary-row">
                <span className="goals-summary-label">🎯 Total Target</span>
                <span className="goals-summary-value">{formatMoney(data.totalSavingsTarget, currency)}</span>
              </div>
            )}
            <div className="goals-summary-row">
              <span className="goals-summary-label">📦 Active Goals</span>
              <span className="goals-summary-value">{data.savingsGoalCount}</span>
            </div>
          </div>

          {data.hasBusiness && (
            <div className="calendar-card goals-summary-card">
              <p className="module-group-label">BUSINESS</p>
              <div className="goals-summary-row">
                <span className="goals-summary-label">💼 Monthly Allowance</span>
                <span className="goals-summary-value">{formatMoney(data.bizAllowance, currency)}</span>
              </div>
              <div className="goals-summary-row">
                <span className="goals-summary-label">💸 Spent This Month</span>
                <span className="goals-summary-value">{formatMoney(data.bizSpent, currency)}</span>
              </div>
              <div className="goals-summary-row">
                <span className="goals-summary-label">{data.bizRemaining >= 0 ? '✅' : '⚠️'} Remaining</span>
                <span className="goals-summary-value">{formatMoney(data.bizRemaining, currency)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
