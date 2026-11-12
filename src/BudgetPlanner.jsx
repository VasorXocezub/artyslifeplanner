import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { useFinanceCategories, saveFinanceCategory } from './lib/financeCategories'
import { plannedOf, computeCarries, csvEscape, downloadBlob, buildRows, incomeBaseFor, safeToSpend } from './lib/budgetEngine'
import { Donut, TrendBars } from './BudgetCharts'
import BudgetModals from './budget/BudgetModals'
import ImportModal from './budget/ImportModal'
import RulesModal from './budget/RulesModal'
import BudgetCalendar from './budget/BudgetCalendar'
import { loadRules } from './lib/budgetRules'
import { COLORS, round2 } from './budget/constants'
import {
  DEFAULT_SETTINGS, ymd, parseD, addDays, diffDays, fmtShort, toMonthly, lastMonday,
  describePeriod, currentKey, shiftKey,
} from './lib/budgetPeriods'

const GROUP_SUGGESTIONS = ['Needs', 'Wants', 'Savings & goals', 'Fun money']
const SORTS = [
  { key: 'custom', label: 'My order' },
  { key: 'name', label: 'A–Z' },
  { key: 'spent', label: 'Most spent' },
  { key: 'pct', label: '% used' },
  { key: 'remaining', label: 'Least left' },
]
const PERIOD_TYPES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly (every 2 weeks)' },
  { key: 'custom', label: 'Custom periods (I set the dates)' },
]
const WARN_COLOR = '#B7791F'

const emptyLine = { id: null, kind: 'expense', category: '', customCategory: false, icon: '🧾', color: COLORS[0], grp: '', planned_amount: '', rollover: false, notes: '', forward: 0, parts: [],
  amountMode: 'fixed', pct: '', fundTotal: '', fundPeriods: '', isBill: false, dueDay: '', goalId: '', rolloverMode: 'prev', carryDebt: false, rolloverCap: '', debtOn: false, debtBalance: '', debtDate: '' }
// short-lived cache for rarely-changing lookups, so flipping between periods stays quick
const memo = {}
const cached = (k, fn) => { const m = memo[k]; if (m && Date.now() - m.t < 30000) return Promise.resolve(m.v); return fn().then(v => { if (!v.error) memo[k] = { t: Date.now(), v }; return v }) }
const TEMPLATE_5030 = [
  { category: 'Needs', grp: 'Needs', icon: '🏠', color: '#E4786A', pct: 50 },
  { category: 'Wants', grp: 'Wants', icon: '🛍️', color: '#EC9A8C', pct: 30 },
  { category: 'Savings', grp: 'Savings & goals', icon: '🐷', color: '#6B7B3F', pct: 20 },
]

