// Account balance helpers (pure). Only transactions dated on/after the account start date count.
const signed = (t) => (t.type === 'income' ? 1 : -1) * Number(t.amount || 0)

export function balanceAsOf(acct, txs, asOfIso) {
  if (!acct) return null
  const start = Number(acct.starting_balance) || 0
  return start + txs.filter((t) => t.date >= acct.start_date && t.date <= asOfIso).reduce((s, t) => s + signed(t), 0)
}

// Opening = balance just before the month; closing = balance at month end (or today, for the current month).
export function monthBalances(acct, txs, monthStartIso, monthEndIso, todayIso) {
  if (!acct) return null
  if (acct.start_date > monthEndIso) return { before: true }
  const isCurrent = todayIso >= monthStartIso && todayIso <= monthEndIso
  const dayBefore = new Date(monthStartIso + 'T00:00:00')
  dayBefore.setDate(dayBefore.getDate() - 1)
  const pad = (n) => String(n).padStart(2, '0')
  const beforeIso = `${dayBefore.getFullYear()}-${pad(dayBefore.getMonth() + 1)}-${pad(dayBefore.getDate())}`
  const opening = acct.start_date > monthStartIso ? Number(acct.starting_balance) || 0 : balanceAsOf(acct, txs, beforeIso)
  // for the current month only count what has already happened (future-dated entries aren't in your account yet)
  const upTo = isCurrent && todayIso < monthEndIso ? todayIso : monthEndIso
  const inMonth = txs.filter((t) => t.date >= monthStartIso && t.date <= upTo && t.date >= acct.start_date)
  const income = inMonth.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const expenses = inMonth.filter((t) => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  return { before: false, opening, income, expenses, closing: opening + income - expenses, isCurrent, startsMidMonth: acct.start_date > monthStartIso }
}