export default function BudgetPlanner({ currency }) {
  // whole amounts show without cents; anything with cents keeps them
  const money = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return formatMoney(v, currency, Number.isInteger(v) ? 0 : 2) }
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsRow, setSettingsRow] = useState(null)
  const [customs, setCustoms] = useState([])
  const [periodKey, setPeriodKey] = useState(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('plan') // plan | history
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [items, setItems] = useState([])
  const [prevItems, setPrevItems] = useState([])
  const [tx, setTx] = useState([])
  const [prevTx, setPrevTx] = useState([])
  const lastKey = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortKey, setSortKey] = useState('custom')
  const [expanded, setExpanded] = useState(null)
  const [modal, setModal] = useState(null) // line form or null
  const [periodModal, setPeriodModal] = useState(null) // custom period form or null
  const [rangeModal, setRangeModal] = useState(null) // date override for one monthly period
  const [saving, setSaving] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [rollItems, setRollItems] = useState([])
  const [spendRows, setSpendRows] = useState([])
  const [goals, setGoals] = useState([])
  const [payments, setPayments] = useState([])
  const [balance, setBalance] = useState(null)
  const [undo, setUndo] = useState(null) // { msg, restore }
  const undoTimer = useRef(null)
  const [importOpen, setImportOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [rules, setRules] = useState([])
  const [notifOn, setNotifOn] = useState(() => { try { return localStorage.getItem('bd-notify') === '1' } catch { return false } })
  const [recentIncome, setRecentIncome] = useState([])
  const [debtSpend, setDebtSpend] = useState({})
  const [billModal, setBillModal] = useState(null)
  const [txModal, setTxModal] = useState(null)
  const [note, setNote] = useState('')
  const [noteModal, setNoteModal] = useState(null)
  const [bizSpend, setBizSpend] = useState(0)
  const [histTx, setHistTx] = useState([])
  const [lookup, setLookup] = useState('')
  const [quick, setQuick] = useState(null) // quick-add expense
  const [jobModal, setJobModal] = useState(null) // give leftover a job
  const [recap, setRecap] = useState(false)
  const [tplModal, setTplModal] = useState(null)
  const [renameModal, setRenameModal] = useState(null)
  const [showCharts, setShowCharts] = useState(true)
  const [drag, setDrag] = useState(null)
  const [pastKeys, setPastKeys] = useState([])
  const [collapsed, setCollapsed] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('bd-collapsed') || '[]')) } catch { return new Set() } })
  const [catInput, setCatInput] = useState('')
  const { categories: knownCats, savedRows, addCategory, removeCategory, refresh: refreshCats } = useFinanceCategories()

  const period = describePeriod(periodKey, settings, customs)
  const warnPct = Math.min(100, Math.max(1, Number(settings.warn_pct) || 80))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = period ? period.start : today
  const end = period ? period.end : today
  const totalDays = Math.max(1, diffDays(start, end) + 1)
  const elapsedDays = today < start ? 0 : today > end ? totalDays : diffDays(start, today) + 1
  const daysLeft = Math.max(0, totalDays - elapsedDays)
  const inPeriod = today >= start && today <= end
  const prevKey = shiftKey(periodKey, -1, settings, customs)
  const nextKey = shiftKey(periodKey, 1, settings, customs)
  const unit = period?.type === 'weekly' ? 'week' : period?.type === 'fortnightly' ? 'fortnight' : period?.type === 'custom' ? 'period' : 'month'

  // settings + custom periods first, then pick the current period
  const loadMeta = useCallback(async (keepKey) => {
    const [sRes, cRes, oRes] = await Promise.all([
      supabase.from('budget_settings').select('*').limit(1).maybeSingle(),
      supabase.from('budget_periods').select('*').order('start_date', { ascending: true }),
      supabase.from('budget_period_overrides').select('*'),
    ])
    const overrides = {}
    ;(oRes.error ? [] : (oRes.data || [])).forEach(o => { overrides[o.period_key] = o })
    const st = { ...DEFAULT_SETTINGS, ...(sRes.error || !sRes.data ? {} : sRes.data), overrides }
    const cs = cRes.error ? [] : (cRes.data || [])
    setSettingsRow(sRes.error ? null : sRes.data)
    setSettings(st)
    setCustoms(cs)
    if (!keepKey) setPeriodKey(currentKey(st, cs))
    setReady(true)
    return { st, cs }
  }, [])

  useEffect(() => { loadMeta(false) }, [loadMeta])
  useEffect(() => { loadRules().then(setRules) }, [])

  const load = useCallback(async () => {
    if (!periodKey) { setItems([]); setTx([]); setLoading(false); return }
    // only blank the screen when moving to another period; edits refresh quietly in place
    if (lastKey.current !== periodKey) { setLoading(true); setItems([]) }
    lastKey.current = periodKey
    setError(null)
    const cur = describePeriod(periodKey, settings, customs)
    const pk = shiftKey(periodKey, -1, settings, customs)
    const prev = describePeriod(pk, settings, customs)
    const empty = Promise.resolve({ data: [], error: null })
    const soft = (q) => q.then(r => (r.error ? { data: null, error: r.error } : r), () => ({ data: null, error: true }))
    const [b, pb, t, pt, ri, gl, bp, ac, nt, bx] = await Promise.all([
      supabase.from('budget_items').select('*').eq('month', periodKey).order('created_at', { ascending: true }),
      pk ? supabase.from('budget_items').select('*').eq('month', pk) : empty,
      cur ? supabase.from('transactions').select('*').gte('date', ymd(cur.start)).lte('date', ymd(cur.end)).order('date', { ascending: false }) : empty,
      prev ? supabase.from('transactions').select('*').gte('date', ymd(prev.start)).lte('date', ymd(prev.end)) : empty,
      soft(supabase.from('budget_items').select('*').eq('rollover', true).neq('month', periodKey)),
      cached('goals', () => soft(supabase.from('savings_goals').select('id, name, icon, target_amount, current_amount'))),
      soft(supabase.from('budget_bill_payments').select('*').eq('period_key', periodKey)),
      cached('acct', () => soft(supabase.from('account_settings').select('*').limit(1).maybeSingle())),
      soft(supabase.from('budget_period_notes').select('note').eq('period_key', periodKey).maybeSingle()),
      cur ? soft(supabase.from('business_expenses').select('amount').gte('date', ymd(cur.start)).lte('date', ymd(cur.end))) : empty,
    ])
    setNote(nt.data?.note || '')
    setBizSpend((bx.data || []).reduce((a, x) => a + Number(x.amount), 0))
    if (b.error) setError(b.error.message + ' — have you run the budget SQL in Supabase?')
    setItems(b.data || [])
    setPrevItems(pb.data || [])
    setTx(t.data || [])
    setPrevTx(pt.data || [])
    setGoals(gl.data || [])
    setPayments(bp.data || [])
    const rolls = ri.data || []
    setRollItems(rolls)
    // spending for earlier periods, only if some line carries money forward
    const starts = rolls.map(r => describePeriod(r.month, settings, customs)).filter(Boolean).map(d => d.start)
    if (cur && starts.length) {
      const min = starts.reduce((m, d) => (d < m ? d : m), starts[0])
      const sp = await soft(supabase.from('transactions').select('date, amount, category').eq('type', 'expense').gte('date', ymd(min)).lt('date', ymd(cur.start)))
      setSpendRows(sp.data || [])
    } else setSpendRows([])
    if (ac.data) {
      const all = await soft(supabase.from('transactions').select('type, amount').gte('date', ac.data.start_date).lte('date', ymd(new Date())))
      setBalance(all.data ? Number(ac.data.starting_balance) + all.data.reduce((a, x) => a + (x.type === 'income' ? 1 : -1) * Number(x.amount), 0) : null)
    } else setBalance(null)
    // irregular income: what came in over the last few periods
    if (settings.income_mode && settings.income_mode !== 'planned') {
      const ds = [-1, -2, -3].map(n => describePeriod(shiftKey(periodKey, n, settings, customs), settings, customs)).filter(Boolean)
      if (ds.length) {
        const mn = ds.reduce((m, d) => (d.start < m ? d.start : m), ds[0].start), mx = ds.reduce((m, d) => (d.end > m ? d.end : m), ds[0].end)
        const ir = await soft(supabase.from('transactions').select('date, amount').eq('type', 'income').gte('date', ymd(mn)).lte('date', ymd(mx)))
        setRecentIncome(ds.map(d => (ir.data || []).filter(x => x.date >= ymd(d.start) && x.date <= ymd(d.end)).reduce((a, x) => a + Number(x.amount), 0)))
      } else setRecentIncome([])
    } else setRecentIncome([])
    // debt lines: how much has been paid since the starting date
    const debts = (b.data || []).filter(l => Number(l.debt_start_balance) > 0 && l.debt_start_date)
    if (debts.length) {
      const dmin = debts.map(l => l.debt_start_date).sort()[0]
      const dr = await soft(supabase.from('transactions').select('date, amount, category').eq('type', 'expense').gte('date', dmin))
      const map = {}
      debts.forEach(l => { map[l.id] = (dr.data || []).filter(x => x.date >= l.debt_start_date && (x.category || '').toLowerCase() === l.category.toLowerCase()).reduce((a, x) => a + Number(x.amount), 0) })
      setDebtSpend(map)
    } else setDebtSpend({})
    setLoading(false)
  }, [periodKey, settings, customs])

  useEffect(() => { if (ready) load() }, [ready, load])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    const bi = await supabase.from('budget_items').select('month, kind, planned_amount')
    if (bi.error) { setError(bi.error.message); setHistLoading(false); return }
    const keys = [...new Set([...(bi.data || []).map(r => r.month), periodKey].filter(Boolean))]
    const descs = keys.map(k => describePeriod(k, settings, customs)).filter(Boolean)
    if (!descs.length) { setHistory([]); setHistLoading(false); return }
    const min = descs.reduce((m, d) => (d.start < m ? d.start : m), descs[0].start)
    const max = descs.reduce((m, d) => (d.end > m ? d.end : m), descs[0].end)
    const t = await supabase.from('transactions').select('date, type, amount, category').gte('date', ymd(min)).lte('date', ymd(max))
    if (t.error) { setError(t.error.message); setHistLoading(false); return }
    const out = descs.map(d => {
      const s = ymd(d.start), e = ymd(d.end)
      const inRange = (t.data || []).filter(x => x.date >= s && x.date <= e)
      const planned = (kind) => (bi.data || []).filter(r => r.month === d.key && r.kind === kind).reduce((a, r) => a + Number(r.planned_amount || 0), 0)
      const actual = (kind) => inRange.filter(x => x.type === kind).reduce((a, x) => a + Number(x.amount), 0)
      return { ...d, budget: planned('expense'), spent: actual('expense'), incomePlanned: planned('income'), incomeActual: actual('income') }
    }).sort((a, b) => b.start - a.start)
    setHistTx(t.data || [])
    setHistory(out)
    setHistLoading(false)
  }, [periodKey, settings, customs])

  useEffect(() => { if (ready && view === 'history') loadHistory() }, [ready, view, loadHistory])

  const carries = useMemo(() => computeCarries(items, rollItems, spendRows, periodKey, settings, customs), [items, rollItems, spendRows, periodKey, settings, customs])
  const linkedGoals = useMemo(() => new Set(items.map(i => i.savings_goal_id).filter(Boolean)), [items])

  const incomeBase = useMemo(() => incomeBaseFor(items, settings.income_mode, recentIncome), [items, settings.income_mode, recentIncome])
  const rows = useMemo(
    () => buildRows({ items, carries, tx, prevTx, goals, payments, period, incomeBase, debtSpend }),
    [items, carries, tx, prevTx, goals, payments, period, incomeBase, debtSpend]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep the stored amount of %-of-income lines in step with income, so History stays right
  const synced = useRef({})
  useEffect(() => {
    rows.filter(r => r.pctOf > 0 && Math.abs(r.planned - (Number(r.planned_amount) || 0)) > 0.005 && synced.current[r.id] !== r.planned).forEach(r => {
      synced.current[r.id] = r.planned
      supabase.from('budget_items').update({ planned_amount: r.planned }).eq('id', r.id).then(() => {})
    })
  }, [rows])

  const expenseRows = rows.filter(r => r.kind === 'expense')
  const incomeRows = rows.filter(r => r.kind === 'income')
  const budgetedSet = new Set(expenseRows.map(r => r.category.toLowerCase()))
  const unbudgeted = useMemo(() => {
    const map = {}
    tx.filter(t => t.type === 'expense').forEach(t => {
      const c = t.category || 'Uncategorized'
      if (t.savings_goal_id && linkedGoals.has(t.savings_goal_id)) return
      if (!budgetedSet.has(c.toLowerCase())) map[c] = (map[c] || 0) + Number(t.amount)
    })
    return Object.entries(map).map(([category, actual]) => ({ category, actual })).sort((a, b) => b.actual - a.actual)
  }, [tx, items, linkedGoals]) // eslint-disable-line react-hooks/exhaustive-deps

  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0)
  const totalBudget = sum(expenseRows, 'budget')
  const totalActual = sum(expenseRows, 'actual') + sum(unbudgeted, 'actual')
  const remaining = totalBudget - totalActual
  const plannedIncome = sum(incomeRows, 'budget')
  const receivedIncome = sum(incomeRows, 'actual')
  const incomeLabel = settings.income_mode === 'lowest' ? 'lowest recent income' : settings.income_mode === 'average' ? 'average recent income' : 'planned income'
  const planIncome = settings.income_mode !== 'planned' && recentIncome.length ? incomeBase : plannedIncome
  const unallocated = planIncome - totalBudget
  const usedPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
  const paceFrac = totalDays ? elapsedDays / totalDays : 0
  const projected = elapsedDays > 0 && inPeriod ? (totalActual / elapsedDays) * totalDays : totalActual
  const dailyLeft = daysLeft > 0 ? remaining / daysLeft : null
  const safe = safeToSpend(rows, inPeriod ? daysLeft + 1 : 0) // today counts as a day you can still spend

  // early warnings, bills and projected balance
  const warnings = expenseRows.filter(r => r.budget > 0).map(r => {
    const paceTotal = inPeriod && elapsedDays >= 3 ? (r.actual / elapsedDays) * totalDays : r.actual
    if (r.actual > r.budget) return { r, kind: 'over', text: `${r.category} is ${money(r.actual - r.budget)} over` }
    if (r.pct >= warnPct) return { r, kind: 'warn', text: `${r.category} is at ${Math.round(r.pct)}%` }
    if (inPeriod && paceTotal > r.budget * 1.05) return { r, kind: 'pace', text: `${r.category} is on pace to overshoot by ~${money(paceTotal - r.budget)}` }
    return null
  }).filter(Boolean)
  const bills = rows.filter(r => r.kind === 'expense' && r.is_bill && r.due).sort((a, b) => a.due - b.due)
  const billsOpen = bills.filter(b => !b.pay)
  const stillToSpend = expenseRows.reduce((a, r) => a + Math.max(0, r.remaining), 0)
  const stillToCome = Math.max(0, plannedIncome - receivedIncome)
  const projectedBalance = balance === null ? null : balance + stillToCome - stillToSpend
  const donutSlices = (() => {
    const list = [...expenseRows.filter(r => r.actual > 0).map(r => ({ label: r.category, value: r.actual, color: r.color || COLORS[0] })), ...unbudgeted.map(u => ({ label: u.category, value: u.actual, color: '#B9A89A' }))].sort((a, b) => b.value - a.value)
    if (list.length <= 6) return list
    return [...list.slice(0, 5), { label: 'Everything else', value: list.slice(5).reduce((a, x) => a + x.value, 0), color: '#D9CBBF' }]
  })()

  const statusColor = (pct, over) => (over || pct > 100 ? 'var(--danger)' : pct >= warnPct ? WARN_COLOR : 'var(--good)')

  const groupNames = [...new Set(rows.map(r => r.grpName))]
  const existingGroups = [...new Set([...groupNames.filter(g => g !== 'Expenses' && g !== 'Income'), ...GROUP_SUGGESTIONS])]

  function sortRows(list) {
    const copy = [...list]
    const by = {
      custom: (a, b) => a.order - b.order,
      name: (a, b) => a.category.localeCompare(b.category),
      spent: (a, b) => b.actual - a.actual,
      pct: (a, b) => b.pct - a.pct,
      remaining: (a, b) => a.remaining - b.remaining,
    }[sortKey]
    return copy.sort(by)
  }

  const visible = rows.filter(r => (kindFilter === 'all' || r.kind === kindFilter) && (groupFilter === 'all' || r.grpName === groupFilter))
  const grouped = {}
  sortRows(visible.filter(r => r.kind === 'expense')).forEach(r => { (grouped[r.grpName] ||= []).push(r) })
  const incomeVisible = sortRows(visible.filter(r => r.kind === 'income'))

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(null), 3500) }

  // ----- editing -----
  function openNew(preset = {}) { setModal({ ...emptyLine, ...preset }) }
  function openEdit(r) {
    const raw = items.find(i => i.id === r.id) || r
    const mode = Number(raw.pct_of_income) > 0 ? 'pct' : Number(raw.fund_total) > 0 ? 'fund' : 'fixed'
    setModal({
      id: r.id, kind: r.kind, category: r.category, customCategory: false, icon: r.icon || '🧾', color: r.color || COLORS[0],
      grp: r.grp || '', planned_amount: String(plannedOf(raw)), rollover: !!r.rollover, notes: r.notes || '', forward: 0,
      parts: (r.parts || []).map(p => ({ name: p.name, amount: String(p.amount ?? '') })),
      amountMode: mode, pct: raw.pct_of_income ? String(raw.pct_of_income) : '', fundTotal: raw.fund_total ? String(raw.fund_total) : '', fundPeriods: raw.fund_periods ? String(raw.fund_periods) : '',
      isBill: !!raw.is_bill, dueDay: raw.due_day ? String(raw.due_day) : '', goalId: raw.savings_goal_id || '', rolloverMode: raw.rollover_mode || 'prev', carryDebt: !!raw.carry_debt,
      rolloverCap: raw.rollover_cap ? String(raw.rollover_cap) : '', debtOn: Number(raw.debt_start_balance) > 0, debtBalance: raw.debt_start_balance ? String(raw.debt_start_balance) : '', debtDate: raw.debt_start_date || '',
    })
  }

  async function saveLine(e) {
    e.preventDefault()
    const cat = modal.category.trim()
    const cleanParts = (modal.parts || []).map(p => ({ name: p.name.trim(), amount: parseFloat(p.amount) })).filter(p => p.name || !Number.isNaN(p.amount))
    if (cleanParts.some(p => !p.name || Number.isNaN(p.amount) || p.amount < 0)) { setError('Each item needs a name and an amount (0 or more) — or remove the empty row.'); return }
    const mode = modal.kind === 'income' && modal.amountMode === 'fund' ? 'fixed' : modal.amountMode
    const pctVal = parseFloat(modal.pct)
    const fundTotal = parseFloat(modal.fundTotal), fundPeriods = parseInt(modal.fundPeriods, 10)
    let amt
    if (mode === 'pct') {
      if (Number.isNaN(pctVal) || pctVal <= 0 || pctVal > 100) { setError('Enter a percentage between 1 and 100.'); return }
      const base = rows.filter(r => r.kind === 'income' && !(r.pctOf > 0)).reduce((a, r) => a + r.planned, 0)
      amt = round2(base * pctVal / 100)
    } else if (mode === 'fund') {
      if (Number.isNaN(fundTotal) || fundTotal <= 0 || Number.isNaN(fundPeriods) || fundPeriods < 1) { setError('Enter the total amount and how many periods to spread it over.'); return }
      amt = round2(fundTotal / fundPeriods)
    } else amt = cleanParts.length ? cleanParts.reduce((a, p) => a + p.amount, 0) : parseFloat(modal.planned_amount)
    if (!cat) { setError('Choose or type a category.'); return }
    if (Number.isNaN(amt) || amt < 0) { setError('Enter a budget amount (0 or more).'); return }
    if (modal.isBill && modal.kind === 'expense' && !(Number(modal.dueDay) >= 1 && Number(modal.dueDay) <= 31)) { setError('Enter the day of the month this bill is due (1–31).'); return }
    setSaving(true)
    setError(null)
    const isExp = modal.kind === 'expense'
    const base = {
      category: cat, kind: modal.kind, planned_amount: amt, items: mode === 'fixed' ? cleanParts : [], icon: modal.icon || null, color: modal.color || null,
      grp: modal.grp.trim() || null, rollover: isExp && (modal.rollover || mode === 'fund'), notes: modal.notes.trim() || null,
    }
    const v3 = {
      is_bill: isExp && !!modal.isBill, due_day: isExp && modal.isBill ? Number(modal.dueDay) : null,
      pct_of_income: mode === 'pct' ? pctVal : null, savings_goal_id: isExp && modal.goalId ? modal.goalId : null,
      fund_total: mode === 'fund' ? fundTotal : null, fund_periods: mode === 'fund' ? fundPeriods : null,
      rollover_mode: mode === 'fund' ? 'all' : modal.rolloverMode, carry_debt: isExp && !!modal.carryDebt && modal.rollover,
      rollover_cap: isExp && modal.rollover && parseFloat(modal.rolloverCap) > 0 ? parseFloat(modal.rolloverCap) : null,
      debt_start_balance: isExp && modal.debtOn ? parseFloat(modal.debtBalance) : null,
      debt_start_date: isExp && modal.debtOn ? modal.debtDate : null,
    }
    if (isExp && modal.debtOn && (!(parseFloat(modal.debtBalance) > 0) || !modal.debtDate)) { setSaving(false); setError('For a debt line, enter the balance you owe and the date it starts from.'); return }
    const usesV3 = v3.rollover_cap || v3.debt_start_balance || v3.is_bill || v3.pct_of_income || v3.savings_goal_id || v3.fund_total || v3.rollover_mode === 'all' || v3.carry_debt
    const hasV3 = items.length ? 'is_bill' in items[0] : false
    if (usesV3 || hasV3) Object.assign(base, v3)
    let err
    if (modal.id) {
      ;({ error: err } = await supabase.from('budget_items').update(base).eq('id', modal.id))
    } else {
      const user_id = await getUserId()
      const keys = [periodKey]
      for (let n = 1; n <= Number(modal.forward || 0); n++) {
        const k = shiftKey(periodKey, n, settings, customs)
        if (k) keys.push(k)
      }
      const existing = new Set(items.map(i => `${i.kind}|${i.category.toLowerCase()}`))
      const payload = keys
        .map(k => ({ ...base, user_id, month: k, sort_order: items.length + 1 }))
        .filter((p, idx) => idx > 0 || !existing.has(`${p.kind}|${p.category.toLowerCase()}`))
      if (!payload.length) { setSaving(false); setError(`${cat} is already in this month's budget — tap it to edit.`); return }
      ;({ error: err } = await supabase.from('budget_items').insert(payload))
    }
    if (!err) await addCategory(cat)
    setSaving(false)
    if (err) { setError(err.message + (/column|schema/i.test(err.message) ? ' — run budget-v3.sql in Supabase first.' : '')); return }
    setModal(null)
    load()
  }

  function showUndo(msg, restore) {
    clearTimeout(undoTimer.current)
    setUndo({ msg, restore })
    undoTimer.current = setTimeout(() => setUndo(null), 9000)
  }
  useEffect(() => () => clearTimeout(undoTimer.current), [])

  async function runUndo() {
    const u = undo
    if (!u) return
    clearTimeout(undoTimer.current)
    setUndo(null)
    try { await u.restore(); flash('Restored') } catch (e) { setError('Could not undo: ' + (e.message || e)) }
    await loadMeta(true)
    load()
  }

  async function deleteLine() {
    if (!modal?.id) return
    const row = items.find(i => i.id === modal.id)
    const pays = await supabase.from('budget_bill_payments').select('*').eq('item_id', modal.id)
    const { error: err } = await supabase.from('budget_items').delete().eq('id', modal.id)
    if (err) { setError(err.message); return }
    setModal(null)
    if (row) showUndo(`Removed ${row.category}`, async () => {
      const { error: e2 } = await supabase.from('budget_items').insert(row); if (e2) throw e2
      if (pays.data?.length) { const { error: e3 } = await supabase.from('budget_bill_payments').insert(pays.data); if (e3) throw e3 }
    })
    load()
  }

  async function move(r, dir) {
    const list = sortRows(rows.filter(x => x.kind === r.kind && x.grpName === r.grpName))
    const i = list.findIndex(x => x.id === r.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i], b = list[j]
    const [ra, rb] = await Promise.all([
      supabase.from('budget_items').update({ sort_order: b.order }).eq('id', a.id),
      supabase.from('budget_items').update({ sort_order: a.order === b.order ? a.order + dir : a.order }).eq('id', b.id),
    ])
    if (ra.error || rb.error) setError((ra.error || rb.error).message)
    load()
  }

  // ----- quick-fill tools -----
  async function bulkInsert(lines, okMsg) {
    const have = new Set(items.map(i => `${i.kind}|${i.category.toLowerCase()}`))
    const user_id = await getUserId()
    const add = lines.filter(l => !have.has(`${l.kind}|${l.category.toLowerCase()}`) && l.planned_amount > 0)
      .map((l, n) => ({ user_id, month: periodKey, sort_order: items.length + n + 1, ...l }))
    if (!add.length) { flash('Nothing new to add.'); return }
    const { error: err } = await supabase.from('budget_items').insert(add)
    if (err) { setError(err.message); return }
    flash(`${okMsg} (${add.length} added)`)
    load()
  }

  const stripRow = ({ id, user_id, created_at, month, ...rest }) => rest // eslint-disable-line no-unused-vars
  async function copyFromLast() {
    await bulkInsert(prevItems.map(stripRow), `Copied from previous ${unit}`)
  }

  async function copyFromKey(k) {
    const { data, error: err } = await supabase.from('budget_items').select('*').eq('month', k)
    if (err) { setError(err.message); return }
    setTplModal(null)
    await bulkInsert((data || []).map(stripRow), `Copied from ${describePeriod(k, settings, customs)?.label || 'that period'}`)
  }

  async function apply5030() {
    if (plannedIncome <= 0) { setError('Add an income line first (your expected pay) — the 50/30/20 split is worked out from it.'); return }
    setTplModal(null)
    await bulkInsert(TEMPLATE_5030.map(({ pct, ...l }) => ({ ...l, kind: 'expense', planned_amount: round2(plannedIncome * pct / 100), pct_of_income: pct })), 'Added a 50/30/20 starter')
  }

  async function openTemplates() {
    setTplModal({ loading: true })
    const { data } = await supabase.from('budget_items').select('month').neq('month', periodKey)
    const keys = [...new Set((data || []).map(r => r.month))].map(k => describePeriod(k, settings, customs)).filter(Boolean).sort((a, b) => b.start - a.start)
    setPastKeys(keys)
    setTplModal({ loading: false })
  }

  async function importRecurring() {
    const { data, error: err } = await supabase.from('recurring_expenses').select('*').or('active.is.null,active.eq.true')
    if (err) { setError(err.message); return }
    const factor = period?.type === 'monthly' ? 1 : totalDays / 30.44
    const map = {}
    ;(data || []).forEach(r => {
      const c = r.category || 'Recurring'
      const amt = round2(toMonthly(Number(r.amount), r.frequency) * factor)
      const g = (map[c] ||= { parts: [], days: [] })
      g.parts.push({ name: r.name || c, amount: amt })
      if (r.next_due && r.frequency === 'monthly') g.days.push(parseD(r.next_due).getDate())
    })
    await bulkInsert(Object.entries(map).map(([category, g]) => {
      const total = round2(g.parts.reduce((a, p) => a + p.amount, 0))
      const day = g.days.length ? Math.min(...g.days) : null
      const line = { category, kind: 'expense', planned_amount: total, grp: 'Needs', items: g.parts.length > 1 ? g.parts : [] }
      if (day) { line.is_bill = true; line.due_day = day }
      return line
    }), 'Imported recurring (monthly ones with a due date became bills)')
  }

  async function fillFromAverage() {
    const keys = [-1, -2, -3].map(n => shiftKey(periodKey, n, settings, customs)).filter(Boolean)
    const descs = keys.map(k => describePeriod(k, settings, customs)).filter(Boolean)
    if (!descs.length) { flash('No earlier periods to average yet.'); return }
    const results = await Promise.all(descs.map(d => supabase.from('transactions').select('amount, category').eq('type', 'expense').gte('date', ymd(d.start)).lte('date', ymd(d.end))))
    const bad = results.find(r => r.error)
    if (bad) { setError(bad.error.message); return }
    const map = {}
    results.forEach(r => (r.data || []).forEach(t => { const c = t.category || 'Uncategorized'; map[c] = (map[c] || 0) + Number(t.amount) }))
    await bulkInsert(Object.entries(map).map(([category, total]) => ({ category, kind: 'expense', planned_amount: Math.ceil(total / descs.length / 10) * 10 })), `Filled from your ${descs.length}-${unit} average`)
  }

  // ----- bill reminders (browser notifications, only while the app is open) -----
  async function toggleNotify() {
    if (notifOn) { setNotifOn(false); try { localStorage.setItem('bd-notify', '0') } catch { /* private mode */ } return }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (perm !== 'granted') { setError('Notifications are blocked in this browser. Allow them for this site and try again.'); return }
    setNotifOn(true)
    try { localStorage.setItem('bd-notify', '1') } catch { /* private mode */ }
    flash('Bill reminders on — you’ll get a nudge when you open the app and a bill is due soon')
  }
  useEffect(() => {
    if (!notifOn || typeof Notification === 'undefined' || Notification.permission !== 'granted' || !bills.length) return
    const soon = bills.filter(b => !b.pay && Math.round((b.due - today) / 864e5) <= 2)
    if (!soon.length) return
    try {
      const stamp = ymd(today)
      if (localStorage.getItem('bd-notified') === stamp) return
      localStorage.setItem('bd-notified', stamp)
    } catch { /* ignore */ }
    new Notification('Bills due soon 💸', { body: soon.map(b => `${b.category} ${b.due < today ? '(overdue)' : fmtShort(b.due)}`).join(', ') })
  }, [notifOn, bills.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ----- period note -----
  async function saveNote(e) {
    e.preventDefault()
    const text = noteModal.text.trim()
    setSaving(true); setError(null)
    await supabase.from('budget_period_notes').delete().eq('period_key', periodKey)
    let err = null
    if (text) { const user_id = await getUserId(); ;({ error: err } = await supabase.from('budget_period_notes').insert({ user_id, period_key: periodKey, note: text })) }
    setSaving(false)
    if (err) { setError(err.message + ' — run budget-v4.sql in Supabase first.'); return }
    setNoteModal(null); setNote(text)
  }

  // ----- edit a transaction from inside the budget -----
  function openTx(t) { setTxModal({ id: t.id, amount: String(t.amount), date: t.date, category: t.category || '', notes: t.notes || '', item: t.budget_item || '', hadItem: !!t.budget_item, type: t.type }) }
  async function saveTx(e) {
    e.preventDefault()
    if (txModal.split) return saveSplit()
    const amt = parseFloat(txModal.amount)
    if (Number.isNaN(amt) || amt <= 0 || !txModal.date) { setError('Enter an amount above 0 and a date.'); return }
    setSaving(true); setError(null)
    const patch = { amount: amt, date: txModal.date, category: txModal.category.trim() || null, notes: txModal.notes.trim() || null }
    if (txModal.item) patch.budget_item = txModal.item
    else if (txModal.hadItem) patch.budget_item = null
    const { error: err } = await supabase.from('transactions').update(patch).eq('id', txModal.id)
    if (!err && patch.category) await saveFinanceCategory(patch.category)
    setSaving(false)
    if (err) { setError(err.message); return }
    setTxModal(null); load()
  }
  async function saveSplit() {
    const total = parseFloat(txModal.amount)
    const parts = txModal.split.map(p => ({ category: p.category.trim(), amount: parseFloat(p.amount) }))
    if (parts.length < 2 || parts.some(p => Number.isNaN(p.amount) || p.amount <= 0)) { setError('Give every part an amount above 0.'); return }
    const sum = parts.reduce((a, p) => a + p.amount, 0)
    if (Math.abs(sum - total) > 0.005) { setError(`The parts add up to ${money(sum)} but the transaction is ${money(total)}.`); return }
    setSaving(true); setError(null)
    const orig = tx.find(x => x.id === txModal.id)
    const user_id = await getUserId()
    const { error: e1 } = await supabase.from('transactions').update({ amount: parts[0].amount, category: parts[0].category || null }).eq('id', txModal.id)
    if (e1) { setSaving(false); setError(e1.message); return }
    const extra = parts.slice(1).map(p => ({ user_id, date: txModal.date, type: txModal.type, amount: p.amount, category: p.category || null, notes: txModal.notes.trim() || null }))
    const { error: e2 } = await supabase.from('transactions').insert(extra)
    if (e2) { await supabase.from('transactions').update({ amount: Number(orig?.amount ?? total), category: orig?.category ?? null }).eq('id', txModal.id); setSaving(false); setError(e2.message); return }
    for (const p of parts) if (p.category) await saveFinanceCategory(p.category)
    setSaving(false); setTxModal(null); flash(`Split into ${parts.length}`); load()
  }
  async function deleteTx() {
    const t = tx.find(x => x.id === txModal.id)
    const { error: err } = await supabase.from('transactions').delete().eq('id', txModal.id)
    if (err) { setError(err.message); return }
    setTxModal(null)
    if (t) showUndo('Transaction deleted', async () => { const { error: e2 } = await supabase.from('transactions').insert(t); if (e2) throw e2 })
    load()
  }

  // ----- bills -----
  function askBill(r) {
    if (r.pay) { toggleBill(r); return }
    setBillModal({ r, amount: String(r.planned), date: ymd(inPeriod ? today : (r.due || start)) })
  }
  async function payBill(e) {
    e.preventDefault()
    const amt = parseFloat(billModal.amount)
    if (Number.isNaN(amt) || amt <= 0) { setError('Enter the amount you paid.'); return }
    const m = billModal
    setBillModal(null)
    await toggleBill(m.r, { amount: amt, date: m.date })
  }
  async function toggleBill(r, paid) {
    setError(null)
    if (r.pay) {
      if (r.pay.tx_id) { const { error: e1 } = await supabase.from('transactions').delete().eq('id', r.pay.tx_id); if (e1) { setError(e1.message); return } }
      const { error: e2 } = await supabase.from('budget_bill_payments').delete().eq('id', r.pay.id)
      if (e2) { setError(e2.message); return }
    } else {
      const user_id = await getUserId()
      const date = paid?.date || (inPeriod ? ymd(today) : ymd(r.due || start))
      const payAmt = paid?.amount ?? r.planned
      const { data: t, error: e1 } = await supabase.from('transactions').insert({ user_id, date, amount: payAmt, type: 'expense', category: r.category, notes: `Paid: ${r.category}` }).select().single()
      if (e1) { setError(e1.message); return }
      const { error: e2 } = await supabase.from('budget_bill_payments').insert({ user_id, item_id: r.id, period_key: periodKey, tx_id: t.id, amount: payAmt, paid_on: date })
      if (e2) { await supabase.from('transactions').delete().eq('id', t.id); setError(e2.message + ' — run budget-v3.sql in Supabase first.'); return }
    }
    load()
  }

  // ----- quick add expense -----
  function openQuick(r) { setQuick({ r, amount: '', date: ymd(inPeriod ? today : (end < today ? end : start)), item: '', notes: '' }) }
  async function saveQuick(e) {
    e.preventDefault()
    const amt = parseFloat(quick.amount)
    if (Number.isNaN(amt) || amt <= 0) { setError('Enter an amount above 0.'); return }
    setSaving(true); setError(null)
    const user_id = await getUserId()
    const row = { user_id, date: quick.date, amount: amt, type: quick.r.kind, category: quick.r.category, notes: quick.notes.trim() || null }
    if (quick.item) row.budget_item = quick.item
    if (quick.r.savings_goal_id) row.savings_goal_id = quick.r.savings_goal_id
    const { error: err } = await supabase.from('transactions').insert(row)
    if (!err && quick.r.savings_goal_id && quick.r.goal) {
      await supabase.from('savings_goals').update({ current_amount: Number(quick.r.goal.current_amount) + amt }).eq('id', quick.r.goal.id)
    }
    delete memo.goals
    setSaving(false)
    if (err) { setError(err.message + (/budget_item/.test(err.message) ? ' — run budget-v3.sql in Supabase first.' : '')); return }
    setQuick(null)
    flash(`Logged ${money(amt)} to ${quick.r.category}`)
    load()
  }

  // ----- give every rand a job -----
  function openJob() { setJobModal({ amount: String(round2(unallocated)), target: expenseRows.find(r => !(r.pctOf > 0))?.id || '__new' }) }
  async function saveJob(e) {
    e.preventDefault()
    const amt = parseFloat(jobModal.amount)
    if (Number.isNaN(amt) || amt <= 0) { setError('Enter an amount above 0.'); return }
    if (jobModal.target === '__new') { setJobModal(null); openNew({ planned_amount: String(amt) }); return }
    const r = rows.find(x => x.id === jobModal.target)
    const raw = items.find(i => i.id === jobModal.target)
    if (!r || !raw) return
    setError(null)
    const patch = r.parts.length
      ? { items: [...r.parts, { name: 'Extra', amount: amt }], planned_amount: r.planned + amt }
      : { planned_amount: round2(plannedOf(raw) + amt) }
    const { error: err } = await supabase.from('budget_items').update(patch).eq('id', r.id)
    if (err) { setError(err.message); return }
    setJobModal(null)
    flash(`${money(amt)} now has a job: ${r.category} 💅`)
    load()
  }

  // ----- rename / merge a category everywhere -----
  async function renameCategory(e) {
    e.preventDefault()
    const from = renameModal.from, to = renameModal.to.trim()
    if (!to || to === from) { setRenameModal(null); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.rpc('rename_finance_category', { p_from: from, p_to: to })
    setSaving(false)
    if (err) { setError(err.message + (/function|schema cache/i.test(err.message) ? ' — run budget-v4.sql in Supabase first.' : '')); return }
    setRenameModal(null)
    await refreshCats()
    flash(`${from} → ${to} everywhere`)
    load()
  }

  // ----- collapsible groups -----
  function toggleGroup(g) {
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(g)) n.delete(g); else n.add(g)
      try { localStorage.setItem('bd-collapsed', JSON.stringify([...n])) } catch { /* private mode */ }
      return n
    })
  }

  // ----- drag to reorder (pointer events so touch works) -----
  function startDrag(e, r) {
    e.preventDefault(); e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    setDrag({ id: r.id, overId: r.id })
  }
  function moveDrag(e) {
    if (!drag) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-bd-id]')
    const id = el?.getAttribute('data-bd-id')
    if (id && id !== drag.overId) setDrag(d => ({ ...d, overId: id }))
  }
  async function endDrag() {
    const d = drag
    setDrag(null)
    if (!d || d.id === d.overId) return
    const dragged = rows.find(r => r.id === d.id), over = rows.find(r => r.id === d.overId)
    if (!dragged || !over || dragged.kind !== over.kind) return
    const list = rows.filter(r => r.kind === over.kind && r.grpName === over.grpName && r.id !== dragged.id).sort((a, b) => a.order - b.order)
    const at = list.findIndex(r => r.id === over.id)
    const movingDown = dragged.grpName === over.grpName && dragged.order < over.order
    list.splice(at + (movingDown ? 1 : 0), 0, dragged)
    const changes = list.map((r, n) => ({ r, n: n + 1 })).filter(({ r, n }) => r.order !== n || r.id === dragged.id)
    const results = await Promise.all(changes.map(({ r, n }) =>
      supabase.from('budget_items').update(r.id === dragged.id ? { sort_order: n, grp: over.kind === 'income' ? dragged.grp : (over.grp || null) } : { sort_order: n }).eq('id', r.id)))
    const bad = results.find(x => x.error)
    if (bad) setError(bad.error.message)
    load()
  }

  // ----- export -----
  function exportCsv() {
    const lines = [['Group', 'Type', 'Category', 'Item', 'Budget', 'Actual', 'Remaining']]
    rows.forEach(r => {
      lines.push([r.grpName, r.kind, r.category, '', r.budget, r.actual, r.remaining])
      r.parts.forEach(p => lines.push([r.grpName, r.kind, r.category, p.name, p.amount, r.lineTx.filter(t => t.budget_item === p.name).reduce((a, t) => a + Number(t.amount), 0), '']))
    })
    unbudgeted.forEach(u => lines.push(['Unbudgeted', 'expense', u.category, '', 0, u.actual, -u.actual]))
    downloadBlob(`budget-${(period?.label || 'period').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, new Blob([lines.map(l => l.map(csvEscape).join(',')).join('\n')], { type: 'text/csv' }))
  }

  function exportPng() {
    const W = 1080, rowsShown = [...expenseRows].sort((a, b) => b.actual - a.actual).slice(0, 8)
    const H = 420 + rowsShown.length * 78
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d')
    if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h) }
    g.fillStyle = '#F4E8DF'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#4E3420'; g.font = '700 54px system-ui, sans-serif'; g.fillText('My budget', 60, 100)
    g.fillStyle = '#8A6C55'; g.font = '500 30px system-ui, sans-serif'; g.fillText(`${period?.label || ''} · ${period?.sub || ''}`, 60, 148)
    g.fillStyle = '#FFFBF8'; g.beginPath(); g.roundRect(60, 190, W - 120, 150, 28); g.fill()
    const cols = [['Budget', money(totalBudget), '#4E3420'], ['Spent', money(totalActual), '#4E3420'], [remaining >= 0 ? 'Left' : 'Over by', money(Math.abs(remaining)), remaining >= 0 ? '#6B7B3F' : '#C0392B']]
    cols.forEach(([l, v, col], i) => { const x = 100 + i * 320; g.fillStyle = '#8A6C55'; g.font = '500 26px system-ui, sans-serif'; g.fillText(l, x, 245); g.fillStyle = col; g.font = '700 46px system-ui, sans-serif'; g.fillText(v, x, 305) })
    rowsShown.forEach((r, i) => {
      const y = 390 + i * 78
      g.fillStyle = '#4E3420'; g.font = '600 28px system-ui, sans-serif'; g.fillText(r.category, 60, y)
      g.textAlign = 'right'; g.fillStyle = '#8A6C55'; g.font = '500 26px system-ui, sans-serif'; g.fillText(`${money(r.actual)} / ${money(r.budget)}`, W - 60, y); g.textAlign = 'left'
      g.fillStyle = '#E8D6C8'; g.beginPath(); g.roundRect(60, y + 16, W - 120, 16, 8); g.fill()
      g.fillStyle = r.actual > r.budget ? '#C0392B' : (r.color || '#DC6A59'); g.beginPath(); g.roundRect(60, y + 16, Math.max(16, (W - 120) * Math.min(1, r.pct / 100)), 16, 8); g.fill()
    })
    c.toBlob(b => { if (b) downloadBlob('budget-summary.png', b); else setError('Your browser could not create the image — try Print / save as PDF instead.') }, 'image/png')
  }

  async function saveSettings(patch, { resetPeriod = false } = {}) {
    const next = { ...settings, ...patch }
    setSettings(next)
    const payload = {
      period_type: next.period_type, month_start_day: Number(next.month_start_day) || 1,
      anchor_date: next.anchor_date || null, warn_pct: Number(next.warn_pct) || 80,
    }
    if (next.income_mode !== 'planned' || (settingsRow && 'income_mode' in settingsRow)) payload.income_mode = next.income_mode || 'planned'
    let err
    if (settingsRow) ({ error: err } = await supabase.from('budget_settings').update(payload).eq('id', settingsRow.id))
    else {
      const user_id = await getUserId()
      const res = await supabase.from('budget_settings').insert({ ...payload, user_id }).select().single()
      err = res.error
      if (!err) setSettingsRow(res.data)
    }
    if (err) { setError(err.message + ' — have you run the budget SQL in Supabase?'); return }
    if (resetPeriod) setPeriodKey(currentKey(next, customs))
  }

  // ----- custom dates for one monthly period -----
  function openRange(p) { setRangeModal({ key: p.key, start_date: ymd(p.start), end_date: ymd(p.end), hasOverride: !!p.custom }) }

  async function saveRange(e) {
    e.preventDefault()
    if (!rangeModal.start_date || !rangeModal.end_date || rangeModal.end_date < rangeModal.start_date) { setError('The end date must be on or after the start date.'); return }
    setSaving(true)
    setError(null)
    await supabase.from('budget_period_overrides').delete().eq('period_key', rangeModal.key)
    const user_id = await getUserId()
    const { error: err } = await supabase.from('budget_period_overrides').insert({ user_id, period_key: rangeModal.key, start_date: rangeModal.start_date, end_date: rangeModal.end_date })
    setSaving(false)
    if (err) { setError(err.message + ' — have you run the budget SQL in Supabase?'); return }
    setRangeModal(null)
    await loadMeta(true)
  }

  async function resetRange() {
    const { error: err } = await supabase.from('budget_period_overrides').delete().eq('period_key', rangeModal.key)
    if (err) { setError(err.message); return }
    setRangeModal(null)
    await loadMeta(true)
  }

  // ----- custom periods -----
  function openPeriod(p) {
    if (p) { setPeriodModal({ id: p.id, name: p.name, start_date: p.start_date, end_date: p.end_date }); return }
    const last = [...customs].sort((a, b) => a.end_date.localeCompare(b.end_date)).pop()
    const st = last ? addDays(parseD(last.end_date), 1) : new Date()
    const len = last ? diffDays(parseD(last.start_date), parseD(last.end_date)) : 29
    setPeriodModal({ id: null, name: '', start_date: ymd(st), end_date: ymd(addDays(st, len)) })
  }

  async function savePeriod(e) {
    e.preventDefault()
    const name = periodModal.name.trim()
    if (!name) { setError('Give the period a name (e.g. "Holiday trip" or "Pay cycle 3").'); return }
    if (!periodModal.start_date || !periodModal.end_date || periodModal.end_date < periodModal.start_date) { setError('The end date must be on or after the start date.'); return }
    setSaving(true)
    setError(null)
    const payload = { name, start_date: periodModal.start_date, end_date: periodModal.end_date }
    let err, newId = periodModal.id
    if (periodModal.id) ({ error: err } = await supabase.from('budget_periods').update(payload).eq('id', periodModal.id))
    else {
      const user_id = await getUserId()
      const res = await supabase.from('budget_periods').insert({ ...payload, user_id }).select().single()
      err = res.error
      newId = res.data?.id
    }
    setSaving(false)
    if (err) { setError(err.message + ' — have you run the budget SQL in Supabase?'); return }
    setPeriodModal(null)
    const { st, cs } = await loadMeta(true)
    if (newId) setPeriodKey('C:' + newId)
    else setPeriodKey(currentKey(st, cs))
  }

  async function deletePeriod() {
    if (!periodModal?.id) return
    const key = 'C:' + periodModal.id
    const row = customs.find(c => c.id === periodModal.id)
    const { data: its } = await supabase.from('budget_items').select('*').eq('month', key)
    const { error: e1 } = await supabase.from('budget_items').delete().eq('month', key)
    if (e1) { setError(e1.message); return }
    const { error: err } = await supabase.from('budget_periods').delete().eq('id', periodModal.id)
    if (err) { setError(err.message); return }
    setPeriodModal(null)
    if (row) showUndo(`Deleted ${row.name}`, async () => {
      const { error: e2 } = await supabase.from('budget_periods').insert(row); if (e2) throw e2
      if (its?.length) { const { error: e3 } = await supabase.from('budget_items').insert(its); if (e3) throw e3 }
    })
    const { st, cs } = await loadMeta(true)
    setPeriodKey(currentKey(st, cs))
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    const name = catInput.trim()
    if (!name) return
    const { error: err } = await addCategory(name)
    if (err) setError(err.message)
    else setCatInput('')
  }

  const monthLabel = period ? period.label : 'Budget'

  // ----- render pieces -----
  function renderRow(r) {
    const isIncome = r.kind === 'income'
    const over = !isIncome && r.actual > r.budget
    const color = isIncome ? 'var(--good)' : statusColor(r.pct, over)
    const accent = r.color || COLORS[0]
    const barPct = Math.min(100, r.pct === 999 ? 100 : r.pct)
    const open = expanded === r.id
    const catTx = r.lineTx
    const leftText = isIncome
      ? (r.actual === r.budget ? '✓ received' : r.actual > r.budget ? `${money(r.actual - r.budget)} above` : `${money(r.budget - r.actual)} to go`)
      : over ? `${money(r.actual - r.budget)} over` : `${money(r.remaining)} left`
    const dragging = drag?.id === r.id, dropTarget = drag && drag.overId === r.id && drag.id !== r.id
    const delta = r.prevActual > 0 ? ((r.actual - r.prevActual) / r.prevActual) * 100 : null
    return (
      <div key={r.id} data-bd-id={r.id} className={`bd-row ${open ? 'bd-row-open' : ''} ${dragging ? 'bd-dragging' : ''} ${dropTarget ? 'bd-drop' : ''}`}>
        <div className="bd-row-line">
          {sortKey === 'custom' && (
            <button type="button" className="bd-handle" aria-label={`Reorder ${r.category}: drag, or press the up and down arrow keys`} title="Drag to reorder"
              onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); move(r, e.key === 'ArrowUp' ? -1 : 1) } }}
              onPointerDown={e => startDrag(e, r)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>⋮⋮</button>
          )}
          <button type="button" className="bd-row-main" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open}>
            <span className="bd-icon" style={{ background: accent + '2E' }}>{r.icon || '🧾'}</span>
            <span className="bd-row-body">
              <span className="bd-row-top">
                <span className="bd-name">{r.category}{r.parts.length > 0 ? <span className="bd-dim"> · {r.parts.length} items</span> : null}{r.carry !== 0 ? <span className="bd-dim" title={`${r.carry > 0 ? '+' : ''}${money(r.carry)} rolled over`}> ↻</span> : null}{r.pctOf > 0 ? <span className="bd-dim"> · {r.pctOf}%</span> : null}{r.fund_total > 0 ? <span className="bd-dim"> · fund</span> : null}{r.goal ? <span className="bd-dim"> · {r.goal.icon || '💰'} goal</span> : null}</span>
                <span className="bd-amounts">{money(r.actual)}<span className="bd-dim"> / {money(r.budget)}</span></span>
              </span>
              <span className="bd-row-bar">
                <span className="bd-bar" aria-hidden="true">
                  <span className="bd-bar-fill" style={{ width: `${barPct}%`, background: color }} />
                  {inPeriod && !isIncome && <span className="bd-bar-pace" style={{ left: `${paceFrac * 100}%` }} />}
                </span>
                <span className="bd-left" style={{ color }}>{leftText}</span>
              </span>
            </span>
          </button>
          <button type="button" className="bd-quick" onClick={() => openQuick(r)} aria-label={`Log ${isIncome ? 'income' : 'an expense'} for ${r.category}`} title={isIncome ? 'Log income' : 'Log an expense'}>＋</button>
        </div>
        {open && (
          <div className="bd-detail">
            {r.parts.length > 0 && (() => {
              const used = new Set()
              const partRows = r.parts.map(p => {
                const key = p.name.toLowerCase()
                const hits = catTx.filter(t => !used.has(t.id) && (t.budget_item ? t.budget_item.toLowerCase() === key : (t.notes || '').toLowerCase().includes(key)))
                hits.forEach(t => used.add(t.id))
                return { ...p, spent: hits.reduce((a, t) => a + Number(t.amount), 0) }
              })
              const rest = catTx.filter(t => !used.has(t.id)).reduce((a, t) => a + Number(t.amount), 0)
              return (
                <div className="bd-parts">
                  {partRows.map((p, i) => (
                    <div key={i} className="bd-part">
                      <span>{p.name}</span>
                      <span>{p.spent > 0 ? <><strong>{money(p.spent)}</strong><span className="bd-dim"> / {money(Number(p.amount))}</span></> : <span className="bd-dim">{money(Number(p.amount))}</span>}</span>
                    </div>
                  ))}
                  {rest > 0 && <div className="bd-part"><span className="bd-dim">Not matched to an item</span><span className="bd-dim">{money(rest)}</span></div>}
                </div>
              )
            })()}
            {r.notes && <p className="bd-note">📝 {r.notes}</p>}
            {r.carry !== 0 && <p className="bd-dim bd-note">↻ {r.carry > 0 ? `Includes ${money(r.carry)} rolled over` : `${money(-r.carry)} overspend carried into this ${unit}`}</p>}
            {r.fund_total > 0 && <p className="bd-dim bd-note">🐖 Sinking fund: {money(Math.max(0, r.budget - r.actual))} saved of {money(Number(r.fund_total))}{r.fundDone ? ' · fully funded 🎉' : ` · ${money(r.planned)} per ${unit}`}</p>}
            {r.goal && <p className="bd-dim bd-note">{r.goal.icon || '💰'} {r.goal.name}: {money(Number(r.goal.current_amount))} of {money(Number(r.goal.target_amount))} saved</p>}
            {r.debtLeft !== null && <p className="bd-dim bd-note">💳 {money(r.debtLeft)} still owed (of {money(Number(r.debt_start_balance))}){r.debtLeft === 0 ? ' · debt-free 🎉' : r.planned > 0 ? ` · debt-free by ${addDays(new Date(), Math.ceil(r.debtLeft / r.planned) * (period ? Math.max(1, diffDays(period.start, period.end) + 1) : 30)).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })} at this pace` : ''}</p>}
            {r.is_bill && r.due && <p className="bd-dim bd-note">🧾 Due {fmtShort(r.due)}{r.pay ? ' · paid ✓' : ''}</p>}
            {delta !== null && !isIncome && <p className="bd-dim bd-note">vs previous {unit}: {money(r.prevActual)} → <strong style={{ color: delta > 10 ? 'var(--danger)' : delta < -10 ? 'var(--good)' : undefined }}>{delta > 0 ? '+' : ''}{Math.round(delta)}%</strong></p>}
            {catTx.length === 0 ? <p className="bd-dim bd-note">Nothing logged here this period yet.</p> : (
              <ul className="bd-tx">
                {catTx.slice(0, 6).map(t => (
                  <li key={t.id}><button type="button" className="bd-txbtn" onClick={() => openTx(t)} title="Edit this transaction"><span>{fmtShort(new Date(t.date + 'T00:00:00'))}{t.budget_item ? ` · ${t.budget_item}` : ''}{t.notes ? ` · ${t.notes}` : ''}</span><strong>{money(Number(t.amount))} ✎</strong></button></li>
                ))}
                {catTx.length > 6 && <li className="bd-dim">+ {catTx.length - 6} more</li>}
              </ul>
            )}
            <div className="bd-detail-actions">
              {sortKey === 'custom' && <>
                <button type="button" className="bd-mini" onClick={() => move(r, -1)} aria-label="Move up">↑</button>
                <button type="button" className="bd-mini" onClick={() => move(r, 1)} aria-label="Move down">↓</button>
              </>}
              <button type="button" className="bd-mini bd-mini-primary" onClick={() => openEdit(r)}>Edit</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderGroup(g, list, isIncome) {
    const st = groupSubtotal(list)
    const shut = collapsed.has((isIncome ? 'i:' : 'e:') + g)
    return (
      <section key={(isIncome ? 'i:' : 'e:') + g} className="bd-group">
        <button type="button" className="bd-group-head bd-group-toggle" onClick={() => toggleGroup((isIncome ? 'i:' : 'e:') + g)} aria-expanded={!shut}>
          <h3><span className="bd-chev">{shut ? '▸' : '▾'}</span> {g}</h3>
          <span className="bd-dim">{money(st.a)} of {money(st.b)}</span>
        </button>
        {!shut && <div className="bd-card">{list.map(renderRow)}</div>}
      </section>
    )
  }

  const modalProps = { apply5030, billModal, copyFromKey, copyFromLast, deleteLine, deletePeriod, deleteTx, end, existingGroups, expenseRows, exportPng, goals, jobModal, knownCats, modal, money, noteModal, pastKeys, payBill, period, periodModal, plannedIncome, prevItems, quick, rangeModal, recap, receivedIncome, remaining, renameCategory, renameModal, resetRange, rows, runUndo, saveJob, saveLine, saveNote, savePeriod, saveQuick, saveRange, saveTx, saving, setBillModal, setJobModal, setModal, setNoteModal, setPeriodModal, setQuick, setRangeModal, setRecap, setRenameModal, setTplModal, setTxModal, setUndo, today, tplModal, totalActual, totalBudget, txModal, unallocated, undo, undoTimer, unit, currency }

  const groupSubtotal = (list) => ({ b: sum(list, 'budget'), a: sum(list, 'actual') })

  return (
    <div className="bd">
      <div className="bd-viewtabs filter-row">
        <button className={`filter-pill ${view === 'plan' ? 'filter-pill-active' : ''}`} onClick={() => setView('plan')}>Plan</button>
        <button className={`filter-pill ${view === 'calendar' ? 'filter-pill-active' : ''}`} onClick={() => setView('calendar')}>Calendar</button>
        <button className={`filter-pill ${view === 'history' ? 'filter-pill-active' : ''}`} onClick={() => setView('history')}>History</button>
      </div>

      {(view === 'plan' || view === 'calendar') && (
        <div className="bd-nav">
          <button className="btn-cancel" disabled={!prevKey} onClick={() => prevKey && setPeriodKey(prevKey)} aria-label={`Previous ${unit}`}>←</button>
          <div className="bd-nav-label">
            <strong>{period ? period.label : 'No budget period yet'}</strong>
            {period && <span className="bd-dim">{period.sub}{inPeriod ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}</span>}
            <span className="bd-nav-links">
              {periodKey !== currentKey(settings, customs) && <button type="button" className="bd-link" onClick={() => setPeriodKey(currentKey(settings, customs))}>Jump to current</button>}
              {period?.type === 'custom' && <button type="button" className="bd-link" onClick={() => openPeriod(period.custom)}>Edit period</button>}
              {period?.type === 'monthly' && <button type="button" className="bd-link" onClick={() => openRange(period)}>Edit dates</button>}
              {rows.length > 0 && <button type="button" className="bd-link" onClick={() => setRecap(true)}>✨ Recap</button>}
              <button type="button" className="bd-link" onClick={() => setNoteModal({ text: note })}>📝 {note ? 'Edit note' : 'Add note'}</button>
            </span>
          </div>
          {nextKey || settings.period_type !== 'custom' && period?.type !== 'custom'
            ? <button className="btn-cancel" onClick={() => nextKey && setPeriodKey(nextKey)} aria-label={`Next ${unit}`}>→</button>
            : <button className="btn-primary" onClick={() => openPeriod(null)}>＋ New</button>}
        </div>
      )}

      {view === 'plan' && note && <p className="bd-periodnote" onClick={() => setNoteModal({ text: note })}>📝 {note}</p>}
      {error && <p className="error-msg" role="alert">{error}</p>}
      {notice && <p className="bd-notice" role="status">✓ {notice}</p>}
      {view === 'plan' && !periodKey && ready && (
        <div className="calendar-card bd-empty">
          <p><strong>Create your first budget period</strong></p>
          <p className="bd-dim">Custom periods let you budget for any date range — a pay cycle, a trip, a project.</p>
          <div className="bd-empty-actions"><button className="btn-primary" onClick={() => openPeriod(null)}>＋ New period</button></div>
        </div>
      )}

      {view === 'plan' && loading && periodKey && !items.length && <p className="loading">Crunching the plan… 🧮</p>}
      {view === 'calendar' && periodKey && <BudgetCalendar period={period} rows={rows} tx={tx} money={money} today={today} />}

      {view === 'plan' && (!loading || items.length > 0) && periodKey && (
        <>
          <div className="calendar-card bd-hero">
            <div className="bd-eq">
              <div><span className="bd-eq-label">Budget</span><span className="bd-eq-num">{money(totalBudget)}</span></div>
              <span className="bd-eq-op">−</span>
              <div><span className="bd-eq-label">Actual</span><span className="bd-eq-num">{money(totalActual)}</span></div>
              <span className="bd-eq-op">=</span>
              <div>
                <span className="bd-eq-label">{remaining >= 0 ? 'Remaining' : 'Over by'}</span>
                <span className="bd-eq-num" style={{ color: remaining >= 0 ? 'var(--good)' : 'var(--danger)' }}>{money(Math.abs(remaining))}</span>
              </div>
            </div>
            <div className="bd-bar bd-bar-big" aria-hidden="true">
              <span className="bd-bar-fill" style={{ width: `${Math.min(100, usedPct)}%`, background: statusColor(usedPct, remaining < 0) }} />
              {inPeriod && <span className="bd-bar-pace" style={{ left: `${paceFrac * 100}%` }} />}
            </div>
            <p className="bd-dim bd-hero-caption">
              {totalBudget > 0 ? `${Math.round(usedPct)}% of budget used` : 'Add budget lines below to get started'}
              {inPeriod && totalBudget > 0 ? ` · ${Math.round(paceFrac * 100)}% of the ${unit} gone` : ''}
            </p>
            <div className="bd-stats">
              {dailyLeft !== null && totalBudget > 0 && inPeriod && (
                <div title={`After ${money(safe.unpaidBills)} of unpaid bills`}><span className="bd-eq-label">Safe to spend / day</span><strong style={{ color: safe.perDay < 0 ? 'var(--danger)' : undefined }}>{safe.perDay >= 0 ? money(Math.floor(safe.perDay)) : '—'}</strong></div>
              )}
              {inPeriod && totalActual > 0 && (
                <div><span className="bd-eq-label">On pace to spend</span><strong style={{ color: projected > totalBudget && totalBudget > 0 ? 'var(--danger)' : undefined }}>{money(Math.round(projected))}</strong></div>
              )}
              <div><span className="bd-eq-label">Income {planIncome > 0 ? (settings.income_mode === 'planned' || !recentIncome.length ? 'planned' : settings.income_mode) : 'received'}</span><strong>{money(planIncome > 0 ? planIncome : receivedIncome)}</strong></div>
              {planIncome > 0 && (
                <div title={`Worked out from ${incomeLabel}`}><span className="bd-eq-label">{unallocated >= 0 ? 'Unallocated' : 'Over-allocated'}</span><strong style={{ color: unallocated < 0 ? 'var(--danger)' : undefined }}>{money(Math.abs(unallocated))}</strong></div>
              )}
              {projectedBalance !== null && inPeriod && (
                <div title="Account balance + income still to come − budget still to spend"><span className="bd-eq-label">Balance at {unit} end</span><strong style={{ color: projectedBalance < 0 ? 'var(--danger)' : undefined }}>{money(projectedBalance)}</strong></div>
              )}
            </div>
            {bizSpend > 0 && <p className="bd-dim bd-hero-caption">Business spending this {unit}: {money(bizSpend)} (tracked separately, not in this budget)</p>}
            {planIncome > 0 && unallocated > 0.5 && (
              <div className="bd-job"><span>💅 {money(unallocated)} has no job yet.</span><button type="button" className="bd-mini bd-mini-primary" onClick={openJob}>Give it a job</button></div>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="bd-alert" role="status">
              <strong>Heads up</strong>
              <ul>{warnings.slice(0, 5).map(w => <li key={w.r.id} className={`bd-alert-${w.kind}`}>{w.text}</li>)}</ul>
            </div>
          )}

          {bills.length > 0 && (
            <div className="calendar-card bd-bills">
              <p className="module-group-label">Bills this {unit}</p>
              <ul>
                {bills.map(b => {
                  const late = !b.pay && b.due < today
                  return (
                    <li key={b.id} className={b.pay ? 'bd-bill-paid' : ''}>
                      <label className="bd-bill-check">
                        <input type="checkbox" checked={!!b.pay} onChange={() => askBill(b)} aria-label={`Mark ${b.category} as paid`} />
                        <span>{b.icon || '🧾'} {b.category}</span>
                      </label>
                      <span className="bd-dim" style={late ? { color: 'var(--danger)' } : undefined}>{b.pay ? 'paid ✓' : late ? `overdue · ${fmtShort(b.due)}` : `due ${fmtShort(b.due)}`}</span>
                      <strong>{money(b.planned)}</strong>
                    </li>
                  )
                })}
              </ul>
              {billsOpen.length > 0 && <p className="bd-dim bd-note">{billsOpen.length} still to pay · {money(billsOpen.reduce((a, b) => a + b.planned, 0))}</p>}
            </div>
          )}

          {donutSlices.length > 0 && (
            <div className="calendar-card bd-charts">
              <button type="button" className="bd-tools-toggle" onClick={() => setShowCharts(v => !v)} aria-expanded={showCharts}><span>🍩 Where it went</span><span>{showCharts ? '▲' : '▼'}</span></button>
              {showCharts && (
                <div className="bd-chart-body">
                  <Donut slices={donutSlices} centerTop={money(totalActual)} centerBottom="spent" />
                  <ul className="bd-legend-list">
                    {donutSlices.map(d => <li key={d.label}><i style={{ background: d.color }} /><span>{d.label}</span><strong>{Math.round((d.value / (totalActual || 1)) * 100)}%</strong></li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="bd-toolbar">
            <div className="filter-row bd-pills">
              {[['all', 'All'], ['expense', 'Spending'], ['income', 'Income']].map(([k, l]) => (
                <button key={k} className={`filter-pill ${kindFilter === k ? 'filter-pill-active' : ''}`} onClick={() => setKindFilter(k)}>{l}</button>
              ))}
            </div>
            <div className="bd-toolbar-right">
              {groupNames.length > 1 && (
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} aria-label="Filter by group">
                  <option value="all">All groups</option>
                  {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
              <select value={sortKey} onChange={e => setSortKey(e.target.value)} aria-label="Sort">
                {SORTS.map(s => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
              </select>
              <button className="btn-primary" onClick={() => openNew()}>＋ Add line</button>
            </div>
          </div>

          {rows.length === 0 && (
            <div className="calendar-card bd-empty">
              <p><strong>Nothing planned for {monthLabel} yet.</strong></p>
              <p className="bd-dim">Add a line, copy last month, or fill it from what you usually spend.</p>
              <div className="bd-empty-actions">
                <button className="btn-primary" onClick={() => openNew()}>＋ Add first line</button>
                <button className="btn-cancel" onClick={copyFromLast}>Copy previous {unit}</button>
                <button className="btn-cancel" onClick={fillFromAverage}>Fill from 3-{unit} average</button>
                <button className="btn-cancel" onClick={openTemplates}>Templates…</button>
              </div>
            </div>
          )}

          {Object.entries(grouped).map(([g, list]) => renderGroup(g, list, false))}

          {incomeVisible.length > 0 && renderGroup('Income', incomeVisible, true)}

          {kindFilter !== 'income' && unbudgeted.length > 0 && (
            <section className="bd-group">
              <div className="bd-group-head"><h3>Unbudgeted spending</h3><span className="bd-dim">{money(sum(unbudgeted, 'actual'))}</span></div>
              <div className="bd-card">
                {unbudgeted.map(u => (
                  <div key={u.category} className="bd-row">
                    <div className="bd-row-main bd-row-static">
                      <span className="bd-icon">❔</span>
                      <span className="bd-row-body">
                        <span className="bd-row-top"><span className="bd-name">{u.category}</span><span className="bd-amounts">{money(u.actual)}</span></span>
                        <span className="bd-row-bar"><span className="bd-dim">No budget set</span>
                          <button type="button" className="bd-link" onClick={() => openNew({ category: u.category, planned_amount: String(Math.ceil(u.actual / 10) * 10) })}>Set a budget</button>
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="calendar-card bd-tools">
            <button type="button" className="bd-tools-toggle" onClick={() => setShowTools(s => !s)} aria-expanded={showTools}>
              <span>⚙️ Tools &amp; settings</span><span>{showTools ? '▲' : '▼'}</span>
            </button>
            {showTools && (
              <div className="bd-tools-body">
                <p className="module-group-label">Quick fill</p>
                <div className="bd-tool-actions">
                  <button className="btn-cancel" onClick={copyFromLast}>Copy from previous {unit}</button>
                  <button className="btn-cancel" onClick={importRecurring}>Import recurring expenses</button>
                  <button className="btn-cancel" onClick={fillFromAverage}>Fill from 3-{unit} average</button>
                  <button className="btn-cancel" onClick={openTemplates}>Templates &amp; copy from any period…</button>
                </div>
                <p className="module-group-label">Import &amp; rules</p>
                <div className="bd-tool-actions">
                  <button className="btn-cancel" onClick={() => setImportOpen(true)}>Import bank statement (CSV)</button>
                  <button className="btn-cancel" onClick={() => setRulesOpen(true)}>Auto-categorise rules ({rules.length})</button>
                  {typeof Notification !== 'undefined' && <button className="btn-cancel" onClick={toggleNotify}>{notifOn ? '🔔 Bill reminders on' : '🔕 Bill reminders off'}</button>}
                </div>
                <p className="module-group-label">Export &amp; share</p>
                <div className="bd-tool-actions">
                  <button className="btn-cancel" onClick={() => window.print()}>Print / save as PDF</button>
                  <button className="btn-cancel" onClick={exportCsv}>Download CSV</button>
                  <button className="btn-cancel" onClick={exportPng}>Download summary image</button>
                </div>
                <p className="module-group-label">Budget period</p>
                <div className="bd-pref-grid">
                  <div className="field">
                    <label>Track my budget</label>
                    <select value={settings.period_type} onChange={e => {
                      const t = e.target.value
                      saveSettings({ period_type: t, anchor_date: (t === 'weekly' || t === 'fortnightly') && !settings.anchor_date ? ymd(lastMonday()) : settings.anchor_date }, { resetPeriod: true })
                    }}>
                      {PERIOD_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <small className="bd-dim">Earlier periods are kept — see them under History.</small>
                  </div>
                  {settings.period_type === 'monthly' && (
                    <div className="field">
                      <label>Month starts on day</label>
                      <input type="number" min="1" max="28" value={settings.month_start_day} onChange={e => setSettings({ ...settings, month_start_day: e.target.value })} onBlur={e => saveSettings({ month_start_day: Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1)) }, { resetPeriod: true })} />
                      <small className="bd-dim">Default is 25, so a month runs from the 25th to the 24th. Use "Edit dates" on a period to change just that one.</small>
                    </div>
                  )}
                  {(settings.period_type === 'weekly' || settings.period_type === 'fortnightly') && (
                    <div className="field">
                      <label>Periods start on</label>
                      <input type="date" value={settings.anchor_date || ''} onChange={e => saveSettings({ anchor_date: e.target.value || null }, { resetPeriod: true })} />
                      <small className="bd-dim">Pick any {settings.period_type === 'weekly' ? 'week' : 'fortnight'} start date (e.g. a payday) — periods repeat from it.</small>
                    </div>
                  )}
                  {settings.period_type === 'custom' && (
                    <div className="field">
                      <label>Your periods</label>
                      <button type="button" className="btn-cancel" onClick={() => openPeriod(null)}>＋ New period</button>
                      <small className="bd-dim">{customs.length} created · use ← → to move between them.</small>
                    </div>
                  )}
                </div>
                <p className="module-group-label">Income</p>
                <div className="bd-pref-grid">
                  <div className="field">
                    <label>Plan against</label>
                    <select value={settings.income_mode || 'planned'} onChange={e => saveSettings({ income_mode: e.target.value })}>
                      <option value="planned">My planned income</option>
                      <option value="lowest">My lowest recent period</option>
                      <option value="average">My average of recent periods</option>
                    </select>
                    <small className="bd-dim">For irregular pay. Used for “unallocated” and %-of-income lines. Looks at the last 3 periods.</small>
                  </div>
                </div>
                <p className="module-group-label">Alerts</p>
                <div className="bd-pref-grid">
                  <div className="field">
                    <label>Warn me at (% of budget used)</label>
                    <input type="number" min="1" max="100" value={settings.warn_pct} onChange={e => setSettings({ ...settings, warn_pct: e.target.value })} onBlur={e => saveSettings({ warn_pct: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 80)) })} />
                    <small className="bd-dim">Bars turn amber at this point and red when over.</small>
                  </div>
                </div>
                <p className="module-group-label">Categories</p>
                <p className="bd-dim">Shared with Personal and Recurring.</p>
                <form className="budget-cat-form" onSubmit={handleAddCategory}>
                  <input placeholder="New category (e.g. Pets)" value={catInput} onChange={e => setCatInput(e.target.value)} aria-label="New category name" />
                  <button className="btn-primary" type="submit">Create</button>
                </form>
                <div className="budget-cat-chips">
                  {knownCats.map(c => {
                    const saved = savedRows.some(r => r.name.toLowerCase() === c.toLowerCase())
                    return (
                      <span key={c} className="budget-cat-chip">{c}
                        <button type="button" aria-label={`Rename or merge category ${c}`} title="Rename or merge" onClick={() => setRenameModal({ from: c, to: c })}>✎</button>
                        {saved && <button type="button" aria-label={`Delete category ${c}`} onClick={() => removeCategory(c)}>✕</button>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {view === 'history' && (
        <>
          {histLoading && <p className="loading">Looking back… 📈</p>}
          {!histLoading && history.length === 0 && (
            <div className="calendar-card bd-empty"><p><strong>No history yet</strong></p><p className="bd-dim">Once you set budgets, every period you track shows up here.</p></div>
          )}
          {!histLoading && history.length > 0 && (() => {
            const tracked = history.filter(h => h.budget > 0)
            const under = tracked.filter(h => h.end < today && h.spent <= h.budget).length
            const finished = tracked.filter(h => h.end < today).length
            const avg = history.length ? history.reduce((a, h) => a + h.spent, 0) / history.length : 0
            const maxVal = Math.max(1, ...history.map(h => Math.max(h.budget, h.spent)))
            let streak = 0
            for (const h of history.filter(x => x.end < today && x.budget > 0)) { if (h.spent <= h.budget) streak++; else break }
            return (
              <>
                <div className="calendar-card bd-hero">
                  <div className="bd-stats bd-stats-top">
                    <div><span className="bd-eq-label">Periods tracked</span><strong>{history.length}</strong></div>
                    <div><span className="bd-eq-label">Finished under budget</span><strong>{finished ? `${under} of ${finished}` : '—'}</strong></div>
                    <div><span className="bd-eq-label">Average spend</span><strong>{money(avg)}</strong></div>
                    {streak > 0 && <div><span className="bd-eq-label">Under-budget streak</span><strong>{streak} 🔥</strong></div>}
                  </div>
                </div>
                <div className="calendar-card bd-lookup">
                  <p className="module-group-label">Look up a category</p>
                  <select value={lookup} onChange={e => setLookup(e.target.value)} aria-label="Category to look up">
                    <option value="">Choose a category…</option>
                    {[...new Set(histTx.filter(t => t.type === 'expense').map(t => t.category || 'Uncategorized'))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {lookup && (() => {
                    const mine = histTx.filter(t => t.type === 'expense' && (t.category || 'Uncategorized') === lookup)
                    const yr = String(new Date().getFullYear())
                    const total = mine.reduce((a, t) => a + Number(t.amount), 0)
                    const thisYear = mine.filter(t => t.date.startsWith(yr)).reduce((a, t) => a + Number(t.amount), 0)
                    const per = history.map(h => ({ h, v: mine.filter(t => t.date >= ymd(h.start) && t.date <= ymd(h.end)).reduce((a, t) => a + Number(t.amount), 0) })).filter(x => x.v > 0)
                    return (
                      <div className="bd-lookup-res">
                        <p><strong>{money(thisYear)}</strong> <span className="bd-dim">this year · {money(total)} across all tracked periods · {mine.length} transactions</span></p>
                        <ul className="bd-tx">{per.map(x => <li key={x.h.key}><span>{x.h.label}</span><strong>{money(x.v)}</strong></li>)}</ul>
                      </div>
                    )
                  })()}
                </div>
                {history.length > 1 && (
                  <div className="calendar-card bd-charts">
                    <p className="module-group-label">Budget vs spent</p>
                    <TrendBars money={money} data={[...history].slice(0, 12).reverse().map(h => ({ label: h.label, short: h.type === 'monthly' ? h.label.slice(0, 3) : fmtShort(h.start), budget: h.budget, spent: h.spent }))} />
                  </div>
                )}
                <section className="bd-group">
                  {history.map(h => {
                    const left = h.budget - h.spent
                    const isOver = h.budget > 0 && left < 0
                    const pct = h.budget > 0 ? (h.spent / h.budget) * 100 : 0
                    const color = h.budget === 0 ? 'var(--ink-faint)' : statusColor(pct, isOver)
                    return (
                      <button key={h.key} type="button" className={`bd-row bd-hist-row ${h.key === periodKey ? 'bd-hist-current' : ''}`} onClick={() => { setPeriodKey(h.key); setView('plan') }}>
                        <span className="bd-row-top">
                          <span className="bd-name">{h.label}{h.start <= today && today <= h.end ? ' · now' : ''}</span>
                          <span className="bd-chip" style={{ color, borderColor: color }}>
                            {h.budget === 0 ? 'No budget' : isOver ? `${money(-left)} over` : `${money(left)} left`}
                          </span>
                        </span>
                        <span className="bd-dim">{h.sub}</span>
                        <span className="bd-hist-bars" aria-hidden="true">
                          <span className="bd-hist-bar" style={{ width: `${(h.budget / maxVal) * 100}%`, background: 'var(--border-strong)' }} />
                          <span className="bd-hist-bar" style={{ width: `${(h.spent / maxVal) * 100}%`, background: color }} />
                        </span>
                        <span className="bd-row-bottom">
                          <span className="bd-dim">Budget {money(h.budget)}</span>
                          <span className="bd-dim">Spent {money(h.spent)}{h.incomeActual > 0 ? ` · Income ${money(h.incomeActual)}` : ''}</span>
                        </span>
                      </button>
                    )
                  })}
                </section>
              </>
            )
          })()}
        </>
      )}

      <BudgetModals {...modalProps} />
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} knownCats={knownCats} rules={rules} money={money} currency={currency} onDone={(n) => { setImportOpen(false); refreshCats(); flash(`Imported ${n} transactions`); load() }} />}
      {rulesOpen && <RulesModal onClose={() => { setRulesOpen(false); loadRules().then(setRules) }} knownCats={knownCats} />}
    </div>
  )
}
